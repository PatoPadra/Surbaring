/**
 * Recolección — el verbo con el que el jugador interactúa con el mundo.
 *
 * Una sola tecla resuelve todo lo que hay a mano, en orden de prioridad:
 * identificar al animal cercano, beber si está en el agua, cosechar la planta o
 * el elemento del sotobosque que tenga delante.
 *
 * Nada se tala ni se mata. Es un parque nacional: se juntan ramas caídas,
 * fibra, corteza suelta y frutos, y la planta queda en pie con un descanso
 * antes de poder volver a darle. La restricción no es de diseño, es la regla
 * real del lugar, y de paso enseña por qué existe.
 */

import { cosechaDe, COSECHA_SOTOBOSQUE, nombreDe, RECURSOS } from './Recursos.js';

const DESCANSO_S = 150;   // segundos de juego antes de volver a cosechar lo mismo

export class Recoleccion {
  constructor({ mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud }) {
    Object.assign(this, { mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud });
    /** @type {Map<string, number>} clave de posición -> instante en que se cosechó */
    this.descansando = new Map();
  }

  _clave(x, z) { return `${Math.round(x * 4)}:${Math.round(z * 4)}`; }

  _enDescanso(x, z, ahora) {
    const t = this.descansando.get(this._clave(x, z));
    return t != null && ahora - t < DESCANSO_S;
  }

  /** Devuelve qué haría la tecla de acción ahora mismo, para el indicador. */
  quePuedoHacer(ahora) {
    const p = this.jugador.posicion;

    const animal = this.fauna.masCercano(p, 22);
    if (animal) return { tipo: 'identificar', etiqueta: `Identificar ${animal.esp.nombreComun.toLowerCase()}`, animal };

    if (this.jugador.enAgua || this._aguaCerca()) {
      return { tipo: 'beber', etiqueta: 'Beber agua' };
    }

    const planta = this.vegetacion.masCercana(p, 7);
    if (planta && !this._enDescanso(planta.x, planta.z, ahora)) {
      return { tipo: 'planta', etiqueta: `Recolectar ${planta.esp.nombreComun.toLowerCase()}`, planta };
    }

    const mata = this.sotobosque.masCercano(p, 5);
    if (mata && COSECHA_SOTOBOSQUE[mata.tipo.id] && !this._enDescanso(mata.x, mata.z, ahora)) {
      return { tipo: 'sotobosque', etiqueta: `Juntar ${mata.tipo.nombre.toLowerCase()}`, mata };
    }

    if (planta) return { tipo: 'espera', etiqueta: `${planta.esp.nombreComun}: dale un descanso` };
    return null;
  }

  _aguaCerca() {
    const p = this.jugador.posicion;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) {
      if (this.mundo.esAgua(p.x + dx, p.z + dz)) return true;
    }
    return this.mundo.cauceEn(p.x, p.z) > 0.25;
  }

  /** Ejecuta la acción disponible. */
  actuar(ahora) {
    const acc = this.quePuedoHacer(ahora);
    if (!acc) {
      this.hud.aviso('Nada a mano', 'Acercate a un animal, una planta o el agua');
      return;
    }

    switch (acc.tipo) {
      case 'identificar':
        this.codice.registrarFauna(acc.animal.esp, true);
        this._puntosPorEspecie(acc.animal.esp);
        return;

      case 'beber': {
        const antes = this.jugador.sed;
        this.jugador.sed = Math.min(100, this.jugador.sed + 32);
        this.inventario.agregar('agua', 1);
        this.hud.aviso('Bebiste agua', `Hidratación ${antes.toFixed(0)} → ${this.jugador.sed.toFixed(0)}`);
        return;
      }

      case 'planta': {
        const esp = acc.planta.esp;
        const cosecha = cosechaDe(esp);
        this.descansando.set(this._clave(acc.planta.x, acc.planta.z), ahora);

        // Recolectar también es conocer: la planta entra al códice
        const nueva = !this.codice.identificadas.has(esp.id);
        this.codice.registrarFlora(esp);
        if (nueva) this._puntosPorEspecie(esp);

        if (!cosecha.length) {
          this.hud.aviso(esp.nombreComun, 'No da materiales aprovechables');
          return;
        }
        const obtenido = [];
        for (const c of cosecha) {
          const n = this.inventario.agregar(c.recurso, c.cantidad);
          if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
        }
        if (!obtenido.length) this.hud.aviso('No entra nada más', `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
        else if (!nueva) this.hud.aviso(esp.nombreComun, obtenido.join(' · '));
        return;
      }

      case 'sotobosque': {
        const cosecha = [...(COSECHA_SOTOBOSQUE[acc.mata.tipo.id] || [])];
        this.descansando.set(this._clave(acc.mata.x, acc.mata.z), ahora);

        // Extras según dónde está la piedra. No es azar decorativo: la
        // obsidiana es vidrio volcánico y aparece en altura, y la arcilla se
        // deposita en las orillas.
        if (acc.mata.tipo.id === 'piedra') {
          if (acc.mata.y > 1500 && Math.random() < 0.28) {
            cosecha.push({ recurso: 'obsidiana', cantidad: 1 });
          }
          if (this._aguaCerca() && Math.random() < 0.45) {
            cosecha.push({ recurso: 'arcilla', cantidad: 2 });
          }
        }

        const obtenido = [];
        for (const c of cosecha) {
          const n = this.inventario.agregar(c.recurso, c.cantidad);
          if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
        }
        this.hud.aviso(acc.mata.tipo.nombre,
          obtenido.length ? obtenido.join(' · ') : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`);
        return;
      }

      default:
        this.hud.aviso(acc.etiqueta, 'Volvé más tarde');
    }
  }

  _puntosPorEspecie(esp) {
    let p = 2;
    if (['CR', 'EN', 'VU'].includes(esp.estadoConservacion)) p += 4;
    this.saberes.otorgar(p, `${esp.nombreComun} identificado`);
  }

  /** Comer lo mejor que haya en el bolso. */
  comer() {
    const opciones = this.inventario.comestibles();
    if (!opciones.length) {
      this.hud.aviso('No tenés comida', 'Recolectá frutos de calafate, maqui o michay');
      return;
    }
    const mejor = opciones.sort((a, b) =>
      (RECURSOS[b.id].nutre || 0) - (RECURSOS[a.id].nutre || 0))[0];
    const def = RECURSOS[mejor.id];
    this.inventario.quitar(mejor.id, 1);
    this.jugador.hambre = Math.min(100, this.jugador.hambre + (def.nutre || 0));
    this.jugador.sed = Math.min(100, this.jugador.sed + (def.hidrata || 0));
    this.hud.aviso(`Comiste ${mejor.nombre.toLowerCase()}`,
      `Alimento ${this.jugador.hambre.toFixed(0)} · Hidratación ${this.jugador.sed.toFixed(0)}`);
  }
}
