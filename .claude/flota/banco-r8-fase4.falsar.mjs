/**
 * FALSADOR DE LA FASE 4 (copa), mitad Node — ronda 8.
 *
 * Copia `src/`, `tools/` y `public/tex/follaje/` a una carpeta aparte, planta un defecto
 * por vez (en el horno, en lo que escribe, en el manifiesto, en `Vegetacion.js`), corre
 * las secciones del banco que no son la regresión ni el arranque, y mira que caiga la
 * aserción que tiene que caer. Trae controles: cambios inocentes que el banco tiene que
 * dejar pasar.
 *
 * Los defectos del horno se plantan AGREGANDO código al final de `tools/hornear-follaje.mjs`
 * (corre después de que el horno escribió): así no dependen de cómo lo escriba el agente.
 * Los de `Vegetacion.js` envuelven las funciones exportadas.
 *
 * Uso: node .claude/flota/banco-r8-fase4.falsar.mjs [--solo <id>] [--sintaxis]
 *      [--secciones clases,modelo] para validar sólo lo que no pide horno (antes del agente,
 *      con BANCO_F4_FUENTE_VEG=<un Vegetacion.js de maqueta>)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r8f4');
const BANCO = path.join(AQUI, 'banco-r8-fase4.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SOLO = arg('--solo');
const SECCIONES = arg('--secciones') || 'horno,hoja,clases,modelo';
const FUENTE_VEG = process.env.BANCO_F4_FUENTE_VEG ? path.resolve(process.env.BANCO_F4_FUENTE_VEG) : null;
const FUENTE_HORNO = process.env.BANCO_F4_FUENTE_HORNO ? path.resolve(process.env.BANCO_F4_FUENTE_HORNO) : null;

// ── Lo que se agrega al final del horno ─────────────────────────────────────
const cabeza = `
;{
const __fs = await import('node:fs'); const __path = await import('node:path'); const __url = await import('node:url');
const __dir = __path.join(__path.dirname(__url.fileURLToPath(import.meta.url)), '..', 'public', 'tex', 'follaje');
const __man = JSON.parse(__fs.readFileSync(__path.join(__dir, 'manifiesto.json'), 'utf8'));
const __clases = Array.isArray(__man.clases) ? __man.clases : Object.entries(__man.clases || {}).map(([id, v]) => ({ id, ...v }));
const __archivo = (id) => { const c = __clases.find((x) => x.id === id); return __path.join(__dir, c.archivo || c.archivos?.albedo || c.albedo); };
const { PNG: __PNG } = (await import('pngjs')).default;
`;
const pie = '\n}\n';
const alFinalDelHorno = (codigo) => (t) => t + cabeza + codigo + pie;

/** Renombra la función exportada y la envuelve. */
function envolverExport(t, nombre, cuerpo) {
  const re = new RegExp(`export\\s+function\\s+${nombre}\\s*\\(`);
  if (!re.test(t)) throw new Error(`no encuentro export function ${nombre}`);
  return t.replace(re, `function ${nombre}__orig(`) + `\nexport function ${nombre}(esp) {\n${cuerpo}\n}\n`;
}
const armador = (t) => (/export\s+function\s+construirPlanta\s*\(/.test(t) ? 'construirPlanta' : 'modeloDe');

const DEFECTOS = [
  { id: 'horno-con-reloj', seccion: 'horno', archivo: 'tools/hornear-follaje.mjs', que: 'el horno escribe la hora en su manifiesto', caeEn: 'mismos bytes',
    texto: alFinalDelHorno("__man.hora = Date.now() + Math.random(); __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2));") },
  { id: 'aguja-rala', seccion: 'horno', archivo: 'tools/hornear-follaje.mjs', que: 'el atlas de la aguja queda casi transparente', caeEn: 'aguja: cobertura de alfa de 0,18',
    texto: alFinalDelHorno("{ const f = __archivo('aguja'); const p = __PNG.sync.read(__fs.readFileSync(f)); for (let i = 0; i < p.width * p.height; i++) if (i % 10) p.data[i * 4 + 3] = 0; __fs.writeFileSync(f, __PNG.sync.write(p)); }") },
  { id: 'escama-damero', seccion: 'horno', archivo: 'tools/hornear-follaje.mjs', que: 'el atlas de la escama es un damero de un píxel: el mipmap lo llena', caeEn: 'escama: la cobertura no se pierde en los mipmaps',
    texto: alFinalDelHorno("{ const f = __archivo('escama'); const p = __PNG.sync.read(__fs.readFileSync(f)); for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) p.data[(y * p.width + x) * 4 + 3] = ((x + y) % 2) ? 255 : 0; __fs.writeFileSync(f, __PNG.sync.write(p)); }") },
  { id: 'hoja-gigante', seccion: 'hoja', archivo: 'tools/hornear-follaje.mjs', que: 'el manifiesto declara la hoja del nothofagus diez veces más grande', caeEn: 'nothofagus: la hoja en el mundo mide menos de 3 veces',
    texto: alFinalDelHorno("{ const c = __clases.find((x) => x.id === 'nothofagus'); c.hojaPx = c.hojaPx * 10; if (Array.isArray(__man.clases)) __man.clases = __clases; else __man.clases = Object.fromEntries(__clases.map(({ id, ...v }) => [id, v])); __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2)); }") },
  { id: 'sin-pxPorMetro', seccion: 'hoja', archivo: 'src/world/Vegetacion.js', que: 'las tarjetas no se dimensionan con pxPorMetro', caeEn: 'dimensiona las tarjetas con pxPorMetro',
    texto: (t) => { if (!/pxPorMetro/.test(t)) throw new Error('Vegetacion.js no nombra pxPorMetro'); return t.replace(/pxPorMetro/g, 'pxPorMtr'); } },
  { id: 'cipres-ancha', seccion: 'clases', archivo: 'src/world/Vegetacion.js', que: 'el ciprés recibe la hoja ancha', caeEn: 'cipres_cordillera → escama',
    texto: (t) => envolverExport(t, 'claseHojaDe', "  return esp?.id === 'cipres_cordillera' ? 'ancha' : claseHojaDe__orig(esp);") },
  { id: 'modelo-al-azar', seccion: 'modelo', archivo: 'src/world/Vegetacion.js', que: 'el modelo vuelve a depender de Math.random', caeEn: 'la misma geometría byte a byte',
    texto: (t) => envolverExport(t, armador(t), `  const g = ${armador(t)}__orig(esp); const a = g.getAttribute('position'); a.array[0] += Math.random() * 1e-3; return g;`) },
  { id: 'modelo-unico', seccion: 'modelo', archivo: 'src/world/Vegetacion.js', que: 'todas las especies con el mismo modelo', caeEn: 'cada especie tiene la suya',
    texto: (t) => envolverExport(t, armador(t), `  globalThis.__primera ??= esp; return ${armador(t)}__orig(globalThis.__primera);`) },
];
const CONTROLES = [
  { id: 'control-horno-leeme', seccion: 'horno', archivo: 'tools/hornear-follaje.mjs', que: 'el horno escribe además un LEEME fijo',
    texto: alFinalDelHorno("__fs.writeFileSync(__path.join(__dir, 'LEEME.txt'), 'Salida de tools/hornear-follaje.mjs. No se edita a mano.\\n');") },
  { id: 'control-comentario', seccion: 'clases', archivo: 'src/world/Vegetacion.js', que: 'un comentario más en Vegetacion.js', texto: (t) => t + '\n// Comentario de control del falsador.\n' },
  { id: 'control-envoltura', seccion: 'modelo', archivo: 'src/world/Vegetacion.js', que: 'el armado envuelto sin cambiar nada',
    texto: (t) => envolverExport(t, armador(t), `  return ${armador(t)}__orig(esp);`) },
];

function copiar(dest) {
  fs.rmSync(dest, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  fs.cpSync(path.join(RAIZ, 'src'), path.join(dest, 'src'), { recursive: true, preserveTimestamps: true });
  if (FUENTE_VEG) fs.copyFileSync(FUENTE_VEG, path.join(dest, 'src', 'world', 'Vegetacion.js'));
  if (fs.existsSync(path.join(RAIZ, 'tools'))) fs.cpSync(path.join(RAIZ, 'tools'), path.join(dest, 'tools'), { recursive: true, preserveTimestamps: true });
  if (FUENTE_HORNO) { fs.mkdirSync(path.join(dest, 'tools'), { recursive: true }); fs.copyFileSync(FUENTE_HORNO, path.join(dest, 'tools', 'hornear-follaje.mjs')); }
  const fol = path.join(RAIZ, 'public', 'tex', 'follaje');
  if (fs.existsSync(fol)) fs.cpSync(fol, path.join(dest, 'public', 'tex', 'follaje'), { recursive: true, preserveTimestamps: true });
  return path.join(dest, 'src');
}
function correrBanco(src) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 1200000,
    env: { ...process.env, BANCO_SRC: src, BANCO_SECCIONES: SECCIONES, BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULTADO '));
  try { return JSON.parse(linea.slice('@@RESULTADO '.length)); } catch { return { error: (r.stdout || '') + (r.stderr || '') }; }
}
const caidas = (res) => res.error ? [`(no corrió: ${res.error.slice(-300)})`] : res.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => `${s.num}·${c.desc}`).concat(s.feliz ? [] : [`${s.num}·CAMINO FELIZ`]));

