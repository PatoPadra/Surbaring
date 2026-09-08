/**
 * r4-economia.mjs — banco de economía del árbol de crafteo.
 *
 * Revisión independiente de src/data/herramientas.json. NO edita nada: mide.
 *
 * Cinco preguntas, cada una con su número:
 *   1. ALCANZABILIDAD — cierre transitivo desde manos vacías.
 *   2. CANDADOS — ciclos objeto ↔ material (el caso arco↔tendón, y los otros).
 *   3. PESO — 38 kg de bolso contra los kilos que pide cada receta.
 *   4. SABER — costoSaber acumulado contra los puntos que el juego reparte.
 *   5. CURVA — objetos por nivel.
 *
 * Disciplina anti-verde (este proyecto ya se comió ocho bancos que medían nada):
 *   - Todo `rinde` en prosa que el parser no entienda se REPORTA, no se ignora.
 *   - Todo peso que caiga en el `?? 0.5` por defecto se REPORTA.
 *   - El cierre corre en DOS mundos: `dataset` (lo que herramientas.json promete)
 *     y `codigo` (lo que Recoleccion.js/Recursos.js/caza.json entregan hoy).
 *     Si los dos dan lo mismo, uno de los dos está mintiendo.
 *   - Al final corren mutaciones: se rompe el dato a propósito y se comprueba
 *     que cada control efectivamente grite. Un control que no grita no cuenta.
 *
 * Uso: node .claude/flota/r4-economia.mjs [--verbose]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const leer = (p) => JSON.parse(readFileSync(join(RAIZ, p), 'utf8'));

const H          = leer('src/data/herramientas.json');
const HISTORIA   = leer('src/data/historia.json');
const MINERIA    = leer('src/data/mineria.json');
const CONSTRUCC  = leer('src/data/construccion.json');
const FLORA      = leer('src/data/flora.json');
const FAUNA      = leer('src/data/fauna.json');
const CAZA       = leer('src/data/caza.json');
const GEO        = leer('src/data/geografia.json');

const { RECURSOS, COSECHA_SOTOBOSQUE, normalizar, satisface } =
  await import('file://' + join(RAIZ, 'src/systems/Recursos.js').replace(/\\/g, '/'));

const CAPACIDAD_BASE = 38;   // Inventario.js:11
const VERBOSE = process.argv.includes('--verbose');

// ───────────────────────────────────────────────────────────────────────────
// Registro de hallazgos
// ───────────────────────────────────────────────────────────────────────────
const HALLAZGOS = [];
const anotar = (gravedad, seccion, titulo, numero, detalle) =>
  HALLAZGOS.push({ gravedad, seccion, titulo, numero, detalle });

const AVISOS_PARSER = [];   // lo que el banco no supo leer: se confiesa

// ───────────────────────────────────────────────────────────────────────────
// Pesos: RECURSOS.js + recursosNuevos del dataset revisado
// ───────────────────────────────────────────────────────────────────────────
const PESO = new Map();
for (const [k, v] of Object.entries(RECURSOS)) PESO.set(k, v.kg);
const NUEVOS = new Map();
for (const r of H.recursosNuevos || []) {
  NUEVOS.set(normalizar(r.id), r.kg);
  if (PESO.has(normalizar(r.id))) {
    anotar('menor', 'peso', `recursoNuevo «${r.id}» ya existía en Recursos.js`,
      `${PESO.get(normalizar(r.id))} kg vs ${r.kg} kg`,
      'Dos fichas para el mismo id: la que gane depende del orden de carga.');
  }
  PESO.set(normalizar(r.id), r.kg);
}

const SIN_PESO_PROPIO = new Set();
/** Peso literal de un id. Anota si tuvo que caer en el valor por defecto. */
function pesoLiteral(id) {
  const k = normalizar(id);
  if (PESO.has(k)) return PESO.get(k);
  SIN_PESO_PROPIO.add(k);
  return 0.5;   // el `?? 0.5` de Recursos.pesoDe()
}
/**
 * Peso de un PEDIDO. Un pedido genérico («madera») lo puede satisfacer varios
 * recursos concretos de peso distinto; se devuelve el más liviano (cota
 * optimista: si ni así entra, es imposible) y el más pesado.
 */
const SATISFACEN = new Map();   // pedido -> [recursos concretos que lo cubren]
for (const k of PESO.keys()) {
  for (const p of satisface(k)) {
    if (!SATISFACEN.has(p)) SATISFACEN.set(p, []);
    SATISFACEN.get(p).push(k);
  }
}
function pesoPedido(id) {
  const k = normalizar(id);
  const cands = SATISFACEN.get(k) || [];
  if (!cands.length) { SIN_PESO_PROPIO.add(k); return { min: 0.5, max: 0.5, generico: false }; }
  const pesos = cands.map(pesoLiteral);
  return { min: Math.min(...pesos), max: Math.max(...pesos), generico: cands.length > 1 };
}

// ───────────────────────────────────────────────────────────────────────────
// Parser de los `rinde` en prosa
// ───────────────────────────────────────────────────────────────────────────
const SINONIMOS = {
  fibra: 'fibra', yesca: 'yesca', pinocha: 'pinocha', frutos: 'fruto', fruto: 'fruto',
  hongos: 'hongo', hongo: 'hongo', lena: 'lena', 'piedra suelta': 'piedra', piedra: 'piedra',
  semillas: 'semilla', semilla: 'semilla', plumas: 'pluma', pluma: 'pluma',
  cana: 'cana', junco: 'junco', arena: 'arena', ripio: 'ripio', tosca: 'tosca', pomez: 'pomez',
  carne: 'carne', cuero: 'cuero', hueso: 'hueso', tendon: 'tendon', grasa: 'grasa',
  asta: 'asta', tabla: 'tabla', poste: 'poste', miel: 'miel', cera: 'cera',
  propoleo: 'propoleo', corteza: 'corteza', tronco: 'tronco', arcilla: 'arcilla',
  madera: 'madera', obsidiana: 'obsidiana', pescado: 'pescado', chatarra: 'chatarra',
};
// Frases que declaran algo que NO es un recurso del registro: no son fallos.
const NO_ES_RECURSO = new Set(['hoyos de poste', 'canoa monoxila', 'en cantidad']);

function parseRinde(texto, contexto) {
  if (!texto) return [];
  const crudo = String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const partes = crudo.split(/,| y /).map(s => s.trim()).filter(Boolean);
  const salida = [];
  for (let p of partes) {
    p = p.replace(/\s+en cantidad$/, '').replace(/^de\s+/, '').trim();
    if (!p || NO_ES_RECURSO.has(p)) continue;
    const hit = SINONIMOS[p];
    if (hit) { salida.push(hit); continue; }
    // último intento: primera palabra
    const prim = SINONIMOS[p.split(/\s+/)[0]];
    if (prim) { salida.push(prim); continue; }
    AVISOS_PARSER.push(`${contexto}: no supe leer «${p}» dentro de «${texto}»`);
  }
  return salida;
}

// ───────────────────────────────────────────────────────────────────────────
// FUENTES DE RECURSO
// ───────────────────────────────────────────────────────────────────────────

/** Lo que el CÓDIGO entrega hoy sin ninguna herramienta en la mano. */
function nivel0DelCodigo() {
  const s = new Set();
  // Recoleccion.js → COSECHA_SOTOBOSQUE
  for (const lista of Object.values(COSECHA_SOTOBOSQUE)) for (const c of lista) s.add(normalizar(c.recurso));
  // Recoleccion.js:432-439, extras de la mata de piedra
  s.add('obsidiana'); s.add('arcilla');
  // Recoleccion.js → cosechaDe(flora)
  for (const e of FLORA.especies) {
    if (e.recursoJuego) s.add(normalizar(e.recursoJuego));
    if (e.recursoExtra) s.add(normalizar(e.recursoExtra.recurso));
    if (e.comestible && e.parteComestible) {
      const parte = normalizar(e.parteComestible);
      if (parte === 'fruto') s.add('fruto');
      if (parte === 'semilla') s.add('semilla');
    }
  }
  s.add('agua');       // Recoleccion.js caso 'beber'
  s.add('chatarra');   // Mineria.recuperarChatarra: no pide herramienta
  // Recoleccion.js:420 → caza.aprovechar({fuenteId:'presa_puma'}), sin compuerta de herramienta
  for (const c of CAZA.carronia.fuentes.find(f => f.id === 'presa_puma').rinde) s.add(normalizar(c.recurso));
  return s;
}

