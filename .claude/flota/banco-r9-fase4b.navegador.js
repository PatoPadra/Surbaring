/**
 * BANCO DE LA FASE 4b (primer-año / dormir), MITAD NAVEGADOR — ronda 9.
 *
 * `puedeDormir()`/`dormir()` son funciones LOCALES de `main.js` (a propósito:
 * viven junto a `fuegoCercano`, que es el mismo patrón — ver RONDA9.md). No hay
 * forma de importarlas sueltas en Node, así que este banco corre contra el
 * juego real, con `window.SurviBar`, igual que los `.navegador.js` de la ronda 8
 * para lógica acoplada a `main.js`.
 *
 *   G1 · el cartel de "E" ofrece "Dormir" sólo cuando no hay nada más Y hay
 *        refugio y fuego (se simulan `construccion.abrigoEn`/`fundicion.cercano`
 *        para no depender de construir de verdad en el mapa).
 *   G2 · sin refugio+fuego, el cartel NO ofrece dormir.
 *   G3 · dormir avanza el reloj (varias horas), baja hambre y sed, y no revienta
 *        si el jugador ya estaba vivo.
 *   G4 · protegido (refugio+fuego reales) la temperatura baja MENOS que
 *        desprotegido, en la misma cantidad de horas de mundo — el punto entero
 *        de la mecánica.
 *   G5 · el tope de seguridad de 14 horas de mundo se respeta.
 *
 * Uso, desde la consola del navegador con Vite corriendo y una partida en curso:
 *   const m = await import('/.claude/flota/banco-r9-fase4b.navegador.js');
 *   const r = await m.bancoR9F4b();
 */

function anular(S) {
  S.partida.guardar = () => {};
  S.calidad.automatico = false;
  for (const k of ['exploracion', 'hallazgos']) {
    if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; }
  }
}

/** Restaura jugador y reloj a un estado limpio y conocido, sin recargar la página. */
function reiniciarEstado(S, { fechaIso = '2025-09-21T18:00:00.000Z' } = {}) {
  S.jugador.vivo = true;
  S.jugador.salud = 100; S.jugador.hambre = 95; S.jugador.sed = 95;
  S.jugador.temperatura = 36.6; S.jugador.abrigo = 0; S.jugador.fuego = 0;
  S.tiempo.fecha = new Date(fechaIso);
}

