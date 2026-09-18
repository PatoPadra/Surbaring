/**
 * BANCO DE LA FASE 2 (lazo), MITAD NAVEGADOR — ronda 8.
 *
 * Lo que la mitad Node no puede ver, en el juego de verdad:
 *
 *   W1 · poner la primera trampa no compila ningún programa: se cuentan
 *        `renderer.info.programs` antes y después de dibujar, como en la ronda 7.
 *   W2 · la trampa se ve en el mundo: se renderiza la escena a 3 m con el modelo
 *        visible y con `visible = false`, y se resta (ver la memoria
 *        «medir-en-la-imagen-restando»): el umbral contra el fondo mide bordes.
 *   W3 · la marca se ve en el minimapa: el lienzo del minimapa con y sin
 *        `hallazgos.trampas`, restado, alrededor del píxel de la trampa.
 *   W4 · el mundo real: lazos en 60 lugares de tierra a menos de 3 km del arranque
 *        (semilla 31), una noche de verano de 20 a 6, y se cuenta cuántos agarran
 *        algo y qué. Es el número que el dueño va a sentir jugando.
 *
 * Antes de tocar nada anula los guardados (partida, exploración, hallazgos, norma
 * y el automático de calidad), y deja el reloj y la posición como estaban.
 *
 * Uso, con el juego andando y la fase 2 cableada en main.js:
 *   await import('/.claude/flota/banco-r8-fase2.navegador.js')
 *   await window.bancoR8F2()   // progreso en document.body.dataset.bancoR8F2
 */

