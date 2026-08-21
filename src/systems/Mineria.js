/**
 * Minería — de dónde sale el material inerte, y por qué casi nunca de acá.
 *
 * Este sistema es hermano del de caza y enseña la otra mitad del artículo 5 de
 * la Ley 22.351: la que prohíbe la exploración y la explotación mineras dentro
 * de un Parque Nacional. Igual que con la fauna, la negativa no es un obstáculo
 * sino el contenido: cuando el jugador intenta abrir cantera en el área núcleo,
 * el juego le explica qué categoría de protección pisó.
 *
 * Y enseña algo geológico que suele sorprender: en la comarca andina del Nahuel
 * Huapi no hay metal. El Batolito Norpatagónico es roca plutónica sin
 * mineralización explotable, y el hierro del país sale de Sierra Grande, a unos
 * seiscientos kilómetros al este. Por eso acá no se funde mineral: se recupera
 * chatarra, que es exactamente lo que hicieron los pobladores durante un siglo.
 */

const SITIO_PATRIMONIAL_M = 260;   // radio en el que un sitio protege su contexto

export class Mineria {
  /**
   * @param {object} datos contenido de mineria.json
   * @param {object} deps {mundo, limites, jugador, inventario, saberes, hud, historia}
   */
  constructor(datos, deps) {
    this.d = datos || {};
    Object.assign(this, deps);
    this.infracciones = 0;
    this.extracciones = 0;
    /** @type {Map<string, number>} clave de posición -> instante de agotamiento */
    this.agotados = new Map();

    // Sitios con valor patrimonial, en coordenadas del mundo. Levantar metal de
    // adentro de uno no es reciclar: es destruir el contexto de un hallazgo.
    this.sitios = (this.historia?.sitios || []).map(s => {
      const p = this.mundo.aMundo(s.latitud, s.longitud);
      return { nombre: s.nombre, x: p.x, z: p.z, anio: s.anio };
    });
  }

  _clave(x, z) { return `${Math.round(x / 24)}:${Math.round(z / 24)}`; }

  /** Un frente de cantera queda agotado un rato: no es una canilla. */
  _agotado(x, z, ahora) {
    const t = this.agotados.get(this._clave(x, z));
    return t != null && ahora - t < 900;
  }

  _sitioCercano(x, z) {
    for (const s of this.sitios) {
      if (Math.hypot(s.x - x, s.z - z) < SITIO_PATRIMONIAL_M) return s;
    }
    return null;
  }

  /**
   * Qué material suelto hay en este punto, leído del terreno.
   *
   * No es azar decorativo: cada árido está donde la geología lo pone. La arena
   * y el ripio son acarreo glacifluvial y aparecen en los fondos de valle y en
   * las playas; la tosca es de la transición hacia la estepa, al este y seca; la
   * pómez es caída volcánica y se conserva donde no la lavó el agua, en altura.
   */
  yacimientoEn(x, z) {
    const y = this.mundo.alturaEn(x, z);
    const pend = this.mundo.pendienteEn(x, z);
    const cerca = (dx, dz) => this.mundo.esAgua(x + dx, z + dz);
    const junto_al_agua = cerca(0, 0) || cerca(12, 0) || cerca(-12, 0) || cerca(0, 12) || cerca(0, -12);

    if (y > 1450 && pend < 0.55) {
      return { id: 'pomez', nombre: 'Depósito de pómez', rinde: [{ recurso: 'pomez', cantidad: 3 }] };
    }
    if (junto_al_agua && pend < 0.22) {
      return {
        id: 'arena', nombre: 'Banco de arena',
        rinde: [{ recurso: 'arena', cantidad: 4 }, { recurso: 'ripio', cantidad: 1 }],
      };
    }
    if (pend < 0.16 && y < 1000) {
      return {
        id: 'ripio', nombre: 'Depósito de ripio',
        rinde: [{ recurso: 'ripio', cantidad: 3 }, { recurso: 'arena', cantidad: 2 }],
      };
    }
    if (pend < 0.30) {
      return {
        id: 'tosca', nombre: 'Frente de tosca',
        rinde: [{ recurso: 'tosca', cantidad: 3 }, { recurso: 'piedra', cantidad: 1 }],
      };
    }
    return null;
  }

  /** ¿Tiene con qué? A mano no se abre cantera. */
  tieneHerramienta() {
    return this.inventario.disponiblePara('herramienta') > 0;
  }

