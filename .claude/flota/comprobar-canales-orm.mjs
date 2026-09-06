/**
 * COMPROBACIÓN DE LOS CANALES DEL MAPA COMBINADO (ORM) — ronda 3.
 *
 * ── Por qué existe este archivo ──────────────────────────────────────────────
 *
 * `fauna` encontró, leyendo, que los canales del mapa combinado estaban
 * CRUZADOS entre la fase 1 y three.js:
 *
 *   · `tools/hornear-texturas.mjs` horneaba  R = rugosidad, G = oclusión.
 *   · three 0.169 lee la convención ORM de glTF y no acepta otra:
 *       `aomap_fragment.glsl.js`        → «reads channel R»
 *       `roughnessmap_fragment.glsl.js` → «reads channel G»
 *
 * Enchufar `roughnessMap` y `aoMap` a la misma textura hacía, entonces, que la
 * rugosidad la manejara la oclusión y viceversa: **sin un error, sin un aviso y
 * sin nada raro en consola**. El jefe de la fase 2 corrigió el horneador (la
 * fase 1 estaba cerrada y sin agente vivo) para que hornee R = oclusión,
 * G = rugosidad, B = 0.
 *
 * ── Qué sabe medir esto, y qué NO ────────────────────────────────────────────
 *
 * Hay que ser honesto con el estatus de esta comprobación: **el que escribió el
 * arreglo es el mismo que escribió esto**, que es exactamente lo que la regla 1
 * de RONDA3.md prohíbe. No hay agente independiente disponible para la fase 1,
 * así que en vez de simular una revisión independiente se hace lo único que sí
 * vale por sí solo: **medir dos firmas independientes entre sí**, cada una
 * derivada de un archivo fuente distinto, y ver si las dos caen en el mismo
 * canal. Que las dos coincidan no es una revisión independiente, pero tampoco
 * es una opinión: son dos predicciones falsables que se cumplen o no.
 *
 *   FIRMA A — estructural, derivada de `tools/hornear-texturas.mjs`.
 *     La oclusión es un valle angosto en los TRES bordes de banda (v = 0,14 /
 *     0,62 / 0,86) y vale ~1 en el medio de cada banda. Es una firma de forma:
 *     no depende de ningún número de ninguna ficha. El canal que tenga esos
 *     tres valles y sólo esos es el de oclusión.
 *
 *   FIRMA B — de contenido, derivada de `src/data/pelajes.json`.
 *     La rugosidad es plana dentro de la celda y vale lo que dice la ficha de
 *     esa especie (±el grano determinista de ±0,04). Especies con rugosidad
 *     distinta tienen que dar valores distintos, en el mismo orden que la
 *     ficha. El canal que siga a la ficha es el de rugosidad.
 *
 * Si las dos firmas cayeran en el mismo canal, o si cada una cayera en el canal
 * equivocado, esto se pone rojo. Es lo que un banco escrito por otro tendría
 * que haber medido; queda escrito y es reproducible.
 *
 * Le sirve además a `flora`, que en la fase 3 va a hornear corteza y follaje y
 * se va a encontrar con la misma decisión de canales.
 *
 * ── Falsada ──────────────────────────────────────────────────────────────────
 * Una comprobación que nunca se puso roja no se distingue de una que no mide
 * nada. Con `ORM_TEX=<dir>` se la apunta a otra carpeta de atlas; corriéndola
 * contra una copia con R y G intercambiados a mano —que es exactamente el
 * estado que tenía el repo antes del arreglo— tiene que ponerse ROJA por las
 * dos firmas a la vez. Eso está hecho y anotado en el informe de la fase 2.
 *
 * Uso:  node .claude/flota/comprobar-canales-orm.mjs
 *       ORM_TEX=/ruta/a/otro/tex node .claude/flota/comprobar-canales-orm.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TEX = process.env.ORM_TEX ? path.resolve(process.env.ORM_TEX) : path.join(RAIZ, 'public', 'tex');

// Las mismas constantes de geometría de celda que usa el horneador. Se repiten
// acá a propósito y no se importan: si el horneador las cambia sin avisar, esta
// comprobación tiene que romperse, no seguirlo en silencio.
const CELL_PX = 128, GUARDA_PX = 8, CONTENIDO_PX = CELL_PX - 1 - 2 * GUARDA_PX; // 111
const BORDES_BANDA = [0.14, 0.62, 0.86];

let rojo = false;
const fallo = (s) => { rojo = true; console.log('  >>> ' + s); };

console.log('COMPROBACIÓN DE CANALES DEL MAPA COMBINADO · ronda 3 · SurviBar');
console.log('three 0.169 lee ORM de glTF: aoMap del canal R, roughnessMap del canal G.\n');

const rutaManifiesto = path.join(TEX, 'manifiesto.json');
if (!fs.existsSync(rutaManifiesto)) {
  console.log('no hay public/tex/manifiesto.json — corré primero `node tools/hornear-texturas.mjs`');
  process.exit(1);
}
const man = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
const pelajes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'pelajes.json'), 'utf8'));
const png = PNG.sync.read(fs.readFileSync(path.join(TEX, man.archivos.rugosidadOclusion)));

/** (u,v) de contenido → píxel absoluto del atlas, para una celda dada. */
function muestra(region, u, v) {
  const lx = GUARDA_PX + Math.round(u * CONTENIDO_PX);
  const ly = GUARDA_PX + Math.round(v * CONTENIDO_PX);
  const i = ((region.row * CELL_PX + ly) * png.width + (region.col * CELL_PX + lx)) * 4;
  return { R: png.data[i], G: png.data[i + 1], B: png.data[i + 2], A: png.data[i + 3] };
}

