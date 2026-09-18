/**
 * BANCO DE LA FASE 2 (lazo) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes de que exista una
 * línea del agente. Usa los módulos de verdad —`Fauna` (sus métodos, sin mallas),
 * `Peces`, `Pesca`, `Caza`, `Inventario`, `Equipo`, `Tiempo`, `Recoleccion`,
 * `Bolso`, `Hallazgos` y `Partida`— sobre un mundo de mentira con un lago al este
 * de x = 1000.
 *
 *   1. LA FAUNA VIVE DONDE VIVE — `_esAcuatica` con la regla de «todos sus biomas».
 *   2. PONER — el lazo en tierra, la nasa en el agua, y los que no.
 *   3. CAE ALGO, CON LA CUENTA DEL JUEGO — miles de noches contra la fórmula exacta:
 *      P(captura) = 1 − exp(−Σ λ) con λ(t) = T · Σ aptitud · actividad(t), minuto
 *      a minuto; la composición por especie con la supervivencia hasta cada minuto;
 *      mirar una vez o sesenta da lo mismo; sólo lo que el lazo sostiene. La nasa,
 *      con λ = T y la composición de `Pesca._loQuePica`.
 *   4. REVISAR Y LEVANTAR — la liebre rinde `Caza._faena`; lo protegido no rinde
 *      nada y la norma lo dice; el lazo se gasta; vacío vuelve al bolso.
 *   5. LA TECLA — `quePuedoHacer` ofrece la trampa y `actuar` la resuelve; la sed
 *      conserva la tecla.
 *   6. EL BOLSO — el botón «Poner» llama a `trampas.poner`.
 *   7. EN EL MAPA — `Hallazgos.dibujar` pinta cada trampa, con el velo encima y a
 *      poco zoom, con «Tus trampas» en la leyenda, y no delata lo que no se revisó.
 *   8. SE GUARDA — por `Partida`, ida y vuelta, y un guardado viejo entra.
 *   9. SIN REGRESIÓN — la ronda 7 y la fase 1.
 *  10. ARRANQUE — `vite build`.
 *
 * Lo que este banco NO ve —que poner no compile programas, que la trampa se vea en
 * el mundo y en el minimapa— lo mide la mitad navegador.
 *
 * Uso: node .claude/flota/banco-r8-fase2.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
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
const existe = (rel) => fs.existsSync(path.join(SRC, ...rel.split('/')));

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

const HERRAMIENTAS = JSON.parse(leer('data/herramientas.json'));
const FAUNA = JSON.parse(leer('data/fauna.json'));
const CAZA = JSON.parse(leer('data/caza.json'));
const OBJ = new Map(HERRAMIENTAS.objetos.map((o) => [o.id, o]));

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// El entorno: un almacenamiento, un documento mínimo, y un azar sembrado
// ═══════════════════════════════════════════════════════════════════════════

const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: (k) => { almacen.delete(k); },
};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
const elementoMinimo = () => ({
  style: { setProperty() {} }, dataset: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, querySelector: () => elementoMinimo(), querySelectorAll: () => [], setAttribute() {}, remove() {},
});
globalThis.document = {
  addEventListener() {}, removeEventListener() {}, createElement: () => elementoMinimo(), getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], body: elementoMinimo(), head: elementoMinimo(), visibilityState: 'visible', exitPointerLock() {},
};

/** mulberry32: el azar del banco, para que cada corrida sea la misma. */
function sembrado(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
async function conAzar(semilla, fn) {
  const real = Math.random;
  Math.random = sembrado(semilla);
  try { return await fn(); } finally { Math.random = real; }
}

// ═══════════════════════════════════════════════════════════════════════════
// El mundo de mentira: tierra al oeste de x = 1000, lago Nahuel Huapi al este
// ═══════════════════════════════════════════════════════════════════════════

const ORILLA_X = 1000;
const COTA_NAHUEL = 764;
function mundoFalso() {
  const m = {
    tamano: 65536, mitad: 32768,
    meta: { lagos: [{ id: 'nahuel_huapi', cota: COTA_NAHUEL }], centro: { lat: -41.1, lon: -71.52 } },
    esAgua: (x) => x >= ORILLA_X,
    cotaLagoEn: (x) => (x >= ORILLA_X ? COTA_NAHUEL : null),
    cauceEn: () => 0,
    alturaEn: (x) => (x >= ORILLA_X ? COTA_NAHUEL : 850),
    alturaBaseEn: (x) => (x >= ORILLA_X ? COTA_NAHUEL : 850),
    superficieEn: (x) => (x >= ORILLA_X ? COTA_NAHUEL : 850),
    humedadEn: () => 0.5,
    pendienteEn: () => 0.05,
    dentro: () => true,
    aLatLon: () => ({ lat: -41.1, lon: -71.52 }),
    aMundo: () => ({ x: 0, z: 0 }),
    // La distancia al agua como la guarda el mundo: una grilla que se indexa.
    indiceDe: (x) => 100000 + Math.round(x),
    distanciaAgua: new Proxy({}, { get: (t, k) => Math.max(0, ORILLA_X - (Number(k) - 100000)) }),
    orillaCerca(x, z) { for (const d of [0, 12, -12]) if (m.esAgua(x + d, z)) return true; return false; },
  };
  return m;
}

/** Los mismos argumentos con los que `Fauna._reponer` pregunta la aptitud en un punto. */
function argumentosDe(mundo, x, z) {
  const k = mundo.indiceDe(x, z);
  return {
    altitud: mundo.alturaEn(x, z), humedad: mundo.humedadEn(x, z),
    pendiente: mundo.pendienteEn(x, z) * 180 / Math.PI,
    distanciaAgua: k >= 0 ? mundo.distanciaAgua[k] : 9999,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// El armado: los sistemas de verdad, cableados como en main.js
// ═══════════════════════════════════════════════════════════════════════════

/** `Fauna` con sus métodos de verdad y sin sus mallas: sólo hace falta la cuenta. */
async function faunaLiviana(soloIds = null) {
  const { Fauna } = await imp('entities/Fauna.js');
  const f = Object.create(Fauna.prototype);
  f.especies = soloIds ? FAUNA.especies.filter((e) => soloIds.includes(e.id)) : FAUNA.especies;
  f.porId = new Map(f.especies.map((e) => [e.id, e]));
  f.vivos = [];
  f._cacheAcuatica = null;
  f.masCercano = () => null;
  return f;
}

async function armar({ fauna = null, capacidad = 38, fecha = Date.UTC(2025, 1, 12, 23, 0, 0), en = { x: 500, y: 850, z: 0 }, sed = 100 } = {}) {
  const THREE = await import('three');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Caza } = await imp('systems/Caza.js');
  const { Pesca } = await imp('systems/Pesca.js');
  const { Peces } = await imp('entities/Peces.js');
  const { Tiempo } = await imp('world/Tiempo.js');
  const mundo = mundoFalso();
  const avisos = [];
  const hud = {
    aviso: (t, d) => avisos.push(`${t} · ${d ?? ''}`),
    negativa: (v) => avisos.push(`NEGATIVA · ${v?.titulo ?? ''}`),
    mostrarAccion() {},
  };
  const norma = {
    llamadas: [],
    mostrar(v, ctx) { this.llamadas.push({ via: 'mostrar', v, ctx }); return v?.gravedad === 'grave'; },
    anotar(v, ctx) { this.llamadas.push({ via: 'anotar', v, ctx }); },
  };
  const inventario = new Inventario(capacidad);
  const equipo = new Equipo(HERRAMIENTAS, { inventario });
  const saberes = { puntos: 0, ganadosTotales: 0, otorgar(p) { this.puntos += p; }, desbloqueadas: new Set(), porId: new Map() };
  const codice = { identificadas: new Set(), descubiertas: new Set(), lugares: new Set(), registrarFauna() {}, registrarFlora() {} };
  const jugador = { posicion: new THREE.Vector3(en.x, en.y, en.z), giro: 0, sed, hambre: 100, salud: 100, energia: 100, temperatura: 36.6, horasVividas: 0, enAgua: false, vivo: true };
  const tiempo = new Tiempo(-41.1, -71.52, new Date(fecha));
  const limites = { jurisdiccion: () => 'reserva', etiqueta: () => ({ id: 'reserva', nombre: 'reserva' }) };
  const caza = new Caza(CAZA, { jugador, inventario, saberes, codice, hud, tiempo, mundo, limites, equipo });
  const peces = new Peces(mundo, FAUNA);
  const pesca = new Pesca(CAZA, { peces, mundo, jugador, inventario, saberes, codice, hud, tiempo });
  const faunaF = fauna || await faunaLiviana();
  let trampas = null, error = null;
  try {
    const { Trampas } = await imp('systems/Trampas.js');
    trampas = new Trampas({ mundo, fauna: faunaF, peces, pesca, inventario, equipo, caza, norma, hud, tiempo, jugador, objetos: HERRAMIENTAS.objetos });
  } catch (e) { error = e; }
  return { THREE, mundo, hud, avisos, norma, inventario, equipo, saberes, codice, jugador, tiempo, caza, peces, pesca, fauna: faunaF, trampas, error };
}

/** `instancias(id)` devuelve `{ i, cosa }`, no la instancia: el uso está en `cosa`. */
const usosDe = (inv, id) => inv.instancias(id).map(({ cosa }) => cosa.usos);
const conteo = (inv) => {
  const m = new Map();
  for (const c of inv.casillas) if (c && !c.usos && c.usos !== 0) m.set(c.id, (m.get(c.id) || 0) + (c.n || 0));
  return m;
};
const cuanto = (inv, id) => inv.cantidad?.(id) ?? conteo(inv).get(id) ?? 0;

/** Pone `n` trampas del mismo objeto en el mismo lugar, sacándolas del bolso de a una. */
function ponerMuchas(w, objeto, n) {
  let puestas = 0;
  for (let i = 0; i < n; i++) {
    if (!w.equipo.guardar(objeto)) break;
    const r = w.trampas.poner(objeto);
    if (!r?.ok) break;
    puestas++;
  }
  return puestas;
}

/** Hora local decimal de un instante, con el `Tiempo` de verdad. */
async function horaLocal(ms) {
  const { Tiempo } = await imp('world/Tiempo.js');
  const t = new Tiempo(-41.1, -71.52, new Date(ms));
  return t.horaDecimalLocal ?? t.estado().horaDecimal;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA FAUNA VIVE DONDE VIVE
// ═══════════════════════════════════════════════════════════════════════════

const NO_ACUATICAS = ['huemul', 'ciervo_colorado', 'jabali_europeo', 'liebre_europea', 'perro_asilvestrado',
  'tuco_tuco_colonial', 'aguilucho_comun', 'carancho', 'chimango', 'bandurria_austral'];
const ACUATICAS = ['huillin', 'coipo', 'vison_americano', 'maca_plateado', 'bigua', 'martin_pescador_grande',
  'pato_de_los_torrentes', 'cauquen_comun', 'trucha_arcoiris', 'trucha_marron', 'perca_criolla', 'pejerrey_patagonico', 'puyen_grande'];

async function faunaDondeVive() {
  const s = seccion(1, 'LA FAUNA VIVE DONDE VIVE — el mallín no es agua');
  const f = await faunaLiviana();
  const porId = f.porId;
  s.ok([...NO_ACUATICAS, ...ACUATICAS].every((id) => porId.has(id)), 'premisa: las especies de la lista están en fauna.json');
  const malas = NO_ACUATICAS.filter((id) => f._esAcuatica(porId.get(id)));
  s.ok(malas.length === 0, 'las diez especies con el mallín entre ambientes secos no son acuáticas', malas.join(', ') || 'ninguna');
  const perdidas = ACUATICAS.filter((id) => !f._esAcuatica(porId.get(id)));
  s.ok(perdidas.length === 0, 'las de agua siguen siéndolo', perdidas.join(', ') || 'todas');
  // Lo que importa: a 500 m del agua, en tierra a 850 m, la liebre y el ciervo aparecen
  const m = mundoFalso();
  const a = argumentosDe(m, 500, 0);
  const apt = (id) => f._aptitud(porId.get(id), a.altitud, a.humedad, a.pendiente, 'verano', a.distanciaAgua);
  s.ok(apt('liebre_europea') > 0 && apt('ciervo_colorado') > 0 && apt('jabali_europeo') > 0, 'a 500 m del agua, la liebre, el ciervo y el jabalí tienen aptitud', `liebre ${apt('liebre_europea').toFixed(3)} · ciervo ${apt('ciervo_colorado').toFixed(3)} · jabalí ${apt('jabali_europeo').toFixed(3)}`);
  s.ok(apt('huillin') === 0 && apt('maca_plateado') === 0, 'y el huillín y el macá no', `${apt('huillin')} · ${apt('maca_plateado')}`);
  s.feliz = porId.size > 50;
  s.felizQue = `${porId.size} especies`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · PONER
// ═══════════════════════════════════════════════════════════════════════════

async function poner() {
  const s = seccion(2, 'PONER — el lazo en tierra, la nasa en el agua, y los que no');
  s.ok(existe('systems/Trampas.js'), 'src/systems/Trampas.js existe');
  const w = await armar();
  if (!w.trampas) { s.ok(false, 'Trampas se construye con las dependencias del contrato', w.error?.message ?? 'sin módulo'); s.felizQue = 'no hay Trampas'; return s; }
  const T = w.trampas;
  s.ok(Array.isArray(T.lista) && T.lista.length === 0, 'arranca sin nada puesto');
  s.ok(['evaluarPoner', 'poner', 'actualizar', 'cerca', 'revisar', 'levantar', 'serializar', 'reponer'].every((k) => typeof T[k] === 'function'), 'expone evaluarPoner, poner, actualizar, cerca, revisar, levantar, serializar y reponer');

  // Sin la trampa en el bolso
  const sin = T.poner('trampa_lazo');
  s.ok(sin && !sin.ok && typeof sin.motivo === 'string' && sin.motivo.length > 5, 'sin la trampa en el bolso no pone nada y dice por qué', sin?.motivo);
  s.ok(T.lista.length === 0, 'y no aparece nada');

  // El lazo, en tierra
  w.equipo.guardar('trampa_lazo');
  s.ok(w.inventario.instancias('trampa_lazo').length === 1, 'premisa: el lazo entra al bolso como instancia');
  const ev = T.evaluarPoner('trampa_lazo', 500, 0);
  s.ok(ev?.ok === true, 'evaluarPoner: el lazo sirve en tierra', JSON.stringify(ev));
  const r = T.poner('trampa_lazo');
  s.ok(r?.ok === true && r.trampa, 'poner(): el lazo queda puesto', r?.motivo);
  s.ok(w.inventario.instancias('trampa_lazo').length === 0, 'y salió del bolso');
  const t0 = T.lista[0];
  s.ok(!!t0 && t0.objeto === 'trampa_lazo' && Math.hypot(t0.x - 500, t0.z) < 2.5, 'en la lista, con su objeto y donde está el jugador', t0 && `${t0.objeto} en ${t0.x?.toFixed?.(1)}, ${t0.z?.toFixed?.(1)}`);
  s.ok(!!t0 && Number.isFinite(t0.puestaEn) && Math.abs(t0.puestaEn - w.tiempo.fecha.getTime()) < 1000, 'puestaEn es el reloj del mundo', t0?.puestaEn);
  s.ok(!!t0 && Array.isArray(t0.presas) && t0.presas.length === 0, 'y vacía', JSON.stringify(t0?.presas));

  // El lazo, en el agua: no
  w.jugador.posicion.set(1003, 764, 0);
  w.equipo.guardar('trampa_lazo');
  const enAgua = T.poner('trampa_lazo');
  s.ok(enAgua && !enAgua.ok && T.lista.length === 1, 'parado en el agua, el lazo no se pone', enAgua?.motivo);
  s.ok(w.inventario.instancias('trampa_lazo').length === 1, 'y sigue en el bolso');

  // La nasa: en el agua sí, a no más de 3 m del jugador
  w.jugador.posicion.set(998.5, 850, 0);
  w.equipo.guardar('nasa_junco');
  const usos0 = usosDe(w.inventario, 'nasa_junco')[0];
  const n = T.poner('nasa_junco');
  s.ok(n?.ok === true, 'la nasa se pone desde la orilla, a 1,5 m del agua', n?.motivo);
  const tn = T.lista.find((t) => t.objeto === 'nasa_junco');
  s.ok(!!tn && tn.x >= ORILLA_X && Math.hypot(tn.x - 998.5, tn.z) <= 3.01, 'y queda en el agua, a no más de 3 m', tn && `${tn.x.toFixed(2)}, ${tn.z.toFixed(2)}`);
  // La nasa: tierra adentro, no
  w.jugador.posicion.set(900, 850, 0);
  w.equipo.guardar('nasa_junco');
  const lejos = T.poner('nasa_junco');
  s.ok(lejos && !lejos.ok, 'a 100 m del agua la nasa no se pone', lejos?.motivo);
  s.ok(usos0 === OBJ.get('nasa_junco').durabilidad, 'premisa: la nasa nueva tiene su durabilidad entera', usos0);

  // Un objeto que no se pone
  w.equipo.guardar('garrote');
  const g = T.poner('garrote');
  s.ok(g && !g.ok, 'un garrote no se «pone»', g?.motivo);

  s.feliz = r?.ok === true;
  s.felizQue = 'se pudo poner un lazo';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · CAE ALGO, CON LA CUENTA DEL JUEGO
// ═══════════════════════════════════════════════════════════════════════════

const clasesLazo = ['mamifero', 'ave'];
/** Lo que un lazo puede sostener: el porte del objeto, mamíferos y aves de 100 g o más. */
const sostiene = (obj, e) => clasesLazo.includes(e.clase) && (e.pesoKg ?? 0) >= 0.1 && (e.pesoKg ?? Infinity) <= (obj.presaMaxKg ?? Infinity);

/**
 * La distribución esperada de un lazo puesto de `desde` a `hasta`, minuto a minuto:
 * λ_e(t) = T · aptitud_e · actividad_e(hora(t)), la supervivencia S(t) = exp(−∫λ), y
 * P(cae e) = Σ S(t) · (1 − exp(−λ(t)·dt)) · λ_e/λ.
 */
async function esperadoLazo(w, obj, T, x, z, desde, hasta) {
  const f = w.fauna;
  const a = argumentosDe(w.mundo, x, z);
  const estacion = w.tiempo.estado().estacion;
  const elegibles = f.especies.filter((e) => sostiene(obj, e));
  const aptitud = elegibles.map((e) => f._aptitud(e, a.altitud, a.humedad, a.pendiente, estacion, a.distanciaAgua));
  const dt = 60 * 1000;
  let S = 1;
  const p = new Map();
  for (let t = desde; t < hasta; t += dt) {
    const hora = await horaLocal(t + dt / 2);
    const le = elegibles.map((e, i) => T * aptitud[i] * f._actividad(e, hora) / 60);
    const l = le.reduce((u, v) => u + v, 0);
    if (l > 0) {
      const cae = S * (1 - Math.exp(-l));
      le.forEach((v, i) => { if (v > 0) p.set(elegibles[i].id, (p.get(elegibles[i].id) || 0) + cae * v / l); });
      S *= Math.exp(-l);
    }
  }
  return { pCaptura: 1 - S, porEspecie: p, elegibles: elegibles.map((e) => e.id) };
}

async function simularLazos(w, obj, n, desde, hasta, pasos) {
  w.tiempo.fecha = new Date(desde);
  const puestas = ponerMuchas(w, obj.id, n);
  const dt = (hasta - desde) / pasos;
  for (let k = 1; k <= pasos; k++) {
    w.tiempo.fecha = new Date(desde + k * dt);
    w.trampas.actualizar();
  }
  const conPresa = w.trampas.lista.filter((t) => t.presas?.length > 0);
  const porEspecie = new Map();
  let masDeUna = 0;
  for (const t of conPresa) {
    const id = t.presas[0]?.especieId;
    porEspecie.set(id, (porEspecie.get(id) || 0) + 1);
    if (t.presas.length > 1) masDeUna++;
  }
  return { puestas, capturas: conPresa.length, porEspecie, masDeUna };
}

async function captura() {
  const s = seccion(3, 'CAE ALGO — miles de noches contra la fórmula exacta');
  const lazo = OBJ.get('trampa_lazo');
  const T = lazo?.tasaCapturaPorHora;
  s.ok(Number.isFinite(T) && T > 0, 'trampa_lazo declara tasaCapturaPorHora', T);
  const crit = lazo?.criterioTasaCaptura;
  s.ok(typeof crit === 'string' && crit.length > 40, 'y criterioTasaCaptura dice de dónde sale (fuente o «licencia»)', crit ? `${crit.slice(0, 90)}…` : 'no está');
  for (const id of ['nasa_junco', 'red_fibra']) {
    const o = OBJ.get(id);
    s.ok(Number.isFinite(o?.tasaCapturaPorHora) && o.tasaCapturaPorHora > 0 && typeof o?.criterioTasaCaptura === 'string', `${id} declara su tasa y su criterio`, o?.tasaCapturaPorHora);
  }
  if (!existe('systems/Trampas.js') || !(Number.isFinite(T) && T > 0)) { s.felizQue = 'no hay Trampas o no hay tasa'; return s; }

  const N = 6000;
  const noche = { desde: Date.UTC(2025, 1, 12, 23, 0, 0), hasta: Date.UTC(2025, 1, 13, 9, 0, 0) };  // 20:00 a 06:00 hora local
  const dia = { desde: Date.UTC(2025, 1, 13, 11, 0, 0), hasta: Date.UTC(2025, 1, 13, 21, 0, 0) };    // 08:00 a 18:00
  let feliz = false;

  for (const [nombre, franja] of [['la noche', noche], ['el día', dia]]) {
    const wE = await armar({ fecha: franja.desde });
    const esperado = await esperadoLazo(wE, lazo, T, 500, 0, franja.desde, franja.hasta);
    s.nota(`${nombre}: P(captura) esperada ${(esperado.pCaptura * 100).toFixed(1)} % · ${esperado.elegibles.length} especies que el lazo sostiene`);
    for (const [modo, pasos] of [['una sola mirada', 1], ['sesenta miradas', 60]]) {
      const w = await armar({ fecha: franja.desde, capacidad: 38 });
      const r = await conAzar(nombre.length * 1000 + pasos, () => simularLazos(w, lazo, N, franja.desde, franja.hasta, pasos));
      if (r.puestas !== N) { s.ok(false, `${nombre}, ${modo}: se pudieron poner los ${N} lazos`, r.puestas); continue; }
      const p = r.capturas / N;
      const rel = Math.abs(p - esperado.pCaptura) / Math.max(esperado.pCaptura, 1e-9);
      s.ok(rel < 0.15, `${nombre}, ${modo}: la fracción de lazos con presa cae a menos del 15 % de la fórmula`, `${(p * 100).toFixed(1)} % contra ${(esperado.pCaptura * 100).toFixed(1)} %`);
      const ajenas = [...r.porEspecie.keys()].filter((id) => !esperado.elegibles.includes(id));
      s.ok(ajenas.length === 0, `${nombre}, ${modo}: sólo cae lo que el lazo sostiene`, ajenas.join(', ') || 'nada ajeno');
      s.ok(r.masDeUna === 0, `${nombre}, ${modo}: el lazo agarra uno solo`, r.masDeUna);
      if (r.capturas > 200) {
        const total = esperado.pCaptura;
        let peor = 0, peorId = '';
        for (const [id, pe] of esperado.porEspecie) {
          const obs = (r.porEspecie.get(id) || 0) / r.capturas;
          const exp = pe / total;
          const d = Math.abs(obs - exp) * 100;
          if (d > peor) { peor = d; peorId = `${id}: ${(obs * 100).toFixed(1)} contra ${(exp * 100).toFixed(1)}`; }
        }
        s.ok(peor < 3, `${nombre}, ${modo}: la composición por especie cae a menos de 3 puntos de aptitud × actividad`, `peor ${peor.toFixed(2)} pts (${peorId})`);
      }
      if (nombre === 'la noche' && modo === 'sesenta miradas') feliz = r.capturas > 0;
    }
  }

  // La nasa: λ = T constante, junta todo lo que cae, un uso por pez, y la composición de la pesca
  {
    const nasa = OBJ.get('nasa_junco');
    const Tn = nasa?.tasaCapturaPorHora;
    if (Number.isFinite(Tn) && Tn > 0) {
      const w = await armar({ fecha: noche.desde, en: { x: 998.5, y: 850, z: 0 } });
      const M = 2000;
      const puestas = ponerMuchas(w, 'nasa_junco', M);
      w.tiempo.fecha = new Date(noche.hasta);
      await conAzar(77, () => w.trampas.actualizar());
      const horas = (noche.hasta - noche.desde) / 3600000;
      const usos = nasa.durabilidad;
      // E[min(Poisson(μ), usos)]
      const mu = Tn * horas;
      let em = 0, pk = Math.exp(-mu), cola = 1;
      for (let k = 0; k < usos; k++) { em += k * pk; cola -= pk; pk *= mu / (k + 1); }
      em += usos * cola;
      const cuentas = w.trampas.lista.map((t) => t.presas?.length || 0);
      const media = cuentas.reduce((a, b) => a + b, 0) / Math.max(1, cuentas.length);
      s.ok(puestas === M, `premisa: se pusieron las ${M} nasas`, puestas);
      s.ok(Math.abs(media - em) / Math.max(em, 1e-9) < 0.15, 'la nasa junta en diez horas lo que dice λ = T, con el tope de sus usos', `${media.toFixed(3)} peces por nasa contra ${em.toFixed(3)}`);
      // Composición: la de Pesca._loQuePica en esa agua
      const amb = w.peces.ambienteEn(1001, 0);
      const ref = new Map();
      await conAzar(91, () => { for (let i = 0; i < 20000; i++) { const e = w.pesca._loQuePica(amb); ref.set(e.id, (ref.get(e.id) || 0) + 1); } });
      const obs = new Map();
      let tot = 0;
      for (const t of w.trampas.lista) for (const pz of t.presas || []) { obs.set(pz.especieId, (obs.get(pz.especieId) || 0) + 1); tot++; }
      let peor = 0, peorId = '';
      for (const id of new Set([...ref.keys(), ...obs.keys()])) {
        const d = Math.abs((obs.get(id) || 0) / Math.max(tot, 1) - (ref.get(id) || 0) / 20000) * 100;
        if (d > peor) { peor = d; peorId = id; }
      }
      s.ok(tot > 300 && peor < 3, 'lo que cae en la nasa tiene la composición de Pesca._loQuePica en esa agua', `${tot} peces · peor ${peor.toFixed(2)} pts (${peorId})`);
    }
  }

  s.feliz = feliz;
  s.felizQue = 'cayó algo de noche';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · REVISAR Y LEVANTAR
// ═══════════════════════════════════════════════════════════════════════════

const DIA = 24 * 3600000;
/**
 * Espera hasta que la trampa tenga `n` presas, de a un día de mundo y hasta diez
 * años, con el azar sembrado. Con una sola especie alrededor λ puede ser chico, y
 * por la propiedad que pide el contrato el paso no cambia la distribución.
 */
async function esperarPresas(w, t, n = 1, semilla = 5) {
  await conAzar(semilla, () => {
    const f0 = w.tiempo.fecha.getTime();
    for (let k = 1; k <= 3650 && (t?.presas?.length || 0) < n; k++) {
      w.tiempo.fecha = new Date(f0 + k * DIA);
      w.trampas.actualizar();
    }
  });
}

/** Un lazo puesto con una fauna de una sola especie, y tiempo hasta que caiga. */
async function lazoConPresa(especieId) {
  const fauna = await faunaLiviana([especieId]);
  const w = await armar({ fauna, fecha: Date.UTC(2025, 1, 12, 23, 0, 0) });
  if (!w.trampas) return { w, t: null };
  w.equipo.guardar('trampa_lazo');
  w.trampas.poner('trampa_lazo');
  await esperarPresas(w, w.trampas.lista[0]);
  return { w, t: w.trampas.lista[0] };
}

async function revisar() {
  const s = seccion(4, 'REVISAR Y LEVANTAR — la liebre rinde, lo protegido no, el lazo se gasta');
  if (!existe('systems/Trampas.js')) { s.ok(false, 'hay Trampas'); return s; }
  const { Caza } = await imp('systems/Caza.js');
  const liebre = FAUNA.especies.find((e) => e.id === 'liebre_europea');
  const huina = FAUNA.especies.find((e) => e.id === 'gato_huina');
  s.ok(liebre?.protegida === false && huina?.protegida === true, 'premisa: la liebre no está protegida y el gato huiña sí');

  // La liebre
  const { w, t } = await lazoConPresa('liebre_europea');
  s.ok(t?.presas?.[0]?.especieId === 'liebre_europea', 'premisa: con sólo liebres alrededor, el lazo agarra una liebre', JSON.stringify(t?.presas));
  let felizLiebre = false;
  if (t?.presas?.length) {
    const esperado = Caza.prototype._faena.call({}, liebre);
    const antes = new Map(esperado.map((r) => [r.recurso, cuanto(w.inventario, r.recurso)]));
    const r = w.trampas.revisar(t);
    s.ok(r?.ok === true && r.protegida === false, 'revisar(): ok, y no protegida', JSON.stringify({ ok: r?.ok, protegida: r?.protegida, motivo: r?.motivo }));
    const faltan = esperado.filter((x) => cuanto(w.inventario, x.recurso) - antes.get(x.recurso) !== x.cantidad);
    felizLiebre = s.ok(faltan.length === 0, 'la liebre rinde lo mismo que Caza._faena', esperado.map((x) => `${x.recurso} +${cuanto(w.inventario, x.recurso) - antes.get(x.recurso)}/${x.cantidad}`).join(' · '));
    s.ok(!w.trampas.lista.includes(t) && w.trampas.lista.length === 0, 'el lazo se gastó: ya no está puesto');
    s.ok(w.inventario.instancias('trampa_lazo').length === 0, 'y no volvió al bolso');
  }

  // El gato huiña, dos veces
  const h1 = await lazoConPresa('gato_huina');
  s.ok(h1.t?.presas?.[0]?.especieId === 'gato_huina', 'premisa: con sólo gatos huiña alrededor, el lazo agarra uno', JSON.stringify(h1.t?.presas));
  if (h1.t?.presas?.length) {
    const w2 = h1.w;
    const antes = w2.inventario.casillas.map((c) => (c ? `${c.id}:${c.n ?? c.usos}` : '')).join('|');
    const r = w2.trampas.revisar(h1.t);
    const despues = w2.inventario.casillas.map((c) => (c ? `${c.id}:${c.n ?? c.usos}` : '')).join('|');
    s.ok(r?.protegida === true, 'revisar(): protegida', JSON.stringify({ ok: r?.ok, protegida: r?.protegida }));
    s.ok(antes === despues, 'no entra nada al bolso');
    const primera = w2.norma.llamadas.filter((l) => l.via === 'mostrar' && l.v?.gravedad === 'grave');
    s.ok(primera.length === 1, 'la primera vez, la norma se muestra en el panel que espera', `${primera.length} paneles · ${w2.norma.llamadas.length} llamadas`);
    s.ok(primera.length === 1 && /trampa|lazo|trampe/i.test(`${primera[0].v.titulo} ${primera[0].v.detalle}`), 'y habla del trampeo', primera[0] && `${primera[0].v.titulo}`);
    // Un segundo huiña en la misma partida
    w2.equipo.guardar('trampa_lazo');
    w2.trampas.poner('trampa_lazo');
    const t2 = w2.trampas.lista[w2.trampas.lista.length - 1];
    await esperarPresas(w2, t2, 1, 6);
    const n0 = w2.norma.llamadas.length;
    const r2 = t2?.presas?.length ? w2.trampas.revisar(t2) : null;
    const nuevas = w2.norma.llamadas.slice(n0);
    s.ok(r2?.protegida === true, 'premisa: cayó un segundo huiña', JSON.stringify(r2 && { protegida: r2.protegida }));
    // Lo que frena el juego es el panel, y el panel lo abre sólo `mostrar()` con
    // gravedad 'grave'. `anotar()` con la gravedad de verdad es lo correcto: el banco
    // pedía antes que ninguna llamada fuera 'grave', y eso empujaba a anotar como
    // 'leve' algo que no lo es. Lo encontró el agente.
    const panel = nuevas.filter((l) => l.via === 'mostrar' && l.v?.gravedad === 'grave');
    s.ok(nuevas.length >= 1 && panel.length === 0, 'la segunda vez se anota, sin frenar el juego con el panel', nuevas.map((l) => `${l.via}:${l.v?.gravedad}`).join(', ') || 'sin llamadas');
  }

  // Levantar vacío
  {
    const w3 = await armar();
    w3.equipo.guardar('trampa_lazo');
    w3.trampas.poner('trampa_lazo');
    const t3 = w3.trampas.lista[0];
    const r = w3.trampas.levantar(t3);
    s.ok(r?.ok === true && w3.trampas.lista.length === 0, 'levantar() un lazo vacío lo saca del mundo', r?.motivo);
    s.ok(w3.inventario.instancias('trampa_lazo').length === 1 && usosDe(w3.inventario, 'trampa_lazo')[0] === OBJ.get('trampa_lazo').durabilidad, 'y vuelve al bolso entero', usosDe(w3.inventario, 'trampa_lazo').join(','));
    // Con el bolso lleno, no
    const otra = w3.trampas.poner('trampa_lazo');
    const t4 = w3.trampas.lista[0];
    s.ok(otra?.ok === true && !!t4, 'premisa: el lazo levantado se vuelve a poner', otra?.motivo);
    if (t4) {
      let llenos = 0;
      for (let i = 0; i < 200 && w3.equipo.guardar('garrote'); i++) llenos++;
      s.ok(!w3.inventario.casillas.some((c) => !c), 'premisa: el bolso quedó sin casilleros libres', `${llenos} garrotes`);
      const r2 = w3.trampas.levantar(t4);
      s.ok(r2 && !r2.ok && w3.trampas.lista.length === 1, 'con el bolso lleno no se levanta, y dice por qué', r2?.motivo);
    }
  }

  // La nasa: los peces siguen la regla de la caña, y gasta un uso por pez
  {
    const w4 = await armar({ en: { x: 998.5, y: 850, z: 0 }, fecha: Date.UTC(2025, 1, 12, 23, 0, 0) });
    w4.equipo.guardar('nasa_junco');
    w4.trampas.poner('nasa_junco');
    const tn = w4.trampas.lista[0];
    await esperarPresas(w4, tn, 3, 7);
    const peces = tn?.presas?.length || 0;
    s.ok(peces >= 3, 'premisa: la nasa juntó al menos tres peces', peces);
    if (peces) {
      const exoticos = tn.presas.filter((pz) => FAUNA.especies.find((e) => e.id === pz.especieId)?.nativa === false).length;
      const pescado0 = cuanto(w4.inventario, 'pescado');
      const r = w4.trampas.revisar(tn);
      const sigue = w4.trampas.lista.find((x) => x === tn || x.id === tn.id);
      s.ok(r?.ok === true, 'revisar() una nasa: ok', r?.motivo);
      s.ok(!!sigue && (sigue.presas?.length || 0) === 0, 'la nasa sigue puesta y queda vacía');
      const usos = sigue?.usos ?? sigue?.instancia?.usos ?? null;
      s.ok(usos === OBJ.get('nasa_junco').durabilidad - peces, 'y gastó un uso por pez', `${usos} de ${OBJ.get('nasa_junco').durabilidad} con ${peces} peces`);
      s.ok(exoticos === 0 ? cuanto(w4.inventario, 'pescado') === pescado0 : cuanto(w4.inventario, 'pescado') >= pescado0, 'los nativos se devuelven: sin exóticos no entra pescado', `${exoticos} exóticos · pescado ${pescado0} → ${cuanto(w4.inventario, 'pescado')}`);
    }
  }

  s.feliz = felizLiebre;
  s.felizQue = 'la liebre rindió';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LA TECLA
// ═══════════════════════════════════════════════════════════════════════════

async function recoleccionCon(w) {
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const { Mineria } = await imp('systems/Mineria.js');
  const MINERIA = JSON.parse(leer('data/mineria.json'));
  const limites = { jurisdiccion: () => 'reserva', etiqueta: () => ({ id: 'reserva', nombre: 'reserva' }) };
  const mineria = new Mineria(MINERIA, { mundo: w.mundo, limites, jugador: w.jugador, inventario: w.inventario, saberes: w.saberes, hud: w.hud });
  const rec = new Recoleccion({ mundo: w.mundo, jugador: w.jugador, vegetacion: { masCercana: () => null }, sotobosque: { lotes: [] }, fauna: { masCercano: () => null }, inventario: w.inventario, saberes: w.saberes, codice: w.codice, hud: w.hud });
  rec.caza = w.caza; rec.mineria = mineria; rec.pesca = null; rec.equipo = w.equipo; rec.herramientas = HERRAMIENTAS;
  rec.trampas = w.trampas;
  return rec;
}

async function tecla() {
  const s = seccion(5, 'LA TECLA — la trampa se ofrece y se resuelve; la sed conserva la tecla');
  if (!existe('systems/Trampas.js')) { s.ok(false, 'hay Trampas'); return s; }
  const w = await armar();
  const rec = await recoleccionCon(w);
  const lejos = rec.quePuedoHacer(Date.now());
  s.ok(!lejos || lejos.tipo !== 'trampa', 'premisa: sin trampas cerca no se ofrece ninguna', lejos?.tipo);
  w.equipo.guardar('trampa_lazo');
  w.trampas.poner('trampa_lazo');
  w.jugador.posicion.set(501.5, 850, 0);
  const a = rec.quePuedoHacer(Date.now());
  s.ok(a?.tipo === 'trampa', 'a 1,5 m de un lazo, la tecla ofrece la trampa', a && `${a.tipo}: ${a.etiqueta}`);
  s.ok(/vac[ií]a/i.test(a?.etiqueta || ''), 'y dice que está vacía', a?.etiqueta);
  w.jugador.posicion.set(504, 850, 0);
  const b = rec.quePuedoHacer(Date.now());
  s.ok(!b || b.tipo !== 'trampa', 'a 4 m ya no', b?.tipo);
  // actuar(): levanta la vacía
  w.jugador.posicion.set(501.5, 850, 0);
  const r = rec.actuar(Date.now());
  s.ok(w.trampas.lista.length === 0 && w.inventario.instancias('trampa_lazo').length === 1, 'actuar() sobre un lazo vacío lo levanta', JSON.stringify(r)?.slice(0, 80));
  // Con presa, la etiqueta la nombra
  const { w: w2, t } = await lazoConPresa('liebre_europea');
  if (t?.presas?.length) {
    const rec2 = await recoleccionCon(w2);
    w2.jugador.posicion.set(t.x + 1, 850, t.z);
    const c = rec2.quePuedoHacer(Date.now());
    s.ok(c?.tipo === 'trampa' && /liebre/i.test(c.etiqueta || ''), 'con presa, la etiqueta dice qué cayó', c?.etiqueta);
    rec2.actuar(Date.now());
    s.ok(w2.trampas.lista.length === 0 && cuanto(w2.inventario, 'carne') >= 1, 'y actuar() la revisa', `carne ${cuanto(w2.inventario, 'carne')}`);
  }
  // La sed conserva la tecla: lazo al borde del agua, con sed
  {
    const w3 = await armar({ en: { x: 998.5, y: 850, z: 0 }, sed: 15 });
    const rec3 = await recoleccionCon(w3);
    w3.equipo.guardar('trampa_lazo');
    const p = w3.trampas.poner('trampa_lazo');
    s.ok(p?.ok === true, 'premisa: un lazo en la orilla, en tierra', p?.motivo);
    const d = rec3.quePuedoHacer(Date.now());
    s.ok(d?.tipo === 'beber', 'con sed y el agua a mano, beber le gana a la trampa', d?.tipo);
  }
  s.feliz = a?.tipo === 'trampa';
  s.felizQue = 'la tecla ofreció la trampa';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · EL BOLSO
// ═══════════════════════════════════════════════════════════════════════════

async function bolso() {
  const s = seccion(6, 'EL BOLSO — «Poner» llama a trampas.poner');
  if (!existe('systems/Trampas.js')) { s.ok(false, 'hay Trampas'); return s; }
  const { Bolso } = await imp('ui/Bolso.js');
  let feliz = false;
  for (const objeto of ['trampa_lazo', 'nasa_junco', 'red_fibra']) {
    const w = await armar();
    w.equipo.guardar(objeto);
    const i = w.inventario.casillas.findIndex((c) => c?.id === objeto);
    const llamadas = [];
    const espia = { poner: (...a) => { llamadas.push(a); return { ok: true }; }, lista: [] };
    const b = Object.create(Bolso.prototype);
    Object.assign(b, { inventario: w.inventario, equipo: w.equipo, hud: w.hud, jugador: w.jugador, tiempo: w.tiempo, trampas: espia, abierto: true, _tomada: null, _mirando: i, _hojaPuesta: true });
    let html = '';
    try { html = b._detalleHTML(); } catch (e) { html = `ERROR ${e.message}`; }
    const m = /<button([^>]*)>\s*Poner\s*<\/button>/i.exec(html);
    s.ok(!!m, `${objeto}: el detalle del bolso tiene el botón «Poner»`, m ? m[1].trim() : html.slice(0, 120));
    if (!m) continue;
    const dataset = {};
    for (const [, k, v] of m[1].matchAll(/data-([a-z-]+)="([^"]*)"/g)) dataset[k.replace(/-([a-z])/g, (x, c) => c.toUpperCase())] = v;
    // El clic, por el oyente de verdad
    const oyentes = {};
    const elemento = () => ({ style: {}, dataset: {}, innerHTML: '', textContent: '', addEventListener: (tp, fn) => { oyentes[tp] = oyentes[tp] || fn; }, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {} } });
    const docReal = globalThis.document;
    globalThis.document = { ...docReal, createElement: elemento, getElementById: () => null, body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }, head: { appendChild() {} } };
    try {
      b._crear();
      b.pintar = () => {};
      b._refrescarDetalle = () => {};
      oyentes.click?.({ target: { closest: (sel) => (/data-cs/.test(sel) ? null : { dataset }) }, preventDefault() {} });
    } catch (e) { s.nota(`${objeto}: el clic tiró ${e.message}`); } finally { globalThis.document = docReal; }
    const bien = llamadas.length === 1 && JSON.stringify(llamadas[0]).includes(objeto);
    s.ok(bien, `${objeto}: el clic en «Poner» llama a trampas.poner con esa trampa`, JSON.stringify(llamadas).slice(0, 120));
    if (objeto === 'trampa_lazo') feliz = bien;
  }
  // Una herramienta que no se pone no tiene el botón
  {
    // Al bolso a mano: `equipo.guardar` la pondría en la mano, que está libre.
    const w = await armar();
    w.inventario.meter({ id: 'hacha_piedra', n: 1, usos: OBJ.get('hacha_piedra').durabilidad });
    const i = w.inventario.casillas.findIndex((c) => c?.id === 'hacha_piedra');
    const b = Object.create(Bolso.prototype);
    Object.assign(b, { inventario: w.inventario, equipo: w.equipo, hud: w.hud, jugador: w.jugador, tiempo: w.tiempo, trampas: { poner() {} }, abierto: true, _tomada: null, _mirando: i, _hojaPuesta: true });
    const html = b._detalleHTML();
    s.ok(i >= 0 && !/>\s*Poner\s*</.test(html), 'el hacha no tiene «Poner»', i);
  }
  s.feliz = feliz;
  s.felizQue = 'el botón del lazo llamó a poner';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · EN EL MAPA
// ═══════════════════════════════════════════════════════════════════════════

/** Un contexto 2D que anota puntos transformados y textos (lo justo para Hallazgos). */
function ctxQueAnota() {
  const reg = { formas: [], textos: [] };
  let m = [1, 0, 0, 1, 0, 0];
  const pila = [];
  let camino = [];
  const T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mult = ([A, B, C, D, E, F]) => { const [a, b, c, d, e, f] = m; m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f]; };
  const props = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif', textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt', globalAlpha: 1 };
  const met = {
    reg,
    save() { pila.push({ m: [...m], p: { ...props } }); }, restore() { const s = pila.pop(); if (s) { m = s.m; Object.assign(props, s.p); } },
    translate(x, y) { mult([1, 0, 0, 1, x, y]); }, rotate(r) { const c = Math.cos(r), s = Math.sin(r); mult([c, s, -s, c, 0, 0]); }, scale(x, y = x) { mult([x, 0, 0, y, 0, 0]); },
    setTransform(a, b, c, d, e, f) { m = a === undefined ? [1, 0, 0, 1, 0, 0] : [a, b, c, d, e, f]; }, resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    beginPath() { camino = []; }, closePath() {},
    moveTo(x, y) { camino.push(T(x, y)); }, lineTo(x, y) { camino.push(T(x, y)); },
    arc(x, y, r) { camino.push(T(x - r, y), T(x + r, y), T(x, y - r), T(x, y + r)); }, ellipse(x, y, rx, ry) { camino.push(T(x - rx, y), T(x + rx, y), T(x, y - ry), T(x, y + ry)); },
    quadraticCurveTo(a, b, x, y) { camino.push(T(a, b), T(x, y)); }, bezierCurveTo(a, b, c, d, x, y) { camino.push(T(a, b), T(c, d), T(x, y)); },
    rect(x, y, w, h) { camino.push(T(x, y), T(x + w, y + h)); },
    fill() { reg.formas.push({ tipo: 'fill', pts: camino.map((p) => [...p]), estilo: props.fillStyle }); },
    stroke() { reg.formas.push({ tipo: 'stroke', pts: camino.map((p) => [...p]), estilo: props.strokeStyle, ancho: props.lineWidth }); },
    fillRect(x, y, w, h) { reg.formas.push({ tipo: 'fill', pts: [T(x, y), T(x + w, y + h)], estilo: props.fillStyle }); }, strokeRect() {}, clearRect() {},
    fillText(t, x, y) { reg.textos.push({ t: String(t), p: T(x, y) }); }, strokeText() {}, measureText: (t) => ({ width: String(t).length * 5.5 }),
    drawImage() {}, setLineDash() {}, clip() {},
  };
  // Como en un navegador, se le puede reemplazar un método y borrar el reemplazo:
  // el falsador lo usa, y sin esto su parche no plantaba nada.
  const sobre = {};
  return new Proxy(props, {
    get: (t, k) => (k in sobre ? sobre[k] : k in met ? met[k] : k in t ? t[k] : () => {}),
    set: (t, k, v) => { if (k in met) sobre[k] = v; else t[k] = v; return true; },
    deleteProperty: (t, k) => { if (k in sobre) delete sobre[k]; else delete t[k]; return true; },
  });
}

async function mapa() {
  const s = seccion(7, 'EN EL MAPA — cada trampa con su glifo, bajo el velo y a cualquier zoom');
  if (!existe('systems/Trampas.js')) { s.ok(false, 'hay Trampas'); return s; }
  const { Hallazgos } = await imp('systems/Hallazgos.js');
  const w = await armar();
  w.equipo.guardar('trampa_lazo'); w.trampas.poner('trampa_lazo');            // en (500, 0)
  w.jugador.posicion.set(998.5, 850, 0);
  w.equipo.guardar('nasa_junco'); w.trampas.poner('nasa_junco');              // en el agua, ~1000
  s.ok(w.trampas.lista.length === 2, 'premisa: un lazo y una nasa puestos', w.trampas.lista.map((t) => t.objeto).join(', '));
  const h = Object.create(Hallazgos.prototype);
  h.celdas = new Map(); h.lado = 256;
  h.trampas = w.trampas;
  const sinConocer = { conocimientoEn: () => 0, celdas: 256, metrosPorCelda: 256 };
  const dibujarA = (mpp, cx = 750) => {
    const c = ctxQueAnota();
    const proy = (x, z) => ({ px: 320 + (x - cx) / mpp, py: 320 + z / mpp });
    h.dibujar(c, proy, { mpp, lado: 640, construccion: { obras: [] }, exploracion: sinConocer });
    return { c, proy };
  };
  const cerca = (c, p, r) => c.reg.formas.filter((f) => f.pts.length && f.pts.every((q) => Math.hypot(q[0] - p.px, q[1] - p.py) < r));
  let feliz = false;
  for (const mpp of [102.4, 8, 2]) {
    const { c, proy } = dibujarA(mpp, mpp > 50 ? 750 : 750);
    for (const t of w.trampas.lista) {
      const p = proy(t.x, t.z);
      const f = cerca(c, p, 9);
      s.ok(f.length > 0, `a ${mpp} m/px y con el velo tapando todo, ${t.objeto} tiene su marca`, f.length);
      if (f.length && mpp === 8) feliz = true;
    }
    s.ok(c.reg.textos.some((x) => /tus trampas/i.test(x.t)), `a ${mpp} m/px la leyenda dice «Tus trampas»`, c.reg.textos.map((x) => x.t).join(' | ').slice(0, 100));
  }
  // Glifo propio por tipo: la forma del lazo no es la de la nasa
  {
    const { c, proy } = dibujarA(8);
    const forma = (t) => { const p = proy(t.x, t.z); return cerca(c, p, 9).map((f) => `${f.tipo}:${f.pts.map((q) => `${(q[0] - p.px).toFixed(1)},${(q[1] - p.py).toFixed(1)}`).join(';')}`).join('|'); };
    const [a, b] = w.trampas.lista;
    s.ok(forma(a) && forma(b) && forma(a) !== forma(b), 'el lazo y la nasa tienen glifos distintos');
  }
  // Una presa sin revisar no se delata
  {
    const { w: w2, t } = await lazoConPresa('liebre_europea');
    const wv = await armar(); wv.equipo.guardar('trampa_lazo'); wv.trampas.poner('trampa_lazo');
    if (t?.presas?.length) {
      const dib = (tr) => {
        const hh = Object.create(Hallazgos.prototype); hh.celdas = new Map(); hh.lado = 256; hh.trampas = tr;
        const c = ctxQueAnota();
        const tt = tr.lista[0];
        hh.dibujar(c, (x, z) => ({ px: 320 + (x - tt.x) / 8, py: 320 + (z - tt.z) / 8 }), { mpp: 8, lado: 640, construccion: { obras: [] }, exploracion: sinConocer });
        return c.reg.formas.filter((f) => f.pts.every((q) => Math.hypot(q[0] - 320, q[1] - 320) < 9)).map((f) => `${f.tipo}:${f.estilo}:${f.pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(';')}`).join('|');
      };
      s.ok(dib(w2.trampas) === dib(wv.trampas), 'un lazo con una presa sin revisar se dibuja igual que uno vacío');
    }
  }
  s.feliz = feliz;
  s.felizQue = 'se dibujaron las marcas a 8 m/px';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · SE GUARDA
// ═══════════════════════════════════════════════════════════════════════════

async function guardar() {
  const s = seccion(8, 'SE GUARDA — por Partida, ida y vuelta, y un guardado viejo entra');
  if (!existe('systems/Trampas.js')) { s.ok(false, 'hay Trampas'); return s; }
  s.ok(/const\s+VERSION\s*=\s*1\s*;/.test(leer('systems/Partida.js')), 'VERSION sigue en 1');
  const { Partida } = await imp('systems/Partida.js');
  const depsDe = (w, extra = {}) => ({
    jugador: w.jugador, inventario: w.inventario, equipo: w.equipo,
    saberes: { puntos: 0, ganadosTotales: 0, desbloqueadas: new Set() },
    codice: { descubiertas: new Set(), identificadas: new Set(), lugares: new Set() },
    construccion: { obras: [], catalogo: [] }, fundicion: { hornos: [] },
    tiempo: w.tiempo, mundo: {}, hud: { aviso() {} }, exploracion: { guardar() {} }, recoleccion: {},
    obras: { agregar() {} }, hornos: { agregar() {} }, ...extra,
  });
  // Un lazo con presa sin revisar y una nasa con un uso gastado
  const { w, t } = await lazoConPresa('liebre_europea');
  w.jugador.posicion.set(998.5, 850, 0);
  w.equipo.guardar('nasa_junco'); w.trampas.poner('nasa_junco');
  const antes = w.trampas.lista.map((x) => ({ objeto: x.objeto, x: +x.x.toFixed(3), z: +x.z.toFixed(3), puestaEn: x.puestaEn, presas: (x.presas || []).map((p) => p.especieId) }));
  s.ok(t?.presas?.length === 1 && antes.length === 2, 'premisa: un lazo con una liebre adentro y una nasa', JSON.stringify(antes).slice(0, 160));
  almacen.clear();
  const p = new Partida(depsDe(w, { trampas: w.trampas }));
  p.guardar();
  const crudo = localStorage.getItem('survibar.partida.v1');
  s.ok(!!crudo, 'premisa: guardar() escribió la partida');
  s.ok(!!crudo && JSON.parse(crudo).version === 1, 'con version 1');
  // Otra partida, otras trampas
  const w2 = await armar();
  const p2 = new Partida(depsDe(w2, { trampas: w2.trampas }));
  let cargo = false, tiro = null;
  try { cargo = p2.cargar(); } catch (e) { tiro = e.message; }
  s.ok(cargo === true && tiro === null, 'la partida carga', tiro || cargo);
  const despues = w2.trampas.lista.map((x) => ({ objeto: x.objeto, x: +x.x.toFixed(3), z: +x.z.toFixed(3), puestaEn: x.puestaEn, presas: (x.presas || []).map((q) => q.especieId) }));
  const feliz = s.ok(JSON.stringify(despues) === JSON.stringify(antes), 'las trampas vuelven con su lugar, su objeto, su hora y lo que tenían adentro', JSON.stringify(despues).slice(0, 160));
  // La revisión después de cargar sigue dando la liebre
  const t2 = w2.trampas.lista.find((x) => x.objeto === 'trampa_lazo');
  const r = t2 ? w2.trampas.revisar(t2) : null;
  s.ok(r?.ok === true && cuanto(w2.inventario, 'carne') >= 1, 'y la liebre de antes de cerrar se revisa después de abrir', `carne ${cuanto(w2.inventario, 'carne')}`);
  // Un guardado viejo, sin trampas
  // Se borra el campo que las lleve, se llame como se llame: las dos trampas están
  // puestas, así que ningún otro campo nombra al lazo ni a la nasa.
  const viejo = JSON.parse(crudo);
  for (const k of Object.keys(viejo)) {
    const v = JSON.stringify(viejo[k]);
    if (v && (v.includes('trampa_lazo') || v.includes('nasa_junco'))) delete viejo[k];
  }
  s.ok(!JSON.stringify(viejo).includes('trampa_lazo') && !JSON.stringify(viejo).includes('nasa_junco'), 'premisa: al guardado viejo se le sacó todo rastro de las trampas');
  localStorage.setItem('survibar.partida.v1', JSON.stringify(viejo));
  const w3 = await armar();
  const p3 = new Partida(depsDe(w3, { trampas: w3.trampas }));
  let cargo3 = false; tiro = null;
  try { cargo3 = p3.cargar(); } catch (e) { tiro = e.message; }
  s.ok(cargo3 === true && tiro === null && w3.trampas.lista.length === 0, 'una partida vieja sin trampas carga, sin trampas', tiro || `${cargo3} · ${w3.trampas.lista.length}`);
  // Sin trampas en las dependencias, no tira
  localStorage.setItem('survibar.partida.v1', crudo);
  const w4 = await armar();
  const p4 = new Partida(depsDe(w4));
  let cargo4 = false; tiro = null;
  try { cargo4 = p4.cargar(); p4.guardar(); } catch (e) { tiro = e.message; }
  s.ok(cargo4 === true && tiro === null, 'sin trampas en las dependencias, cargar y guardar no tiran', tiro || cargo4);
  s.feliz = feliz;
  s.felizQue = 'las trampas volvieron';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · SIN REGRESIÓN  ·  10 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(9, 'SIN REGRESIÓN — la ronda 7 y la fase 1');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'],
  ];
  let corrio = 0;
  for (const [archivo, esperado] of otros) {
    const env = { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' };
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], { cwd: RAIZ, encoding: 'utf8', timeout: 900000, env });
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

const SECCIONES = { faunaDondeVive, poner, captura, revisar, tecla, bolso, mapa, guardar, regresion, arranque };
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
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 2 — lo que se deja puesto y se vuelve a buscar   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
