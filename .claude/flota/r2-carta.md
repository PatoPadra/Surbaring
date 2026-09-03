# Bitácora — jefe `carta` (ronda 2)

Mapa, códice, exploración y relevamiento. Se escribe **a medida**, no al final.

Archivos propios: `src/ui/Mapa.js`, `src/ui/Codice.js`, `src/systems/Exploracion.js`,
`src/systems/Relevamiento.js`, y los nuevos bajo `src/systems/`.

## Reparto interno

Se lanzaron tres subagentes en paralelo —F1 zoom, F2 marcas, F3 árbol de
tecnologías— y **los tres murieron por el error 429 que cortó la sesión
entera**, igual que los de los otros dos jefes. No los detuvo nadie. Ninguno
alcanzó a escribir nada en disco: `git status` sólo mostraba el banco del
relieve, que lo escribió el jefe.

(Esto estuvo anotado mal —«el dueño los detuvo»— durante media hora. Se corrige
acá para que la próxima sesión no herede el error: **la muerte de un subagente
por límite de tokens se parece mucho a una cancelación, y no lo es**.)

Instrucción del dueño para esta ronda, textual: «de a 3 a la vez, volvé por las
más avanzadas e iterá así hasta terminar». O sea: **los tres jefes en paralelo,
ninguno despliega subagentes**. Así que los tres frentes los hace el jefe, en
serie. Sin subagentes no hay riesgo de pisarse y el contrato de integración que
se había armado entre F1 y F2 deja de hacer falta — pero **la separación entre
el modelo de hallazgos y el dibujo del mapa se sostiene igual**, porque sigue
siendo la forma correcta: el mapa dibuja, el sistema recuerda.

| Frente | Archivo |
|---|---|
| **F1** zoom y navegación | `src/ui/Mapa.js` |
| **F2** marcas (obras + recursos) | `src/systems/Hallazgos.js` (nuevo) |
| **F3** árbol de 48 tecnologías | `src/ui/Codice.js` |

---

## 1. Diagnóstico

### El costo del relieve, MEDIDO (no estimado)

Banco propio: `.claude/flota/r2-carta-relieve.mjs`. Corre en Node sin navegador
—`Mundo.cargar()` usa `fetch` y `createImageBitmap`, así que no se puede
importar— replicando **la aritmética exacta** de `alturaBaseEn`, `detalleEn`,
`factorDetalleEn` y `_construirDetalle` sobre el DEM de verdad
(`public/data/dem/alturas.r16`, 2048×2048 de 16 bits, 32 m/texel).

Lo único falseado es la máscara de agua, que viene de un PNG y queda en cero.
Eso hace el banco **pesimista**: sin agua, `factorDetalleEn` vale 1 en todos
lados y ningún píxel sale por el atajo del lago.

| dibujo | ×1 (102,4 m/px) | ×2 | ×4 | ×8 |
|---|---|---|---|---|
| **como está hoy** (5 alturas por píxel) | **149,6 ms** | 141,9 | 142,4 | 139,7 |
| **una sola pasada** (1 altura por píxel) | **53,3 ms** | 47,5 | 45,5 | 44,6 |

Tres conclusiones, y las tres mandan sobre el diseño del zoom:

1. **Abrir el mapa hoy cuesta ~150 ms**: casi cinco cuadros perdidos a 31,8 fps.
   No es una hipótesis del zoom, es un defecto que ya está en el juego.
2. **La pasada única da 2,8× y es el mismo dibujo.** Las alturas se leen una vez
   sobre una grilla de `lado+2`, y las pendientes salen por diferencia entre
   vecinos ya calculados. Diferencia contra el método actual: **16 canales de
   1.638.400 (0,001 %), peor diferencia 1 sobre 255.** Invisible.
3. **El costo no depende del nivel de zoom** (~140 ms constante): cambia la
   ventana, no la cantidad de píxeles. Así que una caché por nivel es viable:
   cada nivel nuevo cuesta ~45 ms, un tirón de un cuadro y medio.

### El techo honesto del zoom

El DEM tiene 32 m por texel. Con un lienzo de 640 px:

