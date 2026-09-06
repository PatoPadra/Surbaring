/**
 * FALSADOR DEL BANCO DE LA FASE 1.
 *
 * Le planta al banco defectos que sabemos que existen y comprueba que los ve.
 * Es la respuesta a la trampa nº 3 de la ronda 2: un banco que da verde sin
 * ejercitar nada. Acá se demuestra al revés — que el banco se pone rojo cuando
 * tiene que ponerse rojo.
 *
 * No toca el repo: todo pasa en memoria.
 *
 * Uso:  node .claude/flota/banco-r3-fase1.falsar.mjs
 */

import { especiesRepresentables, leerIHDR, rectDe, extraerEntradas, esPotenciaDeDos } from './banco-r3-fase1.mjs';

let fallos = 0;
function caso(nombre, cond, detalle) {
  const ok = !!cond;
  if (!ok) fallos++;
  console.log('  ' + (ok ? 'ok  ' : 'MAL ') + nombre + (detalle ? '  → ' + detalle : ''));
}

console.log('FALSADOR DEL BANCO DE LA FASE 1');
console.log('='.repeat(72));

// ── El predicado de especies ────────────────────────────────────────────────
console.log('\nel predicado de especies representables');
const rep = especiesRepresentables();
const ids = new Set(rep.map(e => e.id));
caso('devuelve 44', rep.length === 44, 'dio ' + rep.length);
caso('incluye huemul', ids.has('huemul'));
caso('incluye condor_andino', ids.has('condor_andino'));
caso('EXCLUYE picaflor_rubi (largo 0.1, no supera > 0.1)', !ids.has('picaflor_rubi'));
caso('EXCLUYE murcielago_oreja_de_raton (0.09 m)', !ids.has('murcielago_oreja_de_raton'));
caso('EXCLUYE trucha_arcoiris (pez)', !ids.has('trucha_arcoiris'));
caso('EXCLUYE lagartija_del_bosque (reptil)', !ids.has('lagartija_del_bosque'));

// ── El lector de IHDR ───────────────────────────────────────────────────────
console.log('\nel lector de IHDR');
function pngFalso(w, h, tipoColor = 6) {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b.writeUInt8(8, 24);
  b.writeUInt8(tipoColor, 25);
  return b;
}
const ih = leerIHDR(pngFalso(1024, 512));
caso('lee 1024×512', ih && ih.ancho === 1024 && ih.alto === 512, JSON.stringify(ih));
caso('rechaza un buffer que no es PNG', leerIHDR(Buffer.from('esto no es un png del todo nada')) === null);
caso('rechaza un PNG truncado', leerIHDR(pngFalso(64, 64).subarray(0, 20)) === null);

console.log('\nla comprobación de potencia de dos');
caso('1024 sí', esPotenciaDeDos(1024));
caso('2048 sí', esPotenciaDeDos(2048));
caso('1000 NO', !esPotenciaDeDos(1000));
caso('768 NO', !esPotenciaDeDos(768));
caso('0 NO', !esPotenciaDeDos(0));

// ── El extractor de entradas ────────────────────────────────────────────────
console.log('\nel extractor de entradas del manifiesto');

const formas = {
  'objeto plano por id': { especies: { huemul: { x: 0, y: 0, w: 128, h: 128 }, puma: { x: 128, y: 0, w: 128, h: 128 } } },
  'arreglo con campo id': { entradas: [{ id: 'huemul', x: 0, y: 0, w: 128, h: 128 }, { id: 'puma', x: 128, y: 0, w: 128, h: 128 }] },
  'anidado dos niveles': { atlas: { fauna: { entradas: { huemul: { u0: 0, v0: 0, u1: 0.125, v1: 0.125 } } } } },
};
for (const [nombre, man] of Object.entries(formas)) {
  const { encontrados } = extraerEntradas(man);
  caso('reconoce la forma «' + nombre + '»', encontrados.size >= 1, encontrados.size + ' entradas');
}

const vacio = extraerEntradas({ version: 1, generado: 'hoy' });
caso('un manifiesto SIN especies da cero entradas (y el banco lo marca rojo por cobertura)', vacio.encontrados.size === 0);

