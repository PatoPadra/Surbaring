/**
 * Obras — la parte visible de lo que el jugador construye.
 *
 * Mismo criterio que los hornos: formas mínimas, reconocibles de lejos y sin
 * textura. Lo que distingue a cada una es la silueta, que es lo único que se lee
 * a cincuenta metros entre los árboles: el parapeto es una media pared, el toldo
 * un cono, la cabaña un prisma con techo a dos aguas y el refugio de montaña una
 * casa de piedra con el techo bien empinado, que es como se construye donde
 * nieva de verdad.
 */

import * as THREE from 'three';

const MADERA = 0x5d4630;
const PIEDRA = 0x6f6a63;
const CUERO = 0x7d6247;
const CHAPA = 0x8b8f92;

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.03 });
}

/** Techo a dos aguas: un prisma triangular tumbado. */
function dosAguas(ancho, largo, alto, material) {
  const g = new THREE.CylinderGeometry(ancho * 0.72, ancho * 0.72, largo, 3, 1);
  const m = new THREE.Mesh(g, material);
  m.rotation.z = Math.PI / 2;
  m.rotation.y = Math.PI / 2;
  m.scale.y = 1;
  m.scale.z = alto / (ancho * 0.72);
  return m;
}

export class Obras {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'obras';
    /** @type {Array<{construida:object, nodo:THREE.Object3D}>} */
    this.piezas = [];
  }

  agregar(construida) {
    const nodo = new THREE.Group();
    const id = construida.obra.id;

    switch (id) {
      case 'parapeto': {
        const pared = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.4), mat(MADERA));
        pared.position.y = 0.55;
        nodo.add(pared);
        break;
      }
      case 'vivac_nieve': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.4, 1.6, 7), mat(CUERO));
        c.position.y = 0.8;
        nodo.add(c);
        break;
      }
      case 'toldo': {
        const c = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.6, 8), mat(CUERO));
        c.position.y = 1.3;
        nodo.add(c);
        break;
      }
      case 'canasto': {
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 1.3, 9), mat(0x8a7748));
        const patas = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), mat(MADERA));
        patas.position.y = 0.2;
        cuerpo.position.y = 1.05;
        nodo.add(patas, cuerpo);
        break;
      }
      case 'galpon': {
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 3), mat(MADERA));
        cuerpo.position.y = 1.1;
        const techo = dosAguas(3.2, 4.2, 1.1, mat(CHAPA));
        techo.position.y = 2.7;
        nodo.add(cuerpo, techo);
        break;
      }
      case 'cabana_troncos': {
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.5, 3.6), mat(MADERA));
        cuerpo.position.y = 1.25;
        const techo = dosAguas(3.8, 4.9, 1.7, mat(0x4a3a2c));
        techo.position.y = 3.3;
        nodo.add(cuerpo, techo);
        break;
      }
      case 'casa_piedra': {
        const zocalo = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.2, 4.2), mat(PIEDRA));
        zocalo.position.y = 0.6;
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 3.9), mat(MADERA));
        cuerpo.position.y = 2.3;
        const techo = dosAguas(4.2, 5.8, 2.0, mat(0x3f3a34));
        techo.position.y = 4.4;
        nodo.add(zocalo, cuerpo, techo);
        break;
      }
      case 'refugio_montana': {
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.4), mat(PIEDRA));
        cuerpo.position.y = 1.2;
        // Techo muy empinado: donde nieva de verdad, el techo no discute
        const techo = dosAguas(3.6, 4.6, 2.6, mat(CHAPA));
        techo.position.y = 3.7;
        nodo.add(cuerpo, techo);
        break;
      }
      case 'aserradero': {
        const galpon = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 3.2), mat(MADERA));
        galpon.position.y = 1.1;
        const rueda = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 6, 12), mat(0x4a3a2c));
        rueda.position.set(2.6, 1.6, 0);
        nodo.add(galpon, rueda);
        break;
      }
      case 'molino': {
        const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 3.2, 9), mat(PIEDRA));
        torre.position.y = 1.6;
        const rueda = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.2, 6, 12), mat(MADERA));
        rueda.position.set(2.1, 1.7, 0);
        nodo.add(torre, rueda);
        break;
      }
      case 'telar_witral': {
        // El witral como lo describe Méndez (2009) en la meseta del Chubut: un
        // marco de cuatro palos, dos parantes y dos travesaños atados en los
        // cruces. Adentro, la urdimbre tendida de travesaño a travesaño, el tonon
        // de caña que levanta los lizos y el tejido que crece desde abajo, con su
        // franja teñida. En el campo el marco se apoya oblicuo contra una pared,
        // un cerco o un árbol. Acá no hay contra qué, así que lo sostienen dos
        // puntales por detrás y el marco queda derecho. Eso es lo que lo hace leer
        // como telar a cincuenta metros: dos palos altos y flacos cruzados por
        // dos barras.
        //
        // Todo es caja y cilindro con `mat()`, el mismo material que el resto de
        // las obras. Una urdimbre de líneas sería más fiel, pero compilaría un
        // programa nuevo justo al levantar el telar, y en la ronda 5 un programa
        // nuevo congeló el juego 19 segundos.
        const LANA = 0xd8cfbc, TEJIDO = 0x9d8a6c, TENIDO = 0x8a3b2e, COLIHUE = 0xa39a5c;
        for (const x of [-0.85, 0.85]) {
          const parante = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), mat(MADERA));
          parante.position.set(x, 1.05, 0);
          // El puntal va inclinado hacia atrás: abajo a 0,8 m del marco y arriba
          // tocando el parante, a la altura del travesaño de arriba.
          const puntal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), mat(MADERA));
          puntal.position.set(x, 0.9, -0.42);
          puntal.rotation.x = 0.45;
          nodo.add(parante, puntal);
        }
        for (const y of [0.3, 1.85]) {
          const travesano = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.11, 0.11), mat(MADERA));
          travesano.position.set(0, y, 0.08);
          nodo.add(travesano);
        }
        const urdimbre = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.03), mat(LANA));
        urdimbre.position.set(0, 1.08, 0.05);
        const tejido = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.05), mat(TEJIDO));
        tejido.position.set(0, 0.62, 0.06);
        const franja = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.055), mat(TENIDO));
        franja.position.set(0, 0.74, 0.06);
        const tonon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), mat(COLIHUE));
        tonon.rotation.z = Math.PI / 2;
        tonon.position.set(0, 1.3, 0.12);
        nodo.add(urdimbre, tejido, franja, tonon);
        break;
      }
      default: { // ahumadero y cualquier obra nueva
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.8), mat(MADERA));
        cuerpo.position.y = 1.1;
        const techo = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), mat(0x4a3a2c));
        techo.position.y = 2.6;
        nodo.add(cuerpo, techo);
      }
    }

    nodo.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    nodo.position.set(construida.x, construida.y, construida.z);
    // Un poco de rotación para que dos obras iguales no se vean clonadas
    nodo.rotation.y = (Math.abs(Math.sin(construida.x * 0.37 + construida.z * 0.11)) % 1) * Math.PI * 2;

    this.grupo.add(nodo);
    this.piezas.push({ construida, nodo });
    return nodo;
  }

  /** Saca del mundo lo que se desarmó. */
  quitar(construida) {
    const i = this.piezas.findIndex(p => p.construida === construida);
    if (i < 0) return;
    const [pieza] = this.piezas.splice(i, 1);
    this.grupo.remove(pieza.nodo);
    pieza.nodo.traverse(o => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
  }
}
