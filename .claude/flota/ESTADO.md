# ESTADO DE LA FLOTA — leer esto primero

## Al 2/9/2026

**Todo está en GitHub y todo está en `main`.** `origin/main` estaba **19 commits
atrás** del `main` local: el fuego que calienta, la creación de personaje, el
lago, las cuatro rondas de optimización — nada de eso estaba subido.

`main`, `origin/main` y la rama `mejoras/flota-visual-jugabilidad` apuntan los
tres al mismo commit. La rama se conserva pero ya no lleva nada propio.

**Ojo con lo que entró sin verificar:** en `main` están ahora las **710 líneas
de audio y fauna de `vida`**. El juego carga y corre con ellas —comprobado en el
navegador, sin errores de consola—, pero la duda de `vida` sigue abierta: fuga
de osciladores y cantos con período audible. Es una duda de calidad, no de que
se rompa. Si hubiera que sacarlas, el commit es `c0ed137`.

**Sigue sin respaldo `capturas/`**, que está en `.gitignore`: 204 archivos,
incluidas las `base-*.png` que son el "antes" de todas las comparaciones y los
bancos de medición `feel-node.mjs` y `feel-banco.js`. Si se rompe la máquina, se
pierden.

### Terminados — no relanzar

| Agente | Qué cerró |
|---|---|
| **luz** | Cielo verde, coseno solar doble, exposición constante → curva. |
| **veg** | Piedras negras, normal nula en la punta del pasto, albedo de 8 especies. |
| **agua** | Cenit reflejado, silueta del cerro en el agua, relieve fino. −5 ms de cuadro. |
| **bucle** | La leña no se podía juntar; cadena del metal de 196 a 38 h de mundo. |
| **feel** | Velocidad real = declarada (1,91 → 3,40 m/s). Una sola zancada. Agachado con transición, golpe al aterrizar, campo visual al correr. Y el cuerpo dejó de ir por el aire: **0 cuadros de 180**, contra 112 de 150. |

### Pendientes — acá se retoma

| Agente | Archivos | Estado |
|---|---|---|
| **vida** | `engine/Audio.js`, `entities/Fauna.js`, `entities/Peces.js` | **+710 líneas SIN VERIFICAR.** Primera tarea: fuga de osciladores y cantos con período audible. **Tiene un traspaso de `feel` al final de su bitácora**: engancharse a `jugador.fasePaso`. |
| **ui** | `ui/*.js`, `index.html` | Cambios a medias ya commiteados. Recorrida de paneles hecha y escrita. |

Los dos tienen **bitácora con diagnóstico ya hecho**. No los lances en frío:
decíles que lean su bitácora y ejecuten su sección «Siguiente».

### Encargos sueltos que quedaron anotados

- **Los troncos siguen casi negros.** Es `colorTronco`, no `colorHoja`. Corto.
- **La transición agua-costa quedó a medias**: falta piedra mojada y línea de
  espuma.
- **`bucle` dejó sin hacer** los gestos de caza, pesca, saberes, relevamiento y
  exploración, y la legibilidad del árbol de 47 tecnologías.
- **Medir Baja contra Baja.** La línea de base de 57,1 ms es preset **Alta**.
- **El README miente**: su sección `## Estado real` lista como defectos varios
  que esta rama resolvió, y además declara 3,4 m/s, que recién ahora es cierto.
- **La velocidad subió un 78 %** al arreglar el rozamiento. Es lo que el código
  declaraba, pero el juego se venía equilibrando al valor viejo. Si se siente
  demasiado, se toca `velocidadBase` — **no** se vuelve a poner el rozamiento
  contra la entrada.

### `pendiente-*.md`

**`pendiente-agua.md` ya está resuelto** y no hay otros. Su parte urgente eran
cuatro comillas invertidas en comentarios GLSL de `Cielo.js` que tumbaban la
carga entera; ya no quedan. Su segunda parte no pedía cableado: sólo avisa que
`reflejoAgua: 0` en los presets `baja` y `mínima` es deliberado y correcto, así
que el jugador de la placa de destino **nunca ve el espejo planar**.

### Herramientas que dejó la flota

- `.claude/flota/cadena-bucle.mjs` — resuelve una receta hacia atrás.
- `.claude/flota/bucle-recoleccion.mjs` — 5 casos de la tecla de acción.
- `capturas/feel-node.mjs` — banco de sensación de movimiento, en Node,
  determinista. `node capturas/feel-node.mjs`.
- `public/banco.js` — reloj de GPU. No está enganchado en `index.html`.

### Dos trampas de medición ya pagadas

1. **Con el panel del navegador oculto, `requestAnimationFrame` no dispara** y
   el bucle del juego queda congelado: la corrida devuelve vacío sin decir por
   qué. Lo que sí funciona es mover la física a mano desde el script inyectado
   —`j.actualizar(1/60, entradaSintética)`— guardando y restaurando el estado
   del jugador alrededor.
2. **El terreno sintético no muestra todo.** El banco de `feel` corre contra una
   rampa perfecta: es determinista y midió bien nueve defectos, pero fue
   incapaz de ver que el cuerpo salía despedido en las bajadas, porque una rampa
   perfecta no tiene por dónde despegar. Eso sólo apareció midiendo contra el
   relieve real. Las dos mediciones hacen falta.

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
