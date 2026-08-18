/** Diagnóstico: mapa ASCII del DEM para verificar la georreferenciación. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'dem');
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
const N = meta.resolucion;
const buf = fs.readFileSync(path.join(OUT, 'alturas.r16'));

const altura = new Float32Array(N * N);
let hMin = Infinity, hMax = -Infinity;
for (let k = 0; k < N * N; k++) {
  const h = buf.readUInt16LE(k * 2) / 65535 * meta.alturaMaxCodificada;
  altura[k] = h;
  if (h < hMin) hMin = h;
  if (h > hMax) hMax = h;
}
console.log(`Elevación global: ${hMin.toFixed(1)} … ${hMax.toFixed(1)} m\n`);

// ── Mapa ASCII ──────────────────────────────────────────────────────────────
// '~' = superficie de lago (765-771 m), luego bandas de altura
const W = 112, H = 56;
const simbolo = h => {
  if (h >= 764 && h <= 771) return '~';
  if (h < 780) return '.';
  if (h < 900) return ',';
  if (h < 1100) return '-';
  if (h < 1300) return '=';
  if (h < 1500) return '+';
  if (h < 1700) return 'o';
  if (h < 1900) return 'O';
  if (h < 2100) return '8';
  if (h < 2400) return '#';
  if (h < 2800) return '%';
  return '@';
};
console.log('Mapa del mundo (norte arriba, oeste a la izquierda):');
console.log('  ~ lago  . , - = + o O 8 # % @  (creciente en altura)\n');
const filas = [];
for (let y = 0; y < H; y++) {
  let fila = '';
  for (let x = 0; x < W; x++) {
    const i = Math.round(x / (W - 1) * (N - 1));
    const j = Math.round(y / (H - 1) * (N - 1));
    fila += simbolo(altura[j * N + i]);
  }
  filas.push(fila);
  console.log(String(y).padStart(2) + ' ' + fila);
}

// ── Centroide del lago principal ────────────────────────────────────────────
let sx = 0, sy = 0, n = 0;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const h = altura[j * N + i];
  if (h >= 764 && h <= 771) { sx += i; sy += j; n++; }
}
const ci = sx / n, cj = sy / n;
const MPD_LAT = 111320;
const mpdLon = 111320 * Math.cos(meta.centro.lat * Math.PI / 180);
const xm = (ci / (N - 1) - 0.5) * meta.tamanoM;
const zm = (cj / (N - 1) - 0.5) * meta.tamanoM;
const lon = meta.centro.lon + xm / mpdLon;
const lat = meta.centro.lat - zm / MPD_LAT;
console.log(`\nCentroide del agua a 764-771 m: px(${ci.toFixed(0)},${cj.toFixed(0)})`);
console.log(`  -> lat ${lat.toFixed(4)}, lon ${lon.toFixed(4)}   (${n} celdas)`);
console.log(`  Nahuel Huapi real: aprox lat -41.00, lon -71.50`);

// ── Punto más alto ──────────────────────────────────────────────────────────
let mejor = 0;
for (let k = 1; k < N * N; k++) if (altura[k] > altura[mejor]) mejor = k;
const bi = mejor % N, bj = (mejor / N) | 0;
const bxm = (bi / (N - 1) - 0.5) * meta.tamanoM;
const bzm = (bj / (N - 1) - 0.5) * meta.tamanoM;
console.log(`\nCumbre más alta: ${altura[mejor].toFixed(0)} m en px(${bi},${bj})`);
console.log(`  -> lat ${(meta.centro.lat - bzm / MPD_LAT).toFixed(4)}, lon ${(meta.centro.lon + bxm / mpdLon).toFixed(4)}`);
console.log(`  Cerro Tronador real: lat -41.1567, lon -71.8853, 3478 m`);
