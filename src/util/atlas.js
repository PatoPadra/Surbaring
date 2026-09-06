/**
 * atlas.js — cargador en tiempo de ejecución de los atlas de textura de
 * fauna horneados offline por tools/hornear-texturas.mjs a public/tex/
 * (albedo.png, normal.png, rugosidad_oclusion.png, manifiesto.json).
 *
 * Pensado para que lo consuma `fauna` en la fase 2 de la ronda 3, cuando
 * `Fauna.js` reemplace sus `MeshStandardMaterial` de color plano por estos
 * mapas. Documentado acá porque ese archivo no es mío y no lo voy a tocar.
 *
 * ── Degradación: el juego arranca igual sin atlas ───────────────────────
 * A propósito este archivo NO hace `import manifiesto from
 * '../../public/tex/manifiesto.json'`. El resto del repo sí importa sus
 * JSON de forma estática (`import fauna from './data/fauna.json'` en
 * `main.js:24`), pero ese archivo siempre existe en el repo; `public/tex/`
 * es la salida de un horneador que puede no haber corrido todavía, y un
 * import estático de un archivo ausente rompe el build de Vite entero, no
 * sólo la fauna. Por eso acá todo se busca en tiempo de ejecución con
 * `fetch('/tex/...')`, dentro de un try/catch que nunca deja escapar una
 * excepción. Si falta el manifiesto o cualquiera de los tres PNG,
 * `cargarAtlasFauna()` resuelve con `{ disponible: false, ... }` en vez de
 * rechazar, y quien lo llama sigue con los colores planos de siempre.
 *
 * ── API ──────────────────────────────────────────────────────────────────
 *   import { cargarAtlasFauna, texturasParaEspecie } from '../util/atlas.js';
 *
 *   const atlas = await cargarAtlasFauna();   // memoizado: se puede llamar
 *                                              // desde varios lugares, sólo
 *                                              // hace la carga una vez.
 *   if (atlas.disponible) {
 *     const t = texturasParaEspecie(atlas, 'huemul');
 *     if (t) {
 *       material.map = t.albedo;
 *       material.normalMap = t.normal;
 *       material.roughnessMap = t.rugosidadOclusion;  // three lee el canal G
 *       material.aoMap = t.rugosidadOclusion;          // three lee el canal R
 *     }
 *
 * ── Los canales del mapa combinado, corregidos el 6/9/2026 ───────────────
 * Estas dos líneas decían al revés cuál canal es cuál, y el horno horneaba
 * al revés para hacerles juego: R=rugosidad, G=oclusión. three.js lee el
 * mapa combinado con la convención ORM de glTF y no acepta otra —
 * `aomap_fragment.glsl.js` dice «reads channel R» y
 * `roughnessmap_fragment.glsl.js` dice «reads channel G» (three 0.169)—,
 * así que enchufar los dos mapas a esta textura hacía que la rugosidad la
 * manejara la oclusión y viceversa, **sin un error ni un aviso**. Se
 * corrigió en `tools/hornear-texturas.mjs`, que ahora hornea
 * **R = oclusión, G = rugosidad, B = 0**, y el manifiesto lo declara en su
 * campo `canales`. El nombre del archivo quedó como estaba.
 *
 * ── Y `aoMap` NO necesita un segundo set de UV ────────────────────────────
 * Acá decía que hacía falta `uv2`. Eso valía en three anterior a r151. En
 * three 0.169 cada mapa lleva `texture.channel`, que arranca en 0
 * (`Texture.js`), y el canal 0 es el atributo `uv` de siempre
 * (`WebGLPrograms.js` → `aoMapUv: getChannel(material.aoMap.channel)`). Con
 * el `uv` que ya traen las primitivas alcanza; no hay que duplicar nada.
 *   }
 *   // atlas.region('huemul') → {col,row,u0,v0,u1,v1,cellPx,guardaPx} | null
 *   // atlas.convencion → string con la convención de bandas de la celda
 *   //   (cabeza/dorso/vientre/cola), la misma que documentan pelajes.json
 *   //   y hornear-texturas.mjs.
 *
 * `texturasParaEspecie()` es el atajo recomendado: clona las tres texturas
 * base y les fija `repeat`/`offset` para que apunten sólo a la celda de esa
 * especie dentro del atlas — así cualquier geometría procedural con UV
 * default en [0,1] (que es lo que ya usan `SphereGeometry`,
 * `CylinderGeometry`, `ConeGeometry`: exactamente las primitivas de
 * `Fauna.js` hoy) queda mapeada a su celda sin tocar ni un atributo UV. Cada
 * pieza del animal (cuerpo, pata, oreja) muestrea su propia franja de la
 * misma celda con su UV local — no es una textura continua entre piezas,
 * pero para un cuerpo armado de primitivas es la práctica estándar y ya es
 * muchísimo más barato que UVs a medida.
 *
 * Nota de `flipY`: las texturas se cargan con `flipY = false` a propósito,
 * para que la fila 0 del PNG (arriba) sea V=0 en el espacio de UV, igual
 * que documenta el manifiesto (`v0` del `region()`). Con el `flipY = true`
 * por defecto de three.js el mapeo quedaría invertido verticalmente y las
 * bandas cabeza/dorso/vientre/cola aparecerían al revés sin ningún error
 * visible en consola.
 */

