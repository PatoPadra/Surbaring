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

// Cuántas frases pueden sonar a la vez. Cuatro ya es un bosque lleno; con más
// se empasta y, sobre todo, se paga: cada frase son entre diez y treinta nodos
// de WebAudio y esto tiene que andar en una máquina de 2012.
const MAX_VOCES = 4;

/**
 * Arma una serie de notas iguales espaciadas, que es la forma de casi todos los
 * trinos y parloteos. `mult` y `vol` aceptan función de índice para acelerar,
 * subir o apagarse sobre la marcha.
 */
function serie(cant, dt, mult, dur, vol, t0 = 0) {
  const a = [];
  for (let i = 0; i < cant; i++) {
    a.push([
      t0 + i * dt,
      typeof mult === 'function' ? mult(i) : mult,
      dur,
      typeof vol === 'function' ? vol(i) : vol,
    ]);
  }
  return a;
}

/**
 * Voces de la fauna, una por especie, derivadas del campo `vocalizacion` de
 * `fauna.json` —que está escrito contra fuentes reales— y no de la imaginación.
 * Si la ficha dice «doble golpe seco sobre el tronco», acá hay dos golpes secos;
 * si dice «prácticamente mudo», acá hay un siseo y nada más.
 *
 * El que no tiene entrada no canta. Preferimos un bosque con menos voces que uno
 * con la voz equivocada: es la misma razón por la que este archivo no usa una
 * biblioteca genérica de sonidos de bosque.
 *
 *   t   timbre: 's' silbo limpio · 'a' áspero · 'n' nasal · 'g' golpe percusivo
 *   f   frecuencia base en Hz
 *   n   notas [desfase, ×frecuencia, duración, volumen]
 *   b   barrido: a cuánto termina la nota respecto de donde empezó
 *   vb  vibrato en Hz · pv su profundidad como fracción de la frecuencia
 *   r   repeticiones de la frase [mín, máx] · sp separación entre ellas
 *   a   alcance en metros: hasta dónde se escucha antes de perderse
 *   q   Q del pasabanda de timbre, sólo para las voces ásperas
 */
