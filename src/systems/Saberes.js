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

  /**
   * ¿Hay alguna tecnología —aprendida o no— que sea requisito de esto?
   *
   * Acá se cierra el agujero más grande del proyecto: de las 47 tecnologías, el
   * único lugar de todo el código que consultaba `desbloqueadas` para permitir o
   * negar algo era la construcción de obras. Las otras 41 eran texto histórico
   * con precio: se cazaba a mano limpia con el arco comprado, se levantaba la
   * fragua sin saber herrería, y el árbol entero podía quedar apagado sin que
   * cambiara nada. Un juego cuya tesis es que el conocimiento es el progreso no
   * puede tener el conocimiento desconectado de las reglas.
   *
   * El enganche es un campo `efecto` en el dataset y esta consulta: los sistemas
   * preguntan "¿esto pide saber algo?" y el árbol contesta.
   */
  requisitosPara(clave, valor) {
    const salida = [];
    for (const t of this.porId.values()) {
      const v = t.efecto?.[clave];
      if (v === undefined) continue;
      const coincide = valor === undefined ? !!v
        : Array.isArray(v) ? v.includes(valor) : v === valor;
      if (coincide) salida.push(t);
    }
    return salida;
  }

  /** El primero que habilite esto, aprendido o no. Para preguntar "¿pide saber algo?". */
  requisitoPara(clave, valor) {
    return this.requisitosPara(clave, valor)[0] || null;
  }

  /**
   * Qué falta aprender para poder hacer esto, o null si ya se puede.
   *
   * Acá vivía un defecto que no se veía con una sola tecnología por efecto y
   * aparecía con la segunda. `requisitoPara()` devuelve la PRIMERA coincidencia
   * del índice, esté aprendida o no, y preguntar por ella sola es preguntar mal:
   * en cuanto la boleadora y el arco habilitan los dos la caza, el jugador que
   * se ganó el arco quedaba bloqueado por una boleadora que no necesita, porque
   * la boleadora está antes en el orden del dataset.
   *
   * La pregunta correcta no es "¿está aprendida la primera?" sino "¿hay alguna
   * aprendida?". Y si no hay ninguna, se devuelve la más barata: el aviso tiene
   * que señalar el camino más corto, no el primero que apareció en el archivo.
   */
  faltaPara(clave, valor) {
    const candidatas = this.requisitosPara(clave, valor);
    if (!candidatas.length) return null;
    if (candidatas.some(t => this.desbloqueadas.has(t.id))) return null;
    return candidatas.reduce((a, b) =>
      (b.costoSaber || 0) < (a.costoSaber || 0) ? b : a);
  }

  /** Suma de un efecto numérico entre todo lo que ya se aprendió. */
  suma(clave) {
    let n = 0;
    for (const id of this.desbloqueadas) n += this.porId.get(id)?.efecto?.[clave] || 0;
    return n;
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
