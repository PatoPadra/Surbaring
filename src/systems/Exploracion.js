/**
 * Exploración — qué parte del parque conoce el jugador.
 *
 * El mapa no viene revelado. Se descubre caminando, y lo que se revela depende
 * de desde dónde se mira: parado en la costa se conoce lo que se ve alrededor,
 * y desde la cumbre del Catedral se abre medio parque de una vez. Eso no es una
 * mecánica inventada: es exactamente por qué la gente sube a los miradores.
 *
 * El alcance de la revelación sale de tres cosas reales:
 *
 * - **La altura sobre el entorno.** No la altitud absoluta: estar a 1.500 m en
 *   el fondo de un valle rodeado de paredes no muestra nada. Se compara contra
 *   el terreno de alrededor.
 * - **El clima.** Con niebla o nevada no se ve, y por lo tanto no se descubre.
 * - **La luz.** De noche se revela apenas lo que se pisa.
 *
 * Se guarda en una grilla de bytes y se persiste en el navegador, así que el
 * mapa sobrevive a recargar la página y a morirse.
 */

const CELDAS = 256;                 // 65.536 m / 256 = 256 m por celda
const CLAVE = 'survibar.exploracion.v1';

export class Exploracion {
  /** @param {import('../world/Mundo.js').Mundo} mundo */
  constructor(mundo) {
    this.mundo = mundo;
    this.celdas = CELDAS;
    this.metrosPorCelda = mundo.tamano / CELDAS;
    /** 0 = desconocido, 255 = conocido de cerca */
    this.conocido = new Uint8Array(CELDAS * CELDAS);
    this.nuevasDesdeUltimoDibujo = 0;
    this._acumulado = 0;
    /**
     * Sube cada vez que la grilla cambia. El mapa lo usa para no rehacer el
     * velo —65.536 iteraciones— en cada cuadro de un arrastre.
     */
    this.version = 0;
    /** Celdas con algo conocido, al día. Evita recorrer 65.536 para contarlas. */
    this._conocidas = 0;
    /** Hay cambios sin escribir en el almacenamiento. */
    this._sucio = false;
    this.cargar();

    // El guardado por umbral —cada 400 celdas nuevas, en `main.js`— pierde lo
    // último que se caminó: quien descubre 399 celdas y cierra la pestaña las
    // pierde todas. `Partida` ya se protege así de lo mismo, pero guarda su
    // propia clave, no ésta. Sin esto, explorar de a poco no se acumulaba.
    // Por `globalThis` y no a pelo: `document?.` no protege de un identificador
    // que no existe —tira ReferenceError igual— y este módulo se importa desde
    // los bancos de Node, donde no hay ni ventana ni documento.
    const doc = globalThis.document;
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('beforeunload', () => this.guardarSiHaceFalta());
      // En móviles `beforeunload` no dispara: el evento fiable es éste
      doc?.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') this.guardarSiHaceFalta();
      });
    }
  }

  _indice(x, z) {
    const i = Math.floor((x + this.mundo.mitad) / this.metrosPorCelda);
    const j = Math.floor((z + this.mundo.mitad) / this.metrosPorCelda);
    if (i < 0 || j < 0 || i >= CELDAS || j >= CELDAS) return -1;
    return j * CELDAS + i;
  }

  /** ¿Qué tan conocida es esta celda? 0 a 1. */
  conocimientoEn(x, z) {
    const k = this._indice(x, z);
    return k < 0 ? 0 : this.conocido[k] / 255;
  }

  /**
   * Se lee al abrir el mapa, al abrir las opciones y al cerrar el año. Antes
   * recorría las 65.536 celdas cada vez; ahora el contador se lleva al día en
   * `revisar()`, que es el único lugar donde una celda pasa de cero a algo.
   */
  get fraccionExplorada() {
    return this._conocidas / this.conocido.length;
  }

  /**
   * Cuánto se ve desde acá, en metros.
   *
   * La prominencia se estima contra el terreno de un kilómetro a la redonda:
   * es la diferencia entre estar sobre una loma y estar al pie de ella.
   */
  alcanceVisual(pos, est) {
    let suma = 0, n = 0;
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2;
      suma += this.mundo.alturaEn(pos.x + Math.cos(ang) * 900, pos.z + Math.sin(ang) * 900);
      n++;
    }
    const prominencia = Math.max(0, pos.y - suma / n);

    // Base de 380 m —lo que se abarca caminando por el bosque— más lo que suma
    // estar por encima del entorno. Un mirador de 400 m de prominencia abre
    // unos 3 km, que es del orden de lo que se ve de verdad.
    let alcance = 380 + prominencia * 7;

    // Nada de esto vale si no se ve: niebla, nevada y noche cierran el mundo.
    const niebla = Math.min(1, (est?.densidadNiebla ?? 0) / 0.0015);
    alcance *= 1 - niebla * 0.9;
    const hora = est?.horaDecimal ?? 12;
    const deNoche = hora < 7 || hora > 20.5;
    if (deNoche) alcance = Math.min(alcance, 220);

    return Math.max(90, Math.min(6000, alcance));
  }

  /**
   * Revela alrededor del jugador. Se llama pocas veces por segundo: recorrer un
   * disco de tres kilómetros en celdas de 256 m son unas cuatrocientas celdas, y
   * hacerlo por cuadro sería tirar tiempo.
   */
  revisar(pos, est, dt) {
    this._acumulado += dt;
    if (this._acumulado < 0.4) return 0;
    this._acumulado = 0;

    const alcance = this.alcanceVisual(pos, est);
    const radioCeldas = Math.ceil(alcance / this.metrosPorCelda);
    const ci = Math.floor((pos.x + this.mundo.mitad) / this.metrosPorCelda);
    const cj = Math.floor((pos.z + this.mundo.mitad) / this.metrosPorCelda);
    let nuevas = 0, cambio = false;

    for (let dj = -radioCeldas; dj <= radioCeldas; dj++) {
      for (let di = -radioCeldas; di <= radioCeldas; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= CELDAS || j >= CELDAS) continue;
        const d = Math.hypot(di, dj) * this.metrosPorCelda;
        if (d > alcance) continue;

        // Cerca se conoce en detalle; en el borde de lo que se alcanza a ver,
        // apenas se intuye. El mapa lo dibuja más tenue.
        const nitidez = 1 - Math.pow(d / alcance, 1.6);
        const valor = Math.round(60 + nitidez * 195);
        const k = j * CELDAS + i;
        if (valor > this.conocido[k]) {
          if (this.conocido[k] === 0) { nuevas++; this._conocidas++; }
          this.conocido[k] = valor;
          cambio = true;
        }
      }
    }
    // Ojo con la diferencia: `nuevas` son celdas que pasaron de negro a algo,
    // y es lo que decide cuándo guardar. `cambio` incluye además las que se
    // afinaron —de intuidas a conocidas de cerca—, que no suman al conteo pero
    // sí cambian el dibujo del velo. Contar sólo las primeras dejaba el mapa
    // sin repintar mientras uno se acercaba a lo que ya había entrevisto.
    if (cambio) { this.version++; this._sucio = true; }
    if (nuevas > 0) this.nuevasDesdeUltimoDibujo += nuevas;
    return nuevas;
  }

  /** Escribe sólo si hay algo sin escribir. La llaman el cierre y el bucle. */
  guardarSiHaceFalta() {
    if (this._sucio) this.guardar();
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

  guardar() {
    try {
      // Base64 de la grilla: 64 KB crudos, y comprime bien porque casi todo es
      // cero. Se arma por tandas y no carácter por carácter: `fromCharCode` con
      // 65.536 argumentos revienta la pila de llamadas en varios navegadores.
      let s = '';
      const TANDA = 8192;
      for (let k = 0; k < this.conocido.length; k += TANDA) {
        s += String.fromCharCode.apply(null, this.conocido.subarray(k, k + TANDA));
      }
      localStorage.setItem(CLAVE, btoa(s));
      this._sucio = false;
    } catch { /* sin almacenamiento: el mapa vive sólo esta sesión */ }
  }

  cargar() {
    try {
      const s = localStorage.getItem(CLAVE);
      if (!s) return false;
      const bin = atob(s);
      if (bin.length !== this.conocido.length) return false;
      let n = 0;
      for (let k = 0; k < bin.length; k++) {
        const v = bin.charCodeAt(k);
        this.conocido[k] = v;
        if (v > 0) n++;
      }
      this._conocidas = n;
      this.version++;
      this._sucio = false;
      return true;
    } catch { return false; }
  }

  olvidar() {
    this.conocido.fill(0);
    this._conocidas = 0;
    this.version++;
    this._sucio = false;
    try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
  }
}
