/**
 * Límites — en qué jurisdicción está parado el jugador.
 *
 * El sistema de caza ya distinguía "dentro del parque" de "en Río Negro", pero
 * lo hacía sólo con palabras. La minería necesita que esa distinción exista en
 * el mapa, porque abrir una cantera es delito de un lado de la línea y trámite
 * del otro, y el juego enseña justamente eso.
 *
 * Hay tres categorías reales, no dos:
 *
 * - `parque`   Área núcleo del Parque Nacional Nahuel Huapi. La Ley 22.351
 *              prohíbe ahí toda extracción, sin excepción ni permiso.
 * - `reserva`  Reserva Nacional, la franja que rodea al área núcleo y donde
 *              existen la ruta, los hoteles, el cerro Catedral y las villas.
 *              Ahí la Administración de Parques Nacionales *puede* autorizar
 *              canteras y otras actividades productivas, bajo reglamento.
 * - `fuera`    Ejido de Bariloche y estepa del este, en jurisdicción de Río
 *              Negro. Rige el Código de Minería y el dominio provincial de los
 *              recursos, y la extracción de áridos es una actividad normal.
 *
 * ADVERTENCIA SOBRE EL TRAZADO: los límites reales del parque y de sus reservas
 * son un polígono complejo fijado por ley y por decretos sucesivos, y acá están
 * representados de forma ESQUEMÁTICA, con umbrales de latitud y longitud
 * elegidos para que los lugares conocidos caigan en la categoría correcta. Sirve
 * para que el juego enseñe que la línea existe y que cambia lo que se puede
 * hacer. No sirve para decidir nada en el mundo real: para eso está la
 * cartografía oficial de la Administración de Parques Nacionales.
 */

/** Ejido de Bariloche y estepa del este: fuera de toda área protegida. */
const FUERA = [
  // Estepa oriental: todo lo que está al este del meridiano de Dina Huapi
  { lonDesde: -71.20, lonHasta: -71.00, latDesde: -41.60, latHasta: -40.70 },
  // Ejido urbano de Bariloche, entre el Ñireco y el este del lago
  { lonDesde: -71.33, lonHasta: -71.10, latDesde: -41.20, latHasta: -41.02 },
];

/** Reserva Nacional: la franja desarrollada del sur y el este del lago. */
const RESERVA = [
  // Corredor Llao Llao – Colonia Suiza – Otto – Catedral – Gutiérrez
  { lonDesde: -71.62, lonHasta: -71.33, latDesde: -41.28, latHasta: -41.02 },
  // Costa norte del lago hacia el este
  { lonDesde: -71.50, lonHasta: -71.20, latDesde: -41.02, latHasta: -40.88 },
];

const NOMBRES = {
  parque: 'Parque Nacional Nahuel Huapi',
  reserva: 'Reserva Nacional Nahuel Huapi',
  fuera: 'Jurisdicción de Río Negro',
};

function dentroDe(cajas, lat, lon) {
  return cajas.some(c =>
    lon >= c.lonDesde && lon <= c.lonHasta &&
    lat >= c.latDesde && lat <= c.latHasta);
}

export class Limites {
  /** @param {import('./Mundo.js').Mundo} mundo */
  constructor(mundo) {
    this.mundo = mundo;
  }

  /** Categoría de protección en un punto del mundo, en metros. */
  jurisdiccion(x, z) {
    const { lat, lon } = this.mundo.aLatLon(x, z);
    if (dentroDe(FUERA, lat, lon)) return 'fuera';
    if (dentroDe(RESERVA, lat, lon)) return 'reserva';
    return 'parque';
  }

  nombreDe(j) { return NOMBRES[j] || NOMBRES.parque; }

  /** Etiqueta corta para la interfaz. */
  etiqueta(x, z) {
    const j = this.jurisdiccion(x, z);
    return { id: j, nombre: this.nombreDe(j) };
  }
}
