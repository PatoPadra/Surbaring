/**
 * BANCO DE LA FASE 3 (flora) — ronda 3.
 *
 * Lo escribe el JEFE, no el agente. Regla 1 de RONDA3.md: quien escribe el
 * arreglo no puede escribir el banco que lo mide. Escrito EN PARALELO al agente
 * y contra el contrato del encargo, sin leer su implementación ni su informe.
 *
 * ── Cómo mide ────────────────────────────────────────────────────────────────
 * No lee el código con expresiones regulares: **corre `Vegetacion.js` y
 * `Sotobosque.js` de verdad en Node**, con tres piezas de andamiaje:
 *
 *   1. Un **rasterizador 2D propio** que hace de `CanvasRenderingContext2D`.
 *      `atlasFollaje()` dibuja su atlas con un lienzo del navegador, que en Node
 *      no existe; en vez de un stub que traga llamadas y no dibuja nada —lo que
 *      daría verde por vacío, la trampa nº 8— acá se pintan los píxeles de
 *      verdad y después se los mide. Si el código llama a una operación que el
 *      rasterizador no implementa, el banco **no la ignora**: la anota y se pone
 *      rojo, porque un atlas que no se pudo pintar entero no se puede medir.
 *   2. Un **renderizador espía** que hace de `WebGLRenderer` para
 *      `hornearImpostor()`: cuenta objetivos de render, sus dimensiones, si
 *      generan mipmaps, y cuántas vistas se hornean de verdad. De ahí sale la
 *      cuenta de VRAM que `RONDA3.md` pide y que nunca existió.
 *   3. Un **shader falso** con los `#include` de three, para que
 *      `onBeforeCompile` inyecte sobre él y se pueda contar cuántas lecturas de
 *      textura y cuánta ALU se agregan **por fragmento**.
 *
 * ── Los seis bancos ──────────────────────────────────────────────────────────
 *   1. CORTEZA — ninguna pieza de la planta muestrea un solo texel, y la zona
 *      del atlas donde cae la madera es opaca (si no, `alphaTest` la borra) y
 *      tiene variación real (si no, es un color plano con pasos extra).
 *   2. FOLLAJE MULTICAPA — el atlas gana capas de verdad (profundidad media de
 *      cobertura), y **sigue costando cero por cuadro**: dos lienzos cacheados,
 *      no uno por especie.
 *   3. VRAM — el banco de memoria que faltaba. Objetivos de render de los
 *      impostores + lienzos de follaje, sumados desde los objetos reales.
 *   4. CERO REGRESIÓN — los árboles son el 22 % del cuadro. Dibujos, triángulos,
 *      lecturas de textura por fragmento y ALU por fragmento, contra la línea de
 *      base, con el número.
 *   5. EL SOTOBOSQUE NO VUELVE — bajó a 4,5 % del cuadro en una ronda anterior.
 *      Instancias, triángulos, mapas y ALU contra la línea de base.
 *   6. ARRANQUE — sin `render`, sin red y sin `public/tex/`, los dos módulos
 *      construyen igual; ningún import estático de `public/`; `vite build` pasa.
 *
 * ── REGLA 2 de RONDA3.md — guarda de cobertura ───────────────────────────────
 * En la variante que costó la fase 1 (trampa nº 8 de ESTADO.md): la guarda no
 * pregunta «¿corrió?» sino **«¿el camino feliz llegó a funcionar?»**. Acá eso
 * es: el atlas se pintó de verdad (miles de primitivas, cero operaciones sin
 * implementar), las 30 especies se armaron con geometría no vacía, el horneado
 * de impostores creó objetivos de render y llamó a `render()`, y la inyección de
 * shader produjo texto. Sin eso, «nada empeoró» es cierto por vacío y el banco
 * vale cero.
 *
 * Uso:  node .claude/flota/banco-r3-fase3.mjs
 *
 * Cada escenario corre en un PROCESO SEPARADO. `atlasFollaje()` memoiza en una
 * variable de módulo y, si `flora` termina importando `src/util/atlas.js`, ése
 * memoiza su promesa para todo el proceso: en una sola corrida el primer
 * escenario le fijaría el resultado a los demás. Es la trampa nº 8 otra vez.
 *
 * Variables de entorno (las usa el falsador):
 *   BANCO_VEGETACION  ruta alternativa de Vegetacion.js
 *   BANCO_SOTOBOSQUE  ruta alternativa de Sotobosque.js
 *   BANCO_BASE        commit de la línea de base (por defecto dea7689)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TMP = path.join(AQUI, '.tmp-banco-fase3');
const BASE_COMMIT = process.env.BANCO_BASE || 'dea7689';

const VEG_JS = process.env.BANCO_VEGETACION
  ? path.resolve(process.env.BANCO_VEGETACION)
  : path.join(RAIZ, 'src', 'world', 'Vegetacion.js');
const SOTO_JS = process.env.BANCO_SOTOBOSQUE
  ? path.resolve(process.env.BANCO_SOTOBOSQUE)
  : path.join(RAIZ, 'src', 'world', 'Sotobosque.js');

const MARCA = '@@BANCO-FASE3@@';

/**
 * La forma que TODO escenario devuelve, ande bien o ande mal.
 *
 * No es prolijidad: los seis bancos y la guarda del camino feliz leen campos
 * anidados (`a.cuadro.lotes`, `a.impostor.objetivos`) para imprimir el
 * diagnóstico, y una parte de esas lecturas cae fuera del cortocircuito de los
 * `&&`. Con un escenario a medias el banco moría con un `TypeError` propio en
 * vez de informar el fallo del sujeto — o sea que el instrumento tapaba
 * justamente el caso que existe para detectar.
 */
const FORMA_VACIA = {
  error: null, avisos: [], especies: [], cuadro: {}, atlas: {},
  impostor: {}, vram: {}, soto: { construyo: false }, construyoVegetacion: false,
};
/** Normaliza un escenario a `FORMA_VACIA` sin pisar lo que sí trajo. */
function normalizar(e, motivo) {
  // El motivo es para el escenario que NO llegó a existir. Un escenario sano
  // no trae la clave `error` y hereda el `null` de FORMA_VACIA: si se mirara
  // sólo «¿error es falsy?» se le estamparía el motivo a una corrida buena y
  // el banco se declararía roto sin estarlo.
  const hay = e && typeof e === 'object' && Object.keys(e).length > 0;
  const o = { ...FORMA_VACIA, ...(hay ? e : {}) };
  if (!hay && motivo) o.error = motivo;
  for (const k of ['avisos', 'especies']) if (!Array.isArray(o[k])) o[k] = [];
  for (const k of ['cuadro', 'atlas', 'impostor', 'vram']) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
  }
  if (!o.soto || typeof o.soto !== 'object') o.soto = { construyo: false };
  return o;
}

/**
 * Presupuestos, todos de RONDA3.md y del desglose de cuadro de ESTADO.md
 * (medido el 2/9/2026 a Baja 1024×576).
 */
const MS_CUADRO_BAJA = 31.42;
const FRACCION_ARBOLES = 0.22;      // 6,91 ms
const FRACCION_SOTO = 0.045;        // 1,41 ms
const TECHO_VRAM_MIB = 24;          // techo de la ronda para los atlas nuevos
const VRAM_FAUNA_MIB = 16.00;       // lo que gastó la fase 1

// ═══════════════════════════════════════════════════════════════════════════
// RASTERIZADOR 2D — hace de CanvasRenderingContext2D
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rasteriza de verdad las primitivas que dibuja `atlasFollaje()`. No es un
 * emulador completo del canvas del navegador y no pretende serlo: implementa el
 * subconjunto que hace falta y **anota cualquier operación que no implementa**
 * en `opsNoSoportadas`, que el banco lee y convierte en rojo. Un stub silencioso
 * sería un verde por vacío.
 *
 * Diferencias declaradas contra un canvas real: sin antialias (muestreo en el
 * centro del píxel) y uniones de trazo aproximadas por discos. Las dos afectan
 * igual a la línea de base y al archivo de hoy, que es lo que se compara.
 */
