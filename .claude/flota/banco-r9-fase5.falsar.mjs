/**
 * FALSADOR DE LA FASE 5 (dormir-b) — ronda 9.
 *
 * Escrito por el jefe con el código del agente a la vista (las anclas dependen de
 * cómo lo escribió), sin tocar el banco. Dos mitades:
 *
 * NODE (automática): planta sobre una COPIA de `src/` y corre
 * `banco-r9-fase5.mjs` con `BANCO_SRC`. Sólo M1 y M2 se pueden ver acá.
 *
 *   node .claude/flota/banco-r9-fase5.falsar.mjs
 *
 * NAVEGADOR (a mano, de a un defecto): `puedeDormir`/`dormir` viven en el cierre
 * de `main.js`, así que el defecto tiene que estar en el `src/main.js` que sirve
 * Vite. Se planta EN EL ARCHIVO REAL, con copia de respaldo, se recarga la
 * página, se corre `banco-r9-fase5.navegador.js` y se restaura:
 *
 *   node .claude/flota/banco-r9-fase5.falsar.mjs --plantar <id>
 *   (recargar, anular guardados, correr el banco del navegador)
 *   node .claude/flota/banco-r9-fase5.falsar.mjs --restaurar
 *
 * `--restaurar` comprueba que `src/main.js` vuelva byte a byte al respaldo.
 * `--lista` muestra los defectos y qué sección tiene que caer con cada uno.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const MAIN = path.join(RAIZ, 'src', 'main.js');
const TMP = path.join(AQUI, '.tmp-falsar-r9f5');
const RESPALDO = path.join(TMP, 'main.js.respaldo');
const BANCO = path.join(AQUI, 'banco-r9-fase5.mjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// El repo es CRLF: se muta en LF y se devuelve a CRLF (el falsador de la fase 2
// cortaba buscando '\n  }\n' sobre CRLF y daba «visto» por un error de sintaxis).
const aLF = (t) => t.replace(/\r\n/g, '\n');
const aCRLF = (t) => t.replace(/\n/g, '\r\n');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

/** Reemplaza `viejo` por `nuevo` exactamente una vez; si no está una sola vez, no se planta. */
const cambiar = (viejo, nuevo) => (t) => {
  const n = t.split(viejo).length - 1;
  if (n !== 1) throw new Error(`el ancla aparece ${n} veces: ${JSON.stringify(viejo.slice(0, 60))}`);
  return t.replace(viejo, nuevo);
};

/** [id, qué, plantar, dónde tiene que caer] */
const NAVEGADOR = [
  ['sin-fundicion', 'el bucle de dormir no actualiza la fundición (el defecto de 4b)',
    cambiar('      fundicion.actualizar(est);\n      jugador.fuego = fuegoCercano(est);', '      jugador.fuego = fuegoCercano(est);'), 'N3'],
  ['tambien-de-dia', 'esDeNoche() dice que sí siempre',
    cambiar('return posicionSolar(tiempo.fecha, tiempo.lat, tiempo.lon).altura < 0;', 'return true;'), 'N1 (y N4: no despierta)'],
  ['solo-si-nada', 'dormir sale sólo si la cadena no ofrece nada (la prioridad de 4b)',
    cambiar('    if (!puedeDormir()) return accion;', '    if (accion || !puedeDormir()) return accion;'), 'N2, N6'],
  ['o-en-vez-de-y', 'refugio O fuego',
    cambiar('    if (!(construccion.abrigoEn(p.x, p.z) > 0)) return false;\n    return !!fundicion.cercano(',
      '    if (construccion.abrigoEn(p.x, p.z) > 0) return true;\n    return !!fundicion.cercano('), 'N5'],
  ['siete-fijas', 'despierta a las 7:00 fijas (10:00 UTC) y no con el sol',
    cambiar('while (jugador.vivo && esDeNoche() && tiempo.fecha.getTime() < limiteMs) {',
      'while (jugador.vivo && tiempo.fecha.getUTCHours() !== 10 && tiempo.fecha.getTime() < limiteMs) {'), 'N4'],
  ['sed-no-manda', 'beber con sed ya no le gana a dormir',
    cambiar("    if (accion?.tipo === 'beber' && jugador.sed < UMBRAL_SED) return accion;\n", ''), 'N6'],
  ['tope-14', 'el tope de seguridad vuelve a 14 h', cambiar('const TOPE_DORMIR_H = 16;', 'const TOPE_DORMIR_H = 14;'), 'N4 (junio)'],
];
const CONTROLES_NAVEGADOR = [
  ['control-comentario', 'un comentario más en el bloque de dormir',
    cambiar('  function puedeDormir() {', '  // Comentario de control del falsador.\n  function puedeDormir() {')],
  ['control-paso', 'el paso de mundo escrito como 360 y no como 6 * 60',
    cambiar('const PASO_DORMIR_MUNDO_S = 6 * 60;', 'const PASO_DORMIR_MUNDO_S = 360;')],
];
/** Lo que se ve en Node. */
const NODE = [
  ['92-duplicado', 'main.js vuelve a escribir el 92', cambiar('jugador.sed < UMBRAL_SED', 'jugador.sed < 92'), ['M1']],
  ['proximo-amanecer', 'vuelve setUTCHours(10…)', cambiar('  function esDeNoche() {',
    '  function proximoAmanecer(fecha) { const d = new Date(fecha.getTime()); d.setUTCHours(10, 0, 0, 0); return d; }\n  function esDeNoche() {'), ['M2']],
];
const CONTROLES_NODE = [
  ['control-92-en-comentario', 'el 92 en un comentario', cambiar('  function esDeNoche() {', '  // la sed manda por debajo de 92\n  function esDeNoche() {')],
];

