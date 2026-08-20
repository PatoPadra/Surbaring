/**
 * Audio — todo sintetizado, sin un solo archivo de sonido.
 *
 * El proyecto no tiene banco de muestras y no lo va a tener: grabaciones de
 * campo del Nahuel Huapi con licencia clara son difíciles de conseguir, y una
 * biblioteca genérica de "bosque" traería mirlos europeos y cigarras que acá no
 * existen. Antes que poner fauna equivocada, se sintetiza lo que sí es honesto
 * describir con física: ruido filtrado.
 *
 * Y da la casualidad de que casi todo el ambiente de la Patagonia andina ES
 * ruido filtrado. El viento del oeste, la lluvia sobre el follaje, el agua del
 * lago contra la orilla, el crepitar de una fogata y el trueno son todos ruido
 * blanco pasado por filtros distintos y modulados a distinta velocidad. Lo que
 * cambia entre uno y otro es dónde está el filtro y cómo se mueve:
 *
 *   viento    pasabanda grave que sube de frecuencia y de volumen con la
 *             velocidad, más un silbido agudo que sólo aparece con ráfaga
 *   lluvia    pasaalto ancho, denso y parejo
 *   granizo   igual pero más agudo y con golpes sueltos encima
 *   lago      pasabanda muy grave con una oscilación lenta, la del oleaje
 *   fuego     pasabanda medio con chasquidos aleatorios
 *   trueno    golpe grave con caída larga, retrasado por la distancia
 *
 * Todo cuelga de un único nodo maestro para poder silenciarlo con una tecla, y
 * nada arranca hasta que el jugador hace clic: los navegadores no dejan sonar
 * nada antes de un gesto, y con razón.
 */

const SEG_RUIDO = 2;

export class Audio {
  constructor() {
    this.ctx = null;
    this.listo = false;
    this.silenciado = false;
    this.volumen = 0.7;
    this._pasoAcum = 0;
    this._truenos = [];
    this._chasquidos = 0;
  }

  /**
   * Arranca el contexto. Hay que llamarlo desde un gesto del usuario o el
   * navegador lo deja suspendido, que es la causa número uno de "no se escucha
   * nada" en un juego web.
   */
  iniciar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.maestro = ctx.createGain();
    this.maestro.gain.value = this.silenciado ? 0 : this.volumen;
    this.maestro.connect(ctx.destination);

    // Un compresor al final: sin él, trueno y viento fuerte a la vez saturan
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.bus = comp;
    comp.connect(this.maestro);

    this.ruido = this._bufferRuido();

    this.viento = this._capaViento();
    this.lluvia = this._capaFiltrada({ tipo: 'highpass', frecuencia: 900, q: 0.6, ganancia: 0 });
    this.granizo = this._capaFiltrada({ tipo: 'bandpass', frecuencia: 3200, q: 1.2, ganancia: 0 });
    this.lago = this._capaOleaje();
    this.fuego = this._capaFiltrada({ tipo: 'bandpass', frecuencia: 620, q: 0.8, ganancia: 0 });

