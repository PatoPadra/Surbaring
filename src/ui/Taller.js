/**
 * Taller — el panel de hornos y hornadas.
 *
 * Muestra las cosas en el orden en que importan: en qué jurisdicción está
 * parado el jugador —de eso depende si puede encender fuego, abrir cantera o
 * levantar una casa—, qué material hay bajo los pies, qué hornos puede armar,
 * qué se está cociendo y qué obras admite este lugar.
 */

const CSS = `
  #taller { position: fixed; inset: 0; display: none; z-index: 60;
    background: rgba(10,12,11,.72); backdrop-filter: blur(6px);
    font-family: inherit; color: var(--tinta); }
  #taller.abierto { display: grid; place-items: center; }
  #taller .tl-marco { width: min(880px, 92vw); max-height: 86vh; overflow: auto;
    background: rgba(18,21,19,.96); border: 1px solid rgba(255,255,255,.09);
    border-radius: 4px; padding: 1.4rem 1.6rem 1.2rem; }
  #taller h2 { font-size: 1.05rem; font-weight: 500; letter-spacing: .04em; }
  #taller .tl-sub { font-size: .72rem; color: var(--tinta-tenue); margin-top: .2rem; }
  #taller .tl-jur { margin: .9rem 0 1.1rem; padding: .6rem .8rem; border-radius: 3px;
    font-size: .76rem; line-height: 1.5; border-left: 3px solid; }
  #taller .tl-jur.parque { border-color: #c8503f; background: rgba(200,80,63,.10); }
  #taller .tl-jur.reserva { border-color: #d08a3a; background: rgba(208,138,58,.10); }
  #taller .tl-jur.fuera { border-color: #6fae7c; background: rgba(111,174,124,.10); }
  #taller h3 { font-size: .66rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: 1.1rem 0 .5rem; }
  #taller .tl-fila { display: flex; align-items: baseline; gap: .8rem;
    padding: .5rem 0; border-top: 1px solid rgba(255,255,255,.06); }
  #taller .tl-fila b { font-weight: 500; min-width: 9rem; }
  #taller .tl-fila small { color: var(--tinta-tenue); font-size: .7rem; flex: 1; line-height: 1.45; }
  #taller button { background: rgba(255,255,255,.06); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
    padding: .28rem .7rem; font: inherit; font-size: .72rem; cursor: pointer; white-space: nowrap; }
  #taller button:hover:not(:disabled) { background: rgba(255,255,255,.13); }
  #taller button:disabled { opacity: .35; cursor: default; }
  #taller .tl-barra { height: 3px; background: rgba(255,255,255,.1); border-radius: 2px; flex: 1; }
  #taller .tl-barra i { display: block; height: 100%; background: #d08a3a; border-radius: 2px; }
  #taller footer { margin-top: 1.2rem; font-size: .7rem; color: var(--tinta-tenue); }
`;

