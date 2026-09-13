/**
 * Inventario — lo que el jugador carga encima, en casilleros.
 *
 * Hasta la ronda 6 esto era un `Map<recurso, cantidad>` con un tope de peso: el
 * bolso era una lista y la única pregunta era cuánto pesaba. Ahora es una
 * grilla, como la de Diablo 2 o la de Rust, y **hay dos topes que muerden**:
 *
 * - **El peso**, que ya estaba y no se toca. Es el que frena en la subida y el
 *   que sostiene a los cuatro objetos que dan capacidad. Una carga mixta de
 *   38 kg entra siempre en la grilla, así que en el día normal el que dice que
 *   no es el peso, igual que antes.
 * - **Los casilleros**, que muerden el día de juntar liviano: una recorrida de
 *   sólo hierbas y yesca llega a 28 casilleros y la grilla la corta en 24.
 *
 * Las dos medidas se derivan y ninguna se ficha a mano: `pilaDe()` saca el
 * tamaño de la pila del peso del recurso, y `casillasPara()` saca el largo de la
 * grilla de la capacidad. Están en `Recursos.js`, al lado de los pesos de los
 * que salen.
 *
 * Tres decisiones que vale la pena explicar, porque son las que distinguen una
 * grilla de una lista con bordes:
 *
 * 1. **Las posiciones son estables.** Sacar lo de la casilla 5 deja la casilla 5
 *    vacía; la 6 no se corre. Una lista que se compacta obliga a volver a buscar
 *    todo después de cada uso, y ahí se pierde la memoria muscular que es la
 *    mitad de para qué sirve una grilla.
 * 2. **Se completa la pila abierta antes de abrir casillero nuevo.** Juntar 3 y
 *    después 3 de madera blanda deja 5 y 1, no 3 y 3. Si no, una tarde de
 *    recolección deja la grilla llena de pilas a medias.
 * 3. **La API de afuera no cambió.** Son 75 sitios de llamada en 16 archivos y
 *    ninguno sabe que esto es una grilla: `agregar` sigue devolviendo cuánto
 *    entró de verdad —ahora contando peso **y** casilleros— y `listar()` sigue
 *    devolviendo un renglón por recurso aunque estén repartidos en tres pilas.
 *
 * Los totales por recurso viven en un `Map` aparte que se recuenta después de
 * cada cambio. Es un caché, nunca la fuente: la fuente es `casillas`. Se hace
 * así y no llevando la cuenta al vuelo porque un caché que se actualiza a mano
 * en siete lugares se desincroniza en el octavo, y el síntoma sería que el bolso
 * dice que tenés cuatro leñas y la grilla muestra tres. Recontar 24 casilleros
 * cuesta nada y sólo pasa cuando algo se movió, no por cuadro.
 *
 * Desde la fase 2 de la ronda 6 una casilla puede tener otra cosa: **una
 * instancia**. Un recurso es `{id, n}` y una instancia es `{id, n: 1, usos}`.
 * Tener `usos` es todo lo que la distingue, y una instancia **nunca apila**: dos
 * hachas son dos casilleros aunque una esté al 40 % y la otra al 90 %.
 *
 * Este archivo **no aprende qué es una herramienta**. No importa
 * `herramientas.json`, no sabe qué es una durabilidad y no decide quién puede
 * llevar qué: sólo sabe que una casilla con `usos` se entrega entera y no se
 * junta con su vecina. Tres cosas necesita de afuera, y las tres entran por la
 * puerta de adelante:
 *
 * - **Un catálogo** —`id → {kg, guardaLiquido}`— para poder pesar lo que no está
 *   en `RECURSOS` y saber cuántas medidas de líquido guarda. Sin él un hacha
 *   pesaría los 0,5 kg que `pesoDe()` inventa para lo desconocido, y el bolso
 *   mentiría por 0,3 kg cada vez.
 * - **`pesoAparte`**, una función que dice cuánto pesa lo que se lleva encima y
 *   no está en la grilla: las cuatro ranuras del equipo. Es una función y no un
 *   número porque el que lo sabe es `Equipo`, y un número copiado se
 *   desactualiza en el primer equipar que nadie avise.
 * - **`guardaAparte`**, lo mismo para el líquido: cuántas medidas guarda lo que
 *   se lleva puesto.
 *
 * ── Ronda 7, fase 4: el agua viaja en un recipiente ─────────────────────────
 *
 * Hasta acá el agua entraba suelta, como la piedra: se bebía en la orilla y la
 * medida caía al bolso sin preguntar en qué. El dueño lo dijo jugando —«el agua
 * se puede tomar pero no cargar; hace falta alguna vasija»— y ahora hay **un
 * tercer tope**, que muerde a los tres líquidos y a nada más: entran tantas
 * medidas como guarden los recipientes que se llevan, en la grilla o puestos,
 * contando agua, agua hervida e infusión juntas. Una medida es un litro.
 *
 * No se le da a cada recipiente su propia agua, y es a propósito: eso obligaría
 * a que las seis recetas, la Q, los hornos, los depósitos y el guardado vaciaran
 * instancias. Que dos odres sean dos aguas queda escrito como deuda.
 *
 * Tres reglas del tope que se notan al jugar:
 *
 * 1. **Decide al entrar, no al estar.** Un guardado de antes de los recipientes
 *    trae el agua que traía y la conserva entera hasta que se tome; lo único que
 *    pasa es que no entra más. Y pasar un odre de la grilla a la ranura —que por
 *    un instante no está en ningún lado— no toca el agua.
 * 2. **Se derrama sólo al soltar, y lo pide el que suelta**: `derramar()`. Si lo
 *    hiciera `sacar()`, equipar derramaría.
 * 3. **Un recipiente gastado sigue guardando.** Hoy nada gasta un recipiente
 *    —`Equipo.desgastar()` sólo toca la mano—, y si dejara de guardar al
 *    gastarse, el agua se iría en un momento que no es soltar.
 */

