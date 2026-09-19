/**
 * SurviBar — Horno del suelo de cerca, offline, en Node.
 *
 * Pinta cuatro capas de suelo del Nahuel Huapi —la hojarasca del bosque húmedo,
 * el andisol con lapilli de pómez, la arena de la estepa y el acarreo granítico
 * de altura— y las escribe a `public/tex/suelo/` con un `manifiesto.json`. El
 * juego nunca corre esto: carga los PNG como cualquier otro archivo
 * (`src/util/suelo.js`) y el terreno los lee en los últimos metros.
 *
 * Por qué horneado y no ruido en el shader: es la regla de la ronda 3
 * (`RONDA3.md`, «Por qué por textura y no por shader»), medida en esta máquina.
 * La GT 630M con la que juega el dueño pierde 8× en matemática de shader y gana
 * 2,3× en lecturas de textura. El suelo de cerca eran unas quince fbm de ruido de
 * valor por píxel y se veía como una mancha marrón: el ruido de valor sólo sabe
 * hacer manchas redondeadas. Acá sí hay bordes —una hoja con su contorno, una
 * piedrita con su canto, la grieta de un bloque— porque se dibujan una por una,
 * una sola vez, y el juego sólo lee texels.
 *
 * ── Cómo se pinta ─────────────────────────────────────────────────────────
 * Cada capa es un lienzo de LADO×LADO texels que cubre PERIODO_M metros, con un
 * campo de ALTURA en milímetros de verdad, el albedo lineal y la rugosidad. Los
 * objetos (hojas, ramitas, piedras, pajas) se estampan en orden y el más alto
 * gana en cada texel, como un z-buffer: la hoja que cayó después tapa a la de
 * abajo, la piedrita asoma sobre la arena. Cada texel se muestrea 2×2 para que
 * los bordes queden suavizados por cobertura y no en escalera.
 *
 * De la altura salen la normal (Sobel sobre milímetros reales, sin exagerar) y
 * la oclusión (lo que queda por debajo del promedio de su vecindario recibe
 * menos cielo). Todo se calcula sobre el toro: las coordenadas dan la vuelta,
 * los objetos que cruzan el borde siguen del otro lado y los desenfoques
 * envuelven. Por eso cada capa calza consigo misma sin retocar la costura.
 *
 * ── Los archivos ──────────────────────────────────────────────────────────
 *   <id>_albedo.png   RGB = albedo en sRGB · A = altura (0 el fondo, 255 lo más alto)
 *   <id>_normal.png   R, G = normal en el plano (x a lo largo de las columnas,
 *                     y a lo largo de las filas; la z se reconstruye) ·
 *                     B = oclusión · A = rugosidad
 * Columnas = +X del mundo, filas = +Z: el terreno los lee con uv = xz / período.
 *
 * ── Determinismo ──────────────────────────────────────────────────────────
 * Nunca `Math.random()` ni `Date`. El azar secuencial sale de mulberry32
 * sembrado con FNV-1a del id de la capa, y el grano por texel de un hash puro de
 * la coordenada, igual que `tools/hornear-texturas.mjs`. Misma entrada, mismos
 * bytes: lo comprueba el banco corriéndolo dos veces.
 *
 * Uso: node tools/hornear-suelo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(__dirname, '..', 'public', 'tex', 'suelo');

// ── Escala ─────────────────────────────────────────────────────────────────
// 512 texels sobre 2 m son 3,9 mm por texel. Es la densidad que tiene la
// pantalla en la franja de abajo mirando al suelo (1024×576, 62° de campo, a
// 1,7 m de altura y entre 0,8 y 2,2 m de distancia: unos 250 píxeles por metro).
// Más fino y el mipmap lo promedia antes de que se vea; más grueso y se estira.
// Y cuatro capas de 512 con sus dos archivos y sus mipmaps son 10,7 MB, bajo el
// tope de 12 del contrato; a 1024 serían 42.
const LADO = 512;
const PERIODO_M = 2.0;
const MM = PERIODO_M * 1000 / LADO;   // milímetros por texel

// ── Azar determinista ──────────────────────────────────────────────────────
function hashCadena(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash puro por texel: el mismo (semilla, x, y) da siempre lo mismo, en cualquier orden. */
function hash2D(semilla, x, y) {
  let h = semilla | 0;
  h = Math.imul(h ^ x, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= (y + 0x9e3779b9 + (h << 6) + (h >>> 2)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ── Utilidades ─────────────────────────────────────────────────────────────
const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const suave = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const escalar = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
/** sRGB de 8 bits → lineal. La misma cuenta que usa el banco para medir el albedo. */
function lineal(c) { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function aSRGB8(l) {
  const v = clamp01(l);
  return clampByte(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}
/** Los colores se escriben en sRGB, que es como se los mide en una foto, y se pinta en lineal. */
const col = (r, g, b) => [lineal(r), lineal(g), lineal(b)];
const elegir = (rnd, lista) => lista[Math.floor(rnd() * lista.length) % lista.length];

/**
 * Ruido de valor periódico: la retícula tiene `celdas` celdas por lado del
 * mosaico, así que calza sola. Se usa sólo para la variación de fondo (manchas
 * de humedad, parches más y menos cubiertos), nunca para dibujar un objeto.
 */
function ruidoP(semilla, x, y, celdas) {
  const u = (x / LADO) * celdas, v = (y / LADO) * celdas;
  const i0 = Math.floor(u), j0 = Math.floor(v);
  let fx = u - i0, fy = v - j0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const ia = mod(i0, celdas), ib = mod(i0 + 1, celdas), ja = mod(j0, celdas), jb = mod(j0 + 1, celdas);
  const a = hash2D(semilla, ia, ja), b = hash2D(semilla, ib, ja);
  const c = hash2D(semilla, ia, jb), d = hash2D(semilla, ib, jb);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
function fbmP(semilla, x, y, celdas, octavas) {
  let v = 0, a = 0.5, s = 0;
  for (let o = 0; o < octavas; o++) { v += a * ruidoP(semilla + o * 7919, x, y, celdas << o); s += a; a *= 0.5; }
  return v / s;
}

// ── El lienzo ──────────────────────────────────────────────────────────────
const SUB = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
/** Lo que devuelve una forma en un punto. Uno solo, reusado: son millones de consultas. */
const M = { h: 0, r: 0, g: 0, b: 0, ru: 0 };

class Lienzo {
  constructor() {
    this.H = new Float32Array(LADO * LADO);       // altura, mm
    this.C = new Float32Array(LADO * LADO * 3);   // albedo lineal
    this.R = new Float32Array(LADO * LADO);       // rugosidad
  }

  fondo(fn) {
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        fn(x, y);
        const k = y * LADO + x;
        this.H[k] = M.h; this.C[k * 3] = M.r; this.C[k * 3 + 1] = M.g; this.C[k * 3 + 2] = M.b; this.R[k] = M.ru;
      }
    }
  }

  /**
   * Estampa una forma centrada en (cx, cy) dentro de un radio. `forma(lx, ly, gx,
   * gy)` recibe la posición local y la del texel (ya envuelta) y devuelve si el
   * punto cae adentro, dejando en `M` su altura, su albedo y su rugosidad. Gana
   * el más alto, y en el borde se mezcla por la fracción de las cuatro muestras
   * que cayeron adentro.
   */
  estampar(cx, cy, radio, forma) {
    const x0 = Math.floor(cx - radio), x1 = Math.ceil(cx + radio);
    const y0 = Math.floor(cy - radio), y1 = Math.ceil(cy + radio);
    for (let py = y0; py <= y1; py++) {
      const gy = mod(py, LADO);
      for (let px = x0; px <= x1; px++) {
        const gx = mod(px, LADO);
        let n = 0, sh = 0, sr = 0, sg = 0, sb = 0, su = 0;
        for (let s = 0; s < 4; s++) {
          if (!forma(px + SUB[s][0] - cx, py + SUB[s][1] - cy, gx, gy)) continue;
          n++; sh += M.h; sr += M.r; sg += M.g; sb += M.b; su += M.ru;
        }
        if (!n) continue;
        const k = gy * LADO + gx;
        const h = sh / n;
        if (h <= this.H[k]) continue;
        const t = n / 4;
        this.H[k] += (h - this.H[k]) * t;
        this.C[k * 3] += (sr / n - this.C[k * 3]) * t;
        this.C[k * 3 + 1] += (sg / n - this.C[k * 3 + 1]) * t;
        this.C[k * 3 + 2] += (sb / n - this.C[k * 3 + 2]) * t;
        this.R[k] += (su / n - this.R[k]) * t;
      }
    }
  }
}

// ── Formas ─────────────────────────────────────────────────────────────────

/**
 * Una hoja: lámina con contorno, pecíolo y nervio, curvada. `perfil(t)` da el
 * medio ancho relativo a lo largo del nervio (t de 0 en la base a 1 en el ápice)
 * y `margen(t)` los dientes o lóbulos del borde. `curva` > 0 levanta los bordes
 * (hoja acucharada); < 0 la arquea con el centro arriba.
 */
function hoja(o) {
  const c = Math.cos(o.ang), s = Math.sin(o.ang);
  const semilla = o.semilla;
  return (lx, ly, gx, gy) => {
    const u = lx * c + ly * s, v = -lx * s + ly * c;
    const t = u / o.largo + 0.5;
    if (t < 0) {
      if (t < -o.peciolo || Math.abs(v) > 0.32) return false;
      M.h = o.hBase + 0.15; M.r = o.color[0] * 0.7; M.g = o.color[1] * 0.7; M.b = o.color[2] * 0.7; M.ru = o.rug;
      return true;
    }
    if (t > 1) return false;
    const w = 0.5 * o.ancho * o.perfil(t) * o.margen(t);
    const av = Math.abs(v);
    if (w <= 0.05 || av > w) return false;
    const q = av / w;
    M.h = o.hBase + (o.curva >= 0 ? o.curva * q * q : -o.curva * (1 - q * q)) + (q < 0.18 ? 0.12 : 0);
    // El nervio medio es más claro por el envés y el borde algo más oscuro: sin
    // eso la hoja es una silueta plana y no se lee como hoja.
    let k = 1 - 0.14 * q * q;
    if (q < 0.16 && o.nervio) k *= 1.16;
    k *= 0.92 + 0.16 * hash2D(semilla, gx, gy);
    M.r = o.color[0] * k; M.g = o.color[1] * k; M.b = o.color[2] * k; M.ru = o.rug;
    return true;
  };
}

/** Una ramita: curva de Bézier cuadrática con grosor que se afina, corteza y punta clara. */
function ramita(o) {
  const P = [];
  const SEG = 10;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
    P.push([a * o.p0[0] + b * o.p1[0] + d * o.p2[0], a * o.p0[1] + b * o.p1[1] + d * o.p2[1]]);
  }
  return (lx, ly, gx, gy) => {
    let mejor = 1e9, tm = 0;
    for (let i = 0; i < SEG; i++) {
      const ax = P[i][0], ay = P[i][1], bx = P[i + 1][0] - ax, by = P[i + 1][1] - ay;
      const l2 = bx * bx + by * by || 1e-9;
      const f = clamp01(((lx - ax) * bx + (ly - ay) * by) / l2);
      const dx = lx - ax - bx * f, dy = ly - ay - by * f;
      const d = dx * dx + dy * dy;
      if (d < mejor) { mejor = d; tm = (i + f) / SEG; }
    }
    const r = o.r0 + (o.r1 - o.r0) * tm;
    const d = Math.sqrt(mejor);
    if (d > r) return false;
    const e = Math.sqrt(1 - (d / r) * (d / r));
    M.h = o.hBase + r * MM * e;
    const k = (0.82 + 0.18 * e) * (0.9 + 0.2 * hash2D(o.semilla, gx, gy)) * (tm > 0.92 ? 1.25 : 1);
    M.r = o.color[0] * k; M.g = o.color[1] * k; M.b = o.color[2] * k; M.ru = 0.9;
    return true;
  };
}

/**
 * Una piedra redondeada o un lapilli: polígono estrellado de radios sorteados y
 * cúpula por altura. `redondez` 0,5 es una cúpula; más bajo, una piedra achatada
 * de tope plano. `grano(gx, gy, color)` pinta los minerales o las vesículas.
 */
function guijarro(o) {
  const n = o.radios.length;
  return (lx, ly, gx, gy) => {
    const r = Math.hypot(lx, ly);
    if (r > o.radio) return false;
    let f = (Math.atan2(ly, lx) - o.ang) / (2 * Math.PI);
    f = (f - Math.floor(f)) * n;
    const i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
    const tt = o.anguloso ? t : t * t * (3 - 2 * t);
    const R = o.radio * (o.radios[i] + (o.radios[j] - o.radios[i]) * tt);
    if (r > R) return false;
    const q = r / R;
    M.h = o.hBase + o.hMax * Math.pow(1 - q * q, o.redondez);
    let [cr, cg, cb] = o.grano ? o.grano(gx, gy, o.color) : o.color;
    // Un canto se oscurece algo hacia el borde, donde se le pega la tierra.
    const k = 1 - 0.18 * Math.pow(q, 3);
    M.r = cr * k; M.g = cg * k; M.b = cb * k; M.ru = o.rug;
    return true;
  };
}

/**
 * Un bloque anguloso de acarreo: polígono convexo (intersección de semiplanos),
 * tope casi plano e inclinado, canto biselado, grietas y líquenes. Es lo que da
 * la gelifracción del granito: caras planas y aristas vivas, no cantos rodados.
 */
function bloque(o) {
  const n = o.vertices.length;
  const lados = [];
  for (let i = 0; i < n; i++) {
    const a = o.vertices[i], b = o.vertices[(i + 1) % n];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    // Normal hacia adentro: el centro (0,0) tiene que quedar del lado positivo
    if (nx * (0 - a[0]) + ny * (0 - a[1]) < 0) { nx = -nx; ny = -ny; }
    lados.push([nx, ny, -(nx * a[0] + ny * a[1])]);
  }
  return (lx, ly, gx, gy) => {
    let dmin = 1e9;
    for (let i = 0; i < n; i++) {
      const d = lados[i][0] * lx + lados[i][1] * ly + lados[i][2];
      if (d < 0) return false;
      if (d < dmin) dmin = d;
    }
    let h = o.hBase + o.hMax * Math.pow(Math.min(1, dmin / o.bisel), 0.55) + (o.incl[0] * lx + o.incl[1] * ly) * MM;
    let [cr, cg, cb] = o.grano(gx, gy, o.color);
    let ru = o.rug;
    for (const g of o.grietas) {
      const d = Math.abs(g[0] * lx + g[1] * ly - g[2]);
      if (d < g[3]) { h -= 2.2; cr *= 0.42; cg *= 0.42; cb *= 0.42; }
    }
    for (const l of o.liquenes) {
      const dx = lx - l[0], dy = ly - l[1];
      if (dx * dx + dy * dy < l[2] * l[2]) {
        const m = 0.7 + 0.3 * hash2D(o.semilla, gx, gy);
        cr = l[3][0] * m; cg = l[3][1] * m; cb = l[3][2] * m; ru = 0.96; h += 0.3;
      }
    }
    M.h = h; M.r = cr; M.g = cg; M.b = cb; M.ru = ru;
    return true;
  };
}

/** Tamaños con ley de potencia: muchas chicas, pocas grandes, como cualquier depósito clástico. */
function potencia(rnd, min, max, exponente) {
  const a = Math.pow(min, 1 - exponente), b = Math.pow(max, 1 - exponente);
  return Math.pow(a + (b - a) * rnd(), 1 / (1 - exponente));
}
/** Radios de un polígono de `n` vértices, entre `min` y 1. */
const radiosAzar = (rnd, n, min) => Array.from({ length: n }, () => min + (1 - min) * rnd());
/** Siembra con rechazo contra un campo de densidad 0..1: los parches más y menos cubiertos. */
function sembrar(rnd, densidad) {
  for (let i = 0; i < 64; i++) {
    const x = rnd() * LADO, y = rnd() * LADO;
    if (rnd() < densidad(x, y)) return [x, y];
  }
  return [rnd() * LADO, rnd() * LADO];
}
/** Milímetros o centímetros a texels. */
const cmATx = (cm) => (cm * 10) / MM;

// ═══════════════════════════════════════════════════════════════════════════
// LAS CUATRO CAPAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 1 · Hojarasca del bosque húmedo de coihue y lenga.
 *
 * Nothofagus dombeyi (coihue): lámina de 2 a 3,5 cm, aovado-lanceolada y
 * aserrada, coriácea; es siempreverde y la que cae se pone pardo amarillenta y
 * después parda. Nothofagus pumilio (lenga): 2 a 3,5 cm, elíptica, borde
 * doblemente crenado, cae pardo rojiza y anaranjada en otoño. Nothofagus
 * antarctica (ñire), más chica y lobulada, entra en los bordes. Chusquea culeou
 * (caña colihue), el sotobosque del coihual, deja hojas lanceoladas de 5 a 10 cm.
 * Debajo, el mantillo pardo muy oscuro y ramitas de 2 a 6 mm.
 */
function hojarasca(rnd, semilla) {
  const L = new Lienzo();
  const HUMUS = [col(40, 31, 24), col(62, 48, 36)];
  L.fondo((x, y) => {
    const g = fbmP(semilla + 1, x, y, 8, 3);
    const f = hash2D(semilla + 2, x, y);
    const c = mezclar(HUMUS[0], HUMUS[1], g);
    const k = 0.8 + 0.4 * f;
    M.h = (g - 0.5) * 1.2 + (f - 0.5) * 0.3; M.r = c[0] * k; M.g = c[1] * k; M.b = c[2] * k; M.ru = 0.97;
  });
  // Parches de medio metro más y menos cubiertos: a diez metros, con el
  // mosaico ya en un mipmap chico, es lo que sigue dando textura.
  const dens = (x, y) => 0.35 + 0.65 * suave(0.3, 0.7, fbmP(semilla + 3, x, y, 4, 2));

  // Migas de hoja descompuesta, lo que queda entre las enteras
  for (let i = 0; i < 9000; i++) {
    const [x, y] = sembrar(rnd, dens);
    const r = 0.5 + rnd() * 0.9;
    const c = escalar(elegir(rnd, [col(78, 60, 42), col(96, 76, 50), col(58, 45, 34)]), 0.9 + rnd() * 0.2);
    L.estampar(x, y, r + 1, guijarro({ radio: r, radios: radiosAzar(rnd, 5, 0.5), ang: rnd() * 6.3, hBase: 0.1, hMax: 0.2, redondez: 0.5, color: c, rug: 0.95 }));
  }

  const PALETA = {
    coihue: [col(118, 104, 58), col(140, 112, 62), col(112, 84, 52), col(98, 90, 50), col(150, 126, 74)],
    lenga: [col(150, 82, 44), col(168, 110, 56), col(128, 72, 44), col(176, 126, 64), col(120, 86, 54)],
    nire: [col(138, 98, 52), col(112, 80, 50), col(152, 110, 60)],
    colihue: [col(176, 158, 112), col(158, 140, 98), col(138, 124, 90)],
  };
  const PERFIL = {
    coihue: (t) => Math.pow(Math.sin(Math.PI * t), 0.8) * (1.12 - 0.26 * t),
    lenga: (t) => Math.pow(Math.sin(Math.PI * t), 0.6),
    nire: (t) => Math.pow(Math.sin(Math.PI * t), 0.65) * (1 + 0.14 * Math.sin(t * Math.PI * 7)),
    colihue: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.6)), 0.35) * (1 - 0.8 * t),
  };
  const MARGEN = {
    coihue: (n) => (t) => 1 + 0.07 * (1 - 2 * ((t * n) % 1)),
    lenga: (n) => (t) => 1 + 0.09 * Math.abs(Math.sin(Math.PI * t * n)),
    nire: (n) => (t) => 1 + 0.12 * Math.abs(Math.sin(Math.PI * t * n)),
    colihue: () => () => 1,
  };
  const TOTAL = 22000;
  const HUMUS_VIEJO = col(52, 40, 30);
  let proximaRamita = 0;
  for (let i = 0; i < TOTAL; i++) {
    const orden = i / TOTAL;
    // Las ramitas caen entre las hojas, no encima de todas: se intercalan.
    if (orden >= proximaRamita) {
      proximaRamita += 1 / 46;
      const [x, y] = sembrar(rnd, dens);
      const largo = cmATx(5 + rnd() * 20), a = rnd() * Math.PI * 2;
      const ex = Math.cos(a) * largo / 2, ey = Math.sin(a) * largo / 2;
      const curva = (rnd() - 0.5) * 0.4 * largo;
      const r0 = cmATx(0.1 + rnd() * 0.2);
      L.estampar(x, y, largo / 2 + Math.abs(curva) + 2, ramita({
        p0: [-ex, -ey], p1: [-Math.sin(a) * curva, Math.cos(a) * curva], p2: [ex, ey],
        r0, r1: r0 * 0.55, hBase: 0.4 + 3 * orden, semilla: semilla + i,
        color: escalar(elegir(rnd, [col(96, 82, 66), col(78, 68, 58), col(110, 96, 80)]), 0.9 + rnd() * 0.2),
      }));
    }
    const [x, y] = sembrar(rnd, dens);
    const u = rnd();
    const especie = u < 0.55 ? 'coihue' : u < 0.82 ? 'lenga' : u < 0.9 ? 'nire' : u < 0.915 ? 'colihue' : 'coihue';
    const largoCm = especie === 'colihue' ? 5 + rnd() * 5 : especie === 'nire' ? 1.5 + rnd() * 1.5 : 2 + rnd() * 1.5;
    const largo = cmATx(largoCm);
    const ancho = largo * (especie === 'colihue' ? 0.12 : especie === 'coihue' ? 0.42 : especie === 'lenga' ? 0.55 : 0.6);
    // La que está abajo es la que cayó antes: más oscura, más comida.
    const edad = (1 - orden) * 0.5 + rnd() * 0.25;
    const color = mezclar(elegir(rnd, PALETA[especie]), HUMUS_VIEJO, clamp01(edad));
    L.estampar(x, y, largo * 0.62 + 1, hoja({
      largo, ancho, ang: rnd() * Math.PI * 2, perfil: PERFIL[especie],
      margen: MARGEN[especie](especie === 'lenga' ? 7 + Math.floor(rnd() * 3) : 9 + Math.floor(rnd() * 5)),
      peciolo: especie === 'colihue' ? 0.02 : 0.12, nervio: especie !== 'colihue',
      curva: (rnd() < 0.6 ? 1 : -1) * (0.3 + rnd() * 1.0), hBase: 0.5 + 3.0 * orden + rnd() * 0.2,
      color, rug: especie === 'coihue' ? 0.72 : 0.84, semilla: semilla + 101 + i,
    }));
  }
  return { L, oclusion: { a2: 0.16, a8: 0.07, piso: 0.4 } };
}