| zoom | m/px | texels por píxel | ventana |
|---|---|---|---|
| ×1 | 102,4 | 3,20 | 65,5 km (el mundo entero) |
| ×2 | 51,2 | 1,60 | 32,8 km |
| **×3,2** | **32,0** | **1,00** | **20,5 km** ← acá se acaba el relieve real |
| ×4 | 25,6 | 0,80 | 16,4 km |
| ×8 | 12,8 | 0,40 | 8,2 km |

Pasado ×3,2 el relieve que se agrega **no existe en el dato**: lo único que
queda por debajo es el campo de detalle de 1,9 m de amplitud, que es ruido
decorativo horneado para que el suelo no se vea liso a la altura de los ojos.
El archivo declara «si el mapa dice que hay un filo, hay un filo». Ampliar más
allá de ×3,2 dibujando relieve inventado rompe esa declaración.

Consecuencia de diseño: **se puede seguir ampliando más allá de ×3,2 para leer
las marcas, pero interpolando el relieve ya dibujado, no calculando relieve
nuevo** — y diciéndolo en la leyenda del pie.

Lo mismo vale para las curvas de nivel: a 102,4 m/px, curvas cada 200 m son
casi ruido de aliasing. El intervalo tiene que apretarse con el zoom, pero sólo
hasta donde el dato aguanta.

### Lo que `Mapa.js` es hoy

200 líneas. `LADO = 640` fijo, `_aPixel()` mapea el mundo entero al lienzo,
`_construirRelieve()` se cachea una sola vez y `dibujar()` apila cuatro capas:
relieve, velo de exploración (grilla de 256 escalada por el navegador),
lugares del códice, y la flecha del jugador. Sin zoom, sin arrastre, sin
marcas de obras y sin marcas de recursos.

`main.js:738` redibuja el mapa cuando la exploración suma 400 celdas nuevas.
`main.js:351` construye el mapa con `{mundo, jugador, tiempo, exploracion, codice}`:
**no tiene `construccion` ni nada de recursos**, así que hace falta cableado.

### Lo que se puede marcar, y lo que sería ruido

Leído contra el código, no contra la bitácora:

- **Obras**: `construccion.obras` es un array de `{obra, x, z, y, guardado, vence?}`
  ya público. `obra.categoria` es `efimera | campamento | uso_publico | permanente`.
  No hace falta pedirle nada al agente `juego`.
- **`Mineria.yacimientoEn(x,z)`** es una función pura de la posición, sin estado.
  Pero devuelve algo **en casi todos lados**: `ripio` con sólo `pend < 0,16 &&
  y < 1000`, y `tosca` como cajón de sastre con `pend < 0,30`. Marcar eso sería
  pintar el mapa entero. Los que sí son información son `arena` (banco de arena,
  pide orilla y pendiente baja), `pomez` (sobre 1.450 m) y la **chatarra**
  (`Mineria.hayChatarra`, sólo fuera del área núcleo, y con distribución fija
  por posición: el mismo lugar siempre da lo mismo).
- **Caña colihue** no es sotobosque: es una especie de `flora.json` con
  `tipo: "cana"`, sembrada por `Vegetacion.js`. Un cañaveral se detecta con
  `vegetacion.masCercana(pos, r)`, que ya corre cada cuadro dentro de
  `Recoleccion.quePuedoHacer()`.
- **Arcilla** no tiene yacimiento propio: sale de juntar la mata `piedra` del
  sotobosque con agua cerca (`Recoleccion.js:285`, 45 % de probabilidad). O sea
  que «dónde hay arcilla» es «orilla con piedras», y eso sí es marcable.

## 2. Hecho

### Bancos (los dos corren en Node, sin navegador)

- **`.claude/flota/r2-carta-relieve.mjs`** — banco del relieve contra el DEM
  real. Es lo que sostiene todo el diagnóstico de arriba.
- **`.claude/flota/r2-carta-mapa.mjs`** — banco de navegación. **Importa
  `src/ui/Mapa.js` de verdad** y le arma una instancia con
  `Object.create(Mapa.prototype)`, salteándose el constructor —que toca el
  DOM— pero corriendo los métodos reales. No es una copia de la lógica: si
  mañana alguien rompe la proyección, esto se entera. **18 de 18.**

### F1 — zoom y navegación del mapa · `src/ui/Mapa.js`

Reescrito de 200 a ~430 líneas. Cinco niveles de zoom, rueda hacia el cursor,
arrastre, doble clic para volver al parque entero.

