/**
 * Opciones — el menú de siempre, con Escape.
 *
 * Nada exótico: gráficos, sonido, controles y partida. Vale aclarar una
 * decisión: la calidad se puede fijar a mano, y hacerlo apaga el gobernador
 * automático. Si alguien elige "Alta" y su placa da diez cuadros por segundo, el
 * juego no se lo va a corregir por atrás; lo que sí hace es mostrarle los fps al
 * lado para que la decisión sea informada.
 *
 * Detalle de navegador que importa: con el puntero capturado, Escape se lo come
 * el navegador para liberarlo y la tecla nunca llega a la página. Por eso el
 * menú no se abre escuchando Escape sino el momento en que se suelta el puntero,
 * que es lo que el jugador realmente hizo.
 */

const CSS = `
  #opciones { position: fixed; inset: 0; z-index: 95; display: none;
    background: rgba(8,10,9,.82); backdrop-filter: blur(6px); color: var(--tinta); }
  #opciones.abierto { display: grid; place-items: center; }
  #opciones .op-marco { width: min(520px, 92vw); max-height: 88vh; overflow: auto;
    background: rgba(18,21,19,.97); border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 1.3rem 1.5rem; }
  #opciones h2 { font-size: 1rem; font-weight: 500; letter-spacing: .04em; margin-bottom: .1rem; }
  #opciones .op-sub { font-size: .7rem; color: var(--tinta-tenue); margin-bottom: 1.1rem; }
  #opciones h3 { font-size: .64rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: 1.1rem 0 .5rem; }
  #opciones .op-fila { display: flex; align-items: center; gap: .8rem; padding: .42rem 0;
    border-top: 1px solid rgba(255,255,255,.06); font-size: .76rem; }
  #opciones .op-fila > span:first-child { flex: 1; }
  #opciones .op-valor { color: var(--tinta-tenue); font-size: .7rem;
    min-width: 3.6rem; text-align: right; font-variant-numeric: tabular-nums; }
  #opciones input[type=range] { width: 150px; accent-color: #7f9f74; }
  #opciones button { background: rgba(255,255,255,.06); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
    padding: .26rem .7rem; font: inherit; font-size: .72rem; cursor: pointer; }
  #opciones button:hover { background: rgba(255,255,255,.13); }
  #opciones button.activo { background: rgba(127,159,116,.26); border-color: rgba(127,159,116,.6); }
  #opciones .op-grupo { display: flex; gap: .3rem; }
  #opciones .op-nota { font-size: .68rem; color: var(--tinta-tenue); line-height: 1.5;
    margin-top: .8rem; }
  #opciones .op-peligro { color: #c8503f; border-color: rgba(200,80,63,.5); }
`;

