/**
 * Banco del relieve del mapa — cuánto cuesta de verdad `_construirRelieve()`.
 *
 * Por qué existe: `Mapa._construirRelieve()` dibuja 640×640 píxeles y cada uno
 * hace cinco lecturas de altura. Antes de decidir si el zoom se resuelve con
 * una caché por nivel o con un dibujo por región hay que saber si eso son 20 ms
 * o 900 ms, porque abrir el mapa no puede congelar el juego.
 *
 * No se puede importar `Mundo.js` en Node: `cargar()` usa `fetch` y
 * `createImageBitmap`. Pero el costo está en la aritmética, no en la carga, así
 * que acá se replica **exactamente** la aritmética de `alturaBaseEn`,
 * `detalleEn`, `factorDetalleEn` y `_construirDetalle` sobre el DEM de verdad
 * —`public/data/dem/alturas.r16`, 2048×2048 de 16 bits— leído con `fs`.
 *
 * Lo único que se falsea es la máscara de agua (queda en cero), porque viene de
 * un PNG. Eso hace el banco **pesimista**: sin agua, `factorDetalleEn` devuelve
 * 1 y ningún píxel sale por el atajo del lago. El número de verdad es igual o
 * menor.
 *
 *   node .claude/flota/r2-carta-relieve.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DETALLE = { resolucion: 256, periodoM: 64, amplitudM: 1.9 };

// ── El mundo, con la misma aritmética que src/world/Mundo.js ────────────────

const meta = JSON.parse(readFileSync(join(RAIZ, 'public/data/dem/meta.json'), 'utf8'));
const N = meta.resolucion;
const TAMANO = meta.tamanoM;
const MITAD = TAMANO / 2;

const buf = readFileSync(join(RAIZ, 'public/data/dem/alturas.r16'));
const crudo = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
if (crudo.length !== N * N) throw new Error(`alturas.r16 mide ${crudo.length}, se esperaban ${N * N}`);
const escala = meta.alturaMaxCodificada / 65535;
const altura = new Float32Array(N * N);
for (let k = 0; k < N * N; k++) altura[k] = crudo[k] * escala;

// Campo de detalle, copiado tal cual de `_construirDetalle()`
const detalle = (() => {
  const n = DETALLE.resolucion;
  const campo = new Float32Array(n * n);
  const octavas = [
    { f: 2, a: 1.00 }, { f: 4, a: 0.52 }, { f: 8, a: 0.27 },
    { f: 16, a: 0.14 }, { f: 32, a: 0.07 },
  ];
  const hash = (i, j, semilla) => {
    let x = (i * 374761393 + j * 668265263 + semilla * 1442695041) | 0;
    x = (x ^ (x >>> 13)) * 1274126177;
    return (((x ^ (x >>> 16)) >>> 0) / 4294967295) * 2 - 1;
  };
  const suave = t => t * t * (3 - 2 * t);
  let suma = 0;
  for (const { a } of octavas) suma += a;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let v = 0, semilla = 1;
      for (const { f, a } of octavas) {
        const x = (i / n) * f, z = (j / n) * f;
        const x0 = Math.floor(x), z0 = Math.floor(z);
        const fx = suave(x - x0), fz = suave(z - z0);
        const xa = ((x0 % f) + f) % f, xb = (xa + 1) % f;
        const za = ((z0 % f) + f) % f, zb = (za + 1) % f;
        v += a * ((hash(xa, za, semilla) * (1 - fx) + hash(xb, za, semilla) * fx) * (1 - fz)
                + (hash(xa, zb, semilla) * (1 - fx) + hash(xb, zb, semilla) * fx) * fz);
        semilla++;
      }
      campo[j * n + i] = v / suma;
    }
  }
  return campo;
})();
const detalleN = DETALLE.resolucion;

const dentro = (x, z) => x >= -MITAD && x <= MITAD && z >= -MITAD && z <= MITAD;
const texelDe = w => Math.max(0, Math.min(N - 1, (w / TAMANO + 0.5) * N - 0.5));

function alturaBaseEn(x, z) {
  if (!dentro(x, z)) return meta.elevacionMin;
  const fx = texelDe(x), fz = texelDe(z);
  const i0 = Math.floor(fx), j0 = Math.floor(fz);
  const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
  const sx = fx - i0, sz = fz - j0;
  const a = altura[j0 * N + i0], b = altura[j0 * N + i1];
  const c = altura[j1 * N + i0], d = altura[j1 * N + i1];
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
}

function detalleEn(x, z) {
  const n = detalleN;
  const u = (x / DETALLE.periodoM) * n - 0.5;
  const v = (z / DETALLE.periodoM) * n - 0.5;
  const i0 = Math.floor(u), j0 = Math.floor(v);
  const sx = u - i0, sz = v - j0;
  const ia = ((i0 % n) + n) % n, ib = (ia + 1) % n;
  const ja = ((j0 % n) + n) % n, jb = (ja + 1) % n;
  const a = detalle[ja * n + ia], b = detalle[ja * n + ib];
  const c = detalle[jb * n + ia], e = detalle[jb * n + ib];
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + e * sx) * sz;
}

// Sin máscara de agua el factor es siempre 1: el caso más caro.
const factorDetalleEn = (x, z) => (dentro(x, z) ? 1 : 0);

function alturaEn(x, z) {
  return alturaBaseEn(x, z) + detalleEn(x, z) * DETALLE.amplitudM * factorDetalleEn(x, z);
}

// ── Los dos dibujos que se comparan ────────────────────────────────────────

/** Lo que hace hoy `_construirRelieve()`: cinco alturas por píxel. */
function relieveActual(lado, paso, cx = 0, cz = 0) {
  const d = new Uint8ClampedArray(lado * lado * 4);
  const mitadPx = lado / 2;
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      const x = cx + (px - mitadPx + 0.5) * paso;
      const z = cz + (py - mitadPx + 0.5) * paso;
      const h = alturaEn(x, z);
      const hx = alturaEn(x + paso, z) - alturaEn(x - paso, z);
      const hz = alturaEn(x, z + paso) - alturaEn(x, z - paso);
      const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / (paso * 1.6)));
      const t = Math.max(0, Math.min(1, (h - 750) / 1900));
      let r, g, b;
      if (t < 0.35) { r = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
      else if (t < 0.62) { r = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
      else if (t < 0.82) { r = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
      else { r = 226; g = 232; b = 240; }
      const enCurva = Math.abs((h % 200) - 100) > 96;
      const f = luz * (enCurva ? 0.74 : 1);
      const k = (py * lado + px) * 4;
      d[k] = r * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
    }
  }
  return d;
}

