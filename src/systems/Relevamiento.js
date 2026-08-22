/**
 * Relevamiento — el año que dura el juego, y por qué el juego dura un año.
 *
 * SurviBar tenía treinta y dos fichas de historia, sesenta y tres de flora,
 * sesenta y una de fauna, cuarenta y siete tecnologías y ningún motivo para
 * seguir. Se podía terminar el árbol entero y no pasaba nada. Un códice sin
 * autor es una base de datos, y ésa era la sensación: una enciclopedia con
 * caminata.
 *
 * No hace falta inventarle una trama, y hacerlo habría sido peor. **La historia
 * real de este lugar es una historia de relevamientos.** Moreno llegó al Nahuel
 * Huapi en 1876 a medir; el resultado de haber medido fue que en 1903 donara al
 * Estado tres leguas cuadradas en el brazo Blest con la condición de que se
 * conservaran en su estado natural, y de esa donación salió, treinta y un años
 * después, el primer parque nacional del país. El jugador está haciendo
 * literalmente lo mismo: recorrer, identificar, anotar. Sólo faltaba decírselo y
 * darle un final.
 *
 * El arco es **el año calendario**, y sale del lugar y no de una trama pegada
 * encima: el motor ya simula estaciones, vedas por mes, floraciones y cota de
 * nieve. Un año obliga a pasar el invierno arriba de la cota, a ver cerrar la
 * temporada de pesca, a ver bajar al huemul. Es el objetivo que el propio
 * paisaje impone a cualquiera que quiera describirlo.
 *
 * Se guarda aparte de la partida y no se reinicia al morir: el cuaderno no se
 * cae con el cuerpo. Ésa es la tesis del juego y acá también rige.
 */

const CLAVE = 'survibar.relevamiento.v1';
const DIAS_DEL_ANIO = 365;
const MS_POR_DIA = 86400000;

export class Relevamiento {
  /**
   * @param {object} deps {tiempo, codice, saberes, construccion, exploracion}
   */
  constructor(deps) {
    Object.assign(this, deps);
    /** Fecha de juego en la que se abrió el cuaderno. */
    this.inicioMs = null;
    /** Ya se cerró el año alguna vez. */
    this.cerrado = false;
    /** Lo llama main cuando el año se cumple. */
    this.alCumplirse = null;
    this._cargar();
  }

  /** Arranca el conteo si es la primera vez que se juega. */
  comenzar(fecha) {
    if (this.inicioMs != null) return;
    this.inicioMs = fecha.getTime();
    this._guardar();
  }

  /** Días de juego transcurridos desde que se abrió el cuaderno. */
  get dias() {
    if (this.inicioMs == null) return 0;
    return Math.max(0, Math.floor((this.tiempo.fecha.getTime() - this.inicioMs) / MS_POR_DIA));
  }

  get fraccion() { return Math.min(1, this.dias / DIAS_DEL_ANIO); }

  get total() { return DIAS_DEL_ANIO; }

  /** Una línea para la cabecera del códice. */
  get texto() {
    if (this.inicioMs == null) return '';
    return this.cerrado
      ? `Año cerrado · día ${this.dias}`
      : `Día ${this.dias} de ${DIAS_DEL_ANIO}`;
  }

  /**
   * Se llama desde el bucle. Barata: dos restas y una comparación.
   * Cerrar el año no termina el juego —se puede seguir— pero se avisa una vez.
   */
  actualizar() {
    if (this.inicioMs == null) this.comenzar(this.tiempo.fecha);
    if (this.cerrado || this.dias < DIAS_DEL_ANIO) return;
    this.cerrado = true;
    this._guardar();
    this.alCumplirse?.(this.resumen());
  }

  /**
   * Lo que quedó anotado, con los números reales del jugador. No hay puntaje ni
   * estrellas: es un inventario de lo que sabe, que es de lo que trata el juego.
   */
  resumen() {
    return {
      dias: this.dias,
      especies: this.codice?.identificadas?.size ?? 0,
      especiesPosibles: (this.codice?.flora?.especies?.length ?? 0)
        + (this.codice?.fauna?.especies?.length ?? 0),
      lugares: this.codice?.lugares?.size ?? 0,
      lugaresPosibles: this.codice?.listaLugares?.length ?? 0,
      tecnologias: this.saberes?.desbloqueadas?.size ?? 0,
      saber: this.saberes?.ganadosTotales ?? 0,
      obras: this.construccion?.obras?.length ?? 0,
      normas: this.normativaLeidas ?? 0,
      explorado: this.exploracion?.fraccionExplorada ?? 0,
    };
  }

  _guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({
        inicioMs: this.inicioMs, cerrado: this.cerrado,
      }));
    } catch { /* sin almacenamiento */ }
  }

  _cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return;
      const d = JSON.parse(crudo);
      this.inicioMs = Number.isFinite(d.inicioMs) ? d.inicioMs : null;
      this.cerrado = !!d.cerrado;
      // Una fecha de inicio que no guarda relación con el reloj del mundo es un
      // dato roto, no un cuaderno viejo: con una de 1971 el año se cerraría en
      // el primer cuadro y el jugador vería el epílogo antes de dar un paso.
      // Pasó de verdad, escribiéndolo mal desde una prueba.
      const DIEZ_ANIOS = 10 * 365 * MS_POR_DIA;
      if (this.inicioMs != null
          && Math.abs(this.tiempo.fecha.getTime() - this.inicioMs) > DIEZ_ANIOS) {
        this.inicioMs = null;
        this.cerrado = false;
      }
    } catch { /* dato roto: se empieza de nuevo el conteo */ }
  }

  olvidar() {
    this.inicioMs = null;
    this.cerrado = false;
    this._guardar();
  }
}
