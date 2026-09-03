/**
 * Partida — guardar y morir, a la manera de Rust.
 *
 * Hasta acá sobrevivían el mapa explorado y poco más: morirse borraba el bolso,
 * las obras levantadas y las tecnologías, y recargar la página borraba todo. Un
 * juego de supervivencia que no recuerda nada no tiene apuesta: si perder no
 * cuesta y ganar no queda, cada sesión arranca en cero.
 *
 * La regla elegida es la de Rust, y es una regla de diseño, no una comodidad:
 *
 * - **Se guarda solo.** Cada minuto de reloj real y al cerrar la pestaña. No
 *   hay ranuras ni "guardar antes de arriesgarse": guardar a mano justo antes
 *   de una decisión difícil es lo que vacía de peso a la decisión.
 * - **Al morir perdés lo que cargabas encima.** El bolso entero, ahí donde
 *   caíste. Es lo único que se pierde, y es lo que hace que salir cargado de
 *   cuarenta kilos a cruzar un filo de noche sea una apuesta y no un trámite.
 * - **Reaparecés en una base.** La más cercana al lugar donde moriste, entre
 *   las obras que abrigan o guardan. Sin base, volvés a la costa donde empezó
 *   todo. Eso convierte a "levantar un refugio arriba" en una decisión
 *   estratégica: es un punto de reaparición, no un adorno.
 * - **Lo guardado en un depósito sobrevive.** Es el motivo para tener base y
 *   para pasar por ella antes de la excursión larga: lo que dejaste, te espera.
 * - **Lo aprendido no se pierde nunca.** Códice, tecnologías y mapa son
 *   conocimiento, y el conocimiento no se cae con el cuerpo. Ésa es la tesis
 *   del juego entero.
 *
 * El formato es JSON plano en localStorage, con un número de versión: si un día
 * cambia la forma, una partida vieja se descarta sola en vez de romper el
 * arranque.
 */

const CLAVE = 'survibar.partida.v1';
const VERSION = 1;
const INTERVALO_S = 60;
const RADIO_BASE_M = 6;      // dónde exactamente aparece uno respecto de la obra

export class Partida {
  /**
   * @param {object} deps {jugador, inventario, saberes, codice, construccion,
   *                       fundicion, mineria, tiempo, mundo, hud, obras, hornos}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.ultimoGuardado = 0;
    this._acum = 0;
    /** Lo que quedó tirado donde murió el jugador, por si un día se recupera. */
    this.ultimaMuerte = null;

