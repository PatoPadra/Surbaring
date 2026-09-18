/**
 * Recolección — el verbo con el que el jugador interactúa con el mundo.
 *
 * Una sola tecla resuelve todo lo que hay a mano, en orden de prioridad:
 * identificar al animal cercano, beber si está en el agua, sacar de la orilla la
 * arcilla y la arena, cosechar la planta o el elemento del sotobosque que tenga
 * delante.
 *
 * Nada se tala ni se mata. Es un parque nacional: se juntan ramas caídas,
 * fibra, corteza suelta y frutos, y la planta queda en pie con un descanso
 * antes de poder volver a darle. La restricción no es de diseño, es la regla
 * real del lugar, y de paso enseña por qué existe.
 */

import { cosechaDe, cosechaPosibleDe, COSECHA_SOTOBOSQUE, nombreDe, RECURSOS } from './Recursos.js';

const DESCANSO_S = 150;   // segundos de juego antes de volver a cosechar lo mismo

/**
 * Cuánto vale levantar cada cosa del suelo, y por qué esto no es un detalle.
 *
 * `sotobosque.masCercano()` devuelve la instancia más próxima de cualquier tipo,
 * que suena a lo razonable y rompía el juego entero. Medido en el punto de
 * partida —alt 822 m, humedad 0,51— hay **un coirón cada 1 m²** y **un tronco
 * caído cada 1939 m²**. Parado sobre el único tronco a la vista, con su centro a
 * 1,7 m, la probabilidad de que haya un coirón más cerca es del **100,00 %**, y
 * la de que no haya nada de relleno en los 5 m es 5 × 10⁻⁴¹. O sea: la tecla de
 * recolección daba 2 de fibra en vez de 4 de leña **siempre**.
 *
 * Sin leña no hay fogata, sin fogata no hay calor ni comida cocida, y el aviso
 * de frío de `main.js` terminaba diciéndole al jugador «juntá de los troncos
 * caídos», que era exactamente lo único que no podía hacer. Es el mismo defecto
 * que el `if (!h.trabajo)` del fuego: el sistema estaba entero y bien escrito, y
 * no existía para el jugador porque el gesto que lo activa apuntaba a otra cosa.
 *
 * Lo mismo tapaba la carroña —un resto cada 5120 m²—, que es una de las dos vías
 * legales al cuero y por lo tanto a la fragua.
 *
 * Así que no gana el más cerca: gana el que más vale, y entre iguales, el más
 * cerca. El pasto está en todos lados y se junta cuando uno quiera; el tronco
 * caído hay que aprovecharlo cuando aparece.
 */
const VALE = { tronco: 4, piedra: 3, michay: 2, helecho: 1, coiron: 0, pasto_humedo: 0 };

/**
 * Qué mata del sotobosque se trabaja con qué verbo del árbol de herramientas.
 *
 * Sólo el tronco caído por ahora, y es el que importa: el recurso `tronco` no lo
 * entregaba nada en todo el juego, y de él cuelgan la cabaña, la canoa y —vía
 * aserradero— la tabla y el poste. A mano se le sacan las ramas; con hacha se
 * troza el fuste. La misma mata, dos rindes.
 */
const ACCION_POR_MATA = { tronco: 'trozar' };

/** Sobre esta cota la piedra suelta puede ser obsidiana. */
const ALTURA_OBSIDIANA_M = 1500;

/**
 * Lo que una mata da a veces, con qué probabilidad y dónde.
 *
 * Estos números vivían escritos en línea adentro de `actuar()`, y ahí no los
 * podía leer nadie más. Ahora los lee también el cartel de la tecla, y ése es
 * el motivo: decir «a veces arcilla» en la piedra de la orilla es lo único que
 * le cuenta al jugador que la arcilla sale de ahí, y decirlo lejos del agua
 * sería mentirle. `donde` es la condición de lugar; lo que no la trae sale en
 * cualquier lado. El sorteo sigue siendo uno por renglón y en este orden, igual
 * que antes.
 */
const EXTRAS_MATA = {
  piedra: [
    // No es azar decorativo: la obsidiana es vidrio volcánico y aparece en
    // altura.
    { recurso: 'obsidiana', cantidad: 1, probabilidad: 0.28, donde: (mata) => mata.y > ALTURA_OBSIDIANA_M },
    // Y la arcilla se deposita en las orillas. `_orillaCerca()`, no
    // `_aguaCerca()`: ver el comentario de esa función. Con `_aguaCerca()` este
    // renglón era inalcanzable por orden de ramas y la arcilla no existía en el
    // juego.
    { recurso: 'arcilla', cantidad: 2, probabilidad: 0.45, donde: (mata, rec) => rec._orillaCerca() },
  ],
  // Las dos fuentes que el árbol daba por sentadas y no entregaba nadie.
  // Ninguna de las dos pide matar, que es la condición del lugar.
  //
  // La lana del coirón es una LICENCIA, declarada en `herramientas.json` como
  // `lanaDelCoiron`. Este comentario decía, como hecho y sin fuente, que el
  // guanaco muda en primavera y deja el vellón prendido en las matas. No hay
  // quién lo sostenga, y sí de dónde salía el pelo que se hilaba en la región:
  // del cuero, y hoy de la esquila (ver la licencia). Además, alrededor del
  // arranque no hay guanacos: la fauna viva es de bosque.
  //
  // El 2/3 sale de un criterio: juntar lana no puede meter en el bolso más peso
  // de otra cosa que el de la propia lana. La mata trae siempre 2 fibras —100 g,
  // en `COSECHA_SOTOBOSQUE`— y una lana pesa 150 g, así que va una lana cada
  // apretada y media. Con el 16 % de antes entraban 667 g de paja por cada lana:
  // medido en el juego el 13/9/2026 en 61 puntos, la lana de la cadena del
  // poncho eran 84 apretadas y 8,4 kg de fibra, en un bolso de 38.
  //
  // Queda «a veces» en todas las matas, y no fijada por mata como la carroña.
  // Así cada coirón sigue prometiendo lo que da, y cada apretada que promete
  // lana es una apretada que el jugador paga de verdad: lo que se mide es lo que
  // cuesta. `licencia` es lo que hace que la primera lana lo diga (ver el caso
  // `sotobosque` de `actuar()`).
  coiron: [{ recurso: 'lana', cantidad: 1, probabilidad: 2 / 3, licencia: 'lanaDelCoiron' }],
  // Las plumas se juntan del pastizal húmedo, que es donde hay aves. Sin ellas
  // no hay flechas: un astil sin emplumar cabecea y no va a ningún lado.
  pasto_humedo: [{ recurso: 'pluma', cantidad: 2, probabilidad: 0.22 }],
};

