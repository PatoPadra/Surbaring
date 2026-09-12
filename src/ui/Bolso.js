/**
 * Bolso — el inventario completo, con tecla propia.
 *
 * El panel del HUD muestra doce renglones y después dice "y N más…", que
 * alcanza para mirar de reojo y no alcanza para decidir. Acá está todo: qué se
 * lleva, cuánto pesa cada cosa y —lo que faltaba de verdad— **cómo soltarla**.
 *
 * Que se pueda tirar no es un lujo: el límite son 38 kg y cargar de más agota
 * antes. Sin una forma de soltar, llenarse de piedra era un callejón sin salida.
 * Lo que se tira queda en el suelo del juego en sentido figurado —no se
 * instancia nada—, así que el aviso lo dice sin disimular.
 *
 * Desde la ronda 6 esto es una grilla y no una lista agrupada. Tres decisiones
 * que se tomaron a propósito y que se notan al usarlo:
 *
 * - **Clic para tomar y clic para poner, no arrastrar.** Arrastrar cuesta el
 *   triple de código —punteros capturados, fantasma que sigue al mouse, soltar
 *   afuera— y da el 80 % de la misma sensación. Y acá "tomar" es marcar el
 *   casillero, no sacar la pila del inventario: mientras se elige dónde
 *   dejarla, el peso, el HUD y las recetas siguen viendo lo mismo de siempre.
 *   Una pila que vive en una variable de la interfaz es una pila que se pierde
 *   el día que alguien cierra el panel con el bolso en la mano.
 * - **Sin iconos.** Son 127 dibujos y son otra fase entera. Mientras tanto, una
 *   sigla de dos o tres letras y un color por categoría, que se lee de un
 *   vistazo y no miente sobre lo que hay.
 * - **El detalle sigue al puntero, y se queda.** Pasar por encima de un
 *   casillero llena el panel de abajo con el nombre, la cantidad, los kilos y
 *   los botones. No se limpia al salir: si se limpiara, no habría forma de
 *   llegar hasta el botón sin que desapareciera en el camino.
 */

import { RECURSOS, pesoDe, nombreDe } from '../systems/Recursos.js';
import { esInstancia } from '../systems/Inventario.js';

