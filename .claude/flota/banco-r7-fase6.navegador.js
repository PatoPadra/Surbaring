/**
 * BANCO DE LA FASE 6 (cielo), MITAD NAVEGADOR — ronda 7.
 *
 * Lo que la mitad Node no puede ver, medido en la imagen final del juego:
 *
 *   C3 · de noche y sin luna, el píxel de Acrux, Mimosa y α Cen brilla muy por encima
 *        del cielo de alrededor; las de la Cruz se ordenan por magnitud; no hay puntos
 *        brillantes a más de 0,5° de toda estrella del catálogo; con el cielo cubierto y
 *        de día, Acrux no se ve.
 *   C5 · con una luna en cuarto alta y de noche, la fracción de disco iluminado sigue a
 *        la iluminación a 0,15 —medida por áreas contra la luna llena—, y el lado
 *        iluminado mira al sol.
 *   C6 · una noche de luna llena alta alumbra más que una de luna nueva.
 *   C8 · lo que la noche le suma a la GPU, mirando alto al sur, con Baja y a 1024×576,
 *        sube 1 ms o menos sobre la base; los programas son los mismos de día y de noche.
 *
 * Las direcciones de las estrellas se calculan acá, con la misma cuenta que la mitad
 * Node —Meeus 12.4 y 21.2— sobre el catálogo crudo, y no con el código del agente.
 *
 * Contra la base (15/9/2026, antes del código): la Cruz no brilla —Acrux 2,1 de
 * contraste—; 126 de 194 puntos brillantes no eran del catálogo a 1°; el disco de la
 * luna salía entero en cuarto; la noche le sumaba 5,43 ms a la GPU (noche 22,0, día 16,6).
 *
 * Uso, desde un script inyectado en la página con el juego andando:
 *   await import('/.claude/flota/banco-r7-fase6.navegador.js')
 *   await window.bancoR7F6()   // progreso en document.body.dataset.bancoR7F6
 */

