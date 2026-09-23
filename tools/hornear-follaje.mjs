/**
 * SurviBar — Horno del follaje, offline, en Node.
 *
 * Pinta cuatro atlas de follaje —la hoja chica de los Nothofagus, la hoja ancha
 * del maitén y compañía, las ramillas de escamas del ciprés de la cordillera y
 * las acículas de a dos del pino murrayana— y los escribe a
 * `public/tex/follaje/` con un `manifiesto.json`. El juego nunca corre esto:
 * `Vegetacion.js` carga los PNG por `fetch` y, si faltan, sigue con el atlas
 * procedural de siempre.
 *
 * ── Por qué horneado ─────────────────────────────────────────────────────
 * Es la regla de la ronda 3 (`RONDA3.md`, «Por qué por textura y no por
 * shader»): la GT 630M del dueño pierde 8× en matemática de shader y gana 2,3×
 * en lecturas de textura. Y el atlas de hoy se dibuja en un lienzo del
 * navegador con `Math.random`, en cada carga, a mano alzada: no se puede medir
 * de antemano, no repite, y en Node no existe.
 *
 * ── Qué estaba mal, medido (RONDA8.md, fase 4) ───────────────────────────
 * 1. **La escala.** El atlas de hoy se estira a unos 25 px por metro y la hoja
 *    mide de 6 a 21 px: hojas de 24 a 84 cm contra los 2 a 3,5 del coihue. Acá
 *    cada clase declara `pxPorMetro` —a qué escala se la estira sobre la
 *    tarjeta— y la hoja se dibuja de su largo real a esa escala. `Vegetacion.js`
 *    dimensiona las tarjetas con ese mismo número.
 * 2. **La aguja.** El 8 % de la ventana: ramitas de 2 px sueltas, que en el
 *    juego eran esqueletos de palitos con el cielo atravesándolos. Y el ciprés
 *    de la cordillera no tiene agujas: tiene ramillas aplanadas de escamas.
 * 3. **Los mipmaps.** La cobertura de la lámina subía un 44 % de 512 a 32 px:
 *    las matas eran ralas por dentro, y al promediar se llenaban. Una copa que
 *    se espesa de lejos cambia de aspecto igual que una que se ralea.
 *
 * ── Cómo se pinta ────────────────────────────────────────────────────────
 * El follaje de cada clase se agrupa en **matas** —el extremo de una rama con
 * sus ramitas— separadas por huecos de verdad. Dentro de la mata, las ramitas
 * se superponen hasta que el corazón queda macizo (≥ 85 % del disco), porque
 * eso es lo que hace que la cobertura no cambie al promediar: un bloque de
 * mipmap que cae adentro de una mata sigue pasando el corte de 0,28, uno que
 * cae en un hueco sigue sin pasarlo. Los huecos entre matas son los que se ven.
 * Se pinta en tres pasadas por mata —la sombra del interior, la masa, la punta
 * al sol— con el mismo reparto que tenía el atlas de hoy, y al final se lleva
 * el color medio al del atlas de hoy (ver `normalizar`): el bosque no cambia de
 * brillo por cambiar de dibujo.
 *
 * Cada forma se muestrea 4×4 veces por texel y se compone «encima» con alfa
 * premultiplicado, como un lienzo del navegador. El color de los texels
 * transparentes se rellena con el de las hojas vecinas (`dilatar`): los mipmaps
 * promedian el color de lo transparente, y sin esto cada hoja lejana tiene un
 * halo negro.
 *
 * ── La franja de corteza ─────────────────────────────────────────────────
 * Cada atlas lleva a la derecha, desde u = 0,875, la franja de corteza del
 * tronco (el árbol entero es un solo material: una llamada de dibujo). Es la
 * misma cuenta de `dibujarCorteza` en `Vegetacion.js`, portada tal cual: con
 * las mismas semillas, a 512 da los mismos bytes que el lienzo del juego. El
 * manifiesto declara su ventana y su media lineal, que `Vegetacion.js` usa para
 * compensar el brillo del tronco.
 *
 * ── Los archivos ─────────────────────────────────────────────────────────
 *   <clase>.png   RGBA 8 bits, sRGB. Fila 0 = v 0: el juego lo sube como
 *                 `DataTexture` sin dar vuelta. «Arriba» en el mundo es +v:
 *                 las puntas de las ramas crecen hacia las filas altas.
 *   manifiesto.json
 *
 * ── Determinismo ─────────────────────────────────────────────────────────
 * Nunca `Math.random()` ni `Date`. El azar sale de mulberry32 sembrado con
 * FNV-1a del id de la clase. Misma entrada, mismos bytes: el banco lo corre dos
 * veces y compara.
 *
 * Uso: node tools/hornear-follaje.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(__dirname, '..', 'public', 'tex', 'follaje');

/** Tope de la ventana de las tarjetas: más allá está la corteza. Ver `Vegetacion.js`. */
const U_MAX = 0.86;
const CORTEZA_X0 = 0.875;
const CORTEZA_GUARDA = 8 / 512;

/**
 * Color medio lineal del follaje de hoy, medido sobre los dos atlas del juego
 * (`capturas/r8-atlas-alfa-*.png`, texels que pasan el corte en la ventana):
 * lámina (0,290 · 0,561 · 0,257), aguja (0,274 · 0,573 · 0,258). Se lleva cada
 * atlas nuevo a esta luminancia: el tinte de la especie viaja en el color por
 * vértice y multiplica a éste, así que un atlas más oscuro oscurecería el
 * bosque entero sin que nadie lo decidiera.
 */
const LUMINANCIA_OBJETIVO = 0.2126 * 0.282 + 0.7152 * 0.567 + 0.0722 * 0.258;

// ── Las clases ─────────────────────────────────────────────────────────────
//
// `pxPorMetro` sale de dos topes que tiran para lados opuestos:
//   · la hoja tiene que medir en el mundo menos de 3 veces la real
//     (hojaPx / pxPorMetro), así que más px por metro es mejor;
//   · la tarjeta más grande que se puede armar mide uMax·lado/pxPorMetro
//     metros, y el coihue pide tarjetas de hasta 8 m.
// Y el lado: con la cámara de 62° a 614 px de alto la pantalla muestra
// 511/d píxeles por metro a d metros, así que el nivel 0 de un atlas a
// 150 px/m sólo se lee a menos de 3,4 m y a 18 m se lee el nivel 2 o 3. Por eso
// las coníferas, que se miran de lejos, van a 512, y las latifoliadas —que
// incluyen los arbustos, a uno o dos metros del jugador— a 1024.

