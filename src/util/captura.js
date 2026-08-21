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
      // Y el suavizado, que trabaja en texels. Sin esto la captura sale con un
      // halo alrededor de cada copa —el FXAA muestreando a 1024×576 sobre un
      // búfer de 1280×720— y uno termina buscando en el juego un defecto que
      // sólo existe en la foto. La herramienta de verificación no puede mentir.
      S.calidad?.ctx?.suavizado?.material?.uniforms?.resolution?.value
        .set(1 / ancho, 1 / alto);
    }

    if (o.fecha) tiempo.fecha = new Date(o.fecha);

    if (o.lat !== undefined && o.lon !== undefined) {
      const { x, z } = mundo.aMundo(o.lat, o.lon);
      // Sobre un lago la referencia es la superficie, no el fondo: si no, una
      // captura pedida a dos metros salía desde treinta metros bajo el agua.
      jugador.posicion.set(x, mundo.superficieEn(x, z) + (o.altura ?? 1.8), z);
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

    // El cuerpo del jugador se coloca a mano: en una captura no corre el bucle,
    // y sin esto una revisión de tercera persona miraría el lugar donde el
    // personaje todavía no está. `o.paso` fija el momento de la caminata para
    // poder revisar la pose con las piernas abiertas y no siempre en descanso.
    if (S.cuerpo) {
      if (o.paso !== undefined) {
        S.cuerpo.fase = o.paso;
        // La amplitud del paso sale de la velocidad, y en una captura el
        // jugador está quieto: se le presta una velocidad de caminata para el
        // cuadro y se la devuelve enseguida.
        jugador.velocidad.x = 3.4;
      }
      S.cuerpo.actualizar(1 / 60, jugador);
      jugador.velocidad.x = 0;
    }

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
    // horizontales. Se dibuja entonces a un objetivo propio de una sola
    // muestra, del que sí se puede leer con readRenderTargetPixels.
    if (!window.__objetivoCaptura || window.__objetivoCaptura.width !== ancho) {
      window.__objetivoCaptura?.dispose();
      window.__objetivoCaptura = new THREE.WebGLRenderTarget(ancho, alto, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.NoColorSpace,
        samples: 0,
      });
    }
    const objetivo = window.__objetivoCaptura;

    render.info.autoReset = false;
    render.info.reset();
    const previo = render.getRenderTarget();

    // La captura pasa por el COMPOSITOR, no por un render pelado: si no, no se
    // verían ni la oclusión ambiental ni la corrección de color, que son
    // justamente lo que uno quiere revisar. Como el objetivo del compositor es
    // de media precisión y no se puede leer en bytes, se copia su resultado a
    // un objetivo de 8 bits con un cuadro a pantalla completa.
    // El espejo del lago también en las capturas: si no, la revisión visual
    // mira un agua distinta de la que ve el jugador.
    agua.dibujarReflejo(render, escena, camara);
    agua.dibujarReflejo(render, escena, camara);   // dibuja un cuadro sí y uno no

    const alPrincipio = compositor.renderToScreen;
    compositor.renderToScreen = false;
    compositor.setSize(ancho, alto);
    S.oclusion?.setSize(ancho, alto);
    compositor.render();
    compositor.renderToScreen = alPrincipio;

    if (!window.__copiaCaptura) {
      const mat = new THREE.MeshBasicMaterial({ map: null, depthTest: false, depthWrite: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      const escenaCopia = new THREE.Scene();
      escenaCopia.add(quad);
      // La cámara mira el plano desde 1 m: con la cámara y el plano en z = 0 el
      // cuadro cae justo sobre el plano cercano y la captura sale negra.
      const camaraCopia = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camaraCopia.position.z = 1;
      window.__copiaCaptura = { mat, escena: escenaCopia, camara: camaraCopia };
    }
    const copia = window.__copiaCaptura;
    const salida = compositor.readBuffer.texture;
    salida.colorSpace = THREE.NoColorSpace;
    copia.mat.map = salida;
    copia.mat.needsUpdate = true;
    render.setRenderTarget(objetivo);
    render.clear();
    render.render(copia.escena, copia.camara);
    render.setRenderTarget(previo);

    const pixeles = new Uint8Array(ancho * alto * 4);
    render.readRenderTargetPixels(objetivo, 0, 0, ancho, alto, pixeles);

    // Recién ahora se le devuelve al preset su resolución. Antes esto se hacía
    // apenas terminaba compositor.render(), y ahí estaba el problema de las
    // capturas negras: `calidad.aplicar()` llama a compositor.setSize(), que
    // reasigna los dos objetivos de ping-pong y los deja en blanco. La copia
    // leía entonces un buffer recién creado —y con el panel del navegador
    // oculto, además, de 64×64— así que la captura salía negra siempre, hasta
    // apuntando al cielo al mediodía. El orden importa: primero se leen los
    // píxeles, después se toca el tamaño.
    S.calidad?.aplicar();

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
