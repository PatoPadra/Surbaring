/**
 * SurviBar — supervivencia educativa en el Parque Nacional Nahuel Huapi.
 * Arranque: carga el mundo, arma el render y corre el bucle de simulación.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CSM } from 'three/addons/csm/CSM.js';

import { Mundo } from './world/Mundo.js';
import { Terreno } from './world/Terreno.js';
import { Cielo } from './world/Cielo.js';
import { Agua } from './world/Agua.js';
import { Vegetacion } from './world/Vegetacion.js';
import { Sotobosque } from './world/Sotobosque.js';
import { Fauna } from './entities/Fauna.js';
import { Codice } from './ui/Codice.js';
import flora from './data/flora.json';
import fauna from './data/fauna.json';
import geografia from './data/geografia.json';
import historia from './data/historia.json';
import { Jugador } from './entities/Jugador.js';
import { Entrada } from './engine/Entrada.js';
import { Tiempo } from './world/Tiempo.js';
import { HUD } from './ui/HUD.js';
import { Inventario } from './systems/Inventario.js';
import { Saberes } from './systems/Saberes.js';
import { Recoleccion } from './systems/Recoleccion.js';
import { Caza } from './systems/Caza.js';
import { Limites } from './world/Limites.js';
import { Mineria } from './systems/Mineria.js';
import { Fundicion } from './systems/Fundicion.js';
import { Hornos } from './world/Hornos.js';
import { Taller } from './ui/Taller.js';
import { Construccion } from './systems/Construccion.js';
import { Obras } from './world/Obras.js';
import { Peces } from './entities/Peces.js';
import { Pesca } from './systems/Pesca.js';
import { Eventos } from './systems/Eventos.js';
import { Clima } from './world/Clima.js';
import { Audio } from './engine/Audio.js';
import { PasoOclusion, PasoColor } from './engine/Posproceso.js';
import { Calidad } from './engine/Calidad.js';
import { Exploracion } from './systems/Exploracion.js';
import { Mapa } from './ui/Mapa.js';
import { Opciones } from './ui/Opciones.js';
import { Bolso } from './ui/Bolso.js';
import { Fin } from './ui/Fin.js';
import { Partida } from './systems/Partida.js';

const elCarga = document.getElementById('carga');
const elBarra = document.querySelector('#barra i');
const elEstado = document.getElementById('estado');

function progreso(p, texto) {
  elBarra.style.width = `${Math.round(p * 100)}%`;
  if (texto) elEstado.textContent = texto;
}

async function iniciar() {
  const lienzo = document.getElementById('lienzo');

  // ── Render ────────────────────────────────────────────────────────────────
  const render = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: false,          // lo resuelve el FXAA del compositor
    powerPreference: 'high-performance',
    stencil: false,
    logarithmicDepthBuffer: true, // imprescindible: hay 65 km de vista
    // Permite leer el canvas después de dibujar, que es como se revisa el
    // aspecto del juego durante el desarrollo.
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.setSize(innerWidth, innerHeight);
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.0;
  render.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 90000);

  progreso(0.01, 'Descargando el relieve de Bariloche…');

  // ── Mundo ─────────────────────────────────────────────────────────────────
  const mundo = await new Mundo().cargar('data/dem/', progreso);

  progreso(0.42, 'Levantando el terreno…');
  const terreno = new Terreno(mundo);
  escena.add(terreno.malla);

  progreso(0.55, 'Encendiendo el cielo…');
  const cielo = new Cielo(escena);

  progreso(0.62, 'Llenando los lagos…');
  const agua = new Agua(mundo, cielo);
  escena.add(agua.grupo);

  // Sombras en cascada: nítidas cerca, amplias lejos
  const csm = new CSM({
    maxFar: 900,
    cascades: 4,
    mode: 'practical',
    parent: escena,
    shadowMapSize: 2048,
    lightDirection: new THREE.Vector3(0.4, -1, 0.3).normalize(),
    camera: camara,
    lightIntensity: 0,   // la intensidad la maneja el sol del cielo
  });
  csm.fade = true;
  conCSM(csm, terreno.material);

  // Sesgo de sombra por cascada. Sin esto, el follaje se auto-sombrea y el
  // bosque entero sale negro: cada cascada cubre un área distinta, así que el
  // texel de su mapa mide distinto y el sesgo tiene que acompañar.
  csm.lights.forEach((luz, i) => {
    luz.shadow.normalBias = 0.22 * Math.pow(2, i);
    luz.shadow.bias = -0.0004;
  });

  escena.fog = new THREE.FogExp2(0x9ab4c8, 0.000055);

  // Precipitación, rayos y humo: hasta acá el clima existía en los números y en
  // el color del cielo, pero no se veía caer nada.
  const clima = new Clima(escena, render);
  clima.alturaEn = (x, z) => mundo.alturaEn(x, z);

  // ── Tiempo y estaciones ───────────────────────────────────────────────────
  const tiempo = new Tiempo(mundo.meta.centro.lat, mundo.meta.centro.lon);

  // ── Jugador ───────────────────────────────────────────────────────────────
  progreso(0.68, 'Buscando un lugar donde empezar…');
  const jugador = new Jugador(mundo, camara);
  // Costa sur del Nahuel Huapi, cerca de Playa Bonita: bosque, agua y montaña.
  jugador.aparecerEn(-41.0870, -71.4290);
  // Si cayó en el agua, buscar tierra firme cerca
  if (mundo.esAgua(jugador.posicion.x, jugador.posicion.z)) {
    buscarCosta(mundo, jugador);
  }
  jugador.giro = Math.PI * 0.92;

  progreso(0.76, 'Plantando el bosque andino-patagónico…');
  const vegetacion = new Vegetacion(mundo, flora, render);
  // Las carteleras se iluminan a mano: necesitan ver el cielo.
  vegetacion.cielo = cielo;
  escena.add(vegetacion.grupo);
  for (const lote of vegetacion.lotes) conCSM(csm, lote.malla.material);

  progreso(0.80, 'Sembrando el sotobosque…');
  const sotobosque = new Sotobosque(mundo);
  escena.add(sotobosque.grupo);
  for (const lote of sotobosque.lotes) conCSM(csm, lote.malla.material);

  progreso(0.82, 'Soltando la fauna del parque…');
  const bichos = new Fauna(mundo, fauna);
  escena.add(bichos.grupo);

  progreso(0.84, 'Poblando los lagos y los ríos…');
  const peces = new Peces(mundo, fauna);
  escena.add(peces.grupo);

  // Audio sintetizado, sin archivos. No puede arrancar hasta que haya un gesto
  // del usuario: los navegadores dejan el contexto suspendido hasta entonces.
  const audio = new Audio();
  lienzo.addEventListener('click', () => audio.iniciar());
  addEventListener('keydown', () => audio.iniciar(), { once: true });

  const entrada = new Entrada(lienzo);
  entrada.registrar('KeyF', () => { jugador.tercerPersona = !jugador.tercerPersona; });
  entrada.registrar('F3', () => document.getElementById('diag').classList.toggle('visible'));
  entrada.registrar('KeyT', () => tiempo.alternarVelocidad());
  // Interruptor del posproceso: la oclusión ambiental cuesta, y cuánto depende
  // mucho de la placa. Que se pueda apagar y comparar es más honesto que elegir
  // por el jugador.
  entrada.registrar('KeyC', () => {
    const p = calidad.siguiente();
    hud.aviso(`Calidad: ${p.nombre}`,
      `${calidad.resumen} · C para cambiar · el ajuste automático queda apagado`);
  });
  const ESTADOS_POSPROCESO = ['completo', 'sin oclusión', 'crudo'];
  /** Modo de posproceso, desde la tecla O o desde la pestaña de video. */
  function aplicarPosproceso(modo) {
    modoPosproceso = (modo + ESTADOS_POSPROCESO.length) % ESTADOS_POSPROCESO.length;
    oclusion.enabled = modoPosproceso === 0;
    color.enabled = modoPosproceso < 2;
    hud.aviso(`Posproceso: ${ESTADOS_POSPROCESO[modoPosproceso]}`,
      'O alterna oclusión ambiental y corrección de color');
  }
  entrada.registrar('KeyO', () => aplicarPosproceso(modoPosproceso + 1));
  // El silencio pasó a las opciones: M es la tecla del mapa en todos los juegos
  // del mundo y pelearse con esa costumbre no tiene sentido.

  let modoPosproceso = 0;
  const hud = new HUD(mundo, jugador, tiempo);
  const inventario = new Inventario(38);
  const saberes = new Saberes(historia, inventario);
  const codice = new Codice({ flora, fauna, geografia, historia, mundo, hud, saberes, inventario });
  // La normativa de caza se carga aparte y con tolerancia: si el dataset
  // todavía no está, el sistema cae en sus reglas mínimas —nativas nunca,
  // exóticas sí— en vez de impedir que el juego arranque.
  let normativaCaza = null;
  try {
    normativaCaza = (await import('./data/caza.json')).default;
  } catch {
    console.warn('caza.json ausente: se usan las reglas mínimas de fauna protegida');
  }
  const caza = new Caza(normativaCaza, {
    jugador, inventario, saberes, codice, hud, tiempo, mundo,
  });
  // La minería es la otra mitad del artículo 5 de la Ley 22.351: la que prohíbe
  // extraer. Necesita saber en qué jurisdicción está parado el jugador, así que
  // los límites del parque entran al juego acá.
  const limites = new Limites(mundo);
  let datosMineria = null;
  try {
    datosMineria = (await import('./data/mineria.json')).default;
  } catch {
    console.warn('mineria.json ausente: el taller queda sin recetas');
  }
  const mineria = new Mineria(datosMineria, {
    mundo, limites, jugador, inventario, saberes, hud, historia,
  });
  const fundicion = new Fundicion(datosMineria, {
    inventario, saberes, jugador, tiempo, hud, limites, mundo,
  });
  const hornos = new Hornos();
  escena.add(hornos.grupo);

  // Construcción: la misma ley leída por tercera vez. Lo efímero va a todos
  // lados, lo permanente sólo fuera del área protegida, y el refugio de montaña
  // entra por la excepción que la propia ley prevé para el uso público.
  let datosConstruccion = null;
  try {
    datosConstruccion = (await import('./data/construccion.json')).default;
  } catch {
    console.warn('construccion.json ausente: el taller queda sin obras');
  }
  const construccion = new Construccion(datosConstruccion, {
    inventario, saberes, jugador, tiempo, hud, limites, mundo, fundicion,
  });
  const obras = new Obras();
  escena.add(obras.grupo);

  // La pesca es la única extracción que un visitante puede ejercer legalmente
  // dentro del parque, y casi todo lo que se pesca es exótico. El sistema vive
  // de la normativa que ya estaba en caza.json.
  const pesca = new Pesca(normativaCaza, {
    peces, mundo, jugador, inventario, saberes, codice, hud, tiempo,
  });

  // Eventos naturales: los catorce fenómenos del dataset, disparados por el
  // clima que ya se simula. Nunca contra el vacío —no hay viento blanco sin
  // viento ni incendio con el suelo mojado— y siempre avisando primero.
  const eventos = new Eventos(geografia, { tiempo, mundo, jugador, hud, saberes, codice });

  const recoleccion = new Recoleccion({
    mundo, jugador, vegetacion, sotobosque, fauna: bichos,
    inventario, saberes, codice, hud,
  });
  recoleccion.caza = caza;
  recoleccion.mineria = mineria;
  recoleccion.pesca = pesca;

  const taller = new Taller({ fundicion, mineria, construccion, limites, jugador, inventario });

  // Exploración, mapa, bolso, opciones y final. El mapa arranca en blanco y se
  // revela caminando; lo explorado se guarda en el navegador.
  const exploracion = new Exploracion(mundo);
  const mapa = new Mapa({ mundo, jugador, tiempo, exploracion, codice });
  const bolso = new Bolso({ inventario, jugador, hud, recoleccion });
  const fin = new Fin({ jugador, mundo, tiempo, hud, codice, saberes, construccion });
  /** Una obra en el mundo, con sus materiales enganchados a las cascadas. */
  const dibujarObra = (c) => {
    const nodo = obras.agregar(c);
    nodo.traverse(o => { if (o.isMesh) conCSM(csm, o.material); });
    return nodo;
  };
  const dibujarHorno = (h) => {
    const nodo = hornos.agregar(h);
    nodo.traverse(o => { if (o.isMesh) conCSM(csm, o.material); });
    return nodo;
  };

  // Guardado estilo Rust: la partida se guarda sola, al morir se pierde lo que
  // se carga encima y se reaparece en la base más cercana. Lo aprendido —códice,
  // tecnologías, mapa— no se pierde nunca: ésa es la tesis del juego.
  const partida = new Partida({
    jugador, inventario, saberes, codice, construccion, fundicion, tiempo,
    mundo, hud, exploracion,
    obras: { agregar: dibujarObra },
    hornos: { agregar: dibujarHorno },
  });
  fin.partida = partida;
  // Reaparecer teletransporta, y el mundo no viaja con el jugador: la
  // vegetación se resiembra recién cuando se cruza una celda de casi cien
  // metros, así que se volvía a la vida en un descampado sin una planta que
  // recolectar ni un animal a la vista, con el reloj corriendo. Se siembra a
  // mano en el acto.
  const reaparecerOriginal = partida.reaparecer.bind(partida);
  partida.reaparecer = () => {
    reaparecerOriginal();
    const p = jugador.posicion;
    sotobosque.sembrarTodo(p);
    vegetacion.actualizar(p, tiempo.segundosTotales, tiempo.estado(), camara);
  };
  jugador.alMorir = (m) => { partida.registrarMuerte(m); fin.mostrar(m); };

  const levantarOriginal = construccion.levantar.bind(construccion);
  construccion.levantar = (obra) => {
    const c = levantarOriginal(obra);
    if (c) dibujarObra(c);
    return c;
  };
  const construirOriginal = fundicion.construir.bind(fundicion);
  fundicion.construir = (def) => {
    const h = construirOriginal(def);
    // Sólo el horno nuevo: encadenar dos veces el mismo material lo rompería
    if (h) dibujarHorno(h);
    return h;
  };

  saberes.alCambiar = (p, motivo) => {
    if (p > 0) hud.aviso(motivo, `+${p} puntos de saber · total ${saberes.puntos}`);
  };
  // Descubrir un lugar también enseña
  const registrarLugar = codice.revisarProximidad.bind(codice);
  codice.revisarProximidad = (pos) => {
    const antes = codice.lugares.size;
    registrarLugar(pos);
    const nuevos = codice.lugares.size - antes;
    if (nuevos > 0) saberes.otorgar(nuevos * 3, nuevos === 1 ? 'Lugar descubierto' : `${nuevos} lugares descubiertos`);
  };

  entrada.registrar('Tab', () => codice.alternar());
  entrada.registrar('KeyM', () => mapa.alternar());
  entrada.registrar('KeyI', () => bolso.alternar());
  entrada.registrar('F1', () => opciones.alternar('controles'));
  entrada.registrar('KeyE', () => recoleccion.actuar(tiempo.segundosTotales));
  entrada.registrar('KeyQ', () => recoleccion.comer());
  entrada.registrar('KeyG', () => taller.alternar());
  // Tirar la línea. Como la caza, siempre contesta con una explicación.
  entrada.registrar('KeyP', () => pesca.intentar(tiempo.estado().mes));
  // Extraer: cantera si el yacimiento y la ley lo permiten, chatarra si lo que
  // hay a mano es basura metálica. Como con la caza, la negativa explica.
  entrada.registrar('KeyR', () => {
    const p = jugador.posicion;
    if (mineria.hayChatarra(p.x, p.z)) mineria.recuperarChatarra(tiempo.segundosTotales);
    else mineria.extraer(tiempo.segundosTotales);
  });
  // La tecla de caza siempre responde con una explicación, aunque no se pueda:
  // la negativa es el contenido educativo.
  entrada.registrar('KeyH', () => {
    const a = bichos.masCercano(jugador.posicion, 26);
    if (!a) { hud.aviso('No hay ningún animal cerca', 'Acercate a menos de 26 m'); return; }
    caza.intentar(a, tiempo.estado().mes);
  });
  bichos.alAvistar = (esp) => codice.registrarFauna(esp, false);

  // ── Compositor ────────────────────────────────────────────────────────────
  progreso(0.86, 'Ajustando la cámara…');
  // El objetivo del compositor lleva textura de profundidad: es lo que permite
  // calcular la oclusión ambiental sin volver a dibujar la escena. Vale la pena
  // recordar por qué: el terreno y la vegetación se generan en el vértice, así
  // que un pase con material impuesto los dibujaría planos.
  const objetivoCompositor = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(innerWidth, innerHeight, THREE.FloatType),
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,   // con multimuestreo no se puede leer la profundidad
  });
  const compositor = new EffectComposer(render, objetivoCompositor);
  // El compositor hace ping-pong entre dos objetivos y el segundo lo saca con
  // clone(). El clon de una textura COMPARTE su `source`, y three indexa las
  // texturas de GPU por source: los dos objetivos terminaban con la MISMA
  // textura de profundidad. Al leerla mientras se dibuja sobre el otro búfer,
  // el driver detecta un bucle de realimentación, descarta el dibujo y la
  // pantalla queda negra, avisando sólo con un GL_INVALID_OPERATION en consola.
  // Se le da al segundo objetivo su propia textura de profundidad.
  compositor.renderTarget2.depthTexture =
    new THREE.DepthTexture(innerWidth, innerHeight, THREE.FloatType);
  compositor.addPass(new RenderPass(escena, camara));

  // Oclusión ambiental: nada se apoyaba en nada, y era el defecto que más
  // pesaba. Va antes del resplandor para que no se ilumine lo que se ocluye.
  const oclusion = new PasoOclusion(camara);
  compositor.addPass(oclusion);

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.62, 0.86);
  compositor.addPass(bloom);

  const fxaa = new ShaderPass(FXAAShader);
  compositor.addPass(fxaa);
  // Corrección de color al final, ya con la imagen armada
  const color = new PasoColor();
  compositor.addPass(color);
  compositor.addPass(new OutputPass());

  // ── Calidad ───────────────────────────────────────────────────────────────
  // Nada de esto se elige a ojo: se detecta la placa, se arranca donde
  // corresponde, y después se mide el cuadro de verdad y se ajusta solo.
  const calidad = new Calidad({
    render, compositor, camara, csm, escena, oclusion, color,
    resplandor: bloom, suavizado: fxaa, vegetacion, sotobosque, agua,
  });
  calidad.nivel = calidad.nivelDetectado;
  calidad.alCambiar = (p) => {
    fxaa.material.uniforms.resolution.value.set(1 / calidad.anchoPx, 1 / calidad.altoPx);
    hud.aviso(`Calidad: ${p.nombre}`,
      `${calidad.anchoPx}×${calidad.altoPx} · ${calidad.placa.slice(0, 46)}`);
  };

  const opciones = new Opciones({
    calidad, audio, entrada, camara, jugador, tiempo, exploracion, hud, render,
    partida,
    fps: () => fps,
    modoPosproceso: () => modoPosproceso,
    posproceso: (modo) => aplicarPosproceso(modo),
  });

  // La partida guardada se repone recién acá: necesita el mundo entero armado
  // —obras, hornos, calidad— para volver a poner cada cosa donde estaba.
  if (partida.cargar()) {
    hud.aviso('Partida repuesta',
      `${construccion.obras.length} obras en pie · ${inventario.pesoKg.toFixed(1)} kg en el bolso`);
  }

  /** ¿Hay algún panel abierto? Sirve para no encimarlos. */
  const hayPanel = () => codice.abierto || taller.abierto || mapa.abierto
    || bolso.abierto || opciones.abierto || fin.abierto;

  // Con el puntero capturado, Escape se lo come el navegador para liberarlo y la
  // tecla nunca llega acá. Lo que sí llega es que el puntero se soltó, y eso es
  // lo que el jugador quiso hacer: se abre el menú.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) return;
    if (!hayPanel()) setTimeout(() => { if (!hayPanel()) opciones.abrir(); }, 60);
  });
  addEventListener('keydown', (ev) => {
    if (ev.code !== 'Escape') return;
    if (opciones.abierto) opciones.cerrar();
    else if (mapa.abierto) mapa.alternar();
    else if (bolso.abierto) bolso.alternar();
    else if (taller.abierto) taller.alternar();
    else if (codice.abierto) codice.alternar();
    else opciones.abrir();
  });

  function redimensionar() {
    camara.aspect = innerWidth / innerHeight;
    camara.updateProjectionMatrix();
    calidad.aplicar(innerWidth, innerHeight);
  }
  addEventListener('resize', redimensionar);
  redimensionar();

  // ── Bucle ─────────────────────────────────────────────────────────────────
  progreso(1, 'Listo.');
  await new Promise(r => setTimeout(r, 420));
  elCarga.classList.add('oculto');
  document.getElementById('hud').classList.add('visible');
  setTimeout(() => elCarga.remove(), 1100);

  // Bienvenida. El juego tenía diecisiete teclas y no decía ninguna: quien lo
  // abría por primera vez caía en un bosque sin saber siquiera que hay que
  // hacer clic para que el ratón mire. La primera vez se abre el panel en
  // Controles; después alcanza con un aviso, porque repetir el panel en cada
  // arranque es la clase de cortesía que se vuelve estorbo.
  const CLAVE_BIENVENIDA = 'survibar.bienvenida';
  let yaVino = false;
  try { yaVino = !!localStorage.getItem(CLAVE_BIENVENIDA); } catch { /* sin almacenamiento */ }
  if (!yaVino) {
    try { localStorage.setItem(CLAVE_BIENVENIDA, '1'); } catch { /* da igual */ }
    setTimeout(() => opciones.abrir('controles'), 900);
  } else {
    hud.aviso('Clic para mirar · F1 para los controles',
      'E recolecta e identifica · Q come · Tab abre el códice · G el taller · M el mapa', 9000);
  }

  const reloj = new THREE.Clock();
  const PASO = 1 / 60;
  /**
   * Segundos de juego por segundo real a los que envejece el cuerpo.
   *
   * Con 24, una barra de sed llena dura unos cincuenta minutos caminando y un
   * trago devuelve un cuarto de hora: se puede salir a explorar sin volver al
   * agua cada dos minutos, que era lo que convertía la supervivencia en una
   * tarea. El hambre aguanta más de una hora. Son números de juego, no de
   * fisiología: un cuerpo real aguanta días, y jugar eso sería no jugar nada.
   */
  const ESCALA_METABOLISMO = 24;
  let acumulador = 0;
  let fps = 60, ultimoDiag = 0;
  let acumProximidad = 0;
  const elDiag = document.getElementById('diag');
  const colorNiebla = new THREE.Color();
  let distanciaAlAgua = 9999;
  let ultimoAvisoFuego = -9999;
  let destelloPrevio = 0;

  /** Cuánto fuego hay a mano: hornos encendidos e incendio forestal. */
  function fuegoCercano(est) {
    let f = 0;
    for (const h of fundicion.hornos) {
      if (!h.trabajo) continue;
      const d = Math.hypot(h.x - jugador.posicion.x, h.z - jugador.posicion.z);
      f = Math.max(f, Math.max(0, 1 - d / 16));
    }
    for (const o of construccion.obras) {
      if (o.obra.id !== 'ahumadero') continue;
      const d = Math.hypot(o.x - jugador.posicion.x, o.z - jugador.posicion.z);
      f = Math.max(f, Math.max(0, 1 - d / 14) * 0.5);
    }
    for (const ev of est.eventos || []) {
      if (ev.id === 'incendio_forestal' && ev.distancia != null) {
        f = Math.max(f, Math.max(0, 1 - ev.distancia / 900) * ev.intensidad);
      }
    }
    return f;
  }

  function cuadro() {
    requestAnimationFrame(cuadro);
    const dt = Math.min(reloj.getDelta(), 0.1);
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.06;
    calidad.gobernar(dt);

    // El estado del ambiente se calcula UNA vez por cuadro y se le aplican los
    // eventos: si la supervivencia usara su propia llamada a tiempo.estado(),
    // el viento blanco no la tocaría y el jugador no se enteraría de nada.
    const est = eventos.aplicar(tiempo.estado());

    // Simulación a paso fijo: la física no depende de la tasa de refresco
    acumulador += dt;
    let pasos = 0;
    while (acumulador >= PASO && pasos < 5) {
      jugador.actualizar(PASO, entrada);
      tiempo.avanzar(PASO);
      jugador.pesoCargado = inventario.pesoKg;
      // El metabolismo corre a su propia escala, y no a la del reloj del mundo.
      //
      // Estaban atados, y la cuenta daba un juego imposible: con el reloj en su
      // velocidad por defecto —trescientos segundos de juego por segundo real—
      // la sed llegaba a cero en menos de cuatro minutos de estar sentado
      // jugando, y un fruto devolvía treinta segundos de caminata. No era una
      // tensión de supervivencia: era una cuenta regresiva, y el juego se
      // reducía a apretar E contra el lago para siempre.
      //
      // Separarlos tiene además una consecuencia buena de diseño: acelerar el
      // tiempo con T pasa a servir para lo que se inventó —esperar una hornada
      // de treinta horas, ver amanecer— sin que eso mate al jugador de sed
      // mientras espera. El costo de adelantar el reloj es el del mundo, no el
      // del cuerpo.
      jugador.actualizarSupervivencia(PASO, est, ESCALA_METABOLISMO);
      acumulador -= PASO;
      pasos++;
    }
    // Lo que los eventos hacen por su cuenta: quemar, golpear, voltear
    if (jugador.vivo) eventos.golpear(dt, est, jugador, dt * tiempo.velocidad / 3600);

    // Lo que se conoce del parque: se revela caminando y mirando desde alto
    if (jugador.vivo) {
      exploracion.revisar(jugador.posicion, est, dt);
      if (exploracion.nuevasDesdeUltimoDibujo > 400) {
        exploracion.nuevasDesdeUltimoDibujo = 0;
        exploracion.guardar();
        if (mapa.abierto) mapa.dibujar();
      }
      // Guardado automático: cada tanto, sin pedirlo. Guardar a mano justo
      // antes de una decisión difícil es lo que le saca peso a la decisión.
      partida.actualizar(dt);
    }

    // ── Cielo y luz
    cielo.actualizar(tiempo.fecha, mundo.meta.centro.lat, mundo.meta.centro.lon, tiempo.segundosTotales);
    cielo.configurarAtmosfera({ nubes: est.nubosidad, turbiedad: est.turbiedad, ceniza: est.ceniza });

    // Niebla coherente con el cielo y con la densidad del aire del día
    cielo.colorNiebla(colorNiebla);
    escena.fog.color.copy(colorNiebla);
    escena.fog.density = est.densidadNiebla;
    // El relámpago no dibuja una raya: ilumina el paisaje entero por un instante
    clima.actualizar(dt, est, camara);
    render.toneMappingExposure = est.exposicion * (1 + clima.destello * 1.6);

    // ── Sombras en cascada siguiendo al sol
    csm.lightDirection.copy(cielo.direccionSol).negate().normalize();
    for (const luz of csm.lights) {
      luz.color.copy(cielo.luzSol.color);
      luz.intensity = cielo.luzSol.intensity * 0.92 + clima.destello * 6.0;
    }
    cielo.luzSol.intensity = 0; // la sombra la aportan las cascadas
    csm.update();

    // ── Terreno
    terreno.aplicarEstacion({
      estacion: est.estacionContinua,
      cotaNieve: est.cotaNieve,
      ceniza: est.ceniza,
      humedad: est.humedadSuelo,
    });
    terreno.actualizar(camara);

    // ── Agua y vegetación
    agua.actualizar(tiempo.segundosTotales, camara, est, escena);
    vegetacion.uniformesImpostor.uNiebla.value.copy(escena.fog.color);
    vegetacion.uniformesImpostor.uDensidadNiebla.value = escena.fog.density;
    vegetacion.actualizar(jugador.posicion, tiempo.segundosTotales, est, camara);
    sotobosque.actualizar(jugador.posicion, tiempo.segundosTotales, est);
    // Recorte de instancias del preset, después de que cada sistema haya
    // reescrito sus cuentas
    calidad.recortarInstancias();
    bichos.actualizar(dt, jugador, est, tiempo.segundosTotales);
    peces.actualizar(jugador.posicion, tiempo.segundosTotales);
    fundicion.actualizar();
    hornos.actualizar(tiempo.segundosTotales);
    for (const caida of construccion.actualizar()) obras.quitar(caida);
    // Lo que abriga alrededor entra en el modelo térmico del jugador
    jugador.abrigo = construccion.abrigoEn(jugador.posicion.x, jugador.posicion.z);
    // El fuego se mide una vez y lo usan los dos que lo necesitan: el cuerpo,
    // que se calienta y se seca, y el oído, que escucha las llamas.
    jugador.fuego = fuegoCercano(est);

    // El empujón del fuego. El taller tiene la fogata desde el primer día —seis
    // leñas y cuatro piedras— pero nadie se entera de que existe hasta que abre
    // G por curiosidad, y para entonces ya se está muriendo de frío. Cuando el
    // cuerpo empieza a enfriarse y no hay fuego cerca, el juego lo dice una vez
    // cada tanto, y sólo entonces: un consejo que aparece cuando hace falta se
    // lee como ayuda, y uno que aparece siempre, como ruido.
    if (jugador.temperatura < 36.1 && jugador.fuego < 0.15
        && tiempo.segundosTotales - ultimoAvisoFuego > 900) {
      ultimoAvisoFuego = tiempo.segundosTotales;
      const lena = inventario.disponiblePara('lena');
      const piedra = inventario.disponiblePara('piedra');
      hud.aviso('Estás perdiendo calor',
        lena >= 6 && piedra >= 4
          ? 'Tenés para una fogata: abrí el taller con G y armala. Calienta, seca y cocina.'
          : `Una fogata pide 6 leña y 4 piedra (tenés ${lena} y ${piedra}). Se arma en el taller, con G.`,
        7000);
    }

    // ── Audio
    audio.actualizar(dt, est, {
      altitud: jugador.posicion.y,
      distanciaAgua: distanciaAlAgua,
      fuegoCerca: jugador.fuego,
    });
    audio.pasos(dt, jugador);
    // El trueno se dispara con el relámpago y llega más tarde, por la velocidad
    // del sonido. La distancia sale del propio destello: los cercanos deslumbran.
    if (clima.destello > destelloPrevio + 0.3) {
      audio.rayo(clima.destello, 300 + (1 - clima.destello) * 7000);
    }
    destelloPrevio = clima.destello;

    // Descubrimiento de lugares: dos veces por segundo alcanza y evita medir
    // distancias contra medio centenar de sitios en cada cuadro.
    acumProximidad += dt;
    if (acumProximidad > 0.5) {
      acumProximidad = 0;
      codice.revisarProximidad(jugador.posicion);
      distanciaAlAgua = medirDistanciaAlAgua(mundo, jugador.posicion);
    }
    if (acumProximidad === 0) {
      hud.mostrarAccion(recoleccion.quePuedoHacer(tiempo.segundosTotales));
      hud.pintarBolso(inventario);
      hud.pintarFenomenos(eventos.resumen());
    }

    // El domo del cielo acompaña a la cámara
    cielo.malla.position.copy(camara.position);

    // El espejo del lago se dibuja antes del pase principal: necesita la escena
    // ya actualizada y la superficie del agua todavía sin dibujar.
    agua.dibujarReflejo(render, escena, camara);

    compositor.render();

    // ── Interfaz
    hud.actualizar(dt, cielo);
    if (performance.now() - ultimoDiag > 250) {
      ultimoDiag = performance.now();
      const inf = render.info;
      elDiag.innerHTML =
        `${fps.toFixed(0)} fps<br>` +
        `${terreno.nodosDibujados} nodos de terreno<br>` +
        `${vegetacion.mallasCompletas}m+${vegetacion.impostores}i+${sotobosque.total} plantas · ${bichos.vivos.length} animales · ${peces.total} peces<br>` +
        `${inf.render.calls} llamadas · ${(inf.render.triangles / 1000).toFixed(0)}k tri<br>` +
        `sol ${(cielo.alturaSol * 180 / Math.PI).toFixed(1)}° · calidad ${calidad.preset.nombre}` +
        (eventos.activos.length ? `<br>${eventos.resumen().map(e => e.nombre).join(' · ')}` : '');
    }
  }
  cuadro();

  // Exponer para inspección y para los subagentes de revisión visual
  window.SurviBar = {
    escena, camara, render, mundo, terreno, cielo, agua, vegetacion, sotobosque,
    fauna: bichos, jugador, tiempo, compositor, csm, hud, codice, entrada,
    inventario, saberes, recoleccion, caza, audio,
    limites, mineria, fundicion, hornos, taller, construccion, obras, peces, pesca,
    eventos, clima, oclusion, color, calidad,
    exploracion, mapa, bolso, opciones, fin, partida,
  };

  if (import.meta.env.DEV) {
    const { instalarCapturas } = await import('./util/captura.js');
    instalarCapturas(window.SurviBar);
  }
}

