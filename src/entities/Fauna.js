/**
 * Fauna — animales del Nahuel Huapi con comportamiento propio.
 *
 * Cada especie se arma proceduralmente a partir de sus medidas reales (largo,
 * alzada, peso) y se anima por partes: no hay esqueletos importados, sino un
 * cuerpo articulado que camina, pasta, levanta la cabeza y huye.
 *
 * El comportamiento respeta la biología: el huemul huye a 45 m y es diurno, el
 * puma es crepuscular y solitario, el pudú se esconde en el sotobosque denso,
 * el cóndor planea en térmicas sobre las laderas soleadas. Las especies
 * protegidas (toda la fauna nativa dentro de un parque nacional) quedan
 * marcadas: cazarlas penaliza al jugador en vez de premiarlo.
 */

import * as THREE from 'three';

const MAX_VIVOS = 52;
const RADIO_APARICION = 340;
const RADIO_DESAPARICION = 620;
// Sólo los animales de buen porte proyectan sombra: con cuatro cascadas, cada
// sombra cuesta cuatro dibujos extra y un rayadito de 11 g no se nota.
const PESO_MIN_SOMBRA = 2.5;

const ESTADOS = {
  QUIETO: 'quieto',
  PASTANDO: 'pastando',
  CAMINANDO: 'caminando',
  ALERTA: 'alerta',
  HUYENDO: 'huyendo',
  ACECHANDO: 'acechando',
  VOLANDO: 'volando',
};

export class Fauna {
  /**
   * @param {import('../world/Mundo.js').Mundo} mundo
   * @param {{especies: Array}} datos
   */
  constructor(mundo, datos) {
    this.mundo = mundo;
    this.grupo = new THREE.Group();
    this.grupo.name = 'fauna';

    // Nos quedamos con las especies terrestres y voladoras representables
    this.especies = datos.especies.filter(e =>
      ['mamifero', 'ave'].includes(e.clase) &&
      e.largoM && e.largoM > 0.1
    );
    this.porId = new Map(this.especies.map(e => [e.id, e]));

    this._geometrias = new Map();
    this.vivos = [];
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._ultimaSiembra = 0;
    this.avistajes = new Map();  // id -> cantidad de veces visto (para el códice)
  }

  /** ¿La especie depende del agua para vivir? */
  _esAcuatica(esp) {
    if (this._cacheAcuatica?.has(esp.id)) return this._cacheAcuatica.get(esp.id);
    this._cacheAcuatica ??= new Map();
    const biomas = (esp.biomas || []).join(' ');
    const v = /ribera|lacustre|mallin|humedal|acuatic|rio|lago/.test(biomas)
      || esp.dieta === 'piscivoro'
      || /maca|huillin|coipo|pato|cauquen|biguá|bigua|gaviota|martin_pescador|torrente/.test(esp.id);
    this._cacheAcuatica.set(esp.id, v);
    return v;
  }

  /**
   * Aptitud de la especie en un punto, según altitud, bioma, estación y —lo que
   * faltaba— cercanía al agua. Un macá plateado es un zambullidor: no tiene nada
   * que hacer en una ladera seca a 800 m de la orilla.
   */
  _aptitud(esp, altitud, humedad, pendiente, estacion, distanciaAgua = 9999) {
    if (esp.altitudMinM !== null && altitud < esp.altitudMinM) return 0;
    if (esp.altitudMaxM !== null && altitud > esp.altitudMaxM) return 0;
    if (esp.estacionesActivo && !esp.estacionesActivo.includes(estacion)) return 0;
    if (pendiente > 42 && esp.clase === 'mamifero' && !/puma|huemul|chinchillon/.test(esp.id)) return 0;

    if (this._esAcuatica(esp)) {
      // Fuera de la franja ribereña, directamente no aparece.
      if (distanciaAgua > 70) return 0;
    } else if (distanciaAgua < 6) {
      return 0; // tampoco queremos zorros parados dentro del lago
    }

    let p = esp.rareza ?? 0.2;

    // Los mamíferos son mucho menos numerosos que las aves, pero si respetamos
    // esa proporción a rajatabla el jugador no ve un solo cuadrúpedo. Se les da
    // una mano para que el parque se sienta habitado.
    if (esp.clase === 'mamifero') p *= 3.2;

    // Los animales de bosque húmedo no salen a la estepa y viceversa
    const biomas = esp.biomas || [];
    const deBosque = biomas.some(b => /bosque|valdivian|canaveral|nire|lenga|cipres/.test(b));
    const deEstepa = biomas.some(b => /estepa|ecotono/.test(b));
    const deAltura = biomas.some(b => /altoandin|matorral_alto/.test(b));
    if (deBosque) p *= 0.25 + humedad * 1.5;
    if (deEstepa) p *= 0.35 + (1 - humedad) * 1.5;
    if (deAltura) p *= altitud > 1500 ? 1.8 : 0.25;

    return p;
  }

