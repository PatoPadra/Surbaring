/**
 * Terreno — CDLOD instanciado sobre el DEM real.
 *
 * Un cuadrantoárbol selecciona cada cuadro los nodos visibles según su distancia
 * a la cámara; todos se dibujan con una sola llamada instanciada. El shader de
 * vértices interpola ("morphing") entre el nivel fino y el grueso, así que no hay
 * saltos ni grietas al cambiar de detalle.
 *
 * El sombreado se apoya en MeshStandardMaterial para heredar el PBR, las sombras
 * en cascada, la niebla y el mapeo tonal de three.js, y se le inyecta el
 * desplazamiento y el mezclado de materiales por altura, pendiente y humedad.
 */

import * as THREE from 'three';

const RES = 32;              // quads por lado en la malla base
const HOJA_M = 256;          // tamaño del nodo más fino, en metros
const MAX_NODOS = 4096;

export class Terreno {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   */
  constructor(mundo) {
    this.mundo = mundo;
    this.niveles = Math.round(Math.log2(mundo.tamano / HOJA_M));
    this.rangos = [];
    for (let l = 0; l <= this.niveles; l++) {
      // Cada nivel duplica su alcance; el más fino cubre 420 m alrededor.
      this.rangos[l] = 420 * Math.pow(2, l);
    }

    this._construirMinMax();
    this._construirMalla();

    this._nodos = new Float32Array(MAX_NODOS * 4); // offsetX, offsetZ, escala, rango
    this._frustum = new THREE.Frustum();
    this._matriz = new THREE.Matrix4();
    this._caja = new THREE.Box3();
    this._camPos = new THREE.Vector3();
    this.nodosDibujados = 0;
  }

  /**
   * Pirámide de alturas mínima y máxima por nodo: permite descartar por frustum
   * sin tocar el DEM completo.
   */
  _construirMinMax() {
    const { N, altura } = this.mundo;
    const hojas = this.mundo.tamano / HOJA_M; // nodos por lado en el nivel 0
    this.piramide = [];
    const texelsPorHoja = Math.max(1, Math.round(N / hojas));

    let min = new Float32Array(hojas * hojas).fill(Infinity);
    let max = new Float32Array(hojas * hojas).fill(-Infinity);
    for (let j = 0; j < N; j++) {
      const nj = Math.min(hojas - 1, (j / texelsPorHoja) | 0);
      for (let i = 0; i < N; i++) {
        const ni = Math.min(hojas - 1, (i / texelsPorHoja) | 0);
        const h = altura[j * N + i];
        const k = nj * hojas + ni;
        if (h < min[k]) min[k] = h;
        if (h > max[k]) max[k] = h;
      }
    }
    this.piramide[0] = { lado: hojas, min, max };

    for (let l = 1; l <= this.niveles; l++) {
      const prev = this.piramide[l - 1];
      const lado = Math.max(1, prev.lado >> 1);
      const nmin = new Float32Array(lado * lado).fill(Infinity);
      const nmax = new Float32Array(lado * lado).fill(-Infinity);
      for (let j = 0; j < prev.lado; j++) {
        for (let i = 0; i < prev.lado; i++) {
          const k = (j >> 1) * lado + (i >> 1);
          const s = j * prev.lado + i;
          if (prev.min[s] < nmin[k]) nmin[k] = prev.min[s];
          if (prev.max[s] > nmax[k]) nmax[k] = prev.max[s];
        }
      }
      this.piramide[l] = { lado, min: nmin, max: nmax };
    }
  }

  _construirMalla() {
    // Malla base en [0,1]x[0,1]; el shader la escala y la desplaza por instancia.
    const verts = (RES + 1) * (RES + 1);
    const pos = new Float32Array(verts * 3);
    const idx = [];
    for (let j = 0; j <= RES; j++) {
      for (let i = 0; i <= RES; i++) {
        const k = j * (RES + 1) + i;
        pos[k * 3] = i / RES;
        pos[k * 3 + 1] = 0;
        pos[k * 3 + 2] = j / RES;
      }
    }
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const a = j * (RES + 1) + i, b = a + 1, c = a + RES + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3).fill(0), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
    geo.setIndex(idx);
    // El culling lo hace la selección del cuadrantoárbol, no three.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    this.atrNodo = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NODOS * 4), 4);
    this.atrNodo.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iNodo', this.atrNodo);
    geo.instanceCount = 0;
    this.geometria = geo;

