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
import { cargarAtlasFauna, texturasParaEspecie } from '../util/atlas.js';

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

    /**
     * El motor de audio, si está cableado. Lo pone main.js. Si no está, la
     * fauna es muda y todo lo demás anda igual: el bosque no se rompe por no
     * tener voz, sólo queda como estaba.
     */
    this.audio = null;
    this._proxCanto = 3;
    this._silencio = 0;
    this._cantos = 0;       // cuántas frases se pidieron (para medir)
    this._alarmas = 0;

    /**
     * El atlas de textura de la fase 1 se pide **una sola vez por sesión y desde
     * acá**. `cargarAtlasFauna()` memoiza también el fracaso, así que quien lo
     * llama primero define el resultado para todos: si se lo invocara antes de
     * que `public/tex/` esté servido, la fauna quedaría con colores planos hasta
     * recargar.
     *
     * No se lo espera: el arranque no puede depender de que el horneador haya
     * corrido. Cuando resuelve se **mutan los materiales ya cacheados** en vez
     * de reconstruir modelos, y como `_crear()` clona compartiendo material, los
     * animales que ya están vivos se visten solos. Si no está el atlas, no queda
     * ni un mapa colgado y el juego arma las 44 especies igual que siempre.
     */
    this.atlasListo = false;
    cargarAtlasFauna().then(atlas => {
      aplicarAtlas(atlas);
      this.atlasListo = !!(atlas && atlas.disponible);
    }).catch(() => { /* el cargador no rechaza; si algún día lo hiciera, colores planos */ });
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

    this._vocalizar(dt, jugador, estado, hora, tiempoTotal);
  }

  // ── El bosque suena ─────────────────────────────────────────────────────────

  /**
   * Decide quién canta y cuándo. La síntesis es de Audio; la ecología es de acá,
   * porque acá está la población: si en este punto hay un chucao vivo es porque
   * `_aptitud` ya comprobó que el lugar es bosque de coihue con sotobosque, a la
   * altitud correcta, en una estación en la que la especie está activa. Volver a
   * preguntarlo del lado del audio sería duplicar la lógica y, tarde o temprano,
   * contradecir el dataset.
   */
  _vocalizar(dt, jugador, est, hora, t) {
    const audio = this.audio;
    if (!audio?.listo) return;

    // Después de una alarma el monte se calla. Ese silencio repentino es
    // información: significa que algo pasó, y lo nota cualquiera que camine.
    if (this._silencio > 0) { this._silencio -= dt; return; }

    // Con lluvia fuerte los pájaros paran. Con granizo, más todavía. Y el viento
    // fuerte tapa el canto y además los hace buscar reparo.
    const agua = Math.max(est.lluvia ?? 0, est.granizo ?? 0, (est.nieve ?? 0) * 0.5);
    const viento = Math.min(1, (est.vientoKmh ?? 12) / 75);
    let ganas = Math.max(0, 1 - agua * 2.4) * (1 - viento * 0.75);

    // El coro del amanecer no es una licencia poética: es la hora de más canto
    // del día y por lejos. El del atardecer existe pero es más corto y más flojo.
    const alba = Math.exp(-((hora - 7.0) ** 2) / 2.0);
    const ocaso = Math.exp(-((hora - 19.8) ** 2) / 2.4);
    ganas *= 0.30 + alba * 2.2 + ocaso * 0.85;
    if (ganas < 0.02) return;

    // Proceso de Poisson. El intervalo sale de una exponencial, así que no hay
    // período: es la única forma de que no aparezca un pulso audible. Un
    // temporizador fijo con un poco de ruido encima sigue teniendo período y el
    // oído lo encuentra en dos minutos, que es cuando la ambientación se vuelve
    // insoportable.
    this._proxCanto -= dt * ganas;
    if (this._proxCanto > 0) return;
    this._proxCanto = 1.4 - Math.log(1 - Math.random()) * 4.6;

    // ── Quién canta
    let suma = 0;
    const cand = [], pesos = [];
    for (const a of this.vivos) {
      if (a.estado === ESTADOS.HUYENDO) continue;      // el que huye no canta
      if (t - (a.ultimoCanto ?? -999) < 14) continue;  // ni el que acaba de cantar
      if (!audio.tieneVoz(a.esp.id)) continue;
      // El ciervo colorado sólo brama en otoño. Fuera de la brama está callado,
      // y un bramido en primavera sería inventar.
      if (a.esp.id === 'ciervo_colorado' && est.estacion !== 'otono') continue;
      let p = this._actividad(a.esp, hora);
      // El ambiente sonoro del bosque lo hacen las aves: a un mamífero se lo oye
      // cuando ya te vio, y para eso está la alarma, no el coro.
      p *= a.esp.clase === 'ave' ? 3.2 : 0.35;
      if (p < 0.02) continue;
      cand.push(a); pesos.push(p); suma += p;
    }
    if (!cand.length) return;

    let ruleta = Math.random() * suma, i = 0;
    for (; i < pesos.length - 1; i++) {
      ruleta -= pesos[i];
      if (ruleta <= 0) break;
    }
    const a = cand[i];
    const alcance = audio.alcanceVoz(a.esp.id);

    // ── Dónde está el que canta
    let dx = a.objeto.position.x - jugador.posicion.x;
    let dz = a.objeto.position.z - jugador.posicion.z;
    let d = Math.hypot(dx, dz);
    if (d > alcance * 0.85) {
      // Fauna simula cincuenta y dos animales y en el parque hay miles: el que
      // canta es casi siempre uno de los que no se simulan. Ponerlo a una
      // distancia plausible es más honesto que fingir que el bosque son estos
      // cincuenta y dos, y además es como se oye de verdad: se escuchan muchos
      // más pájaros de los que se ven.
      const ang = Math.random() * Math.PI * 2;
      d = alcance * (0.10 + Math.random() * 0.65);
      dx = Math.sin(ang) * d;
      dz = Math.cos(ang) * d;
    } else {
      a.ultimoCanto = t;
    }

    this._cantos++;
    if (audio.voz(a.esp.id, {
      distancia: d,
      azimut: this._azimut(dx, dz, d, jugador.giro),
      variante: this._variante(a.esp.id, hora),
    })) {
      a.ultimoCanto = t;
    }
  }

  /**
   * De qué lado suena. El frente de la cámara es (−sin giro, −cos giro), así que
   * su derecha es (cos giro, −sin giro): proyectar ahí la dirección al animal da
   * el paneo directo, sin pasar por un atan2.
   */
  _azimut(dx, dz, d, giro) {
    if (d < 0.001) return 0;
    return (dx * Math.cos(giro) - dz * Math.sin(giro)) / d;
  }

  /**
   * Algunas especies tienen más de una voz y la ficha dice cuándo va cada una:
   * el zorzal canta flauteado al amanecer y da un chuc-chuc seco de alarma al
   * atardecer, y en el cauquén el macho silba fino y la hembra cacarea grave.
   */
  _variante(id, hora) {
    if (id === 'zorzal_patagonico') {
      return hora > 15 ? 'zorzal_patagonico_alarma' : 'zorzal_patagonico';
    }
    if (id === 'cauquen_comun' && Math.random() < 0.45) return 'cauquen_comun_hembra';
    return id;
  }

  /**
   * El grito de alarma del que acaba de ver al jugador. No entra en el sorteo
   * del coro: se dispara solo, tiene su propio ritmo —el de cuánto te acercás— y
   * arrastra al bosque a callarse unos segundos detrás.
   */
  _alarma(a, jugador, t) {
    const audio = this.audio;
    if (!audio?.listo || !audio.tieneVoz(a.esp.id)) return;
    if (t - (a.ultimaAlarma ?? -999) < 8) return;
    a.ultimaAlarma = t;

    const dx = a.objeto.position.x - jugador.posicion.x;
    const dz = a.objeto.position.z - jugador.posicion.z;
    const d = Math.hypot(dx, dz);
    this._alarmas++;
    if (audio.voz(a.esp.id, {
      distancia: d,
      azimut: this._azimut(dx, dz, d, jugador.giro),
      ganancia: 1.35,            // el grito de alarma es más fuerte que el canto
      variante: a.esp.id === 'zorzal_patagonico' ? 'zorzal_patagonico_alarma' : a.esp.id,
    })) {
      this._silencio = 4 + Math.random() * 5;
    }
  }

  /**
   * El pánico se contagia. Una tropa de guanacos no huye de a uno: el centinela
   * relincha y se van todos juntos, y una bandada de cachañas levanta entera.
   * Esto es lo que separa un grupo de un montón de individuos que casualmente
   * están parados cerca —que es lo que eran hasta ahora—.
   */
  _contagiar(origen, jugador, t) {
    if (!origen.esp.gregario) return;
    const p = origen.objeto.position;
    for (const b of this.vivos) {
      if (b === origen || b.esp.id !== origen.esp.id) continue;
      if (b.estado === ESTADOS.HUYENDO) continue;
      if (b.objeto.position.distanceTo(p) > 45) continue;
      b.estado = ESTADOS.HUYENDO;
      b.temporizador = 3 + Math.random() * 3;
      b.direccion = Math.atan2(
        b.objeto.position.x - jugador.posicion.x,
        b.objeto.position.z - jugador.posicion.z
      );
      // Ya está avisado: no hace falta que grite cada uno por su cuenta, que es
      // como se convierte una alarma en un coro de alarmas.
      b.ultimaAlarma = t;
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
    //
    // La distancia de fuga sale del dataset y es contenido educativo: el pudú
    // rompe a los 20 m, el zorro gris deja acercarse hasta 30, el huemul a los
    // 45, el guanaco a los 100. Estaba multiplicada por 0,55, así que todos
    // aguantaban casi el doble de cerca de lo que aguantan de verdad —un huemul
    // que te deja llegar a veinticinco metros no es un huemul—. Ahora se usa el
    // número tal cual, y lo único que lo mueve es cómo camina el jugador.
    const sigilo = jugador.agachado ? 0.55 : (jugador.corriendo ? 1.4 : 1);
    const huida = (esp.distanciaHuidaM ?? 30) * sigilo;
    const agresivo = (esp.agresividad ?? 0) > 0.55;
    const yaHuia = a.estado === ESTADOS.HUYENDO;

    if (!a.vuela) {
      if (distancia < huida && !agresivo) {
        a.estado = ESTADOS.HUYENDO;
        a.temporizador = 3.5 + Math.random() * 3;
        // Huye en dirección opuesta al jugador
        a.direccion = Math.atan2(
          a.objeto.position.x - jugador.posicion.x,
          a.objeto.position.z - jugador.posicion.z
        );
        // El grito va una sola vez, al romper: mientras corre no grita.
        if (!yaHuia) {
          this._alarma(a, jugador, t);
          this._contagiar(a, jugador, t);
        }
      } else if (distancia < huida * 1.9 && !yaHuia) {
        // Antes de romper hay un rato de vigilancia. Ese margen es lo que
        // permite verlos: si pasaran de pastar a correr sin pausa, el jugador
        // sólo vería ancas alejándose.
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

      // Un pájaro asustado no corre: despega. Las aves de menos de kilo y medio
      // andan por el suelo —chucao, rayadito, cachaña— y el modelo de ave ni
      // siquiera tiene patas que animar, así que huyendo patinaban. Ahora se
      // levantan del piso mientras dura el susto y bajan solas después.
      if (esp.clase === 'ave') {
        a.vuelito = Math.max(0, Math.min(1,
          (a.vuelito ?? 0) + dt * (a.estado === ESTADOS.HUYENDO ? 2.4 : -1.2)));
        if (a.vuelito > 0.002) {
          a.objeto.position.y += a.vuelito * (2.5 + (esp.largoM ?? 0.2) * 14);
          // En el aire el terreno ya no manda: se endereza y cabecea con el vuelo
          a.objeto.rotation.x *= 1 - a.vuelito;
          a.objeto.rotation.z = a.objeto.rotation.z * (1 - a.vuelito)
                              + Math.sin(a.fase * 3.1) * 0.22 * a.vuelito;
        }
      }
    }

    this._animar(a, dt);
  }

  _animar(a, dt) {
    const p = a.partes;
    const vel = a.velocidad;
    const zancada = vel * 2.4 / Math.max(0.4, (a.esp.alturaCruzM ?? 0.6));
    a.fasePaso = (a.fasePaso ?? 0) + zancada * dt;

    if ((a.vuela || (a.vuelito ?? 0) > 0.002) && p.alas.length) {
      // El cóndor planea: bate poco y sostiene las alas extendidas
      const planea = a.esp.id.includes('condor') || a.esp.id.includes('aguila');
      // El que acaba de despegar bate desesperado; el bateo se apaga con el
      // vuelito, así que al posarse las alas vuelven a quedarse quietas.
      const bateo = a.vuela
        ? (planea ? Math.sin(a.fase * 1.1) * 0.10 : Math.sin(a.fase * 11) * 0.62)
        : Math.sin(a.fase * 17) * 0.75 * a.vuelito;
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


// ── Textura: un material por especie, vestido cuando llega el atlas ─────────
//
// El cargador (`src/util/atlas.js`) memoiza también el fracaso y para toda la
// sesión, así que **quien lo llama primero define el resultado para todos**.
// Por eso se lo llama en un solo lugar —el constructor de `Fauna`— y no se lo
// espera: si `public/tex/` no está horneado, el juego arranca igual con los
// colores planos de siempre y ni un mapa queda colgado.
//
// Cuando el atlas llega, no se reconstruye ningún modelo: se **mutan los
// materiales ya cacheados**. Como `_crear()` hace `clone(true)` —que comparte
// el material con el modelo de la especie— los animales que ya están vivos se
// visten solos, y el orden de llegada deja de importar.

/** Materiales de piel, uno por especie. Compartidos por todos los individuos. */
const MATERIALES = new Map();

/** El atlas, si llegó. `null` mientras tanto; nunca vuelve a `null`. */
let ATLAS = null;

/** Cuántas especies quedaron con mapas puestos. Se lee desde `Fauna`. */
let VESTIDAS = 0;

/**
 * Anisotropía de los mapas de fauna.
 *
 * El terreno usa 16 (`Mundo.js:578`) y el follaje 8 (`Vegetacion.js:993`). Un
 * animal no es un plano infinito visto de canto como el suelo: es un volumen
 * chico, en movimiento, y su celda de atlas mide 128 px. 16 paga muestras extra
 * para una superficie que casi nunca está en el ángulo que las justifica; 0 lo
 * deja más borroso que el pasto que tiene al lado. 8 es la del vecino visual
 * directo, se paga en ancho de banda —donde esta máquina gana 2,3×— y three la
 * recorta sola al máximo del driver, así que no puede pedir de más.
 */
const ANISOTROPIA = 8;

/**
 * Material de una especie. Uno solo, con `vertexColors`: el tono de cada pieza
 * (hocico, pezuña, oreja, pico, asta) viaja en un atributo por vértice en vez
 * de en un material aparte.
 *
 * El motivo es el presupuesto de dibujos, no la elegancia: `compactar()` sólo
 * puede fusionar piezas que comparten material, y con cuatro cascadas de sombra
 * cada malla se dibuja cinco veces. Con un material por especie un cuadrúpedo
 * pasa de 12–13 mallas a 7. En el fragmento, el color por vértice es una
 * multiplicación —no una lectura de textura ni ALU cara—, que es la moneda
 * barata en esta máquina.
 *
 * `color` queda en blanco puro a propósito: un albedo negro por cualquier luz
 * sigue siendo negro, y ése es el artefacto que la ronda 1 pagó con las piedras.
 */
function materialDeEspecie(esp) {
  const yaEsta = MATERIALES.get(esp.id);
  if (yaEsta) return yaEsta;
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: esp.clase === 'ave' ? 0.72 : 0.85,
    metalness: 0,
    vertexColors: true,
  });
  m.name = `fauna:${esp.id}`;
  MATERIALES.set(esp.id, m);
  if (ATLAS) vestir(m, esp.id);
  return m;
}

/**
 * Le enchufa a un material los tres mapas de su especie.
 *
 * El mapa combinado va a `roughnessMap` **y** a `aoMap` sin tocar un canal: el
 * horno escribe la convención ORM de glTF (R = oclusión, G = rugosidad) y three
 * lee exactamente eso —`aomap_fragment` toma el canal R, `roughnessmap_fragment`
 * el G—. Nada de `onBeforeCompile` ni de swizzles.
 *
 * `aoMap` usa el atributo `uv` (canal 0) en three 0.169: `Texture.channel = 0`
 * y `WebGLPrograms` deriva `aoMapUv` de ahí. La nota de la cabecera de
 * `atlas.js` que habla de un segundo set `uv2` es de three anterior a r151 y ya
 * no aplica; no hace falta duplicar ningún atributo.
 *
 * @returns {boolean} si la especie tenía celda horneada
 */
function vestir(material, especieId) {
  const t = texturasParaEspecie(ATLAS, especieId);
  if (!t) return false;
  for (const tex of [t.albedo, t.normal, t.rugosidadOclusion]) tex.anisotropy = ANISOTROPIA;
  material.map = t.albedo;
  material.normalMap = t.normal;
  material.roughnessMap = t.rugosidadOclusion;
  material.aoMap = t.rugosidadOclusion;
  // Con mapa de rugosidad el escalar multiplica al texel; dejarlo en 0.85
  // aplanaría lo que el horno se tomó el trabajo de variar. El mapa manda.
  material.roughness = 1;
  material.needsUpdate = true;   // cambia el programa: de ahora en más lee mapas
  VESTIDAS++;
  return true;
}

/**
 * Viste todos los materiales ya cacheados. Se llama una sola vez, cuando
 * resuelve `cargarAtlasFauna()`.
 * @returns {number} especies vestidas
 */
function aplicarAtlas(atlas) {
  if (!atlas || !atlas.disponible) return 0;
  ATLAS = atlas;
  let n = 0;
  for (const [id, m] of MATERIALES) if (vestir(m, id)) n++;
  return n;
}

/**
 * Cuántas especies tienen los mapas puestos ahora mismo. No es lo mismo que lo
 * que devolvió `aplicarAtlas()`: el atlas suele llegar **antes** de que se arme
 * el primer modelo, así que en ese momento no hay ni un material cacheado y las
 * especies se visten después, una por una, al construirse.
 */
export function especiesVestidas() {
  return VESTIDAS;
}

/** Sólo para los bancos: deja el módulo como recién importado. */
export function _reiniciarAtlasFauna() {
  for (const m of MATERIALES.values()) m.dispose();
  MATERIALES.clear();
  ATLAS = null;
  VESTIDAS = 0;
}

// ── Modelos procedurales ────────────────────────────────────────────────────

/**
 * Escribe el color de una geometría como atributo por vértice.
 * `THREE.Color` ya convierte de sRGB al espacio lineal de trabajo (la gestión
 * de color está activa: `main.js` fija `outputColorSpace = SRGBColorSpace`), que
 * es justo el espacio en el que el shader espera el atributo. Sin atlas el
 * resultado en pantalla es idéntico al color plano de antes.
 */
function pintar(geo, color) {
  const n = geo.attributes.position.count;
  const c = color.isColor ? color : new THREE.Color(color);
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/**
 * Escribe el V de una pieza ya colocada en su pivote, remapeándolo a la banda
 * del atlas que le toca a esa parte del animal.
 *
 * V sale de la **posición del vértice sobre un eje declarado** —la altura, casi
 * siempre—: eso es lo que produce el contrasombreado, porque el atlas trae el
 * dorso en V∈[0.14,0.62] y el vientre en [0.62,0.86] y acá se decide qué vértice
 * cae en cuál. U se conserva del primitivo, que es el eje sobre el que el horno
 * dibuja el patrón y las estrías de pelo.
 *
 * `desde` mapea a `v0` y `hasta` a `v1`; para la altura eso significa pasar el
 * techo en `desde` y el piso en `hasta`. Fuera del rango se recorta, así que una
 * pieza que sobresale (un asta) queda en el borde de su banda y nunca se escapa
 * a la banda vecina.
 *
 * De paso **recorta U a [0,1]**, y no es cosmético: `SphereGeometry` corrige el
 * U de sus polos con ±0.5/widthSegments, así que el hocico —una esfera de 7
 * segmentos— sale con U entre −0,071 y 1,071. Como `texturasParaEspecie()` mapea
 * [0,1] a la celda de la especie con `offset`/`repeat`, ese sobrante cae **en la
 * celda vecina del atlas**: el hocico de un animal muestreando el pelaje de
 * otro, sin error y sin aviso. El `ClampToEdgeWrapping` de las texturas no
 * salva, porque recorta contra el borde del atlas entero, no contra el de la
 * celda.
 */
function banda(geo, { v0, v1, eje = 'y', desde, hasta }) {
  const p = geo.attributes.position;
  const n = p.count;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(n * 2), 2);
    geo.setAttribute('uv', uv);
  }
  const rango = hasta - desde;
  for (let i = 0; i < n; i++) {
    const w = eje === 'ax' ? Math.abs(p.getX(i))
            : eje === 'az' ? Math.abs(p.getZ(i))
            : p.getY(i);
    let t = Math.abs(rango) < 1e-9 ? 0.5 : (w - desde) / rango;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    uv.setY(i, v0 + t * (v1 - v0));
    const u = uv.getX(i);
    if (u < 0) uv.setX(i, 0); else if (u > 1) uv.setX(i, 1);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Coloca la geometría de una pieza en el espacio de su pivote, horneando la
 * transformación en los vértices en vez de dejarla en la malla.
 *
 * Se hace así para que `banda()` pueda leer la altura real del vértice dentro
 * del animal —una oreja rotada 0,35 rad no tiene su Y local alineada con la Y
 * del modelo— y para que `compactar()` fusione sobre una matriz identidad.
 */
function pieza(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  if (x || y || z) geo.translate(x, y, z);
  return geo;
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
    // Una malla **con nombre** nunca se fusiona. `_animar()` busca `cuerpo` por
    // `getObjectByName` y le lee `userData.y0`; fusionarla borraría las dos
    // cosas sin lanzar nada y el animal se quedaría quieto para siempre. Con un
    // material por especie eso pasaría de verdad: en el cóndor, `cuerpo` y el
    // collar son mallas hermanas que antes no se fusionaban sólo porque tenían
    // colores distintos. Cuesta un dibujo en una especie y cierra el agujero.
    const mallas = pivote.children.filter(c => c.isMesh && !c.name && c.children.length === 0);
    if (mallas.length < 2) continue;

    // Se agrupa por **identidad de material**, no por color. Con mapas, dos
    // piezas del mismo color pueden estar mirando celdas distintas del atlas:
    // fusionarlas bajo `grupo[0].material` deja a una con el pelaje de la otra,
    // sin error y sin aviso.
    const porMaterial = new Map();
    for (const m of mallas) {
      const clave = m.material.uuid;
      if (!porMaterial.has(clave)) porMaterial.set(clave, []);
      porMaterial.get(clave).push(m);
    }

    for (const [, grupo] of porMaterial) {
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

/**
 * Relleno neutro por atributo, para la pieza que llegue sin él.
 * `uv` va al centro de la celda y no a la esquina `(0,0)`: la esquina cae dentro
 * de los 8 px de guarda replicada del atlas, el centro es contenido real.
 */
const RELLENO = { uv: [0.5, 0.5], uv1: [0.5, 0.5], uv2: [0.5, 0.5], color: [1, 1, 1], normal: [0, 1, 0] };

/**
 * Une geometrías copiando la **unión** de sus atributos, no la intersección.
 *
 * Antes copiaba `position`, `normal` e `index` y nada más. Con `map` puesto, una
 * malla fusionada **sin `uv`** recibe (0,0) en todos sus vértices y muestrea un
 * único texel: el animal entero sale de un color plano, sin error ni aviso. Es
 * el mismo defecto silencioso que arregla la clave de `compactar()`, diez líneas
 * más arriba.
 *
 * Por eso tampoco se intersecta: si una sola pieza del grupo viniera sin `uv`,
 * intersectar dejaría **toda** la malla fusionada sin `uv` y reintroduciría el
 * defecto por la puerta de atrás. Con la unión, el daño queda acotado a la pieza
 * que faltaba, y con un relleno neutro que además es visible-correcto.
 */
function fusionarGeometrias(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }

  const tam = new Map();   // nombre de atributo -> itemSize
  for (const g of geos) {
    for (const nombre of Object.keys(g.attributes)) {
      const a = g.attributes[nombre];
      if (!tam.has(nombre)) tam.set(nombre, a.itemSize);
    }
  }

  const buffers = new Map();
  for (const [nombre, size] of tam) buffers.set(nombre, new Float32Array(nv * size));
  const idx = new Uint32Array(ni);

  let vo = 0, io = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    for (const [nombre, size] of tam) {
      const destino = buffers.get(nombre);
      const a = g.attributes[nombre];
      const copiable = a && a.itemSize === size && !a.normalized && ArrayBuffer.isView(a.array)
        && typeof a.array.subarray === 'function' && !(a.array instanceof Uint8Array);
      if (copiable) {
        destino.set(Float32Array.from(a.array.subarray(0, c * size)), vo * size);
      } else {
        const def = RELLENO[nombre] || new Array(size).fill(0);
        for (let i = 0; i < c; i++) {
          for (let k = 0; k < size; k++) destino[(vo + i) * size + k] = def[k] ?? 0;
        }
      }
    }
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
  for (const [nombre, size] of tam) {
    out.setAttribute(nombre, new THREE.BufferAttribute(buffers.get(nombre), size));
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// ── Silueta ─────────────────────────────────────────────────────────────────
//
// El tronco dejó de ser una esfera escalada. `SphereGeometry(1,12,9)` con
// `scale(L*0.34, H*0.34, L*0.46)` daba, en el huemul, un elipsoide de 0,546 m³:
// a densidad de mamífero, **546 kg de tronco sobre un animal que la ficha
// declara de 75**. Y no era sólo el ancho: el semilargo `L*0.46` hacía un tronco
// del 92 % del largo del animal —con la cabeza naciendo adentro— y el semialto
// `H*0.34` metía el 68 % de la alzada en el pecho, dejándole al huemul 29 cm de
// pata. `pesoKg` estaba en las 44 fichas sin usarse para nada de la forma.
//
// Ahora las tres medidas del tronco salen de los datos: el largo y el fondo de
// proporciones de cuadrúpedo, y **el ancho despejado del volumen**.

/** Fracción de la masa corporal que va en el tronco (el resto: cabeza, cuello, patas, cola). */
const FRACCION_MASA_TRONCO = 0.65;
/** Densidad de un mamífero, kg/m³. */
const DENSIDAD_MAMIFERO = 1000;
/**
 * Densidad efectiva del cuerpo emplumado de un ave, kg/m³. No es agua: los sacos
 * aéreos y la pluma inflan el contorno visible muy por encima de la masa.
 * Contrastada con el cóndor —12 kg y 1,2 m dan 22 cm de ancho de cuerpo, que es
 * la medida real— y con el rayadito en el otro extremo.
 */
const DENSIDAD_AVE = 500;
const FRACCION_MASA_TRONCO_AVE = 0.85;

/**
 * Perfil del tronco de un cuadrúpedo, de pecho (s=0) a grupa (s=1).
 * `w` es el semiancho relativo; `t` y `p` son el techo y el piso de la sección,
 * en unidades del semialto. La **cruz** está en s=0.28 (el techo más alto), el
 * **lomo** baja en 0.64 y la **grupa** vuelve a subir en 0.82; la panza se
 * recoge hacia atrás. Eso es lo que separa un cuadrúpedo de una cápsula, y con
 * 12 radiales sale en 192 triángulos: **exactamente los mismos** que la esfera
 * de 12×9 que reemplaza (12·9·2 − 24 = 192).
 */
const PERFIL_TRONCO = [
  { s: 0.00, w: 0.42, t: 0.55, p: -0.50 },
  { s: 0.12, w: 0.88, t: 0.92, p: -0.92 },
  { s: 0.28, w: 1.00, t: 1.06, p: -1.00 },
  { s: 0.46, w: 0.95, t: 0.98, p: -0.98 },
  { s: 0.64, w: 0.90, t: 0.95, p: -0.94 },
  { s: 0.82, w: 0.94, t: 1.02, p: -0.80 },
  { s: 0.94, w: 0.66, t: 0.86, p: -0.55 },
  { s: 1.00, w: 0.22, t: 0.40, p: -0.20 },
];

/** Perfil del cuerpo de un ave: quilla honda adelante, afinándose a la cola. */
const PERFIL_AVE = [
  { s: 0.00, w: 0.55, t: 0.62, p: -0.55 },
  { s: 0.15, w: 0.94, t: 0.95, p: -0.96 },
  { s: 0.34, w: 1.00, t: 1.00, p: -1.00 },
  { s: 0.55, w: 0.93, t: 0.96, p: -0.88 },
  { s: 0.74, w: 0.76, t: 0.86, p: -0.66 },
  { s: 1.00, w: 0.26, t: 0.42, p: -0.26 },
];

/**
 * `dieta` es el tercer campo de forma que estaba en la ficha sin usarse para la
 * silueta (los otros dos son `pesoKg` y `alturaCruzM/largoM`). Un rumiante tiene
 * panza; un felino tiene el pecho hondo y el abdomen recogido. Hoy `dieta` sólo
 * decidía si el animal pasta.
 */
function perfilSegunDieta(dieta) {
  const p = PERFIL_TRONCO.map(e => ({ ...e }));
  if (dieta === 'herbivoro' || dieta === 'frugivoro') {
    for (const e of p) if (e.s > 0.40 && e.s < 0.92) { e.p *= 1.10; e.w *= 1.06; }
  } else if (dieta === 'carnivoro' || dieta === 'piscivoro') {
    for (const e of p) {
      if (e.s < 0.40) { e.p *= 1.08; e.w *= 1.03; }
      if (e.s > 0.55) { e.p *= 0.80; e.w *= 0.92; }
    }
  }
  return p;
}

/**
 * Volumen del barrido, en unidades de (semiancho · semialto · largo total).
 * Se integra numéricamente sobre el perfil real —∫ π·w·h ds— y **no** con la
 * fórmula del elipsoide, porque la geometría ya no es un elipsoide: usar
 * (4/3)πabc sobre un tronco con cruz y grupa daría un ancho equivocado.
 */
function volumenPerfil(perfil) {
  let v = 0;
  for (let i = 1; i < perfil.length; i++) {
    const a = perfil[i - 1], b = perfil[i];
    const fa = a.w * (a.t - a.p) / 2;
    const fb = b.w * (b.t - b.p) / 2;
    v += (fa + fb) / 2 * (b.s - a.s);
  }
  return Math.PI * v;
}

/**
 * El semiancho del tronco, despejado de la masa de la ficha.
 * Con clamp a [0.25, 1.6] veces el semialto: por debajo es una plancha, por
 * encima un barril. Ninguna de las 21 especies de mamífero llega al clamp — está
 * para que un dato raro o ausente no produzca un monstruo.
 */
function semianchoTronco(pesoKg, semialto, largoTronco, perfil) {
  const k = volumenPerfil(perfil) * semialto * largoTronco;
  const objetivo = FRACCION_MASA_TRONCO * (pesoKg ?? 0) / DENSIDAD_MAMIFERO;
  const a = (k > 1e-9 && objetivo > 0) ? objetivo / k : semialto * 0.55;
  return Math.min(semialto * 1.6, Math.max(semialto * 0.25, a));
}

/** Volumen encerrado por una malla cerrada, por el teorema de la divergencia. */
function volumenMalla(geo) {
  const p = geo.attributes.position, ix = geo.index;
  if (!ix) return 0;
  let v6 = 0;
  for (let k = 0; k < ix.count; k += 3) {
    const A = ix.array[k], B = ix.array[k + 1], C = ix.array[k + 2];
    const ax = p.getX(A), ay = p.getY(A), az = p.getZ(A);
    const bx = p.getX(B), by = p.getY(B), bz = p.getZ(B);
    const cx = p.getX(C), cy = p.getY(C), cz = p.getZ(C);
    v6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(v6) / 6;
}

/**
 * Ajusta la sección del tronco hasta que su volumen sea el que la ficha pide,
 * **medido sobre la malla real** y no sobre la integral del perfil.
 *
 * La diferencia no es un decimal: la sección es un polígono de 12 lados inscrito
 * en la elipse (95,5 % de su área) y las estaciones se comprimen a [0.06,0.94]
 * para que el tronco cierre en punta. Entre las dos cosas se pierde un 14 % de
 * volumen, y la masa entregada quedaba en el 55 % del cuerpo en vez del 65 %
 * declarado. Medir la malla cierra el número: si el ancho tiene que salir de la
 * masa, tiene que salir de la masa que el tronco **tiene**, no de la que
 * tendría si fuera un elipsoide perfecto.
 *
 * @param {'x'|'xy'} ejes 'x' en el cuadrúpedo, donde el fondo lo fija la alzada;
 *                        'xy' en el ave, que tiene sección redonda.
 * @param {[number,number]} limites clamp del factor
 * @returns {number} el factor aplicado
 */
function escalarAVolumen(geo, objetivo, ejes, limites) {
  const v = volumenMalla(geo);
  if (!(v > 1e-12) || !(objetivo > 0)) return 1;
  let k = ejes === 'xy' ? Math.sqrt(objetivo / v) : objetivo / v;
  k = Math.min(limites[1], Math.max(limites[0], k));
  if (Math.abs(k - 1) < 1e-6) return k;
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * k);
    if (ejes === 'xy') p.setY(i, p.getY(i) * k);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return k;
}

/** Lo mismo para un ave, que además tiene el semialto atado al semiancho. */
function semianchoAve(pesoKg, L) {
  const largo = 2 * 0.24 * L;
  const k = volumenPerfil(PERFIL_AVE) * 1.15 * largo;
  const objetivo = FRACCION_MASA_TRONCO_AVE * (pesoKg ?? 0) / DENSIDAD_AVE;
  const a = (k > 1e-9 && objetivo > 0) ? Math.sqrt(objetivo / k) : L * 0.10;
  return Math.min(L * 0.22, Math.max(L * 0.055, a));
}

/**
 * Barrido de secciones elípticas a lo largo de Z, con polo en cada punta.
 *
 * `s=0` es el pecho (+Z, hacia donde mira el animal) y `s=1` la grupa (−Z).
 * El UV que produce es el del acuerdo de la fase 2, escrito una sola vez acá:
 * **U es longitudinal** (0 pecho → 1 grupa), que es el eje sobre el que el horno
 * dibuja patrón y estrías, y **V es dorsoventral**, que es el eje sobre el que
 * el atlas tiene las bandas de tono. V se termina de escribir en `banda()` con
 * el techo y el piso reales del tronco, para que el lomo caiga en la banda de
 * dorso y la panza en la de vientre en todas las especies.
 */
function geometriaTronco(perfil, semiancho, semialto, semilargo, radiales = 12) {
  const centroY = (e) => (e.t + e.p) / 2 * semialto;
  const altoY = (e) => (e.t - e.p) / 2 * semialto;

  // Dos polos y las estaciones del perfil comprimidas adentro, para que el
  // tronco cierre en punta sin estirarse más allá de su largo declarado.
  const filas = [];
  filas.push({ s: 0, w: 0, cy: centroY(perfil[0]), hy: 0 });
  for (const e of perfil) {
    filas.push({ s: 0.06 + e.s * 0.88, w: e.w, cy: centroY(e), hy: altoY(e) });
  }
  filas.push({ s: 1, w: 0, cy: centroY(perfil[perfil.length - 1]), hy: 0 });

  const cols = radiales + 1;              // columna repetida para cerrar el UV
  const nv = filas.length * cols;
  const pos = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const idx = [];

  for (let r = 0; r < filas.length; r++) {
    const f = filas[r];
    const z = semilargo * (1 - 2 * f.s);
    for (let j = 0; j < cols; j++) {
      const th = (j / radiales) * Math.PI * 2;   // 0 = lomo, π = panza
      const i = r * cols + j;
      pos[i * 3] = Math.sin(th) * f.w * semiancho;
      pos[i * 3 + 1] = f.cy + Math.cos(th) * f.hy;
      pos[i * 3 + 2] = z;
      uv[i * 2] = f.s;        // U longitudinal; V lo escribe banda()
      uv[i * 2 + 1] = 0;
    }
  }

  for (let r = 0; r < filas.length - 1; r++) {
    const polo0 = filas[r].w === 0, polo1 = filas[r + 1].w === 0;
    for (let j = 0; j < radiales; j++) {
      const a = r * cols + j, b = a + 1;
      const c = (r + 1) * cols + j, d = c + 1;
      if (!polo0) idx.push(a, c, b);
      if (!polo1) idx.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Bandas del atlas, con un margen adentro para no muestrear justo el borde
// entre dos. La convención completa está en el manifiesto y en la bitácora.
const B_CABEZA = [0.005, 0.135];
const B_DORSO = [0.14, 0.62];
const B_TRONCO = [0.14, 0.86];   // dorso + vientre: el contrasombreado entero
const B_MEDIA = [0.42, 0.58];    // acento de alas y flancos
const B_COLA = [0.865, 0.995];

function construirCuadrupedo(esp) {
  const g = new THREE.Group();
  const L = esp.largoM ?? 1;
  // El respaldo sostiene a seis mamíferos que no tienen alzada en la ficha
  // (monito del monte, los dos chinchillones, los dos tuco-tucos, la
  // comadrejita). Sin él, esas seis especies se rompen.
  const H = esp.alturaCruzM ?? L * 0.6;
  const mat = materialDeEspecie(esp);

  const cPelaje = new THREE.Color(esp.colorPrincipal || '#7a6248');
  const cOscuro = new THREE.Color(esp.colorSecundario || '#3d3128');
  const cAsta = new THREE.Color('#6b5a3e');

  const perfil = perfilSegunDieta(esp.dieta);
  const semialto = H * 0.225;          // profundidad de pecho = 45 % de la alzada
  const semilargo = L * 0.29;          // tronco = 58 % del largo cabeza-cuerpo
  const a0 = semianchoTronco(esp.pesoKg, semialto, semilargo * 2, perfil);

  // ── Tronco. El techo del tronco queda exactamente en la alzada de la ficha:
  // `alturaCruzM` pasa a significar lo que dice que significa.
  const techo = semialto * 1.06, piso = semialto * -1.03;
  const geoTronco = geometriaTronco(perfil, a0, semialto, semilargo);
  const a = a0 * escalarAVolumen(
    geoTronco, FRACCION_MASA_TRONCO * (esp.pesoKg ?? 0) / DENSIDAD_MAMIFERO, 'x',
    [semialto * 0.25 / a0, semialto * 1.6 / a0]);
  banda(geoTronco, { v0: B_TRONCO[0], v1: B_TRONCO[1], desde: techo, hasta: piso });
  const cuerpo = new THREE.Mesh(pintar(geoTronco, cPelaje), mat);
  cuerpo.position.set(0, H - techo, -L * 0.06);
  cuerpo.name = 'cuerpo';
  cuerpo.userData.y0 = cuerpo.position.y;
  cuerpo.castShadow = true;
  g.add(cuerpo);

  // ── Cuello y cabeza como un pivote articulado
  const pivoteCabeza = new THREE.Group();
  pivoteCabeza.position.set(0, H * 0.88, L * 0.22);
  pivoteCabeza.name = 'cabeza';
  g.add(pivoteCabeza);

  const cabezaTecho = H * 0.30, cabezaPiso = -H * 0.16;
  const enCabeza = (geo, color) => {
    banda(geo, { v0: B_CABEZA[0], v1: B_CABEZA[1], desde: cabezaTecho, hasta: cabezaPiso });
    const m = new THREE.Mesh(pintar(geo, color), mat);
    m.castShadow = true;
    pivoteCabeza.add(m);
    return m;
  };

  enCabeza(pieza(new THREE.CylinderGeometry(a * 0.62, a * 0.86, H * 0.32, 7),
    { rx: -0.5, y: 0, z: L * 0.015 }), cPelaje);
  enCabeza(pieza(new THREE.SphereGeometry(1, 9, 7),
    { sx: a * 0.55, sy: a * 0.62, sz: L * 0.085, y: H * 0.16, z: L * 0.10 }), cPelaje);
  enCabeza(pieza(new THREE.SphereGeometry(1, 7, 6),
    { sx: a * 0.32, sy: a * 0.30, sz: L * 0.055, y: H * 0.13, z: L * 0.185 }), cOscuro);

  for (const lado of [-1, 1]) {
    enCabeza(pieza(new THREE.ConeGeometry(a * 0.30, H * 0.16, 5),
      { rz: lado * 0.35, x: lado * a * 0.75, y: H * 0.27, z: L * 0.06 }), cOscuro);
  }

  // Astas del huemul macho: cornamenta bífida, su rasgo distintivo
  if (/huemul|ciervo/.test(esp.id)) {
    for (const lado of [-1, 1]) {
      enCabeza(pieza(new THREE.CylinderGeometry(0.012, 0.022, H * 0.36, 4),
        { rz: lado * 0.45, rx: -0.25, x: lado * a * 0.70, y: H * 0.36, z: L * 0.04 }), cAsta);
      enCabeza(pieza(new THREE.CylinderGeometry(0.008, 0.014, H * 0.20, 4),
        { rz: lado * 0.95, x: lado * (a * 0.70 + H * 0.13), y: H * 0.52, z: 0 }), cAsta);
    }
  }

  // ── Patas. El radio no puede seguir saliendo del ancho del tronco: con el
  // tronco corregido, `a*0.15` daría patas de un centímetro y medio.
  const rPata = Math.max(H * 0.040, a * 0.30);
  const nombres = ['pd1', 'pi1', 'pd2', 'pi2'];
  const posiciones = [
    [a * 0.85, L * 0.16], [-a * 0.85, L * 0.16],
    [a * 0.85, -L * 0.26], [-a * 0.85, -L * 0.26],
  ];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group();
    pivote.position.set(posiciones[i][0], H * 0.62, posiciones[i][1]);
    pivote.name = nombres[i];
    g.add(pivote);

    const enPata = (geo, color) => {
      banda(geo, { v0: B_DORSO[0] + 0.02, v1: B_DORSO[1] - 0.02, desde: 0, hasta: -H * 0.67 });
      const m = new THREE.Mesh(pintar(geo, color), mat);
      m.castShadow = true;
      pivote.add(m);
    };
    enPata(pieza(new THREE.CylinderGeometry(rPata, rPata * 0.62, H * 0.60, 6),
      { y: -H * 0.30 }), cPelaje);
    enPata(pieza(new THREE.CylinderGeometry(rPata * 0.66, rPata * 0.80, H * 0.07, 6),
      { y: -H * 0.635 }), cOscuro);
  }

  // ── Cola
  const cola = new THREE.Group();
  cola.position.set(0, H - semialto * 0.30, -L * 0.34);
  cola.name = 'cola';
  g.add(cola);
  const geoCola = pieza(new THREE.ConeGeometry(a * 0.30, L * 0.20, 6), { rx: Math.PI, y: -L * 0.09 });
  banda(geoCola, { v0: B_COLA[0], v1: B_COLA[1], desde: 0, hasta: -L * 0.20 });
  cola.add(new THREE.Mesh(pintar(geoCola, cOscuro), mat));

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function construirAve(esp) {
  const g = new THREE.Group();
  const L = esp.largoM ?? 0.3;
  const envergadura = (esp.pesoKg ?? 0.3) > 3 ? L * 3.4 : L * 1.9;
  const mat = materialDeEspecie(esp);

  const cPluma = new THREE.Color(esp.colorPrincipal || '#3a3a3a');
  const cAla = new THREE.Color(esp.colorSecundario || '#1a1a1a');

  // El cuerpo medía `L*0.52` de semilargo, o sea el 104 % del largo del ave, y
  // `L*0.26` de semiancho: en el cóndor, 62 cm de ancho de cuerpo. Ahora sale
  // de la masa igual que en el cuadrúpedo, con la densidad de un cuerpo
  // emplumado.
  const semilargo = L * 0.24;
  const a0 = semianchoAve(esp.pesoKg, L);
  const geoCuerpo = geometriaTronco(PERFIL_AVE, a0, a0 * 1.15, semilargo, 10);
  const k = escalarAVolumen(
    geoCuerpo, FRACCION_MASA_TRONCO_AVE * (esp.pesoKg ?? 0) / DENSIDAD_AVE, 'xy',
    [L * 0.055 / a0, L * 0.22 / a0]);
  const semiancho = a0 * k;
  const semialto = semiancho * 1.15;

  const techo = semialto, piso = -semialto;
  banda(geoCuerpo, { v0: B_TRONCO[0], v1: B_TRONCO[1], desde: techo, hasta: piso });
  const cuerpo = new THREE.Mesh(pintar(geoCuerpo, cPluma), mat);
  cuerpo.name = 'cuerpo';
  cuerpo.userData.y0 = 0;
  g.add(cuerpo);

  const cabeza = new THREE.Group();
  cabeza.position.set(0, L * 0.10, semilargo + semiancho * 0.55);
  cabeza.name = 'cabeza';
  g.add(cabeza);

  const enCabeza = (geo, color) => {
    banda(geo, { v0: B_CABEZA[0], v1: B_CABEZA[1], desde: semiancho * 0.95, hasta: -semiancho * 0.95 });
    cabeza.add(new THREE.Mesh(pintar(geo, color), mat));
  };
  enCabeza(new THREE.SphereGeometry(semiancho * 0.62, 8, 6), cPluma);
  enCabeza(pieza(new THREE.ConeGeometry(semiancho * 0.26, L * 0.14, 6),
    { rx: Math.PI / 2, z: L * 0.085 }), new THREE.Color('#c8a24a'));

  // El cóndor tiene collar blanco: es su marca inconfundible
  if (/condor/.test(esp.id)) {
    const geoCollar = pieza(new THREE.TorusGeometry(semiancho * 0.92, semiancho * 0.26, 6, 14),
      { rx: Math.PI / 2, y: semialto * 0.12, z: semilargo * 0.72 });
    banda(geoCollar, { v0: B_CABEZA[0], v1: B_CABEZA[1], desde: semialto, hasta: -semialto });
    g.add(new THREE.Mesh(pintar(geoCollar, new THREE.Color('#f0efe8')), mat));
  }

  for (const [nombre, lado] of [['ala_d', 1], ['ala_i', -1]]) {
    const pivote = new THREE.Group();
    pivote.position.set(lado * semiancho * 0.85, semialto * 0.45, 0);
    pivote.name = nombre;
    g.add(pivote);

    // Las alas usan la banda de acento medio del atlas (V∈[0.42,0.58]), que el
    // horno reserva justamente para «alas, flancos», y el V corre a lo largo de
    // la envergadura: de la inserción al borde de la pluma primaria.
    const enAla = (geo) => {
      banda(geo, { v0: B_MEDIA[0], v1: B_MEDIA[1], eje: 'ax', desde: 0, hasta: envergadura * 0.62 });
      const m = new THREE.Mesh(pintar(geo, cAla), mat);
      m.castShadow = true;
      pivote.add(m);
    };
    enAla(pieza(new THREE.BoxGeometry(envergadura * 0.5, L * 0.030, L * 0.34),
      { x: lado * envergadura * 0.25 }));
    for (let i = 0; i < 5; i++) {
      enAla(pieza(new THREE.BoxGeometry(envergadura * 0.13, L * 0.02, L * 0.07),
        { ry: lado * (i - 2) * 0.10, x: lado * envergadura * 0.56, z: (i - 2) * L * 0.07 }));
    }
  }

  const cola = new THREE.Group();
  cola.position.set(0, 0, -semilargo * 0.95);
  cola.name = 'cola';
  g.add(cola);
  const geoCola = pieza(new THREE.BoxGeometry(L * 0.26, L * 0.022, L * 0.30), { z: -L * 0.14 });
  banda(geoCola, { v0: B_COLA[0], v1: B_COLA[1], eje: 'az', desde: 0, hasta: L * 0.30 });
  cola.add(new THREE.Mesh(pintar(geoCola, cAla), mat));

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
