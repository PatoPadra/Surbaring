/**
 * Banco del arreglo de `Saberes.faltaPara()` — ronda 4.
 *
 * Mide el defecto que el revisor de código encontró y que ningún test previo
 * podía ver: con DOS tecnologías que habilitan el mismo efecto, la vieja
 * implementación preguntaba sólo por la primera del índice y bloqueaba a quien
 * se había ganado la segunda.
 *
 * El banco planta la implementación vieja como mutación y exige que la detecte.
 * Es la lección nº 8 de ESTADO.md: una guarda que sólo pregunta "¿corrió?" y no
 * "¿el camino feliz llegó a funcionar?" no es una guarda.
 */

import { Saberes } from '../../src/systems/Saberes.js';

const inventarioFalso = { disponiblePara: () => 0, consumirPara: () => true };

/** El orden importa: boleadora ANTES que arco, que es el del dataset real. */
const historia = {
  eras: [],
  tecnologias: [
    { id: 'lasca_obsidiana', nombre: 'Talla de obsidiana', costoSaber: 8, materiales: [] },
    { id: 'punta_proyectil', nombre: 'Punta de proyectil', costoSaber: 12, materiales: [] },
    { id: 'boleadora', nombre: 'Boleadora', costoSaber: 14, materiales: [], efecto: { caza: true } },
    { id: 'arco_colihue', nombre: 'Arco de colihue', costoSaber: 12, materiales: [], efecto: { caza: true } },
    { id: 'alfareria', nombre: 'Alfarería', costoSaber: 16, materiales: [], efecto: { horno: 'horno_barro' } },
  ],
};

const nuevo = () => new Saberes(historia, inventarioFalso);

let fallas = 0;
const comprobar = (nombre, real, esperado) => {
  const ok = real === esperado;
  if (!ok) fallas++;
  console.log(`  ${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : `  — esperaba ${esperado}, dio ${real}`}`);
  return ok;
};

console.log('\nESCENARIOS\n');

{
  const s = nuevo();
  comprobar('sin nada aprendido, la caza pide algo', s.faltaPara('caza')?.id, 'arco_colihue');
}
{
  const s = nuevo();
  comprobar('y señala el camino MÁS BARATO, no el primero del índice',
    s.faltaPara('caza')?.costoSaber, 12);
}
{
  const s = nuevo();
  s.desbloqueadas.add('arco_colihue');
  comprobar('EL DEFECTO: con el arco aprendido, la caza ya no pide nada',
    s.faltaPara('caza'), null);
}
{
  const s = nuevo();
  s.desbloqueadas.add('boleadora');
  comprobar('con la boleadora aprendida, la caza ya no pide nada',
    s.faltaPara('caza'), null);
}
{
  const s = nuevo();
  s.desbloqueadas.add('arco_colihue');
  s.desbloqueadas.add('boleadora');
  comprobar('con las dos, tampoco', s.faltaPara('caza'), null);
}
{
  const s = nuevo();
  comprobar('efecto con una sola tecnología: sigue andando como antes',
    s.faltaPara('horno', 'horno_barro')?.id, 'alfareria');
  s.desbloqueadas.add('alfareria');
  comprobar('y se apaga al aprenderla', s.faltaPara('horno', 'horno_barro'), null);
}
{
  const s = nuevo();
  comprobar('un efecto que nadie habilita no pide nada', s.faltaPara('pesca'), null);
}
{
  const s = nuevo();
  comprobar('requisitosPara() encuentra las dos armas', s.requisitosPara('caza').length, 2);
  comprobar('requisitoPara() sigue devolviendo la primera del índice',
    s.requisitoPara('caza')?.id, 'boleadora');
}

// ─── La mutación: la implementación vieja, plantada a propósito ─────────────
console.log('\nMUTACIÓN — se planta la implementación vieja y el banco tiene que verla\n');
{
  const s = nuevo();
  s.faltaPara = function (clave, valor) {
    const t = this.requisitoPara(clave, valor);
    return t && !this.desbloqueadas.has(t.id) ? t : null;
  };
  s.desbloqueadas.add('arco_colihue');
  const bloquea = s.faltaPara('caza')?.id === 'boleadora';
  console.log(`  ${bloquea ? 'OK  ' : 'FALLA'} la implementación vieja bloquea al que aprendió el arco`
    + `${bloquea ? ' (detectada)' : ' — el banco es ciego y no sirve'}`);
  if (!bloquea) fallas++;
}

console.log(`\n${fallas ? `${fallas} FALLAS` : 'todo verde, con la mutación detectada'}\n`);
process.exit(fallas ? 1 : 0);
