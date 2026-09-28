/**
 * Ronda 8 · ¿el terreno recibe sombras? (lo sospechó el agente `suelo` en la fase 3b:
 * el atributo `normal` de la malla del terreno es todo cero, y la corrección de sombra
 * de three lo normaliza; en ANGLE eso puede dar NaN y la sombra, 1).
 *
 * El instrumento, restando: un árbol INVISIBLE para la cámara (su material no escribe
 * color ni profundidad) pero que sigue proyectando sombra (el pase de sombra usa el
 * material de profundidad), mirado derecho abajo desde 30 m. Dos cuadros: con la sombra
 * del árbol prendida y apagada. Si el terreno recibe sombras, la diferencia es una
 * mancha oscura con la forma del árbol; si no, cero.
 *
 * Control: lo mismo sobre un plano de prueba con MeshStandardMaterial puesto sobre el
 * suelo (recibe sombra como cualquier objeto de three). Si el plano muestra la mancha y
 * el terreno no, el defecto es del terreno y no del instrumento.
 *
 * Uso: await import('/.claude/flota/r8-sombra.navegador.js'); await window.medirSombra()
 */
(() => {
  const FECHA = '2025-02-12T15:00:00Z';
  const SEMILLAS = [137, 23];
  const AL_AZAR = ['sotobosque', 'fauna', 'peces', 'clima', 'hornos', 'obras', 'trampas', 'jugador'];
  const LADO = 512;

  /**
   * El acné: el terreno haciéndose sombra a sí mismo, con todo lo demás apagado, mirado
   * derecho abajo sobre la ladera de 25° de la 3b a la hora que se pida (el sol bajo).
   * Se prende y se apaga `castShadow` del terreno —no recompila: sólo cambia el pase de
   * sombra— y se resta. Lo que oscurece en manchas grandes es la sombra del relieve;
   * lo que oscurece en puntitos (componentes de 6 px o menos) o en rayas es acné.
   */
  window.medirAcne = async function medirAcne(op = {}) {
    const S = window.SurviBar, r = S.render, gl = r.getContext(), cam = S.camara, M = S.mundo, T = S.tiempo;
    const fecha = op.fecha || '2025-02-12T11:00:00Z';
    const x = op.x ?? -3448.3377936424095, z = op.z ?? 10144.749999999683, alto = op.alto ?? 30;
    const sem0 = [T._semillaA, T._semillaB], f0 = new Date(T.fecha.getTime());
    const nombres = [...AL_AZAR, 'vegetacion'];
    const grupos = S.escena.children.filter((c) => nombres.includes(c.name));
    const gvis0 = grupos.map((g) => g.visible);
    const c0 = { p: cam.position.clone(), q: cam.quaternion.clone(), up: cam.up.clone() };
    const t = S.terreno.malla, cast0 = t.castShadow;
    const j0 = S.jugador.posicion.clone();
    try {
      T._semillaA = SEMILLAS[0]; T._semillaB = SEMILLAS[1];
      const g = M.aLatLon(x, z);
      await window.capturar('r8-acne-preparar', { lat: g.lat, lon: g.lon, altura: alto, cabeceo: -80, fecha, ancho: LADO, alto: LADO, conFauna: false });
      grupos.forEach((q) => { q.visible = false; });
      r.setPixelRatio(1); r.setSize(LADO, LADO, false);
      cam.aspect = 1; cam.updateProjectionMatrix();
      cam.up.set(0, 0, -1);
      cam.position.set(x, M.alturaEn(x, z) + alto, z);
      cam.lookAt(x, M.alturaEn(x, z), z);
      cam.updateMatrixWorld(true);
      S.csm.update();
      const leer = () => {
        S.terreno.actualizar(cam);
        r.setRenderTarget(null); r.render(S.escena, cam);
        const px = new Uint8Array(LADO * LADO * 4);
        gl.readPixels(0, 0, LADO, LADO, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const L = new Float32Array(LADO * LADO);
        for (let k = 0; k < L.length; k++) L[k] = 0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2];
        return L;
      };
      t.castShadow = true; const con = leer();
      t.castShadow = false; const sin = leer();
      const m = new Uint8Array(LADO * LADO);
      let n = 0;
      for (let k = 0; k < m.length; k++) if (sin[k] - con[k] > 6) { m[k] = 1; n++; }
      if (op.guardar) {
        // La resta, en gris (blanco = más oscuro con la sombra), para mirarla
        const c2 = document.createElement('canvas'); c2.width = LADO; c2.height = LADO;
        const ctx = c2.getContext('2d'); const img = ctx.createImageData(LADO, LADO);
        for (let y = 0; y < LADO; y++) for (let xx = 0; xx < LADO; xx++) {
          const k = (LADO - 1 - y) * LADO + xx, v = Math.max(0, Math.min(255, (sin[k] - con[k]) * 3)), o = (y * LADO + xx) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        await fetch('/api/captura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: op.guardar, datos: c2.toDataURL('image/png') }) });
      }
      const vis = new Uint8Array(m.length);
      let chicos = 0, enChicos = 0;
      for (let k = 0; k < m.length; k++) {
        if (!m[k] || vis[k]) continue;
        let area = 0; const pila = [k]; vis[k] = 1;
        while (pila.length) {
          const q = pila.pop(); area++;
          const qx = q % LADO, qy = (q / LADO) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = qx + dx, yy = qy + dy;
            if (xx < 0 || yy < 0 || xx >= LADO || yy >= LADO) continue;
            const qq = yy * LADO + xx;
            if (m[qq] && !vis[qq]) { vis[qq] = 1; pila.push(qq); }
          }
        }
        if (area <= 6) { chicos++; enChicos += area; }
      }
      // La verdad de campo, sobre el DEM: para una grilla de 128 × 128 píxeles, el punto
      // del suelo que ve cada uno (marchando el rayo de la cámara hasta el terreno), su
      // normal, y si el sol lo alcanza (marchando hacia el sol 3 km sobre el DEM). Una
      // cara que mira al sol (N·L > 0,15) y que nada tapa no puede oscurecerse con la
      // sombra prendida: si se oscurece, es acné. Y una que el relieve tapa a menos de
      // 150 m tiene que oscurecerse (más lejos puede quedar fuera de las cascadas).
      const sol = S.cielo.direccionSol.clone().normalize();
      const V3 = () => cam.position.clone();
      const pisoEn = (px, pz) => M.alturaEn(px, pz);
      let lucesSanas = 0, acne = 0, sombrasCerca = 0, sombrasVistas = 0, rasantes = 0, acneRasante = 0;
      const PASO = LADO / 128;
      for (let jj = 0; jj < 128; jj++) {
        for (let ii = 0; ii < 128; ii++) {
          const i = Math.floor(ii * PASO + PASO / 2), j = Math.floor(jj * PASO + PASO / 2);
          const ndc = V3().set((i + 0.5) / LADO * 2 - 1, (j + 0.5) / LADO * 2 - 1, 0.5).unproject(cam);
          const dir = ndc.sub(cam.position).normalize();
          let t = 0, p = null;
          for (let s = 0; s < 4000; s++) {
            t += 0.25;
            const q = cam.position.clone().addScaledVector(dir, t);
            if (q.y <= pisoEn(q.x, q.z)) { p = q; break; }
          }
          if (!p) continue;
          const e = 1.5;
          const nx = -(pisoEn(p.x + e, p.z) - pisoEn(p.x - e, p.z)) / (2 * e);
          const nz = -(pisoEn(p.x, p.z + e) - pisoEn(p.x, p.z - e)) / (2 * e);
          const nl = (nx * sol.x + sol.y + nz * sol.z) / Math.hypot(nx, 1, nz);
          if (nl < 0.03) continue;
          let tapado = Infinity;
          for (let d = 2; d < 3000; d += d < 200 ? 1 : 4) {
            const qx = p.x + sol.x * d, qy = p.y + 0.3 + sol.y * d, qz = p.z + sol.z * d;
            if (pisoEn(qx, qz) > qy) { tapado = d; break; }
          }
          const k = j * LADO + i;
          const oscurece = sin[k] - con[k] > 6;
          // Rasante (N·L entre 0,03 y 0,15) va aparte: es donde el acné aparece primero
          if (tapado === Infinity) {
            if (nl < 0.15) { rasantes++; if (oscurece) acneRasante++; } else { lucesSanas++; if (oscurece) acne++; }
          } else if (tapado < 150) { sombrasCerca++; if (oscurece) sombrasVistas++; }
        }
      }
      return {
        fecha, alturaSol: +(S.cielo.alturaSol * 180 / Math.PI).toFixed(1), oscurecidos: +(n / m.length).toFixed(4),
        puntitosPorMil: +(chicos / (m.length / 1000)).toFixed(2), fraccionEnPuntitos: n ? +(enChicos / n).toFixed(3) : 0,
        // Lo que dice el DEM
        alSol: lucesSanas, acne: lucesSanas ? +(acne / lucesSanas).toFixed(4) : null,
        rasantes, acneRasante: rasantes ? +(acneRasante / rasantes).toFixed(4) : null,
        tapadasCerca: sombrasCerca, sombraVista: sombrasCerca ? +(sombrasVistas / sombrasCerca).toFixed(3) : null,
      };
    } finally {
      S.jugador.posicion.copy(j0);
      t.castShadow = cast0;
      grupos.forEach((q, i) => { q.visible = gvis0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1]; T.fecha = f0;
      cam.up.copy(c0.up); cam.position.copy(c0.p); cam.quaternion.copy(c0.q); cam.updateMatrixWorld(true);
      S.calidad.aplicar?.(); S.terreno.actualizar(cam);
    }
  };

  window.medirSombra = async function medirSombra(op = {}) {
    const S = window.SurviBar;
    const r = S.render, gl = r.getContext(), cam = S.camara, V = S.vegetacion, M = S.mundo, T = S.tiempo;
    const sem0 = [T._semillaA, T._semillaB], f0 = new Date(T.fecha.getTime());
    const grupos = S.escena.children.filter((c) => AL_AZAR.includes(c.name));
    const gvis0 = grupos.map((g) => g.visible);
    const c0 = { p: cam.position.clone(), q: cam.quaternion.clone(), up: cam.up.clone() };
    const id = op.especie || 'coihue';
    const l = V.lotes.find((x) => x.esp.id === id);
    const res = {};
    let plano = null;
    const j0 = S.jugador.posicion.clone();
    try {
      T._semillaA = SEMILLAS[0]; T._semillaB = SEMILLAS[1];
      // Siempre junto al arranque (el árbol «más cercano» dependía de dónde había
      // quedado el jugador, y medirAcne lo lleva a las laderas)
      const cerca = op.cerca || { x: 7634, z: -1447 };
      const gc = M.aLatLon(cerca.x, cerca.z);
      await window.capturar('r8-sombra-preparar', { lat: gc.lat, lon: gc.lon, altura: 1.7, fecha: FECHA, ancho: LADO, alto: LADO, conFauna: false });
      grupos.forEach((g) => { g.visible = false; });
      // El árbol más cercano al jugador, de la especie
      V.actualizar(S.jugador.posicion, T.segundosTotales, T.estado(), cam);
      const a = l.malla.instanceMatrix.array, p = S.jugador.posicion;
      let k0 = -1, dm = 1e9;
      for (let i = 0; i < l.malla.count; i++) { const d = Math.hypot(a[i * 16 + 12] - p.x, a[i * 16 + 14] - p.z); if (d < dm) { dm = d; k0 = i; } }
      const tx = a[k0 * 16 + 12], tz = a[k0 * 16 + 14], ty = M.alturaEn(tx, tz);
      // Hacia donde cae la sombra: contra el sol, en el plano
      const sol = S.cielo.direccionSol.clone();
      const h = Math.hypot(sol.x, sol.z) || 1;
      const cx = tx - (sol.x / h) * 8, cz = tz - (sol.z / h) * 8;
      r.setPixelRatio(1); r.setSize(LADO, LADO, false);
      cam.aspect = 1; cam.updateProjectionMatrix();
      cam.up.set(0, 0, -1);
      cam.position.set(cx, M.alturaEn(cx, cz) + 30, cz);
      cam.lookAt(cx, M.alturaEn(cx, cz), cz);
      cam.updateMatrixWorld(true);
      S.csm.update();
      const otros = V.lotes.filter((x) => x !== l).map((x) => [x, x.malla.visible, x.impostor?.malla.visible]);
      otros.forEach(([x]) => { x.malla.visible = false; if (x.impostor) x.impostor.malla.visible = false; });
      const mat = l.malla.material, cw = mat.colorWrite, dw = mat.depthWrite, sombra0 = l.malla.castShadow;
      const leer = () => {
        S.terreno.actualizar(cam);
        r.setRenderTarget(null); r.render(S.escena, cam);
        const px = new Uint8Array(LADO * LADO * 4);
        gl.readPixels(0, 0, LADO, LADO, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      };
      const medir = (etiqueta) => {
        l.malla.castShadow = true; const con = leer();
        l.malla.castShadow = false; const sin = leer();
        let n = 0, suma = 0;
        for (let q = 0; q < con.length; q += 4) {
          const lc = 0.2126 * con[q] + 0.7152 * con[q + 1] + 0.0722 * con[q + 2];
          const ls = 0.2126 * sin[q] + 0.7152 * sin[q + 1] + 0.0722 * sin[q + 2];
          if (ls - lc > 6) { n++; suma += ls - lc; }
        }
        res[etiqueta] = { pixelesMasOscuros: n, fraccion: +(n / (LADO * LADO)).toFixed(4), oscurecimientoMedio: n ? +(suma / n).toFixed(1) : 0 };
      };
      try {
        mat.colorWrite = false; mat.depthWrite = false;
        medir('terreno');
        // Control: un plano de three sobre el suelo, justo arriba del terreno
        const THREE = await import('three');
        plano = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x808070, roughness: 0.9 }));
        S.csm.setupMaterial?.(plano.material);
        plano.position.set(cx, M.alturaEn(cx, cz) + 0.6, cz);
        plano.receiveShadow = true;
        S.escena.add(plano);
        medir('planoDeControl');
      } finally {
        mat.colorWrite = cw; mat.depthWrite = dw; l.malla.castShadow = sombra0;
        otros.forEach(([x, vm, vi]) => { x.malla.visible = vm; if (x.impostor) x.impostor.malla.visible = vi; });
        if (plano) { S.escena.remove(plano); plano.geometry.dispose(); plano.material.dispose(); }
      }
      res.arbol = { especie: id, x: Math.round(tx), z: Math.round(tz), alturaM: +(l.esp.alturaMaxM || 0).toFixed(1) };
    } finally {
      S.jugador.posicion.copy(j0);
      grupos.forEach((g, i) => { g.visible = gvis0[i]; });
      T._semillaA = sem0[0]; T._semillaB = sem0[1]; T.fecha = f0;
      cam.up.copy(c0.up); cam.position.copy(c0.p); cam.quaternion.copy(c0.q); cam.updateMatrixWorld(true);
      S.calidad.aplicar?.(); S.terreno.actualizar(cam);
    }
    return res;
  };
})();
