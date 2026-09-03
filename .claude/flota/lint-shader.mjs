/**
 * lint-shader.mjs — la red que atrapa los tres defectos de shader que este
 * proyecto ya pagó con una ronda cada uno. Corre sin navegador y sin servidor.
 *
 *   node .claude/flota/lint-shader.mjs [archivo...]
 *
 * Sin argumentos revisa los seis módulos del área `mundo`.
 *
 * Qué busca, y por qué cada cosa:
 *
 * 1. **Uniforme usado y no declarado.** Es el defecto que costó la ronda 3
 *    entera: `uDetalleAlcance` se usaba en el fragmento sin estar declarado, el
 *    shader del terreno no compilaba, la malla caía al material por defecto y se
 *    midió una mejora de 3,4× que era el costo de dibujar el suelo en blanco
 *    liso. Un shader mal integrado no lanza excepciones: desaparece.
 * 2. **Comilla invertida o `${` dentro de un comentario GLSL.** El shader vive
 *    en un literal de plantilla de JavaScript, así que eso CIERRA el literal y
 *    tumba el juego entero con un SyntaxError que apunta a una variable del
 *    shader. Le pasó a `agua` en Agua.js y a `luz` en Cielo.js, y mientras tanto
 *    ningún agente podía verificar nada.
 * 3. **Chunks de profundidad logarítmica faltantes** en un ShaderMaterial
 *    propio. Sin ellos el objeto escribe una profundidad que no se corresponde
 *    con el resto de la escena y desaparece detrás del terreno, sin un solo
 *    error en consola.
 *
 * Como extra informa los uniformes declarados que nadie usa: no rompen nada,
 * pero son la pista barata de una rama muerta que igual se paga.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const POR_OMISION = [
  'src/world/Agua.js', 'src/world/Terreno.js', 'src/world/Vegetacion.js',
  'src/world/Sotobosque.js', 'src/world/Cielo.js', 'src/engine/Posproceso.js',
];

/**
 * Parte el archivo en literales de plantilla, respetando el escape `\``.
 * No es un analizador de JavaScript completo y no hace falta que lo sea: acá
 * las comillas invertidas sólo aparecen abriendo y cerrando plantillas.
 */
function literales(txt) {
  const out = [];
  let i = 0;
  while (i < txt.length) {
    const a = txt.indexOf('`', i);
    if (a < 0) break;
    let b = a + 1;
    while (b < txt.length) {
      if (txt[b] === '\\') { b += 2; continue; }
      if (txt[b] === '`') break;
      b++;
    }
    if (b >= txt.length) break;
    out.push({ ini: a, cuerpo: txt.slice(a + 1, b), linea: txt.slice(0, a).split('\n').length });
    i = b + 1;
  }
  return out;
}

/**
 * Detecta si un literal es GLSL. Se cuentan marcas y se piden dos, porque las
 * inyecciones por `onBeforeCompile` son trozos sueltos —sin `void main` y sin
 * `#include`— y un filtro que pidiera esas dos cosas se los perdería. Perder un
 * trozo es lo peor que puede pasar acá: el uniforme sin declarar quedaría
 * adentro de lo que no se revisa, que es exactamente el defecto que se busca.
 */
