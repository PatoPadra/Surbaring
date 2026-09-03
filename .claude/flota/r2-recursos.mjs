/**
 * Banco de los tres recursos que el dueño nunca vio: caña colihue, arcilla y arena.
 *
 * El encargo dice «medir, no suponer», así que esto carga el **DEM real** de
 * disco y usa las clases del juego tal cual están. Responde tres preguntas con
 * números:
 *
 *   1. ¿Cuántas posiciones del mundo cumplen la condición de la arcilla, ANTES
 *      (`_aguaCerca`, 3 m, y encima tapada por la rama de beber) y DESPUÉS
 *      (`_orillaCerca`, 12 m)?
 *   2. ¿Cuántas especies de flora se instancian de verdad, y cuáles quedan
 *      afuera del `.slice(0, 26)` de `Vegetacion.js`?
 *   3. ¿Qué recetas quedan bloqueadas por cada faltante? Eso mide el daño real.
 *
 * Corre con:  node .claude/flota/r2-recursos.mjs
 * NO levanta el servidor ni abre el navegador.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Mundo } from '../../src/world/Mundo.js';
import { Limites } from '../../src/world/Limites.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEM = path.join(RAIZ, 'public/data/dem');
const SPAWN = { x: 7633.7, z: -1447.2 };
const leer = (f) => JSON.parse(readFileSync(path.join(RAIZ, 'src/data', f), 'utf8'));

// Mismo cargador que `r2-cantera.mjs`: `Mundo.cargar()` usa `fetch` y el
// decodificador del navegador, así que se repite su secuencia a mano.
function cargarMundo() {
  const meta = JSON.parse(readFileSync(path.join(DEM, 'meta.json'), 'utf8'));
  const m = new Mundo();
  m.meta = meta;
  const N = m.N = meta.resolucion;
  m.tamano = meta.tamanoM; m.mitad = m.tamano / 2;
  m.metrosPorTexel = meta.metrosPorTexel;
  m.alturaMin = meta.elevacionMin; m.alturaMax = meta.elevacionMax;
  m.mpdLon = 111320 * Math.cos(meta.centro.lat * Math.PI / 180);
  const crudo = new Uint16Array(readFileSync(path.join(DEM, 'alturas.r16')).buffer.slice(0));
  const escala = meta.alturaMaxCodificada / 65535;
  m.altura = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) m.altura[k] = crudo[k] * escala;
  const pngAlt = PNG.sync.read(readFileSync(path.join(DEM, 'alturas.png'))).data;
  const pngRios = PNG.sync.read(readFileSync(path.join(DEM, 'rios.png'))).data;
  m.agua = new Uint8Array(N * N); m.cauce = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) { m.agua[k] = pngAlt[k * 4 + 2]; m.cauce[k] = pngRios[k * 4]; }
  m._excavarLagos(); m._calcularPendiente(); m._calcularHumedad(); m._construirDetalle();
  return m;
}

// Las dos pruebas de agua, copiadas de `Recoleccion.js` para poder correr las
// dos sobre las mismas muestras y compararlas.
const OFFS_CERCA = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]];
const OFFS_ORILLA = [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]];
const prueba = (mundo, x, z, offs, umbral) =>
  offs.some(([dx, dz]) => mundo.esAgua(x + dx, z + dz)) || mundo.cauceEn(x, z) > umbral;

const mundo = cargarMundo();
const limites = new Limites(mundo);

console.log('\n===============================================================');
console.log('1 · LA ARCILLA');
console.log('===============================================================');
console.log('La arcilla sale de levantar una PIEDRA suelta junto al agua. Pero');
console.log('la rama de beber está más arriba en la cadena y hace return, así');
console.log('que llegar a la piedra implicaba que `_aguaCerca()` había dado');
console.log('FALSO. La condición de la arcilla era la misma función, la misma');
console.log('posición y el mismo tick: probabilidad exactamente CERO.\n');

for (const [titulo, cx, cz, radio, paso] of [
  ['alrededor del spawn (1 km)', SPAWN.x, SPAWN.z, 500, 8],
  ['mundo entero (65,5 km)', 0, 0, 32000, 256],
]) {
  let n = 0, cerca = 0, orilla = 0, soloOrilla = 0;
  for (let x = cx - radio; x <= cx + radio; x += paso) {
    for (let z = cz - radio; z <= cz + radio; z += paso) {
      if (!mundo.dentro(x, z) || mundo.esAgua(x, z)) continue;
      n++;
      const c = prueba(mundo, x, z, OFFS_CERCA, 0.25);
      const o = prueba(mundo, x, z, OFFS_ORILLA, 0.15);
      if (c) cerca++;
      if (o) orilla++;
      if (o && !c) soloOrilla++;
    }
  }
  const pc = (v) => `${(100 * v / n).toFixed(2)} %`;
  console.log(`── ${titulo} · ${n} muestras en tierra`);
  console.log(`   pasa _aguaCerca()  (3 m) : ${pc(cerca)}  ← y acá la tapa la rama de beber ⇒ 0,00 % útil`);
  console.log(`   pasa _orillaCerca()(12 m): ${pc(orilla)}`);
  console.log(`   posiciones donde SÓLO pasa la nueva, o sea donde la arcilla`);
  console.log(`   ahora es posible y antes no: ${pc(soloOrilla)}`);
  console.log(`   con el 45 % de la tirada, arcilla por piedra levantada: ${(0.45 * orilla / n * 100).toFixed(2)} %\n`);
}

console.log('===============================================================');
console.log('2 · LA CAÑA COLIHUE Y LAS OTRAS ONCE QUE CORTA EL .slice(0, 26)');
console.log('===============================================================');
const flora = leer('flora.json');
const leñosas = flora.especies
  .filter(e => ['arbol', 'arbusto', 'cana'].includes(e.tipo))
  .filter(e => e.altitudMinM !== null && e.altitudMaxM !== null);
console.log(`especies que pasan el filtro de Vegetacion.js : ${leñosas.length}`);
console.log(`especies que de verdad se instancian (slice)  : ${Math.min(26, leñosas.length)}`);
console.log(`ESPECIES QUE NO EXISTEN EN EL JUEGO           : ${Math.max(0, leñosas.length - 26)}\n`);
leñosas.slice(26).forEach((e, i) => {
  const rec = e.recursoJuego ? ` · da ${e.recursoJuego}` : '';
  console.log(`   ${String(26 + i).padStart(2)}  ${e.id.padEnd(18)} ${e.tipo.padEnd(8)}${rec}`);
});

console.log('\n===============================================================');
console.log('3 · QUÉ RECETAS QUEDAN BLOQUEADAS POR CADA FALTANTE');
console.log('===============================================================');
const { normalizar } = await import('../../src/systems/Recursos.js');
const fuentes = { cana: 'caña colihue', arcilla: 'arcilla', arena: 'arena' };
// Se barre TODO el árbol de cada JSON buscando cualquier nodo con `materiales`,
// en vez de nombrar las listas a mano: la primera versión de esto miraba sólo
// `.recetas` y `.obras` y se perdía los hornos de `mineria.json`, o sea la
// carbonera y la fragua, que son justo las dos que piden arcilla. Un banco que
// mide de menos es peor que no medir.
const recetasDe = (archivo) => {
  const salida = [];
  const mirar = (n) => {
    if (Array.isArray(n)) return n.forEach(mirar);
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n.materiales)) salida.push(n);
    Object.values(n).forEach(mirar);
  };
  mirar(leer(archivo));
  return salida.map(r => ({ r, archivo }));
};
const todas = [...recetasDe('construccion.json'), ...recetasDe('mineria.json'),
               ...recetasDe('historia.json')];
console.log(`(${todas.length} recetas con materiales en los tres datasets)`);
for (const [falta, nombre] of Object.entries(fuentes)) {
  const golpeadas = todas
    .filter(({ r }) => r.materiales.some(m => normalizar(m.recurso) === falta))
    .map(({ r, archivo }) => `${r.nombre || r.id} [${archivo.replace('.json', '')}]`);
  console.log(`\n── sin ${nombre}: ${golpeadas.length} recetas bloqueadas`);
  if (golpeadas.length) console.log(`   ${golpeadas.join(' · ')}`);
}
console.log('');
