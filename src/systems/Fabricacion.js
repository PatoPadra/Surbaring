/**
 * Fabricación — hacer cosas con lo que hay en el bolso.
 *
 * Se fabrica desde el bolso, sin banco de trabajo. Fue una decisión explícita: el
 * gesto del nivel 0 es «esto lo hago con las manos», y meter una mesa de
 * carpintero entre el jugador y su primer cordel sería inventar una fricción que
 * la realidad no tiene. Una lasca se saca sentado en una piedra.
 *
 * Las dos excepciones son físicas y no de diseño: el hierro pide la fragua
 * porque hay que ablandarlo, y la brea y el curtido piden fuego porque hay que
 * cocerlos. Para esas se reusa `Fundicion.cercano()`, que ya resuelve «¿tengo un
 * horno al lado y está prendido?» y ya registra el aserradero como uno más.
 *
 * El molde de «pedir materiales, ver qué falta, consumir» ya estaba escrito tres
 * veces en el proyecto —`Saberes.estado()`, `Fundicion.estadoReceta()`,
 * `Construccion.faltaPara()`— y las tres usan `disponiblePara`/`consumirPara`
 * del inventario, que cuentan equivalencias. Esta es la cuarta y usa lo mismo:
 * la madera dura del coihue sirve donde una receta pide madera.
 */

import { pesoDe } from './Recursos.js';

export class Fabricacion {
  /**
   * @param {object} datos herramientas.json
   * @param {object} deps {inventario, saberes, equipo, fundicion, hud}
   */
  constructor(datos, { inventario, saberes, equipo, fundicion, hud }) {
    Object.assign(this, { datos, inventario, saberes, equipo, fundicion, hud });
    this.catalogo = (datos.objetos || []).filter(o => (o.materiales || []).length);
    this.alCambiar = null;
  }

  /** ¿La estación que pide este objeto está a mano y en condiciones? */
  estacion(obj) {
    const donde = obj.donde || 'bolso';
    if (donde === 'bolso') return { ok: true };

    const horno = this.fundicion?.cercano();
    if (donde === 'fogata') {
      if (horno && this.fundicion.arde(horno)) return { ok: true };
      return { ok: false, motivo: 'Hace falta un fuego encendido al lado: esto hay que cocerlo.' };
    }
    if (horno?.def?.id === donde) {
      if (!this.fundicion.usaFuego(horno) || this.fundicion.arde(horno)) return { ok: true };
      return { ok: false, motivo: `La ${horno.def.nombre.toLowerCase()} está apagada.` };
    }
    const def = this.fundicion?.definicionesHorno?.find(d => d.id === donde);
    return { ok: false, motivo: `Hace falta estar al lado de: ${def?.nombre || donde}.` };
  }

  /**
   * Estado de un objeto: si se puede hacer, y si no, exactamente por qué.
   *
   * Distinguir «te falta juntar» de «todavía no sabés» de «no estás en el lugar»
   * es la diferencia entre una meta y una pared invisible. Es el mismo criterio
   * que `Saberes.estado()` y no es casualidad: el jugador ya lo aprendió ahí.
   */
  estado(obj) {
    if (obj.tecnologia && !this.saberes?.desbloqueadas.has(obj.tecnologia)) {
      const tec = this.saberes?.porId.get(obj.tecnologia);
      return {
        estado: 'falta_saber', tecnologia: tec,
        motivo: `Hay que aprender «${tec?.nombre || obj.tecnologia}» en el códice.`,
      };
    }

    const falta = [];
    for (const m of obj.materiales || []) {
      const hay = this.inventario.disponiblePara(m.recurso);
      if (hay < m.cantidad) falta.push({ recurso: m.recurso, pide: m.cantidad, hay });
    }
    if (falta.length) return { estado: 'faltan_materiales', falta };

    const est = this.estacion(obj);
    if (!est.ok) return { estado: 'falta_estacion', motivo: est.motivo };

    return { estado: 'lista' };
  }

  /** Lo que el jugador ya sabe hacer, esté o no en condiciones de hacerlo ahora. */
  disponibles() {
    return this.catalogo.filter(o =>
      !o.tecnologia || this.saberes?.desbloqueadas.has(o.tecnologia));
  }

  /**
   * Fabrica. Devuelve qué pasó, para que quien avise tenga con qué.
   *
   * Un objeto con `produce` entrega recursos al bolso; uno sin `produce` es una
   * herramienta y va al equipo. Es la única diferencia entre una receta y una
   * herramienta en todo el sistema.
   */
  fabricar(obj) {
    const e = this.estado(obj);
    if (e.estado !== 'lista') return e;

    // El peso se comprueba ANTES de consumir: quedarse sin materiales y sin
    // objeto porque no entraba en el bolso sería robarle al jugador. Se mira el
    // neto, porque casi toda receta suelta más de lo que entrega —cuatro fibras
    // pesan más que el cordel que sale de ellas— y esas nunca deberían fallar.
    if (obj.produce) {
      const gana = obj.produce.reduce((s, p) => s + p.cantidad * pesoDe(p.recurso), 0);
      const suelta = (obj.materiales || []).reduce((s, m) => s + m.cantidad * pesoDe(m.recurso), 0);
      const libre = this.inventario.capacidadKg - this.inventario.pesoKg;
      if (gana - suelta > libre) {
        return { estado: 'no_entra', motivo: 'No te entra en el bolso: soltá algo primero.' };
      }
    }

    for (const m of obj.materiales || []) {
      this.inventario.consumirPara(m.recurso, m.cantidad);
    }

    const salida = [];
    if (obj.produce) {
      for (const p of obj.produce) {
        const n = this.inventario.agregar(p.recurso, p.cantidad);
        salida.push({ recurso: p.recurso, cantidad: n });
      }
    } else {
      this.equipo.guardar(obj.id);
    }

    this.alCambiar?.();
    return { estado: 'hecho', objeto: obj, salida };
  }
}
