/**
 * FALSADOR DE LA FASE 3 (copa-b) — ronda 9.
 *
 * Copia `src/` a una carpeta aparte, planta un defecto a la vez sobre
 * `src/world/Vegetacion.js`, corre `banco-r9-fase3.mjs` contra la copia
 * (`BANCO_SRC=<copia>`, `BANCO_SIN_BUILD=1`) y mira que caiga la sección que
 * tiene que caer. Trae controles: cambios inocentes que el banco tiene que
 * dejar pasar.
 *
 * Uso: node .claude/flota/banco-r9-fase3.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r9f3');
const BANCO = path.join(AQUI, 'banco-r9-fase3.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SOLO = arg('--solo');

function limpiarTmp() {
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 }); }
  catch (e) { console.log(`  (no se pudo limpiar ${TMP}: ${e.message} — no es fatal)`); }
}

function copiarBase() {
  limpiarTmp();
  fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true, preserveTimestamps: true });
  return path.join(TMP, 'src');
}

function correrBanco(srcDir) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: srcDir, BANCO_SIN_BUILD: '1', BANCO_JSON: '1' },
  });
  const m = (r.stdout || '').match(/@@RESULTADO (.+)/);
  if (!m) return { secciones: [], crudo: (r.stdout || '') + (r.stderr || '') };
  return { secciones: JSON.parse(m[1]) };
}

function estadoDe(secciones) {
  return secciones.map((s) => ({ num: s.num, nombre: s.nombre, verde: s.feliz && s.checks.every((c) => c.ok) }));
}

function mutarArchivo(srcDir, relativo, transformar) {
  const archivo = path.join(srcDir, relativo);
  const original = fs.readFileSync(archivo, 'utf8');
  const nuevo = transformar(original);
  if (nuevo === original) throw new Error(`la mutación en ${relativo} no cambió nada — el patrón no matcheó`);
  fs.writeFileSync(archivo, nuevo);
}

const DEFECTOS = [
  {
    id: 'insercion-radioH-solo', seccion: 1, que: 'insercion vuelve a usar sólo radioH (el borde que ya rozó 1,001x)',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'world/Vegetacion.js', (t) => {
      const vieja = 'const insercion = Math.min(lob.radioH, lob.radioV) * (0.35 + azar() * 0.25);';
      if (!t.includes(vieja)) throw new Error('no encuentro la línea de insercion corregida');
      return t.replace(vieja, 'const insercion = lob.radioH * (0.35 + azar() * 0.25);');
    }),
  },
  {
    id: 'ramas-antes-de-lobulos', seccion: 1, que: 'las ramas vuelven a apuntar a un ángulo suelto en vez de a un lóbulo',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'world/Vegetacion.js', (t) => {
      const vieja = 'if (lobulosCopaAncha) {';
      if (!t.includes(vieja)) throw new Error('no encuentro el camino de lobulosCopaAncha en la rama');
      // Fuerza el camino "else" (ángulo suelto) para TODOS los arquetipos, como
      // era antes del arreglo — sin tocar la construcción de lobulosCopaAncha,
      // así el follaje sigue existiendo pero las ramas dejan de apuntarle.
      return t.replace(vieja, 'if (false && lobulosCopaAncha) {');
    }),
  },
  {
    id: 'gancho-en-otro-archivo', seccion: 4, que: 'el gancho de depuración se copia a otro archivo de src/world',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'world/Sotobosque.js', (t) => t + '\n// __vegDebugCopa de control (no funcional, sólo para que el banco lo vea)\n'),
  },
];

const CONTROLES = [
  { id: 'control-comentario', que: 'un comentario más en Vegetacion.js, nada más',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'world/Vegetacion.js', (t) => t + '\n// Comentario de control del falsador.\n') },
  { id: 'control-nota-interna', que: 'una constante sin usar, nada más',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'world/Vegetacion.js', (t) => t.replace('const cumbre = alturaTronco;', 'const cumbre = alturaTronco;\nconst __NOTA_CONTROL = true;')) },
];

function aplicarYProbar(caso) {
  const srcDir = copiarBase();
  caso.aplicar(srcDir);
  const { secciones, crudo } = correrBanco(srcDir);
  if (!secciones.length) throw new Error(`el banco no produjo @@RESULTADO: ${crudo?.slice(-500)}`);
  return estadoDe(secciones);
}

console.log('\n  FALSADOR R9 · FASE 3 — copa-b\n');
let vistos = 0, total = 0;

// Sección 5 (regresión, banco-r8-fase4) y 6 (build) se saltan contra la copia
// (BANCO_SRC las salta solas); se ignoran acá para el veredicto de los controles.
const IGNORAR = new Set([5, 6]);

for (const d of DEFECTOS) {
  if (SOLO && d.id !== SOLO) continue;
  total++;
  try {
    const estados = aplicarYProbar(d);
    const cayo = estados.find((e) => e.num === d.seccion && !e.verde);
    const visto = !!cayo;
    if (visto) vistos++;
    console.log(`  ${visto ? 'VISTO ' : 'CIEGO '} ${d.id.padEnd(28)} ${d.que}`);
    if (!visto) console.log(`         esperaba rojo en sección ${d.seccion}, dio: ${JSON.stringify(estados)}`);
  } catch (e) {
    console.log(`  ERROR  ${d.id.padEnd(28)} ${e.message}`);
  }
}

let controlesOk = 0;
for (const c of CONTROLES) {
  if (SOLO && c.id !== SOLO) continue;
  total++;
  try {
    const estados = aplicarYProbar(c);
    const relevantes = estados.filter((e) => !IGNORAR.has(e.num));
    const todoVerde = relevantes.every((e) => e.verde);
    if (todoVerde) controlesOk++;
    console.log(`  ${todoVerde ? 'OK    ' : 'FALSO+'} ${c.id.padEnd(28)} ${c.que}`);
    if (!todoVerde) console.log(`         un control inocente puso algo en rojo: ${JSON.stringify(relevantes.filter((e) => !e.verde))}`);
  } catch (e) {
    console.log(`  ERROR  ${c.id.padEnd(28)} ${e.message}`);
  }
}

limpiarTmp();

console.log(`\n  defectos vistos: ${vistos}/${DEFECTOS.length}   controles limpios: ${controlesOk}/${CONTROLES.length}\n`);
process.exitCode = (vistos === DEFECTOS.length && controlesOk === CONTROLES.length) ? 0 : 1;
