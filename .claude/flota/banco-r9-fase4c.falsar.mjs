/**
 * FALSADOR DE LA FASE 4c (primer-año / hitos) — ronda 9.
 *
 * Copia `src/` a una carpeta aparte, planta un defecto a la vez sobre
 * `src/systems/Relevamiento.js`, corre `banco-r9-fase4c.mjs` contra la copia
 * y mira que caiga la sección que tiene que caer. Trae controles.
 *
 * Uso: node .claude/flota/banco-r9-fase4c.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-falsar-r9f4c');
const BANCO = path.join(AQUI, 'banco-r9-fase4c.mjs');
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
    cwd: RAIZ, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, BANCO_SRC: srcDir, BANCO_JSON: '1' },
  });
  const m = (r.stdout || '').match(/@@RESULTADO (.+)/);
  if (!m) return { secciones: [], crudo: (r.stdout || '') + (r.stderr || '') };
  return { secciones: JSON.parse(m[1]) };
}
function estadoDe(secciones) {
  return secciones.map((s) => ({ num: s.num, nombre: s.nombre, verde: s.feliz && s.checks.every((c) => c.ok) }));
}
// El archivo real tiene fin de línea CRLF (Windows); los patrones de acá están
// escritos con \n solo, así que se trabaja en LF y se vuelve a CRLF al final
// para no dejar un archivo con finales mezclados.
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
    id: 'no-persiste', seccion: 2, que: 'registrarMuerte() no guarda (falta this._guardar())',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Relevamiento.js', (t) => {
      const vieja = 'this.murioEnElAnio = true;\n    this._guardar();\n  }';
      if (!t.includes(vieja)) throw new Error('no encuentro el cuerpo de registrarMuerte()');
      return t.replace(vieja, 'this.murioEnElAnio = true;\n  }');
    }),
  },
  {
    id: 'toca-inicioMs', seccion: 1, que: 'registrarMuerte() reinicia inicioMs (justo lo que la pregunta 5 prohíbe)',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Relevamiento.js', (t) => {
      const vieja = 'this.murioEnElAnio = true;\n    this._guardar();\n  }';
      if (!t.includes(vieja)) throw new Error('no encuentro el cuerpo de registrarMuerte()');
      return t.replace(vieja, 'this.murioEnElAnio = true;\n    this.inicioMs = this.tiempo.fecha.getTime();\n    this._guardar();\n  }');
    }),
  },
  {
    id: 'sinMorir-invertido', seccion: 1, que: 'resumen().sinMorir queda invertido (dice true habiendo muerto)',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Relevamiento.js', (t) => {
      const vieja = 'sinMorir: !this.murioEnElAnio,';
      if (!t.includes(vieja)) throw new Error('no encuentro el campo sinMorir en resumen()');
      return t.replace(vieja, 'sinMorir: this.murioEnElAnio,');
    }),
  },
  {
    id: 'olvidar-no-limpia', seccion: 4, que: 'olvidar() deja de reiniciar la racha',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Relevamiento.js', (t) => {
      const vieja = 'this.cerrado = false;\n    this.murioEnElAnio = false;\n    this._guardar();\n  }';
      if (!t.includes(vieja)) throw new Error('no encuentro el cuerpo de olvidar()');
      return t.replace(vieja, 'this.cerrado = false;\n    this._guardar();\n  }');
    }),
  },
];

const CONTROLES = [
  { id: 'control-comentario', que: 'un comentario más, nada más',
    aplicar: (srcDir) => mutarArchivo(srcDir, 'systems/Relevamiento.js', (t) => t + '\n// Comentario de control del falsador.\n') },
];

function aplicarYProbar(caso) {
  const srcDir = copiarBase();
  caso.aplicar(srcDir);
  const { secciones, crudo } = correrBanco(srcDir);
  if (!secciones.length) throw new Error(`el banco no produjo @@RESULTADO: ${crudo?.slice(-500)}`);
  return estadoDe(secciones);
}

console.log('\n  FALSADOR R9 · FASE 4c — hitos\n');
let vistos = 0, total = 0;

for (const d of DEFECTOS) {
  if (SOLO && d.id !== SOLO) continue;
  total++;
  try {
    const estados = aplicarYProbar(d);
    const cayo = estados.find((e) => e.num === d.seccion && !e.verde);
    const visto = !!cayo;
    if (visto) vistos++;
    console.log(`  ${visto ? 'VISTO ' : 'CIEGO '} ${d.id.padEnd(22)} ${d.que}`);
    if (!visto) console.log(`         esperaba rojo en sección ${d.seccion}, dio: ${JSON.stringify(estados)}`);
  } catch (e) {
    console.log(`  ERROR  ${d.id.padEnd(22)} ${e.message}`);
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
    console.log(`  ${todoVerde ? 'OK    ' : 'FALSO+'} ${c.id.padEnd(22)} ${c.que}`);
    if (!todoVerde) console.log(`         un control inocente puso algo en rojo: ${JSON.stringify(estados.filter((e) => !e.verde))}`);
  } catch (e) {
    console.log(`  ERROR  ${c.id.padEnd(22)} ${e.message}`);
  }
}

limpiarTmp();

console.log(`\n  defectos vistos: ${vistos}/${DEFECTOS.length}   controles limpios: ${controlesOk}/${CONTROLES.length}\n`);
process.exitCode = (vistos === DEFECTOS.length && controlesOk === CONTROLES.length) ? 0 : 1;