| nivel | m/px | ventana | se construye a | curvas | texels/px |
|---|---|---|---|---|---|
| 0 | 102,4 | 65,5 km | 102,4 | 200 m | 3,20 |
| 1 | 51,2 | 32,8 km | 51,2 | 100 m | 1,60 |
| **2** | **32,0** | **20,5 km** | **32,0** | **50 m** | **1,00** ← el dato del DEM |
| 3 | 16,0 | 10,2 km | 32,0 | 50 m | 0,50 |
| 4 | 8,0 | 5,1 km | 32,0 | 50 m | 0,25 |

Lo que se hizo, y por qué:

- **Una sola lectura de altura por píxel.** Las alturas se muestrean sobre una
  grilla de `lado + 2` y el sombreado sale de restar vecinas ya calculadas.
  **~150 ms → ~50 ms**, con 1 de 255 de diferencia en el 0,001 % de los canales.
  Esto arregla un defecto que **ya estaba en el juego sin zoom**: abrir el mapa
  se comía casi cinco cuadros.
- **El mundo entero se dibuja en el ocio**, no la primera vez que se pulsa `M`.
  Los ~50 ms molestan mucho menos mientras uno camina que cuando acaba de pedir
  el mapa.
- **Dos capas de relieve**: el mundo entero de fondo —siempre cubre todo, así
  que arrastrando nunca aparece un hueco negro— y encima el recorte fino.
- **La reconstrucción es diferida (90 ms de quietud).** A cada muesca de rueda
  costaría 50 ms y el mapa iría a tres cuadros por segundo; mientras tanto se ve
  el dibujo anterior estirado, que es lo que hace cualquier mapa del mundo. Y si
  el recorte que hay ya cubre la ventana, no se rehace nada: arrastrar dentro de
  un recorte de 20 km es gratis.
- **Pasado el nivel 2 no se construye relieve nuevo**: se estira el de 32 m/px y
  **el pie lo dice en amarillo** («ampliado 4× sobre el dato: no hay más relieve
  que mostrar»). Ésa es la declaración del archivo tomada en serio.
- **El mapa lee `alturaBaseEn()` y no `alturaEn()`.** La diferencia es el ruido
  decorativo de 1,9 m y 64 m de período: a 8 m/px daría pendientes aparentes de
  0,24 y **dominaría el sombreado**, poniéndole a la carta una lija que el SRTM
  no tiene. Medido: no sale más barato (51 contra 46 ms), sale más honesto.
- **Curvas de nivel de ancho constante.** Antes la banda era fija en altura
  (±4 m), y eso da una línea cuyo grosor depende de la pendiente: **invisible en
  un filo** —donde 200 m de desnivel pasan en un píxel— y **un manchón en un
  mallín**. Ahora la banda se abre con el gradiente local y la línea mide ~1 px
  en los dos lados.
- **Escala gráfica dibujada dentro del lienzo**, porque el lienzo se muestra a
  `min(88vh, 92vw)` y una escala en metros por píxel mentiría al estirarse. Da
  entre 63 y 125 px en los cinco niveles.
- **El velo se cachea** contra `exploracion.version`: son 65.536 iteraciones y
  arrastrar redibuja a 60 por segundo.
- **El gancho de las marcas** (`this.hallazgos?.dibujar(...)`) queda puesto
  entre el velo y los topónimos: lo que no se conoce tapa las marcas, y los
  topónimos y el jugador no se pierden nunca de vista.

Verificado con `r2-carta-mapa.mjs`, **18 de 18**: la escalera es la declarada,
el zoom hacia el cursor deja el ancla fija al milímetro en tres posiciones
distintas, 40 empujones a los bordes no sacan la ventana del mundo (desborde
0,0e+0 m), al nivel 0 el centro queda clavado, `aPixel`/`aMundo` son inversas
exactas, y **el recorte del velo cae dentro de la grilla en las 25 vistas
extremas** — si se saliera, lo desconocido dejaría de tapar lo que corresponde.

### Exploración, de paso · `src/systems/Exploracion.js`

Tres cosas que aparecieron leyendo el archivo para el velo del mapa:

