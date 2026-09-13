/**
 * BANCO DE LA FASE 2 (brasa), MITAD NAVEGADOR — ronda 7.
 *
 * Lo que la mitad Node no puede ver: la imagen final, la compilación y la GPU. Lo
 * escribe el jefe antes que el código del agente, con la misma medición con la que
 * se abrió la fase, para que el «antes» y el «después» sean el mismo instrumento.
 *
 *   B2 · COMPILACIÓN — construir una fogata, prenderla, apagarla y construir la
 *        segunda no cambian `render.info.programs.length`.
 *   B1 · SE VE ENCENDIDA — desde 6 m de noche, el pico de luminancia sobre la
 *        fogata es ≥ 180 prendida y ≤ 40 apagada.
 *   B3 · ALUMBRA — cámara cenital a 22 m, anillos de 16 muestras a 1, 2, 3, 5, 8 y
 *        12 m, la noche sin luz restada, árboles fuera del cuadro. Fogata: ≥ 35 a
 *        2 m, ≥ 30 a 3 m, ≥ 8 a 8 m, ≤ 200 a 1 m. Antorcha: ≥ 25 a 2 m, ≥ 4 a
 *        5 m, ≤ 200 a 1 m.
 *   B4 · EL MEDIODÍA NO SE ENCIENDE — a las 12:00, prendida menos apagada a 2 m
 *        ≤ 6,5, que es lo de hoy (+5,86) más un 10 %. Decía ≤ 3, y la base ya lo
 *        incumplía: pedía un cambio sin decirlo.
 *   B6 · COSTO — alternado en tres rondas, mediana de 16 cuadros por lectura:
 *        la llama ≤ +0,3 ms; dos luces contra ninguna ≤ +1,32 ms (el tope de +1,8
 *        de la ronda 5 menos los +0,48 que cuesta el bloque vacío, que acá no se
 *        saca).
 *   CAPTURAS — noche y mediodía desde 6 m, para el ojo.
 *
 * La línea de base de la fase, con este mismo instrumento, el 12/9/2026:
 *   noche sin luz  0 · 0 · 0 · 0,03 · 0,06 · 0,55
 *   fogata        +4,12 · +5,27 · +5,00 · +4,61 · +1,95 · +0,09
 *   antorcha      +2,29 · +3,38 · +3,38 · +2,97 · +0,79 · 0
 *
 * Qué cuenta como «la llama» para ocultarla en B6: lo mismo que en la mitad Node
 * —mallas visibles con material emisivo, aditivo, básico o de sombreador propio—,
 * dentro del nodo de la fogata.
 *
 * Uso, desde un script inyectado en la página con el juego andando:
 *   await window.bancoR7F2()   // progreso en document.body.dataset.bancoR7F2
 */

