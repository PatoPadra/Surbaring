/**
 * FALSADOR DE LA FASE 1 (iconos) — ronda 9, mitad Node.
 *
 * Copia `src/` a una carpeta aparte, planta un defecto a la vez sobre
 * `src/ui/Iconos.js`, corre `banco-r9-fase1.mjs` contra la copia
 * (`BANCO_SRC=<copia>`, `BANCO_SIN_BUILD=1`) y mira que caiga la sección que
 * tiene que caer. Trae controles: cambios inocentes que el banco tiene que
 * dejar pasar. Lo que este falsador NO planta es un defecto puramente visual
 * (un ícono corrido o recortado): eso lo mide `banco-r9-fase1.navegador.js`, que
 * necesita un Vite sirviendo la copia — se valida a mano, una vez, contra este
 * mismo falsador (ver la nota al final).
 *
 * Uso: node .claude/flota/banco-r9-fase1.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r9f1');
const BANCO = path.join(AQUI, 'banco-r9-fase1.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SOLO = arg('--solo');

function limpiarTmp() {
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 }); }
  catch (e) { console.log(`  (no se pudo limpiar ${TMP}: ${e.message} — no es fatal)`); }
}

function copiarBase() {
  limpiarTmp();
  fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true, preserveTimestamps: true });
  return path.join(TMP, 'src', 'ui', 'Iconos.js');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: path.dirname(path.dirname(src)), BANCO_SIN_BUILD: '1', BANCO_JSON: '1' },
  });
  const m = (r.stdout || '').match(/@@RESULTADO (.+)/);
  if (!m) return { secciones: [], crudo: (r.stdout || '') + (r.stderr || '') };
  return { secciones: JSON.parse(m[1]), crudo: '' };
}

function estadoDe(secciones, num) {
  const s = secciones.find((x) => x.num === num);
  if (!s) return null;
  return s.feliz && s.checks.every((c) => c.ok) ? 'VERDE' : 'ROJO';
}

const DEFECTOS = [
  { id: 'hoja-inflada', seccion: 2, que: 'la hoja crece 20 kB de relleno inútil',
    texto: (t) => t.replace(
      /export function hoja\(\) \{/,
      "export function hoja() { globalThis.__relleno_falsador = 'x'.repeat(20 * 1024);",
    ).replace(
      /_hoja = filas\.join\(''\);/,
      "_hoja = filas.join('') + '/*' + globalThis.__relleno_falsador + '*/';",
    ) },
  { id: 'clasede-rota', seccion: 1, que: 'claseDe() deja de devolver CLASE_BASE',
    texto: (t) => {
      const vieja = '`${CLASE_BASE} ic-${id}` : `${CLASE_BASE} ${CLASE_RESERVA}`;';
      if (!t.includes(vieja)) throw new Error('no encuentro el cuerpo de claseDe() para mutar');
      return t.replace(vieja, '`ic-${id}` : `${CLASE_RESERVA}`;');
    } },
  { id: 'ids-vacio', seccion: 1, que: 'IDS pierde casi todos los íconos',
    texto: (t) => t.replace(
      'export const IDS = Object.keys(RECETAS);',
      'export const IDS = Object.keys(RECETAS).slice(0, 3);',
    ) },
  { id: 'sin-cache', seccion: 3, que: 'hoja() se reconstruye en cada llamada (dos llamadas dan strings distintos)',
    texto: (t) => t.replace(
      'let _hoja = null;',
      'let _hoja = null;\nlet __contadorFalsador = 0;',
    ).replace(
      'if (_hoja !== null) return _hoja;',
      'if (_hoja !== null) return _hoja + "/*" + (++__contadorFalsador) + "*/";',
    ) },
];

const CONTROLES = [
  { id: 'control-comentario', que: 'un comentario más al final del archivo, nada más',
    texto: (t) => t + '\n// Comentario de control del falsador.\n' },
  { id: 'control-nota-interna', que: 'una constante sin usar, nada más',
    texto: (t) => t.replace('const CAJA = 64;', 'const CAJA = 64;\nconst __NOTA_CONTROL = true;') },
];

