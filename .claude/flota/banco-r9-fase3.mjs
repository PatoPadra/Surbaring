/**
 * BANCO DE LA FASE 3 (copa-b) — ronda 9.
 *
 * Lo escribe el JEFE contra el contrato de RONDA9.md, después de medir el defecto
 * a mano (una copia instrumentada de `construirPlanta` en el scratchpad, nunca en
 * el repo) y de diseñar y verificar el arreglo —geométricamente y mirándolo en el
 * navegador— antes de escribir este banco.
 *
 *   E1 · cada rama de una especie `copa_ancha` cae dentro de SU lóbulo asignado.
 *   E2 · las especies `retorcido`/`arbusto` no cambiaron.
 *   E3 · el modelo sigue siendo determinista (C7, ronda 8).
 *   E4 · el gancho de depuración no existe en ningún otro archivo.
 *   E5 · sin regresión: banco-r8-fase4.mjs y su falsador.
 *   E6 · arranque — vite build.
 *
 * El banco usa `globalThis.__vegDebugCopa`/`__vegDebugCopaLobulos` —los mismos
 * ganchos de sólo lectura que dejó el arreglo en `Vegetacion.js`— para leer las
 * ramas y los lóbulos QUE DE VERDAD CALCULÓ el código, en vez de reimplementar la
 * fórmula aparte (que se puede desincronizar de la real sin que nadie se entere).
 *
 * Uso: node .claude/flota/banco-r9-fase3.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}_${Math.random()}`;

const ESPECIES_COPA_ANCHA = ['coihue']; // únicas con alturaMaxM >= 18 en flora.json hoy
const ESPECIES_RETORCIDO = ['nire', 'maiten', 'lenga'];

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

// ── El mismo stub de <canvas> que ya usa banco-r8-fase4.mjs ─────────────────
function instalarDocumentoFalso() {
  const imagen = (w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) });
  const contexto = () => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'getImageData' || k === 'createImageData') return (a, b, w, h) => (typeof a === 'object' ? imagen(a.width, a.height) : imagen(w ?? a, h ?? b));
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
      if (k === 'canvas') return { width: 1, height: 1 };
      return () => {};
    },
    set(o, k, v) { o[k] = v; return true; },
  });
  const lienzo = () => ({ width: 1, height: 1, style: {}, getContext: () => contexto(), toDataURL: () => '', addEventListener() {} });
  globalThis.document = { createElement: lienzo, addEventListener() {}, body: { appendChild() {} } };
  globalThis.OffscreenCanvas ??= class { constructor(w, h) { Object.assign(this, lienzo(), { width: w, height: h }); } };
}

function flora() {
  return JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'flora.json'), 'utf8')).especies;
}

async function vegetacion() {
  instalarDocumentoFalso();
  try { return await import(urlDe('world/Vegetacion.js')); } catch (e) { return { _error: e }; }
}

/** Arma esp con el gancho de depuración prendido, y devuelve lo que registró. */
function armarConGancho(mod, esp) {
  globalThis.__vegDebugCopa = [];
  globalThis.__vegDebugCopaLobulos = new Map();
  const geo = mod.construirPlanta(esp);
  const ramas = globalThis.__vegDebugCopa;
  const lobulos = globalThis.__vegDebugCopaLobulos.get(esp.id) || null;
  delete globalThis.__vegDebugCopa;
  delete globalThis.__vegDebugCopaLobulos;
  return { geo, ramas, lobulos };
}

// ── 1 · E1, contención geométrica ───────────────────────────────────────────

async function contencion() {
  const s = seccion(1, 'E1 · cada rama de copa_ancha cae dentro de su lóbulo');
  const I = await vegetacion();
  if (I._error) { s.ok(false, 'Vegetacion.js carga en Node', I._error.message); s.felizQue = 'no carga'; return s; }
  const F = flora();

  for (const id of ESPECIES_COPA_ANCHA) {
    const esp = F.find((e) => e.id === id);
    if (!s.ok(!!esp, `${id} existe en flora.json`)) continue;
    const { ramas, lobulos } = armarConGancho(I, esp);
    s.ok(Array.isArray(lobulos) && lobulos.length > 0, `${id}: el gancho de lóbulos registró algo`, lobulos?.length);
    s.ok(Array.isArray(ramas) && ramas.length > 0, `${id}: el gancho de ramas registró algo`, ramas.length);
    if (!lobulos || !ramas.length) continue;

    let peor = 0, peorI = -1;
    for (const r of ramas) {
      const lob = lobulos[r.lobuloI];
      const dh = Math.hypot(r.tip.x - lob.x, r.tip.z - lob.z);
      const dv = Math.abs(r.tip.y - lob.y);
      const dNorm = Math.hypot(dh / lob.radioH, dv / lob.radioV);
      if (dNorm > peor) { peor = dNorm; peorI = r.ramaI; }
      s.ok(dNorm <= 1.0, `${id}: rama ${r.ramaI} cae dentro de su lóbulo (${r.lobuloI})`, dNorm.toFixed(3));
    }
    s.nota(`${id}: peor caso rama ${peorI} a ${peor.toFixed(3)}x el radio de su lóbulo`);
  }

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'alguna rama sigue asomando afuera de su lóbulo';
  return s;
}

