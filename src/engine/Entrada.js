/** Entrada — teclado y ratón con bloqueo de puntero. Teclas en disposición latinoamericana. */

/**
 * ¿El teclado le pertenece ahora a un campo de texto?
 *
 * Esto escuchaba `keydown` en `window` sin mirar el foco, y no molestaba
 * mientras ningún panel tuvo dónde escribir. En cuanto el Códice estrenó su
 * buscador, tipear "gato" cerraba el Taller con la `g` y abría el mapa con la
 * `m`, y `Tab` cerraba el propio panel donde se estaba escribiendo.
 *
 * `Codice.js` lo tapó por su lado con `stopPropagation`, que funciona pero deja
 * la trampa armada para el próximo panel que estrene un campo. El arreglo de
 * raíz va acá: si el foco está en algo donde se escribe, el teclado no es del
 * juego.
 */
function escribiendo(objetivo) {
  const el = objetivo instanceof Element ? objetivo : document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const t = el.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
}

/**
 * Las teclas que le devuelven el paso a la mano: adelante y atrás.
 *
 * Son éstas y no «cualquier tecla de movimiento» a propósito. El andar solo
 * existe para las caminatas largas —el punto útil de arcilla más cercano está a
 * medio kilómetro, la arena legal a ocho y medio—, y en una caminata larga uno
 * dobla, corre, salta un tronco y se agacha bajo una rama. Si A, D, Shift,
 * Espacio, Ctrl o C lo cortaran, habría que volver a apretar Z después de cada
 * cosa, y la tecla no serviría para lo único que sirve. W y S, en cambio, son
 * alguien retomando el control del paso: ahí sí se apaga.
 */
const CORTAN_EL_ANDAR = ['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown'];

export class Entrada {
  constructor(lienzo) {
    this.lienzo = lienzo;
    this.teclas = new Set();
    this.ratonDX = 0;
    this.ratonDY = 0;
    this.sensibilidad = 1;
    this.invertirY = false;
    this.bloqueado = false;
    this.alPulsar = new Map();
    this._autoAndar = false;

    addEventListener('keydown', (e) => {
      // La repetición se ignora antes que nada, y para la Z eso es la mitad del
      // contrato: dejarla apretada no puede prender y apagar veinte veces por
      // segundo según cuánto dure el dedo.
      if (e.repeat) return;
      // Se sueltan las teclas además de ignorar la pulsación: si uno estaba
      // caminando y hace clic en el buscador, sin esto el jugador sigue
      // caminando solo para siempre porque el `keyup` de la W nunca llega.
      if (escribiendo(e.target)) { this.teclas.clear(); return; }
      this.teclas.add(e.code);
      if (CORTAN_EL_ANDAR.includes(e.code)) this.autoAndar = false;
      // Z no se registra con `registrar()`: es un estado del movimiento, igual
      // que agacharse, y vive donde viven los movimientos. Sólo con el puntero
      // bloqueado: con un panel abierto la Z es una letra, no un paso.
      else if (e.code === 'KeyZ' && this.bloqueado) this.autoAndar = !this._autoAndar;
      const fn = this.alPulsar.get(e.code);
      if (fn) fn();
      if (['Space', 'Tab', 'F1', 'F2', 'F3'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    // Perder el foco es lo mismo que soltar todo: con Alt+Tab el `keyup` no
    // llega, y un personaje que sigue andando solo mientras uno contesta un
    // mensaje en otra ventana termina en el fondo del lago.
    addEventListener('blur', () => { this.teclas.clear(); this.autoAndar = false; });

    lienzo.addEventListener('click', () => {
      if (!this.bloqueado) lienzo.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.bloqueado = document.pointerLockElement === lienzo;
      document.body.classList.toggle('jugando', this.bloqueado);
      // Soltar el puntero es abrir un panel, morir o apretar Escape: en los tres
      // casos el jugador dejó de manejar el paso, así que el paso se detiene.
      if (!this.bloqueado) this.autoAndar = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.bloqueado) return;
      this.ratonDX += e.movementX;
      this.ratonDY += e.movementY;
    });
  }

  registrar(codigo, fn) { this.alPulsar.set(codigo, fn); }
  tecla(c) { return this.teclas.has(c); }
  consumirRaton() { this.ratonDX = 0; this.ratonDY = 0; }

  /**
   * Andar solo: `adelante` vale 1 sin que haya ninguna tecla apretada.
   *
   * La clase `auto-andar` en el cuerpo del documento va y viene con el estado
   * desde el setter, y no desde cada lugar que lo apaga: son cuatro caminos
   * —Z, W o S, soltar el puntero, perder el foco— más quien lo escriba desde
   * afuera, y un personaje que camina solo sin que la pantalla diga por qué se
   * lee como un juego roto. Con un solo lugar no hay camino que se olvide.
   *
   * Sin el puntero bloqueado no se prende, tampoco desde afuera: todo lo que lo
   * apaga pasa por soltar el puntero, así que prenderlo suelto dejaría un paso
   * que nada detiene.
   */
  get autoAndar() { return this._autoAndar; }
  set autoAndar(v) {
    const prender = !!v && this.bloqueado;
    if (prender === this._autoAndar) return;
    this._autoAndar = prender;
    document.body?.classList.toggle('auto-andar', prender);
  }

  get adelante() {
    const va = this.tecla('KeyW') || this.tecla('ArrowUp');
    const vuelve = this.tecla('KeyS') || this.tecla('ArrowDown');
    // Si hay una tecla de paso apretada, manda la tecla. Pasa sólo cuando W ya
    // estaba abajo al apretar Z: al soltarla, sigue andando solo.
    if (this._autoAndar && !va && !vuelve) return 1;
    return (va ? 1 : 0) - (vuelve ? 1 : 0);
  }
  get lateral() {
    return (this.tecla('KeyD') || this.tecla('ArrowRight') ? 1 : 0)
         - (this.tecla('KeyA') || this.tecla('ArrowLeft') ? 1 : 0);
  }
  get saltar() { return this.tecla('Space'); }
  get correr() { return this.tecla('ShiftLeft') || this.tecla('ShiftRight'); }
  get agachar() { return this.tecla('ControlLeft') || this.tecla('KeyC'); }
}
