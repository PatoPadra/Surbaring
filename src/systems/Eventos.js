/**
 * Eventos naturales — los catorce fenómenos del dataset, sucediendo.
 *
 * `geografia.json` ya describía cada uno con su estacionalidad, su peligrosidad,
 * su frecuencia relativa, su efecto sobre una persona y —lo más útil de todo—
 * sus señales previas. Eso último es la parte educativa: en montaña casi nada
 * pasa de golpe, y saber leer el aviso es la diferencia entre volver y no.
 *
 * Por eso todo evento tiene tres momentos y el jugador los ve:
 *
 *   1. Señales previas. El HUD las anuncia antes, con el texto del dataset.
 *   2. Desarrollo. El evento modifica el estado del ambiente que ya calcula
 *      `Tiempo`: viento, visibilidad, temperatura, precipitación, exposición.
 *   3. Amaine. Se va como vino, con su propio aviso.
 *
 * Los eventos NO se sortean contra el vacío: se disparan cuando el clima
 * simulado los habilita. No hay viento blanco sin viento y sin nieve, ni
 * incendio con el suelo mojado. La frecuencia del dataset pondera, no decide.
 */

const H = 3600 * 1000;

/**
 * Qué hace cada fenómeno, más allá de su descripción.
 *
 * `condicion` mira el estado real del ambiente y la posición del jugador;
 * `aplicar` modifica el estado mientras dura. Todo lo que no está acá existe
 * igual en el códice: el dataset es la fuente, esto es sólo la mecánica.
 */
