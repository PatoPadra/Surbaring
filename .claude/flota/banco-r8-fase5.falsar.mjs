/**
 * FALSADOR DE LA FASE 5 (piedra), mitad Node — ronda 8.
 *
 * Planta en una copia de `src/` los defectos de «la piedra paso a paso»: en los datos
 * (`herramientas.json`, `historia.json`) y en `Fabricacion.js`. Corre las secciones 1 a 5
 * del banco y mira que caiga la aserción que tiene que caer. Los defectos buscan los
 * objetos como los busca el banco (por lo que producen o lo que piden), así no dependen
 * de los ids que elija el agente. Trae controles.
 *
 * Uso: node .claude/flota/banco-r8-fase5.falsar.mjs [--fuente <carpeta src>] [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f5');
const BANCO = path.join(AQUI, 'banco-r8-fase5.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FUENTE = arg('--fuente') ? path.resolve(arg('--fuente')) : path.join(RAIZ, 'src');
const SOLO = arg('--solo');
const MARTILLOS = ['martillo_piedra', 'maza_piedra', 'martillo_de_piedra'];

/** Un defecto sobre los datos: recibe { H, HI } parseados y los cambia en el lugar. */
const enDatos = (fn) => ({ datos: fn });
const obj = (H, id) => { const o = H.objetos.find((x) => x.id === id); if (!o) throw new Error(`no encuentro ${id}`); return o; };
const produce = (H, r) => { const o = H.objetos.find((x) => (x.produce || []).some((p) => p.recurso === r)); if (!o) throw new Error(`nadie produce ${r}`); return o; };
const martillo = (H) => { const o = H.objetos.find((x) => MARTILLOS.includes(x.id)); if (!o) throw new Error('no hay martillo'); return o; };
const usosDelMartillo = (H) => H.objetos.filter((x) => [].concat(x.pideHerramienta || []).includes(martillo(H).id));

