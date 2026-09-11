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
 */

import { nombreDe } from './Recursos.js';

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

    /** @type {Map<string, number>} objeto fabricado -> usos que le quedan */
    this.taller = new Map();
    /** @type {Record<string, string|null>} ranura -> id del objeto puesto */
    this.puesto = Object.fromEntries(RANURAS.map(r => [r, null]));
    this.alCambiar = null;

    /**
     * La llama encendida, o null. `hasta` y `desde` son milisegundos del reloj
     * del mundo; `mano` es lo que estaba en la mano al prenderla, y si eso
     * cambia la llama se apaga.
     * @type {null|{id:string, desde:number, hasta:number, mano:string|null, receta:boolean}}
     */
    this._llama = null;
    /**
     * Lo que le quedaba a cada luz reutilizable cuando se apagó antes de
     * consumirse, en ms del mundo. Sin esto, prender y apagar daba hora y media
     * nueva cada vez: la antorcha era eterna y la ficha mentía.
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

  /** ¿Está fabricado? Gastado cuenta como tenido: sigue existiendo. */
  tiene(id) { return this.taller.has(id); }

  gastado(id) { return this.taller.has(id) && this.taller.get(id) <= 0; }

  usosDe(id) { return this.taller.get(id) ?? 0; }

  /** Lo acaba de fabricar. Si ya tenía uno, le renueva los usos. */
  guardar(id) {
    const def = this.definicion(id);
    if (!def) return false;
    this.taller.set(id, def.durabilidad ?? Infinity);
    // Una antorcha nueva arde entera, no lo que le quedaba a la vieja
    delete this._resto[id];
    // Con una vela prendida la mano está ocupada aunque la ranura diga que no:
    // sacar solo el hacha recién hecha la apagaría sin que nadie lo pidiera.
    const manoOcupada = def.ranura === 'mano' && this._llama;
    if (def.ranura && !this.puesto[def.ranura] && !manoOcupada) this.equipar(id);
    this.alCambiar?.();
    return true;
  }

  equipar(id) {
    const def = this.definicion(id);
    if (!def?.ranura || !this.tiene(id)) return false;
    this.puesto[def.ranura] = id;
    this._revisarMano();
    this.alCambiar?.();
    return true;
  }

  desequipar(ranura) {
    if (!this.puesto[ranura]) return false;
    this.puesto[ranura] = null;
    this._revisarMano();
    this.alCambiar?.();
    return true;
  }

  /** El objeto puesto en una ranura, o null. */
  enRanura(ranura) {
    const id = this.puesto[ranura];
    return id ? this.definicion(id) : null;
  }

  /**
   * El nivel de herramienta con el que se está trabajando ahora mismo.
   *
   * Una herramienta gastada no da nivel: está, pero no corta.
   */
  get nivel() {
    const id = this.puesto.mano;
    if (!id || this.gastado(id)) return 0;
    const def = this.definicion(id);
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
    const id = this.puesto.mano;
    if (!id || this.gastado(id)) return false;
    return (this.definicion(id)?.habilita || []).includes(accionId);
  }

  /**
   * De todo lo fabricado y sano, ¿qué serviría para esta acción?
   *
   * Es para el aviso: «tenés el hacha, sacala» es una ayuda; «no podés» a secas,
   * cuando el hacha está en el bolso, es una mentira por omisión.
   */
  mejorPara(accionId) {
    let mejor = null;
    for (const [id, usos] of this.taller) {
      if (usos <= 0) continue;
      const def = this.definicion(id);
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
   * Gasta un uso de lo que está en la mano. Devuelve true si se acaba de romper,
   * para que quien llame avise una sola vez y no en cada golpe.
   */
  desgastar(cuanto = 1) {
    const id = this.puesto.mano;
    if (!id) return false;
    // Una luz no se gasta a golpes: se consume con el reloj, en `luzActiva()`.
    // Hace falta decirlo porque `Caza._tiro()` desgasta lo que hay en la MANO al
    // tirar con el ARMA, y una antorcha de un solo uso quedaba gastada ardiendo
    // al primer flechazo.
    if (this.definicion(id)?.efecto?.luz) return false;
    const antes = this.taller.get(id);
    if (antes == null || antes === Infinity || antes <= 0) return false;
    const ahora = Math.max(0, antes - cuanto);
    this.taller.set(id, ahora);
    this.alCambiar?.();
    return ahora === 0;
  }

  /** Lo que cuesta reparar: la mitad de los materiales, para arriba. */
  costoReparar(id) {
    const def = this.definicion(id);
    if (!def) return [];
    return (def.materiales || []).map(m => ({
      recurso: m.recurso, cantidad: Math.ceil(m.cantidad / 2),
    }));
  }

  reparar(id) {
    if (!this.tiene(id)) return false;
    const costo = this.costoReparar(id);
    if (costo.some(m => this.inventario.disponiblePara(m.recurso) < m.cantidad)) return false;
    for (const m of costo) this.inventario.consumirPara(m.recurso, m.cantidad);
    this.taller.set(id, this.definicion(id).durabilidad ?? Infinity);
    delete this._resto[id];
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
    } else {
      if (!this.tiene(id)) {
        return { ok: false, motivo: `Todavía no tenés ${nombre}: se arma en el bolso.` };
      }
      if (this.gastado(id)) {
        return { ok: false, motivo: `${def.nombre}: ya se consumió. Se repara en el bolso.` };
      }
      if ((def.ranura ?? 'mano') !== 'mano') {
        return { ok: false, motivo: `${def.nombre} no se lleva en la mano.` };
      }
    }

    // Lo que estuviera ardiendo se apaga primero, guardando lo que le quedaba
    if (this._llama) this._terminar(fechaMs, 'otra');

    let dur = horas * MS_POR_HORA;
    if (!receta && this._resto[id] > 0) dur = Math.min(dur, this._resto[id]);
    delete this._resto[id];
    if (receta) this.inventario.quitar(recurso, 1);

    this.puesto.mano = receta ? null : id;
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
   */
  _terminar(ahora, motivo) {
    const l = this._llama;
    if (!l) return;
    this._llama = null;
    const def = this.definicion(l.id);
    const resto = Number.isFinite(ahora) ? l.hasta - Math.max(ahora, l.desde) : l.hasta - l.desde;

    if (resto <= 0) {
      motivo = 'consumida';
      delete this._resto[l.id];
      if (!l.receta) {
        const usos = this.taller.get(l.id);
        if (Number.isFinite(usos) && usos > 0) this.taller.set(l.id, usos - 1);
      }
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
      } else if (this.gastado(l.id)) {
        titulo = `${nombre}: se consumió`;
        detalle = `Se repara en el bolso con ${this.costoReparar(l.id)
          .map(m => `${m.cantidad} × ${nombreDe(m.recurso).toLowerCase()}`).join(' · ')}.`;
      } else {
        titulo = `${nombre}: se acabó la carga`;
        detalle = `Le quedan ${this.usosDe(l.id)} usos. Se vuelve a prender desde el bolso.`;
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
   * Los usos infinitos van como null: `JSON.stringify(Infinity)` también da
   * null, y es mejor que la conversión se vea acá que descubrirla al cargar.
   */
  serializar() {
    const l = this._llama;
    return {
      taller: [...this.taller].map(([id, usos]) => [id, Number.isFinite(usos) ? usos : null]),
      puesto: { ...this.puesto },
      llama: l ? { id: l.id, desde: l.desde, hasta: l.hasta, mano: l.mano } : null,
      resto: { ...this._resto },
    };
  }

  /**
   * Repone lo que devolvió `serializar()`. Lo que el dataset ya no conoce se
   * descarta en silencio, igual que hace `Partida` con las obras.
   *
   * Tiene que llamarse con el reloj del mundo ya repuesto: `hasta` es una fecha
   * de ese reloj, y una llama vencida se cobra en el primer `luzActiva()`.
   *
   * @returns {boolean} false si no había nada que reponer
   */
  reponer(datos) {
    if (!datos || typeof datos !== 'object') return false;

    this.taller.clear();
    for (const par of Array.isArray(datos.taller) ? datos.taller : []) {
      const [id, usos] = Array.isArray(par) ? par : [];
      const def = this.definicion(id);
      if (!def) continue;
      const tope = def.durabilidad ?? Infinity;
      this.taller.set(id, Number.isFinite(usos) ? Math.max(0, Math.min(usos, tope)) : tope);
    }

    for (const r of RANURAS) {
      const id = datos.puesto?.[r] ?? null;
      const def = id ? this.definicion(id) : null;
      this.puesto[r] = def && def.ranura === r && this.taller.has(id) ? id : null;
    }

    this._resto = {};
    for (const [id, ms] of Object.entries(datos.resto || {})) {
      if (this.definicion(id) && Number.isFinite(ms) && ms > 0) this._resto[id] = ms;
    }

    this._llama = null;
    const l = datos.llama;
    const def = l ? this.definicion(l.id) : null;
    if (def?.efecto?.luz && Number.isFinite(l.hasta)) {
      const receta = Array.isArray(def.produce) && def.produce.length > 0;
      this._llama = {
        id: l.id,
        desde: Number.isFinite(l.desde) ? l.desde : l.hasta - def.efecto.duracionHoras * MS_POR_HORA,
        hasta: l.hasta,
        mano: l.mano ?? (receta ? null : l.id),
        receta,
      };
    }
    this.alCambiar?.();
    return true;
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
      const id = this.puesto[ranura];
      if (!id || this.gastado(id)) continue;
      n += this.definicion(id)?.efecto?.[clave] || 0;
    }
    return n;
  }

  /** Todo lo fabricado, para dibujar. */
  listar() {
    return [...this.taller.entries()].map(([id, usos]) => {
      const def = this.definicion(id);
      return {
        id, nombre: def?.nombre || id, nivel: def?.nivel ?? 0,
        categoria: def?.categoria, ranura: def?.ranura || null,
        usos, tope: def?.durabilidad ?? Infinity,
        gastado: usos <= 0,
        puesto: def?.ranura ? this.puesto[def.ranura] === id : false,
      };
    }).sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre));
  }
}
