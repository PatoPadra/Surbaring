/**
 * r2-mundo-especies.mjs — banco del frente 4 (el `.slice(0, 26)`).
 *
 *   node .claude/flota/r2-mundo-especies.mjs
 *
 * Qué sostiene:
 *
 * 1. Que con las 26 que entraban **por orden de renglón del JSON**, la estepa
 *    pura —humedad 0— no tenía **ni una sola** especie leñosa apta.
 * 2. Que con 30 elegidas por nicho la cobertura del gradiente **iguala a la de
 *    las 38 enteras**, y que ninguna franja de humedad empeora.
 * 3. Que la cuenta de memoria cierra: cuatro especies más y medio mega menos.
 *
 * Usa las funciones REALES `aptitudDe` y `elegirEspecies` de `Vegetacion.js`.
 * No las puede importar directo —el módulo arrastra three y construye
 * geometría— así que extrae ese tramo del archivo y lo evalúa. Si alguien las
 * cambia, el banco mide lo nuevo.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));
const raíz = resolve(aquí, '../..');
const src = readFileSync(resolve(raíz, 'src/world/Vegetacion.js'), 'utf8');

const desde = src.indexOf('function aptitudDe');
const hasta = src.indexOf('function hashPos');
if (desde < 0 || hasta < 0) {
  console.error('No encontré aptitudDe/elegirEspecies en Vegetacion.js. ¿Se renombraron?');
  process.exit(1);
}
const tramo = src.slice(desde, hasta) + '\nexport { aptitudDe, elegirEspecies };';
const V = await import('data:text/javascript,' + encodeURIComponent(tramo));

// El cupo también se lee del archivo, para que no se desincronice.
const CUPO = parseInt((src.match(/const CUPO_ESPECIES = (\d+)/) || [, '30'])[1], 10);

const flora = JSON.parse(readFileSync(resolve(raíz, 'src/data/flora.json'), 'utf8'));
const F = flora.especies
  .filter(e => ['arbol', 'arbusto', 'cana'].includes(e.tipo))
  .filter(e => e.altitudMinM !== null && e.altitudMaxM !== null);

const antes = F.slice(0, 26);              // el criterio viejo: orden de archivo
const ahora = V.elegirEspecies(F, CUPO);   // el criterio nuevo: nicho

// Malla del gradiente real del parque, con pendiente típica de ladera.
const celdas = [];
for (let a = 700; a <= 2000; a += 50) for (let h = 0; h <= 1.0001; h += 0.05) celdas.push([a, h]);
const aptas = (lista, a, h) => lista.filter(e => V.aptitudDe(e, a, h, 12) > 0.02).length;
const vacías = lista => celdas.filter(c => !lista.some(e => V.aptitudDe(e, c[0], c[1], 12) > 0.02)).length;

console.log(`\nEspecies leñosas en flora.json que pasan el filtro: ${F.length}`);
console.log(`Cupo leído de Vegetacion.js: ${CUPO}\n`);

console.log('=== Qué cambia la selección ===');
console.log('  agrega:', ahora.filter(e => !antes.includes(e)).map(e => e.id).join(', ') || '(nada)');
console.log('  saca:  ', antes.filter(e => !ahora.includes(e)).map(e => e.id).join(', ') || '(nada, que es la intención)');
console.log('  afuera:', F.filter(e => !ahora.includes(e)).map(e => e.id).join(', '));

console.log('\n=== Cobertura del gradiente (altitud 700-2000 × humedad 0-1) ===');
console.log(`  celdas SIN ninguna especie apta:  antes(26) ${vacías(antes)}   ahora(${CUPO}) ${vacías(ahora)}   techo(${F.length}) ${vacías(F)}`);
console.log(vacías(ahora) === vacías(F)
  ? `  -> con ${CUPO} se alcanza la MISMA cobertura que con las ${F.length} enteras.`
  : `  -> todavía quedan ${vacías(ahora) - vacías(F)} celdas que sí cubrirían las ${F.length}.`);

console.log('\n=== Especies aptas por franja de humedad (altitud 900) ===');
console.log('  humedad    antes(26)   ahora(' + CUPO + ')');
let peor = false;
for (const h of [0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.45, 0.60, 0.85, 1.0]) {
  const a = aptas(antes, 900, h), b = aptas(ahora, 900, h);
  if (b < a) peor = true;
  const nota = a === 0 ? '   <-- la estepa no tenía NI UNA' : (b < a ? '   <-- PEOR' : '');
  console.log(`  ${String(h).padEnd(7)}  ${String(a).padStart(7)}   ${String(b).padStart(8)}${nota}`);
}
console.log(peor ? '\n  HAY UNA FRANJA QUE EMPEORA.' : '\n  Ninguna franja empeora.');

// ── Memoria. Cada lote: atlas de vistas 512×768 RGBA con mipmaps + búferes.
const MAXI = parseInt((src.match(/const MAX_IMPOSTORES = (\d+)/) || [, '7000'])[1], 10);
const MAXM = parseInt((src.match(/const MAX_POR_ESPECIE = (\d+)/) || [, '600'])[1], 10);
const ATLAS = 512 * 768 * 4 * (4 / 3) / 1048576;         // con cadena de mipmaps
const porLote = (imp, malla) => ATLAS + (imp * 19 * 4 + malla * 19 * 4) / 1048576;

console.log('\n=== Memoria de lotes ===');
console.log(`  antes  26 × (atlas ${ATLAS.toFixed(2)} + 12000/1200) = ${(26 * porLote(12000, 1200)).toFixed(1)} MiB`);
console.log(`  ahora  ${CUPO} × (atlas ${ATLAS.toFixed(2)} + ${MAXI}/${MAXM}) = ${(CUPO * porLote(MAXI, MAXM)).toFixed(1)} MiB`);
const delta = CUPO * porLote(MAXI, MAXM) - 26 * porLote(12000, 1200);
console.log(`  diferencia: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} MiB con ${CUPO - 26} especies más`);

// La cota dura que hace seguro bajar MAX_IMPOSTORES: no puede haber más
// instancias que candidatos hay en una resiembra.
let candidatos = 0;
for (let dz = -13; dz <= 13; dz++) for (let dx = -13; dx <= 13; dx++) {
  const dc = Math.hypot(dx, dz); if (dc > 13) continue;
  candidatos += Math.round(22 * (1 - Math.min(1, dc / 13) * 0.62));
}
console.log(`\n  cota dura de instancias por lote = candidatos por resiembra = ${candidatos}`);
console.log(`  MAX_IMPOSTORES = ${MAXI} ${MAXI > candidatos ? '> cota: desbordar es imposible' : '<= cota: PODRÍA DESBORDAR'}`);
