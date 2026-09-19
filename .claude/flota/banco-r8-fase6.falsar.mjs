/**
 * FALSADOR DE LA FASE 6 (luz de luna), mitad Node — ronda 8.
 *
 * Planta en una copia de `src/` los defectos de «la luna con la ley de Allen» y corre las
 * secciones 1 a 3 del banco (la ley, la noche, el cielo) y la 5 (lint). Los defectos se
 * plantan AGREGANDO código al final de `Cielo.js` —envolviendo `brilloLunar` o los métodos
 * de la clase—, así no dependen de cómo lo escriba el agente. Trae controles.
 *
 * Uso: node .claude/flota/banco-r8-fase6.falsar.mjs [--fuente <Cielo.js>] [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f6');
const BANCO = path.join(AQUI, 'banco-r8-fase6.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FUENTE = arg('--fuente') ? path.resolve(arg('--fuente')) : path.join(RAIZ, 'src', 'world', 'Cielo.js');
const SOLO = arg('--solo');

/** Renombra brilloLunar y exporta una envoltura. */
function envolverLey(t, cuerpo) {
  const re = /export\s+function\s+brilloLunar\s*\(/;
  if (!re.test(t)) throw new Error('no encuentro export function brilloLunar');
  return t.replace(re, 'function brilloLunar__orig(') + `\nexport function brilloLunar(a) {\n${cuerpo}\n}\n`;
}
/** Envuelve un método de la clase Cielo, agregando código al final del archivo. */
const envolverMetodo = (metodo, despues) => (t) => {
  if (!/export\s+class\s+Cielo\b/.test(t)) throw new Error('no encuentro export class Cielo');
  return `${t}\n;{ const __m = Cielo.prototype.${metodo}; Cielo.prototype.${metodo} = function (...a) { const r = __m.apply(this, a); ${despues} return r; }; }\n`;
};
const NOCHE = 'const __noche = this.direccionSol.y < -0.1 ? 1 : 0;';

const DEFECTOS = [
  ['ley-fraccion', 'brilloLunar devuelve la fracción iluminada', (t) => envolverLey(t, '  return (1 + Math.cos(a * Math.PI / 180)) / 2;'), ['brilloLunar(90°)']],
  ['ley-sin-cuartica', 'sin el término de cuarto grado', (t) => envolverLey(t, '  return Math.pow(10, -0.4 * 0.026 * a);'), ['brilloLunar(135°)']],
  ['ley-en-radianes', 'el ángulo en radianes', (t) => envolverLey(t, '  return brilloLunar__orig(a * Math.PI / 180);'), ['brilloLunar(90°)']],
  ['llena-oscura', 'toda la ley multiplicada por 0,8', (t) => envolverLey(t, '  return 0.8 * brilloLunar__orig(a);'), ['brilloLunar(0°)', 'la llena alumbra como hoy']],
  ['ambiente-con-fraccion', 'el ambiente de la noche suma otra vez la fracción',
    envolverMetodo('actualizar', `${NOCHE} this.luzAmbiente.intensity += __noche * 0.09 * Math.max(0, this.direccionLuna.y) * this.uniformes.uFaseLunar.value;`), ['el ambiente: cada noche con luna']],
  ['niebla-con-fraccion', 'la niebla de la noche suma otra vez la fracción',
    envolverMetodo('colorNiebla', `${NOCHE} r.b += __noche * 0.045 * Math.max(0, this.direccionLuna.y) * this.uniformes.uFaseLunar.value;`), ['la niebla: cada noche con luna']],
  ['sin-luna-cambia', 'la noche sin luna queda un 5 % más clara',
    envolverMetodo('actualizar', `${NOCHE} if (__noche && this.direccionLuna.y < -0.05) this.luzAmbiente.intensity *= 1.05;`), ['la noche sin luna no cambia']],
  ['halo-con-fraccion', 'el halo vuelve a crecer con la fracción', (t) => {
    const re = /(haloLuna\s*\*[^;\n]*?)\*\s*noche/;
    if (!re.test(t)) throw new Error('no encuentro la línea del halo');
    return t.replace(re, '$1* noche * (0.5 + 0.5 * uFaseLunar)');
  }, ['ningún otro uso de uFaseLunar']],
];
const CONTROLES = [
  ['control-magnitudes', 'la ley escrita en magnitudes, que es lo mismo', (t) => envolverLey(t, '  const m = 0.026 * a + 4e-9 * a * a * a * a; return Math.pow(10, -m / 2.5);')],
  ['control-comentario', 'un comentario más', (t) => `${t}\n// Comentario de control del falsador.\n`],
  ['control-envoltura', 'actualizar envuelto sin cambiar nada', envolverMetodo('actualizar', '')],
];

let copiado = false;
function copia(texto) {
  if (!copiado) {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true, preserveTimestamps: true });
    copiado = true;
  }
  fs.writeFileSync(path.join(TMP, 'src', 'world', 'Cielo.js'), texto);
  return path.join(TMP, 'src');
}
function correrBanco(src) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: 'ley,noche,cielo,shader', BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULTADO '));
  try { return JSON.parse(linea.slice('@@RESULTADO '.length)); } catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => res.error ? [`(no corrió: ${res.error.slice(-300)})`] : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`]));

const limpio = fs.readFileSync(FUENTE, 'utf8');
console.log(`\n  FALSADOR R8 · FASE 6, mitad Node   (fuente: ${path.relative(RAIZ, FUENTE)} · copias en ${path.relative(RAIZ, TMP)})`);
if (process.argv.includes('--sintaxis')) {
  for (const [id, , plantar] of [...DEFECTOS, ...CONTROLES]) { try { plantar(limpio); console.log(`  se planta  ${id}`); } catch (e) { console.log(`  NO se planta ${id}: ${e.message}`); } }
  process.exit(0);
}
const base = caidas(correrBanco(copia(limpio)));
if (base.length) { console.log(`  ROJO  la fuente limpia tiene ${base.length} aserciones caídas:\n${base.map((c) => `          ${c}`).join('\n')}`); process.exit(1); }
console.log('  fuente limpia: todas verdes');
let vio = 0, otro = 0, nunca = 0, sin = 0, ok = 0, mal = 0;
for (const [id, que, plantar, esperadas] of DEFECTOS) {
  if (SOLO && SOLO !== id) continue;
  let texto;
  try { texto = plantar(limpio); } catch (e) { sin++; console.log(`  NO SE PLANTÓ        ${id.padEnd(22)} ${e.message}`); continue; }
  const c = caidas(correrBanco(copia(texto)));
  const dio = esperadas.every((e) => c.some((x) => x.includes(e)));
  if (dio) vio++; else if (c.length) otro++; else nunca++;
  console.log(`  ${dio ? 'LO VIO           ' : c.length ? 'POR OTRO MOTIVO  ' : 'NO LO VIO        '}   ${id.padEnd(22)} ${que}`);
  if (c.length) console.log(`                      cayó «${c.find((x) => esperadas.some((e) => x.includes(e))) || c[0]}»${c.length > 1 ? ` (y ${c.length - 1} más)` : ''}`);
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
console.log(`  ${verde ? 'VERDE' : 'ROJO '}  lo vio ${vio}/${total}  ·  por otro motivo ${otro}  ·  NO lo vio ${nunca}  ·  no se pudo plantar ${sin}  ·  controles ${ok} verdes, ${mal} rojos\n`);
process.exitCode = verde ? 0 : 1;
