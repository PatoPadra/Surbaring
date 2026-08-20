/**
 * Peces — cardúmenes en los lagos, los ríos y los arroyos.
 *
 * Los peces del Nahuel Huapi ya estaban en el dataset de fauna, con sus medidas
 * y su estado de conservación, pero no existían en el mundo: la temporada de
 * pesca era un dato sin nada a lo que aplicarse. Acá se instancian.
 *
 * Dónde aparece cada uno no es decorativo. El puyén chico es un pez de orilla y
 * de superficie, y es el alimento de casi todo lo demás; el puyén grande y la
 * perca criolla andan más hondo; los salmónidos introducidos —trucha arcoíris,
 * trucha marrón, salmón encerrado— ocupan tanto el lago como los ríos, que es
 * justamente el problema: llegaron a todos lados. En el arroyo chico la trucha
 * desplaza a los nativos con más facilidad que en un lago grande, así que ahí
 * domina.
 *
 * Se dibujan con una malla instanciada por especie: un cardumen de cuarenta
 * puyenes cuesta un dibujo, no cuarenta.
 */

import * as THREE from 'three';

const RADIO_SIEMBRA = 190;     // hasta dónde se pueblan cardúmenes
const RADIO_OLVIDO = 300;
const MAX_CARDUMENES = 14;
const MAX_POR_CARDUMEN = 22;

const COLORES = {
  trucha_arcoiris: 0x8a9a7b,
  trucha_marron: 0x7a6242,
  salmon_encerrado: 0x92968c,
  perca_criolla: 0x6d6a4e,
  puyen_grande: 0x5f6a63,
  puyen_chico: 0x8e9aa0,
  pejerrey_patagonico: 0x8a9098,
};

/** Cuerpo de pez: dos conos encontrados y una cola plana. Cuatro triángulos y ya. */
function geometriaPez(largoM) {
  const cuerpo = new THREE.OctahedronGeometry(0.5, 0);
  cuerpo.scale(largoM * 0.62, largoM * 0.26, largoM * 0.16);
  const cola = new THREE.ConeGeometry(largoM * 0.16, largoM * 0.3, 3);
  cola.rotateZ(Math.PI / 2);
  cola.translate(-largoM * 0.42, 0, 0);
  cola.scale(1, 1, 0.35);
  return fusionar([cuerpo, cola]);
}