const MARCAS = [
  /\bvoid\s+main\s*\(/, /#include\s*</, /\b(gl_FragColor|gl_Position|gl_FragCoord)\b/,
  // Las tres clases de declaración cuentan por separado a propósito: las
  // cabeceras que las inyecciones anteponen al shader de three son SÓLO
  // declaraciones, sin una línea de código, y con una sola marca se colaban por
  // debajo del umbral. Justo la cabecera es donde vive lo que hay que declarar.
  /\buniform\s+(float|int|bool|vec[234]|mat[234]|sampler2D)\b/,
  /\bvarying\s+(float|int|vec[234]|mat[234])\b/,
  /\battribute\s+(float|int|vec[234]|mat[234])\b/,
  /\b(vec[234]|mat[234])\s*\(/, /\btexture2D\s*\(/,
  /\b(smoothstep|mix|clamp|dot|normalize|fract|pow)\s*\(/,
  /\b(float|vec[234])\s+[A-Za-z_]\w*\s*=/,
];
const esGLSL = (s) => MARCAS.reduce((n, r) => n + (r.test(s) ? 1 : 0), 0) >= 2;

const PALABRAS = new Set([
  'uniform', 'varying', 'attribute', 'in', 'out', 'inout', 'const', 'if', 'else',
  'for', 'while', 'return', 'discard', 'struct', 'void', 'true', 'false',
]);

function revisar(rel) {
  const ruta = resolve(process.cwd(), rel);
  const txt = readFileSync(ruta, 'utf8');
  const errores = [], avisos = [];

  const trozos = literales(txt).filter(l => esGLSL(l.cuerpo));
  if (!trozos.length) return { rel, errores, avisos, trozos: 0 };

  // ── (2) comilla invertida / interpolación dentro de un comentario GLSL.
  // La comilla invertida ya habría partido el literal, así que lo que se ve acá
  // es el resto: un `${` en un comentario, que el motor SÍ interpola.
  for (const t of trozos) {
    t.cuerpo.split('\n').forEach((ln, k) => {
      const c = ln.indexOf('//');
      if (c >= 0 && ln.slice(c).includes('${')) {
        errores.push(`${rel}:${t.linea + k + 1}  interpolación \${ dentro de un comentario GLSL`);
      }
    });
  }

  // ── (1) uniformes y varyings usados sin declarar.
  //
  // La unión es por archivo, no por literal, a propósito: las inyecciones por
  // `onBeforeCompile` declaran en un `replace` y usan en otro, y separarlas
  // daría un mar de falsos positivos. Lo que se busca es el caso que rompe de
  // verdad: el identificador que NO está declarado en ninguna parte.
  const glsl = trozos.map(t => t.cuerpo).join('\n');
  const sinComentarios = glsl.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  const declarados = new Set();
  for (const m of sinComentarios.matchAll(
    /\b(?:uniform|varying|attribute|in|out|const)\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+([A-Za-z_]\w*)/g
  )) declarados.add(m[1]);
  for (const m of sinComentarios.matchAll(/#define\s+([A-Za-z_]\w*)/g)) declarados.add(m[1]);
  // Declaraciones locales y parámetros de función: `vec3 uAlgo = ...`, `float vX)`
  for (const m of sinComentarios.matchAll(
    /\b(?:float|int|bool|vec[234]|ivec[234]|bvec[234]|mat[234]|sampler2D|samplerCube)\s+([A-Za-z_]\w*)/g
  )) declarados.add(m[1]);

  // Los chunks de three traen su propia cosecha de uniformes; darlos por buenos
  const conChunks = /#include\s*</.test(glsl);

  const usados = new Map();
  for (const t of trozos) {
    const limpio = t.cuerpo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const m of limpio.matchAll(/\b([uv][A-Z]\w*)\b/g)) {
      if (!usados.has(m[1])) usados.set(m[1], t.linea);
    }
  }
  // Varyings que three declara por su cuenta en los chunks del material base.
  // No están en el texto de la inyección y aun así existen.
  const DE_THREE = /^(vUv|vUv2|vNormal|vViewPosition|vWorldPosition|vColor|vTangent|vBitangent)$/;

  for (const [nombre, linea] of usados) {
    if (declarados.has(nombre) || PALABRAS.has(nombre) || DE_THREE.test(nombre)) continue;
    errores.push(`${rel}:~${linea}  «${nombre}» se usa en GLSL y NO está declarado`);
  }

  // Uniforme muerto. Se cuenta sobre el archivo ENTERO y no sólo sobre el GLSL
  // extraído: la extracción de trozos nunca va a ser perfecta, y un uniforme que
  // aparece dos veces en todo el archivo —la tabla de uniformes y la línea que
  // lo declara en el shader— es uno que nadie lee, sin lugar a duda.
  for (const d of declarados) {
    if (!/^u[A-Z]/.test(d)) continue;
    const veces = (txt.match(new RegExp(`\\b${d}\\b`, 'g')) || []).length;
    if (veces <= 2) avisos.push(`${rel}  «${d}» se declara ${veces} vez/veces y nadie lo lee`);
  }

  // ── (3) profundidad logarítmica en los ShaderMaterial propios
  if (/new THREE\.ShaderMaterial/.test(txt)) {
    const esPantalla = /FRAG_(AO|COLOR|MEZCLA|DESENFOQUE)|VERT_PLANO/.test(txt);
    const faltan = ['logdepthbuf_pars_vertex', 'logdepthbuf_vertex',
                    'logdepthbuf_pars_fragment', 'logdepthbuf_fragment']
      .filter(c => !glsl.includes(c));
    // Los pases de pantalla completa dibujan un triángulo en coordenadas de
    // recorte: no comparten el búfer de profundidad de la escena y no lo llevan.
    if (faltan.length && !esPantalla) {
      avisos.push(`${rel}  ShaderMaterial propio sin ${faltan.join(', ')}`);
    }
  }

  return { rel, errores, avisos, trozos: trozos.length };
}

const objetivos = process.argv.slice(2).length ? process.argv.slice(2) : POR_OMISION;
let rotos = 0;
for (const rel of objetivos) {
  const r = revisar(rel);
  const estado = r.errores.length ? 'ROTO' : 'ok';
  console.log(`\n── ${r.rel}  (${r.trozos} trozos de GLSL)  ${estado}`);
  for (const e of r.errores) console.log('   ERROR  ' + e);
  for (const a of r.avisos) console.log('   aviso  ' + a);
  rotos += r.errores.length;
}
console.log(rotos ? `\n${rotos} error(es). El juego probablemente no dibuje.`
                  : '\nSin errores: todo uniforme usado está declarado.');
process.exit(rotos ? 1 : 0);
