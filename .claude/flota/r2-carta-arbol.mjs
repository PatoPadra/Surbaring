/**
 * Banco del árbol de tecnologías — que la ruta que se le muestra al jugador sea
 * cierta, y que ningún enlace apunte al vacío.
 *
 * Importa el `Codice` y los `Saberes` de verdad. Al Códice se le arma una
 * instancia con `Object.create(Codice.prototype)` —el constructor arma el panel
 * y acá no hay DOM— pero las funciones que se prueban son las reales:
 * `_indiceSaberes`, `_rutaHacia`, `_panelRuta` y `_pintarSaberes`, que sólo
 * arman texto.
 *
 * Lo que se comprueba es lo que no se ve leyendo: que el dataset no tenga
 * ciclos —uno solo colgaría el panel entero al abrirlo—, que la ruta esté en un
 * orden que se pueda ejecutar de arriba a abajo, que no repita ni pida lo ya
 * aprendido, y que **cada nombre en el que se puede hacer clic tenga a dónde
 * llevar**.
 *
 *   node .claude/flota/r2-carta-arbol.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const historia = JSON.parse(readFileSync(join(RAIZ, 'src/data/historia.json'), 'utf8'));

const { Codice } = await import('../../src/ui/Codice.js');
const { Saberes } = await import('../../src/systems/Saberes.js');

let fallos = 0;
const ok = (c, t, e = '') => { console.log(`  ${c ? '✓' : '✗'} ${t} ${e}`); if (!c) fallos++; };

/** Un bolso con lo que se le pida, o vacío. Cambia qué ruta sale. */
const bolso = (stock = {}) => ({ disponiblePara: k => stock[k] ?? 0 });

function armarCodice(saberes, inventario) {
  const c = Object.create(Codice.prototype);
  c.historia = historia;
  c.saberes = saberes;
  c.inventario = inventario;
  return c;
}

const tecs = historia.tecnologias || [];
const porId = new Map(tecs.map(t => [t.id, t]));

// ── 1. El dataset ──────────────────────────────────────────────────────────
console.log('\n1. El dataset');
console.log(`   ${tecs.length} tecnologías · ${(historia.eras || []).length} eras`);

const huerfanos = [];
for (const t of tecs) {
  for (const r of t.requiere || []) if (!porId.has(r)) huerfanos.push(`${t.id} → ${r}`);
}
ok(huerfanos.length === 0, 'ningún requisito apunta a una tecnología que no existe',
  huerfanos.length ? `(${huerfanos.join(', ')})` : '');

// Ciclos: si los hubiera, el recorrido en posorden del panel no terminaría.
const ciclos = [];
const estado = new Map();
const buscarCiclo = (id, pila) => {
  if (estado.get(id) === 'listo') return;
  if (pila.has(id)) { ciclos.push([...pila, id].join(' → ')); return; }
  pila.add(id);
  for (const r of porId.get(id)?.requiere || []) if (porId.has(r)) buscarCiclo(r, pila);
  pila.delete(id);
  estado.set(id, 'listo');
};
for (const t of tecs) buscarCiclo(t.id, new Set());
ok(ciclos.length === 0, 'no hay ciclos de dependencias', ciclos.length ? `(${ciclos[0]})` : '');

// ── 2. El índice inverso ───────────────────────────────────────────────────
console.log('\n2. El índice: quién abre a quién');
const cod = armarCodice(new Saberes(historia, bolso()), bolso());
const { abre, prof } = cod._indiceSaberes();

let flechas = 0, mal = 0;
for (const t of tecs) {
  for (const r of t.requiere || []) {
    flechas++;
    if (!(abre.get(r) || []).some(h => h.id === t.id)) mal++;
  }
}
ok(mal === 0, `el índice inverso es exacto`, `(${flechas} flechas, ${mal} mal)`);

const profs = [...prof.values()];
const reparto = {};
for (const p of profs) reparto[p] = (reparto[p] || 0) + 1;
console.log(`   profundidad máxima: ${Math.max(...profs)} eslabones`);
console.log(`   reparto por eslabón: ${Object.entries(reparto).map(([k, v]) => `${k}→${v}`).join(' · ')}`);
const masAbre = [...abre].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
console.log(`   las que más abren: ${masAbre.map(([k, v]) => `${porId.get(k).nombre} (${v.length})`).join(' · ')}`);

// ── 3. La ruta ─────────────────────────────────────────────────────────────
console.log('\n3. La ruta hacia cada tecnología, desde cero');

const S = new Saberes(historia, bolso());
const cod2 = armarCodice(S, bolso());
let peor = { pasos: 0 }, ordenMal = 0, duplicados = 0, faltaMeta = 0;

