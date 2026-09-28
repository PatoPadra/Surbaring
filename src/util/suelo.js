/**
 * suelo.js — cargador en tiempo de ejecución de las capas de suelo que hornea
 * `tools/hornear-suelo.mjs` en `public/tex/suelo/`.
 *
 * ── Cómo llegan al terreno y a la piedra, sin recompilar ──────────────────
 * Los uniformes viven ACÁ, en `uniformesSuelo`, y el terreno y la piedra del
 * sotobosque los enganchan a su shader al compilar. Arrancan con dos texturas de
 * capas de 1×1 —del mismo tipo que las de verdad, `sampler2DArray`— y
 * `uSueloListo` en 0, así que el programa se compila en la carga con todo lo que
 * va a usar. Cuando la carga termina, se cambia el VALOR de los uniformes: three
 * sube las texturas en el próximo cuadro y no toca el programa. Cambiar un
 * sampler de tipo, o agregar un `#define` al llegar, sí recompilaría, y en la HD
 * 4000 eso congela el juego (RONDA5.md: ~19 s).
 *
 * ── Degradación, igual que `atlas.js` ─────────────────────────────────────
 * Nada de `import` estático de la salida del horno, que puede no haber corrido:
 * todo va por `fetch` dentro de un try/catch. Si falta cualquier archivo, o el
 * navegador no sabe descomprimir, `cargarSuelo()` resuelve `{ disponible: false }`
 * y `uSueloListo` queda en 0: el terreno sigue con el ruido de antes y la piedra
 * con su gris liso. Nunca rechaza. Memoiza el resultado, también el fracaso.
 *
 * ── Por qué se decodifica el PNG a mano ───────────────────────────────────
 * El albedo lleva la altura en el canal A. Pasar el PNG por un canvas lo
 * premultiplica por A (así guarda los píxeles el navegador), y donde la altura es
 * baja —el fondo, casi la mitad del mosaico— el color pierde bits o se va a
 * cero. Leerlo con `DecompressionStream('deflate')` y deshacer los filtros de
 * cada fila da los bytes exactos que escribió el horno, sin gestión de color de
 * por medio. Son 8 archivos de 512²: unas decenas de milisegundos, fuera del
 * cuadro.
 *
 * ── API ───────────────────────────────────────────────────────────────────
 *   import { cargarSuelo, uniformesSuelo } from '../util/suelo.js';
 *   Object.assign(shader.uniforms, uniformesSuelo);   // en onBeforeCompile
 *   cargarSuelo();                                     // una vez, sin esperarla
 *
 * El orden de las capas en la textura lo fija `CAPAS` y no el manifiesto: el
 * shader las nombra por número (0 hojarasca, 1 andisol, 2 estepa, 3 acarreo).
 */

import * as THREE from 'three';

const BASE = '/tex/suelo/';
const CAPAS = ['hojarasca', 'andisol', 'estepa', 'acarreo'];

