/**
 * FALSADOR DEL BANCO DE LA FASE 2 — ronda 5.
 *
 * Mismo método que `banco-r5-fase1.falsar.mjs`, con sus cuatro desenlaces: cada
 * defecto declara la aserción que TIENE que caer, y una sección que se pone roja
 * por otra cosa se informa como «lo vio por otro motivo», que no es prueba.
 *
 * Los defectos se plantan agregando código al final del módulo —envolviendo el
 * prototipo, o reasignando la clase exportada, que dentro del módulo es un enlace
 * mutable—, así muerden sin conocer la forma interna que le dio el agente. El
 * primero es el `src/` real de la base.
 *
 * Uso:  node .claude/flota/banco-r5-fase2.falsar.mjs [id ...]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r5-fase2.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r5f2');
const BASE = process.env.BANCO_BASE || 'b07f5a5';
const BORRAR = { recursive: true, force: true, maxRetries: 8, retryDelay: 250 };

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 1800000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const secciones = new Map();
  let actual = null;
  for (const l of salida.split(/\r?\n/)) {
    const h = l.match(/^\s{2}(VERDE|ROJO )\s+ejercitó\s+\d+\s+(\d)\s·\s(.+)$/);
    if (h) { actual = { verde: h[1] === 'VERDE', checks: new Map() }; secciones.set(Number(h[2]), actual); continue; }
    const c = l.match(/^\s{9}(ok |MAL)\s{2}(.+)$/);
    if (c && actual) actual.checks.set(c[2].split('  [')[0], c[1] === 'ok ');
  }
  return { secciones, salida };
}

function copiarSrc(destino) {
  fs.rmSync(destino, BORRAR);
  fs.cpSync(path.join(RAIZ, 'src'), path.join(destino, 'src'), { recursive: true });
  return path.join(destino, 'src');
}
function srcDeBase(destino) {
  fs.rmSync(destino, BORRAR);
  fs.mkdirSync(destino, { recursive: true });
  const tar = path.join(destino, 'base.tar');
  execFileSync('git', ['archive', '-o', tar, BASE, 'src'], { cwd: RAIZ });
  execFileSync('tar', ['-xf', tar, '-C', destino]);
  fs.rmSync(tar);
  return path.join(destino, 'src');
}
function agregar(src, rel, codigo) {
  const f = path.join(src, ...rel.split('/'));
  if (!fs.existsSync(f)) return `no existe ${rel}`;
  fs.appendFileSync(f, `\n\n// ── DEFECTO PLANTADO POR EL FALSADOR ──\n${codigo}\n`);
  return null;
}
function reemplazar(src, rel, alternativas) {
  const f = path.join(src, ...rel.split('/'));
  if (!fs.existsSync(f)) return `no existe ${rel}`;
  const t = fs.readFileSync(f, 'utf8');
  for (const [re, rep] of alternativas) { const p = t.replace(re, rep); if (p !== t) { fs.writeFileSync(f, p); return null; } }
  return `ninguna ancla enganchó en ${rel}`;
}
function importa(src, rel) {
  const url = pathToFileURL(path.join(src, ...rel.split('/'))).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    `globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){}};globalThis.localStorage={getItem(){return null},setItem(){}};await import(${JSON.stringify(url)});`],
  { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
  return r.status === 0 ? null : `el módulo plantado no importa: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || r.stderr.slice(0, 300)}`;
}

/** `_excavarLagos` tal como estaba en la base (Mundo.js:130-185 de b07f5a5). */
const EXCAVAR_BASE = `function () {
    const N = this.N, m = this.metrosPorTexel;
    const INF = 1e9;
    const dist = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) dist[k] = this.agua[k] > 127 ? INF : 0;
    const D = 1, DD = Math.SQRT2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i; if (dist[k] === 0) continue; let d = dist[k];
      if (i > 0) d = Math.min(d, dist[k - 1] + D);
      if (j > 0) d = Math.min(d, dist[k - N] + D);
      if (i > 0 && j > 0) d = Math.min(d, dist[k - N - 1] + DD);
      if (i < N - 1 && j > 0) d = Math.min(d, dist[k - N + 1] + DD);
      dist[k] = d;
    }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
      const k = j * N + i; if (dist[k] === 0) continue; let d = dist[k];
      if (i < N - 1) d = Math.min(d, dist[k + 1] + D);
      if (j < N - 1) d = Math.min(d, dist[k + N] + D);
      if (i < N - 1 && j < N - 1) d = Math.min(d, dist[k + N + 1] + DD);
      if (i > 0 && j < N - 1) d = Math.min(d, dist[k + N - 1] + DD);
      dist[k] = d;
    }
    const PROF_MAX = 120, CAIDA = 3.4;
    this.profundidadLago = new Float32Array(N * N);
    this.superficieLago = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) {
      if (this.agua[k] <= 127) continue;
      const dm = dist[k] * m;
      const prof = Math.min(PROF_MAX, CAIDA * Math.sqrt(dm));
      this.profundidadLago[k] = prof;
      this.superficieLago[k] = this.altura[k];
      this.altura[k] -= prof;
    }
  }`;

