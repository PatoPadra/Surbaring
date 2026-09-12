/**
 * COMPAÑERO DE NAVEGADOR DEL BANCO R6 · FASE 1.
 *
 * Lo que el banco de Node no puede medir: qué tarda dibujar el bolso y qué
 * quedó en pantalla. Se pega en la consola de la página con el juego andando.
 *
 * El mismo guion corre contra la lista vieja y contra la grilla nueva, con la
 * MISMA carga metida en el MISMO orden, así la comparación es honesta. La forma
 * de medir es alternada (A, B, A, B, …) y no en bloques: esta máquina deriva
 * térmicamente y medir todo A y después todo B le regala la diferencia al que
 * corrió primero.
 *
 * Antes de correrlo: entrar al parque (la pantalla de creación de personaje
 * frena el bucle 3D, y ése fue el motivo de que una ronda entera creyera que la
 * vista previa no podía correr el juego).
 *
 *   const S = window.SurviBar;
 *   await bancoR6Fase1();
 */
function nombreDeLaCasilla(inv, i) {
  const c = inv.casillas?.[i];
  return c ? (window.SurviBar?.inventario?.listar().find(x => x.id === c.id)?.nombre || c.id) : '';
}

window.bancoR6Fase1 = async function bancoR6Fase1({ vueltas = 240, calentar = 40 } = {}) {
  const S = window.SurviBar;
  if (!S) return console.error('window.SurviBar no existe: ¿entraste al parque?');
  const { inventario: inv, bolso } = S;
  const R = { ok: [], mal: [], nota: [] };
  const ok = (c, d, det) => (c ? R.ok : R.mal).push(det === undefined ? d : `${d}  [${det}]`);

  // ── La carga: la misma siempre, para que las dos medidas sean comparables ──
  // Semilla fija y a mano: `Math.random` haría que cada corrida mida otra cosa.
  let s = 20260912;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const CARGA = ['madera_dura', 'madera_blanda', 'lena', 'corteza', 'fibra', 'yesca',
    'piedra', 'junco', 'carne', 'pescado', 'cuero', 'hueso', 'miel', 'fruto',
    'chatarra', 'arcilla', 'tosca', 'resina', 'pluma', 'grasa'];

  inv.vaciar ? inv.vaciar() : inv.items?.clear?.();
  let metidos = 0;
  for (let v = 0; v < 300 && inv.pesoKg < inv.capacidadKg * 0.98; v++) {
    const id = CARGA[Math.floor(rnd() * CARGA.length)];
    if (inv.agregar(id, 1 + Math.floor(rnd() * 6)) > 0) metidos++;
  }
  R.nota.push(`carga: ${inv.pesoKg.toFixed(1)} / ${inv.capacidadKg} kg en ${metidos} tandas`
    + (inv.casillas ? `, ${inv.casillas.filter(Boolean).length} de ${inv.casillas.length} casillas` : ', sin grilla'));

  // ── C10 · lo que tarda dibujarlo ───────────────────────────────────────────
  if (!bolso.abierto) bolso.alternar();
  for (let i = 0; i < calentar; i++) bolso.pintar();
  const ms = [];
  for (let i = 0; i < vueltas; i++) {
    const t = performance.now();
    bolso.pintar();
    ms.push(performance.now() - t);
    // setTimeout y no requestAnimationFrame: con la pestana en segundo plano
    // el rAF no dispara y la medicion se cuelga para siempre. Costo esa corrida.
    if (i % 40 === 39) await new Promise(r => setTimeout(r, 0));
  }
  ms.sort((a, b) => a - b);
  const p = (q) => ms[Math.floor(q * (ms.length - 1))];
  R.nota.push(`pintar(): mediana ${p(.5).toFixed(3)} ms · p90 ${p(.9).toFixed(3)} ms · `
    + `mín ${ms[0].toFixed(3)} · máx ${ms[ms.length - 1].toFixed(3)}  (${vueltas} vueltas)`);
  window.__r6pintar = { mediana: p(.5), p90: p(.9), ms };

  // ── C9 · qué quedó en pantalla ─────────────────────────────────────────────
  const panel = document.querySelector('#bolsoPanel');
  ok(!!panel, 'el panel del bolso existe');
  ok(panel && getComputedStyle(panel).display !== 'none', 'y está abierto');

  const texto = panel?.textContent || '';
  ok(/\d+[,.]\d\s*\/\s*\d+\s*kg/.test(texto), 'sigue la barra de peso', texto.match(/[\d.,]+\s*\/\s*\d+\s*kg/)?.[0]);

  if (inv.casillas) {
    // `data-cs`, que es como quedó marcada la casilla. El compañero buscaba
    // `data-casilla`, un nombre que el contrato nunca fijó y que el jefe dio por
    // sentado: seis fallos que no eran del agente.
    const celdas = panel?.querySelectorAll('[data-cs]') || [];
    ok(celdas.length === inv.casillas.length,
      `se dibujan las ${inv.casillas.length} casillas`, celdas.length);
    const llenas = [...celdas].filter(c => c.textContent.trim()).length;
    ok(llenas === inv.casillas.filter(Boolean).length,
      'y las llenas son las que están llenas', `${llenas} dibujadas`);
    // Las cantidades tienen que estar escritas: una grilla que no dice cuántos
    // hay es más pobre que la lista que reemplaza.
    const conNumero = [...celdas].filter(c => /\d/.test(c.textContent)).length;
    ok(conNumero >= inv.casillas.filter(c => c && c.n > 1).length,
      'las pilas dicen su cantidad', conNumero);
    // Los botones que tenía cada renglón de la lista vieja ahora viven en un
    // panel de detalle que se llena al apuntar una casilla. Hay que apuntar
    // primero: sin eso el panel está vacío y «no está Tirar» es un falso rojo.
    const iAlgo = inv.casillas.findIndex(Boolean);
    celdas[iAlgo]?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    celdas[iAlgo]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const conDetalle = panel?.textContent || '';
    ok(conDetalle.includes('Tirar'), 'apuntando una casilla aparece «Tirar»');
    ok(!!panel?.querySelector('[data-accion="tirar"]'), 'y el botón de tirar existe');
    ok(conDetalle.includes(nombreDeLaCasilla(inv, iAlgo)),
      'el detalle dice qué hay en la casilla apuntada', nombreDeLaCasilla(inv, iAlgo));

    // Clic y clic: tomar de una llena y poner en una vacía.
    const iLlena = inv.casillas.findIndex(Boolean);
    const iVacia = inv.casillas.findIndex(c => !c);
    if (iLlena >= 0 && iVacia >= 0 && celdas.length) {
      const antesKg = inv.pesoKg, queHabia = { ...inv.casillas[iLlena] };
      // El DOM se reconsulta entre los dos clics: tomar repinta el panel entero,
      // así que el nodo de la segunda casilla que teníamos en la mano quedó
      // desprendido y clickearlo no hace nada. El compañero daba «no movió»
      // contra una interfaz que movía perfecto.
      const cel = () => panel.querySelectorAll('[data-cs]');
      cel()[iLlena]?.click();
      cel()[iVacia]?.click();
      ok(Math.abs(inv.pesoKg - antesKg) < 1e-9, 'clic y clic no cambia el peso', inv.pesoKg);
      ok(inv.casillas[iVacia]?.id === queHabia.id,
        'clic y clic mueve de verdad', `${queHabia.id} -> casilla ${iVacia}: ${inv.casillas[iVacia]?.id}`);
    } else ok(false, 'había una casilla llena y una vacía para probar el clic');
  } else {
    R.nota.push('sin grilla todavía: esta corrida es la línea de base de la lista vieja');
  }

  console.log(`\n  NAVEGADOR R6 · FASE 1`);
  for (const n of R.nota) console.log(`    nota  ${n}`);
  for (const d of R.ok) console.log(`    ok    ${d}`);
  for (const d of R.mal) console.log(`    MAL   ${d}`);
  console.log(`\n    ${R.mal.length ? 'ROJO ' : 'VERDE'}  ${R.ok.length} bien, ${R.mal.length} mal\n`);
  return { ok: R.ok.length, mal: R.mal.length, pintar: window.__r6pintar };
};
console.log('listo: await bancoR6Fase1()');
