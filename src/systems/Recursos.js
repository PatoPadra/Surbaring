/**
 * Recursos — vocabulario común entre lo que se junta y lo que se construye.
 *
 * Los datasets de flora y de tecnologías se investigaron por separado y no
 * hablan el mismo idioma: la flora entrega `madera_dura` y `caña`, mientras las
 * tecnologías piden `madera` y `cana`. Además el árbol de saberes llega hasta el
 * reactor nuclear, así que pide 56 materiales que ninguna planta puede dar.
 *
 * Acá se normaliza el vocabulario y se declara con honestidad qué se puede
 * conseguir hoy y qué no. Una tecnología que pide acero no se marca como
 * "cara": se marca como todavía imposible, que es lo que es.
 */

/** caña -> cana, MADERA -> madera, etc. */
export function normalizar(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Un recurso concreto puede satisfacer pedidos más genéricos: el coihue da
 * madera dura, y eso cuenta como "madera" para cualquier receta que la pida.
 */
const EQUIVALE_A = {
  madera_dura: ['madera', 'tabla', 'poste', 'tronco'],
  madera_blanda: ['madera', 'lena', 'tabla'],
  cana: ['junco'],
  fruto: ['azucar'],
  asta: ['herramienta'],
  cuero: ['red'],
};

export const RECURSOS = {
  // ── Se juntan recorriendo ────────────────────────────────────────────────
  madera_dura:   { nombre: 'Madera dura', kg: 0.8, cat: 'material' },
  madera_blanda: { nombre: 'Madera blanda', kg: 0.5, cat: 'material' },
  lena:          { nombre: 'Leña', kg: 0.6, cat: 'material' },
  tronco:        { nombre: 'Tronco', kg: 6.0, cat: 'material' },
  corteza:       { nombre: 'Corteza', kg: 0.2, cat: 'material' },
  fibra:         { nombre: 'Fibra vegetal', kg: 0.05, cat: 'material' },
  resina:        { nombre: 'Resina', kg: 0.1, cat: 'material' },
  cana:          { nombre: 'Caña colihue', kg: 0.3, cat: 'material' },
  semilla:       { nombre: 'Semillas', kg: 0.02, cat: 'material' },
  piedra:        { nombre: 'Piedra', kg: 1.4, cat: 'material' },
  obsidiana:     { nombre: 'Obsidiana', kg: 0.5, cat: 'material' },
  arcilla:       { nombre: 'Arcilla', kg: 1.0, cat: 'material' },
  fruto:         { nombre: 'Frutos', kg: 0.08, cat: 'alimento', nutre: 9, hidrata: 3 },
  junco:         { nombre: 'Junco', kg: 0.1, cat: 'material' },
  hongo:         { nombre: 'Hongos', kg: 0.06, cat: 'alimento', nutre: 5, hidrata: 2 },
  agua:          { nombre: 'Agua', kg: 1.0, cat: 'alimento', nutre: 0, hidrata: 28 },

  // ── De origen animal ─────────────────────────────────────────────────────
  // Vienen de dos vías, y ninguna es cazar fauna nativa: el control autorizado
  // de exóticas invasoras, y el aprovechamiento de restos hallados en el campo.
  cuero:         { nombre: 'Cuero', kg: 0.9, cat: 'material' },
  tendon:        { nombre: 'Tendón', kg: 0.05, cat: 'material' },
  grasa:         { nombre: 'Grasa', kg: 0.3, cat: 'material' },
  lana:          { nombre: 'Lana', kg: 0.15, cat: 'material' },
  asta:          { nombre: 'Asta', kg: 0.6, cat: 'material' },
  carne:         { nombre: 'Carne', kg: 0.4, cat: 'alimento', nutre: 22, hidrata: 2 },
};

/**
 * Qué se puede conseguir hoy: lo que existe en el registro más todo lo que ese
 * registro satisface por equivalencia. Se deriva en vez de escribirse a mano
 * porque una lista manual se desincroniza en cuanto se agrega un recurso, y
 * entonces el juego declara imposible algo que sí se junta.
 */
export const OBTENIBLES = new Set(
  Object.keys(RECURSOS).flatMap(k => [k, ...(EQUIVALE_A[k] || [])])
);

/** ¿Este material pedido por una receta existe en el mundo? */
export function tieneFuente(id) {
  return OBTENIBLES.has(normalizar(id));
}

/** Nombre legible de cualquier recurso, exista o no en el registro. */
export function nombreDe(id) {
  const k = normalizar(id);
  if (RECURSOS[k]) return RECURSOS[k].nombre;
  return k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

export function pesoDe(id) {
  return RECURSOS[normalizar(id)]?.kg ?? 0.5;
}

/** Qué pedidos satisface una unidad de este recurso, incluido él mismo. */
export function satisface(id) {
  const k = normalizar(id);
  return [k, ...(EQUIVALE_A[k] || [])];
}

/**
 * Qué entrega una planta al recolectarla.
 *
 * Es un parque nacional: no se talan árboles. Se juntan ramas caídas, fibra,
 * corteza suelta y frutos, y la planta queda en pie con un descanso antes de
 * poder volver a darle. Esa restricción no es un capricho de diseño, es la
 * regla real del lugar.
 */
export function cosechaDe(esp) {
  const salida = [];
  if (esp.recursoJuego) {
    const k = normalizar(esp.recursoJuego);
    const base = esp.rendimientoRecurso || 5;
    // Rinde una fracción: se toma lo que la planta puede ceder sin morir
    salida.push({ recurso: k, cantidad: Math.max(1, Math.round(base * 0.14)) });
  }
  if (esp.comestible && esp.parteComestible) {
    const parte = normalizar(esp.parteComestible);
    if (parte === 'fruto' || parte === 'semilla') {
      salida.push({ recurso: parte === 'semilla' ? 'semilla' : 'fruto', cantidad: 2 + Math.floor(Math.random() * 3) });
    }
  }
  return salida;
}

/** Qué entrega cada elemento del sotobosque. */
export const COSECHA_SOTOBOSQUE = {
  tronco: [{ recurso: 'lena', cantidad: 4 }, { recurso: 'corteza', cantidad: 1 }],
  piedra: [{ recurso: 'piedra', cantidad: 2 }],
  helecho: [{ recurso: 'fibra', cantidad: 2 }],
  michay: [{ recurso: 'fruto', cantidad: 2 }, { recurso: 'fibra', cantidad: 1 }],
  coiron: [{ recurso: 'fibra', cantidad: 2 }],
  pasto_humedo: [{ recurso: 'fibra', cantidad: 1 }],
};
