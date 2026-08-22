/**
 * Panel del juego — una sola ventana con pestañas: Controles, Video, Audio y
 * Partida.
 *
 * Antes había dos: la ayuda de teclas en F1 y las opciones en Escape, más un
 * recuadro fijo abajo a la derecha que repetía media lista encima del paisaje.
 * Tres lugares para lo mismo. Ahora hay uno solo, con la forma que tiene
 * cualquier juego: F1 lo abre en Controles, Escape en la última pestaña que se
 * miró, y el mundo se ve limpio.
 *
 * La calidad vuelve a ser una barra. Cuatro botones daban la impresión de que
 * eran cuatro cosas distintas; son un mismo eje de menos a más, y una barra lo
 * dice sin explicarlo. Moverla apaga el gobernador automático: si alguien elige
 * "Alta" y su placa da diez cuadros por segundo, el juego no se lo corrige por
 * atrás, pero le muestra los fps al lado para que la decisión sea informada.
 *
 * Detalle de navegador que importa: con el puntero capturado, Escape se lo come
 * el navegador para liberarlo y la tecla nunca llega a la página. Por eso el
 * panel no se abre escuchando Escape sino el momento en que se suelta el
 * puntero, que es lo que el jugador realmente hizo.
 */

const CONTROLES = [
  {
    titulo: 'Moverse',
    teclas: [
      ['WASD', 'Caminar'],
      ['Shift', 'Correr (gasta resistencia)'],
      ['Espacio', 'Saltar · nadar hacia arriba'],
      ['Ctrl o C', 'Agacharse'],
      ['F', 'Primera o tercera persona'],
    ],
  },
  {
    titulo: 'Actuar sobre el mundo',
    teclas: [
      ['E', 'Recolectar · identificar · beber · sacar el permiso de pesca'],
      ['Q', 'Comer lo mejor que haya en el bolso'],
      ['R', 'Extraer áridos o levantar chatarra'],
      ['P', 'Tirar la línea'],
      ['H', 'Intentar cazar (fijate qué dice la ley)'],
    ],
  },
  {
    titulo: 'Paneles',
    teclas: [
      ['Tab', 'Códice: fauna, flora, geografía, historia, mitología y saberes'],
      ['M', 'Mapa del parque, que se revela explorando'],
      ['I', 'Bolso: pesos, comer y tirar'],
      ['G', 'Taller: cantera, hornos, hornadas y obras'],
      ['F1 o Esc', 'Este panel'],
    ],
  },
  {
    titulo: 'Ajustes rápidos',
    teclas: [
      ['T', 'Acelerar el paso del tiempo'],
      ['C', 'Cambiar la calidad gráfica'],
      ['O', 'Posproceso: completo, sin oclusión, crudo'],
      ['F3', 'Panel de diagnóstico'],
    ],
  },
];

const PESTANAS = [
  { id: 'controles', nombre: 'Controles' },
  { id: 'aspecto', nombre: 'Aspecto' },
  { id: 'video', nombre: 'Video' },
  { id: 'audio', nombre: 'Audio' },
  { id: 'partida', nombre: 'Partida' },
];

const CSS = `
  #opciones { position: fixed; inset: 0; z-index: 95; display: none;
    background: rgba(8,10,9,.82); backdrop-filter: blur(6px); color: var(--tinta); }
  #opciones.abierto { display: grid; place-items: center; }
  #opciones .op-marco { width: min(640px, 93vw); max-height: 88vh; display: flex;
    flex-direction: column;
    background: rgba(18,21,19,.97); border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 1.3rem 1.5rem 1.1rem; }
  #opciones h2 { font-size: 1rem; font-weight: 500; letter-spacing: .04em; margin-bottom: .1rem; }
  #opciones .op-sub { font-size: .7rem; color: var(--tinta-tenue); margin-bottom: .9rem; }
  #opciones nav { display: flex; gap: .2rem; border-bottom: 1px solid rgba(255,255,255,.09);
    margin-bottom: .3rem; }
  #opciones nav button { background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--tinta-tenue); font: inherit; font-size: .74rem; letter-spacing: .06em;
    padding: .4rem .7rem; cursor: pointer; }
  #opciones nav button:hover { color: var(--tinta); background: none; }
  #opciones nav button.activo { color: #6fae7c; border-bottom-color: #6fae7c; }
  #opciones #op-cuerpo { overflow: auto; padding-right: .2rem; }
  #opciones h3 { font-size: .64rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: 1.1rem 0 .5rem; }
  #opciones .op-fila { display: flex; align-items: center; gap: .8rem; padding: .42rem 0;
    border-top: 1px solid rgba(255,255,255,.06); font-size: .76rem; }
  #opciones .op-fila > span:first-child { flex: 1; }
  #opciones .op-valor { color: var(--tinta-tenue); font-size: .7rem;
    min-width: 3.6rem; text-align: right; font-variant-numeric: tabular-nums; }
  #opciones input[type=range] { width: 170px; accent-color: #7f9f74; }
  #opciones button { background: rgba(255,255,255,.06); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
    padding: .26rem .7rem; font: inherit; font-size: .72rem; cursor: pointer; }
  #opciones button:hover { background: rgba(255,255,255,.13); }
  #opciones button.activo { background: rgba(127,159,116,.26); border-color: rgba(127,159,116,.6); }
  #opciones .op-grupo { display: flex; gap: .3rem; }
  #opciones .op-nota { font-size: .68rem; color: var(--tinta-tenue); line-height: 1.5;
    margin-top: .8rem; }
  #opciones .op-pie { font-size: .66rem; color: var(--tinta-tenue); margin-top: .9rem;
    border-top: 1px solid rgba(255,255,255,.07); padding-top: .6rem; }
  #opciones .op-peligro { color: #c8503f; border-color: rgba(200,80,63,.5); }
  #opciones .ay-fila { display: flex; gap: .9rem; padding: .26rem 0; font-size: .76rem;
    border-top: 1px solid rgba(255,255,255,.05); }
  #opciones kbd { font: inherit; font-size: .68rem; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.16); border-radius: 3px; padding: .06rem .4rem;
    min-width: 4.8rem; text-align: center; color: var(--acento); }
`;

