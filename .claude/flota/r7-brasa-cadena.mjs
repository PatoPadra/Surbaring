/**
 * r7-brasa-cadena.mjs — la cadena de la imagen, modelada, para la luz del fuego.
 *
 * `brasa` no puede medir la imagen: la mide el jefe en el navegador. Esto es lo
 * que sí se puede hacer sin navegador — reproducir en números lo que le pasa a un
 * píxel desde que el sombreador escribe su radiancia hasta que el banco lee su
 * luminancia en 8 bits — y **calibrarlo contra la línea de base**, no contra la
 * cuenta del suelo liso, que ya se equivocó una vez (RONDA7.md §6).
 *
 * La cadena, eslabón por eslabón, copiada del código de verdad:
 *   1. el bloque de `Luces.js`: color · intensidad · (1 − d²/r²)² · nl · albedo/π
 *   2. el resplandor (no se modela en los anillos: ver `luzDeLlama`)
 *   3. `OutputPass`: ACES filmic de three 0.169
 *      (`tonemapping_pars_fragment.glsl.js`) con `toneMappingExposure`, y sRGB
 *   4. FXAA: no cambia una zona pareja
 *   5. `PasoColor` (`Posproceso.js`): techo, curva en S, sombras/luces,
 *      saturación y viñeteado. La nitidez no mueve un promedio de 16 muestras.
 *   6. el banco: luminancia 0,2126 R + 0,7152 G + 0,0722 B sobre 0..255.
 *
 * Calibración: para cada distancia, el factor geométrico real del suelo —pasto,
 * coseno, albedo, oclusión, todo junto— es una incógnita. Se despeja de la base:
 * la radiancia que, sumada al fondo de la noche, da exactamente lo medido. Después
 * se cambia sólo lo que cambia el agente (intensidad, radio, color) y se vuelve a
 * pasar por la cadena. El fondo de la noche no está medido en radiancia —sale 0 de
 * 255—, así que se prueba en tres lugares del pie de ACES, y el mediodía de la base
 * (+5,86 a 2 m) sirve para ver cuál de los tres es compatible.
 *
 * Uso: node .claude/flota/r7-brasa-cadena.mjs
 *      Para recalibrar con los números que midió el jefe, cambiar BASE abajo.
 */

// ── La cadena ────────────────────────────────────────────────────────────────

const sat = (x) => Math.max(0, Math.min(1, x));

