/**
 * Jugador — controlador en primera/tercera persona con física sobre el terreno.
 *
 * Integración semi-implícita a paso fijo. Colisión de cápsula contra el campo de
 * alturas con detección de escalón y pendiente máxima: en la Patagonia los
 * pedreros de más de 45° no se suben caminando, y eso se nota en el juego.
 */

import * as THREE from 'three';

const GRAVEDAD = -22.0;            // exagerada respecto a 9.81: se siente mejor
const ALTURA_OJOS = 1.68;
const RADIO = 0.38;
const PENDIENTE_MAX = 48 * Math.PI / 180;
const PASO_MAX = 0.55;
/** Cuánto adelante del eje del cuerpo están los ojos, en metros. */
const OJOS_ADELANTE = 0.12;
/** Tope de retraso de la cámara respecto de la cota real del cuerpo. */
const RETRASO_VERTICAL = 0.5;

export class Jugador {
  constructor(mundo, camara) {
    this.mundo = mundo;
    this.camara = camara;

    this.posicion = new THREE.Vector3();
    this.velocidad = new THREE.Vector3();
    this.enSuelo = false;
    this.enAgua = false;
    this.profundidadAgua = 0;
    this.agachado = false;
    this.corriendo = false;

    this.giro = 0;        // rotación horizontal (radianes)
    this.cabeceo = 0;     // vertical
    this.tercerPersona = false;
    this.distanciaCamara = 4.2;
    /**
     * Distancia efectiva del brazo de cámara. La deseada y la real son dos
     * cosas distintas: el relieve empuja la cámara hacia adelante, y hacerlo de
     * golpe —que era lo que pasaba— produce un salto en cada arbusto y en cada
     * cambio de pendiente. Acá se persigue el objetivo, rápido al acercarse
     * (si no, la cámara se hunde en el cerro) y lento al alejarse.
     */
    this._distanciaReal = this.distanciaCamara;
    /** Corrimiento sobre el hombro, para no tener el propio cuerpo tapando la mira. */
    this.hombroCamara = 0.42;
    /** Cuánto se balancea la cámara al caminar, de 0 a 1. Se ajusta en opciones. */
    this.balanceo = 1;
    /** Aspecto elegido en la creación de personaje. Lo escribe main. */
    this.aspecto = null;

    // Estado de supervivencia
    this.salud = 100;
    this.energia = 100;    // resistencia
    this.hambre = 100;
    this.sed = 100;
    this.temperatura = 36.6;
    this.oxigeno = 100;
    this.pesoCargado = 0;
    /** Cuánto fuego hay a mano, de 0 a 1. Lo escribe el bucle cada cuadro. */
    this.fuego = 0;

    // Muerte: qué la causó y cuánto se aguantó. El juego no la usa para
    // castigar sino para explicar, así que hace falta guardar el contexto.
    this.vivo = true;
    this.causaMuerte = null;
    this.horasVividas = 0;
    this.alMorir = null;

    this._balanceo = 0;
    this._normalSuelo = new THREE.Vector3(0, 1, 0);
    this._normalMuro = new THREE.Vector3(0, 1, 0);
    /** Altura suavizada de la cámara. Ver `_colocarCamara`. */
    this._ySuave = null;
    this._antesX = 0; this._antesZ = 0;
    this._tmp = new THREE.Vector3();
    this._distanciaRecorrida = 0;
  }

  /** Vuelve a empezar: mismo mundo, cuerpo nuevo. */
  revivir() {
    this.vivo = true;
    this.causaMuerte = null;
    this.salud = 100; this.energia = 100;
    // Cuerpo nuevo, entero. Volver con 85 de sed sonaba a que morirse deja
    // resaca, pero en la práctica devolvía al jugador a pocos minutos de la
    // próxima muerte: un pozo del que no se sale. La lección de la muerte la da
    // la pantalla de fin, que explica qué la causó; no hace falta cobrarla dos
    // veces.
    this.hambre = 100; this.sed = 100;
    this.temperatura = 36.6;
    this.horasVividas = 0;
    this.velocidad.set(0, 0, 0);
    this._ySuave = null;
    return this;
  }

