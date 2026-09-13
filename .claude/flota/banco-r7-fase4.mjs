/**
 * BANCO DE LA FASE 4 (vasija) — ronda 7.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga los módulos de verdad: `Inventario`, `Equipo`,
 * `Recoleccion`, `Fundicion` y `Bolso`.
 *
 *   1. SIN RECIPIENTE (V1) — los tres líquidos entran cero; los otros 68 recursos,
 *      igual que antes, aunque hidraten.
 *   2. EL RECIPIENTE (V2) — guarda lo de su ficha, las tres clases juntas, dos odres
 *      son doce, soltarlo baja el tope, y puesto en una ranura cuenta igual.
 *   3. ANTES DEL CUERO (V3) — un recorrido de la cadena entera, recetas, hornos y
 *      tecnologías, encuentra un recipiente sin cuero ni cuero curtido; con fuente.
 *   4. BEBER (V4) — hidrata siempre; la medida, sólo si hay en qué; el aviso lo dice.
 *   5. LOS HORNOS ESPERAN (V5) — con el `esperando` que ya existe.
 *   6. SOLTAR Y CARGAR (V6) — soltar por el bolso derrama sólo lo que no cabe; un
 *      guardado con líquido de más no pierde nada; `VERSION` sigue en 1.
 *   7. SE VE (V7) — `inventario.liquido` es `{ lleva, cabe }`, en medidas.
 *   8. NADA MÁS CAMBIA (V8) — la Q bebe, `disponiblePara` y `consumirPara` igual,
 *      los recipientes nuevos tienen icono.
 *   9. SIN REGRESIÓN (V9) — los bancos de la ronda 6 y de la ronda 7.
 *  10. ARRANQUE — `vite build`.
 *
 * Qué SE fija, porque el contrato lo dice: el campo `efecto.guardaAgua`, la puerta
 * `inventario.liquido`, la acción `tirar_obj` del bolso, los campos `fuente` o
 * `criterio`, y el `esperando` de `Fundicion`.
 *
 * Qué NO se fija, a propósito: dónde vive el tope adentro de `Inventario`, qué
 * líquido se derrama primero cuando hay de dos clases, las palabras exactas de los
 * avisos (se piden familias: «no hay en qué llevarla», «se derramó» y cuánto), si un
 * recipiente gastado sigue guardando, y si el cartel de beber promete la medida
 * cuando sí entra —si la promete, tiene que darla—.
 *
 * El bolso se arma sin DOM y se le pisa `pintar()`: el derrame tiene que pasar al
 * soltar, no al pintar, y así lo dice V6.
 *
 * Uso: node .claude/flota/banco-r7-fase4.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
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
const HISTORIA = JSON.parse(leer('data/historia.json'));

const LIQUIDOS = ['agua', 'agua_segura', 'infusion_canelo'];
const copiar = (x) => JSON.parse(JSON.stringify(x));
const recipientes = (datos = HERRAMIENTAS) => (datos.objetos || []).filter((o) => Number(o.efecto?.guardaAgua) > 0);
const liquidoEn = (inv) => LIQUIDOS.reduce((a, id) => a + inv.cantidad(id), 0);

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = globalThis.document || { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };

const PALABRAS = { 1: 'un|una|uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce', 15: 'quince', 20: 'veinte' };
/** ¿El texto dice este número, en cifra o en palabra? «4,5 kg» no dice 4. */
function diceNumero(txt, n) {
  if (new RegExp(`(^|[^\\d.,])${n}(?![\\d]|[.,]\\d)`).test(txt || '')) return true;
  return !!PALABRAS[n] && new RegExp(`(^|[^a-záéíóúñ])(${PALABRAS[n]})([^a-záéíóúñ]|$)`, 'i').test(txt || '');
}

// ═══════════════════════════════════════════════════════════════════════════
// Armado
// ═══════════════════════════════════════════════════════════════════════════

/** Un bolso con su equipo, como lo arma `main.js`, y lo que se pida ya fabricado. */
async function armarBolso({ capacidad = 200, herramientas = HERRAMIENTAS, con = [] } = {}) {
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const avisos = [];
  const hud = {
    aviso: (t, d) => avisos.push(`${t} · ${d ?? ''}`),
    negativa: (v) => avisos.push(`NEGATIVA · ${v?.titulo ?? ''} · ${v?.detalle ?? ''}`),
    mostrarAccion() {},
  };
  const inventario = new Inventario(capacidad);
  const equipo = new Equipo(herramientas, { inventario });
  const guardados = con.map((id) => equipo.guardar(id));
  return { inventario, equipo, hud, avisos, guardados };
}

