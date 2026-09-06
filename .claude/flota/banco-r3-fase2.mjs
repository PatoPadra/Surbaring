/**
 * BANCO DE LA FASE 2 (fauna) — ronda 3.
 *
 * Lo escribe el JEFE, no el agente. Regla 1 de RONDA3.md: quien escribe el
 * arreglo no puede escribir el banco que lo mide. Escrito EN PARALELO al agente
 * y contra el contrato del encargo, sin leer su implementación ni su informe.
 *
 * Seis bancos:
 *   1. UV — toda malla con mapa tiene el atributo de UV que ese mapa pide, y con
 *      un rango real. `fusionarGeometrias()` copia `position` y `normal` y nada
 *      más: una geometría fusionada sin `uv` muestrea un solo texel y el animal
 *      sale de un color plano, sin un error en consola.
 *   2. IDENTIDAD DE CELDA — ninguna malla muestrea fuera de la celda de SU
 *      especie, y dos especies nunca comparten ventana. Es «un animal con el
 *      pelaje de otro», el defecto que RONDA3 marca como silencioso.
 *   3. COLISIÓN DE COLOR FORZADA — el banco que caza `compactar()`. Se parchea
 *      `THREE.Color.prototype.getHexString` para que devuelva SIEMPRE el mismo
 *      valor y se reconstruyen las 44 especies. Si la clave de agrupación de
 *      `compactar()` sigue siendo el color, la colisión forzada fusiona piezas
 *      que no debían fusionarse y la geometría migra a otra identidad visual.
 *      La identidad visual se mide con `color.getHex()` (número, NO parcheado) y
 *      la ventana del mapa, así que el parche no puede falsear la medición.
 *      Este banco da ROJO contra el `Fauna.js` de 858ae717 — el defecto plantado
 *      es real y está en el repo, no es sintético.
 *   4. PRESUPUESTO DE SILUETA — triángulos, dibujos y proyectores de sombra por
 *      especie, contra la línea de base de 858ae717, con el número.
 *   5. ARRANQUE SIN ATLAS — sin `public/tex/` el juego arma las 44 especies
 *      igual, con color válido y sin un solo mapa colgado.
 *   6. COMPORTAMIENTO INTACTO — los métodos de conducta, voz y aptitud que cerró
 *      `vida` en la ronda 1, byte a byte contra 858ae717; y los nombres de parte
 *      que `_animar()` busca por `getObjectByName`.
 *
 * REGLA 2 de RONDA3.md — GUARDA DE COBERTURA, en la variante que costó la fase 1
 * de esta misma ronda (trampa nº 8 de ESTADO.md): la guarda no pregunta
 * «¿corrió?» sino «¿el camino feliz llegó a funcionar?». Los bancos 1, 2 y 3
 * exigen que el atlas haya cargado de verdad (disponible=true, 3 texturas) Y que
 * al menos una malla lleve un mapa aplicado. Sin eso, «ninguna malla está mal»
 * es cierto por vacío y el banco vale cero.
 *
 * Uso:  node .claude/flota/banco-r3-fase2.mjs
 *
 * Los escenarios que necesitan distinto estado de atlas corren en PROCESOS
 * SEPARADOS. `atlas.js` memoiza su promesa en una variable de módulo y, aunque
 * se reimporte `Fauna.js` con la caché de ESM salteada, el especificador
 * relativo `../util/atlas.js` resuelve al mismo módulo: en un solo proceso, el
 * primer escenario le fijaría el resultado a todos. Es la trampa nº 8 otra vez,
 * y la única forma limpia de esquivarla es un proceso por escenario.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { especiesRepresentables, leerIHDR } from './banco-r3-fase1.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TEX = path.join(RAIZ, 'public', 'tex');
// El falsador (banco-r3-fase2.falsar.mjs) apunta el banco a una copia con
// defectos plantados. Sin la variable, mide el archivo real del repo.
const FAUNA_JS = process.env.BANCO_FAUNA
  ? path.resolve(process.env.BANCO_FAUNA)
  : path.join(RAIZ, 'src', 'entities', 'Fauna.js');
const MANIFIESTO = path.join(TEX, 'manifiesto.json');
const TMP = path.join(AQUI, '.tmp-banco-fase2');
const BASE_COMMIT = process.env.BANCO_BASE || '858ae717';

/** Presupuesto de cuadro. La fauna hoy está por debajo del 5 % de 31,42 ms a
 *  Baja 1024×576 (ESTADO.md, desglose medido el 2/9/2026) → menos de 1,57 ms.
 *  El techo de RONDA3 es 2 ms, así que el margen de crecimiento es +27 %. */
const MS_CUADRO_BAJA = 31.42;
const FRACCION_FAUNA_HOY = 0.05;
const TECHO_MS = 2.0;
const MARGEN_CRECIMIENTO = TECHO_MS / (MS_CUADRO_BAJA * FRACCION_FAUNA_HOY); // 1,273
const MAX_VIVOS = 52;                 // Fauna.js:17
const TECHO_TRIANGULOS_ESCENA = 250000;

// ═══════════════════════════════════════════════════════════════════════════
// TRABAJADOR — corre en un proceso propio: node banco-r3-fase2.mjs --worker …
// ═══════════════════════════════════════════════════════════════════════════

const MARCA = '@@BANCO-FASE2@@';

