/**
 * Luces — dos luces puntuales propias, compiladas una sola vez en la carga.
 *
 * El juego tenía luces puntuales de three —una por horno y la del incendio— y
 * nadie había medido lo que costaban. En three la cantidad de luces puntuales es
 * parte de la clave del programa: **cuando cambia, se recompila todo material
 * iluminado.** En la placa de destino (Intel HD 4000, ANGLE sobre D3D11) eso son
 * seis programas y **un congelamiento de 19 segundos** al construir la primera
 * fogata, otros 17 al construir la segunda, y otra vez cuando un incendio se
 * vuelve visible. Y apagadas pero presentes cobraban igual: ~0,8 ms por luz.
 *
 * De ahí las tres decisiones de este módulo, medidas en `RONDA5.md`:
 *
 * 1. **El conjunto es fijo desde la carga.** Dos lugares, siempre: uno para lo
 *    que se lleva en la mano y otro para el fuego más cercano. Se escriben en un
 *    bloque propio al final de `lights_fragment_begin`, con uniformes que
 *    existen desde el primer programa. Encender, apagar o cambiar de fuente es
 *    escribir cuatro números: nunca compila nada.
 * 2. **El bucle corta por cantidad.** Con cero luces el sombreador compara un
 *    entero con un uniforme y sale. Medido alternado en tres rondas: +0,40 ms
 *    apagado, +0,64 con una luz, +1,53 con dos. Dos luces de three presentes y
 *    apagadas cobraban +1,65 todo el día.
 * 3. **Lambert y sin sombra.** Una llama no da un brillo especular que se note,
 *    y el GGX es la parte cara del sombreador estándar; una sombra de luz
 *    puntual son seis pasadas de profundidad.
 *
 * La posición viaja en **espacio de vista**, calculada en la CPU una vez por
 * render: el sombreador ya tiene `geometryPosition` en ese espacio, así que no
 * paga una multiplicación de matriz por fragmento. La primera versión la pagaba
 * y no ganaba nada contra la luz de three.
 *
 * Los uniformes se reparten a TODOS los materiales de three con un solo
 * `Float32Array`: `UniformsUtils.clone()` copia vectores, colores y matrices,
 * pero un arreglo tipado lo pasa por referencia. Una escritura llega a todos.
 *
 * Este módulo no importa three a propósito: recibe el espacio de nombres en
 * `instalarLuces(THREE)` y hace la cuenta de la matriz a mano, así se puede
 * probar en Node con objetos planos.
 */

export const MAX_LUCES = 2;

/**
 * Más allá de su radio más esto, una fuente no compite por un lugar.
 *
 * Una fogata a 200 m no alumbra nada que se vea; dejarla competir le quitaría
 * el lugar a la que está a 20 m pero un poco más allá en la lista. Los 60 m son
 * margen para que un fuego que está por entrar en cuadro ya esté elegido.
 */
const MARGEN_M = 60;

/** Los sombreadores de three que incluyen `lights_fragment_begin`. */
const SOMBREADORES = ['standard', 'physical', 'lambert', 'phong', 'toon'];

// Sin comillas invertidas ni signos de pesos dentro de los comentarios GLSL:
// cerrarían el literal de plantilla (ver `.claude/flota/lint-shader.mjs`).
const DECLARACION = /* glsl */`
// Luz i: uLucesPos[ i ] = vec4( posición en espacio de vista, radio al cuadrado )
//        uLucesColor[ i ] = vec4( color por intensidad, 0 ); uLucesColor[ 0 ].w = cantidad
uniform vec4 uLucesPos[ ${MAX_LUCES} ];
uniform vec4 uLucesColor[ ${MAX_LUCES} ];
`;

/**
 * El bloque que se agrega al final de `lights_fragment_begin`.
 *
 * Caída `(1 - d²/r²)²`: llega a cero justo en el radio, sin raíz ni división
 * por la distancia, y la compara con el cuadrado que ya hay que calcular para
 * saber si el fragmento está adentro. `inversesqrt` sólo se paga dentro del
 * radio. Todo lo de afuera del radio sale por la comparación.
 */