function crearLienzo(registro) {
  let N = 0;
  let r, g, b, a, prof, marca;
  let gen = 0;

  function asegurar() {
    const px = N * N;
    if (!r || r.length !== px) {
      r = new Float32Array(px); g = new Float32Array(px);
      b = new Float32Array(px); a = new Float32Array(px);
      prof = new Uint16Array(px); marca = new Uint32Array(px);
    }
  }

  // ── estado del contexto ───────────────────────────────────────────────
  let est = {
    fill: [0, 0, 0, 1], stroke: [0, 0, 0, 1],
    fillObj: null, strokeObj: null,
    lineWidth: 1, globalAlpha: 1,
    m: [1, 0, 0, 1, 0, 0],           // a b c d e f
  };
  const pila = [];
  let subrutas = [];                  // [[x,y],...] en espacio de dispositivo
  let actual = null;

  const noSoportadas = new Set();
  let primitivas = 0;

  const clonEstado = (e) => ({ ...e, fill: e.fill.slice(), stroke: e.stroke.slice(), m: e.m.slice() });

  function aplicar(x, y) {
    const m = est.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  function escalaMedia() {
    const m = est.m;
    return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
  }

  // ── colores ───────────────────────────────────────────────────────────
  const NOMBRES = {
    white: [1, 1, 1, 1], black: [0, 0, 0, 1], red: [1, 0, 0, 1],
    green: [0, 0.5, 0, 1], blue: [0, 0, 1, 1], gray: [0.5, 0.5, 0.5, 1],
    grey: [0.5, 0.5, 0.5, 1], transparent: [0, 0, 0, 0],
  };
  function parsearColor(s) {
    if (s && typeof s === 'object') return null;         // gradiente
    if (typeof s !== 'string') { noSoportadas.add('estilo ' + typeof s); return [0, 0, 0, 1]; }
    const t = s.trim().toLowerCase();
    if (NOMBRES[t]) return NOMBRES[t].slice();
    let m = t.match(/^#([0-9a-f]{3})$/);
    if (m) return [parseInt(m[1][0] + m[1][0], 16) / 255, parseInt(m[1][1] + m[1][1], 16) / 255,
                   parseInt(m[1][2] + m[1][2], 16) / 255, 1];
    m = t.match(/^#([0-9a-f]{6})$/);
    if (m) return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255,
                   parseInt(m[1].slice(4, 6), 16) / 255, 1];
    m = t.match(/^#([0-9a-f]{8})$/);
    if (m) return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255,
                   parseInt(m[1].slice(4, 6), 16) / 255, parseInt(m[1].slice(6, 8), 16) / 255];
    m = t.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(',').map(x => x.trim());
      const c = (v) => v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255;
      return [c(p[0]), c(p[1]), c(p[2]), p.length > 3 ? parseFloat(p[3]) : 1];
    }
    noSoportadas.add('color ' + t.slice(0, 24));
    return [0, 0, 0, 1];
  }

  /** Devuelve una función (x,y)->[r,g,b,a] para el estilo activo. */
  function pintorDe(estilo, colorPlano) {
    if (estilo && typeof estilo === 'object' && estilo.__grad) {
      const gr = estilo;
      const paradas = gr.paradas.slice().sort((p, q) => p.t - q.t);
      if (!paradas.length) return () => [0, 0, 0, 0];
      return (x, y) => {
        let t;
        if (gr.tipo === 'lineal') {
          const dx = gr.x1 - gr.x0, dy = gr.y1 - gr.y0;
          const len2 = dx * dx + dy * dy || 1;
          t = ((x - gr.x0) * dx + (y - gr.y0) * dy) / len2;
        } else {
          const d = Math.hypot(x - gr.x1, y - gr.y1);
          t = (d - gr.r0) / Math.max(1e-6, gr.r1 - gr.r0);
        }
        t = Math.min(1, Math.max(0, t));
        let i = 0;
        while (i < paradas.length - 1 && paradas[i + 1].t < t) i++;
        const p0 = paradas[i], p1 = paradas[Math.min(paradas.length - 1, i + 1)];
        const k = p1.t > p0.t ? (t - p0.t) / (p1.t - p0.t) : 0;
        return [0, 1, 2, 3].map(j => p0.c[j] + (p1.c[j] - p0.c[j]) * k);
      };
    }
    return () => colorPlano;
  }

  // ── relleno de polígono por barrido, regla non-zero ───────────────────
  function rellenar(rutas, pintor) {
    asegurar();
    gen++;
    let minY = Infinity, maxY = -Infinity;
    const aristas = [];
    for (const ruta of rutas) {
      const n = ruta.length;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const p = ruta[i], q = ruta[(i + 1) % n];
        if (p[1] === q[1]) continue;
        aristas.push([p[0], p[1], q[0], q[1]]);
        minY = Math.min(minY, p[1], q[1]);
        maxY = Math.max(maxY, p[1], q[1]);
      }
    }
    if (!aristas.length) return;
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(N - 1, Math.ceil(maxY));
    const cruces = [];
    for (let py = y0; py <= y1; py++) {
      const yc = py + 0.5;
      cruces.length = 0;
      for (const [ax, ay, bx, by] of aristas) {
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          const t = (yc - ay) / (by - ay);
          cruces.push([ax + t * (bx - ax), by > ay ? 1 : -1]);
        }
      }
      if (cruces.length < 2) continue;
      cruces.sort((u, v) => u[0] - v[0]);
      let w = 0;
      for (let i = 0; i < cruces.length - 1; i++) {
        w += cruces[i][1];
        if (w === 0) continue;
        const xa = Math.max(0, Math.ceil(cruces[i][0] - 0.5));
        const xb = Math.min(N - 1, Math.floor(cruces[i + 1][0] - 0.5));
        for (let px = xa; px <= xb; px++) {
          const c = pintor(px + 0.5, yc);
          mezclar(px, py, c);
        }
      }
    }
  }

  function mezclar(px, py, c) {
    const sa = c[3] * est.globalAlpha;
    if (!(sa > 0)) return;
    const i = py * N + px;
    const da = a[i];
    const na = sa + da * (1 - sa);
    if (na <= 0) return;
    r[i] = (c[0] * sa + r[i] * da * (1 - sa)) / na;
    g[i] = (c[1] * sa + g[i] * da * (1 - sa)) / na;
    b[i] = (c[2] * sa + b[i] * da * (1 - sa)) / na;
    a[i] = na;
    if (sa > 0.02 && marca[i] !== gen) { marca[i] = gen; prof[i]++; }
  }

  /** Trazo: cada segmento es un rectángulo, cada vértice un octógono. */
  function trazar(rutas, pintor, ancho) {
    const w = Math.max(0.35, ancho / 2);
    const cuerpos = [];
    for (const ruta of rutas) {
      for (let i = 0; i < ruta.length - 1; i++) {
        const [x0, y0] = ruta[i], [x1, y1] = ruta[i + 1];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;
        const nx = -dy / len * w, ny = dx / len * w;
        cuerpos.push([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
      }
      if (w > 0.9) {
        for (const [cx, cy] of ruta) {
          const oct = [];
          for (let k = 0; k < 8; k++) {
            const t = (k / 8) * Math.PI * 2;
            oct.push([cx + Math.cos(t) * w, cy + Math.sin(t) * w]);
          }
          cuerpos.push(oct);
        }
      }
    }
    // Una sola generación para todo el trazo: es UNA primitiva.
    asegurar(); gen++;
    for (const c of cuerpos) rellenarSinGen([c], pintor);
  }

  function rellenarSinGen(rutas, pintor) {
    const guardado = gen;
    rellenar(rutas, pintor);
    gen = guardado;   // rellenar() incrementa; lo devolvemos para no contar de más
  }

  function elipse(x, y, rx, ry, rot) {
    const pts = [];
    const pasos = Math.max(10, Math.min(64, Math.round((rx + ry) * 1.4)));
    for (let i = 0; i < pasos; i++) {
      const t = (i / pasos) * Math.PI * 2;
      const ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
      pts.push(aplicar(x + ex * Math.cos(rot) - ey * Math.sin(rot),
                       y + ex * Math.sin(rot) + ey * Math.cos(rot)));
    }
    return pts;
  }

  const ctx = {
    get canvas() { return lienzo; },
    set fillStyle(v) { est.fillObj = (v && typeof v === 'object') ? v : null; est.fill = parsearColor(v) || [0, 0, 0, 1]; },
    get fillStyle() { return est.fillObj || est.fill; },
    set strokeStyle(v) { est.strokeObj = (v && typeof v === 'object') ? v : null; est.stroke = parsearColor(v) || [0, 0, 0, 1]; },
    get strokeStyle() { return est.strokeObj || est.stroke; },
    set lineWidth(v) { est.lineWidth = v; }, get lineWidth() { return est.lineWidth; },
    set globalAlpha(v) { est.globalAlpha = v; }, get globalAlpha() { return est.globalAlpha; },
    set lineCap(v) {}, set lineJoin(v) {}, set miterLimit(v) {}, set font(v) {}, set textAlign(v) {},
    set imageSmoothingEnabled(v) {},
    set shadowBlur(v) { if (v) noSoportadas.add('shadowBlur'); },
    set shadowColor(v) {},
    set filter(v) { if (v && v !== 'none') noSoportadas.add('filter:' + v); },
    set globalCompositeOperation(v) {
      if (v && v !== 'source-over') noSoportadas.add('globalCompositeOperation:' + v);
    },

    save() { pila.push(clonEstado(est)); },
    restore() { if (pila.length) est = pila.pop(); },
    translate(x, y) { const m = est.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    scale(sx, sy) { const m = est.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; },
    rotate(t) {
      const m = est.m, c = Math.cos(t), s = Math.sin(t);
      const a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
      m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s;
      m[2] = a0 * -s + c0 * c; m[3] = b0 * -s + d0 * c;
    },
    setTransform(a0, b0, c0, d0, e0, f0) { est.m = [a0, b0, c0, d0, e0, f0]; },
    resetTransform() { est.m = [1, 0, 0, 1, 0, 0]; },

    beginPath() { subrutas = []; actual = null; },
    closePath() { if (actual && actual.length) actual.push(actual[0].slice()); },
    moveTo(x, y) { actual = [aplicar(x, y)]; subrutas.push(actual); },
    lineTo(x, y) { if (!actual) { actual = []; subrutas.push(actual); } actual.push(aplicar(x, y)); },
    rect(x, y, w, h) {
      actual = [aplicar(x, y), aplicar(x + w, y), aplicar(x + w, y + h), aplicar(x, y + h)];
      subrutas.push(actual);
    },
    quadraticCurveTo(cx, cy, x, y) {
      if (!actual || !actual.length) { this.moveTo(cx, cy); }
      const p0 = actual[actual.length - 1];
      const [qc] = [aplicar(cx, cy)], [q1] = [aplicar(x, y)];
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, u = 1 - t;
        actual.push([u * u * p0[0] + 2 * u * t * qc[0] + t * t * q1[0],
                     u * u * p0[1] + 2 * u * t * qc[1] + t * t * q1[1]]);
      }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      if (!actual || !actual.length) { this.moveTo(c1x, c1y); }
      const p0 = actual[actual.length - 1];
      const a1 = aplicar(c1x, c1y), a2 = aplicar(c2x, c2y), a3 = aplicar(x, y);
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        actual.push([u * u * u * p0[0] + 3 * u * u * t * a1[0] + 3 * u * t * t * a2[0] + t * t * t * a3[0],
                     u * u * u * p0[1] + 3 * u * u * t * a1[1] + 3 * u * t * t * a2[1] + t * t * t * a3[1]]);
      }
    },
    arc(x, y, rad, a0 = 0, a1 = Math.PI * 2) {
      const pts = [];
      const span = Math.abs(a1 - a0) || Math.PI * 2;
      const pasos = Math.max(8, Math.min(64, Math.round(rad * 1.6)));
      for (let i = 0; i <= pasos; i++) {
        const t = a0 + (a1 - a0) * (i / pasos);
        pts.push(aplicar(x + Math.cos(t) * rad, y + Math.sin(t) * rad));
      }
      if (actual && actual.length) actual.push(...pts);
      else { actual = pts; subrutas.push(actual); }
      void span;
    },
    ellipse(x, y, rx, ry, rot = 0) {
      actual = elipse(x, y, rx, ry, rot);
      subrutas.push(actual);
    },

    fill() { primitivas++; asegurar(); gen++; rellenarSinGen(subrutas, pintorDe(est.fillObj, est.fill)); },
    stroke() { primitivas++; trazar(subrutas, pintorDe(est.strokeObj, est.stroke), est.lineWidth * escalaMedia()); },
    fillRect(x, y, w, h) {
      primitivas++; asegurar(); gen++;
      rellenarSinGen([[aplicar(x, y), aplicar(x + w, y), aplicar(x + w, y + h), aplicar(x, y + h)]],
                     pintorDe(est.fillObj, est.fill));
    },
    strokeRect(x, y, w, h) {
      primitivas++;
      trazar([[aplicar(x, y), aplicar(x + w, y), aplicar(x + w, y + h), aplicar(x, y + h), aplicar(x, y)]],
             pintorDe(est.strokeObj, est.stroke), est.lineWidth * escalaMedia());
    },
    clearRect(x, y, w, h) {
      asegurar();
      const [X0, Y0] = aplicar(x, y), [X1, Y1] = aplicar(x + w, y + h);
      for (let py = Math.max(0, Math.floor(Math.min(Y0, Y1))); py < Math.min(N, Math.ceil(Math.max(Y0, Y1))); py++)
        for (let px = Math.max(0, Math.floor(Math.min(X0, X1))); px < Math.min(N, Math.ceil(Math.max(X0, X1))); px++) {
          const i = py * N + px;
          r[i] = g[i] = b[i] = a[i] = 0; prof[i] = 0;
        }
    },
    createLinearGradient(x0, y0, x1, y1) {
      const p0 = aplicar(x0, y0), p1 = aplicar(x1, y1);
      return { __grad: 1, tipo: 'lineal', x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], paradas: [],
               addColorStop(t, c) { this.paradas.push({ t, c: parsearColor(c) || [0, 0, 0, 1] }); } };
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const p1 = aplicar(x1, y1);
      return { __grad: 1, tipo: 'radial', x1: p1[0], y1: p1[1], r0: r0 * escalaMedia(), r1: r1 * escalaMedia(),
               paradas: [], addColorStop(t, c) { this.paradas.push({ t, c: parsearColor(c) || [0, 0, 0, 1] }); } };
    },
    createPattern() { noSoportadas.add('createPattern'); return null; },
    drawImage() { noSoportadas.add('drawImage'); },

    // ── Camino por píxel ──────────────────────────────────────────────
    // Estos tres eran stubs que sólo anotaban «no soportado», y con eso
    // alcanzaba mientras el atlas se dibujara con primitivas. Ya no: la
    // corteza de la fase 3 se genera píxel a píxel con `createImageData` y
    // se vuelca con `putImageData` (decisión D2 de `r3-flora.md`).
    //
    // Con los stubs el banco medía una franja TRANSPARENTE y daba rojo por
    // culpa del instrumento, no del código — que es exactamente la forma de
    // la trampa nº 8 de `ESTADO.md`. Peor todavía: `createImageData`
    // devolvía un búfer de 1×1, y como una escritura fuera de rango en un
    // `Uint8ClampedArray` no tira, el bucle del agente corría entero, tiraba
    // sus 32.768 píxeles al vacío y devolvía una media perfectamente
    // creíble. Verde por vacío en la variante más difícil de ver.
    //
    // `putImageData` NO pasa por la matriz de transformación ni por el
    // mezclado alfa: sobreescribe. Es la semántica real del lienzo, y es de
    // la que depende que la franja tape lo que tenga debajo.
    putImageData(img, dx, dy) {
      asegurar();
      if (!img || !img.data) { noSoportadas.add('putImageData:sin-datos'); return; }
      primitivas++; gen++;
      const w = img.width | 0, h = img.height | 0;
      for (let y = 0; y < h; y++) {
        const py = (dy | 0) + y;
        if (py < 0 || py >= N) continue;
        for (let x = 0; x < w; x++) {
          const px = (dx | 0) + x;
          if (px < 0 || px >= N) continue;
          const o = (y * w + x) * 4, i = py * N + px;
          r[i] = img.data[o] / 255;
          g[i] = img.data[o + 1] / 255;
          b[i] = img.data[o + 2] / 255;
          a[i] = img.data[o + 3] / 255;
          if (a[i] > 0.02 && marca[i] !== gen) { marca[i] = gen; prof[i]++; }
        }
      }
    },
    getImageData(x = 0, y = 0, w = N, h = N) {
      asegurar();
      const W = Math.max(0, w | 0), H = Math.max(0, h | 0);
      const d = new Uint8ClampedArray(W * H * 4);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const sx = (x | 0) + px, sy = (y | 0) + py;
        if (sx < 0 || sx >= N || sy < 0 || sy >= N) continue;
        const i = sy * N + sx, o = (py * W + px) * 4;
        d[o] = r[i] * 255; d[o + 1] = g[i] * 255; d[o + 2] = b[i] * 255; d[o + 3] = a[i] * 255;
      }
      return { data: d, width: W, height: H, colorSpace: 'srgb' };
    },
    createImageData(w, h) {
      // El lienzo real acepta también `createImageData(otroImageData)`.
      const W = (w && w.width !== undefined ? w.width : w) | 0;
      const H = (w && w.height !== undefined ? w.height : h) | 0;
      if (!(W > 0 && H > 0)) { noSoportadas.add('createImageData:medida-invalida'); }
      return { data: new Uint8ClampedArray(Math.max(0, W * H) * 4), width: W, height: H, colorSpace: 'srgb' };
    },
    clip() { noSoportadas.add('clip'); },
    fillText() { noSoportadas.add('fillText'); },
    measureText() { noSoportadas.add('measureText'); return { width: 0 }; },
  };

  const lienzo = {
    nodeType: 1, tagName: 'CANVAS', style: {},
    get width() { return N; }, set width(v) { N = v | 0; r = null; asegurar(); },
    get height() { return N; }, set height(v) { N = v | 0; asegurar(); },
    getContext: (tipo) => { if (tipo !== '2d') { noSoportadas.add('getContext:' + tipo); return null; } return ctx; },
    toDataURL: () => { noSoportadas.add('toDataURL'); return ''; },
    addEventListener() {}, removeEventListener() {},
    // acceso del banco
    __medida: {
      get N() { return N; },
      get primitivas() { return primitivas; },
      get noSoportadas() { return [...noSoportadas]; },
      canal: () => ({ r, g, b, a, prof, N }),
    },
  };
  registro.push(lienzo);
  return lienzo;
}