// ── El manifiesto se declara a sí mismo ─────────────────────────────────────
console.log('── lo que declara el manifiesto ──────────────────────────────────────────');
if (!man.canales) {
  fallo('el manifiesto no declara un campo `canales`: no se puede auditar sin abrir el horneador');
} else {
  console.log('  ' + JSON.stringify(man.canales.rugosidadOclusion));
  if (!/oclusion/i.test(man.canales.rugosidadOclusion.R)) fallo('el manifiesto no declara R = oclusión');
  if (!/rugosidad/i.test(man.canales.rugosidadOclusion.G)) fallo('el manifiesto no declara G = rugosidad');
}

// ── FIRMA A · el valle en los tres bordes de banda = oclusión ───────────────
console.log('\n── FIRMA A · quién tiene los valles en los bordes de banda (v = 0,14 / 0,62 / 0,86)');
const ESPECIE_A = 'huemul';
const regA = man.especies[ESPECIE_A];
if (!regA) { fallo('no hay celda horneada para ' + ESPECIE_A); }
else {
  const perfil = { R: [], G: [] };
  const vs = [];
  for (let k = 0; k <= 100; k++) vs.push(k / 100);
  for (const v of vs) { const p = muestra(regA, 0.5, v); perfil.R.push(p.R); perfil.G.push(p.G); }

  const analiza = (serie) => {
    const enBorde = [], lejos = [];
    vs.forEach((v, i) => {
      const d = Math.min(...BORDES_BANDA.map(b => Math.abs(v - b)));
      if (d <= 0.01) enBorde.push(serie[i]);
      else if (d >= 0.10) lejos.push(serie[i]);
    });
    const media = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
    return { enBorde: media(enBorde), lejos: media(lejos), caida: media(lejos) - media(enBorde) };
  };
  const aR = analiza(perfil.R), aG = analiza(perfil.G);
  console.log('  ' + ESPECIE_A + ' · canal R: en el borde ' + aR.enBorde.toFixed(1) +
    ' · lejos del borde ' + aR.lejos.toFixed(1) + ' · caída ' + aR.caida.toFixed(1));
  console.log('  ' + ESPECIE_A + ' · canal G: en el borde ' + aG.enBorde.toFixed(1) +
    ' · lejos del borde ' + aG.lejos.toFixed(1) + ' · caída ' + aG.caida.toFixed(1));
  // El horneador oscurece un 22 % como máximo → ~56 niveles de 255 en el fondo
  // del valle; promediado sobre ±0,01 de v la caída esperada es de decenas.
  const UMBRAL = 15;
  if (!(aR.caida > UMBRAL)) fallo('el canal R NO tiene el valle de oclusión en los bordes de banda (caída ' + aR.caida.toFixed(1) + ')');
  if (aG.caida > UMBRAL) fallo('el canal G TAMBIÉN cae en los bordes de banda: la oclusión está en G, o está en los dos');
  if (aR.caida > UMBRAL && !(aG.caida > UMBRAL)) console.log('  → la oclusión está en R. Correcto para `aoMap`.');
}

