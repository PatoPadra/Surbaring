/**
 * Chequeo de integridad del área `juego`, para correr al integrar los tres frentes.
 *
 * Existe por una trampa que ya costó una sesión entera y está anotada en
 * CONTEXTO.md: un shader mal cerrado o un JSON roto **no lanza un error que se
 * entienda**, tumba el arranque del juego y deja a todos los agentes sin poder
 * verificar nada. Con tres frentes escribiendo en paralelo sobre el mismo árbol,
 * hace falta un semáforo que corra en dos segundos y sin navegador.
 *
 * Comprueba tres cosas, en orden de qué tan barato es que fallen:
 *   1. Todos los `src/data/*.json` parsean.
 *   2. Todos los módulos del área importan (o sea, no hay literal sin cerrar
 *      ni import roto).
 *   3. Todo `recurso` nombrado en los datos existe en `RECURSOS`. Un recurso
 *      fantasma no da error: da una receta que nunca se puede completar, que es
 *      justo la clase de defecto que este proyecto viene arrastrando.
 *
 * Uso:  node .claude/flota/r2-juego-integridad.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let fallas = 0;
const mal = (m) => { fallas++; console.log(`  ✗ ${m}`); };
const bien = (m) => console.log(`  ✓ ${m}`);

// ── 1. Los datos parsean ────────────────────────────────────────────────────
console.log('\n1. src/data/*.json');
const datos = {};
for (const f of readdirSync(resolve(raiz, 'src/data')).filter(f => f.endsWith('.json'))) {
  try {
    datos[f.replace('.json', '')] = JSON.parse(readFileSync(resolve(raiz, 'src/data', f), 'utf8'));
    bien(f);
  } catch (e) { mal(`${f}: ${e.message}`); }
}

// ── 2. Los módulos importan ─────────────────────────────────────────────────
// `src/main.js` queda afuera a propósito: Node le pide una aserción de tipo a
// los `import ... .json` que Vite no necesita, y da un falso positivo conocido.
console.log('\n2. módulos del área');
const modulos = [
  ...readdirSync(resolve(raiz, 'src/systems')).filter(f => f.endsWith('.js')).map(f => `src/systems/${f}`),
  ...readdirSync(resolve(raiz, 'src/ui')).filter(f => f.endsWith('.js')).map(f => `src/ui/${f}`),
  'src/world/Hornos.js', 'src/world/Obras.js',
];
for (const m of modulos) {
  try {
    await import(new URL(`file:///${resolve(raiz, m).replace(/\\/g, '/')}`));
    bien(m);
  } catch (e) {
    // Los módulos que tocan `three` o el DOM fallan por dependencia, no por
    // sintaxis, y eso no es lo que estamos buscando acá.
    const porDependencia = /Cannot find package|is not defined|Cannot find module/.test(e.message);
    if (porDependencia) console.log(`  · ${m} (no evaluable en Node: ${e.message.split('\n')[0].slice(0, 48)})`);
    else mal(`${m}: ${e.message.split('\n')[0]}`);
  }
}

// ── 3. Ningún recurso fantasma ──────────────────────────────────────────────
// Ojo con la trampa: un material **pedido** por una tecnología y que no existe
// NO es un defecto. `Recursos.js` lo dice con todas las letras: el árbol de
// saberes llega hasta el reactor nuclear y pide 56 materiales que ninguna planta
// puede dar, y `tieneFuente()` los declara imposibles con honestidad. Eso es
// contenido.
//
// El defecto de verdad es el otro: un recurso que el juego **te entrega** —el
// `rinde` de una carroña, de un yacimiento, de una hornada— y que no tiene ficha
// en `RECURSOS`. Ése entra al bolso pesando los 0,5 kg de omisión de `pesoDe()`,
// sin categoría, así que no es alimento ni material: no se come, no se guarda
// bien y no se lista donde debería. No da error en ningún lado.
console.log('\n3. recursos que el juego ENTREGA y no tienen ficha');
let RECURSOS = null, OBTENIBLES = null;
try {
  ({ RECURSOS, OBTENIBLES } = await import(new URL(`file:///${resolve(raiz, 'src/systems/Recursos.js').replace(/\\/g, '/')}`)));
} catch (e) { mal(`no se pudo leer Recursos.js: ${e.message.split('\n')[0]}`); }

if (RECURSOS) {
  const fichados = new Set(Object.keys(RECURSOS));
  const entregados = new Map();   // recurso -> dónde apareció
  const pedidos = new Set();
  // `rinde` y `sale` son lo que el mundo da; `materiales` es lo que pide
  const mirar = (nodo, ruta, dando) => {
    if (Array.isArray(nodo)) return nodo.forEach((v, i) => mirar(v, `${ruta}[${i}]`, dando));
    if (!nodo || typeof nodo !== 'object') return;
    for (const [k, v] of Object.entries(nodo)) {
      const da = dando || k === 'rinde' || k === 'sale' || k === 'produce';
      if (k === 'recurso' && typeof v === 'string') {
        if (dando) { if (!fichados.has(v) && !entregados.has(v)) entregados.set(v, ruta); }
        else if (!OBTENIBLES.has(v)) pedidos.add(v);
      }
      mirar(v, `${ruta}.${k}`, da);
    }
  };
  for (const [nombre, d] of Object.entries(datos)) mirar(d, nombre, false);
  if (!entregados.size) bien(`ninguno · ${fichados.size} recursos fichados`);
  else for (const [r, donde] of entregados) mal(`«${r}» se entrega en ${donde} y no está en RECURSOS`);
  console.log(`  · ${pedidos.size} materiales pedidos sin fuente en el mundo (por diseño: el árbol llega al reactor nuclear)`);
}

console.log(`\n${fallas ? `${fallas} FALLA(S)` : 'todo en orden'}\n`);
process.exit(fallas ? 1 : 0);
