/**
 * Mundo — capa de datos del terreno real de Bariloche.
 *
 * Carga el DEM generado por tools/build-dem.mjs y ofrece las consultas que
 * necesitan la física, la vegetación, la fauna y el clima:
 *   altura, normal, pendiente, agua, cauce, humedad, bioma.
 *
 * Sistema de coordenadas: +X Este, +Z Sur, +Y arriba (metros reales sobre el
 * nivel del mar). El origen cae en el centro del mundo (lat -41.10, lon -71.52).
 */

import * as THREE from 'three';

export const MPD_LAT = 111320;

/**
 * Relieve fino que el DEM no puede contener.
 *
 * El modelo de elevación tiene 32 m por texel: a la altura de los ojos, un
 * terreno así se lee como dunas de arcilla, porque no existe ningún accidente
 * por debajo de esa escala. Se le suma un campo de detalle repetible.
 *
 * La clave es que la GPU y la CPU calculen exactamente lo mismo. Replicar una
 * función de ruido en GLSL y en JavaScript no sirve: la precisión difiere y el
 * jugador termina flotando o hundido en el suelo que ve. Por eso el detalle es
 * una textura, muestreada con la misma interpolación bilineal de los dos lados.
 */
export const DETALLE = {
  resolucion: 256,   // texels del mosaico
  periodoM: 64,      // metros que abarca antes de repetirse
  amplitudM: 1.9,    // desnivel máximo que agrega
};

export class Mundo {
  constructor() {
    this.meta = null;
    this.N = 0;
    this.tamano = 0;
    this.mitad = 0;
    this.metrosPorTexel = 0;
    /** @type {Float32Array} altura en metros, N*N */
    this.altura = null;
    /** @type {Uint8Array} 255 = superficie de lago */
    this.agua = null;
    /** @type {Uint8Array} intensidad de cauce 0..255 */
    this.cauce = null;
    /** @type {Float32Array} pendiente en radianes */
    this.pendiente = null;
    /** @type {Float32Array} humedad relativa 0..1 (gradiente oeste-este + cercanía al agua) */
    this.humedad = null;
    this.alturaMin = 0;
    this.alturaMax = 0;
    this.mpdLon = 0;

    // Texturas para los shaders
    this.texAltura = null;
    this.texNormal = null;
    this.texCobertura = null; // R: agua, G: cauce, B: humedad, A: pendiente
  }

  async cargar(rutaBase = 'data/dem/', alProgresar = () => {}) {
    alProgresar(0.02, 'Leyendo el relieve del Nahuel Huapi…');
    this.meta = await (await fetch(rutaBase + 'meta.json')).json();

    const N = this.N = this.meta.resolucion;
    this.tamano = this.meta.tamanoM;
    this.mitad = this.tamano / 2;
    this.metrosPorTexel = this.meta.metrosPorTexel;
    this.alturaMin = this.meta.elevacionMin;
    this.alturaMax = this.meta.elevacionMax;
    this.mpdLon = 111320 * Math.cos(this.meta.centro.lat * Math.PI / 180);

    // ── Alturas: binario crudo de 16 bits, precisión completa para la física
    alProgresar(0.06, 'Cargando el modelo de elevación…');
    const bufAltura = await (await fetch(rutaBase + 'alturas.r16')).arrayBuffer();
    const crudo = new Uint16Array(bufAltura);
    if (crudo.length !== N * N) {
      throw new Error(`alturas.r16 mide ${crudo.length}, se esperaban ${N * N}`);
    }
    const escala = this.meta.alturaMaxCodificada / 65535;
    this.altura = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) this.altura[k] = crudo[k] * escala;