/** Estadísticas de una ventana rectangular del lienzo, en píxeles. */
function medirVentana(lienzo, x0, y0, x1, y1) {
  const { r, g, b, a, prof, N } = lienzo.__medida.canal();
  const X0 = Math.max(0, Math.floor(Math.min(x0, x1))), X1 = Math.min(N, Math.ceil(Math.max(x0, x1)));
  const Y0 = Math.max(0, Math.floor(Math.min(y0, y1))), Y1 = Math.min(N, Math.ceil(Math.max(y0, y1)));
  let n = 0, opacos = 0, sum = 0, sum2 = 0, sumProf = 0, cubiertos = 0;
  for (let py = Y0; py < Y1; py++) for (let px = X0; px < X1; px++) {
    const i = py * N + px;
    n++;
    if (a[i] >= 0.28) opacos++;               // el alphaTest del material
    if (a[i] > 0.02) {
      cubiertos++;
      sumProf += prof[i];
      const l = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i];
      sum += l; sum2 += l * l;
    }
  }
  const media = cubiertos ? sum / cubiertos : 0;
  const varz = cubiertos ? Math.max(0, sum2 / cubiertos - media * media) : 0;
  return {
    pixeles: n, fracOpaca: n ? opacos / n : 0, fracCubierta: n ? cubiertos / n : 0,
    lumMedia: media, lumSigma: Math.sqrt(varz),
    profMedia: cubiertos ? sumProf / cubiertos : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRABAJADOR — un proceso por escenario
// ═══════════════════════════════════════════════════════════════════════════

/** PRNG determinista, para que dos corridas del banco den lo mismo. */
function sembrarAzar(semilla) {
  let s = semilla >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shader falso con los `#include` de three, para medir lo que inyecta el agente. */
function shaderFalso() {
  const inc = (n) => '#include <' + n + '>';
  return {
    uniforms: {},
    vertexShader: [
      inc('common'), inc('uv_pars_vertex'), inc('color_pars_vertex'), inc('shadowmap_pars_vertex'),
      'void main() {', inc('uv_vertex'), inc('color_vertex'), inc('beginnormal_vertex'),
      inc('defaultnormal_vertex'), inc('begin_vertex'), inc('project_vertex'),
      inc('worldpos_vertex'), inc('shadowmap_vertex'), inc('fog_vertex'), '}',
    ].join('\n'),
    fragmentShader: [
      inc('common'), inc('color_pars_fragment'), inc('uv_pars_fragment'), inc('map_pars_fragment'),
      inc('alphamap_pars_fragment'), inc('aomap_pars_fragment'), inc('lightmap_pars_fragment'),
      inc('emissivemap_pars_fragment'), inc('fog_pars_fragment'), inc('lights_pars_begin'),
      'void main() {', inc('clipping_planes_fragment'), inc('map_fragment'), inc('color_fragment'),
      inc('alphamap_fragment'), inc('alphatest_fragment'), inc('normal_fragment_begin'),
      inc('emissivemap_fragment'), inc('lights_lambert_fragment'), inc('lights_fragment_begin'),
      inc('lights_fragment_maps'), inc('lights_fragment_end'), inc('aomap_fragment'),
      inc('opaque_fragment'), inc('output_fragment'), inc('tonemapping_fragment'),
      inc('colorspace_fragment'), inc('fog_fragment'), inc('dithering_fragment'), '}',
    ].join('\n'),
  };
}

const RE_FETCH = /\b(texture2D|textureCube|texture|texelFetch|textureLod|texture2DLod)\s*\(/g;
const RE_ALU = /\b(pow|exp|exp2|log|log2|sqrt|inversesqrt|sin|cos|tan|asin|acos|atan|noise\w*|fbm\w*|snoise|cnoise|hash\w*)\s*\(/g;

function contar(texto, re) {
  if (!texto) return 0;
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(texto)) n++;
  return n;
}

/** Sólo el cuerpo de main() del fragmento: lo que se paga POR PÍXEL. */
function cuerpoFragmento(frag) {
  if (!frag) return '';
  const i = frag.indexOf('void main');
  return i < 0 ? frag : frag.slice(i);
}

/** Cuánto agrega `onBeforeCompile` sobre un shader limpio. */
function medirInyeccion(mat) {
  if (typeof mat.onBeforeCompile !== 'function') {
    return { inyectoFragmento: 0, fetchs: 0, alu: 0, inyectoVertice: 0 };
  }
  const antes = shaderFalso();
  const s = shaderFalso();
  try { mat.onBeforeCompile(s, {}); } catch (e) { return { error: e.message, inyectoFragmento: 0, fetchs: 0, alu: 0 }; }
  const fA = cuerpoFragmento(antes.fragmentShader), fB = cuerpoFragmento(s.fragmentShader);
  return {
    inyectoFragmento: fB.length - fA.length,
    inyectoVertice: s.vertexShader.length - antes.vertexShader.length,
    fetchs: contar(fB, RE_FETCH) - contar(fA, RE_FETCH),
    alu: contar(fB, RE_ALU) - contar(fA, RE_ALU),
  };
}

/** Mapas que un material samplea por fragmento (uno por mapa presente). */
function mapasDe(mat) {
  const claves = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap',
                  'lightMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'specularMap', 'envMap'];
  const puestos = claves.filter(k => mat[k]);
  return { n: puestos.length, cuales: puestos };
}

async function trabajador(modo) {
  const salida = { modo, avisos: [] };
  const THREE = await import('three');
  const flora = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'flora.json'), 'utf8'));

  const lienzos = [];
  globalThis.document = {
    createElement: (t) => (t === 'canvas' ? crearLienzo(lienzos) : { style: {}, appendChild() {} }),
    createElementNS: (ns, t) => (t === 'canvas' ? crearLienzo(lienzos) : { style: {} }),
    body: { appendChild() {} },
  };
  globalThis.window = globalThis.window || { devicePixelRatio: 1, addEventListener() {} };
  if (modo === 'sin-red') {
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error('404'); } });
  }

  // Renderizador espía
  const objetivos = [];
  const vistasPorHorneada = [];
  let nRender = 0, nRenderDesdeUltimo = 0;
  const render = {
    autoClear: true,
    capabilities: { isWebGL2: true, maxTextureSize: 4096, getMaxAnisotropy: () => 16 },
    getRenderTarget: () => null,
    getClearColor: (c) => { c.setRGB(0, 0, 0); return c; },
    getClearAlpha: () => 1,
    setRenderTarget(t) {
      if (t) { objetivos.push(t); nRenderDesdeUltimo = 0; }
      else if (objetivos.length) { vistasPorHorneada.push(nRenderDesdeUltimo); }
    },
    setClearColor() {}, clear() {}, clearDepth() {}, clearColor() {},
    setViewport() {}, setScissor() {}, setScissorTest() {}, setPixelRatio() {},
    render() { nRender++; nRenderDesdeUltimo++; },
    getSize(v) { v.set(1024, 576); return v; },
    getPixelRatio: () => 1,
    initTexture() {}, compile() {},
    domElement: { width: 1024, height: 576 },
  };

  sembrarAzar(20260906);

  // ── Vegetación ────────────────────────────────────────────────────────
  const modVeg = await import(pathToFileURL(VEG_JS).href);
  const usaRender = modo !== 'sin-render';
  let veg;
  try {
    veg = new modVeg.Vegetacion({}, flora, usaRender ? render : null);
  } catch (e) {
    // El camino de error devuelve la MISMA forma que el camino feliz. Si
    // devuelve un objeto a medias, quien lo lee explota al imprimir el
    // diagnóstico y el banco muere sin decir por qué murió: es lo que pasaba
    // acá, y el `ReferenceError` de `UV_MADERA` salía como un `TypeError` del
    // propio banco. Un instrumento que se rompe cuando el sujeto se rompe no
    // mide nada.
    salida.error = 'Vegetacion no construyó (' + modo + '): ' + e.stack;
    return { ...FORMA_VACIA, ...salida };
  }
  salida.construyoVegetacion = true;

  // Atlas de follaje: uno por clase de hoja, y tiene que estar cacheado.
  const atlasPorClase = {};
  let cacheado = true;
  if (typeof modVeg.atlasFollaje === 'function') {
    for (const clase of ['aguja', 'lamina']) {
      const primerasPrim = lienzos.reduce((s, l) => s + l.__medida.primitivas, 0);
      const t1 = modVeg.atlasFollaje(clase);
      const t2 = modVeg.atlasFollaje(clase);
      const despues = lienzos.reduce((s, l) => s + l.__medida.primitivas, 0);
      if (t1 !== t2 || despues !== primerasPrim) cacheado = false;
      const lz = t1 && t1.image && t1.image.__medida ? t1.image : null;
      atlasPorClase[clase] = {
        hay: !!t1,
        tieneLienzo: !!lz,
        N: lz ? lz.__medida.N : 0,
        primitivas: lz ? lz.__medida.primitivas : 0,
        noSoportadas: lz ? lz.__medida.noSoportadas : ['sin lienzo medible'],
        flipY: t1 ? t1.flipY : null,
        anisotropy: t1 ? t1.anisotropy : null,
        mipmaps: t1 ? t1.generateMipmaps : null,
        colorSpace: t1 ? t1.colorSpace : null,
        // Estadística de todo el lienzo
        todo: lz ? medirVentana(lz, 0, 0, lz.__medida.N, lz.__medida.N) : null,
      };
      salida['_lz_' + clase] = null;
      atlasPorClase[clase]._ref = lz;
    }
  } else {
    salida.avisos.push('no se exporta atlasFollaje(): no se pudo medir el atlas de follaje');
  }

  // Texturas distintas creadas (una por clase = cacheado; 30 = no cacheado)
  const texturasFollaje = new Set();
  for (const lote of veg.lotes) if (lote.malla.material.map) texturasFollaje.add(lote.malla.material.map);

  // ── Geometría por especie ─────────────────────────────────────────────
  const RE_CLASE = null;
  const especies = [];
  for (const lote of veg.lotes) {
    const g = lote.malla.geometry;
    const pos = g.attributes.position, uv = g.attributes.uv, flex = g.attributes.aFlexion;
    const nv = pos ? pos.count : 0;
    const tris = g.index ? g.index.count / 3 : nv / 3;

    // Grupos de UV exactamente idéntica: el defecto «un solo texel» es un grupo
    // gigante en una sola coordenada.
    const cuenta = new Map();
    let maxGrupo = 0, uvClaveMax = null;
    if (uv) {
      for (let i = 0; i < nv; i++) {
        const k = uv.getX(i).toFixed(6) + ',' + uv.getY(i).toFixed(6);
        const c = (cuenta.get(k) || 0) + 1;
        cuenta.set(k, c);
        if (c > maxGrupo) { maxGrupo = c; uvClaveMax = k; }
      }
    }

    // Madera: `aFlexion` ~ 0 es el marcador que usa el propio shader de viento
    // para no menear el tronco. Si un día deja de discriminar, el banco lo dice
    // en vez de dar verde por vacío.
    let maderaN = 0, u0 = 1, v0 = 1, u1 = 0, v1 = 0;
    const uvMadera = new Set();
    if (uv && flex) {
      for (let i = 0; i < nv; i++) {
        if (flex.getX(i) > 0.05) continue;
        maderaN++;
        const u = uv.getX(i), v = uv.getY(i);
        u0 = Math.min(u0, u); u1 = Math.max(u1, u);
        v0 = Math.min(v0, v); v1 = Math.max(v1, v);
        uvMadera.add(u.toFixed(4) + ',' + v.toFixed(4));
      }
    }

    const clase = lote.malla.material.map;
    especies.push({
      id: lote.esp.id, tipo: lote.esp.tipo,
      verts: nv, tris,
      uvUnicas: cuenta.size,
      maxGrupoUV: maxGrupo,
      fracMaxGrupoUV: nv ? maxGrupo / nv : 0,
      uvClaveMax,
      maderaN,
      maderaUVUnicas: uvMadera.size,
      maderaCaja: maderaN ? [u0, v0, u1, v1] : null,
      maderaAreaUV: maderaN ? Math.max(0, u1 - u0) * Math.max(0, v1 - v0) : 0,
      claseAtlas: clase === (atlasPorClase.aguja && atlasPorClase.aguja._ref &&
        (atlasPorClase.aguja.hay ? modVeg.atlasFollaje('aguja') : null)) ? 'aguja' : null,
      mapas: mapasDe(lote.malla.material).cuales,
      castShadow: lote.malla.castShadow,
      capacidad: lote.malla.instanceMatrix.count,
    });
  }

  // Ventana de la corteza medida sobre el lienzo real de cada clase
  for (const esp of especies) {
    const lote = veg.lotes.find(l => l.esp.id === esp.id);
    const tex = lote.malla.material.map;
    const lz = tex && tex.image && tex.image.__medida ? tex.image : null;
    if (!lz || !esp.maderaCaja) { esp.corteza = null; continue; }
    const N = lz.__medida.N;
    const flip = tex.flipY !== false;
    const [a0, b0, a1, b1] = esp.maderaCaja;
    // v → fila del lienzo. Con flipY (el defecto de three por defecto) la fila 0
    // del lienzo es v=1.
    const y0 = flip ? (1 - b1) * N : b0 * N;
    const y1 = flip ? (1 - b0) * N : b1 * N;
    const x0 = a0 * N, x1 = a1 * N;
    // Una ventana degenerada (un punto) se ensancha a un texel para poder medirla.
    esp.corteza = medirVentana(lz, x0, y0, Math.max(x1, x0 + 1), Math.max(y1, y0 + 1));
    esp.corteza.anchoPx = Math.max(x1 - x0, 0);
    esp.corteza.altoPx = Math.max(y1 - y0, 0);
  }

  // ── Impostores y VRAM ─────────────────────────────────────────────────
  //
  // LO QUE ESTE BLOQUE CONTABA DE MENOS, Y POR QUÉ IMPORTA.
  //
  // Hasta acá la fórmula era una sola: `w*h*4*(mip?4/3:1)` sobre los objetivos
  // de render, más los atlas de follaje. Eso da 62,67 MiB y es de donde salió
  // ese número. Le faltaban DOS partidas, las dos reales y las dos grandes:
  //
  //  · el búfer de PROFUNDIDAD de cada objetivo. `WebGLRenderTarget` lo crea
  //    solo (`depthBuffer: true` es el defecto de `RenderTarget`, three 0.169),
  //    queda vivo mientras viva el objetivo, y el objetivo queda guardado en
  //    `horneado.objetivo` para siempre. Son 45 MiB que nadie contó nunca.
  //  · los búferes de INSTANCIA: `instanceMatrix` (16 flotantes) y el atributo
  //    `iTinte` (3), por las 7000 carteleras y las 600 mallas de cada especie.
  //
  // Sin esas dos partidas el banco NO PUEDE VER el ahorro grande de la fase
  // —compartir un solo búfer de profundidad entre los 30 hornos— porque el
  // ahorro cae entero fuera de lo que el banco suma. Un banco ciego a la
  // mejora que existe para medir da verde diga lo que diga el código.
  const bytesProfundidadDe = (t) => {
    if (t.depthBuffer === false) return 0;
    if (t.depthTexture) {
      // Con `depthTexture` three adjunta la textura y NO crea renderbuffer
      // (`setupDepthRenderbuffer` → `setupDepthTexture`). Si es compartida se
      // paga una sola vez: la dedupe la hace quien llama.
      const bpp = String(t.depthTexture.type) === String(THREE.UnsignedShortType) ? 2 : 4;
      return t.width * t.height * bpp;
    }
    // Sin stencil el formato es DEPTH_COMPONENT24 (`getInternalDepthFormat`),
    // que el hardware almacena padeado a 32 bits. Es el único supuesto de
    // hardware de toda esta cuenta y queda anotado como tal.
    return t.width * t.height * (t.stencilBuffer ? 4 : 4);
  };

  const rts = objetivos.map(t => ({
    w: t.width, h: t.height,
    mip: !!(t.texture && t.texture.generateMipmaps),
    tipo: t.texture ? String(t.texture.type) : '?',
    prof: bytesProfundidadDe(t),
    compartida: !!t.depthTexture,
  }));
  const bytesRT = rts.reduce((s, t) => s + t.w * t.h * 4 * (t.mip ? 4 / 3 : 1), 0);

  // Profundidad, deduplicando las texturas compartidas por identidad.
  const profVistas = new Set();
  let bytesProf = 0, objetivosConProfCompartida = 0, profPropias = 0;
  for (const t of objetivos) {
    if (t.depthTexture) {
      objetivosConProfCompartida++;
      if (profVistas.has(t.depthTexture)) continue;
      profVistas.add(t.depthTexture);
    } else if (t.depthBuffer !== false) {
      // Sin `depthTexture` three le crea un renderbuffer propio a cada uno.
      profPropias++;
    }
    bytesProf += bytesProfundidadDe(t);
  }
  const profundidadesDistintas = profVistas.size + profPropias;

  const lienzosUnicos = new Set();
  for (const l of lienzos) if (l.__medida.primitivas > 0) lienzosUnicos.add(l);
  let bytesLienzo = 0;
  for (const t of texturasFollaje) {
    const n = t.image && t.image.__medida ? t.image.__medida.N : 512;
    bytesLienzo += n * n * 4 * (t.generateMipmaps ? 4 / 3 : 1);
  }

  // Búferes de instancia y de geometría, recorriendo las mallas de verdad.
  // `iTinte` es un `InstancedBufferAttribute` que vive EN la geometría, así que
  // se lo saltea en el recuento de geometría para no contarlo dos veces.
  const geosVistas = new Set();
  let bytesInstancia = 0, bytesGeometria = 0, mallasContadas = 0;
  const contarMalla = (m) => {
    if (!m) return;
    mallasContadas++;
    if (m.instanceMatrix) bytesInstancia += m.instanceMatrix.count * 16 * 4;
    if (m.instanceColor) bytesInstancia += m.instanceColor.count * 3 * 4;
    const g = m.geometry;
    if (!g) return;
    for (const [, at] of Object.entries(g.attributes)) {
      if (at.isInstancedBufferAttribute) { bytesInstancia += at.count * at.itemSize * 4; continue; }
      if (geosVistas.has(at)) continue;
      geosVistas.add(at);
      bytesGeometria += at.array ? at.array.byteLength : at.count * at.itemSize * 4;
    }
    if (g.index && !geosVistas.has(g.index)) {
      geosVistas.add(g.index);
      bytesGeometria += g.index.array ? g.index.array.byteLength : g.index.count * 4;
    }
  };
  for (const lote of veg.lotes) {
    contarMalla(lote.malla);
    if (lote.impostor) contarMalla(lote.impostor.malla);
  }

  salida.impostor = {
    objetivos: rts.length,
    dims: rts.length ? rts[0].w + 'x' + rts[0].h : '—',
    todosIguales: rts.every(t => t.w === rts[0].w && t.h === rts[0].h),
    mipmaps: rts.length ? rts[0].mip : null,
    llamadasRender: nRender,
    vistasPorHorneada: vistasPorHorneada.length ? Math.max(...vistasPorHorneada) : 0,
    bytes: bytesRT,
    bytesProfundidad: bytesProf,
    profundidadesDistintas,
    objetivosConProfCompartida,
  };
  salida.vram = {
    bytesImpostores: bytesRT,
    bytesProfundidad: bytesProf,
    bytesFollaje: bytesLienzo,
    bytesInstancia,
    bytesGeometria,
    mallasContadas,
    texturasFollaje: texturasFollaje.size,
    // `total` mantiene el sentido que tenía —lo que el banco venía comparando—
    // y `totalReal` es la cuenta completa. Se informan los dos a propósito:
    // que se vea qué mide cada uno es justamente lo que faltaba.
    total: bytesRT + bytesLienzo,
    totalReal: bytesRT + bytesProf + bytesLienzo + bytesInstancia + bytesGeometria,
  };

  // ── Costo por cuadro ──────────────────────────────────────────────────
  const materiales = new Set();
  let fetchsMalla = 0, aluMalla = 0, inyectoMalla = 0;
  for (const lote of veg.lotes) materiales.add(lote.malla.material);
  const matEjemplo = veg.lotes[0] && veg.lotes[0].malla.material;
  if (matEjemplo) {
    const iny = medirInyeccion(matEjemplo);
    fetchsMalla = mapasDe(matEjemplo).n + iny.fetchs;
    aluMalla = iny.alu;
    inyectoMalla = iny.inyectoFragmento;
    if (iny.error) salida.avisos.push('onBeforeCompile lanzó: ' + iny.error);
  }
  const matImp = veg.lotes[0] && veg.lotes[0].impostor && veg.lotes[0].impostor.malla.material;
  const fragImp = matImp ? cuerpoFragmento(matImp.fragmentShader || '') : '';

  const fuenteVeg = fs.readFileSync(VEG_JS, 'utf8');
  const cte = (re, def) => { const m = fuenteVeg.match(re); return m ? Number(m[1]) : def; };

  salida.cuadro = {
    lotes: veg.lotes.length,
    dibujos: veg.grupo.children.length,
    mallasConSombra: veg.grupo.children.filter(o => o.castShadow).length,
    trisTotales: especies.reduce((s, e) => s + e.tris, 0),
    trisMax: especies.reduce((s, e) => Math.max(s, e.tris), 0),
    materiales: materiales.size,
    fetchsMalla, aluMalla, inyectoMalla,
    fetchsImpostor: contar(fragImp, RE_FETCH),
    aluImpostor: contar(fragImp, RE_ALU),
    largoFragImpostor: fragImp.length,
    constantes: {
      CUPO_ESPECIES: cte(/const CUPO_ESPECIES = (\d+)/, -1),
      MAX_POR_ESPECIE: cte(/const MAX_POR_ESPECIE = (\d+)/, -1),
      MAX_IMPOSTORES: cte(/const MAX_IMPOSTORES = (\d+)/, -1),
      DIST_IMPOSTOR: cte(/const DIST_IMPOSTOR = ([\d.]+)/, -1),
      PASO_REPARTO: cte(/const PASO_REPARTO = ([\d.]+)/, -1),
      RADIO_CELDAS: cte(/const RADIO_CELDAS = (\d+)/, -1),
    },
  };
  salida.especies = especies.map(e => { const { claseAtlas, ...r } = e; return r; });
  salida.atlas = {};
  for (const [k, v] of Object.entries(atlasPorClase)) { const { _ref, ...r } = v; salida.atlas[k] = r; }
  salida.atlasCacheado = cacheado;

  // ── Sotobosque ────────────────────────────────────────────────────────
  try {
    const modSoto = await import(pathToFileURL(SOTO_JS).href);
    sembrarAzar(20260907);
    const soto = new modSoto.Sotobosque({});
    const lotes = (soto.lotes || []).map(l => {
      const g = l.malla.geometry;
      const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      const iny = medirInyeccion(l.malla.material);
      return {
        id: l.tipo ? l.tipo.id : l.malla.name,
        capacidad: l.capacidad ?? l.malla.instanceMatrix.count,
        tris,
        doble: l.malla.material.side === 2,
        castShadow: l.malla.castShadow,
        mapas: mapasDe(l.malla.material).cuales,
        fetchs: mapasDe(l.malla.material).n + iny.fetchs,
        alu: iny.alu,
        inyecto: iny.inyectoFragmento,
      };
    });
    salida.soto = {
      lotes,
      dibujos: soto.grupo.children.length,
      trisCapacidad: lotes.reduce((s, l) => s + l.tris * l.capacidad, 0),
      fetchsMax: lotes.reduce((s, l) => Math.max(s, l.fetchs), 0),
      aluMax: lotes.reduce((s, l) => Math.max(s, l.alu), 0),
      mapas: lotes.reduce((s, l) => s + l.mapas.length, 0),
      construyo: true,
    };
  } catch (e) {
    salida.soto = { construyo: false, error: e.message };
  }

  return salida;
}

