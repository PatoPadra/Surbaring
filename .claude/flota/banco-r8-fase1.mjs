/**
 * BANCO DE LA FASE 1 (rumbo) — ronda 8.
 *
 * Lo escribe el JEFE contra el contrato de RONDA8.md, antes de que exista una
 * línea del agente. Carga los módulos de verdad —`Mapa`, `Minimapa`, `Hallazgos` y
 * `Jugador`— sobre un DOM de mentira cuyo lienzo **anota** lo que se dibuja, con
 * su matriz de transformación: así se sabe hacia dónde apunta una flecha sin
 * rasterizar nada.
 *
 *   1. LA FLECHA — la premisa (el Jugador de verdad avanza hacia (−sin, −cos)), y
 *      la flecha del mapa apunta ahí a menos de 1°, en ocho giros y a dos zooms.
 *   2. LA BRÚJULA — la regla de `#brujula` en index.html tiene `position`.
 *   3. EL ZOOM — por la rueda y el arrastre, sin mirar métodos internos: la
 *      escalera conserva los cinco peldaños y llega a 2 m/px o menos, el zoom deja
 *      quieto lo que está bajo el cursor, la vista no se sale del mundo, el pie
 *      dice «ampliado» pasado el dato, y la flecha y la X de una obra miden lo mismo
 *      en píxeles a cualquier zoom.
 *   4. ABRIR CENTRADO — al abrir, la vista mira al jugador; al nivel 0 no cambia.
 *   5. EL MINIMAPA — existe, vive en #hud, se proyecta norte arriba con el jugador
 *      al centro, su ventana mide de 400 a 1500 m, la flecha apunta bien, las
 *      marcas salen de `hallazgos.dibujar` con la misma proyección, se esconde con
 *      el mapa abierto, no redibuja todos los cuadros y no reconstruye el relieve
 *      por metro caminado.
 *   6. SIN REGRESIÓN — los siete bancos de la ronda 7.
 *   7. ARRANQUE — `vite build`.
 *
 * Lo que este banco NO ve —el centro real de la brújula en la pantalla, el velo en
 * los píxeles del minimapa, el costo en milisegundos— lo mide la mitad navegador,
 * `banco-r8-fase1.navegador.js`.
 *
 * Uso: node .claude/flota/banco-r8-fase1.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
/** index.html vive al lado de src: con una copia, al lado de la copia. */
const HTML = path.join(SRC, '..', 'index.html');

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

const TAMANO = 65536, MITAD = TAMANO / 2, LADO = 640;
const GRADO = Math.PI / 180;
const difAng = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

// ═══════════════════════════════════════════════════════════════════════════
// Un reloj de mentira: setTimeout, requestIdleCallback, rAF y performance.now
// ═══════════════════════════════════════════════════════════════════════════

const reloj = { t: 1000, cola: [], sig: 1 };
function instalarReloj() {
  globalThis.setTimeout = (fn, ms = 0, ...a) => { const id = reloj.sig++; reloj.cola.push({ id, t: reloj.t + Math.max(0, ms), fn: () => fn(...a) }); return id; };
  globalThis.clearTimeout = (id) => { reloj.cola = reloj.cola.filter((x) => x.id !== id); };
  globalThis.setInterval = (fn, ms = 0) => { const id = reloj.sig++; const rep = () => { fn(); reloj.cola.push({ id, t: reloj.t + Math.max(1, ms), fn: rep }); }; reloj.cola.push({ id, t: reloj.t + Math.max(1, ms), fn: rep }); return id; };
  globalThis.clearInterval = globalThis.clearTimeout;
  globalThis.requestIdleCallback = (fn) => globalThis.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 40 }), 1);
  globalThis.cancelIdleCallback = globalThis.clearTimeout;
  globalThis.requestAnimationFrame = (fn) => globalThis.setTimeout(() => fn(reloj.t), 16);
  globalThis.cancelAnimationFrame = globalThis.clearTimeout;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => reloj.t, mark() {}, measure() {} }, configurable: true, writable: true });
  const DateReal = Date;
  globalThis.Date = class extends DateReal { static now() { return reloj.t; } };
}
/** Adelanta el reloj y corre lo que venza, en orden. */
function avanzar(ms) {
  const fin = reloj.t + ms;
  for (let vueltas = 0; vueltas < 10000; vueltas++) {
    reloj.cola.sort((a, b) => a.t - b.t || a.id - b.id);
    const x = reloj.cola[0];
    if (!x || x.t > fin) break;
    reloj.cola.shift();
    reloj.t = Math.max(reloj.t, x.t);
    x.fn();
  }
  reloj.t = fin;
}

// ═══════════════════════════════════════════════════════════════════════════
// Un DOM de mentira, con un lienzo que anota
// ═══════════════════════════════════════════════════════════════════════════

function claseLista() {
  const set = new Set();
  return {
    set,
    add: (...n) => n.forEach((x) => set.add(x)),
    remove: (...n) => n.forEach((x) => set.delete(x)),
    contains: (n) => set.has(n),
    toggle(n, forzar) { const poner = forzar === undefined ? !set.has(n) : !!forzar; if (poner) set.add(n); else set.delete(n); return poner; },
    toString: () => [...set].join(' '),
    get length() { return set.size; },
  };
}

/**
 * El contexto 2D que anota. Lleva la matriz como un navegador —save, restore,
 * translate, rotate, scale, setTransform— y guarda cada relleno y cada trazo con
 * sus puntos ya en píxeles del lienzo. Lo que no conoce, lo acepta sin hacer nada.
 */
