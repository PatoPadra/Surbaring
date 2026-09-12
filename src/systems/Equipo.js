/**
 * Equipo — lo que el jugador tiene hecho y lo que lleva encima.
 *
 * Hasta acá el juego tenía dos compuertas en veintinueve mil líneas: la
 * herramienta de la cantera —que se satisfacía con un asta suelta en el bolso— y
 * el arco de la caza. Todo lo demás se juntaba a mano limpia desde el primer
 * minuto, así que no había nada que desbloquear: sólo cosas que juntar.
 *
 * Acá vive la otra mitad de la respuesta. El bolso dice qué materiales tenés;
 * esto dice qué podés hacer con las manos que tenés. Son preguntas distintas y
 * antes había una sola.
 *
 * Dos decisiones que valen la pena explicar:
 *
 * 1. **Una herramienta gastada no desaparece.** Llega a cero y queda inservible
 *    hasta repararla por la mitad de los materiales. Un hacha que se evapora es
 *    un contador; una que hay que reafilar es un motivo para volver al
 *    campamento, y eso es lo que mantiene vivo el bucle después del último nivel.
 * 2. **El nivel lo decide lo que está en la mano, no lo que está en el bolso.**
 *    Tener el hacha guardada no sirve: hay que sacarla. Es la diferencia entre
 *    un inventario y un equipo.
 *
 * Y desde la ronda 5, lo que alumbra. La antorcha, el candil y las velas
 * declaraban `luz` y `duracionHoras` y nadie los leía. Ahora se prenden, ocupan
 * la mano y se consumen **contra el reloj del mundo**, no contra el real: una
 * hora y media de antorcha es hora y media de sol que se mueve, se juegue al
 * paso que se juegue.
 *
 * ── Ronda 6, fase 2: se acabó el `Map<id, usos>` ────────────────────────────
 *
 * Hasta acá lo fabricado vivía en un `taller` que era un `Map` de id a usos, y
 * eso tenía dos consecuencias que ya no se sostienen: **no se podían tener dos
 * hachas**, y fabricar la segunda le renovaba los usos a la primera —o sea que
 * la forma barata de reparar un hacha era volver a fabricarla, y encima gratis
 * en casilleros—. Ahora cada cosa fabricada es una **instancia**: `{id, n: 1,
 * usos}`. Dos hachas son dos instancias con durabilidades propias, y gastar la
 * de la mano no toca la del bolso.
 *
 * Dónde viven, que es lo que hace que la cuenta cierre:
 *
 * - **Lo puesto vive en la ranura**, en `puesto[ranura]`, y no ocupa casillero.
 *   Sí pesa: lo estás cargando igual. Eso es exactamente lo que hace que valga
 *   la pena tener el hacha en la mano y no en el bolso.
 * - **Lo demás vive en la grilla del inventario**, un casillero por instancia,
 *   compitiendo por lugar con la leña y los frutos. Salir con doce herramientas
 *   cuesta lugar de carga, y eso es la regla del juego, no un defecto: se midió,
 *   y con nueve encima se ahoga una carga de cada cien.
 *
 * `Equipo` no guarda ninguna lista propia de lo fabricado: la fuente es la
 * grilla más las cuatro ranuras. Un espejo aparte se desincronizaría, y el
 * síntoma sería el peor de todos —tener un hacha que el bolso no muestra o
 * mostrar una que ya no está—.
 */

import { nombreDe } from './Recursos.js';
import { esInstancia } from './Inventario.js';

const RANURAS = ['mano', 'arma', 'abrigo', 'espalda'];

const MS_POR_HORA = 3600000;

/**
 * Qué luces se apagan con lluvia fuerte, y desde qué lluvia.
 *
 * La ficha de la antorcha lo dice —«se apaga con lluvia fuerte»— y lo que dice
 * una ficha, pasa. El candil y la vela no lo declaran: el candil es luz de
 * adentro y la vela se lleva tapada con la mano. 0,6 es el umbral a partir del
 * cual `Clima` dibuja un aguacero y no una llovizna.
 */
const APAGA_CON_LLUVIA = { antorcha: 0.6 };

