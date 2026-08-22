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
      uRayleigh: { value: 1.6 },
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

    // Rebote del cielo y del suelo
    this.luzAmbiente = new THREE.HemisphereLight(0x9fc0e8, 0x4a4034, 0.55);
    escena.add(this.luzAmbiente);
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

    // ── Luz solar: color e intensidad según la altura sobre el horizonte
    const h = Math.max(-0.18, altura);
    const dia = Math.max(0, Math.sin(h));
    const crepusculo = Math.exp(-Math.pow(Math.max(0, h) / 0.22, 2));

    const color = new THREE.Color();
    // De rojo profundo en el horizonte a blanco levemente cálido en el cenit
    color.setRGB(
      1.0,
      0.36 + 0.60 * Math.min(1, Math.max(0, (h + 0.06) / 0.42)),
      0.14 + 0.80 * Math.min(1, Math.max(0, (h - 0.02) / 0.46))
    );
    this.luzSol.color.copy(color);
    this.luzSol.intensity = 3.4 * dia + 0.06;
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

    // ── Ambiente: de noche domina la luz lunar, azulada y tenue
    const luzLunar = Math.max(0, this.direccionLuna.y) * this.uniformes.uFaseLunar.value;
    const ambDia = 0.62 * dia;
    const ambNoche = 0.055 + 0.10 * luzLunar;
    this.luzAmbiente.intensity = ambDia + ambNoche;
    this.luzAmbiente.color.setRGB(
      0.35 + 0.30 * dia,
      0.48 + 0.26 * dia,
      0.72 + 0.16 * dia
    );
    this.luzAmbiente.groundColor.setRGB(
      0.16 + 0.14 * dia, 0.14 + 0.12 * dia, 0.11 + 0.09 * dia
    );

    this.factorDia = dia;
    this.factorCrepusculo = crepusculo * (altura > -0.18 ? 1 : 0);
    return this;
  }

  configurarAtmosfera({ turbiedad, nubes, ceniza } = {}) {
    if (turbiedad !== undefined) this.uniformes.uTurbiedad.value = turbiedad;
    if (nubes !== undefined) this.uniformes.uNubes.value = nubes;
    if (ceniza !== undefined) this.uniformes.uCeniza.value = ceniza;
  }

  /** Color de niebla coherente con el cielo cerca del horizonte. */
  colorNiebla(salida = new THREE.Color()) {
    const d = this.factorDia ?? 0;
    const c = this.factorCrepusculo ?? 0;
    salida.setRGB(
      0.10 + 0.52 * d + 0.34 * c,
      0.14 + 0.60 * d + 0.16 * c,
      0.22 + 0.74 * d + 0.04 * c
    );
    const ceniza = this.uniformes.uCeniza.value;
    if (ceniza > 0) salida.lerp(new THREE.Color(0.42, 0.39, 0.36), ceniza * 0.75);
    return salida;
  }
}

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
uniform float uCeniza;
uniform float uNubes;
uniform float uTiempo;
uniform vec2 uVientoNubes;

const float PI = 3.141592653589793;
// Coeficientes de dispersión Rayleigh en RGB (longitudes de onda 680/550/440 nm)
const vec3 BETA_R = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const vec3 BETA_M = vec3(21.0e-6);

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
  float rayleigh = uRayleigh * (1.0 + 0.15 * uTurbiedad);
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

  // Lo que le llega al punto donde se dispersa, tras cruzar la atmósfera desde
  // el sol. Acá nace el rojo del atardecer: con el sol bajo, el camino es tan
  // largo que el azul se extingue por completo y sólo pasa el rojo.
  vec3 luzIncidente = exp(-(betaR * solR + betaM * solM));

  // Dispersión acumulada a lo largo de la vista. Se usa la forma de albedo por
  // (1 - transmitancia): satura hacia el blanco en el horizonte en vez de
  // dispararse al infinito, que es lo que rompía la versión anterior.
  vec3 tauVista = betaR * sR + betaM * sM;
  vec3 albedo = (betaR * faseR + betaM * faseM) / max(betaR + betaM, vec3(1e-9));
  vec3 dispersion = albedo * (1.0 - exp(-tauVista)) * luzIncidente;

  float diurno = smoothstep(-0.14, 0.10, sol.y);
  vec3 color = dispersion * 26.0 * uIntensidad * mix(0.04, 1.0, diurno);

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
    vec3 nubeClara = mix(vec3(0.62, 0.66, 0.72), vec3(1.0, 0.93, 0.84), haciaSol * 0.6);
    vec3 nubeSombra = mix(vec3(0.26, 0.29, 0.35), vec3(0.42, 0.33, 0.32), haciaSol * 0.4);
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
