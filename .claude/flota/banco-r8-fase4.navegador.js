/**
 * BANCO DE LA FASE 4 (copa), MITAD NAVEGADOR — ronda 8.
 *
 *   A1 · el árbol, restando: para cada especie, los tres árboles completos más
 *        cercanos al arranque (a más de 15 m), cada uno visto desde 18 m al sur, SOLO
 *        (su instancia sola en el lote, las demás especies y los impostores apagados,
 *        sin su sombra) contra el terreno y el cielo, prendido y apagado. Render
 *        directo (sin posproceso: sirve para la máscara, no para el color). Cobertura
 *        del recuadro y puntitos sueltos (componentes de 6 px o menos) por mil píxeles
 *        del árbol, promediados. Con las semillas del clima fijas y sin eventos.
 *        Rehecho el 19/9 (antes: un árbol, el lote entero restado, con su sombra y el
 *        clima de la carga); la base se vuelve a medir con éste, en varias cargas,
 *        porque el MODELO de cada especie se arma con Math.random al cargar.
 *   A2 · el costo: «Arboles» de `bancoDesglose`, tres corridas, contra la base de la
 *        misma sesión (`op.base`, medida con el Vegetacion.js de la base puesto un
 *        rato). Hasta +15 %.
 *   A3 · compilar: una segunda pasada por los cinco árboles no compila nada (la
 *        primera sí puede: con el panel oculto el bucle nunca corrió).
 *
 * Uso: await import('/.claude/flota/banco-r8-fase4.navegador.js'); await window.bancoR8F4({ base: { arboles } })
 *      con `{ soloCosto: true }` mide sólo A2 (para la base).
 */

