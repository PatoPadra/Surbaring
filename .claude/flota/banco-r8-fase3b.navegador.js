/**
 * BANCO DE LA FASE 3b (luz), MITAD NAVEGADOR — ronda 8.
 *
 * El defecto: el terreno arma su normal en el marco del MUNDO y three la ilumina en
 * el de la CÁMARA (RONDA8.md, fase 3b). La luz del suelo depende entonces de hacia
 * dónde se mira. Lo que se mide acá no es el arreglo sino la física: la luz de un
 * pedazo de suelo no puede depender de la cámara, salvo el brillo especular.
 *
 *   L1 · el giro. Mirando derecho abajo desde 4 m, la cámara gira sobre su propio eje
 *        (0, 90, 180 y 270°). Lo que se ve es el mismo suelo girado, con la misma
 *        vista y la misma luz: ni el difuso ni el especular tienen por qué cambiar.
 *        Por lugar (bosque, estepa, pedregal y una ladera de 25°), render directo de
 *        512×512: el brillo medio del cuadrado central de 96×96 no cambia más de un
 *        2 % entre giros, y la imagen girada de vuelta coincide con la del giro 0 a
 *        menos de 1,5 niveles (de 255) de diferencia media en el 256×256 central.
 *        La base, el 18/9: 33,0 · 51,3 · 13,1 · 12,2.
 *   L2 · la vuelta. Desde 10 m, bajando 35°, mirando el mismo punto desde cuatro
 *        rumbos. El difuso no cambia; el especular sí, y con la rugosidad del
 *        terreno (0,94, GGX) se calculó que mueve el total a lo sumo un 15 %. Con la
 *        normal en el marco equivocado, el sol de frente y a la espalda dan N·L de
 *        1,00 y 0,35: casi el triple. Umbral: el brillo del 64×64 central no cambia
 *        más de un 20 %, en tres puntos llanos (LLANOS: menos de 2,5°).
 *   L3 · compilar. Una segunda pasada por L1 no compila programas nuevos.
 *   L4 · el costo. «Terreno» de `bancoDesglose`, tres corridas al frente y tres al
 *        suelo, contra la base de la sesión (`op.base = { frente, suelo }`, con el
 *        Terreno.js de la fase 3 puesto un rato): no más de 0,3 ms de suba en cada una.
 *   L5 · las capturas de la fase 3 con el arreglo puesto (`r8-f3b-*`, semillas fijas),
 *        que mide la mitad Node.
 *
 * Todo con el reloj en FECHA, las semillas del clima fijas, sin eventos y con lo que
 * se siembra al azar apagado (ver banco-r8-fase3.navegador.js, T3).
 *
 * Uso: await import('/.claude/flota/banco-r8-fase3b.navegador.js');
 *      await window.bancoR8F3b({ base: { frente, suelo } })
 *      con `{ soloCosto: true }` mide sólo L4 (para la base); con `{ sinCapturas: true }`
 *      se saltea L5.
 */
