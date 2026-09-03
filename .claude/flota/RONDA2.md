# RONDA 2 — jugabilidad, gráficos y experiencia · 2/9/2026

Tres agentes jefe, tres subagentes cada uno. Rama: `mejoras/ronda2-jugabilidad-graficos`.

## Qué pidió el dueño, con sus palabras

1. Que en el mapa **se pueda hacer zoom**.
2. Que si se hace una **guarida/obra, quede marcada con una X en el mapa**.
3. Los elementos **siguen apareciendo y desapareciendo**. «Está mucho mejor que
   antes, pero se puede más todavía.»
4. Que a medida que se descubre **dónde están algunos recursos, aparezcan en el
   mapa** — «estilo New World».
5. **El agua sigue con problemas de definición.**
6. **No vio nunca** caña colihue, arcilla ni arena. Puede que sea por no haber
   jugado lo suficiente; hay que comprobar si además existe un defecto.
7. Que los agentes **sigan investigando y mejorando por criterio propio**, sin
   él encima, apuntando a calidad AAA de gráficos y de juego.

Y un defecto que trajo con captura:

8. **«Abrir depósito de ripio (o R)» aparece casi todo el tiempo y parpadea.**
   Ya está diagnosticado, no hay que volver a buscarlo: `Mineria.yacimientoEn()`
   devuelve `ripio` con sólo `pend < 0.16 && y < 1000`, que es casi todo el
   fondo de valle; y esa rama está en `Recoleccion.quePuedoHacer()` **por encima**
   de la planta y del resto, así que tapa todo lo demás. Encima, en la captura
   el jugador está en Reserva, donde la extracción **siempre** se niega: se le
   está ofreciendo una tecla que nunca va a funcionar. El parpadeo es
   `pendienteEn()` cruzando el umbral 0,16 a cada paso.

Más lo que quedó anotado como diagnosticado y sin empezar en `ESTADO.md`:
los **gestos de caza, pesca, saberes, relevamiento y exploración**, la
**legibilidad del árbol de 47 tecnologías**, el **suelo sin material bajo los
pies**, y los dos defectos de vegetación que piden medir memoria (ocho vistas de
impostor, corte del sotobosque a 192 m).

La **línea de espuma de la orilla** no se puede verificar desde acá: el panel no
compone un cuadro utilizable. Esa la mira el dueño en el juego de verdad.

## Reparto de archivos — innegociable

| Jefe | Archivos propios |
|---|---|
| **carta** | `src/ui/Mapa.js`, `src/ui/Codice.js`, `src/systems/Exploracion.js`, `src/systems/Relevamiento.js`, y archivos nuevos que cree bajo `src/systems/` |
| **mundo** | `src/world/Agua.js`, `src/world/Terreno.js`, `src/world/Vegetacion.js`, `src/world/Sotobosque.js`, `src/world/Cielo.js`, `src/engine/Posproceso.js` |
| **juego** | `src/systems/*.js` **salvo** `Exploracion.js` y `Relevamiento.js`; `src/ui/HUD.js`, `src/ui/Taller.js`, `src/ui/Bolso.js`, `src/ui/Norma.js`, `src/world/Hornos.js`, `src/world/Obras.js`, `src/data/*.json` |

**Del coordinador, que nadie toca:** `src/main.js`, `src/engine/Calidad.js`,
`src/engine/Entrada.js`, `index.html`. Si hace falta una línea de cableado ahí,
se deja el parche exacto en `.claude/flota/pendiente-r2-<jefe>.md`.

## Reglas, todas obligatorias

1. **Leer primero** `.claude/flota/ESTADO.md` (sobre todo «Trampas de medición ya
   pagadas», que costaron una sesión cada una) y `CONTEXTO.md`, más la bitácora
   vieja del área si existe. La bitácora sirve para el **diagnóstico** y para
   **lo descartado**; **lo que está hecho se comprueba contra el código**, porque
   las bitácoras subdeclaran sistemáticamente.
2. **Bitácora en disco** en `.claude/flota/r2-<jefe>.md`, con cuatro secciones:
   diagnóstico, hecho, siguiente, descartado. Se escribe **a medida que se
   trabaja**, no al final: el límite de tokens corta justo entre hacer y anotar.
3. **Nadie commitea.** Eso es del coordinador.
4. **Nadie levanta el servidor de desarrollo ni abre el navegador.** Hay un solo
   Vite y doce contextos; además el panel no compone cuadros. Se verifica por
   mecanismo, leyendo el código, y con scripts de Node cuando se pueda
   (`node capturas/feel-node.mjs`, `.claude/flota/*.mjs` son ejemplos de cómo
   se arma uno). Si algo pide de verdad una mirada en pantalla, se anota en la
   bitácora bajo «para que mire el coordinador» y se sigue.
5. **El presupuesto es Baja, no Alta.** La placa de destino es una Intel HD 4000
   y hoy da 31,8 fps a 1024×576. Reparto del cuadro: terreno 35 %, árboles 22 %,
   sombras 9 %, agua 4,5 %, sotobosque 4,5 %, cielo 4 %, posproceso 3 %.
   Cualquier detalle nuevo se paga ahí. Si una mejora cuesta, se pone detrás de
   un escalón de preset y se anota cuál.
6. **Castellano rioplatense** en código, comentarios y bitácora, como todo el
   repositorio. Los comentarios explican **por qué**, no qué.
7. **Medir antes de tocar.** En un juego 3D suponer sale caro: varios defectos
   de la ronda anterior sólo aparecieron al medir.
8. Cerrado el trabajo, dejar la bitácora al día y **avisar qué quedó sin hacer
   y por qué**. Un pendiente declarado vale; uno callado no.
