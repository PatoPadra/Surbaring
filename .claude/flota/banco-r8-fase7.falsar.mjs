/**
 * FALSADOR DE LA FASE 7 (reglas), mitad Node — ronda 8.
 *
 * Planta en una copia de `src/` los defectos de «las decisiones del dueño y las deudas»:
 * la muerte que no se lleva todo, la lana que vuelve al 2/3, la licencia que no se dice o
 * se dice siempre, la estación que vuelve a mirar sólo la más cercana, el radio repetido,
 * el «115» y la cestería que suma dos veces. Corre las secciones 1 a 5 del banco y mira
 * que caiga la aserción que tiene que caer. Trae controles.
 *
 * **Los defectos no dependen de cómo escriba el agente su código.** Los de la muerte
 * envuelven `registrarMuerte()` desde afuera y deshacen lo que haya hecho; el de la lana
 * busca la línea POR LA LICENCIA (`licencia: 'lanaDelCoiron'`) y no por el número; los de
 * los datos cambian el JSON. Así el falsador sirve igual escriba el agente lo que escriba.
 *
 * **Cuándo sirve.** Igual que el de las fases 3, 4 y 6: planta defectos sobre una
 * implementación que tiene que estar VERDE. Mientras la fase 7 no esté hecha, la fuente
 * limpia ya tiene aserciones caídas y el falsador lo dice y se planta. Se corre al final.
 *
 * Uso: node .claude/flota/banco-r8-fase7.falsar.mjs [--fuente <carpeta src>] [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f7');
const BANCO = path.join(AQUI, 'banco-r8-fase7.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FUENTE = arg('--fuente') ? path.resolve(arg('--fuente')) : path.join(RAIZ, 'src');
const SOLO = arg('--solo');

// ── Cómo se planta cada cosa ─────────────────────────────────────────────────
//
// `datos` cambia los dos JSON; `js` cambia un archivo de `src/` con una función
// texto → texto, que TIENE que tirar si no encuentra su ancla: un defecto que no se
// plantó y se cuenta como plantado es un falsador que miente.

const enDatos = (fn) => ({ datos: fn });
const enJs = (rel, fn) => ({ js: [[rel, fn]] });
const licRecoleccion = (H) => {
  const l = (H.licenciasDeJuego?.licencias || []).find((x) => /recolec/i.test(`${x.id} ${x.que || ''}`));
  if (!l) throw new Error('no encuentro la licencia de la recolección (¿la fase no está hecha?)');
  return l;
};

/**
 * Envuelve `registrarMuerte()` desde el final del módulo, sin tocar el cuerpo. Es lo que
 * hace que estos cuatro defectos no dependan de cómo escriba el agente la función.
 */
