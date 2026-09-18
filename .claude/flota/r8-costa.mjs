/**
 * Ronda 8 · la costa del mapa al zoom máximo, sobre el DEM de verdad.
 *
 * Con el zoom de la fase 1 el mapa llega a 2 m/px, y la máscara de agua tiene un
 * texel cada 32 m: si el mapa pregunta `mundo.esAgua()` —el texel más cercano—, la
 * costa sale en escalones de 16 px. Esto arma el recorte con `tallarRelieve` de
 * verdad en ocho costas cerca del arranque y mide, en cada una, **el tramo recto
 * más largo del borde del agua**, horizontal o vertical: una escalera de texels da
 * tramos de ~16 px; una costa interpolada, tramos cortos.
 *
 *   node --max-old-space-size=6144 .claude/flota/r8-costa.mjs [src]
 *   Imprime una línea JSON: por costa, la fracción del borde en tramos rectos de
 *   8 px o más (`tramos`), la mediana, y los píxeles de agua de las ocho juntas.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { instalarEntornoMundo } from './r8-huella-piso.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

export async function medirCosta(src) {
  await instalarEntornoMundo();
  globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
  const doc = globalThis.document;
  const crear = doc.createElement;
  // El lienzo de mentira se queda con la imagen: se mide lo que el mapa pinta.
  doc.createElement = (t) => {
    if (t !== 'canvas') return crear(t);
    const lz = { width: 0, height: 0, __img: null };
    lz.getContext = () => ({ putImageData(img) { lz.__img = img; } });
    return lz;
  };
  const { Mundo } = await import(pathToFileURL(path.join(src, 'world', 'Mundo.js')).href);
  const { tallarRelieve } = await import(pathToFileURL(path.join(src, 'ui', 'Mapa.js')).href);
  const M = new Mundo();
  await M.cargar('data/dem/');
  const P = M.aMundo(-41.0870, -71.4290);
  // Costas: puntos de tierra con agua a 40 m, en espiral desde el arranque
  const costas = [];
  for (let r = 200; r < 6000 && costas.length < 8; r += 97) {
    for (let a = 0; a < 16 && costas.length < 8; a++) {
      const x = P.x + Math.cos(a * 0.39 + r) * r, z = P.z + Math.sin(a * 0.39 + r) * r;
      if (M.esAgua(x, z)) continue;
      if (![[40, 0], [-40, 0], [0, 40], [0, -40]].some(([dx, dz]) => M.esAgua(x + dx, z + dz))) continue;
      if (costas.some((c) => Math.hypot(c.x - x, c.z - z) < 800)) continue;
      costas.push({ x, z });
    }
  }
  const LADO = 128, MPP = 2;
  let pixelesDeAgua = 0;
  const tramos = [];
  for (const c of costas) {
    const gen = tallarRelieve(M, MPP, c.x, c.z, LADO);
    let r; do r = gen.next(); while (!r.done);
    // El dibujo pinta el agua con (38, 62, 84): se lee de la imagen que pintó.
    const d = r.value.canvas.__img.data;
    const agua = new Uint8Array(LADO * LADO);
    for (let k = 0; k < LADO * LADO; k++) agua[k] = d[k * 4] === 38 && d[k * 4 + 1] === 62 && d[k * 4 + 2] === 84 ? 1 : 0;
    // El borde, en las dos direcciones: cada par vecino agua/tierra en una fila
    // (borde vertical) o en una columna (borde horizontal). Se agrupan en tramos
    // rectos seguidos y se cuenta qué fracción del borde cae en tramos de 8 px o
    // más. Una escalera de texels es todo tramos largos; una costa interpolada
    // tiene diagonales, que a 2 m/px son escalones de uno o dos píxeles.
    let enLargos = 0, total = 0;
    const cerrar = (run) => { total += run; if (run >= 8) enLargos += run; };
    for (let j = 0; j < LADO - 1; j++) {
      let run = 0;
      for (let i = 0; i < LADO; i++) {
        const h = agua[j * LADO + i] !== agua[(j + 1) * LADO + i];
        if (h) run++; else { if (run) cerrar(run); run = 0; }
      }
      if (run) cerrar(run);
    }
    for (let i = 0; i < LADO - 1; i++) {
      let run = 0;
      for (let j = 0; j < LADO; j++) {
        const v = agua[j * LADO + i] !== agua[j * LADO + i + 1];
        if (v) run++; else { if (run) cerrar(run); run = 0; }
      }
      if (run) cerrar(run);
    }
    const peor = total ? enLargos / total : 0;
    for (const v of agua) pixelesDeAgua += v;
    tramos.push(+peor.toFixed(3));
  }
  const orden = [...tramos].sort((a, b) => a - b);
  return { tramos, peor: orden[orden.length - 1], mediana: orden[Math.floor(orden.length / 2)], costas: costas.length, pixelesDeAgua };
}

if (process.argv[1] && process.argv[1].endsWith('r8-costa.mjs')) {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'src');
  console.log(JSON.stringify(await medirCosta(src)));
}
