/**
 * BANCO DE LA FASE 7 (reglas) — ronda 8.
 *
 * Lo escribe el JEFE antes que el agente, contra el contrato de RONDA8.md (G1 a G5).
 *
 *   1. LA MUERTE — con `Partida`, `Inventario` y `Equipo` de verdad: morir vacía el bolso,
 *      las cuatro ranuras y apaga la llama; la pantalla de fin nombra lo puesto; las
 *      trampas quedan; un guardado de antes carga.
 *   2. LA LANA — con `Recoleccion` y un coirón de juguete: 1 de cada 4 apretadas (±2
 *      puntos, 4000 apretadas con el azar sembrado) y el poncho en 47 ± 15 % apretadas.
 *   3. LA LICENCIA — la de la recolección en el Parque, con la ley y el artículo; en la
 *      pestaña Normativa del códice; y dicha una vez, sólo en el Parque.
 *   4. LAS DEUDAS — la estación entre todas las que están a mano; un solo radio; nada de
 *      «115»; `efectosAAgregar` sin entradas ya aplicadas.
 *   5. LA CESTERÍA — suma una vez: el canasto puesto, no la tecnología.
 *   6. SIN REGRESIÓN — la ronda 7, la ronda 6 fase 3, las fases 1 a 6 en lo que se mide
 *      sin navegador.
 *   7. ARRANQUE — vite build.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase7.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 *      `--fixture` escribe `r8-partida-vieja.json` con el código de hoy (se corrió una vez,
 *      el 19/9/2026, antes del agente).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const FIXTURE = path.join(AQUI, 'r8-partida-vieja.json');
const imp = (p) => import(pathToFileURL(path.join(SRC, p)).href);
const datos = (f) => JSON.parse(fs.readFileSync(path.join(SRC, 'data', f), 'utf8'));

// ── El entorno: almacenamiento, documento mínimo, azar sembrable ─────────────
const almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => { almacen.set(k, String(v)); }, removeItem: (k) => { almacen.delete(k); } };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
const el = () => ({ style: { setProperty() {} }, dataset: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, removeEventListener() {}, appendChild() {}, querySelector: () => el(), querySelectorAll: () => [], setAttribute() {}, remove() {}, getContext: () => null });
globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => el(), getElementById: () => null, querySelector: () => el(), body: el() };
const azarReal = Math.random;
function sembrar(s) { let a = s >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}
const sinComentariosJs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// ── Un mundo de juguete ─────────────────────────────────────────────────────

async function armar() {
  const THREE = await import('three');
  const H = datos('herramientas.json'), HI = datos('historia.json');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Saberes } = await imp('systems/Saberes.js');
  const { Tiempo } = await imp('world/Tiempo.js');
  const inventario = new Inventario(38);
  const equipo = new Equipo(H, { inventario });
  const saberes = new Saberes(HI, inventario);
  const tiempo = new Tiempo(-41.1, -71.52, new Date(Date.UTC(2025, 1, 12, 23, 0, 0)));
  const jugador = { posicion: new THREE.Vector3(500, 850, 0), giro: 0, sed: 100, hambre: 100, salud: 100, energia: 100, temperatura: 36.6, horasVividas: 0, enAgua: false, vivo: true, revivir() { this.vivo = true; } };
  const avisos = [];
  const hud = { aviso: (t, d) => avisos.push(`${t} · ${d ?? ''}`), negativa: (v) => avisos.push(`NEGATIVA · ${v?.titulo ?? ''}`), mostrarAccion() {} };
  const trampas = { lista: [{ objeto: 'trampa_lazo', x: 510, z: 4, puestaEn: 0, presas: [] }], serializar() { return this.lista.map((x) => ({ ...x })); }, reponer(l) { this.lista = (l || []).map((x) => ({ ...x })); } };
  return { THREE, H, HI, inventario, equipo, saberes, tiempo, jugador, hud, avisos, trampas };
}
const depsDe = (w) => ({
  jugador: w.jugador, inventario: w.inventario, equipo: w.equipo, saberes: w.saberes,
  codice: { descubiertas: new Set(), identificadas: new Set(), lugares: new Set() },
  construccion: { obras: [], catalogo: [] }, fundicion: { hornos: [] },
  tiempo: w.tiempo, mundo: {}, hud: w.hud, exploracion: { guardar() {} }, recoleccion: {},
  obras: { agregar() {} }, hornos: { agregar() {} }, trampas: w.trampas,
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA MUERTE
// ═══════════════════════════════════════════════════════════════════════════

async function muerte() {
  const s = seccion(1, 'LA MUERTE — se pierde todo: el bolso, las cuatro ranuras y la llama');
  const w = await armar();
  const { Partida } = await imp('systems/Partida.js');
  w.inventario.agregar('piedra', 3);
  for (const id of ['antorcha', 'garrote', 'quillango', 'canasto_junco_obj', 'lasca']) w.equipo.guardar(id);
  const puestosAntes = Object.entries(w.equipo.puesto).filter(([, c]) => c).map(([r, c]) => `${r}:${c.id}`);
  s.ok(puestosAntes.length === 4, 'premisa: las cuatro ranuras ocupadas', puestosAntes.join(', '));
  const luz = w.equipo.encender('antorcha', w.tiempo.fecha.getTime());
  s.ok(luz?.ok !== false && !!w.equipo.encendida, 'premisa: la antorcha encendida en la mano', JSON.stringify(luz).slice(0, 100));
  almacen.clear();
  const p = new Partida(depsDe(w));
  p._equipo ??= w.equipo;
  const r = p.registrarMuerte({ causa: 'frio' });
  const quedanPuestos = Object.entries(w.equipo.puesto).filter(([, c]) => c).map(([rr, c]) => `${rr}:${c.id}`);
  s.ok(quedanPuestos.length === 0, 'las cuatro ranuras quedan vacías', quedanPuestos.join(', ') || 'vacías');
  const quedaBolso = (w.inventario.listar?.() || []).length + (w.inventario.instancias?.().length || 0);
  s.ok(quedaBolso === 0, 'el bolso queda vacío', quedaBolso);
  s.ok(!w.equipo.encendida, 'la llama se apaga', w.equipo.encendida);
  const perdido = (r?.perdido || p.ultimaMuerte?.perdido || []).map((x) => x.id);
  const faltan = ['antorcha', 'garrote', 'quillango', 'canasto_junco_obj'].filter((id) => !perdido.includes(id));
  s.ok(faltan.length === 0, 'la pantalla de fin nombra lo que estaba puesto', faltan.length ? `no nombra: ${faltan.join(', ')}` : perdido.join(', '));
  s.ok(w.trampas.lista.length === 1, 'las trampas puestas siguen donde estaban', w.trampas.lista.length);
  // Un guardado de antes del cambio carga
  if (fs.existsSync(FIXTURE)) {
    const w2 = await armar();
    almacen.clear();
    almacen.set('survibar.partida.v1', fs.readFileSync(FIXTURE, 'utf8'));
    let cargo = false, tiro = null;
    try { cargo = new Partida(depsDe(w2)).cargar(); } catch (e) { tiro = e.message; }
    s.ok(cargo === true && !tiro, 'un guardado de antes del cambio carga', tiro || cargo);
  } else s.ok(false, 'premisa: existe el guardado viejo congelado', FIXTURE);
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA LANA  ·  3 · LA LICENCIA
// ═══════════════════════════════════════════════════════════════════════════

async function recoleccionCon(w, jurisdiccion) {
  const { Recoleccion } = await imp('systems/Recoleccion.js');
  const mundo = {
    tamano: 65536, mitad: 32768, meta: { lagos: [], centro: { lat: -41.1, lon: -71.52 } },
    esAgua: () => false, cotaLagoEn: () => null, cauceEn: () => 0, alturaEn: () => 850, alturaBaseEn: () => 850, superficieEn: () => 850,
    humedadEn: () => 0.3, pendienteEn: () => 0.05, dentro: () => true, aLatLon: () => ({ lat: -41.1, lon: -71.3 }), orillaCerca: () => null,
  };
  const arr = new Float32Array(16); arr[0] = arr[5] = arr[10] = arr[15] = 1; arr[12] = w.jugador.posicion.x + 1; arr[13] = 850; arr[14] = w.jugador.posicion.z;
  const sotobosque = { lotes: [{ tipo: { id: 'coiron', nombre: 'Coirón' }, n: 1, malla: { instanceMatrix: { array: arr } } }] };
  w.inventario.capacidadKg = 1e6;
  const codice = { identificadas: new Set(), descubiertas: new Set(), lugares: new Set(), registrarFauna() {}, registrarFlora() {} };
  const rec = new Recoleccion({ mundo, jugador: w.jugador, vegetacion: { masCercana: () => null }, sotobosque, fauna: { masCercano: () => null }, inventario: w.inventario, saberes: w.saberes, codice, hud: w.hud });
  const limites = { jurisdiccion: () => jurisdiccion, etiqueta: () => ({ id: jurisdiccion, nombre: jurisdiccion }) };
  rec.equipo = w.equipo; rec.herramientas = w.H; rec.limites = limites;
  const { Mineria } = await imp('systems/Mineria.js');
  rec.mineria = new Mineria(datos('mineria.json'), { mundo, limites, jugador: w.jugador, inventario: w.inventario, saberes: w.saberes, hud: w.hud });
  rec.mineria.chatarraAMano = () => null;   // la chatarra del lugar le ganaba la tecla al coirón: no es lo que se mide
  rec.caza = null; rec.pesca = null; rec.trampas = null;
  return rec;
}
function apretar(rec, veces) {
  let conLana = 0;
  const antes = () => rec.inventario.disponiblePara('lana');
  for (let i = 0; i < veces; i++) {
    rec.descansando?.clear?.();
    const a = antes();
    rec.actuar(Date.now() + i * 1000);
    if (antes() > a) conLana++;
  }
  return conLana;
}

async function lana() {
  const s = seccion(2, 'LA LANA — 1 de cada 4, y el poncho en 47 apretadas');
  const w = await armar();
  const rec = await recoleccionCon(w, 'reserva');
  const q = rec.quePuedoHacer(Date.now());
  if (!s.ok(q?.tipo === 'sotobosque', 'premisa: junto al coirón, la tecla ofrece el coirón', q && `${q.tipo}: ${q.etiqueta}`)) return s;
  sembrar(20260919);
  const N = 4000;
  const n = apretar(rec, N);
  Math.random = azarReal;
  const f = n / N;
  s.ok(Math.abs(f - 0.25) <= 0.02, 'la lana sale en 1 de cada 4 apretadas (±2 puntos)', `${n} de ${N} (${(f * 100).toFixed(1)} %)`);
  // El poncho: la cadena de la lana en los datos
  const H = w.H;
  const poncho = H.objetos.find((o) => o.id === 'poncho_witral');
  const hilado = (poncho?.materiales || []).find((m) => m.recurso === 'hilado')?.cantidad ?? 0;
  const hilar = H.objetos.find((o) => (o.produce || []).some((p) => p.recurso === 'hilado'));
  const porTanda = hilar?.produce?.find((p) => p.recurso === 'hilado')?.cantidad ?? 1;
  const lanaTanda = hilar?.materiales?.find((m) => m.recurso === 'lana')?.cantidad ?? 0;
  const lanas = Math.ceil(hilado / porTanda) * lanaTanda;
  const apretadas = f > 0 ? lanas / f : Infinity;
  s.ok(Math.abs(apretadas / 47 - 1) <= 0.15, 'el poncho cuesta 47 apretadas ± 15 %', `${lanas} lanas / ${f.toFixed(3)} = ${apretadas.toFixed(1)}`);
  s.feliz = true;
  return s;
}

async function licencia() {
  const s = seccion(3, 'LA LICENCIA — recolectar en el Parque, dicho: en los datos, en el códice y una vez');
  const H = datos('herramientas.json');
  const lic = (H.licenciasDeJuego?.licencias || []).find((l) => /recolec/i.test(`${l.id} ${l.que || ''}`));
  const todo = lic ? JSON.stringify(lic) : '';
  s.ok(!!lic, 'licenciasDeJuego declara la de la recolección en el Parque', lic?.id);
  s.ok(/22\.?351/.test(todo) && /art(?:ículo|iculo|\.)?\s*5\b/i.test(todo), 'con la Ley 22.351 y su artículo 5', todo.slice(0, 160));
  // El códice: la pestaña Normativa muestra las licencias de juego
  let html = '';
  try {
    const { Codice } = await imp('ui/Codice.js');
    const yo = { normativa: { caza: {}, mineria: {}, construccion: {}, herramientas: H, licencias: H.licenciasDeJuego?.licencias, licenciasDeJuego: H.licenciasDeJuego }, norma: { registro: [] }, herramientas: H, licencias: H.licenciasDeJuego?.licencias, licenciasDeJuego: H.licenciasDeJuego };
    html = Codice.prototype._pintarNormativa.call(yo);
  } catch (e) { html = `(tiró: ${e.message})`; }
  s.ok(/22\.?351/.test(html), 'la pestaña Normativa del códice la muestra', html.slice(0, 120));
  // Dicha una vez, sólo en el Parque
  for (const [jur, esperaPrimera] of [['parque', true], ['reserva', false]]) {
    const w = await armar();
    const rec = await recoleccionCon(w, jur);
    w.avisos.length = 0;
    rec.descansando?.clear?.(); rec.actuar(Date.now());
    const primera = w.avisos.join(' | ');
    rec.descansando?.clear?.(); rec.actuar(Date.now() + 5000);
    const segunda = w.avisos.slice(1).join(' | ');
    const dice = (t) => /22\.?351/.test(t);
    if (esperaPrimera) {
      s.ok(dice(primera), 'en el Parque, la primera apretada dice la licencia', primera.slice(0, 160));
      s.ok(!dice(segunda), 'y la segunda ya no', segunda.slice(0, 160));
    } else {
      s.ok(!dice(primera + segunda), 'en la Reserva no la dice', (primera + segunda).slice(0, 160));
    }
  }
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LAS DEUDAS  ·  5 · LA CESTERÍA
// ═══════════════════════════════════════════════════════════════════════════

function fundicionFalsa(jugador, hornos) {
  const RADIO = 8;
  return {
    jugador, hornos,
    cercano(radio = RADIO, filtro = null) {
      let mejor = null, d0 = radio;
      for (const h of hornos) { const d = Math.hypot(h.x - jugador.posicion.x, h.z - jugador.posicion.z); if (d < d0 && (!filtro || filtro(h))) { d0 = d; mejor = h; } }
      return mejor;
    },
    arde: (h) => h.prendido !== false, usaFuego: (h) => h.def.id !== 'telar_witral',
    hornoPorId: (id) => (['fogata', 'fragua'].includes(id) ? { id } : null),
    definicionesHorno: [{ id: 'fragua', nombre: 'Fragua' }, { id: 'fogata', nombre: 'Fogata' }],
  };
}

async function deudas() {
  const s = seccion(4, 'LAS DEUDAS — la estación, el radio, el «115» y efectosAAgregar');
  const w = await armar();
  const { Fabricacion } = await imp('systems/Fabricacion.js');
  for (const t of w.HI.tecnologias || []) w.saberes.desbloqueadas.add(t.id);
  w.inventario.capacidadKg = 1e6;
  const recetaDe = (donde) => w.H.objetos.find((o) => o.donde === donde && (o.materiales || []).length);
  const probar = (donde, hornos) => {
    const o = recetaDe(donde);
    if (!o) return { estado: 'sin receta' };
    for (const m of o.materiales) w.inventario.agregar(m.recurso, m.cantidad + 2);
    for (const id of [].concat(o.pideHerramienta || [])) w.equipo.guardar(id);
    const p = w.jugador.posicion;
    const fab = new Fabricacion(w.H, { inventario: w.inventario, saberes: w.saberes, equipo: w.equipo, fundicion: fundicionFalsa(w.jugador, hornos.map(([id, d]) => ({ def: { id, nombre: id }, x: p.x + d, z: p.z }))), hud: w.hud });
    return { id: o.id, ...fab.estado(o) };
  };
  const a = probar('fragua', [['fogata', 2], ['fragua', 6]]);
  s.ok(a.estado !== 'falta_estacion', 'con la fogata a 2 m y la fragua a 6, una receta de fragua no pide la fragua', JSON.stringify(a).slice(0, 140));
  const b = probar('fogata', [['telar_witral', 1], ['fogata', 5]]);
  s.ok(b.estado !== 'falta_estacion', 'con el telar a 1 m y la fogata a 5, una receta de fogata no pide la fogata', JSON.stringify(b).slice(0, 140));
  // El defecto de la fogata es al revés: el telar «arde» siempre (no quema), y lo más cercano
  // satisfacía la receta de fogata sin fuego; y una fogata apagada más cerca escondía a la prendida
  const b2 = probar('fogata', [['telar_witral', 1]]);
  s.ok(b2.estado === 'falta_estacion', 'con el telar a 1 m y sin fogata, la receta de fogata sí pide fuego', JSON.stringify(b2).slice(0, 140));
  const p0 = w.jugador.posicion;
  const oApagada = recetaDe('fogata');
  const fabB = new Fabricacion(w.H, { inventario: w.inventario, saberes: w.saberes, equipo: w.equipo, fundicion: fundicionFalsa(w.jugador, [{ def: { id: 'fogata', nombre: 'fogata' }, x: p0.x + 1, z: p0.z, prendido: false }, { def: { id: 'fogata', nombre: 'fogata' }, x: p0.x + 5, z: p0.z }]), hud: w.hud });
  const b3 = { id: oApagada?.id, ...fabB.estado(oApagada) };
  s.ok(b3.estado !== 'falta_estacion', 'con una fogata apagada a 1 m y una prendida a 5, la receta de fogata no pide fuego', JSON.stringify(b3).slice(0, 140));
  const c = probar('fragua', [['fogata', 2]]);
  s.ok(c.estado === 'falta_estacion', 'premisa: sin fragua, la receta de fragua sí la pide', JSON.stringify(c).slice(0, 140));
  // Un solo radio
  const fab = fs.readFileSync(path.join(SRC, 'systems', 'Fabricacion.js'), 'utf8');
  const fun = fs.readFileSync(path.join(SRC, 'systems', 'Fundicion.js'), 'utf8');
  s.ok(!/const\s+RADIO_[A-Z_]*\s*=\s*\d/.test(sinComentariosJs(fab)), 'Fabricacion.js no declara su propio radio', (sinComentariosJs(fab).match(/const\s+RADIO_[A-Z_]*\s*=\s*[\d.]+/) || [''])[0]);
  s.ok(/export\s+const\s+RADIO_[A-Z_]+\s*=/.test(fun) && /import\s*\{[^}]*RADIO_[A-Z_]+[^}]*\}\s*from\s*'\.\/Fundicion\.js'/.test(fab), 'lo importa de Fundicion.js, que lo exporta');
  // El «115»
  for (const f of ['ui/Iconos.js', 'ui/Bolso.js']) {
    const t = fs.readFileSync(path.join(SRC, f), 'utf8');
    s.ok(!/\b115\b/.test(t), `${f} ya no dice «115»`, (t.match(/[^\n]*\b115\b[^\n]*/) || [''])[0].trim().slice(0, 100));
  }
  // efectosAAgregar
  const aplicadas = (w.H.efectosAAgregar || []).filter((e) => {
    const t = (w.HI.tecnologias || []).find((x) => x.id === e.tecnologia); const ef = t?.efecto || {};
    return Object.entries(e.efecto || {}).every(([k, v]) => (Array.isArray(v) ? v.every((x) => (ef[k] || []).includes(x)) : ef[k] === v));
  }).map((e) => e.tecnologia);
  s.ok(aplicadas.length === 0, 'efectosAAgregar no tiene entradas ya aplicadas en historia.json', aplicadas.join(', ') || 'ninguna');
  s.feliz = true;
  return s;
}