const envolverMuerte = (cuerpo) => (t) => {
  if (!/class\s+Partida/.test(t)) throw new Error('no encuentro class Partida');
  if (!/registrarMuerte\s*\(/.test(t)) throw new Error('no encuentro registrarMuerte');
  return `${t}
// ── Defecto del falsador ─────────────────────────────────────────────────────
{
  const _rm = Partida.prototype.registrarMuerte;
  Partida.prototype.registrarMuerte = function (...args) {
    const eq = this._equipo || this.equipo || this.deps?.equipo;
    const inv = this._inventario || this.inventario || this.deps?.inventario;
    const tr = this._trampas || this.trampas || this.deps?.trampas;
    const puestoAntes = { ...(eq?.puesto || {}) };
    const prendidaAntes = eq?.encendida;
    const r = _rm.apply(this, args);
    ${cuerpo}
    return r;
  };
}
`;
};

const DEFECTOS = [
  // ── G1 · La muerte se lleva todo ────────────────────────────────────────────
  ['muerte-deja-ranuras', 'la muerte vacía el bolso pero deja lo puesto',
    enJs('systems/Partida.js', envolverMuerte('if (eq) Object.assign(eq.puesto, puestoAntes);')),
    ['las cuatro ranuras quedan vacías']],
  ['muerte-deja-llama', 'la muerte no apaga la llama',
    enJs('systems/Partida.js', envolverMuerte('if (eq && prendidaAntes) eq.encendida = prendidaAntes;')),
    ['la llama se apaga']],
  ['muerte-no-nombra', 'la pantalla de fin no nombra lo que estaba puesto',
    enJs('systems/Partida.js', envolverMuerte(`const ids = Object.values(puestoAntes).filter(Boolean).map((c) => c.id);
    const podar = (l) => (l || []).filter((x) => !ids.includes(x.id));
    if (r && r.perdido) r.perdido = podar(r.perdido);
    if (this.ultimaMuerte && this.ultimaMuerte.perdido) this.ultimaMuerte.perdido = podar(this.ultimaMuerte.perdido);`)),
    ['la pantalla de fin nombra lo que estaba puesto']],
  ['muerte-borra-trampas', 'la muerte se lleva también las trampas puestas',
    enJs('systems/Partida.js', envolverMuerte('if (tr?.lista) tr.lista.length = 0;')),
    ['las trampas puestas siguen donde estaban']],

  // ── G2 · La lana ────────────────────────────────────────────────────────────
  ['lana-como-antes', 'la lana del coirón vuelve a salir 2 de cada 3',
    enJs('systems/Recoleccion.js', (t) => {
      const re = /(\{[^{}]*?)probabilidad:\s*[^,}]+([^{}]*?licencia:\s*'lanaDelCoiron')/;
      if (!re.test(t)) throw new Error("no encuentro la línea de la lana con licencia 'lanaDelCoiron'");
      return t.replace(re, '$1probabilidad: 2 / 3$2');
    }),
    ['la lana sale en 1 de cada 4', 'el poncho cuesta 47 apretadas']],

  // ── G3 · La licencia de la recolección ──────────────────────────────────────
  ['sin-licencia', 'la licencia de la recolección no está declarada',
    enDatos(({ H }) => { const l = licRecoleccion(H); H.licenciasDeJuego.licencias = H.licenciasDeJuego.licencias.filter((x) => x !== l); }),
    ['licenciasDeJuego declara la de la recolección']],
  ['licencia-sin-ley', 'la licencia está pero no cita la ley',
    enDatos(({ H }) => { const l = licRecoleccion(H); for (const k of Object.keys(l)) if (typeof l[k] === 'string') l[k] = l[k].replace(/22\.?351/g, 'la ley').replace(/art[íi]?c?u?l?o?\.?\s*5\b/gi, 'una parte'); }),
    ['con la Ley 22.351 y su artículo 5']],
  ['licencia-cada-vez', 'la licencia se dice en cada apretada, no una sola vez',
    enJs('systems/Recoleccion.js', (t) => {
      if (!/licencia/i.test(t)) throw new Error('Recoleccion.js no menciona licencia');
      return `${t}
// ── Defecto del falsador: la licencia se olvida de que ya la dijo ────────────
{
  const proto = Recoleccion.prototype;
  const claves = Object.getOwnPropertyNames(proto).filter((k) => /licencia/i.test(k) && typeof proto[k] === 'function');
  const _actuar = proto.actuar;
  proto.actuar = function (...a) {
    for (const c of ['_licenciasDichas', 'licenciasDichas', '_dichas', 'dichas']) {
      const v = this[c];
      if (v && typeof v.clear === 'function') v.clear();
      else if (Array.isArray(v)) v.length = 0;
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) delete v[k];
    }
    void claves;
    return _actuar.apply(this, a);
  };
}
`;
    }),
    ['y la segunda ya no']],
  ['licencia-en-la-reserva', 'la licencia se dice también fuera del Parque',
    enJs('systems/Recoleccion.js', (t) => {
      if (!/jurisdiccion/.test(t)) throw new Error('Recoleccion.js no consulta la jurisdicción');
      return `${t}
// ── Defecto del falsador: la jurisdicción dice siempre «parque» ──────────────
{
  const _actuar = Recoleccion.prototype.actuar;
  Recoleccion.prototype.actuar = function (...a) {
    const lim = this.limites;
    if (lim) this.limites = { ...lim, jurisdiccion: () => 'parque', etiqueta: () => ({ id: 'parque', nombre: 'parque' }) };
    try { return _actuar.apply(this, a); } finally { this.limites = lim; }
  };
}
`;
    }),
    ['en la Reserva no la dice']],
  ['codice-sin-normativa', 'la pestaña Normativa deja de mostrar las licencias de juego',
    enJs('ui/Codice.js', (t) => {
      const re = /(_pintarNormativa\s*\([^)]*\)\s*\{)/;
      if (!re.test(t)) throw new Error('no encuentro _pintarNormativa');
      return t.replace(re, '$1\n    const licenciasDeJuego = null, licencias = null;   // defecto del falsador');
    }),
    ['la pestaña Normativa del códice la muestra']],

  // ── G4 · Las deudas ─────────────────────────────────────────────────────────
  ['estacion-la-mas-cercana', 'la estación vuelve a ser sólo la más cercana',
    enJs('systems/Fabricacion.js', (t) => {
      if (!/estacion\s*\(/.test(t)) throw new Error('no encuentro estacion()');
      return `${t}
// ── Defecto del falsador: se pregunta por UNA sola, la más cercana ───────────
{
  const _est = Fabricacion.prototype.estacion;
  Fabricacion.prototype.estacion = function (obj) {
    const donde = obj?.donde;
    const fu = this.fundicion;
    if (donde && donde !== 'bolso' && fu?.cercano) {
      const h = fu.cercano();
      const id = h?.def?.id ?? h?.id;
      if (!h || id !== donde) {
        const nombre = (fu.definicionesHorno || []).find((d) => d.id === donde)?.nombre ?? donde;
        return { ok: false, motivo: \`Hace falta estar al lado de: \${nombre}.\` };
      }
    }
    return _est.call(this, obj);
  };
}
`;
    }),
    ['una receta de fragua no pide la fragua', 'una receta de fogata no pide la fogata']],
  ['radio-propio', 'Fabricacion vuelve a declarar su propio radio',
    enJs('systems/Fabricacion.js', (t) => {
      // Después del ÚLTIMO import, que es lo único que hay seguro arriba de todo.
      const todos = [...t.matchAll(/^import[^\n]*\n/gm)];
      if (!todos.length) throw new Error('no encuentro ningún import');
      const fin = todos[todos.length - 1].index + todos[todos.length - 1][0].length;
      // El nombre no es `RADIO_ESTACION_M` a propósito: si el agente todavía no quitó
      // la deuda, ese identificador ya existe y la copia no compilaría. Cualquier
      // `RADIO_*` dispara la guarda igual, que es lo que se está midiendo.
      return `${t.slice(0, fin)}const RADIO_ESTACION_FALSADOR_M = 8;   // defecto del falsador\nvoid RADIO_ESTACION_FALSADOR_M;\n${t.slice(fin)}`;
    }),
    ['Fabricacion.js no declara su propio radio']],
  ['vuelve-el-115', 'un comentario de Iconos.js vuelve a decir «115»',
    enJs('ui/Iconos.js', (t) => `// Los 115 iconos del juego.   ← defecto del falsador\n${t}`),
    ['ui/Iconos.js ya no dice «115»']],
  ['efecto-ya-aplicado', 'efectosAAgregar vuelve a listar algo que ya está aplicado',
    enDatos(({ H, HI }) => {
      const t = (HI.tecnologias || []).find((x) => x.efecto && Object.keys(x.efecto).some((k) => typeof x.efecto[k] === 'number' || typeof x.efecto[k] === 'string'));
      if (!t) throw new Error('no encuentro una tecnología con efecto simple');
      const k = Object.keys(t.efecto).find((kk) => typeof t.efecto[kk] === 'number' || typeof t.efecto[kk] === 'string');
      H.efectosAAgregar = [...(H.efectosAAgregar || []), { tecnologia: t.id, efecto: { [k]: t.efecto[k] }, nota: 'Entrada del falsador: ya está aplicada.' }];
    }),
    ['efectosAAgregar no tiene entradas ya aplicadas']],

  // ── G5 · La cestería ────────────────────────────────────────────────────────
  ['cesteria-doble', 'la cestería vuelve a sumar capacidad por sí sola',
    enDatos(({ HI }) => {
      const t = (HI.tecnologias || []).find((x) => /cesteria/i.test(x.id));
      if (!t) throw new Error('no encuentro la cestería');
      t.efecto = { ...(t.efecto || {}), capacidadExtraKg: 6 };
    }),
    ['con la cestería aprendida y sin canasto, 38 kg']],
];

// ── Controles: cambian algo de verdad y NO tienen que poner nada en rojo ─────
const CONTROLES = [
  ['control-comentario', 'un comentario más en Partida.js',
    enJs('systems/Partida.js', (t) => `${t}\n// Comentario de control del falsador.\n`)],
  ['control-licencia-extra', 'una licencia de juego más, que no es la de la recolección',
    enDatos(({ H }) => {
      licRecoleccion(H);   // premisa: la de la recolección tiene que existir igual
      H.licenciasDeJuego.licencias = [...H.licenciasDeJuego.licencias, { id: 'controlDelFalsador', que: 'Control del falsador: una licencia más, de otra cosa.', laNormaReal: 'No aplica.', porQueSeToma: 'Control.' }];
    })],
  ['control-envoltura', 'la estación envuelta sin cambiar nada',
    enJs('systems/Fabricacion.js', (t) => {
      if (!/estacion\s*\(/.test(t)) throw new Error('no encuentro estacion()');
      return `${t}\n{\n  const _e = Fabricacion.prototype.estacion;\n  Fabricacion.prototype.estacion = function (obj) { return _e.call(this, obj); };\n}\n`;
    })],
];

// ── Mecánica ─────────────────────────────────────────────────────────────────

function copia(dest) {
  fs.rmSync(dest, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  fs.cpSync(FUENTE, path.join(dest, 'src'), { recursive: true, preserveTimestamps: true });
  return path.join(dest, 'src');
}
function plantar(src, d) {
  if (d.datos) {
    const fh = path.join(src, 'data', 'herramientas.json'), fhi = path.join(src, 'data', 'historia.json');
    const H = JSON.parse(fs.readFileSync(fh, 'utf8')), HI = JSON.parse(fs.readFileSync(fhi, 'utf8'));
    d.datos({ H, HI });
    fs.writeFileSync(fh, JSON.stringify(H, null, 2));
    fs.writeFileSync(fhi, JSON.stringify(HI, null, 2));
  }
  for (const [rel, fn] of d.js || []) {
    const f = path.join(src, ...rel.split('/'));
    fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8')));
  }
}
function correrBanco(src) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: 'muerte,lana,licencia,deudas,cesteria', BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULTADO '));
  try { return JSON.parse(linea.slice('@@RESULTADO '.length)); } catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => (res.error
  ? [`(no corrió: ${res.error.slice(-300)})`]
  : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`])));

console.log(`\n  FALSADOR R8 · FASE 7, mitad Node   (fuente: ${path.relative(RAIZ, FUENTE)} · copias en ${path.relative(RAIZ, TMP)})`);

if (process.argv.includes('--sintaxis')) {
  let ok = 0, mal = 0;
  for (const [id, , d] of [...DEFECTOS, ...CONTROLES]) {
    if (SOLO && id !== SOLO) continue;
    try { plantar(copia(path.join(TMP, 'sintaxis')), d); console.log(`  se planta    ${id}`); ok++; }
    catch (e) { console.log(`  NO se planta ${id}: ${e.message}`); mal++; }
  }
  console.log(`\n  se plantan ${ok} · no se plantan ${mal}\n`);
  process.exit(mal ? 1 : 0);
}

const base = caidas(correrBanco(copia(path.join(TMP, 'limpio'))));
if (base.length) {
  console.log(`  ROJO  la fuente limpia tiene ${base.length} aserciones caídas:`);
  for (const c of base) console.log(`          ${c}`);
  console.log('\n  Este falsador planta defectos sobre una implementación VERDE: corrélo cuando la fase esté hecha.\n');
  process.exit(1);
}
console.log('  fuente limpia: todas verdes');

let vio = 0, otro = 0, noVio = 0, noPlanta = 0, ctrlVerde = 0, ctrlRojo = 0;
for (const [id, que, d, esperadas] of DEFECTOS) {
  if (SOLO && id !== SOLO) continue;
  let src;
  try { src = copia(path.join(TMP, id)); plantar(src, d); }
  catch (e) { console.log(`  NO SE PUDO PLANTAR ${id.padEnd(22)} ${e.message}`); noPlanta++; continue; }
  const nuevas = caidas(correrBanco(src)).filter((c) => !base.includes(c));
  const acierta = nuevas.filter((c) => esperadas.some((e) => c.includes(e)));
  const etiqueta = nuevas.length === 0 ? 'NO LO VIO' : (acierta.length ? 'LO VIO' : 'POR OTRO MOTIVO');
  if (nuevas.length === 0) noVio++; else if (acierta.length) vio++; else otro++;
  console.log(`  ${etiqueta.padEnd(19)} ${id.padEnd(22)} ${que}`);
  if (nuevas.length) console.log(`                      cayó «${nuevas[0]}»${nuevas.length > 1 ? ` (y ${nuevas.length - 1} más)` : ''}`);
}
for (const [id, que, d] of CONTROLES) {
  if (SOLO && id !== SOLO) continue;
  let src;
  try { src = copia(path.join(TMP, id)); plantar(src, d); }
  catch (e) { console.log(`  NO SE PUDO PLANTAR ${id.padEnd(22)} ${e.message}`); noPlanta++; continue; }
  const nuevas = caidas(correrBanco(src)).filter((c) => !base.includes(c));
  if (nuevas.length) { ctrlRojo++; console.log(`  CONTROL ROJO        ${id.padEnd(22)} ${que}\n                      cayó «${nuevas[0]}»`); }
  else { ctrlVerde++; console.log(`  CONTROL VERDE       ${id.padEnd(22)} ${que}`); }
}
const todoBien = noVio === 0 && otro === 0 && noPlanta === 0 && ctrlRojo === 0;
console.log(`  ${todoBien ? 'VERDE' : 'ROJO '}  lo vio ${vio}/${DEFECTOS.length}  ·  por otro motivo ${otro}  ·  NO lo vio ${noVio}  ·  no se pudo plantar ${noPlanta}  ·  controles ${ctrlVerde} verdes, ${ctrlRojo} rojos\n`);
process.exit(todoBien ? 0 : 1);
