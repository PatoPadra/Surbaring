/**
 * Ayuda — las teclas, en el juego.
 *
 * El juego tiene catorce teclas y hasta ahora la única forma de conocerlas era
 * leer el README. Para alguien que abre el juego a probarlo, eso significa que
 * la mitad de lo que hay construido no existe.
 *
 * Se abre con F1 y desde las opciones.
 */

const GRUPOS = [
  {
    titulo: 'Moverse',
    teclas: [
      ['WASD', 'Caminar'],
      ['Shift', 'Correr (gasta resistencia)'],
      ['Espacio', 'Saltar · nadar hacia arriba'],
      ['Ctrl o C', 'Agacharse'],
      ['F', 'Primera o tercera persona'],
    ],
  },
  {
    titulo: 'Actuar sobre el mundo',
    teclas: [
      ['E', 'Recolectar · identificar · beber · sacar el permiso de pesca'],
      ['Q', 'Comer lo mejor que haya en el bolso'],
      ['R', 'Extraer áridos o levantar chatarra'],
      ['P', 'Tirar la línea'],
      ['H', 'Intentar cazar (fijate qué dice la ley)'],
    ],
  },
  {
    titulo: 'Paneles',
    teclas: [
      ['Tab', 'Códice: fauna, flora, geografía, historia, mitología y saberes'],
      ['M', 'Mapa del parque, que se revela explorando'],
      ['I', 'Bolso: pesos, comer y tirar'],
      ['G', 'Taller: cantera, hornos, hornadas y obras'],
      ['Esc', 'Opciones'],
      ['F1', 'Esta ayuda'],
    ],
  },
  {
    titulo: 'Ajustes rápidos',
    teclas: [
      ['T', 'Acelerar el paso del tiempo'],
      ['C', 'Cambiar la calidad gráfica'],
      ['O', 'Posproceso: completo, sin oclusión, crudo'],
      ['F3', 'Panel de diagnóstico'],
    ],
  },
];

const CSS = `
  #ayudaPanel { position: fixed; inset: 0; z-index: 96; display: none;
    background: rgba(8,10,9,.85); backdrop-filter: blur(5px); color: var(--tinta); }
  #ayudaPanel.abierto { display: grid; place-items: center; }
  #ayudaPanel .ay-marco { width: min(700px, 93vw); max-height: 88vh; overflow: auto;
    background: rgba(18,21,19,.97); border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 1.3rem 1.6rem; }
  #ayudaPanel h2 { font-size: 1rem; font-weight: 500; letter-spacing: .04em; }
  #ayudaPanel .ay-sub { font-size: .72rem; color: var(--tinta-tenue); margin-bottom: .6rem; }
  #ayudaPanel h3 { font-size: .62rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: 1.1rem 0 .3rem; }
  #ayudaPanel .ay-fila { display: flex; gap: .9rem; padding: .26rem 0; font-size: .76rem;
    border-top: 1px solid rgba(255,255,255,.05); }
  #ayudaPanel kbd { font: inherit; font-size: .68rem; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.16); border-radius: 3px; padding: .06rem .4rem;
    min-width: 4.6rem; text-align: center; color: var(--acento); }
  #ayudaPanel .ay-nota { margin-top: 1.2rem; font-size: .72rem; line-height: 1.6;
    color: var(--tinta-tenue); border-left: 2px solid rgba(127,159,116,.45); padding-left: .8rem; }
`;

export class Ayuda {
  constructor() {
    this.abierto = false;
    const el = document.createElement('div');
    el.id = 'ayudaPanel';   // `ayuda` ya lo usa la pantalla de carga
    el.innerHTML = `<div class="ay-marco">
      <h2>Cómo se juega</h2>
      <p class="ay-sub">No se gana matando: se gana conociendo.</p>
      ${GRUPOS.map(g => `<h3>${g.titulo}</h3>` + g.teclas.map(
        ([k, d]) => `<div class="ay-fila"><kbd>${k}</kbd><span>${d}</span></div>`).join('')).join('')}
      <p class="ay-nota">Los puntos de saber salen de identificar especies, llegar a lugares
        y reconocer fenómenos, y con ellos se desbloquean tecnologías en el códice.
        Casi todo lo que la ley del parque no permite tiene una explicación cuando lo
        intentás: la negativa es el contenido, no un obstáculo.</p>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) document.exitPointerLock?.();
  }

  cerrar() { this.abierto = false; this.el.classList.remove('abierto'); }
}