export class Taller {
  /**
   * @param {object} deps {fundicion, mineria, construccion, limites, jugador, inventario}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    this._crear();
    this.fundicion.alCambiar = () => { if (this.abierto) this.pintar(); };
    if (this.construccion) this.construccion.alCambiar = () => { if (this.abierto) this.pintar(); };
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'taller';
    el.innerHTML = `
      <div class="tl-marco">
        <h2>Taller</h2>
        <p class="tl-sub">Cantera, hornos, hornadas y obras</p>
        <div id="tl-cuerpo"></div>
        <footer>El tiempo de cocción corre en horas del mundo · <b>T</b> acelera el reloj · <b>G</b> cierra</footer>
      </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;

    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-accion]');
      if (!b) return;
      const { accion, id } = b.dataset;
      if (accion === 'construir') {
        this.fundicion.construir(this.fundicion.hornoPorId(id));
      } else if (accion === 'cocinar') {
        const horno = this.fundicion.cercano();
        const receta = this.fundicion.recetas.find(r => r.id === id);
        if (horno && receta) this.fundicion.iniciar(receta, horno);
      } else if (accion === 'retirar') {
        const horno = this.fundicion.cercano();
        if (horno) this.fundicion.retirar(horno);
      } else if (accion === 'levantar') {
        const obra = this.construccion.catalogo.find(o => o.id === id);
        if (obra) this.construccion.levantar(obra);
      } else if (accion === 'guardar') {
        const p = this.jugador.posicion;
        const dep = this.construccion.depositoCercano(p.x, p.z);
        if (dep) this.construccion.guardarTodo(dep);
      } else if (accion === 'sacar') {
        const p = this.jugador.posicion;
        const dep = this.construccion.depositoCercano(p.x, p.z);
        if (dep) this.construccion.retirar(dep, id, dep.guardado.get(id) || 0);
      }
      this.pintar();
    });
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this.pintar();
      document.exitPointerLock?.();
    }
  }

  pintar() {
    const p = this.jugador.posicion;
    const j = this.limites.etiqueta(p.x, p.z);
    const horno = this.fundicion.cercano();

    let html = `<div class="tl-jur ${j.id}">${this._textoJurisdiccion(j)}</div>`;

    // ── Cantera
    const vc = this.mineria.evaluar(p.x, p.z, this.fundicion.tiempo.segundosTotales);
    html += `<h3>Cantera</h3><div class="tl-fila">
      <b>${vc.permitido ? vc.yacimiento.nombre : 'No se puede acá'}</b>
      <small>${vc.detalle || ''}</small></div>`;

    // ── Construir
    html += '<h3>Hornos</h3>';
    for (const def of this.fundicion.definicionesHorno) {
      const falta = this.fundicion.faltaPara(def);
      const receta = (def.materiales || [])
        .map(m => `${m.cantidad} ${m.recurso.replace(/_/g, ' ')}`).join(' · ');
      html += `<div class="tl-fila">
        <b>${def.nombre}</b>
        <small>${def.descripcion}<br><span style="opacity:.75">${receta} · hasta ${def.temperaturaC} °C</span></small>
        <button data-accion="construir" data-id="${def.id}" ${falta.length ? 'disabled' : ''}>
          ${falta.length ? falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(', ') : 'Levantar'}
        </button></div>`;
    }

    // ── Hornadas del horno que tengo al lado
    html += '<h3>Hornadas</h3>';
    if (!horno) {
      html += `<div class="tl-fila"><small>No tenés ningún horno a mano. Acercate a menos de 8 m de uno que hayas construido.</small></div>`;
    } else if (horno.trabajo?.esperando) {
      html += `<div class="tl-fila"><b>${horno.trabajo.receta.nombre}</b>
        <small>Terminada y esperando lugar en el bolso</small>
        <button data-accion="retirar">Retirar</button></div>`;
    } else if (horno.trabajo) {
      const pr = Math.round(this.fundicion.progreso(horno) * 100);
      html += `<div class="tl-fila"><b>${horno.trabajo.receta.nombre}</b>
        <div class="tl-barra"><i style="width:${pr}%"></i></div>
        <small style="flex:0 0 3rem;text-align:right">${pr}%</small></div>`;
    } else {
      const recetas = this.fundicion.recetasDe(horno.def.id);
      for (const r of recetas) {
        const e = this.fundicion.estadoReceta(r, horno);
        const entra = (r.entra || []).map(m => `${m.cantidad} ${m.recurso.replace(/_/g, ' ')}`).join(' · ');
        const sale = (r.sale || []).map(m => `${m.cantidad} ${m.recurso.replace(/_/g, ' ')}`).join(' · ');
        html += `<div class="tl-fila">
          <b>${r.nombre}</b>
          <small>${entra} → ${sale} · ${r.horas} h<br><span style="opacity:.75">${r.nota || ''}</span></small>
          <button data-accion="cocinar" data-id="${r.id}" ${e.estado === 'lista' ? '' : 'disabled'}>
            ${e.estado === 'lista' ? 'Cargar' : e.falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(', ')}
          </button></div>`;
      }
    }

    html += this._pintarObras(p, j);
    document.getElementById('tl-cuerpo').innerHTML = html;
  }

  /**
   * Obras: qué se puede levantar acá y qué hay guardado a mano. Las que la
   * jurisdicción no admite igual se listan, con el motivo escrito: enterarse de
   * que una cabaña no va dentro del parque es parte del contenido.
   */
  _pintarObras(p, j) {
    if (!this.construccion) return '';
    let html = '<h3>Obras</h3>';

    for (const obra of this.construccion.catalogo) {
      const v = this.construccion.evaluar(obra, p.x, p.z);
      const cat = this.construccion.categoriaDe(obra);
      const receta = (obra.materiales || [])
        .map(m => `${m.cantidad} ${m.recurso.replace(/_/g, ' ')}`).join(' · ');
      const efectos = [
        obra.abrigo ? `abriga ${Math.round(obra.abrigo * 100)} %` : null,
        obra.guarda ? `guarda ${obra.guarda} kg` : null,
        obra.procesa ? 'procesa material' : null,
        cat.duracionDias ? `dura ${cat.duracionDias} días` : null,
      ].filter(Boolean).join(' · ');

      html += `<div class="tl-fila">
        <b>${obra.nombre}</b>
        <small>${obra.descripcion}<br>
          <span style="opacity:.75">${receta}${efectos ? ' · ' + efectos : ''} · ${cat.nombre || ''}</span>
          ${v.permitido ? '' : `<br><span style="opacity:.8;color:#d08a3a">${v.titulo}</span>`}</small>
        <button data-accion="levantar" data-id="${obra.id}" ${v.permitido ? '' : 'disabled'}>Levantar</button>
      </div>`;
    }

    const dep = this.construccion.depositoCercano(p.x, p.z);
    if (dep) {
      const guardado = [...dep.guardado.entries()];
      html += `<h3>${dep.obra.nombre}</h3>
        <div class="tl-fila">
          <b>${this.construccion.pesoGuardado(dep).toFixed(1)} / ${dep.obra.guarda} kg</b>
          <small>Lo que dejás acá no pesa en el bolso. Los alimentos se quedan con vos.</small>
          <button data-accion="guardar">Guardar todo</button>
        </div>`;
      for (const [id, n] of guardado) {
        html += `<div class="tl-fila"><b>${id.replace(/_/g, ' ')}</b>
          <small>${n} unidades</small>
          <button data-accion="sacar" data-id="${id}">Sacar</button></div>`;
      }
    }
    return html;
  }

  _textoJurisdiccion(j) {
    switch (j.id) {
      case 'parque':
        return `<b>${j.nombre}</b> — área núcleo. El artículo 5 de la Ley 22.351 prohíbe acá toda extracción minera, y el fuego sólo se permite en sitios habilitados. Para trabajar material hay que salir de esta zona.`;
      case 'reserva':
        return `<b>${j.nombre}</b> — Reserva Nacional. Régimen más permisivo: la Administración de Parques Nacionales puede autorizar canteras y hay áreas con fogones habilitados, pero autorizable no es lo mismo que autorizado.`;
      default:
        return `<b>${j.nombre}</b> — fuera del área protegida. Rige el dominio provincial de los recursos y el Código de Minería: la extracción de áridos es legal y regulada.`;
    }
  }
}
