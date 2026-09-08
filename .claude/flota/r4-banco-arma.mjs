/**
 * Banco del arma y de las dos fuentes que faltaban — ronda 4, fase 3.
 *
 * Cierra la deuda que la propia ronda se había puesto como regla: o el efecto
 * declarado se implementa, o el objeto se recorta. Las nueve armas declaraban
 * `alcanceM`, `danio`, `sigilo`, `presaMaxKg` y `municion`, y `Caza.js`
 * preguntaba un solo bit, así que el garrote y el arco eran lo mismo.
 */

import fs from 'node:fs';
import { Inventario } from '../../src/systems/Inventario.js';
import { Equipo } from '../../src/systems/Equipo.js';
import { Caza } from '../../src/systems/Caza.js';
import { tieneFuente } from '../../src/systems/Recursos.js';

const datos = JSON.parse(fs.readFileSync('src/data/herramientas.json', 'utf8'));

let fallas = 0;
const ok = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallas++;
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${nombre}${bien ? '' : `  — esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`);
};

const inv = new Inventario(38);
const eq = new Equipo(datos, { inventario: inv });
const caza = Object.create(Caza.prototype);
caza.equipo = eq;
caza.inventario = inv;
caza.jugador = { posicion: { x: 0, y: 0, z: 0 } };
const bicho = (kg, d) => ({ esp: { nombreComun: 'Animal', pesoKg: kg }, x: d, z: 0 });

console.log('\nEL ARMA DECIDE — nueve armas dejan de ser un bit\n');

ok('sin arma equipada se resuelve como antes: no se rompe una partida vieja',
  caza._tiro(bicho(80, 5)).ok, true);

// La honda tira piedra, y sin piedra el sistema corta antes de mirar la
// distancia. La primera versión de este banco no se la daba, así que dos
// comprobaciones pasaban por el motivo equivocado: decían «no abate» y el
// verdadero motivo era «no tenés con qué tirar». Un OK por la razón equivocada
// es peor que una falla.
inv.agregar('piedra', 12);
eq.guardar('honda'); eq.equipar('honda');
ok('la honda llega a 25 m y no a 40', caza._tiro(bicho(3, 40)).ok, false);
ok('y el aviso dice la distancia real', /40 m/.test(caza._tiro(bicho(3, 40)).motivo), true);
ok('contra un ciervo de 180 kg no abate', caza._tiro(bicho(180, 5)).ok, false);
ok('y lo nombra como lo que es',
  /herido en el monte/.test(caza._tiro(bicho(180, 5)).motivo), true);

eq.guardar('arco_colihue_obj'); eq.equipar('arco_colihue_obj');
ok('el arco sin flechas no dispara', caza._tiro(bicho(60, 10)).ok, false);
ok('y lo dice en el título', /munici/.test(caza._tiro(bicho(60, 10)).titulo), true);
inv.agregar('flecha', 4);
const antes = inv.cantidad('flecha');
caza._tiro(bicho(60, 10));
ok('con flechas dispara, y la flecha se gasta salga o no el tiro',
  inv.cantidad('flecha'), antes - 1);
ok('el arco llega a 40 m', caza._tiro(bicho(60, 38)).ok !== undefined, true);

eq.guardar('boleadora_tres'); eq.equipar('boleadora_tres');
ok('la boleadora no hiere: enreda, y dentro de su porte y alcance no falla',
  caza._tiro(bicho(180, 20)).ok, true);
ok('pero a 60 m tampoco llega', caza._tiro(bicho(180, 60)).ok, false);

console.log('\nLAS DOS FUENTES QUE EL ÁRBOL DABA POR SENTADAS\n');

ok('la lana ya no está declarada sin fuente', tieneFuente('lana'), true);
ok('la pluma tampoco', tieneFuente('pluma'), true);

const src = fs.readFileSync('src/systems/Recoleccion.js', 'utf8');
ok('la lana sale del coirón, sin matar nada',
  /coiron[\s\S]{0,220}recurso: 'lana'/.test(src), true);
ok('la pluma del pastizal húmedo, que es donde hay aves',
  /pasto_humedo[\s\S]{0,220}recurso: 'pluma'/.test(src), true);

console.log('\nMUTACIÓN\n');
{
  const eq2 = new Equipo(datos, { inventario: new Inventario(38) });
  const c2 = Object.create(Caza.prototype);
  c2.equipo = eq2; c2.inventario = new Inventario(38);
  c2.jugador = { posicion: { x: 0, y: 0, z: 0 } };
  eq2.guardar('honda'); eq2.equipar('honda');
  c2._tiro = () => ({ ok: true });   // la versión vieja: la ley decidía sola
  const cae = c2._tiro(bicho(180, 400)).ok === true;
  console.log(`  ${cae ? 'OK  ' : 'FALLA'} sin el arma, una honda abate un ciervo a 400 m${cae ? ' (detectada)' : ' — banco ciego'}`);
  if (!cae) fallas++;
}

console.log(`\n${fallas ? `${fallas} FALLAS` : 'todo verde, con la mutación detectada'}\n`);
process.exit(fallas ? 1 : 0);