const BLOQUE = /* glsl */`
for ( int iLuz = 0; iLuz < ${MAX_LUCES}; iLuz ++ ) {
	if ( float( iLuz ) >= uLucesColor[ 0 ].w ) break;
	vec3 lvLuz = uLucesPos[ iLuz ].xyz - geometryPosition;
	float d2Luz = dot( lvLuz, lvLuz );
	if ( d2Luz < uLucesPos[ iLuz ].w ) {
		float aLuz = 1.0 - d2Luz / uLucesPos[ iLuz ].w;
		aLuz *= aLuz;
		float nlLuz = max( dot( geometryNormal, lvLuz * inversesqrt( max( d2Luz, 1e-4 ) ) ), 0.0 );
		reflectedLight.directDiffuse += uLucesColor[ iLuz ].rgb * ( aLuz * nlLuz ) * BRDF_Lambert( material.diffuseColor );
	}
}
`;

/** Una instalación por juego de chunks: llamar dos veces devuelve la misma. */
const instalaciones = new WeakMap();

/** ¿Están la declaración y el bloque en los chunks vivos? */
function bloquePuesto(ShaderChunk) {
  return ShaderChunk.lights_pars_begin.includes('uLucesPos')
    && ShaderChunk.lights_fragment_begin.includes('uLucesPos');
}

/** Agrega lo que falte. Devuelve true si tuvo que agregar algo. */
function ponerBloque(ShaderChunk) {
  let puso = false;
  if (!ShaderChunk.lights_pars_begin.includes('uLucesPos')) {
    ShaderChunk.lights_pars_begin += DECLARACION;
    puso = true;
  }
  if (!ShaderChunk.lights_fragment_begin.includes('uLucesPos')) {
    ShaderChunk.lights_fragment_begin += BLOQUE;
    puso = true;
  }
  return puso;
}

/**
 * Deja el bloque y los uniformes puestos en three. Idempotente: llamarla otra
 * vez no duplica nada, devuelve la misma instancia, y si alguien pisó los chunks
 * entre medio los vuelve a poner y lo avisa.
 *
 * **Cuándo tiene que correr: después de `new CSM(...)` y antes del primer
 * render.** Las dos cosas se pagaron:
 *
 * - `CSM` (`three/examples/jsm/csm/CSM.js`, `injectInclude()`, llamado desde su
 *   constructor) REEMPLAZA `lights_fragment_begin` y `lights_pars_begin` por los
 *   de `CSMShader.js`, que copió el chunk de three cuando se importó el módulo.
 *   Instalar antes de construir el CSM deja el bloque borrado y la luz no llega
 *   a ningún píxel, sin un error. Lo encontró el jefe mirando el chunk vivo.
 * - Para los materiales propios de three la clave del programa es el
 *   `shaderID`, no el texto (`WebGLPrograms.getProgramCacheKey`): un programa
 *   compilado antes de esto se reutilizaría después sin el bloque, en silencio.
 *
 * El bloque tolera el chunk de `CSMShader`: declara `geometryPosition` y
 * `geometryNormal` igual que el de three.
 *
 * @param {object} THREE el espacio de nombres de three (o algo con
 *   `ShaderChunk` y `ShaderLib`)
 * @returns {Luces}
 */
