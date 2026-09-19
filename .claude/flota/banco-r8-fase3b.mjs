/**
 * BANCO DE LA FASE 3b (luz) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes de que exista una línea
 * del agente. El defecto: el terreno arma su normal en el marco del mundo y three la
 * ilumina en el de la cámara (Terreno.js, el reemplazo de <normal_fragment_begin>).
 *
 *   1. EL MARCO — en el reemplazo de <normal_fragment_begin>, la normal sale del DEM,
 *      recibe todo su relieve en el marco del mundo, y pasa al de la cámara UNA vez,
 *      con la matriz derecha y no su traspuesta, justo antes de nonPerturbedNormal.
 *      Los comentarios no cuentan.
 *   2. LA IMAGEN — las capturas de la fase 3 sacadas con el arreglo (`r8-f3b-*`,
 *      semillas fijas), más nuevas que el código: mirando al frente (−8°), donde el
 *      defecto pesaba poco, el brillo de la franja cercana y de la del medio queda a
 *      ±15 % del de antes del arreglo (`r8-f3`, las mismas semillas); mirando al suelo
 *      se informa. Y la guarda de la fase 3 sigue: la textura queda a ±10 % de la
 *      paleta calibrada sola, ahora con la luz bien puesta.
 *   3. SIN REGRESIÓN — la ronda 7, las fases 1 y 2, y la fase 3 contra las capturas
 *      nuevas (sin su propia regresión, que es ésta).
 *   4. EL SHADER — lint-shader sin errores.
 *   5. ARRANQUE — vite build.
 *
 * Lo que sólo se ve en la placa (el giro, la vuelta, compilar, el costo) lo mide
 * `banco-r8-fase3b.navegador.js`.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase3b.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES,
 *      BANCO_F3B_PREFIJO (por omisión r8-f3b), BANCO_F3B_ANTES (por omisión r8-f3)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const PREFIJO = process.env.BANCO_F3B_PREFIJO || 'r8-f3b';
const ANTES = process.env.BANCO_F3B_ANTES || 'r8-f3';
const LUGARES = ['bosque', 'estepa', 'pedregal'];

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** GLSL sin comentarios de línea ni de bloque. */
const sinComentarios = (g) => g.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

/**
 * Las formas aceptadas de pasar la normal al marco de la cámara. Todas son la misma
 * cuenta: la parte de giro de viewMatrix por la normal. `normalMatrix` también vale,
 * porque el terreno no tiene transformación propia (su modelMatrix es la identidad).
 */
const A_VISTA = new RegExp([
  String.raw`normal\s*=\s*normalize\s*\(\s*\(\s*viewMatrix\s*\*\s*vec4\s*\(\s*normal\s*,\s*0(?:\.0*)?\s*\)\s*\)\s*\.xyz\s*\)\s*;`,
  String.raw`normal\s*=\s*normalize\s*\(\s*mat3\s*\(\s*viewMatrix\s*\)\s*\*\s*normal\s*\)\s*;`,
  String.raw`normal\s*=\s*normalize\s*\(\s*normalMatrix\s*\*\s*normal\s*\)\s*;`,
].join('|'), 'g');

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL MARCO
// ═══════════════════════════════════════════════════════════════════════════

