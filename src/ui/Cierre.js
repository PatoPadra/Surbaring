/**
 * Cierre — la pantalla del año cumplido.
 *
 * Es el final que al juego le faltaba, y es deliberadamente lo contrario de una
 * pantalla de victoria: no hay puntaje, no hay estrellas, no hay "completaste el
 * 100 %". Hay un inventario de lo que el jugador sabe, con sus números reales, y
 * un epílogo que es historia verificada y no una felicitación.
 *
 * El argumento del epílogo es el mismo que sostiene todo el proyecto. En 1903
 * Francisco Moreno donó al Estado tres leguas cuadradas en el brazo Blest con la
 * condición de que se conservaran en su estado natural, y de esa donación salió,
 * treinta y un años después, la Ley 12.103 y el primer parque nacional del país.
 * Lo que el jugador anotó ya existía protegido antes de que llegara: lo que hizo
 * en este año fue enterarse de por qué. Ésa es exactamente la diferencia entre
 * conquistar un mapa y entenderlo, y es la razón de ser del juego.
 *
 * El año no termina la partida. Se puede seguir jugando, y el cuaderno sigue
 * anotando: cerrar no es lo mismo que agotar.
 */

const CSS = `
  #cierre { position: fixed; inset: 0; z-index: 100; display: none;
    background: radial-gradient(ellipse at 50% 30%, rgba(18,22,18,.93), rgba(7,8,7,.985));
    color: var(--tinta); overflow: auto; }
  #cierre.visible { display: grid; place-items: center; animation: cierreEntra 2.2s ease both; }
  @keyframes cierreEntra { from { opacity: 0 } to { opacity: 1 } }
  #cierre .ci-marco { width: min(660px, 92vw); padding: 2rem 0; }
  #cierre .ci-rotulo { font-size: .64rem; letter-spacing: .2em; text-transform: uppercase;
    color: var(--acento); margin-bottom: .5rem; }
  #cierre h2 { font-size: 1.6rem; font-weight: 400; letter-spacing: .01em; margin-bottom: 1.4rem; }
  #cierre .ci-cuenta { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: .9rem 1.2rem; margin-bottom: 1.6rem; }
  #cierre .ci-dato { border-left: 2px solid rgba(127,159,116,.45); padding-left: .8rem; }
  #cierre .ci-dato b { display: block; font-size: 1.5rem; font-weight: 400; line-height: 1.2;
    font-variant-numeric: tabular-nums; }
  #cierre .ci-dato span { font-size: .68rem; color: var(--tinta-tenue); letter-spacing: .05em; }
  #cierre .ci-texto { font-size: .87rem; line-height: 1.75; color: #dfe4dc;
    background: rgba(255,255,255,.04); border-radius: 3px; padding: 1.1rem 1.2rem;
    margin-bottom: 1.4rem; }
  #cierre .ci-texto b { color: var(--acento); font-weight: 500; }
  #cierre .ci-texto + .ci-texto { background: none; padding: 0 1.2rem; }
  #cierre button { background: rgba(255,255,255,.07); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.16); border-radius: 3px;
    padding: .5rem 1.3rem; font: inherit; font-size: .8rem; cursor: pointer; }
  #cierre button:hover { background: rgba(255,255,255,.14); }
  #cierre footer { margin-top: 1rem; font-size: .7rem; color: var(--tinta-tenue); line-height: 1.6; }
`;

export class Cierre {
  constructor() {
    this.abierto = false;
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'cierre';
    el.innerHTML = `<div class="ci-marco">
      <p class="ci-rotulo">Un año en la cuenca del Nahuel Huapi</p>
      <h2>Cerraste el cuaderno</h2>
      <div class="ci-cuenta" id="ci-cuenta"></div>
      <div class="ci-texto" id="ci-epilogo"></div>
      <div class="ci-texto" id="ci-cola"></div>
      <button data-accion="seguir">Seguir anotando</button>
      <footer>El año se cumplió, pero el parque sigue ahí. Nada se cierra: podés seguir
        jugando, y lo que anotes de acá en adelante se suma.</footer>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('button[data-accion=seguir]')) this.cerrar();
    });
  }

  mostrar(r) {
    const dato = (n, t) => `<div class="ci-dato"><b>${n}</b><span>${t}</span></div>`;
    this.el.querySelector('#ci-cuenta').innerHTML = [
      dato(r.especies, `especies de ${r.especiesPosibles}`),
      dato(r.lugares, `lugares de ${r.lugaresPosibles}`),
      dato(r.tecnologias, 'tecnologías'),
      dato(r.saber, 'puntos de saber'),
      dato(r.obras, r.obras === 1 ? 'obra en pie' : 'obras en pie'),
      dato(`${(r.explorado * 100).toFixed(1)} %`, 'del mapa recorrido'),
    ].join('');

    this.el.querySelector('#ci-epilogo').innerHTML =
      `Pasaste ${r.dias} días acá adentro y anotaste <b>${r.especies} especies</b> y
       <b>${r.lugares} lugares</b>. En 1876 Francisco Moreno hizo algo bastante parecido con su
       cuaderno, y en 1903 donó al Estado tres leguas cuadradas en el brazo Blest con una sola
       condición: que se conservaran en su estado natural. Treinta y un años después, la
       <b>Ley 12.103</b> convirtió esa donación en el primer parque nacional del país.`;

    this.el.querySelector('#ci-cola').innerHTML =
      `Lo que anotaste ya existía protegido antes de que llegaras. Lo que hiciste este año fue
       enterarte de por qué: por qué no se caza un huemul en ningún mes y con ningún permiso, por
       qué no se saca una piedra del área núcleo, por qué un refugio sí y una cabaña no. Ésa es
       toda la diferencia entre recorrer un mapa y entenderlo, y es la única que el parque te iba
       a pedir.`;

    this.abierto = true;
    this.el.classList.add('visible');
    document.exitPointerLock?.();
  }

  cerrar() {
    this.abierto = false;
    this.el.classList.remove('visible');
  }
}
