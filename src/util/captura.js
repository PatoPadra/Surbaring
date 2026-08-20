/**
 * Utilidad de desarrollo: coloca la cámara en un punto del parque, adelanta el
 * reloj a una hora concreta, dibuja un cuadro y guarda la imagen en disco.
 *
 * Sirve para revisar el aspecto del juego sin depender de que el panel del
 * navegador esté componiendo cuadros.
 */

import * as THREE from 'three';

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

    // El panel del navegador puede estar oculto, y entonces innerWidth da 0 y
    // el lienzo queda en 0x0: la captura sale vacía y las mediciones de tiempo
    // no significan nada. La captura fija su propio tamaño siempre.
    const ancho = o.ancho ?? 1280, alto = o.alto ?? 720;
    const canvas = render.domElement;
    if (canvas.width !== ancho || canvas.height !== alto) {
      render.setPixelRatio(1);
      render.setSize(ancho, alto, false);
      compositor.setPixelRatio(1);
      compositor.setSize(ancho, alto);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      csm.updateFrustums();
    }

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

    // Eventos naturales: se puede forzar uno para poder mirarlo. Sin esto, una
    // captura de tormenta dependería de que el dado quisiera.
    if (o.evento && S.eventos) {
      S.eventos.activos.length = 0;
      S.eventos.disparar(o.evento, o.horasEvento ?? 6);
      const ev = S.eventos.activos[0];
      if (ev) {
        // Al medio del evento, que es donde está a plena intensidad
        const medio = ev.desde + (ev.hasta - ev.desde) / 2;
        const guardo = tiempo.fecha;
        tiempo.fecha = new Date(medio);
        if (ev.x != null) {
          // El evento local va DELANTE de la cámara, no hacia el este: el rumbo
          // del jugador y el eje x del mundo no son lo mismo, y poner el humo
          // en +x hacía capturas sin humo que parecían un fallo de dibujo.
          const dir = new THREE.Vector3();
          camara.getWorldDirection(dir);
          const d = o.distanciaEvento ?? 700;
          ev.x = camara.position.x + dir.x * d;
          ev.z = camara.position.z + dir.z * d;
        }
        S.eventos.aplicar(est);
        tiempo.fecha = guardo;
      }
    } else if (S.eventos) {
      S.eventos.aplicar(est);
    }
    // Forzados sueltos, para revisar la precipitación sin depender del clima
    for (const k of ['lluvia', 'nieve', 'granizo', 'ceniza', 'rayos', 'vientoKmh']) {
      if (o[k] !== undefined) est[k] = o[k];
    }

    cielo.actualizar(tiempo.fecha, mundo.meta.centro.lat, mundo.meta.centro.lon, tiempo.segundosTotales);
    cielo.configurarAtmosfera({ nubes: est.nubosidad, turbiedad: est.turbiedad, ceniza: est.ceniza });

    cielo.colorNiebla(escena.fog.color);
    escena.fog.density = est.densidadNiebla;
    render.toneMappingExposure = est.exposicion * (1 + (S.clima?.destello ?? 0) * 1.6);

    terreno.aplicarEstacion({
      estacion: est.estacionContinua, cotaNieve: est.cotaNieve,
      ceniza: est.ceniza, humedad: est.humedadSuelo,
    });

    vegetacion.uniformesImpostor.uNiebla.value.copy(escena.fog.color);
    vegetacion.uniformesImpostor.uDensidadNiebla.value = escena.fog.density;
    vegetacion.actualizar(jugador.posicion, tiempo.segundosTotales, est, camara);
    // En una captura no se puede esperar a que el sembrado se reparta entre
    // cuadros: hace falta el sotobosque completo ya mismo.
    S.sotobosque?.actualizar(jugador.posicion, tiempo.segundosTotales, est);
    S.sotobosque?.sembrarTodo(jugador.posicion);
    if (o.conFauna !== false) {
      for (let k = 0; k < 16; k++) fauna.actualizar(0.5, jugador, est, tiempo.segundosTotales + k * 2);
    }
    terreno.actualizar(camara);
    agua.actualizar(tiempo.segundosTotales, camara, est, escena);

    // Precipitación, humo y rayos: la parte del clima que se ve caer
    S.clima?.actualizar(o.dtClima ?? 0.6, est, camara);
    if (o.rayo) S.clima.destello = 1;

    csm.lightDirection.copy(cielo.direccionSol).negate().normalize();
    for (const luz of csm.lights) {
      luz.color.copy(cielo.luzSol.color);
      luz.intensity = cielo.luzSol.intensity * 0.92 + (S.clima?.destello ?? 0) * 6.0;
    }
    cielo.luzSol.intensity = 0;
    csm.update();
    cielo.malla.position.copy(camara.position);

    // Cómo se leen los píxeles, y por qué así:
    //
    // Leer el lienzo con toDataURL no sirve si el panel del navegador está
    // oculto: el framebuffer por defecto no se compone y salen desgarros
    // horizontales. Y los objetivos del compositor son multimuestreados, así
    // que readRenderTargetPixels devuelve cero sobre ellos sin resolver antes.
    //
    // Se dibuja entonces a un objetivo propio de una sola muestra. El precio es
    // que la captura no lleva bloom ni antialias del compositor; a cambio es
    // una ruta que no depende de que haya nada en pantalla.
    if (!window.__objetivoCaptura || window.__objetivoCaptura.width !== ancho) {
      window.__objetivoCaptura?.dispose();
      window.__objetivoCaptura = new THREE.WebGLRenderTarget(ancho, alto, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.SRGBColorSpace,
        samples: 0,
      });
    }
    const objetivo = window.__objetivoCaptura;

    render.info.autoReset = false;
    render.info.reset();
    const previo = render.getRenderTarget();
    render.setRenderTarget(objetivo);
    render.clear();
    render.render(escena, camara);
    render.setRenderTarget(previo);

    const pixeles = new Uint8Array(ancho * alto * 4);
    render.readRenderTargetPixels(objetivo, 0, 0, ancho, alto, pixeles);

    // El origen de OpenGL está abajo: hay que dar vuelta las filas
    const lienzo2d = document.createElement('canvas');
    lienzo2d.width = ancho; lienzo2d.height = alto;
    const ctx = lienzo2d.getContext('2d');
    const imagen = ctx.createImageData(ancho, alto);
    for (let y = 0; y < alto; y++) {
      const origen = (alto - 1 - y) * ancho * 4;
      imagen.data.set(pixeles.subarray(origen, origen + ancho * 4), y * ancho * 4);
    }
    ctx.putImageData(imagen, 0, 0);

    const datos = lienzo2d.toDataURL('image/png');
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
