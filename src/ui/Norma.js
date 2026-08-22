/**
 * Norma — la pantalla que aparece cuando la ley dice que no.
 *
 * SurviBar tiene una tesis escrita en su README: *la negativa es el contenido*.
 * Cuando la ley del parque no te deja cazar un huemul o sacar áridos, el juego
 * explica por qué, y esa explicación es lo que el jugador viene a aprender.
 *
 * El problema era que esa tesis duraba 4,2 segundos. Las tres explicaciones
 * legales de `caza.json` miden 536, 517 y 621 caracteres —entre veinte y treinta
 * y cinco segundos de lectura atenta— y salían por el mismo cartel efímero que
 * anuncia "No entra nada más", que tiene diecinueve. Después no quedaban en
 * ningún lado: el códice tenía seis pestañas y ninguna era normativa, así que
 * los dos archivos que sostienen la tesis del juego no se podían leer desde
 * ninguna pantalla. El jugador entendía la penalización y no el contenido, que
 * es exactamente la inversión que el proyecto quiere evitar.
 *
 * Acá se resuelve con dos piezas:
 *
 * - **Un panel que espera.** Sólo para las negativas graves —las que citan un
 *   artículo—, porque frenar el juego cada vez que el bolso está lleno sería
 *   insoportable. Un huemul en la mira es el momento de máxima atención del
 *   jugador: es el momento para gastarlo, igual que la pantalla de muerte.
 * - **Un registro que queda.** Cada negativa se anota con fecha, lugar y costo,
 *   y se relee después, sentado junto al fuego, que es cuando se puede leer.
 *   Se guarda aparte de la partida y sobrevive a la muerte: es conocimiento, y
 *   el conocimiento no se cae con el cuerpo.
 *
 * El juego no se congela mientras el panel está abierto, igual que no se congela
 * con el códice o el taller abiertos. Es coherente con lo que ya hace el resto,
 * y congelar la simulación es una decisión de diseño más grande que ésta.
 */

const CLAVE = 'survibar.normas.v1';

const CSS = `
  #norma { position: fixed; inset: 0; z-index: 110; display: none;
    background: rgba(8,7,6,.80); backdrop-filter: blur(5px); color: var(--tinta); }
  #norma.abierto { display: grid; place-items: center; animation: nrEntra .35s ease both; }
  @keyframes nrEntra { from { opacity: 0 } to { opacity: 1 } }
  #norma .nr-marco { width: min(620px, 92vw); max-height: 88vh; overflow: auto;
    background: rgba(20,18,17,.98); border: 1px solid rgba(200,80,63,.34);
    border-left: 3px solid var(--nr-color, #c8503f);
    border-radius: 4px; padding: 1.3rem 1.5rem 1.1rem; }
  #norma .nr-rotulo { font-size: .62rem; letter-spacing: .16em; text-transform: uppercase;
    color: var(--nr-color, #c8503f); margin-bottom: .35rem; }
  #norma h2 { font-size: 1.05rem; font-weight: 500; letter-spacing: .02em; margin-bottom: .8rem; }
  #norma .nr-texto { font-size: .84rem; line-height: 1.7; color: #dfe4dc; }
  #norma .nr-nota { font-size: .78rem; line-height: 1.65; color: var(--acento);
    border-top: 1px solid rgba(255,255,255,.08); margin-top: .9rem; padding-top: .8rem; }
  #norma .nr-costo { font-size: .72rem; color: var(--tinta-tenue); margin-top: .8rem; }
  #norma .nr-pie { display: flex; align-items: center; gap: .9rem; margin-top: 1.1rem; }
  #norma .nr-pie span { flex: 1; font-size: .67rem; color: var(--tinta-tenue); line-height: 1.5; }
  #norma button { background: rgba(255,255,255,.07); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.16); border-radius: 3px;
    padding: .45rem 1.3rem; font: inherit; font-size: .78rem; cursor: pointer; }
  #norma button:hover { background: rgba(255,255,255,.14); }
`;

