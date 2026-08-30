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
 * 3. El fuego lo apaga el agua. No es un detalle de ambientación: una fogata al
 *    descubierto no aguanta una lluvia sostenida, y prender sobre suelo
 *    empapado cuesta el doble de leña. Lo que decide no es el clima solo sino
 *    el techo que tenga cada horno, y por eso una carbonera arde días bajo
 *    llovizna y se muere en un temporal.
 * 4. El fuego está regulado. En el Parque Nacional sólo se enciende en sitios
 *    habilitados, y una carbonera es un fuego que arde días. La negativa
 *    también enseña.
 * 5. La llama es una cosa y la hornada es otra. Un fuego arde mientras tenga
 *    leña, se esté cocinando algo o no, y ésa es la razón por la que uno lo
 *    enciende: para no morirse de frío. Cocinar es lo que se le hace encima.
 *    Tenerlo al revés —que el fuego existiera sólo mientras había una receta
 *    cargada— convertía la fogata en un electrodoméstico y dejaba al jugador
 *    a la intemperie con las llamas al lado.
 *
 * El tiempo de cocción corre en horas del mundo, no en segundos reales: con la
 * tecla de velocidad del tiempo, una carbonera de treinta horas se resuelve en
 * lo que dura una caminata.
 */

import { normalizar, nombreDe } from './Recursos.js';

const MS_HORA = 3600 * 1000;
const RADIO_HORNO_M = 8;

/** Valores por defecto de la humedad, por si el dataset no los trae. */
const HUMEDAD = {
  umbralApagado: 0.72,
  umbralNoPrende: 0.95,
  mojadoPorHoraDeLluvia: 0.9,
  factorNieve: 0.5,
  secadoPorHora: 0.22,
  secadoDelPropioFuego: 1.6,
  leniaExtraMaxima: 3,
  demoraMaximaPorHumedad: 0.4,
};

/** Un horno de obra —ahumadero, aserradero— tiene techo pero no es hermético. */
const RESGUARDO_DE_OBRA = 0.6;

