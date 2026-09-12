/**
 * BANCO DE LA FASE 3 (estampa) — ronda 6.
 *
 * Lo escribe el JEFE contra el contrato de RONDA6.md, en paralelo al agente y sin
 * leer su código. Carga `src/ui/Iconos.js` de verdad y le pide los 115.
 *
 *   1. LOS 115, SIN AGUJEROS — cada recurso y cada objeto que se tiene tiene su
 *      dibujo, y el de reserva se ve como reserva.
 *   2. UNA FAMILIA, NO 115 SUELTOS — el vocabulario y la paleta están en el
 *      código y se comparten; dos pueden parecerse, ninguno puede ser idéntico
 *      a otro; el arte es SVG que abre y cierra.
 *   3. LA HOJA — una sola, con una clase por icono, y NADA de SVG en línea por
 *      celda. ≤ 140 kB.
 *   4. EL BOLSO LOS USA — la casilla pide su clase, el bolso abre en el bolso, y
 *      el número de la esquina deja de ser ambiguo.
 *   5. SIN REGRESIÓN — los bancos de la fase 1, la fase 2 y la ronda 5 siguen
 *      verdes.
 *   6. ARRANQUE — `vite build`.
 *
 * Lo que este banco NO puede medir es si los dibujos **se entienden**. Para eso
 * está la hoja de contacto de A8 y el ojo del dueño. Un banco que dijera «los
 * iconos son buenos» estaría mintiendo, así que mide lo que se puede contar:
 * que estén todos, que sean distintos, que compartan vocabulario y que no
 * cuesten.
 *
 * Uso: node .claude/flota/banco-r6-fase3.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}`;
const leer = (rel) => fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');
const DATOS = JSON.parse(leer('data/herramientas.json'));
const COSAS = (DATOS.objetos || []).filter(o => !(o.esReceta || o.produce));

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** El módulo de iconos, o null si todavía no existe. */
async function iconos() {
  try { return await import(urlDe('ui/Iconos.js')); } catch { return null; }
}

/** Todos los ids que tienen que tener dibujo. */
async function todosLosIds() {
  const R = await import(urlDe('systems/Recursos.js'));
  return {
    recursos: Object.keys(R.RECURSOS),
    objetos: COSAS.map(o => o.id),
    todos: [...Object.keys(R.RECURSOS), ...COSAS.map(o => o.id)],
  };
}

/**
 * El arte de un id, sea cual sea la puerta que ofrezca el módulo. Se aceptan
 * varias a propósito: el contrato manda el resultado, no el nombre del método.
 */
function arteDe(I, id) {
  for (const f of ['arteDe', 'svgDe', 'dibujoDe', 'iconoDe'])
    if (typeof I[f] === 'function') { const v = I[f](id); if (typeof v === 'string') return v; }
  if (I.ARTE && typeof I.ARTE === 'object') return I.ARTE[id];
  if (I.ICONOS && typeof I.ICONOS === 'object') {
    const v = I.ICONOS[id];
    return typeof v === 'string' ? v : v?.svg ?? v?.arte;
  }
  return undefined;
}

function claseDe(I, id) {
  for (const f of ['claseDe', 'clasePara', 'claseIcono'])
    if (typeof I[f] === 'function') { const v = I[f](id); if (typeof v === 'string') return v; }
  return undefined;
}

function hojaDe(I) {
  for (const f of ['hoja', 'css', 'construirHoja', 'hojaDeEstilos'])
    if (typeof I[f] === 'function') { const v = I[f](); if (typeof v === 'string') return v; }
  for (const f of ['HOJA', 'CSS'])
    if (typeof I[f] === 'string') return I[f];
  return undefined;
}

// ── 1 · LOS 115, SIN AGUJEROS ───────────────────────────────────────────────

