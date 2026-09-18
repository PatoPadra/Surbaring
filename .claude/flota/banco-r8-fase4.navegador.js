/**
 * BANCO DE LA FASE 4 (copa), MITAD NAVEGADOR — ronda 8.
 *
 *   A1 · el árbol, restando: para cada especie, el árbol completo más cercano al
 *        arranque (a más de 15 m), visto desde 18 m al sur, con su lote prendido y
 *        apagado. Render directo (sin posproceso: sirve para la máscara, no para el
 *        color). Cobertura del recuadro y puntitos sueltos (componentes de 6 px o
 *        menos) por mil píxeles del árbol. Es el instrumento con que se midió la base
 *        (RONDA8.md, fase 4, punto 3).
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

  /** El árbol de la especie más cercano al jugador, entre los que están como malla completa. */
  function arbolDe(S, id) {
    const l = S.vegetacion.lotes.find((x) => x.esp.id === id);
    if (!l) return null;
    const a = l.malla.instanceMatrix.array, p = S.jugador.posicion;
    let mejor = null, dm = 1e9;
    for (let i = 0; i < l.malla.count; i++) {
      const x = a[i * 16 + 12], z = a[i * 16 + 14];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > 15 && d < dm) { dm = d; mejor = { x, z }; }
    }
    return mejor && { ...mejor, lote: l };
  }

  function medirArbol(S, id, pos) {
    const V = S.vegetacion, M = S.mundo, j = S.jugador, cam = S.camara, r = S.render, gl = r.getContext();
    const l = V.lotes.find((x) => x.esp.id === id);
    const ex = pos.x, ez = pos.z + 18;
    const hy = M.alturaEn(ex, ez) + 1.7;
    j.posicion.set(ex, hy, ez);
    V.actualizar(j.posicion, S.tiempo.segundosTotales, S.tiempo.estado(), cam);
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
    const con = leer();
    const v0 = l.malla.visible, vi = l.impostor?.malla.visible;
    l.malla.visible = false; if (l.impostor) l.impostor.malla.visible = false;
    const sin = leer();
    l.malla.visible = v0; if (l.impostor) l.impostor.malla.visible = vi;
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
    return { pixeles: n, cobertura: +(n / Math.max(1, bbox)).toFixed(3), confetiPorMil: +(chicos / Math.max(1, n) * 1000).toFixed(2), con, W, H };
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
      S.vegetacion.actualizar(j.posicion, S.tiempo.segundosTotales, S.tiempo.estado(), cam);
      const posiciones = {};
      for (const id of ESPECIES) posiciones[id] = arbolDe(S, id);
      let p0 = NaN;
      for (const pasada of [1, 2]) {
        if (pasada === 2) p0 = S.render.info.programs?.length ?? NaN;
        for (const id of ESPECIES) {
          const pos = posiciones[id];
          if (!pos) { out.arboles[id] = null; continue; }
          const r = medirArbol(S, id, pos);
          if (pasada === 2) {
            out.arboles[id] = { cobertura: r.cobertura, confetiPorMil: r.confetiPorMil, pixeles: r.pixeles };
            if (op.guardar !== false) await guardarPng(`${op.prefijo || 'r8-f4'}-arbol-${id}`, r.con);
          }
          await esperar(30);
        }
      }
      const p1 = S.render.info.programs?.length ?? NaN;
      out.programas = { antes: p0, despues: p1 };
    } finally {
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