  /** Hora del día 0..24 -> multiplicador según el hábito de actividad. */
  _actividad(esp, hora) {
    const amanecer = 7, atardecer = 20;
    const esDia = hora > amanecer && hora < atardecer;
    const esCrepusculo = Math.abs(hora - amanecer) < 1.6 || Math.abs(hora - atardecer) < 1.6;
    switch (esp.actividad) {
      case 'diurno': return esDia ? 1 : 0.12;
      case 'nocturno': return esDia ? 0.10 : 1;
      case 'crepuscular': return esCrepusculo ? 1 : (esDia ? 0.35 : 0.45);
      default: return 0.75;
    }
  }

  actualizar(dt, jugador, estado, tiempoTotal) {
    const hora = estado.horaDecimal ?? 12;

    // Reponer población alrededor del jugador
    if (tiempoTotal - this._ultimaSiembra > 1.5) {
      this._ultimaSiembra = tiempoTotal;
      this._reponer(jugador, estado, hora);
    }

    for (let i = this.vivos.length - 1; i >= 0; i--) {
      const a = this.vivos[i];
      const d = a.objeto.position.distanceTo(jugador.posicion);
      if (d > RADIO_DESAPARICION) {
        this.grupo.remove(a.objeto);
        this.vivos.splice(i, 1);
        continue;
      }
      this._simular(a, dt, jugador, d, tiempoTotal);
      if (d < 90 && !a.visto) {
        a.visto = true;
        this.avistajes.set(a.esp.id, (this.avistajes.get(a.esp.id) || 0) + 1);
        this.alAvistar?.(a.esp);
      }
    }
  }

  _reponer(jugador, estado, hora) {
    if (this.vivos.length >= MAX_VIVOS) return;
    const m = this.mundo;

    for (let intento = 0; intento < 8 && this.vivos.length < MAX_VIVOS; intento++) {
      const ang = Math.random() * Math.PI * 2;
      const r = RADIO_APARICION * (0.55 + Math.random() * 0.45);
      const x = jugador.posicion.x + Math.cos(ang) * r;
      const z = jugador.posicion.z + Math.sin(ang) * r;
      if (!m.dentro(x, z) || m.esAgua(x, z)) continue;

      const altitud = m.alturaEn(x, z);
      const humedad = m.humedadEn(x, z);
      const pendiente = m.pendienteEn(x, z) * 180 / Math.PI;
      const k = m.indiceDe(x, z);
      const distanciaAgua = k >= 0 ? m.distanciaAgua[k] : 9999;

      let suma = 0;
      const pesos = [];
      for (const esp of this.especies) {
        const p = this._aptitud(esp, altitud, humedad, pendiente, estado.estacion, distanciaAgua)
                * this._actividad(esp, hora);
        pesos.push(p);
        suma += p;
      }
      if (suma < 1e-4) continue;

      let ruleta = Math.random() * suma, elegido = -1;
      for (let i = 0; i < pesos.length; i++) {
        ruleta -= pesos[i];
        if (ruleta <= 0) { elegido = i; break; }
      }
      if (elegido < 0) continue;
      const esp = this.especies[elegido];

      // Los gregarios aparecen en grupo
      const n = esp.gregario
        ? Math.max(1, Math.round(esp.tamanoGrupoMin + Math.random() * ((esp.tamanoGrupoMax ?? 3) - (esp.tamanoGrupoMin ?? 1))))
        : 1;
      for (let k = 0; k < n && this.vivos.length < MAX_VIVOS; k++) {
        const ox = x + (Math.random() - 0.5) * 22;
        const oz = z + (Math.random() - 0.5) * 22;
        if (!m.dentro(ox, oz) || m.esAgua(ox, oz)) continue;
        this._crear(esp, ox, oz);
      }
    }
  }

