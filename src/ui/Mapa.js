/**
 * Mapa — carta topográfica del parque, dibujada con el relieve de verdad.
 *
 * No es una ilustración: se dibuja píxel por píxel a partir del mismo modelo de
 * elevación que pisa el jugador. El sombreado es un relieve iluminado desde el
 * noroeste —la convención cartográfica—, las curvas de nivel salen cada 200 m,
 * los lagos y los cauces de las máscaras del terreno, y la nieve de la cota del
 * día. Si el mapa dice que hay un filo, hay un filo.
 *
 * Y arranca en blanco. Lo que no se recorrió no está: se revela a medida que se
 * conoce, con el alcance que da la altura desde donde se mira. Por eso subir a
 * un mirador abre medio parque de golpe, que es exactamente para lo que sirve
 * subir a un mirador.
 */

const CSS = `
  #mapa { position: fixed; inset: 0; z-index: 70; display: none;
    background: rgba(8,10,9,.86); backdrop-filter: blur(4px); color: var(--tinta); }
  #mapa.abierto { display: grid; place-items: center; }
  #mapa .mp-marco { width: min(88vh, 92vw); }
  #mapa .mp-cab { display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: .5rem; }
  #mapa h2 { font-size: .95rem; font-weight: 500; letter-spacing: .04em; }
  #mapa .mp-dato { font-size: .7rem; color: var(--tinta-tenue); }
  #mapa .mp-lienzo { position: relative; width: 100%; aspect-ratio: 1;
    border: 1px solid rgba(255,255,255,.12); border-radius: 3px; overflow: hidden;
    background: #0d0f0e; }
  #mapa canvas { width: 100%; height: 100%; display: block; image-rendering: auto; }
  #mapa .mp-pie { margin-top: .5rem; font-size: .68rem; color: var(--tinta-tenue);
    display: flex; justify-content: space-between; }
`;

const LADO = 640;                 // píxeles del lienzo

export class Mapa {
  /**
   * @param {object} deps {mundo, jugador, tiempo, exploracion, codice}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.abierto = false;
    this._relieveListo = false;
    this._crear();
  }

  _crear() {
    const el = document.createElement('div');
    el.id = 'mapa';
    el.innerHTML = `<div class="mp-marco">
      <div class="mp-cab">
        <h2>Parque Nacional Nahuel Huapi</h2>
        <span class="mp-dato" id="mp-explorado"></span>
      </div>
      <div class="mp-lienzo"><canvas id="mp-canvas" width="${LADO}" height="${LADO}"></canvas></div>
      <div class="mp-pie">
        <span>Curvas de nivel cada 200 m · relieve real del SRTM</span>
        <span><b>M</b> cierra</span>
      </div>
    </div>`;
    document.body.appendChild(el);
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);
    this.el = el;
    this.lienzo = el.querySelector('#mp-canvas');
    this.ctx = this.lienzo.getContext('2d');
  }

  /**
   * Dibuja el relieve una sola vez y lo guarda: es caro —410.000 píxeles con
   * cuatro lecturas de altura cada uno— y no cambia nunca. Lo que cambia cada
   * vez que se abre el mapa es el velo de lo desconocido, que va aparte.
   */
  _construirRelieve() {
    const m = this.mundo;
    const img = this.ctx.createImageData(LADO, LADO);
    const d = img.data;
    const paso = m.tamano / LADO;

    for (let py = 0; py < LADO; py++) {
      for (let px = 0; px < LADO; px++) {
        const x = -m.mitad + (px + 0.5) * paso;
        const z = -m.mitad + (py + 0.5) * paso;
        const h = m.alturaEn(x, z);
        const k = (py * LADO + px) * 4;

        if (m.esAgua(x, z)) {
          // Lagos: azul de agua glaciaria, más oscuro donde es más hondo
          d[k] = 38; d[k + 1] = 62; d[k + 2] = 84; d[k + 3] = 255;
          continue;
        }

        // Sombreado: luz desde el noroeste, como manda la convención
        const hx = m.alturaEn(x + paso, z) - m.alturaEn(x - paso, z);
        const hz = m.alturaEn(x, z + paso) - m.alturaEn(x, z - paso);
        // El sombreado modula, no apaga: por debajo de 0,55 la carta se vuelve
        // ilegible, que es lo contrario de para lo que sirve un mapa.
        const luz = Math.max(0.55, Math.min(1.25, 0.85 + (hx * 0.7 + hz * 0.7) / (paso * 1.6)));

        // Color por altura: verde del bosque, ocre de la estepa alta, gris de
        // la roca, blanco de la nieve
        const t = Math.max(0, Math.min(1, (h - 750) / 1900));
        let r, g, b;
        if (t < 0.35) { r = 74 + t * 90; g = 96 + t * 60; b = 58 + t * 40; }
        else if (t < 0.62) { r = 118 + (t - 0.35) * 130; g = 118 + (t - 0.35) * 90; b = 82 + (t - 0.35) * 70; }
        else if (t < 0.82) { r = 132 + (t - 0.62) * 180; g = 128 + (t - 0.62) * 180; b = 120 + (t - 0.62) * 190; }
        else { r = 226; g = 232; b = 240; }

        // Curva de nivel cada 200 m
        const enCurva = Math.abs((h % 200) - 100) > 96;
        const f = luz * (enCurva ? 0.74 : 1);

        d[k] = r * f; d[k + 1] = g * f; d[k + 2] = b * f; d[k + 3] = 255;
      }
    }

    const fuera = document.createElement('canvas');
    fuera.width = fuera.height = LADO;
    fuera.getContext('2d').putImageData(img, 0, 0);
    this._relieve = fuera;
    this._relieveListo = true;
  }