/**
 * La alternativa: una sola pasada de alturas a una fila de más por lado, y las
 * pendientes por diferencia entre vecinos ya calculados. Una lectura por píxel
 * en vez de cinco, con el mismo resultado numérico salvo en los bordes.
 */
function relieveUnaPasada(lado, paso, cx = 0, cz = 0) {
  const L = lado + 2;
  const H = new Float32Array(L * L);
  const mitadPx = lado / 2;
  for (let j = 0; j < L; j++) {
    const z = cz + (j - 1 - mitadPx + 0.5) * paso;
    for (let i = 0; i < L; i++) {
      H[j * L + i] = alturaEn(cx + (i - 1 - mitadPx + 0.5) * paso, z);
    }
  }
  const d = new Uint8ClampedArray(lado * lado * 4);
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      const q = (py + 1) * L + (px + 1);
      const h = H[q];
      const hx = H[q + 1] - H[q - 1];
      const hz = H[q + L] - H[q - L];
      const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / (paso * 1.6)));
      const t = Math.max(0, Math.min(1, (h - 750) / 1900));
      let r, g, b;
      if (t < 0.35) { r = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
      else if (t < 0.62) { r = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
      else if (t < 0.82) { r = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
      else { r = 226; g = 232; b = 240; }
      const enCurva = Math.abs((h % 200) - 100) > 96;
      const f = luz * (enCurva ? 0.74 : 1);
      const k = (py * lado + px) * 4;
      d[k] = r * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
    }
  }
  return d;
}

/**
 * La tercera variante: una pasada **y sin el campo de detalle**.
 *
 * El detalle es un ruido decorativo de 1,9 m de amplitud y 64 m de período,
 * horneado para que el suelo no se lea liso a la altura de los ojos. En una
 * carta topográfica no pinta nada: a 8 m/px, ±1,9 m cada 64 m da pendientes
 * aparentes de 0,24 que **dominarían el sombreado** y le pondrían al mapa una
 * textura de lija que el SRTM no tiene. O sea que sacarlo no es sólo más
 * barato: es más honesto.
 */