const CLASES = [
  {
    id: 'nothofagus',
    lado: 1024,
    pxPorMetro: 100,
    hojaCm: [2, 3.5],
    hojaPxRango: [4, 6],
    referencia:
      'Hoja de los Nothofagus del parque. Coihue (N. dombeyi): 2-3,5 cm × 1-1,5, lanceolada, algo romboidal, ' +
      'coriácea, borde finamente aserrado. Lenga (N. pumilio): 2-4 cm × 1,4-3, ovado-elíptica, crenado-dentada. ' +
      'Ñire (N. antarctica): 1-3,5 cm, ovada, borde lobulado y ondulado. Fuente: SIB, Sistema de Información de ' +
      'Biodiversidad de la Administración de Parques Nacionales (sib.gob.ar/especies/nothofagus-dombeyi, ' +
      '/nothofagus-pumilio, /nothofagus-antarctica). Se toma el rango del coihue, [2, 3,5] cm. Dibujada de 4 a 6 px ' +
      'a 100 px/m (4 a 6 cm): el doble de la real a lo sumo, para que de cerca se lea como hoja y no como grano.',
    matas: { radioM: [0.55, 1.0], fraccion: 0.36, alargue: 1.6, rumbo: (rnd) => (rnd() < 0.5 ? 0 : Math.PI) + entre(rnd, -0.35, 0.35) },
    dibujar: dibujarLatifoliada,
    forma: { anchoRel: [0.45, 0.62], anchoMax: 0.40, ramillaM: [0.18, 0.34], paso: 0.40, angulo: [0.55, 1.0], densidad: 6.0 },
    colores: 'nothofagus',
  },
  {
    id: 'ancha',
    lado: 1024,
    pxPorMetro: 100,
    hojaCm: [2, 6],
    hojaPxRango: [4.5, 7],
    referencia:
      'Hoja elíptica de las latifoliadas que no son Nothofagus. Maitén (Maytenus boaria): 2-6 cm × 0,5-2, ' +
      'lanceolado-elíptica, aserrada. Laura (Schinus patagonicus): 2,5-5 cm, ovada, coriácea. Fuente: SIB ' +
      '(sib.gob.ar/especies/maytenus-boaria, /schinus-patagonicus). Se toma el rango del maitén, [2, 6] cm, ' +
      'dibujada de 4,5 a 7 px a 100 px/m. El canelo (Drimys winteri, 5-15 cm × 1,5-6 según el SIB, ' +
      'sib.gob.ar/especies/drimys-winteri) comparte el atlas y queda con la hoja más chica que la real: licencia ' +
      'declarada, porque un atlas por especie cuesta memoria de video que no hay.',
    matas: { radioM: [0.5, 0.9], fraccion: 0.36, alargue: 1.2, rumbo: (rnd) => rnd() * Math.PI * 2 },
    dibujar: dibujarLatifoliada,
    forma: { anchoRel: [0.30, 0.46], anchoMax: 0.45, ramillaM: [0.16, 0.32], paso: 0.42, angulo: [0.6, 1.05], densidad: 7.0 },
    colores: 'ancha',
  },
  {
    id: 'escama',
    lado: 512,
    pxPorMetro: 150,
    hojaCm: [0.2, 0.5],
    hojaPxRango: [1, 1],
    referencia:
      'Ciprés de la cordillera (Austrocedrus chilensis): hojas opuestas, escamiformes, imbricadas, de dos tipos; ' +
      'las laterales con el dorso aquillado y dos bandas estomáticas blanquecinas, de 2-5 mm; las faciales ' +
      'triangulares, de 0,5-2 mm. Ramillas aplanadas, en un plano. Copa piramidal, compacta. Fuente: SIB ' +
      '(sib.gob.ar/especies/austrocedrus-chilensis). Se toma la escama lateral, [0,2, 0,5] cm. A 150 px/m una ' +
      'escama mide un texel: el atlas dibuja la ramilla aplanada de su tamaño (abanicos de 10 a 20 cm, ramitas de ' +
      'un texel de ancho) y la escama como el grano claro-oscuro de un texel a lo largo de cada ramita, con ' +
      'algunas ramillas vueltas que muestran las bandas blanquecinas. El alerce (Fitzroya cupressoides) comparte ' +
      'la clase por tener también hojas escamiformes; sin cifra propia.',
    matas: { radioM: [0.28, 0.48], fraccion: 0.40, alargue: 1.4, rumbo: (rnd) => (rnd() < 0.5 ? 0 : Math.PI) + (rnd() < 0.5 ? 1 : -1) * entre(rnd, 0, 0.5) },
    dibujar: dibujarEscamas,
    forma: { abanicoM: [0.09, 0.19], densidad: 4.6 },
    colores: 'escama',
  },
  {
    id: 'aguja',
    lado: 512,
    pxPorMetro: 150,
    hojaCm: [5, 8],
    hojaPxRango: [7.5, 12],
    referencia:
      'Pino murrayana (Pinus contorta subsp. murrayana): acículas de a dos por fascículo, de 5-8 cm × 1-2 mm, ' +
      'amarillo verdosas, ápice agudo; ramas extendidas y ascendentes en la punta; copa cónica. Fuente: The ' +
      'Gymnosperm Database, Earle (conifers.org/pi/Pinus_contorta_murrayana.php), que sigue a Flora of North ' +
      'America; para la especie, «2 (raramente 3) por fascículo, 2-8 cm × 0,7-2 mm, persisten 3-8 años» ' +
      '(conifers.org/pi/Pinus_contorta.php). Dibujadas de 7,5 a 12 px a 150 px/m, o sea de su largo. El ancho ' +
      'no: 0,8 px son 5 mm, tres veces el real, porque una acícula de un tercio de texel el mipmap la borra. El ' +
      'pino ponderosa y el oregón comparten el atlas: licencia.',
    matas: { radioM: [0.28, 0.48], fraccion: 0.38, alargue: 1.5, rumbo: (rnd) => { const lado = rnd() < 0.5 ? 1 : -1; const sube = entre(rnd, 0.05, 0.7); return lado > 0 ? sube : Math.PI - sube; } },
    dibujar: dibujarAciculas,
    forma: { brotePx: [26, 48], densidad: 5.5 },
    colores: 'aguja',
  },
];

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
const entre = (rnd, a, b) => a + rnd() * (b - a);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function lineal(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function aSRGB(l) { const v = clamp01(l); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }

// ── El lienzo ──────────────────────────────────────────────────────────────
// 4×4 muestras por texel: una acícula de 0,8 px en diagonal necesita más de
// cuatro para que su cobertura no salga en escalones de 25 %.
const SS = 4;
const SUB = [];
for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) SUB.push([(i + 0.5) / SS, (j + 0.5) / SS]);

