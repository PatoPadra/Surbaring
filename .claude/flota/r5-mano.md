# RONDA 5 · FASE 3 · `mano` — la herramienta en la mano

> Bitácora escrita mientras se trabaja. Archivos propios: `src/entities/Cuerpo.js`
> y `src/entities/Herramientas3D.js` (nuevo). El cableado de `main.js` va a
> `.claude/flota/pendiente-r5-mano.md`.

---

## Diagnóstico — leído en el código antes de escribir una línea

1. **La mano no se guarda y además no está donde parece.** `Cuerpo.js:178` crea
   `nudo(0.052 * a, piel, -0.28)` y lo cuelga del codo. El tercer argumento de
   `nudo()` traslada **la geometría**, no el objeto: la malla queda con
   `position = (0,0,0)`, o sea que su `matrixWorld` da el **codo**, 28 cm más
   arriba que la mano. Colgar la herramienta de esa malla la pondría en el codo.
   → Hace falta un `Group` de verdad a `y = -0.28`.

2. **La cadena de materiales que hay que respetar para no compilar programas.**
   `main.js:590` pasa `(mat) => conCSM(csm, mat)` como `registrarMaterial`.
   `conCSM` (`main.js:990-1026`) reemplaza `onBeforeCompile` por un envoltorio
   anónimo **idéntico para todos** y define
   `customProgramCacheKey = () => "|"` cuando el material no traía inyección
   propia. O sea: **la clave de programa de un material del cuerpo no depende del
   color ni de la rugosidad**, sólo de los parámetros que three mira
   (`vertexColors`, `flatShading`, mapas, `side`, `receiveShadow`, tipo).
   → Si los materiales de las herramientas se crean con `this._material()` y no
   activan ninguna de esas banderas, **comparten programa con el cuerpo, que ya
   está compilado desde la carga**. Cero compilaciones al cambiar de herramienta,
   por construcción y no por suerte.
   Consecuencia obligada: **nada de `vertexColors`, nada de `flatShading`, nada
   de `receiveShadow`** (las mallas del cuerpo no lo activan), nada de mapas,
   `side` por defecto. `emissive` sí se puede: es un uniforme, no un `define`.

3. **`_limpiar()` no alcanza para lo cacheado.** `Cuerpo.js:269-274` libera
   `_materiales` y recorre `this.grupo` liberando geometrías. Un modelo de
   herramienta **cacheado y no colgado** no está en el grupo: se filtra.
   → El caché es por instancia y `_limpiar()` lo vacía a mano.

4. **El maniquí de `Personaje.js:221`** construye `new Cuerpo(borrador)` sin
   `registrarMaterial` y sin equipo. Todo el camino nuevo tiene que ser inerte
   con `enMano` en `null`.

5. **18 objetos con `ranura: "mano"`** (contados sobre `herramientas.json`):
   `lasca_rodado`, `lasca`, `raspador`, `cuchillo`, `hacha_piedra`, `azuela`,
   `pala_omoplato`, `maza_cuna`, `pico_asta`, `hacha_hierro`, `sierra`,
   `martillo`, `pico_hierro`, `pala_hierro`, `barreta`, `antorcha`,
   `candil_grasa`, `ahumador`.

6. **CSM tiene 4 cascadas** (`main.js:144-146`). Cada malla con `castShadow`
   se dibuja hasta 4 veces más en el pase de sombras. Está anotado abajo, en
   «Presupuesto», con el número.

---

## Decisiones de forma

- **Espacio del modelo:** origen en el puño, **+Y hacia la parte que trabaja**.
  Así el mismo montaje en la mano sirve para las dieciocho.
- **A lo sumo dos materiales por objeto**, que es el presupuesto de dibujos.
  Las piezas del mismo material se **fusionan en una sola geometría**
  (`mergeGeometries`), así un hacha son dos mallas y no seis.
- El **tiento** de las ataduras va con el material del mango: es cuero sobre
  madera, dos pardos del mismo valor, y meterlo como tercer material costaba un
  dibujo entero por una banda de dos centímetros.

---

## Hecho