import { RECURSOS, normalizar, pesoDe, nombreDe, satisface, pilaDe, casillasPara } from './Recursos.js';

/**
 * Lo que se le perdona al peso al preguntar si algo entra.
 *
 * Sin esto, sumar y restar decimales deja el bolso trabado a 37,999 kg de 38:
 * el hueco libre da -1e-16, la división se va a cero y no entra ni una fibra
 * aunque la cuenta cierre. Es un microgramo, y evita un defecto que sólo
 * aparece después de un rato largo de juego.
 */
const EPS_KG = 1e-9;

/**
 * Los líquidos, que no viajan sueltos: entran sólo si hay en qué.
 *
 * El orden es el del derrame. Se va primero el agua común, que se vuelve a
 * juntar en cualquier orilla, y queda para lo último la infusión, que costó
 * canelo, leña y horno. Al soltar un recipiente nadie elige qué tirar, y lo
 * justo es perder lo que menos costó.
 *
 * Es una lista de recursos y no de herramientas, así que la regla de que este
 * archivo no aprende qué es una herramienta sigue en pie. Vive acá y no al lado
 * de `RECURSOS` porque el tope es el único que la usa.
 */
export const LIQUIDOS = ['agua', 'agua_segura', 'infusion_canelo'];

/**
 * Una casilla con `usos` es una instancia: se entrega entera, no apila y no se
 * junta con la de al lado aunque sean lo mismo.
 *
 * Se exporta porque la interfaz tiene que dibujarlas distinto y el equipo tiene
 * que encontrarlas, y las tres copias de `c.usos !== undefined` desperdigadas
 * serían tres lugares donde equivocarse el día que la marca cambie.
 */
export const esInstancia = (c) => !!c && c.usos !== undefined;

