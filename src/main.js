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
import { Fauna } from './entities/Fauna.js';
import { Codice } from './ui/Codice.js';
import flora from './data/flora.json';
import fauna from './data/fauna.json';
import { Jugador } from './entities/Jugador.js';
import { Entrada } from './engine/Entrada.js';
import { Tiempo } from './world/Tiempo.js';
import { HUD } from './ui/HUD.js';

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
  const vegetacion = new Vegetacion(mundo, flora);
  escena.add(vegetacion.grupo);
  for (const lote of vegetacion.lotes) conCSM(csm, lote.malla.material);

  progreso(0.82, 'Soltando la fauna del parque…');
  const bichos = new Fauna(mundo, fauna);
  escena.add(bichos.grupo);

  const entrada = new Entrada(lienzo);
  entrada.registrar('KeyF', () => { jugador.tercerPersona = !jugador.tercerPersona; });
  entrada.registrar('F3', () => document.getElementById('diag').classList.toggle('visible'));
  entrada.registrar('KeyT', () => tiempo.alternarVelocidad());

  const hud = new HUD(mundo, jugador, tiempo);
  const codice = new Codice(flora, fauna, hud);
  entrada.registrar('Tab', () => codice.alternar());
  entrada.registrar('KeyE', () => {
    const a = bichos.masCercano(jugador.posicion, 70);
    if (a) codice.registrarFauna(a.esp, true);
    else hud.aviso('Nada cerca', 'Acercate a un animal para identificarlo');
  });
  bichos.alAvistar = (esp) => codice.registrarFauna(esp, false);

  // ── Compositor ────────────────────────────────────────────────────────────
  progreso(0.86, 'Ajustando la cámara…');
  const compositor = new EffectComposer(render);
  compositor.addPass(new RenderPass(escena, camara));

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.62, 0.86);
  compositor.addPass(bloom);

  const fxaa = new ShaderPass(FXAAShader);
  compositor.addPass(fxaa);
  compositor.addPass(new OutputPass());

  function redimensionar() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(devicePixelRatio, 2);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    render.setPixelRatio(pr);
    render.setSize(w, h);
    compositor.setPixelRatio(pr);
    compositor.setSize(w, h);
    fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    csm.updateFrustums();
  }
  addEventListener('resize', redimensionar);
  redimensionar();

  // ── Bucle ─────────────────────────────────────────────────────────────────
  progreso(1, 'Listo.');
  await new Promise(r => setTimeout(r, 420));
  elCarga.classList.add('oculto');
  document.getElementById('hud').classList.add('visible');
  setTimeout(() => elCarga.remove(), 1100);

  const reloj = new THREE.Clock();
  const PASO = 1 / 60;
  let acumulador = 0;
  let fps = 60, ultimoDiag = 0;
  const elDiag = document.getElementById('diag');
  const colorNiebla = new THREE.Color();

  function cuadro() {
    requestAnimationFrame(cuadro);
    const dt = Math.min(reloj.getDelta(), 0.1);
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.06;

    // Simulación a paso fijo: la física no depende de la tasa de refresco
    acumulador += dt;
    let pasos = 0;
    while (acumulador >= PASO && pasos < 5) {
      jugador.actualizar(PASO, entrada);
      tiempo.avanzar(PASO);
      acumulador -= PASO;
      pasos++;
    }

    // ── Cielo y luz
    cielo.actualizar(tiempo.fecha, mundo.meta.centro.lat, mundo.meta.centro.lon, tiempo.segundosTotales);
    const est = tiempo.estado();
    cielo.configurarAtmosfera({ nubes: est.nubosidad, turbiedad: est.turbiedad, ceniza: est.ceniza });

    // Niebla coherente con el cielo y con la densidad del aire del día
    cielo.colorNiebla(colorNiebla);
    escena.fog.color.copy(colorNiebla);
    escena.fog.density = est.densidadNiebla;
    render.toneMappingExposure = est.exposicion;

    // ── Sombras en cascada siguiendo al sol
    csm.lightDirection.copy(cielo.direccionSol).negate().normalize();
    for (const luz of csm.lights) {
      luz.color.copy(cielo.luzSol.color);
      luz.intensity = cielo.luzSol.intensity * 0.92;
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
    vegetacion.actualizar(jugador.posicion, tiempo.segundosTotales, est);
    bichos.actualizar(dt, jugador, est, tiempo.segundosTotales);

    // El domo del cielo acompaña a la cámara
    cielo.malla.position.copy(camara.position);

    compositor.render();

    // ── Interfaz
    hud.actualizar(dt, cielo);
    if (performance.now() - ultimoDiag > 250) {
      ultimoDiag = performance.now();
      const inf = render.info;
      elDiag.innerHTML =
        `${fps.toFixed(0)} fps<br>` +
        `${terreno.nodosDibujados} nodos de terreno<br>` +
        `${vegetacion.totalInstancias} plantas · ${bichos.vivos.length} animales<br>` +
        `${inf.render.calls} llamadas · ${(inf.render.triangles / 1000).toFixed(0)}k tri<br>` +
        `sol ${(cielo.alturaSol * 180 / Math.PI).toFixed(1)}°`;
    }
  }
  cuadro();

  // Exponer para inspección y para los subagentes de revisión visual
  window.SurviBar = {
    escena, camara, render, mundo, terreno, cielo, agua, vegetacion,
    fauna: bichos, jugador, tiempo, compositor, csm, hud, codice, entrada,
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
