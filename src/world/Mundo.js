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

// Los dos números del terreno que decide `sueloEn()`. Son uniformes fijos de
// Terreno.js (`uNieveSuavidad`, `uLineaBosque`, :260-261): nadie los mueve en
// juego, y si alguien los mueve allá tiene que moverlos acá.
const NIEVE_SUAVIDAD = 220;
const LINEA_BOSQUE = 1620;

/**
 * `smoothstep` de GLSL, fórmula incluida: el terreno lo usa con los bordes
 * invertidos —`smoothstep(0.62, 0.24, pend)`— y ahí da una bajada, no un error.
 */
function suave(e0, e1, v) {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

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
    // lago llega a 55 m a unos 300 m de la orilla, que es aproximadamente el
    // perfil real de un lago de origen glaciario.
    const CAIDA = 3.4;

    // ── La orilla ─────────────────────────────────────────────────────────
    //
    // La raíz sola hacía de la costa un pozo. La primera celda de agua está a
    // una celda de la tierra, 32 m, y ahí la raíz ya daba 19,2 m de fondo. El
    // lecho se lee con interpolación bilineal —en la física y en el vértice del
    // agua—, así que en la orilla visible, a mitad de camino entre la tierra y
    // esa celda, había 9,6 m de agua. Medido en 1132 orillas del DEM real: la
    // mediana daba 9,7 m en el primer punto de agua y el ancho con menos de
    // medio metro, cero en todas. No se podía vadear, y la espuma, que vive
    // debajo de 1,35 m, no tenía dónde dibujarse.
    //
    // Con celdas de 32 m la forma de la orilla la deciden DOS texels: el de
    // tierra y el primero de agua. Por eso el arreglo tiene dos mitades.
    //
    // 1. La primera corona de agua —la diagonal incluida— queda a ORILLA bajo
    //    el espejo, y la caída de la raíz empieza recién después de ella.
    // 2. La tierra que toca el agua queda al menos ORILLA POR ENCIMA del espejo.
    //    Medido en el DEM: el 45 % de esa tierra estaba por DEBAJO del agua
    //    (mediana +0,09 m, percentil 10 −0,46 m): el modelo aplanó la costa con
    //    el lago. Con la tierra a la cota del espejo la cuenta no cierra: la
    //    profundidad en la orilla visible es la mitad de la de la primera celda,
    //    y el ancho con menos de medio metro vale 16·(0,5 − d)/d metros, así que
    //    una orilla de 0,3 m obliga a una franja de 10,7 m y una de 0,2 m, a una
    //    de 24. Sin la berma, en las 1132 orillas, el 15 al 22 % arrancaba ya
    //    más hondo que medio metro, porque la tierra baja hundía la mezcla.
    //
    // Con la tierra a +ORILLA y el agua a −ORILLA, la línea donde el lecho
    // corta el espejo cae justo a mitad de camino, que es donde la máscara
    // cambia de tierra a agua: el agua empieza donde empieza la orilla, sin un
    // escalón seco antes ni un borde flotando. Es una playa del 5 %.
    //
    // Por qué 0,8 y no otro, medido igual: con 0,6 la franja de menos de medio
    // metro se ensancha a 13,5 m de mediana; con 1,0 baja a 8 m, pero en las
    // esquinas de la máscara —donde tres de las cuatro celdas que se mezclan son
    // agua— sube al 5-6 % la parte de orillas que ya arrancan más hondas que
    // medio metro, y levanta más tierra (media 0,87 m contra 0,67). Con 0,8, en
    // 1132 orillas y tres semillas de transectos: profundidad en la orilla
    // mediana 0,11 m y percentil 90 0,37; franja de 10 m de mediana y 5 m de
    // percentil 10; se vadean ~21 m antes de que el agua pase 1,1 m; y a 300 m
    // de la costa la cubeta queda al 94 % de la de antes. La tierra levantada
    // son 29 299 texels, el 0,7 % del mundo, con 1,55 m como máximo.
    const ORILLA = 0.8;
    const PRIMERA_CORONA = Math.SQRT2 + 1e-3;    // celdas: vecina o diagonal de tierra

    this.profundidadLago = new Float32Array(N * N);
    // La cota de la superficie, que es la que traía el DEM: hace falta guardarla
    // porque a partir de acá `altura` es el fondo, y media docena de sistemas
    // —la física de nado, los cardúmenes, el mapa— preguntan por la superficie.
    this.superficieLago = new Float32Array(N * N);
    // Tierra que toca el agua → la cota mínima que tiene que tener. Son unos
    // 29 000 texels, así que un mapa y no un arreglo de 4 millones.
    const berma = new Map();
    for (let k = 0; k < N * N; k++) {
      if (this.agua[k] <= 127) continue;
      const espejo = this.altura[k];
      let prof;
      if (dist[k] <= PRIMERA_CORONA) {
        prof = ORILLA;
        const i = k % N, j = (k - i) / N;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= N) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= N) continue;
            const v = jj * N + ii;
            if (this.agua[v] > 127) continue;
            // La más baja de las que la tocan: una lengua de tierra entre dos
            // lagos no se levanta hasta la cota del de arriba.
            const previa = berma.get(v);
            if (previa === undefined || espejo + ORILLA < previa) berma.set(v, espejo + ORILLA);
          }
        }
      } else {
        prof = Math.min(PROF_MAX, ORILLA + CAIDA * Math.sqrt((dist[k] - PRIMERA_CORONA) * m));
      }
      this.profundidadLago[k] = prof;
      this.superficieLago[k] = espejo;
      this.altura[k] = espejo - prof;
    }
    // Sólo se levanta: la tierra que ya estaba más alta queda como estaba.
    let levantados = 0;
    for (const [v, cota] of berma) {
      if (this.altura[v] < cota) { this.altura[v] = cota; levantados++; }
    }
    this.texelsBerma = levantados;
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /**
   * Coordenada de texel de un punto del mundo, en la MISMA convención que usa
   * la GPU al muestrear las texturas del terreno.
   *
   * Esto no es un detalle: el shader hace `texture2D(tex, xz / tamano + 0.5)`, y
   * en OpenGL el centro del texel i cae en (i + 0.5) / N. La CPU venía mapeando
   * a i / (N - 1) —los texels extremos en los bordes exactos—, que es la
   * convención de una malla de vértices, no la de una textura. La diferencia es
   * de medio texel como máximo, pero acá un texel mide 32 m: cerca del borde del
   * mundo la física leía el relieve desplazado hasta 16 m en horizontal, y sobre
   * una ladera eso son varios metros de altura. El terreno dibujado quedaba por
   * encima del suelo que pisaba el jugador y la cámara aparecía hundida.
   *
   * @returns {number} coordenada continua 0..N-1, ya recortada al borde
   */
  _texelDe(w) {
    const t = (w / this.tamano + 0.5) * this.N - 0.5;
    return Math.max(0, Math.min(this.N - 1, t));
  }

  /** Índice de texel a partir de coordenadas de mundo, sin interpolar. */
  indiceDe(x, z) {
    if (!this.dentro(x, z)) return -1;
    const i = Math.min(this.N - 1, Math.max(0, Math.round(this._texelDe(x))));
    const j = Math.min(this.N - 1, Math.max(0, Math.round(this._texelDe(z))));
    return j * this.N + i;
  }

  /** Altura del DEM, sin el relieve fino. La usa el agua para el lecho. */
  alturaBaseEn(x, z) {
    const N = this.N;
    if (!this.dentro(x, z)) return this.alturaMin;
    const fx = this._texelDe(x);
    const fz = this._texelDe(z);
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

  /**
   * ¿Esto es orilla? Doce metros de agua a la redonda, o un cauce marcado.
   *
   * Vive acá y no en quien pregunta porque lo preguntan dos sistemas que no se
   * conocen entre sí —la recolección, para dar arcilla; los hallazgos, para
   * marcarla en el mapa— y ya se pagó una vez tenerlo escrito dos veces: uno de
   * los dos quedó en 3 m cuando el otro pasó a 12, y el mapa habría marcado el
   * 6 % de la arcilla que el juego entrega.
   *
   * Doce metros no es un número cómodo: la arcilla se deposita en la planicie de
   * inundación y en la barranca, no en la línea del agua. Es el mismo radio con
   * el que `Mineria.yacimientoEn()` decide un banco de arena.
   */
  orillaCerca(x, z) {
    for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]]) {
      if (this.esAgua(x + dx, z + dz)) return true;
    }
    return this.cauceEn(x, z) > 0.15;
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

  /**
   * Qué hay bajo los pies: 'agua' | 'nieve' | 'roca' | 'pasto' | 'hojarasca'.
   *
   * Es la MISMA decisión con la que el sombreador del terreno pinta el suelo
   * (Terreno.js:613-640), con las mismas entradas leídas de las mismas
   * texturas y con la misma interpolación, para que el paso suene a lo que se
   * ve. Lo único que no se replica es el ruido de detalle —`macro`, `meso` y
   * `micro` mezclados en `detalle`—, que en la GPU corre unos metros las vetas
   * de roca y los manchones de nieve: acá vale 0,5, su centro. En esas franjas
   * el oído y el ojo pueden no coincidir, y es a propósito: una fbm triplanar
   * en la CPU no se oye y cuesta precisión.
   *
   * El orden es el del sombreador leído de arriba hacia abajo, porque cada capa
   * se pinta encima de la anterior:
   *   1. agua, si la máscara lo dice;
   *   2. nieve, si su máscara llega a la mitad;
   *   3. roca, por pendiente o por encima de la línea de bosque (el pedregal);
   *   4. pasto, en la estepa y el coironal (humedad < 0,45);
   *   5. hojarasca, el piso del bosque.
   *
   * Se consulta por paso, no por cuadro.
   * @param {number} cotaNieve la de `Tiempo.estado()`, la misma que recibe el terreno
   */
  sueloEn(x, z, cotaNieve = 1750) {
    if (this.esAgua(x, z)) return 'agua';
    const alt = this.alturaEn(x, z);
    const m = this._muestra ??= new Float64Array(4);

    // Terreno.js:453-455: normalize(texture2D(uTexNormal).xyz * 2 − 1), y la
    // pendiente es 1 − y. OJO: es la normal de la TEXTURA y no la de
    // `normalEn()`. `_construirTexturas` la arma con 2 en la vertical sobre
    // diferencias ya divididas por la distancia, donde la geométrica lleva 1:
    // queda más parada, y la roca del sombreador sale de ESA pendiente.
    this._leerRGBA(this.texNormal.image.data, x, z, m);
    const nx = m[0] * 2 - 1, ny = m[1] * 2 - 1, nz = m[2] * 2 - 1;
    const pend = 1 - Math.max(0, Math.min(1, ny / (Math.hypot(nx, ny, nz) || 1)));
    // :451, canal azul de la cobertura
    this._leerRGBA(this.texCobertura.image.data, x, z, m);
    const humedad = m[2];
    const detalle = 0.5;

    // :636-639
    const nieveAlt = suave(cotaNieve - NIEVE_SUAVIDAD, cotaNieve + NIEVE_SUAVIDAD, alt);
    const nievePend = suave(0.62, 0.24, pend);
    const mascaraNieve = Math.min(1, nieveAlt * nievePend + nieveAlt * 0.12)
      * (1 - suave(0.0, 0.35, detalle * 0.5 - 0.08));
    if (mascaraNieve >= 0.5) return 'nieve';

    // :619 la roca madre, :613 el pedregal por encima del bosque
    if (suave(0.26, 0.58, pend + (detalle - 0.5) * 0.30) >= 0.5) return 'roca';
    if (suave(LINEA_BOSQUE - 160, LINEA_BOSQUE + 190, alt) >= 0.5) return 'roca';

    return humedad < 0.45 ? 'pasto' : 'hojarasca';
  }

  /**
   * Lectura bilineal de una textura RGBA de 8 bits del tamaño del DEM, en 0..1
   * y en la convención de la GPU (ver `_texelDe`). Es lo que devuelve
   * `texture2D` sobre esas texturas con filtro lineal y de cerca, donde un
   * texel de 32 m se magnifica y no entra ningún mipmap.
   */
  _leerRGBA(datos, x, z, salida) {
    const N = this.N;
    const fx = this._texelDe(x), fz = this._texelDe(z);
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
    const sx = fx - i0, sz = fz - j0;
    const a = (j0 * N + i0) * 4, b = (j0 * N + i1) * 4;
    const c = (j1 * N + i0) * 4, d = (j1 * N + i1) * 4;
    for (let ch = 0; ch < 4; ch++) {
      salida[ch] = ((datos[a + ch] * (1 - sx) + datos[b + ch] * sx) * (1 - sz)
                  + (datos[c + ch] * (1 - sx) + datos[d + ch] * sx) * sz) / 255;
    }
    return salida;
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
    // El medio texel de menos es la convención de la GPU, igual que en _texelDe.
    // Acá el texel mide 25 cm, así que el error era chico, pero es gratis que
    // los dos lados lean exactamente el mismo número.
    const u = (x / DETALLE.periodoM) * N - 0.5;
    const v = (z / DETALLE.periodoM) * N - 0.5;
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
   *
   * Tiene que ser LA MISMA función que `leerDetalle()` en el shader del terreno:
   * una lectura bilineal de la máscara de agua y un smoothstep(0.15, 0.6) sobre
   * ella. Antes acá se usaba una rampa por distancia a la costa (d / 24 m) que
   * no existe en la GPU, y en la franja de orilla la física apagaba un relieve
   * que el terreno seguía dibujando.
   *
   * Lo que el shader hace de más —desvanecer el detalle cuando el nodo es tan
   * grueso que sus cuadros no pueden representarlo— no se replica a propósito:
   * en los 190 m alrededor de la cámara el nodo siempre es el más fino, con
   * cuadros de 2 m, y ahí ese factor vale exactamente 1. Fuera de ese radio no
   * hay física que resolver.
   */
  factorDetalleEn(x, z) {
    if (!this.dentro(x, z)) return 0;
    const N = this.N;
    const fx = this._texelDe(x), fz = this._texelDe(z);
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
    const sx = fx - i0, sz = fz - j0;
    const A = this.agua;
    const a = A[j0 * N + i0], b = A[j0 * N + i1];
    const c = A[j1 * N + i0], d = A[j1 * N + i1];
    const agua = ((a * (1 - sx) + b * sx) * (1 - sz)
                + (c * (1 - sx) + d * sx) * sz) / 255;
    const t = Math.max(0, Math.min(1, (agua - 0.15) / (0.6 - 0.15)));
    return 1 - t * t * (3 - 2 * t);
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
