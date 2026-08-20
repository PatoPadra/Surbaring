/**
 * Vegetación — bosque andino-patagónico instanciado.
 *
 * Las especies no se reparten al azar: cada una tiene su rango de altitud, su
 * exigencia de humedad y su tolerancia de pendiente, tomados de src/data/flora.json.
 * Como la humedad del mundo sigue la sombra de lluvia andina, el bosque se ordena
 * solo: selva valdiviana húmeda al oeste, coihues en el medio, ciprés y ñire hacia
 * el este, y estepa de coirón en el extremo seco. Por encima de la línea de bosque
 * (~1600 m) sólo quedan lenga achaparrada y matorral.
 */

import * as THREE from 'three';

const TAM_CELDA = 96;         // metros por celda de siembra
const RADIO_CELDAS = 13;      // celdas alrededor del jugador
const MAX_POR_ESPECIE = 1200;   // malla completa: sólo los árboles cercanos
const MAX_IMPOSTORES = 12000;   // carteleras: todo lo demás
/**
 * Distancia a la que un árbol pasa de malla completa a cartelera.
 *
 * A 120 m un coihue ocupa unos 40 píxeles de alto: la diferencia entre 450
 * triángulos y dos deja de notarse, pero el ahorro es de dos órdenes de
 * magnitud, sobre todo porque las carteleras además no proyectan sombra y cada
 * sombra cuesta cuatro dibujos con las cuatro cascadas.
 */
const DIST_IMPOSTOR = 120;

/** Rotación nula, para las carteleras que se orientan solas. */
const IDENTIDAD = new THREE.Quaternion();

export class Vegetacion {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   * @param {{especies: Array, biomas: Array}} flora
   */
  constructor(mundo, flora, render) {
    this.mundo = mundo;
    this.flora = flora;
    this.render = render;
    this.grupo = new THREE.Group();
    this.grupo.name = 'vegetacion';

    // Uniformes compartidos por todas las carteleras
    this.uniformesImpostor = {
      uColorSol: { value: new THREE.Color(1, 1, 1) },
      uIntensidadSol: { value: 2.0 },
      uAmbiente: { value: new THREE.Color(0.35, 0.40, 0.45) },
      uNiebla: { value: new THREE.Color(0.6, 0.7, 0.8) },
      uDensidadNiebla: { value: 0.00005 },
      // La cartelera necesita saber desde dónde se la mira para elegir la vista
      uCamara: { value: new THREE.Vector3() },
    };

    // Sólo las especies leñosas se dibujan como instancias; las hierbas van al
    // manto de pasto y las trepadoras y hongos quedan como objetos de recolección.
    this.especies = flora.especies
      .filter(e => ['arbol', 'arbusto', 'cana'].includes(e.tipo))
      .filter(e => e.altitudMinM !== null && e.altitudMaxM !== null)
      .slice(0, 26);

    this.uniformes = {
      uTiempo: { value: 0 },
      uViento: { value: new THREE.Vector2(0.9, 0.3) },
      uFuerzaViento: { value: 0.35 },
      uEstacion: { value: 0 },
      uNieve: { value: 0 },
      uCotaNieve: { value: 1750 },
    };

    this.lotes = [];
    for (const esp of this.especies) {
      this.lotes.push(this._crearLote(esp));
    }

    this._celdaActual = { x: 9999, z: 9999 };
    this._matriz = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._esc = new THREE.Vector3();
    this._cua = new THREE.Quaternion();
    this._eje = new THREE.Vector3(0, 1, 0);
    this.totalInstancias = 0;
  }