/**
 * 2 · Andisol pardo con lapilli de pómez.
 *
 * Los suelos del Parque se formaron sobre ceniza volcánica: andisoles, con un
 * horizonte A pardo muy oscuro a negro por la materia orgánica (Munsell 10YR 2/2
 * a 3/3) y una estructura migajosa de grumos de pocos milímetros. Encima, el
 * lapilli de pómez riolítica del Puyehue-Cordón Caulle: la erupción de 2011 dejó
 * en Villa La Angostura una capa de pómez blanca a gris clara con clastos de 1 a
 * 3 cm y fragmentos de 2 a 64 mm, que es la definición de lapilli (Pistolesi et
 * al. 2015, Bull. Volcanol. 77:3). Los clastos son angulosos a subredondeados y
 * vesiculares. Entran hojas sueltas de ñire y alguna ramita: es el suelo del
 * bosque abierto de ñire y ciprés.
 */
function andisol(rnd, semilla) {
  const L = new Lienzo();
  const SUELO = [col(46, 35, 27), col(78, 60, 44)];
  L.fondo((x, y) => {
    const g = fbmP(semilla + 1, x, y, 6, 3);
    const f = hash2D(semilla + 2, x, y);
    const c = mezclar(SUELO[0], SUELO[1], g);
    const k = 0.82 + 0.36 * f;
    M.h = (g - 0.5) * 1.5 + (f - 0.5) * 0.4; M.r = c[0] * k; M.g = c[1] * k; M.b = c[2] * k; M.ru = 0.97;
  });
  // Grumos del horizonte A: el migajón que se desarma entre los dedos
  for (let i = 0; i < 16000; i++) {
    const x = rnd() * LADO, y = rnd() * LADO;
    const r = 0.6 + rnd() * 1.6;
    const c = escalar(mezclar(SUELO[0], SUELO[1], rnd()), 0.9 + rnd() * 0.35);
    L.estampar(x, y, r + 1, guijarro({ radio: r, radios: radiosAzar(rnd, 6, 0.6), ang: rnd() * 6.3, hBase: 0.2, hMax: 0.5 + r * 0.6, redondez: 0.6, color: c, rug: 0.97 }));
  }
  // Donde la pómez se juntó y donde se la llevó el agua
  const dens = (x, y) => 0.3 + 0.7 * suave(0.28, 0.72, fbmP(semilla + 3, x, y, 4, 2));
  const POMEZ = [col(214, 208, 192), col(196, 191, 178), col(226, 221, 206), col(184, 177, 162)];
  const LITICO = col(72, 70, 68);
  let area = 0;
  const OBJETIVO = 0.12 * LADO * LADO;
  const vesiculas = (s) => (gx, gy, c) => {
    const h = hash2D(s, gx, gy);
    const k = h < 0.2 ? 0.66 : 0.94 + 0.1 * h;
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  // Desde 4 mm: el lapilli más chico que eso cae debajo de un texel y no se ve.
  // Tope casi plano y canto vivo (redondez baja): una cúpula de 0,5 los hacía
  // perlas, y la pómez es un fragmento roto de espuma, no una bolita.
  while (area < OBJETIVO) {
    const [x, y] = sembrar(rnd, dens);
    const dMM = potencia(rnd, 4, 40, 2.3);
    const r = dMM / 2 / MM;
    area += Math.PI * r * r * 0.7;
    const litico = rnd() < 0.05;
    const c = litico ? LITICO : mezclar(elegir(rnd, POMEZ), SUELO[1], rnd() * 0.3);
    L.estampar(x, y, r + 1, guijarro({
      radio: r, radios: radiosAzar(rnd, 5 + Math.floor(rnd() * 4), 0.5), ang: rnd() * 6.3, anguloso: true,
      hBase: 0.3, hMax: dMM * 0.3, redondez: 0.22, color: c, rug: 0.9, grano: vesiculas(semilla + 5 + (area | 0)),
    }));
  }
  // Hojas de ñire y alguna ramita
  const PAL = [col(138, 98, 52), col(112, 80, 50), col(96, 72, 48), col(150, 108, 58)];
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * LADO, y = rnd() * LADO;
    const largo = cmATx(1.5 + rnd() * 1.5);
    L.estampar(x, y, largo * 0.62 + 1, hoja({
      largo, ancho: largo * 0.6, ang: rnd() * 6.3,
      perfil: (t) => Math.pow(Math.sin(Math.PI * t), 0.65) * (1 + 0.14 * Math.sin(t * Math.PI * 7)),
      margen: () => 1, peciolo: 0.12, nervio: true, curva: 0.4 + rnd() * 0.8,
      hBase: 1.0 + rnd() * 3, color: mezclar(elegir(rnd, PAL), SUELO[0], rnd() * 0.4), rug: 0.85, semilla: semilla + 7 + i,
    }));
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * LADO, y = rnd() * LADO;
    const largo = cmATx(5 + rnd() * 15), a = rnd() * 6.3, curva = (rnd() - 0.5) * 0.3 * largo;
    const ex = Math.cos(a) * largo / 2, ey = Math.sin(a) * largo / 2;
    const r0 = cmATx(0.1 + rnd() * 0.15);
    L.estampar(x, y, largo / 2 + Math.abs(curva) + 2, ramita({
      p0: [-ex, -ey], p1: [-Math.sin(a) * curva, Math.cos(a) * curva], p2: [ex, ey], r0, r1: r0 * 0.6,
      hBase: 1.2, semilla: semilla + 900 + i, color: col(88, 76, 62),
    }));
  }
  return { L, oclusion: { a2: 0.07, a8: 0.03, piso: 0.4 } };
}