  _aPixel(x, z) {
    const m = this.mundo;
    return {
      px: (x + m.mitad) / m.tamano * LADO,
      py: (z + m.mitad) / m.tamano * LADO,
    };
  }

  dibujar() {
    if (!this._relieveListo) this._construirRelieve();
    const c = this.ctx;
    c.clearRect(0, 0, LADO, LADO);

    // 1) El relieve, recortado por lo que se conoce
    c.drawImage(this._relieve, 0, 0);

    // 2) El velo. Se dibuja encima con la grilla de exploración escalada, y el
    //    suavizado del navegador se encarga de que el borde no sea un damero.
    const ex = this.exploracion;
    const n = ex.celdas;
    const velo = document.createElement('canvas');
    velo.width = velo.height = n;
    const vc = velo.getContext('2d');
    const img = vc.createImageData(n, n);
    for (let k = 0; k < n * n; k++) {
      const conocido = ex.conocido[k] / 255;
      // Lo desconocido es negro, no una sombra: si el relieve se transparenta,
      // el mapa ya está revelado y explorar no significa nada.
      img.data[k * 4] = 9;
      img.data[k * 4 + 1] = 11;
      img.data[k * 4 + 2] = 10;
      img.data[k * 4 + 3] = Math.round(Math.pow(1 - conocido, 0.7) * 255);
    }
    vc.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(velo, 0, 0, LADO, LADO);

    // 3) Lugares descubiertos
    c.font = '10px system-ui, sans-serif';
    c.textBaseline = 'middle';
    for (const l of this.codice?.listaLugares || []) {
      if (!this.codice.lugares.has(l.id)) continue;
      const { px, py } = this._aPixel(l.x, l.z);
      c.fillStyle = 'rgba(226,214,180,.92)';
      c.beginPath(); c.arc(px, py, 2.6, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(226,214,180,.72)';
      c.fillText(l.nombre, px + 5, py);
    }

    // 4) El jugador, con hacia dónde mira
    const p = this.jugador.posicion;
    const { px, py } = this._aPixel(p.x, p.z);
    const rumbo = -this.jugador.giro + Math.PI;
    c.save();
    c.translate(px, py);
    c.rotate(rumbo);
    c.fillStyle = '#d8643f';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5);
    c.closePath(); c.fill();
    c.restore();

    const geo = this.mundo.aLatLon(p.x, p.z);
    this.el.querySelector('#mp-explorado').textContent =
      `${(ex.fraccionExplorada * 100).toFixed(1)} % explorado · ` +
      `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} · ${Math.round(p.y)} m`;
  }

  alternar() {
    this.abierto = !this.abierto;
    this.el.classList.toggle('abierto', this.abierto);
    if (this.abierto) {
      this.dibujar();
      document.exitPointerLock?.();
    }
  }
}