- **Un defecto de pérdida de datos.** La exploración se guardaba sólo al sumar
  400 celdas nuevas (`main.js:735`). `Partida` se protege con `beforeunload` y
  `visibilitychange`, pero guarda **su** clave, no ésta. **Medido: una caminata
  corta descubre 9 celdas.** Quien camina un rato y cierra la pestaña las pierde
  todas. Ahora `Exploracion` tiene sus propios dos oyentes y un `guardarSiHaceFalta()`.
- **`fraccionExplorada` recorría las 65.536 celdas cada vez que se leía** — al
  abrir el mapa, al abrir las opciones, al cerrar el año. Ahora es un contador
  que se lleva al día donde único cambia. Verificado contra el recorrido viejo:
  **6.578 = 6.578**.
- **Un testigo de versión**, que es lo que le permite al mapa no rehacer el velo
  en cada cuadro de un arrastre. Sube también cuando una celda **se afina** —de
  intuida a conocida de cerca—, no sólo cuando se descubre: contar sólo las
  nuevas dejaba el velo sin repintar mientras uno se acerca a lo que ya entrevió.
- Y `guardar()` armaba la cadena de 65.536 caracteres de a uno; ahora va por
  tandas de 8.192, porque `fromCharCode` con 65.536 argumentos revienta la pila
  en varios navegadores.

Verificado con `.claude/flota/r2-carta-exploracion.mjs`, **13 de 13**.

### F2 — marcas: obras y recursos vistos · `src/systems/Hallazgos.js` (nuevo)

Modelo de memoria propio, separado del dibujo: **el mapa dibuja, el sistema
recuerda**. Celdas de 128 m, máscara de bits por celda, `localStorage` con clave
versionada (`survibar.hallazgos.v1`), y los mismos dos oyentes de cierre que se
le agregaron a `Exploracion`.

**El alcance es 90 m, y ahí está toda la diferencia con `Exploracion`**, que
revela hasta 6 km desde un mirador. Desde una cumbre se ve la forma del valle;
no se ve si esa playa tiene arena. Si los hallazgos usaran el alcance de la
exploración, el mapa se llenaría solo y descubrir dejaría de significar algo.

**El banco corrigió mi propio diseño.** Barriendo el parque entero en celdas de
128 m con la `Mineria` y los `Limites` de verdad sobre el DEM de verdad —el
canal B de `alturas.png` decodificado con `zlib`, sin dependencias—:

| | | | |
|---|---|---|---|
| ripio | 16,6 % | **arena** | **0,4 %** |
| tosca | 20,0 % | **chatarra** | **7,5 %** |
| **pómez** | **22,8 %** | nada | 40,1 % |

La pómez había entrado al sistema por parecer un hallazgo —«caída volcánica que
se conserva en altura»— y **salió al medirla**: el 22,8 % del parque no es un
hallazgo, es una propiedad de la altura, la misma clase que el ripio y la tosca.
Eso lo enseña el Códice, no el mapa. Marcando sólo lo que quedó: **7,9 % del
parque contra 67,3 % si se marcara todo lo que devuelve `yacimientoEn()`, 8,5×
menos.**

De paso, el 0,4 % de la arena **explica una queja del dueño** («nunca vi
arena»): no es mala suerte, es que hay poca y está sólo en las orillas. Marcarla
es la marca de más valor del sistema. La chatarra se queda pese al 7,5 % porque
sólo existe fuera del área núcleo: marcarla **dibuja** el contraste que el
propio código declara —«en el área núcleo el bosque está limpio, y ésa es
justamente la diferencia»— en vez de contarlo.

Quedan cinco tipos: **arena, chatarra, arcilla, cañaveral, pedrero de altura**.
La arcilla y la obsidiana no tienen yacimiento propio —salen de juntar la mata
`piedra` con agua cerca o por encima de 1.500 m (`Recoleccion.js`)—, así que
«dónde hay arcilla» es «una orilla con piedras», y eso es lo que se anota.

Lectura visual: **todos los hallazgos del mismo color, distinguidos por forma**,
como en cualquier carta de verdad; seis colores convertirían el mapa en un
tablero. El único acento es el de las obras, que es lo propio. Doble trazo
—oscuro ancho debajo, claro fino encima— porque el relieve va del verde del
bosque al blanco de la nieve y un solo trazo se pierde contra alguno de los dos.
Las obras son **una X**, como la pidió el dueño, más grande para lo permanente y
lo de uso público. Por debajo de 32 m/px las marcas pasan a puntos agrupados por
casillero de 7 px: el parque entero con seiscientos glifos encima no es una
carta, es confeti. Y hay una **leyenda que sólo lista lo que ya se encontró**,
así los símbolos no son jeroglíficos y el índice se gana igual que las fichas.

