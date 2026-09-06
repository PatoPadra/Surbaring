/**
 * BANCO DE LA FASE 1 (horno) — ronda 3.
 *
 * Lo escribe el JEFE, no el agente. Regla 1 de RONDA3.md: quien escribe el
 * arreglo no puede escribir el banco que lo mide. La revisión independiente de
 * la ronda 2 encontró nueve defectos que ninguno de los tres jefes podía ver en
 * su propio trabajo.
 *
 * Escrito EN PARALELO al agente y contra el contrato del encargo, no leyendo su
 * implementación ni su informe.
 *
 * Cuatro bancos:
 *   1. Determinismo — hornear dos veces da bytes idénticos.
 *   2. Presupuesto — el costo real en VRAM con mipmaps no pasa de 24 MB.
 *   3. Cobertura de especies — una entrada por cada especie representable de
 *      fauna.json, derivada del JSON y NO del propio manifiesto, y ninguna
 *      celda fuera del atlas ni pisando a otra.
 *   4. Degradación — el cargador devuelve algo usable sin manifiesto y sin PNG,
 *      ejercitado borrando los archivos de verdad, no con un mock complaciente.
 *
 * REGLA 2 de RONDA3.md — GUARDA DE COBERTURA. Cada banco cuenta cuántas cosas
 * ejercitó de verdad. Si ese contador da cero, el banco es ROJO aunque todas
 * sus aserciones hayan pasado. Un banco que arma sus dependencias a mano y las
 * consulta con `?.` da verde sin ejercitar nada: pasó en la ronda 2 y el cero
 * estaba impreso en pantalla sin que nadie lo leyera.
 *
 * Uso:  node .claude/flota/banco-r3-fase1.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TEX = path.join(RAIZ, 'public', 'tex');
const HORNEADOR = path.join(RAIZ, 'tools', 'hornear-texturas.mjs');
const CARGADOR = path.join(RAIZ, 'src', 'util', 'atlas.js');
const FAUNA = path.join(RAIZ, 'src', 'data', 'fauna.json');
const TMP = path.join(RAIZ, '.claude', 'flota', '.tmp-banco-fase1');

const TECHO_VRAM_MB = 24;

// ── Andamiaje ───────────────────────────────────────────────────────────────

const resultados = [];
let hayRojo = false;

function banco(nombre, fn) {
  console.log('\n' + '─'.repeat(72));
  console.log('BANCO ' + nombre);
  console.log('─'.repeat(72));
  let r;
  try {
    r = fn();
  } catch (e) {
    r = { ok: false, ejercitado: 0, motivo: 'excepción: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : e) };
  }
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

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function listarArchivos(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  (function rec(d, pre) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const p = path.join(d, e.name);
      const rel = pre ? pre + '/' + e.name : e.name;
      if (e.isDirectory()) rec(p, rel); else out.push(rel);
    }
  })(dir, '');
  return out;
}

function copiarDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const rel of listarArchivos(src)) {
    const d = path.join(dst, rel);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(path.join(src, rel), d);
  }
}

/** Lee el IHDR de un PNG: ancho, alto, profundidad, tipo de color. Sin librería. */
function leerIHDR(buf) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(firma)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    ancho: buf.readUInt32BE(16),
    alto: buf.readUInt32BE(20),
    profundidad: buf.readUInt8(24),
    tipoColor: buf.readUInt8(25),
  };
}

/** Canales por tipo de color PNG. En GPU todo sube como RGBA de 8 bits. */
const CANALES_PNG = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function esPotenciaDeDos(n) { return n > 0 && (n & (n - 1)) === 0; }

/** Especies representables, derivadas de fauna.json con el predicado de Fauna.js:45. */
function especiesRepresentables() {
  const datos = JSON.parse(fs.readFileSync(FAUNA, 'utf8'));
  return datos.especies.filter(e =>
    ['mamifero', 'ave'].includes(e.clase) &&
    e.largoM && e.largoM > 0.1
  );
}

function correrHorneador() {
  const t0 = Date.now();
  const salida = execFileSync(process.execPath, [HORNEADOR], {
    cwd: RAIZ, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024,
  });
  return { ms: Date.now() - t0, salida };
}

function hallarManifiesto() {
  if (!fs.existsSync(TEX)) return null;
  const cands = listarArchivos(TEX).filter(f => f.endsWith('.json'));
  if (cands.length === 0) return null;
  // el que tenga más pinta de manifiesto: el que nombre especies conocidas
  const rep = new Set(especiesRepresentables().map(e => e.id));
  let mejor = null, mejorPuntos = -1;
  for (const c of cands) {
    const txt = fs.readFileSync(path.join(TEX, c), 'utf8');
    let puntos = 0;
    for (const id of rep) if (txt.includes('"' + id + '"')) puntos++;
    if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = c; }
  }
  return { rel: mejor, ruta: path.join(TEX, mejor), datos: JSON.parse(fs.readFileSync(path.join(TEX, mejor), 'utf8')) };
}

