/**
 * BANCO DE LA FASE 5 (witral), MITAD NAVEGADOR — ronda 7.
 *
 * Lo que la mitad Node no puede ver:
 *
 *   W1 · levantar el telar en el juego real no compila programas nuevos. Se levanta
 *        con `Construccion.levantar()` en suelo libre, plano y seco de la Reserva
 *        cerca del arranque, y se cuentan los programas antes y después de dibujar.
 *   W4 · la lana alcanza. Es el MISMO instrumento con el que se abrió la fase: 61
 *        puntos de tierra a menos de 3 km del arranque —el arranque y 60 al azar,
 *        semilla 29—, con el sotobosque y la vegetación sembrados de verdad en cada
 *        uno, parado y apretando. En cada punto se cuentan las apretadas cuyo cartel
 *        promete lana, la lana que dieron y lo que entró de paso; con esa tasa se
 *        calcula cuánto cuesta la lana entera de la cadena —derivada de los datos, igual
 *        que en la mitad Node—. La mediana de los 61 puntos: 60 apretadas o menos, y
 *        3 kg o menos de lo que entra de paso.
 *
 * Apertura (13/9/2026, antes del código): el coirón llega a la tecla en 58 de 61
 * puntos; cada coirón da 2 de fibra y 0,151 de lana; las 14 lanas de la carta son 93
 * apretadas y 9,3 kg de fibra.
 *
 * Uso, desde un script inyectado en la página con el juego andando:
 *   await import('/.claude/flota/banco-r7-fase5.navegador.js')
 *   await window.bancoR7F5()   // progreso en document.body.dataset.bancoR7F5
 */