class Lienzo {
  constructor(n) {
    this.n = n;
    this.C = new Float32Array(n * n * 3);   // color sRGB 0..1, premultiplicado
    this.A = new Float32Array(n * n);
  }

  /** Compone «encima» una forma dada por su recuadro y su prueba de adentro. */
  componer(x0, y0, x1, y1, dentro, r, g, b, opacidad = 1) {
    const n = this.n;
    const xa = Math.max(0, Math.floor(x0)), xb = Math.min(n - 1, Math.ceil(x1));
    const ya = Math.max(0, Math.floor(y0)), yb = Math.min(n - 1, Math.ceil(y1));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        let c = 0;
        for (let s = 0; s < SUB.length; s++) if (dentro(x + SUB[s][0], y + SUB[s][1])) c++;
        if (!c) continue;
        const a = (c / SUB.length) * opacidad;
        const k = y * n + x;
        this.C[k * 3] = this.C[k * 3] * (1 - a) + r * a;
        this.C[k * 3 + 1] = this.C[k * 3 + 1] * (1 - a) + g * a;
        this.C[k * 3 + 2] = this.C[k * 3 + 2] * (1 - a) + b * a;
        this.A[k] = this.A[k] * (1 - a) + a;
      }
    }
  }

  /** Trazo de ancho `w` (una cápsula): ramitas, raquis, acículas. */
  trazo(xa, ya, xb, yb, w, col) {
    const dx = xb - xa, dy = yb - ya, l2 = dx * dx + dy * dy || 1e-9, r2 = (w / 2) * (w / 2);
    const m = w / 2 + 0.5;
    this.componer(Math.min(xa, xb) - m, Math.min(ya, yb) - m, Math.max(xa, xb) + m, Math.max(ya, yb) + m, (px, py) => {
      let t = ((px - xa) * dx + (py - ya) * dy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = xa + dx * t - px, qy = ya + dy * t - py;
      return qx * qx + qy * qy <= r2;
    }, col[0], col[1], col[2]);
  }

  /**
   * Una hoja con la base en (bx, by), apuntando a `ang`, de `largo` px. El medio
   * ancho a lo largo del nervio es `sin(π·s^p)`, con el máximo en `anchoMax`: la
   * lanceolada del coihue lo tiene cerca de la base, la elíptica del maitén al
   * medio. Ápice agudo por construcción: el seno cae a cero en s = 1.
   */
  hoja(bx, by, ang, largo, ancho, anchoMax, col) {
    const c = Math.cos(ang), s = Math.sin(ang), p = Math.log(0.5) / Math.log(anchoMax), hw = ancho / 2;
    const ex = bx + c * largo, ey = by + s * largo, m = hw + 0.5;
    this.componer(Math.min(bx, ex) - m, Math.min(by, ey) - m, Math.max(bx, ex) + m, Math.max(by, ey) + m, (px, py) => {
      const dx = px - bx, dy = py - by;
      const u = (dx * c + dy * s) / largo;
      if (u <= 0 || u >= 1) return false;
      const v = -dx * s + dy * c;
      return Math.abs(v) <= hw * Math.sin(Math.PI * Math.pow(u, p));
    }, col[0], col[1], col[2]);
  }
}

// ── Las matas ──────────────────────────────────────────────────────────────

/**
 * La forma de una mata: tres a cinco lóbulos a lo largo de un eje apenas curvo,
 * más gruesos en el medio. Es el extremo de una rama visto de costado —la
 * rama trae la mata, las ramitas la ensanchan, la punta se afina—, y no un
 * disco: una copa hecha de discos parejos se lee como un racimo de pompones.
 */
function formarMata(rnd, R, dir, alargue) {
  const nL = 3 + Math.floor(rnd() * 3);
  const curva = entre(rnd, -0.35, 0.35);
  const lobulos = [];
  for (let i = 0; i < nL; i++) {
    const t = (i / (nL - 1)) * 2 - 1;
    const along = t * R * 0.62 * alargue;
    const perp = (curva * t * t + entre(rnd, -0.12, 0.12)) * R;
    const r = R * entre(rnd, 0.50, 0.68) * (1 - 0.30 * Math.abs(t));
    lobulos.push({ dx: Math.cos(dir) * along - Math.sin(dir) * perp, dy: Math.sin(dir) * along + Math.cos(dir) * perp, r });
  }
  return lobulos;
}

/** Área de la unión de los lóbulos, contada en una grilla de 2 px. */
function areaDeMata(lobulos) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const l of lobulos) { x0 = Math.min(x0, l.dx - l.r); x1 = Math.max(x1, l.dx + l.r); y0 = Math.min(y0, l.dy - l.r); y1 = Math.max(y1, l.dy + l.r); }
  let c = 0;
  for (let y = y0 + 1; y < y1; y += 2) for (let x = x0 + 1; x < x1; x += 2) {
    if (lobulos.some((l) => (x - l.dx) * (x - l.dx) + (y - l.dy) * (y - l.dy) <= l.r * l.r)) c++;
  }
  return c * 4;
}

/**
 * Matas por dardos: al azar, con una distancia mínima entre lóbulos de matas
 * distintas, hasta cubrir `fraccion` de la ventana. La distancia mínima es lo
 * que deja los huecos —el cielo que pasa entre rama y rama— y que las matas no
 * se fundan en una sopa pareja, que es lo que el mipmap llenaba. `rumbo(rnd)`
 * da hacia dónde va el eje de cada mata: casi horizontal en el coihue, que
 * tiene el follaje en pisos, y subiendo en las coníferas.
 */