/**
 * Encuentra el mapa id-de-especie -> rectángulo, sin asumir la forma exacta del
 * manifiesto. Si no reconoce el formato lo dice a los gritos en vez de devolver
 * vacío: un mapa vacío es exactamente cómo se da verde sin medir nada.
 */
function extraerEntradas(manifiesto) {
  const rep = new Set(especiesRepresentables().map(e => e.id));
  const encontrados = new Map();   // id -> objeto crudo
  const rutas = new Map();         // id -> ruta dentro del manifiesto

  (function rec(nodo, ruta, prof) {
    if (!nodo || typeof nodo !== 'object' || prof > 8) return;
    if (Array.isArray(nodo)) {
      for (let i = 0; i < nodo.length; i++) {
        const el = nodo[i];
        if (el && typeof el === 'object') {
          const id = el.id || el.especie || el.nombre;
          if (typeof id === 'string' && rep.has(id) && !encontrados.has(id)) {
            encontrados.set(id, el); rutas.set(id, ruta + '[' + i + ']');
          }
          rec(el, ruta + '[' + i + ']', prof + 1);
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(nodo)) {
      if (rep.has(k) && v && typeof v === 'object' && !encontrados.has(k)) {
        encontrados.set(k, v); rutas.set(k, ruta + '.' + k);
      }
      if (v && typeof v === 'object') rec(v, ruta + '.' + k, prof + 1);
    }
  })(manifiesto, '', 0);

  return { encontrados, rutas };
}

/**
 * Normaliza una entrada a un rectángulo en píxeles del atlas. Devuelve null y
 * el motivo si no reconoce el formato — nunca un rectángulo inventado.
 */
function rectDe(entrada, anchoAtlas, altoAtlas) {
  const n = (...ks) => { for (const k of ks) if (typeof entrada[k] === 'number') return entrada[k]; return undefined; };

  // píxeles directos
  const x = n('x', 'px', 'left', 'col0');
  const y = n('y', 'py', 'top', 'fila0');
  const w = n('w', 'ancho', 'width', 'tam', 'tamano');
  const h = n('h', 'alto', 'height', 'tam', 'tamano');
  if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
    const enUV = x <= 1 && y <= 1 && w <= 1 && h <= 1 && (w < 1 || h < 1);
    if (enUV) return { x: x * anchoAtlas, y: y * altoAtlas, w: w * anchoAtlas, h: h * altoAtlas, forma: 'xywh-uv' };
    return { x, y, w, h, forma: 'xywh-px' };
  }

  // u0,v0,u1,v1
  const u0 = n('u0', 'uMin'), v0 = n('v0', 'vMin'), u1 = n('u1', 'uMax'), v1 = n('v1', 'vMax');
  if ([u0, v0, u1, v1].every(v => v !== undefined)) {
    return { x: u0 * anchoAtlas, y: v0 * altoAtlas, w: (u1 - u0) * anchoAtlas, h: (v1 - v0) * altoAtlas, forma: 'uv4' };
  }

  // arreglo uv / rect
  for (const k of ['uv', 'rect', 'caja', 'coords']) {
    const a = entrada[k];
    if (Array.isArray(a) && a.length === 4 && a.every(v => typeof v === 'number')) {
      const todoUV = a.every(v => v >= 0 && v <= 1);
      const esc = todoUV ? [anchoAtlas, altoAtlas, anchoAtlas, altoAtlas] : [1, 1, 1, 1];
      return { x: a[0] * esc[0], y: a[1] * esc[1], w: a[2] * esc[2], h: a[3] * esc[3], forma: k + (todoUV ? '-uv' : '-px') };
    }
  }

  // col/fila + celda
  const col = n('col', 'columna', 'cx'), fila = n('fila', 'row', 'cy'), celda = n('celda', 'cell', 'tamCelda');
  if (col !== undefined && fila !== undefined && celda !== undefined) {
    return { x: col * celda, y: fila * celda, w: celda, h: celda, forma: 'col/fila' };
  }

  return null;
}

// ── Banco 1 · Determinismo ──────────────────────────────────────────────────

function bancoDeterminismo() {
  if (!fs.existsSync(HORNEADOR)) {
    return { ok: false, ejercitado: 0, motivo: 'no existe ' + HORNEADOR };
  }

  const a = path.join(TMP, 'corrida-a');
  const b = path.join(TMP, 'corrida-b');

  console.log('  corrida 1…');
  const r1 = correrHorneador();
  const arch1 = listarArchivos(TEX);
  console.log('    ' + r1.ms + ' ms, ' + arch1.length + ' archivos en public/tex/');
  if (arch1.length === 0) return { ok: false, ejercitado: 0, motivo: 'la corrida 1 no dejó ningún archivo' };
  copiarDir(TEX, a);

  // Borrar de verdad, para que la corrida 2 no pueda saltear trabajo por caché.
  fs.rmSync(TEX, { recursive: true, force: true });
  if (fs.existsSync(TEX) && listarArchivos(TEX).length > 0) {
    return { ok: false, ejercitado: 0, motivo: 'no se pudo vaciar public/tex/ entre corridas' };
  }
  console.log('  public/tex/ borrado — la corrida 2 rehornea desde cero');

  console.log('  corrida 2…');
  const r2 = correrHorneador();
  const arch2 = listarArchivos(TEX);
  console.log('    ' + r2.ms + ' ms, ' + arch2.length + ' archivos');
  copiarDir(TEX, b);

  let ok = true;
  const faltan = arch1.filter(f => !arch2.includes(f));
  const sobran = arch2.filter(f => !arch1.includes(f));
  if (faltan.length || sobran.length) {
    ok = false;
    console.log('  el juego de archivos cambió entre corridas: faltan=' + JSON.stringify(faltan) + ' sobran=' + JSON.stringify(sobran));
  }

  let png = 0, json = 0, otros = 0, distintos = [];
  console.log('');
  for (const rel of arch1) {
    if (!arch2.includes(rel)) continue;
    const ba = fs.readFileSync(path.join(a, rel));
    const bb = fs.readFileSync(path.join(b, rel));
    const igual = ba.equals(bb);
    const esPng = rel.toLowerCase().endsWith('.png');
    const esJson = rel.toLowerCase().endsWith('.json');
    if (esPng) png++; else if (esJson) json++; else otros++;
    if (esPng && leerIHDR(ba) === null) {
      ok = false;
      console.log('    ' + rel + ' — NO es un PNG válido (firma/IHDR)');
    }
    console.log('    ' + (igual ? 'igual  ' : 'DISTINTO') + '  ' + rel.padEnd(28) +
      ' ' + String(ba.length).padStart(9) + ' B  ' + sha(ba).slice(0, 16));
    if (!igual) { ok = false; distintos.push(rel); }
  }

  console.log('');
  console.log('  PNG comparados: ' + png + ' · JSON comparados: ' + json + ' · otros: ' + otros);
  if (png === 0) {
    return { ok: false, ejercitado: 0, unidad: 'archivos', motivo: 'no se comparó ni un PNG: el banco no midió determinismo de imagen' };
  }
  if (distintos.length) {
    return { ok: false, ejercitado: png + json + otros, unidad: 'archivos', motivo: 'no determinista: ' + distintos.join(', ') };
  }
  return { ok, ejercitado: png + json + otros, unidad: 'archivos' };
}

// ── Banco 2 · Presupuesto de VRAM ───────────────────────────────────────────

function bancoPresupuesto() {
  const pngs = listarArchivos(TEX).filter(f => f.toLowerCase().endsWith('.png'));
  if (pngs.length === 0) return { ok: false, ejercitado: 0, motivo: 'no hay PNG en public/tex/' };

  let total = 0, totalSinMip = 0, ok = true;
  console.log('  costo real en VRAM, recalculado desde el IHDR de cada archivo');
  console.log('  (NO desde el número que declara el manifiesto — eso sería creerle al medido)');
  console.log('');
  console.log('  ' + 'archivo'.padEnd(26) + 'dim'.padEnd(12) + 'canales'.padEnd(9) + 'base MiB'.padEnd(10) + 'con mip MiB');

  const detalle = [];
  for (const rel of pngs) {
    const buf = fs.readFileSync(path.join(TEX, rel));
    const ih = leerIHDR(buf);
    if (!ih) { ok = false; console.log('  ' + rel + ' — IHDR ilegible'); continue; }
    // En GPU se sube como RGBA8 salvo que el cargador diga otra cosa: 4 B/texel
    // es el supuesto conservador y es el que corresponde auditar.
    const bytesTexel = 4;
    const base = ih.ancho * ih.alto * bytesTexel;
    const conMip = base * 4 / 3;
    total += conMip;
    totalSinMip += base;
    if (!esPotenciaDeDos(ih.ancho) || !esPotenciaDeDos(ih.alto)) {
      ok = false;
      console.log('  ' + rel + ' — ' + ih.ancho + '×' + ih.alto + ' NO es potencia de dos (RONDA3 lo exige para mipmaps)');
    }
    detalle.push({ rel, ih, base, conMip });
    console.log('  ' + rel.padEnd(26) + (ih.ancho + '×' + ih.alto).padEnd(12) +
      String(CANALES_PNG[ih.tipoColor] ?? '?').padEnd(9) +
      (base / 1048576).toFixed(2).padEnd(10) + (conMip / 1048576).toFixed(2));
  }

  const mib = total / 1048576;
  const mb = total / 1e6;
  console.log('');
  console.log('  TOTAL sin mipmaps : ' + (totalSinMip / 1048576).toFixed(2) + ' MiB');
  console.log('  TOTAL con mipmaps : ' + mib.toFixed(2) + ' MiB  (' + mb.toFixed(2) + ' MB decimales)');
  console.log('  techo             : ' + TECHO_VRAM_MB + ' MB');
  console.log('  margen            : ' + (TECHO_VRAM_MB - mib).toFixed(2) + ' MiB');

  if (mib > TECHO_VRAM_MB) {
    ok = false;
    console.log('  >>> SE PASA DEL PRESUPUESTO');
  }

  // Contrastar contra lo que declara el manifiesto: si declara un número y el
  // real es otro, la auditoría sin navegador que pide RONDA3 no sirve.
  const man = hallarManifiesto();
  if (man) {
    const txt = JSON.stringify(man.datos);
    const decl = [];
    (function rec(n) {
      if (!n || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n)) {
        if (typeof v === 'number' && /vram|bytes|costo|memoria|mib|mb/i.test(k)) decl.push([k, v]);
        else if (v && typeof v === 'object') rec(v);
      }
    })(man.datos);
    if (decl.length === 0) {
      ok = false;
      console.log('');
      console.log('  >>> el manifiesto NO declara el costo en VRAM. RONDA3 lo pide explícitamente');
      console.log('      («el manifiesto declara el costo calculado para que se pueda auditar');
      console.log('      sin abrir el navegador»).');
    } else {
      console.log('');
      console.log('  declarado en el manifiesto:');
      for (const [k, v] of decl) {
        const comoMib = v > 1e5 ? v / 1048576 : v;
        const cerca = Math.abs(comoMib - mib) / Math.max(mib, 0.0001) < 0.05;
        console.log('    ' + k + ' = ' + v + (v > 1e5 ? '  (' + comoMib.toFixed(2) + ' MiB)' : '') +
          (cerca ? '   coincide con el real' : ''));
      }
      const algunoCoincide = decl.some(([, v]) => {
        const comoMib = v > 1e5 ? v / 1048576 : v;
        return Math.abs(comoMib - mib) / Math.max(mib, 0.0001) < 0.05;
      });
      if (!algunoCoincide) {
        ok = false;
        console.log('    >>> ninguno coincide con el costo real de ' + mib.toFixed(2) + ' MiB');
      }
    }
  }

  return { ok, ejercitado: detalle.length, unidad: 'PNG auditados' };
}

