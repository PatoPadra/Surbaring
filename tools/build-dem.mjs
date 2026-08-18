/**
 * SurviBar — Constructor de terreno real de San Carlos de Bariloche.
 *
 * Descarga teselas de elevación Terrarium (Mapzen / AWS Open Data: SRTM + NASADEM),
 * las remuestrea a una grilla métrica local y deriva:
 *   - mapa de alturas de 16 bits
 *   - máscara de lagos (relleno por inundación desde cotas reales)
 *   - máscara de cauces (acumulación de flujo D8 sobre el DEM)
 *
 * Sin edificios: sólo relieve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'dem');
const CACHE = path.join(__dirname, '..', '.cache', 'tiles');

// ─── Configuración del mundo ────────────────────────────────────────────────
const WORLD = {
  centroLat: -41.10,
  centroLon: -71.52,
  tamanoM: 65536,   // 65,5 km de lado
  resolucion: 2048, // 32 m por texel
  zoom: 13,
  alturaMaxCodificada: 4096, // m — el Tronador llega a 3478
};

const N = WORLD.resolucion;
const DX_M = [1, 1, 0, -1, -1, -1, 0, 1], DZ_M = [0, 1, 1, 1, 0, -1, -1, -1];
const MPD_LAT = 111320; // metros por grado de latitud
const mpdLon = 111320 * Math.cos(WORLD.centroLat * Math.PI / 180);

// Proyección local equirectangular centrada. +X = Este, +Z = Sur.
const aLonLat = (xm, zm) => [
  WORLD.centroLon + xm / mpdLon,
  WORLD.centroLat - zm / MPD_LAT,
];

// ─── Web Mercator ───────────────────────────────────────────────────────────
const lonAPixel = (lon, z) => (lon + 180) / 360 * 256 * Math.pow(2, z);
const latAPixel = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256 * Math.pow(2, z);
};

// ─── Descarga con caché y concurrencia ──────────────────────────────────────
// Una tesela de terreno uniforme (p. ej. la superficie de un lago) comprime a
// menos de 1 KB: validar por tamaño descarta datos buenos. Validamos la firma.
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function esPngValido(ruta) {
  try {
    const st = fs.statSync(ruta);
    if (st.size < 33) return false; // firma + IHDR + IEND como mínimo
    const fd = fs.openSync(ruta, 'r');
    const cab = Buffer.alloc(8);
    fs.readSync(fd, cab, 0, 8, 0);
    fs.closeSync(fd);
    return cab.equals(FIRMA_PNG);
  } catch { return false; }
}

async function bajarTesela(z, x, y) {
  const destino = path.join(CACHE, `${z}_${x}_${y}.png`);
  if (fs.existsSync(destino)) {
    return esPngValido(destino) ? destino : null;
  }
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  for (let intento = 0; intento < 4; intento++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) { fs.writeFileSync(destino, Buffer.alloc(0)); return null; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, buf);
      return destino;
    } catch (e) {
      if (intento === 3) { console.warn(`  ! falló ${z}/${x}/${y}: ${e.message}`); return null; }
      await new Promise(r => setTimeout(r, 400 * (intento + 1)));
    }
  }
}

async function enLotes(items, n, fn) {
  const salida = new Array(items.length);
  let i = 0, hechos = 0;
  const trabajador = async () => {
    while (i < items.length) {
      const k = i++;
      salida[k] = await fn(items[k], k);
      if (++hechos % 25 === 0) process.stdout.write(`\r  descargadas ${hechos}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: n }, trabajador));
  process.stdout.write(`\r  descargadas ${items.length}/${items.length}\n`);
  return salida;
}

// ─── Paso 1: teselas necesarias ─────────────────────────────────────────────
const mitad = WORLD.tamanoM / 2;
const [lonO, latN] = aLonLat(-mitad, -mitad);
const [lonE, latS] = aLonLat(mitad, mitad);
const z = WORLD.zoom;

const tx0 = Math.floor(lonAPixel(lonO, z) / 256), tx1 = Math.floor(lonAPixel(lonE, z) / 256);
const ty0 = Math.floor(latAPixel(latN, z) / 256), ty1 = Math.floor(latAPixel(latS, z) / 256);
const anchoMosaico = (tx1 - tx0 + 1) * 256;
const altoMosaico = (ty1 - ty0 + 1) * 256;

console.log('SurviBar — construcción del terreno de Bariloche');
console.log(`  BBox: lat ${latS.toFixed(4)}..${latN.toFixed(4)}  lon ${lonO.toFixed(4)}..${lonE.toFixed(4)}`);
console.log(`  Mundo: ${WORLD.tamanoM / 1000} km de lado, ${(WORLD.tamanoM / N).toFixed(1)} m por texel`);
console.log(`  Teselas z=${z}: ${(tx1 - tx0 + 1)} × ${(ty1 - ty0 + 1)} = ${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)}`);

const lista = [];
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) lista.push([tx, ty]);

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
console.log('\n[1/6] Descargando teselas de elevación…');
const rutas = await enLotes(lista, 12, ([x, y]) => bajarTesela(z, x, y));

// ─── Paso 2: mosaico ────────────────────────────────────────────────────────
console.log('[2/6] Componiendo mosaico…');
// NaN = sin dato. Nunca 0: un cero se confunde con el nivel del mar y abre
// cráteres en el terreno.
const mosaico = new Float32Array(anchoMosaico * altoMosaico).fill(NaN);
let faltantes = 0;
for (let k = 0; k < lista.length; k++) {
  const [tx, ty] = lista[k];
  const ruta = rutas[k];
  const ox = (tx - tx0) * 256, oy = (ty - ty0) * 256;
  if (!ruta) { faltantes++; continue; }
  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(ruta));
  } catch (e) {
    console.warn(`  ! tesela corrupta ${tx},${ty}: ${e.message}`);
    fs.unlinkSync(ruta);
    faltantes++;
    continue;
  }
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const s = (y * png.width + x) * 4;
      // Terrarium: altura = (R*256 + G + B/256) - 32768
      mosaico[(oy + y) * anchoMosaico + (ox + x)] =
        (png.data[s] * 256 + png.data[s + 1] + png.data[s + 2] / 256) - 32768;
    }
  }
}
if (faltantes) {
  console.log(`  ${faltantes} teselas ausentes: rellenando huecos por difusión…`);
  // Propagación iterativa desde los bordes válidos: degrada suavemente en vez
  // de dejar un agujero.
  for (let pase = 0; pase < 512; pase++) {
    let rellenados = 0;
    for (let y = 0; y < altoMosaico; y++) {
      for (let x = 0; x < anchoMosaico; x++) {
        const idx = y * anchoMosaico + x;
        if (!Number.isNaN(mosaico[idx])) continue;
        let suma = 0, n = 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX_M[d], ny = y + DZ_M[d];
          if (nx < 0 || nx >= anchoMosaico || ny < 0 || ny >= altoMosaico) continue;
          const v = mosaico[ny * anchoMosaico + nx];
          if (!Number.isNaN(v)) { suma += v; n++; }
        }
        if (n) { mosaico[idx] = suma / n; rellenados++; }
      }
    }
    if (!rellenados) break;
  }
  let huecos = 0;
  for (let k = 0; k < mosaico.length; k++) if (Number.isNaN(mosaico[k])) huecos++;
  if (huecos) throw new Error(`Quedaron ${huecos} texels sin dato: revisá la conectividad y volvé a correr.`);
  console.log('  huecos rellenados');
}

// ─── Paso 3: remuestreo bilineal a grilla métrica ───────────────────────────
console.log('[3/6] Remuestreando a grilla métrica local…');
const altura = new Float32Array(N * N);
let hMin = Infinity, hMax = -Infinity;
for (let j = 0; j < N; j++) {
  const zm = (j / (N - 1) - 0.5) * WORLD.tamanoM;
  for (let i = 0; i < N; i++) {
    const xm = (i / (N - 1) - 0.5) * WORLD.tamanoM;
    const [lon, lat] = aLonLat(xm, zm);
    const fx = lonAPixel(lon, z) - tx0 * 256;
    const fy = latAPixel(lat, z) - ty0 * 256;
    const x0 = Math.max(0, Math.min(anchoMosaico - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(altoMosaico - 1, Math.floor(fy)));
    const x1 = Math.min(anchoMosaico - 1, x0 + 1);
    const y1 = Math.min(altoMosaico - 1, y0 + 1);
    const sx = fx - x0, sy = fy - y0;
    const a = mosaico[y0 * anchoMosaico + x0], b = mosaico[y0 * anchoMosaico + x1];
    const c = mosaico[y1 * anchoMosaico + x0], d = mosaico[y1 * anchoMosaico + x1];
    const h = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    altura[j * N + i] = h;
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
}
console.log(`  Elevación: ${hMin.toFixed(1)} m … ${hMax.toFixed(1)} m`);

// ─── Paso 4: lagos por detección automática de superficies planas ───────────
// Los cuerpos de agua quedan perfectamente horizontales en el DEM. En vez de
// sembrar a mano (frágil: las semillas caen en islas y penínsulas), buscamos
// componentes conexas grandes de pendiente casi nula y después las bautizamos
// por cercanía a coordenadas conocidas.
console.log('[4/6] Detectando lagos por planitud…');

const PLANITUD_M = 0.75;   // desnivel máximo en el vecindario 3x3
const AREA_MIN_KM2 = 0.04; // descarta charcos y artefactos
const areaCelda = Math.pow(WORLD.tamanoM / N, 2) / 1e6;

const candidato = new Uint8Array(N * N);
for (let j = 1; j < N - 1; j++) {
  for (let i = 1; i < N - 1; i++) {
    const idx = j * N + i;
    let min = Infinity, max = -Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const h = altura[(j + dj) * N + (i + di)];
      if (h < min) min = h;
      if (h > max) max = h;
    }
    if (max - min <= PLANITUD_M) candidato[idx] = 1;
  }
}

const LAGOS_CONOCIDOS = [
  { id: 'nahuel_huapi', nombre: 'Lago Nahuel Huapi', lat: -41.00, lon: -71.50 },
  { id: 'gutierrez', nombre: 'Lago Gutiérrez', lat: -41.22, lon: -71.43 },
  { id: 'moreno_oeste', nombre: 'Lago Moreno Oeste', lat: -41.085, lon: -71.57 },
  { id: 'moreno_este', nombre: 'Lago Moreno Este', lat: -41.075, lon: -71.51 },
  { id: 'mascardi', nombre: 'Lago Mascardi', lat: -41.33, lon: -71.55 },
  { id: 'guillelmo', nombre: 'Lago Guillelmo', lat: -41.38, lon: -71.53 },
  { id: 'el_trebol', nombre: 'Lago El Trébol', lat: -41.065, lon: -71.535 },
  { id: 'escondido', nombre: 'Lago Escondido', lat: -41.11, lon: -71.60 },
  { id: 'los_moscos', nombre: 'Laguna Los Moscos', lat: -41.13, lon: -71.58 },
  { id: 'fonck', nombre: 'Lago Fonck', lat: -41.42, lon: -71.60 },
  { id: 'steffen', nombre: 'Lago Steffen', lat: -41.47, lon: -71.55 },
  { id: 'espejo', nombre: 'Lago Espejo', lat: -40.66, lon: -71.70 },
  { id: 'correntoso', nombre: 'Lago Correntoso', lat: -40.73, lon: -71.62 },
  { id: 'hess', nombre: 'Lago Hess', lat: -41.40, lon: -71.72 },
  { id: 'roca', nombre: 'Lago Roca', lat: -41.36, lon: -71.70 },
];

const agua = new Uint8Array(N * N);
const aLatLonDePixel = (i, j) => [
  WORLD.centroLat - ((j / (N - 1) - 0.5) * WORLD.tamanoM) / MPD_LAT,
  WORLD.centroLon + ((i / (N - 1) - 0.5) * WORLD.tamanoM) / mpdLon,
];

const visitado = new Uint8Array(N * N);
const componentes = [];
const cola = new Int32Array(N * N);
for (let semilla = 0; semilla < N * N; semilla++) {
  if (!candidato[semilla] || visitado[semilla]) continue;
  let cabeza = 0, cola_ = 0;
  cola[cola_++] = semilla;
  visitado[semilla] = 1;
  const celdas = [];
  let sumaH = 0, sumaI = 0, sumaJ = 0;
  while (cabeza < cola_) {
    const idx = cola[cabeza++];
    celdas.push(idx);
    const i = idx % N, j = (idx / N) | 0;
    sumaH += altura[idx]; sumaI += i; sumaJ += j;
    if (i > 0 && candidato[idx - 1] && !visitado[idx - 1]) { visitado[idx - 1] = 1; cola[cola_++] = idx - 1; }
    if (i < N - 1 && candidato[idx + 1] && !visitado[idx + 1]) { visitado[idx + 1] = 1; cola[cola_++] = idx + 1; }
    if (j > 0 && candidato[idx - N] && !visitado[idx - N]) { visitado[idx - N] = 1; cola[cola_++] = idx - N; }
    if (j < N - 1 && candidato[idx + N] && !visitado[idx + N]) { visitado[idx + N] = 1; cola[cola_++] = idx + N; }
  }
  const areaKm2 = celdas.length * areaCelda;
  if (areaKm2 < AREA_MIN_KM2) continue;
  componentes.push({
    celdas,
    areaKm2,
    cota: sumaH / celdas.length,
    ci: sumaI / celdas.length,
    cj: sumaJ / celdas.length,
  });
}
componentes.sort((a, b) => b.areaKm2 - a.areaKm2);

const usados = new Set();
const lagosDetectados = [];
for (const c of componentes) {
  for (const idx of c.celdas) agua[idx] = 255;
  const [lat, lon] = aLatLonDePixel(c.ci, c.cj);
  // Bautizo por cercanía (en km) al lago conocido más próximo aún libre
  let mejor = null, mejorD = Infinity;
  for (const l of LAGOS_CONOCIDOS) {
    if (usados.has(l.id)) continue;
    const dx = (l.lon - lon) * mpdLon / 1000, dy = (l.lat - lat) * MPD_LAT / 1000;
    const d = Math.hypot(dx, dy);
    if (d < mejorD) { mejorD = d; mejor = l; }
  }
  const reconocido = mejor && mejorD < 9;
  if (reconocido) usados.add(mejor.id);
  const reg = {
    id: reconocido ? mejor.id : `cuerpo_${lagosDetectados.length}`,
    nombre: reconocido ? mejor.nombre : 'Cuerpo de agua sin identificar',
    cota: +c.cota.toFixed(1),
    areaKm2: +c.areaKm2.toFixed(3),
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    identificado: !!reconocido,
  };
  lagosDetectados.push(reg);
  if (c.areaKm2 > 0.15) {
    console.log(`  ${reg.nombre.padEnd(30)} cota ${reg.cota.toFixed(0).padStart(4)} m  ${reg.areaKm2.toFixed(2).padStart(7)} km2  (${reg.lat}, ${reg.lon})`);
  }
}
const aguaTotal = lagosDetectados.reduce((s, l) => s + l.areaKm2, 0);
console.log(`  ${lagosDetectados.length} cuerpos de agua, ${aguaTotal.toFixed(1)} km2 en total`);

// ─── Paso 5: red hídrica por acumulación de flujo D8 ────────────────────────
console.log('[5/6] Calculando red hídrica (D8)…');
const orden = Array.from({ length: N * N }, (_, i) => i).sort((a, b) => altura[b] - altura[a]);
const acumulacion = new Float32Array(N * N).fill(1);
const DX = [1, 1, 0, -1, -1, -1, 0, 1], DZ = [0, 1, 1, 1, 0, -1, -1, -1];
for (const idx of orden) {
  if (agua[idx]) continue;
  const i = idx % N, j = (idx / N) | 0;
  let mejor = -1, mejorPend = 0;
  for (let d = 0; d < 8; d++) {
    const ni = i + DX[d], nj = j + DZ[d];
    if (ni < 0 || ni >= N || nj < 0 || nj >= N) continue;
    const nIdx = nj * N + ni;
    const pend = (altura[idx] - altura[nIdx]) / ((d & 1) ? 1.41421356 : 1);
    if (pend > mejorPend) { mejorPend = pend; mejor = nIdx; }
  }
  if (mejor >= 0) acumulacion[mejor] += acumulacion[idx];
}
const UMBRAL_RIO = 700;
const rio = new Uint8Array(N * N);
let celdasRio = 0;
for (let k = 0; k < N * N; k++) {
  if (!agua[k] && acumulacion[k] > UMBRAL_RIO) {
    rio[k] = Math.min(255, Math.round(60 + 90 * Math.log10(1 + acumulacion[k] / UMBRAL_RIO)));
    celdasRio++;
  }
}
console.log(`  ${celdasRio} celdas de cauce (${(celdasRio * 100 / (N * N)).toFixed(2)} % del mapa)`);

// ─── Paso 6: escritura ──────────────────────────────────────────────────────
console.log('[6/6] Escribiendo salidas…');

// alturas.png — R: byte alto, G: byte bajo, B: lago, A: cauce
const pngAlturas = new PNG({ width: N, height: N, colorType: 6, inputHasAlpha: true });
for (let k = 0; k < N * N; k++) {
  const h = Math.max(0, Math.min(WORLD.alturaMaxCodificada, altura[k]));
  const cod = Math.round(h / WORLD.alturaMaxCodificada * 65535);
  const s = k * 4;
  pngAlturas.data[s] = (cod >> 8) & 255;
  pngAlturas.data[s + 1] = cod & 255;
  pngAlturas.data[s + 2] = agua[k];
  pngAlturas.data[s + 3] = 255;
}
fs.writeFileSync(path.join(OUT, 'alturas.png'), PNG.sync.write(pngAlturas, { deflateLevel: 9 }));

const pngRios = new PNG({ width: N, height: N, colorType: 0 });
for (let k = 0; k < N * N; k++) pngRios.data[k] = rio[k];
fs.writeFileSync(path.join(OUT, 'rios.png'), PNG.sync.write(pngRios, { deflateLevel: 9 }));

// Binario crudo para la física (precisión completa, sin pasar por el decodificador PNG)
const raw = Buffer.alloc(N * N * 2);
for (let k = 0; k < N * N; k++) {
  const h = Math.max(0, Math.min(WORLD.alturaMaxCodificada, altura[k]));
  raw.writeUInt16LE(Math.round(h / WORLD.alturaMaxCodificada * 65535), k * 2);
}
fs.writeFileSync(path.join(OUT, 'alturas.r16'), raw);

const meta = {
  generado: new Date().toISOString(),
  fuente: 'Terrarium DEM (Mapzen / AWS Open Data): SRTM, NASADEM y datos nacionales',
  atribucion: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
  proyeccion: 'equirectangular local centrada',
  centro: { lat: WORLD.centroLat, lon: WORLD.centroLon },
  bbox: { latSur: latS, latNorte: latN, lonOeste: lonO, lonEste: lonE },
  tamanoM: WORLD.tamanoM,
  resolucion: N,
  metrosPorTexel: WORLD.tamanoM / N,
  alturaMaxCodificada: WORLD.alturaMaxCodificada,
  elevacionMin: +hMin.toFixed(2),
  elevacionMax: +hMax.toFixed(2),
  lagos: lagosDetectados,
  umbralRio: UMBRAL_RIO,
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

// ─── Verificación: el terreno tiene que ser realmente Bariloche ─────────────
console.log('\n[verificación] Contrastando contra hitos reales…');
let fallos = 0;

// (a) Cumbres. El SRTM suaviza los picos afilados y las coordenadas publicadas
// tienen error, así que buscamos el máximo en un radio de 1,5 km y aceptamos
// subestimación (nunca sobreestimación fuerte).
const CUMBRES = [
  ['Cerro Tronador', -41.1567, -71.8853, 3478],
  // La cumbre real (Catedral Sur) está al sur del centro de esquí, no en él.
  ['Cerro Catedral', -41.2170, -71.4950, 2388],
  ['Cerro López', -41.1075, -71.5486, 2076],
  ['Cerro Otto', -41.1447, -71.3856, 1405],
];
const RADIO_PX = Math.round(1500 / (WORLD.tamanoM / N));
for (const [nombre, lat, lon, esperado] of CUMBRES) {
  const xm = (lon - WORLD.centroLon) * mpdLon;
  const zm = (WORLD.centroLat - lat) * MPD_LAT;
  const ci = Math.round((xm / WORLD.tamanoM + 0.5) * (N - 1));
  const cj = Math.round((zm / WORLD.tamanoM + 0.5) * (N - 1));
  let medido = -Infinity;
  for (let dj = -RADIO_PX; dj <= RADIO_PX; dj++) for (let di = -RADIO_PX; di <= RADIO_PX; di++) {
    const i = ci + di, j = cj + dj;
    if (i < 0 || i >= N || j < 0 || j >= N) continue;
    if (altura[j * N + i] > medido) medido = altura[j * N + i];
  }
  const dif = medido - esperado;
  const ok = dif >= -220 && dif <= 120;
  if (!ok) fallos++;
  console.log(`  ${ok ? 'OK  ' : 'MAL '} ${nombre.padEnd(26)} ${medido.toFixed(0).padStart(5)} m  (real ${esperado}, dif ${dif > 0 ? '+' : ''}${dif.toFixed(0)} m)`);
}

// (b) Cotas de lagos, contra las componentes que detectamos. El DEM Terrarium
// da alturas ortométricas (EGM96): un sesgo constante de +5..+12 m es normal.
// Sólo lagos con cota publicada confiable. El Trébol queda fuera: se detecta,
// pero no encontré una cota con fuente firme contra la cual afirmar nada.
const COTAS_REALES = {
  nahuel_huapi: 764, gutierrez: 800, mascardi: 800,
  moreno_este: 758, moreno_oeste: 758,
};
for (const [id, esperado] of Object.entries(COTAS_REALES)) {
  const det = lagosDetectados.find(l => l.id === id);
  if (!det) { console.log(`  MAL  ${id.padEnd(26)} no detectado`); fallos++; continue; }
  const dif = det.cota - esperado;
  const ok = dif >= -8 && dif <= 20;
  if (!ok) fallos++;
  console.log(`  ${ok ? 'OK  ' : 'MAL '} ${det.nombre.padEnd(26)} ${det.cota.toFixed(0).padStart(5)} m  (real ${esperado}, dif ${dif > 0 ? '+' : ''}${dif.toFixed(0)} m)`);
}

// (c) El lago Nahuel Huapi tiene que ser, de lejos, el cuerpo de agua dominante.
const nh = lagosDetectados.find(l => l.id === 'nahuel_huapi');
if (!nh || nh.areaKm2 < 250) {
  console.log(`  MAL  Superficie del Nahuel Huapi insuficiente: ${nh ? nh.areaKm2 : 0} km2`);
  fallos++;
} else {
  console.log(`  OK   Nahuel Huapi ocupa ${nh.areaKm2.toFixed(0)} km2 dentro del mundo`);
}

if (fallos) {
  throw new Error(`${fallos} control(es) fuera de tolerancia: el terreno no coincide con Bariloche.`);
}
let ceros = 0;
for (let k = 0; k < N * N; k++) if (altura[k] <= 1) ceros++;
if (ceros > 0) {
  throw new Error(`${ceros} texels a 0 m: hay huecos sin rellenar en el DEM.`);
}
console.log('  Sin texels a 0 m. Terreno validado.');

const mb = f => (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(2) + ' MB';
console.log(`\n  alturas.png  ${mb('alturas.png')}`);
console.log(`  rios.png     ${mb('rios.png')}`);
console.log(`  alturas.r16  ${mb('alturas.r16')}`);
console.log('\nListo: el relieve del Nahuel Huapi está en disco.');
