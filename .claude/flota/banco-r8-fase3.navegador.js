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
 *   T3 · las capturas del suelo en los tres lugares de la carta, a −35° y a −8°,
 *        con el prefijo `r8-f3-sinpasto`, y las dos de la piedra (`r8-f3-piedra-con`
 *        y `-sin`). La mitad Node las mide con la misma cuenta que midió la base.
 *        Sólo terreno, agua y cielo: lo que se siembra al azar en cada carga
 *        (árboles, sotobosque, fauna) se apaga, y con ello su sombra. Y el clima
 *        con SEMILLAS fijas y sin eventos: `Tiempo` sortea las suyas al construirse
 *        (Tiempo.js, `_semillaA` y `_semillaB`), y con la misma fecha el brillo de
 *        la misma vista cambió un 25 % de una carga a otra.
 *        La base se saca igual, con el Terreno.js y el Sotobosque.js de la base
 *        puestos un rato: `bancoR8F3({ soloCapturas: true, prefijo: 'r8-base-f3' })`.
 *        Con el suelo horneado cargado saca además las tres vistas al suelo con la
 *        paleta calibrada sola (`-plano-`: módulo 1, normal plana, sin el ruido
 *        viejo), que es la referencia del brillo.
 *
 * Deja el reloj, las semillas, los eventos, la posición, lo que estaba a la vista
 * y los guardados como estaban.
 *
 * Uso, con el juego andando:
 *   await import('/banco.js'); await import('/.claude/flota/banco-r8-fase3.navegador.js')
 *   await window.bancoR8F3()   // progreso en document.body.dataset.bancoR8F3
 */