// ── FIRMA B · quién sigue el número de la ficha = rugosidad ─────────────────
console.log('\n── FIRMA B · quién sigue la `rugosidad` de src/data/pelajes.json');
const candidatas = Object.keys(man.especies)
  .filter(id => pelajes.especies[id] && typeof pelajes.especies[id].rugosidad === 'number');
// Se eligen la más rugosa y la menos rugosa: si el canal sigue la ficha, tiene
// que separarlas en el mismo orden y por una distancia parecida.
candidatas.sort((a, b) => pelajes.especies[a].rugosidad - pelajes.especies[b].rugosidad);
const baja = candidatas[0], alta = candidatas[candidatas.length - 1];
console.log('  ' + candidatas.length + ' especies con rugosidad en la ficha · más lisa: ' + baja +
  ' (' + pelajes.especies[baja].rugosidad + ') · más rugosa: ' + alta + ' (' + pelajes.especies[alta].rugosidad + ')');

/** Media de un canal en el centro de la banda dorso, lejos de todo borde. */
function mediaCentro(id, canal) {
  const r = man.especies[id];
  let s = 0, n = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    s += muestra(r, 0.1 + i * 0.08, 0.30 + j * 0.012)[canal]; n++;
  }
  return s / n;
}
for (const canal of ['R', 'G']) {
  const mb = mediaCentro(baja, canal), ma = mediaCentro(alta, canal);
  const espB = pelajes.especies[baja].rugosidad * 255, espA = pelajes.especies[alta].rugosidad * 255;
  const errB = Math.abs(mb - espB), errA = Math.abs(ma - espA);
  console.log('  canal ' + canal + ': ' + baja + ' = ' + mb.toFixed(1) + ' (ficha ' + espB.toFixed(0) + ', error ' + errB.toFixed(1) + ')' +
    ' · ' + alta + ' = ' + ma.toFixed(1) + ' (ficha ' + espA.toFixed(0) + ', error ' + errA.toFixed(1) + ')');
  const sigue = errB < 12 && errA < 12;
  if (canal === 'G' && !sigue) fallo('el canal G NO sigue la rugosidad de la ficha');
  if (canal === 'R' && sigue) fallo('el canal R TAMBIÉN sigue la rugosidad de la ficha: los dos canales llevan lo mismo');
  if (canal === 'G' && sigue) console.log('  → la rugosidad está en G. Correcto para `roughnessMap`.');
}

// ── B = 0, que es lo que ORM espera para algo no metálico ───────────────────
console.log('\n── canal B (metalidad) ───────────────────────────────────────────────────');
{
  const p = muestra(man.especies[ESPECIE_A] || Object.values(man.especies)[0], 0.5, 0.4);
  console.log('  B = ' + p.B + ' · A = ' + p.A);
  if (p.B !== 0) fallo('el canal B no es 0: three lo leería como metalidad y el pelaje saldría metálico');
}

console.log('\n' + '═'.repeat(74));
console.log(rojo
  ? 'ROJO — los canales NO están en la convención que three sabe leer.'
  : 'VERDE — R = oclusión y G = rugosidad, las dos firmas caen donde tienen que caer.');
console.log('(Medición del jefe sobre su propio arreglo: dos firmas independientes entre');
console.log(' sí, no una revisión independiente. Queda dicho.)');
process.exit(rojo ? 1 : 0);
