/**
 * BANCO DE LA FASE 1 (rumbo), MITAD NAVEGADOR — ronda 8.
 *
 * Lo que la mitad Node no puede ver, medido en el juego de verdad:
 *
 *   N1 · la brújula: su caja centrada en la ventana, a menos de 1 px, y sin pisar
 *        `#geo` ni `#reloj`.
 *   N2 · la premisa de la flecha: la dirección de avance del jugador es
 *        (−sin giro, −cos giro), comparada contra `camara.getWorldDirection()`. Si
 *        esto falla, la mitad Node mide contra una convención equivocada.
 *   N3 · el minimapa: existe, abajo a la derecha, de 110 a 200 px CSS, con 12 px
 *        de margen, sin pisar ningún otro elemento visible del HUD.
 *   N4 · el velo: con la exploración entera en cero, lo que se ve del minimapa
 *        fuera del centro es velo; con la exploración entera en 255, es relieve. Se
 *        lee el lienzo con `getImageData`, y la exploración se restaura byte a byte.
 *   N5 · se esconde con el mapa abierto.
 *   N6 · el costo: `minimapa.actualizar()` envuelto con `performance.now()`
 *        durante 10 s caminando solo (Z). Promedio < 0,25 ms y ninguna > 6 ms.
 *   N7 · el costo del zoom: se abre el mapa y se lleva al nivel máximo con la
 *        rueda, sobre el jugador, hasta que queda quieto. Se cuentan las alturas
 *        leídas del terreno —sin ruido— y el tiempo dentro de los métodos del mapa,
 *        ALTERNADO con una copia del Mapa.js de la base en la misma sesión: medido
 *        suelto, la misma base dio 50,5 ms en una sesión y 72,4 en otra.
 *
 * Antes de tocar nada anula los cuatro guardados —partida, exploración,
 * hallazgos y el automático de calidad— y los deja anulados.
 *
 * Uso, con el juego andando:
 *   await import('/.claude/flota/banco-r8-fase1.navegador.js')
 *   await window.bancoR8F1()   // progreso en document.body.dataset.bancoR8F1
 */