  _crearLote(esp) {
    const geo = construirPlanta(esp);
    const claseHoja = clasificar(esp) === 'columnar' ? 'aguja' : 'lamina';
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: atlasFollaje(claseHoja),
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
      // Recorte por alfa: sin ordenar por profundidad y sin coste de mezcla.
      // El umbral es bajo a propósito, porque el mipmapping va comiendo el alfa
      // de los bordes y con un umbral alto las hojas se evaporan a distancia.
      alphaTest: 0.28,
    });
    inyectarViento(mat, this.uniformes, esp);

    const malla = new THREE.InstancedMesh(geo, mat, MAX_POR_ESPECIE);
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    malla.castShadow = true;
    malla.receiveShadow = true;
    malla.frustumCulled = false;
    malla.count = 0;
    malla.name = esp.id;

    // Variación de color por instancia: ningún árbol es idéntico al de al lado
    const colores = new THREE.InstancedBufferAttribute(new Float32Array(MAX_POR_ESPECIE * 3), 3);
    malla.geometry.setAttribute('iTinte', colores);

    this.grupo.add(malla);

    const impostor = this.render ? this._crearImpostor(esp, geo, mat.map) : null;
    return { esp, malla, colores, n: 0, impostor };
  }

  /** Cartelera de una especie: se hornea la malla y se instancia un cuadrilátero. */
  _crearImpostor(esp, geo, mapaFollaje) {
    const horneado = hornearImpostor(this.render, geo, mapaFollaje);

    // Cuadrilátero con el pivote en la base, igual que el árbol
    const plano = new THREE.PlaneGeometry(1, 1);
    plano.translate(0, 0.5, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.uniformesImpostor,
        uMapa: { value: horneado.textura },
        uAncho: { value: horneado.ancho },
        uAlto: { value: horneado.alto },
        uVistas: { value: horneado.vistas },
        uRejilla: { value: new THREE.Vector2(horneado.cols, horneado.filas) },
        uEstacion: { value: 0 },
        uColorOtono: { value: new THREE.Color(esp.colorHojaOtono || esp.colorHojaVerano || '#8a4a1e') },
        uPerenne: { value: esp.perenne !== false ? 1 : 0 },
        uCotaNieve: { value: 1750 },
      },
      vertexShader: VERT_IMPOSTOR,
      fragmentShader: FRAG_IMPOSTOR,
      side: THREE.DoubleSide,
    });

    const malla = new THREE.InstancedMesh(plano, mat, MAX_IMPOSTORES);
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Las carteleras no proyectan sombra: son planas y la sombra las delataría.
    malla.castShadow = false;
    malla.receiveShadow = false;
    malla.frustumCulled = false;
    malla.count = 0;
    malla.name = esp.id + '_impostor';

    const colores = new THREE.InstancedBufferAttribute(new Float32Array(MAX_IMPOSTORES * 3), 3);
    malla.geometry.setAttribute('iTinte', colores);

    this.grupo.add(malla);
    return { malla, colores, n: 0, horneado };
  }

  /** Aptitud de una especie en un punto: 0 = no crece, 1 = óptimo. */
  _aptitud(esp, altitud, humedad, pendienteGrados) {
    if (altitud < esp.altitudMinM || altitud > esp.altitudMaxM) return 0;
    if (esp.pendienteMaxGrados && pendienteGrados > esp.pendienteMaxGrados) return 0;
    if (humedad < (esp.humedadMin ?? 0)) return 0;

    // Campana suave dentro del rango altitudinal
    const centro = (esp.altitudMinM + esp.altitudMaxM) / 2;
    const semi = Math.max(1, (esp.altitudMaxM - esp.altitudMinM) / 2);
    const alt = 1 - Math.pow(Math.abs(altitud - centro) / semi, 2);

    // La humedad por encima del mínimo favorece, pero satura
    const hum = Math.min(1, (humedad - (esp.humedadMin ?? 0)) / 0.28 + 0.35);

    // Las laderas suaves sostienen más biomasa
    const pend = 1 - Math.min(1, pendienteGrados / 60) * 0.55;

    return Math.max(0, alt) * hum * pend * (esp.densidadRelativa ?? 0.5);
  }

  /**
   * Repuebla si el jugador cambió de celda.
   * @param {THREE.Camera} [camara] hace falta para elegir la vista del atlas
   */
  actualizar(posicion, tiempo, estado, camara) {
    if (camara) camara.getWorldPosition(this.uniformesImpostor.uCamara.value);
    else this.uniformesImpostor.uCamara.value.copy(posicion);
    this.uniformes.uTiempo.value = tiempo;
    const rad = (estado.direccionViento ?? 270) * Math.PI / 180;
    this.uniformes.uViento.value.set(Math.sin(rad), -Math.cos(rad));
    this.uniformes.uFuerzaViento.value = Math.min(1.8, 0.12 + (estado.vientoKmh ?? 20) / 48);
    this.uniformes.uEstacion.value = estado.estacionContinua ?? 0;
    this.uniformes.uCotaNieve.value = estado.cotaNieve ?? 1750;
    this.uniformes.uNieve.value = estado.nieve > 0.05 ? 1 : 0;

    // Las carteleras no pasan por el sistema de luces de three: hay que
    // pasarles el sol, el ambiente y la niebla a mano para que no se despeguen
    // del resto de la escena al atardecer o con mal tiempo.
    if (this.cielo) {
      this.uniformesImpostor.uColorSol.value.copy(this.cielo.luzSolColor ?? this.cielo.luzSol.color);
      this.uniformesImpostor.uIntensidadSol.value = this.cielo.intensidadSolar ?? 2.0;
      const d = this.cielo.factorDia ?? 1;
      this.uniformesImpostor.uAmbiente.value.setRGB(
        0.18 + 0.34 * d, 0.21 + 0.36 * d, 0.26 + 0.34 * d
      );
    }
    for (const lote of this.lotes) {
      if (!lote.impostor) continue;
      lote.impostor.malla.material.uniforms.uEstacion.value = estado.estacionContinua ?? 0;
      lote.impostor.malla.material.uniforms.uCotaNieve.value = estado.cotaNieve ?? 1750;
    }

    const cx = Math.floor(posicion.x / TAM_CELDA);
    const cz = Math.floor(posicion.z / TAM_CELDA);
    if (cx === this._celdaActual.x && cz === this._celdaActual.z) return;
    this._celdaActual = { x: cx, z: cz };
    this._sembrar(cx, cz);
  }

  _sembrar(cx, cz) {
    const m = this.mundo;
    for (const lote of this.lotes) {
      lote.n = 0;
      if (lote.impostor) lote.impostor.n = 0;
    }

    // Centro del sembrado: el reparto entre malla y cartelera se mide desde acá
    const centroX = (cx + 0.5) * TAM_CELDA;
    const centroZ = (cz + 0.5) * TAM_CELDA;

    const color = new THREE.Color();
    let total = 0;

    for (let dz = -RADIO_CELDAS; dz <= RADIO_CELDAS; dz++) {
      for (let dx = -RADIO_CELDAS; dx <= RADIO_CELDAS; dx++) {
        const distCeldas = Math.hypot(dx, dz);
        if (distCeldas > RADIO_CELDAS) continue;

        const gx = cx + dx, gz = cz + dz;
        // Menos densidad a lo lejos: el detalle no se ve y cuesta caro
        const factorDistancia = 1 - Math.min(1, distCeldas / RADIO_CELDAS) * 0.62;

        let semilla = (gx * 73856093) ^ (gz * 19349663);
        const azar = () => {
          semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
          return semilla / 0x7fffffff;
        };

        // Muestreo por celda: cuántos individuos intentar plantar
        const intentos = Math.round(22 * factorDistancia);
        for (let k = 0; k < intentos; k++) {
          const x = gx * TAM_CELDA + azar() * TAM_CELDA;
          const z = gz * TAM_CELDA + azar() * TAM_CELDA;
          if (!m.dentro(x, z)) continue;
          if (m.esAgua(x, z)) continue;

          const altitud = m.alturaEn(x, z);
          const pendiente = m.pendienteEn(x, z) * 180 / Math.PI;
          const humedad = m.humedadEn(x, z);

          // Ruleta ponderada entre las especies aptas
          let suma = 0;
          const pesos = [];
          for (const lote of this.lotes) {
            const a = this._aptitud(lote.esp, altitud, humedad, pendiente);
            pesos.push(a);
            suma += a;
          }
          if (suma < 0.02) continue;

          let r = azar() * suma, elegido = -1;
          for (let i = 0; i < pesos.length; i++) {
            r -= pesos[i];
            if (r <= 0) { elegido = i; break; }
          }
          if (elegido < 0) continue;

          const lote = this.lotes[elegido];

          // Claros del bosque: ruido de baja frecuencia abre huecos naturales
          const claro = ruidoValor(x * 0.0042, z * 0.0042);
          if (claro < 0.24) continue;

          // Nivel de detalle: cerca la malla completa, lejos la cartelera.
          const dist = Math.hypot(x - centroX, z - centroZ);
          const usaImpostor = lote.impostor && dist > DIST_IMPOSTOR;
          const destino = usaImpostor ? lote.impostor : lote;
          const tope = usaImpostor ? MAX_IMPOSTORES : MAX_POR_ESPECIE;
          if (destino.n >= tope) continue;

          const esp = lote.esp;
          const alturaObj = esp.alturaMinM + azar() * (esp.alturaMaxM - esp.alturaMinM);
          const escala = alturaObj / Math.max(0.5, (esp.alturaMinM + esp.alturaMaxM) / 2);

          // Los árboles crecen inclinados hacia la luz y contra el viento oeste
          const inclinacion = (azar() - 0.5) * 0.10 + 0.045;
          this._cua.setFromAxisAngle(this._eje, azar() * Math.PI * 2);
          const incl = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0.3).normalize(), inclinacion
          );
          this._cua.multiply(incl);

          this._pos.set(x, altitud - 0.15, z);
          this._esc.set(escala * (0.86 + azar() * 0.3), escala, escala * (0.86 + azar() * 0.3));
          // La cartelera no lleva la rotación aleatoria: se orienta sola hacia
          // la cámara en el shader. Sólo le importan la posición y la escala.
          this._matriz.compose(this._pos, usaImpostor ? IDENTIDAD : this._cua, this._esc);
          destino.malla.setMatrixAt(destino.n, this._matriz);

          // Tinte: verdes más oscuros en umbría, más claros al sol
          const v = 0.82 + azar() * 0.36;
          color.setRGB(v * (0.92 + azar() * 0.16), v, v * (0.88 + azar() * 0.2));
          destino.colores.setXYZ(destino.n, color.r, color.g, color.b);

          destino.n++;
          total++;
        }
      }
    }

    let cercanos = 0, lejanos = 0;
    for (const lote of this.lotes) {
      lote.malla.count = lote.n;
      lote.malla.instanceMatrix.needsUpdate = true;
      lote.colores.needsUpdate = true;
      lote.malla.computeBoundingSphere();
      cercanos += lote.n;
      if (lote.impostor) {
        lote.impostor.malla.count = lote.impostor.n;
        lote.impostor.malla.instanceMatrix.needsUpdate = true;
        lote.impostor.colores.needsUpdate = true;
        lote.impostor.malla.computeBoundingSphere();
        lejanos += lote.impostor.n;
      }
    }
    this.totalInstancias = total;
    this.mallasCompletas = cercanos;
    this.impostores = lejanos;
  }

  /**
   * Planta con malla completa más cercana al jugador, para recolectar.
   * Sólo se buscan las cercanas: a una cartelera de dos triángulos a 300 m no
   * se le puede sacar corteza.
   */
  masCercana(posicion, radio = 7) {
    if (!this._matriz2) this._matriz2 = new THREE.Matrix4();
    let mejor = null, mejorD = radio;
    for (const lote of this.lotes) {
      for (let i = 0; i < lote.n; i++) {
        lote.malla.getMatrixAt(i, this._matriz2);
        const e = this._matriz2.elements;
        const d = Math.hypot(e[12] - posicion.x, e[14] - posicion.z);
        if (d < mejorD) {
          mejorD = d;
          mejor = { esp: lote.esp, x: e[12], y: e[13], z: e[14], distancia: d };
        }
      }
    }
    return mejor;
  }

  dispose() {
    for (const l of this.lotes) { l.malla.geometry.dispose(); l.malla.material.dispose(); }
  }
}

