/**
 * BANCO DE LA FASE 2b (empuñadura) — ronda 7.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Corre el `Cuerpo` de verdad en Node, como el banco de la ronda
 * 5 fase 3: three arma geometrías sin WebGL.
 *
 *   1. EL CABLEADO — `main.js` le da a la mano la herramienta si hay, y si no el
 *      arma (E1). Se evalúa la expresión de verdad contra un equipo falso.
 *   2. LOS DOCE — cada objeto de la ranura del arma tiene modelo, ≤ 900
 *      triángulos, ≤ 2 mallas, materiales de la paleta del cuerpo, a lo sumo doce
 *      tintas entre los treinta, y cien cambios no hacen crecer el grafo (E2, E5,
 *      E6).
 *   3. SILUETAS — ningún par de los treinta con las tres medidas de la caja, en el
 *      espacio del modelo, dentro del 15 % (E3).
 *   4. EL SUELO — parado, nada baja a menos de 2 cm de la planta de los pies (E4).
 *   5. LA LLAMA APAGADA — la antorcha y el candil apagados en la mano no brillan
 *      (E7, confirmado por la fase 2: era el triángulo amarillo de las capturas).
 *      Agregada después de cerrar la fase 2 y ANTES de lanzar al agente.
 *   6. SIN REGRESIÓN — r5-fase3, r7-fase1 y r7-fase2.
 *   7. ARRANQUE — `vite build`.
 *
 * Medido contra la base antes de escribirlo: de los 18 modelos de hoy, cero pares
 * dentro del 15 % en el espacio del modelo (con la caja posada habría uno, azuela y
 * sierra: por eso no se mide posada), y el punto más bajo a 0,64 m sobre los pies.
 *
 * Cada modelo se encuentra por el nombre `mano:<id>`, que le pone
 * `construirHerramienta()` desde la ronda 5, y no por los internos de `Cuerpo`.
 *
 * Uso: node .claude/flota/banco-r7-fase2b.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const leer = (rel) => fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

const DATOS = JSON.parse(leer('data/herramientas.json'));
const IDS_MANO = DATOS.objetos.filter((o) => o.ranura === 'mano').map((o) => o.id);
const IDS_ARMA = DATOS.objetos.filter((o) => o.ranura === 'arma').map((o) => o.id);
const TODOS = [...IDS_MANO, ...IDS_ARMA];

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

function entorno() {
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}

const jugador = (x = 10, z = -5, giro = 0) => ({
  posicion: { x, y: 800, z }, alturaVisual: 800, giro, cabeceo: 0,
  velocidad: { x: 0, y: 0, z: 0 }, enSuelo: true, enAgua: false, profundidadAgua: 0,
  fasePaso: 0, agachado: false, tercerPersona: true, corriendo: false,
});

/** Un cuerpo de verdad, con el aspecto por omisión del juego. */
async function armar() {
  entorno();
  const THREE = await import('three');
  const { Cuerpo } = await imp('entities/Cuerpo.js');
  let aspecto = { estatura: 1.74, piel: 2, pelo: 1, peinado: 0, campera: 0, pantalon: 0, complexion: 1, elegido: true };
  try { const { Aspecto } = await imp('systems/Aspecto.js'); if (Aspecto?.cargar) aspecto = Aspecto.cargar(); } catch { /* con el literal alcanza */ }
  const cuerpo = new Cuerpo(aspecto, () => {});
  return { THREE, cuerpo };
}

/** El modelo colgado en la mano para ese id, o null. */
function modelo(cuerpo, id) {
  cuerpo.enMano = id;
  cuerpo.actualizar(1 / 60, jugador());
  const m = cuerpo.manos?.[1]?.getObjectByName(`mano:${id}`) ?? cuerpo.grupo?.getObjectByName(`mano:${id}`);
  if (m) m.updateMatrixWorld(true);
  return m ?? null;
}

function pesar(raiz) {
  let tri = 0, mallas = 0;
  const mats = new Set();
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    mallas++;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
    const g = o.geometry;
    tri += g.index ? g.index.count / 3 : (g.attributes?.position?.count ?? 0) / 3;
  });
  return { tri: Math.round(tri), mallas, mats };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL CABLEADO
// ═══════════════════════════════════════════════════════════════════════════