export class Opciones {
  /**
   * @param {object} deps {calidad, audio, entrada, camara, jugador, tiempo,
   *                       exploracion, hud, render, partida, posproceso,
   *                       modoPosproceso, fps}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    this.pestana = 'controles';
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'opciones';
    el.innerHTML = `<div class="op-marco">
      <h2>SurviBar</h2>
      <p class="op-sub" id="op-placa"></p>
      <nav id="op-nav">${PESTANAS.map(p =>
        `<button data-pestana="${p.id}">${p.nombre}</button>`).join('')}</nav>
      <div id="op-cuerpo"></div>
      <p class="op-pie">Escape o clic en el mundo para volver al juego · <b>F1</b> abre en Controles.</p>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;

    el.addEventListener('click', (ev) => {
      const p = ev.target.closest('button[data-pestana]');
      if (p) { this.pestana = p.dataset.pestana; this.pintar(); return; }
      const b = ev.target.closest('button[data-accion]');
      if (!b) return;
      this._accion(b.dataset.accion, b.dataset.valor);
      this.pintar();
    });
    el.addEventListener('input', (ev) => {
      const r = ev.target.closest('input[data-accion]');
      if (!r) return;
      this._accion(r.dataset.accion, r.value);
      // Repintar la pestaña entera acá reemplazaría el propio deslizador en
      // pleno arrastre, y el arrastre se corta en el primer movimiento: hay que
      // volver a apretar el botón por cada paso de la barra. Se actualiza sólo
      // el número que está al lado.
      const valor = r.nextElementSibling;
      if (valor?.classList.contains('op-valor')) valor.textContent = this._texto(r.dataset.accion);
    });
  }

  _accion(accion, valor) {
    const v = parseFloat(valor);
    switch (accion) {
      case 'calidad':
        // La barra va de menos a más y los presets al revés: 0 es Alta
        this.calidad.elegir(3 - parseInt(valor, 10));
        break;
      case 'auto':
        this.calidad.automatico = !this.calidad.automatico;
        if (this.calidad.automatico) this.calidad.aplicar();
        break;
      case 'posproceso':
        this.posproceso?.(parseInt(valor, 10));
        break;
      case 'volumen':
        this.audio.volumen = v;
        this.audio.iniciar();
        if (this.audio.maestro) this.audio.maestro.gain.value = this.audio.silenciado ? 0 : v;
        break;
      case 'silencio':
        this.audio.iniciar();
        this.audio.alternarSilencio();
        break;
      case 'sensibilidad':
        this.entrada.sensibilidad = v;
        break;
      case 'invertirY':
        this.entrada.invertirY = !this.entrada.invertirY;
        break;
      case 'balanceo':
        this.jugador.balanceo = v;
        break;
      case 'distanciaCamara':
        this.jugador.distanciaCamara = v;
        break;
      case 'hombro':
        this.jugador.hombroCamara = v;
        break;
      case 'tercerPersona':
        this.jugador.tercerPersona = !this.jugador.tercerPersona;
        break;
      case 'editarAspecto':
        this.cerrar();
        this.editarAspecto?.();
        break;
      case 'fov':
        this.camara.fov = v;
        this.camara.updateProjectionMatrix();
        break;
      case 'velocidadTiempo':
        this.tiempo.indiceVelocidad = parseInt(valor, 10);
        break;
      case 'guardar':
        this.partida?.guardar(true);
        break;
      case 'olvidarMapa':
        this.exploracion.olvidar();
        this.hud?.aviso('Mapa borrado', 'Vuelve a empezar en blanco');
        break;
      case 'reiniciar':
        this.partida?.borrar();
        this.jugador.revivir();
        this.jugador.aparecerEn(-41.0870, -71.4290);
        this.cerrar();
        this.hud?.aviso('Partida reiniciada', 'El códice y el mapa se conservan');
        break;
    }
  }

  /** El texto que acompaña a cada deslizador, sin repintar la pestaña. */
  _texto(accion) {
    const j = this.jugador;
    switch (accion) {
      case 'calidad': {
        const fps = this.fps ? Math.round(this.fps()) : null;
        return `${this.calidad.preset.nombre}${fps != null ? ` · ${fps} fps` : ''}`;
      }
      case 'fov': return `${Math.round(this.camara.fov)}°`;
      case 'volumen': return `${Math.round(this.audio.volumen * 100)} %`;
      case 'sensibilidad': return this.entrada.sensibilidad.toFixed(1);
      case 'distanciaCamara': return `${j.distanciaCamara.toFixed(1)} m`;
      case 'hombro': return j.hombroCamara.toFixed(2);
      case 'balanceo': return j.balanceo === 0 ? 'apagado' : `${Math.round(j.balanceo * 100)} %`;
      default: return '';
    }
  }

