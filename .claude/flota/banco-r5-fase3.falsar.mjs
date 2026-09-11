/**
 * FALSADOR DEL BANCO DE LA FASE 3 — ronda 5.
 *
 * Mismo método que las fases 1 y 2, con los cuatro desenlaces: cada defecto
 * declara la aserción que TIENE que caer, y una sección roja por otra cosa se
 * informa como «lo vio por otro motivo», que no es prueba. Los defectos se
 * plantan agregando código al final de `Cuerpo.js`: se redefine el accesor o se
 * envuelve el método, así muerden sin conocer la forma interna del agente.
 *
 * Uso: node .claude/flota/banco-r5-fase3.falsar.mjs [id ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r5-fase3.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r5f3');
const BASE = process.env.BANCO_BASE || '14d7860';
const BORRAR = { recursive: true, force: true, maxRetries: 8, retryDelay: 250 };

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const secciones = new Map();
  let actual = null;
  for (const l of salida.split(/\r?\n/)) {
    const h = l.match(/^\s{2}(VERDE|ROJO )\s+ejercitó\s+\d+\s+(\d)\s·\s(.+)$/);
    if (h) { actual = { verde: h[1] === 'VERDE', checks: new Map() }; secciones.set(Number(h[2]), actual); continue; }
    const c = l.match(/^\s{9}(ok |MAL)\s{2}(.+)$/);
    if (c && actual) actual.checks.set(c[2].split('  [')[0], c[1] === 'ok ');
  }
  return { secciones, salida };
}

function copiarSrc(destino) {
  fs.rmSync(destino, BORRAR);
  fs.cpSync(path.join(RAIZ, 'src'), path.join(destino, 'src'), { recursive: true });
  return path.join(destino, 'src');
}
function srcDeBase(destino) {
  fs.rmSync(destino, BORRAR);
  fs.mkdirSync(destino, { recursive: true });
  // Sin tar: bajo Git Bash toma "C:" por un host remoto. El índice temporal, absoluto.
  execFileSync('git', [`--work-tree=${destino}`, 'checkout', BASE, '--', 'src'],
    { cwd: RAIZ, env: { ...process.env, GIT_INDEX_FILE: path.join(destino, '.idx') } });
  fs.rmSync(path.join(destino, '.idx'), { force: true });
  return path.join(destino, 'src');
}
function agregar(src, codigo) {
  const f = path.join(src, 'entities', 'Cuerpo.js');
  if (!fs.existsSync(f)) return 'no existe Cuerpo.js';
  fs.appendFileSync(f, `\n\n// ── DEFECTO PLANTADO POR EL FALSADOR ──\n${codigo}\n`);
  return null;
}
function importa(src) {
  const url = pathToFileURL(path.join(src, 'entities', 'Cuerpo.js')).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    `globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){}};globalThis.localStorage={getItem(){return null},setItem(){}};await import(${JSON.stringify(url)});`],
  { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
  return r.status === 0 ? null : `el módulo plantado no importa: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || ''}`;
}

/** Redefine el accesor `enMano` del prototipo conservando el original. */
const ACCESOR = `const __d = Object.getOwnPropertyDescriptor(Cuerpo.prototype, 'enMano');`;

const DEFECTOS = [
  { id: 'D0', base: true, que: 'el mundo real: src/ de antes de la fase, sin manos',
    espera: [[1, 'Cuerpo.manos son dos nudos']] },
  { id: 'D1', que: 'enMano no cuelga nada',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return this.__falso ?? null; }, set(v) { this.__falso = v; } });`),
    espera: [[1, 'con el hacha en la mano aparece geometría bajo la mano']] },
  { id: 'D2', que: 'la herramienta no se descuelga al vaciar la mano',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return __d.get.call(this); }, set(v) { if (v !== null && v !== undefined) __d.set.call(this, v); } });`),
    espera: [[1, 'con la mano vacía no queda nada colgado']] },
  { id: 'D3', que: 'el modelo se rehace en cada cambio y el grafo crece',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return __d.get.call(this); }, set(v) {
  __d.set.call(this, v);
  const m = this.manos?.[1];
  if (m && v) { const c = m.children[m.children.length - 1]; if (c) m.add(c.clone()); }
} });`),
    espera: [[1, 'el grafo de la mano no crece con los cambios']] },
  { id: 'D4', que: 'puntoDeMano devuelve un punto fijo que no sigue al cuerpo',
    plantar: (s) => agregar(s, `Cuerpo.prototype.puntoDeMano = function (salida = { x: 0, y: 0, z: 0 }) {
  if (typeof salida.set === 'function') salida.set(0, 1, 0); else { salida.x = 0; salida.y = 1; salida.z = 0; }
  return salida;
};`),
    espera: [[1, 'el punto de la mano cae sobre el cuerpo, a menos de 1,2 m del eje y a la altura del brazo']] },
  { id: 'D5', que: 'una herramienta se pasa de los 900 triángulos',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return __d.get.call(this); }, set(v) {
  __d.set.call(this, v);
  const m = this.manos?.[1];
  if (m && v && !this.__gorda) { this.__gorda = new THREE.Mesh(new THREE.SphereGeometry(0.1, 48, 48), new THREE.MeshStandardMaterial()); m.add(this.__gorda); }
} });`),
    espera: [[2, 'lasca_rodado: ≤ 900 triángulos']] },
  { id: 'D6', que: 'cada herramienta trae su propio material',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return __d.get.call(this); }, set(v) {
  __d.set.call(this, v);
  const m = this.manos?.[1];
  if (m && v) m.traverse((o) => { if (o.isMesh && o !== m) o.material = o.material.clone(); });
} });`),
    espera: [[2, 'las herramientas comparten tintas: menos materiales que objetos, y a lo sumo nueve']] },
  // La primera versión de este defecto desenganchaba la herramienta antes de
  // aplicar(), y el banco NO lo veía: el agente libera además el caché de
  // modelos, así que la geometría se liberaba igual. Ese plantado no era un
  // defecto. El defecto de verdad es que no se libere nada.
  // Dos versiones de este defecto NO se pudieron ver, y la razón es del banco:
  // el espía queda en la instancia de la geometría, así que se dispara aunque
  // se pise 'dispose' en el prototipo, y el agente libera además el caché. El
  // único plantado que muerde es un aplicar() que no reconstruye nada.
  // ZONA SIN FALSAR, declarada. Tres plantados no sirvieron y el motivo es del
  // banco: el espía de liberación queda en la INSTANCIA de la geometría, así que
  // se dispara aunque se pise 'dispose' en el prototipo; el agente libera además
  // el caché de modelos, así que desenganchar la herramienta tampoco la deja sin
  // liberar; y un aplicar() que no llama al original rompe la construcción entera
  // del cuerpo, con lo que la sección cae por otra cosa. Queda dicho: la aserción
  // de liberación de la sección 3 no está falsada.
  { id: 'D7', que: 'aplicar() no libera las geometrías (no se pudo plantar sin romper el cuerpo)',
    sinFalsar: 'el espía vive en la instancia y el caché se libera igual; un aplicar() vacío rompe la construcción',
    espera: [[3, 'aplicar() libera también las geometrías de la herramienta']] },
  { id: 'D8', que: 'al ahumador le falta el modelo',
    plantar: (s) => agregar(s, `${ACCESOR}