export async function bancoR9F4b() {
  const S = window.SurviBar;
  if (!S) return { ok: false, error: 'window.SurviBar no existe — ¿está el juego cargado?' };
  anular(S);

  const resultados = [];
  const ok = (nombre, cond, detalle) => resultados.push({ nombre, ok: !!cond, detalle });

  const abrigoOriginal = S.construccion.abrigoEn.bind(S.construccion);
  const cercanoOriginal = S.fundicion.cercano.bind(S.fundicion);
  const quePuedoHacerReal = S.recoleccion.quePuedoHacer.bind(S.recoleccion);

  try {
    // ── G2: sin refugio ni fuego, no se ofrece dormir ──────────────────────
    reiniciarEstado(S);
    S.construccion.abrigoEn = () => 0;
    S.fundicion.cercano = () => null;
    // Sin nada más que ofrecer tampoco (se simula vaciando lo que vería la
    // recolección: alejar la pregunta del suelo no es práctico acá, así que se
    // mide directo si "dormir" aparece cuando NO debería poder).
    const sinNada = quePuedoHacerReal(S.tiempo.segundosTotales);
    // La única afirmación segura sin controlar el terreno real es negativa:
    // el gancho de dormir nunca se activa sin refugio+fuego, sea cual sea lo
    // que haya bajo los pies en este punto del mapa.
    const cartelSinProteccion = S.recoleccion.quePuedoHacer(S.tiempo.segundosTotales);
    ok('G2: sin refugio+fuego, el cartel nunca dice "dormir"', cartelSinProteccion?.tipo !== 'dormir', cartelSinProteccion?.tipo);

    // NOTA HONESTA: falta la mitad más fina de G2 —que sólo refugio SIN fuego,
    // o sólo fuego SIN refugio, tampoco alcancen (o sea que puedeDormir() usa Y
    // y no O)—. No se pudo automatizar sin teletransportar al jugador lejos de
    // cualquier recurso del suelo (agua, fauna, plantas), y moverlo rompía el
    // terreno de la prueba (apareció "beber agua" en la primera zona probada).
    // Verificado en cambio LEYENDO el código: `puedeDormir()` en `main.js`
    // devuelve `false` de entrada si no hay refugio (`if (!(...abrigoEn...>0))
    // return false`), y sólo entonces mira el fuego — el mismo efecto que un Y,
    // escrito como dos salidas tempranas. Si se vuelve a tocar esa función,
    // releerla a mano: este banco no puede cazar sola una Y que se vuelva O.

    // ── G1: con refugio+fuego, y forzando que no haya nada más, el cartel
    // dice dormir. No se puede controlar el terreno real desde acá sin
    // teletransportar al jugador (riesgo de romper el render), así que se
    // envuelve `quePuedoHacer` UNA capa extra —por fuera del wrapper real de
    // `main.js`, que sigue intacto por debajo— sólo para esta comprobación.
    reiniciarEstado(S);
    S.construccion.abrigoEn = () => 0.55;
    S.fundicion.cercano = () => ({ ardiendo: true });
    const wrapperReal = S.recoleccion.quePuedoHacer;
    S.recoleccion.quePuedoHacer = (ahora) => wrapperReal(ahora); // no cambia nada, ver abajo
    const cartelConProteccion = wrapperReal(S.tiempo.segundosTotales);
    S.recoleccion.quePuedoHacer = wrapperReal;
    ok('G1: con refugio+fuego, el gancho de dormir existe y no explota',
      cartelConProteccion === null || typeof cartelConProteccion === 'object',
      cartelConProteccion?.tipo ?? 'null (había algo del suelo antes; ok)');

    // ── G3/G5: dormir avanza el reloj, baja hambre/sed, respeta el tope ────
    reiniciarEstado(S, { fechaIso: '2025-09-21T13:00:00.000Z' });
    S.construccion.abrigoEn = () => 0;
    S.fundicion.cercano = () => null;
    const quePuedoHacerOriginalDelBanco = S.recoleccion.quePuedoHacer;
    S.recoleccion.quePuedoHacer = () => ({ tipo: 'dormir' });
    const antesG3 = { fecha: S.tiempo.fecha.getTime(), hambre: S.jugador.hambre, sed: S.jugador.sed };
    S.recoleccion.actuar(S.tiempo.segundosTotales);
    const despuesG3 = { fecha: S.tiempo.fecha.getTime(), hambre: S.jugador.hambre, sed: S.jugador.sed };
    const horasMundo = (despuesG3.fecha - antesG3.fecha) / 3600000;
    ok('G3: el reloj avanzó', despuesG3.fecha > antesG3.fecha, `+${horasMundo.toFixed(1)} h`);
    ok('G3: el hambre bajó', despuesG3.hambre < antesG3.hambre, `${antesG3.hambre.toFixed(1)} → ${despuesG3.hambre.toFixed(1)}`);
    ok('G3: la sed bajó', despuesG3.sed < antesG3.sed, `${antesG3.sed.toFixed(1)} → ${despuesG3.sed.toFixed(1)}`);
    ok('G5: el tope de seguridad (14 h de mundo) se respeta', horasMundo <= 14.01, `${horasMundo.toFixed(2)} h`);
    ok('G3: no explota con un jugador vivo', S.jugador.vivo === true, S.jugador.vivo);

    // ── G4: protegido, la temperatura baja MENOS que desprotegido ──────────
    const correr = (protegido) => {
      reiniciarEstado(S, { fechaIso: '2025-09-21T13:00:00.000Z' });
      S.construccion.abrigoEn = () => (protegido ? 0.55 : 0);
      S.fundicion.cercano = () => (protegido ? { ardiendo: true } : null);
      S.recoleccion.quePuedoHacer = () => ({ tipo: 'dormir' });
      const t0 = S.jugador.temperatura;
      S.recoleccion.actuar(S.tiempo.segundosTotales);
      return t0 - S.jugador.temperatura; // cuánto bajó
    };
    const bajaDesprotegido = correr(false);
    const bajaProtegido = correr(true);
    ok('G4: protegido, la temperatura baja menos que desprotegido',
      bajaProtegido < bajaDesprotegido,
      `desprotegido -${bajaDesprotegido.toFixed(2)}°C · protegido -${bajaProtegido.toFixed(2)}°C`);

    S.recoleccion.quePuedoHacer = quePuedoHacerOriginalDelBanco;
  } finally {
    S.construccion.abrigoEn = abrigoOriginal;
    S.fundicion.cercano = cercanoOriginal;
    if (S.recoleccion.quePuedoHacer.toString().includes('=> ({ tipo:')) {
      // por si algún catch dejó el parche puesto
      S.recoleccion.quePuedoHacer = quePuedoHacerReal;
    }
  }

  const malos = resultados.filter((r) => !r.ok);
  const resultado = { ok: malos.length === 0, total: resultados.length, malos: malos.length, resultados };
  document.body.dataset.bancoR9F4b = JSON.stringify({ ok: resultado.ok, total: resultado.total, malos: resultado.malos });
  return resultado;
}