const EFECTOS = {
  viento_blanco: {
    horas: [2, 8],
    condicion: (e, c) => e.vientoKmh > 34 && c.altitudJugador > e.cotaNieve - 150 && e.temperatura < 4,
    aplicar: (e, f) => {
      e.vientoKmh *= 1.6 + f * 0.9;
      e.densidadNiebla += 0.0022 * f;      // ceguera blanca: no se ve nada
      e.nieve = Math.max(e.nieve, 0.5 * f);
      e.temperatura -= 3 * f;
      e.exposicion *= 1 - 0.12 * f;
    },
  },
  nevada_intensa: {
    horas: [4, 20],
    condicion: (e) => e.temperatura < 2.5 && e.nubosidad > 0.55,
    aplicar: (e, f) => {
      e.nieve = Math.max(e.nieve, 0.55 + 0.45 * f);
      e.lluvia = 0;
      e.densidadNiebla += 0.00055 * f;
      e.cotaNieve = Math.min(e.cotaNieve, 900);
      e.nubosidad = Math.min(0.98, e.nubosidad + 0.25 * f);
    },
  },
  tormenta_electrica: {
    horas: [1, 4],
    condicion: (e) => e.lluvia > 0.15 && e.temperatura > 8,
    aplicar: (e, f) => {
      e.lluvia = Math.min(1, e.lluvia + 0.35 * f);
      e.nubosidad = Math.min(0.98, e.nubosidad + 0.3 * f);
      e.vientoKmh *= 1 + 0.4 * f;
      e.rayos = f;                          // lo lee el cielo para los destellos
      e.exposicion *= 1 - 0.15 * f;
    },
  },
  granizo: {
    horas: [0.2, 0.8],
    condicion: (e) => e.lluvia > 0.30 && e.temperatura > 6 && e.temperatura < 18,
    aplicar: (e, f) => {
      e.granizo = f;
      e.lluvia = Math.min(1, e.lluvia + 0.2 * f);
      e.vientoKmh *= 1 + 0.3 * f;
    },
  },
  niebla_valle: {
    horas: [2, 6],
    condicion: (e, c) => (e.horaDecimal < 10 || e.horaDecimal > 20)
      && e.temperatura < 9 && c.altitudJugador < 1100,
    aplicar: (e, f, c) => {
      // La niebla de valle es un techo: por encima de la inversión hay sol
      const dentro = c.altitudJugador < 1100 ? 1 : 0;
      e.densidadNiebla += 0.00075 * f * dentro;
      e.exposicion *= 1 - 0.1 * f * dentro;
    },
  },
  inversion_termica: {
    horas: [4, 10],
    condicion: (e, c) => e.horaDecimal < 11 && e.vientoKmh < 14 && c.altitudJugador < 1400,
    aplicar: (e, f, c) => {
      // Se invierte el gradiente: abajo hace más frío que arriba
      const bajo = c.altitudJugador < 1000 ? 1 : 0;
      e.temperatura -= 4 * f * bajo;
      e.temperatura += 2.5 * f * (1 - bajo);
      e.densidadNiebla += 0.0004 * f * bajo;
      e.inversion = f;
    },
  },
  viento_zonda_este: {
    horas: [4, 14],
    condicion: (e) => e.vientoKmh > 25 && e.lluvia < 0.05,
    aplicar: (e, f) => {
      // Föhn: el aire baja la ladera de sotavento seco y caliente
      e.temperatura += 6 * f;
      e.humedadSuelo *= 1 - 0.6 * f;
      e.vientoKmh *= 1 + 0.5 * f;
      e.nubosidad *= 1 - 0.4 * f;
      e.lluvia = 0;
    },
  },
  sequia_estival: {
    horas: [48, 240],
    condicion: (e) => e.estacion === 'verano' && e.lluvia < 0.02 && e.temperatura > 18,
    aplicar: (e, f) => {
      e.humedadSuelo *= 1 - 0.8 * f;
      e.riesgoIncendio = Math.max(e.riesgoIncendio || 0, 0.6 + 0.4 * f);
    },
  },
  incendio_forestal: {
    horas: [10, 72],
    local: true,
    condicion: (e) => (e.riesgoIncendio || 0) > 0.5 && e.humedadSuelo < 0.12 && e.vientoKmh > 18,
    aplicar: (e, f) => {
      e.humo = f;
      e.densidadNiebla += 0.0005 * f;
      e.exposicion *= 1 - 0.1 * f;
      e.turbiedad += 2.5 * f;
    },
  },
  ceniza_volcanica: {
    horas: [12, 96],
    condicion: () => false,     // no se sortea: la dispara la erupción
    aplicar: (e, f) => {
      e.ceniza = Math.max(e.ceniza, 0.55 * f);
      e.turbiedad += 5 * f;
      e.densidadNiebla += 0.00035 * f;
      e.exposicion *= 1 - 0.2 * f;
    },
  },
  crecida_deshielo: {
    horas: [24, 96],
    condicion: (e) => e.estacion === 'primavera' && e.temperatura > 12,
    aplicar: (e, f) => { e.crecida = f; },
  },
  avalancha: {
    horas: [0.05, 0.2],
    local: true,
    condicion: (e, c) => e.nieve > 0.3 && c.pendienteJugador > 0.55
      && c.altitudJugador > e.cotaNieve,
    aplicar: (e, f) => { e.avalancha = f; },
  },
  lluvia_orografica: {
    horas: [3, 12],
    condicion: (e, c) => e.vientoKmh > 20 && e.nubosidad > 0.5 && c.humedadLugar > 0.55,
    aplicar: (e, f, c) => {
      // Descarga en la ladera de barlovento: al oeste llueve, al este no
      e.lluvia = Math.min(1, e.lluvia + 0.5 * f * c.humedadLugar);
      e.nubosidad = Math.min(0.98, e.nubosidad + 0.2 * f);
    },
  },
  helada_tardia: {
    horas: [3, 7],
    condicion: (e) => e.estacion === 'primavera' && e.horaDecimal < 9 && e.temperatura < 6,
    aplicar: (e, f) => {
      e.temperatura -= 5 * f;
      e.helada = f;
    },
  },
};

export class Eventos {
  /**
   * @param {{fenomenos: Array}} geografia
   * @param {object} deps {tiempo, mundo, jugador, hud, saberes, codice}
   */
  constructor(geografia, deps) {
    this.fenomenos = (geografia?.fenomenos || []).filter(f => EFECTOS[f.id]);
    this.porId = new Map(this.fenomenos.map(f => [f.id, f]));
    Object.assign(this, deps);

    /** @type {Array<{fen:object, desde:number, hasta:number, avisado:boolean, x?:number, z?:number}>} */
    this.activos = [];
    this.historial = [];
    this._ultimaTirada = 0;
    /** Cuántas horas de juego pasan entre tiradas de dado. */
    this.horasEntreTiradas = 3;
  }

  /** Intensidad 0..1 de un evento: entra y sale con una rampa, no de golpe. */
  _intensidad(ev, ahora) {
    const total = ev.hasta - ev.desde;
    const t = (ahora - ev.desde) / Math.max(1, total);
    if (t < 0 || t > 1) return 0;
    const rampa = Math.min(0.25, 0.5);
    if (t < rampa) return t / rampa;
    if (t > 1 - rampa) return (1 - t) / rampa;
    return 1;
  }

  activo(id) { return this.activos.find(a => a.fen.id === id); }