function marco() {
  const s = seccion(1, 'EL MARCO — la normal del terreno se ilumina en el marco de la cámara');
  const fuente = fs.readFileSync(path.join(SRC, 'world', 'Terreno.js'), 'utf8');
  const i0 = fuente.indexOf("'#include <normal_fragment_begin>'");
  const ini = i0 < 0 ? -1 : fuente.indexOf('`', i0);
  const fin = ini < 0 ? -1 : fuente.indexOf('`', ini + 1);
  if (!s.ok(i0 > 0 && fin > ini, 'premisa: Terreno.js reemplaza <normal_fragment_begin>')) return s;
  const g = sinComentarios(fuente.slice(ini + 1, fin));

  s.ok(/vec3\s+normal\s*=\s*gNormalDEM\s*;/.test(g), 'la normal sale del DEM (gNormalDEM), no de una constante');
  // El relieve: cada bloque que inclina la normal en el marco del mundo
  const relieve = [...g.matchAll(/normal\s*=\s*normalize\s*\(\s*normal\s*(?:\*\s*nz\s*)?\+/g)].map((m) => m.index);
  s.ok(relieve.length >= 4, 'el relieve sigue: el DEM fino, f2, f3 y la normal horneada inclinan la normal', `${relieve.length} bloques`);

  const aVista = [...g.matchAll(A_VISTA)].map((m) => m.index);
  s.ok(aVista.length === 1, 'la normal pasa al marco de la cámara una sola vez', `${aVista.length} veces`);
  const npn = g.search(/vec3\s+nonPerturbedNormal\s*=\s*normal\s*;/);
  if (aVista.length === 1) {
    const p = aVista[0];
    s.ok(relieve.every((i) => i < p), 'y después de todo el relieve, que está escrito en el marco del mundo', `pasa en ${p}; el último relieve en ${Math.max(...relieve)}`);
    const entre = npn > p ? g.slice(p, npn).replace(A_VISTA, '') : '';
    s.ok(npn > p && !/\bnormal\s*[+\-*/]?=/.test(entre), 'y antes de nonPerturbedNormal, sin nada entre medio que la toque', npn > p ? JSON.stringify(entre.trim().slice(0, 80)) : 'nonPerturbedNormal viene antes');
  }
  // v * M es la traspuesta: con una matriz de giro, el giro al revés
  s.ok(!/vec4\s*\(\s*normal[^;]*\)\s*\*\s*viewMatrix/.test(g) && !/(transpose|inverse)\s*\(\s*(mat3\s*\(\s*)?viewMatrix/.test(g),
    'la matriz no está dada vuelta (ni vector × matriz, ni traspuesta, ni inversa)');
  // Y fuera de este trozo, nadie más la lleva al marco de la cámara por su cuenta
  const resto = sinComentarios(fuente.slice(0, ini) + fuente.slice(fin));
  s.ok(!/viewMatrix\s*\*\s*vec4\s*\(\s*(nrm|gNormalDEM|normal)\b/.test(resto), 'ningún otro trozo del shader pasa la normal del DEM al marco de la cámara');
  s.feliz = aVista.length === 1;
  s.felizQue = `${aVista.length} pasajes al marco de la cámara`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA IMAGEN
// ═══════════════════════════════════════════════════════════════════════════

async function imagen() {
  const s = seccion(2, 'LA IMAGEN — al frente casi no cambia, y la textura sigue sin aclarar lo calibrado');
  const { PNG } = (await import('pngjs')).default;
  const { detalleYBrillo } = await import(pathToFileURL(path.join(AQUI, 'r8-suelo-metricas.mjs')).href);
  const leer = (nombre) => {
    const f = path.join(RAIZ, 'capturas', `${nombre}.png`);
    if (!fs.existsSync(f)) return null;
    const png = PNG.sync.read(fs.readFileSync(f));
    const L = new Float32Array(png.width * png.height);
    for (let i = 0; i < L.length; i++) L[i] = 0.2126 * png.data[i * 4] + 0.7152 * png.data[i * 4 + 1] + 0.0722 * png.data[i * 4 + 2];
    return { W: png.width, H: png.height, L, mtime: fs.statSync(f).mtimeMs };
  };
  const tope = Math.max(...['Terreno.js', 'Sotobosque.js'].map((f) => path.join(SRC, 'world', f)).filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs));
  let medidas = 0;
  for (const id of LUGARES) {
    const nombres = { suelo: `sinpasto-suelo-${id}`, medio: `sinpasto-medio-${id}-a`, plano: `plano-sinpasto-suelo-${id}` };
    const d = {}, a = {};
    for (const [k, n] of Object.entries(nombres)) { d[k] = leer(`${PREFIJO}-${n}`); a[k] = leer(`${ANTES}-${n}`); }
    if (!s.ok(Object.values(d).every(Boolean) && Object.values(a).every(Boolean), `${id}: están las capturas de después (${PREFIJO}) y de antes (${ANTES})`)) continue;
    s.ok(Object.values(d).every((x) => x.mtime > tope), `${id}: las de después son más nuevas que el código`);
    // Al frente: la franja cercana (2–10 m) y la del medio (10–40 m)
    for (const [fr, desde, hasta] of [['cercana', 0.55, 0.98], ['del medio', 0.40, 0.62]]) {
      const x = detalleYBrillo(d.medio, desde, hasta).brillo, y = detalleYBrillo(a.medio, desde, hasta).brillo;
      s.ok(Math.abs(x / y - 1) <= 0.15, `${id}: mirando al frente, el brillo de la franja ${fr} queda a ±15 % del de antes`, `${x.toFixed(2)} contra ${y.toFixed(2)} (${((x / y - 1) * 100).toFixed(1)} %)`);
    }
    // La guarda de la fase 3, con la luz bien puesta
    const c = detalleYBrillo(d.suelo).brillo, p = detalleYBrillo(d.plano).brillo;
    s.ok(Math.abs(c / p - 1) <= 0.10, `${id}: la textura queda a ±10 % de la paleta calibrada sola, con la luz de ahora`, `${c.toFixed(2)} contra ${p.toFixed(2)} (${((c / p - 1) * 100).toFixed(1)} %)`);
    const ca = detalleYBrillo(a.suelo).brillo;
    s.nota(`${id}: mirando al suelo (−35°, el sol a la espalda) ${ca.toFixed(2)} → ${c.toFixed(2)} (${((c / ca - 1) * 100).toFixed(1)} %)`);
    medidas++;
  }
  s.feliz = medidas === LUGARES.length;
  s.felizQue = `${medidas} de ${LUGARES.length} lugares medidos`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SIN REGRESIÓN  ·  4 · EL SHADER  ·  5 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(3, 'SIN REGRESIÓN — la ronda 7 y las fases 1, 2 y 3');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const base = { BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' };
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
    // La fase 3 contra las capturas con el arreglo, y sin su regresión (es ésta)
    ['banco-r8-fase3.mjs', '5/5', { BANCO_F3_PREFIJO: PREFIJO, BANCO_SECCIONES: 'horno,terreno,imagen,piso,shader' }],
  ];
  let corrio = 0;
  for (const [archivo, esperado, env] of otros) {
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 1800000, env: { ...process.env, ...base, ...(env || {}) },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length}`;
  return s;
}

async function shader() {
  const s = seccion(4, 'EL SHADER — lint-shader sin errores');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'lint-shader.mjs'), path.join(SRC, 'world', 'Terreno.js')], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'lint-shader.mjs sale bien sobre Terreno.js', r.status === 0 ? '' : salida.slice(-600));
  s.feliz = true;
  return s;
}

async function arranque() {
  const s = seccion(5, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { marco, imagen, regresion, shader, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);
const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({ num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }], feliz: false, felizQue: 'la sección tiró una excepción', notas: [] });
  }
}
todas.sort((a, b) => a.num - b.num);
if (process.env.BANCO_JSON) {
  console.log(JSON.stringify(todas.map((s) => ({ num: s.num, nombre: s.nombre, feliz: s.feliz, checks: s.checks }))));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 3b — la normal del terreno en el marco de la cámara   (src: ${path.relative(RAIZ, SRC) || 'src'} · capturas: ${PREFIJO} contra ${ANTES})\n`);
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
