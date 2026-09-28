/**
 * Ronda 8 · fase 3 · ¿de dónde sale el brillo de más del bosque?
 *
 * Con las semillas fijas el suelo del bosque mirando abajo sale +13 % contra la base
 * (+20 % con la luz corregida en las dos), y la estepa y el pedregal no. Este
 * instrumento cambia sólo VALORES de los uniformes del suelo —texturas de capas del
 * mismo tipo, que no recompilan (T2b)— para separar las tres cosas que cambian:
 *
 *   plano      albedo y normal planos, módulo = 1 exacto: sólo queda que el ruido
 *              viejo (micro, gravilla, f2, f3) ya no corre donde manda la textura.
 *   sinNormal  el albedo de verdad con la normal aplanada (RG = 0,5; B y A se quedan):
 *              el efecto del color horneado.
 *   sinColor   la normal de verdad con el albedo reemplazado por 1 / (oclusión ×
 *              norma), texel por texel: módulo = 1, sólo el efecto de la normal.
 *   real       lo que carga el juego.
 *   listo0     uSueloListo = 0: tiene que dar la base exacta.
 *
 * Uso: await import('/.claude/flota/r8-suelo-aislar.navegador.js');
 *      await window.aislarSuelo('plano')   // y después bancoR8F3({ soloCapturas: true, prefijo })
 *      await window.aislarSuelo('real')    // deja todo como estaba
 */
(() => {
  const srgb = (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let guardado = null;

  function copia(real, datos, lado, prof) {
    const t = new real.constructor(datos, lado, lado, prof);
    for (const k of ['format', 'type', 'colorSpace', 'wrapS', 'wrapT', 'generateMipmaps', 'minFilter', 'magFilter']) t[k] = real[k];
    t.needsUpdate = true;
    return t;
  }

  window.aislarSuelo = async function aislarSuelo(modo) {
    const S = window.SurviBar, u = S.terreno.uniformes;
    if (!guardado) {
      guardado = {
        albedo: u.uSueloAlbedo.value, normal: u.uSueloNormal.value, listo: u.uSueloListo.value,
        norma: u.uSueloNorma.value.map((v) => v.clone()), luz: u.uSueloLuz.value.map((v) => v.clone()),
      };
    }
    const g = guardado;
    const restaurar = () => {
      u.uSueloAlbedo.value = g.albedo; u.uSueloNormal.value = g.normal; u.uSueloListo.value = g.listo;
      g.norma.forEach((v, i) => u.uSueloNorma.value[i].copy(v));
      g.luz.forEach((v, i) => u.uSueloLuz.value[i].copy(v));
    };
    restaurar();
    if (modo === 'real') return { modo };
    if (modo === 'listo0') { u.uSueloListo.value = 0; return { modo }; }
    const lado = g.albedo.image.width, prof = g.albedo.image.depth, n = lado * lado;
    const A = g.albedo.image.data, N = g.normal.image.data;
    const lumaPlana = () => u.uSueloLuz.value.forEach((v) => v.set(0.2126, 0.7152, 0.0722));
    if (modo === 'plano') {
      const a = new Uint8Array(A.length), b = new Uint8Array(N.length);
      for (let k = 0; k < A.length; k += 4) { a[k] = a[k + 1] = a[k + 2] = 128; a[k + 3] = 128; b[k] = b[k + 1] = 128; b[k + 2] = 255; b[k + 3] = 240; }
      u.uSueloAlbedo.value = copia(g.albedo, a, lado, prof);
      u.uSueloNormal.value = copia(g.normal, b, lado, prof);
      u.uSueloNorma.value.forEach((v) => v.setScalar(1 / lin(128)));
      lumaPlana();
      return { modo };
    }
    if (modo === 'sinNormal') {
      const b = new Uint8Array(N);
      for (let k = 0; k < b.length; k += 4) { b[k] = b[k + 1] = 128; }
      u.uSueloNormal.value = copia(g.normal, b, lado, prof);
      return { modo };
    }
    if (modo === 'sinColor') {
      const a = new Uint8Array(A);
      for (let c = 0; c < prof; c++) {
        const nm = g.norma[c];
        for (let t = 0; t < n; t++) {
          const k = (c * n + t) * 4;
          const occ = Math.max(N[k + 2] / 255, 1e-3);
          a[k] = Math.round(255 * srgb(Math.min(1, 1 / (occ * nm.x))));
          a[k + 1] = Math.round(255 * srgb(Math.min(1, 1 / (occ * nm.y))));
          a[k + 2] = Math.round(255 * srgb(Math.min(1, 1 / (occ * nm.z))));
        }
      }
      u.uSueloAlbedo.value = copia(g.albedo, a, lado, prof);
      lumaPlana();
      return { modo };
    }
    throw new Error(`modo desconocido: ${modo}`);
  };
})();
