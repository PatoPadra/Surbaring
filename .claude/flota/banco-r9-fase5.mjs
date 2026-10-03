/**
 * BANCO DE LA FASE 5 (dormir-b) — ronda 9, mitad Node.
 *
 * Lo que dormir hace se mide en el juego real, con `banco-r9-fase5.navegador.js`
 * (N1 a N6): `puedeDormir`/`dormir` son funciones locales de `main.js` y viven
 * del cierre de ese archivo. Esta mitad mide sólo lo que no necesita el juego:
 *
 *   M1 · el umbral de sed no está escrito dos veces: `main.js` no tiene el
 *        literal 92 (la regla «con sed, beber» vive en `Recoleccion.js`).
 *   M2 · `main.js` ya no despierta a una hora fija: no queda `setUTCHours(10`.
 *   M3 · sin regresión: `banco-r9-fase4c.mjs` (el otro gancho de `main.js` de
 *        esta ronda) sigue en verde.
 *   M4 · arranque — `vite build` limpio.
 *
 * Uso: node .claude/flota/banco-r9-fase5.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');

const resultados = [];
const ok = (id, cond, desc, det = '') => resultados.push({ id, ok: !!cond, desc, det: String(det) });

const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');
const sinComentarios = main.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// M1
const noventaYDos = sinComentarios.match(/(?<![\w.])92(?![\w.])/g) || [];
ok('M1', noventaYDos.length === 0, 'main.js no repite el umbral de sed (92)', `${noventaYDos.length} apariciones fuera de comentarios`);

// M2
ok('M2', !/setUTCHours\(\s*10\b/.test(sinComentarios), 'main.js no despierta a las 7:00 fijas (setUTCHours(10…))');

// M3
{
  const r = spawnSync(process.execPath, [path.join(AQUI, 'banco-r9-fase4c.mjs')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, env: { ...process.env, BANCO_SRC: SRC },
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  const m = salida.match(/total\s+(\d+)\/(\d+)/);
  ok('M3', r.status === 0 && m && m[1] === m[2], 'banco-r9-fase4c.mjs sigue en verde', m ? `${m[1]}/${m[2]}` : salida.slice(-400));
}

// M4
if (process.env.BANCO_SIN_BUILD) {
  ok('M4', true, 'vite build (salteado por BANCO_SIN_BUILD)');
} else {
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  ok('M4', r.status === 0 && /built in/.test(salida), 'vite build limpio', r.status === 0 ? 'ok' : salida.slice(-600));
}

for (const r of resultados) console.log(`  ${r.ok ? 'VERDE' : 'ROJO '}  ${r.id} · ${r.desc}${r.det ? ' — ' + r.det : ''}`);
const verdes = resultados.filter(r => r.ok).length;
console.log(`\n  ${verdes === resultados.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${resultados.length}`);
process.exit(verdes === resultados.length ? 0 : 1);
