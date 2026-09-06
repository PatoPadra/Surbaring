/**
 * FALSADOR DEL BANCO DE LA FASE 2 — ronda 3.
 *
 * Un banco que nunca se puso rojo no vale más que el informe de su autor. Acá se
 * le plantan defectos que sabemos que existen y se comprueba que los ve.
 *
 * El primer defecto NO es sintético: es el `Fauna.js` real de 858ae717, el que
 * cerró la fase 1. Contra él los bancos 1 a 4 tienen que ponerse rojos, porque
 * ninguna de las cuatro cosas que pide la fase 2 está hecha ahí. Es la lección
 * de la trampa nº 3 de ESTADO.md: el banco sintético mide bien nueve defectos y
 * es ciego al décimo, así que conviene falsar también contra el mundo real.
 *
 * ── Segunda vuelta, 6/9/2026 — por qué se reescribió ─────────────────────────
 *
 * La primera versión terminó imprimiendo «defectos plantados: 4 · no plantables:
 * 3 · que el banco NO vio: 1 — EL BANCO TIENE PUNTOS CIEGOS», y el jefe anterior
 * murió justo ahí. Un banco con puntos ciegos declarados no cierra una fase (es
 * la trampa nº 8 de ESTADO.md, pagada en la fase 1 de esta misma ronda). Las dos
 * causas, diagnosticadas leyendo, resultaron ser **del falsador y no del banco**:
 *
 * 1. **El defecto que «el banco no vio» nunca se plantó de verdad.** D6 metía
 *    `color: 0x000000` como PRIMERA propiedad de
 *    `new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })`. En un
 *    literal de objeto la última clave repetida gana, así que el `color`
 *    abreviado de atrás pisaba el negro y el material salía del color de
 *    siempre. El banco 5 no era ciego: **no había nada que ver.** Ahora el negro
 *    se planta parcheando `MeshStandardMaterial.prototype.setValues`, que muerde
 *    sea cual sea la forma en que se construya el material.
 * 2. **Los tres «no plantables» eran anclas al futuro.** D2 buscaba
 *    `out.setAttribute('uv'…)`, D3 buscaba `texturasParaEspecie(…)` y D4
 *    reemplazaba la clave de `compactar()` por la que ya tenía. Ninguna de las
 *    tres podía enganchar contra un `Fauna.js` al que todavía no le habían
 *    escrito la fase 2: no eran huecos del banco, era el falsador corriendo
 *    antes de tiempo. Se les agregaron anclas alternativas para que aguanten
 *    varias formas razonables de escribir lo mismo, y el informe final ahora
 *    distingue las tres situaciones en vez de mezclarlas en una sola línea.
 *
 * Se agregaron además dos defectos que cubren caminos del banco que no tenía
 * nadie apuntándoles: D8 (un mapa pidiendo el canal `uv1` que la geometría no
 * tiene — la otra mitad del banco 1) y D9 (el atlas ausente en disco, que es lo
 * único que puede poner roja la GUARDA DEL CAMINO FELIZ; sin este defecto la
 * guarda contra la trampa nº 8 nunca se había visto fallar).
 *
 * ── La regla que ordena todo esto ────────────────────────────────────────────
 * Un defecto que NO se pudo plantar no demuestra nada, y hacerlo pasar por
 * demostración es exactamente cómo se llega a un verde falso. Por eso hay tres
 * desenlaces distintos y no dos: `lo vio`, `NO lo vio` (punto ciego de verdad) y
 * `no se pudo plantar` (zona del banco que queda sin falsar). El proceso sale
 * con código distinto de cero en los dos últimos.
 *
 * Uso:  node .claude/flota/banco-r3-fase2.falsar.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r3-fase2.mjs');
const FAUNA = path.join(RAIZ, 'src', 'entities', 'Fauna.js');
const TEX = path.join(RAIZ, 'public', 'tex');
const TEX_ESCONDIDO = path.join(RAIZ, 'public', 'tex__escondido_por_el_falsador');
const TMP = path.join(AQUI, '.tmp-falsar-fase2');

function correrBanco(rutaFauna) {
  let salida;
  try {
    salida = execFileSync(process.execPath, [BANCO], {
      cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, BANCO_FAUNA: rutaFauna },
    });
  } catch (e) { salida = String(e.stdout || '') + String(e.stderr || ''); }

  const estado = new Map();   // número de banco -> verde?
  for (const l of salida.split('\n')) {
    const m = l.match(/^\s{2}(VERDE|ROJO)\s+ejercitó\s+\d+\s+(\d)\s·/);
    if (m) estado.set(Number(m[2]), m[1] === 'VERDE');
  }
  const feliz = /VERDE\s+guarda del camino feliz/.test(salida);
  return { estado, feliz, salida };
}

/**
 * Aplica la PRIMERA de varias alternativas de ancla que enganche y que además
 * cambie el texto. Devolver `null` (y no un texto igual al de entrada) es lo que
 * permite que el informe diga «no se pudo plantar» en vez de contar un verde.
 * @param {string} texto
 * @param {Array<[RegExp, string|((...a:string[])=>string)]>} alternativas
 */
