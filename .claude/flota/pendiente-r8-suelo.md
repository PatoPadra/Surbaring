# Pendiente de `suelo` (ronda 8, fase 3) — para el coordinador

## 1 · Cableado: no hace falta ninguno para que ande

`Terreno` pide las capas en su constructor (`cargarSuelo()`, sin esperarla, igual que
`Fauna` con el atlas), y el terreno y la piedra del sotobosque enganchan los mismos
uniformes de `src/util/suelo.js` (`uniformesSuelo`). Cuando la carga termina cambia
el valor de los uniformes y nada más: no hay que tocar `main.js` para que el suelo
se vea.

## 2 · Recomendado: subir las texturas en la pantalla de carga

Sin esto, las dos texturas de capas (4 MB cada una, más la generación de mipmaps) se
suben en el primer cuadro en que se dibuja el terreno después de que llegaron: un
tirón único de unas decenas de milisegundos, que puede caer ya jugando, y los
primeros cuadros pueden salir con el ruido de antes si los PNG tardan. Son ocho PNG
locales (5,5 MB en disco); el decodificado en Node tarda ~0,4 s con la importación
de three incluida.

En `src/main.js`, justo antes de `progreso(1, 'Listo.');` (hoy línea 683):

```js
  // Las capas del suelo horneado: Terreno ya las pidió en su constructor; acá se
  // espera la carga y se suben a la placa mientras se ve la pantalla de carga,
  // para que el primer paso del jugador no pague la subida ni los mipmaps.
  // Si no llegan, `disponible` es false y el suelo sigue con el ruido.
  {
    const suelo = await cargarSuelo();
    if (suelo.disponible) { render.initTexture(suelo.albedo); render.initTexture(suelo.normal); }
  }
```

y arriba, con los demás imports:

```js
import { cargarSuelo } from './util/suelo.js';
```

`render.initTexture` sube una `DataArrayTexture` en three 0.169
(`WebGLRenderer.js:2794`, rama `isDataArrayTexture`). No compila nada.

Opcional, en `package.json`, el atajo del horno como el de la fase 1:
`"hornear-suelo": "node tools/hornear-suelo.mjs"`.

## 3 · Un defecto que encontré y NO arreglé: la normal del terreno está en el espacio equivocado

**Qué es.** En `<normal_fragment_begin>` el terreno arma `normal` a partir de
`gNormalDEM`, que es la normal del DEM **en coordenadas de mundo** (sale de
`uTexNormal`), y se la pasa así a la iluminación de three. Pero three ilumina en
**espacio de vista**: `geometryNormal = normal` en `lights_fragment_begin`, y las
direcciones de las luces vienen transformadas por `viewMatrix`
(`WebGLLights.setupView`). Así desde el prototipo (`6035732`). La luz del terreno
depende de hacia dónde mira la cámara.

**La cuenta, en las capturas de la base.** 12/2/2025 a las 12:00 en el Parque, el
sol está a 52° de elevación, rumbo 53°; la cámara, a rumbo 200° y −35°. La luz en
espacio de vista es (−0,335; 0,351; 0,875). El suelo llano recibe
N·L = 0,351 donde debería recibir sen 52° = 0,789: **2,25 veces menos sol
directo mirando al suelo** con el sol a la espalda, y más de lo debido con el sol de
frente. A −8° el error es chico (0,710 contra 0,789) y a 0° desaparece en suelo
llano, por eso nadie lo vio: la paleta se calibró mirando al frente. En laderas el
error depende también del rumbo.

**Por qué no lo arreglé.** No es del contrato, cambia la luz de todo el terreno, y
rompe por construcción la guarda de S2 (brillo ±10 %), que se midió con el defecto
puesto: mirando al suelo a −35° el sol directo subiría ×2,25. Tiene que ser un
cambio propio, medido y visto por el dueño.

**El arreglo es una línea**, al final de la sección de la normal, antes de
`vec3 nonPerturbedNormal = normal;`:

```glsl
        normal = normalize((viewMatrix * vec4(normal, 0.0)).xyz);
```

Todo lo que suma relieve a la normal (el DEM fino, el ruido f2/f3, y ahora la normal
horneada del suelo) está escrito en el marco del mundo, así que con esa línea queda
bien de una vez. Hasta entonces, la normal horneada se ilumina con la misma luz
torcida que el resto: mirando al suelo el sol entra como si estuviera a unos 20°
sobre el horizonte y los cantos de las piedritas se marcan más de lo que deberían.

## 4 · Los avisos de `lint-shader`

