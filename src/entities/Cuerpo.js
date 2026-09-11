/**
 * Cuerpo — el modelo del jugador, generado con geometría, como todo acá.
 *
 * No hay archivos de modelo en SurviBar: el terreno sale del relieve real, los
 * árboles se generan, el sonido se sintetiza. El cuerpo sigue esa regla. Pero
 * "generado" no quiere decir "cajas": la primera versión eran nueve prismas
 * apilados y se veía exactamente como lo que era, un maniquí de prueba parado
 * en medio de un bosque dibujado con cuidado.
 *
 * Lo que cambia acá, y por qué funciona:
 *
 * - **Volúmenes torneados, no prismas.** Troncos de cono de diez lados, con
 *   radio distinto arriba y abajo. Un torso que se afina en la cintura y se
 *   ensancha en el pecho ya lee como un cuerpo; una caja no lee como nada.
 * - **Sección ovalada.** Una persona es bastante más ancha de hombro a hombro
 *   que de pecho a espalda. Se consigue achatando el eje Z, y es probablemente
 *   el cambio que más hace por la silueta con menos geometría.
 * - **Articulaciones esféricas.** Hombros, codos y rodillas llevan una esfera
 *   que tapa la juntura. Sin ella se ven dos tubos que se cruzan.
 * - **Rodillas y codos que doblan.** Una pierna rígida que pivota en la cadera
 *   es un compás. Doblar la rodilla en la fase de vuelo —cuando el pie tiene
 *   que despegar para no arrastrarse— es lo que convierte el ciclo en una
 *   caminata.
 *
 * Sigue siendo de pocos polígonos a propósito: el mundo es facetado y un
 * personaje suave adentro se vería pegado encima.
 *
 * Dos decisiones más que vale la pena dejar escritas:
 *
 * - **El cuerpo también existe en primera persona**, y sólo se ocultan la
 *   cabeza y el cuello, que van juntos. Mirás hacia abajo y ves tu torso y tus
 *   piernas caminando, y proyectás sombra. Un jugador que no tiene sombra al
 *   mediodía es un fantasma; en un juego cuyo tema es estar en un lugar real,
 *   eso se nota aunque nadie sepa decir por qué.
 * - **El modelo está hecho para 1,78 m y se escala.** Así la estatura elegida
 *   cambia el tamaño de la silueta y no sólo la altura de la cámara.
 *
 * Y desde la ronda 5, **lo que se lleva en la mano**. Tres cosas que conviene
 * tener a la vista antes de tocar esta parte:
 *
 * - La mano es un `Group` de verdad (`this.manos`), no la esfera de la palma.
 *   La esfera tenía la geometría trasladada 28 cm y el objeto en el origen: su
 *   matriz de mundo daba el **codo**, y colgar un hacha de ahí la ponía en el
 *   antebrazo.
 * - Los modelos se cachean **por instancia**, no por módulo: `aplicar()` libera
 *   todas las geometrías del cuerpo y un caché global quedaría apuntando a
 *   geometrías muertas apenas alguien cambiara de peinado.
 * - Los materiales de las herramientas se piden por el mismo `_material()` que
 *   el resto del cuerpo, sin ninguna bandera que cambie la clave del programa.
 *   Por eso **cambiar de herramienta no compila nada**: el programa ya está
 *   compilado desde la carga, es el del torso.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { construirHerramienta, PALETA } from './Herramientas3D.js';

/** Estatura para la que están escritas todas las medidas de acá abajo. */
const BASE = 1.78;
/** Lados de los cilindros. Diez es donde deja de verse el prisma y todavía es barato. */
const LADOS = 10;
/** Lados del torso y del cráneo, que son lo que más se mira. */
const LADOS_FINOS = 14;

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();

/** Mueve, gira y estira una geometría en su sitio. Devuelve la misma. */
function poner(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ex = 1, ey = 1, ez = 1 } = {}) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q, _s.set(ex, ey, ez)));
  return g;
}

/**
 * Volumen de revolución a partir de un perfil `[[radio, y], …]`, **ordenado de
 * abajo hacia arriba**, que es el orden en que three saca las normales hacia
 * afuera.
 *
 * Reemplaza al tronco de cono de antes. Un cono recto tiene dos radios y nada
 * en el medio: un brazo es un tubo que se afina, no un bíceps. Con un perfil de
 * cinco puntos el mismo dibujo trae el hombro, el bíceps y la muñeca, y cuesta
 * ochenta triángulos. `aplanado` achata el eje Z, para sección ovalada.
 *
 * El radio nunca llega a cero exacto: un vértice de radio 0 repetido deja la
 * normal indefinida y se ve una mancha negra en la punta.
 */