export class Equipo {
  /**
   * @param {object} datos herramientas.json
   * @param {{inventario: import('./Inventario.js').Inventario}} deps
   */
  constructor(datos, { inventario }) {
    this.datos = datos;
    this.inventario = inventario;
    this.porId = new Map((datos.objetos || []).map(o => [o.id, o]));
    this.accionPorId = new Map((datos.acciones || []).map(a => [a.id, a]));

    /** @type {Record<string, null|{id:string, n:number, usos:number}>} ranura -> instancia puesta */
    this.puesto = Object.fromEntries(RANURAS.map(r => [r, null]));
    this.alCambiar = null;

    // El inventario no sabe qué es una herramienta y no tiene por qué
    // aprenderlo, pero tiene que poder pesar una: el único que tiene
    // `herramientas.json` en la mano es este archivo, así que se lo pasa él.
    // Hacerlo acá y no en `main.js` es lo que deja esta fase sin cableado.
    this.inventario?.fichar?.(new Map(
      [...this.porId].map(([id, o]) => [id, { kg: Number.isFinite(o.kg) ? o.kg : 0 }])));
    // Y lo puesto pesa aunque no ocupe casillero. Va como función y no como
    // número para que no exista el instante en que el bolso pesa lo de antes.
    if (this.inventario) this.inventario.pesoAparte = () => this.pesoPuesto();

    /**
     * La llama encendida, o null. `hasta` y `desde` son milisegundos del reloj
     * del mundo; `mano` es **la instancia** que estaba en la mano al prenderla,
     * y si eso cambia la llama se apaga. Es la instancia y no el id a propósito:
     * cambiar una antorcha por otra antorcha también apaga, porque la que ardía
     * ya no es la que está en la mano.
     * @type {null|{id:string, desde:number, hasta:number, mano:object|null, receta:boolean}}
     */
    this._llama = null;
    /**
     * Lo que le quedaba a cada luz reutilizable cuando se apagó antes de
     * consumirse, en ms del mundo. Sin esto, prender y apagar daba hora y media
     * nueva cada vez: la antorcha era eterna y la ficha mentía.
     *
     * Sigue estando por id y no por instancia, y es la costura que dejó esta
     * fase: dos antorchas comparten el sobrante. Se prefiere así antes que
     * meterle un campo más al guardado, que es lo que obligaría a subir
     * `VERSION` y a descartarle la partida a todo el mundo.
     * @type {Record<string, number>}
     */
    this._resto = {};
    /** La última fecha del mundo que se vio, para apagar sin que la pasen. */
    this._fecha = null;
    /**
     * Se llama cuando una llama se apaga sola —se consumió, la apagó la lluvia o
     * cambió lo que había en la mano— con `{id, motivo, titulo, detalle}`, para
     * que quien tenga un HUD lo diga. Apagarla a mano no avisa: ya lo sabe.
     */
    this.alApagarse = null;
  }

  definicion(id) { return this.porId.get(id) || null; }

  // ── Las instancias, que son la fuente ─────────────────────────────────────

  /**
   * Todo lo que se tiene, esté puesto o en el bolso. Es la única fuente: no hay
   * lista espejo que se pueda desincronizar.
   * @returns {Generator<{cosa: object, ranura: string|null, i: number}>}
   */
  *todas() {
    for (const r of RANURAS) {
      if (this.puesto[r]) yield { cosa: this.puesto[r], ranura: r, i: -1 };
    }
    const g = this.inventario?.casillas || [];
    for (let i = 0; i < g.length; i++) {
      if (esInstancia(g[i])) yield { cosa: g[i], ranura: null, i };
    }
  }

  /** Una instancia nueva, con la durabilidad entera de su ficha. */
  _nueva(id) {
    const def = this.definicion(id);
    return { id, n: 1, usos: def?.durabilidad ?? Infinity };
  }

  /** Cuánto pesa lo que se lleva puesto. Lo lee el inventario por `pesoAparte`. */
  pesoPuesto() {
    let kg = 0;
    for (const r of RANURAS) {
      const it = this.puesto[r];
      if (!it) continue;
      const o = this.porId.get(it.id);
      kg += Number.isFinite(o?.kg) ? o.kg : 0;
    }
    return kg;
  }

  /** ¿Está fabricado? Gastado cuenta como tenido: sigue existiendo. */
  tiene(id) {
    for (const { cosa } of this.todas()) if (cosa.id === id) return true;
    return false;
  }

  /**
   * Los usos de la mejor que tengas de ese id.
   *
   * Es la lectura por id que le quedó al resto del sistema, y con instancias hay
   * que elegir cuál contesta. Contesta la mejor porque la pregunta detrás casi
   * siempre es «¿me sirve para algo?»: con un hacha rota y una sana, la
   * respuesta honesta es la sana.
   */
  usosDe(id) {
    let mejor = null;
    for (const { cosa } of this.todas()) {
      if (cosa.id !== id) continue;
      mejor = mejor === null ? cosa.usos : Math.max(mejor, cosa.usos);
    }
    return mejor ?? 0;
  }

  /** Lo tenés y no te queda ninguna sana. */
  gastado(id) { return this.tiene(id) && !(this.usosDe(id) > 0); }