Verificado con `.claude/flota/r2-carta-hallazgos.mjs`, **23 de 23** (eran 17 y
eran ciegas a 3 de los 5 tipos: ver «4 bis»), contra un lienzo de mentira que
registra cada trazo. Lo que más importa de esa tanda:
**sobre terreno desconocido no se dibuja ninguna marca** —el velo no se puede
burlar por atrás—, nada se dibuja fuera del lienzo en ninguna escala, de noche
se descubre menos que de día (11 contra 29) pero lo que se pisa se anota igual,
y un guardado de otro tamaño de mundo **se descarta en vez de dibujar marcas
corridas**: una carta que miente es peor que una carta vacía. Tras 30 km
caminados: 70 celdas marcadas, una cada 429 m, **0,6 KB** en almacenamiento.

Cableado en `.claude/flota/pendiente-r2-carta.md`. **Sin aplicarlo no se rompe
nada**: el mapa llama a las marcas con `?.` y sigue andando sin ellas.

### F3 — legibilidad del árbol de tecnologías · `src/ui/Codice.js`

**Son 48, no 47**, y el dataset está sano: ningún requisito apunta a una
tecnología inexistente y **no hay ciclos** (uno solo colgaría el panel entero al
abrirlo, porque el recorrido de la ruta es en posorden). 42 flechas de
dependencia, 6 eras, profundidad máxima 5 eslabones, reparto 7·12·9·7·6·7.

El diagnóstico contra el código: el panel agrupaba por era y tiraba las 48
fichas en una rejilla plana. Las dependencias aparecían **sólo** como una línea
de texto —«Antes: herrería colonial»— y **sólo cuando faltaban**. O sea que
faltaban las dos preguntas que uno le hace a un árbol de tecnologías:

1. **«¿Qué desbloquea esto?»** — no existía. El dataset guarda `requiere`, o sea
   las flechas hacia atrás; las de ida no las tenía nadie. Ahora se arma un
   índice inverso por repintado (verificado exacto: 42 de 42) y cada ficha dice
   **«Abre: …»**.
2. **«¿Qué me falta para llegar a X?»** — era un acertijo. Para saber qué pedía
   la herrería había que buscarla a mano entre 48 fichas de 6 eras, y lo que
   pedía ella, otra vez, hasta cinco veces. Ahora cada ficha trabada trae
   plegado **el plan completo, en el orden en que hay que hacerlo**, con el total
   de puntos de saber y los materiales de toda la cadena contra lo que hay en el
   bolso.

El número que muestra el tamaño del problema que había: **la ruta más larga es
la cámara trampa, 8 pasos, 246 puntos de saber y 17 materiales distintos** —
Herrería → Alambrado → Telégrafo → Radio de onda corta → Teodolito → Cartografía
de expedición → Cuerpo de guardaparques → Cámara trampa. Eso el jugador no tenía
forma de ver. (Son 8 pasos y no 5 porque la ruta junta **todas** las ramas, no
sólo la más profunda.)

Además:

- **Los nombres son botones**: clic y la vista salta a esa ficha y la resalta un
  momento. Sin el destello uno llega a una rejilla de fichas iguales y no sabe a
  cuál llegó. Si el filtro la estaba tapando, se limpia: es lo que el jugador
  quiso decir al hacer clic.
- **«Para aprender ahora»** arriba de todo, con lo que se puede desbloquear ya.
  Estaba repartido entre seis eras: había que recorrer el panel entero para
  descubrir que no faltaba nada.
- **Eslabón** en cada ficha, y dentro de cada era las fichas van ordenadas por
  eslabón: lo que se apoya en menos cosas, primero.
- El plan va en un `<details>` nativo y no en un panel aparte: se abre con el
  teclado, no se lleva el foco del buscador, y **su contenido sigue en el
  marcado aunque esté cerrado**, así que el filtro lo encuentra igual. Efecto
  colateral bueno y medido: buscar «obsidiana» ahora contesta **qué tecnologías
  la necesitan** (6 fichas), que antes no se podía preguntar.