/**
 * El paréntesis del cartel: lo que la tecla pone en el bolso.
 *
 * El rinde tiene tres formas y el cartel las distingue para no mentir: lo fijo
 * con su número («2 × piedra»), lo que sale en cantidad al azar con su rango
 * («2–4 × frutos») y lo que sale o no sale con «a veces», sin número, porque
 * prometer «2 × arcilla» en una piedra que la da al 45 % sería prometer de más.
 *
 * Lo que se repite se suma: el maqui da 3 frutos fijos y 2 a 4 al azar, y
 * «5–7 × frutos» se lee mejor que dos renglones del mismo fruto. Los dos
 * extremos de la suma se alcanzan, porque lo fijo no depende del sorteo.
 *
 * Recibe renglones de la forma en que ya los devuelven los sistemas —
 * `{recurso, cantidad}` o `{recurso, min, max}`— y `{recurso, aVeces: true}`.
 * Sin nada que dar, no hay paréntesis: un «()» se leería como un cartel roto.
 */
function parentesisDeRinde(renglones) {
  const fijos = new Map();
  const aVeces = [];
  for (const r of renglones) {
    if (r.aVeces) { if (!aVeces.includes(r.recurso)) aVeces.push(r.recurso); continue; }
    const min = r.min ?? r.cantidad, max = r.max ?? r.cantidad;
    if (!(max > 0)) continue;
    const suma = fijos.get(r.recurso);
    if (suma) { suma.min += min; suma.max += max; } else fijos.set(r.recurso, { min, max });
  }
  const nombre = (id) => nombreDe(id).toLowerCase();
  const partes = [
    ...[...fijos].map(([id, { min, max }]) => `${min === max ? min : `${min}–${max}`} × ${nombre(id)}`),
    ...aVeces.map(id => `a veces ${nombre(id)}`),
  ];
  return partes.length ? ` (${partes.join(' · ')})` : '';
}

/**
 * Un tramo de orilla del que ya se sacó descansa, y el tramo es de doce metros.
 *
 * No es una canilla, igual que la chatarra y el frente de cantera, que en
 * `Mineria` descansan 900 s: apretar la tecla sin moverse no puede llenar el
 * bolso de barro. Pero el tramo no es la grilla de 25 cm de las matas —eso sería
 * dar un paso y volver a sacar— ni el frente de 24 m de la cantera, que mide
 * volumen: es lo que se alcanza con la mano desde donde uno está parado, y doce
 * metros es el mismo radio con el que se decide la orilla. A mano limpia, las
 * diez de arcilla del horno de barro son unos ciento veinte metros de barranca
 * caminados; con pala, dos tramos. Ése es el lugar de la herramienta en el árbol,
 * y está bien que se sienta.
 */
const TRAMO_ORILLA_M = 12;
const DESCANSO_ORILLA_S = 900;

/**
 * ¿Hay agua a mano para beber? Siete muestras a tres metros, o un cauce fuerte.
 *
 * Es el cuerpo de `_aguaCerca()` sacado afuera, y no por prolijidad: la barranca
 * se define con esta función, y el mapa que marca barrancas tiene que preguntar
 * exactamente lo mismo.
 */
export function aguaAMano(mundo, x, z) {
  for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) {
    if (mundo.esAgua(x + dx, z + dz)) return true;
  }
  return mundo.cauceEn(x, z) > 0.25;
}

/**
 * La barranca: la orilla, sin el agua a mano.
 *
 * Es la misma banda donde la piedra da «a veces arcilla», dicha como lugar y no
 * como condición de una mata. Doce metros de orilla porque la arcilla se deposita
 * en la planicie de inundación y en el corte de la barranca, no en la línea del
 * agua (ver `_orillaCerca()`); y fuera del alcance de beber porque ahí, con sed,
 * la tecla es del agua.
 *
 * Exportada porque es UNA regla: `Hallazgos` marca «Barranca de arcilla» con esta
 * misma función. Si el mapa dice «acá hay», la tecla la da.
 */
export function barrancaEn(mundo, x, z) {
  return mundo.orillaCerca(x, z) && !aguaAMano(mundo, x, z);
}

/**
 * La playa donde se junta un puñado de arena: el banco de arena de `Mineria`, en
 * tierra y fuera del Parque Nacional.
 *
 * El banco lo decide `Mineria.yacimientoEn()`, no esta función, que le agrega
 * sólo lo que el puñado necesita: pisar tierra y no estar en el Parque. Esa línea
 * es la licencia `arenaDePlaya` de `herramientas.json`, que se toma en la Reserva
 * y fuera del área protegida y no cruza al Parque ni por un puñado. Sin límites
 * cableados no se da: ante la duda no se ofrece lo que puede ser una infracción.
 *
 * Exportada por lo mismo que `barrancaEn()`: el mapa marca «Banco de arena» con
 * esta función.
 */
export function playaEn(mundo, mineria, x, z) {
  if (!mineria || mundo.esAgua(x, z)) return false;
  if (mineria.yacimientoEn(x, z)?.id !== 'arena') return false;
  const j = mineria.limites?.jurisdiccion?.(x, z);
  return !!j && j !== 'parque';
}

export class Recoleccion {
  constructor({ mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud }) {
    Object.assign(this, { mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud });
    /** @type {Map<string, number>} clave de posición -> instante en que se cosechó */
    this.descansando = new Map();
    /**
     * Los tramos de orilla sacados, aparte de `descansando` porque la grilla y el
     * plazo son otros. La clave lleva el lugar —barranca o playa— porque dentro
     * de un mismo tramo los dos predicados pueden no coincidir, y sacar arcilla
     * donde no había playa no puede dejar descansando una playa que nadie tocó.
     * @type {Map<string, number>}
     */
    this.orillaTomada = new Map();
  }

  _clave(x, z) { return `${Math.round(x * 4)}:${Math.round(z * 4)}`; }

  /** La ficha de una acción del árbol de herramientas, si el dataset está cableado. */
  _accion(id) {
    return this.herramientas?.acciones?.find(a => a.id === id) || null;
  }

  /**
   * Qué rinde una mata, según lo que haya en la mano.
   *
   * Acá es donde el árbol de herramientas deja de ser un archivo y pasa a ser
   * juego: `COSECHA_SOTOBOSQUE` era una constante y ahora es una pregunta. El
   * mismo tronco caído da cuatro de leña a mano limpia y dos rollizos con el
   * hacha, y el jugador ve la diferencia sin que nadie se la explique.
   *
   * Si el dataset no está cableado se devuelve la constante de siempre, así el
   * juego sigue andando igual que antes de esta ronda.
   */
  _rinde(tipoId) {
    const base = COSECHA_SOTOBOSQUE[tipoId] || [];
    const accionId = ACCION_POR_MATA[tipoId];
    const acc = accionId && this._accion(accionId);
    if (!acc) return base;
    const rama = this.equipo?.puede(accionId) ? acc.conHerramienta : acc.sinHerramienta;
    return Array.isArray(rama?.rinde) ? rama.rinde : base;
  }