(() => {
  const W = 1024, H = 576;
  /**
   * Lo que la noche le suma a la GPU en la base: noche menos día, promedio de seis pares
   * alternados en dos corridas del 15/9/2026, que fueron de 4,64 a 5,56. La primera
   * versión tomaba una sola corrida, 5,43, y entre corridas hay medio milisegundo de
   * ruido: la mitad del tope.
   */
  const BASE_DELTA_MS = 5.06, TOPE_MS = 1.0;
  /** Medianoche local sin luna: JPL da 12,6 % y la luna a −20°. */
  const NOCHE_OSCURA = new Date('2026-01-15T03:00:00Z');
  const MEDIODIA = new Date('2026-01-15T16:00:00Z');
  const LUNA_NUEVA_2024 = new Date('2024-02-10T03:30:00Z');
  const DIA_2024 = new Date('2024-02-10T16:00:00Z');
  const HR = { acrux: 4730, mimosa: 4853, gacrux: 4763, deltaCru: 4656, alfaCen: 5459 };

  const marcar = (o) => { document.body.dataset.bancoR7F6 = JSON.stringify(o); };
  const RAD = Math.PI / 180;
  const sen = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);
  const norm360 = (d) => ((d % 360) + 360) % 360;
  const JD = (f) => f.getTime() / 86400000 + 2440587.5;

  async function three() {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/\.vite\/deps\/three\.js/.test(n));
    if (!url) throw new Error('no encuentro el módulo de three que cargó el juego');
    return import(url);
  }
  function cargar(src) {
    return new Promise((ok, mal) => { const e = document.createElement('script'); e.src = `${src}?t=${Date.now()}`; e.onload = ok; e.onerror = mal; document.head.appendChild(e); });
  }

  /** El BSC5 crudo, con las columnas del `ReadMe`. */
  async function catalogo() {
    // Vite sirve el .gz con `Content-Encoding: gzip`, así que el navegador ya lo entrega
    // descomprimido. La primera versión lo volvía a descomprimir y el banco explotaba con
    // «Failed to fetch». Se mira la firma de gzip y se descomprime sólo si está.
    const r = await fetch('/tools/catalogos/bsc5/catalog.gz');
    const bytes = new Uint8Array(await r.arrayBuffer());
    const comprimido = bytes[0] === 0x1f && bytes[1] === 0x8b;
    const texto = comprimido
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder('latin1').decode(bytes);
    const lista = [];
    for (const f of texto.split('\n')) {
      if (f.length < 107 || f.slice(75, 77).trim() === '' || f.slice(102, 107).trim() === '') continue;
      lista.push({
        hr: +f.slice(0, 4),
        ra: 15 * (+f.slice(75, 77) + +f.slice(77, 79) / 60 + +f.slice(79, 83) / 3600),
        dec: (f[83] === '-' ? -1 : 1) * (+f.slice(84, 86) + +f.slice(86, 88) / 60 + +f.slice(88, 90) / 3600),
        v: +f.slice(102, 107),
      });
    }
    return lista;
  }

  function precesar(ra, dec, jd) {
    const t = (jd - 2451545) / 36525;
    const z = (2306.2181 * t + 0.30188 * t * t) / 3600, zeta = (2306.2181 * t + 1.09468 * t * t) / 3600, th = (2004.3109 * t - 0.42665 * t * t) / 3600;
    const A = cos(dec) * sen(ra + zeta), B = cos(th) * cos(dec) * cos(ra + zeta) - sen(th) * sen(dec), C = sen(th) * cos(dec) * cos(ra + zeta) + cos(th) * sen(dec);
    return { ra: norm360(Math.atan2(A, B) / RAD + z), dec: Math.asin(Math.max(-1, Math.min(1, C))) / RAD };
  }
  /** Dirección en el mundo —+X este, +Z sur, +Y arriba—, como `vectorSolar()`. */
  function direccion(THREE, ra, dec, fecha, lat, lon) {
    const jd = JD(fecha), p = precesar(ra, dec, jd), T = (jd - 2451545) / 36525;
    const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000);
    const H = gmst + lon - p.ra;
    const alt = Math.asin(sen(lat) * sen(p.dec) + cos(lat) * cos(p.dec) * cos(H)) / RAD;
    const az = norm360(Math.atan2(-cos(p.dec) * sen(H), sen(p.dec) * cos(lat) - cos(p.dec) * sen(lat) * cos(H)) / RAD);
    return new THREE.Vector3(cos(alt) * sen(az), sen(alt), -cos(alt) * cos(az));
  }

  window.bancoR7F6 = async function bancoR7F6() {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, fin: false };
    const ok = (c, desc, det) => { out.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); marcar(out); return !!c; };
    try {
      const THREE = await three();
      const { render, compositor, escena, camara, agua, calidad, cielo, mundo } = S;
      calidad.automatico = false;
      if (S.partida) S.partida.guardar = () => {};
      if (typeof window.banco !== 'function') await cargar('/banco.js');
      ok(calidad.preset?.nombre === 'Baja', 'premisa: preset Baja', calidad.preset?.nombre);
      const { lat, lon } = mundo.meta.centro;
      const cat = await catalogo();
      ok(cat.length > 9000, 'premisa: el catálogo crudo se leyó en el navegador', cat.length);
      const estrella = (hr) => cat.find((e) => e.hr === hr);

      // ── El instrumento: la imagen final, leída a tamaño completo ─────────────
      const fijar = () => {
        render.setPixelRatio(1); render.setSize(W, H, false);
        compositor.setPixelRatio(1); compositor.setSize(W, H); S.oclusion?.setSize(W, H);
        calidad.ctx?.suavizado?.material?.uniforms?.resolution?.value.set(1 / W, 1 / H);
        camara.aspect = W / H; camara.updateProjectionMatrix(); S.csm.updateFrustums();
        compositor.renderToScreen = false;
      };
      const copia = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType });
      const matCopia = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
      const escCopia = new THREE.Scene(); escCopia.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matCopia));
      const camCopia = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camCopia.position.z = 1;
      const P = mundo.aMundo(lat, lon);
      const ojo = new THREE.Vector3(P.x, mundo.alturaEn(P.x, P.z) + 1.7, P.z);
      const fovJuego = camara.fov;

      /** Lleva el juego a esa fecha con cuadros de verdad, para que la exposición se asiente. */
      const irA = async (fecha) => {
        const ll = mundo.aLatLon(P.x, P.z);
        await window.banco({ ancho: W, alto: H, cuadros: 3, puntos: [{ id: 'cielo', lat: ll.lat, lon: ll.lon, altura: 1.7, rumbo: 180, cabeceo: 40 }], fecha });
        fijar();
      };
      const leer = (fecha, mirar, { fov = fovJuego, nubes = 0 } = {}) => {
        cielo.actualizar(fecha, lat, lon, 0);
        cielo.uniformes.uNubes.value = nubes;
        cielo.uniformes.uCeniza.value = 0;
        camara.fov = fov; camara.updateProjectionMatrix();
        camara.up.set(0, 1, 0); camara.position.copy(ojo);
        camara.lookAt(ojo.x + mirar.x, ojo.y + mirar.y, ojo.z + mirar.z); camara.updateMatrixWorld();
        S.juntarLuces(); agua.dibujarReflejo(render, escena, camara); compositor.render();
        matCopia.map = compositor.readBuffer.texture; matCopia.needsUpdate = true;
        render.setRenderTarget(copia); render.clear(); render.render(escCopia, camCopia); render.setRenderTarget(null);
        const px = new Uint8Array(W * H * 4); render.readRenderTargetPixels(copia, 0, 0, W, H, px);
        return px;
      };
      const lum = (px, i, j) => { const q = (j * W + i) * 4; return 0.2126 * px[q] + 0.7152 * px[q + 1] + 0.0722 * px[q + 2]; };
      const aPantalla = (dir) => {
        const v = ojo.clone().addScaledVector(dir, 1000).project(camara);
        return { i: Math.round((v.x * 0.5 + 0.5) * (W - 1)), j: Math.round((v.y * 0.5 + 0.5) * (H - 1)), dentro: v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95, x: v.x, y: v.y };
      };
      const pico = (px, c, r = 2) => {
        let m = 0;
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          const i = c.i + di, j = c.j + dj;
          if (i >= 0 && j >= 0 && i < W && j < H) m = Math.max(m, lum(px, i, j));
        }
        return m;
      };
      const fondo = (px, c) => {
        const vals = [];
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          for (const rr of [7, 10]) {
            const i = Math.round(c.i + Math.cos(a) * rr), j = Math.round(c.j + Math.sin(a) * rr);
            if (i >= 0 && j >= 0 && i < W && j < H) vals.push(lum(px, i, j));
          }
        }
        vals.sort((a, b) => a - b);
        return vals[vals.length >> 1] ?? 0;
      };

      // ── C3 · las estrellas de la Cruz, en la imagen ──────────────────────────
      await irA(NOCHE_OSCURA);
      const dirs = Object.fromEntries(Object.entries(HR).map(([k, hr]) => [k, direccion(THREE, estrella(hr).ra, estrella(hr).dec, NOCHE_OSCURA, lat, lon)]));
      const centro = dirs.acrux.clone().add(dirs.mimosa).add(dirs.gacrux).add(dirs.deltaCru).normalize();
      out.numeros.alturaCruz = +(Math.asin(centro.y) / RAD).toFixed(1);
      ok(centro.y > 0.3, 'C3 · premisa: a esa hora la Cruz está alta', out.numeros.alturaCruz);
      const mirarCruz = centro.clone().lerp(dirs.alfaCen, 0.3).normalize();
      const px = leer(NOCHE_OSCURA, mirarCruz);
      const contraste = {};
      for (const k of Object.keys(HR)) {
        const c = aPantalla(dirs[k]);
        contraste[k] = c.dentro ? +(pico(px, c) - fondo(px, c)).toFixed(1) : null;
      }
      out.numeros.contraste = contraste;
      ok(Object.values(contraste).every((v) => v !== null), 'C3 · premisa: las cinco estrellas caen en la imagen', JSON.stringify(contraste));
      ok(contraste.acrux >= 20 && contraste.mimosa >= 20 && contraste.alfaCen >= 20, 'C3 · Acrux, Mimosa y α Cen brillan muy por encima del cielo de alrededor', JSON.stringify(contraste));
      ok(Math.min(contraste.acrux, contraste.mimosa) >= contraste.gacrux - 3 && contraste.gacrux >= contraste.deltaCru + 3,
        'C3 · las de la Cruz se ordenan por brillo como por magnitud', JSON.stringify(contraste));

      // Estrellas inventadas. A 0,5° y no a 1°: con las 9096 del catálogo, un punto al
      // azar tiene una estrella a menos de 1° la mitad de las veces, y la mitad de las
      // estrellas falsas pasaban. A 0,5° es una de cada seis, y entra igual una estrella
      // dibujada sin precesión (0,25°) con su halo.
      const todas = cat.map((e) => direccion(THREE, e.ra, e.dec, NOCHE_OSCURA, lat, lon));
      const cosRadio = Math.cos(0.5 * RAD);
      const inv = camara.projectionMatrixInverse, mundoCam = camara.matrixWorld;
      let brillantes = 0, inventadas = 0;
      for (let j = 4; j < H - 4; j += 2) {
        for (let i = 4; i < W - 4; i += 2) {
          const l = lum(px, i, j);
          if (l < 30) continue;
          if (l - fondo(px, { i, j }) < 20) continue;
          const d = new THREE.Vector3((i / (W - 1)) * 2 - 1, (j / (H - 1)) * 2 - 1, 0.5).applyMatrix4(inv).applyMatrix4(mundoCam).sub(ojo).normalize();
          if (d.y < 0.15) continue;
          brillantes++;
          if (!todas.some((t) => t.dot(d) >= cosRadio)) inventadas++;
        }
      }
      out.numeros.puntos = { brillantes, inventadas };
      ok(inventadas === 0, 'C3 · no hay puntos brillantes a más de 0,5° de toda estrella del catálogo', `${inventadas} de ${brillantes}`);

      const cubierto = leer(NOCHE_OSCURA, mirarCruz, { nubes: 1 });
      const cA = aPantalla(dirs.acrux);
      const conNubes = +(pico(cubierto, cA) - fondo(cubierto, cA)).toFixed(1);
      ok(contraste.acrux >= 20 && conNubes <= 0.3 * contraste.acrux, 'C3 · con el cielo cubierto, Acrux no se ve', `${conNubes} contra ${contraste.acrux}`);
      await irA(MEDIODIA);
      const dirDia = direccion(THREE, estrella(HR.acrux).ra, estrella(HR.acrux).dec, MEDIODIA, lat, lon);
      const dia = leer(MEDIODIA, dirDia);
      const cD = aPantalla(dirDia);
      const deDia = +(pico(dia, cD) - fondo(dia, cD)).toFixed(1);
      ok(contraste.acrux >= 20 && deDia <= 8, 'C3 · de día, Acrux no se ve', deDia);

      // ── C5 · la fase del disco ───────────────────────────────────────────────
      const buscarLuna = (desde, cond) => {
        for (let h = 0; h < 24 * 60; h++) {
          const f = new Date(desde.getTime() + h * 3600e3);
          cielo.actualizar(f, lat, lon, 0);
          if (cond()) return { f, k: cielo.uniformes.uFaseLunar.value, luz: cielo.luzAmbiente.intensity };
        }
        return null;
      };
      const noche = () => cielo.alturaSol < -12 * RAD;
      const cuarto = buscarLuna(new Date('2026-01-16T00:00:00Z'), () => noche() && cielo.direccionLuna.y > Math.sin(25 * RAD)
        && cielo.uniformes.uFaseLunar.value > 0.35 && cielo.uniformes.uFaseLunar.value < 0.65);
      const llenaAlta = buscarLuna(new Date('2026-01-01T00:00:00Z'), () => noche() && cielo.uniformes.uFaseLunar.value > 0.95
        && cielo.direccionLuna.y > Math.sin(35 * RAD));
      ok(!!cuarto, 'C5 · premisa: hay una noche con la luna en cuarto y alta', cuarto?.f.toISOString());
      ok(!!llenaAlta, 'C5 · premisa: hay una noche con la luna llena y alta', llenaAlta?.f.toISOString());

      // La fase se mide en el perfil que cruza el disco sobre el eje del sol. No por
      // áreas con un umbral: la segunda versión contó 273 772 píxeles de luna llena —el
      // halo, no el disco— y daba verde contra la base por casualidad. Y no contra un
      // disco de tamaño supuesto: el juego dibujaba la luna con 1,4° de radio. En el
      // perfil, el borde del disco y el terminador son los saltos más fuertes. Con la
      // luna llena se mide el radio; en cuarto, lo iluminado sobre ese eje es 2·r·k.
      const perfilDisco = async (momento) => {
        await irA(momento.f);
        cielo.actualizar(momento.f, lat, lon, 0);
        const m = cielo.direccionLuna.clone().normalize();
        const img = leer(momento.f, m, { fov: 6 });
        const sd = cielo.direccionSol.clone().normalize();
        const tangente = sd.clone().addScaledVector(m, -sd.dot(m)).normalize();
        const hacia = aPantalla(m.clone().addScaledVector(tangente, 0.01).normalize());
        const u = new THREE.Vector2(hacia.x * W / 2, hacia.y * H / 2).normalize();
        const n = new THREE.Vector2(-u.y, u.x);
        const T = Math.floor(Math.min(W, H) / 2) - 4;
        const p = [];
        for (let t = -T; t <= T; t++) {
          let s = 0;
          for (const q of [-1, 0, 1]) s += lum(img, Math.round(W / 2 + u.x * t + n.x * q), Math.round(H / 2 + u.y * t + n.y * q));
          p.push(s / 3);
        }
        const valor = (t) => p[t + T];
        const g = (t) => p[t + T + 2] - p[t + T - 2];
        let limbo = null, gMin = Infinity;
        for (let t = 2; t <= T - 2; t++) if (g(t) < gMin) { gMin = g(t); limbo = t; }
        let izquierda = null, gMax = -Infinity;
        for (let t = -(T - 2); t <= -2; t++) if (g(t) > gMax) { gMax = g(t); izquierda = t; }
        return { valor, g, T, limbo, izquierda, maximo: Math.max(...p) };
      };
      if (cuarto && llenaAlta) {
        const pl = await perfilDisco(llenaAlta);
        const radio = (pl.limbo - pl.izquierda) / 2;
        const pc = await perfilDisco(cuarto);
        let terminador = null, gMax = -Infinity;
        for (let t = Math.max(-(pc.T - 2), Math.round(pc.limbo - 2 * radio - 6)); t <= pc.limbo - 4; t++) {
          if (pc.g(t) > gMax) { gMax = pc.g(t); terminador = t; }
        }
        const fraccion = terminador !== null && radio > 0 ? (pc.limbo - terminador) / (2 * radio) : 0;
        const esperada = cuarto.k;
        let solLado = 0, otroLado = 0;
        for (let t = 1; t < radio; t++) { solLado += pc.valor(t); otroLado += pc.valor(-t); }
        const razon = otroLado > 0 ? solLado / otroLado : 0;
        out.numeros.luna = {
          cuarto: cuarto.f.toISOString(), llena: llenaAlta.f.toISOString(), iluminacion: +esperada.toFixed(2),
          radioPx: radio, limboCuarto: pc.limbo, terminador, fraccion: +fraccion.toFixed(2), razonLadoAlSol: +razon.toFixed(2),
        };
        // Hasta el final del perfil, no hasta la mitad: la luna de la base mide 158 px de
        // radio con el campo de 6°, y la primera versión de esta premisa suponía un disco
        // chico y caía contra la base por el motivo equivocado.
        ok(pl.maximo > 40 && radio >= 5 && radio <= pl.T - 6, 'C5 · premisa: el disco de la luna llena se ve, con borde', `máximo ${pl.maximo.toFixed(0)} · radio ${radio} px`);
        ok(Math.abs(fraccion - esperada) <= 0.15, 'C5 · la fracción de disco iluminado sigue a la iluminación', `${fraccion.toFixed(2)} contra ${esperada.toFixed(2)}`);
        ok(razon >= 1.5, 'C5 · el lado iluminado mira al sol', razon.toFixed(2));
      }

      // ── C6 · la luz de la noche sigue a la luna ──────────────────────────────
      const nueva = buscarLuna(new Date('2026-01-01T00:00:00Z'), () => cielo.alturaSol < -15 * RAD && cielo.uniformes.uFaseLunar.value < 0.05);
      const llena = buscarLuna(new Date('2026-01-01T00:00:00Z'), () => cielo.alturaSol < -15 * RAD && cielo.uniformes.uFaseLunar.value > 0.95 && cielo.direccionLuna.y > Math.sin(40 * RAD));
      out.numeros.nochesDeLuna = { llena: llena && { f: llena.f.toISOString(), luz: +llena.luz.toFixed(4) }, nueva: nueva && { f: nueva.f.toISOString(), luz: +nueva.luz.toFixed(4) } };
      ok(!!llena && !!nueva, 'C6 · premisa: hay una noche de luna llena alta y una de luna nueva', JSON.stringify(out.numeros.nochesDeLuna));
      ok(!!llena && !!nueva && llena.luz >= 1.2 * nueva.luz, 'C6 · la noche de luna llena alumbra más que la de luna nueva', llena && nueva ? `${llena.luz.toFixed(4)} contra ${nueva.luz.toFixed(4)}` : '—');

      // ── C8 · el costo y los programas ────────────────────────────────────────
      // Noche menos día, en pares alternados. La cifra absoluta cambia de una sesión a
      // otra —la misma noche dio 23,4 ms en la apertura y 20,0 horas después—, y contra un
      // número de otra sesión el tope regalaba tres milisegundos.
      const puntoAlto = { id: 'alto-sur', lat, lon, altura: 2, rumbo: 180, cabeceo: 55 };
      const pares = [];
      for (let k = 0; k < 5; k++) {
        const n = await window.banco({ ancho: W, alto: H, cuadros: 20, puntos: [puntoAlto], fecha: LUNA_NUEVA_2024 });
        const d = await window.banco({ ancho: W, alto: H, cuadros: 20, puntos: [puntoAlto], fecha: DIA_2024 });
        const mN = n.puntos?.[0]?.msGPU, mD = d.puntos?.[0]?.msGPU;
        pares.push({ noche: mN, dia: mD, delta: +(mN - mD).toFixed(2) });
      }
      const delta = pares.map((p) => p.delta).sort((a, b) => a - b)[2];
      out.numeros.costo = { pares, medianaDelta: delta, base: BASE_DELTA_MS };
      ok(Number.isFinite(delta) && delta <= BASE_DELTA_MS + TOPE_MS, 'C8 · lo que la noche le suma a la GPU sube 1 ms o menos sobre la base', `${delta} contra ${BASE_DELTA_MS}`);
      await window.banco({ ancho: W, alto: H, cuadros: 3, puntos: [puntoAlto], fecha: MEDIODIA });
      const pDia = render.info.programs.length;
      await window.banco({ ancho: W, alto: H, cuadros: 3, puntos: [puntoAlto], fecha: NOCHE_OSCURA });
      const pNoche = render.info.programs.length;
      out.numeros.programas = { dia: pDia, noche: pNoche };
      ok(pDia === pNoche, 'C8 · los programas son los mismos de día y de noche', `${pDia} · ${pNoche}`);

      camara.fov = fovJuego; camara.updateProjectionMatrix();
      out.fin = true;
    } catch (e) {
      ok(false, 'el banco corrió sin explotar', `${e.message} ${String(e.stack || '').split('\n')[1] || ''}`);
      out.fin = true;
    }
    marcar(out);
    return out;
  };
})();
