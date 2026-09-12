/**
 * BANCO DE LA FASE 2 (instancia) — ronda 6.
 *
 * Lo escribe el JEFE contra el contrato de RONDA6.md, en paralelo al agente y sin
 * leer su código. Corre el `Equipo`, el `Inventario` y la `Partida` de verdad en
 * Node con el `herramientas.json` de verdad.
 *
 *   1. LA FASE 1 SIGUE EN PIE — los recursos no se enteraron de nada. Verde en
 *      la base: es red de regresión, no medición nueva.
 *   2. LA API VIEJA DE EQUIPO — `enRanura`, `suma`, `puede`, `mejorPara`,
 *      `faltaPara`, `desgastar`, `listar`, y la llama de la ronda 5. También
 *      verde en la base, y por el mismo motivo.
 *   3. INSTANCIAS — dos hachas son dos casilleros con durabilidades distintas, y
 *      no apilan nunca.
 *   4. LA RANURA — equipar saca de la grilla, desequipar devuelve, con el bolso
 *      lleno falla limpio, y lo puesto pesa pero no ocupa casillero.
 *   5. FABRICAR — la segunda hacha es una segunda hacha; sin lugar no se fabrica
 *      y no se pierden los materiales.
 *   6. EL GUARDADO — `taller` viejo entra como instancias, el nuevo vuelve igual.
 *   7. NUEVE NO AHOGAN — con nueve herramientas encima, 500 cargas mixtas llegan
 *      al tope de peso sin quedarse sin casilleros. Con doce, se anota que sí.
 *   8. ARRANQUE — `vite build`.
 *
 * Guarda de cobertura por sección: si el camino feliz no pasó, la sección es
 * roja aunque no falle ninguna aserción.
 *
 * Uso: node .claude/flota/banco-r6-fase2.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}`;
const DATOS = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'herramientas.json'), 'utf8'));

/** Las 44 cosas que se tienen. Las 12 recetas no pasan por `Equipo`. */
const COSAS = (DATOS.objetos || []).filter(o => !(o.esReceta || o.produce));
const defDe = (id) => COSAS.find(o => o.id === id);

// Objetos concretos, elegidos del dataset de verdad al escribir el banco.
const HACHA = 'lasca';            // mano, nivel 1, 40 usos, 0,2 kg, habilita cortar
const CUCHILLO = 'cuchillo';      // mano, nivel 1, 90 usos, 0,5 kg
const GARROTE = 'garrote';        // arma, nivel 0, 30 usos, 1,2 kg
const QUILLANGO = 'quillango';    // abrigo, 200 usos, 4,5 kg, da abrigo
const CANASTO = 'canasto_junco_obj'; // espalda, 150 usos, 1,5 kg, +6 kg

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

async function mods() {
  const { Inventario } = await import(urlDe('systems/Inventario.js'));
  const { Equipo } = await import(urlDe('systems/Equipo.js'));
  const R = await import(urlDe('systems/Recursos.js'));
  return { Inventario, Equipo, R };
}

/** Un bolso y un equipo enchufados como en el juego. */
async function mundo(cap = 38) {
  const { Inventario, Equipo, R } = await mods();
  // El catálogo de pesos de los objetos, que es como D2 pide que se lo pasen.
  const catalogo = new Map(COSAS.map(o => [o.id, { kg: o.kg ?? 0 }]));
  let inv;
  try { inv = new Inventario(cap, { catalogo }); } catch { inv = new Inventario(cap); }
  if (inv.catalogo === undefined && 'catalogo' in inv === false) inv.catalogo = catalogo;
  inv.capacidadKg = cap;
  const equipo = new Equipo(DATOS, { inventario: inv });
  return { inv, equipo, R };
}

/** Cuántos casilleros tiene ocupados una instancia de este id. */
const casillasDe = (inv, id) => (inv.casillas || []).filter(c => c && c.id === id).length;
/** Las instancias de un id que hay en la grilla. */
const instanciasDe = (inv, id) => (inv.casillas || []).filter(c => c && c.id === id);

/**
 * El `saberes` de mentira que `Fabricacion.estado()` necesita: consulta
 * `desbloqueadas.has()` y `porId.get()`, y sin el segundo revienta con
 * «Cannot read properties of undefined». Se le da todo por sabido, porque lo
 * que esta fase mide no es el árbol de tecnologías.
 */
