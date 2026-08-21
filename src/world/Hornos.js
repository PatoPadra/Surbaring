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

export class Hornos {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'hornos';
    /** @type {Array<{horno:object, malla:THREE.Object3D, brasa:THREE.PointLight}>} */
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

    // La brasa: apagada mientras el horno no trabaja
    const brasa = new THREE.PointLight(0xff7a2e, 0, 14, 2);
    brasa.position.set(0, 0.6, 0);
    nodo.add(brasa);

    this.grupo.add(nodo);
    this.piezas.push({ horno, malla: nodo, brasa });
    return nodo;
  }

  /** Enciende el fuego de los que están cociendo y lo hace latir.
   *  Un horno apagado por la lluvia se queda a oscuras, y se nota de lejos. */
  actualizar(t) {
    for (const p of this.piezas) {
      const activo = !!p.horno.trabajo && !p.horno.trabajo.apagado;
      const objetivo = activo ? 2.6 + Math.sin(t * 7.3 + p.malla.position.x) * 0.5 : 0;
      p.brasa.intensity += (objetivo - p.brasa.intensity) * 0.15;
    }
  }
}