  /**
   * Contexto del jugador que necesitan las condiciones. Se arma una vez por
   * tirada en vez de por cuadro: son consultas al terreno.
   */
  _contexto() {
    const p = this.jugador.posicion;
    return {
      altitudJugador: p.y,
      pendienteJugador: this.mundo.pendienteEn(p.x, p.z),
      humedadLugar: this.mundo.humedadEn(p.x, p.z),
      x: p.x, z: p.z,
    };
  }

  /** Dispara un fenómeno a mano, con su aviso de señales previas. */
  disparar(id, horas = null) {
    const fen = this.porId.get(id);
    if (!fen || this.activo(id)) return null;
    const cfg = EFECTOS[id];
    const ahora = this.tiempo.fecha.getTime();
    const dur = horas ?? (cfg.horas[0] + Math.random() * (cfg.horas[1] - cfg.horas[0]));
    const p = this.jugador.posicion;

    const ev = {
      fen, desde: ahora, hasta: ahora + dur * H,
      // Los locales pasan en algún lugar concreto, no en todo el parque
      x: cfg.local ? p.x + (Math.random() - 0.5) * 2400 : null,
      z: cfg.local ? p.z + (Math.random() - 0.5) * 2400 : null,
    };
    this.activos.push(ev);
    this.historial.push({ id, desde: ahora });

    // El aviso previo es el contenido: en montaña casi nada pasa de golpe
    this.hud?.aviso(`${fen.nombre}`, fen.senalesPrevias || fen.descripcion);
    // Vivirlo y reconocerlo enseña; la primera vez de cada uno vale más
    if (this.historial.filter(h => h.id === id).length === 1) {
      this.saberes?.otorgar(Math.max(2, fen.peligrosidad || 1),
        `${fen.nombre}: fenómeno reconocido`);
    }
    return ev;
  }

  /** Sorteo periódico: el clima habilita, la frecuencia del dataset pondera. */
  _tirar(est, ctx) {
    for (const fen of this.fenomenos) {
      if (this.activo(fen.id)) continue;
      const cfg = EFECTOS[fen.id];
      if (!(fen.estaciones || []).includes(est.estacion)) continue;
      if (!cfg.condicion(est, ctx)) continue;
      // La frecuencia relativa del dataset pondera; el factor la convierte en
      // probabilidad por tirada. Calibrado para que un año en la costa del lago
      // deje ver unos cuarenta episodios y ninguno se vuelva rutina.
      const p = (fen.frecuenciaRelativa ?? 0.1) * 0.30;
      if (Math.random() < p) this.disparar(fen.id);
    }
  }

  /**
   * Aplica los eventos vivos sobre el estado del ambiente. Se llama una vez por
   * cuadro, con el estado recién calculado por `Tiempo`.
   */
  aplicar(est) {
    const ahora = this.tiempo.fecha.getTime();
    const ctx = this._contexto();

    // Los que se apagaron avisan que se fueron
    const terminados = this.activos.filter(a => ahora > a.hasta);
    if (terminados.length) {
      this.activos = this.activos.filter(a => ahora <= a.hasta);
      for (const t of terminados) this.hud?.aviso(`Amainó: ${t.fen.nombre.toLowerCase()}`, t.fen.efectoJugador);
    }

    est.riesgoIncendio = est.estacion === 'verano' ? 0.35 : 0.1;
    est.eventos = [];

    for (const ev of this.activos) {
      const f = this._intensidad(ev, ahora);
      if (f <= 0) continue;
      const cfg = EFECTOS[ev.fen.id];

      // Un evento local pierde fuerza con la distancia: el incendio de la
      // ladera de enfrente se ve y se huele, pero no quema acá.
      let escala = f;
      if (cfg.local) {
        const d = Math.hypot(ev.x - ctx.x, ev.z - ctx.z);
        escala = f * Math.max(0, 1 - d / 3000);
        ev.distancia = d;
      }
      if (escala <= 0.001) continue;

      cfg.aplicar(est, escala, ctx);
      est.eventos.push({
        id: ev.fen.id, nombre: ev.fen.nombre, intensidad: escala,
        x: ev.x, z: ev.z, distancia: ev.distancia,
      });
    }

    // El sorteo va DESPUÉS de aplicar lo que ya está activo, y no antes: si no,
    // la sequía nunca podría encadenar con el incendio, porque el riesgo que
    // ella misma levanta todavía no existiría cuando se tira el dado. Un evento
    // que arranca acá empieza a notarse en el cuadro siguiente, que a escala de
    // horas del mundo no se percibe.
    const horasDesde = (ahora - this._ultimaTirada) / H;
    if (horasDesde > this.horasEntreTiradas || this._ultimaTirada === 0) {
      this._ultimaTirada = ahora;
      this._tirar(est, ctx);
    }

    // Saneamiento: los modificadores se acumulan y no todo tiene tope propio
    est.vientoKmh = Math.min(190, est.vientoKmh);
    est.densidadNiebla = Math.min(0.006, est.densidadNiebla);
    est.exposicion = Math.max(0.4, est.exposicion);
    return est;
  }

