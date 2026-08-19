/**
 * Sotobosque — cubierta de suelo.
 *
 * Es lo que separa un terreno de un lugar. Sin pasto, matas, piedras sueltas y
 * troncos caídos, el suelo se lee como una superficie pintada por más detalle
 * que tenga el sombreado.
 *
 * Cada tipo sigue la ecología de la región: el coirón amarillea en la estepa
 * seca del este, los helechos sólo prosperan en la sombra húmeda del bosque
 * valdiviano, las piedras asoman en las pendientes y por encima de la línea de
 * bosque, y los troncos caídos sólo aparecen donde hay bosque que los produzca.
 *
 * Nada de esto proyecta sombra: con cuatro cascadas, cada sombra cuesta cuatro
 * dibujos, y una mata de coirón no aporta nada a cambio.
 */

import * as THREE from 'three';

const TAM_CELDA = 16;          // metros por celda de siembra
const RADIO_CERCA = 4;         // celdas para pasto y helechos (64 m)
const RADIO_LEJOS = 7;         // celdas para piedras y troncos (112 m)
const RADIO_HORIZONTE = 12;    // celdas para el pastizal grueso (192 m)
const MAX_INSTANCIAS = 30000;

export class Sotobosque {
  /**
   * @param {import('./Mundo.js').Mundo} mundo
   */
  constructor(mundo) {
    this.mundo = mundo;
    this.grupo = new THREE.Group();
    this.grupo.name = 'sotobosque';

    this.uniformes = {
      uTiempo: { value: 0 },
      uViento: { value: new THREE.Vector2(0.9, 0.3) },
      uFuerzaViento: { value: 0.35 },
      uEstacion: { value: 0 },
      uCotaNieve: { value: 1750 },
    };

    this.tipos = [
      {
        id: 'coiron',
        nombre: 'Coirón',
        geo: () => matoja(0.42, 16, 0.050, 0.34),
        color: 0x9a8c52, colorAlt: 0x6f7a3e,
        radio: RADIO_CERCA, porCelda: 340, flexible: true,
        // Pastizal: manda en la estepa, escasea bajo el dosel cerrado
        apto: (alt, hum, pend) => alt < 1750 && pend < 38
          ? (1.25 - hum) * (1 - pend / 55) : 0,
      },
      {
        id: 'pasto_humedo',
        nombre: 'Pastizal húmedo',
        geo: () => matoja(0.32, 18, 0.044, 0.30),
        color: 0x4e7a34, colorAlt: 0x355e26,
        radio: RADIO_CERCA, porCelda: 300, flexible: true,
        apto: (alt, hum, pend) => alt < 1500 && pend < 34 && hum > 0.42
          ? (hum - 0.35) * 1.7 * (1 - pend / 50) : 0,
      },
      // ── Segundo escalón: el anillo entre 64 y 192 m ────────────────────
      // Más allá del radio cercano el suelo quedaba pelado y se veía un borde
      // de pasto siguiendo al jugador. Acá van champas más grandes y mucho más
      // ralas: a esa distancia una mata ocupa pocos píxeles y lo que importa es
      // que el suelo tenga textura, no que cada hoja sea correcta.
      {
        id: 'coiron_lejos',
        nombre: 'Coirón (lejano)',
        geo: () => matoja(0.52, 7, 0.085, 0.95),
        color: 0x9a8c52, colorAlt: 0x6f7a3e,
        radio: RADIO_HORIZONTE, radioMin: RADIO_CERCA, porCelda: 34, flexible: true,
        apto: (alt, hum, pend) => alt < 1750 && pend < 38
          ? (1.25 - hum) * (1 - pend / 55) : 0,
      },
      {
        id: 'pasto_lejos',
        nombre: 'Pastizal húmedo (lejano)',
        geo: () => matoja(0.42, 8, 0.078, 0.88),
        color: 0x4e7a34, colorAlt: 0x355e26,
        radio: RADIO_HORIZONTE, radioMin: RADIO_CERCA, porCelda: 30, flexible: true,
        apto: (alt, hum, pend) => alt < 1500 && pend < 34 && hum > 0.42
          ? (hum - 0.35) * 1.7 * (1 - pend / 50) : 0,
      },
      {
        id: 'helecho',
        nombre: 'Helecho',
        geo: () => helecho(0.62),
        color: 0x2f5f2a, colorAlt: 0x24491f,
        radio: RADIO_CERCA, porCelda: 55, flexible: true,
        // Sombra húmeda del bosque valdiviano
        apto: (alt, hum, pend) => alt < 1200 && hum > 0.48 && pend < 32
          ? (hum - 0.44) * 2.2 : 0,
      },
      {
        id: 'michay',
        nombre: 'Michay',
        geo: () => arbustillo(0.70),
        color: 0x35502c, colorAlt: 0x4a5a22,
        radio: RADIO_CERCA, porCelda: 16, flexible: true,
        apto: (alt, hum, pend) => alt < 1600 && pend < 40 ? 0.55 * (1 - Math.abs(hum - 0.5) * 1.4) : 0,
      },
      {
        id: 'piedra',
        nombre: 'Piedra suelta',
        geo: () => piedra(0.42),
        color: 0x7d7669, colorAlt: 0x5a544b,
        radio: RADIO_LEJOS, porCelda: 9, flexible: false,
        // Granito del batolito: pendiente y altura lo descubren
        apto: (alt, hum, pend) => 0.22 + pend / 45 + Math.max(0, (alt - 1400) / 900),
      },
      {
        id: 'tronco',
        nombre: 'Tronco caído',
        geo: () => tronco(3.4, 0.24),
        color: 0x4a3a2c, colorAlt: 0x36291f,
        radio: RADIO_LEJOS, porCelda: 0.8, flexible: false,
        // Sólo donde hay bosque que los produzca
        apto: (alt, hum, pend) => alt < 1600 && hum > 0.45 && pend < 30 ? (hum - 0.4) * 1.5 : 0,
      },
    ];

    this.lotes = this.tipos.map(t => this._crearLote(t));
    this._celda = { x: 9999, z: 9999 };
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._eje = new THREE.Vector3(0, 1, 0);
    this._normal = new THREE.Vector3();
    this._qGiro = new THREE.Quaternion();
    this._colorAlt = new THREE.Color();
    this.total = 0;
  }

