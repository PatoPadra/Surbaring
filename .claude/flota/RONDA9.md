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

### Sub-fase 4c · `hitos` — SIGUE

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

### Sub-fase 4d · `códice` — SIGUE

La ficha del objetivo en el códice (mencionada en `r8-primer-anio.md`, punto 7).
Contenido, no mecánica: bajo riesgo, se hace al final con todo lo demás ya
decidido.