// ── Impostores ──────────────────────────────────────────────────────────────

/**
 * Hornea una especie a una textura: se dibuja el árbol una sola vez de costado,
 * con luz neutra, y esa imagen se usa después como cartelera.
 *
 * El bakeo usa un material propio, sin la inyección de viento, porque aquella
 * lee instanceMatrix y acá se dibuja una malla suelta.
 */
function hornearImpostor(render, geometria, mapaFollaje) {
  const geo = geometria.clone();
  geo.computeBoundingBox();
  const caja = geo.boundingBox;
  const ancho = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z);
  const alto = caja.max.y - caja.min.y;
  const centroY = (caja.max.y + caja.min.y) / 2;

  const mat = new THREE.MeshStandardMaterial({
    map: mapaFollaje,
    vertexColors: true,
    alphaTest: 0.28,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0,
  });
  const malla = new THREE.Mesh(geo, mat);

  const escena = new THREE.Scene();
  escena.add(malla);
  // Luz neutra y pareja: la iluminación real la aplica el shader de la
  // cartelera. Si se horneara con el sol del momento, todos los árboles
  // lejanos quedarían congelados a esa hora del día.
  const sol = new THREE.DirectionalLight(0xffffff, 2.1);
  sol.position.set(0.6, 0.8, 1.0);
  escena.add(sol);
  escena.add(new THREE.AmbientLight(0xffffff, 1.05));

  // Atlas de vistas: el árbol se hornea desde ocho azimuts repartidos alrededor
  // del eje vertical, en una grilla de 4 × 2. Con una sola vista, al rodear un
  // árbol lejano su perfil no cambiaba nunca y se notaba que era un cartel.
  const COLS = 4, FILAS = 2;
  const VISTAS = COLS * FILAS;
  const anchoTeja = 128, altoTeja = 192;

  const objetivo = new THREE.WebGLRenderTarget(anchoTeja * COLS, altoTeja * FILAS, {
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    colorSpace: THREE.SRGBColorSpace,
  });

  const camara = new THREE.OrthographicCamera(
    -ancho / 2, ancho / 2, alto / 2, -alto / 2, 0.1, (ancho + alto) * 6
  );
  const distancia = (ancho + alto) * 2;

  const objetivoPrevio = render.getRenderTarget();
  const colorPrevio = new THREE.Color();
  render.getClearColor(colorPrevio);
  const alfaPrevia = render.getClearAlpha();
  const autoLimpiarPrevio = render.autoClear;

  render.setRenderTarget(objetivo);
  render.setClearColor(0x000000, 0);
  render.clear();
  render.autoClear = false;

  for (let i = 0; i < VISTAS; i++) {
    // Azimut de la vista i, con el mismo convenio que usa el shader:
    // ángulo = atan2(dx, dz) del vector que va del árbol a la cámara.
    const azimut = (i / VISTAS) * Math.PI * 2;
    camara.position.set(
      Math.sin(azimut) * distancia,
      centroY,
      Math.cos(azimut) * distancia
    );
    camara.lookAt(0, centroY, 0);

    const col = i % COLS;
    // El origen del viewport de WebGL está abajo a la izquierda
    const fila = FILAS - 1 - Math.floor(i / COLS);
    render.setViewport(col * anchoTeja, fila * altoTeja, anchoTeja, altoTeja);
    render.setScissor(col * anchoTeja, fila * altoTeja, anchoTeja, altoTeja);
    render.setScissorTest(true);
    render.render(escena, camara);
  }

  render.setScissorTest(false);
  render.autoClear = autoLimpiarPrevio;
  render.setRenderTarget(objetivoPrevio);
  render.setClearColor(colorPrevio, alfaPrevia);
  const tam = new THREE.Vector2();
  render.getSize(tam);
  render.setViewport(0, 0, tam.x, tam.y);

  geo.dispose();
  mat.dispose();

  return { textura: objetivo.texture, ancho, alto, objetivo, vistas: VISTAS, cols: COLS, filas: FILAS };
}

