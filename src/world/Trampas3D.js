/**
 * Trampas3D — lo que se ve en el mundo de cada trampa puesta.
 *
 * Mismo criterio que las obras y los hornos: formas mínimas, sin textura, que se
 * leen por la silueta. Cada una es lo que dice su receta:
 *
 * - **El lazo** (3 cordeles, 2 cañas) es un lazo de resorte: una caña de colihue
 *   clavada en el suelo y doblada hasta una estaca, y de su punta cuelga el ojal
 *   de cordel sobre la senda, entre dos ramitas que encauzan al animal. Un lazo
 *   de cordel necesita el resorte —el tirón lo cierra y lo levanta—, y ésa es la
 *   segunda caña de la receta. Cuando agarra algo, la caña se suelta y queda
 *   parada con el lazo arriba: se ve de cerca que saltó, que es lo que ve
 *   cualquiera que vuelve a su trampa.
 * - **La nasa** es el embudo de junco tumbado a medio sumergir, con sus aros, y
 *   la estaca de amarre asomando del agua.
 * - **La red** es el paño colgado de la relinga, con los flotadores sobre el
 *   agua, entre dos estacas.
 *
 * ── Poner la primera no compila nada ────────────────────────────────────────
 *
 * En la ronda 5 un programa nuevo congeló el juego 19 segundos en la placa del
 * dueño, así que esto se diseñó para que poner una trampa no compile ninguno:
 *
 * 1. **Un solo material para todo**, con el color en los vértices. Las tres
 *    trampas y sus dos estados son el mismo programa: la clave de three depende
 *    del material y de los atributos, y todas las geometrías llevan los mismos
 *    tres —posición, normal y color de tres canales—.
 * 2. **Una muestra que se dibuja siempre**, desde la carga: un modelo de lazo a
 *    escala de un milésimo, cien kilómetros bajo el suelo —fuera del plano lejano
 *    de la cámara (90 km), o, mirando muy para abajo, tapado por el terreno y más
 *    chico que un píxel—, con `frustumCulled = false` para que el dibujo se pida
 *    igual. Compila el programa en el primer cuadro y lo mantiene al día: si la
 *    calidad cambia el tipo de sombra, o el agua dibuja el reflejo, este
 *    material recompila junto con todos los demás —en el mismo tirón— y no
 *    cuando se pone la primera trampa. Cuesta una llamada de dibujo por pase sin
 *    un solo píxel: no está medido en la placa, es la cuenta de lo que se pide.
 *    Las otras tres geometrías se dibujan una vez, para que suban a la placa en
 *    la carga, y se apagan.
 *
 * Las trampas no proyectan sombra: son chicas, y con cuatro cascadas cada sombra
 * son cuatro dibujos más (el mismo criterio de `Fauna`, `PESO_MIN_SOMBRA`). Sí
 * la reciben, si `main.js` pasa `materiales` por `conCSM` antes del primer
 * cuadro; ver `pendiente-r8-lazo.md`.
 */

import * as THREE from 'three';

const COLIHUE = 0xa39a5c;
const ESTACA = 0x86663f;
const CORDEL = 0xdccfae;
const JUNCO = 0xb59b5b;
const JUNCO_OSCURO = 0x7f6a3c;
const FLOTADOR = 0xd9cfb4;
const RAMITA = 0x5a4430;
const PANO = 0x4f4a3d;

/** Muy por debajo del suelo y más allá del plano lejano de la cámara (90 km). */
const BAJO_TIERRA = -100000;

// ── Geometría: piezas con color, fundidas en una ─────────────────────────────

/** Una pieza no indexada con su color en los vértices, ya en su lugar. */
function pieza(geo, color, matriz) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (matriz) g.applyMatrix4(matriz);
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array, col, g };
}

