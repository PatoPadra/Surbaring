/**
 * BANCO DE LA FASE 3 (suelo) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes de que exista una
 * línea del agente.
 *
 *   1. EL HORNO — `tools/hornear-suelo.mjs` corre, da los mismos bytes dos veces,
 *      escribe cuatro capas o más con su manifiesto, cada capa calza consigo misma,
 *      el albedo medio declarado es el que hay, la normal cae en el disco unidad, y
 *      todo entra en 12 MB con mipmaps.
 *   2. EL TERRENO LA USA — `Terreno.js` declara una textura de capas; el cargador
 *      `src/util/suelo.js` existe y sin archivos no tira: devuelve que no hay.
 *   3. LA IMAGEN — las capturas que saca la mitad navegador (`r8-f3-*`), más nuevas
 *      que el código, medidas con la cuenta de la base (`r8-suelo-metricas.mjs`):
 *      detalle cercano ×1,5, brillo ±10 %, detalle a 10–40 m ≤ ×1,6, y la piedra
 *      con un verdor menor a 0,05.
 *   4. EL PISO — `Mundo.alturaEn` en mil puntos da la huella de la base.
 *   5. EL SHADER — `lint-shader.mjs` sin errores.
 *   6. SIN REGRESIÓN — la ronda 7 y las fases 1 y 2.
 *   7. ARRANQUE — `vite build`.
 *
 * El costo en la placa y que no compile de más lo mide la mitad navegador,
 * `banco-r8-fase3.navegador.js`, con sus propios umbrales.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase3.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES,
 *      BANCO_F3_PREFIJO (las capturas a medir; por omisión r8-f3)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const HORNO = path.join(SRC, '..', 'tools', 'hornear-suelo.mjs');
const SALIDA = path.join(SRC, '..', 'public', 'tex', 'suelo');
const PREFIJO = process.env.BANCO_F3_PREFIJO || 'r8-f3';
const { PNG } = (await import('pngjs')).default;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** Lo que midió la base el 18/9/2026 (RONDA8.md, fase 3, punto 4 y 5). */
const BASE = {
  bosque: { detalle: 1.87, brillo: 32.63, medio: 3.07 },
  estepa: { detalle: 2.09, brillo: 44.61, medio: 11.43 },
  pedregal: { detalle: 2.33, brillo: 83.69, medio: 6.42 },
};
const VERDOR_BASE = 0.129;
const HUELLA_PISO = '29167927d1cc6397b225e8796522863da4a1a827a6e3b8d7a4d6e0a701dbc3b8';

const lineal = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const hashCarpeta = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const h = crypto.createHash('sha256');
  for (const f of fs.readdirSync(dir).sort()) h.update(f).update(fs.readFileSync(path.join(dir, f)));
  return h.digest('hex');
};

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL HORNO
// ═══════════════════════════════════════════════════════════════════════════