function correrTrabajador(modo, veg, soto) {
  const salida = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', modo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, BANCO_VEGETACION: veg, BANCO_SOTOBOSQUE: soto },
  });
  const i = salida.lastIndexOf(MARCA);
  if (i < 0) throw new Error('el trabajador no devolvió nada:\n' + salida.slice(-1200));
  return JSON.parse(salida.slice(i + MARCA.length));
}

// ═══════════════════════════════════════════════════════════════════════════
// LOS SEIS BANCOS
// ═══════════════════════════════════════════════════════════════════════════

const MiB = 1024 * 1024;
const fmt = (n, d = 2) => Number(n).toFixed(d).replace('.', ',');

/** Umbral de «un solo texel»: ninguna coordenada UV puede llevarse tantos
 *  vértices. Hoy la madera entera cae en un punto: 20-30 % de la malla. */
const TECHO_FRAC_UV = 0.06;
/** Variación mínima de luminancia en la ventana de corteza. Un parche liso da
 *  exactamente 0; cualquier corteza dibujada da bastante más. */
const MIN_SIGMA_CORTEZA = 0.015;
/** Y la ventana tiene que ser opaca, o el alphaTest se come el tronco entero. */
const MIN_OPACIDAD_CORTEZA = 0.90;

function banco1Corteza(ahora, base) {
  const L = [];
  if (ahora.error) return { ok: false, ejercitado: 0, motivo: ahora.error.split('\n')[0], lineas: L };

  const conMadera = ahora.especies.filter(e => e.maderaN > 0);
  const baseConMadera = base.especies ? base.especies.filter(e => e.maderaN > 0) : [];
  L.push('  especies con madera identificable (aFlexion ≈ 0): ' + conMadera.length + ' de ' + ahora.especies.length +
    '   (línea de base: ' + baseConMadera.length + ')');

  // COBERTURA: si el marcador dejó de discriminar, el banco no mide nada.
  if (conMadera.length < 20) {
    return { ok: false, ejercitado: conMadera.length, lineas: L,
      motivo: 'el marcador de madera dejó de discriminar: no se puede medir la corteza sin dar verde por vacío' };
  }
  // COBERTURA: la línea de base TIENE que mostrar el defecto, o el instrumento
  // no está midiendo lo que dice medir.
  const peorBase = Math.max(...baseConMadera.map(e => e.fracMaxGrupoUV), 0);
  L.push('  el defecto en la línea de base: hasta el ' + fmt(peorBase * 100, 1) +
    ' % de los vértices de una especie comparten UNA sola UV' +
    (peorBase >= 0.12 ? '   (el instrumento ve el defecto)' : '   >>> LA BASE NO MUESTRA EL DEFECTO'));
  if (peorBase < 0.12) {
    return { ok: false, ejercitado: 0, lineas: L,
      motivo: 'la línea de base no reproduce el defecto que este banco dice medir' };
  }

  let ok = true;
  const malos = [];
  for (const e of conMadera) {
    const c = e.corteza;
    const razones = [];
    if (e.fracMaxGrupoUV > TECHO_FRAC_UV) razones.push('UV degenerada ' + fmt(e.fracMaxGrupoUV * 100, 1) + ' %');
    if (e.maderaUVUnicas < 8) razones.push('sólo ' + e.maderaUVUnicas + ' UV distintas en la madera');
    if (!c) razones.push('no se pudo medir la ventana');
    else {
      if (c.fracOpaca < MIN_OPACIDAD_CORTEZA) razones.push('ventana ' + fmt(c.fracOpaca * 100, 1) + ' % opaca (alphaTest la borra)');
      if (c.lumSigma < MIN_SIGMA_CORTEZA) razones.push('σ luminancia ' + fmt(c.lumSigma, 4) + ' (parche liso)');
    }
    if (razones.length) { ok = false; malos.push(e.id + ': ' + razones.join(' · ')); }
  }

  const mediaSigma = conMadera.reduce((s, e) => s + (e.corteza ? e.corteza.lumSigma : 0), 0) / conMadera.length;
  const mediaUV = conMadera.reduce((s, e) => s + e.maderaUVUnicas, 0) / conMadera.length;
  const mediaOpac = conMadera.reduce((s, e) => s + (e.corteza ? e.corteza.fracOpaca : 0), 0) / conMadera.length;
  const baseSigma = baseConMadera.length
    ? baseConMadera.reduce((s, e) => s + (e.corteza ? e.corteza.lumSigma : 0), 0) / baseConMadera.length : 0;
  const baseUV = baseConMadera.length
    ? baseConMadera.reduce((s, e) => s + e.maderaUVUnicas, 0) / baseConMadera.length : 0;

  L.push('  UV distintas por madera      base ' + fmt(baseUV, 1).padStart(8) + '  →  ahora ' + fmt(mediaUV, 1));
  L.push('  σ de luminancia en la ventana base ' + fmt(baseSigma, 4).padStart(6) + '  →  ahora ' + fmt(mediaSigma, 4));
  L.push('  opacidad de la ventana                      →  ahora ' + fmt(mediaOpac * 100, 1) + ' %');
  L.push('  máx. fracción de vértices en UNA UV  base ' + fmt(peorBase * 100, 1) + ' %  →  ahora ' +
    fmt(Math.max(...conMadera.map(e => e.fracMaxGrupoUV)) * 100, 1) + ' %   (techo ' + fmt(TECHO_FRAC_UV * 100, 0) + ' %)');
  for (const m of malos.slice(0, 8)) L.push('    >>> ' + m);
  if (malos.length > 8) L.push('    … y ' + (malos.length - 8) + ' más');

  return { ok, ejercitado: conMadera.length, unidad: 'especies con madera', lineas: L };
}

