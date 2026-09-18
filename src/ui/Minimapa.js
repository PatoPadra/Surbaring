/**
 * Minimapa — la carta de los alrededores, siempre a la vista.
 *
 * El dueño lo pidió así: «minimapa chico abajo derecha». El mapa grande sirve
 * para decidir adónde ir; éste, para no tener que abrirlo cada doscientos
 * metros. Por eso es una ventana fija de 900 m con el norte arriba y el jugador
 * al centro, a 5 m por píxel: lo que está a 200 m —una trampa, un vivac— queda
 * a 40 px de la flecha, y la barra de escala lo dice.
 *
 * No es otro dibujo: es la misma carta en chico. El relieve sale de
 * `tallarRelieve`, el velo de `pintarVelo` y la flecha de `pintarFlecha`, los
 * tres de `Mapa.js`. Los colores, el sombreado y lo que se tapa son los mismos
 * por construcción: el minimapa no puede revelar lo que el mapa esconde, ni la
 * flecha puede quedar al revés en uno y derecha en el otro.
 *
 * ── El costo, que es lo que manda en el diseño ──────────────────────────────
 *
 * El mapa grande se dibuja cuando uno lo abre; éste vive en pantalla mientras
 * se juega, en una máquina que en Baja anda a 30 cuadros. Tres decisiones:
 *
 * 1. **No se redibuja todos los cuadros.** A 5 m/px, caminando a 1,4 m/s el
 *    mundo se corre un píxel cada 3,6 s. Se redibuja cuando la flecha giró o el
 *    jugador se corrió un píxel —con un mínimo de 0,1 s entre dibujos—, cuando
 *    cambia lo explorado, y por las dudas cada medio segundo.
 *
 * 2. **El relieve se construye de a poco y con margen.** Un recorte de 360 px
 *    —1,8 km, el doble de la ventana— lee 372² alturas: hecho de un tirón sería
 *    un cuadro perdido. Se hace de a 12 filas por cuadro, y se vuelve a hacer
 *    sólo cuando el jugador se acerca a 60 m de salirse de lo ya dibujado: a lo
 *    sumo una vez cada 390 m caminados, nunca por metro.
 *
 * 3. **El velo es chico.** El del mapa son las 65.536 celdas; acá alcanza con
 *    las 12 × 12 de alrededor, con la misma cuenta, y se rehace cuando cambia
 *    lo explorado o se pasa a otra celda de 256 m.
 */

import { pintarEscala, pintarFlecha, pintarVelo, tallarRelieve } from './Mapa.js';

const CSS = `
  #minimapa { position: absolute; right: 1rem; bottom: 1rem;
    width: clamp(110px, 23.5vh, 180px); height: clamp(110px, 23.5vh, 180px);
    border-radius: 3px; overflow: hidden; background: #0d0f0e;
    box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 2px 12px rgba(0,0,0,.5); }
  #minimapa canvas { display: block; width: 100%; height: 100%; }
  /* Con el mapa grande abierto, el chico sobra. */
  #minimapa.oculto { display: none; }
`;

/** Píxeles del lienzo. En pantalla mide lo mismo a 1024×768 y se achica abajo de eso. */
const LADO = 180;

/** Metros por píxel: una ventana de 900 m. */
const MPP = 5;

/** Píxeles de lado del relieve construido: 1,8 km, el doble de la ventana. */
const RECORTE = 360;

/** Se construye el siguiente cuando falta esto para salirse del que hay. */
const ANTICIPO_M = 60;

/**
 * Filas de relieve por cuadro. Cada fila son 372 alturas y 360 colores; el
 * recorte entero, 31 tandas y el vuelco, o sea un segundo a 30 cuadros.
 */
const FILAS_POR_CUADRO = 12;

/** Entre dos dibujos, al menos esto; y nunca más que lo otro. */
const REDIBUJO_MIN_S = 0.1;
const REDIBUJO_MAX_S = 0.5;

/** Lo que tiene que girar la flecha para que valga redibujar: 2°. */
const GIRO_UMBRAL = 2 * Math.PI / 180;

/** Celdas de exploración de lado del velo local. La ventana abarca 3,5. */
const CELDAS_VELO = 12;

/**
 * Hallazgos pinta su leyenda en la esquina de arriba a la derecha de `op.lado`:
 * 132 px de ancho, que en un lienzo de 180 taparían el minimapa entero. Con
 * `lado` corrido esto a la derecha, la leyenda cae afuera del lienzo y las
 * marcas no cambian —el recorte de lo que queda fuera es sólo más generoso—.
 */