  /** Ubica al jugador en coordenadas geográficas reales. */
  aparecerEn(lat, lon) {
    const { x, z } = this.mundo.aMundo(lat, lon);
    this.posicion.set(x, this.mundo.alturaEn(x, z) + 2, z);
    this.velocidad.set(0, 0, 0);
    // Aparecer en otro lado no es caerse: la cámara arranca donde está el
    // cuerpo, sin perseguirlo desde el punto anterior.
    this._ySuave = null;
    return this;
  }

  get velocidadBase() {
    let v = this.agachado ? 1.5 : 3.4;
    if (this.corriendo && !this.agachado && this.energia > 1) v = 6.2;
    // La carga pesa: cada 10 kg por encima de 25 resta un 6 %
    const exceso = Math.max(0, this.pesoCargado - 25);
    v *= Math.max(0.45, 1 - exceso * 0.006);
    return v;
  }

  actualizar(dt, entrada) {
    this._mirar(entrada);
    this._mover(dt, entrada);
    this._resolverTerreno(dt);
    this._colocarCamara(dt, entrada);
  }

  _mirar(entrada) {
    const sens = 0.0022 * (entrada.sensibilidad ?? 1);
    this.giro -= entrada.ratonDX * sens;
    this.cabeceo -= entrada.ratonDY * sens * (entrada.invertirY ? -1 : 1);
    const limite = Math.PI / 2 - 0.02;
    this.cabeceo = Math.max(-limite, Math.min(limite, this.cabeceo));
    entrada.consumirRaton();
  }

  _mover(dt, entrada) {
    this.agachado = entrada.agachar;
    this.corriendo = entrada.correr && entrada.adelante > 0
      && this.energia > 0.5 && !this.desfallecido;

    // Base ortonormal en el plano horizontal
    const sin = Math.sin(this.giro), cos = Math.cos(this.giro);
    const adelanteX = -sin, adelanteZ = -cos;
    const derechaX = cos, derechaZ = -sin;

    let dx = adelanteX * entrada.adelante + derechaX * entrada.lateral;
    let dz = adelanteZ * entrada.adelante + derechaZ * entrada.lateral;
    const largo = Math.hypot(dx, dz);
    if (largo > 1e-4) { dx /= largo; dz /= largo; }

    const vel = this.velocidadBase * (this.enAgua ? 0.55 : 1);

    // En pendiente cuesta más subir: proyecta el deseo sobre el plano del suelo
    let penalizacion = 1;
    if (this.enSuelo && largo > 1e-4) {
      const subida = -(this._normalSuelo.x * dx + this._normalSuelo.z * dz);
      penalizacion = 1 - Math.max(0, subida) * 0.55;
    }

    const objetivoX = dx * vel * penalizacion;
    const objetivoZ = dz * vel * penalizacion;

    // Aceleración: rápida en el suelo, muy lenta en el aire
    const respuesta = this.enSuelo ? 14 : (this.enAgua ? 5 : 2.2);
    const k = 1 - Math.exp(-respuesta * dt);
    this.velocidad.x += (objetivoX - this.velocidad.x) * k;
    this.velocidad.z += (objetivoZ - this.velocidad.z) * k;

    // Salto
    if (entrada.saltar && this.enSuelo && !this.agachado && this.energia > 8) {
      this.velocidad.y = 6.4;
      this.energia -= 8;
      this.enSuelo = false;
    }

    // Gravedad y empuje del agua
    if (this.enAgua && this.profundidadAgua > 1.1) {
      const flotacion = Math.min(1, this.profundidadAgua / 1.6);
      this.velocidad.y += (GRAVEDAD * (1 - flotacion * 1.08)) * dt;
      this.velocidad.y *= Math.exp(-2.4 * dt);          // arrastre
      if (entrada.saltar) this.velocidad.y += 9 * dt;   // nadar hacia arriba
      if (entrada.agachar) this.velocidad.y -= 9 * dt;
    } else {
      this.velocidad.y += GRAVEDAD * dt;
    }

    // De dónde se venía. Lo necesita el rechazo contra paredes: para deshacer un
    // avance hay que saber dónde estaba el cuerpo antes de hacerlo.
    this._antesX = this.posicion.x;
    this._antesZ = this.posicion.z;

    this.posicion.addScaledVector(this.velocidad, dt);
    this._distanciaRecorrida += Math.hypot(this.velocidad.x, this.velocidad.z) * dt;

    // Resistencia
    const gasto = this.corriendo ? 11 : (largo > 0.01 ? 1.1 : 0);
    this.energia = Math.max(0, Math.min(100, this.energia - gasto * dt + (gasto === 0 ? 7.5 * dt : 0)));
  }

