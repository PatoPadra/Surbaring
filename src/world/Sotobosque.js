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
        id: 'carronia',
        nombre: 'Restos de un animal',
        geo: () => restos(),
        color: 0x9a8f7e, colorAlt: 0x6b5f4e,
        radio: RADIO_LEJOS, porCelda: 0.10, flexible: false,
        // Donde caza el puma: bosque cerrado, lejos del agua abierta, en
        // laderas donde puede acechar
        apto: (alt, hum, pend) => alt < 1700 && hum > 0.35 && pend > 6 ? 0.5 : 0,
      },
      {
        id: 'tronco',
        nombre: 'Tronco caído',
        geo: () => tronco(3.4, 0.24),
        // Albedo, no iluminacion. El relleno hemisferico de mas abajo rescato a
        // la piedra y no pudo con el tronco por una razon aritmetica: se
        // multiplica por el albedo, y el del tronco estaba en 0,047 y 0,025
        // lineal. Con el relleno puesto daban 0,016 y 0,008: negro igual. Es el
        // mismo hallazgo que destapo las hojas de coihue —ninguna cantidad de
        // cielo arregla un albedo de 0,03—, sólo que ahi era `colorHoja` y aca
        // es el tronco caido, que quedo fuera de aquella pasada.
        //
        // Ahora 0,115 y 0,080, que es madera muerta a la intemperie (0,10-0,20
        // real) y sigue estando por debajo del granito de la piedra (0,183),
        // como corresponde.
        color: 0x6f5c46, colorAlt: 0x5e4d38,
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
    this._qInc = new THREE.Quaternion();
    this._ejeInc = new THREE.Vector3();
    this._colorAlt = new THREE.Color();
    this._colorSuelo = new THREE.Color();
    this.total = 0;
  }

  _crearLote(tipo) {
    const geo = tipo.geo();
    // Lambert y no Standard, y la razón es de presupuesto medido.
    //
    // Con rugosidad 0,88 y metalness 0 el lóbulo especular de GGX no aporta un
    // solo píxel que se distinga: la hoja es mate. Pero cada fragmento pagaba
    // igual el BRDF físico completo —D_GGX, V_GGX_SmithCorrelated, F_Schlick,
    // más computeMultiscattering y DFGApprox del camino indirecto— y con el
    // desvanecido de cascadas del CSM, en la banda de solape lo pagaba dos
    // veces. El follaje y el sotobosque juntos son 58 de los 99 ms del cuadro
    // en la placa de destino, así que ahí es donde eso pesa.
    //
    // El terreno se queda en Standard a propósito: su rugosidad varía —la nieve
    // y la roca mojada brillan— y ese brillo sí se ve.
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      // Dos caras sólo para lo que de verdad es una lámina. La piedra y el
      // tronco son sólidos cerrados: rasterizar sus caras traseras es sombrear
      // el doble de fragmentos para que después pierdan la prueba de
      // profundidad, y encima cada uno de esos fragmentos paga los dieciséis
      // muestreos del filtro de sombra.
      side: (tipo.id === 'piedra' || tipo.id === 'tronco')
        ? THREE.FrontSide : THREE.DoubleSide,
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
    // Orden de dibujo de cerca a lejos, que recién ahora vale la pena.
    //
    // Con la profundidad logarítmica apagada volvió a funcionar el rechazo
    // temprano por profundidad, y con él el orden pasa a importar: lo que se
    // dibuja primero tapa, y lo tapado no se sombrea. El terreno es lo más caro
    // por píxel y está detrás de casi todo, así que va último entre los opacos;
    // el sotobosque, que es lo más cercano, va primero. Medido: 41,1 ms en el
    // orden que salía por defecto, 36,9 dibujando de cerca a lejos.
    malla.renderOrder = -30;
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
    const lamina = !!tipo.flexible;   // hoja, fronda, ramita: lámina fina
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
        ${lamina ? '' : 'varying float vArriba;'}
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vTinte = iTinte;

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

      // Cuánto mira al cielo cada cara, para el relleno hemisférico de los
      // sólidos. Se resuelve en el vértice —una normalización y un producto
      // punto sobre unos pocos miles de vértices— y no en el fragmento.
      if (!lamina) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <defaultnormal_vertex>',
          `
          #include <defaultnormal_vertex>
          vArriba = dot(normalize(transformedNormal),
                        normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
          `
        );
      }

      shader.fragmentShader = `
        uniform float uEstacion;
        uniform float uCotaNieve;
        varying vec3 vTinte;
        varying float vAlturaMundo;
        ${lamina ? '' : 'varying float vArriba;'}
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        diffuseColor.rgb *= vTinte;
        ${lamina ? `
        // Otoño e invierno secan el pastizal
        float seco = clamp(1.0 - abs(uEstacion - 1.6), 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.44, 0.24), seco * 0.42);
        ` : ''}
        // La nieve tapa la cubierta baja antes que a los árboles
        float nieve = smoothstep(uCotaNieve - 60.0, uCotaNieve + 90.0, vAlturaMundo);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.93, 0.96), nieve * 0.85);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        lamina ? `
          #include <lights_fragment_end>
          // Translucidez: la hoja fina deja pasar la luz
          reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.22, 0.30, 0.17);
        ` : `
          #include <lights_fragment_end>
          // Relleno hemisférico para los sólidos, y la razón de que exista.
          //
          // La piedra y el tronco caído salían NEGRO PURO a pleno mediodía. La
          // hoja tenía su término de translucidez —el de acá arriba— y ellos no
          // tenían nada: cerrados y con FrontSide, las caras que quedan a la
          // vista son casi todas de canto al sol, y sin relleno el resultado es
          // cero. Un canto rodado de granito nunca es negro: la cara de arriba
          // recibe el cielo entero y la de abajo el rebote de la tierra.
          //
          // Cuesta un mix de dos constantes: no hay ni una textura de por medio.
          reflectedLight.indirectDiffuse += diffuseColor.rgb
            * mix(vec3(0.085, 0.075, 0.058), vec3(0.30, 0.34, 0.42),
                  clamp(vArriba * 0.5 + 0.5, 0.0, 1.0));
        `
      );
    };

    // Dos materiales cuyo `onBeforeCompile` tiene el MISMO texto comparten
    // programa: la clave de caché que arma three sale de
    // `onBeforeCompile.toString()`, y como acá los nueve tipos salen del mismo
    // método, los nueve dan el mismo texto. Antes daba igual porque el shader
    // era idéntico; ahora la lámina y el sólido compilan fuentes distintas, y
    // sin esto la carroña —doble cara y no flexible, como el pasto— se llevaría
    // el shader del pasto y se quedaría sin `vArriba`. Es la trampa 3 del
    // contexto: no lanza excepción, sólo sale mal.
    mat.customProgramCacheKey = () => `sotobosque-${lamina ? 'lamina' : 'solido'}`;
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

      // Ninguna champa crece a plomo. Alineadas todas con la normal del terreno
      // quedaban en el mismo ángulo exacto, y una ladera entera de matas
      // paralelas es lo que hacía que se leyeran como calcomanías clavadas.
      // Diez grados de desvío en una dirección cualquiera alcanzan.
      if (tipo.flexible) {
        const azInc = azar() * Math.PI * 2;
        this._ejeInc.set(Math.cos(azInc), 0, Math.sin(azInc));
        this._qInc.setFromAxisAngle(this._ejeInc, (azar() - 0.5) * 0.34);
        this._q.multiply(this._qInc);
      }

      const esc = 0.68 + azar() * 0.75;
      this._p.set(x, alt - 0.04, z);
      // Escala no uniforme también en planta: una mata más ancha que profunda
      // rompe la repetición sin costar un solo triángulo más.
      this._s.set(esc * (0.86 + azar() * 0.28),
                  esc * (0.8 + azar() * 0.5),
                  esc * (0.86 + azar() * 0.28));
      this._m.compose(this._p, this._q, this._s);
      lote.malla.setMatrixAt(lote.nParcial, this._m);

      color.set(tipo.color).lerp(this._colorAlt.set(tipo.colorAlt), azar());
      // Que la mata sepa sobre qué tierra está parada.
      //
      // El tinte salía de puro azar entre dos constantes de la especie, sin
      // consultar el terreno, mientras el shader del suelo calculaba su color a
      // partir de humedad, altura, pendiente y parche. Dos superficies que se
      // tocan con dos modelos de color que no se conocen: por eso el pastizal
      // se leía como una calcomanía apoyada encima y no como algo que sale de
      // esa tierra. Un tercio de mezcla alcanza —a uno entero el pastizal
      // desaparece— y con eso, donde el suelo vira a seco, el pasto vira con él.
      //
      // Los mismos tres colores que usa Terreno.js para la cubierta vegetal.
      const hs = Math.min(1, Math.max(0, hum));
      this._colorSuelo.setRGB(
        0.290 + (0.070 - 0.290) * hs,
        0.264 + (0.126 - 0.264) * hs,
        0.180 + (0.066 - 0.180) * hs);
      color.lerp(this._colorSuelo, 0.35);

      // Variación de TONO entre individuos, que no es lo mismo que de brillo.
      //
      // El brillo ya se movía y aun así el pastizal se veía de un solo verde:
      // subir y bajar los tres canales a la vez no cambia el color, sólo la
      // luz. Un pastizal real va del verde amarillento al verde azulado según
      // la mata. Se empuja el rojo contra el azul y se deja el verde casi
      // quieto —que es el canal que lleva la luminancia—, así el tono se abre
      // sin que aparezca el ruido de brillo que ya se había sacado a mano.
      const tono = azar() * 2 - 1;          // −1 amarillenta, +1 azulada
      color.r *= 1 - tono * 0.11;
      color.g *= 1 + tono * 0.02;
      color.b *= 1 + tono * 0.17;

      // El rango de brillo era más ancho que la variación real dentro de una
      // champa, y buena parte del ruido cromático salía de ahí.
      const brillo = 0.88 + azar() * 0.24;
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
    // Más arqueada que antes. Con el rango viejo (0,16 a 0,62) la hoja salía
    // casi recta y el pastizal se leía como un montón de triángulos parados
    // todos al mismo ángulo; una gramínea real se vence hacia la punta.
    const inclina = 0.30 + Math.random() * 0.78;
    const h = altura * (0.55 + Math.random() * 0.8);
    // Tres tramos, y se probó con cuatro.
    //
    // Con cuatro la hoja se lee un poco más como curva y menos como codo, pero
    // medido en el bosque de la ladera eran **+123.552 triángulos, un 28 % más
    // de sotobosque** (562.106 contra 438.554) para el detalle más fino de la
    // pieza más instanciada del juego. En una HD 4000, donde el costo fijo de
    // geometría ya es la mayor parte del cuadro, eso son milisegundos por una
    // silueta que a un metro de distancia casi no se distingue. No vale.
    //
    // El arqueo se ganó subiendo `inclina`, que es gratis.
    const segs = 3;
    const dirX = Math.cos(ang), dirZ = Math.sin(ang);

    for (let sgm = 0; sgm <= segs; sgm++) {
      const t = sgm / segs;
      // La hoja se arquea: la punta cae más que la base
      const arco = t * t * inclina;
      const y = h * t * (1 - arco * 0.34);
      const r = h * arco;
      // La punta conserva un ancho mínimo, y no es un detalle estético.
      //
      // Con `(1 - t)` el ancho daba exactamente 0 en la punta: los dos vértices
      // del extremo caían en el mismo lugar, el último triángulo del quad salía
      // degenerado y `computeVertexNormals()` le dejaba **normal cero** al
      // vértice que sólo tocaba ese triángulo. Medido: una normal nula por hoja
      // —16 de 128 vértices en el coirón, 18 de 144 en el pastizal húmedo—, y
      // una normal nula es un vértice negro que se derrama sobre toda la punta.
      const an = ancho * (0.05 + 0.95 * (1 - t)) * (1 - t * 0.3);
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
  const g = armar(pos, idx);
  gradiente(g, altura, [0.46, 0.44, 0.35], [1.00, 1.02, 0.90]);
  return g;
}

/**
 * Hornea la oclusión propia en el color del vértice.
 *
 * Antes esto era una línea del fragmento —`mix(0.55, 1.0, vAlturaLocal/0.6)`—
 * que se pagaba en cada píxel de cada brizna, que son las decenas de miles de
 * instancias más caras del cuadro. El atributo `color` ya existía en todas
 * estas geometrías, ya estaba declarado `vertexColors: true` y ya se
 * multiplicaba en `<color_fragment>`... relleno de unos, sin hacer nada. Pasar
 * el degradado ahí es gratis: se calcula una vez al construir la malla y le
 * saca al fragmento un clamp, un mix, una multiplicación y un varying.
 *
 * Y de paso hace más de lo que hacía: la base no sólo se oscurece, también vira
 * a tierra. El contacto con el suelo dejó de leerse como un corte.
 */
function gradiente(g, alturaRef, base, punta) {
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    // La raíz de la potencia concentra el degradado abajo, que es donde la
    // champa de verdad se tapa a sí misma.
    const t = Math.pow(Math.min(1, Math.max(0, p.getY(i) / alturaRef)), 0.65);
    c.setXYZ(i,
      base[0] + (punta[0] - base[0]) * t,
      base[1] + (punta[1] - base[1]) * t,
      base[2] + (punta[2] - base[2]) * t);
  }
  c.needsUpdate = true;
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
  const g = armar(pos, idx);
  gradiente(g, altura, [0.40, 0.46, 0.34], [1.00, 1.04, 0.92]);
  return g;
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
  const g = fusionar(geos);
  gradiente(g, altura, [0.52, 0.54, 0.44], [1.00, 1.02, 0.94]);
  return g;
}

/**
 * Canto rodado irregular, achatado contra el suelo.
 *
 * El bulto sale de una función continua de la DIRECCIÓN del vértice, y no de un
 * `Math.random()` por vértice, y esa es toda la diferencia entre una piedra y lo
 * que había antes.
 *
 * `IcosahedronGeometry` no está indexada: los tres vértices de cada triángulo
 * son propios, así que dos vértices que ocupan el mismo lugar son objetos
 * distintos. Sortear un factor de escala para cada uno los mandaba para lados
 * distintos y **abría el sólido en ochenta placas sueltas**. De ahí salían los
 * dos defectos a la vez: la forma de esquirlas, y el negro —con `FrontSide` las
 * caras internas de las placas de atrás se descartan, por los huecos se ve el
 * interior, y lo que queda a la vista son placas de canto al sol con
 * `dot(N,L)` casi nulo—.
 *
 * Con lóbulos senoidales sobre la dirección, dos vértices que comparten lugar
 * reciben el mismo desplazamiento y la cáscara queda cerrada. Se deja sin
 * indexar a propósito: cada triángulo conserva su normal de cara y la piedra se
 * lee facetada, que es el estilo del juego.
 */
function piedra(radio) {
  const g = new THREE.IcosahedronGeometry(radio, 1);
  const p = g.attributes.position;

  // Unos pocos lóbulos con eje, frecuencia y fase al azar: una piedra distinta
  // por cada llamada, pero continua sobre la esfera.
  const lobulos = [];
  for (let i = 0; i < 4; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
    lobulos.push({
      eje: v.normalize(),
      amp: 0.09 + Math.random() * 0.15,
      frec: 1.4 + Math.random() * 2.6,
      fase: Math.random() * Math.PI * 2,
    });
  }

  const d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i));
    const largo = d.length();
    if (largo < 1e-6) continue;
    d.divideScalar(largo);
    let f = 1;
    for (const l of lobulos) f += l.amp * Math.sin(l.frec * d.dot(l.eje) * Math.PI + l.fase);
    // Achatada contra el suelo, como un canto rodado y no como una pelota.
    p.setXYZ(i, d.x * largo * f, d.y * largo * f * 0.62, d.z * largo * f);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.translate(0, radio * 0.26, 0);
  return fusionar([g]);
}

/** Restos de un animal: costillar a la vista y algo de cuero seco. */
function restos() {
  const geos = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.CylinderGeometry(0.022, 0.016, 0.34 + Math.random() * 0.2, 4, 1);
    c.rotateZ(Math.PI / 2 + (Math.random() - 0.5) * 0.5);
    c.rotateY(Math.random() * Math.PI);
    c.translate((i - 3) * 0.09, 0.10 + Math.random() * 0.05, (Math.random() - 0.5) * 0.14);
    geos.push(c);
  }
  const craneo = new THREE.IcosahedronGeometry(0.13, 0);
  craneo.scale(1.5, 0.8, 0.9);
  craneo.translate(0.42, 0.10, 0.04);
  geos.push(craneo);
  const piel = new THREE.PlaneGeometry(0.62, 0.44);
  piel.rotateX(-Math.PI / 2 + 0.12);
  piel.translate(-0.14, 0.035, 0.1);
  geos.push(piel);
  return fusionar(geos);
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