/** Cuánto rinde la leña, por si el dataset no lo trae. */
const CARGA = { lenia: 2, horasPorLenia: 1.5 };

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
    /** Recetas que aportan otros sistemas: el aserradero, el ahumadero, el molino. */
    this.recetasExtra = [];
    /** Ambiente del cuadro anterior: lo pone `actualizar()`. */
    this.ambiente = null;
    this._ultimoMs = null;
  }

  get humedad() { return { ...HUMEDAD, ...(this.d.fuego?.humedad || {}) }; }
  get carga() { return { ...CARGA, ...(this.d.fuego?.carga || {}) }; }
  get encendedores() { return this.d.fuego?.encendedores?.usa || []; }

  get definicionesHorno() { return this.d.hornos || []; }
  get recetas() { return [...(this.d.recetas || []), ...this.recetasExtra]; }

  /** Registrar recetas de obras que procesan, para que el taller las muestre. */
  agregarRecetas(recetas) {
    this.recetasExtra.push(...recetas);
  }

  hornoPorId(id) { return this.definicionesHorno.find(h => h.id === id); }

  // ── La llama ──────────────────────────────────────────────────────────────

  /**
   * ¿Este horno anda a fuego? El aserradero y el molino figuran como hornos del
   * taller porque para el jugador funcionan igual —se cargan y se espera— pero
   * los mueve el agua: pedirles yesca para serruchar un tronco no tenía sentido.
   * Los que queman son los que declaran temperatura.
   */
  usaFuego(horno) { return !!horno.def?.temperaturaC; }

  /** ¿Hay llama ahora mismo? Lo que no quema está siempre listo. */
  arde(horno) {
    if (!this.usaFuego(horno)) return true;
    return !!horno.fuego && this.tiempo.fecha.getTime() < horno.fuego.hasta;
  }

  /** Horas del mundo que le quedan a la leña cargada. */
  horasDeFuego(horno) {
    if (!horno.fuego) return 0;
    return Math.max(0, (horno.fuego.hasta - this.tiempo.fecha.getTime()) / MS_HORA);
  }

  /**
   * Cuánto dura una carga de leña acá. El techo no sólo tapa el agua: un hogar
   * cerrado devuelve el calor en vez de mandarlo al cielo, y la misma leña rinde
   * mucho más. Por eso una carbonera arde días y una fogata, una tarde.
   */
  horasPorCarga(horno) {
    const c = this.carga;
    return c.lenia * c.horasPorLenia * (1 + this.resguardoDe(horno));
  }

  /**
   * Prender el fuego. Era la operación que faltaba, y no era una comodidad: sin
   * ella el calor lo daba la hornada, así que se podía levantar una fogata,
   * pasar la noche contra las llamas y morirse de hipotermia igual.
   *
   * Encender cuesta yesca —lo que agarra la chispa— y leña, que es lo que dura.
   * Avivar un fuego que ya arde cuesta sólo leña: nadie tira yesca sobre brasas.
   *
   * @param {object} opts
   *   `gratis`: la primera carga de una fogata recién armada no cobra leña,
   *   porque las seis leñas que costó armarla son exactamente el fuego.
   *   `avisar`: false cuando el aviso lo da quien llama.
   */
  encender(horno, { gratis = false, avisar = true } = {}) {
    if (!this.usaFuego(horno)) return false;
    const yaArde = this.arde(horno);
    const cond = yaArde
      ? { prende: true, usos: [], leniaExtra: 0, demora: 0 }
      : this.condicionEncendido(horno);
    if (!cond.prende) {
      if (avisar) this.hud.aviso(`${horno.def.nombre}: no prende`, cond.motivo);
      return false;
    }

    const lenia = gratis ? 0 : this.carga.lenia;
    const total = lenia + (cond.leniaExtra || 0);
    const hay = this.inventario.disponiblePara('lena');
    if (total > hay) {
      if (avisar) this.hud.aviso(`${horno.def.nombre}: falta leña`,
        cond.leniaExtra
          ? `Con el horno así hacen falta ${total} —${lenia} de carga y ${cond.leniaExtra} `
            + `de más para que agarre— y tenés ${hay}`
          : `Una carga son ${total} de leña y tenés ${hay}`);
      return false;
    }
    if (!this._cobrarEncendido(cond, horno)) return false;
    if (lenia) this.inventario.consumirPara('lena', lenia);

    // La leña se suma a la que ya está ardiendo: avivar estira, no reinicia
    const ahora = this.tiempo.fecha.getTime();
    const base = Math.max(ahora, horno.fuego?.hasta ?? 0);
    horno.fuego = { hasta: base + this.horasPorCarga(horno) * MS_HORA };
    horno.ardiendo = true;

    // Si adentro había una hornada esperando fuego, sigue donde quedó
    const t = horno.trabajo;
    if (t?.apagado) {
      t.apagado = false;
      t.hasta += (t.hasta - t.desde) * cond.demora;
    }

    if (avisar) {
      const partes = [];
      if (lenia) partes.push(`${lenia} × ${nombreDe('lena')}`);
      const costo = this.textoEncendido(cond);
      if (costo) partes.push(costo);
      this.hud.aviso(`${horno.def.nombre}: ${yaArde ? 'fuego avivado' : 'fuego encendido'}`,
        `Arde ${this.horasDeFuego(horno).toFixed(1)} h más`
        + (partes.length ? ` · ${partes.join(' · ')}` : ''));
    }
    this.alCambiar?.();
    return true;
  }

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
      this.hud.negativa(fuego, { fecha: this.tiempo?.textoFecha });
      return null;
    }

    // Dos hornos no entran en el mismo lugar, y encimarlos dejaría uno
    // inalcanzable: `cercano()` devolvería siempre el mismo.
    if (this.hornos.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 4)) {
      this.hud.aviso('Muy encima de otro horno', 'Correte unos pasos: cada uno necesita su lugar');
      return null;
    }

    // ¿Este horno pide saber algo? La bóveda de barro sí: sin alfarería no se
    // levanta. La fragua NO, y no es un olvido: la herrería pide cuatro de
    // hierro y el hierro sale de la fragua, así que ponerla detrás sería un
    // bloqueo circular perfecto. Lo que se aprende para forjar es la
    // herramienta, y ése es el requisito que lleva.
    const tec = this.saberes?.faltaPara('horno', def.id);
    if (tec) {
      this.hud.aviso(`Todavía no sabés levantar ${def.nombre.toLowerCase()}`,
        `Hace falta aprender «${tec.nombre}» en el códice (${tec.costoSaber} puntos de saber)`);
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
      // Se levanta seco: lo que moja después es la intemperie
      mojado: 0,
      // La llama, aparte de la hornada: `{hasta}` mientras haya leña
      fuego: null, ardiendo: false,
    };
    this.hornos.push(horno);
    this.saberes.otorgar(3, `${def.nombre} en pie`);

    // Armar una fogata ES encenderla. Nadie apila leña y piedras para mirarlas,
    // y separar las dos cosas era exactamente lo que dejaba al jugador con la
    // fogata hecha preguntándose cómo se prende. La primera carga va sin cobrar
    // leña porque las seis que costó armarla son el fuego; la yesca sí se paga.
    // Si el día no da —empapado, sin nada que agarre— queda armada y fría, con
    // el motivo escrito, que también es información.
    let nota = fuego.nota || def.descripcion;
    if (def.enciendeAlLevantar) {
      const cond = this.condicionEncendido(horno);
      const costo = this.textoEncendido(cond);
      nota = this.encender(horno, { gratis: true, avisar: false })
        ? `Prendida: arde ${this.horasDeFuego(horno).toFixed(1)} h`
          + (costo ? ` · costó ${costo}` : '')
          + '. Calienta, seca y cocina. Cargale más leña desde el taller.'
        : `Armada, pero no prende: ${cond.motivo || 'no agarra'}`;
    }
    this.hud.aviso(def.nombre, nota);
    this.alCambiar?.();
    return horno;
  }

  // ── Humedad ───────────────────────────────────────────────────────────────

  /**
   * Cuánto techo tiene este horno, de 0 (fuego al descubierto) a 1 (a cubierto).
   * Los hornos que vienen de una obra construida tienen techo por definición:
   * un ahumadero sin techo no ahúma nada.
   */
  resguardoDe(horno) {
    const r = horno.def?.resguardo;
    return typeof r === 'number' ? r : RESGUARDO_DE_OBRA;
  }

  /** Precipitación efectiva que le llega a este horno, de 0 a 1. */
  _precipitacionSobre(horno, est) {
    const cae = (est?.lluvia || 0) + (est?.nieve || 0) * this.humedad.factorNieve;
    return cae * (1 - this.resguardoDe(horno));
  }

  /**
   * Lo que se opone a que prenda: el horno mojado, el agua que está cayendo
   * ahora y el suelo empapado de los días anteriores. Por encima de 1 no hay
   * yesca que alcance.
   */
  resistenciaAPrender(horno, est = this.ambiente) {
    const expuesto = 1 - this.resguardoDe(horno);
    const suelo = (est?.humedadSuelo || 0) * expuesto;
    return Math.min(1.6,
      (horno.mojado || 0) * 0.95
      + this._precipitacionSobre(horno, est) * 1.15
      + suelo * 0.5);
  }

  /**
   * Qué hay en el bolso para ayudar a prender y cuánto descuenta.
   *
   * Se gasta de lo mejor a lo peor y sólo lo necesario: si con un pellet
   * alcanza, no se queman cuatro. Nadie tira yesca de más, porque juntarla
   * cuesta más que la leña.
   */
  _ayudaParaPrender(resistencia) {
    let falta = resistencia;
    const usos = [];
    for (const e of this.encendedores) {
      if (falta <= 0) break;
      const hay = this.inventario.disponiblePara(e.recurso);
      if (hay <= 0) continue;
      const n = Math.min(hay, e.maximo ?? 99, Math.ceil(falta / e.poder));
      if (n <= 0) continue;
      usos.push({ recurso: e.recurso, cantidad: n, nota: e.nota });
      falta -= n * e.poder;
    }
    return { usos, restante: Math.max(0, falta) };
  }

  /**
   * Veredicto de encendido: si prende, con qué se prende, con cuánta leña
   * extra y cuánto más lento. La leña mojada arde igual, sólo que hay que
   * quemar más para llegar a la misma temperatura; lo que decide si llega a
   * arder es lo que uno tenga para darle los primeros treinta segundos.
   */
  condicionEncendido(horno, est = this.ambiente) {
    const h = this.humedad;
    const bruta = this.resistenciaAPrender(horno, est);
    const ayuda = this._ayudaParaPrender(bruta);
    const r = ayuda.restante;

    if (r >= h.umbralNoPrende) {
      const conYesca = bruta - r > 0.01;
      return {
        prende: false, resistencia: r, resistenciaBruta: bruta,
        usos: [], leniaExtra: 0, demora: 0,
        motivo: this._precipitacionSobre(horno, est) > 0.2
          ? (conYesca
              ? 'Cae demasiada agua: ni con la yesca que tenés llega a agarrar'
              : 'Está cayendo agua justo encima y no hay con qué prender')
          : (conYesca
              ? 'Está empapado: haría falta más yesca o unos pellets'
              : 'Está todo empapado: no hay yesca que agarre'),
      };
    }
    const leniaExtra = Math.round(r / h.umbralNoPrende * h.leniaExtraMaxima);
    return {
      prende: true, resistencia: r, resistenciaBruta: bruta,
      usos: ayuda.usos, leniaExtra,
      demora: r * h.demoraMaximaPorHumedad,
    };
  }

  /** Cobra lo que cuesta el encendido: primero la yesca, después la leña extra. */
  _cobrarEncendido(cond, horno) {
    if (cond.leniaExtra) {
      const hay = this.inventario.disponiblePara('lena');
      if (hay < cond.leniaExtra) {
        this.hud.aviso(`${horno.def.nombre}: no prende en mojado`,
          `Con esta humedad hacen falta ${cond.leniaExtra} de leña extra y tenés ${hay}`);
        return false;
      }
      this.inventario.consumirPara('lena', cond.leniaExtra);
    }
    for (const u of cond.usos || []) {
      this.inventario.consumirPara(u.recurso, u.cantidad);
    }
    return true;
  }

  /** Cómo se lee lo que se gastó en prender: '2 × Yesca · 1 × Leña'. */
  textoEncendido(cond) {
    const partes = (cond.usos || []).map(u => `${u.cantidad} × ${nombreDe(u.recurso)}`);
    if (cond.leniaExtra) partes.push(`${cond.leniaExtra} × ${nombreDe('lena')} extra`);
    return partes.join(' · ');
  }

  /**
   * Moja y seca los hornos al ritmo del mundo, y apaga los que se ahogan. Se
   * llama todos los cuadros, pero el reloj que manda es el del juego: con el
   * tiempo acelerado, una tormenta apaga la fogata en lo que dura un trote.
   */
  _correrHumedad(est, ahora) {
    if (this._ultimoMs == null) { this._ultimoMs = ahora; return; }
    const horas = Math.max(0, Math.min(6, (ahora - this._ultimoMs) / MS_HORA));
    this._ultimoMs = ahora;
    if (!horas) return;
    const h = this.humedad;

    for (const horno of this.hornos) {
      const encendido = this.usaFuego(horno) && this.arde(horno) && !horno.trabajo?.esperando;
      const moja = this._precipitacionSobre(horno, est) * h.mojadoPorHoraDeLluvia;

      // Seca el sol, seca el viento y sobre todo seca el propio fuego
      const seca = h.secadoPorHora
        * (0.35 + (1 - (est?.nubosidad ?? 0.5)) * 0.9 + Math.min(1, (est?.vientoKmh || 0) / 45))
        + (encendido ? h.secadoDelPropioFuego : 0);

      horno.mojado = Math.max(0, Math.min(1.2, (horno.mojado || 0) + (moja - seca) * horas));

      if (encendido && horno.mojado >= h.umbralApagado) {
        this._apagar(horno, est);
      }
    }
  }

  /**
   * Matar la llama sin borrarla. La hora en que se murió queda anotada porque
   * es el dato con el que después se decide cuánto alcanzó a cocinarse la
   * hornada: si se borrara, un salto grande del reloj —y con la tecla T los
   * saltos son de horas— no sabría distinguir un fuego que aguantó hasta el
   * final de uno que se apagó en el primer minuto.
   */
  _matarLlama(horno) {
    const ahora = this.tiempo.fecha.getTime();
    horno.fuego = { hasta: Math.min(horno.fuego?.hasta ?? ahora, ahora), consumido: true };
    horno.ardiendo = false;
  }

  /**
   * El agua gana. La leña que quedaba se pierde —está empapada— y la hornada
   * no: queda donde está, fría, y el progreso se congela hasta que alguien la
   * vuelva a encender.
   */
  _apagar(horno, est) {
    this._matarLlama(horno);
    const t = horno.trabajo;
    if (t) t.apagado = true;
    const nieve = (est?.nieve || 0) > (est?.lluvia || 0);
    const agua = nieve ? 'La nieve ahogó el fuego' : 'La lluvia ahogó el fuego';
    this.hud.aviso(`Se apagó ${horno.def.nombre.toLowerCase()}`,
      t ? `${agua} · ${t.receta.nombre} quedó a medio hacer` : agua);
    this.alCambiar?.();
  }

  /**
   * Se acabó la leña. No es una desgracia como la lluvia: es lo que hace un
   * fuego. Avisarlo importa porque el jugador dormido al lado de las brasas
   * pierde el calor sin enterarse.
   */
  _consumido(horno) {
    horno.fuego.consumido = true;
    horno.ardiendo = false;
    const t = horno.trabajo;
    if (t) t.apagado = true;
    this.hud.aviso(`Se consumió la leña de ${horno.def.nombre.toLowerCase()}`,
      t ? `${t.receta.nombre} quedó a medio hacer: cargale leña y volvé a prender`
        : 'Quedaron las brasas. Cargale leña desde el taller para que siga ardiendo.');
    this.alCambiar?.();
  }

  // ── Cocción ───────────────────────────────────────────────────────────────

  recetasDe(hornoId) {
    return this.recetas.filter(r => {
      if (r.horno !== hornoId) return false;
      // Una receta que pide saber algo no se muestra hasta saberlo, y una que
      // pide una especie no se muestra hasta haberla identificado: un remedio
      // que no se sabe reconocer no es un remedio, es una hoja.
      if (this.saberes?.faltaPara('recetas', r.id)) return false;
      if (r.requiereEspecie && !this.codice?.identificadas?.has(r.requiereEspecie)) return false;
      return true;
    });
  }

  /** Estado de una receta: lista, sin material, u ocupada. */
  estadoReceta(receta, horno) {
    if (horno.trabajo) return { estado: horno.trabajo.apagado ? 'apagado' : 'ocupado' };
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
    if (e.estado === 'ocupado' || e.estado === 'apagado') {
      this.hud.aviso(`${horno.def.nombre} ocupado`, e.estado === 'apagado'
        ? 'Hay una hornada apagada adentro: volvé a encenderla o esperá'
        : 'Esperá a que termine la carga anterior');
      return false;
    }
    // Cargar una hornada sobre un fuego que ya arde no cuesta encenderlo: la
    // yesca se gasta una vez, cuando se prende, y no cada vez que se pone algo
    // encima. Sobre un horno frío, cargar lo prende —la leña de la receta es el
    // combustible— y así el gesto de siempre sigue funcionando igual.
    const cond = this.arde(horno)
      ? { prende: true, usos: [], leniaExtra: 0, demora: 0 }
      : this.condicionEncendido(horno);
    if (!cond.prende) {
      this.hud.aviso(`${horno.def.nombre}: no prende`, cond.motivo);
      return false;
    }
    // Los materiales se comprueban ANTES de cobrar el encendido, y la leña del
    // encendido entra en la misma cuenta que la de la receta.
    //
    // Estaba al revés: se quemaba la yesca —que el propio dataset describe como
    // escasa, «conviene juntar poca y en un día bueno, para el día malo»— y los
    // pellets, y recién después se avisaba que faltaba material. Y había un
    // agujero peor: `estadoReceta` mira cada ingrediente por separado y no sabe
    // de la leña extra que pide un horno mojado, así que con la leña justa entre
    // lo que pide la receta y lo que pide el encendido, el estado daba «lista»,
    // el encendido se comía la leña de la receta, y el consumo posterior se
    // quedaba corto en silencio: `consumirPara` devuelve false y nadie lo mira.
    // La hornada arrancaba igual y rendía completo habiendo cocinado con menos.
    if (e.estado === 'falta') {
      this.hud.aviso(`Falta material para ${receta.nombre.toLowerCase()}`,
        e.falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(' · '));
      return false;
    }
    const lenaReceta = (receta.entra || [])
      .filter(m => normalizar(m.recurso) === 'lena')
      .reduce((a, m) => a + m.cantidad, 0);
    const lenaTotal = lenaReceta + (cond.leniaExtra || 0);
    if (lenaTotal > 0 && this.inventario.disponiblePara('lena') < lenaTotal) {
      this.hud.aviso(`Falta leña para ${receta.nombre.toLowerCase()}`,
        `Con el horno así hacen falta ${lenaTotal} en total: ${lenaReceta} para la hornada `
        + `y ${cond.leniaExtra} de más para que prenda`);
      return false;
    }

    if (!this._cobrarEncendido(cond, horno)) return false;
    for (const m of receta.entra || []) {
      this.inventario.consumirPara(normalizar(m.recurso), m.cantidad);
    }
    const horas = (receta.horas || 1) * (1 + cond.demora);
    const ahora = this.tiempo.fecha.getTime();
    horno.trabajo = {
      receta,
      desde: ahora,
      hasta: ahora + horas * MS_HORA,
      apagado: false,
    };
    // La leña de la receta es el combustible de la hornada: mientras cocina, la
    // llama no se muere de hambre. Por lluvia sí se apaga, y eso no cambia.
    if (this.usaFuego(horno)) {
      horno.fuego = { hasta: Math.max(horno.fuego?.hasta ?? 0, ahora + horas * MS_HORA) };
      horno.ardiendo = true;
    }
    const costo = this.textoEncendido(cond);
    this.hud.aviso(`${receta.nombre} en el fuego`, costo
      ? `Costó prenderlo: ${costo} · ${horas.toFixed(1)} h`
      : (receta.nota || `${receta.horas} h de cocción`));
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
  actualizar(est) {
    const ahora = this.tiempo.fecha.getTime();
    if (est) this.ambiente = est;
    const anterior = this._ultimoMs ?? ahora;
    this._correrHumedad(this.ambiente, ahora);

    for (const h of this.hornos) {
      // La leña se acaba. Un fuego no es un estado que se queda prendido solo:
      // es lo que separa tener leña juntada de no tenerla.
      if (h.fuego && !h.fuego.consumido && ahora >= h.fuego.hasta) this._consumido(h);
      h.ardiendo = this.usaFuego(h) && this.arde(h);

      const t = h.trabajo;
      if (!t || t.esperando) continue;

      // Lo que cuece es la llama, y la llama tiene fecha de muerte: la leña que
      // le queda. De este tramo de reloj sólo cuenta el pedazo en que hubo
      // fuego; el resto se le devuelve a la hornada corriéndole la ventana
      // entera, así que el progreso se congela donde estaba.
      //
      // Comparar contra la fecha, y no contra un simple «¿arde ahora?», es lo
      // que hace que esto aguante los saltos de reloj: con la tecla T un solo
      // cuadro puede cubrir seis horas, y adentro de esas seis puede haberse
      // apagado el fuego, terminado la hornada, o las dos cosas.
      const muerte = this.usaFuego(h) ? (h.fuego?.hasta ?? anterior) : Infinity;
      const quieto = ahora - Math.max(anterior, Math.min(ahora, muerte));
      if (quieto > 0) { t.desde += quieto; t.hasta += quieto; }
      if (ahora < t.hasta) continue;

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