  /**
   * ¿Este punto es pared, o sea algo que no se sube caminando?
   *
   * La primera versión preguntaba si la cota subía más que `PASO_MAX`, y estaba
   * mal por una razón que no se ve leyendo: `PASO_MAX` es lo que se sube de un
   * paso, y esto se evalúa una vez por cuadro. A 2,3 m/s un cuadro avanza menos
   * de cuatro centímetros, así que el umbral daba permiso para subir medio metro
   * cada cuatro centímetros —una pared vertical— y la comprobación no se
   * disparaba nunca. Medido: contra un pedrero de 50°, con el rechazo puesto y
   * sacado, el mismo número hasta el tercer decimal.
   *
   * Lo que define una pared es la pendiente, que es justo lo que ya declara
   * `PENDIENTE_MAX`. La cota sólo hace falta para saber si vamos hacia arriba:
   * de una pared siempre se tiene que poder salir bajando o de costado.
   */
  _esMuro(x, z) {
    const m = this.mundo;
    return m.pendienteEn(x, z) > PENDIENTE_MAX
      && m.alturaEn(x, z) > this.posicion.y + 0.02;
  }

  /**
   * Rechazo contra paredes de roca.
   *
   * Acá estaba el temblor al chocar. El cuadro metía el cuerpo dentro de la
   * cara empinada; el ajuste de altura de más abajo lo pegaba a la cota del
   * terreno, o sea que lo TREPABA de un salto por un pedrero que la propia
   * pendiente máxima declara insubible; y el deslizamiento por pendiente lo
   * devolvía abajo. Sesenta veces por segundo. Lo que se ve de eso es la cámara
   * vibrando contra la piedra.
   *
   * La pared se detecta ahora ANTES de tocar la altura: se deshace el avance
   * del cuadro y se vuelve a aplicar sólo su componente tangencial. Eso es
   * caminar pegado a la pared, que es lo que hace un cuerpo, en vez de rebotar
   * contra ella.
   */
  _resolverMuro() {
    const m = this.mundo;
    const dx = this.posicion.x - this._antesX;
    const dz = this.posicion.z - this._antesZ;
    if (Math.hypot(dx, dz) < 1e-5) return;
    if (!this._esMuro(this.posicion.x, this.posicion.z)) return;

    // Normal del terreno: su parte horizontal apunta cuesta abajo, o sea hacia
    // afuera de la pared. Es la dirección contra la que no se puede avanzar.
    m.normalEn(this.posicion.x, this.posicion.z, this._normalMuro);
    let nx = this._normalMuro.x, nz = this._normalMuro.z;
    const largo = Math.hypot(nx, nz);
    if (largo < 1e-4) {                       // pared vertical sin gradiente útil
      this.posicion.x = this._antesX;
      this.posicion.z = this._antesZ;
      return;
    }
    nx /= largo; nz /= largo;

    const entra = dx * nx + dz * nz;
    if (entra >= 0) return;                   // se está yendo de la pared, no entrando

    // Sólo la parte del avance que corre a lo largo de la pared
    const tx = this._antesX + (dx - nx * entra);
    const tz = this._antesZ + (dz - nz * entra);
    if (this._esMuro(tx, tz)) {               // rincón: no hay por dónde
      this.posicion.x = this._antesX;
      this.posicion.z = this._antesZ;
    } else {
      this.posicion.x = tx;
      this.posicion.z = tz;
    }

    // La velocidad pierde lo mismo que perdió el avance. Sin esto se sigue
    // acumulando contra la pared y salta en cuanto la pared se termina.
    const ve = this.velocidad.x * nx + this.velocidad.z * nz;
    if (ve < 0) {
      this.velocidad.x -= nx * ve;
      this.velocidad.z -= nz * ve;
    }
  }