`lint-shader` da cero errores. Los avisos de «se declara 2 vez/veces y nadie lo
lee» sobre `uSuelo*` en `Sotobosque.js` (y antes en `Terreno.js`) son falsos: esos
uniformes están definidos en `src/util/suelo.js` y el lint sólo cuenta las menciones
dentro del archivo que revisa. En `Terreno.js` los nombro en el comentario de la
tabla de uniformes porque ahí sirve para leer el archivo; en `Sotobosque.js` no, y
el aviso queda.

Y un cambio de forma que hace falta saber: en `Sotobosque.js` el GLSL de la piedra
son constantes aparte (`PIEDRA_VERT_CABECERA`, `PIEDRA_VERT`, `PIEDRA_FRAG_CABECERA`,
`PIEDRA_COLOR`) y no plantillas anidadas, porque el separador de literales del lint
no entiende el anidado: con las declaraciones adentro de un `${esPiedra ? `…` : ''}`
daba seis errores de «se usa y NO está declarado» sobre un shader que sí las
declaraba.

---

# Fase 3b — la normal del terreno, en el marco de la cámara

## Lo que hice

Una línea y sus comentarios, sólo en el reemplazo de `<normal_fragment_begin>`
(`Terreno.js`, los tres cambios caen entre las líneas 843 y 944, que es ese
reemplazo):

```glsl
        normal = normalize(mat3(viewMatrix) * normal);
        vec3 nonPerturbedNormal = normal;
```

después del último relieve (la normal horneada) y justo antes de
`nonPerturbedNormal`. Todo lo de arriba queda como estaba y en el marco del mundo:
`gNormalDEM`, el DEM fino, `f2` y `f3` (que además eligen sus planos triplanares con
`normal`, y por eso tienen que verla en el mundo) y la normal horneada.

`mat3(viewMatrix)` y no `normalMatrix`: el terreno no tiene transformación propia, así
que es la misma matriz, pero **`normalMatrix` no existe en el fragmento**. three la
declara sólo en el prefijo del vértice (`WebGLProgram.js:666`; el del fragmento, `:828`,
trae `viewMatrix` y no ella), y en el fragmento sólo aparece bajo
`USE_NORMALMAP_OBJECTSPACE`, que el terreno no tiene.

Corrido acá:

- `BANCO_SECCIONES=marco,shader node .claude/flota/banco-r8-fase3b.mjs`: **2/2**, las
  ocho aserciones del marco verdes («pasa en 2597; el último relieve en 2352»).
- `node .claude/flota/banco-r8-fase3b.falsar.mjs`: **lo vio 9/9, controles 3 verdes**.
- `lint-shader` sobre los seis módulos: sin errores. `vite build`: limpio.
- La regresión: ver al final.

## Lo que predigo para B2 a B5, con la cuenta

Las tres cuentas de luz salen del mismo modelo en CPU que usé en la fase 3
(`simular.mjs` del scratchpad: suelo llano, cámara del banco, LOD trilineal, módulo y
normal horneada como el shader, ACES y sRGB), con el sol que da `posicionSolar` del
juego para la fecha del banco: **52,3° de altura, rumbo 52,8°**. El ambiente, relativo
al sol, no lo sé: lo acoté entre 0,26 y 0,8 y lo calibré contra lo que mediste. El
modelo da, mirando al suelo con el sol a la espalda, +31 a +34 % (bosque, estepa) con
0,8 y +57 a +62 % con 0,26; vos mediste +35 a +40 %. **El ambiente anda cerca de 0,8**,
y con ése van los números de abajo.

**B2 · el giro: pasa holgado.** Mirando derecho abajo y girando sobre el eje, con la
normal en el marco de la cámara, todo lo que entra a la luz gira junto: la normal, la
dirección de vista y las de las luces, así que N·L, N·V y N·H no cambian. Lo demás que
depende de la cámara es invariante a giros de 90° sobre un lienzo cuadrado par: el LOD
del suelo toma el máximo de las dos derivadas (dFdx y dFdy se intercambian);
`geometryRoughness` toma el máximo sobre las tres componentes de las derivadas de la
normal (se permutan); la distancia a la cámara y el morphing son los mismos, y los
píxeles de un giro de 90° en 512×512 caen exactamente sobre píxeles. Queda el dithering
(±0,5 niveles según `gl_FragCoord`) y el ajuste de las cascadas del CSM, que se encuadra
con el frustum y se corre al girarlo, pero con la vegetación apagada no hay nada que
haga sombra en el centro. **Predigo el centro a menos de 0,5 % y la diferencia media a
menos de 0,6 niveles**, contra umbrales de 2 % y 1,5.

