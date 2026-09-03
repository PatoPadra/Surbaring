/**
 * Banco de la cantera — frente 1 del jefe `juego`, ronda 2.
 *
 * Mide, contra el DEM real y no contra un terreno sintético, tres cosas que el
 * encargo pide con números:
 *
 *   1. Qué porcentaje del mundo devuelve cada rama de `Mineria.yacimientoEn()`,
 *      abierto por jurisdicción.
 *   2. Qué porcentaje de eso es extraíble de verdad según `Mineria.evaluar()`.
 *   3. Cuántas veces cambia la etiqueta minera en un recorrido a pie, que es el
 *      parpadeo que el dueño trajo con captura, cuantificado.
 *
 * Y de yapa, la cadena de prioridades de `Recoleccion.quePuedoHacer()`: cada
 * cuánto gana cada rama, sobre el mundo real y con las densidades de sotobosque
 * medidas por el agente `bucle`.
 *
 * Corre con:  node .claude/flota/r2-cantera.mjs
 *
 * NO levanta el servidor ni abre el navegador: carga el DEM de disco con pngjs
 * y usa las clases del juego tal cual están.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Mundo } from '../../src/world/Mundo.js';
import { Limites } from '../../src/world/Limites.js';
import { Mineria } from '../../src/systems/Mineria.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEM = path.join(RAIZ, 'public/data/dem');

// Punto de partida ya medido por la flota: reserva, 822 m.
const SPAWN = { x: 7633.7, z: -1447.2 };

// ── Carga del mundo real, sin navegador ─────────────────────────────────────
//
// `Mundo.cargar()` usa `fetch` y el decodificador de PNG del navegador, así que
// acá se repite su secuencia a mano y se llaman sus propios precálculos. La
// alternativa —reimplementar altura, pendiente y agua— mediría otra cosa que el
// juego, que es exactamente la trampa que este proyecto ya pagó una vez.
function cargarMundo() {
  const meta = JSON.parse(readFileSync(path.join(DEM, 'meta.json'), 'utf8'));
  const m = new Mundo();
  m.meta = meta;
  const N = m.N = meta.resolucion;
  m.tamano = meta.tamanoM;
  m.mitad = m.tamano / 2;
  m.metrosPorTexel = meta.metrosPorTexel;
  m.alturaMin = meta.elevacionMin;
  m.alturaMax = meta.elevacionMax;
  m.mpdLon = 111320 * Math.cos(meta.centro.lat * Math.PI / 180);

  const crudo = new Uint16Array(readFileSync(path.join(DEM, 'alturas.r16')).buffer.slice(0));
  const escala = meta.alturaMaxCodificada / 65535;
  m.altura = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) m.altura[k] = crudo[k] * escala;

  const pngAlt = PNG.sync.read(readFileSync(path.join(DEM, 'alturas.png'))).data;
  const pngRios = PNG.sync.read(readFileSync(path.join(DEM, 'rios.png'))).data;
  m.agua = new Uint8Array(N * N);
  m.cauce = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) {
    m.agua[k] = pngAlt[k * 4 + 2];
    m.cauce[k] = pngRios[k * 4];
  }

  m._excavarLagos();
  m._calcularPendiente();
  m._calcularHumedad();
  m._construirDetalle();
  return m;
}

/** Minería con dependencias de mentira: sólo hacen falta mundo y límites. */
function armarMineria(mundo, limites, { conHerramienta = false, Clase = Mineria } = {}) {
  const datos = JSON.parse(readFileSync(path.join(RAIZ, 'src/data/mineria.json'), 'utf8'));
  const historia = JSON.parse(readFileSync(path.join(RAIZ, 'src/data/historia.json'), 'utf8'));
  return new Clase(datos, {
    mundo, limites, historia,
    jugador: { posicion: { x: 0, y: 0, z: 0 } },
    inventario: { disponiblePara: () => (conHerramienta ? 1 : 0), agregar: () => 1, pesoKg: 0 },
    saberes: { puntos: 0, otorgar() {} },
    hud: { aviso() {}, negativa() {} },
  });
}

