/**
 * Iconos — los 115 dibujos del bolso, y la hoja que los reparte.
 *
 * Hasta la fase 2 cada casillero decía una sigla de tres letras. En una captura
 * de veinticuatro casillas había **cuatro «Arc» y dos «Tos»**: la sigla ubicaba y
 * no identificaba, que es exactamente lo que hace que un inventario se lea como
 * una planilla con bordes.
 *
 * Tres decisiones, y las tres salen de una medición, no de un gusto:
 *
 * 1. **El dibujo viaja como imagen de fondo de una clase de CSS.** Medido en la
 *    página con 28 celdas repintadas: el dibujo puesto en línea dentro de cada
 *    celda cuesta +0,92 ms y la clase +0,07 ms — doce veces menos. La razón es
 *    que `Bolso.pintar()` reconstruye el panel con `innerHTML`, así que en línea
 *    el navegador vuelve a interpretar veintiocho subárboles de dibujo en cada
 *    pintada, y con la clase sólo escribe un nombre y reusa la imagen que ya
 *    decodificó. La hoja se arma una sola vez, perezosa, la primera vez que se
 *    abre el bolso.
 *
 * 2. **Un vocabulario de formas y una paleta por materia, compartidos.** Es lo
 *    mismo que hizo `Herramientas3D.js` con dieciocho modelos y nueve tintes: acá
 *    hay unas cuarenta piezas y unos cuarenta tintes, y los 115 salen de
 *    componerlas. Nadie dibujó 115 cosas de a una — hay **un solo** envoltorio de
 *    dibujo escrito a mano en todo el archivo. Que dos se parezcan está bien;
 *    que dos sean el mismo, no, y hay un banco que lo mide carácter por carácter.
 *
 * 3. **Un solo sol.** Toda la familia se sombrea con el mismo idioma: la misma
 *    silueta tres veces —el tono oscuro corrido abajo y a la derecha, el de base
 *    encima, y el claro encogido hacia arriba y a la izquierda—. A 56 px lo que
 *    se lee es la silueta y el contraste, no el detalle; con la luz viniendo
 *    siempre del mismo lado, ciento quince dibujos hechos por separado parecen
 *    del mismo juego. Es `bulto()`, y está en casi todos.
 *
 * La casilla mide 79 × 79 px de verdad, así que el arte se dibuja en una caja de
 * 64 y se muestra al 74 %: unos 58 px de dibujo con margen para que el número de
 * la esquina no le pise el medio.
 *
 * Lo que este archivo NO hace: no sabe qué es una durabilidad, no toca el
 * inventario y no decide qué se dibuja en qué casillero. Recibe un id y devuelve
 * una clase; el bolso hace el resto.
 */

// ── El lienzo y los trazos ──────────────────────────────────────────────────
//
// Todo se dibuja en una caja de 64 × 64 con el suelo imaginario en y = 56. Las
// coordenadas se redondean a medio punto: a 58 px de tamaño final medio punto es
// 0,45 px —invisible— y recorta como un 15 % del peso de la hoja, que es el
// presupuesto que hay que cuidar (140 kB para los 115).

const CAJA = 64;

const n = (v) => String(Math.round(v * 2) / 2);
const lista = (pts) => pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');

const P = (d, f, x = '') => `<path d="${d}" fill="${f}"${x}/>`;
// Ni `stroke-linecap` ni `stroke-linejoin` se escriben por forma: son atributos
// que se heredan, van una sola vez en el envoltorio y se ahorran 14 kB de los
// 140 del presupuesto — 648 repeticiones en los 115 dibujos.
const T = (d, s, w = 2, x = '') =>
  `<path d="${d}" fill="none" stroke="${s}" stroke-width="${n(w)}"${x}/>`;