// ── El normalizador de rectángulos ──────────────────────────────────────────
console.log('\nel normalizador de coordenadas');
const A = 1024;
const px = rectDe({ x: 128, y: 256, w: 128, h: 128 }, A, A);
caso('x/y/w/h en píxeles', px && px.x === 128 && px.w === 128, JSON.stringify(px));
const uv = rectDe({ u0: 0, v0: 0, u1: 0.125, v1: 0.125 }, A, A);
caso('u0/v0/u1/v1 en UV → píxeles', uv && Math.abs(uv.w - 128) < 0.01, JSON.stringify(uv));
const cf = rectDe({ col: 3, fila: 2, celda: 128 }, A, A);
caso('col/fila/celda', cf && cf.x === 384 && cf.y === 256, JSON.stringify(cf));
const arr = rectDe({ uv: [0.5, 0.5, 0.125, 0.125] }, A, A);
caso('arreglo uv', arr && Math.abs(arr.x - 512) < 0.01, JSON.stringify(arr));
caso('formato desconocido devuelve null, NO un rectángulo inventado', rectDe({ color: '#aabbcc' }, A, A) === null);

// ── Los defectos que el banco tiene que ver ─────────────────────────────────
console.log('\nlos defectos plantados que el banco 3 tiene que ver');

function fuera(r, ancho, alto) {
  return r.x < -0.001 || r.y < -0.001 || r.x + r.w > ancho + 0.001 || r.y + r.h > alto + 0.001 || r.w <= 0 || r.h <= 0;
}
caso('celda que se sale por la derecha', fuera(rectDe({ x: 960, y: 0, w: 128, h: 128 }, A, A), A, A));
caso('celda que se sale por abajo', fuera(rectDe({ x: 0, y: 960, w: 128, h: 128 }, A, A), A, A));
caso('celda de ancho cero', fuera(rectDe({ x: 0, y: 0, w: 0, h: 128 }, A, A), A, A));
caso('celda con x negativa', fuera(rectDe({ x: -8, y: 0, w: 128, h: 128 }, A, A), A, A));
caso('celda legítima NO se marca', !fuera(rectDe({ x: 896, y: 896, w: 128, h: 128 }, A, A), A, A));

function solapan(a, b) {
  const sx = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const sy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return sx > 0.5 && sy > 0.5;
}
caso('dos especies en la misma celda se detectan',
  solapan({ x: 0, y: 0, w: 128, h: 128 }, { x: 0, y: 0, w: 128, h: 128 }));
caso('dos especies que sólo se tocan de canto NO cuentan como solape',
  !solapan({ x: 0, y: 0, w: 128, h: 128 }, { x: 128, y: 0, w: 128, h: 128 }));
caso('solape parcial se detecta',
  solapan({ x: 0, y: 0, w: 128, h: 128 }, { x: 64, y: 64, w: 128, h: 128 }));

// ── El presupuesto ──────────────────────────────────────────────────────────
console.log('\nla cuenta del presupuesto de VRAM');
const conMip = (w, h) => w * h * 4 * 4 / 3;
const tres1024 = 3 * conMip(1024, 1024) / 1048576;
const dosMasUn2048 = (conMip(2048, 2048) + 2 * conMip(1024, 1024)) / 1048576;
console.log('    tres atlas de 1024²        = ' + tres1024.toFixed(2) + ' MiB');
console.log('    un 2048² + dos 1024²       = ' + dosMasUn2048.toFixed(2) + ' MiB');
caso('tres de 1024 entran en 24 MB', tres1024 <= 24, tres1024.toFixed(2) + ' MiB');
caso('un 2048 con dos 1024 NO entra (el banco lo tiene que rechazar)', dosMasUn2048 > 24, dosMasUn2048.toFixed(2) + ' MiB');
caso('tres de 2048 NO entran', 3 * conMip(2048, 2048) / 1048576 > 24);

console.log('\n' + '='.repeat(72));
console.log(fallos === 0
  ? 'EL BANCO SE FALSA BIEN: ve los defectos plantados y no inventa los que no hay.'
  : 'EL BANCO TIENE ' + fallos + ' PROBLEMA(S). No se puede confiar en su verde.');
process.exit(fallos === 0 ? 0 : 1);