async function trabajador(modo, rutaFauna) {
  const avisos = [];
  const datosFauna = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'fauna.json'), 'utf8'));

  let servidor = null;
  let imagenesOk = 0, imagenesError = 0;
  const pedidos = [];

  if (modo === 'con-atlas' || modo === 'colision-color') {
    // Servidor real sobre public/ + stub de DOM. Copiado del banco de la fase 1
    // a propósito: three.js NO usa `new Image()`, usa
    // `document.createElementNS(…,'img')`, y un stub que sólo define `Image`
    // manda el control por la rama de error y hace que el camino feliz nunca
    // cargue. Eso es exactamente la trampa nº 8.
    servidor = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const p = path.join(RAIZ, 'public', url.replace(/^\/+/, ''));
      if (!p.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'content-type': p.endsWith('.json') ? 'application/json' : 'image/png' });
      res.end(fs.readFileSync(p));
    });
    await new Promise(r => servidor.listen(0, '127.0.0.1', r));
    const puerto = servidor.address().port;

    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u, opts) => {
      const s = String(u && u.url ? u.url : u);
      const abs = /^https?:/.test(s) ? s : 'http://127.0.0.1:' + puerto + (s.startsWith('/') ? s : '/' + s);
      try {
        const r = await fetchReal(abs, opts);
        pedidos.push({ url: s, estado: r.status });
        return r;
      } catch (e) { pedidos.push({ url: s, estado: 'error:' + e.message }); throw e; }
    };

    const rutaDeUrl = (s) => {
      let u = String(s).replace(/^https?:\/\/[^/]+/, '');
      return path.join(RAIZ, 'public', decodeURIComponent(u.split('?')[0]).replace(/^\/+/, ''));
    };
    function imgFalso() {
      const oyentes = { load: [], error: [] };
      const el = {
        width: 0, height: 0, complete: false, crossOrigin: null,
        addEventListener: (t, f) => { (oyentes[t] || (oyentes[t] = [])).push(f); },
        removeEventListener: (t, f) => { if (oyentes[t]) oyentes[t] = oyentes[t].filter(x => x !== f); },
        removeAttribute() {}, setAttribute() {}, get nodeType() { return 1; },
      };
      let _src = '';
      Object.defineProperty(el, 'src', {
        get: () => _src,
        set: (v) => {
          _src = v;
          const p = rutaDeUrl(v);
          setTimeout(() => {
            if (fs.existsSync(p)) {
              const ih = leerIHDR(fs.readFileSync(p));
              el.width = ih ? ih.ancho : 1; el.height = ih ? ih.alto : 1;
              el.complete = true; imagenesOk++;
              for (const f of oyentes.load) f({ type: 'load', target: el });
            } else {
              imagenesError++;
              for (const f of oyentes.error) f({ type: 'error', target: el });
            }
          }, 0);
        },
      });
      return el;
    }
    const lienzoFalso = () => ({
      width: 1, height: 1,
      getContext: () => ({
        drawImage() {}, fillRect() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      }),
    });
    globalThis.document = {
      createElement: (t) => (t === 'canvas' ? lienzoFalso() : imgFalso()),
      createElementNS: (ns, t) => (t === 'canvas' ? lienzoFalso() : imgFalso()),
    };
    globalThis.Image = function () { return imgFalso(); };
    globalThis.createImageBitmap = async (x) => ({ width: x?.width || 1, height: x?.height || 1, close() {} });
    globalThis.self = globalThis;
  } else {
    // sin-atlas: no hay servidor, no hay DOM. `fetch` a una ruta relativa falla,
    // que es exactamente lo que pasa si `public/tex/` no fue horneado.
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u) => {
      pedidos.push({ url: String(u), estado: 'error:sin-servidor' });
      throw new TypeError('fetch failed (banco: escenario sin atlas)');
    };
    void fetchReal;
  }

  const THREE = await import('three');

  // El parche de colisión de color: getHexString() devuelve siempre lo mismo.
  // Se aplica ANTES de importar Fauna.js. `getHex()` (número) queda intacto y es
  // lo que el banco usa para medir la identidad visual real.
  let llamadasHexString = 0;
  const hexStringOriginal = THREE.Color.prototype.getHexString;
  THREE.Color.prototype.getHexString = function (...a) {
    llamadasHexString++;
    return modo === 'colision-color' ? 'ffffff' : hexStringOriginal.apply(this, a);
  };

  let mod;
  try {
    mod = await import(pathToFileURL(rutaFauna).href);
  } catch (e) {
    return { error: 'no se pudo importar ' + rutaFauna + ': ' + e.message, avisos };
  }
  const Clase = mod.Fauna || Object.values(mod).find(v => typeof v === 'function' && /fauna/i.test(v.name || ''));
  if (!Clase) return { error: 'Fauna.js no exporta una clase Fauna. Exporta: ' + Object.keys(mod).join(', '), avisos };

  const mundoFalso = {
    dentro: () => true,
    esAgua: () => false,
    alturaEn: () => 800,
    humedadEn: () => 0.5,
    pendienteEn: () => 0.1,
    indiceDe: () => 0,
    distanciaAgua: [30],
    normalEn: (x, z, v) => (v ? v.set(0, 1, 0) : new THREE.Vector3(0, 1, 0)),
  };

  let inst;
  try { inst = new Clase(mundoFalso, datosFauna); }
  catch (e) { return { error: 'el constructor de Fauna lanzó: ' + e.message, avisos }; }

  // ── Cebar el atlas. Se prueba, en orden: (1) el cargador propio de la fase 1,
  // para dejar resuelta la promesa memoizada; (2) cualquier método de instancia
  // sin argumentos cuyo nombre suene a atlas/textura; (3) el mismo método con el
  // atlas ya cargado como único argumento. Se anota cuál funcionó, para no
  // declarar «cargó» sin saber por dónde.
  let atlasDisponible = null, texturasCargadas = 0, comoSeCebo = 'nada';
  if (modo !== 'sin-atlas') {
    try {
      const at = await import(pathToFileURL(path.join(RAIZ, 'src', 'util', 'atlas.js')).href);
      const fn = Object.keys(at).find(k => typeof at[k] === 'function' && /carg/i.test(k));
      if (fn) {
        const r = await at[fn]();
        atlasDisponible = !!(r && r.disponible);
        texturasCargadas = ['texturaAlbedo', 'texturaNormal', 'texturaRugosidadOclusion']
          .filter(k => r && r[k]).length;
        comoSeCebo = 'atlas.js:' + fn + '()';
        globalThis.__atlasCargado = r;
      }
    } catch (e) { avisos.push('cebado por atlas.js falló: ' + e.message); }
  }
  const metodos = new Set();
  for (let p = inst; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    for (const k of Object.getOwnPropertyNames(p)) metodos.add(k);
  }
  const candidatas = [...metodos].filter(k =>
    typeof inst[k] === 'function' && k !== 'constructor' && /atlas|textur|pelaj|prepar/i.test(k));
  for (const k of candidatas) {
    try {
      let r = inst[k].length === 0 ? inst[k]() : inst[k](globalThis.__atlasCargado);
      if (r && typeof r.then === 'function') r = await r;
      comoSeCebo += ' + Fauna.' + k + '()';
    } catch (e) { avisos.push('Fauna.' + k + '() lanzó: ' + e.message); }
  }
  for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r));

  // ── Construir el modelo de cada especie representable
  const construir = typeof inst._obtenerModelo === 'function'
    ? (esp) => inst._obtenerModelo(esp)
    : null;
  if (!construir) {
    return { error: 'Fauna no tiene _obtenerModelo(esp). El banco no sabe por dónde pedir un modelo.', avisos };
  }

  const especies = inst.especies || [];
  const salida = [];
  let excepciones = 0;
  for (const esp of especies) {
    let raiz;
    try { raiz = construir(esp); }
    catch (e) { excepciones++; avisos.push('modelo de ' + esp.id + ' lanzó: ' + e.message); continue; }
    if (!raiz) { excepciones++; avisos.push('modelo de ' + esp.id + ' devolvió ' + raiz); continue; }

    const mallas = [];
    raiz.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry, m = o.material;
      const mats = Array.isArray(m) ? m : [m];
      const mat = mats[0] || {};
      const tri = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      const atributos = Object.keys(g.attributes || {});
      const rangoUV = (nombre) => {
        const a = g.attributes[nombre];
        if (!a) return null;
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < a.count; i++) {
          const u = a.getX(i), v = a.getY(i);
          if (u < minU) minU = u; if (u > maxU) maxU = u;
          if (v < minV) minV = v; if (v > maxV) maxV = v;
        }
        return [minU, maxU, minV, maxV];
      };
      const mapaInfo = (t) => t ? {
        offset: [t.offset.x, t.offset.y],
        repeat: [t.repeat.x, t.repeat.y],
        canal: t.channel ?? 0,
        anisotropy: t.anisotropy ?? 1,
        colorSpace: String(t.colorSpace),
        uuidFuente: t.source ? t.source.uuid : null,
      } : null;
      mallas.push({
        nombre: o.name || '',
        padre: o.parent ? (o.parent.name || (o.parent === raiz ? '<raiz>' : '<grupo>')) : '',
        triangulos: tri,
        vertices: g.attributes.position ? g.attributes.position.count : 0,
        atributos,
        rangoUV: rangoUV('uv'),
        rangoUV1: rangoUV('uv1'),
        castShadow: !!o.castShadow,
        material: {
          uuid: mat.uuid || null,
          colorHex: mat.color ? mat.color.getHex() : null,
          tipo: mat.type || null,
          roughness: mat.roughness,
          map: mapaInfo(mat.map),
          normalMap: mapaInfo(mat.normalMap),
          roughnessMap: mapaInfo(mat.roughnessMap),
          aoMap: mapaInfo(mat.aoMap),
        },
      });
    });

    salida.push({
      id: esp.id,
      clase: esp.clase,
      largoM: esp.largoM,
      alturaCruzM: esp.alturaCruzM,
      pesoKg: esp.pesoKg,
      mallas,
      totalTriangulos: mallas.reduce((s, m) => s + m.triangulos, 0),
      totalMallas: mallas.length,
      materialesDistintos: new Set(mallas.map(m => m.material.uuid)).size,
      partes: {
        cuerpo: !!raiz.getObjectByName('cuerpo'),
        cabeza: !!raiz.getObjectByName('cabeza'),
        cola: !!raiz.getObjectByName('cola'),
        patas: ['pd1', 'pi1', 'pd2', 'pi2'].filter(n => raiz.getObjectByName(n)).length,
        alas: ['ala_d', 'ala_i'].filter(n => raiz.getObjectByName(n)).length,
        y0: raiz.getObjectByName('cuerpo')?.userData?.y0 !== undefined,
      },
    });
  }

  if (servidor) servidor.close();

  return {
    modo,
    rutaFauna,
    atlasDisponible,
    texturasCargadas,
    comoSeCebo,
    llamadasHexString,
    pedidos: pedidos.length,
    imagenesOk,
    imagenesError,
    especiesConstruidas: salida.length,
    excepciones,
    avisos,
    especies: salida,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANDAMIAJE
// ═══════════════════════════════════════════════════════════════════════════

const resultados = [];
let hayRojo = false;

function banco(nombre, r) {
  console.log('\n' + '─'.repeat(74));
  console.log('BANCO ' + nombre);
  console.log('─'.repeat(74));
  if (r.lineas) for (const l of r.lineas) console.log(l);
  const cobertura = r.ejercitado > 0;
  const verde = r.ok && cobertura;
  if (!verde) hayRojo = true;
  console.log('');
  console.log('  cobertura ejercitada: ' + r.ejercitado + (r.unidad ? ' ' + r.unidad : ''));
  if (!cobertura) console.log('  >>> GUARDA DE COBERTURA: cero. El banco no ejercitó nada. ROJO aunque las aserciones pasen.');
  if (r.motivo) console.log('  motivo: ' + r.motivo);
  console.log('  ' + (verde ? 'VERDE' : 'ROJO'));
  resultados.push({ nombre, verde, ejercitado: r.ejercitado, motivo: r.motivo || '' });
  return r;
}

function correrTrabajador(modo, rutaFauna) {
  const salida = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', modo, rutaFauna], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180000, maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  const linea = salida.split('\n').find(l => l.startsWith(MARCA));
  if (!linea) throw new Error('el trabajador no emitió resultado. Salida:\n' + salida.slice(-2000));
  return JSON.parse(linea.slice(MARCA.length));
}

/** Ventana de la celda de cada especie, leída del manifiesto real. */
function celdasDelManifiesto() {
  if (!fs.existsSync(MANIFIESTO)) return null;
  const man = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const out = new Map();
  const esp = man.especies || {};
  for (const [id, e] of Object.entries(esp)) {
    if (typeof e.u0 === 'number') out.set(id, { u0: e.u0, v0: e.v0, u1: e.u1, v1: e.v1 });
    else if (typeof e.col === 'number' && man.grid) {
      const w = 1 / man.grid.cols, h = 1 / man.grid.rows;
      out.set(id, { u0: e.col * w, v0: e.row * h, u1: (e.col + 1) * w, v1: (e.row + 1) * h });
    }
  }
  return out.size ? out : null;
}

/** Identidad visual de una malla: color real + ventana del mapa. `getHex()` es
 *  un número y NO está parcheado, así que sobrevive a la colisión forzada. */
function identidadVisual(m) {
  const t = m.material.map;
  const v = t ? t.offset.map(n => n.toFixed(6)).join(',') + '|' + t.repeat.map(n => n.toFixed(6)).join(',') : 'sin-mapa';
  return String(m.material.colorHex) + '#' + v;
}

function fuenteBase() {
  fs.mkdirSync(TMP, { recursive: true });
  const destino = path.join(TMP, 'Fauna-base.js');
  const txt = execFileSync('git', ['show', BASE_COMMIT + ':src/entities/Fauna.js'], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  fs.writeFileSync(destino, txt);
  return { ruta: destino, texto: txt };
}

/** Extrae el cuerpo de un método de una clase, por conteo de llaves. */
function extraerMetodo(fuente, nombre) {
  const re = new RegExp('\\n\\s{2}' + nombre + '\\s*\\(', 'g');
  const m = re.exec(fuente);
  if (!m) return null;
  let i = fuente.indexOf('{', m.index);
  if (i < 0) return null;
  let prof = 0, j = i, enCadena = null, enLinea = false, enBloque = false;
  for (; j < fuente.length; j++) {
    const c = fuente[j], d = fuente[j + 1];
    if (enLinea) { if (c === '\n') enLinea = false; continue; }
    if (enBloque) { if (c === '*' && d === '/') { enBloque = false; j++; } continue; }
    if (enCadena) { if (c === '\\') { j++; continue; } if (c === enCadena) enCadena = null; continue; }
    if (c === '/' && d === '/') { enLinea = true; j++; continue; }
    if (c === '/' && d === '*') { enBloque = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { enCadena = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) { j++; break; } }
  }
  return fuente.slice(i, j).replace(/\r/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════
// LOS SEIS BANCOS
// ═══════════════════════════════════════════════════════════════════════════

function bancoUV(con) {
  const L = [];
  if (con.error) return { ok: false, ejercitado: 0, motivo: con.error, lineas: L };

  const canal = (n) => (n === 0 ? 'uv' : 'uv' + n);
  let conMapa = 0, sinUV = [], uvDegenerada = [], canalFaltante = [], inspeccionadas = 0;

  for (const e of con.especies) {
    for (const m of e.mallas) {
      inspeccionadas++;
      const mapas = [['map', m.material.map], ['normalMap', m.material.normalMap],
                     ['roughnessMap', m.material.roughnessMap], ['aoMap', m.material.aoMap]]
        .filter(([, t]) => t);
      if (!mapas.length) continue;
      conMapa++;
      for (const [nombre, t] of mapas) {
        const attr = canal(t.canal);
        if (!m.atributos.includes(attr)) {
          canalFaltante.push(e.id + '/' + (m.nombre || m.padre) + ' ' + nombre + ' pide ' + attr + ', la geometría tiene [' + m.atributos.join(',') + ']');
          continue;
        }
        if (attr === 'uv') {
          if (!m.rangoUV) { sinUV.push(e.id + '/' + m.nombre); continue; }
          const [minU, maxU, minV, maxV] = m.rangoUV;
          if (!(maxU - minU > 0.05) && !(maxV - minV > 0.05)) {
            uvDegenerada.push(e.id + '/' + (m.nombre || m.padre) + ' rango u=[' +
              minU.toFixed(3) + ',' + maxU.toFixed(3) + '] v=[' + minV.toFixed(3) + ',' + maxV.toFixed(3) + ']');
          }
        }
      }
    }
  }

  L.push('  mallas inspeccionadas: ' + inspeccionadas + ' · con al menos un mapa: ' + conMapa);
  L.push('  (en three ' + 'r169' + ', map/normalMap/roughnessMap/aoMap usan el canal que dice');
  L.push('   texture.channel: 0 → atributo `uv`. Se comprueba el que cada mapa pide.)');

  let ok = true;
  if (canalFaltante.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + canalFaltante.length + ' mapas sobre una geometría SIN el atributo de UV que piden.');
    L.push('      Con un atributo ausente WebGL entrega (0,0) en todos los vértices: la malla');
    L.push('      entera muestrea UN texel. El animal sale de un color plano, sin error.');
    for (const s of canalFaltante.slice(0, 8)) L.push('        ' + s);
    if (canalFaltante.length > 8) L.push('        … y ' + (canalFaltante.length - 8) + ' más');
  }
  if (sinUV.length) { ok = false; L.push('  >>> ' + sinUV.length + ' mallas con mapa y sin atributo uv legible'); }
  if (uvDegenerada.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + uvDegenerada.length + ' mallas con UV degenerada (todo el rango en menos de 0,05).');
    L.push('      Un `uv` relleno de ceros pasa la comprobación de existencia y muestrea igual');
    L.push('      un solo texel: por eso se mide el rango y no la presencia.');
    for (const s of uvDegenerada.slice(0, 8)) L.push('        ' + s);
  }

  // GUARDA: si NINGUNA malla tiene mapa, todo lo de arriba es cierto por vacío.
  if (conMapa === 0) {
    L.push('');
    L.push('  >>> NINGUNA malla lleva un mapa. Las aserciones de este banco son ciertas por');
    L.push('      vacío. Es la trampa nº 8 de ESTADO.md: la guarda tiene que preguntar si el');
    L.push('      camino feliz llegó a funcionar, no sólo si corrió.');
    return { ok: false, ejercitado: 0, unidad: 'mallas con mapa', motivo: 'cero mallas texturizadas', lineas: L };
  }
  return { ok, ejercitado: conMapa, unidad: 'mallas con mapa', lineas: L };
}

function bancoCelda(con, celdas) {
  const L = [];
  if (con.error) return { ok: false, ejercitado: 0, motivo: con.error, lineas: L };
  if (!celdas) return { ok: false, ejercitado: 0, motivo: 'no se pudo leer public/tex/manifiesto.json', lineas: L };

  const rep = especiesRepresentables();
  L.push('  especies representables derivadas de fauna.json: ' + rep.length +
    ' · celdas en el manifiesto: ' + celdas.size);
  if (rep.length !== 44) {
    return { ok: false, ejercitado: 0, motivo: 'se esperaban 44 especies representables y salieron ' + rep.length, lineas: L };
  }

  const EPS = 1e-4;
  let ok = true, verificadas = 0, especiesConTextura = 0;
  const fuera = [], cruzadas = [], ventanaPorEspecie = new Map();

  for (const e of con.especies) {
    const c = celdas.get(e.id);
    let tuvo = false;
    for (const m of e.mallas) {
      for (const [nombre, t] of [['map', m.material.map], ['normalMap', m.material.normalMap],
                                 ['roughnessMap', m.material.roughnessMap], ['aoMap', m.material.aoMap]]) {
        if (!t) continue;
        verificadas++; tuvo = true;
        const u0 = t.offset[0], v0 = t.offset[1];
        const u1 = u0 + t.repeat[0], v1 = v0 + t.repeat[1];
        if (!c) { fuera.push(e.id + ': sin celda en el manifiesto'); ok = false; continue; }
        const dentro = u0 >= c.u0 - EPS && v0 >= c.v0 - EPS && u1 <= c.u1 + EPS && v1 <= c.v1 + EPS;
        if (!dentro) {
          ok = false;
          fuera.push(e.id + '/' + (m.nombre || m.padre) + ' ' + nombre + ' muestrea [' +
            u0.toFixed(4) + ',' + u1.toFixed(4) + ']×[' + v0.toFixed(4) + ',' + v1.toFixed(4) +
            '] fuera de su celda [' + c.u0.toFixed(4) + ',' + c.u1.toFixed(4) + ']×[' + c.v0.toFixed(4) + ',' + c.v1.toFixed(4) + ']');
          // ¿Cae en la celda de otra especie? Eso es literalmente el pelaje ajeno.
          for (const [otro, oc] of celdas) {
            if (otro === e.id) continue;
            if (u0 >= oc.u0 - EPS && v0 >= oc.v0 - EPS && u1 <= oc.u1 + EPS && v1 <= oc.v1 + EPS) {
              cruzadas.push(e.id + ' está muestreando la celda de ' + otro);
            }
          }
        }
        if (!ventanaPorEspecie.has(e.id)) ventanaPorEspecie.set(e.id, new Set());
        ventanaPorEspecie.get(e.id).add(u0.toFixed(6) + ',' + v0.toFixed(6) + ',' + t.repeat[0].toFixed(6) + ',' + t.repeat[1].toFixed(6));
      }
    }
    if (tuvo) especiesConTextura++;
  }

  L.push('  especies con al menos una textura aplicada: ' + especiesConTextura + ' de ' + con.especies.length);
  L.push('  ventanas de muestreo verificadas contra el manifiesto: ' + verificadas);

  // Dos especies distintas jamás pueden compartir ventana: si comparten, una de
  // las dos se ve como la otra.
  const porVentana = new Map();
  for (const [id, set] of ventanaPorEspecie) {
    for (const v of set) {
      if (!porVentana.has(v)) porVentana.set(v, []);
      porVentana.get(v).push(id);
    }
  }
  const compartidas = [...porVentana.entries()].filter(([, ids]) => ids.length > 1);
  if (compartidas.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + compartidas.length + ' ventanas compartidas por más de una especie:');
    for (const [v, ids] of compartidas.slice(0, 6)) L.push('        ' + ids.join(' = ') + '  →  ' + v);
  }

  if (fuera.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + fuera.length + ' muestreos fuera de la celda de su especie:');
    for (const s of fuera.slice(0, 10)) L.push('        ' + s);
  }
  if (cruzadas.length) {
    L.push('');
    L.push('  >>> Y ' + cruzadas.length + ' de ellos caen justo en la celda de OTRA especie:');
    for (const s of cruzadas.slice(0, 10)) L.push('        ' + s);
    L.push('      Eso es «un animal sale con el pelaje de otro», sin error ni aviso.');
  }

  if (especiesConTextura < con.especies.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + (con.especies.length - especiesConTextura) + ' especies quedaron SIN textura teniendo celda horneada.');
  }

  if (verificadas === 0) {
    L.push('  >>> ninguna ventana verificada: el banco no midió nada (trampa nº 8).');
    return { ok: false, ejercitado: 0, unidad: 'ventanas', motivo: 'ninguna textura aplicada', lineas: L };
  }
  return { ok, ejercitado: verificadas, unidad: 'ventanas verificadas', lineas: L };
}

