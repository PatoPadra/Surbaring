/**
 * BANCO DE LA FASE 6 (luz de luna) — ronda 8.
 *
 * Lo escribe el JEFE antes que el agente. La luna alumbraba según la fracción iluminada
 * del disco (k); la ley real es la de Allen: la magnitud crece 0,026·α + 4·10⁻⁹·α⁴ con el
 * ángulo de fase α en grados, o sea brillo relativo 10^(−0,4·(0,026α + 4·10⁻⁹α⁴)). La luna
 * en cuarto brilla un 9 % de la llena, no un 50 % (RONDA8.md, fase 6).
 *
 *   1. LA LEY — `brilloLunar(alfaGrados)` exportada de Cielo.js, con los valores de Allen.
 *   2. LA NOCHE — `Cielo` construido en Node sobre una escena de juguete, dos meses
 *      (febrero y marzo de 2025) de 2 a 8 UTC: con el sol a más de 20° bajo el horizonte
 *      y la luna a más de 17°, el exceso de luz sobre una noche sin luna, dividido por el
 *      seno de la altura de la luna y normalizado a la llena, sigue a Allen en el ambiente
 *      y en la niebla. La llena y la noche sin luna, como hoy.
 *   3. EL CIELO — en el shader, `uFaseLunar` queda para el terminador del disco; el halo y
 *      lo que la luna apaga las estrellas ya no la usan.
 *   4. SIN REGRESIÓN — la ronda 7 (el cielo, fase 6, en 7/7: `uFaseLunar` sigue siendo la
 *      fracción), y las fases 1 a 4 en lo que se mide sin navegador.
 *   5. EL SHADER — lint-shader sin errores.
 *   6. ARRANQUE — vite build.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase6.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const ALLEN = (a) => Math.pow(10, -0.4 * (0.026 * a + 4e-9 * a ** 4));
// Lo que midió la base el 19/9/2026 (RONDA8.md, fase 6, punto 2).
//
// `BASE_LLENA` decía 0,0889 y era un error de transcripción MÍO, del jefe: lo encontró
// el agente `luz` y lo comprobé el 23/9 corriendo esta misma sección contra una copia de
// HEAD (`git archive HEAD src`), que da **0,0899**. El 1,2 % no cambiaba ningún veredicto
// —las dos versiones caen dentro del ±10 %—, pero dejarlo habría sido restarle un error
// de tipeo al presupuesto de la física el día que alguien apriete la tolerancia al 5 %.
const BASE_LLENA = 0.0899;       // exceso de ambiente por seno de altura, noches con α < 6°
const BASE_SIN_LUNA = 0.0459;    // ambiente de una noche sin luna

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}
const sinComentarios = (g) => g.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

let _mod = null;
async function modulo() {
  if (_mod) return _mod;
  globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }) };
  _mod = await import(pathToFileURL(path.join(SRC, 'world', 'Cielo.js')).href);
  return _mod;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA LEY
// ═══════════════════════════════════════════════════════════════════════════

async function ley() {
  const s = seccion(1, 'LA LEY — brilloLunar(α) es la de Allen');
  const m = await modulo();
  if (!s.ok(typeof m.brilloLunar === 'function', 'Cielo.js exporta brilloLunar(alfaGrados)')) return s;
  for (const a of [0, 30, 90, 135, 160]) {
    const v = m.brilloLunar(a), e = ALLEN(a);
    s.ok(Math.abs(v / e - 1) <= 0.02, `brilloLunar(${a}°) = Allen a ±2 %`, `${v.toFixed(5)} contra ${e.toFixed(5)}`);
  }
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA NOCHE
// ═══════════════════════════════════════════════════════════════════════════

/** Los dos meses de noches, con lo que dice el cielo en cada una. */
async function barrido() {
  const THREE = await import(pathToFileURL(path.join(RAIZ, 'node_modules', 'three', 'build', 'three.module.js')).href);
  const { Cielo } = await modulo();
  const c = new Cielo(new THREE.Scene());
  const filas = [];
  for (let d = 0; d < 59; d++) for (const h of [2, 4, 6, 8]) {
    const f = new Date(Date.UTC(2025, 1, 1 + d, h, 0, 0));
    c.actualizar(f, -41.13, -71.3, 0);
    const k = c.uniformes.uFaseLunar.value;
    const a = Math.acos(Math.max(-1, Math.min(1, 2 * k - 1))) * 180 / Math.PI;
    const niebla = c.colorNiebla(new THREE.Color());
    filas.push({ f: f.toISOString().slice(0, 13), k, a, ly: c.direccionLuna.y, sy: c.direccionSol.y, amb: c.luzAmbiente.intensity, nb: niebla.b });
  }
  return filas;
}

