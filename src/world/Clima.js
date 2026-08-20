/**
 * Clima visible — lluvia, nieve, granizo, ceniza, rayos y humo de incendio.
 *
 * Hasta acá el clima existía en los números y en el color del cielo, pero no se
 * veía caer nada. Este módulo lo dibuja, con tres decisiones que importan:
 *
 * - **La precipitación viaja con la cámara.** Las partículas viven en una caja
 *   de 60 m que sigue al jugador y se reciclan al salir por abajo. Dibujar
 *   lluvia en 65 km de mundo no tiene sentido: sólo se ve la que pasa cerca.
 * - **La lluvia son segmentos, no puntos.** Una gota vista de costado es una
 *   raya, y su largo depende de la velocidad de caída y del viento. Con puntos
 *   redondos parece nieve sucia.
 * - **El viento la inclina de verdad.** La dirección y la fuerza salen del
 *   mismo estado que mueve las nubes y enfría al jugador, así que la lluvia
 *   cruzada del oeste y la calma de una nevada se ven distintas.
 *
 * El rayo no es una textura: es un golpe de luz. Se sube la intensidad de las
 * cascadas y la del cielo por unos cuadros, que es lo que hace un relámpago de
 * verdad —iluminar el paisaje entero desde arriba— y cuesta nada.
 */

import * as THREE from 'three';

const CAJA = 62;          // arista de la caja de partículas, en metros
const GOTAS = 4200;
const COPOS = 1800;
const CENIZAS = 1400;