function bancoColision(con, col) {
  const L = [];
  if (con.error) return { ok: false, ejercitado: 0, motivo: 'corrida normal: ' + con.error, lineas: L };
  if (col.error) return { ok: false, ejercitado: 0, motivo: 'corrida con colisión: ' + col.error, lineas: L };

  L.push('  Se fuerza `THREE.Color.prototype.getHexString()` a devolver siempre "ffffff"');
  L.push('  y se reconstruyen las 44 especies. La identidad visual se mide con');
  L.push('  `color.getHex()` (número, NO parcheado) + la ventana del mapa, así que el');
  L.push('  parche no puede falsear la medición.');
  L.push('');
  L.push('  llamadas a getHexString() en la corrida normal : ' + con.llamadasHexString);
  L.push('  llamadas a getHexString() con colisión forzada : ' + col.llamadasHexString);
  if (con.llamadasHexString === 0) {
    L.push('  (cero llamadas: la agrupación ya no depende del hex del color. Bien.)');
  }

  const porId = new Map(col.especies.map(e => [e.id, e]));
  let ok = true, comparadas = 0;
  const rotas = [];

  for (const a of con.especies) {
    const b = porId.get(a.id);
    if (!b) { ok = false; rotas.push(a.id + ': no se construyó con la colisión forzada'); continue; }
    const mapa = (e) => {
      const m = new Map();
      for (const x of e.mallas) {
        const k = identidadVisual(x);
        m.set(k, (m.get(k) || 0) + x.vertices);
      }
      return m;
    };
    const ma = mapa(a), mb = mapa(b);
    comparadas++;
    const claves = new Set([...ma.keys(), ...mb.keys()]);
    const dif = [];
    for (const k of claves) {
      const va = ma.get(k) || 0, vb = mb.get(k) || 0;
      if (va !== vb) dif.push(k + ': ' + va + ' → ' + vb + ' vértices');
    }
    if (dif.length) {
      ok = false;
      rotas.push(a.id + ' — ' + dif.slice(0, 4).join(' · ') + (dif.length > 4 ? ' …' : ''));
    }
  }

  L.push('');
  L.push('  especies comparadas: ' + comparadas + ' · especies cuya geometría migró de identidad visual: ' + rotas.length);

  if (rotas.length) {
    L.push('');
    L.push('  >>> Con dos colores indistinguibles, geometría que era de una identidad visual');
    L.push('      terminó bajo otra. Eso es `compactar()` agrupando por color: dos piezas que');
    L.push('      no debían fusionarse quedaron bajo un solo material, y una muestrea lo de la');
    L.push('      otra. Nada falla ni avisa.');
    for (const s of rotas.slice(0, 10)) L.push('        ' + s);
    if (rotas.length > 10) L.push('        … y ' + (rotas.length - 10) + ' especies más');
  }

  // GUARDA: sin texturas aplicadas este banco sigue siendo válido para el color,
  // pero hay que decir cuánto midió y de qué tipo.
  const conMapa = con.especies.reduce((s, e) => s + e.mallas.filter(m => m.material.map).length, 0);
  L.push('  mallas con mapa en la corrida normal: ' + conMapa +
    ' (si es 0, este banco sólo pudo medir la parte de color, no la de celda)');
  if (comparadas === 0) return { ok: false, ejercitado: 0, motivo: 'no se comparó ni una especie', lineas: L };
  return { ok, ejercitado: comparadas, unidad: 'especies comparadas', lineas: L };
}