**`src/entities/Herramientas3D.js` (nuevo, los dieciocho modelos).**
- `IDS_MANO` (`:43`) y `PALETA` (`:57`) — nueve tintas; sólo `llama` es emisiva.
- Piezas: `poner` (`:80`), `tubo`, `prisma`, `pico`, `canto`, **`hoja` (`:126`)**
  y `atadura`.
- `MONTAJES` (`:156`) — cinco poses: `cabo`, `largo`, `corto`, `cuenco`, `tea`.
- `MODELOS` — las dieciocho recetas, cada una con sus piezas por material.
- `construirHerramienta(id, tinta)` — fusiona por material, arma el grupo, cuelga
  el nudo de la punta y deja `triangulos`, `dibujos` y `punta`.
- `fusionar` normaliza el indexado antes de `mergeGeometries`:
  `OctahedronGeometry` viene sin índice y los torneados con índice, y mezclarlos
  hace fallar la fusión sin decir por qué.

**`src/entities/Cuerpo.js`.**
- `this.manos` (`:211`) — la mano pasa a ser un `Group` a `y = −0,28` del codo y
  la palma vuelve a nacer en su propio origen. **El dibujo es idéntico**: medido,
  la esfera queda a menos de 1e-9 m de donde estaba.
- `get/set enMano` (`:343`, `:345`) — escribir el mismo id corta en la primera
  línea.
- `puntoDeMano(salida)` (`:367`) — la punta del objeto si la declara, si no la
  mano.
- `_tinta` (`:388`) — la paleta, bajo demanda y por `this._material()`.
- `_colgar` (`:402`) y `_soltarHerramientas` (`:427`); `_limpiar` (`:321`) suelta
  las herramientas **antes** de recorrer el grupo, así el recorrido no repite
  nada y lo que está sólo en el caché no se filtra.
- `costoEnMano` (`:441`) y `dispose()` (`:554`), para el banco.
- Pose de carga (`:504`) y enderezado de la herramienta (`:518`).

**`.claude/flota/pendiente-r5-mano.md`** — el cableado de `main.js`: dos cambios,
`cuerpo.enMano` por cuadro y `cuerpo.puntoDeMano(enMano)` dentro de
`juntarLuces()`. `Luces.js` y `Personaje.js` no se tocan.

## Números medidos

`node --expose-gc .claude/flota/.tmp-mano/medir.mjs` → **86 aserciones, 0 rojas**.
`npx vite build` → 78 módulos, sin avisos nuevos.

### Triángulos y dibujos — presupuesto ≤ 900 y ≤ 2

| id | triángulos | dibujos | materiales | largo (m) | punta |
|---|---|---|---|---|---|
| `lasca_rodado` | 8 | 1 | 1 | 0,14 | — |
| `lasca` | 8 | 1 | 1 | 0,23 | — |
| `raspador` | 72 | 2 | 2 | 0,15 | — |
| `cuchillo` | 72 | 2 | 2 | 0,24 | — |
| `hacha_piedra` | 96 | 2 | 2 | 0,46 | — |
| `azuela` | 96 | 2 | 2 | 0,40 | — |
| `pala_omoplato` | **144** | 2 | 2 | 0,67 | — |
| `maza_cuna` | 92 | 2 | 2 | 0,40 | — |
| `pico_asta` | 58 | **1** | 1 | 0,51 | — |
| `hacha_hierro` | 60 | 2 | 2 | 0,56 | — |
| `sierra` | 128 | 2 | 2 | 0,47 | — |
| `martillo` | 76 | 2 | 2 | 0,35 | — |
| `pico_hierro` | 72 | 2 | 2 | 0,54 | — |
| `pala_hierro` | 84 | 2 | 2 | 0,68 | — |
| `barreta` | 52 | **1** | 1 | 0,77 | — |
| `antorcha` | 76 | 2 | 2 | 0,61 | 0,51 m |
| `candil_grasa` | 96 | 2 | 2 | 0,18 | 0,14 m |
| `ahumador` | 72 | 2 | 2 | 0,32 | — |

**El peor es la pala de omóplato con 144 triángulos: el 16 % del presupuesto.**
El peor en dibujos es 2, y tres objetos salen en 1. Contados por
`index.count / 3` sobre la geometría **ya fusionada**, que es la que va a la GPU.
El largo es la caja del modelo ya montado en la pose, no la geometría suelta.

