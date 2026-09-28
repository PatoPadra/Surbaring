/**
 * Cielo — atmósfera, sol, luna y cielo estrellado austral.
 *
 * La posición del sol se calcula con astronomía real para la latitud -41,13°,
 * así que los días largos de enero y los cortos de julio salen solos, igual que
 * la altura del sol al mediodía en cada época del año.
 *
 * La dispersión atmosférica es un Preetham simplificado, evaluado por píxel en
 * la cúpula: da el azul profundo del cielo patagónico al mediodía y los rojos
 * largos del atardecer sobre el lago.
 *
 * La noche también es la de la fecha. La luna sale de una efeméride, con su
 * paralaje y su fase —la forma del disco por geometría y cuánto alumbra por la ley
 * de Allen, que no es lo mismo: ver `brilloLunar()`—; el cielo gira alrededor del
 * polo sur celeste con el tiempo sidéreo y la precesión; y las estrellas son las de
 * un catálogo:
 *
 *   Hoffleit, D. & Warren Jr., W. H. (1991), The Bright Star Catalogue, 5th
 *   Revised Ed., NASA ADC; vía CDS, catálogo V/50.
 *
 * Horneadas en `src/data/estrellas.json` por `tools/catalogos/bsc5/hornear.mjs`.
 */

import * as THREE from 'three';

const RAD = Math.PI / 180;

/**
 * Modelo atmosférico compartido entre la CPU y el shader.
 *
 * Las mismas constantes las usan `FRAG` —para dibujar la cúpula— y
 * `_dispersion()` —para sacar de ahí el color del sol, el de la luz de relleno y
 * el de la niebla. Si divergen, el paisaje deja de pertenecer al cielo que tiene
 * encima: era exactamente el defecto viejo, con la hemisférica en un pastel fijo
 * y la niebla en una rampa inventada.
 */
// Coeficientes de dispersión Rayleigh en RGB (longitudes de onda 680/550/440 nm)
const BETA_R = [5.8e-6, 13.5e-6, 33.1e-6];
// Mie. Estaba en 21e-6, que con turbiedad 2,2 da una profundidad óptica de
// aerosol de 0,058: un día con calima, no el aire de un parque nacional. En
// 14e-6 queda en 0,039, que es lo que se mide en montaña limpia, y de paso el
// gris del Mie deja de comerle saturación al azul del cielo alto.
const BETA_M = 14.0e-6;
// Escala de la radiancia del cielo a las unidades lineales de la escena.
//
// Estaba en 26 y el horizonte pasaba de 1,0 lineal a toda hora. El resplandor de
// `main.js` tiene el umbral en 0,86 y corre ANTES del mapeo tonal, o sea que el
// cielo entero entraba al bloom y lo derramaba sobre el paisaje: eso —y no la
// niebla— es la neblina lechosa del mediodía de `base-alta-bosque.png`.
const ESCALA_CIELO = 21.0;

