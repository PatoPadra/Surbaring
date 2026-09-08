/**
 * Banco de la cadena completa — ronda 4, fase 2.
 *
 * Camina la pregunta original del dueño, de punta a punta y contra los sistemas
 * reales: *«necesito tablones pero no sé cómo hacerlos; tengo que cazar pero
 * ¿con qué?»*. No mide unidades sueltas: mide que la cadena esté cerrada.
 *
 * Sustituye a la verificación en el navegador, que en esta máquina no llega a
 * terminar la inicialización del bucle 3D —cosa previa a esta ronda, comprobada
 * dejando `main.js` como estaba en el commit—.
 */

import fs from 'node:fs';
import { Inventario } from '../../src/systems/Inventario.js';
import { Saberes } from '../../src/systems/Saberes.js';
import { Equipo } from '../../src/systems/Equipo.js';
import { Fabricacion } from '../../src/systems/Fabricacion.js';
import { Recoleccion } from '../../src/systems/Recoleccion.js';
import { tieneFuente } from '../../src/systems/Recursos.js';

const datos = JSON.parse(fs.readFileSync('src/data/herramientas.json', 'utf8'));
const historia = JSON.parse(fs.readFileSync('src/data/historia.json', 'utf8'));

let fallas = 0;
const ok = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallas++;
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${nombre}${bien ? '' : `  — esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`);
};

const inventario = new Inventario(38);
const saberes = new Saberes(historia, inventario);
const equipo = new Equipo(datos, { inventario });
const fabricacion = new Fabricacion(datos, { inventario, saberes, equipo, fundicion: null });
const obj = id => fabricacion.catalogo.find(o => o.id === id);

// La recolección sólo necesita el árbol y el equipo para decidir rinde y etiqueta
const reco = Object.create(Recoleccion.prototype);
reco.herramientas = datos;
reco.equipo = equipo;
const mataTronco = { tipo: { id: 'tronco', nombre: 'Tronco caído' } };
const cuantoDa = r => (r.find(x => x.recurso === 'tronco')?.cantidad) || 0;

console.log('\n«TENGO QUE CAZAR, ¿CON QUÉ?» — el eslabón del tendón\n');

ok('el arco pide saber algo, y el juego sabe cuál',
  saberes.faltaPara('caza')?.id !== undefined, true);
ok('a mano limpia, la carroña no da cuero ni tendón', equipo.puede('descuerar'), false);

inventario.agregar('fibra', 3);
fabricacion.fabricar(obj('cordel_fibra'));
saberes.desbloqueadas.add('lasca_obsidiana');
inventario.agregar('piedra', 2);
ok('la primera herramienta no pide subir a 1500 m: sale de dos piedras',
  fabricacion.estado(obj('lasca_rodado')).estado, 'lista');
fabricacion.fabricar(obj('lasca_rodado'));
ok('y con ella la carroña ya se descuera', equipo.puede('descuerar'), true);
ok('el nivel de trabajo es 1', equipo.nivel, 1);

console.log('\n«NECESITO TABLONES» — el tronco, que antes no lo daba nada\n');

ok('con la lasca todavía no se troza', equipo.puede('trozar'), false);
ok('y el caído sigue dando sólo leña', cuantoDa(reco._rinde('tronco')), 0);
ok('la etiqueta lo dice así', reco._etiquetaMata(mataTronco), 'Juntar ramas del tronco caído');

saberes.desbloqueadas.add('hacha_pulida');
inventario.agregar('piedra', 2);
inventario.agregar('madera_dura', 2);
inventario.agregar('cuero', 1);
fabricacion.fabricar(obj('mango_labrado'));
fabricacion.fabricar(obj('tiento_cuero'));
ok('el mango sale de madera y cordel', inventario.cantidad('mango'), 1);
ok('el tiento pide filo y sale de un cuero', inventario.cantidad('tiento'), 4);
ok('con mango, tiento y piedra el hacha está lista',
  fabricacion.estado(obj('hacha_piedra')).estado, 'lista');
fabricacion.fabricar(obj('hacha_piedra'));
equipo.equipar('hacha_piedra');

ok('ahora sí se troza', equipo.puede('trozar'), true);
ok('el nivel sube a 2', equipo.nivel, 2);
ok('y el MISMO caído entrega rollizos', cuantoDa(reco._rinde('tronco')), 2);
ok('la etiqueta cambia sola', reco._etiquetaMata(mataTronco), 'Trozar un caído · hacha de piedra');

console.log('\nLA CADENA HASTA LA TABLA, ESLABÓN POR ESLABÓN\n');
const aserrar = datos.acciones.find(a => a.id === 'aserrar');
ok('aserrar existe y pide nivel 4', aserrar?.nivelMinimo, 4);
ok('y sale del aserradero', aserrar?.obra, 'aserradero');
const sierra = obj('sierra');
ok('la sierra la habilita la herrería', sierra?.tecnologia, 'herreria_colonial');
ok('y se hace en la fragua, no en el bolso', sierra?.donde, 'fragua');
ok('el tronco YA tiene fuente declarada en el árbol',
  datos.acciones.find(a => a.id === 'trozar').conHerramienta.rinde.some(r => r.recurso === 'tronco'), true);
ok('y ahora Recursos.js también lo da por conseguible, porque de verdad lo es',
  tieneFuente('tronco'), true);

console.log('\nEL DESGASTE CIERRA EL BUCLE\n');
const tope = obj('hacha_piedra').durabilidad;
for (let i = 0; i < tope; i++) equipo.desgastar();
ok('gastada, el caído vuelve a dar sólo leña', cuantoDa(reco._rinde('tronco')), 0);
ok('y la etiqueta vuelve a decir la verdad',
  reco._etiquetaMata(mataTronco), 'Juntar ramas del tronco caído');
ok('repararla cuesta la mitad', equipo.costoReparar('hacha_piedra'),
  [{ recurso: 'piedra', cantidad: 1 }, { recurso: 'mango', cantidad: 1 }, { recurso: 'tiento', cantidad: 2 }]);

console.log(`\n${fallas ? `${fallas} FALLAS` : 'la cadena está cerrada de punta a punta'}\n`);
process.exit(fallas ? 1 : 0);
