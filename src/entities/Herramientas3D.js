/**
 * Herramientas3D — los treinta objetos que se llevan en la mano, modelados: los
 * dieciocho de `ranura: "mano"` (ronda 5) y los doce de `ranura: "arma"` (ronda
 * 7), que la mano lleva cuando no hay herramienta.
 *
 * Mismo criterio que el cuerpo y que los animales de la ronda 3: nada de
 * archivos de modelo, silueta desde medidas reales y pocas piezas. Lo que manda
 * acá es que **un hacha de piedra y un pico de asta se distingan de lejos por la
 * forma**, no por el color: a veinte metros, en un bosque de noche, el color es
 * lo primero que se pierde.
 *
 * Tres reglas de construcción, y las tres salen de una medición o de un defecto
 * ya pagado:
 *
 * 1. **Espacio del modelo: origen en el puño, +Y hacia la parte que trabaja.**
 *    Con eso el montaje en la mano es uno solo para las dieciocho, y se ajusta
 *    con un único ángulo por familia en vez de dieciocho poses a mano.
 *
 * 2. **A lo sumo dos materiales por objeto, y las piezas del mismo material
 *    fusionadas en una sola geometría.** El presupuesto de la fase son dos
 *    dibujos más por cuadro; un hacha son seis piezas y tiene que salir en dos
 *    mallas. La atadura de tiento va con el material del mango —cuero sobre
 *    madera, dos pardos del mismo valor—: como tercer material costaba un dibujo
 *    entero por una banda de dos centímetros.
 *
 * 3. **Ninguna bandera que cambie la clave del programa.** Nada de
 *    `vertexColors`, `flatShading`, mapas ni `side`: los materiales se piden por
 *    `Cuerpo._material()`, que ya pasa por `conCSM`, y así **comparten programa
 *    con los materiales del cuerpo, compilados desde la carga**. Cambiar de
 *    herramienta no compila nada. `emissive` sí se puede usar —es un uniforme,
 *    no un `define`— y es lo que hace que la llama de la antorcha se vea de
 *    noche aunque el sombreador no sepa que ahí hay una luz.
 *
 * Las medidas son las de las herramientas de verdad: un hacha de mano tiene un
 * cabo de medio metro, una barreta pasa el metro, un candil entra en la palma.
 * Las del arma, igual: la lanza de a pie no pasaba de 1,70 m, una caña de mosca
 * de trucha mide nueve pies, un arco mapuche arrancaba en 1,20. Las fuentes y lo
 * que es estimación, uno por uno, están en `.claude/flota/r7-empunadura.md`.
 *
 * Y una regla más, de la ronda 7: **la llama es una malla aparte, y se esconde**.
 * Su tinta es emisiva y brilla con fuego o sin él; `construirHerramienta()` la
 * deja en `grupo.llama` y `Cuerpo.llamaEncendida` la muestra sólo con la luz
 * prendida. Esconder una malla no compila nada.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Lados de los torneados. Ocho: el cabo de un hacha no necesita más. */
const SEG = 8;

/** Los dieciocho objetos con `ranura: "mano"` de `herramientas.json`. */
export const IDS_MANO = [
  'lasca_rodado', 'lasca', 'raspador', 'cuchillo', 'hacha_piedra', 'azuela',
  'pala_omoplato', 'maza_cuna', 'pico_asta', 'hacha_hierro', 'sierra',
  'martillo', 'pico_hierro', 'pala_hierro', 'barreta', 'antorcha',
  'candil_grasa', 'ahumador',
];

/**
 * Los doce de `ranura: "arma"` (ronda 7). La mano los lleva cuando no hay
 * herramienta: el dueño equipó el garrote y no lo vio.
 */
export const IDS_ARMA = [
  'garrote', 'honda', 'lanza_colihue', 'estolica', 'bola_perdida',
  'boleadora_dos', 'boleadora_tres', 'arco_colihue_obj', 'linea_mano',
  'cana_colihue', 'arpon_hueso', 'equipo_mosca',
];

/**
 * La paleta. El nombre es el material de la ficha; el color y la rugosidad se
 * eligen para que la silueta se lea contra el bosque, que es verde oscuro.
 *
 * `emisivo` sólo lo usa la llama: una llama que sólo recibe luz es una mancha
 * naranja apagada, y la de la antorcha tiene que verse a medianoche.
 *
 * Cada tinta es un material más para los treinta modelos, y el tope son doce.
 * Las dos últimas son de la ronda 7 y quedó una libre.
 */
