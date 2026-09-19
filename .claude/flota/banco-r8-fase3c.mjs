/**
 * BANCO DE LA FASE 3c (sombras del terreno) — ronda 8.
 *
 * Lo escribe el JEFE antes de que exista una línea del agente. El defecto: la malla
 * del terreno lleva el atributo `normal` todo en cero, three normaliza ese vector en el
 * vértice para el sesgo de la sombra (`shadowmap_vertex`), y en ANGLE sobre D3D11 da
 * NaN: el terreno no recibe ninguna sombra (RONDA8.md, fase 3c, medido restando).
 *
 *   1. EL VÉRTICE — se construye `Terreno` con un mundo de juguete y se mira lo que de
 *      verdad usa la sombra: o el atributo `normal` es un vector unitario en todos los
 *      vértices, o el vértice (después de `onBeforeCompile`) arma `objectNormal` con
 *      algo que no es cero en vez de leer el atributo. Los comentarios no cuentan.
 *   2. SIN REGRESIÓN — la ronda 7, las fases 1 y 2, la 3 (menos su imagen, que pide
 *      capturas de su propio código) y la 3b (el marco).
 *   3. EL SHADER — lint-shader sin errores.
 *   4. ARRANQUE — vite build.
 *
 * Lo que se ve (recibe, sin acné, las sombras del relieve, el costo, compilar) lo mide
 * `banco-r8-fase3c.navegador.js`.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase3c.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}
const sinComentarios = (g) => g.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL VÉRTICE
// ═══════════════════════════════════════════════════════════════════════════

async function vertice() {
  const s = seccion(1, 'EL VÉRTICE — la normal que usa la sombra no es cero');
  const THREE = await import(pathToFileURL(path.join(RAIZ, 'node_modules', 'three', 'build', 'three.module.js')).href);
  // fetch relativo no existe en Node: el cargador del suelo tiene que caer en «no hay»
  const { Terreno } = await import(pathToFileURL(path.join(SRC, 'world', 'Terreno.js')).href);
  const N = 64, tamano = 4096;
  const mundo = { tamano, mitad: tamano / 2, N, altura: new Float32Array(N * N), texAltura: null, texNormal: null, texCobertura: null };
  let t;
  try { t = new Terreno(mundo); } catch (e) { s.ok(false, 'premisa: Terreno se construye con un mundo de juguete', e.message); return s; }
  s.ok(!!t.geometria && !!t.material, 'premisa: Terreno se construye con un mundo de juguete');

  // a · el atributo
  const a = t.geometria.getAttribute('normal');
  let unitarios = 0, ceros = 0;
  for (let i = 0; i < a.count; i++) {
    const l = Math.hypot(a.getX(i), a.getY(i), a.getZ(i));
    if (Math.abs(l - 1) < 1e-3) unitarios++;
    if (l < 1e-6) ceros++;
  }
  const atributoBien = unitarios === a.count;
  s.nota(`atributo normal: ${unitarios} unitarios y ${ceros} en cero de ${a.count} vértices`);

  // b · el vértice, después de onBeforeCompile
  const lib = THREE.ShaderLib.standard;
  const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms), defines: {} };
  let vertOk = false, detalleVert = '';
  try {
    t.material.onBeforeCompile(shader, { });
    const v = sinComentarios(shader.vertexShader);
    const leeAtributo = v.includes('#include <beginnormal_vertex>');
    const m = v.match(/vec3\s+objectNormal\s*=\s*([^;]+);/);
    const expr = m ? m[1].replace(/\s+/g, '') : '';
    const esCero = /^vec3\(0(\.0*)?(,0(\.0*)?){0,2}\)$/.test(expr);
    vertOk = !leeAtributo && !!m && !esCero;
    detalleVert = leeAtributo ? 'lee el atributo (beginnormal_vertex)' : m ? `objectNormal = ${expr}` : 'no declara objectNormal';
  } catch (e) { detalleVert = `onBeforeCompile tiró: ${e.message}`; }
  s.nota(`vértice: ${detalleVert}`);

  s.ok(atributoBien || vertOk, 'la normal que usa la sombra no es cero: el atributo es unitario en todos los vértices, o el vértice arma objectNormal sin leerlo',
    `atributo ${unitarios}/${a.count} unitarios · vértice: ${detalleVert}`);
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · SIN REGRESIÓN  ·  3 · EL SHADER  ·  4 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(2, 'SIN REGRESIÓN — la ronda 7 y las fases 1, 2, 3 y 3b');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const base = { BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' };
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
    ['banco-r8-fase3.mjs', '4/4', { BANCO_SECCIONES: 'horno,terreno,piso,shader' }],
    ['banco-r8-fase3b.mjs', '2/2', { BANCO_SECCIONES: 'marco,shader' }],
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
  const s = seccion(3, 'EL SHADER — lint-shader sin errores');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'lint-shader.mjs'), path.join(SRC, 'world', 'Terreno.js')], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'lint-shader.mjs sale bien sobre Terreno.js', r.status === 0 ? '' : salida.slice(-600));
  s.feliz = true;
  return s;
}

async function arranque() {
  const s = seccion(4, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { vertice, regresion, shader, arranque };
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
  console.log(`\n  BANCO R8 · FASE 3c — el terreno recibe sombras   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
