/**
 * Banco de `Equipo` y `Fabricacion` — ronda 4, fase 2.
 *
 * Corre contra el dataset real (`src/data/herramientas.json`) y el árbol real
 * (`historia.json`), no contra maquetas: si el dato y el código se desincronizan,
 * este banco tiene que ser el que se entere.
 *
 * Planta dos mutaciones al final. La lección nº 8 de ESTADO.md es que un banco
 * que sólo pregunta «¿corrió?» no es una guarda.
 */

import fs from 'node:fs';
import { Inventario } from '../../src/systems/Inventario.js';
import { Saberes } from '../../src/systems/Saberes.js';
import { Equipo } from '../../src/systems/Equipo.js';
import { Fabricacion } from '../../src/systems/Fabricacion.js';

const datos = JSON.parse(fs.readFileSync('src/data/herramientas.json', 'utf8'));
const historia = JSON.parse(fs.readFileSync('src/data/historia.json', 'utf8'));
const obj = id => datos.objetos.find(o => o.id === id);

function mundo() {
  const inventario = new Inventario(38);
  const saberes = new Saberes(historia, inventario);
  const equipo = new Equipo(datos, { inventario });
  const fabricacion = new Fabricacion(datos, { inventario, saberes, equipo, fundicion: null });
  return { inventario, saberes, equipo, fabricacion };
}

let fallas = 0;
const ok = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallas++;
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${nombre}${bien ? '' : `  — esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`);
};

console.log('\nEL PRIMER MINUTO — sin saber nada\n');
{
  const { inventario, fabricacion } = mundo();
  const sinTec = fabricacion.disponibles().map(o => o.id);
  ok('hay algo que fabricar sin aprender nada', sinTec.length > 0, true);
  ok('el cordel es una de esas', sinTec.includes('cordel_fibra'), true);
  ok('la lasca NO, pide talla de obsidiana', sinTec.includes('lasca'), false);

  ok('sin fibra, el cordel pide materiales',
    fabricacion.estado(obj('cordel_fibra')).estado, 'faltan_materiales');
  inventario.agregar('fibra', 3);
  ok('con tres fibras, está lista', fabricacion.estado(obj('cordel_fibra')).estado, 'lista');
  fabricacion.fabricar(obj('cordel_fibra'));
  ok('y salen dos cordeles', inventario.cantidad('cordel'), 2);
  ok('gastando la fibra', inventario.cantidad('fibra'), 0);
}

console.log('\nLA PRIMERA HERRAMIENTA\n');
{
  const { inventario, saberes, equipo, fabricacion } = mundo();
  inventario.agregar('piedra', 2);
  ok('sin la tecnología no se fabrica',
    fabricacion.estado(obj('lasca_rodado')).estado, 'falta_saber');

  saberes.desbloqueadas.add('lasca_obsidiana');
  ok('aprendida, ya se puede', fabricacion.estado(obj('lasca_rodado')).estado, 'lista');

  fabricacion.fabricar(obj('lasca_rodado'));
  ok('la herramienta va al equipo, no al bolso', equipo.tiene('lasca_rodado'), true);
  ok('y no ocupa lugar en el bolso', inventario.cantidad('lasca_rodado'), 0);
  ok('se equipa sola si la mano está libre', equipo.puesto.mano, 'lasca_rodado');
  ok('y ahora se trabaja en nivel 1', equipo.nivel, 1);

  ok('con ella se corta', equipo.puede('cortar'), true);
  ok('y se descuera', equipo.puede('descuerar'), true);
  ok('pero no se troza un caído: eso es nivel 2', equipo.puede('trozar'), false);
}

console.log('\nEL DESGASTE\n');
{
  const { inventario, saberes, equipo, fabricacion } = mundo();
  saberes.desbloqueadas.add('lasca_obsidiana');
  inventario.agregar('piedra', 2);
  fabricacion.fabricar(obj('lasca_rodado'));
  const tope = obj('lasca_rodado').durabilidad;

  ok('arranca con la durabilidad de su ficha', equipo.usosDe('lasca_rodado'), tope);
  for (let i = 0; i < tope - 1; i++) equipo.desgastar();
  ok('casi gastada, todavía sirve', equipo.puede('cortar'), true);
  ok('el último uso avisa que se rompió', equipo.desgastar(), true);
  ok('gastada no da nivel', equipo.nivel, 0);
  ok('gastada no corta', equipo.puede('cortar'), false);
  ok('pero sigue existiendo: no se evapora', equipo.tiene('lasca_rodado'), true);

  ok('repararla cuesta la mitad, para arriba',
    equipo.costoReparar('lasca_rodado'), [{ recurso: 'piedra', cantidad: 1 }]);
  ok('sin piedra no se repara', equipo.reparar('lasca_rodado'), false);
  inventario.agregar('piedra', 1);
  ok('con una piedra sí', equipo.reparar('lasca_rodado'), true);
  ok('y vuelve entera', equipo.usosDe('lasca_rodado'), tope);
}