// ── Banco 3 · Cobertura de especies ─────────────────────────────────────────

function bancoEspecies() {
  const rep = especiesRepresentables();
  console.log('  especies representables derivadas de fauna.json con el predicado');
  console.log('  de Fauna.js:45 — NO contadas contra el propio manifiesto: ' + rep.length);

  // Guarda: si el predicado o los datos cambiaron, el banco está midiendo otra
  // cosa y hay que enterarse, no seguir de largo.
  if (rep.length !== 44) {
    return { ok: false, ejercitado: 0, motivo: 'se esperaban 44 especies representables y salieron ' + rep.length + '. Cambió fauna.json o el predicado: revisar el banco antes de creerle.' };
  }

  const man = hallarManifiesto();
  if (!man) return { ok: false, ejercitado: 0, motivo: 'no se encontró manifiesto JSON en public/tex/' };
  console.log('  manifiesto: ' + man.rel);

  // Dimensiones reales de los atlas, del IHDR, no de lo que diga el manifiesto.
  const pngs = listarArchivos(TEX).filter(f => f.toLowerCase().endsWith('.png'));
  const dims = pngs.map(rel => ({ rel, ...leerIHDR(fs.readFileSync(path.join(TEX, rel))) }));
  if (dims.length === 0) return { ok: false, ejercitado: 0, motivo: 'no hay PNG contra los que validar coordenadas' };
  const anchoAtlas = Math.min(...dims.map(d => d.ancho));
  const altoAtlas = Math.min(...dims.map(d => d.alto));
  console.log('  atlas más chico: ' + anchoAtlas + '×' + altoAtlas + ' (las coordenadas se validan contra éste)');

  const { encontrados, rutas } = extraerEntradas(man.datos);
  console.log('  entradas del manifiesto que corresponden a una especie representable: ' + encontrados.size);

  let ok = true;
  const faltantes = rep.filter(e => !encontrados.has(e.id));
  if (faltantes.length) {
    ok = false;
    console.log('');
    console.log('  >>> FALTAN ' + faltantes.length + ' especies en el manifiesto:');
    console.log('      ' + faltantes.map(e => e.id).join(' '));
  }

  // Entradas del manifiesto que no son especies representables: sobran o el
  // horneador está horneando peces.
  const idsRep = new Set(rep.map(e => e.id));
  const todosIds = new Set();
  (function rec(n, prof) {
    if (!n || typeof n !== 'object' || prof > 8) return;
    if (Array.isArray(n)) { for (const e of n) { if (e && typeof e === 'object' && typeof e.id === 'string') todosIds.add(e.id); rec(e, prof + 1); } return; }
    for (const [k, v] of Object.entries(n)) { if (v && typeof v === 'object') { rec(v, prof + 1); } }
  })(man.datos, 0);

  // Validación geométrica: dentro del atlas y sin solaparse.
  let validadas = 0, sinFormato = [];
  const rects = [];
  console.log('');
  for (const e of rep) {
    const entrada = encontrados.get(e.id);
    if (!entrada) continue;
    const r = rectDe(entrada, anchoAtlas, altoAtlas);
    if (!r) {
      sinFormato.push(e.id);
      if (sinFormato.length <= 3) {
        console.log('  formato de coordenadas no reconocido para ' + e.id + ' en ' + rutas.get(e.id) + ':');
        console.log('    ' + JSON.stringify(entrada).slice(0, 240));
      }
      continue;
    }
    validadas++;
    rects.push({ id: e.id, ...r });
    const fuera =
      r.x < -0.001 || r.y < -0.001 ||
      r.x + r.w > anchoAtlas + 0.001 || r.y + r.h > altoAtlas + 0.001 ||
      r.w <= 0 || r.h <= 0;
    if (fuera) {
      ok = false;
      console.log('  >>> FUERA DEL ATLAS: ' + e.id + ' → x=' + r.x.toFixed(1) + ' y=' + r.y.toFixed(1) +
        ' w=' + r.w.toFixed(1) + ' h=' + r.h.toFixed(1) + ' (' + r.forma + ') contra ' + anchoAtlas + '×' + altoAtlas);
    }
  }

  if (sinFormato.length) {
    ok = false;
    console.log('  >>> ' + sinFormato.length + ' entradas con formato de coordenadas no reconocido. El banco NO pudo validarlas.');
  }

  // Solapamientos: dos especies en el mismo rectángulo es una pisando a la otra.
  let solapes = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const sx = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const sy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (sx > 0.5 && sy > 0.5) {
        solapes++;
        if (solapes <= 5) console.log('  >>> SOLAPE: ' + a.id + ' y ' + b.id + ' comparten ' + (sx * sy).toFixed(0) + ' px²');
      }
    }
  }
  if (solapes) { ok = false; console.log('  >>> ' + solapes + ' pares de especies solapados en el atlas'); }

  console.log('');
  console.log('  especies exigidas (de fauna.json) : ' + rep.length);
  console.log('  especies halladas en el manifiesto: ' + encontrados.size);
  console.log('  coordenadas validadas geométricamente: ' + validadas);
  console.log('  fuera del atlas: ' + (validadas - rects.filter(r =>
    !(r.x < -0.001 || r.y < -0.001 || r.x + r.w > anchoAtlas + 0.001 || r.y + r.h > altoAtlas + 0.001 || r.w <= 0 || r.h <= 0)).length) +
    ' · solapadas: ' + solapes);

  // La guarda de este banco: si no se validó ni una coordenada, no midió nada.
  return { ok, ejercitado: validadas, unidad: 'coordenadas validadas' };
}

