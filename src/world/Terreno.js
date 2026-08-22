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
import { DETALLE } from './Mundo.js';

const RES = 32;              // quads por lado en la malla base
// Nodo más fino de 64 m: con RES=32 da 2 m por cuadro. Antes eran 256 m (8 m
// por cuadro) y no había dónde apoyar el relieve fino, que vive entre 1 y 8 m.
const HOJA_M = 64;
const MAX_NODOS = 8192;

export class Terreno {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   */
  constructor(mundo) {
    this.mundo = mundo;
    this.niveles = Math.round(Math.log2(mundo.tamano / HOJA_M));
    this.rangos = [];
    for (let l = 0; l <= this.niveles; l++) {
      // Cada nivel duplica su alcance. El más fino cubre 190 m: más allá de eso
      // los cuadros de 2 m no aportan nada visible y sólo cuestan triángulos.
      this.rangos[l] = 190 * Math.pow(2, l);
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
    //
    // Además del tablero, lleva una FALDA: un anillo de vértices duplicados en
    // el borde que el shader hunde unos metros. Sirve para tapar las grietas
    // entre nodos de distinto nivel.
    //
    // Hacen falta porque el morphing de CDLOD sólo cierra la costura entre un
    // nodo y su vecino de UN nivel de diferencia. El árbol no está balanceado a
    // 2:1 —la distancia se mide a la caja del nodo, y en terreno montañoso dos
    // nodos contiguos pueden diferir en dos niveles—, y ahí quedan rendijas por
    // las que se ve el cielo. Se notaban como líneas blancas a trazos
    // recorriendo el valle desde el aire. La falda no arregla la causa: la
    // esconde, que es lo que hace todo el mundo, y cuesta 128 triángulos por
    // nodo sobre 2.048.
    const verts = (RES + 1) * (RES + 1);
    const bordeVerts = 4 * (RES + 1);
    const total = verts + bordeVerts;
    const pos = new Float32Array(total * 3);
    const falda = new Float32Array(total);
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

    // Los cuatro bordes, cada uno con su tira de falda. El orden de los índices
    // de cada cara sigue el del borde para que la falda mire hacia afuera.
    // El devanado de cada tira decide hacia dónde mira su cara. Al revés, el
    // culling se come la falda entera y las grietas siguen ahí: se ve idéntico
    // a no tener falda, que fue exactamente lo que pasó la primera vez.
    const bordes = [
      { indice: (t) => t,                     invertir: true },   // z = 0
      { indice: (t) => RES * (RES + 1) + t,   invertir: false },  // z = 1
      { indice: (t) => t * (RES + 1),         invertir: false },  // x = 0
      { indice: (t) => t * (RES + 1) + RES,   invertir: true },   // x = 1
    ];

    let siguiente = verts;
    for (const borde of bordes) {
      const primeroFalda = siguiente;
      for (let t = 0; t <= RES; t++) {
        const origen = borde.indice(t);
        const destino = siguiente++;
        pos[destino * 3] = pos[origen * 3];
        pos[destino * 3 + 1] = 0;
        pos[destino * 3 + 2] = pos[origen * 3 + 2];
        falda[destino] = 1;
      }
      for (let t = 0; t < RES; t++) {
        const a = borde.indice(t), b = borde.indice(t + 1);
        const c = primeroFalda + t, d = primeroFalda + t + 1;
        if (borde.invertir) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3).fill(0), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(total * 2), 2));
    geo.setAttribute('aFalda', new THREE.BufferAttribute(falda, 1));
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
    // Último entre los opacos: es lo más caro por píxel y está detrás de casi
    // todo. Ver la nota de Sotobosque.js.
    this.malla.renderOrder = -10;
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
        attribute float aFalda;
        uniform sampler2D uTexAltura;
        uniform sampler2D uTexCobertura;
        uniform sampler2D uTexDetalle;
        uniform float uTamanoMundo;
        uniform float uResGrilla;
        uniform float uDetallePeriodo;
        uniform float uDetalleAmplitud;
        uniform vec3 uCam;
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec2 nodoOrigen = iNodo.xy;
        float nodoEscala = iNodo.z;
        float nodoRango = iNodo.w;
        vec2 rejilla = position.xz;
        vec2 mundoXZ = nodoOrigen + rejilla * nodoEscala;
        // Mismo criterio 3D que el material visible: si difieren, la sombra la
        // proyecta una malla distinta de la que se ve.
        float hCruda = texture2D(uTexAltura, mundoXZ / uTamanoMundo + 0.5).r;
        float dist = distance(vec3(mundoXZ.x, hCruda, mundoXZ.y), uCam);
        float k = clamp((dist / nodoRango - 0.62) / 0.30, 0.0, 1.0);
        vec2 frac = fract(rejilla * uResGrilla * 0.5) * 2.0 / uResGrilla;
        mundoXZ -= frac * nodoEscala * k;
        float h = texture2D(uTexAltura, mundoXZ / uTamanoMundo + 0.5).r;
        {
          vec4 cob = texture2D(uTexCobertura, mundoXZ / uTamanoMundo + 0.5);
          float enTierra = 1.0 - smoothstep(0.15, 0.6, cob.r);
          float nitidez = 1.0 - smoothstep(4.0, 11.0, nodoEscala / uResGrilla);
          h += texture2D(uTexDetalle, mundoXZ / uDetallePeriodo).r
             * uDetalleAmplitud * enTierra * nitidez;
        }
        h -= aFalda * nodoEscala * 0.05;
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
      // Posición 3D de la cámara del jugador. En el paso de sombras
      // `cameraPosition` es la de la luz, así que el morphing necesita su
      // propio uniforme o las sombras se calculan con otro nivel de detalle.
      uCam: { value: new THREE.Vector3() },
      uTexDetalle: { value: m.texDetalle },
      uDetallePeriodo: { value: DETALLE.periodoM },
      uDetalleAmplitud: { value: DETALLE.amplitudM },
      // Hasta dónde llega el detalle fino del suelo. Lo mueve el preset.
      uDetalleAlcance: { value: 1.0 },
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
        attribute float aFalda;          // 1 en el anillo que tapa las costuras
        uniform sampler2D uTexAltura;
        uniform sampler2D uTexCobertura;
        uniform sampler2D uTexDetalle;
        uniform float uTamanoMundo;
        uniform float uResGrilla;
        uniform float uDetallePeriodo;
        uniform float uDetalleAmplitud;
        uniform vec3 uCam;
        varying vec3 vMundo;
        varying float vMorph;

        float leerAltura(vec2 xz) {
          vec2 uv = xz / uTamanoMundo + 0.5;
          return texture2D(uTexAltura, uv).r;
        }

        /**
         * Relieve fino. Tiene que dar exactamente lo mismo que Mundo.alturaEn()
         * en la CPU, o el jugador camina sobre un suelo que no es el que ve.
         * Se apaga sobre los lagos, y se desvanece cuando el nodo es tan grueso
         * que sus cuadros ya no pueden representar el detalle.
         */
        float leerDetalle(vec2 xz, float ladoCuadro) {
          vec4 cob = texture2D(uTexCobertura, xz / uTamanoMundo + 0.5);
          float enTierra = 1.0 - smoothstep(0.15, 0.6, cob.r);
          float nitidez = 1.0 - smoothstep(4.0, 11.0, ladoCuadro);
          float d = texture2D(uTexDetalle, xz / uDetallePeriodo).r;
          return d * uDetalleAmplitud * enTierra * nitidez;
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
        //
        // La distancia tiene que medirse EN 3D, igual que la que usa la
        // selección de nodos en la CPU. Midiéndola en planta funcionaba a ras
        // del suelo, donde ambas coinciden, y se rompía desde el aire: a 200 m
        // de altura un nodo justo debajo está a 200 m para la selección y a 0 m
        // para el shader, así que el nodo fino llegaba a su borde sin terminar
        // de transformarse y aparecían grietas rectangulares por donde se veía
        // el cielo. Cuesta una lectura de altura de más y las cierra.
        float hCruda = leerAltura(mundoXZ) + leerDetalle(mundoXZ, nodoEscala / uResGrilla);
        float dist = distance(vec3(mundoXZ.x, hCruda, mundoXZ.y), uCam);
        float k = clamp((dist / nodoRango - 0.62) / 0.30, 0.0, 1.0);
        vMorph = k;

        // Desplaza los vértices impares hacia los pares: al llegar a k=1 la malla
        // coincide exactamente con la del nivel siguiente, así no quedan grietas.
        vec2 frac = fract(rejilla * uResGrilla * 0.5) * 2.0 / uResGrilla;
        mundoXZ -= frac * nodoEscala * k;

        float h = leerAltura(mundoXZ) + leerDetalle(mundoXZ, nodoEscala / uResGrilla);
        // La falda baja en proporción al tamaño del nodo: la grieta que puede
        // abrirse es del orden del error de altura entre dos niveles.
        h -= aFalda * nodoEscala * 0.05;
        vec3 transformed = vec3(mundoXZ.x, h, mundoXZ.y);
        vMundo = transformed;
        `
      );

      shader.fragmentShader = `
        uniform sampler2D uTexNormal;
        uniform sampler2D uTexCobertura;
        uniform sampler2D uTexDetalle;
        uniform float uDetallePeriodo;
        uniform float uDetalleAmplitud;
        uniform float uDetalleAlcance;
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

        // Hash de Hoskins. El clásico fract(p.x*p.y) produce franjas diagonales
        // muy visibles en superficies grandes, que era justo lo que ensuciaba
        // las laderas.
        float hash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float ruido(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        /**
         * Ruido fractal. Las octavas se eligen por término, no por costumbre:
         * cinco octavas sobre un campo de 48 m agregan detalle a escala de 3 m
         * que la escala siguiente ya aporta, y en una placa integrada eso se
         * paga carísimo. Se separan en funciones porque GLSL ES 1.0 necesita
         * límites constantes de bucle.
         */
        float fbm2(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 2; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
          return v;
        }
        float fbm3(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 3; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        /**
         * Ruido proyectado sobre los tres planos y mezclado según la normal.
         * Proyectar sólo sobre XZ estira la textura en las laderas empinadas
         * hasta convertirla en franjas: en una pared vertical, un metro de
         * pared ocupa cero metros de planta.
         */
        float fbmTri(vec3 p, vec3 n, float escala) {
          vec3 w = abs(n);
          w = pow(w, vec3(4.0));
          w /= max(w.x + w.y + w.z, 1e-4);
          // Un eje por vez, y sólo si pesa. El pow(w, 4) concentra muchísimo la
          // mezcla: en suelo llano w es prácticamente (0, 1, 0), así que seis de
          // las nueve octavas se calculaban para multiplicarlas por cero. Y esto
          // no lo paga una escala: lo pagan macro, grano, meso, veta, micro,
          // gravilla y las cuatro llamadas de la normal fina, en cada píxel de
          // terreno. El umbral es el mismo 0,004 que ya usa el resto del archivo.
          float r = 0.0;
          if (w.x > 0.004) r += fbm3(p.yz * escala) * w.x;
          if (w.y > 0.004) r += fbm3(p.xz * escala) * w.y;
          if (w.z > 0.004) r += fbm3(p.xy * escala) * w.z;
          return r;
        }
        /** Versión barata, para las frecuencias altas que sólo se ven de cerca. */
        float fbmTriCorto(vec3 p, vec3 n, float escala) {
          vec3 w = abs(n);
          w = pow(w, vec3(4.0));
          w /= max(w.x + w.y + w.z, 1e-4);
          float r = 0.0;
          if (w.x > 0.004) r += fbm2(p.yz * escala) * w.x;
          if (w.y > 0.004) r += fbm2(p.xz * escala) * w.y;
          if (w.z > 0.004) r += fbm2(p.xy * escala) * w.z;
          return r;
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
        // Albedos LINEALES, no colores de pantalla. Acá estaba la razón por la
        // que el suelo se veía de tiza y sin definición: con 0,478 el coirón
        // tenía un albedo de 0,72 en sRGB —el coirón seco real anda en 0,20 a
        // 0,25 y el granito no pasa de 0,25— y después pastoClaro lo
        // multiplicaba por 1,62, dejándolo en 0,859, más claro que la nieve de
        // dos líneas más abajo. Multiplicado por un sol de 3,4, el suelo entero
        // aterrizaba sobre el hombro plano de ACES.
        //
        // Lo importante de esto no es que quede oscuro: es que TODO el trabajo
        // multiescala —macro, meso, micro, gravilla, la normal fina en tres
        // escalas, el triplanar— se estaba calculando y se comprimía a nada
        // porque modulaba un valor clavado arriba de la curva tonal. Se pagaba
        // el ruido y no se veía. Bajar la paleta no le saca luz al juego: le
        // devuelve el contraste local que ya estaba computado.
        vec3 rocaBase   = vec3(0.222, 0.212, 0.200);    // granodiorita del batolito
        vec3 rocaOscura = vec3(0.140, 0.133, 0.128);
        vec3 pedregal   = vec3(0.270, 0.256, 0.238);    // acarreo altoandino
        vec3 suelo      = vec3(0.150, 0.113, 0.080);    // andisol sobre ceniza
        vec3 bosqueHum  = vec3(0.070, 0.126, 0.066);    // coihue / selva valdiviana
        vec3 bosqueSeco = vec3(0.160, 0.178, 0.101);    // ñire y ciprés
        vec3 estepa     = vec3(0.290, 0.264, 0.180);    // coirón y neneo
        vec3 nieve      = vec3(0.885, 0.912, 0.945);

        // Otoño: la lenga y el ñire viran a rojo y naranja intensos.
        float otonal = clamp(1.0 - abs(uEstacion - 1.0), 0.0, 1.0);
        bosqueHum = mix(bosqueHum, vec3(0.402, 0.170, 0.072), otonal * 0.62);
        bosqueSeco = mix(bosqueSeco, vec3(0.520, 0.262, 0.086), otonal * 0.70);

        // ── Detalle multiescala ─────────────────────────────────────────────
        // Un solo octava daba una superficie de arcilla lisa. Hacen falta tres
        // escalas: el manchón de vegetación, la mata suelta y el grano del
        // suelo. Las frecuencias altas se desvanecen con la distancia, porque
        // más allá de unos metros no se resuelven y sólo producen hormigueo.
        float distVista = length(vViewPosition);
        // El alcance del detalle fino, gobernado por el preset.
        //
        // Medido en la placa de destino: el terreno es 19,3 ms de un cuadro de
        // 31,3 en el preset más bajo, o sea el 62 %. Y no es por vértices —
        // recortar el 64 % de los nodos del cuadrantoárbol sólo ahorró el 13 %—
        // sino por píxel: el ruido multiescala, el triplanar y la normal fina en
        // tres escalas se calculan en casi toda la pantalla, porque el suelo
        // ocupa casi toda la pantalla.
        //
        // Encoger los radios donde ese detalle vive es la única palanca que
        // queda, y es honesta: en los presets bajos el detalle se ve bajo los
        // pies y no a cuarenta metros, que es donde igual no se distinguía.
        float alcance = max(uDetalleAlcance, 0.02);
        float cercania = 1.0 - smoothstep(30.0 * alcance, 420.0 * alcance, distVista);
        float muyCerca = 1.0 - smoothstep(4.0 * alcance, 45.0 * alcance, distVista);

        // Cada escala se calcula SÓLO si su factor de desvanecimiento la va a
        // usar. Antes se calculaban todas siempre y después se multiplicaban por
        // cero: eran unas 180 octavas de ruido por píxel, y el terreno se comía
        // 377 ms de los 504 del cuadro en una Intel HD 4000. Un píxel lejano
        // ahora resuelve con nueve.
        float macro = fbmTri(vMundo, nrm, 0.021);      // manchones de ~48 m
        // El grano tiene un período de ~2,4 m: a cinco kilómetros eso está muy
        // por debajo de un píxel, y como es ruido procedural no hay mipmap que
        // lo promedie. Cada píxel del cerro sacaba un valor independiente, y eso
        // es la estática que hacía parecer el horizonte un error de compresión.
        // Sus tres hermanos ya tenían puerta de distancia; a éste se le pasó.
        // Además de arreglar el hormigueo, la puerta saltea nueve evaluaciones
        // de ruido en cada píxel lejano, que es la mitad del cuadro cuando se
        // mira un lago o un valle.
        float lejania = smoothstep(600.0, 2500.0, distVista);
        float grano = 0.5;
        if (lejania < 0.996) grano = mix(fbmTri(vMundo, nrm, 0.42), 0.5, lejania);
        float meso = 0.5, micro = 0.5, gravilla = 0.5;
        if (cercania > 0.004) meso = fbmTri(vMundo, nrm, 0.28);        // matas de ~3,5 m
        if (muyCerca > 0.004) micro = fbmTriCorto(vMundo, nrm, 2.6);   // grano de ~0,4 m
        // Cuarta escala, la de los últimos metros: gravilla, hojarasca y grumos
        // de ~12 cm. Sin ella el suelo bajo los pies es un manchón marrón
        // desenfocado, que era el peor defecto visual que quedaba: todo el
        // trabajo multiescala se terminaba antes de llegar a donde el jugador
        // realmente mira.
        float pasoCorto = 1.0 - smoothstep(1.2 * alcance, 16.0 * alcance, distVista);
        if (pasoCorto > 0.004) gravilla = fbmTriCorto(vMundo, nrm, 8.2);   // ~12 cm

        float detalle = macro;
        detalle = mix(detalle, mix(detalle, meso, 0.55), cercania);
        detalle = mix(detalle, mix(detalle, micro, 0.42), muyCerca);
        // La gravilla NO entra en el campo detalle: ese campo decide parches de
        // vegetación y vetas de roca, y meterle una frecuencia de 12 cm llenaba
        // el suelo de manchas negras del tamaño de una mano. Sirve para el
        // moteado del albedo y para la normal, no para la estructura.

        // ── Mezcla vegetal según el gradiente de lluvia oeste-este ──────────
        vec3 vegetacion = mix(estepa, bosqueSeco, smoothstep(0.22, 0.48, humedad));
        vegetacion = mix(vegetacion, bosqueHum, smoothstep(0.45, 0.78, humedad));

        // Parches: pastizal claro contra mata oscura. Una pradera nunca es de
        // un solo color, y esto es lo que rompe el aspecto de plastilina.
        // Se usa el mismo campo que desplazó los vértices, así el color
        // acompaña al relieve: las lomas se secan y las hondonadas verdean.
        float relieve = texture2D(uTexDetalle, vMundo.xz / uDetallePeriodo).r;
        float relieveFino = texture2D(uTexDetalle, vMundo.xz / (uDetallePeriodo * 0.21)).r;
        // Tercera lectura del mismo mosaico, con los ejes cambiados, un período
        // muy distinto y un corrimiento: rompe la correlación consigo mismo. Sin
        // esto, desde el aire el valle entero se ve como una grilla regular de
        // manchones verdes, que es el mosaico repitiéndose. Modula en vez de
        // sumarse, así que apaga el patrón sin aplanar el color.
        float relieveAncho = texture2D(uTexDetalle, vMundo.zx / (uDetallePeriodo * 3.7) + 0.37).r;
        float parche = clamp(0.5 + relieve * 0.85 * (0.45 + relieveAncho * 1.1)
                             + relieveFino * 0.45 * cercania
                             + (detalle - 0.5) * 0.7, 0.0, 1.0);

        vec3 pastoClaro = vegetacion * 1.05 + vec3(0.028, 0.030, 0.011);
        vec3 mataOscura = vegetacion * 0.44;
        vegetacion = mix(mataOscura, pastoClaro, smoothstep(0.24, 0.78, parche));
        // Tierra desnuda asomando entre las matas
        vegetacion = mix(vegetacion, suelo * 1.25, smoothstep(0.66, 0.96, 1.0 - parche) * 0.6);

        // Por encima de la línea de bosque no hay árboles: matorral y roca desnuda
        float sobreBosque = smoothstep(uLineaBosque - 160.0, uLineaBosque + 190.0, alt);
        vec3 tierra = mix(vegetacion, mix(pedregal * 0.82, pedregal * 1.16, grano), sobreBosque);

        // ── Roca madre ──────────────────────────────────────────────────────
        // El granito asoma antes de lo que sugiere la pendiente pura, y lo hace
        // en vetas irregulares, no en una franja pareja.
        float roca = smoothstep(0.26, 0.58, pend + (detalle - 0.5) * 0.30);
        vec3 colorRoca = mix(rocaOscura, rocaBase, grano);
        colorRoca = mix(colorRoca, colorRoca * (0.72 + 0.56 * micro), muyCerca);
        // Vetas y estratos del batolito
        if (roca > 0.004) {
          float veta = fbmTri(vMundo + vec3(0.0, alt * 0.12, 0.0), nrm, 0.09);
          colorRoca *= 0.84 + 0.32 * veta;
        }
        tierra = mix(tierra, colorRoca, roca);

        tierra = mix(tierra, suelo, smoothstep(0.30, 0.06, pend) * (1.0 - sobreBosque) * 0.22);

        // Oclusión de contacto: las hondonadas reciben menos cielo
        float hondonada = smoothstep(0.62, 0.18, macro);
        tierra *= 1.0 - hondonada * 0.16;

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

        // Variación de albedo de escala corta: piedritas claras, hojarasca
        // oscura. Se aplica sólo en los últimos metros y respeta la nieve, que
        // por definición tapa el detalle del suelo.
        float moteado = mix(0.5, gravilla, pasoCorto * (1.0 - mascaraNieve));
        tierra *= 0.90 + 0.20 * moteado;

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

        // Relieve fino en dos escalas, atenuado con la distancia para que no
        // hormiguee. El DEM tiene 32 m por texel: todo lo que pasa por debajo
        // de esa escala tiene que nacer acá.
        float dv = length(vViewPosition);
        float alcanceN = max(uDetalleAlcance, 0.02);
        float f1 = 1.0 - smoothstep(20.0 * alcanceN, 300.0 * alcanceN, dv);
        float f2 = 1.0 - smoothstep(3.0 * alcanceN, 40.0 * alcanceN, dv);

        // Normal del relieve fino, derivada de la MISMA textura que desplazó
        // los vértices. Si se usara otro ruido, la luz contaría una historia
        // distinta de la que cuenta la silueta.
        if (f1 > 0.004) {
          vec4 cobN = texture2D(uTexCobertura, vMundo.xz / uTamanoMundo + 0.5);
          float enTierra = 1.0 - smoothstep(0.15, 0.6, cobN.r);
          float e = uDetallePeriodo / 256.0;   // un texel del mosaico
          vec2 uvD = vMundo.xz / uDetallePeriodo;
          float dx = texture2D(uTexDetalle, uvD + vec2(e / uDetallePeriodo, 0.0)).r
                   - texture2D(uTexDetalle, uvD - vec2(e / uDetallePeriodo, 0.0)).r;
          float dz = texture2D(uTexDetalle, uvD + vec2(0.0, e / uDetallePeriodo)).r
                   - texture2D(uTexDetalle, uvD - vec2(0.0, e / uDetallePeriodo)).r;
          float k = uDetalleAmplitud * enTierra / (2.0 * e);
          normal = normalize(normal + vec3(-dx * k, 0.0, -dz * k));
        }

        // Rugosidad por debajo del relieve fino: grava, matas, grumos de suelo
        if (f2 > 0.004) {
          vec3 d2 = vec3(0.14, 0.0, 0.0), d4 = vec3(0.0, 0.0, 0.14);
          vec2 e2 = vec2(
            fbmTriCorto(vMundo + d2, normal, 3.4) - fbmTriCorto(vMundo - d2, normal, 3.4),
            fbmTriCorto(vMundo + d4, normal, 3.4) - fbmTriCorto(vMundo - d4, normal, 3.4)
          );
          normal = normalize(normal + vec3(e2.x, 0.0, e2.y) * 0.85 * f2);
        }

        // Y una escala más, la de los últimos metros: es la que hace que la luz
        // rasante de la mañana enganche en el grano del suelo en vez de resbalar
        // sobre una superficie lisa.
        float f3 = 1.0 - smoothstep(1.0, 11.0, dv);
        if (f3 > 0.001) {
          vec3 d5 = vec3(0.045, 0.0, 0.0), d6 = vec3(0.0, 0.0, 0.045);
          vec2 e3 = vec2(
            fbmTriCorto(vMundo + d5, normal, 9.0) - fbmTriCorto(vMundo - d5, normal, 9.0),
            fbmTriCorto(vMundo + d6, normal, 9.0) - fbmTriCorto(vMundo - d6, normal, 9.0)
          );
          normal = normalize(normal + vec3(e3.x, 0.0, e3.y) * 1.5 * f3);
        }
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
    this.uniformes.uCam.value.copy(this._camPos);

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