// AVISO: el render usa logarithmicDepthBuffer, y un ShaderMaterial propio que
// no incluya los chunks de log-depth escribe una profundidad que no se
// corresponde con la del resto de la escena. El resultado es que el terreno se
// come las partículas y no se ve caer nada, sin ningún error en consola. Es el
// mismo patrón que los tres defectos de shader documentados en el README.
const VERT_LLUVIA = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uLargo;
  uniform vec3 uViento;
  attribute float aExtremo;   // 0 cabeza, 1 cola
  attribute float aVel;
  varying float vAlfa;
  void main() {
    vec3 p = position;
    // La cola se estira hacia atrás siguiendo la velocidad real de la gota
    vec3 dir = normalize(vec3(uViento.x, -1.0, uViento.z));
    p -= dir * aExtremo * uLargo * aVel;
    vAlfa = 1.0 - aExtremo * 0.75;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const FRAG_LLUVIA = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform float uOpacidad;
  varying float vAlfa;
  void main() {
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(uColor, vAlfa * uOpacidad);
  }
`;

const VERT_PARTICULA = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uTam;
  uniform float uEscalaPantalla;
  attribute float aTam;
  varying float vAlfa;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTam * aTam * uEscalaPantalla / max(1.0, -mv.z);
    vAlfa = 1.0;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG_PARTICULA = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform float uOpacidad;
  varying float vAlfa;
  void main() {
    #include <logdepthbuf_fragment>
    // Copo redondo y con borde suave: un cuadrado se nota enseguida
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float borde = smoothstep(0.25, 0.06, r);
    gl_FragColor = vec4(uColor, borde * uOpacidad * vAlfa);
  }
`;

export class Clima {
  constructor(escena, render) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'clima';
    this.grupo.frustumCulled = false;
    escena.add(this.grupo);
    this.render = render;

    this.destello = 0;         // 0..1, lo lee el bucle para la exposición
    this._proximoRayo = 0;
    this._t = 0;

    this.lluvia = this._crearLluvia();
    this.nieve = this._crearParticulas(COPOS, 0xf2f6fb, 26, 'nieve');
    this.granizo = this._crearParticulas(700, 0xdfe9f2, 34, 'granizo');
    this.ceniza = this._crearParticulas(CENIZAS, 0x9a9086, 15, 'ceniza');

    this.humo = this._crearHumo();
  }

  // ── Construcción ──────────────────────────────────────────────────────────

  _crearLluvia() {
    const pos = new Float32Array(GOTAS * 2 * 3);
    const ext = new Float32Array(GOTAS * 2);
    const vel = new Float32Array(GOTAS * 2);
    const semillas = [];
    for (let i = 0; i < GOTAS; i++) {
      const x = (Math.random() - 0.5) * CAJA;
      const y = (Math.random() - 0.5) * CAJA;
      const z = (Math.random() - 0.5) * CAJA;
      const v = 0.7 + Math.random() * 0.6;
      semillas.push({ x, y, z, v });
      for (let k = 0; k < 2; k++) {
        pos[(i * 2 + k) * 3] = x;
        pos[(i * 2 + k) * 3 + 1] = y;
        pos[(i * 2 + k) * 3 + 2] = z;
        ext[i * 2 + k] = k;
        vel[i * 2 + k] = v;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aExtremo', new THREE.BufferAttribute(ext, 1));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uLargo: { value: 1.6 },
        uViento: { value: new THREE.Vector3(0.3, -1, 0) },
        uColor: { value: new THREE.Color(0xb9c9d6) },
        uOpacidad: { value: 0 },
      },
      vertexShader: VERT_LLUVIA,
      fragmentShader: FRAG_LLUVIA,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const malla = new THREE.LineSegments(geo, mat);
    malla.frustumCulled = false;
    malla.renderOrder = 900;
    malla.visible = false;
    this.grupo.add(malla);
    return { malla, mat, geo, semillas, caida: 26 };
  }

  _crearParticulas(n, color, caida, nombre) {
    const pos = new Float32Array(n * 3);
    const tam = new Float32Array(n);
    const semillas = [];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * CAJA;
      const y = (Math.random() - 0.5) * CAJA;
      const z = (Math.random() - 0.5) * CAJA;
      semillas.push({ x, y, z, v: 0.6 + Math.random() * 0.8, fase: Math.random() * 6.28 });
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      tam[i] = 0.6 + Math.random() * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTam: { value: nombre === 'ceniza' ? 12 : 26 },
        uEscalaPantalla: { value: 300 },
        uColor: { value: new THREE.Color(color) },
        uOpacidad: { value: 0 },
      },
      vertexShader: VERT_PARTICULA,
      fragmentShader: FRAG_PARTICULA,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const malla = new THREE.Points(geo, mat);
    malla.frustumCulled = false;
    malla.renderOrder = 900;
    malla.visible = false;
    this.grupo.add(malla);
    return { malla, mat, geo, semillas, caida, nombre };
  }

  /**
   * Textura de bocanada: un degradado radial con grumos.
   *
   * Sin esto, cada capa de humo es un rectángulo con borde recto y la columna
   * se ve como una pila de cajas. El degradado la disuelve en los bordes y el
   * ruido le saca la simetría, que es lo que delata a un sprite.
   */
  _texturaHumo() {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');

    // Base: caída suave del centro al borde
    const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.72)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, N, N);

    // Grumos: manchones claros y oscuros que rompen el círculo perfecto
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * N * 0.5;
      const x = N / 2 + Math.cos(a) * r, y = N / 2 + Math.sin(a) * r;
      const rr = 6 + Math.random() * 22;
      const gg = g.createRadialGradient(x, y, 0, x, y, rr);
      gg.addColorStop(0, `rgba(0,0,0,${0.12 + Math.random() * 0.3})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Columna de humo del incendio: seis planos que suben y se abren.
   * No pretende ser una simulación, sino la señal que se ve a kilómetros y que
   * en la vida real es lo primero que avisa.
   */
  _crearHumo() {
    const grupo = new THREE.Group();
    grupo.visible = false;
    const textura = this._texturaHumo();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8f8b84, transparent: true, opacity: 0.34, map: textura,
      depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    const capas = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.clone());
      m.renderOrder = 880;
      capas.push(m);
      grupo.add(m);
    }
    const brasa = new THREE.PointLight(0xff5a1e, 0, 700, 2);
    grupo.add(brasa);
    this.grupo.add(grupo);
    return { grupo, capas, mat, brasa };
  }

  // ── Actualización ─────────────────────────────────────────────────────────

  /**
   * @param {number} dt segundos reales
   * @param {object} est estado del ambiente ya modificado por los eventos
   * @param {THREE.Camera} camara
   */
  actualizar(dt, est, camara) {
    this._t += dt;

    // El viento viene en km/h y en grados meteorológicos (de dónde sopla)
    const rad = (est.direccionViento ?? 265) * Math.PI / 180;
    const fuerza = Math.min(1.6, (est.vientoKmh ?? 15) / 60);
    const vx = Math.sin(rad) * fuerza;
    const vz = Math.cos(rad) * fuerza;

    const lluvia = Math.min(1, est.lluvia ?? 0);
    const nieve = Math.min(1, est.nieve ?? 0);
    const granizo = Math.min(1, est.granizo ?? 0);
    const ceniza = Math.min(1, est.ceniza ?? 0);

    this._mover(this.lluvia, dt, camara, vx, vz, lluvia > 0.02);
    this._mover(this.nieve, dt, camara, vx * 1.6, vz * 1.6, nieve > 0.02, true);
    this._mover(this.granizo, dt, camara, vx, vz, granizo > 0.02);
    this._mover(this.ceniza, dt, camara, vx * 2.2, vz * 2.2, ceniza > 0.02, true);

    this.lluvia.mat.uniforms.uOpacidad.value = lluvia * 0.42;
    this.lluvia.mat.uniforms.uViento.value.set(vx, -1, vz);
    // Rayas cortas: una gota a 9 m/s deja un trazo de medio metro en el tiempo
    // de exposición del ojo, no de tres. Con trazos largos parecía lluvia de
    // cómic o, peor, arañazos en la lente.
    this.lluvia.mat.uniforms.uLargo.value = 0.42 + fuerza * 0.45;
    this.nieve.mat.uniforms.uOpacidad.value = nieve * 0.85;
    this.granizo.mat.uniforms.uOpacidad.value = granizo * 0.9;
    this.ceniza.mat.uniforms.uOpacidad.value = Math.min(0.7, ceniza * 0.8);

    // Densidad aparente: con poca lluvia no se dibujan todas las gotas
    this.lluvia.malla.geometry.setDrawRange(0, Math.floor(GOTAS * 2 * (0.25 + lluvia * 0.75)));
    this.nieve.malla.geometry.setDrawRange(0, Math.floor(COPOS * (0.2 + nieve * 0.8)));

    this._rayos(dt, est);
    this._humo(dt, est, camara);
  }

  /** Recicla las partículas dentro de la caja que sigue a la cámara. */
  _mover(sistema, dt, camara, vx, vz, visible, revolotea = false) {
    sistema.malla.visible = visible;
    if (!visible) return;

    const c = camara.position;
    sistema.malla.position.set(0, 0, 0);
    const pos = sistema.geo.attributes.position;
    const porVertice = sistema.semillas.length * 2 === pos.count ? 2 : 1;
    const mitad = CAJA / 2;

    for (let i = 0; i < sistema.semillas.length; i++) {
      const s = sistema.semillas[i];
      s.y -= sistema.caida * s.v * dt;
      s.x += vx * sistema.caida * 0.16 * dt;
      s.z += vz * sistema.caida * 0.16 * dt;
      if (revolotea) {
        // El copo no cae recto: se mece. La ceniza todavía más.
        s.x += Math.sin(this._t * 0.9 + s.fase) * dt * 1.1;
        s.z += Math.cos(this._t * 0.7 + s.fase * 1.3) * dt * 1.1;
      }

      // Envolver la caja alrededor de la cámara: lo que sale por un lado entra
      // por el opuesto, y así 2.600 gotas alcanzan para una tormenta entera.
      let x = s.x + c.x, y = s.y + c.y, z = s.z + c.z;
      if (y < c.y - mitad) { s.y += CAJA; y += CAJA; }
      if (s.x > mitad) s.x -= CAJA; else if (s.x < -mitad) s.x += CAJA;
      if (s.z > mitad) s.z -= CAJA; else if (s.z < -mitad) s.z += CAJA;
      x = s.x + c.x; z = s.z + c.z;

      if (porVertice === 2) {
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x, y, z);
      } else {
        pos.setXYZ(i, x, y, z);
      }
    }
    pos.needsUpdate = true;
  }

  /**
   * Relámpagos. Un rayo ilumina el paisaje entero por un instante, así que se
   * resuelve subiendo la luz, no dibujando una raya: es más barato y se parece
   * mucho más a lo que se ve.
   */
  _rayos(dt, est) {
    this.destello = Math.max(0, this.destello - dt * 5.5);
    const actividad = est.rayos ?? 0;
    if (actividad <= 0) { this._proximoRayo = 0; return; }

    this._proximoRayo -= dt;
    if (this._proximoRayo <= 0) {
      // Entre 3 y 25 segundos según qué tan fuerte esté la tormenta
      this._proximoRayo = 3 + Math.random() * 22 * (1 - actividad * 0.8);
      this.destello = 0.75 + Math.random() * 0.25;
      this.ultimoRayo = { t: this._t, fuerza: this.destello };
    }
  }

  /** Sitúa y anima la columna de humo del incendio activo, si hay uno. */
  _humo(dt, est, camara) {
    const fuego = (est.eventos || []).find(e => e.id === 'incendio_forestal' && e.intensidad > 0);
    if (!fuego || fuego.x == null) { this.humo.grupo.visible = false; return; }

    this.humo.grupo.visible = true;
    const base = this.alturaEn ? this.alturaEn(fuego.x, fuego.z) : (camara.position.y - 40);
    this.humo.grupo.position.set(fuego.x, base, fuego.z);

    const alto = 260 + fuego.intensidad * 420;
    for (let i = 0; i < this.humo.capas.length; i++) {
      const m = this.humo.capas[i];
      const t = (i / this.humo.capas.length + (this._t * 0.03)) % 1;
      const ancho = 70 + t * 420 * (0.6 + fuego.intensidad);
      m.position.set(
        Math.sin(t * 4 + i) * t * 120,
        t * alto,
        Math.cos(t * 3 + i) * t * 90);
      m.scale.set(ancho, ancho * 1.15, 1);
      m.material.opacity = 0.52 * (1 - t) * Math.min(1, fuego.intensidad * 2.2);
      // Siempre de frente a la cámara: son planos, no volúmenes. Cada bocanada
      // gira sobre su propio eje para que no se repita el mismo dibujo.
      m.quaternion.copy(camara.quaternion);
      m.rotateZ(i * 1.7 + this._t * 0.05);
    }
    // De noche el frente se ve como una línea naranja en la ladera
    this.humo.brasa.intensity = 5 + fuego.intensidad * 26;
    this.humo.brasa.position.set(0, 12, 0);
  }
}