/** Lo que el DATASET promete para nivel 0 (juntar_suelto + los sinHerramienta). */
function nivel0DelDataset() {
  const s = new Set();
  for (const a of H.acciones) {
    if (a.nivelMinimo === 0 && typeof a.rinde === 'string') {
      for (const r of parseRinde(a.rinde, `accion ${a.id}`)) s.add(r);
    }
    if (a.sinHerramienta?.rinde) {
      const r = a.sinHerramienta.rinde;
      if (Array.isArray(r)) for (const x of r) s.add(normalizar(x.recurso));
      else for (const x of parseRinde(r, `accion ${a.id}.sinHerramienta`)) s.add(x);
    }
  }
  s.add('agua'); s.add('chatarra');
  return s;
}

/** Lo que Mineria.js entrega abriendo cantera (yacimientos de _resolverFrente). */
const RINDE_CANTERA = new Set(['pomez', 'arena', 'ripio', 'tosca', 'piedra']);

/** accion.id -> recursos que entrega CON herramienta. */
const RINDE_ACCION = new Map();
for (const a of H.acciones) {
  const out = new Set();
  const conH = a.conHerramienta?.rinde;
  if (Array.isArray(conH)) for (const x of conH) out.add(normalizar(x.recurso));
  else if (typeof conH === 'string') for (const r of parseRinde(conH, `accion ${a.id}.conHerramienta`)) out.add(r);
  if (typeof a.rinde === 'string') for (const r of parseRinde(a.rinde, `accion ${a.id}.rinde`)) out.add(r);
  // Las acciones de caza y pesca entregan a través de otros datasets
  if (a.id === 'pescar' || a.id === 'fijar' || a.id === 'trampear_pez') out.add('pescado');
  if (a.id === 'trampear') { out.add('carne'); out.add('cuero'); out.add('hueso'); }
  if (a.id === 'descuerar') for (const f of CAZA.carronia.fuentes) for (const c of f.rinde) out.add(normalizar(c.recurso));
  RINDE_ACCION.set(a.id, out);
}

// ───────────────────────────────────────────────────────────────────────────
// TECNOLOGÍAS (historia.json + tecnologiasNuevas)
// ───────────────────────────────────────────────────────────────────────────
const TECS = new Map();
for (const t of HISTORIA.tecnologias) TECS.set(t.id, { ...t, origen: 'historia' });
for (const t of H.tecnologiasNuevas || []) {
  if (TECS.has(t.id)) anotar('media', 'tecnologia', `tecnologiaNueva «${t.id}» ya existe en historia.json`, '', 'Choque de id.');
  TECS.set(t.id, { ...t, origen: 'herramientas' });
}
// Tecnologías citadas por objetos que no existen en ningún lado
for (const o of H.objetos) {
  if (o.tecnologia && !TECS.has(o.tecnologia)) {
    anotar('grave', 'tecnologia', `objeto «${o.id}» cuelga de una tecnología inexistente`,
      o.tecnologia, 'No hay nodo con ese id ni en historia.json ni en tecnologiasNuevas.');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PRODUCTORES: quién entrega cada recurso y a qué costo
// ───────────────────────────────────────────────────────────────────────────
const OBJETOS = new Map(H.objetos.map(o => [o.id, o]));

/** Recetas de horno (mineria.json) y de obra (construccion.json). */
const RECETAS_HORNO = (MINERIA.recetas || []).map(r => ({
  id: r.id, tipo: 'horno', estacion: r.horno,
  entra: r.entra || [], sale: r.sale || [],
}));
const RECETAS_OBRA = (CONSTRUCC.recetas || []).map(r => ({
  id: r.id, tipo: 'obra', estacion: r.obra,
  entra: r.entra || [], sale: r.sale || [],
}));
const OBRAS = new Map((CONSTRUCC.obras || []).map(o => [o.id, o]));
const HORNOS = new Map((MINERIA.hornos || []).map(o => [o.id, o]));
for (const o of H.obrasNuevas || []) OBRAS.set(o.id, o);

// Techo de carga: bolso base + todo lo que suba capacidad
const BONOS = H.objetos.filter(o => o.efecto?.capacidadExtraKg)
  .map(o => ({ id: o.id, kg: o.efecto.capacidadExtraKg }));
const TECHO_MAX = CAPACIDAD_BASE + BONOS.reduce((a, b) => a + b.kg, 0);

// Qué objeto de mano da qué nivel de herramienta
const NIVEL_DE_OBJETO = new Map();
for (const o of H.objetos) if (o.ranura === 'mano' || o.categoria === 'herramienta') NIVEL_DE_OBJETO.set(o.id, o.nivel);

// ───────────────────────────────────────────────────────────────────────────
// CIERRE TRANSITIVO
// ───────────────────────────────────────────────────────────────────────────
/**
 * @param {Set<string>} base recursos que se consiguen con las manos vacías
 * @param {object} opts
 *   - conArbol: si false, el mundo ignora herramientas.json entero (el juego de hoy)
 *   - estricto: respeta requiereHerramienta
 */
function cierre(base, { estricto = true, conArbol = true } = {}) {
  const OBJS   = conArbol ? H.objetos : [];
  const TECLST = conArbol ? [...TECS.values()] : HISTORIA.tecnologias;
  const OBRASW = conArbol ? OBRAS : new Map((CONSTRUCC.obras || []).map(o => [o.id, o]));
  const recursos = new Set(base);
  const objetos  = new Set();
  const tecs     = new Set();
  const acciones = new Set(conArbol ? H.acciones.filter(a => a.nivelMinimo === 0).map(a => a.id) : []);
  const estaciones = new Set(['bolso']);
  let nivel = 0;

  const hay = (pedido) => {
    const p = normalizar(pedido);
    if (recursos.has(p)) return true;
    for (const r of recursos) if (satisface(r).includes(p)) return true;
    return false;
  };
  const todos = (mats) => (mats || []).every(m => hay(m.recurso));

  // Primera aparición: en qué nivel de herramienta se consigue cada cosa.
  const nivelDe = new Map();
  for (const r of base) nivelDe.set(r, 0);

  // Escalera: se agota el punto fijo con el nivel actual ANTES de subir. Sin
  // esto, un objeto de nivel 3 parece alcanzable en la misma pasada en que se
  // fabricó el hacha, y el banco pierde la capacidad de decir "esto está mal
  // etiquetado".
  let cap = 0, vueltas = 0;
  const marca = (m, k) => { if (!m.has(k)) m.set(k, cap); };
  const nivelObjeto = new Map();
  const addRec = (r) => { const k = normalizar(r); if (recursos.has(k)) return false; recursos.add(k); marca(nivelDe, k); return true; };

  for (cap = 0; cap <= 4; cap++) {
    let cambio = true;
    while (cambio && vueltas < 400) {
      cambio = false; vueltas++;

      // 1. Tecnologías: prerequisitos aprendidos + materiales conseguibles
      for (const t of TECLST) {
        if (tecs.has(t.id)) continue;
        if (!(t.requiere || []).every(r => tecs.has(r))) continue;
        if (!todos(t.materiales)) continue;
        tecs.add(t.id); cambio = true;
      }

      // 2. Estaciones
      for (const [id, h] of HORNOS) {
        if (estaciones.has(id)) continue;
        if (todos(h.materiales)) { estaciones.add(id); cambio = true; }
      }
      for (const [id, o] of OBRASW) {
        if (estaciones.has(id)) continue;
        if (o.tecnologia && !tecs.has(o.tecnologia)) continue;
        if (todos(o.materiales)) { estaciones.add(id); cambio = true; }
      }

      // 2b. Cantera: hoy Mineria.js pide `disponiblePara('herramienta')>0` (un
      //     asta suelta alcanza); con el árbol, nivel 3 en la mano.
      const puedeCantera = conArbol ? nivel >= 3 : (recursos.has('asta') || recursos.has('herramienta'));
      if (puedeCantera) for (const r of RINDE_CANTERA) if (addRec(r)) cambio = true;

      // 3. Objetos fabricables
      for (const o of OBJS) {
        if (objetos.has(o.id)) continue;
        if (o.tecnologia && !tecs.has(o.tecnologia)) continue;
        if (o.donde && o.donde !== 'bolso' && !estaciones.has(o.donde)) continue;
        if (estricto && (o.requiereHerramienta || 0) > nivel) continue;
        // Una herramienta de nivel N sólo se puede fabricar cuando la escalera
        // llegó a N-1: si no, "fabricar el hacha" sería anterior a tener filo.
        const n = NIVEL_DE_OBJETO.get(o.id);
        if (n != null && n > cap) continue;
        if (!todos(o.materiales)) continue;
        objetos.add(o.id); marca(nivelObjeto, o.id); cambio = true;
        for (const p of o.produce || []) addRec(p.recurso);
        for (const a of o.habilita || []) acciones.add(a);
        if (n != null && n > nivel) nivel = n;
      }

      // 4. Acciones habilitadas → recursos  (sólo si el árbol está implementado)
      if (conArbol) {
        for (const id of acciones) {
          for (const r of RINDE_ACCION.get(id) || []) if (addRec(r)) cambio = true;
        }
        // acciones que sólo piden nivel de herramienta, sin `habilita` explícito
        for (const a of H.acciones) {
          if (acciones.has(a.id)) continue;
          if ((a.nivelMinimo ?? 0) <= nivel) { acciones.add(a.id); cambio = true; }
        }
      }

      // 5. Recetas de horno / obra
      for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) {
        if (!estaciones.has(r.estacion)) continue;
        if (!todos(r.entra)) continue;
        for (const s of r.sale) if (addRec(s.recurso)) cambio = true;
      }
      // 6. Obras que procesan (colmenas)
      for (const o of OBRASW.values()) {
        if (!o.procesa || !estaciones.has(o.id)) continue;
        for (const p of o.produce || []) if (addRec(p.recurso)) cambio = true;
      }
    }
  }
  const nivelRecurso = (pedido) => {
    const p = normalizar(pedido);
    let mejor = Infinity;
    for (const [r, n] of nivelDe) if (satisface(r).includes(p)) mejor = Math.min(mejor, n);
    return mejor;
  };
  return { recursos, objetos, tecs, acciones, estaciones, nivel, vueltas, hay, nivelDe, nivelObjeto, nivelRecurso };
}

// ───────────────────────────────────────────────────────────────────────────
// SALIDA
// ───────────────────────────────────────────────────────────────────────────
const L = [];
const say = (s = '') => { L.push(s); console.log(s); };
const bloque = (t) => { say(''); say('═'.repeat(74)); say(t); say('═'.repeat(74)); };

bloque('0 · DE DÓNDE SALE CADA RECURSO');

const base0Codigo  = nivel0DelCodigo();
const base0Dataset = nivel0DelDataset();
say(`nivel 0 según el CÓDIGO   (${base0Codigo.size}): ${[...base0Codigo].sort().join(', ')}`);
say(`nivel 0 según el DATASET  (${base0Dataset.size}): ${[...base0Dataset].sort().join(', ')}`);
const soloDataset = [...base0Dataset].filter(r => !base0Codigo.has(r));
const soloCodigo  = [...base0Codigo].filter(r => !base0Dataset.has(r));
say(`prometidos por el dataset y SIN fuente en el código: ${soloDataset.join(', ') || '—'}`);
say(`entregados por el código y no declarados en el dataset: ${soloCodigo.join(', ') || '—'}`);
if (soloDataset.length) {
  anotar('grave', 'alcanzabilidad', 'Recursos que el dataset declara de nivel 0 y el código no entrega',
    soloDataset.join(', '),
    'juntar_suelto promete estos recursos, pero ni COSECHA_SOTOBOSQUE ni cosechaDe(flora) ni ningún sistema los produce hoy.');
}

// Recursos citados por alguna receta y sin ningún productor en todo el juego
const PEDIDOS = new Set();
const anotaPedidos = (mats, quien) => { for (const m of mats || []) PEDIDOS.add(normalizar(m.recurso)); };
for (const o of H.objetos) anotaPedidos(o.materiales, o.id);
for (const t of TECS.values()) anotaPedidos(t.materiales, t.id);
for (const o of OBRAS.values()) anotaPedidos(o.materiales, o.id);
for (const h of HORNOS.values()) anotaPedidos(h.materiales, h.id);
for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) anotaPedidos(r.entra, r.id);