export const PALETA = {
  madera:    { color: 0x6b4a2c, rugosidad: 0.93 },
  piedra:    { color: 0x77736b, rugosidad: 0.96 },
  obsidiana: { color: 0x1d1b22, rugosidad: 0.34 },
  hierro:    { color: 0x8c9199, rugosidad: 0.44 },
  hueso:     { color: 0xd9d0b6, rugosidad: 0.74 },
  asta:      { color: 0xb49a72, rugosidad: 0.82 },
  ceramica:  { color: 0x9c5c3a, rugosidad: 0.90 },
  cuero:     { color: 0x584029, rugosidad: 0.92 },
  llama:     { color: 0xffa14a, rugosidad: 1.0, emisivo: 0xff7a22, emision: 1.5 },
  // Cinco de los doce son de colihue: con `madera` la lanza, el arco y las cañas
  // eran palos pardos. El color es el `colorTronco` de `cana_colihue` en
  // `flora.json`, el mismo con que el mundo pinta el cañaveral; y es lisa.
  colihue:   { color: 0xc8b45e, rugosidad: 0.62 },
  // Fibra de coirón torcida: gris pajizo. La honda es cordel y badana, y con
  // `cuero` para las dos salía una sola mancha oscura.
  cordel:    { color: 0x958a6c, rugosidad: 0.96 },
};

// ── Piezas ────────────────────────────────────────────────────────────────────
// Todas nacen en y = 0 y crecen hacia +Y, igual que `hueso()` en Cuerpo.js pero
// al revés: acá el pivote es el puño y no la articulación de la que cuelga.

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Mueve, gira y estira una pieza en su sitio. Devuelve la misma geometría. */
function poner(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ex = 1, ey = 1, ez = 1 } = {}) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s.set(ex, ey, ez)));
  return g;
}

/** Torneado con la base en y = 0. `seg` lados; 4 da un prisma de sección rómbica. */
function tubo(rAbajo, rArriba, largo, seg = SEG) {
  const g = new THREE.CylinderGeometry(rArriba, rAbajo, largo, seg, 1);
  g.translate(0, largo / 2, 0);
  return g;
}

/** Prisma recto con la base en y = 0. */
function prisma(ancho, alto, hondo) {
  const g = new THREE.BoxGeometry(ancho, alto, hondo);
  g.translate(0, alto / 2, 0);
  return g;
}

/** Cono con la base en y = 0 y la punta hacia +Y. */
function pico(radio, largo, seg = SEG) {
  const g = new THREE.ConeGeometry(radio, largo, seg, 1);
  g.translate(0, largo / 2, 0);
  return g;
}

/** Canto: ocho caras sin subdividir. Barato y sin dos caras iguales. */
function canto(radio) {
  return new THREE.OctahedronGeometry(radio, 0);
}

/**
 * Hoja plana que sale del puño: un torneado de cuatro lados, girado 45° para
 * que las dos caras anchas miren a los ejes, y recién **después** achatado.
 *
 * El orden no es un detalle y costó una medición: `poner()` compone `T·R·S`, o
 * sea que **achata antes de girar**. Con el achatado y el giro de 45° en la
 * misma llamada, la hoja del hacha y la de la azuela salían las dos torcidas a
 * 45° y sus cajas envolventes daban apenas un 21 % de diferencia: de lejos eran
 * el mismo objeto. Acá el giro va sobre la geometría y el achatado después, así
 * que el hacha queda fina en X con el filo vertical y la azuela ancha en X con
 * el filo atravesado, que es lo que las distingue de verdad.
 *
 * `ancho` estira el eje X y `grosor` el Z; el filo es el extremo +Y.
 */
function hoja(rTalon, rPunta, largo, ancho = 1, grosor = 1) {
  const g = new THREE.CylinderGeometry(rPunta, rTalon, largo, 4, 1);
  g.rotateY(Math.PI / 4);
  g.translate(0, largo / 2, 0);
  g.scale(ancho, 1, grosor);
  return g;
}

/**
 * Una atadura de tiento: un anillo chato alrededor del cabo. Va siempre con el
 * material del mango, por el presupuesto de dibujos.
 */
function atadura(radio, y, alto = 0.016) {
  return poner(tubo(radio, radio, alto, 6), { y: y - alto / 2 });
}

/** Esfera de ocho gajos y seis anillos: lo justo para que una bola no sea un dado. */
function esfera(radio) {
  return new THREE.SphereGeometry(radio, 8, 6);
}

const _arriba = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/**
 * Torneado de un punto `a` a un punto `b`: cordeles, ramales, púas y los tramos
 * del arco. Con `poner()` habría que sacar los ángulos a mano, y de estas piezas
 * lo que se sabe es adónde llegan.
 */
function tramo(a, b, rA, rB = rA, seg = 6) {
  _dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = tubo(rA, rB, _dir.length(), seg);
  _q.setFromUnitVectors(_arriba, _dir.normalize());
  g.applyMatrix4(_m.compose(_p.set(a[0], a[1], a[2]), _q, _s.set(1, 1, 1)));
  return g;
}

// ── Los dieciocho ─────────────────────────────────────────────────────────────
//
// Cada entrada devuelve `{ piezas, punta, montaje }`:
//   · `piezas`  — material → lista de geometrías, a lo sumo dos materiales.
//   · `punta`   — dónde nace la llama, en el espacio del modelo. Sólo las luces.
//   · `montaje` — cómo se agarra: familia de pose. Ver `MONTAJES`.

