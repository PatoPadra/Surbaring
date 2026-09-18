/**
 * BANCO DE LA FASE 5 (witral) — ronda 7, mitad Node.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga los módulos de verdad: `Construccion`, `Fundicion`,
 * `Fabricacion`, `Equipo`, `Inventario`, `Recoleccion`, `Partida` y `Obras`.
 *
 *   1. EL TELAR ES UNA COSA (W1) — la obra, dónde se levanta comparado con el toldo,
 *      que queda como estación, y su silueta medida: postes y travesaños, no la caja.
 *   2. SE TEJE AL LADO DEL TELAR (W2) — lejos no; a 5 m sí; con una fogata más cerca
 *      que el telar, también: la trampa de `Fundicion.cercano()`.
 *   3. SE HILA ANTES DE TEJER (W3) — el huso, el hilado, la receta que no consume nada
 *      sin huso, el poncho que pide hilado y las moscas que siguen con lana.
 *   4. LA TECLA (W4, la parte de Node) — el tronco caído le sigue ganando al coirón.
 *      Cuánta lana pide la cadena se anota; lo que cuesta juntarla lo mide la mitad
 *      navegador.
 *   5. CON FUENTE O CON LICENCIA (W5) — el vellón, el huso con tortero, y con qué lana
 *      se tejía el witral.
 *   6. EL TELAR SE VA ENTERO (W6) — al vencer sale de `Fundicion`; un guardado lo
 *      repone; `VERSION` sigue en 1.
 *   7. NADA MÁS CAMBIA (W7) — lo que se fabricaba en el bolso, en la fogata o en la
 *      fragua sigue igual, contra el dataset de la carta (`99f6300`); iconos nuevos.
 *   8. SIN REGRESIÓN (W8) — ronda 6 y ronda 7.
 *   9. ARRANQUE — `vite build`.
 *
 * La mitad navegador —`banco-r7-fase5.navegador.js`— mide W1 en la placa (levantar el
 * telar no compila programas) y W4 con el instrumento de la apertura.
 *
 * Qué SE fija, porque el contrato lo dice: la obra `telar_witral` de campamento con
 * `procesa`, el objeto `huso`, el recurso `hilado`.
 *
 * Qué NO se fija, a propósito: cómo pide la receta el huso (un campo, un gesto, lo
 * que sea: se juzga por `Fabricacion.estado()` y `fabricar()`), el `donde` del poncho,
 * cuánto hilado sale de cuánta lana, los materiales del telar, ni si la lana sale del
 * coirón o de un gesto propio.
 *
 * Uso: node .claude/flota/banco-r7-fase5.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const leer = (rel) => fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

const HERRAMIENTAS = JSON.parse(leer('data/herramientas.json'));
const MINERIA = JSON.parse(leer('data/mineria.json'));
const CAZA = JSON.parse(leer('data/caza.json'));
const HISTORIA = JSON.parse(leer('data/historia.json'));
const CONSTRUCCION = JSON.parse(leer('data/construccion.json'));

/** La carta de la fase 5, antes del código: contra esto se mide lo que no cambia. */
const BASE = '99f6300';

const TECS = [...(HISTORIA.tecnologias || []), ...(HERRAMIENTAS.tecnologiasNuevas || [])];
const obraTelar = () => (CONSTRUCCION.obras || []).find((o) => o.id === 'telar_witral');
const porId = (id) => (HERRAMIENTAS.objetos || []).find((o) => o.id === id);
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = globalThis.document || { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };

/**
 * Cuánta lana pide ir de cero al poncho puesto: el poncho, el huso, la obra del telar
 * y sus tecnologías, abriendo cada material que sale de una receta. La misma cuenta
 * está en la mitad navegador.
 */
