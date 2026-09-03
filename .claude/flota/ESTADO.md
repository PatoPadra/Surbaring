# ESTADO DE LA FLOTA — leer esto primero

> **3/9/2026 — LA RONDA 2 CERRÓ.** Tres jefes —carta, mundo, juego— más una
> revisión independiente. El encargo está en `RONDA2.md`; las bitácoras son
> `r2-carta.md`, `r2-mundo.md`, `r2-juego.md` y `r2-revision-juego.md`. Rama
> `mejoras/ronda2-jugabilidad-graficos`: **cinco commits, empujada a `origin` el
> 3/9/2026, y NO fusionada a `main`**. La fusión espera a que el dueño la juegue,
> porque nada de esta ronda se vio en pantalla. Cómo cerrarla —y qué viene
> después— está en `SEGUIR.md`. Lo de más abajo es el cierre de la ronda 1 y
> sigue valiendo como diagnóstico e historia.
>
> **La lección cara de esta ronda:** el que escribe el arreglo, el banco que lo
> mide y el informe que lo aprueba no pueden ser el mismo. La revisión
> independiente encontró una rama muerta nueva **creada por el arreglo del
> ripio** —y que estrangulaba la única fuente de agua del juego—, un banco que
> declaraba 17/17 sin ejercitar 3 de 5 tipos porque construía sus dependencias a
> mano y las consultaba con `?.`, y un número mezclado de dos corridas distintas
> que caía del lado cómodo. Ninguna de las tres la podía ver su propio autor.
>
> **Variante nueva de la trampa nº 3:** un banco que arma sus dependencias a mano
> y las consulta con encadenamiento opcional **da verde sin ejercitar nada**. El
> banco de hallazgos lo estaba imprimiendo —«arena 0 · chatarra 70»— y nadie leyó
> el cero. Toda medición de esta flota necesita una guarda de cobertura.

## Lo que hay que mirar JUGANDO, todo junto — ronda 2

El panel del navegador no compone cuadros, así que nada de esto se pudo ver. Es
lo único que la ronda no pudo cerrar sola.

1. **Que el cartel de ripio haya desaparecido.** Es el defecto que trajo el
   dueño con captura. Medido: de un aviso cada 47 m al 6,2 % del recorrido.
2. **El ritmo de los avisos nuevos** de `G` (taller), `Tab` (códice) y `H`
   (caza). Escalonados a 1,5 s y 4,5 s; si se pisan o molestan, se toca ahí.
3. **El bosque caminando**, franja de 100 a 140 m: el pico de cambios
   simultáneos bajó de 105 a 15.
4. **El lago lejano contra un cerro**, en Baja. Y si la veta del agua queda
   manchada, es **un solo número**: `Agua.js:717`.
5. **La línea de espuma de la orilla**: tres bandas o un canto duro. Viene
   pendiente desde la ronda 1 y nunca se pudo verificar.
6. **El suelo a tres o cuatro metros**: el grano de gravilla tenía que estirarse
   de 5,6 m a 11 m.
7. **La estepa al este seco**, que antes no tenía una sola especie leñosa apta.
8. **El mapa**: contraste del sombreado a cada nivel de zoom, si 50 m de
   equidistancia raya la zona de cumbres, si los seis glifos se distinguen a
   640 px, y si la X de las obras tiene el tamaño que el dueño quería. Los
   cuatro son cambios de tres líneas.


## Al 2/9/2026 — LA FLOTA CERRÓ. Los siete agentes están terminados.

**Todo está en GitHub y todo está en `main`.** `origin/main` había quedado 19
commits atrás; ya se empujó todo.

**No queda ningún agente pendiente y ningún `pendiente-*.md` sin aplicar.**

### Los siete

| Agente | Qué cerró |
|---|---|
| **luz** | Cielo verde, coseno solar doble, exposición constante → curva. |
| **veg** | Piedras negras, normal nula en la punta del pasto, albedo de 8 especies, oclusión propia de la copa. |
| **agua** | Cenit reflejado, silueta del cerro en el agua, relieve fino. −5 ms de cuadro. |
| **bucle** | La leña no se podía juntar; cadena del metal de 196 a 38 h de mundo. |
| **feel** | Velocidad real = declarada (1,91 → 3,40 m/s). Una sola zancada. Agachado con transición, golpe al aterrizar, campo visual al correr. El cuerpo dejó de ir por el aire: **0 cuadros de 180** contra 112 de 150. |
| **vida** | El testigo de las voces moría a los 2 s y **cortaba 27 de las 42 voces**. La fauna estaba muda: faltaba el cableado en `main.js`. Pasos enganchados a la zancada. `Peces.js` abierto por primera vez. |
| **ui** | Barra crítica que se ponía **más** transparente. Buscador y conteos en el Códice. Brújula ilegible contra el cielo del mediodía. Y el teclado del juego se disparaba escribiendo. |

