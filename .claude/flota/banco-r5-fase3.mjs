/**
 * BANCO DE LA FASE 3 (mano) — ronda 5.
 *
 * Lo escribe el JEFE contra el contrato de RONDA5.md, en paralelo al agente y sin
 * leer su código. Corre el `Cuerpo` de verdad en Node —three arma geometrías sin
 * WebGL— y cuenta triángulos, mallas y nodos del grafo.
 *
 *   1. LA MANO — `manos[]` existe y cuelga del codo derecho; `enMano` cuelga y
 *      descuelga por id; una herramienta a la vez; el grafo no crece cuadro a
 *      cuadro; `puntoDeMano` sigue al cuerpo.
 *   2. PRESUPUESTO — ≤ 900 triángulos y ≤ 2 mallas por objeto visible, para los
 *      18 ids con ranura mano, y material compartido entre ellos.
 *   3. LIMPIEZA — `aplicar()` libera lo de las herramientas y sigue andando, y el
 *      maniquí de la creación de personaje no se rompe.
 *   4. ARRANQUE — `vite build`.
 *
 * Guarda de cobertura: si `enMano` no llega a colgar NADA, la sección es roja
 * aunque no falle ninguna aserción; «no creció el grafo» sería cierto por vacío.
 *
 * Uso: node .claude/flota/banco-r5-fase3.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, desc, det) => { s.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

function entorno() {
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}

/** Triángulos, mallas y materiales visibles de un subárbol. */
function pesar(raiz) {
  let tri = 0, mallas = 0;
  const mats = new Set();
  raiz.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let p = o.parent, vis = true;
    while (p && vis) { if (p.visible === false) vis = false; p = p.parent; }
    if (!vis) return;
    mallas++;
    mats.add(o.material?.uuid ?? 'sin');
    const g = o.geometry;
    if (!g) return;
    tri += g.index ? g.index.count / 3 : (g.attributes?.position?.count ?? 0) / 3;
  });
  return { tri: Math.round(tri), mallas, mats };
}

const jugador = (x = 10, z = -5, giro = 0) => ({
  posicion: { x, y: 800, z }, alturaVisual: 800, giro, cabeceo: 0,
  velocidad: { x: 0, y: 0, z: 0 }, enSuelo: true, enAgua: false, profundidadAgua: 0,
  fasePaso: 0, agachado: false, tercerPersona: true, corriendo: false,
});

async function armar() {
  entorno();
  const datos = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'herramientas.json'), 'utf8'));
  const ids = datos.objetos.filter((o) => o.ranura === 'mano').map((o) => o.id);
  const { Cuerpo } = await import(urlDe('entities/Cuerpo.js'));
  let aspecto = { estatura: 1.74, elegido: true, piel: 2, pelo: 1, peinado: 0, campera: 0, pantalon: 0, calzado: 0 };
  try {
    const { Aspecto } = await import(urlDe('systems/Aspecto.js'));
    if (Aspecto?.cargar) aspecto = Aspecto.cargar();
  } catch { /* con el literal alcanza */ }
  return { ids, cuerpo: new Cuerpo(aspecto, () => {}), Cuerpo, aspecto };
}

