/**
 * FALSADOR DE LA FASE 2 (desgaste) — ronda 9.
 *
 * Copia `src/` a una carpeta aparte, planta un defecto a la vez, corre
 * `banco-r9-fase2.mjs` contra la copia (`BANCO_SRC=<copia>`,
 * `BANCO_SIN_BUILD=1`, `BANCO_SALTAR_REGRESION=1` — D7 corre contra el árbol
 * real y no tiene sentido copiarlo dos veces) y mira que caiga la sección que
 * tiene que caer. Trae controles: cambios inocentes que el banco tiene que
 * dejar pasar.
 *
 * Uso: node .claude/flota/banco-r9-fase2.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r9f2');
const BANCO = path.join(AQUI, 'banco-r9-fase2.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SOLO = arg('--solo');

function limpiarTmp() {
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 }); }
  catch (e) { console.log(`  (no se pudo limpiar ${TMP}: ${e.message} — no es fatal)`); }
}

function copiarBase() {
  limpiarTmp();
  fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true, preserveTimestamps: true });
  return path.join(TMP, 'src');
}

function correrBanco(srcDir) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: srcDir, BANCO_SIN_BUILD: '1', BANCO_SALTAR_REGRESION: '1', BANCO_JSON: '1' },
  });
  const m = (r.stdout || '').match(/@@RESULTADO (.+)/);
  if (!m) return { secciones: [], crudo: (r.stdout || '') + (r.stderr || '') };
  return { secciones: JSON.parse(m[1]) };
}

function estadoDe(secciones) {
  return secciones.map((s) => ({ num: s.num, nombre: s.nombre, verde: s.feliz && s.checks.every((c) => c.ok) }));
}

// El archivo real tiene fin de línea CRLF (Windows). Los patrones de acá abajo
// que buscan un salto de línea literal (`\n`) fallarían contra `\r\n` sin este
// paso — se trabaja en LF y se vuelve a CRLF al final. Encontrado el 29/9/2026
// revisando ESTE archivo: `sin-desgastarId` cortaba por una posición de bytes
// que `indexOf('\n  }\n', …)` nunca encontraba (daba -1), así que en vez de
// sacar el método duplicaba casi todo el archivo — y el "VISTO" que reportaba
// era un error de sintaxis tapando el hueco, no la aserción D1 cazando el
// defecto real. Con esto corregido, ver la nota al pie del archivo con el
// resultado verdadero.
function mutarArchivo(srcDir, relativo, transformar) {
  const archivo = path.join(srcDir, relativo);
  const original = fs.readFileSync(archivo, 'utf8');
  const eraCRLF = original.includes('\r\n');
  const enLF = eraCRLF ? original.replace(/\r\n/g, '\n') : original;
  const nuevoEnLF = transformar(enLF);
  if (nuevoEnLF === enLF) throw new Error(`la mutación en ${relativo} no cambió nada — el patrón no matcheó`);
  const nuevo = eraCRLF ? nuevoEnLF.replace(/\n/g, '\r\n') : nuevoEnLF;
  fs.writeFileSync(archivo, nuevo);
}

const DEFECTOS = [
  {
    id: 'sin-desgastarId', seccion: 1, que: 'Equipo.desgastarId no existe (se saca por completo)',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Equipo.js', (t) => {
      const marca = '  desgastarId(id, cuanto = 1) {';
      if (!t.includes(marca)) throw new Error('no encuentro desgastarId para sacar');
      const desde = t.indexOf(marca);
      const cierre = t.indexOf('\n  }\n', desde) + 5;
      return t.slice(0, desde) + t.slice(cierre);
    }),
  },
  {
    id: 'fabricacion-no-gasta', seccion: 2, que: 'fabricar() deja de llamar a desgastarId',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Fabricacion.js', (t) => {
      const vieja = 'if (herramientaUsada) this.equipo?.desgastarId?.(herramientaUsada);';
      if (!t.includes(vieja)) throw new Error('no encuentro la línea que gasta la herramienta');
      return t.replace(vieja, '// (sacado por el falsador)');
    }),
  },
  {
    id: 'gasta-la-fija', seccion: 2, que: '_herramientaUsada() siempre devuelve la primera de la lista, la tenga o no',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Fabricacion.js', (t) => {
      const vieja = "return pedidas.find(id => this.equipo?.tiene(id) && !this.equipo.gastado(id)) || null;";
      if (!t.includes(vieja)) throw new Error('no encuentro el cuerpo de _herramientaUsada');
      return t.replace(vieja, 'return pedidas[0] || null;');
    }),
  },
  // No hay un defecto de código de un solo punto para "el huso se gasta": restar
  // un número finito de Infinity da Infinity pase lo que pase (IEEE754), así que
  // CUALQUIER implementación razonable de "restar usos" deja al huso intacto sin
  // que haga falta ninguna guarda explícita para ESE caso puntual. Las guardas de
  // `_envejecer` protegen otras cosas (NaN, usos ya en 0, `efecto.luz`), no ésta.
  // Por eso D3 no tiene un defecto plantado acá: ya está comprobado a mano (ver
  // RONDA9.md) que el huso sigue en `Infinity` después de hilar seis veces.
  {
    id: 'balanceSaber-vuelve', seccion: 6, que: 'balanceSaber.arreglo vuelve a proponer la dependencia vieja',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'data/herramientas.json', (t) => {
      const marca = '"arreglo": "De los tres encadenamientos';
      if (!t.includes(marca)) throw new Error('no encuentro el arreglo corregido');
      return t.replace(
        /"arreglo": "[^"]*"/,
        '"arreglo": "hacha_pulida.requiere = [lasca_obsidiana]"',
      );
    }),
  },
];

const CONTROLES = [
  { id: 'control-comentario-equipo', que: 'un comentario más en Equipo.js, nada más',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Equipo.js', (t) => t + '\n// Comentario de control del falsador.\n') },
  { id: 'control-comentario-fabricacion', que: 'un comentario más en Fabricacion.js, nada más',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Fabricacion.js', (t) => t + '\n// Comentario de control del falsador.\n') },
];

function aplicarYProbar(caso) {
  const srcDir = copiarBase();
  caso.aplicar(srcDir);
  const { secciones, crudo } = correrBanco(srcDir);
  if (!secciones.length) throw new Error(`el banco no produjo @@RESULTADO: ${crudo?.slice(-500)}`);
  return estadoDe(secciones);
}

console.log('\n  FALSADOR R9 · FASE 2 — desgaste\n');
let vistos = 0, total = 0;

for (const d of DEFECTOS) {
  if (SOLO && d.id !== SOLO) continue;
  total++;
  try {
    const estados = aplicarYProbar(d);
    const cayo = estados.find((e) => e.num === d.seccion && !e.verde);
    const visto = !!cayo;
    if (visto) vistos++;
    console.log(`  ${visto ? 'VISTO ' : 'CIEGO '} ${d.id.padEnd(28)} ${d.que}`);
    if (!visto) console.log(`         esperaba rojo en sección ${d.seccion}, dio: ${JSON.stringify(estados)}`);
  } catch (e) {
    console.log(`  ERROR  ${d.id.padEnd(28)} ${e.message}`);
  }
}

let controlesOk = 0;
for (const c of CONTROLES) {
  if (SOLO && c.id !== SOLO) continue;
  total++;
  try {
    const estados = aplicarYProbar(c);
    const todoVerde = estados.every((e) => e.verde);
    if (todoVerde) controlesOk++;
    console.log(`  ${todoVerde ? 'OK    ' : 'FALSO+'} ${c.id.padEnd(28)} ${c.que}`);
    if (!todoVerde) console.log(`         un control inocente puso algo en rojo: ${JSON.stringify(estados.filter((e) => !e.verde))}`);
  } catch (e) {
    console.log(`  ERROR  ${c.id.padEnd(28)} ${e.message}`);
  }
}

limpiarTmp();

console.log(`\n  defectos vistos: ${vistos}/${DEFECTOS.length}   controles limpios: ${controlesOk}/${CONTROLES.length}\n`);
process.exitCode = (vistos === DEFECTOS.length && controlesOk === CONTROLES.length) ? 0 : 1;