  // ── Pintado ───────────────────────────────────────────────────────────────

  _botones(accion, opciones, activo) {
    return `<div class="op-grupo">` + opciones.map((o, i) =>
      `<button data-accion="${accion}" data-valor="${o.valor ?? i}"
        class="${activo === (o.valor ?? i) ? 'activo' : ''}">${o.nombre}</button>`).join('') +
      `</div>`;
  }

  _rango(accion, min, max, paso, valor, texto) {
    return `<input type="range" data-accion="${accion}" min="${min}" max="${max}"
      step="${paso}" value="${valor}"><span class="op-valor">${texto}</span>`;
  }

  _controles() {
    return CONTROLES.map(g => `<h3>${g.titulo}</h3>` + g.teclas.map(
      ([k, d]) => `<div class="ay-fila"><kbd>${k}</kbd><span>${d}</span></div>`).join('')).join('')
      + `<p class="op-nota">Los puntos de saber salen de identificar especies, llegar a lugares
        y reconocer fenómenos, y con ellos se desbloquean tecnologías en el códice.
        Casi todo lo que la ley del parque no permite tiene una explicación cuando lo
        intentás: la negativa es el contenido, no un obstáculo.</p>`;
  }

  /**
   * Aspecto y cámara juntos, y no por falta de lugar: son la misma decisión.
   * Cuánto se aleja la cámara y de qué lado del hombro sólo importan cuando hay
   * un cuerpo que mirar, y el cuerpo sólo se entiende viéndolo desde ahí.
   */
  _aspecto() {
    const j = this.jugador;
    const a = this.aspecto;
    return `
      <h3>Personaje</h3>
      <div class="op-fila"><span>${a ? a.resumen : 'Sin definir'}</span>
        <button data-accion="editarAspecto">Cambiar aspecto</button></div>
      <h3>Cámara</h3>
      <div class="op-fila"><span>Vista</span>
        <span class="op-valor">${j.tercerPersona ? 'tercera' : 'primera'}</span>
        <button data-accion="tercerPersona">Cambiar (F)</button></div>
      <div class="op-fila"><span>Distancia en tercera persona</span>
        ${this._rango('distanciaCamara', 2, 8, 0.1, j.distanciaCamara,
          `${j.distanciaCamara.toFixed(1)} m`)}</div>
      <div class="op-fila"><span>Corrimiento al hombro</span>
        ${this._rango('hombro', 0, 1, 0.05, j.hombroCamara, j.hombroCamara.toFixed(2))}</div>
      <div class="op-fila"><span>Balanceo al caminar</span>
        ${this._rango('balanceo', 0, 1, 0.05, j.balanceo,
          j.balanceo === 0 ? 'apagado' : `${Math.round(j.balanceo * 100)} %`)}</div>
      <p class="op-nota">El cuerpo se dibuja también en primera persona —mirá para
        abajo— y por eso proyecta sombra. Si el cabeceo de la cámara te marea,
        bajá el balanceo a cero: el juego no pierde nada.</p>`;
  }