const VOCES = {
  // ── Aves del bosque andino-patagónico ────────────────────────────────────
  // «Un explosivo chu-CAO, chu-CAO de sílabas rodadas, seguido de un trino
  // descendente.» El sonido firma de la selva valdiviana, y sale del suelo:
  // el chucao canta desde el sotobosque, casi nunca desde arriba.
  chucao: {
    t: 's', f: 1150, vb: 20, pv: 0.045, r: [1, 2], sp: 1.4, a: 130,
    n: [
      [0, 0.80, 0.055, 0.75], [0.065, 1.30, 0.15, 1.0],
      [0.30, 0.80, 0.055, 0.75], [0.365, 1.30, 0.15, 1.0],
      ...serie(5, 0.065, i => 1.22 - i * 0.09, 0.05, i => 0.6 - i * 0.05, 0.58),
    ],
  },
  // «Un potente y grave huet-huet repetido, que resuena entre los troncos.»
  huet_huet: {
    t: 's', f: 430, b: 0.94, vb: 8, pv: 0.03, r: [2, 4], sp: 1.0, a: 170,
    n: [[0, 1, 0.20, 1.0], [0.30, 0.97, 0.22, 0.92]],
  },
  // «Un trino metálico y monótono, como una carraca lejana repetida sin pausa.»
  churrin: {
    t: 'a', f: 3300, q: 7, r: [1, 3], sp: 1.9, a: 70,
    n: serie(16, 0.055, 1, 0.035, 0.62),
  },
  // «Un doble golpe seco y potente sobre el tronco, más un llamado nasal pi-caa.»
  // El tamborileo del carpintero gigante se oye lejísimos: es percusión sobre
  // un tronco hueco, no una voz.
  carpintero_gigante: {
    t: 'g', f: 380, q: 2.2, r: [1, 3], sp: 2.6, a: 260,
    n: [[0, 1, 0.09, 1.0], [0.075, 0.88, 0.11, 0.85]],
  },
  // «Un pi-tío, pi-tío estridente y repetido que le da su nombre.»
  carpintero_pitio: {
    t: 'n', f: 2050, q: 4, r: [3, 7], sp: 0.34, a: 150,
    n: [[0, 1, 0.06, 0.85], [0.085, 1.28, 0.10, 1.0]],
  },
  // «Griterío chillón y metálico en bandada, un chirrí-chirrí constante en vuelo.»
  cachana: {
    t: 'a', f: 2400, q: 3.2, r: [2, 4], sp: 0.5, a: 240,
    n: serie(7, 0.125, i => (i % 2 ? 1.2 : 1), 0.085, 0.9),
  },
  // «Un parloteo agudo, seco y acelerado, como una risita metálica en grupo.»
  rayadito: {
    t: 'a', f: 4200, q: 5, r: [1, 3], sp: 1.2, a: 55,
    n: serie(9, 0.048, i => 1 + i * 0.022, 0.028, i => 0.8 - i * 0.05),
  },
  // «Una serie de notas metálicas y chirriantes, secas y repetidas, desde el
  // interior de la quila.»
  colilarga: {
    t: 'a', f: 3000, q: 6, r: [1, 2], sp: 1.7, a: 60,
    n: serie(6, 0.14, 1, 0.06, 0.7),
  },
  // «Canto flauteado y melodioso al amanecer, y un chuc-chuc seco de alarma al
  // atardecer.» Las dos variantes están abajo; la hora elige cuál suena.
  zorzal_patagonico: {
    t: 's', f: 1900, vb: 12, pv: 0.03, r: [1, 3], sp: 1.8, a: 130,
    n: [
      [0, 1, 0.16, 0.8], [0.22, 1.26, 0.20, 1.0], [0.50, 1.12, 0.13, 0.85],
      [0.68, 0.84, 0.22, 0.9],
    ],
  },
  zorzal_patagonico_alarma: {
    t: 'a', f: 2600, q: 5, r: [2, 5], sp: 0.28, a: 90,
    n: [[0, 1, 0.04, 0.9], [0.075, 0.95, 0.045, 0.8]],
  },
  // «Gorjeo dulce y ondulante, con notas finas encadenadas sin pausa.»
  cometocino_patagonico: {
    t: 's', f: 3100, vb: 16, pv: 0.05, r: [1, 2], sp: 1.6, a: 70,
    n: serie(10, 0.075, i => 1 + Math.sin(i * 1.3) * 0.16, 0.06, 0.55),
  },
  // «Arrullo grave y profundo de tres notas, uuh-uuh-uuh, que resuena en el bosque.»
  paloma_araucana: {
    t: 's', f: 330, b: 0.93, r: [1, 2], sp: 2.4, a: 190,
    n: [[0, 1, 0.30, 0.7], [0.44, 1.04, 0.30, 0.9], [0.88, 1.0, 0.34, 0.7]],
  },
  // «Chirridos agudos, secos y entrecortados, además del zumbido de sus alas.»
  picaflor_rubi: {
    t: 'a', f: 5200, q: 8, r: [1, 3], sp: 0.7, a: 28,
    n: serie(4, 0.06, 1, 0.025, 0.5),
  },

  // ── Rapaces y aves abiertas ──────────────────────────────────────────────
  // «Silbido descendente y quejumbroso, repetido en vuelo sobre el territorio.»
  aguila_mora: {
    t: 's', f: 1500, b: 0.62, vb: 7, pv: 0.04, r: [2, 4], sp: 1.3, a: 400,
    n: [[0, 1, 0.42, 1.0]],
  },
  // «Maullido áspero y descendente, más agudo que el del águila mora.»
  aguilucho_comun: {
    t: 'a', f: 1900, q: 3, b: 0.55, r: [2, 3], sp: 1.1, a: 320,
    n: [[0, 1, 0.38, 0.9]],
  },
  // «Un cacareo áspero y ronco emitido echando la cabeza hacia atrás.»
  carancho: {
    t: 'a', f: 700, q: 4, r: [1, 2], sp: 2.2, a: 300,
    n: serie(8, 0.075, i => 1 + i * 0.03, 0.055, 0.8),
  },
  // «Chillido nasal y prolongado, un chiii-mangooo quejumbroso que repite en grupo.»
  chimango: {
    t: 'n', f: 1450, q: 3.5, b: 0.72, r: [2, 5], sp: 0.55, a: 260,
    n: [[0, 1, 0.30, 0.9]],
  },
  // «Un carcajeo fuerte y ronco, kiau-kiau-kiau, típico de las costaneras.»
  gaviota_cocinera: {
    t: 'a', f: 1050, q: 3, b: 0.8, r: [1, 3], sp: 1.4, a: 340,
    n: serie(5, 0.19, i => 1 - i * 0.04, 0.14, i => 1 - i * 0.09),
  },
  // «Prácticamente mudo: carece de siringe y sólo emite siseos, bufidos y
  // gruñidos guturales.» El cóndor no canta, y el juego no lo va a hacer cantar.
  condor_andino: {
    t: 'g', f: 2600, q: 0.9, r: [1, 2], sp: 1.0, a: 90,
    n: [[0, 1, 0.34, 0.45]],
  },

  // ── Aves de agua ─────────────────────────────────────────────────────────
  // «Un metálico y sonoro clang-clang que suena como una matraca o un balde.»
  bandurria_austral: {
    t: 'a', f: 880, q: 8, r: [2, 4], sp: 0.6, a: 500,
    n: [[0, 1, 0.13, 1.0], [0.2, 1.06, 0.13, 0.95]],
  },
  // «El macho emite un silbido agudo y fino; la hembra, un cacareo grave y áspero.»
  cauquen_comun: {
    t: 's', f: 2200, vb: 10, pv: 0.03, r: [2, 5], sp: 0.42, a: 320,
    n: [[0, 1, 0.16, 0.85]],
  },
  cauquen_comun_hembra: {
    t: 'a', f: 520, q: 4, r: [2, 5], sp: 0.4, a: 300,
    n: [[0, 1, 0.13, 0.9]],
  },
  // «Un silbido agudo y penetrante que atraviesa el ruido del agua.» Literal:
  // por eso tiene tanto alcance para un pato de 400 g.
  pato_de_los_torrentes: {
    t: 's', f: 3400, r: [2, 4], sp: 0.5, a: 190,
    n: [[0, 1, 0.15, 0.8]],
  },
  // «Trino agudo y tembloroso, y un chirrido nasal repetido en colonia.»
  maca_plateado: {
    t: 's', f: 2500, vb: 26, pv: 0.09, r: [1, 3], sp: 1.2, a: 150,
    n: [[0, 1, 0.5, 0.7]],
  },
  // «Gruñidos guturales roncos, sólo audibles cerca de las colonias.»
  bigua: {
    t: 'a', f: 260, q: 3, r: [2, 4], sp: 0.5, a: 45,
    n: [[0, 1, 0.22, 0.7]],
  },
  // «Una carraca fuerte y seca, como una matraca de madera, emitida al despegar.»
  martin_pescador_grande: {
    t: 'a', f: 1700, q: 6, r: [1, 2], sp: 1.1, a: 200,
    n: serie(11, 0.045, 1, 0.03, 0.8),
  },

  // ── Mamíferos. Casi todos son voces de alarma: en el monte a un mamífero se
  // lo oye cuando ya te vio. ────────────────────────────────────────────────
  // «Bufido corto y nasal de alarma.»
  huemul: {
    t: 'g', f: 620, q: 1.4, r: [1, 2], sp: 0.7, a: 150,
    n: [[0, 1, 0.16, 0.8]],
  },
  // «Ladrido corto y ronco cuando se alarma, casi como un estornudo.»
  pudu: {
    t: 'g', f: 900, q: 2.2, r: [1, 3], sp: 0.5, a: 90,
    n: [[0, 1, 0.09, 0.7]],
  },
  // «Relincho agudo y vibrante de alarma.» El guanaco avisa a toda la tropa.
  guanaco: {
    t: 'a', f: 1250, q: 5, vb: 30, pv: 0.10, r: [2, 5], sp: 0.3, a: 600,
    n: [[0, 1, 0.20, 1.0]],
  },
  // «Aullido corto y quejumbroso, y una serie de ladridos agudos y entrecortados.»
  zorro_colorado: {
    t: 'a', f: 780, q: 3, b: 0.7, r: [1, 3], sp: 1.5, a: 400,
    n: [[0, 1, 0.55, 0.9], [0.75, 1.35, 0.07, 0.7], [0.88, 1.3, 0.07, 0.65]],
  },
  // «Ladrido corto y agudo, más chillón que el del zorro colorado.»
  zorro_gris_chico: {
    t: 'a', f: 1250, q: 4, r: [2, 4], sp: 0.35, a: 280,
    n: [[0, 1, 0.07, 0.75]],
  },
  // «Silbido agudo de alarma que emite el centinela desde una roca alta.»
  chinchillon_anaranjado: {
    t: 's', f: 3600, r: [2, 5], sp: 0.34, a: 260,
    n: [[0, 1, 0.10, 0.75]],
  },
  chinchillon_comun: {
    t: 's', f: 3400, r: [3, 6], sp: 0.3, a: 260,
    n: [[0, 1, 0.09, 0.75]],
  },
  // «Un tuc-tuc-tuc repetido y sordo que sale desde debajo de la tierra.»
  // Va por un pasabajos muy cerrado: literalmente se oye a través del suelo.
  tuco_tuco_colonial: {
    t: 'g', f: 190, q: 1.1, r: [2, 4], sp: 0.9, a: 35,
    n: serie(4, 0.16, 1, 0.07, 0.85),
  },
  tuco_tuco_de_haig: {
    t: 'g', f: 175, q: 1.1, r: [2, 3], sp: 1.0, a: 30,
    n: serie(3, 0.18, 1, 0.08, 0.85),
  },
  // «No ruge: silba, ronronea, y emite un maullido grave y un chillido agudo en
  // celo.» El puma del Nahuel Huapi no ruge. No puede: no tiene el hioides de
  // los Panthera.
  puma: {
    t: 'a', f: 340, q: 2.5, b: 0.85, r: [1, 2], sp: 1.4, a: 260,
    n: [[0, 1, 0.6, 0.8]],
  },
  // «Gruñido grave y ronco; al alarmarse golpea el agua con la cola y bufa.»
  coipo: {
    t: 'a', f: 300, q: 2.5, r: [1, 3], sp: 0.6, a: 60,
    n: [[0, 1, 0.18, 0.6]],
  },
  // «Maullidos cortos y roncos, bufidos y un gruñido bajo; nunca ruge.»
  gato_huina: {
    t: 'a', f: 620, q: 3, b: 0.75, r: [1, 2], sp: 0.9, a: 90,
    n: [[0, 1, 0.3, 0.6]],
  },
  // «Siseo agudo y chillidos» del visón, invasor.
  vison_americano: {
    t: 'a', f: 2400, q: 6, r: [2, 4], sp: 0.3, a: 60,
    n: [[0, 1, 0.09, 0.6]],
  },

  // ── Invasores. Suenan distinto a propósito: el jugador tiene que poder
  // reconocer de oído que hay algo que no debería estar acá. ────────────────
  // «La brama otoñal del macho: un bramido grave, ronco y prolongado que se oye
  // a kilómetros.» Sólo en otoño; el resto del año el ciervo colorado no brama.
  ciervo_colorado: {
    t: 'a', f: 150, q: 2, b: 0.78, r: [1, 3], sp: 2.2, a: 900,
    n: [[0, 1, 1.5, 1.0]],
  },
  // «Gruñidos y resoplidos guturales; un bufido explosivo al enfrentar.»
  jabali_europeo: {
    t: 'g', f: 320, q: 1.3, r: [2, 5], sp: 0.35, a: 120,
    n: [[0, 1, 0.12, 0.8]],
  },
  // «Ladridos, aullidos y gruñidos; las jaurías coordinan con ladridos sostenidos.»
  perro_asilvestrado: {
    t: 'a', f: 560, q: 3, b: 0.8, r: [3, 7], sp: 0.36, a: 500,
    n: [[0, 1, 0.13, 0.9]],
  },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.listo = false;
    this.silenciado = false;
    this.volumen = 0.7;
    this._pasoAcum = 0;
    /** Último múltiplo de PI de `jugador.fasePaso` que ya sonó. Ver `pasos()`. */
    this._pasoPrev = null;
    this._truenos = [];
    this._chasquidos = 0;
    // Contadores de voces de fauna. No son adorno: una fuga de osciladores no
    // se escucha hasta que el cuadro ya se murió, y así se puede medir.
    this.vocesActivas = 0;
    this.vocesEmitidas = 0;
    this.vocesPico = 0;
    this.vocesRechazadas = 0;
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
    if (!jugador.enSuelo || vel < 0.6) { this._pasoAcum = 0.55; this._pasoPrev = null; return; }

    // El apoyo del pie lo manda `Jugador`, no este archivo.
    //
    // Había tres relojes de paso corriendo a la vez sobre el mismo cuerpo: la
    // cámara cabeceaba cada 1,736 m, las piernas de `Cuerpo` apoyaban cada
    // 1,309 m y acá el ruido sonaba cada 0,85 m. Ninguno coincidía con otro, y
    // eso es exactamente la sensación de manejar un muñeco en vez de caminar.
    //
    // `jugador.fasePaso` avanza PI por paso, así que cruzar un múltiplo de PI
    // ES el fotograma en que el pie toca el suelo. Enganchado ahí el sonido no
    // puede derivar, que es lo que sí hacía acumulando distancia por su cuenta.
    if (jugador.fasePaso !== undefined) {
      const paso = Math.floor(jugador.fasePaso / Math.PI);
      if (this._pasoPrev === paso) return;
      this._pasoPrev = paso;
    } else {
      // Respaldo por distancia, para quien use el audio sin un `Jugador`.
      this._pasoAcum += vel * dt;
      const zancada = jugador.corriendo ? 1.25 : 0.85;
      if (this._pasoAcum < zancada) return;
      this._pasoAcum = 0;
    }
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

  // ── Voces de fauna ────────────────────────────────────────────────────────

  /** ¿Esta especie tiene voz sintetizada? Lo usa Fauna para no sortear en vano. */
  tieneVoz(id) {
    return VOCES[id] !== undefined;
  }

  /**
   * Hasta dónde llega la voz de la especie, en metros. Fauna lo necesita para
   * ubicar al que canta: no tiene sentido poner un churrín a 300 m si a esa
   * distancia no se oye, ni un bramido de ciervo pegado a la oreja.
   */
  alcanceVoz(id) {
    return VOCES[id]?.a ?? 0;
  }

  /**
   * Una vocalización. La llama Fauna, que es la que sabe qué animales hay, de
   * qué especie, a qué hora y con qué clima: acá sólo se sintetiza.
   *
   * Toda la frase comparte una sola cadena —timbre, distancia, paneo— y cada
   * nota aporta nada más que un oscilador y su ganancia. Un chucao completo
   * son catorce nodos que viven un segundo y medio; el bosque entero, con el
   * tope de cuatro voces, no llega a sesenta.
   *
   * @param {string} id id de especie de fauna.json
   * @param {object} o  {distancia, azimut (-1 izq .. +1 der), ganancia, variante}
   * @returns {boolean} si sonó de verdad
   */
  voz(id, o = {}) {
    if (!this.listo || this.silenciado) return false;
    const v = VOCES[o.variante ?? id];
    if (!v) return false;

    // El tope no es estético sino de CPU: sin él, un amanecer con cincuenta
    // pájaros con ganas de cantar arma trescientos osciladores a la vez.
    if (this.vocesActivas >= MAX_VOCES) { this.vocesRechazadas++; return false; }

    const alcance = v.a ?? 120;
    const d = Math.max(1, o.distancia ?? 30);
    if (d >= alcance) return false;

    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;

    // Atenuación: no es 1/d porque a 1/d el pájaro de al lado revienta y el de
    // sesenta metros no existe. La curva del alcance reparte mejor.
    const cerca = 1 - d / alcance;
    const nivel = Math.pow(cerca, 1.6) * (o.ganancia ?? 1) * 0.30;
    if (nivel < 0.0015) return false;

    // ── Cadena de la frase, de la salida hacia adentro
    const pan = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;
    const salida = pan ?? ctx.createGain();
    if (pan) pan.pan.value = Math.max(-1, Math.min(1, o.azimut ?? 0)) * 0.85;
    salida.connect(this.bus);

    // El aire se come los agudos antes que los graves: lo lejano llega opaco.
    // Es el mismo principio que ya usa el trueno, y es lo que hace que un canto
    // a cien metros se lea como lejano y no como flojo.
    const aire = ctx.createBiquadFilter();
    aire.type = 'lowpass';
    aire.frequency.value = 900 + Math.pow(cerca, 0.8) * 15000;
    aire.Q.value = 0.4;
    aire.connect(salida);

    let entrada = aire;
    // Los timbres ásperos y nasales son un diente de sierra o una cuadrada
    // pasados por un pasabanda: ahí está la diferencia entre el chillido
    // metálico de la cachaña y el silbo limpio del chucao.
    if (v.t === 'a' || v.t === 'n') {
      const timbre = ctx.createBiquadFilter();
      timbre.type = 'bandpass';
      timbre.frequency.value = v.f * 1.15;
      timbre.Q.value = v.q ?? 4;
      timbre.connect(aire);
      entrada = timbre;
    }

    const frase = ctx.createGain();
    frase.gain.value = nivel;
    frase.connect(entrada);

    // Un solo vibrato para toda la frase. Es lo que separa un canto de un
    // pitido de electrodoméstico, y cuesta dos nodos en vez de dos por nota.
    let lfo = null;
    if (v.vb) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = v.vb * (0.85 + Math.random() * 0.3);
      const prof = ctx.createGain();
      prof.gain.value = v.f * (v.pv ?? 0.04);
      lfo.connect(prof);
      lfo._prof = prof;
      lfo.start(t0);
    }

    // Cada individuo tiene su tono: dos chucaos no cantan igual, y sin esta
    // variación el bosque suena a un solo pájaro teletransportándose.
    const tono = 0.92 + Math.random() * 0.16;
    const reps = v.r
      ? v.r[0] + Math.floor(Math.random() * (v.r[1] - v.r[0] + 1))
      : 1;
    const largoFrase = v.n.reduce((m, x) => Math.max(m, x[0] + x[2]), 0);
    const sep = (v.sp ?? 0.8) + largoFrase;

    // El golpe percusivo no lleva oscilador sino ruido por un pasabanda: el
    // tamborileo del carpintero sobre el tronco hueco o el bufido del huemul no
    // tienen altura tonal, tienen banda. Los demás timbres sí son oscilador.
    const esGolpe = v.t === 'g';
    let golpeFiltro = null;
    if (esGolpe) {
      golpeFiltro = ctx.createBiquadFilter();
      golpeFiltro.type = 'bandpass';
      golpeFiltro.frequency.value = v.f * tono;
      golpeFiltro.Q.value = v.q ?? 2;
      golpeFiltro.connect(frase);
    }

    let fin = t0;
    const fuentes = [];
    for (let r = 0; r < reps; r++) {
      // La separación entre repeticiones también se sortea: un pájaro que
      // repite con metrónomo suena a alarma de auto.
      const base = t0 + r * sep * (0.86 + Math.random() * 0.28);
      for (const [dt, mult, dur, vol] of v.n) {
        const t = base + dt;
        const g = ctx.createGain();
        let fuente;

        if (esGolpe) {
          fuente = ctx.createBufferSource();
          fuente.buffer = this.ruido;
          fuente.loop = true;
          // El multiplicador mueve la banda, que es lo que distingue el primer
          // golpe del segundo en el doble golpe del carpintero.
          fuente.playbackRate.value = mult;
          g.gain.setValueAtTime(Math.max(0.002, vol), t);
        } else {
          fuente = ctx.createOscillator();
          fuente.type = v.t === 's' ? 'sine' : (v.t === 'a' ? 'sawtooth' : 'square');
          const f = v.f * mult * tono;
          fuente.frequency.setValueAtTime(f, t);
          if (v.b) {
            fuente.frequency.exponentialRampToValueAtTime(
              Math.max(20, f * v.b), t + dur);
          }
          if (lfo) lfo._prof.connect(fuente.frequency);
          // Ataque corto pero no nulo: un salto de ganancia es un chasquido.
          const ataque = Math.min(0.012, dur * 0.25);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(Math.max(0.002, vol), t + ataque);
        }

        g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
        fuente.connect(g).connect(esGolpe ? golpeFiltro : frase);
        fuente.start(t);
        fuente.stop(t + dur + 0.03);
        fuentes.push(fuente);
        fin = Math.max(fin, t + dur);
      }
    }

    if (!fuentes.length) {
      // No debería pasar —toda entrada de VOCES trae notas—, pero si pasara,
      // el vibrato ya arrancó y la cadena ya está colgada del bus: sin esto
      // quedaría un oscilador sonando para siempre y nadie lo apagaría, porque
      // el testigo que hace la limpieza se crea recién más abajo.
      if (lfo) { try { lfo.stop(); lfo._prof.disconnect(); lfo.disconnect(); } catch { /* ya cerrado */ } }
      if (golpeFiltro) golpeFiltro.disconnect();
      frase.disconnect();
      if (entrada !== aire) entrada.disconnect();
      aire.disconnect();
      salida.disconnect();
      return false;
    }

    this.vocesActivas++;
    this.vocesEmitidas++;
    if (this.vocesActivas > this.vocesPico) this.vocesPico = this.vocesActivas;

    // Un testigo mudo que arranca con la frase y termina con la última nota.
    // Colgar el `onended` de la última fuente creada sería frágil —no siempre es
    // la que termina más tarde—, y quedarse corto deja el paneo y los filtros
    // colgando del bus para siempre. Cuesta un nodo y no suena: no se conecta.
    const testigo = ctx.createBufferSource();
    testigo.buffer = this.ruido;
    // `loop` NO es decoración. Sin él, un `BufferSource` termina cuando se le
    // acaba el búfer y **ignora su propio `stop()`**: `this.ruido` dura
    // SEG_RUIDO = 2 s, así que el testigo moría a los dos segundos de toda
    // frase, por larga que fuera. Medido sobre la tabla: **27 de las 42 voces
    // se cortaban siempre** y 35 al menos a veces. La brama del ciervo dura
    // diez segundos y sonaba dos; el chucao, que es el sonido firma del
    // bosque, entraba en la lista. Y como el `onended` disparaba temprano,
    // `vocesActivas` bajaba antes de tiempo y el tope de MAX_VOCES dejaba
    // pasar más frases de las que decía permitir — justo la protección de CPU
    // que este testigo existe para sostener.
    testigo.loop = true;
    testigo.start(t0);
    testigo.stop(fin + 0.06);
    testigo.onended = () => {
      this.vocesActivas--;
      try {
        for (const f of fuentes) f.disconnect();
        if (lfo) { lfo.stop(); lfo._prof.disconnect(); lfo.disconnect(); }
        if (golpeFiltro) golpeFiltro.disconnect();
        frase.disconnect();
        if (entrada !== aire) entrada.disconnect();
        aire.disconnect();
        salida.disconnect();
      } catch { /* el contexto se cerró antes; no hay nada que soltar */ }
    };
    return true;
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