  _crearLote(tipo) {
    const geo = tipo.geo();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: tipo.id === 'piedra' ? 0.82 : 0.93,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this._inyectar(mat, tipo);

    const Rmin = tipo.radioMin ?? 0;
    const celdas = Math.PI * (Math.pow(tipo.radio + 0.5, 2) - Math.pow(Math.max(0, Rmin - 0.5), 2));
    const capacidad = Math.min(MAX_INSTANCIAS, Math.round(tipo.porCelda * celdas * 1.25) + 64);
    const malla = new THREE.InstancedMesh(geo, mat, capacidad);
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Deliberado: la cubierta de suelo no proyecta sombra, sólo la recibe.
    malla.castShadow = false;
    malla.receiveShadow = true;
    malla.frustumCulled = false;
    malla.count = 0;
    malla.name = tipo.id;

    const tintes = new THREE.InstancedBufferAttribute(new Float32Array(capacidad * 3), 3);
    malla.geometry.setAttribute('iTinte', tintes);

    this.grupo.add(malla);
    return { tipo, malla, tintes, n: 0, capacidad };
  }

  _inyectar(mat, tipo) {
    const flexible = tipo.flexible ? 1 : 0;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformes);
      shader.uniforms.uFlexible = { value: flexible };

      shader.vertexShader = `
        attribute vec3 iTinte;
        uniform float uTiempo;
        uniform vec2 uViento;
        uniform float uFuerzaViento;
        uniform float uFlexible;
        varying vec3 vTinte;
        varying float vAlturaMundo;
        varying float vAlturaLocal;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vTinte = iTinte;
        vAlturaLocal = position.y;

        // El pasto se dobla desde la base: la punta describe casi un arco, la
        // raíz no se mueve. Cada mata lleva su propia fase para que el pastizal
        // ondule y no palpite como un solo bloque.
        vec3 origen = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float fase = origen.x * 0.7 + origen.z * 0.53;
        float t = uTiempo * 2.1 + fase;
        float rafaga = 0.55 + 0.45 * sin(uTiempo * 0.37 + fase * 0.21);
        float palanca = pow(max(0.0, position.y), 1.5);
        float amp = uFlexible * uFuerzaViento * rafaga * palanca * 0.42;
        transformed.x += uViento.x * (sin(t) * 0.75 + sin(t * 2.7 + 1.3) * 0.25) * amp;
        transformed.z += uViento.y * (sin(t) * 0.75 + sin(t * 2.7 + 1.3) * 0.25) * amp;

        vAlturaMundo = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        `
      );

      shader.fragmentShader = `
        uniform float uEstacion;
        uniform float uCotaNieve;
        varying vec3 vTinte;
        varying float vAlturaMundo;
        varying float vAlturaLocal;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        diffuseColor.rgb *= vTinte;

        // Otoño e invierno secan el pastizal
        float seco = clamp(1.0 - abs(uEstacion - 1.6), 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.44, 0.24), seco * 0.42 * ${flexible.toFixed(1)});

        // La nieve tapa la cubierta baja antes que a los árboles
        float nieve = smoothstep(uCotaNieve - 60.0, uCotaNieve + 90.0, vAlturaMundo);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.93, 0.96), nieve * 0.85);
        `
      );

      // Translucidez: la hoja fina deja pasar la luz
      if (tipo.flexible) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `
          #include <lights_fragment_end>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.22, 0.30, 0.17);
          `
        );
      }
    };
  }

  actualizar(posicion, tiempo, estado) {
    this.uniformes.uTiempo.value = tiempo;
    const rad = (estado.direccionViento ?? 270) * Math.PI / 180;
    this.uniformes.uViento.value.set(Math.sin(rad), -Math.cos(rad));
    this.uniformes.uFuerzaViento.value = Math.min(2.2, 0.2 + (estado.vientoKmh ?? 20) / 34);
    this.uniformes.uEstacion.value = estado.estacionContinua ?? 0;
    this.uniformes.uCotaNieve.value = estado.cotaNieve ?? 1750;

    const cx = Math.floor(posicion.x / TAM_CELDA);
    const cz = Math.floor(posicion.z / TAM_CELDA);
    if (cx !== this._celda.x || cz !== this._celda.z) {
      this._celda = { x: cx, z: cz };
      // Resembrar todo de una vez cuesta unos 70 ms: un tirón visible cada vez
      // que el jugador cruza una celda, o sea cada pocos segundos caminando.
      // Se arma una cola de tareas (un lote y una celda cada una) y se consume
      // con presupuesto de tiempo.
      this._cola = [];
      for (const lote of this.lotes) {
        lote.nParcial = 0;
        const R = lote.tipo.radio;
        const Rmin = lote.tipo.radioMin ?? 0;
        for (let dz = -R; dz <= R; dz++) {
          for (let dx = -R; dx <= R; dx++) {
            const d = Math.hypot(dx, dz);
            if (d > R + 0.5 || d < Rmin - 0.5) continue;
            this._cola.push({ lote, dx, dz });
          }
        }
      }
    }

    if (this._cola && this._cola.length) {
      const limite = performance.now() + 5;   // ms de presupuesto por cuadro
      while (this._cola.length && performance.now() < limite) {
        const t = this._cola.shift();
        this._sembrarCelda(t.lote, t.dx, t.dz, this._celda.x, this._celda.z);
      }
      // Publicar lo sembrado hasta ahora
      for (const lote of this.lotes) {
        lote.n = lote.nParcial;
        lote.malla.count = lote.n;
        lote.malla.instanceMatrix.needsUpdate = true;
        lote.tintes.needsUpdate = true;
      }
      if (!this._cola.length) {
        for (const lote of this.lotes) lote.malla.computeBoundingSphere();
        this.total = this.lotes.reduce((a, l) => a + l.n, 0);
      }
    }
  }

  /** Siembra inmediata y completa. La usan el arranque y las capturas. */
  sembrarTodo(posicion) {
    const cx = Math.floor(posicion.x / TAM_CELDA);
    const cz = Math.floor(posicion.z / TAM_CELDA);
    this._celda = { x: cx, z: cz };
    this._cola = [];
    for (const lote of this.lotes) {
      lote.nParcial = 0;
      const R = lote.tipo.radio;
      const Rmin = lote.tipo.radioMin ?? 0;
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > R + 0.5 || d < Rmin - 0.5) continue;
          this._sembrarCelda(lote, dx, dz, cx, cz);
        }
      }
      lote.n = lote.nParcial;
      lote.malla.count = lote.n;
      lote.malla.instanceMatrix.needsUpdate = true;
      lote.tintes.needsUpdate = true;
      lote.malla.computeBoundingSphere();
    }
    this.total = this.lotes.reduce((a, l) => a + l.n, 0);
  }

  /** Siembra una sola celda de un solo tipo. Es la unidad de trabajo. */
  _sembrarCelda(lote, dx, dz, cx, cz) {
    const m = this.mundo;
    const color = new THREE.Color();
    const { tipo } = lote;
    const R = tipo.radio;
    const Rmin = tipo.radioMin ?? 0;
    const distCeldas = Math.hypot(dx, dz);
    const gx = cx + dx, gz = cz + dz;

    // La densidad se apaga hacia el borde del sembrado. Si terminara de golpe
    // se veria una circunferencia de pasto siguiendo al jugador. En los tipos
    // que ocupan un anillo, el desvanecimiento se mide sobre el anillo: entran
    // creciendo por el borde interno y se apagan hacia el externo.
    const t = (distCeldas - Rmin) / Math.max(0.5, R + 0.5 - Rmin);
    const desvanece = Rmin > 0
      ? Math.min(1, Math.max(0, t) * 3.2) * (1 - Math.pow(Math.min(1, Math.max(0, t)), 2.6))
      : 1 - Math.pow(Math.min(1, distCeldas / (R + 0.5)), 2.2);

    // Semilla determinista: la misma celda produce siempre lo mismo, asi el
    // sotobosque no baila cuando el jugador va y vuelve.
    let s = (gx * 1836311903) ^ (gz * 2971215073) ^ (tipo.id.length * 97);
    const azar = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };

    const cantidad = tipo.porCelda < 1
      ? (azar() < tipo.porCelda * desvanece ? 1 : 0)
      : Math.round(tipo.porCelda * (0.6 + azar() * 0.8) * desvanece);

    for (let k = 0; k < cantidad; k++) {
      if (lote.nParcial >= lote.capacidad) break;
      const x = gx * TAM_CELDA + azar() * TAM_CELDA;
      const z = gz * TAM_CELDA + azar() * TAM_CELDA;
      if (!m.dentro(x, z) || m.esAgua(x, z)) continue;

      const alt = m.alturaEn(x, z);
      const hum = m.humedadEn(x, z);
      const pend = m.pendienteEn(x, z) * 180 / Math.PI;
      const aptitud = tipo.apto(alt, hum, pend);
      if (aptitud <= 0 || azar() > Math.min(1, aptitud)) continue;

      // Apoyado sobre el terreno y alineado con su pendiente
      m.normalEn(x, z, this._normal);
      this._q.setFromUnitVectors(this._eje, this._normal);
      this._qGiro.setFromAxisAngle(this._eje, azar() * Math.PI * 2);
      this._q.multiply(this._qGiro);

      const esc = 0.68 + azar() * 0.75;
      this._p.set(x, alt - 0.04, z);
      this._s.set(esc, esc * (0.8 + azar() * 0.5), esc);
      this._m.compose(this._p, this._q, this._s);
      lote.malla.setMatrixAt(lote.nParcial, this._m);

      color.set(tipo.color).lerp(this._colorAlt.set(tipo.colorAlt), azar());
      const brillo = 0.82 + azar() * 0.4;
      lote.tintes.setXYZ(lote.nParcial, color.r * brillo, color.g * brillo, color.b * brillo);

      lote.nParcial++;
    }
  }

  /** Elemento del sotobosque más cercano, para recolectar. */
  masCercano(posicion, radio = 5) {
    if (!this._m2) this._m2 = new THREE.Matrix4();
    let mejor = null, mejorD = radio;
    for (const lote of this.lotes) {
      for (let i = 0; i < lote.n; i++) {
        lote.malla.getMatrixAt(i, this._m2);
        const e = this._m2.elements;
        const d = Math.hypot(e[12] - posicion.x, e[14] - posicion.z);
        if (d < mejorD) {
          mejorD = d;
          mejor = { tipo: lote.tipo, x: e[12], y: e[13], z: e[14], distancia: d };
        }
      }
    }
    return mejor;
  }

  dispose() {
    for (const l of this.lotes) { l.malla.geometry.dispose(); l.malla.material.dispose(); }
  }
}

