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

    render.clippingPlanes = [r.recorte];
    render.setRenderTarget(r.objetivo);
    render.clear();
    render.render(escena, c);

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
uniform sampler2D uReflejo;
uniform mat4 uMatrizReflejo;
uniform float uFuerzaReflejo;

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
