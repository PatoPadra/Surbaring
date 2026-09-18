/**
 * Ronda 7 · ¿Hay arcilla y arena, o es muy difícil encontrarlas?
 *
 * La pregunta es del dueño, jugando el 12/9/2026: «no hay arcilla o arena o es
 * muy difícil de encontrar??». Se contesta midiendo sobre el mundo de verdad
 * —el DEM, el `Sotobosque`, la `Mineria` y los `Limites` del juego, importados y
 * no copiados— y desde el punto de partida real (-41,0870 · -71,4290).
 *
 * Qué NO mide, dicho antes del número: la vegetación. `Recoleccion.quePuedoHacer`
 * le da la tecla a cualquier planta a menos de 7 m antes que a la piedra, y
 * `Vegetacion` hornea impostores con la placa, así que no se arma en Node. Todo
 * lo que sale de acá para la arcilla es una **cota superior**: el juego real da
 * igual o menos.
 *
 *   node --max-old-space-size=6144 .claude/flota/r7-arcilla.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const urlDe = (raiz, rel) => pathToFileURL(path.join(raiz, rel)).href;

const PARTIDA = { lat: -41.0870, lon: -71.4290 };

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const q = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((m, n) => m - n); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + ' %' : '—');
const m0 = (v) => (Number.isFinite(v) ? Math.round(v) + ' m' : '—');

// El mismo entorno de `banco-r5-fase2.mjs`: el Mundo carga el DEM por fetch.
async function instalarEntorno() {
  const pngjs = (await import('pngjs')).default;
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }), visibilityState: 'visible' };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async (url) => {
    const f = path.join(RAIZ, 'public', String(url).replace(/^\//, ''));
    const buf = fs.readFileSync(f);
    return {
      ok: true,
      json: async () => JSON.parse(buf.toString('utf8')),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      blob: async () => ({ __buf: buf }),
    };
  };
  globalThis.createImageBitmap = async (blob) => {
    const png = pngjs.PNG.sync.read(blob.__buf);
    return { width: png.width, height: png.height, data: png.data, close() {} };
  };
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      let img = null;
      return {
        drawImage(b) { img = b; },
        getImageData() { return { data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength) }; },
      };
    }
  };
}

await instalarEntorno();
const t0 = performance.now();
const { Mundo } = await import(urlDe(SRC, 'world/Mundo.js'));
const { Sotobosque } = await import(urlDe(SRC, 'world/Sotobosque.js'));
const { Limites } = await import(urlDe(SRC, 'world/Limites.js'));
const { Mineria } = await import(urlDe(SRC, 'systems/Mineria.js'));
const M = new Mundo();
await M.cargar('data/dem/');
const limites = new Limites(M);
const mineria = new Mineria({}, { mundo: M, limites });
const soto = new Sotobosque(M);
const lotePiedra = soto.lotes.find((l) => l.tipo.id === 'piedra');
const loteTronco = soto.lotes.find((l) => l.tipo.id === 'tronco');
if (!lotePiedra || !loteTronco) throw new Error('el sotobosque no tiene los lotes piedra y tronco');
console.log(`mundo cargado en ${((performance.now() - t0) / 1000).toFixed(1)} s`);

const P = M.aMundo(PARTIDA.lat, PARTIDA.lon);
console.log(`partida: x ${P.x.toFixed(0)} · z ${P.z.toFixed(0)} · ${limites.jurisdiccion(P.x, P.z)}`);

/** Réplica de `Recoleccion._aguaCerca()`: la rama que le gana a la piedra. */
function aguaAMano(x, z) {
  for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) {
    if (M.esAgua(x + dx, z + dz)) return true;
  }
  return M.cauceEn(x, z) > 0.25;
}

/** ¿Hay una mata de este lote a menos de `r` m, sembrada como la siembra el juego parado acá? */
function hayMata(lote, x, z, r) {
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  lote.nParcial = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) soto._sembrarCelda(lote, dx, dz, cx, cz);
  const a = lote.malla.instanceMatrix.array;
  for (let i = 0; i < lote.nParcial; i++) {
    const o = i * 16;
    if (Math.hypot(a[o + 12] - x, a[o + 14] - z) < r) return true;
  }
  return false;
}