  /**
   * Cómo se llama lo que haría la tecla sobre esta mata.
   *
   * Es la mitad barata de «que se note qué hace cada herramienta»: el indicador
   * ya existía y ya se dibujaba, sólo que decía siempre lo mismo.
   */
  _etiquetaMata(mata, rinde = this._rindeMata(mata)) {
    const dice = parentesisDeRinde([
      ...rinde.fijo,
      ...rinde.aVeces.map(e => ({ recurso: e.recurso, aVeces: true })),
    ]);
    const accionId = ACCION_POR_MATA[mata.tipo.id];
    if (accionId && this._accion(accionId)) {
      const acc = this._accion(accionId);
      if (this.equipo?.puede(accionId)) {
        return `${acc.nombre} · ${this.equipo.enRanura('mano')?.nombre.toLowerCase()}${dice}`;
      }
      return `Juntar ramas del ${mata.tipo.nombre.toLowerCase()}${dice}`;
    }
    return `Juntar ${mata.tipo.nombre.toLowerCase()}${dice}`;
  }

  /**
   * Todo lo que puede dar esta mata acá: lo fijo según la mano, y lo que sale a
   * veces según el lugar. Se arma UNA vez, en `quePuedoHacer()`, y viaja en la
   * acción: el cartel lo escribe y `actuar()` sortea sobre el mismo objeto, así
   * que no hay forma de que prometan cosas distintas.
   */
  _rindeMata(mata) {
    const id = mata.tipo.id;
    return {
      fijo: this._rinde(id),
      aVeces: (EXTRAS_MATA[id] || []).filter(e => !e.donde || e.donde(mata, this)),
    };
  }

  /** La acción de sotobosque completa, con su rinde adentro. */
  _accionMata(mata) {
    const rinde = this._rindeMata(mata);
    return { tipo: 'sotobosque', etiqueta: this._etiquetaMata(mata, rinde), mata, rinde };
  }

  /**
   * Un número de 0 a 1 fijo para cada lugar, con la misma grilla de 25 cm que el
   * descanso.
   *
   * Sirve para que un resto sea siempre la misma clase de resto. `Caza` sorteaba
   * la fuente al apretar la tecla, y con eso el cartel tenía dos salidas malas:
   * sortear también cada medio segundo, y parpadear entre «cuero» y «asta», o
   * nombrar la unión de las cuatro fuentes con cinco «a veces», que es verdad y
   * no dice nada. Fijada por lugar dice exactamente lo que va a dar, y además es
   * lo que pasa en el monte: una presa de puma no se vuelve un desmogue porque
   * uno la deje descansar dos minutos y medio. Las posiciones de los restos las
   * siembra `Sotobosque` con semilla fija por celda, así que el mismo resto cae
   * siempre en el mismo número, y la proporción entre fuentes sobre todo el mapa
   * sigue siendo la del dataset.
   */
  _azarDelLugar(x, z) {
    const h = Math.sin(Math.round(x * 4) * 12.9898 + Math.round(z * 4) * 78.233) * 43758.5453;
    return h - Math.floor(h);
  }

  /**
   * Gasta un uso de lo que está en la mano y avisa UNA vez cuando se rompe.
   *
   * El aviso importa: una herramienta que deja de funcionar en silencio se lee
   * como un juego roto. Que se rompa y lo diga se lee como que hay que reparar.
   */
  _gastarHerramienta() {
    if (!this.equipo?.desgastar()) return;
    const def = this.equipo.enRanura('mano');
    this.hud?.aviso(`Se te gastó ${def?.nombre.toLowerCase() || 'la herramienta'}`,
      `Reparala en el bolso con ${this.equipo.costoReparar(def.id)
        .map(m => `${m.cantidad} × ${nombreDe(m.recurso)}`).join(' · ')}`);
  }

  _enDescanso(x, z, ahora) {
    const t = this.descansando.get(this._clave(x, z));
    return t != null && ahora - t < DESCANSO_S;
  }