bloque('1 · ALCANZABILIDAD DESDE CERO (cierre transitivo)');

// ── Mundo A: el juego de HOY, sin implementar herramientas.json ────────────
const cHoy = cierre(base0Codigo, { conArbol: false });
say('');
say(`── mundo A «HOY» (herramientas.json sin implementar) ──`);
say(`   recursos alcanzables: ${cHoy.recursos.size} · tecnologías ${cHoy.tecs.size}/${HISTORIA.tecnologias.length}`);
const sinFuenteHoy = [...PEDIDOS].filter(p => !cHoy.hay(p));
say(`   materiales que alguna receta pide y HOY nada produce (${sinFuenteHoy.length}):`);
say(`   ${sinFuenteHoy.join(', ')}`);

// ── Mundo B: el árbol implementado, respetando SUS PROPIAS compuertas ──────
// El dataset dice que cuero, tendón, grasa y caña piden nivel 1. Si eso se
// implementa, dejan de ser de nivel 0 aunque hoy el código los regale.
const GATEADOS_POR_DATASET = ['cuero', 'tendon', 'grasa', 'cana'];
const baseB = new Set([...base0Codigo].filter(r => !GATEADOS_POR_DATASET.includes(r)));
for (const r of base0Dataset) baseB.add(r);   // lo que el dataset promete de nivel 0
// hongo/pluma/miel se dejan porque el dataset los promete: si el cierre depende
// de ellos, el informe tiene que decir que dependen de una promesa sin código.
const cArbol = cierre(baseB);
say('');
say(`── mundo B «ÁRBOL IMPLEMENTADO» ── punto fijo en ${cArbol.vueltas} vueltas · nivel de herramienta alcanzado: ${cArbol.nivel}`);
say(`   base de nivel 0 (${baseB.size}): ${[...baseB].sort().join(', ')}`);
say(`   objetos alcanzables ${cArbol.objetos.size}/${H.objetos.length} · tecnologías ${cArbol.tecs.size}/${TECS.size}`);
say(`   estaciones que se levantan: ${[...cArbol.estaciones].join(', ')}`);
const fueraB = H.objetos.filter(o => !cArbol.objetos.has(o.id));
if (!fueraB.length) say('   TODO el árbol entra en el cierre.');
for (const o of fueraB) {
  const falta = (o.materiales || []).filter(m => !cArbol.hay(m.recurso)).map(m => m.recurso);
  const razones = [];
  if (o.tecnologia && !cArbol.tecs.has(o.tecnologia)) razones.push(`tecnología «${o.tecnologia}» no alcanzable`);
  if (o.donde && o.donde !== 'bolso' && !cArbol.estaciones.has(o.donde)) razones.push(`estación «${o.donde}» no se levanta`);
  if (falta.length) razones.push(`material sin fuente: ${falta.join(', ')}`);
  if ((o.requiereHerramienta || 0) > cArbol.nivel) razones.push(`pide herramienta nivel ${o.requiereHerramienta}`);
  say(`   ✗ ${o.id.padEnd(20)} n${o.nivel} — ${razones.join(' | ') || 'sin causa identificada (revisar el banco)'}`);
  anotar('critica', 'alcanzabilidad', `objeto fuera del cierre: ${o.id}`, `nivel ${o.nivel}`, razones.join(' | '));
}
const tecsFueraB = [...TECS.values()].filter(t => !cArbol.tecs.has(t.id));
say(`   tecnologías fuera del cierre (${tecsFueraB.length}): ${tecsFueraB.map(t => t.id).join(', ')}`);
const nuevasFuera = (H.tecnologiasNuevas || []).filter(t => !cArbol.tecs.has(t.id));
for (const t of nuevasFuera) {
  const falta = (t.materiales || []).filter(m => !cArbol.hay(m.recurso)).map(m => m.recurso);
  anotar('critica', 'alcanzabilidad', `tecnología nueva fuera del cierre: ${t.id}`,
    falta.join(', ') || 'prerequisitos', `requiere: ${(t.requiere || []).join(', ')}`);
}

// ── Mundo C: sólo lo que el DATASET declara, sin apoyarse en el código ─────
const cSolo = cierre(base0Dataset);
say('');
say(`── mundo C «SÓLO LO QUE EL DATASET DECLARA» ── nivel alcanzado ${cSolo.nivel}, objetos ${cSolo.objetos.size}/${H.objetos.length}`);
const nuncaDeclarados = ['madera', 'madera_dura', 'obsidiana', 'resina', 'cana', 'cuero', 'tendon', 'grasa', 'lana', 'junco']
  .filter(r => !base0Dataset.has(r) && ![...RINDE_ACCION.values()].some(s => s.has(r)));