function ctxQueAnota(lienzo) {
  const reg = { rellenos: [], trazos: [], imagenes: [], textos: [], limpiezas: 0 };
  let m = [1, 0, 0, 1, 0, 0];
  const pila = [];
  let camino = [], curva = false, rect = false;
  const T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mult = ([A, B, C, D, E, F]) => {
    const [a, b, c, d, e, f] = m;
    m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  };
  const props = {
    canvas: lienzo, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low', globalCompositeOperation: 'source-over',
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none',
    lineDashOffset: 0, miterLimit: 10, direction: 'inherit',
  };
  const metodos = {
    registro: reg,
    save() { pila.push({ m: [...m], p: { ...props } }); },
    restore() { const s = pila.pop(); if (s) { m = s.m; Object.assign(props, s.p); } },
    translate(x, y) { mult([1, 0, 0, 1, x, y]); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); mult([c, s, -s, c, 0, 0]); },
    scale(x, y = x) { mult([x, 0, 0, y, 0, 0]); },
    transform(a, b, c, d, e, f) { mult([a, b, c, d, e, f]); },
    setTransform(a, b, c, d, e, f) {
      if (a && typeof a === 'object') m = [a.a ?? 1, a.b ?? 0, a.c ?? 0, a.d ?? 1, a.e ?? 0, a.f ?? 0];
      else if (a === undefined) m = [1, 0, 0, 1, 0, 0];
      else m = [a, b, c, d, e, f];
    },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    getTransform() { const [a, b, c, d, e, f] = m; return { a, b, c, d, e, f }; },
    beginPath() { camino = []; curva = false; rect = false; },
    moveTo(x, y) { camino.push(T(x, y)); },
    lineTo(x, y) { camino.push(T(x, y)); },
    closePath() {},
    arc(x, y) { curva = true; camino.push(T(x, y)); },
    ellipse(x, y) { curva = true; camino.push(T(x, y)); },
    arcTo(x, y) { curva = true; camino.push(T(x, y)); },
    quadraticCurveTo(cx, cy, x, y) { curva = true; camino.push(T(x, y)); },
    bezierCurveTo(a, b, c, d, x, y) { curva = true; camino.push(T(x, y)); },
    rect(x, y, w, h) { rect = true; camino.push(T(x, y), T(x + w, y), T(x + w, y + h), T(x, y + h)); },
    roundRect(x, y, w, h) { rect = true; curva = true; camino.push(T(x, y), T(x + w, y + h)); },
    fill() { reg.rellenos.push({ puntos: camino.map((p) => [...p]), curva, rect, estilo: props.fillStyle }); },
    stroke() { reg.trazos.push({ puntos: camino.map((p) => [...p]), curva, rect, estilo: props.strokeStyle, ancho: props.lineWidth }); },
    fillRect(x, y, w, h) { reg.rellenos.push({ puntos: [T(x, y), T(x + w, y), T(x + w, y + h), T(x, y + h)], curva: false, rect: true, estilo: props.fillStyle }); },
    strokeRect() {},
    clearRect() { reg.limpiezas++; },
    drawImage(img, ...a) { reg.imagenes.push({ img, a, m: [...m] }); },
    putImageData() {},
    createImageData(w, h) { return typeof w === 'object' ? new ImageData(w.width, w.height) : new ImageData(w, h); },
    getImageData(x, y, w, h) { return new ImageData(w, h); },
    fillText(t, x, y) { reg.textos.push({ t: String(t), p: T(x, y) }); },
    strokeText() {},
    measureText(t) { return { width: String(t).length * 5.5, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createConicGradient() { return { addColorStop() {} }; },
    createPattern() { return {}; },
    clip() {}, setLineDash() {}, getLineDash() { return []; },
    isPointInPath() { return false; }, isPointInStroke() { return false; },
  };
  // Como en un navegador, a un contexto se le puede reemplazar un método y después
  // borrar el reemplazo: el falsador lo usa.
  const sobre = {};
  return new Proxy(props, {
    get(t, k) {
      if (k in sobre) return sobre[k];
      if (k in metodos) return metodos[k];
      if (k in t) return t[k];
      return typeof k === 'string' ? () => {} : undefined;
    },
    set(t, k, v) { if (k in metodos) sobre[k] = v; else t[k] = v; return true; },
    deleteProperty(t, k) { if (k in sobre) delete sobre[k]; else delete t[k]; return true; },
  });
}

let DOCUMENTO = null;

class ElementoFalso {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.id = '';
    this.children = [];
    this.parentNode = null;
    this.classList = claseLista();
    this.style = new Proxy({}, {
      get: (t, k) => (k === 'setProperty' ? ((a, b) => { t[a] = b; }) : k === 'getPropertyValue' ? ((a) => t[a] ?? '') : k === 'removeProperty' ? ((a) => { delete t[a]; }) : (t[k] ?? '')),
      set: (t, k, v) => { t[k] = v; return true; },
    });
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.title = '';
    this._html = '';
    this._consultas = new Map();
    this._escuchas = new Map();
    this.atributos = {};
  }
  get className() { return this.classList.toString(); }
  set className(v) { this.classList.set.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get parentElement() { return this.parentNode; }
  get childNodes() { return this.children; }
  get firstElementChild() { return this.children[0] ?? null; }
  get firstChild() { return this.children[0] ?? null; }
  get isConnected() { for (let x = this; x; x = x.parentNode) if (x === DOCUMENTO?.documentElement) return true; return false; }
  get innerHTML() { return this._html; }
  set innerHTML(h) { this._html = String(h); this._consultas.clear(); this.children.length = 0; }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.children.push(n); return n; }
  append(...ns) { for (const n of ns) if (n && typeof n === 'object') this.appendChild(n); }
  prepend(...ns) { this.append(...ns); }
  insertBefore(n) { return this.appendChild(n); }
  insertAdjacentHTML(pos, html) { this._html += html; }
  insertAdjacentElement(pos, n) { return this.appendChild(n); }
  replaceChildren(...ns) { this.children.length = 0; this.append(...ns); }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); n.parentNode = null; return n; }
  remove() { this.parentNode?.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  closest(sel) { for (let x = this; x; x = x.parentNode) if (coincide(x, sel)) return x; return null; }
  matches(sel) { return coincide(this, sel); }
  setAttribute(k, v) {
    this.atributos[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
    if (k === 'width') this.width = Number(v);
    if (k === 'height') this.height = Number(v);
  }
  getAttribute(k) { return k === 'id' ? this.id : k === 'class' ? this.className : (this.atributos[k] ?? null); }
  hasAttribute(k) { return k in this.atributos; }
  removeAttribute(k) { delete this.atributos[k]; }
  addEventListener(t, f) { if (!this._escuchas.has(t)) this._escuchas.set(t, []); this._escuchas.get(t).push(f); }
  removeEventListener(t, f) { const l = this._escuchas.get(t); if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } }
  dispatchEvent(ev) { for (const f of [...(this._escuchas.get(ev.type) || [])]) f.call(this, ev); return true; }
  getBoundingClientRect() {
    const w = this.width ?? 0, h = this.height ?? 0;
    return { left: 0, top: 0, x: 0, y: 0, width: w, height: h, right: w, bottom: h };
  }
  setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
  focus() {} blur() {} click() {}
  querySelectorAll(sel) {
    const out = [];
    const rec = (n) => {
      for (const h of [...n.children, ...n._consultas.values()]) { if (coincide(h, sel)) out.push(h); rec(h); }
    };
    rec(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? this._deHtml(sel); }
  /** Lo que se escribió con innerHTML se materializa cuando alguien lo pide. */
  _deHtml(sel) {
    if (!this._html) return null;
    const ultimo = String(sel).trim().split(/\s+/).pop();
    const mm = /^([a-z0-9]*)(?:#([\w-]+))?(?:\.([\w-]+))?$/i.exec(ultimo);
    if (!mm) return null;
    const [, tag, id, clase] = mm;
    let re = null;
    if (id) re = new RegExp(`<(\\w+)[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
    else if (clase) re = new RegExp(`<(\\w+)[^>]*\\bclass=["'][^"']*\\b${clase}\\b[^"']*["'][^>]*>`, 'i');
    else if (tag) re = new RegExp(`<(${tag})\\b[^>]*>`, 'i');
    const hit = re && re.exec(this._html);
    if (!hit) return null;
    const clave = `${hit.index}:${hit[0]}`;
    if (!this._consultas.has(clave)) {
      const t = hit[1].toLowerCase();
      const el = t === 'canvas' ? lienzoFalso() : new ElementoFalso(t);
      const idm = /\bid=["']([^"']+)["']/.exec(hit[0]); if (idm) el.id = idm[1];
      const cm = /\bclass=["']([^"']+)["']/.exec(hit[0]); if (cm) el.className = cm[1];
      const wm = /\bwidth=["']?(\d+)/.exec(hit[0]); if (wm) el.width = Number(wm[1]);
      const hm = /\bheight=["']?(\d+)/.exec(hit[0]); if (hm) el.height = Number(hm[1]);
      el.parentNode = this;
      this._consultas.set(clave, el);
    }
    return this._consultas.get(clave);
  }
}

function coincide(el, sel) {
  if (!el || !sel) return false;
  const ultimo = String(sel).trim().split(/\s+/).pop();
  const mm = /^([a-z0-9]*)(?:#([\w-]+))?(?:\.([\w-]+))?$/i.exec(ultimo);
  if (!mm) return false;
  const [, tag, id, clase] = mm;
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  if (id && el.id !== id) return false;
  if (clase && !el.classList.contains(clase)) return false;
  return !!(tag || id || clase);
}

function lienzoFalso() {
  const el = new ElementoFalso('canvas');
  el.width = 300; el.height = 150;
  let ctx = null;
  el.getContext = () => (ctx ??= ctxQueAnota(el));
  el.toDataURL = () => 'data:,';
  el.transferControlToOffscreen = undefined;
  return el;
}

function instalarDOM() {
  globalThis.ImageData = class ImageData {
    constructor(a, b, c) {
      if (a instanceof Uint8ClampedArray) { this.data = a; this.width = b; this.height = c ?? (a.length / 4 / b); }
      else { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); }
    }
  };
  const html = new ElementoFalso('html');
  const head = new ElementoFalso('head');
  const body = new ElementoFalso('body');
  html.appendChild(head); html.appendChild(body);
  const hud = new ElementoFalso('div'); hud.id = 'hud'; hud.className = 'visible';
  body.appendChild(hud);
  for (const id of ['geo', 'reloj', 'vitales', 'bolso', 'accion', 'cruz-sur']) {
    const e = new ElementoFalso('div'); e.id = id; hud.appendChild(e);
  }
  const buscar = (sel) => html.querySelector(sel);
  DOCUMENTO = {
    documentElement: html, head, body,
    createElement: (t) => (String(t).toLowerCase() === 'canvas' ? lienzoFalso() : new ElementoFalso(t)),
    createElementNS: (ns, t) => new ElementoFalso(t),
    createTextNode: (t) => { const e = new ElementoFalso('#text'); e.textContent = t; return e; },
    createDocumentFragment: () => new ElementoFalso('#fragment'),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: buscar,
    querySelectorAll: (sel) => html.querySelectorAll(sel),
    addEventListener() {}, removeEventListener() {},
    exitPointerLock() {}, pointerLockElement: null, visibilityState: 'visible', hidden: false,
  };
  globalThis.document = DOCUMENTO;
  globalThis.window = globalThis;
  globalThis.innerWidth = 1024; globalThis.innerHeight = 768; globalThis.devicePixelRatio = 1;
  globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
  globalThis.getComputedStyle = (el) => ({
    display: el.style.display || 'block', visibility: el.style.visibility || 'visible', opacity: el.style.opacity || '1',
    getPropertyValue: (k) => el.style[k] ?? '',
  });
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  return { html, body, hud };
}

// ═══════════════════════════════════════════════════════════════════════════
// Un mundo de mentira, que cuenta las alturas que le piden
// ═══════════════════════════════════════════════════════════════════════════

function mundoFalso() {
  const w = {
    tamano: TAMANO, mitad: MITAD, metrosPorTexel: 32, lecturas: 0,
    alturaBaseEn(x, z) { w.lecturas++; return 900 + 300 * Math.sin(x / 2100) * Math.cos(z / 1700) + 0.02 * x; },
    alturaEn(x, z) { w.lecturas++; return 900 + 300 * Math.sin(x / 2100) * Math.cos(z / 1700) + 0.02 * x; },
    superficieEn(x, z) { return w.alturaEn(x, z); },
    esAgua(x, z) { return Math.hypot(x + 9000, z - 7000) < 2500; },
    aLatLon(x, z) { return { lat: -41.1 - z / 111320, lon: -71.52 + x / (111320 * Math.cos(41.1 * GRADO)) }; },
    pendienteEn() { return 0.1; },
    humedadEn() { return 0.5; },
    cotaLagoEn() { return null; },
  };
  return w;
}

function exploracionFalsa(valor = 255) {
  const celdas = 256;
  const conocido = new Uint8Array(celdas * celdas).fill(valor);
  return {
    celdas, metrosPorCelda: TAMANO / celdas, conocido, version: 1, nuevasDesdeUltimoDibujo: 0,
    get fraccionExplorada() { let s = 0; for (const v of conocido) s += v; return s / 255 / conocido.length; },
    conocimientoEn(x, z) {
      const i = Math.floor((x + MITAD) / (TAMANO / celdas)), j = Math.floor((z + MITAD) / (TAMANO / celdas));
      if (i < 0 || j < 0 || i >= celdas || j >= celdas) return 0;
      return conocido[j * celdas + i] / 255;
    },
    guardar() {}, guardarSiHaceFalta() {},
  };
}

function jugadorFalso(x = 1200, z = -800, giro = 0) {
  return { posicion: { x, y: 950, z }, giro, vivo: true };
}

const construccionFalsa = (obras = []) => ({ obras });
const codiceFalso = () => ({ listaLugares: [{ id: 'cerro', nombre: 'Cerro de prueba', x: 3000, z: -2000 }], lugares: new Set(['cerro']) });

/** `Hallazgos` de verdad, sin su constructor —que toca el guardado—, y sin nada visto. */
async function hallazgosDeVerdad() {
  const { Hallazgos } = await imp('systems/Hallazgos.js');
  const h = Object.create(Hallazgos.prototype);
  h.celdas = new Map();
  h.lado = 256;
  return h;
}

/** Uno que sólo anota cómo lo llamaron. */
function hallazgosQueAnota() {
  const llamadas = [];
  return { llamadas, dibujar(c, proy, op) { llamadas.push({ c, proy, op }); }, guardar() {}, guardarSiHaceFalta() {} };
}

// ═══════════════════════════════════════════════════════════════════════════
// Encontrar la flecha en lo anotado
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La flecha es un polígono relleno de 3 a 6 vértices, sin curvas ni rectángulos,
 * cuyo centro cae a menos de 9 px del jugador. La punta es el vértice más lejos del
 * centroide; el rumbo, de centroide a punta.
 */
function flechasEn(rellenos, centro) {
  const out = [];
  for (const r of rellenos) {
    if (r.curva || r.rect) continue;
    const pts = [];
    for (const p of r.puntos) if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)) pts.push(p);
    if (pts.length < 3 || pts.length > 6) continue;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    if (Math.hypot(cx - centro.px, cy - centro.py) > 9) continue;
    let punta = pts[0], lejos = -1;
    for (const p of pts) { const d = Math.hypot(p[0] - cx, p[1] - cy); if (d > lejos) { lejos = d; punta = p; } }
    out.push({ rumbo: Math.atan2(punta[1] - cy, punta[0] - cx), largo: lejos, centro: [cx, cy], n: pts.length });
  }
  return out;
}

/** El rumbo en el lienzo de la dirección de avance, con la proyección de quien dibuja. */
function rumboEsperado(aPixel, j) {
  const g = j.giro;
  const a = aPixel(j.posicion.x, j.posicion.z);
  const b = aPixel(j.posicion.x - Math.sin(g) * 50, j.posicion.z - Math.cos(g) * 50);
  return Math.atan2(b.py - a.py, b.px - a.px);
}

const GIROS = [0, 0.7, Math.PI / 2, 2.89, Math.PI, -Math.PI / 2, -2.2, 5.5];

// ═══════════════════════════════════════════════════════════════════════════
// Armar un mapa de verdad sobre el DOM de mentira
// ═══════════════════════════════════════════════════════════════════════════

async function mapaNuevo(op = {}) {
  const { Mapa } = await imp('ui/Mapa.js');
  const mundo = op.mundo || mundoFalso();
  const jugador = op.jugador || jugadorFalso();
  const exploracion = op.exploracion || exploracionFalsa();
  const hallazgos = op.hallazgos || await hallazgosDeVerdad();
  const construccion = op.construccion || construccionFalsa();
  const m = new Mapa({ mundo, jugador, tiempo: {}, exploracion, codice: codiceFalso(), construccion, hallazgos });
  avanzar(2000);                                 // el recorte del mundo, al ocio
  return { m, mundo, jugador, exploracion, hallazgos, construccion, ctx: m.ctx ?? m.lienzo?.getContext('2d') };
}

/** Un evento de rueda sobre el lienzo, en píxeles del lienzo (el lienzo mide 640 en pantalla). */
function rueda(m, px, py, arriba = true) {
  m.lienzo.dispatchEvent({ type: 'wheel', deltaY: arriba ? -100 : 100, clientX: px, clientY: py, preventDefault() {}, stopPropagation() {} });
}
function arrastrar(m, desde, hasta) {
  const ev = (type, p) => ({ type, clientX: p[0], clientY: p[1], pointerId: 1, button: 0, buttons: 1, preventDefault() {}, stopPropagation() {} });
  m.lienzo.dispatchEvent(ev('pointerdown', desde));
  m.lienzo.dispatchEvent(ev('pointermove', [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2]));
  m.lienzo.dispatchEvent(ev('pointermove', hasta));
  m.lienzo.dispatchEvent(ev('pointerup', hasta));
}
/** Lleva el mapa al nivel más alto que acepte, con la rueda en (px, py). Devuelve los m/px de cada peldaño. */
function subirHastaElTope(m, px = 320, py = 320) {
  const mpps = [m.vista.mpp];
  for (let i = 0; i < 30; i++) {
    const antes = m.nivel;
    rueda(m, px, py, true);
    avanzar(40);
    if (m.nivel === antes) break;
    mpps.push(m.vista.mpp);
  }
  avanzar(400);
  return mpps;
}
function bajarHastaElPiso(m) {
  for (let i = 0; i < 30; i++) { const antes = m.nivel; rueda(m, 320, 320, false); avanzar(40); if (m.nivel === antes) break; }
  avanzar(400);
}
const ventanaDe = (m) => {
  const a = m.aMundo(0, 0), b = m.aMundo(LADO, LADO);
  return { oeste: a.x, norte: a.z, este: b.x, sur: b.z };
};

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA FLECHA
// ═══════════════════════════════════════════════════════════════════════════

async function flecha() {
  const s = seccion(1, 'LA FLECHA — apunta hacia donde avanza el jugador, a menos de 1°');

  // Premisa: el Jugador de verdad avanza hacia (−sin giro, −cos giro)
  let premisa = false;
  try {
    const THREE = await import('three');
    const { Jugador } = await imp('entities/Jugador.js');
    const n = new THREE.Vector3(0, 1, 0);
    const mundo = {
      mitad: MITAD,
      alturaEn: () => 800, alturaBaseEn: () => 800, superficieEn: () => 800,
      normalEn: (x, z, out = new THREE.Vector3()) => out.copy(n),
      pendienteEn: () => 0, cotaLagoEn: () => null, esAgua: () => false,
      humedadEn: () => 0.5, aLatLon: () => ({ lat: -41, lon: -71 }),
    };
    const peor = [];
    for (const g of [0.3, 2.0, -1.2, 4.0]) {
      const cam = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1e5);
      const j = new Jugador(mundo, cam);
      j.posicion.set(0, 800, 0); j.enSuelo = true; j.giro = g;
      const e = { sensibilidad: 0, ratonDX: 0, ratonDY: 0, invertirY: false, consumirRaton() {}, agachar: false, adelante: 1, correr: false, lateral: 0, saltar: false };
      for (let i = 0; i < 120; i++) j.actualizar(1 / 60, e);
      const dx = j.posicion.x, dz = j.posicion.z;
      const cos = (-Math.sin(g) * dx - Math.cos(g) * dz) / Math.max(1e-9, Math.hypot(dx, dz));
      peor.push({ g, cos, d: Math.hypot(dx, dz) });
    }
    premisa = peor.every((p) => p.cos > Math.cos(1 * GRADO) && p.d > 1);
    s.ok(premisa, 'premisa: el Jugador de verdad avanza hacia (−sin giro, −cos giro), en cuatro giros', peor.map((p) => `g ${p.g}: cos ${p.cos.toFixed(5)}, ${p.d.toFixed(1)} m`).join(' · '));
  } catch (err) {
    s.ok(false, 'premisa: el Jugador de verdad se pudo mover', err.message);
  }

  // La flecha del mapa, al nivel 0 y al máximo
  const { m, jugador, ctx } = await mapaNuevo();
  s.ok(!!ctx?.registro, 'premisa: el lienzo del mapa anota lo que se dibuja');
  if (!m.abierto) m.alternar();
  const medir = (etiqueta) => {
    const errores = [];
    let vistas = 0;
    for (const g of GIROS) {
      jugador.giro = g;
      const desde = ctx.registro.rellenos.length;
      m.dibujar();
      const centro = m.aPixel(jugador.posicion.x, jugador.posicion.z);
      const fs = flechasEn(ctx.registro.rellenos.slice(desde), centro);
      if (!fs.length) { errores.push(`g ${g.toFixed(2)}: sin flecha`); continue; }
      vistas++;
      const f = fs[fs.length - 1];
      const e = difAng(f.rumbo, rumboEsperado((x, z) => m.aPixel(x, z), jugador));
      errores.push(`g ${g.toFixed(2)}: ${(e / GRADO).toFixed(1)}°`);
      if (e > 1 * GRADO) errores.malo = true;
    }
    s.ok(vistas === GIROS.length, `${etiqueta}: se encontró la flecha en los ${GIROS.length} giros`, `${vistas}`);
    s.ok(vistas === GIROS.length && !errores.malo, `${etiqueta}: la flecha apunta hacia donde avanza el jugador, a menos de 1°`, errores.join(' · '));
    return vistas === GIROS.length && !errores.malo;
  };
  const a0 = medir('mapa al nivel 0');
  const p = m.aPixel(jugador.posicion.x, jugador.posicion.z);
  subirHastaElTope(m, p.px, p.py);
  const aMax = medir(`mapa al tope (${m.vista.mpp} m/px)`);

  s.feliz = premisa && !!ctx?.registro;
  s.felizQue = `premisa ${premisa} · nivel 0 ${a0} · tope ${aMax}`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA BRÚJULA
// ═══════════════════════════════════════════════════════════════════════════

async function brujula() {
  const s = seccion(2, 'LA BRÚJULA — la regla de #brujula tiene position');
  let html = '';
  try { html = fs.readFileSync(HTML, 'utf8'); } catch (e) { s.ok(false, 'premisa: se leyó index.html', e.message); return s; }
  s.ok(/id="brujula"/.test(html), 'premisa: index.html tiene el elemento #brujula');
  // La regla del elemento, no la de sus hijos: «#brujula {» o «#brujula,» sin descendiente
  const reglas = [...html.matchAll(/(^|[\s}])#brujula\s*(?:,[^{]*)?\{([^}]*)\}/g)].map((x) => x[2]);
  s.ok(reglas.length >= 1, 'premisa: hay una regla para #brujula', reglas.length);
  const todo = reglas.join(';');
  const pos = /(^|;|\s)position\s*:\s*(absolute|fixed)/.exec(todo);
  s.ok(!!pos, '#brujula tiene position absolute o fixed', pos ? pos[2] : 'sin position: queda static y left/transform no la centran');
  s.ok(/left\s*:\s*50%/.test(todo) && /translateX\(\s*-50%\s*\)/.test(todo), 'y sigue centrada con left 50 % y translateX(−50 %)');
  s.feliz = reglas.length >= 1;
  s.felizQue = 'se leyó la regla';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL ZOOM
// ═══════════════════════════════════════════════════════════════════════════

async function zoom() {
  const s = seccion(3, 'EL ZOOM — cinco peldaños de antes, hasta 2 m/px, hacia el cursor, dentro del mundo');
  const obra = { x: 1230, z: -800, obra: { categoria: 'efimera', nombre: 'Vivac' } };
  const { m, jugador, ctx } = await mapaNuevo({ construccion: construccionFalsa([obra]) });
  if (!m.abierto) m.alternar();
  s.ok(Math.abs(m.vista.mpp - TAMANO / LADO) < 1e-9, 'premisa: arranca en el parque entero', m.vista.mpp);

  // La escalera, por la rueda sobre la obra. Sobre el centro del lienzo —que al
  // nivel 0 es el centro del mundo— la obra, a 1230 m, queda afuera de la ventana
  // de ±640 m del tope: el banco lo pedía así y validó contra la base sólo porque
  // la escalera vieja paraba en ±2560 m. Lo encontró el agente haciendo la cuenta.
  const po0 = m.aPixel(obra.x, obra.z);
  const mpps = subirHastaElTope(m, po0.px, po0.py);
  s.nota(`escalera: ${mpps.map((x) => +x.toFixed(3)).join(' · ')} m/px`);
  const tiene = (v) => mpps.some((x) => Math.abs(x - v) < 1e-6);
  s.ok([102.4, 51.2, 32, 16, 8].every(tiene), 'la escalera conserva los cinco peldaños de antes', [102.4, 51.2, 32, 16, 8].filter((v) => !tiene(v)).join(', ') || 'todos');
  s.ok(mpps.every((x, i) => i === 0 || x < mpps[i - 1]), 'cada muesca acerca: la escalera baja siempre');
  const tope = Math.min(...mpps);
  s.ok(tope <= 2 + 1e-9, 'llega a 2 m/px o menos', `${tope} m/px · ventana ${(tope * LADO / 1000).toFixed(2)} km`);

  // El pie dice «ampliado» pasado el dato, y no lo dice en el parque entero
  m.dibujar();
  const textoDe = (raiz) => {
    let t = '';
    const rec = (n) => { t += ` ${n.textContent || ''} ${n._html || ''}`; for (const h of [...n.children, ...n._consultas.values()]) rec(h); };
    rec(raiz);
    return t;
  };
  s.ok(/ampliad|sobre el dato/i.test(textoDe(m.el)), 'al tope, el pie dice que el relieve está ampliado sobre el dato');

  // Las marcas y la flecha, a su tamaño en píxeles a cualquier zoom
  const tamanos = () => {
    const desde = { r: ctx.registro.rellenos.length, t: ctx.registro.trazos.length };
    jugador.giro = 0.5;
    m.dibujar();
    const c = m.aPixel(jugador.posicion.x, jugador.posicion.z);
    const f = flechasEn(ctx.registro.rellenos.slice(desde.r), c).pop();
    const po = m.aPixel(obra.x, obra.z);
    // La X: dos segmentos rectos que se cruzan en la obra —el punto medio de cada
    // uno a menos de 1 px de ella—. Así no se confunde con el borde de una flecha.
    const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const xs = ctx.registro.trazos.slice(desde.t).filter((t) => !t.curva && t.puntos.length === 4
      && [medio(t.puntos[0], t.puntos[1]), medio(t.puntos[2], t.puntos[3])].every((q) => Math.hypot(q[0] - po.px, q[1] - po.py) < 1));
    const x = xs.pop();
    const ancho = x ? Math.max(...x.puntos.map((p) => p[0])) - Math.min(...x.puntos.map((p) => p[0])) : NaN;
    return { flecha: f?.largo ?? NaN, x: ancho };
  };
  const alTope = tamanos();
  bajarHastaElPiso(m);
  const enCero = tamanos();
  // Al nivel 0 la obra y el jugador están a 30 m: menos de un píxel. La X igual se dibuja.
  s.ok(Number.isFinite(alTope.flecha) && Math.abs(alTope.flecha - enCero.flecha) < 0.5, 'la flecha mide lo mismo en píxeles al tope y en el parque entero', `${alTope.flecha?.toFixed(2)} contra ${enCero.flecha?.toFixed(2)} px`);
  s.ok(Number.isFinite(alTope.x) && Math.abs(alTope.x - enCero.x) < 0.5, 'la X de una obra mide lo mismo en píxeles al tope y en el parque entero', `${alTope.x?.toFixed(2)} contra ${enCero.x?.toFixed(2)} px`);
  s.ok(!/ampliad/i.test(textoDe(m.el)), 'en el parque entero el pie no dice «ampliado»');

  // El zoom deja quieto lo que está bajo el cursor
  {
    const anclas = [[200, 160], [470, 500], [320, 320], [90, 560]];
    const errores = [];
    for (const [ax, ay] of anclas) {
      bajarHastaElPiso(m);
      rueda(m, 320, 320, true); avanzar(40);         // nivel 1, centrado en el mundo: hay lugar para moverse
      const antes = m.aMundo(ax, ay);
      rueda(m, ax, ay, true); avanzar(40);
      rueda(m, ax, ay, true); avanzar(40);
      const despues = m.aMundo(ax, ay);
      errores.push(Math.hypot(antes.x - despues.x, antes.z - despues.z));
    }
    s.ok(errores.every((e) => e < 0.5), 'la rueda deja quieto lo que está bajo el cursor (cuatro anclas, dos muescas)', errores.map((e) => `${e.toFixed(3)} m`).join(' · '));
  }

  // La vista no se sale del mundo, en ningún nivel, arrastrando para las ocho direcciones
  {
    // Premisa: el arrastre mueve la vista. Si no la moviera, «no se sale» sería gratis.
    bajarHastaElPiso(m);
    rueda(m, 320, 320, true); avanzar(40); rueda(m, 320, 320, true); avanzar(40);
    const a = { x: m.vista.cx, z: m.vista.cz, mpp: m.vista.mpp };
    arrastrar(m, [320, 320], [220, 270]);
    avanzar(200);
    const dx = m.vista.cx - a.x, dz = m.vista.cz - a.z;
    s.ok(Math.abs(dx - 100 * a.mpp) < 1e-6 && Math.abs(dz - 50 * a.mpp) < 1e-6, 'premisa: arrastrar 100 px mueve la vista 100 px de mundo, al revés que el dedo', `${dx.toFixed(1)}, ${dz.toFixed(1)} m a ${a.mpp} m/px`);
    bajarHastaElPiso(m);
    let peor = 0, casos = 0, niveles = 0;
    for (let n = 0; n < 12; n++) {
      niveles++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        for (let k = 0; k < 40; k++) arrastrar(m, [320, 320], [320 + dx * 600, 320 + dy * 600]);
        const v = ventanaDe(m);
        peor = Math.max(peor, -MITAD - v.oeste, v.este - MITAD, -MITAD - v.norte, v.sur - MITAD);
        casos++;
      }
      const antes = m.nivel;
      rueda(m, 320, 320, true); avanzar(40);
      if (m.nivel === antes) break;
    }
    avanzar(400);
    s.ok(peor <= 1e-6, `${casos} arrastres en ${niveles} niveles y la ventana nunca se sale del mundo`, `peor desborde ${peor.toExponential(1)} m`);
  }

  // aPixel y aMundo, inversas
  {
    let peor = 0;
    for (const x of [-30000, -5000, 0, 5000, 30000]) for (const z of [-30000, 0, 30000]) {
      const p = m.aPixel(x, z); const v = m.aMundo(p.px, p.py);
      peor = Math.max(peor, Math.abs(v.x - x), Math.abs(v.z - z));
    }
    s.ok(peor < 1e-6, 'aPixel y aMundo siguen siendo inversas exactas', peor.toExponential(1));
  }

  s.feliz = mpps.length >= 5;
  s.felizQue = `la rueda subió ${mpps.length - 1} peldaños`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · ABRIR CENTRADO
// ═══════════════════════════════════════════════════════════════════════════

async function abrirCentrado() {
  const s = seccion(4, 'ABRIR CENTRADO — al abrir, la vista mira al jugador');
  const { m, jugador } = await mapaNuevo();
  if (!m.abierto) m.alternar();
  s.ok(m.abierto === true, 'premisa: alternar() abre el mapa');
  // Ampliar sobre otro lugar, lejos del jugador, y cerrar
  jugador.posicion.x = -12000; jugador.posicion.z = 9000;
  const lejos = m.aPixel(8000, -6000);
  for (let i = 0; i < 4; i++) { rueda(m, lejos.px, lejos.py, true); avanzar(40); }
  avanzar(300);
  const nivel = m.nivel;
  const c0 = { x: m.vista.cx, z: m.vista.cz };
  s.ok(nivel > 0 && Math.hypot(c0.x - jugador.posicion.x, c0.z - jugador.posicion.z) > 5000, 'premisa: la vista quedó ampliada y lejos del jugador', `nivel ${nivel} · centro ${c0.x.toFixed(0)}, ${c0.z.toFixed(0)}`);
  m.alternar();
  s.ok(m.abierto === false, 'premisa: alternar() lo cierra');
  // El jugador caminó; se abre otra vez
  jugador.posicion.x = 5000; jugador.posicion.z = -3000;
  m.alternar();
  avanzar(300);
  s.ok(m.nivel === nivel, 'abrir conserva el nivel de zoom', `${m.nivel} contra ${nivel}`);
  const d = Math.hypot(m.vista.cx - 5000, m.vista.cz + 3000);
  s.ok(d < 1, 'abrir centra la vista en el jugador', `a ${d.toFixed(1)} m · centro ${m.vista.cx.toFixed(0)}, ${m.vista.cz.toFixed(0)}`);
  const pj = m.aPixel(5000, -3000);
  s.ok(Math.hypot(pj.px - 320, pj.py - 320) < 1, 'y el jugador cae en el centro del lienzo', `${pj.px.toFixed(1)}, ${pj.py.toFixed(1)}`);
  // Cerca del borde del mundo, el límite de siempre
  m.alternar();
  jugador.posicion.x = MITAD - 50; jugador.posicion.z = -MITAD + 50;
  m.alternar();
  avanzar(300);
  const v = ventanaDe(m);
  s.ok(v.este <= MITAD + 1e-6 && v.norte >= -MITAD - 1e-6, 'junto al borde del mundo, la vista no se sale', JSON.stringify({ este: v.este.toFixed(1), norte: v.norte.toFixed(1) }));
  // Al nivel 0 no cambia nada: se baja con el mapa abierto, se cierra y se abre
  bajarHastaElPiso(m);
  m.alternar();
  jugador.posicion.x = 7000; jugador.posicion.z = 4000;
  m.alternar();
  avanzar(300);
  s.ok(m.nivel === 0 && Math.abs(m.vista.cx) < 1e-6 && Math.abs(m.vista.cz) < 1e-6, 'al nivel 0 la vista sigue siendo el mundo entero', `nivel ${m.nivel} · ${m.vista.cx}, ${m.vista.cz}`);
  s.feliz = nivel > 0;
  s.felizQue = `se pudo ampliar al nivel ${nivel}`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · EL MINIMAPA
// ═══════════════════════════════════════════════════════════════════════════

async function minimapa() {
  const s = seccion(5, 'EL MINIMAPA — en #hud, norte arriba, 400 a 1500 m, flecha, marcas, oculto, sin redibujar cada cuadro');
  const archivo = path.join(SRC, 'ui', 'Minimapa.js');
  const existe = fs.existsSync(archivo);
  s.ok(existe, 'src/ui/Minimapa.js existe');
  if (!existe) { s.felizQue = 'no hay módulo'; return s; }
  const fuente = fs.readFileSync(archivo, 'utf8');
  s.ok(/from\s+['"]\.\/Mapa\.js['"]/.test(fuente), 'Minimapa.js importa de Mapa.js: una sola función decide el rumbo');

  let Minimapa;
  try { ({ Minimapa } = await imp('ui/Minimapa.js')); } catch (e) { s.ok(false, 'el módulo carga en Node', e.message); return s; }
  s.ok(typeof Minimapa === 'function', 'exporta la clase Minimapa');
  if (typeof Minimapa !== 'function') return s;

  const mundo = mundoFalso();
  const jugador = jugadorFalso(-4000, 6000, 0.9);
  const exploracion = exploracionFalsa(255);
  const hallazgos = hallazgosQueAnota();
  const obra = { x: -3900, z: 6000, obra: { categoria: 'efimera', nombre: 'Vivac' } };
  const construccion = construccionFalsa([obra]);
  const mapa = { abierto: false };
  let mm;
  try {
    mm = new Minimapa({ mundo, jugador, exploracion, hallazgos, construccion, codice: codiceFalso(), mapa });
  } catch (e) { s.ok(false, 'se construye con las dependencias del contrato', `${e.message}\n${(e.stack || '').split('\n').slice(1, 3).join('\n')}`); return s; }
  const hud = document.getElementById('hud');
  const el = document.getElementById('minimapa');
  s.ok(!!el, '#minimapa existe en el documento');
  s.ok(!!el && hud.contains(el), '#minimapa vive dentro de #hud');
  s.ok(mm.el === el, 'expone el: el #minimapa');
  const lienzo = mm.lienzo, ctx = mm.ctx;
  s.ok(!!lienzo && typeof lienzo.getContext === 'function', 'expone lienzo');
  s.ok(!!ctx?.registro, 'expone ctx, y es el lienzo que anota');
  s.ok(typeof mm.aPixel === 'function' && typeof mm.dibujar === 'function' && typeof mm.actualizar === 'function', 'expone aPixel, dibujar y actualizar');
  if (!ctx?.registro || typeof mm.aPixel !== 'function') return s;

  // Que arranque: medio segundo de cuadros y de ocio
  const cuadros = (n, dt = 1 / 60, alCuadro) => { for (let i = 0; i < n; i++) { alCuadro?.(i); mm.actualizar(dt); avanzar(dt * 1000); } };
  cuadros(30);

  // Proyección: el jugador al centro, norte arriba, este a la derecha, escala pareja
  const W = lienzo.width, H = lienzo.height;
  const c = mm.aPixel(jugador.posicion.x, jugador.posicion.z);
  s.ok(Math.hypot(c.px - W / 2, c.py - H / 2) < 1, 'el jugador cae en el centro del lienzo', `${c.px.toFixed(1)}, ${c.py.toFixed(1)} en ${W}×${H}`);
  const n = mm.aPixel(jugador.posicion.x, jugador.posicion.z - 100);
  const e = mm.aPixel(jugador.posicion.x + 100, jugador.posicion.z);
  s.ok(Math.abs(n.px - c.px) < 0.01 && n.py < c.py, 'el norte (−z) queda arriba', `${(n.px - c.px).toFixed(3)}, ${(n.py - c.py).toFixed(3)}`);
  s.ok(Math.abs(e.py - c.py) < 0.01 && e.px > c.px, 'el este (+x) queda a la derecha', `${(e.px - c.px).toFixed(3)}, ${(e.py - c.py).toFixed(3)}`);
  const kx = (e.px - c.px) / 100, ky = (c.py - n.py) / 100;
  s.ok(Math.abs(kx - ky) < 1e-6 * Math.max(kx, 1e-9) + 1e-9, 'la escala es la misma en los dos ejes', `${kx} · ${ky}`);
  const ventana = W / Math.max(kx, 1e-12);
  s.ok(ventana >= 400 && ventana <= 1500, 'la ventana mide entre 400 y 1500 m de lado', `${ventana.toFixed(0)} m`);

  // La flecha, en ocho giros
  {
    const errores = [];
    let vistas = 0, mal = false;
    for (const g of GIROS) {
      jugador.giro = g;
      const desde = ctx.registro.rellenos.length;
      cuadros(60);                                  // un segundo: tiene que haberse redibujado
      const centro = mm.aPixel(jugador.posicion.x, jugador.posicion.z);
      const fsx = flechasEn(ctx.registro.rellenos.slice(desde), centro);
      if (!fsx.length) { errores.push(`g ${g.toFixed(2)}: sin flecha`); mal = true; continue; }
      vistas++;
      const err = difAng(fsx[fsx.length - 1].rumbo, rumboEsperado((x, z) => mm.aPixel(x, z), jugador));
      if (err > 1 * GRADO) mal = true;
      errores.push(`g ${g.toFixed(2)}: ${(err / GRADO).toFixed(1)}°`);
    }
    s.ok(vistas === GIROS.length, `en un segundo se redibuja la flecha, en los ${GIROS.length} giros`, vistas);
    s.ok(!mal, 'la flecha del minimapa apunta hacia donde avanza el jugador, a menos de 1°', errores.join(' · '));
  }

  // Las marcas: hallazgos.dibujar con la misma proyección y con las obras
  {
    const antes = hallazgos.llamadas.length;
    mm.dibujar();
    const ll = hallazgos.llamadas.slice(antes);
    s.ok(ll.length >= 1, 'dibujar() pide las marcas a hallazgos.dibujar', ll.length);
    const u = ll[ll.length - 1];
    if (u) {
      const pp = u.proy(obra.x, obra.z), pm = mm.aPixel(obra.x, obra.z);
      s.ok(Math.hypot(pp.px - pm.px, pp.py - pm.py) < 0.01, 'con la misma proyección que aPixel', `${pp.px.toFixed(2)},${pp.py.toFixed(2)} contra ${pm.px.toFixed(2)},${pm.py.toFixed(2)}`);
      s.ok(u.op?.construccion === construccion, 'y le pasa construccion, para las obras');
      s.ok(u.c === ctx, 'sobre su propio lienzo');
    }
  }

  // Oculto con el mapa abierto, y sin dibujar
  {
    mapa.abierto = true;
    cuadros(10);
    const desde = ctx.registro.rellenos.length + ctx.registro.imagenes.length;
    cuadros(90);
    const dibujado = ctx.registro.rellenos.length + ctx.registro.imagenes.length - desde;
    s.ok(el.classList.contains('oculto'), 'con el mapa abierto #minimapa lleva la clase oculto', el.className);
    s.ok(dibujado === 0, 'y no dibuja nada mientras tanto', `${dibujado} operaciones en 1,5 s`);
    mapa.abierto = false;
    cuadros(30);
    s.ok(!el.classList.contains('oculto'), 'al cerrarlo, se ve otra vez', el.className);
  }

  // No redibuja todos los cuadros, pero sí al menos una vez por segundo
  let redibujos = 0;
  {
    jugador.giro = 0;
    const desde = ctx.registro.rellenos.length;
    const p0 = { x: jugador.posicion.x, z: jugador.posicion.z };
    cuadros(600, 1 / 60, () => { jugador.posicion.z -= 1.4 / 60; });
    const centroFinal = mm.aPixel(jugador.posicion.x, jugador.posicion.z);
    redibujos = flechasEn(ctx.registro.rellenos.slice(desde), centroFinal).length;
    s.ok(redibujos >= 10, 'caminando 10 s se redibuja al menos una vez por segundo', `${redibujos} flechas en 600 cuadros`);
    s.ok(redibujos <= 300, 'y no en todos los cuadros: a lo sumo uno de cada dos', `${redibujos} de 600`);
    s.nota(`10 s caminando: ${redibujos} redibujos en 600 cuadros · ${Math.hypot(jugador.posicion.x - p0.x, jugador.posicion.z - p0.z).toFixed(1)} m`);
  }

  // El relieve no se reconstruye por metro caminado
  {
    // Una reconstrucción de referencia: lo que lee un minimapa recién hecho
    const m2 = new Minimapa({ mundo, jugador: jugadorFalso(9000, 9000, 0), exploracion, hallazgos: hallazgosQueAnota(), construccion, codice: codiceFalso(), mapa: { abierto: false } });
    mundo.lecturas = 0;
    for (let i = 0; i < 60; i++) { m2.actualizar(1 / 60); avanzar(1000 / 60); }
    const B = mundo.lecturas;
    m2.el?.remove();
    s.nota(`una construcción del relieve lee ${B} alturas`);
    if (B === 0) {
      s.nota('el minimapa no lee alturas del mundo: la reconstrucción no se puede contar, y no cuesta');
    } else {
      mundo.lecturas = 0;
      cuadros(600, 1 / 60, () => { jugador.posicion.z -= 1.4 / 60; });
      const corto = mundo.lecturas / B;
      s.ok(corto <= 1.0001, 'caminando 14 m, a lo sumo una reconstrucción', `${corto.toFixed(2)} reconstrucciones`);
      mundo.lecturas = 0;
      const tramo = 3000;
      cuadros(600, 1 / 60, () => { jugador.posicion.x += tramo / 600; });
      const largo = mundo.lecturas / B;
      const tope = tramo / (0.25 * ventana) + 1;
      s.ok(largo <= tope, `caminando ${tramo} m, a lo sumo una reconstrucción cada cuarto de ventana`, `${largo.toFixed(1)} reconstrucciones · tope ${tope.toFixed(1)}`);
    }
  }

  el.remove?.();
  s.feliz = !!el && redibujos > 0;
  s.felizQue = `hay #minimapa: ${!!el} · se redibujó: ${redibujos}`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — los siete bancos de la ronda 7');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const otros = [
    ['banco-r7-fase1.mjs', '6/6'], ['banco-r7-fase2.mjs', '4/4'], ['banco-r7-fase2b.mjs', '7/7'],
    ['banco-r7-fase3.mjs', '6/6'], ['banco-r7-fase4.mjs', '10/10'], ['banco-r7-fase5.mjs', '9/9'],
    ['banco-r7-fase6.mjs', '7/7'],
  ];
  let corrio = 0;
  for (const [archivo, esperado] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000,
      env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '' },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  // Informativo: mira métodos internos y fija la escalera vieja
  const r2 = spawnSync(process.execPath, [path.join(AQUI, 'r2-carta-mapa.mjs')], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const m2 = ((r2.stdout || '') + (r2.stderr || '')).match(/(\d+) de (\d+) comprobaciones pasaron/);
  s.nota(`r2-carta-mapa.mjs (informativo, no manda): ${m2 ? `${m2[1]} de ${m2[2]}` : 'no terminó'}`);
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length} bancos anteriores`;
  return s;
}

async function arranque() {
  const s = seccion(7, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

instalarReloj();
instalarDOM();

const SECCIONES = { flecha, brujula, zoom, abrirCentrado, minimapa, regresion, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({
      num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`,
      checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }],
      feliz: false, felizQue: 'la sección tiró una excepción', notas: [],
    });
  }
}
todas.sort((a, b) => a.num - b.num);

if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every((s) => s.feliz && s.checks.every((c) => c.ok)) ? 0 : 1;
} else {
  console.log(`\n  BANCO R8 · FASE 1 — la flecha, la brújula, el zoom y el minimapa   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
  let verdes = 0;
  for (const s of todas) {
    const verde = s.checks.every((c) => c.ok) && s.feliz;
    if (verde) verdes++;
    console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(3)}  ${s.num} · ${s.nombre}`);
    for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
    if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
    for (const n of s.notas) console.log(`         nota ${n}`);
  }
  console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
  console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
  process.exitCode = verdes === todas.length ? 0 : 1;
}