  _crear(esp, x, z) {
    const geo = this._obtenerModelo(esp);
    const objeto = geo.clone(true);
    const y = this.mundo.alturaEn(x, z);
    objeto.position.set(x, y, z);
    objeto.rotation.y = Math.random() * Math.PI * 2;

    const escalaIndividual = 0.88 + Math.random() * 0.24;
    objeto.scale.setScalar(escalaIndividual);

    const proyectaSombra = (esp.pesoKg ?? 0) >= PESO_MIN_SOMBRA;
    objeto.traverse(o => { if (o.isMesh) o.castShadow = proyectaSombra; });

    this.grupo.add(objeto);

    const vuela = esp.clase === 'ave' && (esp.pesoKg ?? 0) > 1.5;
    const animal = {
      esp,
      objeto,
      partes: {
        cuerpo: objeto.getObjectByName('cuerpo'),
        cabeza: objeto.getObjectByName('cabeza'),
        cola: objeto.getObjectByName('cola'),
        patas: ['pd1', 'pi1', 'pd2', 'pi2'].map(n => objeto.getObjectByName(n)).filter(Boolean),
        alas: ['ala_d', 'ala_i'].map(n => objeto.getObjectByName(n)).filter(Boolean),
      },
      estado: ESTADOS.QUIETO,
      temporizador: 1 + Math.random() * 4,
      direccion: Math.random() * Math.PI * 2,
      velocidad: 0,
      fase: Math.random() * 10,
      salud: esp.saludBase ?? 60,
      visto: false,
      vuela,
      alturaVuelo: vuela ? 40 + Math.random() * 130 : 0,
    };
    if (vuela) {
      animal.estado = ESTADOS.VOLANDO;
      objeto.position.y += animal.alturaVuelo;
    }
    this.vivos.push(animal);
    return animal;
  }