function sembrarMatas(rnd, clase) {
  const n = clase.lado, P = clase.pxPorMetro;
  const ancho = Math.floor(U_MAX * n);
  const [r0, r1] = clase.matas.radioM.map((m) => m * P);
  const objetivo = clase.matas.fraccion * ancho * n;
  const lista = [];
  let area = 0, intentos = 0;
  while (area < objetivo && intentos < 40000) {
    intentos++;
    const R = r0 + (r1 - r0) * Math.pow(rnd(), 1.4);
    const dir = clase.matas.rumbo(rnd);
    const lobulos = formarMata(rnd, R, dir, clase.matas.alargue);
    const x = rnd() * ancho, y = rnd() * n;
    // La mata entera, con sus puntas, adentro de la ventana y del lienzo.
    if (lobulos.some((l) => x + l.dx - l.r * 1.3 < 3 || x + l.dx + l.r * 1.3 > ancho - 3 || y + l.dy - l.r * 1.3 < 3 || y + l.dy + l.r * 1.3 > n - 3)) continue;
    const choca = lista.some((o) => o.lobulos.some((a) => lobulos.some((b) =>
      Math.hypot(o.x + a.dx - x - b.dx, o.y + a.dy - y - b.dy) < (a.r + b.r) * 1.08)));
    if (choca) continue;
    const radio = Math.max(...lobulos.map((l) => Math.hypot(l.dx, l.dy) + l.r));
    const am = areaDeMata(lobulos);
    lista.push({ x, y, r: radio, dir, lobulos, area: am });
    area += am;
  }
  return lista;
}

/**
 * Dónde va y hacia dónde apunta una ramita de la mata. Uniforme en el área de
 * un lóbulo —elegido por su área—, no amontonada en el medio, porque lo que se
 * busca es un corazón macizo hasta el borde: una mata densa en el centro y rala
 * afuera es justo lo que el mipmap rellena al promediar. La dirección mezcla la
 * del eje de la mata con la de afuera del lóbulo, así que las ramitas del borde
 * apuntan hacia afuera y el contorno queda deshilachado por las puntas.
 */
function colocar(rnd, m, pasada, desvio) {
  let t = rnd() * m.lobulos.reduce((s, l) => s + l.r * l.r, 0);
  let lob = m.lobulos[0];
  for (const l of m.lobulos) { t -= l.r * l.r; if (t <= 0) { lob = l; break; } }
  const rel = Math.sqrt(rnd()) * pasada.alcance;
  let a = rnd() * Math.PI * 2;
  // La punta al sol va arriba (+v): tres de cada cuatro en la mitad de arriba.
  if (pasada.arriba && Math.sin(a) < 0 && rnd() < 0.5) a = -a;
  const x = m.x + lob.dx + Math.cos(a) * rel * lob.r, y = m.y + lob.dy + Math.sin(a) * rel * lob.r;
  const dx = 0.8 * Math.cos(m.dir) + rel * Math.cos(a), dy = 0.8 * Math.sin(m.dir) + rel * Math.sin(a);
  return {
    x, y, lob,
    rel: Math.min(1, Math.hypot(x - m.x, y - m.y) / m.r * 0.5 + rel * 0.5),
    arriba: (y - m.y) / m.r,
    ang: Math.atan2(dy, dx) + entre(rnd, -desvio, desvio),
  };
}

/**
 * Si la punta de la ramita sale más allá de 1,08 radios de todos los lóbulos,
 * se la corre hacia adentro a lo largo de su eje. Las hojas y las acículas
 * siguen asomando por el borde —eso es el deshilachado—, pero el eje no: una
 * ramita entera afuera de la mata es un palito suelto, que de lejos no pasa el
 * corte y de cerca es justamente el esqueleto que había que sacar.
 */
function recoger(m, x0, y0, ang, largo) {
  const ex = x0 + Math.cos(ang) * largo, ey = y0 + Math.sin(ang) * largo;
  let adentro = -Infinity;
  for (const l of m.lobulos) adentro = Math.max(adentro, 1.08 * l.r - Math.hypot(ex - m.x - l.dx, ey - m.y - l.dy));
  if (adentro >= 0) return [x0, y0];
  return [x0 + Math.cos(ang) * adentro, y0 + Math.sin(ang) * adentro];
}

// ── Los colores, por pasada ────────────────────────────────────────────────
// sRGB 0..255 del verde, y el rojo y el azul como fracción del verde. Son los
// mismos repartos del atlas de hoy: la sombra del interior fría, la masa con
// su verde, la punta al sol más cálida.
const PALETAS = {
  nothofagus: [
    { v: [96, 140], r: [0.50, 0.70], b: [0.66, 0.90] },
    { v: [168, 226], r: [0.60, 0.84], b: [0.58, 0.80] },
    { v: [206, 246], r: [0.66, 0.90], b: [0.52, 0.74] },
  ],
  ancha: [
    { v: [104, 150], r: [0.56, 0.76], b: [0.60, 0.84] },
    { v: [176, 232], r: [0.66, 0.88], b: [0.54, 0.76] },
    { v: [210, 248], r: [0.72, 0.94], b: [0.50, 0.70] },
  ],
  // Austrocedrus: verde amarillento arriba; el envés con las bandas blanquecinas
  // se agrega aparte (`GLAUCO`).
  escama: [
    { v: [92, 132], r: [0.56, 0.72], b: [0.62, 0.80] },
    { v: [170, 222], r: [0.66, 0.84], b: [0.56, 0.74] },
    { v: [204, 244], r: [0.74, 0.92], b: [0.50, 0.66] },
  ],
  // Pinus contorta: «amarillo verdosas».
  aguja: [
    { v: [96, 138], r: [0.58, 0.74], b: [0.56, 0.74] },
    { v: [176, 226], r: [0.70, 0.88], b: [0.50, 0.68] },
    { v: [208, 246], r: [0.78, 0.96], b: [0.44, 0.62] },
  ],
};
const GLAUCO = [0.80, 0.88, 0.86];

function colorDe(rnd, paleta, luz) {
  const v = Math.max(16, Math.min(255, entre(rnd, paleta.v[0], paleta.v[1]) * luz));
  return [Math.min(255, v * entre(rnd, paleta.r[0], paleta.r[1])) / 255, v / 255, Math.min(255, v * entre(rnd, paleta.b[0], paleta.b[1])) / 255];
}
/** 0,30 en el corazón de la mata y 1 en el borde, más luz arriba (+v es arriba). */
const luzDe = (p) => 0.80 + 0.20 * (0.3 + 0.7 * p.rel) + 0.06 * p.arriba;
const oscurecer = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Reparto de las tres pasadas: la sombra, más adentro, es la que se ve entre
// ramita y ramita; la masa, la mitad; la punta al sol, encima de todo y arriba.
const PASADAS = [
  { parte: 0.30, alcance: 0.80 },
  { parte: 0.45, alcance: 1.00 },
  { parte: 0.25, alcance: 1.00, arriba: true },
];

