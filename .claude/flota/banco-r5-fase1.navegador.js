/**
 * BANCO DE LA FASE 1 (lumbre), MITAD NAVEGADOR — ronda 5.
 *
 * Lo que un banco de Node no puede ver: el juego real compilando, dibujando y
 * gastando GPU. Lo corre el jefe en la vista previa, inyectado, con el
 * cableado de `main.js` ya aplicado. Escrito contra el contrato de RONDA5.md y
 * contra lo que el jefe expone en `window.SurviBar` (`luces`, `juntarLuces`).
 *
 *   1. COMPILACIÓN — encender y apagar la antorcha, construir y prender una
 *      fogata por el sistema de verdad, y un incendio forestal: los programas del
 *      terreno, la vegetación y el sotobosque tienen que ser LOS MISMOS objetos
 *      antes y después, y el primer cuadro después de cada cosa tiene que tardar
 *      poco. Al abrir la ronda, agregar una luz tardó 19 254 ms.
 *   2. LA LUZ LLEGA — de noche, con la imagen que sale del compositor (mapeo
 *      tonal y exposición incluidos), la antorcha aclara el suelo delante del
 *      jugador. Es la guarda de cobertura de todo lo demás: sin esto, «cuesta
 *      poco» podría ser el costo de un bloque que no se ejecuta.
 *   3. COSTO — Baja 1024×576, punto `bosque`, alternado en tres rondas:
 *      A sin bloque (chunks prístinos de three) · B bloque con 0 luces ·
 *      C con la antorcha · D con antorcha y fogata. Topes de RONDA5.md.
 *   4. CAPTURAS — noche sin luz, noche con antorcha, noche junto a la fogata,
 *      tercera persona con antorcha, y mediodía con antorcha.
 *
 * Uso, desde un script inyectado en la página:
 *   const s = document.createElement('script');
 *   s.src = '/.claude/…'   // o textContent con este archivo
 *   await window.bancoR5F1()   // progreso en document.body.dataset.bancoR5F1
 */

