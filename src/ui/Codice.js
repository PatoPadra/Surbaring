/**
 * Códice — la guía de campo del parque.
 *
 * No es un menú de ayuda: es el objetivo del juego. Las especies se descubren
 * avistándolas en su hábitat real y se completan identificándolas de cerca; los
 * cerros, lagos y sitios históricos se descubren llegando hasta ellos.
 *
 * Qué se colecciona y qué no es una decisión deliberada. La fauna, la flora y
 * los lugares son hallazgos: tiene sentido ganárselos recorriendo. La mitología
 * mapuche, la toponimia y el árbol de saberes están disponibles desde el
 * principio, porque poner la cosmovisión de un pueblo vivo detrás de una
 * mecánica de recolección sería tratarla como un trofeo.
 */

import { normalizar as normalizarRec } from '../systems/Recursos.js';

const ESTADOS_UICN = {
  EX: ['Extinta', '#4a4a4a'],
  EW: ['Extinta en estado silvestre', '#5a4a5a'],
  CR: ['En peligro crítico', '#a11a1a'],
  EN: ['En peligro', '#c8503f'],
  VU: ['Vulnerable', '#d08a3a'],
  NT: ['Casi amenazada', '#c8b45a'],
  LC: ['Preocupación menor', '#6fae7c'],
  DD: ['Datos insuficientes', '#7a7a7a'],
};

/** Desde qué distancia se considera descubierto cada tipo de lugar. */
const RADIO_HALLAZGO = {
  volcan: 6000,   // el Tronador se ve desde media provincia
  cerro: 1800,
  glaciar: 2200,
  lago: 700,
  rio: 300,
  sitio: 260,
};

const ICONO = {
  cerro: '▲', volcan: '▲', glaciar: '◭', lago: '≈', rio: '≋', sitio: '◈',
};

/** Los ids internos van sin tilde; lo que se muestra, no. */
const NOMBRE_TIPO = {
  cerro: 'Cerro', volcan: 'Volcán', glaciar: 'Glaciar',
  lago: 'Lago', rio: 'Río', sitio: 'Sitio histórico',
};

export class Codice {
  /**
   * @param {object} datos {flora, fauna, geografia, historia, mundo, hud}
   */
  constructor({ flora, fauna, geografia, historia, mundo, hud, saberes, inventario }) {
    this.saberes = saberes;
    this.inventario = inventario;
    this.flora = flora;
    this.fauna = fauna;
    this.geo = geografia;
    this.historia = historia;
    this.mundo = mundo;
    this.hud = hud;

    this.descubiertas = new Set();   // especies avistadas
    this.identificadas = new Set();  // especies identificadas de cerca
    this.lugares = new Set();        // cerros, lagos y sitios alcanzados
    this.abierto = false;
    this.pestana = 'fauna';

    this._armarLugares();
    this._crearElemento();
  }

