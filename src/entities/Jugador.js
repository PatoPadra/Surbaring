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

    // Estado de supervivencia
    this.salud = 100;
    this.energia = 100;    // resistencia
    this.hambre = 100;
    this.sed = 100;
    this.temperatura = 36.6;
    this.oxigeno = 100;
    this.pesoCargado = 0;

    this._balanceo = 0;
    this._normalSuelo = new THREE.Vector3(0, 1, 0);
    this._tmp = new THREE.Vector3();
    this._distanciaRecorrida = 0;
  }

  /** Ubica al jugador en coordenadas geográficas reales. */
  aparecerEn(lat, lon) {
    const { x, z } = this.mundo.aMundo(lat, lon);
    this.posicion.set(x, this.mundo.alturaEn(x, z) + 2, z);
    this.velocidad.set(0, 0, 0);
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
    this.cabeceo -= entrada.ratonDY * sens;
    const limite = Math.PI / 2 - 0.02;
    this.cabeceo = Math.max(-limite, Math.min(limite, this.cabeceo));
    entrada.consumirRaton();
  }

  _mover(dt, entrada) {
    this.agachado = entrada.agachar;
    this.corriendo = entrada.correr && entrada.adelante > 0 && this.energia > 0.5;

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

    this.posicion.addScaledVector(this.velocidad, dt);
    this._distanciaRecorrida += Math.hypot(this.velocidad.x, this.velocidad.z) * dt;

    // Resistencia
    const gasto = this.corriendo ? 11 : (largo > 0.01 ? 1.1 : 0);
    this.energia = Math.max(0, Math.min(100, this.energia - gasto * dt + (gasto === 0 ? 7.5 * dt : 0)));
  }

  _resolverTerreno(dt) {
    const m = this.mundo;

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

  _colocarCamara(dt, entrada) {
    const m = this.mundo;
    const alturaOjos = this.agachado ? ALTURA_OJOS * 0.62 : ALTURA_OJOS;

    // Balanceo al caminar: sutil, sólo para dar peso al paso
    const rapidez = Math.hypot(this.velocidad.x, this.velocidad.z);
    this._balanceo += rapidez * dt * 2.1;
    const amplitud = Math.min(rapidez / 6.2, 1) * (this.enSuelo ? 1 : 0);
    const bobY = Math.sin(this._balanceo * 2) * 0.045 * amplitud;
    const bobX = Math.cos(this._balanceo) * 0.032 * amplitud;

    const ojo = this._tmp.set(
      this.posicion.x + bobX * Math.cos(this.giro),
      this.posicion.y + alturaOjos + bobY,
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
      let d = this.distanciaCamara;
      for (let paso = 0.4; paso <= d; paso += 0.35) {
        const px = ojo.x + dir.x * paso, pz = ojo.z + dir.z * paso;
        const py = ojo.y + dir.y * paso;
        if (py < m.alturaEn(px, pz) + 0.45) { d = Math.max(1.1, paso - 0.35); break; }
      }
      this.camara.position.set(ojo.x + dir.x * d, ojo.y + dir.y * d, ojo.z + dir.z * d);
    } else {
      this.camara.position.copy(ojo);
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
    // El desgaste se mide en tiempo de juego, no en tiempo real
    const h = (dt * escalaTiempo) / 3600;  // horas de juego transcurridas

    const esfuerzo = this.corriendo ? 2.1 : (Math.hypot(this.velocidad.x, this.velocidad.z) > 0.4 ? 1.25 : 0.8);
    this.hambre = Math.max(0, this.hambre - 2.6 * h * esfuerzo);
    this.sed = Math.max(0, this.sed - 4.1 * h * esfuerzo);

    // ── Temperatura percibida
    const gradiente = (this.posicion.y - 893) / 1000 * 6.5;   // isoterma real
    const ambiente = (clima?.temperatura ?? 12) - gradiente;
    const viento = clima?.vientoKmh ?? 15;
    // Enfriamiento por viento: crece rápido al principio y después satura
    const sensacion = ambiente - Math.min(11, Math.pow(viento, 0.62) * 0.9);
    const mojado = this.enAgua || (clima?.lluvia ?? 0) > 0.2;

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
    let dano = 0;
    if (this.hambre <= 0) dano += 1.8 * h;
    if (this.sed <= 0) dano += 4.0 * h;          // la deshidratación mata antes
    if (this.temperatura < 35.0) dano += (35.0 - this.temperatura) * 5.5 * h;
    if (this.temperatura > 39.0) dano += (this.temperatura - 39.0) * 4.0 * h;
    if (dano > 0) this.salud = Math.max(0, this.salud - dano);
    else if (this.hambre > 40 && this.sed > 40) {
      this.salud = Math.min(100, this.salud + 1.4 * h);   // se recupera solo
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