/**
 * 3 · Estepa: arena volcánica con gravilla y coirón seco.
 *
 * Al este de la cordillera el suelo es arena volcánica gris parda, suelta, con un
 * pavimento de gravilla de 4 a 30 mm que deja el viento al llevarse lo fino:
 * basalto gris oscuro, andesita gris violácea, escoria rojiza y toba clara. La
 * vegetación es la estepa graminosa de coirón (Festuca pallescens, Pappostipa
 * speciosa; León et al. 1998, Ecología Austral 8:125), con hojas filiformes de
 * 10 a 30 cm que se secan color paja y quedan tiradas entre las matas. Las
 * costras biológicas oscurecen la arena en manchones.
 *
 * Las hojas del coirón miden alrededor de 1 mm de ancho, un cuarto de texel: se
 * dibujan de un texel, que es lo mínimo que llega a resolverse. Es la única
 * medida exagerada del horno, y se dice.
 */
function estepa(rnd, semilla) {
  const L = new Lienzo();
  const ARENA = [col(112, 101, 86), col(146, 134, 114)];
  L.fondo((x, y) => {
    const g = fbmP(semilla + 1, x, y, 5, 3);
    const costra = suave(0.62, 0.74, fbmP(semilla + 4, x, y, 6, 2));
    const f = hash2D(semilla + 2, x, y);
    // Granos de arena de colores distintos: el basalto oscuro y la pómez clara
    const k = (f < 0.2 ? 0.72 : f > 0.86 ? 1.22 : 0.94 + 0.12 * f) * (1 - 0.22 * costra);
    const c = mezclar(ARENA[0], ARENA[1], g);
    M.h = (g - 0.5) * 1.4 + (f - 0.5) * 0.35 - costra * 0.2;
    M.r = c[0] * k; M.g = c[1] * k; M.b = c[2] * k; M.ru = 0.96 - 0.02 * costra;
  });
  const dens = (x, y) => 0.25 + 0.75 * suave(0.3, 0.7, fbmP(semilla + 3, x, y, 4, 2));
  const GRAVA = [col(80, 77, 74), col(118, 106, 100), col(132, 88, 68), col(172, 162, 146), col(58, 57, 60), col(104, 98, 90)];
  let area = 0;
  while (area < 0.2 * LADO * LADO) {
    const [x, y] = sembrar(rnd, dens);
    const dMM = potencia(rnd, 4, 30, 2.2);
    const r = dMM / 2 / MM;
    area += Math.PI * r * r * 0.85;
    const c = escalar(elegir(rnd, GRAVA), 0.88 + rnd() * 0.24);
    const s = semilla + 11 + (area | 0);
    // El pavimento del desierto son piedras achatadas y trabadas, que el viento
    // dejó con la cara plana hacia arriba: tope plano, no bolita.
    L.estampar(x, y, r + 1, guijarro({
      radio: r, radios: radiosAzar(rnd, 5 + Math.floor(rnd() * 4), 0.62), ang: rnd() * 6.3, anguloso: rnd() < 0.6,
      hBase: 0.2, hMax: dMM * 0.26, redondez: 0.25, color: c, rug: 0.84,
      grano: (gx, gy, cc) => { const k = 0.9 + 0.2 * hash2D(s, gx, gy); return [cc[0] * k, cc[1] * k, cc[2] * k]; },
    }));
  }
  // Las pajas: en grupos que el viento acostó parejos, y algunas sueltas
  const PAJA = [col(184, 166, 120), col(168, 150, 108), col(152, 140, 112), col(142, 136, 122)];
  const densPaja = (x, y) => 0.15 + 0.85 * suave(0.35, 0.7, fbmP(semilla + 6, x, y, 4, 2));
  for (let g = 0; g < 70; g++) {
    const [gx, gy] = sembrar(rnd, densPaja);
    const rumbo = rnd() * Math.PI * 2;
    const n = 6 + Math.floor(rnd() * 12);
    for (let i = 0; i < n; i++) {
      const x = gx + (rnd() - 0.5) * cmATx(12), y = gy + (rnd() - 0.5) * cmATx(12);
      const largo = cmATx(8 + rnd() * 20), a = rumbo + (rnd() - 0.5) * 0.7;
      const ex = Math.cos(a) * largo / 2, ey = Math.sin(a) * largo / 2, curva = (rnd() - 0.5) * 0.25 * largo;
      L.estampar(x, y, largo / 2 + Math.abs(curva) + 2, ramita({
        p0: [-ex, -ey], p1: [-Math.sin(a) * curva, Math.cos(a) * curva], p2: [ex, ey],
        r0: 0.5, r1: 0.32, hBase: 0.8 + rnd() * 2.5, semilla: semilla + 300 + g * 31 + i,
        color: escalar(elegir(rnd, PAJA), 0.9 + rnd() * 0.2),
      }));
    }
  }
  for (let i = 0; i < 260; i++) {
    const x = rnd() * LADO, y = rnd() * LADO;
    const largo = cmATx(6 + rnd() * 18), a = rnd() * 6.3;
    const ex = Math.cos(a) * largo / 2, ey = Math.sin(a) * largo / 2, curva = (rnd() - 0.5) * 0.3 * largo;
    L.estampar(x, y, largo / 2 + Math.abs(curva) + 2, ramita({
      p0: [-ex, -ey], p1: [-Math.sin(a) * curva, Math.cos(a) * curva], p2: [ex, ey],
      r0: 0.45, r1: 0.3, hBase: 0.6 + rnd() * 2, semilla: semilla + 5000 + i,
      color: escalar(elegir(rnd, PAJA), 0.85 + rnd() * 0.2),
    }));
  }
  return { L, oclusion: { a2: 0.07, a8: 0.03, piso: 0.45 } };
}

