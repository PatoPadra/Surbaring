/**
 * BANCO DE LA FASE 3 (barro) — ronda 7, mitad Node.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga los módulos de verdad: `Recoleccion`, `Inventario`,
 * `Equipo`, `Mineria`, `Caza`, `Hallazgos` y `Taller`.
 *
 *   1. LA BARRANCA (A1, A2) — en la banda de orilla la tecla ofrece arcilla con su
 *      paréntesis; da lo que dice `extraer_arcilla`, a mano y con la pala; descansa;
 *      y si el dataset cambia, el cartel y la tecla cambian con él.
 *   2. LA ARENA (A4) — en la playa de la Reserva la tecla da un puñado de arena, con
 *      la licencia dicha; en el Parque no; la cantera sigue negándose igual.
 *   3. LO QUE FALTA (A5) — el taller dice el origen de la arcilla y de la arena, y
 *      hacia dónde y a cuánto queda el lugar anotado más cercano; sin anotados, no
 *      inventa uno.
 *   4. UNA SOLA REGLA (A6) — `Hallazgos` marca arcilla donde la tecla la da, y no
 *      donde no.
 *   5. SIN REGRESIÓN (A7) — r7-fase1, r7-fase2 y r7-fase2b.
 *   6. ARRANQUE — `vite build`.
 *
 * La mitad navegador —`banco-r7-fase3.navegador.js`— mide A3 y los 600 m de A4 en
 * el mundo real, que es donde se ve si una planta o un tronco le ganan la tecla.
 *
 * Qué NO se fija, a propósito: el nombre de los gestos, el tipo de la acción, el
 * orden en la cadena, ni si en una orilla con barranca y playa la tecla da las dos
 * cosas juntas o una después de la otra. Se juzga lo que el cartel promete y lo que
 * la tecla da, con la gramática de la fase 1.
 *
 * Uso: node .claude/flota/banco-r7-fase3.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
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

const HERRAMIENTAS = JSON.parse(leer('data/herramientas.json'));
const MINERIA = JSON.parse(leer('data/mineria.json'));
const CAZA = JSON.parse(leer('data/caza.json'));

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = globalThis.document || { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };

// ═══════════════════════════════════════════════════════════════════════════
// Un mundo chico: tierra al oeste y lago desde `aguaDesdeX` hacia el este
// ═══════════════════════════════════════════════════════════════════════════

function mundoFalso({ aguaDesdeX = Infinity, altura = 800, pendiente = 0.1 } = {}) {
  const m = {
    tamano: 65536, mitad: 32768,
    esAgua: (x) => x >= aguaDesdeX,
    cauceEn: () => 0,
    alturaEn: () => altura,
    pendienteEn: () => pendiente,
    dentro: () => true,
    humedadEn: () => 0.5,
    aLatLon: () => ({ lat: -41.1, lon: -71.4 }),
    aMundo: () => ({ x: 0, z: 0 }),
  };
  // El predicado de orilla de `Mundo.js`, el de verdad, sobre este mundo
  m.orillaCerca = (x, z) => {
    for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]]) {
      if (m.esAgua(x + dx, z + dz)) return true;
    }
    return m.cauceEn(x, z) > 0.15;
  };
  return m;
}

/**
 * Una orilla donde valen las dos cosas: la banda de arcilla (orilla a 12 m, el agua
 * fuera del alcance de beber) y el banco de arena de `Mineria` (el centro de su
 * celda de 24 m con agua a 12 m y pendiente menor a 0,22). Con el agua desde
 * x = 990, parado en x = 980: la celda de `Mineria` tiene el centro en 984.
 */
const ORILLA = { x: 980, y: 800, z: 0, agua: 990 };
const LEJOS = { x: 0, y: 800, z: 0 };