const CSS = `
  #bolsoPanel { position: fixed; inset: 0; z-index: 72; display: none;
    background: rgba(8,10,9,.84); backdrop-filter: blur(5px); color: var(--tinta); }
  #bolsoPanel.abierto { display: grid; place-items: center; }
  #bolsoPanel .bp-marco { width: min(560px, 92vw); max-height: 86vh; overflow: auto;
    background: rgba(18,21,19,.97); border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 1.3rem 1.5rem; }
  #bolsoPanel .bp-cab { display: flex; justify-content: space-between; align-items: baseline; }
  #bolsoPanel h2 { font-size: 1rem; font-weight: 500; letter-spacing: .04em; }
  #bolsoPanel .bp-peso { font-size: .78rem; font-variant-numeric: tabular-nums; }
  #bolsoPanel .bp-barra { height: 3px; background: rgba(255,255,255,.09);
    border-radius: 2px; margin: .5rem 0 1rem; }
  #bolsoPanel .bp-barra i { display: block; height: 100%; border-radius: 2px;
    background: #7f9f74; transition: width .2s ease; }
  #bolsoPanel .bp-barra.lleno i { background: #c8503f; }
  #bolsoPanel h3 { font-size: .62rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: 1rem 0 .3rem; }
  #bolsoPanel .bp-it { display: flex; align-items: center; gap: .7rem; padding: .38rem 0;
    border-top: 1px solid rgba(255,255,255,.06); font-size: .78rem; }
  #bolsoPanel .bp-it > span:first-child { flex: 1; }
  #bolsoPanel .bp-n { font-variant-numeric: tabular-nums; min-width: 2.4rem; text-align: right; }
  #bolsoPanel .bp-kg { color: var(--tinta-tenue); font-size: .7rem;
    min-width: 3.6rem; text-align: right; font-variant-numeric: tabular-nums; }
  #bolsoPanel button { background: rgba(255,255,255,.06); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
    padding: .18rem .55rem; font: inherit; font-size: .68rem; cursor: pointer; }
  #bolsoPanel button:hover { background: rgba(255,255,255,.14); }
  #bolsoPanel .bp-vacio { font-size: .76rem; color: #6d766f; font-style: italic; padding: 1rem 0; }
  #bolsoPanel footer { margin-top: 1rem; font-size: .68rem; color: var(--tinta-tenue); }

  /* La grilla. Seis columnas porque las filas del inventario vienen de a seis
     desde casillasPara(): si acá fueran cinco, la última fila quedaría coja. */
  #bolsoPanel .bp-grilla { display: grid; grid-template-columns: repeat(6, 1fr);
    gap: 4px; margin: .45rem 0 .2rem; }
  #bolsoPanel .bp-cs { position: relative; aspect-ratio: 1 / 1; padding: 0;
    display: grid; place-items: center; border-radius: 3px; cursor: default;
    background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.07);
    color: var(--tinta-tenue); font-size: .72rem; letter-spacing: .03em; }
  #bolsoPanel .bp-cs.hay { cursor: pointer; font-weight: 600; }
  #bolsoPanel .bp-cs.hay:hover { border-color: rgba(255,255,255,.34); }
  /* Lo tomado se levanta y queda marcado en ámbar, el mismo color con el que el
     equipo dice «encendida»: es el único estado de la interfaz que espera algo. */
  #bolsoPanel .bp-cs.tomada { border-color: #e0a050; box-shadow: 0 0 0 1px #e0a050 inset;
    transform: translateY(-2px); }
  #bolsoPanel .bp-cs i { position: absolute; right: 3px; bottom: 1px; font-style: normal;
    font-size: .62rem; font-variant-numeric: tabular-nums; color: var(--tinta);
    text-shadow: 0 1px 2px rgba(0,0,0,.8); }
  /* La franja de abajo dice qué tan llena está la pila. Es el único lugar donde
     el tope de pila se ve sin pasar el puntero. */
  #bolsoPanel .bp-cs u { position: absolute; left: 0; bottom: 0; height: 2px;
    background: currentColor; opacity: .55; }
  #bolsoPanel .bp-detalle { min-height: 2.6rem; margin: .5rem 0 .2rem;
    border-top: 1px solid rgba(255,255,255,.06); padding-top: .45rem; }
  #bolsoPanel .bp-ayuda { font-size: .68rem; color: var(--tinta-tenue); }

  /* Una instancia no es una pila, y tiene que verse antes de leer la sigla: la
     esquina cortada dice «esto es una cosa» y la franja de abajo deja de contar
     cuánto entra para contar cuánto le queda de vida. Sin esto, un hacha al 10 %
     y una pila de diez frutos se dibujaban igual. */
  #bolsoPanel .bp-cs.obj { border-style: solid; }
  #bolsoPanel .bp-cs.obj::before { content: ''; position: absolute; left: 0; top: 0;
    border: 5px solid transparent; border-left-color: currentColor;
    border-top-color: currentColor; opacity: .8; }
  #bolsoPanel .bp-cs.obj u { height: 3px; opacity: 1; }
  #bolsoPanel .bp-cs.rota { opacity: .55; text-decoration: line-through; }

  /* Las cuatro ranuras, siempre las cuatro y siempre en el mismo orden: la
     vacía informa tanto como la llena —«no tenés abrigo» es la respuesta a por
     qué te estás congelando— y una lista que aparece y desaparece según lo que
     haya no se aprende de memoria. */
  #bolsoPanel .bp-rn { display: flex; align-items: center; gap: .55rem;
    padding: .3rem 0; border-top: 1px solid rgba(255,255,255,.06); font-size: .78rem; }
  #bolsoPanel .bp-rn > .rot { min-width: 4.2rem; font-size: .62rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--tinta-tenue); }
  #bolsoPanel .bp-rn > .que { flex: 1; }
  #bolsoPanel .bp-rn.vacia > .que { color: #6d766f; font-style: italic; }
  #bolsoPanel .bp-dur { display: inline-block; width: 3.2rem; height: 3px; vertical-align: middle;
    background: rgba(255,255,255,.12); border-radius: 2px; overflow: hidden; }
  #bolsoPanel .bp-dur i { display: block; height: 100%; }
`;

/**
 * Un color por categoría, que es todo el vocabulario visual que hay hasta que
 * existan los 127 iconos. El verde es el mismo de la barra de peso y el violeta
 * el de la botica: dos categorías que se buscan con hambre y con la salud en
 * rojo, o sea apurado, y el color es lo que se ve antes de leer.
 *
 * `otros` es la red, y está por una razón concreta que ya pasó una vez: el bolso
 * viejo recorría la lista literal `['alimento', 'material']`, así que los dos
 * recursos declarados `cat: 'remedio'` —el emplasto de maqui y el lavado de
 * michay, que son el cierre de la tesis del juego— **no se dibujaban en ninguna
 * pantalla**. El jugador los juntaba, le ocupaban peso, lo curaban al apretar Q,
 * y no había forma de enterarse de que los tenía. La grilla ya no puede
 * esconder nada porque dibuja casilleros y no categorías, pero el color sí
 * podría faltar, y una categoría nueva sin color se ve gris en vez de
 * desaparecer.
 */
const COLOR_CAT = {
  alimento: '#7f9f74',
  remedio: '#a889bd',
  material: '#9d9483',
  otros: '#6d766f',
};

/**
 * Y un color por categoría de objeto, que son otras seis y viven en
 * `herramientas.json`. Se separan de las de recursos a propósito: los dos
 * juegos de casilleros comparten la grilla y tienen que distinguirse, así que
 * las herramientas tiran a frío —piedra, filo, metal— y los materiales a tierra.
 * Igual que arriba, la categoría que falte cae en gris y no desaparece.
 */
