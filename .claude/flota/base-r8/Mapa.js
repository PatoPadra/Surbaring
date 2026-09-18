/**
 * Mapa — carta topográfica del parque, dibujada con el relieve de verdad.
 *
 * No es una ilustración: se dibuja píxel por píxel a partir del mismo modelo de
 * elevación que pisa el jugador. El sombreado es un relieve iluminado desde el
 * noroeste —la convención cartográfica—, las curvas de nivel salen del DEM, los
 * lagos de las máscaras del terreno, y el velo de lo desconocido de la grilla de
 * exploración. Si el mapa dice que hay un filo, hay un filo.
 *
 * Y arranca en blanco. Lo que no se recorrió no está: se revela a medida que se
 * conoce, con el alcance que da la altura desde donde se mira. Por eso subir a
 * un mirador abre medio parque de golpe, que es exactamente para lo que sirve
 * subir a un mirador.
 *
 * ── Sobre el zoom, que es lo que se agregó y por qué está hecho así ──────────
 *
 * Antes el mapa era un solo dibujo fijo: los 65,5 km del mundo entero en 640 px,
 * o sea **102,4 m por píxel**. A esa escala un lago chico es una mancha y una
 * obra propia es medio píxel. Ahora se acerca con la rueda y se arrastra con el
 * mouse, sobre una escalera de cinco niveles.
 *
 * Tres números, medidos con `.claude/flota/r2-carta-relieve.mjs` contra el DEM
 * de verdad, mandan sobre todo el diseño:
 *
 * 1. **Dibujar el relieve costaba ~150 ms.** Eso ya era un defecto sin zoom:
 *    abrir el mapa se comía casi cinco cuadros. Salía de leer cinco alturas por
 *    píxel —la del punto y cuatro vecinas para el sombreado— sobre 410.000
 *    píxeles. Ahora se lee **una sola vez** sobre una grilla de un píxel más por
 *    lado y las pendientes salen por diferencia entre vecinas ya calculadas:
 *    **~50 ms, 2,8× más rápido**, con una diferencia de 1 sobre 255 en el
 *    0,001 % de los canales. O sea: el mismo dibujo.
 *
 * 2. **El costo no depende del nivel de zoom.** Cambia la ventana, no la
 *    cantidad de píxeles. Por eso conviene una caché por nivel: cada nivel nuevo
 *    cuesta esos ~50 ms una vez y después es un `drawImage`.
 *
 * 3. **El DEM tiene 32 m por texel, así que a 32 m/px se acabó el dato.** Más
 *    allá de ahí no hay relieve nuevo que mostrar. Se sigue pudiendo ampliar
 *    —hace falta para leer las marcas— pero **estirando lo ya dibujado, no
 *    inventando filos que el dato no tiene**, y el pie lo dice. Ésa es la
 *    declaración de arriba tomada en serio.
 *
 * Y por eso mismo el mapa lee `alturaBaseEn()` y no `alturaEn()`: la diferencia
 * entre las dos es un ruido decorativo de 1,9 m de amplitud y 64 m de período,
 * horneado para que el suelo no se vea liso a la altura de los ojos. A 8 m/px
 * ese ruido daría pendientes aparentes de 0,24 y **dominaría el sombreado**,
 * poniéndole a la carta una textura de lija que el SRTM no tiene. No sale más
 * barato sacarlo (se midió: 51 contra 46 ms, el costo está en el muestreo). Sale
 * más honesto.
 */

const CSS = `
  #mapa { position: fixed; inset: 0; z-index: 70; display: none;
    background: rgba(8,10,9,.86); backdrop-filter: blur(4px); color: var(--tinta); }
  #mapa.abierto { display: grid; place-items: center; }
  #mapa .mp-marco { width: min(88vh, 92vw); }
  #mapa .mp-cab { display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: .5rem; gap: 1rem; }
  #mapa h2 { font-size: .95rem; font-weight: 500; letter-spacing: .04em; }
  #mapa .mp-dato { font-size: .7rem; color: var(--tinta-tenue); text-align: right; }
  #mapa .mp-lienzo { position: relative; width: 100%; aspect-ratio: 1;
    border: 1px solid rgba(255,255,255,.12); border-radius: 3px; overflow: hidden;
    background: #0d0f0e; }
  #mapa canvas { width: 100%; height: 100%; display: block; image-rendering: auto;
    cursor: grab; touch-action: none; }
  #mapa canvas.arrastrando { cursor: grabbing; }
  #mapa .mp-pie { margin-top: .5rem; font-size: .68rem; color: var(--tinta-tenue);
    display: flex; justify-content: space-between; gap: 1rem; }
  /* El aviso de que el relieve ya no trae dato nuevo. Se enciende solo pasado
     el techo del DEM: es la línea que sostiene "si el mapa dice que hay un
     filo, hay un filo". */
  #mapa .mp-estirado { color: #c9a227; }
  #mapa .mp-ayuda b { color: var(--tinta); font-weight: 600; }
`;

