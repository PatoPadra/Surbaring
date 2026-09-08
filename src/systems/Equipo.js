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
 */

const RANURAS = ['mano', 'arma', 'abrigo', 'espalda'];

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
    if (def.ranura && !this.puesto[def.ranura]) this.equipar(id);
    this.alCambiar?.();
    return true;
  }

  equipar(id) {
    const def = this.definicion(id);
    if (!def?.ranura || !this.tiene(id)) return false;
    this.puesto[def.ranura] = id;
    this.alCambiar?.();
    return true;
  }

  desequipar(ranura) {
    if (!this.puesto[ranura]) return false;
    this.puesto[ranura] = null;
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
    return this.definicion(id)?.nivel ?? 0;
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