function texturaDeCapas(datos, lado, profundidad, colorSpace, filtrada) {
  const t = new THREE.DataArrayTexture(datos, lado, lado, profundidad);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.colorSpace = colorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Mipmaps: a diez metros un texel de 4 mm es la décima parte de un píxel, y
  // sin promediarlo la franja media hormiguea.
  t.generateMipmaps = filtrada;
  t.minFilter = filtrada ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  t.magFilter = filtrada ? THREE.LinearFilter : THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

const vacio = () => new Uint8Array(4 * CAPAS.length).fill(128);

/**
 * Los uniformes que comparten el terreno y la piedra. Los valores de arranque
 * son los del reemplazo: texturas de 1×1 del mismo tipo, módulo neutro, y
 * `uSueloListo` en 0 para que nadie las lea.
 */
export const uniformesSuelo = {
  uSueloAlbedo: { value: texturaDeCapas(vacio(), 1, CAPAS.length, THREE.SRGBColorSpace, false) },
  uSueloNormal: { value: texturaDeCapas(vacio(), 1, CAPAS.length, THREE.NoColorSpace, false) },
  // Por qué dividir el albedo × oclusión de cada capa para que module con media 1
  uSueloNorma: { value: CAPAS.map(() => new THREE.Vector3(1, 1, 1)) },
  // Pesos de la luminancia del módulo de cada capa (ver el horno, `pesoLuz`)
  uSueloLuz: { value: CAPAS.map(() => new THREE.Vector3(0.2126, 0.7152, 0.0722)) },
  uSueloListo: { value: 0 },
  uSueloLado: { value: 1 },
  uSueloPeriodo: { value: 2 },
};

let promesa = null;

/**
 * Carga (una sola vez) el manifiesto y las ocho imágenes, arma las dos texturas
 * de capas y las pone en `uniformesSuelo`. Nunca rechaza.
 * @returns {Promise<{ disponible: boolean, manifiesto: object|null,
 *   albedo: THREE.DataArrayTexture|null, normal: THREE.DataArrayTexture|null }>}
 */
export function cargarSuelo() {
  if (!promesa) promesa = cargarInterno();
  return promesa;
}

async function cargarInterno() {
  try {
    if (typeof DecompressionStream === 'undefined') throw new Error('el navegador no tiene DecompressionStream');
    const resp = await fetch(BASE + 'manifiesto.json');
    if (!resp.ok) throw new Error(`manifiesto.json respondió ${resp.status}`);
    const manifiesto = await resp.json();
    const capas = CAPAS.map((id) => {
      const c = (manifiesto.capas || []).find((x) => x.id === id);
      if (!c) throw new Error(`el manifiesto no trae la capa ${id}`);
      return c;
    });

    const imagenes = await Promise.all(capas.flatMap((c) => [c.archivos.albedo, c.archivos.normal]).map(async (archivo) => {
      const r = await fetch(BASE + archivo);
      if (!r.ok) throw new Error(`${archivo} respondió ${r.status}`);
      return decodificarPNG(await r.arrayBuffer());
    }));
    const lado = imagenes[0].ancho;
    if (imagenes.some((im) => im.ancho !== lado || im.alto !== lado)) throw new Error('las capas no tienen todas el mismo lado');

    const porCapa = lado * lado * 4;
    const albedo = new Uint8Array(porCapa * CAPAS.length);
    const normal = new Uint8Array(porCapa * CAPAS.length);
    capas.forEach((_, i) => {
      albedo.set(imagenes[i * 2].datos, i * porCapa);
      normal.set(imagenes[i * 2 + 1].datos, i * porCapa);
    });

    const tAlbedo = texturaDeCapas(albedo, lado, CAPAS.length, THREE.SRGBColorSpace, true);
    const tNormal = texturaDeCapas(normal, lado, CAPAS.length, THREE.NoColorSpace, true);
    const u = uniformesSuelo;
    capas.forEach((c, i) => {
      if (Array.isArray(c.normaModulo)) u.uSueloNorma.value[i].fromArray(c.normaModulo);
      if (Array.isArray(c.pesoLuz)) u.uSueloLuz.value[i].fromArray(c.pesoLuz);
    });
    u.uSueloLado.value = lado;
    u.uSueloPeriodo.value = capas[0].periodoM || manifiesto.periodoM || 2;
    u.uSueloAlbedo.value = tAlbedo;
    u.uSueloNormal.value = tNormal;
    u.uSueloListo.value = 1;
    return { disponible: true, manifiesto, albedo: tAlbedo, normal: tNormal };
  } catch (err) {
    console.warn('[suelo] capas de suelo no disponibles, el terreno sigue con el ruido de antes:', err?.message || err);
    return { disponible: false, manifiesto: null, albedo: null, normal: null };
  }
}

/**
 * PNG RGBA de 8 bits sin entrelazar, que es lo único que escribe el horno.
 * Cualquier otra cosa tira, y la tira atrapa `cargarInterno`.
 */
async function decodificarPNG(buf) {
  const b = new Uint8Array(buf);
  const firma = [137, 80, 78, 71, 13, 10, 26, 10];
  if (firma.some((v, i) => b[i] !== v)) throw new Error('no es un PNG');
  const dv = new DataView(buf);
  let p = 8, ancho = 0, alto = 0;
  const trozos = [];
  while (p + 8 <= b.length) {
    const largo = dv.getUint32(p);
    const tipo = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (tipo === 'IHDR') {
      ancho = dv.getUint32(p + 8); alto = dv.getUint32(p + 12);
      const prof = b[p + 16], color = b[p + 17], entrelazado = b[p + 20];
      if (prof !== 8 || color !== 6 || entrelazado !== 0) throw new Error('PNG que no es RGBA de 8 bits sin entrelazar');
    } else if (tipo === 'IDAT') {
      trozos.push(b.subarray(p + 8, p + 8 + largo));
    } else if (tipo === 'IEND') break;
    p += 12 + largo;
  }
  const flujo = new Blob(trozos).stream().pipeThrough(new DecompressionStream('deflate'));
  const crudo = new Uint8Array(await new Response(flujo).arrayBuffer());
  const fila = ancho * 4;
  if (crudo.length < alto * (fila + 1)) throw new Error('PNG truncado');
  const out = new Uint8Array(alto * fila);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)];
    const src = y * (fila + 1) + 1, dst = y * fila, arriba = dst - fila;
    for (let x = 0; x < fila; x++) {
      const a = x >= 4 ? out[dst + x - 4] : 0;
      const c = y > 0 ? out[arriba + x] : 0;
      const ac = y > 0 && x >= 4 ? out[arriba + x - 4] : 0;
      let v = crudo[src + x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += c;
      else if (filtro === 3) v += (a + c) >> 1;
      else if (filtro === 4) {
        const pp = a + c - ac, pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - ac);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? c : ac;
      } else if (filtro !== 0) throw new Error(`filtro PNG ${filtro} desconocido`);
      out[dst + x] = v & 255;
    }
  }
  return { ancho, alto, datos: out };
}