function mundoFalso({ aguaDesdeX = Infinity, altura = 800 } = {}) {
  const m = {
    tamano: 65536, mitad: 32768,
    esAgua: (x) => x >= aguaDesdeX,
    cauceEn: () => 0,
    alturaEn: () => altura,
    pendienteEn: () => 0.1,
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

async function armar({ en, mundo, con = [], sed = 100, hambre = 100, herramientas = HERRAMIENTAS }) {
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const { Mineria } = await imp('systems/Mineria.js');
  const { Caza } = await imp('systems/Caza.js');
  const b = await armarBolso({ herramientas, con });
  const { inventario, equipo, hud, avisos } = b;
  const saberes = { puntos: 0, otorgar(p) { this.puntos += p; }, desbloqueadas: new Set(), porId: new Map() };
  const codice = { identificadas: new Set(), registrarFlora() {}, registrarFauna() {} };
  const jugador = { posicion: { ...en }, sed, hambre, salud: 100, enAgua: false };
  const limites = { jurisdiccion: () => 'reserva', etiqueta: () => ({ id: 'reserva', nombre: 'reserva' }) };
  const mineria = new Mineria(MINERIA, { mundo, limites, jugador, inventario, saberes, hud });
  const caza = new Caza(CAZA, { inventario, hud, saberes, jugador, mundo, limites, equipo });
  const rec = new Recoleccion({ mundo, jugador, vegetacion: { masCercana: () => null }, sotobosque: { lotes: [] }, fauna: { masCercano: () => null }, inventario, saberes, codice, hud });
  rec.caza = caza;
  rec.mineria = mineria;
  rec.pesca = null;
  rec.equipo = equipo;
  rec.herramientas = herramientas;
  return { rec, inventario, equipo, avisos, jugador };
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

const conAzarFijo = async (r, fn) => {
  const real = Math.random, reloj = globalThis.setTimeout;
  Math.random = () => r; globalThis.setTimeout = () => 0;
  try { return await fn(); } finally { Math.random = real; globalThis.setTimeout = reloj; }
};

/**
 * Aprieta un botón del bolso de verdad, sin DOM: arma el panel con un documento
 * falso, se queda con el oyente del clic y le manda un botón con ese `dataset`.
 * `pintar()` se pisa: el derrame tiene que pasar al soltar.
 */
async function clicEnBolso(w, dataset) {
  const { Bolso } = await imp('ui/Bolso.js');
  const oyentes = {};
  const elemento = () => ({ style: {}, dataset: {}, innerHTML: '', textContent: '', addEventListener: (t, fn) => { oyentes[t] = oyentes[t] || fn; }, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] });
  const docReal = globalThis.document;
  globalThis.document = {
    ...docReal, addEventListener() {}, createElement: elemento, getElementById: () => null,
    body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }, head: { appendChild() {} },
  };
  try {
    const b = Object.create(Bolso.prototype);
    Object.assign(b, { inventario: w.inventario, equipo: w.equipo, hud: w.hud, jugador: { posicion: { x: 0, y: 800, z: 0 }, sed: 100, hambre: 100, salud: 100 }, tiempo: { fecha: new Date(0) }, abierto: true, _tomada: null, _mirando: null, _hojaPuesta: true });
    b._crear();
    b.pintar = () => {};
    b._refrescarDetalle = () => {};
    const boton = { dataset };
    oyentes.click({ target: { closest: (sel) => (/data-cs/.test(sel) ? null : boton) }, preventDefault() {} });
  } finally {
    globalThis.document = docReal;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · SIN RECIPIENTE
// ═══════════════════════════════════════════════════════════════════════════

async function sinRecipiente() {
  const s = seccion(1, 'SIN RECIPIENTE — el agua no viaja suelta, y lo demás entra igual que antes');
  const R = await imp('systems/Recursos.js');
  s.ok(recipientes().length >= 1, 'premisa: el dataset tiene recipientes con efecto.guardaAgua', recipientes().map((o) => `${o.id}:${o.efecto.guardaAgua}`).join(', '));
  const { inventario: inv, equipo } = await armarBolso();
  s.ok([...equipo.todas()].length === 0, 'premisa: el bolso arranca sin nada fabricado');
  const piedra = inv.agregar('piedra', 3);
  s.ok(piedra === 3, 'premisa: en el mismo bolso, tres piedras entran', piedra);
  for (const id of LIQUIDOS) {
    const n = inv.agregar(id, 3);
    s.ok(n === 0, `sin recipiente, ${id} entra cero`, n);
  }
  s.ok(liquidoEn(inv) === 0, 'y en el bolso no quedó líquido', liquidoEn(inv));
  s.ok(!inv.sinCasillas && inv.pesoKg < inv.capacidadKg - 10, 'premisa: sobraban peso y casilleros', `${inv.pesoKg.toFixed(1)} kg · ${inv.casillas.filter((c) => !c).length} libres`);

  const otros = Object.keys(R.RECURSOS).filter((id) => !LIQUIDOS.includes(id));
  const distintos = [];
  for (const id of otros) {
    const { inventario } = await armarBolso();
    const n = inventario.agregar(id, 1);
    if (n !== 1) distintos.push(`${id}: ${n}`);
  }
  const hidratan = otros.filter((id) => R.RECURSOS[id].hidrata > 0);
  s.ok(distintos.length === 0, `los otros ${otros.length} recursos entran como antes, también los ${hidratan.length} que hidratan`, distintos.slice(0, 6).join(' · ') || hidratan.join(', '));

  s.feliz = piedra === 3;
  s.felizQue = s.feliz ? 'el bolso recibió piedras' : 'el bolso no recibió ni piedras';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · EL RECIPIENTE
// ═══════════════════════════════════════════════════════════════════════════

async function elRecipiente() {
  const s = seccion(2, 'EL RECIPIENTE — guarda lo que dice su ficha, se suma, y soltarlo baja el tope');
  const odre = HERRAMIENTAS.objetos.find((o) => o.id === 'odre_cuero');
  s.ok(odre?.efecto?.guardaAgua === 6, 'premisa: el odre declara guardaAgua 6', odre?.efecto?.guardaAgua);

  const a = await armarBolso({ con: ['odre_cuero'] });
  const enGrilla = a.inventario.instancias('odre_cuero').length === 1;
  s.ok(enGrilla, 'premisa: el odre fabricado quedó en un casillero');
  const n = a.inventario.agregar('agua', 10);
  s.ok(n === 6, 'con el odre, de diez medidas de agua entran seis', n);
  s.ok(a.inventario.agregar('agua', 1) === 0, 'y la séptima no');
  s.ok(a.inventario.agregar('piedra', 2) === 2, 'con el odre lleno, lo que no es líquido sigue entrando');

  const b = await armarBolso({ con: ['odre_cuero'] });
  const b1 = b.inventario.agregar('agua', 3);
  const b2 = b.inventario.agregar('infusion_canelo', 5);
  const b3 = b.inventario.agregar('agua_segura', 1);
  s.ok(b1 === 3 && b2 === 3 && b3 === 0, 'las tres clases comparten el tope: 3 de agua dejan lugar a 3 de infusión, y a nada más', `${b1} · ${b2} · ${b3}`);

  const c = await armarBolso({ con: ['odre_cuero', 'odre_cuero'] });
  s.ok(c.inventario.instancias('odre_cuero').length === 2, 'premisa: dos odres son dos casilleros');
  const cn = c.inventario.agregar('agua', 20);
  s.ok(cn === 12, 'dos odres guardan doce', cn);

  const copia = copiar(HERRAMIENTAS);
  copia.objetos.find((o) => o.id === 'odre_cuero').efecto.guardaAgua = 9;
  const d = await armarBolso({ herramientas: copia, con: ['odre_cuero'] });
  const dn = d.inventario.agregar('agua', 20);
  s.ok(dn === 9, 'con la ficha cambiada a 9, el odre guarda 9: el número no está escrito dos veces', dn);

  for (const o of recipientes()) {
    const e = await armarBolso({ con: [o.id] });
    const puso = [...e.equipo.todas()].some((x) => x.cosa.id === o.id);
    const en = e.inventario.agregar('agua', o.efecto.guardaAgua + 5);
    s.ok(puso && en === o.efecto.guardaAgua, `${o.id} guarda las ${o.efecto.guardaAgua} que declara`, puso ? en : 'no se pudo fabricar');
  }

  const f = await armarBolso({ con: ['odre_cuero'] });
  const i = f.inventario.instancias('odre_cuero')[0]?.i;
  const sacado = Number.isInteger(i) && !!f.inventario.sacar(i);
  s.ok(sacado && f.inventario.agregar('agua', 1) === 0, 'sacado el odre del bolso, el agua vuelve a entrar cero');

  // Puesto en una ranura también cuenta, y pasarlo de la grilla a la ranura no derrama
  const conRanura = copiar(HERRAMIENTAS);
  conRanura.objetos.find((o) => o.id === 'odre_cuero').ranura = 'espalda';
  const g = await armarBolso({ herramientas: conRanura, con: ['odre_cuero'] });
  const puesto = g.equipo.puesto.espalda?.id === 'odre_cuero';
  s.ok(puesto, 'premisa: con ranura en la ficha, el odre recién hecho va puesto a la espalda');
  const gn = g.inventario.agregar('agua', 10);
  s.ok(puesto && gn === 6, 'puesto, el odre guarda seis igual', gn);
  const desq = g.equipo.desequipar('espalda');
  s.ok(desq && gn === 6 && g.inventario.cantidad('agua') === 6, 'guardarlo en el bolso no derrama', `${desq} · ${g.inventario.cantidad('agua')}`);
  const cosa = g.inventario.instancias('odre_cuero')[0]?.cosa;
  const eq = !!cosa && g.equipo.equipar(cosa);
  s.ok(eq && gn === 6 && g.inventario.cantidad('agua') === 6, 'y volver a ponérselo tampoco', `${eq} · ${g.inventario.cantidad('agua')}`);
  s.ok(gn === 6 && g.inventario.agregar('agua', 1) === 0, 'y el tope sigue en seis');

  s.feliz = enGrilla && n > 0;
  s.felizQue = s.feliz ? 'el odre quedó en el bolso y entró agua' : 'el odre no llegó al bolso, o no entró agua';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · ANTES DEL CUERO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Un recorrido Y-O de la cadena. Un recurso se alcanza sin cuero si se junta, o si no
 * lo produce nada y es un recurso, o si alguno de sus productores se alcanza. Un
 * productor —receta de horno u objeto que produce— se alcanza si todo lo que pide se
 * alcanza, y además su horno o su tecnología. Un horno, si sus materiales y alguna de
 * las tecnologías que lo dan. Una tecnología, si sus materiales y lo que requiere.
 *
 * Es estricto a propósito: lo que pide una herramienta para juntarse no cuenta como
 * juntable, y un ciclo no es un camino.
 */
async function recorrido() {
  const R = await imp('systems/Recursos.js');
  const PROHIBIDOS = new Set(['cuero', 'cuero_curtido']);
  const productores = new Map();
  const suma = (r, p) => { const k = R.normalizar(r); if (!productores.has(k)) productores.set(k, []); productores.get(k).push(p); };
  for (const rc of MINERIA.recetas || []) for (const x of rc.sale || []) suma(x.recurso, { tipo: 'receta', id: rc.id, pide: rc.entra || rc.pide || [], horno: rc.horno });
  for (const o of HERRAMIENTAS.objetos || []) for (const x of o.produce || []) suma(x.recurso, { tipo: 'objeto', id: o.id, pide: o.materiales || [], tecnologia: o.tecnologia });

  const tecs = new Map();
  const listas = [HISTORIA.tecnologias, HERRAMIENTAS.tecnologiasNuevas].filter(Array.isArray);
  for (const t of listas.flat()) {
    if (!t?.id) continue;
    const a = tecs.get(t.id) || { id: t.id, materiales: [], requiere: [], hornos: [] };
    a.materiales.push(...(t.materiales || []));
    a.requiere.push(...(t.requiere || []));
    if (t.efecto?.horno) a.hornos.push(t.efecto.horno);
    tecs.set(t.id, a);
  }
  const juntables = new Set((MINERIA.materiales || []).map((m) => R.normalizar(m.id)));
  for (const a of HERRAMIENTAS.acciones || []) {
    if (Array.isArray(a.sinHerramienta?.rinde)) for (const x of a.sinHerramienta.rinde) juntables.add(R.normalizar(x.recurso));
  }
  const RECS = new Set(Object.keys(R.RECURSOS));
  const ids = [...new Set([...RECS, ...productores.keys()])];

  const memo = new Map();
  const una = (clave, fn) => {
    if (memo.has(clave)) return memo.get(clave);
    memo.set(clave, false);
    const v = !!fn();
    memo.set(clave, v);
    return v;
  };
  const recurso = (k) => una(`r:${k}`, () => {
    if (PROHIBIDOS.has(k)) return false;
    if (juntables.has(k)) return true;
    const ps = productores.get(k) || [];
    if (!ps.length) return RECS.has(k);
    return ps.some(productor);
  });
  const pedido = (p) => una(`p:${p}`, () => {
    const q = R.normalizar(p);
    return ids.filter((k) => k === q || R.satisface(k).includes(q)).some(recurso);
  });
  const materiales = (lista) => (lista || []).every((m) => pedido(m.recurso));
  const tec = (id) => !id || una(`t:${id}`, () => { const t = tecs.get(id); return !!t && materiales(t.materiales) && t.requiere.every(tec); });
  const horno = (id) => una(`h:${id}`, () => {
    const h = (MINERIA.hornos || []).find((x) => x.id === id);
    if (!h) return false;
    const dan = [...tecs.values()].filter((t) => t.hornos.includes(id)).map((t) => t.id);
    return materiales(h.materiales) && (!dan.length || dan.some(tec));
  });
  const productor = (p) => una(`${p.tipo}:${p.id}`, () => materiales(p.pide) && (p.tipo === 'receta' ? horno(p.horno) : tec(p.tecnologia)));
  const objeto = (o) => (o.materiales || []).length > 0 && materiales(o.materiales) && tec(o.tecnologia);
  return { objeto, pedido, tecs };
}

async function antesDelCuero() {
  const s = seccion(3, 'ANTES DEL CUERO — un recipiente sin cuero en ningún eslabón, con su fuente');
  const { objeto, pedido, tecs } = await recorrido();
  const porId = (id) => HERRAMIENTAS.objetos.find((o) => o.id === id);
  const odre = porId('odre_cuero'), canasto = porId('canasto_junco_obj'), candil = porId('candil_grasa'), mochila = porId('mochila_cuero');
  const valeOdre = !!odre && !objeto(odre);
  const valeMochila = !!mochila && !objeto(mochila);
  const valeCanasto = !!canasto && objeto(canasto);
  const valeCandil = !!candil && objeto(candil);
  s.ok(valeOdre, 'premisa: el recorrido ve el cuero curtido del odre');
  s.ok(valeMochila, 'premisa: y el de la mochila, que llega también por el tiento');
  s.ok(valeCanasto, 'premisa: da por alcanzable el canasto de junco, que no pide cuero');
  s.ok(valeCandil, 'premisa: y el candil, que pide cerámica: receta del horno de barro, arcilla, arena, alfarería, fuego por fricción');
  s.ok(pedido('agua_segura') && !pedido('tiento'), 'premisa: el agua hervida se alcanza y el tiento no');

  const todos = recipientes();
  const sinCuero = todos.filter(objeto);
  s.ok(sinCuero.length >= 1, 'al menos un recipiente se fabrica sin cuero ni cuero curtido en ningún eslabón', todos.map((o) => `${o.id}:${objeto(o) ? 'sin cuero' : 'con cuero'}`).join(' · '));
  for (const o of sinCuero) {
    const txt = [o.fuente, o.criterio].filter((x) => typeof x === 'string').join(' ');
    s.ok(txt.length >= 60, `${o.id} trae su fuente o su criterio en la ficha`, `${txt.length} caracteres`);
    s.ok(diceNumero(txt, o.efecto.guardaAgua), `${o.id}: la fuente dice para cuánto guarda (${o.efecto.guardaAgua})`, txt.slice(0, 160));
    s.ok(!o.tecnologia || tecs.has(o.tecnologia), `${o.id}: su tecnología existe en el árbol`, o.tecnologia);
    s.nota(`${o.id} · guarda ${o.efecto.guardaAgua} · ${(o.materiales || []).map((m) => `${m.cantidad} ${m.recurso}`).join(', ')} · ${o.tecnologia || 'sin tecnología'} · ${o.kg ?? '?'} kg`);
  }

  s.feliz = valeOdre && valeCanasto && valeCandil;
  s.felizQue = s.feliz ? 'el recorrido distingue el cuero en casos conocidos' : 'el recorrido no distingue los casos conocidos';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · BEBER
// ═══════════════════════════════════════════════════════════════════════════

const SIN_RECIPIENTE = /recipiente|en qu[eé] (llevar|cargar|guardar)|d[oó]nde (llevar|cargar|guardar)|con qu[eé] (llevar|cargar)|odre|vasija|c[aá]ntaro|cuenco/i;
const SIN_LUGAR = /recipiente|lleno|llena|no (te )?(entra|cabe)|sin lugar|en qu[eé] (llevar|cargar|guardar)|no hay d[oó]nde/i;

async function beber() {
  const s = seccion(4, 'BEBER — siempre hidrata; llevarse una medida, sólo si hay en qué');
  const orilla = { x: 999, y: 800, z: 0 };
  const parsear = await parser();
  const SUBE = 32;
  let hidrato = false;

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: orilla, mundo: mundoFalso({ aguaDesdeX: 1000 }), sed: 50 });
    const acc = w.rec.quePuedoHacer(1000);
    s.ok(acc?.tipo === 'beber' || /beber/i.test(acc?.etiqueta || ''), 'premisa: parado en la orilla con sed, la tecla ofrece beber', acc?.etiqueta ?? 'nada');
    s.ok(!parsear(acc?.etiqueta).has('agua'), 'sin recipiente, el cartel no promete una medida', acc?.etiqueta ?? 'nada');
    w.rec.actuar(1000);
    hidrato = w.jugador.sed === 50 + SUBE;
    s.ok(hidrato, 'sin recipiente, beber hidrata como hoy', w.jugador.sed);
    s.ok(w.inventario.cantidad('agua') === 0, 'y no se lleva agua', w.inventario.cantidad('agua'));
    const av = w.avisos.at(-1) || '';
    s.ok(SIN_RECIPIENTE.test(av) && !/te llevaste/i.test(av), 'el aviso dice que no hay en qué llevarla', av);
  });

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: orilla, mundo: mundoFalso({ aguaDesdeX: 1000 }), sed: 50, con: ['odre_cuero'] });
    const acc = w.rec.quePuedoHacer(1000);
    const prom = parsear(acc?.etiqueta).get('agua');
    w.rec.actuar(1000);
    s.ok(w.jugador.sed === 50 + SUBE, 'con el odre, beber hidrata igual', w.jugador.sed);
    s.ok(w.inventario.cantidad('agua') === 1, 'y se lleva una medida', w.inventario.cantidad('agua'));
    s.ok(!prom || (prom.min <= 1 && 1 <= prom.max), 'si el cartel promete la medida, la da', acc?.etiqueta ?? 'nada');
  });

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: orilla, mundo: mundoFalso({ aguaDesdeX: 1000 }), sed: 50, con: ['odre_cuero'] });
    const puso = w.inventario.agregar('agua', 6);
    const acc = w.rec.quePuedoHacer(1000);
    w.rec.actuar(1000);
    s.ok(w.jugador.sed === 50 + SUBE, 'con el odre lleno, beber hidrata igual', w.jugador.sed);
    s.ok(puso === 6 && w.inventario.cantidad('agua') === 6, 'y no se lleva la séptima', `${puso} · ${w.inventario.cantidad('agua')}`);
    const av = w.avisos.at(-1) || '';
    s.ok(puso === 6 && SIN_LUGAR.test(av) && !/te llevaste/i.test(av), 'el aviso dice que no hay lugar', av);
    s.ok(!parsear(acc?.etiqueta).has('agua'), 'con el odre lleno, el cartel no promete una medida', acc?.etiqueta ?? 'nada');
  });

  s.feliz = hidrato;
  s.felizQue = hidrato ? 'beber hidrató' : 'beber no hidrató';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LOS HORNOS ESPERAN
