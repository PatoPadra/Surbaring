/**
 * Pesca — la única actividad extractiva que un visitante común puede ejercer
 * legalmente dentro del Parque Nacional Nahuel Huapi, y la más contradictoria.
 *
 * Casi todo lo que se pesca acá es exótico. Los salmónidos se sembraron desde
 * principios del siglo XX en aguas que no los tenían, con la Estación de
 * Piscicultura de Bariloche entre los focos de esa introducción. Hoy sostienen
 * una actividad turística enorme y, al mismo tiempo, desplazan a la perca, al
 * puyén y al pejerrey patagónico. El parque convive con eso y lo administra.
 *
 * El sistema modela lo que la reglamentación modela de verdad, en este orden,
 * porque es el orden en que un guardaparque lo pregunta:
 *
 *   1. Permiso. Es obligatorio y personal, y se saca en la intendencia. Sin
 *      permiso no se pesca, y el juego lo trata como infracción.
 *   2. Ambiente y temporada. El lago Nahuel Huapi tiene temporada extendida
 *      —octubre a mayo—, los ríos y arroyos la general, de noviembre a abril.
 *   3. Especie. Los nativos se devuelven siempre: son fauna autóctona dentro de
 *      un área protegida, igual que el huemul.
 *   4. Medida. Al salmónido grande se lo devuelve, porque el reproductor grande
 *      vale más en el agua que en la mochila.
 *
 * Devolver no es perder: el veredicto explicado es el contenido, y devolver bien
 * suma saber.
 */

/**
 * Qué pica y qué no. Estar en el agua no es lo mismo que morder un señuelo: los
 * salmónidos son depredadores que atacan mosca y cucharita, la perca pica bien,
 * el pejerrey menos, y el puyén es un pez de cinco centímetros que en la práctica
 * es carnada de los otros y no captura de caña. Por eso lo que sale del anzuelo
 * está dominado por especies introducidas: no es un sesgo del juego, es el
 * estado real del lago.
 */
