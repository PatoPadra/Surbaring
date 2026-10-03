# Ronda 9 — contratos por fase

Arranca sobre `main` el 28/9/2026, rama `mejoras/ronda9-bandeja`. El origen de cada
fase y el orden elegido están en `ESTADO.md` y `RONDA9-ARRANQUE.md`.

---

## FASE 1 · `iconos` — empaquetar la hoja para bajarla de 137,8 kB

### El problema, medido antes de escribir el contrato

`node .claude/flota/banco-r6-fase3.mjs` da hoy: **137,8 kB de 140** para 122 íconos
(1156 bytes cada uno de promedio). Con dos dibujos más se pone rojo, y le va a aparecer
al primer agente que agregue un ícono como si fuera culpa suya.

`hoja()` en `src/ui/Iconos.js` arma un `data:image/svg+xml,...` **completo y aparte por
cada ícono** (`arteDe` → `envolver` → `aUri`), como fondo de una clase CSS distinta.
Cada uno paga su propio `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
stroke-linecap="round" stroke-linejoin="round">…</svg>`: **121 bytes ya codificados,
repetidos 123 veces** (122 íconos + el de reserva) sólo de envoltorio, antes de una sola
línea de dibujo. Medido: eso son **~14,9 kB de puro envoltorio duplicado**, el 11 % de
la hoja entera.

**Se probaron dos caminos alternativos y los dos midieron peor de lo que parecían:**

- Sacar `xmlns` del envoltorio (ahorraría ~4,3 kB): **probado en el navegador real y NO
  funciona** — sin `xmlns`, el `data:image/svg+xml` puesto como `background-image` no
  carga (`Image` con `onerror`, y en pantalla no aparece nada). `xmlns` es obligatorio
  para este uso exacto. **No lo intentes de nuevo sin volver a medirlo.**
- Agrupar colores repetidos dentro de un mismo ícono en una clase local (`<style>.a{fill:…}`):
  la técnica **sí renderiza** (probado), pero medido con números reales sólo ahorra
  cuando un mismo color se repite 3 veces o más dentro del mismo ícono, y así y todo el
  ahorro total simulado es de **apenas ~1,6 kB en 64 de los 122 íconos** — el costo fijo
  de declarar la regla se come casi toda la ganancia. **No alcanza solo.**

**Lo que sí mide bien: una sola hoja combinada (sprite), con un `<svg>` por toda la
hoja y un `<g transform="translate(x,y)">` por ícono, y cada clase CSS eligiendo su
celda con `background-position` en vez de traer su propio `data:` URI.** Simulado con
los 122 dibujos reales en una grilla de 12×11: **hoja completa (`background-image` +
las 123 reglas de posición) ≈ 128,6 kB**, contra 137,8 hoy — **~9,2 kB de ahorro real**,
sin tocar un solo dibujo. Probado en el navegador con 4 figuras de colores distintos en
grilla 2×2, a los dos tamaños reales de uso (79 px en `.bp-cs > .ic` de `Bolso.js`, y
2,3 rem ≈ 34-37 px en `.bp-det-ic`, los dos **cuadrados**): **sin sangrado entre celdas
y sin desplazamiento visible** en ninguno de los dos tamaños.

**Es una decisión de la flota, y ya está tomada: la hoja pasa a ser un sprite.**

### El contrato

- **C1 — Misma API, mismo comportamiento externo.** `hoja()`, `inyectar()`, `arteDe()`,
  `claseDe()`, `IDS`, `CLASE_BASE`, `CLASE_RESERVA`, `MATERIAS` mantienen firma y
  comportamiento. Ningún archivo fuera de `src/ui/Iconos.js` cambia (`Bolso.js`,
  `Taller.js`, `Codice.js`, `HUD.js`, `Mapa.js`, etc. quedan intactos: siguen pidiendo
  la clase con `claseDe(id)` como hoy).
- **C2 — La hoja pesa 132 kB o menos.** `Buffer.byteLength(hoja(), 'utf8') <= 132*1024`.
  (Medido que 128,6 kB es alcanzable; 132 deja margen de implementación real.)
- **C3 — Cada ícono se ve igual.** Renderizado en el navegador a los dos tamaños reales
  de uso (79 px y ~35 px, cuadrados), la imagen resultante de la hoja NUEVA es
  indistinguible en píxeles de la hoja VIEJA (comprada contra la instantánea guardada en
  `.claude/flota/base-r9/Iconos.js`) para una muestra amplia de íconos, **sin bordes de
  la celda vecina visibles** (sangrado) y **sin recorte** del dibujo.
- **C4 — El ícono de reserva (`ic-x`) se ve igual**, incluida su selección por `claseDe`
  para un id sin receta.
- **C5 — La hoja se arma una sola vez y queda cacheada** (igual que hoy: `_hoja` no
  se reconstruye en llamadas siguientes a `hoja()`).
- **C6 — El costo de armar la hoja la primera vez no empeora de forma relevante** contra
  la base (hoy: "unos pocos milisegundos").
- **C7 — Sin regresión:** `banco-r6-fase3.mjs` sigue en verde (su propio techo de 140 kB
  sigue cumplido, con más margen que antes).
- **C8 — `vite build` limpio.**

### Lo que NO pide este contrato

- No pide bajar el peso de ningún dibujo individual — el problema es el empaquetado, no
  el arte (ver `RONDA9-ARRANQUE.md`, punto 1).
- No pide una hoja de contacto nueva ni tocar la paleta.
- No pide raster: la hoja sigue siendo vectorial (SVG), un solo `<svg>` con todos los
  `<g>` adentro, no una imagen de píxeles.

### Instrumentos

- `.claude/flota/banco-r9-fase1.mjs` — API, C2, C5, C6, C7, C8 (Node).
- `.claude/flota/banco-r9-fase1.navegador.js` — C3, C4 (navegador, corre contra un
  Vite real comparando contra `base-r9/Iconos.js`).