(() => {
  const LUGARES = { bosque: [-41.05186, -71.60042], estepa: [-41.05534, -71.26063], pedregal: [-41.18125, -71.54561] };
  const FECHA = '2025-02-12T15:00:00Z';
  // Con estas, a esa FECHA: nubosidad 0,32, sin lluvia, suelo seco (lo más
  // despejado de 48 pares probados; la B manda en las nubes).
  const SEMILLAS = [137, 23];
  // Lo que se siembra al azar en cada carga, por nombre del grupo en la escena
  const AL_AZAR = ['vegetacion', 'sotobosque', 'fauna', 'peces', 'clima', 'hornos', 'obras', 'trampas', 'jugador'];
  const SUELO = { id: 'suelo', lat: -41.0870, lon: -71.4290, altura: 1.7, rumbo: 200, cabeceo: -35 };
  const marcar = (o) => { document.body.dataset.bancoR8F3 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * `public/banco.js` por una etiqueta y no por `import()`: Vite no transforma un
   * módulo que importa un JS de `public` (lo sirve con un 500), así que el banco
   * entero no cargaba.
   */
  const cargarBanco = () => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/banco.js'; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
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
    if (!window.bancoDesglose) await cargarBanco();
    anularGuardados(S);
    const j = S.jugador;
    const e0 = { p: j.posicion.clone(), g: j.giro, c: j.cabeceo, t3: j.tercerPersona, f: new Date(S.tiempo.fecha.getTime()) };
    const so = S.sotobosque;
    const vis0 = so.lotes.map((l) => l.malla.visible);
    const T = S.tiempo;
    const sem0 = [T._semillaA, T._semillaB];
    const ev0 = S.eventos?.activos ? [...S.eventos.activos] : null;
    const grupos = S.escena.children.filter((c) => AL_AZAR.includes(c.name));
    const gvis0 = grupos.map((g) => g.visible);
    const P = op.prefijo || 'r8-f3';
    const r = S.render;
    try {
      if (op.soloCapturas) { out.programas = { antes: NaN, despues: NaN }; }
      else {
      // ── T2 · compilar ─────────────────────────────────────────────────────
      marcar({ paso: 'T2' });
      r.render(S.escena, S.camara);
      const p0 = r.info.programs?.length ?? NaN;
      await esperar(3000);
      for (let i = 0; i < 3; i++) { r.render(S.escena, S.camara); await esperar(200); }
      const p1 = r.info.programs?.length ?? NaN;
      out.programas = { antes: p0, despues: p1 };
      // T2b · lo que T2 no ve (lo señaló el agente): para cuando corre T2, las capas ya
      // llegaron. Se le devuelve a la textura un reemplazo de 1×1 del mismo tipo, se
      // dibuja, se pone otra vez la de verdad, se dibuja, y se cuentan los programas.
      const u = S.terreno.uniformes?.uSueloAlbedo;
      if (u?.value) {
        const real = u.value, Ctor = real.constructor;
        const prof = real.image?.depth || 4;
        const falsa = new Ctor(new Uint8Array(4 * prof), 1, 1, prof);
        falsa.needsUpdate = true;
        const q0 = r.info.programs?.length ?? NaN;
        u.value = falsa; r.render(S.escena, S.camara);
        u.value = real; r.render(S.escena, S.camara);
        const q1 = r.info.programs?.length ?? NaN;
        falsa.dispose();
        out.programasAlCambiarTextura = { antes: q0, despues: q1 };
      }

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
      }

      // ── T3 · las capturas ─────────────────────────────────────────────────
      marcar({ paso: 'T3' });
      T._semillaA = SEMILLAS[0]; T._semillaB = SEMILLAS[1];
      if (ev0) S.eventos.activos.length = 0;
      grupos.forEach((g) => { g.visible = false; });
      const opc = { altura: 1.7, rumbo: 200, fecha: FECHA, ancho: 1024, alto: 576 };
      for (const [id, [lat, lon]] of Object.entries(LUGARES)) {
        out.capturas[`suelo-${id}`] = (await window.capturar(`${P}-sinpasto-suelo-${id}`, { ...opc, lat, lon, cabeceo: -35 })).ok;
        out.capturas[`medio-${id}`] = (await window.capturar(`${P}-sinpasto-medio-${id}-a`, { ...opc, lat, lon, cabeceo: -8 })).ok;
      }
      const [lat, lon] = LUGARES.pedregal;
      const gSo = grupos.find((g) => g.name === 'sotobosque');
      if (gSo) gSo.visible = true;
      so.lotes.forEach((l) => { l.malla.visible = l.tipo?.id === 'piedra'; });
      out.capturas['piedra-con'] = (await window.capturar(`${P}-piedra-con`, { ...opc, lat, lon, cabeceo: -35 })).ok;
      so.lotes.forEach((l) => { l.malla.visible = false; });
      out.capturas['piedra-sin'] = (await window.capturar(`${P}-piedra-sin`, { ...opc, lat, lon, cabeceo: -35 })).ok;
      if (gSo) gSo.visible = false;
      // La referencia del brillo: la paleta calibrada sin el ruido viejo y sin
      // textura (módulo 1 exacto, normal plana; `r8-suelo-aislar.navegador.js`).
      // Contra la imagen de la base no sirve: el ruido viejo oscurecía el bosque un
      // 11 % por debajo de lo calibrado, y la guarda castigaba sacarlo.
      if (S.terreno.uniformes?.uSueloAlbedo && op.plano !== false) {
        await import('/.claude/flota/r8-suelo-aislar.navegador.js');
        await window.aislarSuelo('plano');
        try {
          for (const [id, [la, lo]] of Object.entries(LUGARES)) {
            out.capturas[`plano-${id}`] = (await window.capturar(`${P}-plano-sinpasto-suelo-${id}`, { ...opc, lat: la, lon: lo, cabeceo: -35 })).ok;
          }
        } finally { await window.aislarSuelo('real'); }
      }
      // Lo que quedó a la vista y el clima con que se sacaron: que nada lo haya prendido de nuevo
      out.aLaVista = grupos.filter((g) => g.visible).map((g) => g.name);
      const est = T.estado();
      out.clima = { semillas: [T._semillaA, T._semillaB], nubosidad: +est.nubosidad.toFixed(3), lluvia: +(est.lluvia || 0).toFixed(3), humedadSuelo: +(est.humedadSuelo || 0).toFixed(3), eventos: S.eventos?.activos?.length ?? 0 };
    } finally {
      so.lotes.forEach((l, i) => { l.malla.visible = vis0[i]; });
      grupos.forEach((g, i) => { g.visible = gvis0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1];
      if (ev0) { S.eventos.activos.length = 0; S.eventos.activos.push(...ev0); }
      j.posicion.copy(e0.p); j.giro = e0.g; j.cabeceo = e0.c; j.tercerPersona = e0.t3;
      S.tiempo.fecha = e0.f;
      anularGuardados(S);
    }
    const checks = [];
    const ok = (c, desc, det) => checks.push({ ok: !!c, desc, detalle: String(det) });
    const esperadas = 8 + (S.terreno.uniformes?.uSueloAlbedo && op.plano !== false ? 3 : 0);
    ok(Object.values(out.capturas).every(Boolean) && Object.keys(out.capturas).length === esperadas, `T3 · las ${esperadas} capturas salieron`, JSON.stringify(out.capturas));
    ok(out.aLaVista?.length === 0 && out.clima?.eventos === 0 && out.clima?.semillas?.[1] === SEMILLAS[1], 'T3 · con las semillas fijas, sin eventos y sin nada sembrado al azar a la vista', JSON.stringify({ aLaVista: out.aLaVista, clima: out.clima }));
    if (op.soloCapturas) {
      out.checks = checks;
      out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
      marcar({ paso: 'listo', ...out });
      return out;
    }
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
    ok(out.programasAlCambiarTextura && out.programasAlCambiarTextura.despues === out.programasAlCambiarTextura.antes, 'T2b · cambiar la textura del suelo por su reemplazo y volver no compila nada', JSON.stringify(out.programasAlCambiarTextura));
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    marcar({ paso: 'listo', ...out });
    return out;
  }

  window.bancoR8F3 = bancoR8F3;
})();
