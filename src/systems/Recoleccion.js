/**
 * Recolección — el verbo con el que el jugador interactúa con el mundo.
 *
 * Una sola tecla resuelve todo lo que hay a mano, en orden de prioridad:
 * identificar al animal cercano, beber si está en el agua, cosechar la planta o
 * el elemento del sotobosque que tenga delante.
 *
 * Nada se tala ni se mata. Es un parque nacional: se juntan ramas caídas,
 * fibra, corteza suelta y frutos, y la planta queda en pie con un descanso
 * antes de poder volver a darle. La restricción no es de diseño, es la regla
 * real del lugar, y de paso enseña por qué existe.
 */

import { cosechaDe, COSECHA_SOTOBOSQUE, nombreDe, RECURSOS } from './Recursos.js';

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

export class Recoleccion {
  constructor({ mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud }) {
    Object.assign(this, { mundo, jugador, vegetacion, sotobosque, fauna, inventario, saberes, codice, hud });
    /** @type {Map<string, number>} clave de posición -> instante en que se cosechó */
    this.descansando = new Map();
  }

  _clave(x, z) { return `${Math.round(x * 4)}:${Math.round(z * 4)}`; }

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
      return { tipo: 'carronia', etiqueta: 'Aprovechar los restos', resto };
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

    // El tronco caído se atiende antes que la planta, y no es un capricho de
    // orden: es la única fuente de leña del bosque —la madera dura del coihue
    // sirve para «madera» y para «tronco», pero NO para «leña»— y hay uno cada
    // 1939 m² contra una planta cada pocos metros. La planta sigue ahí cuando
    // uno vuelva; el tronco es el que hay que levantar mientras se lo pisa.
    if (mata && mata.vale >= 4) {
      return { tipo: 'sotobosque', etiqueta: `Juntar ${mata.tipo.nombre.toLowerCase()}`, mata };
    }

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
    if (this.mineria?.chatarraAMano(p.x, p.z, ahora)) {
      return { tipo: 'chatarra', etiqueta: 'Levantar chatarra (o R)', tecla: 'R' };
    }

    const planta = this.vegetacion.masCercana(p, 7);
    if (planta && !this._enDescanso(planta.x, planta.z, ahora)) {
      return { tipo: 'planta', etiqueta: `Recolectar ${planta.esp.nombreComun.toLowerCase()}`, planta };
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
        return { tipo: 'cantera', etiqueta: `Abrir ${v.yacimiento.nombre.toLowerCase()} (o R)`, tecla: 'R' };
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
    if (mata && mata.vale > 0) {
      return { tipo: 'sotobosque', etiqueta: `Juntar ${mata.tipo.nombre.toLowerCase()}`, mata };
    }

    // Y recién ahora el relleno: coirón y pastizal, que dan fibra y están en
    // todos lados.
    if (mata) {
      return { tipo: 'sotobosque', etiqueta: `Juntar ${mata.tipo.nombre.toLowerCase()}`, mata };
    }

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
   */
  _beber() {
    const hay = this.pesca?.loQueHayCerca();
    const sinPermiso = hay && !this.pesca?.tienePermiso;
    return {
      tipo: 'beber',
      etiqueta: hay
        ? (sinPermiso ? 'Beber agua · P para pescar (hace falta permiso)' : 'Beber agua · P para tirar la línea')
        : 'Beber agua',
    };
  }

  _aguaCerca() {
    const p = this.jugador.posicion;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) {
      if (this.mundo.esAgua(p.x + dx, p.z + dz)) return true;
    }
    return this.mundo.cauceEn(p.x, p.z) > 0.25;
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
        this.inventario.agregar('agua', 1);
        this.hud.aviso('Bebiste agua', `Hidratación ${antes.toFixed(0)} → ${this.jugador.sed.toFixed(0)}`);
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
        this.caza?.aprovechar({ fuenteId: 'presa_puma' });
        return;
      }

      case 'sotobosque': {
        const cosecha = [...(COSECHA_SOTOBOSQUE[acc.mata.tipo.id] || [])];
        this.descansando.set(this._clave(acc.mata.x, acc.mata.z), ahora);

        // Extras según dónde está la piedra. No es azar decorativo: la
        // obsidiana es vidrio volcánico y aparece en altura, y la arcilla se
        // deposita en las orillas.
        if (acc.mata.tipo.id === 'piedra') {
          if (acc.mata.y > 1500 && Math.random() < 0.28) {
            cosecha.push({ recurso: 'obsidiana', cantidad: 1 });
          }
          // `_orillaCerca()`, no `_aguaCerca()`: ver el comentario de esa
          // función. Con `_aguaCerca()` esta línea era inalcanzable por orden de
          // ramas y la arcilla no existía en el juego.
          if (this._orillaCerca() && Math.random() < 0.45) {
            cosecha.push({ recurso: 'arcilla', cantidad: 2 });
          }
        }

        const obtenido = [];
        for (const c of cosecha) {
          const n = this.inventario.agregar(c.recurso, c.cantidad);
          if (n > 0) obtenido.push(`${n} × ${nombreDe(c.recurso)}`);
        }
        this.hud.aviso(acc.mata.tipo.nombre,
          obtenido.length ? obtenido.join(' · ') : `No entra nada más (${this.inventario.pesoKg.toFixed(1)} kg)`);
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