- `.claude/flota/banco-r9-fase1.falsar.mjs` — planta defectos sobre una copia y trae
  controles.

---

## FASE 2 · `desgaste` — la herramienta que una receta pide se gasta usándola

### El problema, medido antes de escribir el contrato

`Fabricacion.fabricar()` nunca llama a nada de `Equipo` que gaste una herramienta.
Confirmado con grep: `desgastar()` sólo lo llaman `Recoleccion._gastarHerramienta()`
(cuando corta, mata o cava) y `Caza._tiro()` (al tirar con el arma). **Ninguna receta
de `Fabricacion` gasta la herramienta que `pideHerramienta` exige.**

Hay exactamente **6 recetas** con `pideHerramienta` en `herramientas.json` (confirmado
por script, no a ojo):

| receta | pide | durabilidad de la herramienta |
|---|---|---|
| `lasca_rodado` | `percutor` | 30 |
| `preforma_hacha` | `percutor` | 30 |
| `martillo_piedra` | `percutor` | 30 |
| `medula_hueso` | `martillo_piedra` | 150 |
| `mango_labrado` | `["lasca_rodado","lasca","cuchillo"]` (cualquiera) | 12 / 40 / 90 |
| `hilar_lana` | `huso` | **sin declarar → `Infinity`** |

La propia ficha del huso ya lo dice: *"no declara durabilidad porque hilar no lo
gasta"* — es la excepción que `RONDA9-ARRANQUE.md` pedía resolver con una marca nueva
(`gastaHerramienta`). **No hace falta esa marca nueva.** `Equipo.desgastar()` YA trata
"sin `usos` finito" como "no se gasta nunca" (`if (!Number.isFinite(cosa.usos) ||
cosa.usos <= 0) return false`) — es exactamente la regla que el huso necesita, y ya la
tiene por no declarar `durabilidad`. Reusar esa misma señal para las cinco recetas
restantes (que sí declaran `durabilidad`) resuelve las seis sin escribir una excepción
a mano ni inventar un campo paralelo que se pueda desincronizar de `durabilidad`.
**Es una decisión de la flota, y ya está tomada: no se agrega `gastaHerramienta`.**

Lo único que falta es un lugar de dónde COLGAR el desgaste: `Equipo.desgastar()`
sólo sabe gastar lo que está puesto en la ranura `mano`, y la herramienta que
`pideHerramienta` exige puede estar en el bolso sin estar equipada (`herramientaQueFalta`
ya lo dice: "cuenta tenerlo en el bolso o puesto"). Hace falta un método que la
encuentre por id, esté donde esté.

### El contrato

- **D1 — `Equipo.desgastarId(id, cuanto = 1)`, método nuevo.** Busca, entre TODAS las
  instancias de ese id (grilla o puesta — el mismo universo que recorren `tiene()` y
  `usosDe()`), la de más usos, y le resta `cuanto` con las mismas reglas que
  `desgastar()`: nunca algo con `efecto.luz`, nunca si sus `usos` no son finitos o ya
  están en 0. Devuelve `true` si la dejó en 0. Si no hay ninguna instancia elegible,
  devuelve `false` y no toca nada. **No cambia `desgastar()`** (lo que usa `Caza`
  sigue exactamente igual).
- **D2 — `Fabricacion.fabricar()` gasta, al terminar con éxito, la herramienta
  REALMENTE usada:** la primera de `obj.pideHerramienta` que el jugador tiene sana (el
  mismo criterio que ya usa `herramientaQueFalta()` para decidir si falta o no — no
  una fija, no todas las alternativas de la lista).
- **D3 — Con el huso, `hilar_lana` no le baja ningún uso.** Sale solo de D1+D2: no se
  escribe ninguna condición especial para `huso` ni para `hilar_lana`.
- **D4 — Las otras cinco SÍ bajan un uso** de la herramienta que se haya usado
  (`percutor`, `martillo_piedra`, o la que corresponda de la lista en
  `mango_labrado`), cada vez que esa receta se fabrica con éxito.
- **D5 — Nada más cambia.** `estado(obj)` sigue devolviendo exactamente lo mismo que
  hoy para cualquier receta (ni más estricta ni más floja), y una receta SIN
  `pideHerramienta` no se ve afectada en absoluto.
- **D6 — `herramientas.json`: corregir `balanceSaber.arreglo`.** Hoy propone volver a
  pedirle `lasca_obsidiana` a `hacha_pulida` — la fase 5 de la ronda 8 sacó esa
  dependencia A PROPÓSITO (ver `notaRequisitos` de `hacha_pulida` en
  `historia.json`), así que ese texto quedó contradiciendo una decisión ya tomada.
  Corregirlo para que lo diga (marcarlo desactualizado desde la ronda 8, fase 5) **sin
  inventar números nuevos**: el instrumento que calculaba "el árbol pide X, el juego
  reparte Y" (`r4-economia.mjs`) no está mantenido y hoy da un árbol que ya no existe
  (todavía cree que `hacha_pulida` depende de `lasca_obsidiana`), así que no es una
  fuente confiable para un número de reemplazo. Decir lo que se sabe (el arreglo
  propuesto ya no vale) y no lo que no se sabe (el total real hoy).
- **D7 — Sin regresión:** `banco-r8-fase5.mjs` (la cadena entera de la piedra, con
  `Inventario`/`Equipo`/`Saberes`/`Fabricacion` reales) sigue verde. **No** se pide
  `r4-banco-fabricacion.mjs`: medido antes de escribir este contrato, ya da **18
  fallas contra la base sin tocar** — quedó desactualizado desde que la fase 5 sacó la
  tecnología previa de `lasca_rodado` (hoy `tecnologia: null`, el banco todavía espera
  `falta_saber`) y otros cambios de esa misma fase. No es una regresión de esta fase:
  ya estaba roto. Queda anotado para quien quiera repararlo o jubilarlo, pero no es
  trabajo de `desgaste`.
