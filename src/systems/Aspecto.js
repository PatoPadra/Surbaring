/**
 * Aspecto — quién es el que camina por el parque.
 *
 * Hasta acá el jugador era una cámara. Literalmente: `tercerPersona` alejaba el
 * punto de vista y no había nada que mirar, porque no existía ningún cuerpo. La
 * creación de personaje no es maquillaje sobre eso; es lo que le da al juego el
 * objeto que le faltaba, y de paso convierte el arranque en una decisión en vez
 * de una caída en un bosque.
 *
 * Deliberadamente **el aspecto no toca el juego**: no hay razas ni oficios ni
 * bonus. En un juego que enseña la ley de un parque nacional, que el color de
 * la campera decida cuánto mineral sacás sería ruido. Lo único que sí cambia es
 * la estatura, y cambia lo que tiene que cambiar: la altura de los ojos. Alguien
 * de 1,55 ve el sotobosque desde más abajo que alguien de 1,95, y eso es
 * geografía, no estadística.
 *
 * Se guarda aparte de la partida, con su propia clave: reiniciar el mundo no
 * debería obligar a volver a elegir quién sos.
 */

// v2: la v1 guardaba un campo `tocado` con gorro y sombrero entre las opciones.
// Eso se fue —ver abajo— y una clave nueva evita que un índice viejo caiga sobre
// un peinado que no tiene nada que ver.
const CLAVE = 'survibar.aspecto.v2';

/** Tonos de piel. Nombres descriptivos, no etiquetas de identidad. */
export const PIELES = [
  { nombre: 'Muy clara', color: 0xf0d3bb },
  { nombre: 'Clara',     color: 0xe3bb9c },
  { nombre: 'Trigueña',  color: 0xc79a76 },
  { nombre: 'Morena',    color: 0x9c6f4e },
  { nombre: 'Oscura',    color: 0x6d4a33 },
  { nombre: 'Muy oscura', color: 0x4a3021 },
];

export const PELOS = [
  { nombre: 'Negro',    color: 0x1b1613 },
  { nombre: 'Castaño',  color: 0x4a3122 },
  { nombre: 'Claro',    color: 0x8a6a42 },
  { nombre: 'Rubio',    color: 0xc4a061 },
  { nombre: 'Colorado', color: 0x8f4526 },
  { nombre: 'Canoso',   color: 0xb8b3aa },
];

/**
 * Cómo lleva el pelo. Sólo el pelo.
 *
 * Acá hubo gorro de lana y sombrero, y estaban mal puestos: un gorro no es un
 * rasgo con el que se nace, es una cosa que se consigue y se pone. Ofrecerlo en
 * la creación de personaje lo convertía en una decisión de nacimiento y le
 * sacaba el lugar que le corresponde —el de lo primero que uno quiere
 * fabricarse en un lugar donde la cabeza descubierta es por donde se va el
 * calor—. La cabeza queda libre para lo que se consiga en el mundo.
 */
export const PEINADOS = [
  { id: 'corto',    nombre: 'Corto' },
  { id: 'media',    nombre: 'Media melena' },
  { id: 'larga',    nombre: 'Melena larga' },
  { id: 'recogido', nombre: 'Recogido' },
  { id: 'rapado',   nombre: 'Rapado' },
];

/** Colores de campera: paleta de montaña, nada fluorescente. */
export const CAMPERAS = [
  { nombre: 'Verde musgo', color: 0x4c5a41 },
  { nombre: 'Roja',        color: 0x9a3b2c },
  { nombre: 'Azul',        color: 0x2f4a63 },
  { nombre: 'Mostaza',     color: 0xa8813a },
  { nombre: 'Gris',        color: 0x565a5c },
  { nombre: 'Crema',       color: 0xc3b294 },
];

export const PANTALONES = [
  { nombre: 'Beige',   color: 0x8a7a5e },
  { nombre: 'Gris',    color: 0x4a4b4d },
  { nombre: 'Marrón',  color: 0x5a422e },
  { nombre: 'Verde',   color: 0x3f4a37 },
  { nombre: 'Azul',    color: 0x36455a },
];

