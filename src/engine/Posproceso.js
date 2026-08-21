/**
 * Posproceso — oclusión ambiental y corrección de color.
 *
 * Son los dos cambios que más mejoran el aspecto sin tocar un solo modelo.
 *
 * ── Por qué una oclusión propia y no la de three ─────────────────────────────
 *
 * `GTAOPass` y `SSAOPass` dibujan la escena una segunda vez con
 * `scene.overrideMaterial` para sacar normales y profundidad. Acá eso no sirve:
 * el terreno no existe como geometría, se genera desplazando vértices en el
 * shader, y un material impuesto desde afuera lo dibujaría plano a cota cero.
 * Lo mismo pasa con la vegetación instanciada y con las tarjetas recortadas por
 * alfa, que en un material impuesto serían rectángulos sólidos.
 *
 * La salida es no dibujar nada de nuevo: se le engancha una textura de
 * profundidad al objetivo del compositor, y esa profundidad es —por
 * construcción— la de la escena tal como se dibujó, con desplazamiento, con
 * recorte por alfa y con todo. De ahí se reconstruye la posición de cada píxel
 * y la normal por derivadas de pantalla.
 *
 * Hay una vuelta de tuerca: el render usa `logarithmicDepthBuffer`, así que la
 * profundidad NO es la lineal habitual y hay que invertir la fórmula de three
 * para recuperar la distancia. Sin eso la oclusión sale como una mancha pegada
 * a la cámara.
 *
 * ── Por qué corrección de color ──────────────────────────────────────────────
 *
 * El mapeo tonal ACES entrega una imagen correcta pero cruda: el verde del
 * bosque tira a oliva parejo y el cielo nublado se va a blanco puro. Un poco de
 * curva, de separación de temperatura entre luces y sombras y de viñeteado
 * cambian la lectura de toda la escena, y cuestan un cuarto de milisegundo.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// ── Oclusión ambiental en espacio de pantalla ────────────────────────────────

const FRAG_AO = /* glsl */`
  uniform sampler2D tDepth;
  uniform vec2 uResolucion;
  uniform float uRadio;         // radio de muestreo en metros
  uniform float uFuerza;
  uniform float uSesgo;
  uniform float uTanMitadFov;
  uniform float uAspecto;
  uniform float uLogFC;         // constante de profundidad logarítmica de three
  uniform float uLejos;
  varying vec2 vUv;

  const int MUESTRAS = 12;

  /**
   * Distancia real a partir de la profundidad logarítmica.
   * three escribe  d = log2(w + 1) * FC * 0.5  con w = -z de vista.
   */
  float distanciaDe(float d) {
    return exp2(2.0 * d / uLogFC) - 1.0;
  }

  /** Posición en espacio de vista del píxel de estas coordenadas. */
  vec3 posicionDe(vec2 uv) {
    float dist = distanciaDe(texture2D(tDepth, uv).x);
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc.x * uTanMitadFov * uAspecto, ndc.y * uTanMitadFov, -1.0) * dist;
  }

  float azar(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float d = texture2D(tDepth, vUv).x;

    // El cielo no se ocluye: es el fondo, no una superficie
    if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }

    vec3 p = posicionDe(vUv);
    float dist = -p.z;

    // La normal sale de las derivadas de pantalla de la posición reconstruida.
    // No hace falta un pase de normales: la superficie ya está acá.
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));

    // Espiral girada por píxel: doce muestras alcanzan si no se repiten en la
    // misma dirección en dos píxeles vecinos.
    float giro = azar(vUv * uResolucion) * 6.2831853;
    float radioPantalla = uRadio / max(1.0, dist);

    float oclusion = 0.0;
    for (int i = 0; i < MUESTRAS; i++) {
      float t = (float(i) + 0.5) / float(MUESTRAS);
      float ang = giro + t * 6.2831853 * 3.0;
      vec2 desplazamiento = vec2(cos(ang), sin(ang)) * radioPantalla * sqrt(t);
      vec2 uvM = vUv + desplazamiento * vec2(1.0, uAspecto);
      if (uvM.x < 0.0 || uvM.x > 1.0 || uvM.y < 0.0 || uvM.y > 1.0) continue;

      vec3 q = posicionDe(uvM);
      vec3 v = q - p;
      float largo = length(v);
      if (largo < 1e-4) continue;

      // Ocluye lo que está por delante del plano de la superficie, y sólo si
      // está cerca: un cerro a un kilómetro no sombrea el pasto de acá.
      float alcance = smoothstep(0.0, 1.0, uRadio / max(largo, 1e-3));
      oclusion += max(0.0, dot(v / largo, n) - uSesgo) * alcance;
    }
    oclusion = clamp(oclusion / float(MUESTRAS) * uFuerza, 0.0, 1.0);

    // Se desvanece con la distancia: de lejos la oclusión de contacto no se ve
    // y sólo aporta ruido.
    oclusion *= 1.0 - smoothstep(uLejos * 0.35, uLejos, dist);

    // Sale sólo el factor de luz: la mezcla con el color va después del
    // desenfoque, porque desenfocar el color emborronaría la imagen entera.
    gl_FragColor = vec4(vec3(1.0 - oclusion), 1.0);
  }
`;