  /**
   * Daño y desgaste que los eventos causan directamente, aparte de lo que ya
   * hace el modelo térmico con el viento y la temperatura.
   */
  /**
   * Deja escrito qué fenómeno está matando, para que la pantalla de fin pueda
   * explicarlo.
   *
   * Los tres fenómenos que más enseñan sobre esta cordillera —la avalancha y el
   * rayo matan gente real todos los años en el Catedral y el Tronador— restaban
   * salud sin tocar `causaMuerte`, así que morir aplastado por una placa de
   * nieve mostraba el texto genérico del desgaste: "comer, beber y no dormir a
   * la intemperie no son detalles". El único momento en que el jugador está
   * prestando atención de verdad, gastado en decir cualquier cosa.
   */
  _marcarCausa(jugador, causa, ev, extra) {
    jugador.causaExterna = { causa, fenomeno: ev, ...extra };
    // Sellada con la hora: un rayo de hace tres días no explica una muerte por
    // sed. El cuerpo decide después cuál de las dos causas estaba matando.
    jugador.causaExternaEn = jugador.horasVividas;
  }

  golpear(dt, est, jugador, horasJuego) {
    const p = jugador.posicion;
    for (const ev of est.eventos || []) {
      if (!ev.intensidad) continue;
      switch (ev.id) {
        case 'incendio_forestal': {
          // Cerca del frente el aire quema y el humo asfixia
          const d = ev.distancia ?? 9999;
          if (d < 90) {
            jugador.salud = Math.max(0, jugador.salud - 42 * horasJuego);
            this._marcarCausa(jugador, 'incendio', ev, { distancia: Math.round(d) });
          }
          else if (d < 600) jugador.energia = Math.max(0, jugador.energia - 14 * horasJuego);
          break;
        }
        case 'avalancha': {
          if (this.mundo.pendienteEn(p.x, p.z) > 0.5) {
            jugador.salud = Math.max(0, jugador.salud - 55 * horasJuego);
            this._marcarCausa(jugador, 'avalancha', ev, {
              pendienteGrados: this.mundo.pendienteEn(p.x, p.z) * 180 / Math.PI,
            });
          }
          break;
        }
        case 'granizo':
          jugador.energia = Math.max(0, jugador.energia - 10 * horasJuego * ev.intensidad);
          break;
        case 'tormenta_electrica':
          // Los rayos caen en lo alto y en lo expuesto
          if (p.y > 1700 && Math.random() < 0.0009 * ev.intensidad) {
            jugador.salud = Math.max(0, jugador.salud - 35);
            this._marcarCausa(jugador, 'rayo', ev, {});
            this.hud?.aviso('Cayó un rayo cerca',
              'En tormenta, la cumbre y la arista son el peor lugar del cerro. Se baja y se busca terreno bajo, lejos de árboles aislados.');
          }
          break;
      }
    }
  }

  /**
   * Qué fenómenos habilita el ambiente ahora mismo, sin sortear nada. Existe
   * para poder calibrar: sirve para distinguir "no pasa nunca porque el dado no
   * quiere" de "no pasa nunca porque la condición es imposible".
   */
  diagnostico(est = null, ctx = null) {
    const e = est || this.tiempo.estado();
    const c = ctx || this._contexto();
    e.riesgoIncendio ??= e.estacion === 'verano' ? 0.35 : 0.1;
    return this.fenomenos
      .filter(f => (f.estaciones || []).includes(e.estacion) && EFECTOS[f.id].condicion(e, c))
      .map(f => f.id);
  }

  /** Lo que el HUD necesita mostrar arriba: qué está pasando ahora. */
  resumen() {
    return this.activos.map(a => ({
      id: a.fen.id,
      nombre: a.fen.nombre,
      peligrosidad: a.fen.peligrosidad,
      intensidad: this._intensidad(a, this.tiempo.fecha.getTime()),
      distancia: a.distancia,
    })).filter(a => a.intensidad > 0.02);
  }
}
