/**
 * Fundición — hornos, fragua y todo lo que se transforma con fuego.
 *
 * Tres ideas sostienen este sistema, y las tres son históricas antes que de
 * diseño:
 *
 * 1. El combustible manda. La leña no pasa de los 600 °C y no funde nada; el
 *    carbón vegetal sí llega a temperatura de fragua. Por eso la carbonera es
 *    la primera construcción de toda la cadena, y por eso las carboneras
 *    consumieron tanto bosque: seis de leña dan dos de carbón.
 * 2. Acá no se funde mineral, se recupera metal. La comarca no tiene hierro, y
 *    lo que hacía una fragua de puesto era reforjar chatarra.
 * 3. El fuego está regulado. En el Parque Nacional sólo se enciende en sitios
 *    habilitados, y una carbonera es un fuego que arde días. La negativa
 *    también enseña.
 *
 * El tiempo de cocción corre en horas del mundo, no en segundos reales: con la
 * tecla de velocidad del tiempo, una carbonera de treinta horas se resuelve en
 * lo que dura una caminata.
 */

import { normalizar, nombreDe } from './Recursos.js';

const MS_HORA = 3600 * 1000;
const RADIO_HORNO_M = 8;

export class Fundicion {
  /**
   * @param {object} datos contenido de mineria.json
   * @param {object} deps {inventario, saberes, jugador, tiempo, hud, limites, mundo}
   */
  constructor(datos, deps) {
    this.d = datos || {};
    Object.assign(this, deps);
    /** @type {Array<{def:object, x:number, z:number, y:number, trabajo:object|null}>} */
    this.hornos = [];
    this.hechos = 0;
    this.alCambiar = null;
  }

  get definicionesHorno() { return this.d.hornos || []; }
  get recetas() { return this.d.recetas || []; }

  hornoPorId(id) { return this.definicionesHorno.find(h => h.id === id); }