  _resolverTerreno(dt) {
    const m = this.mundo;

    this._resolverMuro();

    // Mantener dentro del mundo
    const lim = m.mitad - 30;
    this.posicion.x = Math.max(-lim, Math.min(lim, this.posicion.x));
    this.posicion.z = Math.max(-lim, Math.min(lim, this.posicion.z));

    const suelo = m.alturaEn(this.posicion.x, this.posicion.z);
    m.normalEn(this.posicion.x, this.posicion.z, this._normalSuelo);

    // Agua: la cota del lago manda sobre la del terreno
    const cotaLago = m.cotaLagoEn(this.posicion.x, this.posicion.z);
    if (cotaLago !== null) {
      this.profundidadAgua = Math.max(0, cotaLago - this.posicion.y);
      this.enAgua = this.posicion.y < cotaLago;
    } else {
      this.enAgua = false;
      this.profundidadAgua = 0;
    }

    const pendiente = m.pendienteEn(this.posicion.x, this.posicion.z);

    if (this.posicion.y <= suelo + 0.001) {
      this.posicion.y = suelo;
      if (this.velocidad.y < 0) {
        // Caída: daño a partir de 8 m/s, como una caída de ~3,3 m
        const impacto = -this.velocidad.y;
        if (impacto > 8 && !this.enAgua) {
          this.salud -= Math.pow(impacto - 8, 1.55) * 1.4;
        }
        this.velocidad.y = 0;
      }
      this.enSuelo = true;

      // En pendiente excesiva no hay agarre: se resbala
      if (pendiente > PENDIENTE_MAX) {
        const exceso = (pendiente - PENDIENTE_MAX) / (Math.PI / 2 - PENDIENTE_MAX);
        const desliz = 12 * exceso * dt;
        this.velocidad.x += this._normalSuelo.x * desliz;
        this.velocidad.z += this._normalSuelo.z * desliz;
      } else {
        // Rozamiento
        const roce = Math.exp(-9 * dt);
        this.velocidad.x *= roce;
        this.velocidad.z *= roce;
      }
    } else {
      this.enSuelo = false;
    }

    // Escalón: si el terreno inmediato es un poco más alto, se sube sin saltar
    if (this.enSuelo) {
      const sin = Math.sin(this.giro), cos = Math.cos(this.giro);
      const frenteX = this.posicion.x - sin * RADIO * 1.6;
      const frenteZ = this.posicion.z - cos * RADIO * 1.6;
      const hFrente = m.alturaEn(frenteX, frenteZ);
      const delta = hFrente - this.posicion.y;
      if (delta > 0 && delta < PASO_MAX && m.pendienteEn(frenteX, frenteZ) < PENDIENTE_MAX) {
        this.posicion.y += Math.min(delta, 8 * dt);
      }
    }

    if (this.salud <= 0) this.salud = 0;
  }

  /**
   * Cota a la que se dibuja el cuerpo. Es la suavizada, no la de la física: si
   * el cuerpo usara la cota cruda mientras la cámara usa la suave, en tercera
   * persona el personaje daría saltitos dentro del encuadre.
   */
  get alturaVisual() {
    return this._ySuave ?? this.posicion.y;
  }

  /** Altura de los ojos, que sale de la estatura elegida al crear el personaje. */
  get alturaOjos() {
    return this.aspecto?.alturaOjos ?? ALTURA_OJOS;
  }

