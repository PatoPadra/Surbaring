/**
 * FALSADOR DE LA FASE 3c (sombras del terreno), mitad Node — ronda 8.
 *
 * Planta en una copia de `src/` los arreglos mal hechos de «la normal del vértice del
 * terreno no puede ser cero», corre la sección 1 del banco (EL VÉRTICE) y la 3
 * (lint-shader) contra la copia, y mira que caiga la aserción. Los defectos valen para
 * los dos arreglos posibles —poner la normal en el atributo, o armar `objectNormal` en
 * el vértice—: primero deshacen el que haya y después plantan el suyo. Trae controles
 * con las dos formas correctas.
 *
 * Uso: node .claude/flota/banco-r8-fase3c.falsar.mjs [--fuente <Terreno.js>] [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f3c');
const BANCO = path.join(AQUI, 'banco-r8-fase3c.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FUENTE = arg('--fuente') ? path.resolve(arg('--fuente')) : path.join(RAIZ, 'src', 'world', 'Terreno.js');
const SOLO = arg('--solo');

// La línea del atributo normal, sea cual sea su forma, y cualquier objectNormal armado a mano
const ATRIBUTO = /geo\.setAttribute\(\s*'normal'[^;]*;/;
const OBJ_NORMAL = /vec3\s+objectNormal\s*=\s*[^;]+;/g;
const CERO = "geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3).fill(0), 3));";
const ARRIBA = "geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));";
/** Deshace cualquiera de los dos arreglos: el atributo en cero y el vértice leyéndolo. */
function deshacer(t) {
  if (!ATRIBUTO.test(t)) throw new Error('no encuentro geo.setAttribute(\'normal\', …)');
  return t.replace(ATRIBUTO, CERO).replace(OBJ_NORMAL, '#include <beginnormal_vertex>');
}
/**
 * Pone en el vértice del material de color, EN LUGAR de <beginnormal_vertex>, lo que se
 * le pase. Tiene que ser en ese lugar y no más abajo: `objectNormal` se usa en
 * <defaultnormal_vertex>, antes de <begin_vertex> (meshphysical.glsl.js:33-40).
 * El material de color es el último `onBeforeCompile` del archivo (el primero es el de
 * la profundidad, que no hace el sesgo de la sombra: eso lo hace quien la recibe).
 */
function enElVertice(t, glsl) {
  const ancla = 'mat.onBeforeCompile = (shader) => {';
  const i = t.lastIndexOf(ancla);
  if (i < 0) throw new Error('no encuentro el onBeforeCompile del material');
  const j = i + ancla.length;
  return `${t.slice(0, j)}\n      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '${glsl}');${t.slice(j)}`;
}

const DEFECTOS = [
  ['atributo-en-cero', 'se deshace el arreglo: el atributo en cero y el vértice leyéndolo', (t) => deshacer(t), ['no es cero']],
  ['objectNormal-cero', 'el vértice arma objectNormal, pero en cero', (t) => enElVertice(deshacer(t), 'vec3 objectNormal = vec3(0.0);'), ['no es cero']],
  ['un-solo-vertice', 'el atributo arriba sólo en el primer vértice', (t) => deshacer(t).replace(CERO,
    "geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3).map((_, i) => (i === 1 ? 1 : 0)), 3));"), ['no es cero']],
  ['solo-en-comentario', 'el arreglo quedó comentado', (t) => deshacer(t).replace(CERO, `// ${ARRIBA}\n    ${CERO}`), ['no es cero']],
];
const CONTROLES = [
  ['atributo-arriba', 'el atributo en (0, 1, 0) en todos los vértices', (t) => deshacer(t).replace(CERO, ARRIBA)],
  ['vertice-arriba', 'el vértice arma objectNormal = (0, 1, 0) sin leer el atributo', (t) => enElVertice(deshacer(t), 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')],
];

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
function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: 'vertice,shader', BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const linea = (r.stdout || '').trim().split('\n').filter((l) => l.startsWith('[')).pop();
  try { return JSON.parse(linea); } catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => res.error ? [`(no corrió: ${res.error.slice(-200)})`] : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`]));

const limpio = fs.readFileSync(FUENTE, 'utf8');
console.log(`\n  FALSADOR R8 · FASE 3c, mitad Node   (fuente: ${path.relative(RAIZ, FUENTE)} · copias en ${path.relative(RAIZ, TMP)})`);
if (process.argv.includes('--sintaxis')) {
  for (const [id, , plantar] of [...DEFECTOS, ...CONTROLES]) { try { plantar(limpio); console.log(`  se planta  ${id}`); } catch (e) { console.log(`  NO se planta ${id}: ${e.message}`); } }
  process.exit(0);
}
const base = caidas(correrBanco(copia(limpio)));
if (base.length) { console.log(`  ROJO  la fuente limpia tiene ${base.length} aserciones caídas:\n${base.map((c) => `          ${c}`).join('\n')}`); process.exit(1); }
console.log('  fuente limpia: todas verdes');
let vio = 0, otro = 0, nunca = 0, sinPlantar = 0, ok = 0, mal = 0;
for (const [id, que, plantar, esperadas] of DEFECTOS) {
  if (SOLO && SOLO !== id) continue;
  let texto;
  try { texto = plantar(limpio); } catch (e) { sinPlantar++; console.log(`  NO SE PLANTÓ        ${id.padEnd(22)} ${e.message}`); continue; }
  const c = caidas(correrBanco(copia(texto)));
  const dio = esperadas.every((e) => c.some((x) => x.includes(e)));
  if (dio) vio++; else if (c.length) otro++; else nunca++;
  console.log(`  ${dio ? 'LO VIO           ' : c.length ? 'POR OTRO MOTIVO  ' : 'NO LO VIO        '}   ${id.padEnd(22)} ${que}`);
  if (c.length) console.log(`                      cayó «${c[0]}»${c.length > 1 ? ` (y ${c.length - 1} más)` : ''}`);
}
for (const [id, que, plantar] of CONTROLES) {
  if (SOLO && SOLO !== id) continue;
  const c = caidas(correrBanco(copia(plantar(limpio))));
  if (c.length) mal++; else ok++;
  console.log(`  ${c.length ? 'CONTROL ROJO     ' : 'CONTROL VERDE    '}   ${id.padEnd(22)} ${que}`);
  if (c.length) console.log(`                      el banco fija de más, cayó: ${c.join(' · ')}`);
}
const total = DEFECTOS.filter(([id]) => !SOLO || SOLO === id).length;
const verde = vio === total && mal === 0;
console.log(`  ${verde ? 'VERDE' : 'ROJO '}  lo vio ${vio}/${total}  ·  por otro motivo ${otro}  ·  NO lo vio ${nunca}  ·  no se pudo plantar ${sinPlantar}  ·  controles ${ok} verdes, ${mal} rojos\n`);
process.exitCode = verde ? 0 : 1;
