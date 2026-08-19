/**
 * Caza — qué se puede tomar del mundo animal, y sobre todo qué no.
 *
 * El sistema existe para enseñar una regla que mucha gente desconoce: dentro de
 * un parque nacional argentino la fauna autóctona no se caza NUNCA. No hay
 * temporada, no hay cupo, no hay permiso. Lo único que se controla —bajo
 * programa de la Administración de Parques Nacionales, con permiso y con
 * fechas— son las especies exóticas invasoras, porque arrasan con el bosque
 * nativo.
 *
 * Por eso el juego no bloquea la acción en silencio: cuando el jugador apunta a
 * un huemul, le explica qué es un Monumento Natural. La negativa es el
 * contenido educativo, no un obstáculo.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class Caza {
  /**
   * @param {object} normativa contenido de caza.json
   * @param {object} deps {jugador, inventario, saberes, codice, hud, tiempo, mundo}
   */
  constructor(normativa, deps) {
    this.n = normativa;
    Object.assign(this, deps);
    this.reglaPorEspecie = new Map(
      (normativa?.especies || []).map(e => [e.id, e])
    );
    this.infracciones = 0;
    this.aprovechamientos = 0;
  }

  /** ¿Está dentro de la temporada declarada para esta especie? */
  _enTemporada(regla, mes) {
    const t = regla?.temporada;
    if (!t || t.mesDesde == null || t.mesHasta == null) return { dentro: true, motivo: null };
    // La temporada puede cruzar el fin de año (noviembre a abril)
    const dentro = t.mesDesde <= t.mesHasta
      ? (mes >= t.mesDesde && mes <= t.mesHasta)
      : (mes >= t.mesDesde || mes <= t.mesHasta);
    return {
      dentro,
      motivo: dentro ? null
        : `Temporada de ${MESES[t.mesDesde - 1]} a ${MESES[t.mesHasta - 1]}; hoy es ${MESES[mes - 1]}`,
      nombre: t.nombre,
    };
  }

  /**
   * Veredicto completo sobre cazar una especie ahora mismo.
   * Devuelve siempre una explicación: es lo que el jugador tiene que aprender.
   */
  evaluar(esp, mes) {
    const cat = (id) => (this.n?.categorias || []).find(c => c.id === id);

    if (esp.monumentoNatural) {
      const c = cat('monumento_natural');
      return {
        permitido: false, gravedad: 'grave',
        titulo: `${esp.nombreComun}: Monumento Natural`,
        detalle: c?.explicacion
          || 'Es Monumento Natural Nacional. Su caza está prohibida en todo el país, sin excepción.',
        color: c?.colorAviso || '#a11a1a',
      };
    }

    if (esp.protegida !== false && esp.nativa !== false) {
      const c = cat('nativa_protegida');
      return {
        permitido: false, gravedad: 'grave',
        titulo: `${esp.nombreComun}: fauna nativa protegida`,
        detalle: c?.explicacion
          || 'Dentro de un parque nacional la fauna autóctona no se caza nunca: no existe temporada ni permiso que lo habilite.',
        color: c?.colorAviso || '#c8503f',
      };
    }

    // Exótica invasora: permitida, pero no en cualquier momento ni de cualquier modo
    const regla = this.reglaPorEspecie.get(esp.id);
    const temp = this._enTemporada(regla, mes);
    if (!temp.dentro) {
      return {
        permitido: false, gravedad: 'leve',
        titulo: `${esp.nombreComun}: fuera de temporada`,
        detalle: `${temp.motivo}. Las vedas existen para no interrumpir la reproducción, incluso en una especie que se quiere controlar.`,
        color: '#d08a3a',
      };
    }

    const c = cat('exotica_invasora');
    return {
      permitido: true, gravedad: null,
      titulo: `${esp.nombreComun}: exótica invasora`,
      detalle: regla?.razonEcologica || c?.explicacion
        || 'Especie introducida. Su control forma parte del manejo del parque.',
      nota: regla?.notaEducativa,
      color: '#6fae7c',
      requierePermiso: regla?.requierePermiso !== false,
    };
  }

  /**
   * Intento de caza. Nunca ejecuta en silencio: siempre explica.
   * @returns {boolean} si se concretó
   */
  intentar(animal, mes) {
    const v = this.evaluar(animal.esp, mes);

    if (!v.permitido) {
      this.infracciones++;
      // La penalización es de saber, no de salud: el costo de no entender el
      // lugar es no entenderlo.
      const castigo = v.gravedad === 'grave' ? 8 : 3;
      this.saberes.puntos = Math.max(0, this.saberes.puntos - castigo);
      this.hud.aviso(v.titulo, v.detalle);
      // Aunque no se pueda cazar, verla y saber por qué también enseña
      this.codice.registrarFauna(animal.esp, true);
      return false;
    }

    const rinde = this._faena(animal.esp);
    const obtenido = [];
    for (const r of rinde) {
      const n = this.inventario.agregar(r.recurso, r.cantidad);
      if (n > 0) obtenido.push(`${n} × ${r.recurso}`);
    }
    this.codice.registrarFauna(animal.esp, true);
    this.hud.aviso(`${animal.esp.nombreComun} abatido`,
      v.nota || obtenido.join(' · ') || 'Sin aprovechamiento');
    return true;
  }

  /** Qué rinde la faena, escalado con el porte del animal. */
  _faena(esp) {
    const kg = esp.pesoKg || 20;
    return [
      { recurso: 'cuero', cantidad: Math.max(1, Math.round(kg / 28)) },
      { recurso: 'tendon', cantidad: Math.max(1, Math.round(kg / 45)) },
      { recurso: 'grasa', cantidad: Math.max(1, Math.round(kg / 60)) },
      { recurso: 'carne', cantidad: Math.max(1, Math.round(kg / 12)) },
    ];
  }

  /**
   * Aprovechar restos hallados en el campo.
   *
   * No es cazar: es lo que hacían los pueblos originarios y lo que hace
   * cualquier carroñero del bosque. Un puma deja el 40 % de su presa, y de ahí
   * comen el cóndor, el zorro y el chimango. Tomar una parte no rompe nada.
   */
  aprovechar(resto) {
    const fuente = (this.n?.carronia?.fuentes || []).find(f => f.id === resto.fuenteId)
      || { rinde: [{ recurso: 'cuero', cantidad: 1 }, { recurso: 'tendon', cantidad: 1 }] };
    const obtenido = [];
    for (const r of fuente.rinde || []) {
      const n = this.inventario.agregar(r.recurso, r.cantidad);
      if (n > 0) obtenido.push(`${n} × ${r.recurso}`);
    }
    this.aprovechamientos++;
    this.saberes.otorgar(1, 'Aprovechaste restos');
    this.hud.aviso(fuente.nombre || 'Restos aprovechados',
      fuente.notaEcologica || obtenido.join(' · '));
    return obtenido.length > 0;
  }
}
