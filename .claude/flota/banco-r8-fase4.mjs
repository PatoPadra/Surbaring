/**
 * BANCO DE LA FASE 4 (copa) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes de que exista una
 * línea del agente.
 *
 *   1. EL HORNO — `tools/hornear-follaje.mjs` corre, da los mismos bytes dos veces,
 *      escribe las cuatro clases con su manifiesto, cada atlas cuadrado de 512 o
 *      1024, con cobertura de alfa de 0,18 o más en su ventana, que no se pierde en
 *      los mipmaps hasta 32 px (±30 %).
 *   2. LA HOJA — `hojaPx / pxPorMetro` a menos de 3 veces el largo real de la hoja
 *      (`hojaCm`), y `Vegetacion.js` dimensiona las tarjetas con `pxPorMetro`.
 *   3. CADA ESPECIE CON SU HOJA — `claseHojaDe` exportada, y lo que devuelve.
 *   4. SIN REGRESIÓN — la ronda 7 y las fases 1 a 3.
 *   5. ARRANQUE — `vite build`.
 *
 * El árbol en el juego (cobertura, puntitos sueltos, costo, compilar) lo mide la
 * mitad navegador, `banco-r8-fase4.navegador.js`, con sus umbrales.
 *
 * Uso: node .claude/flota/banco-r8-fase4.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const HORNO = path.join(SRC, '..', 'tools', 'hornear-follaje.mjs');
const SALIDA = path.join(SRC, '..', 'public', 'tex', 'follaje');
const { PNG } = (await import('pngjs')).default;
const CLASES = ['nothofagus', 'ancha', 'escama', 'aguja'];

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}
const hashCarpeta = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const h = crypto.createHash('sha256');
  for (const f of fs.readdirSync(dir).sort()) h.update(f).update(fs.readFileSync(path.join(dir, f)));
  return h.digest('hex');
};
const manifiesto = () => {
  const f = path.join(SALIDA, 'manifiesto.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
/** Las clases del manifiesto, vengan como lista o como objeto por id. */
const clasesDe = (man) => {
  const c = man?.clases;
  if (Array.isArray(c)) return c;
  if (c && typeof c === 'object') return Object.entries(c).map(([id, v]) => ({ id, ...v }));
  return [];
};