async function armar({ en, mundo, jurisdiccion = 'reserva', herramienta = null, herramientas = HERRAMIENTAS }) {
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Mineria } = await imp('systems/Mineria.js');
  const { Caza } = await imp('systems/Caza.js');
  const avisos = [];
  const hud = { aviso: (t, d) => avisos.push(`${t} · ${d ?? ''}`), negativa: (v) => avisos.push(`NEGATIVA · ${v?.titulo ?? ''} · ${v?.detalle ?? ''}`), mostrarAccion() {} };
  const saberes = { puntos: 0, otorgar(p) { this.puntos += p; }, desbloqueadas: new Set(), porId: new Map() };
  const codice = { identificadas: new Set(), registrarFlora() {}, registrarFauna() {} };
  const inventario = new Inventario(200);
  const equipo = new Equipo(herramientas, { inventario });
  if (herramienta) equipo.guardar(herramienta);
  const jugador = { posicion: { ...en }, sed: 100, hambre: 100, salud: 100, enAgua: false };
  const limites = { jurisdiccion: () => jurisdiccion, etiqueta: () => ({ id: jurisdiccion, nombre: jurisdiccion }) };
  const sotobosque = { lotes: [] };
  const vegetacion = { masCercana: () => null };
  const fauna = { masCercano: () => null };
  const mineria = new Mineria(MINERIA, { mundo, limites, jugador, inventario, saberes, hud });
  const caza = new Caza(CAZA, { inventario, hud, saberes, jugador, mundo, limites, equipo });
  const rec = new Recoleccion({ mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud });
  rec.caza = caza;
  rec.mineria = mineria;
  rec.pesca = null;
  rec.equipo = equipo;
  rec.herramientas = herramientas;
  return { rec, inventario, equipo, avisos, mineria, jugador };
}

function totales(inv) {
  const t = {};
  for (const c of inv.casillas || []) {
    if (!c || c.usos !== undefined) continue;
    t[c.id] = (t[c.id] || 0) + c.n;
  }
  return t;
}

function diferencia(antes, despues) {
  const d = {};
  for (const id of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const n = (despues[id] || 0) - (antes[id] || 0);
    if (n) d[id] = n;
  }
  return d;
}

/** Lo que promete un paréntesis, por id: {min, max, veces}. La gramática de la fase 1. */
async function parser() {
  const R = await imp('systems/Recursos.js');
  const porNombre = new Map(Object.keys(R.RECURSOS).map((id) => [R.nombreDe(id).toLowerCase(), id]));
  const idDe = (n) => porNombre.get(n.trim().toLowerCase()) ?? `?${n.trim()}`;
  return (etiqueta) => {
    const m = /\(([^()]*)\)\s*$/.exec(etiqueta || '');
    const prom = new Map();
    if (!m) return prom;
    for (const crudo of m[1].split('·').map((x) => x.trim()).filter(Boolean)) {
      let r;
      if ((r = /^a veces\s+(.+)$/i.exec(crudo))) { const id = idDe(r[1]); const a = prom.get(id) || { min: 0, max: 0, veces: false }; a.veces = true; prom.set(id, a); }
      else if ((r = /^(\d+)\s*(?:[–-]\s*(\d+))?\s*×\s*(.+)$/.exec(crudo))) { const id = idDe(r[3]); const a = prom.get(id) || { min: 0, max: 0, veces: false }; a.min += +r[1]; a.max += +(r[2] ?? r[1]); prom.set(id, a); }
    }
    return prom;
  };
}

/**
 * Aprieta la tecla varias veces seguidas en el mismo lugar y en el mismo instante,
 * mientras lo que se ofrece dé algo de `ids`. Así un lugar con barranca y playa se
 * juzga igual si da las dos cosas juntas o una después de la otra.
 */