function banco2Follaje(ahora, base) {
  const L = [];
  if (ahora.error) return { ok: false, ejercitado: 0, motivo: ahora.error.split('\n')[0], lineas: L };
  let ok = true, ejercitado = 0;

  for (const clase of ['aguja', 'lamina']) {
    const a = ahora.atlas[clase], b = base.atlas ? base.atlas[clase] : null;
    if (!a || !a.hay) { L.push('  ' + clase + ': NO se pudo obtener el atlas'); ok = false; continue; }
    if (!a.tieneLienzo) { L.push('  ' + clase + ': el atlas no salió de un lienzo medible'); ok = false; continue; }
    if (a.noSoportadas.length) {
      L.push('  ' + clase + ': el rasterizador no implementa ' + a.noSoportadas.join(', ') +
        '  >>> el atlas no se pudo pintar entero, no se puede medir');
      ok = false; continue;
    }
    ejercitado += a.primitivas;
    const pa = a.todo.profMedia, pb = b && b.todo ? b.todo.profMedia : 0;
    const ca = a.todo.fracCubierta, cb = b && b.todo ? b.todo.fracCubierta : 0;
    L.push('  ' + clase.padEnd(7) + ' primitivas ' + String(a.primitivas).padStart(6) +
      (b ? ' (base ' + b.primitivas + ')' : '') +
      '   lienzo ' + a.N + '²' + (b && b.N !== a.N ? ' (base ' + b.N + '²)' : ''));
    L.push('          profundidad media de capas  base ' + fmt(pb, 2) + '  →  ahora ' + fmt(pa, 2) +
      (pa >= pb * 1.5 ? '   más de una capa' : '   >>> NO GANÓ CAPAS'));
    L.push('          cobertura del lienzo        base ' + fmt(cb * 100, 1) + ' %  →  ahora ' + fmt(ca * 100, 1) + ' %');
    if (!(pa >= pb * 1.5)) ok = false;
    if (a.N > (b ? b.N : 512)) {
      L.push('          >>> el lienzo creció: eso sale del presupuesto de VRAM (banco 3)');
    }
    if (a.mipmaps === false) { L.push('          >>> sin mipmaps: el follaje lejano va a titilar'); ok = false; }
  }

  L.push('  atlas cacheado (una textura por clase, no una por especie): ' + (ahora.atlasCacheado ? 'sí' : 'NO'));
  L.push('  texturas de follaje distintas en las 30 especies: ' + ahora.vram.texturasFollaje +
    (base.vram ? '   (base ' + base.vram.texturasFollaje + ')' : ''));
  if (!ahora.atlasCacheado) ok = false;
  if (base.vram && ahora.vram.texturasFollaje > base.vram.texturasFollaje) ok = false;

  if (ejercitado === 0) return { ok: false, ejercitado: 0, lineas: L, motivo: 'no se pintó ni una primitiva: el atlas no se midió' };
  return { ok, ejercitado, unidad: 'primitivas rasterizadas', lineas: L };
}