function plantarAlguna(texto, alternativas) {
  for (const [re, rep] of alternativas) {
    if (!re.test(texto)) continue;
    const p = texto.replace(re, rep);
    if (p !== texto) return p;
  }
  return null;
}

/** Escribe la copia con el defecto y devuelve su ruta, o null si no enganchó. */
function copiaConDefecto(nombreArchivo, alternativas, fuente = FAUNA) {
  const t = fs.readFileSync(fuente, 'utf8');
  const p = plantarAlguna(t, alternativas);
  if (p === null) return null;
  const destino = path.join(TMP, nombreArchivo);
  fs.writeFileSync(destino, p);
  return destino;
}

/**
 * Inyecta código justo después del `import * as THREE from 'three'` del archivo.
 * Es el ancla más estable que hay: `Fauna.js` no puede dejar de importar three,
 * y así el defecto no depende de cómo esté escrita la función que se ataca. Se
 * usa para los defectos que tienen que morder sea cual sea la implementación.
 */
function copiaConParcheDeThree(nombreArchivo, codigo) {
  return copiaConDefecto(nombreArchivo, [
    [/import \* as THREE from ['"]three['"];/, (m) => m + '\n' + codigo],
    [/^(import[^\n]*from ['"]three['"];)/m, (m) => m + '\n' + codigo],
  ]);
}

const defectos = [];

/**
 * @param {string} nombre
 * @param {number[]} esperados bancos que TIENEN que ponerse rojos
 * @param {() => (string|null)} construir devuelve la ruta del Fauna.js con el defecto
 * @param {string} porQue
 * @param {{guardaDebeCaer?: boolean, preparar?: () => void, restaurar?: () => void}} [extra]
 */
function defecto(nombre, esperados, construir, porQue, extra = {}) {
  defectos.push({ nombre, esperados, construir, porQue, ...extra });
}

// ── D1 · el mundo real: el Fauna.js de la fase 1 ────────────────────────────
defecto(
  'el Fauna.js real de 858ae717 (sin atlas y sin silueta)',
  [1, 2, 3, 4],
  () => {
    const destino = path.join(TMP, 'd1-Fauna.js');
    fs.writeFileSync(destino, execFileSync('git', ['show', '858ae717:src/entities/Fauna.js'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
    return destino;
  },
  'No es un defecto inventado: es el estado del repo antes de esta fase. Ninguna\n' +
  '     malla tiene mapa (1 y 2 rojos por cobertura cero, no por vacío verde),\n' +
  '     `compactar()` agrupa por color (3), y la silueta no cambió (4).'
);

// ── D2 · la UV que se pierde al fusionar ────────────────────────────────────
defecto(
  'la geometría fusionada pierde el atributo `uv`',
  [1],
  () => copiaConDefecto('d2-Fauna.js', [
    // (a) la copia explícita del atributo, que es como estaba escrito position/normal
    [/out\.setAttribute\(\s*['"]uv['"][\s\S]*?\);/, '/* uv borrada por el falsador */'],
    // (b) una lista de atributos a copiar que incluya 'uv'
    [/(\[[^\]\n]*)['"]uv['"],?\s*/, '$1'],
    // (c) un bucle sobre los atributos comunes: se lo hace saltar la uv
    [/for \(const (\w+) of ([^)]*atributos[^)]*)\) \{/,
      (m, v) => m + `\n      if (${v} === 'uv') continue; /* falsador */`],
  ]),
  'Es el defecto que ya estaba en `fusionarGeometrias()`: copia `position` y\n' +
  '     `normal` y nada más. Sin `uv`, WebGL entrega (0,0) en cada vértice y la\n' +
  '     malla entera muestrea UN texel. No lanza, no avisa: el animal sale plano.'
);

// ── D3 · todas las especies muestreando la misma celda ──────────────────────
defecto(
  'todas las especies piden la celda del huemul',
  [2],
  () => copiaConDefecto('d3-Fauna.js', [
    // (a) renombrar el import y envolverlo: muerde en cualquier sitio de llamada
    [/import \{([^}]*)\btexturasParaEspecie\b([^}]*)\} from (['"][^'"]*atlas\.js['"]);/,
      (m, a, b, ruta) =>
        `import {${a}texturasParaEspecie as __tpe__${b}} from ${ruta};\n` +
        `const texturasParaEspecie = (a, _id) => __tpe__(a, 'huemul'); /* falsador */`],
    // (b) el sitio de llamada, si el import fuera de otra forma (namespace, dinámico)
    [/texturasParaEspecie\(([^,()]+),\s*[^)]+\)/g, "texturasParaEspecie($1, 'huemul')"],
  ]),
  '«Un animal sale con el pelaje de otro, sin error ni aviso». Acá se fuerza el\n' +
  '     caso extremo: 43 especies muestreando la celda del huemul.'
);

// ── D4 · `compactar()` vuelve a agrupar por color ───────────────────────────
defecto(
  '`compactar()` agrupa sólo por color, como antes',
  [3],
  () => copiaConDefecto('d4-Fauna.js', [
    // (a) la clave de agrupación, escrita como sea, revertida al color
    [/const clave = (?!m\.material\.color\.getHexString\(\);)[^;]+;/, 'const clave = m.material.color.getHexString();'],
    // (b) por si la clave no se llama `clave`: se la reconoce porque la línea
    //     siguiente pregunta `.has(<esa misma variable>)`.
    [/const (\w+) = [^;\n]+;(\s*\n\s*if \(![\w.]+\.has\(\1\)\))/,
      (_m, v, resto) => `const ${v} = m.material.color.getHexString(); /* falsador */${resto}`],
  ]),
  'El peligro nº 1 del encargo, revertido a mano. Dos piezas de celdas distintas\n' +
  '     con el mismo color plano quedan bajo un material único.'
);

// ── D5 · el doble de dibujos por animal ─────────────────────────────────────
defecto(
  'cada malla se duplica: el doble de dibujos por animal',
  [4],
  () => copiaConDefecto('d5-Fauna.js', [
    [/this\._geometrias\.set\(esp\.id, modelo\);/,
      '{ const _ms = []; modelo.traverse(o => { if (o.isMesh) _ms.push(o); });' +
      ' for (const _m of _ms) if (_m.parent) _m.parent.add(_m.clone()); }\n    this._geometrias.set(esp.id, modelo);'],
    [/(const modelo = [^\n]+\n)/,
      '$1    { const _ms = []; modelo.traverse(o => { if (o.isMesh) _ms.push(o); });' +
      ' for (const _m of _ms) if (_m.parent) _m.parent.add(_m.clone()); } /* falsador */\n'],
  ]),
  'Con cuatro cascadas de sombra cada malla se dibuja cinco veces. Duplicarlas\n' +
  '     proyecta ×2 sobre 1,57 ms = 3,14 ms, muy por encima del techo de 2 ms.'
);

// ── D6 · todo el pelaje en negro puro ───────────────────────────────────────
//
// La versión vieja metía `color: 0x000000` como primera clave del literal
// `{ color, roughness, metalness }`, y la última clave repetida gana: el negro
// quedaba pisado y el defecto no existía. Ahora se parchea `setValues`, que es
// por donde pasa TODO `MeshStandardMaterial` sin importar cómo se lo construya.
defecto(
  'los materiales salen en negro puro',
  [5],
  () => copiaConParcheDeThree('d6-Fauna.js',
    '/* falsador: todo MeshStandardMaterial sale en negro puro, se construya como se construya */\n' +
    '{ const _sv = THREE.MeshStandardMaterial.prototype.setValues;\n' +
    '  THREE.MeshStandardMaterial.prototype.setValues = function (p) {\n' +
    '    _sv.call(this, p); if (this.color) this.color.setHex(0x000000); }; }'),
  'Es el artefacto más feo que tuvo el juego —piedras y troncos negro puro— y lo\n' +
  '     pagó la ronda 1. Un albedo 0 por cualquier luz sigue siendo 0.'
);

// ── D7 · comportamiento tocado ──────────────────────────────────────────────
defecto(
  'la distancia de huida se toca dentro de `_simular`',
  [6],
  () => copiaConDefecto('d7-Fauna.js', [
    [/const huida = \(esp\.distanciaHuidaM \?\? 30\) \* sigilo;/,
      'const huida = (esp.distanciaHuidaM ?? 30) * sigilo * 0.55;'],
    [/const huida = ([^;]+);/, 'const huida = ($1) * 0.55;'],
  ]),
  'Justo el número que `vida` arregló en la ronda 1 («un huemul que te deja\n' +
  '     llegar a veinticinco metros no es un huemul»). RONDA3 dice que no se toca.'
);

// ── D8 · el mapa pide un canal de UV que la geometría no tiene ──────────────
//
// La otra mitad del banco 1. D2 ataca el caso «el atributo no existe»; éste
// ataca «el atributo existe pero el mapa pide OTRO». En three 0.169 cada mapa
// lleva `texture.channel` (0 → atributo `uv`, 1 → `uv1`); poner 1 sin generar
// `uv1` deja la malla muestreando (0,0), otra vez sin error ni aviso. Se planta
// sobre `Texture.prototype.clone`, que es por donde pasa `texturasParaEspecie()`.
defecto(
  'los mapas piden el canal `uv1`, que la geometría no tiene',
  [1],
  () => copiaConParcheDeThree('d8-Fauna.js',
    '/* falsador: toda textura clonada pide el canal 1 (uv1) */\n' +
    '{ const _cl = THREE.Texture.prototype.clone;\n' +
    '  THREE.Texture.prototype.clone = function () { const t = _cl.call(this); t.channel = 1; return t; }; }'),
  'El banco 1 no sólo tiene que ver una `uv` ausente: tiene que ver un mapa\n' +
  '     apuntando a un canal que la geometría no genera. Es el mismo texel único,\n' +
  '     por el otro camino, y hasta ahora nadie le había apuntado a ese camino.'
);

// ── D9 · el atlas no está en disco: cae la GUARDA DEL CAMINO FELIZ ──────────
//
// Es el único defecto que puede poner roja la guarda contra la trampa nº 8. Sin
// él, la guarda que la fase 1 pagó con una sesión entera nunca se vio fallar, y
// una guarda que nunca falló es indistinguible de una que no mide nada.
defecto(
  'el atlas no está horneado: la guarda del camino feliz tiene que caer',
  [1, 2],
  () => FAUNA,     // el archivo real, sin tocar: el defecto está en el entorno
  'Se esconde `public/tex/` entero. Los bancos 1 y 2 no pueden decir «ninguna\n' +
  '     malla está mal» por vacío: tienen que ponerse rojos por cobertura cero, y\n' +
  '     la guarda del camino feliz tiene que avisar que nada se midió de verdad.\n' +
  '     Es la trampa nº 8 de ESTADO.md, plantada a propósito sobre el instrumento.',
  {
    guardaDebeCaer: true,
    preparar: () => { if (fs.existsSync(TEX)) fs.renameSync(TEX, TEX_ESCONDIDO); },
    restaurar: () => {
      if (fs.existsSync(TEX_ESCONDIDO)) {
        fs.rmSync(TEX, { recursive: true, force: true });
        fs.renameSync(TEX_ESCONDIDO, TEX);
      }
    },
  }
);

// ── Corrida ─────────────────────────────────────────────────────────────────

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

console.log('FALSADOR DEL BANCO DE LA FASE 2 · ronda 3 · SurviBar');
console.log('Se le plantan al banco defectos conocidos y se comprueba que se ponga rojo.');
console.log('Un defecto que no se pudo plantar NO cuenta como demostración.\n');

let ciegos = 0, plantados = 0, noPlantados = 0, mudos = 0;
const sinFalsar = [];
const bancosFalsados = new Set();

for (const d of defectos) {
  console.log('─'.repeat(74));
  console.log('DEFECTO: ' + d.nombre);
  console.log('  por qué importa: ' + d.porQue);

  let ruta = null;
  try { ruta = d.construir(); } catch (e) { console.log('  ERROR al plantar: ' + e.message); }
  if (!ruta) {
    noPlantados++;
    sinFalsar.push(d);
    console.log('  >>> NO SE PUDO PLANTAR: ninguna de las anclas de texto enganchó contra el');
    console.log('      Fauna.js actual. Esto NO es un verde. Quiere decir que el código cambió');
    console.log('      de forma y hay que reescribir el ancla, o que la pieza que el defecto');
    console.log('      ataca ya no existe. Los bancos ' + d.esperados.join(', ') + ' quedan SIN FALSAR.');
    console.log('');
    continue;
  }

  let resultado;
  try {
    if (d.preparar) d.preparar();
    resultado = correrBanco(ruta);
  } finally {
    if (d.restaurar) d.restaurar();
  }
  const { estado, feliz } = resultado;

  if (estado.size === 0) {
    mudos++;
    sinFalsar.push(d);
    console.log('  >>> EL BANCO NO PRODUJO NI UNA LÍNEA DE RESUMEN. No se puede saber si vio el');
    console.log('      defecto: probablemente se cayó antes de medir. Revisar a mano.');
    console.log('      últimas líneas:\n        ' +
      resultado.salida.trim().split('\n').slice(-6).join('\n        '));
    console.log('');
    continue;
  }

  plantados++;
  const rojos = [...estado.entries()].filter(([, v]) => !v).map(([k]) => k);
  const faltan = d.esperados.filter(n => estado.get(n) !== false);
  const guardaMal = d.guardaDebeCaer && feliz;
  console.log('  bancos que se pusieron rojos: ' + (rojos.length ? rojos.join(', ') : 'ninguno') +
    ' · esperados: ' + d.esperados.join(', ') + ' · camino feliz: ' + (feliz ? 'cargó' : 'NO cargó'));
  if (faltan.length || guardaMal) {
    ciegos++;
    sinFalsar.push(d);
    if (faltan.length) console.log('  >>> EL BANCO NO VIO EL DEFECTO. Siguen verdes los bancos: ' + faltan.join(', '));
    if (guardaMal) console.log('  >>> LA GUARDA DEL CAMINO FELIZ SIGUIÓ VERDE con el atlas escondido.');
  } else {
    for (const n of d.esperados) bancosFalsados.add(n);
    console.log('  el banco lo vio');
  }
  console.log('');
}

// ── Informe ─────────────────────────────────────────────────────────────────

console.log('═'.repeat(74));
console.log('plantados y comprobados: ' + plantados +
  ' · no plantables: ' + noPlantados +
  ' · el banco no los vio: ' + ciegos +
  ' · corridas mudas: ' + mudos);

const TODOS = [1, 2, 3, 4, 5, 6];
const huerfanos = TODOS.filter(n => !bancosFalsados.has(n));
console.log('bancos con al menos un defecto plantado que sí vieron: ' +
  ([...bancosFalsados].sort().join(', ') || 'ninguno'));
if (huerfanos.length) {
  console.log('BANCOS SIN FALSAR: ' + huerfanos.join(', ') + ' — nadie demostró que se pongan rojos.');
}
if (sinFalsar.length) {
  console.log('');
  console.log('Zonas que quedan sin falsar, una por una:');
  for (const d of sinFalsar) console.log('  · ' + d.nombre + '  → bancos ' + d.esperados.join(', '));
}

const limpio = ciegos === 0 && noPlantados === 0 && mudos === 0 && huerfanos.length === 0 && plantados > 0;
console.log('');
console.log(limpio
  ? 'EL BANCO SE PONE ROJO CON CADA DEFECTO QUE SE LE PLANTÓ, Y LOS SEIS ESTÁN CUBIERTOS.'
  : 'EL BANCO TIENE PUNTOS CIEGOS O ZONAS SIN FALSAR — leer el detalle de arriba.');
process.exit(limpio ? 0 : 1);