async function recorrer(w, ids, ahora = 1000, veces = 4) {
  const parsear = await parser();
  const vistos = [];
  for (let k = 0; k < veces; k++) {
    const acc = w.rec.quePuedoHacer(ahora);
    if (!acc) break;
    const prom = parsear(acc.etiqueta);
    const toca = ids.some((id) => prom.has(id));
    if (!toca) { vistos.push({ acc, prom, obtenido: {}, actuo: false }); break; }
    const antes = totales(w.inventario);
    let error = null;
    try { w.rec.actuar(ahora); } catch (e) { error = e.message; }
    vistos.push({ acc, prom, obtenido: diferencia(antes, totales(w.inventario)), actuo: true, error });
  }
  return vistos;
}

const conAzarFijo = async (r, fn) => {
  const real = Math.random, reloj = globalThis.setTimeout;
  Math.random = () => r; globalThis.setTimeout = () => 0;
  try { return await fn(); } finally { Math.random = real; globalThis.setTimeout = reloj; }
};

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA BARRANCA
// ═══════════════════════════════════════════════════════════════════════════

async function barranca() {
  const s = seccion(1, 'LA BARRANCA — arcilla con la tecla, el rinde del dataset, y descansa');
  const acc = HERRAMIENTAS.acciones.find((a) => a.id === 'extraer_arcilla');
  if (!s.ok(!!acc, 'premisa: el dataset tiene extraer_arcilla')) { s.felizQue = 'sin acción'; return s; }
  const rindeDe = (rama) => (rama?.rinde || []).filter((r) => r.recurso === 'arcilla').reduce((a, r) => a + r.cantidad, 0);
  const aMano = rindeDe(acc.sinHerramienta), conPala = rindeDe(acc.conHerramienta);
  s.nota(`extraer_arcilla: a mano ${aMano}, con herramienta ${conPala}`);
  const herramientaQueHabilita = HERRAMIENTAS.objetos.find((o) => (o.habilita || []).includes('extraer_arcilla'))?.id;

  let dio = false;
  await conAzarFijo(0.99, async () => {
    // A mano, en la banda: el azar alto apaga todo lo que sale «a veces»
    const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }) });
    s.ok(w.rec._aguaCerca ? !w.rec._aguaCerca() : true, 'premisa: parado en la banda, el agua no está a mano');
    const v = await recorrer(w, ['arcilla']);
    const conArcilla = v.filter((x) => x.prom.has('arcilla') && x.actuo);
    s.ok(conArcilla.length >= 1, 'en la banda de orilla, la tecla ofrece arcilla con su paréntesis', v.map((x) => x.acc.etiqueta).join(' | ') || 'nada');
    const primero = conArcilla.find((x) => !x.prom.get('arcilla').veces);
    s.ok(!!primero, 'la arcilla de la barranca se promete con número, no como «a veces»', conArcilla.map((x) => x.acc.etiqueta).join(' | '));
    if (primero) {
      const p = primero.prom.get('arcilla');
      s.ok(p.min === aMano && p.max === aMano, 'a mano, el cartel promete lo que dice extraer_arcilla.sinHerramienta', `${p.min}–${p.max} contra ${aMano}`);
      s.ok((primero.obtenido.arcilla || 0) === aMano, 'y la tecla da eso', primero.obtenido.arcilla || 0);
      dio = (primero.obtenido.arcilla || 0) > 0;
    }
    // Descansa: apretar enseguida en el mismo lugar ya no promete arcilla de barranca.
    // Sólo cuenta si antes la ofreció: sin eso «no la vuelve a ofrecer» es verdad
    // porque nunca la ofreció, y contra la base daba verde por el motivo equivocado.
    const despues = w.rec.quePuedoHacer(1000);
    const parsear = await parser();
    const pDespues = parsear(despues?.etiqueta).get('arcilla');
    s.ok(!!primero && (!pDespues || pDespues.veces), 'recién sacada, la barranca descansa: la tecla no la vuelve a ofrecer', despues?.etiqueta ?? 'nada');
    const mucho = w.rec.quePuedoHacer(1000 + 30 * 24 * 3600);
    const pMucho = parsear(mucho?.etiqueta).get('arcilla');
    s.ok(!!pMucho && !pMucho.veces, 'y con el tiempo vuelve a ofrecerla', mucho?.etiqueta ?? 'nada');
  });

  // Con la herramienta que la habilita, rinde la otra rama y gasta un uso
  if (herramientaQueHabilita) {
    await conAzarFijo(0.99, async () => {
      const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }), herramienta: herramientaQueHabilita });
      s.ok(w.equipo.puede('extraer_arcilla'), `premisa: ${herramientaQueHabilita} en la mano habilita extraer_arcilla`);
      const usos0 = w.equipo.enRanura('mano')?.usos ?? w.equipo.usosDe?.(herramientaQueHabilita);
      const v = await recorrer(w, ['arcilla']);
      const x = v.find((y) => y.prom.has('arcilla') && !y.prom.get('arcilla').veces && y.actuo);
      s.ok(!!x && x.prom.get('arcilla').min === conPala, `con ${herramientaQueHabilita}, el cartel promete lo que dice conHerramienta`, x ? x.acc.etiqueta : 'nada');
      s.ok(!!x && (x.obtenido.arcilla || 0) === conPala, 'y la tecla da eso', x ? (x.obtenido.arcilla || 0) : 'nada');
      const usos1 = w.equipo.enRanura('mano')?.usos ?? w.equipo.usosDe?.(herramientaQueHabilita);
      s.ok(Number.isFinite(usos0) && usos1 === usos0 - 1, 'y gasta un uso de la herramienta', `${usos0} → ${usos1}`);
    });
  }

  // Ningún número escrito dos veces: si el dataset cambia, el cartel y la tecla cambian
  await conAzarFijo(0.99, async () => {
    const copia = JSON.parse(JSON.stringify(HERRAMIENTAS));
    const a = copia.acciones.find((y) => y.id === 'extraer_arcilla');
    for (const r of a.sinHerramienta.rinde) if (r.recurso === 'arcilla') r.cantidad = aMano + 2;
    const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }), herramientas: copia });
    const v = await recorrer(w, ['arcilla']);
    const x = v.find((y) => y.prom.has('arcilla') && !y.prom.get('arcilla').veces && y.actuo);
    s.ok(!!x && x.prom.get('arcilla').min === aMano + 2 && (x.obtenido.arcilla || 0) === aMano + 2,
      'con el dataset cambiado, el cartel y la tecla dan el número nuevo', x ? `${x.acc.etiqueta} → ${x.obtenido.arcilla || 0}` : 'nada');
  });

  // Lejos del agua, nada de barranca
  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: LEJOS, mundo: mundoFalso() });
    const acc0 = w.rec.quePuedoHacer(1000);
    const parsear = await parser();
    s.ok(!parsear(acc0?.etiqueta).has('arcilla'), 'lejos del agua la tecla no ofrece arcilla', acc0?.etiqueta ?? 'nada');
  });

  s.feliz = dio;
  s.felizQue = dio ? 'la barranca dio arcilla a mano' : 'la barranca no dio arcilla';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA ARENA