function lanaTotal(H, tecnologias, C) {
  const objetos = new Map((H.objetos || []).map((o) => [o.id, o]));
  const tecs = new Map((tecnologias || []).map((t) => [t.id, t]));
  const productor = (r) => (H.objetos || []).find((o) => (o.produce || []).some((p) => p.recurso === r));
  const vistas = new Set();
  let lana = 0;
  const pedir = (materiales, veces, hondo) => {
    if (hondo > 8) return;
    for (const m of materiales || []) {
      const n = m.cantidad * veces;
      if (m.recurso === 'lana') { lana += n; continue; }
      const p = productor(m.recurso);
      if (!p) continue;
      const sale = p.produce.find((x) => x.recurso === m.recurso).cantidad;
      pedir(p.materiales, Math.ceil(n / sale), hondo + 1);
      tec(p.tecnologia);
    }
  };
  const tec = (id) => {
    if (!id || vistas.has(id)) return;
    vistas.add(id);
    const t = tecs.get(id);
    if (!t) return;
    pedir(t.materiales, 1, 0);
    for (const r of t.requiere || []) tec(r);
  };
  for (const id of ['poncho_witral', 'huso']) {
    const o = objetos.get(id);
    if (o) { pedir(o.materiales, 1, 0); tec(o.tecnologia); }
  }
  tec('telar_witral');
  const obra = (C.obras || []).find((o) => o.id === 'telar_witral');
  if (obra) { pedir(obra.materiales, 1, 0); tec(obra.requiereTecnologia); }
  return lana;
}

// ═══════════════════════════════════════════════════════════════════════════
// Armado
// ═══════════════════════════════════════════════════════════════════════════

function mundoFalso({ aguaDesdeX = Infinity, altura = 800 } = {}) {
  const m = {
    tamano: 65536, mitad: 32768,
    esAgua: (x) => x >= aguaDesdeX,
    cauceEn: () => 0,
    alturaEn: () => altura,
    pendienteEn: () => 0.05,
    dentro: () => true,
    humedadEn: () => 0.5,
    aLatLon: () => ({ lat: -41.1, lon: -71.4 }),
    aMundo: () => ({ x: 0, z: 0 }),
  };
  m.orillaCerca = (x, z) => {
    for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]]) {
      if (m.esAgua(x + dx, z + dz)) return true;
    }
    return m.cauceEn(x, z) > 0.15;
  };
  return m;
}

/** El taller entero, como lo arma `main.js`: bolso, equipo, hornos, obras y fabricación. */
async function taller({ jurisdiccion = 'reserva', todoSabido = true } = {}) {
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Fundicion } = await imp('systems/Fundicion.js');
  const { Construccion } = await imp('systems/Construccion.js');
  const { Fabricacion } = await imp('systems/Fabricacion.js');
  const avisos = [];
  const hud = {
    aviso: (t, d) => avisos.push(`${t} · ${d ?? ''}`),
    negativa: (v) => avisos.push(`NEGATIVA · ${v?.titulo ?? ''} · ${v?.detalle ?? ''}`),
    mostrarAccion() {},
  };
  const tiempo = { fecha: new Date(Date.UTC(2026, 0, 15, 15)), textoFecha: '15 de enero', segundosTotales: 0 };
  const jugador = { posicion: { x: 0, y: 800, z: 0 }, sed: 100, hambre: 100, salud: 100 };
  const estado = { j: jurisdiccion };
  const limites = { jurisdiccion: () => estado.j, etiqueta: () => ({ id: estado.j, nombre: estado.j }) };
  const saberes = {
    puntos: 0, otorgar(p) { this.puntos += p; },
    desbloqueadas: new Set(todoSabido ? TECS.map((t) => t.id) : []),
    porId: new Map(TECS.map((t) => [t.id, t])),
  };
  const mundo = mundoFalso();
  const inventario = new Inventario(2000);
  const equipo = new Equipo(HERRAMIENTAS, { inventario });
  const fundicion = new Fundicion(MINERIA, { inventario, saberes, jugador, tiempo, hud, limites, mundo });
  const obras = new Construccion(CONSTRUCCION, { inventario, saberes, jugador, tiempo, hud, limites, mundo, fundicion });
  const fabricacion = new Fabricacion(HERRAMIENTAS, { inventario, saberes, equipo, fundicion, hud });
  const dar = (materiales, veces = 2) => { for (const m of materiales || []) inventario.agregar(m.recurso, m.cantidad * veces); };
  const en = (x, z) => { jugador.posicion.x = x; jugador.posicion.z = z; };
  return { inventario, equipo, fundicion, obras, fabricacion, saberes, tiempo, jugador, estado, avisos, dar, en };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL TELAR ES UNA COSA
// ═══════════════════════════════════════════════════════════════════════════