**B3 · la vuelta: pasa, con el bosque como el más justo.** El difuso no cambia; el
especular sí. Con la cuenta de three (`BRDF_GGX`: F de Schlick con F0 = 0,04, V de
Smith correlacionado, D de GGX, α = rugosidad²), en los cuatro rumbos del banco:

| punto llano | rugosidad que ve el shader | cambio (lineal), ambiente 0,8 · 0,26 |
|---|---|---|
| bosque (hojarasca) | **0,827** | **9,0 % · 13,0 %** |
| estepa | 0,935 | 0,9 % · 1,4 % |
| pedregal (acarreo) | 0,875 | 1,8 % · 2,7 % |

La cuenta del contrato («≲ 15 % con la rugosidad 0,94») supone la rugosidad plana del
terreno, y desde la fase 3 la da la textura donde manda. La hojarasca es la más lisa
(la hoja de coihue es coriácea y brilla: 0,72 en el horno), y a 12 m la vista lee el
mip 5 (LOD de 3,7 más el sesgo de 1,2 de esa distancia), donde la rugosidad ya es la
media de la capa: 0,827. Con 0,94 el bosque daría 2,4 a 3,5 %. Queda bajo el 20 %, y
mostrado en pantalla un poco menos, porque la curva tonal en el bosque oscuro tiene
pendiente ~1 y no más.

**B4 · lo que se ve.**

- *Al frente (−8°), suelo llano:* la luz que el suelo recibía era la de un sol a
  sen⁻¹(0,710) contra sen⁻¹(0,789) el de verdad. **+4 a +5 %** con ambiente 0,8 (el
  modelo da +5,0 / +4,6 / +3,7, cercana y del medio iguales), **+6 a +8 %** con 0,26.
  En laderas depende de hacia dónde miran contra el rumbo de la cámara: tu experimento
  con la misma línea dio +2 a +11 %. Dentro del ±15 %.
- *Mirando al suelo (se informa):* +31 a +34 % en bosque y estepa y +21 % en el
  pedregal, con ambiente 0,8.
- *La guarda, textura contra paleta sola, con la luz derecha:* acá está el único
  número apretado.

| lugar | modelo, luz de antes | modelo, luz derecha | cambio | medido antes | **predicho** |
|---|---|---|---|---|---|
| bosque | −2,9 % | −3,0 % | ≈ 0 | +2,1 % | **≈ +2 %** |
| estepa | −1,5 % | −1,7 % | −0,2 | −0,4 % | **≈ −0,6 %** |
| pedregal | −2,7 / −5,1 % | −6,3 / −9,2 % | **−3,6 a −4,1** | −4,8 % | **−8,4 a −8,9 %** |

  El modelo reproduce bien el pedregal medido (−5,1 contra −4,8 con ambiente 0,26) y
  mal el bosque (no tiene especular, y la hoja de coihue brilla); por eso predigo
  **cambios** y los sumo a lo medido, no números absolutos.

  **Por qué baja el pedregal:** el acarreo tiene la normal más empinada de las cuatro
  capas (bloques de canto biselado). Con el sol casi arriba, la media de N·L sobre
  una normal inclinada al azar es L_y × E[cos θ], menor que la de un suelo plano. Con
  la luz de antes el sol entraba rasante (L_y = 0,35, componente horizontal 0,94):
  la mitad de las caras quedaba en 0, recortada, y la otra mitad ganaba mucho, y eso
  compensaba. No lo toqué (no se compensa brillo, dice el encargo). **Si hiciera falta
  margen:** la normal horneada entra por `incl = gSueloRelieve * gSueloPeso` en este
  mismo reemplazo. Bajarla a 0,8 baja el oscurecimiento con el cuadrado, a 0,64 veces:
  unos −7 %. Pero es tocar cuánto relieve tiene el pedregal, y lo decide el ojo.

**B5 · sin costo, sin compilar.** Son una matriz 3×3 por vector y una normalización
por píxel de terreno: unas 15 operaciones, contra varios cientos del fragmento
del terreno. Como cota: 590 mil píxeles × 15 = 9 millones de operaciones, **menos de
0,1 ms** en la HD 4000 aun suponiendo que no se solapen con las lecturas. Compilar:
la línea es parte del texto del programa desde la carga, no hay `#define` ni clave de
caché que cambie, así que **una segunda pasada no compila nada**.

## Lo que anoté, sin arreglar

