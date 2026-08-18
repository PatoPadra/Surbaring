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
const MAX_POR_ESPECIE = 9000;

export class Vegetacion {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   * @param {{especies: Array, biomas: Array}} flora
   */
  constructor(mundo, flora) {
    this.mundo = mundo;
    this.flora = flora;
    this.grupo = new THREE.Group();
    this.grupo.name = 'vegetacion';

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
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
      alphaTest: 0.42,
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
    return { esp, malla, colores, n: 0 };
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

  /** Repuebla si el jugador cambió de celda. */
  actualizar(posicion, tiempo, estado) {
    this.uniformes.uTiempo.value = tiempo;
    const rad = (estado.direccionViento ?? 270) * Math.PI / 180;
    this.uniformes.uViento.value.set(Math.sin(rad), -Math.cos(rad));
    this.uniformes.uFuerzaViento.value = Math.min(1.8, 0.12 + (estado.vientoKmh ?? 20) / 48);
    this.uniformes.uEstacion.value = estado.estacionContinua ?? 0;
    this.uniformes.uCotaNieve.value = estado.cotaNieve ?? 1750;
    this.uniformes.uNieve.value = estado.nieve > 0.05 ? 1 : 0;

    const cx = Math.floor(posicion.x / TAM_CELDA);
    const cz = Math.floor(posicion.z / TAM_CELDA);
    if (cx === this._celdaActual.x && cz === this._celdaActual.z) return;
    this._celdaActual = { x: cx, z: cz };
    this._sembrar(cx, cz);
  }

  _sembrar(cx, cz) {
    const m = this.mundo;
    for (const lote of this.lotes) lote.n = 0;

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
          if (lote.n >= MAX_POR_ESPECIE) continue;

          // Claros del bosque: ruido de baja frecuencia abre huecos naturales
          const claro = ruidoValor(x * 0.0042, z * 0.0042);
          if (claro < 0.24) continue;

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
          this._matriz.compose(this._pos, this._cua, this._esc);
          lote.malla.setMatrixAt(lote.n, this._matriz);

          // Tinte: verdes más oscuros en umbría, más claros al sol
          const v = 0.82 + azar() * 0.36;
          color.setRGB(v * (0.92 + azar() * 0.16), v, v * (0.88 + azar() * 0.2));
          lote.colores.setXYZ(lote.n, color.r, color.g, color.b);

          lote.n++;
          total++;
        }
      }
    }

    for (const lote of this.lotes) {
      lote.malla.count = lote.n;
      lote.malla.instanceMatrix.needsUpdate = true;
      lote.colores.needsUpdate = true;
      lote.malla.computeBoundingSphere();
    }
    this.totalInstancias = total;
  }

  dispose() {
    for (const l of this.lotes) { l.malla.geometry.dispose(); l.malla.material.dispose(); }
  }
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
        pintar(hoja, colHoja, 1.0);
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
    const largo = alturaTronco * (0.42 + Math.random() * 0.4) * (arquetipo === 'copa_ancha' ? 1.5 : 1);
    const g = new THREE.CylinderGeometry(radioBase * 0.10, radioBase * 0.26, largo, 4, 1);
    g.translate(0, largo / 2, 0);
    const elevacion = arquetipo === 'copa_ancha' ? 0.95 : 0.55;
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0, -elevacion)));
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(ang));
    g.translate(0, alturaTronco * t, 0);
    pintar(g, colTronco, 0.0);
    partes.push(g);
  }

  // ── Follaje
  const cumbre = alturaTronco;
  if (arquetipo === 'columnar') {
    // Ciprés de la cordillera: columna de conos apilados
    const capas = 9;
    for (let i = 0; i < capas; i++) {
      const t = i / (capas - 1);
      const y = cumbre * 0.20 + t * alturaRef * 0.80;
      const r = (1 - t) * alturaRef * 0.16 + 0.18;
      const g = new THREE.ConeGeometry(r, alturaRef * 0.20, 7, 1);
      g.translate(0, y, 0);
      pintar(g, colHoja, 1.0, 0.13);
      partes.push(g);
    }
  } else if (arquetipo === 'copa_ancha') {
    // Coihue: copa amplia, horizontal, en pisos
    const racimos = 16;
    for (let i = 0; i < racimos; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.55) * alturaRef * 0.34;
      const y = cumbre + Math.random() * alturaRef * 0.40;
      const tam = alturaRef * (0.13 + Math.random() * 0.10);
      const g = new THREE.IcosahedronGeometry(tam, 0);
      g.scale(1.25, 0.62, 1.25);
      g.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      pintar(g, colHoja, 1.0, 0.16);
      partes.push(g);
    }
  } else if (arquetipo === 'retorcido') {
    // Ñire y lenga achaparrada: masas bajas y densas
    const racimos = 11;
    for (let i = 0; i < racimos; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * alturaRef * 0.30;
      const y = cumbre * 0.75 + Math.random() * alturaRef * 0.34;
      const tam = alturaRef * (0.14 + Math.random() * 0.11);
      const g = new THREE.IcosahedronGeometry(tam, 0);
      g.scale(1.1, 0.78, 1.1);
      g.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      pintar(g, colHoja, 1.0, 0.18);
      partes.push(g);
    }
  } else {
    // Arbusto: mata redondeada
    const racimos = 7;
    for (let i = 0; i < racimos; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * alturaRef * 0.26;
      const y = cumbre * 0.6 + Math.random() * alturaRef * 0.42;
      const tam = alturaRef * (0.19 + Math.random() * 0.13);
      const g = new THREE.IcosahedronGeometry(tam, 0);
      g.scale(1.05, 0.88, 1.05);
      g.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      pintar(g, colHoja, 1.0, 0.2);
      partes.push(g);
    }
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

/** Asigna color y el peso de flexión al viento (0 tronco rígido, 1 hoja suelta). */
function pintar(geo, color, flexion, variacion = 0) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const flex = new Float32Array(n);
  const c = color.clone();
  for (let i = 0; i < n; i++) {
    const v = variacion ? 1 + (Math.random() - 0.5) * variacion * 2 : 1;
    col[i * 3] = c.r * v;
    col[i * 3 + 1] = c.g * v;
    col[i * 3 + 2] = c.b * v;
    flex[i] = flexion;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFlexion', new THREE.BufferAttribute(flex, 1));
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
  const flx = new Float32Array(totalVerts);
  const idx = new Uint32Array(totalIdx);

  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, nAttr = g.attributes.normal;
    const c = g.attributes.color, f = g.attributes.aFlexion;
    const cnt = p.count;
    pos.set(p.array.subarray(0, cnt * 3), vo * 3);
    if (nAttr) nor.set(nAttr.array.subarray(0, cnt * 3), vo * 3);
    col.set(c.array.subarray(0, cnt * 3), vo * 3);
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
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vTinte = iTinte;
      vAlturaLocal = position.y;

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
      `
    );

    shader.fragmentShader = `
      uniform float uEstacion;
      uniform vec3 uColorOtono;
      uniform float uPerenne;
      uniform float uCotaNieve;
      varying vec3 vTinte;
      varying float vAlturaLocal;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      diffuseColor.rgb *= vTinte;

      // Otoño: los Nothofagus caducifolios viran a rojo y naranja. Es el
      // espectáculo que llena de gente los cerros en abril.
      float otonal = clamp(1.0 - abs(uEstacion - 1.0), 0.0, 1.0) * (1.0 - uPerenne);
      diffuseColor.rgb = mix(diffuseColor.rgb, uColorOtono, otonal * 0.82);

      // Invierno: los caducifolios pierden saturación antes de quedar desnudos
      float invernal = clamp(1.0 - abs(uEstacion - 2.0), 0.0, 1.0) * (1.0 - uPerenne);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.26, 0.20), invernal * 0.62);

      // Nieve acumulada sobre el follaje alto
      float nieveAqui = smoothstep(uCotaNieve - 120.0, uCotaNieve + 120.0, vWorldPosition.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.94),
                             nieveAqui * smoothstep(0.4, 2.5, vAlturaLocal) * 0.72);
      `
    );

    // vWorldPosition sólo existe si hay niebla o sombras; lo garantizamos
    if (!shader.vertexShader.includes('vWorldPosition')) {
      shader.vertexShader = 'varying vec3 vWorldPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\n vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = 'varying vec3 vWorldPosition;\n' + shader.fragmentShader;
    }
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
