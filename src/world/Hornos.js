/**
 * Hornos — la parte visible de la fundición.
 *
 * Formas mínimas y honestas: una fogata es un círculo de piedras, una carbonera
 * es un montículo de tierra, un horno de barro es una bóveda con boca y una
 * fragua es un hogar bajo con campana. Todo de una pieza y sin textura: lo que
 * importa es reconocerlos de lejos y ver si están encendidos.
 *
 * Y verlos encendidos era justo lo que no se podía. Hasta la ronda 7 la fogata
 * prendida era el mismo aro de piedras mate que la apagada, y lo único que decía
 * que ardía era una luz que en la imagen final dejaba el suelo en 5 de 255: a la
 * vista, negro. Ahora lo que arde tiene llama y brasa, y la luz alcanza para leer
 * el suelo alrededor del fuego.
 */

import * as THREE from 'three';

const COLORES = {
  fogata: 0x4a4640,
  carbonera: 0x3a3128,
  horno_barro: 0x7a5c41,
  fragua: 0x4d4a46,
};

// ── La luz ──────────────────────────────────────────────────────────────────
//
// El alcance y el latido son los que tenía la luz de three que colgaba de cada
// horno: 14 m y ±19 % a 7,3 rad/s. Esa luz no se sacó por fea sino por cara:
// cada horno agregaba una luz puntual al grafo, y en three la cantidad de luces
// es parte de la clave del programa. Construir la primera fogata recompilaba seis
// programas y congelaba el juego 19 segundos en la placa de destino. Ahora el
// horno declara su luz y `engine/Luces.js` la escribe en dos lugares que existen
// desde la carga.
//
// **La intensidad de noche sale de la imagen final, no del suelo liso.** Con 2,6
// la fogata dejaba el suelo en +5,46 de 255 a 2 m. No era un problema de altura
// sino de nivel: por debajo de cierto valor ACES devuelve cero, y lo que queda
// encima lo aplastan la exposición de noche y la curva del grado. La cadena está
// copiada en números en `.claude/flota/r7-brasa-cadena.mjs`, calibrada contra esa
// medición y validada contra el mediodía de la base (predijo +5,1 a +6,6 donde se
// midió +5,86). Con 20 predice +52 a +65 a 2 m y +22 a +34 a 8 m, y con las briznas
// encendidas y el suelo oscuro mezclados en el anillo, no menos de +40.
//
// El color va un poco más amarillo que el de antes (0xff8c3a, unos 2100 K: sigue
// siendo leña). Por la misma energía rinde un 20 % más de luminancia, porque la
// luminancia pesa sobre todo el verde, y el naranja rojizo de antes casi no tenía.
const BRASA_COLOR = new THREE.Color(0xff8c3a);
const BRASA_RADIO_M = 14;
const BRASA_ALTURA_M = 0.6;
const BRASA_NOCHE = 20;
// **Y al sol baja a 1, menos que los 2,6 de antes.** El ojo de verdad se adapta
// miles de veces del mediodía a la medianoche; la exposición del juego, una parada
// y media. Sin esto, la luz que hace falta a medianoche le sumaba al suelo +40 al
// mediodía, que el modelo da en +2,3 a +3,0 con 1.
const BRASA_DIA = 1;
/** El latido, como fracción de la intensidad: los mismos ±0,5 sobre 2,6 de antes. */
const BRASA_LATIDO = 0.19;
const BRASA_LATIDO_RAD_S = 7.3;

/** Por debajo de esto una llama que se apaga ya no se dibuja. */
const VISIBLE = 0.02;

