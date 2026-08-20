/**
 * Calidad — presets de rendimiento con detección y gobernador adaptativo.
 *
 * Este archivo existe por un error de método que conviene dejar escrito: el
 * juego se desarrolló verificando capturas fijas, nunca un cuadro corriendo. Las
 * capturas dicen si algo se dibuja bien; no dicen si el juego anda. Cuando por
 * fin se midió con consultas de tiempo de GPU sobre la placa de destino real
 * —una Intel HD Graphics 4000, de 2012— el cuadro tardaba 504 ms. Dos cuadros
 * por segundo.
 *
 * De ahí salen dos conclusiones que gobiernan este módulo:
 *
 * 1. **La resolución es la palanca más grande.** El costo de casi todo lo caro
 *    —oclusión, resplandor, atmósfera, el propio terreno— es por píxel. Correr a
 *    `devicePixelRatio` 2 en una placa integrada es pedirle cuatro veces el
 *    trabajo que puede hacer.
 * 2. **No se puede elegir por el jugador desde otra máquina.** Lo honesto es
 *    detectar, medir en marcha y ajustar solo, dejando siempre la puerta abierta
 *    a que el jugador decida a mano.
 */

/**
 * De más a menos. Cada preset dice qué resolución usar y qué apagar; los
 * factores de instancias recortan pasto y árboles sin tocar sus sistemas.
 */
export const PRESETS = [
  {
    id: 'alta', nombre: 'Alta',
    escala: 1.0, maxPixelRatio: 2,
    sombras: true, mapaSombra: 2048, alcanceSombra: 900,
    oclusion: true, divisorOclusion: 2,
    resplandor: true, suavizado: true, correccionColor: true,
    vegetacion: 1.0, sotobosque: 1.0, vista: 90000,
  },
  {
    id: 'media', nombre: 'Media',
    escala: 1.0, maxPixelRatio: 1.25,
    sombras: true, mapaSombra: 1024, alcanceSombra: 600,
    oclusion: true, divisorOclusion: 2,
    resplandor: true, suavizado: true, correccionColor: true,
    vegetacion: 0.8, sotobosque: 0.7, vista: 70000,
  },
  {
    id: 'baja', nombre: 'Baja',
    escala: 0.8, maxPixelRatio: 1,
    sombras: true, mapaSombra: 512, alcanceSombra: 320,
    oclusion: false, divisorOclusion: 3,
    resplandor: false, suavizado: true, correccionColor: true,
    vegetacion: 0.55, sotobosque: 0.45, vista: 55000,
  },
  {
    id: 'minima', nombre: 'Mínima',
    escala: 0.6, maxPixelRatio: 1,
    sombras: false, mapaSombra: 512, alcanceSombra: 200,
    oclusion: false, divisorOclusion: 4,
    resplandor: false, suavizado: false, correccionColor: true,
    vegetacion: 0.35, sotobosque: 0.25, vista: 45000,
  },
];

/**
 * Placas que arrancan abajo. No es una lista de marcas "malas": son familias
 * integradas o móviles donde empezar en alta significa que el jugador ve dos
 * cuadros por segundo y cierra la pestaña antes de encontrar el menú.
 */
function nivelSegunPlaca(cadena) {
  const g = (cadena || '').toLowerCase();
  if (/swiftshader|llvmpipe|software/.test(g)) return 3;
  // Las HD 2000/3000/4000/4400/4600 y las Mali/Adreno viejas no dan para más
  if (/intel.*(hd graphics (2|3|4|5)\d{3}|hd graphics [234]000)/.test(g)) return 2;
  if (/mali-[t4-6]|adreno \(tm\) [345]/.test(g)) return 3;
  if (/intel.*(uhd|iris|hd graphics)/.test(g)) return 1;
  if (/apple m[1-9]|radeon|geforce|rtx|gtx|arc/.test(g)) return 0;
  return 1;
}

