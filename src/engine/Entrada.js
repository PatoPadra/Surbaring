/** Entrada — teclado y ratón con bloqueo de puntero. Teclas en disposición latinoamericana. */

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

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.teclas.add(e.code);
      const fn = this.alPulsar.get(e.code);
      if (fn) fn();
      if (['Space', 'Tab', 'F1', 'F2', 'F3'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    addEventListener('blur', () => this.teclas.clear());

    lienzo.addEventListener('click', () => {
      if (!this.bloqueado) lienzo.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.bloqueado = document.pointerLockElement === lienzo;
      document.body.classList.toggle('jugando', this.bloqueado);
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

  get adelante() {
    return (this.tecla('KeyW') || this.tecla('ArrowUp') ? 1 : 0)
         - (this.tecla('KeyS') || this.tecla('ArrowDown') ? 1 : 0);
  }
  get lateral() {
    return (this.tecla('KeyD') || this.tecla('ArrowRight') ? 1 : 0)
         - (this.tecla('KeyA') || this.tecla('ArrowLeft') ? 1 : 0);
  }
  get saltar() { return this.tecla('Space'); }
  get correr() { return this.tecla('ShiftLeft') || this.tecla('ShiftRight'); }
  get agachar() { return this.tecla('ControlLeft') || this.tecla('KeyC'); }
}
