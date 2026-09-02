/**
 * Cuerpo — el modelo del jugador, generado con geometría, como todo acá.
 *
 * No hay archivos de modelo en SurviBar: el terreno sale del relieve real, los
 * árboles se generan, el sonido se sintetiza. El cuerpo sigue esa regla. Pero
 * "generado" no quiere decir "cajas": la primera versión eran nueve prismas
 * apilados y se veía exactamente como lo que era, un maniquí de prueba parado
 * en medio de un bosque dibujado con cuidado.
 *
 * Lo que cambia acá, y por qué funciona:
 *
 * - **Volúmenes torneados, no prismas.** Troncos de cono de diez lados, con
 *   radio distinto arriba y abajo. Un torso que se afina en la cintura y se
 *   ensancha en el pecho ya lee como un cuerpo; una caja no lee como nada.
 * - **Sección ovalada.** Una persona es bastante más ancha de hombro a hombro
 *   que de pecho a espalda. Se consigue achatando el eje Z, y es probablemente
 *   el cambio que más hace por la silueta con menos geometría.
 * - **Articulaciones esféricas.** Hombros, codos y rodillas llevan una esfera
 *   que tapa la juntura. Sin ella se ven dos tubos que se cruzan.
 * - **Rodillas y codos que doblan.** Una pierna rígida que pivota en la cadera
 *   es un compás. Doblar la rodilla en la fase de vuelo —cuando el pie tiene
 *   que despegar para no arrastrarse— es lo que convierte el ciclo en una
 *   caminata.
 *
 * Sigue siendo de pocos polígonos a propósito: el mundo es facetado y un
 * personaje suave adentro se vería pegado encima.
 *
 * Dos decisiones más que vale la pena dejar escritas:
 *
 * - **El cuerpo también existe en primera persona**, y sólo se ocultan la
 *   cabeza y el cuello, que van juntos. Mirás hacia abajo y ves tu torso y tus
 *   piernas caminando, y proyectás sombra. Un jugador que no tiene sombra al
 *   mediodía es un fantasma; en un juego cuyo tema es estar en un lugar real,
 *   eso se nota aunque nadie sepa decir por qué.
 * - **El modelo está hecho para 1,78 m y se escala.** Así la estatura elegida
 *   cambia el tamaño de la silueta y no sólo la altura de la cámara.
 */

import * as THREE from 'three';

/** Estatura para la que están escritas todas las medidas de acá abajo. */
const BASE = 1.78;
/** Lados de los cilindros. Diez es donde deja de verse el prisma y todavía es barato. */
const LADOS = 10;

/**
 * Tronco de cono con el pivote en el extremo de arriba, que es donde está la
 * articulación de la que cuelga. `aplanado` achata el eje Z para dar sección
 * ovalada en vez de redonda.
 */
function hueso(radioArriba, radioAbajo, largo, material, aplanado = 1) {
  const g = new THREE.CylinderGeometry(radioArriba, radioAbajo, largo, LADOS, 1);
  g.translate(0, -largo / 2, 0);
  if (aplanado !== 1) g.scale(1, 1, aplanado);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
}

/** Esfera de articulación: tapa la juntura entre dos huesos. */
function nudo(radio, material, y = 0) {
  const g = new THREE.SphereGeometry(radio, LADOS, 6);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
}

export class Cuerpo {
  /**
   * @param {import('../systems/Aspecto.js').Aspecto} aspecto
   * @param {(material: THREE.Material) => void} [registrarMaterial] enganche a
   *        las sombras en cascada; sin él el cuerpo no recibe la sombra del sol.
   */
  constructor(aspecto, registrarMaterial) {
    this.registrarMaterial = registrarMaterial;
    this.grupo = new THREE.Group();
    this.grupo.name = 'jugador';
    // El cuerpo se dibuja siempre: está a pocos metros de la cámara y el recorte
    // por volumen se equivoca justo cuando la cámara gira sobre él.
    this.grupo.frustumCulled = false;

    this.fase = 0;
    this._materiales = [];
    this._agachadoSuave = 0;
    this.aplicar(aspecto);
  }

  // ── Construcción ──────────────────────────────────────────────────────────