  /** El horno construido más cercano al jugador, si hay alguno a mano. */
  cercano(radio = RADIO_HORNO_M) {
    const p = this.jugador.posicion;
    let mejor = null, mejorD = radio;
    for (const h of this.hornos) {
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < mejorD) { mejor = h; mejorD = d; }
    }
    return mejor;
  }

  // ── Construcción ──────────────────────────────────────────────────────────

  /** Qué falta para levantar este horno, si es que falta algo. */
  faltaPara(def) {
    return (def.materiales || [])
      .map(m => ({
        recurso: normalizar(m.recurso), nombre: nombreDe(m.recurso),
        pide: m.cantidad, hay: this.inventario.disponiblePara(m.recurso),
      }))
      .filter(m => m.hay < m.pide);
  }

  /**
   * Veredicto sobre encender fuego acá. La regla no distingue por tipo de
   * horno: todos son fuego, y una carbonera es el peor de todos porque nadie la
   * mira durante días.
   */
  evaluarFuego(x, z) {
    const j = this.limites.jurisdiccion(x, z);
    if (j === 'parque') {
      const p = this.d.fuego?.penalidadEnParque || {};
      return {
        permitido: false, jurisdiccion: j,
        titulo: p.titulo || 'Fuego fuera de lugar habilitado',
        detalle: p.detalle || this.d.fuego?.explicacion
          || 'Dentro del Parque Nacional sólo se hace fuego en los sitios habilitados.',
        castigo: p.castigoSaber ?? 6,
      };
    }
    return {
      permitido: true, jurisdiccion: j,
      nota: j === 'reserva' ? this.d.fuego?.notaEnReserva : null,
    };
  }

  construir(def) {
    const p = this.jugador.posicion;
    const fuego = this.evaluarFuego(p.x, p.z);
    if (!fuego.permitido) {
      this.saberes.puntos = Math.max(0, this.saberes.puntos - fuego.castigo);
      this.hud.aviso(fuego.titulo, fuego.detalle);
      return null;
    }

    // Dos hornos no entran en el mismo lugar, y encimarlos dejaría uno
    // inalcanzable: `cercano()` devolvería siempre el mismo.
    if (this.hornos.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 4)) {
      this.hud.aviso('Muy encima de otro horno', 'Correte unos pasos: cada uno necesita su lugar');
      return null;
    }

    const falta = this.faltaPara(def);
    if (falta.length) {
      this.hud.aviso(`Falta material para ${def.nombre.toLowerCase()}`,
        falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(' · '));
      return null;
    }

    for (const m of def.materiales || []) {
      this.inventario.consumirPara(normalizar(m.recurso), m.cantidad);
    }
    const horno = {
      def, x: p.x, z: p.z, y: this.mundo.alturaEn(p.x, p.z), trabajo: null,
    };
    this.hornos.push(horno);
    this.saberes.otorgar(3, `${def.nombre} en pie`);
    this.hud.aviso(def.nombre, fuego.nota || def.descripcion);
    this.alCambiar?.();
    return horno;
  }

  // ── Cocción ───────────────────────────────────────────────────────────────

  recetasDe(hornoId) {
    return this.recetas.filter(r => r.horno === hornoId);
  }

  /** Estado de una receta: lista, sin material, u ocupada. */
  estadoReceta(receta, horno) {
    if (horno.trabajo) return { estado: 'ocupado' };
    const falta = (receta.entra || [])
      .map(m => ({
        nombre: nombreDe(m.recurso), pide: m.cantidad,
        hay: this.inventario.disponiblePara(m.recurso),
      }))
      .filter(m => m.hay < m.pide);
    return falta.length ? { estado: 'falta', falta } : { estado: 'lista' };
  }

  iniciar(receta, horno) {
    const e = this.estadoReceta(receta, horno);
    if (e.estado === 'ocupado') {
      this.hud.aviso(`${horno.def.nombre} ocupado`, 'Esperá a que termine la carga anterior');
      return false;
    }
    if (e.estado === 'falta') {
      this.hud.aviso(`Falta material para ${receta.nombre.toLowerCase()}`,
        e.falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(' · '));
      return false;
    }
    for (const m of receta.entra || []) {
      this.inventario.consumirPara(normalizar(m.recurso), m.cantidad);
    }
    horno.trabajo = {
      receta,
      desde: this.tiempo.fecha.getTime(),
      hasta: this.tiempo.fecha.getTime() + (receta.horas || 1) * MS_HORA,
    };
    this.hud.aviso(`${receta.nombre} en el fuego`, receta.nota || `${receta.horas} h de cocción`);
    this.alCambiar?.();
    return true;
  }

  /** Cuánto le falta a la carga, de 0 a 1. */
  progreso(horno) {
    const t = horno.trabajo;
    if (!t) return 0;
    const ahora = this.tiempo.fecha.getTime();
    return Math.min(1, (ahora - t.desde) / Math.max(1, t.hasta - t.desde));
  }

  /**
   * Cierra las cargas terminadas. Si el bolso está lleno, la producción queda
   * esperando en el horno en vez de perderse: nadie tira una hornada.
   */
  actualizar() {
    const ahora = this.tiempo.fecha.getTime();
    for (const h of this.hornos) {
      const t = h.trabajo;
      if (!t || ahora < t.hasta) continue;

      const obtenido = [], quedan = [];
      for (const s of t.receta.sale || []) {
        const n = this.inventario.agregar(s.recurso, s.cantidad);
        if (n > 0) obtenido.push(`${n} × ${nombreDe(s.recurso)}`);
        if (n < s.cantidad) quedan.push({ recurso: s.recurso, cantidad: s.cantidad - n });
      }

      if (quedan.length) {
        // Queda enfriándose junto al horno hasta que haya lugar en el bolso
        t.sale = quedan;
        t.hasta = Infinity;
        t.esperando = true;
        this.hud.aviso(`${t.receta.nombre}: no entra en el bolso`,
          'La hornada queda junto al horno hasta que hagas lugar');
        continue;
      }

      h.trabajo = null;
      this.hechos++;
      if (this.hechos <= 6) this.saberes.otorgar(3, `${t.receta.nombre}: primera hornada`);
      this.hud.aviso(t.receta.nombre, obtenido.join(' · '));
      this.alCambiar?.();
    }
  }

  /** Retirar lo que quedó esperando junto a un horno lleno. */
  retirar(horno) {
    const t = horno.trabajo;
    if (!t?.esperando) return false;
    const obtenido = [], quedan = [];
    for (const s of t.sale) {
      const n = this.inventario.agregar(s.recurso, s.cantidad);
      if (n > 0) obtenido.push(`${n} × ${nombreDe(s.recurso)}`);
      if (n < s.cantidad) quedan.push({ recurso: s.recurso, cantidad: s.cantidad - n });
    }
    if (quedan.length) {
      t.sale = quedan;
      this.hud.aviso('Sigue sin entrar todo', `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
      return false;
    }
    horno.trabajo = null;
    this.hechos++;
    this.hud.aviso(t.receta.nombre, obtenido.join(' · '));
    this.alCambiar?.();
    return true;
  }
}