function suave(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Camino óptico en metros, con la masa de aire de Kasten-Young. Réplica exacta
 * de `caminoOptico()` del shader: si una de las dos cambia, cambian las dos.
 */
function caminoOptico(cosCenit, alturaEscala) {
  const c = Math.max(cosCenit, 0);
  return alturaEscala / (c + 0.15 * Math.pow(93.885 - Math.acos(Math.min(1, c)) / RAD, -1.253));
}

/** Posición solar real (algoritmo NOAA simplificado). */
export function posicionSolar(fecha, latitud, longitud) {
  const dia = (Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
    - Date.UTC(fecha.getUTCFullYear(), 0, 0)) / 86400000;
  const horaUTC = fecha.getUTCHours() + fecha.getUTCMinutes() / 60 + fecha.getUTCSeconds() / 3600;

  const gamma = 2 * Math.PI / 365 * (dia - 1 + (horaUTC - 12) / 24);
  const eqTiempo = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declinacion = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const desfase = eqTiempo + 4 * longitud;
  const horaVerdadera = horaUTC * 60 + desfase;
  const anguloHorario = (horaVerdadera / 4 - 180) * RAD;

  const lat = latitud * RAD;
  const cosCenit = Math.sin(lat) * Math.sin(declinacion)
    + Math.cos(lat) * Math.cos(declinacion) * Math.cos(anguloHorario);
  const cenit = Math.acos(Math.max(-1, Math.min(1, cosCenit)));
  const altura = Math.PI / 2 - cenit;

  let azimut = Math.atan2(
    Math.sin(anguloHorario),
    Math.cos(anguloHorario) * Math.sin(lat) - Math.tan(declinacion) * Math.cos(lat)
  );
  azimut = azimut + Math.PI; // 0 = norte, creciendo hacia el este

  return { altura, azimut, declinacion };
}

/** Vector unitario hacia el sol. +X Este, +Z Sur, +Y arriba. */
export function vectorSolar(altura, azimut, salida = new THREE.Vector3()) {
  const cosAlt = Math.cos(altura);
  return salida.set(
    cosAlt * Math.sin(azimut),
    Math.sin(altura),
    -cosAlt * Math.cos(azimut)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// La noche de la fecha: tiempo sidéreo, precesión y luna
// ═══════════════════════════════════════════════════════════════════════════
//
// Antes la luna era `vectorSolar(-altura·0,85 + 0,3, …)` con una fase de
// `fecha mód 29,53 días` sin época: en la luna nueva real del 10/2/2024 el juego
// la dibujaba 52 % iluminada y alta, y en la llena del 25/2, 45 %. Las estrellas
// eran ruido pegado al mundo, que no giraba, y la Vía Láctea una banda fija. Un
// cielo así no sirve para orientarse, que es para lo que se mira el cielo de noche.
//
// Todo lo de acá corre en `actualizar()`, una vez por cuadro: son unos cuarenta
// senos, y dos matrices de 3×3.

const J2000 = 2451545.0;
const senG = (g) => Math.sin(g * RAD);
const cosG = (g) => Math.cos(g * RAD);

/** Día juliano. La fecha del juego ya corre en UTC (`Tiempo.js`). */
const diaJuliano = (fecha) => fecha.getTime() / 86400000 + 2440587.5;

/** Dirección J2000 de una AR y una Dec en grados: +X al equinoccio, +Z al polo norte celeste. */
function vectorCeleste(ra, dec, salida = new THREE.Vector3()) {
  const cd = cosG(dec);
  return salida.set(cd * cosG(ra), cd * senG(ra), senG(dec));
}

/**
 * Tiempo sidéreo medio de Greenwich, en grados (Meeus, *Astronomical Algorithms*,
 * 12.4). Es el ángulo que giró el cielo: una vuelta cada 23 h 56 min.
 */
function tiempoSidereo(jd) {
  const d = jd - J2000, t = d / 36525;
  const g = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000;
  return ((g % 360) + 360) % 360;
}

/**
 * Precesión rigurosa de J2000 a la fecha (Meeus, 21.2 a 21.4), como matriz.
 *
 * Corre la Cruz del Sur y los punteros entre 0,21° y 0,26° en 2025. Cabría en el
 * medio grado que se le tolera a cada estrella, pero son seis senos por cuadro, y
 * sin ella el cielo del juego se iría corriendo un grado cada setenta años de fecha.
 */
function matrizPrecesion(jd, m) {
  const t = (jd - J2000) / 36525;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) / 3600;
  const th = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) / 3600;
  const cz = cosG(z), sz = senG(z), cZ = cosG(zeta), sZ = senG(zeta), ct = cosG(th), st = senG(th);
  // Rz(z) · Ry(−θ) · Rz(ζ): sumar ζ a la AR, inclinar el ecuador θ, sumar z
  return m.set(
    cz * ct * cZ - sz * sZ, -cz * ct * sZ - sz * cZ, -cz * st,
    sz * ct * cZ + cz * sZ, -sz * ct * sZ + cz * cZ, -sz * st,
    st * cZ, -st * sZ, ct);
}

/**
 * La luna de baja precisión del *Astronomical Almanac* (sección D): la longitud
 * eclíptica con seis términos, la latitud con cuatro y la paralaje horizontal con
 * cuatro. Deja en `salida` la posición geocéntrica, ecuatorial media de la fecha,
 * en radios terrestres, y devuelve la longitud eclíptica en grados.
 *
 * Contra JPL Horizons en los diez instantes del banco, vista desde el arranque: la
 * peor queda a 0,15°, y la iluminación a 0,12 puntos. Veinte líneas alcanzan con un
 * orden de magnitud de margen sobre el medio grado que se pide.
 */
function lunaGeocentrica(t, salida) {
  const lon = 218.32 + 481267.881 * t
    + 6.29 * senG(135.0 + 477198.87 * t) - 1.27 * senG(259.3 - 413335.36 * t)
    + 0.66 * senG(235.7 + 890534.22 * t) + 0.21 * senG(269.9 + 954397.74 * t)
    - 0.19 * senG(357.5 + 35999.05 * t) - 0.11 * senG(186.5 + 966404.03 * t);
  const lat = 5.13 * senG(93.3 + 483202.02 * t) + 0.28 * senG(228.2 + 960400.89 * t)
    - 0.28 * senG(318.3 + 6003.15 * t) - 0.17 * senG(217.6 - 407332.21 * t);
  const paralaje = 0.9508
    + 0.0518 * cosG(135.0 + 477198.87 * t) + 0.0095 * cosG(259.3 - 413335.36 * t)
    + 0.0078 * cosG(235.7 + 890534.22 * t) + 0.0028 * cosG(269.9 + 954397.74 * t);
  const r = 1 / senG(paralaje);
  const cb = cosG(lat), sb = senG(lat), cl = cosG(lon), sl = senG(lon);
  // De la eclíptica al ecuador con la oblicuidad del Almanac, 23,44°
  salida.set(r * cb * cl, r * (0.9175 * cb * sl - 0.3978 * sb), r * (0.3978 * cb * sl + 0.9175 * sb));
  return lon;
}

/**
 * El sol de baja precisión del mismo Almanac, ecuatorial de la fecha, en radios
 * terrestres. Sólo sirve para la fase de la luna: el sol que se dibuja y que alumbra
 * sigue siendo el de `posicionSolar()`, y los dos difieren en centésimas de grado.
 */
function solGeocentrico(d, salida) {
  const g = 357.528 + 0.9856003 * d;
  const lon = 280.460 + 0.9856474 * d + 1.915 * senG(g) + 0.020 * senG(2 * g);
  const r = (1.00014 - 0.01671 * cosG(g) - 0.00014 * cosG(2 * g)) * 23454.8;
  return salida.set(r * cosG(lon), r * 0.9175 * senG(lon), r * 0.3978 * senG(lon)), lon;
}

/** Polo norte y centro galácticos, J2000. La banda de la Vía Láctea se dibuja alrededor del polo. */
const POLO_GALACTICO = vectorCeleste(192.859, 27.128);
const CENTRO_GALACTICO = vectorCeleste(266.405, -28.936);

/**
 * La Cruz del Sur, J2000, del catálogo por número HR: Acrux (α¹ Cru, 4730), Mimosa
 * (β, 4853), Gacrux (γ, 4763) y δ Cru (4656). `queMiro()` mide contra el promedio de
 * las cuatro direcciones, que queda a menos de 0,1° del promedio de AR y Dec.
 */
const CRUZ = [[186.650, -63.099], [191.930, -59.689], [187.791, -57.113], [183.786, -58.749]];
const CENTRO_CRUZ = CRUZ.reduce((s, [ra, dec]) => s.add(vectorCeleste(ra, dec)), new THREE.Vector3()).normalize();
const COS_RADIO_CRUZ = Math.cos(12 * RAD);

/**
 * Hasta dónde es de noche para ver la Cruz: `diurno` —el mismo smoothstep del domo—
 * en 0,1, que es el sol unos 5° bajo el horizonte. Ahí las cinco estrellas del método,
 * todas de magnitud 1,63 o más brillantes, ya se ven; δ Cru (2,80) todavía no.
 */
const DIURNO_NOCHE = 0.1;

/**
 * Radio del disco de la luna: 0,52°, el doble del real.
 *
 * El de la base era 1,4°, cinco veces el real. Con el real, 0,26°, a 62° de campo y
 * 576 renglones el disco mide 4 px de diámetro y la fase no se lee, que es lo que
 * hay que aprender a mirar. Al doble mide 9 px ahí y 16 a 1080 renglones. El códice
 * lo dice.
 */
const RADIO_LUNA = 0.52 * RAD;

/**
 * Brillo del disco entero de la luna, relativo a la llena, por su ángulo de fase.
 *
 * La ley de Allen (C. W. Allen, *Astrophysical Quantities*, 3ª ed., § 68 «The Moon»,
 * la tabla de magnitud contra ángulo de fase): la magnitud aparente del disco crece
 *
 *     Δm = 0,026·α + 4·10⁻⁹·α⁴        (α en grados)
 *
 * así que el brillo relativo es 10^(−0,4·Δm). Da 1 en la llena (α = 0°), 0,091 en el
 * cuarto (90°) y 0,0116 a 135°.
 *
 * **No es la fracción iluminada**, que es lo que el juego usaba hasta la ronda 8. En
 * el cuarto la mitad del disco está iluminada, pero de costado: cerca del terminador
 * el sol rasante deja el relieve lleno de sombras largas, y el regolito devuelve
 * mucho más hacia atrás que de lado —la retrodispersión, el «efecto de oposición»,
 * que es también por lo que la luna se pone desproporcionadamente brillante justo en
 * la llena—. El resultado es que el cuarto alumbra un 9 % de la llena, no un 50 %.
 * El término de cuarto grado es el que dobla la curva hacia abajo en las fases finas.
 *
 * @param {number} alfaGrados ángulo de fase: 0° llena, 90° cuarto, 180° nueva
 * @returns {number} brillo relativo a la llena
 */
export function brilloLunar(alfaGrados) {
  const a = Math.abs(alfaGrados);
  return Math.pow(10, -0.4 * (0.026 * a + 4e-9 * a * a * a * a));
}

/**
 * Color de una estrella por su B−V, lineal y con luminancia 1: el brillo lo pone la
 * magnitud, no el color, y así el orden de brillo de la imagen es el del catálogo.
 *
 * La rampa es aproximada, por tipo espectral —azuladas las B (B−V ≈ −0,2), blancas
 * las A y F (0 a 0,4), amarillentas las G (0,6), anaranjadas las K (1,0) y rojizas
 * las M (1,6)— y va a media saturación: de noche el ojo mira con los bastones y el
 * color de las estrellas apenas se nota. Alcanza para que Gacrux (+1,59) salga
 * anaranjada al lado de Acrux (−0,24), que es lo que se ve a ojo en la Cruz.
 */
const RAMPA_BV = [
  [-0.3, 0.64, 0.74, 1.00],
  [0.0, 0.82, 0.88, 1.00],
  [0.4, 1.00, 0.98, 0.96],
  [0.7, 1.00, 0.92, 0.80],
  [1.1, 1.00, 0.80, 0.60],
  [1.7, 1.00, 0.66, 0.42],
];
function colorEstelar(bv, salida) {
  let r = 1, g = 1, b = 1;
  if (bv !== null && Number.isFinite(bv)) {
    let k = 0;
    while (k < RAMPA_BV.length - 2 && bv > RAMPA_BV[k + 1][0]) k++;
    const a = RAMPA_BV[k], z = RAMPA_BV[k + 1];
    const t = Math.max(0, Math.min(1, (bv - a[0]) / (z[0] - a[0])));
    r = 0.5 + 0.5 * (a[1] + (z[1] - a[1]) * t);
    g = 0.5 + 0.5 * (a[2] + (z[2] - a[2]) * t);
    b = 0.5 + 0.5 * (a[3] + (z[3] - a[3]) * t);
  }
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  salida[0] = r / lum; salida[1] = g / lum; salida[2] = b / lum;
  return salida;
}

export class Cielo {
  constructor(escena, radio = 42000) {
    this.escena = escena;
    this.direccionSol = new THREE.Vector3(0, 1, 0);
    this.direccionLuna = new THREE.Vector3(0, -1, 0);
    // La edad de la luna en fracción del ciclo: 0 nueva, 0,5 llena. La fracción
    // iluminada del disco, que es lo que se DIBUJA, está en `uFaseLunar`.
    this.faseLunar = 0.5;
    // El ángulo de fase en grados (0 llena, 180 nueva) y el brillo del disco entero
    // relativo a la llena por la ley de Allen (`brilloLunar`), que es lo que ALUMBRA:
    // la luz de la noche, la niebla, el halo y cuánto se lavan las estrellas.
    this.anguloFase = 0;
    this.brilloLuna = 1;

    // Del J2000 al mundo en la última `actualizar()`: precesión, tiempo sidéreo y
    // horizonte del lugar. Es lo que gira el cielo entero.
    this._cieloAMundo = new THREE.Matrix3();
    this._ecuatorialAMundo = new THREE.Matrix3();
    this._precesion = new THREE.Matrix3();

    this.uniformes = {
      uSol: { value: this.direccionSol },
      uLuna: { value: this.direccionLuna },
      // La fracción iluminada del disco, de 0 a 1: sólo la forma, o sea dónde cae el
      // terminador. Lo que alumbra es `uBrilloLunar`, que es otra cosa.
      uFaseLunar: { value: 0.5 },
      // Brillo del disco entero relativo a la llena, por la ley de Allen
      // (`brilloLunar`). Lo leen el halo y las estrellas, y del lado de JavaScript la
      // luz de la noche y la niebla. Viaja como VALOR de uniforme y no como `#define`:
      // cambia todas las noches y no tiene que recompilar nada.
      uBrilloLunar: { value: 1 },
      uTurbiedad: { value: 2.2 },   // aire muy limpio: es un parque nacional
      // Estaba en 1,6 y encima multiplicado por (1 + 0,15·turbiedad), o sea 2,13
      // efectivo: una atmósfera del doble de espesa que la real. La turbiedad
      // son aerosoles y el Rayleigh son moléculas de aire — acoplarlos no tiene
      // sentido físico, y el sol de media mañana salía naranja de atardecer.
      uRayleigh: { value: 1.15 },
      // Peso del rebote de dispersión múltiple. Ver el comentario largo en FRAG:
      // es el término que faltaba y por cuya falta el cielo era verde.
      uMultiple: { value: 3.0 },
      uMieG: { value: 0.78 },
      uMieCoef: { value: 1.0 },
      uIntensidad: { value: 1.0 },
      uCeniza: { value: 0.0 },
      uNubes: { value: 0.35 },
      uTiempo: { value: 0 },
      uVientoNubes: { value: new THREE.Vector2(0.9, 0.25) },
      uCieloAMundo: { value: this._cieloAMundo },
      // Tamaño angular de un píxel, en radianes: con eso se suaviza el borde del
      // disco de la luna sin `fwidth()`, que en un shader de GLSL ES 1.00 depende de
      // una extensión. Lo escribe `onBeforeRender` con la cámara que de verdad
      // dibuja, así que vale igual para el juego, para una captura y para el reflejo.
      uPixelAngular: { value: 0.002 },
      // La dirección en el mundo del polo norte galáctico: la Vía Láctea es la banda
      // a 90° de él, y gira con el cielo.
      uPoloGalactico: { value: new THREE.Vector3().copy(POLO_GALACTICO) },
      uCentroGalactico: { value: new THREE.Vector3().copy(CENTRO_GALACTICO) },
    };

    const geo = new THREE.SphereGeometry(radio, 64, 40);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniformes,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.malla = new THREE.Mesh(geo, mat);
    // Último entre los opacos, no primero.
    //
    // Estaba en -1000, o sea que el domo de 42 km entraba con el búfer de
    // profundidad recién limpiado y NINGÚN píxel de cielo se rechazaba: el
    // shader —dispersión de Rayleigh y Mie más dos fbm de cinco octavas para las
    // nubes, unas ochenta evaluaciones de hash por píxel— corría entero en la
    // pantalla completa, y después el terreno y el bosque lo pintaban encima.
    // Medido en la placa de destino: 4,3 ms de los 122,8 del cuadro, tirados en
    // píxeles tapados.
    //
    // Dibujándolo último, la prueba de profundidad temprana descarta todo lo que
    // la geometría ya cubrió. No escribe profundidad, así que no puede tapar
    // nada nuevo; y el agua es transparente, o sea que va después de todos los
    // opacos y lo sigue viendo debajo.
    this.malla.renderOrder = 1000;
    this.malla.frustumCulled = false;
    // El elemento [5] de la matriz de proyección de una perspectiva es
    // 1/tan(campo vertical / 2): dos veces su inversa, dividido por los renglones del
    // búfer, es lo que abarca un píxel. A 62° y 576 renglones da 0,0021 rad (0,12°);
    // con el campo de 6° del banco, 0,00018 (0,010°).
    this._tamano = new THREE.Vector2();
    this.malla.onBeforeRender = (render, escena_, camara) => {
      const alto = render.getDrawingBufferSize(this._tamano).y || 1;
      const m5 = camara?.projectionMatrix?.elements[5] || 1;
      this.uniformes.uPixelAngular.value = 2 / (Math.abs(m5) * alto);
    };
    escena.add(this.malla);

    // ── Las estrellas ─────────────────────────────────────────────────────────
    //
    // Puntos, uno por estrella del catálogo, y no ruido en la cúpula. El ruido
    // viejo eran dos capas de `ruido3` —dieciséis hashes por píxel de cielo— que
    // inventaban 163 de cada 193 puntos brillantes; acá son 4484 vértices, y los
    // píxeles que se pintan son los de las estrellas y nada más.
    //
    // Van después del domo (1001) y sumando luz, con la prueba de profundidad:
    // el relieve las tapa como tapa el cielo. Las nubes, la ceniza y el día no
    // pueden taparlas desde el domo, que ya se dibujó, así que las apaga el propio
    // vértice con la MISMA cobertura de nubes (`NUBES_GLSL`).
    //
    // Siempre visibles, también de día, y apagadas en el shader: con
    // `visible = false` el programa compilaría recién al caer la noche, con el
    // tirón en el peor momento, y los programas de día y de noche no serían los
    // mismos. Son hijas de la malla, que acompaña a la cámara.
    this.uniformesEstrellas = {
      uCieloAMundo: this.uniformes.uCieloAMundo,
      uSol: this.uniformes.uSol,
      uLuna: this.uniformes.uLuna,
      uBrilloLunar: this.uniformes.uBrilloLunar,
      uNubes: this.uniformes.uNubes,
      uCeniza: this.uniformes.uCeniza,
      uTiempo: this.uniformes.uTiempo,
      uVientoNubes: this.uniformes.uVientoNubes,
      // Brillo lineal de una estrella de magnitud 1 en el píxel del centro. Con la
      // exposición de la noche (1,13) y ACES, 0,8 cae en ~225 de 255; la cuenta
      // entera está en `VERT_ESTRELLAS`.
      uBrilloEstrellas: { value: 0.8 },
      uPixel: { value: 1 },
      uRadioCielo: { value: radio * 0.95 },
    };
    this.estrellas = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: this.uniformesEstrellas,
      vertexShader: VERT_ESTRELLAS,
      fragmentShader: FRAG_ESTRELLAS,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    // Una estrella muda hasta que llega la tabla, para que el programa exista y
    // compile con el primer cuadro aunque el JSON tarde.
    this.estrellas.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 1]), 3));
    this.estrellas.geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([1, 1, 1]), 3));
    this.estrellas.geometry.setAttribute('aMagnitud', new THREE.BufferAttribute(new Float32Array([99]), 1));
    this.estrellas.renderOrder = 1001;
    this.estrellas.frustumCulled = false;
    // El tamaño va en píxeles de pantalla: una estrella es un punto, no crece con la
    // resolución, pero con pixelRatio 2 tiene que ocupar el doble de píxeles.
    this.estrellas.onBeforeRender = (render) => { this.uniformesEstrellas.uPixel.value = render.getPixelRatio(); };
    this.malla.add(this.estrellas);
    this.cantidadEstrellas = 0;
    this._cargarEstrellas();

    // Portador del color y la intensidad del sol. NO se agrega a la escena:
    // la iluminación direccional la aportan las cascadas de CSM, y una luz
    // direccional de más desborda el arreglo CSM_cascades del shader.
    this.luzSol = new THREE.DirectionalLight(0xffffff, 3.0);
    this.luzSol.castShadow = false;

    // Luz de cielo y rebote del suelo.
    //
    // Es media bóveda de fuente de área, o sea la única luz que recibe la cara
    // en sombra de cualquier cosa. Los valores de acá son sólo el arranque: el
    // color y la intensidad los reescribe `_encenderLuces()` con el cielo que
    // de verdad hay a esa hora.
    this.luzAmbiente = new THREE.HemisphereLight(0x9fc0e8, 0x4a4034, 0.55);
    escena.add(this.luzAmbiente);

    // Reutilizados por cuadro para no ensuciar el recolector de basura
    this._cenit = [0, 0, 0];
    this._bajo = [0, 0, 0];
    this._trans = [0, 0, 0];
    this._tauSol = [0, 0, 0];
    this._mezcla = [0, 0, 0];
    this._niebla = [0, 0, 0];
    this._luna = new THREE.Vector3();
    this._sol = new THREE.Vector3();
    this._observador = new THREE.Vector3();
    this._hacia = new THREE.Vector3();
    this._centroCruz = new THREE.Vector3();
    this._mirada = new THREE.Vector3();
  }

  /**
   * La tabla va con `import()` y no con un `import` arriba: son 161 KB que no tienen
   * por qué estar en el paquete principal, y `Tiempo.js` importa este módulo en los
   * bancos de Node, que no cargan JSON sin atributo. En Node el rechazo se ataja y el
   * cielo gira igual, sin puntos.
   */
  _cargarEstrellas() {
    import('../data/estrellas.json')
      .then((m) => this._ponerEstrellas(m.default ?? m))
      .catch(() => { /* sin tabla: sin puntos */ });
  }

  /** @param {{estrellas: Array<[number, number, number, number|null, number]>}} tabla */
  _ponerEstrellas(tabla) {
    const filas = tabla?.estrellas;
    if (!Array.isArray(filas) || !filas.length) return;
    const n = filas.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
    const v = new THREE.Vector3(), c = [1, 1, 1];
    for (let i = 0; i < n; i++) {
      const [ra, dec, m, bv] = filas[i];
      vectorCeleste(ra, dec, v);
      pos[3 * i] = v.x; pos[3 * i + 1] = v.y; pos[3 * i + 2] = v.z;
      col.set(colorEstelar(bv, c), 3 * i);
      mag[i] = m;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aMagnitud', new THREE.BufferAttribute(mag, 1));
    this.estrellas.geometry.dispose();
    this.estrellas.geometry = geo;
    this.cantidadEstrellas = n;
  }

  /**
   * @param {Date} fecha fecha y hora simuladas, en UTC
   * @param {number} lat
   * @param {number} lon
   */
  actualizar(fecha, lat, lon, tiempo = 0) {
    const { altura, azimut } = posicionSolar(fecha, lat, lon);
    vectorSolar(altura, azimut, this.direccionSol);
    this.alturaSol = altura;

    const jd = diaJuliano(fecha);
    const local = this._girarCielo(jd, lat, lon);
    this._lunaDeLaFecha(jd, lat, local);
    this.uniformes.uTiempo.value = tiempo;

    const h = Math.max(-0.18, altura);
    this.factorDia = Math.max(0, Math.sin(h));
    this.factorCrepusculo = Math.exp(-Math.pow(Math.max(0, h) / 0.22, 2))
      * (altura > -0.18 ? 1 : 0);
    // El mismo smoothstep que usa el domo para mezclar el cielo de día con el de noche
    this.diurno = suave(-0.14, 0.10, this.direccionSol.y);

    this._encenderLuces();
    return this;
  }

  /**
   * Del J2000 al mundo. Primero la precesión a la fecha; después el ángulo horario
   * —girar el tiempo sidéreo local sobre el eje del polo—; y por último el horizonte
   * del lugar, con la convención de `vectorSolar()`: +X este, +Y arriba, +Z sur.
   *
   * Con eso el polo sur celeste cae en el azimut 180° y a una altura igual a la
   * latitud, y todo el cielo gira a su alrededor.
   *
   * @returns {number} el tiempo sidéreo local, en grados
   */
  _girarCielo(jd, lat, lon) {
    const local = tiempoSidereo(jd) + lon;
    const cL = cosG(local), sL = senG(local), cf = cosG(lat), sf = senG(lat);
    this._ecuatorialAMundo.set(
      -sL, cL, 0,
      cf * cL, cf * sL, sf,
      sf * cL, sf * sL, -cf);
    matrizPrecesion(jd, this._precesion);
    this._cieloAMundo.multiplyMatrices(this._ecuatorialAMundo, this._precesion);
    this.uniformes.uPoloGalactico.value.copy(POLO_GALACTICO).applyMatrix3(this._cieloAMundo);
    this.uniformes.uCentroGalactico.value.copy(CENTRO_GALACTICO).applyMatrix3(this._cieloAMundo);
    return local;
  }

  /**
   * La luna vista desde el lugar, y su fase.
   *
   * La paralaje no es un detalle. La luna está a unos 60 radios terrestres, y
   * mirarla desde la superficie y no desde el centro de la Tierra la corre hasta un
   * grado, dos veces su tamaño: sin restar al observador quedaba a 1,04° de JPL, y
   * restándolo, a 0,15°.
   *
   * La fase se mide también desde el lugar, con el ángulo entre el sol y el
   * observador vistos desde la luna. Medida desde el centro de la Tierra erraba
   * 0,67 puntos contra la iluminación de JPL; desde el lugar, 0,12.
   */
  _lunaDeLaFecha(jd, lat, local) {
    const d = jd - J2000;
    const lonLuna = lunaGeocentrica(d / 36525, this._luna);
    const lonSol = solGeocentrico(d, this._sol);

    // El observador, en radios terrestres, con la latitud geocéntrica. Los 800 m de
    // altura del arranque lo mueven 1/8000 de radio: no se notan.
    const u = Math.atan(0.99664719 * Math.tan(lat * RAD));
    this._observador.set(Math.cos(u) * cosG(local), Math.cos(u) * senG(local), 0.99664719 * Math.sin(u));
    const luna = this._luna.sub(this._observador);
    this.direccionLuna.copy(luna).applyMatrix3(this._ecuatorialAMundo).normalize();

    // Ángulo de fase: del sol y del observador, vistos desde la luna
    const alSol = this._hacia.copy(this._sol).sub(luna);
    const cosFase = -alSol.dot(luna) / (alSol.length() * luna.length());
    this.uniformes.uFaseLunar.value = (1 + cosFase) / 2;

    // La forma y el brillo salen del MISMO ángulo, pero no son la misma cuenta: la
    // fracción iluminada es geometría, (1 + cos α) / 2, y el brillo es fotometría, la
    // ley de Allen. Confundirlas era hacer que el cuarto alumbrara 5,5 veces de más:
    // 0,500 contra 0,091.
    this.anguloFase = Math.acos(Math.max(-1, Math.min(1, cosFase))) / RAD;
    this.brilloLuna = brilloLunar(this.anguloFase);
    this.uniformes.uBrilloLunar.value = this.brilloLuna;

    this.faseLunar = (((lonLuna - lonSol) % 360) + 360) % 360 / 360;
  }

  /**
   * Dirección en el mundo de una posición J2000, en la última `actualizar()`.
   *
   * @param {number} ra ascensión recta en grados, J2000
   * @param {number} dec declinación en grados, J2000
   * @param {THREE.Vector3} [salida]
   */
  direccionDe(ra, dec, salida = new THREE.Vector3()) {
    return vectorCeleste(ra, dec, salida).applyMatrix3(this._cieloAMundo);
  }

  /**
   * Qué hay en el cielo en esa dirección, para quien lo quiera contar.
   *
   * Por ahora una sola cosa: `'cruz_del_sur'` a 12° o menos del centro de la Cruz,
   * con la Cruz sobre el horizonte y de noche. Si no, `null`. No mira las nubes: la
   * Cruz está ahí aunque no se vea, y decidir si decirlo es de quien pregunta.
   *
   * @param {{x:number, y:number, z:number}} direccion no hace falta que sea unitaria
   * @returns {'cruz_del_sur'|null}
   */
  queMiro(direccion) {
    if (!direccion || !(this.diurno <= DIURNO_NOCHE)) return null;
    const centro = this._centroCruz.copy(CENTRO_CRUZ).applyMatrix3(this._cieloAMundo);
    if (centro.y <= 0) return null;
    const d = this._mirada.set(direccion.x, direccion.y, direccion.z);
    const largo = d.length();
    if (!(largo > 0)) return null;
    return centro.dot(d) / largo >= COS_RADIO_CRUZ ? 'cruz_del_sur' : null;
  }

  configurarAtmosfera({ turbiedad, nubes, ceniza } = {}) {
    if (turbiedad !== undefined) this.uniformes.uTurbiedad.value = turbiedad;
    if (nubes !== undefined) this.uniformes.uNubes.value = nubes;
    if (ceniza !== undefined) this.uniformes.uCeniza.value = ceniza;
    // El clima no cambia sólo la cúpula: un cubierto apaga el sol y prende el
    // cielo. Se rehacen las luces acá porque `main` llama a esta función DESPUÉS
    // de `actualizar()`, y si no el sol quedaría con la nubosidad del cuadro
    // anterior —o, en una captura con salto de fecha, con la de otro día.
    if (this.alturaSol !== undefined) this._encenderLuces();
  }

  /**
   * Transmitancia atmosférica del rayo directo del sol, por canal.
   * Es de dónde salen el color y la atenuación del sol a cada hora.
   */
  _transmitanciaSolar(salida = [0, 0, 0]) {
    const u = this.uniformes;
    const solY = this.direccionSol.y;
    const solR = caminoOptico(solY, 8400.0);
    const solM = caminoOptico(solY, 1250.0);
    const bM = BETA_M * u.uMieCoef.value * u.uTurbiedad.value * solM;
    for (let i = 0; i < 3; i++) {
      salida[i] = Math.exp(-(BETA_R[i] * u.uRayleigh.value * solR + bM));
    }
    return salida;
  }

  /**
   * Radiancia del cielo en una dirección, en las unidades lineales de la escena.
   * Réplica en CPU del bloque de dispersión de `FRAG` —incluido el rebote de
   * dispersión múltiple—, para que la luz de relleno y la niebla sean el MISMO
   * cielo que se está dibujando y no una rampa aparte.
   *
   * @param {number} alturaVista seno de la altura de la dirección mirada
   * @param {number} cosTheta coseno del ángulo con el sol
   */
  _dispersion(alturaVista, cosTheta, salida = [0, 0, 0]) {
    const u = this.uniformes;
    const g = u.uMieG.value;
    const solY = this.direccionSol.y;

    const faseR = (3 / (16 * Math.PI)) * (1 + cosTheta * cosTheta);
    const faseM = (1 / (4 * Math.PI)) * ((1 - g * g) /
      Math.pow(Math.max(1e-4, 1 + g * g - 2 * g * cosTheta), 1.5));

    const sR = caminoOptico(alturaVista, 8400.0);
    const sM = caminoOptico(alturaVista, 1250.0);
    const solR = caminoOptico(solY, 8400.0);
    const solM = caminoOptico(solY, 1250.0);
    const bM = BETA_M * u.uMieCoef.value * u.uTurbiedad.value;
    const ray = u.uRayleigh.value;

    const tauSol = this._tauSol;
    let brillo = 0;
    for (let i = 0; i < 3; i++) {
      tauSol[i] = BETA_R[i] * ray * solR + bM * solM;
      brillo += Math.exp(-tauSol[i]) / 3;
    }

    const escala = ESCALA_CIELO * u.uIntensidad.value
      * (0.04 + 0.96 * suave(-0.14, 0.10, solY));
    const tauM = bM * sM;
    for (let i = 0; i < 3; i++) {
      const tauR = BETA_R[i] * ray * sR;
      const tau = tauR + tauM;
      const fuente = Math.exp(-tauSol[i])
        + (1 - Math.exp(-tauSol[i] * 0.35)) * u.uMultiple.value * brillo;
      const albedo = (tauR * faseR + tauM * faseM) / Math.max(tau, 1e-9);
      salida[i] = albedo * (1 - Math.exp(-tau)) * fuente * escala;
    }
    return salida;
  }

  /**
   * Sol y luz de cielo a partir del mismo modelo que dibuja la cúpula.
   *
   * ── El sol ──────────────────────────────────────────────────────────────
   * Estaba en `3.4 * sin(h)`, y el sombreado ya multiplica por N·L, que es el
   * mismo coseno: el terreno llano recibía 3,4·sin²(h). A las nueve de la mañana
   * del 15 de febrero, con el sol a 22,4°, eso es 0,52 — de ahí la penumbra de
   * `base-alta-manana.png` a plena mañana. El disco solar arriba de la atmósfera
   * vale lo mismo a toda hora; lo que baja con la altura es la transmitancia, y
   * el coseno lo pone el sombreado una sola vez.
   */
  _encenderLuces() {
    const u = this.uniformes;
    const solY = this.direccionSol.y;
    const nubes = u.uNubes.value;

    const trans = this._transmitanciaSolar(this._trans);
    const pico = Math.max(trans[0], trans[1], trans[2], 1e-6);
    // Lo que atraviesa la capa de nubes. Antes el cielo cubierto no tocaba la
    // luz de la escena: sólo cambiaba la cúpula, y un día de tormenta iluminaba
    // el bosque igual que uno despejado.
    const paso = 1 - 0.75 * nubes * nubes;
    const visible = suave(-0.06, 0.02, solY);

    this.luzSol.color.setRGB(trans[0] / pico, trans[1] / pico, trans[2] / pico);
    this.luzSol.intensity = 3.9 * pico * visible * paso;
    // Copia propia del sol, porque `main` pisa `luzSol.intensity` con cero antes
    // de que la vegetación la lea —la iluminación direccional la aportan las
    // cascadas— y quien la buscara desde afuera se llevaba un cero.
    //
    // Vegetacion.js pedía `cielo.intensidadSolar` y `cielo.luzSolColor`, que NO
    // EXISTÍAN: el `??` caía siempre y las carteleras se iluminaban con un sol
    // constante de 2,0 a las seis de la mañana, al mediodía y a las nueve de la
    // noche. Por eso el bosque lejano se veía como recortes de cartulina negra
    // mientras el árbol de al lado brillaba: dos paradas y media de diferencia
    // bajo el mismo sol. El comentario de aquel archivo prometía exactamente lo
    // contrario de lo que el código hacía.
    this.intensidadSolar = this.luzSol.intensity;
    this.luzSolColor = this.luzSol.color;

    this.luzSol.position.copy(this.direccionSol).multiplyScalar(6000);
    this.luzSol.target.position.set(0, 0, 0);

    // ── Luz de cielo ────────────────────────────────────────────────────────
    //
    // Dos muestras de la cúpula alcanzan para media bóveda: el cenit —que es lo
    // que más pesa para una cara mirando arriba, porque el coseno lo favorece— y
    // el cielo bajo a 6°, que es el más brillante. A 90° del sol las dos, así
    // que el halo de dispersión hacia adelante no las contamina; una hemisférica
    // no puede representar una dirección preferente igual.
    const cenit = this._dispersion(1.0, solY, this._cenit);
    const bajo = this._dispersion(0.10, 0.0, this._bajo);
    const c = this._mezcla;
    for (let i = 0; i < 3; i++) c[i] = 0.65 * cenit[i] + 0.35 * bajo[i];

    // Con nubes el cielo pierde color y gana brillo: la lámina gris devuelve
    // repartida la luz que el sol dejó de mandar derecho.
    if (nubes > 0.01) {
      const lum = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      const gris = nubes * 0.8;
      const refuerzo = 1 + 1.1 * nubes;
      for (let i = 0; i < 3; i++) c[i] = (c[i] * (1 - gris) + lum * gris) * refuerzo;
    }

    // 0,82 calibra la radiancia del cielo contra las unidades de three: deja el
    // relleno en un 15-17 % del sol directo al mediodía limpio, que es la
    // fracción difusa que se mide en un día así.
    let brillo = Math.max(c[0], c[1], c[2], 1e-5);
    let intensidad = 0.82 * brillo;

    // De noche manda la luna. Sin este piso la escena queda en negro absoluto:
    // no es lo que ve un ojo adaptado bajo el cielo austral.
    //
    // La luna entra por su BRILLO (la ley de Allen), no por la fracción iluminada del
    // disco: el seno de la altura reparte la irradiancia sobre el suelo, y el brillo
    // dice cuánta manda la luna esta noche. La llena sigue dando 0,045 + 0,09·sen h,
    // que es lo que había; el cuarto, que daba 0,045·sen h (la mitad del disco), pasa
    // a dar 0,0082·sen h.
    const noche = 1 - suave(-0.10, 0.06, solY);
    if (noche > 0.001) {
      const luna = Math.max(0, this.direccionLuna.y) * this.brilloLuna;
      const ambNoche = (0.045 + 0.09 * luna) * noche;
      const az = [0.42, 0.55, 1.0];
      for (let i = 0; i < 3; i++) {
        c[i] = c[i] / brillo * intensidad + az[i] * ambNoche;
      }
      brillo = Math.max(c[0], c[1], c[2], 1e-5);
      intensidad = brillo;
    }

    this.luzAmbiente.intensity = intensidad;
    this.luzAmbiente.color.setRGB(c[0] / brillo, c[1] / brillo, c[2] / brillo);

    // Contrato para quien NO pasa por el sistema de luces de three.
    //
    // Las carteleras de `Vegetacion.js` se iluminan a mano y arman su ambiente
    // con `0.18 + 0.34 * factorDia` y dos constantes más: la misma clase de
    // rampa inventada que acabo de sacar de acá, o sea que el bosque lejano
    // vuelve a despegarse del cercano. `irradianciaCielo` ya viene multiplicada
    // —color por intensidad— para que enchufarla sea una línea.
    (this.irradianciaCielo ??= new THREE.Color()).setRGB(
      c[0] / brillo * intensidad, c[1] / brillo * intensidad, c[2] / brillo * intensidad);
    this.intensidadCielo = intensidad;
    this.luzCieloColor = this.luzAmbiente.color;

    // El suelo devuelve lo que recibe, teñido por su albedo: pardo con verde de
    // bosque. Es lo que le pone luz a la cara de abajo de las hojas y a los
    // aleros, y antes era un marrón fijo que no sabía si era de día.
    const ALBEDO_SUELO = [0.17, 0.15, 0.11];
    const solHoriz = Math.max(0, solY) * this.luzSol.intensity;
    const sc = this.luzSol.color;
    const irr = [
      this.luzAmbiente.color.r * intensidad + solHoriz * sc.r,
      this.luzAmbiente.color.g * intensidad + solHoriz * sc.g,
      this.luzAmbiente.color.b * intensidad + solHoriz * sc.b,
    ];
    this.luzAmbiente.groundColor.setRGB(
      Math.min(1, irr[0] * ALBEDO_SUELO[0] / intensidad),
      Math.min(1, irr[1] * ALBEDO_SUELO[1] / intensidad),
      Math.min(1, irr[2] * ALBEDO_SUELO[2] / intensidad)
    );
  }

  /**
   * Color de niebla coherente con el cielo cerca del horizonte.
   *
   * Es lo que hace que la cadena lejana se funda con el cielo contra el que se
   * recorta en vez de despegarse: la perspectiva aérea converge a la radiancia
   * del cielo, así que la niebla TIENE que ser ese mismo número. Antes era una
   * rampa de tres constantes que al mediodía daba un celeste lechoso y al
   * atardecer no se enteraba del naranja.
   *
   * A 2,6° de altura y 70° del sol: bastante bajo para ser el horizonte, y lo
   * bastante fuera del sol para no teñirse del halo cuando uno mira para otro
   * lado. En el crepúsculo el término de Mie hacia adelante todavía alcanza para
   * que la niebla se caliente sola.
   */
  colorNiebla(salida = new THREE.Color()) {
    const c = this._dispersion(0.045, 0.35, this._niebla);

    // De noche el aire igual devuelve algo: la luna y el resplandor del cielo
    // estrellado. Sin este piso la cordillera se recorta en negro absoluto
    // contra un cielo que sí tiene brillo.
    // La luna entra por su brillo (Allen), igual que el ambiente: es la misma luz
    // rebotando en el aire, no puede seguir otra ley que la del suelo.
    const noche = 1 - suave(-0.10, 0.06, this.direccionSol.y);
    const luna = Math.max(0, this.direccionLuna.y) * this.brilloLuna;
    const piso = noche * (0.020 + 0.045 * luna);
    salida.setRGB(c[0] + piso * 0.62, c[1] + piso * 0.78, c[2] + piso);

    const ceniza = this.uniformes.uCeniza.value;
    if (ceniza > 0) salida.lerp(CENIZA, ceniza * 0.75);
    return salida;
  }
}