**Los dibujos que esta tabla NO cuenta.** CSM tiene **4 cascadas**
(`main.js:144-146`) y las mallas llevan `castShadow`, igual que las treinta del
cuerpo: en el pase de sombras cada malla de herramienta se dibuja hasta cuatro
veces más. Se eligió proyectar sombra porque el cuerpo la proyecta y una
herramienta sin sombra al mediodía se despega de la mano. **Si se mide
`render.info.render.calls`, que suma los pases de sombra, el techo de 2 no da:
da hasta 10.** En el pase principal son 2, que es lo que dice el contrato.

### La mano, medida sobre el cuerpo animado (estatura 1,78, ancho 1,0)

| | brazo suelto | con algo en la mano |
|---|---|---|
| altura de la mano | 0,863 m | **0,965 m** |
| adelanto | — | **0,15 m** |
| punta de la antorcha | — | **(0,26 · 1,39 · −0,47)** |

- La mano cuelga **0,280 m** del codo. Antes de este cambio la matriz de mundo de
  la malla de la mano daba el **codo**: un hacha habría quedado en el antebrazo.
- Soltar la herramienta devuelve el brazo a la pose de siempre (< 1e-4 m).
- **Los dieciocho, a lo largo de un ciclo de paso completo (24 fases):** ninguno
  atraviesa el suelo —el más bajo es el pico de asta, a 0,81 m— y ninguno pasa
  por encima de la cabeza —el más alto es la barreta, a 1,69 m—. El único que
  rozaba el muslo era el canto rodado; se corrió la pose `corto` 2 cm adelante y
  quedó justo en el borde.
- La punta de la antorcha queda **0,43 m sobre el puño y 0,25 m adelante**, y
  gira con el cuerpo: es espacio de mundo, no de la cámara.

### Programas: cero compilaciones al cambiar de herramienta

Reproduciendo `conCSM` de `main.js:990-1026` sobre un `Cuerpo` de prueba: los
**6 materiales del torso y los 4 de las herramientas declaran UNA sola clave de
programa** —misma `customProgramCacheKey()`, mismo texto de `onBeforeCompile`,
mismos `defines` (`USE_CSM`, `CSM_CASCADES`, `CSM_FADE`), mismo tipo,
`vertexColors` y `flatShading` en falso, mismo `side`, `receiveShadow` en falso
en todas—. O sea que el programa **ya está compilado desde la carga**: equipar un
hacha por primera vez lo saca del caché de three y no compila nada.

*Esto se comprobó en Node, sin GPU: lo que se mide es que los parámetros que
entran en la clave coinciden, no la cuenta de `render.info.programs`. Esa la
puede medir el jefe en la vista previa, recorriendo los dieciocho.*

### Reservas por cuadro

200 000 cuadros de `enMano` + `actualizar()` + `puntoDeMano(salida)`, con el
recolector forzado antes y después: **107 kB en total, 0,55 bytes por cuadro**,
que es el ruido del montón. Colgar y descolgar tampoco reserva: el modelo se
construye una vez por id y después se agrega y se saca del mismo nudo.

### Siluetas — comparando la caja de CADA PIEZA, no la del objeto entero

| par | difiere en |
|---|---|
| hacha de piedra / azuela | **55 %** |
| hacha de piedra / hacha de hierro | 30 % |
| hacha de piedra / pico de asta | 100 % |
| martillo / pico | 57 % |
| sierra / barreta | 100 % |
| pala de hierro / pala de omóplato | 56 % |
| lasca / lasca de rodado | 39 % |
| candil / ahumador | 63 % |

## Dos defectos que encontró la medición, y que la lectura no veía

1. **Las hojas salían torcidas 45°, y el hacha y la azuela eran el mismo
   objeto.** `poner()` compone `T·R·S`: **achata antes de girar**. Las hojas se
   construían con `ex: 0.40` y `ry: Math.PI/4` en la misma llamada, así que el
   achatado iba en X y después se lo giraba 45°: rombos torcidos en vez de hojas
   planas. Las cajas del hacha y de la azuela daban un **6 %** de diferencia; con
   una primera corrección de forma, 21 %. Con `hoja()` —gira la geometría
   primero, achata después— dan **55 %**. Mirando el archivo, las dos líneas
   parecían correctas: lo encontró la comparación de siluetas.
