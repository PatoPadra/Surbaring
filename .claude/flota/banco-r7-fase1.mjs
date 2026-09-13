/**
 * BANCO DE LA FASE 1 (tecla) — ronda 7.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga los módulos de verdad: `Entrada`, `Recoleccion`,
 * `Inventario`, `Equipo`, `Mineria`, `Caza`, `HUD` y `Jugador`.
 *
 *   1. ANDAR SOLO — Z prende y apaga, lo que lo corta lo corta, lo que no lo
 *      corta no lo corta, se ve, y `Jugador` camina de verdad sin tocar nada.
 *   2. LA C Y LOS CONTROLES — ninguna tecla registrada pisa un movimiento, la
 *      calidad está en F2, y la tabla de controles nombra todo lo registrado.
 *   3. EL CARTEL DICE QUÉ DA — dieciséis casos, cada uno barrido con cincuenta
 *      valores del azar: lo que el paréntesis promete es lo que la tecla da.
 *   4. LA TECLA EN SU LUGAR — `mostrarAccion` marca E y R donde van, y no la
 *      primera R que aparezca.
 *   5. SIN REGRESIÓN — r5-fase1, r6-fase1, r6-fase2 y r6-fase3 siguen verdes.
 *   6. ARRANQUE — `vite build`.
 *
 * Cómo se juzga el cartel, que es lo único con vueltas. `Math.random` se fija en
 * un valor constante por corrida y se barren cincuenta, de 0 a 0,98. Con eso cada
 * «sale al 16 %» sale en las corridas bajas y no en las altas, cada «de 2 a 4» da
 * 2 abajo y 4 arriba, y cada sorteo de fuente recorre todas las fuentes. Después
 * se compara el total de cada recurso —y no renglón por renglón—, porque el maqui
 * da 3 frutos fijos más 2 a 4 al azar, y decir «5–7» o «3 × frutos · 2–4 × frutos»
 * son dos maneras honestas de lo mismo.
 *
 * Lo que este banco NO mide es si el cartel se lee bien a 0,78 rem en la
 * pantalla. Eso es del ojo.
 *
 * Uso: node .claude/flota/banco-r7-fase1.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const leer = (rel) => fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');

/** Un solo import por módulo: dos instancias de `Recursos` serían dos catálogos. */
const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

const HERRAMIENTAS = JSON.parse(leer('data/herramientas.json'));
const CAZA = JSON.parse(leer('data/caza.json'));
const FLORA = JSON.parse(leer('data/flora.json'));

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// Un navegador de mentira, lo justo para `Entrada`
// ═══════════════════════════════════════════════════════════════════════════

function claseLista() {
  const set = new Set();
  return {
    set,
    add: (...n) => n.forEach((x) => set.add(x)),
    remove: (...n) => n.forEach((x) => set.delete(x)),
    contains: (n) => set.has(n),
    toggle(n, forzar) {
      const poner = forzar === undefined ? !set.has(n) : !!forzar;
      if (poner) set.add(n); else set.delete(n);
      return poner;
    },
  };
}