const COLOR_OBJ = {
  herramienta: '#7ea8bd',
  arma: '#bd8c7e',
  abrigo: '#b0a2c4',
  contenedor: '#9ebd9e',
  fuego: '#e0a050',
  insumo: '#8f9aa0',
  otros: '#8f9aa0',
};

/** Las cuatro ranuras, con el nombre con el que las piensa el jugador. */
const RANURAS = [
  ['mano', 'Mano'],
  ['arma', 'Arma'],
  ['abrigo', 'Abrigo'],
  ['espalda', 'Espalda'],
];

/**
 * El color de una barra de durabilidad. Verde mientras no importe, ámbar cuando
 * conviene volver al campamento, rojo cuando ya es tarde: son los mismos tres
 * colores de la barra de peso y de la salud, así que no hay vocabulario nuevo
 * que aprender.
 */
function colorUso(frac) {
  if (!(frac > 0)) return '#c8503f';
  if (frac > 0.5) return '#7f9f74';
  if (frac > 0.2) return '#e0a050';
  return '#c8503f';
}

/**
 * La sigla que se dibuja en el casillero: iniciales si el nombre tiene dos
 * palabras con cuerpo, y si no las tres primeras letras.
 *
 * Las palabras de dos letras o menos se descartan —«de», «la»— porque «Yesca de
 * barba de viejo» tiene que dar YB y no YD. Hay colisiones (carne y carbón dan
 * las dos «Car» a secas nunca, pero cerámica y ceniza dan Cer y Cen) y por eso
 * el nombre entero va en el `title` y en el detalle de abajo: la sigla ubica, no
 * identifica.
 */
function sigla(nombre) {
  const palabras = String(nombre || '').split(/\s+/).filter(p => p.length > 2);
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
  const una = palabras[0] || String(nombre || '?');
  return una.slice(0, 3).replace(/^./, c => c.toUpperCase());
}