  /** La instancia de ese id que está mejor, en la grilla. */
  _mejorCasilla(id) {
    let mejor = -1, usos = -Infinity;
    for (const { cosa, i } of this.todas()) {
      if (i < 0 || cosa.id !== id) continue;
      if (cosa.usos > usos) { usos = cosa.usos; mejor = i; }
    }
    return mejor;
  }

  /** La que está peor, que es la que uno quiere reparar. */
  _masGastada(id) {
    let mejor = null;
    for (const { cosa } of this.todas()) {
      if (cosa.id !== id) continue;
      if (!mejor || cosa.usos < mejor.usos) mejor = cosa;
    }
    return mejor;
  }

  /**
   * ¿Hay dónde poner una recién fabricada: su ranura libre, o un casillero?
   *
   * Lo pregunta `Fabricacion` **antes** de consumir los materiales. Hasta esta
   * fase llamaba a `guardar()` sin mirar nada, y como el taller era un `Map` no
   * había forma de que fallara: ahora sí la hay, y quedarse sin materiales y sin
   * objeto sería robarle al jugador.
   */
  hayLugarPara(id) {
    const def = this.definicion(id);
    if (!def) return false;
    if (this._ranuraLibre(def)) return true;
    return !!this.inventario?.casillas?.some(c => !c);
  }

  /** Con una vela prendida la mano está ocupada aunque la ranura diga que no. */
  _ranuraLibre(def) {
    if (!def?.ranura || this.puesto[def.ranura]) return false;
    return !(def.ranura === 'mano' && this._llama);
  }

  /**
   * Lo acaba de fabricar. **Fabricar un hacha teniendo un hacha da dos hachas**:
   * ya no le renueva los usos a la que estaba.
   *
   * Va a su ranura si está libre —sacar lo recién hecho es lo que uno espera— y
   * si no, al bolso. Sin ranura y sin casillero devuelve false y no se fabricó
   * nada; el que llama tiene que avisar.
   */
  guardar(id) {
    const def = this.definicion(id);
    if (!def) return false;
    const cosa = this._nueva(id);

    if (this._ranuraLibre(def)) {
      this.puesto[def.ranura] = cosa;
      this._revisarMano();
    } else if (!this.inventario?.meter?.(cosa)) {
      return false;
    }
    // Una antorcha nueva arde entera, no lo que le quedaba a la vieja
    delete this._resto[id];
    this.alCambiar?.();
    return true;
  }

  /**
   * Saca algo del bolso y lo pone en su ranura. Acepta el id —y entonces elige
   * la que esté mejor: con un hacha al 40 % y otra al 90 %, «el hacha» es la
   * buena— o la instancia exacta, que es lo que manda el bolso cuando el jugador
   * apunta a un casillero.
   *
   * Lo que salía de la ranura cae **en el casillero que la que entra deja
   * libre**, así que cambiar de hacha no le reordena la grilla a nadie.
   */
  equipar(ref) {
    const inv = this.inventario;
    let cosa = null, i = -1;

    if (typeof ref === 'string') {
      const def0 = this.definicion(ref);
      if (!def0?.ranura) return false;
      if (this.puesto[def0.ranura]?.id === ref) return true;   // ya la tenés puesta
      i = this._mejorCasilla(ref);
      if (i < 0) return false;
      cosa = inv.casillas[i];
    } else {
      cosa = ref;
      if (!esInstancia(cosa)) return false;
      i = inv ? inv.casillas.indexOf(cosa) : -1;
      // No está en la grilla: o ya está puesta, o es una instancia huérfana que
      // no salió de este equipo y no se va a inventar de dónde.
      if (i < 0) return this.puesto[this.definicion(cosa.id)?.ranura] === cosa;
    }

    const def = this.definicion(cosa.id);
    if (!def?.ranura) return false;
    const anterior = this.puesto[def.ranura];

    inv.sacar(i);
    this.puesto[def.ranura] = cosa;
    if (anterior) inv.meterEn(i, anterior);

    this._revisarMano();
    this.alCambiar?.();
    return true;
  }

  /**
   * Devuelve al bolso lo que estaba puesto.
   *
   * **Falla limpio si no hay casillero libre**: devuelve false, la cosa se queda
   * puesta y el peso no se mueve. La alternativa —dejar la ranura vacía y perder
   * la instancia— es la manera silenciosa de que a alguien se le evapore el
   * hacha con la que venía cortando hace dos horas.
   */
  desequipar(ranura) {
    const cosa = this.puesto[ranura];
    if (!cosa) return false;
    // La ranura se vacía ANTES de meterla al bolso, y se deshace si no entra:
    // `meter()` avisa apenas la deja en el casillero, y si en ese instante la
    // ranura todavía la tuviera, el peso la contaría dos veces.
    this.puesto[ranura] = null;
    if (!this.inventario?.meter?.(cosa)) { this.puesto[ranura] = cosa; return false; }
    this._revisarMano();
    this.alCambiar?.();
    return true;
  }