/** Todas las piezas en una geometría: un dibujo por trampa, no uno por palo. */
function fundir(piezas) {
  const total = piezas.reduce((s, p) => s + p.pos.length, 0);
  const pos = new Float32Array(total), nor = new Float32Array(total), col = new Float32Array(total);
  let o = 0;
  for (const p of piezas) {
    pos.set(p.pos, o); nor.set(p.nor, o); col.set(p.col, o);
    o += p.pos.length;
    p.g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Un palo de `a` a `b`: un cilindro orientado. */
function palo(a, b, radio, color, lados = 6) {
  _a.set(...a); _b.set(...b);
  const largo = _a.distanceTo(_b);
  const m = new THREE.Matrix4().compose(
    _a.clone().add(_b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(_y, _b.clone().sub(_a).normalize()),
    new THREE.Vector3(1, 1, 1));
  return pieza(new THREE.CylinderGeometry(radio, radio, largo, lados, 1), color, m);
}

/** Una vara curva que pasa por tres puntos: la caña doblada. */
function vara(a, control, b, radio, color) {
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...control), new THREE.Vector3(...b));
  return pieza(new THREE.TubeGeometry(curva, 12, radio, 5, false), color);
}

function aro(radio, grueso, color, m) {
  return pieza(new THREE.TorusGeometry(radio, grueso, 4, 14), color, m);
}

const mover = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/**
 * El lazo de resorte. La senda corre a lo largo de z; el ojal cuelga de través,
 * a un palmo del suelo, que es la altura a la que una liebre lleva la cabeza.
 */
function armarLazo(disparado) {
  const piezas = [
    // Estaca clavada al costado de la senda
    palo([0.24, -0.05, 0], [0.24, 0.5, 0.02], 0.034, ESTACA),
    // Las dos ramitas que encauzan, tiradas a los lados de la senda
    palo([-0.16, 0.02, -0.3], [-0.12, 0.02, 0.24], 0.02, RAMITA, 4),
    palo([0.12, 0.02, -0.28], [0.1, 0.02, 0.26], 0.02, RAMITA, 4),
  ];
  if (!disparado) {
    // La caña clavada del otro lado y doblada hasta la estaca
    piezas.push(vara([-0.42, -0.05, 0], [-0.3, 1.05, 0], [0.2, 0.47, 0], 0.024, COLIHUE));
    // El gatillo: el travesaño que la retiene en la estaca
    piezas.push(palo([0.24, 0.44, 0], [0.04, 0.44, 0], 0.014, COLIHUE, 4));
    // El cordel de la punta al ojal, y el ojal sobre la senda
    piezas.push(palo([0.16, 0.46, 0], [0.02, 0.27, 0], 0.006, CORDEL, 4));
    piezas.push(aro(0.1, 0.012, CORDEL, mover(0, 0.17, 0)));
  } else {
    // Saltó: la caña se enderezó y el lazo quedó arriba, cerrado
    piezas.push(vara([-0.42, -0.05, 0], [-0.38, 0.6, 0], [-0.22, 1.12, 0], 0.024, COLIHUE));
    piezas.push(palo([-0.22, 1.1, 0], [-0.2, 0.86, 0], 0.006, CORDEL, 4));
    piezas.push(aro(0.045, 0.011, CORDEL, mover(-0.2, 0.81, 0)));
  }
  return fundir(piezas);
}

/** La nasa: el embudo tumbado a lo largo de x, la boca hacia −x. */
function armarNasa() {
  const acostado = mover(0, 0, 0, 0, 0, Math.PI / 2);
  const piezas = [
    // El cuerpo: de la boca ancha a la cola cerrada
    pieza(new THREE.CylinderGeometry(0.23, 0.06, 0.8, 9, 1), JUNCO, acostado),
    // Los aros que le dan forma
    aro(0.235, 0.022, JUNCO_OSCURO, mover(-0.4, 0, 0, 0, Math.PI / 2, 0)),
    aro(0.17, 0.018, JUNCO_OSCURO, mover(-0.1, 0, 0, 0, Math.PI / 2, 0)),
    aro(0.11, 0.016, JUNCO_OSCURO, mover(0.18, 0, 0, 0, Math.PI / 2, 0)),
    // La estaca de amarre, asomando del agua, y el cordel a la cola
    palo([0.62, -0.5, 0.18], [0.64, 0.75, 0.2], 0.022, ESTACA),
    palo([0.63, 0.1, 0.19], [0.38, 0.02, 0], 0.006, CORDEL, 4),
  ];
  return fundir(piezas);
}

/** La red: la relinga de flotadores a lo largo de x, entre dos estacas. */
function armarRed() {
  const piezas = [
    // El paño cuelga de la relinga: se ve la franja de arriba, al ras del agua
    pieza(new THREE.BoxGeometry(3.0, 0.45, 0.012), PANO, mover(0, -0.2, 0)),
    palo([-1.5, 0.03, 0], [1.5, 0.03, 0], 0.008, CORDEL, 4),
    palo([-1.6, -0.5, 0], [-1.6, 0.7, 0], 0.025, ESTACA),
    palo([1.6, -0.5, 0], [1.6, 0.7, 0], 0.025, ESTACA),
    palo([-1.6, 0.4, 0], [-1.5, 0.03, 0], 0.006, CORDEL, 4),
    palo([1.6, 0.4, 0], [1.5, 0.03, 0], 0.006, CORDEL, 4),
  ];
  for (let k = 0; k < 7; k++) {
    const x = -1.35 + k * 0.45;
    piezas.push(pieza(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 8, 1), FLOTADOR, mover(x, 0.03, 0, Math.PI / 2, 0, 0)));
  }
  return fundir(piezas);
}