function banco3Vram(ahora, base) {
  const L = [];
  if (ahora.error) return { ok: false, ejercitado: 0, motivo: ahora.error.split('\n')[0], lineas: L };
  const i = ahora.impostor, ib = base.impostor || {};

  // COBERTURA: si no se horneó nada, no hay nada que medir.
  if (!i.objetivos || !i.llamadasRender) {
    return { ok: false, ejercitado: 0, lineas: L,
      motivo: 'no se creó un solo objetivo de render: el horneado no corrió y la VRAM no se midió' };
  }

  L.push('  objetivos de render   base ' + (ib.objetivos ?? '—') + ' × ' + (ib.dims ?? '—') +
    '  →  ahora ' + i.objetivos + ' × ' + i.dims + (i.mipmaps ? ' con mipmaps' : ' sin mipmaps'));
  L.push('  vistas por especie    base ' + (ib.vistasPorHorneada ?? '—') + '  →  ahora ' + i.vistasPorHorneada +
    '   (' + i.llamadasRender + ' llamadas a render() en total)');
  L.push('');
  // ── El desglose completo, partida por partida ───────────────────────
  const va = ahora.vram, vb = base.vram || {};
  const fila = (etiqueta, ahoraB, baseB) => {
    L.push('    ' + etiqueta.padEnd(46, '.') + ' ' + fmt(ahoraB / MiB).padStart(8) + ' MiB' +
      (baseB === undefined ? '' : '   (base ' + fmt(baseB / MiB) + ')'));
  };
  L.push('  Desglose, partida por partida:');
  fila('color de los objetivos de render + mipmaps', va.bytesImpostores, vb.bytesImpostores);
  fila('búferes de PROFUNDIDAD de esos objetivos', va.bytesProfundidad, vb.bytesProfundidad);
  fila('atlas de follaje (2 clases, con mipmaps)', va.bytesFollaje, vb.bytesFollaje);
  fila('búferes de instancia (matriz 16 + iTinte 3)', va.bytesInstancia, vb.bytesInstancia);
  fila('geometría de las mallas y los planos', va.bytesGeometria, vb.bytesGeometria);
  L.push('    ' + '─'.repeat(46) + ' ' + '─'.repeat(12));
  fila('TOTAL REAL de la vegetación', va.totalReal, vb.totalReal);
  L.push('');
  L.push('  profundidad: ' + i.profundidadesDistintas + ' búfer(es) distinto(s) para ' + i.objetivos +
    ' objetivos' + (i.objetivosConProfCompartida
      ? '  ·  ' + i.objetivosConProfCompartida + ' usan una DepthTexture compartida'
      : '  ·  ninguno comparte: uno propio por objetivo'));
  L.push('  mallas recorridas para los búferes de instancia: ' + va.mallasContadas);
  L.push('');

  // ── La reconciliación de los dos números que circulaban ─────────────
  L.push('  RECONCILIACIÓN de los dos números de VRAM que andaban dando vueltas:');
  L.push('    · «62,67 MiB» = color + mipmaps de los objetivos (' + fmt(va.bytesImpostores / MiB) +
    ') + atlas de follaje (' + fmt(va.bytesFollaje / MiB) + ').');
  L.push('      Es lo que este mismo banco sumaba antes de esta corrección, y por eso');
  L.push('      se reportó: le faltaban la profundidad y los búferes de instancia.');
  L.push('    · «121,5 MiB» = color + mipmaps + profundidad + instancias, SIN los atlas');
  L.push('      de follaje. Es la cuenta por especie de r3-flora.md (4,051 × 30).');
  L.push('    · Ninguno de los dos es el total. Los dos miden subconjuntos distintos y');
  L.push('      por eso no se contradicen: se solapan. El total es ' + fmt(va.totalReal / MiB) + ' MiB.');
  L.push('');
  L.push('  Contra el presupuesto de la ronda:');
  L.push('    techo declarado en RONDA3.md ................ ' + fmt(TECHO_VRAM_MIB, 0) + ' MiB');
  L.push('    ya gastado por el atlas de fauna (fase 1) ... ' + fmt(VRAM_FAUNA_MIB) + ' MiB');
  L.push('    hueco que le quedaba a la fase 3 ............ ' + fmt(TECHO_VRAM_MIB - VRAM_FAUNA_MIB) + ' MiB');
  L.push('    la vegetación, que ese techo no contaba .... ' + fmt(va.totalReal / MiB) + ' MiB' +
    '   (' + fmt(va.totalReal / MiB / TECHO_VRAM_MIB, 1) + '× el techo entero)');
  L.push('    (la cabecera de Vegetacion.js declara 76,5 MiB: color+mipmaps+instancias,');
  L.push('     también sin la profundidad. Los tres números que existían en el repo');
  L.push('     contaban tres subconjuntos distintos, y los tres caían del lado cómodo.)');

  // El gate NO es el techo de 24 MiB: ese techo era para los atlas NUEVOS de la
  // ronda, y la vegetación ya gastaba lo suyo desde antes. El gate es cero
  // regresión sobre el TOTAL REAL: si se midiera sobre `total` a secas, el
  // ahorro de compartir la profundidad sería invisible y el banco daría verde
  // sin haber mirado la única partida que la fase se propuso bajar.
  const hayBase = vb.totalReal !== undefined;
  const delta = hayBase ? va.totalReal - vb.totalReal : 0;
  const peor = hayBase ? delta > 1024 : false;
  L.push('');
  L.push('  Gate: cero regresión de VRAM REAL contra ' + BASE_COMMIT + ' → ' +
    (!hayBase ? 'sin línea de base comparable'
      : peor ? 'ROJO, subió ' + fmt(delta / MiB) + ' MiB'
             : 'verde' + (delta < 0 ? ', y bajó ' + fmt(-delta / MiB) + ' MiB' : ', sin cambio')));
  if (!i.todosIguales) L.push('  >>> los objetivos de render no son todos del mismo tamaño');

  // ── Sub-gate: el ahorro que la fase se propuso, entregado ────────────
  //
  // «Cero regresión» solo, como gate, no alcanza acá: no distingue entregar el
  // ahorro de no tocar nada. Y el ahorro de esta fase es de una sola forma
  // concreta —un búfer de profundidad compartido entre los 30 hornos— así que
  // se comprueba esa forma y no un número que se pueda alcanzar de casualidad.
  //
  // Que el búfer sólo haga falta MIENTRAS se hornea y quede vivo para siempre
  // es todo el hallazgo. Se hornea de a uno, así que nunca hay dos objetivos
  // escribiendo la misma profundidad a la vez.
  const compartida = i.profundidadesDistintas === 1 && i.objetivosConProfCompartida === i.objetivos;
  const sinProfundidad = va.bytesProfundidad === 0 && i.objetivos > 0;
  L.push('');
  if (compartida) {
    L.push('  Sub-gate: los ' + i.objetivos + ' hornos comparten UN búfer de profundidad → verde' +
      (vb.bytesProfundidad ? '   (ahorro medido: ' + fmt((vb.bytesProfundidad - va.bytesProfundidad) / MiB) + ' MiB)' : ''));
  } else if (sinProfundidad) {
    L.push('  Sub-gate: ROJO — no hay búfer de profundidad en absoluto. Ojo: el horneado');
    L.push('    dibuja follaje que se tapa a sí mismo, y sin prueba de profundidad sale en');
    L.push('    orden de dibujo. Esto no es el ahorro: es una imagen mal horneada.');
  } else {
    L.push('  Sub-gate: ROJO — ' + i.profundidadesDistintas + ' búfer(es) de profundidad para ' +
      i.objetivos + ' objetivos. El ahorro de la fase (compartir uno solo) no está entregado.');
  }

  // COBERTURA de la partida nueva: si la profundidad diera cero en los dos
  // escenarios, todo lo de arriba sería cierto por vacío justo en la partida
  // que el banco vino a medir.
  if (!(va.bytesProfundidad > 0) && !(vb.bytesProfundidad > 0)) {
    L.push('  >>> la partida de profundidad dio 0 en los dos escenarios: no se midió nada');
    return { ok: false, ejercitado: i.objetivos, unidad: 'objetivos de render', lineas: L,
      motivo: 'profundidad = 0 en ambos escenarios: el banco no ejercitó la partida grande' };
  }
  if (!(va.bytesInstancia > 0)) {
    return { ok: false, ejercitado: i.objetivos, unidad: 'objetivos de render', lineas: L,
      motivo: 'los búferes de instancia dieron 0: no se recorrió una sola malla' };
  }

  return {
    ok: !peor && compartida, ejercitado: i.objetivos, unidad: 'objetivos de render', lineas: L,
    motivo: peor ? 'la VRAM real subió contra ' + BASE_COMMIT
      : compartida ? undefined
      : 'la profundidad no se comparte: el ahorro de 43,5 MiB no está entregado',
  };
}

