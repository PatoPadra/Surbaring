/**
 * Ronda 8 · fase 3 · ¿está bien filtrado el suelo a 10–40 m?
 *
 * Reemplaza a la guarda de «detalle a 10–40 m ≤ ×1,6 de la base», que no distinguía
 * el detalle de verdad del aliasing (lo mostró el agente `suelo`: la hojarasca bien
 * filtrada tiene más bordes que la mancha borrosa de antes, y la guarda la castigaba).
 *
 * El instrumento: la misma vista renderizada a 1024×576 y a 2048×1152, la de 2×
 * reducida a 1× con un promedio de 2×2, y la diferencia media absoluta de luminancia en
 * la franja del medio (del 38 al 60 % desde arriba, 10–40 m mirando a −8°). Una textura
 * bien filtrada da casi lo mismo en las dos; una sub-filtrada (aliasing) difiere, y una
 * sobre-filtrada (desenfocada de más) también. **El mejor filtrado es el que menos
 * difiere**, y así el instrumento castiga los dos errores y no premia ninguno.
 *
 * Render directo, sin posproceso, con el sotobosque y los árboles apagados: sólo el
 * terreno y el cielo. Determinista: dos corridas dan lo mismo.
 *
 * Uso: await import('/.claude/flota/r8-filtrado.navegador.js'); await window.medirFiltrado()
 *      `medirFiltrado({ cabeceo: -35, desde: 0.55, hasta: 0.98 })` mide la franja cercana (fracciones desde arriba).
 */

(() => {
  const LUGARES = { bosque: [-41.05186, -71.60042], estepa: [-41.05534, -71.26063], pedregal: [-41.18125, -71.54561] };

  window.medirFiltrado = async function medirFiltrado(op = {}) {
    const cabeceo = op.cabeceo ?? -8, desde = op.desde ?? 0.38, hasta = op.hasta ?? 0.60;
    const S = window.SurviBar;
    const cam = S.camara, r = S.render, gl = r.getContext(), M = S.mundo;
    const so = S.sotobosque, V = S.vegetacion;
    const vis = so.lotes.map((l) => l.malla.visible);
    const veg = V.lotes.map((l) => [l.malla.visible, l.impostor?.malla.visible]);
    const c0 = { p: cam.position.clone(), q: cam.quaternion.clone() };
    const leer = (W, H) => {
      r.setPixelRatio(1); r.setSize(W, H, false);
      cam.aspect = W / H; cam.updateProjectionMatrix();
      S.terreno.actualizar(cam);
      r.setRenderTarget(null); r.render(S.escena, cam);
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const L = new Float32Array(W * H);
      for (let k = 0; k < W * H; k++) L[k] = 0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2];
      return L;
    };
    const res = {};
    try {
      so.lotes.forEach((l) => { l.malla.visible = false; });
      V.lotes.forEach((l) => { l.malla.visible = false; if (l.impostor) l.impostor.malla.visible = false; });
      for (const [id, [lat, lon]] of Object.entries(LUGARES)) {
        const p = M.aMundo(lat, lon);
        const y = M.alturaEn(p.x, p.z) + 1.7;
        const g = 200 * Math.PI / 180, cb = cabeceo * Math.PI / 180;
        cam.position.set(p.x, y, p.z);
        cam.lookAt(p.x - Math.sin(g) * Math.cos(cb) * 10, y + Math.sin(cb) * 10, p.z - Math.cos(g) * Math.cos(cb) * 10);
        cam.updateMatrixWorld(true);
        const a = leer(1024, 576), b = leer(2048, 1152);
        let d = 0, m = 0;
        for (let yy = 0; yy < 576; yy++) {
          const fr = 1 - yy / 576;                       // desde arriba: readPixels lee de abajo hacia arriba
          if (fr < desde || fr > hasta) continue;
          for (let xx = 0; xx < 1024; xx++) {
            const k2 = (2 * yy) * 2048 + 2 * xx;
            const ds = (b[k2] + b[k2 + 1] + b[k2 + 2048] + b[k2 + 2049]) / 4;
            d += Math.abs(a[yy * 1024 + xx] - ds); m++;
          }
        }
        res[id] = +(d / m).toFixed(3);
      }
    } finally {
      so.lotes.forEach((l, i) => { l.malla.visible = vis[i]; });
      V.lotes.forEach((l, i) => { l.malla.visible = veg[i][0]; if (l.impostor) l.impostor.malla.visible = veg[i][1]; });
      cam.position.copy(c0.p); cam.quaternion.copy(c0.q);
      S.calidad.aplicar?.();
      S.terreno.actualizar(cam);
    }
    return res;
  };
})();
