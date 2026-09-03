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
      // Reflejo planar: la textura, la matriz que proyecta el mundo sobre ella
      // y un interruptor. Cuando vale 0 el fragmento cae al reflejo del cielo
      // calculado a mano, que es lo que había antes y sigue siendo el respaldo.
      uReflejo: { value: null },
      uMatrizReflejo: { value: new THREE.Matrix4() },
    };

    // Espejo de agua: apagado hasta que alguien llame a `prepararReflejo`.
    this.reflejo = null;
    this.cotaReflejada = null;
    this._cuadro = 0;

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
      // Propio y no compartido: sólo la cota que se está mirando usa el espejo
      uFuerzaReflejo: { value: 0 },
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

    // El cenit NO es un azul inventado.
    //
    // Acá estaba la razón de que el lago pareciera una lámina de plástico
    // celeste. El cenit se armaba multiplicando el color de niebla por
    // (0,55 · 0,72 · 1,00), o sea bajando el rojo casi a la mitad y dejando el
    // azul intacto: pasara lo que pasara en el cielo, el agua reflejaba azul
    // saturado. Medido en `base-alta-manana.png`: el cielo de esa hora es
    // rgb(102,133,117) —verde, con más verde que azul— y el lago debajo salía
    // rgb(31,76,111), con el azul al triple del rojo. El agua devolvía un color
    // que no existía en ninguna parte de la escena, y por eso se leía como un
    // recorte pegado encima en vez de una superficie.
    //
    // El cenit real es el MISMO cielo del horizonte, más oscuro y apenas más
    // frío. Se lo trata así: un escalado casi neutro, con el sesgo al azul
    // reducido de 1,8 a 1,2, que es el orden que tiene un cielo de verdad.
    const cielo = this.cielo.colorNiebla();
    this.uniformesComunes.uColorHorizonte.value.copy(cielo);
    this.uniformesComunes.uColorCielo.value.setRGB(
      cielo.r * 0.48, cielo.g * 0.52, cielo.b * 0.58
    );

    // Mantener la niebla de la escena sincronizada en los materiales propios
    for (const m of this.mallas) {
      if (escena?.fog) {
        m.material.uniforms.fogColor.value.copy(escena.fog.color);
        m.material.uniforms.fogDensity.value = escena.fog.density;
      }
    }
  }

  // ── Reflejo planar ────────────────────────────────────────────────────────

  /**
   * Enciende el espejo. `escala` es la fracción de la resolución de pantalla a
   * la que se dibuja el reflejo: 0 lo apaga.
   *
   * Por qué un reflejo de verdad y no más cielo procedural: en un lago de
   * montaña lo que más se ve reflejado no es el cielo sino el cerro de
   * enfrente. El agua devolvía un degradé azul incluso con el Catedral al
   * frente, y eso —más que las olas o la espuma— era lo que la delataba como
   * una superficie pintada.
   *
   * El costo es dibujar la escena dos veces, así que se abarata por todos
   * lados: a una fracción de la resolución, un cuadro sí y uno no, y sólo para
   * una cota de lago —la que el jugador está mirando—. Las demás siguen con el
   * reflejo del cielo, que a la distancia a la que quedan no se distingue.
   */
  prepararReflejo(render, escala = 0.45) {
    if (!escala) {
      this.reflejo?.objetivo.dispose();
      this.reflejo = null;
      this.uniformesComunes.uReflejo.value = null;
      for (const m of this.mallas) m.material.uniforms.uFuerzaReflejo.value = 0;
      return;
    }
    const tam = new THREE.Vector2();
    render.getSize(tam);
    const ancho = Math.max(64, Math.round(tam.x * escala));
    const alto = Math.max(64, Math.round(tam.y * escala));
    if (this.reflejo && this.reflejo.ancho === ancho && this.reflejo.alto === alto) return;

    this.reflejo?.objetivo.dispose();
    const objetivo = new THREE.WebGLRenderTarget(ancho, alto, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      // Ocho bits por canal alcanzan: el reflejo se muestrea distorsionado por
      // el oleaje y se mezcla al 86 %, así que la banda extra de un flotante no
      // se vería y sí se pagaría en memoria y en ancho de banda.
      colorSpace: THREE.NoColorSpace,
    });
    this.reflejo = {
      objetivo, ancho, alto,
      camara: new THREE.PerspectiveCamera(),
      plano: new THREE.Plane(),
      recorte: new THREE.Plane(),
      matriz: new THREE.Matrix4(),
      // Del espacio de recorte al de textura: x,y de [-1,1] a [0,1]
      aTextura: new THREE.Matrix4().set(
        0.5, 0, 0, 0.5,
        0, 0.5, 0, 0.5,
        0, 0, 0.5, 0.5,
        0, 0, 0, 1
      ),
    };
    this.uniformesComunes.uReflejo.value = objetivo.texture;
  }

  /**
   * Dibuja el espejo del cuadro. Se llama antes del pase principal.
   * @param {THREE.WebGLRenderer} render
   * @param {THREE.Scene} escena
   * @param {THREE.PerspectiveCamera} camara
   */
  dibujarReflejo(render, escena, camara) {
    const r = this.reflejo;
    if (!r) return;

    // Un cuadro sí y uno no: el agua se mueve, pero el cerro reflejado no, y a
    // 30 Hz el reflejo no se nota atrasado.
    this._cuadro++;
    if (this._cuadro % 2 === 0) return;

    const ojo = new THREE.Vector3();
    camara.getWorldPosition(ojo);

    // Qué lago está mirando el jugador. Elegir "la cota más cercana por debajo
    // del ojo" parecía razonable y era falso: parado en una ladera a 838 m
    // elegía el laguito de 835 que no se ve, mientras el Nahuel Huapi ocupaba
    // media pantalla. Así que se pregunta lo mismo que responde el shader:
    // se camina el rayo de vista, se busca el primer punto que la máscara del
    // DEM marca como agua, y se toma la cota más baja que lo cubre.
    const cota = this._cotaMirada(camara, ojo);
    if (cota === null) { this._apagarReflejo(); return; }
    // Desde muy arriba el espejo aporta poco y el plano se ve casi de canto
    if (ojo.y - cota > 900) { this._apagarReflejo(); return; }
    this.cotaReflejada = cota;

    // Cámara espejada respecto del plano y = cota
    const c = r.camara;
    c.copy(camara);
    c.position.copy(ojo);
    c.position.y = 2 * cota - ojo.y;
    const objetivo = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camara.getWorldQuaternion(new THREE.Quaternion()))
      .add(ojo);
    objetivo.y = 2 * cota - objetivo.y;
    c.up.set(0, -1, 0);          // el reflejo invierte el sentido del arriba
    c.lookAt(objetivo);
    c.up.set(0, 1, 0);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();

    // Matriz que lleva un punto del mundo a las coordenadas de la textura
    r.matriz.copy(r.aTextura)
      .multiply(c.projectionMatrix)
      .multiply(c.matrixWorldInverse);
    this.uniformesComunes.uMatrizReflejo.value.copy(r.matriz);

    // Todo lo que está bajo el agua no puede aparecer en el reflejo: el fondo
    // del lago reflejado sobre su propia superficie es el artefacto clásico.
    r.recorte.set(new THREE.Vector3(0, 1, 0), -cota + 0.15);

    const recortePrevio = render.clippingPlanes;
    const objetivoPrevio = render.getRenderTarget();
    const nieblaPrevia = escena.fog;
    const visibles = this.mallas.map(m => m.visible);
    for (const m of this.mallas) m.visible = false;

    // Las cascadas de sombra NO se rehacen para el espejo. CSM arma sus
    // volúmenes desde la cámara del jugador, que no se movió: dibujar el reflejo
    // volvía a llenar los cuatro mapas —terreno con desplazamiento en el
    // vértice, veintiséis lotes de follaje con recorte por alfa, la fauna, el
    // cuerpo— para escribir exactamente lo mismo. Era el pase más caro del
    // cuadro, duplicado a cambio de nada.
    const autoPrevio = render.shadowMap.autoUpdate;
    render.shadowMap.autoUpdate = false;

    render.clippingPlanes = [r.recorte];
    render.setRenderTarget(r.objetivo);
    render.clear();
    render.render(escena, c);

    render.shadowMap.autoUpdate = autoPrevio;
    render.setRenderTarget(objetivoPrevio);
    render.clippingPlanes = recortePrevio;
    escena.fog = nieblaPrevia;
    this.mallas.forEach((m, i) => { m.visible = visibles[i]; });

    // Sólo la cota reflejada usa la textura; las otras siguen con el cielo
    for (const m of this.mallas) {
      m.material.uniforms.uFuerzaReflejo.value =
        Math.abs(m.material.uniforms.uCota.value - cota) < 0.5 ? 1 : 0;
    }
  }

  /**
   * Cota del cuerpo de agua que la cámara tiene delante, o null si no hay.
   * Doce muestras en progresión: fina cerca, gruesa lejos.
   */
  _cotaMirada(camara, ojo) {
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camara.getWorldQuaternion(new THREE.Quaternion()));
    const paso = [12, 28, 50, 85, 140, 220, 340, 500, 700, 950, 1250, 1600];
    for (const d of paso) {
      const x = ojo.x + dir.x * d;
      const z = ojo.z + dir.z * d;
      if (!this.mundo.esAgua(x, z)) continue;
      // La cota que corresponde a este punto es la que más se parece a la
      // superficie que el DEM marca ahí, no la primera que alcance a cubrirlo.
      const altura = this.mundo.superficieEn(x, z);
      let mejor = null, mejorD = 8;
      for (const n of this.niveles) {
        if (n.cota > ojo.y - 0.05) continue;      // el ojo está debajo de esa agua
        const dd = Math.abs(n.cota - altura);
        if (dd < mejorD) { mejor = n.cota; mejorD = dd; }
      }
      if (mejor !== null) return mejor;
    }
    return null;
  }

  _apagarReflejo() {
    for (const m of this.mallas) m.material.uniforms.uFuerzaReflejo.value = 0;
  }

  dispose() {
    for (const m of this.mallas) { m.geometry.dispose(); m.material.dispose(); }
    this.reflejo?.objetivo.dispose();
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

// AVISO: el render usa logarithmicDepthBuffer. Un ShaderMaterial propio que no
// incluya los chunks de log-depth escribe una profundidad que NO se compara con
// la del resto de la escena, y el resultado es que la superficie entra y sale
// contra el terreno a medida que se mueve la cámara. No hay error en consola:
// sólo parpadea. Es el mismo defecto que ya estaba documentado en Clima.js.
const VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
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
  vec2 relieve = texture2D(uTexAltura, uv).rg;
  float fondo = relieve.r;          // el lecho, ya excavado
  float superficie = relieve.g;     // la cota del espejo que marca el DEM
  vec4 cob = texture2D(uTexCobertura, uv);

  vProfundidad = max(0.0, uCota - fondo);
  // Cada plano dibuja su propio cuerpo y nada más. Antes los distinguía la
  // profundidad —el plano del Mascardi caía casi al ras del Nahuel Huapi y se
  // descartaba solo—, pero eso dejó de ser cierto al excavar los lechos: sin
  // esta comparación, el plano del lago de arriba tapa el cielo del de abajo.
  vMascara = cob.r * step(abs(uCota - superficie), 3.0);

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
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */`
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>

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
uniform sampler2D uReflejo;
uniform mat4 uMatrizReflejo;
uniform float uFuerzaReflejo;
// El DEM, para saber si el rayo reflejado se topa con el cerro de enfrente.
// Ya estaban atados en uniformesComunes para el vértice; sólo faltaba declararlos.
uniform sampler2D uTexAltura;
uniform float uTamanoMundo;

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
  // La profundidad logarítmica se ESCRIBE acá, y sin esta línea el lago entero
  // desaparece del juego.
  //
  // El arreglo del parpadeo le puso a este shader tres de los cuatro chunks:
  // las dos declaraciones y el del vértice. Faltaba éste, que es el que
  // realmente escribe gl_FragDepth. Sin él la superficie declaraba las varyings
  // y después dejaba la profundidad interpolada estándar, incomparable con la
  // logarítmica que escribe el terreno: el agua perdía la prueba de profundidad
  // contra SU PROPIO FONDO y no se dibujaba nunca. Lo que se veía en su lugar
  // era el lecho del lago, que el shader del terreno pinta de gris pardo, y por
  // eso el Nahuel Huapi parecía un descampado.
  //
  // Se descubrió apagando el terreno y viendo aparecer el lago entero debajo.
  #include <logdepthbuf_fragment>

  // Fuera de la máscara del DEM no hay lago, y tampoco si el fondo pertenece
  // a otro cuerpo de agua a distinta cota.
  if (vMascara < 0.5) discard;
  if (vProfundidad < 0.02 || vProfundidad > 520.0) discard;

  vec3 vista = normalize(uCamara - vMundo);
  float fuerza = clamp(uFuerzaOleaje, 0.05, 1.6);

  // La normal del oleaje se aplana con la distancia, y esto no es un ajuste
  // estético: es lo que hace que el lago tenga color.
  //
  // El ruido perturbaba la normal con pendientes de ±16° en CADA fragmento, a
  // cualquier distancia. En el horizonte cosVista tendría que valer ~0,02 y
  // dar un Fresnel de ~0,9 —el agua a ángulo rasante es un espejo—, pero con la
  // normal bamboleando al azar el promedio subía a 0,2 y el Fresnel se caía a
  // 0,25. Toda la reflexión quedaba apagada: el cielo, el espejo del cerro, el
  // reguero del sol. Mandaba la refracción, que a cuatrocientos metros de agua
  // es casi negra. De ahí salían las dos cosas raras del lago: que fuera un
  // gris pardo sin color, y que se OSCURECIERA hacia el horizonte en vez de
  // encenderse.
  //
  // Además el ruido tiene un período de ~1,8 m: a quinientos metros es subpíxel
  // y hormiguea. Aplanarlo arregla el color, arregla el aliasing y de paso
  // saltea nueve evaluaciones de ruido en toda la mitad lejana del lago.
  // La banda de transición se acorta de 80–1200 m a 60–420 m.
  //
  // Con el lóbulo especular ancho de más abajo, la franja donde la normal
  // TODAVÍA lleva ruido de período 1,8 m pero ya está muy por debajo de un
  // píxel se llenó de destellos sueltos: el lago del medio campo quedaba como
  // papel de aluminio. Es el mismo aliasing que el aplanado venía a resolver,
  // sólo que ahora se dispara mucho más seguido porque el lóbulo perdona más.
  // Achicar la banda lo apaga, deja el medio campo en manos del lóbulo ancho
  // —que es liso por construcción— y de paso saltea nueve evaluaciones de ruido
  // en bastante más pantalla que antes.
  float distOjo = length(uCamara - vMundo);
  float nitidez = 1.0 - smoothstep(60.0, 420.0, distOjo);

  vec3 N = vec3(0.0, 1.0, 0.0);
  if (nitidez > 0.01) {
    N = normalOleaje(vMundo.xz, uTiempo, fuerza * nitidez);
    N = normalize(N + vec3(-vDesplazamiento.x, 0.0, -vDesplazamiento.z) * 0.55 * nitidez);
  }

  float cosVista = clamp(dot(N, vista), 0.0, 1.0);

  // ── Fresnel de Schlick, con índice de refracción del agua (n = 1,33)
  float F0 = 0.02;
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosVista, 5.0);

  // ── Color por absorción: Beer-Lambert sobre la profundidad real.
  // El Nahuel Huapi tiene ~15 m de disco de Secchi: agua muy pura.
  vec3 absorcion = vec3(0.42, 0.09, 0.045);   // el rojo se extingue primero
  float camino = min(vProfundidad, 60.0) * 2.0;
  vec3 transmision = exp(-absorcion * camino);

  // Los dos colores de abajo son ALBEDOS —cuánto devuelven el lecho y la masa de
  // agua—, no colores de pantalla, y por lo tanto hay que multiplicarlos por la
  // luz del momento.
  //
  // Sin esto aparecía un defecto muy delator, que encontró el agente luz en su
  // captura de crepúsculo: a las 20:40 los lagos del FONDO tomaban el rosa del
  // poniente y el de ADELANTE seguía celeste de mediodía. No era casualidad. El
  // lago lejano se ve rasante, ahí manda el reflejo, y el reflejo sí sigue al
  // cielo; el de adelante se ve empinado, ahí manda la refracción, y la
  // refracción era una constante clavada. Dos aguas del mismo lago con dos horas
  // distintas es peor que cualquiera de las dos por separado.
  //
  // Se separa en tinte y nivel a propósito. El TINTE sale normalizado por su
  // propio brillo, así que aporta color y no exposición: el nivel del agua lo
  // sigue fijando la absorción, que es lo que corresponde. Y el NIVEL cuelga de
  // uFactorDia y no del color de niebla, porque colorNiebla() ya no está acotado
  // a 1 —luz lo dejó llegar a ~1,28 al mediodía para que la perspectiva aérea
  // converja a la radiancia real— y colgar de él ataría el brillo del lago a una
  // escala que no es mía y puede volver a moverse.
  vec3 luzAgua = uColorHorizonte * 0.55 + uColorSol * uFactorDia * 0.28;
  float brilloAgua = max(dot(luzAgua, vec3(0.2126, 0.7152, 0.0722)), 0.02);
  vec3 tinteAgua = mix(vec3(1.0), luzAgua / brilloAgua, 0.80);
  float nivelAgua = 0.12 + 0.88 * clamp(uFactorDia * 1.15, 0.0, 1.0);
  vec3 luzEnAgua = tinteAgua * nivelAgua;

  vec3 colorFondo = vec3(0.20, 0.24, 0.19) * luzEnAgua;   // sedimento y roca del lecho
  vec3 colorHondo = vec3(0.016, 0.075, 0.125) * luzEnAgua;
  vec3 refraccion = mix(colorHondo, colorFondo * transmision + colorHondo * (1.0 - transmision),
                        smoothstep(14.0, 0.0, vProfundidad));

  // Dispersión de volumen. El agua clara y profunda NO es negra: dispersa.
  //
  // Sin esto, mirar el lago desde arriba daba rgb(1,2,3) —negro medido, no una
  // impresión—: con la vista empinada el Fresnel vale 0,02, así que manda la
  // refracción, y pasados 14 m de fondo la refracción era la constante
  // colorHondo y nada más. El término satura con el camino óptico, así que la
  // orilla somera no se toca —ahí sigue mandando la absorción, que ya da el
  // turquesa— y el centro del lago se llena de un verde-azul apagado en vez de
  // un agujero negro. Es el mismo integral de in-scattering de siempre,
  // resuelto en forma cerrada porque el medio es homogéneo.
  refraccion += vec3(0.032, 0.088, 0.082) * luzAgua * (1.0 - exp(-camino * 0.055));

  // ── Reflexión ────────────────────────────────────────────────────────────
  vec3 R = reflect(-vista, N);
  float alturaR = clamp(R.y, 0.0, 1.0);

  // Un lago de montaña mirado rasante NO refleja cielo: refleja el cerro de
  // enfrente, que está en sombra y es oscuro. Reflejar cielo ahí es lo que hacía
  // que el agua se ENCENDIERA justo donde tendría que apagarse.
  //
  // Pero oscurecer con una constante tampoco sirve, y eso ya se probó acá: el
  // lago pasaba de ser una lámina celeste a ser una lámina gris, que es el mismo
  // defecto con otro color. Un espejo tiene que DEVOLVER algo; si lo que
  // devuelve es plano, sigue siendo pintura.
  //
  // Así que la silueta se saca del DEM, con UNA sola muestra y sin trazado: se
  // avanza el rayo reflejado una distancia fija y se pregunta si el terreno de
  // ese punto está por encima de la altura a la que el rayo llegó. Donde el
  // cerro tapa, el reflejo es ladera en sombra; donde el rayo se escapa por
  // arriba de la cresta —o donde enfrente hay lago abierto y no montaña—, es
  // cielo. Sale una línea de cumbres reflejada que sigue al relieve de verdad.
  //
  // Es el reemplazo barato del espejo planar, que en la placa de destino está
  // apagado (reflejoAgua = 0 en los presets baja y mínima), o sea que ES lo que
  // ve el jugador. Cuesta una lectura de textura, y sólo en píxeles de agua.
  vec2 pRef = vMundo.xz + R.xz * 1200.0;
  float hRef = texture2D(uTexAltura, pRef / uTamanoMundo + 0.5).r;
  float tapa = smoothstep(-60.0, 80.0, hRef - (vMundo.y + R.y * 1200.0));

  // El cerro reflejado no es negro: es ladera vista a través de la misma bruma
  // que el resto de la escena. Se lo tiñe con el color de niebla en vez de
  // apagarlo a cero, y se lo aclara un poco hacia arriba, que es como se ve una
  // ladera contra el cielo.
  vec3 ribera = uColorHorizonte * (0.17 + 0.45 * clamp(alturaR * 3.5, 0.0, 1.0));

  // El degradé del cielo lo manda el HORIZONTE, que es el color de niebla y por
  // lo tanto integra con el resto de la escena. Con el exponente 0,55 de antes,
  // a 20° de elevación el cenit ya pesaba más de la mitad, y el cenit era el
  // azul inventado: bastaba mirar el agua un poco de arriba para que se pusiera
  // celeste. Con 1,15 el horizonte manda hasta bien alto, que además es como se
  // ve un cielo de verdad desde el agua.
  // ── Rachas de viento: la estructura que le faltaba al lago lejano.
  //
  // Pasados 420 m la normal se aplana a (0,1,0) exacta. Ese aplanado es
  // correcto y no se toca: el ruido de período 1,8 m ahí es subpíxel y
  // hormiguea. Pero deja al agua lejana con UNA sola fuente de variación —el
  // reguero del sol—, y el reguero sólo existe mirando hacia el sol. En
  // cualquier otra dirección el lago vuelve a ser un degradé liso. Medido
  // reimplementando este mismo camino en Node: la desviación de luminancia del
  // agua abierta a más de 420 m era **cero exacto**, a cualquier distancia.
  //
  // Y eso importa más de lo que parece en la placa de destino: el Nahuel Huapi
  // es enorme y el reflejo planar está APAGADO en Baja y Mínima (reflejoAgua = 0,
  // medido: cuesta 0,0 ms). O sea que casi toda el agua que el dueño ve de
  // verdad es agua de más de 420 m sin espejo, resuelta sólo por este camino.
  //
  // Lo que un lago tiene a esa distancia no son olas: son rachas, los manchones
  // de agua rizada y agua vidriada de cientos de metros que dibuja el viento.
  // Se modelan como RUGOSIDAD y no como geometría, y ahí está el punto: la
  // rugosidad es un escalar de baja frecuencia —período ~285 m— así que no
  // puede caer por debajo del píxel ni hormiguear por lejos que se mire. Es el
  // detalle que faltaba, resuelto por el único lado que no reintroduce el
  // aliasing que el aplanado vino a matar.
  float lejos = 1.0 - nitidez;
  float rugosidad = 0.0;
  if (lejos > 0.01) {
    // Dos escalas y un arrastre lento: las rachas cruzan el lago con el viento.
    vec2 deriva = uViento * uTiempo * 0.0016;
    rugosidad = ruido(vMundo.xz * 0.0035 + deriva) * 0.66
              + ruido(vMundo.xz * 0.0091 - deriva * 1.7) * 0.34;
    // Umbral alto a propósito: se busca la VETA, no un moteado parejo. Entre
    // manchón y manchón el agua queda vidriada, que es como se ve de verdad.
    //
    // Ojo con el «* lejos»: es lo que garantiza que esto valga CERO en el campo
    // cercano y que ahí no cambie un solo píxel de lo que ya estaba calibrado.
    // Las olas de cerca ya tienen su normal de verdad; la racha es el sustituto
    // de lo que se pierde al aplanarla, no un agregado encima.
    rugosidad = smoothstep(0.40, 0.74, rugosidad) * lejos;
  }

  // Dónde entra la racha, que es la parte que costó acertar.
  //
  // El primer intento la mezclaba contra el color de horizonte y casi no se
  // veía: medido, ±0,4 % de luminancia. La razón es que mirando rasante el domo
  // reflejado YA es color de horizonte, así que mezclar hacia el horizonte no
  // mueve nada. Donde sí hay contraste que romper es en la SILUETA DEL CERRO:
  // la ladera reflejada es mucho más oscura que el cielo, y lo que hace el agua
  // rizada es justamente romper esa imagen. Por eso la racha entra bajando
  // «tapa» —el manchón de viento borronea el cerro reflejado— y subiendo la
  // elevación efectiva del rayo, porque una superficie rizada devuelve un
  // pedazo más ancho de cielo y no un punto.
  float alturaRacha = mix(alturaR, mix(alturaR, 0.34, 0.48), rugosidad);
  tapa *= 1.0 - rugosidad * 0.40;

  vec3 domo = mix(uColorHorizonte, uColorCielo, pow(alturaRacha, 1.15));
  vec3 reflejo = mix(domo, ribera, tapa);

  // ── Espejo planar: el cerro de enfrente, que es lo que un lago de montaña
  // devuelve de verdad. Se proyecta el punto del agua sobre la textura que se
  // dibujó desde la cámara espejada y se desplaza la muestra con la pendiente
  // de la ola: sin ese corrimiento el reflejo queda rígido, como una foto
  // pegada al agua en vez de una imagen que el oleaje rompe.
  if (uFuerzaReflejo > 0.0) {
    vec4 proy = uMatrizReflejo * vec4(vMundo, 1.0);
    vec2 uvR = proy.xy / max(proy.w, 0.0001);
    vec2 chapoteo = vec2(N.x, N.z) * 0.055 * clamp(fuerza, 0.2, 1.2);
    // Cerca la ola distorsiona mucho; lejos, casi nada: si no, el reflejo del
    // horizonte hierve.
    chapoteo *= smoothstep(320.0, 12.0, length(uCamara - vMundo));
    vec2 uvD = clamp(uvR + chapoteo, vec2(0.002), vec2(0.998));
    vec3 espejo = texture2D(uReflejo, uvD).rgb;

    // Fuera de la pantalla no hay nada que reflejar: ahí manda el cielo. El
    // desvanecido en los bordes evita el corte duro que delata la técnica.
    vec2 borde = smoothstep(0.0, 0.09, uvR) * smoothstep(0.0, 0.09, 1.0 - uvR);
    float valido = borde.x * borde.y * step(0.0, proy.w);
    reflejo = mix(reflejo, espejo, valido * uFuerzaReflejo * 0.86);
  }

  // Brillo especular del sol: el reguero de luz que quiebra la superficie.
  //
  // El lóbulo se ENSANCHA con la distancia, y ésa es la pieza que faltaba para
  // que el agua lejana dejara de ser un papel pintado.
  //
  // Pasados ~1200 m la normal se aplana a (0,1,0) exacto —arreglo correcto, no
  // se toca: el ruido de período 1,8 m hormiguea y arruina el promedio del
  // Fresnel—. Pero aplanar la normal no hace desaparecer las olas: hace
  // desaparecer la única huella que dejaban. Un espejo perfecto con un lóbulo de
  // exponente 420 devuelve el sol en un círculo de menos de un píxel, así que a
  // la distancia no había NADA: ni reguero, ni destello, ni superficie.
  //
  // La pendiente de la ola sigue existiendo aunque no se resuelva; lo que
  // corresponde es tratarla como rugosidad y no como geometría. Ensanchar el
  // lóbulo es exactamente ese mismo fenómeno en estadística, y cuesta una
  // interpolación: ni una lectura de textura ni una octava de ruido más.
  vec3 sol = normalize(uSol);
  float rd = max(0.0, dot(R, sol));
  // El manchón rizado ensancha el lóbulo y el vidriado lo cierra: es la misma
  // rugosidad de arriba entrando por donde de verdad se nota, que es el ancho
  // del reguero. Un lago con viento tiene el reguero deshilachado en las vetas
  // y afilado entre ellas, y eso es lo que hace que el reguero se lea como
  // superficie y no como una mancha pintada.
  // Los dos factores de racha valen EXACTAMENTE 1 cuando «rugosidad» es 0, que
  // es todo el campo cercano: así el reguero de cerca queda como estaba, y lo
  // que se agrega es sólo lo que antes no existía.
  float anchoRacha = 1.0 - rugosidad * 0.45;      // la veta rizada deshilacha
  float brilloRacha = 1.0 - rugosidad * 0.22;     // y reparte la misma energía
  float dureza = mix(34.0, 420.0, nitidez) * anchoRacha;
  float espec = pow(rd, dureza);
  float destello = pow(rd, 11.0) * 0.13;
  // La intensidad baja cuando el lóbulo se ensancha: un lóbulo ancho reparte la
  // misma energía en más ángulo. Sin esa compensación el reguero lejano se
  // quemaba a blanco. Vale igual para el ensanchado por racha.
  reflejo += uColorSol * (espec * mix(1.9, 6.5, nitidez) * brilloRacha + destello)
           * smoothstep(-0.05, 0.10, sol.y);

  vec3 color = mix(refraccion, reflejo, fresnel);

  // ── Espuma de orilla: donde el agua se hace muy somera y donde rompe la ola
  float orilla = 1.0 - smoothstep(0.0, 1.35, vProfundidad);
  float turbulencia = ruido(vMundo.xz * 1.4 + uTiempo * 0.55) * 0.5
                    + ruido(vMundo.xz * 3.7 - uTiempo * 0.9) * 0.5;
  float espuma = smoothstep(0.44, 0.86, orilla * (0.55 + turbulencia * 0.75));

  // Resaca: la línea de espuma sube y baja con la ola en vez de quedar clavada
  // a una profundidad fija. Es el detalle que hace que la orilla respire; sin
  // él la costa parece dibujada con un fibrón a la misma altura siempre.
  float vaiven = sin(uTiempo * 0.62 + ruido(vMundo.xz * 0.09) * 6.28) * 0.5 + 0.5;
  float lengua = 1.0 - smoothstep(0.0, 0.35 + vaiven * 0.75 * fuerza, vProfundidad);
  espuma = max(espuma, smoothstep(0.35, 0.9, lengua * (0.6 + turbulencia * 0.6)));

  // Crestas encabritadas con viento fuerte
  float cresta = smoothstep(0.16, 0.30, vDesplazamiento.y * fuerza) * smoothstep(0.5, 1.1, fuerza);
  espuma = clamp(espuma + cresta * turbulencia * 0.85, 0.0, 1.0);
  color = mix(color, vec3(0.90, 0.93, 0.94) * (0.25 + 0.75 * uFactorDia), espuma * 0.9);

  // Dispersión subsuperficial: la ola se enciende por dentro a contraluz
  float traslucidez = pow(max(0.0, dot(vista, -sol)), 3.0) * smoothstep(0.0, 0.6, vDesplazamiento.y);
  color += vec3(0.05, 0.20, 0.16) * traslucidez * uFactorDia;

  // Transparencia: casi opaco de lejos, translúcido en la orilla.
  //
  // El alfa mínimo era 0,62, y con eso el bajo fondo tapaba la piedra mojada:
  // el lago terminaba en un canto duro contra la costa. Bajarlo a 0,18 en los
  // primeros centímetros deja ver el lecho a través del agua y la línea de
  // orilla se convierte en una transición y no en un recorte. La curva arranca
  // más abajo (1,8 m en vez de 2,6) para que el tramo translúcido sea angosto y
  // el cuerpo del lago siga siendo opaco.
  float alfa = mix(0.18, 0.985, smoothstep(0.0, 1.8, vProfundidad));
  alfa = max(alfa, espuma);

  // ── Niebla exponencial coherente con la escena
  float distancia = length(uCamara - vMundo);
  // Misma ley lineal que el resto de la escena (ver main.js): si acá quedara la
  // cuadrática, el agua y la costa se separarían con un escalón visible.
  float factorNiebla = 1.0 - exp(-fogDensity * distancia);
  color = mix(color, fogColor, clamp(factorNiebla, 0.0, 1.0));

  gl_FragColor = vec4(color, alfa);
}
`;
