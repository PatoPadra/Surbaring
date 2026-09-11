/**
 * BANCO DE LA FASE 2 (suelo) — ronda 5.
 *
 * Lo escribe el JEFE contra el contrato de RONDA5.md, en paralelo al agente y sin
 * leer su código. Del lado del código sólo se leyó la base (`git show b07f5a5`).
 *
 * ── La regla que ordena este banco ───────────────────────────────────────────
 * El README decía que la espuma de la orilla «estaba medida», y lo estaba: con la
 * profundidad como variable libre. Contra el lecho real no existía en ninguna
 * orilla. Por eso acá **nada se mide contra una rampa sintética ni contra la
 * propia consulta del agente**: se carga el `Mundo` de verdad, con el DEM de
 * `public/data/dem/`, y se muestrean los MISMOS arreglos que muestrea la GPU
 * —`texAltura`, `texCobertura`, `texNormal`— con la misma convención de texel y
 * la misma interpolación bilineal.
 *
 * ── Qué mide ─────────────────────────────────────────────────────────────────
 *   1. NOCHE — la traslucidez y el relleno del sotobosque se multiplican por
 *      `uLuzCielo`, que vale min(1, intensidadCielo / 0,85); y lo mismo en la
 *      traslucidez de los árboles.
 *   2. ORILLA — sobre ≥ 300 orillas del DEM real: profundidad en la orilla
 *      visible, ancho de la franja somera, la cubeta a 300 m contra la base, el
 *      tope de 120 m, que la GPU lea el mismo lecho que la CPU, y el tiempo de
 *      `_excavarLagos`.
 *   3. SUELO — `Mundo.sueloEn()` contra una lectura independiente del
 *      sombreador del terreno (`Terreno.js:613-640`, leído por el jefe), sobre
 *      ≥ 5000 puntos de tierra y dos cotas de nieve; y que los pasos suenen
 *      distinto para cada material.
 *   4. ARRANQUE — `vite build`.
 *
 * ── Guarda de cobertura ──────────────────────────────────────────────────────
 * Cada sección declara su camino feliz. Y la sección 2 comprueba además que el
 * instrumento ve el defecto: contra la base, la profundidad en la orilla visible
 * tiene que salir de varios metros. Si la base da orilla somera, el banco está
 * midiendo otra cosa y no se le cree nada.
 *
 * Uso:  node .claude/flota/banco-r5-fase2.mjs
 * Variables: BANCO_SRC (raíz alternativa de src/), BANCO_BASE (commit de base,
 * por defecto b07f5a5), BANCO_SIN_BUILD, BANCO_DETALLE.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const BASE = process.env.BANCO_BASE || 'b07f5a5';
const TMP_BASE = path.join(AQUI, `.tmp-banco-r5f2-base-${BASE}`);

const urlDe = (raiz, rel) => pathToFileURL(path.join(raiz, ...rel.split('/'))).href;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, desc, det) => { s.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const q = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((m, n) => m - n); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : v);

/** Generador reproducible: las mismas orillas y los mismos puntos en cada corrida. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ═══════════════════════════════════════════════════════════════════════════
// El Mundo de verdad, en Node
// ═══════════════════════════════════════════════════════════════════════════

async function instalarEntorno() {
  const pngjs = (await import('pngjs')).default;
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }), visibilityState: 'visible' };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async (url) => {
    const f = path.join(RAIZ, 'public', String(url).replace(/^\//, ''));
    const buf = fs.readFileSync(f);
    return {
      ok: true,
      json: async () => JSON.parse(buf.toString('utf8')),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      blob: async () => ({ __buf: buf }),
    };
  };
  globalThis.createImageBitmap = async (blob) => {
    const png = pngjs.PNG.sync.read(blob.__buf);
    return { width: png.width, height: png.height, data: png.data, close() {} };
  };
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      let img = null;
      return {
        drawImage(b) { img = b; },
        getImageData() { return { data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength) }; },
      };
    }
  };
}

async function cargarMundo(raiz, conReloj = false) {
  const { Mundo } = await import(urlDe(raiz, 'world/Mundo.js'));
  if (conReloj && typeof Mundo.prototype._excavarLagos === 'function') {
    const orig = Mundo.prototype._excavarLagos;
    Mundo.prototype._excavarLagos = function (...a) {
      const t = performance.now();
      const r = orig.apply(this, a);
      this.__msExcavar = performance.now() - t;
      return r;
    };
  }
  const m = new Mundo();
  await m.cargar('data/dem/');
  return m;
}

function srcDeBase() {
  const destino = path.join(TMP_BASE, 'src');
  if (fs.existsSync(path.join(destino, 'world', 'Mundo.js'))) return destino;
  fs.rmSync(TMP_BASE, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  fs.mkdirSync(TMP_BASE, { recursive: true });
  const tar = path.join(TMP_BASE, 'base.tar');
  execFileSync('git', ['archive', '-o', tar, BASE, 'src'], { cwd: RAIZ });
  execFileSync('tar', ['-xf', tar, '-C', TMP_BASE]);
  fs.rmSync(tar);
  return destino;
}

/** Coordenada continua de texel, con la convención de la GPU (Mundo._texelDe). */
const texel = (M, w) => Math.max(0, Math.min(M.N - 1, (w / M.tamano + 0.5) * M.N - 0.5));
const mundoDeTexel = (M, t) => ((t + 0.5) / M.N - 0.5) * M.tamano;