  /**
   * Lo que hay a mano en el suelo: la mejor mata para juntar y la carroña más
   * cercana, en un solo barrido.
   *
   * Se leen las matrices de instancia crudas en vez de llamar dos veces a
   * `masCercano()`. No es microoptimización: eran dos barridos de 13.700
   * instancias dos veces por segundo, y así queda uno solo y sin construir un
   * objeto por candidato. El descanso se consulta sólo para el que va ganando,
   * que son unas pocas consultas por lote y no una por instancia.
   */
  _delSuelo(p, ahora, radio = 5) {
    let mata = null, mataV = -1, mataD = radio;
    let carronia = null, carroniaD = radio;
    for (const lote of this.sotobosque?.lotes || []) {
      const id = lote.tipo.id;
      const esCarronia = id === 'carronia';
      if (!esCarronia && !COSECHA_SOTOBOSQUE[id]) continue;
      const v = VALE[id] ?? 0;
      const a = lote.malla.instanceMatrix.array;
      for (let i = 0; i < lote.n; i++) {
        const o = i * 16;
        const x = a[o + 12], z = a[o + 14];
        const dx = x - p.x, dz = z - p.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d >= radio) continue;
        if (esCarronia) {
          if (d >= carroniaD || this._enDescanso(x, z, ahora)) continue;
          carroniaD = d;
          carronia = { tipo: lote.tipo, x, y: a[o + 13], z, distancia: d };
        } else if (v > mataV || (v === mataV && d < mataD)) {
          if (this._enDescanso(x, z, ahora)) continue;
          mataV = v; mataD = d;
          mata = { tipo: lote.tipo, x, y: a[o + 13], z, distancia: d, vale: v };
        }
      }
    }
    return { mata, carronia };
  }

  /** Devuelve qué haría la tecla de acción ahora mismo, para el indicador. */
  quePuedoHacer(ahora) {
    const p = this.jugador.posicion;

    // Sólo el animal sin identificar se queda con la tecla. Con 52 animales
    // vivos en el mapa, darle prioridad absoluta a cualquiera de ellos hacía
    // que una liebre parada al lado del agua impidiera beber, y la sed mata.
    // Al que ya está en el códice se lo mira más abajo, cuando no hay nada
    // mejor que hacer con la tecla.
    const animal = this.fauna.masCercano(p, 22);
    if (animal && !this.codice?.identificadas.has(animal.esp.id)) {
      return { tipo: 'identificar', etiqueta: `Identificar ${animal.esp.nombreComun.toLowerCase()}`, animal };
    }

    // Un solo barrido del suelo para las dos cosas que se sacan de él
    const { mata, carronia: resto } = this._delSuelo(p, ahora);
    if (resto) {
      const conFilo = !!this.equipo?.puede('descuerar');
      // La fuente se fija por lugar y viaja en la acción hasta `aprovechar()`:
      // ver `_azarDelLugar()`.
      const fuente = this.caza?.fuenteDe({ azar: this._azarDelLugar(resto.x, resto.z) }) || null;
      const dice = fuente ? parentesisDeRinde(this.caza.rindeDeRestos(fuente, !conFilo)) : '';
      return {
        tipo: 'carronia', resto, fuente,
        etiqueta: (conFilo ? 'Aprovechar los restos' : 'Juntar los huesos · sin filo no sale más') + dice,
      };
    }

    // El permiso de pesca sólo se saca donde se saca, así que cuando el jugador
    // pasa por la intendencia conviene que se entere.
    if (this.pesca && !this.pesca.tienePermiso
        && this.pesca.enIntendencia(p.x, p.z)) {
      return { tipo: 'permiso', etiqueta: 'Sacar el permiso de pesca en la intendencia' };
    }

    // El agua se queda con la tecla mientras la sed apriete, y sólo mientras
    // apriete. Con la hidratación llena, «Beber agua» es una acción que el
    // jugador puede hacer y que no hace nada, y encima le sacaba la tecla al
    // tronco que estaba pisando: la orilla del lago es justo donde se junta la
    // leña varada. Con sed, sigue primero — la sed mata.
    const aguaAMano = this.jugador.enAgua || this._aguaCerca();
    if (aguaAMano && this.jugador.sed < 92) return this._beber();

    // La trampa propia, a menos de 2,5 m: revisarla si cayó algo, levantarla si
    // está vacía. Va debajo de la sed —la sed mata, y una nasa se cala justo al
    // lado del agua— y arriba de todo lo que se junta caminando, por la vara de
    // siempre: la planta y la piedra están en cualquier lado; la trampa es una
    // sola y el jugador vino hasta acá a buscarla. El cartel lo arma `Trampas`,
    // que es quien sabe qué hay adentro.
    const trampa = this.trampas?.cerca(p.x, p.z);
    if (trampa) return { tipo: 'trampa', trampa, etiqueta: this.trampas.etiqueta(trampa) };

    // La orilla: la arcilla de la barranca y la arena de la playa, en un gesto.
    //
    // Va acá, arriba del tronco, de la chatarra y de la planta, por la vara de
    // siempre y medida con los mismos números con que la usa este archivo: no
    // cuánto vale, sino cuál se puede hacer en otro lado. La banda de la barranca
    // es el 2,5 % de la tierra a menos de 3 km del arranque (`r7-arcilla.mjs`,
    // sobre el DEM). Un tronco a cinco metros, con uno cada 1939 m², está en el
    // 1 − e^(−78,5/1939) = 4,0 % de las posiciones; la chatarra, en el 13 % de las
    // celdas; una planta a siete metros, en casi todas. El banco de arena, en el
    // 0,4 % de las celdas de 128 m del parque (`Hallazgos.js`). Lo único más escaso
    // que la orilla ya está arriba: la carroña, a cinco metros en el 1,5 %; el
    // permiso, en un solo edificio; el animal sin identificar, que se identifica
    // una vez. Beber con sed no compite: la barranca es justo donde el agua no
    // está a mano.
    //
    // Medido en el juego el 13/9, antes de este gesto, la arcilla salía sólo al
    // 45 % de levantar una piedra y la tecla la prometía, como «a veces», en el 30 %
    // de la banda: la planta se llevaba el 19 %, la chatarra el 11 % y el tronco el
    // 9 %. Por eso el dueño no la encontraba.
    //
    // Lo que cuesta subirla es poco, y está pensado: la orilla descansa, así que
    // la apretada siguiente ya es del tronco o de la planta; y la chatarra se
    // sigue levantando con R, aunque el cartel la nombre recién cuando la orilla
    // descansa.
    //
    // Barranca y playa van en el mismo gesto y no una después de la otra porque
    // se tocan casi siempre —153 de 240 puntos de la banda son playa— y en fila
    // habría que decidir cuál primero: por la vara ganaría la playa, y el primer
    // cartel de dos de cada tres orillas prometería arena y callaría la arcilla.
    // Juntas, la tecla dice lo que la orilla tiene ahí, y cada parte descansa sola.
    const orilla = this._accionOrilla(p, ahora);
    if (orilla) return orilla;

    // El tronco caído se atiende antes que la planta, y no es un capricho de
    // orden: es la única fuente de leña del bosque —la madera dura del coihue
    // sirve para «madera» y para «tronco», pero NO para «leña»— y hay uno cada
    // 1939 m² contra una planta cada pocos metros. La planta sigue ahí cuando
    // uno vuelva; el tronco es el que hay que levantar mientras se lo pisa.
    if (mata && mata.vale >= 4) return this._accionMata(mata);

    // El material del suelo va ANTES de todo lo que se junta caminando, y ésa
    // es toda la diferencia.
    //
    // Estaba al final de la cadena, después de la mata, así que no aparecía
    // nunca: con un coirón cada metro cuadrado, `mata` no era null jamás. La
    // rama entera —la chatarra, que es el único hierro de esta comarca, y la
    // cantera— era código muerto para el jugador, y con ella la mitad del árbol
    // de tecnologías.
    //
    // Bajarla un escalón, por encima del pasto pero por debajo del michay y la
    // piedra, tampoco alcanzaba: medido, en los 5 m de alcance hay 2,6 michays,
    // 2,6 helechos y 1,2 piedras, así que la chatarra seguía sin salir el
    // 99,8 % de las veces. Lo que decide no es cuánto vale cada cosa sino cuál
    // se puede juntar en otro lado: el michay y la piedra están en todas
    // partes y esperan; la chatarra está en el 13 % de las celdas y sólo donde
    // hubo gente, así que el momento de decirlo es cuando uno la pisa.
    //
    // La tecla de acción también la levanta. `R` sigue funcionando y sigue
    // explicando la ley cuando no se puede: la negativa no se toca, sólo deja de
    // depender de que el jugador adivine que la tecla existe.
    // Ojo: acá va SÓLO la chatarra, no el árido. Los dos salían por la misma
    // rama y son casos opuestos, y ésa era la mitad del defecto que el dueño
    // trajo con captura.
    //
    // La chatarra se queda arriba y con razón: está en el 13 % de las celdas de
    // 40 m y sólo donde hubo gente, es el único hierro de esta comarca —el
    // Batolito Norpatagónico no tiene mineralización explotable— y, sobre todo,
    // `recuperarChatarra()` **no** consulta `evaluar()` ni pide herramienta: si
    // el aviso aparece, la tecla funciona. Medido: se ofrece en el 12,5 % de las
    // posiciones. Eso es un hallazgo, y el momento de decirlo es cuando uno lo
    // pisa.
    //
    // El árido es exactamente lo contrario y se fue abajo. Ver la rama `cantera`
    // más abajo.
    // `chatarraAMano()` y no `hayChatarra()`: la segunda contesta por la
    // geografía y sigue diciendo que sí con la veta agotada y adentro de un
    // sitio patrimonial. Ver el comentario de ese método en `Mineria.js`.
    //
    // La «(o R)» ya no va adentro de la etiqueta: el paréntesis es del rinde, y
    // la R la marca `HUD.mostrarAccion()` al final, leyendo `tecla`.
    if (this.mineria?.chatarraAMano(p.x, p.z, ahora)) {
      return {
        tipo: 'chatarra', tecla: 'R',
        etiqueta: `Levantar chatarra${parentesisDeRinde(this.mineria.rindeChatarra())}`,
      };
    }

    const planta = this.vegetacion.masCercana(p, 7);
    if (planta && !this._enDescanso(planta.x, planta.z, ahora)) {
      return {
        tipo: 'planta', planta,
        etiqueta: `Recolectar ${planta.esp.nombreComun.toLowerCase()}${parentesisDeRinde(cosechaPosibleDe(planta.esp))}`,
      };
    }

    // El árido, y sólo cuando de verdad se puede sacar.
    //
    // Éste es el defecto de la captura, con sus números. `yacimientoEn()`
    // devolvía algo en el **70,9 %** de las posiciones alrededor del punto de
    // partida, y esta rama estaba por encima de la planta, así que se comía el
    // **56,9 %** de la tecla de acción y tapaba el resto del juego. Y lo peor no
    // era la frecuencia: el punto de partida está en **reserva**, donde
    // `evaluar()` niega **siempre**, así que de esas 70,9 % de posiciones eran
    // extraíbles el **0,0 %**. Se le estaba ofreciendo al jugador, casi todo el
    // tiempo, una tecla que no podía funcionar nunca.
    //
    // Dos cosas cambian. Primero, se consulta `evaluar()` antes de ofrecer: no
    // se anuncia nada que la jurisdicción vaya a negar. La ley no se suaviza ni
    // se esconde —sigue entera en `evaluar()` y sale por `hud.negativa()`— pero
    // se enseña cuando el jugador aprieta `R` a propósito, que es donde ya
    // estaba escrita y funciona bien.
    //
    // Segundo, baja debajo de la planta, por la misma vara con la que subió la
    // chatarra: lo que decide no es cuánto vale sino cuál se puede juntar en
    // otro lado. Donde el árido es legal —jurisdicción provincial— hay yacimiento
    // en el 83,5 % de las posiciones. Algo que está en cuatro de cada cinco pasos
    // no necesita que se lo anuncien: espera.
    if (this.mineria) {
      const v = this.mineria.evaluar(p.x, p.z, ahora);
      if (v.permitido) {
        // El rinde del frente ya viene en el veredicto, y es el mismo arreglo
        // que `extraer()` pone en el bolso.
        return {
          tipo: 'cantera', tecla: 'R',
          etiqueta: `Abrir ${v.yacimiento.nombre.toLowerCase()}${parentesisDeRinde(v.yacimiento.rinde)}`,
        };
      }
    }

    // El agua sin sed: acá, y no más abajo. Con la sed llena beber no suma
    // hidratación, pero **sí llena la cantimplora**: `agregar('agua', 1)` existe
    // en un solo lugar de todo `src/`, que es el caso `beber` de `actuar()`, y
    // el agua la piden seis recetas —el agua hervida, la infusión de canelo, el
    // lavado de michay y el emplasto de maqui, o sea la botica entera—. Y la
    // cadena «P para tirar la línea» también sale de un solo lugar, que es
    // `_beber()`: es la única forma que tiene el jugador de descubrir la pesca.
    //
    // Esto había quedado debajo de las dos ramas de `mata`, y la segunda retorna
    // sin condición. Con un coirón por metro cuadrado, la probabilidad de llegar
    // hasta acá era e^−78,5 ≈ 8×10⁻³⁵: código muerto. Era exactamente el defecto
    // que este mismo archivo acababa de arreglar en la arcilla, reintroducido
    // por el arreglo de la cantera —al bajar el árido debajo de la planta, el
    // agua se fue con él—.
    //
    // Va acá arriba y no más arriba todavía porque la vara es la de siempre: no
    // cuánto vale, sino cuál se puede hacer en otro lado. El tronco, la
    // chatarra, la planta y el frente de cantera son hallazgos o están atados a
    // un lugar, así que le ganan al agua. La piedra, el michay, el helecho y el
    // coirón están en todas partes y esperan: el agua les gana. Y con sed, el
    // agua sigue ganándole a todo desde la rama de arriba, porque la sed mata.
    if (aguaAMano) return this._beber();

    // Lo que vale, después de la planta: piedra, michay, helecho
    if (mata && mata.vale > 0) return this._accionMata(mata);

    // Y recién ahora el relleno: coirón y pastizal, que dan fibra y están en
    // todos lados.
    if (mata) return this._accionMata(mata);

    // El animal ya conocido: volver a mirarlo muestra la ficha otra vez, que es
    // informativo, pero no da puntos ni le saca la tecla a nada.
    //
    // Y es acá donde se nombra la `H`, que era una de las teclas que el juego
    // tenía y no decía en ninguna parte. El momento es éste y no el de
    // identificar: identificar es lo que hay que hacer la primera vez y no
    // conviene ensuciarlo. Esta rama, en cambio, salta justo cuando el jugador
    // está al lado de un animal que ya conoce y no tiene nada mejor que hacer,
    // que es cuando se aprende una tecla. Lo que pase después es contenido: la
    // fauna nativa no se caza nunca, y `Caza.evaluar()` lo explica entero.
    if (animal) {
      return {
        tipo: 'ficha',
        etiqueta: `Repasar ${animal.esp.nombreComun.toLowerCase()} · H para evaluar la caza`,
        animal,
      };
    }

    if (planta) return { tipo: 'espera', etiqueta: `${planta.esp.nombreComun}: dale un descanso` };

    return null;
  }

  /**
   * El aviso del agua, que se arma en dos lugares de la cadena —arriba con sed,
   * abajo sin ella— y por eso vive acá y no repetido.
   *
   * Si además hay un cardumen a mano se dice, porque pescar tiene tecla propia y
   * nadie la descubre solo: el momento de nombrar la `P` es cuando sirve.
   *
   * La medida que uno se lleva se promete sólo si entra de verdad, con la misma
   * cuenta que hace `agregar`: sin recipiente, con los recipientes llenos o con
   * el bolso al tope, el cartel dice «Beber agua» y nada más. Beber hidrata
   * igual en los tres casos; lo que no se promete es llevarse agua.
   */
  _beber() {
    const hay = this.pesca?.loQueHayCerca();
    const sinPermiso = hay && !this.pesca?.tienePermiso;
    const medida = this.inventario?.entra?.('agua', 1) > 0
      ? parentesisDeRinde([{ recurso: 'agua', cantidad: 1 }]) : '';
    return {
      tipo: 'beber',
      etiqueta: `Beber agua${medida}`
        + (hay ? (sinPermiso ? ' · P para pescar (hace falta permiso)' : ' · P para tirar la línea') : ''),
    };
  }

  _aguaCerca() {
    const p = this.jugador.posicion;
    return aguaAMano(this.mundo, p.x, p.z);
  }

  /** La ficha de la licencia de la arena, si el dataset está cableado. */
  _licenciaArena() {
    return this.herramientas?.licenciasDeJuego?.licencias?.find(l => l.id === 'arenaDePlaya') || null;
  }

  _claveTramo(lugar, x, z) {
    return `${lugar}:${Math.round(x / TRAMO_ORILLA_M)}:${Math.round(z / TRAMO_ORILLA_M)}`;
  }

  _tramoDescansa(lugar, x, z, ahora) {
    const t = this.orillaTomada.get(this._claveTramo(lugar, x, z));
    return t != null && ahora - t < DESCANSO_ORILLA_S;
  }

  /**
   * Lo que da la orilla parada acá: la barranca, la playa, las dos, o nada.
   *
   * El rinde viaja en la acción, igual que el de las matas, y ningún número vive
   * en este archivo. La barranca rinde lo que diga `extraer_arcilla`: la rama con
   * herramienta si la mano tiene algo que la habilite, la de a mano si no. La
   * playa rinde lo que diga la licencia `arenaDePlaya`, que es la que declara
   * cuánto se toma: si mañana el puñado cambia, cambia ahí y en ningún otro lado.
   */
  _accionOrilla(p, ahora) {
    const partes = [];

    const extraer = this._accion('extraer_arcilla');
    if (extraer && barrancaEn(this.mundo, p.x, p.z) && !this._tramoDescansa('barranca', p.x, p.z, ahora)) {
      const conHerramienta = !!this.equipo?.puede('extraer_arcilla');
      const rinde = (conHerramienta ? extraer.conHerramienta : extraer.sinHerramienta)?.rinde;
      if (Array.isArray(rinde) && rinde.length) partes.push({ lugar: 'barranca', rinde, conHerramienta });
    }

    const licencia = this._licenciaArena();
    if (Array.isArray(licencia?.rinde) && playaEn(this.mundo, this.mineria, p.x, p.z)
        && !this._tramoDescansa('playa', p.x, p.z, ahora)) {
      partes.push({
        lugar: 'playa', rinde: licencia.rinde, licencia,
        jurisdiccion: this.mineria.limites.jurisdiccion(p.x, p.z),
      });
    }
    if (!partes.length) return null;

    const barranca = partes.find(q => q.lugar === 'barranca');
    const verbo = !barranca ? 'Juntar arena de la playa'
      : partes.length > 1 ? 'Sacar arcilla de la barranca y arena de la playa'
        : 'Sacar arcilla de la barranca';
    const mano = barranca?.conHerramienta ? ` · ${this.equipo.enRanura('mano')?.nombre.toLowerCase()}` : '';
    return {
      tipo: 'orilla', x: p.x, z: p.z, partes,
      etiqueta: `${verbo}${mano}${parentesisDeRinde(partes.flatMap(q => q.rinde))}`,
    };
  }

  /**
   * ¿Estamos en la orilla? Doce metros, no tres.
   *
   * Ojo que esto NO es `_aguaCerca()` con otro número, y la diferencia era un
   * defecto de los que no se ven. La arcilla salía de levantar una piedra
   * preguntando `_aguaCerca()`, la misma función que usa la rama de beber, que
   * está más arriba en la cadena y hace `return`. O sea que llegar a la piedra
   * implicaba que `_aguaCerca()` había dado falso, y la condición de la arcilla
   * se evaluaba sobre la misma función, la misma posición y el mismo tick:
   * **probabilidad exactamente cero**. No era poco probable, era imposible, y
   * por eso el dueño nunca vio arcilla. Con ella no hay carbonera ni fragua, o
   * sea que se cortaba la cadena entera del metal.
   *
   * Doce metros además es lo correcto y no un parche: la arcilla se deposita en
   * la planicie de inundación y en la barranca, no en la línea del agua. Es el
   * mismo radio con el que `Mineria.yacimientoEn()` decide un banco de arena.
   */
  _orillaCerca() {
    const p = this.jugador.posicion;
    return this.mundo.orillaCerca(p.x, p.z);
  }

  /**
   * La tecla que faltaba: `G`.
   *
   * De los cuatro sistemas con gesto propio, el taller era el único sin ninguna
   * forma de descubrirse. Y no es un panel más: `grep` sobre todo `src/` dice
   * que `construccion.levantar()`, `guardarTodo()` y `retirar()` los llama
   * **únicamente** `src/ui/Taller.js`, o sea que sin `G` el jugador no
   * construye, no guarda, no retira y —lo que importa— **no prende fuego**.
   * Sin fuego no hay comida cocida, ni agua hervida, ni calor, ni carbón, ni
   * nada de la cadena del metal.
   *
   * La bienvenida se redujo a dos teclas a propósito, y está bien: seis teclas
   * de un tirón no las retiene nadie. Pero entonces el resto tiene que
   * enseñarse en el momento en que sirve, que es la regla que el propio
   * `main.js` se escribió. El momento de nombrar `G` es exactamente éste: el
   * paso en que el bolso completa la primera fogata. Una sola vez, y nunca más.
   */
  _avisarTaller() {
    if (this._talleraAvisado || !this.fundicion) return;
    // Si ya levantó algo, es que encontró el taller solo: no hace falta.
    if (this.fundicion.hornos?.length) { this._talleraAvisado = true; return; }
    const fogata = this.fundicion.hornoPorId?.('fogata');
    if (!fogata || this.fundicion.faltaPara(fogata).length) return;
    this._talleraAvisado = true;
    const q = (fogata.materiales || [])
      .map(m => `${m.cantidad} × ${nombreDe(m.recurso).toLowerCase()}`).join(' y ');
    this.hud.aviso('Ya te alcanza para una fogata',
      `Tenés ${q}. Con G se abre el taller, y ahí se levanta y se prende. Sin fuego no hay comida cocida ni agua hervida ni con qué pasar la noche.`, 9000);
  }

  /** Ejecuta la acción disponible. */
  actuar(ahora) {
    const acc = this.quePuedoHacer(ahora);
    if (!acc) {
      this.hud.aviso('Nada a mano', 'Acercate a un animal, una planta o el agua');
      return;
    }
    // Se agenda con retraso, no en el mismo tick.
    //
    // `HUD.aviso()` es **una sola ranura**: sobreescribe el texto y reinicia el
    // reloj. Con `setTimeout(…, 0)` el aviso del taller pisaba al de la propia
    // acción —«4 × Leña»— antes de que se leyera un solo carácter. Los 4,5 s le
    // dan a cada uno su turno, y quedan escalonados con el del códice, que sale
    // a los 1,5 s: acción → códice → taller, en vez de los tres encimados.
    setTimeout(() => this._avisarTaller(), 4500);

    switch (acc.tipo) {
      case 'identificar': {
        // Los puntos son por conocer, no por apretar: sólo la primera vez.
        const esp = acc.animal.esp;
        const nueva = !this.codice.identificadas.has(esp.id);
        this.codice.registrarFauna(esp, true);
        if (nueva) this._puntosPorEspecie(esp);
        return;
      }

      case 'ficha': {
        const esp = acc.animal.esp;
        const det = [esp.nombreCientifico, esp.datoCurioso || esp.descripcionEducativa || '']
          .filter(Boolean).join(' · ');
        this.hud.aviso(`${esp.nombreComun}, ya identificado`,
          det || 'Ya está en el códice: la ficha completa está en Tab.');
        return;
      }

      case 'beber': {
        const antes = this.jugador.sed;
        this.jugador.sed = Math.min(100, this.jugador.sed + 32);
        // Beber siempre funciona: la hidratación es del cuerpo y no del bolso.
        // Lo que puede no entrar es la medida que uno se lleva, y ése era el
        // único de los doce lugares que agregan algo que tiraba el sobrante sin
        // mirar. Con el bolso al tope decía «bebiste» y además mentía por
        // omisión: uno creía que se llevaba agua y no se llevaba nada.
        const llevo = this.inventario.agregar('agua', 1);
        // Y desde la ronda 7 hay tres razones para no llevársela, y cada una
        // pide hacer algo distinto: sin recipiente hay que fabricar uno, con los
        // recipientes llenos hay que tomar o soltar agua, y con el bolso al tope
        // de peso o de casilleros hay que soltar otra cosa. Decir «no entra» a
        // secas en los tres casos mandaría a vaciar el bolso al que no tiene odre.
        const liq = this.inventario.liquido;
        let medida = 'te llevaste una medida';
        if (!(llevo > 0)) {
          if (liq && liq.cabe === 0) medida = 'no tenés en qué llevarte una medida: el agua viaja en un recipiente';
          else if (liq && liq.lleva >= liq.cabe) medida = `los recipientes van llenos, ${liq.lleva} de ${liq.cabe} medidas`;
          else medida = 'no entra más en el bolso';
        }
        this.hud.aviso('Bebiste agua',
          `Hidratación ${antes.toFixed(0)} → ${this.jugador.sed.toFixed(0)} · ${medida}`);
        return;
      }

      case 'planta': {
        const esp = acc.planta.esp;
        const cosecha = cosechaDe(esp);
        this.descansando.set(this._clave(acc.planta.x, acc.planta.z), ahora);

        // Recolectar también es conocer: la planta entra al códice
        const nueva = !this.codice.identificadas.has(esp.id);
        this.codice.registrarFlora(esp);
        if (nueva) this._puntosPorEspecie(esp);

        if (!cosecha.length) {
          this.hud.aviso(esp.nombreComun, 'No da materiales aprovechables');
          return;
        }
        const obtenido = [];
        for (const c of cosecha) {
          const n = this.inventario.agregar(c.recurso, c.cantidad);
          if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
        }
        if (!obtenido.length) this.hud.aviso('No entra nada más', `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
        else if (!nueva) this.hud.aviso(esp.nombreComun, obtenido.join(' · '));
        return;
      }

      case 'carronia': {
        this.descansando.set(this._clave(acc.resto.x, acc.resto.z), ahora);
        const conFilo = this.equipo?.puede('descuerar');
        // La misma fuente que nombró el cartel, y no una sorteada ahora.
        this.caza?.aprovechar({ fuente: acc.fuente, soloHueso: !conFilo });
        if (conFilo) this._gastarHerramienta();
        return;
      }

      case 'sotobosque': {
        // El rinde viene armado en la acción, el mismo objeto que escribió el
        // cartel: lo fijo según la mano, y lo de a veces ya filtrado por lugar.
        // Se lee antes de gastar la herramienta, como siempre: si el hacha se
        // rompe en este golpe, este golpe todavía es de hacha.
        const { fijo, aVeces } = acc.rinde;
        const cosecha = [...fijo];
        const accionMata = ACCION_POR_MATA[acc.mata.tipo.id];
        if (accionMata && this.equipo?.puede(accionMata)) this._gastarHerramienta();
        this.descansando.set(this._clave(acc.mata.x, acc.mata.z), ahora);

        // Acá sólo se sortea. Los números y las condiciones de lugar viven en
        // `EXTRAS_MATA`, con el porqué de cada uno.
        for (const e of aVeces) {
          if (Math.random() < e.probabilidad) cosecha.push({ recurso: e.recurso, cantidad: e.cantidad, licencia: e.licencia });
        }

        const obtenido = [];
        let licencia = null;
        for (const c of cosecha) {
          const n = this.inventario.agregar(c.recurso, c.cantidad);
          if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
          if (n > 0 && c.licencia) licencia ??= c.licencia;
        }
        let dice = obtenido.length ? obtenido.join(' · ') : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`;

        // La primera vez que entra al bolso algo que es licencia —la lana del
        // coirón—, el aviso lo dice en el mismo renglón y no en uno aparte, por lo
        // mismo que el primer puñado de arena: `HUD.aviso()` es una sola ranura, y
        // un aviso diferido lo pisaría el siguiente. El texto vive en la licencia.
        // Sin el dataset cableado no se dice nada, porque no hay de dónde leerlo.
        if (licencia && !this._licenciasDichas?.has(licencia)) {
          const texto = this.herramientas?.licenciasDeJuego?.licencias?.find(l => l.id === licencia)?.aviso;
          if (typeof texto === 'string') {
            (this._licenciasDichas ??= new Set()).add(licencia);
            dice += ` · ${texto}`;
          }
        }
        this.hud.aviso(acc.mata.tipo.nombre, dice);
        return;
      }

      case 'orilla': {
        // Las partes vienen armadas en la acción: se da lo que prometió el
        // cartel, y cada parte deja descansando su tramo.
        const obtenido = [];
        for (const parte of acc.partes) {
          this.orillaTomada.set(this._claveTramo(parte.lugar, acc.x, acc.z), ahora);
          for (const c of parte.rinde) {
            const n = this.inventario.agregar(c.recurso, c.cantidad);
            if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
          }
        }
        const dice = obtenido.length
          ? obtenido.join(' · ') : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`;
        const titulo = acc.partes.length > 1 ? 'Barranca y playa'
          : acc.partes[0].lugar === 'playa' ? 'Playa' : 'Barranca';

        // El primer puñado de arena dice que es una licencia, y lo dice en el
        // mismo aviso, no en uno aparte: `HUD.aviso()` es una sola ranura, y un
        // aviso diferido lo pisaría el del códice o el del taller. El texto vive
        // en la licencia, con la norma del lugar donde se juntó.
        const playa = acc.partes.find(q => q.lugar === 'playa');
        if (playa && !this._licenciaArenaDicha) {
          this._licenciaArenaDicha = true;
          const aviso = playa.licencia.aviso;
          const texto = typeof aviso === 'string' ? aviso : aviso?.[playa.jurisdiccion];
          this.hud.aviso(`${titulo} · ${dice}`, texto || playa.licencia.que, 14000);
        } else {
          this.hud.aviso(titulo, dice);
        }
        // Después del aviso y no antes, a diferencia de las matas: si la pala se
        // rompe en esta palada, el aviso de que se rompió es el que tiene que
        // quedar a la vista.
        if (acc.partes.some(q => q.conHerramienta)) this._gastarHerramienta();
        return;
      }

      case 'trampa': {
        // Con algo adentro se revisa; vacía se levanta y vuelve al bolso. Los
        // avisos los da `Trampas`: la norma, el rinde o por qué no se pudo.
        const t = acc.trampa;
        if (t.presas?.length) this.trampas.revisar(t);
        else this.trampas.levantar(t);
        return;
      }

      case 'permiso':
        this.pesca?.sacarPermiso();
        return;

      case 'chatarra':
        this.mineria?.recuperarChatarra(ahora);
        return;

      case 'cantera':
        this.mineria?.extraer(ahora);
        return;

      default:
        this.hud.aviso(acc.etiqueta, 'Volvé más tarde');
    }
  }

  _puntosPorEspecie(esp) {
    let p = 2;
    if (['CR', 'EN', 'VU'].includes(esp.estadoConservacion)) p += 4;
    this.saberes.otorgar(p, `${esp.nombreComun} identificado`);

    // La primera vez que el jugador gana puntos, decirle para qué sirven.
    //
    // El aviso de `saberes.alCambiar` dice «+2 puntos de saber · total 2» y no
    // dice dónde se gastan. `Tab` abre el códice, que es donde vive el árbol de
    // tecnologías entero, y era otra tecla que el juego tenía y no nombraba en
    // ninguna parte. Éste es el momento: el punto recién ganado es lo que le da
    // sentido a la frase. Se difiere para no pisar el aviso de los puntos, y se
    // hace una sola vez.
    if (!this._saberAvisado) {
      this._saberAvisado = true;
      setTimeout(() => this.hud.aviso('Eso que aprendiste vale',
        'Con Tab se abre el códice: ahí están las fichas de todo lo que reconociste y el árbol de saberes donde se gastan los puntos. Lo aprendido no se pierde ni cuando te morís.', 9000), 1500);
    }
  }

  /** Comer lo mejor que haya en el bolso. */
  comer() {
    const opciones = this.inventario.comestibles();

    // Primero la herida. Un cuerpo con la salud por el piso y el estómago lleno
    // no necesita otra fruta: necesita el emplasto que viene juntando desde que
    // aprendió a reconocer el maqui. Los remedios no son comida —el emplasto se
    // ata sobre la herida— así que no salen por `comestibles()`.
    const remedios = this.inventario.listar()
      .filter(i => (RECURSOS[i.id]?.cura || 0) > 0)
      .sort((a, b) => (RECURSOS[b.id].cura || 0) - (RECURSOS[a.id].cura || 0));
    if (remedios.length && this.jugador.salud < 65) {
      const r = remedios[0];
      const d = RECURSOS[r.id];
      this.inventario.quitar(r.id, 1);
      this.jugador.salud = Math.min(100, this.jugador.salud + (d.cura || 0));
      if (d.hidrata) this.jugador.sed = Math.min(100, this.jugador.sed + d.hidrata);
      if (d.nutre) this.jugador.hambre = Math.min(100, this.jugador.hambre + d.nutre);
      this.hud.aviso(`Te curaste con ${r.nombre.toLowerCase()}`,
        `Salud ${this.jugador.salud.toFixed(0)} · lo aprendiste identificando la planta, y eso no se pierde`);
      return;
    }

    // Q atiende lo que más falta. Antes sólo miraba el alimento, así que el
    // agua cargada en el bolso —la hervida, sobre todo, que cuesta leña y una
    // hornada— no se podía tomar con ninguna tecla: había que volver a la
    // orilla igual. Si la sed aprieta más que el hambre y hay algo que hidrate,
    // se bebe eso.
    const bebidas = this.inventario.listar()
      .filter(i => (RECURSOS[i.id]?.hidrata || 0) >= 20)
      .sort((a, b) => (RECURSOS[b.id].hidrata || 0) - (RECURSOS[a.id].hidrata || 0));
    if (bebidas.length && this.jugador.sed < this.jugador.hambre && this.jugador.sed < 70) {
      const b = bebidas[0];
      const d = RECURSOS[b.id];
      this.inventario.quitar(b.id, 1);
      this.jugador.sed = Math.min(100, this.jugador.sed + (d.hidrata || 0));
      this.jugador.hambre = Math.min(100, this.jugador.hambre + (d.nutre || 0));
      this.hud.aviso(`Tomaste ${b.nombre.toLowerCase()}`,
        `Hidratación ${this.jugador.sed.toFixed(0)} · Alimento ${this.jugador.hambre.toFixed(0)}`);
      return;
    }

    if (!opciones.length) {
      this.hud.aviso('No tenés comida', 'Recolectá frutos de calafate, maqui o michay');
      return;
    }
    const mejor = opciones.sort((a, b) =>
      (RECURSOS[b.id].nutre || 0) - (RECURSOS[a.id].nutre || 0))[0];
    const def = RECURSOS[mejor.id];
    this.inventario.quitar(mejor.id, 1);
    this.jugador.hambre = Math.min(100, this.jugador.hambre + (def.nutre || 0));
    this.jugador.sed = Math.min(100, this.jugador.sed + (def.hidrata || 0));
    this.hud.aviso(`Comiste ${mejor.nombre.toLowerCase()}`,
      `Alimento ${this.jugador.hambre.toFixed(0)} · Hidratación ${this.jugador.sed.toFixed(0)}`);
  }
}