// ── 1 y 2. Censo de yacimientos y de lo que de verdad se puede extraer ───────

function censo(mundo, limites, minSin, minCon, muestras) {
  const filas = new Map();   // jurisdicción -> conteos
  const nada = { total: 0 };
  for (const [x, z] of muestras) {
    const j = limites.jurisdiccion(x, z);
    if (!filas.has(j)) filas.set(j, { total: 0, agua: 0, ids: {}, extraible: 0, extraibleConHerr: 0 });
    const f = filas.get(j);
    f.total++;
    if (mundo.esAgua(x, z)) f.agua++;
    const y = minSin.yacimientoEn(x, z);
    const id = y ? y.id : 'nada';
    f.ids[id] = (f.ids[id] || 0) + 1;
    if (id !== 'nada') {
      if (minSin.evaluar(x, z, 0).permitido) f.extraible++;
      if (minCon.evaluar(x, z, 0).permitido) f.extraibleConHerr++;
    }
    nada.total++;
  }
  return filas;
}

function imprimirCenso(titulo, filas) {
  console.log(`\n── ${titulo} ─────────────────────────────────`);
  const orden = ['parque', 'reserva', 'fuera'];
  const cab = ['jurisdicción', 'muestras', 'pómez', 'arena', 'ripio', 'tosca', 'nada', 'ofrece', 'extraíble', 'c/herram.'];
  console.log(cab.map((c, i) => c.padEnd(i === 0 ? 13 : 10)).join(''));
  let tot = 0, ofreceTot = 0, extTot = 0, extHTot = 0;
  for (const j of orden) {
    const f = filas.get(j);
    if (!f) continue;
    const pc = n => `${(100 * n / f.total).toFixed(1)}%`;
    const ofrece = f.total - (f.ids.nada || 0);
    tot += f.total; ofreceTot += ofrece; extTot += f.extraible; extHTot += f.extraibleConHerr;
    console.log([
      j.padEnd(13),
      String(f.total).padEnd(10),
      pc(f.ids.pomez || 0).padEnd(10),
      pc(f.ids.arena || 0).padEnd(10),
      pc(f.ids.ripio || 0).padEnd(10),
      pc(f.ids.tosca || 0).padEnd(10),
      pc(f.ids.nada || 0).padEnd(10),
      pc(ofrece).padEnd(10),
      pc(f.extraible).padEnd(10),
      pc(f.extraibleConHerr).padEnd(10),
    ].join(''));
  }
  console.log('-'.repeat(103));
  const pt = n => `${(100 * n / tot).toFixed(1)}%`;
  console.log(['TODO'.padEnd(13), String(tot).padEnd(10), ''.padEnd(50),
    pt(ofreceTot).padEnd(10), pt(extTot).padEnd(10), pt(extHTot).padEnd(10)].join(''));
  return { tot, ofreceTot, extTot, extHTot };
}

// ── 3. El parpadeo ──────────────────────────────────────────────────────────

/**
 * La etiqueta minera que le llega al HUD, tal cual sale de `quePuedoHacer()`.
 *
 * Dos formas, y la diferencia entre las dos es el arreglo de la ronda 2:
 *
 * - **vieja**: se anuncia cualquier cosa que devuelva `yacimientoEn()`, sin
 *   preguntar si se puede, y la chatarra sale con sólo mirar la geografía.
 * - **nueva**: el árido sólo si `evaluar()` lo permite, y la chatarra sólo si
 *   además no está agotada ni dentro de un sitio patrimonial.
 *
 * `min` tiene que ser la clase que corresponda: para el ANTES, la de `main`.
 * Ver `cargarMineriaVieja()` — una bandera no alcanza, porque la mitad del
 * arreglo vive adentro de `yacimientoEn()`.
 */