(() => {
  const LUGAR = { x: 6606, z: -587 };   // suelo plano y seco a 1,3 km del arranque: el de la apertura
  const W = 1024, H = 576, T = 512, U = 288;
  const DIST = [1, 2, 3, 5, 8, 12];
  const PISOS = {
    fogata: [[1, '<=', 200], [2, '>=', 35], [3, '>=', 30], [8, '>=', 8]],
    antorcha: [[1, '<=', 200], [2, '>=', 25], [5, '>=', 4]],
  };
  const TOPE_LLAMA_MS = 0.3;
  const TOPE_DOS_LUCES_MS = 1.32;
  const TOPE_CPU_MS = 2500;
  // Hoy la fogata al mediodía suma +5,86 a 2 m (medido contra la base): lo de hoy
  // más un 10 % de margen. Ver B4 en RONDA7.md.
  const TOPE_MEDIODIA = 6.5;
  const NOCHE = '2024-02-15T23:40:00';
  const MEDIODIA = '2024-02-15T12:00:00';

  const marcar = (o) => { document.body.dataset.bancoR7F2 = JSON.stringify(o); };

  async function three() {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/\.vite\/deps\/three\.js/.test(n));
    if (!url) throw new Error('no encuentro el módulo de three que cargó el juego');
    return import(url);
  }

  function cargar(src) {
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error(`no cargó ${src}`));
      document.head.appendChild(sc);
    });
  }

  function relojGPU(gl) {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return null;
    return async (dibujar, cuadros = 16, calentar = 4) => {
      for (let k = 0; k < calentar; k++) dibujar();
      const qs = [];
      for (let k = 0; k < cuadros; k++) {
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q); dibujar(); gl.endQuery(ext.TIME_ELAPSED_EXT);
        qs.push(q);
      }
      const ms = [];
      for (const q of qs) {
        for (let e = 0; e < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); e++) await new Promise((r) => setTimeout(r, 5));
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      ms.sort((a, b) => a - b);
      return ms.length ? ms[Math.floor(ms.length / 2)] : NaN;
    };
  }

  window.bancoR7F2 = async function bancoR7F2(o = {}) {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, capturas: [], fin: false };
    const ok = (c, desc, det) => { out.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); marcar(out); return !!c; };
    try {
      const THREE = await three();
      const { render, compositor, escena, camara, agua, calidad, equipo, fundicion, hornos, tiempo, jugador, mundo, luces, cuerpo, vegetacion } = S;
      const gl = render.getContext();
      calidad.automatico = false;
      if (S.partida) S.partida.guardar = () => {};
      ok(/Intel|NVIDIA|AMD|ANGLE/i.test(calidad.placa), 'premisa: hay placa', calidad.placa);
      ok(calidad.preset?.nombre === 'Baja', 'premisa: preset Baja', calidad.preset?.nombre);
      if (typeof window.banco !== 'function') await cargar('/banco.js');

      // ── El lugar ─────────────────────────────────────────────────────────────
      // Sin hornos a 40 m: una fogata que quedó de otra corrida —la medición de
      // apertura dejó una justo acá— hace que `construir()` se niegue por
      // «muy encima de otra obra», y el banco se caía en la premisa sin decir por qué.
      const libre = (x, z) => fundicion.hornos.every((h) => Math.hypot(h.x - x, h.z - z) > 40);
      let fx = null, fz = null;
      for (let r = 0; r < 600 && fx === null; r += 4) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = LUGAR.x + Math.cos(a) * r, z = LUGAR.z + Math.sin(a) * r;
        if (!libre(x, z)) continue;
        let seco = true;
        for (let dx = -16; dx <= 16 && seco; dx += 4) for (let dz = -16; dz <= 16; dz += 4) if (mundo.esAgua(x + dx, z + dz)) { seco = false; break; }
        if (seco && mundo.pendienteEn(x, z) < 0.08) { fx = x; fz = z; break; }
      }
      if (!ok(fx !== null, 'premisa: hay suelo plano y seco junto al lugar de la apertura')) throw new Error('sin lugar');
      const fy = mundo.alturaEn(fx, fz);
      out.numeros.lugar = { x: Math.round(fx), z: Math.round(fz) };

      const fijar = () => {
        render.setPixelRatio(1); render.setSize(W, H, false);
        compositor.setPixelRatio(1); compositor.setSize(W, H); S.oclusion?.setSize(W, H);
        calidad.ctx?.suavizado?.material?.uniforms?.resolution?.value.set(1 / W, 1 / H);
        camara.aspect = W / H; camara.updateProjectionMatrix(); S.csm.updateFrustums();
        compositor.renderToScreen = false;
      };
      const irA = async (fecha) => {
        const ll = mundo.aLatLon(fx, fz);
        await window.banco({ ancho: W, alto: H, cuadros: 2, puntos: [{ id: 'brasa', lat: ll.lat, lon: ll.lon, altura: 2, rumbo: 0, cabeceo: -4 }], fecha });
        fijar();
      };
      await irA(NOCHE);

      const ms = () => tiempo.fecha.getTime();
      const ocultarCuerpo = (si) => { const g = cuerpo?.grupo ?? cuerpo?.raiz; if (g) g.visible = !si; return !!g; };
      const cuadro = () => { S.juntarLuces(); agua.dibujarReflejo(render, escena, camara); compositor.render(); };
      const mirar = (desde, hacia, arriba = [0, 1, 0]) => {
        camara.up.set(...arriba); camara.position.set(desde.x, desde.y, desde.z);
        camara.lookAt(hacia.x, hacia.y, hacia.z); camara.updateMatrixWorld();
      };
      const a6m = () => mirar({ x: fx, y: fy + 1.7, z: fz + 6 }, { x: fx, y: fy + 0.4, z: fz });
      const cenital = () => mirar({ x: fx, y: fy + 22, z: fz + 0.01 }, { x: fx, y: fy, z: fz }, [0, 0, -1]);

      // Si se niega, que diga por qué: la negativa sale por el HUD —«muy encima de
      // otro horno» sale por `aviso`, no por `negativa`— y se perdía.
      //
      // Y los materiales tienen que entrar de verdad. La partida de la vista
      // previa tenía el bolso en 43,6 de 44 kg: `agregar('piedra', 10)` metía cero
      // piedras sin decir nada, y la fogata pide cuatro. Si no alcanzan, se le da
      // lugar al bolso; la partida no se guarda (`partida.guardar` está anulado).
      const construirEn = (x, z) => {
        jugador.posicion.set(x, mundo.alturaEn(x, z) + 1, z);
        const inv = S.inventario;
        const faltan = () => inv.cantidad('lena') < 6 || inv.cantidad('piedra') < 4;
        inv.agregar('lena', 12); inv.agregar('piedra', 8);
        if (faltan()) { inv.capacidadKg = inv.capacidadKg + 40; inv.agregar('lena', 12); inv.agregar('piedra', 8); }
        const evalOrig = fundicion.evaluarFuego.bind(fundicion);
        const negOrig = S.hud.negativa, avisoOrig = S.hud.aviso;
        const dicho = [];
        fundicion.evaluarFuego = () => ({ permitido: true, jurisdiccion: 'banco' });
        S.hud.negativa = (v) => { dicho.push(v?.titulo || String(v)); };
        S.hud.aviso = (t, d) => { dicho.push(t); };
        let f = null;
        try { f = fundicion.construir(fundicion.hornoPorId('fogata')); }
        finally { fundicion.evaluarFuego = evalOrig; S.hud.negativa = negOrig; S.hud.aviso = avisoOrig; }
        if (!f) out.numeros.noConstruyo = { dicho, lena: inv.cantidad('lena'), piedra: inv.cantidad('piedra'), kg: +inv.pesoKg.toFixed(1), capacidad: inv.capacidadKg };
        return f;
      };
      const asentar = (f) => {
        const x = f?.x ?? 0;
        const t = (Math.ceil(x / Math.PI) * Math.PI - x) / 7.3;   // la base del latido de la brasa
        for (let k = 0; k < 240; k++) hornos.actualizar(t);
      };
      const prender = (f) => { f.fuego = { hasta: ms() + 10 * 3600e3 }; f.ardiendo = true; asentar(f); };
      const apagar = (f) => { f.ardiendo = false; f.fuego = null; asentar(f); };

      // ── B2 · COMPILACIÓN ────────────────────────────────────────────────────
      ocultarCuerpo(true);
      a6m(); cuadro(); cuadro();
      const p0 = render.info.programs.length;
      const t0 = performance.now();
      const fogata = construirEn(fx, fz);
      if (!ok(!!fogata, 'premisa: la fogata se construyó por el sistema')) throw new Error('sin fogata');
      prender(fogata);
      a6m(); cuadro();
      const cpuPrender = +(performance.now() - t0).toFixed(1);
      const p1 = render.info.programs.length;
      apagar(fogata); a6m(); cuadro();
      const p2 = render.info.programs.length;
      let otra = null;
      for (const [dx, dz] of [[30, 0], [-30, 0], [0, 30], [0, -30]]) {
        if (!mundo.esAgua(fx + dx, fz + dz)) { otra = construirEn(fx + dx, fz + dz); if (otra) break; }
      }
      ok(!!otra, 'premisa: se construyó una segunda fogata');
      if (otra) {
        prender(otra);
        mirar({ x: otra.x, y: otra.y + 1.7, z: otra.z + 6 }, { x: otra.x, y: otra.y + 0.4, z: otra.z }); cuadro();
      }
      const p3 = render.info.programs.length;
      if (otra) apagar(otra);
      jugador.posicion.set(fx, fy + 1, fz + 6);
      out.numeros.programas = [p0, p1, p2, p3];
      out.numeros.cpuPrender = cpuPrender;
      ok(p1 === p0 && p2 === p0 && p3 === p0, 'construir, prender, apagar y construir la segunda no compila ningún programa', `${p0} → ${p1} → ${p2} → ${p3}`);
      ok(cpuPrender < TOPE_CPU_MS, `construir y prender: primer cuadro < ${TOPE_CPU_MS} ms`, cpuPrender);

      // ── Lectura de la imagen final ──────────────────────────────────────────
      const copia = new THREE.WebGLRenderTarget(T, U, { type: THREE.UnsignedByteType });
      const matCopia = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
      const escCopia = new THREE.Scene(); escCopia.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matCopia));
      const camCopia = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camCopia.position.z = 1;
      const leer = (poner) => {
        poner(); S.juntarLuces(); poner();
        agua.dibujarReflejo(render, escena, camara); compositor.render();
        matCopia.map = compositor.readBuffer.texture; matCopia.needsUpdate = true;
        render.setRenderTarget(copia); render.clear(); render.render(escCopia, camCopia); render.setRenderTarget(null);
        const px = new Uint8Array(T * U * 4); render.readRenderTargetPixels(copia, 0, 0, T, U, px);
        return px;
      };
      const lum = (px, i, j) => { const q = (j * T + i) * 4; return 0.2126 * px[q] + 0.7152 * px[q + 1] + 0.0722 * px[q + 2]; };
      const pantalla = (x, y, z) => {
        const v = new THREE.Vector3(x, y, z).project(camara);
        return { i: Math.round((v.x * 0.5 + 0.5) * (T - 1)), j: Math.round((v.y * 0.5 + 0.5) * (U - 1)), dentro: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
      };
      const pico = (px) => {
        const c = pantalla(fx, fy + 0.45, fz);
        let m = 0;
        for (let dj = -14; dj <= 14; dj++) for (let di = -14; di <= 14; di++) {
          const i = c.i + di, j = c.j + dj;
          if (i >= 0 && j >= 0 && i < T && j < U) m = Math.max(m, lum(px, i, j));
        }
        return +m.toFixed(1);
      };
      const anillos = (px) => DIST.map((d) => {
        let s = 0, n = 0;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d;
          if (mundo.esAgua(x, z)) continue;
          const c = pantalla(x, mundo.alturaEn(x, z), z);
          if (c.i < 1 || c.j < 1 || c.i >= T - 1 || c.j >= U - 1) continue;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { s += lum(px, c.i + di, c.j + dj); n++; }
        }
        return n ? s / n : NaN;
      });
      const restar = (a, b) => a.map((v, k) => +(v - b[k]).toFixed(2));

      // ── B1 · SE VE ENCENDIDA ────────────────────────────────────────────────
      equipo.apagar();
      prender(fogata);
      const picoPrendida = pico(leer(a6m));
      ok(pantalla(fx, fy + 0.45, fz).dentro, 'premisa: la fogata está en cuadro desde 6 m');
      apagar(fogata);
      const picoApagada = pico(leer(a6m));
      out.numeros.pico = { prendida: picoPrendida, apagada: picoApagada };
      ok(picoPrendida >= 180, 'de noche, desde 6 m, la fogata prendida tiene un pico ≥ 180 de 255', picoPrendida);
      ok(picoApagada <= 40, 'y apagada, ≤ 40', picoApagada);

      // ── B3 · ALUMBRA ────────────────────────────────────────────────────────
      const vegVisible = vegetacion.grupo.visible;
      vegetacion.grupo.visible = false;
      jugador.tercerPersona = true;
      equipo.apagar(); apagar(fogata);
      const nada = anillos(leer(cenital));
      prender(fogata);
      const conFogata = restar(anillos(leer(cenital)), nada);
      ok(luces.activas >= 1, 'premisa: con la fogata prendida hay una luz activa', luces.activas);
      apagar(fogata);
      ocultarCuerpo(false);
      jugador.posicion.set(fx, fy + 1, fz);
      equipo.guardar('antorcha');
      const enc = equipo.encender('antorcha', ms());
      ok(enc?.ok, 'premisa: la antorcha encendió', JSON.stringify(enc));
      cuerpo.actualizar?.(1 / 60, jugador);
      const conAntorcha = restar(anillos(leer(cenital)), nada);
      equipo.apagar();
      ocultarCuerpo(true);
      vegetacion.grupo.visible = vegVisible;
      out.numeros.anillos = { distancias: DIST, nada: nada.map((v) => +v.toFixed(2)), fogata: conFogata, antorcha: conAntorcha };
      ok(conFogata[1] > 0.5, 'premisa: la luz de la fogata llega a la imagen', conFogata[1]);
      for (const [nombre, valores] of [['fogata', conFogata], ['antorcha', conAntorcha]]) {
        for (const [d, op, tope] of PISOS[nombre]) {
          const v = valores[DIST.indexOf(d)];
          ok(op === '>=' ? v >= tope : v <= tope, `${nombre}: a ${d} m ${op === '>=' ? '≥' : '≤'} ${tope} de 255`, v);
        }
      }

      // ── B4 · EL MEDIODÍA NO CAMBIA ──────────────────────────────────────────
      await irA(MEDIODIA);
      vegetacion.grupo.visible = false;
      ocultarCuerpo(true);
      apagar(fogata);
      const diaApagada = anillos(leer(cenital));
      prender(fogata);
      const diaPrendida = anillos(leer(cenital));
      vegetacion.grupo.visible = vegVisible;
      const dif = restar(diaPrendida, diaApagada);
      out.numeros.mediodia = { apagada: diaApagada.map((v) => +v.toFixed(2)), diferencia: dif };
      ok(diaApagada[1] > 20, 'premisa: al mediodía el suelo se ve', diaApagada[1].toFixed(1));
      // Era ≤ 3, y la base ya daba +5,86: la aserción pedía un cambio sin decirlo.
      // Lo que se cuida es que la luz del día no suba con la de la noche.
      ok(dif[1] <= TOPE_MEDIODIA, `al mediodía, prendida menos apagada a 2 m ≤ ${TOPE_MEDIODIA} de 255 (hoy +5,86)`, dif[1]);

      // ── B6 · COSTO ──────────────────────────────────────────────────────────
      await irA(NOCHE);
      ocultarCuerpo(true);
      const medir = relojGPU(gl);
      ok(!!medir, 'premisa: hay reloj de GPU');
      const nodoFogata = (() => {
        let mejor = null, d = Infinity;
        for (const ch of hornos.grupo.children) {
          const dd = Math.hypot(ch.position.x - fogata.x, ch.position.z - fogata.z);
          if (dd < d) { d = dd; mejor = ch; }
        }
        return mejor;
      })();
      const piezasLlama = () => {
        const lista = [];
        nodoFogata?.traverse((x) => {
          if (!x.isMesh && !x.isSprite && !x.isPoints) return;
          const mats = Array.isArray(x.material) ? x.material : [x.material];
          if (mats.some((m) => m && ((m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) / 3 * (m.emissiveIntensity ?? 1) > 0.15)
            || m.blending === THREE.AdditiveBlending || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isShaderMaterial))) lista.push(x);
        });
        return lista;
      };
      if (medir) {
        const variantes = {
          A: () => { equipo.apagar(); prender(fogata); for (const x of piezasLlama()) x.visible = false; },
          B: () => { equipo.apagar(); prender(fogata); for (const x of piezasLlama()) x.visible = true; },
          C: () => { equipo.apagar(); apagar(fogata); },
          D: () => { prender(fogata); jugador.posicion.set(fx, fy + 1, fz + 5); equipo.guardar('antorcha'); equipo.encender('antorcha', ms()); cuerpo.actualizar?.(1 / 60, jugador); },
        };
        const esperadas = { A: 1, B: 1, C: 0, D: 2 };
        const tabla = { A: [], B: [], C: [], D: [] };
        const conCamara = () => { a6m(); cuadro(); };
        ok(piezasLlama().length >= 1, 'premisa: se encontraron las piezas de la llama para ocultarlas', piezasLlama().length);
        for (let ronda = 0; ronda < 3; ronda++) {
          for (const v of ['A', 'B', 'C', 'D']) {
            variantes[v](); a6m(); cuadro();
            ok(luces.activas === esperadas[v], `ronda ${ronda}, variante ${v}: ${esperadas[v]} luces activas`, luces.activas);
            tabla[v].push(+(await medir(conCamara)).toFixed(2));
            out.numeros.costo = tabla; marcar(out);
          }
        }
        for (const x of piezasLlama()) x.visible = true;
        equipo.apagar();
        const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const llamaMs = media(tabla.B) - media(tabla.A);
        const dosMs = media(tabla.D) - media(tabla.C);
        out.numeros.costoDelta = { llama: +llamaMs.toFixed(2), dosLuces: +dosMs.toFixed(2) };
        ok(llamaMs <= TOPE_LLAMA_MS, `la llama cuesta ≤ +${TOPE_LLAMA_MS} ms`, llamaMs.toFixed(2));
        ok(dosMs <= TOPE_DOS_LUCES_MS, `dos luces contra ninguna ≤ +${TOPE_DOS_LUCES_MS} ms`, dosMs.toFixed(2));
      }

      // ── CAPTURAS ────────────────────────────────────────────────────────────
      if (o.capturas !== false && typeof window.capturar === 'function') {
        ocultarCuerpo(false);
        prender(fogata);
        const ll = mundo.aLatLon(fx, fz + 6);
        for (const [nombre, fecha] of [['r7f2-despues-noche-6m', NOCHE], ['r7f2-despues-mediodia-6m', MEDIODIA]]) {
          out.capturas.push({ nombre, ...(await window.capturar(nombre, { lat: ll.lat, lon: ll.lon, altura: 1.7, rumbo: 0, cabeceo: -12, fecha, ancho: W, alto: H })) });
          marcar(out);
        }
      }
      apagar(fogata);
      out.fin = true;
    } catch (e) {
      out.error = e.message;
      out.pila = (e.stack || '').split('\n').slice(0, 5).join(' | ');
    }
    marcar(out);
    return out;
  };
})();
