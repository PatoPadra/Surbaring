/**
 * Genera `capturas/iconos-r6.html`: los 115 juntos, agrupados por categoría, al
 * tamaño real del casillero (79 px) y también al doble, para juzgarlos como
 * conjunto. Se corre desde la raíz del repo:
 *
 *   node .claude/flota/hoja-contacto-r6.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const I = await import(pathToFileURL(path.join(RAIZ, 'src/ui/Iconos.js')).href);
const R = await import(pathToFileURL(path.join(RAIZ, 'src/systems/Recursos.js')).href);
const DATOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/data/herramientas.json'), 'utf8'));
const COSAS = (DATOS.objetos || []).filter(o => !(o.esReceta || o.produce));

const grupos = new Map();
const meter = (g, id, nombre, extra) => {
  if (!grupos.has(g)) grupos.set(g, []);
  grupos.get(g).push({ id, nombre, extra });
};
for (const [id, d] of Object.entries(R.RECURSOS))
  meter(`recurso · ${d.cat || 'sin categoría'}`, id, d.nombre || id, `${d.kg} kg`);
for (const o of COSAS)
  meter(`objeto · ${o.categoria || 'sin categoría'}`, o.id, o.nombre || o.id,
    o.durabilidad ? `${o.durabilidad} usos` : 'sin durabilidad');

const orden = [...grupos.keys()].sort((a, b) =>
  (a.startsWith('recurso') ? 0 : 1) - (b.startsWith('recurso') ? 0 : 1)
  || grupos.get(b).length - grupos.get(a).length);

const celda = ({ id, nombre, extra }) => `<figure>
  <div class="cs"><b class="${I.claseDe(id)}"></b></div>
  <figcaption><b>${nombre}</b><span>${id}</span><span>${extra}</span></figcaption>
</figure>`;

const total = [...grupos.values()].reduce((s, l) => s + l.length, 0);

const html = `<!doctype html><meta charset="utf-8">
<title>SurviBar · los 115 iconos del bolso · ronda 6 fase 3</title>
<style>
${I.hoja()}
:root { color-scheme: dark; }
body { margin: 0; padding: 2rem 2.5rem 4rem; background: #12150f; color: #ddd8cc;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { font-size: 1.1rem; font-weight: 500; letter-spacing: .04em; margin: 0 0 .3rem; }
p.sub { color: #8b9184; font-size: .8rem; margin: 0 0 1.6rem; max-width: 62ch; }
h2 { font-size: .64rem; letter-spacing: .16em; text-transform: uppercase; color: #8b9184;
  margin: 2rem 0 .7rem; border-top: 1px solid #ffffff1a; padding-top: .7rem; }
h2 i { font-style: normal; color: #5e6459; }
.rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: .9rem; }
figure { margin: 0; text-align: center; }
/* La casilla, al tamaño real medido en la página: 79 x 79 px. */
.cs { position: relative; width: 79px; height: 79px; margin: 0 auto;
  border-radius: 3px; background-color: #ffffff08; border: 1px solid #ffffff14; }
.cs > .ic { position: absolute; left: 10%; top: 6%; width: 80%; height: 80%; }
figcaption { margin-top: .35rem; font-size: .62rem; line-height: 1.35; }
figcaption b { display: block; font-weight: 500; color: #ddd8cc; }
figcaption span { display: block; color: #6d746a; font-size: .56rem; }
/* La tira de abajo: los 115 seguidos y chicos, que es como se ven de verdad
   cuando la grilla está llena y el ojo barre. */
.tira { display: flex; flex-wrap: wrap; gap: 4px; margin-top: .8rem; }
.tira .cs { width: 79px; height: 79px; }
.doble .cs { width: 158px; height: 158px; }
label { font-size: .7rem; color: #8b9184; cursor: pointer; user-select: none; }
</style>
<h1>Los 115 iconos del bolso</h1>
<p class="sub">Ronda 6, fase 3. Casilla al tamaño real: <b>79 × 79 px</b>, con el dibujo
al 80 %. Fondo, borde y radio son los del panel de verdad. ${total} dibujos, hoja de
${(Buffer.byteLength(I.hoja(), 'utf8') / 1024).toFixed(1)} kB.
<label><input type="checkbox" onchange="document.body.classList.toggle('doble',this.checked)"> verlos al doble</label></p>

${orden.map(g => `<h2>${g} <i>· ${grupos.get(g).length}</i></h2>
<div class="rejilla">${grupos.get(g).map(celda).join('')}</div>`).join('\n')}

<h2>los 115 seguidos <i>· como se ven cuando la grilla está llena</i></h2>
<div class="tira">${orden.flatMap(g => grupos.get(g)).map(o =>
  `<div class="cs" title="${o.nombre}"><b class="${I.claseDe(o.id)}"></b></div>`).join('')}</div>

<h2>el de reserva <i>· un id que Iconos.js no conoce</i></h2>
<div class="rejilla">${celda({ id: '__sin_ficha__', nombre: 'id desconocido', extra: 'dibujo de reserva' })}</div>
`;

fs.mkdirSync(path.join(RAIZ, 'capturas'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'capturas/iconos-r6.html'), html, 'utf8');
console.log(`capturas/iconos-r6.html · ${total} iconos · ${(html.length / 1024).toFixed(0)} kB`);
