/**
 * Ronda 8 · ¿dos tandas de capturas de dos cargas distintas dan lo mismo?
 *
 * Premisa de la sección 3 del banco de la fase 3 (y de todo banco que compare una
 * captura contra otra de otra carga): con las semillas del clima fijas, sin eventos y
 * sin lo que se siembra al azar, la misma vista da la misma imagen.
 *
 * Uso: node .claude/flota/r8-repetible.mjs r8-base-f3 r8-base-f3b
 *      → por captura: brillo y detalle de cada tanda (la cuenta de r8-suelo-metricas)
 *        y la diferencia media absoluta de luminancia, píxel a píxel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const { PNG } = (await import('pngjs')).default;
const { detalleYBrillo } = await import(pathToFileURL(path.join(AQUI, 'r8-suelo-metricas.mjs')).href);

const [A, B] = process.argv.slice(2);
if (!A || !B) { console.log('uso: node r8-repetible.mjs <prefijoA> <prefijoB>'); process.exit(2); }
const leer = (nombre) => {
  const png = PNG.sync.read(fs.readFileSync(path.join(RAIZ, 'capturas', `${nombre}.png`)));
  const L = new Float32Array(png.width * png.height);
  for (let i = 0; i < L.length; i++) L[i] = 0.2126 * png.data[i * 4] + 0.7152 * png.data[i * 4 + 1] + 0.0722 * png.data[i * 4 + 2];
  return { W: png.width, H: png.height, L, png };
};
const nombres = ['bosque', 'estepa', 'pedregal'].flatMap((id) => [`sinpasto-suelo-${id}`, `sinpasto-medio-${id}-a`]).concat(['piedra-con', 'piedra-sin']);
let peor = 0;
for (const n of nombres) {
  const a = leer(`${A}-${n}`), b = leer(`${B}-${n}`);
  let d = 0;
  for (let k = 0; k < a.L.length; k++) d += Math.abs(a.L[k] - b.L[k]);
  d /= a.L.length;
  const ma = detalleYBrillo(a), mb = detalleYBrillo(b);
  const dBrillo = Math.abs(ma.brillo / mb.brillo - 1) * 100;
  peor = Math.max(peor, dBrillo);
  console.log(`  ${n.padEnd(28)} brillo ${ma.brillo.toFixed(2)} · ${mb.brillo.toFixed(2)} (${dBrillo.toFixed(2)} %)  detalle ${ma.detalle.toFixed(2)} · ${mb.detalle.toFixed(2)}  |ΔL| píxel a píxel ${d.toFixed(3)}`);
}
console.log(`  peor diferencia de brillo: ${peor.toFixed(2)} %`);
