/**
 * Trampas — lo que se deja puesto en el mundo y se vuelve a buscar.
 *
 * El dueño lo anotó jugando: «trampa de lazo no se puede poner, tiene que poder
 * ponerse y que quede en el mapa marcado (si no no sé adónde tengo que volver)».
 * `trampa_lazo` declaraba `pasiva` y `habilita: ["trampear"]` y ningún archivo lo
 * leía; la nasa de junco y la red de fibra decían «se deja calada y se vuelve al
 * otro día» y tampoco las leía nadie. El defecto era uno solo: no existía dejar
 * algo en el mundo que trabaje solo. Esto es eso, para los tres.
 *
 * ── Qué cae, y cuándo ───────────────────────────────────────────────────────
 *
 * No hay una tabla aparte de «qué agarra un lazo». El lazo sortea con la misma
 * cuenta con la que `Fauna._reponer()` decide qué animal aparece en un lugar:
 * `_aptitud × _actividad`, con la altura, la humedad, la pendiente en grados y
 * la distancia al agua de ese punto, la estación del reloj del mundo y la hora
 * local de cada minuto. Si el juego dice que en ese lugar a esa hora anda un
 * gato huiña, el lazo lo puede agarrar, y ésa es la razón de la ficha para que
 * el trampeo esté prohibido: el lazo no elige.
 *
 * Cuándo cae es un proceso de Poisson contra `tiempo.fecha`, el reloj del mundo,
 * y no contra `segundosTotales`, que son segundos reales. En tierra la tasa de
 * cada minuto es λ = T · Σ aptitud · actividad sobre lo que el objeto sostiene;
 * en el agua es λ = T constante, y el pez lo elige `Pesca._loQuePica()`. `T` es
 * `tasaCapturaPorHora` de `herramientas.json`, con su criterio al lado.
 *
 * La cuenta se hace exacta por minutos —la hora local cambia de a minuto, igual
 * que `Tiempo.horaDecimalLocal`— así que **mirar una vez a las diez horas o cada
 * diez minutos da la misma distribución**: el proceso no tiene memoria, y cada
 * tramo se integra entero. Por eso `actualizar()` se puede llamar por cuadro, una
 * vez al volver de dormir o dos veces con el mismo reloj, y el lazo agarra lo
 * mismo.
 *
 * ── Lo que no se aprovecha ──────────────────────────────────────────────────
 *
 * De las 25 especies de 100 g a 6 kg entre mamíferos y aves, 23 son fauna nativa
 * protegida. Si cae una, **no se aprovecha nada**: la ley que prohíbe cazarla no
 * cambia porque el animal ya esté muerto. La primera vez por especie lo dice el
 * panel de la norma, que espera; las siguientes, el cartel. Es la tesis del
 * juego —la negativa es el contenido— aplicada a la trampa, y puede ser
 * frustrante: es lo verdadero, y es lo que la ficha prometía.
 *
 * Lo que no está protegido —la liebre europea, el visón americano— rinde lo que
 * rinde cazado: `Caza._faena()`. Los peces de la nasa y la red están vivos y
 * siguen la regla de la caña (`Pesca.resolverPez()`).
 */

import { nombreDe } from './Recursos.js';

/** A cuánto de la trampa la tecla la ofrece. Lo que se alcanza agachándose. */
const ALCANCE_M = 2.5;
/** Hasta dónde se cala una nasa o una red desde donde está parado el jugador. */
const AGUA_A_MANO_M = 3;
/**
 * El lazo se deja un paso adelante y no bajo los pies: si no, aparece debajo de
 * la cámara y el jugador no ve lo que acaba de armar.
 */
const ADELANTE_M = 0.9;
/**
 * La nasa entra un poco al agua, no en la línea de la orilla, sin pasarse de
 * donde se la alcanza con la mano (`ALCANCE_M`).
 */
const ADENTRO_M = 0.6;
/**
 * Un lazo de cordel no cierra sobre un animal de menos de 100 g: se escurre. Es
 * el piso que decidió el jefe (RONDA8.md, fase 2); el techo es `presaMaxKg`.
 */
const PRESA_MIN_KG = 0.1;
const CLASES_DE_LAZO = ['mamifero', 'ave'];

const MS_MIN = 60000;
const MS_HORA = 3600000;
const MS_DIA = 86400000;
/** Bariloche es UTC−3 todo el año: la misma cuenta de `Tiempo.fechaLocal`. */
const DESFASE_LOCAL_MIN = -180;

