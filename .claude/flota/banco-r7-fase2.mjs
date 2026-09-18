/**
 * BANCO DE LA FASE 2 (brasa) — ronda 7, mitad Node.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga `src/world/Hornos.js` y `src/engine/Luces.js` de verdad.
 *
 *   1. LA LLAMA — la fogata encendida tiene algo que brilla, apagada no, se mueve,
 *      es liviana, comparte material entre hornos, y el horno de barro y la
 *      fragua también muestran que arden. Ninguna luz de three.
 *   2. LA LUZ DE LO QUE SE LLEVA — `LLAMAS` sigue entero y con números sanos.
 *   3. SIN REGRESIÓN — r5-fase1, r6-fase1, r6-fase2, r6-fase3 y r7-fase1.
 *   4. ARRANQUE — `vite build`.
 *
 * Qué cuenta como «algo que brilla», dicho antes de ver el código: una malla, un
 * sprite o unos puntos **visibles** —con toda su cadena de padres visible, escala
 * no nula y opacidad mayor a 0,02— cuyo material sea emisivo (emisivo medio por
 * intensidad > 0,15), aditivo, básico o de sombreador propio. Las piedras de hoy
 * son estándar con emisivo negro y no cuentan. La mitad navegador del banco mide
 * lo que esto no puede: que en la imagen final se VEA, que alumbre, y que no
 * compile nada.
 *
 * Uso: node .claude/flota/banco-r7-fase2.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA LLAMA
// ═══════════════════════════════════════════════════════════════════════════

/** Lo que brilla y se ve dentro de un nodo, con su material. */
function brillan(THREE, nodo) {
  const out = [];
  nodo.updateMatrixWorld(true);
  const escala = new THREE.Vector3();
  nodo.traverse((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    o.getWorldScale(escala);
    if (Math.max(Math.abs(escala.x), Math.abs(escala.y), Math.abs(escala.z)) < 1e-3) return;
    if (o.isInstancedMesh && o.count === 0) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || m.visible === false || (m.opacity ?? 1) <= 0.02) continue;
      const emisivo = m.emissive ? ((m.emissive.r + m.emissive.g + m.emissive.b) / 3) * (m.emissiveIntensity ?? 1) : 0;
      const aditivo = m.blending === THREE.AdditiveBlending;
      const propio = m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isShaderMaterial;
      if (emisivo > 0.15 || aditivo || propio) out.push({ o, m });
    }
  });
  return out;
}

function triangulos(o) {
  const g = o.geometry;
  if (!g) return 0;
  const base = o.isPoints ? (g.attributes.position?.count ?? 0) * 2
    : g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
  return base * (o.isInstancedMesh ? o.count : 1);
}

/** Todo lo que puede cambiar cuadro a cuadro en lo que brilla. */
function firma(lista) {
  return JSON.stringify(lista.map(({ o, m }) => [
    o.position.toArray().map((v) => +v.toFixed(4)),
    o.scale.toArray().map((v) => +v.toFixed(4)),
    o.rotation.toArray().slice(0, 3).map((v) => +(+v).toFixed(4)),
    +(m.emissiveIntensity ?? 0).toFixed(4),
    m.emissive ? m.emissive.toArray().map((v) => +v.toFixed(4)) : null,
    +(m.opacity ?? 1).toFixed(4),
    m.uniforms ? Object.values(m.uniforms).map((u) => (typeof u.value === 'number' ? +u.value.toFixed(4) : null)) : null,
    o.isInstancedMesh ? Array.from(o.instanceMatrix.array.slice(0, 32)).map((v) => +v.toFixed(4)) : null,
  ]));
}