export class Opciones {
  /**
   * @param {object} deps {calidad, audio, entrada, camara, jugador, tiempo,
   *                       exploracion, hud, render}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'opciones';
    el.innerHTML = `<div class="op-marco">
      <h2>Opciones</h2>
      <p class="op-sub" id="op-placa"></p>
      <div id="op-cuerpo"></div>
      <p class="op-nota">Escape o clic en el mundo para volver al juego.</p>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;

    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-accion]');
      if (!b) return;
      this._accion(b.dataset.accion, b.dataset.valor);
      this.pintar();
    });
    el.addEventListener('input', (ev) => {
      const r = ev.target.closest('input[data-accion]');
      if (!r) return;
      this._accion(r.dataset.accion, r.value);
      this.pintar();
    });
  }

  _accion(accion, valor) {
    const v = parseFloat(valor);
    switch (accion) {
      case 'calidad':
        this.calidad.elegir(parseInt(valor, 10));
        break;
      case 'auto':
        this.calidad.automatico = !this.calidad.automatico;
        if (this.calidad.automatico) this.calidad.aplicar();
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
      case 'fov':
        this.camara.fov = v;
        this.camara.updateProjectionMatrix();
        break;
      case 'velocidadTiempo':
        this.tiempo.indiceVelocidad = parseInt(valor, 10);
        break;
      case 'olvidarMapa':
        this.exploracion.olvidar();
        this.hud?.aviso('Mapa borrado', 'Vuelve a empezar en blanco');
        break;
      case 'reiniciar':
        this.jugador.revivir();
        this.jugador.aparecerEn(-41.0870, -71.4290);
        this.cerrar();
        this.hud?.aviso('Partida reiniciada', 'El códice y el mapa se conservan');
        break;
    }
  }

  pintar() {
    const c = this.calidad, a = this.audio, e = this.entrada;
    this.el.querySelector('#op-placa').textContent =
      `${c.placa.replace(/^ANGLE \(|\)$/g, '').slice(0, 64)} · ${c.resumen}`;

    const botones = (accion, opciones, activo) => `<div class="op-grupo">` +
      opciones.map((o, i) =>
        `<button data-accion="${accion}" data-valor="${o.valor ?? i}"
          class="${activo === (o.valor ?? i) ? 'activo' : ''}">${o.nombre}</button>`).join('') +
      `</div>`;

    const rango = (accion, min, max, paso, valor, texto) => `
      <input type="range" data-accion="${accion}" min="${min}" max="${max}" step="${paso}" value="${valor}">
      <span class="op-valor">${texto}</span>`;

    this.el.querySelector('#op-cuerpo').innerHTML = `
      <h3>Gráficos</h3>
      <div class="op-fila"><span>Calidad</span>
        ${botones('calidad', [{ nombre: 'Alta' }, { nombre: 'Media' }, { nombre: 'Baja' }, { nombre: 'Mínima' }], c.nivel)}</div>
      <div class="op-fila"><span>Ajuste automático</span>
        <span class="op-valor">${c.automatico ? 'sí' : 'no'}</span>
        <button data-accion="auto">${c.automatico ? 'Apagar' : 'Encender'}</button></div>
      <div class="op-fila"><span>Campo de visión</span>
        ${rango('fov', 55, 100, 1, this.camara.fov, `${Math.round(this.camara.fov)}°`)}</div>

      <h3>Sonido</h3>
      <div class="op-fila"><span>Volumen</span>
        ${rango('volumen', 0, 1, 0.05, a.volumen, `${Math.round(a.volumen * 100)} %`)}</div>
      <div class="op-fila"><span>Silencio</span>
        <span class="op-valor">${a.silenciado ? 'sí' : 'no'}</span>
        <button data-accion="silencio">${a.silenciado ? 'Activar' : 'Silenciar'}</button></div>

      <h3>Controles</h3>
      <div class="op-fila"><span>Sensibilidad del ratón</span>
        ${rango('sensibilidad', 0.2, 3, 0.1, e.sensibilidad, e.sensibilidad.toFixed(1))}</div>
      <div class="op-fila"><span>Invertir eje vertical</span>
        <span class="op-valor">${e.invertirY ? 'sí' : 'no'}</span>
        <button data-accion="invertirY">${e.invertirY ? 'Normal' : 'Invertir'}</button></div>

      <h3>Partida</h3>
      <div class="op-fila"><span>Paso del tiempo</span>
        ${botones('velocidadTiempo', [{ nombre: '1 min/s' }, { nombre: '5 min/s' }, { nombre: '30 min/s' }, { nombre: '2 h/s' }], this.tiempo.indiceVelocidad)}</div>
      <div class="op-fila"><span>Explorado</span>
        <span class="op-valor">${(this.exploracion.fraccionExplorada * 100).toFixed(1)} %</span>
        <button data-accion="olvidarMapa" class="op-peligro">Borrar mapa</button></div>
      <div class="op-fila"><span>Empezar de nuevo</span>
        <button data-accion="reiniciar" class="op-peligro">Reiniciar</button></div>`;
  }

  abrir() {
    this.abierto = true;
    this.el.classList.add('abierto');
    this.pintar();
    document.exitPointerLock?.();
  }

  cerrar() {
    this.abierto = false;
    this.el.classList.remove('abierto');
  }

  alternar() { this.abierto ? this.cerrar() : this.abrir(); }
}