  _simular(a, dt, jugador, distancia, t) {
    const esp = a.esp;
    const m = this.mundo;
    a.fase += dt;
    a.temporizador -= dt;

    // ── Percepción del jugador
    const huida = esp.distanciaHuidaM ?? 30;
    const agresivo = (esp.agresividad ?? 0) > 0.55;

    if (!a.vuela) {
      if (distancia < huida * 0.55 && !agresivo) {
        a.estado = ESTADOS.HUYENDO;
        a.temporizador = 3.5 + Math.random() * 3;
        // Huye en dirección opuesta al jugador
        a.direccion = Math.atan2(
          a.objeto.position.x - jugador.posicion.x,
          a.objeto.position.z - jugador.posicion.z
        );
      } else if (distancia < huida && a.estado !== ESTADOS.HUYENDO) {
        a.estado = agresivo ? ESTADOS.ACECHANDO : ESTADOS.ALERTA;
        a.temporizador = Math.max(a.temporizador, 1.5);
      }
    }

    // ── Máquina de estados
    if (a.temporizador <= 0) {
      if (a.vuela) {
        a.estado = ESTADOS.VOLANDO;
        a.direccion += (Math.random() - 0.5) * 1.4;
        a.temporizador = 4 + Math.random() * 8;
      } else {
        const r = Math.random();
        if (a.estado === ESTADOS.HUYENDO) {
          a.estado = ESTADOS.ALERTA;
          a.temporizador = 2 + Math.random() * 3;
        } else if (r < 0.34 && esp.dieta === 'herbivoro') {
          a.estado = ESTADOS.PASTANDO;
          a.temporizador = 4 + Math.random() * 8;
        } else if (r < 0.62) {
          a.estado = ESTADOS.CAMINANDO;
          a.direccion += (Math.random() - 0.5) * 2.2;
          a.temporizador = 3 + Math.random() * 6;
        } else {
          a.estado = ESTADOS.QUIETO;
          a.temporizador = 2 + Math.random() * 5;
        }
      }
    }

    // ── Velocidad objetivo
    let objetivo = 0;
    switch (a.estado) {
      case ESTADOS.HUYENDO: objetivo = esp.velocidadCarreraMs ?? 8; break;
      case ESTADOS.ACECHANDO: objetivo = (esp.velocidadCaminataMs ?? 1) * 1.4; break;
      case ESTADOS.CAMINANDO: objetivo = esp.velocidadCaminataMs ?? 1.1; break;
      case ESTADOS.VOLANDO: objetivo = 12 + Math.sin(a.fase * 0.2) * 4; break;
      default: objetivo = 0;
    }
    a.velocidad += (objetivo - a.velocidad) * Math.min(1, dt * 4.5);

    if (a.estado === ESTADOS.ACECHANDO) {
      a.direccion = Math.atan2(
        jugador.posicion.x - a.objeto.position.x,
        jugador.posicion.z - a.objeto.position.z
      );
    }

    // ── Desplazamiento
    const dx = Math.sin(a.direccion) * a.velocidad * dt;
    const dz = Math.cos(a.direccion) * a.velocidad * dt;
    let nx = a.objeto.position.x + dx;
    let nz = a.objeto.position.z + dz;

    if (!m.dentro(nx, nz)) { a.direccion += Math.PI; nx = a.objeto.position.x; nz = a.objeto.position.z; }

    if (a.vuela) {
      // Las térmicas suben sobre las laderas expuestas: el cóndor las aprovecha
      const objetivoY = m.alturaEn(nx, nz) + a.alturaVuelo;
      a.objeto.position.set(nx, a.objeto.position.y + (objetivoY - a.objeto.position.y) * dt * 0.55, nz);
      a.objeto.rotation.y = a.direccion;
      a.objeto.rotation.z = Math.sin(a.fase * 0.5) * 0.28;   // alabeo al virar
    } else {
      // No trepa paredes: si la pendiente es excesiva, gira
      if (m.pendienteEn(nx, nz) * 180 / Math.PI > 46 || m.esAgua(nx, nz)) {
        a.direccion += 1.1;
      } else {
        a.objeto.position.x = nx;
        a.objeto.position.z = nz;
      }
      a.objeto.position.y = m.alturaEn(a.objeto.position.x, a.objeto.position.z);

      // Alinear el cuerpo con la pendiente del terreno
      const nrm = m.normalEn(a.objeto.position.x, a.objeto.position.z, this._tmp);
      a.objeto.rotation.y = a.direccion;
      a.objeto.rotation.x = -Math.atan2(nrm.z, nrm.y) * 0.6;
      a.objeto.rotation.z = Math.atan2(nrm.x, nrm.y) * 0.6;
    }

    this._animar(a, dt);
  }

