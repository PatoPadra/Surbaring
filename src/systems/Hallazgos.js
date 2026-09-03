/**
 * Hallazgos — dónde vio el jugador cada cosa, y sólo dónde la vio.
 *
 * El dueño pidió dos cosas que comparten mecanismo: que una obra levantada
 * quede marcada en el mapa —«una X»— y que los recursos, a medida que se
 * descubre dónde están, aparezcan «estilo New World»: se ve una vez, queda
 * anotado.
 *
 * La segunda es la que pide memoria, y la memoria tiene una regla que no se
 * negocia: **no revela nada que no se haya visitado**. El mapa arranca en
 * blanco a propósito y ésa es la tesis del juego. Acá no se calcula dónde
 * *habría* arena: se anota dónde el jugador *estuvo* y vio arena.
 *
 * ── Qué se anota, y qué sería ruido ────────────────────────────────────────
 *
 * `Mineria.yacimientoEn()` es una función pura de la posición, así que sería
 * fácil marcar todo lo que devuelve. Sería un error: devuelve algo **en casi
 * todos lados**. Barriendo el parque entero en celdas de 128 m con la `Mineria`
 * de verdad sobre el DEM de verdad (`.claude/flota/r2-carta-hallazgos.mjs`):
 *
 *     ripio   16,6 %      arena     0,4 %
 *     tosca   20,0 %      chatarra  7,5 %
 *     pómez   22,8 %      nada     40,1 %
 *
 * El criterio que sale de ahí es **marcar lo que escasea**, y el número corrigió
 * una suposición: la pómez parecía un hallazgo —«caída volcánica que se conserva
 * en altura»— y resultó ser el 22,8 % del parque, la misma clase que el ripio y
 * la tosca. Por encima de 1.450 m hay pómez y punto: eso no es un hallazgo, es
 * una propiedad de la altura, y lo enseña el Códice, no el mapa.
 *
 * Queda entonces lo que de verdad cuesta encontrar: **un banco de arena (0,4 %),
 * una veta de chatarra, una barranca de arcilla, un cañaveral, un pedrero de
 * altura**. El 0,4 % de la arena explica de paso algo que el dueño trajo como
 * queja —nunca vio arena—: no es mala suerte, es que hay poca y está sólo en las
 * orillas. Marcarla es la marca de más valor de todo el sistema.
 *
 * La chatarra se queda aunque sea el 7,5 %, y por un motivo que es contenido:
 * sólo existe fuera del área núcleo. Marcarla dibuja exactamente el contraste
 * que el propio código declara —«en el área núcleo el bosque está limpio, y ésa
 * es justamente la diferencia»— en vez de contarlo.
 *
 * ── La granularidad ────────────────────────────────────────────────────────
 *
 * Se anota por celdas de 128 m, no por punto. Dos motivos: uno se acuerda de
 * «hay un banco de arena en esa ensenada», no de una coordenada; y anotar cada
 * mata daría miles de marcas superpuestas que tapan el relieve. El mapa tiene
 * que seguir siendo una carta topográfica, no un tablero de iconos.
 *
 * El alcance es corto —90 m— y ahí está la diferencia con `Exploracion`, que
 * revela hasta 6 km desde un mirador. Desde una cumbre se ve la forma del
 * valle; no se ve si esa playa tiene arena o canto rodado. Si los hallazgos
 * usaran el alcance de la exploración, el mapa se llenaría solo y descubrir
 * dejaría de significar algo.
 */

const CLAVE = 'survibar.hallazgos.v1';
const METROS_POR_CELDA = 128;
const ALCANCE_M = 90;         // lo que se distingue de cerca, no lo que se abarca
const CADENCIA_S = 0.5;
const RADIO_MATA_M = 22;      // hasta dónde se reconoce un pedrero
const RADIO_PLANTA_M = 26;    // hasta dónde se reconoce un cañaveral

