/**
 * Personaje — la pantalla donde uno decide quién va a entrar al parque.
 *
 * Es lo primero que se ve, antes del bosque. Y no está sólo por costumbre de
 * los juegos de rol: el arranque de SurviBar tiraba al jugador dentro de un
 * bosque de la nada, y un minuto de elegir estatura y campera hace que lo que
 * pasa después le pase **a alguien**. Es el mismo argumento por el que la
 * pantalla de muerte explica de qué te moriste en vez de mostrar un botón.
 *
 * La vista previa es una escena de three aparte, con su propio lienzo chico:
 * mezclarla con la escena del juego habría obligado a mover la cámara del mundo
 * y a apagar medio pipeline. Un contexto de más durante veinte segundos es
 * mucho más barato que eso, y se libera al cerrar.
 *
 * El panel no toca nada del juego: devuelve una promesa que se resuelve con el
 * aspecto elegido. Quien lo abre decide qué hacer con él.
 */

import * as THREE from 'three';
import { Cuerpo } from '../entities/Cuerpo.js';
import {
  Aspecto, PIELES, PELOS, PEINADOS, CAMPERAS, PANTALONES, COMPLEXIONES,
  ESTATURA_MIN, ESTATURA_MAX,
} from '../systems/Aspecto.js';

const CSS = `
  #personaje { position: fixed; inset: 0; z-index: 120; display: none;
    background: radial-gradient(ellipse at 30% 40%, rgba(16,20,17,.94), rgba(6,7,6,.985));
    color: var(--tinta); }
  #personaje.abierto { display: grid; place-items: center; animation: pjEntra .5s ease both; }
  @keyframes pjEntra { from { opacity: 0 } to { opacity: 1 } }
  #personaje .pj-marco { width: min(860px, 94vw); max-height: 92vh; display: grid;
    grid-template-columns: 300px 1fr; gap: 1.6rem;
    background: rgba(18,21,19,.96); border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 1.4rem 1.6rem 1.2rem; }
  #personaje h2 { font-size: 1.05rem; font-weight: 500; letter-spacing: .04em; }
  #personaje .pj-sub { font-size: .72rem; color: var(--tinta-tenue); line-height: 1.55;
    margin: .25rem 0 .9rem; }
  #personaje .pj-vista { display: flex; flex-direction: column; }
  #personaje canvas { width: 300px; height: 380px; border-radius: 3px;
    background: linear-gradient(180deg, #26302b, #12160f); display: block; }
  #personaje .pj-resumen { font-size: .72rem; color: var(--tinta-tenue); text-align: center;
    margin-top: .6rem; font-variant-numeric: tabular-nums; }
  #personaje .pj-campos { overflow: auto; padding-right: .3rem; }
  #personaje h3 { font-size: .62rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--tinta-tenue); margin: .95rem 0 .4rem; }
  #personaje h3:first-child { margin-top: 0; }
  #personaje .pj-fila { display: flex; align-items: center; gap: .7rem; font-size: .76rem; }
  #personaje input[type=range] { flex: 1; accent-color: #7f9f74; }
  #personaje .pj-valor { color: var(--tinta-tenue); font-size: .72rem; min-width: 4.2rem;
    text-align: right; font-variant-numeric: tabular-nums; }
  #personaje .pj-grupo { display: flex; flex-wrap: wrap; gap: .3rem; }
  #personaje button { background: rgba(255,255,255,.06); color: var(--tinta);
    border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
    padding: .26rem .7rem; font: inherit; font-size: .72rem; cursor: pointer; }
  #personaje button:hover { background: rgba(255,255,255,.13); }
  #personaje button.activo { background: rgba(127,159,116,.26); border-color: rgba(127,159,116,.62); }
  #personaje .pj-color { width: 1.55rem; height: 1.55rem; padding: 0; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.14); }
  #personaje .pj-color.activo { border-color: #9ed3a6; box-shadow: 0 0 0 2px rgba(127,159,116,.3); }
  #personaje .pj-pie { grid-column: 1 / -1; display: flex; align-items: center; gap: .7rem;
    border-top: 1px solid rgba(255,255,255,.08); padding-top: .8rem; margin-top: .2rem; }
  #personaje .pj-nota { flex: 1; font-size: .67rem; color: var(--tinta-tenue); line-height: 1.5; }
  #personaje .pj-listo { background: rgba(127,159,116,.28); border-color: rgba(127,159,116,.6);
    padding: .45rem 1.4rem; font-size: .78rem; }
  @media (max-width: 720px) {
    #personaje .pj-marco { grid-template-columns: 1fr; }
    #personaje canvas { width: 100%; height: 240px; }
  }
`;

