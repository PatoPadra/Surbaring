/**
 * SurviBar — Horneador de atlas de textura para fauna, offline, en Node.
 *
 * No hay GPU acá: cada atlas se pinta píxel a píxel en un buffer plano y se
 * escribe a PNG con `pngjs`. El juego nunca ejecuta este script; sólo carga
 * el resultado (`public/tex/*.png` + `public/tex/manifiesto.json`) como
 * cualquier otro archivo estático. Correrlo de nuevo cuando cambie
 * `src/data/pelajes.json` es responsabilidad de quien edite esa ficha.
 *
 * Por qué offline y por textura, no por shader (ver RONDA3.md y la memoria
 * `gpu-optimus-medida`): esta máquina pierde 8× en matemática de shader y
 * gana 2,3× en ancho de banda de texturas. Nada de esto corre por cuadro —
 * se paga una sola vez, acá, y el juego sólo lee texels.
 *
 * Determinismo: nunca `Math.random()` ni `Date`. Todo el azar sale de un
 * PRNG (mulberry32) sembrado con un hash FNV-1a del id de la especie, más un
 * hash puro por-píxel (sin estado) para el grano fino. Misma entrada, mismo
 * PNG byte a byte — verificado corriendo este script dos veces y comparando
 * sha256 (ver r3-horno.md).
 *
 * ── Convención de celda (repetida en pelajes.json y en src/util/atlas.js) ──
 * Cada especie ocupa una celda cuadrada de `CELL_PX` en una grilla de
 * `GRID`×`GRID` dentro de un atlas de `ATLAS_PX`×`ATLAS_PX`. Eje V de la
 * celda, 0=arriba:
 *   banda cabeza  V∈[0,0.14)   → colorAcento si bandaAcento==='cabeza'
 *   banda dorso   V∈[0.14,0.62) → colorDorso
 *   banda vientre V∈[0.62,0.86) → colorVientre
 *   banda cola    V∈[0.86,1]    → colorAcento si bandaAcento==='cola'
 *   banda media   V∈[0.42,0.58] (se superpone) → colorAcento si
 *                                 bandaAcento==='media'
 * Es una aproximación consciente: no hay UV real de modelo (la define la
 * fase 2, fauna); se usa un único eje longitudinal genérico cabeza→cola.
 *
 * ── Sangrado de mipmaps ──────────────────────────────────────────────────
 * La grilla llena el atlas sin gutter (128×8 = 1024 exacto): no hay pixeles
 * de sobra para separar celdas. La guarda es de contenido, no de espacio:
 * el patrón real se genera sólo en el área interior de la celda
 * (`CELL_PX - 2*GUARDA_PX`) y el anillo de `GUARDA_PX` píxeles del borde
 * replica (clampea) el píxel de contenido más cercano. Cuando el generador
 * de mipmaps de WebGL promedia un bloque de 2×2 que cruza el límite entre
 * dos celdas, en los niveles donde el tamaño de celda todavía es mayor que
 * `GUARDA_PX` esa mezcla cae dentro del anillo replicado — es decir, mezcla
 * la MISMA especie consigo misma, no con la vecina. Con GUARDA_PX=8 y
 * CELL_PX=128 eso sostiene una separación limpia hasta que la celda baja de
 * ~16 px (nivel de mip 3, 128→64→32→16), es decir cuatro niveles de mip
 * completamente libres de fuga. Por debajo de eso las celdas sí se
 * mezclan, pero a esa escala el animal entero ocupa unos pocos texels en
 * pantalla y la fuga es invisible. No se paga con bytes extra: el atlas
 * sigue siendo 1024×1024, sólo se usa menos área de cada celda para
 * contenido real (112×112 en vez de 128×128).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'tex');

// ── Geometría del atlas ─────────────────────────────────────────────────────
const ATLAS_PX = 1024;
const GRID = 8;                       // 8×8 celdas
const CELL_PX = ATLAS_PX / GRID;      // 128
const GUARDA_PX = 8;                  // anillo de guarda contra sangrado de mip
const CONTENIDO_PX = CELL_PX - 1 - 2 * GUARDA_PX; // 111: ancho útil, ver celdaUV()

// Bandas del eje V (documentadas arriba)
const BANDA = {
  CABEZA: [0, 0.14],
  DORSO: [0.14, 0.62],
  VIENTRE: [0.62, 0.86],
  COLA: [0.86, 1.0],
  MEDIA: [0.42, 0.58],
};

// ── PRNG determinista ────────────────────────────────────────────────────────
// Hash FNV-1a de 32 bits sobre un string — siembra estable por id de especie.
function hashCadena(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
// mulberry32: PRNG secuencial con estado, para sortear un puñado de
// parámetros por especie (centros de manchas, frecuencias de estría) en un
// orden fijo. Nunca se usa para ruido por-píxel (ver hash2D).
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Hash puro por-píxel (sin estado): mismo (semilla,x,y) siempre da el mismo
// valor, sin importar el orden en que se visiten los píxeles. Se usa para el
// grano fino y el ruido de valor (jaspeado), que no necesitan una secuencia.
function hash2D(semilla, x, y) {
  let h = semilla;
  h = Math.imul(h ^ x, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= (y + 0x9e3779b9 + (h << 6) + (h >>> 2)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ── Utilidades de color ──────────────────────────────────────────────────────
function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mezclarRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clampByte(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function suave(borde0, borde1, x) {
  const t = clamp01((x - borde0) / (borde1 - borde0));
  return t * t * (3 - 2 * t);
}

// ── Predicado de especies representables ─────────────────────────────────────
// Calcado a mano de Fauna.js:45 (constructor de la clase Fauna, `this.especies
// = datos.especies.filter(e => ['mamifero','ave'].includes(e.clase) &&
// e.largoM && e.largoM > 0.1)`). Este script no puede importar Fauna.js: ese
// archivo importa 'three' (pensado para navegador) y además es de la fase 2
// (fauna), no un archivo mío. Por eso el predicado vive DUPLICADO acá, en el
// único otro lugar del repo que necesita saber qué especies son
// representables — y por eso el assert de abajo: si algún día fauna.json
// cambia y el conteo deja de dar 44, esto avisa fuerte en vez de hornear un
// atlas incompleto en silencio.
function especiesRepresentables(fauna) {
  const lista = fauna.especies.filter((e) =>
    ['mamifero', 'ave'].includes(e.clase) && e.largoM && e.largoM > 0.1
  );
  if (lista.length !== 44) {
    throw new Error(
      `especiesRepresentables(): se esperaban 44 especies (predicado de Fauna.js:45), salieron ${lista.length}. ` +
      `Si fauna.json cambió a propósito, actualizar este número y el comentario de arriba.`
    );
  }
  return lista;
}

// ── Bandas y aplicación de patrón ────────────────────────────────────────────
function bandaDe(v) {
  if (v < BANDA.CABEZA[1]) return 'cabeza';
  if (v < BANDA.DORSO[1]) return 'dorso';
  if (v < BANDA.VIENTRE[1]) return 'vientre';
  return 'cola';
}
function enMedia(v) { return v >= BANDA.MEDIA[0] && v <= BANDA.MEDIA[1]; }

function patronAplicaEnBanda(zonaPatron, banda) {
  if (zonaPatron === 'cuerpo') return banda === 'dorso' || banda === 'vientre' || banda === 'cola';
  return zonaPatron === banda;
}

// Posición local dentro de la banda (0..1), para que listado/barrado tengan
// una escala consistente sin importar en qué banda se apliquen.
function vLocalEnBanda(v, banda) {
  const [b0, b1] = BANDA[banda.toUpperCase()];
  return clamp01((v - b0) / (b1 - b0));
}

function enFranja(u, franjas, ancho) {
  if (!franjas) return false;
  const paso = 0.6 / Math.max(1, franjas);
  const inicio = 0.2;
  for (let k = 0; k < franjas; k++) {
    const centro = inicio + paso * (k + 0.5);
    if (Math.abs(u - centro) < ancho / 2) return true;
  }
  return false;
}

// Ruido de valor 2D (grilla de hashes + interpolación bilineal) para el
// patrón "jaspeado": barato de generar acá porque corre una sola vez.
function ruidoDeValor(semilla, u, v, celdas) {
  const gx = u * celdas, gy = v * celdas;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const h00 = hash2D(semilla, x0, y0);
  const h10 = hash2D(semilla, x0 + 1, y0);
  const h01 = hash2D(semilla, x0, y0 + 1);
  const h11 = hash2D(semilla, x0 + 1, y0 + 1);
  const a = h00 + (h10 - h00) * fx;
  const b = h01 + (h11 - h01) * fx;
  return a + (b - a) * fy;
}

// Manchas del patrón "moteado": centros sorteados una vez por especie (orden
// fijo vía mulberry32), después sólo se mide distancia por píxel.
function generarManchas(prng, escalaPatron) {
  const cantidad = Math.max(6, Math.min(40, Math.round(1 / (escalaPatron * escalaPatron))));
  const manchas = [];
  for (let i = 0; i < cantidad; i++) {
    manchas.push({
      u: prng(), v: prng(),
      r: escalaPatron * (0.5 + prng() * 0.6),
    });
  }
  return manchas;
}
function valorManchas(manchas, u, v) {
  let mejor = 1e9;
  for (const m of manchas) {
    const d = Math.hypot(u - m.u, v - m.v) - m.r;
    if (d < mejor) mejor = d;
  }
  // dentro de la mancha (d<0) → 1; afuera con borde suave de ~0.02 → 0
  return 1 - suave(0, 0.02, mejor + 0.02);
}

function valorPatron(pelaje, semilla, manchas, u, v, banda) {
  switch (pelaje.patron) {
    case 'listado':
      return enFranja(u, pelaje.franjas, Math.max(0.08, pelaje.escalaPatron * 1.6)) ? 1 : 0;
    case 'barrado': {
      const vLocal = vLocalEnBanda(v, banda);
      const franja = Math.floor(vLocal / Math.max(0.04, pelaje.escalaPatron)) % 2;
      return franja === 0 ? 1 : 0;
    }
    case 'moteado':
      return valorManchas(manchas, u, v);
    case 'jaspeado': {
      const celdas = Math.max(3, Math.round(1 / Math.max(0.03, pelaje.escalaPatron)));
      return ruidoDeValor(semilla ^ 0x51ed270b, u, v, celdas);
    }
    default:
      return 0;
  }
}

// ── Estrías de pelo/pluma para el mapa normal ────────────────────────────────
const LARGO_A_FRECUENCIA = { corto: [40, 60], medio: [22, 34], largo: [10, 18] };
const LARGO_A_AMPLITUD = { corto: 0.35, medio: 0.55, largo: 0.85 };

function parametrosEstria(prng, largoPelo) {
  const [f0, f1] = LARGO_A_FRECUENCIA[largoPelo] || LARGO_A_FRECUENCIA.medio;
  return {
    freqU1: f0 + prng() * (f1 - f0), fase1: prng() * Math.PI * 2,
    freqU2: (f0 + prng() * (f1 - f0)) * 0.53, fase2: prng() * Math.PI * 2,
    freqV: 2 + prng() * 4, faseV: prng() * Math.PI * 2,
    amplitud: LARGO_A_AMPLITUD[largoPelo] || LARGO_A_AMPLITUD.medio,
  };
}
function alturaEstria(p, u, v) {
  return (
    Math.sin(u * p.freqU1 * Math.PI * 2 + p.fase1) * 0.6 +
    Math.sin(u * p.freqU2 * Math.PI * 2 + p.fase2) * 0.4
  ) * p.amplitud + Math.sin(v * p.freqV * Math.PI * 2 + p.faseV) * p.amplitud * 0.15;
}

// ── Mapeo píxel de celda → (u,v) de contenido, con guarda de borde ──────────
function celdaUV(lx, ly) {
  const cx = Math.min(Math.max(lx, GUARDA_PX), GUARDA_PX + CONTENIDO_PX);
  const cy = Math.min(Math.max(ly, GUARDA_PX), GUARDA_PX + CONTENIDO_PX);
  return { u: (cx - GUARDA_PX) / CONTENIDO_PX, v: (cy - GUARDA_PX) / CONTENIDO_PX };
}

// ── Pintado de una especie en las tres capas ────────────────────────────────
function pintarEspecie(capas, atlasPx, colOffsetPx, rowOffsetPx, pelaje, especieId) {
  const semilla = hashCadena(especieId);
  const prng = mulberry32(semilla);
  // Orden fijo de consumo del PRNG secuencial: primero las manchas (si
  // aplica), después los parámetros de estría. Cambiar este orden cambiaría
  // el resultado horneado — por eso queda comentado.
  const manchas = pelaje.patron === 'moteado' ? generarManchas(prng, pelaje.escalaPatron) : null;
  const estria = parametrosEstria(prng, pelaje.largoPelo);
  const factorLargo = LARGO_A_AMPLITUD[pelaje.largoPelo] || LARGO_A_AMPLITUD.medio;

  const colorDorsoRgb = hexARgb(pelaje.colorDorso);
  const colorVientreRgb = hexARgb(pelaje.colorVientre);
  const colorAcentoRgb = pelaje.colorAcento ? hexARgb(pelaje.colorAcento) : null;
  const colorPatronRgb = pelaje.colorPatron ? hexARgb(pelaje.colorPatron) : null;

  for (let ly = 0; ly < CELL_PX; ly++) {
    const py = rowOffsetPx + ly;
    for (let lx = 0; lx < CELL_PX; lx++) {
      const px = colOffsetPx + lx;
      const { u, v } = celdaUV(lx, ly);
      const banda = bandaDe(v);
      const idx = (py * atlasPx + px) * 4;

      // ── albedo ──
      let rgb = banda === 'vientre' ? colorVientreRgb.slice() : colorDorsoRgb.slice();
      if (colorAcentoRgb && pelaje.bandaAcento === banda) rgb = colorAcentoRgb.slice();
      if (colorAcentoRgb && pelaje.bandaAcento === 'media' && enMedia(v)) rgb = colorAcentoRgb.slice();
      if (pelaje.patron !== 'liso' && patronAplicaEnBanda(pelaje.zonaPatron, banda)) {
        const t = valorPatron(pelaje, semilla, manchas, u, v, banda);
        rgb = mezclarRgb(rgb, colorPatronRgb, t);
      }
      // grano fino determinista, sutil, en todas las especies
      const grano = (hash2D(semilla ^ 0x9e3779b9, Math.round(u * 512), Math.round(v * 512)) - 0.5) * 14;
      capas.albedo[idx] = clampByte(rgb[0] + grano);
      capas.albedo[idx + 1] = clampByte(rgb[1] + grano);
      capas.albedo[idx + 2] = clampByte(rgb[2] + grano);
      capas.albedo[idx + 3] = 255;

      // ── normal (estrías de pelo/pluma orientadas cabeza→cola) ──
      const eps = 1 / CONTENIDO_PX;
      const hC = alturaEstria(estria, u, v);
      const hU = alturaEstria(estria, u + eps, v);
      const hV = alturaEstria(estria, u, v + eps);
      const fuerza = 1.6 * factorLargo;
      let nx = -((hU - hC) / eps) * fuerza;
      let ny = -((hV - hC) / eps) * fuerza;
      let nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      capas.normal[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      capas.normal[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      capas.normal[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      capas.normal[idx + 3] = 255;

      // ── mapa combinado: convención ORM de glTF — R = oclusión, G = rugosidad ──
      //
      // OJO, esto estuvo cruzado y es un defecto que no avisa. three.js lee el
      // mapa combinado con la convención ORM de glTF, y lo dice en su propio
      // código: `aomap_fragment.glsl.js` → «reads channel R», y
      // `roughnessmap_fragment.glsl.js` → «reads channel G» (verificado en
      // node_modules, three 0.169). Este horno escribía al revés —R=rugosidad,
      // G=oclusión—, así que enchufar `roughnessMap` y `aoMap` a la misma
      // textura hacía que la rugosidad la manejara la oclusión y viceversa,
      // **sin un error ni un aviso en consola**. Corregido el 6/9/2026 por el
      // jefe de la fase 2, que fue quien lo encontró (fase 1 ya estaba cerrada).
      //
      // No se puede arreglar del lado del consumidor: en three el canal de cada
      // uno de esos dos mapas es fijo, no se elige. O se hornea en el orden que
      // three espera, o hace falta un shader propio — y un shader propio va
      // justo contra el hardware de esta máquina (pierde 8× en ALU de
      // fragmento). Por eso se arregla acá, donde se paga una sola vez.
      const granoRug = (hash2D(semilla ^ 0x1234abcd, Math.round(u * 256), Math.round(v * 256)) - 0.5) * 0.08;
      const rug = clamp01(pelaje.rugosidad + granoRug);
      const distBorde = Math.min(
        Math.abs(v - BANDA.CABEZA[1]), Math.abs(v - BANDA.DORSO[1]), Math.abs(v - BANDA.VIENTRE[1])
      );
      const ocl = 1 - 0.22 * (1 - suave(0, 0.035, distBorde));
      capas.rugOcl[idx] = clampByte(ocl * 255);      // R = oclusión  (aoMap)
      capas.rugOcl[idx + 1] = clampByte(rug * 255);  // G = rugosidad (roughnessMap)
      capas.rugOcl[idx + 2] = 0;                     // B = metalidad (sin uso: la fauna no es metálica)
      capas.rugOcl[idx + 3] = 255;
    }
  }
}

// ── Presupuesto de VRAM, calculado (no tipeado a mano) ───────────────────────
function calcularPresupuesto(cantidadAtlas) {
  const bytesBase = ATLAS_PX * ATLAS_PX * 4;
  const factorMip = 4 / 3; // cadena completa de mipmaps de una textura POT
  const bytesConMip = bytesBase * factorMip;
  const totalBytes = bytesConMip * cantidadAtlas;
  const techoBytes = 24 * 1000 * 1000; // 24 MB, techo duro de RONDA3.md
  return {
    atlasPx: ATLAS_PX,
    bytesPorAtlasSinMip: bytesBase,
    factorMip,
    bytesPorAtlasConMip: bytesConMip,
    cantidadAtlas,
    totalBytes,
    totalMB: totalBytes / 1e6,
    techoMB: techoBytes / 1e6,
    dentroDelTecho: totalBytes <= techoBytes,
  };
}

// ── Generación completa (función pura de fauna+pelajes) ─────────────────────
function hornear(fauna, pelajesDoc) {
  const especies = especiesRepresentables(fauna);
  const bytesCapa = ATLAS_PX * ATLAS_PX * 4;
  const capas = {
    albedo: new Uint8ClampedArray(bytesCapa),
    normal: new Uint8ClampedArray(bytesCapa),
    rugOcl: new Uint8ClampedArray(bytesCapa),
  };
  // Fondo transparente: las 64-44=20 celdas sobrantes de la grilla quedan
  // sin usar (alpha 0). No cuestan más VRAM — el atlas ya tiene ese tamaño
  // fijo — y así se nota a simple vista si algo lee una celda vacía.

  const manifiestoEspecies = {};
  especies.forEach((e, i) => {
    const pelaje = pelajesDoc.especies[e.id];
    if (!pelaje) {
      throw new Error(`Falta la ficha de pelaje para "${e.id}" en src/data/pelajes.json`);
    }
    const col = i % GRID, row = Math.floor(i / GRID);
    const colOffsetPx = col * CELL_PX, rowOffsetPx = row * CELL_PX;
    pintarEspecie(capas, ATLAS_PX, colOffsetPx, rowOffsetPx, pelaje, e.id);
    manifiestoEspecies[e.id] = {
      col, row,
      u0: col / GRID, v0: row / GRID,
      u1: (col + 1) / GRID, v1: (row + 1) / GRID,
      cellPx: CELL_PX, guardaPx: GUARDA_PX,
    };
  });

  const presupuesto = calcularPresupuesto(3);
  if (!presupuesto.dentroDelTecho) {
    throw new Error(`Presupuesto de VRAM excedido: ${presupuesto.totalMB} MB > ${presupuesto.techoMB} MB`);
  }

  const manifiesto = {
    version: 1,
    atlasPx: ATLAS_PX,
    grid: { cols: GRID, rows: GRID, cellPx: CELL_PX, guardaPx: GUARDA_PX },
    archivos: { albedo: 'albedo.png', normal: 'normal.png', rugosidadOclusion: 'rugosidad_oclusion.png' },
    // El nombre del archivo dice «rugosidad_oclusion» por orden histórico, pero
    // el ORDEN DE LOS CANALES es el de glTF (ORM), que es el único que three.js
    // sabe leer: aoMap del canal R, roughnessMap del canal G. Se declara acá
    // para que se pueda auditar sin abrir el horneador ni el navegador.
    canales: {
      rugosidadOclusion: { R: 'oclusion (aoMap)', G: 'rugosidad (roughnessMap)', B: 'metalidad, sin uso (0)', A: '255' },
      convencion: 'ORM de glTF — la que leen aomap_fragment (R) y roughnessmap_fragment (G) de three.js',
    },
    convencion: pelajesDoc.convencion,
    sangradoMips: {
      guardaPx: GUARDA_PX,
      metodo: 'borde de la celda replicado (clamp) hacia el contenido interior; sin gutter extra entre celdas. ' +
        `Sostiene separación limpia mientras el tamaño de celda en ese nivel de mip sea mayor que ${GUARDA_PX}px ` +
        '(niveles 1024→512→256→128→64, cuatro reducciones desde el atlas completo antes de que una celda de ' +
        '128px baje de 16px). Por debajo se funde con la vecina; a esa escala el animal ocupa unos pocos texels ' +
        'en pantalla y no se nota.',
    },
    presupuestoVRAM: presupuesto,
    especies: manifiestoEspecies,
  };

  return { capas, manifiesto };
}

// ── Escritura a disco ─────────────────────────────────────────────────────
function escribirPng(rutaAbs, buffer) {
  const png = new PNG({ width: ATLAS_PX, height: ATLAS_PX, colorType: 6, inputHasAlpha: true });
  png.data = Buffer.from(buffer);
  // Todas las opciones que afectan los bytes, fijadas a mano: nivel de
  // deflate y filtro de línea. Sin esto pngjs podría emitir tIME u otro
  // default que rompiera el byte a byte entre corridas o entre máquinas.
  const bytes = PNG.sync.write(png, { deflateLevel: 9, filterType: 0 });
  fs.writeFileSync(rutaAbs, bytes);
  return bytes.length;
}

function main() {
  const fauna = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/fauna.json'), 'utf8'));
  const pelajesDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pelajes.json'), 'utf8'));

  const { capas, manifiesto } = hornear(fauna, pelajesDoc);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tamAlbedo = escribirPng(path.join(OUT_DIR, manifiesto.archivos.albedo), capas.albedo);
  const tamNormal = escribirPng(path.join(OUT_DIR, manifiesto.archivos.normal), capas.normal);
  const tamRugOcl = escribirPng(path.join(OUT_DIR, manifiesto.archivos.rugosidadOclusion), capas.rugOcl);

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifiesto.json'),
    JSON.stringify(manifiesto, null, 2) + '\n',
    'utf8'
  );

  console.log(`Horneadas ${Object.keys(manifiesto.especies).length} especies en grilla ${GRID}×${GRID} (celda ${CELL_PX}px, guarda ${GUARDA_PX}px).`);
  console.log(`albedo.png: ${tamAlbedo} B · normal.png: ${tamNormal} B · rugosidad_oclusion.png: ${tamRugOcl} B`);
  console.log(`Presupuesto de VRAM: ${manifiesto.presupuestoVRAM.totalMB.toFixed(2)} MB (con mipmaps) contra un techo de ${manifiesto.presupuestoVRAM.techoMB} MB.`);
}

main();

export { hornear, especiesRepresentables, calcularPresupuesto };