/**
 * ¿Esto es orilla? El mismo criterio con el que `Recoleccion` da arcilla y con
 * el que `Mineria.yacimientoEn()` decide un banco de arena: **doce metros**.
 *
 * Está acá afuera y exportado a propósito. Antes esta comprobación vivía dentro
 * de `Hallazgos` con un radio de 3 m copiado de una versión anterior de
 * `Recoleccion._orillaCerca()`; cuando `juego` lo movió a 12 m, la copia quedó
 * atrás y el mapa habría marcado el **6 %** de la arcilla real — diciendo «acá
 * no hay» donde sí hay, que es el peor error que puede cometer una carta.
 *
 * Doce metros no es un número al azar: la arcilla se deposita en la planicie de
 * inundación y en la barranca, no en la línea del agua.
 *
 * `Recoleccion._orillaCerca()` puede importar esta función y pasarle
 * `jugador.posicion`, y así el criterio queda escrito una sola vez. Ese archivo
 * es del agente `juego`: la propuesta está en `pendiente-r2-carta.md`.
 */
export function orillaCerca(mundo, x, z) {
  return mundo.orillaCerca(x, z);
}

/**
 * Los tipos, como banderas de bits: una celda puede tener varios y así entra
 * todo en un número.
 */
export const TIPOS = {
  arena:      { bit: 1,  nombre: 'Banco de arena',      glifo: 'puntos' },
  // El bit 2 era la pómez y se retiró por medición: 22,8 % del parque. Se deja
  // libre y no se reusa, para que un guardado viejo no se lea como otra cosa.
  chatarra:   { bit: 4,  nombre: 'Veta de chatarra',    glifo: 'rombo' },
  arcilla:    { bit: 8,  nombre: 'Barranca de arcilla', glifo: 'barranca' },
  canaveral:  { bit: 16, nombre: 'Cañaveral',           glifo: 'canas' },
  obsidiana:  { bit: 32, nombre: 'Pedrero de altura',   glifo: 'lasca' },
};
const LISTA_TIPOS = Object.entries(TIPOS);

/**
 * Tinta de la carta y tinta del jugador.
 *
 * Los hallazgos van todos del mismo color y se distinguen **por forma**, como
 * en cualquier carta de verdad: seis colores distintos convierten el mapa en un
 * tablero. El único acento es el de las obras, que es lo propio y es lo que
 * tiene que saltar a la vista.
 */
const TINTA = 'rgba(232,220,186,.86)';
const TINTA_BORDE = 'rgba(10,12,11,.75)';
const TINTA_OBRA = '#d8a13f';

