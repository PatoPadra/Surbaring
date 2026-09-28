/**
 * BANCO DE LA FASE 5 (piedra) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes del agente. El pedido del
 * dueño: «trabajar piedra para después hacer un hacha, un martillo», con foco en la
 * primera hora real. Hoy al arrancar no se fabrica ninguna herramienta de piedra: la
 * lasca de rodado pide la talla de obsidiana (2 obsidianas de más de 1500 m, 8 de saber).
 *
 *   1. LA CADENA — el percutor, la lasca de rodado sin obsidiana, la preforma, el pulido,
 *      el mango sin obsidiana, el hacha con cordel y el martillo de piedra, como dice P1 a P7.
 *   2. LA PRIMERA HORA — con `Inventario`, `Equipo`, `Saberes` y `Fabricacion` de verdad:
 *      bolso de 38 kg vacío, 3 de saber, y sólo lo que se junta a menos de 1 km del
 *      arranque (piedra, fibra, madera, leña, arena). Un planificador recorre la cadena del
 *      hacha hasta tenerla. Sin obsidiana, sin cuero, sin cazar.
 *   3. EL MARTILLO SIRVE — alguna receta lo pide, y se puede hacer en la primera semana:
 *      con lo de la primera hora más lo que se consigue con el hacha y sin cazar (tronco,
 *      corteza, hueso de la carroña).
 *   4. NADIE QUEDA PEOR — lo que hoy se fabrica (9 objetos sin saber, 48 con todo, con un
 *      bolso lleno: `r8-fabricables.mjs`) se sigue fabricando.
 *   5. LAS NOTAS — cada objeto de la cadena dice qué es y de dónde sale; el hacha cita a
 *      Salas (1942), la preforma o el pulido a Fenton (1984).
 *   6. SIN REGRESIÓN — la ronda 7, la ronda 6 fase 3 (los iconos), las fases 1 a 4 y 6.
 *   7. ARRANQUE — vite build.
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase5.mjs
 *      BANCO_SRC, BANCO_SIN_BUILD, BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const imp = (p) => import(pathToFileURL(path.join(SRC, p)).href);
const datos = (f) => JSON.parse(fs.readFileSync(path.join(SRC, 'data', f), 'utf8'));

// Lo que hoy se fabrica con un bolso lleno (r8-fabricables.mjs, 19/9/2026, antes del agente)
const HOY_SIN_SABER = ['antorcha', 'anzuelo_hueso', 'cana_colihue', 'cordel_fibra', 'garrote', 'honda', 'linea_mano', 'tiento_cuero', 'trampa_lazo'];
const HOY_CON_TODO = ['ahumador', 'antorcha', 'anzuelo_hueso', 'arco_colihue_obj', 'arpon_hueso', 'azuela', 'bola_forrada', 'bola_perdida', 'boleadora_dos', 'boleadora_tres', 'cana_colihue', 'canasto_junco_obj', 'candil_grasa', 'careta_velo', 'cordel_fibra', 'cuchillo', 'equipo_mosca', 'estolica', 'flechas', 'garrote', 'hacha_piedra', 'hilar_lana', 'honda', 'huso', 'lanza_colihue', 'lasca', 'lasca_rodado', 'linea_mano', 'mango_labrado', 'maza_cuna', 'metawe_greda', 'mochila_cuero', 'moscas', 'nasa_junco', 'odre_cuero', 'pala_omoplato', 'pico_asta', 'punta_litica', 'punzon_hueso', 'quillango', 'raspador', 'rastra', 'red_fibra', 'taladro_arco', 'tamangos', 'tiento_cuero', 'trampa_lazo', 'velas_cera'];
// Lo que se junta a menos de 1 km del arranque (RONDA8.md, fase 5, punto 7)
// El agua está, pero el planificador la junta con Inventario.agregar: si hace falta recipiente
// y no se tiene, no entra, y la primera hora no se cumple (que es lo que corresponde).
const CRUDOS_HORA = ['piedra', 'fibra', 'madera', 'madera_dura', 'madera_blanda', 'lena', 'arena', 'corteza', 'agua'];
// Y en la primera semana, con el hacha y sin cazar: el tronco se troza, el hueso sale de la carroña
const CRUDOS_SEMANA = [...CRUDOS_HORA, 'tronco', 'hueso', 'junco', 'cana'];
const MARTILLOS = ['martillo_piedra', 'maza_piedra', 'martillo_de_piedra'];

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}
const herramientasDe = (o) => [].concat(o?.pideHerramienta || []);

// ── El mundo de juguete ─────────────────────────────────────────────────────

async function mundo({ capacidad = 38, saber = 0 } = {}) {
  const H = datos('herramientas.json'), HI = datos('historia.json');
  const { Inventario } = await imp('systems/Inventario.js');
  const { Equipo } = await imp('systems/Equipo.js');
  const { Saberes } = await imp('systems/Saberes.js');
  const { Fabricacion } = await imp('systems/Fabricacion.js');
  const inventario = new Inventario(capacidad);
  const equipo = new Equipo(H, { inventario });
  const saberes = new Saberes(HI, inventario);
  saberes.puntos = saber;
  const fundicion = { hornos: [], cercano: () => null, arde: () => true, usaFuego: () => false, hornoPorId: () => null, definicionesHorno: [], jugador: { posicion: { x: 0, y: 0, z: 0 } } };
  const fab = new Fabricacion(H, { inventario, saberes, equipo, fundicion, hud: { aviso() {} } });
  return { H, HI, inventario, equipo, saberes, fab };
}

/**
 * Lo que hace falta para `meta`, recorriendo el grafo de recetas: los objetos (los que
 * producen un recurso pedido y las herramientas pedidas), las tecnologías, y los recursos
 * crudos que nadie produce.
 */
