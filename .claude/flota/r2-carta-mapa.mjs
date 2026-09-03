/**
 * Banco de navegación del mapa — comprueba el zoom y el arrastre sin navegador.
 *
 * No es una copia de la lógica: **importa `src/ui/Mapa.js` de verdad** y le
 * arma una instancia con `Object.create(Mapa.prototype)`, saltándose el
 * constructor —que toca el DOM— pero corriendo los métodos reales. Si mañana
 * alguien rompe la proyección, esto se entera.
 *
 * Lo que se verifica es lo que no se puede ver leyendo: que el zoom hacia el
 * cursor deje quieto lo que está bajo el cursor, que la vista no se salga del
 * mundo en ningún nivel, y que el recorte del velo caiga siempre dentro de la
 * grilla de exploración.
 *
 *   node .claude/flota/r2-carta-mapa.mjs
 */

import { Mapa } from '../../src/ui/Mapa.js';

const LADO = 640;
const TAMANO = 65536, MITAD = TAMANO / 2;

function nuevoMapa() {
  const m = Object.create(Mapa.prototype);
  m.mundo = { tamano: TAMANO, mitad: MITAD, metrosPorTexel: 32 };
  m.vista = { cx: 0, cz: 0, mpp: TAMANO / LADO };
  m.nivel = 0;
  m.abierto = false;              // así `_centrarEn` no intenta dibujar
  m._pedirTileFino = () => {};    // el tile toca el DOM; acá no interesa
  return m;
}

let fallos = 0, pruebas = 0;
const ok = (cond, txt, extra = '') => {
  pruebas++;
  if (!cond) { fallos++; console.log(`  ✗ ${txt} ${extra}`); }
  else console.log(`  ✓ ${txt} ${extra}`);
};
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ── 1. La escalera de zoom es la que se declaró ─────────────────────────────
console.log('\n1. La escalera de zoom');
{
  const m = nuevoMapa();
  const filas = [];
  for (let n = 0; n < 5; n++) {
    m.nivel = n;
    m.vista.mpp = (TAMANO / LADO) / [1, 2, 3.2, 6.4, 12.8][n];
    filas.push({
      n,
      mpp: m.vista.mpp,
      ventanaKm: LADO * m.vista.mpp / 1000,
      construccion: m._mppConstruccion(),
      equidistancia: m._equidistancia(m._mppConstruccion()),
      texelsPorPx: m.vista.mpp / 32,
    });
  }
  for (const f of filas) {
    console.log(`   nivel ${f.n}: ${f.mpp.toFixed(1).padStart(6)} m/px · `
      + `ventana ${f.ventanaKm.toFixed(1).padStart(5)} km · `
      + `se construye a ${f.construccion.toFixed(1).padStart(6)} m/px · `
      + `curvas cada ${String(f.equidistancia).padStart(3)} m · `
      + `${f.texelsPorPx.toFixed(2)} texels/px`);
  }
  ok(filas[0].ventanaKm === 65.536, 'el nivel 0 es exactamente el mundo entero');
  ok(cerca(filas[2].mpp, 32), 'el nivel 2 es un texel del DEM por píxel', '(32 m/px)');
  ok(filas.every(f => f.construccion >= 32 - 1e-9),
    'nunca se construye relieve por debajo del dato del DEM');
  ok(filas[3].construccion === filas[2].construccion && filas[4].construccion === filas[2].construccion,
    'los niveles 3 y 4 estiran el dibujo del 2, no inventan relieve');
  ok(filas.every(f => f.equidistancia >= 50),
    'la equidistancia nunca baja de 50 m sobre un DEM de 32 m/texel');
}

// ── 2. El zoom va hacia el cursor ──────────────────────────────────────────
console.log('\n2. El zoom deja quieto lo que está bajo el cursor');
{
  // Un ancla lejos del centro y lejos del borde, para que el recorte no la
  // salve por casualidad: si el zoom fuera al centro, esto se corre.
  const anclas = [
    { px: 200, py: 160 }, { px: 470, py: 500 }, { px: 320, py: 320 },
  ];
  for (const a of anclas) {
    const m = nuevoMapa();
    m.vista.cx = 4000; m.vista.cz = -6000;
    m.nivel = 1; m.vista.mpp = (TAMANO / LADO) / 2;
    const antes = m.aMundo(a.px, a.py);
    m._irANivel(3, a);
    const despues = m.aMundo(a.px, a.py);
    ok(cerca(antes.x, despues.x, 0.5) && cerca(antes.z, despues.z, 0.5),
      `ancla (${a.px},${a.py}) queda fija`,
      `→ ${antes.x.toFixed(1)},${antes.z.toFixed(1)} vs ${despues.x.toFixed(1)},${despues.z.toFixed(1)}`);
  }
}