/**
 * 4 · Acarreo granítico de altura.
 *
 * Sobre la línea de bosque (unos 1600 m) el batolito asoma en granodiorita y la
 * gelifracción lo parte en bloques angulosos: el pedregal de los cerros
 * Catedral y López. De 1 a 25 cm, de caras planas y aristas vivas, sobre un
 * relleno de maicillo (arena gruesa de granito meteorizado). La roca es gris
 * clara moteada: plagioclasa y cuarzo claros, biotita y hornblenda negras de
 * pocos milímetros, algo de feldespato potásico rosado, y manchas de óxido en
 * las caras viejas. Encima, los líquenes costrosos de la alta montaña: grises
 * en su mayoría y algún Rhizocarpon geographicum amarillo verdoso, el que se usa
 * para fechar morenas.
 *
 * Es también la capa que viste la piedra suelta del sotobosque.
 */
function acarreo(rnd, semilla) {
  const L = new Lienzo();
  // El maicillo es granito ya desarmado: más pardo y más oscuro que la cara de
  // un bloque, y con los granos sueltos. Si los dos llevan el mismo moteado el
  // bloque sólo se distingue por la sombra, que era lo que pasaba.
  const MAICILLO = [col(112, 104, 92), col(140, 131, 116)];
  const minerales = (s, oscuro, claro) => (gx, gy, c) => {
    const h = hash2D(s, gx, gy);
    const h2 = hash2D(s + 1, gx >> 1, gy >> 1);   // algunos granos de dos texels
    if (h < oscuro || h2 < oscuro * 0.2) return mezclar(c, col(48, 48, 51), 0.8);
    if (h > 1 - claro) return escalar(c, 1.2);
    if (h > 1 - claro - 0.03) return mezclar(c, col(200, 168, 150), 0.5);
    const k = 0.93 + 0.12 * hash2D(s + 2, gx, gy);
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  const granoFondo = minerales(semilla + 9, 0.08, 0.1);
  L.fondo((x, y) => {
    const g = fbmP(semilla + 1, x, y, 6, 3);
    const c = granoFondo(x, y, mezclar(MAICILLO[0], MAICILLO[1], g));
    M.h = (g - 0.5) * 2.0 + (hash2D(semilla + 2, x, y) - 0.5) * 0.6; M.r = c[0]; M.g = c[1]; M.b = c[2]; M.ru = 0.93;
  });
  const GRANITO = [col(150, 148, 142), col(136, 134, 130), col(164, 161, 154), col(124, 122, 119)];
  const OXIDO = col(142, 118, 96);
  const LIQUEN = [col(166, 166, 158), col(150, 152, 146), col(178, 176, 166)];
  // Apagados a propósito: la misma capa viste la piedra del sotobosque, y la
  // piedra tiene que dejar de verse verdosa.
  const RHIZO = col(142, 146, 96), XANTHO = col(176, 128, 76);
  const dens = (x, y) => 0.35 + 0.65 * suave(0.3, 0.7, fbmP(semilla + 3, x, y, 3, 2));
  // Primero los grandes, apoyados más abajo; los chicos rellenan encima de lo
  // que quedó libre y se acomodan entre los grandes.
  // Un talud de acarreo es más bloque que relleno: se siembra área de sobra
  // (1,6 veces el mosaico) porque los chicos caen muchas veces encima de los
  // grandes y no suman superficie nueva.
  const clastos = [];
  let area = 0;
  while (area < 1.6 * LADO * LADO) {
    const dCm = potencia(rnd, 1, 25, 1.9);
    const r = cmATx(dCm) / 2;
    area += Math.PI * r * r * 0.7;
    clastos.push(dCm);
  }
  clastos.sort((a, b) => b - a);
  clastos.forEach((dCm, i) => {
    const [x, y] = sembrar(rnd, dens);
    const r = cmATx(dCm) / 2;
    const n = 4 + Math.floor(rnd() * 4);
    const a0 = rnd() * 6.3;
    const vertices = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k + (rnd() - 0.5) * 0.6) * (2 * Math.PI / n);
      const rr = r * (0.62 + 0.38 * rnd());
      vertices.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const color = mezclar(escalar(elegir(rnd, GRANITO), 0.86 + rnd() * 0.24), OXIDO, rnd() < 0.3 ? rnd() * 0.45 : 0);
    const grietas = [];
    if (r > 10 && rnd() < 0.55) {
      const ga = rnd() * Math.PI;
      grietas.push([Math.cos(ga), Math.sin(ga), (rnd() - 0.5) * r * 0.8, 0.5]);
    }
    const liquenes = [];
    if (r > 8) {
      const nl = Math.floor(rnd() * 3);
      for (let k = 0; k < nl; k++) {
        const u = rnd();
        liquenes.push([(rnd() - 0.5) * r, (rnd() - 0.5) * r, 1 + rnd() * Math.min(4, r * 0.25),
          u < 0.06 ? RHIZO : u < 0.09 ? XANTHO : elegir(rnd, LIQUEN)]);
      }
    }
    L.estampar(x, y, r + 1.5, bloque({
      vertices, bisel: Math.max(0.8, r * 0.16), hBase: 0.5 + 8 * (i / clastos.length),
      hMax: dCm * 10 * 0.32, incl: [(rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.35],
      color, grano: minerales(semilla + 20 + i, 0.05, 0.12), grietas, liquenes, rug: 0.84, semilla: semilla + 40 + i,
    }));
  });
  return { L, oclusion: { a2: 0.035, a8: 0.014, piso: 0.35 } };
}

// ═══════════════════════════════════════════════════════════════════════════
// DE LA ALTURA A LA NORMAL Y LA OCLUSIÓN
// ═══════════════════════════════════════════════════════════════════════════

/** Promedio en caja de lado 2r+1, sobre el toro, separable. */
function desenfocar(src, r) {
  const tmp = new Float32Array(LADO * LADO), out = new Float32Array(LADO * LADO);
  const n = 2 * r + 1;
  for (let y = 0; y < LADO; y++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[y * LADO + mod(k, LADO)];
    for (let x = 0; x < LADO; x++) {
      tmp[y * LADO + x] = s / n;
      s += src[y * LADO + mod(x + r + 1, LADO)] - src[y * LADO + mod(x - r, LADO)];
    }
  }
  for (let x = 0; x < LADO; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[mod(k, LADO) * LADO + x];
    for (let y = 0; y < LADO; y++) {
      out[y * LADO + x] = s / n;
      s += tmp[mod(y + r + 1, LADO) * LADO + x] - tmp[mod(y - r, LADO) * LADO + x];
    }
  }
  return out;
}

function terminar(capa, { L, oclusion }) {
  const N2 = LADO * LADO;
  const H = L.H;
  // Oclusión: lo que está por debajo del promedio de su vecindario ve menos
  // cielo. Dos radios, 2 y 8 texels (8 y 31 mm): la rendija entre dos hojas y el
  // hueco entre dos piedras.
  const b2 = desenfocar(H, 2), b8 = desenfocar(H, 8);
  const ao = new Float32Array(N2);
  for (let k = 0; k < N2; k++) {
    ao[k] = Math.max(oclusion.piso, Math.min(1, 1 - Math.max(0, b2[k] - H[k]) * oclusion.a2 - Math.max(0, b8[k] - H[k]) * oclusion.a8));
  }
  // Normal: Sobel sobre la altura en mm, dividida por el paso en mm. Es la
  // pendiente real, sin factor de exageración: una piedrita de 1 cm tiene
  // cantos de 45° y así se ve con luz rasante.
  const Hs = desenfocar(H, 0);
  const nrm = new Float32Array(N2 * 2);
  const h = (x, y) => Hs[mod(y, LADO) * LADO + mod(x, LADO)];
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const gx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1)) / (8 * MM);
      const gy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1)) / (8 * MM);
      const l = Math.hypot(gx, gy, 1);
      nrm[(y * LADO + x) * 2] = -gx / l;
      nrm[(y * LADO + x) * 2 + 1] = -gy / l;
    }
  }
  // La altura al canal A, entre los percentiles 1 y 99 de la capa: es la que
  // decide qué lectura asoma sobre la otra cuando el terreno mezcla dos.
  const orden = Float32Array.from(H).sort();
  const hMin = orden[Math.floor(N2 * 0.01)], hMax = orden[Math.floor(N2 * 0.99)];

  const pngA = new PNG({ width: LADO, height: LADO, colorType: 6 });
  const pngN = new PNG({ width: LADO, height: LADO, colorType: 6 });
  for (let k = 0; k < N2; k++) {
    const o = k * 4;
    pngA.data[o] = aSRGB8(L.C[k * 3]);
    pngA.data[o + 1] = aSRGB8(L.C[k * 3 + 1]);
    pngA.data[o + 2] = aSRGB8(L.C[k * 3 + 2]);
    pngA.data[o + 3] = clampByte(255 * clamp01((H[k] - hMin) / (hMax - hMin)));
    pngN.data[o] = clampByte(127.5 + 127.5 * nrm[k * 2]);
    pngN.data[o + 1] = clampByte(127.5 + 127.5 * nrm[k * 2 + 1]);
    pngN.data[o + 2] = clampByte(255 * ao[k]);
    pngN.data[o + 3] = clampByte(255 * clamp01(L.R[k]));
  }
  return { pngA, pngN, ...estadisticas(pngA.data, pngN.data, capa) };
}

