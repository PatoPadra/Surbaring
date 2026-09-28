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

---

# Fase 3c — que el terreno reciba sombras

## Primero, dónde le erré en la 3b, porque decide cómo predigo ahora

Al frente predije +4 a +5 % y midió +13,6 y +14,2 en el bosque. Mirando al suelo
predije +31 a +34 y midió +48 / +37 / +32. Las dos predicciones venían de calibrar el
ambiente de mi modelo en 0,8 del sol contra tu +35 a +40 %: lo que falló fue esa
calibración, y el modelo no tiene especular. La vuelta (predije 9 a 13 en el bosque y
dio 14,4) y la guarda del pedregal (−8,4 a −8,9, dio −7,4) cayeron cerca.

Por eso, en esta fase **no predigo con mi modelo**. El arreglo que hice es, byte por
byte, tu maqueta: el atributo `normal` en (0, 1, 0) en todos los vértices. La maqueta
está medida en el juego, y predigo con eso.

## Lo que hice

En `Terreno.js`, en `_construirMalla`, el atributo `normal` pasa de cero a (0, 1, 0) en
los 1221 vértices de la malla base (los del tablero y los de la falda), con un comentario
que dice por qué. Es un solo bloque, en las líneas 164 a 189. Nada más cambia: ni el
shader, ni la inyección del vértice, ni `Calidad.js`.

**Por qué en el dato y no en el vértice.** El defecto era el dato: una geometría que
declara normales de largo cero. Arreglándolo ahí:

- el vértice de three queda como es, y todo lo que lee `objectNormal` recibe algo
  válido: la sombra, y también `vNormal`, que hoy es NaN aunque el fragmento no lo use;
- el texto del programa no cambia, así que la clave de caché es la misma de la 3b y no
  hay nada nuevo que compilar;
- no cuesta nada: el atributo ya se subía y se leía; antes era cero, ahora es arriba.

**Por qué la vertical y no la normal del DEM, con la cuenta.** En el plano del sol, con
e la altura del sol, θ la pendiente de una ladera de cara al sol y b el sesgo normal
(0,22 · 2^i m en la cascada i; `main.js:179`), el punto que se busca en el mapa de sombra
es P + b·v:

- Lo que protege del acné es la distancia de ese punto al suelo medida hacia el sol:
  s = b·(n·v)/sen(e+θ). Con la vertical, b·cos θ/sen(e+θ); con la normal del DEM,
  b/sen(e+θ). **La vertical da cos θ de la protección: 0,91 a 25°, 0,87 a 30°.**
- Cuánto se corre la sombra sobre el suelo: la parte del corrimiento perpendicular al
  sol, dividida por sen(e+θ). Con la vertical, b·cos e/sen(e+θ); con la normal,
  b·cot(e+θ). Con el sol a 30° y una ladera de 25°: 1,06·b contra 0,70·b, o sea **23 cm
  contra 15 cm en la primera cascada** y 1,9 m contra 1,2 m en la cuarta, que cubre
  cientos de metros.
- La normal del DEM cuesta una lectura de textura por vértice, y además hay que saber
  dónde está el vértice antes de `<begin_vertex>`, que es donde hoy se calcula. Todo
  para ganar un 10 % de un margen que tu medición ya mostró de sobra (0 de 16.384).

**Corrido acá:**

- `BANCO_SECCIONES=vertice,shader`: **2/2**, con el atributo unitario en 1221 de 1221
  vértices.
- El falsador: **lo vio 4/4, controles 2 verdes**.
- `lint-shader` sobre los seis módulos: sin errores. `vite build`: limpio.
- La regresión: ver al final.

## Lo que predigo para S1 a S3

- **S1 · recibe: pasa.** La maqueta dio el terreno en 0,297 del cuadro contra 0,320 del
  plano (0,93, dentro del ±25 %), y 58 niveles de oscurecimiento contra 81 (0,72, sobre
  el mínimo de la mitad). Predigo esos mismos números, con el ruido de una carga a otra.
  Que el terreno se oscurezca menos niveles que el plano es de esperar: el oscurecimiento
  se mide en niveles de pantalla, y el terreno en el bosque es más oscuro que el plano
  de control, así que perder la misma fracción de luz directa le baja menos niveles.
- **S2 · sin acné: pasa.** La cuenta de arriba es la de la maqueta, y la maqueta midió 0
  de 16.384 al sol, con el sol a 14,7° y a 31,6° y desde 40 y 200 m.
- **S2b · el relieve: pasa.** Ojo con una cosa (ver abajo, punto 1): el instrumento
  prende el `castShadow` del terreno para medir, así que S2b mide lo que se vería en un
  preset donde el terreno proyecta.
- **S3 · costo: pasa, pero justo al frente.** El cambio es el mismo que la maqueta, que
  midió +0,9 ms al frente y +0,6 al suelo en la misma carga, contra un tope de +1,2.
  - Es el filtrado de las cascadas que el NaN se salteaba: cada píxel de terreno dentro
    del alcance de sombra paga ahora las muestras del PCF, y en la franja de fundido del
    CSM, las de dos cascadas.
  - Nada del vértice cambia de costo: el atributo se leía igual.
  - **El margen al frente es de 0,3 ms**, del mismo tamaño que la deriva que viste en
    la 3b (+0,6, +0,3, 0,0 en tres pares). Si el primer par da de más, van a hacer falta
    los pares alternados otra vez.

## Lo que anoté, sin arreglar

**1 · En Baja el relieve sigue sin dar sombra, y es a propósito.** `Calidad.js` pone
`terrenoProyecta: false` en Baja y en Mínima (el terreno no dibuja en el pase de
sombras: 7,7 ms según el comentario de `Calidad.js`). Con este arreglo, en Baja el suelo
recibe la sombra de los árboles y de las obras, pero no la de los cerros. S2b pasa
porque `r8-sombra.navegador.js` prende el `castShadow` del terreno mientras mide (líneas
63 y 64). No es un defecto; es una decisión de preset que ahora se va a notar, porque
antes el terreno no recibía nada y daba igual si proyectaba.

**2 · Las sombras de los árboles van a salir blandas en Baja.** El mapa de sombra de
Baja es de 512 píxeles y alcanza 240 m. La cuarta cascada, que cubre lo más lejano de
ese alcance, tiene texeles de decenas de centímetros, del orden del sesgo de esa
cascada (1,76 m), y la sombra de un árbol lejano va a verse como una mancha corrida. Es
lo que cuesta el preset; lo cuento para que no sorprenda al mirarlo.

**3 · Lo que arrastraba el NaN: nada más que la sombra.** Revisé en el vértice del
material de color qué más lee `objectNormal` o `transformedNormal`: el mismo
`shadowmap_vertex` y `vNormal`, que el fragmento reemplaza entero y no usa. El material
de profundidad (`_crearMaterialProfundidad`, el terreno cuando proyecta) no lee
normales.

## La regresión

`BANCO_SIN_BUILD=1 node --max-old-space-size=6144 .claude/flota/banco-r8-fase3c.mjs`:
**total 4/4**.

- El vértice: 1221 de 1221 unitarios.
- La regresión: **11 de 11**. La ronda 7, las fases 1 y 2, la 3 en 4/4 (horno, terreno,
  piso y shader) y la 3b en 2/2 (el marco sigue en su lugar).
- El shader: sin errores.
- `vite build` lo corrí aparte: limpio.