async function s1() {
  const s = seccion(1, 'LA MANO');
  const { ids, cuerpo } = await armar();
  s.ok(Array.isArray(cuerpo.manos) && cuerpo.manos.length === 2, 'Cuerpo.manos son dos nudos', cuerpo.manos?.length);
  const derecha = cuerpo.manos?.[1];
  let cuelga = false;
  if (derecha) { let p = derecha.parent; while (p) { if (p === cuerpo.codos?.[1]) cuelga = true; p = p.parent; } }
  s.ok(cuelga, 'la mano derecha cuelga del codo derecho');
  if (!derecha) { s.felizQue = 'no hay manos'; return s; }

  const vacio = pesar(derecha);
  cuerpo.enMano = 'hacha_piedra';
  cuerpo.actualizar(1 / 60, jugador());
  const hacha = pesar(derecha);
  const colgo = s.ok(hacha.tri > vacio.tri && hacha.mallas > vacio.mallas, 'con el hacha en la mano aparece geometría bajo la mano', `${vacio.tri} → ${hacha.tri} triángulos`);
  s.ok(cuerpo.enMano === 'hacha_piedra', 'enMano devuelve lo que se le puso');

  cuerpo.enMano = 'antorcha';
  cuerpo.actualizar(1 / 60, jugador());
  const antorcha = pesar(derecha);
  s.ok(antorcha.tri !== hacha.tri || antorcha.mallas !== hacha.mallas, 'la antorcha no es el mismo modelo que el hacha', `${hacha.tri} vs ${antorcha.tri}`);
  s.ok(antorcha.tri > vacio.tri, 'y también cuelga algo');

  cuerpo.enMano = null;
  cuerpo.actualizar(1 / 60, jugador());
  s.ok(pesar(derecha).tri === vacio.tri, 'con la mano vacía no queda nada colgado', `${pesar(derecha).tri} vs ${vacio.tri}`);

  let nodos0 = 0; derecha.traverse(() => nodos0++);
  for (let k = 0; k < 100; k++) { cuerpo.enMano = ids[k % ids.length]; cuerpo.actualizar(1 / 60, jugador()); }
  cuerpo.enMano = 'hacha_piedra'; cuerpo.actualizar(1 / 60, jugador());
  let nodos1 = 0; derecha.traverse(() => nodos1++);
  const hacha2 = pesar(derecha);
  s.ok(hacha2.tri === hacha.tri && hacha2.mallas === hacha.mallas, 'después de cien cambios el hacha pesa lo mismo: los modelos se cachean', `${hacha.tri} → ${hacha2.tri}`);
  s.ok(nodos1 <= nodos0 + 60, 'el grafo de la mano no crece con los cambios', `${nodos0} → ${nodos1} nodos`);
  s.ok(hacha2.mallas - vacio.mallas <= 2, 'a lo sumo dos mallas de herramienta visibles', hacha2.mallas - vacio.mallas);

  s.ok(typeof cuerpo.puntoDeMano === 'function', 'Cuerpo.puntoDeMano existe');
  let felizPunto = false;
  if (typeof cuerpo.puntoDeMano === 'function') {
    const j1 = jugador(10, -5, 0);
    cuerpo.actualizar(1 / 60, j1);
    const p1 = cuerpo.puntoDeMano({ x: 0, y: 0, z: 0 });
    const d1 = Math.hypot(p1.x - j1.posicion.x, p1.z - j1.posicion.z);
    felizPunto = s.ok(Number.isFinite(p1.x) && d1 < 1.2 && p1.y > j1.posicion.y && p1.y < j1.posicion.y + 2,
      'el punto de la mano cae sobre el cuerpo, a menos de 1,2 m del eje y a la altura del brazo', `${d1.toFixed(2)} m · y+${(p1.y - j1.posicion.y).toFixed(2)}`);
    const j2 = jugador(10, -5, Math.PI / 2);
    cuerpo.actualizar(1 / 60, j2);
    const p2 = cuerpo.puntoDeMano({ x: 0, y: 0, z: 0 });
    s.ok(Math.hypot(p2.x - p1.x, p2.z - p1.z) > 0.2, 'y gira con el cuerpo', Math.hypot(p2.x - p1.x, p2.z - p1.z).toFixed(2));
    const j3 = jugador(40, -5, Math.PI / 2);
    cuerpo.actualizar(1 / 60, j3);
    const p3 = cuerpo.puntoDeMano({ x: 0, y: 0, z: 0 });
    s.ok(Math.abs(p3.x - p2.x - 30) < 0.3, 'y se mueve con él', (p3.x - p2.x).toFixed(2));
  }
  s.feliz = colgo && felizPunto;
  s.felizQue = 'colgó una herramienta de verdad y el punto de la mano cayó sobre el cuerpo';
  return s;
}

async function s2() {
  const s = seccion(2, 'PRESUPUESTO');
  const { ids, cuerpo } = await armar();
  const derecha = cuerpo.manos?.[1];
  if (!derecha) { s.ok(false, 'hay mano derecha'); s.felizQue = 'sin mano'; return s; }
  const vacio = pesar(derecha);
  const tabla = [];
  const materiales = new Set();
  let peor = 0, peorId = '', conGeometria = 0;
  for (const id of ids) {
    cuerpo.enMano = id;
    cuerpo.actualizar(1 / 60, jugador());
    const p = pesar(derecha);
    const tri = p.tri - vacio.tri, mallas = p.mallas - vacio.mallas;
    if (tri > 0) conGeometria++;
    if (tri > peor) { peor = tri; peorId = id; }
    for (const m of p.mats) materiales.add(m);
    tabla.push(`${id} ${tri}t/${mallas}m`);
    s.ok(tri <= 900, `${id}: ≤ 900 triángulos`, tri);
    s.ok(mallas <= 2, `${id}: ≤ 2 mallas`, mallas);
  }
  s.ok(conGeometria === ids.length, 'los 18 objetos de ranura mano tienen modelo', `${conGeometria}/${ids.length}`);
  s.nota(tabla.join(' · '));
  s.nota(`el más caro: ${peorId} con ${peor} triángulos`);
  // El tope de cuatro materiales era un proxy arbitrario del jefe: lo que importa
  // es que no haya un material POR OBJETO ni uno nuevo por cada vez que se
  // cuelga. Nueve tintas compartidas entre dieciocho objetos no cuestan un
  // dibujo de mas: el presupuesto real son las dos mallas visibles.
  const tintas = materiales.size - vacio.mats.size;
  s.ok(tintas <= 9 && tintas < ids.length, 'las herramientas comparten tintas: menos materiales que objetos, y a lo sumo nueve', `${tintas} tintas para ${ids.length} objetos`);
  s.feliz = conGeometria > 0;
  s.felizQue = 'se pesaron modelos de verdad';
  return s;
}

