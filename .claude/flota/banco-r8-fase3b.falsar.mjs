/**
 * FALSADOR DE LA FASE 3b (luz), mitad Node — ronda 8.
 *
 * Planta en una copia de `src/` los arreglos mal hechos que se pueden escribir para
 * «la normal al marco de la cámara», corre la sección 1 del banco (EL MARCO) y la 4
 * (lint-shader) contra la copia, y mira que caiga la aserción que tiene que caer. Trae
 * también controles: formas correctas y distintas de escribir lo mismo, que el banco
 * tiene que dejar pasar.
 *
 * La mitad navegador (el giro, la vuelta) no se falsa desde acá: se validó contra el
 * código sin arreglo, que da rojo por el motivo correcto (RONDA8.md, fase 3b).
 *
 * Uso: node .claude/flota/banco-r8-fase3b.falsar.mjs
 *        [--fuente <Terreno.js>]  planta sobre ese archivo en vez del de src (para
 *                                 validar el falsador antes de que exista el arreglo)
 *        [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f3b');
const BANCO = path.join(AQUI, 'banco-r8-fase3b.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FUENTE = arg('--fuente') ? path.resolve(arg('--fuente')) : path.join(RAIZ, 'src', 'world', 'Terreno.js');
const SOLO = arg('--solo');

const LINEA = /[ \t]*normal\s*=\s*normalize\s*\(\s*(?:\(\s*viewMatrix\s*\*\s*vec4\s*\(\s*normal\s*,\s*0(?:\.0*)?\s*\)\s*\)\s*\.xyz|mat3\s*\(\s*viewMatrix\s*\)\s*\*\s*normal|normalMatrix\s*\*\s*normal)\s*\)\s*;[^\n]*\n/;
const reemplazarLinea = (t, nueva) => {
  if (!LINEA.test(t)) throw new Error('no encuentro el pasaje al marco de la cámara');
  return t.replace(LINEA, nueva);
};
const uno = (t, a, b) => {
  if (t.split(a).length !== 2) throw new Error(`no encuentro una sola vez: ${a.slice(0, 50)}`);
  return t.replace(a, b);
};
const IND = '        ';

/** [id, qué, plantar(texto) → texto, aserciones que tienen que caer (subcadenas)] */
const DEFECTOS = [
  ['sin-arreglo', 'no se pasa la normal al marco de la cámara', (t) => reemplazarLinea(t, ''), ['una sola vez']],
  ['dos-veces', 'se pasa dos veces', (t) => t.replace(LINEA, (m) => m + m), ['una sola vez']],
  ['al-reves', 'vector × matriz: el giro al revés', (t) => reemplazarLinea(t, `${IND}normal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);\n`), ['una sola vez', 'dada vuelta']],
  ['traspuesta', 'la traspuesta de la matriz', (t) => reemplazarLinea(t, `${IND}normal = normalize(transpose(mat3(viewMatrix)) * normal);\n`), ['una sola vez', 'dada vuelta']],
  ['antes-del-relieve', 'se pasa antes del relieve, que sigue en el marco del mundo',
    (t) => uno(reemplazarLinea(t, ''), 'vec3 normal = gNormalDEM;', `vec3 normal = gNormalDEM;\n${IND}normal = normalize((viewMatrix * vec4(normal, 0.0)).xyz);`), ['después de todo el relieve']],
  ['sin-relieve', 'la normal sale de una constante y no del DEM', (t) => uno(t, 'vec3 normal = gNormalDEM;', 'vec3 normal = vec3(0.0, 1.0, 0.0);'), ['sale del DEM']],
  ['solo-comentario', 'el arreglo quedó comentado', (t) => t.replace(LINEA, (m) => m.replace(/^([ \t]*)/, '$1// ')), ['una sola vez']],
  ['en-el-color', 'se pasa el DEM al marco de la cámara en la sección del color',
    (t) => uno(reemplazarLinea(t, ''), 'gNormalDEM = nrm;', 'gNormalDEM = normalize((viewMatrix * vec4(nrm, 0.0)).xyz);'), ['una sola vez', 'ningún otro trozo']],
  ['algo-entre-medio', 'después del pasaje se la inclina otra vez, en el marco del mundo',
    (t) => t.replace(LINEA, (m) => `${m}${IND}normal = normalize(normal + vec3(0.0, 0.0, 0.2));\n`), ['sin nada entre medio']],
  // Era un control y el banco la aceptaba: normalMatrix no existe en el fragmento
  // (WebGLProgram.js:666 contra :828) y el terreno no compilaría. Lo vio el agente.
  ['normalMatrix-en-fragmento', 'normalMatrix × normal, que en el fragmento no está declarada',
    (t) => reemplazarLinea(t, `${IND}normal = normalize(normalMatrix * normal);\n`), ['una sola vez']],
];
const CONTROLES = [
  ['forma-mat3', 'mat3(viewMatrix) × normal, que es lo mismo', (t) => reemplazarLinea(t, `${IND}normal = normalize(mat3(viewMatrix) * normal);\n`)],
  ['forma-vec4', '(viewMatrix × vec4(normal, 0)).xyz, que es lo mismo', (t) => reemplazarLinea(t, `${IND}normal = normalize((viewMatrix * vec4(normal, 0.0)).xyz);\n`)],
  ['comentario-de-mas', 'un comentario que nombra la cuenta', (t) => t.replace(LINEA, (m) => `${IND}// (viewMatrix * vec4(normal, 0.0)).xyz: al marco de la cámara\n${m}`)],
];

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: 'marco,shader', BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); }
  catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => res.error ? [`(no corrió: ${res.error.slice(-200)})`] : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`]));

// La copia de src se hace una vez: en Windows, borrar y volver a copiar el árbol en
// cada defecto choca con quien tenga la carpeta abierta (ENOTEMPTY). Sólo cambia
// Terreno.js, y ése se reescribe entero cada vez.
let copiado = false;
function copia(texto) {
  if (!copiado) {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true, preserveTimestamps: true });
    copiado = true;
  }
  fs.writeFileSync(path.join(TMP, 'src', 'world', 'Terreno.js'), texto);
  return path.join(TMP, 'src');
}

const limpio = fs.readFileSync(FUENTE, 'utf8');
console.log(`\n  FALSADOR R8 · FASE 3b, mitad Node   (fuente: ${path.relative(RAIZ, FUENTE)} · copias en ${path.relative(RAIZ, TMP)})`);
if (process.argv.includes('--sintaxis')) {
  for (const [id, , plantar] of [...DEFECTOS, ...CONTROLES]) { try { plantar(limpio); console.log(`  se planta  ${id}`); } catch (e) { console.log(`  NO se planta ${id}: ${e.message}`); } }
  process.exit(0);
}
const base = caidas(correrBanco(copia(limpio)));
if (base.length) {
  console.log(`  ROJO  la fuente limpia tiene ${base.length} aserciones caídas:\n${base.map((c) => `          ${c}`).join('\n')}`);
  process.exit(1);
}
console.log('  fuente limpia: todas verdes');
let vio = 0, otro = 0, nunca = 0, sinPlantar = 0, ctlVerdes = 0, ctlRojos = 0;
for (const [id, que, plantar, esperadas] of DEFECTOS) {
  if (SOLO && SOLO !== id) continue;
  let texto;
  try { texto = plantar(limpio); } catch (e) { sinPlantar++; console.log(`  NO SE PLANTÓ        ${id.padEnd(24)} ${e.message}`); continue; }
  const c = caidas(correrBanco(copia(texto)));
  const dio = esperadas.every((e) => c.some((x) => x.includes(e)));
  if (dio) vio++; else if (c.length) otro++; else nunca++;
  console.log(`  ${dio ? 'LO VIO           ' : c.length ? 'POR OTRO MOTIVO  ' : 'NO LO VIO        '}   ${id.padEnd(24)} ${que}`);
  if (c.length) console.log(`                      cayó «${c[0]}»${c.length > 1 ? ` (y ${c.length - 1} más)` : ''}`);
}
for (const [id, que, plantar] of CONTROLES) {
  if (SOLO && SOLO !== id) continue;
  const c = caidas(correrBanco(copia(plantar(limpio))));
  if (c.length) ctlRojos++; else ctlVerdes++;
  console.log(`  ${c.length ? 'CONTROL ROJO     ' : 'CONTROL VERDE    '}   ${id.padEnd(24)} ${que}`);
  if (c.length) console.log(`                      el banco fija de más, cayó: ${c.join(' · ')}`);
}
const total = DEFECTOS.filter(([id]) => !SOLO || SOLO === id).length;
const verde = vio === total && ctlRojos === 0;
console.log(`  ${verde ? 'VERDE' : 'ROJO '}  lo vio ${vio}/${total}  ·  por otro motivo ${otro}  ·  NO lo vio ${nunca}  ·  no se pudo plantar ${sinPlantar}  ·  controles ${ctlVerdes} verdes, ${ctlRojos} rojos`);
console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = verde ? 0 : 1;
