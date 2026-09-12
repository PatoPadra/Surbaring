/**
 * Hornos — la parte visible de la fundición.
 *
 * Formas mínimas y honestas: una fogata es un círculo de piedras, una carbonera
 * es un montículo de tierra, un horno de barro es una bóveda con boca y una
 * fragua es un hogar bajo con campana. Todo de una pieza y sin textura: lo que
 * importa es reconocerlos de lejos y ver si están encendidos.
 */

import * as THREE from 'three';

const COLORES = {
  fogata: 0x4a4640,
  carbonera: 0x3a3128,
  horno_barro: 0x7a5c41,
  fragua: 0x4d4a46,
};

// La brasa. Los mismos números que tenía la luz de three que colgaba de cada
// horno, para que el fuego se vea igual con la luz nueva: naranja de llama, 14 m
// de alcance, y un latido de 2,6 ± 0,5 a 7,3 rad/s.
//
// Esa luz no se sacó por fea sino por cara: cada horno agregaba una luz puntual
// al grafo, y en three la cantidad de luces es parte de la clave del programa.
// Construir la primera fogata recompilaba seis programas y congelaba el juego
// 19 segundos en la placa de destino. Ahora el horno declara su luz y
// `engine/Luces.js` la escribe en dos lugares que existen desde la carga.
const BRASA_COLOR = new THREE.Color(0xff7a2e);
const BRASA_RADIO_M = 14;
const BRASA_ALTURA_M = 0.6;
const BRASA_BASE = 2.6;
const BRASA_LATIDO = 0.5;

export class Hornos {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'hornos';
    /** @type {Array<{horno:object, malla:THREE.Object3D, intensidad:number}>} */
    this.piezas = [];
  }

  /** Levanta la geometría de un horno recién construido. */
  agregar(horno) {
    const color = COLORES[horno.def.id] ?? 0x6b5a48;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02 });
    const nodo = new THREE.Group();

    switch (horno.def.id) {
      case 'fogata': {
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 5, 9), mat);
        anillo.rotation.x = Math.PI / 2;
        anillo.position.y = 0.16;
        nodo.add(anillo);
        break;
      }
      case 'carbonera': {
        const mont = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 10), mat);
        mont.position.y = 0.75;
        nodo.add(mont);
        break;
      }
      case 'horno_barro': {
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.5, 12), mat);
        base.position.y = 0.25;
        cuerpo.position.y = 0.5;
        nodo.add(base, cuerpo);
        break;
      }
      default: {
        const hogar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), mat);
        hogar.position.y = 0.45;
        const campana = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 6), mat);
        campana.position.y = 1.5;
        nodo.add(hogar, campana);
      }
    }

    nodo.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    nodo.position.set(horno.x, horno.y, horno.z);

    this.grupo.add(nodo);
    // La brasa arranca encendida si el horno ya arde: una fogata repuesta de la
    // partida no puede aparecer negra ni un cuadro (ver `Partida._reponerHornos`).
    this.piezas.push({ horno, malla: nodo, intensidad: horno.ardiendo ? BRASA_BASE : 0 });
    return nodo;
  }

  /** Enciende el fuego de los que arden y lo hace latir. Un horno sin leña o
   *  ahogado por la lluvia se queda a oscuras, y eso se ve de lejos: la brasa
   *  es la única señal de que el fuego sigue vivo cuando uno vuelve al campamento. */
  actualizar(t) {
    for (const p of this.piezas) {
      const activo = !!p.horno.ardiendo;
      const objetivo = activo ? BRASA_BASE + Math.sin(t * 7.3 + p.malla.position.x) * BRASA_LATIDO : 0;
      p.intensidad += (objetivo - p.intensidad) * 0.15;
    }
  }

  /**
   * La luz de los hornos que arden, para `engine/Luces.js`.
   *
   * Sólo los que arden: uno apagado no alumbra, y dejarlo en la lista le haría
   * competir por uno de los dos lugares con intensidad cero. Mientras arde, la
   * intensidad nunca baja del valle del latido: el suavizado de `actualizar()`
   * arranca de cero al prenderse, y una fogata recién encendida que tarda medio
   * segundo en dar luz se lee como un fuego que no prendió.
   *
   * @returns {Array<{x:number,y:number,z:number,radio:number,color:number[],intensidad:number}>}
   */
  fuentesDeLuz() {
    // Un arreglo nuevo por llamada y no uno reusado: son un puñado de objetos
    // por cuadro, y uno reusado le cambia el contenido a quien lo guardó.
    const salida = [];
    for (const p of this.piezas) {
      if (!p.horno.ardiendo) continue;
      const m = p.malla.position;
      salida.push({
        x: m.x, y: m.y + BRASA_ALTURA_M, z: m.z,
        radio: BRASA_RADIO_M,
        color: [BRASA_COLOR.r, BRASA_COLOR.g, BRASA_COLOR.b],
        intensidad: Math.max(p.intensidad, BRASA_BASE - BRASA_LATIDO),
      });
    }
    return salida;
  }
}