  _animar(a, dt) {
    const p = a.partes;
    const vel = a.velocidad;
    const zancada = vel * 2.4 / Math.max(0.4, (a.esp.alturaCruzM ?? 0.6));
    a.fasePaso = (a.fasePaso ?? 0) + zancada * dt;

    if (a.vuela && p.alas.length) {
      // El cóndor planea: bate poco y sostiene las alas extendidas
      const planea = a.esp.id.includes('condor') || a.esp.id.includes('aguila');
      const bateo = planea
        ? Math.sin(a.fase * 1.1) * 0.10
        : Math.sin(a.fase * 11) * 0.62;
      p.alas[0].rotation.z = bateo;
      if (p.alas[1]) p.alas[1].rotation.z = -bateo;
    }

    // Patas alternadas en trote diagonal, como cualquier cuadrúpedo
    if (p.patas.length === 4) {
      const amp = Math.min(0.85, vel * 0.16);
      p.patas[0].rotation.x = Math.sin(a.fasePaso) * amp;
      p.patas[1].rotation.x = Math.sin(a.fasePaso + Math.PI) * amp;
      p.patas[2].rotation.x = Math.sin(a.fasePaso + Math.PI) * amp;
      p.patas[3].rotation.x = Math.sin(a.fasePaso) * amp;
    }

    if (p.cabeza) {
      if (a.estado === ESTADOS.PASTANDO) {
        // Cabeza abajo, ramoneando
        p.cabeza.rotation.x += (0.95 - p.cabeza.rotation.x) * Math.min(1, dt * 3);
        p.cabeza.rotation.y = Math.sin(a.fase * 1.6) * 0.22;
      } else if (a.estado === ESTADOS.ALERTA) {
        // Cabeza alta y quieta: la postura de vigilancia
        p.cabeza.rotation.x += (-0.22 - p.cabeza.rotation.x) * Math.min(1, dt * 6);
        p.cabeza.rotation.y = Math.sin(a.fase * 0.7) * 0.42;
      } else {
        p.cabeza.rotation.x += (0.05 - p.cabeza.rotation.x) * Math.min(1, dt * 2.5);
        p.cabeza.rotation.y = Math.sin(a.fase * 0.9) * 0.14;
      }
    }

    if (p.cuerpo) {
      p.cuerpo.position.y = (p.cuerpo.userData.y0 ?? 0) + Math.sin(a.fasePaso * 2) * Math.min(0.05, vel * 0.012);
    }
    if (p.cola) {
      p.cola.rotation.y = Math.sin(a.fase * 2.4) * (a.estado === ESTADOS.HUYENDO ? 0.5 : 0.18);
      p.cola.rotation.x = -0.3 + Math.sin(a.fase * 1.7) * 0.12;
    }
  }

  /** Modelo procedural cacheado por especie, ya compactado. */
  _obtenerModelo(esp) {
    if (this._geometrias.has(esp.id)) return this._geometrias.get(esp.id);
    const modelo = esp.clase === 'ave' ? construirAve(esp) : construirCuadrupedo(esp);
    compactar(modelo);
    this._geometrias.set(esp.id, modelo);
    return modelo;
  }

  /** El animal más cercano dentro de un radio, para identificar en el códice. */
  masCercano(posicion, radio = 60) {
    let mejor = null, mejorD = radio;
    for (const a of this.vivos) {
      const d = a.objeto.position.distanceTo(posicion);
      if (d < mejorD) { mejorD = d; mejor = a; }
    }
    return mejor;
  }
}

// ── Modelos procedurales ────────────────────────────────────────────────────

function material(color, rugosidad = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: 0 });
}

/**
 * Fusiona las mallas rígidas que cuelgan de un mismo pivote articulado.
 * La cabeza tenía cráneo, hocico, dos orejas y a veces astas: seis dibujos que
 * siempre se mueven juntos. Quedan en uno solo, y el pivote sigue animándose
 * igual. Con cuatro cascadas de sombra, cada malla que se ahorra vale cinco.
 */
function compactar(raiz) {
  const pivotes = [];
  raiz.traverse(o => { if (o.isGroup || o === raiz) pivotes.push(o); });

  for (const pivote of pivotes) {
    const mallas = pivote.children.filter(c => c.isMesh && c.children.length === 0);
    if (mallas.length < 2) continue;

    // Agrupamos por color de material: mantener dos o tres tonos por animal
    // conserva el contraste (pelaje, hocico, pezuñas) sin volver a explotar.
    const porColor = new Map();
    for (const m of mallas) {
      const clave = m.material.color.getHexString();
      if (!porColor.has(clave)) porColor.set(clave, []);
      porColor.get(clave).push(m);
    }

    for (const [, grupo] of porColor) {
      if (grupo.length < 2) continue;
      const geos = [];
      for (const m of grupo) {
        const g = m.geometry.clone();
        m.updateMatrix();
        g.applyMatrix4(m.matrix);
        geos.push(g);
      }
      const fusionada = fusionarGeometrias(geos);
      const nueva = new THREE.Mesh(fusionada, grupo[0].material);
      nueva.castShadow = true;
      nueva.receiveShadow = true;
      pivote.add(nueva);
      for (const m of grupo) { pivote.remove(m); m.geometry.dispose(); }
      for (const g of geos) g.dispose();
    }
  }
}