const CENIZA = new THREE.Color(0.42, 0.39, 0.36);

// ═══════════════════════════════════════════════════════════════════════════
// Shaders
// ═══════════════════════════════════════════════════════════════════════════

const RUIDO_GLSL = /* glsl */`
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruido3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ruido3(p); p *= 2.07; a *= 0.5; }
  return v;
}
`;

/**
 * La cobertura de nubes en una dirección. La usan la cúpula, para dibujarlas, y
 * las estrellas, para apagarse detrás: si fueran dos cuentas, una estrella se vería
 * a través de una nube que la cúpula sí dibuja. Necesita `uNubes`, `uTiempo` y
 * `uVientoNubes` declarados antes.
 */
const NUBES_GLSL = /* glsl */`
float coberturaNubes(vec3 dir, out float d) {
  // Proyección sobre una capa plana: da perspectiva hacia el horizonte
  float t = 0.16 / max(dir.y, 0.045);
  vec3 p = dir * t;
  vec2 desliz = uVientoNubes * uTiempo * 0.004;
  d = fbm3(vec3(p.xz * 2.4 + desliz, uTiempo * 0.012));
  float d2 = fbm3(vec3(p.xz * 5.6 - desliz * 1.7, uTiempo * 0.02 + 4.0));
  float cobertura = smoothstep(0.62 - uNubes * 0.45, 0.94 - uNubes * 0.30, d * 0.72 + d2 * 0.28);
  return cobertura * smoothstep(0.0, 0.11, dir.y);
}
`;

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_Position.z = gl_Position.w; // siempre al fondo
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;

