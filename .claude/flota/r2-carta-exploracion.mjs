/**
 * Banco de Exploración — el conteo O(1), el testigo de versión y la
 * persistencia, contra el módulo de verdad.
 *
 * Importa `src/systems/Exploracion.js` tal cual y le pone un `localStorage` de
 * mentira. Lo que se comprueba es lo que no se ve leyendo: que el contador que
 * reemplazó al recorrido de 65.536 celdas dé exactamente lo mismo, que la
 * versión suba también cuando una celda se **afina** (y no sólo cuando se
 * descubre), y que una caminata corta —de las que el umbral de 400 celdas de
 * `main.js` nunca alcanzaba a guardar— ahora sobreviva a cerrar la pestaña.
 *
 *   node .claude/flota/r2-carta-exploracion.mjs
 */

const guardado = new Map();
globalThis.localStorage = {
  getItem: k => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, v),
  removeItem: k => guardado.delete(k),
};
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');

const { Exploracion } = await import('../../src/systems/Exploracion.js');

// Un relieve sintético alcanza: lo que se mide acá es contabilidad, no terreno.
const mundo = {
  tamano: 65536, mitad: 32768,
  alturaEn: (x, z) => 800 + Math.sin(x / 3000) * 300 + Math.cos(z / 2500) * 250,
};
const CLARO = { densidadNiebla: 0.00003, horaDecimal: 13 };

let fallos = 0;
const ok = (c, t, e = '') => { console.log(`  ${c ? '✓' : '✗'} ${t} ${e}`); if (!c) fallos++; };
/** El recorrido que el getter hacía antes. Es contra esto que se compara. */
const bruto = e => { let n = 0; for (const v of e.conocido) if (v > 0) n++; return n; };

console.log('\n1. El contador que reemplazó al recorrido de 65.536 celdas');
const e = new Exploracion(mundo);
ok(e._conocidas === 0 && e.fraccionExplorada === 0, 'arranca en blanco');

const v0 = e.version;
for (let i = 0; i < 60; i++) {
  e.revisar({
    x: -20000 + i * 500,
    z: -8000 + Math.sin(i / 4) * 4000,
    y: 900 + (i % 7) * 90,
  }, CLARO, 0.5);
}
ok(e._conocidas === bruto(e), 'coincide exactamente con recorrer las 65.536',
  `(${e._conocidas} vs ${bruto(e)})`);
ok(e.version > v0, 'la versión subió con la caminata', `(${v0} → ${e.version})`);
ok(e._sucio === true, 'queda marcado como sin guardar');
const frac = e.fraccionExplorada;
console.log(`     explorado: ${(frac * 100).toFixed(2)} % del parque en 60 muestreos`);

console.log('\n2. Afinar no descubre, pero repinta');
const antesN = e._conocidas, antesV = e.version;
const mirador = { x: -5000, z: -8000, y: 2400 };
e.revisar(mirador, CLARO, 0.5);
e.revisar(mirador, CLARO, 0.5);
ok(e.version > antesV, 'afinar celdas ya vistas también sube la versión',
  `(${antesV} → ${e.version}; sin esto el velo no se repinta al acercarse)`);
ok(e._conocidas >= antesN && e._conocidas === bruto(e),
  'y el conteo sigue cuadrando', `(${e._conocidas})`);

console.log('\n3. La vuelta por el almacenamiento');
e.guardar();
ok(e._sucio === false, 'guardar limpia la marca de sucio');
const e2 = new Exploracion(mundo);
let iguales = true;
for (let k = 0; k < e.conocido.length; k++) {
  if (e.conocido[k] !== e2.conocido[k]) { iguales = false; break; }
}
ok(iguales, 'la grilla vuelve idéntica, celda por celda');
ok(e2._conocidas === e._conocidas && e2._conocidas === bruto(e2),
  'el conteo se reconstruye al cargar', `(${e2._conocidas})`);
ok(e2.fraccionExplorada === e.fraccionExplorada, 'la fracción sobrevive a la recarga');

console.log('\n4. El defecto que motivó el arreglo: la caminata corta');
guardado.clear();
const e3 = new Exploracion(mundo);
e3.revisar({ x: 1000, z: 1000, y: 850 }, CLARO, 0.5);
const pocas = e3._conocidas;
ok(pocas > 0 && pocas < 400, 'descubre menos de 400 celdas',
  `(${pocas} — el umbral de main.js nunca la habría guardado)`);
e3.guardarSiHaceFalta();
const e4 = new Exploracion(mundo);
ok(e4._conocidas === pocas, 'y ahora sobrevive a cerrar la pestaña', `(${e4._conocidas})`);

console.log('\n5. Olvidar');
e4.olvidar();
ok(e4._conocidas === 0 && e4.fraccionExplorada === 0 && bruto(e4) === 0,
  'olvidar deja todo en cero, contador incluido');

console.log(fallos ? `\n${fallos} comprobaciones FALLARON` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