say(`   recursos que el dataset USA y nunca dice de dónde salen: ${nuncaDeclarados.join(', ') || '—'}`);
if (nuncaDeclarados.length) anotar('grave', 'alcanzabilidad',
  'el dataset no declara la fuente de materiales que él mismo pide', nuncaDeclarados.join(', '),
  'Ninguna acción de las 29 los lista en `rinde`; sólo existen porque Recoleccion.js/flora.json ya los daban.');

globalThis.__cierreDataset = cArbol;

// Recursos pedidos sin ningún productor
const cDataset = cArbol;
const huerfanos = [...PEDIDOS].filter(p => !cDataset.hay(p));
say('');
say(`materiales pedidos por alguna receta y sin fuente en el cierre DATASET (${huerfanos.length}): ${huerfanos.join(', ') || '—'}`);
let huerfanosNuevos = 0, huerfanosViejos = 0;
for (const h of huerfanos) {
  const deEsteArchivo = [
    ...H.objetos.filter(o => (o.materiales || []).some(m => normalizar(m.recurso) === h)).map(o => 'obj:' + o.id),
    ...(H.tecnologiasNuevas || []).filter(t => (t.materiales || []).some(m => normalizar(m.recurso) === h)).map(t => 'tecNueva:' + t.id),
    ...(H.obrasNuevas || []).filter(o => (o.materiales || []).some(m => normalizar(m.recurso) === h)).map(o => 'obraNueva:' + o.id),
  ];
  const preexistentes = [
    ...HISTORIA.tecnologias.filter(t => (t.materiales || []).some(m => normalizar(m.recurso) === h)).map(t => 'tec:' + t.id),
    ...(CONSTRUCC.obras || []).filter(o => (o.materiales || []).some(m => normalizar(m.recurso) === h)).map(o => 'obra:' + o.id),
  ];
  if (deEsteArchivo.length) {
    huerfanosNuevos++;
    anotar('critica', 'alcanzabilidad', `material «${h}» no lo produce nada y ESTE archivo lo pide`,
      `${deEsteArchivo.length} recetas nuevas`, deEsteArchivo.join(', ') + (preexistentes.length ? ` | ya lo pedían: ${preexistentes.join(', ')}` : ''));
  } else {
    huerfanosViejos++;
  }
}
say(`   de esos, ${huerfanosNuevos} los pide ESTE archivo; ${huerfanosViejos} ya estaban huérfanos antes (plata, bronce, reactor…)`);
anotar('menor', 'alcanzabilidad', 'materiales huérfanos preexistentes (no los trae este archivo)',
  `${huerfanosViejos} materiales`, 'Saberes.estado() ya los marca `inalcanzable`; quedan fuera del alcance de esta revisión.');

bloque('2 · CANDADOS CIRCULARES');

// Grafo: objeto -> materiales -> objetos/recetas que los producen.
const PRODUCTORES = new Map();   // recurso -> [nodo]
const addProd = (rec, nodo) => {
  const k = normalizar(rec);
  if (!PRODUCTORES.has(k)) PRODUCTORES.set(k, []);
  PRODUCTORES.get(k).push(nodo);
};
for (const o of H.objetos) for (const p of o.produce || []) addProd(p.recurso, 'obj:' + o.id);
for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) for (const s of r.sale) addProd(s.recurso, 'rec:' + r.id);
for (const o of OBRAS.values()) if (o.procesa) for (const p of o.produce || []) addProd(p.recurso, 'obra:' + o.id);
// Fuentes del mundo (acciones): rompen ciclos
const DEL_MUNDO = new Set([...base0Dataset]);
for (const [aid, rs] of RINDE_ACCION) for (const r of rs) DEL_MUNDO.add(r);

// Nodos = objetos + recetas + obras; arista A→B si A necesita un material cuyo
// ÚNICO camino de producción pasa por B (material que no sale del mundo).
const NODOS = new Map();
const registrar = (id, mats, herr) => NODOS.set(id, { mats: (mats || []).map(m => normalizar(m.recurso)), herr });
for (const o of H.objetos) registrar('obj:' + o.id, o.materiales, o.habilita || []);
for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) registrar('rec:' + r.id, r.entra, []);
for (const [id, o] of OBRAS) registrar('obra:' + id, o.materiales, []);
for (const [id, h] of HORNOS) registrar('horno:' + id, h.materiales, []);

const ARISTAS = new Map();
for (const [id, n] of NODOS) {
  const dst = new Set();
  for (const m of n.mats) {
    // Si el material sale del mundo por alguna acción/nivel 0, no hay dependencia dura
    let cubierto = false;
    for (const w of DEL_MUNDO) if (satisface(w).includes(m)) { cubierto = true; break; }
    if (cubierto) continue;
    for (const p of PRODUCTORES.get(m) || []) dst.add(p);
  }
  ARISTAS.set(id, [...dst]);
}