(() => {
  const PUNTO = { id: 'bosque', lat: -41.0870, lon: -71.4290, altura: 2, rumbo: 20, cabeceo: -4 };
  const W = 1024, H = 576;
  const TOPES = { apagada: 0.6, una: 1.0, dos: 1.8 };
  const TOPE_CPU_MS = 2500;

  const marcar = (o) => { document.body.dataset.bancoR5F1 = JSON.stringify(o); };

  async function three() {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/\.vite\/deps\/three\.js/.test(n));
    if (!url) throw new Error('no encuentro el módulo de three que cargó el juego');
    return import(url);
  }

  function relojGPU(gl) {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return null;
    return async (dibujar, cuadros = 16, calentar = 4) => {
      for (let k = 0; k < calentar; k++) dibujar();
      const qs = [];
      for (let k = 0; k < cuadros; k++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); dibujar(); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); }
      gl.flush();
      const m = [];
      for (const q of qs) {
        for (let i = 0; i < 80; i++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await new Promise((r) => setTimeout(r, 0)); }
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) m.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      m.sort((a, b) => a - b);
      return m.length ? m[Math.floor(m.length / 2)] : NaN;
    };
  }

  window.bancoR5F1 = async function bancoR5F1(o = {}) {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, capturas: [], fin: false };
    const ok = (cond, desc, detalle) => { out.checks.push({ ok: !!cond, desc, detalle: detalle === undefined ? undefined : String(detalle) }); marcar(out); return !!cond; };
    try {
      const THREE = await three();
      const { render, compositor, escena, camara, agua, calidad, equipo, fundicion, hornos, eventos, clima, tiempo } = S;
      const gl = render.getContext();
      calidad.automatico = false;
      if (S.partida) S.partida.guardar = () => {};   // que el banco no ensucie la partida

      ok(!!S.luces && typeof S.juntarLuces === 'function', 'premisa: main.js expone luces y juntarLuces');
      ok(/Intel|NVIDIA|AMD|ANGLE/i.test(calidad.placa), 'premisa: hay placa', calidad.placa);
      ok(calidad.preset.nombre === 'Baja', 'premisa: preset Baja', calidad.preset.nombre);

      // Asentar con el banco viejo y fijar tamaño
      if (typeof window.banco !== 'function') throw new Error('falta /banco.js cargado');
      await window.banco({ ancho: W, alto: H, cuadros: 3, puntos: [PUNTO] });
      const fijar = () => {
        render.setPixelRatio(1); render.setSize(W, H, false);
        compositor.setPixelRatio(1); compositor.setSize(W, H); S.oclusion?.setSize(W, H);
        calidad.ctx?.suavizado?.material?.uniforms?.resolution?.value.set(1 / W, 1 / H);
        camara.aspect = W / H; camara.updateProjectionMatrix(); S.csm.updateFrustums();
      };
      fijar();
      compositor.renderToScreen = false;
      const cuadro = () => { S.juntarLuces(); agua.dibujarReflejo(render, escena, camara); compositor.render(); };
      const cronometrar = () => { const t = performance.now(); cuadro(); gl.getParameter(gl.MAX_TEXTURE_SIZE); return +(performance.now() - t).toFixed(1); };

      // ── 1 · COMPILACIÓN ────────────────────────────────────────────────────
      const lote = (lotes) => (lotes || []).find((l) => l.malla?.count > 0)?.malla.material || lotes?.[0]?.malla.material;
      const vigilados = { terreno: S.terreno.material, vegetacion: lote(S.vegetacion.lotes), sotobosque: lote(S.sotobosque.lotes) };
      const programa = (m) => render.properties.get(m)?.currentProgram;
      cuadro(); cuadro();
      const antes = Object.fromEntries(Object.entries(vigilados).map(([k, m]) => [k, programa(m)]));
      ok(Object.values(antes).every(Boolean), 'premisa: los tres materiales vigilados tienen programa', Object.keys(antes).filter((k) => !antes[k]).join(',') || 'los tres');
      const mismos = () => Object.entries(vigilados).filter(([k, m]) => programa(m) !== antes[k]).map(([k]) => k);
      const lucesThree = () => { let n = 0; escena.traverse((x) => { if (x.isPointLight || x.isSpotLight) n++; }); return n; };
      ok(lucesThree() === 0, 'ninguna PointLight/SpotLight en la escena del juego', lucesThree());

      const ms = () => tiempo.fecha.getTime();
      equipo.guardar('antorcha');
      const enc = equipo.encender('antorcha', ms());
      ok(enc?.ok, 'premisa: la antorcha encendió en el juego', JSON.stringify(enc));
      let cpu = cronometrar();
      out.numeros.cpuEncenderAntorcha = cpu;
      ok(S.luces.activas >= 1, 'con la antorcha encendida hay al menos una luz activa', S.luces.activas);
      ok(mismos().length === 0, 'encender la antorcha no recompila terreno, vegetación ni sotobosque', mismos().join(',') || 'ninguno');
      ok(cpu < TOPE_CPU_MS, `encender la antorcha: primer cuadro < ${TOPE_CPU_MS} ms`, cpu);

      equipo.apagar();
      cpu = cronometrar();
      out.numeros.cpuApagarAntorcha = cpu;
      ok(mismos().length === 0, 'apagar la antorcha no recompila nada', mismos().join(',') || 'ninguno');
      ok(cpu < TOPE_CPU_MS, `apagar la antorcha: primer cuadro < ${TOPE_CPU_MS} ms`, cpu);

      const evaluarOrig = fundicion.evaluarFuego.bind(fundicion);
      fundicion.evaluarFuego = () => ({ permitido: true, jurisdiccion: 'banco' });
      S.inventario.agregar('lena', 20); S.inventario.agregar('piedra', 10);
      for (const h of [...fundicion.hornos]) if (Math.hypot(h.x - S.jugador.posicion.x, h.z - S.jugador.posicion.z) < 4) S.jugador.posicion.x += 6;
      const fogata = fundicion.construir(fundicion.hornoPorId('fogata'));
      fundicion.evaluarFuego = evaluarOrig;
      ok(!!fogata, 'premisa: la fogata se construyó por el sistema (con el envoltorio de main.js)');
      if (fogata) {
        fogata.fuego = { hasta: ms() + 10 * 3600e3 };
        fogata.ardiendo = true;
        for (let k = 0; k < 60; k++) hornos.actualizar(tiempo.segundosTotales + k / 60);
        out.numeros.fogata = { x: fogata.x, y: fogata.y, z: fogata.z };
      }
      cpu = cronometrar();
      out.numeros.cpuFogata = cpu;
      ok(lucesThree() === 0, 'con la fogata construida y ardiendo, ninguna luz de three en la escena', lucesThree());
      ok(mismos().length === 0, 'construir y prender la fogata no recompila nada', mismos().join(',') || 'ninguno');
      ok(cpu < TOPE_CPU_MS, `fogata: primer cuadro < ${TOPE_CPU_MS} ms`, cpu);
      ok(S.luces.activas >= 1, 'la fogata ocupa un lugar de luz', S.luces.activas);

      eventos.activos.length = 0;
      eventos.disparar('incendio_forestal', 6);
      const ev = eventos.activos[0];
      ok(!!ev, 'premisa: el incendio se disparó');
      if (ev) {
        const guardo = tiempo.fecha;
        tiempo.fecha = new Date(ev.desde + (ev.hasta - ev.desde) / 2);
        ev.x = camara.position.x + 350; ev.z = camara.position.z;
        const est = eventos.aplicar(tiempo.estado());
        clima.actualizar(0.6, est, camara);
        tiempo.fecha = guardo;
      }
      cpu = cronometrar();
      out.numeros.cpuIncendio = cpu;
      ok(lucesThree() === 0, 'con el incendio en curso, ninguna luz de three en la escena', lucesThree());
      ok(mismos().length === 0, 'el incendio no recompila nada', mismos().join(',') || 'ninguno');
      ok(cpu < TOPE_CPU_MS, `incendio: primer cuadro < ${TOPE_CPU_MS} ms`, cpu);
      eventos.activos.length = 0;
      clima.actualizar(0.6, eventos.aplicar(tiempo.estado()), camara);
      out.numeros.programas = render.info.programs.length;

      // ── 2 · LA LUZ LLEGA ───────────────────────────────────────────────────
      const copia8 = new THREE.WebGLRenderTarget(256, 144, { type: THREE.UnsignedByteType });
      const matCopia = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
      const escCopia = new THREE.Scene(); escCopia.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matCopia));
      const camCopia = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camCopia.position.z = 1;
      const luminanciaSuelo = () => {
        cuadro();
        matCopia.map = compositor.readBuffer.texture; matCopia.needsUpdate = true;
        render.setRenderTarget(copia8); render.clear(); render.render(escCopia, camCopia); render.setRenderTarget(null);
        const px = new Uint8Array(256 * 144 * 4); render.readRenderTargetPixels(copia8, 0, 0, 256, 144, px);
        let s = 0, n = 0;
        for (let y = 4; y < 54; y++) for (let x = 78; x < 178; x++) { const i = (y * 256 + x) * 4; s += px[i] + px[i + 1] + px[i + 2]; n++; }
        return +(s / n / 3).toFixed(2);
      };
      const lejosDeFogata = { ...PUNTO, lat: PUNTO.lat - 0.0012, cabeceo: -22 };
      await window.banco({ ancho: W, alto: H, cuadros: 2, puntos: [lejosDeFogata], fecha: '2024-02-15T23:40:00' });
      fijar(); compositor.renderToScreen = false;
      equipo.apagar();
      const sinLuz = luminanciaSuelo();
      equipo.guardar('antorcha');
      equipo.encender('antorcha', ms());
      const conLuz = luminanciaSuelo();
      out.numeros.luminanciaNoche = { sinLuz, conLuz };
      ok(conLuz > sinLuz + 3, 'de noche la antorcha aclara el suelo delante del jugador (imagen del compositor)', `${sinLuz} → ${conLuz}`);
      equipo.apagar();

      // ── 3 · COSTO ──────────────────────────────────────────────────────────
      await window.banco({ ancho: W, alto: H, cuadros: 2, puntos: [PUNTO], fecha: '2024-02-15T11:00:00' });
      fijar(); compositor.renderToScreen = false;
      const medir = relojGPU(gl);
      ok(!!medir, 'premisa: hay reloj de GPU');
      const chunks = {};
      for (const k of ['lights_fragment_begin', 'lights_pars_begin']) {
        chunks[k] = (await import(`/node_modules/three/src/renderers/shaders/ShaderChunk/${k}.glsl.js`)).default;
      }
      ok(THREE.ShaderChunk.lights_fragment_begin.startsWith(chunks.lights_fragment_begin), 'premisa: el chunk prístino importado es el prefijo del instalado');
      const materiales = new Set();
      escena.traverse((x) => { const ms2 = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []; for (const m of ms2) if (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshPhysicalMaterial) materiales.add(m); });
      window.__bancoModo = '';
      for (const m of materiales) {
        if (m.__bancoR5) continue;
        m.__bancoR5 = true;
        const k = m.customProgramCacheKey;
        m.customProgramCacheKey = function () { return k.call(this) + (window.__bancoModo ? `|${window.__bancoModo}` : ''); };
      }
      const modo = (x) => { window.__bancoModo = x; for (const m of materiales) m.needsUpdate = true; };
      // Compilar la variante sin bloque una sola vez, con los chunks prístinos
      const instalados = { f: THREE.ShaderChunk.lights_fragment_begin, p: THREE.ShaderChunk.lights_pars_begin };
      THREE.ShaderChunk.lights_fragment_begin = chunks.lights_fragment_begin;
      THREE.ShaderChunk.lights_pars_begin = chunks.lights_pars_begin;
      modo('sinBloque');
      out.numeros.cpuCompilarSinBloque = cronometrar();
      THREE.ShaderChunk.lights_fragment_begin = instalados.f;
      THREE.ShaderChunk.lights_pars_begin = instalados.p;
      modo(''); cuadro();

      const fogataCerca = fogata && Math.hypot(fogata.x - camara.position.x, fogata.z - camara.position.z) < 60;
      ok(fogataCerca, 'premisa: la fogata está al alcance para la variante de dos luces');
      const variantes = {
        A: () => { modo('sinBloque'); equipo.apagar(); if (fogata) fogata.ardiendo = false; for (let k = 0; k < 90; k++) hornos.actualizar(k); },
        B: () => { modo(''); equipo.apagar(); if (fogata) fogata.ardiendo = false; for (let k = 0; k < 90; k++) hornos.actualizar(k); },
        C: () => { modo(''); equipo.guardar('antorcha'); equipo.encender('antorcha', ms()); if (fogata) fogata.ardiendo = false; for (let k = 0; k < 90; k++) hornos.actualizar(k); },
        D: () => { modo(''); equipo.guardar('antorcha'); equipo.encender('antorcha', ms()); if (fogata) { fogata.ardiendo = true; fogata.fuego = { hasta: ms() + 10 * 3600e3 }; } for (let k = 0; k < 90; k++) hornos.actualizar(k); },
      };
      const activasEsperadas = { A: null, B: 0, C: 1, D: 2 };
      const tabla = { A: [], B: [], C: [], D: [] };
      for (let ronda = 0; ronda < 3; ronda++) {
        for (const v of ['A', 'B', 'C', 'D']) {
          variantes[v](); cuadro();
          if (activasEsperadas[v] !== null) ok(S.luces.activas === activasEsperadas[v], `ronda ${ronda}, variante ${v}: ${activasEsperadas[v]} luces activas`, S.luces.activas);
          tabla[v].push(+(await medir(cuadro)).toFixed(2));
          out.numeros.costo = tabla; marcar(out);
        }
      }
      const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const d = { B: media(tabla.B) - media(tabla.A), C: media(tabla.C) - media(tabla.A), D: media(tabla.D) - media(tabla.A) };
      out.numeros.costoDelta = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, +v.toFixed(2)]));
      ok(d.B <= TOPES.apagada, `bloque con 0 luces: ≤ +${TOPES.apagada} ms`, d.B.toFixed(2));
      ok(d.C <= TOPES.una, `con la antorcha: ≤ +${TOPES.una} ms`, d.C.toFixed(2));
      ok(d.D <= TOPES.dos, `con antorcha y fogata: ≤ +${TOPES.dos} ms`, d.D.toFixed(2));
      modo(''); equipo.apagar();

      // ── 4 · CAPTURAS ───────────────────────────────────────────────────────
      if (o.capturas !== false && typeof window.capturar === 'function') {
        const renderOrig = compositor.render.bind(compositor);
        compositor.render = (...a) => { S.juntarLuces(); return renderOrig(...a); };
        const NOCHE = '2024-02-15T23:40:00';
        const conAntorcha = async (nombre, opciones) => {
          tiempo.fecha = new Date(opciones.fecha);
          equipo.guardar('antorcha'); equipo.encender('antorcha', new Date(opciones.fecha).getTime());
          out.capturas.push({ nombre, ...(await window.capturar(nombre, { ancho: W, alto: H, ...opciones })) });
          marcar(out);
        };
        const sinAntorcha = async (nombre, opciones) => {
          equipo.apagar();
          out.capturas.push({ nombre, ...(await window.capturar(nombre, { ancho: W, alto: H, ...opciones })) });
          marcar(out);
        };
        const lejos = { lat: lejosDeFogata.lat, lon: lejosDeFogata.lon, altura: 2, rumbo: 20, cabeceo: -12, fecha: NOCHE, conFauna: false };
        if (fogata) fogata.ardiendo = false;
        await sinAntorcha('r5f1-noche-sin-luz', lejos);
        await conAntorcha('r5f1-noche-antorcha', lejos);
        await conAntorcha('r5f1-noche-antorcha-3p', { ...lejos, tercerPersona: true });
        await conAntorcha('r5f1-mediodia-antorcha', { ...lejos, fecha: '2024-02-15T12:30:00', cabeceo: -8 });
        if (fogata) {
          fogata.ardiendo = true; fogata.fuego = { hasta: new Date(NOCHE).getTime() + 10 * 3600e3 };
          const ll = S.mundo.aLatLon ? S.mundo.aLatLon(fogata.x, fogata.z + 7) : null;
          // 7 m al sur de la fogata (z crece hacia el sur) y mirando al norte:
          // adelante es (−sen giro, −cos giro), `Jugador.js:468`, así que rumbo 0.
          if (ll) await sinAntorcha('r5f1-noche-fogata', { lat: ll.lat, lon: ll.lon, altura: 2, rumbo: 0, cabeceo: -18, fecha: NOCHE, conFauna: false });
          else out.capturas.push({ nombre: 'r5f1-noche-fogata', error: 'mundo.aLatLon no existe: falta ubicar la cámara junto a la fogata' });
        }
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
