/**
 * FALSADOR DEL BANCO DE LA FASE 1 — ronda 5.
 *
 * Un banco que nunca se puso rojo no vale más que el informe de su autor. Acá se
 * le plantan defectos conocidos a una copia de `src/` y se comprueba que los ve.
 *
 * ── Cuatro desenlaces, no tres ───────────────────────────────────────────────
 * La ronda 3 separó `lo vio` / `NO lo vio` / `no se pudo plantar`. Esta ronda
 * abre con la trampa nº 10 fresca —«un OK por la razón equivocada es peor que
 * una falla»— y la misma trampa existe del lado del falsador: una sección que se
 * pone roja porque el defecto rompió OTRA cosa no demuestra que el banco mire lo
 * que dice mirar. Por eso cada defecto declara la aserción que TIENE que caer:
 *
 *   · `lo vio`                 — cayó la aserción esperada, que en el control
 *                                estaba bien. Es la prueba.
 *   · `lo vio por otro motivo` — la sección se puso roja, pero no por la
 *                                aserción esperada. No cuenta como prueba.
 *   · `NO lo vio`              — nada cambió respecto del control. Punto ciego.
 *   · `no se pudo plantar`     — el ancla no enganchó o el módulo plantado no
 *                                importa. Zona sin falsar, declarada.
 *
 * ── Cómo se planta ───────────────────────────────────────────────────────────
 * Casi siempre **agregando código al final del módulo**: se envuelve un método
 * del prototipo o se reasigna la función exportada. Muerde sea cual sea la forma
 * interna que le haya dado el agente, que este falsador no necesita conocer. Las
 * funciones declaradas con `export function` son enlaces mutables dentro del
 * módulo, así que reasignarlas cambia lo que ve quien las importa.
 *
 * El primer defecto no es sintético: es `src/` de `b04a424`, el `main` sobre el
 * que abrió la ronda, donde nada de la fase existe.
 *
 * Uso:  node .claude/flota/banco-r5-fase1.falsar.mjs [id ...]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r5-fase1.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r5f1');
const BASE = 'b04a424';

// ═══════════════════════════════════════════════════════════════════════════
// Correr el banco y leerlo aserción por aserción
// ═══════════════════════════════════════════════════════════════════════════

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const secciones = new Map();   // num -> { verde, checks: Map(desc -> ok) }
  let actual = null;
  for (const l of salida.split(/\r?\n/)) {
    const h = l.match(/^\s{2}(VERDE|ROJO )\s+ejercitó\s+\d+\s+(\d)\s·\s(.+)$/);
    if (h) { actual = { verde: h[1] === 'VERDE', nombre: h[3], checks: new Map() }; secciones.set(Number(h[2]), actual); continue; }
    const c = l.match(/^\s{9}(ok |MAL)\s{2}(.+)$/);
    if (c && actual) {
      const desc = c[2].split('  [')[0];
      actual.checks.set(desc, c[1] === 'ok ');
    }
  }
  return { secciones, salida };
}

// ═══════════════════════════════════════════════════════════════════════════
// Copias de src/ con un defecto
// ═══════════════════════════════════════════════════════════════════════════

function copiarSrc(destino) {
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(path.join(RAIZ, 'src'), path.join(destino, 'src'), { recursive: true });
  return path.join(destino, 'src');
}

function srcDeBase(destino) {
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  const tar = path.join(destino, 'base.tar');
  execFileSync('git', ['archive', '-o', tar, BASE, 'src'], { cwd: RAIZ });
  execFileSync('tar', ['-xf', tar, '-C', destino]);
  fs.rmSync(tar);
  return path.join(destino, 'src');
}

/** Agrega código al final de un módulo. Devuelve null si el archivo no existe. */
function agregar(src, rel, codigo) {
  const f = path.join(src, ...rel.split('/'));
  if (!fs.existsSync(f)) return `no existe ${rel}`;
  fs.appendFileSync(f, `\n\n// ── DEFECTO PLANTADO POR EL FALSADOR ──\n${codigo}\n`);
  return null;
}

