/**
 * Construcción — levantar cosas donde la ley lo permite, y sólo ahí.
 *
 * Tercer sistema con la misma forma que la caza y la minería, y por el mismo
 * artículo: la Ley 22.351 prohíbe en los Parques Nacionales levantar edificios e
 * instalaciones, salvo las destinadas al control del área y a la atención del
 * turismo, autorizadas por la Administración de Parques Nacionales. Ésa no es
 * una excepción de trámite: es la razón por la que existen los refugios de
 * montaña del Nahuel Huapi y no existen las cabañas particulares al lado.
 *
 * Hay cuatro categorías y cada una vive en una jurisdicción distinta:
 *
 * - efímera      Parapeto y vivac. La ley no los trata como obra: son material
 *                caído, se desarman al irse y no dejan rastro. Van a todos lados.
 * - campamento   Toldo y depósito liviano. Dentro del parque sólo en áreas
 *                habilitadas, así que acá se admiten en reserva y afuera.
 * - uso_publico  Refugio de montaña. La excepción de la propia ley.
 * - permanente   Cabaña, galpón, aserradero. Sólo fuera del área protegida.
 *
 * Las obras hacen tres cosas medibles: abrigan (y eso entra en el modelo
 * térmico del jugador), guardan material sin que pese en el bolso, y algunas
 * procesan —el aserradero da tabla y poste, el ahumadero charqui, el molino
 * harina—, en cuyo caso se registran como hornos y aparecen en el taller.
 */

import { normalizar, nombreDe, pesoDe } from './Recursos.js';

const SEPARACION_M = 5;
const RADIO_ABRIGO_M = 6;
const RADIO_DEPOSITO_M = 8;

export class Construccion {
  /**
   * @param {object} datos contenido de construccion.json
   * @param {object} deps {inventario, saberes, jugador, tiempo, hud, limites, mundo, fundicion}
   */
  constructor(datos, deps) {
    this.d = datos || {};
    Object.assign(this, deps);
    /** @type {Array<{obra:object, x:number, z:number, y:number, guardado:Map}>} */
    this.obras = [];
    this.alCambiar = null;

    // Las recetas de las obras que procesan viven en el mismo taller que las de
    // los hornos: para el jugador es todo "cargar y esperar".
    this.fundicion?.agregarRecetas(
      (this.d.recetas || []).map(r => ({ ...r, horno: r.obra }))
    );
  }

  get catalogo() { return this.d.obras || []; }

  categoriaDe(obra) {
    return (this.d.categorias || []).find(c => c.id === obra.categoria) || {};
  }

  faltaPara(obra) {
    return (obra.materiales || [])
      .map(m => ({
        recurso: normalizar(m.recurso), nombre: nombreDe(m.recurso),
        pide: m.cantidad, hay: this.inventario.disponiblePara(m.recurso),
      }))
      .filter(m => m.hay < m.pide);
  }

  /**
   * Veredicto sobre levantar esta obra acá. Como siempre en este juego, la
   * negativa explica: es el contenido, no el obstáculo.
   */
  evaluar(obra, x, z) {
    const j = this.limites.jurisdiccion(x, z);
    const cat = this.categoriaDe(obra);

    if (!(cat.dondeSePuede || []).includes(j)) {
      const p = this.d.penalidades?.[j] || {};
      return {
        permitido: false, jurisdiccion: j, categoria: cat,
        titulo: cat.tituloNegado || p.titulo || 'No se puede construir acá',
        detalle: `${p.detalle || ''} ${cat.explicacion || ''}`.trim(),
        castigo: p.castigoSaber ?? 0,
      };
    }

    // Una tecnología no desbloqueada no es una infracción: es no saber todavía
    const tec = obra.requiereTecnologia || cat.requiereTecnologia;
    if (tec && !this.saberes.desbloqueadas.has(tec)) {
      const def = this.saberes.porId.get(tec);
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0,
        titulo: `Todavía no sabés hacerlo`,
        detalle: `Hace falta desbloquear «${def?.nombre || tec}» en el códice.`,
      };
    }

