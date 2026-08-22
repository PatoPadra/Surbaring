/**
 * Tiempo — calendario, estaciones y clima de Bariloche.
 *
 * Hemisferio sur: enero es verano y julio es invierno. La climatología base son
 * las normales de la estación Bariloche Aero; el clima diario se genera a partir
 * de ellas con ruido correlacionado, así que hay rachas de buen y de mal tiempo
 * en vez de un sorteo independiente por día.
 */

const CLIMATOLOGIA = [
  // mes, tempMax, tempMin, precipMm, díasLluvia, nubosidad, vientoKmh
  { mes: 1, max: 22.0, min: 6.6, precip: 22, dias: 5, nubes: 0.34, viento: 24 },
  { mes: 2, max: 21.6, min: 6.3, precip: 22, dias: 5, nubes: 0.35, viento: 22 },
  { mes: 3, max: 18.9, min: 4.9, precip: 33, dias: 6, nubes: 0.42, viento: 19 },
  { mes: 4, max: 14.5, min: 2.9, precip: 61, dias: 8, nubes: 0.55, viento: 17 },
  { mes: 5, max: 10.2, min: 1.0, precip: 130, dias: 12, nubes: 0.70, viento: 16 },
  { mes: 6, max: 7.3, min: -1.0, precip: 148, dias: 13, nubes: 0.76, viento: 16 },
  { mes: 7, max: 6.8, min: -1.6, precip: 138, dias: 13, nubes: 0.75, viento: 17 },
  { mes: 8, max: 8.6, min: -1.2, precip: 108, dias: 11, nubes: 0.70, viento: 19 },
  { mes: 9, max: 11.4, min: 0.2, precip: 65, dias: 9, nubes: 0.62, viento: 21 },
  { mes: 10, max: 15.0, min: 2.3, precip: 46, dias: 8, nubes: 0.54, viento: 24 },
  { mes: 11, max: 18.2, min: 4.1, precip: 34, dias: 7, nubes: 0.45, viento: 26 },
  { mes: 12, max: 20.7, min: 5.6, precip: 30, dias: 6, nubes: 0.38, viento: 25 },
];

const ESTACIONES = [
  { id: 'verano', nombre: 'Verano', meses: [12, 1, 2] },
  { id: 'otono', nombre: 'Otoño', meses: [3, 4, 5] },
  { id: 'invierno', nombre: 'Invierno', meses: [6, 7, 8] },
  { id: 'primavera', nombre: 'Primavera', meses: [9, 10, 11] },
];

/**
 * Segundos del mundo por segundo real.
 *
 * Estaban en 60/300/1800/7200 con el 300 por defecto, y el cuerpo corre a 24
 * (`ESCALA_METABOLISMO` en main.js): doce veces y media de diferencia entre los
 * dos relojes del mismo juego. Lo que eso producía, medido:
 *
 * - Un día entero duraba 4,8 minutos reales y la noche 2,4. La constante
 *   térmica del cuerpo es de unos 147 segundos, o sea que la noche era MÁS
 *   CORTA que el tiempo que el cuerpo tarda en enfriarse: el modelo térmico se
 *   comportaba como un promedio diario y el frío nocturno no se podía sentir,
 *   aunque estuviera simulado con cuidado.
 * - Una barra de sed duraba diez días de juego. El jugador veía diez amaneceres
 *   antes de tener sed una vez.
 * - La temporada de caza de exóticas, que va de marzo a mayo, empezaba a la hora
 *   y veinticuatro minutos de juego y se iba a las cinco horas y media. Un juego
 *   que enseña vedas, temporadas de pesca y floraciones necesita que el mes sea
 *   un estado con duración, no un parpadeo.
 *
 * Con 72 el día dura veinte minutos y la noche unos ocho, que son tres veces la
 * constante térmica: el frío de la noche por fin se siente y se resuelve con
 * fuego, que es el bucle que el juego quiere enseñar. La relación entre relojes
 * baja de 12,5 a 3, que es la que hace verdadera la frase "tengo sed cada día y
 * medio". Los dos escalones de arriba siguen ahí para las hornadas de treinta
 * horas, y ahora acelerar es seguro: el daño de los eventos dejó de leerse en
 * este reloj.
 */