for (const t of tecs) {
  const r = cod2._rutaHacia(t);
  // Orden ejecutable: cuando toca un paso, sus requisitos ya pasaron.
  const hechos = new Set();
  for (const p of r.pasos) {
    for (const q of p.requiere || []) if (porId.has(q) && !hechos.has(q)) ordenMal++;
    hechos.add(p.id);
  }
  if (new Set(r.pasos.map(p => p.id)).size !== r.pasos.length) duplicados++;
  if (r.pasos[r.pasos.length - 1]?.id !== t.id) faltaMeta++;
  if (r.pasos.length > peor.pasos) peor = { pasos: r.pasos.length, tec: t, r };
}
ok(ordenMal === 0, 'toda ruta está en un orden que se puede ejecutar de arriba a abajo',
  `(${ordenMal} pasos fuera de orden)`);
ok(duplicados === 0, 'ninguna ruta repite una tecnología', '(las ramas que se cruzan se cuentan una vez)');
ok(faltaMeta === 0, 'la meta es siempre el último paso de su propia ruta');

console.log(`   la ruta más larga es "${peor.tec.nombre}": ${peor.pasos} pasos, `
  + `${peor.r.puntos} de saber, ${peor.r.materiales.length} materiales distintos`);
console.log(`     ${peor.r.pasos.map(p => p.nombre).join(' → ')}`);

// La ruta se acorta con lo aprendido: es la mitad que hace que sirva.
const antes = cod2._rutaHacia(peor.tec).pasos.length;
S.desbloqueadas.add(peor.r.pasos[0].id);
const despues = cod2._rutaHacia(peor.tec).pasos.length;
ok(despues === antes - 1, 'aprender un paso lo saca de la ruta',
  `(${antes} → ${despues})`);
S.desbloqueadas.clear();

// ── 4. El marcado: ningún enlace al vacío ──────────────────────────────────
console.log('\n4. El marcado que se pinta');

const t0 = process.hrtime.bigint();
const html = cod2._pintarSaberes();
const ms = Number(process.hrtime.bigint() - t0) / 1e6;

const ids = new Set([...html.matchAll(/id="sab-([^"]+)"/g)].map(m => m[1]));
const destinos = [...html.matchAll(/data-ir="([^"]+)"/g)].map(m => m[1]);
const rotos = destinos.filter(d => !ids.has(d));
ok(rotos.length === 0, `los ${destinos.length} enlaces tienen a dónde llevar`,
  rotos.length ? `(rotos: ${[...new Set(rotos)].join(', ')})` : `(${ids.size} fichas con ancla)`);
ok(ids.size === tecs.length, 'hay una ficha con ancla por tecnología', `(${ids.size} de ${tecs.length})`);

const rutas = (html.match(/<details class="sab-ruta">/g) || []).length;
console.log(`   ${rutas} paneles de ruta, ${destinos.length} enlaces, ${(html.length / 1024).toFixed(0)} KB de marcado`);
console.log(`   pintar la pestaña entera: ${ms.toFixed(1)} ms`);
ok(ms < 60, 'pintar la pestaña sigue siendo instantáneo', `(${ms.toFixed(1)} ms, y se pinta al cambiar de pestaña, no por cuadro)`);

// El filtro por texto sigue funcionando sobre lo nuevo: buscar un material
// ahora contesta "qué tecnologías lo necesitan", que antes no se podía preguntar.
const normaliza = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fichas = html.split('<div class="cx-saber').slice(1);
const conObsidiana = fichas.filter(f => normaliza(f).includes('obsidiana')).length;
ok(conObsidiana > 1, 'buscar un material encuentra las tecnologías que lo piden',
  `(obsidiana aparece en ${conObsidiana} fichas)`);

// ── 5. Con el bolso lleno cambia lo que dice ───────────────────────────────
console.log('\n5. La ruta mira el bolso de verdad');
const rico = armarCodice(new Saberes(historia, bolso()), bolso({ obsidiana: 99, piedra: 99, madera: 99, cuero: 99, fibra: 99 }));
const pobre = armarCodice(new Saberes(historia, bolso()), bolso());
const meta = peor.tec;
const faltaRico = rico._rutaHacia(meta).materiales.filter(m => !m.alcanza).length;
const faltaPobre = pobre._rutaHacia(meta).materiales.filter(m => !m.alcanza).length;
ok(faltaRico < faltaPobre, 'con material en el bolso falta menos',
  `(${faltaPobre} → ${faltaRico} materiales faltantes)`);

console.log(fallos ? `\n${fallos} comprobaciones FALLARON` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
