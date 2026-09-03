/**
 * r2-mundo-agua.mjs — banco del frente 2 (definición del agua).
 *
 *   node .claude/flota/r2-mundo-agua.mjs
 *
 * Qué sostiene: que **antes de este cambio el agua a más de 420 m tenía
 * variación espacial CERO EXACTO** —no poca: cero— en cualquier dirección que
 * no fuera la del reguero del sol, y que ahora tiene una veta de rachas que no
 * puede caer por debajo del píxel.
 *
 * Reimplementa el camino lejano del fragmento de `Agua.js`. No lo importa
 * —es GLSL dentro de un literal— pero **lee del archivo los dos números que se
 * calibraron**, así que si alguien los mueve el banco lo sigue en vez de mentir.
 *
 * El caso que importa es el del cerro reflejado: un lago de montaña visto
 * rasante devuelve la ladera de enfrente, y ahí es donde la racha tiene
 * contraste que romper. En agua abierta el efecto es chico a propósito.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(resolve(aquí, '../../src/world/Agua.js'), 'utf8');

/** Saca un número del propio shader para que el banco no se desincronice. */
function delShader(patron, porOmision) {
  const m = fuente.match(patron);
  return m ? parseFloat(m[1]) : porOmision;
}
const K_TAPA = delShader(/tapa \*= 1\.0 - rugosidad \* ([\d.]+)/, 0.40);
const K_CIELO = delShader(/mix\(alturaR, mix\(alturaR, 0\.34, ([\d.]+)\), rugosidad\)/, 0.48);

// ── Copias fieles de hash21/ruido del shader ───────────────────────────────
function h21(px, py) {
  px *= 123.34; py *= 456.21;
  px -= Math.floor(px); py -= Math.floor(py);
  const dt = px * (px + 45.32) + py * (py + 45.32);
  px += dt; py += dt;
  const r = px * py;
  return r - Math.floor(r);
}
function ruido(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Colores del cielo a mediodía, del orden de los medidos por el agente `agua`
const HOR = [0.62, 0.68, 0.75];
const CIE = [0.62 * 0.48, 0.68 * 0.52, 0.75 * 0.58];
const VIENTO = [0.9, 0.3], T = 40;
const ALTURA_R = 0.12;      // vista rasante desde la orilla

function pixel(x, z, distOjo, tapa0, conRachas) {
  const nitidez = 1 - ss(60, 420, distOjo);
  const lejos = 1 - nitidez;
  let rug = 0;
  if (conRachas && lejos > 0.01) {
    const dv = [VIENTO[0] * T * 0.0016, VIENTO[1] * T * 0.0016];
    rug = ruido(x * 0.0035 + dv[0], z * 0.0035 + dv[1]) * 0.66
        + ruido(x * 0.0091 - dv[0] * 1.7, z * 0.0091 - dv[1] * 1.7) * 0.34;
    rug = ss(0.40, 0.74, rug) * lejos;
  }
  const alturaRacha = mix(ALTURA_R, mix(ALTURA_R, 0.34, K_CIELO), rug);
  const tapa = tapa0 * (1 - rug * K_TAPA);
  const ribera = HOR.map(h => h * (0.17 + 0.45 * Math.min(1, Math.max(0, ALTURA_R * 3.5))));
  const domo = HOR.map((h, i) => mix(h, CIE[i], Math.pow(alturaRacha, 1.15)));
  return { c: domo.map((v, i) => mix(v, ribera[i], tapa)), rug };
}

function medir(distOjo, tapa0, conRachas, n = 110) {
  const ls = [], rs = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const r = pixel(3000 + i * 9, 5000 + j * 9, distOjo, tapa0, conRachas);
    ls.push(lum(r.c)); rs.push(r.rug);
  }
  const m = ls.reduce((a, b) => a + b, 0) / ls.length;
  const sd = Math.sqrt(ls.reduce((a, b) => a + (b - m) ** 2, 0) / ls.length);
  return { m, sd, rango: Math.max(...ls) - Math.min(...ls), rs };
}

console.log(`\nConstantes leídas de Agua.js: tapa ×(1 − rugosidad·${K_TAPA}), cielo ${K_CIELO}\n`);

console.log('=== Lago de montaña visto rasante, CON el cerro reflejado ===');
console.log('dist       ANTES sd    AHORA sd    ANTES rango   AHORA rango   contraste');
for (const d of [200, 420, 700, 1200, 2500, 6000]) {
  const a = medir(d, 1, false), b = medir(d, 1, true);
  console.log(`${String(d).padStart(5)} m   ${a.sd.toFixed(5)}     ${b.sd.toFixed(5)}     ${a.rango.toFixed(5)}       ${b.rango.toFixed(5)}     ${(b.rango / b.m * 100).toFixed(0)} %`);
}

console.log('\n=== Cuánto cerro se refleja cambia el efecto (a 1200 m) ===');
console.log('Que dependa de eso es correcto: la onda sólo se ve donde hay contraste que romper.');
for (const tapa0 of [1, 0.5, 0]) {
  const b = medir(1200, tapa0, true);
  const rizada = b.rs.filter(v => v > 0.9).length / b.rs.length;
  const vidriada = b.rs.filter(v => v < 0.1).length / b.rs.length;
  console.log(`  tapa=${tapa0}   contraste pico ${(b.rango / b.m * 100).toFixed(0)} %   sd/media ${(b.sd / b.m * 100).toFixed(1)} %   superficie rizada ${(rizada * 100).toFixed(0)} %  vidriada ${(vidriada * 100).toFixed(0)} %`);
}

console.log('\n=== El campo cercano tiene que quedar idéntico ===');
let ok = true;
for (const d of [10, 40, 59]) {
  const a = medir(d, 1, false), b = medir(d, 1, true);
  const dif = Math.abs(a.m - b.m);
  if (dif > 0) ok = false;
  console.log(`  ${String(d).padStart(2)} m -> |diferencia de media| = ${dif.toExponential(2)}`);
}
console.log(ok
  ? '\nCampo cercano intacto: nada de lo que la ronda anterior calibró de cerca se movió.'
  : '\nOJO: el campo cercano CAMBIÓ. No debería.');
