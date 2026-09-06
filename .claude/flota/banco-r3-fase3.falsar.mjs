/**
 * FALSADOR DEL BANCO DE LA FASE 3 — ronda 3.
 *
 * Un banco que nunca se puso rojo no vale más que el informe de su autor. Acá se
 * le plantan defectos que sabemos que existen y se comprueba que los ve.
 *
 * El primer defecto NO es sintético: es el `Vegetacion.js` real de la línea de
 * base, el que cerró la fase 2. Contra él los bancos 1 y 2 tienen que ponerse
 * rojos, porque ni la corteza ni el follaje multicapa están hechos ahí. Es la
 * lección de la trampa nº 3 de ESTADO.md: un banco sintético mide bien nueve
 * defectos y es ciego al décimo, así que conviene falsar también contra el
 * mundo real.
 *
 * ── Tres desenlaces, no dos ──────────────────────────────────────────────────
 * Un defecto que NO se pudo plantar no demuestra nada, y hacerlo pasar por
 * demostración es exactamente cómo se llega a un verde falso. La fase 2 pagó
 * esa confusión: un informe que mezclaba «zona sin falsar» con «punto ciego»
 * hacía parecer ciego a un banco sano. Por eso acá hay tres desenlaces:
 *   · `lo vio`             — se plantó y el banco se puso rojo. Es la prueba.
 *   · `NO lo vio`          — se plantó y el banco siguió verde. Punto ciego.
 *   · `no se pudo plantar` — el ancla no enganchó. Zona del banco sin falsar.
 * El proceso sale con código distinto de cero en los dos últimos.
 *
 * ── Cómo se plantan ──────────────────────────────────────────────────────────
 * Dos técnicas, y la segunda es la que aguanta que `flora` reescriba el archivo:
 *   1. **Ancla textual con alternativas.** Se prueban varias expresiones y se
 *      usa la primera que enganche Y que además cambie el texto. Devolver el
 *      mismo texto es «no se pudo plantar», no un verde.
 *   2. **Parche sobre `three` o sobre el DOM**, inyectado justo después del
 *      `import * as THREE from 'three'`. Muerde sea cual sea la forma en que
 *      esté escrita la función atacada: el objeto de espacio de nombres de un
 *      módulo ESM es inmutable, pero los prototipos que expone no lo son.
 *
 * Uso:  node .claude/flota/banco-r3-fase3.falsar.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r3-fase3.mjs');
const VEG = path.join(RAIZ, 'src', 'world', 'Vegetacion.js');
const SOTO = path.join(RAIZ, 'src', 'world', 'Sotobosque.js');
const TMP = path.join(AQUI, '.tmp-falsar-fase3');
const BASE_COMMIT = process.env.BANCO_BASE || 'dea7689';

// ═══════════════════════════════════════════════════════════════════════════
// Correr el banco y leerle el resumen
// ═══════════════════════════════════════════════════════════════════════════

function correrBanco(rutaVeg, rutaSoto) {
  let salida;
  try {
    salida = execFileSync(process.execPath, [BANCO], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, BANCO_VEGETACION: rutaVeg, BANCO_SOTOBOSQUE: rutaSoto },
    });
  } catch (e) { salida = String(e.stdout || '') + String(e.stderr || ''); }

  const estado = new Map();   // nº de banco -> verde?
  for (const l of salida.split('\n')) {
    const m = l.match(/^\s{2}(VERDE|ROJO)\s+ejercitó\s+\d+\s+(\d)\s·/);
    if (m) estado.set(Number(m[2]), m[1] === 'VERDE');
  }
  const feliz = /^\s{2}VERDE\s+guarda del camino feliz/m.test(salida);
  return { estado, feliz, salida };
}

/** Aplica la PRIMERA alternativa que enganche y que además cambie el texto. */
function plantarAlguna(texto, alternativas) {
  for (const [re, rep] of alternativas) {
    re.lastIndex = 0;
    if (!re.test(texto)) continue;
    re.lastIndex = 0;
    const p = texto.replace(re, rep);
    if (p !== texto) return p;
  }
  return null;
}