/** Instala `window`, `document` y `Element` de mentira y devuelve cómo dispararles eventos. */
function navegadorFalso() {
  const ventana = new Map();
  const doc = new Map();
  const escuchar = (mapa) => (tipo, fn) => { if (!mapa.has(tipo)) mapa.set(tipo, []); mapa.get(tipo).push(fn); };
  globalThis.Element = class Element {};
  const cuerpo = { tagName: 'BODY', isContentEditable: false, classList: claseLista() };
  globalThis.addEventListener = escuchar(ventana);
  globalThis.removeEventListener = () => {};
  globalThis.document = {
    addEventListener: escuchar(doc),
    removeEventListener: () => {},
    pointerLockElement: null,
    activeElement: cuerpo,
    body: cuerpo,
    exitPointerLock() {},
  };
  const lienzo = { addEventListener() {}, requestPointerLock() {} };
  const disparar = (mapa, tipo, ev) => (mapa.get(tipo) || []).forEach((fn) => fn(ev));
  const evento = (code, extra = {}) => ({ code, key: code, repeat: false, target: globalThis, preventDefault() {}, stopPropagation() {}, ...extra });
  return {
    lienzo,
    cuerpo,
    bajar: (code, extra) => disparar(ventana, 'keydown', evento(code, extra)),
    subir: (code, extra) => disparar(ventana, 'keyup', evento(code, extra)),
    tocar(code, extra) { this.bajar(code, extra); this.subir(code, extra); },
    bloquear() { globalThis.document.pointerLockElement = lienzo; disparar(doc, 'pointerlockchange', {}); },
    soltar() { globalThis.document.pointerLockElement = null; disparar(doc, 'pointerlockchange', {}); },
    desenfocar: () => disparar(ventana, 'blur', {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · ANDAR SOLO
// ═══════════════════════════════════════════════════════════════════════════

async function andarSolo() {
  const s = seccion(1, 'ANDAR SOLO — Z, lo que lo corta, lo que no, y Jugador camina');
  const { Entrada } = await imp('engine/Entrada.js');

  const nueva = () => {
    const nav = navegadorFalso();
    const e = new Entrada(nav.lienzo);
    return { nav, e };
  };
  const clase = (nav) => nav.cuerpo.classList.contains('auto-andar');

  // Premisas: el navegador falso mueve a la Entrada de verdad
  {
    const { nav, e } = nueva();
    nav.bajar('KeyW');
    const conW = e.adelante;
    nav.subir('KeyW');
    s.ok(conW === 1 && e.adelante === 0, 'premisa: W empuja y soltarla frena', `${conW} → ${e.adelante}`);
    nav.bloquear();
    s.ok(e.bloqueado === true, 'premisa: el puntero se bloquea con el evento', e.bloqueado);
  }

  const tieneProp = (() => {
    const { e } = nueva();
    return 'autoAndar' in e;
  })();
  s.ok(tieneProp, 'Entrada tiene la propiedad autoAndar');

  // Z prende y apaga, y la clase lo acompaña
  let prendio = false;
  {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    prendio = e.autoAndar === true && e.adelante === 1;
    s.ok(prendio, 'Z prende: autoAndar y adelante = 1 sin ninguna tecla apretada', `${e.autoAndar} · ${e.adelante}`);
    s.ok(clase(nav), 'prendido, el cuerpo del documento lleva la clase auto-andar');
    nav.tocar('KeyZ');
    s.ok(e.autoAndar === false && e.adelante === 0, 'Z otra vez apaga', `${e.autoAndar} · ${e.adelante}`);
    s.ok(!clase(nav), 'apagado, la clase auto-andar se va');
  }

  // Lo que NO lo corta
  for (const code of ['KeyA', 'KeyD', 'ShiftLeft', 'Space', 'ControlLeft', 'KeyC']) {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    nav.bajar(code);
    const durante = e.adelante;
    nav.subir(code);
    s.ok(e.autoAndar === true && durante === 1 && e.adelante === 1, `${code} no corta el andar solo`, `durante ${durante} · después ${e.autoAndar}/${e.adelante}`);
  }
  {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    nav.bajar('KeyA');
    s.ok(e.lateral === -1 && e.adelante === 1, 'andando solo se dobla: lateral y adelante a la vez', `${e.lateral} · ${e.adelante}`);
    nav.subir('KeyA');
  }

  // Lo que SÍ lo corta
  for (const [code, mientras] of [['KeyW', 1], ['ArrowUp', 1], ['KeyS', -1], ['ArrowDown', -1]]) {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    nav.bajar(code);
    const apagado = e.autoAndar === false;
    const durante = e.adelante;
    nav.subir(code);
    s.ok(apagado && durante === mientras && e.adelante === 0, `${code} corta el andar solo, y manda mientras se aprieta`, `autoAndar ${e.autoAndar} · durante ${durante} · después ${e.adelante}`);
  }
  {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    nav.soltar();
    s.ok(e.autoAndar === false && e.adelante === 0, 'soltar el puntero (abrir un panel, morir) lo corta', `${e.autoAndar} · ${e.adelante}`);
    s.ok(!clase(nav), 'y al cortarse así también se va la clase');
  }
  {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.tocar('KeyZ');
    nav.desenfocar();
    s.ok(e.autoAndar === false && e.adelante === 0, 'perder el foco de la ventana lo corta', `${e.autoAndar} · ${e.adelante}`);
  }

  // Cuándo Z no hace nada
  {
    const { nav, e } = nueva();
    nav.tocar('KeyZ');
    s.ok(e.autoAndar === false && e.adelante === 0, 'con el puntero suelto (un panel abierto), Z no prende', `${e.autoAndar} · ${e.adelante}`);
  }
  {
    const { nav, e } = nueva();
    nav.bloquear();
    const campo = Object.assign(new globalThis.Element(), { tagName: 'INPUT', isContentEditable: false });
    nav.tocar('KeyZ', { target: campo });
    s.ok(e.autoAndar === false, 'escribiendo en un campo, Z no prende', e.autoAndar);
  }
  {
    const { nav, e } = nueva();
    nav.bloquear();
    nav.bajar('KeyZ');
    nav.bajar('KeyZ', { repeat: true });
    nav.bajar('KeyZ', { repeat: true });
    nav.subir('KeyZ');
    s.ok(e.autoAndar === true, 'dejar Z apretada no la prende y apaga por repetición', e.autoAndar);
  }

  // La propiedad se escribe desde afuera, y la clase la sigue
  {
    const { nav, e } = nueva();
    nav.bloquear();
    try { e.autoAndar = true; } catch { /* sigue */ }
    const a = e.autoAndar === true && e.adelante === 1 && clase(nav);
    try { e.autoAndar = false; } catch { /* sigue */ }
    const b = e.autoAndar === false && e.adelante === 0 && !clase(nav);
    s.ok(a && b, 'autoAndar se puede escribir desde afuera, y la clase lo acompaña', `${a} · ${b}`);
  }

  // Se ve: el HUD tiene con qué mostrarlo
  s.ok(/auto-andar/.test(leer('ui/HUD.js')), 'HUD.js dibuja algo para la clase auto-andar');

  // Y lo que importa: el Jugador de verdad camina sin que nadie toque una tecla
  let camina = false;
  try {
    const THREE = await import('three');
    const { Jugador } = await imp('entities/Jugador.js');
    const n = new THREE.Vector3(0, 1, 0);
    const mundo = {
      mitad: 32768,
      alturaEn: () => 800, alturaBaseEn: () => 800, superficieEn: () => 800,
      normalEn: (x, z, out = new THREE.Vector3()) => out.copy(n),
      pendienteEn: () => 0, cotaLagoEn: () => null, esAgua: () => false,
      humedadEn: () => 0.5, aLatLon: () => ({ lat: -41, lon: -71 }),
    };
    const P = 1 / 60;
    const recorrido = (preparar) => {
      const { nav, e } = nueva();
      const camara = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1e5);
      const j = new Jugador(mundo, camara);
      j.posicion.set(0, 800, 0);
      j.enSuelo = true;
      j.actualizar(P, e);
      nav.bloquear();
      preparar(nav, e);
      const x0 = j.posicion.x, z0 = j.posicion.z;
      for (let i = 0; i < 180; i++) j.actualizar(P, e);
      const dx = j.posicion.x - x0, dz = j.posicion.z - z0;
      const g = j.giro ?? 0;
      const frente = (-Math.sin(g) * dx - Math.cos(g) * dz) / Math.max(1e-9, Math.hypot(dx, dz));
      return { d: Math.hypot(dx, dz), frente };
    };
    const conW = recorrido((nav) => nav.bajar('KeyW'));
    s.ok(conW.d > 5, 'premisa: con W apretada el Jugador de verdad camina en 3 s', `${conW.d.toFixed(2)} m`);
    const quieto = recorrido(() => {});
    s.ok(quieto.d < 0.2, 'premisa: sin nada, el Jugador queda quieto', `${quieto.d.toFixed(3)} m`);
    const solo = recorrido((nav) => nav.tocar('KeyZ'));
    camina = solo.d > 0.9 * conW.d && solo.frente > 0.95;
    s.ok(camina, 'con Z el Jugador de verdad camina lo mismo que con W, hacia adelante, sin teclas', `${solo.d.toFixed(2)} m contra ${conW.d.toFixed(2)} · rumbo ${solo.frente.toFixed(3)}`);
  } catch (err) {
    s.ok(false, 'el Jugador de verdad se pudo mover con la Entrada de verdad', err.message);
  }

  s.feliz = prendio && camina;
  s.felizQue = `Z prendió: ${prendio} · el Jugador caminó solo: ${camina}`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA C Y LOS CONTROLES
// ═══════════════════════════════════════════════════════════════════════════

const MOVIMIENTOS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'KeyC', 'KeyZ'];

function etiquetaDeCodigo(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code === 'Escape') return 'Esc';
  return code;
}

async function controles() {
  const s = seccion(2, 'LA C Y LOS CONTROLES — nada pisa un movimiento, y la tabla nombra todo');
  const main = leer('main.js');
  const registradas = [...main.matchAll(/entrada\.registrar\(\s*['"]([A-Za-z0-9]+)['"]/g)].map((m) => m[1]);
  s.ok(registradas.length >= 10, 'premisa: se leyeron las teclas registradas en main.js', registradas.join(' '));

  const pisan = registradas.filter((c) => MOVIMIENTOS.includes(c));
  s.ok(pisan.length === 0, 'ninguna tecla registrada es una tecla de movimiento', pisan.join(' ') || 'ninguna');
  s.ok(registradas.includes('F2'), 'la calidad quedó registrada en F2');
  const bloqueF2 = /entrada\.registrar\(\s*['"]F2['"][\s\S]{0,400}?calidad\.siguiente\(/.test(main);
  s.ok(bloqueF2, 'F2 es la que llama a calidad.siguiente()');
  s.ok(!/C para cambiar/.test(main), 'el aviso de calidad ya no dice «C para cambiar»');

  const op = leer('ui/Opciones.js');
  const m = /const\s+CONTROLES\s*=\s*(\[[\s\S]*?\n\]);/.exec(op);
  let tabla = null;
  try { tabla = m ? new Function(`return ${m[1]};`)() : null; } catch (err) { s.nota(`CONTROLES no se pudo leer: ${err.message}`); }
  const pudo = s.ok(Array.isArray(tabla) && tabla.length > 0, 'premisa: se leyó la tabla CONTROLES de Opciones.js');

  const filas = [];
  for (const g of tabla || []) for (const [k, d] of g.teclas || []) filas.push({ k: String(k), d: String(d) });
  const fichas = (k) => {
    const out = new Set();
    for (const t of k.split(/\s+o\s+|\s*,\s*|\s+/).filter(Boolean)) {
      out.add(t);
      if (/^[A-Z]{2,}$/.test(t) && t !== 'WASD') continue;
      if (t === 'WASD') 'WASD'.split('').forEach((l) => out.add(l));
    }
    return out;
  };
  const fila = (etq) => filas.find((f) => fichas(f.k).has(etq));

  const faltan = registradas.filter((c) => !fila(etiquetaDeCodigo(c)));
  s.ok(pudo && faltan.length === 0, 'toda tecla registrada en main.js aparece en la tabla de controles', faltan.join(' ') || 'todas');
  const z = fila('Z');
  s.ok(!!z && /and/i.test(z.d), 'la tabla nombra Z para andar solo', z ? `${z.k}: ${z.d}` : 'no está');
  const f2 = fila('F2');
  s.ok(!!f2 && /calidad/i.test(f2.d), 'la tabla nombra F2 para la calidad', f2 ? `${f2.k}: ${f2.d}` : 'no está');
  const cCalidad = filas.filter((f) => fichas(f.k).has('C') && /calidad/i.test(f.d));
  s.ok(cCalidad.length === 0, 'ninguna fila le asigna la calidad a la C', cCalidad.map((f) => f.k).join(' ') || 'ninguna');

  s.feliz = pudo && registradas.length >= 10;
  s.felizQue = `${registradas.length} teclas registradas · ${filas.length} filas de controles`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL CARTEL DICE QUÉ DA
// ═══════════════════════════════════════════════════════════════════════════

/** La réplica del predicado de orilla, por si `Mundo.js` no se puede importar en Node. */
function orillaReplica(m, x, z) {
  for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]]) {
    if (m.esAgua(x + dx, z + dz)) return true;
  }
  return m.cauceEn(x, z) > 0.15;
}

async function mundoFalso({ aguaDesdeX = Infinity, altura = 800, pendiente = 0.1 } = {}) {
  let orilla = null;
  try { orilla = (await imp('world/Mundo.js')).Mundo?.prototype?.orillaCerca ?? null; } catch { /* réplica */ }
  const m = {
    esAgua: (x) => x >= aguaDesdeX,
    cauceEn: () => 0,
    alturaEn: () => altura,
    pendienteEn: () => pendiente,
    dentro: () => true,
    humedadEn: () => 0.5,
    aLatLon: () => ({ lat: -41.1, lon: -71.2 }),
    aMundo: () => ({ x: 0, z: 0 }),
  };
  m.orillaCerca = orilla ? (x, z) => orilla.call(m, x, z) : (x, z) => orillaReplica(m, x, z);
  return m;
}

function lote(id, nombre, x, y, z) {
  const a = new Float32Array(16);
  a[0] = a[5] = a[10] = a[15] = 1;
  a[12] = x; a[13] = y; a[14] = z;
  return { tipo: { id, nombre }, n: 1, malla: { instanceMatrix: { array: a } } };
}

async function armar({ en, lotes = [], planta = null, mundo, jurisdiccion = 'parque', herramienta = null }) {
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Mineria } = await imp('systems/Mineria.js');
  const { Caza } = await imp('systems/Caza.js');
  const avisos = [];
  const hud = { aviso: (t, d) => avisos.push([t, d]), negativa: (v) => avisos.push(['NEGATIVA', v?.titulo]), mostrarAccion() {} };
  const saberes = { puntos: 0, otorgar(p) { this.puntos += p; }, desbloqueadas: new Set(), porId: new Map() };
  const codice = { identificadas: new Set(), registrarFlora() {}, registrarFauna() {} };
  const inventario = new Inventario(200);
  const equipo = new Equipo(HERRAMIENTAS, { inventario });
  if (herramienta) equipo.guardar(herramienta);
  const jugador = { posicion: { ...en }, sed: 100, hambre: 100, salud: 100, enAgua: false };
  const limites = { jurisdiccion: () => jurisdiccion };
  const cuenta = { lotes: 0, masCercana: 0 };
  const sotobosque = { get lotes() { cuenta.lotes++; return lotes; } };
  const vegetacion = { masCercana: () => { cuenta.masCercana++; return planta; } };
  const fauna = { masCercano: () => null };
  const mineria = new Mineria({}, { mundo, limites, jugador, inventario, saberes, hud });
  mineria.tieneHerramienta = () => true;
  const caza = new Caza(CAZA, { inventario, hud, saberes, jugador, mundo, limites, equipo });
  const rec = new Recoleccion({ mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud });
  rec.caza = caza;
  rec.mineria = mineria;
  rec.pesca = null;
  rec.equipo = equipo;
  rec.herramientas = HERRAMIENTAS;
  return { rec, inventario, equipo, cuenta, avisos, mineria };
}

/** Lo que hay en el bolso, contado desde la grilla: recursos, sin instancias. */
function totales(inv) {
  const t = {};
  for (const c of inv.casillas || []) {
    if (!c || c.usos !== undefined) continue;
    t[c.id] = (t[c.id] || 0) + c.n;
  }
  return t;
}

async function parserDeEtiquetas() {
  const R = await imp('systems/Recursos.js');
  const porNombre = new Map(Object.keys(R.RECURSOS).map((id) => [R.nombreDe(id).toLowerCase(), id]));
  const idDe = (nombre) => porNombre.get(nombre.trim().toLowerCase()) ?? `?${nombre.trim()}`;
  return (etiqueta) => {
    const m = /\(([^()]*)\)\s*$/.exec(etiqueta || '');
    if (!m) return { hay: false, items: [], errores: [] };
    const items = [], errores = [];
    for (const crudo of m[1].split('·').map((x) => x.trim()).filter(Boolean)) {
      let r;
      if ((r = /^a veces\s+(.+)$/i.exec(crudo))) items.push({ id: idDe(r[1]), veces: true, crudo });
      else if ((r = /^(\d+)\s*(?:[–-]\s*(\d+))?\s*×\s*(.+)$/.exec(crudo))) items.push({ id: idDe(r[3]), min: +r[1], max: +(r[2] ?? r[1]), crudo });
      else errores.push(crudo);
    }
    return { hay: true, items, errores };
  };
}

const AZARES = Array.from({ length: 50 }, (_, k) => k / 50);

/** Corre un caso con cada valor del azar, en un mundo nuevo cada vez. */
async function barrer(caso) {
  const corridas = [];
  const azarReal = Math.random;
  const reloj = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try {
    for (const r of AZARES) {
      Math.random = () => r;
      const w = await armar(await caso.armar());
      const antes = { lotes: w.cuenta.lotes, masCercana: w.cuenta.masCercana };
      const acc = w.rec.quePuedoHacer(1000);
      const consulta = { lotes: w.cuenta.lotes - antes.lotes, masCercana: w.cuenta.masCercana - antes.masCercana };
      const previo = totales(w.inventario);
      let error = null;
      if (acc) { try { w.rec.actuar(1000); } catch (e) { error = e.message; } }
      const despues = totales(w.inventario);
      const obtenido = {};
      for (const id of new Set([...Object.keys(previo), ...Object.keys(despues)])) {
        const d = (despues[id] || 0) - (previo[id] || 0);
        if (d) obtenido[id] = d;
      }
      corridas.push({ r, tipo: acc?.tipo ?? null, etiqueta: acc?.etiqueta ?? null, acc, obtenido, consulta, error, w });
    }
  } finally {
    Math.random = azarReal;
    globalThis.setTimeout = reloj;
  }
  return corridas;
}

async function cartel() {
  const s = seccion(3, 'EL CARTEL DICE QUÉ DA — lo que promete el paréntesis es lo que la tecla da');
  const parsear = await parserDeEtiquetas();
  const especie = (id) => FLORA.especies.find((e) => e.id === id);
  const { Mineria } = await imp('systems/Mineria.js');

  // Dónde hay chatarra y dónde no, preguntándole a la Mineria de verdad
  const sonda = new Mineria({}, { mundo: await mundoFalso(), limites: { jurisdiccion: () => 'fuera' } });
  let xChatarra = null, xSin = null;
  for (let k = 0; k < 400 && (xChatarra === null || xSin === null); k++) {
    const x = k * 40;
    if (sonda.hayChatarra(x, 0)) xChatarra ??= x; else xSin ??= x;
  }
  s.ok(xChatarra !== null && xSin !== null, 'premisa: se encontró un lugar con chatarra y otro sin', `${xChatarra} · ${xSin}`);

  const LEJOS = { x: 0, y: 800, z: 0 };
  const ORILLA = { x: 990, y: 800, z: 0 };       // agua desde x = 1000: 10 m, fuera del alcance de beber
  const ALTO = { x: 0, y: 1700, z: 0 };
  const mata = (id, nombre, p, y = p.y) => lote(id, nombre, p.x + 1.5, y, p.z);

  const CASOS = [
    { nombre: 'planta maqui', tipo: 'planta', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), planta: { esp: especie('maqui'), x: 1, y: 800, z: 0, distancia: 1 } }) },
    { nombre: 'planta pino oregón', tipo: 'planta', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), planta: { esp: especie('pino_oregon'), x: 1, y: 800, z: 0, distancia: 1 } }) },
    { nombre: 'planta taique (no da nada)', tipo: 'planta', nada: true, armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), planta: { esp: especie('taique'), x: 1, y: 800, z: 0, distancia: 1 } }) },
    { nombre: 'piedra lejos del agua y abajo', tipo: 'sotobosque', noPromete: ['arcilla', 'obsidiana'], armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('piedra', 'Piedra suelta', LEJOS)] }) },
    // Desde la fase 3, en la banda de orilla la tecla puede ofrecer la barranca en vez
    // de la piedra, y las dos prometen arcilla. Lo que este caso cuida es eso —que en
    // la orilla se prometa arcilla y se dé lo prometido—, no que gane la piedra. Se
    // cambió a la vista, antes de encargar la fase 3, para que el gesto nuevo no lo
    // pusiera rojo por diseño.
    { nombre: 'piedra en la orilla', tipo: 'sotobosque', acepta: (acc) => acc?.tipo === 'sotobosque' || /arcilla/i.test(acc?.etiqueta || ''), promete: ['arcilla'], noPromete: ['obsidiana'], armar: async () => ({ en: ORILLA, mundo: await mundoFalso({ aguaDesdeX: 1000 }), lotes: [lote('piedra', 'Piedra suelta', 988, 800, 0)] }) },
    { nombre: 'piedra en altura', tipo: 'sotobosque', promete: ['obsidiana'], noPromete: ['arcilla'], armar: async () => ({ en: ALTO, mundo: await mundoFalso({ altura: 1700 }), lotes: [mata('piedra', 'Piedra suelta', ALTO, 1700)] }) },
    { nombre: 'coirón', tipo: 'sotobosque', promete: ['lana'], armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('coiron', 'Coirón', LEJOS)] }) },
    { nombre: 'pasto húmedo', tipo: 'sotobosque', promete: ['pluma'], armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('pasto_humedo', 'Pasto húmedo', LEJOS)] }) },
    { nombre: 'helecho', tipo: 'sotobosque', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('helecho', 'Helecho', LEJOS)] }) },
    { nombre: 'michay', tipo: 'sotobosque', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('michay', 'Michay', LEJOS)] }) },
    { nombre: 'tronco a mano', tipo: 'sotobosque', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('tronco', 'Tronco caído', LEJOS)] }) },
    { nombre: 'tronco con hacha', tipo: 'sotobosque', herramienta: 'hacha_piedra', puede: 'trozar', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), herramienta: 'hacha_piedra', lotes: [mata('tronco', 'Tronco caído', LEJOS)] }) },
    { nombre: 'chatarra', tipo: 'chatarra', tecla: 'R', armar: async () => ({ en: { x: xChatarra, y: 800, z: 0 }, mundo: await mundoFalso(), jurisdiccion: 'fuera' }) },
    { nombre: 'cantera', tipo: 'cantera', tecla: 'R', armar: async () => ({ en: { x: xSin, y: 800, z: 0 }, mundo: await mundoFalso(), jurisdiccion: 'fuera' }) },
    { nombre: 'carroña sin filo', tipo: 'carronia', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), lotes: [mata('carronia', 'Restos de un animal', LEJOS)] }) },
    { nombre: 'carroña con filo', tipo: 'carronia', herramienta: 'lasca', puede: 'descuerar', armar: async () => ({ en: LEJOS, mundo: await mundoFalso(), herramienta: 'lasca', lotes: [mata('carronia', 'Restos de un animal', LEJOS)] }) },
  ];

  let casosQueCorrieron = 0, casosQueDieron = 0;
  for (const caso of CASOS) {
    const c = await barrer(caso);
    const n = caso.nombre;
    const tipoBien = c.every((x) => (caso.acepta ? caso.acepta(x.acc) : x.tipo === caso.tipo));
    s.ok(tipoBien, `premisa · ${n}: la tecla ofrece «${caso.tipo}»`, [...new Set(c.map((x) => `${x.tipo}: ${x.etiqueta}`))].slice(0, 2).join(' | '));
    if (caso.puede) {
      s.ok(c[0].w.equipo.puede(caso.puede) || Object.keys(c[0].obtenido).length > 0, `premisa · ${n}: ${caso.herramienta} en la mano habilita ${caso.puede}`);
    }
    const errores = c.filter((x) => x.error);
    s.ok(errores.length === 0, `premisa · ${n}: actuar() no explota`, errores[0]?.error);
    if (!tipoBien) continue;
    casosQueCorrieron++;

    const etiquetas = new Set(c.map((x) => x.etiqueta));
    s.ok(etiquetas.size === 1, `${n}: el cartel no cambia con el azar (no parpadea)`, [...etiquetas].slice(0, 3).join(' | '));
    const etiqueta = c[0].etiqueta;
    const p = parsear(etiqueta);

    // K7: el mismo trabajo por consulta
    const peor = c.reduce((a, x) => ({ lotes: Math.max(a.lotes, x.consulta.lotes), masCercana: Math.max(a.masCercana, x.consulta.masCercana) }), { lotes: 0, masCercana: 0 });
    s.ok(peor.lotes <= 1 && peor.masCercana <= 1, `${n}: quePuedoHacer lee los lotes y la vegetación una vez como mucho`, `lotes ${peor.lotes} · masCercana ${peor.masCercana}`);

    // K6 del lado de la etiqueta: nada de «(o R)» adentro
    if (caso.tecla) {
      s.ok(c[0].acc?.tecla === caso.tecla, `${n}: la acción declara su tecla propia ${caso.tecla}`, c[0].acc?.tecla);
      s.ok(!/\(o\s+[A-Z]\)/.test(etiqueta || ''), `${n}: la etiqueta ya no trae «(o ${caso.tecla})» adentro`, etiqueta);
    }

    const union = new Set(c.flatMap((x) => Object.keys(x.obtenido).filter((id) => x.obtenido[id] > 0)));
    if (union.size) casosQueDieron++;

    if (caso.nada || !union.size) {
      s.ok(p.items.length === 0, `${n}: no promete nada si no da nada`, etiqueta);
      continue;
    }

    s.ok(p.hay, `${n}: la etiqueta termina en un paréntesis con el rinde`, etiqueta);
    s.ok(p.errores.length === 0, `${n}: cada renglón del paréntesis es «N × nombre», «N–M × nombre» o «a veces nombre»`, p.errores.join(' | '));
    const raros = p.items.filter((i) => i.id.startsWith('?'));
    s.ok(raros.length === 0, `${n}: cada nombre del paréntesis es un recurso del juego`, raros.map((i) => i.crudo).join(' | '));

    const prom = new Map();
    for (const it of p.items) {
      const a = prom.get(it.id) || { min: 0, max: 0, veces: false };
      if (it.veces) a.veces = true; else { a.min += it.min; a.max += it.max; }
      prom.set(it.id, a);
    }
    const sinNombrar = [...union].filter((id) => !prom.has(id));
    s.ok(sinNombrar.length === 0, `${n}: todo lo que entra al bolso está nombrado`, sinNombrar.join(' ') || etiqueta);

    for (const [id, a] of prom) {
      if (id.startsWith('?')) continue;
      const vals = c.map((x) => x.obtenido[id] || 0);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      if (!a.veces) {
        s.ok(vals.every((v) => v >= a.min && v <= a.max), `${n}: ${id} cae siempre entre lo prometido`, `promete ${a.min}–${a.max} · dio ${lo}–${hi}`);
        s.ok(vals.includes(a.min) && vals.includes(a.max), `${n}: ${id} llega a los dos extremos que promete`, `promete ${a.min}–${a.max} · dio ${[...new Set(vals)].sort((x, y) => x - y).join(',')}`);
      } else {
        s.ok(vals.some((v) => v > a.max), `${n}: «a veces ${id}» sale alguna vez`, `fijo ${a.min}–${a.max} · dio ${lo}–${hi}`);
        s.ok(vals.some((v) => v <= a.max), `${n}: «a veces ${id}» no sale siempre`, `fijo ${a.min}–${a.max} · dio ${lo}–${hi}`);
        s.ok(vals.every((v) => v >= a.min), `${n}: lo fijo de ${id} está aunque no salga lo de a veces`, `fijo ${a.min} · dio ${lo}`);
      }
    }
    for (const id of caso.promete || []) s.ok(prom.has(id), `${n}: acá sí promete ${id}`, etiqueta);
    for (const id of caso.noPromete || []) s.ok(!prom.has(id), `${n}: acá no promete ${id}`, etiqueta);
  }

  s.feliz = casosQueCorrieron === CASOS.length && casosQueDieron >= CASOS.length - 1;
  s.felizQue = `${casosQueCorrieron} de ${CASOS.length} casos ofrecieron su acción · ${casosQueDieron} dieron algo`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LA TECLA EN SU LUGAR