const DEFECTOS = [
  {
    id: 'D0', que: 'el mundo real: src/ de la base, donde la fase no existe', base: true,
    espera: [
      [1, 'sotobosque: todo término que suma a indirectDiffuse lleva uLuzCielo'],
      [2, 'orilla visible: mediana de profundidad ≤ 0,3 m'],
      [3, 'Mundo.sueloEn existe'],
    ],
  },
  {
    id: 'D1', que: 'Noche: un término del sotobosque pierde uLuzCielo',
    modulo: 'world/Sotobosque.js',
    plantar: (s) => agregar(s, 'world/Sotobosque.js', `{
  const __S = Sotobosque;
  Sotobosque = class extends __S {
    constructor(...a) {
      super(...a);
      for (const l of this.lotes || []) {
        const m = l.malla?.material; if (!m) continue;
        const o = m.onBeforeCompile;
        m.onBeforeCompile = function (sh, r) { o.call(this, sh, r); sh.fragmentShader = sh.fragmentShader.replace(/\\s*\\*\\s*uLuzCielo\\b/, '').replace(/\\buLuzCielo\\s*\\*\\s*/, ''); };
      }
    }
  };
}`),
    espera: [[1, 'sotobosque: todo término que suma a indirectDiffuse lleva uLuzCielo']],
  },
  {
    id: 'D2', que: 'Noche: se normaliza con 1 en vez de 0,85 (el mediodía aprobado se oscurece)',
    modulo: 'world/Sotobosque.js',
    plantar: (s) => agregar(s, 'world/Sotobosque.js', `{
  const __a = Sotobosque.prototype.actualizar;
  Sotobosque.prototype.actualizar = function (...a) { const r = __a.apply(this, a); for (const u of Object.values(this.uniformes || {})) if (u === this.uniformes.uLuzCielo) u.value *= 0.85; return r; };
}`),
    espera: [[1, 'mediodía del 15/2 (0,85): uLuzCielo = 1, la imagen aprobada no cambia']],
  },
  {
    id: 'D3', que: 'Noche: el factor no se topa en 1',
    modulo: 'world/Sotobosque.js',
    plantar: (s) => agregar(s, 'world/Sotobosque.js', `{
  const __a = Sotobosque.prototype.actualizar;
  Sotobosque.prototype.actualizar = function (...a) { const r = __a.apply(this, a); const u = this.uniformes?.uLuzCielo; if (u && u.value >= 0.999) u.value = 1.53; return r; };
}`),
    espera: [[1, 'nunca pasa de 1']],
  },
  {
    id: 'D4', que: 'Noche: la traslucidez de los árboles pierde uLuzCielo',
    plantar: (s) => reemplazar(s, 'world/Vegetacion.js', [
      [/(reflectedLight\s*\.\s*indirectDiffuse\s*\+=[^;]*?)\s*\*\s*uLuzCielo\b/, '$1'],
      [/(reflectedLight\s*\.\s*indirectDiffuse\s*\+=[^;]*?)\buLuzCielo\s*\*\s*/, '$1'],
    ]),
    espera: [[1, 'árboles: la traslucidez de la hoja lleva uLuzCielo']],
  },
  {
    id: 'D5', que: 'Orilla: vuelve el lecho viejo',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `Mundo.prototype._excavarLagos = ${EXCAVAR_BASE};`),
    espera: [[2, 'orilla visible: mediana de profundidad ≤ 0,3 m']],
  },
  {
    id: 'D6', que: 'Orilla: la cubeta queda a la mitad',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __e = Mundo.prototype._excavarLagos;
  Mundo.prototype._excavarLagos = function (...a) {
    const r = __e.apply(this, a);
    for (let k = 0; k < this.agua.length; k++) if (this.agua[k] > 127) { const p = this.profundidadLago[k]; this.profundidadLago[k] = p / 2; this.altura[k] += p / 2; }
    return r;
  };
}`),
    espera: [[2, 'la cubeta a 300 m queda dentro del ±15 % de la base (mediana de la razón)']],
  },
  {
    id: 'D7', que: 'Orilla: el fondo pasa los 120 m',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __e = Mundo.prototype._excavarLagos;
  Mundo.prototype._excavarLagos = function (...a) {
    const r = __e.apply(this, a);
    let km = -1, pm = -1;
    for (let k = 0; k < this.profundidadLago.length; k++) if (this.profundidadLago[k] > pm) { pm = this.profundidadLago[k]; km = k; }
    if (km >= 0) { this.altura[km] -= 130 - pm; this.profundidadLago[km] = 130; }
    return r;
  };
}`),
    espera: [[2, 'PROF_MAX sigue en 120']],
  },
  {
    id: 'D8', que: 'Orilla: la textura que lee el agua no es el lecho de la CPU',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __t = Mundo.prototype._construirTexturas;
  Mundo.prototype._construirTexturas = function (...a) {
    const r = __t.apply(this, a);
    const d = this.texAltura?.image?.data; if (d) for (let k = 0; k < this.N * this.N; k++) d[k * 2] += 0.5;
    return r;
  };
}`),
    espera: [[2, 'texAltura (lo que lee el agua) es texel a texel el lecho y la superficie de la CPU']],
  },
  {
    id: 'D9', que: 'Orilla: excavar tarda 450 ms más',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __e = Mundo.prototype._excavarLagos;
  Mundo.prototype._excavarLagos = function (...a) { const t = Date.now(); while (Date.now() - t < 450) { /* nada */ } return __e.apply(this, a); };
}`),
    espera: [[2, '_excavarLagos cuesta a lo sumo +200 ms de carga']],
  },
  {
    id: 'D10', que: 'Orilla: un cinturón somero de tres celdas',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __e = Mundo.prototype._excavarLagos;
  Mundo.prototype._excavarLagos = function (...a) {
    const r = __e.apply(this, a);
    const N = this.N, ag = this.agua, marcado = new Uint8Array(N * N);
    let frente = [];
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      if (ag[k] > 127 && (ag[k - 1] <= 127 || ag[k + 1] <= 127 || ag[k - N] <= 127 || ag[k + N] <= 127)) frente.push(k);
    }
    for (let anillo = 0; anillo < 3; anillo++) {
      const sig = [];
      for (const k of frente) {
        if (marcado[k]) continue; marcado[k] = 1;
        this.altura[k] = this.superficieLago[k] - 0.1; this.profundidadLago[k] = 0.1;
        for (const v of [k - 1, k + 1, k - N, k + N]) if (ag[v] > 127 && !marcado[v]) sig.push(v);
      }
      frente = sig;
    }
    return r;
  };
}`),
    espera: [[2, 'ancho con menos de 0,5 m: mediana entre 1,5 y 12 m']],
  },
  {
    id: 'D11', que: 'Suelo: la nieve se lee como roca',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __s = Mundo.prototype.sueloEn;
  Mundo.prototype.sueloEn = function (...a) { const t = __s.apply(this, a); return t === 'nieve' ? 'roca' : t; };
}`),
    espera: [[3, 'nieve: al menos el 90 % de sus puntos se reconocen como nieve']],
  },
  {
    id: 'D12', que: 'Suelo: la cota de nieve se ignora',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __s = Mundo.prototype.sueloEn;
  Mundo.prototype.sueloEn = function (x, z) { return __s.call(this, x, z, 1750); };
}`),
    espera: [[3, 'nieve: al menos el 90 % de sus puntos se reconocen como nieve']],
  },
  {
    id: 'D13', que: 'Suelo: el umbral de humedad se corre a 0,6',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __s = Mundo.prototype.sueloEn;
  Mundo.prototype.sueloEn = function (x, z, c) { const t = __s.call(this, x, z, c); return t === 'hojarasca' && this.humedadEn(x, z) < 0.6 ? 'pasto' : t; };
}`),
    espera: [[3, 'hojarasca: al menos el 90 % de sus puntos se reconocen como hojarasca']],
  },
  {
    id: 'D14', que: 'Pasos: la roca suena como la hojarasca',
    modulo: 'engine/Audio.js',
    plantar: (s) => agregar(s, 'engine/Audio.js', `{
  const __p = Audio.prototype._paso;
  Audio.prototype._paso = function (tipo, ...a) { return __p.call(this, tipo === 'roca' ? 'hojarasca' : tipo, ...a); };
}`),
    espera: [[3, 'nieve, roca, pasto y hojarasca suenan distinto entre sí']],
  },
  {
    id: 'D15', que: 'Suelo: cada consulta tarda un décimo de milisegundo',
    modulo: 'world/Mundo.js',
    plantar: (s) => agregar(s, 'world/Mundo.js', `{
  const __s = Mundo.prototype.sueloEn;
  Mundo.prototype.sueloEn = function (...a) { const t = performance.now(); while (performance.now() - t < 0.1) { /* nada */ } return __s.apply(this, a); };
}`),
    espera: [[3, 'cuesta menos de 0,05 ms por consulta (se llama por paso)']],
  },
];