const PICA = {
  trucha_arcoiris: 3.0,
  trucha_marron: 2.6,
  salmon_encerrado: 1.4,
  perca_criolla: 1.5,
  pejerrey_patagonico: 0.7,
  puyen_grande: 0.35,
  puyen_chico: 0.15,
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// La intendencia del parque está frente al lago, en el Centro Cívico
const INTENDENCIA = { lat: -41.1335, lon: -71.3103, radioM: 320 };

export class Pesca {
  /**
   * @param {object} normativa contenido de caza.json
   * @param {object} deps {peces, mundo, jugador, inventario, saberes, codice, hud, tiempo}
   */
  constructor(normativa, deps) {
    this.n = normativa?.pesca || {};
    Object.assign(this, deps);
    this.reglaPorEspecie = new Map(
      (normativa?.especies || []).map(e => [e.id, e])
    );
    /** @type {{tipo:string, anio:number}|null} */
    this.permiso = null;
    this.capturas = 0;
    /** Veces que se tiró la línea sin permiso: la primera no se cobra. */
    this.intentosSinPermiso = 0;
    this.devoluciones = 0;
    this.infracciones = 0;

    const p = this.mundo.aMundo(INTENDENCIA.lat, INTENDENCIA.lon);
    this.intendencia = { x: p.x, z: p.z };
  }

  // ── Permiso ───────────────────────────────────────────────────────────────

  enIntendencia(x, z) {
    return Math.hypot(this.intendencia.x - x, this.intendencia.z - z) < INTENDENCIA.radioM;
  }

  /** A cuántos metros está la intendencia del jugador, ahora mismo. */
  distanciaAIntendencia() {
    const { x, z } = this.jugador.posicion;
    return Math.hypot(this.intendencia.x - x, this.intendencia.z - z);
  }

  /**
   * Cómo llegar al permiso, dicho con precisión: dónde queda, para qué lado y
   * a cuánto. Sin esto la intendencia es una pared invisible a once kilómetros;
   * con esto es una meta.
   */
  comoLlegarAlPermiso() {
    const { x, z } = this.jugador.posicion;
    const dx = this.intendencia.x - x, dz = this.intendencia.z - z;
    const d = Math.hypot(dx, dz);
    const rumbo = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const puntos = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
    const hacia = puntos[Math.round(rumbo / 45) % 8];
    const dist = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
    return { distancia: d, texto: `La intendencia del Parque está en el Centro Cívico de Bariloche, frente al lago: ${dist} al ${hacia} de acá. Marcala en el mapa (M) y pulsá E cuando llegues.` };
  }

  get tienePermiso() {
    return this.permiso && this.permiso.anio === this.tiempo.fecha.getUTCFullYear();
  }

  /** Sacar el permiso, que sólo se consigue donde se consigue. */
  sacarPermiso() {
    const { x, z } = this.jugador.posicion;
    if (!this.enIntendencia(x, z)) {
      this.hud.aviso('El permiso no se saca en cualquier lado',
        this.n.permiso?.donde
        || 'Se gestiona en las intendencias y seccionales de Parques Nacionales, en comercios habilitados y online.');
      return false;
    }
    this.permiso = { tipo: 'temporada', anio: this.tiempo.fecha.getUTCFullYear() };
    this.saberes.otorgar(5, 'Permiso de pesca en regla');
    this.hud.aviso('Permiso de pesca de temporada',
      this.n.permiso?.nota
      || 'Es personal e intransferible y hay que llevarlo encima: el guardaparque lo pide junto con el equipo y la captura.');
    return true;
  }

  // ── Reglas ────────────────────────────────────────────────────────────────

  ambientePorId(id) {
    return (this.n.ambientes || []).find(a => a.id === id);
  }

  _enTemporada(ambienteId, mes) {
    const amb = this.ambientePorId(ambienteId);
    const t = amb?.temporada;
    if (!t) return { dentro: true };
    const dentro = t.mesDesde <= t.mesHasta
      ? (mes >= t.mesDesde && mes <= t.mesHasta)
      : (mes >= t.mesDesde || mes <= t.mesHasta);
    return {
      dentro, nombre: t.nombre, ambiente: amb,
      motivo: dentro ? null
        : `${t.nombre}: de ${MESES[t.mesDesde - 1]} a ${MESES[t.mesHasta - 1]}. Hoy es ${MESES[mes - 1]}.`,
    };
  }

  /** ¿Tiene con qué? Caña y línea; la red y el veneno no son opción acá. */
  tieneEquipo() {
    return this.inventario.disponiblePara('cana') > 0
      && (this.inventario.disponiblePara('fibra') > 0 || this.inventario.disponiblePara('tendon') > 0);
  }

  /**
   * Qué hay para pescar donde está parado el jugador.
   *
   * Primero el ambiente: hay que tener agua a distancia de tiro. Después la
   * especie, que sale del cardumen visible si hay uno cerca y, si no, de la
   * distribución de esa agua: que no se vea un pez no significa que no haya, y
   * la ficción de que sólo existe lo instanciado sería peor que el sorteo.
   */
  loQueHayCerca() {
    const p = this.jugador.posicion;
    let ambiente = this.peces.ambienteEn(p.x, p.z);
    if (!ambiente) {
      for (const r of [6, 12, 18]) {
        for (let a = 0; a < 8 && !ambiente; a++) {
          const ang = a / 8 * Math.PI * 2;
          ambiente = this.peces.ambienteEn(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r);
        }
        if (ambiente) break;
      }
    }
    if (!ambiente) return null;

    const cardumen = this.peces.masCercano(p, 45);
    return { cardumen, ambiente, esp: this._loQuePica(ambiente) };
  }

  /**
   * Qué especie muerde en este ambiente: la abundancia del agua cruzada con la
   * disposición a picar de cada una.
   */
  _loQuePica(ambiente) {
    const profundidad = ambiente.id === 'rios' ? 0.8 : 2.5;
    const especies = this.peces.especies;
    const pesos = especies.map(e =>
      this.peces._aptitud(e, ambiente.id, profundidad) * (PICA[e.id] ?? 1));
    const total = pesos.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pesos.length; i++) {
      r -= pesos[i];
      if (r <= 0) return especies[i];
    }
    return especies[0];
  }

  /**
   * Veredicto completo antes de tirar la línea. Devuelve siempre una
   * explicación: es lo que el jugador tiene que aprender.
   */
  evaluar(mes) {
    const cerca = this.loQueHayCerca();
    if (!cerca) {
      return {
        puede: false, titulo: 'No hay pique acá',
        detalle: 'Acercate a la orilla de un lago o de un río: los peces están donde está el agua, no donde uno quiere.',
      };
    }
    if (!this.tieneEquipo()) {
      return {
        puede: false, titulo: 'Te falta equipo',
        detalle: 'Hace falta una caña de colihue y línea de fibra o tendón. La red y el veneno están prohibidos, y no por capricho: no seleccionan especie ni talla.',
      };
    }
    if (!this.tienePermiso) {
      // La primera vez no se cobra: el juego enseña la tecla P y sería absurdo
      // castigar por probarla antes de saber que el permiso existe. La negativa
      // explica dónde conseguirlo y avisa que la próxima sí cuesta.
      const primera = this.intentosSinPermiso === 0;
      const camino = this.comoLlegarAlPermiso();
      return {
        puede: false, infraccion: true, castigo: primera ? 0 : 6, primera,
        titulo: primera ? 'Todavía no tenés permiso de pesca' : 'Pesca sin permiso',
        detalle: primera
          ? `${camino.texto} Sin permiso no se pesca: es la infracción más común y la más fácil de evitar. Esta vez no te cuesta nada; volver a tirar la línea sin permiso sí resta 6 de saber.`
          : `${camino.texto} Ya sabías: pescar sin permiso es infracción y cuesta 6 de saber.`,
      };
    }

    const temp = this._enTemporada(cerca.ambiente?.id, mes);
    if (!temp.dentro) {
      return {
        puede: false, infraccion: true, castigo: 4,
        titulo: 'Fuera de temporada',
        detalle: `${temp.motivo} ${temp.ambiente?.nota || ''}`.trim(),
      };
    }

    return {
      puede: true, cardumen: cerca.cardumen, esp: cerca.esp, ambiente: cerca.ambiente,
      titulo: `${cerca.ambiente?.nombre || 'Agua'}: ${temp.nombre}`,
    };
  }

  /**
   * Tirar la línea. Puede no picar; si pica, el veredicto sobre qué hacer con
   * ese pez es el contenido del sistema.
   */
  intentar(mes) {
    const v = this.evaluar(mes);
    if (!v.puede) {
      if (!this.tienePermiso) this.intentosSinPermiso++;
      if (v.infraccion && (v.castigo || 0) > 0) {
        this.infracciones++;
        this.saberes.puntos = Math.max(0, this.saberes.puntos - v.castigo);
      }
      this.hud.aviso(v.titulo, v.detalle);
      return null;
    }

    // No siempre pica: un cardumen visible no es una captura
    if (Math.random() < 0.32) {
      this.hud.aviso('No picó', 'Probá otra vez, o buscá otro pozón. La pesca es esperar.');
      return null;
    }

    const esp = v.esp;
    // Talla del ejemplar. El largo del dataset es el de un adulto grande, y en
    // el agua la mayoría son juveniles, así que la distribución tira para abajo:
    // de una trucha arcoíris de 50 cm de referencia salen ejemplares de 18 a 55.
    const largoCm = Math.max(4, (esp.largoM || 0.2) * 100 * (0.35 + Math.random() * 0.75));
    this.codice?.registrarFauna(esp, true);

    // ── Nativo: se devuelve siempre
    if (esp.nativa) {
      this.devoluciones++;
      const nota = (this.n.especiesNativas || []).find(e => e.id === esp.id)?.nota;
      this.saberes.otorgar(3, `${esp.nombreComun} devuelto al agua`);
      this.hud.aviso(`${esp.nombreComun} (${largoCm.toFixed(0)} cm): devolución obligatoria`,
        `${nota || ''} ${this.n.devolucion?.nativas || 'Es fauna nativa dentro de un área protegida: se devuelve.'}`.trim());
      return { esp, largoCm, conservado: false, motivo: 'nativa' };
    }

    // ── Salmónido: exótico, pero con medida
    const maxCm = this.n.medidas?.salmonidoMaximoCm ?? 40;
    if (largoCm > maxCm) {
      this.devoluciones++;
      this.saberes.otorgar(2, 'Devolviste un reproductor');
      this.hud.aviso(`${esp.nombreComun} de ${largoCm.toFixed(0)} cm: se devuelve`,
        `La normativa del parque apunta a conservar los ejemplares chicos y devolver los grandes, que son los mejores reproductores. ${this.n.devolucion?.comoSeHace || ''}`.trim());
      return { esp, largoCm, conservado: false, motivo: 'medida' };
    }

    const kg = (esp.pesoKg || 1) * Math.pow(largoCm / ((esp.largoM || 0.4) * 100), 3);
    const piezas = Math.max(1, Math.round(kg * 2.2));
    const n = this.inventario.agregar('pescado', piezas);
    this.capturas++;
    const regla = this.reglaPorEspecie.get(esp.id);
    this.hud.aviso(`${esp.nombreComun} de ${largoCm.toFixed(0)} cm`,
      n > 0
        ? `${n} × pescado · ${regla?.razonEcologica || 'Especie introducida: su extracción alivia la presión sobre los peces nativos.'}`
        : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`);
    return { esp, largoCm, conservado: n > 0, motivo: 'exotica' };
  }
}
