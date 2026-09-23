/**
 * Fabricación — hacer cosas con lo que hay en el bolso.
 *
 * Se fabrica desde el bolso, sin banco de trabajo. Fue una decisión explícita: el
 * gesto del nivel 0 es «esto lo hago con las manos», y meter una mesa de
 * carpintero entre el jugador y su primer cordel sería inventar una fricción que
 * la realidad no tiene. Una lasca se saca sentado en una piedra.
 *
 * Las dos excepciones son físicas y no de diseño: el hierro pide la fragua
 * porque hay que ablandarlo, y la brea y el curtido piden fuego porque hay que
 * cocerlos. Para esas se reusa `Fundicion.cercano()`, que ya resuelve «¿tengo un
 * horno al lado y está prendido?» y ya registra el aserradero como uno más.
 *
 * El telar es la tercera excepción, y es de otra clase: no pide fuego, pide un
 * lugar armado. El poncho se teje en un witral en pie, y el witral es una obra de
 * campamento que `Construccion` anota como estación en `Fundicion`. Esa estación
 * no se busca con `cercano()` —ver `_estacionDeObra()`—; la fogata y la fragua
 * sí, igual que antes.
 *
 * Y hay recetas que no piden un lugar sino una herramienta encima: hilar pide
 * el huso, y desde la ronda 8 toda la cadena de la piedra pide el percutor o el
 * martillo. Se hila en cualquier lado, pero no sin huso. Es `pideHerramienta`, y
 * se mira antes que la estación y antes de consumir nada. Puede ser un id o una
 * lista de ids, y una lista se lee como un O: ver `herramientaQueFalta()`.
 *
 * El molde de «pedir materiales, ver qué falta, consumir» ya estaba escrito tres
 * veces en el proyecto —`Saberes.estado()`, `Fundicion.estadoReceta()`,
 * `Construccion.faltaPara()`— y las tres usan `disponiblePara`/`consumirPara`
 * del inventario, que cuentan equivalencias. Esta es la cuarta y usa lo mismo:
 * la madera dura del coihue sirve donde una receta pide madera.
 */

import { pesoDe, nombreDe } from './Recursos.js';

/**
 * El radio de una estación de obra. Son los 8 m de `Fundicion.cercano()`, escritos
 * dos veces porque `Fundicion` no los exporta: está pedido en
 * `pendiente-r7-witral.md`. Hasta entonces, si cambia uno, cambian los dos.
 */
const RADIO_ESTACION_M = 8;

export class Fabricacion {
  /**
   * @param {object} datos herramientas.json
   * @param {object} deps {inventario, saberes, equipo, fundicion, hud}
   */
  constructor(datos, { inventario, saberes, equipo, fundicion, hud }) {
    Object.assign(this, { datos, inventario, saberes, equipo, fundicion, hud });
    this.catalogo = (datos.objetos || []).filter(o => (o.materiales || []).length);
    this.alCambiar = null;
  }

  /** ¿La estación que pide este objeto está a mano y en condiciones? */
  estacion(obj) {
    const donde = obj.donde || 'bolso';
    if (donde === 'bolso') return { ok: true };

    // Una estación que no es la fogata ni un horno de `mineria.json` es una obra:
    // hoy, el telar. Ésa se busca aparte. La fogata y la fragua siguen por el
    // camino de abajo sin cambiar una coma.
    const esHorno = donde === 'fogata' || !!this.fundicion?.hornoPorId?.(donde);
    if (!esHorno && this.fundicion) return this._estacionDeObra(donde);

    const horno = this.fundicion?.cercano();
    if (donde === 'fogata') {
      if (horno && this.fundicion.arde(horno)) return { ok: true };
      return { ok: false, motivo: 'Hace falta un fuego encendido al lado: esto hay que cocerlo.' };
    }
    if (horno?.def?.id === donde) {
      if (!this.fundicion.usaFuego(horno) || this.fundicion.arde(horno)) return { ok: true };
      return { ok: false, motivo: `La ${horno.def.nombre.toLowerCase()} está apagada.` };
    }
    const def = this.fundicion?.definicionesHorno?.find(d => d.id === donde);
    return { ok: false, motivo: `Hace falta estar al lado de: ${def?.nombre || donde}.` };
  }