(() => {
  const FECHA = '2025-02-12T15:00:00Z';
  const SEMILLAS = [137, 23];
  const AL_AZAR = ['vegetacion', 'sotobosque', 'fauna', 'peces', 'clima', 'hornos', 'obras', 'trampas', 'jugador'];
  // La ladera: 25° medidos con diferencias de 8 y de 24 m (24,1°), 1625 m, a 3,5 km
  // al noroeste del pedregal. Buscada en el DEM el 19/9/2026 entre 338 candidatas.
  const LUGARES = {
    bosque: { lat: -41.05186, lon: -71.60042 },
    estepa: { lat: -41.05534, lon: -71.26063 },
    pedregal: { lat: -41.18125, lon: -71.54561 },
    ladera: { x: -3448.3377936424095, z: 10144.749999999683 },
  };
  // L2 pide suelo llano: en una ladera, dar la vuelta cambia el ángulo con que se ve
  // la superficie, y con él el especular y el pedazo que cae en el recuadro. Los
  // puntos de L1 del bosque y del pedregal tienen 15°; éstos son los llanos más
  // cercanos (menos de 2,5° con diferencias de 8 y de 24 m), buscados el 19/9/2026.
  const LLANOS = {
    bosque: { x: -6647.685775449585, z: -5376.309617767096 },       // a 100 m del de L1, 768 m
    estepa: { lat: -41.05534, lon: -71.26063 },                       // el mismo de L1, 3,3°
    pedregal: { x: -2160.8377936424095, z: 9066.400635094295 },       // a 25 m del de L1, 1903 m
  };
  const LADO = 512;
  const marcar = (o) => { document.body.dataset.bancoR8F3b = JSON.stringify(o); };
  const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const cargarScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  function anular(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) { if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; } }
    if (S.norma) S.norma._guardar = () => {};
  }

  function xz(S, l) {
    if (l.x != null) return { x: l.x, z: l.z };
    return S.mundo.aMundo(l.lat, l.lon);
  }
  function latLon(S, l) {
    if (l.lat != null) return { lat: l.lat, lon: l.lon };
    const g = S.mundo.aLatLon(l.x, l.z);
    return { lat: g.lat, lon: g.lon };
  }
  function pendiente(S, x, z) {
    const M = S.mundo, e = 8;
    const hx = (M.alturaEn(x + e, z) - M.alturaEn(x - e, z)) / (2 * e);
    const hz = (M.alturaEn(x, z + e) - M.alturaEn(x, z - e)) / (2 * e);
    return Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI;
  }

  /**
   * Deja el sol, las cascadas de sombra, la niebla y la exposición del lugar con una
   * captura (que es quien sabe prepararlos), y el lienzo en 512×512.
   */
  async function preparar(S, l, nombre) {
    const g = latLon(S, l);
    await window.capturar(nombre, { lat: g.lat, lon: g.lon, altura: 4, rumbo: 0, cabeceo: -80, fecha: FECHA, ancho: LADO, alto: LADO, conFauna: false });
    const r = S.render, cam = S.camara;
    r.setPixelRatio(1); r.setSize(LADO, LADO, false);
    cam.aspect = 1; cam.updateProjectionMatrix();
  }

  /** Un cuadro directo, sin posproceso, y su luminancia (filas de abajo hacia arriba). */
  function leer(S) {
    const r = S.render, gl = r.getContext();
    S.terreno.actualizar(S.camara);
    r.setRenderTarget(null);
    r.render(S.escena, S.camara);
    const px = new Uint8Array(LADO * LADO * 4);
    gl.readPixels(0, 0, LADO, LADO, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const L = new Float32Array(LADO * LADO);
    for (let k = 0; k < L.length; k++) L[k] = 0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2];
    return L;
  }
  const mediaCentro = (L, lado) => {
    const a = (LADO - lado) / 2;
    let s = 0;
    for (let y = a; y < a + lado; y++) for (let x = a; x < a + lado; x++) s += L[y * LADO + x];
    return s / (lado * lado);
  };
  /** Un cuarto de vuelta, n veces, sobre el centro del cuadrado. */
  function girar(L, n) {
    let A = L;
    for (let k = 0; k < n; k++) {
      const B = new Float32Array(A.length);
      for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) B[(LADO - 1 - x) * LADO + y] = A[y * LADO + x];
      A = B;
    }
    return A;
  }
  const difCentro = (A, B, lado) => {
    const a = (LADO - lado) / 2;
    let s = 0;
    for (let y = a; y < a + lado; y++) for (let x = a; x < a + lado; x++) s += Math.abs(A[y * LADO + x] - B[y * LADO + x]);
    return s / (lado * lado);
  };

  /** L1 en un lugar: cuatro giros mirando derecho abajo. Todo sincrónico: el bucle no se mete. */
  function medirGiro(S, l) {
    const cam = S.camara, M = S.mundo;
    const { x, z } = xz(S, l);
    const y = M.alturaEn(x, z);
    const imgs = [], medias = [];
    for (const g of [0, 90, 180, 270]) {
      const a = g * Math.PI / 180;
      cam.position.set(x, y + 4, z);
      cam.up.set(Math.sin(a), 0, -Math.cos(a));
      cam.lookAt(x, y, z);
      cam.updateMatrixWorld(true);
      const L = leer(S);
      imgs.push(L); medias.push(+mediaCentro(L, 96).toFixed(2));
    }
    cam.up.set(0, 1, 0);
    // La imagen girada de vuelta, por el lado que mejor calce: el sentido del giro
    // de la imagen depende de la convención de la cámara, y no importa acá.
    const difs = [1, 2, 3].map((k) => +Math.min(difCentro(girar(imgs[k], k), imgs[0], 256), difCentro(girar(imgs[k], 4 - k), imgs[0], 256)).toFixed(3));
    const var_ = Math.max(...medias) / Math.max(1e-6, Math.min(...medias)) - 1;
    return { medias, variacion: +var_.toFixed(4), difs, pendiente: +pendiente(S, x, z).toFixed(1) };
  }

  /** L2 en un lugar: el mismo punto desde cuatro rumbos, a 10 m y bajando 35°. */
  function medirVuelta(S, l) {
    const cam = S.camara, M = S.mundo;
    const { x, z } = xz(S, l);
    const y = M.alturaEn(x, z);
    const alto = 10 * Math.tan(35 * Math.PI / 180);
    const medias = [];
    for (const g of [0, 90, 180, 270]) {
      const a = g * Math.PI / 180;
      cam.up.set(0, 1, 0);
      cam.position.set(x + 10 * Math.sin(a), y + alto, z + 10 * Math.cos(a));
      cam.lookAt(x, y, z);
      cam.updateMatrixWorld(true);
      medias.push(+mediaCentro(leer(S), 64).toFixed(2));
    }
    return { medias, variacion: +(Math.max(...medias) / Math.max(1e-6, Math.min(...medias)) - 1).toFixed(4), pendiente: +pendiente(S, x, z).toFixed(1) };
  }

  async function bancoR8F3b(op = {}) {
    const S = window.SurviBar;
    if (!S) return { error: 'no hay SurviBar' };
    anular(S);
    if (!window.bancoDesglose) await cargarScript('/banco.js');
    const out = { giro: {}, vuelta: {}, programas: null, costo: null, capturas: null, notas: [] };
    const j = S.jugador, cam = S.camara, T = S.tiempo;
    const e0 = { p: j.posicion.clone(), g: j.giro, c: j.cabeceo, t3: j.tercerPersona, f: new Date(T.fecha.getTime()), cp: cam.position.clone(), cq: cam.quaternion.clone(), up: cam.up.clone() };
    const sem0 = [T._semillaA, T._semillaB];
    const ev0 = S.eventos?.activos ? [...S.eventos.activos] : null;
    const grupos = S.escena.children.filter((c) => AL_AZAR.includes(c.name));
    const gvis0 = grupos.map((g) => g.visible);
    try {
      // ── L4 · el costo ──────────────────────────────────────────────────────
      if (!op.sinCosto) {
        marcar({ paso: 'L4' });
        const frente = [], suelo = [];
        const SUELO = { id: 'suelo', lat: -41.0870, lon: -71.4290, altura: 1.7, rumbo: 200, cabeceo: -35 };
        await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 8 });   // calentamiento
        for (let i = 0; i < 3; i++) {
          frente.push((await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12 })).cuestaCadaPieza?.Terreno);
          suelo.push((await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12, punto: SUELO })).cuestaCadaPieza?.Terreno);
        }
        out.costo = { frente, suelo, medianaFrente: mediana(frente), medianaSuelo: mediana(suelo) };
        j.posicion.copy(e0.p); T.fecha = new Date(e0.f.getTime());
        if (op.soloCosto) { marcar({ paso: 'listo', ...out }); return out; }
      }

      // ── L1, L2 y L3 ────────────────────────────────────────────────────────
      T._semillaA = SEMILLAS[0]; T._semillaB = SEMILLAS[1];
      if (ev0) S.eventos.activos.length = 0;
      grupos.forEach((g) => { g.visible = false; });
      for (const [id, l] of Object.entries(LUGARES)) {
        marcar({ paso: `L1 ${id}` });
        await preparar(S, l, 'r8-f3b-preparar');
        grupos.forEach((g) => { g.visible = false; });
        out.giro[id] = medirGiro(S, l);
      }
      for (const [id, l] of Object.entries(LLANOS)) {
        marcar({ paso: `L2 ${id}` });
        await preparar(S, l, 'r8-f3b-preparar');
        grupos.forEach((g) => { g.visible = false; });
        out.vuelta[id] = medirVuelta(S, l);
      }
      marcar({ paso: 'L3' });
      const p0 = S.render.info.programs?.length ?? NaN;
      await preparar(S, LUGARES.ladera, 'r8-f3b-preparar');
      grupos.forEach((g) => { g.visible = false; });
      medirGiro(S, LUGARES.ladera);
      out.programas = { antes: p0, despues: S.render.info.programs?.length ?? NaN };
    } finally {
      grupos.forEach((g, i) => { g.visible = gvis0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1];
      if (ev0) { S.eventos.activos.length = 0; S.eventos.activos.push(...ev0); }
      j.posicion.copy(e0.p); j.giro = e0.g; j.cabeceo = e0.c; j.tercerPersona = e0.t3;
      T.fecha = e0.f;
      cam.up.copy(e0.up); cam.position.copy(e0.cp); cam.quaternion.copy(e0.cq); cam.updateMatrixWorld(true);
      S.calidad.aplicar?.();
      S.terreno.actualizar(cam);
      anular(S);
    }

    // ── L5 · las capturas de la fase 3, con la luz de ahora ──────────────────
    if (!op.sinCapturas) {
      marcar({ paso: 'L5' });
      await import('/.claude/flota/banco-r8-fase3.navegador.js');
      const r = await window.bancoR8F3({ soloCapturas: true, prefijo: op.prefijo || 'r8-f3b' });
      out.capturas = { total: r.total, clima: r.clima };
    }

    const checks = [];
    const ok = (c, desc, det) => checks.push({ ok: !!c, desc, detalle: String(det) });
    for (const [id, g] of Object.entries(out.giro)) {
      ok(g.variacion <= 0.02, `L1 · ${id} (${g.pendiente}°): el brillo del centro no cambia más de 2 % al girar la cámara sobre su eje`, `${g.medias.join(' · ')} (${(g.variacion * 100).toFixed(1)} %)`);
      ok(Math.max(...g.difs) <= 1.5, `L1 · ${id}: la imagen girada de vuelta calza con la del giro 0 (diferencia media ≤ 1,5)`, g.difs.join(' · '));
    }
    const vueltas = Object.entries(out.vuelta);
    ok(vueltas.length === 3 && vueltas.every(([, v]) => v.pendiente < 8), 'premisa: los tres lugares de L2 tienen menos de 8° de pendiente', vueltas.map(([id, v]) => `${id} ${v.pendiente}°`).join(', '));
    for (const [id, v] of vueltas) {
      ok(v.variacion <= 0.20, `L2 · ${id} (${v.pendiente}°): el mismo suelo, visto desde cuatro rumbos, no cambia más de 20 %`, `${v.medias.join(' · ')} (${(v.variacion * 100).toFixed(1)} %)`);
    }
    ok(out.programas && out.programas.despues === out.programas.antes, 'L3 · una segunda pasada no compila programas nuevos', JSON.stringify(out.programas));
    if (op.base && out.costo) {
      ok(out.costo.medianaFrente <= op.base.frente + 0.3, 'L4 · al frente, el terreno no sube más de 0,3 ms contra la base de la sesión', `${out.costo.frente.join(' · ')} ms, mediana ${out.costo.medianaFrente} contra ${op.base.frente}`);
      ok(out.costo.medianaSuelo <= op.base.suelo + 0.3, 'L4 · al suelo, tampoco', `${out.costo.suelo.join(' · ')} ms, mediana ${out.costo.medianaSuelo} contra ${op.base.suelo}`);
    } else out.notas.push('L4: sin base de la sesión, sólo se informa');
    if (out.capturas) ok(/^(\d+)\/\1$/.test(out.capturas.total), 'L5 · las capturas de la fase 3 salieron, con las semillas fijas', JSON.stringify(out.capturas));
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    marcar({ paso: 'listo', total: out.total });
    return out;
  }

  window.bancoR8F3b = bancoR8F3b;
})();