async function noche() {
  const s = seccion(2, 'LA NOCHE — el ambiente y la niebla siguen a Allen; la llena y la noche sin luna, como hoy');
  const filas = await barrido();
  const oscuras = filas.filter((x) => x.sy < -0.35);
  const sinLuna = oscuras.filter((x) => x.ly < -0.05);
  const conLuna = oscuras.filter((x) => x.ly > 0.3);
  if (!s.ok(sinLuna.length >= 30 && conLuna.length >= 60, 'premisa: hay noches sin luna y con luna alta de sobra', `${sinLuna.length} sin luna, ${conLuna.length} con luna alta`)) return s;
  const media = (xs) => xs.reduce((t, v) => t + v, 0) / xs.length;
  for (const [canal, nombre] of [['amb', 'el ambiente'], ['nb', 'la niebla']]) {
    const base = media(sinLuna.map((x) => x[canal]));
    const llenas = conLuna.filter((x) => x.a < 6);
    const ref = media(llenas.map((x) => (x[canal] - base) / x.ly));
    const refAllen = media(llenas.map((x) => ALLEN(x.a)));
    if (canal === 'amb') {
      s.ok(Math.abs(base / BASE_SIN_LUNA - 1) <= 0.02, 'la noche sin luna no cambia (±2 %)', `${base.toFixed(4)} contra ${BASE_SIN_LUNA}`);
      s.ok(Math.abs(ref / BASE_LLENA - 1) <= 0.10, 'la llena alumbra como hoy (±10 %)', `${ref.toFixed(4)} contra ${BASE_LLENA}`);
    }
    let peor = 0, peorFila = '';
    for (const x of conLuna) {
      const medido = (x[canal] - base) / x.ly / ref;
      const esperado = ALLEN(x.a) / refAllen;
      const err = esperado < 0.13 ? Math.abs(medido - esperado) / 0.02 * 0.15 : Math.abs(medido / esperado - 1);
      if (err > peor) { peor = err; peorFila = `${x.f}, α ${x.a.toFixed(0)}°: ${medido.toFixed(3)} contra ${esperado.toFixed(3)}`; }
    }
    s.ok(peor <= 0.15, `${nombre}: cada noche con luna a ±15 % de Allen (±0,02 donde Allen < 0,13)`, `peor: ${peorFila}`);
    const cuarto = conLuna.filter((x) => x.a > 85 && x.a < 100);
    if (cuarto.length) s.nota(`${nombre}, luna en cuarto: ${media(cuarto.map((x) => (x[canal] - base) / x.ly / ref)).toFixed(3)} de la llena (Allen ${media(cuarto.map((x) => ALLEN(x.a) / refAllen)).toFixed(3)}, fracción ${media(cuarto.map((x) => x.k)).toFixed(3)})`);
  }
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL CIELO
// ═══════════════════════════════════════════════════════════════════════════

async function cielo() {
  const s = seccion(3, 'EL CIELO — uFaseLunar queda para el terminador; el halo y las estrellas siguen el brillo');
  const g = sinComentarios(fs.readFileSync(path.join(SRC, 'world', 'Cielo.js'), 'utf8'));
  // Los usos de uFaseLunar dentro de GLSL (las plantillas del shader), fuera de sus declaraciones
  const usos = [...g.matchAll(/[^\n]*\buFaseLunar\b[^\n]*/g)].map((m) => m[0].trim())
    .filter((l) => !/uniform\s+float\s+uFaseLunar/.test(l) && !/uFaseLunar\s*:/.test(l) && !/uniformes\.uFaseLunar|u\.uFaseLunar|this\.uniformes/.test(l));
  const enLuz = usos.filter((l) => !/terminador/.test(l));
  s.ok(usos.some((l) => /terminador/.test(l)), 'el terminador del disco sigue con uFaseLunar', usos.filter((l) => /terminador/.test(l)).length);
  s.ok(enLuz.length === 0, 'ningún otro uso de uFaseLunar en el shader (ni el halo ni las estrellas)', enLuz.map((l) => l.slice(0, 90)).join(' | '));
  // Y en JavaScript, la luz de la noche ya no multiplica por la fracción
  const js = [...g.matchAll(/[^\n]*uFaseLunar\.value[^\n]*/g)].map((m) => m[0].trim()).filter((l) => !/=\s*\(1\s*\+\s*cosFase\)\s*\/\s*2/.test(l));
  s.ok(js.length === 0, 'en JavaScript la luz de la noche no usa uFaseLunar.value (sólo se escribe)', js.map((l) => l.slice(0, 90)).join(' | '));
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · SIN REGRESIÓN  ·  5 · EL SHADER  ·  6 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(4, 'SIN REGRESIÓN — la ronda 7 y las fases 1 a 4');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const base = { BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' };
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
    ['banco-r8-fase3.mjs', '4/4', { BANCO_SECCIONES: 'horno,terreno,piso,shader' }],
    ['banco-r8-fase3b.mjs', '2/2', { BANCO_SECCIONES: 'marco,shader' }],
    ['banco-r8-fase3c.mjs', '2/2', { BANCO_SECCIONES: 'vertice,shader' }],
    ['banco-r8-fase4.mjs', '4/4', { BANCO_SECCIONES: 'horno,hoja,clases,modelo' }],
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
  const s = seccion(5, 'EL SHADER — lint-shader sin errores');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'lint-shader.mjs'), path.join(SRC, 'world', 'Cielo.js')], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'lint-shader.mjs sale bien sobre Cielo.js', r.status === 0 ? '' : salida.slice(-600));
  s.feliz = true;
  return s;
}

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

const SECCIONES = { ley, noche, cielo, regresion, shader, arranque };
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
  console.log('@@RESULTADO ' + JSON.stringify(todas.map((s) => ({ num: s.num, nombre: s.nombre, feliz: s.feliz, checks: s.checks }))));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 6 — la luna con la ley de Allen   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