/** Reemplaza con la primera alternativa que enganche Y cambie el texto. */
function reemplazar(src, rel, alternativas) {
  const f = path.join(src, ...rel.split('/'));
  if (!fs.existsSync(f)) return `no existe ${rel}`;
  const t = fs.readFileSync(f, 'utf8');
  for (const [re, rep] of alternativas) {
    const p = t.replace(re, rep);
    if (p !== t) { fs.writeFileSync(f, p); return null; }
  }
  return `ninguna ancla enganchó en ${rel}`;
}

function editarJson(src, rel, fn) {
  const f = path.join(src, ...rel.split('/'));
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const antes = JSON.stringify(d);
  fn(d);
  if (JSON.stringify(d) === antes) return 'la edición no cambió nada';
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  return null;
}

/** ¿El módulo plantado importa? Si no, el defecto no se plantó: se rompió. */
function importa(src, rel) {
  const url = pathToFileURL(path.join(src, ...rel.split('/'))).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    `globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){}};globalThis.localStorage={getItem(){return null},setItem(){}};await import(${JSON.stringify(url)});`],
  { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
  return r.status === 0 ? null : `el módulo plantado no importa: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || r.stderr.slice(0, 300)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Los defectos
// ═══════════════════════════════════════════════════════════════════════════

const DEFECTOS = [
  {
    id: 'D0', que: 'el mundo real: src/ de b04a424, donde la fase no existe',
    base: true,
    espera: [
      [1, 'cero PointLight/SpotLight/RectAreaLight en el código de src/'],
      [4, 'Equipo.encender() existe'],
      [5, 'de noche sin luz: 120 m'],
      [6, 'el equipo sobrevive a cerrar la pestaña'],
      [7, 'la frase falsa «ninguna luz puntual» no está en ningún lado del archivo'],
    ],
    // Luces.js no existe en la base: la sección 2 revienta al importar
    esperaSeccionRoja: [2, 3],
  },
  {
    id: 'D1', que: 'Hornos: una PointLight nombrada en el código (sin usar)',
    plantar: (s) => agregar(s, 'world/Hornos.js', 'export const __luzPlantada = () => new THREE.PointLight(0xff7a2e, 0, 14, 2);'),
    modulo: 'world/Hornos.js',
    espera: [[1, 'cero PointLight/SpotLight/RectAreaLight en el código de src/']],
  },
  {
    id: 'D2', que: 'Hornos: cada horno cuelga una luz de three, sin nombrarla (el escáner no la ve; el grafo sí)',
    plantar: (s) => agregar(s, 'world/Hornos.js', `{
  const __agregar = Hornos.prototype.agregar;
  Hornos.prototype.agregar = function (h) {
    const n = __agregar.call(this, h);
    n.add(new THREE['Po' + 'intLight'](0xff7a2e, 0, 14, 2));
    return n;
  };
}`),
    modulo: 'world/Hornos.js',
    espera: [[1, 'ninguna luz de three en el grafo de los hornos']],
  },
  {
    id: 'D3', que: 'Clima: aparece una luz de three con el incendio',
    plantar: (s) => agregar(s, 'world/Clima.js', `{
  const __act = Clima.prototype.actualizar;
  Clima.prototype.actualizar = function (dt, est, cam) {
    if ((est?.eventos || []).some((e) => e.id === 'incendio_forestal') && !this.__plantada) {
      this.__plantada = new THREE['Po' + 'intLight'](0xff5a1e, 0, 700, 2);
      this.grupo.add(this.__plantada);
    }
    return __act.call(this, dt, est, cam);
  };
}`),
    modulo: 'world/Clima.js',
    espera: [[1, 'ninguna luz de three en el clima con el incendio en curso']],
  },
  {
    id: 'D4', que: 'Hornos: los apagados también dan fuente',
    plantar: (s) => agregar(s, 'world/Hornos.js', `{
  const __f = Hornos.prototype.fuentesDeLuz;
  Hornos.prototype.fuentesDeLuz = function () {
    const r = __f.call(this) || [];
    for (const p of this.piezas || []) {
      const h = p.horno || p;
      if (!r.some((x) => Math.abs(x.x - h.x) < 0.05 && Math.abs(x.z - h.z) < 0.05)) r.push({ x: h.x, y: h.y + 0.6, z: h.z, radio: 14, color: [1, 0.48, 0.18], intensidad: 2 });
    }
    return r;
  };
}`),
    modulo: 'world/Hornos.js',
    espera: [[1, 'fuentesDeLuz() da una fuente por horno que arde, y ninguna por los apagados']],
  },
  {
    id: 'D5', que: 'Hornos: la brasa deja de latir',
    plantar: (s) => agregar(s, 'world/Hornos.js', `{
  const __f = Hornos.prototype.fuentesDeLuz;
  Hornos.prototype.fuentesDeLuz = function () { return (__f.call(this) || []).map((x) => ({ ...x, intensidad: x.intensidad > 0.05 ? 2.6 : x.intensidad })); };
}`),
    modulo: 'world/Hornos.js',
    espera: [[1, 'la brasa late (la intensidad varía en dos segundos)']],
  },
  {
    id: 'D6', que: 'Luces: el material lambert recibe un arreglo propio, no el compartido',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __i = instalarLuces;
  instalarLuces = function (T) { const r = __i(T); T.ShaderLib.lambert.uniforms.uLucesPos = { value: new Float32Array(8) }; return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[2, 'ShaderLib.lambert: comparte LOS MISMOS arreglos que standard']],
  },
  {
    id: 'D7', que: 'Luces: el bucle del sombreador no corta por cantidad',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __i = instalarLuces;
  instalarLuces = function (T) { const r = __i(T); T.ShaderChunk.lights_fragment_begin = T.ShaderChunk.lights_fragment_begin.replace(/\\bbreak\\s*;/g, ';'); return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[2, 'el bucle corta por cantidad (break)']],
  },
  {
    id: 'D8', que: 'Luces: el bloque suma un pow por fragmento',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __i = instalarLuces; let __hecho = false;
  instalarLuces = function (T) { const r = __i(T); if (!__hecho) { T.ShaderChunk.lights_fragment_begin += '\\n float plantadaPow = pow( 1.0, 2.0 );'; __hecho = true; } return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[2, 'sin matemática cara ni lecturas de textura por fragmento']],
  },
  {
    id: 'D9', que: 'Luces: el bloque transforma la posición con viewMatrix por fragmento',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __i = instalarLuces; let __hecho = false;
  instalarLuces = function (T) { const r = __i(T); if (!__hecho) { T.ShaderChunk.lights_fragment_begin += '\\n vec3 plantadaVista = ( viewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;'; __hecho = true; } return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[2, 'sin transformar la posición por fragmento: el espacio de vista viene de la CPU']],
  },
  {
    id: 'D10', que: 'Luces: instalar dos veces agrega otra vez',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __i = instalarLuces; let __n = 0;
  instalarLuces = function (T) { const r = __i(T); if (++__n === 2) T.ShaderChunk.lights_fragment_begin += '\\n// otra vez'; return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[2, 'instalar dos veces no duplica el bloque ni las declaraciones']],
  },
  {
    id: 'D11', que: 'Luces: onAfterRender no devuelve la cantidad a 0',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __e = Luces.prototype.enganchar;
  Luces.prototype.enganchar = function (esc) { const r = __e.call(this, esc); esc.onAfterRender = function () {}; return r; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'después de dibujar, la cantidad vuelve a 0']],
  },
  {
    id: 'D12', que: 'Luces: la mano pierde la prioridad',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __a = Luces.prototype.asignar;
  Luces.prototype.asignar = function (f, ref) { return __a.call(this, (f || []).map((x) => ({ ...x, mano: false })), ref); };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'la mano va en el lugar 0 aunque venga última, en espacio de vista']],
  },
  {
    id: 'D13', que: 'Luces: el espacio de vista ignora la cámara que dibuja',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __e = Luces.prototype.enganchar;
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const fija = { isCamera: true, matrixWorldInverse: { elements: I }, matrixWorld: { elements: I }, position: { x: 0, y: 0, z: 0 } };
  Luces.prototype.enganchar = function (esc) {
    const r = __e.call(this, esc);
    const ob = esc.onBeforeRender;
    esc.onBeforeRender = function (rr, ss, cc, tt) { return ob.call(this, rr, ss, fija, tt); };
    return r;
  };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'con otra cámara, la posición se escribe en el espacio de vista de ESA cámara']],
  },
  {
    id: 'D14', que: 'Luces: no se descarta lo lejano',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __a = Luces.prototype.asignar;
  Luces.prototype.asignar = function (f, ref) {
    const cerca = (f || []).map((x) => { const d = Math.hypot(x.x - ref.x, x.y - ref.y, x.z - ref.z); return d > x.radio + 60 ? { ...x, x: ref.x + (x.x - ref.x) * 0.5, z: ref.z + (x.z - ref.z) * 0.5 } : x; });
    return __a.call(this, cerca, ref);
  };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'se descarta lo que está a más de radio + 60 m, y no lo que está a menos']],
  },
  {
    id: 'D15', que: 'Luces: una fuente con intensidad 0 ocupa lugar',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __a = Luces.prototype.asignar;
  Luces.prototype.asignar = function (f, ref) { return __a.call(this, (f || []).map((x) => ({ ...x, intensidad: x.intensidad || 1e-6 })), ref); };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'una fuente con intensidad 0 no ocupa lugar']],
  },
  {
    id: 'D16', que: 'Luces: posicionDeMano devuelve la cámara',
    plantar: (s) => agregar(s, 'engine/Luces.js', `{
  const __p = posicionDeMano;
  posicionDeMano = function (j, cam, sal) { __p(j, cam, sal); sal.copy(cam.position); return sal; };
}`),
    modulo: 'engine/Luces.js',
    espera: [[3, 'primera persona: la mano a menos de 1 m de la cámara']],
  },
  {
    id: 'D17', que: 'Equipo: la llama no se apaga nunca',
    plantar: (s) => agregar(s, 'systems/Equipo.js', `{
  const __l = Equipo.prototype.luzActiva;
  Equipo.prototype.luzActiva = function (f, e) { if (this.__t === undefined) this.__t = f; return __l.call(this, Math.min(f, this.__t), e); };
}`),
    modulo: 'systems/Equipo.js',
    espera: [[4, 'pasada la hora y media se apagó']],
  },
  {
    id: 'D18', que: 'Equipo: la duración se mide con el reloj real',
    plantar: (s) => agregar(s, 'systems/Equipo.js', `{
  const __l = Equipo.prototype.luzActiva;
  const __e = Equipo.prototype.encender;
  Equipo.prototype.encender = function (id, f) { return __e.call(this, id, Date.now()); };
  Equipo.prototype.luzActiva = function (f, e) { return __l.call(this, Date.now(), e); };
}`),
    modulo: 'systems/Equipo.js',
    espera: [[4, 'pasada la hora y media se apagó']],
  },
  {
    id: 'D19', que: 'Equipo: las velas no se consumen',
    plantar: (s) => agregar(s, 'systems/Equipo.js', `{
  const __e = Equipo.prototype.encender;
  Equipo.prototype.encender = function (id, f) { const r = __e.call(this, id, f); if (id === 'velas_cera' && r?.ok) this.inventario.agregar('vela', 1); return r; };
}`),
    modulo: 'systems/Equipo.js',
    espera: [[4, 'y se consume una vela']],
  },
  {
    id: 'D20', que: 'Equipo: reponer pierde la llama',
    plantar: (s) => agregar(s, 'systems/Equipo.js', `{
  const __r = Equipo.prototype.reponer;
  Equipo.prototype.reponer = function (d) { const r = __r.call(this, d); this.apagar?.(); return r; };
}`),
    modulo: 'systems/Equipo.js',
    espera: [[4, 'reponer conserva la llama con su reloj del mundo'], [6, 'y la antorcha sigue ardiendo con su reloj']],
  },
  {
    id: 'D21', que: 'Equipo: la lluvia no apaga la antorcha (si la ficha lo afirma)',
    plantar: (s) => agregar(s, 'systems/Equipo.js', `{
  const __l = Equipo.prototype.luzActiva;
  Equipo.prototype.luzActiva = function (f, e) { return __l.call(this, f, e ? { ...e, lluvia: 0 } : e); };
}`),
    modulo: 'systems/Equipo.js',
    espera: [[4, 'la ficha dice lluvia fuerte: con lluvia 0,8 se apaga']],
    siLaFichaDiceLluvia: true,
  },
  {
    id: 'D22', que: 'Exploración: ignora la luz',
    plantar: (s) => agregar(s, 'systems/Exploracion.js', `{
  const __a = Exploracion.prototype.alcanceVisual;
  Exploracion.prototype.alcanceVisual = function (p, e) { return __a.call(this, p, e, 0); };
}`),
    modulo: 'systems/Exploracion.js',
    espera: [[5, 'de noche con luz: 220 m']],
  },
  {
    id: 'D23', que: 'Exploración: la luz cambia el alcance de día',
    plantar: (s) => agregar(s, 'systems/Exploracion.js', `{
  const __a = Exploracion.prototype.alcanceVisual;
  Exploracion.prototype.alcanceVisual = function (p, e, l = this.luzM ?? 0) { const r = __a.call(this, p, e, l); const noche = (e?.horaDecimal ?? 12) < 7 || (e?.horaDecimal ?? 12) > 20.5; return !noche && l > 0 ? r + 50 : r; };
}`),
    modulo: 'systems/Exploracion.js',
    espera: [[5, 'de día la luz no cambia nada']],
  },
  {
    id: 'D24', que: 'Partida: sube VERSION',
    plantar: (s) => reemplazar(s, 'systems/Partida.js', [[/const\s+VERSION\s*=\s*1\s*;/, 'const VERSION = 2;']]),
    modulo: 'systems/Partida.js',
    espera: [[6, 'VERSION sigue en 1']],
  },
  {
    id: 'D25', que: 'Partida: repone el equipo antes que el reloj',
    plantar: (s) => agregar(s, 'systems/Partida.js', `{
  const __c = Partida.prototype.cargar;
  Partida.prototype.cargar = function () {
    try {
      const d = JSON.parse(localStorage.getItem('survibar.partida.v1'));
      for (const k of Object.keys(d || {})) { const v = JSON.stringify(d[k]); if (v && v.includes('antorcha') && this.equipo?.reponer) { this.equipo.reponer(d[k]); break; } }
    } catch { /* nada */ }
    return __c.call(this);
  };
}`),
    modulo: 'systems/Partida.js',
    espera: [[6, 'y lo llama con el reloj del mundo ya repuesto']],
  },
  {
    id: 'D26', que: 'Partida: no guarda el equipo',
    plantar: (s) => agregar(s, 'systems/Partida.js', `{
  const __s = Partida.prototype._serializar;
  Partida.prototype._serializar = function () { const d = __s.call(this); for (const k of Object.keys(d)) { const v = JSON.stringify(d[k]); if (v && v.includes('antorcha')) delete d[k]; } return d; };
}`),
    modulo: 'systems/Partida.js',
    espera: [[6, 'el equipo sobrevive a cerrar la pestaña']],
  },
  {
    id: 'D27', que: 'Datos: vuelve la frase falsa de las luces',
    plantar: (s) => editarJson(s, 'data/herramientas.json', (d) => {
      d.engancheAlCodigo.pendienteSinSistema = [...(d.engancheAlCodigo.pendienteSinSistema || []), 'luz: no hay ninguna luz puntual en todo src/.'];
    }),
    espera: [[7, 'la frase falsa «ninguna luz puntual» no está en ningún lado del archivo']],
  },
  {
    id: 'D28', que: 'Datos: se borra la licencia del alcance nocturno',
    plantar: (s) => editarJson(s, 'data/herramientas.json', (d) => {
      const l = d.licenciasDeJuego?.licencias || [];
      d.licenciasDeJuego.licencias = l.filter((x) => { const j = JSON.stringify(x); return !(/(luz|antorcha|candil)/i.test(j) && /(noche|nocturn)/i.test(j)); });
    }),
    espera: [[7, 'licenciasDeJuego declara la del alcance nocturno con luz']],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Corrida
// ═══════════════════════════════════════════════════════════════════════════

const pedidos = process.argv.slice(2);
const lista = pedidos.length ? DEFECTOS.filter((d) => pedidos.includes(d.id)) : DEFECTOS;

console.log('FALSADOR · banco R5 fase 1\n');
fs.mkdirSync(TMP, { recursive: true });

// Control: la copia sin tocar
const srcControl = copiarSrc(path.join(TMP, 'control'));
const control = correrBanco(srcControl);
const rojosControl = [...control.secciones.entries()].filter(([, s]) => !s.verde).map(([n]) => n);
console.log(`  control: ${control.secciones.size} secciones, rojas en el control: ${rojosControl.join(', ') || 'ninguna'}`);
if (control.secciones.size === 0) { console.log(control.salida.slice(-2000)); process.exit(2); }
const fichaLluvia = /lluvia/i.test(JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'herramientas.json'), 'utf8')).objetos.find((o) => o.id === 'antorcha')?.nota || '');

const cuenta = { 'lo vio': 0, 'lo vio por otro motivo': 0, 'NO lo vio': 0, 'no se pudo plantar': 0 };
for (const d of lista) {
  const dir = path.join(TMP, d.id);
  let src, falla = null;
  if (d.siLaFichaDiceLluvia && !fichaLluvia) {
    falla = 'la ficha de la antorcha ya no afirma lo de la lluvia: no hay qué plantar';
  } else if (d.base) {
    src = srcDeBase(dir);
  } else {
    src = copiarSrc(dir);
    falla = d.plantar(src);
    if (!falla && d.modulo) falla = importa(src, d.modulo);
  }
  let desenlace, detalle = '';
  if (falla) {
    desenlace = 'no se pudo plantar'; detalle = falla;
  } else {
    const r = correrBanco(src);
    const caidas = [], noCaidas = [];
    for (const [num, desc] of d.espera) {
      const enControl = control.secciones.get(num)?.checks.get(desc);
      const conDefecto = r.secciones.get(num)?.checks.get(desc);
      if (enControl !== true) { noCaidas.push(`[${num}] «${desc}» no estaba bien en el control (${enControl})`); continue; }
      if (conDefecto === false) caidas.push(`[${num}] ${desc}`);
      else noCaidas.push(`[${num}] «${desc}» ${conDefecto === undefined ? 'no se ejercitó' : 'siguió bien'}`);
    }
    // Secciones que tienen que ponerse rojas enteras (la base, donde ni corren)
    for (const num of d.esperaSeccionRoja || []) {
      const s = r.secciones.get(num);
      if (s && !s.verde && control.secciones.get(num)?.verde) caidas.push(`[${num}] sección roja`);
      else noCaidas.push(`[${num}] sección ${s ? (s.verde ? 'verde' : 'roja también en el control') : 'ausente'}`);
    }
    const seccionesQueCambiaron = [...r.secciones.entries()].filter(([n, s]) => !s.verde && control.secciones.get(n)?.verde).map(([n]) => n);
    if (noCaidas.length === 0) desenlace = 'lo vio';
    else if (seccionesQueCambiaron.length) desenlace = 'lo vio por otro motivo';
    else desenlace = 'NO lo vio';
    detalle = [...caidas.map((x) => `cayó ${x}`), ...noCaidas.map((x) => `NO ${x}`), seccionesQueCambiaron.length ? `secciones rojas: ${seccionesQueCambiaron.join(', ')}` : ''].filter(Boolean).join(' · ');
  }
  cuenta[desenlace]++;
  const marca = { 'lo vio': 'lo vio               ', 'lo vio por otro motivo': 'LO VIO POR OTRO MOTIVO', 'NO lo vio': 'NO LO VIO             ', 'no se pudo plantar': 'no se pudo plantar    ' }[desenlace];
  console.log(`  ${marca}  ${d.id.padEnd(4)} ${d.que}`);
  if (desenlace !== 'lo vio' || process.env.FALSAR_DETALLE) console.log(`                          ${detalle}`);
}

console.log(`\n  ${cuenta['lo vio']} vistos · ${cuenta['lo vio por otro motivo']} por otro motivo · ${cuenta['NO lo vio']} puntos ciegos · ${cuenta['no se pudo plantar']} sin plantar, de ${lista.length}`);
if (!process.env.FALSAR_CONSERVAR) fs.rmSync(TMP, { recursive: true, force: true });
process.exitCode = cuenta['lo vio'] === lista.length ? 0 : 1;