(() => {
  const PARTIDA = { lat: -41.0870, lon: -71.4290 };
  const RADIO_M = 3000;
  const MUESTRAS = 61;
  const SEMILLA = 29;
  const TOPE_APRETADAS = 60;
  const TOPE_KG = 3;

  const marcar = (o) => { document.body.dataset.bancoR7F5 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  /** La misma cuenta que `lanaTotal()` de la mitad Node. */
  function lanaTotal(H, tecnologias, C) {
    const objetos = new Map((H.objetos || []).map((o) => [o.id, o]));
    const tecs = new Map((tecnologias || []).map((t) => [t.id, t]));
    const productor = (r) => (H.objetos || []).find((o) => (o.produce || []).some((p) => p.recurso === r));
    const vistas = new Set();
    let lana = 0;
    const pedir = (materiales, veces, hondo) => {
      if (hondo > 8) return;
      for (const m of materiales || []) {
        const n = m.cantidad * veces;
        if (m.recurso === 'lana') { lana += n; continue; }
        const p = productor(m.recurso);
        if (!p) continue;
        const sale = p.produce.find((x) => x.recurso === m.recurso).cantidad;
        pedir(p.materiales, Math.ceil(n / sale), hondo + 1);
        tec(p.tecnologia);
      }
    };
    const tec = (id) => {
      if (!id || vistas.has(id)) return;
      vistas.add(id);
      const t = tecs.get(id);
      if (!t) return;
      pedir(t.materiales, 1, 0);
      for (const r of t.requiere || []) tec(r);
    };
    for (const id of ['poncho_witral', 'huso']) {
      const o = objetos.get(id);
      if (o) { pedir(o.materiales, 1, 0); tec(o.tecnologia); }
    }
    tec('telar_witral');
    const obra = (C.obras || []).find((o) => o.id === 'telar_witral');
    if (obra) { pedir(obra.materiales, 1, 0); tec(obra.requiereTecnologia); }
    return lana;
  }

  window.bancoR7F5 = async function bancoR7F5() {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, fin: false };
    const ok = (c, desc, det) => { out.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); marcar(out); return !!c; };
    try {
      if (S.partida) S.partida.guardar = () => {};
      if (S.calidad) S.calidad.automatico = false;
      const { jugador, sotobosque, vegetacion, recoleccion, tiempo, mundo, camara, limites, inventario,
        construccion, fundicion, obras, saberes, render, compositor, escena, agua, hud, fabricacion } = S;
      const P = mundo.aMundo(PARTIDA.lat, PARTIDA.lon);

      // ── W1 · el telar no compila nada ──────────────────────────────────────
      const obra = construccion.catalogo.find((o) => o.id === 'telar_witral');
      ok(!!obra, 'W1 · premisa: el catálogo de obras tiene el telar');
      if (obra) {
        const libre = (x, z) => construccion.obras.every((o) => Math.hypot(o.x - x, o.z - z) > 12)
          && fundicion.hornos.every((h) => Math.hypot(h.x - x, h.z - z) > 12);
        let lx = null, lz = null;
        for (let r = 20; r < 800 && lx === null; r += 8) {
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
            if (!libre(x, z) || limites.jurisdiccion(x, z) !== 'reserva' || mundo.pendienteEn(x, z) > 0.15) continue;
            let seco = true;
            for (let dx = -8; dx <= 8 && seco; dx += 4) for (let dz = -8; dz <= 8; dz += 4) if (mundo.esAgua(x + dx, z + dz)) { seco = false; break; }
            if (seco) { lx = x; lz = z; break; }
          }
        }
        ok(lx !== null, 'W1 · premisa: hay suelo libre, plano y seco en la Reserva cerca del arranque');
        if (lx !== null) {
          const ly = mundo.alturaEn(lx, lz);
          saberes.desbloqueadas.add(obra.requiereTecnologia);
          if (inventario.capacidadKg < 400) inventario.capacidadKg = 400;
          for (const m of obra.materiales || []) inventario.agregar(m.recurso, m.cantidad * 2);
          jugador.posicion.set(lx, ly + 1.2, lz);
          const cuadro = () => { S.juntarLuces(); agua.dibujarReflejo(render, escena, camara); compositor.render(); };
          const mirar = () => {
            camara.up.set(0, 1, 0); camara.position.set(lx, ly + 1.7, lz + 7);
            camara.lookAt(lx, ly + 1, lz); camara.updateMatrixWorld();
          };
          mirar(); cuadro(); cuadro();
          const p0 = render.info.programs.length;
          const dicho = [], avisoReal = hud.aviso, negativaReal = hud.negativa;
          hud.aviso = (t) => dicho.push(String(t));
          hud.negativa = (v) => dicho.push(v?.titulo || String(v));
          let c = null;
          try { c = construccion.levantar(obra); } finally { hud.aviso = avisoReal; hud.negativa = negativaReal; }
          ok(!!c, 'W1 · premisa: el telar se levanta con Construccion.levantar()', dicho.join(' | '));
          if (c && !obras.piezas.some((p) => p.construida === c)) obras.agregar(c);
          mirar(); cuadro(); cuadro(); cuadro();
          const p1 = render.info.programs.length;
          out.numeros.lugar = { x: Math.round(lx), z: Math.round(lz) };
          out.numeros.programas = { antes: p0, despues: p1 };
          ok(!!c && p1 === p0, 'W1 · levantar el telar no compila programas nuevos', `${p0} → ${p1}`);
        }
      }

      // ── W4 · la lana alcanza ───────────────────────────────────────────────
      const total = lanaTotal(fabricacion.datos, [...saberes.porId.values()], construccion.d);
      out.numeros.lanaDeLaCadena = total;
      ok(total > 0, 'W4 · premisa: la cadena de cero al poncho pide lana', total);

      const est = tiempo.estado();
      const ahora = tiempo.segundosTotales + 7e6;
      inventario.capacidadKg = 5000;
      const promete = (etq) => {
        const m = /\(([^()]*)\)\s*$/.exec(etq || '');
        return !!m && m[1].split('·').some((x) => /lana/i.test(x));
      };
      let semilla = SEMILLA;
      const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
      const muestras = [{ x: P.x, z: P.z, d: 0 }];
      let intentos = 0;
      while (muestras.length < MUESTRAS && intentos < 100000) {
        intentos++;
        const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * RADIO_M;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (!mundo.dentro(x, z) || mundo.esAgua(x, z)) continue;
        muestras.push({ x, z, d: Math.round(r) });
      }
      ok(muestras.length === MUESTRAS, 'W4 · premisa: se juntaron los 61 puntos de la apertura', muestras.length);

      const kgLana = inventario.kgDe('lana');
      const foto = () => JSON.stringify(inventario.listar().map((i) => [i.id, i.cantidad]));
      const avisoReal = hud.aviso;
      hud.aviso = () => {};
      const puntos = [];
      try {
        for (let k = 0; k < muestras.length; k++) {
          const m = muestras[k];
          jugador.posicion.set(m.x, mundo.alturaEn(m.x, m.z) + 1.2, m.z);
          sotobosque.sembrarTodo(jugador.posicion);
          vegetacion.actualizar(jugador.posicion, 0, est, camara);
          let deLana = 0, lana = 0, kgDePaso = 0, quietas = 0;
          for (let v = 0; v < 220 && deLana < 90; v++) {
            const acc = recoleccion.quePuedoHacer(ahora);
            if (!acc) break;
            const esDeLana = promete(acc.etiqueta);
            const antes = foto(), l0 = inventario.cantidad('lana'), kg0 = inventario.pesoKg;
            recoleccion.actuar(ahora);
            if (esDeLana) {
              deLana++;
              const dl = inventario.cantidad('lana') - l0;
              lana += dl;
              kgDePaso += (inventario.pesoKg - kg0) - dl * kgLana;
            }
            if (antes === foto()) { if (++quietas >= 3) break; } else quietas = 0;
          }
          puntos.push({
            d: m.d, jur: limites.jurisdiccion(m.x, m.z), deLana, lana,
            apretadas: lana > 0 ? total * deLana / lana : Infinity,
            kg: lana > 0 ? total * kgDePaso / lana : Infinity,
          });
          if (k % 5 === 0) { out.numeros.progreso = k; marcar(out); await esperar(0); }
        }
      } finally {
        hud.aviso = avisoReal;
      }
      const mediana = (xs) => { const b = xs.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const redondo = (v) => (Number.isFinite(v) ? +v.toFixed(1) : 'nunca');
      const medAp = mediana(puntos.map((p) => p.apretadas)), medKg = mediana(puntos.map((p) => p.kg));
      out.numeros.lana = {
        puntos: puntos.length, conLana: puntos.filter((p) => p.lana > 0).length,
        medianaApretadas: redondo(medAp), medianaKg: redondo(medKg),
        arranque: { ...puntos[0], apretadas: redondo(puntos[0]?.apretadas), kg: redondo(puntos[0]?.kg) },
      };
      ok(medAp <= TOPE_APRETADAS, 'W4 · la lana de cero al poncho cuesta 60 apretadas o menos, en la mediana', redondo(medAp));
      ok(medKg <= TOPE_KG, 'W4 · lo que entra de paso no pesa más de 3 kg, en la mediana', redondo(medKg));
      out.fin = true;
    } catch (e) {
      ok(false, 'el banco corrió sin explotar', `${e.message} ${String(e.stack || '').split('\n')[1] || ''}`);
      out.fin = true;
    }
    marcar(out);
    return out;
  };
})();