  _material(color, rugosidad = 0.86) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: 0 });
    this.registrarMaterial?.(m);
    this._materiales.push(m);
    return m;
  }

  /** Rehace el modelo entero con un aspecto nuevo. Barato: son treinta mallas. */
  aplicar(aspecto) {
    this.aspecto = aspecto;
    this._limpiar();

    const piel = this._material(aspecto.colorPiel, 0.92);
    const campera = this._material(aspecto.colorCampera);
    // La campera oscurecida hace de cuello, puños y cintura: es el mismo color
    // leído como sombra, así que separa las piezas sin inventar una paleta.
    const ribete = this._material(
      new THREE.Color(aspecto.colorCampera).multiplyScalar(0.62).getHex(), 0.9);
    const pantalon = this._material(aspecto.colorPantalon);
    const pelo = this._material(aspecto.colorPelo, 0.95);
    const bota = this._material(0x2e2620, 0.88);

    const a = aspecto.anchoCuerpo;    // la complexión ensancha, no estira
    const OVAL = 0.66;                // achatamiento en Z de todo el torso

    // ── Torso: cuelga de la cadera (0,92) y llega al hombro (1,44)
    const tronco = new THREE.Group();
    tronco.position.y = 0.92;
    // La campera baja hasta la cadera. Cuando terminaba en la cintura, el ribete
    // ocupaba un cuarto del torso y se leía como una prenda aparte; un cinturón
    // fino hace el mismo trabajo de separar sin partir la silueta en tres.
    const pecho = hueso(0.205 * a, 0.176 * a, 0.40, campera, OVAL);
    pecho.position.y = 0.52;
    tronco.add(pecho);
    const cinturon = hueso(0.176 * a, 0.174 * a, 0.07, ribete, OVAL);
    cinturon.position.y = 0.12;
    tronco.add(cinturon);
    const cadera = hueso(0.176 * a, 0.162 * a, 0.13, pantalon, OVAL);
    cadera.position.y = 0.05;
    tronco.add(cadera);
    this.tronco = tronco;
    this.grupo.add(tronco);

    // ── Cabeza. En su propio grupo porque en primera persona se apaga sola.
    const cabeza = new THREE.Group();
    cabeza.position.y = 0.52;                 // base del cuello → 1,44
    const cuello = hueso(0.058 * a, 0.072 * a, 0.10, piel);
    cuello.position.y = 0.10;
    cabeza.add(cuello);
    // Cráneo ovoide: una esfera estirada a lo alto y apenas angosta de sienes
    const craneo = nudo(0.108, piel, 0.215);
    craneo.scale.set(0.94, 1.14, 1.0);
    cabeza.add(craneo);
    // Mandíbula: sin ella el ovoide es un huevo y la cara no tiene frente
    const menton = nudo(0.078, piel, 0.155);
    menton.scale.set(0.92, 0.78, 1.06);
    menton.position.z = -0.012;
    cabeza.add(menton);
    // Nariz: seis centímetros de cono que dicen para dónde mira
    const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.062, 5), piel);
    nariz.rotation.x = -Math.PI / 2;
    nariz.position.set(0, 0.205, -0.098);
    nariz.castShadow = true;
    cabeza.add(nariz);
    for (const lado of [-1, 1]) {
      const oreja = nudo(0.028, piel, 0.215);
      oreja.scale.set(0.5, 1.15, 0.85);
      oreja.position.x = lado * 0.098;
      cabeza.add(oreja);
    }
    this._peinado(cabeza, aspecto, pelo);
    this.cabeza = cabeza;
    tronco.add(cabeza);

    // ── Brazos: hombro → codo → mano
    this.brazos = [];
    this.codos = [];
    for (const lado of [-1, 1]) {
      const hombro = new THREE.Group();
      hombro.position.set(lado * (0.195 * a), 0.50, 0);
      hombro.add(nudo(0.072 * a, campera));                  // deltoides
      hombro.add(hueso(0.062 * a, 0.050 * a, 0.29, campera));

      const codo = new THREE.Group();
      codo.position.y = -0.29;
      codo.add(nudo(0.048 * a, ribete));                     // puño de la manga
      codo.add(hueso(0.047 * a, 0.040 * a, 0.26, piel));
      const mano = nudo(0.052 * a, piel, -0.28);
      mano.scale.set(0.85, 1.1, 0.7);
      codo.add(mano);

      hombro.add(codo);
      this.brazos.push(hombro);
      this.codos.push(codo);
      tronco.add(hombro);
    }

    // ── Piernas: cadera → rodilla → pie
    this.piernas = [];
    this.rodillas = [];
    for (const lado of [-1, 1]) {
      const muslo = new THREE.Group();
      muslo.position.set(lado * (0.095 * a), 0.92, 0);
      muslo.add(nudo(0.098 * a, pantalon));
      muslo.add(hueso(0.098 * a, 0.072 * a, 0.44, pantalon));

      const rodilla = new THREE.Group();
      rodilla.position.y = -0.44;
      rodilla.add(nudo(0.070 * a, pantalon));
      rodilla.add(hueso(0.070 * a, 0.050 * a, 0.40, pantalon));

      // Pie: una cápsula acostada, talón atrás y punta adelante. Una caja acá
      // se nota enseguida, porque el pie es lo que toca el suelo.
      const pie = new THREE.Mesh(new THREE.CapsuleGeometry(0.052 * a, 0.115, 3, 8), bota);
      pie.rotation.x = Math.PI / 2;
      pie.position.set(0, -0.415, -0.035);
      pie.castShadow = true;
      rodilla.add(pie);
      // Caña de la bota: tapa el encuentro entre el pantalón y el pie
      const cana = hueso(0.060 * a, 0.064 * a, 0.11, bota);
      cana.position.y = -0.30;
      rodilla.add(cana);

      muslo.add(rodilla);
      this.piernas.push(muslo);
      this.rodillas.push(rodilla);
      this.grupo.add(muslo);
    }

    // La escala convierte el modelo de 1,78 en el de la estatura elegida
    this.grupo.scale.setScalar(aspecto.estatura / BASE);
  }

  /**
   * El pelo. Y sólo el pelo: los gorros y los sombreros son cosas que se
   * consiguen y se ponen, no rasgos con los que se nace. Ponerlos en la
   * creación de personaje los convertía en una decisión de nacimiento, y son
   * justo lo contrario: son lo primero que uno querría fabricarse en un lugar
   * donde la cabeza descubierta es por donde se va el calor.
   */
  _peinado(cabeza, aspecto, pelo) {
    const id = aspecto.idPeinado;
    if (id === 'rapado') {
      const casquete = nudo(0.109, pelo, 0.215);
      casquete.scale.set(0.95, 1.13, 1.0);
      cabeza.add(casquete);
      return;
    }

    // Casquete algo más grande que el cráneo y corrido hacia atrás, para que
    // quede frente: un casquete centrado se lee como un casco.
    const casquete = nudo(0.116, pelo, 0.222);
    casquete.scale.set(0.97, 1.10, 1.0);
    casquete.position.z = 0.012;
    cabeza.add(casquete);

    if (id === 'corto') return;

    if (id === 'recogido') {
      const rodete = nudo(0.055, pelo, 0.20);
      rodete.position.z = 0.115;
      cabeza.add(rodete);
      return;
    }

    // Melena, media o larga, cayendo por la nuca
    const larga = id === 'larga';
    const caida = hueso(0.115, 0.098, larga ? 0.34 : 0.19, pelo, 0.74);
    caida.position.set(0, 0.28, 0.022);
    cabeza.add(caida);
    // Los mechones de adelante nacen de las sienes, no de la frente
    for (const lado of [-1, 1]) {
      const mecha = hueso(0.036, 0.030, larga ? 0.24 : 0.13, pelo, 0.7);
      mecha.position.set(lado * 0.098, 0.27, -0.01);
      cabeza.add(mecha);
    }
  }

  _limpiar() {
    for (const m of this._materiales) m.dispose();
    this._materiales.length = 0;
    this.grupo.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.grupo.clear();
  }

  // ── Animación ─────────────────────────────────────────────────────────────

  /**
   * @param {number} dt segundos reales
   * @param {object} j jugador (posición, giro, cabeceo, velocidad, estados)
   */
  actualizar(dt, j) {
    // La cota es la suavizada, la misma que usa la cámara: con la cruda el
    // personaje daría saltitos dentro del encuadre en tercera persona.
    this.grupo.position.set(j.posicion.x, j.alturaVisual ?? j.posicion.y, j.posicion.z);
    this.grupo.rotation.y = j.giro;

    // Nadando el cuerpo se hunde hasta el pecho en vez de caminar por el fondo
    if (j.enAgua) this.grupo.position.y -= Math.min(0.55, j.profundidadAgua * 0.35);

    const rapidez = Math.hypot(j.velocidad.x, j.velocidad.z);
    // La fase del paso la manda el jugador, no este cuerpo.
    //
    // Tenía un reloj propio —`rapidez * dt * 2,4`, o sea 1,309 m por paso— y la
    // cámara tenía otro —1,736 m por cabeceo— y el sonido un tercero —0,85 m—.
    // Eran tres pasos distintos corriendo a la vez sobre el mismo cuerpo: el
    // pie apoyaba, el ruido llegaba y la cabeza bajaba en tres momentos que no
    // coincidían nunca. Ahora los tres leen `jugador.fasePaso`.
    //
    // El maniquí de la creación de personaje no es un `Jugador` y no tiene
    // fase, así que ahí se conserva el reloj viejo: es una vidriera girando,
    // no hay cámara que sincronizar.
    if (j.fasePaso !== undefined) this.fase = j.fasePaso;
    else this.fase += rapidez * dt * 2.4;
    const swing = Math.min(rapidez / 5.5, 1) * (j.enSuelo ? 1 : 0.25);
    const s = Math.sin(this.fase);

    for (let i = 0; i < 2; i++) {
      const si = i === 0 ? s : -s;
      // Muslo: adelante y atrás
      this.piernas[i].rotation.x = si * 0.62 * swing;
      // Rodilla: sólo dobla hacia atrás, y sobre todo en la fase de vuelo, que
      // es cuando el pie tiene que despegar del suelo para no arrastrarse.
      this.rodillas[i].rotation.x = -Math.max(0, -si) * 1.05 * swing - 0.06;
      // Brazo: en contrafase con la pierna del mismo lado
      this.brazos[i].rotation.x = -si * 0.46 * swing;
      // Cuelgan un poco abiertos: pegados al torso se ven clavados
      this.brazos[i].rotation.z = (i === 0 ? 1 : -1) * 0.09;
      // Codo: siempre algo doblado, y más cuando el brazo va hacia adelante
      this.codos[i].rotation.x = 0.28 + Math.max(0, -si) * 0.45 * swing;
    }

    // Agacharse: el cuerpo se recoge y se inclina, en vez de encogerse entero
    const objetivo = j.agachado ? 1 : 0;
    this._agachadoSuave += (objetivo - this._agachadoSuave) * Math.min(1, dt * 10);
    const c = this._agachadoSuave;
    // Correr inclina el torso: de ahí sale la sensación de que el cuerpo se
    // está tirando hacia donde va, y no de la velocidad del suelo.
    const carrera = Math.min(1, Math.max(0, rapidez - 3.6) / 2.6);
    this.tronco.position.y = 0.92 - 0.34 * c;
    this.tronco.rotation.x = 0.46 * c + 0.16 * carrera;
    for (const p of this.piernas) {
      p.position.y = 0.92 - 0.34 * c;
      p.rotation.x += 0.30 * c;               // en cuclillas las piernas se pliegan
    }
    for (const r of this.rodillas) r.rotation.x -= 0.75 * c;

    // La cabeza sigue la mirada, pero la mitad: el resto lo hace el cuello del
    // jugador de verdad, y girarla entera parece un búho.
    const limite = 0.7;
    this.cabeza.rotation.x =
      Math.max(-limite, Math.min(limite, j.cabeceo * 0.55)) - 0.46 * c;

    // En primera persona sólo estorban la cabeza y el cuello: el torso mirado
    // desde arriba es exactamente lo que uno espera ver.
    this.cabeza.visible = !!j.tercerPersona;
  }

  destruir() {
    this._limpiar();
    this.grupo.removeFromParent();
  }
}