export class Inventario {
  /**
   * @param {number} capacidadKg
   * @param {{catalogo?: Map<string,{kg:number, guardaLiquido?:number}>|object}} [opciones]
   *   pesos de lo que no está en `RECURSOS`, y cuánto líquido guarda. Opcional a
   *   propósito: sin catálogo esto sigue siendo el inventario de la fase 1, y los
   *   75 sitios de llamada que lo construyen a secas no se enteran.
   */
  constructor(capacidadKg = 38, { catalogo } = {}) {
    this._capacidadKg = capacidadKg;
    /** @type {Array<null|{id: string, n: number, usos?: number}>} la grilla, por posición */
    this.casillas = new Array(casillasPara(capacidadKg)).fill(null);
    /** @type {Map<string, number>} caché: recurso -> total sumando sus pilas */
    this._total = new Map();
    /** @type {Map<string, {kg: number}>} pesos de lo que no es recurso */
    this.catalogo = new Map();
    this.fichar(catalogo);
    /** Caché del peso de la grilla, rehecho en cada `_recontar()`. */
    this._kgGrilla = 0;
    /**
     * Cuánto pesa lo que se lleva encima y no está en la grilla. Lo escribe
     * `Equipo` con sus cuatro ranuras: lo puesto pesa —lo estás cargando igual—
     * pero no ocupa casillero, y eso es lo que hace que valga la pena tener el
     * hacha en la mano y no en el bolso.
     * @type {null|(() => number)}
     */
    this.pesoAparte = null;
    /**
     * Cuántas medidas de líquido guarda lo que se lleva puesto. Es el hermano de
     * `pesoAparte`, por la misma costura y por la misma razón: un odre a la
     * espalda no está en la grilla, y el único que sabe que está es `Equipo`.
     * @type {null|(() => number)}
     */
    this.guardaAparte = null;
    /**
     * Se prende cuando un guardado traía más de lo que entra en la grilla. Que
     * el jugador pierda cosas es aceptable; que las pierda **en silencio**, no.
     */
    this.desbordado = false;
    this.alCambiar = null;
  }

  /**
   * Suma fichas al catálogo: cuánto pesa una unidad y cuántas medidas de
   * líquido guarda. Se puede llamar más de una vez porque el que tiene
   * `herramientas.json` en la mano es `Equipo`, y se construye después que el
   * bolso: si esto exigiera venir completo desde el constructor, `main.js`
   * tendría que aprender qué es una herramienta para pasárselo.
   */
  fichar(catalogo) {
    if (!catalogo) return;
    const pares = catalogo instanceof Map ? catalogo : Object.entries(catalogo);
    for (const [id, ficha] of pares) {
      if (!id) continue;
      this.catalogo.set(normalizar(id), {
        kg: Number(ficha?.kg) || 0,
        // En medidas enteras, como todo lo que cuenta este archivo: una ficha que
        // dijera 1,5 dejaría media medida que no se puede agregar ni quitar.
        guardaLiquido: Math.max(0, Math.floor(Number(ficha?.guardaLiquido) || 0)),
      });
    }
  }

  /**
   * Cuánto pesa una unidad de algo, sea recurso o no.
   *
   * `pesoDe()` inventa 0,5 kg para lo que no conoce, que está bien para un
   * recurso sin ficha y mal para un objeto: por eso el catálogo manda sobre él.
   * Un objeto fichado sin `kg` pesa cero y no medio kilo inventado —hoy es uno
   * solo, `encerado`, y es un agujero de dato que se declara, no se rellena.
   */
  _kg(id) {
    const f = this.catalogo.get(id);
    if (f) return f.kg;
    return pesoDe(id);
  }

  /** Lo mismo, para quien dibuja: el bolso tiene que poder decir cuánto pesa un hacha. */
  kgDe(id) { return this._kg(normalizar(id)); }


  /**
   * La capacidad es una propiedad de verdad porque cambia en caliente: la
   * cestería y la mochila la suben en pleno juego, y `main.js` la reescribe
   * derecho con `inventario.capacidadKg = ...`. Si el largo de la grilla no se
   * ajustara solo ahí, el canasto daría kilos y ningún casillero hasta el
   * próximo arranque, y nadie se enteraría.
   */
  get capacidadKg() { return this._capacidadKg; }

  set capacidadKg(kg) {
    this._capacidadKg = kg;
    this.ajustarCasillas();
  }

  /**
   * Pone el largo de la grilla al día después de un cambio de capacidad.
   *
   * Crecer es gratis. Achicar sólo llega hasta la última casilla ocupada: perder
   * el canasto no puede evaporar lo que estaba guardado en las casillas que ese
   * canasto pagaba. La grilla queda más larga de lo que corresponde hasta que se
   * vacíe la cola, y eso es preferible a un agujero.
   */
  ajustarCasillas() {
    const quiere = casillasPara(this._capacidadKg);
    if (this.casillas.length < quiere) {
      while (this.casillas.length < quiere) this.casillas.push(null);
      return;
    }
    if (this.casillas.length > quiere) {
      let ultima = -1;
      for (let i = this.casillas.length - 1; i >= 0; i--) {
        if (this.casillas[i]) { ultima = i; break; }
      }
      this.casillas.length = Math.max(quiere, ultima + 1);
    }
  }

