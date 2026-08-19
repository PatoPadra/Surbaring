/**
 * Utilidad de desarrollo: coloca la cámara en un punto del parque, adelanta el
 * reloj a una hora concreta, dibuja un cuadro y guarda la imagen en disco.
 *
 * Sirve para revisar el aspecto del juego sin depender de que el panel del
 * navegador esté componiendo cuadros.
 */

const ENTRADA_NULA = {
  ratonDX: 0, ratonDY: 0, sensibilidad: 1,
  adelante: 0, lateral: 0, saltar: false, correr: false, agachar: false,
  consumirRaton() {},
};

export function instalarCapturas(S) {
  /**
   * @param {string} nombre archivo de salida
   * @param {object} o {lat, lon, altura, rumbo, cabeceo, fecha, pasos}
   */
  window.capturar = async function capturar(nombre, o = {}) {
    const { jugador, mundo, tiempo, cielo, terreno, agua, vegetacion, fauna, camara, csm, compositor, render, escena } = S;

    if (o.fecha) tiempo.fecha = new Date(o.fecha);

    if (o.lat !== undefined && o.lon !== undefined) {
      const { x, z } = mundo.aMundo(o.lat, o.lon);
      jugador.posicion.set(x, mundo.alturaEn(x, z) + (o.altura ?? 1.8), z);
      jugador.velocidad.set(0, 0, 0);
    }
    if (o.rumbo !== undefined) jugador.giro = o.rumbo * Math.PI / 180;
    if (o.cabeceo !== undefined) jugador.cabeceo = o.cabeceo * Math.PI / 180;
    jugador.tercerPersona = !!o.tercerPersona;

    // Asentar la física y dejar que la vegetación y la fauna se repueblen
    const pasos = o.pasos ?? 90;
    for (let k = 0; k < pasos; k++) jugador.actualizar(1 / 60, ENTRADA_NULA);
    if (o.cabeceo !== undefined) jugador.cabeceo = o.cabeceo * Math.PI / 180;
    jugador.actualizar(1 / 60, ENTRADA_NULA);

    const est = tiempo.estado();

    cielo.actualizar(tiempo.fecha, mundo.meta.centro.lat, mundo.meta.centro.lon, tiempo.segundosTotales);
    cielo.configurarAtmosfera({ nubes: est.nubosidad, turbiedad: est.turbiedad, ceniza: est.ceniza });

    cielo.colorNiebla(escena.fog.color);
    escena.fog.density = est.densidadNiebla;
    render.toneMappingExposure = est.exposicion;

    terreno.aplicarEstacion({
      estacion: est.estacionContinua, cotaNieve: est.cotaNieve,
      ceniza: est.ceniza, humedad: est.humedadSuelo,
    });

    vegetacion.uniformesImpostor.uNiebla.value.copy(escena.fog.color);
    vegetacion.uniformesImpostor.uDensidadNiebla.value = escena.fog.density;
    vegetacion.actualizar(jugador.posicion, tiempo.segundosTotales, est);
    // En una captura no se puede esperar a que el sembrado se reparta entre
    // cuadros: hace falta el sotobosque completo ya mismo.
    S.sotobosque?.actualizar(jugador.posicion, tiempo.segundosTotales, est);
    S.sotobosque?.sembrarTodo(jugador.posicion);
    if (o.conFauna !== false) {
      for (let k = 0; k < 16; k++) fauna.actualizar(0.5, jugador, est, tiempo.segundosTotales + k * 2);
    }
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

    render.info.autoReset = false;
    render.info.reset();
    compositor.render();

    const datos = render.domElement.toDataURL('image/png');
    const resp = await fetch('/api/captura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, datos }),
    });
    const r = await resp.json();

    const inf = jugador.informe();
    return {
      ...r,
      lat: +inf.lat.toFixed(4), lon: +inf.lon.toFixed(4),
      altitud: +inf.altitud.toFixed(0),
      hora: tiempo.textoHora, fecha: tiempo.textoFecha, estacion: est.nombreEstacion,
      alturaSol: +(cielo.alturaSol * 180 / Math.PI).toFixed(1),
      drawCalls: render.info.render.calls,
      triangulos: render.info.render.triangles,
      nodos: terreno.nodosDibujados,
      plantas: vegetacion.totalInstancias,
      sotobosque: S.sotobosque?.total ?? 0,
      animales: fauna.vivos.length,
    };
  };
}