**1 · Probable: el terreno no recibe ninguna sombra direccional.** Está en el
**vértice** del terreno, fuera de lo mío. La geometría lleva el atributo `normal`
entero en cero (`Terreno.js`, `_construirMalla`: `new Float32Array(total * 3).fill(0)`),
y three arma con él la corrección de sombra: `shadowmap_vertex` hace
`shadowWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix)`, que es
`normalize` de un vector cero. En D3D11 (Chrome en Windows va por ANGLE) eso es
0 × rsqrt(0) = NaN. Entonces `shadowWorldPosition` y las coordenadas de sombra son NaN,
la prueba de frustum de `getShadow` da falso con NaN, y la sombra vale 1: ni la de los
árboles ni la de nada. Indicio en una captura que ya tenías: `r8-base-medio-estepa-a.png`,
mediodía despejado, árboles a 10–40 m que sí proyectan (`Vegetacion.js:242`, alcance
240 × 1,6 = 384 m en Baja), con el sol del NE y la cámara al SSO, y ninguna mancha al pie
de ninguno. **A verificar en la placa**, por ejemplo mirando el pie de un árbol al sol.

- Arreglo posible, de una línea: en la inyección del vértice, reemplazar
  `#include <beginnormal_vertex>` por `vec3 objectNormal = vec3(0.0, 1.0, 0.0);`. Para
  el sesgo de sombra alcanza con la vertical.
- **Ojo con el costo:** si hoy la sombra es NaN, el terreno se saltea el filtrado de
  sombras (la rama de `frustumTest` no corre). Arreglarlo le suma al terreno el PCF de
  las cascadas en cada píxel, y va a costar milisegundos. Otra fase, medida aparte.

**2 · La antorcha y el fuego también se veían mal en el suelo, y esto los arregla.**
`Luces.js` escribe sus luces puntuales en el marco de la cámara (`escribir`, con
`matrixWorldInverse`) y las compara con `geometryNormal`. En el terreno, esa normal
estaba en el mundo, así que el círculo de luz de la antorcha en el piso cambiaba
según hacia dónde se mirara. Desde esta línea queda bien, y se va a ver distinto.

**3 · Revisé los demás y no tienen el defecto.**

- El agua ilumina a mano, todo en el mundo: normal, vista (`uCamara − vMundo`) y
  `uSol`. Es coherente.
- Los impostores de los árboles no usan normal: color del atlas por ambiente más sol,
  constantes.
- El follaje, la piedra y el resto del sotobosque toman la normal de la geometría por
  el camino de three. `vArriba` del sotobosque sí la pasa bien, con `viewMatrix`.
- La oclusión del posproceso saca la normal de las derivadas de pantalla de la
  posición en el marco de la cámara: es coherente.
- `nonPerturbedNormal` ahora está en la cámara. La usa `geometryRoughness`, que es
  invariante (máximo de derivadas), y el clearcoat, que el terreno no tiene.
- Busqué `normal_fragment_begin`, `geometryNormal`, `directionalLights[` y `vNormal`
  en todo `src/`: sólo el terreno reemplaza el chunk.

**4 · Al banco.**

- **El control «forma-normalMatrix» del falsador pasa una línea que no compila.** B1
  acepta `normal = normalize(normalMatrix * normal);`, pero en el fragmento del
  terreno `normalMatrix` no está declarada (ver arriba). El lint no la ve, porque el
  nombre no empieza con u o v mayúscula. El shader del terreno no enlazaría y el
  terreno desaparecería, sin error en la mitad Node; lo agarraría recién L1 en el
  navegador. Sacaría esa forma de `A_VISTA` o exigiría que la declare.
- **Mi error, para que conste:** en esta fase, queriendo abrir un PNG de `capturas/`
  con el lector de archivos, invoqué una vez la herramienta del panel del navegador.
  Fue una sola captura de pantalla del juego que tenías abierto, sin clics, teclas ni
  navegación. No cambió nada ni la usé como dato.

## La regresión

`BANCO_SIN_BUILD=1 BANCO_SECCIONES=marco,shader,regresion`: marco 8/8, shader 1/1. La
regresión da **9 de 10**: la ronda 7 y las fases 1 y 2 de ésta, verdes, y la fase 3 en
4/5. Esa única roja es la que anunciaste. Corrí la fase 3 sola con
`BANCO_F3_PREFIJO=r8-f3b` para ver qué cae, y cae **sólo** la sección 3, la imagen, por
«están las dos capturas (r8-f3b)» en los tres lugares y en la piedra. El horno (31), el
terreno (6), el piso (la huella de `Mundo.alturaEn`, intacta) y el shader dan verde.
