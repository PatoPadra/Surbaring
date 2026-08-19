/**
 * Inventario — lo que el jugador carga encima.
 *
 * El límite no es una cantidad de casilleros sino el peso, que además frena al
 * jugador: cargar cuarenta kilos de piedra cuesta caro al subir un cerro.
 */

import { RECURSOS, normalizar, pesoDe, nombreDe, satisface } from './Recursos.js';

export class Inventario {
  constructor(capacidadKg = 38) {
    this.capacidadKg = capacidadKg;
    /** @type {Map<string, number>} recurso -> cantidad */
    this.items = new Map();
    this.alCambiar = null;
  }

  get pesoKg() {
    let p = 0;
    for (const [k, n] of this.items) p += pesoDe(k) * n;
    return p;
  }

  get lleno() { return this.pesoKg >= this.capacidadKg; }

  cantidad(recurso) { return this.items.get(normalizar(recurso)) || 0; }

  /**
   * Agrega lo que entre. Devuelve cuánto entró de verdad: si el bolso está
   * casi lleno, se toma lo que se puede y se avisa.
   */
  agregar(recurso, cantidad) {
    const k = normalizar(recurso);
    const unidad = pesoDe(k);
    const libre = Math.max(0, this.capacidadKg - this.pesoKg);
    const caben = unidad > 0 ? Math.floor(libre / unidad) : cantidad;
    const n = Math.max(0, Math.min(cantidad, caben));
    if (n > 0) {
      this.items.set(k, (this.items.get(k) || 0) + n);
      this.alCambiar?.();
    }
    return n;
  }

  quitar(recurso, cantidad) {
    const k = normalizar(recurso);
    const hay = this.items.get(k) || 0;
    if (hay < cantidad) return false;
    if (hay === cantidad) this.items.delete(k);
    else this.items.set(k, hay - cantidad);
    this.alCambiar?.();
    return true;
  }

  /**
   * Cuánto hay disponible para un pedido, contando equivalencias: la madera
   * dura del coihue sirve para cualquier receta que pida "madera".
   */
  disponiblePara(pedido) {
    const p = normalizar(pedido);
    let total = 0;
    for (const [k, n] of this.items) {
      if (satisface(k).includes(p)) total += n;
    }
    return total;
  }

  /** Consume un pedido usando primero el recurso más específico. */
  consumirPara(pedido, cantidad) {
    const p = normalizar(pedido);
    let falta = cantidad;
    const candidatos = [...this.items.keys()]
      .filter(k => satisface(k).includes(p))
      .sort((a, b) => (a === p ? -1 : b === p ? 1 : 0));
    for (const k of candidatos) {
      if (falta <= 0) break;
      const hay = this.items.get(k);
      const usa = Math.min(hay, falta);
      this.quitar(k, usa);
      falta -= usa;
    }
    return falta <= 0;
  }

  /** Lista ordenada para la interfaz. */
  listar() {
    return [...this.items.entries()]
      .map(([k, n]) => ({
        id: k, nombre: nombreDe(k), cantidad: n,
        kg: +(pesoDe(k) * n).toFixed(1),
        cat: RECURSOS[k]?.cat || 'material',
      }))
      .sort((a, b) => a.cat.localeCompare(b.cat) || a.nombre.localeCompare(b.nombre));
  }

  /** Comestibles a mano, para el atajo de comer. */
  comestibles() {
    return this.listar().filter(i => RECURSOS[i.id]?.cat === 'alimento' && RECURSOS[i.id].nutre > 0);
  }
}