const LEYENDA_AFUERA = 150;

function difAngular(a, b) {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

export class Minimapa {
  /**
   * @param {object} deps {mundo, jugador, exploracion, hallazgos, construccion,
   *                       codice, mapa}
   */
  constructor(deps) {
    Object.assign(this, deps);
    const p = this.jugador.posicion;
    /** Centro de lo dibujado en metros de mundo, y metros por píxel. */
    this.vista = { cx: p.x, cz: p.z, mpp: MPP };

    /** El relieve terminado: {canvas, mpp, cx, cz, lado}. */
    this._relieve = null;
    /** El que se está construyendo: {gen, cx, cz}. */
    this._tallando = null;
    /** El velo de las celdas de alrededor. */
    this._velo = null;

    /** Segundos desde el último dibujo. Infinito: el primer cuadro dibuja. */
    this._reloj = Infinity;
    this._giroDibujado = NaN;
    this._veloDibujado = -1;
    this._oculto = false;

    this._crear();
  }

  _crear() {
    if (!document.getElementById('minimapa-css')) {
      const est = document.createElement('style');
      est.id = 'minimapa-css';
      est.textContent = CSS;
      document.head.appendChild(est);
    }
    const el = document.createElement('div');
    el.id = 'minimapa';
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = LADO;
    el.appendChild(lienzo);
    // Adentro del HUD: cuando el HUD se esconde, el minimapa se va con él.
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
  }

  // ── El cuadro ──────────────────────────────────────────────────────────────

  /** Lo llama el bucle una vez por cuadro. Casi siempre no hace nada. */
  actualizar(dt = 0) {
    if (this.mapa?.abierto) {
      // Ni se dibuja ni se construye: mientras el mapa grande está abierto, el
      // que lee alturas es él.
      if (!this._oculto) { this._oculto = true; this.el.classList.add('oculto'); }
      return;
    }
    let urge = false;
    if (this._oculto) {
      // Lo que quedó en el lienzo es de antes de abrir el mapa.
      this._oculto = false;
      this.el.classList.remove('oculto');
      urge = true;
    }

    this._reloj += dt;
    const relieveNuevo = this._avanzarRelieve();
    if (urge || relieveNuevo || this._reloj >= REDIBUJO_MAX_S) { this.dibujar(); return; }
    if (this._reloj < REDIBUJO_MIN_S) return;

    const p = this.jugador.posicion, v = this.vista;
    const corrido = Math.max(Math.abs(p.x - v.cx), Math.abs(p.z - v.cz)) / MPP;
    if (corrido >= 1
        || difAngular(this.jugador.giro, this._giroDibujado) > GIRO_UMBRAL
        || (this.exploracion?.version ?? 0) !== this._veloDibujado) {
      this.dibujar();
    }
  }

  /**
   * Una tanda del relieve, si hace falta. Devuelve true el cuadro en que
   * termina uno nuevo, para mostrarlo sin esperar al próximo dibujo.
   */
  _avanzarRelieve() {
    const p = this.jugador.posicion;
    // Hasta dónde puede alejarse el jugador del centro de un recorte sin que
    // la ventana se salga de él: (1800 − 900) / 2 = 450 m.
    const holgura = (RECORTE - LADO) * MPP / 2;
    const lejos = (c) => Math.max(Math.abs(p.x - c.cx), Math.abs(p.z - c.cz));

    // Si el que se construye ya no va a servir —un salto: se cargó la partida,
    // se murió—, se empieza de nuevo donde está el jugador.
    if (this._tallando && lejos(this._tallando) > holgura) this._tallando = null;

    if (!this._tallando) {
      const t = this._relieve;
      if (t && lejos(t) <= holgura - ANTICIPO_M) return false;
      this._tallando = {
        cx: p.x, cz: p.z,
        gen: tallarRelieve(this.mundo, MPP, p.x, p.z, RECORTE, FILAS_POR_CUADRO),
      };
    }

    const paso = this._tallando.gen.next();
    if (!paso.done) return false;
    this._relieve = paso.value;
    this._tallando = null;
    return true;
  }

  // ── Proyección ─────────────────────────────────────────────────────────────

  /**
   * De metros de mundo a píxeles del lienzo, con la convención del mapa: el
   * norte (−z) arriba y el este (+x) a la derecha. El centro es el del último
   * dibujo, que es el jugador de hace menos de medio segundo.
   */
  aPixel(x, z) {
    const v = this.vista;
    return {
      px: LADO / 2 + (x - v.cx) / v.mpp,
      py: LADO / 2 + (z - v.cz) / v.mpp,
    };
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  /** Redibuja ya. No lee alturas: el relieve lo trae `actualizar()` de a poco. */
  dibujar() {
    const c = this.ctx;
    const p = this.jugador.posicion;
    const v = this.vista;
    const t = this._relieve;

    // El centro va al jugador, pero sobre la grilla de píxeles del relieve: así
    // el recorte se copia píxel a píxel, sin remuestrear, y la carta no se
    // ablanda. El jugador queda a menos de medio píxel del centro.
    if (t) {
      v.cx = t.cx + Math.round((p.x - t.cx) / MPP) * MPP;
      v.cz = t.cz + Math.round((p.z - t.cz) / MPP) * MPP;
    } else {
      v.cx = p.x; v.cz = p.z;
    }

    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.fillStyle = '#0d0f0e';
    c.fillRect(0, 0, LADO, LADO);

    // 1) El relieve, si ya hay uno. Mientras se construye el primero se ve el
    //    velo sobre el fondo, que es lo honesto: todavía no se sabe qué hay.
    if (t) {
      const a = this.aPixel(t.cx - t.lado * t.mpp / 2, t.cz - t.lado * t.mpp / 2);
      c.drawImage(t.canvas, Math.round(a.px), Math.round(a.py));
    }

    // 2) El velo, con la misma cuenta y el mismo suavizado que el mapa.
    const ex = this.exploracion;
    if (ex) {
      const w = this._veloAlDia();
      const mpc = ex.metrosPorCelda, mitad = this.mundo.mitad;
      const esq = { x: v.cx - LADO / 2 * MPP, z: v.cz - LADO / 2 * MPP };
      const s = LADO * MPP / mpc;
      c.drawImage(w.canvas, (esq.x + mitad) / mpc - w.i0, (esq.z + mitad) / mpc - w.j0, s, s, 0, 0, LADO, LADO);
    }
    this._veloDibujado = ex?.version ?? 0;

    // 3) Las marcas: hallazgos y obras, con la misma proyección que aPixel.
    this.hallazgos?.dibujar(c, (x, z) => this.aPixel(x, z), {
      mpp: MPP,
      lado: LADO + LEYENDA_AFUERA,
      construccion: this.construccion,
      exploracion: ex,
    });

    // 4) Los lugares descubiertos que caen adentro, más chicos que en el mapa.
    c.font = '9px system-ui, sans-serif';
    c.textBaseline = 'middle';
    for (const l of this.codice?.listaLugares || []) {
      if (!this.codice.lugares?.has(l.id)) continue;
      const { px, py } = this.aPixel(l.x, l.z);
      if (px < -4 || py < -4 || px > LADO + 4 || py > LADO + 4) continue;
      c.fillStyle = 'rgba(226,214,180,.92)';
      c.beginPath(); c.arc(px, py, 2.2, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(226,214,180,.72)';
      c.fillText(l.nombre, px + 4, py);
    }

    // 5) El jugador, arriba de todo.
    const j = this.aPixel(p.x, p.z);
    pintarFlecha(c, j.px, j.py, this.jugador.giro);

    pintarEscala(c, MPP, 8, LADO - 9, 50);

    this._reloj = 0;
    this._giroDibujado = this.jugador.giro;
  }

  /**
   * El velo de las 12 × 12 celdas alrededor del centro. La ventana abarca 3,5
   * celdas y el centro está en la del medio, así que quedan más de dos de
   * margen por lado: el suavizado, que mira las vecinas, ve lo mismo que en el
   * mapa. Se rehace si cambió lo explorado o si el centro pasó a otra celda.
   */
  _veloAlDia() {
    const ex = this.exploracion;
    const mpc = ex.metrosPorCelda, mitad = this.mundo.mitad;
    const ci = Math.floor((this.vista.cx + mitad) / mpc);
    const cj = Math.floor((this.vista.cz + mitad) / mpc);
    const version = ex.version ?? 0;
    let w = this._velo;
    if (w && w.version === version && w.ci === ci && w.cj === cj) return w;

    if (!w) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = CELDAS_VELO;
      const vc = canvas.getContext('2d');
      w = this._velo = { canvas, vc, img: vc.createImageData(CELDAS_VELO, CELDAS_VELO) };
    }
    w.ci = ci; w.cj = cj; w.version = version;
    w.i0 = ci - CELDAS_VELO / 2;
    w.j0 = cj - CELDAS_VELO / 2;
    pintarVelo(ex, w.i0, w.j0, CELDAS_VELO, w.img.data);
    w.vc.putImageData(w.img, 0, 0);
    return w;
  }
}