/**
 * Desenfoque consciente de la profundidad.
 *
 * Doce muestras dejan un granulado que en el suelo parece arena. Un desenfoque
 * liso lo arreglaría pero correría la oclusión de un objeto sobre el de atrás,
 * así que se pesa cada muestra por lo parecida que es su profundidad: dentro de
 * la misma superficie promedia, en el borde de una hoja no cruza.
 */
const FRAG_DESENFOQUE = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uPaso;        // dirección y tamaño del salto, en UV
  uniform float uLogFC;
  varying vec2 vUv;

  float distanciaDe(float d) { return exp2(2.0 * d / uLogFC) - 1.0; }

  void main() {
    float centro = distanciaDe(texture2D(tDepth, vUv).x);
    float suma = 0.0, peso = 0.0;
    for (int i = -3; i <= 3; i++) {
      vec2 uv = vUv + uPaso * float(i);
      float dm = distanciaDe(texture2D(tDepth, uv).x);
      // Tolerancia proporcional a la distancia: a 100 m, 40 cm es lo mismo
      float w = exp(-abs(dm - centro) / max(0.35, centro * 0.02));
      suma += texture2D(tDiffuse, uv).r * w;
      peso += w;
    }
    gl_FragColor = vec4(vec3(suma / max(peso, 1e-4)), 1.0);
  }
`;

/** Mezcla final: el color de la escena por el factor de oclusión ya suavizado. */
const FRAG_MEZCLA = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform sampler2D tOclusion;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    float ao = texture2D(tOclusion, vUv).r;
    gl_FragColor = vec4(c.rgb * ao, c.a);
  }
`;

