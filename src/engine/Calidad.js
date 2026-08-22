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

import * as THREE from 'three';

/**
 * El filtro de sombra, que es el eje que a los presets les faltaba.
 *
 * Los cuatro presets movían cinco palancas por píxel —escala, pixelRatio,
 * oclusión, resplandor, suavizado— y ninguna tocaba lo que cuesta RECIBIR la
 * sombra, que es de los rubros más caros del cuadro. Medido en la placa de
 * destino: 12,3 ms de 90, sólo en el filtro.
 *
 * `PCFSoftShadowMap` hace dieciséis lecturas de textura por píxel, y como los
 * mapas de three van empaquetados en RGBA, cada una es un texture2D completo
 * más un desempaquetado: no hay comparación por hardware que ayude.
 * `PCFShadowMap` hace nueve. El borde queda un punto más duro y en una placa de
 * 2012 eso es un precio que vale la pena.
 */
const TIPO_SOMBRA = {
  suave: THREE.PCFSoftShadowMap,
  media: THREE.PCFShadowMap,
  dura: THREE.BasicShadowMap,
};

/**
 * De más a menos. Cada preset dice qué resolución usar y qué apagar; los
 * factores de instancias recortan pasto y árboles sin tocar sus sistemas.
 */
export const PRESETS = [
  {
    id: 'alta', nombre: 'Alta',
    escala: 1.0, maxPixelRatio: 2,
    sombras: true, mapaSombra: 2048, alcanceSombra: 900, tipoSombra: 'suave',
    oclusion: true, divisorOclusion: 2,
    resplandor: true, suavizado: true, correccionColor: true,
    vegetacion: 1.0, sotobosque: 1.0, vista: 90000,
    reflejoAgua: 0.5,
  },
  {
    id: 'media', nombre: 'Media',
    escala: 1.0, maxPixelRatio: 1.25,
    sombras: true, mapaSombra: 1024, alcanceSombra: 600, tipoSombra: 'suave',
    oclusion: true, divisorOclusion: 2,
    resplandor: true, suavizado: true, correccionColor: true,
    vegetacion: 0.8, sotobosque: 0.7, vista: 70000,
    reflejoAgua: 0.35,
  },
  {
    id: 'baja', nombre: 'Baja',
    escala: 0.8, maxPixelRatio: 1,
    sombras: true, mapaSombra: 512, alcanceSombra: 320, tipoSombra: 'media',
    oclusion: false, divisorOclusion: 3,
    resplandor: false, suavizado: true, correccionColor: true,
    vegetacion: 0.55, sotobosque: 0.45, vista: 55000,
    reflejoAgua: 0,
  },
  {
    id: 'minima', nombre: 'Mínima',
    escala: 0.6, maxPixelRatio: 1,
    sombras: false, mapaSombra: 512, alcanceSombra: 200, tipoSombra: 'dura',
    oclusion: false, divisorOclusion: 4,
    resplandor: false, suavizado: false, correccionColor: true,
    vegetacion: 0.35, sotobosque: 0.25, vista: 45000,
    reflejoAgua: 0,
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

  /**
   * Cambiar el tamaño de un objetivo NO cambia el de su textura de profundidad.
   * Quedan descolgadas —el color a 617 y la profundidad a 772— y el resultado es
   * que el objetivo deja de estar completo: el navegador no lanza una excepción,
   * simplemente deja de dibujar. Fue la causa de que cambiar la calidad
   * "no hiciera nada": no es que no cambiara, es que después no se dibujaba más.
   */
  _ajustarProfundidad(objetivo, ancho, alto) {
    if (!objetivo?.depthTexture) return;
    objetivo.depthTexture.dispose();
    objetivo.depthTexture = new THREE.DepthTexture(ancho, alto, THREE.FloatType);
  }

  /** Aplica el preset actual a todo lo que se pueda cambiar en caliente. */
  aplicar(ancho = innerWidth, alto = innerHeight) {
    const p = this.preset;
    const { render, compositor, camara, csm, oclusion, color, resplandor, suavizado } = this.ctx;

    // ── Resolución. La palanca grande.
    //
    // Se dibuja a una resolución interna entera y el lienzo se estira por CSS a
    // toda la ventana. Con `setPixelRatio` fraccionario los objetivos quedaban
    // en 617,6 × 590,4 píxeles, que no existen: WebGL trabaja en enteros y el
    // desajuste rompía el muestreo de la oclusión.
    const escalaTotal = Math.min(devicePixelRatio, p.maxPixelRatio) * p.escala;
    const anchoPx = Math.max(64, Math.round(ancho * escalaTotal));
    const altoPx = Math.max(64, Math.round(alto * escalaTotal));
    this.anchoPx = anchoPx;
    this.altoPx = altoPx;

    render.setPixelRatio(1);
    render.setSize(anchoPx, altoPx, false);   // false: no tocar el CSS del lienzo
    // El lienzo se muestra siempre a ventana completa y el navegador estira lo
    // que se dibujó adentro. Si quedara el tamaño en píxeles metido en el
    // atributo de estilo, bajar la calidad encogería la imagen en una esquina.
    render.domElement.style.width = '100vw';
    render.domElement.style.height = '100vh';
    compositor.setPixelRatio(1);
    compositor.setSize(anchoPx, altoPx);
    this._ajustarProfundidad(compositor.renderTarget1, anchoPx, altoPx);
    this._ajustarProfundidad(compositor.renderTarget2, anchoPx, altoPx);
    oclusion?.setSize(anchoPx, altoPx);

    // ── Sombras
    render.shadowMap.enabled = p.sombras;
    // Cambiar el tipo de filtro entra en la clave de caché del programa, así que
    // obliga a recompilar todos los materiales: unos cuarenta shaders, que en la
    // placa de destino es un tirón de varios cientos de milisegundos. Sólo se
    // hace cuando de verdad cambia, no en cada `aplicar()`.
    const tipoNuevo = TIPO_SOMBRA[p.tipoSombra] ?? THREE.PCFSoftShadowMap;
    if (render.shadowMap.type !== tipoNuevo) {
      render.shadowMap.type = tipoNuevo;
      this.ctx.escena?.traverse(o => {
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
        }
      });
    }
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
    if (suavizado) {
      suavizado.enabled = p.suavizado;
      // El FXAA necesita saber cuánto mide un texel, y esto vivía en el callback
      // `alCambiar`, o sea que dependía de que quien usara Calidad se acordara de
      // cablearlo. Cualquier camino que cambie el tamaño sin pasar por ahí deja
      // al suavizado muestreando con el texel corrido, y eso no se ve como
      // aliasing: se ve como un halo alrededor de todo lo que tiene borde
      // recortado, o sea alrededor de cada copa del bosque.
      suavizado.material?.uniforms?.resolution?.value.set(1 / anchoPx, 1 / altoPx);
    }

    // ── Reflejo del agua. El espejo planar dibuja la escena una segunda vez,
    // así que abajo se apaga entero y arriba se dibuja a media resolución.
    this.ctx.agua?.prepararReflejo(render, p.reflejoAgua);

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
   * Recorte de instancias.
   *
   * Acá vivía la causa de que "los árboles aparezcan y desaparezcan". El
   * recorte multiplicaba `malla.count` por el factor del preset en CADA cuadro,
   * dando por sentado que los sistemas reescriben `count` siempre. No lo hacen:
   * la vegetación sólo resiembra cuando el jugador cambia de celda (96 m) y el
   * sotobosque sólo publica mientras le queda cola. En los cuadros del medio el
   * factor se aplicaba sobre un valor ya recortado y la cuenta caía en
   * progresión geométrica hasta cero —medido: 15.037 matas a 414 en diez
   * cuadros con el factor 0,7— para volver de golpe en la siguiente resiembra.
   * Eso es el parpadeo: no se veía un árbol entrar y salir, se veía el bosque
   * entero evaporarse y reaparecer cada vez que se cruzaba una celda.
   *
   * La cuenta se deriva ahora del total sembrado, `lote.n`, que es el dato
   * autorizado y no se toca. Así el recorte es idempotente: aplicarlo mil veces
   * da lo mismo que aplicarlo una.
   *
   * Y como los dos sistemas ordenan sus instancias de cerca a lejos, cortar por
   * el final significa siempre soltar las más lejanas —las que menos se notan—
   * en vez de un conjunto arbitrario que cambia de identidad en cada resiembra.
   */
  recortarInstancias() {
    const p = this.preset;
    if (this.ctx.sotobosque) {
      for (const lote of this.ctx.sotobosque.lotes) {
        lote.malla.count = Math.floor(lote.n * p.sotobosque);
      }
    }
    if (this.ctx.vegetacion) {
      for (const lote of this.ctx.vegetacion.lotes) {
        lote.malla.count = Math.floor(lote.n * p.vegetacion);
        if (lote.impostor) {
          lote.impostor.malla.count = Math.floor(lote.impostor.n * p.vegetacion);
        }
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
      // Si venimos de subir hace poco, el nivel de arriba queda marcado como
      // techo. Sin esto el gobernador probaba, no daba, bajaba, volvía a
      // sobrarle margen y probaba de nuevo, en un ciclo de ocho segundos; y
      // como cada preset cambia el factor de recorte y la distancia de vista,
      // cada vuelta del ciclo se veía como una tanda de árboles que entra y
      // sale. Un techo que sólo baja corta la oscilación de raíz.
      if (this._subioEn != null && this._desdeCambio < 20) this._techo = this.nivel + 1;
      this._subioEn = null;
      this.nivel++;
      this.aplicar();
    } else if (fps > this._objetivoFps * 1.9 && this.nivel > 0 && this.nivel > (this._techo ?? 0)) {
      // Para subir hace falta mucho margen: es mejor sobrar que oscilar
      this.nivel--;
      this._subioEn = true;
      this.aplicar();
    }
  }

  /** Cambio a mano: apaga el gobernador, porque el jugador ya decidió. */
  elegir(nivel) {
    this.nivel = Math.max(0, Math.min(PRESETS.length - 1, nivel));
    this.automatico = false;
    // El techo era del gobernador; si el jugador elige, deja de aplicar.
    this._techo = null;
    this._subioEn = null;
    return this.aplicar();
  }

  siguiente() { return this.elegir((this.nivel + 1) % PRESETS.length); }

  get resumen() {
    return `${this.preset.nombre} · ${(1000 / this.msSuave).toFixed(0)} fps`;
  }
}