export function instalarLuces(THREE) {
  const { ShaderChunk, ShaderLib } = THREE;
  const puso = ponerBloque(ShaderChunk);

  let luces = instalaciones.get(ShaderChunk);
  if (!luces) {
    // Si otro módulo ya instaló los arreglos, se reusan: dos juegos de arreglos
    // dejarían a la mitad de los materiales mirando uno que nadie escribe.
    const previoPos = ShaderLib.standard?.uniforms?.uLucesPos?.value;
    const previoColor = ShaderLib.standard?.uniforms?.uLucesColor?.value;
    const posiciones = previoPos instanceof Float32Array && previoPos.length === MAX_LUCES * 4
      ? previoPos : new Float32Array(MAX_LUCES * 4);
    const colores = previoColor instanceof Float32Array && previoColor.length === MAX_LUCES * 4
      ? previoColor : new Float32Array(MAX_LUCES * 4);
    luces = new Luces(posiciones, colores, ShaderChunk);
    instalaciones.set(ShaderChunk, luces);
  } else if (puso) {
    console.warn('Luces: el bloque de luces había desaparecido de los chunks y se volvió a poner. '
      + 'Algo los reemplazó después de instalarLuces() —un new CSM() lo hace—: '
      + 'lo que haya compilado entre medio quedó sin luz.');
  }

  // `physical` se armó clonando `standard` cuando se cargó three, así que no
  // hereda lo que se le agregue a `standard` ahora: van los cinco a mano.
  for (const nombre of SOMBREADORES) {
    const u = ShaderLib[nombre]?.uniforms;
    if (!u) continue;
    u.uLucesPos = { value: luces.posiciones };
    u.uLucesColor = { value: luces.colores };
  }
  return luces;
}

export class Luces {
  /**
   * @param {Float32Array} posiciones el arreglo de `uLucesPos`
   * @param {Float32Array} colores el arreglo de `uLucesColor`
   * @param {object} [chunks] `THREE.ShaderChunk`, para poder verificar
   */
  constructor(posiciones, colores, chunks = null) {
    this.posiciones = posiciones;
    this.colores = colores;
    this._chunks = chunks;
    this._verificada = false;
    this._avisada = false;
    /** La elección de la última asignación, en espacio de mundo: x, y, z, radio². */
    this._mundo = new Float64Array(MAX_LUCES * 4);
    /** Color × intensidad de cada elegida. */
    this._color = new Float32Array(MAX_LUCES * 3);
    this._activas = 0;
    /** Las fuentes elegidas, por si alguien quiere saber cuáles fueron. */
    this.elegidas = [];
    this._distancias = [];
  }

  /** Cuántas quedaron elegidas en la última asignación. */
  get activas() { return this._activas; }

  /** ¿El bloque sigue en los chunks vivos? Sin chunks conocidos, se da por sí. */
  get instalada() { return this._chunks ? bloquePuesto(this._chunks) : true; }

  /**
   * Comprueba que nadie haya pisado los chunks y, si los pisaron, lo dice una
   * vez por consola. No los vuelve a poner: a esta altura puede haber
   * programas compilados sin el bloque, y arreglar la mitad confunde más que
   * no arreglar nada. Para reponerlos, `instalarLuces(THREE)` otra vez.
   *
   * El primer render de la escena enganchada la llama sola.
   */
  verificar() {
    const bien = this.instalada;
    if (!bien && !this._avisada) {
      this._avisada = true;
      console.warn('Luces: lights_fragment_begin o lights_pars_begin ya no tienen el bloque de luces. '
        + 'La luz no va a llegar a ningún píxel. instalarLuces() tiene que correr DESPUÉS de new CSM() '
        + 'y antes del primer render.');
    }
    return bien;
  }

