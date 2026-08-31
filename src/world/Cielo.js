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

export class Cielo {
  constructor(escena, radio = 42000) {
    this.escena = escena;
    this.direccionSol = new THREE.Vector3(0, 1, 0);
    this.direccionLuna = new THREE.Vector3(0, -1, 0);
    this.faseLunar = 0.5;

    this.uniformes = {
      uSol: { value: this.direccionSol },
      uLuna: { value: this.direccionLuna },
      uFaseLunar: { value: 0.5 },
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
    escena.add(this.malla);

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
  }

  /**
   * @param {Date} fecha fecha y hora locales simuladas
   * @param {number} lat
   * @param {number} lon
   */
  actualizar(fecha, lat, lon, tiempo = 0) {
    const { altura, azimut } = posicionSolar(fecha, lat, lon);
    vectorSolar(altura, azimut, this.direccionSol);
    this.alturaSol = altura;

    // La luna va aproximadamente en oposición, desfasada por su fase
    const faseDias = ((fecha.getTime() / 86400000) % 29.53) / 29.53;
    this.faseLunar = faseDias;
    vectorSolar(-altura * 0.85 + 0.3, azimut + Math.PI * (0.6 + faseDias * 0.8), this.direccionLuna);
    this.uniformes.uFaseLunar.value = 0.5 - 0.5 * Math.cos(faseDias * Math.PI * 2);
    this.uniformes.uTiempo.value = tiempo;

    const h = Math.max(-0.18, altura);
    this.factorDia = Math.max(0, Math.sin(h));
    this.factorCrepusculo = Math.exp(-Math.pow(Math.max(0, h) / 0.22, 2))
      * (altura > -0.18 ? 1 : 0);

    this._encenderLuces();
    return this;
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
    const noche = 1 - suave(-0.10, 0.06, solY);
    if (noche > 0.001) {
      const luna = Math.max(0, this.direccionLuna.y) * u.uFaseLunar.value;
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
    const noche = 1 - suave(-0.10, 0.06, this.direccionSol.y);
    const luna = Math.max(0, this.direccionLuna.y) * this.uniformes.uFaseLunar.value;
    const piso = noche * (0.020 + 0.045 * luna);
    salida.setRGB(c[0] + piso * 0.62, c[1] + piso * 0.78, c[2] + piso);

    const ceniza = this.uniformes.uCeniza.value;
    if (ceniza > 0) salida.lerp(CENIZA, ceniza * 0.75);
    return salida;
  }
}

const CENIZA = new THREE.Color(0.42, 0.39, 0.36);

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

const float PI = 3.141592653589793;
// Coeficientes de dispersión Rayleigh en RGB (longitudes de onda 680/550/440 nm)
const vec3 BETA_R = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const vec3 BETA_M = vec3(14.0e-6);

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

// Longitud del camino óptico EN METROS, con la aproximación de Kasten-Young
// para la masa de aire. Los coeficientes BETA están por metro, así que la
// altura de escala también tiene que ir en metros: 8400 m para Rayleigh y
// 1250 m para Mie. Mezclar kilómetros con metros hace explotar el exponente
// y el cielo se vuelve negro.
float caminoOptico(float cosCenit, float alturaEscala) {
  float c = max(cosCenit, 0.0);
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

  // ── Cielo nocturno ────────────────────────────────────────────────────────
  float noche = 1.0 - diurno;
  if (noche > 0.001) {
    // Campo estelar: tres capas de densidad para que no quede plano
    vec3 pe = dir * 260.0;
    float e1 = pow(max(0.0, ruido3(floor(pe) + 0.5) ), 34.0) * 42.0;
    vec3 pe2 = dir * 520.0;
    float e2 = pow(max(0.0, ruido3(floor(pe2) + 0.5)), 52.0) * 26.0;
    float centelleo = 0.82 + 0.18 * sin(uTiempo * 2.6 + hash(floor(pe)) * 90.0);
    float estrellas = (e1 + e2) * centelleo * smoothstep(-0.02, 0.16, alturaVista);

    // La Vía Láctea cruza muy alto en el cielo austral
    float bandaVL = exp(-pow((dot(dir, normalize(vec3(0.42, 0.36, -0.83)))) * 3.1, 2.0));
    float polvo = fbm3(dir * 5.2 + 11.0);
    vec3 viaLactea = vec3(0.52, 0.56, 0.72) * bandaVL * (0.055 + 0.075 * polvo)
                   * smoothstep(0.0, 0.2, alturaVista);

    vec3 cielNoche = vec3(0.008, 0.014, 0.032)
                   + vec3(estrellas) * vec3(0.92, 0.95, 1.0)
                   + viaLactea;

    // Luna: disco con limbo y brillo alrededor
    float cosLuna = dot(dir, normalize(uLuna));
    float discoLuna = smoothstep(0.99955, 0.99985, cosLuna);
    float haloLuna = pow(max(0.0, cosLuna), 320.0) * 0.30;
    float visibleLuna = smoothstep(-0.06, 0.06, uLuna.y) * uFaseLunar;
    cielNoche += (discoLuna * 2.6 + haloLuna) * visibleLuna * vec3(0.95, 0.95, 0.88);

    color = mix(cielNoche, color, diurno);
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
    // Proyección sobre una capa plana: da perspectiva hacia el horizonte
    float t = 0.16 / max(alturaVista, 0.045);
    vec3 p = dir * t;
    vec2 desliz = uVientoNubes * uTiempo * 0.004;
    float d = fbm3(vec3(p.xz * 2.4 + desliz, uTiempo * 0.012));
    float d2 = fbm3(vec3(p.xz * 5.6 - desliz * 1.7, uTiempo * 0.02 + 4.0));
    float cobertura = smoothstep(0.62 - uNubes * 0.45, 0.94 - uNubes * 0.30, d * 0.72 + d2 * 0.28);
    cobertura *= smoothstep(0.0, 0.11, alturaVista);

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