console.log(`\n  FALSADOR R8 · FASE 4, mitad Node   (secciones: ${SECCIONES}${FUENTE_VEG ? ` · Vegetacion.js de ${path.relative(RAIZ, FUENTE_VEG)}` : ''} · copias en ${path.relative(RAIZ, TMP)})`);
if (process.argv.includes('--sintaxis')) {
  for (const d of [...DEFECTOS, ...CONTROLES]) {
    const f = path.join(RAIZ, d.archivo);
    const fuente = d.archivo.endsWith('Vegetacion.js') && FUENTE_VEG ? FUENTE_VEG : f;
    if (!fs.existsSync(fuente)) { console.log(`  todavía no existe   ${d.id.padEnd(22)} ${d.archivo}`); continue; }
    try { d.texto(fs.readFileSync(fuente, 'utf8')); console.log(`  se planta           ${d.id}`); } catch (e) { console.log(`  NO se planta        ${d.id.padEnd(22)} ${e.message}`); }
  }
  process.exit(0);
}
const limpio = copiar(path.join(TMP, 'limpio'));
const base = caidas(correrBanco(limpio));
if (base.length) { console.log(`  ROJO  la base tiene ${base.length} aserciones caídas:\n${base.slice(0, 12).map((c) => `          ${c}`).join('\n')}`); process.exit(1); }
console.log('  base limpia: todas verdes');
let vio = 0, otro = 0, nunca = 0, sin = 0, ok = 0, mal = 0;
const secc = SECCIONES.split(',');
const aplica = (d) => secc.includes(d.seccion);
for (const d of [...DEFECTOS, ...CONTROLES]) {
  if (SOLO && d.id !== SOLO) continue;
  if (!aplica(d)) continue;
  const src = copiar(path.join(TMP, d.id));
  const f = path.join(src, '..', d.archivo);
  let texto;
  try { texto = d.texto(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} ${e.message}`); sin++; continue; }
  fs.writeFileSync(f, texto);
  const c = caidas(correrBanco(src));
  if (CONTROLES.includes(d)) {
    if (c.length) { mal++; console.log(`  CONTROL ROJO        ${d.id.padEnd(22)} ${d.que}\n                      el banco fija de más, cayó: ${c.slice(0, 3).join(' · ')}`); }
    else { ok++; console.log(`  CONTROL VERDE       ${d.id.padEnd(22)} ${d.que}`); }
    continue;
  }
  const dio = c.find((x) => x.includes(d.caeEn));
  if (dio) vio++; else if (c.length) otro++; else nunca++;
  console.log(`  ${dio ? 'LO VIO           ' : c.length ? 'POR OTRO MOTIVO  ' : 'NO LO VIO        '}   ${d.id.padEnd(22)} ${d.que}`);
  if (c.length) console.log(`                      cayó «${dio || c[0]}»${c.length > 1 ? ` (y ${c.length - 1} más)` : ''}`);
}
const verde = nunca === 0 && otro === 0 && sin === 0 && mal === 0;
console.log(`  ${verde ? 'VERDE' : 'ROJO '}  lo vio ${vio}  ·  por otro motivo ${otro}  ·  NO lo vio ${nunca}  ·  no se pudo plantar ${sin}  ·  controles ${ok} verdes, ${mal} rojos\n`);
process.exitCode = verde ? 0 : 1;