  /** De a cuántos apila este recurso en un casillero. */
  topeDe(recurso) { return pilaDe(pesoDe(recurso)); }

  /**
   * Todo lo que se carga: la grilla más lo que se lleva puesto.
   *
   * El peso de la grilla es un caché que rehace `_recontar()`, por el mismo
   * motivo que los totales: se pregunta muchas veces por cuadro —el HUD, la
   * barra del bolso, cada `agregar`— y cambia sólo cuando algo se movió.
   */
  get pesoKg() {
    return this._kgGrilla + (this.pesoAparte?.() || 0);
  }

  get lleno() { return this.pesoKg >= this._capacidadKg; }

  /** ¿Quedó algún casillero libre? */
  get sinCasillas() { return !this.casillas.some(c => !c); }

  cantidad(recurso) { return this._total.get(normalizar(recurso)) || 0; }

  /**
   * Agrega lo que entre. Devuelve cuánto entró de verdad, que es de lo que
   * dependen once de los doce sitios que agregan: «cazaste el ciervo pero no te
   * entra» es un renglón del aviso, no un fallo.
   *
   * Ahora "lo que entre" mira los dos topes. Puede sobrar peso y no haber
   * casillero, y puede haber casillero y no sobrar peso; manda el que se acabe
   * primero. Y para los líquidos hay un tercero, el de los recipientes: cuando
   * corta, este número es el que deja la hornada de agua hervida esperando
   * junto al horno en vez de tirarla.
   */
  agregar(recurso, cantidad) {
    const k = normalizar(recurso);
    const n = this._entra(k, cantidad);
    if (n === 0) return 0;

    const tope = pilaDe(pesoDe(k));
    let falta = n;
    // Primero las pilas abiertas, en orden: si no, dos recolecciones seguidas
    // dejan dos casilleros a medio llenar en vez de uno lleno.
    for (const c of this.casillas) {
      if (falta === 0) break;
      if (!c || c.id !== k || esInstancia(c) || c.n >= tope) continue;
      const pone = Math.min(falta, tope - c.n);
      c.n += pone;
      falta -= pone;
    }
    // Y después el primer hueco libre, que puede ser uno del medio: la grilla no
    // compacta al sacar, así que lo nuevo tapa el agujero antes de irse al final.
    for (let i = 0; i < this.casillas.length && falta > 0; i++) {
      if (this.casillas[i]) continue;
      const pone = Math.min(falta, tope);
      this.casillas[i] = { id: k, n: pone };
      falta -= pone;
    }

    this._recontar();
    this.alCambiar?.();
    return n;
  }

  /**
   * Cuánto de esto entraría ahora, sin meter nada.
   *
   * Es la misma cuenta que usa `agregar`, y no una parecida: existe para que un
   * cartel pueda prometer sólo lo que entra. «Beber agua (1 × agua)» con los
   * recipientes llenos sería prometer de más, y dos cuentas que se parecen se
   * separan en el primer tope que se le agregue a una sola.
   */
  entra(recurso, cantidad) {
    return this._entra(normalizar(recurso), cantidad);
  }

  /** Los tres topes, con el id ya normalizado. */
  _entra(k, cantidad) {
    const pedido = Math.max(0, Math.floor(Number(cantidad) || 0));
    if (pedido === 0) return 0;

    const unidad = pesoDe(k);
    const libre = Math.max(0, this._capacidadKg - this.pesoKg);
    const porPeso = unidad > 0 ? Math.floor((libre + EPS_KG) / unidad) : pedido;

    const tope = pilaDe(unidad);
    let porCasillas = 0;
    for (const c of this.casillas) {
      if (!c) porCasillas += tope;
      // Una instancia con el mismo id no es hueco de pila: un hacha en la
      // casilla 3 no admite «una unidad más de hacha», admite cero.
      else if (c.id === k && !esInstancia(c)) porCasillas += Math.max(0, tope - c.n);
    }

    // El tercero muerde sólo a los líquidos. Con más de lo que cabe —un guardado
    // de antes de los recipientes— da cero y no un número negativo: lo que sobra
    // se conserva, pero no crece.
    const porLiquido = LIQUIDOS.includes(k)
      ? Math.max(0, this._cabeLiquido() - this._llevaLiquido())
      : pedido;

    return Math.max(0, Math.min(pedido, porPeso, porCasillas, porLiquido));
  }