uniform vec3 uSol;
uniform vec3 uLuna;
uniform float uFaseLunar;
uniform float uBrilloLunar;
uniform float uTurbiedad;
uniform float uRayleigh;
uniform float uMieG;
uniform float uMieCoef;
uniform float uIntensidad;
uniform float uMultiple;
uniform float uCeniza;
uniform float uNubes;
uniform float uTiempo;
uniform vec2 uVientoNubes;
uniform mat3 uCieloAMundo;
uniform vec3 uPoloGalactico;
uniform vec3 uCentroGalactico;
uniform float uPixelAngular;

const float PI = 3.141592653589793;
// Coeficientes de dispersión Rayleigh en RGB (longitudes de onda 680/550/440 nm)
const vec3 BETA_R = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const vec3 BETA_M = vec3(14.0e-6);
const vec3 FONDO_NOCHE = vec3(0.008, 0.014, 0.032);
const float RADIO_LUNA = ${RADIO_LUNA.toFixed(7)};
const float COS_ZONA_LUNA = ${Math.cos(2 * RADIO_LUNA).toFixed(9)};

${RUIDO_GLSL}
${NUBES_GLSL}

// Longitud del camino óptico EN METROS, con la aproximación de Kasten-Young
// para la masa de aire. Los coeficientes BETA están por metro, así que la
// altura de escala también tiene que ir en metros: 8400 m para Rayleigh y
// 1250 m para Mie. Mezclar kilómetros con metros hace explotar el exponente
// y el cielo se vuelve negro.
// El coseno se acota de los dos lados, como en el gemelo de CPU —que ya hacía
// Math.min(1, c)—: con un coseno que en float32 valga 1,0000001 mirando al cenit,
// acos() da NaN y el píxel de cielo sale de cualquier color.
float caminoOptico(float cosCenit, float alturaEscala) {
  float c = clamp(cosCenit, 0.0, 1.0);
  return alturaEscala / (c + 0.15 * pow(93.885 - acos(c) * 180.0 / PI, -1.253));
}