// ── Geometrías ──────────────────────────────────────────────────────────────

/**
 * Champa de gramínea. Las hojas no salen todas del mismo punto: se reparten
 * sobre un disco, así cada instancia cubre superficie y el pastizal se cierra
 * en vez de verse como brotes sueltos sobre tierra pelada.
 */
function matoja(altura, hojas, ancho, dispersion = 0.30) {
  const pos = [], idx = [];
  let v = 0;
  for (let i = 0; i < hojas; i++) {
    // Base repartida sobre el disco de la champa
    const angBase = Math.random() * Math.PI * 2;
    const rBase = Math.sqrt(Math.random()) * dispersion;
    const bx = Math.cos(angBase) * rBase, bz = Math.sin(angBase) * rBase;

    const ang = Math.random() * Math.PI * 2;
    const inclina = 0.16 + Math.random() * 0.46;
    const h = altura * (0.55 + Math.random() * 0.8);
    const segs = 3;
    const dirX = Math.cos(ang), dirZ = Math.sin(ang);

    for (let sgm = 0; sgm <= segs; sgm++) {
      const t = sgm / segs;
      // La hoja se arquea: la punta cae más que la base
      const arco = t * t * inclina;
      const y = h * t * (1 - arco * 0.34);
      const r = h * arco;
      const an = ancho * (1 - t) * (1 - t * 0.3);
      const cx = bx + dirX * r, cz = bz + dirZ * r;
      const px = -dirZ * an, pz = dirX * an;
      pos.push(cx - px, y, cz - pz);
      pos.push(cx + px, y, cz + pz);
    }
    for (let sgm = 0; sgm < segs; sgm++) {
      const a = v + sgm * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    v += (segs + 1) * 2;
  }
  return armar(pos, idx);
}

/** Fronda de helecho: pinnas escalonadas sobre un raquis arqueado. */
function helecho(altura) {
  const pos = [], idx = [];
  let v = 0;
  const frondas = 6;
  for (let f = 0; f < frondas; f++) {
    const ang = (f / frondas) * Math.PI * 2 + Math.random() * 0.5;
    const dirX = Math.cos(ang), dirZ = Math.sin(ang);
    const largo = altura * (0.7 + Math.random() * 0.6);
    const pinnas = 5;
    for (let p = 1; p <= pinnas; p++) {
      const t = p / pinnas;
      const y = largo * t * (1 - t * 0.42);
      const r = largo * t * 0.72;
      const an = largo * 0.19 * (1 - t * 0.65);
      const cx = dirX * r, cz = dirZ * r;
      const px = -dirZ * an, pz = dirX * an;
      pos.push(cx, y, cz);
      pos.push(cx + px - dirX * an * 0.5, y - an * 0.35, cz + pz - dirZ * an * 0.5);
      pos.push(cx - px - dirX * an * 0.5, y - an * 0.35, cz - pz - dirZ * an * 0.5);
      idx.push(v, v + 1, v + 2);
      v += 3;
    }
  }
  return armar(pos, idx);
}

/** Arbustillo leñoso: masa de hojas sobre ramitas cortas. */
function arbustillo(altura) {
  const geos = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(altura * (0.24 + Math.random() * 0.16), 0);
    const a = Math.random() * Math.PI * 2;
    const r = altura * Math.random() * 0.3;
    g.scale(1.1, 0.82, 1.1);
    g.translate(Math.cos(a) * r, altura * (0.34 + Math.random() * 0.4), Math.sin(a) * r);
    geos.push(g);
  }
  return fusionar(geos);
}

/** Canto rodado irregular, achatado contra el suelo. */
function piedra(radio) {
  const g = new THREE.IcosahedronGeometry(radio, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 0.68 + Math.random() * 0.62;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.62, p.getZ(i) * f);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.translate(0, radio * 0.26, 0);
  return fusionar([g]);
}

/** Tronco caído, tumbado y con un extremo astillado. */
function tronco(largo, radio) {
  const g = new THREE.CylinderGeometry(radio * 0.72, radio, largo, 7, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateY(Math.random() * Math.PI);
  g.translate(0, radio * 0.86, 0);
  return fusionar([g]);
}

function armar(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = pos.length / 3;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.computeBoundingSphere();
  return g;
}

function fusionar(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, nn = g.attributes.normal;
    const c = p.count;
    pos.set(p.array.subarray(0, c * 3), vo * 3);
    if (nn) nor.set(nn.array.subarray(0, c * 3), vo * 3);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < c; i++) idx[io + i] = i + vo;
      io += c;
    }
    vo += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3).fill(1), 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
