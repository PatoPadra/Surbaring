/**
 * Ronda 8 · fase 3 · las métricas del suelo de cerca, sobre capturas del juego.
 *
 * Lee los PNG que escribe `window.capturar()` en `capturas/` y mide, por lugar:
 *
 *   - **detalle**: la media de |laplaciano| de la luminancia en la franja cercana
 *     (el 45 % de abajo de la captura mirando al suelo a −35°). Sube con bordes
 *     nítidos y baja con manchas borrosas.
 *   - **brillo**: la luminancia media de esa misma franja, en 0–255. Es la guarda de
 *     que el suelo no quedó ni más oscuro ni más claro que lo calibrado.
 *   - **medio**: la media de |laplaciano| en la franja del medio (de 40 % a 62 % de
 *     la altura) mirando al frente a −8°, o sea de 10 a 40 m. Es la guarda contra el
 *     aliasing: una textura sin mipmaps a esa distancia llena la franja de ruido.
 *
 * Se descartó medir el titileo con dos capturas corridas 2 cm: `capturar` vuelve a
 * prender los árboles según la distancia y el pasto se mueve con el reloj real,
 * así que el par no difiere sólo en los 2 cm (medido el 18/9/2026: 42,8 de
 * diferencia media en la estepa con los árboles prendidos en una y no en la otra).
 *
 * Las capturas se sacan con el sotobosque apagado, para medir el suelo y no el
 * pasto. Así la franja cercana repite exacto entre corridas.
 *
 * Uso: node .claude/flota/r8-suelo-metricas.mjs <prefijo>   (p. ej. r8-base-sinpasto)
 *      Imprime una línea JSON por lugar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const { PNG } = (await import('pngjs')).default;

const prefijo = process.argv[2] || 'r8-base';
const LUGARES = ['bosque', 'estepa', 'pedregal'];

function leer(nombre) {
  const f = path.join(RAIZ, 'capturas', `${nombre}.png`);
  if (!fs.existsSync(f)) return null;
  const png = PNG.sync.read(fs.readFileSync(f));
  const { width: W, height: H, data } = png;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  return { W, H, L };
}

export function detalleYBrillo(img, desde = 0.55, hasta = 0.98) {
  const { W, H, L } = img;
  let lap = 0, lum = 0, n = 0;
  for (let y = Math.floor(H * desde); y < Math.floor(H * hasta); y++) {
    for (let x = 2; x < W - 2; x++) {
      const k = y * W + x;
      lap += Math.abs(4 * L[k] - L[k - 1] - L[k + 1] - L[k - W] - L[k + W]);
      lum += L[k];
      n++;
    }
  }
  return { detalle: lap / n, brillo: lum / n };
}

export function titileo(a, b, desde = 0.25, hasta = 0.60) {
  let d = 0, n = 0;
  for (let y = Math.floor(a.H * desde); y < Math.floor(a.H * hasta); y++) {
    for (let x = 0; x < a.W; x++) { const k = y * a.W + x; d += Math.abs(a.L[k] - b.L[k]); n++; }
  }
  return d / n;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('r8-suelo-metricas.mjs')) {
  for (const id of LUGARES) {
    const s = leer(`${prefijo}-suelo-${id}`);
    const a = leer(`${prefijo}-medio-${id}-a`);
    if (!s || !a) { console.log(JSON.stringify({ lugar: id, error: 'faltan capturas' })); continue; }
    const db = detalleYBrillo(s);
    const dm = detalleYBrillo(a, 0.40, 0.62);
    console.log(JSON.stringify({ lugar: id, detalle: +db.detalle.toFixed(2), brillo: +db.brillo.toFixed(2), medio: +dm.detalle.toFixed(2) }));
  }
}