const LADO = 640;                 // píxeles del lienzo

/**
 * La escalera de zoom, en divisores de la escala del mundo entero.
 *
 * No es una progresión geométrica prolija a propósito: cada peldaño tiene un
 * motivo cartográfico. ×1 es el parque entero; ×2 entra un brazo del lago;
 * **×3,2 es exactamente un texel del DEM por píxel**, o sea todo el dato que
 * existe; y ×6,4 y ×12,8 están para leer las marcas, no para ver más relieve.
 */
const ZOOMS = [1, 2, 3.2, 6.4, 12.8];

/** Último peldaño que se construye. Los de más allá estiran éste. */
const ZOOM_NATIVO = 2;

export class Mapa {
  /**
   * @param {object} deps {mundo, jugador, tiempo, exploracion, codice,
   *                       construccion, hallazgos}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;

    this.nivel = 0;
    /** Centro de la vista en metros de mundo, y metros por píxel del lienzo. */
    this.vista = { cx: 0, cz: 0, mpp: this.mundo.tamano / LADO };

    /** El mundo entero, dibujado una vez. Es el fondo que evita cualquier hueco. */
    this._tileMundo = null;
    /** El recorte fino de la vista actual, reconstruido cuando la vista se queda quieta. */
    this._tileFino = null;
    this._pendiente = null;
    /** El velo cuesta 65.536 iteraciones: se recuerda mientras la exploración no cambie. */
    this._velo = null;
    this._veloVersion = -1;

    this._crear();