// ── Latifoliadas: ramitas con hojas ────────────────────────────────────────

/**
 * Una ramita: el eje, apenas curvado, y las hojas alternas a los dos lados,
 * dísticas, que es como las lleva un Nothofagus (y el maitén, a su modo). La
 * hoja achica hacia la punta y la ramita termina en una hoja.
 */
function ramitaConHojas(L, rnd, clase, x0, y0, ang, largo, col, hojaPx) {
  const f = clase.forma;
  const curva = entre(rnd, -0.35, 0.35) / largo;
  let x = x0, y = y0, a = ang;
  const pasos = Math.max(2, Math.round(largo / 2));
  const puntos = [[x, y, a]];
  for (let i = 0; i < pasos; i++) {
    a += curva * (largo / pasos);
    x += Math.cos(a) * (largo / pasos); y += Math.sin(a) * (largo / pasos);
    puntos.push([x, y, a]);
  }
  const colEje = oscurecer(col, 0.72);
  for (let i = 1; i < puntos.length; i++) L.trazo(puntos[i - 1][0], puntos[i - 1][1], puntos[i][0], puntos[i][1], 0.5, colEje);
  let lado = rnd() < 0.5 ? -1 : 1;
  const paso = hojaPx[1] * f.paso;
  for (let d = largo * 0.12; d < largo; d += paso * entre(rnd, 0.85, 1.15)) {
    const t = d / largo;
    const q = puntos[Math.min(puntos.length - 1, Math.round(t * pasos))];
    const lh = entre(rnd, hojaPx[0], hojaPx[1]) * (1 - 0.25 * t);
    const ah = lh * entre(rnd, f.anchoRel[0], f.anchoRel[1]);
    const giro = lado * entre(rnd, f.angulo[0], f.angulo[1]);
    const k = entre(rnd, 0.9, 1.1);
    L.hoja(q[0], q[1], q[2] + giro, lh, ah, f.anchoMax, [col[0] * k, col[1] * k, col[2] * k]);
    lado = -lado;
  }
  const u = puntos[puntos.length - 1];
  const lh = entre(rnd, hojaPx[0], hojaPx[1]) * 0.8;
  L.hoja(u[0], u[1], u[2], lh, lh * entre(rnd, f.anchoRel[0], f.anchoRel[1]), f.anchoMax, col);
}

function dibujarLatifoliada(L, rnd, clase, matas) {
  const f = clase.forma, P = clase.pxPorMetro, pal = PALETAS[clase.colores];
  const [rm0, rm1] = f.ramillaM.map((m) => m * P);
  const hojaPx = clase.hojaPxRango;
  for (const m of matas) {
    // Cuántas ramitas: `densidad` veces el área de la mata sobre el área de una ramita.
    const areaRamita = ((rm0 + rm1) / 2) * hojaPx[1] * 1.3;
    const total = Math.round(f.densidad * m.area / areaRamita);
    PASADAS.forEach((pasada, ip) => {
      const n = Math.round(total * pasada.parte);
      for (let i = 0; i < n; i++) {
        const p = colocar(rnd, m, pasada, 0.45);
        const ang = p.ang;
        const largo = entre(rnd, rm0, rm1) * (1 - 0.25 * p.rel);
        // La ramita arranca atrás del punto y termina pasándolo: el borde queda deshilachado.
        const [x0, y0] = recoger(m, p.x - Math.cos(ang) * largo * 0.5, p.y - Math.sin(ang) * largo * 0.5, ang, largo);
        ramitaConHojas(L, rnd, clase, x0, y0, ang, largo, colorDe(rnd, pal[ip], luzDe(p)), hojaPx);
      }
    });
  }
}

// ── Ciprés: abanicos aplanados de escamas ──────────────────────────────────

/**
 * Una ramilla aplanada de Austrocedrus: el eje, y a cada lado ramitas alternas
 * que se acortan hacia la punta —el abanico triangular de las Cupresáceas—, las
 * más largas con su tercer orden. Todo de un texel de ancho, que a 150 px/m son
 * 6,7 mm: la ramita con sus escamas laterales mide de 2 a 4 mm, así que va al
 * doble de ancho; el largo del abanico, de 9 a 19 cm, sí es el real.
 *
 * La escama se dibuja como el grano: cada tramo de un texel sale un poco más
 * claro o más oscuro que el anterior, alternando, que es el par de escamas
 * laterales que se ve en una foto de cerca. El envés, con sus dos bandas
 * estomáticas blanquecinas, aparece en las ramillas vueltas (`envés`).
 */
function ramillaEscamas(L, rnd, x0, y0, ang, largo, col, enves) {
  const base = enves ? [col[0] * 0.55 + GLAUCO[0] * 0.45, col[1] * 0.55 + GLAUCO[1] * 0.45, col[2] * 0.55 + GLAUCO[2] * 0.45] : col;
  const tramo = (xa, ya, xb, yb, w) => {
    const l = Math.hypot(xb - xa, yb - ya), n = Math.max(1, Math.round(l));
    for (let i = 0; i < n; i++) {
      const k = i % 2 ? 0.9 : 1.08;
      L.trazo(xa + (xb - xa) * i / n, ya + (yb - ya) * i / n, xa + (xb - xa) * (i + 1) / n, ya + (yb - ya) * (i + 1) / n, w,
        [base[0] * k, base[1] * k, base[2] * k]);
    }
  };
  const ex = x0 + Math.cos(ang) * largo, ey = y0 + Math.sin(ang) * largo;
  tramo(x0, y0, ex, ey, 1.15);
  let lado = rnd() < 0.5 ? -1 : 1;
  for (let d = 2; d < largo - 1; d += entre(rnd, 2.2, 3.0)) {
    const t = d / largo;
    const px = x0 + Math.cos(ang) * d, py = y0 + Math.sin(ang) * d;
    const a2 = ang + lado * entre(rnd, 0.75, 1.05);
    const l2 = largo * (0.46 * (1 - t) + 0.06) * entre(rnd, 0.8, 1.15);
    const qx = px + Math.cos(a2) * l2, qy = py + Math.sin(a2) * l2;
    tramo(px, py, qx, qy, 0.95);
    if (l2 > 7) {
      let lado3 = -lado;
      for (let e = 2; e < l2 - 1; e += entre(rnd, 2.0, 2.6)) {
        const t3 = e / l2;
        const rx = px + Math.cos(a2) * e, ry = py + Math.sin(a2) * e;
        const a3 = a2 + lado3 * entre(rnd, 0.7, 0.95);
        const l3 = l2 * 0.38 * (1 - t3) + 1;
        tramo(rx, ry, rx + Math.cos(a3) * l3, ry + Math.sin(a3) * l3, 0.9);
        lado3 = -lado3;
      }
    }
    lado = -lado;
  }
}