  /**
   * Elige hasta `MAX_LUCES` fuentes y guarda la elección. No escribe los
   * uniformes: eso lo hace el render, en el espacio de vista de su cámara.
   *
   * La de la mano va primero siempre: es la que el jugador prendió para ver, y
   * que una fogata ajena se la quite porque quedó más cerca de la cámara sería
   * apagarle la antorcha. Después, por distancia a la referencia.
   *
   * @param {Array<{x:number,y:number,z:number,radio:number,color:number[],intensidad:number,mano?:boolean}>} fuentes
   *   en espacio de mundo
   * @param {{x:number,y:number,z:number}} referencia la posición de la cámara
   */
  asignar(fuentes, referencia) {
    const elegidas = this.elegidas;
    elegidas.length = 0;
    const d = this._distancias;
    d.length = 0;
    const lista = Array.isArray(fuentes) ? fuentes : [];
    const hayRef = referencia && Number.isFinite(referencia.x);

    // Primero las de la mano, en el orden en que llegan
    for (const f of lista) {
      if (elegidas.length >= MAX_LUCES) break;
      if (f?.mano && valida(f)) elegidas.push(f);
    }

    // Después las demás, la más cercana primero. Son pocas —un puñado de
    // hornos y quizás un incendio—, así que una selección simple alcanza y no
    // reserva memoria por cuadro.
    for (let k = 0; k < lista.length; k++) {
      const f = lista[k];
      if (!f || f.mano || !valida(f)) { d[k] = Infinity; continue; }
      if (!hayRef) { d[k] = k; continue; }
      const dist = Math.hypot(f.x - referencia.x, f.y - referencia.y, f.z - referencia.z);
      d[k] = dist > f.radio + MARGEN_M ? Infinity : dist;
    }
    while (elegidas.length < MAX_LUCES) {
      let mejor = -1;
      for (let k = 0; k < lista.length; k++) {
        if (d[k] !== Infinity && (mejor < 0 || d[k] < d[mejor])) mejor = k;
      }
      if (mejor < 0) break;
      elegidas.push(lista[mejor]);
      d[mejor] = Infinity;
    }

    for (let i = 0; i < elegidas.length; i++) {
      const f = elegidas[i];
      this._mundo[i * 4] = f.x;
      this._mundo[i * 4 + 1] = f.y;
      this._mundo[i * 4 + 2] = f.z;
      this._mundo[i * 4 + 3] = f.radio * f.radio;
      const c = f.color ?? [1, 1, 1];
      const I = f.intensidad;
      this._color[i * 3] = (c[0] ?? c.r ?? 1) * I;
      this._color[i * 3 + 1] = (c[1] ?? c.g ?? 1) * I;
      this._color[i * 3 + 2] = (c[2] ?? c.b ?? 1) * I;
    }
    this._activas = elegidas.length;
    return this._activas;
  }