/**
 * Lo que el terreno necesita saber de cada capa, medido sobre los bytes que se
 * escriben y no sobre los flotantes de antes de redondear.
 *
 * `normaModulo` es por qué dividir para que la capa module sin aclarar ni
 * oscurecer: el terreno multiplica su color calibrado por albedo × oclusión de
 * la textura, y esto lo lleva a media 1. No es la media a secas porque el
 * terreno funde dos lecturas por altura (la que está más arriba asoma), y eso
 * favorece a lo alto: la piedrita de pómez gana más seguido que el suelo que la
 * rodea. Se estima con la misma regla del shader sobre pares de texels al azar
 * y una máscara pareja entre 0 y 1. Sin esa corrección, de cerca, el andisol
 * salía de 4 a 6 % más claro que su color calibrado (según el canal), la
 * hojarasca un 3 %, el acarreo un 2 % y la estepa nada.
 */
function estadisticas(A, Nn, capa) {
  const N2 = LADO * LADO;
  let ml = 0, sr = 0, sg = 0, sb = 0, so = 0, sh = 0;
  for (let k = 0; k < N2; k++) {
    const o = k * 4;
    const r = lineal(A[o]), g = lineal(A[o + 1]), b = lineal(A[o + 2]);
    ml += (r + g + b) / 3;
    sr += r; sg += g; sb += b;
    so += Nn[o + 2] / 255; sh += A[o + 3] / 255;
  }
  const rnd = mulberry32(hashCadena(capa + ':norma'));
  const m = [0, 0, 0];
  const PARES = 200000;
  for (let i = 0; i < PARES; i++) {
    const k1 = Math.floor(rnd() * N2) * 4, k2 = Math.floor(rnd() * N2) * 4;
    const mascara = rnd();
    const w = clamp01((mascara - 0.5) * PESO_MASCARA + (A[k2 + 3] - A[k1 + 3]) / 255 * PESO_ALTURA + 0.5);
    for (let c = 0; c < 3; c++) {
      const x1 = lineal(A[k1 + c]) * Nn[k1 + 2] / 255, x2 = lineal(A[k2 + c]) * Nn[k2 + 2] / 255;
      m[c] += x1 + (x2 - x1) * w;
    }
  }
  // `pesoLuz`: con qué pesa cada canal del módulo en su luminancia. El terreno
  // modula con el color de la textura pero lo lleva casi todo a su luminancia,
  // porque dividir canal por canal un suelo pardo amplifica el azul —que en la
  // hojarasca media 0,026— treinta y ocho veces, y una hoja de colihue color paja
  // salía celeste sobre el verde del bosque. Con estos pesos, la luminancia del
  // módulo es un producto punto y su media sigue siendo 1.
  const media = m.map((v) => v / PARES);
  const Y = [0.2126, 0.7152, 0.0722];
  const suma = Y[0] * media[0] + Y[1] * media[1] + Y[2] * media[2];
  return {
    albedoMedio: ml / N2,
    albedoMedioRGB: [sr / N2, sg / N2, sb / N2],
    oclusionMedia: so / N2,
    alturaMedia: sh / N2,
    normaModulo: media.map((v) => 1 / v),
    pesoLuz: media.map((v, c) => (Y[c] * v) / suma),
  };
}