  _colocarCamara(dt, entrada) {
    const m = this.mundo;
    const alturaOjos = this.alturaOjos * (this.agachado ? 0.62 : 1);

    // Balanceo al caminar: sutil, sólo para dar peso al paso. Quien lo sienta
    // como temblor lo puede bajar a cero desde las opciones; hay gente a la que
    // el cabeceo de cámara le da mareo de verdad, y no es un capricho.
    const rapidez = Math.hypot(this.velocidad.x, this.velocidad.z);
    this._balanceo += rapidez * dt * 2.1;
    const amplitud = Math.min(rapidez / 6.2, 1) * (this.enSuelo ? 1 : 0) * this.balanceo;
    const bobY = Math.sin(this._balanceo * 2) * 0.045 * amplitud;
    const bobX = Math.cos(this._balanceo) * 0.032 * amplitud;

    // Suavizado vertical de la vista.
    //
    // El relieve es un campo de alturas muestreado y el cuerpo se pega a él en
    // cada cuadro: cada escalón, cada piedra y cada cambio de nodo del terreno
    // es un salto instantáneo de la cota. En los pies no se nota; en los ojos
    // es un tirón. Se persigue la cota real en vez de copiarla, rápido en el
    // aire —una caída tiene que sentirse caída— y con un tope de medio metro de
    // retraso para que un barranco no deje la cámara flotando atrás.
    if (this._ySuave === null) this._ySuave = this.posicion.y;
    const kY = this.enSuelo ? 16 : 90;
    this._ySuave += (this.posicion.y - this._ySuave) * (1 - Math.exp(-kY * dt));
    this._ySuave = Math.max(this.posicion.y - RETRASO_VERTICAL,
      Math.min(this.posicion.y + RETRASO_VERTICAL, this._ySuave));

    const ojo = this._tmp.set(
      this.posicion.x + bobX * Math.cos(this.giro),
      this._ySuave + alturaOjos + bobY,
      this.posicion.z - bobX * Math.sin(this.giro)
    );

    this.camara.rotation.order = 'YXZ';
    this.camara.rotation.set(this.cabeceo, this.giro, Math.sin(this._balanceo) * 0.006 * amplitud);

    if (this.tercerPersona) {
      // Brazo de cámara con colisión contra el relieve
      const dir = new THREE.Vector3(
        Math.sin(this.giro) * Math.cos(this.cabeceo),
        -Math.sin(this.cabeceo),
        Math.cos(this.giro) * Math.cos(this.cabeceo)
      );
      // Sobre el hombro: la cámara al eje deja al propio personaje tapando
      // justo el lugar donde uno está mirando.
      const hombroX = Math.cos(this.giro) * this.hombroCamara;
      const hombroZ = -Math.sin(this.giro) * this.hombroCamara;
      const baseX = ojo.x + hombroX, baseZ = ojo.z + hombroZ;

      // Se busca el primer punto donde el brazo entra en el terreno, con un
      // muestreo más fino que antes: con pasos de 35 cm la cámara se metía
      // medio metro dentro de la ladera antes de enterarse.
      let deseada = this.distanciaCamara;
      for (let paso = 0.4; paso <= deseada; paso += 0.18) {
        const px = baseX + dir.x * paso, pz = baseZ + dir.z * paso;
        const py = ojo.y + dir.y * paso;
        if (py < m.alturaEn(px, pz) + 0.5) { deseada = Math.max(0.9, paso - 0.25); break; }
      }
      // Acercarse tiene que ser inmediato o se ve a través del cerro; alejarse
      // puede tomarse su tiempo, y así el salir de un pasillo de árboles no es
      // un tirón hacia atrás.
      const respuesta = deseada < this._distanciaReal ? 26 : 5;
      this._distanciaReal += (deseada - this._distanciaReal) * (1 - Math.exp(-respuesta * dt));
      const d = this._distanciaReal;
      this.camara.position.set(baseX + dir.x * d, ojo.y + dir.y * d, baseZ + dir.z * d);
    } else {
      this._distanciaReal = this.distanciaCamara;
      // Los ojos están en la cara, no en el eje del cuello. Doce centímetros
      // hacia adelante es lo que hace que mirar al piso muestre el pecho y las
      // piernas —que es lo que uno espera ver— en vez de los hombros pegados a
      // la lente.
      this.camara.position.set(
        ojo.x - Math.sin(this.giro) * OJOS_ADELANTE,
        ojo.y,
        ojo.z - Math.cos(this.giro) * OJOS_ADELANTE);
    }

    // Bajo el agua se corrige la profundidad de la cámara
    this.camaraSumergida = this.enAgua && this.camara.position.y < (m.cotaLagoEn(this.camara.position.x, this.camara.position.z) ?? -1e9);
  }