const VERT_PLANO = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class PasoOclusion extends Pass {
  /**
   * @param {THREE.PerspectiveCamera} camara
   */
  constructor(camara) {
    super();
    this.camara = camara;
    // OJO: nada de guardar el renderer como `this.render`. `Pass` usa un método
    // llamado `render`, y asignarle el renderer lo pisa: el compositor falla con
    // "pass.render is not a function" y no se dibuja nada.
    this.needsSwap = true;

    const objetivo = () => new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      depthBuffer: false, stencilBuffer: false,
    });
    this.rtOclusion = objetivo();
    this.rtAuxiliar = objetivo();

    this.matOclusion = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uResolucion: { value: new THREE.Vector2(1, 1) },
        uRadio: { value: 0.55 },
        uFuerza: { value: 3.2 },
        uSesgo: { value: 0.02 },
        uTanMitadFov: { value: 1 },
        uAspecto: { value: 1 },
        uLogFC: { value: 1 },
        uLejos: { value: 240 },
      },
      vertexShader: VERT_PLANO, fragmentShader: FRAG_AO,
      depthTest: false, depthWrite: false,
    });

    this.matDesenfoque = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        uPaso: { value: new THREE.Vector2() }, uLogFC: { value: 1 },
      },
      vertexShader: VERT_PLANO, fragmentShader: FRAG_DESENFOQUE,
      depthTest: false, depthWrite: false,
    });

    this.matMezcla = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tOclusion: { value: null } },
      vertexShader: VERT_PLANO, fragmentShader: FRAG_MEZCLA,
      depthTest: false, depthWrite: false,
    });

    this._quad = new FullScreenQuad(this.matOclusion);
    this._ancho = 1; this._alto = 1;
  }

  /**
   * La oclusión se calcula a MEDIA resolución y se sube al mezclar. Es de baja
   * frecuencia —después de todo se la desenfoca— así que a resolución completa
   * se paga cuatro veces por una diferencia que no se ve: medido, 4,2 ms contra
   * 1,2 ms a 1280×720.
   */
  setSize(ancho, alto) {
    this._ancho = Math.max(1, Math.round(ancho / 2));
    this._alto = Math.max(1, Math.round(alto / 2));
    this.matOclusion.uniforms.uResolucion.value.set(this._ancho, this._alto);
    this.rtOclusion.setSize(this._ancho, this._alto);
    this.rtAuxiliar.setSize(this._ancho, this._alto);
  }

  _dibujar(renderer, material, destino) {
    this._quad.material = material;
    renderer.setRenderTarget(destino);
    this._quad.render(renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    const profundidad = readBuffer.depthTexture;
    if (!profundidad) return;

    const fov = this.camara.fov * Math.PI / 180;
    const logFC = 2.0 / (Math.log(this.camara.far + 1.0) / Math.LN2);
    const uo = this.matOclusion.uniforms;
    uo.tDepth.value = profundidad;
    uo.uTanMitadFov.value = Math.tan(fov / 2);
    uo.uAspecto.value = this.camara.aspect;
    uo.uLogFC.value = logFC;

    // 1) Factor de oclusión
    this._dibujar(renderer, this.matOclusion, this.rtOclusion);

    // 2) Desenfoque en dos pasadas de una dimensión, que cuesta la mitad que
    //    una de dos dimensiones y se ve igual
    const ud = this.matDesenfoque.uniforms;
    ud.tDepth.value = profundidad;
    ud.uLogFC.value = logFC;
    ud.tDiffuse.value = this.rtOclusion.texture;
    ud.uPaso.value.set(1 / this._ancho, 0);
    this._dibujar(renderer, this.matDesenfoque, this.rtAuxiliar);

    ud.tDiffuse.value = this.rtAuxiliar.texture;
    ud.uPaso.value.set(0, 1 / this._alto);
    this._dibujar(renderer, this.matDesenfoque, this.rtOclusion);

    // 3) Mezcla con la imagen
    this.matMezcla.uniforms.tDiffuse.value = readBuffer.texture;
    this.matMezcla.uniforms.tOclusion.value = this.rtOclusion.texture;
    this._dibujar(renderer, this.matMezcla, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    this.matOclusion.dispose();
    this.matDesenfoque.dispose();
    this.matMezcla.dispose();
    this.rtOclusion.dispose();
    this.rtAuxiliar.dispose();
    this._quad.dispose();
  }
}

// ── Corrección de color ──────────────────────────────────────────────────────

const FRAG_COLOR = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float uContraste;
  uniform float uSaturacion;
  uniform float uVineteado;
  uniform vec3 uSombras;      // tinte de las sombras
  uniform vec3 uLuces;        // tinte de las luces
  uniform float uTecho;       // compresión de las luces altas
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;

    // Techo suave: el cielo nublado se iba a blanco puro y se comía el
    // horizonte. Esto lo frena antes de llegar a 1 sin apagar la escena.
    c = c / (1.0 + max(vec3(0.0), c - uTecho) * 0.85);

    // Curva en S alrededor del gris medio: da negros y separa los medios
    float l = luma(c);
    vec3 curva = mix(c, c * c * (3.0 - 2.0 * c), uContraste);
    c = curva;

    // Temperatura separada: sombras frías, luces cálidas. Es lo que hace que
    // un bosque parezca un bosque y no un campo de plástico verde.
    float mezcla = smoothstep(0.15, 0.75, luma(c));
    c *= mix(uSombras, uLuces, mezcla);

    // Saturación, con cuidado de no reventar los verdes
    c = mix(vec3(luma(c)), c, uSaturacion);

    // Viñeteado apenas perceptible: enfoca la mirada en el centro
    vec2 d = vUv - 0.5;
    c *= 1.0 - dot(d, d) * uVineteado;

    gl_FragColor = vec4(max(vec3(0.0), c), 1.0);
  }
`;

export class PasoColor extends Pass {
  constructor() {
    super();
    this.needsSwap = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uContraste: { value: 0.30 },
        uSaturacion: { value: 1.12 },
        uVineteado: { value: 0.34 },
        uSombras: { value: new THREE.Color(0.93, 0.97, 1.06) },
        uLuces: { value: new THREE.Color(1.05, 1.01, 0.94) },
        // Este pase corre después del mapeo tonal, así que ve valores de
        // pantalla entre 0 y 1 y no valores de escena que llegaban a 30. Con el
        // techo en 0,82 se comprimía un quinto del rango útil por las dudas;
        // ahora ACES ya hizo ese trabajo y sólo hace falta frenar el blanco
        // puro, que es lo que se comía el horizonte nublado.
        uTecho: { value: 0.94 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: FRAG_COLOR,
      depthTest: false,
      depthWrite: false,
    });
    this._quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this._quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this._quad.dispose();
  }
}