/**
 * La regla con que el terreno funde las dos lecturas de una capa, y dos capas
 * entre sí: manda la máscara, y la altura corre el borde para que siga el
 * contorno de las piedras y las hojas en vez de cruzarlas en un fundido. Tiene
 * que ser la misma que la de `Terreno.js` (`fundirPorAltura`).
 */
const PESO_MASCARA = 5.0;
const PESO_ALTURA = 0.6;

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDA
// ═══════════════════════════════════════════════════════════════════════════

const CAPAS = [
  {
    id: 'hojarasca', nombre: 'Hojarasca del bosque húmedo (coihue y lenga)', fn: hojarasca,
    referencia: 'Mantillo del coihual y el lengal húmedo del oeste del Parque (Puerto Blest, Llao Llao). '
      + 'Hojas de Nothofagus dombeyi de 2 a 3,5 cm, aovado-lanceoladas y aserradas, pardo amarillentas al caer; '
      + 'de N. pumilio de 2 a 3,5 cm, elípticas y doblemente crenadas, pardo rojizas; algo de N. antarctica (1,5 a 3 cm) '
      + 'y de caña colihue (Chusquea culeou, 5 a 10 cm). Medidas de Donoso Zegers, C. (2006), Las especies arbóreas de los '
      + 'bosques templados de Chile y Argentina. Ramitas de 2 a 6 mm sobre humus pardo muy oscuro.',
  },
  {
    id: 'andisol', nombre: 'Andisol pardo con lapilli de pómez', fn: andisol,
    referencia: 'Andisol sobre ceniza volcánica, horizonte A pardo muy oscuro (Munsell 10YR 2/2 a 3/3) de estructura migajosa, '
      + 'con lapilli de pómez riolítica blanca a gris clara del Puyehue-Cordón Caulle: la erupción de 2011 dejó en Villa '
      + 'La Angostura clastos de 1 a 3 cm (Pistolesi et al. 2015, Bulletin of Volcanology 77:3). Lapilli: de 2 a 64 mm, '
      + 'angulosos a subredondeados y vesiculares; 12 % de la superficie. Hojas sueltas de ñire.',
  },
  {
    id: 'estepa', nombre: 'Estepa: arena volcánica con coirón seco y gravilla', fn: estepa,
    referencia: 'Estepa graminosa del este del Parque (Pampa de Huenuleo, Dina Huapi): arena volcánica gris parda con '
      + 'pavimento de gravilla de 4 a 30 mm (basalto, andesita, escoria, toba) y hojas secas de coirón (Festuca pallescens, '
      + 'Pappostipa speciosa; León et al. 1998, Ecología Austral 8:125-144), filiformes, de 10 a 30 cm y color paja. '
      + 'Las pajas se dibujan de un texel (3,9 mm) aunque midan cerca de 1 mm: es lo mínimo que se resuelve.',
  },
  {
    id: 'acarreo', nombre: 'Acarreo granítico de altura', fn: acarreo,
    referencia: 'Pedregal sobre la línea de bosque en la granodiorita del Batolito Patagónico (cerros Catedral y López): '
      + 'bloques angulosos de gelifracción de 1 a 25 cm sobre maicillo, roca gris clara moteada de plagioclasa y cuarzo con '
      + 'biotita y hornblenda negras, óxido en las caras viejas y líquenes costrosos grises con algún Rhizocarpon '
      + 'geographicum. Es también la capa que viste la piedra suelta del sotobosque.',
  },
];