function bancoPresupuesto(con, sin, base) {
  const L = [];
  if (base.error) return { ok: false, ejercitado: 0, motivo: 'línea de base: ' + base.error, lineas: L };
  const ahora = con.error ? sin : con;
  if (!ahora || ahora.error) return { ok: false, ejercitado: 0, motivo: 'corrida actual: ' + (ahora && ahora.error), lineas: L };

  const bp = new Map(base.especies.map(e => [e.id, e]));
  L.push('  línea de base: ' + BASE_COMMIT + ' · comparación por especie, mismo predicado, misma máquina');
  L.push('');
  L.push('  ' + 'especie'.padEnd(26) + 'tri antes'.padStart(10) + 'tri ahora'.padStart(11) +
    'dibujos'.padStart(9) + '→'.padStart(3) + 'ahora'.padStart(7) + '   sombra a→d');

  let triA = 0, triB = 0, dibA = 0, dibB = 0, somA = 0, somB = 0, comparadas = 0;
  const peores = [];
  for (const e of ahora.especies) {
    const b = bp.get(e.id);
    if (!b) continue;
    comparadas++;
    triA += b.totalTriangulos; triB += e.totalTriangulos;
    dibA += b.totalMallas; dibB += e.totalMallas;
    const sa = b.mallas.filter(m => m.castShadow).length, sb = e.mallas.filter(m => m.castShadow).length;
    somA += sa; somB += sb;
    peores.push({ id: e.id, dTri: e.totalTriangulos - b.totalTriangulos, dDib: e.totalMallas - b.totalMallas,
      a: b, b: e, sa, sb });
  }
  peores.sort((x, y) => (y.dDib - x.dDib) || (y.dTri - x.dTri));
  for (const p of peores.slice(0, 12)) {
    L.push('  ' + p.id.padEnd(26) + String(p.a.totalTriangulos).padStart(10) + String(p.b.totalTriangulos).padStart(11) +
      String(p.a.totalMallas).padStart(9) + '→'.padStart(3) + String(p.b.totalMallas).padStart(7) +
      '   ' + p.sa + '→' + p.sb);
  }
  if (peores.length > 12) L.push('  … (' + (peores.length - 12) + ' especies más, ordenadas por crecimiento de dibujos)');

  const mediaTriA = triA / Math.max(1, comparadas), mediaTriB = triB / Math.max(1, comparadas);
  const mediaDibA = dibA / Math.max(1, comparadas), mediaDibB = dibB / Math.max(1, comparadas);
  const escenaA = mediaTriA * MAX_VIVOS, escenaB = mediaTriB * MAX_VIVOS;
  const msHoy = MS_CUADRO_BAJA * FRACCION_FAUNA_HOY;
  const factorDibujos = mediaDibB / Math.max(1e-9, mediaDibA);

  L.push('');
  L.push('  ── los números ──────────────────────────────────────────────────────');
  L.push('  triángulos por animal (media)  : ' + mediaTriA.toFixed(0) + '  →  ' + mediaTriB.toFixed(0) +
    '   (×' + (mediaTriB / Math.max(1e-9, mediaTriA)).toFixed(2) + ')');
  L.push('  dibujos por animal (media)     : ' + mediaDibA.toFixed(2) + '  →  ' + mediaDibB.toFixed(2) +
    '   (×' + factorDibujos.toFixed(2) + ')');
  L.push('  proyectores de sombra (media)  : ' + (somA / Math.max(1, comparadas)).toFixed(2) + '  →  ' + (somB / Math.max(1, comparadas)).toFixed(2));
  L.push('  triángulos de escena a ' + MAX_VIVOS + ' vivos: ' + escenaA.toFixed(0) + '  →  ' + escenaB.toFixed(0) +
    '   (techo del banco: ' + TECHO_TRIANGULOS_ESCENA + ')');
  L.push('');
  L.push('  El costo de la fauna hoy es < 5 % de ' + MS_CUADRO_BAJA + ' ms a Baja 1024×576 = < ' +
    msHoy.toFixed(2) + ' ms;');
  L.push('  el techo de RONDA3 es ' + TECHO_MS + ' ms, así que el margen es ×' + MARGEN_CRECIMIENTO.toFixed(2) + '.');
  L.push('  Con cuatro cascadas de sombra el costo por animal lo manda el número de');
  L.push('  DIBUJOS (cada malla se dibuja cinco veces), no el de triángulos: el cuadro a');
  L.push('  esta resolución está dominado por el terreno (35 %) y por fragmento, no por');
  L.push('  setup de vértices. Por eso el techo duro se pone sobre los dibujos.');
  L.push('  proyección de costo: ' + msHoy.toFixed(2) + ' ms × ' + factorDibujos.toFixed(2) + ' = ' +
    (msHoy * factorDibujos).toFixed(2) + ' ms  contra el techo de ' + TECHO_MS + ' ms');

  let ok = true;
  if (factorDibujos > MARGEN_CRECIMIENTO) {
    ok = false;
    L.push('  >>> los dibujos por animal crecen ×' + factorDibujos.toFixed(2) + ', por encima del margen ×' +
      MARGEN_CRECIMIENTO.toFixed(2) + ': proyecta ' + (msHoy * factorDibujos).toFixed(2) + ' ms > ' + TECHO_MS + ' ms');
  }
  if (escenaB > TECHO_TRIANGULOS_ESCENA) {
    ok = false;
    L.push('  >>> ' + escenaB.toFixed(0) + ' triángulos de fauna en escena, por encima del techo de ' + TECHO_TRIANGULOS_ESCENA);
  }

  // La otra mitad del encargo: la silueta tenía que cambiar. Si nada cambió, la
  // fase entregó media cosa y el banco lo tiene que decir.
  const cambiaronGeometria = peores.filter(p => p.dTri !== 0 || p.dDib !== 0).length;
  L.push('');
  L.push('  especies cuya geometría cambió respecto de la línea de base: ' + cambiaronGeometria + ' de ' + comparadas);
  if (cambiaronGeometria === 0) {
    ok = false;
    L.push('  >>> NINGUNA especie cambió de geometría. La mitad B del encargo (la silueta:');
    L.push('      lomo, cruz y grupa en vez de una esfera escalada) no se hizo.');
  }

  if (comparadas === 0) return { ok: false, ejercitado: 0, motivo: 'no se comparó ni una especie contra la base', lineas: L };
  return { ok, ejercitado: comparadas, unidad: 'especies comparadas contra la base', lineas: L };
}