export class Personaje {
  /**
   * @param {object} deps {aspecto} el aspecto vigente, que se edita sobre una copia
   */
  constructor({ aspecto } = {}) {
    this.aspecto = aspecto || new Aspecto();
    this.abierto = false;
    this._resolver = null;
    this._crear();
  }

  // ── Interfaz ──────────────────────────────────────────────────────────────

  _crear() {
    const el = document.createElement('div');
    el.id = 'personaje';
    el.innerHTML = `<div class="pj-marco">
      <div class="pj-vista">
        <canvas id="pj-lienzo" width="600" height="760"></canvas>
        <p class="pj-resumen" id="pj-resumen"></p>
      </div>
      <div>
        <h2>Antes de entrar al parque</h2>
        <p class="pj-sub">Elegí a quién le va a pasar todo esto. Nada de lo que
          elijas te hace mejor ni peor sobreviviendo: lo único que cambia el juego
          es la estatura, porque cambia desde qué altura mirás el bosque. Lo que
          se lleva puesto —gorros, abrigo, herramientas— no se elige acá: se
          consigue en el parque.</p>
        <div class="pj-campos" id="pj-campos"></div>
      </div>
      <div class="pj-pie">
        <button data-accion="azar">Al azar</button>
        <span class="pj-nota">Vas a poder cambiarlo cuando quieras, desde el panel
          del juego (Escape → Aspecto).</span>
        <button class="pj-listo" data-accion="listo">Entrar al parque</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
    this.lienzo = el.querySelector('#pj-lienzo');

    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.accion === 'azar') { this.borrador.alAzar(); this._refrescar(); return; }
      if (b.dataset.accion === 'listo') { this.aceptar(); return; }
      // Elección simple: campo + índice
      if (!b.dataset.campo) return;
      this.borrador[b.dataset.campo] = parseInt(b.dataset.valor, 10);
      this._refrescar();
    });
    el.addEventListener('input', (ev) => {
      const r = ev.target.closest('input[data-campo]');
      if (!r) return;
      this.borrador[r.dataset.campo] = parseFloat(r.value);
      this._refrescar(true);   // la estatura no obliga a rehacer las listas
    });
    // Enter acepta: es la tecla que uno aprieta cuando ya decidió
    this._alTeclado = (ev) => {
      if (!this.abierto) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); this.aceptar(); }
    };
    addEventListener('keydown', this._alTeclado);
  }

  _colores(campo, tabla) {
    return `<div class="pj-grupo">` + tabla.map((o, i) =>
      `<button class="pj-color ${this.borrador[campo] === i ? 'activo' : ''}"
        data-campo="${campo}" data-valor="${i}" title="${o.nombre}"
        style="background:#${o.color.toString(16).padStart(6, '0')}"></button>`).join('')
      + `</div>`;
  }

  _opciones(campo, tabla) {
    return `<div class="pj-grupo">` + tabla.map((o, i) =>
      `<button class="${this.borrador[campo] === i ? 'activo' : ''}"
        data-campo="${campo}" data-valor="${i}">${o.nombre}</button>`).join('') + `</div>`;
  }

  _pintar() {
    const a = this.borrador;
    this.el.querySelector('#pj-campos').innerHTML = `
      <h3>Cuerpo</h3>
      <div class="pj-fila"><span>Estatura</span>
        <input type="range" data-campo="estatura" min="${ESTATURA_MIN}" max="${ESTATURA_MAX}"
          step="0.01" value="${a.estatura}">
        <span class="pj-valor" id="pj-estatura">${a.estatura.toFixed(2).replace('.', ',')} m</span></div>
      <div class="pj-fila" style="margin-top:.45rem">${this._opciones('complexion', COMPLEXIONES)}</div>
      <h3>Piel</h3>${this._colores('piel', PIELES)}
      <h3>Pelo</h3>${this._colores('pelo', PELOS)}
      <div style="margin-top:.4rem">${this._opciones('peinado', PEINADOS)}</div>
      <h3>Campera</h3>${this._colores('campera', CAMPERAS)}
      <h3>Pantalón</h3>${this._colores('pantalon', PANTALONES)}`;
    this.el.querySelector('#pj-resumen').textContent = a.resumen;
  }

  /**
   * @param {boolean} [soloModelo] true cuando el cambio vino de un deslizador: si
   *        se repintan las listas mientras se arrastra, el navegador reemplaza el
   *        propio deslizador y el arrastre se corta en el primer movimiento.
   */
  _refrescar(soloModelo) {
    this.cuerpo?.aplicar(this.borrador);
    if (soloModelo) {
      this.el.querySelector('#pj-estatura').textContent =
        `${this.borrador.estatura.toFixed(2).replace('.', ',')} m`;
      this.el.querySelector('#pj-resumen').textContent = this.borrador.resumen;
    } else {
      this._pintar();
    }
  }

  // ── Vista previa ──────────────────────────────────────────────────────────

  _armarEscena() {
    this.render3d = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true, alpha: true });
    this.render3d.setPixelRatio(Math.min(devicePixelRatio, 2));
    const ancho = this.lienzo.clientWidth || 300, alto = this.lienzo.clientHeight || 380;
    this.render3d.setSize(ancho, alto, false);
    this.render3d.shadowMap.enabled = true;
    this.render3d.shadowMap.type = THREE.PCFSoftShadowMap;
    this.render3d.toneMapping = THREE.ACESFilmicToneMapping;
    this.render3d.outputColorSpace = THREE.SRGBColorSpace;

    const escena = new THREE.Scene();
    // Luz de tarde patagónica: rasante, fría del lado del cielo
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.6);
    sol.position.set(2.4, 3.6, 2.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.left = -1.6; sol.shadow.camera.right = 1.6;
    sol.shadow.camera.top = 2.6; sol.shadow.camera.bottom = -0.2;
    escena.add(sol);
    escena.add(new THREE.HemisphereLight(0x9fc0d8, 0x3a3a2c, 1.05));
    const contra = new THREE.DirectionalLight(0x9fc6e0, 0.7);
    contra.position.set(-2.5, 1.4, -2.2);
    escena.add(contra);

    // Un disco de suelo, sólo para que la sombra tenga dónde caer
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x3c4436, roughness: 1 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escena.add(suelo);

    this.cuerpo = new Cuerpo(this.borrador);
    escena.add(this.cuerpo.grupo);

    this.escena3d = escena;
    this.camara3d = new THREE.PerspectiveCamera(34, ancho / alto, 0.1, 40);
    this.camara3d.position.set(0, 1.15, 3.5);
    this.camara3d.lookAt(0, 0.95, 0);

    // Un jugador de mentira: camina en el lugar, a paso tranquilo
    this._maniqui = {
      posicion: new THREE.Vector3(),
      velocidad: new THREE.Vector3(1.1, 0, 0),
      giro: 0, cabeceo: 0, enSuelo: true, enAgua: false,
      agachado: false, tercerPersona: true,
    };
  }

  _bucle = () => {
    if (!this.abierto) return;
    this._rafId = requestAnimationFrame(this._bucle);
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - (this._ultimo || ahora)) / 1000);
    this._ultimo = ahora;
    // Gira despacio para que se vea de todos lados sin tener que arrastrar nada
    this._maniqui.giro += dt * 0.42;
    this.cuerpo.actualizar(dt, this._maniqui);
    this.render3d.render(this.escena3d, this.camara3d);
  };

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  /**
   * Abre el panel y devuelve una promesa con el aspecto elegido, ya guardado.
   * Se edita sobre una copia: si la pantalla se cierra sin aceptar, el aspecto
   * vigente queda intacto.
   */
  abrir() {
    if (this.abierto) return this._promesa;
    this.borrador = this.aspecto.clonar();
    this.abierto = true;
    this.el.classList.add('abierto');
    document.exitPointerLock?.();
    this._pintar();
    this._armarEscena();
    this._ultimo = 0;
    this._bucle();
    this._promesa = new Promise(r => { this._resolver = r; });
    return this._promesa;
  }

  /** Confirma la elección: se guarda y se cierra. */
  aceptar() {
    if (!this.abierto) return;
    this.aspecto.asignar(this.borrador.datos()).guardar();
    const resolver = this._resolver;
    this._cerrar();
    resolver?.(this.aspecto);
  }

  _cerrar() {
    this.abierto = false;
    this._resolver = null;
    this.el.classList.remove('abierto');
    cancelAnimationFrame(this._rafId);
    // Liberar el contexto: dejar vivo un segundo WebGL toda la partida es
    // memoria de la placa regalada, y hay navegadores que sólo dan dieciséis.
    this.cuerpo?.destruir();
    this.render3d?.dispose();
    this.render3d?.forceContextLoss?.();
    this.render3d = null;
    this.escena3d = null;
    this.cuerpo = null;
  }
}