async function cableado() {
  const s = seccion(1, 'EL CABLEADO — la herramienta si hay, y si no el arma');
  const main = leer('main.js');
  const m = /cuerpo\.enMano\s*=\s*([^;]+);/.exec(main);
  if (!s.ok(!!m, 'premisa: main.js asigna cuerpo.enMano', m?.[0])) { s.felizQue = 'no se encontró la asignación'; return s; }
  const expr = m[1].trim();
  s.ok(/enRanura\(\s*['"]mano['"]\s*\)/.test(expr), 'la asignación lee la ranura de la mano', expr);
  s.ok(/enRanura\(\s*['"]arma['"]\s*\)/.test(expr), 'la asignación lee la ranura del arma', expr);

  let evaluar = null;
  try { evaluar = new Function('equipo', `return (${expr});`); } catch (e) { s.nota(`la expresión no se pudo evaluar sola: ${e.message}`); }
  const equipoFalso = (mano, arma) => ({ enRanura: (r) => (r === 'mano' && mano ? { id: mano } : r === 'arma' && arma ? { id: arma } : null) });
  let anda = false;
  if (evaluar) {
    const casos = [
      ['hacha_piedra', 'garrote', 'hacha_piedra', 'con herramienta y arma, va la herramienta'],
      [null, 'garrote', 'garrote', 'con la mano vacía, va el arma'],
      ['antorcha', 'arco_colihue_obj', 'antorcha', 'la antorcha es de mano y le gana al arco'],
      [null, null, null, 'sin nada, nada'],
    ];
    let bien = 0;
    for (const [mano, arma, espera, desc] of casos) {
      let r;
      try { r = evaluar(equipoFalso(mano, arma)) ?? null; } catch (e) { r = `tiró: ${e.message}`; }
      if (s.ok(r === espera, desc, `${JSON.stringify(r)} (espera ${JSON.stringify(espera)})`)) bien++;
    }
    anda = bien === casos.length;
  } else {
    s.ok(false, 'la expresión de cuerpo.enMano se evalúa contra un equipo falso', expr);
  }
  s.feliz = !!m && !!evaluar;
  s.felizQue = `se leyó y evaluó «${expr}»` + (anda ? '' : ' (con fallas)');
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LOS DOCE
// ═══════════════════════════════════════════════════════════════════════════

async function losDoce() {
  const s = seccion(2, 'LOS DOCE — modelo, presupuesto, paleta y caché');
  const { cuerpo } = await armar();
  if (!s.ok(!!cuerpo.manos?.[1], 'premisa: hay mano derecha')) { s.felizQue = 'sin mano'; return s; }
  s.ok(!!modelo(cuerpo, 'hacha_piedra'), 'premisa: los modelos se encuentran por el nombre mano:<id> (el hacha de la ronda 5)');

  const paleta = cuerpo._paleta instanceof Map ? cuerpo._paleta : null;
  if (!paleta) s.nota('Cuerpo no expone _paleta: E5 se mide por materiales compartidos');
  const materialesDeTodos = new Set();
  const usosPorMaterial = new Map();
  let conModelo = 0;
  const tabla = [];
  for (const id of TODOS) {
    const m = modelo(cuerpo, id);
    if (!m) { if (IDS_ARMA.includes(id)) s.ok(false, `${id}: tiene modelo`); continue; }
    const p = pesar(m);
    for (const mat of p.mats) { materialesDeTodos.add(mat); usosPorMaterial.set(mat, (usosPorMaterial.get(mat) || 0) + 1); }
    if (!IDS_ARMA.includes(id)) continue;
    conModelo++;
    tabla.push(`${id} ${p.tri}t/${p.mallas}m`);
    s.ok(p.tri > 0, `${id}: tiene modelo`, p.tri);
    s.ok(p.tri <= 900, `${id}: ≤ 900 triángulos`, p.tri);
    s.ok(p.mallas <= 2, `${id}: ≤ 2 mallas`, p.mallas);
    const deLaPaleta = paleta ? [...p.mats].every((mat) => [...paleta.values()].includes(mat)) : true;
    s.ok(deLaPaleta, `${id}: sus materiales son de la paleta del cuerpo (equipar no compila)`, [...p.mats].map((mat) => mat.type).join(','));
  }
  s.nota(tabla.join(' · '));
  s.ok(conModelo === IDS_ARMA.length, 'los 12 de la ranura del arma tienen modelo', `${conModelo}/${IDS_ARMA.length}`);
  if (!paleta) {
    const sueltos = [...usosPorMaterial].filter(([, n]) => n < 2).length;
    s.ok(sueltos <= 2, 'casi todos los materiales se comparten entre modelos', `${sueltos} materiales de un solo modelo`);
  }
  s.ok(materialesDeTodos.size <= 12, 'a lo sumo doce tintas entre los treinta modelos', materialesDeTodos.size);

  // E6: cien cambios entre todo, y el grafo no crece
  // Se pesa el modelo `mano:garrote`, no el subárbol de la mano. La primera
  // versión pesaba la mano entera, que ya tiene triángulos propios, y la aserción
  // daba verde contra la base, donde el garrote no existe: un OK por el motivo
  // equivocado (la trampa nº 10). Ahora exige que el modelo esté.
  const derecha = cuerpo.manos[1];
  const g0 = modelo(cuerpo, 'garrote');
  const garrote0 = g0 ? pesar(g0).tri : 0;
  let nodos0 = 0; derecha.traverse(() => nodos0++);
  for (let k = 0; k < 100; k++) { cuerpo.enMano = k % 7 === 0 ? null : TODOS[k % TODOS.length]; cuerpo.actualizar(1 / 60, jugador()); }
  const g1 = modelo(cuerpo, 'garrote');
  const garrote1 = g1 ? pesar(g1).tri : 0;
  let nodos1 = 0; derecha.traverse(() => nodos1++);
  s.ok(garrote0 > 0 && garrote1 === garrote0, 'después de cien cambios el garrote pesa lo mismo: se cachea', `${garrote0} → ${garrote1}`);
  s.ok(nodos1 <= nodos0 + 60, 'el grafo de la mano no crece con los cambios', `${nodos0} → ${nodos1} nodos`);

  s.feliz = conModelo > 0;
  s.felizQue = `${conModelo} de ${IDS_ARMA.length} modelos del arma pesados`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SILUETAS  ·  4 · EL SUELO
// ═══════════════════════════════════════════════════════════════════════════

/** Las tres medidas de la caja en el espacio del modelo, de mayor a menor. */
function medidasPropias(THREE, m) {
  const inv = m.matrixWorld.clone().invert();
  const caja = new THREE.Box3();
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    caja.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));
  });
  const d = caja.getSize(new THREE.Vector3());
  return [d.x, d.y, d.z].sort((a, b) => b - a);
}

async function siluetas() {
  const s = seccion(3, 'SILUETAS — ningún par de los treinta con la misma caja');
  const { THREE, cuerpo } = await armar();
  const med = new Map();
  for (const id of TODOS) {
    const m = modelo(cuerpo, id);
    if (m) med.set(id, medidasPropias(THREE, m));
  }
  const nuevos = IDS_ARMA.filter((id) => med.has(id));
  s.ok(med.size >= IDS_MANO.length, 'premisa: se midieron los modelos de la ronda 5', `${med.size}`);
  const f = (v) => v.map((x) => x.toFixed(2)).join('×');
  s.nota(nuevos.map((id) => `${id} ${f(med.get(id))}`).join(' · ') || 'ningún modelo nuevo todavía');
  for (const id of nuevos) {
    const [largo] = med.get(id);
    s.ok(largo >= 0.05 && largo <= 3.2, `${id}: la medida mayor está entre 5 cm y 3,2 m`, largo.toFixed(2));
  }
  const parecidos = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 0.15 * Math.max(v, b[k]));
  const ids = [...med.keys()];
  const pares = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (parecidos(med.get(ids[i]), med.get(ids[j]))) pares.push(`${ids[i]}~${ids[j]}`);
  }
  s.ok(pares.length === 0, 'ningún par de modelos con las tres medidas dentro del 15 %', pares.join(' ') || 'ninguno');
  s.feliz = nuevos.length > 0;
  s.felizQue = `${nuevos.length} modelos nuevos medidos`;
  return s;
}

/**
 * El cuerpo con este id en la mano, **en la pose del juego**: la carga asentada y
 * las matrices de TODO el cuerpo recalculadas.
 *
 * La primera versión medía mal, y lo encontró el agente leyendo este banco antes
 * de escribir una línea. Actualizaba las matrices una sola vez con la mano vacía y
 * después, por modelo, sólo `m.updateMatrixWorld(true)`; pero `Box3.setFromObject`
 * no recalcula los padres, así que el objeto se medía contra la matriz vieja de la
 * mano sin carga. Y con un solo cuadro por id la pose de carga, que se suaviza, no
 * llegaba a asentarse. El banco veía el objeto unos 10 cm más abajo y más inclinado
 * que en el juego: el pico de asta daba 0,64 m y asentado da 0,82.
 */
function asentado(cuerpo, id) {
  cuerpo.enMano = id;
  for (let k = 0; k < 60; k++) cuerpo.actualizar(1 / 60, jugador());
  cuerpo.grupo.updateMatrixWorld(true);
  return id ? (cuerpo.manos?.[1]?.getObjectByName(`mano:${id}`) ?? cuerpo.grupo.getObjectByName(`mano:${id}`) ?? null) : null;
}

async function suelo() {
  const s = seccion(4, 'EL SUELO — parado, nada baja a menos de 2 cm de los pies');
  const { THREE, cuerpo } = await armar();
  asentado(cuerpo, null);
  const pies = new THREE.Box3().setFromObject(cuerpo.grupo).min.y;
  s.ok(Number.isFinite(pies) && Math.abs(pies - 800) < 0.1, 'premisa: la planta de los pies está en el suelo', (pies - 800).toFixed(3));
  let medidos = 0;
  const bajos = [];
  const tabla = [];
  for (const id of TODOS) {
    const m = asentado(cuerpo, id);
    if (!m) continue;
    if (IDS_ARMA.includes(id)) medidos++;
    const minY = new THREE.Box3().setFromObject(m).min.y - pies;
    tabla.push(`${id} ${minY.toFixed(2)}`);
    if (minY < 0.02) bajos.push(`${id} ${minY.toFixed(2)}`);
  }
  s.nota(`sobre la planta de los pies, en metros: ${tabla.join(' · ')}`);
  s.ok(bajos.length === 0, 'ningún modelo baja a menos de 2 cm de la planta de los pies', bajos.join(' · ') || 'ninguno');
  s.feliz = medidos > 0;
  s.felizQue = `${medidos} modelos del arma medidos contra el suelo`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LA LLAMA APAGADA
// ═══════════════════════════════════════════════════════════════════════════

/** Cuántas mallas visibles con material emisivo hay en un modelo. */
function brillos(m) {
  let n = 0;
  m?.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((x) => x?.emissive && ((x.emissive.r + x.emissive.g + x.emissive.b) / 3) * (x.emissiveIntensity ?? 1) > 0.15)) n++;
  });
  return n;
}