/**
 * Cómo se sostiene cada familia, en el espacio de la mano derecha.
 *
 * El adelante del cuerpo es −Z (la nariz está en `z = −0,098`), así que un giro
 * negativo en X inclina el objeto hacia adelante. El giro en Z lo abre hacia
 * afuera para que no atraviese el muslo.
 */
const MONTAJES = {
  // Herramienta con cabo: se lleva algo inclinada hacia adelante, cabeza arriba.
  cabo:   { rx: -0.55, rz: -0.15, y: -0.055, z: -0.012 },
  // Cabo largo (barreta, pala, pico): más diagonal, o la punta va al cielo.
  largo:  { rx: -0.78, rz: -0.17, y: -0.045, z: -0.014 },
  // Filo corto sin cabo o con cabo chico: apunta adelante, como quien va a cortar.
  // Los 2 cm que separan la z de −0,020 son medidos: con −0,020 el canto rodado
  // rozaba el muslo derecho durante el ciclo de paso.
  corto:  { rx: -1.02, rz: -0.10, y: -0.025, z: -0.042 },
  // Lo que se lleva casi horizontal en la palma: cuenco, fuelle.
  cuenco: { rx: -0.20, rz: -0.08, y: 0.005, z: -0.030 },
  // La antorcha va casi vertical: la llama tiene que quedar sobre el puño.
  tea:    { rx: -0.38, rz: -0.14, y: -0.060, z: -0.016 },

  // ── Las familias de la ranura del arma (ronda 7) ──
  //
  // Varas de 1,7 a 3 m: lanza, arpón y las dos cañas. Se agarran DEL REGATÓN, a
  // ocho centímetros de la punta de abajo, y se llevan casi paradas. Medido con
  // la mano asentada (y 0,943, adelantada 0,218, afuera 0,128): agarrada por el
  // medio, una vara mete el regatón en la pantorrilla si va parada y cruza el
  // muslo si va inclinada, y abierta para que no lo toque deja la punta en el
  // medio de la pantalla en primera persona. Agarrada a 25 cm del regatón ya no
  // tocaba parado, pero al correr el muslo avanza hasta z −0,33 y se la llevaba
  // por delante 10 cm; a 8 cm queda libre.
  vara:     { rx: -0.35, rz: -0.05, y: -0.060, z: -0.016 },
  // El arco, por el medio y casi vertical. Choca de los dos lados: la pala de
  // arriba sube pegada al antebrazo, que desde el puño va hacia el codo 0,16 m
  // arriba y 0,21 m atrás, y la de abajo baja 0,6 m delante del muslo. Barrido
  // con el cuerpo medido: echarlo atrás (rx +0,20) lo metía 3 cm en el antebrazo
  // parado; vertical en el centro del puño, 5 cm en el muslo andando. Lo que
  // separa las dos cosas es correr la caña 5 cm hacia afuera dentro del puño, que
  // todavía la agarra, y 0,15 rad adelante: parado y andando no toca nada. El rz
  // positivo compensa el −0,14 que el brazo cargado lleva en Z.
  arco:     { rx: -0.15, rz: 0.14, x: 0.050, y: -0.060, z: -0.016 },
  // Lo que cuelga: honda y boleadoras. El +Y del modelo apunta al suelo (rx ≈ π)
  // con 0,14 rad hacia adelante. Lo que decide es la X: el muslo ocupa x 0,093 ±
  // 0,10 y avanza al correr, así que lo colgado tiene que quedar afuera de 0,23 a
  // la altura de las bolas. Tres centímetros de corrimiento en el puño y rz
  // −0,34, que con el −0,14 del brazo deja 0,2 rad de apertura.
  colgando: { rx: -3.00, rz: -0.34, x: 0.030, y: -0.070, z: -0.020 },
};