  _video() {
    const c = this.calidad;
    const fps = this.fps ? Math.round(this.fps()) : null;
    return `
      <h3>Gráficos</h3>
      <div class="op-fila"><span>Calidad</span>
        ${this._rango('calidad', 0, 3, 1, 3 - c.nivel,
          `${c.preset.nombre}${fps != null ? ` · ${fps} fps` : ''}`)}</div>
      <div class="op-fila"><span>Ajuste automático</span>
        <span class="op-valor">${c.automatico ? 'sí' : 'no'}</span>
        <button data-accion="auto">${c.automatico ? 'Apagar' : 'Encender'}</button></div>
      <div class="op-fila"><span>Posproceso</span>
        ${this._botones('posproceso', [{ nombre: 'Completo' }, { nombre: 'Sin oclusión' },
          { nombre: 'Crudo' }], this.modoPosproceso?.() ?? 0)}</div>
      <div class="op-fila"><span>Campo de visión</span>
        ${this._rango('fov', 55, 100, 1, this.camara.fov, `${Math.round(this.camara.fov)}°`)}</div>
      <p class="op-nota">Mover la barra apaga el ajuste automático: a partir de ahí el
        cuadro es tu decisión, no la del juego. La resolución interna acompaña a la
        calidad, así que «Mínima» además dibuja más chico y estira.</p>`;
  }

  _audio() {
    const a = this.audio;
    return `
      <h3>Sonido</h3>
      <div class="op-fila"><span>Volumen</span>
        ${this._rango('volumen', 0, 1, 0.05, a.volumen, `${Math.round(a.volumen * 100)} %`)}</div>
      <div class="op-fila"><span>Silencio</span>
        <span class="op-valor">${a.silenciado ? 'sí' : 'no'}</span>
        <button data-accion="silencio">${a.silenciado ? 'Activar' : 'Silenciar'}</button></div>
      <h3>Ratón</h3>
      <div class="op-fila"><span>Sensibilidad</span>
        ${this._rango('sensibilidad', 0.2, 3, 0.1, this.entrada.sensibilidad,
          this.entrada.sensibilidad.toFixed(1))}</div>
      <div class="op-fila"><span>Invertir eje vertical</span>
        <span class="op-valor">${this.entrada.invertirY ? 'sí' : 'no'}</span>
        <button data-accion="invertirY">${this.entrada.invertirY ? 'Normal' : 'Invertir'}</button></div>
      <p class="op-nota">Todo el sonido está sintetizado con WebAudio: no hay un solo
        archivo de audio en el juego.</p>`;
  }

  _partida() {
    const p = this.partida;
    return `
      <h3>Guardado</h3>
      <div class="op-fila"><span>Última vez</span>
        <span class="op-valor">${p?.textoUltimoGuardado ?? '—'}</span>
        <button data-accion="guardar">Guardar ahora</button></div>
      <div class="op-fila"><span>Bases donde reaparecer</span>
        <span class="op-valor">${p?.bases?.length ?? 0}</span></div>
      <h3>Mundo</h3>
      <div class="op-fila"><span>Paso del tiempo</span>
        ${this._botones('velocidadTiempo', [{ nombre: '24 s/s' }, { nombre: '1 min/s' },
          { nombre: '15 min/s' }, { nombre: '2 h/s' }], this.tiempo.indiceVelocidad)}</div>
      <div class="op-fila"><span>Explorado</span>
        <span class="op-valor">${(this.exploracion.fraccionExplorada * 100).toFixed(1)} %</span>
        <button data-accion="olvidarMapa" class="op-peligro">Borrar mapa</button></div>
      <div class="op-fila"><span>Empezar de nuevo</span>
        <button data-accion="reiniciar" class="op-peligro">Reiniciar</button></div>
      <p class="op-nota">Se guarda solo cada tanto y al cerrar la pestaña. Al morir
        perdés lo que cargabas encima y volvés a aparecer en la base más cercana:
        lo que dejaste guardado en un depósito sigue ahí.</p>`;
  }

  pintar() {
    const c = this.calidad;
    this.el.querySelector('#op-placa').textContent =
      `${c.placa.replace(/^ANGLE \(|\)$/g, '').slice(0, 64)} · ${c.resumen}`;
    for (const b of this.el.querySelectorAll('#op-nav button')) {
      b.classList.toggle('activo', b.dataset.pestana === this.pestana);
    }
    const cuerpo = {
      controles: () => this._controles(),
      aspecto: () => this._aspecto(),
      video: () => this._video(),
      audio: () => this._audio(),
      partida: () => this._partida(),
    }[this.pestana] || (() => '');
    this.el.querySelector('#op-cuerpo').innerHTML = cuerpo();
  }

  abrir(pestana) {
    if (pestana) this.pestana = pestana;
    this.abierto = true;
    this.el.classList.add('abierto');
    this.pintar();
    document.exitPointerLock?.();
  }

  cerrar() {
    this.abierto = false;
    this.el.classList.remove('abierto');
  }

  alternar(pestana) {
    if (this.abierto && (!pestana || pestana === this.pestana)) this.cerrar();
    else this.abrir(pestana);
  }
}