function cierre(H, HI, meta) {
  const objetos = new Map((H.objetos || []).map((o) => [o.id, o]));
  const tecs = new Map((HI.tecnologias || []).map((t) => [t.id, t]));
  const productor = (r) => (H.objetos || []).filter((o) => (o.produce || []).some((p) => p.recurso === r));
  const vistos = new Set(), tecnologias = new Set(), crudos = new Set();
  const visitarTec = (id) => {
    if (!id || tecnologias.has(id)) return;
    const t = tecs.get(id); tecnologias.add(id);
    if (!t) return;
    for (const r of t.requiere || []) visitarTec(r);
    for (const m of t.materiales || []) visitarRec(m.recurso);
  };
  const visitarRec = (r) => {
    const ps = productor(r);
    if (!ps.length) { crudos.add(r); return; }
    // El productor que no pide crudos prohibidos, si hay varios; si no, el primero
    const bueno = ps.find((p) => (p.materiales || []).every((m) => CRUDOS_SEMANA.includes(m.recurso) || productor(m.recurso).length)) || ps[0];
    visitarObj(bueno.id);
  };
  const visitarObj = (id) => {
    if (vistos.has(id)) return;
    vistos.add(id);
    const o = objetos.get(id);
    if (!o) { crudos.add(`?${id}`); return; }
    visitarTec(o.tecnologia);
    for (const m of o.materiales || []) visitarRec(m.recurso);
    const hs = herramientasDe(o);
    if (hs.length) {
      // Con que haya una alcanzable alcanza: se sigue la primera que no sea de obsidiana
      const h = hs.find((x) => !/obsidiana/.test(x) && x !== 'lasca') || hs[0];
      visitarObj(h);
    }
  };
  visitarObj(meta);
  return { objetos: vistos, tecnologias, crudos };
}

/**
 * Recorre la cadena con los sistemas de verdad: junta lo crudo que falte (de lo
 * permitido), aprende las tecnologías que pueda y fabrica lo que esté listo, hasta
 * tener `meta` o no poder avanzar.
 */