function torneado(perfil, seg = LADOS, aplanado = 1) {
  const pts = perfil.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const g = new THREE.LatheGeometry(pts, seg);
  if (aplanado !== 1) g.scale(1, 1, aplanado);
  return g;
}

/** Esfera. `alt` son los anillos: seis para una articulación, doce para el cráneo. */
function bola(radio, ancho = LADOS, alto = 6) {
  return new THREE.SphereGeometry(radio, ancho, alto);
}

/** Prisma centrado en su origen. */
function caja(x, y, z) {
  return new THREE.BoxGeometry(x, y, z);
}

/** Cápsula acostada o parada; el eje es Y. */
function capsula(radio, largo, seg = 8) {
  return new THREE.CapsuleGeometry(radio, largo, 3, seg);
}

/**
 * Empuja los vértices de una geometría con una función.
 *
 * Es lo que convierte una esfera en una cabeza: el occipucio sale para atrás,
 * la frente se aplana, las sienes se angostan y la base se estrecha hacia la
 * mandíbula. Una esfera escalada no hace nada de eso y se ve como lo que es.
 */
function moldear(g, fn) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    fn(_v);
    p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Cuelga de un nudo **una sola malla por material**, fusionando todas sus
 * piezas.
 *
 * Es la mejora más barata del cuadro que tenía este archivo: la animación es por
 * transformación de nudo —el codo gira y todo lo que cuelga de él lo acompaña—,
 * así que fusionar dentro del nudo no cambia un solo pixel y saca dibujos. La
 * cabeza eran diez mallas y ahora son tres; el pie, cuatro y ahora una.
 *
 * `piezas` es `[{ g, m }]`: geometría y material.
 */
function armar(nudo, piezas) {
  const porMaterial = new Map();
  for (const { g, m } of piezas) {
    if (!porMaterial.has(m)) porMaterial.set(m, []);
    porMaterial.get(m).push(g);
  }
  for (const [m, gs] of porMaterial) {
    let geo = gs[0];
    if (gs.length > 1) {
      geo = mergeGeometries(gs, false);
      // `mergeGeometries` devuelve null y sólo escribe en consola si las piezas
      // no coinciden en atributos o en indexado. Sin esta guarda el defecto
      // aparece mucho después, como una malla sin geometría.
      if (!geo) throw new Error(`Cuerpo: no se pudieron fusionar ${gs.length} piezas`);
      for (const g of gs) g.dispose();
    }
    const malla = new THREE.Mesh(geo, m);
    malla.castShadow = true;
    // `receiveShadow` queda apagado, como siempre: entra en la clave del
    // programa, y todo el cuerpo —herramientas incluidas— comparte una sola.
    nudo.add(malla);
  }
  return nudo;
}

export class Cuerpo {
  /**
   * @param {import('../systems/Aspecto.js').Aspecto} aspecto
   * @param {(material: THREE.Material) => void} [registrarMaterial] enganche a
   *        las sombras en cascada; sin él el cuerpo no recibe la sombra del sol.
   */
  constructor(aspecto, registrarMaterial) {
    this.registrarMaterial = registrarMaterial;
    this.grupo = new THREE.Group();
    this.grupo.name = 'jugador';
    // El cuerpo se dibuja siempre: está a pocos metros de la cámara y el recorte
    // por volumen se equivoca justo cuando la cámara gira sobre él.
    this.grupo.frustumCulled = false;

    this.fase = 0;
    this._materiales = [];
    this._agachadoSuave = 0;
    /** Cuánto de la pose de «llevar algo» está aplicada, de 0 a 1. */
    this._cargaSuave = 0;

    // ── Lo que se lleva en la mano. Todo esto tiene que existir ANTES de
    // `aplicar()`, porque `aplicar()` llama a `_limpiar()` y `_limpiar()` los
    // vacía.
    /** @type {string|null} el id del objeto en la mano derecha. */
    this._enMano = null;
    /** @type {Map<string, THREE.Group>} modelo ya construido, por id. */
    this._modelos = new Map();
    /** @type {Map<string, THREE.Material>} la paleta compartida, por nombre. */
    this._paleta = new Map();
    this._modeloEnMano = null;
    this._punto = new THREE.Vector3();

    this.aplicar(aspecto);
  }

  // ── Construcción ──────────────────────────────────────────────────────────