/** Qué forma lleva una trampa, según su objeto y lo que tiene adentro. */
function formaDe(trampas, t) {
  if (trampas.medioDe?.(t.objeto) === 'agua') return t.objeto === 'red_fibra' ? 'red' : 'nasa';
  return t.presas?.length ? 'lazoDisparado' : 'lazo';
}

export class Trampas3D {
  /** @param {import('../systems/Trampas.js').Trampas} trampas */
  constructor(trampas) {
    this.trampas = trampas;
    this.mundo = trampas.mundo;
    this.grupo = new THREE.Group();
    this.grupo.name = 'trampas';

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 });
    /** Lo que `main.js` pasa por `conCSM`, antes del primer cuadro. */
    this.materiales = [this.material];

    this.geometrias = {
      lazo: armarLazo(false),
      lazoDisparado: armarLazo(true),
      nasa: armarNasa(),
      red: armarRed(),
    };

    /** trampa → {malla, forma, x, z} */
    this._vivas = new Map();
    this._pasada = 0;

    this._muestras();
    trampas.oyentes?.push(() => this.sincronizar());
    this.sincronizar();
  }

  /** Ver la cabecera, punto 2. */
  _muestras() {
    let primera = true;
    for (const g of Object.values(this.geometrias)) {
      const m = new THREE.Mesh(g, this.material);
      m.name = 'trampa-muestra';
      m.position.set(0, BAJO_TIERRA, 0);
      m.scale.setScalar(0.001);
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = true;
      if (!primera) {
        // Se dibuja una vez para que la geometría suba a la placa, y se apaga.
        m.onAfterRender = () => { m.visible = false; m.onAfterRender = () => {}; };
      }
      primera = false;
      this.grupo.add(m);
    }
  }

  /** Altura del piso de la trampa: el espejo del lago, el cauce o el terreno. */
  _alturaEn(x, z) {
    const m = this.mundo;
    if (m.esAgua?.(x, z)) return m.superficieEn(x, z);
    return m.alturaEn(x, z);
  }

  /**
   * Pone el mundo al día con `trampas.lista`: crea el modelo de la nueva, cambia
   * el del lazo que saltó y saca el de la que ya no está. Sin cambios es un
   * recorrido por la lista y una comparación por trampa, sin reservar nada: se
   * puede llamar por cuadro.
   */
  sincronizar() {
    const pasada = ++this._pasada;
    let marcadas = 0;
    for (const t of this.trampas.lista) {
      const forma = formaDe(this.trampas, t);
      let v = this._vivas.get(t);
      if (!v) {
        const malla = new THREE.Mesh(this.geometrias[forma], this.material);
        malla.castShadow = false;
        malla.receiveShadow = true;
        malla.userData.trampaId = t.id;
        malla.name = `trampa-${t.objeto}`;
        v = { malla, forma, x: NaN, z: NaN, pasada: 0 };
        this._vivas.set(t, v);
        this.grupo.add(malla);
      }
      if (v.pasada !== pasada) { v.pasada = pasada; marcadas++; }
      if (v.forma !== forma) { v.malla.geometry = this.geometrias[forma]; v.forma = forma; }
      if (v.x !== t.x || v.z !== t.z) {
        v.x = t.x; v.z = t.z;
        v.malla.position.set(t.x, this._alturaEn(t.x, t.z), t.z);
        // Un giro que sale del lugar, como en las obras: dos trampas iguales no
        // se ven clonadas, y el mismo lugar da el mismo giro al volver a cargar.
        v.malla.rotation.y = (Math.abs(Math.sin(t.x * 0.37 + t.z * 0.11)) % 1) * Math.PI * 2;
        // La nasa va a medio sumergir, la red flota.
        if (forma === 'nasa') v.malla.position.y -= 0.08;
      }
    }
    // Lo que quedó sin marcar ya no está en la lista: levantada, gastada, o la
    // lista se vació desde afuera.
    if (this._vivas.size > marcadas) {
      for (const [t, v] of this._vivas) {
        if (v.pasada === pasada) continue;
        this.grupo.remove(v.malla);
        this._vivas.delete(t);
      }
    }
  }

  /** El objeto 3D de una trampa, o null. */
  modeloDe(t) {
    this.sincronizar();
    return this._vivas.get(t)?.malla ?? null;
  }
}