  /**
   * ¿Hay una obra con este id en pie a menos de 8 m?
   *
   * No usa `Fundicion.cercano()`, y ésa es la razón de que este método exista.
   * `cercano()` devuelve **un solo** horno, el más cercano, y recién después se
   * pregunta si es el que hace falta. Con la fogata del campamento a un metro y
   * el telar a cinco —que es como se arma un campamento—, el poncho decía que
   * faltaba el telar teniéndolo al lado. Acá se pregunta al revés: entre todas
   * las estaciones a mano, ¿alguna es ésta?
   */
  _estacionDeObra(id) {
    const f = this.fundicion;
    const p = f.jugador?.posicion;
    const deEsas = f.hornos.filter(h => h.def?.id === id);
    // `arde()` da siempre sí a lo que no quema, como el telar; queda por si una
    // obra que procesa con fuego llega a pedirse como estación.
    if (p && deEsas.some(h => Math.hypot(h.x - p.x, h.z - p.z) < RADIO_ESTACION_M && f.arde(h))) {
      return { ok: true };
    }
    // El nombre sale de una obra levantada, si hay alguna en el mapa, y si no del
    // id: `Fabricacion` no conoce el catálogo de obras, y para decirlo no hace falta.
    const nombre = deEsas[0]?.def?.nombre || nombreDe(id);
    return {
      ok: false,
      motivo: `Esto se hace al lado de: ${nombre}. Tiene que estar en pie y a menos de ${RADIO_ESTACION_M} m.`,
    };
  }

  /**
   * La herramienta que pide la receta y no está, o null si no pide o está.
   *
   * Hasta el huso ninguna receta pedía tener algo encima. Lo que hacía falta para
   * fabricar era un material, que se gasta, o un lugar, que se queda. El huso no es
   * ninguna de las dos cosas: hilar no lo gasta, y va a donde va uno. Por eso es un
   * campo propio y no un material de cantidad cero.
   *
   * Cuenta tenerlo en el bolso o puesto, que es lo que dice `Equipo.tiene()`. Roto
   * no cuenta: con un huso partido no se hila.
   *
   * ── Ronda 8, fase 5: `pideHerramienta` puede ser una lista ────────────────
   *
   * El huso era un caso de uno: se hila con el huso o no se hila. El mango no:
   * se labra con **cualquier filo**, y hay tres —la lasca de rodado, la de
   * obsidiana y el cuchillo enmangado—. Escrito con un id solo, pedir el mejor
   * dejaba la primera hacha detrás de los 1500 m de la obsidiana, y pedir el
   * peor hacía que tener el cuchillo no sirviera. Con lista, la receta dice
   * «algo que corte» y **alcanza con tener uno sano**: es un O, no un Y. Un id
   * suelto se sigue aceptando y significa lo mismo que antes, así que ninguna
   * ficha vieja cambia de sentido.
   *
   * Lo que se devuelve cuando falta es el PRIMERO de la lista, que por eso se
   * escribe en las fichas de más barato a más caro: el motivo tiene que señalar
   * el camino más corto, igual que `Saberes.faltaPara()`. Los otros van en
   * `alternativas` para que el aviso pueda nombrarlos.
   */
  herramientaQueFalta(obj) {
    const pedidas = [].concat(obj.pideHerramienta || []);
    if (!pedidas.length) return null;
    if (pedidas.some(id => this.equipo?.tiene(id) && !this.equipo.gastado(id))) return null;
    const ficha = id => this.equipo?.definicion?.(id)
      || (this.datos.objetos || []).find(o => o.id === id)
      || { id, nombre: nombreDe(id) };
    const falta = ficha(pedidas[0]);
    return pedidas.length > 1
      ? { ...falta, alternativas: pedidas.slice(1).map(ficha) }
      : falta;
  }

