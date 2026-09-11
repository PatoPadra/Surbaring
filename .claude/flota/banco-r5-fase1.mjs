/**
 * BANCO DE LA FASE 1 (lumbre) — ronda 5.
 *
 * Lo escribe el JEFE, no el agente, y **contra el contrato de RONDA5.md**, en
 * paralelo al agente y sin leer su código ni su bitácora. Lo único que se leyó
 * del lado del código es la versión de base (`git show b04a424:…`), para saber
 * cómo se construyen los módulos que el contrato no cambia.
 *
 * ── Qué mide ─────────────────────────────────────────────────────────────────
 *   1. SIN LUCES DE THREE — cero `PointLight`/`SpotLight` en el código de `src/`
 *      (sin contar comentarios), y cero luces en el grafo de `Hornos` y de
 *      `Clima`, también con un incendio en curso y con hornos ardiendo. Es lo que
 *      evita el congelamiento de ~19 s que se midió al abrir la ronda.
 *   2. EL BLOQUE — `instalarLuces(THREE)` agrega al final de
 *      `lights_fragment_begin`, declara `uLucesPos`/`uLucesColor` del tamaño de
 *      `MAX_LUCES`, corta por cantidad, no suma matemática cara por fragmento, y
 *      los uniformes son `Float32Array` COMPARTIDOS que sobreviven al clonado que
 *      hace three al compilar. Idempotente.
 *   3. ASIGNAR Y ENGANCHAR — la mano va primero, después por distancia, el tope
 *      de radio + 60 m, intensidad 0 no ocupa lugar, espacio de vista de LA
 *      cámara que dibuja (la del espejo también), y `onAfterRender` vuelve la
 *      cantidad a 0.
 *   4. EQUIPO — antorcha, candil y velas encienden, duran lo que dicen contra el
 *      reloj del mundo, cobran lo que dicen, se apagan si cambia la mano, y el
 *      viaje de ida y vuelta por `serializar`/`reponer` conserva la llama.
 *   5. EXPLORACIÓN — de noche 120 m sin luz y 220 con luz; de día igual que hoy.
 *   6. PARTIDA — el equipo sobrevive a cerrar la pestaña, `VERSION` sigue en 1,
 *      se repone después del reloj, y una partida vieja carga igual.
 *   7. DATOS — la frase falsa de las luces no está más, la licencia del alcance
 *      nocturno está declarada, y los números de las tres fichas no cambiaron.
 *   8. ARRANQUE — `vite build` pasa.
 *
 * ── Guarda de cobertura ──────────────────────────────────────────────────────
 * Cada sección declara su CAMINO FELIZ: la pregunta no es «¿corrió?» sino «¿lo
 * que tenía que funcionar funcionó al menos una vez?». Una sección cuyo camino
 * feliz no llegó a funcionar es ROJA aunque no haya fallado ninguna aserción:
 * sin eso, «no hay luces en el grafo» es cierto por vacío si `agregar()` no
 * construyó nada (trampa nº 8 de ESTADO.md).
 *
 * Además el banco comprueba sus propias premisas antes de creerse: que el
 * escáner de código distinga comentario de código con un caso conocido, y que
 * three siga clonando los uniformes con `UniformsUtils.clone` al compilar —si
 * three dejara de hacerlo, «el arreglo compartido sobrevive al clonado» mediría
 * un mecanismo que ya no existe—.
 *
 * ── Uso ──────────────────────────────────────────────────────────────────────
 *   node .claude/flota/banco-r5-fase1.mjs
 *
 * Cada sección corre en un PROCESO SEPARADO: `instalarLuces` modifica
 * `THREE.ShaderChunk`, que es estado global del módulo, y la sección 2 necesita
 * leer el chunk prístino antes de instalar.
 *
 * Variables de entorno (las usa el falsador):
 *   BANCO_SRC        raíz alternativa de `src/` (una copia con un defecto)
 *   BANCO_SIN_BUILD  si está, se saltea `vite build` (sección 8)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const H = 3600e3;

const rutaSrc = (rel) => path.join(SRC, ...rel.split('/'));
const urlSrc = (rel) => pathToFileURL(rutaSrc(rel)).href;
const cerca = (a, b, tol = 1e-3) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// ═══════════════════════════════════════════════════════════════════════════
// Andamiaje común
// ═══════════════════════════════════════════════════════════════════════════

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (cond, desc, detalle) => { s.checks.push({ ok: !!cond, desc, detalle: detalle === undefined ? undefined : String(detalle) }); return !!cond; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** DOM mínimo para Node. El lienzo no dibuja: acá no se mide ninguna textura. */
function instalarDom() {
  const memoria = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => { memoria.set(k, String(v)); },
    removeItem: (k) => { memoria.delete(k); },
    clear: () => memoria.clear(),
  };
  globalThis.addEventListener = () => {};
  const ctx = new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData' || p === 'createImageData') return (a, b, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w ?? a) * (h ?? b) * 4)) });
      if (p === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  const lienzo = () => ({ width: 64, height: 64, style: {}, getContext: () => ctx, addEventListener() {}, toDataURL: () => '' });
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    createElement: (tag) => (tag === 'canvas' ? lienzo() : { style: {}, appendChild() {}, addEventListener() {} }),
    createElementNS: () => lienzo(),
    getElementById: () => null,
    querySelector: () => null,
    body: { appendChild() {} },
  };
}

/** Todas las luces de three colgadas de un objeto, visibles o no. */
function lucesEn(obj) {
  const l = [];
  obj.traverse((o) => { if (o.isLight) l.push(o.type); });
  return l;
}

/** ¿Se dibuja? Un objeto es visible si él y toda su cadena de padres lo son. */
function dibujable(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return false;
  return true;
}

/**
 * Quita comentarios de JavaScript respetando cadenas y plantillas. No es un
 * analizador: alcanza para no contar un `PointLight` nombrado en un comentario
 * como si fuera código, que es exactamente lo que hay en `Hornos.js` de base.
 */