function bilineal(M, datos, canales, canal, x, z) {
  const N = M.N;
  const fx = texel(M, x), fz = texel(M, z);
  const i0 = Math.floor(fx), j0 = Math.floor(fz);
  const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
  const sx = fx - i0, sz = fz - j0;
  const v = (i, j) => datos[(j * N + i) * canales + canal];
  return (v(i0, j0) * (1 - sx) + v(i1, j0) * sx) * (1 - sz) + (v(i0, j1) * (1 - sx) + v(i1, j1) * sx) * sz;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · NOCHE
// ═══════════════════════════════════════════════════════════════════════════

async function s1() {
  const s = seccion(1, 'NOCHE');
  await instalarEntorno();
  const THREE = await import('three');
  const M = await cargarMundo(SRC);
  const { Sotobosque } = await import(urlDe(SRC, 'world/Sotobosque.js'));
  const soto = new Sotobosque(M);
  const mats = [...new Set((soto.lotes || []).map((l) => l.malla?.material).filter(Boolean))];
  s.ok(mats.length >= 2, 'premisa: el sotobosque armó sus materiales', mats.length);

  const lambert = THREE.ShaderLib.lambert;
  const inyectados = mats.map((mat) => {
    const sh = { uniforms: THREE.UniformsUtils.clone(lambert.uniforms), vertexShader: lambert.vertexShader, fragmentShader: lambert.fragmentShader };
    mat.onBeforeCompile(sh, {});
    return sh;
  });
  const solidos = inyectados.filter((sh) => /vArriba/.test(sh.fragmentShader));
  const laminas = inyectados.filter((sh) => !/vArriba/.test(sh.fragmentShader));
  s.ok(solidos.length > 0 && laminas.length > 0, 'premisa: se inyectaron las dos variantes, lámina y sólido', `${laminas.length} láminas · ${solidos.length} sólidos`);

  let sumasSinLuz = [], sumas = 0, caras = 0;
  for (const sh of inyectados) {
    const suma = sh.fragmentShader.match(/reflectedLight\s*\.\s*indirectDiffuse\s*\+=[^;]*;/g) || [];
    sumas += suma.length;
    sumasSinLuz.push(...suma.filter((x) => !/uLuzCielo/.test(x)));
    caras += suma.filter((x) => /\b(pow|exp|log|texture2D|texture|textureLod)\s*\(/.test(x)).length;
  }
  s.ok(sumas >= inyectados.length, 'premisa: cada material inyecta su término indirecto', `${sumas} términos`);
  s.ok(sumasSinLuz.length === 0, 'sotobosque: todo término que suma a indirectDiffuse lleva uLuzCielo', sumasSinLuz.map((x) => x.replace(/\s+/g, ' ').slice(0, 90)).join(' | ') || 'todos');
  s.ok(inyectados.every((sh) => /uniform\s+float\s+uLuzCielo\s*;/.test(sh.fragmentShader)), 'sotobosque: uLuzCielo declarado como float en el fragmento');
  s.ok(caras === 0, 'sin pow, exp ni lecturas de textura en los términos indirectos', caras);
  s.ok(inyectados.every((sh) => sh.uniforms.uLuzCielo && typeof sh.uniforms.uLuzCielo.value === 'number'), 'sotobosque: uLuzCielo llega a los uniformes del material');

  // Cómo llega la intensidad del cielo: el contrato deja el conducto al cableado,
  // así que se prueban las tres formas razonables y se anota cuál anduvo.
  const est = { vientoKmh: 20, direccionViento: 265, estacionContinua: 0.3, cotaNieve: 1750 };
  const pos = new THREE.Vector3(0, 800, 0);
  const valor = () => inyectados[0].uniforms.uLuzCielo?.value;
  const leer = (intensidad) => {
    const cielo = { intensidadCielo: intensidad };
    soto.cielo = cielo;
    try { soto.actualizar(pos, 1, { ...est }); } catch { /* sigue */ }
    if (Math.abs(valor() - Math.min(1, intensidad / 0.85)) < 0.005) return 'propiedad cielo';
    try { soto.actualizar(pos, 1, { ...est }, cielo); } catch { /* sigue */ }
    if (Math.abs(valor() - Math.min(1, intensidad / 0.85)) < 0.005) return 'cuarto argumento';
    try { soto.actualizar(pos, 1, { ...est, intensidadCielo: intensidad }); } catch { /* sigue */ }
    if (Math.abs(valor() - Math.min(1, intensidad / 0.85)) < 0.005) return 'estado.intensidadCielo';
    return null;
  };
  const via = leer(0.10);
  s.ok(!!via, 'medianoche (intensidad 0,10): uLuzCielo = 0,1176', `${valor()} · vía ${via}`);
  if (via) s.nota(`la intensidad del cielo llega al sotobosque por: ${via}`);
  const felizNoche = !!via;
  s.ok(!!leer(0.85) && Math.abs(valor() - 1) < 0.005, 'mediodía del 15/2 (0,85): uLuzCielo = 1, la imagen aprobada no cambia', valor());
  s.ok(!!leer(0.41) && Math.abs(valor() - 0.41 / 0.85) < 0.005, '8 y 20 h (0,41): uLuzCielo = 0,482', valor());
  leer(1.3);
  s.ok(Math.abs(valor() - 1) < 0.005, 'nunca pasa de 1', valor());
  const compartido = inyectados.every((sh) => Math.abs(sh.uniforms.uLuzCielo?.value - valor()) < 1e-9);
  s.ok(compartido, 'una sola escritura llega a todos los materiales del sotobosque');

  // Árboles: la función que inyecta el viento y la traslucidez
  const veg = fs.readFileSync(path.join(SRC, 'world', 'Vegetacion.js'), 'utf8');
  const i0 = veg.indexOf('function inyectarViento');
  const i1 = i0 >= 0 ? veg.indexOf('\nfunction ', i0 + 10) : -1;
  const cuerpo = i0 >= 0 ? veg.slice(i0, i1 > 0 ? i1 : undefined) : '';
  s.ok(cuerpo.length > 0, 'premisa: Vegetacion.js tiene inyectarViento');
  const sumasVeg = cuerpo.match(/reflectedLight\s*\.\s*indirectDiffuse\s*\+=[^;]*;/g) || [];
  s.ok(sumasVeg.length >= 1 && sumasVeg.every((x) => /uLuzCielo/.test(x)), 'árboles: la traslucidez de la hoja lleva uLuzCielo', `${sumasVeg.length} términos`);
  s.ok(/uniform\s+float\s+uLuzCielo\s*;/.test(cuerpo), 'árboles: uLuzCielo declarado en el fragmento');
  s.ok(/intensidadCielo/.test(veg) && /0\.85/.test(veg), 'árboles: el valor sale de intensidadCielo normalizada en 0,85');

  s.feliz = felizNoche && sumas > 0;
  s.felizQue = 'el uniforme del sotobosque se movió con la intensidad del cielo';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · ORILLA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Orillas del DEM: una celda de agua con una vecina de tierra en cruz, el
 * transecto va del centro de la tierra al centro del agua y sigue. Se mide lo que
 * mide la GPU: máscara bilineal de `texCobertura.r` y profundidad `uCota - R`
 * bilineal de `texAltura`, con `uCota` la superficie del lago de esa celda.
 */
function orillas(M, cuantas, semilla) {
  const N = M.N, a = M.agua, rnd = azar(semilla);
  const candidatas = [];
  const margen = 24;
  for (let intento = 0; intento < 400000 && candidatas.length < cuantas * 6; intento++) {
    const i = margen + Math.floor(rnd() * (N - 2 * margen)), j = margen + Math.floor(rnd() * (N - 2 * margen));
    const k = j * N + i;
    if (a[k] <= 127) continue;
    const vec = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => a[(j + dj) * N + (i + di)] <= 127);
    if (!vec.length) continue;
    const [di, dj] = vec[Math.floor(rnd() * vec.length)];
    candidatas.push({ i, j, k, dx: -di, dz: -dj });   // de la tierra hacia el agua
  }
  return candidatas;
}

function medirOrilla(M, o) {
  const cob = M.texCobertura?.image?.data, alt = M.texAltura?.image?.data;
  if (!cob || !alt) return null;
  const xa = mundoDeTexel(M, o.i), za = mundoDeTexel(M, o.j);
  const cota = M.superficieLago?.[o.k];
  if (!Number.isFinite(cota)) return null;
  const paso = 0.25, m = M.metrosPorTexel;
  let borde = -1;
  const muestras = [];
  for (let n = 0; n * paso <= m + 360; n++) {
    const d = -m + n * paso;
    const x = xa + o.dx * d, z = za + o.dz * d;
    const mascara = bilineal(M, cob, 4, 0, x, z) / 255;
    const prof = Math.max(0, cota - bilineal(M, alt, 2, 0, x, z));
    muestras.push([mascara, prof]);
    if (borde < 0 && mascara >= 0.5) borde = n;
  }
  if (borde < 0) return null;
  // Orilla de lago y no de charco: 20 m de agua seguida después del borde
  for (let n = borde; n < borde + 20 / paso; n++) if (!muestras[n] || muestras[n][0] < 0.5) return null;
  const profBorde = muestras[borde][1];
  let ancho = 0;
  for (let n = borde; n < muestras.length && muestras[n][0] >= 0.5 && muestras[n][1] < 0.5; n++) ancho += paso;
  const n300 = borde + Math.round(300 / paso);
  let prof300 = null;
  if (muestras[n300] && muestras.slice(borde, n300 + 1).every((mu) => mu[0] >= 0.5)) prof300 = muestras[n300][1];
  return { profBorde, ancho, prof300 };
}

async function s2() {
  const s = seccion(2, 'ORILLA');
  await instalarEntorno();
  const base = await cargarMundo(srcDeBase(), true);
  // Módulos de la base y de la copia actual son archivos distintos: cada import es su propia clase
  const M = await cargarMundo(SRC, true);
  s.ok(M.N === base.N && M.agua.length === base.agua.length && M.agua.every((v, k) => v === base.agua[k]),
    'premisa: la máscara de agua es la misma que en la base (lo que cambia es el lecho)');

  const lista = orillas(M, 400, 20260911);
  const medidas = [], medidasBase = [];
  for (const o of lista) {
    const a = medirOrilla(M, o), b = medirOrilla(base, o);
    if (!a || !b) continue;
    medidas.push(a); medidasBase.push(b);
    if (medidas.length >= 400) break;
  }
  s.ok(medidas.length >= 300, 'se midieron al menos 300 orillas de lago', medidas.length);

  const pb = medidasBase.map((x) => x.profBorde);
  s.ok(q(pb, 0.5) > 3, 'premisa: contra la base el instrumento ve el pozo (profundidad en la orilla de varios metros)', `mediana base ${r2(q(pb, 0.5))} m`);

  const p = medidas.map((x) => x.profBorde), an = medidas.map((x) => x.ancho);
  s.ok(q(p, 0.5) <= 0.3, 'orilla visible: mediana de profundidad ≤ 0,3 m', `${r2(q(p, 0.5))} m (base ${r2(q(pb, 0.5))})`);
  s.ok(q(p, 0.9) <= 1.0, 'orilla visible: percentil 90 ≤ 1,0 m', `${r2(q(p, 0.9))} m (base ${r2(q(pb, 0.9))})`);
  s.ok(q(an, 0.5) >= 1.5 && q(an, 0.5) <= 12, 'ancho con menos de 0,5 m: mediana entre 1,5 y 12 m', `${r2(q(an, 0.5))} m (base ${r2(q(medidasBase.map((x) => x.ancho), 0.5))})`);
  s.ok(q(an, 0.1) >= 0.5, 'ancho con menos de 0,5 m: percentil 10 ≥ 0,5 m', `${r2(q(an, 0.1))} m`);

  const razones = [];
  for (let n = 0; n < medidas.length; n++) {
    if (medidas[n].prof300 != null && medidasBase[n].prof300 > 1) razones.push(medidas[n].prof300 / medidasBase[n].prof300);
  }
  s.ok(razones.length >= 60, 'premisa: hay orillas con 300 m de agua para comparar la cubeta', razones.length);
  s.ok(razones.length > 0 && q(razones, 0.5) >= 0.85 && q(razones, 0.5) <= 1.15, 'la cubeta a 300 m queda dentro del ±15 % de la base (mediana de la razón)', r2(q(razones, 0.5)));

  let maxProf = 0;
  const pl = M.profundidadLago;
  if (pl) for (let k = 0; k < pl.length; k++) if (pl[k] > maxProf) maxProf = pl[k];
  let maxBase = 0;
  for (let k = 0; k < base.profundidadLago.length; k++) if (base.profundidadLago[k] > maxBase) maxBase = base.profundidadLago[k];
  s.ok(pl && maxProf <= 120.0001, 'PROF_MAX sigue en 120', `${r2(maxProf)} (base ${r2(maxBase)})`);

  // La GPU lee el mismo lecho que la CPU
  const alt = M.texAltura?.image?.data;
  let distintos = 0, revisados = 0;
  const rnd = azar(7);
  for (let n = 0; n < 4000; n++) {
    const k = Math.floor(rnd() * M.N * M.N);
    revisados++;
    if (!alt || Math.abs(alt[k * 2] - M.altura[k]) > 1e-3) distintos++;
    const sup = M.superficieLago && M.superficieLago[k] > 0 ? M.superficieLago[k] : M.altura[k];
    if (!alt || Math.abs(alt[k * 2 + 1] - sup) > 1e-3) distintos++;
  }
  s.ok(distintos === 0, 'texAltura (lo que lee el agua) es texel a texel el lecho y la superficie de la CPU', `${distintos} diferencias en ${revisados * 2}`);

  const t = M.__msExcavar, tb = base.__msExcavar;
  s.ok(Number.isFinite(t) && Number.isFinite(tb), 'premisa: se midió _excavarLagos en la base y en la actual', `${r2(tb)} → ${r2(t)} ms`);
  s.ok(Number.isFinite(t) && t - tb <= 200, '_excavarLagos cuesta a lo sumo +200 ms de carga', `${r2(tb)} → ${r2(t)} ms`);

  s.nota(`profundidad en la orilla visible: p10 ${r2(q(p, 0.1))} · mediana ${r2(q(p, 0.5))} · p90 ${r2(q(p, 0.9))} m`);
  s.nota(`ancho < 0,5 m: p10 ${r2(q(an, 0.1))} · mediana ${r2(q(an, 0.5))} · p90 ${r2(q(an, 0.9))} m`);
  s.feliz = medidas.length >= 300 && q(pb, 0.5) > 3;
  s.felizQue = '300 orillas medidas, y el instrumento vio el pozo en la base';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SUELO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La decisión del sombreador del terreno, leída por el jefe de `Terreno.js`
 * (base b07f5a5, :455 y :613-640), con `detalle = 0,5`. Entradas como las ve la
 * GPU: normal bilineal de `texNormal` renormalizada, humedad bilineal del canal
 * azul de `texCobertura`, y la altura.
 */
function sueloDelJefe(M, x, z, cota) {
  const nrm = M.texNormal.image.data, cob = M.texCobertura.image.data;
  const nx = bilineal(M, nrm, 4, 0, x, z) / 255 * 2 - 1;
  const ny = bilineal(M, nrm, 4, 1, x, z) / 255 * 2 - 1;
  const nz = bilineal(M, nrm, 4, 2, x, z) / 255 * 2 - 1;
  const pend = 1 - Math.min(1, Math.max(0, ny / Math.hypot(nx, ny, nz)));
  const hum = bilineal(M, cob, 4, 2, x, z) / 255;
  const alt = M.alturaEn(x, z);
  const nieveAlt = smooth(cota - 220, cota + 220, alt);
  const nievePend = smooth(0.62, 0.24, pend);
  const mascara = Math.min(1, Math.max(0, nieveAlt * nievePend + nieveAlt * 0.12)) * (1 - smooth(0, 0.35, 0.5 * 0.5 - 0.08));
  const roca = smooth(0.26, 0.58, pend);
  const sobre = smooth(1620 - 160, 1620 + 190, alt);
  const ambiguo = Math.abs(mascara - 0.5) < 0.04 || Math.abs(roca - 0.5) < 0.06 || Math.abs(sobre - 0.5) < 0.06 || Math.abs(hum - 0.45) < 0.015;
  let tipo;
  if (M.esAgua(x, z)) tipo = 'agua';
  else if (mascara >= 0.5) tipo = 'nieve';
  else if (roca >= 0.5 || sobre >= 0.5) tipo = 'roca';
  else if (hum < 0.45) tipo = 'pasto';
  else tipo = 'hojarasca';
  return { tipo, ambiguo };
}

async function s3() {
  const s = seccion(3, 'SUELO');
  await instalarEntorno();
  const M = await cargarMundo(SRC);
  s.ok(typeof M.sueloEn === 'function', 'Mundo.sueloEn existe');
  if (typeof M.sueloEn !== 'function') { s.felizQue = 'no hay sueloEn'; return s; }

  const rnd = azar(11);
  const tipos = ['agua', 'nieve', 'roca', 'pasto', 'hojarasca'];
  const cuenta = Object.fromEntries(tipos.map((t) => [t, 0]));
  let acuerdos = 0, comparados = 0, ambiguos = 0, invalidos = 0;
  const desacuerdos = {};
  let ms = 0, llamadas = 0;
  for (const cota of [1750, 1100]) {
    let tomados = 0;
    for (let n = 0; n < 60000 && tomados < 3000; n++) {
      const x = (rnd() - 0.5) * M.tamano * 0.9, z = (rnd() - 0.5) * M.tamano * 0.9;
      if (M.esAgua(x, z) || M.orillaCerca(x, z)) continue;
      tomados++;
      const j = sueloDelJefe(M, x, z, cota);
      if (j.ambiguo) { ambiguos++; continue; }
      const t0 = performance.now();
      const suyo = M.sueloEn(x, z, cota);
      ms += performance.now() - t0; llamadas++;
      if (!tipos.includes(suyo)) { invalidos++; continue; }
      comparados++;
      cuenta[j.tipo]++;
      if (suyo === j.tipo) acuerdos++;
      else desacuerdos[`${j.tipo}→${suyo}`] = (desacuerdos[`${j.tipo}→${suyo}`] || 0) + 1;
    }
  }
  s.ok(comparados >= 5000, 'se compararon al menos 5000 puntos de tierra fuera de las bandas de ambigüedad', `${comparados} (ambiguos ${ambiguos})`);
  s.ok(invalidos === 0, 'sueloEn devuelve siempre uno de los cinco tipos', invalidos);
  for (const t of ['nieve', 'roca', 'pasto', 'hojarasca']) s.ok(cuenta[t] >= 100, `cobertura: al menos 100 puntos de ${t} en la lectura del jefe`, cuenta[t]);
  const acuerdo = comparados ? acuerdos / comparados : 0;
  s.ok(acuerdo >= 0.95, 'acuerdo ≥ 95 % con la lectura independiente del sombreador', `${(acuerdo * 100).toFixed(1)} % · desacuerdos ${JSON.stringify(desacuerdos)}`);
  s.ok(M.sueloEn(0, 0, 1750) !== undefined && tipos.includes(M.sueloEn(0, 0, 1750)), 'responde en el centro del mundo');
  // Un punto de agua
  let agua = null;
  for (let k = 0; k < M.agua.length && !agua; k += 997) if (M.agua[k] > 200) { const i = k % M.N, j = Math.floor(k / M.N); agua = [mundoDeTexel(M, i), mundoDeTexel(M, j)]; }
  if (agua) s.ok(M.sueloEn(agua[0], agua[1], 1750) === 'agua', 'sobre un lago devuelve agua');
  s.ok(llamadas && ms / llamadas < 0.05, 'cuesta menos de 0,05 ms por consulta (se llama por paso)', `${llamadas ? (ms / llamadas).toFixed(4) : '—'} ms`);

  // Los pasos
  const { Audio } = await import(urlDe(SRC, 'engine/Audio.js'));
  const registro = [];
  const param = (nombre, nodo) => {
    const p = { value: 0 };
    for (const f of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
      p[f] = (...a) => { nodo.eventos.push(`${nombre}.${f}(${a.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)).join(',')})`); return p; };
    }
    return p;
  };
  const nodo = (tipo) => {
    const n = { tipo, eventos: [], connect: (t) => t || n, disconnect() {}, start() {}, stop() {} };
    for (const nombre of ['frequency', 'Q', 'gain', 'detune', 'playbackRate', 'pan', 'delayTime']) n[nombre] = param(nombre, n);
    registro.push(n);
    return n;
  };
  const ctx = {
    currentTime: 10, sampleRate: 44100, state: 'running', destination: nodo('destino'),
    createBufferSource: () => nodo('fuente'), createBiquadFilter: () => nodo('filtro'), createGain: () => nodo('ganancia'),
    createOscillator: () => nodo('oscilador'), createWaveShaper: () => nodo('conformador'), createStereoPanner: () => nodo('paneo'),
    createDelay: () => nodo('demora'), createDynamicsCompressor: () => nodo('compresor'),
    createBuffer: (c, l, r) => ({ length: l, sampleRate: r, numberOfChannels: c, getChannelData: () => new Float32Array(l) }),
  };
  const audio = new Audio();
  audio.ctx = ctx; audio.bus = nodo('bus'); audio.maestro = nodo('maestro'); audio.ruido = ctx.createBuffer(1, 44100, 44100); audio.listo = true;
  const randomOrig = Math.random;
  const firma = (tipo) => {
    registro.length = 0;
    let semilla = 0.37;
    Math.random = () => { semilla = (semilla * 9301 + 49297) % 233280 / 233280; return semilla; };
    let tiro = null;
    try { audio._paso(tipo, 3.4); } catch (e) { tiro = e.message; }
    Math.random = randomOrig;
    const f = registro.filter((n) => !['bus', 'maestro', 'destino'].includes(n.tipo))
      .map((n) => `${n.tipo}[${n.type ?? ''}|${Math.round((n.frequency?.value ?? 0))}|${n.eventos.join(';')}]`).join(' ');
    return { f, tiro };
  };
  const firmas = {};
  for (const t of ['nieve', 'roca', 'pasto', 'hojarasca', 'agua']) {
    const r = firma(t);
    s.ok(r.tiro === null && r.f.length > 0, `el paso de ${t} suena (arma nodos y no tira)`, r.tiro || `${r.f.length} caracteres de firma`);
    firmas[t] = r.f;
  }
  const distintas = new Set(['nieve', 'roca', 'pasto', 'hojarasca'].map((t) => firmas[t])).size;
  s.ok(distintas === 4, 'nieve, roca, pasto y hojarasca suenan distinto entre sí', `${distintas} firmas distintas`);

  s.feliz = comparados >= 5000 && acuerdo > 0 && distintas >= 1;
  s.felizQue = 'se compararon los puntos y los pasos armaron sonido';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function s4() {
  const s = seccion(4, 'ARRANQUE');
  if (process.env.BANCO_SIN_BUILD) { s.nota('vite build salteado'); s.feliz = true; s.felizQue = 'salteado'; return s; }
  const salida = path.join(AQUI, '.tmp-banco-r5f2-dist');
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', salida, '--emptyOutDir'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 300000, shell: process.platform === 'win32' });
  const texto = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'vite build pasa', r.status === 0 ? (texto.match(/built in [^\n]+/)?.[0] || 'ok') : texto.slice(-800));
  try { fs.rmSync(salida, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch { /* da igual */ }
  s.feliz = r.status === 0;
  s.felizQue = 'el bundle se construyó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// Orquestación (igual que el banco de la fase 1)
// ═══════════════════════════════════════════════════════════════════════════

const SECCIONES = { s1, s2, s3, s4 };
const NUM = { s1: 1, s2: 2, s3: 3, s4: 4 };

async function hijo(nombre) {
  let res;
  try { res = [await SECCIONES[nombre]()]; }
  catch (e) {
    const s = seccion(NUM[nombre], `sección ${nombre}`);
    s.ok(false, 'la sección corrió sin excepción', `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`);
    res = [s];
  }
  process.stdout.write(`\n@@RESULTADO ${JSON.stringify(res.map(({ ok, nota, ...x }) => x))}\n`);
}

function padre() {
  console.log(`BANCO R5 · FASE 2 (suelo)   src = ${path.relative(RAIZ, SRC) || SRC} · base ${BASE}\n`);
  const todas = [];
  for (const nombre of Object.keys(SECCIONES)) {
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', fileURLToPath(import.meta.url), '--seccion', nombre],
      { cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024, env: process.env });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/@@RESULTADO (.+)\n?$/m);
    if (!m) {
      todas.push({ num: NUM[nombre], nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'el proceso devolvió resultado', detalle: salida.slice(-1500) }], feliz: false, felizQue: 'el proceso murió', notas: [] });
      continue;
    }
    todas.push(...JSON.parse(m[1]));
  }
  todas.sort((a, b) => a.num - b.num);
  let verdes = 0;
  for (const s of todas) {
    const fallas = s.checks.filter((c) => !c.ok);
    const verde = fallas.length === 0 && s.feliz;
    if (verde) verdes++;
    console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(2)}  ${s.num} · ${s.nombre}`);
    for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined ? `  [${c.detalle}]` : ''}`);
    if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
    for (const n of s.notas) console.log(`         nota ${n}`);
  }
  const feliz = todas.every((s) => s.feliz);
  console.log(`\n  ${feliz ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length} secciones)`);
  console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}`);
  process.exitCode = verdes === todas.length ? 0 : 1;
}

const iArg = process.argv.indexOf('--seccion');
if (iArg > 0) await hijo(process.argv[iArg + 1]);
else padre();