const SABERES = () => ({
  desbloqueadas: { has: () => true },
  porId: new Map(),
  suma: () => 0,
});

function azar(semilla) {
  let s = semilla >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// ── 1 · LA FASE 1 SIGUE EN PIE ──────────────────────────────────────────────

async function fase1() {
  const s = seccion(1, 'LA FASE 1 SIGUE EN PIE — los recursos no se enteraron');
  const { inv, R } = await mundo(38);

  const n = inv.agregar('madera_dura', 3);
  s.feliz = n === 3 && inv.cantidad('madera_dura') === 3;
  s.felizQue = `agregar 3 madera_dura devolvió ${n}`;

  s.ok(inv.casillas.length === 24, 'siguen siendo 24 casillas con 38 kg', inv.casillas.length);
  s.ok(R.pilaDe(0.5) === 5, 'la madera blanda sigue apilando de a 5', R.pilaDe(0.5));
  s.ok(R.casillasPara(68) === 42, 'la rastra sigue dando 42', R.casillasPara(68));

  // DOS llamadas de 3, no una de 6, y la diferencia es todo: pidiendo 6 de una
  // vez la pila se llena dentro del mismo `agregar` y la prueba pasa aunque el
  // código no sepa completar una pila que ya estaba abierta de antes. El
  // falsador lo mostró: escondiéndole las pilas abiertas, el banco seguía verde.
  inv.agregar('madera_blanda', 3);
  inv.agregar('madera_blanda', 3);
  const mb = inv.casillas.filter(c => c?.id === 'madera_blanda');
  s.ok(mb.length === 2 && mb[0].n === 5 && mb[1].n === 1,
    'se sigue completando la pila abierta antes de abrir casillero', mb.map(c => c.n).join('+'));

  const antes = inv.casillas.map(c => c && c.id);
  inv.agregar('piedra', 1);
  inv.quitar('madera_dura', 3);
  s.ok(inv.casillas[antes.indexOf('madera_blanda')]?.id === 'madera_blanda',
    'las posiciones siguen sin correrse');

  s.ok(typeof inv.mover === 'function' && typeof inv.partir === 'function', 'mover y partir siguen ahí');
  s.ok(inv.items === undefined, 'items sigue sin existir');
  s.ok(inv.listar().filter(i => i.id === 'madera_blanda').length === 1,
    'listar sigue juntando las pilas en un renglón');
  s.ok(inv.disponiblePara('madera') === inv.cantidad('madera_blanda'),
    'las equivalencias siguen contando', inv.disponiblePara('madera'));
  return s;
}

// ── 2 · LA API VIEJA DE EQUIPO ──────────────────────────────────────────────

async function apiEquipo() {
  const s = seccion(2, 'LA API VIEJA DE EQUIPO — los 14 sitios de llamada siguen andando');
  const { inv, equipo } = await mundo(38);

  equipo.guardar(HACHA);
  const enMano = equipo.enRanura('mano');
  s.feliz = !!enMano && enMano.id === HACHA;
  s.felizQue = `fabricar ${HACHA} lo dejó en la mano: ${JSON.stringify(enMano && { id: enMano.id })}`;

  s.ok(enMano?.id === HACHA, 'enRanura devuelve algo con .id', enMano?.id);
  s.ok(typeof enMano?.nombre === 'string' && enMano.nombre.length > 0,
    'y con .nombre, que lo leen main, Cuerpo, Caza y Recoleccion', enMano?.nombre);

  s.ok(equipo.tiene(HACHA) === true, 'tiene() lo ve');
  s.ok(equipo.gastado(HACHA) === false, 'y no está gastado recién hecho');
  s.ok(equipo.usosDe(HACHA) === defDe(HACHA).durabilidad,
    'usosDe da la durabilidad entera', equipo.usosDe(HACHA));

  s.ok(equipo.puede('cortar') === true, 'puede() con el hacha en la mano');
  s.ok(equipo.puede('descarnar') === false, 'y no puede lo que el hacha no habilita');

  equipo.guardar(CUCHILLO);
  equipo.desequipar('mano');
  const mejor = equipo.mejorPara('cortar');
  s.ok(!!mejor, 'mejorPara encuentra algo guardado para la acción', mejor?.id);
  const falta = equipo.faltaPara('cortar');
  s.ok(falta?.motivo === 'no_equipada', 'faltaPara dice que hay que sacarlo, no fabricarlo', falta?.motivo);

  equipo.equipar(CUCHILLO);
  const usos0 = equipo.usosDe(CUCHILLO);
  const rompio = equipo.desgastar();
  s.ok(rompio === false, 'desgastar no dice que se rompió si le quedan usos', rompio);
  s.ok(equipo.usosDe(CUCHILLO) === usos0 - 1, 'y descontó uno', `${usos0} -> ${equipo.usosDe(CUCHILLO)}`);

  equipo.guardar(QUILLANGO);
  s.ok(equipo.suma('abrigo') > 0, 'suma() lee el efecto de lo puesto', equipo.suma('abrigo'));
  equipo.guardar(CANASTO);
  s.ok(equipo.suma('capacidadExtraKg') === 6, 'y la cestería sigue dando 6 kg', equipo.suma('capacidadExtraKg'));

  const lista = equipo.listar();
  const it = lista.find(x => x.id === CUCHILLO);
  s.ok(!!it, 'listar trae lo fabricado');
  for (const clave of ['nombre', 'nivel', 'categoria', 'ranura', 'usos', 'tope', 'gastado', 'puesto'])
    s.ok(it && clave in it, `listar trae ${clave}`, it && it[clave]);

  s.ok(Array.isArray(equipo.costoReparar(CUCHILLO)), 'costoReparar sigue devolviendo una lista');

  // La luz de la ronda 5 no se puede romper acá.
  const luz = COSAS.find(o => o.efecto?.luz && o.ranura === 'mano');
  if (luz) {
    equipo.guardar(luz.id);
    equipo.equipar(luz.id);
    const t0 = Date.parse('2026-01-01T20:00:00Z');
    const prendio = equipo.encender(luz.id, t0);
    s.ok(prendio !== false, `se prende ${luz.id}`, prendio);
    const act = equipo.luzActiva(t0 + 60000, { lluvia: 0 });
    s.ok(!!act, 'y luzActiva la ve prendida un minuto después', act && act.id);
    equipo.apagar(t0 + 120000);
    s.ok(!equipo.luzActiva(t0 + 180000, { lluvia: 0 }), 'y apagada deja de verse');
    s.ok(equipo.desgastar() === false, 'una luz no se gasta a golpes');
  } else s.ok(false, 'hay una luz de mano en el dataset para probar la ronda 5');

  return s;
}

// ── 3 · INSTANCIAS ──────────────────────────────────────────────────────────

async function instancias() {
  const s = seccion(3, 'INSTANCIAS — dos hachas son dos hachas');
  const { inv, equipo } = await mundo(38);
  if (!Array.isArray(inv.casillas)) { s.ok(false, 'hay grilla'); s.felizQue = 'no hay grilla'; return s; }

  equipo.guardar(HACHA);
  equipo.guardar(HACHA);
  const total = casillasDe(inv, HACHA) + (equipo.enRanura('mano')?.id === HACHA ? 1 : 0);
  s.feliz = total === 2;
  s.felizQue = `fabricar dos ${HACHA} dejó ${total} en total (grilla ${casillasDe(inv, HACHA)} + ranura)`;
  s.ok(total === 2, 'fabricar dos veces da DOS, no una renovada', total);

  // Las dos en la grilla, para poder mirarlas de a pares.
  equipo.desequipar('mano');
  const dos = instanciasDe(inv, HACHA);
  s.ok(dos.length === 2, 'las dos están en casilleros distintos', dos.length);
  s.ok(dos.every(c => c.n === 1), 'una instancia nunca lleva n > 1', dos.map(c => c.n).join(','));
  s.ok(dos.every(c => Number.isFinite(c.usos)), 'cada una trae sus usos', dos.map(c => c.usos).join(','));

  // Gastar una no gasta la otra.
  equipo.equipar(HACHA);
  const tope = defDe(HACHA).durabilidad;
  for (let i = 0; i < 5; i++) equipo.desgastar();
  const puesta = equipo.enRanura('mano');
  const guardada = instanciasDe(inv, HACHA)[0];
  s.ok(puesta?.usos === tope - 5, 'la que está en la mano se gastó', puesta?.usos);
  s.ok(guardada?.usos === tope, 'y la del bolso no', guardada?.usos);

  // Ni apilan ni se juntan con `mover`.
  const a = inv.casillas.findIndex(c => c?.id === HACHA);
  equipo.desequipar('mano');
  const dosOtraVez = instanciasDe(inv, HACHA);
  s.ok(dosOtraVez.length === 2, 'devolverla al bolso no la fusiona con la otra', dosOtraVez.length);
  const b = inv.casillas.findIndex((c, i) => c?.id === HACHA && i !== a);
  if (a >= 0 && b >= 0) {
    const usosAntes = inv.casillas.map(c => c?.usos);
    inv.mover(a, b);
    const sigue = instanciasDe(inv, HACHA);
    s.ok(sigue.length === 2, 'mover una sobre la otra NO las apila', sigue.length);
    s.ok(sigue.every(c => c.n === 1), 'y ninguna queda con n = 2', sigue.map(c => c.n).join(','));
    s.ok(new Set(sigue.map(c => c.usos)).size === new Set(usosAntes.filter(u => u != null)).size,
      'y no se pierde ninguna durabilidad al intercambiarlas', sigue.map(c => c.usos).join(','));
  } else s.ok(false, 'había dos hachas en la grilla para intentar apilarlas');

  // El peso de un objeto sale del catálogo, no del 0,5 por omisión de pesoDe.
  const kgHacha = defDe(HACHA).kg;
  const { inv: i2, equipo: e2 } = await mundo(38);
  const kg0 = i2.pesoKg;
  e2.guardar(HACHA);
  s.ok(Math.abs(i2.pesoKg - kg0 - kgHacha) < 1e-9,
    `puesta, el hacha pesa sus ${kgHacha} kg y no el 0,5 por omisión`, i2.pesoKg.toFixed(3));
  // Y EN LA GRILLA también, que es el otro camino. Hacían falta las dos: como
  // `guardar()` equipa sola, la de arriba sólo probaba la ranura, y un peso mal
  // calculado para lo que está en el bolso pasaba entero. Lo mostró el falsador.
  e2.desequipar('mano');
  s.ok(Math.abs(i2.pesoKg - kg0 - kgHacha) < 1e-9,
    `guardada en un casillero pesa los mismos ${kgHacha} kg`, i2.pesoKg.toFixed(3));
  e2.guardar(HACHA);
  s.ok(Math.abs(i2.pesoKg - kg0 - kgHacha * 2) < 1e-9,
    'y dos hachas pesan el doble que una', i2.pesoKg.toFixed(3));

  return s;
}

// ── 4 · LA RANURA ───────────────────────────────────────────────────────────

async function ranura() {
  const s = seccion(4, 'LA RANURA — lo puesto pesa pero no ocupa casillero');
  const { inv, equipo } = await mundo(38);

  equipo.guardar(HACHA);
  equipo.desequipar('mano');
  const enGrilla = casillasDe(inv, HACHA);
  const kgConEllaGuardada = inv.pesoKg;
  const ocupadasGuardada = inv.casillas.filter(Boolean).length;
  equipo.equipar(HACHA);
  const ocupadasPuesta = inv.casillas.filter(Boolean).length;

  s.feliz = enGrilla === 1 && equipo.enRanura('mano')?.id === HACHA;
  s.felizQue = `guardada ocupaba ${enGrilla} casillero y puesta quedó en la mano`;

  s.ok(ocupadasPuesta === ocupadasGuardada - 1, 'equipar libera el casillero',
    `${ocupadasGuardada} -> ${ocupadasPuesta}`);
  s.ok(casillasDe(inv, HACHA) === 0, 'y la instancia ya no está en la grilla');
  s.ok(Math.abs(inv.pesoKg - kgConEllaGuardada) < 1e-9,
    'pero sigue pesando: la estás cargando igual', `${kgConEllaGuardada.toFixed(3)} -> ${inv.pesoKg.toFixed(3)}`);

  equipo.desequipar('mano');
  s.ok(casillasDe(inv, HACHA) === 1, 'desequipar la devuelve a un casillero');
  s.ok(equipo.enRanura('mano') == null, 'y la ranura queda vacía');

  // Con el bolso lleno, desequipar falla limpio y no evapora nada.
  const { inv: i3, equipo: e3 } = await mundo(38);
  e3.guardar(HACHA);                       // se auto-equipa
  const f = await import(urlDe('systems/Recursos.js'));
  let puestos = 0;
  for (const [id] of Object.entries(f.RECURSOS)) {
    if (i3.casillas.every(Boolean)) break;
    if (i3.agregar(id, 1) > 0) puestos++;
  }
  s.ok(i3.casillas.every(Boolean), 'se pudo llenar la grilla para la prueba',
    `${i3.casillas.filter(Boolean).length}/${i3.casillas.length} con ${puestos} recursos`);
  const kgLleno = i3.pesoKg;
  const salio = e3.desequipar('mano');
  s.ok(salio === false, 'con la grilla llena, desequipar devuelve false', salio);
  s.ok(e3.enRanura('mano')?.id === HACHA, 'y el hacha se queda puesta, no se evapora',
    e3.enRanura('mano')?.id);
  s.ok(Math.abs(i3.pesoKg - kgLleno) < 1e-9, 'y no cambió el peso', i3.pesoKg.toFixed(3));

  // Las cuatro ranuras siguen siendo cuatro y no se pisan.
  const { inv: i4, equipo: e4 } = await mundo(38);
  for (const id of [HACHA, GARROTE, QUILLANGO, CANASTO]) e4.guardar(id);
  const puestas = ['mano', 'arma', 'abrigo', 'espalda'].map(r => e4.enRanura(r)?.id);
  s.ok(puestas.filter(Boolean).length === 4, 'las cuatro ranuras se llenan solas al fabricar',
    puestas.join(','));
  s.ok(new Set(puestas).size === 4, 'y cada cosa fue a la suya', puestas.join(','));

  return s;
}

// ── 5 · FABRICAR ────────────────────────────────────────────────────────────

async function fabricar() {
  const s = seccion(5, 'FABRICAR — sin lugar no se fabrica, y no se pierde nada');
  const { Inventario, Equipo } = await mods();
  const { Fabricacion } = await import(urlDe('systems/Fabricacion.js'));
  const { inv, equipo } = await mundo(38);

  const def = defDe(HACHA);
  const materiales = def.materiales || [];
  s.ok(materiales.length > 0, `${HACHA} pide materiales, así que la prueba tiene sentido`,
    materiales.map(m => `${m.cantidad} ${m.recurso}`).join(', '));

  let fab;
  try {
    fab = new Fabricacion(DATOS, { inventario: inv, equipo, saberes: SABERES() });
  } catch (e) { s.ok(false, 'se pudo construir Fabricacion en el banco', e.message); s.felizQue = 'no se pudo construir'; return s; }

  for (const m of materiales) inv.agregar(m.recurso, m.cantidad * 3);
  const r1 = fab.fabricar ? fab.fabricar(def) : fab.hacer?.(def);
  s.feliz = !!r1 && (r1.estado === 'hecho' || equipo.tiene(HACHA));
  s.felizQue = `fabricar devolvió ${JSON.stringify(r1?.estado ?? r1)}`;
  s.ok(equipo.tiene(HACHA), 'lo fabricado existe');

  const r2 = fab.fabricar ? fab.fabricar(def) : fab.hacer?.(def);
  const total = casillasDe(inv, HACHA) + (equipo.enRanura('mano')?.id === HACHA ? 1 : 0);
  s.ok(total === 2, 'fabricar de nuevo da una SEGUNDA, no renueva la primera', total);

  // Sin lugar: ni casillero ni ranura libre.
  const { inv: i2, equipo: e2 } = await mundo(38);
  const R = await import(urlDe('systems/Recursos.js'));
  let fab2;
  try {
    fab2 = new Fabricacion(DATOS, { inventario: i2, equipo: e2, saberes: SABERES() });
  } catch { fab2 = null; }
  if (fab2) {
    e2.guardar(HACHA);                     // ocupa la ranura de la mano
    for (const m of materiales) i2.agregar(m.recurso, m.cantidad * 2);
    for (const [id] of Object.entries(R.RECURSOS)) {
      if (i2.casillas.every(Boolean)) break;
      i2.agregar(id, 1);
    }
    s.ok(i2.casillas.every(Boolean), 'la grilla quedó llena para la prueba',
      `${i2.casillas.filter(Boolean).length}/${i2.casillas.length}`);
    const kgAntes = i2.pesoKg;
    const conteo = materiales.map(m => i2.disponiblePara(m.recurso));
    const r3 = fab2.fabricar ? fab2.fabricar(def) : fab2.hacer?.(def);
    s.ok(r3?.estado !== 'hecho', 'con todo lleno la fabricación NO se hace', r3?.estado);
    const conteo2 = materiales.map(m => i2.disponiblePara(m.recurso));
    s.ok(conteo.join(',') === conteo2.join(','),
      'y los materiales no se consumen: no se le roba al jugador', `${conteo} -> ${conteo2}`);
    s.ok(Math.abs(i2.pesoKg - kgAntes) < 1e-9, 'ni cambia el peso', i2.pesoKg.toFixed(3));
  } else s.ok(false, 'se pudo armar la segunda Fabricacion');

  return s;
}

// ── 6 · EL GUARDADO ─────────────────────────────────────────────────────────

async function guardado() {
  const s = seccion(6, 'EL GUARDADO — el taller viejo entra como instancias');
  const { inv, equipo } = await mundo(38);

  // EL FORMATO VIEJO: un `taller` de pares con la ranura por id.
  const viejo = { taller: [[HACHA, 31], [GARROTE, 7]], puesto: { mano: HACHA, arma: GARROTE, abrigo: null, espalda: null }, llama: null, resto: {} };
  const ok0 = equipo.reponer(viejo);
  s.feliz = ok0 !== false && equipo.enRanura('mano')?.id === HACHA;
  s.felizQue = `reponer el formato viejo devolvió ${ok0} y dejó ${equipo.enRanura('mano')?.id} en la mano`;

  s.ok(equipo.enRanura('mano')?.id === HACHA, 'lo que estaba puesto vuelve puesto');
  // 31 y no 42: la lasca dura 40, y reponer por encima del tope se recorta
  // --con razon. El banco se lo hizo a si mismo en la primera corrida.
  s.ok(equipo.usosDe(HACHA) === 31, 'con los usos que traía', equipo.usosDe(HACHA));
  s.ok(equipo.enRanura('arma')?.id === GARROTE, 'y el arma también');
  s.ok(equipo.usosDe(GARROTE) === 7, 'con los suyos', equipo.usosDe(GARROTE));

  // Lo guardado y NO puesto tiene que aterrizar en la grilla.
  const { equipo: e2, inv: i2 } = await mundo(38);
  e2.reponer({ taller: [[HACHA, 40], [CUCHILLO, 88]], puesto: { mano: HACHA, arma: null, abrigo: null, espalda: null }, llama: null, resto: {} });
  s.ok(casillasDe(i2, CUCHILLO) === 1, 'lo guardado y no puesto cae en un casillero',
    casillasDe(i2, CUCHILLO));
  s.ok(instanciasDe(i2, CUCHILLO)[0]?.usos === 88, 'con sus usos', instanciasDe(i2, CUCHILLO)[0]?.usos);

  // IDA Y VUELTA del formato nuevo, con las dos hachas distintas.
  const { equipo: e3, inv: i3 } = await mundo(38);
  e3.guardar(HACHA); e3.guardar(HACHA);
  for (let i = 0; i < 9; i++) e3.desgastar();
  const fotoGrilla = JSON.stringify(i3.casillas);
  const fotoEquipo = JSON.stringify(e3.serializar());
  const { equipo: e4, inv: i4 } = await mundo(38);
  i4.reponer(JSON.parse(JSON.stringify(i3.serializar())));
  e4.reponer(JSON.parse(fotoEquipo));
  s.ok(JSON.stringify(i4.casillas) === fotoGrilla, 'la grilla vuelve igual',
    JSON.stringify(i4.casillas).slice(0, 140));
  s.ok(e4.enRanura('mano')?.usos === e3.enRanura('mano')?.usos,
    'y la puesta vuelve con la durabilidad que tenía',
    `${e3.enRanura('mano')?.usos} -> ${e4.enRanura('mano')?.usos}`);

  // Un guardado con más objetos que lugar no puede perder nada en silencio.
  const { equipo: e5, inv: i5 } = await mundo(38);
  const muchos = COSAS.filter(o => o.durabilidad != null).slice(0, 40).map(o => [o.id, 5]);
  e5.reponer({ taller: muchos, puesto: { mano: null, arma: null, abrigo: null, espalda: null }, llama: null, resto: {} });
  const entraron = muchos.filter(([id]) => casillasDe(i5, id) > 0 || e5.tiene(id)).length;
  s.ok(entraron === muchos.length || i5.desbordado === true || e5.desbordado === true,
    'un guardado que no entra se declara desbordado, no se pierde callado',
    `entraron ${entraron} de ${muchos.length}, desbordado=${i5.desbordado ?? e5.desbordado}`);

  return s;
}

// ── 7 · NUEVE NO AHOGAN ─────────────────────────────────────────────────────

async function nueve() {
  const s = seccion(7, 'NUEVE HERRAMIENTAS NO AHOGAN LA GRILLA, y doce sí');
  const R = await import(urlDe('systems/Recursos.js'));
  const recursos = Object.entries(R.RECURSOS).map(([id, r]) => ({ id, kg: r.kg ?? 0.5 }));

  // Un equipo plausible: lo más liviano de cada categoría, que es lo que se
  // lleva de verdad. Ordenado y no al azar, para que la prueba sea repetible.
  const utiles = COSAS.filter(o => o.kg != null && o.durabilidad != null)
    .sort((a, b) => a.kg - b.kg);

  async function correr(nHerr, veces = 500) {
    const rnd = azar(20260912);
    let ahogadas = 0, peor = 0, ejemplo = '';
    for (let v = 0; v < veces; v++) {
      const { inv, equipo } = await mundo(38);
      // Se meten a la grilla, sin equipar ninguna: es el caso peor y el que el
      // contrato promete.
      for (const o of utiles.slice(0, nHerr)) { equipo.guardar(o.id); }
      for (const r of ['mano', 'arma', 'abrigo', 'espalda']) equipo.desequipar(r);
      let vueltas = 0;
      while (inv.pesoKg < 38 * 0.95 && vueltas++ < 400) {
        if (inv.casillas.every(Boolean)) {
          ahogadas++;
          if (!ejemplo) ejemplo = `${inv.pesoKg.toFixed(1)} de 38 kg con ${inv.casillas.length} casillas llenas`;
          break;
        }
        const r = recursos[Math.floor(rnd() * recursos.length)];
        const pila = R.pilaDe(r.kg);
        inv.agregar(r.id, Math.min(pila, Math.max(1, Math.floor((38 - inv.pesoKg) / r.kg))));
      }
      peor = Math.max(peor, inv.casillas.filter(Boolean).length);
    }
    return { ahogadas, veces, peor, ejemplo };
  }

  const cero = await correr(0, 120);
  s.feliz = cero.ahogadas === 0;
  s.felizQue = `sin herramientas encima, ${cero.ahogadas} de ${cero.veces} cargas se ahogaron`;

  // El umbral es 3 % y no cero, y eso lo corrigió el propio banco antes de que
  // ningún agente escribiera una línea. La primera versión de este contrato
  // prometía «con nueve no se ahoga NUNCA», sacado de una simulación cuyo
  // llenado no era el de `Inventario.agregar`. Con el llenado de verdad —pilas
  // abiertas primero, después el primer hueco— nueve herramientas ahogan el
  // 1 % de las cargas. Prometer cero habría sido pedirle al agente algo
  // imposible, que es exactamente el defecto que costó la fase 1.
  const n9 = await correr(9);
  const pct9 = n9.ahogadas / n9.veces * 100;
  s.ok(pct9 <= 3, 'con NUEVE herramientas encima se ahoga menos del 3 % de las cargas',
    `${pct9.toFixed(1)} % (${n9.ahogadas}/${n9.veces})${n9.ejemplo ? ' · p.ej. ' + n9.ejemplo : ''}`);
  s.nota(`con 9 encima la carga más ancha usó ${n9.peor} de 24 casillas`);

  const n12 = await correr(12, 300);
  const pct12 = n12.ahogadas / n12.veces * 100;
  s.ok(pct12 >= 10, 'y con DOCE se ahoga más del 10 %: la grilla sigue teniendo dientes',
    `${pct12.toFixed(1)} % (${n12.ahogadas}/${n12.veces})`);
  s.nota(`con 12 encima se ahoga el ${pct12.toFixed(0)} % — es la regla del juego y no un defecto:`
    + ' salir con doce herramientas cuesta lugar de carga');

  return s;
}

// ── 8 · ARRANQUE ────────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(8, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { fase1, apiEquipo, instancias, ranura, fabricar, guardado, nueve, arranque };

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

console.log(`\n  BANCO R6 · FASE 2 — las herramientas en la grilla   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