async function telarEsCosa() {
  const s = seccion(1, 'EL TELAR ES UNA COSA — obra de campamento, se niega en el Parque como el toldo, y se ve');
  const obra = obraTelar();
  const toldo = (CONSTRUCCION.obras || []).find((o) => o.id === 'toldo');
  s.ok(toldo?.categoria === 'campamento', 'premisa: el toldo es de campamento', toldo?.categoria);
  s.ok(!!obra, 'existe la obra telar_witral en construccion.json', (CONSTRUCCION.obras || []).map((o) => o.id).join(', '));
  if (!obra) { s.felizQue = 'no hay obra de telar'; return s; }
  s.ok(obra.categoria === 'campamento', 'es de campamento', obra.categoria);
  s.ok(obra.procesa === true, 'procesa: queda como estación del taller', obra.procesa);
  s.ok(obra.requiereTecnologia === 'telar_witral', 'pide la tecnología telar_witral', obra.requiereTecnologia);

  const w = await taller();
  w.dar(obra.materiales);
  w.dar(toldo.materiales);
  const veredicto = (o, j) => { w.estado.j = j; return w.obras.evaluar(o, 0, 0); };
  const vr = veredicto(obra, 'reserva'), vf = veredicto(obra, 'fuera');
  s.ok(vr.permitido, 'se levanta en la Reserva', vr.titulo);
  s.ok(vf.permitido, 'y fuera del área protegida', vf.titulo);
  const vp = veredicto(obra, 'parque'), tp = veredicto(toldo, 'parque');
  s.ok(!vp.permitido && vp.titulo === tp.titulo && vp.castigo === tp.castigo, 'en el Parque se niega igual que el toldo',
    `${vp.titulo} · ${vp.castigo} contra ${tp.titulo} · ${tp.castigo}`);
  const ns = await taller({ todoSabido: false });
  ns.dar(obra.materiales);
  const sinSaber = ns.obras.evaluar(obra, 0, 0);
  s.ok(!sinSaber.permitido && /sab/i.test(sinSaber.titulo || ''), 'sin la tecnología, no se levanta', sinSaber.titulo);

  w.estado.j = 'reserva';
  w.en(0, 0);
  const levantada = w.obras.levantar(obra);
  s.ok(!!levantada, 'premisa: se levanta de verdad con Construccion.levantar()', w.avisos.slice(-2).join(' | '));
  s.ok(w.fundicion.hornos.some((h) => h.def?.id === 'telar_witral'), 'y queda como estación en Fundicion');

  // La silueta, en el espacio del mundo, con la obra en el origen: ahí la rotación
  // que `Obras` le da a cada una para que no se vean clonadas vale cero.
  const { Obras } = await imp('world/Obras.js');
  const O = new Obras();
  const medir = (id) => {
    const nodo = O.agregar({ obra: { id }, x: 0, y: 0, z: 0 });
    nodo.updateMatrixWorld(true);
    const cajas = [];
    nodo.traverse((m) => { if (m.isMesh) cajas.push(new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())); });
    return { cajas, total: new THREE.Box3().setFromObject(nodo).getSize(new THREE.Vector3()) };
  };
  const t = medir('telar_witral'), d = medir('obra_sin_caso_propio');
  const firma = (m) => m.cajas.map((v) => `${v.x.toFixed(2)}×${v.y.toFixed(2)}×${v.z.toFixed(2)}`).sort().join(' ');
  const postes = t.cajas.filter((v) => v.y >= 1.2 && Math.max(v.x, v.z) <= 0.35).length;
  const travesanos = t.cajas.filter((v) => v.y <= 0.35 && Math.max(v.x, v.z) >= 1.0).length;
  s.ok(firma(t) !== firma(d), 'no es la caja por defecto', firma(t));
  s.ok(t.total.y >= 1.5, 'mide al menos un metro y medio de alto', t.total.y.toFixed(2));
  s.ok(postes >= 2 && travesanos >= 1, 'tiene postes y travesaños', `${postes} postes · ${travesanos} travesaños`);

  s.feliz = !!levantada;
  s.felizQue = levantada ? 'el telar se levantó' : 'el telar no se levantó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · SE TEJE AL LADO DEL TELAR
// ═══════════════════════════════════════════════════════════════════════════