function relieveBaseUnaPasada(lado, paso, cx = 0, cz = 0) {
  const L = lado + 2;
  const H = new Float32Array(L * L);
  const mitadPx = lado / 2;
  for (let j = 0; j < L; j++) {
    const z = cz + (j - 1 - mitadPx + 0.5) * paso;
    for (let i = 0; i < L; i++) {
      H[j * L + i] = alturaBaseEn(cx + (i - 1 - mitadPx + 0.5) * paso, z);
    }
  }
  const d = new Uint8ClampedArray(lado * lado * 4);
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      const q = (py + 1) * L + (px + 1);
      const h = H[q];
      const hx = H[q + 1] - H[q - 1];
      const hz = H[q + L] - H[q - L];
      const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / (paso * 1.6)));
      const t = Math.max(0, Math.min(1, (h - 750) / 1900));
      let r, g, b;
      if (t < 0.35) { r = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
      else if (t < 0.62) { r = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
      else if (t < 0.82) { r = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
      else { r = 226; g = 232; b = 240; }
      // Curva de ancho constante: la banda en altura se abre con la pendiente,
      // así la línea mide ~1 px tanto en el filo como en el mallín.
      const grad = Math.max(1e-4, Math.hypot(hx, hz) * 0.5);
      const eq = 200;
      const dist = Math.abs(((h % eq) + eq) % eq - eq * 0.5);
      const enCurva = dist > eq * 0.5 - grad * 0.6;
      const f = luz * (enCurva ? 0.74 : 1);
      const k = (py * lado + px) * 4;
      d[k] = r * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
    }
  }
  return d;
}

// ── Corrida ────────────────────────────────────────────────────────────────

function cronometrar(nombre, fn, veces = 5) {
  fn(); // calentar el JIT: la primera pasada mide el compilador, no el código
  const t = [];
  for (let i = 0; i < veces; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    t.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  t.sort((a, b) => a - b);
  return { nombre, mediana: t[Math.floor(veces / 2)], min: t[0], max: t[veces - 1] };
}

const LADO = 640;
const PASO_MUNDO = TAMANO / LADO;      // 102,4 m por píxel: el mapa de hoy

console.log(`DEM ${N}×${N}, ${meta.metrosPorTexel} m/texel, mundo ${TAMANO} m`);
console.log(`Mapa ${LADO}×${LADO} — el nivel 1 son ${PASO_MUNDO.toFixed(1)} m por píxel\n`);

const filas = [];
for (const z of [1, 2, 4, 8]) {
  const paso = PASO_MUNDO / z;
  filas.push(cronometrar(`actual     ×${z} (${paso.toFixed(1)} m/px)`, () => relieveActual(LADO, paso)));
  filas.push(cronometrar(`1 pasada   ×${z} (${paso.toFixed(1)} m/px)`, () => relieveUnaPasada(LADO, paso)));
  filas.push(cronometrar(`1p s/ruido ×${z} (${paso.toFixed(1)} m/px)`, () => relieveBaseUnaPasada(LADO, paso)));
}
for (const f of filas) {
  console.log(`${f.nombre.padEnd(30)} ${f.mediana.toFixed(1).padStart(7)} ms   (${f.min.toFixed(1)}–${f.max.toFixed(1)})`);
}

// ── ¿Dan lo mismo? ─────────────────────────────────────────────────────────
const a = relieveActual(LADO, PASO_MUNDO);
const b = relieveUnaPasada(LADO, PASO_MUNDO);
let distintos = 0, peor = 0;
for (let k = 0; k < a.length; k++) {
  const d = Math.abs(a[k] - b[k]);
  if (d > 0) { distintos++; peor = Math.max(peor, d); }
}
console.log(`\nPíxeles que difieren entre los dos métodos: ${distintos} de ${a.length / 4 | 0} `
  + `(${(distintos / a.length * 100).toFixed(3)} % de canales), peor diferencia ${peor}`);

// ── Cuánto relieve real hay para mostrar ───────────────────────────────────
console.log(`\nEl DEM tiene ${meta.metrosPorTexel} m por texel. A ${LADO} px de lienzo:`);
for (const z of [1, 2, 3.2, 4, 8]) {
  const paso = PASO_MUNDO / z;
  const texelsPorPixel = paso / meta.metrosPorTexel;
  const km = (LADO * paso) / 1000;
  console.log(`  ×${String(z).padEnd(4)} → ${paso.toFixed(1).padStart(6)} m/px, `
    + `${texelsPorPixel.toFixed(2)} texels por píxel, ventana de ${km.toFixed(1)} km`
    + (texelsPorPixel < 1 ? '   ← el DEM ya no tiene más para dar' : ''));
}
