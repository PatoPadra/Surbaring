/**
 * Códice — la enciclopedia viva del parque.
 *
 * No es un menú de ayuda: es el objetivo del juego. Cada especie se descubre
 * avistándola en su hábitat real y se completa identificándola de cerca. El
 * jugador termina la partida sabiendo distinguir un coihue de una lenga y
 * entendiendo por qué el huemul está en peligro.
 */

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

export class Codice {
  constructor(flora, fauna, hud) {
    this.flora = flora;
    this.fauna = fauna;
    this.hud = hud;
    this.descubiertas = new Set();
    this.identificadas = new Set();
    this.abierto = false;
    this.pestana = 'fauna';

    this._crearElemento();
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
          <div class="cx-progreso"><span id="cx-cuenta">0</span><small>especies identificadas</small></div>
        </header>
        <nav>
          <button data-p="fauna" class="activo">Fauna</button>
          <button data-p="flora">Flora</button>
          <button data-p="amenazadas">Amenazadas</button>
          <button data-p="invasoras">Invasoras</button>
        </nav>
        <div class="cx-lista" id="cx-lista"></div>
        <footer>Recorré el parque para descubrir especies · <b>E</b> identifica al animal más cercano · <b>Tab</b> cierra</footer>
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

  /** @param {boolean} deCerca true si el jugador la identificó, no sólo la vio */
  registrarFauna(esp, deCerca) {
    const nueva = !this.descubiertas.has(esp.id);
    this.descubiertas.add(esp.id);
    if (deCerca && !this.identificadas.has(esp.id)) {
      this.identificadas.add(esp.id);
      const [etiqueta] = ESTADOS_UICN[esp.estadoConservacion] || ['', ''];
      this.hud?.aviso(
        `${esp.nombreComun} identificado`,
        `${esp.nombreCientifico}${etiqueta ? ' · ' + etiqueta : ''}`
      );
      this._actualizarCuenta();
      return;
    }
    if (nueva) {
      this.hud?.aviso(`Avistaste un ${esp.nombreComun.toLowerCase()}`, 'Acercate y pulsá E para identificarlo');
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
    const el = document.getElementById('cx-cuenta');
    if (el) el.textContent = this.identificadas.size;
  }

  _entradas() {
    const f = this.fauna.especies.map(e => ({ ...e, reino: 'fauna' }));
    const p = this.flora.especies.map(e => ({ ...e, reino: 'flora' }));
    switch (this.pestana) {
      case 'fauna': return f;
      case 'flora': return p;
      case 'amenazadas':
        return f.filter(e => ['CR', 'EN', 'VU', 'NT'].includes(e.estadoConservacion));
      case 'invasoras':
        return [...f, ...p].filter(e => e.invasora);
      default: return f;
    }
  }

  _pintar() {
    const lista = document.getElementById('cx-lista');
    const entradas = this._entradas();

    lista.innerHTML = entradas.map(e => {
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
      const insignias = [];
      if (etiqueta) insignias.push(`<span class="cx-tag" style="--c:${color}">${etiqueta}</span>`);
      if (e.monumentoNatural) insignias.push(`<span class="cx-tag" style="--c:#8a6fd0">Monumento Natural</span>`);
      if (e.invasora) insignias.push(`<span class="cx-tag" style="--c:#c8503f">Especie invasora</span>`);
      if (e.protegida) insignias.push(`<span class="cx-tag" style="--c:#4a8fb5">Protegida</span>`);
      if (e.nativa && !e.invasora) insignias.push(`<span class="cx-tag" style="--c:#6fae7c">Nativa</span>`);

      const detalles = [];
      if (e.reino === 'fauna') {
        if (e.pesoKg) detalles.push(`${e.pesoKg} kg`);
        if (e.largoM) detalles.push(`${e.largoM} m de largo`);
        if (e.dieta) detalles.push(cap(e.dieta));
        if (e.actividad) detalles.push(cap(e.actividad));
      } else {
        if (e.alturaMaxM) detalles.push(`hasta ${e.alturaMaxM} m`);
        if (e.perenne !== undefined) detalles.push(e.perenne ? 'Siempreverde' : 'Caducifolio');
        if (e.comestible) detalles.push(`Comestible (${e.parteComestible || 'fruto'})`);
      }
      if (e.altitudMinM != null && e.altitudMaxM != null) {
        detalles.push(`${e.altitudMinM}–${e.altitudMaxM} m s. n. m.`);
      }

      return `<article class="cx-ficha ${id ? 'identificada' : 'avistada'}">
        <div class="cx-silueta" style="--c:${e.colorPrincipal || e.colorHojaVerano || '#6a7a6a'}"></div>
        <div class="cx-datos">
          <h3>${e.nombreComun}${e.nombreMapuzugun ? ` <em>· ${e.nombreMapuzugun}</em>` : ''}</h3>
          <p class="cx-cient">${e.nombreCientifico}</p>
          <div class="cx-tags">${insignias.join('')}</div>
          ${id ? `<p class="cx-desc">${e.descripcionEducativa || ''}</p>
                  ${e.datoCurioso ? `<p class="cx-curioso">${e.datoCurioso}</p>` : ''}
                  ${e.usoMapuche ? `<p class="cx-uso"><b>Uso mapuche:</b> ${e.usoMapuche}</p>` : ''}
                  ${e.rolEcologico || e.roiEcologico ? `<p class="cx-uso"><b>Rol ecológico:</b> ${e.rolEcologico || e.roiEcologico}</p>` : ''}`
              : `<p class="cx-desc cx-parcial">Avistada, sin identificar. Acercate y pulsá <b>E</b>.</p>`}
          <p class="cx-meta">${detalles.join(' · ')}</p>
        </div>
      </article>`;
    }).join('');

    this._actualizarCuenta();
  }
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

const CSS = `
#codice {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(6, 9, 8, .82);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  display: none; align-items: center; justify-content: center; padding: 2.4rem 1.2rem;
}
#codice.abierto { display: flex; }
.cx-marco {
  width: min(1080px, 96vw); max-height: 92vh; display: flex; flex-direction: column;
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
.cx-progreso { text-align: right; }
.cx-progreso span { font-size: 2rem; font-weight: 200; color: #6fae7c; line-height: 1; }
.cx-progreso small { display: block; font-size: .62rem; color: #8a9188; letter-spacing: .1em; text-transform: uppercase; }
.cx-marco nav { display: flex; gap: .3rem; padding: .8rem 1.6rem 0; }
.cx-marco nav button {
  background: none; border: none; border-bottom: 2px solid transparent;
  color: #8a9188; font: inherit; font-size: .78rem; letter-spacing: .1em;
  padding: .42rem .8rem; cursor: pointer; text-transform: uppercase;
}
.cx-marco nav button:hover { color: #e8e4dc; }
.cx-marco nav button.activo { color: #6fae7c; border-bottom-color: #6fae7c; }
.cx-lista { overflow-y: auto; padding: 1rem 1.6rem 1.4rem; display: grid; gap: .7rem; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
.cx-lista::-webkit-scrollbar { width: 7px; }
.cx-lista::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 4px; }
.cx-ficha {
  display: flex; gap: .85rem; padding: .85rem;
  background: rgba(255,255,255,.026); border: 1px solid rgba(255,255,255,.055);
  border-radius: 4px; border-left: 2px solid var(--c, #3a4a3e);
}
.cx-ficha.oculta { opacity: .34; }
.cx-ficha.identificada { border-left-color: #6fae7c; background: rgba(111,174,124,.05); }
.cx-silueta {
  flex: 0 0 46px; height: 46px; border-radius: 3px;
  background: var(--c, #2a332c); opacity: .78;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.35); font-size: 1.3rem; font-weight: 300;
}
.cx-datos { min-width: 0; }
.cx-datos h3 { font-size: .92rem; font-weight: 500; color: #e8e4dc; letter-spacing: .02em; }
.cx-datos h3 em { font-style: normal; font-size: .78rem; color: #a89a7a; font-weight: 400; }
.cx-cient { font-size: .74rem; font-style: italic; color: #8a9188; margin-bottom: .3rem; }
.cx-tags { display: flex; flex-wrap: wrap; gap: .26rem; margin-bottom: .4rem; }
.cx-tag {
  font-size: .6rem; letter-spacing: .06em; text-transform: uppercase;
  padding: .12rem .42rem; border-radius: 2px;
  color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  background: color-mix(in srgb, var(--c) 12%, transparent);
}
.cx-desc { font-size: .76rem; line-height: 1.62; color: #bdb8ae; margin-bottom: .34rem; }
.cx-parcial { color: #7d857c; font-style: italic; }
.cx-curioso { font-size: .74rem; line-height: 1.55; color: #c8b98a; border-left: 2px solid rgba(200,185,138,.3); padding-left: .55rem; margin-bottom: .34rem; }
.cx-uso { font-size: .72rem; line-height: 1.55; color: #97a396; margin-bottom: .26rem; }
.cx-uso b { color: #b8c2b4; font-weight: 500; }
.cx-meta { font-size: .66rem; color: #6d766f; letter-spacing: .04em; }
.cx-marco footer { padding: .75rem 1.6rem; border-top: 1px solid rgba(255,255,255,.08); font-size: .68rem; color: #7d857c; letter-spacing: .05em; }
.cx-marco footer b { color: #e8e4dc; }
`;