Object.defineProperty(Cuerpo.prototype, 'enMano', { configurable: true, get() { return __d.get.call(this); }, set(v) { __d.set.call(this, v === 'ahumador' ? null : v); } });`),
    espera: [[2, 'los 18 objetos de ranura mano tienen modelo']] },
];

const pedidos = process.argv.slice(2);
const lista = pedidos.length ? DEFECTOS.filter((d) => pedidos.includes(d.id)) : DEFECTOS;
console.log('FALSADOR · banco R5 fase 3\n');
fs.mkdirSync(TMP, { recursive: true });
const control = correrBanco(copiarSrc(path.join(TMP, 'control')));
console.log(`  control: ${control.secciones.size} secciones, rojas: ${[...control.secciones.entries()].filter(([, s]) => !s.verde).map(([n]) => n).join(', ') || 'ninguna'}`);
if (control.secciones.size === 0) { console.log(control.salida.slice(-1500)); process.exit(2); }

const cuenta = { 'lo vio': 0, 'lo vio por otro motivo': 0, 'NO lo vio': 0, 'no se pudo plantar': 0 };
for (const d of lista) {
  const dir = path.join(TMP, d.id);
  let src, falla = null;
  if (d.sinFalsar) falla = d.sinFalsar;
  else if (d.base) src = srcDeBase(dir);
  else if (!d.base) { src = copiarSrc(dir); falla = d.plantar(src); if (!falla) falla = importa(src); }
  let desenlace, detalle = '';
  if (falla) { desenlace = 'no se pudo plantar'; detalle = falla; }
  else {
    const r = correrBanco(src);
    const caidas = [], noCaidas = [];
    for (const [num, desc] of d.espera) {
      const enControl = control.secciones.get(num)?.checks.get(desc);
      const conDefecto = r.secciones.get(num)?.checks.get(desc);
      if (enControl !== true) { noCaidas.push(`[${num}] «${desc}» no estaba bien en el control (${enControl})`); continue; }
      if (conDefecto === false) caidas.push(`[${num}] ${desc}`);
      else noCaidas.push(`[${num}] «${desc}» ${conDefecto === undefined ? 'no se ejercitó' : 'siguió bien'}`);
    }
    const cambiaron = [...r.secciones.entries()].filter(([n, s]) => !s.verde && control.secciones.get(n)?.verde).map(([n]) => n);
    desenlace = noCaidas.length === 0 ? 'lo vio' : (cambiaron.length ? 'lo vio por otro motivo' : 'NO lo vio');
    detalle = [...caidas.map((x) => `cayó ${x}`), ...noCaidas.map((x) => `NO ${x}`), cambiaron.length ? `secciones rojas: ${cambiaron.join(', ')}` : ''].filter(Boolean).join(' · ');
  }
  cuenta[desenlace]++;
  const marca = { 'lo vio': 'lo vio               ', 'lo vio por otro motivo': 'LO VIO POR OTRO MOTIVO', 'NO lo vio': 'NO LO VIO             ', 'no se pudo plantar': 'no se pudo plantar    ' }[desenlace];
  console.log(`  ${marca}  ${d.id.padEnd(4)} ${d.que}`);
  if (desenlace !== 'lo vio' || process.env.FALSAR_DETALLE) console.log(`                          ${detalle}`);
}
console.log(`\n  ${cuenta['lo vio']} vistos · ${cuenta['lo vio por otro motivo']} por otro motivo · ${cuenta['NO lo vio']} puntos ciegos · ${cuenta['no se pudo plantar']} sin plantar, de ${lista.length}`);
if (!process.env.FALSAR_CONSERVAR) { try { fs.rmSync(TMP, BORRAR); } catch (e) { console.log(`  (no se pudo borrar: ${e.code})`); } }
process.exitCode = cuenta['lo vio'] === lista.length ? 0 : 1;