/** Horas del mundo para leer de un vistazo: «1,5 h», «45 min». */
function horas(h) {
  if (!Number.isFinite(h)) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${(Math.round(h * 10) / 10).toString().replace('.', ',')} h`;
}

export class Bolso {
  /** @param {object} deps {inventario, jugador, hud, recoleccion, equipo, fabricacion, tiempo} */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    /** El casillero que se tomó y todavía no se soltó, o null. Es un índice, no
     *  una pila: lo tomado nunca sale del inventario. */
    this._tomada = null;
    /** El último casillero por el que pasó el puntero: es el que se detalla. */
    this._mirando = null;
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'bolsoPanel';
    el.innerHTML = `<div class="bp-marco">
      <div class="bp-cab"><h2>Bolso</h2><span class="bp-peso" id="bp-peso"></span></div>
      <div class="bp-barra" id="bp-barra"><i></i></div>
      <div id="bp-cuerpo"></div>
      <footer>Cargar más de 25 kg agota antes de tiempo · <b>Q</b> come lo mejor que haya · <b>I</b> cierra</footer>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;

    // Clic derecho parte la pila. Va antes que el clic común porque el menú del
    // navegador arriba de la grilla no sirve para nada y tapa media pantalla.
    el.addEventListener('contextmenu', (ev) => {
      const cs = ev.target.closest('[data-cs]');
      if (!cs) return;
      ev.preventDefault();
      if (this.inventario.partir(+cs.dataset.cs)) this.pintar();
    });

    // `mouseover` y no `mouseenter`: éste burbujea, así que un solo oyente en el
    // panel sirve para los 42 casilleros y sigue sirviendo cuando el bolso crece.
    el.addEventListener('mouseover', (ev) => {
      const cs = ev.target.closest('[data-cs]');
      if (!cs) return;
      const i = +cs.dataset.cs;
      if (i === this._mirando) return;
      this._mirando = i;
      // Sólo el detalle, no la grilla entera: repintar los casilleros en cada
      // movimiento del puntero es lo que vuelve pegajoso un inventario.
      this._refrescarDetalle();
    });

    el.addEventListener('click', (ev) => {
      const cs = ev.target.closest('[data-cs]');
      if (cs) { this._tocarCasillero(+cs.dataset.cs); return; }
      const b = ev.target.closest('button[data-accion]');
      if (!b) return;
      const { accion, id, n } = b.dataset;
      if (accion === 'tirar') {
        const cantidad = n === 'todo' ? this.inventario.cantidad(id) : Math.min(1, this.inventario.cantidad(id));
        if (this.inventario.quitar(id, cantidad)) {
          this.hud?.aviso(`Tiraste ${cantidad} × ${id.replace(/_/g, ' ')}`,
            `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
        }
      } else if (accion === 'comer') {
        const def = RECURSOS[id];
        if (def?.nutre && this.inventario.quitar(id, 1)) {
          this.jugador.hambre = Math.min(100, this.jugador.hambre + (def.nutre || 0));
          this.jugador.sed = Math.min(100, this.jugador.sed + (def.hidrata || 0));
          this.hud?.aviso(`Comiste ${def.nombre.toLowerCase()}`,
            `Alimento ${this.jugador.hambre.toFixed(0)} · Hidratación ${this.jugador.sed.toFixed(0)}`);
        }
      } else if (accion === 'curar') {
        // La misma cuenta que hace `Recoleccion.comer()`, pero cuando lo decide
        // el jugador y no el umbral. Q sólo cura por debajo de 65 de salud, que
        // está bien como reflejo automático y mal como única puerta: uno se
        // venda antes de salir, no cuando ya está tirado.
        const def = RECURSOS[id];
        if (!def?.cura) return;
        // Un emplasto se gasta una sola vez: gastarlo con la salud llena es
        // tirar a la basura la planta que costó identificar.
        if (this.jugador.salud >= 99.5) {
          this.hud?.aviso('Estás entero', `Guardá ${def.nombre.toLowerCase()} para cuando haga falta.`);
          return;
        }
        if (this.inventario.quitar(id, 1)) {
          const antes = this.jugador.salud;
          this.jugador.salud = Math.min(100, antes + def.cura);
          if (def.hidrata) this.jugador.sed = Math.min(100, this.jugador.sed + def.hidrata);
          if (def.nutre) this.jugador.hambre = Math.min(100, this.jugador.hambre + def.nutre);
          this.hud?.aviso(`Te curaste con ${def.nombre.toLowerCase()}`,
            `Salud ${antes.toFixed(0)} → ${this.jugador.salud.toFixed(0)} · lo aprendiste identificando la planta, y eso no se pierde`);
        }
      } else if (accion === 'fabricar') {
        const obj = this.fabricacion?.catalogo.find(o => o.id === id);
        if (obj) {
          const r = this.fabricacion.fabricar(obj);
          if (r.estado === 'hecho') {
            const que = r.salida?.length
              ? r.salida.map(s => `${s.cantidad} × ${nombreDe(s.recurso)}`).join(' · ')
              : 'Lo tenés en la mano';
            this.hud?.aviso(`Hiciste ${obj.nombre.toLowerCase()}`, que);
          } else {
            this.hud?.aviso(obj.nombre, r.motivo || 'Todavía no');
          }
        }
      } else if (accion === 'encender') {
        const def = this.equipo?.definicion(id);
        const r = this.equipo?.encender(id, this._fechaMs());
        if (r?.ok) {
          const e = def?.efecto || {};
          const nombre = id === 'velas_cera' ? nombreDe('vela') : (def?.nombre || id);
          this.hud?.aviso(`${nombre} · alumbra ${e.luz} m`,
            `Dura ${horas(e.duracionHoras)} del reloj del mundo. Se apaga desde el bolso.`);
        } else if (r) {
          this.hud?.aviso(def?.nombre || id, r.motivo || 'No prende');
        }
      } else if (accion === 'apagar') {
        this.equipo?.apagar(this._fechaMs());
      } else if (accion === 'equipar') {
        // Por casillero y no por id: con dos hachas en el bolso, «sacá el
        // hacha» no señala a ninguna en particular y el jugador está apuntando
        // a una concreta.
        const cosa = this.inventario.casillas[+b.dataset.i];
        if (cosa && !this.equipo?.equipar(cosa)) {
          this.hud?.aviso(this.equipo?.definicion(cosa.id)?.nombre || cosa.id,
            'No se pudo sacar.');
        }
      } else if (accion === 'desequipar') {
        const ranura = b.dataset.ranura;
        const puesto = this.equipo?.enRanura(ranura);
        if (puesto && !this.equipo.desequipar(ranura)) {
          // Falla limpio y hay que decirlo: si no, apretar «Guardar» y que no
          // pase nada se lee como que el botón está roto.
          this.hud?.aviso(`${puesto.nombre} se queda en la mano`,
            'No te queda un casillero libre donde guardarla. Soltá algo primero.');
        }
      } else if (accion === 'tirar_obj') {
        const cosa = this.inventario.sacar(+b.dataset.i);
        if (cosa) {
          this.hud?.aviso(`Tiraste ${(this.equipo?.definicion(cosa.id)?.nombre || cosa.id).toLowerCase()}`,
            `Cargás ${this.inventario.pesoKg.toFixed(1)} kg`);
        }
      } else if (accion === 'reparar') {
        // Del casillero o de la ranura, pero siempre una instancia concreta:
        // reparar «el hacha» teniendo dos tendría que adivinar cuál.
        const cosa = b.dataset.ranura
          ? this.equipo?.enRanura(b.dataset.ranura)?.instancia
          : this.inventario.casillas[+b.dataset.i];
        const def = cosa && this.equipo?.definicion(cosa.id);
        if (!cosa || !def) return;
        if (this.equipo.reparar(cosa)) {
          this.hud?.aviso(`Reparaste ${def.nombre.toLowerCase()}`, 'Vuelve a servir');
        } else {
          this.hud?.aviso(def.nombre,
            `Te faltan materiales: ${this.equipo.costoReparar(cosa.id)
              .map(m => `${m.cantidad} × ${nombreDe(m.recurso)}`).join(' · ')}`);
        }
      }
      this.pintar();
    });
  }

  /**
   * Lo que se lleva encima.
   *
   * Va primero y siempre, incluso con el bolso vacío, porque es la respuesta a
   * la pregunta que el juego no contestaba: «¿con qué?». Una herramienta
   * guardada no sirve —el nivel lo decide lo que está en la mano— y eso hay que
   * poder verlo de un vistazo.
   */
  _pintarEquipo() {
    if (!this.equipo) return '';
    const todo = this.equipo.listar();
    const encendida = this.equipo.encendida;
    // Con velas en el bolso también: la licencia de la luz se dice donde se
    // prende, y una vela se prende aunque no haya nada fabricado.
    if (!todo.length && !encendida && !(this.inventario.cantidad('vela') > 0)) return '';

    let html = `<h3>Equipo · trabajás en nivel ${this.equipo.nivel}</h3>`;

    // Lo que arde va arriba de todo, con cuánto le queda: es lo que se mira de
    // noche. Una vela no está en el taller —es una receta— y sin este renglón
    // no habría dónde verla ni cómo apagarla.
    if (encendida) {
      const l = this.equipo.luzActiva(this._fechaMs());
      if (l) {
        const def = this.equipo.definicion(l.id);
        const nombre = l.id === 'velas_cera' ? nombreDe('vela') : (def?.nombre || l.id);
        html += `<div class="bp-it">
          <span>${nombre}<small style="color:var(--tinta-tenue)"> · <b style="color:#e0a050">encendida</b> · alumbra ${l.radio} m</small></span>
          <span class="bp-kg">quedan ${horas(l.horasRestantes)}</span>
          <button data-accion="apagar" data-id="${l.id}">Apagar</button>
        </div>`;
      }
    }

    // Las cuatro ranuras, siempre las cuatro. Lo que está en el bolso ya no se
    // lista acá: está dibujado en la grilla, casillero por casillero y con su
    // durabilidad, que es de lo que se trató esta fase. Repetirlo en dos lugares
    // sería mostrar dos veces la misma hacha y hacer creer que son dos.
    for (const [ranura, rotulo] of RANURAS) {
      const it = todo.find(x => x.puesto && x.ranura === ranura);
      if (!it) {
        html += `<div class="bp-rn vacia"><span class="rot">${rotulo}</span><span class="que">nada</span></div>`;
        continue;
      }
      const alumbra = !!this.equipo.definicion(it.id)?.efecto?.luz;
      // La que arde ya está arriba con su botón de apagar, pero la ranura no se
      // salta: quedaría un hueco donde el jugador espera ver su antorcha.
      const ardiendo = alumbra && encendida === it.id;
      html += `<div class="bp-rn"><span class="rot">${rotulo}</span>
        <span class="que">${it.nombre}<small style="color:var(--tinta-tenue)"> · nivel ${it.nivel}${
          ardiendo ? ' · <b style="color:#e0a050">encendida</b>'
            : it.gastado ? ' · <b style="color:#c8503f">gastada</b>' : ''}</small></span>
        ${this._durabilidadHTML(it)}
        ${it.gastado ? `<button data-accion="reparar" data-ranura="${ranura}">Reparar</button>` : ''}
        ${alumbra && !ardiendo && !it.gastado ? `<button data-accion="encender" data-id="${it.id}">Encender</button>` : ''}
        <button data-accion="desequipar" data-ranura="${ranura}">Guardar</button>
      </div>`;
    }

    // La licencia se dice donde se prende la luz, no escondida en un archivo:
    // es la misma regla que el arco y el fuego (`licenciasDeJuego.luzNocturna`).
    const hayLuz = encendida || todo.some(it => this.equipo.definicion(it.id)?.efecto?.luz)
      || this.inventario.cantidad('vela') > 0;
    if (hayLuz) {
      html += `<div class="bp-kg" style="text-align:left;font-size:.66rem;padding:.3rem 0">
        De noche, con luz en la mano o dentro del resplandor de un fuego, el mapa cuenta que ves hasta 300 m y se abren las cuatro celdas vecinas; a oscuras, 220 m y sólo la que pisás, como siempre.
        Es una licencia de juego: una llama de verdad encandila y no deja ver más lejos.</div>`;
    }
    return html;
  }

  /**
   * La durabilidad de una instancia: barrita y número.
   *
   * Las dos cosas y no una: la barra se lee sin pensar y el número es el que uno
   * compara entre dos hachas para decidir cuál saca. Lo infinito no dibuja
   * barra, porque una barra siempre llena no dice nada.
   */
  _durabilidadHTML(it) {
    if (!Number.isFinite(it.tope)) return '<span class="bp-kg">—</span>';
    const frac = it.tope > 0 ? Math.max(0, it.usos / it.tope) : 0;
    return `<span class="bp-dur" title="${it.usos} de ${it.tope} usos"><i style="width:${
      Math.round(Math.min(1, frac) * 100)}%;background:${colorUso(frac)}"></i></span>`
      + `<span class="bp-kg">${it.usos}/${it.tope}</span>`;
  }

  /**
   * La hora del mundo, en milisegundos. `main.js` le pasa `tiempo` al bolso;
   * mientras no lo haga, se toma el de la fundición, que es el mismo reloj.
   */
  _fechaMs() {
    const t = this.tiempo ?? this.fabricacion?.fundicion?.tiempo;
    return t?.fecha?.getTime?.();
  }

  /**
   * Qué se puede hacer con lo que hay.
   *
   * Se listan también las que no alcanzan, con el motivo escrito: enterarse de
   * que te faltan dos fibras es una meta; que la receta no aparezca es una pared
   * invisible. Es el mismo criterio que ya usa el árbol de saberes.
   */
  _pintarFabricacion() {
    if (!this.fabricacion) return '';
    const posibles = this.fabricacion.disponibles();
    if (!posibles.length) return '';

    const listas = [], faltan = [];
    for (const obj of posibles) {
      const e = this.fabricacion.estado(obj);
      (e.estado === 'lista' ? listas : faltan).push({ obj, e });
    }
    // Primero lo que se puede hacer ahora: es lo que el jugador vino a buscar.
    const orden = [...listas, ...faltan].slice(0, 14);

    let html = `<h3>Se fabrica a mano${listas.length ? ` · ${listas.length} listas` : ''}</h3>`;
    for (const { obj, e } of orden) {
      const receta = (obj.materiales || [])
        .map(m => `${m.cantidad} ${nombreDe(m.recurso).toLowerCase()}`).join(' · ');
      const sale = obj.produce
        ? obj.produce.map(p => `${p.cantidad} ${nombreDe(p.recurso).toLowerCase()}`).join(' · ')
        : `herramienta de nivel ${obj.nivel}`;
      const porque = e.estado === 'faltan_materiales'
        ? e.falta.map(f => `${nombreDe(f.recurso)} ${f.hay}/${f.pide}`).join(', ')
        : e.motivo || '';
      html += `<div class="bp-it">
        <span>${obj.nombre}<small style="color:var(--tinta-tenue)"><br>${receta} → ${sale}</small></span>
        <button data-accion="fabricar" data-id="${obj.id}" ${e.estado === 'lista' ? '' : 'disabled'}>
          ${e.estado === 'lista' ? 'Hacer' : 'No'}</button>
      </div>${porque ? `<div class="bp-kg" style="padding:0 0 .4rem;font-size:.68rem">${porque}</div>` : ''}`;
    }
    if (posibles.length > orden.length) {
      html += `<div class="bp-kg" style="font-size:.68rem;padding:.3rem 0">
        y ${posibles.length - orden.length} más, que aparecen a medida que juntás</div>`;
    }
    return html;
  }

  /**
   * Tomar y poner, que es todo el gesto de la grilla.
   *
   * Tomar sólo marca el índice: la pila no se saca del inventario ni un
   * instante. Si se sacara, entre el clic de tomar y el de poner el peso
   * bajaría, el HUD mostraría menos de lo que hay, una receta podría dar por
   * faltante algo que está en la mano, y cerrar el panel en el medio dejaría la
   * pila en una variable de la interfaz, o sea perdida.
   */
  _tocarCasillero(i) {
    const inv = this.inventario;
    if (this._tomada === null) {
      if (!inv.casillas[i]) return;              // tomar de un casillero vacío no es nada
      this._tomada = i;
    } else if (this._tomada === i) {
      this._tomada = null;                       // volver a apretar lo suelta
    } else if (inv.mover(this._tomada, i)) {
      this._tomada = null;
    }
    // Si `mover` dijo que no —el destino ya tiene la pila llena de lo mismo— lo
    // tomado sigue tomado: soltarlo ahí sería mentir sobre lo que pasó.
    this._mirando = i;
    this.pintar();
  }

  /**
   * La grilla. Un casillero por posición, ocupado o no: los vacíos también se
   * dibujan porque son la mitad de la información —cuánto lugar queda— y porque
   * son el destino de lo que se está por soltar.
   */
  _pintarGrilla() {
    const inv = this.inventario;
    let html = `<h3>Bolso · ${inv.casillas.length} casilleros</h3><div class="bp-grilla">`;
    for (let i = 0; i < inv.casillas.length; i++) {
      const c = inv.casillas[i];
      if (!c) { html += `<button class="bp-cs" data-cs="${i}"></button>`; continue; }
      if (esInstancia(c)) { html += this._casilleroObjeto(i, c); continue; }
      const nombre = nombreDe(c.id);
      const color = COLOR_CAT[RECURSOS[c.id]?.cat] || COLOR_CAT.otros;
      const tope = inv.topeDe(c.id);
      // Con punto y no con coma: el mismo número aparece dos renglones más
      // abajo en la columna de kilos, y verlo escrito de dos formas distintas en
      // la misma pantalla se lee como si fueran dos números.
      const kg = (pesoDe(c.id) * c.n).toFixed(1);
      html += `<button class="bp-cs hay${this._tomada === i ? ' tomada' : ''}" data-cs="${i}"`
        + ` style="color:${color};background:${color}1f;border-color:${color}55"`
        + ` title="${nombre} · ${c.n} de ${tope} · ${kg} kg">${sigla(nombre)}`
        + `${c.n > 1 ? `<i>${c.n}</i>` : ''}`
        + `<u style="width:${Math.round(c.n / tope * 100)}%"></u></button>`;
    }
    return html + '</div>';
  }

  /**
   * Un casillero con una herramienta adentro.
   *
   * Se distingue de una pila por tres cosas a la vez, porque una sola no
   * alcanza cuando el casillero mide veinte píxeles: la esquina cortada, la
   * paleta fría de los objetos, y la franja de abajo, que acá cuenta cuánto le
   * queda de vida en vez de cuánto le entra. El número de la esquina son los
   * usos y no la cantidad: una instancia siempre es una.
   */
  _casilleroObjeto(i, c) {
    const def = this.equipo?.definicion(c.id);
    const nombre = def?.nombre || nombreDe(c.id);
    const rota = !(c.usos > 0);
    const color = rota ? '#c8503f' : (COLOR_OBJ[def?.categoria] || COLOR_OBJ.otros);
    const finito = Number.isFinite(c.usos) && Number.isFinite(def?.durabilidad);
    const frac = finito ? Math.max(0, Math.min(1, c.usos / def.durabilidad)) : 1;
    const ardiendo = this.equipo?.encendida === c.id;
    const detalle = finito ? `${c.usos} de ${def.durabilidad} usos` : 'no se gasta';
    return `<button class="bp-cs hay obj${rota ? ' rota' : ''}${this._tomada === i ? ' tomada' : ''}" data-cs="${i}"`
      + ` style="color:${color};background:${color}1f;border-color:${color}55"`
      + ` title="${nombre} · ${detalle}${ardiendo ? ' · encendida' : ''}">${sigla(nombre)}`
      + `${finito ? `<i>${c.usos}</i>` : ''}`
      + `<u style="width:${Math.round(frac * 100)}%;background:${colorUso(frac)}"></u></button>`;
  }

  /**
   * El renglón de detalle de una herramienta: qué es, cómo está, y los tres
   * verbos que tiene una herramienta guardada —sacarla, prenderla, repararla—
   * más el de tirarla.
   *
   * Van acá y no en la lista de arriba porque desde esta fase la herramienta
   * guardada **es** un casillero, y el jugador la señala apuntándole. Todos los
   * botones mandan el casillero y no el id: con dos hachas, un id ya no señala a
   * una sola cosa, y «reparar el hacha» tendría que adivinar cuál.
   */
  _detalleObjeto(i, c) {
    const def = this.equipo?.definicion(c.id);
    const nombre = def?.nombre || nombreDe(c.id);
    const rota = !(c.usos > 0);
    const finito = Number.isFinite(c.usos) && Number.isFinite(def?.durabilidad);
    const alumbra = !!def?.efecto?.luz;
    const hermanas = this.inventario.instancias(c.id).length;
    const it = { usos: c.usos, tope: def?.durabilidad ?? Infinity };
    return `<div class="bp-it" style="border-top:none;padding-top:0">
        <span>${nombre}<small style="color:var(--tinta-tenue)"> · nivel ${def?.nivel ?? 0}${
          rota ? ' · <b style="color:#c8503f">gastada</b>' : ''}${
          hermanas > 1 ? ` · tenés ${hermanas} en el bolso, cada una con lo suyo` : ''}</small></span>
        ${finito ? this._durabilidadHTML(it) : '<span class="bp-kg">no se gasta</span>'}
        <span class="bp-kg">${this.inventario.kgDe(c.id).toFixed(1)} kg</span>
        ${def?.ranura && !rota ? `<button data-accion="equipar" data-i="${i}">Sacar</button>` : ''}
        ${alumbra && !rota ? `<button data-accion="encender" data-id="${c.id}">Encender</button>` : ''}
        ${rota ? `<button data-accion="reparar" data-i="${i}">Reparar</button>` : ''}
        <button data-accion="tirar_obj" data-i="${i}">Tirar</button>
      </div><div class="bp-ayuda">Clic para tomar y clic para poner · dos herramientas iguales nunca se juntan en un casillero</div>`;
  }

  /**
   * El renglón de abajo: qué es lo que está bajo el puntero y qué se puede hacer
   * con eso. Es donde viven los botones que antes tenía cada renglón de la
   * lista, y son los mismos: acá no se perdió ninguna acción.
   */
  _detalleHTML() {
    const inv = this.inventario;
    const i = this._mirando ?? this._tomada;
    const c = (i != null) ? inv.casillas[i] : null;
    const ayuda = `<div class="bp-ayuda">Clic para tomar y clic para poner · clic derecho parte la pila`
      + `${this._tomada !== null ? ' · <b style="color:#e0a050">tenés algo tomado</b>' : ''}</div>`;

    if (!c) {
      return `<div class="bp-ayuda">${inv.casillas.some(Boolean)
        ? 'Pasá el puntero por un casillero para ver qué es y qué se puede hacer con eso.'
        : 'El bolso está vacío. Acercate a una planta, a una mata o al agua y pulsá E.'}</div>`
        + (inv.casillas.some(Boolean) ? ayuda : '');
    }

    if (esInstancia(c)) return this._detalleObjeto(i, c);

    const def = RECURSOS[c.id];
    const nutre = def?.nutre ? ` · nutre ${def.nutre}` : '';
    const hidrata = def?.hidrata ? ` · hidrata ${def.hidrata}` : '';
    // Cuánto cura se dice acá y no en ningún otro lado: es el número por el que
    // uno decide si vuelve al campamento o sigue.
    const cura = def?.cura ? ` · cura ${def.cura}` : '';
    // El total del bolso cuando está repartido en varias pilas: si no, «Todo»
    // parecería que tira los 5 de esta casilla y tira los 12 que hay.
    const total = inv.cantidad(c.id);
    const repartido = total > c.n ? ` · ${total} en total, en varias pilas` : '';

    // Un recurso que cura no lleva además el botón de comer. La infusión de
    // canelo está declarada como alimento (nutre 4) y encima cura 8, así que
    // quedaba con los dos botones pegados; el de comer no aplica la curación, o
    // sea que apretar el de al lado tiraba 8 de salud a la basura. «Curarte» ya
    // suma lo que nutre y lo que hidrata además de curar: no se pierde nada.
    return `<div class="bp-it" style="border-top:none;padding-top:0">
        <span>${nombreDe(c.id)}<small style="color:var(--tinta-tenue)">${nutre}${hidrata}${cura}${repartido}</small></span>
        <span class="bp-n">${c.n}/${inv.topeDe(c.id)}</span>
        <span class="bp-kg">${(pesoDe(c.id) * c.n).toFixed(1)} kg</span>
        ${def?.cura ? `<button data-accion="curar" data-id="${c.id}">Curarte</button>` : ''}
        ${def?.nutre && !def?.cura ? `<button data-accion="comer" data-id="${c.id}">Comer</button>` : ''}
        ${c.id === 'vela' && this.equipo?.definicion('velas_cera') && this.equipo.encendida !== 'velas_cera'
          ? '<button data-accion="encender" data-id="velas_cera">Encender</button>' : ''}
        <button data-accion="tirar" data-id="${c.id}" data-n="1">Tirar 1</button>
        <button data-accion="tirar" data-id="${c.id}" data-n="todo">Todo</button>
      </div>${ayuda}`;
  }

  _refrescarDetalle() {
    const nodo = this.el.querySelector('#bp-detalle');
    if (nodo) nodo.innerHTML = this._detalleHTML();
  }

  pintar() {
    const inv = this.inventario;
    const kg = inv.pesoKg;
    this.el.querySelector('#bp-peso').textContent = `${kg.toFixed(1)} / ${inv.capacidadKg} kg`;
    const barra = this.el.querySelector('#bp-barra');
    barra.classList.toggle('lleno', kg > inv.capacidadKg * 0.92);
    barra.querySelector('i').style.width = `${Math.min(100, kg / inv.capacidadKg * 100)}%`;

    // Lo tomado pudo desaparecer entre dos pintadas: se comió, se tiró, o la
    // grilla se achicó al perderse el canasto. Un índice que apunta a la nada
    // dejaría la marca ámbar pegada en un casillero vacío y el próximo clic
    // movería aire.
    if (this._tomada !== null && !inv.casillas[this._tomada]) this._tomada = null;

    // El equipo y el taller van SIEMPRE, aunque el bolso esté vacío: con las
    // manos vacías es justamente cuando hace falta saber qué se puede hacer.
    this.el.querySelector('#bp-cuerpo').innerHTML =
      this._pintarEquipo() + this._pintarFabricacion() + this._pintarGrilla()
      + `<div class="bp-detalle" id="bp-detalle">${this._detalleHTML()}</div>`
      + (inv.desbordado
        ? `<div class="bp-vacio">La partida guardada traía más cosas de las que entran en la grilla: lo que no tuvo casillero quedó afuera.</div>`
        : '');
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this.pintar();
      document.exitPointerLock?.();
    } else {
      // Cerrar con algo tomado no mueve nada —lo tomado es un índice—, pero
      // dejar la marca puesta haría que el próximo clic, media hora después,
      // moviera una pila que nadie recuerda haber levantado.
      this._tomada = null;
      this._mirando = null;
    }
  }
}
