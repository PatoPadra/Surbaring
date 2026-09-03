/**
 * repartir-real.mjs — ejercita el `_repartir` REAL de Vegetacion.js, no una
 * copia. Se arma un objeto con la forma que el método espera y se lo invoca con
 * `Vegetacion.prototype._repartir.call(...)`, así lo que se mide es el código
 * que va a correr en el juego.
 *
 * Qué se mide: cuántas instancias cambian de estado malla<->cartelera al
 * caminar, con el reparto de hoy (cada 8 m) contra el de antes (una vez por
 * celda de 96 m, midiendo desde el centro de la celda).
 */
import * as THREE from 'three';
import { Vegetacion } from '../../src/world/Vegetacion.js';

const TAM_CELDA = 96, RADIO_CELDAS = 13, N_LOTES = 26;

function hashPos(x, z) {
  let n = Math.round(x * 10) * 374761393 + Math.round(z * 10) * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}
function ruidoValor(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => { let n = a * 374761393 + b * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff; };
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

/** Un destino de instancias con la superficie mínima que `_repartir` usa. */
function destino(cap) {
  return {
    malla: {
      count: 0, instanceMatrix: { needsUpdate: false },
      setMatrixAt() {}, computeBoundingSphere() {},
    },
    colores: { needsUpdate: false, setXYZ() {}, array: new Float32Array(cap * 3) },
    dist: new Float32Array(cap), n: 0,
  };
}

/** Siembra sintética: mismas posiciones que el juego, sin DEM. */
function sembrarLista(cx, cz) {
  const pos = [], umbral = [], lote = [];
  for (let dz = -RADIO_CELDAS; dz <= RADIO_CELDAS; dz++) {
    for (let dx = -RADIO_CELDAS; dx <= RADIO_CELDAS; dx++) {
      const dc = Math.hypot(dx, dz); if (dc > RADIO_CELDAS) continue;
      const fd = 1 - Math.min(1, dc / RADIO_CELDAS) * 0.62;
      const gx = cx + dx, gz = cz + dz;
      let s = (gx * 73856093) ^ (gz * 19349663);
      const azar = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const intentos = Math.round(22 * fd);
      for (let k = 0; k < intentos; k++) {
        const x = gx * TAM_CELDA + azar() * TAM_CELDA;
        const z = gz * TAM_CELDA + azar() * TAM_CELDA;
        if (ruidoValor(x * 0.0042, z * 0.0042) < 0.24) continue;
        pos.push([x, z]);
        umbral.push(120 * (1 + (hashPos(x, z) - 0.5) * 0.34));
        lote.push(Math.abs(Math.round(x + z)) % N_LOTES);
      }
    }
  }
  return { pos, umbral, lote };
}

function armarSujeto(lista) {
  const n = lista.pos.length;
  const suj = {
    lotes: Array.from({ length: N_LOTES }, () => {
      const d = destino(20000); d.impostor = destino(20000); return d;
    }),
    _sN: n, _sCap: n + 8,
    _sPos: new Float32Array((n + 8) * 3), _sEsc: new Float32Array((n + 8) * 3),
    _sCua: new Float32Array((n + 8) * 4), _sCol: new Float32Array((n + 8) * 3),
    _sUmbral: new Float32Array(n + 8), _sLote: new Uint8Array(n + 8),
    _sEsImpostor: new Uint8Array(n + 8),
    _matriz: new THREE.Matrix4(), _pos: new THREE.Vector3(),
    _esc: new THREE.Vector3(), _cua: new THREE.Quaternion(),
    alcanceSombra: 384,
    _ordenarPorDistancia: Vegetacion.prototype._ordenarPorDistancia,
    _cuantasHasta: Vegetacion.prototype._cuantasHasta,
  };
  for (let i = 0; i < n; i++) {
    suj._sPos[i * 3] = lista.pos[i][0]; suj._sPos[i * 3 + 2] = lista.pos[i][1];
    suj._sEsc[i * 3] = suj._sEsc[i * 3 + 1] = suj._sEsc[i * 3 + 2] = 1;
    suj._sCua[i * 4 + 3] = 1;
    suj._sUmbral[i] = lista.umbral[i];
    suj._sLote[i] = lista.lote[i];
    suj._sEsImpostor[i] = 2;
  }
  return suj;
}

// `_ordenarPorDistancia` permuta `instanceMatrix.array`; el arnés no lo tiene,
// así que se lo damos vacío del tamaño justo.
for (const _ of [0]) { /* nada: se arma abajo por lote */ }

const V = 3.4;
function caminar(pasoReparto, usarCentroCelda, metros = 1500) {
  let px = 0.37 * TAM_CELDA, pz = 0.21 * TAM_CELDA;
  let celda = { x: Math.floor(px / TAM_CELDA), z: Math.floor(pz / TAM_CELDA) };
  let lista = sembrarLista(celda.x, celda.z);
  let suj = armarSujeto(lista);
  for (const l of suj.lotes) {
    l.malla.instanceMatrix.array = new Float32Array(20000 * 16);
    l.impostor.malla.instanceMatrix.array = new Float32Array(20000 * 16);
  }
  const ref = () => usarCentroCelda
    ? [(celda.x + 0.5) * TAM_CELDA, (celda.z + 0.5) * TAM_CELDA] : [px, pz];
  let r = ref();
  Vegetacion.prototype._repartir.call(suj, r[0], r[1]);
  let anterior = Uint8Array.from(suj._sEsImpostor);
  let clavesAnt = lista.pos.map(p => p[0] + ',' + p[1]);

  let eventos = [], ultimoReparto = { x: px, z: pz };
  const paso = 1;
  for (let s = paso; s <= metros; s += paso) {
    px += paso; // caminata recta al este
    const cx = Math.floor(px / TAM_CELDA), cz = Math.floor(pz / TAM_CELDA);
    const cambioCelda = cx !== celda.x || cz !== celda.z;
    const movido = Math.hypot(px - ultimoReparto.x, pz - ultimoReparto.z) >= pasoReparto;
    if (!cambioCelda && !movido) continue;

    if (cambioCelda) {
      celda = { x: cx, z: cz };
      lista = sembrarLista(cx, cz);
      const nuevo = armarSujeto(lista);
      for (const l of nuevo.lotes) {
        l.malla.instanceMatrix.array = new Float32Array(20000 * 16);
        l.impostor.malla.instanceMatrix.array = new Float32Array(20000 * 16);
      }
      // Trasplantar el estado previo por identidad de posición, que es lo que
      // el juego consigue gratis porque la siembra es determinista por celda.
      const mapa = new Map();
      for (let i = 0; i < clavesAnt.length; i++) mapa.set(clavesAnt[i], anterior[i]);
      for (let i = 0; i < lista.pos.length; i++) {
        const k = lista.pos[i][0] + ',' + lista.pos[i][1];
        if (mapa.has(k)) nuevo._sEsImpostor[i] = mapa.get(k);
      }
      suj = nuevo;
    }
    r = ref();
    const previo = Uint8Array.from(suj._sEsImpostor);
    Vegetacion.prototype._repartir.call(suj, r[0], r[1]);
    let cambios = 0;
    for (let i = 0; i < suj._sN; i++) {
      if (previo[i] !== 2 && previo[i] !== suj._sEsImpostor[i]) cambios++;
    }
    eventos.push(cambios);
    anterior = Uint8Array.from(suj._sEsImpostor);
    clavesAnt = lista.pos.map(p => p[0] + ',' + p[1]);
    ultimoReparto = { x: px, z: pz };
  }
  return eventos;
}

function resumen(nombre, ev) {
  const total = ev.reduce((a, b) => a + b, 0);
  const max = Math.max(...ev);
  const media = total / ev.length;
  console.log(`  ${nombre}`);
  console.log(`    eventos de reparto: ${ev.length}   cambios simultáneos: media ${media.toFixed(1)}, PICO ${max}`);
  console.log(`    cambios totales en 1500 m: ${total}`);
}

console.log('\n=== `_repartir` real, caminata recta de 1500 m ===\n');
resumen('ANTES  · una vez por celda de 96 m, desde el centro de la celda',
  caminar(1e9, true));
resumen('AHORA  · cada 8 m, desde la posición del jugador',
  caminar(8, false));