function bancoSinAtlas(sin, base) {
  const L = [];
  if (sin.error) return { ok: false, ejercitado: 0, motivo: 'sin atlas, Fauna se rompe: ' + sin.error, lineas: L };

  const fuente = fs.readFileSync(FAUNA_JS, 'utf8');
  const importEstatico = /^\s*import\s+[^;]*from\s+['"][^'"]*(?:public\/tex|\/tex\/|manifiesto)[^'"]*['"]/m.test(fuente);
  L.push('  import estático de algo de public/tex/ en Fauna.js: ' + (importEstatico ? 'SÍ — rompería el build' : 'no'));

  let ok = !importEstatico;
  L.push('  pedidos de red intentados y fallados a propósito: ' + sin.pedidos);
  L.push('  especies construidas sin atlas: ' + sin.especiesConstruidas + ' · excepciones: ' + sin.excepciones);

  if (sin.excepciones > 0) { ok = false; L.push('  >>> alguna especie no se pudo armar sin atlas'); }
  if (sin.especiesConstruidas !== 44) { ok = false; L.push('  >>> se esperaban 44 especies armadas sin atlas'); }

  let conMapa = 0, sinColor = 0, negras = 0, mallas = 0;
  for (const e of sin.especies) {
    for (const m of e.mallas) {
      mallas++;
      if (m.material.map || m.material.normalMap || m.material.roughnessMap || m.material.aoMap) conMapa++;
      if (m.material.colorHex === null || m.material.colorHex === undefined) sinColor++;
      else if (m.material.colorHex === 0) negras++;
    }
  }
  L.push('  mallas armadas sin atlas: ' + mallas + ' · con algún mapa colgado: ' + conMapa +
    ' · sin color: ' + sinColor + ' · en negro puro: ' + negras);
  if (conMapa > 0) { ok = false; L.push('  >>> hay mapas colgados sin atlas: apuntan a una textura que no existe'); }
  if (sinColor > 0) { ok = false; L.push('  >>> hay materiales sin color: la degradación deja el animal sin nada que dibujar'); }
  if (negras > 0) {
    ok = false;
    L.push('  >>> ' + negras + ' mallas en negro puro. Es el artefacto que la ronda 1 pagó con las');
    L.push('      piedras y los troncos caídos: un albedo 0 multiplicado por cualquier luz sigue');
    L.push('      siendo negro.');
  }

  // Comparación con la línea de base: sin atlas tiene que verse como antes.
  const bp = new Map(base.error ? [] : base.especies.map(e => [e.id, e]));
  let coloresIguales = 0, coloresDistintos = [];
  for (const e of sin.especies) {
    const b = bp.get(e.id);
    if (!b) continue;
    const ca = new Set(b.mallas.map(m => m.material.colorHex));
    const cb = new Set(e.mallas.map(m => m.material.colorHex));
    const faltan = [...ca].filter(c => !cb.has(c));
    if (faltan.length === 0) coloresIguales++;
    else coloresDistintos.push(e.id + ': perdió los colores ' + faltan.map(c => '#' + Number(c).toString(16).padStart(6, '0')).join(' '));
  }
  L.push('  especies que sin atlas conservan toda su paleta de la línea de base: ' + coloresIguales + ' de ' + bp.size);
  if (coloresDistintos.length) {
    L.push('  (aviso, no rojo: la silueta nueva puede haber redistribuido los tonos)');
    for (const s of coloresDistintos.slice(0, 5)) L.push('        ' + s);
  }

  // Partes: sin atlas la animación tiene que seguir enganchada.
  let partesRotas = [];
  for (const e of sin.especies) {
    const b = bp.get(e.id);
    if (!b) continue;
    for (const k of ['cuerpo', 'cabeza', 'cola', 'y0']) {
      if (b.partes[k] && !e.partes[k]) partesRotas.push(e.id + ' perdió ' + k);
    }
    if (e.partes.patas < b.partes.patas) partesRotas.push(e.id + ' patas ' + b.partes.patas + '→' + e.partes.patas);
    if (e.partes.alas < b.partes.alas) partesRotas.push(e.id + ' alas ' + b.partes.alas + '→' + e.partes.alas);
  }
  if (partesRotas.length) {
    ok = false;
    L.push('');
    L.push('  >>> ' + partesRotas.length + ' partes que `_animar()` busca por getObjectByName desaparecieron.');
    L.push('      La animación se rompe en silencio: no lanza, simplemente el animal deja de moverse.');
    for (const s of partesRotas.slice(0, 10)) L.push('        ' + s);
  } else {
    L.push('  todas las partes de `_animar()` (cuerpo/cabeza/cola/patas/alas/y0) siguen en su lugar');
  }

  // vite build: si el árbol no compila, el arranque está roto de verdad.
  let compila = null;
  if (process.env.BANCO_FAUNA) {
    L.push('  vite build: salteado (BANCO_FAUNA apunta a una copia, no al árbol real)');
    return { ok, ejercitado: (sin.especiesConstruidas > 0 ? sin.especiesConstruidas : 0), unidad: 'especies armadas sin atlas', lineas: L };
  }
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
      cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, stdio: 'pipe',
    });
    compila = true;
  } catch (e) {
    compila = false;
    L.push('  >>> `vite build` FALLA: ' + String(e.stdout || e.message).split('\n').slice(-6).join(' | '));
  }
  L.push('  vite build: ' + (compila ? 'pasa' : 'FALLA'));
  if (!compila) ok = false;

  const ejercitado = (sin.especiesConstruidas > 0 && mallas > 0) ? sin.especiesConstruidas : 0;
  return { ok, ejercitado, unidad: 'especies armadas sin atlas', lineas: L };
}

