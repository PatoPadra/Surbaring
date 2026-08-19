/**
 * Saberes — el progreso del jugador por el árbol de tecnologías.
 *
 * Los puntos no se ganan matando: se ganan conociendo. Identificar una especie,
 * llegar a una cumbre o encontrar un sitio histórico es lo que hace avanzar al
 * jugador. En un juego sobre un parque nacional, ése es el verbo correcto.
 */

import { normalizar, nombreDe, tieneFuente } from './Recursos.js';

export const PUNTOS = {
  especieIdentificada: 2,
  especieAmenazada: 4,   // extra por las que están en peligro
  lugar: 3,
  cumbre: 6,
};

export class Saberes {
  /**
   * @param {{tecnologias: Array, eras: Array}} historia
   * @param {import('./Inventario.js').Inventario} inventario
   */
  constructor(historia, inventario) {
    this.historia = historia;
    this.inventario = inventario;
    this.puntos = 0;
    this.ganadosTotales = 0;
    this.desbloqueadas = new Set();
    this.alCambiar = null;

    this.porId = new Map((historia.tecnologias || []).map(t => [t.id, t]));
  }

  otorgar(puntos, motivo) {
    this.puntos += puntos;
    this.ganadosTotales += puntos;
    this.alCambiar?.(puntos, motivo);
  }

  /**
   * Estado de una tecnología: si se puede, y si no, exactamente por qué.
   * Distinguir "te faltan materiales" de "eso todavía no existe en el mundo"
   * es la diferencia entre una meta y una pared invisible.
   */
  estado(tec) {
    if (this.desbloqueadas.has(tec.id)) {
      return { estado: 'desbloqueada' };
    }

    const faltanPrevias = (tec.requiere || []).filter(r => !this.desbloqueadas.has(r));
    const materiales = (tec.materiales || []).map(m => {
      const k = normalizar(m.recurso);
      const hay = this.inventario.disponiblePara(k);
      return {
        recurso: k, nombre: nombreDe(k), pide: m.cantidad, hay,
        alcanza: hay >= m.cantidad,
        // Marcado aparte: no es que falte juntarlo, es que no se puede conseguir
        imposible: hay < m.cantidad && !tieneFuente(k),
      };
    });

    const imposibles = materiales.filter(m => m.imposible);
    const faltanMateriales = materiales.filter(m => !m.alcanza && !m.imposible);
    const faltanPuntos = Math.max(0, (tec.costoSaber || 0) - this.puntos);

    let estado = 'lista';
    if (imposibles.length) estado = 'inalcanzable';
    else if (faltanPrevias.length) estado = 'requiere_previas';
    else if (faltanMateriales.length) estado = 'faltan_materiales';
    else if (faltanPuntos > 0) estado = 'faltan_puntos';

    return {
      estado, materiales, imposibles, faltanMateriales, faltanPuntos,
      faltanPrevias: faltanPrevias.map(r => this.porId.get(r)?.nombre || r),
    };
  }

  desbloquear(tec) {
    const e = this.estado(tec);
    if (e.estado !== 'lista') return e;
    for (const m of tec.materiales || []) {
      this.inventario.consumirPara(normalizar(m.recurso), m.cantidad);
    }
    this.puntos -= (tec.costoSaber || 0);
    this.desbloqueadas.add(tec.id);
    this.alCambiar?.(0, `Aprendiste: ${tec.nombre}`);
    return { estado: 'desbloqueada' };
  }

  /** Cuántas tecnologías son alcanzables con lo que hoy existe en el mundo. */
  resumen() {
    let alcanzables = 0, inalcanzables = 0;
    for (const t of this.historia.tecnologias || []) {
      const e = this.estado(t);
      if (e.estado === 'desbloqueada') continue;
      if (e.estado === 'inalcanzable') inalcanzables++;
      else alcanzables++;
    }
    return {
      desbloqueadas: this.desbloqueadas.size,
      total: (this.historia.tecnologias || []).length,
      alcanzables, inalcanzables, puntos: this.puntos,
    };
  }
}