// ── Banco 4 · Degradación ───────────────────────────────────────────────────

/**
 * Ejercita el cargador de verdad: levanta un servidor estático sobre public/,
 * enchufa un fetch que apunta ahí, y corre tres escenarios moviendo archivos
 * reales. Nada de mocks que siempre dicen que sí.
 */
async function bancoDegradacion() {
  if (!fs.existsSync(CARGADOR)) return { ok: false, ejercitado: 0, motivo: 'no existe ' + CARGADOR };

  const fuente = fs.readFileSync(CARGADOR, 'utf8');
  let ok = true;
  let escenarios = 0;

  // 4a — estático: un import estático del manifiesto rompe el build de Vite si
  // el archivo no está, y eso rompe el arranque del juego.
  const importEstatico = /^\s*import\s+[^;]*from\s+['"][^'"]*(?:tex\/|manifiesto|atlas)[^'"]*\.json['"]/m.test(fuente);
  console.log('  4a · import estático de un JSON de public/tex/ en el cargador: ' + (importEstatico ? 'SÍ — rompería el build' : 'no'));
  if (importEstatico) ok = false;

  const servidor = http.createServer((req, res) => {
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
  let pedidos = [];      // guarda de cobertura: si esto queda vacío, no se ejercitó nada
  globalThis.fetch = async (u, opts) => {
    const s = String(u && u.url ? u.url : u);
    const abs = /^https?:/.test(s) ? s : 'http://127.0.0.1:' + puerto + (s.startsWith('/') ? s : '/' + s);
    let r;
    try { r = await fetchReal(abs, opts); }
    catch (e) { pedidos.push({ url: s, estado: 'error:' + e.message }); throw e; }
    pedidos.push({ url: s, estado: r.status });
    return r;
  };

  // Stub de DOM para que THREE.TextureLoader pueda correr en Node.
  //
  // OJO, y es la razón de que este bloque sea largo: three.js NO usa
  // `new Image()`, usa `document.createElementNS('…xhtml','img')`. Un stub que
  // sólo define `Image` deja a TextureLoader tirando «image.addEventListener is
  // not a function», el cargador se va por su rama de error, y los TRES
  // escenarios terminan midiendo el mismo fallo. Pasó en la primera corrida de
  // este banco: daba verde con el camino feliz roto. La guarda de cobertura de
  // abajo ahora exige que el control cargue de verdad.
  //
  // El `img` resuelve contra el disco real: si el archivo está, dispara 'load'
  // con las dimensiones de su IHDR; si no está, dispara 'error'. Así los tres
  // escenarios se distinguen de verdad en vez de compartir un mock complaciente.
  let imagenesOk = 0, imagenesError = 0;
  const rutaDeUrl = (s) => {
    let u = String(s);
    u = u.replace(/^https?:\/\/[^/]+/, '');
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

  // El cargador memoiza su promesa en una variable de módulo. Para que cada
  // escenario sea un escenario y no la respuesta guardada del anterior, se
  // reimporta el módulo con la caché de ESM salteada. Sin esto los escenarios
  // 2 y 3 hacen cero pedidos de red y "degrada bien" no significa nada.
  let contadorImport = 0;
  async function importarFresco() {
    return import(pathToFileURL(CARGADOR).href + '?banco=' + (++contadorImport) + '-' + Date.now());
  }

  let mod;
  try {
    mod = await importarFresco();
  } catch (e) {
    globalThis.fetch = fetchReal;
    servidor.close();
    return { ok: false, ejercitado: 0, motivo: 'el cargador no se pudo importar: ' + e.message };
  }

  const exportados = Object.keys(mod);
  console.log('  4b · exporta: ' + exportados.join(', '));

  // Buscar la función de carga: la que devuelve una promesa y suena a cargar.
  const candidatas = exportados.filter(k => typeof mod[k] === 'function' &&
    /carg|load|obten|init|atlas|prepar/i.test(k));
  if (candidatas.length === 0) {
    globalThis.fetch = fetchReal; servidor.close();
    return { ok: false, ejercitado: 0, motivo: 'el cargador no exporta ninguna función que parezca de carga. Exporta: ' + exportados.join(', ') };
  }
  const nombreFn = candidatas[0];
  console.log('       función ejercitada: ' + nombreFn + '()  (reimportado en cada escenario para saltar la memoización)');

  async function escenario(titulo, preparar, restaurar) {
    console.log('');
    console.log('  · ' + titulo);
    preparar();
    pedidos = [];
    const okAntes = imagenesOk, errAntes = imagenesError;
    let r, err = null;
    const t0 = Date.now();
    try {
      const fresco = await importarFresco();
      r = await Promise.race([
        fresco[nombreFn](),
        new Promise((_, rj) => setTimeout(() => rj(new Error('tardó más de 15 s')), 15000)),
      ]);
    } catch (e) { err = e; }
    restaurar();
    escenarios++;
    const codigos = pedidos.map(p => p.estado);
    console.log('    pedidos de red: ' + pedidos.length + (pedidos.length ? ' → ' + codigos.join(', ') : '') +
      ' · imágenes cargadas: ' + (imagenesOk - okAntes) + ' · imágenes fallidas: ' + (imagenesError - errAntes));
    console.log('    ' + (err ? 'LANZÓ: ' + err.message : 'devolvió: ' + describir(r)) + '  (' + (Date.now() - t0) + ' ms)');
    if (r && typeof r === 'object' && 'disponible' in r) console.log('    disponible = ' + r.disponible);
    return { r, err, pedidos: pedidos.slice(), imgOk: imagenesOk - okAntes, imgErr: imagenesError - errAntes };
  }

  function describir(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v !== 'object') return typeof v + ' ' + String(v).slice(0, 60);
    const ks = Object.keys(v);
    return '{ ' + ks.slice(0, 10).join(', ') + (ks.length > 10 ? ', …' : '') + ' }';
  }

  const oculto = TEX + '.oculto-banco';

  // Escenario 1 — todo presente. Es el CONTROL, y la guarda de este banco
  // entero: si acá el cargador no llega a `disponible: true` con sus tres
  // texturas, entonces los escenarios 2 y 3 no están midiendo degradación,
  // están midiendo el mismo fallo tres veces. Que es exactamente lo que hacía
  // este banco en su primera corrida.
  const e1 = await escenario('todo presente (CONTROL — si esto no carga, el banco no vale)', () => {}, () => {});
  const pidioAlgo = e1.pedidos.length > 0;
  if (!pidioAlgo) {
    ok = false;
    console.log('    >>> con los archivos presentes el cargador no pidió NADA por red.');
  }
  if (e1.err) { ok = false; console.log('    >>> con todo presente el cargador LANZA. Eso rompe el arranque.'); }

  const controlCargo = !e1.err && !!e1.r && e1.r.disponible === true && e1.imgOk >= 3;
  if (!controlCargo) {
    ok = false;
    console.log('    >>> EL CONTROL NO CARGÓ. disponible=' + (e1.r && e1.r.disponible) +
      ', imágenes cargadas=' + e1.imgOk + ' (se esperaban 3).');
    console.log('        Sin un camino feliz que funcione, «degrada sin lanzar» no distingue');
    console.log('        degradar bien de estar siempre roto.');
  } else {
    console.log('    control OK: disponible=true con sus 3 texturas');
  }

  // Escenario 2 — sin nada: el directorio entero renombrado.
  const e2 = await escenario('sin manifiesto y sin PNG (public/tex/ renombrado)',
    () => { if (fs.existsSync(TEX)) fs.renameSync(TEX, oculto); },
    () => { if (fs.existsSync(oculto)) fs.renameSync(oculto, TEX); });
  if (e2.err) {
    ok = false;
    console.log('    >>> LANZA sin atlas. RONDA3: «si el atlas no está, el juego arranca igual».');
  } else if (e2.r === undefined) {
    ok = false;
    console.log('    >>> devuelve undefined: el consumidor de la fase 2 no tiene con qué preguntar si hay atlas.');
  } else {
    console.log('    degrada sin lanzar');
  }
  const hubo404 = e2.pedidos.some(p => p.estado === 404 || String(p.estado).startsWith('error'));
  if (!hubo404 && e2.pedidos.length > 0) {
    console.log('    (aviso: no se vio un 404; puede haber caché interna del módulo)');
  }

  // Escenario 3 — manifiesto presente, un PNG faltando. El caso a medias, que
  // es el que en la práctica se olvida.
  let pngVictima = null;
  const e3 = await escenario('manifiesto presente, un PNG borrado',
    () => {
      const pngs = listarArchivos(TEX).filter(f => f.toLowerCase().endsWith('.png'));
      if (pngs[0]) { pngVictima = path.join(TEX, pngs[0]); fs.renameSync(pngVictima, pngVictima + '.oculto'); }
    },
    () => { if (pngVictima && fs.existsSync(pngVictima + '.oculto')) fs.renameSync(pngVictima + '.oculto', pngVictima); });
  if (e3.err) {
    ok = false;
    console.log('    >>> LANZA con un PNG faltante. Un atlas incompleto rompe el arranque.');
  }

  // 4d — espacio de color por tipo de mapa. El render corre con
  // outputColorSpace = SRGBColorSpace (main.js:117): el albedo tiene que ir en
  // sRGB y el normal y el rugosidad/oclusión en NoColorSpace. Al revés, el
  // normal se "descorrige" en el shader y el relieve sale torcido, sin que nada
  // falle ni avise. Escrito antes de leer la implementación del cargador.
  console.log('');
  console.log('  4d · espacio de color por tipo de mapa');
  const texturas = [];
  (function buscarTex(n, ruta, prof) {
    if (!n || typeof n !== 'object' || prof > 5) return;
    if (n.isTexture) { texturas.push({ ruta, tex: n }); return; }
    for (const [k, v] of Object.entries(n)) {
      if (v && typeof v === 'object') buscarTex(v, ruta ? ruta + '.' + k : k, prof + 1);
    }
  })(e1.r, '', 0);

  if (texturas.length === 0) {
    console.log('    no se hallaron THREE.Texture en lo que devolvió el camino feliz.');
    console.log('    (esperable si en Node la decodificación de imagen no se completa; no se');
    console.log('     marca rojo por eso, pero tampoco cuenta como verificado)');
  } else {
    for (const { ruta, tex } of texturas) {
      const esAlbedo = /albedo|color|base|diffuse|map$/i.test(ruta) && !/normal|rug|ao|orm|oclu/i.test(ruta);
      const esDato = /normal|rug|rough|ao|orm|oclu|combinad/i.test(ruta);
      const cs = tex.colorSpace;
      let veredicto = '';
      if (esAlbedo && cs !== 'srgb') { ok = false; veredicto = '  >>> el albedo debería ir en sRGB'; }
      if (esDato && cs === 'srgb') { ok = false; veredicto = '  >>> un mapa de datos NO va en sRGB: el relieve sale torcido'; }
      console.log('    ' + ruta.padEnd(24) + ' colorSpace=' + String(cs).padEnd(10) +
        ' flipY=' + tex.flipY + ' mipmaps=' + tex.generateMipmaps + veredicto);
    }
  }

  globalThis.fetch = fetchReal;
  servidor.close();

  console.log('');
  console.log('  escenarios ejercitados: ' + escenarios + ' · el camino feliz pidió red: ' + pidioAlgo +
    ' · imágenes cargadas: ' + imagenesOk + ' · imágenes fallidas a propósito: ' + imagenesError +
    ' · texturas inspeccionadas: ' + texturas.length);

  // GUARDA DE COBERTURA DURA. No alcanza con «los tres escenarios corrieron y
  // ninguno lanzó»: hace falta que el CONTROL haya cargado de verdad
  // (disponible=true con sus tres texturas) y que los dos escenarios de fallo
  // hayan fallado por el motivo que se les plantó — un 404 uno, una imagen
  // rota el otro. Sin eso los tres pueden estar midiendo el mismo fallo, que
  // es lo que este banco hacía en su primera corrida y por lo que daba verde.
  const degradoBien =
    e2.r && e2.r.disponible === false &&
    e3.r && e3.r.disponible === false;
  const fallaronPorLoQueDebían =
    e2.pedidos.some(p => p.estado === 404) &&   // sin manifiesto: 404
    e3.imgErr >= 1;                              // PNG faltante: la imagen falla
  if (!degradoBien) {
    ok = false;
    console.log('  >>> los escenarios de fallo no reportaron disponible=false.');
  }
  if (!fallaronPorLoQueDebían) {
    ok = false;
    console.log('  >>> los escenarios de fallo no fallaron por el motivo plantado:');
    console.log('      404 en el manifiesto=' + e2.pedidos.some(p => p.estado === 404) +
      ', imagen rota=' + e3.imgErr);
  }

  const ejercitado = (escenarios === 3 && pidioAlgo && controlCargo && fallaronPorLoQueDebían)
    ? escenarios : 0;
  if (ejercitado === 0) {
    console.log('  >>> la guarda de cobertura anula este banco: no se demostró que el cargador');
    console.log('      se haya ejercitado de verdad en el camino feliz Y en los dos de fallo.');
  }
  return { ok, ejercitado, unidad: 'escenarios' };
}

// ── Corrida ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('BANCO DE LA FASE 1 · ronda 3 · SurviBar');
  console.log('escrito por el jefe, en paralelo al agente. ' + new Date().toISOString());
  fs.mkdirSync(TMP, { recursive: true });

  banco('1 · DETERMINISMO — hornear dos veces da bytes idénticos', bancoDeterminismo);
  banco('2 · PRESUPUESTO — costo real en VRAM con mipmaps contra el techo de 24 MB', bancoPresupuesto);
  banco('3 · COBERTURA DE ESPECIES — una entrada por especie representable de fauna.json', bancoEspecies);

  console.log('\n' + '─'.repeat(72));
  console.log('BANCO 4 · DEGRADACIÓN — el cargador sin manifiesto y sin PNG');
  console.log('─'.repeat(72));
  let r4;
  try { r4 = await bancoDegradacion(); }
  catch (e) { r4 = { ok: false, ejercitado: 0, motivo: 'excepción: ' + e.stack.split('\n').slice(0, 4).join('\n') }; }
  const v4 = r4.ok && r4.ejercitado > 0;
  if (!v4) hayRojo = true;
  console.log('');
  console.log('  cobertura ejercitada: ' + r4.ejercitado + (r4.unidad ? ' ' + r4.unidad : ''));
  if (r4.ejercitado === 0) console.log('  >>> GUARDA DE COBERTURA: cero. ROJO.');
  if (r4.motivo) console.log('  motivo: ' + r4.motivo);
  console.log('  ' + (v4 ? 'VERDE' : 'ROJO'));
  resultados.push({ nombre: '4 · DEGRADACIÓN', verde: v4, ejercitado: r4.ejercitado, motivo: r4.motivo || '' });

  fs.rmSync(TMP, { recursive: true, force: true });

  console.log('\n' + '═'.repeat(72));
  console.log('RESUMEN');
  console.log('═'.repeat(72));
  for (const r of resultados) {
    console.log('  ' + (r.verde ? 'VERDE' : 'ROJO ') + '  ejercitó ' + String(r.ejercitado).padStart(4) + '  ' + r.nombre +
      (r.motivo ? '\n           ' + r.motivo.split('\n')[0] : ''));
  }
  console.log('');
  console.log(hayRojo ? 'LA FASE 1 NO CIERRA.' : 'LOS CUATRO BANCOS EN VERDE, CON COBERTURA DEMOSTRADA.');
  process.exit(hayRojo ? 1 : 0);
}

// Exportado para el falsador: `.claude/flota/banco-r3-fase1.falsar.mjs` planta
// defectos conocidos y comprueba que el banco los ve. Un banco que no se falsó a
// sí mismo no vale más que el informe del autor.
export { especiesRepresentables, leerIHDR, rectDe, extraerEntradas, esPotenciaDeDos };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