    // Construir el mundo entero cuando el navegador esté ocioso, no la primera
    // vez que alguien pulsa M: son ~50 ms, y son mucho más molestos cuando uno
    // acaba de pedir el mapa que mientras camina.
    const alOcio = globalThis.requestIdleCallback || (f => setTimeout(f, 1200));
    alOcio(() => { if (!this._tileMundo) this._tileMundo = this._construirTile(this.mundo.tamano / LADO, 0, 0); });
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'mapa';
    el.innerHTML = `<div class="mp-marco">
      <div class="mp-cab">
        <h2>Parque Nacional Nahuel Huapi</h2>
        <span class="mp-dato" id="mp-explorado"></span>
      </div>
      <div class="mp-lienzo"><canvas id="mp-canvas" width="${LADO}" height="${LADO}"></canvas></div>
      <div class="mp-pie">
        <span id="mp-leyenda"></span>
        <span class="mp-ayuda">Rueda para acercar · arrastrá para mover · doble clic vuelve al parque · <b>M</b> cierra</span>
      </div>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
    this.lienzo = el.querySelector('#mp-canvas');
    this.ctx = this.lienzo.getContext('2d');
    this._cablearNavegacion();
  }

  // ── Navegación ─────────────────────────────────────────────────────────────

  /**
   * Rueda para acercar, arrastre para mover, doble clic para volver.
   *
   * El zoom va **hacia el cursor**, no hacia el centro: es lo que espera
   * cualquiera que haya usado un mapa, y con el centro fijo hay que perseguir el
   * lugar que uno quería mirar.
   */
  _cablearNavegacion() {
    const c = this.lienzo;

    c.addEventListener('wheel', (ev) => {
      // Sin esto la página de atrás scrollea mientras uno cree estar ampliando.
      ev.preventDefault();
      const destino = this.nivel + (ev.deltaY < 0 ? 1 : -1);
      this._irANivel(destino, this._deEvento(ev));
    }, { passive: false });

    let arrastre = null;
    c.addEventListener('pointerdown', (ev) => {
      arrastre = { ...this._deEvento(ev), cx: this.vista.cx, cz: this.vista.cz };
      c.setPointerCapture(ev.pointerId);
      c.classList.add('arrastrando');
    });
    c.addEventListener('pointermove', (ev) => {
      if (!arrastre) return;
      const p = this._deEvento(ev);
      // El mundo se mueve al revés que el dedo: uno arrastra el papel, no la vista.
      this._centrarEn(
        arrastre.cx - (p.px - arrastre.px) * this.vista.mpp,
        arrastre.cz - (p.py - arrastre.py) * this.vista.mpp,
      );
    });
    const soltar = (ev) => {
      if (!arrastre) return;
      arrastre = null;
      c.classList.remove('arrastrando');
      c.releasePointerCapture?.(ev.pointerId);
      this._pedirTileFino();
    };
    c.addEventListener('pointerup', soltar);
    c.addEventListener('pointercancel', soltar);

    c.addEventListener('dblclick', (ev) => { ev.preventDefault(); this.verTodo(); });
  }

  /** Coordenadas del evento en píxeles del lienzo, no de la pantalla. */
  _deEvento(ev) {
    // El lienzo son 640 px pero se muestra a min(88vh, 92vw): sin esta
    // conversión el zoom apunta a otro lado que el cursor.
    const r = this.lienzo.getBoundingClientRect();
    return {
      px: (ev.clientX - r.left) / r.width * LADO,
      py: (ev.clientY - r.top) / r.height * LADO,
    };
  }

  /** Vuelve al parque entero. */
  verTodo() { this._irANivel(0, { px: LADO / 2, py: LADO / 2 }); }

  _irANivel(destino, ancla) {
    const n = Math.max(0, Math.min(ZOOMS.length - 1, destino));
    if (n === this.nivel) return;
    // Lo que estaba bajo el cursor tiene que seguir bajo el cursor.
    const antes = this.aMundo(ancla.px, ancla.py);
    this.nivel = n;
    this.vista.mpp = (this.mundo.tamano / LADO) / ZOOMS[n];
    this._centrarEn(
      antes.x - (ancla.px - LADO / 2) * this.vista.mpp,
      antes.z - (ancla.py - LADO / 2) * this.vista.mpp,
    );
    this._pedirTileFino();
  }

  /** Mueve el centro, sin dejar que la vista se salga del mundo. */
  _centrarEn(cx, cz) {
    // Al nivel 0 la ventana mide justo el mundo, así que el límite es 0 y el
    // centro queda clavado: no se puede arrastrar el parque entero fuera de sí.
    const medio = LADO * this.vista.mpp / 2;
    const lim = Math.max(0, this.mundo.mitad - medio);
    this.vista.cx = Math.max(-lim, Math.min(lim, cx));
    this.vista.cz = Math.max(-lim, Math.min(lim, cz));
    if (this.abierto) this.dibujar();
  }

  /**
   * Pide el recorte fino, pero recién cuando la vista se queda quieta.
   *
   * Reconstruir cuesta ~50 ms: hacerlo a cada muesca de rueda o a cada píxel de
   * arrastre daría un mapa a tres cuadros por segundo. Mientras tanto se ve el
   * dibujo anterior estirado, que es lo que hace cualquier mapa del mundo.
   */
  _pedirTileFino() {
    clearTimeout(this._pendiente);
    // Al nivel 0 el recorte fino sería el mundo entero otra vez: ése ya está
    // dibujado y no se mueve nunca. Soltar el que hubiera libera 1,6 MB.
    if (this.nivel === 0) {
      this._pendiente = null;
      if (this._tileFino) { this._tileFino = null; if (this.abierto) this.dibujar(); }
      return;
    }
    this._pendiente = setTimeout(() => {
      this._pendiente = null;
      const mpp = this._mppConstruccion();
      const t = this._tileFino;
      // Si el que hay ya sirve —misma escala y cubre la ventana entera— no se
      // rehace nada. Arrastrar dentro de un tile de 20 km es gratis.
      if (t && t.mpp === mpp && this._cubre(t)) return;
      this._tileFino = this._construirTile(mpp, this.vista.cx, this.vista.cz);
      if (this.abierto) this.dibujar();
    }, 90);
  }

  /**
   * A qué escala se construye para el nivel actual. Pasado el techo del DEM se
   * sigue construyendo al nativo —32 m/px— y se estira: no hay dato más fino.
   */
  _mppConstruccion() {
    return (this.mundo.tamano / LADO) / ZOOMS[Math.min(this.nivel, ZOOM_NATIVO)];
  }

  /** ¿Este dibujo alcanza a tapar toda la ventana actual? */
  _cubre(t) {
    const medioT = t.lado * t.mpp / 2;
    const medioV = LADO * this.vista.mpp / 2;
    return Math.abs(this.vista.cx - t.cx) + medioV <= medioT
        && Math.abs(this.vista.cz - t.cz) + medioV <= medioT;
  }

  // ── El relieve ─────────────────────────────────────────────────────────────

  /**
   * Cuánto vale una curva de nivel a esta escala.
   *
   * A 102,4 m/px, curvas cada 200 m ya son casi ruido; cada 50 m serían una
   * mancha sólida. El intervalo tiene que apretarse con el zoom, pero **sólo
   * hasta donde el dato aguanta**: 50 m sobre un DEM de 32 m/texel es lo que usa
   * cualquier carta 1:50.000, y bajar de ahí sería dibujar precisión inventada.
   */
  _equidistancia(mpp) { return mpp > 80 ? 200 : mpp > 40 ? 100 : 50; }

  /**
   * Dibuja un recorte del relieve. Una sola lectura de altura por píxel.
   *
   * Las alturas se muestrean sobre una grilla de `lado + 2` —un anillo de más
   * alrededor— y el sombreado sale de restar vecinas ya calculadas. Antes cada
   * píxel pedía su altura y las cuatro de al lado: cinco lecturas donde alcanza
   * una, porque la de al lado ya la había pedido el píxel de al lado.
   */
  _construirTile(mpp, cx, cz) {
    const m = this.mundo;
    const L = LADO + 2;
    const H = new Float32Array(L * L);
    const mitadPx = LADO / 2;

    for (let j = 0; j < L; j++) {
      const z = cz + (j - 1 - mitadPx + 0.5) * mpp;
      for (let i = 0; i < L; i++) {
        H[j * L + i] = m.alturaBaseEn(cx + (i - 1 - mitadPx + 0.5) * mpp, z);
      }
    }

    const img = new ImageData(LADO, LADO);
    const d = img.data;
    const eq = this._equidistancia(mpp);

    for (let py = 0; py < LADO; py++) {
      const z = cz + (py - mitadPx + 0.5) * mpp;
      for (let px = 0; px < LADO; px++) {
        const x = cx + (px - mitadPx + 0.5) * mpp;
        const k = (py * LADO + px) * 4;

        if (m.esAgua(x, z)) {
          // Lagos: azul de agua glaciaria
          d[k] = 38; d[k + 1] = 62; d[k + 2] = 84; d[k + 3] = 255;
          continue;
        }

        const q = (py + 1) * L + (px + 1);
        const h = H[q];
        // Sombreado: luz desde el noroeste, como manda la convención. El
        // sombreado modula, no apaga: por debajo de 0,55 la carta se vuelve
        // ilegible, que es lo contrario de para lo que sirve un mapa.
        const hx = H[q + 1] - H[q - 1];
        const hz = H[q + L] - H[q - L];
        const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / (mpp * 1.6)));

        // Color por altura: verde del bosque, ocre de la estepa alta, gris de
        // la roca, blanco de la nieve
        const t = Math.max(0, Math.min(1, (h - 750) / 1900));
        let r, g, b;
        if (t < 0.35) { r = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
        else if (t < 0.62) { r = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
        else if (t < 0.82) { r = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
        else { r = 226; g = 232; b = 240; }

        // Curva de nivel de ancho constante. Antes la banda era fija en altura
        // —±4 m alrededor del múltiplo—, y eso da una línea cuyo grosor depende
        // de la pendiente: invisible en un filo, donde 200 m de desnivel pasan
        // en un píxel, y un manchón en un mallín. Abriendo la banda con el
        // gradiente local, la línea mide ~1 px en los dos lados.
        const grad = Math.max(1e-4, Math.hypot(hx, hz) * 0.5);
        const dist = Math.abs((((h % eq) + eq) % eq) - eq * 0.5);
        const enCurva = dist > eq * 0.5 - grad * 0.6;
        const f = luz * (enCurva ? 0.74 : 1);

        d[k] = r * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
      }
    }

    const fuera = document.createElement('canvas');
    fuera.width = fuera.height = LADO;
    fuera.getContext('2d').putImageData(img, 0, 0);
    return { canvas: fuera, mpp, cx, cz, lado: LADO };
  }

  /** Pone un dibujo en su lugar del mundo, a la escala que toque. */
  _pintarTile(c, t) {
    const medio = t.lado * t.mpp / 2;
    const a = this.aPixel(t.cx - medio, t.cz - medio);
    const lado = t.lado * (t.mpp / this.vista.mpp);
    c.drawImage(t.canvas, a.px, a.py, lado, lado);
  }

  // ── Proyección ─────────────────────────────────────────────────────────────

  /** De metros de mundo a píxeles del lienzo, según la vista de ahora. */
  aPixel(x, z) {
    const v = this.vista;
    return {
      px: LADO / 2 + (x - v.cx) / v.mpp,
      py: LADO / 2 + (z - v.cz) / v.mpp,
    };
  }

  /** La inversa. La usa el zoom para dejar quieto lo que está bajo el cursor. */
  aMundo(px, py) {
    const v = this.vista;
    return { x: v.cx + (px - LADO / 2) * v.mpp, z: v.cz + (py - LADO / 2) * v.mpp };
  }

  /** Compatibilidad con lo que había antes. */
  _aPixel(x, z) { return this.aPixel(x, z); }

  // ── El velo ────────────────────────────────────────────────────────────────

  /**
   * La grilla de exploración, en su propia resolución. Se recuerda entre
   * dibujos: son 65.536 iteraciones y arrastrar redibuja a 60 por segundo.
   */
  _asegurarVelo() {
    const ex = this.exploracion;
    const v = ex.version ?? 0;
    if (this._velo && this._veloVersion === v) return this._velo;

    const n = ex.celdas;
    const velo = document.createElement('canvas');
    velo.width = velo.height = n;
    const vc = velo.getContext('2d');
    const img = vc.createImageData(n, n);
    for (let k = 0; k < n * n; k++) {
      const conocido = ex.conocido[k] / 255;
      // Lo desconocido es negro, no una sombra: si el relieve se transparenta,
      // el mapa ya está revelado y explorar no significa nada.
      img.data[k * 4] = 9;
      img.data[k * 4 + 1] = 11;
      img.data[k * 4 + 2] = 10;
      img.data[k * 4 + 3] = Math.round(Math.pow(1 - conocido, 0.7) * 255);
    }
    vc.putImageData(img, 0, 0);
    this._velo = velo;
    this._veloVersion = v;
    return velo;
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  dibujar() {
    const c = this.ctx;
    c.clearRect(0, 0, LADO, LADO);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';

    // 1) El relieve. Primero el mundo entero, que siempre cubre todo y por eso
    //    no puede quedar un hueco negro mientras se arrastra; encima, el recorte
    //    fino si lo hay.
    if (!this._tileMundo) this._tileMundo = this._construirTile(this.mundo.tamano / LADO, 0, 0);
    this._pintarTile(c, this._tileMundo);
    // El recorte fino se pinta siempre que traiga más dato que el fondo, aunque
    // la vista esté aún más cerca que él: a 8 m/px un dibujo de 32 m/px estirado
    // sigue siendo cuatro veces mejor que el del mundo entero.
    if (this._tileFino && this._tileFino.mpp < this._tileMundo.mpp) this._pintarTile(c, this._tileFino);

    // 2) El velo de lo desconocido, recortado a la ventana.
    const ex = this.exploracion;
    const velo = this._asegurarVelo();
    const mpc = ex.metrosPorCelda;
    const esq = this.aMundo(0, 0);
    const sx = (esq.x + this.mundo.mitad) / mpc;
    const sy = (esq.z + this.mundo.mitad) / mpc;
    const s = LADO * this.vista.mpp / mpc;
    c.drawImage(velo, sx, sy, s, s, 0, 0, LADO, LADO);

    // 3) Las marcas: obras propias y recursos ya vistos. Van sobre el velo —lo
    //    que no se conoce las tapa, que es la tesis del juego— y debajo de los
    //    topónimos y del jugador, que son lo que nunca se pierde de vista.
    this.hallazgos?.dibujar(c, (x, z) => this.aPixel(x, z), {
      mpp: this.vista.mpp,
      lado: LADO,
      construccion: this.construccion,
      exploracion: this.exploracion,
    });

    // 4) Lugares descubiertos
    c.font = '10px system-ui, sans-serif';
    c.textBaseline = 'middle';
    for (const l of this.codice?.listaLugares || []) {
      if (!this.codice.lugares.has(l.id)) continue;
      const { px, py } = this.aPixel(l.x, l.z);
      if (px < -60 || py < -20 || px > LADO + 60 || py > LADO + 20) continue;
      c.fillStyle = 'rgba(226,214,180,.92)';
      c.beginPath(); c.arc(px, py, 2.6, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(226,214,180,.72)';
      c.fillText(l.nombre, px + 5, py);
    }

    // 5) El jugador, con hacia dónde mira
    const p = this.jugador.posicion;
    const { px, py } = this.aPixel(p.x, p.z);
    const rumbo = -this.jugador.giro + Math.PI;
    c.save();
    c.translate(px, py);
    c.rotate(rumbo);
    c.fillStyle = '#d8643f';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5);
    c.closePath(); c.fill();
    c.restore();

    this._pintarEscala(c);
    this._pintarPie();
  }

  /**
   * Escala gráfica. Con zoom, decir "102,4 m por píxel" no le sirve a nadie:
   * una barra con su número se lee de un vistazo y sigue siendo cierta aunque
   * el navegador estire el lienzo, porque se dibuja adentro.
   */
  _pintarEscala(c) {
    const REDONDOS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const maxPx = 150;
    let metros = REDONDOS[0];
    for (const r of REDONDOS) if (r / this.vista.mpp <= maxPx) metros = r;
    const ancho = metros / this.vista.mpp;
    const x0 = 14, y0 = LADO - 18;

    c.save();
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.65)';
    c.beginPath();
    c.moveTo(x0, y0 - 4); c.lineTo(x0, y0); c.lineTo(x0 + ancho, y0); c.lineTo(x0 + ancho, y0 - 4);
    c.stroke();
    c.lineWidth = 1.4; c.strokeStyle = 'rgba(232,228,220,.92)';
    c.stroke();
    c.font = '10px system-ui, sans-serif';
    c.textBaseline = 'alphabetic';
    const txt = metros >= 1000 ? `${metros / 1000} km` : `${metros} m`;
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.65)';
    c.strokeText(txt, x0 + ancho + 6, y0 + 3);
    c.fillStyle = 'rgba(232,228,220,.92)';
    c.fillText(txt, x0 + ancho + 6, y0 + 3);
    c.restore();
  }

  _pintarPie() {
    const ex = this.exploracion;
    const p = this.jugador.posicion;
    const geo = this.mundo.aLatLon(p.x, p.z);
    this.el.querySelector('#mp-explorado').textContent =
      `${(ex.fraccionExplorada * 100).toFixed(1)} % explorado · ` +
      `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} · ${Math.round(p.y)} m`;

    // La equidistancia es la del dibujo que se está mirando, no la de la vista:
    // si no, al ampliar más allá del techo del DEM el pie prometería curvas más
    // finas de las que hay realmente trazadas.
    const eq = this._equidistancia(this._mppConstruccion());
    // Pasado el techo del DEM el relieve que se ve es el mismo dibujo estirado.
    // Decirlo es lo que separa una carta de una ilustración.
    const estirado = this.nivel > ZOOM_NATIVO;
    this.el.querySelector('#mp-leyenda').innerHTML =
      `Curvas cada ${eq} m · relieve real del SRTM, ${Math.round(this.mundo.metrosPorTexel)} m por dato`
      + (estirado
        ? ` · <span class="mp-estirado">ampliado ${(ZOOMS[this.nivel] / ZOOMS[ZOOM_NATIVO]).toFixed(0)}× sobre el dato: no hay más relieve que mostrar</span>`
        : '');
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this.dibujar();
      // Si se cerró el mapa con una reconstrucción a medio pedir, al volver
      // habría relieve grueso hasta que uno tocara algo. Pedirlo de nuevo es
      // gratis: si el recorte que hay ya cubre la ventana, no rehace nada.
      if (this.nivel > 0) this._pedirTileFino();
      document.exitPointerLock?.();
    } else {
      clearTimeout(this._pendiente);
      this._pendiente = null;
    }
  }
}