function etiquetaMinera(min, x, z, { viejo = false } = {}) {
  if (viejo) {
    if (min.hayChatarra(x, z)) return 'Levantar chatarra (o R)';
    const yac = min.yacimientoEn(x, z);
    return yac ? `Abrir ${yac.nombre.toLowerCase()} (o R)` : null;
  }
  if (min.chatarraAMano(x, z, 0)) return 'Levantar chatarra (o R)';
  const v = min.evaluar(x, z, 0);
  return v.permitido ? `Abrir ${v.yacimiento.nombre.toLowerCase()} (o R)` : null;
}

/**
 * La `Mineria` de `main`, para poder medir el ANTES de verdad.
 *
 * Esto es una lección de método que costó una revisión entera. La primera
 * versión del banco medía el «antes» con una bandera que salteaba `evaluar()`,
 * pero **seguía usando la `yacimientoEn()` nueva**, con las celdas de 24 m ya
 * puestas. O sea que el «antes» que imprimía era un híbrido que nunca existió, y
 * por eso el número de la bitácora y el del comentario de `Mineria.js` no
 * coincidían. Un banco que no puede reproducir su propio punto de partida no
 * mide una mejora: mide una diferencia entre dos cosas que él mismo inventó.
 *
 * La única forma honesta es traer el archivo viejo del control de versiones.
 * Si no se puede —árbol sin git, rama huérfana—, se dice y se sigue sin el
 * ANTES, que es mejor que imprimir un número que no se puede sostener.
 */