async function llamaApagada() {
  const s = seccion(5, 'LA LLAMA APAGADA — la antorcha y el candil apagados no brillan');
  const { cuerpo } = await armar();
  // Antes de escribir nada: una asignación a una propiedad que no existe la crea,
  // y la pregunta daría que sí por la propia pregunta.
  const tiene = typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(cuerpo), 'llamaEncendida')?.set === 'function';
  s.ok(tiene, 'Cuerpo tiene la propiedad llamaEncendida, con setter');

  cuerpo.llamaEncendida = true;
  const prendida = brillos(modelo(cuerpo, 'antorcha'));
  s.ok(prendida >= 1, 'premisa: la antorcha prendida muestra su llama', prendida);

  cuerpo.llamaEncendida = false;
  cuerpo.actualizar(1 / 60, jugador());
  const apagada = brillos(cuerpo.manos?.[1]?.getObjectByName('mano:antorcha'));
  s.ok(apagada === 0, 'apagada, la antorcha en la mano no brilla', apagada);

  modelo(cuerpo, 'hacha_piedra');
  const deVuelta = brillos(modelo(cuerpo, 'antorcha'));
  s.ok(deVuelta === 0, 'cambiar de objeto y volver a colgarla la deja apagada', deVuelta);

  cuerpo.llamaEncendida = true;
  cuerpo.actualizar(1 / 60, jugador());
  s.ok(brillos(cuerpo.manos?.[1]?.getObjectByName('mano:antorcha')) >= 1, 'prenderla la vuelve a mostrar');

  const candilPrendido = brillos(modelo(cuerpo, 'candil_grasa'));
  s.ok(candilPrendido >= 1, 'premisa: el candil prendido muestra su llama', candilPrendido);
  cuerpo.llamaEncendida = false;
  cuerpo.actualizar(1 / 60, jugador());
  s.ok(brillos(cuerpo.manos?.[1]?.getObjectByName('mano:candil_grasa')) === 0, 'el candil apagado tampoco brilla');

  s.ok(/cuerpo\.llamaEncendida\s*=/.test(leer('main.js')), 'main.js le dice al cuerpo si la llama está prendida');
  s.feliz = prendida >= 1;
  s.felizQue = `la antorcha prendida mostró ${prendida} mallas que brillan`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — las fases anteriores siguen verdes');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const real = { BANCO_SRC: path.join(RAIZ, 'src') };
  const otros = [
    ['banco-r5-fase3.mjs', '4/4', {}],
    ['banco-r7-fase1.mjs', '6/6', real],
    ['banco-r7-fase2.mjs', '4/4', real],
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

const SECCIONES = { cableado, losDoce, siluetas, suelo, llamaApagada, regresion, arranque };
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

console.log(`\n  BANCO R7 · FASE 2b — la empuñadura   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
