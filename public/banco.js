/**
 * Banco de pruebas de cuadro. Temporal, se borra al terminar.
 *
 * POR QUÉ ASÍ Y NO CON performance.now():
 *
 * El primer intento midió con el reloj de la CPU y un `gl.finish()` para forzar
 * la sincronización, y dio 374 fps en una Intel HD 4000 dibujando 1,8 millones
 * de triángulos. La prueba de validez lo desmintió sin lugar a dudas: al subir
 * la resolución de 640×360 a 2560×1440 —dieciséis veces más píxeles— el tiempo
 * medido BAJÓ de 2,64 a 2,08 ms. Con el panel del navegador oculto `finish()`
 * no bloquea, así que se estaba midiendo el encolado de llamadas y no el trabajo
 * de la placa.
 *
 * Acá se usa `EXT_disjoint_timer_query_webgl2`, que es el reloj de la GPU misma:
 * mide el tiempo transcurrido entre dos marcas dentro del propio flujo de
 * comandos, y no le importa si alguien está mirando el lienzo. Se descarta la
 * muestra si el driver levanta la bandera `GPU_DISJOINT`, que avisa que hubo un
 * cambio de contexto y el número no vale.
 *
 * La validez se puede volver a comprobar en cualquier momento con
 * `window.bancoValidez()`: el tiempo TIENE que crecer con los píxeles.
 */

(() => {
function medidor(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  return {
    async medir(dibujar, cuadros, calentar = 6) {
      for (let k = 0; k < calentar; k++) dibujar();

      // Todas las consultas en vuelo primero, y se cobran juntas al final.
      //
      // La versión anterior esperaba cada consulta antes de lanzar la
      // siguiente, y en una pestaña oculta el navegador limita setTimeout a un
      // segundo: veinte cuadros tardaban más de un minuto y parecía colgado.
      // Encolarlas todas es además más fiel, porque así se mide la GPU
      // trabajando seguido y no arrancando y frenando.
      const consultas = [];
      for (let k = 0; k < cuadros; k++) {
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        dibujar();
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        consultas.push(q);
      }
      gl.flush();

      const muestras = [];
      for (const q of consultas) {
        for (let intento = 0; intento < 40; intento++) {
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
          await new Promise(r => setTimeout(r, 0));
        }
        const disjunto = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !disjunto) {
          muestras.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);  // ns → ms
        }
        gl.deleteQuery(q);
      }
      return muestras;
    },
  };
}

/** Coloca la escena en un punto y la deja lista para dibujar. */
function asentar(S, p, fecha) {
  const { jugador, mundo, tiempo, cielo, escena, terreno, agua, vegetacion,
          camara, csm, calidad } = S;
  const { x, z } = mundo.aMundo(p.lat, p.lon);
  jugador.posicion.set(x, mundo.superficieEn(x, z) + p.altura, z);
  jugador.velocidad.set(0, 0, 0);
  jugador.giro = p.rumbo * Math.PI / 180;
  jugador.cabeceo = p.cabeceo * Math.PI / 180;
  jugador.tercerPersona = false;
  tiempo.fecha = new Date(fecha);

  const ENT = { ratonDX: 0, ratonDY: 0, sensibilidad: 1, adelante: 0, lateral: 0,
    saltar: false, correr: false, agachar: false, consumirRaton() {} };
  for (let k = 0; k < 60; k++) jugador.actualizar(1 / 60, ENT);

  const est = tiempo.estado();
  cielo.actualizar(tiempo.fecha, mundo.meta.centro.lat, mundo.meta.centro.lon, tiempo.segundosTotales);
  cielo.configurarAtmosfera({ nubes: est.nubosidad, turbiedad: est.turbiedad, ceniza: est.ceniza });
  cielo.colorNiebla(escena.fog.color);
  escena.fog.density = est.densidadNiebla;
  terreno.aplicarEstacion({ estacion: est.estacionContinua, cotaNieve: est.cotaNieve,
    ceniza: est.ceniza, humedad: est.humedadSuelo });
  vegetacion.uniformesImpostor.uNiebla.value.copy(escena.fog.color);
  vegetacion.uniformesImpostor.uDensidadNiebla.value = escena.fog.density;
  vegetacion.actualizar(jugador.posicion, tiempo.segundosTotales, est, camara);
  S.sotobosque?.actualizar(jugador.posicion, tiempo.segundosTotales, est);
  S.sotobosque?.sembrarTodo(jugador.posicion);
  terreno.actualizar(camara);
  agua.actualizar(tiempo.segundosTotales, camara, est, escena);
  csm.lightDirection.copy(cielo.direccionSol).negate().normalize();
  for (const luz of csm.lights) {
    luz.color.copy(cielo.luzSol.color);
    luz.intensity = cielo.luzSol.intensity * 0.92;
  }
  cielo.luzSol.intensity = 0;
  csm.update();
  cielo.malla.position.copy(camara.position);
  calidad.recortarInstancias();
}