const VERT_IMPOSTOR = /* glsl */`
attribute vec3 iTinte;
uniform float uAncho;
uniform float uAlto;
uniform vec3 uCamara;
varying vec2 vUv;
varying vec3 vTinte;
varying float vDist;
varying float vAzimut;

void main() {
  vUv = uv;
  vTinte = iTinte;

  // Centro y escala de la instancia
  vec3 centro = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float escX = length(instanceMatrix[0].xyz);
  float escY = length(instanceMatrix[1].xyz);

  // Azimut desde el que se está mirando este árbol. Mismo convenio que el
  // horneado: atan2(dx, dz) del vector que va del árbol a la cámara.
  vec3 haciaCamara = uCamara - centro;
  vAzimut = atan(haciaCamara.x, haciaCamara.z);

  // Cartelera cilíndrica: gira sólo alrededor del eje vertical. Si girara
  // libremente, al mirar hacia arriba los árboles lejanos se acostarían.
  vec3 derecha = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  derecha.y = 0.0;
  derecha = normalize(derecha);

  vec3 mundo = centro
    + derecha * (position.x * uAncho * escX)
    + vec3(0.0, 1.0, 0.0) * (position.y * uAlto * escY);

  vec4 vista = viewMatrix * vec4(mundo, 1.0);
  vDist = -vista.z;
  gl_Position = projectionMatrix * vista;
}
`;