Verificado con `.claude/flota/r2-carta-arbol.mjs`, **12 de 12**, contra el
`Codice` y los `Saberes` de verdad: toda ruta está en un orden ejecutable de
arriba a abajo (0 pasos fuera de orden sobre las 48), ninguna repite una
tecnología aunque dos ramas se crucen, la meta es siempre el último paso,
aprender un paso lo saca de la ruta (8 → 7), **los 202 enlaces tienen a dónde
llevar** y hay una ficha con ancla por cada una de las 48.

Costo: **10,1 ms** armar el marcado de la pestaña entera (108 KB), y se arma al
cambiar de pestaña, no por cuadro.

## 3. Siguiente

Los tres frentes están cerrados. Lo que queda es de otros:

- **Aplicar `.claude/flota/pendiente-r2-carta.md`** (coordinador). Sin eso el
  mapa anda con zoom pero sin marcas.
- **`src/ui/Opciones.js` no tiene dueño en esta ronda** y ahí va una línea para
  que las marcas se olviden al borrar la partida. Está en el pendiente.
- La caña colihue **no se siembra nunca** (`.slice(0, 26)` en `Vegetacion.js`,
  cae en el índice 32). Es del jefe `juego` y ya lo tiene. Mi tipo `canaveral`
  está escrito y probado; empieza a marcar solo el día que existan cañaverales.

## 4. Descartado

- **Importar `Mundo.js` en Node para medir.** `cargar()` usa `fetch` sobre rutas
  relativas y `createImageBitmap`: ninguno de los dos existe en Node. Replicar la
  aritmética contra el `.r16` de verdad da el mismo número y no pide navegador.
  (Para el banco de hallazgos sí hizo falta la máscara de agua, y ahí se
  decodificó el PNG a mano con `zlib` — 45 líneas, sin dependencias.)
- **Ampliar más allá de ×3,2 construyendo relieve nuevo.** Es lo que saldría
  gratis —el costo no depende del nivel— y es exactamente lo que rompe la
  declaración del archivo. Por debajo de 32 m/px no hay dato: sólo el ruido
  decorativo de 1,9 m, que a 8 m/px daría pendientes aparentes de 0,24 y
  **dominaría el sombreado**. Se estira el dibujo y se dice en el pie.
- **Marcar todo lo que devuelve `yacimientoEn()`.** Sale casi gratis y arruina
  el mapa: 67,3 % del parque contra 7,9 %. Medido, no supuesto.
- **Marcar la pómez.** Entró al diseño por parecer un hallazgo y salió al
  medirla: 22,8 % del parque. Ver F2.
- **Enganchar `Construccion.alCambiar` para redibujar al levantar una obra.** El
  jefe `juego` avisó que es una sola ranura y que está libre. No hizo falta:
  `Hallazgos.dibujar()` lee `construccion.obras` en el momento de dibujar. La
  ranura queda libre.
- **Un grafo con líneas para el árbol de tecnologías.** Con 48 nodos y 42
  flechas es un plato de fideos, y encima habría que dibujarlo en canvas o SVG y
  perdería el buscador, que filtra por texto del marcado. Las dependencias van
  **locales a cada ficha** —de dónde sale, qué abre, y el plan hacia la meta— y
  el salto con destello hace el recorrido. Un `<details>` nativo en vez de un
  panel propio, además, no le roba el foco al buscador.
- **Un tamaño de tile con margen para arrastrar sin reconstruir.** Se evaluó
  (896² = 2,25× el costo). No hace falta: a partir del nivel 3 el recorte se
  construye a 32 m/px y abarca 20,5 km contra una ventana de 5 a 10 km, así que
  ya sobra margen. Y el fondo del mundo entero garantiza que nunca haya hueco.

## 4 bis. Lo que encontró la revisión independiente, y cómo quedó

Una revisión externa (`.claude/flota/r2-revision-juego.md`) encontró tres
defectos míos. Los tres eran ciertos. Están arreglados y **el orden en que se
arreglaron importa**: primero el banco, después el código.

### D3 — el banco era ciego por construcción, y ése era el defecto de fondo

`r2-carta-hallazgos.mjs` construía `new Hallazgos({ mundo, mineria })` — **sin
`vegetacion` ni `sotobosque`**. Como `Hallazgos` los consultaba con
encadenamiento opcional, no tiraba ningún error: devolvía cero en silencio. El
banco declaraba «Todo bien» **sin haber ejercitado nunca 3 de los 5 tipos**.