/** Cobertura de alfa (≥ 0,28, el corte del juego) en la ventana u < uMax, por nivel de una cadena 2×2. */
function coberturas(png, uMax, corte = 0.28) {
  let w = png.width, a = new Float32Array(w * w);
  for (let i = 0; i < w * w; i++) a[i] = png.data[i * 4 + 3] / 255;
  const niveles = [];
  while (w >= 32) {
    let pasa = 0, tot = 0;
    const umax = Math.floor(w * uMax);
    for (let y = 0; y < w; y++) for (let x = 0; x < umax; x++) { tot++; if (a[y * w + x] >= corte) pasa++; }
    niveles.push({ lado: w, cobertura: pasa / tot });
    const w2 = w / 2, b = new Float32Array(w2 * w2);
    for (let y = 0; y < w2; y++) for (let x = 0; x < w2; x++) b[y * w2 + x] = (a[2 * y * w + 2 * x] + a[2 * y * w + 2 * x + 1] + a[(2 * y + 1) * w + 2 * x] + a[(2 * y + 1) * w + 2 * x + 1]) / 4;
    a = b; w = w2;
  }
  return niveles;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL HORNO
// ═══════════════════════════════════════════════════════════════════════════

async function horno() {
  const s = seccion(1, 'EL HORNO — cuatro clases, bytes que repiten, y cobertura que no se pierde');
  if (!s.ok(fs.existsSync(HORNO), 'tools/hornear-follaje.mjs existe')) { s.felizQue = 'no hay horno'; return s; }
  const correr = () => spawnSync(process.execPath, [HORNO], { cwd: path.join(SRC, '..'), encoding: 'utf8', timeout: 900000 });
  const r1 = correr();
  s.ok(r1.status === 0, 'el horno corre y termina bien', r1.status === 0 ? '' : ((r1.stderr || '') + (r1.stdout || '')).slice(-600));
  const h1 = hashCarpeta(SALIDA);
  const r2 = correr();
  s.ok(r2.status === 0 && !!h1 && h1 === hashCarpeta(SALIDA), 'correrlo dos veces da los mismos bytes');
  const man = manifiesto();
  if (!s.ok(!!man, 'escribió public/tex/follaje/manifiesto.json')) return s;
  const clases = clasesDe(man);
  s.ok(CLASES.every((id) => clases.some((c) => c.id === id)), 'están las cuatro clases: nothofagus, ancha, escama, aguja', clases.map((c) => c.id).join(', '));
  let todas = true;
  for (const c of clases) {
    const campos = ['referencia', 'hojaCm', 'hojaPx', 'pxPorMetro', 'uMax'].every((k) => c[k] !== undefined && c[k] !== '');
    s.ok(campos && Array.isArray(c.hojaCm) && c.hojaCm.length === 2 && typeof c.referencia === 'string' && c.referencia.length > 20,
      `${c.id}: declara referencia, hojaCm [mín, máx], hojaPx, pxPorMetro y uMax`, JSON.stringify({ hojaCm: c.hojaCm, hojaPx: c.hojaPx, pxPorMetro: c.pxPorMetro, uMax: c.uMax }));
    const archivo = c.archivo || c.archivos?.albedo || c.albedo;
    const f = path.join(SALIDA, archivo || '__');
    if (!s.ok(fs.existsSync(f), `${c.id}: su atlas existe`, archivo)) { todas = false; continue; }
    const png = PNG.sync.read(fs.readFileSync(f));
    s.ok(png.width === png.height && [512, 1024].includes(png.width), `${c.id}: cuadrado de 512 o 1024`, `${png.width}×${png.height}`);
    const niv = coberturas(png, c.uMax ?? 1);
    const c0 = niv[0].cobertura;
    s.ok(c0 >= 0.18, `${c.id}: cobertura de alfa de 0,18 o más en su ventana`, c0.toFixed(3));
    const peor = Math.max(...niv.map((n) => Math.abs(n.cobertura / Math.max(c0, 1e-9) - 1)));
    s.ok(peor <= 0.30, `${c.id}: la cobertura no se pierde en los mipmaps hasta 32 px (±30 %)`, niv.map((n) => `${n.lado}:${n.cobertura.toFixed(3)}`).join(' '));
  }
  s.feliz = clases.length >= 4 && todas;
  s.felizQue = `${clases.length} clases`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA HOJA
// ═══════════════════════════════════════════════════════════════════════════

async function hoja() {
  const s = seccion(2, 'LA HOJA — de su tamaño, a menos de 3 veces el real');
  const man = manifiesto();
  if (!s.ok(!!man, 'hay manifiesto')) return s;
  for (const c of clasesDe(man)) {
    if (!Array.isArray(c.hojaCm) || !(c.pxPorMetro > 0) || !(c.hojaPx > 0)) { s.ok(false, `${c.id}: tiene hojaPx, pxPorMetro y hojaCm`); continue; }
    const cm = c.hojaPx / c.pxPorMetro * 100;
    const real = (c.hojaCm[0] + c.hojaCm[1]) / 2;
    s.ok(cm / real <= 3, `${c.id}: la hoja en el mundo mide menos de 3 veces la real`, `${cm.toFixed(1)} cm contra ${real.toFixed(1)} (×${(cm / real).toFixed(2)})`);
  }
  const v = fs.readFileSync(path.join(SRC, 'world', 'Vegetacion.js'), 'utf8');
  s.ok(/pxPorMetro/.test(v), 'Vegetacion.js dimensiona las tarjetas con pxPorMetro');
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · CADA ESPECIE CON SU HOJA
// ═══════════════════════════════════════════════════════════════════════════

async function clases() {
  const s = seccion(3, 'CADA ESPECIE CON SU HOJA — claseHojaDe');
  globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {} };
  let mod = null;
  try { mod = await import(pathToFileURL(path.join(SRC, 'world', 'Vegetacion.js')).href); } catch (e) { s.ok(false, 'Vegetacion.js carga en Node', e.message); return s; }
  if (!s.ok(typeof mod.claseHojaDe === 'function', 'Vegetacion.js exporta claseHojaDe')) return s;
  const flora = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'flora.json'), 'utf8')).especies;
  const esp = (id) => flora.find((e) => e.id === id);
  const espera = { coihue: 'nothofagus', lenga: 'nothofagus', nire: 'nothofagus', cipres_cordillera: 'escama', alerce: 'escama', pino_murrayana: 'aguja', maiten: 'ancha', canelo: 'ancha', laura: 'ancha' };
  for (const [id, clase] of Object.entries(espera)) {
    const e = esp(id);
    if (!e) { s.ok(false, `premisa: ${id} está en flora.json`); continue; }
    const r = mod.claseHojaDe(e);
    s.ok(r === clase, `${id} → ${clase}`, r);
  }
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · SIN REGRESIÓN  ·  5 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(4, 'SIN REGRESIÓN — la ronda 7 y las fases 1 a 3');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
  ];
  // La fase 3 mide capturas que saca el navegador: se corre sin la sección de imagen
  const f3 = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(AQUI, 'banco-r8-fase3.mjs')], { cwd: RAIZ, encoding: 'utf8', timeout: 1800000, env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: 'horno,terreno,piso,shader' } });
  const m3 = ((f3.stdout || '') + (f3.stderr || '')).match(/total (\d+)\/(\d+)/);
  s.ok(!!m3 && m3[1] === m3[2], 'banco-r8-fase3.mjs (sin la imagen) sigue verde', m3 ? `${m3[1]}/${m3[2]}` : '');
  let corrio = m3 ? 1 : 0;
  for (const [archivo, esperado] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], { cwd: RAIZ, encoding: 'utf8', timeout: 1800000, env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' } });
    const m = ((r.stdout || '') + (r.stderr || '')).match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : '');
  }
  s.feliz = corrio === otros.length + 1;
  s.felizQue = `corrieron ${corrio} de ${otros.length + 1}`;
  return s;
}

async function arranque() {
  const s = seccion(5, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : ((r.stdout || '') + (r.stderr || '')).slice(-1200));
  return s;
}

const SECCIONES = { horno, hoja, clases, regresion, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);
const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
  try { todas.push(await fn()); }
  catch (e) { todas.push({ num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }], feliz: false, felizQue: 'la sección tiró una excepción', notas: [] }); }
}
todas.sort((a, b) => a.num - b.num);
if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 4 — la copa   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
  let verdes = 0;
  for (const s of todas) {
    const verde = s.checks.every((c) => c.ok) && s.feliz;
    if (verde) verdes++;
    console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(3)}  ${s.num} · ${s.nombre}`);
    for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
    if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
    for (const n of s.notas) console.log(`         nota ${n}`);
  }
  console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
  console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
  process.exitCode = verdes === todas.length ? 0 : 1;
}