(() => {
  const marcar = (o) => { document.body.dataset.bancoR8F1 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const caja = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01 && r.width > 0 && r.height > 0;
  };
  const pisa = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

  function anularGuardados(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) {
      if (!S[k]) continue;
      S[k].guardar = () => {};
      S[k].guardarSiHaceFalta = () => {};
    }
  }

  async function bancoR8F1(op = {}) {
    const S = window.SurviBar;
    const checks = [];
    const ok = (c, desc, det) => { checks.push({ ok: !!c, desc, detalle: det === undefined ? '' : String(det) }); return !!c; };
    const notas = [];
    if (!S) { ok(false, 'premisa: window.SurviBar existe (¿se entró al parque?)'); return { checks, notas }; }
    anularGuardados(S);
    const fecha0 = S.tiempo?.fecha ? new Date(S.tiempo.fecha.getTime()) : null;
    marcar({ paso: 'empezando' });

    // Cerrar todo lo que tape el HUD
    if (S.mapa?.abierto) S.mapa.alternar();
    S.bolso?.cerrar?.(); S.opciones?.cerrar?.(); S.codice?.cerrar?.();
    await esperar(300);

    // ── N1 · la brújula ───────────────────────────────────────────────────
    {
      const b = document.querySelector('#brujula');
      ok(!!b, 'premisa: #brujula existe');
      if (b) {
        const cb = caja(b);
        const centro = (cb.l + cb.r) / 2;
        ok(Math.abs(centro - innerWidth / 2) < 1, 'N1 · la brújula está centrada en la ventana', `centro ${centro.toFixed(1)} contra ${(innerWidth / 2).toFixed(1)} · caja ${cb.l.toFixed(0)}–${cb.r.toFixed(0)}`);
        for (const id of ['geo', 'reloj']) {
          const o = document.getElementById(id);
          if (visible(o)) ok(!pisa(cb, caja(o)), `N1 · la brújula no pisa #${id}`, JSON.stringify(caja(o)));
        }
      }
    }

    // ── N2 · la convención de avance ───────────────────────────────────────
    // Con el panel oculto el bucle no corre y la cámara queda en su dirección de
    // fábrica (0, −1): se mueve a mano con un paso de física nulo, en tres giros.
    {
      const j = S.jugador, cam = S.camara;
      const g0 = j.giro;
      const quieta = { sensibilidad: 0, ratonDX: 0, ratonDY: 0, invertirY: false, consumirRaton() {}, agachar: false, adelante: 0, correr: false, lateral: 0, saltar: false };
      const p0 = j.posicion.clone();
      try {
        for (const g of [0.4, 2.89, -1.9]) {
          j.giro = g;
          j.actualizar(1e-4, quieta);
          cam.updateMatrixWorld?.(true);
          const dir = new cam.position.constructor();
          cam.getWorldDirection(dir);
          const f = { x: -Math.sin(g), z: -Math.cos(g) };
          const h = Math.hypot(dir.x, dir.z) || 1;
          const cos = (dir.x / h) * f.x + (dir.z / h) * f.z;
          ok(cos > Math.cos(3 * Math.PI / 180), `N2 · premisa: con giro ${g} el avance es (−sin, −cos), contra la cámara`, `cámara (${(dir.x / h).toFixed(3)}, ${(dir.z / h).toFixed(3)}) · fórmula (${f.x.toFixed(3)}, ${f.z.toFixed(3)}) · cos ${cos.toFixed(4)}`);
        }
      } finally {
        j.giro = g0;
        j.posicion.copy(p0);
        j.actualizar(1e-4, quieta);
      }
    }

    // ── N3 · el minimapa, dónde ───────────────────────────────────────────
    const mm = S.minimapa;
    const elMM = document.getElementById('minimapa');
    ok(!!mm, 'N3 · window.SurviBar.minimapa existe');
    ok(!!elMM, 'N3 · #minimapa existe en el documento');
    ok(!!elMM && !!elMM.closest('#hud'), 'N3 · #minimapa vive dentro de #hud');
    if (elMM) {
      const c = caja(elMM);
      ok(visible(elMM), 'N3 · el minimapa se ve con el mapa cerrado', JSON.stringify(c));
      ok(c.w >= 110 && c.w <= 200 && c.h >= 110 && c.h <= 200, 'N3 · mide entre 110 y 200 px CSS de lado', `${c.w.toFixed(0)} × ${c.h.toFixed(0)} a ${innerWidth}×${innerHeight}`);
      ok(innerWidth - c.r >= 12 && innerHeight - c.b >= 12, 'N3 · con 12 px de margen abajo y a la derecha', `derecha ${(innerWidth - c.r).toFixed(0)} · abajo ${(innerHeight - c.b).toFixed(0)}`);
      ok(c.l > innerWidth / 2 && c.t > innerHeight / 2, 'N3 · en el cuarto de abajo a la derecha', JSON.stringify(c));
      const hud = document.getElementById('hud');
      const otros = [...hud.children].filter((x) => x !== elMM && !x.contains(elMM) && visible(x));
      const pisados = otros.filter((x) => pisa(c, caja(x))).map((x) => x.id || x.className);
      ok(pisados.length === 0, 'N3 · no pisa ningún otro elemento visible del HUD', pisados.join(', ') || `revisados: ${otros.map((x) => x.id || x.className).join(', ')}`);
    }

    // ── N4 · el velo ──────────────────────────────────────────────────────
    if (mm && elMM) {
      const ex = S.exploracion;
      const copia = new Uint8Array(ex.conocido);
      const v0 = ex.version;
      const lienzo = mm.lienzo || elMM.querySelector('canvas');
      ok(!!lienzo, 'N4 · premisa: el minimapa tiene un lienzo');
      const leer = async (valor) => {
        ex.conocido.fill(valor);
        ex.version = (ex.version ?? 0) + 1000;
        // Que redibuje: varios cuadros y lo que haga falta de ocio
        for (let i = 0; i < 6; i++) { mm.actualizar?.(0.5); await esperar(120); }
        const c2 = lienzo.getContext('2d');
        const W = lienzo.width, H = lienzo.height;
        const d = c2.getImageData(0, 0, W, H).data;
        // Se descarta un círculo en el centro (la flecha) y el borde de 6 %
        let suma = 0, n = 0, oscuros = 0;
        for (let y = Math.floor(H * 0.06); y < H * 0.94; y += 2) {
          for (let x = Math.floor(W * 0.06); x < W * 0.94; x += 2) {
            if (Math.hypot(x - W / 2, y - H / 2) < Math.min(W, H) * 0.12) continue;
            const k = (y * W + x) * 4;
            if (d[k + 3] < 8) continue;           // transparente: fuera de la forma (p. ej. redondo)
            const lum = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
            suma += lum; n++;
            if (lum < 22) oscuros++;
          }
        }
        return { media: n ? suma / n : NaN, oscuros: n ? oscuros / n : NaN, n };
      };
      try {
        const nada = await leer(0);
        const todo = await leer(255);
        ok(nada.n > 100, 'N4 · premisa: se leyeron píxeles del minimapa', nada.n);
        ok(nada.oscuros > 0.95, 'N4 · sin explorar, el minimapa es velo (>95 % oscuro)', `oscuros ${(nada.oscuros * 100).toFixed(1)} % · lum media ${nada.media.toFixed(1)}`);
        ok(todo.oscuros < 0.2 && todo.media > 50, 'N4 · explorado entero, el minimapa muestra relieve', `oscuros ${(todo.oscuros * 100).toFixed(1)} % · lum media ${todo.media.toFixed(1)}`);
      } finally {
        ex.conocido.set(copia);
        ex.version = v0 + 2000;
        for (let i = 0; i < 3; i++) { mm.actualizar?.(0.5); await esperar(100); }
      }
    }

    // ── N5 · se esconde con el mapa abierto ───────────────────────────────
    if (mm && elMM) {
      S.mapa.alternar();
      for (let i = 0; i < 3; i++) { mm.actualizar?.(1 / 30); await esperar(60); }
      ok(!visible(elMM) || elMM.classList.contains('oculto'), 'N5 · con el mapa abierto el minimapa se esconde', `clases: ${elMM.className}`);
      S.mapa.alternar();
      for (let i = 0; i < 3; i++) { mm.actualizar?.(1 / 30); await esperar(60); }
      ok(visible(elMM) && !elMM.classList.contains('oculto'), 'N5 · y vuelve al cerrarlo', `clases: ${elMM.className}`);
    }

    // ── N6 · el costo ─────────────────────────────────────────────────────
    if (mm) {
      const orig = mm.actualizar;
      const tiempos = [];
      mm.actualizar = function (...a) { const t0 = performance.now(); const r = orig.apply(this, a); tiempos.push(performance.now() - t0); return r; };
      const e = S.entrada;
      const antes = e.autoAndar;
      const p0 = { x: S.jugador.posicion.x, z: S.jugador.posicion.z };
      try {
        if ('autoAndar' in e) e.autoAndar = true;
        marcar({ paso: 'N6 caminando 10 s' });
        await esperar(10000);
      } finally {
        if ('autoAndar' in e) e.autoAndar = antes;
        mm.actualizar = orig;
      }
      const recorrido = Math.hypot(S.jugador.posicion.x - p0.x, S.jugador.posicion.z - p0.z);
      const n = tiempos.length;
      const media = n ? tiempos.reduce((a, b) => a + b, 0) / n : NaN;
      const max = n ? Math.max(...tiempos) : NaN;
      ok(n > 20, 'N6 · premisa: el bucle llamó a actualizar() mientras se caminaba', `${n} llamadas en 10 s · ${recorrido.toFixed(1)} m recorridos`);
      ok(media < 0.25, 'N6 · el minimapa cuesta menos de 0,25 ms por cuadro en promedio', `${media.toFixed(3)} ms`);
      ok(max < 6, 'N6 · ninguna llamada pasa de 6 ms', `${max.toFixed(2)} ms`);
      notas.push(`N6: ${n} cuadros, media ${media.toFixed(3)} ms, máx ${max.toFixed(2)} ms, ${recorrido.toFixed(1)} m`);
    }

    // ── N7 · el costo del zoom al máximo ──────────────────────────────────
    // Dos instrumentos. El que no tiene ruido: cuántas alturas se leen del
    // terreno entre abrir y quedar quieto al máximo (el relieve cuesta una
    // lectura por píxel). Y el reloj, pero ALTERNADO con una copia del Mapa.js de
    // la base (`base-r8/Mapa.js`, de e465149) en la misma sesión: medido suelto,
    // la misma base dio 50,5 ms en una sesión y 72,4 en otra.
    {
      const { Mapa: MapaBase } = await import('/.claude/flota/base-r8/Mapa.js');
      const deps = { mundo: S.mundo, jugador: S.jugador, tiempo: S.tiempo, exploracion: S.exploracion, codice: S.codice, construccion: S.construccion, hallazgos: S.hallazgos };
      const base = new MapaBase(deps);
      try {
        await esperar(1500);                    // su recorte del mundo entero, al ocio
        await costoZoomMaximo(S, S.mapa);       // calentamiento de los dos
        await costoZoomMaximo(S, base);
        const nuevo = [], viejo = [];
        for (let i = 0; i < 5; i++) {
          nuevo.push(await costoZoomMaximo(S, S.mapa));
          viejo.push(await costoZoomMaximo(S, base));
        }
        const med = (xs, k) => [...xs].sort((x, y) => x[k] - y[k])[2][k];
        const rN = { ms: med(nuevo, 'ms'), muestras: med(nuevo, 'muestras'), mpp: nuevo[0].mpp, nivel: nuevo[0].nivel };
        const rB = { ms: med(viejo, 'ms'), muestras: med(viejo, 'muestras'), mpp: viejo[0].mpp, nivel: viejo[0].nivel };
        notas.push(`N7: nuevo ${nuevo.map((c) => c.ms.toFixed(1)).join(' · ')} ms, ${rN.muestras} alturas · base ${viejo.map((c) => c.ms.toFixed(1)).join(' · ')} ms, ${rB.muestras} alturas`);
        ok(rB.mpp === 8 && rB.muestras > 0, 'N7 · premisa: la base llega a 8 m/px y lee alturas', `${rB.mpp} m/px · ${rB.muestras}`);
        ok(rN.mpp <= 2, 'N7 · el zoom llega a 2 m/px o menos', `${rN.mpp} m/px, nivel ${rN.nivel}`);
        ok(rN.muestras <= rB.muestras * 1.25, 'N7 · al máximo no lee más alturas que la base al suyo (+25 %)', `${rN.muestras} contra ${rB.muestras}`);
        ok(rN.ms <= rB.ms * 1.5, 'N7 · y alternado con la base, no tarda más de 1,5 veces', `mediana ${rN.ms.toFixed(1)} ms contra ${rB.ms.toFixed(1)}`);
      } finally {
        base.el?.remove();
      }
    }

    anularGuardados(S);
    if (fecha0) S.tiempo.fecha = fecha0;
    const res = { checks, notas, total: `${checks.filter((c) => c.ok).length}/${checks.length}` };
    marcar({ paso: 'listo', ...res });
    return res;
  }

  /**
   * Abre un mapa, lo lleva al nivel máximo con la rueda sobre el jugador, y mide
   * hasta que queda quieto: el tiempo dentro de sus métodos y las alturas leídas
   * del terreno. Lo deja cerrado y en el nivel 0.
   */
  async function costoZoomMaximo(S, m = S.mapa) {
    if (m.abierto) m.alternar();
    // Arranca siempre desde el parque entero y sin recortes en caché. Se borra
    // todo lo que parezca una caché de recortes, con el nombre que tenga, menos
    // el del mundo entero, que se arma una vez al arrancar.
    m.verTodo?.();
    for (const k of Object.keys(m)) {
      if (/tile|recorte|cache/i.test(k) && !/mundo/i.test(k)) {
        const v = m[k];
        if (v instanceof Map) v.clear(); else if (Array.isArray(v)) v.length = 0; else if (v && typeof v === 'object') m[k] = null;
      }
    }
    // El cronómetro: cada método del mapa, envuelto en la instancia. Se suma sólo
    // la llamada de más afuera, así un método que llama a otro no cuenta doble. No
    // depende de cómo se llamen: se envuelve todo lo que haya en el prototipo.
    let hondo = 0, ms = 0;
    const envueltos = [];
    for (const nombre of Object.getOwnPropertyNames(Object.getPrototypeOf(m))) {
      if (nombre === 'constructor') continue;
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m), nombre);
      if (typeof d?.value !== 'function') continue;
      const f = d.value;
      m[nombre] = function (...a) {
        if (hondo++ > 0) { try { return f.apply(this, a); } finally { hondo--; } }
        const t = performance.now();
        try { return f.apply(this, a); } finally { hondo--; ms += performance.now() - t; }
      };
      envueltos.push(nombre);
    }
    // Las alturas: se cuentan en el mundo mientras dura la medición.
    const mundo = S.mundo;
    const origAB = mundo.alturaBaseEn, origA = mundo.alturaEn;
    let muestras = 0;
    mundo.alturaBaseEn = function (...a) { muestras++; return origAB.apply(this, a); };
    mundo.alturaEn = function (...a) { muestras++; return origA.apply(this, a); };
    try {
      m.alternar();
      const lz = m.lienzo;
      let anterior = -1;
      for (let i = 0; i < 12; i++) {
        const p = S.jugador.posicion;
        const { px, py } = m.aPixel(p.x, p.z);
        const r = lz.getBoundingClientRect();
        const cx = r.left + px / lz.width * r.width, cy = r.top + py / lz.height * r.height;
        lz.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
        await esperar(30);
        if (m.nivel === anterior) break;
        anterior = m.nivel;
      }
      await esperar(600);             // que corra el recorte fino y lo que venga detrás
    } finally {
      delete mundo.alturaBaseEn;
      delete mundo.alturaEn;
      if (mundo.alturaBaseEn !== origAB) mundo.alturaBaseEn = origAB;
      if (mundo.alturaEn !== origA) mundo.alturaEn = origA;
    }
    const nivel = m.nivel, mpp = m.vista.mpp;
    for (const n of envueltos) delete m[n];
    m.alternar();
    m.verTodo?.();
    return { ms, muestras, nivel, mpp };
  }

  window.bancoR8F1 = bancoR8F1;
  window.bancoR8F1Zoom = costoZoomMaximo;
})();