Y lo peor: **el propio banco lo estaba imprimiendo** —«Por tipo: arena 0 ·
chatarra 70»— y lo leí como un renglón de adorno. Un cero en una columna que
debería tener números es un resultado.

Es la trampa n.º 3 de `ESTADO.md` —«el terreno sintético no muestra todo»— pero
con **dependencias** en lugar de terreno: el punto ciego no estaba en el mundo
falso, estaba en lo que el banco no se molestó en construir. **Anotarla así en
`ESTADO.md` vale para toda la flota**, porque cualquier banco que arme sus
dependencias a mano puede tener el mismo agujero.

Arreglado primero, y **se lo hizo fallar antes de tocar el código**: sección 6
nueva, con un sotobosque y una vegetación de mentira sembrados con las
densidades reales medidas por `bucle` (un coirón por m², una piedra cada 64).
Además el banco ahora **declara su propia cobertura** y falla si algún tipo de
`TIPOS` quedó sin ejercitar: si mañana se agrega uno, no puede volver a dar
verde sin probarlo.

### D2 — `_mirarVegetacion()` era código muerto

Usaba `sotobosque.masCercano(pos, 22)`, que devuelve **la más próxima de
cualquier tipo**. Preguntarle eso a un campo con un coirón por m² para saber si
hay piedras no funciona: **medido en el banco, la más cercana es una piedra el
1,2 % de las veces** (la revisión estimó 1,4 %). Con la orilla encima, la
arcilla salía ≈ 7×10⁻⁴ %. **La arcilla y el pedrero no se marcaban nunca.**

Es literalmente el defecto que `bucle` arregló en la ronda 1 con la tabla
`VALE` —«no gana el más cerca: gana el que más vale»—, reintroducido en un
archivo nuevo. Lo leí en `bitacora-bucle.md` para el diagnóstico de la arcilla y
no lo reconocí en mi propio código.

El arreglo **no** es copiar la tabla `VALE`: acá la pregunta correcta es más
angosta. No quiero la mejor mata, quiero saber **si hay piedra**. Ahora se
filtra el lote por tipo y se barre sólo ése, lo que además recorre las piedras y
no las trece mil instancias de relleno.

### D4 — el mapa marcaba la arcilla con un criterio que el juego ya no usa

Tenía 3 m, copiados de una versión anterior de `Recoleccion._orillaCerca()`;
`juego` lo movió a 12 m. El mapa habría marcado el **6 % de la arcilla real**,
o sea diciendo «acá no hay» donde sí hay — el peor error que puede cometer una
carta, y «ofrecer lo que no se puede cumplir» mudado del HUD al mapa.

Arreglado, y **escrito una sola vez**: `Hallazgos.js` ahora exporta
`orillaCerca(mundo, x, z)`, y en `pendiente-r2-carta.md` queda la propuesta de
dos líneas para que `Recoleccion._orillaCerca()` la importe en vez de repetir el
número. La decisión de dónde vive es de `juego`; lo que importa es que el número
esté en un solo lugar.

**Después del arreglo el banco pasa de 17 a 23 comprobaciones**, y las tres que
antes no existían —pedrero, barranca de arcilla y cañaveral— son justo las que
no se marcaban nunca.

## 5. Para que mire el dueño en pantalla

Nada de esto se puede verificar desde acá —el panel no compone cuadros— y todo
es de apariencia, no de mecanismo. El mecanismo está medido.

1. **El sombreado del relieve a cada nivel de zoom.** El cálculo de la luz divide
   por el paso (`mpp`), así que debería mantener el contraste al acercarse, pero
   es un juicio de ojo.
2. **Las curvas de nivel de ancho constante.** El cambio es real y medible en el
   código, pero si a 50 m de equidistancia el mapa queda demasiado rayado en la
   zona de cumbres, el número a mover es `_equidistancia()` en `Mapa.js`.
3. **Los seis glifos de las marcas a 640 px.** Están dibujados a ~6 px con doble
   trazo para despegarlos del fondo. Si alguno no se distingue de otro, es un
   cambio de tres líneas en `_glifo()`.
4. **La X de las obras**, que es lo que pidió: si queda chica sobre el relieve,
   el radio está en `_pintarObras()`.