function bancoComportamiento(textoBase) {
  const L = [];
  const ahora = fs.readFileSync(FAUNA_JS, 'utf8');

  // Lo que cerró `vida` en la ronda 1 y RONDA3 dice explícitamente que no se
  // toca: conducta, voces y aptitud de especie.
  const intocables = ['_esAcuatica', '_aptitud', '_actividad', '_vocalizar', '_azimut',
                      '_variante', '_alarma', '_contagiar', '_simular'];
  let ok = true, comparados = 0;
  const cambiados = [], ausentes = [];

  for (const n of intocables) {
    const a = extraerMetodo(textoBase, n);
    const b = extraerMetodo(ahora, n);
    if (a === null) { L.push('  ' + n.padEnd(14) + ' no estaba en la línea de base (se salta)'); continue; }
    if (b === null) { ausentes.push(n); ok = false; continue; }
    comparados++;
    const norm = (s) => s.replace(/\r/g, '');
    if (norm(a) !== norm(b)) { cambiados.push(n); ok = false; }
  }

  L.push('  métodos de conducta/voz/aptitud comparados byte a byte contra ' + BASE_COMMIT + ': ' + comparados);
  if (ausentes.length) L.push('  >>> desaparecieron: ' + ausentes.join(', '));
  if (cambiados.length) {
    L.push('  >>> CAMBIARON: ' + cambiados.join(', '));
    L.push('      RONDA3: «No tocar comportamiento, voces ni aptitud de especie. Eso lo cerró');
    L.push('      `vida` en la ronda 1 y no es de esta ronda.»');
  } else if (comparados > 0) {
    L.push('  ninguno cambió');
  }

  // `_animar` y `_crear` sí pueden cambiar, pero conviene verlo.
  for (const n of ['_animar', '_crear', '_obtenerModelo', '_reponer']) {
    const a = extraerMetodo(textoBase, n), b = extraerMetodo(ahora, n);
    if (a === null || b === null) { L.push('  (informativo) ' + n + ': no comparable'); continue; }
    L.push('  (informativo) ' + n.padEnd(16) + (a.replace(/\r/g, '') === b.replace(/\r/g, '') ? 'igual' : 'CAMBIÓ'));
  }

  // Las constantes de población y de sombra son presupuesto, no estilo.
  for (const [nombre, re] of [['MAX_VIVOS', /const MAX_VIVOS = (\d+)/], ['PESO_MIN_SOMBRA', /const PESO_MIN_SOMBRA = ([\d.]+)/],
                              ['RADIO_APARICION', /const RADIO_APARICION = (\d+)/]]) {
    const a = textoBase.match(re), b = ahora.match(re);
    const va = a ? a[1] : '?', vb = b ? b[1] : '?';
    L.push('  ' + nombre.padEnd(16) + va + ' → ' + vb + (va !== vb ? '   >>> CAMBIÓ' : ''));
    if (va !== vb) { ok = false; }
  }

  if (comparados === 0) return { ok: false, ejercitado: 0, motivo: 'no se pudo comparar ni un método', lineas: L };
  return { ok, ejercitado: comparados, unidad: 'métodos comparados', lineas: L };
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDA
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('BANCO DE LA FASE 2 · ronda 3 · SurviBar');
  console.log('escrito por el jefe, en paralelo al agente. ' + new Date().toISOString());
  fs.mkdirSync(TMP, { recursive: true });

  const base = fuenteBase();
  console.log('línea de base: ' + BASE_COMMIT + ':src/entities/Fauna.js  (' + base.texto.length + ' bytes)');

  console.log('\ncorriendo los escenarios, un proceso por cada uno…');
  const escenarios = {};
  for (const [clave, modo, ruta] of [
    ['con', 'con-atlas', FAUNA_JS],
    ['col', 'colision-color', FAUNA_JS],
    ['sin', 'sin-atlas', FAUNA_JS],
    ['base', 'sin-atlas', base.ruta],
  ]) {
    process.stdout.write('  · ' + clave.padEnd(5) + ' (' + modo + ') … ');
    try {
      escenarios[clave] = correrTrabajador(modo, ruta);
      const e = escenarios[clave];
      console.log(e.error ? 'ERROR: ' + e.error
        : (e.especiesConstruidas + ' especies · atlas=' + e.atlasDisponible + ' · texturas=' + e.texturasCargadas +
           ' · cebado: ' + e.comoSeCebo));
      if (e.avisos && e.avisos.length) for (const a of e.avisos.slice(0, 6)) console.log('      aviso: ' + a);
    } catch (err) {
      escenarios[clave] = { error: err.message, especies: [] };
      console.log('ERROR: ' + err.message.split('\n')[0]);
    }
  }

  const celdas = celdasDelManifiesto();

  // Guarda global de la trampa nº 8: si el escenario con atlas no llegó a
  // disponible=true con sus tres texturas, los bancos 1-3 no están midiendo
  // texturas, están midiendo el mismo fallo tres veces.
  console.log('\n' + '═'.repeat(74));
  console.log('GUARDA DEL CAMINO FELIZ (trampa nº 8 de ESTADO.md)');
  console.log('═'.repeat(74));
  const c = escenarios.con;
  const felizOk = !c.error && c.atlasDisponible === true && c.texturasCargadas >= 3 && c.imagenesOk >= 3;
  console.log('  atlas disponible: ' + (c.error ? '—' : c.atlasDisponible) +
    ' · texturas del cargador: ' + (c.texturasCargadas ?? '—') +
    ' · imágenes decodificadas: ' + (c.imagenesOk ?? '—') +
    ' · pedidos de red: ' + (c.pedidos ?? '—'));
  if (!felizOk) {
    console.log('  >>> EL CAMINO FELIZ NO LLEGÓ A FUNCIONAR. Todo lo que digan los bancos 1 a 3');
    console.log('      sobre texturas es cierto por vacío. No se cierra la fase con esto.');
  } else {
    console.log('  el camino feliz cargó de verdad: 3 texturas decodificadas desde el disco real');
  }

  banco('1 · UV — toda malla con mapa tiene el atributo de UV que ese mapa pide', bancoUV(escenarios.con));
  banco('2 · IDENTIDAD DE CELDA — ningún animal muestrea la celda de otro', bancoCelda(escenarios.con, celdas));
  banco('3 · COLISIÓN DE COLOR FORZADA — `compactar()` no puede agrupar por color', bancoColision(escenarios.con, escenarios.col));
  banco('4 · PRESUPUESTO DE SILUETA — triángulos y dibujos contra ' + BASE_COMMIT, bancoPresupuesto(escenarios.con, escenarios.sin, escenarios.base));
  banco('5 · ARRANQUE SIN ATLAS — el juego arma las 44 especies igual', bancoSinAtlas(escenarios.sin, escenarios.base));
  banco('6 · COMPORTAMIENTO INTACTO — conducta, voz y aptitud byte a byte', bancoComportamiento(base.texto));

  if (!felizOk) hayRojo = true;

  console.log('\n' + '═'.repeat(74));
  console.log('RESUMEN');
  console.log('═'.repeat(74));
  console.log('  ' + (felizOk ? 'VERDE' : 'ROJO ') + '  guarda del camino feliz (el atlas cargó de verdad)');
  for (const r of resultados) {
    console.log('  ' + (r.verde ? 'VERDE' : 'ROJO ') + '  ejercitó ' + String(r.ejercitado).padStart(5) + '  ' + r.nombre +
      (r.motivo ? '\n           ' + r.motivo.split('\n')[0] : ''));
  }
  console.log('');
  console.log(hayRojo ? 'LA FASE 2 NO CIERRA.' : 'LOS SEIS BANCOS EN VERDE, CON COBERTURA DEMOSTRADA.');
  process.exit(hayRojo ? 1 : 0);
}

export { identidadVisual, extraerMetodo, celdasDelManifiesto, bancoUV, bancoCelda, bancoColision };

if (process.argv[2] === '--worker') {
  trabajador(process.argv[3], process.argv[4])
    .then(r => { console.log(MARCA + JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.log(MARCA + JSON.stringify({ error: 'trabajador: ' + e.stack, especies: [] })); process.exit(0); });
} else if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