// ═══════════════════════════════════════════════════════════════════════════

async function hornos() {
  const s = seccion(5, 'LOS HORNOS ESPERAN — el agua hervida y la infusión salen sólo si hay dónde');
  const { Fundicion } = await imp('systems/Fundicion.js');
  const T = Date.UTC(2026, 0, 15, 15);

  async function hornada(recetaId, { con = [], antes = [] } = {}) {
    const b = await armarBolso({ con });
    for (const [id, n] of antes) b.inventario.agregar(id, n);
    const f = new Fundicion(MINERIA, {
      inventario: b.inventario, saberes: { otorgar() {} }, jugador: { posicion: { x: 0, y: 800, z: 0 } },
      tiempo: { fecha: new Date(T) }, hud: b.hud, limites: { jurisdiccion: () => 'reserva' }, mundo: mundoFalso(),
    });
    const receta = f.recetas.find((r) => r.id === recetaId);
    const def = receta && f.hornoPorId(receta.horno);
    const horno = { def, x: 0, z: 0, y: 800, fuego: { desde: T - 3600e3, hasta: T + 48 * 3600e3 }, trabajo: receta ? { receta, desde: T - 7200e3, hasta: T - 1, apagado: false } : null };
    f.hornos.push(horno);
    f.actualizar(null);
    return { ...b, f, horno, receta, def };
  }

  const a = await hornada('agua_hervida');
  s.ok(!!a.receta && !!a.def, 'premisa: la receta del agua hervida y su horno están en mineria.json', `${a.receta?.id} · ${a.def?.id}`);
  s.ok(a.horno.trabajo?.esperando === true, 'sin recipiente, el agua hervida queda esperando en el horno', JSON.stringify(a.horno.trabajo?.sale ?? null));
  s.ok(a.inventario.cantidad('agua_segura') === 0, 'y no llega al bolso', a.inventario.cantidad('agua_segura'));
  s.ok(/no entra|esperando|junto al horno/i.test(a.avisos.join(' | ')), 'y el aviso lo dice', a.avisos.join(' | '));

  const a2 = await hornada('infusion_canelo');
  s.ok(a2.horno.trabajo?.esperando === true && a2.inventario.cantidad('infusion_canelo') === 0, 'sin recipiente, la infusión también espera', a2.inventario.cantidad('infusion_canelo'));

  const b = await hornada('agua_hervida', { con: ['odre_cuero'] });
  const entro = b.inventario.cantidad('agua_segura');
  s.ok(b.horno.trabajo === null && entro === 2, 'con el odre, las dos medidas salen al bolso', `${entro} · ${JSON.stringify(b.horno.trabajo?.sale ?? null)}`);

  const c = await hornada('agua_hervida', { con: ['odre_cuero'], antes: [['agua', 5]] });
  s.ok(c.inventario.cantidad('agua') === 5, 'premisa: el odre ya llevaba cinco de agua');
  s.ok(c.inventario.cantidad('agua_segura') === 1 && c.horno.trabajo?.esperando === true, 'con lugar para una, sale una y la otra espera', `${c.inventario.cantidad('agua_segura')} · ${JSON.stringify(c.horno.trabajo?.sale ?? null)}`);
  c.inventario.quitar('agua', 2);
  const retiro = c.f.retirar(c.horno);
  s.ok(retiro && c.inventario.cantidad('agua_segura') === 2 && c.horno.trabajo === null, 'bebida el agua, la que esperaba se retira', `${retiro} · ${c.inventario.cantidad('agua_segura')}`);

  s.feliz = entro > 0;
  s.felizQue = s.feliz ? 'la hornada de agua hervida llegó al bolso' : 'la hornada no llegó al bolso ni con el odre';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SOLTAR Y CARGAR
// ═══════════════════════════════════════════════════════════════════════════

const DERRAME = /derram|volc|escurr|se (te )?cay|perdiste|se perdi/i;
/** Dice que se derramó, y no «no se derramó nada». */
const diceDerrame = (av) => DERRAME.test(av || '') && !/(\bno|\bnada|\bsin)\s+(se\s+)?(derram|volc|escurr|cay|perd)/i.test(av || '');

async function soltarYCargar() {
  const s = seccion(6, 'SOLTAR Y CARGAR — derrama sólo lo que no cabe; el guardado no pierde nada');
  let solto = false;

  const a = await armarBolso({ con: ['odre_cuero', 'odre_cuero'] });
  const aPuso = a.inventario.agregar('agua', 10);
  const aI = a.inventario.instancias('odre_cuero')[0]?.i;
  try { await clicEnBolso(a, { accion: 'tirar_obj', i: String(aI) }); } catch (e) { s.ok(false, 'el bolso suelta el odre sin explotar', e.message); }
  solto = a.inventario.instancias('odre_cuero').length === 1;
  s.ok(solto, 'premisa: el botón del bolso soltó uno de los dos odres');
  s.ok(aPuso === 10 && liquidoEn(a.inventario) === 6, 'con diez medidas y un odre menos, quedan las seis que caben', `${aPuso} · ${liquidoEn(a.inventario)}`);
  const aAv = a.avisos.at(-1) || '';
  s.ok(aPuso === 10 && diceDerrame(aAv) && diceNumero(aAv, 4), 'el aviso dice que se derramaron cuatro', aAv);

  const b = await armarBolso({ con: ['odre_cuero', 'odre_cuero'] });
  b.inventario.agregar('agua', 3);
  const bI = b.inventario.instancias('odre_cuero')[0]?.i;
  try { await clicEnBolso(b, { accion: 'tirar_obj', i: String(bI) }); } catch (e) { s.ok(false, 'el bolso suelta el odre sin explotar', e.message); }
  const bAv = b.avisos.at(-1) || '';
  s.ok(b.inventario.cantidad('agua') === 3 && !diceDerrame(bAv), 'con tres medidas, soltar un odre no derrama nada ni dice que derramó', `${b.inventario.cantidad('agua')} · ${bAv}`);

  const c = await armarBolso({ con: ['odre_cuero', 'odre_cuero'] });
  const c1 = c.inventario.agregar('agua', 5), c2 = c.inventario.agregar('infusion_canelo', 5);
  const cI = c.inventario.instancias('odre_cuero')[0]?.i;
  try { await clicEnBolso(c, { accion: 'tirar_obj', i: String(cI) }); } catch (e) { s.ok(false, 'el bolso suelta el odre sin explotar', e.message); }
  s.ok(c1 + c2 === 10 && liquidoEn(c.inventario) === 6, 'con dos clases de líquido, también quedan seis', `${c1}+${c2} · ${liquidoEn(c.inventario)}`);

  // El guardado
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const R = await imp('systems/Recursos.js');
  const pila = R.pilaDe(R.pesoDe('agua'));
  const pilas = (n) => { const out = []; while (n > 0) { out.push({ id: 'agua', n: Math.min(pila, n) }); n -= pila; } return out; };

  const d = new Inventario(200); new Equipo(HERRAMIENTAS, { inventario: d });
  d.reponer({ casillas: pilas(5) });
  s.ok(d.cantidad('agua') === 5, 'un guardado sin recipiente y con cinco de agua conserva las cinco', d.cantidad('agua'));
  s.ok(d.cantidad('agua') === 5 && d.agregar('agua', 1) === 0, 'y no entra más', d.cantidad('agua'));

  const e = new Inventario(200); new Equipo(HERRAMIENTAS, { inventario: e });
  e.reponer([['agua', 5], ['piedra', 2]]);
  s.ok(e.cantidad('agua') === 5 && e.cantidad('piedra') === 2, 'el formato de antes de la ronda 6 también conserva el agua', `${e.cantidad('agua')} · ${e.cantidad('piedra')}`);

  const f = new Inventario(200); const fe = new Equipo(HERRAMIENTAS, { inventario: f });
  f.reponer({ casillas: [{ id: 'odre_cuero', n: 1, usos: 100 }, ...pilas(9)] });
  fe.reponer({ puesto: {}, resto: {} });
  s.ok(f.instancias('odre_cuero').length === 1, 'premisa: el odre del guardado volvió a su casillero');
  s.ok(f.cantidad('agua') === 9, 'un guardado con un odre y nueve de agua conserva las nueve, también después de reponer el equipo', f.cantidad('agua'));
  const fl = f.liquido;
  s.ok(fl?.lleva === 9 && fl?.cabe === 6, 'y el bolso dice que lleva nueve donde caben seis', JSON.stringify(fl ?? null));
  s.ok(f.cantidad('agua') === 9 && f.agregar('agua', 1) === 0, 'no entra más mientras sobre');
  f.quitar('agua', 4);
  const fn = f.agregar('agua', 3);
  s.ok(f.cantidad('agua') >= 5 && fn === 1, 'tomadas cuatro, entra una sola: hasta llegar a seis', `${fn} · ${f.cantidad('agua')}`);

  const partida = fs.readFileSync(path.join(SRC, 'systems', 'Partida.js'), 'utf8');
  s.ok(/const VERSION = 1;/.test(partida), 'VERSION sigue en 1');

  s.feliz = solto;
  s.felizQue = solto ? 'el bolso soltó un odre' : 'el bolso no soltó el odre';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · SE VE
// ═══════════════════════════════════════════════════════════════════════════

async function seVe() {
  const s = seccion(7, 'SE VE — inventario.liquido es { lleva, cabe }, en medidas');
  const a = await armarBolso();
  const la = a.inventario.liquido;
  s.ok(la?.lleva === 0 && la?.cabe === 0, 'sin recipiente: lleva 0, cabe 0', JSON.stringify(la ?? null));

  const b = await armarBolso({ con: ['odre_cuero'] });
  b.inventario.agregar('agua', 3);
  b.inventario.agregar('infusion_canelo', 2);
  const lb = b.inventario.liquido;
  s.ok(lb?.lleva === 5 && lb?.cabe === 6, 'con un odre, tres de agua y dos de infusión: lleva 5, cabe 6 (medidas, no kilos)', JSON.stringify(lb ?? null));
  s.ok(typeof lb?.lleva === 'number' && typeof lb?.cabe === 'number', 'son números');

  const c = await armarBolso({ con: ['odre_cuero', 'odre_cuero'] });
  const lc = c.inventario.liquido;
  s.ok(lc?.lleva === 0 && lc?.cabe === 12, 'con dos odres vacíos: lleva 0, cabe 12', JSON.stringify(lc ?? null));

  const i = b.inventario.instancias('odre_cuero')[0]?.i;
  b.inventario.sacar(i);
  const ld = b.inventario.liquido;
  s.ok(ld?.cabe === 0, 'y sacado el odre, cabe 0 al instante', JSON.stringify(ld ?? null));

  s.feliz = b.inventario.instancias('odre_cuero').length === 0 && Number.isInteger(i);
  s.felizQue = s.feliz ? 'se armó y se vació un bolso con odre' : 'no se pudo armar el bolso con odre';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · NADA MÁS CAMBIA
// ═══════════════════════════════════════════════════════════════════════════

async function nadaMas() {
  const s = seccion(8, 'NADA MÁS CAMBIA — la Q bebe, las equivalencias igual, los recipientes nuevos con icono');
  const lejos = { x: 0, y: 800, z: 0 };
  let bebio = false;

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: lejos, mundo: mundoFalso(), sed: 30, hambre: 90, con: ['odre_cuero'] });
    w.inventario.agregar('agua_segura', 2);
    const antes = w.inventario.cantidad('agua_segura');
    w.rec.comer();
    bebio = antes === 2 && w.inventario.cantidad('agua_segura') === 1;
    s.ok(bebio, 'la Q bebe el agua hervida que lleva el odre', `${antes} → ${w.inventario.cantidad('agua_segura')}`);
    s.ok(w.jugador.sed === 64, 'y la sed sube lo que hidrata', w.jugador.sed);
  });

  await conAzarFijo(0.99, async () => {
    const w = await armar({ en: lejos, mundo: mundoFalso(), sed: 30, hambre: 90 });
    w.inventario.reponer({ casillas: [{ id: 'agua', n: 2 }] });
    w.rec.comer();
    s.ok(w.inventario.cantidad('agua') === 1 && w.jugador.sed === 58, 'con un guardado viejo sin recipiente, la Q bebe igual', `${w.inventario.cantidad('agua')} · ${w.jugador.sed}`);
  });

  const b = await armarBolso({ con: ['odre_cuero'] });
  b.inventario.agregar('agua', 2);
  b.inventario.agregar('agua_segura', 3);
  s.ok(b.inventario.disponiblePara('agua') === 5, 'disponiblePara(agua) cuenta el agua hervida', b.inventario.disponiblePara('agua'));
  const ok = b.inventario.consumirPara('agua', 3);
  s.ok(ok && b.inventario.cantidad('agua') === 0 && b.inventario.cantidad('agua_segura') === 2, 'consumirPara(agua, 3) usa primero la común', `${ok} · ${b.inventario.cantidad('agua')} · ${b.inventario.cantidad('agua_segura')}`);

  const iconos = leer('ui/Iconos.js');
  const nuevos = recipientes().filter((o) => o.id !== 'odre_cuero');
  for (const o of nuevos) {
    s.ok(new RegExp(`(^|[\\s{,'"])${o.id}['"]?\\s*:`, 'm').test(iconos), `${o.id} tiene icono en Iconos.js`);
  }
  if (!nuevos.length) s.nota('no hay recipientes nuevos: el icono no se juzga');

  s.feliz = bebio;
  s.felizQue = bebio ? 'la Q bebió' : 'la Q no bebió';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · SIN REGRESIÓN  ·  10 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(9, 'SIN REGRESIÓN — la ronda 6 y las fases anteriores de la ronda 7');
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
  const s = seccion(10, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { sinRecipiente, elRecipiente, antesDelCuero, beber, hornos, soltarYCargar, seVe, nadaMas, regresion, arranque };
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

console.log(`\n  BANCO R7 · FASE 4 — la vasija   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