export class Calidad {
  /**
   * @param {object} ctx {render, compositor, camara, csm, escena, oclusion,
   *                      color, resplandor, suavizado, vegetacion, sotobosque}
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.nivel = 1;
    this.automatico = true;
    this.alCambiar = null;

    // Medición del cuadro: media móvil, para no reaccionar a un tirón suelto
    this.msSuave = 16;
    this._desdeCambio = 0;
    this._objetivoFps = 30;

    const gl = ctx.render.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    this.placa = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'desconocida';
    this.nivelDetectado = nivelSegunPlaca(this.placa);
  }

  get preset() { return PRESETS[this.nivel]; }

  /** Aplica el preset actual a todo lo que se pueda cambiar en caliente. */
  aplicar(ancho = innerWidth, alto = innerHeight) {
    const p = this.preset;
    const { render, compositor, camara, csm, oclusion, color, resplandor, suavizado } = this.ctx;

    // ── Resolución. La palanca grande.
    const pr = Math.min(devicePixelRatio, p.maxPixelRatio) * p.escala;
    render.setPixelRatio(pr);
    render.setSize(ancho, alto);
    compositor.setPixelRatio(pr);
    compositor.setSize(ancho, alto);
    oclusion?.setSize(ancho * pr, alto * pr);

    // ── Sombras
    render.shadowMap.enabled = p.sombras;
    if (csm) {
      csm.maxFar = p.alcanceSombra;
      for (const luz of csm.lights) {
        if (luz.shadow.mapSize.x !== p.mapaSombra) {
          luz.shadow.mapSize.set(p.mapaSombra, p.mapaSombra);
          // Forzar que three recree el mapa con el tamaño nuevo
          luz.shadow.map?.dispose();
          luz.shadow.map = null;
        }
      }
      csm.updateFrustums();
    }

    // ── Posproceso
    if (oclusion) oclusion.enabled = p.oclusion;
    if (color) color.enabled = p.correccionColor;
    if (resplandor) resplandor.enabled = p.resplandor;
    if (suavizado) suavizado.enabled = p.suavizado;

    // ── Distancia de vista
    if (camara) {
      camara.far = p.vista;
      camara.updateProjectionMatrix();
    }

    this._desdeCambio = 0;
    this.alCambiar?.(p);
    return p;
  }

  /**
   * Recorte de instancias. Se aplica DESPUÉS de que cada sistema actualice sus
   * lotes, porque ellos reescriben `count` en cada cuadro. Es un recorte tosco
   * —se dibujan menos matas de las sembradas— pero no toca la lógica de siembra
   * y se puede subir y bajar en caliente.
   */
  recortarInstancias() {
    const p = this.preset;
    if (p.sotobosque < 1 && this.ctx.sotobosque) {
      for (const lote of this.ctx.sotobosque.lotes) {
        lote.malla.count = Math.floor(lote.malla.count * p.sotobosque);
      }
    }
    if (p.vegetacion < 1 && this.ctx.vegetacion) {
      for (const lote of this.ctx.vegetacion.lotes) {
        lote.malla.count = Math.floor(lote.malla.count * p.vegetacion);
      }
    }
  }

  /**
   * Gobernador: mide el cuadro y baja de nivel si no llega al objetivo, o sube
   * si sobra margen. Con histéresis y un tiempo de gracia, porque cambiar de
   * preset cuesta —recrear mapas de sombra, redimensionar objetivos— y oscilar
   * entre dos niveles se vería peor que quedarse en el bajo.
   */
  gobernar(dt) {
    if (!this.automatico) return;
    const ms = Math.min(dt * 1000, 500);
    this.msSuave += (ms - this.msSuave) * 0.05;
    this._desdeCambio += dt;
    if (this._desdeCambio < 4) return;    // gracia tras un cambio

    const fps = 1000 / this.msSuave;
    if (fps < this._objetivoFps * 0.8 && this.nivel < PRESETS.length - 1) {
      this.nivel++;
      this.aplicar();
    } else if (fps > this._objetivoFps * 1.9 && this.nivel > 0) {
      // Para subir hace falta mucho margen: es mejor sobrar que oscilar
      this.nivel--;
      this.aplicar();
    }
  }

  /** Cambio a mano: apaga el gobernador, porque el jugador ya decidió. */
  elegir(nivel) {
    this.nivel = Math.max(0, Math.min(PRESETS.length - 1, nivel));
    this.automatico = false;
    return this.aplicar();
  }

  siguiente() { return this.elegir((this.nivel + 1) % PRESETS.length); }

  get resumen() {
    return `${this.preset.nombre} · ${(1000 / this.msSuave).toFixed(0)} fps`;
  }
}
