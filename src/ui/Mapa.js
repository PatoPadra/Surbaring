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
 * mouse, sobre una escalera de siete niveles, de 102,4 a 2 m por píxel.
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
 *    —hace falta para leer las marcas: a 8 m/px una trampa a 200 m quedaba a
 *    25 px de la flecha—, **sin inventar filos que el dato no tiene**, y el pie
 *    lo dice. Ésa es la declaración de arriba tomada en serio.
 *
 * Pasado el techo, primero se estiraba el dibujo de 32 m/px. A 2 m/px eso es
 * un píxel del dato hecho un manchón de 16: las curvas de nivel se vuelven
 * bandas borrosas de 16 px. Ahora cada peldaño se vuelve a construir leyendo
 * el mismo `alturaBaseEn`, que entre texel y texel interpola —es la superficie
 * que el juego usa, no una nueva—, y la pendiente del sombreado se mide
 * siempre sobre dos texels (`anilloDe`). Medirla entre píxeles vecinos a 2 m
 * daría la pendiente de cada plano de la interpolación, y la luz dibujaría la
 * grilla de 32 m del DEM: ése sí sería un filo inventado. Cuesta una sola
 * construcción por peldaño, con un anillo más ancho: al tope, 672² alturas
 * contra las 642² de antes, un 10 % más.
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
 * existe; y de ×6,4 en adelante están para leer las marcas, no para ver más
 * relieve. El último, ×51,2, son 2 m por píxel: una ventana de 1,3 km, donde
 * una trampa a 200 m queda a 100 px de la flecha y se la encuentra de un
 * vistazo.
 */
const ZOOMS = [1, 2, 3.2, 6.4, 12.8, 25.6, 51.2];

/** El peldaño donde un píxel es un texel del DEM. Pasado éste no hay dato nuevo. */
const ZOOM_NATIVO = 2;

// ── Lo que el mapa comparte con el minimapa ──────────────────────────────────
//
// El minimapa (`Minimapa.js`) es este mismo mapa en chico, y todo lo que decide
// cómo se ve una carta vive acá una sola vez: si la flecha, el color del relieve
// o el velo estuvieran escritos dos veces, tarde o temprano uno de los dos
// quedaría al revés, que es exactamente lo que le pasó a la flecha.

/**
 * Hacia dónde apunta la flecha del jugador, en un lienzo con el norte arriba.
 *
 * El jugador avanza hacia (−sen giro, −cos giro) en el mundo, medido contra la
 * cámara. Con el norte (−z) arriba y el este (+x) a la derecha, eso cae en el
 * lienzo en (−sen giro, −cos giro) también. La flecha se dibuja con la punta
 * hacia arriba, (0, −1), y rotar un ángulo θ la lleva a (sen θ, −cos θ): para
 * que coincidan, θ = −giro. Antes había un `+ π` de más y apuntaba justo al
 * revés, en el mapa, en todos los giros.
 */
export function rumboEnLienzo(giro) {
  return -giro;
}

/**
 * La flecha del jugador: un polígono relleno, con un borde oscuro para que se
 * lea igual sobre el bosque que sobre la nieve. Se dibuja a su tamaño en
 * píxeles, no en metros: a cualquier zoom mide lo mismo, porque lo que se
 * busca con la vista es dónde está uno, no cuánto ocupa.
 */
export function pintarFlecha(c, px, py, giro) {
  c.save();
  c.translate(px, py);
  c.rotate(rumboEnLienzo(giro));
  c.beginPath();
  c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5);
  c.closePath();
  // El borde va primero y el relleno encima: queda afuera sólo la mitad del
  // trazo, que es un contorno fino y no una flecha más gorda.
  c.lineJoin = 'round';
  c.lineWidth = 2.2;
  c.strokeStyle = 'rgba(8,10,9,.7)';
  c.stroke();
  c.fillStyle = '#d8643f';
  c.fill();
  c.restore();
}

/**
 * Escala gráfica. Con zoom, decir "102,4 m por píxel" no le sirve a nadie:
 * una barra con su número se lee de un vistazo y sigue siendo cierta aunque
 * el navegador estire el lienzo, porque se dibuja adentro.
 */