async function horno() {
  const s = seccion(1, 'EL HORNO — capas que calzan, bytes que repiten, y dentro de 12 MB');
  if (!s.ok(fs.existsSync(HORNO), 'tools/hornear-suelo.mjs existe')) { s.felizQue = 'no hay horno'; return s; }
  const correr = () => spawnSync(process.execPath, [HORNO], { cwd: path.join(SRC, '..'), encoding: 'utf8', timeout: 900000 });
  const r1 = correr();
  s.ok(r1.status === 0, 'el horno corre y termina bien', r1.status === 0 ? '' : ((r1.stderr || '') + (r1.stdout || '')).slice(-600));
  const h1 = hashCarpeta(SALIDA);
  const r2 = correr();
  const h2 = hashCarpeta(SALIDA);
  s.ok(r2.status === 0 && !!h1 && h1 === h2, 'correrlo dos veces da los mismos bytes', `${h1?.slice(0, 12)} · ${h2?.slice(0, 12)}`);
  const fMan = path.join(SALIDA, 'manifiesto.json');
  if (!s.ok(fs.existsSync(fMan), 'escribió public/tex/suelo/manifiesto.json')) return s;
  const man = JSON.parse(fs.readFileSync(fMan, 'utf8'));
  const capas = man.capas || [];
  s.ok(capas.length >= 4, 'cuatro capas o más', capas.map((c) => c.id).join(', '));
  const texto = (c) => `${c.id} ${c.nombre} ${c.referencia}`.toLowerCase();
  const tiene = (re) => capas.some((c) => re.test(texto(c)));
  s.ok(tiene(/hojarasca|coihue|lenga/) && tiene(/p[oó]mez|lapilli|andisol/) && tiene(/estepa|coir[oó]n/) && tiene(/acarreo|pedregal|granit|roca/),
    'están la hojarasca, el andisol con pómez, la estepa y el acarreo', capas.map((c) => c.id).join(', '));
  let bytes = 0;
  let todas = true;
  for (const c of capas) {
    const campos = ['id', 'nombre', 'referencia', 'periodoM', 'albedoMedio'].every((k) => c[k] !== undefined && c[k] !== '');
    s.ok(campos && typeof c.referencia === 'string' && c.referencia.length > 20, `${c.id}: declara nombre, referencia, período y albedo medio`, JSON.stringify({ periodoM: c.periodoM, albedoMedio: c.albedoMedio }));
    const fa = path.join(SALIDA, c.archivos?.albedo || '__'), fn = path.join(SALIDA, c.archivos?.normal || '__');
    if (!s.ok(fs.existsSync(fa) && fs.existsSync(fn), `${c.id}: sus dos PNG existen`, JSON.stringify(c.archivos))) { todas = false; continue; }
    const a = PNG.sync.read(fs.readFileSync(fa)), n = PNG.sync.read(fs.readFileSync(fn));
    const pot = (v) => v >= 256 && v <= 1024 && (v & (v - 1)) === 0;
    s.ok(a.width === a.height && pot(a.width) && n.width === a.width && n.height === a.height, `${c.id}: cuadrada, potencia de dos entre 256 y 1024, las dos del mismo lado`, `${a.width}×${a.height} · ${n.width}×${n.height}`);
    bytes += (a.width * a.height * 4 + n.width * n.height * 4) * 4 / 3;
    // Calza consigo misma: la costura contra la media de columnas vecinas de adentro
    const W = a.width, H = a.height, d = a.data;
    const lum = (x, y) => { const k = (y * W + x) * 4; return 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; };
    let costura = 0, adentro = 0, na = 0;
    for (let y = 0; y < H; y++) { costura += Math.abs(lum(W - 1, y) - lum(0, y)); for (let x = 1; x < W; x += Math.max(1, W >> 5)) { adentro += Math.abs(lum(x, y) - lum(x - 1, y)); na++; } }
    for (let x = 0; x < W; x++) costura += Math.abs(lum(x, H - 1) - lum(x, 0));
    costura /= (W + H); adentro /= na;
    s.ok(costura <= 1.25 * adentro, `${c.id}: calza consigo misma (costura ≤ 1,25 × vecinas)`, `${costura.toFixed(2)} contra ${adentro.toFixed(2)}`);
    // El albedo medio declarado es el que hay
    let ml = 0;
    for (let k = 0; k < d.length; k += 4) ml += (lineal(d[k]) + lineal(d[k + 1]) + lineal(d[k + 2])) / 3;
    ml /= W * H;
    s.ok(Math.abs(ml - c.albedoMedio) <= 0.01, `${c.id}: el albedo medio declarado es el medido (±0,01)`, `${ml.toFixed(4)} contra ${c.albedoMedio}`);
    // La normal en el disco unidad
    let fuera = 0;
    for (let k = 0; k < n.data.length; k += 4) { const x = n.data[k] / 127.5 - 1, y = n.data[k + 1] / 127.5 - 1; if (x * x + y * y > 1.02) fuera++; }
    s.ok(fuera / (W * H) < 0.001, `${c.id}: la normal (R, G) cae en el disco unidad`, `${fuera} texels afuera`);
  }
  const mb = bytes / (1024 * 1024);
  s.ok(capas.length > 0 && mb <= 12, 'todo junto, con mipmaps, entra en 12 MB', `${mb.toFixed(2)} MB`);
  s.feliz = capas.length >= 4 && todas;
  s.felizQue = `${capas.length} capas`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · EL TERRENO LA USA
// ═══════════════════════════════════════════════════════════════════════════

async function terreno() {
  const s = seccion(2, 'EL TERRENO LA USA — textura de capas, y un cargador que no tira');
  const t = fs.readFileSync(path.join(SRC, 'world', 'Terreno.js'), 'utf8');
  s.ok(/sampler2DArray/.test(t), 'Terreno.js declara una textura de capas (sampler2DArray)');
  const fc = path.join(SRC, 'util', 'suelo.js');
  if (!s.ok(fs.existsSync(fc), 'src/util/suelo.js existe')) { s.felizQue = 'no hay cargador'; return s; }
  // Sin archivos: fetch que falla. No puede tirar: tiene que decir que no hay.
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error('404'); }, arrayBuffer: async () => { throw new Error('404'); }, blob: async () => { throw new Error('404'); } });
  let r = null, tiro = null;
  try {
    const mod = await import(pathToFileURL(fc).href);
    const f = Object.values(mod).find((v) => typeof v === 'function');
    r = f ? await f() : null;
  } catch (e) { tiro = e.message; } finally { globalThis.fetch = fetchReal; }
  s.ok(tiro === null, 'sin archivos, el cargador no tira', tiro || '');
  s.ok(r && r.disponible === false, 'y dice que no hay (disponible: false)', JSON.stringify(r)?.slice(0, 80));
  s.feliz = /sampler2DArray/.test(t);
  s.felizQue = 'el terreno declara la textura';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · LA IMAGEN
// ═══════════════════════════════════════════════════════════════════════════