console.log('\nEL AVISO — qué falta y por qué\n');
{
  const { inventario, saberes, equipo, fabricacion } = mundo();
  saberes.desbloqueadas.add('lasca_obsidiana');
  saberes.desbloqueadas.add('hacha_pulida');
  inventario.agregar('piedra', 4);
  fabricacion.fabricar(obj('lasca_rodado'));

  ok('sin hacha fabricada, trozar pide fabricarla',
    equipo.faltaPara('trozar')?.motivo, 'no_fabricada');

  // Se le da un hacha ya hecha y se pone la lasca en la mano
  equipo.guardar('hacha_piedra');
  equipo.equipar('lasca_rodado');
  ok('con el hacha guardada pero la lasca en la mano, el aviso dice «sacala»',
    equipo.faltaPara('trozar')?.motivo, 'no_equipada');
  ok('y dice cuál', equipo.faltaPara('trozar')?.objeto?.id, 'hacha_piedra');

  equipo.equipar('hacha_piedra');
  ok('sacada, ya se puede', equipo.puede('trozar'), true);
  ok('y el nivel sube a 2', equipo.nivel, 2);
}

console.log('\nLA ESTACIÓN — lo que no se hace con las manos\n');
{
  const { inventario, saberes, fabricacion } = mundo();
  saberes.desbloqueadas.add('fuego_friccion');
  inventario.agregar('resina', 3); inventario.agregar('carbon', 1); inventario.agregar('grasa', 1);
  const e = fabricacion.estado(obj('brea_resina'));
  ok('la brea pide fuego y sin fuego no va', e.estado, 'falta_estacion');
  ok('y lo dice con palabras', /fuego encendido/.test(e.motivo || ''), true);
}

console.log('\nEQUIVALENCIAS — el bolso ya las contaba y esto las reusa\n');
{
  const { inventario, saberes, fabricacion } = mundo();
  saberes.desbloqueadas.add('lasca_obsidiana');
  inventario.agregar('madera_dura', 2);
  inventario.agregar('cordel', 1);
  ok('la madera dura del coihue sirve donde se pide «madera»',
    fabricacion.estado(obj('mango_labrado')).estado, 'lista');
}

console.log('\nMUTACIONES — se rompe a propósito y el banco tiene que verlo\n');
{
  const { inventario, saberes, equipo, fabricacion } = mundo();
  inventario.agregar('piedra', 2);
  fabricacion.estado = function (o) {   // mutación: no mira la tecnología
    const falta = (o.materiales || []).filter(m => this.inventario.disponiblePara(m.recurso) < m.cantidad);
    return falta.length ? { estado: 'faltan_materiales', falta } : { estado: 'lista' };
  };
  const cae = fabricacion.estado(obj('lasca_rodado')).estado === 'lista' && !saberes.desbloqueadas.size;
  console.log(`  ${cae ? 'OK  ' : 'FALLA'} sin la guarda de tecnología se fabrica sin aprender${cae ? ' (detectada)' : ' — banco ciego'}`);
  if (!cae) fallas++;
}
{
  const { inventario, saberes, equipo, fabricacion } = mundo();
  saberes.desbloqueadas.add('lasca_obsidiana');
  inventario.agregar('piedra', 2);
  fabricacion.fabricar(obj('lasca_rodado'));
  Object.defineProperty(equipo, 'nivel', {   // mutación: el nivel ignora el gastado
    get() { return this.definicion(this.puesto.mano)?.nivel ?? 0; },
  });
  for (let i = 0; i < 99; i++) equipo.desgastar();
  const cae = equipo.nivel === 1;
  console.log(`  ${cae ? 'OK  ' : 'FALLA'} sin mirar el gastado, una herramienta rota sigue dando nivel${cae ? ' (detectada)' : ' — banco ciego'}`);
  if (!cae) fallas++;
}

console.log(`\n${fallas ? `${fallas} FALLAS` : 'todo verde, con las dos mutaciones detectadas'}\n`);
process.exit(fallas ? 1 : 0);