    this.material = this._crearMaterial();
    this.malla = new THREE.Mesh(geo, this.material);
    this.malla.frustumCulled = false;
    this.malla.castShadow = true;
    this.malla.receiveShadow = true;
    this.malla.name = 'terreno';

    // El paso de sombras usa un material de profundidad aparte, que no lleva la
    // inyección de arriba. Sin esto, el terreno proyectaría la sombra de un plano
    // liso a 0 m en vez de la de la cordillera.
    this.malla.customDepthMaterial = this._crearMaterialProfundidad();
  }

  /** Mismo desplazamiento de vértices que el material visible, para las sombras. */
  _crearMaterialProfundidad() {
    const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformes);
      shader.vertexShader = `
        attribute vec4 iNodo;
        uniform sampler2D uTexAltura;
        uniform float uTamanoMundo;
        uniform float uResGrilla;
        uniform vec2 uCamXZ;
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec2 nodoOrigen = iNodo.xy;
        float nodoEscala = iNodo.z;
        float nodoRango = iNodo.w;
        vec2 rejilla = position.xz;
        vec2 mundoXZ = nodoOrigen + rejilla * nodoEscala;
        float dist = distance(mundoXZ, uCamXZ);
        float k = clamp((dist / nodoRango - 0.62) / 0.30, 0.0, 1.0);
        vec2 frac = fract(rejilla * uResGrilla * 0.5) * 2.0 / uResGrilla;
        mundoXZ -= frac * nodoEscala * k;
        float h = texture2D(uTexAltura, mundoXZ / uTamanoMundo + 0.5).r;
        vec3 transformed = vec3(mundoXZ.x, h, mundoXZ.y);
        `
      );
    };
    return mat;
  }

  _crearMaterial() {
    const m = this.mundo;
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.0,
      dithering: true,
    });

    this.uniformes = {
      uTexAltura: { value: m.texAltura },
      uTexNormal: { value: m.texNormal },
      uTexCobertura: { value: m.texCobertura },
      uTamanoMundo: { value: m.tamano },
      uResGrilla: { value: RES },
      uCamXZ: { value: new THREE.Vector2() },
      uNieveCota: { value: 1750 },      // el clima la mueve por estación
      uNieveSuavidad: { value: 220 },
      uLineaBosque: { value: 1620 },
      uEstacion: { value: 0 },          // 0 verano … 1 otoño … 2 invierno … 3 primavera
      uMezclaEstacion: { value: 0 },
      uCeniza: { value: 0 },            // cobertura de ceniza volcánica 0..1
      uHumedadGlobal: { value: 0 },     // lluvia reciente: oscurece y satura
    };

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformes);

      shader.vertexShader = `
        attribute vec4 iNodo;            // xz = esquina del nodo, z = escala, w = rango de morphing
        uniform sampler2D uTexAltura;
        uniform float uTamanoMundo;
        uniform float uResGrilla;
        uniform vec2 uCamXZ;
        varying vec3 vMundo;
        varying float vMorph;

        float leerAltura(vec2 xz) {
          vec2 uv = xz / uTamanoMundo + 0.5;
          return texture2D(uTexAltura, uv).r;
        }
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec2 nodoOrigen = iNodo.xy;
        float nodoEscala = iNodo.z;
        float nodoRango = iNodo.w;

        vec2 rejilla = position.xz;                     // 0..1
        vec2 mundoXZ = nodoOrigen + rejilla * nodoEscala;

        // Factor de morphing: 0 en el interior del nodo, 1 al borde de su alcance.
        float dist = distance(mundoXZ, uCamXZ);
        float k = clamp((dist / nodoRango - 0.62) / 0.30, 0.0, 1.0);
        vMorph = k;

        // Desplaza los vértices impares hacia los pares: al llegar a k=1 la malla
        // coincide exactamente con la del nivel siguiente, así no quedan grietas.
        vec2 frac = fract(rejilla * uResGrilla * 0.5) * 2.0 / uResGrilla;
        mundoXZ -= frac * nodoEscala * k;

        float h = leerAltura(mundoXZ);
        vec3 transformed = vec3(mundoXZ.x, h, mundoXZ.y);
        vMundo = transformed;
        `
      );

      shader.fragmentShader = `
        uniform sampler2D uTexNormal;
        uniform sampler2D uTexCobertura;
        uniform float uTamanoMundo;
        uniform float uNieveCota;
        uniform float uNieveSuavidad;
        uniform float uLineaBosque;
        uniform float uEstacion;
        uniform float uMezclaEstacion;
        uniform float uCeniza;
        uniform float uHumedadGlobal;
        varying vec3 vMundo;
        varying float vMorph;

        // Ruido de valor con derivadas analíticas suficientes para detalle fino
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float ruido(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
          return v;
        }
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        vec2 uvMundo = vMundo.xz / uTamanoMundo + 0.5;
        vec4 cob = texture2D(uTexCobertura, uvMundo);
        float esAgua = cob.r;
        float cauce = cob.g;
        float humedad = cob.b;

        vec3 nrm = normalize(texture2D(uTexNormal, uvMundo).xyz * 2.0 - 1.0);
        float pend = 1.0 - clamp(nrm.y, 0.0, 1.0);      // 0 llano, 1 vertical
        float alt = vMundo.y;

        // ── Paletas de la Patagonia andina ──────────────────────────────────
        vec3 rocaBase   = vec3(0.335, 0.320, 0.302);    // granodiorita del batolito
        vec3 rocaOscura = vec3(0.185, 0.176, 0.170);
        vec3 pedregal   = vec3(0.430, 0.408, 0.378);    // acarreo altoandino
        vec3 suelo      = vec3(0.196, 0.148, 0.104);    // andisol sobre ceniza
        vec3 bosqueHum  = vec3(0.086, 0.156, 0.082);    // coihue / selva valdiviana
        vec3 bosqueSeco = vec3(0.204, 0.226, 0.128);    // ñire y ciprés
        vec3 estepa     = vec3(0.478, 0.436, 0.296);    // coirón y neneo
        vec3 nieve      = vec3(0.885, 0.912, 0.945);

        // Otoño: la lenga y el ñire viran a rojo y naranja intensos.
        float otonal = clamp(1.0 - abs(uEstacion - 1.0), 0.0, 1.0);
        bosqueHum = mix(bosqueHum, vec3(0.402, 0.170, 0.072), otonal * 0.62);
        bosqueSeco = mix(bosqueSeco, vec3(0.520, 0.262, 0.086), otonal * 0.70);

        float detalle = fbm(vMundo.xz * 0.045);
        float grano   = fbm(vMundo.xz * 0.42);

        // Mezcla vegetal según el gradiente de lluvia oeste-este
        vec3 vegetacion = mix(estepa, bosqueSeco, smoothstep(0.22, 0.48, humedad));
        vegetacion = mix(vegetacion, bosqueHum, smoothstep(0.45, 0.78, humedad));
        vegetacion = mix(vegetacion, vegetacion * 0.82, detalle * 0.5);

        // Por encima de la línea de bosque no hay árboles: matorral y roca desnuda
        float sobreBosque = smoothstep(uLineaBosque - 160.0, uLineaBosque + 190.0, alt);
        vec3 tierra = mix(vegetacion, pedregal, sobreBosque);

        // La pendiente descubre la roca madre
        float roca = smoothstep(0.34, 0.68, pend + detalle * 0.14);
        vec3 colorRoca = mix(rocaBase, rocaOscura, grano * 0.8);
        tierra = mix(tierra, colorRoca, roca);
        tierra = mix(tierra, suelo, smoothstep(0.30, 0.06, pend) * (1.0 - sobreBosque) * 0.22);

        // Nieve: se acumula por altura, no en paredes, y algo más en las hondonadas
        float nieveAlt = smoothstep(uNieveCota - uNieveSuavidad, uNieveCota + uNieveSuavidad, alt);
        float nievePend = smoothstep(0.62, 0.24, pend);
        float mascaraNieve = clamp(nieveAlt * nievePend + nieveAlt * 0.12, 0.0, 1.0);
        mascaraNieve *= 1.0 - smoothstep(0.0, 0.35, detalle * 0.5 - 0.08);
        tierra = mix(tierra, nieve, mascaraNieve);

        // Ceniza volcánica del Puyehue-Cordón Caulle: gris pardo que apaga todo
        tierra = mix(tierra, vec3(0.404, 0.376, 0.344), uCeniza * (1.0 - roca * 0.4));

        // Orillas y lechos húmedos
        tierra = mix(tierra, tierra * 0.62, cauce * 0.8);
        tierra = mix(tierra, vec3(0.128, 0.118, 0.098), esAgua * 0.85);

        // La lluvia reciente oscurece y satura el suelo
        tierra = mix(tierra, tierra * 0.72, uHumedadGlobal * (1.0 - mascaraNieve) * 0.55);

        diffuseColor.rgb *= tierra;
        `
      );

      // Normal geométrica desde el mapa precalculado, más relieve fino de ruido
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `
        // Sustituye al chunk de three: hay que declarar exactamente lo que él
        // declara (normal, nonPerturbedNormal, faceDirection) y nada más.
        // geometryNormal lo declara después <lights_fragment_begin>: repetirlo
        // acá rompe el enlace del programa.
        float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        vec3 normal = normalize(texture2D(uTexNormal, vMundo.xz / uTamanoMundo + 0.5).xyz * 2.0 - 1.0);
        float ex = fbm(vMundo.xz * 0.9 + 3.1) - fbm(vMundo.xz * 0.9 - 3.1);
        float ez = fbm(vMundo.xz * 0.9 + 7.7) - fbm(vMundo.xz * 0.9 - 7.7);
        normal = normalize(normal + vec3(ex, 0.0, ez) * 0.34);
        vec3 nonPerturbedNormal = normal;
        `
      );

      // La rugosidad cambia con el material: la nieve es lisa, el pedregal áspero
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        float roughnessFactor = roughness;
        {
          vec4 cobR = texture2D(uTexCobertura, vMundo.xz / uTamanoMundo + 0.5);
          float altR = vMundo.y;
          float nieveR = smoothstep(uNieveCota - uNieveSuavidad, uNieveCota + uNieveSuavidad, altR);
          roughnessFactor = mix(roughnessFactor, 0.42, nieveR * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.70, uHumedadGlobal * 0.5);
          roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);
        }
        `
      );

      this._shader = shader;
    };

    return mat;
  }

  /** Selección del cuadrantoárbol para este cuadro. */
  actualizar(camara) {
    camara.updateMatrixWorld();
    this._matriz.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._matriz);
    camara.getWorldPosition(this._camPos);
    this.uniformes.uCamXZ.value.set(this._camPos.x, this._camPos.z);

    this._n = 0;
    const raiz = this.mundo.tamano;
    this._seleccionar(-raiz / 2, -raiz / 2, raiz, this.niveles);

    this.atrNodo.array.set(this._nodos.subarray(0, this._n * 4));
    this.atrNodo.needsUpdate = true;
    this.geometria.instanceCount = this._n;
    this.nodosDibujados = this._n;
  }

  _seleccionar(x, z, tam, nivel) {
    if (this._n >= MAX_NODOS) return;

    const p = this.piramide[nivel];
    const lado = p.lado;
    const ix = Math.min(lado - 1, Math.max(0, Math.floor((x + this.mundo.mitad) / tam)));
    const iz = Math.min(lado - 1, Math.max(0, Math.floor((z + this.mundo.mitad) / tam)));
    const k = iz * lado + ix;
    const hMin = p.min[k], hMax = p.max[k];

    this._caja.min.set(x, hMin - 5, z);
    this._caja.max.set(x + tam, hMax + 5, z + tam);
    if (!this._frustum.intersectsBox(this._caja)) return;

    // Distancia de la cámara a la caja del nodo
    const dx = Math.max(this._caja.min.x - this._camPos.x, 0, this._camPos.x - this._caja.max.x);
    const dy = Math.max(this._caja.min.y - this._camPos.y, 0, this._camPos.y - this._caja.max.y);
    const dz = Math.max(this._caja.min.z - this._camPos.z, 0, this._camPos.z - this._caja.max.z);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (nivel > 0 && dist < this.rangos[nivel - 1]) {
      const mitad = tam / 2;
      this._seleccionar(x, z, mitad, nivel - 1);
      this._seleccionar(x + mitad, z, mitad, nivel - 1);
      this._seleccionar(x, z + mitad, mitad, nivel - 1);
      this._seleccionar(x + mitad, z + mitad, mitad, nivel - 1);
      return;
    }

    const o = this._n * 4;
    this._nodos[o] = x;
    this._nodos[o + 1] = z;
    this._nodos[o + 2] = tam;
    this._nodos[o + 3] = this.rangos[nivel];
    this._n++;
  }

  /** El clima y la estación reconfiguran el aspecto del terreno. */
  aplicarEstacion({ estacion = 0, cotaNieve = 1750, ceniza = 0, humedad = 0 } = {}) {
    this.uniformes.uEstacion.value = estacion;
    this.uniformes.uNieveCota.value = cotaNieve;
    this.uniformes.uCeniza.value = ceniza;
    this.uniformes.uHumedadGlobal.value = humedad;
  }

  dispose() {
    this.geometria.dispose();
    this.material.dispose();
  }
}
