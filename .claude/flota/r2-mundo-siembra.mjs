/**
 * costo-siembra.mjs — cuánto trabajo hace UNA resiembra de Vegetacion._sembrar.
 *
 * No mide milisegundos de la placa: cuenta operaciones, que es lo que se puede
 * medir sin navegador y sin servidor. El dato que importa es si resembrar 4
 * veces más seguido es una locura o es barato.
 */

const TAM_CELDA = 96;
const RADIO_CELDAS = 13;

let celdas = 0, candidatos = 0;
for (let dz = -RADIO_CELDAS; dz <= RADIO_CELDAS; dz++) {
  for (let dx = -RADIO_CELDAS; dx <= RADIO_CELDAS; dx++) {
    const distCeldas = Math.hypot(dx, dz);
    if (distCeldas > RADIO_CELDAS) continue;
    celdas++;
    const factorDistancia = 1 - Math.min(1, distCeldas / RADIO_CELDAS) * 0.62;
    candidatos += Math.round(22 * factorDistancia);
  }
}

console.log(`celdas por resiembra: ${celdas}`);
console.log(`candidatos por resiembra: ${candidatos}`);
console.log(`radio sembrado: ${RADIO_CELDAS * TAM_CELDA} m`);

// Por candidato, ANTES de cualquier filtro: dentro + esAgua. Los que pasan
// pagan alturaEn + pendienteEn + humedadEn + aptitud por especie + ruidoValor.
// La proporción que pasa el filtro de agua/dentro no se puede saber sin DEM;
// se acota entre 0 (todo agua) y 1 (todo tierra firme).
const ESPECIES = 64;
console.log('\nConsultas al mundo por resiembra, cota superior (todo tierra firme):');
console.log(`  dentro/esAgua:            ${candidatos * 2}`);
console.log(`  alturaEn+pendienteEn+humedadEn: ${candidatos * 3}`);
console.log(`  aptitud (por especie):    ${candidatos * ESPECIES}  <-- el grueso`);
console.log(`  ruidoValor (claros):      ${candidatos}`);
console.log(`  TOTAL aprox:              ${candidatos * (2 + 3 + ESPECIES + 1)}`);

// Cuánto camina el jugador entre resiembras, a la velocidad real ya medida
const V = 3.4;   // m/s, la velocidad real tras el arreglo de `feel`
for (const paso of [96, 48, 32, 24]) {
  console.log(`\ncelda de ${paso} m -> una resiembra cada ${(paso / V).toFixed(1)} s caminando`);
}