  _material(color, rugosidad = 0.86) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: 0 });
    this.registrarMaterial?.(m);
    this._materiales.push(m);
    return m;
  }

  /**
   * Rehace el modelo entero con un aspecto nuevo.
   *
   * Todo lo que se construye acá se junta en listas de piezas por nudo y se
   * cuelga con `armar()`, que fusiona **una malla por material**. Eso es lo que
   * permitió meterle detalle al personaje sin pagarlo en dibujos: pasó de 32
   * mallas a 20 y de 2486 triángulos a unos 5000, con los mismos seis
   * materiales.
   */
  aplicar(aspecto) {
    this.aspecto = aspecto;
    this._limpiar();

    const piel = this._material(aspecto.colorPiel, 0.92);
    const campera = this._material(aspecto.colorCampera);
    // La campera oscurecida hace de cuello, puños y cintura: es el mismo color
    // leído como sombra, así que separa las piezas sin inventar una paleta.
    const ribete = this._material(
      new THREE.Color(aspecto.colorCampera).multiplyScalar(0.62).getHex(), 0.9);
    const pantalon = this._material(aspecto.colorPantalon);
    const pelo = this._material(aspecto.colorPelo, 0.95);
    const bota = this._material(0x2e2620, 0.88);

    const a = aspecto.anchoCuerpo;    // la complexión ensancha, no estira
    const OVAL = 0.66;                // achatamiento en Z del pecho
    const OVAL_BAJO = 0.74;           // la cadera es bastante más redonda

    // ── Torso: cuelga de la cadera (0,92) y llega al hombro (1,44)
    //
    // Eran tres conos rectos apilados. Ahora son tres volúmenes de revolución
    // que comparten los radios en las junturas, así que el torso es una sola
    // superficie continua: se ensancha en el pecho, entra en la cintura y
    // vuelve a abrirse en la cadera, y arriba cierra en un canesú que envuelve
    // el nacimiento del cuello. Un cono no puede hacer nada de eso.
    const tronco = new THREE.Group();
    tronco.position.y = 0.92;
    armar(tronco, [
      { m: campera, g: torneado([
        [0.176 * a, 0.12], [0.180 * a, 0.18], [0.187 * a, 0.25], [0.198 * a, 0.32],
        [0.209 * a, 0.39], [0.212 * a, 0.45], [0.203 * a, 0.495], [0.160 * a, 0.525],
        [0.090 * a, 0.545], [0.060 * a, 0.552], [0, 0.552],
      ], LADOS_FINOS, OVAL) },
      // El cinturón: siete centímetros, lo justo para separar sin partir la
      // silueta en tres. Abomba apenas en el medio, como un cinto puesto.
      { m: ribete, g: torneado([
        [0.174 * a, 0.05], [0.181 * a, 0.085], [0.176 * a, 0.12],
      ], LADOS_FINOS, OVAL_BAJO) },
      { m: pantalon, g: torneado([
        [0, -0.085], [0.118 * a, -0.080], [0.156 * a, -0.046], [0.170 * a, 0],
        [0.174 * a, 0.05],
      ], LADOS_FINOS, OVAL_BAJO) },
    ]);
    this.tronco = tronco;
    this.grupo.add(tronco);

    // ── Cabeza. En su propio grupo porque en primera persona se apaga sola.
    const cabeza = new THREE.Group();
    cabeza.position.y = 0.52;                 // base del cuello → 1,44
    armar(cabeza, [...this._rostro(aspecto, a, piel, pelo, bota)]);
    this.cabeza = cabeza;
    tronco.add(cabeza);

    // ── Brazos: hombro → codo → mano
    this.brazos = [];
    this.codos = [];
    /**
     * Los dos nudos de la mano, guardados como `this.codos`. **El índice 1 es
     * el lado +x, la mano derecha**, que es de la que cuelgan las herramientas.
     *
     * Es un `Group` y no la malla de la palma a propósito: antes la palma se
     * construía con la geometría trasladada 28 cm y el objeto en el origen del
     * codo, así que su `matrixWorld` daba el **codo**, 28 cm más arriba de donde
     * está la mano. Acá el grupo lleva el desplazamiento en `position`.
     * @type {THREE.Group[]}
     */
    this.manos = [];
    for (const lado of [-1, 1]) {
      const hombro = new THREE.Group();
      hombro.position.set(lado * (0.195 * a), 0.50, 0);
      armar(hombro, [
        { m: campera, g: bola(0.076 * a, LADOS, 8) },                  // deltoides
        // Brazo: el perfil trae el bíceps. Un cono recto de hombro a codo se
        // lee como un caño, y es lo que más delataba al maniquí.
        { m: campera, g: torneado([
          [0.050 * a, -0.29], [0.056 * a, -0.22], [0.065 * a, -0.12],
          [0.068 * a, -0.06], [0.064 * a, 0],
        ]) },
      ]);

      const codo = new THREE.Group();
      codo.position.y = -0.29;
      armar(codo, [
        { m: ribete, g: poner(bola(0.050 * a, LADOS, 6), { ey: 0.92 }) },  // puño de la manga
        { m: piel, g: torneado([
          [0.037 * a, -0.26], [0.041 * a, -0.20], [0.049 * a, -0.10],
          [0.052 * a, -0.04], [0.048 * a, 0],
        ]) },
      ]);

      // La mano deja de ser una esfera achatada. Con palma, mitón de dedos y
      // pulgar se lee como una mano desde cuatro metros, que es de donde se la
      // mira en tercera persona; y el pulgar es lo que dice de qué lado va.
      const mano = new THREE.Group();
      mano.position.y = -0.28;
      armar(mano, [
        { m: piel, g: poner(bola(0.048 * a, LADOS, 8), { y: -0.012, ex: 0.92, ey: 1.12, ez: 0.54 }) },
        { m: piel, g: poner(capsula(0.019 * a, 0.048), { y: -0.072, ex: 1.55, ez: 0.62 }) },
        { m: piel, g: poner(capsula(0.015 * a, 0.030), {
          x: lado * -0.030 * a, y: -0.028, z: -0.020, rx: -0.55, rz: lado * 0.75 }) },
      ]);
      codo.add(mano);

      hombro.add(codo);
      this.brazos.push(hombro);
      this.codos.push(codo);
      this.manos.push(mano);
      tronco.add(hombro);
    }

    // ── Piernas: cadera → rodilla → pie
    this.piernas = [];
    this.rodillas = [];
    for (const lado of [-1, 1]) {
      const muslo = new THREE.Group();
      muslo.position.set(lado * (0.095 * a), 0.92, 0);
      armar(muslo, [
        { m: pantalon, g: bola(0.100 * a, LADOS, 8) },
        { m: pantalon, g: torneado([
          [0.072 * a, -0.44], [0.078 * a, -0.36], [0.092 * a, -0.20],
          [0.100 * a, -0.10], [0.098 * a, 0],
        ]) },
      ]);

      const rodilla = new THREE.Group();
      rodilla.position.y = -0.44;
      armar(rodilla, [
        { m: pantalon, g: poner(bola(0.072 * a, LADOS, 6), { ez: 0.94 }) },
        // Pantorrilla: el gemelo arriba y el tobillo fino abajo.
        { m: pantalon, g: torneado([
          [0.050 * a, -0.40], [0.052 * a, -0.34], [0.063 * a, -0.22],
          [0.070 * a, -0.12], [0.072 * a, 0],
        ]) },
        // ── El pie. Era una cápsula acostada de 22 cm: un salamín.
        //
        // Un pie de alguien de 1,78 m mide 26 cm, y con bota 28. Este va de
        // z = −0,19 (punta) a z = +0,10 (talón), apoya en y = −0,467 —la misma
        // cota de siempre, que es la que deja al cuerpo parado en y = 0— y
        // tiene talón, planta, empeine y caña. Es lo que toca el suelo: es la
        // pieza donde más se nota que algo no es una persona.
        { m: bota, g: torneado([
          [0.060 * a, -0.40], [0.065 * a, -0.345], [0.062 * a, -0.29],
        ]) },
        { m: bota, g: poner(caja(0.086 * a, 0.030, 0.235), { y: -0.452, z: -0.035 }) },
        { m: bota, g: poner(caja(0.082 * a, 0.088, 0.130), { y: -0.412, z: -0.020, rx: 0.10 }) },
        { m: bota, g: poner(bola(0.045, LADOS, 6), { y: -0.440, z: -0.140, ex: 0.96 * a, ey: 0.60, ez: 1.05 }) },
        { m: bota, g: poner(bola(0.040, 8, 6), { y: -0.430, z: 0.058, ex: 1.02 * a, ey: 0.92, ez: 0.95 }) },
      ]);

      muslo.add(rodilla);
      this.piernas.push(muslo);
      this.rodillas.push(rodilla);
      this.grupo.add(muslo);
    }

    // La escala convierte el modelo de 1,78 en el de la estatura elegida
    this.grupo.scale.setScalar(aspecto.estatura / BASE);

    // Cambiar de aspecto no tiene por qué soltar el hacha: `_limpiar()` acaba de
    // tirar el modelo viejo con sus geometrías, así que se reconstruye.
    if (this._enMano) this._colgar(this._enMano);
  }

  /**
   * La cabeza entera, como lista de piezas: cuello, cráneo, cara, orejas, ojos
   * y pelo. Sale en **tres mallas** —piel, pelo y el par de ojos con la boca—
   * donde antes eran diez.
   *
   * El criterio es el de la ronda 3: acá no hay texturas, así que todo lo que
   * hace que una cabeza sea una cabeza tiene que estar en la forma. Un cráneo
   * ovoide con mandíbula ya lo tenía; lo que faltaba era la línea de la cara
   * —arco superciliar, pómulos, mentón— y, sobre todo, **los ojos**: son el
   * único rasgo que a cuatro metros convierte una figura en alguien.
   */
  _rostro(aspecto, a, piel, pelo, bota) {
    const piezas = [];
    const P = (m, g) => piezas.push({ m, g });

    // Cuello: se ensancha abajo, donde nacen los trapecios.
    P(piel, torneado([
      [0.078 * a, -0.030], [0.072 * a, 0.010], [0.063 * a, 0.055], [0.059 * a, 0.105],
    ], LADOS, 0.90));

    // Cráneo: una esfera fina, moldeada. El occipucio sale para atrás, la frente
    // se aplana, las sienes se angostan arriba y la base se estrecha hacia la
    // mandíbula. Sin el moldeado es un huevo, y se nota.
    const craneo = moldear(bola(0.108, LADOS_FINOS + 2, 12), (v) => {
      const t = v.y / 0.108;                        // −1 abajo, +1 arriba
      if (v.z > 0) v.z *= 1 + 0.12 * Math.max(0, t);            // nuca
      if (v.z < 0 && t > 0.10) v.z *= 0.88;                     // frente plana
      if (t > 0.45) v.x *= 1 - 0.14 * (t - 0.45) / 0.55;        // sienes
      if (t < -0.20) {
        const k = (-0.20 - t) / 0.80;
        v.x *= 1 - 0.24 * k;
        v.z *= 1 - 0.12 * k;
      }
    });
    P(piel, poner(craneo, { y: 0.215, ex: 0.95, ey: 1.13, ez: 1.02 }));

    // Arco superciliar: la sombra que tira es lo que da ojos hundidos sin
    // modelar una cuenca.
    P(piel, poner(bola(0.036, 10, 5), { y: 0.228, z: -0.082, ex: 2.35, ey: 0.42, ez: 0.55 }));

    // Mandíbula y mentón: sin ellos el ovoide es un huevo y la cara no tiene
    // frente contra la que leerse.
    P(piel, poner(bola(0.078, 12, 8), { y: 0.155, z: -0.012, ex: 0.92, ey: 0.80, ez: 1.06 }));
    P(piel, poner(bola(0.030, 8, 6), { y: 0.132, z: -0.070, ex: 0.95, ey: 0.72, ez: 0.85 }));

    // Pómulos
    for (const lado of [-1, 1]) {
      P(piel, poner(bola(0.032, 8, 6), {
        x: lado * 0.060, y: 0.196, z: -0.062, ex: 1.0, ey: 0.70, ez: 0.85 }));
    }

    // Nariz: dorso y punta. Seis centímetros que dicen para dónde mira.
    P(piel, poner(caja(0.024, 0.072, 0.034), { y: 0.202, z: -0.086, rx: 0.34 }));
    P(piel, poner(bola(0.020, 8, 6), { y: 0.174, z: -0.098, ex: 1.15, ey: 0.85, ez: 1.0 }));

    // Orejas: chatas, inclinadas y algo caídas hacia atrás.
    for (const lado of [-1, 1]) {
      P(piel, poner(bola(0.028, 8, 6), {
        x: lado * 0.100, y: 0.212, z: 0.008,
        rz: lado * 0.14, ry: lado * 0.30, ex: 0.42, ey: 1.22, ez: 0.82 }));
    }

    // Ojos y boca, con el pardo oscuro de las botas: es el único oscuro de la
    // paleta y no hay presupuesto para un material nuevo. A cuatro metros lo que
    // importa es que haya dos manchas oscuras donde van los ojos.
    for (const lado of [-1, 1]) {
      // z = −0,080 y no −0,086: medido sobre el elipsoide ya moldeado, la cara
      // a la altura de los ojos y a 4 cm del eje cae en z = −0,089, así que con
      // −0,086 el ojo sobresalía 6 mm y quedaba saltón.
      P(bota, poner(bola(0.0135, 8, 6), {
        x: lado * 0.040, y: 0.206, z: -0.080, ex: 1.30, ey: 0.82, ez: 0.66 }));
    }
    P(bota, poner(caja(0.040, 0.007, 0.012), { y: 0.142, z: -0.084 }));

    this._peinado(piezas, aspecto, pelo);
    return piezas;
  }

  /**
   * El pelo. Y sólo el pelo: los gorros y los sombreros son cosas que se
   * consiguen y se ponen, no rasgos con los que se nace. Ponerlos en la
   * creación de personaje los convertía en una decisión de nacimiento, y son
   * justo lo contrario: son lo primero que uno querría fabricarse en un lugar
   * donde la cabeza descubierta es por donde se va el calor.
   *
   * Todo el pelo y las cejas salen en **una sola malla**, fusionadas por
   * `armar()`.
   */
  _peinado(piezas, aspecto, pelo) {
    const id = aspecto.idPeinado;
    const P = (g) => piezas.push({ m: pelo, g });

    // Las cejas van siempre, también en el rapado: son dos piezas de doce
    // triángulos y hacen más por la cara que cualquier otra cosa de este tamaño.
    for (const lado of [-1, 1]) {
      P(poner(caja(0.040, 0.009, 0.016), {
        x: lado * 0.038, y: 0.243, z: -0.086, rz: lado * -0.18, rx: -0.22 }));
    }

    if (id === 'rapado') {
      P(poner(bola(0.109, LADOS_FINOS, 8), { y: 0.215, ex: 0.96, ey: 1.12, ez: 1.02 }));
      return;
    }

    // Casquete con nacimiento de pelo: la media esfera de arriba, cortada por
    // `thetaLength`, corrida hacia atrás. Un casquete entero y centrado se lee
    // como un casco, que es lo que pasaba antes.
    const casquete = moldear(
      new THREE.SphereGeometry(0.117, LADOS_FINOS, 8, 0, Math.PI * 2, 0, 1.95),
      (v) => { if (v.z < 0) v.y += 0.012 * (-v.z / 0.117); });   // entradas
    P(poner(casquete, { y: 0.212, z: 0.010, ex: 0.97, ey: 1.08, ez: 1.0 }));

    if (id === 'corto') return;

    if (id === 'recogido') {
      P(poner(bola(0.055, 10, 8), { y: 0.198, z: 0.118, ez: 0.92 }));
      return;
    }

    // Melena, media o larga, cayendo por la nuca
    const larga = id === 'larga';
    P(poner(torneado([
      [0.098, larga ? -0.06 : 0.09], [0.112, larga ? 0.10 : 0.18], [0.115, 0.28],
    ], LADOS, 0.74), { y: 0, z: 0.022 }));
    // Los mechones de adelante nacen de las sienes, no de la frente
    for (const lado of [-1, 1]) {
      P(poner(torneado([
        [0.030, larga ? 0.03 : 0.14], [0.036, 0.27],
      ], 8, 0.70), { x: lado * 0.098, z: -0.010 }));
    }
  }

  _limpiar() {
    // Primero las herramientas: el modelo colgado está DENTRO de `this.grupo` y
    // el recorrido de abajo lo liberaría, pero los que están sólo en el caché no
    // los alcanza nadie. Soltarlos acá deja al recorrido sin nada que repetir.
    this._soltarHerramientas();
    for (const m of this._materiales) m.dispose();
    this._materiales.length = 0;
    this.grupo.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.grupo.clear();
  }

  // ── Lo que se lleva en la mano ────────────────────────────────────────────

  /**
   * El id del objeto que se lleva en la mano derecha, o `null`.
   *
   * La escribe `main` por cuadro desde `equipo.enRanura("mano")`. **Escribirla
   * con el mismo valor no hace absolutamente nada** —ni una reserva, ni un
   * recorrido—, que es lo que la vuelve barata en el bucle; y cambiarla no
   * reconstruye el cuerpo: cuelga o descuelga el modelo que corresponde.
   * @type {string|null}
   */
  get enMano() { return this._enMano; }

  set enMano(id) {
    const nuevo = id || null;
    if (nuevo === this._enMano) return;
    this._enMano = nuevo;
    this._colgar(nuevo);
  }

  /**
   * La posición **en espacio de mundo** de la mano derecha, o de la punta del
   * objeto si lo declara —la llama de la antorcha y la del candil—.
   *
   * Reemplaza a la `posicionDeMano()` aproximada de la fase 1: la llama deja de
   * salir de una cuenta sobre la cámara y sale del modelo, así que se mece con
   * el brazo, se agacha cuando el cuerpo se agacha y queda donde se la ve.
   *
   * `getWorldPosition` actualiza las matrices de los padres por su cuenta, así
   * que sirve también antes del primer dibujo del cuadro.
   *
   * @param {object} [salida] un `Vector3` o cualquier `{x,y,z}`. Sin argumento
   *        devuelve un vector **propio del cuerpo, que se reescribe en la
   *        llamada siguiente**: no se guarda, se lee.
   */
  puntoDeMano(salida = this._punto) {
    const nodo = this._modeloEnMano?.punta ?? this.manos?.[1] ?? this.grupo;
    nodo.getWorldPosition(this._punto);
    if (salida === this._punto) return salida;
    if (typeof salida.set === 'function') salida.set(this._punto.x, this._punto.y, this._punto.z);
    else { salida.x = this._punto.x; salida.y = this._punto.y; salida.z = this._punto.z; }
    return salida;
  }

  /**
   * Un material de la paleta de herramientas, compartido por todos los modelos.
   *
   * Se crea con `this._material()`, que es el mismo camino del torso: pasa por
   * `registrarMaterial` —o sea por las cascadas de sombra— y queda en
   * `_materiales`, así que lo libera `_limpiar()` sin nada especial.
   *
   * **No lleva ninguna bandera que cambie la clave del programa** (`vertexColors`,
   * `flatShading`, mapas, `side`): por eso comparte programa con los materiales
   * del cuerpo, que están compilados desde la carga, y equipar una herramienta
   * por primera vez no compila nada. `emissive` sí se puede: es un uniforme.
   */
  _tinta(nombre) {
    let m = this._paleta.get(nombre);
    if (m) return m;
    const def = PALETA[nombre] ?? PALETA.madera;
    m = this._material(def.color, def.rugosidad);
    if (def.emisivo !== undefined) {
      m.emissive.setHex(def.emisivo);
      m.emissiveIntensity = def.emision ?? 1;
    }
    this._paleta.set(nombre, m);
    return m;
  }

  /** Cuelga el modelo de un id en la mano derecha, o la deja vacía con `null`. */
  _colgar(id) {
    if (this._modeloEnMano) {
      this._modeloEnMano.removeFromParent();
      this._modeloEnMano = null;
    }
    const mano = this.manos?.[1];
    if (!id || !mano) return;
    let modelo = this._modelos.get(id);
    if (modelo === undefined) {
      // Se construye una sola vez por id y por cuerpo. Un id sin modelo guarda
      // `null` en el caché: así no se vuelve a intentar cuadro por cuadro.
      modelo = construirHerramienta(id, (n) => this._tinta(n));
      this._modelos.set(id, modelo);
    }
    if (!modelo) return;
    mano.add(modelo);
    this._modeloEnMano = modelo;
  }

  /**
   * Suelta y libera todos los modelos, colgados o no.
   *
   * Los materiales NO se tocan acá: son los de `_materiales` y los libera
   * `_limpiar()`, que es quien los creó.
   */
  _soltarHerramientas() {
    if (this._modeloEnMano) {
      this._modeloEnMano.removeFromParent();
      this._modeloEnMano = null;
    }
    for (const modelo of this._modelos.values()) {
      if (!modelo) continue;
      modelo.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    }
    this._modelos.clear();
    this._paleta.clear();
  }

  /** Triángulos y dibujos del modelo colgado ahora mismo. Lo usa el banco. */
  get costoEnMano() {
    const m = this._modeloEnMano;
    return { triangulos: m?.triangulos ?? 0, dibujos: m?.dibujos ?? 0 };
  }

  // ── Animación ─────────────────────────────────────────────────────────────

  /**
   * @param {number} dt segundos reales
   * @param {object} j jugador (posición, giro, cabeceo, velocidad, estados)
   */
  actualizar(dt, j) {
    // La cota es la suavizada, la misma que usa la cámara: con la cruda el
    // personaje daría saltitos dentro del encuadre en tercera persona.
    this.grupo.position.set(j.posicion.x, j.alturaVisual ?? j.posicion.y, j.posicion.z);
    this.grupo.rotation.y = j.giro;

    // Nadando el cuerpo se hunde hasta el pecho en vez de caminar por el fondo
    if (j.enAgua) this.grupo.position.y -= Math.min(0.55, j.profundidadAgua * 0.35);

    const rapidez = Math.hypot(j.velocidad.x, j.velocidad.z);
    // La fase del paso la manda el jugador, no este cuerpo.
    //
    // Tenía un reloj propio —`rapidez * dt * 2,4`, o sea 1,309 m por paso— y la
    // cámara tenía otro —1,736 m por cabeceo— y el sonido un tercero —0,85 m—.
    // Eran tres pasos distintos corriendo a la vez sobre el mismo cuerpo: el
    // pie apoyaba, el ruido llegaba y la cabeza bajaba en tres momentos que no
    // coincidían nunca. Ahora los tres leen `jugador.fasePaso`.
    //
    // El maniquí de la creación de personaje no es un `Jugador` y no tiene
    // fase, así que ahí se conserva el reloj viejo: es una vidriera girando,
    // no hay cámara que sincronizar.
    if (j.fasePaso !== undefined) this.fase = j.fasePaso;
    else this.fase += rapidez * dt * 2.4;
    const swing = Math.min(rapidez / 5.5, 1) * (j.enSuelo ? 1 : 0.25);
    const s = Math.sin(this.fase);

    for (let i = 0; i < 2; i++) {
      const si = i === 0 ? s : -s;
      // Muslo: adelante y atrás
      this.piernas[i].rotation.x = si * 0.62 * swing;
      // Rodilla: sólo dobla hacia atrás, y sobre todo en la fase de vuelo, que
      // es cuando el pie tiene que despegar del suelo para no arrastrarse.
      this.rodillas[i].rotation.x = -Math.max(0, -si) * 1.05 * swing - 0.06;
      // Brazo: en contrafase con la pierna del mismo lado
      this.brazos[i].rotation.x = -si * 0.46 * swing;
      // Cuelgan un poco abiertos: pegados al torso se ven clavados
      this.brazos[i].rotation.z = (i === 0 ? 1 : -1) * 0.09;
      // Codo: siempre algo doblado, y más cuando el brazo va hacia adelante
      this.codos[i].rotation.x = 0.28 + Math.max(0, -si) * 0.45 * swing;
    }

    // Con algo en la mano el brazo derecho deja de colgar: el antebrazo sube,
    // el hombro casi deja de bracear y el brazo se abre un poco del cuerpo.
    //
    // No es un adorno. Medido con el brazo suelto, la mano queda a 0,85 m del
    // suelo y pegada al muslo: una barreta de noventa centímetros barre el piso
    // o atraviesa la pierna, y la llama de la antorcha camina a la altura de la
    // cadera en vez de ir por delante. Con la carga la mano sube a 0,94 y se
    // adelanta 0,21 m, que es donde uno lleva de verdad una herramienta.
    //
    // Se suaviza en un cuarto de segundo para que cambiar de herramienta no dé
    // un tirón, y con la mano vacía el término entero vale cero.
    const carga = this._modeloEnMano ? 1 : 0;
    this._cargaSuave += (carga - this._cargaSuave) * Math.min(1, dt * 8);
    if (this._cargaSuave > 0.001) {
      const k = this._cargaSuave;
      this.brazos[1].rotation.x *= 1 - 0.60 * k;
      this.brazos[1].rotation.z -= 0.05 * k;
      this.codos[1].rotation.x = this.codos[1].rotation.x * (1 - 0.5 * k) + 0.78 * k;
    }

    // Y la herramienta se endereza: su inclinación está escrita en el espacio
    // del CUERPO, así que acá se le descuenta lo que doblaron el hombro y el
    // codo. Es lo que hace que un hacha siga apuntando al mismo lado mientras el
    // brazo bracea, en vez de pasearse de la rodilla al hombro con cada paso.
    if (this._modeloEnMano) {
      this._modeloEnMano.rotation.x =
        this._modeloEnMano.userData.rx - this.codos[1].rotation.x - this.brazos[1].rotation.x;
    }

    // Agacharse: el cuerpo se recoge y se inclina, en vez de encogerse entero
    const objetivo = j.agachado ? 1 : 0;
    this._agachadoSuave += (objetivo - this._agachadoSuave) * Math.min(1, dt * 10);
    const c = this._agachadoSuave;
    // Correr inclina el torso: de ahí sale la sensación de que el cuerpo se
    // está tirando hacia donde va, y no de la velocidad del suelo.
    const carrera = Math.min(1, Math.max(0, rapidez - 3.6) / 2.6);
    this.tronco.position.y = 0.92 - 0.34 * c;
    this.tronco.rotation.x = 0.46 * c + 0.16 * carrera;
    for (const p of this.piernas) {
      p.position.y = 0.92 - 0.34 * c;
      p.rotation.x += 0.30 * c;               // en cuclillas las piernas se pliegan
    }
    for (const r of this.rodillas) r.rotation.x -= 0.75 * c;

    // La cabeza sigue la mirada, pero la mitad: el resto lo hace el cuello del
    // jugador de verdad, y girarla entera parece un búho.
    const limite = 0.7;
    this.cabeza.rotation.x =
      Math.max(-limite, Math.min(limite, j.cabeceo * 0.55)) - 0.46 * c;

    // En primera persona sólo estorban la cabeza y el cuello: el torso mirado
    // desde arriba es exactamente lo que uno espera ver.
    this.cabeza.visible = !!j.tercerPersona;
  }

  destruir() {
    this._limpiar();
    this.grupo.removeFromParent();
  }

  /** El nombre que usa el resto de three para lo mismo. */
  dispose() { this.destruir(); }
}