  /**
   * Lo puesto en una ranura, o null.
   *
   * Devuelve una **vista** —la ficha más los usos de la instancia— y no la ficha
   * cruda, porque `main.js`, `Cuerpo.js`, `Caza.js` y `Recoleccion.js` leen de
   * acá `.id`, `.nombre`, `.alcanceM`, `.municion`… y desde esta fase también
   * `.usos`, que es de la instancia. Colgarle los usos a la ficha del catálogo
   * haría que las dos hachas volvieran a compartir durabilidad, que es
   * exactamente el defecto que se vino a cerrar.
   */
  enRanura(ranura) {
    const cosa = this.puesto[ranura];
    const def = cosa && this.definicion(cosa.id);
    if (!def) return null;
    return {
      ...def,
      usos: cosa.usos,
      tope: def.durabilidad ?? Infinity,
      gastado: !(cosa.usos > 0),
      instancia: cosa,
    };
  }

  /**
   * El nivel de herramienta con el que se está trabajando ahora mismo.
   *
   * Una herramienta gastada no da nivel: está, pero no corta.
   */
  get nivel() {
    const cosa = this.puesto.mano;
    if (!cosa || !(cosa.usos > 0)) return 0;
    const def = this.definicion(cosa.id);
    // Una luz en la mano no es un filo. El candil declara nivel 3 porque es el
    // escalón del árbol donde se aprende, y con él en la mano el bolso decía
    // «trabajás en nivel 3» sin poder cortar nada.
    if (def?.efecto?.luz) return 0;
    return def?.nivel ?? 0;
  }

  /**
   * ¿Se puede hacer esta acción con lo que hay en la mano?
   *
   * Se pregunta por la lista `habilita` del objeto y no sólo por el nivel,
   * porque el nivel es un resumen y la lista es el dato: el hacha es nivel 2 y
   * no descuera, la lasca es nivel 1 y sí.
   */
  puede(accionId) {
    const cosa = this.puesto.mano;
    if (!cosa || !(cosa.usos > 0)) return false;
    return (this.definicion(cosa.id)?.habilita || []).includes(accionId);
  }

  /**
   * De todo lo que se tiene y está sano, ¿qué serviría para esta acción?
   *
   * Es para el aviso: «tenés el hacha, sacala» es una ayuda; «no podés» a secas,
   * cuando el hacha está en el bolso, es una mentira por omisión.
   */
  mejorPara(accionId) {
    let mejor = null;
    for (const { cosa } of this.todas()) {
      if (!(cosa.usos > 0)) continue;
      const def = this.definicion(cosa.id);
      if (!def || !(def.habilita || []).includes(accionId)) continue;
      if (!mejor || (def.nivel ?? 0) > (mejor.nivel ?? 0)) mejor = def;
    }
    return mejor;
  }

  /** Qué falta para una acción: nada, sacar algo que ya tenés, o fabricarlo. */
  faltaPara(accionId) {
    if (this.puede(accionId)) return null;
    const guardada = this.mejorPara(accionId);
    if (guardada) return { motivo: 'no_equipada', objeto: guardada };
    const accion = this.accionPorId.get(accionId);
    return { motivo: 'no_fabricada', accion, nivel: accion?.nivelMinimo ?? 0 };
  }

  /**
   * Gasta un uso de **la instancia que está en la mano**, no «del hacha»: la que
   * quedó en el bolso no se entera. Devuelve true si se acaba de romper, para
   * que quien llame avise una sola vez y no en cada golpe.
   */
  desgastar(cuanto = 1) {
    const cosa = this.puesto.mano;
    if (!cosa) return false;
    // Una luz no se gasta a golpes: se consume con el reloj, en `luzActiva()`.
    // Hace falta decirlo porque `Caza._tiro()` desgasta lo que hay en la MANO al
    // tirar con el ARMA, y una antorcha de un solo uso quedaba gastada ardiendo
    // al primer flechazo.
    if (this.definicion(cosa.id)?.efecto?.luz) return false;
    if (!Number.isFinite(cosa.usos) || cosa.usos <= 0) return false;
    cosa.usos = Math.max(0, cosa.usos - cuanto);
    this.alCambiar?.();
    return cosa.usos === 0;
  }

  /** Lo que cuesta reparar: la mitad de los materiales, para arriba. */
  costoReparar(id) {
    const def = this.definicion(id);
    if (!def) return [];
    return (def.materiales || []).map(m => ({
      recurso: m.recurso, cantidad: Math.ceil(m.cantidad / 2),
    }));
  }