function fusionarGeometrias(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal;
    const c = p.count;
    pos.set(p.array.subarray(0, c * 3), vo * 3);
    if (n) nor.set(n.array.subarray(0, c * 3), vo * 3);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < c; i++) idx[io + i] = i + vo;
      io += c;
    }
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

function construirCuadrupedo(esp) {
  const g = new THREE.Group();
  const L = esp.largoM ?? 1;
  const H = esp.alturaCruzM ?? L * 0.6;
  const ancho = L * 0.34;

  const cPrincipal = new THREE.Color(esp.colorPrincipal || '#7a6248');
  const cSecundario = new THREE.Color(esp.colorSecundario || '#3d3128');
  const matCuerpo = material(cPrincipal);
  const matOscuro = material(cSecundario);

  // Tronco: elipsoide alargado
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), matCuerpo);
  cuerpo.scale.set(ancho, H * 0.34, L * 0.46);
  cuerpo.position.y = H * 0.74;
  cuerpo.name = 'cuerpo';
  cuerpo.userData.y0 = cuerpo.position.y;
  cuerpo.castShadow = true;
  g.add(cuerpo);

  // Cuello y cabeza como un pivote articulado
  const pivoteCabeza = new THREE.Group();
  pivoteCabeza.position.set(0, H * 0.86, L * 0.40);
  pivoteCabeza.name = 'cabeza';
  g.add(pivoteCabeza);

  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(ancho * 0.30, ancho * 0.42, H * 0.34, 7), matCuerpo);
  cuello.position.set(0, H * 0.13, L * 0.06);
  cuello.rotation.x = -0.55;
  cuello.castShadow = true;
  pivoteCabeza.add(cuello);

  const craneo = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), matCuerpo);
  craneo.scale.set(ancho * 0.42, ancho * 0.40, L * 0.15);
  craneo.position.set(0, H * 0.27, L * 0.16);
  craneo.castShadow = true;
  pivoteCabeza.add(craneo);

  const hocico = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), matOscuro);
  hocico.scale.set(ancho * 0.22, ancho * 0.20, L * 0.10);
  hocico.position.set(0, H * 0.24, L * 0.27);
  pivoteCabeza.add(hocico);

  // Orejas
  for (const lado of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.ConeGeometry(ancho * 0.13, H * 0.15, 5), matOscuro);
    oreja.position.set(lado * ancho * 0.26, H * 0.40, L * 0.12);
    oreja.rotation.z = lado * 0.35;
    pivoteCabeza.add(oreja);
  }

  // Astas del huemul macho: cornamenta bífida, su rasgo distintivo
  if (/huemul|ciervo/.test(esp.id)) {
    for (const lado of [-1, 1]) {
      const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, H * 0.36, 4), material('#6b5a3e'));
      asta.position.set(lado * ancho * 0.22, H * 0.55, L * 0.10);
      asta.rotation.z = lado * 0.45;
      asta.rotation.x = -0.25;
      pivoteCabeza.add(asta);
      const punta = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, H * 0.2, 4), material('#6b5a3e'));
      punta.position.set(lado * (ancho * 0.22 + H * 0.13), H * 0.70, L * 0.06);
      punta.rotation.z = lado * 0.95;
      pivoteCabeza.add(punta);
    }
  }

  // Patas
  const nombres = ['pd1', 'pi1', 'pd2', 'pi2'];
  const posiciones = [
    [ancho * 0.62, L * 0.30], [-ancho * 0.62, L * 0.30],
    [ancho * 0.62, -L * 0.28], [-ancho * 0.62, -L * 0.28],
  ];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group();
    pivote.position.set(posiciones[i][0], H * 0.62, posiciones[i][1]);
    pivote.name = nombres[i];
    g.add(pivote);

    const muslo = new THREE.Mesh(new THREE.CylinderGeometry(ancho * 0.15, ancho * 0.10, H * 0.62, 6), matCuerpo);
    muslo.position.y = -H * 0.31;
    muslo.castShadow = true;
    pivote.add(muslo);

    const pezuna = new THREE.Mesh(new THREE.CylinderGeometry(ancho * 0.10, ancho * 0.12, H * 0.07, 6), matOscuro);
    pezuna.position.y = -H * 0.60;
    pivote.add(pezuna);
  }

  // Cola
  const cola = new THREE.Group();
  cola.position.set(0, H * 0.78, -L * 0.44);
  cola.name = 'cola';
  g.add(cola);
  const colaMalla = new THREE.Mesh(new THREE.ConeGeometry(ancho * 0.16, L * 0.24, 6), matOscuro);
  colaMalla.position.y = -L * 0.10;
  colaMalla.rotation.x = Math.PI;
  cola.add(colaMalla);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function construirAve(esp) {
  const g = new THREE.Group();
  const L = esp.largoM ?? 0.3;
  const envergadura = (esp.pesoKg ?? 0.3) > 3 ? L * 3.4 : L * 1.9;

  const cPrincipal = new THREE.Color(esp.colorPrincipal || '#3a3a3a');
  const cSecundario = new THREE.Color(esp.colorSecundario || '#1a1a1a');
  const matCuerpo = material(cPrincipal, 0.72);
  const matAla = material(cSecundario, 0.78);

  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), matCuerpo);
  cuerpo.scale.set(L * 0.26, L * 0.26, L * 0.52);
  cuerpo.name = 'cuerpo';
  cuerpo.userData.y0 = 0;
  g.add(cuerpo);

  const cabeza = new THREE.Group();
  cabeza.position.set(0, L * 0.14, L * 0.44);
  cabeza.name = 'cabeza';
  g.add(cabeza);
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(L * 0.16, 8, 6), matCuerpo);
  cabeza.add(craneo);
  const pico = new THREE.Mesh(new THREE.ConeGeometry(L * 0.06, L * 0.20, 6), material('#c8a24a', 0.5));
  pico.rotation.x = Math.PI / 2;
  pico.position.z = L * 0.19;
  cabeza.add(pico);

  // El cóndor tiene collar blanco: es su marca inconfundible
  if (/condor/.test(esp.id)) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(L * 0.19, L * 0.055, 6, 14), material('#f0efe8', 0.9));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, L * 0.04, L * 0.34);
    g.add(collar);
  }

  for (const [nombre, lado] of [['ala_d', 1], ['ala_i', -1]]) {
    const pivote = new THREE.Group();
    pivote.position.set(lado * L * 0.16, L * 0.08, 0);
    pivote.name = nombre;
    g.add(pivote);
    const ala = new THREE.Mesh(new THREE.BoxGeometry(envergadura * 0.5, L * 0.035, L * 0.42), matAla);
    ala.position.x = lado * envergadura * 0.25;
    ala.castShadow = true;
    pivote.add(ala);
    // Plumas primarias abiertas en la punta, como los dedos del cóndor planeando
    for (let i = 0; i < 5; i++) {
      const pluma = new THREE.Mesh(new THREE.BoxGeometry(envergadura * 0.13, L * 0.02, L * 0.07), matAla);
      pluma.position.set(lado * (envergadura * 0.5 + envergadura * 0.06), 0, (i - 2) * L * 0.08);
      pluma.rotation.y = lado * (i - 2) * 0.10;
      pivote.add(pluma);
    }
  }

  const cola = new THREE.Group();
  cola.position.set(0, 0, -L * 0.48);
  cola.name = 'cola';
  g.add(cola);
  const colaMalla = new THREE.Mesh(new THREE.BoxGeometry(L * 0.30, L * 0.025, L * 0.30), matAla);
  colaMalla.position.z = -L * 0.14;
  cola.add(colaMalla);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