(() => {
  const PARTIDA = { lat: -41.0870, lon: -71.4290 };
  const marcar = (o) => { document.body.dataset.bancoR8F2 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  function anularGuardados(S) {
    S.partida.guardar = () => {};
    S.calidad.automatico = false;
    for (const k of ['exploracion', 'hallazgos']) { if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; } }
    if (S.norma) S.norma._guardar = () => {};
  }

  function sembrado(semilla) {
    let s = semilla >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  async function bancoR8F2() {
    const S = window.SurviBar;
    const checks = [];
    const notas = [];
    const ok = (c, desc, det) => { checks.push({ ok: !!c, desc, detalle: det === undefined ? '' : String(det) }); return !!c; };
    if (!S) { ok(false, 'premisa: window.SurviBar existe'); return { checks, notas }; }
    anularGuardados(S);
    const T = S.trampas;
    ok(!!T, 'premisa: window.SurviBar.trampas existe (el coordinador la cableó)');
    if (!T) return { checks, notas };
    const j = S.jugador;
    const p0 = j.posicion.clone();
    const g0 = j.giro;
    const fecha0 = new Date(S.tiempo.fecha.getTime());
    const lista0 = T.lista.slice();
    marcar({ paso: 'empezando' });

    try {
      // ── W1 · poner no compila nada ──────────────────────────────────────
      {
        const r = S.render;
        const antes = r.info.programs?.length ?? NaN;
        S.equipo.guardar('trampa_lazo');
        const pz = T.poner('trampa_lazo');
        ok(pz?.ok === true, 'W1 · premisa: se puso un lazo donde está el jugador', pz?.motivo);
        r.render(S.escena, S.camara);
        await esperar(50);
        r.render(S.escena, S.camara);
        const despues = r.info.programs?.length ?? NaN;
        ok(Number.isFinite(antes) && despues === antes, 'W1 · poner el primer lazo no compila ningún programa', `${antes} → ${despues}`);
        // La nasa también, si hay agua cerca: no se exige, se informa
        notas.push(`W1: ${antes} programas antes, ${despues} después`);
      }

      // ── W2 · se ve en el mundo, restando ────────────────────────────────
      {
        const t = T.lista[T.lista.length - 1];
        const modelo = S.trampas3D?.modeloDe?.(t) ?? S.trampas3D?.grupo?.children?.find((m) => m.userData?.trampaId === t.id) ?? null;
        ok(!!modelo, 'W2 · premisa: el lazo puesto tiene un modelo en el mundo (trampas3D.modeloDe o userData.trampaId)');
        if (modelo) {
          // Cámara a 3 m, mirando la trampa desde arriba y de costado
          const cam = S.camara;
          const c0 = { p: cam.position.clone(), q: cam.quaternion.clone() };
          const y = S.mundo.alturaEn(t.x, t.z);
          cam.position.set(t.x + 2.2, y + 1.8, t.z + 1.4);
          cam.lookAt(t.x, y + 0.15, t.z);
          cam.updateMatrixWorld(true);
          const r = S.render;
          const leer = () => {
            const tam = r.getSize(new cam.position.constructor());
            r.render(S.escena, cam);
            const gl = r.getContext();
            const px = new Uint8Array(tam.x * tam.y * 4);
            gl.readPixels(0, 0, tam.x, tam.y, gl.RGBA, gl.UNSIGNED_BYTE, px);
            return { px, w: tam.x, h: tam.y };
          };
          modelo.visible = true;
          const con = leer();
          modelo.visible = false;
          const sin = leer();
          modelo.visible = true;
          let distintos = 0;
          for (let k = 0; k < con.px.length; k += 4) {
            const d = Math.abs(con.px[k] - sin.px[k]) + Math.abs(con.px[k + 1] - sin.px[k + 1]) + Math.abs(con.px[k + 2] - sin.px[k + 2]);
            if (d > 24) distintos++;
          }
          const frac = distintos / (con.w * con.h);
          ok(frac > 0.002, 'W2 · a 3 m, el lazo cambia más del 0,2 % de la pantalla', `${(frac * 100).toFixed(2)} % · ${distintos} píxeles`);
          cam.position.copy(c0.p); cam.quaternion.copy(c0.q); cam.updateMatrixWorld(true);
        }
      }

      // ── W3 · se ve en el minimapa ────────────────────────────────────────
      {
        const mm = S.minimapa, h = S.hallazgos;
        ok(!!mm && !!h, 'W3 · premisa: hay minimapa y hallazgos');
        if (mm && h) {
          const t = T.lista[T.lista.length - 1];
          const lz = mm.lienzo;
          const leer = () => { mm.dibujar(); return lz.getContext('2d').getImageData(0, 0, lz.width, lz.height).data; };
          const con = leer();
          const tr = h.trampas;
          h.trampas = null;
          const sin = leer();
          h.trampas = tr;
          mm.dibujar();
          const q = mm.aPixel(t.x, t.z);
          let cambian = 0, total = 0;
          for (let y = Math.max(0, Math.floor(q.py - 10)); y < Math.min(lz.height, q.py + 10); y++) {
            for (let x = Math.max(0, Math.floor(q.px - 10)); x < Math.min(lz.width, q.px + 10); x++) {
              const k = (y * lz.width + x) * 4;
              total++;
              if (Math.abs(con[k] - sin[k]) + Math.abs(con[k + 1] - sin[k + 1]) + Math.abs(con[k + 2] - sin[k + 2]) > 30) cambian++;
            }
          }
          ok(cambian >= 6, 'W3 · en el minimapa, la trampa cambia al menos 6 píxeles alrededor de su lugar', `${cambian} de ${total} · en ${q.px.toFixed(0)}, ${q.py.toFixed(0)}`);
        }
      }

      // ── W4 · el mundo real ───────────────────────────────────────────────
      {
        marcar({ paso: 'W4: lazos en el mundo real' });
        const M = S.mundo;
        const P = M.aMundo(PARTIDA.lat, PARTIDA.lon);
        const rnd = sembrado(31);
        const lugares = [];
        for (let k = 0; k < 4000 && lugares.length < 60; k++) {
          const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 3000;
          const x = P.x + Math.cos(a) * rr, z = P.z + Math.sin(a) * rr;
          if (!M.dentro(x, z) || M.esAgua(x, z)) continue;
          lugares.push({ x, z });
        }
        const noche = Date.UTC(2025, 1, 12, 23, 0, 0);   // 20:00 hora local
        let conPresa = 0, puestas = 0;
        const porEspecie = new Map();
        const guardadas = T.lista.slice();
        const real = Math.random;
        Math.random = sembrado(32);
        try {
          for (const l of lugares) {
            for (let rep = 0; rep < 5; rep++) {
              T.lista.length = 0;
              S.tiempo.fecha = new Date(noche);
              j.posicion.set(l.x, M.alturaEn(l.x, l.z), l.z);
              S.equipo.guardar('trampa_lazo');
              const r = T.poner('trampa_lazo');
              if (!r?.ok) { for (const { i } of S.inventario.instancias('trampa_lazo')) S.inventario.sacar(i); continue; }
              puestas++;
              S.tiempo.fecha = new Date(noche + 10 * 3600000);
              T.actualizar();
              const t = T.lista[0];
              if (t?.presas?.length) {
                conPresa++;
                const id = t.presas[0].especieId;
                porEspecie.set(id, (porEspecie.get(id) || 0) + 1);
              }
              // Vacío se levanta; con presa se deja caer de la lista (revisarlo abriría
              // la norma y llenaría el bolso de la vista previa).
              if (t && !t.presas?.length) T.levantar?.(t);
              for (const { i } of S.inventario.instancias('trampa_lazo')) S.inventario.sacar(i);
            }
          }
        } finally {
          Math.random = real;
          T.lista.length = 0;
          for (const t of guardadas) T.lista.push(t);
        }
        const top = [...porEspecie].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${(n / Math.max(conPresa, 1) * 100).toFixed(0)} %`);
        const liebre = (porEspecie.get('liebre_europea') || 0) / Math.max(conPresa, 1);
        notas.push(`W4: ${lugares.length} lugares, ${puestas} noches · con presa ${(conPresa / Math.max(puestas, 1) * 100).toFixed(1)} % · liebre ${(liebre * 100).toFixed(1)} % de lo que cae · ${top.slice(0, 6).join(' · ')}`);
        ok(puestas >= 250, 'W4 · premisa: se pudieron poner lazos en al menos 250 noches', puestas);
        ok(conPresa > 0, 'W4 · en una noche de verano cerca del arranque, algún lazo agarra algo', `${conPresa} de ${puestas}`);
        ok((porEspecie.get('liebre_europea') || 0) > 0, 'W4 · y alguna vez es una liebre', porEspecie.get('liebre_europea') || 0);
      }
    } finally {
      // Todo como estaba
      for (const t of T.lista.slice()) if (!lista0.includes(t)) T.levantar?.(t);
      for (const { i } of S.inventario.instancias('trampa_lazo')) S.inventario.sacar(i);
      T.lista.length = 0;
      for (const t of lista0) T.lista.push(t);
      j.posicion.copy(p0); j.giro = g0;
      S.tiempo.fecha = fecha0;
      anularGuardados(S);
    }

    const res = { checks, notas, total: `${checks.filter((c) => c.ok).length}/${checks.length}` };
    marcar({ paso: 'listo', ...res });
    return res;
  }

  window.bancoR8F2 = bancoR8F2;
})();