  /**
   * Repara **una instancia**. Con el id repara la que esté peor, que es la que
   * uno quiere arreglar; el bolso manda la instancia exacta cuando el jugador
   * apunta a un casillero.
   */
  reparar(ref) {
    const cosa = typeof ref === 'string' ? this._masGastada(ref) : ref;
    const def = cosa && this.definicion(cosa.id);
    if (!def) return false;
    const costo = this.costoReparar(cosa.id);
    if (costo.some(m => this.inventario.disponiblePara(m.recurso) < m.cantidad)) return false;
    for (const m of costo) this.inventario.consumirPara(m.recurso, m.cantidad);
    cosa.usos = def.durabilidad ?? Infinity;
    delete this._resto[cosa.id];
    this.alCambiar?.();
    return true;
  }

  // ── Luz ───────────────────────────────────────────────────────────────────

  /** El id de lo que está encendido, o null. No cobra ni apaga: sólo mira. */
  get encendida() { return this._llama?.id ?? null; }

  /**
   * Prende una luz: `antorcha`, `candil_grasa` o `velas_cera`.
   *
   * La antorcha y el candil tienen que estar hechos y sanos, y quedan en la
   * mano. Las velas son una receta —salen de a cuatro al bolso— así que prender
   * una gasta una `vela`; también ocupa la mano, que queda vacía de
   * herramienta: con una vela en la mano no se hachea.
   *
   * Una antorcha o un candil apagados antes de tiempo vuelven a arder lo que
   * les quedaba, no la duración entera.
   *
   * @param {string} id
   * @param {number} fechaMs milisegundos del reloj del mundo
   * @returns {{ok:boolean, motivo:string|null}}
   */
  encender(id, fechaMs) {
    const def = this.definicion(id);
    const radio = def?.efecto?.luz;
    const horas = def?.efecto?.duracionHoras;
    if (!def || !(radio > 0) || !(horas > 0)) {
      return { ok: false, motivo: `${def?.nombre || id} no da luz.` };
    }
    if (!Number.isFinite(fechaMs)) {
      return { ok: false, motivo: 'Sin la hora del mundo no se puede medir cuánto dura.' };
    }
    const nombre = def.nombre.toLowerCase();
    const receta = Array.isArray(def.produce) && def.produce.length > 0;
    const recurso = receta ? def.produce[0].recurso : null;

    // Una llama vencida se cobra ANTES de mirar si lo pedido está sano: si no,
    // volver a prender la misma antorcha pasaba la revisión con su último uso y
    // quedaba gastada recién después, ya encendida.
    if (this._vencida(fechaMs)) this._terminar(fechaMs, 'consumida');
    if (this._llama?.id === id) {
      return { ok: true, motivo: `Ya tenés ${nombre} encendida.` };
    }

    if (receta) {
      if (this.inventario.cantidad(recurso) < 1) {
        return { ok: false, motivo: `No te queda ninguna ${nombreDe(recurso).toLowerCase()} en el bolso.` };
      }
      // La vela ocupa la mano, así que lo que hubiera ahí se va al bolso. Se
      // mira ANTES de apagar lo que estuviera ardiendo: si se mirara después,
      // un «no hay lugar» dejaría al jugador a oscuras y sin vela nueva.
      if (this.puesto.mano && this.inventario.sinCasillas) {
        return { ok: false, motivo: `No te queda casillero para guardar ${this.definicion(this.puesto.mano.id)?.nombre?.toLowerCase() || 'lo que tenés en la mano'}.` };
      }
    }

    // La que se prende es la que está en la mano si ya está ahí, y si no la
    // mejor del bolso: prender la antorcha gastada teniendo una entera al lado
    // sería obedecer al id en vez de al jugador.
    let cosa = null;
    if (!receta) {
      if ((def.ranura ?? 'mano') !== 'mano') {
        return { ok: false, motivo: `${def.nombre} no se lleva en la mano.` };
      }
      cosa = this.puesto.mano?.id === id
        ? this.puesto.mano
        : (this.inventario?.casillas || [])[this._mejorCasilla(id)] || null;
      if (!cosa) {
        return { ok: false, motivo: `Todavía no tenés ${nombre}: se arma en el bolso.` };
      }
      if (!(cosa.usos > 0)) {
        return { ok: false, motivo: `${def.nombre}: ya se consumió. Se repara en el bolso.` };
      }
    }

    // Lo que estuviera ardiendo se apaga primero, guardando lo que le quedaba.
    // Va ANTES de tocar la mano y no después: si se cambiara la mano primero,
    // `_revisarMano()` apagaría la anterior por «se te cayó» y le avisaría al
    // jugador de un accidente que no ocurrió.
    if (this._llama) this._terminar(fechaMs, 'otra');
    // La vela deja la mano libre de verdad: la herramienta vuelve al bolso, no
    // se evapora. Con el `Map` viejo bastaba con olvidarse del id.
    if (receta && this.puesto.mano) this.desequipar('mano');
    // Y la antorcha del bolso pasa a la mano, dejando en su casillero lo que
    // salga: sacarla no puede costar un casillero que no hay.
    if (cosa && this.puesto.mano !== cosa) this.equipar(cosa);

    let dur = horas * MS_POR_HORA;
    if (!receta && this._resto[id] > 0) dur = Math.min(dur, this._resto[id]);
    delete this._resto[id];
    if (receta) this.inventario.quitar(recurso, 1);

    this._llama = { id, desde: fechaMs, hasta: fechaMs + dur, mano: this.puesto.mano, receta };
    this._fecha = fechaMs;
    this.alCambiar?.();
    return { ok: true, motivo: null };
  }