/**
 * Registra un material en las sombras en cascada SIN perder su propio shader.
 *
 * CSM.setupMaterial() no encadena: reemplaza onBeforeCompile por el suyo. Si se
 * llama después de haber preparado un material con inyecciones propias, esas
 * inyecciones desaparecen sin dar ningún error — el terreno se dibuja liso, a
 * cota cero y sin color. Acá se guardan ambas y se ejecutan en orden.
 */
function conCSM(csm, material) {
  const propio = material.onBeforeCompile;
  csm.setupMaterial(material);
  const deCSM = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    if (deCSM) deCSM.call(this, shader, renderer);
    if (propio) propio.call(this, shader, renderer);
  };
  material.needsUpdate = true;
}

/**
 * Distancia aproximada al agua, para el sonido de la orilla. Se mide con anillos
 * porque el mapa de agua es una textura y no hay una consulta de distancia: con
 * cinco radios y ocho direcciones alcanza, y sólo corre dos veces por segundo.
 */
function medirDistanciaAlAgua(mundo, p) {
  if (mundo.esAgua(p.x, p.z)) return 0;
  for (const r of [8, 18, 32, 50, 70]) {
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2;
      if (mundo.esAgua(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r)) return r;
    }
  }
  return 9999;
}

/** Empuja al jugador hasta la costa más cercana si apareció dentro del lago. */
function buscarCosta(mundo, jugador) {
  const { x, z } = jugador.posicion;
  for (let r = 40; r < 4000; r += 40) {
    for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2;
      const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
      if (!mundo.esAgua(px, pz) && mundo.pendienteEn(px, pz) < 0.5) {
        jugador.posicion.set(px, mundo.alturaEn(px, pz) + 1.5, pz);
        return;
      }
    }
  }
}

iniciar().catch((e) => {
  console.error(e);
  elEstado.innerHTML = `<span style="color:#c8503f">Falló el arranque: ${e.message}</span>`;
});