  /**
   * Supervivencia. La temperatura es la variable que manda en la Patagonia:
   * se enfría con la altura a 6,5 °C por kilómetro, el viento se lleva calor
   * mucho más rápido que el aire quieto, y mojarse multiplica esa pérdida.
   * Un día lindo a 800 m puede ser hipotermia a 2000 m con viento.
   *
   * @param {number} dt segundos simulados
   * @param {object} clima estado devuelto por Tiempo.estado()
   * @param {number} escalaTiempo cuántos segundos de juego pasan por segundo real
   */
  actualizarSupervivencia(dt, clima, escalaTiempo = 60) {
    if (!this.vivo) return;
    // El desgaste se mide en tiempo de juego, no en tiempo real
    const h = (dt * escalaTiempo) / 3600;  // horas de juego transcurridas

    const esfuerzo = this.corriendo ? 2.1 : (Math.hypot(this.velocidad.x, this.velocidad.z) > 0.4 ? 1.25 : 0.8);
    this.hambre = Math.max(0, this.hambre - 2.6 * h * esfuerzo);
    this.sed = Math.max(0, this.sed - 4.1 * h * esfuerzo);

    // ── Temperatura percibida
    const gradiente = (this.posicion.y - 893) / 1000 * 6.5;   // isoterma real
    const ambiente = (clima?.temperatura ?? 12) - gradiente;
    const viento = clima?.vientoKmh ?? 15;
    // Estar bajo techo no calienta el aire: corta el viento y la mojadura, que
    // es de donde sale casi toda la pérdida de calor. Un parapeto de ramas ya
    // frena buena parte del enfriamiento por viento, y ésa es la razón por la
    // que se arma uno aunque no tape nada más.
    const abrigo = this.abrigo || 0;
    const vientoSentido = viento * (1 - 0.85 * abrigo);
    // Un recinto cerrado además levanta la temperatura del aire de adentro con
    // el propio cuerpo. Diez grados sobre el ambiente en el mejor caso es lo que
    // hace que un refugio de montaña sirva: en la cumbre del Catedral no queda
    // cómodo, queda apenas por encima del umbral de daño. Sin fuego, eso es
    // exactamente lo que un refugio de piedra da.
    // El fuego. Hasta acá el juego lo tenía todo construido —fogatas, hornos,
    // hornadas, jurisdicciones del fuego— y el calor no llegaba al cuerpo: se
    // podía estar sentado contra las llamas muriéndose de hipotermia. Encender
    // fuego es la primera respuesta humana al frío y tenía que ser la primera
    // respuesta del juego.
    //
    // Catorce grados es más de lo que da un refugio de piedra, y está bien que
    // así sea: el refugio te guarda del viento, el fuego te devuelve calor. Y a
    // diferencia del abrigo, hay que alimentarlo con leña, así que el calor de
    // la noche se paga juntando durante el día. Ése es el bucle.
    const fuego = Math.min(1, this.fuego || 0);
    const ambienteSentido = ambiente + 10 * abrigo + 14 * fuego;
    // Enfriamiento por viento: crece rápido al principio y después satura
    const sensacion = ambienteSentido - Math.min(11, Math.pow(vientoSentido, 0.62) * 0.9);
    // El fuego además seca: salir del agua y secarse al fuego es media hora de
    // vida en la cordillera. No seca si seguís adentro del lago, claro.
    const mojado = this.enAgua
      || ((clima?.lluvia ?? 0) > 0.2 && abrigo < 0.5 && fuego < 0.5);

    // El cuerpo tiende al equilibrio con la sensación térmica, más lento si
    // está abrigado por el propio esfuerzo
    // El coeficiente importa: con 0,075 el equilibrio en la cumbre del Catedral
    // caía en 35,09 °C, apenas por encima del umbral de daño, y la hipotermia
    // se avisaba sin lastimar nunca. Con 0,11 la altura pasa a ser un peligro
    // real, que es justamente lo que hay que enseñar.
    const objetivo = 36.6 + (sensacion - 16) * 0.11 + (esfuerzo - 1) * 0.5;
    const velocidad = mojado ? 0.9 : 0.34;
    this.temperatura += (objetivo - this.temperatura) * Math.min(1, velocidad * h * 3);
    this.sensacionTermica = sensacion;
    this.mojado = mojado;

    // ── Consecuencias
    //
    // Ni el hambre ni la sed matan de golpe: desgastan. Lo que mata es la salud
    // en cero, y a ella llegan por caminos de velocidad muy distinta. Que la
    // deshidratación pegue más del doble que el hambre no es un ajuste de
    // dificultad: se muere de sed en días y de hambre en semanas.
    this.horasVividas += h;
    let dano = 0;
    const causas = [];
    if (this.hambre <= 0) { dano += 1.8 * h; causas.push(['hambre', 1.8]); }
    if (this.sed <= 0) { dano += 4.0 * h; causas.push(['sed', 4.0]); }
    if (this.temperatura < 35.0) {
      const d = (35.0 - this.temperatura) * 5.5;
      dano += d * h; causas.push(['hipotermia', d]);
    }
    if (this.temperatura > 39.0) {
      const d = (this.temperatura - 39.0) * 4.0;
      dano += d * h; causas.push(['golpe de calor', d]);
    }
    if (dano > 0) this.salud = Math.max(0, this.salud - dano);
    else if (this.hambre > 40 && this.sed > 40) {
      this.salud = Math.min(100, this.salud + 1.4 * h);   // se recupera solo
    }

    // El desgaste se nota antes de matar: sin comer ni beber no se corre, y el
    // cuerpo deja de reponer resistencia. Es lo que convierte una barra en cero
    // en una decisión —volver o seguir— en vez de un número que baja solo.
    if (this.hambre <= 0 || this.sed <= 0) {
      this.energia = Math.max(0, this.energia - 14 * h);
      this.desfallecido = true;
    } else {
      this.desfallecido = false;
    }

    // La causa de muerte es la que más rápido estaba matando en ese momento
    if (this.vivo && this.salud <= 0) {
      this.vivo = false;
      causas.sort((a, b) => b[1] - a[1]);
      this.causaMuerte = {
        causa: causas[0] ? causas[0][0] : 'agotamiento',
        porHora: causas[0] ? +causas[0][1].toFixed(1) : 0,
        altitud: this.posicion.y,
        temperaturaCuerpo: this.temperatura,
        sensacion: this.sensacionTermica,
        clima,
        horas: this.horasVividas,
        abrigo: this.abrigo || 0,
        hambre: this.hambre, sed: this.sed,
      };
      this.alMorir?.(this.causaMuerte);
    }

    // Cargar de más agota antes
    if (this.pesoCargado > 25) this.energia = Math.max(0, this.energia - (this.pesoCargado - 25) * 0.02 * h * 60);

    this.hipotermia = this.temperatura < 35.5;
    this.golpeCalor = this.temperatura > 38.5;
  }

  /** Datos geográficos para la interfaz educativa. */
  informe() {
    const { lat, lon } = this.mundo.aLatLon(this.posicion.x, this.posicion.z);
    return {
      lat, lon,
      altitud: this.posicion.y,
      pendienteGrados: this.mundo.pendienteEn(this.posicion.x, this.posicion.z) * 180 / Math.PI,
      humedad: this.mundo.humedadEn(this.posicion.x, this.posicion.z),
      enAgua: this.enAgua,
      distanciaKm: this._distanciaRecorrida / 1000,
    };
  }
}