const VELOCIDADES = [24, 72, 900, 7200];

export class Tiempo {
  constructor(lat, lon, fechaInicial = null) {
    this.lat = lat;
    this.lon = lon;
    // Arranca un mediodía de febrero: la luz alta muestra bien el relieve.
    this.fecha = fechaInicial ?? new Date(Date.UTC(2025, 1, 12, 13, 20, 0));
    this.indiceVelocidad = 1;
    this.segundosTotales = 0;

    // Semillas del clima: dos ruidos lentos que se mueven a distinta velocidad
    this._semillaA = Math.random() * 1000;
    this._semillaB = Math.random() * 1000;
    this.ceniza = 0;
    this._cenizaObjetivo = 0;
  }

  get velocidad() { return VELOCIDADES[this.indiceVelocidad]; }

  alternarVelocidad() {
    this.indiceVelocidad = (this.indiceVelocidad + 1) % VELOCIDADES.length;
    return this.velocidad;
  }

  avanzar(dt) {
    this.segundosTotales += dt;
    this.fecha = new Date(this.fecha.getTime() + dt * this.velocidad * 1000);
  }

  /** Interpolación suave entre los meses vecinos de la climatología. */
  _clima() {
    const m = this.fecha.getUTCMonth();          // 0..11
    const diaDelMes = this.fecha.getUTCDate();
    const diasMes = new Date(Date.UTC(this.fecha.getUTCFullYear(), m + 1, 0)).getUTCDate();
    const t = (diaDelMes - 1) / diasMes;         // 0..1 dentro del mes
    // Centrado a mitad de mes para que la curva anual quede suave
    const desfase = t - 0.5;
    const i0 = desfase < 0 ? (m + 11) % 12 : m;
    const i1 = desfase < 0 ? m : (m + 1) % 12;
    const k = desfase < 0 ? desfase + 1 : desfase;
    const a = CLIMATOLOGIA[i0], b = CLIMATOLOGIA[i1];
    const mez = (x, y) => x * (1 - k) + y * k;
    return {
      max: mez(a.max, b.max),
      min: mez(a.min, b.min),
      precip: mez(a.precip, b.precip),
      dias: mez(a.dias, b.dias),
      nubes: mez(a.nubes, b.nubes),
      viento: mez(a.viento, b.viento),
    };
  }

  /** Ruido suave y continuo, para que el tiempo cambie por rachas. */
  _ruidoLento(fase, escalaDias) {
    const d = this.fecha.getTime() / 86400000 / escalaDias + fase;
    return 0.5 + 0.5 * (
      Math.sin(d * 2.399) * 0.5 +
      Math.sin(d * 1.117 + 1.7) * 0.32 +
      Math.sin(d * 0.523 + 4.1) * 0.18
    );
  }

  estacionDe(mes1a12) {
    return ESTACIONES.find(e => e.meses.includes(mes1a12)) ?? ESTACIONES[0];
  }