async function cesteria() {
  const s = seccion(5, 'LA CESTERÍA — el canasto suma, la tecnología no');
  const w = await armar();
  const cap = () => 38 + w.saberes.suma('capacidadExtraKg') + w.equipo.suma('capacidadExtraKg');
  s.ok(cap() === 38, 'premisa: sin nada, 38 kg', cap());
  w.saberes.desbloqueadas.add('cesteria_junco');
  s.ok(cap() === 38, 'con la cestería aprendida y sin canasto, 38 kg', cap());
  w.equipo.guardar('canasto_junco_obj');
  s.ok(cap() === 44, 'con el canasto puesto, 44 kg', cap());
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — la ronda 7, los iconos de la ronda 6, y las fases 1 a 6');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const base = { BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' };
  const otros = [
    ['banco-r6-fase3.mjs', '6/6'],
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'], ['banco-r8-fase1.mjs', '8/8'], ['banco-r8-fase2.mjs', '10/10'],
    ['banco-r8-fase3.mjs', '4/4', { BANCO_SECCIONES: 'horno,terreno,piso,shader' }],
    ['banco-r8-fase3b.mjs', '2/2', { BANCO_SECCIONES: 'marco,shader' }],
    ['banco-r8-fase3c.mjs', '2/2', { BANCO_SECCIONES: 'vertice,shader' }],
    ['banco-r8-fase4.mjs', '4/4', { BANCO_SECCIONES: 'horno,hoja,clases,modelo' }],
    ['banco-r8-fase5.mjs', '5/5', { BANCO_SECCIONES: 'cadena,primeraHora,martillo,nadiePeor,notas' }],
    // Mientras la fase 6 no esté hecha, su banco da 1/4 y eso es lo que se fija
    ['banco-r8-fase6.mjs', '1/4', { BANCO_SECCIONES: 'ley,noche,cielo,shader' }],
  ];
  let corrio = 0;
  for (const [archivo, esperado, env] of otros) {
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 1800000, env: { ...process.env, ...base, ...(env || {}) },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length}`;
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

// ── El guardado viejo, congelado una vez ─────────────────────────────────────

if (process.argv.includes('--fixture')) {
  const w = await armar();
  const { Partida } = await imp('systems/Partida.js');
  w.inventario.agregar('piedra', 5);
  for (const id of ['antorcha', 'garrote']) w.equipo.guardar(id);
  almacen.clear();
  new Partida(depsDe(w)).guardar();
  fs.writeFileSync(FIXTURE, almacen.get('survibar.partida.v1'));
  console.log(`guardado viejo congelado en ${path.relative(RAIZ, FIXTURE)} (${fs.statSync(FIXTURE).size} bytes)`);
  process.exit(0);
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { muerte, lana, licencia, deudas, cesteria, regresion, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);
const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({ num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }], feliz: false, felizQue: 'la sección tiró una excepción', notas: [] });
  }
}
todas.sort((a, b) => a.num - b.num);
if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas.map((s) => ({ num: s.num, nombre: s.nombre, feliz: s.feliz, checks: s.checks }))));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 7 — las reglas y las deudas   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