2. **La herramienta se paseaba del muslo al hombro con cada paso.** La mano
   hereda el doblez del codo, que en la pose de carga vale 0,84 rad: la punta de
   la antorcha quedaba **0,20 m detrás del puño**, apuntando hacia atrás. Ahora
   la inclinación del montaje está escrita en el espacio del **cuerpo** y
   `actualizar()` le descuenta el hombro y el codo (`Cuerpo.js:518`).

## Y un defecto del banco propio, por si se repite

La primera corrida daba seis rojos que no eran del código: el banco tomaba la
posición de la mano **antes de llamar a `actualizar()`**, con los codos sin
doblar, y después comparaba contra ella. `actualizar()` pone el codo en 0,28 rad
y la mano sube 1,3 cm. **Hay que animar antes de medir un esqueleto**, y no
guardar una posición de referencia que el cuadro siguiente invalida.

## Decisiones tomadas

1. **Una pose de carga.** Con el brazo suelto la mano queda a 0,86 m y pegada al
   muslo: una barreta de noventa centímetros barre el suelo. Con algo en la mano
   el antebrazo sube, el hombro casi deja de bracear y el brazo se abre 0,05 rad;
   la mano pasa a 0,965 m y 0,15 m adelante. Se suaviza en un cuarto de segundo y
   con la mano vacía el término vale exactamente cero. **Es lo único que cambia
   de la animación de siempre**, y sólo cuando hay algo colgado.
2. **El tiento va con el material del mango.** Tercer material = tercer dibujo,
   por una banda de dos centímetros.
3. **La llama es emisiva** (`#ff7a22` a 1,5). Sin eso, de noche la antorcha
   ilumina el suelo y ella misma se ve negra. No cuesta un programa: `emissive`
   es un uniforme, no un `define`.
4. **El caché es por instancia.** Uno de módulo quedaría apuntando a geometrías
   muertas apenas alguien cambie de peinado, porque `aplicar()` libera todo.
5. **`castShadow` sí, `receiveShadow` no.** El primero porque el cuerpo la
   proyecta; el segundo porque entra en la clave del programa y las mallas del
   cuerpo lo tienen apagado.
6. **`dispose()` además de `destruir()`.** El contrato lo nombra así; es un alias.

## Del contrato, lo que no se pudo cumplir tal cual

- **«≤ 2 dibujos más por cuadro»** se cumple en el pase principal. **En el pase
  de sombras no**: con `castShadow` y 4 cascadas son hasta 8 dibujos más. La
  alternativa era que la herramienta no proyectara sombra, y eso la despega de la
  mano al mediodía. Queda declarado para que se mida sabiendo qué cuenta.
- **«≤ +0,3 ms a Baja 1024×576, alternado en tres rondas»** no se puede medir
  desde acá: **este agente no tiene navegador ni GPU**. Lo que sí queda medido es
  lo que entra en ese costo: 144 triángulos en el peor caso y 2 dibujos.
- **«Cambiar de herramienta no compila ningún programa»** queda demostrado por
  construcción y por comparación de claves en Node, no por
  `render.info.programs.length`, que necesita GPU.

## Siguiente — para el jefe

1. Aplicar `pendiente-r5-mano.md` (dos cambios en `main.js`).
2. Medir en la vista previa: programas al recorrer los dieciocho,
   `render.info.render.calls` y el costo por cuadro en tercera persona.
3. Capturas: tercera persona con hacha, con barreta y con antorcha de noche —la
   `r5f1-noche-antorcha-3p` de la fase 1 dejaba el cuerpo como silueta negra y
   ahora debería verse la tea— y **una de primera persona**, que es donde la
   herramienta puede estorbar.

## Descartado

- **`vertexColors` con un solo material compartido para las dieciocho.** Era un
  dibujo por objeto en vez de dos, y un material único para todo. Se descartó
  porque `USE_COLOR` cambia la clave del programa: el material no comparte
  programa con el cuerpo y **la primera vez que se equipa una herramienta
  compila un programa nuevo**, que es exactamente lo que el contrato prohíbe.
  No hay forma de precompilarlo desde `Cuerpo.js`: con `enMano` en `null` al
  cargar, no hay malla que compilar, y una malla invisible three no la compila.