  // ── El líquido ────────────────────────────────────────────────────────────

  /**
   * Cuánto líquido se lleva y cuánto cabe, **en medidas y no en kilos**. La
   * infusión pesa 0,4 kg la medida y el agua 1: con un tope en kilos, el mismo
   * odre guardaría dos veces y media más infusión que agua.
   *
   * `lleva` puede pasarse de `cabe`, y se dice tal cual. Pasa con un guardado
   * de antes de los recipientes, o con uno cuyo odre el dataset dejó de conocer.
   *
   * Se cuenta cada vez y no se guarda en caché como el peso. Se pregunta al
   * agregar un líquido, al armar el cartel de beber y al pintar el bolso, y no
   * por cuadro: el caché no ahorraría nada y sería una cuenta más que se puede
   * desincronizar.
   * @returns {{lleva: number, cabe: number}}
   */
  get liquido() {
    return { lleva: this._llevaLiquido(), cabe: this._cabeLiquido() };
  }

  _llevaLiquido() {
    let n = 0;
    for (const id of LIQUIDOS) n += this._total.get(id) || 0;
    return n;
  }

  /**
   * Lo que guardan los recipientes de la grilla más los que se llevan puestos.
   * Se mira el catálogo por id y no si la casilla es una instancia: el
   * inventario no sabe qué es un recipiente, sabe que esa ficha guarda.
   */
  _cabeLiquido() {
    let n = 0;
    for (const c of this.casillas) {
      if (c) n += (this.catalogo.get(c.id)?.guardaLiquido || 0) * c.n;
    }
    return n + Math.max(0, Math.floor(this.guardaAparte?.() || 0));
  }

  /**
   * Tira el líquido que no cabe y devuelve lo que se fue, `[{id, n}]`, en el
   * orden de `LIQUIDOS`. Si no sobraba nada, devuelve una lista vacía.
   *
   * **Nadie de este archivo lo llama, y ésa es la regla entera.** Lo llama quien
   * suelta un recipiente. Si lo llamara `sacar()`, pasar el odre de la grilla a
   * la espalda lo derramaría, porque `Equipo.equipar()` lo saca del casillero un
   * instante antes de ponerlo en la ranura. Si lo llamara `reponer()`, un
   * guardado viejo perdería el agua al cargar.
   */
  derramar() {
    let sobra = this._llevaLiquido() - this._cabeLiquido();
    const fue = [];
    for (const id of LIQUIDOS) {
      if (sobra <= 0) break;
      const n = Math.min(sobra, this._total.get(id) || 0);
      if (n > 0 && this.quitar(id, n)) {
        fue.push({ id, n });
        sobra -= n;
      }
    }
    return fue;
  }

  /**
   * Saca del bolso. Todo o nada: si no hay tanto, no toca nada y devuelve false.
   *
   * Descuenta desde el final para adelante, así los restos que quedaron sueltos
   * al fondo son los primeros en irse y las pilas llenas del principio quedan
   * enteras. Vaciar desde adelante dejaría la grilla salpicada de huecos justo
   * donde el jugador tiene la mano hecha.
   */
  quitar(recurso, cantidad) {
    const k = normalizar(recurso);
    const pide = Math.max(0, Math.floor(Number(cantidad) || 0));
    const hay = this._total.get(k) || 0;
    if (hay < pide) return false;

    let falta = pide;
    for (let i = this.casillas.length - 1; i >= 0 && falta > 0; i--) {
      const c = this.casillas[i];
      // Las instancias no entran acá ni por casualidad: no están en `_total`,
      // así que `hay` nunca las contó, y descontarlas sería tirar un hacha para
      // pagar una deuda de leña.
      if (!c || c.id !== k || esInstancia(c)) continue;
      const saca = Math.min(c.n, falta);
      c.n -= saca;
      falta -= saca;
      // Una casilla en cero es una casilla vacía, no una casilla con nada
      // adentro: `{n: 0}` se dibujaría como ocupada y no dejaría poner nada.
      if (c.n <= 0) this.casillas[i] = null;
    }

    this._recontar();
    this.alCambiar?.();
    return true;
  }