### Lo que hizo el coordinador

- `src/main.js`: `bichos.audio = audio` (sin eso la fauna quedaba muda) y el
  aviso de bienvenida reducido de seis teclas a dos.
- `src/engine/Entrada.js`: respeta el foco. Escuchaba `keydown` en `window` sin
  mirar quién lo tenía, así que cualquier campo de texto de cualquier panel
  chocaba con los atajos del juego. `Codice.js` lo había tapado por su lado;
  esto lo arregla de raíz.
- `README.md`: la sección `## Estado real` listaba como defectos la oclusión de
  copa y la falta de voces de fauna, que esta flota resolvió.

## Baja contra Baja: MEDIDO el 2/9/2026

Instrumento validado antes de nada (`bancoValidez()` → «el instrumento mide»),
placa confirmada como la de destino: `ANGLE (Intel, Intel(R) HD Graphics 4000)`.

| Preset | Resolución | ms | fps |
|---|---|---|---|
| Alta | 1280×720 | 77,84 | 12,8 |
| Baja | 1280×720 | 42,34 | 23,6 |
| **Baja** | **1024×576** | **31,42** | **31,8** |
| **Mínima** | **1280×720** | **31,71** | **31,5** |

**La flota no agregó costo: lo bajó.** Contra la línea de base registrada
—preset Alta, árbol limpio—: 57,1 → 49,21 ms a 640×360 (**−13,8 %**) y
88,3 → 77,84 a 720p (**−11,8 %**).

Desglose a Baja 1024×576: terreno **35 %**, árboles 22 %, sombras 9 %, agua
4,5 %, sotobosque 4,5 %, cielo 4 %, posproceso 3 %, **reflejo 0 %**. Dos cosas
que esto corrige de `docs/medicion-cuadro.md`: el sotobosque **ya no** es el
77 % del cuadro junto con el terreno —bajó a 4,5 %—, y el terreno es hoy la
única pieza con algo grande para ganar. Todo escrito en la sexta ronda de ese
documento.

## Lo que queda, y no es de ningún agente

1. **Decidir la velocidad.** Subió un 78 % al arreglar el rozamiento: es lo que
   el código siempre declaró y lo que dice el README, pero el juego se venía
   equilibrando al valor viejo. Si se siente demasiado, se toca
   `velocidadBase` — **no** se vuelve a poner el rozamiento contra la entrada.
2. **Una tanda de capturas finales** contra `capturas/base-*.png`, y de paso la
   confirmación visual de la línea de espuma de la orilla, que es lo único de
   `agua` que quedó sin mirar. El panel del navegador no compone un cuadro
   utilizable, así que esto pide una mirada en el juego de verdad.
3. **Diagnosticado pero sin empezar** — no es trabajo a medias, es trabajo
   nuevo, y por eso no se abrió: los gestos de caza, pesca, saberes,
   relevamiento y exploración que anotó `bucle` (la chatarra y la cantera ya
   tienen el suyo); la legibilidad del árbol de 47 tecnologías; el suelo sin
   material bajo los pies; y los dos defectos de `veg` que piden medición de
   memoria (ocho vistas de impostor, el corte del sotobosque a 192 m).
4. **`capturas/` no está en el repo** (está en `.gitignore`): 204 archivos,
   incluidas las `base-*.png` que son el "antes" de todas las comparaciones y
   los bancos de medición. El dueño lo sabe y decidió dejarlo así.

## Trabajo a medias que se cerró al final

- **El tronco caído seguía negro.** `veg` había arreglado la iluminación de los
  sólidos pero no el albedo del tronco, y el relleno se multiplica por el
  albedo: 0,047 × 0,34 sigue siendo negro. Ahora 0,115, en rango de madera
  muerta a la intemperie. El detalle, en `bitacora-veg.md`.
- **`bancoDesglose()` de `agua`**, que nunca había podido completar por las
  recargas de los otros agentes.
- **La transición agua-costa**, verificada por mecanismo: son tres bandas
  —espuma, franja transparente a 0,5 m, agua cerrada a 1,8 m— y no un canto
  duro. La «piedra mojada» que `agua` se había anotado no hace falta:
  `Terreno.js:613` ya oscurece el lecho y bajar el alfa es lo que la deja ver.

## Herramientas que dejó la flota

