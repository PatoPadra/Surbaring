/**
 * COMPAÑERO DE NAVEGADOR DEL BANCO R6 · FASE 3.
 *
 * Lo que el banco de Node no puede ver: qué cuesta pintar con los iconos puestos
 * y en qué orden quedaron las cosas en la pantalla. Se corre con el juego
 * andando, después de entrar al parque.
 *
 * La medición es alternada y en tandas de 20 pintadas: el reloj del navegador
 * cuantiza a 0,1 ms y una sola pintada no se puede medir. La referencia es la
 * fase 2: 0,82 ms con 8 herramientas y 0,71 sin ellas.
 *
 *   await bancoR6Fase3();
 */
window.bancoR6Fase3 = async function bancoR6Fase3({ tandas = 60, porTanda = 20 } = {}) {
  const S = window.SurviBar;
  if (!S) return console.error('window.SurviBar no existe: ¿entraste al parque?');
  const { inventario: inv, equipo: eq, bolso } = S;
  const R = { ok: [], mal: [], nota: [] };
  const ok = (c, d, det) => (c ? R.ok : R.mal).push(det === undefined ? d : `${d}  [${det}]`);

  // La misma carga de la fase 2, misma semilla, para que los números se comparen.
  const cargar = (conHerr) => {
    inv.vaciar();
    for (const r of ['mano', 'arma', 'abrigo', 'espalda']) eq.desequipar(r);
    inv.vaciar();
    if (conHerr) for (const id of ['lasca', 'cuchillo', 'hacha_piedra', 'garrote', 'quillango', 'raspador', 'antorcha', 'honda']) eq.guardar(id);
    let s = 20260912; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const C = ['madera_dura', 'madera_blanda', 'lena', 'corteza', 'fibra', 'yesca', 'piedra', 'junco',
      'carne', 'pescado', 'cuero', 'hueso', 'miel', 'fruto', 'chatarra', 'arcilla', 'tosca', 'resina', 'pluma', 'grasa'];
    for (let v = 0; v < 300 && inv.pesoKg < inv.capacidadKg * 0.98; v++)
      inv.agregar(C[Math.floor(rnd() * C.length)], 1 + Math.floor(rnd() * 6));
  };

  const medir = async (conHerr) => {
    cargar(conHerr);
    if (!bolso.abierto) bolso.alternar();
    for (let i = 0; i < 60; i++) bolso.pintar();
    const ms = [];
    for (let t = 0; t < tandas; t++) {
      const t0 = performance.now();
      for (let i = 0; i < porTanda; i++) bolso.pintar();
      ms.push((performance.now() - t0) / porTanda);
      await new Promise(r => setTimeout(r, 0));
    }
    ms.sort((a, b) => a - b);
    return +ms[ms.length >> 1].toFixed(4);
  };

  const sin = [], con = [];
  for (let v = 0; v < 3; v++) { sin.push(await medir(false)); con.push(await medir(true)); }
  const med = (l) => [...l].sort((a, b) => a - b)[1];
  R.nota.push(`pintar() sin herramientas: ${sin.join(' · ')} → ${med(sin)} ms   (fase 2: 0,71)`);
  R.nota.push(`pintar() con 8 herramientas: ${con.join(' · ')} → ${med(con)} ms   (fase 2: 0,82)`);
  ok(med(con) <= 0.95, 'A2 · pintar() con la grilla llena queda en 0,95 ms o menos', med(con));

  // A1 · una sola hoja, y nada de SVG en línea por celda.
  const panel = document.querySelector('#bolsoPanel');
  ok(!!panel, 'el panel existe');
  const svgEnPanel = panel?.querySelectorAll('svg').length ?? -1;
  ok(svgEnPanel === 0, 'A1 · no hay ni un <svg> dentro del panel: el dibujo viene por CSS', svgEnPanel);

  // Los iconos están de verdad pintados, no son cajas vacías.
  const celdas = [...(panel?.querySelectorAll('[data-cs]') || [])];
  const conFondo = celdas.filter(c => {
    for (const el of [c, ...c.querySelectorAll('*')])
      if (getComputedStyle(el).backgroundImage.includes('url(')) return true;
    return false;
  }).length;
  const llenas = inv.casillas.filter(Boolean).length;
  ok(conFondo >= llenas, 'A3 · todas las casillas llenas tienen su dibujo', `${conFondo} de ${llenas}`);
  const distintos = new Set(celdas.flatMap(c => [...c.querySelectorAll('*')]
    .map(el => getComputedStyle(el).backgroundImage).filter(b => b.includes('url('))));
  ok(distintos.size >= 8, 'A4 · y no son todos el mismo dibujo', `${distintos.size} distintos en pantalla`);

  // A6 · el bolso abre en el bolso.
  const marco = panel?.querySelector('.bp-marco') || panel?.firstElementChild;
  const primeraCasilla = panel?.querySelector('[data-cs]');
  const yCasilla = primeraCasilla?.getBoundingClientRect().top ?? Infinity;
  const abajo = marco?.getBoundingClientRect().bottom ?? 0;
  ok(yCasilla < abajo, 'A6 · la primera casilla se ve sin bajar el panel',
    `casilla en y=${Math.round(yCasilla)}, el panel termina en ${Math.round(abajo)}`);
  R.nota.push(`panel: ${marco?.scrollHeight} px de alto, ${marco?.clientHeight} visibles`);

  // A5 · el número de la esquina distingue cantidad de usos.
  cargar(true);
  bolso.pintar();
  const cel2 = [...(panel?.querySelectorAll('[data-cs]') || [])];
  const iInst = inv.casillas.findIndex(c => c && c.usos !== undefined);
  const iPila = inv.casillas.findIndex(c => c && c.usos === undefined && c.n > 1);
  if (iInst >= 0 && iPila >= 0) {
    const marcaInst = cel2[iInst]?.innerHTML || '';
    const marcaPila = cel2[iPila]?.innerHTML || '';
    const etiquetas = (h) => [...h.matchAll(/<(\w+)/g)].map(m => m[1]).sort().join(',');
    ok(etiquetas(marcaInst) !== etiquetas(marcaPila) || /usos|durab/i.test(marcaInst),
      'A5 · una herramienta y una pila no se marcan igual',
      `${etiquetas(marcaInst)} vs ${etiquetas(marcaPila)}`);
  } else ok(false, 'había una instancia y una pila para comparar', `${iInst} ${iPila}`);

  console.log('\n  NAVEGADOR R6 · FASE 3');
  for (const n of R.nota) console.log(`    nota  ${n}`);
  for (const d of R.ok) console.log(`    ok    ${d}`);
  for (const d of R.mal) console.log(`    MAL   ${d}`);
  console.log(`\n    ${R.mal.length ? 'ROJO ' : 'VERDE'}  ${R.ok.length} bien, ${R.mal.length} mal\n`);
  return { ok: R.ok.length, mal: R.mal.length, sin, con, notas: R.nota, fallos: R.mal };
};
console.log('listo: await bancoR6Fase3()');