function sinComentarios(t) {
  let out = '', i = 0;
  const n = t.length;
  while (i < n) {
    const c = t[i], d = t[i + 1];
    if (c === '/' && d === '/') { while (i < n && t[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n && t[i] !== q) { if (t[i] === '\\') { out += t[i] + (t[i + 1] ?? ''); i += 2; continue; } out += t[i]; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

function archivosJs(dir) {
  const r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...archivosJs(p));
    else if (e.name.endsWith('.js')) r.push(p);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · SIN LUCES DE THREE
// ═══════════════════════════════════════════════════════════════════════════

async function s1() {
  const s = seccion(1, 'SIN LUCES DE THREE');
  const RE = /\b(PointLight|SpotLight|RectAreaLight)\b/g;

  // Premisa del instrumento: distingue comentario de código.
  const prueba = "// una PointLight en comentario\nconst x = new THREE.PointLight(1); /* SpotLight */ const y = 'PointLight';";
  const enPrueba = (sinComentarios(prueba).match(RE) || []).length;
  s.ok(enPrueba === 2, 'premisa: el escáner cuenta el código y la cadena, no los comentarios', `contó ${enPrueba}, esperaba 2`);

  const hallazgos = [];
  const archivos = archivosJs(SRC);
  for (const f of archivos) {
    const codigo = sinComentarios(fs.readFileSync(f, 'utf8'));
    const m = codigo.match(RE);
    if (m) hallazgos.push(`${path.relative(SRC, f)}: ${m.join(', ')}`);
  }
  s.ok(archivos.length > 30, 'el escáner recorrió src/', `${archivos.length} archivos`);
  s.ok(hallazgos.length === 0, 'cero PointLight/SpotLight/RectAreaLight en el código de src/', hallazgos.join(' · ') || 'ninguna');

  instalarDom();
  const THREE = await import('three');

  // Hornos: cuatro tipos, dos ardiendo
  const { Hornos } = await import(urlSrc('world/Hornos.js'));
  const hornos = new Hornos();
  const escena = new THREE.Scene();
  escena.add(hornos.grupo);
  const defs = ['fogata', 'carbonera', 'horno_barro', 'fragua'];
  const lista = defs.map((id, i) => ({ def: { id, nombre: id }, x: i * 10, y: 5, z: -i * 3, ardiendo: i < 2 }));
  for (const h of lista) hornos.agregar(h);
  let mallas = 0;
  hornos.grupo.traverse((o) => { if (o.isMesh) mallas++; });
  s.ok(mallas >= 4, 'Hornos.agregar() construyó geometría', `${mallas} mallas`);
  s.ok(lucesEn(hornos.grupo).length === 0, 'ninguna luz de three en el grafo de los hornos', lucesEn(hornos.grupo).join(',') || 'ninguna');

  for (let k = 0; k < 180; k++) hornos.actualizar(k / 60);
  const tieneFuentes = typeof hornos.fuentesDeLuz === 'function';
  s.ok(tieneFuentes, 'Hornos expone fuentesDeLuz()');
  let felizHornos = false;
  if (tieneFuentes) {
    const f = (hornos.fuentesDeLuz() || []).filter((x) => (x.intensidad ?? 0) > 0);
    s.ok(f.length === 2, 'fuentesDeLuz() da una fuente por horno que arde, y ninguna por los apagados', `${f.length} fuentes`);
    for (const h of lista.filter((x) => x.ardiendo)) {
      const src = f.find((x) => cerca(x.x, h.x, 0.05) && cerca(x.z, h.z, 0.05));
      if (!s.ok(!!src, `hay fuente sobre ${h.def.id}`)) continue;
      felizHornos = true;
      s.ok(src.radio === 14, `${h.def.id}: radio 14 m como la brasa de hoy`, src.radio);
      s.ok(src.y >= h.y + 0.3 && src.y <= h.y + 0.9, `${h.def.id}: a la altura de la brasa (+0,6 m)`, (src.y - h.y).toFixed(2));
      const c = src.color || [];
      s.ok(c.length === 3 && c[0] >= c[1] && c[1] >= c[2] && c[0] > 0.5, `${h.def.id}: color de brasa (r ≥ g ≥ b)`, c.map((v) => (+v).toFixed(3)).join(','));
      s.ok(src.intensidad > 0.5 && src.intensidad < 50, `${h.def.id}: intensidad de fuego encendido`, src.intensidad);
    }
    // El latido: la misma fuente varía en el tiempo
    const muestra = [];
    for (let k = 180; k < 300; k++) {
      hornos.actualizar(k / 60);
      const a = (hornos.fuentesDeLuz() || []).find((x) => cerca(x.x, lista[0].x, 0.05) && cerca(x.z, lista[0].z, 0.05));
      if (a) muestra.push(a.intensidad);
    }
    const rango = muestra.length ? Math.max(...muestra) - Math.min(...muestra) : 0;
    s.ok(rango > 0.15, 'la brasa late (la intensidad varía en dos segundos)', `rango ${rango.toFixed(3)} en ${muestra.length} muestras`);
    // Apagar: la fuente se va
    lista[0].ardiendo = false;
    for (let k = 300; k < 600; k++) hornos.actualizar(k / 60);
    const quedo = (hornos.fuentesDeLuz() || []).find((x) => cerca(x.x, lista[0].x, 0.05) && cerca(x.z, lista[0].z, 0.05));
    s.ok(!quedo || quedo.intensidad < 0.05, 'un horno que se apaga deja de alumbrar', quedo ? quedo.intensidad : 'sin fuente');
  }
  s.ok(lucesEn(hornos.grupo).length === 0, 'tampoco aparecen luces después de actualizar y apagar');

  // Clima: un incendio en curso
  const { Clima } = await import(urlSrc('world/Clima.js'));
  const escenaC = new THREE.Scene();
  const clima = new Clima(escenaC, {});
  clima.alturaEn = () => 800;
  const camara = new THREE.PerspectiveCamera(60, 16 / 9, 0.25, 90000);
  camara.position.set(0, 820, 0);
  camara.lookAt(500, 820, 300);
  camara.updateMatrixWorld();
  s.ok(lucesEn(escenaC).length === 0, 'ninguna luz de three en el clima recién construido', lucesEn(escenaC).join(',') || 'ninguna');
  // Primero sin incendio y sin precipitación: las partículas nacen visibles y
  // la primera actualización las apaga. Contar antes de eso compararía contra
  // un número que no significa nada.
  const calma = { direccionViento: 265, vientoKmh: 20, lluvia: 0, nieve: 0, granizo: 0, ceniza: 0, rayos: 0, eventos: [] };
  for (let k = 0; k < 3; k++) clima.actualizar(0.1, calma, camara);
  const visiblesAntes = [];
  escenaC.traverse((o) => { if (o.isMesh && dibujable(o)) visiblesAntes.push(o); });
  const est = {
    ...calma,
    eventos: [{ id: 'incendio_forestal', intensidad: 0.8, x: 500, z: 300, distancia: 583 }],
  };
  for (let k = 0; k < 12; k++) clima.actualizar(0.1, est, camara);
  const visiblesDespues = [];
  escenaC.traverse((o) => { if (o.isMesh && dibujable(o)) visiblesDespues.push(o); });
  const felizClima = visiblesDespues.length > visiblesAntes.length;
  s.ok(felizClima, 'el incendio se dibuja (aparecen mallas visibles de humo)', `${visiblesAntes.length} → ${visiblesDespues.length}`);
  s.ok(lucesEn(escenaC).length === 0, 'ninguna luz de three en el clima con el incendio en curso', lucesEn(escenaC).join(',') || 'ninguna');
  if (typeof clima.fuenteDeLuz === 'function') {
    const f = clima.fuenteDeLuz();
    if (f) {
      s.ok(Number.isFinite(f.x) && Number.isFinite(f.z) && f.radio > 0 && (f.color || []).length === 3 && f.intensidad > 0,
        'clima.fuenteDeLuz() tiene la forma de una fuente', JSON.stringify(f));
      s.ok(Math.hypot(f.x - 500, f.z - 300) < 400, 'la luz del incendio está sobre el incendio', `${f.x},${f.z}`);
    } else s.nota('clima.fuenteDeLuz() existe y devolvió null con el incendio en curso: el incendio se resolvió sin luz');
  } else s.nota('Clima no expone fuenteDeLuz(): el incendio se resolvió sin luz, lo que el contrato admite');

  s.feliz = felizHornos && felizClima && archivos.length > 30;
  s.felizQue = 'hornos con geometría y fuentes sobre los que arden, humo del incendio visible, escáner sobre src/';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 y 3 · EL BLOQUE, ASIGNAR Y ENGANCHAR (mismo proceso: el 3 usa lo que el 2 instala)
// ═══════════════════════════════════════════════════════════════════════════

const IDS_LIB = ['standard', 'physical', 'lambert', 'phong', 'toon'];

async function s2y3() {
  const s = seccion(2, 'EL BLOQUE');
  const t = seccion(3, 'ASIGNAR Y ENGANCHAR');
  const THREE = await import('three');

  // Premisa: three clona los uniformes de ShaderLib al compilar
  const progs = fs.readFileSync(path.join(RAIZ, 'node_modules', 'three', 'src', 'renderers', 'webgl', 'WebGLPrograms.js'), 'utf8');
  s.ok(/UniformsUtils\.clone\(\s*shader\.uniforms\s*\)/.test(progs),
    'premisa: WebGLPrograms clona shader.uniforms con UniformsUtils.clone al compilar');

  const pristinoFrag = THREE.ShaderChunk.lights_fragment_begin;
  const pristinoPars = THREE.ShaderChunk.lights_pars_begin;

  const mod = await import(urlSrc('engine/Luces.js'));
  if (THREE.ShaderChunk.lights_fragment_begin !== pristinoFrag) s.nota('importar Luces.js ya modificó el chunk: instala al importar');
  s.ok(mod.MAX_LUCES === 2, 'MAX_LUCES = 2', mod.MAX_LUCES);
  s.ok(typeof mod.instalarLuces === 'function', 'exporta instalarLuces');
  s.ok(typeof mod.Luces === 'function', 'exporta la clase Luces');
  s.ok(typeof mod.posicionDeMano === 'function', 'exporta posicionDeMano');
  if (typeof mod.instalarLuces !== 'function') { s.felizQue = t.felizQue = 'instalarLuces no existe'; return [s, t]; }

  const luces = mod.instalarLuces(THREE);
  const frag = THREE.ShaderChunk.lights_fragment_begin;
  const pars = THREE.ShaderChunk.lights_pars_begin;

  s.ok(frag.startsWith(pristinoFrag) && frag.length > pristinoFrag.length,
    'el bloque va AL FINAL de lights_fragment_begin y lo que había queda intacto',
    `prístino ${pristinoFrag.length} · ahora ${frag.length}`);
  const bloque = frag.startsWith(pristinoFrag) ? frag.slice(pristinoFrag.length) : '';
  s.ok(pars.includes(pristinoPars) && pars.length > pristinoPars.length, 'lights_pars_begin conserva lo suyo y suma declaraciones');
  const decl = pars.split(pristinoPars).join('\n');

  const tam = (nombre) => {
    const m = decl.match(new RegExp(`uniform\\s+vec4\\s+${nombre}\\s*\\[\\s*([A-Za-z_0-9]+)\\s*\\]\\s*;`));
    if (!m) return null;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    const d = (pars + '\n' + frag).match(new RegExp(`#define\\s+${m[1]}\\s+(\\d+)`));
    return d ? Number(d[1]) : NaN;
  };
  s.ok(tam('uLucesPos') === 2, 'declara uniform vec4 uLucesPos[MAX_LUCES]', tam('uLucesPos'));
  s.ok(tam('uLucesColor') === 2, 'declara uniform vec4 uLucesColor[MAX_LUCES]', tam('uLucesColor'));

  s.ok(/uLucesPos/.test(bloque) && /uLucesColor/.test(bloque), 'el bloque usa los dos uniformes');
  s.ok(/uLucesColor\s*\[\s*0\s*\]\s*\.\s*w/.test(bloque), 'la cantidad se lee de uLucesColor[0].w');
  s.ok(/\bbreak\s*;/.test(bloque), 'el bucle corta por cantidad (break)');
  const caras = bloque.match(/\b(pow|exp|log|log2|sin|cos|tan|atan|acos|asin|texture2D|texture|textureLod|inverse|transpose|determinant)\s*\(/g) || [];
  s.ok(caras.length === 0, 'sin matemática cara ni lecturas de textura por fragmento', caras.join(' ') || 'nada');
  const matrices = bloque.match(/\b(viewMatrix|modelViewMatrix|modelMatrix|cameraPosition|projectionMatrix)\b/g) || [];
  s.ok(matrices.length === 0, 'sin transformar la posición por fragmento: el espacio de vista viene de la CPU', matrices.join(' ') || 'nada');
  const balance = (a, b) => (bloque.split(a).length - 1) === (bloque.split(b).length - 1);
  s.ok(bloque.length > 0 && balance('{', '}') && balance('(', ')') && balance('[', ']'), 'llaves, paréntesis y corchetes balanceados en el bloque');
  s.ok(/reflectedLight\s*\.\s*directDiffuse\s*\+=/.test(bloque), 'suma a reflectedLight.directDiffuse');
  s.ok(/geometryPosition/.test(bloque) && /geometryNormal/.test(bloque), 'usa geometryPosition y geometryNormal');
  s.ok(/geometryPosition/.test(pristinoFrag) && /geometryNormal/.test(pristinoFrag),
    'premisa: three declara geometryPosition y geometryNormal en lights_fragment_begin');

  // Uniformes compartidos
  const P = THREE.ShaderLib.standard.uniforms.uLucesPos?.value;
  const C = THREE.ShaderLib.standard.uniforms.uLucesColor?.value;
  for (const id of IDS_LIB) {
    const u = THREE.ShaderLib[id]?.uniforms;
    s.ok(u?.uLucesPos?.value instanceof Float32Array && u.uLucesPos.value.length >= 8, `ShaderLib.${id}: uLucesPos es Float32Array de 8+`);
    s.ok(u?.uLucesColor?.value instanceof Float32Array && u.uLucesColor.value.length >= 8, `ShaderLib.${id}: uLucesColor es Float32Array de 8+`);
    s.ok(u?.uLucesPos?.value === P && u?.uLucesColor?.value === C, `ShaderLib.${id}: comparte LOS MISMOS arreglos que standard`);
  }
  const clon = THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms);
  const clonL = THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms);
  s.ok(clon.uLucesPos?.value === P && clonL.uLucesPos?.value === P && clon.uLucesColor?.value === C,
    'los arreglos siguen siendo los mismos después del clonado que hace three al compilar');

  // Idempotente
  const luces2 = mod.instalarLuces(THREE);
  s.ok(THREE.ShaderChunk.lights_fragment_begin === frag && THREE.ShaderChunk.lights_pars_begin === pars,
    'instalar dos veces no duplica el bloque ni las declaraciones');
  s.ok(THREE.ShaderLib.standard.uniforms.uLucesPos.value === P && THREE.ShaderLib.lambert.uniforms.uLucesColor.value === C,
    'instalar dos veces no reemplaza los arreglos compartidos');
  s.ok(luces instanceof mod.Luces && luces2 instanceof mod.Luces, 'instalarLuces devuelve una instancia de Luces las dos veces');

  s.feliz = bloque.length > 0 && P instanceof Float32Array && C instanceof Float32Array && clon.uLucesPos?.value === P;
  s.felizQue = 'bloque agregado, arreglos encontrados y compartidos después del clonado';

  // ── 3 ─────────────────────────────────────────────────────────────────────
  if (!(P instanceof Float32Array && C instanceof Float32Array && luces instanceof mod.Luces)) {
    t.felizQue = 'no hay arreglos ni instancia sobre la cual probar';
    return [s, t];
  }
  const render = {};
  const camara = new THREE.PerspectiveCamera(60, 16 / 9, 0.25, 1000);
  camara.position.set(0, 1.6, 0);
  camara.lookAt(0, 1.6, -10);
  camara.updateMatrixWorld();

  // La mano MÁS LEJOS de la cámara que el fuego A (6,6 m contra 5,1). Con la
  // mano a medio metro, como en el juego, quedaría primera por distancia y la
  // prueba de prioridad pasaría aunque la prioridad no existiera.
  const mano = { x: 6.5, y: 1.3, z: -1, radio: 12, color: [1, 0.6, 0.3], intensidad: 2, mano: true };
  const A = { x: 5, y: 0.6, z: 0, radio: 14, color: [1, 0.48, 0.18], intensidad: 3 };
  const B = { x: 30, y: 0.6, z: 0, radio: 14, color: [1, 0.48, 0.18], intensidad: 3 };
  const lejos = { x: 500, y: 0.6, z: 0, radio: 14, color: [1, 0.48, 0.18], intensidad: 3 };
  const cero = { x: 2, y: 0.6, z: 0, radio: 14, color: [1, 0.48, 0.18], intensidad: 0 };
  const enVista = (f, cam) => new THREE.Vector3(f.x, f.y, f.z).applyMatrix4(cam.matrixWorldInverse);

  const escena = new THREE.Scene();
  luces.asignar([B, cero, lejos, A, mano], camara.position);
  t.ok(luces.activas === 2, 'con mano y fuegos elige dos', luces.activas);
  luces.enganchar(escena);
  t.ok(typeof escena.onBeforeRender === 'function' && typeof escena.onAfterRender === 'function', 'enganchar pone onBeforeRender y onAfterRender en la escena');
  escena.onBeforeRender(render, escena, camara, null);
  t.ok(C[3] === 2, 'antes de dibujar, uLucesColor[0].w = 2', C[3]);
  const vm = enVista(mano, camara);
  const manoOk = t.ok(cerca(P[0], vm.x) && cerca(P[1], vm.y) && cerca(P[2], vm.z),
    'la mano va en el lugar 0 aunque venga última, en espacio de vista', `${P[0].toFixed(3)},${P[1].toFixed(3)},${P[2].toFixed(3)} vs ${vm.x.toFixed(3)},${vm.y.toFixed(3)},${vm.z.toFixed(3)}`);
  t.ok(cerca(P[3], 144), 'lugar 0: w = radio² = 144', P[3]);
  t.ok(cerca(C[0], 2) && cerca(C[1], 1.2) && cerca(C[2], 0.6), 'lugar 0: rgb = color × intensidad', `${C[0]},${C[1]},${C[2]}`);
  const va = enVista(A, camara);
  t.ok(cerca(P[4], va.x) && cerca(P[5], va.y) && cerca(P[6], va.z), 'lugar 1: el fuego más cercano con intensidad (no el de intensidad 0)');
  t.ok(cerca(P[7], 196), 'lugar 1: w = 14² = 196', P[7]);
  t.ok(cerca(C[4], 3) && cerca(C[5], 1.44) && cerca(C[6], 0.54), 'lugar 1: rgb = color × intensidad', `${C[4]},${C[5]},${C[6]}`);

  // La cámara del espejo
  const espejo = new THREE.PerspectiveCamera(60, 16 / 9, 0.25, 1000);
  espejo.position.set(3, -1.6, 4);
  espejo.lookAt(-2, -1.6, -10);
  espejo.updateMatrixWorld();
  escena.onBeforeRender(render, escena, espejo, null);
  const ve = enVista(mano, espejo);
  const discrimina = Math.hypot(ve.x - vm.x, ve.y - vm.y, ve.z - vm.z) > 0.5;
  t.ok(discrimina, 'premisa: la cámara del espejo da un espacio de vista distinto de la principal');
  t.ok(cerca(P[0], ve.x) && cerca(P[1], ve.y) && cerca(P[2], ve.z), 'con otra cámara, la posición se escribe en el espacio de vista de ESA cámara');
  escena.onAfterRender(render, escena, espejo);
  t.ok(C[3] === 0, 'después de dibujar, la cantidad vuelve a 0', C[3]);
  escena.onBeforeRender(render, escena, camara, null);
  t.ok(C[3] === 2, 'el siguiente dibujo la repone: la elección persiste', C[3]);

  // Sin mano: por distancia
  luces.asignar([B, A], camara.position);
  escena.onBeforeRender(render, escena, camara, null);
  const vb = enVista(B, camara);
  t.ok(luces.activas === 2 && cerca(P[0], va.x) && cerca(P[4], vb.x), 'sin mano: primero el más cercano', `activas ${luces.activas}`);
  // Tope de radio + 60 m
  const E = { ...A, x: 73 };   // a 73,0 m: dentro de 14 + 60
  const F = { ...A, x: 76 };   // a 76,0 m: fuera
  luces.asignar([F, E], camara.position);
  escena.onBeforeRender(render, escena, camara, null);
  const vE = enVista(E, camara);
  t.ok(luces.activas === 1 && C[3] === 1 && cerca(P[0], vE.x), 'se descarta lo que está a más de radio + 60 m, y no lo que está a menos', `activas ${luces.activas}`);
  // Intensidad 0 no ocupa lugar
  luces.asignar([cero, B], camara.position);
  escena.onBeforeRender(render, escena, camara, null);
  t.ok(luces.activas === 1 && cerca(P[0], vb.x), 'una fuente con intensidad 0 no ocupa lugar', `activas ${luces.activas}`);
  // Nada cerca
  luces.asignar([lejos], camara.position);
  escena.onBeforeRender(render, escena, camara, null);
  t.ok(luces.activas === 0 && C[3] === 0, 'sin fuentes al alcance, cantidad 0', `activas ${luces.activas} · w ${C[3]}`);
  // Más fuentes que lugares
  luces.asignar([B, A, { ...A, x: 8 }, { ...A, x: 12 }, mano], camara.position);
  t.ok(luces.activas === 2, 'nunca más de MAX_LUCES', luces.activas);

  // posicionDeMano
  const salida = new THREE.Vector3();
  const jug = { posicion: new THREE.Vector3(0, 0, 0), giro: 0, cabeceo: 0, tercerPersona: false };
  const r1 = mod.posicionDeMano(jug, camara, salida);
  t.ok(r1 === salida, 'posicionDeMano escribe y devuelve la salida');
  t.ok(salida.distanceTo(camara.position) <= 1.0 && salida.distanceTo(camara.position) > 0.05, 'primera persona: la mano a menos de 1 m de la cámara', salida.distanceTo(camara.position).toFixed(3));
  jug.tercerPersona = true;
  const cam3 = new THREE.PerspectiveCamera();
  cam3.position.set(0, 3, 4); cam3.lookAt(0, 1.2, 0); cam3.updateMatrixWorld();
  mod.posicionDeMano(jug, cam3, salida);
  const hombro = new THREE.Vector3(0, 1.1, 0);
  t.ok(salida.distanceTo(hombro) <= 1.0, 'tercera persona: la mano junto al cuerpo, no junto a la cámara', salida.distanceTo(hombro).toFixed(3));

  t.feliz = manoOk;
  t.felizQue = 'la luz de la mano quedó escrita en el lugar 0 en espacio de vista';
  return [s, t];
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · EQUIPO
// ═══════════════════════════════════════════════════════════════════════════

async function s4() {
  const s = seccion(4, 'EQUIPO');
  const datos = JSON.parse(fs.readFileSync(rutaSrc('data/herramientas.json'), 'utf8'));
  const { Inventario } = await import(urlSrc('systems/Inventario.js'));
  const { Equipo } = await import(urlSrc('systems/Equipo.js'));
  const t0 = Date.UTC(2024, 1, 15, 22, 0, 0);
  const nuevo = () => { const inventario = new Inventario(38); return { inventario, eq: new Equipo(datos, { inventario }) }; };
  for (const m of ['encender', 'apagar', 'luzActiva', 'serializar', 'reponer']) s.ok(typeof Equipo.prototype[m] === 'function', `Equipo.${m}() existe`);
  if (typeof Equipo.prototype.encender !== 'function' || typeof Equipo.prototype.luzActiva !== 'function') {
    s.felizQue = 'faltan encender/luzActiva'; return s;
  }
  let feliz = 0;

  // a) sin fabricar
  { const { eq } = nuevo(); const r = eq.encender('antorcha', t0);
    s.ok(r && r.ok === false && typeof r.motivo === 'string' && r.motivo.length > 0, 'una antorcha no fabricada no enciende, y dice por qué', JSON.stringify(r)); }

  // b) antorcha
  { const { eq } = nuevo(); eq.guardar('antorcha');
    const r = eq.encender('antorcha', t0);
    s.ok(r?.ok === true, 'la antorcha fabricada enciende', JSON.stringify(r));
    s.ok(eq.puesto.mano === 'antorcha', 'y queda en la mano', eq.puesto.mano);
    const L = eq.luzActiva(t0 + 1 * H);
    if (s.ok(L && L.id === 'antorcha' && L.radio === 12 && cerca(L.horasRestantes, 0.5, 0.02),
      'a la hora: antorcha de 12 m con media hora por delante', JSON.stringify(L))) feliz++;
    s.ok(eq.luzActiva(t0 + 1.49 * H) !== null, 'a 1,49 h todavía alumbra');
    s.ok(eq.luzActiva(t0 + 1.5 * H + 1000) === null, 'pasada la hora y media se apagó');
    s.ok(eq.gastado('antorcha') === true, 'y la antorcha quedó gastada (durabilidad 1)', eq.usosDe('antorcha')); }

  // c) candil
  { const { eq } = nuevo(); eq.guardar('candil_grasa');
    const usos0 = eq.usosDe('candil_grasa');
    const r = eq.encender('candil_grasa', t0);
    s.ok(r?.ok === true, 'el candil fabricado enciende', JSON.stringify(r));
    s.ok(eq.puesto.mano === 'candil_grasa', 'y queda en la mano', eq.puesto.mano);
    const L = eq.luzActiva(t0 + 5 * H);
    if (s.ok(L && L.id === 'candil_grasa' && L.radio === 6 && cerca(L.horasRestantes, 1, 0.02), 'a las 5 h: candil de 6 m con una hora por delante', JSON.stringify(L))) feliz++;
    s.ok(eq.luzActiva(t0 + 6 * H + 1000) === null, 'pasadas las 6 h se apagó');
    s.ok(eq.usosDe('candil_grasa') === usos0 - 1 && !eq.gastado('candil_grasa'), 'el candil perdió un uso y sigue sano', `${usos0} → ${eq.usosDe('candil_grasa')}`); }

  // d) velas
  { const { eq, inventario } = nuevo();
    const r0 = eq.encender('velas_cera', t0);
    s.ok(r0 && r0.ok === false, 'sin velas en el bolso no se enciende ninguna', JSON.stringify(r0));
    const entro = inventario.agregar('vela', 2);
    s.ok(entro === 2, 'premisa: el inventario acepta velas', entro);
    const r = eq.encender('velas_cera', t0);
    s.ok(r?.ok === true, 'con velas en el bolso se enciende una', JSON.stringify(r));
    s.ok(inventario.disponiblePara('vela') === 1, 'y se consume una vela', inventario.disponiblePara('vela'));
    const L = eq.luzActiva(t0 + 4 * H);
    if (s.ok(L && L.radio === 8 && cerca(L.horasRestantes, 1, 0.02), 'a las 4 h: vela de 8 m con una hora por delante', JSON.stringify(L))) feliz++;
    s.ok(eq.luzActiva(t0 + 5 * H + 1000) === null, 'pasadas las 5 h se apagó'); }

  // e) cambiar la mano apaga
  { const { eq } = nuevo(); eq.guardar('antorcha'); eq.guardar('hacha_piedra');
    eq.encender('antorcha', t0);
    s.ok(eq.luzActiva(t0 + 0.1 * H) !== null, 'premisa: la antorcha alumbra antes de cambiar la mano');
    eq.equipar('hacha_piedra');
    s.ok(eq.luzActiva(t0 + 0.2 * H) === null, 'poner el hacha en la mano apaga la antorcha', eq.puesto.mano); }
  { const { eq } = nuevo(); eq.guardar('antorcha'); eq.encender('antorcha', t0);
    eq.desequipar('mano');
    s.ok(eq.luzActiva(t0 + 0.1 * H) === null, 'vaciar la mano apaga la antorcha'); }

  // f) apagar
  { const { eq } = nuevo(); eq.guardar('candil_grasa'); eq.encender('candil_grasa', t0);
    eq.apagar();
    s.ok(eq.luzActiva(t0 + 0.1 * H) === null, 'apagar() apaga'); }

  // g) lluvia, si la ficha lo afirma
  const nota = datos.objetos.find((o) => o.id === 'antorcha')?.nota || '';
  if (/lluvia/i.test(nota)) {
    const { eq } = nuevo(); eq.guardar('antorcha'); eq.encender('antorcha', t0);
    s.ok(eq.luzActiva(t0 + 0.1 * H, { lluvia: 0.2 }) !== null, 'la ficha dice lluvia fuerte: con lluvia 0,2 sigue ardiendo');
    s.ok(eq.luzActiva(t0 + 0.2 * H, { lluvia: 0.8 }) === null, 'la ficha dice lluvia fuerte: con lluvia 0,8 se apaga');
    s.ok(eq.luzActiva(t0 + 0.3 * H, { lluvia: 0 }) === null, 'apagada por la lluvia no se vuelve a prender sola');
  } else s.nota('la ficha de la antorcha ya no afirma que la apague la lluvia: no se prueba');

  // h) ida y vuelta
  { const { eq } = nuevo();
    eq.guardar('candil_grasa'); eq.encender('candil_grasa', t0); eq.luzActiva(t0 + 6 * H + 1000);
    const t1 = t0 + 7 * H;
    eq.guardar('antorcha'); eq.encender('antorcha', t1);
    const d = JSON.parse(JSON.stringify(eq.serializar()));
    const otro = new Equipo(datos, { inventario: new Inventario(38) });
    otro.reponer(d);
    s.ok(otro.tiene('antorcha') && otro.tiene('candil_grasa'), 'reponer conserva lo fabricado');
    s.ok(otro.puesto.mano === 'antorcha', 'reponer conserva lo que está en la mano', otro.puesto.mano);
    s.ok(otro.usosDe('candil_grasa') === eq.usosDe('candil_grasa'), 'reponer conserva los usos', `${eq.usosDe('candil_grasa')} → ${otro.usosDe('candil_grasa')}`);
    const L = otro.luzActiva(t1 + 1 * H);
    if (s.ok(L && L.radio === 12 && cerca(L.horasRestantes, 0.5, 0.02), 'reponer conserva la llama con su reloj del mundo', JSON.stringify(L))) feliz++;
    s.ok(otro.luzActiva(t1 + 2 * H) === null, 'y la llama repuesta se apaga cuando le toca'); }

  // i) partidas viejas
  for (const v of [undefined, null, {}]) {
    let tiro = null;
    try { nuevo().eq.reponer(v); } catch (e) { tiro = e.message; }
    s.ok(tiro === null, `reponer(${JSON.stringify(v)}) no tira`, tiro || 'ok');
  }

  s.feliz = feliz === 4;
  s.felizQue = `las cuatro luces esperadas se prendieron de verdad (${feliz}/4)`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · EXPLORACIÓN
// ═══════════════════════════════════════════════════════════════════════════

async function s5() {
  const s = seccion(5, 'EXPLORACIÓN');
  instalarDom();
  const { Exploracion } = await import(urlSrc('systems/Exploracion.js'));
  let altura = 100;
  const mundo = { tamano: 65536, mitad: 32768, alturaEn: () => altura };
  const e = new Exploracion(mundo);
  const pos = { x: 0, y: 100, z: 0 };
  const noche = { horaDecimal: 23, densidadNiebla: 0 };
  const dia = { horaDecimal: 12, densidadNiebla: 0 };
  s.ok(e.alcanceVisual(pos, dia, 0) === 380, 'premisa: de día sin prominencia da los 380 m de base', e.alcanceVisual(pos, dia, 0));
  s.ok(e.alcanceVisual(pos, noche, 0) === 120, 'de noche sin luz: 120 m', e.alcanceVisual(pos, noche, 0));
  const conLuz = e.alcanceVisual(pos, noche, 12);
  s.ok(conLuz === 220, 'de noche con luz: 220 m', conLuz);
  s.ok(e.alcanceVisual(pos, dia, 12) === 380, 'de día la luz no cambia nada', e.alcanceVisual(pos, dia, 12));
  s.ok(e.alcanceVisual(pos, { horaDecimal: 5, densidadNiebla: 0 }, 0) === 120, 'a las 5 de la madrugada también es noche');
  s.ok(e.alcanceVisual(pos, { horaDecimal: 21, densidadNiebla: 0 }, 6) === 220, 'a las 21 con un candil: 220');
  e.luzM = 6;
  s.ok(e.alcanceVisual(pos, noche) === 220, 'sin tercer argumento lee this.luzM (con luz)', e.alcanceVisual(pos, noche));
  e.luzM = 0;
  s.ok(e.alcanceVisual(pos, noche) === 120, 'sin tercer argumento lee this.luzM (sin luz)', e.alcanceVisual(pos, noche));
  altura = 0; const alto = { x: 0, y: 400, z: 0 };
  s.ok(e.alcanceVisual(alto, noche, 12) === 220 && e.alcanceVisual(alto, noche, 0) === 120, 'en un mirador de noche, los mismos topes');
  s.ok(e.alcanceVisual(alto, dia, 0) > 1000, 'premisa: en un mirador de día se ve lejos', e.alcanceVisual(alto, dia, 0));
  // El camino feliz es la DIFERENCIA, no el 220: la base ya daba 220 de noche
  // sin saber nada de luces, y una guarda que pregunta sólo por el 220 pasa por
  // el motivo equivocado. Lo encontró la corrida de este banco contra b04a424.
  const sinLuz = e.alcanceVisual(pos, noche, 0);
  s.feliz = conLuz === 220 && sinLuz === 120;
  s.felizQue = `de noche la luz cambia el alcance (con ${conLuz}, sin ${sinLuz})`;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · PARTIDA
// ═══════════════════════════════════════════════════════════════════════════

async function s6() {
  const s = seccion(6, 'PARTIDA');
  instalarDom();
  const THREE = await import('three');
  const texto = fs.readFileSync(rutaSrc('systems/Partida.js'), 'utf8');
  s.ok(/const\s+VERSION\s*=\s*1\s*;/.test(texto), 'VERSION sigue en 1');
  const datos = JSON.parse(fs.readFileSync(rutaSrc('data/herramientas.json'), 'utf8'));
  const { Inventario } = await import(urlSrc('systems/Inventario.js'));
  const { Equipo } = await import(urlSrc('systems/Equipo.js'));
  const { Partida } = await import(urlSrc('systems/Partida.js'));
  const t1 = Date.UTC(2024, 5, 20, 21, 30, 0);

  const deps = (tiempoMs, equipo) => ({
    jugador: { posicion: new THREE.Vector3(1, 2, 3), giro: 0, salud: 100, energia: 100, hambre: 85, sed: 85, temperatura: 36.6, horasVividas: 0 },
    inventario: new Inventario(38),
    saberes: { puntos: 0, ganadosTotales: 0, desbloqueadas: new Set() },
    codice: { descubiertas: new Set(), identificadas: new Set(), lugares: new Set() },
    construccion: { obras: [], catalogo: [] },
    fundicion: { hornos: [] },
    tiempo: { fecha: new Date(tiempoMs) },
    mundo: {}, hud: { aviso() {} }, exploracion: { guardar() {} }, recoleccion: {},
    obras: { agregar() {} }, hornos: { agregar() {} },
    ...(equipo ? { equipo } : {}),
  });

  const eqA = new Equipo(datos, { inventario: new Inventario(38) });
  eqA.guardar('antorcha');
  eqA.encender?.('antorcha', t1);
  const pA = new Partida(deps(t1, eqA));
  pA.guardar();
  const crudo = localStorage.getItem('survibar.partida.v1');
  s.ok(!!crudo, 'premisa: guardar() escribió la partida');
  const guardada = crudo ? JSON.parse(crudo) : {};

  const eqB = new Equipo(datos, { inventario: new Inventario(38) });
  const depsB = deps(Date.UTC(2030, 0, 1), eqB);
  const relojEnReponer = [];
  if (typeof eqB.reponer === 'function') {
    const orig = eqB.reponer.bind(eqB);
    eqB.reponer = (d) => { relojEnReponer.push(depsB.tiempo.fecha.getTime()); return orig(d); };
  }
  const pB = new Partida(depsB);
  let cargo = false, tiro = null;
  try { cargo = pB.cargar(); } catch (e) { tiro = e.message; }
  s.ok(cargo === true && tiro === null, 'la partida carga', tiro || cargo);
  s.ok(relojEnReponer.length >= 1, 'cargar() llama a equipo.reponer()', relojEnReponer.length);
  s.ok(relojEnReponer.length >= 1 && relojEnReponer.every((ms) => ms === t1), 'y lo llama con el reloj del mundo ya repuesto', relojEnReponer.map((ms) => new Date(ms).toISOString()).join(' · '));
  s.ok(eqB.tiene('antorcha') && eqB.puesto.mano === 'antorcha', 'el equipo sobrevive a cerrar la pestaña', eqB.puesto.mano);
  const L = eqB.luzActiva?.(t1 + 0.5 * H);
  const felizLlama = s.ok(L && L.radio === 12 && cerca(L.horasRestantes, 1, 0.02), 'y la antorcha sigue ardiendo con su reloj', JSON.stringify(L));

  // Partida vieja, sin campo de equipo
  const vieja = { ...guardada };
  for (const k of Object.keys(vieja)) {
    const v = JSON.stringify(vieja[k]);
    if (v && v.includes('antorcha')) delete vieja[k];
  }
  s.ok(!JSON.stringify(vieja).includes('antorcha'), 'premisa: la partida vieja no tiene rastro del equipo');
  localStorage.setItem('survibar.partida.v1', JSON.stringify(vieja));
  const eqC = new Equipo(datos, { inventario: new Inventario(38) });
  const pC = new Partida(deps(Date.UTC(2030, 0, 1), eqC));
  let cargoC = false; tiro = null;
  try { cargoC = pC.cargar(); } catch (e) { tiro = e.message; }
  s.ok(cargoC === true && tiro === null, 'una partida vieja sin equipo carga igual', tiro || cargoC);
  s.ok(eqC.listar().length === 0, 'y deja el equipo vacío', eqC.listar().length);
  // Cableado viejo, sin equipo en las dependencias
  localStorage.setItem('survibar.partida.v1', crudo);
  const pD = new Partida(deps(Date.UTC(2030, 0, 1), null));
  let cargoD = false; tiro = null;
  try { cargoD = pD.cargar(); } catch (e) { tiro = e.message; }
  s.ok(cargoD === true && tiro === null, 'sin equipo en las dependencias, cargar() no tira', tiro || cargoD);

  s.feliz = !!felizLlama;
  s.felizQue = 'la antorcha guardada volvió a arder después de cargar';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · DATOS
// ═══════════════════════════════════════════════════════════════════════════

async function s7() {
  const s = seccion(7, 'DATOS');
  const texto = fs.readFileSync(rutaSrc('data/herramientas.json'), 'utf8');
  let d = null;
  try { d = JSON.parse(texto); } catch (e) { s.ok(false, 'herramientas.json es JSON válido', e.message); return s; }
  s.ok(true, 'herramientas.json es JSON válido');
  s.ok(!/ninguna luz puntual/i.test(texto), 'la frase falsa «ninguna luz puntual» no está en ningún lado del archivo');
  const lic = d.licenciasDeJuego?.licencias || [];
  const deLuz = lic.find((l) => { const j = JSON.stringify(l); return /(luz|antorcha|candil)/i.test(j) && /(noche|nocturn)/i.test(j); });
  s.ok(!!deLuz, 'licenciasDeJuego declara la del alcance nocturno con luz', deLuz?.id || 'no está');
  if (deLuz) s.ok(['que', 'laNormaReal', 'porQueSeToma', 'comoLoDiceElJuego'].every((k) => typeof deLuz[k] === 'string' && deLuz[k].length > 20),
    'con los cuatro campos que tienen las otras licencias', Object.keys(deLuz).join(','));
  const obj = (id) => d.objetos.find((o) => o.id === id);
  s.ok(obj('antorcha')?.efecto?.luz === 12 && obj('antorcha')?.efecto?.duracionHoras === 1.5, 'antorcha: 12 m y 1,5 h, sin tocar');
  s.ok(obj('candil_grasa')?.efecto?.luz === 6 && obj('candil_grasa')?.efecto?.duracionHoras === 6, 'candil: 6 m y 6 h, sin tocar');
  s.ok(obj('velas_cera')?.efecto?.luz === 8 && obj('velas_cera')?.efecto?.duracionHoras === 5, 'velas: 8 m y 5 h, sin tocar');
  s.feliz = !!d && !!obj('antorcha');
  s.felizQue = 'el archivo se leyó y tiene las fichas';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function s8() {
  const s = seccion(8, 'ARRANQUE');
  if (process.env.BANCO_SIN_BUILD) { s.nota('vite build salteado (BANCO_SIN_BUILD)'); s.feliz = true; s.felizQue = 'salteado a pedido'; return s; }
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', path.join(AQUI, '.tmp-banco-r5f1-dist'), '--emptyOutDir'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 300000, shell: process.platform === 'win32' });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.ok(r.status === 0, 'vite build pasa', r.status === 0 ? (salida.match(/built in [^\n]+/)?.[0] || 'ok') : salida.slice(-800));
  try { fs.rmSync(path.join(AQUI, '.tmp-banco-r5f1-dist'), { recursive: true, force: true }); } catch { /* da igual */ }
  s.feliz = r.status === 0;
  s.felizQue = 'el bundle se construyó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// Orquestación
// ═══════════════════════════════════════════════════════════════════════════

const SECCIONES = { s1, s2y3, s4, s5, s6, s7, s8 };

async function hijo(nombre) {
  let res;
  try {
    const r = await SECCIONES[nombre]();
    res = Array.isArray(r) ? r : [r];
  } catch (e) {
    const num = { s1: 1, s2y3: 2, s4: 4, s5: 5, s6: 6, s7: 7, s8: 8 }[nombre];
    const s = seccion(num, `sección ${nombre}`);
    s.ok(false, 'la sección corrió sin excepción', `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`);
    res = [s];
    if (nombre === 's2y3') { const t = seccion(3, 'ASIGNAR Y ENGANCHAR'); t.ok(false, 'no llegó a correr', e.message); res.push(t); }
  }
  const limpio = res.map(({ ok, nota, ...x }) => x);
  process.stdout.write(`\n@@RESULTADO ${JSON.stringify(limpio)}\n`);
}

function padre() {
  console.log(`BANCO R5 · FASE 1 (lumbre)   src = ${path.relative(RAIZ, SRC) || SRC}\n`);
  const todas = [];
  for (const nombre of Object.keys(SECCIONES)) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--seccion', nombre],
      { cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: process.env });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/@@RESULTADO (.+)\n?$/m);
    if (!m) {
      const num = { s1: 1, s2y3: 2, s4: 4, s5: 5, s6: 6, s7: 7, s8: 8 }[nombre];
      todas.push({ num, nombre: `sección ${nombre}`, checks: [{ ok: false, desc: 'el proceso devolvió resultado', detalle: salida.slice(-1200) }], feliz: false, felizQue: 'el proceso murió', notas: [] });
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
    for (const c of s.checks) {
      if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined ? `  [${c.detalle}]` : ''}`);
    }
    if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
    for (const n of s.notas) console.log(`         nota ${n}`);
  }
  const feliz = todas.every((s) => s.feliz);
  console.log(`\n  ${feliz ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length} secciones)`);
  console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}`);
  process.exitCode = verdes === todas.length ? 0 : 1;
}

const i = process.argv.indexOf('--seccion');
if (i > 0) await hijo(process.argv[i + 1]);
else padre();
