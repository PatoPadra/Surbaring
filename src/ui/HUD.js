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
    this._construirCruz();
    this._acumulador = 0;
    this._avisoHasta = 0;
    this._cruzHasta = 0;
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
      vital: document.getElementById(`v-${id}`).closest('.vital'),
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
        text-shadow: 0 1px 2px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.8);
        opacity: 0; transition: opacity .2s ease; text-align: center; }
      #accion.visible { opacity: 1; }
      #accion b { color: var(--acento); }
      /* Andar solo. Sale de la clase que pone Entrada, sin un elemento ni una
         línea en el bucle: el estado ya está en el cuerpo del documento. Va
         debajo del cartel de acción, que es donde se mira mientras se camina, y
         dice cómo se para, porque quien lo prendió sin querer no sabe con qué. */
      body.auto-andar #hud::after { content: 'Andando solo  ·  W o S para frenar';
        position: absolute; bottom: 16.5%; left: 50%; transform: translateX(-50%);
        white-space: nowrap; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase;
        color: var(--tinta); padding: .22rem .65rem; border-radius: 2px;
        background: rgba(12,14,13,.62); border-left: 2px solid var(--acento);
        text-shadow: 0 1px 2px rgba(0,0,0,.95); }
      #termico { position: absolute; top: 46%; left: 50%; transform: translateX(-50%);
        font-size: .8rem; letter-spacing: .16em; text-transform: uppercase;
        text-shadow: 0 1px 2px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.85);
        opacity: 0; transition: opacity .6s ease; }
      #termico.visible { opacity: 1; }
      #termico.frio { color: #7fb8d8; }
      #termico.calor { color: #d8a05a; }
      /* Debajo de la brújula, que ocupa los 30 px de arriba: con los dos en
         top 1rem y centrados, las etiquetas tapaban los rumbos. No se veía
         porque la brújula estuvo corrida a la izquierda hasta la ronda 8. */
      #fenomenos { position: absolute; top: 2.6rem; left: 50%; transform: translateX(-50%);
        display: flex; gap: .4rem; pointer-events: none; }
      #fenomenos .fen { font-size: .68rem; letter-spacing: .06em; padding: .22rem .6rem;
        border-radius: 2px; background: rgba(12,14,13,.72); border-left: 2px solid;
        text-shadow: 0 1px 6px #000; }
      #fenomenos .p1, #fenomenos .p2 { border-color: #7fa8c0; color: #cfe0ea; }
      #fenomenos .p3 { border-color: #d8c05a; color: #eadfae; }
      #fenomenos .p4 { border-color: #d08a3a; color: #f0cfa2; }
      #fenomenos .p5 { border-color: #c8503f; color: #f2b7ad; }
    `;
    document.head.appendChild(est);

    const term = document.createElement('div');
    term.id = 'termico';
    document.getElementById('hud').appendChild(term);
    this.elTermico = term;

    // Qué está pasando en el ambiente ahora mismo, con el color de su
    // peligrosidad: la del dataset, del 1 al 5.
    const fen = document.createElement('div');
    fen.id = 'fenomenos';
    document.getElementById('hud').appendChild(fen);
    this.elFenomenos = fen;
  }

  /**
   * La Cruz del Sur, y el método para encontrar el sur con ella.
   *
   * El método y no la respuesta. La brújula de arriba ya dice dónde está el sur:
   * un cartel que dijera «el sur está ahí» no enseñaría nada. Lo que sirve el día
   * que no haya brújula —o el día que uno esté lejos de una pantalla— es saber
   * sacarlo del cielo, así que el cartel dice los tres pasos y nombra las
   * estrellas, que es lo que hay que buscar en el cielo de verdad.
   *
   * Aparece solo, mirando la Cruz: la puerta es `cielo.queMiro()`.
   */
  _construirCruz() {
    const el = document.createElement('div');
    el.className = 'panel';
    el.id = 'cruz-sur';
    el.innerHTML = `<h4>Cruz del Sur · el sur sin brújula</h4>
      <p><i>1</i> Prolongá el palo largo, de Gacrux —la anaranjada— hacia Acrux,
         <b>cuatro veces y media</b> su largo.</p>
      <p><i>2</i> Cruzalo con la <b>mediatriz</b> de los <b>punteros</b>, α y β Centauri:
         la línea que corta por la mitad, en ángulo recto, el tramo entre los dos.</p>
      <p><i>3</i> Ese cruce es el polo sur del cielo. Bajá a plomo hasta el horizonte:
         ahí está el <b>sur</b>.</p>
      <p class="fino">El método erra unos 3° por sí solo: alcanza para caminar.</p>`;
    document.getElementById('hud').appendChild(el);
    this.elCruz = el;

    const est = document.createElement('style');
    est.textContent = `
      #cruz-sur { top: 36%; right: 1rem; width: 17.5rem;
        opacity: 0; transition: opacity .8s ease; }
      #cruz-sur.visible { opacity: 1; }
      #cruz-sur h4 { font-size: .64rem; letter-spacing: .12em; text-transform: uppercase;
        color: var(--acento); margin-bottom: .4rem; }
      #cruz-sur p { font-size: .7rem; line-height: 1.5; margin-top: .34rem; }
      #cruz-sur i { color: var(--tinta-tenue); font-style: normal; margin-right: .3rem;
        font-variant-numeric: tabular-nums; }
      #cruz-sur b { color: var(--tinta); font-weight: 600; }
      #cruz-sur .fino { color: var(--tinta-tenue); font-size: .64rem; font-style: italic; }
    `;
    document.head.appendChild(est);
  }

  /**
   * ¿Está mirando la Cruz? La dirección sale del jugador y no de la cámara: la
   * cámara la orienta `Jugador` con `rotation.set(cabeceo, giro, …)` en orden YXZ,
   * o sea que mira a (−sen giro · cos cabeceo, sen cabeceo, −cos giro · cos
   * cabeceo). Es el mismo giro con el que se dibuja la cinta de la brújula.
   *
   * Con el cielo cubierto no se dice nada: `queMiro` contesta por la Cruz, que está
   * ahí aunque no se vea, y decidir si hablar es de acá. Y una vez que aparece se
   * queda un segundo y medio: justo en el borde de los 12° el temblor del paso lo
   * hacía parpadear.
   */
  _pintarCruz(cielo, direccion = null) {
    if (!this.elCruz || typeof cielo?.queMiro !== 'function') return;
    const mirada = (this._mirada ??= { x: 0, y: 0, z: 0 });
    if (direccion) {
      mirada.x = direccion.x; mirada.y = direccion.y; mirada.z = direccion.z;
    } else {
      const g = this.jugador.giro, c = this.jugador.cabeceo;
      const cosC = Math.cos(c);
      mirada.x = -Math.sin(g) * cosC;
      mirada.y = Math.sin(c);
      mirada.z = -Math.cos(g) * cosC;
    }

    const u = cielo.uniformes;
    const tapado = (u?.uNubes?.value ?? 0) > 0.85 || (u?.uCeniza?.value ?? 0) > 0.5;
    const ahora = performance.now();
    if (!tapado && cielo.queMiro(mirada) === 'cruz_del_sur') this._cruzHasta = ahora + 1500;
    this.elCruz.classList.toggle('visible', ahora < this._cruzHasta);
  }

  /**
   * La tecla de acción, y la propia si la hay, cada una en su lugar.
   *
   * Antes la tecla propia se marcaba con `etiqueta.replace('R', '<b>R</b>')`,
   * o sea la **primera R mayúscula** que apareciera. Daba bien de casualidad,
   * porque «(o R)» era la única. Con el rinde entre paréntesis, «Abrir frente de
   * Roca» habría pintado la letra equivocada. Ahora la etiqueta sale textual y
   * las marcas van afuera: E adelante, porque la E también lo hace, y la propia
   * al final.
   *
   * @param {{tipo:string, etiqueta:string, tecla?:string}|null} accion
   */
  mostrarAccion(accion) {
    if (!accion) { this.elAccion.classList.remove('visible'); return; }
    this.elAccion.innerHTML = `<b>E</b> · ${accion.etiqueta}`
      + (accion.tecla ? ` · o <b>${accion.tecla}</b>` : '');
    this.elAccion.classList.add('visible');
  }

  /** @param {Array<{nombre:string, peligrosidad:number, distancia?:number}>} activos */
  pintarFenomenos(activos) {
    if (!activos.length) { this.elFenomenos.innerHTML = ''; return; }
    this.elFenomenos.innerHTML = activos.map(a => {
      const lejos = a.distancia != null && a.distancia > 400
        ? ` · a ${(a.distancia / 1000).toFixed(1)} km` : '';
      return `<span class="fen p${a.peligrosidad || 1}">${a.nombre}${lejos}</span>`;
    }).join('');
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

  /**
   * Una negativa de la ley. Va por acá y no por `aviso` porque no son lo mismo:
   * "No entra nada más" tiene diecinueve caracteres y la explicación de por qué
   * no se caza un huemul tiene quinientos treinta y seis. Las graves abren el
   * panel de normativa, que espera; las leves siguen siendo un cartel.
   *
   * `this.norma` lo cablea main. Si no está, todo cae en el cartel de siempre:
   * el juego tiene que poder arrancar sin esta pieza.
   */
  negativa(v, ctx) {
    if (this.norma?.mostrar(v, ctx)) return;
    this.aviso(v.titulo, v.detalle, v.gravedad === 'grave' ? 9000 : 4200);
  }

  aviso(titulo, detalle = '', duracion = 4200) {
    this.elAviso.querySelector('.t').textContent = titulo;
    this.elAviso.querySelector('.d').textContent = detalle;
    this.elAviso.classList.add('visible');
    this._avisoHasta = performance.now() + duracion;
  }

  /**
   * @param {number} dt
   * @param {import('../world/Cielo.js').Cielo} [cielo]
   * @param {{x:number, y:number, z:number}} [mirada] adónde apunta la cámara. Sin
   *   esto se deduce del jugador, que es de donde sale la cámara hoy.
   */
  actualizar(dt, cielo, mirada = null) {
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

    // ── Lo que hay en el cielo adonde se mira
    this._pintarCruz(cielo, mirada);

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
      // La animación vive en el CSS (.critico); acá sólo se prende y apaga la
      // clase. Ver la nota en index.html sobre por qué dejó de ser opacidad fija.
      b.vital.classList.toggle('critico', v < 22);
    }

    // ── Aviso térmico: lo que de verdad mata en la Patagonia
    const j = this.jugador;
    if (j.hipotermia) {
      this.elTermico.textContent = j.temperatura < 34.5 ? 'Hipotermia grave' : 'Estás perdiendo calor';
      this.elTermico.className = 'visible frio';
    } else if (j.golpeCalor) {
      this.elTermico.textContent = 'Golpe de calor';
      this.elTermico.className = 'visible calor';
    } else if (j.desfallecido) {
      // El aviso llega antes que la muerte: con el alimento o el agua en cero se
      // deja de correr y la salud empieza a bajar. Que se vea es lo que
      // convierte una barra en cero en una decisión.
      this.elTermico.textContent = j.sed <= 0 ? 'Deshidratado' : 'Sin fuerzas';
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
