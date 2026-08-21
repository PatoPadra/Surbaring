/**
 * Fin — qué pasa cuando la salud llega a cero.
 *
 * La pantalla no dice "moriste" y ya. Dice **de qué**, **dónde**, **con qué
 * condiciones** y —esto es lo que la hace parte del juego y no un castigo—
 * **qué habría cambiado el resultado**. En un juego sobre un parque nacional,
 * morirse de hipotermia a 2.300 m sin refugio es exactamente la lección que hay
 * que aprender, y desperdiciarla mostrando un botón de reintentar sería tirar el
 * único momento en que el jugador está prestando atención de verdad.
 *
 * El consejo no es genérico: sale del estado real que causó la muerte.
 */

const CSS = `
  #fin { position: fixed; inset: 0; z-index: 90; display: none;
    background: radial-gradient(ellipse at center, rgba(12,10,9,.86), rgba(6,6,6,.97));
    color: var(--tinta); font-family: inherit; }
  #fin.visible { display: grid; place-items: center; animation: finEntra 1.6s ease both; }
  @keyframes finEntra { from { opacity: 0 } to { opacity: 1 } }
  #fin .fn-marco { width: min(620px, 90vw); text-align: left; }
  #fin h2 { font-size: 1.5rem; font-weight: 400; letter-spacing: .01em; margin-bottom: .3rem; }
  #fin .fn-sub { color: #c8503f; font-size: .82rem; letter-spacing: .14em;
    text-transform: uppercase; margin-bottom: 1.4rem; }
  #fin .fn-datos { display: grid; grid-template-columns: auto 1fr; gap: .3rem 1.1rem;
    font-size: .78rem; line-height: 1.6; margin-bottom: 1.3rem;
    border-left: 2px solid rgba(200,80,63,.5); padding-left: .9rem; }
  #fin .fn-datos span:nth-child(odd) { color: var(--tinta-tenue); }
  #fin .fn-leccion { font-size: .85rem; line-height: 1.65; color: #dfe4dc;
    background: rgba(255,255,255,.045); border-radius: 3px; padding: .9rem 1rem;
    margin-bottom: 1.4rem; }
  #fin .fn-leccion b { color: var(--acento); font-weight: 500; }
  #fin button { background: rgba(255,255,255,.07); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.16); border-radius: 3px;
    padding: .5rem 1.3rem; font: inherit; font-size: .8rem; cursor: pointer; }
  #fin button:hover { background: rgba(255,255,255,.14); }
  #fin footer { margin-top: 1rem; font-size: .7rem; color: var(--tinta-tenue); }
`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class Fin {
  /**
   * @param {object} deps {jugador, mundo, tiempo, hud, codice, saberes, construccion}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'fin';
    el.innerHTML = `<div class="fn-marco">
      <h2 id="fn-titulo">No volviste</h2>
      <p class="fn-sub" id="fn-causa"></p>
      <div class="fn-datos" id="fn-datos"></div>
      <div class="fn-leccion" id="fn-leccion"></div>
      <button id="fn-otra">Empezar de nuevo</button>
      <footer>El códice y todo lo que aprendiste se conservan.</footer>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
    el.querySelector('#fn-otra').addEventListener('click', () => this.reiniciar());
  }

  /**
   * El texto que explica la muerte. Cada causa tiene su propia lectura, porque
   * la de cada una es distinta: la sed avisa con horas, la hipotermia con
   * minutos y el fuego no avisa.
   */
  _leccion(m) {
    const alt = Math.round(m.altitud);
    switch (m.causa) {
      case 'hipotermia': {
        const sens = m.sensacion != null ? `${m.sensacion.toFixed(0)} °C de sensación térmica` : 'frío';
        const abrigo = m.abrigo > 0.05
          ? `Estabas bajo un refugio que abrigaba un ${Math.round(m.abrigo * 100)} %, y no alcanzó.`
          : 'Estabas a la intemperie.';
        return `Tu cuerpo bajó a ${m.temperaturaCuerpo.toFixed(1)} °C. Por debajo de 35 °C el
          organismo pierde más calor del que produce y ya no se recupera solo.
          A ${alt} m había ${sens}. ${abrigo}
          <br><br><b>Qué la habría evitado:</b> cortar el viento. Un parapeto de ramas caídas
          cuesta 8 de leña y 3 de fibra y frena la mayor parte del enfriamiento;
          un vivac de colihue y cuero, más. Bajar de altura también sirve: el
          gradiente real es de 6,5 °C por cada kilómetro, así que descender
          quinientos metros son tres grados más.`;
      }
      case 'sed':
        return `Te deshidrataste. La sed mata mucho antes que el hambre: el cuerpo aguanta
          semanas sin comer y días sin beber, y por eso acá descontaba más del doble.
          <br><br><b>Qué la habría evitado:</b> el Nahuel Huapi es agua por todos lados.
          Pararte en la orilla o en un arroyo y pulsar <b>E</b> alcanza, y además llena
          el bolso con agua para más tarde.`;
      case 'hambre':
        return `Te quedaste sin reservas. Con el alimento en cero el cuerpo consume músculo
          y la resistencia no se repone.
          <br><br><b>Qué la habría evitado:</b> el bosque da de comer si se lo conoce.
          Calafate, maqui y michay se recolectan con <b>E</b>; los hongos también.
          Fuera del área núcleo, la pesca de una trucha con permiso rinde varios kilos.`;
      case 'golpe de calor':
        return `Tu cuerpo pasó los 39 °C. Poco frecuente en la cordillera, pero el efecto
          föhn del viento de sotavento sube la temperatura varios grados de golpe.
          <br><br><b>Qué lo habría evitado:</b> sombra, agua y dejar de correr con
          el bolso cargado.`;
      case 'avalancha': {
        const g = m.pendienteGrados != null ? `${Math.round(m.pendienteGrados)}°` : 'fuerte';
        const senal = m.fenomeno?.senalesPrevias;
        return `Te tapó una avalancha. Estabas en una ladera de ${g}: la mayoría de las placas
          se sueltan entre 30 y 45 grados, porque por debajo de 25 la nieve no desliza y por
          encima de 50 no llega a acumularse. Debajo de la nieve el cuerpo pierde calor y aire
          en minutos, no en horas.
          <br><br><b>Qué la habría evitado:</b> ${senal
            ? `el aviso estaba, y decía: «${senal}».`
            : 'leer el aviso previo, que el juego siempre da antes.'}
          Después de una nevada grande la nieve nueva tarda uno o dos días en asentarse. En
          ese lapso se cruza por el filo o por el fondo del valle, nunca por la mitad de la
          ladera.`;
      }
      case 'rayo':
        return `Te alcanzó un rayo a ${alt} m. En tormenta, la cumbre, la arista y el árbol
          aislado son los tres peores lugares del cerro: la descarga busca lo más alto y lo
          más puntiagudo, y vos con el bolso al hombro eras eso.
          <br><br><b>Qué lo habría evitado:</b> contar. Entre el relámpago y el trueno hay
          unos tres segundos por kilómetro, porque el sonido va a 343 m/s. Si contás menos de
          treinta, la tormenta está a menos de diez kilómetros y ya estás dentro de su
          alcance: ahí se baja, sin discutirlo. Perder cien metros de altura vale más que
          cualquier refugio que puedas armar arriba.`;
      case 'incendio': {
        const d = m.distancia != null ? `a unos ${m.distancia} m del frente` : 'demasiado cerca del frente';
        return `Te alcanzó el fuego. Estabas ${d}. Un incendio de bosque no mata sobre todo
          por la llama: mata por el aire, que a esa distancia viene a varios cientos de grados
          y sin oxígeno útil.
          <br><br><b>Qué lo habría evitado:</b> mirar para dónde va, no dónde está. El fuego
          corre cuesta arriba mucho más rápido que en llano —el calor precalienta el
          combustible de arriba— y va con el viento. Se escapa hacia abajo y de costado,
          cruzando hacia lo ya quemado o hacia el agua, nunca subiendo por delante de él.`;
      }
      default:
        return `Te alcanzó el desgaste. Comer, beber y no dormir a la intemperie no son
          detalles en la cordillera: son el juego.`;
    }
  }

  /**
   * Qué costó morirse, en kilos y en distancia. Un juego de supervivencia
   * necesita que la muerte tenga precio; conviene que el precio esté escrito.
   */
  _perdida() {
    const p = this.partida?.ultimaMuerte;
    if (!p) return '';
    const lista = p.perdido.slice(0, 6).map(i => `${i.nombre} ×${i.cantidad}`).join(', ');
    const resto = p.perdido.length > 6 ? ` y ${p.perdido.length - 6} cosas más` : '';
    return `
      <span>Se perdió</span><span>${p.perdido.length
        ? `${p.kg} kg encima: ${lista}${resto}`
        : 'nada: ibas con el bolso vacío'}</span>
      <span>Volvés a</span><span>${p.base
        ? `${p.base}, a ${p.distancia} m de donde caíste`
        : 'la costa donde empezaste, porque no hay ninguna base levantada'}</span>`;
  }

  mostrar(m) {
    const f = this.tiempo.fechaLocal;
    const geo = this.mundo.aLatLon(this.jugador.posicion.x, this.jugador.posicion.z);
    const dias = Math.floor(m.horas / 24);
    const horas = Math.floor(m.horas % 24);

    this.el.querySelector('#fn-causa').textContent = m.causa;
    this.el.querySelector('#fn-datos').innerHTML = `
      <span>Sobreviviste</span><span>${dias > 0 ? `${dias} día${dias > 1 ? 's' : ''} y ` : ''}${horas} h de juego</span>
      <span>Fecha</span><span>${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}, ${this.tiempo.textoHora}</span>
      <span>Lugar</span><span>${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} · ${Math.round(m.altitud)} m</span>
      <span>Temperatura</span><span>ambiente ${(m.clima?.temperatura ?? 0).toFixed(1)} °C ·
        viento ${(m.clima?.vientoKmh ?? 0).toFixed(0)} km/h · cuerpo ${m.temperaturaCuerpo.toFixed(1)} °C</span>
      <span>Especies</span><span>${this.codice?.identificadas.size ?? 0} identificadas ·
        ${this.codice?.lugares.size ?? 0} lugares descubiertos</span>
      <span>Saber</span><span>${this.saberes?.ganadosTotales ?? 0} puntos ganados ·
        ${this.saberes?.desbloqueadas.size ?? 0} tecnologías</span>
      ${this._perdida()}`;
    this.el.querySelector('#fn-leccion').innerHTML = this._leccion(m);

    this.abierto = true;
    this.el.classList.add('visible');
    document.exitPointerLock?.();
  }

  reiniciar() {
    this.abierto = false;
    this.el.classList.remove('visible');
    // La reaparición la decide la partida: se pierde el bolso donde caíste y se
    // vuelve a la base más cercana. El códice, las tecnologías y las obras
    // siguen ahí. Se pierde el cuerpo y la carga, no lo aprendido.
    if (this.partida) { this.partida.reaparecer(); return; }
    this.jugador.revivir();
    this.jugador.aparecerEn(-41.0870, -71.4290);
    this.hud?.aviso('Otra vez en pie', 'Lo que aprendiste sigue en el códice');
  }
}