import * as THREE from 'three';

const BASE = '/tex/';

let promesaCarga = null;

/**
 * Carga (una sola vez, memoizada) el manifiesto y los tres atlas PNG.
 * Nunca rechaza: ante cualquier falla devuelve `{ disponible: false }`.
 * @returns {Promise<{
 *   disponible: boolean,
 *   manifiesto: object|null,
 *   texturaAlbedo: THREE.Texture|null,
 *   texturaNormal: THREE.Texture|null,
 *   texturaRugosidadOclusion: THREE.Texture|null,
 *   region: (especieId:string) => object|null,
 *   convencion: string|null,
 * }>}
 */
export function cargarAtlasFauna() {
  if (!promesaCarga) promesaCarga = cargarInterno();
  return promesaCarga;
}

async function cargarInterno() {
  try {
    const resp = await fetch(BASE + 'manifiesto.json');
    if (!resp.ok) throw new Error(`manifiesto.json respondió ${resp.status}`);
    const manifiesto = await resp.json();

    const loader = new THREE.TextureLoader();
    const [texturaAlbedo, texturaNormal, texturaRugosidadOclusion] = await Promise.all([
      cargarTextura(loader, BASE + manifiesto.archivos.albedo, THREE.SRGBColorSpace),
      cargarTextura(loader, BASE + manifiesto.archivos.normal, THREE.NoColorSpace),
      cargarTextura(loader, BASE + manifiesto.archivos.rugosidadOclusion, THREE.NoColorSpace),
    ]);

    return {
      disponible: true,
      manifiesto,
      texturaAlbedo,
      texturaNormal,
      texturaRugosidadOclusion,
      region: (especieId) => manifiesto.especies[especieId] || null,
      convencion: manifiesto.convencion,
    };
  } catch (err) {
    console.warn('[atlas] atlas de fauna no disponible, el juego sigue con colores planos:', err?.message || err);
    return {
      disponible: false,
      manifiesto: null,
      texturaAlbedo: null,
      texturaNormal: null,
      texturaRugosidadOclusion: null,
      region: () => null,
      convencion: null,
    };
  }
}

function cargarTextura(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace;
        tex.flipY = false; // ver nota de flipY arriba del archivo
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

/**
 * Atajo: texturas ya recortadas (`repeat`/`offset`) a la celda de una
 * especie. Devuelve `null` si el atlas no está disponible o la especie no
 * tiene celda horneada (por ejemplo, si `fauna.json` sumó una especie nueva
 * después del último `npm run hornear`) — nunca lanza.
 * @param {Awaited<ReturnType<typeof cargarAtlasFauna>>} atlas
 * @param {string} especieId
 */
export function texturasParaEspecie(atlas, especieId) {
  if (!atlas?.disponible) return null;
  const r = atlas.region(especieId);
  if (!r) return null;

  const anchoU = r.u1 - r.u0;
  const altoV = r.v1 - r.v0;
  const recortar = (base) => {
    const t = base.clone();
    t.repeat.set(anchoU, altoV);
    t.offset.set(r.u0, r.v0);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };

  return {
    albedo: recortar(atlas.texturaAlbedo),
    normal: recortar(atlas.texturaNormal),
    rugosidadOclusion: recortar(atlas.texturaRugosidadOclusion),
  };
}