const MODELOS = {
  // Un rodado de arroyo partido: se lleva en el puño, no tiene cabo.
  lasca_rodado: () => ({
    montaje: 'corto',
    piezas: {
      piedra: [poner(canto(0.058), { y: 0.022, rx: 0.42, ry: 0.30, rz: 0.22, ex: 1.0, ey: 1.15, ez: 0.46 })],
    },
  }),

  // La misma idea en vidrio volcánico: más larga, más fina y más aguda. Lo que
  // la separa de la de rodado en silueta es el largo, no el color.
  lasca: () => ({
    montaje: 'corto',
    piezas: {
      obsidiana: [poner(canto(0.070), { y: 0.030, rx: 0.16, rz: 0.20, ex: 0.52, ey: 1.75, ez: 0.30 })],
    },
  }),

  // Filo romo en ángulo alto: no corta, arranca. Ancho y corto, cabo mínimo.
  raspador: () => ({
    montaje: 'corto',
    piezas: {
      madera: [tubo(0.020, 0.018, 0.10), atadura(0.023, 0.098)],
      obsidiana: [poner(hoja(0.030, 0.050, 0.050, 1.55, 0.30), { y: 0.098 })],
    },
  }),

  // Cabo corto y hoja larga y angosta: el perfil de un cuchillo, y nada más.
  cuchillo: () => ({
    montaje: 'corto',
    piezas: {
      madera: [tubo(0.021, 0.018, 0.105), atadura(0.024, 0.100)],
      obsidiana: [poner(hoja(0.023, 0.005, 0.155, 1, 0.22), { y: 0.103 })],
    },
  }),

  // Hacha: cabo de medio metro y cabeza pulida atada, con el FILO VERTICAL,
  // en el plano del cabo. Es lo que la separa de la azuela.
  hacha_piedra: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.023, 0.019, 0.50), atadura(0.027, 0.345), atadura(0.027, 0.468)],
      piedra: [poner(hoja(0.021, 0.056, 0.155, 0.40, 1.05),
        { y: 0.330, z: -0.018, rx: -0.30 })],
    },
  }),

  // Azuela: el filo va ATRAVESADO, no en el plano del cabo — no parte, vacía.
  //
  // Con la cabeza del hacha simplemente girada un cuarto de vuelta las dos cajas
  // envolventes salían con un 6 % de diferencia: de lejos eran el mismo objeto.
  // Así que la azuela es lo que es una azuela de verdad: cabo más corto, cabeza
  // volcada casi horizontal y **saliendo hacia adelante**, como una azada. La
  // cabeza es ancha en X y fina en Y, justo al revés que la del hacha.
  azuela: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.023, 0.019, 0.42), atadura(0.027, 0.300), atadura(0.027, 0.398)],
      piedra: [poner(hoja(0.022, 0.062, 0.165, 1.35, 0.34),
        { y: 0.372, z: -0.020, rx: -1.42 })],
    },
  }),

  // Omóplato atado a un palo: la pala de medio mundo antes del metal. Silueta
  // de remo: cabo largo y una paleta ovalada y chata.
  pala_omoplato: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.022, 0.018, 0.58), atadura(0.026, 0.520), atadura(0.026, 0.572)],
      hueso: [poner(new THREE.SphereGeometry(0.090, 8, 5),
        { y: 0.640, z: -0.010, rx: 0.20, ex: 1.0, ey: 1.30, ez: 0.17 })],
    },
  }),

  // Maza y cuñas: cabo corto y grueso, cabeza de piedra ATRAVESADA, y una cuña
  // de madera colgando del cabo. Silueta de mazo, inconfundible.
  maza_cuna: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.026, 0.022, 0.38), atadura(0.030, 0.290),
        poner(pico(0.017, 0.085, 6), { x: -0.052, y: 0.255, z: 0.020, rz: 0.30, rx: 0.15 })],
      piedra: [poner(new THREE.CylinderGeometry(0.050, 0.050, 0.135, 6, 1),
        { y: 0.365, rz: Math.PI / 2 })],
    },
  }),

  // Asta de ciervo con las puntas recortadas: sin cabo, quebrada en el codo y
  // con un garrón lateral. Es la única silueta bifurcada del conjunto.
  pico_asta: () => ({
    montaje: 'cabo',
    piezas: {
      asta: [
        tubo(0.021, 0.015, 0.28, 6),
        poner(tubo(0.015, 0.008, 0.23, 6), { y: 0.272, rx: -0.88 }),
        poner(pico(0.013, 0.090, 5), { x: 0.008, y: 0.120, z: 0.006, rx: 1.30, rz: -0.35 }),
      ],
    },
  }),

  // Hacha de hierro: cabo más largo y más fino que el de piedra, hoja acampanada
  // y TALÓN atrás del ojo. De lejos se separa de la de piedra por el vuelo del
  // filo, que es casi el doble.
  hacha_hierro: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.022, 0.017, 0.62)],
      hierro: [
        poner(hoja(0.026, 0.068, 0.175, 0.32, 1.05), { y: 0.430, z: -0.026, rx: -0.26 }),
        poner(prisma(0.034, 0.062, 0.054), { y: 0.478, z: 0.026 }),
      ],
    },
  }),

  // Sierra de mano: hoja plana, larga y con dientes. Los dientes son doce conos
  // de tres lados —cuatro triángulos cada uno— y son lo que la vuelve una sierra
  // y no una espada; sin ellos la silueta era la misma que la de la barreta.
  sierra: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.025, 0.021, 0.115), poner(prisma(0.030, 0.055, 0.072), { y: 0.020, z: -0.016 })],
      hierro: (() => {
        const p = [poner(prisma(0.076, 0.400, 0.004), { y: 0.115 })];
        for (let i = 0; i < 12; i++) {
          p.push(poner(new THREE.ConeGeometry(0.007, 0.016, 3),
            { x: 0.044, y: 0.165 + i * 0.029, rz: -Math.PI / 2 }));
        }
        return p;
      })(),
    },
  }),

  // Martillo: cabo corto y cabeza atravesada con pein de un lado. Una T.
  martillo: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [tubo(0.020, 0.016, 0.325)],
      hierro: [
        poner(new THREE.CylinderGeometry(0.022, 0.022, 0.085, 6, 1), { y: 0.348, rz: Math.PI / 2 }),
        poner(prisma(0.032, 0.030, 0.032), { y: 0.320 }),
        poner(new THREE.ConeGeometry(0.019, 0.058, 4), { x: -0.070, y: 0.348, rz: Math.PI / 2 }),
      ],
    },
  }),

  // Pico: punta de un lado, pala del otro, y el doble de cabo que el martillo.
  // La cruz de arriba es tres veces más ancha: se distingue a distancia.
  pico_hierro: () => ({
    montaje: 'largo',
    piezas: {
      madera: [tubo(0.022, 0.017, 0.64)],
      hierro: [
        poner(new THREE.ConeGeometry(0.023, 0.175, 6), { x: 0.088, y: 0.662, rz: -Math.PI / 2 }),
        poner(hoja(0.026, 0.010, 0.145, 1, 2.2), { x: -0.002, y: 0.662, rz: Math.PI / 2 }),
        poner(prisma(0.036, 0.044, 0.036), { y: 0.640 }),
      ],
    },
  }),

  // Pala: el cabo más largo, travesaño en el puño y una hoja ancha que termina
  // en punta. Lo único del conjunto con una superficie plana grande.
  pala_hierro: () => ({
    montaje: 'largo',
    piezas: {
      madera: [tubo(0.022, 0.019, 0.70),
        poner(tubo(0.014, 0.014, 0.105, 6), { x: -0.052, y: -0.004, rz: Math.PI / 2 })],
      hierro: [
        poner(hoja(0.080, 0.028, 0.215, 1, 0.15), { y: 0.690 }),
        poner(pico(0.019, 0.055, 6), { y: 0.660 }),
      ],
    },
  }),

  // Barreta: una barra de hierro y nada más, de casi un metro. Sin mango, sin
  // filo y sin cabeza: es la silueta más simple y la más larga de las dieciocho.
  barreta: () => ({
    montaje: 'largo',
    piezas: {
      hierro: [
        tubo(0.015, 0.013, 0.905, 6),
        poner(pico(0.016, 0.085, 6), { y: 0.900 }),
        poner(hoja(0.012, 0.018, 0.075, 1, 0.30), { y: -0.075 }),
      ],
    },
  }),

  // Antorcha: palo, envoltorio de fibra embreada —que ya está quemado, así que
  // va con el pardo del palo— y la llama. La llama es la única pieza emisiva del
  // conjunto: sin eso, de noche la antorcha ilumina el suelo y ella se ve negra.
  antorcha: () => ({
    montaje: 'tea',
    punta: [0, 0.505, 0],
    piezas: {
      madera: [tubo(0.021, 0.017, 0.400), poner(tubo(0.041, 0.034, 0.130), { y: 0.320 })],
      llama: [poner(pico(0.039, 0.180, 6), { y: 0.440 })],
    },
  }),

  // Candil: un cuenco de cerámica con pie, el pico del mechero adelante y una
  // llama chica. Se lleva casi horizontal, en la palma.
  candil_grasa: () => ({
    montaje: 'cuenco',
    punta: [0, 0.140, -0.052],
    piezas: {
      ceramica: [
        poner(new THREE.CylinderGeometry(0.064, 0.040, 0.046, 10, 1), { y: 0.055 }),
        poner(new THREE.CylinderGeometry(0.020, 0.032, 0.024, 8, 1), { y: 0.012 }),
        poner(pico(0.019, 0.052, 6), { y: 0.062, z: -0.050, rx: -1.25 }),
      ],
      llama: [poner(pico(0.021, 0.078, 6), { y: 0.088, z: -0.052 })],
    },
  }),

  // Ahumador: hogar de brasa, pico cónico por donde sale el humo y fuelle de
  // cuero al costado. La única silueta con un bulto lateral.
  ahumador: () => ({
    montaje: 'cuenco',
    piezas: {
      ceramica: [
        poner(new THREE.CylinderGeometry(0.046, 0.052, 0.155, 8, 1), { y: 0.030 }),
        poner(new THREE.ConeGeometry(0.045, 0.115, 8), { y: 0.195, z: -0.022, rx: -0.48 }),
      ],
      cuero: [poner(new THREE.CylinderGeometry(0.030, 0.056, 0.105, 6, 1),
        { x: 0.058, y: 0.055, z: 0.040, rz: -0.34, ez: 0.55 })],
    },
  }),

  // ── Los doce de la ranura del arma (ronda 7) ──────────────────────────────
  //
  // Mismo molde. De dónde sale cada medida está en `.claude/flota/r7-empunadura.md`;
  // acá va lo que decide la silueta. Cinco son varas y cuatro cuelgan: dentro de
  // cada grupo los separa el largo o una pieza que se note de lejos.

  // Garrote: una rama con el nudo en la punta. No es la macana mapuche, que
  // medía metro y medio y pesaría el doble que los 1,2 kg de la ficha: con cabo
  // de 4,5 cm y nudo de 11, 1,2 kg de madera dan 0,66 m. El cordel es la
  // envoltura del puño. Tenía también el fiador colgando del talón, y al correr
  // el muslo se lo llevaba 8 cm por delante: un aro de cordel no valía el choque.
  garrote: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [
        poner(tubo(0.021, 0.024, 0.46), { y: -0.080 }),
        poner(tubo(0.024, 0.040, 0.10), { y: 0.380 }),
        poner(esfera(0.055), { y: 0.520, ey: 1.15, ez: 0.92 }),
        poner(esfera(0.034), { x: 0.030, y: 0.500, z: -0.028 }),
      ],
      cordel: [poner(tubo(0.026, 0.026, 0.060), { y: 0.030 })],
    },
  }),

  // Honda: dos ramas de cordel de 0,70 m y la badana en el medio, metro y medio
  // en total. Se lleva con los dos cabos en el puño y la cuna colgando: un hilo
  // doble con un bulto chato abajo, y nada más.
  honda: () => ({
    montaje: 'colgando',
    piezas: {
      cordel: [
        tramo([-0.006, -0.010, 0], [-0.024, 0.700, 0], 0.0035, 0.0035, 4),
        tramo([0.006, -0.010, 0], [0.024, 0.700, 0], 0.0035, 0.0035, 4),
      ],
      cuero: [poner(esfera(0.030), { y: 0.716, ex: 1.05, ey: 0.75, ez: 0.45 })],
    },
  }),

  // Lanza de a pie: 1,70 m, el tope de la lanza corta de infantería; la de
  // caballería llegaba a 3,60 y es otra arma. Astil de colihue de 3 cm y punta de
  // obsidiana de 12 cm, con el pedúnculo en el enmangue de brea y tiento.
  lanza_colihue: () => ({
    montaje: 'vara',
    piezas: {
      colihue: [
        poner(tubo(0.015, 0.0135, 1.580), { y: -0.080 }),
        poner(tubo(0.017, 0.016, 0.080), { y: 1.425 }),
      ],
      obsidiana: [poner(hoja(0.021, 0.001, 0.120, 1, 0.30), { y: 1.500 })],
    },
  }),

  // Estólica: una tabla de 0,66 m con el tope de asta arriba, donde apoya el
  // extremo del dardo, y un botón de asta en el talón. Chata y con un gancho que
  // sale de la cara: ninguna otra silueta es una tabla. El tiento del puño va con
  // la madera.
  estolica: () => ({
    montaje: 'cabo',
    piezas: {
      madera: [
        poner(prisma(0.040, 0.660, 0.018), { y: -0.060 }),
        poner(prisma(0.046, 0.060, 0.024), { y: 0.000 }),
      ],
      asta: [
        poner(pico(0.008, 0.032, 5), { y: 0.572, z: -0.008, rx: -1.30 }),
        poner(pico(0.010, 0.022, 5), { y: -0.058, rx: Math.PI }),
      ],
    },
  }),

  // Bola perdida: una bola forrada de 7,3 cm —la `bola` de la ficha— colgando de
  // la manija corta. Una sola bola y cerca del puño: la de dos cuelga el doble.
  bola_perdida: () => ({
    montaje: 'colgando',
    piezas: {
      cuero: [
        tramo([0, -0.010, 0], [0, 0.300, 0], 0.0045, 0.0045, 4),
        poner(esfera(0.0365), { y: 0.334 }),
      ],
    },
  }),

  // Boleadora de dos (ñanducera): la chica en el puño y la grande colgando del
  // ramal, desiguales, de 6,6 y 7,8 cm. El sobrante del ramal va recogido en la
  // mano: entero, con el puño a 0,94 m, la grande arrastraría.
  boleadora_dos: () => ({
    montaje: 'colgando',
    piezas: {
      cuero: [
        poner(esfera(0.033), { y: -0.034 }),
        tramo([0, 0, 0], [0, 0.660, 0], 0.0045, 0.0045, 4),
        poner(esfera(0.039), { y: 0.697 }),
      ],
    },
  }),

  // Boleadora de tres (potreadora): la manija en el puño, el nudo a 0,34 m y los
  // dos ramales largos hasta las bolas grandes, que cuelgan juntas y a distinta
  // altura. Es la única que se abre abajo; el sobrante, recogido como en la de dos.
  boleadora_tres: () => ({
    montaje: 'colgando',
    piezas: {
      cuero: [
        poner(esfera(0.032), { y: -0.032 }),
        tramo([0, 0, 0], [0, 0.340, 0], 0.0045, 0.0045, 4),
        poner(canto(0.012), { y: 0.340 }),
        tramo([0, 0.340, 0], [0.045, 0.622, 0.012], 0.0045, 0.0045, 4),
        tramo([0, 0.340, 0], [-0.040, 0.580, -0.018], 0.0045, 0.0045, 4),
        poner(esfera(0.039), { x: 0.051, y: 0.660, z: 0.014 }),
        poner(esfera(0.039), { x: -0.046, y: 0.618, z: -0.021 }),
      ],
    },
  }),

  // Arco de colihue: 1,20 m, el corto del rango de los arcos mapuches, porque los
  // tehuelches cazaban con arcos chicos. La caña se afina de 2,8 cm en el puño a
  // 1,6 en las puntas, que se vuelven 10 cm hacia la cuerda; la cuerda de tendón va
  // con la tinta del cordel. Es la única silueta curva del conjunto.
  arco_colihue_obj: () => ({
    montaje: 'arco',
    piezas: {
      colihue: (() => {
        const p = [];
        const N = 6;
        for (const lado of [-1, 1]) {
          for (let k = 0; k < N; k++) {
            const t0 = k / N, t1 = (k + 1) / N;
            p.push(tramo(
              [0, lado * 0.6 * t0, 0.10 * t0 * t0],
              [0, lado * 0.6 * t1, 0.10 * t1 * t1],
              0.014 - 0.006 * t0, 0.014 - 0.006 * t1, 6));
          }
        }
        return p;
      })(),
      cordel: [tramo([0, -0.600, 0.100], [0, 0.600, 0.100], 0.0022, 0.0022, 4)],
    },
  }),

  // Línea de mano: el cordel enrollado tal como sale de la mano —un aro de 11 cm,
  // la palma con las vueltas encima— y el cabo con el anzuelo colgando hacia
  // afuera: derecho hacia abajo, al correr lo barría el muslo. El anzuelo va con
  // la tinta del cordel, son dos centímetros. El único aro del conjunto.
  linea_mano: () => ({
    montaje: 'cuenco',
    piezas: {
      cordel: [
        new THREE.TorusGeometry(0.045, 0.011, 6, 14),
        tramo([0.030, -0.034, 0], [0.090, -0.140, 0], 0.002, 0.002, 4),
        poner(pico(0.004, 0.022, 4), { x: 0.091, y: -0.140, rz: Math.PI }),
      ],
    },
  }),

  // Caña de pescar: una vara de colihue de 3 m que se afina de 2,7 a 0,8 cm, con
  // el cordel enrollado arriba del puño —así se lleva una caña sin carrete— y el
  // anzuelo clavado en el enrollado. Afinada y sin nada en la punta: la lanza
  // termina en hoja y el arpón en horqueta.
  cana_colihue: () => ({
    montaje: 'vara',
    piezas: {
      colihue: [poner(tubo(0.0135, 0.004, 3.000), { y: -0.080 })],
      cordel: [
        poner(tubo(0.018, 0.017, 0.220), { y: 0.060 }),
        poner(pico(0.004, 0.024, 4), { x: 0.018, y: 0.290, rz: -0.5 }),
      ],
    },
  }),

  // Arpón: 2,20 m, astil de colihue de 2,5 cm y dos puntas de hueso con púas hacia
  // atrás, abiertas en horqueta. Las dos puntas son los dos huesos de la ficha, y
  // la horqueta es lo que lo separa de la lanza: la lanza termina en una hoja.
  arpon_hueso: () => ({
    montaje: 'vara',
    piezas: {
      colihue: [
        poner(tubo(0.0125, 0.0115, 2.030), { y: -0.080 }),
        poner(tubo(0.016, 0.015, 0.100), { y: 1.870 }),
      ],
      hueso: (() => {
        const p = [];
        for (const lado of [-1, 1]) {
          p.push(tramo([lado * 0.006, 1.920, 0], [lado * 0.032, 2.120, 0], 0.0065, 0.0015, 5));
          // Tres púas por punta, mirando hacia el astil: entran y no salen.
          for (let k = 0; k < 3; k++) {
            const t = 0.35 + k * 0.22;
            const bx = lado * (0.006 + 0.026 * t), by = 1.920 + 0.200 * t;
            p.push(tramo([bx, by, 0], [bx + lado * 0.012, by - 0.022, 0], 0.003, 0.0008, 3));
          }
        }
        return p;
      })(),
    },
  }),

  // Equipo de mosca: caña de 9 pies (2,74 m), la medida de trucha, con empuñadura
  // de cuero curtido —con la tinta de la caña, por el presupuesto de dibujos— y
  // carrete de hierro de 85 mm abajo. El carrete la separa de la caña de colihue,
  // que mide casi lo mismo: sin él las dos cajas quedan a un 9 % de largo. Va del
  // lado de adelante de la caña (−Z): del de atrás, la inclinación de la vara lo
  // bajaba contra el muslo y al correr se metía 9 cm.
  equipo_mosca: () => ({
    montaje: 'vara',
    piezas: {
      colihue: [
        poner(tubo(0.008, 0.0025, 2.740), { y: -0.150 }),
        poner(tubo(0.015, 0.012, 0.200), { y: -0.040 }),
      ],
      hierro: [
        poner(new THREE.CylinderGeometry(0.0425, 0.0425, 0.030, 12, 1),
          { y: -0.080, z: -0.056, rz: Math.PI / 2 }),
        poner(prisma(0.010, 0.050, 0.012), { y: -0.105, z: -0.012 }),
      ],
    },
  }),
};