/**
 * Qué parte de su luz de noche da un fuego con el sol a esta altura: 1 a oscuras,
 * `BRASA_DIA / BRASA_NOCHE` a pleno sol.
 *
 * Es la adaptación del ojo que la exposición no hace, y vale para cualquier
 * llama: la antorcha tiene el mismo problema, por eso se exporta. La frontera es
 * la de `Tiempo._exposicion` —sol entre −6,9° y +1,1°—, así que el fuego se
 * enciende en el mismo momento en que la escena deja de compensar la noche.
 *
 * @param {number} [senoSol] el seno de la altura del sol (`cielo.direccionSol.y`).
 *   Sin dato se toma la noche: el fuego está para la noche, y quien no sabe la
 *   hora lo recibe como se lo necesita.
 */
export function luzDeFuegoSegunSol(senoSol) {
  if (!Number.isFinite(senoSol)) return 1;
  const t = Math.max(0, Math.min(1, (senoSol + 0.12) / 0.14));
  const dia = t * t * (3 - 2 * t);
  return 1 + (BRASA_DIA / BRASA_NOCHE - 1) * dia;
}

// ── Lo que se ve arder ──────────────────────────────────────────────────────
//
// Tres materiales para todos los hornos: brasa roja, lengua naranja y núcleo
// amarillo. **Estándar con color emisivo, y nada más**: `emissive` es un
// uniforme, así que comparten programa con las piedras —compiladas desde la
// carga— y construir o prender no compila nada. Una llama aditiva, transparente o
// de doble cara cambiaría la clave, y es el congelamiento de la ronda 5 otra vez.
// Por lo mismo no hay degradé: sin transparencia ni color por vértice, el color va
// por pieza, y el fuego se arma con piezas de colores distintos.
//
// Albedo negro: la llama no refleja la luz de nadie, ni la suya. Así brilla igual
// a medianoche que al mediodía, y la oclusión y las cascadas no le cambian el tono.
//
// Los números salen de la misma cadena modelada. Todos quedan por debajo de 0,86
// de luminancia para el filtro del resplandor (0,786 el núcleo): el resplandor
// pasa el píxel entero, y un halo visto desde arriba se le sumaría al suelo del
// mediodía. El núcleo da ~226 de 255 de noche, ~218 si la oclusión le come un
// quinto.
const ARDE = {
  nucleo: { emisivo: 0xffc25e, intensidad: 1.25 },
  lengua: { emisivo: 0xff8a2a, intensidad: 1.3 },
  brasa: { emisivo: 0xff5a1e, intensidad: 1.0 },
};

/**
 * La lengua de fuego, de la base a la punta, en unidades: panza abajo y punta
 * fina. Torneada en siete lados da 84 triángulos; la escala pone el tamaño.
 */
const PERFIL = [[0, 0], [0.55, 0.06], [0.8, 0.18], [0.72, 0.36], [0.45, 0.6], [0.18, 0.84], [0, 1]];

/**
 * Deja que a este material lo envuelvan para las cascadas de sombra UNA vez.
 *
 * Los materiales de lo que arde son de todos los hornos, y `main.js` pasa cada
 * malla de cada horno recién construido por `conCSM`, que envuelve
 * `onBeforeCompile` y arma `customProgramCacheKey` **encima de la clave que ya
 * había**. Con las piedras, un material por horno, pasa una sola vez. Con uno
 * compartido pasaba una vez por horno y la clave crecía: medido con three en Node,
 * la primera fogata comparte programa con las piedras (clave de 188 caracteres) y
 * la segunda pide uno nuevo (326). Era el congelamiento de la ronda 5, corrido a
 * la segunda fogata.
 *
 * Así que se guarda la primera vuelta entera del envoltorio —termina cuando
 * escribe la clave— y las siguientes no cambian nada. El arreglo de fondo es que
 * `conCSM` no envuelva dos veces lo mismo (`.claude/flota/pendiente-r7-brasa.md`);
 * con eso esto sobra, y no molesta.
 *
 * Lo que se pierde en las vueltas ignoradas: `CSM.setupMaterial` vuelve a anotar
 * el material sin sombreador y deja de actualizarle los cortes de las cascadas. A
 * una llama no le importa: su albedo es negro y no recibe sombra, así que la
 * cascada que le toque no cambia un píxel.
 */