(() => {
  const ESPECIES = ['coihue', 'cipres_cordillera', 'nire', 'pino_murrayana', 'maiten'];
  const FECHA = '2025-02-12T15:00:00Z';
  const SEMILLAS = [137, 23];
  // Lo que se siembra al azar, menos los árboles, que son lo medido
  const AL_AZAR = ['sotobosque', 'fauna', 'peces', 'clima', 'hornos', 'obras', 'trampas', 'jugador'];
  const POR_ESPECIE = 3;
  const marcar = (o) => { document.body.dataset.bancoR8F4 = JSON.stringify(o); };
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

  function anular(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) { if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; } }
    if (S.norma) S.norma._guardar = () => {};
  }

  /**
   * Los `n` árboles de la especie más cercanos al jugador (a más de 15 m), entre los
   * que están como malla completa. Las posiciones son deterministas (semilla por
   * celda); el MODELO de la especie no: se arma con Math.random en cada carga
   * (Vegetacion.js, construirPlanta), y por eso se miden varios y la base se promedia
   * sobre varias cargas.
   */
  function arbolesDe(S, id, n) {
    const l = S.vegetacion.lotes.find((x) => x.esp.id === id);
    if (!l) return [];
    const a = l.malla.instanceMatrix.array, p = S.jugador.posicion;
    const todos = [];
    for (let i = 0; i < l.malla.count; i++) {
      const x = a[i * 16 + 12], z = a[i * 16 + 14];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > 15) todos.push({ x, z, d });
    }
    return todos.sort((u, v) => u.d - v.d).slice(0, n);
  }

  /**
   * Un árbol SOLO contra el terreno y el cielo: todas las demás especies y los
   * impostores apagados, y de su especie sólo esa instancia (se la copia al lugar 0 y
   * la cuenta queda en 1). Antes se restaba el lote entero, y los vecinos de la misma
   * especie que caían en el cuadro agrandaban el recuadro y bajaban la cobertura.
   */
  function medirArbol(S, id, pos) {
    const V = S.vegetacion, M = S.mundo, j = S.jugador, cam = S.camara, r = S.render, gl = r.getContext();
    const l = V.lotes.find((x) => x.esp.id === id);
    const ex = pos.x, ez = pos.z + 18;
    const hy = M.alturaEn(ex, ez) + 1.7;
    j.posicion.set(ex, hy, ez);
    V.actualizar(j.posicion, S.tiempo.segundosTotales, S.tiempo.estado(), cam);
    // La instancia del árbol pedido, en el búfer de ahora
    const arr = l.malla.instanceMatrix.array;
    let k0 = -1, dm = 1e9;
    for (let i = 0; i < l.malla.count; i++) {
      const d = Math.hypot(arr[i * 16 + 12] - pos.x, arr[i * 16 + 14] - pos.z);
      if (d < dm) { dm = d; k0 = i; }
    }
    if (k0 < 0 || dm > 0.5) return null;
    const cuenta0 = l.malla.count, copia = arr.slice(0, 16);
    arr.set(arr.slice(k0 * 16, k0 * 16 + 16), 0);
    const otros = V.lotes.filter((x) => x !== l).map((x) => [x, x.malla.visible, x.impostor?.malla.visible]);
    otros.forEach(([x]) => { x.malla.visible = false; if (x.impostor) x.impostor.malla.visible = false; });
    const impVis = l.impostor?.malla.visible;
    if (l.impostor) l.impostor.malla.visible = false;
    const alto = (l.esp.alturaMaxM || 20) * 0.5;
    // Tamaño fijo, el de la medición de la base: con la ventana minimizada el lienzo
    // queda del tamaño de la ventana, que puede ser casi nada.
    r.setPixelRatio(1);
    r.setSize(819, 614, false);
    cam.aspect = 819 / 614;
    cam.updateProjectionMatrix();
    cam.position.set(ex, hy, ez);
    cam.lookAt(pos.x, M.alturaEn(pos.x, pos.z) + alto * 0.6, pos.z);
    cam.updateMatrixWorld(true);
    const leer = () => {
      const tam = r.getSize(new cam.position.constructor());
      r.setRenderTarget(null);
      r.render(S.escena, cam);
      const px = new Uint8Array(tam.x * tam.y * 4);
      gl.readPixels(0, 0, tam.x, tam.y, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { px, w: tam.x, h: tam.y };
    };
    // Sin su sombra: la sombra sobre el suelo también cambia al restar, y contaba como copa
    const v0 = l.malla.visible, sombra0 = l.malla.castShadow;
    let con, sin;
    try {
      l.malla.castShadow = false;
      l.malla.visible = true; l.malla.count = 1; l.malla.instanceMatrix.needsUpdate = true;
      con = leer();
      l.malla.visible = false;
      sin = leer();
    } finally {
      arr.set(copia, 0); l.malla.count = cuenta0; l.malla.instanceMatrix.needsUpdate = true;
      l.malla.visible = v0; l.malla.castShadow = sombra0; if (l.impostor) l.impostor.malla.visible = impVis;
      otros.forEach(([x, vm, vi]) => { x.malla.visible = vm; if (x.impostor) x.impostor.malla.visible = vi; });
    }
    const W = con.w, H = con.h, m = new Uint8Array(W * H);
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let k = 0; k < W * H; k++) {
      const d = Math.abs(con.px[k * 4] - sin.px[k * 4]) + Math.abs(con.px[k * 4 + 1] - sin.px[k * 4 + 1]) + Math.abs(con.px[k * 4 + 2] - sin.px[k * 4 + 2]);
      if (d > 24) { m[k] = 1; n++; const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const vis = new Uint8Array(W * H);
    let chicos = 0;
    for (let k = 0; k < W * H; k++) {
      if (!m[k] || vis[k]) continue;
      let area = 0; const pila = [k]; vis[k] = 1;
      while (pila.length) {
        const q = pila.pop(); area++;
        const x = q % W, y = (q / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const qq = yy * W + xx;
          if (m[qq] && !vis[qq]) { vis[qq] = 1; pila.push(qq); }
        }
      }
      if (area <= 6) chicos++;
    }
    const bbox = (x1 - x0 + 1) * (y1 - y0 + 1);
    // Relleno: píxeles del árbol sobre el área de su envolvente convexa. La cobertura
    // del recuadro castiga la forma (un cono macizo llena la mitad de su recuadro); el
    // relleno mide los huecos, que es lo que se ve como esqueleto. La envolvente de
    // todos los píxeles es la de los extremos de cada fila (Andrew, cadena monótona).
    const pts = [];
    for (let y = y0; y <= y1; y++) {
      let a = -1, b = -1;
      for (let x = x0; x <= x1; x++) if (m[y * W + x]) { if (a < 0) a = x; b = x; }
      if (a >= 0) { pts.push([a, y], [b + 1, y], [a, y + 1], [b + 1, y + 1]); }
    }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cruz = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const baja = [], alta = [];
    for (const p of pts) { while (baja.length >= 2 && cruz(baja[baja.length - 2], baja[baja.length - 1], p) <= 0) baja.pop(); baja.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (alta.length >= 2 && cruz(alta[alta.length - 2], alta[alta.length - 1], p) <= 0) alta.pop(); alta.push(p); }
    const casco = baja.slice(0, -1).concat(alta.slice(0, -1));
    let area2 = 0;
    for (let i = 0; i < casco.length; i++) { const p = casco[i], q = casco[(i + 1) % casco.length]; area2 += p[0] * q[1] - q[0] * p[1]; }
    const relleno = n / Math.max(1, Math.abs(area2) / 2);
    return { pixeles: n, cobertura: +(n / Math.max(1, bbox)).toFixed(3), relleno: +relleno.toFixed(3), confetiPorMil: +(chicos / Math.max(1, n) * 1000).toFixed(2), con, W, H };
  }

  async function guardarPng(nombre, con) {
    const { px, w: W, h: H } = con;
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const ctx = c2.getContext('2d'); const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    await fetch('/api/captura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, datos: c2.toDataURL('image/png') }) });
  }

  async function bancoR8F4(op = {}) {
    const S = window.SurviBar;
    if (!S) return { error: 'no hay SurviBar' };
    anular(S);
    if (!window.bancoDesglose) await cargarBanco();
    const j = S.jugador, cam = S.camara;
    const e0 = { p: j.posicion.clone(), g: j.giro, c: j.cabeceo, t3: j.tercerPersona, f: new Date(S.tiempo.fecha.getTime()), cp: cam.position.clone(), cq: cam.quaternion.clone() };
    const out = { arboles: {}, costo: null, programas: null, notas: [] };
    const T = S.tiempo;
    const sem0 = [T._semillaA, T._semillaB];
    const ev0 = S.eventos?.activos ? [...S.eventos.activos] : null;
    const grupos = S.escena.children.filter((c) => AL_AZAR.includes(c.name));
    const gvis0 = grupos.map((g) => g.visible);
    const checks = [];
    const ok = (c, desc, det) => checks.push({ ok: !!c, desc, detalle: String(det) });
    try {
      // A2 · el costo
      marcar({ paso: 'A2' });
      const arb = [];
      await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 8 });      // calentamiento
      for (let i = 0; i < 3; i++) arb.push((await window.bancoDesglose({ ancho: 1024, alto: 576, cuadros: 12 })).cuestaCadaPieza?.Arboles);
      out.costo = { corridas: arb, mediana: mediana(arb) };
      j.posicion.copy(e0.p); S.tiempo.fecha = new Date(e0.f.getTime());
      if (op.soloCosto) { marcar({ paso: 'listo', ...out }); return out; }

      // A1 · los árboles, y A3 · compilar. Dos pasadas: la primera compila lo que
      // haga falta (con el panel oculto el bucle nunca corrió y la base también compila
      // doce programas la primera vez); la segunda tiene que no compilar nada.
      marcar({ paso: 'A1' });
      // El clima con las semillas fijas y sin eventos, y apagado lo demás que se siembra
      // al azar (ver banco-r8-fase3.navegador.js, T3): el umbral de la resta depende del
      // brillo, y el brillo de la misma vista cambiaba un 25 % entre cargas.
      T._semillaA = SEMILLAS[0]; T._semillaB = SEMILLAS[1];
      if (ev0) S.eventos.activos.length = 0;
      grupos.forEach((g) => { g.visible = false; });
      // Una captura deja el sol, las luces de las cascadas, la niebla y la exposición
      // de esa fecha y ese clima; después se dibuja directo.
      await window.capturar(`${op.prefijo || 'r8-f4'}-preparar`, { fecha: FECHA, ancho: 819, alto: 614, conFauna: false });
      grupos.forEach((g) => { g.visible = false; });
      S.vegetacion.actualizar(j.posicion, T.segundosTotales, T.estado(), cam);
      const posiciones = {};
      for (const id of ESPECIES) posiciones[id] = arbolesDe(S, id, POR_ESPECIE);
      let p0 = NaN;
      for (const pasada of [1, 2]) {
        if (pasada === 2) p0 = S.render.info.programs?.length ?? NaN;
        for (const id of ESPECIES) {
          const medidos = [];
          for (const [k, pos] of posiciones[id].entries()) {
            const r = medirArbol(S, id, pos);
            if (!r) continue;
            medidos.push(r);
            if (pasada === 2 && k === 0 && op.guardar !== false) await guardarPng(`${op.prefijo || 'r8-f4'}-arbol-${id}`, r.con);
            await esperar(20);
          }
          if (pasada === 2) {
            const prom = (f) => +(medidos.reduce((s, m) => s + m[f], 0) / Math.max(1, medidos.length)).toFixed(3);
            out.arboles[id] = medidos.length ? {
              cobertura: prom('cobertura'), relleno: prom('relleno'), confetiPorMil: prom('confetiPorMil'), arboles: medidos.length,
              uno: medidos.map((m) => [m.cobertura, m.relleno, m.confetiPorMil]),
            } : null;
          }
        }
      }
      const p1 = S.render.info.programs?.length ?? NaN;
      out.programas = { antes: p0, despues: p1 };
      out.clima = { semillas: [T._semillaA, T._semillaB], nubosidad: +T.estado().nubosidad.toFixed(3) };
    } finally {
      grupos.forEach((g, i) => { g.visible = gvis0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1];
      if (ev0) { S.eventos.activos.length = 0; S.eventos.activos.push(...ev0); }
      j.posicion.copy(e0.p); j.giro = e0.g; j.cabeceo = e0.c; j.tercerPersona = e0.t3;
      S.tiempo.fecha = e0.f;
      cam.position.copy(e0.cp); cam.quaternion.copy(e0.cq); cam.updateMatrixWorld(true);
      S.calidad.aplicar?.();
      S.vegetacion.actualizar(j.posicion, S.tiempo.segundosTotales, S.tiempo.estado(), cam);
      anular(S);
    }
    const A = out.arboles;
    ok(A.cipres_cordillera && A.cipres_cordillera.cobertura >= 0.20, 'A1 · el ciprés cubre 0,20 o más de su recuadro (base 0,088)', JSON.stringify(A.cipres_cordillera));
    ok(A.pino_murrayana && A.pino_murrayana.cobertura >= 0.12, 'A1 · el pino cubre 0,12 o más (base 0,053)', JSON.stringify(A.pino_murrayana));
    ok(A.cipres_cordillera && A.cipres_cordillera.confetiPorMil <= 5, 'A1 · el ciprés tiene 5 puntitos sueltos por mil o menos (base 10,73)', A.cipres_cordillera?.confetiPorMil);
    ok(A.pino_murrayana && A.pino_murrayana.confetiPorMil <= 5, 'A1 · el pino tiene 5 por mil o menos (base 17,73)', A.pino_murrayana?.confetiPorMil);
    ok(A.coihue && A.coihue.confetiPorMil <= 4.5, 'A1 · el coihue no pasa de 4,5 por mil (base 3,75)', A.coihue?.confetiPorMil);
    ok(out.programas && out.programas.despues === out.programas.antes, 'A3 · una segunda pasada por los árboles no compila programas nuevos', JSON.stringify(out.programas));
    if (op.base?.arboles != null) ok(out.costo.mediana <= op.base.arboles * 1.15, 'A2 · los árboles no cuestan más de un 15 % que la base de la sesión', `${out.costo.corridas.join(' · ')} ms, mediana ${out.costo.mediana} contra ${op.base.arboles}`);
    else out.notas.push('A2: sin base de la sesión, sólo se informa');
    out.checks = checks;
    out.total = `${checks.filter((c) => c.ok).length}/${checks.length}`;
    marcar({ paso: 'listo', ...out });
    return out;
  }

  window.bancoR8F4 = bancoR8F4;
})();