const pedidos = process.argv.slice(2);
const lista = pedidos.length ? DEFECTOS.filter((d) => pedidos.includes(d.id)) : DEFECTOS;

console.log('FALSADOR · banco R5 fase 2\n');
fs.mkdirSync(TMP, { recursive: true });
const control = correrBanco(copiarSrc(path.join(TMP, 'control')));
const rojosControl = [...control.secciones.entries()].filter(([, s]) => !s.verde).map(([n]) => n);
console.log(`  control: ${control.secciones.size} secciones, rojas en el control: ${rojosControl.join(', ') || 'ninguna'}`);
if (control.secciones.size === 0) { console.log(control.salida.slice(-2000)); process.exit(2); }

const cuenta = { 'lo vio': 0, 'lo vio por otro motivo': 0, 'NO lo vio': 0, 'no se pudo plantar': 0 };
for (const d of lista) {
  const dir = path.join(TMP, d.id);
  let src, falla = null;
  if (d.base) src = srcDeBase(dir);
  else { src = copiarSrc(dir); falla = d.plantar(src); if (!falla && d.modulo) falla = importa(src, d.modulo); }
  let desenlace, detalle = '';
  if (falla) { desenlace = 'no se pudo plantar'; detalle = falla; }
  else {
    const r = correrBanco(src);
    const caidas = [], noCaidas = [];
    for (const [num, desc] of d.espera) {
      const enControl = control.secciones.get(num)?.checks.get(desc);
      const conDefecto = r.secciones.get(num)?.checks.get(desc);
      if (enControl !== true) { noCaidas.push(`[${num}] «${desc}» no estaba bien en el control (${enControl})`); continue; }
      if (conDefecto === false) caidas.push(`[${num}] ${desc}`);
      else noCaidas.push(`[${num}] «${desc}» ${conDefecto === undefined ? 'no se ejercitó' : 'siguió bien'}`);
    }
    const cambiaron = [...r.secciones.entries()].filter(([n, s]) => !s.verde && control.secciones.get(n)?.verde).map(([n]) => n);
    desenlace = noCaidas.length === 0 ? 'lo vio' : (cambiaron.length ? 'lo vio por otro motivo' : 'NO lo vio');
    detalle = [...caidas.map((x) => `cayó ${x}`), ...noCaidas.map((x) => `NO ${x}`), cambiaron.length ? `secciones rojas: ${cambiaron.join(', ')}` : ''].filter(Boolean).join(' · ');
  }
  cuenta[desenlace]++;
  const marca = { 'lo vio': 'lo vio               ', 'lo vio por otro motivo': 'LO VIO POR OTRO MOTIVO', 'NO lo vio': 'NO LO VIO             ', 'no se pudo plantar': 'no se pudo plantar    ' }[desenlace];
  console.log(`  ${marca}  ${d.id.padEnd(4)} ${d.que}`);
  if (desenlace !== 'lo vio' || process.env.FALSAR_DETALLE) console.log(`                          ${detalle}`);
}
console.log(`\n  ${cuenta['lo vio']} vistos · ${cuenta['lo vio por otro motivo']} por otro motivo · ${cuenta['NO lo vio']} puntos ciegos · ${cuenta['no se pudo plantar']} sin plantar, de ${lista.length}`);
if (!process.env.FALSAR_CONSERVAR) {
  try { fs.rmSync(TMP, BORRAR); } catch (e) { console.log(`  (no se pudo borrar ${path.relative(RAIZ, TMP)}: ${e.code})`); }
}
process.exitCode = cuenta['lo vio'] === lista.length ? 0 : 1;