const ESTADOS = { CR: 'en peligro crítico', EN: 'en peligro', VU: 'vulnerable' };

/** Minuto del día local, 0..1439, de un minuto absoluto desde 1970. */
function minutoLocal(minutoAbs) {
  const m = (minutoAbs + DESFASE_LOCAL_MIN) % 1440;
  return m < 0 ? m + 1440 : m;
}

/**
 * La hora decimal de ese minuto, **con la misma aritmética** que
 * `Tiempo.horaDecimalLocal` (horas + minutos / 60, sin segundos): `_actividad`
 * corta en 5,4 h, 7 h, 8,6 h, 18,4 h, 20 h y 21,6 h, y una hora calculada de
 * otra forma podría caer del otro lado de un corte.
 */
function horaDe(md) {
  return Math.floor(md / 60) + (md % 60) / 60;
}

/** Un intervalo exponencial de media 1. */
const exponencial = () => -Math.log(1 - Math.random());

export class Trampas {
  /**
   * @param {object} deps {mundo, fauna, peces, pesca, inventario, equipo, caza,
   *   norma, hud, tiempo, jugador, objetos}; `objetos` es `herramientas.json`
   *   `.objetos` y `tiempo` es el `Tiempo` de verdad.
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.porId = new Map((this.objetos || []).map(o => [o.id, o]));
    /**
     * Lo puesto. Cada una: `{id, objeto, x, z, puestaEn, hasta, usos, presas,
     * revisada}`. `puestaEn` y `hasta` son milisegundos del reloj del mundo:
     * `hasta` es hasta dónde ya se resolvió lo que pasó. `presas` es lo que cayó
     * y todavía no se revisó, cada una `{especieId, en}`.
     * @type {Array<object>}
     */
    this.lista = [];
    this._siguiente = 1;
    /** Especies protegidas cuyo panel ya se mostró: la segunda vez va al cartel. */
    this._normaVista = new Set();
    /** Objetos cuya licencia ya se dijo al ponerlos. */
    this._licenciaDicha = new Set();
    /** Lo que quiere enterarse de cada cambio de `lista`: `Trampas3D`. */
    this.oyentes = [];
    /** Lo que el lazo puede sostener, por objeto. `fauna.especies` no cambia. */
    this._elegibles = new Map();
    /**
     * El peso de cada especie en el punto de cada trampa, por estación. El
     * terreno no cambia y `_aptitud` es una función de sus argumentos, así que
     * se pregunta una vez por trampa y por estación y no en cada cuadro: con
     * diez lazos puestos eran 250 llamadas por cuadro: medido en Node, 152 µs por
     * cuadro así y 23 µs con esto (a 60 cuadros y 72×; es una cota, no la placa).
     */
    this._pesos = new WeakMap();
  }

  _avisar() { for (const f of this.oyentes) f(this); }

  // ── Qué es cada cosa ─────────────────────────────────────────────────────────

  /**
   * 'tierra', 'agua' o null. Lo dice la ficha: la que `habilita` trampear o se
   * declara `pasiva` va en tierra; la que habilita calar (`trampear_pez`), en el
   * agua. Nada de ids escritos acá: una trampa nueva en el dataset entra sola.
   */
  medioDe(objetoId) {
    const def = this.porId.get(objetoId);
    const h = def?.habilita || [];
    if (h.includes('trampear_pez')) return 'agua';
    if (def?.pasiva === true || h.includes('trampear')) return 'tierra';
    return null;
  }

  /** ¿Hay agua de pescar acá? La misma pregunta que `Peces.ambienteEn()`. */
  _esAgua(x, z) {
    if (this.peces?.ambienteEn) return !!this.peces.ambienteEn(x, z);
    return this.mundo.esAgua(x, z) || this.mundo.cauceEn(x, z) > 0.3;
  }

  // ── Poner ───────────────────────────────────────────────────────────────────

  /**
   * Dónde iría y si se puede. El lazo, en tierra firme y un paso adelante; la
   * nasa y la red, en el punto de agua más cercano a no más de 3 m.
   * @returns {{ok:boolean, motivo:string|null, x:number, z:number}}
   */
  evaluarPoner(objetoId, x = this.jugador?.posicion?.x, z = this.jugador?.posicion?.z) {
    const def = this.porId.get(objetoId);
    const medio = this.medioDe(objetoId);
    if (!medio) {
      return {
        ok: false, x, z,
        motivo: `${def?.nombre || nombreDe(objetoId)} no es algo que se deja puesto: lo que se arma y se vuelve a buscar son la trampa de lazo, la nasa y la red.`,
      };
    }
    if (!this.mundo.dentro(x, z)) return { ok: false, x, z, motivo: 'Acá se termina el mapa.' };

    if (medio === 'tierra') {
      const g = this.jugador?.giro;
      const candidatos = Number.isFinite(g)
        // Adelante es (−sen g, −cos g): la misma cuenta que la cámara.
        ? [[x - Math.sin(g) * ADELANTE_M, z - Math.cos(g) * ADELANTE_M], [x, z]]
        : [[x, z]];
      for (const [px, pz] of candidatos) {
        if (this.mundo.dentro(px, pz) && !this._esAgua(px, pz)) return { ok: true, motivo: null, x: px, z: pz };
      }
      return {
        ok: false, x, z,
        motivo: `${def.nombre} va en tierra firme, en la senda de un animal: acá es agua.`,
      };
    }

    const p = this._aguaMasCercana(x, z);
    if (!p) {
      return {
        ok: false, x, z,
        motivo: `${def.nombre} se cala en el agua, y no hay agua a menos de ${AGUA_A_MANO_M} m: acercate a la orilla.`,
      };
    }
    return { ok: true, motivo: null, x: p.x, z: p.z };
  }

  /**
   * El punto de agua más cercano a no más de `AGUA_A_MANO_M`, corrido un poco
   * hacia adentro si se puede sin pasarse de donde se lo alcanza. Anillos de a
   * 25 cm: la máscara del lago es de 32 m por texel, así que el borde es una recta
   * y el primer anillo que la toca da el punto más cercano con 25 cm de error.
   */
  _aguaMasCercana(x, z) {
    if (this._esAgua(x, z)) return { x, z };
    for (let r = 0.25; r <= AGUA_A_MANO_M + 1e-9; r += 0.25) {
      const n = Math.max(8, Math.ceil(r * 12));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const ux = Math.cos(a), uz = Math.sin(a);
        const px = x + ux * r, pz = z + uz * r;
        if (!this._esAgua(px, pz)) continue;
        const mas = Math.min(ADENTRO_M, Math.max(0, ALCANCE_M - 0.3 - r));
        const qx = x + ux * (r + mas), qz = z + uz * (r + mas);
        return mas > 0 && this._esAgua(qx, qz) ? { x: qx, z: qz } : { x: px, z: pz };
      }
    }
    return null;
  }

  /**
   * La saca del bolso —la instancia, con sus usos— y la deja en el mundo. Si
   * viene `cosa`, es ésa: el bolso manda el casillero al que apunta el jugador.
   * @returns {{ok:boolean, motivo:string|null, trampa?:object}}
   */
  poner(objetoId, cosa = null) {
    const def = this.porId.get(objetoId);
    const nombre = def?.nombre || nombreDe(objetoId);
    if (!this.medioDe(objetoId)) {
      return { ok: false, motivo: `${nombre} no es algo que se deja puesto.` };
    }
    const hay = this.inventario.instancias(objetoId);
    let elegida = cosa ? hay.find(h => h.cosa === cosa) : null;
    // Sin casillero señalado, la que esté mejor: con una nasa al 40 % y otra
    // entera, «poner la nasa» es poner la que va a durar.
    if (!elegida) for (const h of hay) if (!elegida || h.cosa.usos > elegida.cosa.usos) elegida = h;
    if (!elegida) {
      return { ok: false, motivo: `No tenés ${nombre.toLowerCase()} en el bolso.` };
    }
    if (!(elegida.cosa.usos > 0)) {
      return { ok: false, motivo: `${nombre} está gastada: hay que repararla antes de volver a ponerla.` };
    }
    const p = this.jugador.posicion;
    const ev = this.evaluarPoner(objetoId, p.x, p.z);
    if (!ev.ok) return { ok: false, motivo: ev.motivo };

    this.inventario.sacar(elegida.i);
    const ahora = this.tiempo.fecha.getTime();
    const trampa = {
      id: `trampa-${this._siguiente++}`,
      objeto: objetoId, x: ev.x, z: ev.z,
      puestaEn: ahora, hasta: ahora,
      usos: elegida.cosa.usos,
      presas: [],
      revisada: false,
    };
    this.lista.push(trampa);
    this._decirPuesta(def);
    this._avisar();
    return { ok: true, motivo: null, trampa };
  }

  /**
   * El aviso de poner. La primera vez de cada objeto dice la norma entera: el
   * trampeo está prohibido en todo el Parque y la nasa y la red en toda la
   * Patagonia, y el juego las deja usar bajo licencia. Esconderlo sería fingir
   * que la norma dice otra cosa.
   */
  _decirPuesta(def) {
    const agua = this.medioDe(def.id) === 'agua';
    const titulo = `${def.nombre} ${agua ? 'calada' : 'puesta'}`;
    const vuelta = 'Queda marcada en el mapa y en el minimapa. Se revisa y se levanta con E.';
    if (this._licenciaDicha.has(def.id)) { this.hud?.aviso(titulo, vuelta); return; }
    this._licenciaDicha.add(def.id);
    const norma = agua ? (def.notaLegal || def.nota || '') : (def.jurisdiccion || '');
    this.hud?.aviso(titulo, `${vuelta} ${norma}`.trim(), 14000);
  }

  // ── El tiempo ───────────────────────────────────────────────────────────────

  /**
   * Resuelve lo que pasó en cada trampa desde la última vez hasta
   * `tiempo.fecha`. Se puede llamar por cuadro: con el reloj quieto no hace
   * nada, y un cuadro a 72× es poco más de un minuto del mundo.
   */
  actualizar() {
    const ahora = this.tiempo?.fecha?.getTime?.();
    if (!Number.isFinite(ahora) || !this.lista.length) return;
    // Lo que se calcula una vez por llamada y se comparte entre trampas: la
    // actividad de cada especie por minuto del día, y la suma de cada lugar por
    // minuto. Se tira al salir: por cuadro se usan uno o dos minutos.
    const ctx = { filas: new Map(), lugares: new Map() };
    let cayo = false;
    for (const t of this.lista) {
      const desde = Number.isFinite(t.hasta) ? t.hasta : t.puestaEn;
      if (!(ahora > desde)) continue;
      const def = this.porId.get(t.objeto);
      const antes = t.presas.length;
      if (def) {
        if (this.medioDe(t.objeto) === 'agua') this._resolverAgua(t, def, desde, ahora);
        else this._resolverTierra(t, def, desde, ahora, ctx);
      }
      t.hasta = ahora;
      if (t.presas.length !== antes) cayo = true;
    }
    if (cayo) this._avisar();
  }

  /** Lo que el objeto puede sostener: mamíferos y aves de 100 g a `presaMaxKg`. */
  _elegiblesDe(def) {
    let e = this._elegibles.get(def.id);
    if (!e) {
      const max = def.presaMaxKg ?? Infinity;
      e = (this.fauna?.especies || []).filter(esp => CLASES_DE_LAZO.includes(esp.clase)
        && (esp.pesoKg ?? 0) >= PRESA_MIN_KG && (esp.pesoKg ?? Infinity) <= max);
      this._elegibles.set(def.id, e);
    }
    return e;
  }

  /**
   * El peso de cada especie elegible en el punto de la trampa y en esa estación:
   * `_aptitud` con los mismos argumentos que `Fauna._reponer` en ese punto.
   */
  _pesosEn(t, def, estacion) {
    let p = this._pesos.get(t);
    if (!p || p.x !== t.x || p.z !== t.z || p.estacion !== estacion || p.objeto !== def.id) {
      const m = this.mundo;
      const k = m.indiceDe(t.x, t.z);
      const altitud = m.alturaEn(t.x, t.z);
      const humedad = m.humedadEn(t.x, t.z);
      const pendiente = m.pendienteEn(t.x, t.z) * 180 / Math.PI;
      const distanciaAgua = k >= 0 ? m.distanciaAgua[k] : 9999;
      const e = this._elegiblesDe(def);
      const pesos = new Float64Array(e.length);
      let alguno = false;
      for (let i = 0; i < e.length; i++) {
        pesos[i] = this.fauna._aptitud(e[i], altitud, humedad, pendiente, estacion, distanciaAgua);
        if (pesos[i] > 0) alguno = true;
      }
      p = { x: t.x, z: t.z, estacion, objeto: def.id, pesos, alguno };
      this._pesos.set(t, p);
    }
    return p;
  }

  /**
   * La actividad de cada especie elegible en un minuto del día, una vez por
   * llamada. Por mapas y no por tablas de 1440: por cuadro se piden uno o dos
   * minutos, y reservar el día entero en cada cuadro sería basura para el
   * recolector sin ninguna ganancia.
   */
  _fila(def, md, ctx) {
    let porMinuto = ctx.filas.get(def.id);
    if (!porMinuto) { porMinuto = new Map(); ctx.filas.set(def.id, porMinuto); }
    let f = porMinuto.get(md);
    if (!f) {
      const e = this._elegiblesDe(def);
      const hora = horaDe(md);
      f = new Float64Array(e.length);
      for (let i = 0; i < e.length; i++) f[i] = this.fauna._actividad(e[i], hora);
      porMinuto.set(md, f);
    }
    return f;
  }

  /**
   * Los pesos de la trampa y la suma por minuto del día (Σ aptitud · actividad)
   * en esta llamada, que se llena a medida que se pide.
   */
  _lugar(t, def, estacion, ctx) {
    const p = this._pesosEn(t, def, estacion);
    let L = ctx.lugares.get(p);
    if (!L) {
      L = { pesos: p.pesos, alguno: p.alguno, suma: new Map(), dia: -1 };
      ctx.lugares.set(p, L);
    }
    return L;
  }

  _sumaEn(L, def, md, ctx) {
    let s = L.suma.get(md);
    if (s === undefined) {
      const f = this._fila(def, md, ctx);
      s = 0;
      for (let i = 0; i < f.length; i++) s += L.pesos[i] * f[i];
      L.suma.set(md, s);
    }
    return s;
  }

  /** Σ aptitud · actividad de un día entero, en minutos: cualquier 1440 seguidos. */
  _sumaDia(L, def, ctx) {
    if (L.dia < 0) {
      let s = 0;
      for (let md = 0; md < 1440; md++) s += this._sumaEn(L, def, md, ctx);
      L.dia = s;
    }
    return L.dia;
  }

  /**
   * El lazo, de `desde` a `hasta`. Se sortea el umbral de una exponencial y se
   * integra la tasa minuto a minuto hasta alcanzarlo: el primer animal cae ahí, y
   * la especie sale con el peso que tiene en ese minuto. Un día entero sin llegar
   * al umbral se salta de un golpe con su suma, así volver después de una semana
   * no recorre diez mil minutos.
   */
  _resolverTierra(t, def, desde, hasta, ctx) {
    const T = def.tasaCapturaPorHora;
    // El lazo agarra uno solo: después de la primera presa queda cerrado.
    const capacidad = 1;
    if (!(T > 0) || t.presas.length >= capacidad || !this.fauna) return;
    const e = this._elegiblesDe(def);
    if (!e.length) return;
    const porMinuto = T / 60;

    let umbral = exponencial();
    let H = 0;
    let s = desde;
    while (s < hasta && t.presas.length < capacidad) {
      // La estación es la del mes UTC del reloj, como en `Tiempo.estado()`: el
      // tramo se corta al fin de mes.
      const f = new Date(s);
      const mes = f.getUTCMonth();
      const finMes = Date.UTC(f.getUTCFullYear(), mes + 1, 1);
      const b = Math.min(hasta, finMes);
      const estacion = this.tiempo.estacionDe(mes + 1).id;
      const L = this._lugar(t, def, estacion, ctx);
      if (!L.alguno) { s = b; continue; }

      while (s < b) {
        if (s % MS_MIN === 0 && b - s >= MS_DIA) {
          const dia = this._sumaDia(L, def, ctx) * porMinuto;
          if (H + dia < umbral) { H += dia; s += MS_DIA; continue; }
        }
        const M = Math.floor(s / MS_MIN);
        const fin = Math.min(b, (M + 1) * MS_MIN);
        const md = minutoLocal(M);
        const r = this._sumaEn(L, def, md, ctx) * porMinuto;
        const h = r * (fin - s) / MS_MIN;
        if (h > 0 && H + h >= umbral) {
          const en = s + (umbral - H) / r * MS_MIN;
          t.presas.push({ especieId: this._sortear(e, L.pesos, this._fila(def, md, ctx)).id, en: Math.round(en) });
          if (t.presas.length >= capacidad) return;
          umbral = exponencial(); H = 0; s = en;
          continue;
        }
        H += h;
        s = fin;
      }
    }
  }

  _sortear(especies, pesos, fila) {
    let total = 0;
    for (let i = 0; i < especies.length; i++) total += pesos[i] * fila[i];
    let r = Math.random() * total;
    for (let i = 0; i < especies.length; i++) {
      r -= pesos[i] * fila[i];
      if (r <= 0 && pesos[i] * fila[i] > 0) return especies[i];
    }
    for (let i = especies.length - 1; i >= 0; i--) if (pesos[i] * fila[i] > 0) return especies[i];
    return especies[0];
  }

  /**
   * La nasa y la red: λ = T constante. Los peces llegan con intervalos
   * exponenciales, y cada uno sale de `Pesca._loQuePica()` en esa agua. Juntan
   * todo lo que caiga hasta los usos que les quedan: un pez gasta un uso al
   * revisarla, así que no caben más peces que usos.
   */
  _resolverAgua(t, def, desde, hasta) {
    const T = def.tasaCapturaPorHora;
    if (!(T > 0) || !this.pesca) return;
    const ambiente = this.peces?.ambienteEn?.(t.x, t.z);
    if (!ambiente) return;
    let s = desde;
    while (t.presas.length < t.usos) {
      s += exponencial() / T * MS_HORA;
      if (!(s <= hasta)) break;
      const esp = this.pesca._loQuePica(ambiente);
      if (esp) t.presas.push({ especieId: esp.id, en: Math.round(s) });
    }
  }

  // ── Revisar y levantar ──────────────────────────────────────────────────────

  /** La trampa más cercana a menos de 2,5 m, o null. */
  cerca(x, z) {
    let mejor = null, mejorD = ALCANCE_M;
    for (const t of this.lista) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < mejorD) { mejor = t; mejorD = d; }
    }
    return mejor;
  }

  /**
   * Lo que dice el cartel de la tecla sobre una trampa. Dice qué hay adentro:
   * el jugador está parado al lado.
   */
  etiqueta(t) {
    const def = this.porId.get(t.objeto);
    const nombre = (def?.nombre || nombreDe(t.objeto)).toLowerCase();
    const n = t.presas?.length || 0;
    if (!n) return `Levantar la ${nombre} · vacía`;
    if (this.medioDe(t.objeto) === 'agua') {
      return `Revisar la ${nombre} · ${n === 1 ? '1 pez' : `${n} peces`} adentro`;
    }
    const esp = this._especie(t.presas[0].especieId);
    return `Revisar la ${nombre} · adentro: ${(esp?.nombreComun || t.presas[0].especieId).toLowerCase()}`;
  }

  _especie(id) {
    return this.fauna?.porId?.get(id) || this.peces?.porId?.get(id)
      || (this.fauna?.especies || []).find(e => e.id === id) || null;
  }

  _quitar(t) {
    const i = this.lista.indexOf(t);
    if (i >= 0) this.lista.splice(i, 1);
  }

  /**
   * Revisar lo que cayó. En tierra: lo protegido no rinde nada y la norma lo
   * dice; lo demás rinde `Caza._faena()`; y el lazo se gasta. En el agua, cada
   * pez con la regla de la caña, y un uso por pez.
   * @returns {{ok:boolean, presa:object|null, rinde:Array, protegida:boolean, motivo:string|null}}
   */
  revisar(t) {
    if (!this.lista.includes(t)) return { ok: false, presa: null, rinde: [], protegida: false, motivo: 'Esa trampa ya no está puesta.' };
    const def = this.porId.get(t.objeto);
    if (!t.presas.length) return { ok: true, presa: null, rinde: [], protegida: false, motivo: 'Vacía.' };
    return this.medioDe(t.objeto) === 'agua' ? this._revisarAgua(t, def) : this._revisarTierra(t, def);
  }

  _revisarTierra(t, def) {
    const presa = t.presas[0];
    const esp = this._especie(presa.especieId);
    const nombre = esp?.nombreComun || presa.especieId;
    const trampa = `la ${(def?.nombre || 'trampa').toLowerCase()}`;

    // Lo protegido: nada entra, la trampa se gasta igual —el lazo ya cerró— y
    // la norma lo explica. `protegida` falta en pocas fichas y ante la duda se
    // trata como protegida: es fauna de un Parque Nacional.
    if (!esp || esp.protegida !== false) {
      if (esp) this.caza?.codice?.registrarFauna?.(esp, true);
      this._gastar(t, def);
      this._decirNorma(esp, nombre, def);
      return { ok: true, presa, rinde: [], protegida: true, motivo: 'fauna nativa protegida: no se aprovecha' };
    }

    const rinde = this.caza?._faena?.(esp) || [];
    // Si no entra NADA, la presa se queda en el lazo y el jugador ya sabe que
    // está: el mapa lo marca (`revisada`). Si entra algo, se lleva lo que
    // entra, como en `Caza.intentar`.
    if (rinde.length && rinde.every(r => !(this.inventario.entra(r.recurso, r.cantidad) > 0))) {
      t.revisada = true;
      this._avisar();
      const motivo = `No te entra nada más (${this.inventario.pesoKg.toFixed(1)} kg): hacé lugar y volvé: sigue en ${trampa}.`;
      this.hud?.aviso(`${nombre} en ${trampa}`, motivo);
      return { ok: false, presa, rinde: [], protegida: false, motivo };
    }
    const obtenido = [];
    for (const r of rinde) {
      const n = this.inventario.agregar(r.recurso, r.cantidad);
      if (n > 0) obtenido.push({ recurso: r.recurso, cantidad: n });
    }
    this.caza?.codice?.registrarFauna?.(esp, true);
    this._gastar(t, def);
    const nota = this.caza?.reglaPorEspecie?.get(esp.id)?.razonEcologica || '';
    this.hud?.aviso(`${nombre} en ${trampa}`,
      `${obtenido.map(o => `${o.cantidad} × ${nombreDe(o.recurso).toLowerCase()}`).join(' · ')}`
      + ` · ${def?.durabilidad === 1 ? 'el lazo quedó cerrado: se gasta al agarrar' : 'la trampa se gastó un uso'}.`
      + (nota ? ` ${nota}` : ''), 7000);
    return { ok: true, presa, rinde: obtenido, protegida: false, motivo: null };
  }

  /** Un uso menos; sin usos, la trampa deja de estar puesta y no vuelve al bolso. */
  _gastar(t, def, cuanto = 1) {
    if (Number.isFinite(t.usos)) t.usos = Math.max(0, t.usos - cuanto);
    t.presas = [];
    t.revisada = false;
    if (!(t.usos > 0)) this._quitar(t);
    this._avisar();
  }

  /**
   * La norma del trampeo, con la especie que cayó. La primera vez de cada
   * especie abre el panel que espera; las siguientes se anotan en el registro
   * sin frenar el juego y lo dice el cartel.
   */
  _decirNorma(esp, nombre, def) {
    const id = esp?.id || nombre;
    const estado = ESTADOS[esp?.estadoConservacion] ? ` (${ESTADOS[esp.estadoConservacion]})` : '';
    const v = {
      titulo: `${nombre} en la ${(def?.nombre || 'trampa').toLowerCase()}: fauna nativa protegida`,
      detalle: `La trampa no elige, y esta vez cayó un ejemplar de ${nombre.toLowerCase()}${estado}: fauna nativa de un área protegida. `
        + 'La ley que prohíbe cazarla no cambia porque el animal ya esté muerto: no se aprovecha nada, ni la carne ni el cuero. '
        + 'Por eso el trampeo no entra en ningún reglamento: un método que no elige a quién agarra no se puede regular por especie.',
      nota: def?.jurisdiccion || '',
      gravedad: 'grave',
      color: '#c8503f',
    };
    const ctx = this.caza?._contextoNorma?.() || { fecha: this.tiempo?.textoFecha || '' };
    const primera = !this._normaVista.has(id);
    this._normaVista.add(id);
    if (primera) {
      const abrio = this.norma?.mostrar ? this.norma.mostrar(v, ctx) : false;
      if (!abrio) this.hud?.aviso(v.titulo, v.detalle, 9000);
      return;
    }
    // La segunda vez va al registro con su gravedad de verdad —es tan grave como
    // la primera— y sin el panel: `anotar()` no lo abre nunca. El cartel avisa.
    this.norma?.anotar?.(v, ctx);
    this.hud?.aviso(v.titulo, 'Otra vez fauna protegida: no se aprovecha nada. Queda anotado en el códice, en Normativa.', 7000);
  }

  _revisarAgua(t, def) {
    const presas = t.presas.slice();
    let piezas = 0, devueltos = 0, sinLugar = 0;
    const lineas = [];
    for (const pz of presas) {
      const esp = this._especie(pz.especieId);
      if (!esp || !this.pesca?.resolverPez) continue;
      const r = this.pesca.resolverPez(esp, { avisar: false, premiar: false });
      if (r.conservado) piezas += r.piezas;
      else if (r.motivo === 'exotica') sinLugar++;
      else devueltos++;
      lineas.push(r.titulo);
    }
    this._gastar(t, def, presas.length);
    const rota = !this.lista.includes(t);
    const partes = [];
    if (piezas) partes.push(`${piezas} × pescado`);
    if (devueltos) partes.push(`${devueltos} ${devueltos === 1 ? 'pez devuelto' : 'peces devueltos'} al agua`);
    if (sinLugar) partes.push(`${sinLugar} sin lugar en el bolso`);
    this.hud?.aviso(`${def?.nombre || 'La trampa'}: ${presas.length === 1 ? '1 pez' : `${presas.length} peces`}`,
      `${partes.join(' · ')}. ${lineas.join(' · ')}.${rota ? ` ${def?.nombre || 'La trampa'} se gastó del todo.` : ''}`, 9000);
    return {
      ok: true, presa: presas[0] || null, presas,
      rinde: piezas ? [{ recurso: 'pescado', cantidad: piezas }] : [],
      protegida: false, devueltos, motivo: null,
    };
  }

  /**
   * Levantar una trampa vacía: vuelve al bolso con sus usos. Con algo adentro
   * primero se revisa, y sin casillero libre no se levanta —perderla por no
   * tener dónde ponerla sería el defecto que la grilla vino a cerrar—.
   */
  levantar(t) {
    if (!this.lista.includes(t)) return { ok: false, motivo: 'Esa trampa ya no está puesta.' };
    const def = this.porId.get(t.objeto);
    const nombre = def?.nombre || nombreDe(t.objeto);
    if (t.presas.length) return { ok: false, motivo: `${nombre} tiene algo adentro: primero se revisa.` };
    const cosa = { id: t.objeto, n: 1, usos: t.usos };
    if (!this.inventario.meter(cosa)) {
      const motivo = `No te queda un casillero libre donde guardar ${nombre.toLowerCase()}: soltá algo primero. Queda puesta.`;
      this.hud?.aviso(nombre, motivo);
      return { ok: false, motivo };
    }
    this._quitar(t);
    this.hud?.aviso(`Levantaste ${nombre.toLowerCase()}`, 'Vacía, vuelve al bolso entera.');
    this._avisar();
    return { ok: true, motivo: null, cosa };
  }

  // ── Guardado ────────────────────────────────────────────────────────────────

  /** Datos planos: lo puesto con lo que tiene adentro, y los avisos ya dados. */
  serializar() {
    return {
      puestas: this.lista.map(t => ({
        id: t.id, objeto: t.objeto, x: t.x, z: t.z,
        puestaEn: t.puestaEn, hasta: Number.isFinite(t.hasta) ? t.hasta : t.puestaEn,
        // Como en el inventario: un infinito viaja como null.
        usos: Number.isFinite(t.usos) ? t.usos : null,
        presas: (t.presas || []).map(p => ({ ...p })),
        revisada: !!t.revisada,
      })),
      normaVista: [...this._normaVista],
      licenciaDicha: [...this._licenciaDicha],
    };
  }

  /**
   * Vuelve a poner lo guardado, y avisa para que `Trampas3D` rearme los modelos.
   * Acepta también una lista a secas. Lo que el dataset dejó de conocer se
   * descarta en silencio, igual que una obra que ya no existe.
   */
  reponer(datos) {
    this.lista.length = 0;
    const puestas = Array.isArray(datos) ? datos : (Array.isArray(datos?.puestas) ? datos.puestas : []);
    let mayor = 0;
    for (const g of puestas) {
      if (!g || !this.medioDe(g.objeto) || !Number.isFinite(g.x) || !Number.isFinite(g.z)) continue;
      const puestaEn = Number.isFinite(g.puestaEn) ? g.puestaEn : this.tiempo.fecha.getTime();
      const def = this.porId.get(g.objeto);
      this.lista.push({
        id: typeof g.id === 'string' ? g.id : `trampa-${this._siguiente++}`,
        objeto: g.objeto, x: g.x, z: g.z,
        puestaEn, hasta: Number.isFinite(g.hasta) ? g.hasta : puestaEn,
        usos: Number.isFinite(g.usos) ? g.usos : (g.usos === null ? Infinity : (def?.durabilidad ?? 1)),
        presas: Array.isArray(g.presas) ? g.presas.filter(p => typeof p?.especieId === 'string').map(p => ({ ...p })) : [],
        revisada: !!g.revisada,
      });
      const n = /^trampa-(\d+)$/.exec(g.id || '')?.[1];
      if (n) mayor = Math.max(mayor, +n);
    }
    this._siguiente = Math.max(this._siguiente, mayor + 1);
    if (!Array.isArray(datos)) {
      this._normaVista = new Set(Array.isArray(datos?.normaVista) ? datos.normaVista : []);
      this._licenciaDicha = new Set(Array.isArray(datos?.licenciaDicha) ? datos.licenciaDicha : []);
    }
    this._avisar();
    return true;
  }
}