// ── 2 · E2, retorcido/arbusto sin cambios ───────────────────────────────────

async function sinCambiosRetorcido() {
  const s = seccion(2, 'E2 · retorcido/arbusto no cambiaron');
  const I = await vegetacion();
  if (I._error) { s.ok(false, 'Vegetacion.js carga en Node'); s.felizQue = 'no carga'; return s; }
  const F = flora();
  // No hay una "base" guardada de antes del arreglo para comparar bytes (esta
  // fase no las tocó a propósito), así que lo que se puede afirmar desde acá es
  // que siguen sin usar el camino de lóbulos-primero: no dejan nada en el
  // gancho de copa_ancha, que es justo lo que las distingue del coihue.
  for (const id of ESPECIES_RETORCIDO) {
    const esp = F.find((e) => e.id === id);
    if (!s.ok(!!esp, `${id} existe en flora.json`)) continue;
    const { geo, lobulos } = armarConGancho(I, esp);
    s.ok(lobulos === null, `${id}: no pasa por el camino de lóbulos de copa_ancha`, lobulos);
    s.ok(!!geo?.attributes?.position?.count, `${id}: arma geometría igual`, geo?.attributes?.position?.count);
  }
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'una especie retorcido/arbusto pasó por el camino nuevo';
  return s;
}

// ── 3 · E3, determinismo ─────────────────────────────────────────────────────

async function determinismo() {
  const s = seccion(3, 'E3 · el modelo sigue siendo determinista (C7)');
  const I = await vegetacion();
  if (I._error) { s.ok(false, 'Vegetacion.js carga en Node'); s.felizQue = 'no carga'; return s; }
  const F = flora();
  const huella = (geo) => {
    const h = crypto.createHash('sha256');
    for (const n of ['position', 'normal', 'uv', 'color']) {
      const a = geo.getAttribute?.(n) || geo.attributes?.[n];
      if (a) h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    }
    if (geo.index) h.update(Buffer.from(geo.index.array.buffer, geo.index.array.byteOffset, geo.index.array.byteLength));
    return h.digest('hex');
  };
  for (const id of [...ESPECIES_COPA_ANCHA, ...ESPECIES_RETORCIDO]) {
    const esp = F.find((e) => e.id === id);
    if (!esp) continue;
    Math.random(); Math.random(); Math.random(); // mover el azar global entre medio, como C7 de la ronda 8
    const h1 = huella(I.construirPlanta(esp));
    Math.random();
    const h2 = huella(I.construirPlanta(esp));
    s.ok(h1 === h2, `${id}: misma geometría byte a byte en dos armadas`, h1 === h2 ? 'igual' : `${h1.slice(0, 8)} vs ${h2.slice(0, 8)}`);
  }
  const espA = F.find((e) => e.id === 'coihue'), espB = F.find((e) => e.id === 'nire');
  if (espA && espB) s.ok(huella(I.construirPlanta(espA)) !== huella(I.construirPlanta(espB)), 'coihue y ñire dan geometría distinta');

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'el modelo dejó de ser determinista';
  return s;
}

// ── 4 · E4, el gancho no se filtra a otro archivo ───────────────────────────

async function ganchoAislado() {
  const s = seccion(4, 'E4 · el gancho de depuración no existe en ningún otro archivo');
  const archivos = fs.readdirSync(path.join(SRC, 'world')).concat(fs.readdirSync(path.join(SRC, 'systems')).map((f) => path.join('..', 'systems', f)));
  let usosAjenos = 0;
  for (const rel of archivos) {
    const p = path.join(SRC, 'world', rel);
    if (rel.includes('Vegetacion.js') || !fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (/__vegDebugCopa/.test(t)) usosAjenos++;
  }
  s.ok(usosAjenos === 0, 'ningún otro archivo de src/world usa __vegDebugCopa*', usosAjenos);
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'el gancho se filtró a otro archivo';
  return s;
}

// ── 5 · E5, sin regresión ─────────────────────────────────────────────────────

async function regresion() {
  const s = seccion(5, 'E5 · sin regresión — banco-r8-fase4.mjs sigue verde');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const r = spawnSync(process.execPath, [path.join(AQUI, 'banco-r8-fase4.mjs')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SIN_BUILD: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/total (\d+)\/(\d+)/);
  s.ok(!!m && m[1] === m[2], 'banco-r8-fase4.mjs sigue en verde total', m ? `${m[1]}/${m[2]}` : salida.slice(-800));
  s.feliz = !!m && m[1] === m[2];
  s.felizQue = s.feliz ? '' : 'la fase 4 de la ronda 8 se puso roja';
  return s;
}

// ── 6 · E6, arranque ──────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(6, 'E6 · arranque — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { contencion, sinCambiosRetorcido, determinismo, ganchoAislado, regresion, arranque };

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

console.log(`\n  BANCO R9 · FASE 3 — copa-b (ramas del coihue)   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