async function cargarMineriaVieja() {
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const os = await import('node:os');
  try {
    const fuente = execFileSync('git', ['show', 'main:src/systems/Mineria.js'],
      { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const dir = mkdtempSync(path.join(os.tmpdir(), 'r2cantera-'));
    const destino = path.join(dir, 'MineriaMain.mjs');
    writeFileSync(destino, fuente, 'utf8');
    const mod = await import('file:///' + destino.replace(/\\/g, '/'));
    return mod.Mineria;
  } catch (e) {
    console.log(`  (no se pudo traer la Mineria de main: ${e.message.split('\n')[0]})`);
    return null;
  }
}

/**
 * Camina y cuenta cuántas veces cambia la etiqueta.
 *
 * La cadencia es la del juego: `main.js` llama a `quePuedoHacer()` dos veces por
 * segundo, y el jugador camina a 3,4 m/s, así que el HUD se repinta cada 1,7 m.
 * Medir con un paso más fino contaría cambios que el jugador nunca ve.
 */
function caminata(min, mundo, { x, z }, rumbo, metros, paso = 1.7, fn = etiquetaMinera) {
  const dx = Math.cos(rumbo) * paso, dz = Math.sin(rumbo) * paso;
  let cambios = 0, previa, visibles = 0, pasos = 0;
  const vistas = new Map();
  for (let d = 0; d < metros; d += paso) {
    const px = x + dx * (d / paso), pz = z + dz * (d / paso);
    if (!mundo.dentro(px, pz)) break;
    pasos++;
    const e = fn(min, px, pz);
    if (e) { visibles++; vistas.set(e, (vistas.get(e) || 0) + 1); }
    if (previa !== undefined && e !== previa) cambios++;
    previa = e;
  }
  return { cambios, pasos, visibles, vistas };
}

function imprimirCaminatas(titulo, min, mundo, origen, metros, opciones = {}) {
  console.log(`\n── ${titulo} · ${metros} m a pie, muestreo cada 1,7 m ─────────`);
  let cTot = 0, pTot = 0, vTot = 0;
  const todas = new Map();
  for (let k = 0; k < 8; k++) {
    const rumbo = (k / 8) * Math.PI * 2;
    const r = caminata(min, mundo, origen, rumbo, metros, 1.7,
      (m, x, z) => etiquetaMinera(m, x, z, opciones));
    cTot += r.cambios; pTot += r.pasos; vTot += r.visibles;
    for (const [e, n] of r.vistas) todas.set(e, (todas.get(e) || 0) + n);
    console.log(`  rumbo ${String(Math.round(rumbo * 180 / Math.PI)).padStart(3)}°  ` +
      `${String(r.cambios).padStart(3)} cambios de etiqueta  ·  ` +
      `visible el ${(100 * r.visibles / r.pasos).toFixed(0)}% del recorrido`);
  }
  const metrosTot = pTot * 1.7;
  console.log(`  TOTAL: ${cTot} cambios en ${Math.round(metrosTot)} m ` +
    `= 1 cada ${(metrosTot / (cTot || 1)).toFixed(0)} m ` +
    `(${(cTot / (metrosTot / 3.4)).toFixed(2)} por segundo caminando a 3,4 m/s)`);
  console.log(`  aviso visible el ${(100 * vTot / pTot).toFixed(1)}% del recorrido`);
  for (const [e, n] of [...todas].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String((100 * n / pTot).toFixed(1)).padStart(5)}%  ${e}`);
  }
  return { cambios: cTot, metros: metrosTot, visible: vTot / pTot };
}

// ── 4. La cadena de prioridades entera ──────────────────────────────────────
//
// Las ramas geográficas (agua, chatarra, cantera, permiso) salen del DEM real.
// Las del suelo salen de las densidades que midió `bucle` en el punto de
// partida y de la ley de Poisson: dentro de los 5 m de alcance hay 78,5 m².
const DENSIDAD = {   // metros cuadrados por unidad, medidos por `bucle`
  tronco: 1939, carronia: 5120, piedra: 64, michay: 24, helecho: 24, coiron: 1,
};
const AREA_ALCANCE = Math.PI * 5 * 5;
const pHay = (m2) => 1 - Math.exp(-AREA_ALCANCE / m2);

function cadena(mundo, limites, min, muestras) {
  // Probabilidades independientes de la posición
  const pTronco = pHay(DENSIDAD.tronco);
  const pCarronia = pHay(DENSIDAD.carronia);
  const pMataVale = 1 - (1 - pHay(DENSIDAD.piedra)) * (1 - pHay(DENSIDAD.michay)) * (1 - pHay(DENSIDAD.helecho));
  const pMataCualquiera = 1 - (1 - pMataVale) * (1 - pHay(DENSIDAD.coiron));

  const acum = {
    identificar: 0, carronia: 0, permiso: 0, beber: 0, tronco: 0,
    chatarra: 0, cantera: 0, planta: 0, mata_vale: 0, mata_relleno: 0, ficha: 0, nada: 0,
  };
  // `identificar` y `planta` piden fauna y vegetación vivas, que este banco no
  // instancia. Se dejan en cero a propósito y se dice: lo que se mide acá es
  // qué queda para las ramas de abajo UNA VEZ que esas dos no ganaron.
  for (const [x, z] of muestras) {
    let resto = 1;
    const tomar = (k, p) => { const q = resto * p; acum[k] += q; resto -= q; };

    tomar('carronia', pCarronia);
    const enAgua = mundo.esAgua(x, z) || aguaCerca(mundo, x, z);
    // Se mide el caso con sed: es el que le saca la tecla a lo demás. Con la
    // hidratación llena esta rama cayó al fondo de la cadena.
    tomar('beber', enAgua ? 1 : 0);
    tomar('tronco', pTronco);
    tomar('chatarra', min.hayChatarra(x, z) ? 1 : 0);
    // La cantera bajó DEBAJO de la planta y sólo sale si `evaluar()` la permite.
    // Este banco no instancia vegetación, así que `planta` vale cero y el efecto
    // de haberla bajado no se ve acá: lo único que mide esta línea es el filtro
    // de la jurisdicción. En el juego de verdad la mejora es mayor que ésta.
    tomar('cantera', min.evaluar(x, z, 0).permitido ? 1 : 0);
    tomar('mata_vale', pMataVale);
    tomar('mata_relleno', pMataCualquiera);
    acum.nada += resto;
  }
  const n = muestras.length;
  return Object.fromEntries(Object.entries(acum).map(([k, v]) => [k, 100 * v / n]));
}

function aguaCerca(mundo, x, z) {
  for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) {
    if (mundo.esAgua(x + dx, z + dz)) return true;
  }
  return mundo.cauceEn(x, z) > 0.25;
}

// ── Muestreos ───────────────────────────────────────────────────────────────

function rejilla(cx, cz, radio, paso) {
  const p = [];
  for (let dz = -radio; dz <= radio; dz += paso) {
    for (let dx = -radio; dx <= radio; dx += paso) p.push([cx + dx, cz + dz]);
  }
  return p;
}

function mundoEntero(mundo, paso) {
  const p = [];
  const m = mundo.mitad - paso;
  for (let z = -m; z <= m; z += paso) for (let x = -m; x <= m; x += paso) p.push([x, z]);
  return p;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

console.log('Cargando el DEM real…');
const mundo = cargarMundo();
const limites = new Limites(mundo);
const minSin = armarMineria(mundo, limites, { conHerramienta: false });
const minCon = armarMineria(mundo, limites, { conHerramienta: true });

const j = limites.jurisdiccion(SPAWN.x, SPAWN.z);
console.log(`Spawn: x ${SPAWN.x} · z ${SPAWN.z} · y ${mundo.alturaEn(SPAWN.x, SPAWN.z).toFixed(1)} m · ` +
  `pendiente ${mundo.pendienteEn(SPAWN.x, SPAWN.z).toFixed(3)} · jurisdicción ${j}`);

console.log('\n===============================================================');
console.log('1 y 2 · QUÉ OFRECE yacimientoEn() Y QUÉ DEJA PASAR evaluar()');
console.log('===============================================================');
const rSpawn = imprimirCenso('Alrededor del spawn · 1 km de lado, paso 8 m',
  censo(mundo, limites, minSin, minCon, rejilla(SPAWN.x, SPAWN.z, 500, 8)));
const rMundo = imprimirCenso('Mundo entero · 65,5 km de lado, paso 256 m',
  censo(mundo, limites, minSin, minCon, mundoEntero(mundo, 256)));

console.log('\n===============================================================');
console.log('3 · EL PARPADEO');
console.log('===============================================================');
// El ANTES se mide con la clase de `main`, no con una bandera: media mitad del
// arreglo vive adentro de `yacimientoEn()` y una bandera no la puede deshacer.
const MineriaVieja = await cargarMineriaVieja();
const pSpawnAntes = MineriaVieja
  ? imprimirCaminatas('ANTES · desde el spawn · clase de main',
      armarMineria(mundo, limites, { Clase: MineriaVieja }), mundo, SPAWN, 400, { viejo: true })
  : (console.log('\n── ANTES: no reproducible en este árbol ─────────'), null);
const pSpawn = imprimirCaminatas('DESPUES · desde el spawn', minSin, mundo, SPAWN, 400);

console.log('\n===============================================================');
console.log('4 · LA CADENA DE PRIORIDADES DE quePuedoHacer()');
console.log('===============================================================');
console.log('(fauna y vegetación no se instancian: lo que se mide es qué queda');
console.log(' para las ramas de abajo cuando `identificar` y `planta` no ganan)\n');
const c = cadena(mundo, limites, minSin, rejilla(SPAWN.x, SPAWN.z, 500, 8));
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) {
  if (v < 0.01) continue;
  console.log(`  ${String(v.toFixed(1)).padStart(5)}%  ${k}`);
}

console.log('\n=== RESUMEN EN UNA LÍNEA ===');
console.log(`spawn: ofrece cantera el ${(100 * rSpawn.ofreceTot / rSpawn.tot).toFixed(1)}% de las posiciones, ` +
  `extraíble el ${(100 * rSpawn.extTot / rSpawn.tot).toFixed(1)}%; ` +
  `parpadea 1 cada ${(pSpawn.metros / (pSpawn.cambios || 1)).toFixed(0)} m`);
console.log(`mundo: ofrece cantera el ${(100 * rMundo.ofreceTot / rMundo.tot).toFixed(1)}% de las posiciones, ` +
  `extraíble el ${(100 * rMundo.extTot / rMundo.tot).toFixed(1)}%`);