function dibujarEscamas(L, rnd, clase, matas) {
  const f = clase.forma, P = clase.pxPorMetro, pal = PALETAS.escama;
  const [a0, a1] = f.abanicoM.map((m) => m * P);
  for (const m of matas) {
    const areaAbanico = ((a0 + a1) / 2) * ((a0 + a1) / 2) * 0.45;
    const total = Math.round(f.densidad * m.area / areaAbanico);
    PASADAS.forEach((pasada, ip) => {
      const n = Math.round(total * pasada.parte);
      for (let i = 0; i < n; i++) {
        // Los abanicos siguen la rama y se abren hacia afuera.
        const p = colocar(rnd, m, pasada, 0.55);
        const ang = p.ang;
        const largo = entre(rnd, a0, a1) * (1 - 0.25 * p.rel);
        const [x0, y0] = recoger(m, p.x - Math.cos(ang) * largo * 0.45, p.y - Math.sin(ang) * largo * 0.45, ang, largo);
        const enves = ip > 0 && rnd() < 0.18;
        ramillaEscamas(L, rnd, x0, y0, ang, largo, colorDe(rnd, pal[ip], luzDe(p)), enves);
      }
    });
  }
}

// ── Pino: brotes de acículas de a dos ──────────────────────────────────────

/**
 * Un brote de Pinus contorta visto de costado: la ramita parda y, a lo largo
 * del último 75 %, un fascículo cada 1,3 px con sus dos acículas. Cada acícula
 * sale a 35-65° del eje y gira alrededor de él (la espiral de los fascículos),
 * así que en el plano del atlas se ve con su largo proyectado: `cos α` hacia
 * adelante y `sen α · cos ω` hacia el costado. Las dos del par se abren unos
 * 25° entre sí. Es el cepillo cilíndrico de la punta de una rama de pino.
 */
function brote(L, rnd, clase, x0, y0, ang, largo, col) {
  const hojaPx = clase.hojaPxRango;
  const curva = entre(rnd, 0.1, 0.45) / largo * (Math.cos(ang) >= 0 ? 1 : -1);
  const pasos = Math.max(3, Math.round(largo / 2));
  const pts = [[x0, y0, ang]];
  let x = x0, y = y0, a = ang;
  for (let i = 0; i < pasos; i++) {
    a += curva * (largo / pasos);   // «ascendentes en la punta»: +v es arriba
    x += Math.cos(a) * (largo / pasos); y += Math.sin(a) * (largo / pasos);
    pts.push([x, y, a]);
  }
  const colRama = [0.42, 0.32, 0.22];
  for (let i = 1; i < pts.length; i++) L.trazo(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1.4 * (1 - 0.4 * i / pts.length), colRama);
  for (let d = largo * 0.25; d <= largo; d += 1.3) {
    const t = d / largo;
    const q = pts[Math.min(pts.length - 1, Math.round(t * pasos))];
    const w = rnd() * Math.PI * 2;
    for (const dw of [0, 0.45]) {
      const alfa = entre(rnd, 0.6, 1.13);
      const lh = entre(rnd, hojaPx[0], hojaPx[1]) * (t > 0.9 ? 0.75 : 1);
      const adelante = Math.cos(alfa) * lh, costado = Math.sin(alfa) * Math.cos(w + dw) * lh;
      const ca = Math.cos(q[2]), sa = Math.sin(q[2]);
      const k = entre(rnd, 0.88, 1.12) * (t > 0.85 ? 1.08 : 1);
      L.trazo(q[0], q[1], q[0] + ca * adelante - sa * costado, q[1] + sa * adelante + ca * costado, 0.8, [col[0] * k, col[1] * k, col[2] * k]);
    }
  }
}

function dibujarAciculas(L, rnd, clase, matas) {
  const f = clase.forma, pal = PALETAS.aguja;
  const [b0, b1] = f.brotePx;
  for (const m of matas) {
    const areaBrote = ((b0 + b1) / 2) * clase.hojaPxRango[1] * 1.2;
    const total = Math.round(f.densidad * m.area / areaBrote);
    PASADAS.forEach((pasada, ip) => {
      const n = Math.round(total * pasada.parte);
      for (let i = 0; i < n; i++) {
        const p = colocar(rnd, m, pasada, 0.5);
        const ang = p.ang;
        const largo = entre(rnd, b0, b1) * (1 - 0.25 * p.rel);
        const [x0, y0] = recoger(m, p.x - Math.cos(ang) * largo * 0.55, p.y - Math.sin(ang) * largo * 0.55, ang, largo);
        brote(L, rnd, clase, x0, y0, ang, largo, colorDe(rnd, pal[ip], luzDe(p)));
      }
    });
  }
}

// ── Después de dibujar ─────────────────────────────────────────────────────

/**
 * Lleva la luminancia media lineal de lo que pasa el corte a la del atlas de
 * hoy, sin tocar el matiz. Devuelve el factor, que queda en el manifiesto.
 */
function normalizar(L) {
  const n = L.n, ancho = Math.floor(U_MAX * n);
  let s = 0, c = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < ancho; x++) {
    const k = y * n + x, a = L.A[k];
    if (a < 0.28) continue;
    const r = lineal(L.C[k * 3] / a), g = lineal(L.C[k * 3 + 1] / a), b = lineal(L.C[k * 3 + 2] / a);
    s += 0.2126 * r + 0.7152 * g + 0.0722 * b; c++;
  }
  const f = c ? LUMINANCIA_OBJETIVO / (s / c) : 1;
  for (let k = 0; k < n * n; k++) {
    const a = L.A[k];
    if (a <= 0) continue;
    for (let i = 0; i < 3; i++) L.C[k * 3 + i] = aSRGB(lineal(L.C[k * 3 + i] / a) * f) * a;
  }
  return f;
}

