/**
 * Hornea la tabla de estrellas del cielo del juego desde el Bright Star Catalogue.
 *
 *   Hoffleit, D. & Warren Jr., W. H. (1991), The Bright Star Catalogue, 5th Revised
 *   Ed., NASA ADC; vía CDS, catálogo V/50.
 *
 * El catálogo crudo y su cita están en esta carpeta (`catalog.gz`, `ReadMe`,
 * `LEEME.md`). El juego no lo lee: lee la tabla que sale de acá,
 * `src/data/estrellas.json`, con la forma
 *
 *   estrellas: [[ra, dec, v, bv, hr], …]
 *
 * AR y Dec en grados, equinoccio J2000 y época 2000,0, como vienen en el catálogo; V y
 * B−V en magnitudes (B−V en `null` cuando el catálogo no la trae); `hr` es el número
 * del catálogo, para poder volver a la fila de origen. Ordenada de la más brillante a
 * la más débil.
 *
 * ── Qué entra, y por qué ─────────────────────────────────────────────────────
 *
 * - **Hasta magnitud 6,0.** Es lo que ve el ojo desnudo bajo un cielo oscuro de
 *   montaña, y el parque lo es. Contadas sobre el catálogo, las que alguna vez suben
 *   a −41,087° son 1441 hasta magnitud 5,0, 2534 hasta 5,5, 4443 hasta 6,0 y 7323
 *   hasta 6,5. Las de 6,0 a 6,5 son casi tantas como todas las anteriores juntas y
 *   no se distinguen en una pantalla de 576 renglones: no suman cielo, suman ruido.
 * - **Declinación hasta +50°.** El norte del parque está a −40,1°, y desde ahí una
 *   estrella sube sobre el horizonte si su declinación es menor que 90° − 40,1° =
 *   49,9°. Lo que queda más al norte no se ve nunca desde el Nahuel Huapi.
 * - **Se descartan los 14 objetos sin posición o sin magnitud.** Son novas y objetos
 *   extragalácticos que el catálogo conserva para no romper la numeración.
 * - **Sin movimiento propio.** La tabla es J2000 tal cual. Lo que la estrella más
 *   rápida de la tabla se corre de 2000 a 2026 lo imprime este mismo script al
 *   terminar, y es mucho menos que el medio grado que se le tolera a cada estrella.
 *   La precesión, que sí pesa un cuarto de grado, la aplica `Cielo.js` al girar el
 *   cielo, no la tabla: cambia con la fecha del juego.
 *
 * Uso: node tools/catalogos/bsc5/hornear.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..');
const SALIDA = path.join(RAIZ, 'src', 'data', 'estrellas.json');

const MAGNITUD_MAXIMA = 6.0;
const DECLINACION_MAXIMA = 50;

const CITA = 'Hoffleit, D. & Warren Jr., W. H. (1991), The Bright Star Catalogue, 5th Revised Ed., NASA ADC; vía CDS, catálogo V/50.';

/** Un campo numérico por bytes del `ReadMe` (contados desde 1), o `null` si está en blanco. */
function campo(renglon, desde, hasta) {
  const t = renglon.slice(desde - 1, hasta).trim();
  return t === '' ? null : Number(t);
}

const renglones = zlib.gunzipSync(fs.readFileSync(path.join(AQUI, 'catalog.gz'))).toString('latin1').split('\n');
const todas = [];
let descartadas = 0;
for (const r of renglones) {
  if (r.trim() === '') continue;
  const rah = campo(r, 76, 77), vmag = campo(r, 103, 107);
  if (rah === null || vmag === null) { descartadas++; continue; }
  const ra = 15 * (rah + campo(r, 78, 79) / 60 + campo(r, 80, 83) / 3600);
  const signo = r[83] === '-' ? -1 : 1;
  const dec = signo * (campo(r, 85, 86) + campo(r, 87, 88) / 60 + campo(r, 89, 90) / 3600);
  todas.push({
    hr: campo(r, 1, 4), nombre: r.slice(4, 14).trim(), ra, dec, v: vmag,
    bv: campo(r, 111, 114) === null ? null : campo(r, 110, 114),
    pmRA: campo(r, 149, 154), pmDE: campo(r, 155, 160),
  });
}

const elegidas = todas
  .filter((e) => e.v <= MAGNITUD_MAXIMA && e.dec <= DECLINACION_MAXIMA)
  .sort((a, b) => a.v - b.v || a.hr - b.hr);

const redondear = (x, d) => Number(x.toFixed(d));
const filas = elegidas.map((e) => [redondear(e.ra, 3), redondear(e.dec, 3), e.v, e.bv, e.hr]);

const tabla = {
  fuente: CITA,
  catalogo: 'CDS V/50 — https://cdsarc.cds.unistra.fr/ftp/V/50/',
  horneadaCon: 'tools/catalogos/bsc5/hornear.mjs',
  columnas: ['ra', 'dec', 'v', 'bv', 'hr'],
  unidades: 'ra y dec en grados, equinoccio J2000 y época 2000,0; v y bv en magnitudes; hr es el número del Bright Star Catalogue',
  criterio: `magnitud visual hasta ${MAGNITUD_MAXIMA.toFixed(1)} y declinación hasta +${DECLINACION_MAXIMA}°: lo que el ojo desnudo ve alguna vez desde el Nahuel Huapi`,
  estrellas: [],
};
const texto = JSON.stringify(tabla, null, 2).replace('"estrellas": []',
  '"estrellas": [\n' + filas.map((f) => '    ' + JSON.stringify(f)).join(',\n') + '\n  ]');
fs.writeFileSync(SALIDA, texto + '\n');

// ── Lo que se horneó, para mirarlo ──────────────────────────────────────────
const ANIOS = 26;
let rapida = null, corrida = 0;
for (const e of elegidas) {
  if (e.pmRA === null || e.pmDE === null) continue;
  const total = Math.hypot(e.pmRA, e.pmDE) * ANIOS / 3600;
  if (total > corrida) { corrida = total; rapida = e; }
}
// Con una décima de grado de margen sobre 90° − 41,087°, como cuenta el banco de la fase
const suben = (e) => e.dec < 90 - 41.087 + 0.1;
console.log(`\n  ${filas.length} estrellas en ${path.relative(RAIZ, SALIDA)} (${(texto.length / 1024).toFixed(0)} KB)`);
console.log(`  de ${todas.length} con posición y magnitud; ${descartadas} renglones descartados`);
console.log(`  suben a −41,087°: ${elegidas.filter(suben).length} · hasta magnitud 5: ${elegidas.filter((e) => e.v <= 5 && suben(e)).length}`);
console.log(`  sin B−V: ${elegidas.filter((e) => e.bv === null).length}`);
console.log(`  la que más se corre en ${ANIOS} años: HR ${rapida?.hr} ${rapida?.nombre}, ${corrida.toFixed(3)}°`);
for (const hr of [4730, 4853, 4763, 4656, 5459, 5267]) {
  const e = elegidas.find((x) => x.hr === hr);
  console.log(`  HR ${hr} ${e.nombre.padEnd(9)} AR ${e.ra.toFixed(3)}° · Dec ${e.dec.toFixed(3)}° · V ${e.v} · B−V ${e.bv}`);
}
console.log('');