function banco4Regresion(ahora, base) {
  const L = [];
  if (ahora.error) return { ok: false, ejercitado: 0, motivo: ahora.error.split('\n')[0], lineas: L };
  const a = ahora.cuadro, b = base.cuadro || {};
  let ok = true;

  // COBERTURA: la inyección de shader tiene que haber producido texto, o los
  // contadores de ALU y de lecturas miden un shader vacío.
  if (!a.inyectoMalla) {
    return { ok: false, ejercitado: 0, lineas: L,
      motivo: 'onBeforeCompile no inyectó nada sobre el shader falso: los contadores por fragmento no midieron nada' };
  }

  const fila = (nombre, va, vb, peorEs, tol = 0) => {
    const malo = peorEs === 'sube' ? va > vb * (1 + tol) : va < vb * (1 - tol);
    if (malo) ok = false;
    L.push('  ' + nombre.padEnd(34) + String(vb).padStart(9) + '  →  ' + String(va).padStart(9) +
      (malo ? '   >>> REGRESIÓN' : ''));
  };

  L.push('  ' + ''.padEnd(34) + BASE_COMMIT.padStart(9) + '     ahora');
  fila('dibujos del grupo', a.dibujos, b.dibujos, 'sube');
  fila('mallas que proyectan sombra', a.mallasConSombra, b.mallasConSombra, 'sube');
  fila('triángulos de las 30 plantas', Math.round(a.trisTotales), Math.round(b.trisTotales), 'sube', 0.02);
  fila('triángulos de la planta más cara', Math.round(a.trisMax), Math.round(b.trisMax), 'sube', 0.02);
  fila('materiales distintos', a.materiales, b.materiales, 'sube');
  L.push('');
  L.push('  Por fragmento — la moneda cara de esta máquina (8× en ALU, 2,3× en textura):');
  fila('lecturas de textura · malla', a.fetchsMalla, b.fetchsMalla, 'sube');
  fila('ALU inyectada · malla', a.aluMalla, b.aluMalla, 'sube');
  fila('lecturas de textura · impostor', a.fetchsImpostor, b.fetchsImpostor, 'sube');
  fila('ALU · impostor', a.aluImpostor, b.aluImpostor, 'sube');
  L.push('');
  L.push('  Constantes de población (una subida es más dibujos y más instancias):');
  for (const k of Object.keys(b.constantes || {})) {
    const va = a.constantes[k], vb = b.constantes[k];
    const sube = ['CUPO_ESPECIES', 'MAX_POR_ESPECIE', 'MAX_IMPOSTORES', 'RADIO_CELDAS'].includes(k) && va > vb;
    const bajaPaso = k === 'PASO_REPARTO' && va < vb;
    if (sube || bajaPaso) ok = false;
    L.push('    ' + k.padEnd(18) + String(vb).padStart(8) + '  →  ' + String(va).padStart(8) +
      (va !== vb ? (sube || bajaPaso ? '   >>> REGRESIÓN' : '   (cambió, a la baja)') : ''));
  }
  L.push('');
  L.push('  Presupuesto: los árboles son el ' + fmt(FRACCION_ARBOLES * 100, 0) + ' % de ' + fmt(MS_CUADRO_BAJA) +
    ' ms a Baja 1024×576 = ' + fmt(MS_CUADRO_BAJA * FRACCION_ARBOLES) + ' ms. Cero regresión.');

  return { ok, ejercitado: a.lotes, unidad: 'lotes de especie', lineas: L };
}

function banco5Sotobosque(ahora, base) {
  const L = [];
  const a = ahora.soto, b = base.soto || {};
  if (!a || !a.construyo) {
    return { ok: false, ejercitado: 0, lineas: L, motivo: 'Sotobosque no construyó: ' + (a && a.error) };
  }
  if (!b.construyo) return { ok: false, ejercitado: 0, lineas: L, motivo: 'la línea de base de Sotobosque no construyó' };
  let ok = true;
  const fila = (nombre, va, vb, tol = 0) => {
    const malo = va > vb * (1 + tol);
    if (malo) ok = false;
    L.push('  ' + nombre.padEnd(34) + String(vb).padStart(9) + '  →  ' + String(va).padStart(9) + (malo ? '   >>> REGRESIÓN' : ''));
  };
  L.push('  ' + ''.padEnd(34) + BASE_COMMIT.padStart(9) + '     ahora');
  fila('lotes / dibujos', a.dibujos, b.dibujos);
  fila('triángulos a capacidad plena', Math.round(a.trisCapacidad), Math.round(b.trisCapacidad), 0.02);
  fila('mapas ligados (0 = color por vértice)', a.mapas, b.mapas);
  fila('lecturas de textura por fragmento', a.fetchsMax, b.fetchsMax);
  fila('ALU inyectada por fragmento', a.aluMax, b.aluMax);
  const dobles = a.lotes.filter(l => l.doble).length, doblesB = b.lotes.filter(l => l.doble).length;
  fila('lotes a dos caras (doble sombreado)', dobles, doblesB);
  const sombras = a.lotes.filter(l => l.castShadow).length;
  L.push('  lotes que proyectan sombra                    0  →  ' + sombras + (sombras ? '   >>> REGRESIÓN' : ''));
  if (sombras) ok = false;
  L.push('');
  L.push('  Presupuesto: el sotobosque bajó al ' + fmt(FRACCION_SOTO * 100, 1) + ' % del cuadro (' +
    fmt(MS_CUADRO_BAJA * FRACCION_SOTO) + ' ms) en una ronda anterior. No se devuelve.');
  return { ok, ejercitado: a.lotes.length, unidad: 'lotes de sotobosque', lineas: L };
}