- **`flatShading` en las herramientas.** Se ve mejor en objetos facetados, pero
  `FLAT_SHADED` es otra clave de programa. Mismo motivo.

---

# AGREGADO A LA FASE 3 — el personaje, 11/9/2026

Encargo corto del jefe con la fase 3 ya cerrada: «mejorá el personaje, que quedó
atrás del resto del juego». **No hay banco escrito de antemano ni falsador**; la
red es el banco de la fase 3 y mi propio `medir.mjs`, que sigue en **86
aserciones, 0 rojas**.

## Lo primero fue sacar dibujos, y eso pagó todo lo demás

La animación de este archivo es **por transformación de nudo**: el codo gira y lo
que cuelga de él lo acompaña. Entonces fusionar las piezas *dentro* de cada nudo
no cambia un solo pixel y saca dibujos. `armar(nudo, piezas)` (`Cuerpo.js:144`)
cuelga **una sola malla por material** y es lo único que hacía falta para que la
cabeza dejara de ser siete mallas y el pie cuatro.

**Con 12 dibujos de crédito en el bolsillo, el detalle se pagó solo.**

| zona (un lado) | tri antes | tri ahora | mallas antes | mallas ahora |
|---|---|---|---|---|
| torso | 120 | 448 | 3 | 3 |
| cabeza | 550 | 1558 | **7** | **3** |
| hombro | 140 | 220 | **2** | **1** |
| codo | 140 | 180 | 2 | 2 |
| mano | 100 | 556 | 1 | 1 |
| muslo | 140 | 220 | **2** | **1** |
| rodilla (pierna + pie) | 388 | 424 | **4** | **2** |
| **CUERPO ENTERO** | **2486** | **5206** | **32** | **20** |

- **Triángulos: 5206**, tope 7500 → **69 % del presupuesto**.
- **Dibujos: 20**, tope 32 → **doce menos, un 37 % abajo**. La mejora más barata
  del cuadro, y no depende de la GPU.
- **Materiales: 6 → 6.** Ninguno nuevo; **cero color por vértice**, que estaba
  permitido pero habría roto la clave de programa compartida con las
  herramientas (`USE_COLOR`), y con ella la garantía de «cambiar de herramienta
  no compila nada». El banco lo verifica: sigue dando **una sola clave**.
- Medido con los cinco peinados: de 5192 (`rapado`) a 5346 (`recogido`).

## Qué cambió, con archivo:línea

**Herramientas nuevas** — `poner` (`:73`), **`torneado`** (`:92`), `bola`
(`:100`), `capsula` (`:110`), **`moldear`** (`:121`), **`armar`** (`:144`).
Desaparecen `hueso()` y `nudo()`, que devolvían mallas sueltas.

1. **Torso** (`:247`). Eran tres conos rectos apilados. Ahora son tres volúmenes
   de revolución que **comparten radio en las junturas**, así que el torso es una
   superficie continua: se ensancha en el pecho (0,212·a), entra en la cintura
   (0,180) y vuelve a abrirse en la cadera. Arriba cierra en un canesú que
   envuelve el nacimiento del cuello y **termina por dentro del cuello** (0,060
   contra 0,069 del cuello), así que no queda hueco. La cadera se achata menos
   que el pecho —0,74 contra 0,66— porque una cadera es más redonda.
2. **Cabeza y cuello** (`_rostro`, `:396`). Cráneo de 16×12 **moldeado**
   (`:408`): occipucio hacia atrás, frente aplanada un 12 %, sienes angostadas
   arriba y base estrechada hacia la mandíbula. Y lo que no había: **arco
   superciliar, pómulos, mentón, dorso y punta de nariz, orejas inclinadas, y
   ojos, cejas y boca**. Los ojos son el rasgo que a cuatro metros convierte una
   figura en alguien, y no había ninguno.
3. **Hombros y brazos** (`:283`). El brazo pasa de cono recto a perfil de cinco
   puntos: hombro 0,064 → bíceps 0,068 → codo 0,050. El antebrazo, igual.
   Un cono recto se lee como un caño, y era lo que más delataba al maniquí.
