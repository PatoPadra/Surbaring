/**
 * Agua — superficie de los lagos del Nahuel Huapi.
 *
 * Cada cota de lago genera su propio plano; el fragmento descarta todo lo que no
 * sea agua según la máscara del DEM y todo lo que pertenezca a otro lago, así
 * que el Gutiérrez (808 m) y el Nahuel Huapi (769 m) conviven sin pisarse.
 *
 * El color no es una textura: se calcula por absorción de Beer-Lambert sobre la
 * profundidad real del fondo. Por eso las orillas se ven turquesa y el centro
 * del lago, donde hay 400 m de agua, se ve azul casi negro. El Nahuel Huapi es
 * oligotrófico y muy transparente, y eso se nota.
 */

import * as THREE from 'three';

export class Agua {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   * @param {import('./Cielo.js').Cielo} cielo
   */
  constructor(mundo, cielo) {
    this.mundo = mundo;
    this.cielo = cielo;
    this.mallas = [];
    this.grupo = new THREE.Group();
    this.grupo.name = 'agua';

    // Agrupar los cuerpos detectados por cota (tolerancia de 2 m)
    const niveles = [];
    for (const lago of mundo.meta.lagos) {
      if (lago.areaKm2 < 0.03) continue;
      let g = niveles.find(n => Math.abs(n.cota - lago.cota) < 2);
      if (!g) { g = { cota: lago.cota, nombres: [], area: 0 }; niveles.push(g); }
      g.nombres.push(lago.nombre);
      g.area += lago.areaKm2;
    }
    niveles.sort((a, b) => b.area - a.area);
    // Las cuatro cotas con más superficie cubren prácticamente todo el espejo
    // de agua del parque; sumar más sólo agrega triángulos.
    this.niveles = niveles.slice(0, 4);

    this.uniformesComunes = {
      uTiempo: { value: 0 },
      uSol: { value: cielo.direccionSol },
      uColorSol: { value: new THREE.Color(1, 1, 1) },
      uColorCielo: { value: new THREE.Color(0.35, 0.55, 0.8) },
      uColorHorizonte: { value: new THREE.Color(0.6, 0.7, 0.8) },
      uTexAltura: { value: mundo.texAltura },
      uTexCobertura: { value: mundo.texCobertura },
      uTamanoMundo: { value: mundo.tamano },
      uViento: { value: new THREE.Vector2(0.9, 0.3) },
      uFuerzaOleaje: { value: 0.35 },
      uFactorDia: { value: 1 },
      uCamara: { value: new THREE.Vector3() },
    };

    // Una sola geometría radial compartida por todas las cotas
    this.geometria = construirGrillaRadial(0.6, 26000, 150, 180);

    for (const nivel of this.niveles) {
      this.grupo.add(this._crearPlano(nivel));
    }
  }

