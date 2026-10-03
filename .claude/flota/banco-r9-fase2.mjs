/**
 * BANCO DE LA FASE 2 (desgaste) — ronda 9.
 *
 * Lo escribe el JEFE contra el contrato de RONDA9.md, antes de que el agente toque
 * nada. Corre contra `Equipo`/`Fabricacion`/`Inventario`/`Saberes` REALES y el
 * dataset real (`src/data/herramientas.json`), no contra maquetas.
 *
 *   D1 · `Equipo.desgastarId(id, cuanto)` existe, gasta la mejor instancia del id
 *        (grilla o puesta), respeta `efecto.luz` y `usos` no finito, y no toca
 *        `desgastar()`.
 *   D2 · `Fabricacion.fabricar()` gasta la herramienta REALMENTE usada (la primera
 *        de la lista que el jugador tiene sana), no una fija ni todas.
 *   D3 · el huso no pierde ningún uso al hilar (usos no finitos → no se gasta).
 *   D4 · las otras cinco recetas con `pideHerramienta` sí bajan un uso al fabricar.
 *   D5 · `estado()` no cambia para nada que no tenga `pideHerramienta`.
 *   D6 · `herramientas.json`: `balanceSaber.arreglo` ya no propone volver a pedirle
 *        `lasca_obsidiana` a `hacha_pulida`.
 *   D7 · sin regresión: `banco-r8-fase5.mjs` sigue verde.
 *   D8 · arranque — vite build.
 *
 * Uso: node .claude/flota/banco-r9-fase2.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
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
const leerJson = (rel) => JSON.parse(fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8'));

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

async function sistemas() {
  const [{ Inventario }, { Saberes }, { Equipo }, { Fabricacion }] = await Promise.all([
    import(urlDe('systems/Inventario.js')),
    import(urlDe('systems/Saberes.js')),
    import(urlDe('systems/Equipo.js')),
    import(urlDe('systems/Fabricacion.js')),
  ]);
  return { Inventario, Saberes, Equipo, Fabricacion };
}

let DATOS, HISTORIA;
function datos() { return DATOS ??= leerJson('data/herramientas.json'); }
function historia() { return HISTORIA ??= leerJson('data/historia.json'); }
const obj = (id) => datos().objetos.find((o) => o.id === id);

async function mundo() {
  const { Inventario, Saberes, Equipo, Fabricacion } = await sistemas();
  const inventario = new Inventario(38);
  const saberes = new Saberes(historia(), inventario);
  const equipo = new Equipo(datos(), { inventario });
  // Las seis recetas con pideHerramienta no piden ninguna tecnología (confirmado:
  // lasca_rodado, preforma_hacha, martillo_piedra, medula_hueso y mango_labrado
  // tienen tecnologia:null; hilar_lana pide telar_witral, que se agrega aparte).
  const fabricacion = new Fabricacion(datos(), { inventario, saberes, equipo, fundicion: null });
  return { inventario, saberes, equipo, fabricacion };
}

// ── D1 · Equipo.desgastarId ──────────────────────────────────────────────────

async function desgastarId() {
  const s = seccion(1, 'D1 · Equipo.desgastarId(id, cuanto) — nuevo, sin tocar desgastar()');
  const { equipo, inventario } = await mundo();
  if (typeof equipo.desgastarId !== 'function') { s.ok(false, 'Equipo.desgastarId existe'); s.felizQue = 'no existe el método'; return s; }
  s.ok(true, 'Equipo.desgastarId existe');

  // Dos percutores en la grilla (sin equipar), uno más gastado que el otro.
  equipo.guardar('percutor'); equipo.guardar('percutor');
  const antes = equipo.usosDe('percutor');
  s.ok(antes === obj('percutor').durabilidad, 'arranca con la durabilidad de su ficha', antes);

  const cayo = equipo.desgastarId('percutor');
  s.ok(cayo === false, 'con dos sanos, gastar uno no lo deja en 0 (durabilidad 30, gasta 1)', cayo);
  s.ok(equipo.usosDe('percutor') === antes, 'usosDe (la MEJOR instancia) sigue en el tope: hay otra sana', equipo.usosDe('percutor'));

  // Gastar hasta romper una instancia entera sin tocar la otra de a una vez.
  for (let i = 0; i < antes; i++) equipo.desgastarId('percutor');
  s.ok(equipo.tiene('percutor'), 'sigue existiendo (dos instancias, rompió sólo una)', equipo.tiene('percutor'));

  // Un id que no existe en absoluto: no explota, devuelve false.
  let explotoConIdRaro = false;
  try { equipo.desgastarId('__no_existe_seguro__'); } catch { explotoConIdRaro = true; }
  s.ok(!explotoConIdRaro, 'un id sin ninguna instancia no explota', explotoConIdRaro);
  s.ok(equipo.desgastarId('__no_existe_seguro__') === false, 'y devuelve false', true);

  // No debe tocar el comportamiento de desgastar() (Caza sigue igual: gasta lo
  // puesto en la mano, no busca por id).
  const { equipo: eq2 } = await mundo();
  eq2.guardar('percutor'); eq2.equipar('percutor');
  const usosPrevios = eq2.usosDe('percutor');
  eq2.desgastar();
  s.ok(eq2.usosDe('percutor') === usosPrevios - 1, 'desgastar() (la de Caza) sigue gastando lo puesto en mano, igual que siempre', eq2.usosDe('percutor'));

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'desgastarId no se comporta como pide D1';
  return s;
}

// ── D2 · Fabricacion gasta la herramienta REALMENTE usada ───────────────────

async function herramientaUsada() {
  const s = seccion(2, 'D2 · se gasta la que el jugador tiene, no una fija ni todas');
  const receta = obj('mango_labrado');
  const darMateriales = (inv) => { for (const m of receta.materiales || []) inv.agregar(m.recurso, m.cantidad); };

  // mango_labrado pide CUALQUIERA de ["lasca_rodado","lasca","cuchillo"]. Se le da
  // sólo "cuchillo" (el último de la lista): tiene que ser ÉSE el que se gaste, no
  // explotar buscando el primero.
  const { inventario, equipo, fabricacion } = await mundo();
  equipo.guardar('cuchillo');
  darMateriales(inventario);
  const usosAntes = equipo.usosDe('cuchillo');
  const e = fabricacion.estado(receta);
  s.ok(e.estado === 'lista', 'con sólo cuchillo, mango_labrado está lista', e.estado);
  const r = fabricacion.fabricar(receta);
  s.ok(r.estado === 'hecho', 'se fabrica', r.estado);
  s.ok(equipo.usosDe('cuchillo') === usosAntes - 1, 'el cuchillo (el que tenía) perdió un uso', `${equipo.usosDe('cuchillo')} vs ${usosAntes - 1}`);

  // Con dos alternativas disponibles (lasca_rodado y cuchillo), se gasta la
  // PRIMERA de la lista que sirve (lasca_rodado), no cualquiera ni las dos.
  const { inventario: inv2, equipo: eq2, fabricacion: fab2 } = await mundo();
  eq2.guardar('lasca_rodado'); eq2.guardar('cuchillo');
  darMateriales(inv2);
  const usosLascaAntes = eq2.usosDe('lasca_rodado');
  const usosCuchilloAntes = eq2.usosDe('cuchillo');
  fab2.fabricar(receta);
  s.ok(eq2.usosDe('lasca_rodado') === usosLascaAntes - 1, 'con las dos disponibles, se gasta la primera de la lista (lasca_rodado)', eq2.usosDe('lasca_rodado'));
  s.ok(eq2.usosDe('cuchillo') === usosCuchilloAntes, 'y el cuchillo queda intacto', eq2.usosDe('cuchillo'));

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'se gasta la herramienta equivocada, todas, o ninguna';
  return s;
}

// ── D3 · el huso no se gasta ─────────────────────────────────────────────────

async function husoNoSeGasta() {
  const s = seccion(3, 'D3 · hilar_lana no le baja ningún uso al huso');
  const { inventario, saberes, equipo, fabricacion } = await mundo();
  saberes.desbloqueadas.add('telar_witral');
  equipo.guardar('huso');
  inventario.agregar('lana', 4 * 6);

  s.ok(!Number.isFinite(equipo.usosDe('huso')), 'el huso arranca con usos no finitos (sin durabilidad declarada)', equipo.usosDe('huso'));

  for (let i = 0; i < 6; i++) {
    const e = fabricacion.estado(obj('hilar_lana'));
    if (e.estado !== 'lista') { s.ok(false, `hilar_lana está lista en la vuelta ${i}`, e.estado); break; }
    fabricacion.fabricar(obj('hilar_lana'));
  }
  s.ok(!Number.isFinite(equipo.usosDe('huso')), 'después de hilar 6 veces, el huso sigue con usos no finitos', equipo.usosDe('huso'));
  s.ok(equipo.tiene('huso') && !equipo.gastado('huso'), 'y sigue sano', { tiene: equipo.tiene('huso'), gastado: equipo.gastado('huso') });

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'el huso se gastó, o hilar dejó de funcionar';
  return s;
}

// ── D4 · las otras cinco sí se gastan ────────────────────────────────────────

async function lasCincoSeGastan() {
  const s = seccion(4, 'D4 · las cinco recetas restantes bajan un uso al fabricar');
  const CASOS = [
    { receta: 'lasca_rodado', herramienta: 'percutor', materiales: { piedra: 2 } },
    { receta: 'preforma_hacha', herramienta: 'percutor', materiales: null },
    { receta: 'martillo_piedra', herramienta: 'percutor', materiales: null },
    { receta: 'medula_hueso', herramienta: 'martillo_piedra', materiales: null },
  ];
  for (const c of CASOS) {
    // Ninguna de estas cuatro recetas pide tecnología (las cuatro tienen
    // tecnologia:null, verificado al escribir el contrato), así que alcanza con
    // materiales + herramienta.
    const { equipo, inventario, fabricacion } = await mundo();
    equipo.guardar(c.herramienta);
    for (const m of (obj(c.receta)?.materiales || [])) inventario.agregar(m.recurso, m.cantidad);
    const usosAntes = equipo.usosDe(c.herramienta);
    const e = fabricacion.estado(obj(c.receta));
    if (e.estado !== 'lista') { s.ok(false, `${c.receta} está lista con sólo materiales + ${c.herramienta}`, e); continue; }
    const r = fabricacion.fabricar(obj(c.receta));
    s.ok(r.estado === 'hecho', `${c.receta} se fabrica`, r.estado);
    s.ok(equipo.usosDe(c.herramienta) === usosAntes - 1, `${c.herramienta} perdió exactamente un uso fabricando ${c.receta}`, `${equipo.usosDe(c.herramienta)} vs ${usosAntes - 1}`);
  }
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'alguna de las cinco no gasta su herramienta';
  return s;
}

// ── D5 · estado() no cambia para lo que no pide herramienta ─────────────────

async function estadoSinCambios() {
  const s = seccion(5, 'D5 · nada sin pideHerramienta se ve afectado');
  const { inventario, fabricacion } = await mundo();
  inventario.agregar('fibra', 3);
  s.ok(fabricacion.estado(obj('cordel_fibra')).estado === 'lista', 'cordel_fibra (sin pideHerramienta) sigue listo con sus materiales', fabricacion.estado(obj('cordel_fibra')).estado);
  const r = fabricacion.fabricar(obj('cordel_fibra'));
  s.ok(r.estado === 'hecho', 'y se fabrica normalmente', r.estado);
  s.ok(inventario.cantidad('cordel') === 2, 'con el mismo resultado de siempre', inventario.cantidad('cordel'));

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'algo sin pideHerramienta cambió de comportamiento';
  return s;
}

// ── D6 · balanceSaber corregido ──────────────────────────────────────────────

async function balanceSaberCorregido() {
  const s = seccion(6, 'D6 · balanceSaber.arreglo ya no pide volver a lasca_obsidiana');
  const d = datos();
  const bs = d.balanceSaber;
  s.ok(!!bs, 'balanceSaber sigue existiendo en herramientas.json', !!bs);
  const arreglo = String(bs?.arreglo || '');
  // El texto viejo proponía LITERALMENTE la asignación "hacha_pulida.requiere =
  // [lasca_obsidiana]" como código a escribir. Se busca esa forma exacta (no basta
  // con que las dos palabras aparezcan cerca: el texto corregido puede — y debe —
  // seguir NOMBRANDO la dependencia vieja para explicar por qué no se aplica).
  const proponeVolverAtras = /hacha_pulida\.requiere\s*=\s*\[\s*lasca_obsidiana\s*\]/.test(arreglo);
  s.ok(!proponeVolverAtras, 'el texto ya no propone que hacha_pulida vuelva a depender de lasca_obsidiana', arreglo.slice(0, 200));

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'balanceSaber sigue contradiciendo la fase 5';
  return s;
}

// ── D7 · sin regresión ────────────────────────────────────────────────────────

async function regresion() {
  const s = seccion(7, 'D7 · sin regresión — banco-r8-fase5.mjs sigue verde');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  if (process.env.BANCO_SALTAR_REGRESION) { s.feliz = true; s.nota('salteado por BANCO_SALTAR_REGRESION (sólo para iterar rápido)'); return s; }
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(AQUI, 'banco-r8-fase5.mjs')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SIN_BUILD: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/total (\d+)\/(\d+)/);
  s.ok(!!m && m[1] === m[2], 'banco-r8-fase5.mjs sigue en verde total', m ? `${m[1]}/${m[2]}` : salida.slice(-800));
  s.feliz = !!m && m[1] === m[2];
  s.felizQue = s.feliz ? '' : 'la cadena de la piedra de la ronda 8 se puso roja';
  return s;
}

// ── D8 · arranque ─────────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(8, 'D8 · arranque — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { desgastarId, herramientaUsada, husoNoSeGasta, lasCincoSeGastan, estadoSinCambios, balanceSaberCorregido, regresion, arranque };

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

console.log(`\n  BANCO R9 · FASE 2 — desgaste   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
