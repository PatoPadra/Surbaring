/** Busca el máximo del DEM dentro de una caja lat/lon dada. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'dem');
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
const N = meta.resolucion;
const buf = fs.readFileSync(path.join(OUT, 'alturas.r16'));
const altura = new Float32Array(N * N);
for (let k = 0; k < N * N; k++) altura[k] = buf.readUInt16LE(k * 2) / 65535 * meta.alturaMaxCodificada;

const MPD_LAT = 111320;
const mpdLon = 111320 * Math.cos(meta.centro.lat * Math.PI / 180);
const pixDe = (lat, lon) => [
  Math.round((((lon - meta.centro.lon) * mpdLon) / meta.tamanoM + 0.5) * (N - 1)),
  Math.round((((meta.centro.lat - lat) * MPD_LAT) / meta.tamanoM + 0.5) * (N - 1)),
];
const latLonDe = (i, j) => [
  meta.centro.lat - ((j / (N - 1) - 0.5) * meta.tamanoM) / MPD_LAT,
  meta.centro.lon + ((i / (N - 1) - 0.5) * meta.tamanoM) / mpdLon,
];

const CAJAS = [
  ['Macizo del Catedral', -41.25, -41.14, -71.56, -71.40],
  ['Cerro López', -41.15, -41.06, -71.60, -71.50],
  ['Cerro Otto', -41.17, -41.11, -71.42, -71.34],
  ['Cerro Bella Vista', -41.10, -41.03, -71.60, -71.50],
  ['Cordón Challhuaco', -41.28, -41.18, -71.36, -71.24],
];

for (const [nombre, latS, latN, lonO, lonE] of CAJAS) {
  const [i0, j1] = pixDe(latS, lonO);
  const [i1, j0] = pixDe(latN, lonE);
  let mejor = -Infinity, bi = 0, bj = 0;
  for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      if (altura[j * N + i] > mejor) { mejor = altura[j * N + i]; bi = i; bj = j; }
    }
  }
  const [lat, lon] = latLonDe(bi, bj);
  console.log(`${nombre.padEnd(22)} max ${mejor.toFixed(0).padStart(5)} m en lat ${lat.toFixed(4)}, lon ${lon.toFixed(4)}`);
}