export class Norma {
  constructor() {
    this.abierto = false;
    /** Lo que el jugador intentó y no pudo, con su explicación. */
    this.registro = [];
    this._cargar();
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'norma';
    el.innerHTML = `<div class="nr-marco">
      <p class="nr-rotulo" id="nr-rotulo">La ley del parque</p>
      <h2 id="nr-titulo"></h2>
      <div class="nr-texto" id="nr-texto"></div>
      <div class="nr-nota" id="nr-nota"></div>
      <p class="nr-costo" id="nr-costo"></p>
      <div class="nr-pie">
        <span>Queda anotado en el códice, en <b>Normativa</b>: se relee cuando haya tiempo.</span>
        <button data-accion="cerrar">Entendido</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;

    el.addEventListener('click', (ev) => {
      if (ev.target.closest('button[data-accion=cerrar]') || ev.target === el) this.cerrar();
    });
    addEventListener('keydown', (ev) => {
      if (!this.abierto) return;
      if (ev.code === 'Escape' || ev.code === 'Enter' || ev.code === 'Space') {
        ev.preventDefault();
        // Y además cortar la propagación entre oyentes del mismo objetivo.
        // `preventDefault` sólo cancela lo que haría el navegador, no a los
        // demás oyentes: main tiene el suyo para Escape, corre después de éste,
        // encuentra el panel YA cerrado y cae en la última rama de su cascada,
        // que abre las opciones. O sea que cerrar la explicación de la ley
        // abría el menú encima, justo cuando el jugador terminaba de leerla.
        ev.stopImmediatePropagation();
        this.cerrar();
      }
    });
  }

  /**
   * Muestra un veredicto. Los graves abren el panel; los leves se quedan en el
   * cartel del HUD, que para "fuera de temporada" es la dosis correcta.
   *
   * @param {object} v veredicto {titulo, detalle, nota, gravedad, castigo, color}
   * @param {object} ctx {lugar, fecha} para el registro
   * @returns {boolean} si abrió el panel
   */
  mostrar(v, ctx = {}) {
    this.anotar(v, ctx);
    if (v.gravedad !== 'grave') return false;

    const q = (id) => this.el.querySelector(id);
    this.el.querySelector('.nr-marco').style.setProperty('--nr-color', v.color || '#c8503f');
    q('#nr-titulo').textContent = v.titulo || 'No se puede';
    q('#nr-texto').textContent = v.detalle || '';
    // La nota educativa de la especie es el mejor texto del dataset y hasta acá
    // no se mostraba nunca en el camino de la negativa, que es donde importa.
    const nota = q('#nr-nota');
    nota.textContent = v.nota || '';
    nota.style.display = v.nota ? '' : 'none';
    const costo = q('#nr-costo');
    costo.textContent = v.castigo ? `Costó ${v.castigo} puntos de saber.` : '';
    costo.style.display = v.castigo ? '' : 'none';

    this.abierto = true;
    this.el.classList.add('abierto');
    document.exitPointerLock?.();
    return true;
  }

  /** Anota la negativa, se haya mostrado el panel o no. */
  anotar(v, ctx = {}) {
    this.registro.unshift({
      titulo: v.titulo || '',
      detalle: v.detalle || '',
      nota: v.nota || '',
      gravedad: v.gravedad || 'leve',
      castigo: v.castigo || 0,
      lugar: ctx.lugar || '',
      fecha: ctx.fecha || '',
    });
    // Cien alcanza y sobra: es un registro para releer, no un historial forense.
    if (this.registro.length > 100) this.registro.length = 100;
    this._guardar();
  }

  cerrar() {
    this.abierto = false;
    this.el.classList.remove('abierto');
  }

  _guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(this.registro)); } catch { /* sin almacenamiento */ }
  }

  _cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (crudo) this.registro = JSON.parse(crudo) || [];
    } catch { this.registro = []; }
  }

  olvidar() {
    this.registro = [];
    this._guardar();
  }
}