    addEventListener('beforeunload', () => this.guardar());
    // En móviles `beforeunload` no dispara: el evento fiable es éste
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.guardar();
    });
  }

  // ── Bases ─────────────────────────────────────────────────────────────────

  /** Las obras que sirven como punto de reaparición: las que abrigan o guardan. */
  get bases() {
    return (this.construccion?.obras || []).filter(o => o.obra.abrigo || o.obra.guarda);
  }

  /** La base más cercana a un punto, si hay alguna. */
  baseCercana(x, z) {
    let mejor = null, mejorD = Infinity;
    for (const b of this.bases) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < mejorD) { mejor = b; mejorD = d; }
    }
    return mejor ? { base: mejor, distancia: mejorD } : null;
  }

  // ── Muerte ────────────────────────────────────────────────────────────────

  /**
   * Se llama cuando el jugador muere, antes de mostrar la pantalla de fin: el
   * bolso se vacía en el acto, así que lo que la pantalla cuenta ya es cierto.
   * Devuelve el resumen de la pérdida para que el final lo muestre.
   */
  registrarMuerte(motivo) {
    const p = this.jugador.posicion;
    const perdido = this.inventario.listar();
    const kg = this.inventario.pesoKg;
    this.inventario.items.clear();
    this.inventario.alCambiar?.();

    const destino = this.baseCercana(p.x, p.z);
    this.ultimaMuerte = {
      x: p.x, z: p.z, causa: motivo?.causa || 'agotamiento',
      perdido: perdido.map(i => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad })),
      kg: +kg.toFixed(1),
      base: destino?.base?.obra?.nombre || null,
      distancia: destino ? Math.round(destino.distancia) : null,
    };
    this.guardar();
    return this.ultimaMuerte;
  }

  /**
   * Devuelve al jugador al mundo: cuerpo nuevo, bolso vacío, y de pie en la
   * base más cercana al lugar donde cayó.
   */
  reaparecer() {
    this.jugador.revivir();
    const m = this.ultimaMuerte;
    const destino = m ? this.baseCercana(m.x, m.z) : this.baseCercana(
      this.jugador.posicion.x, this.jugador.posicion.z);

    if (destino) {
      const b = destino.base;
      // Unos pasos al costado de la obra, no dentro de ella
      const ang = Math.random() * Math.PI * 2;
      const x = b.x + Math.cos(ang) * RADIO_BASE_M;
      const z = b.z + Math.sin(ang) * RADIO_BASE_M;
      this.jugador.posicion.set(x, this.mundo.alturaEn(x, z) + 1.2, z);
      this.jugador.velocidad.set(0, 0, 0);
      const dep = this.construccion.depositoCercano(b.x, b.z);
      this.hud?.aviso(`De vuelta en ${b.obra.nombre.toLowerCase()}`,
        dep ? `Lo que dejaste guardado sigue ahí: ${this.construccion.pesoGuardado(dep).toFixed(1)} kg.`
            : 'Lo que cargabas encima quedó donde caíste.');
    } else {
      this.jugador.aparecerEn(-41.0870, -71.4290);
      this.hud?.aviso('De vuelta en la costa',
        'Sin una base levantada no hay dónde reaparecer: un refugio o un depósito es también un lugar al que volver.');
    }
    this.guardar();
  }

  // ── Guardado ──────────────────────────────────────────────────────────────

  actualizar(dt) {
    this._acum += dt;
    if (this._acum < INTERVALO_S) return;
    this._acum = 0;
    this.guardar();
  }

  get textoUltimoGuardado() {
    if (!this.ultimoGuardado) return 'nunca';
    const s = Math.round((Date.now() - this.ultimoGuardado) / 1000);
    if (s < 10) return 'recién';
    if (s < 90) return `hace ${s} s`;
    return `hace ${Math.round(s / 60)} min`;
  }

  _serializar() {
    const j = this.jugador;
    return {
      version: VERSION,
      fecha: Date.now(),
      jugador: {
        x: j.posicion.x, y: j.posicion.y, z: j.posicion.z, giro: j.giro,
        salud: j.salud, energia: j.energia, hambre: j.hambre, sed: j.sed,
        temperatura: j.temperatura, horasVividas: j.horasVividas,
      },
      tiempo: { ms: this.tiempo?.fecha?.getTime?.() ?? null },
      inventario: [...this.inventario.items],
      saberes: {
        puntos: this.saberes.puntos,
        ganadosTotales: this.saberes.ganadosTotales,
        desbloqueadas: [...this.saberes.desbloqueadas],
      },
      codice: {
        descubiertas: [...(this.codice?.descubiertas || [])],
        identificadas: [...(this.codice?.identificadas || [])],
        lugares: [...(this.codice?.lugares || [])],
      },
      obras: (this.construccion?.obras || []).map(o => ({
        id: o.obra.id, x: o.x, y: o.y, z: o.z, vence: o.vence,
        guardado: [...o.guardado],
        // Los hornos de obra se rehacen al reponer la obra, así que la carga en
        // curso viaja con ella
        trabajo: this._serializarTrabajo(
          (this.fundicion?.hornos || []).find(h => h.def.id === o.obra.id
            && Math.hypot(h.x - o.x, h.z - o.z) < 0.5)?.trabajo),
      })),
      hornos: (this.fundicion?.hornos || [])
        // Los que vienen de una obra se rehacen al reponer la obra
        .filter(h => !(this.construccion?.obras || []).some(o => o.obra.id === h.def.id))
        // `fuego.hasta` es una fecha del mundo, y el mundo se guarda con ella:
        // volver y encontrar la fogata todavía prendida es lo que uno espera.
        .map(h => ({
          id: h.def.id, x: h.x, y: h.y, z: h.z, mojado: h.mojado || 0,
          fuego: h.fuego?.hasta ?? null,
          trabajo: this._serializarTrabajo(h.trabajo),
        })),
      // Los dos avisos que enseñan una tecla se dan una vez y nunca más. Sin
      // guardarlos, «una vez» era «una vez por sesión»: quien cerrara con seis
      // leña y cuatro piedra en el bolso y sin ningún horno levantado se comía
      // el aviso del taller, nueve segundos, en cada arranque. Enseñar dos veces
      // lo mismo es la clase de cortesía que se vuelve estorbo.
      enseniado: {
        taller: !!this.recoleccion?._talleraAvisado,
        saber: !!this.recoleccion?._saberAvisado,
      },
      muerte: this.ultimaMuerte,
    };
  }

  /**
   * La carga que hay dentro de un horno. Una carbonera son treinta horas de
   * juego: descartarla al guardar era perder justo lo que el jugador estaba
   * esperando, y encima en el momento en que cierra la pestaña para esperarla.
   * De la receta va sólo el id; el resto se rearma del dataset al cargar.
   */
  _serializarTrabajo(t) {
    if (!t?.receta) return null;
    return {
      receta: t.receta.id,
      desde: t.desde,
      // `hasta` es Infinity mientras la hornada espera lugar en el bolso
      hasta: Number.isFinite(t.hasta) ? t.hasta : null,
      esperando: !!t.esperando,
      // Una hornada apagada por la lluvia vuelve apagada
      apagado: !!t.apagado,
      sale: t.sale || null,
    };
  }

  _reponerTrabajo(g) {
    if (!g?.receta) return null;
    const receta = (this.fundicion?.recetas || []).find(r => r.id === g.receta);
    if (!receta) return null;   // el dataset cambió: la carga se descarta sola
    const t = {
      receta,
      desde: g.desde ?? Date.now(),
      hasta: g.hasta ?? Infinity,
      esperando: !!g.esperando,
      apagado: !!g.apagado,
    };
    if (g.sale) t.sale = g.sale;
    return t;
  }

  guardar(avisar = false) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(this._serializar()));
      this.ultimoGuardado = Date.now();
      this.exploracion?.guardar();
      if (avisar) this.hud?.aviso('Partida guardada',
        'Bolso, obras, depósitos y tecnologías quedan en este navegador.');
      return true;
    } catch {
      if (avisar) this.hud?.aviso('No se pudo guardar',
        'El navegador no deja escribir en el almacenamiento local.');
      return false;
    }
  }

  hay() {
    try { return !!localStorage.getItem(CLAVE); } catch { return false; }
  }

  borrar() {
    try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
    this.ultimaMuerte = null;
  }

  /**
   * Repone la partida guardada. Devuelve false si no había, si era de otra
   * versión o si estaba rota: en cualquiera de esos casos el juego arranca
   * nuevo en vez de no arrancar.
   */
  cargar() {
    let d;
    try {
      const s = localStorage.getItem(CLAVE);
      if (!s) return false;
      d = JSON.parse(s);
    } catch { return false; }
    if (!d || d.version !== VERSION) return false;

    try {
      const j = this.jugador;
      const g = d.jugador || {};
      if (Number.isFinite(g.x)) {
        j.posicion.set(g.x, g.y, g.z);
        j.giro = g.giro ?? j.giro;
        j.salud = g.salud ?? 100; j.energia = g.energia ?? 100;
        j.hambre = g.hambre ?? 85; j.sed = g.sed ?? 85;
        j.temperatura = g.temperatura ?? 36.6;
        j.horasVividas = g.horasVividas ?? 0;
      }
      if (d.tiempo?.ms && this.tiempo?.fecha) this.tiempo.fecha.setTime(d.tiempo.ms);

      this.inventario.items = new Map(d.inventario || []);
      this.inventario.alCambiar?.();

      const s = d.saberes || {};
      this.saberes.puntos = s.puntos ?? 0;
      this.saberes.ganadosTotales = s.ganadosTotales ?? 0;
      this.saberes.desbloqueadas = new Set(s.desbloqueadas || []);

      if (this.codice) {
        // Una partida vieja no trae `descubiertas`: los avistajes se deducen de
        // lo identificado, que siempre estuvo antes descubierto.
        for (const id of d.codice?.descubiertas || d.codice?.identificadas || []) {
          this.codice.descubiertas.add(id);
        }
        for (const id of d.codice?.identificadas || []) this.codice.identificadas.add(id);
        for (const id of d.codice?.lugares || []) this.codice.lugares.add(id);
      }

      if (this.recoleccion) {
        this.recoleccion._talleraAvisado = !!d.enseniado?.taller;
        this.recoleccion._saberAvisado = !!d.enseniado?.saber;
      }

      this._reponerObras(d.obras || []);
      this._reponerHornos(d.hornos || []);
      this.ultimaMuerte = d.muerte || null;
      this.ultimoGuardado = d.fecha || Date.now();
      return true;
    } catch (e) {
      console.warn('Partida ilegible, se empieza de nuevo:', e);
      return false;
    }
  }

  _reponerObras(lista) {
    const catalogo = new Map((this.construccion?.catalogo || []).map(o => [o.id, o]));
    for (const g of lista) {
      const obra = catalogo.get(g.id);
      if (!obra) continue;   // el dataset cambió: la obra ya no existe
      const construida = {
        obra, x: g.x, y: g.y, z: g.z, vence: g.vence ?? null,
        guardado: new Map(g.guardado || []),
      };
      this.construccion.obras.push(construida);
      this.obras?.agregar(construida);
      if (obra.procesa) {
        this.fundicion?.hornos.push({
          def: { id: obra.id, nombre: obra.nombre, descripcion: obra.descripcion, temperaturaC: null },
          x: g.x, z: g.z, y: g.y, trabajo: this._reponerTrabajo(g.trabajo),
        });
      }
    }
    this.construccion?.alCambiar?.();
  }

  _reponerHornos(lista) {
    const catalogo = new Map((this.fundicion?.definicionesHorno || []).map(h => [h.id, h]));
    for (const g of lista) {
      const def = catalogo.get(g.id);
      if (!def) continue;
      // El reloj del mundo ya está repuesto acá arriba, así que una llama con
      // fecha vencida vuelve marcada como consumida: si no, el primer cuadro
      // avisaría «se consumió la leña» de un fuego que se apagó la sesión pasada.
      const ahora = this.fundicion?.tiempo?.fecha?.getTime() ?? Date.now();
      const horno = {
        def, x: g.x, y: g.y, z: g.z, mojado: g.mojado || 0,
        fuego: Number.isFinite(g.fuego) ? { hasta: g.fuego, consumido: g.fuego <= ahora } : null,
        ardiendo: false,
        trabajo: this._reponerTrabajo(g.trabajo),
      };
      // Lo pone en su lugar el primer `actualizar()`, pero la brasa se dibuja
      // antes que eso y una fogata viva no puede aparecer negra ni un cuadro.
      horno.ardiendo = this.fundicion.usaFuego(horno) && this.fundicion.arde(horno);
      this.fundicion.hornos.push(horno);
      this.hornos?.agregar(horno);
    }
  }
}