    if (obra.alturaMinimaM && this.mundo.alturaEn(x, z) < obra.alturaMinimaM) {
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0,
        titulo: `${obra.nombre}: demasiado abajo`,
        detalle: `Un refugio de montaña se justifica en altura, donde el clima es un peligro y no hay dónde bajar. Hace falta estar por encima de los ${obra.alturaMinimaM} m; acá estás a ${Math.round(this.mundo.alturaEn(x, z))} m.`,
      };
    }

    if (this.mundo.esAgua(x, z)) {
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0,
        titulo: 'Estás en el agua', detalle: 'Buscá tierra firme.',
      };
    }
    if (this.mundo.pendienteEn(x, z) > 0.5) {
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0,
        titulo: 'Demasiada pendiente',
        detalle: 'Nada se apoya acá. Buscá un lugar más parejo.',
      };
    }
    if (this.obras.some(o => Math.hypot(o.x - x, o.z - z) < SEPARACION_M)) {
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0,
        titulo: 'Muy encima de otra obra', detalle: 'Correte unos pasos.',
      };
    }

    const falta = this.faltaPara(obra);
    if (falta.length) {
      return {
        permitido: false, jurisdiccion: j, categoria: cat, castigo: 0, falta,
        titulo: `Falta material para ${obra.nombre.toLowerCase()}`,
        detalle: falta.map(f => `${f.nombre} ${f.hay}/${f.pide}`).join(' · '),
      };
    }

    return { permitido: true, jurisdiccion: j, categoria: cat, castigo: 0 };
  }

  levantar(obra) {
    const p = this.jugador.posicion;
    const v = this.evaluar(obra, p.x, p.z);
    if (!v.permitido) {
      if (v.castigo > 0) {
        this.saberes.puntos = Math.max(0, this.saberes.puntos - v.castigo);
      }
      this.hud.negativa(v, { fecha: this.tiempo?.textoFecha });
      return null;
    }

    for (const m of obra.materiales || []) {
      this.inventario.consumirPara(normalizar(m.recurso), m.cantidad);
    }

    const cat = this.categoriaDe(obra);
    const construida = {
      obra, x: p.x, z: p.z, y: this.mundo.alturaEn(p.x, p.z),
      // Lo efímero se desarma solo: es la promesa que lo hace legal en el parque
      vence: cat.duracionDias
        ? this.tiempo.fecha.getTime() + cat.duracionDias * 86400000
        : null,
      guardado: new Map(),
    };
    this.obras.push(construida);

    // Las que procesan pasan a ser hornos del taller
    if (obra.procesa) {
      this.fundicion.hornos.push({
        def: { id: obra.id, nombre: obra.nombre, descripcion: obra.descripcion, temperaturaC: null },
        x: construida.x, z: construida.z, y: construida.y, trabajo: null,
      });
    }

    this.saberes.otorgar(4, `${obra.nombre} en pie`);
    this.hud.aviso(obra.nombre, obra.nota || obra.descripcion);
    this.alCambiar?.();
    return construida;
  }

  // ── Efectos ───────────────────────────────────────────────────────────────

  /**
   * Cuánto abriga lo que el jugador tenga alrededor, de 0 a 1. Se queda con la
   * mejor: meterse en dos refugios a la vez no abriga el doble.
   */
  abrigoEn(x, z) {
    let mejor = 0;
    for (const o of this.obras) {
      if (!o.obra.abrigo) continue;
      if (Math.hypot(o.x - x, o.z - z) > RADIO_ABRIGO_M) continue;
      mejor = Math.max(mejor, o.obra.abrigo);
    }
    return mejor;
  }

  /** El depósito más cercano con capacidad, si hay alguno a mano. */
  depositoCercano(x, z) {
    let mejor = null, mejorD = RADIO_DEPOSITO_M;
    for (const o of this.obras) {
      if (!o.obra.guarda) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < mejorD) { mejor = o; mejorD = d; }
    }
    return mejor;
  }

  /** Cuánto pesa lo guardado, para mostrar cuánto se sacó de encima. */
  pesoGuardado(dep) {
    let p = 0;
    for (const [k, n] of dep.guardado) p += n * pesoDe(k);
    return p;
  }

  /** Dejar todo el material que no sea comida ni herramienta en el depósito. */
  guardarTodo(dep) {
    let movidos = 0, lleno = false;
    for (const it of this.inventario.listar()) {
      if (it.cat === 'alimento') continue;
      // Un troje tiene capacidad, igual que el bolso: entra lo que entra
      const libre = dep.obra.guarda - this.pesoGuardado(dep);
      const unidad = pesoDe(it.id);
      const caben = unidad > 0 ? Math.floor(libre / unidad) : it.cantidad;
      const n = Math.min(it.cantidad, Math.max(0, caben));
      if (n <= 0) { lleno = true; continue; }
      if (this.inventario.quitar(it.id, n)) {
        dep.guardado.set(it.id, (dep.guardado.get(it.id) || 0) + n);
        movidos += n;
      }
    }
    this.hud.aviso(movidos ? `Guardaste ${movidos} unidades` : (lleno ? `${dep.obra.nombre} lleno` : 'No había nada que guardar'),
      `${dep.obra.nombre} · cargás ${this.inventario.pesoKg.toFixed(1)} kg · guardado ${this.pesoGuardado(dep).toFixed(1)} de ${dep.obra.guarda} kg`);
    this.alCambiar?.();
    return movidos;
  }

  /** Sacar del depósito lo que entre en el bolso. */
  retirar(dep, recurso, cantidad) {
    const hay = dep.guardado.get(recurso) || 0;
    const pide = Math.min(hay, cantidad);
    if (!pide) return 0;
    const n = this.inventario.agregar(recurso, pide);
    if (n <= 0) {
      this.hud.aviso('No entra nada más', `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
      return 0;
    }
    if (n >= hay) dep.guardado.delete(recurso);
    else dep.guardado.set(recurso, hay - n);
    this.alCambiar?.();
    return n;
  }

  /**
   * Desarma lo efímero cuando se le cumple el plazo. No es una limpieza técnica:
   * es la condición que lo hacía legal.
   */
  actualizar() {
    const ahora = this.tiempo.fecha.getTime();
    const caidas = this.obras.filter(o => o.vence != null && ahora > o.vence);
    if (!caidas.length) return [];
    this.obras = this.obras.filter(o => !caidas.includes(o));
    for (const c of caidas) {
      this.hud.aviso(`${c.obra.nombre} desarmado`,
        'Lo efímero se levanta y se va sin dejar rastro: ésa es la condición que lo hacía posible acá.');
    }
    this.alCambiar?.();
    return caidas;
  }
}