  /**
   * Escribe la elección en los uniformes, en el espacio de vista de `camara`.
   *
   * La matriz es `matrixWorldInverse`, la misma que three sube como
   * `viewMatrix`: `WebGLRenderer.render()` la actualiza justo antes de llamar a
   * `scene.onBeforeRender`, así que el espejo del lago, que dibuja la misma
   * escena con su propia cámara, recibe las luces en su propio espacio.
   */
  escribir(camara) {
    const pos = this.posiciones, col = this.colores;
    const e = camara?.matrixWorldInverse?.elements;
    const n = e ? this._activas : 0;
    for (let i = 0; i < n; i++) {
      const x = this._mundo[i * 4], y = this._mundo[i * 4 + 1], z = this._mundo[i * 4 + 2];
      pos[i * 4] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pos[i * 4 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pos[i * 4 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      pos[i * 4 + 3] = this._mundo[i * 4 + 3];
      col[i * 4] = this._color[i * 3];
      col[i * 4 + 1] = this._color[i * 3 + 1];
      col[i * 4 + 2] = this._color[i * 3 + 2];
      col[i * 4 + 3] = 0;
    }
    // Las que sobran quedan en cero. El bucle corta antes de leerlas, pero un
    // valor viejo en el arreglo es la clase de basura que confunde al medir.
    pos.fill(0, n * 4);
    col.fill(0, n * 4);
    // La cantidad vive en la cuarta componente del primer color, que el
    // sombreador no usa para otra cosa: un uniforme menos que declarar.
    col[3] = n;
  }

  /**
   * Engancha la escena: antes de cada render escribe las luces para la cámara
   * que dibuja, y después vuelve la cantidad a cero.
   *
   * Lo segundo es tan importante como lo primero. El horneado de impostores de
   * `Vegetacion` y la vista previa de `Personaje` dibujan OTRAS escenas con
   * materiales iluminados; como el arreglo es uno solo para todos, sin la
   * vuelta a cero heredarían la antorcha del cuadro anterior en un lugar que no
   * tiene nada que ver.
   */
  enganchar(escena) {
    const antes = Object.prototype.hasOwnProperty.call(escena, 'onBeforeRender')
      && !escena.onBeforeRender.deLuces ? escena.onBeforeRender : null;
    const despues = Object.prototype.hasOwnProperty.call(escena, 'onAfterRender')
      && !escena.onAfterRender.deLuces ? escena.onAfterRender : null;

    const alEmpezar = (render, esc, camara, objetivo) => {
      antes?.call(escena, render, esc, camara, objetivo);
      // Una sola vez, en el render donde compila todo: es el último momento en
      // que un chunk pisado todavía se puede ver antes de que no se note nada.
      if (!this._verificada) { this._verificada = true; this.verificar(); }
      this.escribir(camara);
    };
    const alTerminar = (render, esc, camara) => {
      this.colores[3] = 0;
      despues?.call(escena, render, esc, camara);
    };
    alEmpezar.deLuces = true;
    alTerminar.deLuces = true;
    escena.onBeforeRender = alEmpezar;
    escena.onAfterRender = alTerminar;
    return this;
  }
}

/** Una fuente con intensidad 0 —o rota— no ocupa lugar. */
function valida(f) {
  return f.intensidad > 0 && f.radio > 0
    && Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z)
    && Number.isFinite(f.intensidad) && Number.isFinite(f.radio);
}

/**
 * El radio de luz que cuenta para ver de noche estando en `pos`.
 *
 * Cuenta lo que se lleva en la mano, y estar dentro del radio de un fuego
 * encendido. Devuelve el mayor de los radios que alcanzan, o 0. Es la mitad
 * jugable de la luz: `Exploracion.alcanceVisual()` la lee como `luzM`.
 *
 * @param {Array<object>} fuentes las mismas que se le pasan a `asignar`
 * @param {{x:number,y?:number,z:number}} pos dónde está el jugador
 */
export function radioDeLuzEn(fuentes, pos) {
  let r = 0;
  for (const f of fuentes || []) {
    if (!f || !valida(f)) continue;
    if (f.mano) { r = Math.max(r, f.radio); continue; }
    const dy = Number.isFinite(pos?.y) ? f.y - pos.y : 0;
    if (Math.hypot(f.x - pos.x, dy, f.z - pos.z) <= f.radio) r = Math.max(r, f.radio);
  }
  return r;
}

/** sRGB de 0 a 255 → lineal de 0 a 1, lo mismo que hace `THREE.Color` al leer un hex. */
function lineal(hex) {
  return [16, 8, 0].map((corrimiento) => {
    const c = ((hex >> corrimiento) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

/**
 * Cómo alumbra cada cosa que se lleva en la mano.
 *
 * El radio y la duración son de la ficha (`herramientas.json`); esto es sólo el
 * color, la intensidad y cuánto tiembla. Todas por debajo de la fogata (2,6 en
 * 14 m), que es fuego de verdad. La antorcha de resina es la más viva y la que
 * más parpadea; el candil de grasa da una llama chica, roja y humosa; la vela de
 * cera, la más amarilla y la más quieta.
 *
 * Números elegidos sin haber visto la captura nocturna: se ajustan mirándola.
 */
export const LLAMAS = {
  antorcha: { color: lineal(0xff8a3a), intensidad: 2.0, parpadeo: 0.12 },
  candil_grasa: { color: lineal(0xff7430), intensidad: 1.2, parpadeo: 0.06 },
  velas_cera: { color: lineal(0xffb066), intensidad: 0.9, parpadeo: 0.04 },
};

/**
 * La fuente de luz de lo que se lleva en la mano, lista para `asignar`.
 *
 * El parpadeo son dos senos de frecuencias que no se enciman (7,9 y 13,1 rad/s):
 * con uno solo la llama late como un faro. Se paga en la CPU, una vez por
 * cuadro: el sombreador recibe un número y no se entera.
 *
 * @param {null|{id:string, radio:number}} luz lo que devuelve `Equipo.luzActiva()`
 * @param {object} jugador
 * @param {object} camara
 * @param {number} [t] segundos, para el parpadeo
 * @returns {null|object}
 */
export function fuenteDeMano(luz, jugador, camara, t = 0) {
  if (!luz || !(luz.radio > 0)) return null;
  const llama = LLAMAS[luz.id] ?? LLAMAS.antorcha;
  const p = posicionDeMano(jugador, camara);
  const temblor = 1 + llama.parpadeo * (0.6 * Math.sin(t * 7.9) + 0.4 * Math.sin(t * 13.1 + 1.7));
  return {
    x: p.x, y: p.y, z: p.z,
    radio: luz.radio,
    color: llama.color,
    intensidad: llama.intensidad * temblor,
    mano: true,
  };
}

// Dónde queda la mano derecha respecto del eje del cuerpo, en metros. Medidas
// de `Cuerpo.js`: hombro a 1,44, brazo de 0,57; con el antebrazo levantado para
// sostener algo delante, la mano queda a la altura de la cadera alta.
const MANO_ALTURA_M = 1.12;
const MANO_DERECHA_M = 0.30;
const MANO_ADELANTE_M = 0.32;
/** `Jugador` adelanta los ojos 12 cm del eje del cuello en primera persona. */
const OJOS_ADELANTE_M = 0.12;
const ALTURA_OJOS_M = 1.68;

/**
 * Un punto aproximado de la mano derecha, en espacio de mundo.
 *
 * En primera persona sale de la cámara, que ya trae la estatura, el agacharse y
 * el balanceo del paso: la llama se mece con la vista, como una antorcha de
 * verdad. En tercera la cámara está atrás y arriba, así que sale del cuerpo. Las
 * dos dan el mismo punto con el jugador quieto.
 *
 * La fase 3 lo reemplaza por el nudo real de la mano en `Cuerpo.js`.
 *
 * @param {object} jugador `posicion`, `giro`, `tercerPersona`, `alturaVisual`
 * @param {object} camara con `position`
 * @param {object} [salida] un `Vector3` o cualquier `{x,y,z}`
 */
export function posicionDeMano(jugador, camara, salida = { x: 0, y: 0, z: 0 }) {
  const g = jugador?.giro ?? 0;
  const s = Math.sin(g), c = Math.cos(g);
  // Mismo convenio que `Jugador._colocarCamara`: adelante es (-sen g, 0, -cos g)
  // y la derecha, (cos g, 0, -sen g).
  let x, y, z, adelante;
  if (!jugador?.tercerPersona && camara?.position) {
    x = camara.position.x;
    z = camara.position.z;
    const estatura = (jugador?.alturaOjos ?? ALTURA_OJOS_M) / ALTURA_OJOS_M;
    y = camara.position.y - (ALTURA_OJOS_M - MANO_ALTURA_M) * estatura
      * (jugador?.agachado ? 0.62 : 1);
    adelante = MANO_ADELANTE_M - OJOS_ADELANTE_M;
  } else {
    const p = jugador?.posicion ?? { x: 0, y: 0, z: 0 };
    const estatura = (jugador?.alturaOjos ?? ALTURA_OJOS_M) / ALTURA_OJOS_M;
    x = p.x;
    z = p.z;
    y = (jugador?.alturaVisual ?? p.y) + MANO_ALTURA_M * estatura * (jugador?.agachado ? 0.62 : 1);
    adelante = MANO_ADELANTE_M;
  }
  x += c * MANO_DERECHA_M - s * adelante;
  z += -s * MANO_DERECHA_M - c * adelante;
  if (typeof salida.set === 'function') salida.set(x, y, z);
  else { salida.x = x; salida.y = y; salida.z = z; }
  return salida;
}