function fijarTamano(S, ancho, alto) {
  const { render, compositor, camara, csm, calidad } = S;
  render.setPixelRatio(1);
  render.setSize(ancho, alto, false);
  compositor.setPixelRatio(1);
  compositor.setSize(ancho, alto);
  S.oclusion?.setSize(ancho, alto);
  calidad.ctx?.suavizado?.material?.uniforms?.resolution?.value.set(1 / ancho, 1 / alto);
  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();
  csm.updateFrustums();
}

const PUNTOS = [
  { id: 'bosque', lat: -41.0870, lon: -71.4290, altura: 2, rumbo: 20, cabeceo: -4 },
  { id: 'orilla', lat: -41.0738, lon: -71.4290, altura: 2.5, rumbo: 0, cabeceo: -2 },
  { id: 'altura', lat: -41.1500, lon: -71.3700, altura: 6, rumbo: 300, cabeceo: -12 },
];

window.banco = async function banco(o = {}) {
  const S = window.SurviBar;
  const { render, compositor, escena, camara, agua, terreno, vegetacion, calidad } = S;
  const gl = render.getContext();
  const m = medidor(gl);
  if (!m) return { error: 'sin EXT_disjoint_timer_query_webgl2: no hay reloj de GPU' };

  const ancho = o.ancho ?? 1280, alto = o.alto ?? 720;
  const cuadros = o.cuadros ?? 24;
  const puntos = o.puntos ?? PUNTOS;
  const resultados = [];

  for (const p of puntos) {
    asentar(S, p, o.fecha ?? '2024-02-15T11:00:00');
    fijarTamano(S, ancho, alto);
    const alPrincipio = compositor.renderToScreen;
    compositor.renderToScreen = false;
    render.info.autoReset = false;
    render.info.reset();

    const dibujar = () => { agua.dibujarReflejo(render, escena, camara); compositor.render(); };
    const muestras = await m.medir(dibujar, cuadros);
    compositor.renderToScreen = alPrincipio;

    if (!muestras.length) { resultados.push({ punto: p.id, error: 'todas las muestras disjuntas' }); continue; }
    muestras.sort((a, b) => a - b);
    const media = muestras.reduce((a, b) => a + b, 0) / muestras.length;
    const inf = render.info;
    resultados.push({
      punto: p.id,
      msGPU: +media.toFixed(2),
      mediana: +muestras[Math.floor(muestras.length / 2)].toFixed(2),
      peor: +muestras[muestras.length - 1].toFixed(2),
      fps: +(1000 / media).toFixed(1),
      muestrasValidas: muestras.length,
      llamadas: Math.round(inf.render.calls / (cuadros + 6)),
      kTriangulos: Math.round(inf.render.triangles / (cuadros + 6) / 1000),
      nodosTerreno: terreno.nodosDibujados,
      plantas: vegetacion.totalInstancias,
      sotobosque: S.sotobosque?.total ?? 0,
    });
    render.info.autoReset = true;
  }

  calidad.aplicar();
  const validos = resultados.filter(r => r.msGPU);
  const total = validos.reduce((a, r) => a + r.msGPU, 0) / (validos.length || 1);
  return {
    placa: calidad.placa.replace(/^ANGLE \(|\)$/g, '').slice(0, 58),
    preset: calidad.preset.nombre,
    resolucion: `${ancho}x${alto}`,
    msPromedio: +total.toFixed(2),
    fpsPromedio: +(1000 / total).toFixed(1),
    puntos: resultados,
  };
};

/**
 * Prueba de validez del instrumento: el tiempo TIENE que crecer con los píxeles.
 * Si no crece, el número no sirve para nada y hay que arreglar el banco antes de
 * sacar una sola conclusión.
 */
window.bancoValidez = async function bancoValidez() {
  const salida = [];
  for (const [w, h] of [[640, 360], [1280, 720], [1920, 1080], [2560, 1440]]) {
    const r = await window.banco({ ancho: w, alto: h, cuadros: 14, puntos: [PUNTOS[0]] });
    salida.push({ res: `${w}x${h}`, Mpx: +(w * h / 1e6).toFixed(2), msGPU: r.puntos[0].msGPU });
  }
  const creciente = salida.every((x, i) => i === 0 || x.msGPU >= salida[i - 1].msGPU * 0.95);
  return { creciente, veredicto: creciente ? 'el instrumento mide' : 'EL INSTRUMENTO MIENTE', salida };
};

