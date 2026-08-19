/**
 * HUD — interfaz de a bordo, en español rioplatense.
 * Muestra posición geográfica real, hora simulada, clima y estado vital.
 */

const CARDINALES = [
  [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
  [180, 'S'], [225, 'SO'], [270, 'O'], [315, 'NO'],
];

/** Lugares reales del parque, para orientar al jugador. */
const REFERENCIAS = [
  { nombre: 'Centro Cívico', lat: -41.1335, lon: -71.3103 },
  { nombre: 'Cerro Otto', lat: -41.1447, lon: -71.3856 },
  { nombre: 'Cerro Catedral', lat: -41.2170, lon: -71.4950 },
  { nombre: 'Cerro López', lat: -41.1075, lon: -71.5486 },
  { nombre: 'Cerro Tronador', lat: -41.1567, lon: -71.8853 },
  { nombre: 'Cerro Campanario', lat: -41.0783, lon: -71.4553 },
  { nombre: 'Llao Llao', lat: -41.0553, lon: -71.5342 },
  { nombre: 'Colonia Suiza', lat: -41.1006, lon: -71.5231 },
  { nombre: 'Lago Gutiérrez', lat: -41.2200, lon: -71.4300 },
  { nombre: 'Lago Mascardi', lat: -41.3300, lon: -71.5500 },
  { nombre: 'Lago Moreno', lat: -41.0850, lon: -71.5300 },
  { nombre: 'Puerto Blest', lat: -41.0322, lon: -71.8206 },
  { nombre: 'Isla Victoria', lat: -40.9500, lon: -71.5300 },
  { nombre: 'Península Llao Llao', lat: -41.0500, lon: -71.5600 },
  { nombre: 'Villa Catedral', lat: -41.1706, lon: -71.4406 },
  { nombre: 'Valle del Challhuaco', lat: -41.2200, lon: -71.3100 },
  { nombre: 'Pampa Linda', lat: -41.2200, lon: -71.7900 },
  { nombre: 'Bahía López', lat: -41.0700, lon: -71.5900 },
];

export class HUD {
  constructor(mundo, jugador, tiempo) {
    this.mundo = mundo;
    this.jugador = jugador;
    this.tiempo = tiempo;

    this.elGeo = document.getElementById('geo');
    this.elReloj = document.getElementById('reloj');
    this.elVitales = document.getElementById('vitales');
    this.elCinta = document.querySelector('#brujula .cinta');
    this.elAviso = document.getElementById('aviso');

    this._construirBrujula();
    this._construirVitales();
    this._construirBolso();
    this._acumulador = 0;
    this._avisoHasta = 0;
  }

  _construirBrujula() {
    // Cinta de 720° para que el giro sea continuo al cruzar el norte
    let html = '';
    for (let g = -180; g <= 540; g += 15) {
      const norm = ((g % 360) + 360) % 360;
      const card = CARDINALES.find(([a]) => a === norm);
      const etiqueta = card ? card[1] : (norm % 45 === 0 ? `${norm}°` : '·');
      html += `<span class="marca ${card ? 'card' : ''}" style="left:${(g + 180) * 2.4}px">${etiqueta}</span>`;
    }
    this.elCinta.innerHTML = html;
    this.elCinta.style.width = `${720 * 2.4}px`;
  }

  _construirVitales() {
    const barras = [
      ['salud', 'Salud', '#c8503f'],
      ['energia', 'Resistencia', '#d8c05a'],
      ['hambre', 'Alimento', '#b07c46'],
      ['sed', 'Hidratación', '#4a8fb5'],
    ];
    this.elVitales.innerHTML = barras.map(([id, et, col]) =>
      `<div class="vital"><div class="cab"><span>${et}</span><span id="v-${id}-n">100</span></div>
       <div class="pista"><i id="v-${id}" style="width:100%;background:${col}"></i></div></div>`
    ).join('');
    this._barras = barras.map(([id]) => ({
      id,
      barra: document.getElementById(`v-${id}`),
      texto: document.getElementById(`v-${id}-n`),
    }));
  }

  /** Bolso, acción disponible y avisos térmicos. */
  _construirBolso() {
    const el = document.createElement('div');
    el.className = 'panel';
    el.id = 'bolso';
    document.getElementById('hud').appendChild(el);
    this.elBolso = el;

    const acc = document.createElement('div');
    acc.id = 'accion';
    document.getElementById('hud').appendChild(acc);
    this.elAccion = acc;

    const est = document.createElement('style');
    est.textContent = `
      #bolso { bottom: 1rem; left: 15rem; width: 200px; max-height: 42vh; overflow: hidden; }
      #bolso h4 { font-size: .64rem; letter-spacing: .12em; text-transform: uppercase;
        color: var(--tinta-tenue); margin-bottom: .35rem; display: flex; justify-content: space-between; }
      #bolso .it { display: flex; justify-content: space-between; font-size: .72rem; line-height: 1.55; }
      #bolso .it b { color: var(--tinta); font-weight: 500; font-variant-numeric: tabular-nums; }
      #bolso .vacio { font-size: .7rem; color: #6d766f; font-style: italic; }
      #bolso .alim { color: #b0c47a; }
      #accion { position: absolute; bottom: 21%; left: 50%; transform: translateX(-50%);
        font-size: .78rem; letter-spacing: .05em; color: var(--tinta);
        text-shadow: 0 2px 10px #000; opacity: 0; transition: opacity .2s ease; text-align: center; }
      #accion.visible { opacity: 1; }
      #accion b { color: var(--acento); }
      #termico { position: absolute; top: 46%; left: 50%; transform: translateX(-50%);
        font-size: .8rem; letter-spacing: .16em; text-transform: uppercase;
        text-shadow: 0 2px 12px #000; opacity: 0; transition: opacity .6s ease; }
      #termico.visible { opacity: 1; }
      #termico.frio { color: #7fb8d8; }
      #termico.calor { color: #d8a05a; }
    `;
    document.head.appendChild(est);

    const term = document.createElement('div');
    term.id = 'termico';
    document.getElementById('hud').appendChild(term);
    this.elTermico = term;
  }

  /** @param {{tipo:string, etiqueta:string}|null} accion */
  mostrarAccion(accion) {
    if (!accion) { this.elAccion.classList.remove('visible'); return; }
    this.elAccion.innerHTML = `<b>E</b> · ${accion.etiqueta}`;
    this.elAccion.classList.add('visible');
  }

  pintarBolso(inventario) {
    const items = inventario.listar();
    const cab = `<h4><span>Bolso</span><span>${inventario.pesoKg.toFixed(1)} / ${inventario.capacidadKg} kg</span></h4>`;
    if (!items.length) {
      this.elBolso.innerHTML = cab + `<div class="vacio">Vacío. Pulsá E cerca de una planta.</div>`;
      return;
    }
    this.elBolso.innerHTML = cab + items.slice(0, 12).map(i =>
      `<div class="it ${i.cat === 'alimento' ? 'alim' : ''}"><span>${i.nombre}</span><b>${i.cantidad}</b></div>`
    ).join('') + (items.length > 12 ? `<div class="vacio">y ${items.length - 12} más…</div>` : '');
  }

  /** Referencia real más cercana, con rumbo y distancia. */
  _referenciaCercana(lat, lon) {
    let mejor = null, mejorD = Infinity;
    for (const r of REFERENCIAS) {
      const dx = (r.lon - lon) * this.mundo.mpdLon;
      const dy = (r.lat - lat) * 111320;
      const d = Math.hypot(dx, dy);
      if (d < mejorD) { mejorD = d; mejor = { ...r, distancia: d, dx, dy }; }
    }
    return mejor;
  }

  aviso(titulo, detalle = '', duracion = 4200) {
    this.elAviso.querySelector('.t').textContent = titulo;
    this.elAviso.querySelector('.d').textContent = detalle;
    this.elAviso.classList.add('visible');
    this._avisoHasta = performance.now() + duracion;
  }

  actualizar(dt, cielo) {
    this._acumulador += dt;
    if (this._avisoHasta && performance.now() > this._avisoHasta) {
      this.elAviso.classList.remove('visible');
      this._avisoHasta = 0;
    }

    // La brújula tiene que ir suave todos los cuadros
    const rumbo = ((-this.jugador.giro * 180 / Math.PI) % 360 + 360) % 360;
    const anchoVisible = this.elCinta.parentElement.clientWidth;
    this.elCinta.style.transform = `translateX(${anchoVisible / 2 - (rumbo + 180) * 2.4}px)`;

    if (this._acumulador < 0.12) return;
    this._acumulador = 0;

    const inf = this.jugador.informe();
    const est = this.tiempo.estado();

    // ── Posición
    const ref = this._referenciaCercana(inf.lat, inf.lon);
    const rumboRef = ((Math.atan2(ref.dx, ref.dy) * 180 / Math.PI) % 360 + 360) % 360;
    const nombreCard = CARDINALES.reduce((a, b) =>
      Math.abs(((rumboRef - b[0] + 540) % 360) - 180) > Math.abs(((rumboRef - a[0] + 540) % 360) - 180) ? a : b
    )[1];

    const dist = ref.distancia < 1000
      ? `${ref.distancia.toFixed(0)} m`
      : `${(ref.distancia / 1000).toFixed(1)} km`;

    this.elGeo.innerHTML =
      `<div class="lugar">${ref.nombre} · ${dist} al ${nombreCard}</div>` +
      fila('Latitud', `${inf.lat.toFixed(4)}°`) +
      fila('Longitud', `${inf.lon.toFixed(4)}°`) +
      fila('Altitud', `${inf.altitud.toFixed(0)} m s. n. m.`) +
      fila('Pendiente', `${inf.pendienteGrados.toFixed(0)}°`) +
      fila('Recorrido', `${inf.distanciaKm.toFixed(2)} km`);

    // ── Reloj y clima
    const flechaViento = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'][
      Math.round(((est.direccionViento % 360) + 360) % 360 / 45) % 8
    ];
    const precip = est.nieve > 0.05 ? `Nieve` : est.lluvia > 0.05 ? `Lluvia` : est.nubosidad > 0.72 ? 'Cubierto' : est.nubosidad > 0.38 ? 'Algo nublado' : 'Despejado';

    this.elReloj.innerHTML =
      `<div class="hora">${this.tiempo.textoHora}</div>` +
      `<div class="fecha">${this.tiempo.textoFecha}</div>` +
      `<div class="estacion">${est.nombreEstacion}</div>` +
      `<div style="margin-top:.42rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.35rem">` +
      fila('Temperatura', `${est.temperatura.toFixed(1)} °C`) +
      fila('Cielo', precip) +
      fila('Viento', `${flechaViento} ${est.vientoKmh.toFixed(0)} km/h`) +
      fila('Cota de nieve', `${est.cotaNieve.toFixed(0)} m`) +
      `</div>`;

    // ── Vitales
    for (const b of this._barras) {
      const v = Math.max(0, Math.min(100, this.jugador[b.id]));
      b.barra.style.width = `${v}%`;
      b.texto.textContent = v.toFixed(0);
      b.barra.style.opacity = v < 22 ? '0.55' : '1';
    }

    // ── Aviso térmico: lo que de verdad mata en la Patagonia
    const j = this.jugador;
    if (j.hipotermia) {
      this.elTermico.textContent = j.temperatura < 34.5 ? 'Hipotermia grave' : 'Estás perdiendo calor';
      this.elTermico.className = 'visible frio';
    } else if (j.golpeCalor) {
      this.elTermico.textContent = 'Golpe de calor';
      this.elTermico.className = 'visible calor';
    } else {
      this.elTermico.className = '';
    }

    // La sensación térmica se suma al panel del clima
    if (j.sensacionTermica != null) {
      this.elReloj.insertAdjacentHTML('beforeend',
        `<div class="fila" style="border-top:1px solid rgba(255,255,255,.08);margin-top:.3rem;padding-top:.3rem">
          <span class="et">Sensación</span><span>${j.sensacionTermica.toFixed(0)} °C</span></div>
         <div class="fila"><span class="et">Corporal</span><span>${j.temperatura.toFixed(1)} °C</span></div>`);
    }
  }
}

const fila = (et, val) => `<div class="fila"><span class="et">${et}</span><span>${val}</span></div>`;