  /** Apaga lo que esté encendido. Lo que le quedaba a una antorcha o a un candil se guarda. */
  apagar(fechaMs) {
    if (!this._llama) return false;
    this._terminar(Number.isFinite(fechaMs) ? fechaMs : this._fecha, 'apagada');
    this.alCambiar?.();
    return true;
  }

  /**
   * La luz que se lleva, o null. Es también el reloj de la llama: se llama una
   * vez por cuadro y es acá donde se consume.
   *
   * Pasada la duración devuelve null y cobra: la antorcha queda gastada (su
   * durabilidad es 1), el candil pierde un uso de sus cuarenta, la vela ya se
   * había cobrado al prenderla. Con `est.lluvia` de aguacero la antorcha se
   * apaga, y lo que le quedaba se guarda para cuando pare.
   *
   * @param {number} fechaMs milisegundos del reloj del mundo
   * @param {object} [est] el estado del ambiente, por la lluvia
   * @returns {null|{id:string, radio:number, horasRestantes:number}}
   */
  luzActiva(fechaMs, est) {
    const l = this._llama;
    const ahora = Number.isFinite(fechaMs) ? fechaMs : this._fecha;
    if (Number.isFinite(ahora)) this._fecha = ahora;
    if (!l) return null;

    if (this._vencida(ahora)) {
      this._terminar(ahora, 'consumida');
      this.alCambiar?.();
      return null;
    }
    if (this.puesto.mano !== l.mano) {
      this._terminar(ahora, 'mano');
      this.alCambiar?.();
      return null;
    }
    const umbral = APAGA_CON_LLUVIA[l.id];
    if (umbral != null && (est?.lluvia ?? 0) >= umbral) {
      this._terminar(ahora, 'lluvia');
      this.alCambiar?.();
      return null;
    }

    const def = this.definicion(l.id);
    return {
      id: l.id,
      radio: def?.efecto?.luz ?? 0,
      horasRestantes: Number.isFinite(ahora) ? Math.max(0, (l.hasta - ahora) / MS_POR_HORA) : 0,
    };
  }

  _vencida(ahora) {
    return !!this._llama && Number.isFinite(ahora) && ahora >= this._llama.hasta;
  }

  /** Si lo que está en la mano ya no es lo que sostenía la llama, se apaga. */
  _revisarMano() {
    if (this._llama && this.puesto.mano !== this._llama.mano) this._terminar(this._fecha, 'mano');
  }

  /**
   * Apaga la llama y decide qué se cobra.
   *
   * Si ya no le quedaba nada, se consumió y se cobra, no importa por qué se
   * esté apagando: si no, cambiar de mano justo antes del final daba una
   * antorcha nueva gratis. Si le quedaba, una antorcha o un candil lo guardan;
   * una vela no, porque se cobró entera al prenderla.
   *
   * El uso se le cobra a **la instancia que ardía**, que se guardó en la llama:
   * si se cobrara por id, prender la antorcha buena y dejarla consumirse podría
   * gastarle el uso a la otra.
   */
  _terminar(ahora, motivo) {
    const l = this._llama;
    if (!l) return;
    this._llama = null;
    const def = this.definicion(l.id);
    const cosa = l.mano;
    const resto = Number.isFinite(ahora) ? l.hasta - Math.max(ahora, l.desde) : l.hasta - l.desde;

    if (resto <= 0) {
      motivo = 'consumida';
      delete this._resto[l.id];
      if (!l.receta && cosa && Number.isFinite(cosa.usos) && cosa.usos > 0) cosa.usos -= 1;
    } else if (!l.receta) {
      this._resto[l.id] = resto;
    }

    if (motivo === 'apagada' || motivo === 'otra') return;
    const nombre = def?.nombre || l.id;
    let titulo, detalle;
    if (motivo === 'consumida') {
      if (l.receta) {
        titulo = 'Se consumió la vela';
        const quedan = this.inventario.cantidad(def?.produce?.[0]?.recurso);
        detalle = quedan ? `Te quedan ${quedan} en el bolso.` : 'No te quedan más.';
      } else if (cosa && !(cosa.usos > 0)) {
        titulo = `${nombre}: se consumió`;
        detalle = `Se repara en el bolso con ${this.costoReparar(l.id)
          .map(m => `${m.cantidad} × ${nombreDe(m.recurso).toLowerCase()}`).join(' · ')}.`;
      } else {
        titulo = `${nombre}: se acabó la carga`;
        detalle = `Le quedan ${cosa?.usos ?? 0} usos. Se vuelve a prender desde el bolso.`;
      }
    } else if (motivo === 'lluvia') {
      titulo = `${nombre}: la apagó la lluvia`;
      detalle = `Le quedan ${(resto / MS_POR_HORA).toFixed(1).replace('.', ',')} h para cuando pare.`;
    } else {
      titulo = `${nombre}: se apagó`;
      detalle = l.receta
        ? 'Soltaste la vela para agarrar otra cosa, y una vela a medias no se guarda.'
        : `Le quedan ${(resto / MS_POR_HORA).toFixed(1).replace('.', ',')} h para la próxima.`;
    }
    this.alApagarse?.({ id: l.id, motivo, titulo, detalle });
  }

