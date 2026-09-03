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
 */

import { RECURSOS, pesoDe } from '../systems/Recursos.js';

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
`;

const TITULOS = { alimento: 'Alimento', remedio: 'Botica', material: 'Materiales' };

/**
 * En qué orden se muestran los grupos, no cuáles se muestran.
 *
 * Acá había un defecto silencioso y caro: el bolso recorría la lista literal
 * `['alimento', 'material']`, así que **cualquier categoría que no fuera una de
 * esas dos desaparecía de la pantalla**. Y hay dos declaradas con `cat:
 * 'remedio'` en `Recursos.js` —el emplasto de maqui y el lavado de michay—, que
 * son justamente el cierre de la tesis del juego: identificar una planta es lo
 * que te salva la noche siguiente. El jugador los juntaba, los tenía encima, lo
 * curaban al apretar Q… y no había forma de enterarse de que los tenía.
 *
 * Eran **dos** recursos invisibles, no tres: el hueso, que tampoco tenía ficha,
 * igual se dibujaba, porque `Inventario.listar()` ya rellena `cat` con
 * `'material'` por omisión. Lo suyo era otra cosa —pesaba los 0,5 kg de omisión
 * de `pesoDe()` en vez de un peso decidido—, y se arregló fichándolo.
 *
 * Por eso el grupo «Otros» de más abajo es, hoy, una red que no atrapa nada:
 * mientras `listar()` rellene la categoría, nunca llega un `undefined`. Se deja
 * igual, y a propósito: cuesta cero y es lo que evita que el próximo que
 * devuelva una categoría sin título vuelva a desaparecer sin dejar rastro.
 *
 * Por eso ahora los grupos salen de lo que de verdad hay en el bolso y esta
 * lista sólo manda el orden: el alimento primero porque es lo que se mira con
 * hambre, la botica segunda porque es lo que se busca con la salud en rojo, y
 * los materiales al final porque son los que más renglones ocupan. Lo que no
 * esté acá se dibuja igual, al final. Agregar una categoría nueva a
 * `Recursos.js` no vuelve a esconder nada.
 */
const ORDEN = ['alimento', 'remedio', 'material'];

export class Bolso {
  /** @param {object} deps {inventario, jugador, hud, recoleccion} */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
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

    el.addEventListener('click', (ev) => {
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
      }
      this.pintar();
    });
  }

  pintar() {
    const inv = this.inventario;
    const items = inv.listar();
    const kg = inv.pesoKg;
    this.el.querySelector('#bp-peso').textContent = `${kg.toFixed(1)} / ${inv.capacidadKg} kg`;
    const barra = this.el.querySelector('#bp-barra');
    barra.classList.toggle('lleno', kg > inv.capacidadKg * 0.92);
    barra.querySelector('i').style.width = `${Math.min(100, kg / inv.capacidadKg * 100)}%`;

    if (!items.length) {
      this.el.querySelector('#bp-cuerpo').innerHTML =
        `<div class="bp-vacio">Vacío. Acercate a una planta, a una mata o al agua y pulsá E.</div>`;
      return;
    }

    // Los grupos son los que hay, con `ORDEN` mandando nada más que la
    // secuencia. Lo que no tenga categoría cae en «Otros» y se ve: antes se
    // perdía sin dejar rastro.
    const cats = [...new Set(items.map(i => i.cat || 'otros'))]
      .sort((a, b) => {
        const ia = ORDEN.indexOf(a), ib = ORDEN.indexOf(b);
        return (ia < 0 ? ORDEN.length : ia) - (ib < 0 ? ORDEN.length : ib);
      });

    let html = '';
    for (const cat of cats) {
      const grupo = items.filter(i => (i.cat || 'otros') === cat);
      if (!grupo.length) continue;
      html += `<h3>${TITULOS[cat] || cat}</h3>`;
      // Un recurso que cura no lleva además el botón de comer. La infusión de
      // canelo está declarada como alimento (nutre 4) y encima cura 8, así que
      // quedaba con los dos botones pegados; el de comer no aplica la curación,
      // o sea que apretar el de al lado tiraba 8 de salud a la basura. «Curarte»
      // ya suma lo que nutre y lo que hidrata además de curar: no se pierde nada.
      for (const it of grupo) {
        const def = RECURSOS[it.id];
        const nutre = def?.nutre ? ` · nutre ${def.nutre}` : '';
        const hidrata = def?.hidrata ? ` · hidrata ${def.hidrata}` : '';
        // Cuánto cura se dice acá y no en ningún otro lado: es el número por el
        // que uno decide si vuelve al campamento o sigue.
        const cura = def?.cura ? ` · cura ${def.cura}` : '';
        html += `<div class="bp-it">
          <span>${it.nombre}<small style="color:var(--tinta-tenue)">${nutre}${hidrata}${cura}</small></span>
          <span class="bp-n">${it.cantidad}</span>
          <span class="bp-kg">${(pesoDe(it.id) * it.cantidad).toFixed(1)} kg</span>
          ${def?.cura ? `<button data-accion="curar" data-id="${it.id}">Curarte</button>` : ''}
          ${def?.nutre && !def?.cura ? `<button data-accion="comer" data-id="${it.id}">Comer</button>` : ''}
          <button data-accion="tirar" data-id="${it.id}" data-n="1">Tirar 1</button>
          <button data-accion="tirar" data-id="${it.id}" data-n="todo">Todo</button>
        </div>`;
      }
    }
    this.el.querySelector('#bp-cuerpo').innerHTML = html;
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this.pintar();
      document.exitPointerLock?.();
    }
  }
}
