/**
 * El guion de la sección 8 del banco r8 fase 1: la costa al tope y el dibujo de la
 * base hasta 32 m/px. Carga el DEM de verdad, por eso corre en un proceso aparte.
 *
 *   node --max-old-space-size=6144 .claude/flota/r8-costa-banco.mjs <src>
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { medirCosta } from './r8-costa.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(process.argv[2] || path.join(AQUI, '..', '..', 'src'));

const c = await medirCosta(src);
// medirCosta ya instaló el entorno y cargó los módulos: se reusan
const { Mundo } = await import(pathToFileURL(path.join(src, 'world', 'Mundo.js')).href);
const { tallarRelieve } = await import(pathToFileURL(path.join(src, 'ui', 'Mapa.js')).href);
const { Mapa: MapaBase } = await import(pathToFileURL(path.join(AQUI, 'base-r8', 'Mapa.js')).href);
const M = new Mundo();
await M.cargar('data/dem/');
const P = M.aMundo(-41.0870, -71.4290);
let iguales = 0, comparados = 0, distintos = 0;
for (const [mpp, cx, cz] of [[32, P.x, P.z], [32, P.x - 4000, P.z + 3000], [65536 / 640, 0, 0]]) {
  const gen = tallarRelieve(M, mpp, cx, cz, 640);
  let r; do r = gen.next(); while (!r.done);
  const nuevo = r.value.canvas.__img.data;
  const b = Object.create(MapaBase.prototype);
  b.mundo = M;
  const viejo = b._construirTile(mpp, cx, cz).canvas.__img.data;
  let d = 0;
  for (let k = 0; k < nuevo.length; k++) if (nuevo[k] !== viejo[k]) d++;
  comparados++;
  if (d === 0) iguales++;
  distintos += d;
}
console.log('@@COSTA ' + JSON.stringify({ ...c, iguales, comparados, distintos }));
