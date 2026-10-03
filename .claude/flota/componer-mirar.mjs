/**
 * Arma una hoja de comparación para MIRAR (fase 6 de la ronda 9): tres capturas
 * del mismo cuadro, una por variante, lado a lado a la mitad de tamaño, y debajo
 * el mismo recorte de cada una ampliado sin suavizar, para que se vea el detalle
 * que en el juego ocupa unos pocos píxeles.
 *
 * Uso: node .claude/flota/componer-mirar.mjs <salida.png> <cx> <cy> <lado> <aumento> <a.png> <b.png> <c.png>
 *   cx, cy: centro del recorte en píxeles de la captura; lado: lado del recorte;
 *   aumento: cuántas veces se amplía el recorte.
 */
import fs from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const [salida, cxS, cyS, ladoS, aumS, ...entradas] = process.argv.slice(2);
const cx = Math.round(+cxS), cy = Math.round(+cyS), lado = +ladoS, aum = +aumS;
const imgs = entradas.map(f => PNG.sync.read(fs.readFileSync(f)));
const W = imgs[0].width, H = imgs[0].height;
const medio = { w: Math.floor(W / 2), h: Math.floor(H / 2) };
const recorte = lado * aum;
const SEP = 8;
const anchoTotal = Math.max(imgs.length * medio.w, imgs.length * recorte) + (imgs.length - 1) * SEP;
const altoTotal = medio.h + SEP + recorte;
const out = new PNG({ width: anchoTotal, height: altoTotal });
out.data.fill(24);
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;

const poner = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= anchoTotal || y >= altoTotal) return;
  const o = (y * anchoTotal + x) * 4; out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
};
const leer = (img, x, y) => {
  x = Math.max(0, Math.min(img.width - 1, x)); y = Math.max(0, Math.min(img.height - 1, y));
  const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]];
};

imgs.forEach((img, i) => {
  // Arriba: el cuadro entero a la mitad (promedio de 2×2).
  const ox = i * (Math.max(medio.w, recorte) + SEP);
  for (let y = 0; y < medio.h; y++) for (let x = 0; x < medio.w; x++) {
    let r = 0, g = 0, b = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p = leer(img, 2 * x + dx, 2 * y + dy); r += p[0]; g += p[1]; b += p[2]; }
    poner(ox + x, y, r >> 2, g >> 2, b >> 2);
  }
  // El marco del recorte, sobre la vista chica.
  const x0 = Math.round((cx - lado / 2) / 2), y0 = Math.round((cy - lado / 2) / 2), l = Math.round(lado / 2);
  for (let k = 0; k <= l; k++) { poner(ox + x0 + k, y0, 255, 210, 0); poner(ox + x0 + k, y0 + l, 255, 210, 0); poner(ox + x0, y0 + k, 255, 210, 0); poner(ox + x0 + l, y0 + k, 255, 210, 0); }
  // Abajo: el recorte ampliado, vecino más cercano.
  const oy = medio.h + SEP;
  for (let y = 0; y < recorte; y++) for (let x = 0; x < recorte; x++) {
    const p = leer(img, cx - lado / 2 + Math.floor(x / aum), cy - lado / 2 + Math.floor(y / aum));
    poner(ox + x, oy + y, p[0], p[1], p[2]);
  }
});
fs.writeFileSync(salida, PNG.sync.write(out));
console.log(`  ${salida}: ${anchoTotal}×${altoTotal}`);