function banco6Arranque(sinRender, ahora) {
  const L = [];
  let ok = true;
  // 1. Sin renderizador (y sin red) los dos módulos construyen igual.
  if (sinRender.error) {
    L.push('  >>> sin renderizador y sin red, Vegetacion NO construyó: ' + sinRender.error.split('\n')[0]);
    ok = false;
  } else {
    L.push('  sin renderizador y con la red caída: ' + sinRender.cuadro.lotes + ' lotes, ' +
      Math.round(sinRender.cuadro.trisTotales) + ' triángulos, ' + sinRender.impostor.objetivos +
      ' objetivos de render (0 es lo correcto: no hay con qué hornear)');
    if (sinRender.cuadro.lotes < 1) { ok = false; L.push('  >>> no se armó ni un lote'); }
    if (!sinRender.soto || !sinRender.soto.construyo) { ok = false; L.push('  >>> Sotobosque no construyó sin red'); }
  }
  // 2. Ningún import estático de public/ — rompería `vite build` si falta el archivo.
  let importsMalos = 0;
  for (const f of [VEG_JS, SOTO_JS]) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/^\s*import\s[^\n]*from\s*['"]([^'"]+)['"]/gm)) {
      if (/public\//.test(m[1]) || /\/tex\//.test(m[1])) {
        L.push('  >>> import estático de una salida de horneador: ' + path.basename(f) + ' → ' + m[1]);
        importsMalos++;
      }
    }
  }
  L.push('  imports estáticos de public/ o /tex/: ' + importsMalos + (importsMalos ? '   >>> rompe el build si falta el archivo' : ''));
  if (importsMalos) ok = false;

  // 3. El build de verdad.
  let build = 'no se pudo correr';
  try {
    const out = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'],
      { cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
    const m = out.match(/(\d+)\s+modules transformed/);
    build = 'pasa' + (m ? ' (' + m[1] + ' módulos)' : '');
  } catch (e) {
    build = 'FALLA: ' + String(e.stdout || e.message).split('\n').filter(Boolean).slice(-3).join(' | ');
    ok = false;
  }
  L.push('  npx vite build: ' + build);

  // 4. Ninguna especie queda en negro puro (la trampa de las piedras de la ronda 1).
  if (!ahora.error) {
    const negros = ahora.especies.filter(e => e.verts === 0);
    L.push('  especies con geometría vacía: ' + negros.length);
    if (negros.length) ok = false;
  }
  return { ok, ejercitado: 4, unidad: 'comprobaciones de arranque', lineas: L };
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDA
// ═══════════════════════════════════════════════════════════════════════════

const resultados = [];
let hayRojo = false;

function banco(nombre, r) {
  console.log('\n' + '═'.repeat(78));
  console.log(nombre);
  console.log('═'.repeat(78));
  for (const l of r.lineas || []) console.log(l);
  if (r.motivo) console.log('  MOTIVO: ' + r.motivo);
  console.log('  → ' + (r.ok ? 'VERDE' : 'ROJO') + '   (ejercitó ' + r.ejercitado + ' ' + (r.unidad || '') + ')');
  resultados.push({ nombre, verde: r.ok, ejercitado: r.ejercitado, motivo: r.motivo });
  if (!r.ok) hayRojo = true;
}

function extraerBase() {
  fs.mkdirSync(TMP, { recursive: true });
  const salidas = {};
  for (const [clave, rel] of [['veg', 'src/world/Vegetacion.js'], ['soto', 'src/world/Sotobosque.js']]) {
    const t = execFileSync('git', ['show', BASE_COMMIT + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const p = path.join(TMP, 'base-' + path.basename(rel));
    fs.writeFileSync(p, t);
    salidas[clave] = p;
  }
  return salidas;
}

async function main() {
  console.log('BANCO DE LA FASE 3 · ronda 3 · SurviBar');
  console.log('escrito por el jefe, en paralelo al agente. ' + new Date().toISOString());
  console.log('midiendo: ' + path.relative(RAIZ, VEG_JS) + '  y  ' + path.relative(RAIZ, SOTO_JS));

  const base = extraerBase();
  console.log('línea de base: ' + BASE_COMMIT + ' (los dos archivos, extraídos con git show)');

  console.log('\ncorriendo los escenarios, un proceso por cada uno…');
  const esc = {};
  for (const [clave, modo, v, s] of [
    ['ahora', 'normal', VEG_JS, SOTO_JS],
    ['base', 'normal', base.veg, base.soto],
    ['sinRender', 'sin-render', VEG_JS, SOTO_JS],
  ]) {
    process.stdout.write('  · ' + clave.padEnd(10) + '(' + modo + ') … ');
    try {
      esc[clave] = normalizar(correrTrabajador(modo, v, s));
      const e = esc[clave];
      console.log(e.error ? 'ERROR: ' + String(e.error).split('\n')[0]
        : (e.cuadro.lotes + ' lotes · ' + e.impostor.objetivos + ' objetivos · ' +
           (e.atlas.lamina ? e.atlas.lamina.primitivas + ' primitivas' : 'sin atlas')));
      for (const a of e.avisos.slice(0, 6)) console.log('      aviso: ' + a);
    } catch (err) {
      esc[clave] = normalizar(null, err.message);
      console.log('ERROR: ' + err.message.split('\n')[0]);
    }
  }

  // ── Guarda del camino feliz ───────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('GUARDA DEL CAMINO FELIZ (trampa nº 8 de ESTADO.md)');
  console.log('═'.repeat(78));
  const a = normalizar(esc.ahora, 'el escenario «ahora» no llegó a correr');
  const b = normalizar(esc.base, 'el escenario «base» no llegó a correr');
  esc.ahora = a; esc.base = b;
  esc.sinRender = normalizar(esc.sinRender, 'el escenario «sinRender» no llegó a correr');
  const prims = (a.atlas.lamina ? a.atlas.lamina.primitivas : 0) + (a.atlas.aguja ? a.atlas.aguja.primitivas : 0);
  const sinSoporte = []
    .concat((a.atlas.lamina && a.atlas.lamina.noSoportadas) || [])
    .concat((a.atlas.aguja && a.atlas.aguja.noSoportadas) || []);
  const felizOk = !a.error && !b.error
    && prims > 500 && sinSoporte.length === 0
    && a.cuadro.lotes >= 25 && a.cuadro.trisTotales > 1000
    && a.impostor.objetivos > 0 && a.impostor.llamadasRender > 0
    && a.cuadro.inyectoMalla > 0
    && b.especies.length > 0;
  console.log('  atlas pintado de verdad: ' + prims + ' primitivas rasterizadas · operaciones sin implementar: ' +
    (sinSoporte.length ? sinSoporte.join(', ') : 'ninguna'));
  console.log('  geometría armada: ' + (a.cuadro.lotes || 0) + ' lotes · ' + Math.round(a.cuadro.trisTotales || 0) + ' triángulos');
  console.log('  horneado ejercitado: ' + (a.impostor.objetivos || 0) + ' objetivos de render · ' +
    (a.impostor.llamadasRender || 0) + ' llamadas a render()');
  console.log('  inyección de shader medible: ' + (a.cuadro.inyectoMalla || 0) + ' caracteres agregados al fragmento');
  console.log('  línea de base leída: ' + (b.especies ? b.especies.length : 0) + ' especies');
  if (!felizOk) {
    console.log('  >>> EL CAMINO FELIZ NO LLEGÓ A FUNCIONAR. Todo lo que digan los bancos de abajo');
    console.log('      puede ser cierto por vacío. No se cierra la fase con esto.');
    hayRojo = true;
  } else {
    console.log('  el camino feliz corrió entero: se pintó el atlas, se armó la geometría y se horneó.');
  }

  banco('1 · CORTEZA — ningún tronco muestrea un solo texel, y la ventana es opaca y con grano', banco1Corteza(a, b));
  banco('2 · FOLLAJE MULTICAPA — el atlas gana capas y sigue costando cero por cuadro', banco2Follaje(a, b));
  banco('3 · VRAM — el banco de memoria que faltaba: impostores y atlas de follaje', banco3Vram(a, b));
  banco('4 · CERO REGRESIÓN — los árboles son el 22 % del cuadro', banco4Regresion(a, b));
  banco('5 · EL SOTOBOSQUE NO VUELVE — sigue en el 4,5 % al que bajó', banco5Sotobosque(a, b));
  banco('6 · ARRANQUE — sin renderizador, sin red, sin import estático, y el build pasa', banco6Arranque(esc.sinRender, a));

  console.log('\n' + '═'.repeat(78));
  console.log('RESUMEN');
  console.log('═'.repeat(78));
  console.log('  ' + (felizOk ? 'VERDE' : 'ROJO ') + '  guarda del camino feliz');
  for (const r of resultados) {
    console.log('  ' + (r.verde ? 'VERDE' : 'ROJO ') + '  ejercitó ' + String(r.ejercitado).padStart(5) + '  ' + r.nombre +
      (r.motivo ? '\n           ' + r.motivo.split('\n')[0] : ''));
  }
  console.log('');
  console.log(hayRojo ? 'LA FASE 3 NO CIERRA.' : 'LOS SEIS BANCOS EN VERDE, CON COBERTURA DEMOSTRADA.');
  process.exit(hayRojo ? 1 : 0);
}

export { crearLienzo, medirVentana, medirInyeccion, shaderFalso, contar, RE_FETCH, RE_ALU };

if (process.argv[2] === '--worker') {
  trabajador(process.argv[3])
    .then(r => { console.log(MARCA + JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.log(MARCA + JSON.stringify({ ...FORMA_VACIA, error: 'trabajador: ' + e.stack })); process.exit(0); });
} else if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