async function imagen() {
  const s = seccion(3, 'LA IMAGEN — el suelo se lee, no se aclara, no hormiguea, y la piedra es gris');
  const { detalleYBrillo } = await import(pathToFileURL(path.join(AQUI, 'r8-suelo-metricas.mjs')).href);
  const leer = (nombre) => {
    const f = path.join(RAIZ, 'capturas', `${nombre}.png`);
    if (!fs.existsSync(f)) return null;
    const png = PNG.sync.read(fs.readFileSync(f));
    const L = new Float32Array(png.width * png.height);
    for (let i = 0; i < L.length; i++) L[i] = 0.2126 * png.data[i * 4] + 0.7152 * png.data[i * 4 + 1] + 0.0722 * png.data[i * 4 + 2];
    return { W: png.width, H: png.height, L, png, mtime: fs.statSync(f).mtimeMs };
  };
  // Más nuevas que el código: si no, se mide una imagen de antes del cambio
  const codigo = [path.join(SRC, 'world', 'Terreno.js'), path.join(SRC, 'world', 'Sotobosque.js')]
    .concat(fs.existsSync(SALIDA) ? fs.readdirSync(SALIDA).map((f) => path.join(SALIDA, f)) : [])
    .filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs);
  const tope = Math.max(...codigo);
  let medidas = 0;
  for (const id of Object.keys(BASE)) {
    const a = leer(`${PREFIJO}-sinpasto-suelo-${id}`), m = leer(`${PREFIJO}-sinpasto-medio-${id}-a`);
    if (!s.ok(!!a && !!m, `${id}: están las dos capturas (${PREFIJO})`)) continue;
    s.ok(a.mtime > tope && m.mtime > tope, `${id}: las capturas son más nuevas que el código y el horneado`, `${new Date(a.mtime).toISOString()} contra ${new Date(tope).toISOString()}`);
    const c = detalleYBrillo(a), me = detalleYBrillo(m, 0.40, 0.62);
    const b = BASE[id];
    s.ok(c.detalle >= 1.5 * b.detalle, `${id}: el detalle cercano sube al menos 1,5 veces`, `${c.detalle.toFixed(2)} contra ${b.detalle} (×${(c.detalle / b.detalle).toFixed(2)})`);
    s.ok(Math.abs(c.brillo - b.brillo) <= 0.10 * b.brillo, `${id}: el brillo cercano queda a ±10 %`, `${c.brillo.toFixed(2)} contra ${b.brillo} (${((c.brillo / b.brillo - 1) * 100).toFixed(1)} %)`);
    s.ok(me.detalle <= 1.6 * b.medio, `${id}: a 10–40 m el detalle no pasa de 1,6 veces (sin aliasing)`, `${me.detalle.toFixed(2)} contra ${b.medio} (×${(me.detalle / b.medio).toFixed(2)})`);
    medidas++;
  }
  // La piedra
  const con = leer(`${PREFIJO}-piedra-con`), sin = leer(`${PREFIJO}-piedra-sin`);
  if (s.ok(!!con && !!sin, `están las dos capturas de la piedra (${PREFIJO})`)) {
    let n = 0, r = 0, g = 0, bl = 0;
    const A = con.png.data, B = sin.png.data;
    for (let k = 0; k < A.length; k += 4) {
      const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
      if (d > 30) { n++; r += A[k]; g += A[k + 1]; bl += A[k + 2]; }
    }
    r /= n; g /= n; bl /= n;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const verdor = (g - (r + bl) / 2) / lum;
    s.ok(n > 2000, 'premisa: la piedra ocupa más de 2000 píxeles', n);
    s.ok(verdor < 0.05, 'la piedra deja de ser verdosa (verdor < 0,05)', `${verdor.toFixed(3)} contra ${VERDOR_BASE} de la base · color (${r.toFixed(0)}, ${g.toFixed(0)}, ${bl.toFixed(0)})`);
  }
  s.feliz = medidas === 3;
  s.felizQue = `${medidas} de 3 lugares medidos`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · EL PISO  ·  5 · EL SHADER
// ═══════════════════════════════════════════════════════════════════════════

async function piso() {
  const s = seccion(4, 'EL PISO — la física no se toca');
  const { huellaDelPiso } = await import(pathToFileURL(path.join(AQUI, 'r8-huella-piso.mjs')).href);
  const r = await huellaDelPiso(SRC);
  s.ok(r.sha === HUELLA_PISO, 'Mundo.alturaEn da la huella de la base en mil puntos', `${r.sha.slice(0, 16)}… · ${r.muestra.join(', ')}`);
  s.feliz = true;
  return s;
}

async function shader() {
  const s = seccion(5, 'EL SHADER — lint-shader sin errores');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'lint-shader.mjs'), path.join(SRC, 'world', 'Terreno.js')], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'lint-shader.mjs sale bien sobre Terreno.js', r.status === 0 ? '' : salida.slice(-600));
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — la ronda 7 y las fases 1 y 2');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
  ];
  let corrio = 0;
  for (const [archivo, esperado] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 1800000,
      env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' },
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

async function arranque() {
  const s = seccion(7, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { horno, terreno, imagen, piso, shader, regresion, arranque };
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
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 3 — el suelo de cerca, por textura   (src: ${path.relative(RAIZ, SRC) || 'src'} · capturas: ${PREFIJO})\n`);
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