async function recorrer(meta, { crudos, saber, capacidad = 38 }) {
  const w = await mundo({ capacidad, saber });
  const c = cierre(w.H, w.HI, meta);
  const pasos = [];
  const tener = (id) => w.equipo.tiene(id);
  const catalogo = new Map(w.fab.catalogo.map((o) => [o.id, o]));
  for (let vuelta = 0; vuelta < 400 && !tener(meta); vuelta++) {
    let avanzo = false;
    // Juntar: de a una unidad de lo que alguna receta del cierre pide y falta
    for (const id of c.objetos) {
      const o = catalogo.get(id);
      if (!o) continue;
      for (const m of o.materiales || []) {
        if (crudos.includes(m.recurso) && w.inventario.disponiblePara(m.recurso) < m.cantidad) {
          if (w.inventario.agregar(m.recurso, m.cantidad) > 0) { avanzo = true; pasos.push(`juntar ${m.recurso}`); }
        }
      }
    }
    for (const tid of c.tecnologias) {
      const t = w.saberes.porId.get(tid);
      if (!t || w.saberes.desbloqueadas.has(tid)) continue;
      for (const m of t.materiales || []) if (crudos.includes(m.recurso) && w.inventario.disponiblePara(m.recurso) < m.cantidad) w.inventario.agregar(m.recurso, m.cantidad);
      if (w.saberes.desbloquear(t)?.estado === 'desbloqueada') { avanzo = true; pasos.push(`aprender ${tid}`); }
    }
    for (const id of c.objetos) {
      const o = catalogo.get(id);
      if (!o) continue;
      // Una herramienta que ya se tiene no se vuelve a hacer; un insumo, sí, si hace falta
      if (!o.produce && tener(id)) continue;
      if (o.produce && o.produce.every((p) => w.inventario.disponiblePara(p.recurso) >= 4)) continue;
      const r = w.fab.fabricar(o);
      if (r.estado === 'hecho') { avanzo = true; pasos.push(`hacer ${id}`); }
    }
    if (!avanzo) break;
  }
  const trabado = tener(meta) ? null : [...c.objetos].map((id) => catalogo.get(id)).filter(Boolean)
    .map((o) => `${o.id}: ${JSON.stringify(w.fab.estado(o)).slice(0, 140)}`).join(' | ');
  return { logrado: tener(meta), pasos, cierre: c, trabado, saberUsado: saber - w.saberes.puntos };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA CADENA
// ═══════════════════════════════════════════════════════════════════════════

async function cadena() {
  const s = seccion(1, 'LA CADENA — percutor, lasca, preforma, pulido, mango, hacha y martillo');
  const H = datos('herramientas.json'), HI = datos('historia.json');
  const obj = (id) => (H.objetos || []).find((o) => o.id === id);
  const tec = (id) => (HI.tecnologias || []).find((t) => t.id === id);
  const obsidianaEn = (tid, vistos = new Set()) => {
    if (!tid || vistos.has(tid)) return false;
    vistos.add(tid);
    const t = tec(tid);
    if (!t) return false;
    return (t.materiales || []).some((m) => m.recurso === 'obsidiana') || (t.requiere || []).some((r) => obsidianaEn(r, vistos));
  };
  const p = obj('percutor');
  s.ok(!!p && !p.tecnologia && (p.nivel ?? 0) === 0 && !p.produce, 'P1 · existe el percutor: nivel 0, sin tecnología, herramienta', JSON.stringify(p && { nivel: p.nivel, tecnologia: p.tecnologia, materiales: p.materiales }));
  s.ok(!!p && (p.materiales || []).length === 1 && p.materiales[0].recurso === 'piedra' && p.materiales[0].cantidad === 1, 'P1 · y se hace con una piedra', JSON.stringify(p?.materiales));
  const l = obj('lasca_rodado');
  s.ok(!!l && !l.tecnologia, 'P2 · la lasca de rodado no pide tecnología', l?.tecnologia);
  s.ok(!!l && (l.materiales || []).length === 1 && l.materiales[0].recurso === 'piedra' && l.materiales[0].cantidad === 1, 'P2 · cuesta una piedra', JSON.stringify(l?.materiales));
  s.ok(herramientasDe(l).includes('percutor'), 'P2 · y pide el percutor', JSON.stringify(l?.pideHerramienta));
  const pre = (H.objetos || []).find((o) => (o.produce || []).some((x) => x.recurso === 'preforma'));
  s.ok(!!pre && (pre.materiales || []).some((m) => m.recurso === 'piedra' && m.cantidad === 2) && herramientasDe(pre).includes('percutor'), 'P3 · una receta produce la preforma con dos piedras y el percutor', JSON.stringify(pre && { id: pre.id, materiales: pre.materiales, pide: pre.pideHerramienta }));
  const pul = (H.objetos || []).find((o) => (o.produce || []).some((x) => x.recurso === 'hoja_hacha'));
  s.ok(!!pul && (pul.materiales || []).some((m) => m.recurso === 'preforma') && (pul.materiales || []).some((m) => m.recurso === 'arena'), 'P4 · una receta produce la hoja del hacha con la preforma y arena', JSON.stringify(pul && { id: pul.id, materiales: pul.materiales }));
  const m = obj('mango_labrado');
  s.ok(!!m && !obsidianaEn(m.tecnologia), 'P5 · el mango no pide la obsidiana (ni por la tecnología ni por lo que ésta requiere)', m?.tecnologia);
  const corta = herramientasDe(m);
  s.ok(corta.includes('lasca_rodado') && corta.length >= 2, 'P5 · y pide algo que corte, de una lista que incluye la lasca de rodado', JSON.stringify(m?.pideHerramienta));
  const h = obj('hacha_piedra');
  const mats = (h?.materiales || []).map((x) => x.recurso);
  s.ok(mats.includes('hoja_hacha') && mats.includes('mango') && mats.includes('cordel'), 'P6 · el hacha lleva la hoja, el mango y cordel', JSON.stringify(h?.materiales));
  s.ok(!mats.includes('tiento') && !mats.includes('cuero'), 'P6 · sin tiento ni cuero', JSON.stringify(mats));
  const th = h?.tecnologia ? tec(h.tecnologia) : null;
  s.ok(!h?.tecnologia || (!obsidianaEn(h.tecnologia) && (th?.costoSaber ?? 0) <= 3), 'P6 · si pide tecnología, no pide obsidiana y cuesta 3 de saber o menos', th ? `${th.id}: ${th.costoSaber} de saber, requiere ${JSON.stringify(th.requiere)}` : 'no pide');
  const mar = MARTILLOS.map(obj).find(Boolean);
  s.ok(!!mar, 'P7 · existe el martillo de piedra', MARTILLOS.join(' / '));
  if (mar) {
    const mm = (mar.materiales || []).map((x) => x.recurso);
    s.ok(mm.includes('mango') && mm.includes('cordel'), 'P7 · el martillo lleva mango y cordel', JSON.stringify(mar.materiales));
    s.ok(!obsidianaEn(mar.tecnologia), 'P7 · y no pide obsidiana', mar.tecnologia);
  }
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA PRIMERA HORA
// ═══════════════════════════════════════════════════════════════════════════

async function primeraHora() {
  const s = seccion(2, 'LA PRIMERA HORA — del bolso vacío al hacha, con lo que hay a 1 km');
  const r = await recorrer('hacha_piedra', { crudos: CRUDOS_HORA, saber: 3 });
  const crudos = [...r.cierre.crudos];
  s.ok(crudos.every((c) => CRUDOS_HORA.includes(c)), 'lo crudo de toda la cadena se junta a menos de 1 km del arranque', crudos.join(', '));
  s.ok(!crudos.includes('obsidiana') && !crudos.includes('cuero') && !crudos.includes('tiento'), 'sin obsidiana, sin cuero, sin cazar', crudos.join(', '));
  s.ok(r.logrado, 'el planificador termina con el hacha en el equipo, bolso de 38 kg y 3 de saber', r.logrado ? `${r.pasos.length} pasos` : r.trabado);
  s.nota(`la cadena: ${r.pasos.filter((p) => !p.startsWith('juntar')).join(' → ')}`);
  s.nota(`saber usado: ${r.saberUsado} · tecnologías del cierre: ${[...r.cierre.tecnologias].join(', ') || 'ninguna'}`);
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL MARTILLO SIRVE
// ═══════════════════════════════════════════════════════════════════════════

async function martillo() {
  const s = seccion(3, 'EL MARTILLO SIRVE — una receta lo pide, y se hace la primera semana sin cazar');
  const H = datos('herramientas.json');
  const id = MARTILLOS.find((x) => (H.objetos || []).some((o) => o.id === x));
  if (!s.ok(!!id, 'premisa: hay martillo de piedra')) return s;
  const usos = (H.objetos || []).filter((o) => herramientasDe(o).includes(id));
  if (!s.ok(usos.length >= 1, 'alguna receta pide el martillo', usos.map((o) => o.id).join(', '))) return s;
  let alguno = null;
  for (const u of usos) {
    const r = await recorrer(u.id, { crudos: CRUDOS_SEMANA, saber: 3 });
    const hecho = r.logrado || (u.produce && r.pasos.includes(`hacer ${u.id}`));
    if (hecho) { alguno = { u, r }; break; }
    s.nota(`${u.id}: no se llega (${(r.trabado || '').slice(0, 200)})`);
  }
  s.ok(!!alguno, 'y al menos uno de esos usos se hace la primera semana, sin obsidiana ni cuero', alguno ? `${alguno.u.id}: ${alguno.r.pasos.filter((p) => !p.startsWith('juntar')).join(' → ')}` : 'ninguno');
  if (alguno) s.ok([...alguno.r.cierre.crudos].every((c) => CRUDOS_SEMANA.includes(c)), 'lo crudo de ese uso está entre lo de la primera semana', [...alguno.r.cierre.crudos].join(', '));
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · NADIE QUEDA PEOR  ·  5 · LAS NOTAS
// ═══════════════════════════════════════════════════════════════════════════

async function nadiePeor() {
  const s = seccion(4, 'NADIE QUEDA PEOR — lo que hoy se fabrica se sigue fabricando');
  const { fabricables } = await import(pathToFileURL(path.join(AQUI, 'r8-fabricables.mjs')).href);
  const f = await fabricables(SRC);
  const faltaSin = HOY_SIN_SABER.filter((id) => !f.sinSaber.includes(id));
  const faltaCon = HOY_CON_TODO.filter((id) => !f.conTodo.includes(id));
  s.ok(faltaSin.length === 0, `sin saber: los ${HOY_SIN_SABER.length} de hoy se siguen fabricando`, faltaSin.join(', ') || `${f.sinSaber.length} hoy`);
  s.ok(faltaCon.length === 0, `con todo el saber: los ${HOY_CON_TODO.length} de hoy se siguen fabricando`, faltaCon.join(', ') || `${f.conTodo.length} hoy`);
  s.nota(`sin saber, ahora: ${f.sinSaber.join(', ')}`);
  s.feliz = true;
  return s;
}

async function notas() {
  const s = seccion(5, 'LAS NOTAS — qué es, cómo se hacía y de dónde sale');
  const H = datos('herramientas.json');
  const texto = (o) => [o?.nota, o?.fuente, o?.referencia, o?.porQueExiste].filter(Boolean).join(' ');
  const obj = (id) => (H.objetos || []).find((o) => o.id === id);
  const pre = (H.objetos || []).find((o) => (o.produce || []).some((x) => x.recurso === 'preforma'));
  const pul = (H.objetos || []).find((o) => (o.produce || []).some((x) => x.recurso === 'hoja_hacha'));
  const mar = MARTILLOS.map(obj).find(Boolean);
  for (const [nombre, o] of [['el percutor', obj('percutor')], ['la lasca de rodado', obj('lasca_rodado')], ['la preforma', pre], ['el pulido', pul], ['el mango', obj('mango_labrado')], ['el hacha', obj('hacha_piedra')], ['el martillo', mar]]) {
    s.ok(!!o && texto(o).length >= 80, `${nombre} tiene su nota (80 caracteres o más)`, o ? texto(o).length : 'no existe');
  }
  s.ok(/Salas/.test(texto(obj('hacha_piedra'))) && /1942/.test(texto(obj('hacha_piedra'))), 'el hacha cita a Salas (1942)', texto(obj('hacha_piedra')).slice(0, 120));
  s.ok(/Fenton/.test(texto(pre) + texto(pul)), 'la preforma o el pulido citan a Fenton (1984)');
  // La nota de la lasca ya no puede decir que existe para que el arranque no sea una caminata si igual lo es
  const l = obj('lasca_rodado');
  s.ok(!l?.tecnologia, 'lo que dice el porQueExiste de la lasca es cierto: se hace sin caminar hasta la obsidiana', l?.tecnologia);
  s.feliz = true;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — la ronda 7, los iconos de la ronda 6, y las fases 1 a 4 y 6');
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
    // La fase 6 (la luna con la ley de Allen) se cerró el 23/9/2026: vuelve a 4/4. Entre
    // el 22 y el 23 esta línea estuvo en 1/4 a propósito, porque la fase no existía.
    ['banco-r8-fase6.mjs', '4/4', { BANCO_SECCIONES: 'ley,noche,cielo,shader' }],
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

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { cadena, primeraHora, martillo, nadiePeor, notas, regresion, arranque };
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
  console.log(`\n  BANCO R8 · FASE 5 — la piedra, paso a paso   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