const C = (cx, cy, r, f, x = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${f}"${x}/>`;
const E = (cx, cy, rx, ry, f, x = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${x}/>`;
const R = (x0, y0, w, h, f, r = 0, x = '') =>
  `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} fill="${f}"${x}/>`;
const G = (pts, f, x = '') => `<polygon points="${lista(pts)}" fill="${f}"${x}/>`;
const L = (x1, y1, x2, y2, s, w = 2, x = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${s}" stroke-width="${n(w)}"${x}/>`;
const PL = (pts, s, w = 2, x = '') =>
  `<polyline points="${lista(pts)}" fill="none" stroke="${s}" stroke-width="${n(w)}"${x}/>`;

/** Gira un grupo de piezas alrededor de un punto. */
const gira = (a, cx, cy, hijos) => `<g transform="rotate(${n(a)} ${n(cx)} ${n(cy)})">${hijos.join('')}</g>`;

/**
 * Ruido con semilla, sacada del id.
 *
 * Es lo que hace que la piedra, la tosca y la pómez usen la **misma** pieza y
 * salgan tres bultos distintos sin escribir tres siluetas a mano. Con semilla y
 * no al azar de verdad: el arte tiene que ser el mismo en cada arranque, o la
 * hoja cambiaría de contenido entre dos pintadas y el caché del navegador dejaría
 * de servir.
 */
function azar(semilla) {
  let s = 2166136261;
  for (let i = 0; i < semilla.length; i++) s = (Math.imul(s ^ semilla.charCodeAt(i), 16777619) >>> 0);
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ── La paleta por materia ───────────────────────────────────────────────────
//
// Tres tonos por materia —claro, base, oscuro— y no uno solo: con un color plano
// a 58 px un canto rodado y una pella de arcilla son dos manchas del mismo
// tamaño. El claro y el oscuro son los que dan el volumen, y salen del mismo
// tono para que la familia no se vuelva un arcoíris.
//
// Los valores arrancan de dos lugares que ya existen y se respetan: la paleta de
// `Herramientas3D.js` (madera, piedra, obsidiana, hierro, hueso, asta, cerámica,
// cuero, llama) y los colores de categoría del propio bolso (el verde #7f9f74 de
// la barra de peso, el violeta #a889bd de la botica, el ámbar #e0a050 de lo
// encendido). Nada de colores de caramelo: es el Nahuel Huapi, no una tienda.

const M = {
  madera:    ['#8a6236', '#6b4a2c', '#422c19'],
  madera2:   ['#c2a274', '#9a7b4e', '#6a4f30'],
  corteza:   ['#7b6146', '#54402c', '#2f2418'],
  verde:     ['#8fae7d', '#5f7f53', '#3a5234'],
  hierba:    ['#b3c98d', '#82a45f', '#54703b'],
  junco:     ['#a8bf7a', '#7d9b52', '#4e6832'],
  liquen:    ['#c3cbb0', '#98a586', '#666f55'],
  fibra:     ['#dcc48e', '#b79b62', '#836c3c'],
  paja:      ['#e3d19a', '#c2ab6d', '#8d7842'],
  piedra:    ['#9c988f', '#77736b', '#4a4741'],
  obsidiana: ['#4b4658', '#221f2b', '#0c0b10'],
  arcilla:   ['#b28365', '#8a5c3f', '#573925'],
  ceramica:  ['#d29a63', '#ad6a35', '#71411e'],
  arena:     ['#e2d1a6', '#c4ad78', '#8f7c4c'],
  tosca:     ['#c3ab82', '#9b8459', '#695737'],
  pomez:     ['#dcd8cf', '#b6b1a6', '#7d786e'],
  hueso:     ['#f1e8cf', '#d9d0b6', '#a2987a'],
  asta:      ['#cfb389', '#b49a72', '#7f6a48'],
  cuero:     ['#8a6742', '#63482c', '#3a2917'],
  cuero2:    ['#ac7e4d', '#7f5730', '#4d3419'],
  carne:     ['#c96f65', '#a04a45', '#682b2a'],
  asado:     ['#a5613f', '#7a4227', '#4a2415'],
  pescado:   ['#c0cdd3', '#8fa3ad', '#586a74'],
  baya:      ['#8a6bb8', '#533c78', '#2c1e44'],
  hongo:     ['#cb9c6f', '#9c6d45', '#664428'],
  agua:      ['#9dcbdc', '#5b9ab5', '#316073'],
  miel:      ['#f2c268', '#d0912c', '#915f18'],
  cera:      ['#f4e5b4', '#dcc57e', '#a38e4b'],
  grasa:     ['#f2e8d2', '#d8caa8', '#a49778'],
  carbon:    ['#5a5651', '#33302d', '#141312'],
  ceniza:    ['#cac6bc', '#9d998f', '#68655e'],
  hierro:    ['#aeb3ba', '#7f858d', '#4d5158'],
  acero:     ['#dbe1e7', '#9fa8b2', '#666e77'],
  oxido:     ['#b8794e', '#8a4f2d', '#552e18'],
  vidrio:    ['#d5eae8', '#9cc2c0', '#658a89'],
  fuego:     ['#ffc873', '#f08a2c', '#b04c17'],
  brasa:     ['#ff9a4a', '#d1541c', '#7d2c0d'],
  lana:      ['#f5efe4', '#d9d0be', '#a49b89'],
  pluma:     ['#c0b6a3', '#8b8272', '#565044'],
  hormigon:  ['#bcbcb5', '#8e8e88', '#5b5b56'],
  brea:      ['#4d4644', '#2a2523', '#100e0e'],
  resina:    ['#efb672', '#c07c2a', '#7d4f17'],
  violeta:   ['#c7abda', '#8f6fae', '#5a4272'],
  tela:      ['#c8b79a', '#9d8a6c', '#6b5b43'],
  humo:      ['#cfd3d2', '#a3a9a8', '#767c7b'],
};

/** El blanco de los brillos y el negro de las juntas, compartidos por todos. */
const LUZ = '#fdf7e6';
const HUECO = '#1a1714';

// ── El idioma del sombreado ─────────────────────────────────────────────────

/**
 * Curva cerrada que pasa por los medios de cada lado usando los vértices como
 * control. Un polígono de siete lados se ve tallado; el mismo pasado por acá se
 * ve como una piedra de arroyo, y cuesta los mismos siete puntos.
 */
function contorno(pts) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p0 = m(pts[pts.length - 1], pts[0]);
  let d = `M${n(p0[0])} ${n(p0[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i], s = m(pts[i], pts[(i + 1) % pts.length]);
    d += `Q${n(q[0])} ${n(q[1])} ${n(s[0])} ${n(s[1])}`;
  }
  return d + 'Z';
}

/**
 * **El sol de toda la familia.** La misma silueta tres veces: el tono oscuro
 * corrido hacia abajo y a la derecha, el de base encima, y el claro encogido
 * hacia el hombro de arriba a la izquierda.
 *
 * Siempre tres formas, así que cualquier icono que empiece por un bulto ya
 * cumple el mínimo de tres —a 58 px dos formas no se distinguen— y, más
 * importante, **la luz nunca cambia de lado**: es lo único que hace que ciento
 * quince dibujos compuestos por separado se lean como un solo juego.
 */
function bulto(pts, t, { dx = 1.5, dy = 2, k = 0.5, hx = -0.32, hy = -0.36 } = {}) {
  const d = contorno(pts);
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const cx = sx / pts.length, cy = sy / pts.length;
  let rr = 0;
  for (const [x, y] of pts) rr += Math.hypot(x - cx, y - cy);
  rr /= pts.length;
  const ox = cx + hx * rr, oy = cy + hy * rr;
  return [
    P(d, t[2], ` transform="translate(${n(dx)} ${n(dy)})"`),
    P(d, t[1]),
    P(contorno(pts.map(([x, y]) => [ox + (x - ox) * k, oy + (y - oy) * k])), t[0]),
  ];
}

// ── El vocabulario de formas ────────────────────────────────────────────────
//
// Cada pieza devuelve una lista de formas ya pintadas. Se componen: un hacha es
// un cabo más una cabeza, una boleadora son tres bolas más tres tientos, un
// pescado asado es un pescado más un espeto más las marcas de la brasa.

/** Canto irregular: la piedra, la tosca, la pómez, la pella de arcilla, el pan de cera. */
function canto(t, o = {}) {
  const { cx = 32, cy = 34, r = 16, lados = 7, z = Math.random,
    achata = 0.86, sacude = 0.32, giro = 0.4, dx, dy } = o;
  const pts = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2 + giro;
    const rr = r * (1 - sacude / 2 + z() * sacude);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * achata]);
  }
  return bulto(pts, t, { dx, dy });
}

/** Varilla: el tallo, el cabo, el astil, la hebra. Tres trazos, uno por tono. */
function varilla(t, { x1, y1, x2, y2, w = 4 }) {
  return [
    L(x1 + 1, y1 + 1.5, x2 + 1, y2 + 1.5, t[2], w),
    L(x1, y1, x2, y2, t[1], w),
    L(x1 - 0.5, y1 - 1, x2 - 0.5, y2 - 1, t[0], Math.max(1, w * 0.3)),
  ];
}

/** Leño tumbado con la tapa a la vista: la madera, el tronco, el lingote redondo. */
function leno(t, { x = 12, y = 36, largo = 34, grueso = 13, ang = -16, vetas = 2, anillos = 0 }) {
  const h = grueso, hijos = [
    R(x, y - h / 2 + 2, largo, h, t[2], h * 0.45),
    R(x, y - h / 2, largo, h, t[1], h * 0.45),
  ];
  for (let i = 0; i < vetas; i++) {
    const yy = y - h * 0.24 + i * h * 0.34;
    hijos.push(L(x + h * 0.5, yy, x + largo - h * 0.9, yy, i ? t[2] : t[0], 1));
  }
  hijos.push(E(x + largo - h * 0.3, y, h * 0.3, h * 0.47, t[0]));
  for (let i = 0; i < anillos; i++) {
    const f = 1 - (i + 1) / (anillos + 1);
    hijos.push(E(x + largo - h * 0.3, y, h * 0.3 * f, h * 0.47 * f, i % 2 ? t[0] : t[1]));
  }
  return [gira(ang, x, y, hijos)];
}

/** Haz de varas que se abren en abanico, con una atadura. Leña, juncos, pinocha. */
function haz(t, tAta, { cx = 32, cy = 50, largo = 32, cuantas = 5, abre = 34, w = 3.4, ata = true }) {
  const p = [];
  for (let i = 0; i < cuantas; i++) {
    const a = ((i / (cuantas - 1)) - 0.5) * (abre * Math.PI / 180);
    p.push(...varilla(t, { x1: cx, y1: cy, x2: cx + Math.sin(a) * largo, y2: cy - Math.cos(a) * largo, w }));
  }
  if (ata) {
    p.push(R(cx - 9, cy - largo * 0.45, 18, 5.5, tAta[2], 2.5));
    p.push(R(cx - 9, cy - largo * 0.45 - 1, 18, 5, tAta[1], 2.5));
    p.push(L(cx - 7, cy - largo * 0.45 + 0.5, cx + 7, cy - largo * 0.45 - 0.5, tAta[0], 1));
  }
  return p;
}

/** Hoja de planta con nervadura. La base del verde: canelo, maqui, michay, hierbas. */
function hojaVeg(t, { cx = 32, cy = 32, largo = 18, ancho = 9, ang = 0, venas = 2 }) {
  const d = `M0 ${n(-largo)}Q${n(ancho)} ${n(-largo * 0.15)} 0 ${n(largo)}Q${n(-ancho)} ${n(-largo * 0.15)} 0 ${n(-largo)}Z`;
  const hijos = [
    P(d, t[2], ` transform="translate(${n(cx + 1)} ${n(cy + 1.5)})"`),
    P(d, t[1], ` transform="translate(${n(cx)} ${n(cy)})"`),
    P(`M0 ${n(-largo)}Q${n(ancho * 0.55)} ${n(-largo * 0.2)} 0 ${n(largo * 0.55)}Q${n(-ancho * 0.1)} ${n(-largo * 0.2)} 0 ${n(-largo)}Z`,
      t[0], ` transform="translate(${n(cx - 1)} ${n(cy - 1)})"`),
    L(cx, cy - largo * 0.85, cx, cy + largo * 0.85, t[2], 1.2),
  ];
  for (let i = 1; i <= venas; i++) {
    const yy = cy - largo * 0.4 + (i - 1) * largo * 0.5;
    hijos.push(L(cx, yy, cx + ancho * 0.62, yy + largo * 0.22, t[2], 0.9));
    hijos.push(L(cx, yy, cx - ancho * 0.62, yy + largo * 0.22, t[2], 0.9));
  }
  return [gira(ang, cx, cy, hijos)];
}

/** Racimo de bayas: el fruto, el propóleo, las semillas grandes. */
function bayas(t, { cx = 32, cy = 36, r = 8, cuantas = 3, z = Math.random, tallo = M.verde }) {
  const p = [], pos = [];
  for (let i = 0; i < cuantas; i++) {
    const a = (i / cuantas) * Math.PI * 2 + 0.7;
    const rr = cuantas === 1 ? 0 : r * 0.82;
    pos.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85 + (z() - 0.5) * 2]);
  }
  if (tallo) p.push(PL([[cx, cy - r * 1.9], ...pos.map(([x, y]) => [x, y - r * 0.6])], tallo[2], 1.4));
  for (const [x, y] of pos) p.push(C(x + 1, y + 1.5, r, t[2]));
  for (const [x, y] of pos) p.push(C(x, y, r, t[1]));
  for (const [x, y] of pos) p.push(C(x - r * 0.3, y - r * 0.34, r * 0.34, t[0]));
  return p;
}

/** Gota: el agua, la resina, la miel que chorrea. */
function gota(t, { cx = 32, cy = 34, r = 11 }) {
  const d = `M0 ${n(-r * 1.5)}C${n(r * 0.95)} ${n(-r * 0.35)} ${n(r)} ${n(r * 0.25)} 0 ${n(r)}C${n(-r)} ${n(r * 0.25)} ${n(-r * 0.95)} ${n(-r * 0.35)} 0 ${n(-r * 1.5)}Z`;
  return [
    P(d, t[2], ` transform="translate(${n(cx + 1)} ${n(cy + 1.5)})"`),
    P(d, t[1], ` transform="translate(${n(cx)} ${n(cy)})"`),
    E(cx - r * 0.32, cy - r * 0.1, r * 0.24, r * 0.38, t[0]),
    C(cx + r * 0.3, cy + r * 0.4, r * 0.16, LUZ, ' opacity=".5"'),
  ];
}

/** Cuenco o vasija abierta, con o sin líquido adentro. */
function cuenco(t, { cx = 32, cy = 38, w = 22, h = 15, liquido = null, pie = true }) {
  const p = [
    P(`M${n(cx - w)} ${n(cy - h * 0.55)}Q${n(cx)} ${n(cy + h * 1.5)} ${n(cx + w)} ${n(cy - h * 0.55)}Z`, t[2]),
    P(`M${n(cx - w + 1.5)} ${n(cy - h * 0.5)}Q${n(cx - 1)} ${n(cy + h * 1.25)} ${n(cx + w - 2.5)} ${n(cy - h * 0.5)}Z`, t[1]),
    E(cx, cy - h * 0.55, w, h * 0.34, t[0]),
  ];
  if (liquido) {
    p.push(E(cx, cy - h * 0.5, w * 0.82, h * 0.27, liquido[2]));
    p.push(E(cx, cy - h * 0.58, w * 0.8, h * 0.26, liquido[1]));
    p.push(E(cx - w * 0.3, cy - h * 0.66, w * 0.22, h * 0.09, liquido[0]));
  } else {
    p.push(E(cx, cy - h * 0.55, w * 0.8, h * 0.25, t[2]));
  }
  if (pie) p.push(R(cx - w * 0.42, cy + h * 0.72, w * 0.84, 3.5, t[2], 1.6));
  return p;
}

/** Frasco de cuello angosto: los remedios, la brea, el agua guardada. */
function frasco(t, tl, { cx = 32, cy = 36, w = 11, h = 15 }) {
  return [
    P(`M${n(cx - w)} ${n(cy - h * 0.4)}Q${n(cx - w * 1.1)} ${n(cy + h)} ${n(cx)} ${n(cy + h)}Q${n(cx + w * 1.1)} ${n(cy + h)} ${n(cx + w)} ${n(cy - h * 0.4)}L${n(cx + w * 0.4)} ${n(cy - h * 1.05)}L${n(cx - w * 0.4)} ${n(cy - h * 1.05)}Z`, t[2]),
    P(`M${n(cx - w + 1.5)} ${n(cy - h * 0.4)}Q${n(cx - w)} ${n(cy + h - 1.5)} ${n(cx)} ${n(cy + h - 1.5)}Q${n(cx + w - 2.5)} ${n(cy + h - 1.5)} ${n(cx + w - 2.5)} ${n(cy - h * 0.4)}L${n(cx + w * 0.3)} ${n(cy - h * 1.05)}L${n(cx - w * 0.4)} ${n(cy - h * 1.05)}Z`, t[1]),
    P(`M${n(cx - w + 2.5)} ${n(cy + h * 0.05)}Q${n(cx - w + 1.5)} ${n(cy + h - 3)} ${n(cx)} ${n(cy + h - 3)}Q${n(cx + w - 4)} ${n(cy + h - 3)} ${n(cx + w - 4)} ${n(cy + h * 0.05)}Z`, tl[1]),
    R(cx - w * 0.55, cy - h * 1.45, w * 1.1, 4.5, t[0], 1.8),
    L(cx - w * 0.55, cy - h * 0.15, cx - w * 0.55, cy + h * 0.5, LUZ, 1.6, ' opacity=".38"'),
  ];
}

/** Lingote o bloque en perspectiva: tres caras, tres tonos. Metal, ladrillo, hormigón. */
function bloque(t, { cx = 32, cy = 36, w = 20, h = 11, prof = 7 }) {
  return [
    G([[cx - w, cy - h / 2], [cx + w, cy - h / 2], [cx + w, cy + h / 2], [cx - w, cy + h / 2]], t[1]),
    G([[cx - w, cy - h / 2], [cx - w + prof, cy - h / 2 - prof * 0.8], [cx + w + prof, cy - h / 2 - prof * 0.8], [cx + w, cy - h / 2]], t[0]),
    G([[cx + w, cy - h / 2], [cx + w + prof, cy - h / 2 - prof * 0.8], [cx + w + prof, cy + h / 2 - prof * 0.8], [cx + w, cy + h / 2]], t[2]),
  ];
}

/** Cristal facetado: la obsidiana, el vidrio, la punta lítica. */
function cristal(t, { cx = 32, cy = 33, w = 12, alto = 20, sesgo = 0.25 }) {
  const cima = [cx + w * sesgo, cy - alto];
  return [
    G([cima, [cx + w, cy - alto * 0.15], [cx + w * 0.45, cy + alto * 0.72], [cx - w * 0.5, cy + alto * 0.62], [cx - w, cy - alto * 0.2]], t[1]),
    G([cima, [cx - w, cy - alto * 0.2], [cx - w * 0.5, cy + alto * 0.62], [cx - w * 0.1, cy + alto * 0.1]], t[0]),
    G([cima, [cx + w, cy - alto * 0.15], [cx + w * 0.45, cy + alto * 0.72], [cx - w * 0.1, cy + alto * 0.1]], t[2]),
    PL([[cx - w * 0.1, cy + alto * 0.1], cima], LUZ, 1, ' opacity=".35"'),
  ];
}

/** Hoja de corte: el filo del hacha, del cuchillo, de la azuela. `pancho` la ensancha. */
function filo(t, { x = 32, y = 26, largo = 18, ancho = 7, pancho = 1, ang = 0, talon = 0 }) {
  const hijos = [
    P(`M${n(x - ancho * 0.35)} ${n(y + largo * 0.5)}L${n(x - ancho * 0.5)} ${n(y - largo * 0.4)}Q${n(x + ancho * pancho)} ${n(y - largo * 0.5)} ${n(x + ancho * pancho * 0.9)} ${n(y + largo * 0.55)}Z`, t[2],
      ' transform="translate(1 1.5)"'),
    P(`M${n(x - ancho * 0.35)} ${n(y + largo * 0.5)}L${n(x - ancho * 0.5)} ${n(y - largo * 0.4)}Q${n(x + ancho * pancho)} ${n(y - largo * 0.5)} ${n(x + ancho * pancho * 0.9)} ${n(y + largo * 0.55)}Z`, t[1]),
    P(`M${n(x - ancho * 0.2)} ${n(y + largo * 0.3)}L${n(x - ancho * 0.3)} ${n(y - largo * 0.25)}Q${n(x + ancho * pancho * 0.45)} ${n(y - largo * 0.3)} ${n(x + ancho * pancho * 0.4)} ${n(y + largo * 0.32)}Z`, t[0]),
  ];
  if (talon) hijos.push(R(x - ancho * 0.5 - talon, y - largo * 0.2, talon, largo * 0.45, t[2], 1));
  return ang ? [gira(ang, x, y, hijos)] : hijos;
}

/** Anillo de atadura sobre un cabo: tiento, cordel, alambre. Dos formas. */
function atadura(t, { cx, cy, w = 9, h = 5, ang = 0 }) {
  return [gira(ang, cx, cy, [
    R(cx - w / 2, cy - h / 2 + 1, w, h, t[2], h * 0.45),
    R(cx - w / 2, cy - h / 2, w, h, t[1], h * 0.45),
    L(cx - w * 0.35, cy - h * 0.12, cx + w * 0.35, cy - h * 0.28, t[0], 0.9),
  ])];
}

/** Rollo de cuerda visto de frente: el cordel, el tiento, la línea de pescar. */
function rollo(t, { cx = 32, cy = 34, r = 14, vueltas = 3, cola = true }) {
  const p = [E(cx + 1, cy + 1.5, r, r * 0.92, t[2]), E(cx, cy, r, r * 0.92, t[1]), E(cx, cy, r * 0.36, r * 0.33, HUECO)];
  for (let i = 0; i < vueltas; i++) {
    const rr = r * (0.5 + i * 0.22);
    p.push(E(cx, cy, rr, rr * 0.92, 'none', ` stroke="${i % 2 ? t[2] : t[0]}" stroke-width="1.2"`));
  }
  if (cola) p.push(T(`M${n(cx + r * 0.7)} ${n(cy + r * 0.6)}q6 4 2 9`, t[0], 2));
  return p;
}

/**
 * Malla de nudos: la red, la nasa, el velo de la careta.
 *
 * Las hebras van en diagonal y no en cuadrícula recta, y no es un gusto: a 58 px
 * una cuadrícula ortogonal se empasta con el borde del casillero —que también es
 * un rectángulo— y la red deja de leerse como red. En diagonal el ojo la separa
 * del marco de una.
 */
function malla(t, { x = 14, y = 20, w = 36, h = 26, paso = 7, marco = true }) {
  const p = [];
  if (marco) {
    p.push(R(x + 1.5, y + 1.5, w, h, t[2], 3));
    p.push(R(x, y, w, h, t[1], 3));
  }
  for (let k = -h + paso; k < w; k += paso) {
    // Cada hebra es una recta de pendiente 1 recortada contra el rectángulo.
    const a = k >= 0 ? [x + k, y] : [x, y - k];
    const b = (w - k <= h) ? [x + w, y + w - k] : [x + h + k, y + h];
    p.push(L(a[0], a[1], b[0], b[1], t[0], 1));
    p.push(L(x + w - (a[0] - x), a[1], x + w - (b[0] - x), b[1], t[0], 1));
  }
  return p;
}

/** Tejido de cestería: un trapecio con la trama cruzada. */
function cesto(t, { cx = 32, cy = 38, w = 19, h = 20, boca = 1.25, tapa = null }) {
  const wa = w * boca;
  const p = [
    G([[cx - wa - 1, cy - h / 2 + 1], [cx + wa + 1, cy - h / 2 + 1], [cx + w + 1, cy + h / 2 + 2], [cx - w + 1, cy + h / 2 + 2]], t[2]),
    G([[cx - wa, cy - h / 2], [cx + wa, cy - h / 2], [cx + w, cy + h / 2], [cx - w, cy + h / 2]], t[1]),
  ];
  for (let i = 1; i < 4; i++) {
    const f = i / 4, yy = cy - h / 2 + h * f, ww = wa + (w - wa) * f;
    p.push(L(cx - ww, yy, cx + ww, yy, i % 2 ? t[2] : t[0], 1.2));
  }
  for (let i = -2; i <= 2; i++) {
    p.push(L(cx + i * wa * 0.42, cy - h / 2, cx + i * w * 0.42, cy + h / 2, t[2], 1));
  }
  p.push(E(cx, cy - h / 2, wa, h * 0.17, t[0]));
  if (tapa) p.push(E(cx, cy - h / 2, wa * 0.82, h * 0.13, tapa[1]));
  return p;
}

/** Tela colgada, con pliegues: el quillango, el poncho, el encerado. */
function manto(t, { cx = 32, cy = 32, w = 20, h = 22, pliegues = 3, franja = null }) {
  const bajo = `M${n(cx - w)} ${n(cy - h)}L${n(cx + w)} ${n(cy - h)}L${n(cx + w * 0.92)} ${n(cy + h)}Q${n(cx)} ${n(cy + h * 0.72)} ${n(cx - w * 0.92)} ${n(cy + h)}Z`;
  const p = [
    P(bajo, t[2], ' transform="translate(1.5 1.5)"'),
    P(bajo, t[1]),
    P(`M${n(cx - w)} ${n(cy - h)}L${n(cx - w * 0.2)} ${n(cy - h)}L${n(cx - w * 0.3)} ${n(cy + h * 0.85)}Q${n(cx - w * 0.6)} ${n(cy + h * 0.9)} ${n(cx - w * 0.92)} ${n(cy + h)}Z`, t[0]),
  ];
  for (let i = 1; i <= pliegues; i++) {
    const x = cx - w + (2 * w * i) / (pliegues + 1);
    p.push(L(x, cy - h * 0.8, x, cy + h * 0.78, t[2], 1));
  }
  if (franja) {
    p.push(R(cx - w * 0.98, cy - h * 0.15, w * 1.96, 4, franja[1]));
    p.push(R(cx - w * 0.98, cy + h * 0.3, w * 1.9, 2.5, franja[2]));
  }
  return p;
}

/** Pluma: raquis y barbas. */
function pluma(t, { cx = 32, cy = 32, largo = 20, ancho = 6, ang = 0 }) {
  const d = `M0 ${n(-largo)}Q${n(ancho)} 0 0 ${n(largo * 0.75)}Q${n(-ancho)} 0 0 ${n(-largo)}Z`;
  const hijos = [
    P(d, t[2], ` transform="translate(${n(cx + 1)} ${n(cy + 1.5)})"`),
    P(d, t[1], ` transform="translate(${n(cx)} ${n(cy)})"`),
    P(`M0 ${n(-largo)}Q${n(ancho * 0.75)} 0 0 ${n(largo * 0.6)}Z`, t[0], ` transform="translate(${n(cx)} ${n(cy)})"`),
    L(cx, cy - largo, cx, cy + largo * 0.95, t[2], 1.4),
  ];
  for (let i = 0; i < 4; i++) {
    const yy = cy - largo * 0.6 + i * largo * 0.36;
    // Finas y medio transparentes: a 58 px unas barbas marcadas tapan el paño y
    // la pluma se lee como un galón militar en vez de como una pluma.
    hijos.push(L(cx, yy, cx + ancho * 0.8, yy - largo * 0.14, t[2], 0.7, ' opacity=".5"'));
    hijos.push(L(cx, yy, cx - ancho * 0.8, yy - largo * 0.14, t[2], 0.7, ' opacity=".5"'));
  }
  return [gira(ang, cx, cy, hijos)];
}

/** Hueso largo con los dos cóndilos. */
function hueso(t, { cx = 32, cy = 32, largo = 22, w = 6, ang = -32 }) {
  const r = w * 0.85;
  return [gira(ang, cx, cy, [
    R(cx - w / 2 + 1, cy - largo / 2 + 1.5, w, largo, t[2], w * 0.4),
    C(cx - r * 0.62 + 1, cy - largo / 2 + 1.5, r, t[2]), C(cx + r * 0.62 + 1, cy - largo / 2 + 1.5, r, t[2]),
    C(cx - r * 0.62 + 1, cy + largo / 2 + 1.5, r, t[2]), C(cx + r * 0.62 + 1, cy + largo / 2 + 1.5, r, t[2]),
    R(cx - w / 2, cy - largo / 2, w, largo, t[1], w * 0.4),
    C(cx - r * 0.62, cy - largo / 2, r, t[1]), C(cx + r * 0.62, cy - largo / 2, r, t[1]),
    C(cx - r * 0.62, cy + largo / 2, r, t[1]), C(cx + r * 0.62, cy + largo / 2, r, t[1]),
    L(cx - w * 0.22, cy - largo * 0.35, cx - w * 0.22, cy + largo * 0.35, t[0], 1.6),
  ])];
}

/** Asta ramificada: el garrón y las dos puntas. La única silueta bifurcada. */
function asta(t, { cx = 30, cy = 44, esc = 1, ang = 0 }) {
  const v = (x, y) => [cx + x * esc, cy - y * esc];
  return [gira(ang, cx, cy, [
    PL([v(0, 0), v(2, 10), v(-1, 20), v(3, 30)], t[2], 5.5),
    PL([v(0, 0), v(2, 10), v(-1, 20), v(3, 30)], t[1], 4),
    PL([v(1.5, 8), v(9, 13), v(12, 21)], t[2], 4.5),
    PL([v(1.5, 8), v(9, 13), v(12, 21)], t[1], 3.2),
    PL([v(0, 18), v(-8, 23), v(-10, 30)], t[2], 4),
    PL([v(0, 18), v(-8, 23), v(-10, 30)], t[1], 2.8),
    C(cx, cy - 1 * esc, 4 * esc, t[0]),
  ])];
}

/** Pez de perfil. `asado` le cambia el tinte y le pone las marcas de la brasa. */
function pez(t, { cx = 32, cy = 34, largo = 20, alto = 9, ang = -8, marcas = null }) {
  const hijos = [
    P(`M${n(cx - largo)} ${n(cy)}Q${n(cx - largo * 0.3)} ${n(cy - alto * 1.5)} ${n(cx + largo * 0.72)} ${n(cy - alto * 0.15)}Q${n(cx - largo * 0.3)} ${n(cy + alto * 1.5)} ${n(cx - largo)} ${n(cy)}Z`, t[2],
      ' transform="translate(1 1.5)"'),
    P(`M${n(cx - largo)} ${n(cy)}Q${n(cx - largo * 0.3)} ${n(cy - alto * 1.5)} ${n(cx + largo * 0.72)} ${n(cy - alto * 0.15)}Q${n(cx - largo * 0.3)} ${n(cy + alto * 1.5)} ${n(cx - largo)} ${n(cy)}Z`, t[1]),
    P(`M${n(cx - largo * 0.75)} ${n(cy - alto * 0.15)}Q${n(cx - largo * 0.2)} ${n(cy - alto * 0.95)} ${n(cx + largo * 0.4)} ${n(cy - alto * 0.35)}Q${n(cx - largo * 0.2)} ${n(cy - alto * 0.1)} ${n(cx - largo * 0.75)} ${n(cy - alto * 0.15)}Z`, t[0]),
    G([[cx - largo, cy], [cx - largo * 1.42, cy - alto * 0.85], [cx - largo * 1.3, cy], [cx - largo * 1.42, cy + alto * 0.85]], t[2]),
    P(`M${n(cx - largo * 0.15)} ${n(cy + alto * 0.55)}l${n(alto * 0.7)} ${n(alto * 0.75)}l${n(-alto * 1.3)} 0Z`, t[2]),
    C(cx + largo * 0.5, cy - alto * 0.3, 1.8, HUECO),
  ];
  if (marcas) for (let i = 0; i < 3; i++)
    hijos.push(L(cx - largo * 0.5 + i * largo * 0.42, cy - alto * 0.75, cx - largo * 0.62 + i * largo * 0.42, cy + alto * 0.7, marcas, 1.6, ' opacity=".7"'));
  return [gira(ang, cx, cy, hijos)];
}

/** Llama: tres lenguas, de afuera hacia adentro. La única pieza que se ve de noche. */
function llama({ cx = 32, cy = 30, alto = 16 }) {
  const f = (k) => `M${n(cx)} ${n(cy - alto * k)}C${n(cx + alto * 0.55 * k)} ${n(cy - alto * 0.45 * k)} ${n(cx + alto * 0.5 * k)} ${n(cy + alto * 0.35 * k)} ${n(cx)} ${n(cy + alto * 0.42 * k)}C${n(cx - alto * 0.5 * k)} ${n(cy + alto * 0.35 * k)} ${n(cx - alto * 0.55 * k)} ${n(cy - alto * 0.45 * k)} ${n(cx)} ${n(cy - alto * k)}Z`;
  return [P(f(1), M.brasa[1]), P(f(0.68), M.fuego[0]), P(f(0.34), '#fff3c4')];
}

/** Montón de granos o partículas: la arena, la ceniza, la harina, las semillas. */
function granos(t, { cx = 32, cy = 42, w = 20, alto = 14, cuantas = 7, r = 2.4, z = Math.random }) {
  const p = [
    P(`M${n(cx - w)} ${n(cy + 3)}Q${n(cx)} ${n(cy - alto - 2)} ${n(cx + w)} ${n(cy + 3)}Z`, t[2]),
    P(`M${n(cx - w + 2)} ${n(cy + 2)}Q${n(cx - 1)} ${n(cy - alto)} ${n(cx + w - 3)} ${n(cy + 2)}Z`, t[1]),
    P(`M${n(cx - w * 0.55)} ${n(cy - alto * 0.15)}Q${n(cx - w * 0.15)} ${n(cy - alto * 0.9)} ${n(cx + w * 0.1)} ${n(cy - alto * 0.2)}Z`, t[0]),
  ];
  for (let i = 0; i < cuantas; i++) {
    const x = cx + (z() - 0.5) * w * 1.7, y = cy - z() * alto * 0.6 + 2;
    p.push(E(x, y, r, r * 0.7, i % 2 ? t[0] : t[2]));
  }
  return p;
}

/** Chapa acanalada: la única superficie ondulada de la familia. */
function chapa(t, { x = 12, y = 22, w = 40, h = 22, ondas = 5, ang = 0 }) {
  const hijos = [R(x + 1.5, y + 1.5, w, h, t[2], 1.5), R(x, y, w, h, t[1], 1.5)];
  for (let i = 0; i < ondas; i++) {
    const xx = x + (w / ondas) * (i + 0.5);
    hijos.push(L(xx - 1, y + 1.5, xx - 1, y + h - 1.5, t[0], 2.2));
    hijos.push(L(xx + 2, y + 1.5, xx + 2, y + h - 1.5, t[2], 1.4));
  }
  return ang ? [gira(ang, x + w / 2, y + h / 2, hijos)] : hijos;
}

/** Punta lítica: triángulo con las facetas del lascado y el pedúnculo. */
function punta(t, { cx = 32, cy = 34, w = 10, alto = 22, ang = 0 }) {
  return [gira(ang, cx, cy, [
    G([[cx, cy - alto], [cx + w, cy + alto * 0.55], [cx + w * 0.35, cy + alto * 0.5], [cx + w * 0.3, cy + alto], [cx - w * 0.3, cy + alto], [cx - w * 0.35, cy + alto * 0.5], [cx - w, cy + alto * 0.55]], t[2],
      ' transform="translate(1 1.5)"'),
    G([[cx, cy - alto], [cx + w, cy + alto * 0.55], [cx + w * 0.35, cy + alto * 0.5], [cx + w * 0.3, cy + alto], [cx - w * 0.3, cy + alto], [cx - w * 0.35, cy + alto * 0.5], [cx - w, cy + alto * 0.55]], t[1]),
    G([[cx, cy - alto], [cx - w, cy + alto * 0.55], [cx - w * 0.2, cy + alto * 0.3]], t[0]),
    L(cx + w * 0.25, cy - alto * 0.4, cx + w * 0.6, cy + alto * 0.2, t[2], 1),
    L(cx - w * 0.15, cy + alto * 0.05, cx - w * 0.55, cy + alto * 0.42, t[2], 1),
  ])];
}

/** Anzuelo: la curva, la lengüeta y el ojal. */
function anzuelo(t, { cx = 32, cy = 30, esc = 1, ang = 0 }) {
  return [gira(ang, cx, cy, [
    T(`M${n(cx)} ${n(cy - 16 * esc)}L${n(cx)} ${n(cy + 6 * esc)}Q${n(cx)} ${n(cy + 15 * esc)} ${n(cx - 8 * esc)} ${n(cy + 13 * esc)}Q${n(cx - 13 * esc)} ${n(cy + 11 * esc)} ${n(cx - 12 * esc)} ${n(cy + 3 * esc)}`, t[2], 4 * esc),
    T(`M${n(cx)} ${n(cy - 16 * esc)}L${n(cx)} ${n(cy + 6 * esc)}Q${n(cx)} ${n(cy + 15 * esc)} ${n(cx - 8 * esc)} ${n(cy + 13 * esc)}Q${n(cx - 13 * esc)} ${n(cy + 11 * esc)} ${n(cx - 12 * esc)} ${n(cy + 3 * esc)}`, t[1], 2.6 * esc),
    L(cx - 12 * esc, cy + 3 * esc, cx - 8 * esc, cy - 3 * esc, t[0], 1.8 * esc),
    C(cx, cy - 16 * esc, 3 * esc, 'none', ` stroke="${t[1]}" stroke-width="${n(2 * esc)}"`),
  ])];
}

/** Saco o bolsa atada al cuello: el odre, la mochila, la harina. */
function saco(t, { cx = 32, cy = 38, w = 16, h = 16, tAta = M.cuero2 }) {
  return [
    P(`M${n(cx - w * 0.45)} ${n(cy - h)}Q${n(cx - w * 1.25)} ${n(cy - h * 0.1)} ${n(cx - w * 0.8)} ${n(cy + h * 0.75)}Q${n(cx)} ${n(cy + h * 1.15)} ${n(cx + w * 0.8)} ${n(cy + h * 0.75)}Q${n(cx + w * 1.25)} ${n(cy - h * 0.1)} ${n(cx + w * 0.45)} ${n(cy - h)}Z`, t[2],
      ' transform="translate(1 1.5)"'),
    P(`M${n(cx - w * 0.45)} ${n(cy - h)}Q${n(cx - w * 1.25)} ${n(cy - h * 0.1)} ${n(cx - w * 0.8)} ${n(cy + h * 0.75)}Q${n(cx)} ${n(cy + h * 1.15)} ${n(cx + w * 0.8)} ${n(cy + h * 0.75)}Q${n(cx + w * 1.25)} ${n(cy - h * 0.1)} ${n(cx + w * 0.45)} ${n(cy - h)}Z`, t[1]),
    P(`M${n(cx - w * 0.45)} ${n(cy - h * 0.9)}Q${n(cx - w * 1.05)} ${n(cy - h * 0.1)} ${n(cx - w * 0.72)} ${n(cy + h * 0.6)}Q${n(cx - w * 0.3)} ${n(cy + h * 0.5)} ${n(cx - w * 0.2)} ${n(cy - h * 0.85)}Z`, t[0]),
    R(cx - w * 0.62, cy - h * 1.05, w * 1.24, 5, tAta[2], 2.2),
    R(cx - w * 0.62, cy - h * 1.1, w * 1.24, 4.5, tAta[1], 2.2),
    G([[cx - w * 0.4, cy - h * 1.1], [cx - w * 0.6, cy - h * 1.6], [cx + w * 0.1, cy - h * 1.35], [cx + w * 0.3, cy - h * 1.1]], t[0]),
  ];
}

/** Arco tensado: la madera, la cuerda y la empuñadura. */
function arco(t, tc, { cx = 34, cy = 32, r = 22, ang = -18 }) {
  return [gira(ang, cx, cy, [
    T(`M${n(cx + r * 0.35)} ${n(cy - r)}Q${n(cx - r * 0.75)} ${n(cy)} ${n(cx + r * 0.35)} ${n(cy + r)}`, t[2], 5),
    T(`M${n(cx + r * 0.35)} ${n(cy - r)}Q${n(cx - r * 0.72)} ${n(cy)} ${n(cx + r * 0.35)} ${n(cy + r)}`, t[1], 3.4),
    L(cx + r * 0.35, cy - r, cx + r * 0.35, cy + r, tc[1], 1.4),
    R(cx - r * 0.42, cy - 5, 6, 10, t[2], 2.5),
    R(cx - r * 0.42, cy - 5.5, 5.5, 9.5, t[0], 2.5),
  ])];
}

/** Flecha o dardo entero: astil, punta y emplumado. */
function flecha(t, tp, tf, { cx = 32, cy = 32, largo = 24, ang = -38 }) {
  return [gira(ang, cx, cy, [
    ...varilla(t, { x1: cx, y1: cy + largo, x2: cx, y2: cy - largo * 0.62, w: 3 }),
    G([[cx, cy - largo], [cx + 5, cy - largo * 0.55], [cx, cy - largo * 0.68], [cx - 5, cy - largo * 0.55]], tp[2], ' transform="translate(1 1)"'),
    G([[cx, cy - largo], [cx + 5, cy - largo * 0.55], [cx, cy - largo * 0.68], [cx - 5, cy - largo * 0.55]], tp[1]),
    G([[cx, cy - largo], [cx - 5, cy - largo * 0.55], [cx, cy - largo * 0.68]], tp[0]),
    G([[cx, cy + largo * 0.85], [cx + 6, cy + largo * 0.62], [cx, cy + largo * 0.5]], tf[1]),
    G([[cx, cy + largo * 0.85], [cx - 6, cy + largo * 0.62], [cx, cy + largo * 0.5]], tf[2]),
  ])];
}

/** Bolas atadas a un tiento, desde uno hasta tres: la piedra perdida y las boleadoras. */
function boleadora(t, tc, { cx = 32, cy = 32, cuantas = 3, r = 7, esc = 15 }) {
  const p = [], pos = [];
  for (let i = 0; i < cuantas; i++) {
    const a = cuantas === 1 ? -Math.PI / 2 : (i / cuantas) * Math.PI * 2 - Math.PI / 2;
    pos.push(cuantas === 1 ? [cx, cy + 6] : [cx + Math.cos(a) * esc, cy + Math.sin(a) * esc * 0.95]);
  }
  const nudo = cuantas === 1 ? [cx, cy - 16] : [cx, cy];
  for (const [x, y] of pos) p.push(L(nudo[0], nudo[1], x, y, tc[2], 2.4));
  for (const [x, y] of pos) p.push(C(x + 1, y + 1.5, r, t[2]));
  for (const [x, y] of pos) p.push(C(x, y, r, t[1]));
  for (const [x, y] of pos) p.push(C(x - r * 0.28, y - r * 0.32, r * 0.36, t[0]));
  for (const [x, y] of pos) p.push(T(`M${n(x - r)} ${n(y)}q${n(r)} ${n(-r * 0.6)} ${n(r * 2)} 0`, tc[1], 1.1));
  p.push(C(nudo[0], nudo[1], 3, tc[1]));
  return p;
}

/** Tiras colgando de una vara: el charqui, el tiento, el secadero. */
function tiras(t, tv, { cx = 32, cy = 20, cuantas = 3, largo = 24, w = 7 }) {
  const p = [...varilla(tv, { x1: 7, y1: cy, x2: 57, y2: cy - 2, w: 4.5 })];
  for (let i = 0; i < cuantas; i++) {
    // Desparejas a propósito: todas del mismo ancho, del mismo largo y colgando
    // rectas, esto se leía como los tubos de un órgano. Lo que hace que una tira
    // sea una tira es que se afine hacia abajo y que cuelgue torcida.
    const x = cx + (i - (cuantas - 1) / 2) * (w + 4.5);
    const lg = largo * (0.72 + ((i * 7) % 5) * 0.09);
    const ww = w * (0.82 + ((i * 3) % 4) * 0.1);
    const d = (dx, dy) => `M${n(x - ww / 2 + dx)} ${n(cy + dy)}h${n(ww)}`
      + `l${n(-ww * 0.16)} ${n(lg)}q${n(-ww * 0.34)} 4 ${n(-ww * 0.68)} 0Z`;
    p.push(gira(-8 + (i % 3) * 7, x, cy, [
      P(d(1, 1.5), t[2]), P(d(0, 0), t[1]),
      L(x - ww * 0.22, cy + 4, x - ww * 0.28, cy + lg - 4, t[0], 1.2),
    ]));
  }
  return p;
}

/** Hongo: sombrero, pie y láminas. */
function hongo(t, tPie, { cx = 32, cy = 38, r = 13, alto = 10 }) {
  return [
    R(cx - r * 0.26 + 1, cy - 2 + 1.5, r * 0.52, alto + 2, tPie[2], 2),
    R(cx - r * 0.26, cy - 2, r * 0.52, alto + 2, tPie[1], 2),
    P(`M${n(cx - r)} ${n(cy)}Q${n(cx)} ${n(cy - alto * 2.1)} ${n(cx + r)} ${n(cy)}Q${n(cx)} ${n(cy + alto * 0.35)} ${n(cx - r)} ${n(cy)}Z`, t[2], ' transform="translate(1 1.5)"'),
    P(`M${n(cx - r)} ${n(cy)}Q${n(cx)} ${n(cy - alto * 2.1)} ${n(cx + r)} ${n(cy)}Q${n(cx)} ${n(cy + alto * 0.35)} ${n(cx - r)} ${n(cy)}Z`, t[1]),
    P(`M${n(cx - r * 0.75)} ${n(cy - alto * 0.25)}Q${n(cx - r * 0.15)} ${n(cy - alto * 1.6)} ${n(cx + r * 0.2)} ${n(cy - alto * 0.6)}Z`, t[0]),
    E(cx, cy, r * 0.94, alto * 0.28, tPie[2]),
  ];
}

/** Panal de abejas: las celdas hexagonales. */
function panal(t, { cx = 32, cy = 32, r = 6.5, filas = 2 }) {
  const p = [], hex = (x, y, rr) => {
    const q = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      q.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    return q;
  };
  const cel = [];
  for (let f = -filas; f <= filas; f++)
    for (let c = -filas; c <= filas; c++) {
      const x = cx + c * r * 1.75, y = cy + f * r * 1.52 + (c % 2 ? r * 0.76 : 0);
      if (Math.hypot(x - cx, y - cy) > r * 2.7) continue;
      cel.push([x, y]);
    }
  for (const [x, y] of cel) p.push(G(hex(x, y + 1.5, r), t[2]));
  for (const [x, y] of cel) p.push(G(hex(x, y, r), t[1]));
  for (const [x, y] of cel) p.push(G(hex(x, y, r * 0.62), t[0]));
  return p;
}

// ── Las 115 recetas ─────────────────────────────────────────────────────────
//
// Cada una recibe el ruido con semilla de su propio id y devuelve la lista de
// formas. Se leen en el mismo orden que los datos: primero los 71 de `RECURSOS`
// y después los 44 objetos de `herramientas.json` que se tienen en la mano.
//
// La regla que ordena todo esto: **la materia da la paleta y la forma da el
// oficio**. Dos maderas se distinguen por el tono; una madera y una tabla, por la
// silueta. Cuando dos cosas comparten materia y oficio —el tiento y el charqui,
// los dos son tiras colgando de una vara— se separan por el tinte y por el
// número de tiras, y eso es todo lo que hay: son parecidos a propósito, porque
// en el mundo también lo son.

/** Los 71 de `RECURSOS`: lo que se junta, se cocina y se fabrica a granel. */
const RECETAS_RECURSOS = {

  // ── Madera y monte ────────────────────────────────────────────────────────

  // Dos leños cruzados y la tapa a la vista: la madera partida se reconoce por
  // el círculo de los anillos, no por el color, que a 58 px se confunde con la
  // corteza y con el cuero.
  madera_dura: () => [
    ...leno(M.madera, { x: 8, y: 42, largo: 44, grueso: 14, ang: -12, vetas: 2, anillos: 2 }),
    ...leno(M.madera, { x: 13, y: 24, largo: 36, grueso: 11, ang: 13, vetas: 1, anillos: 2 }),
  ],

  // La misma pieza, más fina y en el pardo claro: es el par que el jugador
  // compara todo el tiempo, así que se dibujan igual a propósito y sólo cambia
  // lo que de verdad las diferencia — el tono y el grosor.
  madera_blanda: () => [
    ...leno(M.madera2, { x: 8, y: 41, largo: 45, grueso: 10, ang: -8, vetas: 2, anillos: 1 }),
    ...leno(M.madera2, { x: 12, y: 26, largo: 38, grueso: 8, ang: 10, vetas: 2, anillos: 1 }),
  ],

  lena: () => haz(M.corteza, M.fibra, { cx: 32, cy: 56, largo: 40, cuantas: 5, abre: 50, w: 3.6 }),

  // Uno solo y gordo, atravesado: el tronco es lo más pesado del bolso (6 kg) y
  // tiene que verse desde el otro lado de la grilla.
  tronco: () => [
    ...leno(M.corteza, { x: 5, y: 33, largo: 52, grueso: 26, ang: -5, vetas: 3, anillos: 3 }),
    L(14, 24, 40, 21, M.corteza[2], 1.4), L(16, 43, 42, 45, M.corteza[2], 1.4),
  ],

  // Placa arrancada del tronco: curva, con la cara de adentro clara y las
  // grietas verticales del ciprés. Como bulto redondeado se leía como una nuez —
  // la corteza no tiene ni un borde blando, y eso es lo que la identifica.
  corteza: () => [
    P('M17 8q17 -4 31 2l-4 48q-15 5 -29 -2Z', M.corteza[2], ' transform="translate(1.5 1.5)"'),
    P('M17 8q17 -4 31 2l-4 48q-15 5 -29 -2Z', M.corteza[1]),
    P('M17 8q17 -4 31 2q-15 7 -29 3Z', M.madera2[1]),
    L(23, 15, 22, 53, M.corteza[2], 1.8), L(31, 16, 31, 55, M.corteza[2], 1.8),
    L(39, 16, 40, 53, M.corteza[2], 1.8),
    L(19, 14, 18, 51, M.corteza[0], 1.2),
  ],

  // Mechón de hebras largas con el nudo en el medio. Las ondas van desfasadas
  // para que no se lea como un peine.
  fibra: () => {
    const p = [];
    for (let i = 0; i < 9; i++) {
      // Nueve hebras finas y juntas, y el nudo angosto en el medio. Con seis
      // hebras gruesas separadas y una atadura del ancho del cuadro, el mechón
      // se leía como una H.
      const x = 20 + i * 3, s = i % 2 ? 1 : -1;
      const d = `M${n(x)} 6q${n(s * 4)} 13 0 26q${n(s * -4)} 13 ${n(s * 2)} 26`;
      p.push(T(d, M.fibra[2], 2.8)); p.push(T(d, M.fibra[1], 1.6));
    }
    return [...p, ...atadura(M.cuero2, { cx: 32, cy: 33, w: 19, h: 7 })];
  },

  // Barba de viejo: una madeja despeinada. El jitter alto y las hebras sueltas
  // son lo que la separan de una piedra clara, que tiene el mismo contorno.
  yesca: (z) => {
    // Núcleo chico y muchas hebras. Con el núcleo grande y seis hebras cortas
    // parecía un bicho: una madeja de barba de viejo es casi toda pelusa.
    const p = canto(M.liquen, { cx: 32, cy: 35, r: 14, lados: 10, z, sacude: 0.42, achata: 0.95 });
    // Las hebras salen de costado y se enroscan, no salen derechas para afuera:
    // radiales, once hebras largas convertían la madeja en una estrella.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.25, r0 = 10 + z() * 2;
      p.push(T(`M${n(32 + Math.cos(a) * r0)} ${n(35 + Math.sin(a) * r0 * 0.95)}`
        + `q${n(Math.cos(a + 1.2) * 7)} ${n(Math.sin(a + 1.2) * 7)} ${n(Math.cos(a + 2.3) * 5)} ${n(Math.sin(a + 2.3) * 9)}`,
        i % 2 ? M.liquen[0] : M.liquen[2], 1.6));
    }
    return p;
  },

  pinocha: () => [
    ...varilla(M.corteza, { x1: 11, y1: 52, x2: 53, y2: 42, w: 3.4 }),
    ...haz(M.verde, null, { cx: 21, cy: 50, largo: 24, cuantas: 5, abre: 78, w: 1.8, ata: false }),
    ...haz(M.verde, null, { cx: 42, cy: 45, largo: 27, cuantas: 5, abre: 78, w: 1.8, ata: false }),
  ],

  // Gotón de resina colgando de un trozo de corteza: sin el soporte, la gota
  // sola era el agua.
  resina: (z) => [
    ...canto(M.corteza, { cx: 32, cy: 46, r: 16, lados: 6, z, achata: 0.44 }),
    ...gota(M.resina, { cx: 32, cy: 26, r: 12 }),
  ],

  // Colihue: caña de una pieza con los nudos marcados y una hoja.
  cana: () => [
    ...varilla(M.junco, { x1: 27, y1: 58, x2: 33, y2: 6, w: 9 }),
    ...atadura(M.junco, { cx: 30.5, cy: 44, w: 11, h: 4, ang: -6 }),
    ...atadura(M.junco, { cx: 31.5, cy: 30, w: 11, h: 4, ang: -6 }),
    ...atadura(M.junco, { cx: 32.5, cy: 16, w: 11, h: 4, ang: -6 }),
    ...hojaVeg(M.junco, { cx: 45, cy: 26, largo: 13, ancho: 4.5, ang: 44, venas: 1 }),
  ],

  // Semillas sueltas: pocas y grandes, cada una con su raya. Contra la arena, que
  // es muchas y chicas, y contra la ceniza, que es un montón sin grano.
  semilla: (z) => {
    const p = [E(32, 47, 19, 5, M.corteza[2])];
    for (let i = 0; i < 6; i++) {
      const x = 16 + (i % 3) * 16 + (z() - 0.5) * 4, y = 30 + Math.floor(i / 3) * 12 + (z() - 0.5) * 4;
      const a = (z() - 0.5) * 90;
      p.push(gira(a, x, y, [E(x + 1, y + 1, 6, 3.6, M.fibra[2]), E(x, y, 6, 3.6, M.fibra[1]),
        L(x - 3.5, y - 0.5, x + 3.5, y - 0.5, M.fibra[0], 1.2)]));
    }
    return p;
  },

  // Casi paralelas: cruzadas a ±25° las dos plumas formaban una V y se leían
  // como una insignia.
  pluma: () => [
    ...pluma(M.pluma, { cx: 25, cy: 32, largo: 23, ancho: 8.5, ang: -13 }),
    ...pluma(M.pluma, { cx: 41, cy: 34, largo: 19, ancho: 7, ang: 11 }),
  ],

  // ── Piedra y mineral ──────────────────────────────────────────────────────

  piedra: (z) => [
    ...canto(M.piedra, { cx: 31, cy: 36, r: 18, lados: 7, z }),
    L(24, 27, 30, 24, LUZ, 1.4, ' opacity=".45"'),
  ],

  obsidiana: (z) => [
    ...cristal(M.obsidiana, { cx: 32, cy: 33, w: 14, alto: 22, sesgo: 0.22 }),
    ...canto(M.obsidiana, { cx: 48, cy: 47, r: 7, lados: 5, z, sacude: 0.4 }),
    L(28, 22, 33, 34, LUZ, 1.6, ' opacity=".5"'),
  ],

  // Pella con las marcas de los dedos: es lo único que la separa de una piedra
  // del mismo tamaño y del mismo pardo.
  arcilla: (z) => [
    ...canto(M.arcilla, { cx: 32, cy: 37, r: 17, lados: 6, z, achata: 0.92, sacude: 0.2 }),
    E(26, 31, 4, 5.5, M.arcilla[2], ' opacity=".7"'),
    E(35, 34, 3.6, 5, M.arcilla[2], ' opacity=".7"'),
    E(30, 43, 3.4, 4.4, M.arcilla[2], ' opacity=".7"'),
  ],

  fruto: (z) => bayas(M.baya, { cx: 32, cy: 37, r: 9.5, cuantas: 3, z }),

  junco: () => {
    const p = [];
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 8;
      p.push(...varilla(M.junco, { x1: x + (i - 1.5) * 2, y1: 58, x2: x, y2: 12 + (i % 2) * 6, w: 4 }));
    }
    p.push(E(28, 12, 3, 7, M.corteza[2]), E(27.5, 11, 2.6, 6.4, M.corteza[1]));
    return p;
  },

  hongo: () => [
    ...hongo(M.hongo, M.grasa, { cx: 27, cy: 38, r: 14, alto: 11 }),
    ...hongo(M.hongo, M.grasa, { cx: 47, cy: 47, r: 9, alto: 7 }),
  ],

  agua: () => [
    ...cuenco(M.ceramica, { cx: 32, cy: 42, w: 20, h: 14, liquido: M.agua }),
    ...gota(M.agua, { cx: 32, cy: 16, r: 7 }),
  ],

  // ── Del animal ────────────────────────────────────────────────────────────

  // Cuero crudo estirado: el contorno con las cuatro patas es la silueta, y sin
  // ella un cuero es una mancha parda igual que la corteza.
  cuero: () => [
    // Se probó con la silueta de las cuatro patas y no funciona a este tamaño:
    // con pocos puntos la curva se las come y queda una tabla, y con muchos el
    // recorte del medio la parte en dos y queda un moño. Lo que sí se lee es la
    // punta doblada, que muestra la carnaza clara: eso dice «cuero» y ninguna
    // otra cosa de la grilla lo tiene.
    P('M11 13q21 -7 42 0l2 38q-23 7 -46 0Z', M.cuero[2], ' transform="translate(1.5 1.5)"'),
    P('M11 13q21 -7 42 0l2 38q-23 7 -46 0Z', M.cuero[1]),
    P('M55 51q-13 4 -22 1l20 -15Z', M.cuero2[0]),
    T('M53 37q3 8 2 14', M.cuero[2], 1.4),
    L(19, 24, 44, 22, M.cuero[2], 1.2), L(18, 34, 40, 33, M.cuero[2], 1.2),
    L(15, 17, 15, 47, M.cuero[0], 1.4),
  ],

  tendon: () => {
    const p = [];
    for (let i = 0; i < 3; i++) {
      const y = 22 + i * 10;
      const d = `M10 ${n(y)}q12 ${n(i % 2 ? 8 : -8)} 22 0q10 ${n(i % 2 ? -7 : 7)} 22 0`;
      p.push(T(d, M.hueso[2], 4.5)); p.push(T(d, M.hueso[1], 2.8));
    }
    return [...p, ...atadura(M.cuero2, { cx: 32, cy: 32, w: 10, h: 24, ang: 90 })];
  },

  grasa: (z) => [
    ...canto(M.grasa, { cx: 32, cy: 36, r: 16, lados: 6, z, sacude: 0.16, achata: 0.78 }),
    E(27, 30, 6, 3.4, LUZ, ' opacity=".55"'),
    T('M20 40q10 5 22 1', M.carne[0], 2, ' opacity=".55"'),
  ],

  // Vellón: cinco bollos superpuestos y tres rulos. Es la única silueta de la
  // familia que no tiene ni un borde recto.
  lana: (z) => {
    const pos = [[24, 34], [40, 32], [32, 24], [28, 44], [42, 43]];
    const p = [];
    for (const [x, y] of pos) p.push(C(x + 1, y + 1.5, 11, M.lana[2]));
    for (const [x, y] of pos) p.push(C(x, y, 11, M.lana[1]));
    for (const [x, y] of pos) p.push(C(x - 3, y - 3.5, 5, M.lana[0]));
    for (let i = 0; i < 3; i++)
      p.push(T(`M${n(22 + i * 10)} ${n(28 + (i % 2) * 12)}a4 4 0 1 1 6 3`, M.lana[2], 1.4, ` opacity=".${6 + Math.round(z())}"`));
    return p;
  },

  asta: () => asta(M.asta, { cx: 27, cy: 55, esc: 1.55, ang: 4 }),

  hueso: () => hueso(M.hueso, { cx: 32, cy: 32, largo: 27, w: 7.5, ang: -36 }),

  carne: (z) => [
    ...bulto([[16, 20], [36, 13], [50, 24], [48, 44], [30, 52], [15, 40]]
      .map(([x, y]) => [x + (z() - 0.5) * 3, y + (z() - 0.5) * 3]), M.carne),
    T('M22 30q10 -4 18 3', M.grasa[0], 2.2, ' opacity=".75"'),
    T('M20 39q12 -3 22 4', M.grasa[0], 1.8, ' opacity=".6"'),
    ...hueso(M.hueso, { cx: 46, cy: 46, largo: 11, w: 5, ang: -40 }),
  ],

  // Asada: la misma pieza en el pardo del fuego, atravesada por el espeto y con
  // las marcas de la parrilla. Cruda y asada tienen que leerse como la misma
  // cosa en dos estados, no como dos cosas.
  carne_asada: (z) => [
    ...varilla(M.madera2, { x1: 8, y1: 50, x2: 56, y2: 14, w: 3.2 }),
    ...bulto([[17, 22], [37, 15], [49, 27], [45, 45], [28, 50], [15, 38]]
      .map(([x, y]) => [x + (z() - 0.5) * 3, y + (z() - 0.5) * 3]), M.asado),
    L(22, 24, 30, 45, M.brea[1], 2, ' opacity=".55"'),
    L(32, 20, 40, 42, M.brea[1], 2, ' opacity=".55"'),
  ],

  pescado_asado: () => [
    ...varilla(M.madera2, { x1: 6, y1: 48, x2: 58, y2: 18, w: 3 }),
    ...pez(M.asado, { cx: 33, cy: 34, largo: 19, alto: 8.5, ang: -14, marcas: '#3a1c0e' }),
  ],

  // Hervida: el mismo cuenco que el agua cruda, más tres volutas. Es la
  // diferencia que importa —una te enferma y la otra no— y no hay lugar para
  // dibujar nada más elocuente en 58 px.
  agua_segura: () => [
    ...cuenco(M.ceramica, { cx: 32, cy: 44, w: 20, h: 14, liquido: M.agua }),
    T('M23 26q-4 -6 1 -10q4 -4 0 -8', M.humo[0], 2.4, ' opacity=".8"'),
    T('M32 22q-4 -6 1 -10q4 -4 0 -7', M.humo[0], 2.4, ' opacity=".9"'),
    T('M41 26q-4 -6 1 -10q4 -4 0 -8', M.humo[0], 2.4, ' opacity=".8"'),
  ],

  infusion_canelo: () => [
    ...cuenco(M.ceramica, { cx: 31, cy: 44, w: 17, h: 13, liquido: M.miel }),
    T('M26 26q-4 -6 1 -10', M.humo[0], 2.2, ' opacity=".8"'),
    T('M36 25q-4 -6 1 -10', M.humo[0], 2.2, ' opacity=".8"'),
    ...hojaVeg(M.verde, { cx: 46, cy: 20, largo: 12, ancho: 5, ang: 34, venas: 1 }),
  ],

  // ── Los tres remedios ─────────────────────────────────────────────────────
  //
  // Los tres llevan un acento violeta —el #a889bd con el que el bolso ya pintaba
  // la categoría «remedio»— además de su materia. Es la única marca de categoría
  // que se dibuja: son tres cosas que se buscan con la salud en rojo, o sea
  // apurado, y el color es lo que se ve antes que la forma.

  emplasto_maqui: (z) => [
    R(15, 30, 34, 16, M.lana[2], 6), R(14, 28, 34, 16, M.lana[1], 6),
    L(18, 32, 44, 32, M.lana[0], 1.6), L(18, 40, 44, 40, M.lana[2], 1.4),
    ...hojaVeg(M.verde, { cx: 30, cy: 22, largo: 13, ancho: 6.5, ang: -22 }),
    ...bayas(M.violeta, { cx: 42, cy: 24, r: 4.5, cuantas: 2, tallo: null, z }),
  ],

  lavado_michay: () => [
    ...frasco(M.vidrio, M.miel, { cx: 29, cy: 36, w: 11, h: 15 }),
    PL([[46, 50], [45, 38], [49, 26], [46, 16]], M.verde[2], 2.6),
    ...[[45, 42], [48, 33], [46.5, 24]].flatMap(([x, y], i) => [
      L(x, y, x + (i % 2 ? 6 : -6), y - 4, M.violeta[1], 1.8),
      L(x, y, x + (i % 2 ? -5 : 5), y - 3, M.verde[1], 1.8),
    ]),
  ],

  propoleo: (z) => [
    ...canto(M.resina, { cx: 30, cy: 38, r: 13, lados: 8, z, sacude: 0.24 }),
    ...canto(M.resina, { cx: 46, cy: 46, r: 7, lados: 6, z, sacude: 0.3 }),
    ...hojaVeg(M.violeta, { cx: 44, cy: 22, largo: 10, ancho: 4.5, ang: 28, venas: 1 }),
  ],

  pescado: () => pez(M.pescado, { cx: 33, cy: 34, largo: 20, alto: 9, ang: -8 }),

  // ── Áridos y chatarra ─────────────────────────────────────────────────────

  arena: (z) => granos(M.arena, { cx: 32, cy: 47, w: 22, alto: 17, cuantas: 10, r: 1.7, z }),

  ripio: (z) => [
    ...canto(M.piedra, { cx: 24, cy: 42, r: 11, lados: 6, z }),
    ...canto(M.piedra, { cx: 43, cy: 45, r: 9, lados: 5, z }),
    ...canto(M.piedra, { cx: 34, cy: 27, r: 10, lados: 7, z }),
    ...canto(M.piedra, { cx: 48, cy: 28, r: 6.5, lados: 5, z }),
  ],

  // Tosca: bloque terroso y cuarteado. Contra la arena, que es un montón suelto;
  // contra el ripio, que son piedras sueltas.
  tosca: (z) => [
    ...canto(M.tosca, { cx: 32, cy: 37, r: 18, lados: 5, z, sacude: 0.16, achata: 0.86, giro: 0.9 }),
    // Estratos horizontales y no grietas que salen del centro: las radiales se
    // leían como una telaraña.
    T('M17 31q15 -4 31 1', M.tosca[2], 1.8),
    T('M17 40q15 -4 30 1', M.tosca[2], 1.6),
    T('M20 47q12 -3 25 1', M.tosca[2], 1.4),
  ],

  pomez: (z) => {
    const p = canto(M.pomez, { cx: 32, cy: 36, r: 17, lados: 8, z, sacude: 0.26 });
    for (let i = 0; i < 7; i++)
      p.push(C(32 + (z() - 0.5) * 22, 36 + (z() - 0.5) * 20, 1.4 + z() * 1.6, M.pomez[2]));
    return p;
  },

  // Tres pedazos distintos y ninguno entero: una chapa doblada, una tuerca y un
  // hierro retorcido. La chatarra es lo que quedó del mundo de antes.
  chatarra: () => [
    ...chapa(M.oxido, { x: 10, y: 30, w: 26, h: 15, ondas: 3, ang: -18 }),
    ...(() => {
      const hx = (rr) => Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return [44 + Math.cos(a) * rr, 24 + Math.sin(a) * rr];
      });
      return [G(hx(10), M.hierro[2]), G(hx(9), M.hierro[1]), C(44, 24, 4, HUECO)];
    })(),
    T('M18 52q10 -8 20 -1q8 6 16 -2', M.oxido[2], 4),
    T('M18 52q10 -8 20 -1q8 6 16 -2', M.oxido[1], 2.4),
  ],

  // ── Lo que se fabrica a mano ──────────────────────────────────────────────

  cordel: () => rollo(M.fibra, { cx: 32, cy: 34, r: 15, vueltas: 3 }),

  // El giro va afuera y no adentro de cada pieza. Con el leño girado −30° y las
  // ataduras puestas en coordenadas absolutas, las ataduras caían al costado del
  // cabo y el mango labrado quedaba idéntico a un leño de madera blanda.
  mango: () => [gira(-30, 32, 34, [
    ...leno(M.madera2, { x: 12, y: 34, largo: 40, grueso: 10, ang: 0, vetas: 2 }),
    ...atadura(M.cuero2, { cx: 21, cy: 34, w: 8, h: 14 }),
    ...atadura(M.cuero2, { cx: 44, cy: 34, w: 8, h: 14 }),
  ])],

  tiento: () => tiras(M.cuero2, M.madera, { cx: 32, cy: 18, cuantas: 3, largo: 26, w: 5 }),

  // Enrollado y con la solapa afuera: es la forma en que se guarda un cuero
  // terminado, y lo separa del cuero crudo, que está estirado.
  cuero_curtido: () => [
    ...leno(M.cuero2, { x: 9, y: 36, largo: 42, grueso: 20, ang: -7, vetas: 2, anillos: 3 }),
    P('M12 30q-8 6 -3 16q8 4 12 -2Z', M.cuero2[2]),
    P('M13 30q-6 6 -2 14q7 3 10 -2Z', M.cuero2[0]),
  ],

  brea: () => [
    ...cuenco(M.ceramica, { cx: 31, cy: 42, w: 19, h: 14, liquido: M.brea }),
    ...gota(M.brea, { cx: 45, cy: 20, r: 7 }),
  ],

  punta: () => punta(M.obsidiana, { cx: 32, cy: 33, w: 11, alto: 22 }),

  flecha: () => flecha(M.junco, M.obsidiana, M.pluma, { cx: 32, cy: 32, largo: 26, ang: -38 }),

  bola: () => [
    ...boleadora(M.piedra, M.cuero2, { cuantas: 1, r: 14, cx: 32, cy: 38 }),
    T('M20 34q12 -7 24 0', M.cuero2[1], 1.6), T('M22 44q10 5 20 -1', M.cuero2[1], 1.6),
  ],

  anzuelo: () => anzuelo(M.hueso, { cx: 35, cy: 30, esc: 1.5 }),

  aguja: () => [
    gira(-38, 32, 32, [
      G([[32, 8], [34.5, 16], [34.5, 52], [29.5, 52], [29.5, 16]], M.hueso[2], ' transform="translate(1 1)"'),
      G([[32, 8], [34.5, 16], [34.5, 52], [29.5, 52], [29.5, 16]], M.hueso[1]),
      L(31, 18, 31, 48, M.hueso[0], 1.2),
      E(32, 46, 1.8, 4, HUECO),
    ]),
    T('M46 42q8 4 4 12q-4 7 -12 4', M.fibra[1], 2),
  ],

  mosca: () => [
    ...anzuelo(M.acero, { cx: 37, cy: 36, esc: 1.15 }),
    ...pluma(M.fuego, { cx: 30, cy: 26, largo: 11, ancho: 4.5, ang: -52 }),
    ...pluma(M.pluma, { cx: 38, cy: 22, largo: 12, ancho: 4, ang: 38 }),
    ...atadura(M.carne, { cx: 37, cy: 32, w: 7, h: 5 }),
  ],

  vela: () => [
    R(27, 22, 11, 30, M.cera[2], 2), R(26, 21, 11, 30, M.cera[1], 2),
    L(28.5, 26, 28.5, 48, M.cera[0], 2),
    E(31.5, 21, 5.5, 2.4, M.cera[0]),
    L(31.5, 21, 31.5, 16, M.brea[1], 1.6),
    ...llama({ cx: 31.5, cy: 12, alto: 11 }),
    P('M37 26q3 8 -1 12q-3 -5 1 -12Z', M.cera[0]),
  ],

  miel: () => [
    ...panal(M.miel, { cx: 32, cy: 26, r: 7, filas: 1 }),
    T('M32 40q-2 6 1 10', M.miel[1], 3.4),
    ...gota(M.miel, { cx: 33, cy: 52, r: 7 }),
  ],

  cera: (z) => [
    ...bloque(M.cera, { cx: 28, cy: 43, w: 17, h: 10, prof: 6 }),
    ...panal(M.cera, { cx: 30, cy: 22, r: 5.5, filas: 1 }),
    C(46, 36, 2, M.miel[2], ` opacity=".${5 + Math.round(z())}"`),
  ],

  carbon: (z) => [
    ...canto(M.carbon, { cx: 26, cy: 40, r: 13, lados: 6, z, sacude: 0.42 }),
    ...canto(M.carbon, { cx: 43, cy: 32, r: 11, lados: 5, z, sacude: 0.42 }),
    ...canto(M.carbon, { cx: 40, cy: 48, r: 8, lados: 5, z, sacude: 0.42 }),
    L(21, 34, 27, 38, LUZ, 1.4, ' opacity=".35"'),
  ],

  ceniza: (z) => [
    ...granos(M.ceniza, { cx: 32, cy: 48, w: 21, alto: 15, cuantas: 6, r: 2, z }),
    T('M24 28q-3 -6 2 -9', M.ceniza[0], 1.8, ' opacity=".6"'),
    T('M38 26q-3 -6 2 -9', M.ceniza[0], 1.8, ' opacity=".6"'),
  ],

  // Mortero: la llana y la mezcla. El montón solo era ceniza otra vez.
  mortero: (z) => [
    ...granos(M.ceniza, { cx: 30, cy: 50, w: 20, alto: 11, cuantas: 4, r: 2, z }),
    gira(-24, 34, 28, [
      R(19, 26, 32, 7, M.acero[2], 1.5), R(18, 24.5, 32, 7, M.acero[1], 1.5),
      L(21, 26.5, 47, 26.5, M.acero[0], 1.4),
      R(30, 17, 6, 8, M.madera[1], 2),
    ]),
  ],

  ceramica: () => [
    ...frasco(M.ceramica, M.ceramica, { cx: 32, cy: 35, w: 14, h: 16 }),
    R(20, 34, 24, 4, M.arcilla[2], 1),
    T('M46 26q7 4 2 12', M.ceramica[1], 3.4),
  ],

  ladrillo: () => [
    ...bloque(M.ceramica, { cx: 26, cy: 44, w: 18, h: 10, prof: 7 }),
    ...bloque(M.ceramica, { cx: 30, cy: 28, w: 16, h: 9, prof: 6 }),
    L(12, 39, 44, 39, M.arcilla[2], 1.4),
  ],

  vidrio: () => [
    G([[14, 44], [22, 14], [34, 16], [30, 46]], M.vidrio[2]),
    G([[15, 43], [22.5, 16], [32.5, 17.5], [29, 44]], M.vidrio[1]),
    G([[30, 46], [34, 16], [48, 20], [46, 48]], M.vidrio[2]),
    G([[31, 45], [34.5, 18], [46.5, 21.5], [45, 46]], M.vidrio[1]),
    L(20, 40, 26, 20, LUZ, 2, ' opacity=".55"'),
    L(38, 44, 42, 24, LUZ, 1.6, ' opacity=".4"'),
  ],

  hierro: () => [
    ...bloque(M.hierro, { cx: 27, cy: 42, w: 19, h: 11, prof: 8 }),
    L(14, 40, 42, 40, M.hierro[2], 1.4),
    C(36, 30, 2.2, M.hierro[0]),
  ],

  // Dos lingotes apilados y un destello: el acero es el hierro trabajado, y se
  // dibuja como más de lo mismo, más limpio.
  acero: () => [
    ...bloque(M.acero, { cx: 27, cy: 45, w: 18, h: 10, prof: 7 }),
    ...bloque(M.acero, { cx: 29, cy: 31, w: 15, h: 9, prof: 6 }),
    L(18, 28, 38, 28, LUZ, 2, ' opacity=".6"'),
    PL([[45, 14], [47, 20], [53, 22], [47, 24], [45, 30], [43, 24], [37, 22], [43, 20]], LUZ, 1.4, ' opacity=".7"'),
  ],

  clavo: () => {
    const p = [];
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 12, a = -18 + i * 16;
      p.push(gira(a, x, 32, [
        ...varilla(M.hierro, { x1: x, y1: 16, x2: x, y2: 46, w: 3.4 }),
        G([[x - 1.7, 44], [x + 1.7, 44], [x, 51]], M.hierro[1]),
        E(x, 15, 5.5, 2.6, M.hierro[2]), E(x, 14, 5.5, 2.6, M.hierro[0]),
      ]));
    }
    return p;
  },

  alambre: () => {
    const p = [];
    for (let i = 0; i < 4; i++) {
      const rr = 16 - i * 3;
      p.push(E(32, 34, rr, rr * 0.9, 'none', ` stroke="${M.acero[2]}" stroke-width="3.4"`));
      p.push(E(32, 33, rr, rr * 0.9, 'none', ` stroke="${M.acero[1]}" stroke-width="2"`));
    }
    p.push(T('M46 40q8 3 5 12', M.acero[1], 2));
    return p;
  },

  chapa: () => chapa(M.acero, { x: 10, y: 21, w: 42, h: 23, ondas: 5, ang: -7 }),

  // «Herramienta» el recurso es un fierro útil rescatado, no una herramienta
  // fabricada: por eso la llave y el destornillador cruzados, y no un hacha.
  herramienta: () => [
    gira(34, 32, 32, [
      R(30, 12, 6, 40, M.acero[2], 2), R(29, 11, 6, 40, M.acero[1], 2),
      P('M23 11h12l-2 7h-8Z', M.acero[1]), P('M23 52h12l-3 -7h-6Z', M.acero[1]),
      C(32, 15, 3.4, HUECO),
    ]),
    gira(-32, 32, 32, [
      ...varilla(M.hierro, { x1: 32, y1: 46, x2: 32, y2: 16, w: 3.4 }),
      R(28, 44, 8, 12, M.carne[2], 3), R(27.5, 43, 8, 12, M.carne[1], 3),
      G([[30, 16], [34, 16], [33, 11], [31, 11]], M.acero[0]),
    ]),
  ],

  hormigon: (z) => {
    const p = bloque(M.hormigon, { cx: 29, cy: 39, w: 20, h: 15, prof: 8 });
    for (let i = 0; i < 8; i++)
      p.push(C(29 + (z() - 0.5) * 36, 39 + (z() - 0.5) * 12, 1 + z() * 1.4, i % 2 ? M.hormigon[0] : M.hormigon[2]));
    return p;
  },

  tabla: () => [
    gira(-10, 32, 40, [
      R(7, 37, 50, 11, M.madera2[2], 1.5), R(6, 35.5, 50, 11, M.madera2[1], 1.5),
      L(10, 38.5, 52, 38.5, M.madera2[0], 1.2), L(10, 43, 52, 43, M.madera2[2], 1.2),
    ]),
    gira(-4, 32, 24, [
      R(11, 21, 44, 10, M.madera2[2], 1.5), R(10, 19.5, 44, 10, M.madera2[1], 1.5),
      L(14, 22.5, 50, 22.5, M.madera2[0], 1.2), L(14, 26.5, 50, 26.5, M.madera2[2], 1.2),
    ]),
  ],

  // Derecho y clavado en la tierra. Girar un leño 90° dejaba la tapa redonda
  // arriba y el anillo de tierra en el medio del palo: se leía como un hongo.
  poste: () => [
    R(26, 8, 13, 44, M.madera[2], 3), R(25, 6.5, 13, 44, M.madera[1], 3),
    L(28.5, 12, 28.5, 48, M.madera[0], 2), L(35, 14, 35, 46, M.madera[2], 1.4),
    E(31.5, 7, 6.5, 2.8, M.madera2[0]),
    E(32, 53, 16, 5, M.corteza[2]), E(32, 52, 15, 4.2, M.corteza[1]),
  ],

  charqui: () => tiras(M.asado, M.madera, { cx: 32, cy: 16, cuantas: 4, largo: 30, w: 6 }),

  harina: (z) => [
    ...cuenco(M.madera2, { cx: 32, cy: 46, w: 19, h: 13 }),
    ...granos(M.lana, { cx: 32, cy: 38, w: 15, alto: 12, cuantas: 5, r: 1.6, z }),
    C(48, 22, 2.4, M.lana[0], ' opacity=".65"'), C(44, 16, 1.8, M.lana[0], ' opacity=".5"'),
  ],

  pellet: (z) => {
    const p = [E(32, 48, 19, 5, M.corteza[2])];
    for (let i = 0; i < 5; i++) {
      const x = 18 + (i % 3) * 14 + (z() - 0.5) * 3, y = 30 + Math.floor(i / 3) * 13;
      const a = -30 + z() * 60;
      p.push(gira(a, x, y, [
        R(x - 4, y - 7, 8, 15, M.resina[2], 3), R(x - 4.5, y - 8, 8, 15, M.resina[1], 3),
        E(x - 0.5, y - 8, 4, 1.8, M.resina[0]),
      ]));
    }
    return p;
  },
};

/**
 * Los 44 objetos que se tienen en la mano.
 *
 * Acá el oficio manda sobre la materia: los diez que llevan cabo se dibujan
 * todos con el mismo cabo diagonal y la misma atadura, y lo que cambia es la
 * cabeza —el hacha parte, la azuela vacía, el martillo golpea—. Es la misma
 * decisión que tomó `Herramientas3D.js` con los dieciocho modelos de la mano, y
 * por la misma razón: **la silueta de la cabeza es lo que se reconoce**, el cabo
 * es sólo lo que dice «esto se agarra».
 *
 * Los doce que faltan para los 56 de `herramientas.json` llevan `produce` o
 * `esReceta` y nunca se sostienen: no son de acá.
 */
const RECETAS_OBJETOS = {

  // ── Filos sin cabo ────────────────────────────────────────────────────────

  // Un rodado partido: lo que lo hace herramienta es la cara fresca del golpe,
  // un plano recto en una piedra que no tiene ninguno. Antes ese plano le tapaba
  // toda la mitad de arriba y el icono se leía como un sombrero.
  lasca_rodado: (z) => [
    ...canto(M.piedra, { cx: 31, cy: 36, r: 17, lados: 6, z, achata: 0.92 }),
    G([[18, 41], [26, 24], [40, 29], [34, 46]], M.piedra[0]),
    PL([[18, 41], [26, 24], [40, 29]], M.piedra[2], 1.3),
    L(28, 29, 33, 40, LUZ, 1.2, ' opacity=".45"'),
  ],

  // La lasca de obsidiana es el mismo vidrio volcánico que el recurso, pero ya
  // trabajada: las medias lunas del borde son las huellas del lascado, y son lo
  // único que la separa del nódulo crudo.
  lasca: () => [
    ...cristal(M.obsidiana, { cx: 31, cy: 34, w: 11, alto: 22, sesgo: -0.35 }),
    ...[[22, 24], [21, 34], [24, 44]].map(([x, y]) => P(`M${x} ${y}a5 5 0 0 1 4 8Z`, M.obsidiana[0], ' opacity=".8"')),
    L(30, 16, 27, 46, LUZ, 1.2, ' opacity=".4"'),
  ],

  raspador: () => [
    ...varilla(M.madera, { x1: 32, y1: 54, x2: 32, y2: 34, w: 7 }),
    ...atadura(M.cuero2, { cx: 32, cy: 36, w: 13, h: 6 }),
    ...filo(M.obsidiana, { x: 32, y: 25, largo: 15, ancho: 9, pancho: 1.9, ang: 0 }),
  ],

  cuchillo: () => [
    gira(-36, 32, 32, [
      ...varilla(M.madera, { x1: 32, y1: 54, x2: 32, y2: 38, w: 8 }),
      ...atadura(M.cuero2, { cx: 32, cy: 39, w: 13, h: 5.5 }),
      ...filo(M.obsidiana, { x: 32, y: 24, largo: 30, ancho: 6, pancho: 0.8 }),
    ]),
  ],

  // ── Armas de tiro y de mano ───────────────────────────────────────────────

  // Un palo que engorda hacia la punta, de una sola pieza. Armado como un leño
  // más una piedra encima, la cabeza y el cabo quedaban desencajados y se leía
  // como una canilla.
  garrote: (z) => [
    gira(-34, 32, 32, [
      ...bulto([[32, 4], [42, 11], [44, 25], [37, 51], [32, 57], [27, 51], [23, 25], [23, 10]]
        .map(([x, y]) => [x + (z() - 0.5) * 2, y]), M.madera),
      ...atadura(M.cuero2, { cx: 31, cy: 47, w: 15, h: 6 }),
      // Vetas y no nudos redondos: dos círculos oscuros sobre un palo se leen
      // como los agujeros de una flauta.
      T('M35 14q3 12 0 26', M.madera[2], 1.4), T('M28 20q-2 14 1 26', M.madera[2], 1.2),
    ]),
  ],

  honda: () => [
    T('M14 12q4 16 12 26', M.cuero2[2], 4), T('M14 12q4 16 12 26', M.cuero2[1], 2.4),
    T('M50 12q-4 16 -12 26', M.cuero2[2], 4), T('M50 12q-4 16 -12 26', M.cuero2[1], 2.4),
    P('M26 38q6 12 12 0q-6 5 -12 0Z', M.cuero[2]),
    P('M26.5 37q6 10 11 0q-5.5 4 -11 0Z', M.cuero[1]),
    C(32, 43, 6.5, M.piedra[2]), C(31.5, 42, 6, M.piedra[1]), C(29.5, 40, 2.2, M.piedra[0]),
  ],

  lanza_colihue: () => [
    gira(-40, 32, 32, [
      ...varilla(M.junco, { x1: 32, y1: 58, x2: 32, y2: 16, w: 5 }),
      ...atadura(M.cuero2, { cx: 32, cy: 18, w: 11, h: 5 }),
      ...punta(M.obsidiana, { cx: 32, cy: 12, w: 6, alto: 11 }),
    ]),
  ],

  // Estólica: la vara con el gancho y el dardo apoyado. Es la silueta más rara
  // del conjunto y es a propósito — nadie sabe qué es un propulsor hasta que ve
  // el dardo encima.
  // El gancho del extremo es TODO lo que distingue una estólica de un palo, así
  // que va grande y de perfil. Antes era una escama de tres puntos y el icono
  // quedaba en dos palitos cruzados.
  estolica: () => [
    gira(-20, 32, 36, [
      ...varilla(M.madera, { x1: 9, y1: 42, x2: 47, y2: 42, w: 7 }),
      T('M45 42q10 0 10 -10q0 -7 -7 -7', M.asta[2], 6.5),
      T('M45 41q10 0 10 -10q0 -7 -7 -7', M.asta[1], 4),
      ...atadura(M.cuero2, { cx: 18, cy: 42, w: 8, h: 15 }),
    ]),
    ...varilla(M.junco, { x1: 6, y1: 17, x2: 50, y2: 10, w: 3 }),
    G([[54, 9], [45, 7], [46, 14]], M.obsidiana[1]),
  ],

  // Una sola bola forrada con el tiento suelto. El aro para la muñeca que tenía
  // arriba la convertía en una lupa: el tiento ahora cuelga libre, que es como
  // se guarda.
  bola_perdida: () => [
    C(31, 42, 13, M.piedra[2]), C(30, 41, 12, M.piedra[1]), C(26, 36, 4.5, M.piedra[0]),
    T('M18 38q12 -8 24 -1', M.cuero2[1], 2), T('M20 50q11 5 21 -3', M.cuero2[1], 2),
    T('M30 29q-4 -12 3 -21', M.cuero2[2], 4.5), T('M30 29q-4 -12 3 -21', M.cuero2[1], 2.6),
    T('M33 8q7 4 3 10', M.cuero2[1], 2.2),
  ],

  boleadora_dos: () => boleadora(M.piedra, M.cuero2, { cx: 32, cy: 32, cuantas: 2, r: 9, esc: 18 }),

  boleadora_tres: () => boleadora(M.piedra, M.cuero2, { cx: 32, cy: 33, cuantas: 3, r: 8, esc: 17 }),

  arco_colihue_obj: () => [
    ...arco(M.junco, M.fibra, { cx: 34, cy: 32, r: 23, ang: -14 }),
    ...flecha(M.junco, M.obsidiana, M.pluma, { cx: 34, cy: 32, largo: 20, ang: 62 }),
  ],

  // Trampa de lazo: el nudo corredizo abierto, la estaca y el tiento. Se dibuja
  // armada y no guardada, que es la única forma de que se entienda qué hace.
  trampa_lazo: () => [
    E(28, 40, 15, 9, 'none', ` stroke="${M.fibra[2]}" stroke-width="4"`),
    E(28, 39, 15, 9, 'none', ` stroke="${M.fibra[1]}" stroke-width="2.4"`),
    T('M42 34q8 -6 6 -18', M.fibra[2], 3.4), T('M42 34q8 -6 6 -18', M.fibra[1], 2),
    ...varilla(M.madera, { x1: 48, y1: 8, x2: 48, y2: 30, w: 5 }),
    G([[45.5, 28], [50.5, 28], [48, 34]], M.madera[2]),
  ],

  // ── Las diez con cabo ─────────────────────────────────────────────────────
  //
  // Todas comparten el cabo diagonal a -34° y las dos ataduras. Lo que cambia es
  // la cabeza, y es lo que se reconoce a 58 px.

  hacha_piedra: () => [
    gira(-34, 32, 32, [
      ...varilla(M.madera, { x1: 26, y1: 56, x2: 34, y2: 12, w: 6 }),
      ...atadura(M.cuero2, { cx: 33, cy: 22, w: 13, h: 5 }),
      ...atadura(M.cuero2, { cx: 34, cy: 15, w: 13, h: 5 }),
      ...filo(M.piedra, { x: 34, y: 18, largo: 20, ancho: 9, pancho: 1.1, ang: 90 }),
    ]),
  ],

  // Azuela: el filo atravesado, como una azada. Con la cabeza del hacha girada
  // un cuarto de vuelta las dos se confundían; acá la cabeza es ancha y plana y
  // sale hacia adelante, que es lo que la hace una azuela y no un hacha.
  azuela: () => [
    gira(-28, 32, 32, [
      ...varilla(M.madera, { x1: 28, y1: 56, x2: 34, y2: 20, w: 6 }),
      ...atadura(M.cuero2, { cx: 33, cy: 27, w: 13, h: 5 }),
      ...filo(M.piedra, { x: 34, y: 18, largo: 22, ancho: 6, pancho: 2.4, ang: 152 }),
    ]),
  ],

  // La paleta ancha es la silueta: chica, quedaba un palito con una bolita
  // arriba, o sea un fósforo. Un omóplato atado a un palo es casi todo omóplato.
  pala_omoplato: (z) => [
    gira(-28, 32, 32, [
      ...varilla(M.madera, { x1: 29, y1: 60, x2: 34, y2: 28, w: 5.5 }),
      ...atadura(M.cuero2, { cx: 33, cy: 31, w: 15, h: 5.5 }),
      ...bulto([[34, 2], [48, 9], [50, 22], [40, 31], [26, 30], [19, 20], [20, 8]]
        .map(([x, y]) => [x + (z() - 0.5) * 2, y + (z() - 0.5) * 2]), M.hueso),
    ]),
  ],

  maza_cuna: () => [
    gira(-30, 32, 32, [
      ...varilla(M.madera, { x1: 28, y1: 56, x2: 33, y2: 22, w: 7 }),
      ...leno(M.piedra, { x: 18, y: 18, largo: 30, grueso: 15, ang: 0, vetas: 1, anillos: 1 }),
      G([[24, 40], [30, 38], [27, 52]], M.madera2[2]),
      G([[24.5, 39], [29, 37.5], [26.5, 50]], M.madera2[1]),
    ]),
  ],

  pico_asta: () => [
    ...asta(M.asta, { cx: 24, cy: 54, esc: 1.3, ang: -18 }),
    ...atadura(M.cuero2, { cx: 25, cy: 47, w: 13, h: 8, ang: -18 }),
  ],

  hacha_hierro: () => [
    gira(-34, 32, 32, [
      ...varilla(M.madera2, { x1: 26, y1: 58, x2: 35, y2: 10, w: 5.5 }),
      ...filo(M.hierro, { x: 35, y: 20, largo: 24, ancho: 11, pancho: 1.4, ang: 90, talon: 6 }),
      ...atadura(M.hierro, { cx: 34, cy: 14, w: 12, h: 6 }),
    ]),
  ],

  // Sierra: los dientes son la silueta. Sin ellos era la barreta.
  sierra: () => [
    gira(-24, 32, 32, [
      R(11, 26, 12, 13, M.madera[2], 3), R(10, 24.5, 12, 13, M.madera[1], 3),
      R(21, 27, 34, 9, M.acero[2], 1), R(20.5, 26, 34, 9, M.acero[1], 1),
      L(24, 28.5, 52, 28.5, M.acero[0], 1.4),
      ...Array.from({ length: 8 }, (_, i) => G([[23 + i * 4, 35], [27 + i * 4, 35], [25 + i * 4, 41]], M.acero[1])),
    ]),
  ],

  martillo: () => [
    gira(-30, 32, 32, [
      ...varilla(M.madera, { x1: 30, y1: 56, x2: 33, y2: 22, w: 5.5 }),
      R(19, 15, 28, 13, M.hierro[2], 3), R(18, 13.5, 28, 13, M.hierro[1], 3),
      L(21, 16.5, 43, 16.5, M.hierro[0], 1.6),
      G([[46, 14], [54, 18], [46, 24]], M.hierro[1]),
    ]),
  ],

  // Pico: la cruz de arriba es tres veces más ancha que la cabeza del martillo,
  // que es lo que los separa de lejos. Punta de un lado, pala del otro.
  pico_hierro: () => [
    gira(-16, 32, 32, [
      ...varilla(M.madera2, { x1: 32, y1: 58, x2: 32, y2: 20, w: 5.5 }),
      T('M8 26q24 -14 48 0', M.hierro[2], 7), T('M8 25q24 -14 48 0', M.hierro[1], 4.5),
      G([[6, 26], [14, 21], [13, 28]], M.hierro[1]),
      G([[58, 26], [50, 20], [52, 29]], M.hierro[1]),
      R(27, 16, 10, 12, M.hierro[2], 2), R(26.5, 15, 10, 12, M.hierro[0], 2),
    ]),
  ],

  pala_hierro: () => [
    gira(-14, 32, 32, [
      ...varilla(M.madera2, { x1: 32, y1: 12, x2: 32, y2: 38, w: 5.5 }),
      R(23, 8, 18, 6, M.madera2[2], 3), R(22.5, 7, 18, 6, M.madera2[1], 3),
      P('M22 38h20l-3 12q-7 6 -14 0Z', M.hierro[2], ' transform="translate(1 1.5)"'),
      P('M22 38h20l-3 12q-7 6 -14 0Z', M.hierro[1]),
      P('M24 39h8l-2 11q-4 1 -6 -2Z', M.hierro[0]),
    ]),
  ],

  barreta: () => [
    gira(-40, 32, 32, [
      ...varilla(M.hierro, { x1: 30, y1: 58, x2: 34, y2: 8, w: 6 }),
      G([[31, 12], [37, 12], [34, 4]], M.hierro[1]),
      P('M27 56q-6 2 -6 -5q4 3 6 0Z', M.hierro[1]),
      L(31, 20, 33, 48, M.hierro[0], 1.4),
    ]),
  ],

  // ── El fuego ──────────────────────────────────────────────────────────────

  // Eslabón y pedernal: la C de acero, el canto y las chispas. Las chispas no
  // son adorno: son lo que dice que esto enciende y no golpea.
  eslabon: (z) => [
    ...canto(M.piedra, { cx: 22, cy: 44, r: 12, lados: 6, z, achata: 0.85 }),
    T('M46 22q-12 -2 -12 10q0 12 12 10', M.acero[2], 7),
    T('M46 21q-12 -2 -12 10q0 12 12 10', M.acero[1], 4.5),
    ...[[30, 26, 5], [24, 20, 4], [36, 16, 3.5]].map(([x, y, r]) =>
      PL([[x, y - r], [x + r * 0.35, y - r * 0.35], [x + r, y], [x + r * 0.35, y + r * 0.35],
        [x, y + r], [x - r * 0.35, y + r * 0.35], [x - r, y], [x - r * 0.35, y - r * 0.35], [x, y - r]],
      M.fuego[0], 1.4)),
  ],

  // El arco horizontal arriba, el husillo derecho abajo y la tablita en el piso:
  // ésa es la máquina y ése es el orden en que se entiende. Reusando la pieza
  // del arco girada 82° quedaba un andamio sin pies ni cabeza.
  taladro_arco: () => [
    T('M9 18q23 -13 46 0', M.madera[2], 5.5), T('M9 17q23 -13 46 0', M.madera[1], 3.4),
    L(9, 18, 55, 18, M.fibra[1], 1.6),
    ...varilla(M.madera2, { x1: 32, y1: 12, x2: 32, y2: 43, w: 5.5 }),
    R(17, 45, 30, 8, M.madera[2], 2), R(16, 43.5, 30, 8, M.madera[1], 2),
    T('M41 38q7 -6 3 -13', M.humo[1], 2.2, ' opacity=".7"'),
    ...llama({ cx: 32, cy: 47, alto: 7 }),
  ],

  antorcha: () => [
    gira(16, 32, 40, [
      ...varilla(M.madera, { x1: 30, y1: 60, x2: 30, y2: 30, w: 6 }),
      R(23, 24, 15, 14, M.corteza[2], 3), R(22, 23, 15, 14, M.corteza[1], 3),
      L(25, 26, 35, 26, M.fibra[1], 1.6), L(25, 32, 35, 32, M.fibra[1], 1.6),
    ]),
    ...llama({ cx: 34, cy: 16, alto: 15 }),
  ],

  candil_grasa: () => [
    ...cuenco(M.ceramica, { cx: 30, cy: 46, w: 17, h: 11, liquido: M.grasa }),
    P('M45 40q8 -1 9 -6q-6 1 -10 2Z', M.ceramica[1]),
    ...llama({ cx: 52, cy: 28, alto: 9 }),
  ],

  // ── La pesca ──────────────────────────────────────────────────────────────

  linea_mano: () => [
    ...rollo(M.fibra, { cx: 26, cy: 38, r: 13, vueltas: 2, cola: false }),
    T('M38 32q10 -6 10 -16', M.fibra[1], 1.8),
    ...anzuelo(M.acero, { cx: 48, cy: 22, esc: 0.75 }),
  ],

  cana_colihue: () => [
    ...varilla(M.junco, { x1: 8, y1: 56, x2: 50, y2: 8, w: 5 }),
    ...atadura(M.cuero2, { cx: 20, cy: 42, w: 10, h: 5, ang: -48 }),
    T('M50 8q6 14 0 26', M.fibra[1], 1.6),
    ...anzuelo(M.acero, { cx: 48, cy: 42, esc: 0.7 }),
  ],

  arpon_hueso: () => [
    gira(-40, 32, 32, [
      ...varilla(M.junco, { x1: 32, y1: 58, x2: 32, y2: 22, w: 5 }),
      ...atadura(M.cuero2, { cx: 32, cy: 24, w: 11, h: 5 }),
      G([[32, 2], [37, 20], [34, 20], [36, 26], [28, 26], [30, 20], [27, 20]], M.hueso[2], ' transform="translate(1 1)"'),
      G([[32, 2], [37, 20], [34, 20], [36, 26], [28, 26], [30, 20], [27, 20]], M.hueso[1]),
      G([[32, 2], [27, 20], [31, 18]], M.hueso[0]),
    ]),
  ],

  // Nasa: el embudo tejido, tumbado. Es la única pieza de cestería que se mira
  // de costado, y eso la separa del canasto.
  nasa_junco: () => [
    gira(-90, 32, 34, cesto(M.junco, { cx: 32, cy: 34, w: 7, h: 26, boca: 2.4 })),
    E(11, 34, 5, 13, M.junco[2]), E(11, 34, 3.4, 9, HUECO),
  ],

  red_fibra: () => [
    ...malla(M.fibra, { x: 11, y: 20, w: 42, h: 30, paso: 8 }),
    C(17, 16, 4.5, M.madera2[2]), C(16.5, 15, 4, M.madera2[1]),
    C(32, 14, 4.5, M.madera2[2]), C(31.5, 13, 4, M.madera2[1]),
    C(47, 16, 4.5, M.madera2[2]), C(46.5, 15, 4, M.madera2[1]),
  ],

  equipo_mosca: () => [
    ...varilla(M.carbon, { x1: 10, y1: 54, x2: 52, y2: 10, w: 3.6 }),
    ...rollo(M.acero, { cx: 20, cy: 44, r: 9, vueltas: 2, cola: false }),
    T('M52 10q6 12 -2 20', M.acero[0], 1.4),
    ...pluma(M.fuego, { cx: 48, cy: 34, largo: 8, ancho: 3.5, ang: -40 }),
    ...anzuelo(M.acero, { cx: 50, cy: 38, esc: 0.6 }),
  ],

  // ── El abrigo ─────────────────────────────────────────────────────────────

  quillango: () => [
    ...manto(M.cuero2, { cx: 32, cy: 32, w: 21, h: 22, pliegues: 2 }),
    ...[16, 26, 36, 46].map((y) => L(12, y, 52, y - 1, M.cuero2[2], 1, ' stroke-dasharray="3 3"')),
    L(32, 11, 31, 53, M.cuero2[2], 1, ' stroke-dasharray="3 3"'),
  ],

  // Un par y no uno: un tamango solo se lee como una bolsa.
  tamangos: () => [
    ...[[20, 3], [40, -4]].flatMap(([x, s]) => [
      P(`M${x - 7} ${28 + s}h13l2 14l8 3v6h-24q-2 -6 1 -10Z`, M.cuero[2], ' transform="translate(1 1.5)"'),
      P(`M${x - 7} ${28 + s}h13l2 14l8 3v6h-24q-2 -6 1 -10Z`, M.cuero[1]),
      P(`M${x - 6} ${29 + s}h6l1 12h-8Z`, M.cuero[0]),
      L(x - 6, 44 + s, x + 12, 47 + s, M.cuero2[1], 1.6),
    ]),
  ],

  poncho_witral: () => [
    ...manto(M.tela, { cx: 32, cy: 31, w: 20, h: 21, pliegues: 2, franja: M.carne }),
    E(32, 12, 6, 3, M.tela[2]),
    ...Array.from({ length: 6 }, (_, i) => L(15 + i * 7, 51, 15 + i * 7, 57, M.tela[2], 1.6)),
  ],

  // ── Los contenedores ──────────────────────────────────────────────────────

  canasto_junco_obj: () => [
    ...cesto(M.junco, { cx: 32, cy: 40, w: 17, h: 24, boca: 1.35 }),
    T('M17 28q15 -18 30 0', M.junco[2], 3.4),
    T('M17 27q15 -18 30 0', M.junco[1], 2),
  ],

  mochila_cuero: () => [
    ...saco(M.cuero, { cx: 32, cy: 38, w: 16, h: 15, tAta: M.cuero2 }),
    P('M16 22q16 -8 32 0l-2 12q-14 -6 -28 0Z', M.cuero2[2]),
    P('M16.5 21q15.5 -8 31 0l-2 11q-13.5 -6 -27 0Z', M.cuero2[1]),
    R(29, 26, 6, 5, M.hierro[1], 1.5),
    T('M18 26q-6 12 2 24', M.cuero2[1], 2.4), T('M46 26q6 12 -2 24', M.cuero2[1], 2.4),
  ],

  odre_cuero: () => [
    ...saco(M.cuero2, { cx: 32, cy: 40, w: 15, h: 14, tAta: M.fibra }),
    R(28, 12, 8, 8, M.madera[2], 2), R(27.5, 11, 8, 8, M.madera[1], 2),
    ...gota(M.agua, { cx: 48, cy: 24, r: 5 }),
  ],

  // Rastra: dos varas largas en V y los travesaños. No es un cesto ni una
  // mochila: es lo que se arrastra, y por eso las puntas salen del cuadro abajo.
  rastra: () => [
    ...varilla(M.madera, { x1: 24, y1: 6, x2: 12, y2: 58, w: 5.5 }),
    ...varilla(M.madera, { x1: 34, y1: 6, x2: 52, y2: 58, w: 5.5 }),
    ...[26, 38, 50].map((y, i) => L(22 - i * 4.5, y, 40 + i * 5, y, M.madera2[2], 4)),
    ...[26, 38, 50].map((y, i) => L(22 - i * 4.5, y - 1, 40 + i * 5, y - 1, M.madera2[1], 2.4)),
    ...atadura(M.cuero2, { cx: 29, cy: 10, w: 16, h: 6 }),
  ],

  // ── Apicultura y el insumo suelto ─────────────────────────────────────────

  ahumador: () => [
    R(15, 24, 22, 30, M.hierro[2], 3), R(14, 22.5, 22, 30, M.hierro[1], 3),
    L(18, 27, 18, 50, M.hierro[0], 2),
    P('M28 24q8 -4 14 -12l6 5q-6 8 -12 12Z', M.hierro[1]),
    P('M36 40q12 -3 14 6q2 9 -12 8Z', M.cuero[2]),
    P('M36.5 41q11 -2 12.5 5.5q1.5 7.5 -11 7Z', M.cuero[1]),
    T('M46 12q-5 -6 0 -10', M.humo[0], 2.4, ' opacity=".8"'),
    ...llama({ cx: 24, cy: 52, alto: 6 }),
  ],

  careta_velo: () => [
    ...malla(M.humo, { x: 18, y: 26, w: 28, h: 26, paso: 6, marco: false }),
    P('M18 28q0 -14 14 -14t14 14Z', M.humo[2], ' opacity=".5"'),
    E(32, 20, 22, 6, M.paja[2]), E(32, 19, 22, 6, M.paja[1]),
    P('M20 19q0 -12 12 -12t12 12Z', M.paja[2]),
    P('M21 19q1 -11 11 -11t11 11Z', M.paja[0]),
    E(32, 52, 15, 4, M.humo[2]),
  ],

  // Encerar cuero no es una cosa que se tenga: es un insumo sin peso ni
  // durabilidad, el agujero de dato que la fase 2 dejó anotado. Se dibuja como
  // lo que es —el paño y el pan de cera— y no se le inventa nada más.
  encerado: () => [
    ...manto(M.cuero2, { cx: 30, cy: 34, w: 19, h: 19, pliegues: 2 }),
    ...bloque(M.cera, { cx: 36, cy: 44, w: 12, h: 8, prof: 5 }),
    L(20, 22, 34, 19, LUZ, 2.4, ' opacity=".35"'),
  ],
};

/** Los 115, en el mismo orden que los datos. */
const RECETAS = { ...RECETAS_RECURSOS, ...RECETAS_OBJETOS };

// ── Las puertas del módulo ──────────────────────────────────────────────────

const envolver = (cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CAJA} ${CAJA}"`
  + ` stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;

/**
 * El de reserva, y la razón por la que existe.
 *
 * Un id sin receta —un recurso nuevo que alguien agregue a `RECURSOS` y se
 * olvide de dibujar— **no puede caer en un casillero vacío**: desaparecería del
 * bolso sin que nadie se entere, que es exactamente lo que ya pasó una vez con
 * los dos remedios que el bolso viejo no listaba. Así que cae acá: un recuadro
 * punteado con un signo de pregunta, en el violeta de la botica, que no se
 * parece a ninguno de los 115 y se ve como lo que es — un agujero.
 */
const RESERVA = envolver([
  R(9, 9, 46, 46, 'none', 7, ` stroke="${M.violeta[2]}" stroke-width="3" stroke-dasharray="7 5"`),
  T('M24 26q0-9 8-9t8 9q0 6-6 8t-2 6', M.violeta[0], 5.5),
  C(32, 47, 3.4, M.violeta[0]),
].join(''));

/** El id de todos los que tienen dibujo propio, en orden. */
export const IDS = Object.keys(RECETAS);

/** La clase que le da el fondo a cualquier caja, y la del agujero. */
export const CLASE_BASE = 'ic';
export const CLASE_RESERVA = 'ic-x';

const _arte = new Map();

/**
 * El dibujo de un id. Un id que no existe devuelve el de reserva, nunca nada:
 * el agujero se ve o no existe.
 */
export function arteDe(id) {
  if (_arte.has(id)) return _arte.get(id);
  const receta = RECETAS[id];
  const svg = receta ? envolver(receta(azar(id)).join('')) : RESERVA;
  _arte.set(id, svg);
  return svg;
}

/** Las clases que van en el elemento del dibujo. */
export function claseDe(id) {
  return RECETAS[id] ? `${CLASE_BASE} ic-${id}` : `${CLASE_BASE} ${CLASE_RESERVA}`;
}

/**
 * El dibujo, empaquetado para que entre en una `url()` de CSS.
 *
 * Se codifica a mano y no con `encodeURIComponent`, que escaparía también los
 * espacios, las comas y los paréntesis y engordaría la hoja como un 25 % sin que
 * haga falta. Lo único que hay que tocar son los cuatro caracteres que romperían
 * el CSS: el porcentaje —primero, o las escapadas siguientes se escaparían dos
 * veces—, el numeral de los colores, y los dos ángulos. Las comillas dobles del
 * marcado pasan a simples, así la `url("…")` puede seguir usando las dobles.
 */
const aUri = (svg) => 'data:image/svg+xml,' + svg
  .replace(/%/g, '%25')
  .replace(/"/g, "'")
  .replace(/#/g, '%23')
  .replace(/</g, '%3C')
  .replace(/>/g, '%3E');

/**
 * El armazón de la hoja. `background-size: contain` y no un tamaño fijo: quien
 * usa la clase decide de qué tamaño es la caja —79 px en la grilla, 34 en el
 * renglón de detalle— y el dibujo se acomoda solo.
 *
 * `pointer-events: none` está por un defecto concreto: el dibujo tapa el
 * casillero entero, y sin esto cada movimiento del puntero dentro de una casilla
 * dispararía `mouseover` de nuevo contra otro elemento.
 */
const ARMAZON = `.${CLASE_BASE}{background-repeat:no-repeat;background-position:50% 46%;`
  + `background-size:contain;pointer-events:none}`;

let _hoja = null;

/**
 * La hoja entera: una clase por icono, con el dibujo adentro como imagen de
 * fondo. Se arma una sola vez y queda cacheada — armarla cuesta unos pocos
 * milisegundos y **no se puede pagar en cada pintada**, que es la razón entera
 * por la que los dibujos no van en línea.
 */
export function hoja() {
  if (_hoja !== null) return _hoja;
  const filas = [ARMAZON];
  for (const id of IDS) filas.push(`.ic-${id}{background-image:url("${aUri(arteDe(id))}")}`);
  filas.push(`.${CLASE_RESERVA}{background-image:url("${aUri(RESERVA)}")}`);
  _hoja = filas.join('');
  return _hoja;
}

const ID_HOJA = 'iconosBolso';

/**
 * Mete la hoja en el documento, una sola vez. Devuelve `true` si la puso, para
 * que quien la llame pueda medir cuánto tardó la primera.
 */
export function inyectar(doc) {
  const d = doc || (typeof document === 'undefined' ? null : document);
  if (!d || d.getElementById(ID_HOJA)) return false;
  const est = d.createElement('style');
  est.id = ID_HOJA;
  est.textContent = hoja();
  d.head.appendChild(est);
  return true;
}

/** La paleta, para la hoja de contacto y para quien quiera teñir en el mismo idioma. */
export { M as MATERIAS };