const FRAG_IMPOSTOR = /* glsl */`
uniform sampler2D uMapa;
uniform vec3 uColorSol;
uniform float uIntensidadSol;
uniform vec3 uAmbiente;
uniform vec3 uNiebla;
uniform float uDensidadNiebla;
uniform vec3 uColorOtono;
uniform float uEstacion;
uniform float uPerenne;
uniform float uCotaNieve;
uniform float uVistas;
uniform vec2 uRejilla;      // columnas, filas del atlas
varying vec2 vUv;
varying vec3 vTinte;
varying float vDist;
varying float vAzimut;

const float TAU = 6.2831853;

/** UV dentro de la teja i del atlas, con margen para que no sangre la vecina. */
vec2 uvDeVista(float i, vec2 local) {
  float col = mod(i, uRejilla.x);
  float fila = floor(i / uRejilla.x);
  vec2 tam = 1.0 / uRejilla;
  // Un texel y medio de margen: el filtrado bilineal de los mipmaps arrastra
  // color de la teja de al lado y aparecen costuras verticales.
  vec2 margen = tam * 0.012;
  vec2 base = vec2(col, fila) * tam;
  return base + margen + local * (tam - margen * 2.0);
}

void main() {
  // Vista continua correspondiente al ángulo de cámara
  float t = (mod(vAzimut, TAU) / TAU) * uVistas;
  float i0 = floor(t);
  float mezcla = t - i0;

  // La mezcla se endurece cerca de los extremos: así se ve una vista nítida la
  // mayor parte del giro y el cruce ocurre rápido, en vez de mostrar dos
  // árboles fantasma superpuestos todo el tiempo.
  float k = smoothstep(0.28, 0.72, mezcla);

  // Fuera de la franja de cruce sobra una de las dos muestras. El azimut es
  // constante por instancia, así que el árbol entero toma la misma rama y el
  // ahorro es real: son dos accesos a textura por fragmento contra uno.
  vec4 texel;
  if (k <= 0.0) {
    texel = texture2D(uMapa, uvDeVista(mod(i0, uVistas), vUv));
  } else if (k >= 1.0) {
    texel = texture2D(uMapa, uvDeVista(mod(i0 + 1.0, uVistas), vUv));
  } else {
    vec4 a = texture2D(uMapa, uvDeVista(mod(i0, uVistas), vUv));
    vec4 b = texture2D(uMapa, uvDeVista(mod(i0 + 1.0, uVistas), vUv));
    texel = mix(a, b, k);
  }
  if (texel.a < 0.32) discard;

  vec3 color = texel.rgb * vTinte;

  // Otoño: los caducifolios viran igual que en la malla completa, así la
  // transición entre cartelera y árbol real no salta de color.
  float otonal = clamp(1.0 - abs(uEstacion - 1.0), 0.0, 1.0) * (1.0 - uPerenne);
  color = mix(color, uColorOtono, otonal * 0.82);
  float invernal = clamp(1.0 - abs(uEstacion - 2.0), 0.0, 1.0) * (1.0 - uPerenne);
  color = mix(color, vec3(0.32, 0.26, 0.20), invernal * 0.62);

  color *= uAmbiente + uColorSol * uIntensidadSol * 0.42;

  float f = 1.0 - exp(-uDensidadNiebla * uDensidadNiebla * vDist * vDist);
  color = mix(color, uNiebla, clamp(f, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Textura de follaje ──────────────────────────────────────────────────────

/**
 * Atlas de follaje dibujado a mano alzada en un lienzo.
 *
 * Los racimos de icosaedros sólidos daban esa silueta de goma de mascar que
 * delata a un prototipo. Un árbol real no tiene contorno liso: tiene miles de
 * huecos por donde pasa el cielo. Se resuelve con tarjetas recortadas por alfa,
 * que además salen más baratas que los sólidos que reemplazan.
 *
 * La esquina inferior derecha queda opaca a propósito: los troncos y las ramas
 * apuntan sus UV ahí y así comparten material con las hojas, que es lo que
 * permite dibujar el árbol entero en una sola instancia.
 */
const _atlasCache = new Map();

export function atlasFollaje(clase) {
  if (_atlasCache.has(clase)) return _atlasCache.get(clase);

  const N = 512;
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = N;
  const c = lienzo.getContext('2d');
  c.clearRect(0, 0, N, N);

  const azar = (a, b) => a + Math.random() * (b - a);

  if (clase === 'aguja') {
    // Conífera: ramillas con acículas a ambos lados del raquis
    for (let r = 0; r < 54; r++) {
      const x0 = azar(0.05, 0.95) * N, y0 = azar(0.05, 0.95) * N;
      const ang = azar(0, Math.PI * 2);
      const largo = azar(0.10, 0.22) * N;
      // Claro a proposito: el tinte de la especie lo aporta el color por
      // vertice, y si el atlas tambien viniera oscuro se multiplicarian entre
      // si y el bosque quedaria negro.
      const verde = Math.floor(azar(190, 250));
      c.strokeStyle = `rgba(${Math.floor(verde * 0.72)},${verde},${Math.floor(verde * 0.70)},1)`;
      c.lineWidth = azar(1.6, 2.8);
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + Math.cos(ang) * largo, y0 + Math.sin(ang) * largo);
      c.stroke();
      const nAgujas = Math.floor(largo / 5);
      for (let i = 0; i < nAgujas; i++) {
        const t = i / nAgujas;
        const px = x0 + Math.cos(ang) * largo * t;
        const py = y0 + Math.sin(ang) * largo * t;
        const lAg = azar(3.5, 7.5) * (1 - t * 0.35);
        for (const lado of [-1, 1]) {
          const a2 = ang + lado * azar(0.7, 1.25);
          c.lineWidth = azar(1.0, 1.9);
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + Math.cos(a2) * lAg, py + Math.sin(a2) * lAg);
          c.stroke();
        }
      }
    }
  } else {
    // Latifoliada (Nothofagus): hojas ovales pequeñas y apretadas
    for (let i = 0; i < 620; i++) {
      const x = azar(0.03, 0.97) * N, y = azar(0.03, 0.97) * N;
      const rx = azar(4.5, 9.5), ry = rx * azar(0.52, 0.82);
      const ang = azar(0, Math.PI * 2);
      const verde = Math.floor(azar(185, 252));
      const rojo = Math.floor(verde * azar(0.62, 0.88));
      const azul = Math.floor(verde * azar(0.58, 0.82));
      c.fillStyle = `rgba(${rojo},${verde},${azul},1)`;
      c.beginPath();
      c.ellipse(x, y, rx, ry, ang, 0, Math.PI * 2);
      c.fill();
      // Nervadura central: da textura al mirar de cerca
      c.strokeStyle = `rgba(${Math.min(255, Math.floor(rojo * 0.78))},${Math.min(255, Math.floor(verde * 0.80))},${Math.floor(azul * 0.75)},0.5)`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - Math.cos(ang) * rx, y - Math.sin(ang) * rx);
      c.lineTo(x + Math.cos(ang) * rx, y + Math.sin(ang) * rx);
      c.stroke();
    }
  }

  // Reserva opaca para troncos y ramas
  c.fillStyle = '#ffffff';
  c.fillRect(N * 0.90, N * 0.90, N * 0.10, N * 0.10);

  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  _atlasCache.set(clase, tex);
  return tex;
}

/**
 * UV del parche opaco, para la madera.
 *
 * La V va en 0,05 y no en 0,95 porque three invierte la textura en el eje Y
 * (flipY): el parche que se dibuja abajo a la derecha del lienzo termina
 * arriba a la derecha en coordenadas de textura. Con 0,95 los troncos
 * muestreaban una zona transparente y el recorte por alfa los hacía desaparecer
 * enteros.
 */
const UV_MADERA = [0.95, 0.05];

/**
 * Tarjetas de follaje repartidas en el volumen de la copa.
 *
 * La normal de cada tarjeta no es la de su plano sino la que va del centro de
 * la copa hacia afuera. Es un engaño deliberado: hace que la copa se ilumine
 * como un volumen redondo en vez de como un montón de carteles planos, que es
 * lo que delata a los árboles baratos.
 */
function tarjetasFollaje({ centro, radioH, radioV, cantidad, tamano, color, variacion = 0.2, aplanar = 1 }) {
  const pos = [], nor = [], uv = [], col = [], flx = [], idx = [];
  let v = 0;
  const c = new THREE.Color();

  for (let i = 0; i < cantidad; i++) {
    // Punto dentro del elipsoide de la copa, con sesgo hacia la superficie
    const u = Math.random() * Math.PI * 2;
    const w = Math.acos(2 * Math.random() - 1);
    const rad = Math.pow(Math.random(), 0.45);
    const px = centro.x + Math.sin(w) * Math.cos(u) * radioH * rad;
    const pz = centro.z + Math.sin(w) * Math.sin(u) * radioH * rad;
    const py = centro.y + Math.cos(w) * radioV * rad;

    // Normal hacia afuera de la copa
    let nx = px - centro.x, ny = (py - centro.y) * aplanar, nz = pz - centro.z;
    const ln = Math.hypot(nx, ny, nz) || 1;
    nx /= ln; ny = ny / ln + 0.35; nz /= ln;
    const ln2 = Math.hypot(nx, ny, nz) || 1;
    nx /= ln2; ny /= ln2; nz /= ln2;

    const s = tamano * (0.62 + Math.random() * 0.8);
    const giro = Math.random() * Math.PI * 2;
    const inclina = (Math.random() - 0.5) * 1.1;

    // Base ortonormal de la tarjeta
    const ex = Math.cos(giro), ez = Math.sin(giro);
    const ux = ex * s, uz = ez * s;
    const vx = -ez * Math.sin(inclina) * s, vy = Math.cos(inclina) * s, vz = ex * Math.sin(inclina) * s;

    const esquinas = [
      [px - ux - vx, py - vy, pz - uz - vz],
      [px + ux - vx, py - vy, pz + uz - vz],
      [px + ux + vx, py + vy, pz + uz + vz],
      [px - ux + vx, py + vy, pz - uz + vz],
    ];
    // Ventana del atlas: cada tarjeta toma un recorte distinto
    const u0 = Math.random() * 0.55, v0 = Math.random() * 0.55;
    const uw = 0.30 + Math.random() * 0.14;
    const uvs = [[u0, v0], [u0 + uw, v0], [u0 + uw, v0 + uw], [u0, v0 + uw]];

    const brillo = 1 + (Math.random() - 0.5) * variacion * 2;
    c.copy(color).multiplyScalar(brillo);

    for (let k = 0; k < 4; k++) {
      pos.push(esquinas[k][0], esquinas[k][1], esquinas[k][2]);
      nor.push(nx, ny, nz);
      uv.push(uvs[k][0], uvs[k][1]);
      col.push(c.r, c.g, c.b);
      flx.push(1);
    }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aFlexion', new THREE.Float32BufferAttribute(flx, 1));
  g.setIndex(idx);
  return g;
}

// ── Geometría procedural ────────────────────────────────────────────────────

/**
 * Construye una planta según su arquetipo. No son modelos genéricos: el coihue
 * arma una copa ancha y horizontal, el ciprés una columna cónica, el ñire crece
 * retorcido y bajo, y la caña colihue es un haz de varas verticales.
 */
function construirPlanta(esp) {
  const partes = [];
  const alturaRef = (esp.alturaMinM + esp.alturaMaxM) / 2;
  const colTronco = new THREE.Color(esp.colorTronco || '#4a3b30');
  const colHoja = new THREE.Color(esp.colorHojaVerano || '#2d5a2a');

  const arquetipo = clasificar(esp);

  if (arquetipo === 'cana') {
    // Haz de cañas: la colihue forma matas densas e impenetrables
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const r = Math.random() * 0.5;
      const h = alturaRef * (0.6 + Math.random() * 0.6);
      const g = new THREE.CylinderGeometry(0.012, 0.022, h, 4, 1);
      g.translate(0, h / 2, 0);
      const incl = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler((Math.random() - 0.5) * 0.3, a, (Math.random() - 0.5) * 0.3)
      );
      g.applyMatrix4(incl);
      g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      pintar(g, colHoja, 0.75);
      partes.push(g);
      // Hojas lanceoladas cerca de la punta
      for (let j = 0; j < 3; j++) {
        const hoja = new THREE.PlaneGeometry(0.5, 0.09);
        hoja.translate(0.25, 0, 0);
        hoja.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(
          new THREE.Euler(0, Math.random() * 6.28, -0.3 - Math.random() * 0.5)
        ));
        hoja.translate(Math.cos(a) * r, h * (0.6 + j * 0.13), Math.sin(a) * r);
        pintar(hoja, colHoja, 1.0, 0, 'hoja');
        partes.push(hoja);
      }
    }
    return fusionar(partes);
  }

  // ── Tronco con conicidad y curvatura leve
  const alturaTronco = arquetipo === 'arbusto' ? alturaRef * 0.28 : alturaRef * 0.52;
  const radioBase = Math.max(0.05, alturaRef * (arquetipo === 'arbusto' ? 0.020 : 0.032));
  const segmentos = 7;
  const tronco = troncoCurvo(radioBase, radioBase * 0.32, alturaTronco, segmentos,
    arquetipo === 'retorcido' ? 0.32 : 0.09);
  pintar(tronco, colTronco, 0.0);
  partes.push(tronco);

  // ── Ramas
  const nRamas = arquetipo === 'columnar' ? 0 : (arquetipo === 'arbusto' ? 5 : 7);
  for (let i = 0; i < nRamas; i++) {
    const t = 0.42 + (i / Math.max(1, nRamas)) * 0.55;
    const ang = (i / nRamas) * Math.PI * 2 + Math.random() * 0.9;
    // El largo se deriva del alcance de la copa, no del tronco. Antes eran
    // proporcionales al tronco y en el coihue sobrepasaban el follaje: quedaban
    // patas de araña oscuras asomando contra el cielo, que era lo que más
    // delataba a los árboles de lejos. Una rama que termina dentro de la copa
    // no se ve, y ésa es exactamente la idea.
    const elevacion = arquetipo === 'copa_ancha' ? 0.95 : 0.55;
    const alcanceCopa = alturaRef * (arquetipo === 'copa_ancha' ? 0.30 : 0.16);
    const largo = (alcanceCopa / Math.max(0.3, Math.sin(elevacion))) * (0.7 + Math.random() * 0.5);
    const g = new THREE.CylinderGeometry(radioBase * 0.10, radioBase * 0.26, largo, 4, 1);
    g.translate(0, largo / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0, -elevacion)));
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(ang));
    g.translate(0, alturaTronco * t, 0);
    pintar(g, colTronco, 0.0);
    partes.push(g);
  }

  // ── Follaje en tarjetas recortadas
  const cumbre = alturaTronco;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  if (arquetipo === 'columnar') {
    // Ciprés de la cordillera: columna angosta que se afina hacia la punta
    const capas = 7;
    for (let i = 0; i < capas; i++) {
      const t = i / (capas - 1);
      const y = cumbre * 0.16 + t * alturaRef * 0.84;
      const r = (1 - t * 0.82) * alturaRef * 0.15 + 0.12;
      partes.push(tarjetasFollaje({
        centro: V3(0, y, 0),
        radioH: r, radioV: alturaRef * 0.09,
        cantidad: 12, tamano: alturaRef * 0.075,
        color: colHoja, variacion: 0.16, aplanar: 1.6,
      }));
    }
  } else if (arquetipo === 'copa_ancha') {
    // Coihue: copa amplia y aparasolada, con la masa repartida en lóbulos
    const lobulos = 5;
    for (let i = 0; i < lobulos; i++) {
      const a = (i / lobulos) * Math.PI * 2 + Math.random() * 0.8;
      const r = alturaRef * (0.10 + Math.random() * 0.16);
      partes.push(tarjetasFollaje({
        centro: V3(Math.cos(a) * r, cumbre + alturaRef * (0.10 + Math.random() * 0.26), Math.sin(a) * r),
        radioH: alturaRef * 0.20, radioV: alturaRef * 0.11,
        cantidad: 34, tamano: alturaRef * 0.105,
        color: colHoja, variacion: 0.19, aplanar: 0.55,
      }));
    }
  } else if (arquetipo === 'retorcido') {
    // Ñire y lenga: masas bajas, densas y desparejas
    const lobulos = 4;
    for (let i = 0; i < lobulos; i++) {
      const a = (i / lobulos) * Math.PI * 2 + Math.random() * 0.9;
      const r = alturaRef * Math.random() * 0.20;
      partes.push(tarjetasFollaje({
        centro: V3(Math.cos(a) * r, cumbre * 0.82 + alturaRef * (0.08 + Math.random() * 0.24), Math.sin(a) * r),
        radioH: alturaRef * 0.19, radioV: alturaRef * 0.14,
        cantidad: 28, tamano: alturaRef * 0.10,
        color: colHoja, variacion: 0.21, aplanar: 0.8,
      }));
    }
  } else {
    // Arbusto: una sola mata redondeada
    partes.push(tarjetasFollaje({
      centro: V3(0, cumbre * 0.72 + alturaRef * 0.26, 0),
      radioH: alturaRef * 0.28, radioV: alturaRef * 0.22,
      cantidad: 26, tamano: alturaRef * 0.15,
      color: colHoja, variacion: 0.22, aplanar: 0.9,
    }));
  }

  return fusionar(partes);
}

function clasificar(esp) {
  const id = esp.id || '';
  if (esp.tipo === 'cana') return 'cana';
  if (/cipres|alerce|pino|conifer/.test(id)) return 'columnar';
  if (esp.tipo === 'arbusto') return 'arbusto';
  if (/nire|lenga|maiten|retorc/.test(id)) return 'retorcido';
  if (esp.alturaMaxM >= 18) return 'copa_ancha';
  return 'retorcido';
}

/** Tronco con conicidad y una curvatura acumulada. */
function troncoCurvo(rBase, rTope, altura, segs, curvatura) {
  const g = new THREE.CylinderGeometry(rTope, rBase, altura, 6, segs);
  g.translate(0, altura / 2, 0);
  const pos = g.attributes.position;
  const dirX = Math.cos(Math.random() * 6.28), dirZ = Math.sin(Math.random() * 6.28);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / altura;
    const desvio = t * t * curvatura * altura * 0.5;
    pos.setX(i, pos.getX(i) + dirX * desvio);
    pos.setZ(i, pos.getZ(i) + dirZ * desvio);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Asigna color, peso de flexión al viento (0 tronco rígido, 1 hoja suelta) y
 * coordenadas de textura.
 *
 * La madera apunta al parche opaco del atlas: así el tronco y las hojas
 * comparten un solo material y el árbol entero se dibuja de una sola vez.
 */
function pintar(geo, color, flexion, variacion = 0, modoUV = 'madera') {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const flex = new Float32Array(n);
  const uv = new Float32Array(n * 2);
  const c = color.clone();

  const u0 = Math.random() * 0.55, v0 = Math.random() * 0.55;
  const uw = 0.28 + Math.random() * 0.14;
  const uvOriginal = geo.attributes.uv;

  for (let i = 0; i < n; i++) {
    const v = variacion ? 1 + (Math.random() - 0.5) * variacion * 2 : 1;
    col[i * 3] = c.r * v;
    col[i * 3 + 1] = c.g * v;
    col[i * 3 + 2] = c.b * v;
    flex[i] = flexion;

    if (modoUV === 'madera') {
      uv[i * 2] = UV_MADERA[0];
      uv[i * 2 + 1] = UV_MADERA[1];
    } else {
      // Recorte del atlas, respetando la parametrización original de la pieza
      const su = uvOriginal ? uvOriginal.getX(i) : (i % 2);
      const sv = uvOriginal ? uvOriginal.getY(i) : ((i >> 1) % 2);
      uv[i * 2] = u0 + su * uw;
      uv[i * 2 + 1] = v0 + sv * uw;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFlexion', new THREE.BufferAttribute(flex, 1));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function fusionar(geos) {
  // Fusión manual: mergeGeometries exige atributos idénticos y acá los controlamos
  let totalVerts = 0, totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const nor = new Float32Array(totalVerts * 3);
  const col = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const flx = new Float32Array(totalVerts);
  const idx = new Uint32Array(totalIdx);

  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, nAttr = g.attributes.normal;
    const c = g.attributes.color, f = g.attributes.aFlexion;
    const u = g.attributes.uv;
    const cnt = p.count;
    pos.set(p.array.subarray(0, cnt * 3), vo * 3);
    if (nAttr) nor.set(nAttr.array.subarray(0, cnt * 3), vo * 3);
    col.set(c.array.subarray(0, cnt * 3), vo * 3);
    if (u) uvs.set(u.array.subarray(0, cnt * 2), vo * 2);
    flx.set(f.array.subarray(0, cnt), vo);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < cnt; i++) idx[io + i] = i + vo;
      io += cnt;
    }
    vo += cnt;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setAttribute('aFlexion', new THREE.BufferAttribute(flx, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** Inyecta el balanceo por viento y el tinte estacional en el material estándar. */
function inyectarViento(mat, uniformes, esp) {
  const perenne = esp.perenne !== false;
  const colOtono = new THREE.Color(esp.colorHojaOtono || esp.colorHojaVerano || '#8a4a1e');

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.uniforms.uColorOtono = { value: colOtono };
    shader.uniforms.uPerenne = { value: perenne ? 1 : 0 };

    shader.vertexShader = `
      attribute float aFlexion;
      attribute vec3 iTinte;
      uniform float uTiempo;
      uniform vec2 uViento;
      uniform float uFuerzaViento;
      varying vec3 vTinte;
      varying float vAlturaLocal;
      // Varying propio: apoyarse en vWorldPosition de three es frágil, porque
      // sólo existe según qué chunks estén activos y CSM lo declara únicamente
      // en el vértice, no en el fragmento.
      varying float vAlturaMundo;
      varying float vFlexion;      // 1 = hoja, 0 = tronco
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vTinte = iTinte;
      vAlturaLocal = position.y;
      vFlexion = aFlexion;

      // Balanceo: dos armónicos desfasados por la posición del árbol, para que
      // el bosque no se mueva como un solo bloque.
      vec3 origen = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float fase = origen.x * 0.09 + origen.z * 0.13;
      float t = uTiempo * 1.35 + fase;
      float rafaga = 0.62 + 0.38 * sin(uTiempo * 0.31 + fase * 0.4);
      float amplitud = aFlexion * uFuerzaViento * rafaga;

      // La flexión crece con la altura sobre el suelo: el tronco casi no se mueve
      float palanca = pow(max(0.0, position.y) * 0.09, 1.4);
      float balanceo = (sin(t) * 0.7 + sin(t * 2.31 + 1.1) * 0.3) * amplitud * palanca;

      transformed.x += uViento.x * balanceo;
      transformed.z += uViento.y * balanceo;
      // Aleteo fino de la hoja, perpendicular a la ráfaga
      transformed.y += sin(t * 3.7 + position.x * 2.1) * amplitud * palanca * 0.16;

      vAlturaMundo = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
      `
    );

    shader.fragmentShader = `
      uniform float uEstacion;
      uniform vec3 uColorOtono;
      uniform float uPerenne;
      uniform float uCotaNieve;
      varying vec3 vTinte;
      varying float vAlturaLocal;
      varying float vAlturaMundo;
      varying float vFlexion;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      // Los hex de la base de datos describen la hoja en sombra, no bajo el sol
      // patagónico de mediodía: sin este realce el bosque se ve apagado.
      diffuseColor.rgb *= vTinte * 1.45;

      // Otoño: los Nothofagus caducifolios viran a rojo y naranja. Es el
      // espectáculo que llena de gente los cerros en abril.
      float otonal = clamp(1.0 - abs(uEstacion - 1.0), 0.0, 1.0) * (1.0 - uPerenne);
      diffuseColor.rgb = mix(diffuseColor.rgb, uColorOtono, otonal * 0.82);

      // Invierno: los caducifolios pierden saturación antes de quedar desnudos
      float invernal = clamp(1.0 - abs(uEstacion - 2.0), 0.0, 1.0) * (1.0 - uPerenne);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.26, 0.20), invernal * 0.62);

      // Nieve acumulada sobre el follaje alto
      float nieveAqui = smoothstep(uCotaNieve - 120.0, uCotaNieve + 120.0, vAlturaMundo);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.94),
                             nieveAqui * smoothstep(0.4, 2.5, vAlturaLocal) * 0.72);
      `
    );

    // Translucidez foliar. La lámina de la hoja deja pasar luz, así que el
    // envés iluminado por detrás no queda negro. Es lo que hace que un bosque
    // real se vea verde y no como una silueta recortada.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.19, 0.26, 0.16) * vFlexion;
      `
    );

  };

}

// Ruido de valor simple para los claros del bosque
function ruidoValor(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => {
    let n = a * 374761393 + b * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
  };
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v)
       + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