    // ── Máscaras de agua y cauces desde los PNG
    alProgresar(0.14, 'Trazando lagos y arroyos…');
    const [pxAlturas, pxRios] = await Promise.all([
      leerPNG(rutaBase + 'alturas.png'),
      leerPNG(rutaBase + 'rios.png'),
    ]);
    this.agua = new Uint8Array(N * N);
    this.cauce = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) {
      this.agua[k] = pxAlturas[k * 4 + 2];      // canal B
      this.cauce[k] = pxRios[k * 4];            // gris en R
    }

    alProgresar(0.18, 'Excavando el fondo de los lagos…');
    this._excavarLagos();

    alProgresar(0.2, 'Calculando pendientes…');
    this._calcularPendiente();
    alProgresar(0.26, 'Modelando el gradiente de humedad…');
    this._calcularHumedad();
    alProgresar(0.30, 'Tallando el relieve fino…');
    this._construirDetalle();
    alProgresar(0.32, 'Subiendo el terreno a la placa de video…');
    this._construirTexturas();
    alProgresar(0.36, 'Terreno listo.');
    return this;
  }

  /**
   * Batimetría: le da fondo a los lagos.
   *
   * El DEM Terrarium trae los lagos aplanados a la cota de su superficie —es un
   * modelo de elevación del terreno, no de la cubeta— y eso tenía una
   * consecuencia que se veía y no se entendía: el plano de agua quedaba a la
   * misma altura que el lecho, peleaban por el mismo píxel de profundidad y
   * ganaba el terreno. El Nahuel Huapi se veía como una playa de barro. El
   * color por absorción tampoco podía funcionar: con cero metros de agua
   * encima, Beer-Lambert no tiene nada que absorber.
   *
   * No hay batimetría real en el dataset, así que se estima por distancia a la
   * orilla, que es lo que hace la naturaleza en un lago glaciario: pared
   * empinada cerca de la costa y una cubeta profunda en el medio. Se calcula
   * con un barrido de distancia por celdas —dos pasadas, como una transformada
   * de distancia de chanfle— y se hunde el lecho con una raíz, para que la
   * caída sea rápida junto a la orilla y se vaya aplanando hacia el centro.
   */
  _excavarLagos() {
    const N = this.N, m = this.metrosPorTexel;
    const INF = 1e9;
    const dist = new Float32Array(N * N);

    // Distancia a la orilla, en celdas. Chanfle 3×3: la diagonal cuesta √2.
    for (let k = 0; k < N * N; k++) dist[k] = this.agua[k] > 127 ? INF : 0;
    const D = 1, DD = Math.SQRT2;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (dist[k] === 0) continue;
        let d = dist[k];
        if (i > 0) d = Math.min(d, dist[k - 1] + D);
        if (j > 0) d = Math.min(d, dist[k - N] + D);
        if (i > 0 && j > 0) d = Math.min(d, dist[k - N - 1] + DD);
        if (i < N - 1 && j > 0) d = Math.min(d, dist[k - N + 1] + DD);
        dist[k] = d;
      }
    }
    for (let j = N - 1; j >= 0; j--) {
      for (let i = N - 1; i >= 0; i--) {
        const k = j * N + i;
        if (dist[k] === 0) continue;
        let d = dist[k];
        if (i < N - 1) d = Math.min(d, dist[k + 1] + D);
        if (j < N - 1) d = Math.min(d, dist[k + N] + D);
        if (i < N - 1 && j < N - 1) d = Math.min(d, dist[k + N + 1] + DD);
        if (i > 0 && j < N - 1) d = Math.min(d, dist[k + N - 1] + DD);
        dist[k] = d;
      }
    }

    // Profundidad máxima por cuerpo, de los datos: el Nahuel Huapi tiene 464 m
    // medidos, pero para el ojo y para la física alcanza con una cubeta
    // creíble, y una fosa de 400 m debajo del jugador no aporta nada.
    const PROF_MAX = 120;
    // Metros de fondo por raíz de metro de distancia a la costa. Con 3,4 el
    // lago llega a 60 m a unos 300 m de la orilla, que es aproximadamente el
    // perfil real de un lago de origen glaciario.
    const CAIDA = 3.4;

    this.profundidadLago = new Float32Array(N * N);
    // La cota de la superficie, que es la que traía el DEM: hace falta guardarla
    // porque a partir de acá `altura` es el fondo, y media docena de sistemas
    // —la física de nado, los cardúmenes, el mapa— preguntan por la superficie.
    this.superficieLago = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) {
      if (this.agua[k] <= 127) continue;
      const dm = dist[k] * m;
      const prof = Math.min(PROF_MAX, CAIDA * Math.sqrt(dm));
      this.profundidadLago[k] = prof;
      this.superficieLago[k] = this.altura[k];
      this.altura[k] -= prof;
    }
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /** Índice de texel a partir de coordenadas de mundo, sin interpolar. */
  indiceDe(x, z) {
    const i = Math.round((x / this.tamano + 0.5) * (this.N - 1));
    const j = Math.round((z / this.tamano + 0.5) * (this.N - 1));
    if (i < 0 || i >= this.N || j < 0 || j >= this.N) return -1;
    return j * this.N + i;
  }

  /** Altura del DEM, sin el relieve fino. La usa el agua para el lecho. */
  alturaBaseEn(x, z) {
    const N = this.N;
    const fx = (x / this.tamano + 0.5) * (N - 1);
    const fz = (z / this.tamano + 0.5) * (N - 1);
    if (fx < 0 || fz < 0 || fx > N - 1 || fz > N - 1) return this.alturaMin;
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
    const sx = fx - i0, sz = fz - j0;
    const a = this.altura[j0 * N + i0], b = this.altura[j0 * N + i1];
    const c = this.altura[j1 * N + i0], d = this.altura[j1 * N + i1];
    return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
  }

  /**
   * Altura del terreno tal como se ve y se camina: el DEM más el relieve fino.
   * Tiene que coincidir texel a texel con lo que hace el shader de vértices, o
   * el jugador flota sobre el suelo o se hunde en él.
   */
  alturaEn(x, z) {
    const base = this.alturaBaseEn(x, z);
    if (!this.detalle) return base;
    return base + this.detalleEn(x, z) * DETALLE.amplitudM * this.factorDetalleEn(x, z);
  }

  /** Normal del terreno por diferencias centradas. */
  normalEn(x, z, salida = new THREE.Vector3()) {
    const e = this.metrosPorTexel;
    const hL = this.alturaEn(x - e, z), hR = this.alturaEn(x + e, z);
    const hD = this.alturaEn(x, z - e), hU = this.alturaEn(x, z + e);
    return salida.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  /** Pendiente en radianes (0 = llano, PI/2 = pared). */
  pendienteEn(x, z) {
    const k = this.indiceDe(x, z);
    return k < 0 ? 0 : this.pendiente[k];
  }

  /** ¿Hay superficie de lago acá? */
  esAgua(x, z) {
    const k = this.indiceDe(x, z);
    return k >= 0 && this.agua[k] > 127;
  }

  /** Intensidad de cauce 0..1. */
  cauceEn(x, z) {
    const k = this.indiceDe(x, z);
    return k < 0 ? 0 : this.cauce[k] / 255;
  }

  /** Humedad relativa 0..1: 1 = selva valdiviana, 0 = estepa. */
  humedadEn(x, z) {
    const k = this.indiceDe(x, z);
    return k < 0 ? 0.5 : this.humedad[k];
  }

  /**
   * Altura de la superficie: la del terreno, salvo sobre un lago, donde el
   * terreno es ahora el fondo y lo que se pisa —o se nada— es el espejo.
   */
  superficieEn(x, z) {
    const k = this.indiceDe(x, z);
    if (k >= 0 && this.agua[k] > 127 && this.superficieLago) return this.superficieLago[k];
    return this.alturaEn(x, z);
  }

  /** Cota del lago que cubre este punto, o null. */
  cotaLagoEn(x, z) {
    if (!this.esAgua(x, z)) return null;
    const h = this.superficieEn(x, z);
    let mejor = null, mejorD = Infinity;
    for (const l of this.meta.lagos) {
      const d = Math.abs(l.cota - h);
      if (d < mejorD) { mejorD = d; mejor = l; }
    }
    return mejorD < 12 ? mejor.cota : h;
  }

  /** Conversión a coordenadas geográficas reales, para la interfaz educativa. */
  aLatLon(x, z) {
    return {
      lat: this.meta.centro.lat - z / MPD_LAT,
      lon: this.meta.centro.lon + x / this.mpdLon,
    };
  }

  aMundo(lat, lon) {
    return {
      x: (lon - this.meta.centro.lon) * this.mpdLon,
      z: (this.meta.centro.lat - lat) * MPD_LAT,
    };
  }

  dentro(x, z) {
    return x >= -this.mitad && x <= this.mitad && z >= -this.mitad && z <= this.mitad;
  }

  // ── Precálculos ───────────────────────────────────────────────────────────

  _calcularPendiente() {
    const { N, altura, metrosPorTexel: e } = this;
    this.pendiente = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const jm = j > 0 ? j - 1 : 0, jp = j < N - 1 ? j + 1 : N - 1;
      for (let i = 0; i < N; i++) {
        const im = i > 0 ? i - 1 : 0, ip = i < N - 1 ? i + 1 : N - 1;
        const dx = (altura[j * N + ip] - altura[j * N + im]) / ((ip - im) * e);
        const dz = (altura[jp * N + i] - altura[jm * N + i]) / ((jp - jm) * e);
        this.pendiente[j * N + i] = Math.atan(Math.hypot(dx, dz));
      }
    }
  }

  /**
   * Humedad: la sombra de lluvia andina es el hecho ecológico que manda en
   * Bariloche. Cae de ~3500 mm/año en el oeste a ~600 mm en el este a lo largo
   * de apenas 60 km. Se modela como gradiente longitudinal, más un aporte
   * orográfico por altura y otro por cercanía al agua.
   */
  _calcularHumedad() {
    const { N, altura, agua } = this;
    this.humedad = new Float32Array(N * N);

    // Distancia al agua por barrido de dos pasadas (aproximación chamfer)
    const dist = new Float32Array(N * N).fill(1e9);
    for (let k = 0; k < N * N; k++) if (agua[k] > 127) dist[k] = 0;
    const paso = this.metrosPorTexel, diag = paso * 1.41421356;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      let d = dist[k];
      if (i > 0) d = Math.min(d, dist[k - 1] + paso);
      if (j > 0) d = Math.min(d, dist[k - N] + paso);
      if (i > 0 && j > 0) d = Math.min(d, dist[k - N - 1] + diag);
      if (i < N - 1 && j > 0) d = Math.min(d, dist[k - N + 1] + diag);
      dist[k] = d;
    }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
      const k = j * N + i;
      let d = dist[k];
      if (i < N - 1) d = Math.min(d, dist[k + 1] + paso);
      if (j < N - 1) d = Math.min(d, dist[k + N] + paso);
      if (i < N - 1 && j < N - 1) d = Math.min(d, dist[k + N + 1] + diag);
      if (i > 0 && j < N - 1) d = Math.min(d, dist[k + N - 1] + diag);
      dist[k] = d;
    }
    this.distanciaAgua = dist;

    // Calibración contra precipitación real medida a lo largo del gradiente.
    // En escala logarítmica la caída es casi recta, así que se interpola ahí:
    //   Puerto Blest ~4000 mm | Llao Llao ~1500 | Bariloche ~800 | Dina Huapi ~500
    this.precipitacion = new Float32Array(N * N);
    const U_BLEST = 0.1157;        // posición relativa de Puerto Blest en el mundo
    const LOG_BLEST = Math.log10(4000);
    const CAIDA_POR_U = 1.07;      // décadas de precipitación por ancho del mundo

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const u = i / (N - 1);     // 0 = oeste húmedo, 1 = este seco

        let logMm = LOG_BLEST - CAIDA_POR_U * (u - U_BLEST);
        // Efecto orográfico: las laderas altas interceptan más precipitación
        logMm += Math.min(0.13, Math.max(0, (altura[k] - 900) / 1600) * 0.13);
        logMm = Math.max(2.55, Math.min(3.75, logMm));
        this.precipitacion[k] = Math.pow(10, logMm);

        // De precipitación a humedad relativa 0..1 para la vegetación
        let h = (logMm - 2.55) / 1.05;
        // Mallines y bosque ribereño: la cercanía al agua sostiene vegetación
        // más exigente de la que le correspondería por lluvia.
        h += 0.14 * Math.exp(-dist[k] / 240);
        this.humedad[k] = Math.max(0, Math.min(1, h));
      }
    }
  }

  /** Precipitación media anual estimada en milímetros, para el códice. */
  precipitacionEn(x, z) {
    const k = this.indiceDe(x, z);
    return k < 0 ? 0 : this.precipitacion[k];
  }

  /**
   * Campo de detalle repetible. Se suman octavas de ruido de valor sobre
   * retículas periódicas, así el mosaico calza consigo mismo sin costura.
   */
  _construirDetalle() {
    const N = DETALLE.resolucion;
    const campo = new Float32Array(N * N);

    // Frecuencias que dividen exactamente la resolución: garantiza periodicidad
    const octavas = [
      { f: 2, a: 1.00 },
      { f: 4, a: 0.52 },
      { f: 8, a: 0.27 },
      { f: 16, a: 0.14 },
      { f: 32, a: 0.07 },
    ];

    const hash = (i, j, semilla) => {
      let n = (i * 374761393 + j * 668265263 + semilla * 1442695041) | 0;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (((n ^ (n >>> 16)) >>> 0) / 4294967295) * 2 - 1;
    };
    const suave = t => t * t * (3 - 2 * t);

    let suma = 0;
    for (const { a } of octavas) suma += a;

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let v = 0;
        let semilla = 1;
        for (const { f, a } of octavas) {
          const x = (i / N) * f, z = (j / N) * f;
          const x0 = Math.floor(x), z0 = Math.floor(z);
          const fx = suave(x - x0), fz = suave(z - z0);
          // El módulo por f es lo que cierra el mosaico sobre sí mismo
          const xa = ((x0 % f) + f) % f, xb = (xa + 1) % f;
          const za = ((z0 % f) + f) % f, zb = (za + 1) % f;
          const h00 = hash(xa, za, semilla), h10 = hash(xb, za, semilla);
          const h01 = hash(xa, zb, semilla), h11 = hash(xb, zb, semilla);
          v += a * ((h00 * (1 - fx) + h10 * fx) * (1 - fz)
                  + (h01 * (1 - fx) + h11 * fx) * fz);
          semilla++;
        }
        campo[j * N + i] = v / suma;
      }
    }

    this.detalle = campo;
    this.detalleN = N;

    this.texDetalle = new THREE.DataTexture(campo, N, N, THREE.RedFormat, THREE.FloatType);
    this.texDetalle.wrapS = this.texDetalle.wrapT = THREE.RepeatWrapping;
    this.texDetalle.magFilter = THREE.LinearFilter;
    this.texDetalle.minFilter = THREE.LinearFilter;
    this.texDetalle.generateMipmaps = false;
    this.texDetalle.needsUpdate = true;
  }

  /**
   * Detalle en un punto, con la misma interpolación bilineal que hace la GPU.
   * Devuelve -1..1.
   */
  detalleEn(x, z) {
    const N = this.detalleN;
    const u = (x / DETALLE.periodoM) * N;
    const v = (z / DETALLE.periodoM) * N;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const sx = u - i0, sz = v - j0;
    const ia = ((i0 % N) + N) % N, ib = (ia + 1) % N;
    const ja = ((j0 % N) + N) % N, jb = (ja + 1) % N;
    const d = this.detalle;
    const a = d[ja * N + ia], b = d[ja * N + ib];
    const c = d[jb * N + ia], e = d[jb * N + ib];
    return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + e * sx) * sz;
  }

  /**
   * Cuánto detalle corresponde acá. Se apaga sobre los lagos y en sus orillas:
   * un lecho ondulado atravesaría la superficie del agua.
   */
  factorDetalleEn(x, z) {
    const k = this.indiceDe(x, z);
    if (k < 0) return 0;
    if (this.agua[k] > 127) return 0;
    const d = this.distanciaAgua ? this.distanciaAgua[k] : 999;
    return Math.min(1, d / 24);
  }

  _construirTexturas() {
    const N = this.N;

    // Altura en dos canales: R el terreno —que dentro de un lago es el fondo— y
    // G la superficie, que sobre el agua es la cota del espejo y fuera de ella
    // repite la del terreno. El agua necesita las dos: la primera para saber
    // cuánto absorbe la columna y la segunda para saber cuál de los cuatro
    // planos de lago le corresponde a este punto. Quien sólo quiere el relieve
    // sigue leyendo el canal rojo y no se entera.
    const alt = new Float32Array(N * N * 2);
    for (let k = 0; k < N * N; k++) {
      alt[k * 2] = this.altura[k];
      alt[k * 2 + 1] = this.superficieLago && this.superficieLago[k] > 0
        ? this.superficieLago[k] : this.altura[k];
    }
    this.texAltura = new THREE.DataTexture(alt, N, N, THREE.RGFormat, THREE.FloatType);
    this.texAltura.magFilter = THREE.LinearFilter;
    this.texAltura.minFilter = THREE.LinearFilter;
    this.texAltura.wrapS = this.texAltura.wrapT = THREE.ClampToEdgeWrapping;
    this.texAltura.generateMipmaps = false;
    this.texAltura.needsUpdate = true;

    // Normales precalculadas en alta precisión (mejor que derivarlas en el shader)
    const nrm = new Uint8Array(N * N * 4);
    const e = this.metrosPorTexel;
    for (let j = 0; j < N; j++) {
      const jm = j > 0 ? j - 1 : 0, jp = j < N - 1 ? j + 1 : N - 1;
      for (let i = 0; i < N; i++) {
        const im = i > 0 ? i - 1 : 0, ip = i < N - 1 ? i + 1 : N - 1;
        const k = j * N + i;
        const dx = (this.altura[j * N + im] - this.altura[j * N + ip]);
        const dz = (this.altura[jm * N + i] - this.altura[jp * N + i]);
        const ex = (ip - im) * e, ez = (jp - jm) * e;
        let nx = dx / ex, ny = 2, nz = dz / ez;
        const inv = 1 / Math.hypot(nx, ny, nz);
        nx *= inv; ny *= inv; nz *= inv;
        nrm[k * 4] = Math.round((nx * 0.5 + 0.5) * 255);
        nrm[k * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        nrm[k * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        nrm[k * 4 + 3] = 255;
      }
    }
    this.texNormal = new THREE.DataTexture(nrm, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texNormal.magFilter = THREE.LinearFilter;
    this.texNormal.minFilter = THREE.LinearMipmapLinearFilter;
    this.texNormal.generateMipmaps = true;
    this.texNormal.anisotropy = 16;
    this.texNormal.needsUpdate = true;

    // Cobertura: R agua, G cauce, B humedad, A pendiente normalizada
    const cob = new Uint8Array(N * N * 4);
    for (let k = 0; k < N * N; k++) {
      cob[k * 4] = this.agua[k];
      cob[k * 4 + 1] = this.cauce[k];
      cob[k * 4 + 2] = Math.round(this.humedad[k] * 255);
      cob[k * 4 + 3] = Math.round(Math.min(1, this.pendiente[k] / (Math.PI / 2)) * 255);
    }
    this.texCobertura = new THREE.DataTexture(cob, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texCobertura.magFilter = THREE.LinearFilter;
    this.texCobertura.minFilter = THREE.LinearMipmapLinearFilter;
    this.texCobertura.generateMipmaps = true;
    this.texCobertura.anisotropy = 16;
    this.texCobertura.needsUpdate = true;
  }
}

/** Decodifica un PNG a Uint8ClampedArray RGBA usando el decodificador del navegador. */
async function leerPNG(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const lienzo = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const datos = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  bmp.close();
  return datos;
}
