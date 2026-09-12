/**
 * BANCO DE LA FASE 2 (suelo), MITAD NAVEGADOR — ronda 5.
 *
 * Lo corre el jefe en la vista previa, inyectado como módulo, con el cableado
 * de `main.js` aplicado. Escrito contra el contrato de RONDA5.md.
 *
 *   1. NOCHE — a las 23:40, sin luz, la luminancia del cuadro baja al menos un
 *      70 % contra el MISMO cuadro con `uLuzCielo` forzado a 1; y al mediodía del
 *      15/2 las dos imágenes son iguales al píxel (diferencia media < 0,5).
 *   2. COSTO — alternado en tres rondas contra una variante que saca el factor
 *      del sombreador. Guarda: la variante sin factor, a medianoche, tiene que
 *      verse como la de factor forzado a 1; si no, no midió lo que dice.
 *   3. ORILLA — perfil de profundidad sobre la línea de la captura de apertura,
 *      y tres capturas: mediodía, atardecer y de cerca.
 *   4. NOCHE EN IMAGEN — las mismas dos capturas nocturnas de la fase 1, para
 *      compararlas lado a lado.
 */

(() => {
  const PUNTO = { id: 'bosque', lat: -41.0870, lon: -71.4290, altura: 2, rumbo: 20, cabeceo: -4 };
  const W = 1024, H = 576;
  const TOPE_COSTO = 0.2;
  const ORILLA = { x: 7633.687591622163, z: -2942.5840000003213 };   // la de las capturas de apertura
  const marcar = (o) => { document.body.dataset.bancoR5F2 = JSON.stringify(o); };

  async function three() {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/\.vite\/deps\/three\.js/.test(n));
    return import(url);
  }

  window.bancoR5F2 = async function bancoR5F2(o = {}) {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, capturas: [], fin: false };
    const ok = (c, desc, det) => { out.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); marcar(out); return !!c; };
    try {
      const THREE = await three();
      const { render, compositor, escena, camara, agua, calidad, mundo } = S;
      const gl = render.getContext();
      calidad.automatico = false;
      if (S.partida) S.partida.guardar = () => {};
      if (typeof window.banco !== 'function') throw new Error('falta /banco.js');

      const fijar = () => {
        render.setPixelRatio(1); render.setSize(W, H, false);
        compositor.setPixelRatio(1); compositor.setSize(W, H); S.oclusion?.setSize(W, H);
        calidad.ctx?.suavizado?.material?.uniforms?.resolution?.value.set(1 / W, 1 / H);
        camara.aspect = W / H; camara.updateProjectionMatrix(); S.csm.updateFrustums();
        compositor.renderToScreen = false;
      };
      const cuadro = () => { S.juntarLuces?.(); agua.dibujarReflejo(render, escena, camara); compositor.render(); };
      const asentar = async (fecha, punto = PUNTO) => { await window.banco({ ancho: W, alto: H, cuadros: 2, puntos: [punto], fecha }); fijar(); S.equipo?.apagar?.(); };

      // Imagen final a 8 bits, como la ve el jugador
      const copia8 = new THREE.WebGLRenderTarget(256, 144, { type: THREE.UnsignedByteType });
      const matCopia = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
      const escCopia = new THREE.Scene(); escCopia.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matCopia));
      const camCopia = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camCopia.position.z = 1;
      const imagen = () => {
        cuadro();
        matCopia.map = compositor.readBuffer.texture; matCopia.needsUpdate = true;
        render.setRenderTarget(copia8); render.clear(); render.render(escCopia, camCopia); render.setRenderTarget(null);
        const px = new Uint8Array(256 * 144 * 4); render.readRenderTargetPixels(copia8, 0, 0, 256, 144, px);
        return px;
      };
      const luminancia = (px) => { let s = 0, n = 0; for (let y = 0; y < 86; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 4; s += px[i] + px[i + 1] + px[i + 2]; n++; } return s / n / 3; };
      const diferencia = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; return s / (a.length / 4); };

      // Los uniformes vivos de uLuzCielo, de lo que ya compiló
      await asentar('2024-02-15T23:40:00');
      cuadro(); cuadro();
      const materiales = new Set();
      escena.traverse((x) => { const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []; for (const m of ms) materiales.add(m); });
      const conLuz = [...materiales].filter((m) => render.properties.get(m)?.uniforms?.uLuzCielo);
      const uniformes = [...new Set(conLuz.map((m) => render.properties.get(m).uniforms.uLuzCielo))];
      ok(conLuz.length >= 3, 'premisa: hay materiales vivos con uLuzCielo (sotobosque y árboles)', `${conLuz.length} materiales · ${uniformes.length} uniformes`);
      const valorNoche = uniformes[0]?.value;
      ok(Number.isFinite(valorNoche) && valorNoche < 0.2, 'a las 23:40 el juego escribió uLuzCielo bajo', valorNoche);
      const forzar = (v) => { const g = uniformes.map((u) => u.value); uniformes.forEach((u) => { u.value = v; }); return () => uniformes.forEach((u, i) => { u.value = g[i]; }); };

      // ── 1 · NOCHE ────────────────────────────────────────────────────────
      const noche = imagen();
      let volver = forzar(1);
      const nocheUno = imagen();
      volver();
      const lN = luminancia(noche), lU = luminancia(nocheUno);
      out.numeros.nocheLuminancia = { conFactor: +lN.toFixed(2), factorUno: +lU.toFixed(2) };
      ok(lU > 1, 'premisa: con el factor en 1 la noche tiene brillo que medir (el defecto de la apertura)', lU.toFixed(2));
      ok(lN <= lU * 0.3, 'a medianoche la luminancia cae al menos un 70 % contra el factor en 1', `${lU.toFixed(2)} → ${lN.toFixed(2)}`);

      await asentar('2024-02-15T12:00:00');
      cuadro();
      // El mediodía NO siempre da factor 1: la nubosidad sale de una semilla al
      // azar y un cielo limpio manda menos luz difusa. Lo avisó el agente. Así
      // que se compara contra el factor que corresponde a ESE cielo, y la prueba
      // de 'igual al píxel contra 1' sólo corre cuando el cielo da 1.
      const valorDia = uniformes[0]?.value;
      const iCielo = S.cielo?.intensidadCielo ?? NaN;
      const esperado = Math.min(1, iCielo / 0.85);
      out.numeros.mediodia = { intensidadCielo: +iCielo.toFixed(3), factor: +valorDia.toFixed(3), esperado: +esperado.toFixed(3) };
      ok(Math.abs(valorDia - esperado) < 0.01, 'al mediodía el factor es el que corresponde a la luz de ese cielo', JSON.stringify(out.numeros.mediodia));
      const dia = imagen();
      volver = forzar(esperado);
      const diaIgual = imagen();
      volver();
      ok(diferencia(dia, diaIgual) < 0.5, 'al mediodía la imagen coincide con la del factor esperado', diferencia(dia, diaIgual).toFixed(3));
      if (esperado >= 0.999) {
        volver = forzar(1);
        const diaUno = imagen();
        volver();
        const dDia = diferencia(dia, diaUno);
        out.numeros.mediodiaDiferencia = +dDia.toFixed(3);
        ok(dDia < 0.5, 'al mediodía la imagen es igual al píxel a la del factor en 1', dDia.toFixed(3));
      } else out.notas = (out.notas || []).concat(`mediodía con nubes bajas: factor ${valorDia.toFixed(3)}, no se compara contra 1`);

      // ── 2 · COSTO ────────────────────────────────────────────────────────
      window.__sinLuzCielo = false;
      for (const m of conLuz) {
        if (m.__r5f2) continue;
        m.__r5f2 = true;
        const ob = m.onBeforeCompile;
        m.onBeforeCompile = function (sh, r) {
          ob.call(this, sh, r);
          if (window.__sinLuzCielo) sh.fragmentShader = sh.fragmentShader.replace(/\s*\*\s*uLuzCielo\b/g, '').replace(/\buLuzCielo\s*\*\s*/g, '');
        };
        const k = m.customProgramCacheKey;
        m.customProgramCacheKey = function () { return k.call(this) + (window.__sinLuzCielo ? '|sinLuzCielo' : ''); };
      }
      const modo = (sin) => { window.__sinLuzCielo = sin; for (const m of conLuz) m.needsUpdate = true; };
      // Guarda: sin factor, a medianoche, tiene que verse como el factor en 1
      await asentar('2024-02-15T23:40:00');
      modo(true);
      const t0 = performance.now(); cuadro(); out.numeros.cpuCompilarSinFactor = +(performance.now() - t0).toFixed(0);
      const sinFactor = imagen();
      modo(false);
      volver = forzar(1);
      const conUno = imagen();
      volver();
      const dGuarda = diferencia(sinFactor, conUno);
      ok(dGuarda < 0.5, 'guarda: la variante sin factor se ve igual que el factor en 1 (el recorte del sombreador funcionó)', dGuarda.toFixed(3));

      await asentar('2024-02-15T11:00:00');
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const medir = async () => {
        for (let k = 0; k < 4; k++) cuadro();
        const qs = [];
        for (let k = 0; k < 16; k++) { const qq = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq); cuadro(); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(qq); }
        gl.flush();
        const m = [];
        for (const qq of qs) {
          for (let i = 0; i < 80; i++) { if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) break; await new Promise((r) => setTimeout(r, 0)); }
          if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) m.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(qq);
        }
        m.sort((a, b) => a - b);
        return m.length ? +m[Math.floor(m.length / 2)].toFixed(2) : NaN;
      };
      ok(!!ext, 'premisa: hay reloj de GPU');
      const tabla = { sin: [], con: [] };
      for (let ronda = 0; ronda < 3; ronda++) {
        modo(true); cuadro(); tabla.sin.push(await medir());
        modo(false); cuadro(); tabla.con.push(await medir());
        out.numeros.costo = tabla; marcar(out);
      }
      const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const delta = media(tabla.con) - media(tabla.sin);
      out.numeros.costoDelta = +delta.toFixed(2);
      ok(delta <= TOPE_COSTO, `el factor cuesta ≤ +${TOPE_COSTO} ms`, delta.toFixed(2));
      modo(false);

      // ── 3 · ORILLA ───────────────────────────────────────────────────────
      const perfil = [];
      let bordeProf = null;
      for (let d = -3; d <= 20; d += 0.25) {
        const z = ORILLA.z - d;
        const esAgua = mundo.esAgua(ORILLA.x, z);
        const prof = esAgua ? +(mundo.superficieEn(ORILLA.x, z) - mundo.alturaEn(ORILLA.x, z)).toFixed(2) : 0;
        perfil.push([d, esAgua ? 1 : 0, prof]);
        if (esAgua && bordeProf === null) bordeProf = prof;
      }
      out.numeros.perfilOrilla = perfil;
      ok(bordeProf !== null && bordeProf <= 1.0, 'en la línea de la captura de apertura, la primera agua tiene ≤ 1 m (antes 9,79)', bordeProf);
      if (o.capturas !== false && typeof window.capturar === 'function') {
        const lejos = mundo.aLatLon(ORILLA.x, ORILLA.z + 6), cerca = mundo.aLatLon(ORILLA.x, ORILLA.z + 1.2);
        for (const [nombre, opc] of [
          ['r5f2-orilla-mediodia', { lat: lejos.lat, lon: lejos.lon, altura: 1.7, rumbo: 0, cabeceo: -24, fecha: '2024-02-15T12:30:00' }],
          ['r5f2-orilla-atardecer', { lat: lejos.lat, lon: lejos.lon, altura: 1.7, rumbo: 0, cabeceo: -24, fecha: '2024-02-15T20:40:00' }],
          ['r5f2-orilla-cerca', { lat: cerca.lat, lon: cerca.lon, altura: 1.7, rumbo: 0, cabeceo: -55, fecha: '2024-02-15T12:30:00' }],
        ]) {
          out.capturas.push({ nombre, ...(await window.capturar(nombre, { ancho: W, alto: H, conFauna: false, ...opc })) });
          marcar(out);
        }
        // ── 4 · NOCHE EN IMAGEN ───────────────────────────────────────────
        const lejosFogata = { lat: PUNTO.lat - 0.0012, lon: PUNTO.lon, altura: 2, rumbo: 20, cabeceo: -12, fecha: '2024-02-15T23:40:00', conFauna: false };
        const renderOrig = compositor.render.bind(compositor);
        compositor.render = (...a) => { S.juntarLuces?.(); return renderOrig(...a); };
        S.equipo?.apagar?.();
        out.capturas.push({ nombre: 'r5f2-noche-sin-luz', ...(await window.capturar('r5f2-noche-sin-luz', { ancho: W, alto: H, ...lejosFogata })) });
        S.tiempo.fecha = new Date(lejosFogata.fecha);
        S.equipo?.guardar?.('antorcha'); S.equipo?.encender?.('antorcha', new Date(lejosFogata.fecha).getTime());
        out.capturas.push({ nombre: 'r5f2-noche-antorcha', ...(await window.capturar('r5f2-noche-antorcha', { ancho: W, alto: H, ...lejosFogata })) });
        S.equipo?.apagar?.();
        compositor.render = renderOrig;
      }

      compositor.renderToScreen = true;
      calidad.aplicar();
      out.fin = true;
    } catch (e) {
      out.error = `${e.message} | ${(e.stack || '').split('\n').slice(0, 4).join(' | ')}`;
    }
    out.verdes = out.checks.filter((c) => c.ok).length;
    out.rojos = out.checks.filter((c) => !c.ok).map((c) => `${c.desc} [${c.detalle}]`);
    marcar(out);
    return out;
  };
})();
