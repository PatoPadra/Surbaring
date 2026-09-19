/**
 * BANCO DE LA FASE 6 (luz de luna), MITAD NAVEGADOR — ronda 8.
 *
 *   N1 · compilar: tres noches (llena, cuarto, nueva) dibujadas dos veces; la segunda
 *        pasada no compila programas nuevos (el brillo llega por el valor de un uniforme).
 *   N2 · las capturas, para el ojo del dueño: la misma vista del lago desde el arranque a
 *        la 1 de la madrugada, con las semillas del clima fijas, en luna llena (12/2/2025),
 *        en cuarto menguante (20/2) y en luna nueva (28/2): `r8-f6-luna-*.png`.
 *
 * El número lo mide la mitad Node (`banco-r8-fase6.mjs`, sección 2): la luz de cada noche
 * contra la ley de Allen, en dos meses.
 *
 * Uso: await import('/.claude/flota/banco-r8-fase6.navegador.js'); await window.bancoR8F6({ prefijo })
 */
(() => {
  const NOCHES = { llena: '2025-02-12T04:00:00Z', cuarto: '2025-02-20T06:00:00Z', nueva: '2025-02-28T04:00:00Z' };
  const AL_AZAR = ['sotobosque', 'fauna', 'peces', 'clima', 'hornos', 'obras', 'trampas'];

  window.bancoR8F6 = async function bancoR8F6(op = {}) {
    const S = window.SurviBar;
    if (!S) return { error: 'no hay SurviBar' };
    S.partida.guardar = () => {}; S.calidad.automatico = false;
    const T = S.tiempo, j = S.jugador;
    const sem0 = [T._semillaA, T._semillaB], f0 = new Date(T.fecha.getTime()), p0 = j.posicion.clone();
    const ev0 = S.eventos?.activos ? [...S.eventos.activos] : null;
    const grupos = S.escena.children.filter((c) => AL_AZAR.includes(c.name));
    const gv0 = grupos.map((g) => g.visible);
    const P = op.prefijo || 'r8-f6-luna';
    const lugar = S.mundo.aLatLon(7634, -1447);
    const out = { capturas: {}, luz: {} };
    try {
      T._semillaA = 137; T._semillaB = 23;
      if (ev0) S.eventos.activos.length = 0;
      grupos.forEach((g) => { g.visible = false; });
      let p1 = NaN;
      for (const pasada of [1, 2]) {
        if (pasada === 2) p1 = S.render.info.programs?.length ?? NaN;
        for (const [id, fecha] of Object.entries(NOCHES)) {
          const r = await window.capturar(`${P}-${id}`, { lat: lugar.lat, lon: lugar.lon, altura: 1.7, rumbo: 320, cabeceo: -3, fecha, ancho: 1024, alto: 576 });
          out.capturas[id] = r.ok;
          out.luz[id] = { ambiente: +S.cielo.luzAmbiente.intensity.toFixed(4), fraccion: +S.cielo.uniformes.uFaseLunar.value.toFixed(3), alturaLuna: +(Math.asin(S.cielo.direccionLuna.y) * 180 / Math.PI).toFixed(1) };
        }
      }
      out.programas = { antes: p1, despues: S.render.info.programs?.length ?? NaN };
    } finally {
      grupos.forEach((g, i) => { g.visible = gv0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1]; T.fecha = f0; j.posicion.copy(p0);
      if (ev0) { S.eventos.activos.length = 0; S.eventos.activos.push(...ev0); }
      S.partida.guardar = () => {};
    }
    const checks = [];
    const ok = (c, d, det) => checks.push({ ok: !!c, desc: d, detalle: String(det) });
    ok(Object.values(out.capturas).every(Boolean) && Object.keys(out.capturas).length === 3, 'N2 · las tres noches salieron', JSON.stringify(out.capturas));
    ok(out.programas.despues === out.programas.antes, 'N1 · la segunda pasada no compila programas nuevos', JSON.stringify(out.programas));
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    return out;
  };
})();
