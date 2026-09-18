/**
 * BANCO DE LA FASE 3 (suelo), MITAD NAVEGADOR — ronda 8.
 *
 * Saca las capturas que la mitad Node mide y mide lo que sólo se ve en la placa:
 *
 *   T1 · el costo: `bancoDesglose` (reloj de la GPU, `public/banco.js`), Baja,
 *        1024×576, en el arranque, tres corridas mirando al frente y tres mirando
 *        al suelo. Se devuelve la mediana del «Terreno» de cada vista, y se compara
 *        con la de la base medida en la misma sesión (`op.base`), porque entre
 *        sesiones la placa derivó un milisegundo.
 *        Para la base: poner el Terreno.js de la base, correr con
 *        `bancoR8F3({ soloCosto: true })`, y volver.
 *   T2 · compilar: los programas no cambian entre ahora (con las texturas ya
 *        cargadas o a punto) y después de dibujar varias veces con tres segundos
 *        de por medio.
 *   T3 · las capturas del suelo, con el sotobosque apagado, en los tres lugares de
 *        la carta, a −35° y a −8°, con el prefijo `r8-f3-sinpasto`, y las dos de la
 *        piedra (`r8-f3-piedra-con` y `-sin`). La mitad Node las mide con la misma
 *        cuenta que midió la base.
 *
 * Deja el reloj, la posición, el sotobosque y los guardados como estaban.
 *
 * Uso, con el juego andando:
 *   await import('/banco.js'); await import('/.claude/flota/banco-r8-fase3.navegador.js')
 *   await window.bancoR8F3()   // progreso en document.body.dataset.bancoR8F3
 */

(() => {
  const LUGARES = { bosque: [-41.05186, -71.60042], estepa: [-41.05534, -71.26063], pedregal: [-41.18125, -71.54561] };
  const FECHA = '2025-02-12T15:00:00Z';
  const SUELO = { id: 'suelo', lat: -41.0870, lon: -71.4290, altura: 1.7, rumbo: 200, cabeceo: -35 };
  const marcar = (o) => { document.body.dataset.bancoR8F3 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

  function anularGuardados(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) { if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; } }
    if (S.norma) S.norma._guardar = () => {};
  }

  async function bancoR8F3(op = {}) {
    const S = window.SurviBar;
    const out = { costo: {}, programas: {}, capturas: {}, notas: [] };
    if (!S) return { error: 'no hay SurviBar' };
    if (!window.bancoDesglose) await import('/banco.js');
    anularGuardados(S);
    const j = S.jugador;
    const e0 = { p: j.posicion.clone(), g: j.giro, c: j.cabeceo, t3: j.tercerPersona, f: new Date(S.tiempo.fecha.getTime()) };
    const so = S.sotobosque;
    const vis0 = so.lotes.map((l) => l.malla.visible);
    try {
      // ── T2 · compilar ─────────────────────────────────────────────────────
      marcar({ paso: 'T2' });
      const r = S.render;
      r.render(S.escena, S.camara);
      const p0 = r.info.programs?.length ?? NaN;
      await esperar(3000);
      for (let i = 0; i < 3; i++) { r.render(S.escena, S.camara); await esperar(200); }
      const p1 = r.info.programs?.length ?? NaN;
      out.programas = { antes: p0, despues: p1 };

      // ── T1 · el costo ─────────────────────────────────────────────────────
      marcar({ paso: 'T1' });
      const frente = [], suelo = [];
      for (let i = 0; i < 3; i++) {
        const a = await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12 });
        frente.push(a.cuestaCadaPieza?.Terreno);
        const b = await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12, punto: SUELO });
        suelo.push(b.cuestaCadaPieza?.Terreno);
      }
      out.costo = { frente, suelo, medianaFrente: mediana(frente), medianaSuelo: mediana(suelo) };
      if (op.soloCosto) { marcar({ paso: 'listo', ...out }); return out; }

      // ── T3 · las capturas ─────────────────────────────────────────────────
      marcar({ paso: 'T3' });
      for (const [id, [lat, lon]] of Object.entries(LUGARES)) {
        so.lotes.forEach((l) => { l.malla.visible = false; });
        out.capturas[`suelo-${id}`] = (await window.capturar(`r8-f3-sinpasto-suelo-${id}`, { lat, lon, altura: 1.7, rumbo: 200, cabeceo: -35, fecha: FECHA, ancho: 1024, alto: 576 })).ok;
        so.lotes.forEach((l) => { l.malla.visible = false; });
        out.capturas[`medio-${id}`] = (await window.capturar(`r8-f3-sinpasto-medio-${id}-a`, { lat, lon, altura: 1.7, rumbo: 200, cabeceo: -8, fecha: FECHA, ancho: 1024, alto: 576 })).ok;
      }
      const [lat, lon] = LUGARES.pedregal;
      so.lotes.forEach((l) => { l.malla.visible = l.tipo?.id === 'piedra'; });
      out.capturas['piedra-con'] = (await window.capturar('r8-f3-piedra-con', { lat, lon, altura: 1.7, rumbo: 200, cabeceo: -35, fecha: FECHA, ancho: 1024, alto: 576 })).ok;
      so.lotes.forEach((l) => { l.malla.visible = false; });
      out.capturas['piedra-sin'] = (await window.capturar('r8-f3-piedra-sin', { lat, lon, altura: 1.7, rumbo: 200, cabeceo: -35, fecha: FECHA, ancho: 1024, alto: 576 })).ok;
    } finally {
      so.lotes.forEach((l, i) => { l.malla.visible = vis0[i]; });
      j.posicion.copy(e0.p); j.giro = e0.g; j.cabeceo = e0.c; j.tercerPersona = e0.t3;
      S.tiempo.fecha = e0.f;
      anularGuardados(S);
    }
    const checks = [];
    const ok = (c, desc, det) => checks.push({ ok: !!c, desc, detalle: String(det) });
    ok(Number.isFinite(out.programas.antes) && out.programas.despues === out.programas.antes, 'T2 · con las texturas cargadas, dibujar no compila programas nuevos', `${out.programas.antes} → ${out.programas.despues}`);
    // La base, medida en la misma sesión con el Terreno.js de la base puesto un rato
    // (`window.bancoR8F3({ base: { suelo, frente } })`): la misma base midió 12,8 a 13,1
    // una mañana y 13,7 a 14,1 esa noche, y un umbral fijo medía la placa.
    const b = op.base;
    if (b) {
      ok(out.costo.medianaSuelo <= b.suelo - 1.0, 'T1 · mirando al suelo, el terreno baja al menos 1,0 ms contra la base de la sesión', `${out.costo.suelo.join(' · ')} ms, mediana ${out.costo.medianaSuelo} contra ${b.suelo}`);
      ok(out.costo.medianaFrente <= b.frente + 0.3, 'T1 · al frente, el terreno no sube más de 0,3 ms contra la base de la sesión', `${out.costo.frente.join(' · ')} ms, mediana ${out.costo.medianaFrente} contra ${b.frente}`);
    } else {
      out.notas.push('T1: sin base de la sesión, sólo se informa (bancoR8F3({ base: { suelo, frente } }))');
    }
    ok(Object.values(out.capturas).every(Boolean) && Object.keys(out.capturas).length === 8, 'T3 · las ocho capturas salieron', JSON.stringify(out.capturas));
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    marcar({ paso: 'listo', ...out });
    return out;
  }

  window.bancoR8F3 = bancoR8F3;
})();