// Tarjan
function tarjan(nodos, aristas) {
  let idx = 0; const ind = new Map(), low = new Map(), enPila = new Set(), pila = [], sccs = [];
  const fuerte = (v) => {
    ind.set(v, idx); low.set(v, idx); idx++; pila.push(v); enPila.add(v);
    for (const w of aristas.get(v) || []) {
      if (!ind.has(w)) { fuerte(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (enPila.has(w)) low.set(v, Math.min(low.get(v), ind.get(w)));
    }
    if (low.get(v) === ind.get(v)) {
      const c = []; let w;
      do { w = pila.pop(); enPila.delete(w); c.push(w); } while (w !== v);
      sccs.push(c);
    }
  };
  for (const v of nodos) if (!ind.has(v)) fuerte(v);
  return sccs;
}
const sccs = tarjan([...NODOS.keys()], ARISTAS).filter(c => c.length > 1 ||
  (ARISTAS.get(c[0]) || []).includes(c[0]));
if (!sccs.length) say('No hay ciclos de producción entre objetos/recetas.');
for (const c of sccs) {
  say(`⚠ CICLO: ${c.join(' ↔ ')}`);
  anotar('critica', 'candado', 'ciclo de producción', c.length + ' nodos', c.join(' ↔ '));
}

// Candado de HERRAMIENTA: un objeto cuyo material sólo lo entrega una acción que
// ese mismo objeto (o un descendiente suyo) habilita.
const HABILITADO_POR = new Map();   // accion -> [objeto]
for (const o of H.objetos) for (const a of o.habilita || []) {
  if (!HABILITADO_POR.has(a)) HABILITADO_POR.set(a, []);
  HABILITADO_POR.get(a).push(o.id);
}
say('');
say('Candados de herramienta (material que sólo llega por una acción que el propio objeto habilita):');
let candados = 0;
for (const o of H.objetos) {
  for (const m of o.materiales || []) {
    const k = normalizar(m.recurso);
    if (base0Dataset.has(k) || (PRODUCTORES.get(k) || []).length) continue;
    const fuentes = [...RINDE_ACCION].filter(([, rs]) => rs.has(k)).map(([a]) => a);
    if (!fuentes.length) continue;
    const objetosFuente = new Set(fuentes.flatMap(a => HABILITADO_POR.get(a) || []));
    if (objetosFuente.size === 1 && objetosFuente.has(o.id)) {
      say(`⚠ ${o.id} pide «${k}» y la única acción que lo da (${fuentes.join('/')}) la habilita él mismo`);
      anotar('critica', 'candado', `candado de herramienta en ${o.id}`, k, `acciones: ${fuentes.join(', ')}`);
      candados++;
    }
  }
}
if (!candados) say('   ninguno.');

// ── Nivel declarado vs nivel que el material realmente exige ───────────────
say('');
say('Objetos cuyo `nivel` declarado no coincide con el nivel que sus materiales exigen:');
let mal = 0;
for (const o of H.objetos) {
  if (!cArbol.objetos.has(o.id)) continue;
  const real = cArbol.nivelObjeto.get(o.id);
  if (real == null) continue;
  if (real === o.nivel) continue;
  const culpables = (o.materiales || [])
    .map(m => ({ r: normalizar(m.recurso), n: cArbol.nivelRecurso(m.recurso) }))
    .filter(x => x.n > o.nivel)
    .map(x => `${x.r}(n${x.n})`);
  say(`  ${real > o.nivel ? '✗' : '·'} ${o.id.padEnd(20)} declara n${o.nivel}, la cadena lo pone en n${real}${culpables.length ? ' — por ' + culpables.join(', ') : ''}`);
  if (real > o.nivel) {
    mal++;
    anotar('grave', 'curva', `«${o.id}» está etiquetado por debajo de lo que cuesta`,
      `declara nivel ${o.nivel}, alcanzable recién en nivel ${real}`, culpables.join(', '));
  }
}
if (!mal) say('   ninguno por encima de su etiqueta.');

// ── Sensibilidad: prohibir un recurso y contar qué se derrumba ─────────────
// Es la única forma honesta de saber de qué depende el árbol: si prohibir un
// material no cambia nada, ese material no era una compuerta.
say('');
say('Criticidad — se prohíbe un recurso y se cuenta cuántos de los 57 objetos caen:');
const banear = (recurso) => {
  const b = new Set([...baseB]); b.delete(recurso);
  const guardaRinde = new Map();
  for (const [k, v] of RINDE_ACCION) { guardaRinde.set(k, new Set(v)); v.delete(recurso); }
  const guardaProd = [];
  for (const o of [...H.objetos, ...OBRAS.values()]) if ((o.produce || []).some(p => normalizar(p.recurso) === recurso)) {
    guardaProd.push([o, o.produce]); o.produce = o.produce.filter(p => normalizar(p.recurso) !== recurso);
  }
  const guardaRecetas = [];
  for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) if (r.sale.some(s => normalizar(s.recurso) === recurso)) {
    guardaRecetas.push([r, r.sale]); r.sale = r.sale.filter(s => normalizar(s.recurso) !== recurso);
  }
  const teniaCantera = RINDE_CANTERA.delete(recurso);
  const c = cierre(b);
  for (const [k, v] of guardaRinde) RINDE_ACCION.set(k, v);
  for (const [o, p] of guardaProd) o.produce = p;
  for (const [r, s] of guardaRecetas) r.sale = s;
  if (teniaCantera) RINDE_CANTERA.add(recurso);
  return c;
};
const CANDIDATOS = ['pluma', 'lana', 'asta', 'hueso', 'obsidiana', 'cuero', 'arena', 'miel', 'cera', 'chatarra', 'arcilla', 'resina', 'hongo', 'tendon'];
const criticidad = [];
for (const r of CANDIDATOS) {
  const c = banear(r);
  const caen = H.objetos.filter(o => cArbol.objetos.has(o.id) && !c.objetos.has(o.id));
  criticidad.push({ r, n: caen.length, caen: caen.map(o => o.id), nivel: c.nivel });
}
criticidad.sort((a, b) => b.n - a.n);
for (const c of criticidad) {
  say(`   sin «${c.r}»: caen ${String(c.n).padStart(2)} objetos, techo de herramienta n${c.nivel}${c.n && c.n <= 8 ? ' — ' + c.caen.join(', ') : ''}`);
}
// Los que HOY no tienen fuente en el código y sin embargo son compuerta
const HOY_SIN_FUENTE = new Set(sinFuenteHoy);
for (const c of criticidad) {
  if (c.n > 0 && HOY_SIN_FUENTE.has(c.r)) {
    anotar('critica', 'alcanzabilidad',
      `«${c.r}» es compuerta de ${c.n} objetos y HOY no lo produce nada`,
      `${c.n}/57 objetos caen sin él`,
      `caen: ${c.caen.join(', ')}`);
  }
}

// ── Sensibilidad: sacar la equivalencia madera_dura → tronco ───────────────
// El propio archivo lo manda en engancheAlCodigo.Recursos.js.
say('');
say('Sensibilidad — sacando la equivalencia madera_dura → tronco (lo pide el propio archivo):');
const troncoPorEquivalencia = H.objetos.concat([...OBRAS.values()], [...TECS.values()])
  .filter(x => (x.materiales || []).some(m => normalizar(m.recurso) === 'tronco'));
say(`   piden «tronco» ${troncoPorEquivalencia.length} recetas: ${troncoPorEquivalencia.map(x => x.id).join(', ')}`);
say(`   nivel al que la cadena entrega tronco de verdad (acción trozar/talar): n${cArbol.nivelRecurso('tronco')}`);
const pesoTroncoReal = (mats) => (mats || []).reduce((a, m) => a + (normalizar(m.recurso) === 'tronco' ? 6.0 : pesoPedido(m.recurso).min) * m.cantidad, 0);
for (const x of troncoPorEquivalencia) {
  const kg = +pesoTroncoReal(x.materiales).toFixed(2);
  if (kg > CAPACIDAD_BASE) {
    say(`   ! ${x.id}: ${kg} kg con tronco a 6,0 kg (antes ${(+ (x.materiales || []).reduce((a, m) => a + pesoPedido(m.recurso).min * m.cantidad, 0)).toFixed(2)} kg con la equivalencia puesta)`);
    anotar(kg > TECHO_MAX ? 'critica' : 'grave', 'peso',
      `${x.id} deja de entrar en el bolso cuando se saca la equivalencia madera_dura→tronco`,
      `${kg} kg`, 'engancheAlCodigo.Recursos.js manda sacarla en el mismo commit que agregue `trozar`.');
  }
}

bloque('3 · PRESUPUESTO DE PESO (bolso 38 kg)');

say(`bonos de capacidad: ${BONOS.map(b => `${b.id} +${b.kg}`).join(', ')}  →  techo teórico ${TECHO_MAX} kg`);
say('(rastra: `requiereSuelo` y penaliza pendiente — no siempre disponible)');
say('');

const recetasPesadas = [];
const evaluarPeso = (id, clase, mats, extra = '') => {
  if (!mats || !mats.length) return;
  let min = 0, max = 0; const desglose = [];
  for (const m of mats) {
    const p = pesoPedido(m.recurso);
    min += p.min * m.cantidad; max += p.max * m.cantidad;
    desglose.push(`${m.cantidad}×${normalizar(m.recurso)}@${p.min}${p.generico ? `-${p.max}` : ''}`);
  }
  recetasPesadas.push({ id, clase, min: +min.toFixed(2), max: +max.toFixed(2), desglose: desglose.join(' + '), extra, nuevo: extra === 'nuevo' });
};
for (const o of H.objetos) evaluarPeso(o.id, 'objeto', o.materiales, 'nuevo');
for (const t of TECS.values()) evaluarPeso(t.id, 'tecnologia', t.materiales, t.origen === 'herramientas' ? 'nuevo' : '');
for (const [id, o] of OBRAS) evaluarPeso(id, 'obra', o.materiales, (H.obrasNuevas || []).some(x => x.id === id) ? 'nuevo' : '');
for (const [id, h] of HORNOS) evaluarPeso(id, 'horno', h.materiales);
for (const r of [...RECETAS_HORNO, ...RECETAS_OBRA]) evaluarPeso(r.id, 'receta', r.entra);

recetasPesadas.sort((a, b) => b.min - a.min);
const imposibles = recetasPesadas.filter(r => r.min > TECHO_MAX);
const dosViajes  = recetasPesadas.filter(r => r.min > CAPACIDAD_BASE && r.min <= TECHO_MAX);
const alFilo     = recetasPesadas.filter(r => r.min <= CAPACIDAD_BASE && r.max > CAPACIDAD_BASE);

say(`IMPOSIBLES (ni con todos los contenedores, ${TECHO_MAX} kg): ${imposibles.length}`);
for (const r of imposibles) { say(`  ✗ ${r.clase}/${r.id}: ${r.min} kg — ${r.desglose}`); anotar('critica', 'peso', `${r.clase} ${r.id} no entra ni con todos los contenedores`, `${r.min} kg > ${TECHO_MAX} kg`, r.desglose); }
say(`OBLIGAN A MÁS DE UN VIAJE (>${CAPACIDAD_BASE} kg de bolso base): ${dosViajes.length}`);
for (const r of dosViajes) { say(`  ! ${r.clase}/${r.id}: ${r.min} kg — ${r.desglose}`); anotar('grave', 'peso', `${r.clase} ${r.id} no entra en el bolso base`, `${r.min} kg > 38 kg`, r.desglose); }
say(`AL FILO (entra con el material liviano, no con el pesado): ${alFilo.length}`);
for (const r of alFilo) say(`  ~ ${r.clase}/${r.id}: ${r.min}–${r.max} kg — ${r.desglose}`);
say('');
say('Top 10 por peso mínimo:');
for (const r of recetasPesadas.slice(0, 10)) say(`   ${String(r.min).padStart(6)} kg  ${r.clase}/${r.id}${r.nuevo ? '  ← DE ESTE ARCHIVO' : ''}`);
say('');
const nuevasPes = recetasPesadas.filter(r => r.nuevo);
say(`Recetas que agrega ESTE archivo (${nuevasPes.length}) — la más pesada:`);
for (const r of nuevasPes.slice(0, 6)) say(`   ${String(r.min).padStart(6)} kg  ${r.clase}/${r.id} — ${r.desglose}`);
say(`   ninguna de este archivo pasa de ${Math.max(...nuevasPes.map(r => r.min))} kg: el problema de peso es PREEXISTENTE, no lo trae este dataset.`);
// Pero: un objeto de este archivo se fabrica DESPUÉS de juntar sus materiales,
// y el bolso tiene que sostener también lo que ya se lleva puesto.
const objsPes = recetasPesadas.filter(r => r.clase === 'objeto').sort((a, b) => b.min - a.min);
say('');
say('Objetos del archivo por peso de materiales (top 8):');
for (const r of objsPes.slice(0, 8)) say(`   ${String(r.min).padStart(6)} kg  ${r.id} — ${r.desglose}`);

// ── El agujero de fondo: los objetos no pesan ──────────────────────────────
say('');
const conKg = H.objetos.filter(o => o.kg != null || o.peso != null || o.pesoKg != null);
say(`objetos con peso declarado: ${conKg.length} de ${H.objetos.length}`);
if (conKg.length < H.objetos.length) {
  // Cuánto pesaría un equipo de nivel 4 si se le diera el peso de su análogo real
  const kit = ['hacha_hierro', 'sierra', 'martillo', 'pico_hierro', 'pala_hierro', 'barreta'];
  const kitKg = kit.map(id => ({ id, kg: +(OBJETOS.get(id).materiales.reduce((a, m) => a + pesoPedido(m.recurso).min * m.cantidad, 0)).toFixed(2) }));
  say(`   Inventario.js limita por PESO (${CAPACIDAD_BASE} kg) y ninguno de los ${H.objetos.length} objetos declara kg.`);
  say(`   Si un objeto pesara lo que pesan sus materiales, el juego de herramientas de hierro (${kit.join(', ')})`);
  say(`   sumaría ${kitKg.reduce((a, x) => a + x.kg, 0).toFixed(2)} kg — el ${((kitKg.reduce((a, x) => a + x.kg, 0) / CAPACIDAD_BASE) * 100).toFixed(0)} % del bolso, sin contar un solo material.`);
  say(`   ${kitKg.map(x => `${x.id} ${x.kg}`).join(' · ')}`);
  anotar('grave', 'peso', 'ninguno de los 57 objetos declara peso',
    `0/${H.objetos.length} con kg`,
    `El bolso limita por kg, no por casilleros (Inventario.js:11,18-22). Sin kg por objeto, Fabricacion.js no puede decidir si el hacha entra, y las cuatro ranuras (mano/arma/abrigo/espalda) cargarían gratis. Un juego de hierro pesaría ~${kitKg.reduce((a, x) => a + x.kg, 0).toFixed(0)} kg si se le diera el peso de sus materiales.`);
}

if (SIN_PESO_PROPIO.size) {
  say('');
  say(`⚠ materiales sin ficha de peso (cayeron en el 0,5 kg por defecto): ${[...SIN_PESO_PROPIO].join(', ')}`);
  anotar('grave', 'peso', 'materiales sin peso declarado', [...SIN_PESO_PROPIO].join(', '),
    'Recursos.pesoDe() les asigna 0,5 kg por omisión: cualquier cuenta de peso sobre ellos es una invención.');
}

bloque('4 · COSTO DE SABER');

// Puntos que el juego reparte una sola vez
const puntosFlora = FLORA.especies.reduce((a, e) =>
  a + 2 + (['CR', 'EN', 'VU'].includes(e.estadoConservacion) ? 4 : 0), 0);
const puntosFauna = FAUNA.especies.reduce((a, e) =>
  a + 2 + (['CR', 'EN', 'VU'].includes(e.estadoConservacion) ? 4 : 0), 0);
const lugaresCrudos = (GEO.cerros || []).length + (GEO.geologia?.volcanes || []).length
  + (GEO.geologia?.glaciares || []).length + (GEO.hidrologia?.lagos || []).length
  + (HISTORIA.sitios || []).length;
const puntosLugares = lugaresCrudos * 3;   // main.js:450 — nunca usa PUNTOS.cumbre (6)
const POOL = puntosFlora + puntosFauna + puntosLugares;

say(`flora  : ${FLORA.especies.length} especies × 2 = ${puntosFlora}  (ninguna tiene estadoConservacion → el +4 nunca se aplica)`);
say(`fauna  : ${FAUNA.especies.length} especies → ${puntosFauna}  (2 base, +4 en las 8 CR/EN/VU)`);
say(`lugares: ${lugaresCrudos} accidentes × 3 = ${puntosLugares}  (cota ALTA: Codice fusiona duplicados y descarta los de fuera del mundo)`);
say(`POOL de una sola vez = ${POOL} puntos`);
say('(hay fuentes repetibles: pesca +5/+3/+2, obra +4, hornada +3, restos +1 — pero todas piden herramientas que el árbol todavía no dio)');

// Costo acumulado por nivel
function cierreTec(id, vistos = new Set()) {
  if (vistos.has(id)) return vistos;
  vistos.add(id);
  for (const r of TECS.get(id)?.requiere || []) cierreTec(r, vistos);
  return vistos;
}
say('');
const acumPorNivel = new Map();
const acumuladas = new Set();
for (let n = 0; n <= 4; n++) {
  const objs = H.objetos.filter(o => o.nivel === n);
  const propias = new Set();
  for (const o of objs) if (o.tecnologia && TECS.has(o.tecnologia)) for (const t of cierreTec(o.tecnologia)) { propias.add(t); acumuladas.add(t); }
  const costoNivel = [...propias].reduce((a, t) => a + (TECS.get(t)?.costoSaber || 0), 0);
  const costoAcum  = [...acumuladas].reduce((a, t) => a + (TECS.get(t)?.costoSaber || 0), 0);
  acumPorNivel.set(n, { costo: costoAcum, propio: costoNivel, tecs: [...propias] });
  say(`nivel ${n}: ${String(objs.length).padStart(2)} objetos · ${propias.size} tecnologías propias (${costoNivel} pts) · ACUMULADO desde cero: ${costoAcum} pts (${((costoAcum / POOL) * 100).toFixed(1)} % del pool)`);
  if (VERBOSE) say(`         ${[...propias].map(t => `${t}(${TECS.get(t)?.costoSaber ?? '?'})`).join(' ')}`);
}
// Cadena mínima a la herramienta de cada nivel
say('');
for (const idHerr of ['lasca', 'hacha_piedra', 'maza_cuna', 'hacha_hierro']) {
  const o = OBJETOS.get(idHerr);
  if (!o?.tecnologia) continue;
  const cad = [...cierreTec(o.tecnologia)];
  const costo = cad.reduce((a, t) => a + (TECS.get(t)?.costoSaber || 0), 0);
  say(`para tener «${idHerr}» (nivel ${o.nivel}): ${cad.length} tecnología(s) [${cad.join(' ← ')}], ${costo} puntos — ${((costo / POOL) * 100).toFixed(1)} % del pool`);
  if (costo > POOL) anotar('critica', 'saber', `la herramienta ${idHerr} cuesta más puntos de los que existen`, `${costo} > ${POOL}`, cad.join(' → '));
}

// ── ¿La escalera de niveles está realmente encadenada? ─────────────────────
say('');
say('¿Cada nivel exige el anterior? (requiere de la tecnología que da la herramienta de mano)');
const ESCALERA = [[1, 'lasca_obsidiana'], [2, 'hacha_pulida'], [3, 'canteria_litica'], [4, 'herreria_colonial']];
for (let i = 0; i < ESCALERA.length; i++) {
  const [n, id] = ESCALERA[i];
  const t = TECS.get(id);
  const cad = cierreTec(id);
  const prev = i > 0 ? ESCALERA[i - 1][1] : null;
  const encadenado = !prev || cad.has(prev);
  say(`   n${n} «${id}» requiere: [${(t.requiere || []).join(', ') || '—'}] · ¿contiene n${n - 1}? ${prev ? (encadenado ? 'sí' : 'NO') : 'n/a'} · costo ${t.costoSaber}`);
  if (prev && !encadenado) {
    anotar('critica', 'saber', `el nivel ${n} NO exige el nivel ${n - 1}: la escalera de herramientas no está encadenada`,
      `${id}.requiere = [${(t.requiere || []).join(', ') || 'vacío'}], costoSaber ${t.costoSaber}`,
      `Se puede saltar de manos vacías al nivel ${n} pagando sólo ${t.costoSaber} puntos, sin pasar por lasca, hacha ni cuña.`);
  }
}
// Prueba dura: fabricar hacha_hierro sin haber fabricado NINGUNA herramienta n1-n3
const HERRAM_BAJAS = ['lasca', 'raspador', 'cuchillo', 'hacha_piedra', 'azuela', 'pala_omoplato', 'maza_cuna', 'pico_asta'];
const guardadoObjs = H.objetos.slice();
H.objetos.length = 0; H.objetos.push(...guardadoObjs.filter(o => !HERRAM_BAJAS.includes(o.id)));
const cSalto = cierre(baseB);
const cSaltoHoy = cierre(base0Codigo);   // con el mundo tal como el código lo entrega hoy
H.objetos.length = 0; H.objetos.push(...guardadoObjs);
say('');
say(`Prueba de salto — borradas TODAS las herramientas de mano n1..n3 (${HERRAM_BAJAS.join(', ')}):`);
say(`   con las compuertas del dataset: ¿se llega al hacha de hierro? ${cSalto.objetos.has('hacha_hierro') ? 'SÍ' : 'no'}  (nivel alcanzado n${cSalto.nivel})`);
say(`   con el mundo del código de hoy:  ¿se llega al hacha de hierro? ${cSaltoHoy.objetos.has('hacha_hierro') ? 'SÍ' : 'no'}  (nivel alcanzado n${cSaltoHoy.nivel})`);
if (cSaltoHoy.objetos.has('hacha_hierro')) {
  anotar('critica', 'saber', 'se llega al hacha de hierro sin fabricar una sola herramienta de piedra',
    `20 puntos (herreria_colonial) = 10 especies identificadas, ${((20 / POOL) * 100).toFixed(1)} % del pool`,
    'Materiales de herreria_colonial: chatarra 4 + carbon 2 + piedra 3, todo de nivel 0. La fragua pide piedra 10 + arcilla 4 + cuero 1, y hoy Recoleccion.js regala cuero de la carroña sin pedir filo.');
}
const totalTodo = [...TECS.values()].reduce((a, t) => a + (t.costoSaber || 0), 0);
say('');
say(`costoSaber de LAS ${TECS.size} TECNOLOGÍAS JUNTAS = ${totalTodo}   vs   pool de ${POOL}   →   ${totalTodo > POOL ? 'FALTAN ' + (totalTodo - POOL) : 'sobran ' + (POOL - totalTodo)} puntos`);
if (totalTodo > POOL) {
  anotar('grave', 'saber', 'el árbol entero cuesta más puntos de los que el juego reparte una sola vez',
    `${totalTodo} pedidos vs ${POOL} disponibles → faltan ${totalTodo - POOL}`,
    'Saberes.desbloquear() RESTA el costo (this.puntos -= costoSaber): los puntos se gastan, no son un umbral.');
}
const nuevas = (H.tecnologiasNuevas || []).reduce((a, t) => a + (t.costoSaber || 0), 0);
say(`de esos, ${nuevas} los agregan las ${(H.tecnologiasNuevas || []).length} tecnologías nuevas de este archivo (+${((nuevas / (totalTodo - nuevas)) * 100).toFixed(1)} % sobre lo que ya había)`);

bloque('5 · CURVA');

const porNivel = new Map();
for (const o of H.objetos) {
  if (!porNivel.has(o.nivel)) porNivel.set(o.nivel, []);
  porNivel.get(o.nivel).push(o);
}
for (let n = 0; n <= 4; n++) {
  const l = porNivel.get(n) || [];
  const cats = {};
  for (const o of l) cats[o.categoria] = (cats[o.categoria] || 0) + 1;
  say(`nivel ${n} — ${String(l.length).padStart(2)} objetos ${'█'.repeat(l.length)}`);
  say(`         ${Object.entries(cats).map(([k, v]) => `${k}:${v}`).join(' ') || '(vacío)'}`);
  say(`         ${l.map(o => o.id).join(', ') || '—'}`);
}
const cuentas = [0, 1, 2, 3, 4].map(n => (porNivel.get(n) || []).length);
const total = cuentas.reduce((a, b) => a + b, 0);
say('');
say(`total ${total} objetos (el resumen del archivo dice 57)`);
if (total !== 57) anotar('media', 'curva', 'el archivo dice 57 objetos', `hay ${total}`, 'El resumen del dataset no coincide con el array.');
say(`reparto ${cuentas.join(' / ')} — media ${(total / 5).toFixed(1)}`);
for (let n = 0; n <= 4; n++) {
  if (cuentas[n] === 0) anotar('grave', 'curva', `nivel ${n} vacío`, '0 objetos', '');
  if (cuentas[n] < total / 5 / 2) anotar('media', 'curva', `nivel ${n} flaco`, `${cuentas[n]} objetos vs media ${(total / 5).toFixed(1)}`, (porNivel.get(n) || []).map(o => o.id).join(', '));
  if (cuentas[n] > total / 5 * 2) anotar('media', 'curva', `nivel ${n} inflado`, `${cuentas[n]} objetos vs media ${(total / 5).toFixed(1)}`, '');
}
// Saltos
for (let n = 1; n <= 4; n++) {
  const d = cuentas[n] - cuentas[n - 1];
  say(`salto ${n - 1}→${n}: ${d > 0 ? '+' : ''}${d} objetos · costoSaber ${acumPorNivel.get(n - 1).costo} → ${acumPorNivel.get(n).costo} (+${acumPorNivel.get(n).costo - acumPorNivel.get(n - 1).costo})`);
}

// Cuentas declaradas contra reales
say('');
const declarado = { acciones: 29, tecnologias: 5, recursos: 16, obras: 2 };
const real = { acciones: H.acciones.length, tecnologias: (H.tecnologiasNuevas || []).length, recursos: (H.recursosNuevos || []).length, obras: (H.obrasNuevas || []).length };
for (const k of Object.keys(declarado)) {
  const ok = declarado[k] === real[k];
  say(`${ok ? '✓' : '✗'} ${k}: declarados ${declarado[k]}, reales ${real[k]}`);
  if (!ok) anotar('media', 'curva', `el encargo dice ${declarado[k]} ${k}`, `hay ${real[k]}`, '');
}
// engancheAlCodigo dice "11 recursos nuevos"
const dice11 = /Agregar los (\d+) recursos nuevos/.exec(H.engancheAlCodigo?.['Recursos.js'] || '');
if (dice11 && +dice11[1] !== real.recursos) {
  say(`✗ engancheAlCodigo manda agregar ${dice11[1]} recursos, pero recursosNuevos trae ${real.recursos}`);
  anotar('grave', 'curva', 'engancheAlCodigo pide agregar menos recursos de los que el archivo define',
    `dice ${dice11[1]}, hay ${real.recursos}`, 'Si se sigue la instrucción al pie, quedan recursos sin ficha de peso en Recursos.js.');
}

// Acciones huérfanas: ninguna herramienta las habilita
bloque('6 · ACCIONES SIN HERRAMIENTA QUE LAS HABILITE');
const habilitadas = new Set(H.objetos.flatMap(o => o.habilita || []));
for (const a of H.acciones) {
  if (habilitadas.has(a.id)) continue;
  const n = a.nivelMinimo ?? 0;
  const nota = n === 0 ? 'nivel 0, se hace a mano' : `nivelMinimo ${n} y NINGÚN objeto la lista en «habilita»`;
  say(`${n === 0 ? '·' : '✗'} ${a.id.padEnd(18)} ${nota}`);
  if (n > 0) anotar('grave', 'acciones', `acción «${a.id}» no la habilita ningún objeto`, `nivelMinimo ${n}`,
    'Queda colgada del nivel numérico, que ningún sistema calcula todavía.');
}
// Habilitaciones que apuntan a acciones inexistentes
const idsAcc = new Set(H.acciones.map(a => a.id));
for (const o of H.objetos) for (const a of o.habilita || []) if (!idsAcc.has(a)) {
  say(`✗ ${o.id} habilita «${a}», que no existe en acciones`);
  anotar('grave', 'acciones', `${o.id} habilita una acción inexistente`, a, '');
}
// Municiones que no existen
for (const o of H.objetos) if (o.municion) {
  const k = normalizar(o.municion);
  if (!PESO.has(k)) { say(`✗ ${o.id} usa munición «${o.municion}» que no tiene ficha de recurso`); anotar('grave', 'acciones', `munición sin ficha: ${o.municion}`, o.id, ''); }
}
// efectosAAgregar que apuntan a objetos inexistentes
for (const e of H.efectosAAgregar || []) {
  for (const lista of ['herramienta', 'recetas']) {
    for (const id of e.efecto?.[lista] || []) {
      if (!OBJETOS.has(id) && !MINERIA.recetas.some(r => r.id === id)) {
        say(`✗ efectosAAgregar[${e.tecnologia}].${lista} cita «${id}», que no es un objeto del archivo`);
        anotar('media', 'acciones', `efectosAAgregar cita un id inexistente`, `${e.tecnologia}.${lista} → ${id}`, '');
      }
    }
  }
}
// Objetos que no aparecen en ningún efectosAAgregar ni tecnologiasNuevas
const citados = new Set([
  ...(H.efectosAAgregar || []).flatMap(e => [...(e.efecto?.herramienta || []), ...(e.efecto?.recetas || [])]),
  ...(H.tecnologiasNuevas || []).flatMap(t => [...(t.efecto?.herramienta || []), ...(t.efecto?.recetas || [])]),
]);
const sinCitar = H.objetos.filter(o => !citados.has(o.id));
say('');
say(`objetos que ninguna tecnología declara habilitar (${sinCitar.length}): ${sinCitar.map(o => `${o.id}[tec:${o.tecnologia ?? 'null'}]`).join(', ')}`);
for (const o of sinCitar) if (o.tecnologia) anotar('grave', 'acciones',
  `${o.id} declara tecnología «${o.tecnologia}» pero esa tecnología no lo lista en su efecto`, '',
  'Saberes.requisitoPara() busca por efecto: un objeto no listado queda sin compuerta.');

bloque('6b · RECURSOS NUEVOS: ¿SE PRODUCEN? ¿SE CONSUMEN?');
const PRODUCIDOS = new Set([
  ...H.objetos.flatMap(o => (o.produce || []).map(p => normalizar(p.recurso))),
  ...[...OBRAS.values()].flatMap(o => (o.produce || []).map(p => normalizar(p.recurso))),
  ...[...RECETAS_HORNO, ...RECETAS_OBRA].flatMap(r => r.sale.map(s => normalizar(s.recurso))),
  ...[...RINDE_ACCION.values()].flatMap(s => [...s]),
]);
const CONSUMIDOS = new Set([...PEDIDOS]);
// La munición también se consume, aunque no figure en ningún `materiales`.
for (const o of H.objetos) if (o.municion) CONSUMIDOS.add(normalizar(o.municion));
for (const r of H.recursosNuevos || []) {
  const k = normalizar(r.id);
  const prod = PRODUCIDOS.has(k), cons = CONSUMIDOS.has(k);
  const marca = prod && cons ? '✓' : '✗';
  say(`${marca} ${k.padEnd(14)} producido: ${prod ? 'sí' : 'NO'} · consumido: ${cons ? 'sí' : 'NO'}${RECURSOS[k] ? '' : ' · sin ficha en Recursos.js (la agrega este archivo)'}`);
  if (!prod) anotar('grave', 'recursos', `«${k}» se declara como recurso nuevo y nada lo produce`, '', 'Peso muerto en el registro, o receta faltante.');
  // Un alimento o un remedio los consume el jugador, no una receta: no es defecto.
  if (!cons && !['alimento', 'remedio'].includes(r.cat)) {
    anotar('media', 'recursos', `«${k}» se produce, es cat:${r.cat} y nada lo consume`, '',
      'Callejón sin salida: ninguna receta lo pide y no es comida ni remedio que el jugador gaste solo.');
  }
}
// Recursos producidos por objetos del archivo que ni siquiera están en recursosNuevos
const declarados = new Set((H.recursosNuevos || []).map(r => normalizar(r.id)));
for (const o of H.objetos) for (const p of o.produce || []) {
  const k = normalizar(p.recurso);
  if (!declarados.has(k) && !RECURSOS[k]) {
    say(`✗ «${o.id}» produce «${k}», que no está ni en Recursos.js ni en recursosNuevos`);
    anotar('grave', 'recursos', `«${k}» se produce y no tiene ficha en ningún lado`, `lo hace ${o.id}`,
      'Recursos.pesoDe() le va a dar 0,5 kg por omisión y Bolso.js no lo va a dibujar (el mismo defecto que ya tuvo `hueso`).');
  }
}
for (const o of H.objetos) if (o.municion) {
  const k = normalizar(o.municion);
  if (!declarados.has(k) && !RECURSOS[k]) say(`✗ munición «${k}» de ${o.id}: sin ficha`);
}

bloque('7 · LO QUE ESTE BANCO NO SUPO LEER');
if (!AVISOS_PARSER.length) say('nada: todos los `rinde` en prosa se pudieron mapear.');
for (const a of new Set(AVISOS_PARSER)) say('  ? ' + a);

// ───────────────────────────────────────────────────────────────────────────
// MUTACIONES: probar que los controles gritan
// ───────────────────────────────────────────────────────────────────────────
bloque('8 · MUTACIONES (¿el banco mide algo?)');
let mutOk = 0, mutFail = 0;
const mut = (nombre, fn) => {
  const r = fn();
  if (r) { mutOk++; say(`  ✓ ${nombre}`); }
  else { mutFail++; say(`  ✗ ${nombre} — EL CONTROL NO DETECTA LA ROTURA`); }
};

// M1: reintroducir el candado arco↔tendón (arco pide tendón y tendón sólo sale
// de una acción que habilita el propio arco)
mut('detecta el candado arco↔tendón si se reintroduce', () => {
  const rindeOrig = new Map(RINDE_ACCION);
  const base = new Set(base0Dataset); base.delete('tendon'); base.delete('cuero'); base.delete('hueso'); base.delete('grasa');
  // sólo caza_mayor da tendón, y sólo el arco habilita caza_mayor
  const objetosFalsos = H.objetos.map(o => o.id === 'arco_colihue_obj' ? o : { ...o, habilita: (o.habilita || []).filter(a => a !== 'caza_mayor' && a !== 'descuerar') });
  const guardado = H.objetos;
  H.objetos.length = 0; H.objetos.push(...objetosFalsos);
  const c = cierre(base);
  H.objetos.length = 0; H.objetos.push(...guardado);
  return !c.objetos.has('arco_colihue_obj');
});

// M2: una receta de 100+ kg tiene que salir como imposible
mut('detecta una receta de 120 kg', () => {
  let min = 0; for (const m of [{ recurso: 'hormigon', cantidad: 30 }]) min += pesoPedido(m.recurso).min * m.cantidad;
  return min > TECHO_MAX;   // 30 x 4,0 = 120 kg
});
// M2b: y NO tiene que marcar como imposible una que sí entra
mut('no marca imposible una receta de 5 kg', () => {
  const min = pesoPedido('piedra').min * 3;   // 4,2 kg
  return min <= CAPACIDAD_BASE;
});

// M3: un material inventado tiene que quedar fuera del cierre
mut('detecta un material sin fuente', () => !cDataset.hay('unobtanium'));

// M4: un costoSaber absurdo tiene que superar el pool
mut('detecta un costoSaber por encima del pool', () => 99999 > POOL);

// M5: el cierre no puede declarar alcanzable un objeto cuya estación no existe
mut('detecta una estación imposible', () => {
  const c = cierre(new Set(['fibra']));
  return !c.estaciones.has('fragua');
});

// M6: el parser tiene que quejarse de una prosa desconocida
mut('el parser confiesa lo que no entiende', () => {
  const antes = AVISOS_PARSER.length;
  parseRinde('titanio, kriptonita', 'mutacion');
  const grito = AVISOS_PARSER.length > antes;
  AVISOS_PARSER.length = antes;
  return grito;
});

say('');
say(`mutaciones: ${mutOk} detectadas, ${mutFail} ciegas`);
if (mutFail) anotar('critica', 'banco', 'el banco tiene controles ciegos', `${mutFail} mutaciones no detectadas`, '');

// ───────────────────────────────────────────────────────────────────────────
bloque('RESUMEN POR GRAVEDAD');
const ORDEN = ['critica', 'grave', 'media', 'menor'];
for (const g of ORDEN) {
  const l = HALLAZGOS.filter(h => h.gravedad === g);
  if (!l.length) continue;
  say(`── ${g.toUpperCase()} (${l.length})`);
  for (const h of l) say(`   [${h.seccion}] ${h.titulo}${h.numero ? ' :: ' + h.numero : ''}`);
}
say('');
say(`TOTAL: ${HALLAZGOS.length} hallazgos`);

// JSON para el informe
if (process.argv.includes('--json')) {
  console.log('\n<<<JSON>>>');
  console.log(JSON.stringify(HALLAZGOS, null, 1));
}