async function completos() {
  const s = seccion(1, 'LOS 115, SIN AGUJEROS');
  const I = await iconos();
  if (!I) { s.ok(false, 'existe src/ui/Iconos.js'); s.felizQue = 'no existe el módulo'; return s; }
  s.ok(true, 'existe src/ui/Iconos.js');

  const { recursos, objetos, todos } = await todosLosIds();
  s.ok(todos.length === 115, 'son 115 los que hay que dibujar', todos.length);

  const arte = new Map();
  for (const id of todos) { const a = arteDe(I, id); if (a) arte.set(id, a); }

  const md = arte.get('madera_dura');
  s.feliz = typeof md === 'string' && md.length > 40 && /<svg[\s>]/i.test(md);
  s.felizQue = `el arte de madera_dura ${md ? `mide ${md.length} caracteres` : 'no existe'}`;

  const faltanR = recursos.filter(id => !arte.has(id));
  const faltanO = objetos.filter(id => !arte.has(id));
  s.ok(faltanR.length === 0, `los ${recursos.length} recursos tienen dibujo`,
    faltanR.slice(0, 8).join(' '));
  s.ok(faltanO.length === 0, `los ${objetos.length} objetos tienen dibujo`,
    faltanO.slice(0, 8).join(' '));

  // El de reserva tiene que EXISTIR y tiene que ser distinto de los de verdad:
  // un id desconocido que cae en un cuadrado vacío es un agujero invisible, y
  // el próximo recurso que se agregue desaparecería sin que nadie se entere.
  const reserva = arteDe(I, '__no_existe_este_id__');
  s.ok(typeof reserva === 'string' && reserva.length > 20,
    'un id desconocido igual devuelve un dibujo', reserva ? `${reserva.length} caracteres` : reserva);
  const iguales = [...arte.values()].filter(a => a === reserva).length;
  s.ok(reserva === undefined || iguales === 0,
    'y el de reserva no es el de ninguno de los 115: el agujero se ve', iguales);

  return s;
}

// ── 2 · UNA FAMILIA, NO 115 SUELTOS ─────────────────────────────────────────