// ═══════════════════════════════════════════════════════════════════════════

async function arena() {
  const s = seccion(2, 'LA ARENA — un puñado en la playa de la Reserva, con la licencia dicha');
  const lic = HERRAMIENTAS.licenciasDeJuego?.licencias || [];
  const deArena = lic.find((l) => /arena/i.test(`${l.id} ${l.que}`));
  s.ok(!!deArena, 'licenciasDeJuego tiene una licencia de la arena', lic.map((l) => l.id).join(', '));
  if (deArena) {
    const norma = deArena.laNormaReal ?? deArena.laRealidad;
    s.ok(!!deArena.que && !!norma && !!deArena.porQueSeToma && !!deArena.comoLoDiceElJuego,
      'la licencia dice qué se toma, la norma real, por qué, y cómo lo dice el juego', Object.keys(deArena).join(', '));
    s.ok(/22\.?351/.test(norma || ''), 'la norma real nombra la Ley 22.351', (norma || '').slice(0, 80));
  }

  let dio = false;
  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }), jurisdiccion: 'reserva' });
    s.ok(w.mineria.yacimientoEn(ORILLA.x, ORILLA.z)?.id === 'arena', 'premisa: Mineria decide banco de arena en esta orilla', w.mineria.yacimientoEn(ORILLA.x, ORILLA.z)?.id);
    const v = await recorrer(w, ['arena', 'arcilla']);
    const conArena = v.filter((x) => x.prom.has('arena') && x.actuo);
    s.ok(conArena.length >= 1, 'en la playa de la Reserva, la tecla ofrece arena', v.map((x) => x.acc.etiqueta).join(' | ') || 'nada');
    const total = v.reduce((a, x) => a + (x.obtenido.arena || 0), 0);
    dio = total > 0;
    s.ok(dio, 'y la tecla da arena', total);
    for (const x of conArena) {
      const p = x.prom.get('arena');
      s.ok((x.obtenido.arena || 0) >= p.min && (x.obtenido.arena || 0) <= Math.max(p.max, p.veces ? Infinity : p.max), 'lo que da cae en lo que promete', `${x.acc.etiqueta} → ${x.obtenido.arena || 0}`);
      s.ok((x.obtenido.arena || 0) <= 2, 'es un puñado: dos o menos por vez, no una carga de cantera', x.obtenido.arena || 0);
    }
    s.ok(w.avisos.some((a) => /licencia/i.test(a)), 'el aviso del primer puñado dice que es una licencia', w.avisos.slice(-3).join(' | '));
    const despues = w.rec.quePuedoHacer(1000);
    const pDespues = (await parser())(despues?.etiqueta).get('arena');
    s.ok(dio && !pDespues, 'recién juntada, la playa descansa', despues?.etiqueta ?? 'nada');
    const ev = w.mineria.evaluar(ORILLA.x, ORILLA.z, 1000);
    s.ok(ev.permitido === false, 'la cantera en Reserva sigue negándose', ev.titulo);
  });

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }), jurisdiccion: 'parque' });
    const v = await recorrer(w, ['arena', 'arcilla']);
    s.ok(!v.some((x) => x.prom.has('arena')), 'en el Parque la tecla no ofrece arena', v.map((x) => x.acc.etiqueta).join(' | ') || 'nada');
    s.ok(!v.some((x) => (x.obtenido.arena || 0) > 0), 'ni la da', 0);
    const ev = w.mineria.evaluar(ORILLA.x, ORILLA.z, 1000);
    s.ok(ev.permitido === false && ev.castigo > 0, 'la cantera en el Parque sigue negándose con castigo', `${ev.titulo} · ${ev.castigo}`);
  });

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: ORILLA, mundo: mundoFalso({ aguaDesdeX: ORILLA.agua }), jurisdiccion: 'fuera' });
    const v = await recorrer(w, ['arena', 'arcilla']);
    s.ok(v.some((x) => (x.obtenido.arena || 0) > 0), 'fuera del área protegida también se junta', v.map((x) => x.acc.etiqueta).join(' | ') || 'nada');
  });

  s.feliz = dio;
  s.felizQue = dio ? 'la playa de la Reserva dio arena' : 'la playa no dio arena';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · LO QUE FALTA DICE DE DÓNDE SALE
