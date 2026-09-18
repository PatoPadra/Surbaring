/**
 * Ronda 8 · fase 3 · la huella del piso.
 *
 * `Mundo.alturaEn` en mil puntos sembrados sobre el DEM de verdad, redondeada al
 * micrómetro, y un sha256 de la lista. La fase 3 cambia cómo se VE el suelo, no dónde
 * está: si esta huella cambia, cambió la física, y el jugador flotaría o se hundiría
 * en el suelo que ve.
 *
 *   node --max-old-space-size=6144 .claude/flota/r8-huella-piso.mjs [src]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

export async function instalarEntornoMundo() {
  const pngjs = (await import('pngjs')).default;
  globalThis.addEventListener ??= () => {};
  globalThis.document ??= { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }), visibilityState: 'visible' };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
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

export async function huellaDelPiso(src) {
  await instalarEntornoMundo();
  const { Mundo } = await import(pathToFileURL(path.join(src, 'world', 'Mundo.js')).href);
  const M = new Mundo();
  await M.cargar('data/dem/');
  let s = 20260918 >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const valores = [];
  for (let k = 0; k < 1000; k++) {
    const x = (rnd() - 0.5) * M.tamano * 0.9, z = (rnd() - 0.5) * M.tamano * 0.9;
    valores.push(M.alturaEn(x, z).toFixed(6));
  }
  return { sha: crypto.createHash('sha256').update(valores.join('|')).digest('hex'), muestra: valores.slice(0, 3) };
}

if (process.argv[1] && process.argv[1].endsWith('r8-huella-piso.mjs')) {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'src');
  const r = await huellaDelPiso(src);
  console.log(JSON.stringify(r));
}