export function pintarEscala(c, mpp, x0, y0, maxPx) {
  const REDONDOS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  let metros = REDONDOS[0];
  for (const r of REDONDOS) if (r / mpp <= maxPx) metros = r;
  const ancho = metros / mpp;

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

/**
 * Cuánto vale una curva de nivel a esta escala.
 *
 * A 102,4 m/px, curvas cada 200 m ya son casi ruido; cada 50 m serían una
 * mancha sólida. El intervalo tiene que apretarse con el zoom, pero **sólo
 * hasta donde el dato aguanta**: 50 m sobre un DEM de 32 m/texel es lo que usa
 * cualquier carta 1:50.000, y bajar de ahí sería dibujar precisión inventada.
 */
export function equidistancia(mpp) { return mpp > 80 ? 200 : mpp > 40 ? 100 : 50; }

/**
 * Sobre cuántos píxeles a cada lado se mide la pendiente del sombreado.
 *
 * Hasta el techo del DEM, el píxel vecino: es lo que siempre hizo el mapa, y
 * el dibujo sale idéntico. Más cerca, tantos píxeles como hagan un texel, así
 * la pendiente se mide sobre dos texels (64 m) a cualquier zoom. Ver la nota
 * de arriba: entre vecinos a 2 m la luz dibujaría la grilla del dato.
 */
function anilloDe(mundo, mpp) {
  return Math.max(1, Math.round((mundo.metrosPorTexel || 32) / mpp));
}

/**
 * Talla un recorte cuadrado del relieve, de a tandas de filas.
 *
 * Es un generador para que lo usen los dos a su manera: el mapa lo corre de un
 * tirón (`hastaElFinal`) cuando la vista se queda quieta, y el minimapa le pide
 * una tanda por cuadro, porque en el juego andando un recorte entero de una vez
 * es un tirón que se ve. Cada `next()` lee `filas` filas de alturas, pinta las
 * que ya tienen sus vecinas, y el último vuelca la imagen al lienzo: ése va
 * solo, porque subir la imagen también cuesta.
 *
 * Una sola lectura de altura por píxel. Las alturas se muestrean sobre una
 * grilla de `lado + 2r` —un anillo de más alrededor— y el sombreado sale de
 * restar vecinas ya calculadas. Antes cada píxel pedía su altura y las cuatro
 * de al lado: cinco lecturas donde alcanza una, porque la de al lado ya la
 * había pedido el píxel de al lado.
 *
 * @returns {Generator<number, {canvas, mpp:number, cx:number, cz:number, lado:number}>}
 *   lo que va pintado, de 0 a 1; al terminar, el recorte.
 */
export function* tallarRelieve(mundo, mpp, cx, cz, lado, filas = Infinity) {
  const r = anilloDe(mundo, mpp);
  const L = lado + 2 * r;
  const H = new Float32Array(L * L);
  const img = new ImageData(lado, lado);
  let leidas = 0, pintadas = 0;

  while (pintadas < lado) {
    const hasta = Math.min(L, leidas + filas);
    leerAlturas(mundo, H, L, r, lado, mpp, cx, cz, leidas, hasta);
    leidas = hasta;
    // La fila py del dibujo resta la altura de r filas más abajo: recién se
    // puede pintar cuando ésa ya se leyó.
    const listas = Math.min(lado, leidas - 2 * r);
    if (listas > pintadas) {
      pintarRelieve(mundo, H, L, r, img.data, lado, mpp, cx, cz, pintadas, listas);
      pintadas = listas;
    }
    yield pintadas / lado;
  }

  const fuera = document.createElement('canvas');
  fuera.width = fuera.height = lado;
  fuera.getContext('2d').putImageData(img, 0, 0);
  return { canvas: fuera, mpp, cx, cz, lado };
}

/** Corre un generador hasta el final y devuelve lo que devuelve. */
function hastaElFinal(gen) {
  let r;
  do r = gen.next(); while (!r.done);
  return r.value;
}

/**
 * Las alturas de las filas [j0, j1) de la grilla. Van en una función aparte y
 * no adentro del generador para que el motor la optimice como un bucle común:
 * acá se van los 50 ms.
 */
function leerAlturas(m, H, L, r, lado, mpp, cx, cz, j0, j1) {
  const mitadPx = lado / 2;
  for (let j = j0; j < j1; j++) {
    const z = cz + (j - r - mitadPx + 0.5) * mpp;
    const fila = j * L;
    for (let i = 0; i < L; i++) {
      H[fila + i] = m.alturaBaseEn(cx + (i - r - mitadPx + 0.5) * mpp, z);
    }
  }
}

/**
 * ¿Es agua? Hasta el techo del DEM, el texel más cercano de la máscara: el mismo
 * `esAgua` que usa el resto del juego, y el dibujo sale idéntico al de antes.
 * Pasado el techo, la máscara interpolada igual que la altura en `alturaBaseEn`:
 * a 2 m/px el texel más cercano dibujaba la costa en escalones de 32 m, que
 * tampoco es el dato —es su grilla—. El umbral, 127,5, es el de `esAgua` (> 127).
 */
function esAguaEn(m, x, z, suave) {
  if (!suave || !m.agua || !m._texelDe) return m.esAgua(x, z);
  if (!m.dentro(x, z)) return false;
  const N = m.N;
  const fx = m._texelDe(x), fz = m._texelDe(z);
  const i0 = Math.floor(fx), j0 = Math.floor(fz);
  const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
  const sx = fx - i0, sz = fz - j0;
  const A = m.agua;
  const v = (A[j0 * N + i0] * (1 - sx) + A[j0 * N + i1] * sx) * (1 - sz)
          + (A[j1 * N + i0] * (1 - sx) + A[j1 * N + i1] * sx) * sz;
  return v > 127.5;
}

/** El color de las filas [py0, py1) del dibujo, con las alturas ya leídas. */
function pintarRelieve(m, H, L, r, d, lado, mpp, cx, cz, py0, py1) {
  const mitadPx = lado / 2;
  const eq = equidistancia(mpp);
  const suave = mpp < (m.metrosPorTexel || 32);
  // Con r = 1 las dos cuentas son exactamente las de siempre: la resta entre
  // vecinos abarca 2 px, y la pendiente por píxel es la mitad de la resta.
  const base = r * mpp * 1.6;
  const porPx = 0.5 / r;

  for (let py = py0; py < py1; py++) {
    const z = cz + (py - mitadPx + 0.5) * mpp;
    for (let px = 0; px < lado; px++) {
      const x = cx + (px - mitadPx + 0.5) * mpp;
      const k = (py * lado + px) * 4;

      if (esAguaEn(m, x, z, suave)) {
        // Lagos: azul de agua glaciaria
        d[k] = 38; d[k + 1] = 62; d[k + 2] = 84; d[k + 3] = 255;
        continue;
      }

      const q = (py + r) * L + (px + r);
      const h = H[q];
      // Sombreado: luz desde el noroeste, como manda la convención. El
      // sombreado modula, no apaga: por debajo de 0,55 la carta se vuelve
      // ilegible, que es lo contrario de para lo que sirve un mapa.
      const hx = H[q + r] - H[q - r];
      const hz = H[q + r * L] - H[q - r * L];
      const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / base));

      // Color por altura: verde del bosque, ocre de la estepa alta, gris de
      // la roca, blanco de la nieve
      const t = Math.max(0, Math.min(1, (h - 750) / 1900));
      let rr, g, b;
      if (t < 0.35) { rr = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
      else if (t < 0.62) { rr = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
      else if (t < 0.82) { rr = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
      else { rr = 226; g = 232; b = 240; }

      // Curva de nivel de ancho constante. Antes la banda era fija en altura
      // —±4 m alrededor del múltiplo—, y eso da una línea cuyo grosor depende
      // de la pendiente: invisible en un filo, donde 200 m de desnivel pasan
      // en un píxel, y un manchón en un mallín. Abriendo la banda con el
      // gradiente local, la línea mide ~1 px en los dos lados.
      const grad = Math.max(1e-4, Math.hypot(hx, hz) * porPx);
      const dist = Math.abs((((h % eq) + eq) % eq) - eq * 0.5);
      const enCurva = dist > eq * 0.5 - grad * 0.6;
      const f = luz * (enCurva ? 0.74 : 1);

      d[k] = rr * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
    }
  }
}

/**
 * Opacidad del velo según lo que se conoce, de 0 a 255. Tabla hecha una vez:
 * son 256 valores posibles, y la potencia costaba más que todo el resto del
 * velo junto.
 */
const OPACIDAD_VELO = (() => {
  const t = new Uint8Array(256);
  // Lo desconocido es negro, no una sombra: si el relieve se transparenta,
  // el mapa ya está revelado y explorar no significa nada.
  for (let v = 0; v < 256; v++) t[v] = Math.round(Math.pow(1 - v / 255, 0.7) * 255);
  return t;
})();

/**
 * Pinta el velo de un cuadrado de `n × n` celdas de exploración, empezando en
 * la celda (i0, j0), una celda por píxel. El mapa lo pide para la grilla
 * entera y el minimapa para las celdas de su alrededor, **con la misma cuenta**:
 * el minimapa no puede revelar lo que el mapa tapa. Fuera del mundo no hay nada
 * que conocer, y se tapa.
 */
export function pintarVelo(ex, i0, j0, n, datos) {
  const N = ex.celdas, conocido = ex.conocido;
  for (let j = 0; j < n; j++) {
    const jj = j0 + j;
    for (let i = 0; i < n; i++) {
      const ii = i0 + i;
      const v = ii >= 0 && jj >= 0 && ii < N && jj < N ? conocido[jj * N + ii] : 0;
      const k = (j * n + i) * 4;
      datos[k] = 9; datos[k + 1] = 11; datos[k + 2] = 10;
      datos[k + 3] = OPACIDAD_VELO[v];
    }
  }
}

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
   *
   * Con un recorte por peldaño la espera importa más que antes: girar la rueda
   * de un tirón del parque entero al tope son seis muescas, y si el recorte
   * saliera entre muesca y muesca se construirían seis para tirar cinco. Con
   * 90 ms de espera, un giro seguido —el banco del navegador manda una muesca
   * cada 30 ms— construye uno solo, el del peldaño donde se para.
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
      // rehace nada: cerrar y volver a abrir sin haber caminado es gratis.
      if (t && t.mpp === mpp && this._cubre(t)) return;
      this._tileFino = this._construirTile(mpp, this.vista.cx, this.vista.cz);
      if (this.abierto) this.dibujar();
    }, 90);
  }

  /**
   * A qué escala se construye para el nivel actual: la del nivel. Pasado el
   * techo del DEM también, porque estirar el de 32 m/px hasta 2 m/px da curvas
   * de 16 px de ancho; lo que no hay, lo dice el pie.
   */
  _mppConstruccion() {
    return (this.mundo.tamano / LADO) / ZOOMS[this.nivel];
  }

  /** ¿Este dibujo alcanza a tapar toda la ventana actual? */
  _cubre(t) {
    const medioT = t.lado * t.mpp / 2;
    const medioV = LADO * this.vista.mpp / 2;
    return Math.abs(this.vista.cx - t.cx) + medioV <= medioT
        && Math.abs(this.vista.cz - t.cz) + medioV <= medioT;
  }

  // ── El relieve ─────────────────────────────────────────────────────────────

  _equidistancia(mpp) { return equidistancia(mpp); }

  /**
   * Dibuja un recorte del relieve de un tirón. El trabajo está en
   * `tallarRelieve`, que es el mismo que usa el minimapa; pasa por acá para que
   * el tiempo quede adentro de un método del mapa, que es donde se lo mide.
   */
  _construirTile(mpp, cx, cz) {
    return hastaElFinal(tallarRelieve(this.mundo, mpp, cx, cz, LADO));
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
    pintarVelo(ex, 0, 0, n, img.data);
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
    // sea de otro peldaño: mientras se construye el del nivel nuevo, el del
    // anterior estirado sigue siendo mucho mejor que el del mundo entero.
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
    pintarFlecha(c, px, py, this.jugador.giro);

    pintarEscala(c, this.vista.mpp, 14, LADO - 18, 150);
    this._pintarPie();
  }

  _pintarPie() {
    const ex = this.exploracion;
    const p = this.jugador.posicion;
    const geo = this.mundo.aLatLon(p.x, p.z);
    this.el.querySelector('#mp-explorado').textContent =
      `${(ex.fraccionExplorada * 100).toFixed(1)} % explorado · ` +
      `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} · ${Math.round(p.y)} m`;

    // La equidistancia es la del dibujo que se construye a este nivel, y nunca
    // baja de 50 m: el pie no promete curvas más finas de las que el dato
    // aguanta ni de las que hay trazadas.
    const eq = this._equidistancia(this._mppConstruccion());
    // Pasado el techo del DEM el relieve que se ve es el mismo dato
    // interpolado: más grande, no más detallado. Decirlo es lo que separa una
    // carta de una ilustración.
    const estirado = this.nivel > ZOOM_NATIVO;
    this.el.querySelector('#mp-leyenda').innerHTML =
      `Curvas cada ${eq} m · relieve real del SRTM, ${Math.round(this.mundo.metrosPorTexel)} m por dato`
      + (estirado
        ? ` · <span class="mp-estirado">ampliado ${(ZOOMS[this.nivel] / ZOOMS[ZOOM_NATIVO]).toFixed(0)}× sobre el dato: entre dato y dato se interpola, no hay más relieve que mostrar</span>`
        : '');
  }

  alternar() {
    if (!this.abierto) {
      // Al abrir se mira dónde está uno, con el zoom que se dejó. Antes la
      // vista sobrevivía entre aperturas: quien caminaba 3 km y abría el mapa
      // ampliado miraba el lugar de antes. Se centra antes de marcarlo
      // abierto, así `_centrarEn` no dibuja una vez de más; al nivel 0 el
      // límite deja el centro clavado en el del mundo, y no cambia nada.
      const p = this.jugador.posicion;
      this._centrarEn(p.x, p.z);
    }
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