async function familia() {
  const s = seccion(2, 'UNA FAMILIA, NO 115 DIBUJOS SUELTOS');
  const I = await iconos();
  if (!I) { s.ok(false, 'existe el módulo'); s.felizQue = 'no existe el módulo'; return s; }
  const { todos } = await todosLosIds();
  const arte = todos.map(id => [id, arteDe(I, id)]).filter(([, a]) => typeof a === 'string');
  if (!arte.length) { s.ok(false, 'hay arte que mirar'); s.felizQue = 'no hay arte'; return s; }

  s.feliz = arte.length >= 100;
  s.felizQue = `hay arte para ${arte.length} de ${todos.length}`;

  // SVG que abre y cierra, con caja de coordenadas.
  const rotos = arte.filter(([, a]) => !/<svg[\s>]/i.test(a) || !/<\/svg>/i.test(a));
  s.ok(rotos.length === 0, 'todos son SVG que abre y cierra', rotos.slice(0, 4).map(([id]) => id).join(' '));
  const sinCaja = arte.filter(([, a]) => !/viewBox\s*=/i.test(a));
  s.ok(sinCaja.length === 0, 'todos declaran viewBox, así escalan con la casilla',
    sinCaja.slice(0, 4).map(([id]) => id).join(' '));

  // Ninguno idéntico a otro. Dos pueden parecerse; dos no pueden ser el mismo.
  const porArte = new Map();
  for (const [id, a] of arte) { const k = a.replace(/\s+/g, ' ').trim(); (porArte.get(k) || porArte.set(k, []).get(k)).push(id); }
  const repetidos = [...porArte.values()].filter(l => l.length > 1);
  s.ok(repetidos.length === 0, 'no hay dos iconos idénticos',
    repetidos.slice(0, 3).map(l => l.join('=')).join(' · '));
  s.nota(`${porArte.size} dibujos distintos para ${arte.length} ids`);

  // Que tengan cuerpo: un icono de dos formas no se distingue a 56 px.
  const formas = (a) => (a.match(/<(path|circle|rect|ellipse|polygon|polyline|line)[\s>]/gi) || []).length;
  const pobres = arte.filter(([, a]) => formas(a) < 3);
  s.ok(pobres.length === 0, 'ninguno tiene menos de 3 formas',
    pobres.slice(0, 6).map(([id, a]) => `${id}:${formas(a)}`).join(' '));
  const cuentas = arte.map(([, a]) => formas(a)).sort((x, y) => x - y);
  s.nota(`formas por icono: mín ${cuentas[0]} · mediana ${cuentas[cuentas.length >> 1]} · máx ${cuentas[cuentas.length - 1]}`);

  // Y que no sean todos el mismo dibujo con otro color: si al sacarles los
  // colores quedan menos de 25 siluetas distintas, esto es una paleta y no una
  // familia de dibujos.
  const sinColor = new Set(arte.map(([, a]) => a
    .replace(/#[0-9a-f]{3,8}/gi, '')
    .replace(/(fill|stroke|stop-color)\s*=\s*(['"])[^'"]*\2/gi, '')
    .replace(/\s+/g, ' ').trim()));
  s.ok(sinColor.size >= 25, 'hay al menos 25 siluetas distintas, no una sola pintada de 115 colores',
    sinColor.size);
  s.nota(`siluetas distintas ignorando el color: ${sinColor.size}`);

  // El vocabulario compartido tiene que verse en el código, no ser 115 blobs.
  const fuente = leer('ui/Iconos.js');
  s.ok(fuente.length > 0, 'se puede leer el módulo');
  const svgLiterales = (fuente.match(/<svg[\s>]/gi) || []).length;
  s.ok(svgLiterales <= 20,
    'no hay 115 SVG escritos a mano en el archivo: el vocabulario se comparte', svgLiterales);

  return s;
}

// ── 3 · LA HOJA ─────────────────────────────────────────────────────────────

async function hoja() {
  const s = seccion(3, 'LA HOJA — una sola, por clase, y sin SVG en línea');
  const I = await iconos();
  if (!I) { s.ok(false, 'existe el módulo'); s.felizQue = 'no existe el módulo'; return s; }
  const { todos } = await todosLosIds();

  const css = hojaDe(I);
  s.feliz = typeof css === 'string' && css.length > 1000;
  s.felizQue = `la hoja ${css ? `mide ${(css.length / 1024).toFixed(1)} kB` : 'no existe'}`;
  if (typeof css !== 'string') { s.ok(false, 'el módulo entrega una hoja de estilos', typeof css); return s; }
  s.ok(true, 'el módulo entrega una hoja de estilos');

  const kB = Buffer.byteLength(css, 'utf8') / 1024;
  s.ok(kB <= 140, 'la hoja pesa 140 kB o menos', `${kB.toFixed(1)} kB`);
  s.nota(`hoja: ${kB.toFixed(1)} kB para ${todos.length} iconos, ${(kB * 1024 / todos.length).toFixed(0)} bytes cada uno`);

  // Una clase por icono, y que la clase que pide el bolso exista en la hoja.
  let conClase = 0, sinEnHoja = [];
  for (const id of todos) {
    const c = claseDe(I, id);
    if (!c) continue;
    conClase++;
    const ultima = c.trim().split(/\s+/).pop();
    if (!css.includes('.' + ultima)) sinEnHoja.push(id);
  }
  s.ok(conClase === todos.length, 'cada id sabe decir su clase', `${conClase}/${todos.length}`);
  s.ok(sinEnHoja.length === 0, 'y esa clase está en la hoja',
    sinEnHoja.slice(0, 6).join(' '));

  s.ok(/background-image\s*:\s*url\(/i.test(css) || /background\s*:[^;]*url\(/i.test(css),
    'el dibujo viaja como imagen de fondo, que es lo que no cuesta repintar');

  // Lo que el contrato prohíbe explícitamente, porque cuesta doce veces más.
  const fuenteBolso = leer('ui/Bolso.js');
  const svgEnBolso = (fuenteBolso.match(/<svg[\s>]/gi) || []).length;
  s.ok(svgEnBolso === 0, 'el bolso NO arma SVG en línea por celda', svgEnBolso);

  return s;
}

// ── 4 · EL BOLSO LOS USA ────────────────────────────────────────────────────

async function bolso() {
  const s = seccion(4, 'EL BOLSO LOS USA, Y ABRE EN EL BOLSO');
  const fuente = leer('ui/Bolso.js');
  const I = await iconos();

  s.ok(/from\s+['"]\.\/Iconos\.js['"]/.test(fuente) || /Iconos\.js/.test(fuente),
    'el bolso importa los iconos');

  // A6 · la grilla antes que el taller. Se mide por el orden en el que el
  // archivo arma el panel, que es el orden en el que se ve.
  const iGrilla = Math.min(...['CASILLEROS', 'casillas', '_pintarGrilla', 'data-cs']
    .map(t => { const i = fuente.indexOf(t); return i < 0 ? Infinity : i; }));
  const iTaller = Math.min(...['_pintarFabricacion', 'SE FABRICA', 'fabricar']
    .map(t => { const i = fuente.indexOf(t); return i < 0 ? Infinity : i; }));
  s.ok(Number.isFinite(iGrilla) && Number.isFinite(iTaller), 'se encuentran las dos secciones en el archivo',
    `grilla@${iGrilla} taller@${iTaller}`);

  // El orden de verdad se mide en el navegador, no acá: el archivo puede
  // definir los métodos en cualquier orden. Acá sólo se comprueba que exista un
  // pintado de grilla y que el compañero de navegador tenga qué mirar.
  s.nota('el orden en pantalla lo mide el compañero de navegador, no este banco');

  const I2 = I && claseDe(I, 'madera_dura');
  s.feliz = !!I2;
  s.felizQue = `la clase de madera_dura es ${I2 || 'inexistente'}`;

  // A5 · el número de la esquina deja de ser ambiguo: tiene que haber algo en
  // el marcado que distinga una cantidad de unos usos.
  const distingue = /usos|durab|instanc/i.test(fuente);
  s.ok(distingue, 'el bolso distingue en el marcado una cantidad de unos usos');

  return s;
}

// ── 5 · SIN REGRESIÓN ───────────────────────────────────────────────────────

async function regresion() {
  const s = seccion(5, 'SIN REGRESIÓN — las fases anteriores siguen verdes');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r6-fase1.mjs', '7/7'],
    ['banco-r6-fase2.mjs', '8/8'],
    ['banco-r5-fase1.mjs', '9/9'],
  ];
  let corrio = 0;
  for (const [archivo, esperado] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, BANCO_SIN_BUILD: '1' },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && m[1] === m[2], `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length} bancos anteriores`;
  return s;
}

// ── 6 · ARRANQUE ────────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(6, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { completos, familia, hoja, bolso, regresion, arranque };

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({
      num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`,
      checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }],
      feliz: false, felizQue: 'la sección tiró una excepción', notas: [],
    });
  }
}
todas.sort((a, b) => a.num - b.num);

if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every(s => s.feliz && s.checks.every(c => c.ok)) ? 0 : 1;
} else {

console.log(`\n  BANCO R6 · FASE 3 — los iconos   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
let verdes = 0;
for (const s of todas) {
  const verde = s.checks.every((c) => c.ok) && s.feliz;
  if (verde) verdes++;
  console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(2)}  ${s.num} · ${s.nombre}`);
  for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
  if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
  for (const n of s.notas) console.log(`         nota ${n}`);
}
console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
process.exitCode = verdes === todas.length ? 0 : 1;

}