/** Complexión: multiplica el ancho del cuerpo, no la altura. */
export const COMPLEXIONES = [
  { nombre: 'Delgada', ancho: 0.86 },
  { nombre: 'Media',   ancho: 1.00 },
  { nombre: 'Robusta', ancho: 1.16 },
];

export const ESTATURA_MIN = 1.52;
export const ESTATURA_MAX = 1.96;
/** Estatura de referencia con la que está modelado el cuerpo. */
export const ESTATURA_BASE = 1.78;

const CAMPOS = ['piel', 'pelo', 'peinado', 'campera', 'pantalon', 'complexion'];
const TABLAS = {
  piel: PIELES, pelo: PELOS, peinado: PEINADOS,
  campera: CAMPERAS, pantalon: PANTALONES, complexion: COMPLEXIONES,
};

const alAzarDe = (tabla) => Math.floor(Math.random() * tabla.length);

export class Aspecto {
  constructor(datos) {
    this.estatura = 1.74;
    this.piel = 2;
    this.pelo = 1;
    this.peinado = 0;
    this.campera = 0;
    this.pantalon = 0;
    this.complexion = 1;
    /** ¿Viene de una elección hecha, o son los valores de fábrica? */
    this.elegido = false;
    if (datos) this.asignar(datos);
  }

  /** Copia sólo lo que existe y con los valores dentro de rango. */
  asignar(datos) {
    if (typeof datos.estatura === 'number') {
      this.estatura = Math.max(ESTATURA_MIN, Math.min(ESTATURA_MAX, datos.estatura));
    }
    for (const c of CAMPOS) {
      const v = datos[c];
      if (Number.isInteger(v) && v >= 0 && v < TABLAS[c].length) this[c] = v;
    }
    if (datos.elegido) this.elegido = true;
    return this;
  }

  /** Un personaje entero al azar. Es el botón que más se usa y tiene que dar algo lindo. */
  alAzar() {
    this.estatura = +(ESTATURA_MIN + Math.random() * (ESTATURA_MAX - ESTATURA_MIN)).toFixed(2);
    for (const c of CAMPOS) this[c] = alAzarDe(TABLAS[c]);
    return this;
  }

  clonar() { return new Aspecto(this.datos()); }

  datos() {
    const d = { estatura: this.estatura, elegido: this.elegido };
    for (const c of CAMPOS) d[c] = this[c];
    return d;
  }

  // ── Derivados que usa el resto del juego ──────────────────────────────────

  get colorPiel()     { return PIELES[this.piel].color; }
  get colorPelo()     { return PELOS[this.pelo].color; }
  get colorCampera()  { return CAMPERAS[this.campera].color; }
  get colorPantalon() { return PANTALONES[this.pantalon].color; }
  get idPeinado()     { return PEINADOS[this.peinado].id; }
  get anchoCuerpo()   { return COMPLEXIONES[this.complexion].ancho; }
  /** Escala del modelo, que está hecho para 1,78 m. */
  get escala()        { return this.estatura / ESTATURA_BASE; }
  /**
   * Altura de los ojos. Es la única cosa del aspecto que cambia el juego, y
   * cambia lo correcto: desde dónde se mira el mundo.
   */
  get alturaOjos()    { return this.estatura * 0.944; }

  /** Una línea para el panel: «1,74 m · media · campera verde musgo». */
  get resumen() {
    return `${this.estatura.toFixed(2).replace('.', ',')} m · `
      + `${COMPLEXIONES[this.complexion].nombre.toLowerCase()} · `
      + `campera ${CAMPERAS[this.campera].nombre.toLowerCase()}`;
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

  guardar() {
    this.elegido = true;
    try { localStorage.setItem(CLAVE, JSON.stringify(this.datos())); } catch { /* sin almacenamiento */ }
    return this;
  }

  static cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (crudo) return new Aspecto(JSON.parse(crudo));
    } catch { /* dato roto o sin almacenamiento: personaje de fábrica */ }
    return new Aspecto();
  }

  static olvidar() {
    try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
  }
}