  /** Unifica en una sola lista todo lo que se puede descubrir recorriendo. */
  _armarLugares() {
    const L = [];
    const babel = (t) => (t || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const agregar = (tipo, o, extra = {}) => {
      if (o.latitud == null || o.longitud == null) return;
      L.push({
        tipo,
        id: o.id || `${tipo}_${babel(o.nombre)}`,
        nombre: o.nombre,
        lat: o.latitud, lon: o.longitud,
        descripcion: o.descripcion,
        ...extra,
      });
    };

    for (const c of this.geo.cerros || []) {
      agregar('cerro', c, { altura: c.alturaM, origenNombre: c.origenNombre, prominente: c.prominente });
    }
    for (const v of this.geo.geologia?.volcanes || []) {
      agregar('volcan', v, { altura: v.alturaM, activo: v.activo, ultimaErupcion: v.ultimaErupcion });
    }
    for (const g of this.geo.geologia?.glaciares || []) {
      agregar('glaciar', g, { retroceso: g.retroceso, subtipo: g.tipo });
    }
    for (const l of this.geo.hidrologia?.lagos || []) {
      agregar('lago', l, {
        cota: l.cotaM, profundidad: l.profundidadMaxM, superficie: l.superficieKm2,
        cuenca: l.cuenca, transparencia: l.transparenciaM, brazos: l.brazos,
      });
    }
    for (const s of this.historia.sitios || []) {
      agregar('sitio', s, { anio: s.anio, subtipo: s.tipo });
    }

    // Coordenadas de mundo, para no recalcularlas en cada comprobación
    for (const l of L) {
      const p = this.mundo.aMundo(l.lat, l.lon);
      l.x = p.x; l.z = p.z;
      l.radio = RADIO_HALLAZGO[l.tipo] ?? 500;
    }

    // ── Fusión de duplicados ────────────────────────────────────────────────
    // Los tres datasets se investigaron por separado y algunos accidentes
    // aparecen en varios: el Tronador figura como cerro, como volcán y como
    // sitio. Se los junta en una sola ficha para no listarlo tres veces, y de
    // paso la entrada resultante queda más completa que cualquiera de las tres.
    const raiz = (n) => babel(n)
      .replace(/^(cerro|lago|laguna|volcan|glaciar|monte|rio|arroyo)_/, '');
    const PRIORIDAD = { volcan: 0, cerro: 1, glaciar: 2, lago: 3, sitio: 4 };

    const fusionados = [];
    for (const l of L) {
      const gemelo = fusionados.find(f =>
        Math.hypot(f.x - l.x, f.z - l.z) < 400 && raiz(f.nombre) === raiz(l.nombre));
      if (!gemelo) { fusionados.push({ ...l, tipos: [l.tipo] }); continue; }

      // Se completa lo que falte y se conserva el tipo más específico
      for (const [k, v] of Object.entries(l)) {
        if (gemelo[k] == null && v != null) gemelo[k] = v;
      }
      if (!gemelo.tipos.includes(l.tipo)) gemelo.tipos.push(l.tipo);
      if (PRIORIDAD[l.tipo] < PRIORIDAD[gemelo.tipo]) {
        gemelo.tipo = l.tipo;
        gemelo.radio = RADIO_HALLAZGO[l.tipo] ?? gemelo.radio;
      }
      // La descripción más larga suele ser la mejor
      if ((l.descripcion || '').length > (gemelo.descripcion || '').length) {
        gemelo.descripcion = l.descripcion;
      }
    }

    // Sólo los que caen dentro del mundo jugable
    this.listaLugares = fusionados.filter(l => this.mundo.dentro(l.x, l.z));
    this.lugaresFuera = fusionados.length - this.listaLugares.length;
    this.duplicadosFusionados = L.length - fusionados.length;
  }

  /**
   * Comprueba si el jugador alcanzó algún lugar nuevo.
   * Se llama unas dos veces por segundo, no en cada cuadro.
   */
  revisarProximidad(posicion) {
    for (const l of this.listaLugares) {
      if (this.lugares.has(l.id)) continue;
      const d = Math.hypot(posicion.x - l.x, posicion.z - l.z);
      if (d > l.radio) continue;
      this.lugares.add(l.id);
      const detalle = l.altura ? `${l.altura} m s. n. m.`
        : l.cota ? `Cota ${l.cota} m` : (l.anio ? `${l.anio}` : '');
      const topo = this.toponimoDe(l.nombre);
      // "Descubriste" es una palabra prestada de los relevamientos, y conviene
      // devolverla con su contexto: el lugar ya tenía nombre.
      const conNombre = topo && topo.lengua === 'mapuzugun'
        ? `${detalle}${detalle ? ' · ' : ''}Ya tenía nombre: ${topo.termino}, ${(topo.significado || '').toLowerCase()}.`
        : detalle;
      this.hud?.aviso(`Descubriste ${l.nombre}`, conNombre, topo ? 7000 : 4200);
      this._actualizarCuenta();
      if (this.abierto) this._pintar();
    }
  }

  /**
   * El nombre que el lugar ya tenía.
   *
   * Casi todo el mapa de Bariloche está escrito en mapuzugun, y el juego tenía
   * los treinta topónimos investigados en una pestaña y los cuarenta y cinco
   * lugares descubribles en otra, sin tocarse nunca. Engancharlos es la
   * corrección más barata que este proyecto puede hacer sobre sí mismo: que
   * cada "descubrimiento" venga con el recordatorio de que el lugar ya estaba
   * nombrado, y de que descubrir, acá, quiso decir muchas veces renombrar.
   *
   * Se busca el término más largo contenido en el nombre —"Nahuel Huapi" antes
   * que "Nahuel"— para no quedarse con la coincidencia trivial.
   */
  toponimoDe(nombre) {
    const limpiar = (t) => (t || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const n = limpiar(nombre);
    let mejor = null;
    for (const t of this.historia.toponimia || []) {
      const term = limpiar(t.termino);
      if (!term || !n.includes(term)) continue;
      if (!mejor || term.length > limpiar(mejor.termino).length) mejor = t;
    }
    return mejor;
  }

  /** Eventos históricos ocurridos cerca de un lugar ya descubierto. */
  _eventosDesbloqueados() {
    const abiertos = new Set();
    const cerca = [];
    for (const l of this.listaLugares) if (this.lugares.has(l.id)) cerca.push(l);

    for (const e of this.historia.eventos || []) {
      // El ancla manda sobre la coordenada del hecho.
      //
      // Un evento se desbloqueaba estando a menos de cinco kilómetros de DONDE
      // PASÓ, y eso dejaba doce de los treinta y dos fuera del alcance para
      // siempre: la Campaña del Desierto a 115 km, Sayhueque a 78, el arte
      // rupestre a 80. El recorte no era neutro —se llevaba puesta casi toda la
      // historia indígena y de la conquista, que son las entradas mejor escritas
      // del archivo— y dejaba accesible la capa del turismo. El juego terminaba
      // contando, sin querer, la versión de folleto.
      //
      // Un hecho que ocurrió en otro lado se aprende igual parado en el lugar
      // desde donde se lo explica, y por eso cada uno de esos doce lleva ahora
      // un ancla con su propia razón de estar ahí.
      const lat = e.ancla?.latitud ?? e.latitud;
      const lon = e.ancla?.longitud ?? e.longitud;
      if (lat == null || lon == null) { abiertos.add(e.id); continue; }
      const p = this.mundo.aMundo(lat, lon);
      for (const l of cerca) {
        if (Math.hypot(p.x - l.x, p.z - l.z) < 5000) { abiertos.add(e.id); break; }
      }
    }
    return abiertos;
  }

  _crearElemento() {
    const el = document.createElement('div');
    el.id = 'codice';
    el.innerHTML = `
      <div class="cx-marco">
        <header>
          <div>
            <h2>Códice del Nahuel Huapi</h2>
            <p class="cx-sub">Guía de campo del Parque Nacional</p>
          </div>
          <div class="cx-progreso">
            <div><span id="cx-esp">0</span><small>especies</small></div>
            <div><span id="cx-lug">0</span><small>lugares</small></div>
          </div>
        </header>
        <nav>
          <button data-p="fauna" class="activo">Fauna</button>
          <button data-p="flora">Flora</button>
          <button data-p="geografia">Geografía</button>
          <button data-p="historia">Historia</button>
          <button data-p="mitologia">Mitología</button>
          <button data-p="normativa">Normativa</button>
          <button data-p="saberes">Saberes</button>
        </nav>
        <div class="cx-lista" id="cx-lista"></div>
        <footer id="cx-pie"></footer>
      </div>`;
    document.body.appendChild(el);

    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    el.querySelectorAll('nav button').forEach(b => {
      b.addEventListener('click', () => {
        this.pestana = b.dataset.p;
        el.querySelectorAll('nav button').forEach(x => x.classList.toggle('activo', x === b));
        this._pintar();
      });
    });

    this.el = el;
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this._pintar();
      document.exitPointerLock?.();
    }
  }

  /** @param {boolean} deCerca true si la identificó, no sólo la vio */
  registrarFauna(esp, deCerca) {
    const nueva = !this.descubiertas.has(esp.id);
    this.descubiertas.add(esp.id);
    if (deCerca && !this.identificadas.has(esp.id)) {
      this.identificadas.add(esp.id);
      const [etiqueta] = ESTADOS_UICN[esp.estadoConservacion] || ['', ''];
      this.hud?.aviso(`${esp.nombreComun} identificado`,
        `${esp.nombreCientifico}${etiqueta ? ' · ' + etiqueta : ''}`);
      this._actualizarCuenta();
      return;
    }
    if (nueva) {
      this.hud?.aviso(`Avistaste un ${esp.nombreComun.toLowerCase()}`,
        'Acercate y pulsá E para identificarlo');
      this._actualizarCuenta();
    }
  }

  registrarFlora(esp) {
    if (this.identificadas.has(esp.id)) return;
    this.descubiertas.add(esp.id);
    this.identificadas.add(esp.id);
    this.hud?.aviso(`${esp.nombreComun} identificado`, esp.nombreCientifico);
    this._actualizarCuenta();
  }

  _actualizarCuenta() {
    const a = document.getElementById('cx-esp');
    const b = document.getElementById('cx-lug');
    if (a) a.textContent = this.identificadas.size;
    if (b) b.textContent = this.lugares.size;
  }

  // ── Pintado ───────────────────────────────────────────────────────────────

  _pintar() {
    const lista = document.getElementById('cx-lista');
    const pie = document.getElementById('cx-pie');
    let html = '', ayuda = '';

    switch (this.pestana) {
      case 'fauna':
        html = this._pintarEspecies(this.fauna.especies.map(e => ({ ...e, reino: 'fauna' })));
        ayuda = 'Acercate a un animal y pulsá <b>E</b> para identificarlo';
        break;
      case 'flora':
        html = this._pintarEspecies(this.flora.especies.map(e => ({ ...e, reino: 'flora' })));
        ayuda = 'Las plantas se identifican al recolectarlas';
        break;
      case 'geografia':
        html = this._pintarGeografia();
        ayuda = `Los lugares se descubren llegando hasta ellos · ${this.lugares.size} de ${this.listaLugares.length}`;
        break;
      case 'historia':
        html = this._pintarHistoria();
        ayuda = 'Los hechos ocurridos en un lugar se revelan al descubrirlo';
        break;
      case 'mitologia':
        html = this._pintarMitologia();
        ayuda = 'Relatos y topónimos del pueblo mapuche, disponibles desde el inicio';
        break;
      case 'normativa':
        html = this._pintarNormativa();
        break;
      case 'saberes':
        html = this._pintarSaberes();
        ayuda = 'Árbol de tecnologías, de la lítica de obsidiana al guardaparque';
        break;
    }

    lista.innerHTML = html;
    lista.className = 'cx-lista ' + (this.pestana === 'fauna' || this.pestana === 'flora' || this.pestana === 'geografia' ? 'rejilla' : 'columna');
    pie.innerHTML = ayuda + ' · <b>Tab</b> cierra';
    this._actualizarCuenta();

    lista.querySelectorAll('.sab-btn').forEach(b => {
      b.addEventListener('click', () => {
        const tec = this.saberes?.porId.get(b.dataset.tec);
        if (!tec) return;
        const res = this.saberes.desbloquear(tec);
        if (res.estado === 'desbloqueada') this.hud?.aviso(`Aprendiste ${tec.nombre}`, tec.contextoHistorico || '');
        this._pintar();
      });
    });
  }

  _pintarEspecies(entradas) {
    return entradas.map(e => {
      const vista = this.descubiertas.has(e.id);
      const id = this.identificadas.has(e.id);
      if (!vista) {
        return `<article class="cx-ficha oculta">
          <div class="cx-silueta">?</div>
          <div class="cx-datos"><h3>Sin descubrir</h3>
          <p class="cx-cient">${e.reino === 'fauna' ? 'Animal' : 'Planta'} del parque · todavía no la viste</p></div>
        </article>`;
      }

      const [etiqueta, color] = ESTADOS_UICN[e.estadoConservacion] || [null, null];
      const ins = [];
      if (etiqueta) ins.push(tag(etiqueta, color));
      if (e.monumentoNatural) ins.push(tag('Monumento Natural', '#8a6fd0'));
      if (e.invasora) ins.push(tag('Especie invasora', '#c8503f'));
      if (e.protegida) ins.push(tag('Protegida', '#4a8fb5'));
      if (e.nativa && !e.invasora) ins.push(tag('Nativa', '#6fae7c'));

      const det = [];
      if (e.reino === 'fauna') {
        if (e.pesoKg) det.push(`${e.pesoKg} kg`);
        if (e.largoM) det.push(`${e.largoM} m de largo`);
        if (e.dieta) det.push(cap(e.dieta));
        if (e.actividad) det.push(cap(e.actividad));
      } else {
        if (e.alturaMaxM) det.push(`hasta ${e.alturaMaxM} m`);
        if (e.perenne !== undefined) det.push(e.perenne ? 'Siempreverde' : 'Caducifolio');
        if (e.comestible) det.push(`Comestible (${e.parteComestible || 'fruto'})`);
      }
      if (e.altitudMinM != null && e.altitudMaxM != null) {
        det.push(`${e.altitudMinM}–${e.altitudMaxM} m s. n. m.`);
      }

      return `<article class="cx-ficha ${id ? 'identificada' : 'avistada'}">
        <div class="cx-silueta" style="--c:${e.colorPrincipal || e.colorHojaVerano || '#6a7a6a'}"></div>
        <div class="cx-datos">
          <h3>${e.nombreComun}${e.nombreMapuzugun ? ` <em>· ${e.nombreMapuzugun}</em>` : ''}</h3>
          <p class="cx-cient">${e.nombreCientifico}</p>
          <div class="cx-tags">${ins.join('')}</div>
          ${id ? `<p class="cx-desc">${e.descripcionEducativa || ''}</p>
                  ${e.datoCurioso ? `<p class="cx-curioso">${e.datoCurioso}</p>` : ''}
                  ${e.usoMapuche ? `<p class="cx-uso"><b>Uso mapuche:</b> ${e.usoMapuche}</p>` : ''}
                  ${e.rolEcologico || e.roiEcologico ? `<p class="cx-uso"><b>Rol ecológico:</b> ${e.rolEcologico || e.roiEcologico}</p>` : ''}`
              : `<p class="cx-desc cx-parcial">Avistada, sin identificar. Acercate y pulsá <b>E</b>.</p>`}
          <p class="cx-meta">${det.join(' · ')}</p>
        </div>
      </article>`;
    }).join('');
  }

  _pintarGeografia() {
    const orden = { volcan: 0, cerro: 1, glaciar: 2, lago: 3, sitio: 4 };
    const lista = [...this.listaLugares].sort((a, b) =>
      (orden[a.tipo] - orden[b.tipo]) || ((b.altura || b.superficie || 0) - (a.altura || a.superficie || 0)));

    let html = lista.map(l => {
      const hallado = this.lugares.has(l.id);
      if (!hallado) {
        return `<article class="cx-ficha oculta">
          <div class="cx-silueta">${ICONO[l.tipo] || '?'}</div>
          <div class="cx-datos"><h3>Sin descubrir</h3>
          <p class="cx-cient">${NOMBRE_TIPO[l.tipo] || cap(l.tipo)} · llegá hasta él para revelarlo</p></div>
        </article>`;
      }
      const det = [];
      if (l.altura) det.push(`${l.altura} m s. n. m.`);
      if (l.cota) det.push(`Cota ${l.cota} m`);
      if (l.profundidad) det.push(`${l.profundidad} m de profundidad`);
      if (l.superficie) det.push(`${l.superficie} km²`);
      if (l.transparencia) det.push(`${l.transparencia} m de transparencia`);
      if (l.anio) det.push(`${l.anio}`);
      det.push(`${l.lat.toFixed(3)}°, ${l.lon.toFixed(3)}°`);
      const topo = this.toponimoDe(l.nombre);

      const ins = [];
      if (l.cuenca) ins.push(tag(`Cuenca ${l.cuenca}`, '#4a8fb5'));
      if (l.tipo === 'volcan') ins.push(tag(l.activo ? 'Activo' : 'Extinto', l.activo ? '#c8503f' : '#7a7a7a'));
      if (l.prominente) ins.push(tag('Cumbre prominente', '#c8b45a'));
      if (l.subtipo) ins.push(tag(cap(l.subtipo), '#8a6fd0'));

      return `<article class="cx-ficha identificada">
        <div class="cx-silueta" style="--c:#4a5a52">${ICONO[l.tipo] || ''}</div>
        <div class="cx-datos">
          <h3>${l.nombre}</h3>
          <p class="cx-cient">${(l.tipos || [l.tipo]).map(t => NOMBRE_TIPO[t] || cap(t)).join(' · ')}</p>
          <div class="cx-tags">${ins.join('')}</div>
          <p class="cx-desc">${l.descripcion || ''}</p>
          ${topo ? `<p class="cx-uso"><b>Ya tenía nombre:</b> ${topo.termino}, ${topo.lengua === 'mapuzugun' ? 'en mapuzugun' : `en ${topo.lengua}`}: ${(topo.significado || '').toLowerCase()}.${topo.notas ? ` ${topo.notas}` : ''}</p>` : ''}
          ${l.origenNombre ? `<p class="cx-uso"><b>Origen del nombre:</b> ${l.origenNombre}</p>` : ''}
          ${l.retroceso ? `<p class="cx-uso"><b>Retroceso:</b> ${l.retroceso}</p>` : ''}
          ${l.brazos?.length ? `<p class="cx-uso"><b>Brazos:</b> ${l.brazos.join(', ')}</p>` : ''}
          <p class="cx-meta">${det.join(' · ')}</p>
        </div>
      </article>`;
    }).join('');

    // Los fenómenos naturales son referencia de supervivencia, no colección
    html += `<article class="cx-bloque"><h3>Fenómenos del parque</h3>
      <p class="cx-desc">${this.geo.gradientePrecipitacion?.descripcion || ''}</p></article>`;
    for (const f of this.geo.fenomenos || []) {
      html += `<article class="cx-ficha identificada">
        <div class="cx-silueta" style="--c:${f.peligrosidad >= 4 ? '#c8503f' : '#4a8fb5'}">!</div>
        <div class="cx-datos">
          <h3>${f.nombre}</h3>
          <p class="cx-cient">${(f.estaciones || []).map(cap).join(', ')}</p>
          <div class="cx-tags">${tag(`Peligro ${f.peligrosidad}/5`, f.peligrosidad >= 4 ? '#c8503f' : '#d08a3a')}</div>
          <p class="cx-desc">${f.descripcion || ''}</p>
          ${f.senalesPrevias ? `<p class="cx-curioso">Señales previas: ${f.senalesPrevias}</p>` : ''}
          ${f.efectoJugador ? `<p class="cx-uso"><b>Efecto:</b> ${f.efectoJugador}</p>` : ''}
        </div>
      </article>`;
    }
    return html;
  }

  _pintarHistoria() {
    const abiertos = this._eventosDesbloqueados();
    const eventos = [...(this.historia.eventos || [])].sort((a, b) => (a.anio ?? 0) - (b.anio ?? 0));
    let html = '';

    for (const era of this.historia.eras || []) {
      const suyos = eventos.filter(e =>
        // Un evento sin año no es un evento sin época: el arte rupestre no tiene
        // fecha y por este filtro no se dibujaba en NINGUNA era, aunque se
        // desbloqueara. Los sin fecha caen en la primera, que es donde están.
        e.anio == null ? era === this.historia.eras[0]
          : (e.anio >= era.anioDesde && e.anio <= era.anioHasta));

      html += `<article class="cx-bloque" style="--c:${era.colorTema || '#8a5a3b'}">
        <h3>${era.nombre} <em>${anio(era.anioDesde)} – ${anio(era.anioHasta)}</em></h3>
        <p class="cx-desc">${era.descripcion || ''}</p>
      </article>`;

      for (const e of suyos) {
        const visible = abiertos.has(e.id);
        html += `<article class="cx-linea ${visible ? '' : 'oculta'}">
          <div class="cx-anio">${visible ? anio(e.anio) : '····'}</div>
          <div class="cx-datos">
            ${visible
              ? `<h3>${e.titulo}</h3>
                 <p class="cx-desc">${e.descripcion || ''}</p>
                 ${e.ancla?.porQueAca
                   ? `<p class="cx-uso"><b>Por qué se cuenta desde ${e.ancla.lugar}:</b> ${e.ancla.porQueAca}</p>`
                   : ''}
                 <p class="cx-meta">${e.lugar || ''}${'★'.repeat(e.importancia || 0)}</p>`
              : `<h3>Hecho sin revelar</h3>
                 <p class="cx-parcial">Ocurrió en un lugar que todavía no visitaste.</p>`}
          </div>
        </article>`;
      }
    }

    html += `<article class="cx-bloque"><h3>Personajes</h3></article>`;
    for (const p of this.historia.personajes || []) {
      html += `<article class="cx-linea">
        <div class="cx-anio">${p.anios || ''}</div>
        <div class="cx-datos">
          <h3>${p.nombre}</h3>
          <p class="cx-cient">${p.rol || ''}</p>
          <p class="cx-desc">${p.descripcion || ''}</p>
          ${p.aporte ? `<p class="cx-uso"><b>Aporte:</b> ${p.aporte}</p>` : ''}
        </div>
      </article>`;
    }
    return html;
  }

  _pintarMitologia() {
    let html = `<article class="cx-bloque"><h3>Cosmovisión y relatos</h3>
      <p class="cx-desc">Las entradas que siguen describen la existencia y el
      significado público de creencias de un pueblo vivo. No son un inventario de
      folclore: el pueblo mapuche sostiene hoy estas nociones.</p></article>`;

    for (const m of this.historia.mitologia || []) {
      html += `<article class="cx-linea">
        <div class="cx-anio">${cap(m.origen || '')}</div>
        <div class="cx-datos">
          <h3>${m.nombre}</h3>
          <p class="cx-desc">${m.relato || ''}</p>
          ${m.significado ? `<p class="cx-curioso">${m.significado}</p>` : ''}
          ${m.ubicacion ? `<p class="cx-meta">${m.ubicacion}</p>` : ''}
        </div>
      </article>`;
    }

    html += `<article class="cx-bloque"><h3>Toponimia</h3>
      <p class="cx-desc">Casi todo el mapa de Bariloche está escrito en mapuzugun.
      Cada nombre describe el lugar.</p></article>`;
    html += `<div class="cx-topos">`;
    for (const t of this.historia.toponimia || []) {
      html += `<div class="cx-topo">
        <b>${t.termino}</b>
        <span class="cx-sig">${t.significado || ''}</span>
        ${t.notas ? `<span class="cx-nota">${t.notas}</span>` : ''}
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  /**
   * La ley del parque, entera y desde el principio.
   *
   * No es un coleccionable: la normativa no se descubre caminando, se consulta.
   * Y hasta acá no se podía consultar en ningún lado —los dos archivos que
   * sostienen la tesis del juego, `caza.json` y `mineria.json`, no tenían
   * pantalla— así que la única forma de leer una explicación de quinientos
   * caracteres era alcanzar a leerla en los 4,2 segundos del cartel.
   *
   * Abajo de todo va el registro de lo que el jugador intentó y no pudo. Ése sí
   * es suyo: es su historial de haber chocado contra la ley, con lo que le
   * costó, y es lo que convierte la negativa en algo que se relee.
   */
  _pintarNormativa() {
    const n = this.normativa || {};
    let html = `<article class="cx-bloque"><h3>Por qué esta pestaña no se desbloquea</h3>
      <p class="cx-desc">Todo lo que sigue está disponible desde el primer minuto.
      La ley no es un coleccionable: rige sepas o no sepas, y ésa es justamente la
      parte que conviene saber antes y no después.</p></article>`;

    if (n.caza?.marcoLegal?.resumen) {
      html += `<article class="cx-linea">
        <div class="cx-anio">Marco</div>
        <div class="cx-datos"><h3>Fauna y caza</h3>
          <p class="cx-desc">${n.caza.marcoLegal.resumen}</p></div>
      </article>`;
    }

    for (const c of n.caza?.categorias || []) {
      html += `<article class="cx-linea">
        <div class="cx-anio" style="color:${c.colorAviso || '#c8503f'}">${cap(c.nombre || c.id)}</div>
        <div class="cx-datos"><h3>${cap(c.nombre || c.id)}</h3>
          <p class="cx-desc">${c.explicacion || ''}</p></div>
      </article>`;
    }

    const normas = [
      ...(n.caza?.marcoLegal?.normas || []),
      ...(n.mineria?.normas || []),
      ...(n.construccion?.normas || []),
    ];
    if (normas.length) {
      html += `<article class="cx-bloque"><h3>Las normas citadas</h3></article>`;
      for (const x of normas) {
        const titulo = x.norma || x.nombre || x.id || '';
        html += `<article class="cx-linea">
          <div class="cx-anio">${x.anio || ''}</div>
          <div class="cx-datos"><h3>${titulo}</h3>
            <p class="cx-desc">${x.detalle || x.descripcion || x.resumen || ''}</p></div>
        </article>`;
      }
    }

    const reg = this.norma?.registro || [];
    html += `<article class="cx-bloque"><h3>Lo que intentaste</h3>
      <p class="cx-desc">${reg.length
        ? 'Cada vez que la ley dijo que no, y lo que costó. Se conserva aunque te mueras: es de lo poco que el cuerpo no se lleva.'
        : 'Todavía no chocaste con ninguna norma. Cuando pase, la explicación queda acá para releerla con tiempo.'}</p></article>`;
    for (const r of reg) {
      html += `<article class="cx-linea">
        <div class="cx-anio">${r.fecha || ''}</div>
        <div class="cx-datos"><h3>${r.titulo}</h3>
          <p class="cx-desc">${r.detalle}</p>
          ${r.nota ? `<p class="cx-curioso">${r.nota}</p>` : ''}
          <p class="cx-meta">${[r.lugar, r.castigo ? `−${r.castigo} de saber` : ''].filter(Boolean).join(' · ')}</p>
        </div>
      </article>`;
    }
    return html;
  }

  _pintarSaberes() {
    const S = this.saberes;
    const porEra = new Map();
    for (const t of this.historia.tecnologias || []) {
      if (!porEra.has(t.era)) porEra.set(t.era, []);
      porEra.get(t.era).push(t);
    }

    const r = S?.resumen();
    let html = r ? `<article class="cx-bloque" style="--c:#6fae7c">
      <h3>Saberes <em>${r.desbloqueadas} de ${r.total}</em></h3>
      <p class="cx-desc">Tenés <b>${r.puntos}</b> puntos de saber. Se ganan
      conociendo: identificar una especie da 2, una amenazada 6, llegar a un
      lugar 3. De lo que falta, ${r.alcanzables} son alcanzables con lo que hoy
      existe en el mundo y ${r.inalcanzables} piden materiales que todavía no se
      pueden conseguir.</p></article>` : '';

    for (const era of this.historia.eras || []) {
      const ts = porEra.get(era.id);
      if (!ts?.length) continue;
      html += `<article class="cx-bloque" style="--c:${era.colorTema || '#8a5a3b'}">
        <h3>${era.nombre}</h3></article>`;
      html += `<div class="cx-saberes">`;
      for (const t of ts) {
        const e = S ? S.estado(t) : { estado: 'lista' };
        const mats = (t.materiales || []).map(m => {
          const info = e.materiales?.find(x => x.recurso === normalizarRec(m.recurso));
          if (!info) return `${m.cantidad} × ${m.recurso}`;
          const cls = info.imposible ? 'mat-imposible' : info.alcanza ? 'mat-ok' : 'mat-falta';
          return `<span class="${cls}">${info.hay}/${info.pide} ${info.nombre}</span>`;
        }).join(' ');

        let pie = '', clase = '';
        switch (e.estado) {
          case 'desbloqueada':
            clase = 'sab-ok'; pie = '<span class="sab-marca">Aprendido</span>'; break;
          case 'lista':
            clase = 'sab-lista';
            pie = `<button class="sab-btn" data-tec="${t.id}">Aprender por ${t.costoSaber} saber</button>`;
            break;
          case 'faltan_puntos':
            pie = `<span class="sab-nota">Te faltan ${e.faltanPuntos} puntos de saber</span>`; break;
          case 'faltan_materiales':
            pie = `<span class="sab-nota">Falta juntar: ${e.faltanMateriales.map(m => `${m.pide - m.hay} ${m.nombre.toLowerCase()}`).join(', ')}</span>`; break;
          case 'requiere_previas':
            pie = `<span class="sab-nota">Antes: ${e.faltanPrevias.join(', ')}</span>`; break;
          case 'inalcanzable':
            clase = 'sab-imposible';
            pie = `<span class="sab-nota">Todavía no se puede conseguir ${e.imposibles.map(m => m.nombre.toLowerCase()).join(', ')}</span>`;
            break;
        }

        html += `<div class="cx-saber ${clase}">
          <h4>${t.nombre} <span class="cx-costo">${t.costoSaber ?? 0}</span></h4>
          <p class="cx-desc">${t.descripcion || ''}</p>
          ${t.contextoHistorico ? `<p class="cx-curioso">${t.contextoHistorico}</p>` : ''}
          <p class="cx-mats">${mats || 'sin materiales'}</p>
          <div class="cx-pie-saber">${pie}</div>
        </div>`;
      }
      html += `</div>`;
    }
    return html;
  }
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const tag = (txt, c) => `<span class="cx-tag" style="--c:${c}">${txt}</span>`;
const anio = a => a == null ? '····' : (a < 0 ? `${-a} a. C.` : `${a}`);

const CSS = `
#codice {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(6, 9, 8, .84);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  display: none; align-items: center; justify-content: center; padding: 2.2rem 1.2rem;
}
#codice.abierto { display: flex; }
.cx-marco {
  width: min(1180px, 96vw); max-height: 93vh; display: flex; flex-direction: column;
  background: linear-gradient(170deg, #131a17 0%, #0c1210 100%);
  border: 1px solid rgba(255,255,255,.09); border-radius: 5px;
  box-shadow: 0 30px 90px rgba(0,0,0,.7);
}
.cx-marco header {
  display: flex; justify-content: space-between; align-items: flex-end;
  padding: 1.3rem 1.6rem 1rem; border-bottom: 1px solid rgba(255,255,255,.08);
}
.cx-marco h2 { font-size: 1.34rem; font-weight: 300; letter-spacing: .11em; color: #e8e4dc; }
.cx-sub { font-size: .72rem; color: #8a9188; letter-spacing: .14em; text-transform: uppercase; margin-top: .18rem; }
.cx-progreso { display: flex; gap: 1.5rem; text-align: right; }
.cx-progreso span { font-size: 1.8rem; font-weight: 200; color: #6fae7c; line-height: 1; }
.cx-progreso small { display: block; font-size: .6rem; color: #8a9188; letter-spacing: .1em; text-transform: uppercase; }
.cx-marco nav { display: flex; gap: .2rem; padding: .8rem 1.6rem 0; flex-wrap: wrap; }
.cx-marco nav button {
  background: none; border: none; border-bottom: 2px solid transparent;
  color: #8a9188; font: inherit; font-size: .76rem; letter-spacing: .09em;
  padding: .42rem .7rem; cursor: pointer; text-transform: uppercase;
}
.cx-marco nav button:hover { color: #e8e4dc; }
.cx-marco nav button.activo { color: #6fae7c; border-bottom-color: #6fae7c; }
.cx-lista { overflow-y: auto; padding: 1rem 1.6rem 1.4rem; display: grid; gap: .7rem; }
.cx-lista.rejilla { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
.cx-lista.columna { grid-template-columns: 1fr; }
.cx-lista::-webkit-scrollbar { width: 7px; }
.cx-lista::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 4px; }

.cx-ficha {
  display: flex; gap: .85rem; padding: .85rem;
  background: rgba(255,255,255,.026); border: 1px solid rgba(255,255,255,.055);
  border-radius: 4px; border-left: 2px solid var(--c, #3a4a3e);
}
.cx-ficha.oculta { opacity: .32; }
.cx-ficha.identificada { border-left-color: #6fae7c; background: rgba(111,174,124,.05); }
.cx-silueta {
  flex: 0 0 46px; height: 46px; border-radius: 3px;
  background: var(--c, #2a332c); opacity: .8;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.45); font-size: 1.3rem; font-weight: 300;
}
.cx-datos { min-width: 0; }
.cx-datos h3 { font-size: .92rem; font-weight: 500; color: #e8e4dc; letter-spacing: .02em; }
.cx-datos h3 em { font-style: normal; font-size: .76rem; color: #a89a7a; font-weight: 400; }
.cx-cient { font-size: .74rem; font-style: italic; color: #8a9188; margin-bottom: .3rem; }
.cx-tags { display: flex; flex-wrap: wrap; gap: .26rem; margin-bottom: .4rem; }
.cx-tag {
  font-size: .6rem; letter-spacing: .06em; text-transform: uppercase;
  padding: .12rem .42rem; border-radius: 2px;
  color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  background: color-mix(in srgb, var(--c) 12%, transparent);
}
.cx-desc { font-size: .78rem; line-height: 1.66; color: #bdb8ae; margin-bottom: .34rem; }
.cx-parcial { color: #7d857c; font-style: italic; font-size: .76rem; }
.cx-curioso { font-size: .75rem; line-height: 1.6; color: #c8b98a; border-left: 2px solid rgba(200,185,138,.3); padding-left: .55rem; margin-bottom: .34rem; }
.cx-uso { font-size: .74rem; line-height: 1.58; color: #97a396; margin-bottom: .26rem; }
.cx-uso b { color: #b8c2b4; font-weight: 500; }
.cx-meta { font-size: .66rem; color: #6d766f; letter-spacing: .04em; }

.cx-bloque {
  padding: .9rem 1rem .8rem; border-left: 3px solid var(--c, #6fae7c);
  background: rgba(255,255,255,.03); border-radius: 3px; margin-top: .5rem;
}
.cx-bloque h3 { font-size: 1rem; font-weight: 400; color: #e8e4dc; letter-spacing: .06em; margin-bottom: .3rem; }
.cx-bloque h3 em { font-style: normal; font-size: .74rem; color: #8a9188; margin-left: .5rem; }

.cx-linea { display: flex; gap: 1rem; padding: .6rem .4rem .6rem 1rem; border-left: 1px solid rgba(255,255,255,.1); }
.cx-linea.oculta { opacity: .34; }
.cx-anio { flex: 0 0 92px; font-size: .74rem; color: #a89a7a; font-variant-numeric: tabular-nums; padding-top: .1rem; }

.cx-topos { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: .5rem; }
.cx-topo { padding: .55rem .7rem; background: rgba(255,255,255,.026); border-radius: 3px; border-left: 2px solid #8a6fd0; }
.cx-topo b { color: #e8e4dc; font-size: .85rem; font-weight: 500; display: block; }
.cx-sig { display: block; font-size: .78rem; color: #c8b98a; margin: .1rem 0 .16rem; }
.cx-nota { display: block; font-size: .7rem; color: #7d857c; line-height: 1.5; }

.cx-saberes { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: .5rem; }
.cx-saber { padding: .65rem .8rem; background: rgba(255,255,255,.026); border-radius: 3px; border-left: 2px solid #4a8fb5; }
.cx-saber h4 { font-size: .85rem; font-weight: 500; color: #e8e4dc; margin-bottom: .22rem; display: flex; justify-content: space-between; }
.cx-costo { color: #6fae7c; font-size: .72rem; font-weight: 400; }
.cx-saber.sab-ok { border-left-color: #6fae7c; background: rgba(111,174,124,.07); }
.cx-saber.sab-lista { border-left-color: #c8b45a; background: rgba(200,180,90,.06); }
.cx-saber.sab-imposible { opacity: .45; border-left-color: #5a544b; }
.cx-mats { font-size: .68rem; margin-bottom: .4rem; display: flex; flex-wrap: wrap; gap: .3rem; }
.cx-mats span { padding: .06rem .34rem; border-radius: 2px; }
.mat-ok { color: #6fae7c; background: rgba(111,174,124,.12); }
.mat-falta { color: #d8a05a; background: rgba(216,160,90,.12); }
.mat-imposible { color: #8a8378; background: rgba(138,131,120,.12); text-decoration: line-through; }
.cx-pie-saber { min-height: 1.4rem; }
.sab-btn { background: rgba(200,180,90,.16); border: 1px solid rgba(200,180,90,.5);
  color: #e0cf88; font: inherit; font-size: .72rem; padding: .26rem .7rem;
  border-radius: 3px; cursor: pointer; letter-spacing: .04em; }
.sab-btn:hover { background: rgba(200,180,90,.3); color: #fff; }
.sab-marca { font-size: .7rem; color: #6fae7c; letter-spacing: .1em; text-transform: uppercase; }
.sab-nota { font-size: .68rem; color: #8a9188; font-style: italic; }

.cx-marco footer { padding: .75rem 1.6rem; border-top: 1px solid rgba(255,255,255,.08); font-size: .68rem; color: #7d857c; letter-spacing: .05em; }
.cx-marco footer b { color: #e8e4dc; }
`;