void main() {
  vec3 dir = normalize(vDir);
  float alturaVista = dir.y;
  vec3 sol = normalize(uSol);
  float cosTheta = dot(dir, sol);

  // ── Dispersión ────────────────────────────────────────────────────────────
  // El Rayleigh NO se acopla a la turbiedad: la turbiedad son aerosoles y el
  // Rayleigh son moléculas de aire. El (1 + 0,15·turbiedad) que había acá subía
  // el espesor de la atmósfera a 2,13 veces el real, y el sol de media mañana
  // salía naranja de atardecer.
  float rayleigh = uRayleigh;
  float faseR = (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
  float g = uMieG;
  float faseM = (1.0 / (4.0 * PI)) * ((1.0 - g * g) /
                pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5));

  float sR = caminoOptico(alturaVista, 8400.0);
  float sM = caminoOptico(alturaVista, 1250.0);
  float solR = caminoOptico(sol.y, 8400.0);
  float solM = caminoOptico(sol.y, 1250.0);

  vec3 betaR = BETA_R * rayleigh;
  vec3 betaM = BETA_M * uMieCoef * uTurbiedad;

  // Profundidad óptica de la COLUMNA, no coeficiente por metro.
  //
  // El albedo se pesaba con betaR / (betaR + betaM), y eso compara un número
  // de aire de 8400 m de altura de escala con uno de 1250: el Mie —que es gris—
  // pesaba lo mismo mirando al cenit que al horizonte, y le comía el azul al
  // cielo alto. Pesado por columna, el aerosol sólo manda donde de verdad hay
  // aerosol, que es cerca del suelo.
  vec3 tauR = betaR * sR;
  vec3 tauM = betaM * sM;
  vec3 tauVista = tauR + tauM;

  vec3 tauSol = betaR * solR + betaM * solM;
  vec3 directa = exp(-tauSol);

  // ── Acá estaba el cielo verde ─────────────────────────────────────────────
  //
  // Antes la fuente era la directa a secas: la luz se atenuaba con TODO el camino
  // al sol y después la vista la volvía a atenuar. El azul se extinguía dos
  // veces y el verde —que se extingue la mitad— quedaba arriba. Con el sol a 30°
  // y mirando a 17° de altura la cuenta daba (0,192 0,290 0,265): verde oliva
  // medido, no una impresión. Es el cielo de capturas/base-alta-manana.png.
  //
  // Lo que falta es que el fotón azul que el rayo directo pierde no desaparece:
  // se dispersa, y una buena parte vuelve. Ese segundo rebote sale de arriba,
  // donde el aire ya es fino, así que se atenúa mucho menos —de ahí el 0,35 del
  // camino— y su espectro es el complemento de lo que se extinguió, o sea azul,
  // que es justo el canal que faltaba.
  //
  // El factor de brillo es lo que lo apaga con el sol bajo, y es la parte que no
  // se puede sacar: un rebote proporcional a (1 - directa) a secas tiende a gris
  // parejo cuando el sol se hunde y MATA el rojo del atardecer. Probado.
  float brillo = dot(directa, vec3(0.3333333));
  vec3 fuente = directa + (1.0 - exp(-tauSol * 0.35)) * uMultiple * brillo;

  // Dispersión acumulada a lo largo de la vista. Se usa la forma de albedo por
  // (1 - transmitancia): satura hacia el blanco en el horizonte en vez de
  // dispararse al infinito, que es lo que rompía la versión anterior.
  vec3 albedo = (tauR * faseR + tauM * faseM) / max(tauVista, vec3(1e-9));
  vec3 dispersion = albedo * (1.0 - exp(-tauVista)) * fuente;

  float diurno = smoothstep(-0.14, 0.10, sol.y);
  vec3 color = dispersion * 21.0 * uIntensidad * mix(0.04, 1.0, diurno);
  vec3 colorDia = color;

  // ── Cielo nocturno ────────────────────────────────────────────────────────
  // Las estrellas ya no están acá: son los puntos del catálogo (VERT_ESTRELLAS),
  // que se dibujan encima. Acá quedan el fondo, la Vía Láctea y el halo de la luna.
  float noche = 1.0 - diurno;
  vec3 luna = normalize(uLuna);
  float cosLuna = dot(dir, luna);
  if (noche > 0.001) {
    // La Vía Láctea es el plano de la galaxia: la banda a 90° del polo galáctico,
    // que gira con el cielo. Es más ancha y más brillante hacia el centro, en
    // Sagitario, que en invierno pasa a 78° de altura sobre el parque. El polvo se
    // toma en coordenadas del cielo —dir · M es M transpuesta por dir, la dirección
    // J2000— para que las manchas giren con las estrellas y no queden pegadas.
    float latGal = dot(dir, uPoloGalactico);
    float bulbo = smoothstep(-0.3, 1.0, dot(dir, uCentroGalactico));
    float bandaVL = exp(-pow(latGal * (3.1 - 1.2 * bulbo), 2.0));
    float polvo = fbm3((dir * uCieloAMundo) * 5.2 + 11.0);
    vec3 viaLactea = vec3(0.52, 0.56, 0.72) * bandaVL * (0.035 + 0.065 * polvo)
                   * (0.6 + 0.9 * bulbo) * smoothstep(0.0, 0.2, alturaVista);

    color = mix(FONDO_NOCHE + viaLactea, color, diurno);
  }

  // ── La luna ───────────────────────────────────────────────────────────────
  //
  // Un disco con su fase, y no un círculo que se apaga entero. El de la base se
  // pesaba con uFaseLunar, que era un brillo: una luna en cuarto salía 0,98
  // iluminada y los dos lados brillaban igual.
  //
  // En el disco, q es la posición en radios de la luna: q.x hacia el sol, q.y de
  // costado. Una esfera iluminada de lado muestra el limbo del lado del sol y el
  // terminador, una media elipse con semieje (1 - 2k); sobre el eje del sol, lo
  // iluminado mide 2k radios, que es la fracción iluminada k. Acá la superficie
  // iluminada brilla igual en creciente que en llena y lo único que cambia con k es
  // cuánta hay: es una aproximación de dibujo, y buena para lo que se ve en pantalla
  // a 9 px de diámetro. El disco es lo único que sigue usando k; el halo, la luz del
  // suelo, la niebla y lo que se lavan las estrellas van por uBrilloLunar, que es la
  // fotometría de verdad (la ley de Allen) y baja mucho más rápido.
  //
  // La cara oscura tapa lo que hay detrás —la Vía Láctea, las estrellas se apagan
  // solas en su vértice— y deja lo que hay delante, que es el aire: de noche el
  // fondo, de día el azul. Por eso de día la luna se ve pálida y sólo la parte
  // iluminada.
  if (cosLuna > COS_ZONA_LUNA) {
    vec3 haciaSol = sol - luna * dot(sol, luna);
    float largo = length(haciaSol);
    vec3 eje = largo > 1e-6 ? haciaSol / largo : vec3(1.0, 0.0, 0.0);
    vec3 costado = cross(luna, eje);
    vec3 d = dir - luna * cosLuna;
    vec2 q = vec2(dot(d, eje), dot(d, costado)) / RADIO_LUNA;
    float aa = uPixelAngular / RADIO_LUNA + 1e-3;
    float disco = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, length(q)))
                * smoothstep(-0.015, 0.005, luna.y);
    float terminador = (1.0 - 2.0 * uFaseLunar) * sqrt(max(0.0, 1.0 - q.y * q.y));
    float iluminado = smoothstep(terminador - aa, terminador + aa, q.x);
    color = mix(color, mix(FONDO_NOCHE, colorDia, diurno), disco);
    // 0,004 en la cara oscura: la luz cenicienta, lo que la Tierra le devuelve
    color += disco * (iluminado * 2.6 + (1.0 - iluminado) * 0.004 * noche) * vec3(0.95, 0.95, 0.88);
  }
  if (noche > 0.001) {
    // El halo es aire iluminado por la luna, delante del disco: va después, y crece
    // con lo que la luna manda de verdad —el brillo de Allen—, no con cuánto disco se
    // ve. Una luna en cuarto casi no tiene halo aunque se le vea media cara.
    float haloLuna = pow(max(0.0, cosLuna), 320.0) * 0.30;
    color += haloLuna * smoothstep(-0.06, 0.06, luna.y) * uBrilloLunar * noche * vec3(0.95, 0.95, 0.88);
  }

  // ── Disco solar ───────────────────────────────────────────────────────────
  float disco = smoothstep(0.99965, 0.99991, cosTheta);
  // Se enrojece y se agranda al ras del horizonte, como el sol real
  vec3 colorDisco = mix(vec3(1.0, 0.32, 0.10), vec3(1.0, 0.96, 0.90),
                        smoothstep(-0.02, 0.24, sol.y));
  color += disco * colorDisco * 14.0 * smoothstep(-0.05, 0.02, sol.y);
  color += pow(max(0.0, cosTheta), 900.0) * colorDisco * 1.2 * smoothstep(-0.05, 0.05, sol.y);

  // ── Nubes ─────────────────────────────────────────────────────────────────
  if (uNubes > 0.01 && alturaVista > 0.0) {
    float d;
    float cobertura = coberturaNubes(dir, d);

    // Iluminación de la nube: bordes encendidos hacia el sol
    float haciaSol = max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(sol.x, 0.0, sol.z))));

    // La nube no tiene color propio: devuelve la luz que le llega.
    //
    // Estaba en una paleta fija —(1,00 0,93 0,84) en la cara al sol— que a las
    // once de la mañana daba una lámina de 0,9 lineal, por encima del umbral
    // 0,86 del resplandor: el cielo cubierto entraba entero al bloom y se comía
    // el horizonte. Y era la misma crema a toda hora, así que un cubierto de
    // mediodía y uno de atardecer se veían igual.
    //
    // El 0,4 del camino es porque la nube está ARRIBA: la luz que la ilumina no
    // cruzó la atmósfera baja, y usar la transmitancia del suelo la pintaba de
    // naranja al mediodía.
    vec3 luzNube = exp(-tauSol * 0.4) * 0.86 + fuente * 0.22;
    vec3 nubeClara = luzNube * mix(0.62, 0.95, haciaSol * 0.6);
    vec3 nubeSombra = luzNube * mix(0.26, 0.40, haciaSol * 0.4);
    vec3 colorNube = mix(nubeSombra, nubeClara, smoothstep(0.1, 0.85, d));
    colorNube *= mix(0.10, 1.0, diurno);
    colorNube += colorDisco * pow(max(0.0, cosTheta), 40.0) * 0.35 * diurno;

    color = mix(color, colorNube, cobertura * 0.94);
  }

  // ── Ceniza volcánica: apaga el cielo y lo vuelve pardo ────────────────────
  if (uCeniza > 0.001) {
    vec3 pardo = vec3(0.40, 0.35, 0.30) * mix(0.12, 1.0, diurno);
    float densidad = uCeniza * (0.55 + 0.45 * (1.0 - abs(alturaVista)));
    color = mix(color, pardo, clamp(densidad, 0.0, 0.93));
  }

  // Un poco de granulado rompe el bandeado en los degradés del cielo
  float grano = (hash(vec3(gl_FragCoord.xy, uTiempo * 0.1)) - 0.5) * 0.0035;
  gl_FragColor = vec4(max(vec3(0.0), color + grano), 1.0);
}
`;

/**
 * Las estrellas del catálogo, una por vértice.
 *
 * ── El brillo ───────────────────────────────────────────────────────────────
 * Lineal en el píxel del centro: `uBrilloEstrellas · 10^(−0,36·(m − 1))`. El
 * exponente físico sería 0,4; con 0,36 la escala se comprime un 10 % y una de
 * magnitud 6 queda a 1/63 de una de magnitud 1 en vez de 1/100, que es lo que
 * separa «apenas se ve» de «no está» contra un fondo de 0,014. Contado a mano con
 * la curva ACES de three y la exposición de la noche (1,13), sobre el fondo:
 *
 *   magnitud 6 → ~28 de 255 (el fondo, ~16)   ·  magnitud 5 → ~48
 *   δ Cru, 2,80 → ~140   ·   Gacrux, 1,63 → ~200   ·   Acrux con α², → ~230
 *   α Cen con α², → ~245
 *
 * El orden de brillo de la Cruz sale con 60 de margen entre Gacrux y δ, y ninguna
 * de las cuatro satura.
 *
 * ── El tamaño ───────────────────────────────────────────────────────────────
 * De 2,5 a 6 px, más grande cuanto más brillante, que es como se lee de un vistazo
 * cuál es cuál. El límite de arriba tiene una cuenta detrás, y conviene tenerla a
 * mano antes de agrandarlos: a 62° de campo y 576 renglones un píxel abarca
 * 2·tan(31°)/576 = 0,1195°, o sea que **medio grado son 4,18 px**, y el banco cuenta
 * como estrella inventada cualquier punto brillante a más de medio grado de toda
 * estrella del catálogo. Con 6 px de punto, la luz de la estrella termina en r = 0,975
 * del radio —ver el perfil en FRAG_ESTRELLAS—, o sea a 2,92 px = 0,35° de su centro;
 * quedan 0,15° para lo que agregan el FXAA, que mezcla con un vecino a 1 px, y el
 * medio píxel de la rejilla con que el banco mide. Entra, pero sin lugar de sobra: si
 * alguna vez hicieran falta puntos más grandes, hay que achicar antes la cola del
 * perfil.
 *
 * Los puntos de 3,6 px que estuvieron acá un rato salieron de una premisa equivocada
 * mía: creí que ese desparramo era el que hacía aparecer puntos inventados en la
 * imagen. No era. Medido por el coordinador apagando las estrellas, los puntos
 * inventados valían lo mismo con estrellas y sin ellas: eran bordes de árbol y de
 * loma suavizados por el FXAA contra el cielo, y su banco los contaba a todos. El
 * orden de brillo de la Cruz, que era el otro motivo, lo arregla la meseta del
 * perfil, y ésa no depende del tamaño.
 *
 * ── Lo que la apaga ─────────────────────────────────────────────────────────
 * - El aire: 0,20 magnitudes por masa de aire, lo de un sitio limpio de montaña.
 *   A 30° de altura se pierden 0,2; a 5°, 1,9; en el horizonte, todas.
 * - El día: `luz·noche² − 2,5·diurno`. El cielo claro se come primero las débiles:
 *   con el sol 3° bajo el horizonte sólo quedan las de magnitud 0 o más, a 6° las de
 *   3, y al sol 8° abajo todas. A pleno día, ninguna.
 * - La luna, por su altura y por su brillo de Allen (`uBrilloLunar`), no por cuánto
 *   disco muestre: alta y llena aclara el cielo y se lleva las de magnitud 5 para
 *   abajo. Medido el 20/2/2025 a las 8 UTC, con la luna a 56° y en cuarto, de las
 *   2438 que están arriba del horizonte sobreviven 2296; con la fracción iluminada
 *   sobrevivían 776.
 * - Las nubes, con la cobertura del domo en esa dirección, y el cubierto entero.
 * - La ceniza, dos veces la densidad del domo: la estrella la atraviesa de ida.
 * - El disco de la luna, que está delante.
 *
 * Una estrella apagada se manda fuera del recorte y no pinta ni un píxel.
 */
const VERT_ESTRELLAS = /* glsl */`
precision highp float;
attribute float aMagnitud;
attribute vec3 aColor;