/** Une geometrías simples sin traer el helper de three, que no está expuesto acá. */
function fusionar(geos) {
  const pos = [], nor = [];
  for (const g of geos) {
    const gp = g.toNonIndexed();
    pos.push(...gp.attributes.position.array);
    nor.push(...gp.attributes.normal.array);
    gp.dispose(); g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class Peces {
  /**
   * @param {import('../world/Mundo.js').Mundo} mundo
   * @param {{especies: Array}} datos fauna.json
   */
  constructor(mundo, datos) {
    this.mundo = mundo;
    this.grupo = new THREE.Group();
    this.grupo.name = 'peces';

    this.especies = (datos.especies || []).filter(e => e.clase === 'pez');
    this.porId = new Map(this.especies.map(e => [e.id, e]));

    /** @type {Array<{esp:object, x:number, z:number, cota:number, ambiente:string, n:number, fase:number, radio:number}>} */
    this.cardumenes = [];
    this.lotes = new Map();   // especie -> InstancedMesh
    this._matriz = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._pos = new THREE.Vector3();
    this._escala = new THREE.Vector3(1, 1, 1);
    this._ultimaSiembra = -1e9;
    this.total = 0;

    for (const esp of this.especies) {
      const malla = new THREE.InstancedMesh(
        geometriaPez(esp.largoM || 0.2),
        new THREE.MeshStandardMaterial({
          color: COLORES[esp.id] ?? 0x76807a, roughness: 0.42, metalness: 0.12,
        }),
        MAX_CARDUMENES * MAX_POR_CARDUMEN
      );
      malla.count = 0;
      malla.frustumCulled = false;
      malla.castShadow = false;      // están bajo el agua: no proyectan nada útil
      malla.receiveShadow = false;
      this.lotes.set(esp.id, malla);
      this.grupo.add(malla);
    }
  }

  /**
   * Qué ambiente hay en un punto: el lago grande, otro lago, un río o nada.
   * La temporada de pesca depende de esto, así que no es un detalle visual.
   */
  ambienteEn(x, z) {
    if (this.mundo.esAgua(x, z)) {
      const cota = this.mundo.cotaLagoEn(x, z);
      const nahuel = (this.mundo.meta.lagos || []).find(l => l.id === 'nahuel_huapi');
      if (nahuel && Math.abs(cota - nahuel.cota) < 6) {
        return { id: 'lago_nahuel_huapi', nombre: 'Lago Nahuel Huapi', cota };
      }
      return { id: 'lagos', nombre: 'Lago del parque', cota };
    }
    if (this.mundo.cauceEn(x, z) > 0.3) {
      return { id: 'rios', nombre: 'Río o arroyo', cota: this.mundo.alturaEn(x, z) };
    }
    return null;
  }

  /** Aptitud de la especie en un ambiente: dónde vive cada una, de verdad. */
  _aptitud(esp, ambiente, profundidad) {
    const enRio = ambiente === 'rios';
    const salmonido = esp.invasora;
    if (enRio) {
      // En el arroyo chico la trucha se impone: es donde más desplaza a los nativos
      if (salmonido) return 1.0;
      if (esp.id === 'puyen_chico' || esp.id === 'puyen_grande') return 0.45;
      return 0.15;
    }
    if (salmonido) return 0.75;
    if (esp.id === 'puyen_chico') return profundidad < 2 ? 1.1 : 0.4;
    if (esp.id === 'perca_criolla') return 0.8;
    if (esp.id === 'puyen_grande') return 0.7;
    return 0.5;
  }

  /** Sorteo ponderado de especie para un ambiente. Lo usa también la pesca. */
  elegirEspecie(ambiente, profundidad) {
    const pesos = this.especies.map(e => this._aptitud(e, ambiente, profundidad));
    const total = pesos.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pesos.length; i++) {
      r -= pesos[i];
      if (r <= 0) return this.especies[i];
    }
    return this.especies[0];
  }

  /** Puebla el agua que rodea al jugador y olvida la que quedó lejos. */
  sembrar(centro) {
    this.cardumenes = this.cardumenes.filter(c =>
      Math.hypot(c.x - centro.x, c.z - centro.z) < RADIO_OLVIDO);

    let intentos = 0;
    while (this.cardumenes.length < MAX_CARDUMENES && intentos++ < 90) {
      const ang = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * RADIO_SIEMBRA;
      const x = centro.x + Math.cos(ang) * r;
      const z = centro.z + Math.sin(ang) * r;
      const amb = this.ambienteEn(x, z);
      if (!amb) continue;

      const profundidad = 0.4 + Math.random() * (amb.id === 'rios' ? 0.8 : 4.5);
      const esp = this.elegirEspecie(amb.id, profundidad);
      // Los chicos andan en cardúmenes grandes; una trucha grande, casi sola
      const n = esp.pesoKg > 1
        ? 1 + Math.floor(Math.random() * 3)
        : 6 + Math.floor(Math.random() * MAX_POR_CARDUMEN * 0.7);

      this.cardumenes.push({
        esp, x, z, ambiente: amb.id,
        cota: amb.cota - profundidad,
        n, fase: Math.random() * 100,
        radio: esp.pesoKg > 1 ? 3 + Math.random() * 6 : 1.4 + Math.random() * 2.5,
      });
    }
  }

  actualizar(posJugador, t) {
    if (t - this._ultimaSiembra > 2.5) {
      this._ultimaSiembra = t;
      this.sembrar(posJugador);
    }

    const cuenta = new Map();
    for (const esp of this.especies) cuenta.set(esp.id, 0);

    for (const c of this.cardumenes) {
      const malla = this.lotes.get(c.esp.id);
      for (let i = 0; i < c.n; i++) {
        const k = cuenta.get(c.esp.id);
        if (k >= malla.instanceMatrix.count) break;

        // Giro lento alrededor del centro del cardumen, cada pez en su fase
        const vel = c.esp.invasora ? 0.28 : 0.42;
        const a = c.fase + i * (Math.PI * 2 / Math.max(1, c.n)) + t * vel;
        const rr = c.radio * (0.5 + 0.5 * Math.sin(c.fase + i * 1.7));
        const x = c.x + Math.cos(a) * rr;
        const z = c.z + Math.sin(a) * rr;
        const y = c.cota + Math.sin(t * 0.7 + i) * 0.18;

        this._pos.set(x, y, z);
        // Mirando hacia donde nada, con un balanceo de cola
        this._q.setFromEuler(new THREE.Euler(
          0, -a + Math.PI / 2 + Math.sin(t * 6 + i) * 0.12, Math.sin(t * 5 + i) * 0.08));
        this._matriz.compose(this._pos, this._q, this._escala);
        malla.setMatrixAt(k, this._matriz);
        cuenta.set(c.esp.id, k + 1);
      }
    }

    this.total = 0;
    for (const [id, n] of cuenta) {
      const malla = this.lotes.get(id);
      malla.count = n;
      malla.instanceMatrix.needsUpdate = true;
      this.total += n;
    }
  }

  /**
   * El cardumen más cercano a un punto. Es lo que mira el sistema de pesca:
   * el pez que pica es el que está donde cae la línea.
   */
  masCercano(posicion, radio = 30) {
    let mejor = null, mejorD = radio;
    for (const c of this.cardumenes) {
      const d = Math.hypot(c.x - posicion.x, c.z - posicion.z);
      if (d < mejorD) { mejorD = d; mejor = c; }
    }
    return mejor;
  }
}
