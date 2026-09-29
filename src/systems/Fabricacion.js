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
 * cocerlos. Para esas se reusa `Fundicion.cercano()`, que ya sabe dónde están los
 * hornos y ya registra el aserradero como uno más.
 *
 * El telar es la tercera excepción, y es de otra clase: no pide fuego, pide un
 * lugar armado. El poncho se teje en un witral en pie, y el witral es una obra de
 * campamento que `Construccion` anota como estación en `Fundicion`.
 *
 * Las tres se preguntan igual desde la ronda 8, fase 7, y eso es lo que cambió:
 * **entre todas las estaciones que están a mano, ¿hay alguna que sirva?**, y no
 * «¿la más cercana es la que hace falta?». Ver `estacion()`.
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
// El radio de «estar al lado» es uno solo y vive donde se mide, que es
// `Fundicion.cercano()`. Hasta la ronda 8 estaba copiado acá como
// `RADIO_ESTACION_M = 8` porque allá no se exportaba: dos números iguales en dos
// archivos son un número que algún día va a ser dos.
import { RADIO_HORNO_M } from './Fundicion.js';

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

  /**
   * ¿La estación que pide este objeto está a mano y en condiciones?
   *
   * **La pregunta es «¿hay alguna que sirva?», no «¿sirve la más cercana?»**, y
   * ésa es toda la diferencia. `Fundicion.cercano()` sin filtro devuelve **un
   * solo** horno —el más próximo— y recién después se miraba si era el que hacía
   * falta, así que la estación correcta quedaba escondida detrás de cualquier
   * otra cosa que estuviera medio metro más cerca. Un campamento es justamente
   * eso: la fogata, la fragua y el telar en cinco metros.
   *
   * La ronda 7 ya lo había arreglado para el telar, con `_estacionDeObra()`, y
   * dejó a la fogata y a la fragua con el defecto. Medido antes de esta fase:
   * con la fogata a 2 m y la fragua a 6, una receta de fragua decía «hace falta
   * estar al lado de: Fragua» teniéndola al lado; y al revés, con el telar a 1 m
   * y ninguna fogata, una receta de fuego se daba por lista —el telar no quema,
   * y `arde()` dice que sí a todo lo que no quema—, o sea que se cocía brea sin
   * fuego. Una fogata apagada a un metro también escondía a la prendida a cinco.
   *
   * Ahora las tres preguntan igual, con el filtro de `cercano()`, que recorre
   * todos los hornos y no sólo el primero.
   */
  estacion(obj) {
    const donde = obj.donde || 'bolso';
    if (donde === 'bolso') return { ok: true };
    const f = this.fundicion;
    if (!f) return { ok: false, motivo: `Hace falta estar al lado de: ${nombreDe(donde)}.` };

    // `'fogata'` no nombra a la fogata: nombra al fuego. Sirve cualquier horno
    // que queme y esté ardiendo —la fogata, la fragua, el horno de barro—, y por
    // eso pide las dos condiciones: `usaFuego()` para que el telar y el
    // aserradero no cuenten, y `arde()` para que una apagada tampoco.
    if (donde === 'fogata') {
      if (f.cercano(RADIO_HORNO_M, h => f.usaFuego(h) && f.arde(h))) return { ok: true };
      return { ok: false, motivo: 'Hace falta un fuego encendido al lado: esto hay que cocerlo.' };
    }
    // Todo lo demás nombra una estación por su id: la fragua, el horno de barro,
    // el telar. Da igual si es un horno de `mineria.json` o una obra levantada:
    // las dos llegan a `Fundicion.hornos` y se buscan igual.
    return this._estacionDeObra(donde);
  }

  /**
   * ¿Hay una estación de este id a mano, en pie y en condiciones?
   *
   * «En condiciones» es lo mismo que pide el taller: lo que no quema está
   * siempre listo —el telar, el aserradero— y lo que quema tiene que estar
   * prendido. `arde()` ya contesta las dos cosas.
   */
  _estacionDeObra(id) {
    const f = this.fundicion;
    if (f.cercano(RADIO_HORNO_M, h => h.def?.id === id && f.arde(h))) return { ok: true };

    // El nombre sale de una estación levantada, si hay alguna en el mapa —aunque
    // esté lejos: para nombrarla no hace falta tenerla al lado—, y si no del
    // catálogo de hornos o del id. `Fabricacion` no conoce el catálogo de obras.
    const enElMapa = (f.hornos || []).find(h => h.def?.id === id);
    const nombre = enElMapa?.def?.nombre
      || f.definicionesHorno?.find(d => d.id === id)?.nombre
      || nombreDe(id);

    // Tenerla apagada y no tenerla piden cosas distintas: una se prende, la otra
    // se levanta. Decir «hace falta estar al lado» parado justo al lado manda al
    // jugador a caminar en vez de a cargar leña. Y se dice «sin prender» y no
    // «apagada» porque el nombre puede ser de cualquier género —la fragua, el
    // horno de barro— y el motivo se arma con él.
    if (f.cercano(RADIO_HORNO_M, h => h.def?.id === id)) {
      return { ok: false, motivo: `Falta el fuego: ${nombre.toLowerCase()} está sin prender.` };
    }
    return {
      ok: false,
      motivo: `Esto se hace al lado de: ${nombre}. Tiene que estar en pie y a menos de ${RADIO_HORNO_M} m.`,
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
   * La que se usa DE VERDAD: la primera de `pideHerramienta` que el jugador
   * tiene sana, o `null` si la receta no pide ninguna. Es el mismo criterio que
   * `herramientaQueFalta()` de arriba usa para decidir si falta — acá se usa
   * para saber CUÁL desgastar en `fabricar()`, y no una fija ni todas las
   * alternativas.
   */
  _herramientaUsada(obj) {
    const pedidas = [].concat(obj.pideHerramienta || []);
    return pedidas.find(id => this.equipo?.tiene(id) && !this.equipo.gastado(id)) || null;
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

    // La que se va a gastar, si la receta pide una: se busca ACÁ, antes de tocar
    // nada, porque es la misma que `estado()` ya confirmó que está sana.
    const herramientaUsada = this._herramientaUsada(obj);

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

    // Se gasta recién acá, con todo lo demás ya en firme: fabricar no es una
    // acción que pueda fallar a mitad de camino con la herramienta ya gastada y
    // nada que mostrar por eso.
    if (herramientaUsada) this.equipo?.desgastarId?.(herramientaUsada);

    this.alCambiar?.();
    return { estado: 'hecho', objeto: obj, salida };
  }
}
