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
  evaluar(esp, mes, x, z) {
    const cat = (id) => (this.n?.categorias || []).find(c => c.id === id);

    // Dónde está parado el jugador, ANTES que qué animal tiene enfrente.
    //
    // La caza era el único de los cuatro sistemas regulados que no miraba la
    // jurisdicción: minería, fundición y construcción las tres consultan los
    // límites, y ésta contestaba sólo con la especie y el mes. Parado en el
    // área núcleo del parque, en marzo, frente a un ciervo, el juego decía
    // "exótica invasora, permitido" y entregaba la faena. O sea que enseñaba
    // que dentro de un parque nacional se puede cazar si es la época — que es
    // exactamente lo que el juego existe para desmentir. El artículo 5 de la
    // Ley 22.351 no distingue entre nativa y exótica: prohíbe toda acción sobre
    // la fauna, y la caza de exóticas existe únicamente como excepción de
    // manejo, con permiso, cupo y zona asignada.
    const j = x !== undefined && this.limites ? this.limites.jurisdiccion(x, z) : null;

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

    // Exótica invasora: permitida, pero no en cualquier lugar, ni en cualquier
    // momento, ni de cualquier modo. Las tres condiciones, en ese orden.
    const regla = this.reglaPorEspecie.get(esp.id);

    if (j === 'parque') {
      return {
        permitido: false, gravedad: 'grave', jurisdiccion: j,
        titulo: `${esp.nombreComun}: estás dentro del Parque Nacional`,
        detalle: 'El artículo 5 de la Ley 22.351 prohíbe toda acción sobre la fauna dentro de un '
          + 'Parque Nacional, sea nativa o introducida. El control de exóticas existe, pero es una '
          + 'excepción de manejo que ejecuta la Administración de Parques Nacionales con cupo, zona '
          + 'y precinto: no es una temporada abierta a quien pase por acá. Fuera de los límites del '
          + 'parque rige el régimen de fauna de Río Negro, que es otra cosa.',
        color: '#c8503f',
        castigo: 8,
      };
    }

    if (j === 'reserva' && regla?.requierePermiso !== false) {
      return {
        permitido: false, gravedad: 'leve', jurisdiccion: j,
        titulo: `${esp.nombreComun}: hace falta el permiso`,
        detalle: 'En Reserva Nacional la caza de ciervo colorado y jabalí puede habilitarse, pero '
          + 'por el Reglamento Único de la Resolución de Directorio 277/2011: turnos adjudicados por '
          + 'subasta, zona asignada, permiso y precinto, con control de guardaparques. El trámite se '
          + 'hace en la intendencia. Sin eso, cazar acá es furtivismo aunque la especie sea exótica.',
        color: '#d08a3a',
        castigo: 3,
      };
    }

    // Y hace falta con qué. El juego dejaba abatir un ciervo colorado de ciento
    // ochenta kilos a mano limpia, con el arco y la punta de proyectil
    // comprados en el árbol y sin ninguna función: treinta y ocho puntos de
    // saber que no habilitaban nada.
    const arma = this.saberes?.faltaPara('caza');
    if (arma) {
      return {
        permitido: false, gravedad: 'leve', jurisdiccion: j,
        titulo: `${esp.nombreComun}: no tenés con qué`,
        detalle: `A mano limpia no se caza un animal de este porte. Hace falta aprender `
          + `«${arma.nombre}» en el códice: cuesta ${arma.costoSaber} puntos de saber y pide `
          + `caña colihue y un tendón, que sale de aprovechar restos sin matar nada.`,
        color: '#d08a3a',
        castigo: 0,
      };
    }

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
  /** Dónde y cuándo pasó, para que el registro de normativa se pueda releer. */
  _contextoNorma() {
    const j = this.limites && this.jugador
      ? this.limites.etiqueta(this.jugador.posicion.x, this.jugador.posicion.z).nombre
      : '';
    return { lugar: j, fecha: this.tiempo?.textoFecha || '' };
  }

  intentar(animal, mes) {
    const p = this.jugador?.posicion;
    const v = this.evaluar(animal.esp, mes, p?.x, p?.z);
    // La nota educativa de la especie viajaba hasta acá y sólo se mostraba
    // cuando la caza era LEGAL. En el camino de la negativa, que es donde el
    // jugador está prestando atención, no se veía nunca.
    if (!v.nota) v.nota = this.reglaPorEspecie.get(animal.esp.id)?.notaEducativa
      || animal.esp.notaEducativa || '';

    if (!v.permitido) {
      this.infracciones++;
      // La penalización es de saber, no de salud: el costo de no entender el
      // lugar es no entenderlo.
      const castigo = v.castigo ?? (v.gravedad === 'grave' ? 8 : 3);
      // El panel dice lo que costó, así que el veredicto tiene que llevarlo
      v.castigo = castigo;
      this.saberes.puntos = Math.max(0, this.saberes.puntos - castigo);
      this.hud.negativa(v, this._contextoNorma());
      // Aunque no se pueda cazar, verla y saber por qué también enseña
      this.codice.registrarFauna(animal.esp, true);
      return false;
    }

    // El arma decide si el tiro entra. Hasta acá `intentar()` era determinista:
    // si la ley dejaba, el animal caía, y las nueve armas del árbol eran el
    // mismo objeto con nueve nombres. Ahora el alcance, el porte de la presa y
    // la munición mandan.
    const tiro = this._tiro(animal);
    if (!tiro.ok) {
      this.hud.aviso(tiro.titulo, tiro.motivo);
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

  /**
   * ¿Entra el tiro?
   *
   * Las nueve armas del árbol declaran `alcanceM`, `danio`, `sigilo`,
   * `presaMaxKg` y a veces `municion`, y hasta acá no las leía nadie: `Caza.js`
   * preguntaba un solo bit —«¿sabés cazar?»— así que el garrote y el arco eran
   * lo mismo. Acá se paga esa deuda, que la propia ronda se había puesto como
   * regla de cierre: o el efecto declarado se implementa, o el objeto se recorta.
   *
   * Tres cosas deciden, y ninguna es azar puro:
   *
   * - **El alcance.** Más allá del alcance del arma no se tira, y se dice a qué
   *   distancia está el animal y hasta dónde llega el arma.
   * - **El porte.** Cada arma tiene una presa máxima. Una honda contra un ciervo
   *   colorado de 180 kg lo lastima y lo hace huir: eso no es cazar, es dejar un
   *   animal herido en el monte, y el juego lo nombra así.
   * - **La munición.** El arco sin flechas no dispara, y la flecha se gasta.
   *
   * Si no hay arma equipada con estadísticas, se resuelve como antes. Es a
   * propósito: una partida vieja no se rompe porque el sistema nuevo exista.
   */
  _tiro(animal) {
    const arma = this.equipo?.enRanura('arma');
    if (!arma?.alcanceM) return { ok: true };

    if (arma.municion) {
      if (this.inventario.disponiblePara(arma.municion) < 1) {
        return {
          ok: false, titulo: `${arma.nombre} sin munición`,
          motivo: `Te quedaste sin ${arma.municion}. Se fabrican en el bolso.`,
        };
      }
    }

    const p = this.jugador?.posicion;
    const d = (p && animal.x != null)
      ? Math.hypot(animal.x - p.x, animal.z - p.z) : 0;
    if (d > arma.alcanceM) {
      return {
        ok: false, titulo: 'Demasiado lejos',
        motivo: `${arma.nombre} llega a ${arma.alcanceM} m y el animal está a ${d.toFixed(0)} m. `
          + `Acercate agachado: el sigilo del arma es ${(arma.sigilo * 100).toFixed(0)} %.`,
      };
    }

    // Desde acá el tiro sale, así que la munición se gasta salga bien o mal:
    // una flecha errada tampoco vuelve sola.
    if (arma.municion) this.inventario.consumirPara(arma.municion, 1);
    this.equipo?.desgastar?.();

    const kg = animal.esp.pesoKg || 20;
    if (kg > (arma.presaMaxKg || Infinity)) {
      return {
        ok: false, titulo: `${animal.esp.nombreComun}: demasiado animal`,
        motivo: `${arma.nombre} sirve hasta unos ${arma.presaMaxKg} kg y éste anda por los `
          + `${kg.toFixed(0)}. Lo herís y se va: un animal herido en el monte no es una presa, `
          + `es un daño que nadie aprovecha.`,
      };
    }

    // La boleadora no hiere: enreda. Dentro de su porte y su alcance no falla,
    // y ésa es la razón por la que fue el arma de esta estepa.
    if (arma.enreda) return { ok: true };

    // Cerca es más fácil, y el arma silenciosa deja acercarse más. No es azar
    // puro: es el azar que queda después de que el jugador hizo bien las cosas.
    const cerca = 1 - (d / arma.alcanceM) * 0.5;
    const porte = 1 - Math.min(0.6, kg / (arma.presaMaxKg * 2));
    if (Math.random() > cerca * porte * (0.55 + arma.sigilo * 0.45)) {
      return {
        ok: false, titulo: `Erraste el tiro`,
        motivo: `${animal.esp.nombreComun} salió corriendo. A ${d.toFixed(0)} m con `
          + `${arma.nombre.toLowerCase()} el tiro no es seguro.`,
      };
    }
    return { ok: true };
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
  /**
   * Sortea qué clase de resto es, con las probabilidades que declara el dataset.
   *
   * Antes el único llamador pasaba `presa_puma` cableado a mano, así que las
   * otras tres fuentes de `caza.json` no salían nunca. No era cosmético: el
   * desmogue es la única fuente de `asta` del juego, y el asta es la compuerta
   * de las dos herramientas de nivel 3. Media rama del árbol estaba apagada por
   * una cadena literal.
   */
  sortearFuente() {
    const fuentes = this.n?.carronia?.fuentes || [];
    if (!fuentes.length) return null;
    const total = fuentes.reduce((s, f) => s + (f.probabilidadRelativa || 1), 0);
    let r = Math.random() * total;
    for (const f of fuentes) {
      r -= (f.probabilidadRelativa || 1);
      if (r <= 0) return f;
    }
    return fuentes[fuentes.length - 1];
  }

  /**
   * @param {{fuenteId?: string, fuente?: object, soloHueso?: boolean}} resto
   */
  aprovechar(resto) {
    const fuente = resto.fuente
      || (this.n?.carronia?.fuentes || []).find(f => f.id === resto.fuenteId)
      || this.sortearFuente()
      || { rinde: [{ recurso: 'cuero', cantidad: 1 }, { recurso: 'tendon', cantidad: 1 }] };

    // A mano limpia se junta el hueso limpio y nada más: el cuero no se arranca,
    // se corta. Es el eslabón que trababa el juego entero —el arco pide tendón,
    // el tendón sale de acá— y ahora la lasca lo destraba.
    let rinde = fuente.rinde || [];
    if (resto.soloHueso) {
      rinde = rinde.filter(r => r.recurso === 'hueso');
      if (!rinde.length) rinde = [{ recurso: 'hueso', cantidad: 1 }];
    }

    const obtenido = [];
    for (const r of rinde) {
      const n = this.inventario.agregar(r.recurso, r.cantidad);
      if (n > 0) obtenido.push(`${n} × ${r.recurso}`);
    }
    if (resto.soloHueso) {
      this.hud.aviso(fuente.nombre || 'Restos aprovechados',
        'Sin filo sólo se junta el hueso limpio: el cuero no se arranca, se corta.');
      this.aprovechamientos++;
      this.saberes.otorgar(1, 'Aprovechaste restos');
      return obtenido.length > 0;
    }
    this.aprovechamientos++;
    this.saberes.otorgar(1, 'Aprovechaste restos');
    this.hud.aviso(fuente.nombre || 'Restos aprovechados',
      fuente.notaEcologica || obtenido.join(' · '));
    return obtenido.length > 0;
  }
}