// ── 3. La vista no se sale del mundo, en ningún nivel ──────────────────────
console.log('\n3. El recorte no deja salir la vista del mundo');
{
  let peor = 0, casos = 0;
  for (let n = 0; n < 5; n++) {
    const m = nuevoMapa();
    m.nivel = n;
    m.vista.mpp = (TAMANO / LADO) / [1, 2, 3.2, 6.4, 12.8][n];
    // Empujar hacia las ocho direcciones, mucho más lejos que el mundo
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      m._centrarEn(dx * 999999, dz * 999999);
      const medio = LADO * m.vista.mpp / 2;
      const oeste = m.vista.cx - medio, este = m.vista.cx + medio;
      const norte = m.vista.cz - medio, sur = m.vista.cz + medio;
      peor = Math.max(peor, -MITAD - oeste, este - MITAD, -MITAD - norte, sur - MITAD);
      casos++;
    }
  }
  ok(peor <= 1e-6, `${casos} empujones a los bordes y la ventana nunca se sale`,
    `(peor desborde ${peor.toExponential(1)} m)`);

  const m0 = nuevoMapa();
  m0._centrarEn(20000, -20000);
  ok(m0.vista.cx === 0 && m0.vista.cz === 0,
    'al nivel 0 el centro queda clavado: el parque entero no se puede arrastrar');
}

// ── 4. Proyección de ida y vuelta ──────────────────────────────────────────
console.log('\n4. Proyección');
{
  const m = nuevoMapa();
  m.nivel = 2; m.vista.mpp = 32; m._centrarEn(-11000, 8000);
  let peor = 0;
  for (const x of [-30000, -5000, 0, 5000, 30000]) {
    for (const z of [-30000, -5000, 0, 5000, 30000]) {
      const p = m.aPixel(x, z);
      const v = m.aMundo(p.px, p.py);
      peor = Math.max(peor, Math.abs(v.x - x), Math.abs(v.z - z));
    }
  }
  ok(peor < 1e-6, 'aPixel y aMundo son inversas exactas', `(peor error ${peor.toExponential(1)} m)`);

  const m1 = nuevoMapa();
  const esq = m1.aPixel(-MITAD, -MITAD), otra = m1.aPixel(MITAD, MITAD);
  ok(cerca(esq.px, 0) && cerca(esq.py, 0) && cerca(otra.px, LADO) && cerca(otra.py, LADO),
    'al nivel 0 las esquinas del mundo caen en las esquinas del lienzo');
}

// ── 5. El recorte del velo cae dentro de la grilla de exploración ──────────
console.log('\n5. El velo');
{
  const CELDAS = 256, MPC = TAMANO / CELDAS;
  let peor = 0, casos = 0;
  for (let n = 0; n < 5; n++) {
    const m = nuevoMapa();
    m.nivel = n;
    m.vista.mpp = (TAMANO / LADO) / [1, 2, 3.2, 6.4, 12.8][n];
    for (const [dx, dz] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, 0]]) {
      m._centrarEn(dx * 999999, dz * 999999);
      const esq = m.aMundo(0, 0);
      const sx = (esq.x + MITAD) / MPC, sy = (esq.z + MITAD) / MPC;
      const s = LADO * m.vista.mpp / MPC;
      // Fuera de [0, 256] el navegador recorta y el velo se corre respecto del
      // relieve: lo desconocido dejaría de tapar lo que corresponde.
      peor = Math.max(peor, -sx, -sy, sx + s - CELDAS, sy + s - CELDAS);
      casos++;
    }
  }
  ok(peor <= 1e-9, `${casos} vistas extremas y el recorte del velo siempre cae dentro`,
    `(peor desborde ${peor.toExponential(1)} celdas)`);
}

// ── 6. La escala gráfica elige un número redondo que entra ─────────────────
console.log('\n6. La escala gráfica');
{
  const REDONDOS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  for (let n = 0; n < 5; n++) {
    const mpp = (TAMANO / LADO) / [1, 2, 3.2, 6.4, 12.8][n];
    let metros = REDONDOS[0];
    for (const r of REDONDOS) if (r / mpp <= 150) metros = r;
    const px = metros / mpp;
    ok(px <= 150 && px >= 20,
      `nivel ${n}: barra de ${metros >= 1000 ? metros / 1000 + ' km' : metros + ' m'}`,
      `= ${px.toFixed(0)} px`);
  }
}

console.log(`\n${pruebas - fallos} de ${pruebas} comprobaciones pasaron.`);
process.exit(fallos ? 1 : 0);