fs.mkdirSync(SALIDA, { recursive: true });
const manifiesto = {
  generador: 'tools/hornear-suelo.mjs',
  lado: LADO,
  periodoM: PERIODO_M,
  mmPorTexel: +MM.toFixed(4),
  canales: {
    albedo: 'RGB = albedo en sRGB; A = altura normalizada entre los percentiles 1 y 99 de la capa',
    normal: 'R, G = normal en el plano (x por columnas = +X del mundo, y por filas = +Z), la z se reconstruye; B = oclusión; A = rugosidad',
  },
  mezcla: { pesoMascara: PESO_MASCARA, pesoAltura: PESO_ALTURA },
  capas: [],
};
for (const def of CAPAS) {
  const rnd = mulberry32(hashCadena(def.id));
  const r = terminar(def.id, def.fn(rnd, hashCadena(def.id + ':texel')));
  const archivos = { albedo: `${def.id}_albedo.png`, normal: `${def.id}_normal.png` };
  fs.writeFileSync(path.join(SALIDA, archivos.albedo), PNG.sync.write(r.pngA, { colorType: 6 }));
  fs.writeFileSync(path.join(SALIDA, archivos.normal), PNG.sync.write(r.pngN, { colorType: 6 }));
  const redondo = (v) => +v.toFixed(4);
  manifiesto.capas.push({
    id: def.id, nombre: def.nombre, referencia: def.referencia,
    periodoM: PERIODO_M,
    albedoMedio: redondo(r.albedoMedio),
    albedoMedioRGB: r.albedoMedioRGB.map(redondo),
    oclusionMedia: redondo(r.oclusionMedia),
    alturaMedia: redondo(r.alturaMedia),
    normaModulo: r.normaModulo.map(redondo),
    pesoLuz: r.pesoLuz.map(redondo),
    archivos,
  });
  console.log(`  ${def.id.padEnd(10)} albedo medio ${r.albedoMedio.toFixed(4)} · oclusión ${r.oclusionMedia.toFixed(3)} · norma ${r.normaModulo.map((v) => v.toFixed(2)).join(' ')}`);
}
fs.writeFileSync(path.join(SALIDA, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2) + '\n');
console.log(`  ${manifiesto.capas.length} capas de ${LADO}² en ${path.relative(process.cwd(), SALIDA) || SALIDA}`);