- `.claude/flota/cadena-bucle.mjs` — resuelve una receta hacia atrás.
- `.claude/flota/bucle-recoleccion.mjs` — 5 casos de la tecla de acción.
- `capturas/feel-node.mjs` — banco de sensación de movimiento, en Node,
  determinista. `node capturas/feel-node.mjs`.
- `public/banco.js` — reloj de GPU. No está enganchado en `index.html`.

## Trampas de medición ya pagadas — leer antes de medir cualquier cosa

Esto es lo más caro que dejó la flota, porque cada una costó una sesión.

1. **Con el panel del navegador oculto, `requestAnimationFrame` no dispara** y
   el bucle del juego queda congelado: la corrida devuelve vacío sin decir por
   qué. Lo que sí funciona es mover la física a mano desde el script inyectado
   —`j.actualizar(1/60, entradaSintética)`— guardando y restaurando el estado
   del jugador alrededor.
2. **Con el panel visible, el bucle corre a ~1 cuadro por segundo.** Cualquier
   sistema que integre `dt` avanza cien veces menos de lo esperado y sus
   magnitudes parecen defectos. **Medir el `dt` que de verdad llega antes de
   llamar defecto a un número chico.**
3. **El terreno sintético no muestra todo.** El banco de `feel` corre contra una
   rampa perfecta: midió bien nueve defectos y fue incapaz de ver que el cuerpo
   salía despedido en las bajadas, porque una rampa perfecta no tiene por dónde
   despegar. Las dos mediciones hacen falta.
4. **Una recarga de Vite tira el contexto de audio** (`listo` vuelve a `false`)
   y hace falta un gesto real —un clic en el lienzo— para revivirlo. Comprobar
   también `audio.silenciado` antes de creerle a un `false` de `voz()`.
5. **La tecla Escape de la herramienta del navegador no llega a la página.** Ni
   con una sonda en fase de captura sobre `window`. La lógica de Escape hay que
   ejercitarla con eventos despachados.
6. **`getComputedStyle` sobre el elemento equivocado miente sin avisar.** La
   animación de la vital crítica vive en `.vital.critico .pista i`, no en el
   contenedor: medir el padre daba `animation: none` y parecía un defecto.
7. **El panel no compone con viewport emulado.** A 1280×720 la escena se dibuja
   en una esquina. Las capturas del HUD sirven para mirar, no para medir.

## Y una lección de método, que es la que más se repitió

**Tres de los siete agentes habían escrito mucho más de lo que decía su
bitácora.** El límite de tokens los cortó entre hacer el trabajo y anotarlo, así
que `vida` decía «paso 1 de 4» con el motor entero escrito, y `ui` daba por
pendiente un CSS que ya estaba en el archivo. Retomar leyendo sólo la bitácora
habría significado reescribir trabajo bueno.

**Al retomar un agente: leer su bitácora para el diagnóstico y lo descartado,
pero comprobar contra el código qué está hecho de verdad.**

---

## Qué se está haciendo

El dueño pidió mejorar **calidad visual y jugabilidad en todas sus facetas**,
hasta un punto en que pueda probarlo y sea una gran experiencia, para desde ahí
seguir mejorando. Se repartió el trabajo en siete agentes con **propiedad
exclusiva de archivos**, para que puedan correr en paralelo sin pisarse.

## Lo importante que hay que entender antes de retomar

**Los subagentes son locales a la sesión: mueren con ella y no se los puede
retomar desde otra.** Lo único que cruza de una sesión a la siguiente es lo que
está en disco. Por eso cada agente lleva una bitácora, y por eso existe este
archivo.

Para retomar no se "reconecta" con los agentes viejos: se **lanzan agentes
nuevos**, y a cada uno se le dice que lea su bitácora antes de trabajar. La
bitácora tiene el diagnóstico, lo hecho, el siguiente paso y lo ya descartado,
así que el agente nuevo no repite el trabajo caro.

## Reparto de archivos — innegociable, es lo que evita los conflictos

| Agente | Archivos propios | Bitácora |
|---|---|---|
| **luz** | `src/world/Cielo.js`, `src/engine/Posproceso.js`, `src/world/Tiempo.js` | `bitacora-luz.md` |
| **veg** | `src/world/Vegetacion.js`, `src/world/Sotobosque.js` | `bitacora-veg.md` |
| **agua** | `src/world/Agua.js`, `src/world/Terreno.js` | `bitacora-agua.md` |
| **feel** | `src/entities/Jugador.js`, `src/entities/Cuerpo.js`, `src/engine/Entrada.js` | `bitacora-feel.md` |
| **bucle** | `src/systems/*.js`, `src/world/Hornos.js`, `src/world/Obras.js` | `bitacora-bucle.md` |
| **ui** | `src/ui/*.js`, `index.html` | `bitacora-ui.md` |
| **vida** | `src/engine/Audio.js`, `src/entities/Fauna.js`, `src/entities/Peces.js` | `bitacora-vida.md` |