  // ── Guardado ──────────────────────────────────────────────────────────────

  /**
   * Todo lo que hace falta para rearmar el equipo, en datos planos.
   *
   * **Lo que está en el bolso no se guarda acá**: vive en la grilla y lo guarda
   * `Inventario.serializar()`, casilla por casilla y con sus usos. Duplicarlo
   * sería el defecto clásico de dos fuentes: al cargar aparecerían dos hachas
   * donde había una.
   *
   * Ya no hay campo `taller`, y su ausencia es justamente lo que distingue un
   * guardado nuevo de uno viejo al reponer. Los usos infinitos van como null:
   * `JSON.stringify(Infinity)` también da null, y es mejor que la conversión se
   * vea acá que descubrirla al cargar.
   */
  serializar() {
    const l = this._llama;
    return {
      puesto: Object.fromEntries(RANURAS.map(r => {
        const c = this.puesto[r];
        return [r, c ? { id: c.id, usos: Number.isFinite(c.usos) ? c.usos : null } : null];
      })),
      llama: l ? { id: l.id, desde: l.desde, hasta: l.hasta, mano: l.mano?.id ?? null } : null,
      resto: { ...this._resto },
    };
  }

  /**
   * Repone lo que devolvió `serializar()`, **y también el formato viejo**.
   *
   * Un guardado de la ronda 5 trae `taller: [['lasca', 31]]` y `puesto: {mano:
   * 'lasca'}`: eso llega como una instancia de 31 usos puesta en la mano, y lo
   * que estaba en el taller sin estar puesto cae en un casillero con sus usos.
   * Los dos formatos se reconocen solos —el viejo tiene `taller`— así que
   * `VERSION` sigue en 1 y nadie pierde la partida por una fase de mejoras.
   *
   * Tiene que llamarse con el reloj del mundo y **la grilla** ya repuestos:
   * `hasta` es una fecha de ese reloj, y las instancias del bolso vienen del
   * inventario, que `Partida.cargar()` repone veinticinco líneas antes.
   *
   * @returns {boolean} false si no había nada que reponer
   */
  reponer(datos) {
    if (!datos || typeof datos !== 'object') return false;

    for (const r of RANURAS) this.puesto[r] = null;
    this._llama = null;
    this._sanearGrilla();

    if (Array.isArray(datos.taller)) this._migrarTaller(datos.taller, datos.puesto);
    else this._reponerPuesto(datos.puesto);

    this._resto = {};
    for (const [id, ms] of Object.entries(datos.resto || {})) {
      if (this.definicion(id) && Number.isFinite(ms) && ms > 0) this._resto[id] = ms;
    }

    const l = datos.llama;
    const def = l ? this.definicion(l.id) : null;
    if (def?.efecto?.luz && Number.isFinite(l.hasta)) {
      const receta = Array.isArray(def.produce) && def.produce.length > 0;
      this._llama = {
        id: l.id,
        desde: Number.isFinite(l.desde) ? l.desde : l.hasta - def.efecto.duracionHoras * MS_POR_HORA,
        hasta: l.hasta,
        // La llama se ata a la instancia que quedó en la mano, sea cual sea: el
        // id guardado ya no alcanza para señalar a una de dos antorchas. Si no
        // hay nada en la mano, el primer `luzActiva()` la apaga, que es lo
        // correcto: una antorcha que no se sostiene no alumbra.
        mano: receta ? null : this.puesto.mano,
        receta,
      };
    }
    this.alCambiar?.();
    return true;
  }