  /**
   * Veredicto sobre extraer acá y ahora. Siempre explica, se pueda o no.
   */
  evaluar(x, z, ahora) {
    const j = this.limites.jurisdiccion(x, z);
    const yac = this.yacimientoEn(x, z);

    if (j === 'parque') {
      const p = this.d.canteras?.penalidadDentroDelParque || {};
      return {
        permitido: false, jurisdiccion: j, gravedad: p.gravedad || 'grave',
        titulo: p.titulo || 'Minería en un Parque Nacional',
        detalle: p.detalle
          || 'El artículo 5 de la Ley 22.351 prohíbe la exploración y la explotación mineras dentro de un Parque Nacional.',
        castigo: p.castigoSaber ?? 8,
      };
    }

    if (j === 'reserva') {
      const p = this.d.canteras?.penalidadEnReserva || {};
      return {
        permitido: false, jurisdiccion: j, gravedad: p.gravedad || 'leve',
        titulo: p.titulo || 'Cantera sin autorización',
        detalle: p.detalle
          || 'En Reserva Nacional la explotación de canteras puede autorizarse, pero hace falta permiso escrito de la Administración de Parques Nacionales.',
        castigo: p.castigoSaber ?? 3,
      };
    }

    // Jurisdicción provincial: acá la extracción de áridos es una actividad
    // normal, regulada por el Código de Minería y por el municipio.
    if (!yac) {
      return {
        permitido: false, jurisdiccion: j, gravedad: null,
        titulo: 'Acá no hay material',
        detalle: 'La pendiente es demasiado fuerte o la roca está viva. Los áridos se sacan de los depósitos sueltos: bancos de arena, terrazas de ripio, frentes de tosca.',
        castigo: 0,
      };
    }
    if (this._agotado(x, z, ahora)) {
      return {
        permitido: false, jurisdiccion: j, gravedad: null,
        titulo: `${yac.nombre} agotado`,
        detalle: 'Este frente ya se sacó. Un yacimiento de áridos no se repone solo: hay que abrir otro.',
        castigo: 0,
      };
    }
    if (this.d.canteras?.requiereHerramienta !== false && !this.tieneHerramienta()) {
      return {
        permitido: false, jurisdiccion: j, gravedad: null,
        titulo: 'Te falta herramienta',
        detalle: 'Con las manos se junta piedra suelta, no se abre cantera. Hace falta una herramienta de hierro o de asta.',
        castigo: 0,
      };
    }

    return {
      permitido: true, jurisdiccion: j, gravedad: null, yacimiento: yac,
      titulo: yac.nombre,
      detalle: (this.d.materiales || []).find(m => m.id === yac.id)?.explicacion || '',
      castigo: 0,
    };
  }

  /** Intento de extracción. Devuelve si se concretó. */
  extraer(ahora) {
    const { x, z } = this.jugador.posicion;
    const v = this.evaluar(x, z, ahora);

    if (!v.permitido) {
      if (v.castigo > 0) {
        this.infracciones++;
        this.saberes.puntos = Math.max(0, this.saberes.puntos - v.castigo);
      }
      this.hud.negativa(v, { fecha: this.tiempo?.textoFecha });
      return false;
    }

    this.agotados.set(this._clave(x, z), ahora);
    const obtenido = [];
    for (const r of v.yacimiento.rinde) {
      const n = this.inventario.agregar(r.recurso, r.cantidad);
      if (n > 0) obtenido.push(`${n} × ${r.recurso}`);
    }
    this.extracciones++;
    // Entender dónde está cada material también es saber
    if (this.extracciones <= 4) this.saberes.otorgar(2, `${v.yacimiento.nombre} reconocido`);
    this.hud.aviso(v.yacimiento.nombre,
      obtenido.length ? obtenido.join(' · ') : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`);
    return true;
  }

  /**
   * Levantar chatarra.
   *
   * No es minería y no está prohibido en ningún lado: es basura metálica de la
   * ocupación humana, y sacarla del bosque mejora el lugar. La única línea que
   * no se cruza es la del patrimonio: si el metal es parte de un sitio con valor
   * histórico o arqueológico, la Ley 25.743 lo protege, y desarmarlo destruye
   * información de contexto que no se recupera.
   */
  recuperarChatarra(ahora) {
    const { x, z } = this.jugador.posicion;
    const sitio = this._sitioCercano(x, z);
    if (sitio) {
      this.infracciones++;
      this.saberes.puntos = Math.max(0, this.saberes.puntos - 5);
      const n = (this.d.normas || []).find(nn => nn.id === 'ley_25743');
      this.hud.aviso(`${sitio.nombre}: sitio protegido`,
        n?.consecuencia
        || 'Los vestigios de un sitio histórico están protegidos por la Ley 25.743. Levantar sus partes destruye el contexto del hallazgo.');
      return false;
    }
    if (this._agotado(x, z, ahora)) {
      this.hud.aviso('Ya juntaste lo que había', 'La chatarra aparece donde hubo gente, no donde uno quiere');
      return false;
    }

    this.agotados.set(this._clave(x, z), ahora);
    const n = this.inventario.agregar('chatarra', 1 + Math.floor(Math.random() * 3));
    const mat = (this.d.materiales || []).find(m => m.id === 'chatarra');
    this.hud.aviso(n > 0 ? `Chatarra recuperada: ${n}` : 'No entra nada más',
      mat?.explicacion || 'Alambre, chapa y flejes tirados. Es el único hierro que hay en esta comarca.');
    if (n > 0) this.saberes.otorgar(1, 'Sacaste basura del bosque');
    return n > 0;
  }

  /**
   * ¿Hay chatarra plausible acá? Sólo donde hubo ocupación: el ejido y la
   * franja de reserva con rutas y villas. En el área núcleo el bosque está
   * limpio, y ésa es justamente la diferencia.
   */
  hayChatarra(x, z) {
    const j = this.limites.jurisdiccion(x, z);
    if (j === 'parque') return false;
    // Distribución fija por posición: el mismo lugar siempre da lo mismo
    const h = Math.abs(Math.sin(Math.round(x / 40) * 12.9898 + Math.round(z / 40) * 78.233) * 43758.5453) % 1;
    return h < (j === 'fuera' ? 0.30 : 0.14);
  }
}