  /**
   * Cuánto hay disponible para un pedido, contando equivalencias: la madera
   * dura del coihue sirve para cualquier receta que pida "madera".
   */
  disponiblePara(pedido) {
    const p = normalizar(pedido);
    let total = 0;
    for (const [k, n] of this._total) {
      if (satisface(k).includes(p)) total += n;
    }
    return total;
  }

  /** Consume un pedido usando primero el recurso más específico. */
  consumirPara(pedido, cantidad) {
    const p = normalizar(pedido);
    let falta = cantidad;
    const candidatos = [...this._total.keys()]
      .filter(k => satisface(k).includes(p))
      .sort((a, b) => (a === p ? -1 : b === p ? 1 : 0));
    for (const k of candidatos) {
      if (falta <= 0) break;
      const hay = this._total.get(k);
      const usa = Math.min(hay, falta);
      this.quitar(k, usa);
      falta -= usa;
    }
    return falta <= 0;
  }

  /**
   * Lista ordenada para la interfaz: **un renglón por recurso, no por casilla**.
   *
   * Doce maderas blandas repartidas en tres pilas son un solo renglón que dice
   * 12. El HUD, el depósito y la pantalla de muerte cuentan con eso desde antes
   * de que existiera la grilla, y es lo primero que rompe una grilla mal hecha.
   */
  listar() {
    return [...this._total.entries()]
      .map(([k, n]) => ({
        id: k, nombre: nombreDe(k), cantidad: n,
        kg: +(pesoDe(k) * n).toFixed(1),
        cat: RECURSOS[k]?.cat || 'material',
      }))
      .sort((a, b) => a.cat.localeCompare(b.cat) || a.nombre.localeCompare(b.nombre));
  }

  /** Comestibles a mano, para el atajo de comer. */
  comestibles() {
    return this.listar().filter(i => RECURSOS[i.id]?.cat === 'alimento' && RECURSOS[i.id].nutre > 0);
  }

  // ── La grilla ─────────────────────────────────────────────────────────────

  /**
   * Mueve el contenido de un casillero a otro. Devuelve true si algo pasó.
   *
   * Las tres reglas de siempre: el destino vacío recibe, el destino con lo mismo
   * junta hasta el tope de la pila y le deja el resto al origen, y el destino con
   * otra cosa intercambia. Nunca se crea ni se pierde nada: mover es reordenar.
   */
  mover(a, b) {
    const g = this.casillas;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a < 0 || b < 0 || a >= g.length || b >= g.length || a === b) return false;

    const origen = g[a];
    if (!origen) return false;
    const destino = g[b];

    if (!destino) {
      g[b] = origen;
      g[a] = null;
    } else if (esInstancia(origen) || esInstancia(destino)) {
      // **Ése es el punto entero de la fase.** Dos hachas son dos casilleros
      // aunque una esté al 40 % y la otra al 90 %, así que arrastrar una sobre
      // la otra las intercambia y no las junta. Si se juntaran, la del 40 %
      // desaparecería y con ella la mitad de la razón para tener dos.
      g[b] = origen;
      g[a] = destino;
    } else if (destino.id === origen.id) {
      const pasa = Math.min(origen.n, Math.max(0, this.topeDe(origen.id) - destino.n));
      // Juntar sobre una pila ya llena no es un movimiento: si devolviera true,
      // la interfaz soltaría lo que tiene tomado creyendo que lo puso.
      if (pasa === 0) return false;
      destino.n += pasa;
      origen.n -= pasa;
      if (origen.n <= 0) g[a] = null;
    } else {
      g[b] = origen;
      g[a] = destino;
    }