  /** Estado completo del ambiente para este instante. */
  estado() {
    const c = this._clima();
    const mes = this.fecha.getUTCMonth() + 1;
    const estacion = this.estacionDe(mes);

    // Posición continua en el año: 0 verano, 1 otoño, 2 invierno, 3 primavera.
    // Se usa para teñir la vegetación sin saltos entre estaciones.
    const diaDelAnio = (this.fecha - Date.UTC(this.fecha.getUTCFullYear(), 0, 0)) / 86400000;
    const fraccionAnio = (diaDelAnio / 365.25) % 1;
    const estacionContinua = ((fraccionAnio * 4) + 3.35) % 4;

    // Temperatura del momento: la mínima antes del amanecer, la máxima a media
    // tarde. Va en hora local, no UTC: el ciclo sigue al sol de Bariloche.
    const horaDecimal = this.horaDecimalLocal;
    const cicloDiario = -Math.cos((horaDecimal - 4.5) / 24 * Math.PI * 2);
    const anomalia = (this._ruidoLento(this._semillaA, 4.5) - 0.5) * 7.5;
    const temperatura = (c.max + c.min) / 2 + (c.max - c.min) / 2 * cicloDiario + anomalia;

    // Probabilidad de precipitación derivada de los días de lluvia del mes
    const humedadFrente = this._ruidoLento(this._semillaB, 3.2);
    const umbral = 1 - (c.dias / 30);
    const lluvia = Math.max(0, (humedadFrente - umbral) / Math.max(0.05, 1 - umbral));
    const nieva = temperatura < 1.5 && lluvia > 0.05;

    const nubosidad = Math.min(0.98, c.nubes * 0.55 + humedadFrente * 0.62);

    // Cota de nieve: baja en invierno, sube en verano. Sigue la isoterma de 0 °C
    // con un gradiente térmico de 6,5 °C/km.
    const cotaCero = 893 + (temperatura - 0) / 6.5 * 1000;
    const cotaNieve = Math.max(850, Math.min(2600, cotaCero - 250));

    // Viento: el oeste manda todo el año, con ráfagas fuertes en primavera
    const rafaga = this._ruidoLento(this._semillaA + 40, 0.7);
    const vientoKmh = c.viento * (0.55 + rafaga * 1.15);

    // Ceniza volcánica: evento raro, se disipa lento
    this.ceniza += (this._cenizaObjetivo - this.ceniza) * 0.0008;
    if (this.ceniza < 0.002) this.ceniza = 0;

    // Niebla de valle: madrugadas húmedas y frías de otoño e invierno
    const horaFria = horaDecimal < 9 || horaDecimal > 21;
    const nieblaValle = horaFria && temperatura < 8 && humedadFrente > 0.5 ? 0.00022 : 0;
    const densidadNiebla = 0.000030
      + lluvia * 0.00016
      + nubosidad * 0.000035
      + nieblaValle
      + this.ceniza * 0.00035;

    return {
      estacion: estacion.id,
      nombreEstacion: estacion.nombre,
      estacionContinua,
      mes,
      horaDecimal,
      temperatura,
      tempMax: c.max,
      tempMin: c.min,
      lluvia: nieva ? 0 : lluvia,
      nieve: nieva ? lluvia : 0,
      nubosidad,
      turbiedad: 1.8 + nubosidad * 1.6 + this.ceniza * 6,
      vientoKmh,
      direccionViento: 265 + (this._ruidoLento(this._semillaB + 9, 2.1) - 0.5) * 70,
      cotaNieve,
      ceniza: this.ceniza,
      humedadSuelo: Math.min(1, lluvia * 1.6),
      densidadNiebla,
      exposicion: 1.05 - nubosidad * 0.18 - this.ceniza * 0.2,
      esDeNoche: false,
    };
  }

  /** Dispara una caída de ceniza, como la del Puyehue-Cordón Caulle en 2011. */
  erupcion(intensidad = 0.7) {
    this._cenizaObjetivo = Math.min(1, intensidad);
    setTimeout(() => { this._cenizaObjetivo = 0; }, 90000);
  }

  /**
   * El reloj interno corre en UTC porque la posición solar se calcula con él,
   * pero al jugador hay que mostrarle la hora de Bariloche: UTC-3.
   */
  get fechaLocal() {
    return new Date(this.fecha.getTime() - 3 * 3600 * 1000);
  }

  get horaDecimalLocal() {
    const f = this.fechaLocal;
    return f.getUTCHours() + f.getUTCMinutes() / 60;
  }

  get textoHora() {
    const f = this.fechaLocal;
    const h = String(f.getUTCHours()).padStart(2, '0');
    const m = String(f.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  get textoFecha() {
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const f = this.fechaLocal;
    return `${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
  }
}