function envolverUnaVez(material) {
  let alCompilar = material.onBeforeCompile;
  let clave = material.customProgramCacheKey;
  let cerrado = false;
  Object.defineProperty(material, 'onBeforeCompile', {
    configurable: true, enumerable: true,
    get: () => alCompilar,
    set: (f) => { if (!cerrado) alCompilar = f; },
  });
  Object.defineProperty(material, 'customProgramCacheKey', {
    configurable: true, enumerable: true,
    get: () => clave,
    set: (f) => { if (!cerrado) { clave = f; cerrado = true; } },
  });
}

function materialQueArde({ emisivo, intensidad }) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 1, metalness: 0,
    emissive: emisivo, emissiveIntensity: intensidad,
  });
  envolverUnaVez(m);
  return m;
}

export class Hornos {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'hornos';
    /**
     * `brillo` es la luz relativa, con el latido (1 = la de base); `llama` y
     * `rescoldo`, cuánto se ve de la llama y de la brasa, de 0 a 1.
     * @type {Array<{horno:object, malla:THREE.Object3D, brillo:number, llama:number, rescoldo:number, fuego:object[]}>}
     */
    this.piezas = [];
    this._materiales = {
      nucleo: materialQueArde(ARDE.nucleo),
      lengua: materialQueArde(ARDE.lengua),
      brasa: materialQueArde(ARDE.brasa),
    };
    // Geometrías de unidad, compartidas: el tamaño lo pone la escala de cada pieza
    const caja = new THREE.BoxGeometry(1, 1, 1);
    caja.translate(0, 0.5, 0);   // con la base en y = 0, para que crezca hacia arriba
    this._formas = {
      lengua: new THREE.LatheGeometry(PERFIL.map(([r, y]) => new THREE.Vector2(r, y)), 7),
      lecho: new THREE.DodecahedronGeometry(1, 0),
      caja,
    };
  }

  /** Levanta la geometría de un horno recién construido. */
  agregar(horno) {
    const color = COLORES[horno.def.id] ?? 0x6b5a48;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02 });
    const nodo = new THREE.Group();
    const F = this._formas;
    /** Lo que arde, con sus medidas de reposo. */
    let fuego;

    switch (horno.def.id) {
      case 'fogata': {
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 5, 9), mat);
        anillo.rotation.x = Math.PI / 2;
        anillo.position.y = 0.16;
        nodo.add(anillo);
        // Un lecho de brasas dentro del aro, el núcleo alto al centro y dos
        // lenguas más bajas que se abren a los costados. El núcleo es lo que más
        // brilla y el más alto a propósito: se lo ve por encima de las lenguas
        // desde cualquier lado, que es de donde sale el pico de B1.
        fuego = [
          this._pieza('lecho', F.lecho, 'brasa', { y: 0.07, ancho: 0.36, alto: 0.12, hondo: 0.36 }),
          this._pieza('nucleo', F.lengua, 'nucleo', { llama: true, y: 0.06, ancho: 0.22, alto: 1.0, hondo: 0.22, fase: 0 }),
          this._pieza('lengua', F.lengua, 'lengua', { llama: true, x: 0.14, y: 0.06, z: -0.07, ancho: 0.17, alto: 0.58, hondo: 0.17, inclinaX: -0.10, inclinaZ: -0.22, fase: 2.1 }),
          this._pieza('lengua', F.lengua, 'lengua', { llama: true, x: -0.13, y: 0.06, z: 0.08, ancho: 0.16, alto: 0.52, hondo: 0.16, inclinaX: 0.12, inclinaZ: 0.24, fase: 4.4 }),
        ];
        break;
      }
      case 'carbonera': {
        const mont = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 10), mat);
        mont.position.y = 0.75;
        nodo.add(mont);
        // La carbonera arde tapada: lo único que se ve es el respiradero de arriba
        fuego = [this._pieza('respiradero', F.lecho, 'brasa', { y: 1.46, ancho: 0.13, alto: 0.1, hondo: 0.13 })];
        break;
      }
      case 'horno_barro': {
        // Un material por malla, aunque sean iguales. `dibujarHorno` pasa cada
        // malla por `conCSM`, y un material repetido en el mismo nodo quedaba
        // envuelto dos veces, con otra clave de programa que la de las piedras de
        // la fogata: medido en Node, el primer horno de barro y la primera fragua
        // compilaban un programa cada uno. Clonado antes de envolver, no cuesta nada.
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.5, 12), mat.clone());
        base.position.y = 0.25;
        cuerpo.position.y = 0.5;
        nodo.add(base, cuerpo);
        // La boca, apoyada en el escalón que deja la base delante de la bóveda, y
        // el fuego adentro asomando al frente. Al apagarse se hunden en la pared.
        fuego = [
          this._pieza('boca', F.caja, 'brasa', { y: 0.51, z: 1.1, ancho: 0.5, alto: 0.34, hondo: 0.14 }),
          this._pieza('nucleo', F.caja, 'nucleo', { llama: true, vaiven: 0, y: 0.52, z: 1.115, ancho: 0.28, alto: 0.2, hondo: 0.14 }),
        ];
        break;
      }
      default: {
        const hogar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), mat);
        hogar.position.y = 0.45;
        const campana = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 6), mat.clone());   // ver horno_barro
        campana.position.y = 1.5;
        nodo.add(hogar, campana);
        // La fragua: la boca del hogar en la cara de adelante
        fuego = [
          this._pieza('boca', F.caja, 'brasa', { y: 0.4, z: 0.53, ancho: 0.66, alto: 0.3, hondo: 0.1 }),
          this._pieza('nucleo', F.caja, 'nucleo', { llama: true, vaiven: 0, y: 0.41, z: 0.545, ancho: 0.34, alto: 0.17, hondo: 0.09 }),
        ];
      }
    }

    nodo.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    // Lo que arde va después: un fuego no proyecta sombra, y dibujarlo en las
    // cascadas son pasadas de profundidad por nada. `receiveShadow` es un
    // uniforme, así que apagarlo no toca la clave del programa.
    for (const f of fuego) nodo.add(f.malla);
    nodo.position.set(horno.x, horno.y, horno.z);

    this.grupo.add(nodo);
    // Arranca encendido si el horno ya arde: una fogata repuesta de la partida no
    // puede aparecer negra ni un cuadro (ver `Partida._reponerHornos`).
    const arde = horno.ardiendo ? 1 : 0;
    const pieza = { horno, malla: nodo, brillo: arde, llama: arde, rescoldo: arde, fuego };
    this.piezas.push(pieza);
    this._animar(pieza, 0);
    return nodo;
  }

  /** Una pieza de lo que arde, escondida hasta que `_animar` diga otra cosa. */
  _pieza(nombre, forma, material, o) {
    const malla = new THREE.Mesh(forma, this._materiales[material]);
    malla.name = nombre;
    malla.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    malla.visible = false;
    return {
      malla, llama: !!o.llama, ancho: o.ancho, alto: o.alto, hondo: o.hondo,
      inclinaX: o.inclinaX ?? 0, inclinaZ: o.inclinaZ ?? 0, fase: o.fase ?? 0, vaiven: o.vaiven ?? 1,
    };
  }

  /** Enciende el fuego de los que arden, lo hace latir y mueve la llama. Un horno
   *  sin leña o ahogado por la lluvia se queda a oscuras, y eso se ve de lejos: el
   *  fuego es la única señal de que sigue vivo cuando uno vuelve al campamento. */
  actualizar(t) {
    for (const p of this.piezas) {
      const activo = !!p.horno.ardiendo;
      const objetivo = activo ? 1 + Math.sin(t * BRASA_LATIDO_RAD_S + p.malla.position.x) * BRASA_LATIDO : 0;
      p.brillo += (objetivo - p.brillo) * 0.15;
      p.llama += ((activo ? 1 : 0) - p.llama) * 0.15;
      // La brasa tarda más en apagarse que la llama: queda un segundo de rescoldo
      p.rescoldo += ((activo ? 1 : 0) - p.rescoldo) * (activo ? 0.15 : 0.04);
      this._animar(p, t);
    }
  }

  /**
   * Pone cada pieza de lo que arde en su tamaño y su lugar para el instante `t`.
   *
   * La llama tiembla con dos senos de frecuencias que no se enciman (9,3 y 15,1
   * rad/s), igual que el parpadeo de la antorcha: con uno solo late como un faro.
   * Cuando se estira se afina, y se mece despacio. La brasa sólo respira. Todo es
   * escala y giro de cuatro mallas a lo sumo por horno: nada que suba a la GPU más
   * que una matriz.
   */
  _animar(p, t) {
    const fase = p.malla.position.x;
    const hayLlama = p.llama > VISIBLE;
    const hayBrasa = p.rescoldo > VISIBLE;
    for (const f of p.fuego) {
      const m = f.malla;
      if (!f.llama) {
        m.visible = hayBrasa;
        if (!hayBrasa) continue;
        const k = p.rescoldo * (1 + 0.06 * Math.sin(t * 2.3 + fase + f.fase));
        m.scale.set(f.ancho * k, f.alto * k, f.hondo * k);
        continue;
      }
      m.visible = hayLlama;
      if (!hayLlama) continue;
      const w = f.fase + fase;
      const temblor = 0.62 * Math.sin(t * 9.3 + w) + 0.38 * Math.sin(t * 15.1 + 2.3 * w);
      const afinar = Math.sqrt(p.llama) * (1 - 0.08 * temblor);
      m.scale.set(f.ancho * afinar, f.alto * p.llama * (1 + 0.2 * temblor), f.hondo * afinar);
      m.rotation.x = f.inclinaX + f.vaiven * 0.07 * Math.sin(t * 3.1 + 1.3 * w);
      m.rotation.z = f.inclinaZ + f.vaiven * 0.09 * Math.sin(t * 3.7 + w);
    }
  }

  /**
   * La luz de los hornos que arden, para `engine/Luces.js`.
   *
   * Sólo los que arden: uno apagado no alumbra, y dejarlo en la lista le haría
   * competir por uno de los dos lugares con intensidad cero. Mientras arde, la
   * intensidad nunca baja del valle del latido: el suavizado de `actualizar()`
   * arranca de cero al prenderse, y una fogata recién encendida que tarda medio
   * segundo en dar luz se lee como un fuego que no prendió.
   *
   * @param {number} [senoSol] el seno de la altura del sol, para bajar la luz de
   *   día (ver `luzDeFuegoSegunSol`). Sin él, la de noche.
   * @returns {Array<{x:number,y:number,z:number,radio:number,color:number[],intensidad:number}>}
   */
  fuentesDeLuz(senoSol) {
    const alSol = BRASA_NOCHE * luzDeFuegoSegunSol(senoSol);
    // Un arreglo nuevo por llamada y no uno reusado: son un puñado de objetos
    // por cuadro, y uno reusado le cambia el contenido a quien lo guardó.
    const salida = [];
    for (const p of this.piezas) {
      if (!p.horno.ardiendo) continue;
      const m = p.malla.position;
      salida.push({
        x: m.x, y: m.y + BRASA_ALTURA_M, z: m.z,
        radio: BRASA_RADIO_M,
        color: [BRASA_COLOR.r, BRASA_COLOR.g, BRASA_COLOR.b],
        intensidad: alSol * Math.max(p.brillo, 1 - BRASA_LATIDO),
      });
    }
    return salida;
  }
}