// ── Armado ────────────────────────────────────────────────────────────────────

/** Triángulos de una geometría, indexada o no. */
export function triangulosDe(g) {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/**
 * Fusiona las piezas de un mismo material en una sola geometría.
 *
 * `mergeGeometries` exige que todas las entradas coincidan en indexado:
 * `OctahedronGeometry` no lleva índice y los torneados sí, así que se normaliza
 * antes. Con una sola pieza no se fusiona nada y se devuelve tal cual.
 */
function fusionar(geos) {
  if (geos.length === 1) return geos[0];
  const hayPlana = geos.some(g => g.index === null);
  const listas = hayPlana ? geos.map(g => (g.index ? g.toNonIndexed() : g)) : geos;
  const unida = mergeGeometries(listas, false);
  // Las copias intermedias de `toNonIndexed` no llegaron nunca a la GPU, pero
  // las originales sí quedarían colgadas si no se sueltan acá.
  for (let i = 0; i < geos.length; i++) {
    if (listas[i] !== geos[i]) listas[i].dispose();
    geos[i].dispose();
  }
  return unida;
}

/**
 * Construye el modelo de un objeto de mano.
 *
 * @param {string} id el id de `herramientas.json`
 * @param {(nombre: string) => THREE.Material} tinta da el material compartido de
 *        la paleta; lo provee `Cuerpo`, que es quien sabe registrarlo en las
 *        cascadas y quien lo va a liberar.
 * @returns {null|THREE.Group} el grupo, ya montado en la pose de la mano, con
 *          `triangulos`, `dibujos`, `punta` (un `Object3D` vacío o `null`) y
 *          `llama` (la malla emisiva, o `null`).
 */
export function construirHerramienta(id, tinta) {
  const receta = MODELOS[id];
  if (!receta) return null;
  const { piezas, punta = null, montaje = 'cabo' } = receta();

  const grupo = new THREE.Group();
  grupo.name = `mano:${id}`;
  // Lo que se lleva en la mano está a menos de un metro de la cámara: el recorte
  // por volumen se equivoca justo cuando la cámara gira, igual que con el cuerpo.
  grupo.frustumCulled = false;

  let triangulos = 0;
  let dibujos = 0;
  let llama = null;
  for (const nombre of Object.keys(piezas)) {
    const geo = fusionar(piezas[nombre]);
    const malla = new THREE.Mesh(geo, tinta(nombre));
    malla.castShadow = true;
    // `receiveShadow` queda en false a propósito: las mallas del cuerpo tampoco
    // lo activan, y es uno de los parámetros que entran en la clave del programa.
    grupo.add(malla);
    if (nombre === 'llama') llama = malla;
    triangulos += triangulosDe(geo);
    dibujos++;
  }
  // La malla de la llama, o null. `Cuerpo` la esconde mientras la luz está
  // apagada: el emisivo brilla aunque no haya fuego (ronda 7, B5).
  grupo.llama = llama;

  const pose = MONTAJES[montaje] ?? MONTAJES.cabo;
  grupo.position.set(pose.x ?? 0, pose.y ?? 0, pose.z ?? 0);
  grupo.rotation.set(pose.rx ?? 0, pose.ry ?? 0, pose.rz ?? 0);
  // `rx` es la inclinación que se quiere **en el espacio del cuerpo**, no en el
  // de la mano: `Cuerpo.actualizar()` le resta lo que estén doblando el hombro y
  // el codo. Sin eso el hacha acompaña al brazo y termina apoyada en el hombro:
  // medido, con el antebrazo doblado 0,84 rad la llama de la antorcha quedaba
  // 0,20 m DETRÁS del puño en vez de adelante.
  grupo.userData.rx = pose.rx ?? 0;

  // El nudo de la punta es un `Object3D` pelado: no se dibuja y no cuesta nada,
  // y le da a `puntoDeMano()` un lugar del que colgar la llama que sigue al
  // modelo cuando el brazo se mueve.
  let nudoPunta = null;
  if (punta) {
    nudoPunta = new THREE.Object3D();
    nudoPunta.position.set(punta[0], punta[1], punta[2]);
    grupo.add(nudoPunta);
  }

  grupo.userData.triangulos = triangulos;
  grupo.userData.dibujos = dibujos;
  grupo.triangulos = triangulos;
  grupo.dibujos = dibujos;
  grupo.punta = nudoPunta;
  return grupo;
}