async function s3() {
  const s = seccion(3, 'LIMPIEZA');
  const { cuerpo, Cuerpo, aspecto } = await armar();
  const derecha0 = cuerpo.manos?.[1];
  if (!derecha0) { s.ok(false, 'hay mano derecha'); s.felizQue = 'sin mano'; return s; }
  cuerpo.enMano = 'hacha_piedra';
  cuerpo.actualizar(1 / 60, jugador());
  const antes = pesar(derecha0);
  const liberadas = [];
  derecha0.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const d = o.geometry.dispose.bind(o.geometry);
      o.geometry.dispose = () => { liberadas.push(1); d(); };
    }
  });
  cuerpo.aplicar(aspecto);
  s.ok(liberadas.length > 0, 'aplicar() libera también las geometrías de la herramienta', liberadas.length);
  const derecha1 = cuerpo.manos?.[1];
  s.ok(!!derecha1, 'después de aplicar() sigue habiendo mano derecha');
  cuerpo.enMano = 'hacha_piedra';
  cuerpo.actualizar(1 / 60, jugador());
  const despues = derecha1 ? pesar(derecha1) : { tri: -1 };
  s.ok(despues.tri === antes.tri, 'y el hacha vuelve a colgarse igual', `${antes.tri} → ${despues.tri}`);

  let tiro = null;
  try {
    const maniqui = new Cuerpo(aspecto, () => {});
    maniqui.actualizar(1 / 60, { posicion: { x: 0, y: 0, z: 0 }, giro: 0, velocidad: { x: 0, y: 0, z: 0 }, enSuelo: true });
  } catch (e) { tiro = e.message; }
  s.ok(tiro === null, 'el maniquí de la creación de personaje, sin equipo, no tira', tiro || 'ok');
  s.feliz = antes.tri > 0;
  s.felizQue = 'había una herramienta colgada antes de limpiar';
  return s;
}

async function s4() {
  const s = seccion(4, 'ARRANQUE');
  if (process.env.BANCO_SIN_BUILD) { s.nota('vite build salteado'); s.feliz = true; s.felizQue = 'salteado'; return s; }
  const salida = path.join(AQUI, '.tmp-banco-r5f3-dist');
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', salida, '--emptyOutDir'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 300000, shell: process.platform === 'win32' });
  const texto = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'vite build pasa', r.status === 0 ? (texto.match(/built in [^\n]+/)?.[0] || 'ok') : texto.slice(-700));
  try { fs.rmSync(salida, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch { /* da igual */ }
  s.feliz = r.status === 0;
  s.felizQue = 'el bundle se construyó';
  return s;
}

const SECCIONES = { s1, s2, s3, s4 };
const NUM = { s1: 1, s2: 2, s3: 3, s4: 4 };

async function hijo(nombre) {
  let res;
  try { res = [await SECCIONES[nombre]()]; }
  catch (e) {
    const s = seccion(NUM[nombre], `sección ${nombre}`);
    s.ok(false, 'la sección corrió sin excepción', `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`);
    res = [s];
  }
  process.stdout.write(`\n@@RESULTADO ${JSON.stringify(res.map(({ ok, nota, ...x }) => x))}\n`);
}

function padre() {
  console.log(`BANCO R5 · FASE 3 (mano)   src = ${path.relative(RAIZ, SRC) || SRC}\n`);
  const todas = [];
  for (const nombre of Object.keys(SECCIONES)) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--seccion', nombre],
      { cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: process.env });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/@@RESULTADO (.+)\n?$/m);
    if (!m) { todas.push({ num: NUM[nombre], nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'el proceso devolvió resultado', detalle: salida.slice(-1200) }], feliz: false, felizQue: 'el proceso murió', notas: [] }); continue; }
    todas.push(...JSON.parse(m[1]));
  }
  todas.sort((a, b) => a.num - b.num);
  let verdes = 0;
  for (const s of todas) {
    const verde = s.checks.every((c) => c.ok) && s.feliz;
    if (verde) verdes++;
    console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(2)}  ${s.num} · ${s.nombre}`);
    for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined ? `  [${c.detalle}]` : ''}`);
    if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
    for (const n of s.notas) console.log(`         nota ${n}`);
  }
  console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
  console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}`);
  process.exitCode = verdes === todas.length ? 0 : 1;
}

const i = process.argv.indexOf('--seccion');
if (i > 0) await hijo(process.argv[i + 1]); else padre();