  /**
   * Estado de un objeto: si se puede hacer, y si no, exactamente por qué.
   *
   * Distinguir «te falta juntar» de «todavía no sabés» de «no tenés con qué» de
   * «no estás en el lugar» es la diferencia entre una meta y una pared invisible.
   * Es el mismo criterio que `Saberes.estado()` y no es casualidad: el jugador ya
   * lo aprendió ahí.
   */
  estado(obj) {
    if (obj.tecnologia && !this.saberes?.desbloqueadas.has(obj.tecnologia)) {
      const tec = this.saberes?.porId.get(obj.tecnologia);
      return {
        estado: 'falta_saber', tecnologia: tec,
        motivo: `Hay que aprender «${tec?.nombre || obj.tecnologia}» en el códice.`,
      };
    }

    const falta = [];
    for (const m of obj.materiales || []) {
      const hay = this.inventario.disponiblePara(m.recurso);
      if (hay < m.cantidad) falta.push({ recurso: m.recurso, pide: m.cantidad, hay });
    }
    if (falta.length) return { estado: 'faltan_materiales', falta };

    // Antes que la estación: sin huso no hay nada que ir a buscar a ningún lado,
    // y el motivo tiene que nombrar lo que falta de verdad. Va después de los
    // materiales por el mismo orden de siempre: primero lo que se junta.
    const herramienta = this.herramientaQueFalta(obj);
    if (herramienta) {
      // Con una sola opción el motivo es el de siempre. Con varias tiene que
      // nombrarlas a todas, o el jugador que ya tiene el cuchillo iría a
      // fabricarse una lasca que no le hace falta.
      const otras = (herramienta.alternativas || []).map(h => h.nombre);
      return {
        estado: 'falta_herramienta', herramienta: herramienta.id,
        motivo: otras.length
          ? `Hace falta tener encima alguna de éstas: ${[herramienta.nombre, ...otras].join(', ')}.`
          : `Hace falta tener encima: ${herramienta.nombre}.`,
      };
    }

    const est = this.estacion(obj);
    if (!est.ok) return { estado: 'falta_estacion', motivo: est.motivo };

    // Sin lugar donde ponerla no está lista, y hay que decirlo ACÁ y no recién
    // al apretar: `estado()` es lo que decide si el botón dice «Hacer» o «No», y
    // un botón que se ofrece y después se niega es la clase de acción que el
    // juego promete sin poder cumplir. `fabricar()` lo vuelve a comprobar antes
    // de consumir nada, porque entre que se dibuja el panel y se aprieta el
    // botón el bolso puede haberse llenado.
    if (!obj.produce && this.equipo?.hayLugarPara && !this.equipo.hayLugarPara(obj.id)) {
      return {
        estado: 'no_entra',
        motivo: 'No tenés dónde ponerla: soltá algo o guardá lo que llevás puesto.',
      };
    }

    return { estado: 'lista' };
  }

  /** Lo que el jugador ya sabe hacer, esté o no en condiciones de hacerlo ahora. */
  disponibles() {
    return this.catalogo.filter(o =>
      !o.tecnologia || this.saberes?.desbloqueadas.has(o.tecnologia));
  }

  /**
   * Fabrica. Devuelve qué pasó, para que quien avise tenga con qué.
   *
   * Un objeto con `produce` entrega recursos al bolso; uno sin `produce` es una
   * herramienta y va al equipo. Es la única diferencia entre una receta y una
   * herramienta en todo el sistema.
   */
  fabricar(obj) {
    const e = this.estado(obj);
    if (e.estado !== 'lista') return e;

    // El peso se comprueba ANTES de consumir: quedarse sin materiales y sin
    // objeto porque no entraba en el bolso sería robarle al jugador. Se mira el
    // neto, porque casi toda receta suelta más de lo que entrega —cuatro fibras
    // pesan más que el cordel que sale de ellas— y esas nunca deberían fallar.
    if (obj.produce) {
      const gana = obj.produce.reduce((s, p) => s + p.cantidad * pesoDe(p.recurso), 0);
      const suelta = (obj.materiales || []).reduce((s, m) => s + m.cantidad * pesoDe(m.recurso), 0);
      const libre = this.inventario.capacidadKg - this.inventario.pesoKg;
      if (gana - suelta > libre) {
        return { estado: 'no_entra', motivo: 'No te entra en el bolso: soltá algo primero.' };
      }
    } else if (this.equipo?.hayLugarPara && !this.equipo.hayLugarPara(obj.id)) {
      // La misma comprobación, del otro lado del mostrador. Desde que las
      // herramientas son instancias con casillero propio, fabricar la segunda
      // hacha puede no tener dónde ir; antes el taller era un `Map` por id y no
      // había forma de que fallara —a costa de que la segunda hacha no
      // existiera—. Se mira ANTES de consumir: quedarse sin materiales y sin
      // objeto es robarle al jugador.
      return {
        estado: 'no_entra',
        motivo: 'No te queda ni casillero libre ni la ranura donde se lleva: soltá algo primero.',
      };
    }

    for (const m of obj.materiales || []) {
      this.inventario.consumirPara(m.recurso, m.cantidad);
    }

    const salida = [];
    if (obj.produce) {
      for (const p of obj.produce) {
        const n = this.inventario.agregar(p.recurso, p.cantidad);
        salida.push({ recurso: p.recurso, cantidad: n });
      }
    } else if (!this.equipo.guardar(obj.id)) {
      // No debería pasar: `hayLugarPara` lo dijo hace tres líneas y en el medio
      // sólo se consumieron materiales, que liberan casilleros y nunca los
      // ocupan. Si igual pasa, se dice; un `guardar()` cuyo false nadie mira es
      // exactamente el agujero por donde el objeto se perdía en silencio.
      return { estado: 'no_entra', motivo: `${obj.nombre} salió pero no hubo dónde ponerla.` };
    }

    this.alCambiar?.();
    return { estado: 'hecho', objeto: obj, salida };
  }
}
