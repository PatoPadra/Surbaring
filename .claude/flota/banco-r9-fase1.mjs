/**
 * BANCO DE LA FASE 1 (iconos) — ronda 9.
 *
 * Lo escribe el JEFE contra el contrato de RONDA9.md, antes de que el agente toque
 * `src/ui/Iconos.js`. Mide lo que un banco puede medir desde Node: la API externa no
 * cambia, la hoja pesa 132 kB o menos, se arma una sola vez y queda cacheada, el costo
 * de la primera vez no se dispara, el banco viejo de la ronda 6 sigue verde, y
 * `vite build` no rompe.
 *
 * Lo que este banco NO puede medir —que cada ícono se vea igual, sin sangrado de la
 * celda vecina— está en `banco-r9-fase1.navegador.js`, porque hace falta un navegador
 * de verdad decodificando el `data:image/svg+xml`.
 *
 * Uso: node .claude/flota/banco-r9-fase1.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}_${Math.random()}`;

const TECHO_KB = 132;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

async function iconos() {
  try { return await import(urlDe('ui/Iconos.js')); } catch (e) { return { _error: e }; }
}

// ── 1 · MISMA API ────────────────────────────────────────────────────────────

async function mismaApi() {
  const s = seccion(1, 'MISMA API — nada de afuera se entera');
  const I = await iconos();
  if (I._error) { s.ok(false, 'src/ui/Iconos.js importa sin explotar', I._error.message); s.felizQue = 'el módulo no carga'; return s; }
  s.ok(true, 'src/ui/Iconos.js importa sin explotar');

  s.ok(typeof I.hoja === 'function', 'exporta hoja()');
  s.ok(typeof I.inyectar === 'function', 'exporta inyectar()');
  s.ok(typeof I.arteDe === 'function', 'exporta arteDe()');
  s.ok(typeof I.claseDe === 'function', 'exporta claseDe()');
  s.ok(Array.isArray(I.IDS) && I.IDS.length >= 100, 'IDS es una lista con los íconos (>=100)', I.IDS?.length);
  s.ok(typeof I.CLASE_BASE === 'string', 'exporta CLASE_BASE');
  s.ok(typeof I.CLASE_RESERVA === 'string', 'exporta CLASE_RESERVA');
  s.ok(typeof I.MATERIAS === 'object' && I.MATERIAS, 'exporta MATERIAS');

  if (I.IDS?.length && typeof I.hoja === 'function') {
    const id = I.IDS[0];
    const clase = I.claseDe(id);
    const tokens = typeof clase === 'string' ? clase.split(/\s+/).filter(Boolean) : [];
    const propio = tokens.find((t) => t !== I.CLASE_BASE);
    s.ok(tokens.includes(I.CLASE_BASE), `claseDe(${id}) trae la clase base exacta`, clase);
    s.ok(!!propio, `claseDe(${id}) trae además una clase propia del ícono`, clase);

    const claseInexistente = I.claseDe('__no_existe_seguro__');
    const tokensInex = typeof claseInexistente === 'string' ? claseInexistente.split(/\s+/).filter(Boolean) : [];
    s.ok(tokensInex.includes(I.CLASE_BASE) && tokensInex.includes(I.CLASE_RESERVA),
      'claseDe(id inexistente) trae la clase base y CLASE_RESERVA exactas', claseInexistente);

    // Que la clase propia esté REALMENTE cableada a una regla en la hoja, y no sea
    // un nombre que claseDe() inventa sin que hoja() lo sirva.
    if (propio) {
      const css = I.hoja();
      const escapado = propio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cableado = new RegExp(`\\.${escapado}(?![\\w-])[^}]*\\{`).test(css);
      s.ok(cableado, `la clase "${propio}" tiene su propia regla dentro de hoja()`, cableado);
    }
  }

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'algo de la API cambió';
  return s;
}

// ── 2 · LA HOJA PESA 132 kB O MENOS ─────────────────────────────────────────

async function pesoDeLaHoja() {
  const s = seccion(2, `LA HOJA — ${TECHO_KB} kB o menos`);
  const I = await iconos();
  if (I._error || typeof I.hoja !== 'function') { s.ok(false, 'hoja() existe'); s.felizQue = 'no hay hoja() para medir'; return s; }
  const css = I.hoja();
  s.ok(typeof css === 'string' && css.length > 1000, 'hoja() devuelve un string no vacío', css?.length);
  const kB = Buffer.byteLength(css, 'utf8') / 1024;
  s.ok(kB <= TECHO_KB, `la hoja pesa ${TECHO_KB} kB o menos`, `${kB.toFixed(2)} kB`);
  s.ok(kB <= 140, 'sigue cumpliendo el techo viejo de 140 kB (banco-r6-fase3)', `${kB.toFixed(2)} kB`);
  s.nota(`hoja: ${kB.toFixed(2)} kB para ${I.IDS?.length ?? '?'} íconos`);
  s.feliz = kB <= TECHO_KB;
  s.felizQue = s.feliz ? '' : `pesa ${kB.toFixed(2)} kB, más de ${TECHO_KB}`;
  return s;
}

// ── 3 · SE ARMA UNA SOLA VEZ ─────────────────────────────────────────────────

async function cacheada() {
  const s = seccion(3, 'SE ARMA UNA SOLA VEZ Y QUEDA CACHEADA');
  const I = await iconos();
  if (I._error || typeof I.hoja !== 'function') { s.ok(false, 'hoja() existe'); s.felizQue = 'no hay hoja() para medir'; return s; }
  const a = I.hoja();
  const b = I.hoja();
  s.ok(a === b, 'dos llamadas a hoja() devuelven el mismo string (identidad)', a === b ? 'idéntico' : 'distinto');

  // inyectar() sólo debe poner el <style> una vez.
  if (typeof I.inyectar === 'function' && typeof document !== 'undefined') {
    const doc = document;
    const primera = I.inyectar(doc);
    const segunda = I.inyectar(doc);
    s.ok(primera === true, 'la primera inyección pone el <style>', primera);
    s.ok(segunda === false, 'la segunda inyección no hace nada', segunda);
  } else {
    s.nota('inyectar() no se probó: no hay `document` en este Node (se prueba en el navegador aparte)');
  }

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'la hoja se reconstruye o se inyecta más de una vez';
  return s;
}

// ── 4 · EL COSTO DE LA PRIMERA VEZ NO SE DISPARA ────────────────────────────

async function costo() {
  const s = seccion(4, 'EL COSTO DE ARMARLA LA PRIMERA VEZ NO SE DISPARA');
  // Módulo fresco (query string distinta) para medir el primer hoja() de verdad.
  const I = await iconos();
  if (I._error || typeof I.hoja !== 'function') { s.ok(false, 'hoja() existe'); s.felizQue = 'no hay hoja() para medir'; return s; }
  const t0 = performance.now();
  I.hoja();
  const ms = performance.now() - t0;
  // La ronda 6 lo describió como "unos pocos milisegundos". 60 ms es una cota floja
  // a propósito: este banco corre en CI variable y sólo tiene que cazar un
  // desperfecto grande (por ejemplo, rehacer el layout de la grilla en cada ícono).
  s.ok(ms < 60, 'arma la hoja la primera vez en menos de 60 ms', `${ms.toFixed(2)} ms`);
  s.nota(`primera armada: ${ms.toFixed(2)} ms`);
  s.feliz = ms < 60;
  s.felizQue = s.feliz ? '' : `tardó ${ms.toFixed(2)} ms`;
  return s;
}

// ── 5 · SIN REGRESIÓN ────────────────────────────────────────────────────────

async function regresion() {
  const s = seccion(5, 'SIN REGRESIÓN — banco-r6-fase3.mjs sigue verde');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const r = spawnSync(process.execPath, [path.join(AQUI, 'banco-r6-fase3.mjs')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SIN_BUILD: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/total (\d+)\/(\d+)/);
  s.ok(!!m && m[1] === m[2], 'banco-r6-fase3.mjs sigue en verde total', m ? `${m[1]}/${m[2]}` : salida.slice(-500));
  s.feliz = !!m && m[1] === m[2];
  s.felizQue = s.feliz ? '' : 'el banco de la ronda 6 se puso rojo';
  return s;
}

// ── 6 · ARRANQUE ─────────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(6, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { mismaApi, pesoDeLaHoja, cacheada, costo, regresion, arranque };

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({
      num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`,
      checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }],
      feliz: false, felizQue: 'la sección tiró una excepción', notas: [],
    });
  }
}
todas.sort((a, b) => a.num - b.num);

if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every(s => s.feliz && s.checks.every(c => c.ok)) ? 0 : 1;
} else {

console.log(`\n  BANCO R9 · FASE 1 — iconos (empaquetado)   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
let verdes = 0;
for (const s of todas) {
  const verde = s.checks.every((c) => c.ok) && s.feliz;
  if (verde) verdes++;
  console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(2)}  ${s.num} · ${s.nombre}`);
  for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
  if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
  for (const n of s.notas) console.log(`         nota ${n}`);
}
console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
process.exitCode = verdes === todas.length ? 0 : 1;

}