4. **Manos** (`:315`). Eran una esfera achatada. Ahora palma, mitón de dedos y
   **pulgar, que va para el lado que corresponde en cada mano**: medido, 17,7 cm
   de largo, contra los 19 de una mano real.
5. **Pies** (`:355`). Era una cápsula acostada de **21,9 cm**: un salamín. Ahora
   talón, planta, empeine, puntera y caña, **28,1 cm** —un pie de alguien de
   1,78 m mide 26, y con bota 28—, apoyando en la misma cota de siempre
   (y = −0,467 del nudo de la rodilla, que es lo que deja al cuerpo parado en 0).
6. **Pelo** (`:473`). El casquete pasa a ser media esfera cortada por
   `thetaLength` y **moldeada con entradas**: el casquete entero y centrado de
   antes se leía como un casco. Y las cejas van siempre, también en el rapado.

## Lo que se comprobó que NO se rompió

`node --expose-gc .claude/flota/.tmp-mano/medir.mjs` → **86 verdes, 0 rojas**;
`npx vite build` pasa.

- `manos[]`, `enMano`, `puntoDeMano()`, la limpieza de `aplicar()` y `destruir()`,
  el maniquí de `Personaje.js` sin equipo y la animación por `fasePaso`.
- **Las herramientas caen exactamente donde caían.** El nudo de la mano no se
  movió (sigue a `y = −0,28` del codo), así que las poses no se tocaron: los
  dieciocho objetos dan la misma caja de mundo que antes del agregado, a lo largo
  del ciclo de paso completo.
- **Una sola clave de programa** para los 6 materiales del cuerpo y los 4 de las
  herramientas, pasando por `conCSM`.
- **Cero reservas por cuadro** (200 000 cuadros, dentro del ruido del montón).
- **Estatura total: 1,778 m** para `estatura = 1,78`, apoyando en y = 0,013. Las
  proporciones siguen saliendo de `aspecto.estatura` por la escala del grupo, y
  de `anchoCuerpo` por el radio.

## Una aserción propia que hubo que reescribir, y por qué

`medir.mjs` comprobaba «la palma conserva la escala de siempre» (0,85 × 1,1 ×
0,7). **Esa aserción medía la implementación, no el efecto**, y con la mano nueva
—una malla fusionada— pasó a ser falsa sin que nada estuviera mal. Se reemplazó
por tres que sí miden el efecto: que cada mano sea **una** malla, que mida entre
13 y 22 cm, y que **el pulgar la haga asimétrica y al revés en cada lado**.

## Decisiones

1. **Nada de color por vértice**, aunque estaba permitido: `USE_COLOR` cambia la
   clave del programa y rompe el reparto con las herramientas. Con 6 materiales y
   fusión por nudo no hizo falta.
2. **Los ojos y la boca usan el pardo de las botas** (`0x2e2620`). Es el único
   oscuro de la paleta y no había presupuesto para un material nuevo. Cuesta un
   dibujo en el nudo de la cabeza, y en primera persona ni se dibuja: la cabeza
   se apaga entera.
3. **Las cejas van con el pelo**, así que **no cuestan ningún dibujo**: se
   fusionan con el casquete, y además es el color correcto.
4. **El radio de un torneado nunca llega a cero exacto** (`Cuerpo.js:92`): un
   vértice de radio 0 deja la normal indefinida y se ve una mancha negra.
5. **Guarda en `armar()`** (`:149`): `mergeGeometries` devuelve `null` y sólo
   escribe en consola si las piezas no coinciden en atributos o en indexado. Sin
   la guarda el defecto aparece mucho después, como una malla sin geometría.

## Lo que queda para mirar en pantalla, que yo no puedo ver

- **La cara**. Los ojos se corrieron de z = −0,086 a −0,080 porque medido sobre
  el elipsoide ya moldeado sobresalían 6 mm y quedaban saltones; el resto de la
  cara está puesto con la misma cuenta, pero **una cara se juzga mirándola**.
- **El coste por cuadro.** El cuerpo pasó de 2486 a 5206 triángulos —el doble—
  pero de 32 a 20 dibujos. En la HD 4000, a estos tamaños, **los dibujos suelen
  pesar más que los triángulos**, así que lo más probable es que el cuadro mejore;
  hay que medirlo. Y son 20 dibujos × 4 cascadas en el pase de sombras, contra 32.