  /**
   * Le pasa el cepillo a las instancias que ya estaban en la grilla al cargar.
   *
   * Lo que el dataset ya no conoce se descarta en silencio —igual que hace
   * `Partida` con las obras— y unos usos por encima del tope de hoy se recortan:
   * si un día se le baja la durabilidad a la lasca, una guardada con los 40 de
   * antes no puede quedar mejor que una recién hecha.
   */
  _sanearGrilla() {
    const inv = this.inventario;
    if (!inv?.casillas) return;
    let toco = false;
    for (let i = 0; i < inv.casillas.length; i++) {
      const c = inv.casillas[i];
      if (!esInstancia(c)) continue;
      const def = this.definicion(c.id);
      if (!def) { inv.casillas[i] = null; toco = true; continue; }
      const tope = def.durabilidad ?? Infinity;
      c.n = 1;
      c.usos = Number.isFinite(c.usos) ? Math.max(0, Math.min(c.usos, tope)) : tope;
    }
    if (toco) inv.recontar?.();
  }

  /**
   * El formato de antes de la fase 2: un `taller` de pares id/usos y un `puesto`
   * de ids sueltos. Cada par se vuelve una instancia; la que el guardado decía
   * puesta va a su ranura y el resto al bolso.
   *
   * Si no entra todo se prende `desbordado` en el inventario, que es lo que el
   * bolso ya sabe mostrar: perder cosas es aceptable, perderlas en silencio no.
   */
  _migrarTaller(pares, puesto) {
    for (const par of pares) {
      const [id, usos] = Array.isArray(par) ? par : [];
      const def = this.definicion(id);
      if (!def) continue;
      const tope = def.durabilidad ?? Infinity;
      const cosa = {
        id, n: 1,
        usos: Number.isFinite(usos) ? Math.max(0, Math.min(usos, tope)) : tope,
      };
      const r = def.ranura;
      if (r && puesto?.[r] === id && !this.puesto[r]) this.puesto[r] = cosa;
      else if (!this.inventario?.meter?.(cosa) && this.inventario) this.inventario.desbordado = true;
    }
  }

  /** El formato nuevo: sólo las cuatro ranuras, con los usos de cada instancia. */
  _reponerPuesto(puesto) {
    for (const r of RANURAS) {
      const g = puesto?.[r];
      if (!g) continue;
      // Un guardado intermedio podría traer el id suelto: se acepta, con la
      // durabilidad entera, antes que descartarle la herramienta a alguien.
      const id = typeof g === 'string' ? g : g.id;
      const def = this.definicion(id);
      if (!def || def.ranura !== r) continue;
      const tope = def.durabilidad ?? Infinity;
      const usos = typeof g === 'string' ? tope
        : (Number.isFinite(g.usos) ? Math.max(0, Math.min(g.usos, tope)) : tope);
      this.puesto[r] = { id, n: 1, usos };
    }
  }

  /**
   * Suma de un efecto numérico entre lo que se lleva puesto.
   *
   * Mismo contrato que `Saberes.suma()` a propósito: `main.js` ya suma el abrigo
   * y la capacidad de esa forma, así que esto entra sin inventar una convención
   * nueva.
   */
  suma(clave) {
    let n = 0;
    for (const ranura of RANURAS) {
      const cosa = this.puesto[ranura];
      if (!cosa || !(cosa.usos > 0)) continue;
      n += this.definicion(cosa.id)?.efecto?.[clave] || 0;
    }
    return n;
  }

  /**
   * Todo lo que se tiene, para dibujar: **un renglón por instancia**, no por id.
   *
   * Dos hachas son dos renglones con durabilidades distintas, y `puesto` dice
   * cuál está en la mano. `casilla` es dónde vive la que no está puesta, para
   * que el bolso pueda mandar la instancia exacta al equipar o al reparar en vez
   * de un id que ya no señala a una sola cosa.
   */
  listar() {
    const sale = [];
    for (const { cosa, ranura, i } of this.todas()) {
      const def = this.definicion(cosa.id);
      sale.push({
        id: cosa.id, nombre: def?.nombre || cosa.id, nivel: def?.nivel ?? 0,
        categoria: def?.categoria, ranura: def?.ranura || null,
        usos: cosa.usos, tope: def?.durabilidad ?? Infinity,
        gastado: !(cosa.usos > 0),
        puesto: ranura !== null,
        casilla: i,
        instancia: cosa,
      });
    }
    // El último criterio desempata dos instancias del mismo objeto por
    // durabilidad, con `||0` porque `Infinity - Infinity` da NaN y un
    // comparador que devuelve NaN deja el orden a merced del motor.
    return sale.sort((a, b) =>
      a.nivel - b.nivel || a.nombre.localeCompare(b.nombre) || ((b.usos - a.usos) || 0));
  }
}