/**
 * Desglose del costo del cuadro: apaga una pieza por vez y mide qué se ahorra.
 *
 * Es la medición que decide todo lo demás. La recta ajustada sobre la prueba de
 * validez da ~62 ms fijos más ~84 ms por megapíxel: la mitad del cuadro no
 * depende de la resolución, y esa mitad no se arregla dibujando más chico.
 * Antes de tocar nada hay que saber de quién es cada milisegundo.
 */
window.bancoDesglose = async function bancoDesglose(o = {}) {
  const S = window.SurviBar;
  const { render, compositor, escena, camara, agua, vegetacion, calidad } = S;
  const gl = render.getContext();
  const m = medidor(gl);
  if (!m) return { error: 'sin reloj de GPU' };

  const ancho = o.ancho ?? 1024, alto = o.alto ?? 576;
  const cuadros = o.cuadros ?? 10;
  asentar(S, o.punto ?? PUNTOS[0], o.fecha ?? '2024-02-15T11:00:00');
  fijarTamano(S, ancho, alto);

  const alPrincipio = compositor.renderToScreen;
  compositor.renderToScreen = false;

  const dibujar = () => { agua.dibujarReflejo(render, escena, camara); compositor.render(); };
  const medirAhora = async () => {
    const s = await m.medir(dibujar, cuadros, 4);
    if (!s.length) return null;
    s.sort((a, b) => a - b);
    return +(s[Math.floor(s.length / 2)]).toFixed(1);
  };

  const guardar = {
    sombras: render.shadowMap.enabled,
    agua: S.agua.mallas.map(x => x.visible),
    veg: vegetacion.lotes.map(l => [l.malla.count, l.impostor?.malla.count ?? 0]),
    soto: S.sotobosque.lotes.map(l => l.malla.count),
    terreno: S.terreno.malla.visible,
    oclusion: S.oclusion.enabled,
    color: S.color.enabled,
    fauna: S.fauna.grupo.visible,
    cielo: S.cielo.malla.visible,
  };

  const salida = { resolucion: `${ancho}x${alto}`, punto: (o.punto ?? PUNTOS[0]).id };
  salida.completo = await medirAhora();

  const prueba = async (nombre, apagar, prender) => {
    apagar();
    salida[nombre] = await medirAhora();
    prender();
  };

  await prueba('sinSombras',
    () => { render.shadowMap.enabled = false; },
    () => { render.shadowMap.enabled = guardar.sombras; });
  await prueba('sinReflejo',
    () => { S._reflejoGuardado = agua.reflejo; agua.reflejo = null; },
    () => { agua.reflejo = S._reflejoGuardado; });
  await prueba('sinAgua',
    () => { for (const x of agua.mallas) x.visible = false; },
    () => { agua.mallas.forEach((x, i) => { x.visible = guardar.agua[i]; }); });
  await prueba('sinArboles',
    () => { for (const l of vegetacion.lotes) { l.malla.count = 0; if (l.impostor) l.impostor.malla.count = 0; } },
    () => { vegetacion.lotes.forEach((l, i) => { l.malla.count = guardar.veg[i][0]; if (l.impostor) l.impostor.malla.count = guardar.veg[i][1]; }); });
  await prueba('sinSotobosque',
    () => { for (const l of S.sotobosque.lotes) l.malla.count = 0; },
    () => { S.sotobosque.lotes.forEach((l, i) => { l.malla.count = guardar.soto[i]; }); });
  await prueba('sinTerreno',
    () => { S.terreno.malla.visible = false; },
    () => { S.terreno.malla.visible = guardar.terreno; });
  await prueba('sinFauna',
    () => { S.fauna.grupo.visible = false; },
    () => { S.fauna.grupo.visible = guardar.fauna; });
  await prueba('sinCielo',
    () => { S.cielo.malla.visible = false; },
    () => { S.cielo.malla.visible = guardar.cielo; });
  await prueba('sinPosproceso',
    () => { S.oclusion.enabled = false; S.color.enabled = false; },
    () => { S.oclusion.enabled = guardar.oclusion; S.color.enabled = guardar.color; });

  compositor.renderToScreen = alPrincipio;
  calidad.aplicar();

  // Lo que cuesta cada pieza es lo que se ahorra al sacarla
  const cuesta = {};
  for (const k of Object.keys(salida)) {
    if (k.startsWith('sin') && salida[k] != null) {
      cuesta[k.replace('sin', '')] = +(salida.completo - salida[k]).toFixed(1);
    }
  }
  return { ...salida, cuestaCadaPieza: cuesta };
};
})();