uniform mat3 uCieloAMundo;
uniform vec3 uSol;
uniform vec3 uLuna;
uniform float uBrilloLunar;
uniform float uNubes;
uniform float uCeniza;
uniform float uTiempo;
uniform vec2 uVientoNubes;
uniform float uBrilloEstrellas;
uniform float uPixel;
uniform float uRadioCielo;

varying vec3 vColor;

const float COS_RADIO_LUNA = ${Math.cos(RADIO_LUNA).toFixed(9)};

${RUIDO_GLSL}
${NUBES_GLSL}

void apagar() {
  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vColor = vec3(0.0);
}

void main() {
  vec3 dir = uCieloAMundo * position;
  float diurno = smoothstep(-0.14, 0.10, normalize(uSol).y);
  if (dir.y < 0.0 || diurno > 0.95) { apagar(); return; }

  // Extinción: la masa de aire de Kasten-Young, la misma del domo.
  //
  // El coseno va con min(): dir es una matriz ortonormal por un vector unitario,
  // pero en float32 el producto puede dar 1,0000001 para una estrella que pase por el
  // cenit, y ahí acos() devuelve NaN. Un NaN acá se lo come todo —la masa de aire,
  // la magnitud, el tamaño del punto y la posición— y un punto sin posición se
  // rasteriza donde el driver quiera: una estrella inventada, lejos de toda estrella
  // del catálogo. Cuesta una instrucción.
  float coseno = min(dir.y, 1.0);
  float masaAire = 1.0 / (coseno + 0.15 * pow(93.885 - acos(coseno) * 57.29578, -1.253));
  float m = aMagnitud + 0.20 * (masaAire - 1.0);
  float luz = uBrilloEstrellas * pow(10.0, -0.36 * (m - 1.0));

  float noche = 1.0 - diurno;
  luz = luz * noche * noche - 2.5 * diurno;
  // La luna lava el cielo con la luz que manda —el brillo de Allen— y no con cuánto
  // disco muestra: con la llena alta se pierden las de magnitud 5, y con el cuarto,
  // que alumbra un 9 %, casi ninguna.
  luz -= 0.05 * max(uLuna.y, 0.0) * uBrilloLunar;

  if (uNubes > 0.01) {
    float d;
    float cobertura = coberturaNubes(dir, d);
    // Una estrella se pierde con mucho menos nube que la que hace falta para verla
    // gris: con cobertura 0,3 ya no está. Y con el cielo cubierto no hay huecos.
    luz *= (1.0 - smoothstep(0.03, 0.30, cobertura)) * (1.0 - smoothstep(0.75, 1.0, uNubes));
  }
  if (uCeniza > 0.001) {
    float densidad = clamp(uCeniza * (0.55 + 0.45 * (1.0 - dir.y)), 0.0, 0.93);
    luz *= (1.0 - densidad) * (1.0 - densidad);
  }
  if (dot(dir, normalize(uLuna)) > COS_RADIO_LUNA) luz = 0.0;
  if (luz < 0.002) { apagar(); return; }

  // Centelleo: más cerca del horizonte, donde la luz cruza más aire revuelto
  float h = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float centelleo = 1.0 + 0.12 * (masaAire - 1.0) / (masaAire + 2.0) * sin(uTiempo * (2.6 + 3.0 * h) + h * 90.0);

  vec4 p = projectionMatrix * modelViewMatrix * vec4(dir * uRadioCielo, 1.0);
  p.z = p.w; // al fondo, como el domo
  gl_Position = p;
  gl_PointSize = clamp(2.5 + 0.7 * (3.5 - m), 2.5, 6.0) * uPixel;
  vColor = aColor * luz * centelleo;
}
`;

const FRAG_ESTRELLAS = /* glsl */`
precision highp float;
varying vec3 vColor;

void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 0.95) discard;
  // Meseta ancha y caída corta, y las dos por el mismo motivo: que el píxel que se
  // mide no dependa de dónde cayó el centro de la estrella dentro de él.
  //
  // Con un gaussiano puro el mejor píxel valía entre la mitad y el total según el
  // subpíxel, y el orden de brillo de la Cruz —Gacrux por encima de δ, Mimosa por
  // encima de Gacrux— dependía de esa lotería. Con la meseta, el mejor píxel de un
  // punto de 2,5 px vale el 97 %.
  //
  // Y la caída termina en r² = 0,95, o sea a 0,975 del radio: en la estrella más
  // brillante, la de 6 px, nada se pinta más allá de 2,92 px de su centro, que a 62°
  // de campo son 0,35° (la cuenta entera está en VERT_ESTRELLAS).
  gl_FragColor = vec4(vColor * (1.0 - smoothstep(0.25, 0.95, r2)), 1.0);
}
`;