  _crearPlano(nivel) {
    const geo = this.geometria;

    const uniformes = {
      ...this.uniformesComunes,
      uCota: { value: nivel.cota },
    };

    // La niebla se resuelve dentro del shader, así que no dejamos que three
    // inyecte la suya: sólo hacen falta los dos uniformes.
    uniformes.fogColor = { value: new THREE.Color() };
    uniformes.fogDensity = { value: 0.00005 };

    const mat = new THREE.ShaderMaterial({
      uniforms: uniformes,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    const malla = new THREE.Mesh(geo, mat);
    malla.position.y = nivel.cota;
    malla.frustumCulled = false;
    malla.renderOrder = 10;
    malla.name = `agua_${nivel.cota.toFixed(0)}`;
    this.mallas.push(malla);
    return malla;
  }

  actualizar(tiempo, camara, estado, escena) {
    this.uniformesComunes.uTiempo.value = tiempo;
    this.uniformesComunes.uColorSol.value.copy(this.cielo.luzSol.color);
    this.uniformesComunes.uFactorDia.value = this.cielo.factorDia ?? 1;
    camara.getWorldPosition(this.uniformesComunes.uCamara.value);

    // La grilla radial viaja con la cámara: así la resolución fina siempre cae
    // donde el jugador está mirando el agua de cerca.
    const cx = this.uniformesComunes.uCamara.value.x;
    const cz = this.uniformesComunes.uCamara.value.z;
    for (const m of this.mallas) {
      m.position.x = cx;
      m.position.z = cz;
    }

    // El oleaje sigue al viento real del clima
    const rad = (estado.direccionViento ?? 270) * Math.PI / 180;
    this.uniformesComunes.uViento.value.set(Math.sin(rad), -Math.cos(rad));
    this.uniformesComunes.uFuerzaOleaje.value =
      Math.min(1.6, 0.12 + (estado.vientoKmh ?? 20) / 55);

    const cielo = this.cielo.colorNiebla();
    this.uniformesComunes.uColorHorizonte.value.copy(cielo);
    this.uniformesComunes.uColorCielo.value.setRGB(
      cielo.r * 0.55, cielo.g * 0.72, cielo.b * 1.0
    );

    // Mantener la niebla de la escena sincronizada en los materiales propios
    for (const m of this.mallas) {
      if (escena?.fog) {
        m.material.uniforms.fogColor.value.copy(escena.fog.color);
        m.material.uniforms.fogDensity.value = escena.fog.density;
      }
    }
  }

  dispose() {
    for (const m of this.mallas) { m.geometry.dispose(); m.material.dispose(); }
  }
}

/**
 * Grilla radial con radios en progresión geométrica: muy densa junto a la
 * cámara (donde las olas se ven y hay que resolverlas) y cada vez más gruesa
 * hacia el horizonte, donde una ola ocupa menos de un píxel.
 */
function construirGrillaRadial(radioMin, radioMax, anillos, sectores) {
  const verts = [];
  const idx = [];

  // Centro
  verts.push(0, 0, 0);

  const razon = Math.pow(radioMax / radioMin, 1 / (anillos - 1));
  for (let a = 0; a < anillos; a++) {
    const r = radioMin * Math.pow(razon, a);
    for (let s = 0; s < sectores; s++) {
      const ang = (s / sectores) * Math.PI * 2;
      verts.push(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    }
  }

  // Abanico del centro al primer anillo
  for (let s = 0; s < sectores; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % sectores);
    idx.push(0, a, b);
  }
  // Bandas entre anillos consecutivos
  for (let a = 0; a < anillos - 1; a++) {
    const base = 1 + a * sectores;
    const sig = 1 + (a + 1) * sectores;
    for (let s = 0; s < sectores; s++) {
      const s2 = (s + 1) % sectores;
      idx.push(base + s, sig + s, base + s2);
      idx.push(base + s2, sig + s, sig + s2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radioMax * 1.1);
  return geo;
}

const VERT = /* glsl */`
uniform float uTiempo;
uniform float uCota;
uniform vec2 uViento;
uniform float uFuerzaOleaje;
uniform sampler2D uTexAltura;
uniform sampler2D uTexCobertura;
uniform float uTamanoMundo;

varying vec3 vMundo;
varying float vProfundidad;
varying float vMascara;
varying vec3 vDesplazamiento;

// Tren de olas de Gerstner: mueve el vértice en la dirección de propagación,
// no sólo hacia arriba. Es lo que da las crestas afiladas y los valles anchos.
vec3 gerstner(vec2 pos, vec2 dir, float amplitud, float longitud, float velocidad, float t) {
  float k = 6.2831853 / longitud;
  float f = k * (dot(dir, pos) - velocidad * t);
  float a = amplitud;
  return vec3(dir.x * a * cos(f), a * sin(f), dir.y * a * cos(f));
}

void main() {
  // La malla acompaña a la cámara: hay que trabajar en coordenadas de mundo.
  vec3 mundoP = (modelMatrix * vec4(position, 1.0)).xyz;
  vec2 mundoXZ = mundoP.xz;

  vec2 uv = mundoXZ / uTamanoMundo + 0.5;
  float fondo = texture2D(uTexAltura, uv).r;
  vec4 cob = texture2D(uTexCobertura, uv);

  vProfundidad = max(0.0, uCota - fondo);
  vMascara = cob.r;

  // En aguas bajas las olas se achican, como en la orilla real
  float atenuacion = smoothstep(0.0, 2.2, vProfundidad);
  float fuerza = uFuerzaOleaje * atenuacion;

  vec2 d1 = normalize(uViento + vec2(0.001));
  vec2 d2 = normalize(uViento + vec2(0.55, -0.42));
  vec2 d3 = normalize(uViento + vec2(-0.62, 0.38));

  vec3 desp = vec3(0.0);
  desp += gerstner(mundoXZ, d1, 0.34 * fuerza, 26.0, 5.2, uTiempo);
  desp += gerstner(mundoXZ, d2, 0.20 * fuerza, 13.5, 3.8, uTiempo);
  desp += gerstner(mundoXZ, d3, 0.11 * fuerza, 6.8, 2.6, uTiempo);
  desp += gerstner(mundoXZ, d1, 0.05 * fuerza, 3.1, 1.8, uTiempo);

  vDesplazamiento = desp;

  // Posición final en el mundo; la cota del lago la fija la matriz del objeto.
  vMundo = vec3(mundoXZ.x + desp.x, uCota + desp.y, mundoXZ.y + desp.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(vMundo, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;

uniform float uTiempo;
uniform float uCota;
uniform vec3 uSol;
uniform vec3 uColorSol;
uniform vec3 uColorCielo;
uniform vec3 uColorHorizonte;
uniform vec2 uViento;
uniform float uFuerzaOleaje;
uniform float uFactorDia;
uniform vec3 uCamara;
uniform vec3 fogColor;
uniform float fogDensity;

varying vec3 vMundo;
varying float vProfundidad;
varying float vMascara;
varying vec3 vDesplazamiento;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
}

/** Normal de las ondas finas, las que el vértice no puede resolver. */
vec3 normalOleaje(vec2 p, float t, float fuerza) {
  vec2 desliz = uViento * t;
  float e = 0.35;
  vec2 q = p * 0.55;
  float h  = ruido(q + desliz * 0.5) * 0.6 + ruido(q * 2.3 - desliz * 0.8) * 0.3 + ruido(q * 5.1 + desliz * 1.4) * 0.1;
  float hx = ruido((q + vec2(e, 0.0)) + desliz * 0.5) * 0.6 + ruido((q + vec2(e,0.0)) * 2.3 - desliz * 0.8) * 0.3 + ruido((q + vec2(e,0.0)) * 5.1 + desliz * 1.4) * 0.1;
  float hz = ruido((q + vec2(0.0, e)) + desliz * 0.5) * 0.6 + ruido((q + vec2(0.0,e)) * 2.3 - desliz * 0.8) * 0.3 + ruido((q + vec2(0.0,e)) * 5.1 + desliz * 1.4) * 0.1;
  float k = 2.4 * fuerza;
  return normalize(vec3((h - hx) * k, 1.0, (h - hz) * k));
}

void main() {
  // Fuera de la máscara del DEM no hay lago, y tampoco si el fondo pertenece
  // a otro cuerpo de agua a distinta cota.
  if (vMascara < 0.5) discard;
  if (vProfundidad < 0.02 || vProfundidad > 520.0) discard;

  vec3 vista = normalize(uCamara - vMundo);
  float fuerza = clamp(uFuerzaOleaje, 0.05, 1.6);
  vec3 N = normalOleaje(vMundo.xz, uTiempo, fuerza);

  // Las olas grandes ya inclinaron la superficie: sumamos esa pendiente
  N = normalize(N + vec3(-vDesplazamiento.x, 0.0, -vDesplazamiento.z) * 0.55);

  float cosVista = clamp(dot(N, vista), 0.0, 1.0);

  // ── Fresnel de Schlick, con índice de refracción del agua (n = 1,33)
  float F0 = 0.02;
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosVista, 5.0);

  // ── Color por absorción: Beer-Lambert sobre la profundidad real.
  // El Nahuel Huapi tiene ~15 m de disco de Secchi: agua muy pura.
  vec3 absorcion = vec3(0.42, 0.09, 0.045);   // el rojo se extingue primero
  float camino = min(vProfundidad, 60.0) * 2.0;
  vec3 transmision = exp(-absorcion * camino);
  vec3 colorFondo = vec3(0.20, 0.24, 0.19);   // sedimento y roca del lecho
  vec3 colorHondo = vec3(0.016, 0.075, 0.125);
  vec3 refraccion = mix(colorHondo, colorFondo * transmision + colorHondo * (1.0 - transmision),
                        smoothstep(14.0, 0.0, vProfundidad));

  // ── Reflexión: el cielo, más oscuro cerca del cenit y claro al horizonte
  vec3 R = reflect(-vista, N);
  float alturaR = clamp(R.y, 0.0, 1.0);
  vec3 reflejo = mix(uColorHorizonte, uColorCielo, pow(alturaR, 0.55));

  // Brillo especular del sol sobre el agua: el reguero de luz del atardecer
  vec3 sol = normalize(uSol);
  float espec = pow(max(0.0, dot(R, sol)), 420.0);
  float destello = pow(max(0.0, dot(R, sol)), 26.0) * 0.11;
  reflejo += uColorSol * (espec * 9.0 + destello) * smoothstep(-0.05, 0.10, sol.y);

  vec3 color = mix(refraccion, reflejo, fresnel);

  // ── Espuma de orilla: donde el agua se hace muy somera y donde rompe la ola
  float orilla = 1.0 - smoothstep(0.0, 1.35, vProfundidad);
  float turbulencia = ruido(vMundo.xz * 1.4 + uTiempo * 0.55) * 0.5
                    + ruido(vMundo.xz * 3.7 - uTiempo * 0.9) * 0.5;
  float espuma = smoothstep(0.44, 0.86, orilla * (0.55 + turbulencia * 0.75));
  // Crestas encabritadas con viento fuerte
  float cresta = smoothstep(0.16, 0.30, vDesplazamiento.y * fuerza) * smoothstep(0.5, 1.1, fuerza);
  espuma = clamp(espuma + cresta * turbulencia * 0.85, 0.0, 1.0);
  color = mix(color, vec3(0.90, 0.93, 0.94) * (0.25 + 0.75 * uFactorDia), espuma * 0.9);

  // Dispersión subsuperficial: la ola se enciende por dentro a contraluz
  float traslucidez = pow(max(0.0, dot(vista, -sol)), 3.0) * smoothstep(0.0, 0.6, vDesplazamiento.y);
  color += vec3(0.05, 0.20, 0.16) * traslucidez * uFactorDia;

  // Transparencia: casi opaco de lejos, translúcido en la orilla
  float alfa = mix(0.62, 0.985, smoothstep(0.0, 2.6, vProfundidad));
  alfa = max(alfa, espuma);

  // ── Niebla exponencial coherente con la escena
  float distancia = length(uCamara - vMundo);
  float factorNiebla = 1.0 - exp(-fogDensity * fogDensity * distancia * distancia);
  color = mix(color, fogColor, clamp(factorNiebla, 0.0, 1.0));

  gl_FragColor = vec4(color, alfa);
}
`;