    this.listo = true;
  }

  /** Ruido blanco en bucle: la materia prima de todo lo demás. */
  _bufferRuido() {
    const n = this.ctx.sampleRate * SEG_RUIDO;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _fuenteRuido() {
    const f = this.ctx.createBufferSource();
    f.buffer = this.ruido;
    f.loop = true;
    f.start();
    return f;
  }

  /** Capa genérica: ruido → filtro → ganancia. */
  _capaFiltrada({ tipo, frecuencia, q, ganancia }) {
    const fuente = this._fuenteRuido();
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = frecuencia;
    filtro.Q.value = q;
    const gan = this.ctx.createGain();
    gan.gain.value = ganancia;
    fuente.connect(filtro).connect(gan).connect(this.bus);
    return { fuente, filtro, gan };
  }

  /**
   * Viento: dos voces. La grave es el aire moviéndose y está siempre; la aguda
   * es el silbido entre las ramas y sólo aparece cuando sopla fuerte, que es
   * como se escucha de verdad en la cordillera.
   */
  _capaViento() {
    const grave = this._capaFiltrada({ tipo: 'lowpass', frecuencia: 420, q: 0.7, ganancia: 0 });
    const agudo = this._capaFiltrada({ tipo: 'bandpass', frecuencia: 1400, q: 2.4, ganancia: 0 });

    // Ráfagas: un LFO lento sobre la ganancia del grave para que el viento
    // respire en vez de zumbar parejo
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const prof = this.ctx.createGain();
    prof.gain.value = 0.35;
    lfo.connect(prof).connect(grave.gan.gain);
    lfo.start();

    return { grave, agudo, lfo, prof };
  }

  /** Lago: pasabanda muy grave con una oscilación del orden del oleaje. */
  _capaOleaje() {
    const capa = this._capaFiltrada({ tipo: 'lowpass', frecuencia: 260, q: 0.9, ganancia: 0 });
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.22;          // una ola cada cuatro segundos y medio
    const prof = this.ctx.createGain();
    prof.gain.value = 0.5;
    lfo.connect(prof).connect(capa.gan.gain);
    lfo.start();
    return { ...capa, lfo, prof };
  }

  // ── Mezcla continua ───────────────────────────────────────────────────────

  _rampa(param, valor, t = 0.35) {
    if (!this.ctx) return;
    param.setTargetAtTime(Math.max(0, valor), this.ctx.currentTime, t);
  }

  /**
   * Ajusta la mezcla al ambiente. Se llama por cuadro, pero todos los cambios
   * van con rampa: un salto de ganancia se escucha como un chasquido.
   *
   * @param {object} est estado del ambiente, ya modificado por los eventos
   * @param {object} ctxJuego {jugador, mundo, distanciaAgua, fuegoCerca}
   */
  actualizar(dt, est, ctxJuego = {}) {
    if (!this.listo) return;

    // ── Viento. Sube con la velocidad y también con la altura: en la cumbre
    // suena aunque abajo esté calmo, que es lo que pasa en la montaña.
    const alturaExtra = Math.min(1, Math.max(0, (ctxJuego.altitud ?? 800) - 1200) / 1400);
    const v = Math.min(1, (est.vientoKmh ?? 12) / 70) * (0.75 + alturaExtra * 0.6);
    this._rampa(this.viento.grave.gan.gain, 0.055 + v * 0.30, 0.8);
    this.viento.grave.filtro.frequency.setTargetAtTime(300 + v * 900, this.ctx.currentTime, 1.2);
    // El silbido recién aparece pasados los 35 km/h
    const silbido = Math.max(0, v - 0.5) * 2;
    this._rampa(this.viento.agudo.gan.gain, silbido * 0.055, 1.0);

    // ── Precipitación
    const lluvia = Math.min(1, est.lluvia ?? 0);
    const nieve = Math.min(1, est.nieve ?? 0);
    // La nieve casi no suena: cae sin energía y además absorbe el resto. Bajarle
    // el viento cuando nieva fuerte es parte de por qué una nevada "silencia".
    this._rampa(this.lluvia.gan.gain, lluvia * 0.16 + nieve * 0.012, 0.6);
    this.lluvia.filtro.frequency.setTargetAtTime(700 + lluvia * 1400, this.ctx.currentTime, 0.8);
    this._rampa(this.granizo.gan.gain, Math.min(1, est.granizo ?? 0) * 0.13, 0.3);

    // ── Orilla del lago: se escucha desde bastante lejos si hay viento
    const d = ctxJuego.distanciaAgua ?? 9999;
    const cerca = Math.max(0, 1 - d / 70);
    this._rampa(this.lago.gan.gain, cerca * (0.05 + v * 0.10), 0.7);

    // ── Fuego: hogueras propias e incendio, con su chisporroteo
    const fuego = Math.min(1, ctxJuego.fuegoCerca ?? 0);
    this._rampa(this.fuego.gan.gain, fuego * 0.16, 0.5);
    if (fuego > 0.05) {
      this._chasquidos += dt * fuego * 14;
      while (this._chasquidos > 1) {
        this._chasquidos -= 1;
        if (Math.random() < 0.5) this.chasquido(fuego);
      }
    }

    // ── Truenos pendientes: el sonido llega después que la luz
    const ahora = performance.now();
    while (this._truenos.length && this._truenos[0].cuando <= ahora) {
      const t = this._truenos.shift();
      this._trueno(t.fuerza, t.lejania);
    }
  }

  // ── Sonidos puntuales ─────────────────────────────────────────────────────

  /**
   * Un rayo: se guarda para sonar más tarde. La luz llega instantánea y el
   * sonido a 343 m/s, y esa demora es la que se usa para contar la distancia de
   * la tormenta. Acá se respeta.
   */
  rayo(fuerza = 1, distanciaM = null) {
    if (!this.listo) return;
    const d = distanciaM ?? (400 + Math.random() * 6000);
    this._truenos.push({
      cuando: performance.now() + (d / 343) * 1000,
      fuerza, lejania: Math.min(1, d / 6000),
    });
  }

  /** El trueno propiamente dicho: golpe grave con cola larga. */
  _trueno(fuerza, lejania) {
    const ctx = this.ctx;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    // Lo lejano llega apagado: el aire se come los agudos antes que los graves
    filtro.frequency.value = 900 - lejania * 780;
    filtro.Q.value = 0.6;

    const gan = ctx.createGain();
    const t0 = ctx.currentTime;
    const pico = (0.5 - lejania * 0.36) * fuerza;
    const largo = 1.4 + lejania * 3.2;
    gan.gain.setValueAtTime(0, t0);
    gan.gain.linearRampToValueAtTime(pico, t0 + 0.04 + lejania * 0.5);
    gan.gain.exponentialRampToValueAtTime(0.0008, t0 + largo);

    fuente.connect(filtro).connect(gan).connect(this.bus);
    fuente.start(t0);
    fuente.stop(t0 + largo + 0.1);
  }

  /** Chasquido de fogata: un golpecito corto y agudo. */
  chasquido(fuerza = 1) {
    const ctx = this.ctx;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 900 + Math.random() * 2600;
    filtro.Q.value = 3 + Math.random() * 5;
    const gan = ctx.createGain();
    const t0 = ctx.currentTime;
    gan.gain.setValueAtTime(0.05 * fuerza * (0.4 + Math.random()), t0);
    gan.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.06 + Math.random() * 0.09);
    fuente.connect(filtro).connect(gan).connect(this.bus);
    fuente.start(t0);
    fuente.stop(t0 + 0.2);
  }

  /**
   * Pasos. No se reproducen por temporizador sino por distancia recorrida, así
   * que la cadencia sale sola: caminando es lenta, corriendo es rápida, y
   * agachado y en el agua cambian de timbre.
   */
  pasos(dt, jugador) {
    if (!this.listo) return;
    const vel = Math.hypot(jugador.velocidad.x, jugador.velocidad.z);
    if (!jugador.enSuelo || vel < 0.6) { this._pasoAcum = 0.55; return; }
    this._pasoAcum += vel * dt;
    // Un paso cada 0,85 m de zancada, algo más largo si corre
    const zancada = jugador.corriendo ? 1.25 : 0.85;
    if (this._pasoAcum < zancada) return;
    this._pasoAcum = 0;
    this._paso(jugador.enAgua ? 'agua' : (jugador.agachado ? 'suave' : 'tierra'), vel);
  }

  _paso(tipo, vel) {
    const ctx = this.ctx;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;
    const filtro = ctx.createBiquadFilter();
    if (tipo === 'agua') { filtro.type = 'bandpass'; filtro.frequency.value = 700 + Math.random() * 400; filtro.Q.value = 1.1; }
    else if (tipo === 'suave') { filtro.type = 'lowpass'; filtro.frequency.value = 420; filtro.Q.value = 0.8; }
    else { filtro.type = 'bandpass'; filtro.frequency.value = 260 + Math.random() * 220; filtro.Q.value = 0.9; }

    const gan = ctx.createGain();
    const t0 = ctx.currentTime;
    const fuerte = tipo === 'agua' ? 0.09 : 0.055;
    gan.gain.setValueAtTime(fuerte * Math.min(1, vel / 4) * (0.7 + Math.random() * 0.5), t0);
    gan.gain.exponentialRampToValueAtTime(0.0004, t0 + (tipo === 'agua' ? 0.22 : 0.13));
    fuente.connect(filtro).connect(gan).connect(this.bus);
    fuente.start(t0);
    fuente.stop(t0 + 0.3);
  }

  /** Aviso corto para la interfaz: dos tonos suaves, nada de campanitas. */
  aviso(grave = false) {
    if (!this.listo) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = grave ? 196 : 392;
    const gan = ctx.createGain();
    const t0 = ctx.currentTime;
    gan.gain.setValueAtTime(0, t0);
    gan.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
    gan.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.42);
    osc.connect(gan).connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + 0.5);
  }

  alternarSilencio() {
    this.silenciado = !this.silenciado;
    if (this.maestro) {
      this.maestro.gain.setTargetAtTime(
        this.silenciado ? 0 : this.volumen, this.ctx.currentTime, 0.05);
    }
    return this.silenciado;
  }
}