// ═══════════════════════════════════════════════════════════════════════════

async function teclaEnSuLugar() {
  const s = seccion(4, 'LA TECLA EN SU LUGAR — E y R donde van, y no la primera R que aparezca');
  const mod = await imp('ui/HUD.js');
  const HUD = mod.HUD || Object.values(mod).find((v) => typeof v === 'function' && v.prototype?.mostrarAccion);
  if (!s.ok(!!HUD, 'premisa: HUD.js exporta la clase con mostrarAccion')) { s.felizQue = 'no hay HUD'; return s; }

  const pintar = (acc) => {
    const cl = claseLista();
    const falso = { elAccion: { innerHTML: '', classList: cl } };
    HUD.prototype.mostrarAccion.call(falso, acc);
    return { html: falso.elAccion.innerHTML, visible: cl.contains('visible') };
  };
  const negritas = (h) => (h.match(/<b>/g) || []).length;

  const a = pintar({ tipo: 'planta', etiqueta: 'Recolectar maqui (3 × frutos · 2–4 × frutos)' });
  s.ok(a.visible, 'premisa: una acción deja el cartel visible');
  s.ok(a.html.startsWith('<b>E</b>'), 'sin tecla propia empieza con E marcada', a.html);
  s.ok(a.html.includes('Recolectar maqui (3 × frutos · 2–4 × frutos)'), 'la etiqueta sale textual', a.html);
  s.ok(negritas(a.html) === 1, 'una sola marca', a.html);

  const b = pintar({ tipo: 'chatarra', etiqueta: 'Levantar chatarra (1–3 × chatarra)', tecla: 'R' });
  s.ok(b.html.startsWith('<b>E</b>'), 'con tecla propia también empieza con E: la E también lo hace', b.html);
  s.ok(/o\s*<b>R<\/b>\s*$/.test(b.html), 'y termina en «o R» con la R marcada', b.html);
  s.ok(b.html.includes('Levantar chatarra (1–3 × chatarra)'), 'la etiqueta sale textual entre las dos', b.html);
  s.ok(negritas(b.html) === 2, 'dos marcas: E y R', b.html);

  const trampa = pintar({ tipo: 'cantera', etiqueta: 'Abrir frente de Roca (3 × Ripio · 2 × arena)', tecla: 'R' });
  s.ok(trampa.html.includes('Abrir frente de Roca (3 × Ripio · 2 × arena)'), 'una R mayúscula en el rinde no se marca: la etiqueta sale textual', trampa.html);
  s.ok(/o\s*<b>R<\/b>\s*$/.test(trampa.html) && negritas(trampa.html) === 2, 'y la R marcada es la de la tecla', trampa.html);

  const cl = claseLista();
  cl.add('visible');
  HUD.prototype.mostrarAccion.call({ elAccion: { innerHTML: 'x', classList: cl } }, null);
  s.ok(!cl.contains('visible'), 'sin acción el cartel se esconde');

  s.feliz = a.visible && a.html.length > 0;
  s.felizQue = 'mostrarAccion pintó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · SIN REGRESIÓN  ·  6 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(5, 'SIN REGRESIÓN — las fases anteriores siguen verdes');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r5-fase1.mjs', '9/9', {}],
    ['banco-r6-fase1.mjs', '7/7', {}],
    ['banco-r6-fase2.mjs', '8/8', {}],
    // Con BANCO_SRC apuntando al src de verdad, la fase 3 saltea SU sección de
    // regresión: si no, corre otra vez los tres de arriba adentro de ésta.
    ['banco-r6-fase3.mjs', '6/6', { BANCO_SRC: path.join(RAIZ, 'src') }],
  ];
  let corrio = 0;
  for (const [archivo, esperado, env] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000,
      env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', ...env },
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

const SECCIONES = { andarSolo, controles, cartel, teclaEnSuLugar, regresion, arranque };
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

console.log(`\n  BANCO R7 · FASE 1 — andar solo, el cartel y la C   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