/** Desenfoque de caja separable, tres pasadas: casi gaussiano. */
function desenfocar(buf, n, canales, radio) {
  const tmp = new Float32Array(buf.length);
  const pasada = (src, dst, horizontal) => {
    for (let j = 0; j < n; j++) {
      for (let ch = 0; ch < canales; ch++) {
        let acc = 0;
        const at = (i) => { const ii = i < 0 ? 0 : i >= n ? n - 1 : i; return horizontal ? src[(j * n + ii) * canales + ch] : src[(ii * n + j) * canales + ch]; };
        for (let i = -radio; i <= radio; i++) acc += at(i);
        for (let i = 0; i < n; i++) {
          const o = horizontal ? (j * n + i) * canales + ch : (i * n + j) * canales + ch;
          dst[o] = acc / (2 * radio + 1);
          acc += at(i + radio + 1) - at(i - radio);
        }
      }
    }
  };
  for (let k = 0; k < 3; k++) { pasada(buf, tmp, true); pasada(tmp, buf, false); }
}

/**
 * Color de lo transparente: el de las hojas vecinas. El mipmap promedia RGB sin
 * mirar el alfa, así que un texel vacío en negro tiñe de negro el borde de cada
 * hoja a partir del segundo nivel. Se desenfoca el color premultiplicado y el
 * alfa, y donde el texel no es macizo se mezcla hacia ese color de vecindario.
 */
function dilatar(L) {
  const n = L.n;
  const C = Float32Array.from(L.C), A = Float32Array.from(L.A);
  desenfocar(C, n, 3, Math.round(n / 64));
  desenfocar(A, n, 1, Math.round(n / 64));
  let mr = 0, mg = 0, mb = 0, ma = 0;
  for (let k = 0; k < n * n; k++) { mr += L.C[k * 3]; mg += L.C[k * 3 + 1]; mb += L.C[k * 3 + 2]; ma += L.A[k]; }
  const medio = [mr / ma, mg / ma, mb / ma];
  const rgb = new Float32Array(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    const a = L.A[k];
    const vecino = A[k] > 1e-4 ? [C[k * 3] / A[k], C[k * 3 + 1] / A[k], C[k * 3 + 2] / A[k]] : medio;
    const propio = a > 1e-4 ? [L.C[k * 3] / a, L.C[k * 3 + 1] / a, L.C[k * 3 + 2] / a] : vecino;
    const t = clamp01(a / 0.5);
    for (let i = 0; i < 3; i++) rgb[k * 3 + i] = vecino[i] + (propio[i] - vecino[i]) * t;
  }
  return rgb;
}

// ── La corteza, portada de `Vegetacion.js` ────────────────────────────────

function semillero(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(a, b) {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >> 13), 1274126177);
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

/**
 * La misma cuenta que `dibujarCorteza()` de `Vegetacion.js`, texel por texel,
 * escribiendo en `px` (RGBA 8 bits) en vez de en un lienzo. Si una cambia, la
 * otra tiene que cambiar igual: el juego compensa el brillo del tronco con la
 * media que declara el manifiesto.
 */
function dibujarCorteza(px, N, conifera) {
  const xIni = Math.round(CORTEZA_X0 * N), ancho = N - xIni, alto = N;
  const azar = semillero(conifera ? 0x9e3779b9 : 0x85ebca77);
  const guarda = Math.round(CORTEZA_GUARDA * N);
  const xUtil = xIni + guarda;
  const anchoUtil = N - xUtil - guarda;
  const nSurcos = conifera ? 5 : 9;
  const surcos = [];
  for (let k = 0; k < nSurcos; k++) {
    surcos.push({
      pos: (k + 0.5 + (azar() - 0.5) * 0.55) / nSurcos,
      ancho: (conifera ? 0.062 : 0.030) * (0.62 + azar() * 0.85),
      hondo: (conifera ? 0.44 : 0.21) * (0.65 + azar() * 0.7),
      serpAmp: (conifera ? 0.030 : 0.016) * (0.35 + azar() * 1.3),
      serpFrec: 0.55 + azar() * 1.9,
      serpFase: azar() * Math.PI * 2,
    });
  }
  const nPlacas = conifera ? 9 : 14;
  const placas = [];
  for (let k = 0; k < nPlacas; k++) {
    placas.push({ x: azar(), y: azar(), rx: 0.16 + azar() * 0.26, ry: 0.020 + azar() * 0.060, claro: (conifera ? 0.14 : 0.10) * (0.5 + azar()) });
  }
  const base = conifera ? 0.90 : 0.93;
  const bandasY = conifera ? 13 : 24;
  let suma = 0, cuenta = 0, maxLineal = 0;
  for (let y = 0; y < alto; y++) {
    const yn = y / alto;
    for (let x = 0; x < ancho; x++) {
      const xi = (((x + xIni - xUtil) % anchoUtil) + anchoUtil) % anchoUtil;
      const xp = xi / anchoUtil;
      let g = base;
      for (let k = 0; k < nSurcos; k++) {
        const s = surcos[k];
        const p = s.pos + s.serpAmp * Math.sin(s.serpFrec * yn * Math.PI * 2 + s.serpFase);
        let dd = xp - p;
        dd -= Math.round(dd);
        const t = Math.abs(dd) / s.ancho;
        if (t < 1) { const q = 1 - t; g -= s.hondo * q * q; }
      }
      const ci = Math.floor(xp * nSurcos + 0.5) % nSurcos;
      const cj = Math.floor(yn * bandasY + hash2(ci, 7) * 0.7);
      g += (hash2(ci, cj) - 0.5) * (conifera ? 0.17 : 0.085);
      const bordeY = Math.abs((yn * bandasY + hash2(ci, 7) * 0.7) - cj - 0.5);
      if (bordeY > 0.42) g -= (conifera ? 0.20 : 0.09) * (bordeY - 0.42) / 0.08;
      for (let k = 0; k < nPlacas; k++) {
        const pl = placas[k];
        let ddx = xp - pl.x; ddx -= Math.round(ddx);
        const ddy = yn - pl.y;
        const q = (ddx / pl.rx) * (ddx / pl.rx) + (ddy / pl.ry) * (ddy / pl.ry);
        if (q < 1) g += pl.claro * (1 - q);
      }
      g += (hash2(xi, (y * 0.14) | 0) - 0.5) * 0.075;
      g += (hash2(xi * 3 + 7, y * 5 + 13) - 0.5) * 0.055;
      g = g < 0.06 ? 0.06 : g > 1 ? 1 : g;
      const b = Math.round(g * 255);
      const o = (y * N + x + xIni) * 4;
      px[o] = px[o + 1] = px[o + 2] = b;
      px[o + 3] = 255;
      const col = x + xIni;
      if (col >= xUtil && col < xUtil + anchoUtil) {
        const lin = lineal(b / 255);
        suma += lin; cuenta++;
        if (lin > maxLineal) maxLineal = lin;
      }
    }
  }
  return { u0: xUtil / N, u1: (xUtil + anchoUtil) / N, v0: 0.5 / N, v1: 1 - 0.5 / N, mediaLineal: suma / cuenta, maxLineal };
}