function aplicarYProbar(caso, esperaRojoEnSeccion) {
  const archivo = copiarBase();
  const original = fs.readFileSync(archivo, 'utf8');
  const nuevo = caso.texto(original);
  if (nuevo === original) throw new Error(`el defecto "${caso.id}" no cambió nada — el patrón no matcheó`);
  fs.writeFileSync(archivo, nuevo);
  const { secciones, crudo } = correrBanco(archivo);
  if (!secciones.length) throw new Error(`el banco no produjo @@RESULTADO para "${caso.id}": ${crudo.slice(-500)}`);
  return { secciones, estados: secciones.map((s) => ({ num: s.num, nombre: s.nombre, verde: s.feliz && s.checks.every((c) => c.ok) })) };
}

console.log('\n  FALSADOR R9 · FASE 1 — iconos\n');
let vistos = 0, total = 0;

for (const d of DEFECTOS) {
  if (SOLO && d.id !== SOLO) continue;
  total++;
  try {
    const { estados } = aplicarYProbar(d);
    const seccionCayo = estados.find((e) => e.num === d.seccion && !e.verde);
    const otrasCayeron = estados.filter((e) => e.num !== d.seccion && !e.verde);
    const visto = !!seccionCayo;
    if (visto) vistos++;
    console.log(`  ${visto ? 'VISTO ' : 'CIEGO '} ${d.id.padEnd(20)} ${d.que}`);
    if (!visto) console.log(`         esperaba rojo en sección ${d.seccion}, dio: ${JSON.stringify(estados)}`);
    if (otrasCayeron.length) console.log(`         (además cayeron: ${otrasCayeron.map((e) => e.num).join(',')} — no es necesariamente un problema)`);
  } catch (e) {
    console.log(`  ERROR  ${d.id.padEnd(20)} ${e.message}`);
  }
}

/**
 * Antes de que el agente reempaquete la hoja, la sección 2 (peso ≤ 132 kB) está
 * SIEMPRE roja contra la base sin tocar (137,78 kB) — es justo el problema que abre
 * esta fase, no un efecto del control. Se ignora acá a propósito; una vez que la
 * fase esté cerrada con la hoja bajo el techo, conviene volver a correr esto sin
 * el filtro para confirmar que un control de verdad no ensucia nada.
 */
const IGNORAR_HASTA_QUE_CIERRE_LA_FASE = new Set([2]);

let controlesOk = 0;
for (const c of CONTROLES) {
  if (SOLO && c.id !== SOLO) continue;
  total++;
  try {
    const { estados } = aplicarYProbar(c);
    const relevantes = estados.filter((e) => !IGNORAR_HASTA_QUE_CIERRE_LA_FASE.has(e.num));
    const todoVerde = relevantes.every((e) => e.verde);
    if (todoVerde) controlesOk++;
    console.log(`  ${todoVerde ? 'OK    ' : 'FALSO+'} ${c.id.padEnd(20)} ${c.que}`);
    if (!todoVerde) console.log(`         un control inocente puso algo en rojo: ${JSON.stringify(relevantes.filter((e) => !e.verde))}`);
  } catch (e) {
    console.log(`  ERROR  ${c.id.padEnd(20)} ${e.message}`);
  }
}

limpiarTmp();

console.log(`\n  defectos vistos: ${vistos}/${DEFECTOS.length}   controles limpios: ${controlesOk}/${CONTROLES.length}`);
console.log(`\n  NOTA: el defecto puramente visual (un ícono corrido o mal recortado en el`);
console.log(`  sprite) no lo puede plantar este falsador de Node — lo mide`);
console.log(`  banco-r9-fase1.navegador.js, con un Vite real sirviendo la copia mutada.`);
console.log(`  Se validó a mano una vez (ver RONDA9.md).\n`);

process.exitCode = (vistos === DEFECTOS.length && controlesOk === CONTROLES.length) ? 0 : 1;