// ── 1 · La arcilla: una piedra en la orilla, fuera del alcance del agua ─────
{
  const rnd = azar(7070);
  const R = 3000, N = 60000, TOPE_BANDA = 4000, TOPE_CONTROL = 2000;
  let tierra = 0, orilla = 0, orillaAgua = 0, banda = 0;
  let bandaMirada = 0, bandaPiedra = 0, bandaTronco = 0, bandaUtil = 0;
  let control = 0, controlPiedra = 0;
  const distUtil = [];
  const t1 = performance.now();
  for (let k = 0; k < N; k++) {
    const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
    const x = P.x + Math.cos(ang) * rr, z = P.z + Math.sin(ang) * rr;
    if (!M.dentro(x, z) || M.esAgua(x, z)) continue;
    tierra++;
    const enOrilla = M.orillaCerca(x, z);
    const agua = aguaAMano(x, z);
    if (enOrilla) orilla++;
    if (enOrilla && agua) orillaAgua++;
    if (enOrilla && !agua) {
      banda++;
      if (bandaMirada < TOPE_BANDA) {
        bandaMirada++;
        const piedra = hayMata(lotePiedra, x, z, 5);
        const tronco = hayMata(loteTronco, x, z, 5);
        if (piedra) bandaPiedra++;
        if (tronco) bandaTronco++;
        if (piedra && !tronco) { bandaUtil++; distUtil.push(Math.hypot(x - P.x, z - P.z)); }
      }
    } else if (!enOrilla && control < TOPE_CONTROL) {
      control++;
      if (hayMata(lotePiedra, x, z, 5)) controlPiedra++;
    }
  }
  console.log(`\n1 · ARCILLA, ${N} puntos al azar a menos de ${R} m de la partida (${((performance.now() - t1) / 1000).toFixed(1)} s)`);
  console.log(`  tierra                                         ${tierra}`);
  console.log(`  orilla (Mundo.orillaCerca, 12 m)               ${orilla}  ${pct(orilla, tierra)} de la tierra`);
  console.log(`  ...de esa orilla, con agua a mano (gana beber) ${orillaAgua}  ${pct(orillaAgua, orilla)}`);
  console.log(`  banda donde la piedra puede dar arcilla        ${banda}  ${pct(banda, tierra)} de la tierra`);
  console.log(`  en la banda (${bandaMirada} mirados): piedra a 5 m   ${pct(bandaPiedra, bandaMirada)}`);
  console.log(`  en la banda: tronco a 5 m (le gana la tecla)   ${pct(bandaTronco, bandaMirada)}`);
  console.log(`  en la banda: piedra y ningún tronco            ${pct(bandaUtil, bandaMirada)}`);
  console.log(`  control fuera de la orilla: piedra a 5 m       ${pct(controlPiedra, control)}  (${control} puntos)`);
  const util = bandaMirada ? bandaUtil / bandaMirada : 0;
  const fracTierra = tierra ? (banda / tierra) * util : 0;
  console.log(`  => puntos de la tierra desde donde E puede dar arcilla: ${(fracTierra * 100).toFixed(3)} % (cota superior: sin plantas)`);
  console.log(`  => y ahí rinde 0,45 × 2 = 0,9 arcilla por piedra; horno de barro 10 + carbonera 4 = ${Math.ceil(14 / 0.9)} piedras de orilla`);
  console.log(`  distancia a la partida de los puntos útiles: mín ${m0(q(distUtil, 0))} · p10 ${m0(q(distUtil, 0.1))} · mediana ${m0(q(distUtil, 0.5))}`);
}

// ── 2 · La arena: un banco de arena donde la ley deja abrir cantera ──────────
{
  const FRENTE = 24, R = 22000;
  const minPor = { parque: Infinity, reserva: Infinity, fuera: Infinity };
  const cuenta = { parque: 0, reserva: 0, fuera: 0 };
  const t2 = performance.now();
  const i0 = Math.round((P.x - R) / FRENTE), i1 = Math.round((P.x + R) / FRENTE);
  const j0 = Math.round((P.z - R) / FRENTE), j1 = Math.round((P.z + R) / FRENTE);
  for (let j = j0; j <= j1; j++) {
    const z = j * FRENTE;
    for (let i = i0; i <= i1; i++) {
      const x = i * FRENTE;
      const d = Math.hypot(x - P.x, z - P.z);
      if (d > R || !M.dentro(x, z) || M.esAgua(x, z)) continue;
      const yac = mineria._resolverFrente(x, z);
      if (yac?.id !== 'arena') continue;
      const jur = limites.jurisdiccion(x, z);
      cuenta[jur]++;
      if (d < minPor[jur]) minPor[jur] = d;
    }
  }
  console.log(`\n2 · ARENA, frentes de ${FRENTE} m a menos de ${R / 1000} km (${((performance.now() - t2) / 1000).toFixed(1)} s)`);
  for (const jur of ['parque', 'reserva', 'fuera']) {
    console.log(`  ${jur.padEnd(8)} frentes de arena ${String(cuenta[jur]).padStart(6)} · el más cercano a ${m0(minPor[jur])}`);
  }
  console.log('  (Mineria.evaluar niega siempre en parque y en reserva; sólo «fuera» se puede abrir, y con herramienta)');
}