// ═══════════════════════════════════════════════════════════════════════════

function htmlDelTaller(Taller, deps) {
  const cuerpo = { innerHTML: '' };
  const docReal = globalThis.document;
  globalThis.document = { ...docReal, getElementById: (id) => (id === 'tl-cuerpo' ? cuerpo : null), exitPointerLock() {} };
  try {
    const t = Object.create(Taller.prototype);
    Object.assign(t, deps);
    t.pintar();
  } finally {
    globalThis.document = docReal;
  }
  return cuerpo.innerHTML;
}

async function loQueFalta() {
  const s = seccion(3, 'LO QUE FALTA — el origen del material, y hacia dónde queda lo que ya se vio');
  const { Taller } = await imp('ui/Taller.js');
  const { Hallazgos } = await imp('systems/Hallazgos.js');
  const R = await imp('systems/Recursos.js');
  const hornos = (MINERIA.hornos || []).filter((h) => ['horno_barro', 'carbonera'].includes(h.id));
  s.ok(hornos.some((h) => h.id === 'horno_barro'), 'premisa: el horno de barro está en mineria.json');
  const mundo = mundoFalso();
  const hallazgosVacios = new Hallazgos({ mundo, mineria: { yacimientoEn: () => null, hayChatarra: () => false }, vegetacion: { lotes: [] }, sotobosque: { lotes: [] } });
  const conAnotados = new Hallazgos({ mundo, mineria: { yacimientoEn: () => null, hayChatarra: () => false }, vegetacion: { lotes: [] }, sotobosque: { lotes: [] } });
  conAnotados.celdas.clear();
  hallazgosVacios.celdas.clear();
  s.ok(conAnotados.anotar(-600, -600, 'arcilla') && conAnotados.anotar(2400, 1800, 'arcilla') && conAnotados.anotar(0, 1200, 'arena'),
    'premisa: se anotaron dos lugares de arcilla y uno de arena');
  const centro = (x, z) => { const k = conAnotados._indice(x, z); return conAnotados._centroDe(k); };
  const cA = centro(-600, -600), cB = centro(0, 1200);
  const dArcilla = Math.hypot(cA.x, cA.z), dArena = Math.hypot(cB.x, cB.z);
  s.nota(`arcilla anotada más cerca: ${dArcilla.toFixed(0)} m al noroeste · arena: ${dArena.toFixed(0)} m al sur`);

  const inventarioVacio = { disponiblePara: () => 0 };
  const fundicion = {
    cercano: () => null,
    definicionesHorno: hornos,
    faltaPara: (def) => (def.materiales || []).map((m) => ({ recurso: R.normalizar(m.recurso), nombre: R.nombreDe(m.recurso), pide: m.cantidad, hay: 0 })),
    tiempo: { segundosTotales: 0 },
    alCambiar: null,
  };
  const deps = (hallazgos) => ({
    fundicion, hallazgos,
    mineria: { evaluar: () => ({ permitido: false, detalle: '' }) },
    construccion: null,
    limites: { etiqueta: () => ({ id: 'reserva', nombre: 'Reserva Nacional Nahuel Huapi' }), jurisdiccion: () => 'reserva' },
    jugador: { posicion: { x: 0, y: 800, z: 0 } },
    inventario: inventarioVacio,
  });
  let sin = '', con = '';
  try { sin = htmlDelTaller(Taller, deps(hallazgosVacios)); } catch (e) { s.ok(false, 'el taller se pinta sin hallazgos anotados', e.message); }
  try { con = htmlDelTaller(Taller, deps(conAnotados)); } catch (e) { s.ok(false, 'el taller se pinta con hallazgos anotados', e.message); }
  s.ok(sin.length > 100 && con.length > 100, 'premisa: el taller pintó su lista', `${sin.length} · ${con.length} caracteres`);

  const origen = (id) => (MINERIA.materiales || []).find((m) => m.id === id)?.origen || '';
  const clave = (txt) => txt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s.ok(clave(sin).includes(clave(origen('arcilla'))), 'lo que falta dice el origen de la arcilla, leído de mineria.json', origen('arcilla'));
  s.ok(clave(sin).includes(clave(origen('arena'))), 'lo que falta dice el origen de la arena, leído de mineria.json', origen('arena'));

  /** Distancias escritas: «850 m», «0,8 km», «1.2 km». */
  const distancias = (html) => [...html.matchAll(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/g)].map((m) => {
    const n = parseFloat(m[1].replace(',', '.'));
    return m[2] === 'km' ? n * 1000 : n;
  });
  const cerca = (lista, d) => lista.some((v) => Math.abs(v - d) <= 0.15 * d);
  s.ok(cerca(distancias(con), dArcilla) && !cerca(distancias(sin), dArcilla), 'con arcilla anotada, dice a cuánto queda la más cercana', distancias(con).join(', '));
  s.ok(cerca(distancias(con), dArena) && !cerca(distancias(sin), dArena), 'con arena anotada, dice a cuánto queda', distancias(con).join(', '));
  const cuenta = (html, re) => (html.match(re) || []).length;
  s.ok(cuenta(con, /noroeste|\bNO\b/gi) > cuenta(sin, /noroeste|\bNO\b/gi), 'y hacia dónde: la arcilla queda al noroeste');
  s.ok(cuenta(con, /\bsur\b|\bS\b/gi) > cuenta(sin, /\bsur\b|\bS\b/gi), 'y la arena, al sur');
  s.ok(!cerca(distancias(sin), dArcilla) && !cerca(distancias(sin), dArena), 'sin nada anotado, no inventa un lugar', distancias(sin).join(', ') || 'ninguna distancia');

  s.feliz = sin.length > 100 && con.length > 100;
  s.felizQue = 'el taller pintó con y sin hallazgos';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · UNA SOLA REGLA
// ═══════════════════════════════════════════════════════════════════════════

async function unaRegla() {
  const s = seccion(4, 'UNA SOLA REGLA — el mapa marca arcilla donde la tecla la da');
  const { Hallazgos } = await imp('systems/Hallazgos.js');
  const parsear = await parser();
  const agua = 990;
  let iguales = 0, total = 0, ofrecidas = 0;
  const distintas = [];
  for (let x = 900; x <= 988; x += 4) {
    const mundo = mundoFalso({ aguaDesdeX: agua });
    const pos = { x, y: 800, z: 0 };
    const { Mineria } = await imp('systems/Mineria.js');
    const limites = { jurisdiccion: () => 'reserva' };
    const h = new Hallazgos({ mundo, mineria: new Mineria(MINERIA, { mundo, limites }), vegetacion: { lotes: [] }, sotobosque: { lotes: [] } });
    h.celdas.clear();
    h.revisar(pos, { horaDecimal: 12, densidadNiebla: 0 }, 1);
    const marca = h.hay(x, 0, 'arcilla');
    const w = await armar({ en: pos, mundo });
    const acc = await conAzarFijo(0.99, async () => w.rec.quePuedoHacer(1000));
    const p = parsear(acc?.etiqueta).get('arcilla');
    const da = !!p && !p.veces;
    total++;
    if (da) ofrecidas++;
    if (marca === da) iguales++; else distintas.push(`x ${x}: mapa ${marca} · tecla ${da}`);
  }
  s.ok(ofrecidas > 0 && ofrecidas < total, 'premisa: la recorrida pasa por puntos con barranca y sin ella', `${ofrecidas} de ${total}`);
  s.ok(iguales === total, 'en cada punto, el mapa marca arcilla si y sólo si la tecla la da', distintas.slice(0, 4).join(' | ') || `${iguales}/${total}`);
  s.feliz = ofrecidas > 0;
  s.felizQue = `${ofrecidas} puntos con barranca de ${total}`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · SIN REGRESIÓN  ·  6 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(5, 'SIN REGRESIÓN — las fases anteriores siguen verdes');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const real = { BANCO_SRC: path.join(RAIZ, 'src') };
  const otros = [
    ['banco-r7-fase1.mjs', '6/6', real],
    ['banco-r7-fase2.mjs', '4/4', real],
    ['banco-r7-fase2b.mjs', '7/7', real],
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

const SECCIONES = { barranca, arena, loQueFalta, unaRegla, regresion, arranque };
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

console.log(`\n  BANCO R7 · FASE 3 — el barro, mitad Node   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