function copiaConDefecto(nombre, alternativas, fuente) {
  const t = fs.readFileSync(fuente, 'utf8');
  const p = plantarAlguna(t, alternativas);
  if (p === null) return null;
  const destino = path.join(TMP, nombre);
  fs.writeFileSync(destino, p);
  return destino;
}

/**
 * Inyecta código justo después del import de three. Es el ancla más estable que
 * hay: ninguno de los dos archivos puede dejar de importar three.
 */
function copiaConInyeccion(nombre, codigo, fuente) {
  return copiaConDefecto(nombre, [
    [/import \* as THREE from ['"]three['"];/, (m) => m + '\n' + codigo],
    [/^(import[^\n]*from ['"]three['"];)/m, (m) => m + '\n' + codigo],
  ], fuente);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOS DEFECTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cada entrada: qué se planta, sobre qué archivo, y qué bancos TIENEN que
 * ponerse rojos. Si alguno de esos bancos sigue verde, es un punto ciego.
 */
function defectos() {
  fs.mkdirSync(TMP, { recursive: true });

  // La línea de base real, extraída del repo: no es un defecto sintético.
  const baseVeg = path.join(TMP, 'base-Vegetacion.js');
  const baseSoto = path.join(TMP, 'base-Sotobosque.js');
  fs.writeFileSync(baseVeg, execFileSync('git', ['show', BASE_COMMIT + ':src/world/Vegetacion.js'],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  fs.writeFileSync(baseSoto, execFileSync('git', ['show', BASE_COMMIT + ':src/world/Sotobosque.js'],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));

  const D = [];

  D.push({
    id: 'D1', que: 'el archivo REAL de ' + BASE_COMMIT + ' (sin corteza y sin capas de follaje)',
    veg: baseVeg, soto: baseSoto, esperaRojo: [1, 2], sintetico: false,
  });

  // ── Banco 1 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D2', que: 'la zona del atlas donde cae la madera queda transparente (se anula fillRect)',
    veg: copiaConInyeccion('D2-Vegetacion.js', `
{ const _ce = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = (t) => { const c = _ce(t);
    if (t === 'canvas') { const _gc = c.getContext.bind(c);
      c.getContext = (k) => { const x = _gc(k); if (x) x.fillRect = () => {}; return x; }; }
    return c; }; }`, VEG),
    soto: SOTO, esperaRojo: [1],
  });

  D.push({
    id: 'D3', que: 'la madera vuelve a muestrear un solo texel (toda la UV al mismo punto)',
    veg: copiaConInyeccion('D3-Vegetacion.js', `
{ const _sa = THREE.BufferGeometry.prototype.setAttribute;
  THREE.BufferGeometry.prototype.setAttribute = function (n, a) {
    if (n === 'uv' && a && a.array && a.itemSize === 2) {
      for (let i = 0; i < a.array.length; i += 2) { a.array[i] = 0.95; a.array[i + 1] = 0.05; }
    }
    return _sa.call(this, n, a); }; }`, VEG),
    soto: SOTO, esperaRojo: [1],
  });

  // ── Banco 2 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D4', que: 'el atlas de follaje deja de cachearse: una textura por especie',
    veg: copiaConDefecto('D4-Vegetacion.js', [
      [/_atlasCache\.set\([^)]*\);/, ''],
      [/if \(_atlasCache\.has\(([^)]*)\)\) return _atlasCache\.get\([^)]*\);/, 'if (false) return null;'],
      [/const _atlasCache = new Map\(\);/, 'const _atlasCache = { has: () => false, get: () => null, set: () => {} };'],
    ], VEG),
    soto: SOTO, esperaRojo: [2],
  });

  D.push({
    id: 'D5', que: 'el atlas se pinta con una operación que el rasterizador no implementa (drawImage)',
    veg: copiaConInyeccion('D5-Vegetacion.js', `
{ const _ce = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = (t) => { const c = _ce(t);
    if (t === 'canvas') { const _gc = c.getContext.bind(c);
      c.getContext = (k) => { const x = _gc(k); if (x && x.drawImage) x.drawImage(c, 0, 0); return x; }; }
    return c; }; }`, VEG),
    soto: SOTO, esperaRojo: [2],
  });

  D.push({
    id: 'D6', que: 'el follaje pierde capas: se saltea una de cada dos primitivas del atlas',
    veg: copiaConInyeccion('D6-Vegetacion.js', `
{ const _ce = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = (t) => { const c = _ce(t);
    if (t === 'canvas') { const _gc = c.getContext.bind(c);
      c.getContext = (k) => { const x = _gc(k); if (!x) return x;
        let n = 0; const f = x.fill.bind(x), s = x.stroke.bind(x);
        x.fill = () => { if (n++ % 2 === 0) f(); };
        x.stroke = () => { if (n++ % 2 === 0) s(); };
        return x; }; }
    return c; }; }`, VEG),
    soto: SOTO, esperaRojo: [2],
  });

  // ── Banco 3 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D7', que: 'el atlas de impostores duplica su rejilla (4×4 → 8×8): +180 MiB de VRAM',
    veg: copiaConDefecto('D7-Vegetacion.js', [
      [/const COLS = 4, FILAS = 4;/, 'const COLS = 8, FILAS = 8;'],
      [/const COLS = (\d+), FILAS = (\d+);/, (m, a, b) => 'const COLS = ' + (a * 2) + ', FILAS = ' + (b * 2) + ';'],
      [/anchoTeja = (\d+), altoTeja = (\d+)/, (m, a, b) => 'anchoTeja = ' + (a * 2) + ', altoTeja = ' + (b * 2)],
    ], VEG),
    soto: SOTO, esperaRojo: [3],
  });

  /**
   * El ahorro grande de la fase, deshecho: cada horno vuelve a tener su propio
   * búfer de profundidad.
   *
   * Técnica 2, y acá hace falta de verdad. `THREE.WebGLRenderTarget` es una
   * clase sobre el objeto de espacio de nombres, que es inmutable: no se la
   * puede envolver. Pero su prototipo sí, y el constructor asigna
   * `this.depthTexture = options.depthTexture`. Un accesor en el prototipo que
   * se trague la escritura y devuelva `null` deja a los 30 objetivos sin
   * textura compartida, sea cual sea la forma en que `flora` la haya pasado
   * —en el descriptor o después—, y three vuelve a crear un renderbuffer por
   * objetivo.
   *
   * Si el ancla no engancha porque la profundidad todavía NO se comparte, el
   * falsador lo informa como «no se pudo plantar», que es lo honesto: es una
   * zona sin falsar, no una demostración.
   */
  D.push({
    id: 'D7b', que: 'se deshace la profundidad compartida: un búfer por horno otra vez (+43,5 MiB)',
    veg: copiaConInyeccion('D7b-Vegetacion.js', `
{ const _p = THREE.RenderTarget && THREE.RenderTarget.prototype;
  if (_p) Object.defineProperty(_p, 'depthTexture', {
    configurable: true, get() { return null; }, set(_v) { /* se la traga */ } }); }`, VEG),
    soto: SOTO, esperaRojo: [3],
  });

  // ── Banco 4 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D8', que: 'una potencia más por fragmento en el shader de la cartelera',
    veg: copiaConDefecto('D8-Vegetacion.js', [
      [/gl_FragColor = vec4\(color, 1\.0\);/, 'color = pow(color, vec3(1.02));\n  gl_FragColor = vec4(color, 1.0);'],
      [/(const FRAG_IMPOSTOR = \/\* glsl \*\/`[\s\S]*?)void main\(\) \{/,
       (m, a) => a + 'void main() {\n  float _f = pow(vDist, 1.01);'],
    ], VEG),
    soto: SOTO, esperaRojo: [4],
  });

  D.push({
    id: 'D9', que: 'un mapa más ligado al material del árbol: una lectura de textura más por fragmento',
    veg: copiaConInyeccion('D9-Vegetacion.js', `
{ const _sv = THREE.MeshLambertMaterial.prototype.setValues;
  THREE.MeshLambertMaterial.prototype.setValues = function (v) {
    _sv.call(this, v); if (v && v.map) this.aoMap = v.map; }; }`, VEG),
    soto: SOTO, esperaRojo: [4],
  });

  D.push({
    id: 'D10', que: 'el tope de mallas completas por especie al doble (600 → 1200)',
    veg: copiaConDefecto('D10-Vegetacion.js', [
      [/const MAX_POR_ESPECIE = (\d+);/, (m, n) => 'const MAX_POR_ESPECIE = ' + n * 2 + ';'],
      [/const CUPO_ESPECIES = (\d+);/, (m, n) => 'const CUPO_ESPECIES = ' + (Number(n) + 4) + ';'],
    ], VEG),
    soto: SOTO, esperaRojo: [4],
  });

  // ── Banco 5 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D11', que: 'el sotobosque vuelve a pagar una lectura de textura por fragmento',
    veg: VEG,
    soto: copiaConInyeccion('D11-Sotobosque.js', `
{ const _tex = new THREE.Texture();
  const _sv = THREE.MeshLambertMaterial.prototype.setValues;
  THREE.MeshLambertMaterial.prototype.setValues = function (v) { _sv.call(this, v); this.map = _tex; }; }`, SOTO),
    esperaRojo: [5],
  });

  D.push({
    id: 'D12', que: 'el sotobosque vuelve a proyectar sombra (cuatro dibujos más por lote)',
    soto: copiaConDefecto('D12-Sotobosque.js', [
      [/malla\.castShadow = false;/, 'malla.castShadow = true;'],
      [/castShadow = false/, 'castShadow = true'],
    ], SOTO),
    veg: VEG, esperaRojo: [5],
  });

  // ── Banco 6 ───────────────────────────────────────────────────────────
  D.push({
    id: 'D13', que: 'un import estático de la salida del horneador (rompe el build si falta el archivo)',
    veg: copiaConDefecto('D13-Vegetacion.js', [
      [/^(import \* as THREE from ['"]three['"];)/m,
       (m) => m + "\nimport _manifiesto from '../../public/tex/manifiesto.json';\nconst _usar = _manifiesto;"],
    ], VEG),
    soto: SOTO, esperaRojo: [6],
  });

  D.push({
    id: 'D14', que: 'la vegetación deja de arrancar sin renderizador (se cae el horneado)',
    veg: copiaConDefecto('D14-Vegetacion.js', [
      [/this\.render \? this\._crearImpostor\(([^;]*?)\) : null/, 'this._crearImpostor($1)'],
      [/const impostor = this\.render \?/, 'const impostor = true ?'],
    ], VEG),
    soto: SOTO, esperaRojo: [6],
  });

  return D;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDA
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log('FALSADOR DEL BANCO DE LA FASE 3 · ronda 3 · SurviBar');
  console.log(new Date().toISOString());
  console.log('');
  console.log('Primero, el control: el banco contra el árbol de trabajo tal como está.');
  const control = correrBanco(VEG, SOTO);
  const verdes = [...control.estado.entries()].filter(([, v]) => v).map(([k]) => k);
  console.log('  camino feliz: ' + (control.feliz ? 'VERDE' : 'ROJO') +
    ' · bancos en verde: ' + (verdes.length ? verdes.join(', ') : 'ninguno'));
  if (!control.feliz) {
    console.log('  >>> el control no llegó a ejercitar el camino feliz. Los resultados de abajo');
    console.log('      no distinguen «el banco vio el defecto» de «el banco no midió nada».');
  }
  console.log('');

  const D = defectos();
  const vio = [], noVio = [], noPlantados = [];

  for (const d of D) {
    process.stdout.write((d.id + ' · ' + d.que).padEnd(94, ' ').slice(0, 94) + ' … ');
    if (!d.veg || !d.soto) {
      console.log('NO SE PUDO PLANTAR (el ancla no enganchó)');
      noPlantados.push(d);
      continue;
    }
    // Un banco que YA estaba rojo en el control no demuestra nada al ponerse
    // rojo con el defecto: habría dado rojo igual sin plantar nada. Es el mismo
    // error de razonamiento que la trampa nº 8 —confundir «dio rojo» con «vio
    // el defecto»— del otro lado del espejo. Se descuentan antes de juzgar.
    const yaRojos = d.esperaRojo.filter(n => control.estado.get(n) === false);
    const juzgables = d.esperaRojo.filter(n => control.estado.get(n) === true);
    if (yaRojos.length && !juzgables.length) {
      console.log('NO SE PUDO PLANTAR (banco ' + yaRojos.join(', ') + ' ya estaba rojo en el control)');
      noPlantados.push({ ...d, que: d.que + '  [el banco ya estaba rojo antes de plantarlo]' });
      continue;
    }

    const r = correrBanco(d.veg, d.soto);
    const fallaron = juzgables.filter(n => r.estado.get(n) === false);
    const siguenVerdes = juzgables.filter(n => r.estado.get(n) === true);
    const noCorrieron = juzgables.filter(n => !r.estado.has(n));

    if (noCorrieron.length === juzgables.length && !r.feliz) {
      // El defecto tumbó el camino feliz: eso también es verlo, pero conviene
      // decirlo distinto, porque el banco se puso rojo por otro motivo.
      console.log('LO VIO (por la guarda del camino feliz)');
      vio.push({ ...d, via: 'guarda', probados: juzgables });
    } else if (fallaron.length) {
      console.log('LO VIO (rojo en ' + fallaron.join(', ') +
        (siguenVerdes.length ? '; pero ' + siguenVerdes.join(', ') + ' siguió verde' : '') +
        (yaRojos.length ? '; ' + yaRojos.join(', ') + ' no cuenta: ya estaba rojo' : '') + ')');
      if (siguenVerdes.length) noVio.push({ ...d, parcial: siguenVerdes, probados: fallaron });
      else vio.push({ ...d, probados: fallaron });
    } else {
      console.log('*** NO LO VIO *** (' + juzgables.join(', ') + ' siguió verde)');
      noVio.push({ ...d, probados: [] });
    }
  }

  console.log('');
  console.log('═'.repeat(78));
  console.log('RESULTADO DEL FALSADOR');
  console.log('═'.repeat(78));
  console.log('  defectos plantados y VISTOS ......... ' + vio.length);
  console.log('  defectos plantados y NO vistos ...... ' + noVio.length + '   (puntos ciegos del banco)');
  for (const d of noVio) console.log('      · ' + d.id + ' — ' + d.que +
    (d.parcial ? '  (banco ' + d.parcial.join(', ') + ' siguió verde)' : ''));
  console.log('  defectos que NO SE PUDIERON plantar . ' + noPlantados.length + '   (zonas del banco sin falsar)');
  for (const d of noPlantados) console.log('      · ' + d.id + ' — ' + d.que);
  console.log('');

  // Qué bancos quedaron demostrados por al menos un defecto real
  const cubiertos = new Set();
  for (const d of vio) for (const n of (d.probados || d.esperaRojo)) cubiertos.add(n);
  console.log('  bancos con al menos un defecto que los pone rojos: ' +
    [...cubiertos].sort().join(', ') + '   (de 1..6)');
  const sinCubrir = [1, 2, 3, 4, 5, 6].filter(n => !cubiertos.has(n));
  if (sinCubrir.length) console.log('  bancos SIN falsar: ' + sinCubrir.join(', '));

  console.log('');
  if (noVio.length === 0 && noPlantados.length === 0 && sinCubrir.length === 0) {
    console.log('EL BANCO VE LOS ' + D.length + ' DEFECTOS, Y LOS SEIS ESTÁN FALSADOS.');
    process.exit(0);
  }
  console.log(noVio.length ? 'EL BANCO TIENE PUNTOS CIEGOS.'
    : 'HAY ZONAS DEL BANCO SIN FALSAR. No es lo mismo que un punto ciego, pero tampoco es una demostración.');
  process.exit(1);
}

main();