- **D8 — `vite build` limpio.**

### Lo que NO pide este contrato

- No pide tocar `Recoleccion.js` ni `Caza.js` (sus desgastes ya funcionan, aunque uno
  tenga su propio defecto conocido de apuntar a "lo que hay en la mano" — no es de
  esta fase).
- No pide rebalancear cuánto dura cada herramienta (`durabilidad` no cambia).
- No pide recalcular el árbol de saber completo — sólo corregir el texto que quedó
  contradiciendo una decisión ya tomada.

### Instrumentos

- `.claude/flota/banco-r9-fase2.mjs` — D1 a D6 (Node, contra `Equipo`/`Fabricacion`
  reales, no maquetas).
- `.claude/flota/banco-r9-fase2.falsar.mjs` — planta defectos sobre una copia y trae
  controles.

---

## FASE 3 · `copa-b` — las ramas peladas del coihue, medidas de verdad

### El problema, medido antes de escribir el contrato

`pendiente-r8-copa.md` (fase 4, ronda 8) ya lo había visto y no lo había medido:
*"El coihue sigue con las ramas desnudas asomando de la copa... siete cilindros que
salen del tronco y terminan apenas adentro del follaje... no es el atlas, es el
modelo `copa_ancha`"*. La captura `capturas/r8-f4-copa-arbol-coihue.png` ya lo
mostraba sin ambigüedad: ramas grises bien afuera de las hojas, contra el cielo.
`RONDA9-ARRANQUE.md` agregaba que la prueba geométrica de esa ronda había dado un
cero sospechoso ("la clasificación por color de vértice mete casi todo en un
balde") y que no había que creerle.

**Medido de verdad esta vez** (jefe, con una copia instrumentada de
`construirPlanta` en el scratchpad, no en el repo, que registra dónde cae cada
rama y cada lóbulo de follaje del coihue REAL, el único que existe por especie
desde que la ronda 8 lo hizo determinista):

| rama | radio horizontal | altura de la punta | lóbulo más cercano | ¿adentro? |
|---|---|---|---|---|
| 0 | 7,98 m | 13,35 m | a 3,13× su radio | **NO — asoma ~14,9 m** |
| 1 | 11,83 m | 17,53 m | a 2,28× su radio | **NO — asoma ~9,0 m** |
| 2 | 9,71 m | 17,44 m | a 2,57× su radio | **NO — asoma ~11,0 m** |
| 3 | 9,62 m | 18,82 m | a 2,59× su radio | **NO — asoma ~11,1 m** |
| 4 | 7,62 m | 18,81 m | a 2,41× su radio | **NO — asoma ~9,9 m** |
| 5 | 8,61 m | 20,95 m | a 1,74× su radio | **NO — asoma ~5,2 m** |
| 6 | 9,84 m | 23,26 m | a 0,99× su radio | sí (justo) |

**6 de 7 ramas del coihue caen afuera de TODOS los lóbulos de follaje**, alguna
hasta 15 metros. La causa no es sólo angular (7 ramas y 5 lóbulos salen de dos
sorteos independientes, con lo que una rama puede apuntar a un hueco entre dos
lóbulos): es que **los lóbulos arrancan todos por encima de la copa del tronco**
(`cumbre + alturaRef·0,10` para arriba) mientras las ramas más bajas (`t` desde
0,42) ni llegan a esa altura. Confirmado visualmente: `capturas/r8-f4-copa-arbol-coihue.png`
(la vieja) y una captura propia con el mismo resultado antes de tocar nada.

**Las especies `retorcido` (ñire, lenga, maitén) NO tienen este problema en la
misma magnitud**: medidas con el mismo instrumento, entre 1 y 2 de 7 ramas asoman,
y por poco (4 cm a 1,4 m, no 5 a 15 metros). No es lo que reportó la ronda 8 y
**queda fuera de este contrato a propósito** — corregirlo es una mejora menor,
no el defecto que había que medir.

### El arreglo, ya diseñado y verificado

**Cada rama apunta a un lóbulo de verdad, no a un ángulo suelto.** Se calculan los
5 lóbulos ANTES que las 7 ramas (antes era al revés), y cada rama —cíclicamente,
2 lóbulos llevan 2 ramas— apunta derecho al centro de su lóbulo asignado, frenando
`insercion` metros antes de llegar (`insercion = radioH_del_lóbulo × (0,35 a
0,60)`): como `insercion` es una fracción del radio del PROPIO lóbulo, la punta
cae siempre adentro sin importar qué tan lejos esté ese lóbulo del punto de anclaje
en el tronco. `ang`/`elevacion`/`largo` se derivan del vector tronco→punta con
trigonometría inversa; el resto de la rama (el cilindro, la pintura) no cambia.

**Verificado con el mismo instrumento**: las 7 ramas del coihue caen dentro de su
lóbulo asignado (0,66× a 0,86× su radio — margen real, no al límite). Verificado
además **visualmente**, en el navegador, comparando `Vegetacion.js` antes y
después con el mismo modelo simple (una malla con color de vértice, sin el atlas
real): antes, ramas grises cruzando el cielo; después, el tronco desaparece
limpio dentro del follaje, sin ningún palo asomando.

### El contrato

- **E1 — Cada rama del coihue (y de cualquier especie `copa_ancha`) cae dentro de
  su lóbulo asignado**, con margen: distancia normalizada punta→centro del lóbulo
  (`hipot(horizontal/radioH, vertical/radioV)`) ≤ 1 para el lóbulo `i % 5` de esa
  rama.
- **E2 — Las especies que NO son `copa_ancha` no cambian**: mismo resultado que
  antes de esta fase para `retorcido` y `arbusto` (ramas, follaje, todo).
- **E3 — El modelo sigue siendo determinista** (C7 de la ronda 8):
  `construirPlanta(esp)` da la misma geometría byte a byte en dos llamadas, y
  especies distintas dan geometría distinta.
- **E4 — El gancho de depuración (`globalThis.__vegDebugCopa*`) no cuesta nada en
  el juego**: no existe en ningún otro archivo, y con el global sin definir el
  `if` no hace nada.
- **E5 — Sin regresión: `banco-r8-fase4.mjs` y su falsador siguen verdes.**
- **E6 — `vite build` limpio.**

### Lo que NO pide este contrato

- No pide tocar `retorcido` ni `arbusto` (medido: no es el defecto reportado).
- No pide rehacer el atlas de follaje ni la textura de corteza.
- No pide una hoja de contacto ni una captura nueva para el dueño más allá de la
  que ya sirvió para verificar esta fase.

### Instrumentos

- `.claude/flota/banco-r9-fase3.mjs` — E1 a E6 (Node, contra `Vegetacion.js` real
  con el mismo stub de `document`/canvas que ya usa `banco-r8-fase4.mjs`).
- `.claude/flota/banco-r9-fase3.falsar.mjs` — planta defectos sobre una copia y
  trae controles.

---

## FASE 4 · `primer-año` — las cinco respuestas del dueño, hechas juego

Las cinco preguntas de `r8-primer-anio.md` están contestadas (28/9/2026, ver
`ESTADO.md`). Esta fase es grande y se abre en sub-fases, cada una con su propio
cierre — la misma disciplina que las fases 1 a 3, a otra escala.

**Medido antes de encargar nada** (jefe, investigación en el código real, no
supuestos): la pantalla de cierre del año (`src/ui/Cierre.js`) **ya existe** y ya
hace casi exactamente lo que pedía la pregunta 4 (cartel breve con lo logrado,
botón "Seguir anotando", el juego no termina) — no hay que construirla, sólo
enriquecerla con lo que este contrato agregue. El punto de enganche de la muerte
(`jugador.alMorir`, cableado en `main.js` a `partida.registrarMuerte` + `fin.mostrar`)
ya existe y es justo donde hace falta enganchar la pregunta 5. El cartel de acción
contextual (`E`) es un solo sistema, `Recoleccion.quePuedoHacer()` → `HUD.mostrarAccion()`,
acoplado 1:1 a esa clase: agregar «Dormir» ahí adentro mezclaría un concepto de
reloj con la clase de recolección, así que se engancha ENVOLVIENDO el método desde
`main.js` (el mismo patrón que ya usa el proyecto con `partida.reaparecer` y
`construccion.levantar`), no tocando `Recoleccion.js`.

### Sub-fase 4a · `reloj` — CERRADA

Una línea en `Tiempo.js`: la fecha de arranque de una partida NUEVA pasa del
12 de febrero (verano) al 21 de septiembre (el equinoccio de primavera), sin
tocar la velocidad del reloj (pregunta 1, opción A). El invierno queda al día
253 (~84 h reales), lejos pero sin reabrir el balance de luz/clima de las rondas
5 a 8.

Verificado que **una partida guardada no se entera**: `Partida._cargar()`
restaura `tiempo.fecha` desde `d.tiempo.ms` si existe (`Partida.js` línea ~374),
así que el cambio de default sólo alcanza a partidas sin guardado previo — que es
exactamente lo que pedía la pregunta ("¿en qué estación arranca una partida
NUEVA?"). Verificado también que ningún banco de regresión pasa por el default
(`banco-r8-fase7.mjs` y `banco-r8-fase2.mjs` construyen su propio `Tiempo` con
una fecha explícita).

**Verificado jugando**: partida nueva, sin guardado previo, arranca el
2025-09-21T13:20 UTC. (Nota de proceso: un primer intento mostró febrero por una
caché de Vite vieja —`node_modules/.vite`—, no por el código; ver
[[vite-cache-mata-el-cambio]] en la memoria del jefe.)

Sin banco propio: es un cambio de una constante, ya cubierto por la comprobación
de arriba (ningún banco depende del default) y por la partida real jugada.

### Sub-fase 4b · `dormir` — SIGUE

**La pregunta 2**: dormir con refugio y fuego para pasar la noche. Piezas que ya
existen y se reusan, no se reinventan:

- **Fuego cerca**: `fundicion.cercano(RADIO_HORNO_M, h => fundicion.usaFuego(h) && fundicion.arde(h))`
  — el mismo patrón exacto de `Fabricacion.js:85`.
- **Refugio cerca**: `construccion.abrigoEn(x, z)` (`Construccion.js:181-189`) da
  0..1; alcanza con que sea `> 0` (cualquier obra con `abrigo` declarado a menos
  de `RADIO_ABRIGO_M` — hoy 6 m). No hay categoría "vivac"/"ruca" en el dataset
  real (`RONDA9-ARRANQUE.md` lo daba por hecho y no es cierto): son las obras de
  `construccion.json` con `abrigo > 0` (parapeto 0,35, vivac de nieve 0,55, etc.).
- **El salto de reloj**: no existe nada que lo haga hoy (confirmado, no hay
  atajo de "pasar tiempo" en `Jugador.js` ni `Tiempo.js`). Se arma reusando el
  mismo paso que ya corre cada cuadro (`tiempo.avanzar(dt)` + la actualización de
  supervivencia de `Jugador`), repetido en cuadros grandes hasta el amanecer, y
  no con una fórmula aparte que resuma "una noche" de un tirón: así la
  temperatura, el hambre y la sed de dormir abrigado y con fuego salen del MISMO
  modelo térmico que ya está medido, no de un número inventado para la ocasión.
- **El cartel**: se envuelve `recoleccion.quePuedoHacer` desde `main.js` (mismo
  patrón que `partida.reaparecer`): si el original no tiene nada que ofrecer Y
  hay refugio y fuego a mano, se ofrece "Dormir" por la tecla `E` que ya se usa
  para todo lo demás — no una tecla nueva que aprender.

Falta: contrato exacto (qué pasa con hambre/sed durante el salto, cuánto avanza,
qué pasa si el fuego se apaga a mitad de la noche), banco y — clave acá, porque
es una mecánica nueva que hay que sentir jugando — verificación en el navegador.

### El contrato de `dormir`, ya diseñado

**Dónde vive**: dentro de `main.js`, como función local junto a `fuegoCercano`
—no un archivo nuevo—, porque las dos dependen de las mismas variables
capturadas del cierre (`jugador`, `tiempo`, `construccion`, `fundicion`,
`est`) y `fuegoCercano` ya es exactamente ese patrón, no una clase aparte.

- **F1 — Disponible cuando**: `construccion.abrigoEn(pos.x, pos.z) > 0`
  (cualquier obra con `abrigo` declarado a `RADIO_ABRIGO_M` o menos) **Y**
  `fundicion.cercano(RADIO_HORNO_M, h => fundicion.usaFuego(h) && fundicion.arde(h))`
  (el mismo booleano que ya usa `Fabricacion.estacion()`).
- **F2 — El salto reusa la simulación real, no una fórmula aparte**: un bucle
  que llama, en cada vuelta, exactamente los mismos dos pasos que ya corre el
  bucle principal —`jugador.actualizarSupervivencia(dtPaso, est, ESCALA_METABOLISMO)`
  y `tiempo.avanzar(dtPaso)`—, con `est = eventos.aplicar(tiempo.estado())`
  recalculado en cada vuelta (el clima cambia con las horas) y `jugador.fuego =
  fuegoCercano(est)` recalculado también (si el fuego se apaga a mitad de la
  noche, el cuerpo empieza a enfriarse EN EL MISMO bucle, con el mismo modelo
  térmico de siempre — no hay un camino especial "protegido" para dormir).
  `jugador.abrigo` se fija una vez antes del bucle (la posición no cambia). Se
  usa `dtPaso = 5` (5 "segundos equivalentes" por vuelta, contra el 1/60 del
  cuadro a cuadro normal): con la velocidad de reloj que tenga el jugador en
  ese momento, una noche de 8 horas son unas 80 vueltas — nada que se note.
  **La relación entre body-hours y horas de mundo sigue siendo la que da
  `tiempo.velocidad` en ese momento**, la misma que si el jugador se hubiera
  quedado despierto esperando: dormir no es un atajo que evite el costo
  metabólico, evita la MOLESTIA de esperar mirando la pantalla.
- **F3 — Hasta cuándo**: hasta las 7:00 hora local (Bariloche, UTC−3 → 10:00
  UTC) del día siguiente si ya pasó esa hora, o de HOY si todavía no. Un tope
  de seguridad de 14 horas de mundo por si algo no converge (una noche de
  pleno invierno real ronda las 14).
- **F4 — Corta si el jugador muere en el camino**: cada vuelta comprueba
  `jugador.vivo`; si `actualizarSupervivencia` dispara `alMorir` a mitad de
  noche (fuego apagado + sin refugio de verdad + una racha de frío), el bucle
  para ahí, `Partida.registrarMuerte`/`Fin.mostrar` corren exactamente igual
  que si el jugador hubiera muerto despierto — dormir no esconde la muerte.
- **F5 — El cartel**: se envuelve `recoleccion.quePuedoHacer` en `main.js`
  (mismo patrón que `partida.reaparecer`): si el resultado original es `null`
  (no hay nada más que hacer ahí) y F1 se cumple, se devuelve
  `{ tipo: 'dormir', etiqueta: 'Dormir · con refugio y fuego' }`. Se envuelve
  `recoleccion.actuar` igual para despachar a la función de dormir cuando
  `tipo === 'dormir'`. La tecla sigue siendo `E`, la que ya se usa para todo lo
  contextual — no hay que aprender una tecla nueva.
- **F6 — Al despertar**: un aviso (`hud.aviso(...)`, la ranura que ya existe)
  con un resumen mínimo y honesto: cuánto bajaron hambre/sed, si hubo frío. Sin
  puntaje ni "dormiste bien": el mismo tono seco que el resto del HUD.

### Lo que NO pide este contrato

- No pide una animación de dormir ni una cámara especial (fundido a negro y
  vuelta, nada más).
- No pide que el jugador pueda interrumpir el sueño a mitad de camino: es
  atómico, como una hornada.
- No pide tocar `fuegoCercano` ni `Jugador.actualizarSupervivencia`: se llaman
  tal cual están.

### Sub-fase 4b — CERRADA

Implementado en `main.js`, junto a `fuegoCercano` (F1–F6 tal como se diseñaron
arriba). Verificado jugando, con `construccion.abrigoEn`/`fundicion.cercano`
simulados (sin construir de verdad en el mapa, que habría llevado muchas más
acciones reales sin agregar certeza):

- **Sin refugio ni fuego** (14 h de reloj, `dtPaso=5`): hambre 95,0 → 85,3, sed
  95,0 → 79,7, temperatura −1,78 °C.
- **Con refugio (0,55) y fuego ardiendo**, mismas 14 h: hambre y sed bajan
  igual (el costo metabólico no cambia, como pide F2), pero la temperatura sólo
  baja −0,95 °C — **la mitad** que desprotegido. Es el punto entero de la
  mecánica, y se mide, no se supone.
- El tope de seguridad de 14 h se respeta (dormir a mediodía no llega a las
  7:00 del día siguiente de un tirón; corta a las 14 h y el jugador se
  despierta antes del amanecer — comportamiento esperado, no un error).
- El cartel de "E" sigue mostrando lo que ya mostraba cuando hay algo real que
  hacer (probado con una piedra suelta al lado): dormir nunca le saca prioridad
  a una acción real.

Banco `banco-r9-fase4b.navegador.js`: 8/8. **Hueco declarado y no falso**: no
se pudo automatizar la comprobación de que "sólo refugio sin fuego" o "sólo
fuego sin refugio" NO alcanzan (habría necesitado teletransportar al jugador
lejos de cualquier recurso del suelo, y el primer intento aterrizó en agua,
mostrando "beber" en vez de revelar el defecto). Verificado en cambio LEYENDO
el código: `puedeDormir()` devuelve `false` de entrada si no hay refugio, y
sólo entonces mira el fuego — el mismo efecto que una Y. **Si alguien vuelve a
tocar esa función, hay que releerla a mano**, porque este banco no puede cazar
sola una Y que se vuelva O. `vite build` limpio.

### Sub-fase 4c · `hitos` — CERRADA (alcance recortado a la pregunta 5)

**Decisión de la flota, y por qué se recorta el alcance:** los "hitos
intermedios" (primera noche, primera semana, otoño, invierno) que proponía
`r8-primer-anio.md` sección 6 eran una SUGERENCIA del jefe anterior, no una de
las cinco decisiones que el dueño contestó. Las cinco preguntas reales sólo
piden, para esta sub-fase, la pregunta 5 (morir sólo reinicia el logro, no el
contador). Construir además los hitos narrativos sería agregar alcance que
nadie pidió — se anota como pendiente futuro y no se hace ahora.

**Lo que sí pide la pregunta 5, implementado:**

- `Relevamiento.murioEnElAnio` (bandera nueva, persistida junto al resto del
  cuaderno) y `Relevamiento.registrarMuerte()`, que la pone en `true` una sola
  vez y guarda. **No toca `inicioMs` ni `dias`** — el cuaderno sigue
  sobreviviendo a la muerte, exactamente como ya estaba escrito.
- `resumen()` suma `sinMorir: !this.murioEnElAnio`, que es lo que `Cierre.js`
  necesita para mostrarlo.
- Enganchado en `main.js`, junto a `jugador.alMorir` (el mismo punto de
  extensión que ya usa `partida.registrarMuerte`): cada muerte real llama
  también a `relevamiento.registrarMuerte()`.
- `olvidar()` (el reinicio completo del cuaderno) también limpia la racha,
  coherente con que es un reinicio de todo, no sólo de la fecha.
- `Cierre.js` (que ya existía, pregunta 4) suma UN dato más a su grilla —"Sí"/
  "No" a "llegaste sin morir en el camino"— en vez de una pantalla aparte:
  así el año de supervivencia **acompaña** al del relevamiento (pregunta 3),
  no lo reemplaza ni le arma una interfaz separada.

**Verificado**: banco de Node `banco-r9-fase4c.mjs` (`Relevamiento` es una
clase pura, corre en Node de verdad con un `localStorage` de mentira) 5/5,
falsador 4/4 con 1 control limpio. Verificado además jugando: `jugador.alMorir`
real invocado a mano, `murioEnElAnio` pasa a `true`, `dias` queda en `0`, la
bandera sobrevive a un `location.reload()`, y `Cierre.mostrar()` pinta
correctamente la nueva celda ("No" tras la muerte simulada) integrada en la
misma grilla que ya tenía.

**De paso, un defecto propio encontrado y corregido:** el primer falsador que
escribí para esta sub-fase reusó la técnica de "cortar un método buscando su
cierre" (`indexOf('\n  }\n', …)`) de la fase 2 — y esa técnica ya estaba rota
para CUALQUIER archivo con fin de línea CRLF, que es TODO el repo (ver la nota
del 29/9 en `ESTADO.md`, fase 2). Se escribió bien desde el principio acá
(normalizando a LF antes de mutar) y de paso se corrigió el falsador viejo de
la fase 2, que daba un "VISTO" verdadero pero por el motivo equivocado (un
error de sintaxis, no la aserción real).

Pendiente para más adelante, si el dueño lo pide: los hitos narrativos
intermedios de `r8-primer-anio.md` sección 6 (primera noche, primera semana,
otoño, invierno) — no están en las cinco preguntas contestadas.

Las preguntas 3, 4 y 5. El año de supervivencia **acompaña** al del cuaderno
(mismo contador de `Relevamiento.js`, reinterpretado): no hay que crear un
segundo reloj. Falta:

- Un hito nuevo, chico, independiente del contador de días: una bandera de
  "racha sin morir" para el logro "primer año cumplido" (pregunta 5). El
  contador de días (`Relevamiento.dias`) NO se toca —sigue sobreviviendo a la
  muerte, como ya está escrito y como pide la pregunta—; sólo el LOGRO se
  reinicia. Se engancha en `jugador.alMorir` o envolviendo
  `partida.registrarMuerte`, con el mismo patrón de "envolver sin tocar" que ya
  usa el proyecto.
- Los hitos intermedios (primera noche, primera semana con refugio+recipiente,
  otoño preparado, invierno pasado) anotados en el cuaderno.
- `Cierre.js` (ya existe, pregunta 4 ya resuelta en su mayor parte) se enriquece
  con si se cumplió la racha y si se pasó el invierno, sin tocar el epílogo de
  Moreno que ya tiene.

### Sub-fase 4d · `códice` — CERRADA

La ficha del objetivo en el códice (mencionada en `r8-primer-anio.md`, punto 7).
Contenido, no mecánica, y de las cinco preguntas del dueño no pedía ninguna en
particular —es la propia frase de apertura de `Codice.js` la que ya dice «no es
un menú de ayuda: es el objetivo del juego»—, así que se hizo con el criterio
más chico posible: una línea nueva en la cabecera del códice (siempre visible,
cualquiera sea la pestaña), que se dice **una vez, en los primeros tres días de
juego**, y después desaparece sola. No es un `historia.json` inventado —esos
eventos son hallazgos con fuente real, y "el objetivo del año" no es un hecho
histórico— ni una pantalla aparte: es una frase en el lugar donde el propio
archivo dice que vive el objetivo.

Texto: *"El objetivo: llegar al día 365 anotando lo que veas. El invierno es el
desafío central — un refugio y fuego a tiempo son la diferencia."* Verificado
jugando: aparece integrado bajo "Guía de campo · Día 0 de 365" desde el primer
segundo, y desaparece solo (confirmado saltando a día 5) sin dejar un hueco en
el layout (`:empty { display: none }`). `vite build` limpio.

**Con esto se cierra la fase 4 (`primer-año`) entera: 4a, 4b, 4c y 4d.**

---

## FASE 5 · `dormir-b` — dormir de verdad: que se pueda, y que el fuego se apague

Abierta el 3/10/2026 por el jefe nuevo de la ronda 9, al re-medir en el juego lo que
estaba dado por cerrado. **La fase 4b quedó cerrada con dos defectos y un banco
ciego a los dos.**

### El problema, medido antes de escribir el contrato (3/10/2026, en el juego)

Con un parapeto levantado con `construccion.levantar` y una fogata armada con
`fundicion.construir`, de verdad, en el punto de arranque (reserva):

1. **Dormir no se alcanza jugando.** El envoltorio de `main.js` ofrece «Dormir» sólo
   cuando `Recoleccion.quePuedoHacer()` devuelve `null`, y el propio
   `Recoleccion.js` dice que con un coirón por metro cuadrado `mata` no es null
   jamás. Medido: **0 de 40 lugares** al azar (hasta 3 km) dejan salir «Dormir»
   (beber 19, mata 10, chatarra 5, planta 3, orilla 2, carroña 1), y **30 de 30**
   apretadas de E en el campamento real ofrecieron «Juntar…». En el punto de
   arranque sí salió una vez, apenas cargado: el sotobosque todavía no estaba
   sembrado.
2. **El fuego no se apaga durmiendo.** `fuegoCercano()` lee `h.ardiendo`, que sólo
   refresca `fundicion.actualizar(est)` dentro de `cuadro()`; el bucle de `dormir()`
   no la llama nunca. Una fogata con **3 h** de leña calienta las 9 h de la noche
   igual que una de **15 h**: 35,905 °C las dos (con un evento activo) y 36,178 °C
   las dos (sin eventos, condiciones del banco). Al despertar la fogata sigue
   «ardiendo» con la leña agotada hace 6 h. **Causa confirmada** refrescando la
   fundición en cada vuelta (envolviendo `eventos.aplicar`): 3 h → 34,818 °C y la
   fogata apagada; 15 h → 36,178, sin cambio (control). La lluvia tampoco puede
   ahogarla mientras se duerme, por la misma razón.
3. **Despierta a las 7:00 fijas.** El sol sale en el parque entre las 6:20 (21/12) y
   las 9:20 (21/6), medido con `posicionSolar`; la noche de junio dura 15,0 h y el
   tope es 14. En junio despierta 2 h 20 min antes del sol.
4. **El banco de 4b no podía ver nada de esto.** Su G1 aceptaba `null` o cualquier
   objeto (no podía fallar); su G4 falseaba `fundicion.cercano` mientras el calor se
   lee de `fundicion.hornos[].ardiendo`, así que su «con refugio y fuego» corrió
   **sin fuego**: los 0,95 °C anotados en `ESTADO.md` eran sólo el refugio.

La respuesta 1 del dueño (primavera, reloj igual, 84 h reales hasta el invierno) se
aceptó **combinada con dormir** para acortar el camino: con dormir inalcanzable, esa
decisión quedó apoyada en algo que no funciona.

### Las decisiones de la flota, y por qué no son del dueño

- **Dormir sólo de noche** (sol debajo del horizonte). La pregunta 2 que contestó el
  dueño fue «¿se puede dormir con refugio y fuego para adelantar la noche?»: dormir
  a las 13:00 y despertar a las 3:00 no es lo que se contestó.
- **De noche, con refugio y fuego, dormir le gana a lo que puede esperar** (la mata,
  la orilla, la chatarra, la planta, la trampa, la ficha). No le gana a identificar
  un animal desconocido (se va) ni a beber con sed (la regla «la sed mata» de
  `Recoleccion.js`). Sin esa prioridad, la respuesta 2 no existe jugando.
- **Se despierta cuando sale el sol**, con un tope de seguridad de 16 h de mundo.

### El contrato

- **N1 — De día no cambia nada.** Con refugio y fuego y el sol arriba, el cartel es
  exactamente el de la cadena de base y E no salta el reloj.
- **N2 — De noche se puede.** Con el sol debajo del horizonte, refugio (`abrigoEn > 0`)
  Y una fogata que arde a `RADIO_HORNO_M`, el cartel dice «dormir» aunque la cadena
  de base ofrezca algo que puede esperar, y E duerme.
- **N3 — El fuego vive durmiendo.** Cada vuelta del bucle de dormir actualiza la
  fundición como lo hace `cuadro()` (la leña se acaba a su hora, la lluvia moja, las
  hornadas avanzan), antes de medir el calor. Con 3 h de leña la noche termina
  ≥ 1,0 °C más fría que con 15 h y la fogata amanece apagada; con 15 h, igual que la
  base (36,178 ± 0,05 °C).
- **N4 — Hasta que sale el sol.** Se despierta dentro de un paso del bucle (≤ 7 min
  de mundo) después del amanecer real, el 22/9 y el 21/6; sin hora fija.
- **N5 — Y, no O.** De noche, refugio sin fuego o fuego sin refugio no ofrecen dormir.
- **N6 — La sed manda.** De noche junto al agua: con sed, beber; sin sed, dormir. El
  umbral no se escribe dos veces (M1).
- **N7 — Recién despierto no se vuelve a ofrecer** (el sol ya salió).
- **M3/M4 — Sin regresión y `vite build` limpio.**

### Lo que NO pide este contrato

- No pide despertar al jugador si el fuego se apaga a mitad de la noche: eso es
  diseño. Que el cuerpo lo sienta sí (N3), y el aviso de «pasaste frío» ya existe.
- No pide `eventos.golpear` dentro del bucle (el daño directo de una avalancha o un
  viento blanco que se sortee durante la noche). Queda anotado como residuo.
- No pide tocar `Recoleccion.quePuedoHacer()` por dentro: la prioridad se resuelve en
  el envoltorio de `main.js`. Lo único que puede cambiar en `Recoleccion.js` es
  exportar el umbral de sed para no duplicarlo.

### Instrumentos

- `.claude/flota/banco-r9-fase5.navegador.js` — N1 a N7, en el juego real, sin
  reemplazar ninguna dependencia de dormir. Validado contra la base el 3/10/2026:
  N1 8/8 (premisa); N2 0/9, N3 2/4, N4 4/6, N5 2/3 (sólo cae el control «con los
  dos, sí»), N6 1/2 — cada uno rojo por su motivo.
- `.claude/flota/banco-r9-fase5.mjs` — M1 a M4 (Node). Contra la base: M1 y M3
  verdes, M2 rojo (`setUTCHours(10` sigue ahí).
- `.claude/flota/banco-r9-fase5.falsar.mjs` — se escribe con el código del agente a
  la vista (las anclas de los defectos dependen de cómo lo escriba), sin tocar el
  banco.

### Fase 5 — lo que hizo el agente y lo que midió el jefe

**El agente** (dueño de `src/main.js`, sólo el bloque de dormir, y de
`src/systems/Recoleccion.js`, sólo para exportar el umbral):

- `Recoleccion.js` exporta `UMBRAL_SED = 92` y lo usa donde estaba el literal.
- `main.js`: `esDeNoche()` con `posicionSolar` (no `cielo.alturaSol`, que queda
  vieja fuera de `cuadro()`); `puedeDormir()` pide noche, refugio y fogata; el bucle
  de `dormir()` corre `fundicion.actualizar(est)` antes de `fuegoCercano()` y sigue
  mientras sea de noche, con tope de 16 h; se fue `proximoAmanecer`. El envoltorio
  del cartel devuelve la base tal cual si no se puede dormir, y si se puede, dormir,
  salvo `identificar` o `beber` con `sed < UMBRAL_SED`.
- **Un agregado que no se pidió, revisado y aceptado:** cada vuelta cubre como mucho
  6 min de mundo (`dt = min(5, 360 / velocidad)`). A 72× no cambia nada; con «T» al
  máximo cada vuelta eran 10 h de mundo, el fuego se medía dos veces por noche y el
  despertar podía caer 10 h después del sol. La relación entre el reloj del cuerpo y
  el del mundo queda igual.
- Señaló un caso que el contrato no previó: de noche, con sed, junto al agua y con
  una carroña a mano, la base devuelve `carronia` (va antes que la sed) y el
  envoltorio ofrece dormir. Carroña hay en el 1,5 % de los lugares y una noche de
  septiembre cuesta ~10,6 de sed: no mata. Anotado, no se toca.

**Lo que midió el jefe, no el agente:**

- Leído línea por línea contra el contrato; el diff de `main.js` quedó registrado
  (hash) antes de falsar y se comprobó idéntico después.
- **Banco del navegador, código del agente: 34/34** — N1 8/8, N2 9/9, N3 4/4 (3 h →
  34,85 °C y la fogata apagada; 15 h → 36,19 °C y ardiendo), N4 6/6 (despierta 7:42
  el 22/9, a 0 min del sol, y 9:18 el 21/6, a 1 min, tras 14,30 h), N5 3/3, N6 2/2.
  Durmió siempre por el cartel real, nunca por el camino forzado.
- **El HUD, en el juego:** parado en el mismo lugar del campamento, de día dice
  «E · Juntar piedra suelta (2 × piedra)» y de noche «E · Dormir · con refugio y
  fuego».
- **Costo:** el envoltorio ahora pregunta por el sol en cada cuadro. Medido
  alternando 8 rondas contra la cadena de base: +5,0 µs de día y +4,3 de noche,
  sobre 188 y 178 µs que ya cuesta la cadena. `posicionSolar` sola: 1,3 µs.
- **Falsador, mitad navegador, 7/7 vistos y 2/2 controles limpios:**
  `sin-fundicion` → cae N3 sola; `tambien-de-dia` → N1 0/8 y N4 (y N3 de rebote: la
  noche se estira al tope); `solo-si-nada` → N2 0/9 y N6; `o-en-vez-de-y` → N5 sola;
  `siete-fijas` → N4 sola; `sed-no-manda` → N6 sola; `tope-14` → N4 (junio, 9:00,
  17 min antes del sol). Mitad Node: 2/2 vistos (M1, M2), 1/1 control limpio.
- **Lo que tarda y lo que cuesta, medido después:** la noche de junio (14,30 h) se
  duerme en 13 ms a 72×, 23 ms a 24× y 6 ms a 7200×: no congela. Pero el CUERPO paga
  según la velocidad del reloj al acostarse —la regla de siempre: «T» adelanta el
  mundo, no el cuerpo—: esa noche cuesta 9,9 de hambre y 15,6 de sed a 72×, 29,7 y
  46,9 a 24×, y 0,1 y 0,2 con «T» al máximo. Con dormir alcanzable, acostarse con «T»
  al máximo es una noche gratis. No es un defecto de esta fase (se conservó la regla a
  propósito): es una **decisión de balance del dueño**.
- **Lo que este banco no ve, dicho:** la excepción de `identificar` (con el panel
  quieto la fauna no se siembra y no hay animal que poner al lado). Verificada
  leyendo el código.