export class Hallazgos {
  /**
   * @param {object} deps {mundo, mineria, vegetacion, sotobosque}
   */
  constructor(deps) {
    Object.assign(this, deps);
    /** celda → máscara de bits de lo que se vio ahí */
    this.celdas = new Map();
    this.lado = Math.round(this.mundo.tamano / METROS_POR_CELDA);
    this.version = 0;
    this._sucio = false;
    this._acumulado = 0;
    this._ultimaCelda = -1;
    this.cargar();

    // Mismo motivo que en `Exploracion`: el guardado por umbral pierde lo
    // último que se caminó, y encontrar un cañaveral y perderlo por cerrar la
    // pestaña es exactamente lo que este sistema existe para evitar.
    const doc = globalThis.document;
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('beforeunload', () => this.guardarSiHaceFalta());
      doc?.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') this.guardarSiHaceFalta();
      });
    }
  }

  get cantidad() { return this.celdas.size; }

  _indice(x, z) {
    const i = Math.floor((x + this.mundo.mitad) / METROS_POR_CELDA);
    const j = Math.floor((z + this.mundo.mitad) / METROS_POR_CELDA);
    if (i < 0 || j < 0 || i >= this.lado || j >= this.lado) return -1;
    return j * this.lado + i;
  }

  _centroDe(k) {
    const i = k % this.lado, j = Math.floor(k / this.lado);
    return {
      x: -this.mundo.mitad + (i + 0.5) * METROS_POR_CELDA,
      z: -this.mundo.mitad + (j + 0.5) * METROS_POR_CELDA,
    };
  }

  /** Anota un tipo en la celda que contiene el punto. Devuelve si es novedad. */
  anotar(x, z, tipo) {
    const t = TIPOS[tipo];
    const k = this._indice(x, z);
    if (!t || k < 0) return false;
    const antes = this.celdas.get(k) || 0;
    if (antes & t.bit) return false;
    this.celdas.set(k, antes | t.bit);
    this.version++;
    this._sucio = true;
    return true;
  }

  /** ¿Se anotó esto acá? Para las pruebas y para quien quiera preguntar. */
  hay(x, z, tipo) {
    const k = this._indice(x, z);
    return k >= 0 && !!(this.celdas.get(k) & (TIPOS[tipo]?.bit || 0));
  }

  // ── Descubrimiento ─────────────────────────────────────────────────────────

  /**
   * Mira alrededor y anota lo que se distingue. Se llama desde el bucle, al
   * lado de `exploracion.revisar()`.
   *
   * Barata por construcción: sólo trabaja cuando el jugador **cambió de celda**,
   * o sea cada 128 m caminados —unos 38 segundos a 3,4 m/s—. Entre medio son
   * dos sumas y una comparación.
   */
  revisar(pos, est, dt) {
    this._acumulado += dt;
    if (this._acumulado < CADENCIA_S) return 0;
    this._acumulado = 0;

    const k = this._indice(pos.x, pos.z);
    if (k < 0 || k === this._ultimaCelda) return 0;
    this._ultimaCelda = k;

    let nuevos = 0;

    // 1) Lo que se tiene bajo los pies. Esto se anota siempre: de noche y con
    //    niebla uno igual ve lo que está pisando.
    nuevos += this._mirarTerreno(pos.x, pos.z);

    // 2) Las plantas y el sotobosque, que se leen del mundo ya sembrado. Sólo
    //    valen en el punto donde está el jugador: `masCercana` recorre las
    //    instancias vivas, que son las de alrededor de la cámara.
    nuevos += this._mirarVegetacion(pos);

    // 3) El halo de 90 m, sólo si de verdad se ve. Una veta de chatarra a
    //    noventa metros, de noche o en la niebla, no la ve nadie.
    if (this._hayVisibilidad(est)) {
      for (const [dx, dz] of [[ALCANCE_M, 0], [-ALCANCE_M, 0], [0, ALCANCE_M], [0, -ALCANCE_M]]) {
        nuevos += this._mirarTerreno(pos.x + dx, pos.z + dz);
      }
    }

    return nuevos;
  }

  _hayVisibilidad(est) {
    const hora = est?.horaDecimal ?? 12;
    if (hora < 7 || hora > 20.5) return false;
    return (est?.densidadNiebla ?? 0) < 0.0009;
  }

  /** Lo que el terreno dice de un punto: áridos y chatarra. */
  _mirarTerreno(x, z) {
    if (!this.mundo.dentro?.(x, z)) return 0;
    let n = 0;

    // De `yacimientoEn` entra sólo la arena. Ripio (16,6 %), tosca (20,0 %) y
    // pómez (22,8 %) salen en casi todos lados: marcarlos sería pintar el mapa
    // entero. La arena es el 0,4 % — eso sí es un lugar al que uno vuelve.
    const y = this.mineria?.yacimientoEn(x, z);
    if (y && y.id === 'arena' && this.anotar(x, z, 'arena')) n++;

    if (this.mineria?.hayChatarra(x, z)) {
      if (this.anotar(x, z, 'chatarra')) n++;
    }
    return n;
  }

  /**
   * La instancia más cercana **de un tipo determinado**, en un solo barrido.
   *
   * Y acá está el punto, que costó un defecto: `sotobosque.masCercano()` y
   * `vegetacion.masCercana()` devuelven la más próxima **de cualquier tipo**, y
   * eso no sirve para preguntar «¿hay piedras acá?». Con las densidades reales
   * —un coirón por m², una piedra cada 64— la probabilidad de que la más
   * cercana sea justo una piedra es del **1,2 %** (medido en
   * `r2-carta-hallazgos.mjs`), y la arcilla pide además estar en la orilla: el
   * producto daba ≈ 7×10⁻⁴ %. O sea que la arcilla y el pedrero **no se
   * marcaban nunca**.
   *
   * Es exactamente el defecto que `bucle` diagnosticó en la ronda 1 sobre
   * `Recoleccion._delSuelo` y arregló con la tabla `VALE` —«no gana el más
   * cerca: gana el que más vale»—, reintroducido en un archivo nuevo. Acá la
   * respuesta correcta no es una tabla de valor sino una pregunta más angosta:
   * no quiero la mejor mata, quiero saber **si hay piedra**. Filtrando el lote
   * primero, además, el barrido recorre sólo las piedras y no las trece mil
   * instancias de relleno.
   *
   * Se leen las matrices de instancia crudas, como hace `Recoleccion._delSuelo`,
   * para no construir un objeto por candidato.
   */
  _masCercanaDe(lotes, pos, radio, coincide) {
    let mejor = null, mejorD = radio;
    for (const lote of lotes || []) {
      if (!coincide(lote)) continue;
      const a = lote.malla?.instanceMatrix?.array;
      if (!a) continue;
      for (let i = 0; i < lote.n; i++) {
        const o = i * 16;
        const x = a[o + 12], z = a[o + 14];
        const dx = x - pos.x, dz = z - pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < mejorD) { mejorD = d; mejor = { x, y: a[o + 13], z }; }
      }
    }
    return mejor;
  }

  /**
   * Lo que hay sembrado alrededor: el cañaveral y las piedras que dan arcilla u
   * obsidiana.
   *
   * La arcilla y la obsidiana no tienen yacimiento propio: salen de juntar la
   * mata `piedra` del sotobosque, en la orilla la primera y por encima de los
   * 1.500 m la segunda (`Recoleccion.js`). Así que «dónde hay arcilla» es «una
   * orilla con piedras», y eso es exactamente lo que se anota.
   */
  _mirarVegetacion(pos) {
    let n = 0;

    const cana = this._masCercanaDe(this.vegetacion?.lotes, pos, RADIO_PLANTA_M,
      l => l.esp?.tipo === 'cana');
    if (cana && this.anotar(cana.x, cana.z, 'canaveral')) n++;

    const piedra = this._masCercanaDe(this.sotobosque?.lotes, pos, RADIO_MATA_M,
      l => l.tipo?.id === 'piedra');
    if (piedra) {
      if (piedra.y > 1500 && this.anotar(piedra.x, piedra.z, 'obsidiana')) n++;
      if (orillaCerca(this.mundo, piedra.x, piedra.z)
          && this.anotar(piedra.x, piedra.z, 'arcilla')) n++;
    }
    return n;
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  /**
   * Pinta las marcas sobre el lienzo del mapa.
   *
   * @param {CanvasRenderingContext2D} c
   * @param {(x:number,z:number)=>{px:number,py:number}} proy
   * @param {object} op {mpp, lado, construccion, exploracion}
   */
  dibujar(c, proy, op) {
    const lado = op?.lado ?? 640;
    const mpp = op?.mpp ?? 102.4;
    // Por debajo de este zoom las marcas se pisan entre ellas: se dibujan como
    // puntos y se agrupan por casillero de pantalla. Un mapa del parque entero
    // con seiscientos glifos encima no es una carta, es confeti.
    const detalladas = mpp <= 40;

    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';

    const vistos = this._pintarHallazgos(c, proy, op, lado, detalladas);
    this._pintarObras(c, proy, op, lado, detalladas);
    if (vistos.size) this._pintarLeyenda(c, lado, vistos, detalladas);

    c.restore();
  }

  _pintarHallazgos(c, proy, op, lado, detalladas) {
    const ex = op?.exploracion;
    const vistos = new Set();
    /** Para agrupar a poco zoom: un punto por casillero de 7 px. */
    const ocupados = detalladas ? null : new Set();

    for (const [k, mascara] of this.celdas) {
      const { x, z } = this._centroDe(k);
      const p = proy(x, z);
      if (p.px < -12 || p.py < -12 || p.px > lado + 12 || p.py > lado + 12) continue;
      // Si la exploración se olvidó, la marca no puede sobrevivirla: sería
      // revelar por la ventana de atrás algo que el velo está tapando.
      if (ex && ex.conocimientoEn(x, z) <= 0) continue;

      if (!detalladas) {
        const casilla = `${Math.round(p.px / 7)},${Math.round(p.py / 7)}`;
        if (ocupados.has(casilla)) { this._marcarVistos(mascara, vistos); continue; }
        ocupados.add(casilla);
        c.fillStyle = TINTA;
        c.beginPath(); c.arc(p.px, p.py, 1.6, 0, 6.283); c.fill();
        this._marcarVistos(mascara, vistos);
        continue;
      }

      // A buen zoom, cada tipo con su forma. Si en una celda hay varios, se
      // abren en abanico para que no se tapen.
      const presentes = LISTA_TIPOS.filter(([, t]) => mascara & t.bit);
      presentes.forEach(([id, t], i) => {
        vistos.add(id);
        const off = presentes.length > 1 ? (i - (presentes.length - 1) / 2) * 7 : 0;
        this._glifo(c, t.glifo, p.px + off, p.py);
      });
    }
    return vistos;
  }

  _marcarVistos(mascara, vistos) {
    for (const [id, t] of LISTA_TIPOS) if (mascara & t.bit) vistos.add(id);
  }

  /**
   * Los símbolos. Trazo, no relleno, y todos del mismo color: es lo que separa
   * una carta de un tablero de iconos. Se dibujan dos veces —oscuro ancho
   * debajo, claro fino encima— porque el relieve va del verde del bosque al
   * blanco de la nieve y un solo trazo se pierde contra alguno de los dos.
   */
  _glifo(c, forma, x, y) {
    const trazar = () => {
      c.beginPath();
      switch (forma) {
        case 'puntos':                       // banco de arena: el grano
          for (const dx of [-3, 0, 3]) { c.moveTo(x + dx + 0.8, y); c.arc(x + dx, y, 0.8, 0, 6.283); }
          break;
        case 'triangulo':                    // pómez: caída volcánica, hueca y liviana
          c.moveTo(x, y - 3.4); c.lineTo(x + 3.2, y + 2.4); c.lineTo(x - 3.2, y + 2.4); c.closePath();
          break;
        case 'rombo':                        // chatarra: lo que dejó la ocupación
          c.moveTo(x, y - 3.6); c.lineTo(x + 3, y); c.lineTo(x, y + 3.6); c.lineTo(x - 3, y); c.closePath();
          break;
        case 'barranca':                     // arcilla: el corte de la orilla
          c.moveTo(x - 3.6, y + 2.6); c.lineTo(x - 1.2, y - 2.4); c.lineTo(x + 1.6, y + 0.6); c.lineTo(x + 3.6, y - 2.6);
          break;
        case 'canas':                        // cañaveral: el haz de varas
          for (const dx of [-2.6, 0, 2.6]) { c.moveTo(x + dx, y + 3.2); c.lineTo(x + dx * 0.55, y - 3.2); }
          break;
        case 'lasca':                        // pedrero de altura: el filo tallado
          c.moveTo(x - 3.2, y + 2.8); c.lineTo(x + 0.6, y - 3.4); c.lineTo(x + 3.2, y + 2.8); c.closePath();
          break;
      }
    };
    c.lineWidth = 2.6; c.strokeStyle = TINTA_BORDE; trazar(); c.stroke();
    c.lineWidth = 1.1; c.strokeStyle = TINTA; trazar(); c.stroke();
  }

  /**
   * Las obras propias. El dueño las pidió como una X y una X es lo correcto:
   * es la marca que uno hace en un mapa de papel, no un icono de inventario.
   */
  _pintarObras(c, proy, op, lado, detalladas) {
    const obras = op?.construccion?.obras;
    if (!obras?.length) return;

    c.textBaseline = 'middle';
    c.font = '10px system-ui, sans-serif';

    for (const o of obras) {
      const p = proy(o.x, o.z);
      if (p.px < -40 || p.py < -20 || p.px > lado + 40 || p.py > lado + 20) continue;

      // Lo permanente y lo de uso público pesan más en un mapa que un vivac que
      // se desarma al irse; el tamaño lo dice sin necesidad de una leyenda.
      const cat = o.obra?.categoria;
      const r = cat === 'permanente' || cat === 'uso_publico' ? 5.4 : 3.8;

      c.beginPath();
      c.moveTo(p.px - r, p.py - r); c.lineTo(p.px + r, p.py + r);
      c.moveTo(p.px + r, p.py - r); c.lineTo(p.px - r, p.py + r);
      c.lineWidth = 3.4; c.strokeStyle = TINTA_BORDE; c.stroke();
      c.lineWidth = 1.7; c.strokeStyle = TINTA_OBRA; c.stroke();

      // El nombre sólo cuando hay lugar: a 102 m por píxel serían cuarenta
      // etiquetas encimadas sobre el parque entero.
      if (detalladas && o.obra?.nombre) {
        c.lineWidth = 3; c.strokeStyle = TINTA_BORDE;
        c.strokeText(o.obra.nombre, p.px + r + 4, p.py);
        c.fillStyle = TINTA_OBRA;
        c.fillText(o.obra.nombre, p.px + r + 4, p.py);
      }
    }
  }

  /**
   * La leyenda, con **sólo lo que el jugador ya encontró**.
   *
   * Sin esto los símbolos son jeroglíficos. Y creciendo a medida que se
   * descubre, la leyenda misma es un registro de lo aprendido: en un juego que
   * trata de relevar, el índice de símbolos se gana igual que las fichas.
   */
  _pintarLeyenda(c, lado, vistos, detalladas) {
    const filas = LISTA_TIPOS.filter(([id]) => vistos.has(id));
    if (!filas.length) return;

    const ancho = 132, alto = filas.length * 15 + 12;
    const x0 = lado - ancho - 10, y0 = 10;

    c.fillStyle = 'rgba(8,10,9,.62)';
    c.strokeStyle = 'rgba(255,255,255,.10)';
    c.lineWidth = 1;
    c.beginPath();
    c.rect(x0, y0, ancho, alto);
    c.fill(); c.stroke();

    c.font = '9.5px system-ui, sans-serif';
    c.textBaseline = 'middle';
    filas.forEach(([, t], i) => {
      const y = y0 + 12 + i * 15;
      // La leyenda dibuja el glifo de verdad, no una aproximación: si mañana
      // cambia el símbolo, cambia acá solo.
      if (detalladas) this._glifo(c, t.glifo, x0 + 14, y);
      else { c.fillStyle = TINTA; c.beginPath(); c.arc(x0 + 14, y, 1.6, 0, 6.283); c.fill(); }
      c.fillStyle = 'rgba(226,214,180,.82)';
      c.fillText(t.nombre, x0 + 26, y);
    });
  }

  // ── Persistencia ───────────────────────────────────────────────────────────

  guardarSiHaceFalta() { if (this._sucio) this.guardar(); }

  guardar() {
    try {
      // Plano y de a pares —celda, máscara—: la mitad de bytes que un array de
      // arrays, y se lee de un tirón.
      const plano = new Array(this.celdas.size * 2);
      let i = 0;
      for (const [k, m] of this.celdas) { plano[i++] = k; plano[i++] = m; }
      localStorage.setItem(CLAVE, JSON.stringify({ v: 1, lado: this.lado, h: plano }));
      this._sucio = false;
    } catch { /* sin almacenamiento: los hallazgos viven sólo esta sesión */ }
  }

  cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return false;
      const d = JSON.parse(crudo);
      // Si el mundo cambió de tamaño, los índices de celda ya no significan lo
      // mismo. Mejor empezar de cero que dibujar marcas corridas: una carta que
      // miente es peor que una carta vacía.
      if (d?.v !== 1 || d.lado !== this.lado || !Array.isArray(d.h)) return false;
      this.celdas.clear();
      for (let i = 0; i + 1 < d.h.length; i += 2) {
        const k = d.h[i], m = d.h[i + 1];
        if (Number.isInteger(k) && k >= 0 && k < this.lado * this.lado && Number.isInteger(m) && m > 0) {
          this.celdas.set(k, m);
        }
      }
      this.version++;
      this._sucio = false;
      return true;
    } catch { return false; }
  }

  olvidar() {
    this.celdas.clear();
    this._ultimaCelda = -1;
    this.version++;
    this._sucio = false;
    try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
  }
}
