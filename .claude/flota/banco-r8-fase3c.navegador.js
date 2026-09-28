/**
 * BANCO DE LA FASE 3c (sombras del terreno), MITAD NAVEGADOR — ronda 8.
 *
 * Sobre los instrumentos de `r8-sombra.navegador.js`:
 *
 *   S1 · recibe. Un coihue invisible que proyecta sombra, mirado derecho abajo: el
 *        terreno se oscurece en una fracción del cuadro a ±25 % de la de un plano de
 *        control de three puesto encima, y su oscurecimiento medio no baja de la mitad
 *        del del plano. Base: 0 contra 0,40 del plano.
 *   S2 · sin acné, contra la verdad del DEM. En una ladera de 24° que mira al sol y que
 *        nada tapa (x −4348, z 8145; N·L 0,61 con el sol a 14,7°, 0,82 a 31,6°): de los
 *        puntos al sol, se oscurece con la sombra prendida no más del 1 %, y de los
 *        rasantes (N·L 0,03 a 0,15) no más del 5 %. Con la maqueta del jefe (la normal
 *        del vértice en (0, 1, 0)): 0 de 16.384.
 *   S2b · y las sombras del relieve aparecen. En la ladera de la 3b con el sol a 14,7°,
 *        de los puntos que el relieve tapa a menos de 150 m, el 90 % o más se oscurece.
 *        Maqueta: 96,2 % desde 200 m y 100 % desde 40 m. Base: 0.
 *   S3 · el costo: «Terreno» de `bancoDesglose`, contra la base de la sesión
 *        (`op.base = { frente, suelo }`, la 3b): no más de 1,2 ms de suba. La maqueta,
 *        en la misma carga: +0,9 y +0,6.
 *   S4 · una segunda pasada no compila programas nuevos.
 *
 * Uso: await import('/.claude/flota/banco-r8-fase3c.navegador.js');
 *      await window.bancoR8F3c({ base: { frente, suelo } })   // { soloCosto: true } para la base
 */
(() => {
  const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const cargarScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  const marcar = (o) => { document.body.dataset.bancoR8F3c = JSON.stringify(o); };
  const AL_SOL = { x: -4348.34, z: 8144.75 };

  function anular(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) { if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; } }
    if (S.norma) S.norma._guardar = () => {};
  }

  window.bancoR8F3c = async function bancoR8F3c(op = {}) {
    const S = window.SurviBar;
    if (!S) return { error: 'no hay SurviBar' };
    anular(S);
    if (!window.bancoDesglose) await cargarScript('/banco.js');
    await import('/.claude/flota/r8-sombra.navegador.js');
    const out = { notas: [] };
    const j = S.jugador, T = S.tiempo;
    const e0 = { p: j.posicion.clone(), f: new Date(T.fecha.getTime()) };

    if (!op.sinCosto) {
      marcar({ paso: 'S3' });
      const frente = [], suelo = [];
      const SUELO = { id: 'suelo', lat: -41.0870, lon: -71.4290, altura: 1.7, rumbo: 200, cabeceo: -35 };
      await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 8 });
      for (let i = 0; i < 3; i++) {
        frente.push((await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12 })).cuestaCadaPieza?.Terreno);
        suelo.push((await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12, punto: SUELO })).cuestaCadaPieza?.Terreno);
      }
      out.costo = { frente, suelo, medianaFrente: mediana(frente), medianaSuelo: mediana(suelo) };
      j.posicion.copy(e0.p); T.fecha = new Date(e0.f.getTime());
      if (op.soloCosto) { marcar({ paso: 'listo', ...out }); return out; }
    }

    marcar({ paso: 'S1' });
    out.sombra = await window.medirSombra();
    marcar({ paso: 'S2' });
    out.acne = {
      sol15_40: await window.medirAcne({ fecha: '2025-02-12T11:30:00Z', alto: 40, ...AL_SOL }),
      sol15_200: await window.medirAcne({ fecha: '2025-02-12T11:30:00Z', alto: 200, ...AL_SOL }),
      sol32_40: await window.medirAcne({ fecha: '2025-02-12T13:00:00Z', alto: 40, ...AL_SOL }),
    };
    marcar({ paso: 'S2b' });
    out.relieve = {
      alto40: await window.medirAcne({ fecha: '2025-02-12T11:30:00Z', alto: 40 }),
      alto200: await window.medirAcne({ fecha: '2025-02-12T11:30:00Z', alto: 200 }),
    };
    marcar({ paso: 'S4' });
    const p0 = S.render.info.programs?.length ?? NaN;
    await window.medirAcne({ fecha: '2025-02-12T11:30:00Z', alto: 40, ...AL_SOL });
    out.programas = { antes: p0, despues: S.render.info.programs?.length ?? NaN };
    anular(S);

    const checks = [];
    const ok = (c, desc, det) => checks.push({ ok: !!c, desc, detalle: String(det) });
    const t = out.sombra.terreno, p = out.sombra.planoDeControl;
    ok(p.fraccion > 0.05, 'premisa: el plano de control recibe la sombra del árbol', JSON.stringify(p));
    ok(Math.abs(t.fraccion / Math.max(1e-6, p.fraccion) - 1) <= 0.25, 'S1 · el terreno se oscurece en una fracción a ±25 % de la del plano de control', `${t.fraccion} contra ${p.fraccion}`);
    ok(t.oscurecimientoMedio >= 0.5 * p.oscurecimientoMedio, 'S1 · y su oscurecimiento medio no baja de la mitad del del plano', `${t.oscurecimientoMedio} contra ${p.oscurecimientoMedio}`);
    for (const [id, a] of Object.entries(out.acne)) {
      ok(a.alSol >= 5000, `premisa: ${id} tiene 5000 puntos al sol o más`, a.alSol);
      ok(a.acne <= 0.01, `S2 · ${id} (sol a ${a.alturaSol}°): de los puntos al sol se oscurece el 1 % o menos`, `${a.acne} de ${a.alSol}`);
      if (a.rasantes >= 50) ok(a.acneRasante <= 0.05, `S2 · ${id}: de los rasantes, el 5 % o menos`, `${a.acneRasante} de ${a.rasantes}`);
    }
    for (const [id, a] of Object.entries(out.relieve)) {
      ok(a.tapadasCerca >= 200, `premisa: ${id} tiene 200 puntos tapados por el relieve o más`, a.tapadasCerca);
      ok(a.sombraVista >= 0.9, `S2b · ${id}: el 90 % o más de lo que el relieve tapa se ve en sombra`, `${a.sombraVista} de ${a.tapadasCerca}`);
    }
    ok(out.programas.despues === out.programas.antes, 'S4 · una segunda pasada no compila programas nuevos', JSON.stringify(out.programas));
    if (op.base && out.costo) {
      ok(out.costo.medianaFrente <= op.base.frente + 1.2, 'S3 · al frente, el terreno no sube más de 1,2 ms contra la base de la sesión', `${out.costo.frente.join(' · ')} ms, mediana ${out.costo.medianaFrente} contra ${op.base.frente}`);
      ok(out.costo.medianaSuelo <= op.base.suelo + 1.2, 'S3 · al suelo, tampoco', `${out.costo.suelo.join(' · ')} ms, mediana ${out.costo.medianaSuelo} contra ${op.base.suelo}`);
    } else out.notas.push('S3: sin base de la sesión, sólo se informa');
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    marcar({ paso: 'listo', total: out.total });
    return out;
  };
})();