**Del coordinador, que ningún agente toca:** `src/main.js` y
`src/engine/Calidad.js`. Los agentes que necesitan una línea de cableado en
`main.js` dejan el parche exacto en `.claude/flota/pendiente-<nombre>.md`, y el
coordinador los aplica todos juntos al final. **Revisá si hay archivos
`pendiente-*.md` sin aplicar.**

Sin dueño y sin tocar: `src/world/Mundo.js`, `src/world/Limites.js`,
`src/world/Clima.js`, `src/util/captura.js`, `public/banco.js`, `tools/`.

## Los defectos que motivaron el reparto, con su evidencia

Medidos con capturas, no leyendo código. Las capturas de referencia están en
`capturas/base-*.png` y **no hay que borrarlas**: son el "antes" contra el que se
compara todo.

1. **El cielo es verde** a las 09:00 del 15 de febrero, y el paisaje está en
   penumbra como si fuera el crepúsculo — `base-alta-manana.png`. → agente luz
2. **El mediodía se quema a blanco**, con neblina lechosa que aplana el
   contraste — `base-alta-bosque.png`. → agente luz
3. **Nada tiene luz de relleno**: al atardecer los árboles son siluetas negro
   puro — `base-lago.png`. → agente luz
4. **Piedras y troncos caídos se dibujan negro puro** a pleno sol, en todos los
   presets — `base-alta-bosque.png`, `base-bosque.png`. Es el artefacto más feo
   del juego. Pista: en `docs/medicion-cuadro.md` consta que en una ronda de
   optimización se les puso `FrontSide` y se les cambió el BRDF a Lambert.
   → agente veg
5. **El pasto son triángulos planos** de un solo tono, sin doblarse y sin
   apoyarse en el suelo — `base-cumbre.png`. → agente veg
6. **Las copas son bolas de un solo verde**, sin oclusión interna. → agente veg
7. **El lago es una lámina de plástico celeste**, pese a tener Fresnel,
   absorción de Beer-Lambert y espejo ya escritos — `base-alta-manana.png`.
   → agente agua
8. **El suelo de cerca no tiene grano** y se le ve un patrón repetido de manchas
   alargadas — `base-cumbre.png`. → agente agua

## Línea de base de rendimiento

La placa de esta máquina **es** la de destino: `Intel(R) HD Graphics 4000`.
Medido con el reloj de GPU, árbol de trabajo limpio, preset Alta forzado:

| Resolución | Mpx | ms de GPU |
|---|---|---|
| 640×360 | 0,23 | **57,1** |
| 1280×720 | 0,92 | **88,3** |

Instrumento: `public/banco.js`, que **no** está enganchado en `index.html` —
hay que cargarlo a mano con `<script src="/banco.js">`. `window.bancoValidez()`
antes de creerle a cualquier número.

`docs/medicion-cuadro.md` tiene cuatro rondas de optimización documentadas, con
los resultados negativos incluidos. Terreno y sotobosque fueron el 77 % del
cuadro: **cualquier detalle nuevo ahí se paga caro.**

## Lo que le queda al coordinador

1. Aplicar los `.claude/flota/pendiente-*.md` sobre `src/main.js`.
2. **Volver a medir con el banco** y comparar contra los 57,1 / 88,3 ms de
   arriba. Si la flota agregó costo, decidir qué entra y qué se recorta por
   preset en `src/engine/Calidad.js`.
3. **Verificar en preset Baja, no en Alta.** El dueño juega en una HD 4000 y el
   gobernador termina en Baja o Mínima; de nada sirve que se vea bien en Alta.
4. Sacar una tanda de capturas finales y compararlas contra `base-*.png`.
5. Actualizar el README: la sección `## Estado real` lista defectos conocidos
   que esta flota resuelve, y quedaría mintiendo.
6. Commitear. **Ningún agente commitea; eso es del coordinador.**

## Cómo se corre

Servidor de desarrollo con la herramienta de vista previa, configuración
`survibar` en `.claude/launch.json`. Ojo: el puerto 5173 puede estar ocupado por
otra sesión y Vite se corre a 5173. Confirmá el puerto en los registros del
servidor antes de navegar, porque la vista previa informa un puerto de proxy que
puede no responder.

La creación de personaje bloquea el arranque: hasta que no se elige, `main.js`
espera en `await personaje.abrir()` y `window.SurviBar` no existe. La elección
queda guardada en `localStorage` bajo `survibar.aspecto.v2`.