const DEFECTOS = [
  ['lasca-con-obsidiana', 'la lasca de rodado vuelve a pedir la talla de obsidiana', enDatos(({ H }) => { obj(H, 'lasca_rodado').tecnologia = 'lasca_obsidiana'; }), ['P2 · la lasca de rodado no pide tecnología']],
  ['hacha-con-tiento', 'el hacha vuelve a atarse con tiento', enDatos(({ H }) => { obj(H, 'hacha_piedra').materiales.push({ recurso: 'tiento', cantidad: 4 }); }), ['P6 · sin tiento ni cuero', 'el planificador termina con el hacha']],
  ['hacha-cara', 'el hacha pide una tecnología de 16 de saber', enDatos(({ H, HI }) => {
    const t = HI.tecnologias.find((x) => x.id === 'hacha_pulida'); if (!t) throw new Error('no hay hacha_pulida');
    t.costoSaber = 16; t.requiere = []; obj(H, 'hacha_piedra').tecnologia = 'hacha_pulida';
  }), ['P6 · si pide tecnología', 'el planificador termina con el hacha']],
  ['mango-solo-obsidiana', 'el mango pide sólo la lasca de obsidiana', enDatos(({ H }) => { obj(H, 'mango_labrado').pideHerramienta = 'lasca'; }), ['P5 · y pide algo que corte']],
  ['pulido-sin-arena', 'el pulido ya no lleva arena', enDatos(({ H }) => { const p = produce(H, 'hoja_hacha'); p.materiales = p.materiales.filter((m) => m.recurso !== 'arena'); }), ['P4 · una receta produce la hoja']],
  ['percutor-con-saber', 'el percutor pide una tecnología', enDatos(({ H }) => { obj(H, 'percutor').tecnologia = 'lasca_obsidiana'; }), ['P1 · existe el percutor']],
  ['martillo-sin-uso', 'ninguna receta pide el martillo', enDatos(({ H }) => { for (const u of usosDelMartillo(H)) { const hs = [].concat(u.pideHerramienta).filter((x) => x !== martillo(H).id); u.pideHerramienta = hs.length ? hs : undefined; } }), ['alguna receta pide el martillo']],
  ['martillo-con-cuero', 'el uso del martillo pide cuero', enDatos(({ H }) => { for (const u of usosDelMartillo(H)) u.materiales = [...(u.materiales || []), { recurso: 'cuero', cantidad: 1 }]; }), ['se hace la primera semana']],
  ['objeto-perdido', 'la honda pasa a pedir la talla de obsidiana', enDatos(({ H }) => { obj(H, 'honda').tecnologia = 'lasca_obsidiana'; }), ['sin saber: los 9 de hoy']],
  ['sin-salas', 'el hacha deja de citar a Salas', enDatos(({ H }) => { const h = obj(H, 'hacha_piedra'); for (const k of ['nota', 'fuente', 'referencia', 'porQueExiste']) if (typeof h[k] === 'string') h[k] = h[k].replace(/Salas/g, 'alguien'); }), ['el hacha cita a Salas']],
  ['fabricacion-una-sola', 'Fabricacion vuelve a mirar una sola herramienta', { fabricacion: (t) => {
    const ancla = /herramientaQueFalta\(obj\)\s*\{/;
    if (!ancla.test(t)) throw new Error('no encuentro herramientaQueFalta');
    return t.replace(ancla, (m) => `${m}\n    if (Array.isArray(obj.pideHerramienta)) { const id0 = obj.pideHerramienta[obj.pideHerramienta.length - 1]; if (!(this.equipo?.tiene(id0) && !this.equipo.gastado(id0))) return this.equipo?.definicion?.(id0) || { id: id0, nombre: id0 }; return null; }`);
  } }, ['el planificador termina con el hacha']],
];
const CONTROLES = [
  ['control-peso', 'el percutor pesa un poco más', enDatos(({ H }) => { const p = obj(H, 'percutor'); p.kg = (p.kg || 0.4) + 0.1; })],
  ['control-uso-nuevo', 'el martillo suma otro uso, también de la primera semana', enDatos(({ H }) => {
    H.objetos.push({ id: 'control_estaca', nombre: 'Estaca', categoria: 'insumo', nivel: 1, tecnologia: null, donde: 'bolso', materiales: [{ recurso: 'madera', cantidad: 1 }], produce: [{ recurso: 'estaca', cantidad: 2 }], esReceta: true, pideHerramienta: martillo(H).id, nota: 'Control del falsador: un uso más del martillo, de la primera semana, sin cuero ni obsidiana.' });
  })],
  ['control-comentario', 'un comentario más en Fabricacion.js', { fabricacion: (t) => `${t}\n// Comentario de control del falsador.\n` }],
];

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
    fs.writeFileSync(fh, JSON.stringify(H, null, 2)); fs.writeFileSync(fhi, JSON.stringify(HI, null, 2));
  }
  if (d.fabricacion) {
    const f = path.join(src, 'systems', 'Fabricacion.js');
    fs.writeFileSync(f, d.fabricacion(fs.readFileSync(f, 'utf8')));
  }
}
function correrBanco(src) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: 'cadena,primeraHora,martillo,nadiePeor,notas', BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULTADO '));
  try { return JSON.parse(linea.slice('@@RESULTADO '.length)); } catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => res.error ? [`(no corrió: ${res.error.slice(-300)})`] : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`]));

console.log(`\n  FALSADOR R8 · FASE 5, mitad Node   (fuente: ${path.relative(RAIZ, FUENTE)} · copias en ${path.relative(RAIZ, TMP)})`);
if (process.argv.includes('--sintaxis')) {
  for (const [id, , d] of [...DEFECTOS, ...CONTROLES]) {
    try { const src = copia(path.join(TMP, 'sintaxis')); plantar(src, d); console.log(`  se planta  ${id}`); } catch (e) { console.log(`  NO se planta ${id}: ${e.message}`); }
  }
  process.exit(0);
}
const base = caidas(correrBanco(copia(path.join(TMP, 'limpio'))));
if (base.length) { console.log(`  ROJO  la fuente limpia tiene ${base.length} aserciones caídas:\n${base.map((c) => `          ${c}`).join('\n')}`); process.exit(1); }
console.log('  fuente limpia: todas verdes');
let vio = 0, otro = 0, nunca = 0, sin = 0, ok = 0, mal = 0;
for (const [id, que, d, esperadas] of DEFECTOS) {
  if (SOLO && SOLO !== id) continue;
  const src = copia(path.join(TMP, id));
  try { plantar(src, d); } catch (e) { sin++; console.log(`  NO SE PLANTÓ        ${id.padEnd(22)} ${e.message}`); continue; }
  const c = caidas(correrBanco(src));
  const dio = esperadas.every((e) => c.some((x) => x.includes(e)));
  if (dio) vio++; else if (c.length) otro++; else nunca++;
  console.log(`  ${dio ? 'LO VIO           ' : c.length ? 'POR OTRO MOTIVO  ' : 'NO LO VIO        '}   ${id.padEnd(22)} ${que}`);
  if (c.length) console.log(`                      cayó «${c.find((x) => esperadas.some((e) => x.includes(e))) || c[0]}»${c.length > 1 ? ` (y ${c.length - 1} más)` : ''}`);
}
for (const [id, que, d] of CONTROLES) {
  if (SOLO && SOLO !== id) continue;
  const src = copia(path.join(TMP, id));
  plantar(src, d);
  const c = caidas(correrBanco(src));
  if (c.length) mal++; else ok++;
  console.log(`  ${c.length ? 'CONTROL ROJO     ' : 'CONTROL VERDE    '}   ${id.padEnd(22)} ${que}`);
  if (c.length) console.log(`                      el banco fija de más, cayó: ${c.join(' · ')}`);
}
const total = DEFECTOS.filter(([id]) => !SOLO || SOLO === id).length;
const verde = vio === total && mal === 0;
console.log(`  ${verde ? 'VERDE' : 'ROJO '}  lo vio ${vio}/${total}  ·  por otro motivo ${otro}  ·  NO lo vio ${nunca}  ·  no se pudo plantar ${sin}  ·  controles ${ok} verdes, ${mal} rojos\n`);
process.exitCode = verde ? 0 : 1;