    this._recontar();
    this.alCambiar?.();
    return true;
  }

  /**
   * Parte una pila al medio y manda la mitad al primer casillero libre.
   *
   * Una pila de 1 no se parte y devuelve false, igual que si no queda ningún
   * casillero libre: es el gesto para separar diez juncos de los veinte, y sin
   * lugar donde dejarlos no hay nada que hacer.
   */
  partir(i) {
    const g = this.casillas;
    if (!Number.isInteger(i) || i < 0 || i >= g.length) return false;
    const c = g[i];
    if (!c || c.n < 2) return false;
    const libre = g.findIndex(x => !x);
    if (libre < 0) return false;

    const mitad = Math.floor(c.n / 2);
    g[libre] = { id: c.id, n: mitad };
    c.n -= mitad;

    this._recontar();
    this.alCambiar?.();
    return true;
  }

  // ── Cosas que no apilan ───────────────────────────────────────────────────
  //
  // Tres verbos y nada más. El inventario no sabe qué es una herramienta: sabe
  // que hay cosas que ocupan un casillero entero y se entregan de a una, y quien
  // sabe cuáles son —`Equipo`— las mete y las saca por acá.

  /**
   * Mete una cosa en el primer casillero libre. `false` si no hay ninguno, y en
   * ese caso no toca nada: perder un hacha por no tener dónde ponerla sería
   * exactamente el defecto que esta fase viene a cerrar.
   */
  meter(cosa) {
    if (!cosa) return false;
    const i = this.casillas.findIndex(c => !c);
    if (i < 0) return false;
    return this.meterEn(i, cosa);
  }

  /**
   * Mete una cosa en un casillero concreto, si está libre.
   *
   * Existe por el intercambio de ranura: al sacar el hacha buena del casillero 7
   * y guardar ahí la vieja, el bolso no se corre de lugar. Cambiar de hacha no
   * puede reordenarle la grilla al jugador.
   */
  meterEn(i, cosa) {
    if (!cosa || !Number.isInteger(i) || i < 0 || i >= this.casillas.length) return false;
    if (this.casillas[i]) return false;
    this.casillas[i] = cosa;
    this._recontar();
    this.alCambiar?.();
    return true;
  }

  /** Vacía un casillero y devuelve lo que había, o null. */
  sacar(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.casillas.length) return null;
    const c = this.casillas[i];
    if (!c) return null;
    this.casillas[i] = null;
    this._recontar();
    this.alCambiar?.();
    return c;
  }

  /**
   * Las instancias que hay en la grilla, con su casillero. Con `id`, sólo las de
   * ese id.
   * @returns {Array<{i: number, cosa: object}>}
   */
  instancias(id) {
    const k = id ? normalizar(id) : null;
    const sale = [];
    for (let i = 0; i < this.casillas.length; i++) {
      const c = this.casillas[i];
      if (esInstancia(c) && (!k || c.id === k)) sale.push({ i, cosa: c });
    }
    return sale;
  }

  /**
   * Rehace el caché desde la grilla sin avisarle a nadie.
   *
   * Lo usa `Equipo` después de repasar un guardado viejo: si el dataset dejó de
   * conocer un objeto, la casilla queda vacía y el peso tiene que enterarse.
   */
  recontar() { this._recontar(); }

  // ── Guardado y muerte ─────────────────────────────────────────────────────

  /** La muerte: se pierde entero lo que se cargaba encima. */
  vaciar() {
    this.casillas.fill(null);
    this._total.clear();
    this._kgGrilla = 0;
    this.desbordado = false;
    this.alCambiar?.();
  }

  /**
   * Lo que va al guardado, en datos planos y sin compartir referencias con la
   * grilla viva: una foto que se muta sola después de sacarla no es una foto.
   */
  serializar() {
    return {
      // Los usos van sólo si los hay, para que un bolso sin herramientas siga
      // guardándose exactamente igual que en la fase 1. Los infinitos van como
      // null porque `JSON.stringify(Infinity)` también da null, y es mejor que
      // la conversión se vea acá que descubrirla al cargar.
      casillas: this.casillas.map(c => (
        !c ? null
          : esInstancia(c) ? { id: c.id, n: c.n, usos: Number.isFinite(c.usos) ? c.usos : null }
          : { id: c.id, n: c.n }
      )),
    };
  }

  /**
   * Repone un guardado, **en los dos formatos**.
   *
   * El viejo es `[['madera_dura', 3], ['yesca', 10]]`, que es lo que hay escrito
   * en el navegador de todos los que ya venían jugando; el nuevo trae la grilla
   * casilla por casilla. Se reconocen solos, así que `VERSION` sigue en 1 y
   * nadie pierde la partida por una ronda de mejoras — la misma decisión que se
   * tomó con el equipo en la ronda 5.
   *
   * No se mira el peso a propósito: una partida guardada con la mochila puesta
   * puede venir por encima de la capacidad de ahora, y llegar sobrecargado es
   * mejor que llegar con la mitad de las cosas. La grilla sí se respeta, porque
   * es la que da las posiciones; si algo no entra se prende `desbordado`.
   */
  reponer(datos) {
    this.casillas = new Array(casillasPara(this._capacidadKg)).fill(null);
    this._total.clear();
    this._kgGrilla = 0;
    this.desbordado = false;
    if (!datos) { this.alCambiar?.(); return false; }

    if (Array.isArray(datos)) this._reponerViejo(datos);
    else if (Array.isArray(datos.casillas)) this._reponerGrilla(datos.casillas);
    else { this.alCambiar?.(); return false; }

    this._recontar();
    this.alCambiar?.();
    return true;
  }

  /** El formato de antes de la ronda 6: pares recurso/cantidad, sin posiciones. */
  _reponerViejo(pares) {
    for (const par of pares) {
      const [id, n] = Array.isArray(par) ? par : [];
      const k = normalizar(id);
      let falta = Math.max(0, Math.floor(Number(n) || 0));
      if (!k || falta === 0) continue;
      const tope = pilaDe(pesoDe(k));
      while (falta > 0) {
        const i = this.casillas.findIndex(c => !c);
        if (i < 0) { this.desbordado = true; return; }
        const pone = Math.min(falta, tope);
        this.casillas[i] = { id: k, n: pone };
        falta -= pone;
      }
    }
  }

  /** El formato nuevo: cada cosa vuelve a la casilla donde estaba. */
  _reponerGrilla(guardadas) {
    for (let i = 0; i < guardadas.length; i++) {
      const c = guardadas[i];
      if (!c) continue;
      const k = normalizar(c.id);
      const inst = esInstancia(c);
      const n = Math.max(0, Math.floor(Number(c.n) || 0));
      if (!k || (n === 0 && !inst)) continue;
      // Recortar contra el tope de hoy, no contra el del guardado: si un día se
      // cambia el peso de una ficha, una pila vieja no puede quedar por encima
      // de lo que la grilla admite ahora. Una instancia no tiene tope de pila:
      // es una y ocupa un casillero. El de sus usos lo recorta `Equipo`, que es
      // el único que sabe cuánto dura un hacha.
      const cabe = inst
        ? { id: k, n: 1, usos: Number.isFinite(c.usos) ? c.usos : Infinity }
        : { id: k, n: Math.min(n, pilaDe(pesoDe(k))) };
      if (i < this.casillas.length && !this.casillas[i]) {
        this.casillas[i] = cabe;
        continue;
      }
      // La grilla encogió desde el guardado —se perdió el canasto—: lo que no
      // tiene su lugar busca el primer hueco antes de darse por perdido.
      const libre = this.casillas.findIndex(x => !x);
      if (libre < 0) { this.desbordado = true; return; }
      this.casillas[libre] = cabe;
    }
  }

  /**
   * Rehace el caché de totales desde la grilla, que es la única fuente.
   *
   * De paso limpia lo que no debería existir: una casilla en cero o negativa
   * queda en null. Es barato y cierra de una vez la familia de defectos donde la
   * grilla y el resumen dicen cosas distintas.
   */
  _recontar() {
    this._total.clear();
    let kg = 0;
    for (let i = 0; i < this.casillas.length; i++) {
      const c = this.casillas[i];
      if (!c) continue;
      if (!(c.n >= 1)) { this.casillas[i] = null; continue; }
      kg += this._kg(c.id) * c.n;
      // Una instancia NO entra en los totales por recurso, y eso es deliberado:
      // `cantidad`, `listar`, `disponiblePara` y `consumirPara` son el idioma de
      // los materiales fungibles. Si un hacha apareciera ahí, el depósito la
      // guardaría como si fueran «unidades de hacha» —`Construccion.guardarTodo`
      // recorre `listar()` y llama a `quitar(id, n)`— y una receta podría
      // fundirla para pagar un pedido de madera.
      if (esInstancia(c)) continue;
      this._total.set(c.id, (this._total.get(c.id) || 0) + c.n);
    }
    this._kgGrilla = kg;
  }
}