const todos = [...NAVEGADOR, ...CONTROLES_NAVEGADOR];

if (process.argv.includes('--lista')) {
  for (const [id, que, , cae] of NAVEGADOR) console.log(`  ${id.padEnd(20)} ${que}  →  tiene que caer ${cae}`);
  for (const [id, que] of CONTROLES_NAVEGADOR) console.log(`  ${id.padEnd(20)} ${que}  →  todo verde`);
  process.exit(0);
}

if (process.argv.includes('--restaurar')) {
  if (!fs.existsSync(RESPALDO)) { console.log('  no hay respaldo: nada que restaurar'); process.exit(0); }
  const r = fs.readFileSync(RESPALDO);
  fs.writeFileSync(MAIN, r);
  const igual = sha(fs.readFileSync(MAIN)) === sha(r);
  console.log(`  ${igual ? 'VERDE' : 'ROJO '}  src/main.js restaurado (${sha(r)})`);
  if (igual) fs.rmSync(RESPALDO);
  process.exit(igual ? 0 : 1);
}

const plantar = arg('--plantar');
if (plantar) {
  const d = todos.find(([id]) => id === plantar);
  if (!d) { console.log(`  no conozco «${plantar}»: --lista`); process.exit(1); }
  fs.mkdirSync(TMP, { recursive: true });
  if (fs.existsSync(RESPALDO)) { console.log('  ya hay un defecto plantado: --restaurar primero'); process.exit(1); }
  const original = fs.readFileSync(MAIN, 'utf8');
  fs.writeFileSync(RESPALDO, original);
  try {
    fs.writeFileSync(MAIN, aCRLF(d[2](aLF(original))));
  } catch (e) {
    fs.writeFileSync(MAIN, original); fs.rmSync(RESPALDO);
    console.log(`  NO SE PLANTÓ ${plantar}: ${e.message}`); process.exit(1);
  }
  const chequeo = spawnSync(process.execPath, ['--check', MAIN], { encoding: 'utf8' });
  console.log(`  plantado ${plantar} (${d[1]})${d[3] ? ' → tiene que caer ' + d[3] : ' → control: todo verde'}`);
  console.log(`  sintaxis: ${chequeo.status === 0 ? 'válida' : 'ROTA — ' + chequeo.stderr.split('\n')[0]}`);
  process.exit(0);
}

// ── Mitad Node, automática ───────────────────────────────────────────────────
function correr(texto) {
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  fs.cpSync(path.join(RAIZ, 'src'), path.join(TMP, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'src', 'main.js'), aCRLF(texto));
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000,
    env: { ...process.env, BANCO_SRC: path.join(TMP, 'src'), BANCO_SIN_BUILD: '1' },
  });
  return [...`${r.stdout}`.matchAll(/ROJO\s+(M\d)/g)].map(m => m[1]);
}
const limpio = aLF(fs.readFileSync(MAIN, 'utf8'));
let vio = 0, total = 0, ctl = 0;
const base = correr(limpio);
console.log(`  base: ${base.length ? 'ROJO en ' + base.join(',') : 'verde'}`);
for (const [id, que, f, esperadas] of NODE) {
  total++;
  let caidas;
  try { caidas = correr(f(limpio)); } catch (e) { console.log(`  NO SE PLANTÓ ${id}: ${e.message}`); continue; }
  const ok = esperadas.every(x => caidas.includes(x));
  if (ok) vio++;
  console.log(`  ${ok ? 'LO VIO   ' : 'NO LO VIO'}  ${id.padEnd(18)} ${que} — cayó ${caidas.join(',') || 'nada'}`);
}
for (const [id, que, f] of CONTROLES_NODE) {
  const caidas = correr(f(limpio));
  if (!caidas.length) ctl++;
  console.log(`  ${caidas.length ? 'CONTROL ROJO' : 'control limpio'}  ${id.padEnd(18)} ${que}${caidas.length ? ' — cayó ' + caidas.join(',') : ''}`);
}
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
const verde = !base.length && vio === total && ctl === CONTROLES_NODE.length;
console.log(`\n  ${verde ? 'VERDE' : 'ROJO '}  mitad Node: lo vio ${vio}/${total} · controles ${ctl}/${CONTROLES_NODE.length} limpios`);
console.log('  La mitad navegador se corre a mano: --lista, --plantar <id>, --restaurar.');
process.exit(verde ? 0 : 1);