// ── Medidas que van al manifiesto ──────────────────────────────────────────

/** La misma cuenta del banco: fracción ≥ 0,28 en la ventana, por nivel 2×2 hasta 32 px. */
function coberturas(px, n, corte = 0.28) {
  let w = n, a = new Float32Array(w * w);
  for (let i = 0; i < w * w; i++) a[i] = px[i * 4 + 3] / 255;
  const niveles = {};
  while (w >= 32) {
    let pasa = 0, tot = 0;
    const umax = Math.floor(w * U_MAX);
    for (let y = 0; y < w; y++) for (let x = 0; x < umax; x++) { tot++; if (a[y * w + x] >= corte) pasa++; }
    niveles[w] = +(pasa / tot).toFixed(4);
    const w2 = w / 2, b = new Float32Array(w2 * w2);
    for (let y = 0; y < w2; y++) for (let x = 0; x < w2; x++) b[y * w2 + x] = (a[2 * y * w + 2 * x] + a[2 * y * w + 2 * x + 1] + a[(2 * y + 1) * w + 2 * x] + a[(2 * y + 1) * w + 2 * x + 1]) / 4;
    a = b; w = w2;
  }
  return niveles;
}

function colorMedio(px, n) {
  const ancho = Math.floor(U_MAX * n);
  const s = [0, 0, 0];
  let c = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < ancho; x++) {
    const o = (y * n + x) * 4;
    if (px[o + 3] < 0.28 * 255) continue;
    for (let i = 0; i < 3; i++) s[i] += lineal(px[o + i] / 255);
    c++;
  }
  return s.map((v) => +(v / c).toFixed(4));
}

// ── Hornear ────────────────────────────────────────────────────────────────

function hornear(clase) {
  const n = clase.lado;
  const rnd = mulberry32(hashCadena('follaje:' + clase.id));
  const L = new Lienzo(n);
  const matas = sembrarMatas(rnd, clase);
  clase.dibujar(L, rnd, clase, matas);
  const factor = normalizar(L);
  const rgb = dilatar(L);
  const px = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    for (let i = 0; i < 3; i++) px[k * 4 + i] = Math.round(clamp01(rgb[k * 3 + i]) * 255);
    px[k * 4 + 3] = Math.round(clamp01(L.A[k]) * 255);
  }
  const corteza = dibujarCorteza(px, n, clase.id === 'escama' || clase.id === 'aguja');
  return { px, matas: matas.length, factor, corteza };
}

fs.mkdirSync(SALIDA, { recursive: true });
const manifiesto = {
  generador: 'tools/hornear-follaje.mjs',
  descripcion:
    'Atlas de follaje por clase de hoja, a escala: la hoja mide en el atlas lo que mide en el mundo por pxPorMetro. ' +
    'Fila 0 = v 0 (se sube sin dar vuelta). El follaje ocupa u < uMax; la franja de corteza, u de corteza.u0 a corteza.u1.',
  corte: 0.28,
  clases: [],
};
for (const clase of CLASES) {
  const r = hornear(clase);
  const archivo = `${clase.id}.png`;
  const png = new PNG({ width: clase.lado, height: clase.lado, colorType: 6 });
  png.data = Buffer.from(r.px.buffer);
  fs.writeFileSync(path.join(SALIDA, archivo), PNG.sync.write(png, { colorType: 6, deflateLevel: 9, filterType: 4 }));
  const hojaPx = (clase.hojaPxRango[0] + clase.hojaPxRango[1]) / 2;
  const hojaMundoCm = hojaPx / clase.pxPorMetro * 100;
  const cob = coberturas(r.px, clase.lado);
  manifiesto.clases.push({
    id: clase.id,
    archivo,
    lado: clase.lado,
    referencia: clase.referencia,
    hojaCm: clase.hojaCm,
    hojaPx,
    pxPorMetro: clase.pxPorMetro,
    uMax: U_MAX,
    hojaEnElMundoCm: +hojaMundoCm.toFixed(2),
    vecesLaReal: +(hojaMundoCm / ((clase.hojaCm[0] + clase.hojaCm[1]) / 2)).toFixed(2),
    tarjetaMaximaM: +(U_MAX * clase.lado / clase.pxPorMetro).toFixed(2),
    matas: r.matas,
    cobertura: cob,
    colorMedioLineal: colorMedio(r.px, clase.lado),
    factorLuz: +r.factor.toFixed(4),
    corteza: {
      u0: r.corteza.u0, u1: r.corteza.u1, v0: r.corteza.v0, v1: r.corteza.v1,
      mediaLineal: +r.corteza.mediaLineal.toFixed(6), maxLineal: +r.corteza.maxLineal.toFixed(6),
    },
  });
  const niv = Object.entries(cob).sort((a, b) => b[0] - a[0]).map(([l, c]) => `${l}:${c.toFixed(3)}`).join(' ');
  console.log(`  ${clase.id.padEnd(11)} ${clase.lado}² a ${clase.pxPorMetro} px/m · hoja ${hojaMundoCm.toFixed(1)} cm (×${(hojaMundoCm / ((clase.hojaCm[0] + clase.hojaCm[1]) / 2)).toFixed(2)}) · ${r.matas} matas · luz ×${r.factor.toFixed(2)} · cobertura ${niv}`);
}
fs.writeFileSync(path.join(SALIDA, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2) + '\n');
console.log(`  escrito en ${path.relative(process.cwd(), SALIDA) || SALIDA}`);