/** sRGB hex → lineal, lo mismo que `THREE.Color.setHex`. */
export function lineal(hex) {
  return [16, 8, 0].map((k) => {
    const c = ((hex >> k) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

const rrt = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);

/** `ACESFilmicToneMapping` de three 0.169, con las matrices leídas por filas. */
export function aces([r, g, b], expo) {
  const k = expo / 0.6;
  r *= k; g *= k; b *= k;
  const R = rrt(0.59719 * r + 0.35458 * g + 0.04823 * b);
  const G = rrt(0.07600 * r + 0.90834 * g + 0.01566 * b);
  const B = rrt(0.02840 * r + 0.13383 * g + 0.83777 * b);
  return [
    sat(1.60475 * R - 0.53108 * G - 0.07367 * B),
    sat(-0.10208 * R + 1.10813 * G - 0.00605 * B),
    sat(-0.00327 * R - 0.07276 * G + 1.07602 * B),
  ];
}

const oetf = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);
const luma709 = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** `PasoColor` sin la nitidez, con los uniformes de `Posproceso.js`. */
export function pasoColor(c, uv = [0.5, 0.5]) {
  c = c.map((v) => v / (1 + Math.max(0, v - 0.94) * 0.85));
  c = c.map((v) => v * 0.7 + v * v * (3 - 2 * v) * 0.3);
  const m = smooth(0.15, 0.75, luma709(c));
  const sombras = [0.93, 0.97, 1.06], luces = [1.05, 1.01, 0.94];
  c = c.map((v, i) => v * (sombras[i] + (luces[i] - sombras[i]) * m));
  const l = luma709(c);
  c = c.map((v) => l + (v - l) * 1.12);
  const dx = uv[0] - 0.5, dy = uv[1] - 0.5;
  const vin = 1 - (dx * dx + dy * dy) * 0.34;
  return c.map((v) => Math.max(0, v * vin));
}

/** Radiancia lineal de escena → RGB de 0 a 255 como lo lee el banco. */
export function salida(rgb, expo, uv) {
  return pasoColor(aces(rgb, expo).map(oetf), uv).map((v) => Math.min(1, v) * 255);
}
export const lum = (rgb, expo, uv) => luma709(salida(rgb, expo, uv));

/** Bisección sobre una función creciente. */
function despejar(fn, objetivo, lo = 0, hi = 50) {
  if (fn(hi) < objetivo) return Infinity;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (fn(m) < objetivo) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const suma = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const por = (a, b) => a.map((v, i) => v * b[i]);

// ── Los datos ────────────────────────────────────────────────────────────────

/** Exposición de `Tiempo._exposicion`: de noche 1,4545 · 0,78; al mediodía del 15/2 (sol a 51,6°) 0,964. */
// El factor (1 − 0,1·nubes) no está medido. Se probaron los dos extremos y las
// predicciones salieron idénticas: la calibración contra la base lo absorbe entero.
const NUBES = [0];
const expoNoche = (n) => (2.24 / 1.54) * 0.78 * (1 - 0.1 * n);
const expoDia = (n) => (2.24 / (1.54 + Math.sin(51.6 * Math.PI / 180))) * 1.0 * (1 - 0.1 * n);

/** La base, medida por el jefe con `banco-r7-fase2.navegador.js` (RONDA7.md §6 y el encargo). */
export const BASE = {
  fogata: {
    color: 0xff7a2e, intensidad: 2.6, radio: 14, altura: 0.6,
    // 1, 5, 8 y 12 m de la tabla de RONDA7 §6; 2 y 3 m de la corrida del encargo (+5,46 · +5,23)
    delta: { 1: 4.12, 2: 5.46, 3: 5.23, 5: 4.61, 8: 1.95, 12: 0.09 },
    // la tabla de RONDA7 §6 a 2 y 3 m, para ver cuánto mueve la diferencia entre corridas
    otraCorrida: { 2: 5.27, 3: 5.00 },
    mediodia2m: 5.86, sueloMediodia: 44,
  },
  antorcha: {
    color: 0xff8a3a, intensidad: 1.82, radio: 12, altura: 1.33,
    delta: { 1: 2.29, 2: 3.38, 3: 3.38, 5: 2.97, 8: 0.79 },
    otraCorrida: { 2: 4.5 },
  },
};

/** Luz de la luna sobre el suelo: el cielo del hemisferio (`Cielo.js:166`, 0x9fc0e8). */
const TINTE_NOCHE = lineal(0x9fc0e8);
/** Sol de mediodía sobre tierra y pasto: tibio. */
const TINTE_DIA = [1.0, 0.93, 0.80];
/** Albedo relativo del suelo: neutro, o pasto (verde amarillento). La magnitud la absorbe la calibración. */
const ALBEDOS = { neutro: [1, 1, 1], pasto: [0.62, 0.78, 0.30] };

const caida = (d, alto, r) => { const q = (d * d + alto * alto) / (r * r); return q < 1 ? (1 - q) ** 2 : 0; };

// ── Calibración y predicción ─────────────────────────────────────────────────

/**
 * El fondo de la noche: la radiancia de luna más alta que todavía da < 0,5 de 255,
 * y fracciones de ella. β = 0 es «el fuego tiene que atravesar entero el pie de
 * ACES»; β = 0,95, «el suelo ya está al borde y cualquier luz se ve».
 */
function fondoNoche(beta, albedo, expo) {
  const tinte = por(TINTE_NOCHE, albedo);
  const max = despejar((b) => lum(tinte.map((v) => v * b), expo), 0.49, 0, 1);
  return tinte.map((v) => v * max * beta);
}

/** Radiancia del fuego sobre el suelo a cada distancia, despejada de la base. */
function calibrar(fuente, fondo, albedo, expo, deltas = fuente.delta) {
  const c = por(lineal(fuente.color), albedo);
  const l0 = lum(fondo, expo);
  const s = {};
  for (const [d, delta] of Object.entries(deltas)) {
    s[d] = despejar((k) => lum(suma(fondo, c, k), expo) - l0, delta, 0, 50);
  }
  return s;
}

/** Con la calibración `s`, lo que daría la fuente con otros números. */
function predecir(fuente, s, nueva, fondo, albedo, expo) {
  const c = por(lineal(nueva.color ?? fuente.color), albedo);
  const cBase = lineal(fuente.color)[0];
  const l0 = lum(fondo, expo);
  const out = {};
  for (const d of Object.keys(s)) {
    const g = s[d] / (fuente.intensidad * caida(+d, fuente.altura, fuente.radio));
    const k = g * nueva.intensidad * caida(+d, nueva.altura ?? fuente.altura, nueva.radio ?? fuente.radio) / cBase * lineal(nueva.color ?? fuente.color)[0];
    out[d] = +(lum(suma(fondo, c, k), expo) - l0).toFixed(2);
  }
  return out;
}

/** El mediodía: un fondo de sol que da `suelo` de 255, más la radiancia de fuego `k·color`. */
function deltaMediodia(fuente, k, suelo, albedo, expo, intensidadRel = 1, color = fuente.color) {
  const tinte = por(TINTE_DIA, albedo);
  const b = despejar((x) => lum(tinte.map((v) => v * x), expo), suelo, 0, 5);
  const fondo = tinte.map((v) => v * b);
  const c = por(lineal(color), albedo);
  return lum(suma(fondo, c, k * intensidadRel), expo) - lum(fondo, expo);
}

// ── La llama vista de frente ─────────────────────────────────────────────────

/**
 * Lo que da en la imagen una superficie emisiva con albedo negro: radiancia =
 * emisivo · intensidad, y nada más. Y su luminancia para el filtro del
 * resplandor (pesos 0,299 · 0,587 · 0,114): por encima de 0,86 florece.
 */
function luzDeLlama(hex, intensidad, expo, uv) {
  const e = lineal(hex).map((v) => v * intensidad);
  return { rgb: salida(e, expo, uv).map((v) => +v.toFixed(0)), lum: +lum(e, expo, uv).toFixed(1), resplandor: +(0.299 * e[0] + 0.587 * e[1] + 0.114 * e[2]).toFixed(3) };
}

// ── Corrida ──────────────────────────────────────────────────────────────────

function tabla(titulo, filas) {
  console.log(`\n${titulo}`);
  for (const f of filas) console.log('  ' + f);
}
const fmt = (o) => Object.entries(o).map(([d, v]) => `${d} m ${Number.isFinite(v) ? (typeof v === 'number' ? v.toFixed(v < 10 ? 2 : 1) : v) : '∞'}`).join(' · ');

export function correr({ propuesta, antorchaPropuesta, silencio = false } = {}) {
  const log = silencio ? () => {} : tabla;
  const resultados = [];
  for (const n of NUBES) {
    for (const [nomAlb, albedo] of Object.entries(ALBEDOS)) {
      // β = 0,35 es el que mejor cuadra con el mediodía de la base (+5,86)
      for (const beta of [0, 0.35, 0.95]) {
        const en = expoNoche(n), ed = expoDia(n);
        const fondo = fondoNoche(beta, albedo, en);
        const s = calibrar(BASE.fogata, fondo, albedo, en);
        const mediodiaBase = deltaMediodia(BASE.fogata, s[2], BASE.fogata.sueloMediodia, albedo, ed);
        const fila = { nubes: n, albedo: nomAlb, beta, mediodiaBase: +mediodiaBase.toFixed(2), s };
        if (propuesta) {
          fila.fogata = predecir(BASE.fogata, s, propuesta, fondo, albedo, en);
          const g2 = s[2] / (BASE.fogata.intensidad * caida(2, 0.6, 14));
          const k2 = g2 * propuesta.intensidadDia * caida(2, 0.6, propuesta.radio ?? 14);
          fila.mediodia = +deltaMediodia(BASE.fogata, k2, BASE.fogata.sueloMediodia, albedo, ed, 1, propuesta.color ?? BASE.fogata.color).toFixed(2);
        }
        if (antorchaPropuesta) {
          const sa = calibrar(BASE.antorcha, fondo, albedo, en);
          fila.antorcha = predecir(BASE.antorcha, sa, antorchaPropuesta, fondo, albedo, en);
          const sa2 = calibrar(BASE.antorcha, fondo, albedo, en, BASE.antorcha.otraCorrida);
          fila.antorchaOtra = predecir(BASE.antorcha, sa2, antorchaPropuesta, fondo, albedo, en);
        }
        resultados.push(fila);
      }
    }
  }
  if (!silencio) {
    log('VALIDACIÓN — el mediodía de la base (+5,86 medido a 2 m) que predice cada supuesto de fondo nocturno',
      resultados.map((r) => `nubes ${r.nubes} · albedo ${r.albedo.padEnd(6)} · β ${String(r.beta).padEnd(4)} → mediodía base ${r.mediodiaBase.toFixed(2)}   · radiancia del fuego a 2 m ${r.s[2].toExponential(2)}`));
    if (propuesta) {
      log(`PREDICCIÓN FOGATA — ${JSON.stringify(propuesta)}`,
        resultados.map((r) => `nubes ${r.nubes} · ${r.albedo.padEnd(6)} · β ${String(r.beta).padEnd(4)} → ${fmt(r.fogata)}   · mediodía ${r.mediodia}`));
    }
    if (antorchaPropuesta) {
      log(`PREDICCIÓN ANTORCHA — ${JSON.stringify(antorchaPropuesta)}  (calibrada con la tabla · con la corrida del encargo, +4,5 a 2 m)`,
        resultados.map((r) => `nubes ${r.nubes} · ${r.albedo.padEnd(6)} · β ${String(r.beta).padEnd(4)} → ${fmt(r.antorcha)}   · otra: ${fmt(r.antorchaOtra)}`));
    }
  }
  return resultados;
}

export { luzDeLlama, expoNoche, expoDia, caida };

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('r7-brasa-cadena.mjs')) {
  const arg = (nombre, def) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? JSON.parse(process.argv[i + 1]) : def; };
  const propuesta = arg('fogata', null);
  const antorcha = arg('antorcha', null);
  correr({ propuesta, antorchaPropuesta: antorcha });
  if (process.argv.includes('--llama')) {
    const colores = arg('colores', [0xff7a2e, 0xff9a3c, 0xffb347, 0xffc25e]);
    for (const hex of colores) {
      tabla(`LLAMA 0x${hex.toString(16)} de noche (expo ${expoNoche(0).toFixed(3)}), centro de pantalla`,
        [0.6, 0.9, 1.2, 1.6, 2.2, 3.0, 4.5].map((i) => `intensidad ${i} → ${JSON.stringify(luzDeLlama(hex, i, expoNoche(0)))}`));
    }
  }
}