async function tejerAlLado() {
  const s = seccion(2, 'SE TEJE AL LADO DEL TELAR — lejos no, a 5 m sí, y con la fogata más cerca también');
  const obra = obraTelar(), poncho = porId('poncho_witral');
  s.ok(!!poncho, 'premisa: el poncho está en el dataset');
  s.ok(!!obra, 'hay obra de telar para tejer al lado');
  if (!obra || !poncho) { s.felizQue = 'sin telar o sin poncho'; return s; }

  const w = await taller();
  w.dar(obra.materiales);
  w.dar(poncho.materiales, 3);
  w.en(0, 0);
  const levantada = w.obras.levantar(obra);
  s.ok(!!levantada, 'premisa: el telar está en pie en el origen', w.avisos.slice(-2).join(' | '));
  const estadoEn = (x) => { w.en(x, 0); return w.fabricacion.estado(poncho); };

  const lejos = estadoEn(30);
  s.ok(lejos.estado === 'falta_estacion' && /telar/i.test(lejos.motivo || ''), 'a 30 m del telar, el estado dice que falta el telar', `${lejos.estado} · ${lejos.motivo ?? ''}`);
  const cerca = estadoEn(5);
  s.ok(cerca.estado === 'lista', 'a 5 m, está lista', `${cerca.estado} · ${cerca.motivo ?? ''}`);
  const doce = estadoEn(12);
  s.ok(doce.estado === 'falta_estacion', 'a 12 m, ya no', doce.estado);

  const T = w.tiempo.fecha.getTime();
  w.fundicion.hornos.push({ def: w.fundicion.hornoPorId('fogata'), x: 4, z: 0, y: 800, fuego: { desde: T - 1, hasta: T + 36e5 }, trabajo: null });
  const conFogata = estadoEn(5);
  s.ok(lejos.estado === 'falta_estacion' && conFogata.estado === 'lista', 'con una fogata a 1 m y el telar a 5 m, se teje igual', `${conFogata.estado} · ${conFogata.motivo ?? ''}`);

  w.en(5, 0);
  const hecho = w.fabricacion.fabricar(poncho);
  s.ok(lejos.estado === 'falta_estacion' && hecho.estado === 'hecho' && w.equipo.tiene('poncho_witral'), 'y el poncho sale del telar', `${hecho.estado} · ${hecho.motivo ?? ''}`);

  s.feliz = !!levantada;
  s.felizQue = levantada ? 'el telar se levantó' : 'el telar no se levantó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SE HILA ANTES DE TEJER
// ═══════════════════════════════════════════════════════════════════════════

async function hilar() {
  const s = seccion(3, 'SE HILA ANTES DE TEJER — el huso, el hilado, y el poncho que pide hilado');
  const R = await imp('systems/Recursos.js');
  const huso = porId('huso');
  const receta = (HERRAMIENTAS.objetos || []).find((o) => (o.produce || []).some((p) => R.normalizar(p.recurso) === 'hilado'));
  const poncho = porId('poncho_witral'), moscas = porId('moscas');
  const pide = (o, id) => (o?.materiales || []).some((m) => R.normalizar(m.recurso) === id);
  const lista = (o) => (o?.materiales || []).map((m) => m.recurso).join(', ');

  s.ok(!!R.RECURSOS.hilado, 'existe el recurso hilado');
  s.ok(!!huso, 'existe el objeto huso');
  s.ok(!!receta, 'una receta hace hilado', receta?.id);
  s.ok(!!poncho && pide(poncho, 'hilado') && !pide(poncho, 'lana'), 'el poncho pide hilado, no lana', lista(poncho));
  s.ok(!!moscas && pide(moscas, 'lana'), 'las moscas siguen pidiendo lana', lista(moscas));
  s.ok(!!receta && pide(receta, 'lana'), 'el hilado sale de la lana', lista(receta));

  let hilo = false;
  if (receta && huso) {
    const w = await taller();
    w.dar(receta.materiales, 3);
    w.en(500, 500);
    const lana0 = w.inventario.cantidad('lana');
    const sin = w.fabricacion.estado(receta);
    const nombra = new RegExp(`huso|${escapar(huso.nombre || 'huso')}`, 'i');
    s.ok(sin.estado !== 'lista' && nombra.test(JSON.stringify(sin)), 'sin huso, el estado dice que falta el huso', JSON.stringify(sin).slice(0, 180));
    const intento = w.fabricacion.fabricar(receta);
    s.ok(intento.estado !== 'hecho' && w.inventario.cantidad('lana') === lana0, 'y fabricar sin huso no consume nada', `${intento.estado} · lana ${lana0} → ${w.inventario.cantidad('lana')}`);
    s.ok(w.equipo.guardar('huso'), 'premisa: el huso se fabrica y se lleva encima');
    const con = w.fabricacion.estado(receta);
    s.ok(con.estado === 'lista', 'con el huso, lejos de toda estación, está lista', `${con.estado} · ${con.motivo ?? ''}`);
    const hilado0 = w.inventario.cantidad('hilado');
    const hecho = w.fabricacion.fabricar(receta);
    const sale = receta.produce.find((p) => R.normalizar(p.recurso) === 'hilado').cantidad;
    hilo = hecho.estado === 'hecho' && w.inventario.cantidad('hilado') === hilado0 + sale;
    s.ok(hilo, 'y el hilado sale', `${hecho.estado} · ${hilado0} → ${w.inventario.cantidad('hilado')}`);
    s.ok(hilo && w.inventario.cantidad('lana') < lana0, 'gastando lana', `${lana0} → ${w.inventario.cantidad('lana')}`);
  }

  s.feliz = hilo;
  s.felizQue = hilo ? 'se hiló' : 'no se hiló';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LA TECLA
// ═══════════════════════════════════════════════════════════════════════════

async function laTecla() {
  const s = seccion(4, 'LA TECLA — el tronco caído le sigue ganando al coirón');
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const { Mineria } = await imp('systems/Mineria.js');
  const { Caza } = await imp('systems/Caza.js');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');

  const lote = (id, x, z) => {
    const a = new Float32Array(16);
    a[12] = x; a[13] = 800; a[14] = z;
    return { tipo: { id, nombre: id }, n: 1, malla: { instanceMatrix: { array: a } } };
  };
  const armarCon = async (lotes) => {
    const hud = { aviso() {}, negativa() {}, mostrarAccion() {} };
    const mundo = mundoFalso();
    const inventario = new Inventario(500);
    const equipo = new Equipo(HERRAMIENTAS, { inventario });
    const saberes = { puntos: 0, otorgar() {}, desbloqueadas: new Set(), porId: new Map() };
    const jugador = { posicion: { x: 0, y: 800, z: 0 }, sed: 100, hambre: 100, salud: 100, enAgua: false };
    const limites = { jurisdiccion: () => 'reserva', etiqueta: () => ({ id: 'reserva', nombre: 'reserva' }) };
    const rec = new Recoleccion({
      mundo, jugador, vegetacion: { masCercana: () => null }, sotobosque: { lotes }, fauna: { masCercano: () => null },
      inventario, saberes, codice: { identificadas: new Set(), registrarFlora() {}, registrarFauna() {} }, hud,
    });
    rec.caza = new Caza(CAZA, { inventario, hud, saberes, jugador, mundo, limites, equipo });
    rec.mineria = new Mineria(MINERIA, { mundo, limites, jugador, inventario, saberes, hud });
    rec.pesca = null;
    rec.equipo = equipo;
    rec.herramientas = HERRAMIENTAS;
    return rec;
  };

  // Un lugar donde el mundo falso no ofrece nada por sí solo. En el origen la
  // `Mineria` de verdad decide chatarra, y la primera versión de esta sección
  // juzgaba al coirón contra la chatarra sin saberlo: la premisa «con el coirón
  // solo, la tecla ofrece el coirón» daba verde con «Levantar chatarra».
  const vacio = await armarCon([]);
  let x0 = null;
  for (let x = 0; x < 6000 && x0 === null; x += 37) {
    vacio.jugador.posicion.x = x;
    if (!vacio.quePuedoHacer(1000)) x0 = x;
  }
  s.ok(x0 !== null, 'premisa: hay un lugar donde, sin matas, la tecla no ofrece nada', x0);
  const ofrece = async (lotes) => {
    const r = await armarCon(lotes);
    r.jugador.posicion.x = x0 ?? 0;
    return r.quePuedoHacer(1000);
  };
  const ambos = await ofrece([lote('coiron', (x0 ?? 0) + 0.5, 0), lote('tronco', (x0 ?? 0) + 2, 0)]);
  s.ok(!!ambos, 'premisa: con un coirón a 0,5 m y un tronco a 2 m, la tecla ofrece algo', ambos?.etiqueta ?? 'nada');
  s.ok(/tronco|leña|ramas/i.test(ambos?.etiqueta || ''), 'el tronco caído le gana la tecla al coirón', ambos?.etiqueta ?? 'nada');
  const solo = await ofrece([lote('coiron', (x0 ?? 0) + 0.5, 0)]);
  s.ok(!!solo && /coir|fibra|lana|vell/i.test(solo.etiqueta || ''), 'premisa: con el coirón solo, la tecla ofrece el coirón', solo?.etiqueta ?? 'nada');

  const total = lanaTotal(HERRAMIENTAS, TECS, CONSTRUCCION);
  s.nota(`la cadena de cero al poncho puesto pide ${total} de lana (la carta: 14, el nodo y el poncho)`);

  s.feliz = !!ambos;
  s.felizQue = ambos ? 'la tecla ofreció' : 'la tecla no ofreció nada';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · CON FUENTE O CON LICENCIA
// ═══════════════════════════════════════════════════════════════════════════

async function fuentes() {
  const s = seccion(5, 'CON FUENTE O CON LICENCIA — el vellón, el huso con tortero, y la lana del witral');
  const huso = porId('huso'), poncho = porId('poncho_witral');
  const receta = (HERRAMIENTAS.objetos || []).find((o) => (o.produce || []).some((p) => p.recurso === 'hilado'));
  const licencias = HERRAMIENTAS.licenciasDeJuego?.licencias || [];
  const texto = (o) => [o?.fuente, o?.criterio].filter((x) => typeof x === 'string').join(' ');
  const deLicencia = (l) => [l.que, l.laNormaReal, l.laRealidad, l.porQueSeToma, l.comoLoDiceElJuego, l.queNOSeAfloja, l.nota]
    .filter((x) => typeof x === 'string').join(' ');
  const deLana = licencias.filter((l) => /lana|vell[oó]n/i.test(`${l.id} ${l.que}`));
  const todo = [texto(huso), texto(receta), texto(poncho), ...deLana.map(deLicencia)].join(' ');

  s.ok(todo.length >= 60 && /guanaco/i.test(todo) && /vell[oó]n|coir[oó]n/i.test(todo), 'lo del vellón de guanaco en el coirón tiene fuente o licencia', todo.slice(0, 160) || 'nada escrito');
  for (const l of deLana) {
    s.ok(!!l.que && !!(l.laNormaReal ?? l.laRealidad) && !!l.porQueSeToma && !!l.comoLoDiceElJuego,
      `la licencia ${l.id} dice qué, la realidad, por qué y cómo lo dice el juego`, Object.keys(l).join(', '));
  }
  s.ok(texto(huso).length >= 60 && /tortero/i.test(texto(huso)), 'el huso trae su fuente, y habla del tortero', texto(huso).slice(0, 160) || 'nada');
  s.ok(/oveja/i.test(todo) && /guanaco/i.test(todo), 'se dice con qué lana se tejía el witral', todo.slice(0, 160) || 'nada');

  s.feliz = true;
  s.felizQue = 'el dataset se leyó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · EL TELAR SE VA ENTERO
// ═══════════════════════════════════════════════════════════════════════════

async function seVaEntero() {
  const s = seccion(6, 'EL TELAR SE VA ENTERO — al vencer sale de Fundicion, y un guardado lo repone');
  const obra = obraTelar(), poncho = porId('poncho_witral');
  if (!s.ok(!!obra, 'hay obra de telar')) { s.felizQue = 'sin telar'; return s; }
  const { Partida } = await imp('systems/Partida.js');
  const estacion = (w) => w.fundicion.hornos.some((h) => h.def?.id === 'telar_witral');

  const w = await taller();
  w.dar(obra.materiales);
  w.dar(poncho.materiales, 3);
  w.en(0, 0);
  const c = w.obras.levantar(obra);
  s.ok(!!c && c.vence != null, 'premisa: el telar levantado vence, como todo campamento', c?.vence);
  s.ok(estacion(w), 'premisa: recién levantado, es estación');
  if (c?.vence != null) {
    w.tiempo.fecha = new Date(c.vence + 86400000);
    const caidas = w.obras.actualizar();
    s.ok(caidas.includes(c), 'premisa: pasado el vencimiento, la obra cae', caidas.length);
    s.ok(!estacion(w), 'y deja de ser estación en Fundicion', w.fundicion.hornos.map((h) => h.def?.id).join(', ') || 'ninguna');
    w.en(3, 0);
    const e = w.fabricacion.estado(poncho);
    s.ok(e.estado !== 'lista', 'no queda una estación fantasma: donde estaba, no se teje', `${e.estado} · ${e.motivo ?? ''}`);
  }

  const g = await taller();
  g.dar(poncho.materiales, 3);
  const falsa = Object.assign(Object.create(Partida.prototype), { construccion: g.obras, fundicion: g.fundicion, obras: null });
  falsa._reponerObras([{ id: 'telar_witral', x: 0, y: 800, z: 0, vence: g.tiempo.fecha.getTime() + 10 * 86400000, guardado: [] }]);
  g.en(3, 0);
  const repuesta = g.fabricacion.estado(poncho);
  s.ok(g.obras.obras.length === 1 && repuesta.estado === 'lista', 'un guardado con un telar en pie lo repone con su estación', `${g.obras.obras.length} · ${repuesta.estado} · ${repuesta.motivo ?? ''}`);

  const v = await taller();
  const falsa2 = Object.assign(Object.create(Partida.prototype), { construccion: v.obras, fundicion: v.fundicion, obras: null });
  falsa2._reponerObras([{ id: 'telar_witral', x: 0, y: 800, z: 0, vence: v.tiempo.fecha.getTime() - 1000, guardado: [] }]);
  const cayo = v.obras.actualizar();
  s.ok(cayo.length === 1 && !estacion(v), 'un guardado con un telar ya vencido no deja estación', `${cayo.length} · ${v.fundicion.hornos.map((h) => h.def?.id).join(', ') || 'ninguna'}`);

  s.ok(/const VERSION = 1;/.test(leer('systems/Partida.js')), 'VERSION sigue en 1');

  s.feliz = !!c;
  s.felizQue = c ? 'el telar se levantó' : 'el telar no se levantó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · NADA MÁS CAMBIA
// ═══════════════════════════════════════════════════════════════════════════

async function nadaMas() {
  const s = seccion(7, 'NADA MÁS CAMBIA — las estaciones de siempre, y los iconos nuevos');
  const r = spawnSync('git', ['show', `${BASE}:src/data/herramientas.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const antes = r.status === 0 ? JSON.parse(r.stdout) : null;
  s.ok(!!antes, 'premisa: el dataset de la carta se lee de git', r.status === 0 ? BASE : (r.stderr || '').slice(0, 200));
  if (antes) {
    const ahora = new Map((HERRAMIENTAS.objetos || []).map((o) => [o.id, o]));
    const cambiaron = [];
    for (const o of antes.objetos || []) {
      if (o.id === 'poncho_witral') continue;
      const n = ahora.get(o.id);
      if (!n) { cambiaron.push(`${o.id}: ya no está`); continue; }
      if ((o.donde || 'bolso') !== (n.donde || 'bolso')) cambiaron.push(`${o.id}: ${o.donde || 'bolso'} → ${n.donde || 'bolso'}`);
    }
    s.ok(cambiaron.length === 0, 'los objetos de antes se fabrican donde se fabricaban', cambiaron.slice(0, 5).join(' · ') || `${(antes.objetos || []).length - 1} iguales`);
  }
  const iconos = leer('ui/Iconos.js');
  for (const id of ['huso', 'hilado']) {
    s.ok(new RegExp(`(^|[\\s{,'"])${id}['"]?\\s*:`, 'm').test(iconos), `${id} tiene icono en Iconos.js`);
  }
  s.feliz = !!antes;
  s.felizQue = antes ? 'se leyó la base' : 'no se leyó la base';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · SIN REGRESIÓN  ·  9 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(8, 'SIN REGRESIÓN — la ronda 6 y las fases anteriores de la ronda 7');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const real = { BANCO_SRC: path.join(RAIZ, 'src') };
  const otros = [
    ['banco-r6-fase1.mjs', '7/7', {}],
    ['banco-r6-fase2.mjs', '8/8', {}],
    ['banco-r6-fase3.mjs', '6/6', real],
    ['banco-r7-fase1.mjs', '6/6', real],
    ['banco-r7-fase2.mjs', '4/4', real],
    ['banco-r7-fase2b.mjs', '7/7', real],
    ['banco-r7-fase3.mjs', '6/6', real],
    ['banco-r7-fase4.mjs', '10/10', real],
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
  const s = seccion(9, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { telarEsCosa, tejerAlLado, hilar, laTecla, fuentes, seVaEntero, nadaMas, regresion, arranque };
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

console.log(`\n  BANCO R7 · FASE 5 — el witral, mitad Node   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