async function llama() {
  const s = seccion(1, 'LA LLAMA — encendida se ve, apagada no, se mueve, es liviana y compartida');
  const THREE = await import('three');
  const { Hornos } = await imp('world/Hornos.js');
  const hornos = new Hornos();
  const horno = (id, x) => ({ def: { id, nombre: id }, x, y: 800, z: 0, ardiendo: false });
  const correr = (desde, n, paso = 1 / 60) => { for (let k = 0; k < n; k++) hornos.actualizar(desde + k * paso); };

  const f1 = horno('fogata', 0), f2 = horno('fogata', 20);
  const n1 = hornos.agregar(f1), n2 = hornos.agregar(f2);
  s.ok(!!n1?.isObject3D && !!n2?.isObject3D, 'premisa: agregar() devuelve el nodo de cada fogata');

  let luces = 0;
  hornos.grupo.traverse((o) => { if (o.isLight) luces++; });
  s.ok(luces === 0, 'ninguna luz de three en los hornos', luces);

  correr(0, 120);
  const apagada = brillan(THREE, n1);
  s.ok(apagada.length === 0, 'la fogata apagada no tiene nada que brille', apagada.map(({ o }) => o.name || o.type).join(' ') || 'nada');

  f1.ardiendo = true;
  correr(2, 120);
  const prendida = brillan(THREE, n1);
  const hayLlama = s.ok(prendida.length >= 1, 'la fogata prendida tiene algo visible que brilla', prendida.length);
  s.ok(brillan(THREE, n2).length === 0, 'prender una fogata no prende la de al lado', brillan(THREE, n2).length);

  if (hayLlama) {
    const tris = prendida.reduce((a, { o }) => a + triangulos(o), 0);
    const mallas = new Set(prendida.map(({ o }) => o)).size;
    s.ok(tris <= 400, 'la llama pesa 400 triángulos o menos', tris);
    s.ok(mallas <= 4, 'la llama son 4 piezas o menos', mallas);
    const alto = (() => {
      const caja = new THREE.Box3();
      for (const { o } of prendida) caja.expandByObject(o);
      return { min: +(caja.min.y - 800).toFixed(2), max: +(caja.max.y - 800).toFixed(2), ancho: +Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z).toFixed(2) };
    })();
    s.ok(alto.max > 0.15 && alto.max < 2.5 && alto.ancho < 2.2, 'la llama queda sobre la fogata, entre el suelo y 2,5 m', JSON.stringify(alto));

    hornos.actualizar(10.0);
    const a = firma(brillan(THREE, n1));
    hornos.actualizar(10.37);
    const b = firma(brillan(THREE, n1));
    s.ok(a !== b, 'la llama se mueve: cambia entre dos instantes', a === b ? 'idéntica' : 'distinta');

    f2.ardiendo = true;
    correr(12, 120);
    const mats1 = new Set(prendida.map(({ m }) => m));
    const deLaSegunda = brillan(THREE, n2).map(({ m }) => m);
    s.ok(deLaSegunda.length >= 1 && deLaSegunda.every((m) => mats1.has(m)), 'las dos fogatas comparten el material de la llama', `${deLaSegunda.length} piezas · compartidas ${deLaSegunda.filter((m) => mats1.has(m)).length}`);

    f1.ardiendo = false;
    correr(20, 240);
    s.ok(brillan(THREE, n1).length === 0, 'apagarla vuelve a esconder la llama', brillan(THREE, n1).length);
    s.ok(brillan(THREE, n2).length >= 1, 'y la otra sigue prendida', brillan(THREE, n2).length);
  }

  for (const id of ['horno_barro', 'fragua']) {
    const h = horno(id, id === 'fragua' ? 60 : 40);
    const n = hornos.agregar(h);
    correr(30, 60);
    const antes = brillan(THREE, n).length;
    h.ardiendo = true;
    correr(32, 120);
    const despues = brillan(THREE, n).length;
    s.ok(antes === 0 && despues >= 1, `${id}: muestra que arde, y apagado no`, `${antes} → ${despues}`);
  }
  {
    const h = horno('carbonera', 80);
    const n = hornos.agregar(h);
    h.ardiendo = true;
    correr(40, 120);
    s.nota(`carbonera encendida: ${brillan(THREE, n).length} piezas que brillan (el contrato no lo exige: no tiene boca)`);
  }

  const fuentes = hornos.fuentesDeLuz();
  s.ok(fuentes.length >= 2 && fuentes.every((f) => f.intensidad > 0 && f.radio > 0), 'premisa: los hornos que arden declaran su luz', fuentes.length);
  s.nota(`luz de la fogata: ${JSON.stringify(fuentes.map((f) => ({ radio: f.radio, intensidad: +f.intensidad.toFixed(2), color: (f.color || []).map((c) => +c.toFixed(3)) })).slice(0, 1))}`);

  s.feliz = hayLlama;
  s.felizQue = hayLlama ? `la fogata prendida tiene ${prendida.length} piezas que brillan` : 'no se encontró nada que brille en la fogata prendida';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA LUZ DE LO QUE SE LLEVA
// ═══════════════════════════════════════════════════════════════════════════

async function llamas() {
  const s = seccion(2, 'LA LUZ DE LO QUE SE LLEVA — LLAMAS entero y sano');
  const L = await imp('engine/Luces.js');
  s.ok(L.MAX_LUCES === 2, 'MAX_LUCES sigue en 2: el bloque no se tocó', L.MAX_LUCES);
  const ids = ['antorcha', 'candil_grasa', 'velas_cera'];
  let sanas = 0;
  for (const id of ids) {
    const ll = L.LLAMAS?.[id];
    const bien = !!ll && Array.isArray(ll.color) && ll.color.length === 3 && ll.color.every((c) => c >= 0 && c <= 1)
      && ll.intensidad > 0 && ll.intensidad < 50 && ll.parpadeo >= 0 && ll.parpadeo < 0.5;
    if (bien) sanas++;
    s.ok(bien, `${id}: color lineal en [0,1], intensidad y parpadeo sanos`, ll ? JSON.stringify({ intensidad: ll.intensidad, parpadeo: ll.parpadeo }) : 'no está');
  }
  const bloque = fs.readFileSync(path.join(SRC, 'engine', 'Luces.js'), 'utf8');
  s.ok(/aLuz \*= aLuz;/.test(bloque) && /BRDF_Lambert\( material\.diffuseColor \)/.test(bloque), 'el bloque del sombreador es el de la ronda 5: caída al cuadrado y Lambert');
  s.feliz = sanas === ids.length;
  s.felizQue = `${sanas} de ${ids.length} llamas leídas`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SIN REGRESIÓN  ·  4 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(3, 'SIN REGRESIÓN — las fases anteriores siguen verdes');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const real = { BANCO_SRC: path.join(RAIZ, 'src') };
  const otros = [
    ['banco-r5-fase1.mjs', '9/9', {}],
    ['banco-r6-fase1.mjs', '7/7', {}],
    ['banco-r6-fase2.mjs', '8/8', {}],
    // Con BANCO_SRC al src de verdad, estos dos saltean SU regresión, que correría
    // otra vez los de arriba adentro de ésta.
    ['banco-r6-fase3.mjs', '6/6', real],
    ['banco-r7-fase1.mjs', '6/6', real],
  ];
  let corrio = 0;
  for (const [archivo, esperado, env] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000,
      env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '', ...env },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length} bancos anteriores`;
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

const SECCIONES = { llama, llamas, regresion, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
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

console.log(`\n  BANCO R7 · FASE 2 — la brasa, mitad Node   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
