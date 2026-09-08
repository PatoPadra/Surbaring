# Revisión de DISEÑO DE JUEGO — `src/data/herramientas.json`

Revisor: agente de diseño, ronda 4. No se editó `herramientas.json` ni ningún otro archivo.

**Qué NO cubre este informe, porque ya está cubierto y sería duplicar:**
`.claude/flota/r4-economia.mjs` mide el grafo de materiales (53 hallazgos: `lana` sin
fuente, `poncho_witral` y `moscas` fuera del cierre, el pozo de 1011 puntos de saber, los
20 objetos con el `nivel` mal etiquetado). `.claude/flota/r4-revision-codigo.md` mide la
viabilidad técnica y ya encontró que `Saberes.requisitoPara()` devuelve **la primera**
tecnología con la clave, así que marcar `caza:true` en `boleadora` **rompe el arco** en vez
de dar dos vías. Doy esos tres por leídos y me ocupo de lo que ninguno de los dos puede
medir: **cómo se juega esto**.

Método: se recorrieron las cadenas contra el código real y se midieron las distancias sobre
el DEM de `public/data/dem/` con Dijkstra usando el modelo de marcha de `Jugador.js`
(3,4 m/s, penalización de cuesta con carga, 48° de pendiente máxima, agua a 0,55×). El
detalle está en el anexo.

---

## Veredicto en tres líneas

1. **Resuelve el pedido literal y rompe el juego que ya andaba.** Ahora existe una cadena
   completa hasta la tabla; el precio es que **52 de los 57 objetos y casi todo lo que hoy
   se hace en la primera hora** quedan detrás de una caminata de **6,4 km y 700 m de
   desnivel**, medida en **30 a 37 minutos reales**, hasta la cota 1500 donde aparece la
   obsidiana.
2. **La tesis no se traiciona: se queda sin tema.** `talar` y `abrir cantera` sólo son
   legales fuera del área protegida, y ahí —medido sobre 3,8 millones de celdas de tierra—
   la humedad media es **0,20** y sólo el **0,1 %** del suelo tiene troncos caídos. El
   jugador no se va del Parque a talar: se va a una estepa pelada. La tentación que la
   tesis quería administrar **no existe**.
3. **Sobra alrededor de un tercio del catálogo.** Nueve armas para un único bit
   (`faltaPara('caza')`), tres objetos de luz para un sistema de iluminación que no existe,
   siete verbos sin ningún consumidor, y un subsistema entero de apicultura —4 objetos,
   2 obras, 5 recursos, 2 tecnologías— que es lo más lejos que hay del pedido del dueño.

---

## 1 · ¿Resuelve el pedido?

### «Necesito tablones»

La secuencia completa desde cero, con la primera acción que la habilita en cada escalón:

| # | Paso | Qué cuesta |
|---|---|---|
| 1 | Identificar 4 especies | 8 pts de saber · ~5 min |
| 2 | **Caminar a la cota 1500** | 6,36 km, +678 m · **37 min** caminando / **30 min** con el ciclo de carrera |
| 3 | Levantar piedras hasta juntar 3 obsidianas | 28 % por piedra ⇒ ~11 recogidas ⇒ **30,8 kg de piedra** sobre un bolso de 38 |
| 4 | Aprender `lasca_obsidiana` | 8 pts + obsidiana 2 + piedra 1 |
| 5 | Fabricar la **lasca** | obsidiana 1 + piedra 1 — **primera herramienta, a los ~45-55 min** |
| 6 | Cordel, mango labrado | fibra 3 → cordel 2; madera 2 + cordel 1 |
| 7 | Bajar y buscar carroña (1 cada 5120 m²) | cuero → tiento (1 cuero = 4 tientos) |
| 8 | Aprender `hacha_pulida` + fabricar el hacha | 16 pts + piedra 3 + cordel 2; piedra 2 + mango 1 + tiento 4 |
| 9 | `trozar` un caído | → tronco 2 · **el hacha por fin sirve** |
| 10 | Arcilla en la orilla (45 % por piedra) | ≥8 unidades ⇒ ~9 recogidas afortunadas |
| 11 | Fogata (leña 6 + piedra 4) + carbonera (leña 12 + arcilla 4) | **30 h de mundo por hornada**, 3 hornadas |
| 12 | Juntar **28 de chatarra** (1-3 por vez, 12,5 % de las posiciones, nunca en el área núcleo) | ~14 recogidas |
| 13 | Fragua (piedra 10 + arcilla 4 + cuero 1) | |
| 14 | Aprender `herreria_colonial` | 20 pts + chatarra 4 + carbón 2 + piedra 3 |
| 15 | Refundir 8 hornadas | chatarra 24 + carbón 8 → **hierro 15** |
| 16 | Aprender `aserradero_hidraulico` | 32 pts + hierro 6 + madera 8 |
| 17 | Forjar la **sierra** | hierro 3 + mango 2 + carbón 2 |
| 18 | **Caminar a jurisdicción provincial** | 9,5 km · **58 min** desde el punto de partida |
| 19 | Levantar el aserradero | hierro 6 + madera 8 + piedra 6 |
| 20 | Acarrear troncos de 6 kg desde el bosque húmedo hasta la estepa | ~5 por viaje sobre 38 kg de bolso |
| 21 | `aserrar_tabla` | tronco 1 → tabla 4, 3 h |

**Veintiún pasos, 76 puntos de saber, 4 tecnologías, 3 hornos, 4 hornadas y tres travesías
de más de media hora.** El archivo dice, textual, «Siete escalones, pero ahora cada uno se
ve». Son veintiuno, y el paso 20 —acarrear el tronco 9,5 km hasta donde no hay árboles—
no lo vio nadie.

**¿Se disfruta?** La primera mitad sí: subir a un cerro por una piedra concreta que se
astilla en una hoja de vidrio es exactamente lo que el dueño pidió cuando nombró Rust.
Pasado el hacha se convierte en una lista de mandados de logística: chatarra, carbón,
esperar, chatarra, carbón, esperar. Y el remate está fuera de sitio: el jugador termina
la cadena más larga del juego **fuera del parque, en la estepa, arrastrando troncos**.
Rust también termina en logística, pero en Rust el destino de la tabla es una base que se
defiende. Acá la tabla va a un galpón, una capilla y una colmena de cuadros. **La cadena
no tiene una razón final que valga veintiún pasos.**

### «Tengo que cazar, ¿con qué?»

Peor, y por un motivo que el archivo no vio.

- Hoy `arco_colihue` cuesta 12 pts y pide `cana 3 + tendon 1`. **Las dos cosas se juntan a
  mano en los primeros diez minutos.**
- Con este archivo, `cortar_cana` pasa a `nivelMinimo 1` y `descuerar` sin herramienta
  entrega **sólo hueso**. O sea: **los dos únicos materiales del arco quedan detrás de la
  lasca**, y la lasca detrás de la caminata de 37 minutos.
- La vía alternativa (boleadora) pide `curtido_cuero` → `lasca_obsidiana`. Mismo cuello.
- Y cuando por fin hay arco, **hace falta una flecha**: `cana 1 + punta 2 + pluma 2 +
  brea 1`. La brea pide `carbon`, el carbón pide la carbonera, la carbonera pide arcilla y
  una quema de **30 horas de mundo**. **No se puede tirar una flecha sin haber construido
  antes una carbonera.** Para un arma de nivel 1 eso es absurdo, y convierte a la
  boleadora —`piedra 1 + cuero 1` por bola, sin brea— en la respuesta obviamente correcta.
  El arco, que es la pieza que el juego ya tenía y de la que el README está orgulloso,
  queda como la peor opción del árbol.
- `pluma` **no la entrega nada**. El propio archivo lo admite en `pendienteSinSistema` y
  aun así la mete en la única munición del arco.
- Cuatro de las nueve armas (`garrote`, `honda`, `lanza_colihue`, `estolica`) declaran
  `caza_menor`/`caza_mayor` y **el juego las va a negar igual**, porque `Caza.js` pregunta
  por tecnología y `efectosAAgregar` sólo pone `caza:true` en `boleadora` y `arco_colihue`.
  Se puede fabricar una lanza con punta de obsidiana y que el juego conteste «a mano limpia
  no se caza un animal de este porte».

**La respuesta honesta a «tengo que cazar, ¿con qué?» que este archivo produce es: con
nada, durante la primera hora, y después con la boleadora.**

---

## 2 · Los primeros treinta minutos

**Minuto 1-10 (hoy, sin este archivo).** Junta fibra, leña, piedra, frutos. Identifica
bichos y plantas y gana puntos. A los 3-5 minutos tiene leña 6 + piedra 4 y `main.js:829` le
enseña `G` y la fogata. Levanta un parapeto (leña 8 + fibra 3). Aprende `fuego_friccion` y
`botica_bosque`. Es un arranque correcto y está bien resuelto.

**Qué le agrega este archivo a esos diez minutos.** Tres objetos: `cordel_fibra` (un
insumo, no un verbo), `garrote` (habilita `rematar`, que sólo sirve sobre una trampa, y las
trampas necesitan una entidad persistente que no existe) y `antorcha` (declara `luz: 12`
sobre un motor que **no tiene iluminación puntual**, cosa que el propio archivo confiesa).
**Verbos nuevos jugables en el nivel 0: cero.**

**Qué le saca.** Esto es lo grave, y no está anotado en ninguna parte del archivo:

| Cosa que hoy se hace en la primera media hora | Con este archivo pasa a estar detrás de… |
|---|---|
| Cortar caña colihue | la lasca (37 min de caminata) |
| `cesteria_junco` y el canasto **+6 kg** | ídem — `junco` sólo llega por equivalencia desde `cana` |
| **Vivac** (`cana 6 + cuero 2 + fibra 2`), abrigo 0,55 | ídem, por partida doble: caña **y** cuero |
| Cuero y tendón de la carroña | ídem — sin filo la carroña da sólo hueso |
| `arco_colihue`, `curtido_cuero`, `toldo` | ídem |

El vivac es, según el propio README, lo que en la costa del lago **«alcanza para pasar de
perder salud a estar seguro»**. Este archivo lo empuja detrás de una caminata de media hora.
**La primera noche se vuelve más difícil, no la progresión más clara.**

**Minuto 10-30: la caminata.** 6,36 km hasta la primera celda de 1500 m, al suroeste, hacia
el López. A 3,4 m/s por la ruta óptima —sabiendo exactamente adónde ir— son **37,1 minutos**;
con el ciclo de carrera (4,17 m/s efectivos) **30 minutos**. Un jugador que no sabe adónde
va tarda el doble. Y el día del juego dura **20 minutos reales** (reloj a 72×), así que la
caminata cruza **una noche y media**.

Ahí está el nudo que ninguna hoja de cálculo detecta:

> **La cota 1500 es donde el juego empieza a lastimar, y el abrigo que protege está del otro
> lado del filo que se va a buscar.**

En julio la estación da mín −1,6 °C; a 1500 m el gradiente de 6,5 °C/km la baja a **−6 °C**,
con viento que sube con la altura. El quillango (abrigo 0,45) pide `cuero_curtido`, que pide
`curtido_cuero`, que pide `lasca_obsidiana`. **Se necesita el filo para hacer el abrigo que
permite ir a buscar el filo.** No es un candado de materiales —el banco de economía dice, con
razón, que no hay ciclos— es un candado **térmico y espacial**, y por eso ningún banco lo ve.

**Lo peor: las dos únicas cosas que un jugador nuevo puede hacer tiran para lados opuestos.**
De los 57 objetos, sólo cinco son anteriores a la obsidiana: cordel, garrote, antorcha,
anzuelos y línea de mano. La línea de mano habilita `pescar` — y `Pesca.js` exige permiso, y
el permiso sólo se saca en la intendencia, a **11,2 km / 68 minutos** hacia el **este**. La
obsidiana está a 6,4 km hacia el **suroeste**. **Las dos primeras metas del juego están a más
de media hora de camino y en direcciones opuestas.**

**Respuesta directa: sí, el nivel 0 es un desierto, y la caminata mata el arranque.**

---

## 3 · Huecos

### Verbos declarados que nada consume

Siete de los 29. Se declaran, se pagan con un objeto, y no destraban ninguna receta, obra ni
regla en todo `src/`:

- **`descarnar`** (justifica al `raspador`) — `curtido` pide `cuero + grasa + ceniza`. Nunca
  pide un cuero descarnado. El raspador existe para un paso que el árbol se saltea.
- **`escuadrar`** — ninguna obra lo pide.
- **`palanquear`** (justifica a la `barreta`) — nada lo pide.
- **`clavar`** (justifica al `martillo`) — las obras piden el recurso `clavo`, no la acción.
- **`reparar`** — el sistema de durabilidad **no existe**. Y el archivo se contradice: la
  sección `fabricacion.desgaste` dice que se repara «en la misma estación donde se fabricó»,
  y la acción `reparar` dice `nivelMinimo 4`.
- **`rematar`** (justifica al `garrote`) — sólo sirve sobre una trampa, y las trampas piden
  una entidad persistente que el archivo reconoce que no existe.
- **`fijar`** — `Pesca.js` no distingue modalidades.

### Cosas que se juntan y no sirven para nada

- **`corteza`**: la entrega `trozar` y `descortezar` en cantidad. La consumen `botica_bosque`
  (4) y `apicultura_rustica` (4). Techo bajísimo contra un rinde alto.
- **`pomez`, `tosca`**: salen de la cantera y sólo entran en `hormigon`, que a su vez no
  entra en nada.
- **`asta`**: hoy vale como comodín de `herramienta` (`Recursos.js:34`). Cuando el nivel 3
  pase a exigir la maza, el asta pierde su único uso genérico y queda con dos recetas.

### Callejones sin salida

- **`poncho_witral`** y **`moscas`** son inalcanzables: piden `lana` y **nada del juego
  produce lana**. El poncho es el **único** objeto de nivel 3 fuera de la cantera, y las
  moscas son la munición del `equipo_mosca`, que el archivo llama «el final del árbol de
  pesca». Ese final está roto. Peor: como `lana` **sí** tiene ficha en `RECURSOS`,
  `tieneFuente()` devuelve `true` y el códice va a decir «te faltan materiales» en vez de
  «esto todavía no existe» — que es exactamente la mentira contra la que
  `Saberes.estado()` está escrito.
- **Los tres objetos de luz** (`antorcha`, `candil_grasa`, `velas_cera`, más el recurso
  `vela`) declaran `luz` y `duracionHoras` sobre un motor sin iluminación puntual. El propio
  archivo dice que declarar un efecto que no existe «es exactamente el defecto que este
  proyecto ya cometió con `curtido_cuero`» — y lo comete cuatro veces en la misma entrega.

### Qué sobra: 57 objetos son demasiados

**Las nueve armas colapsan en un bit.** `Caza.js` pregunta `faltaPara('caza')` y nada más.
Ningún objeto declara alcance, daño, probabilidad ni sigilo: sólo `durabilidad`. Mientras eso
sea así, garrote, honda, lanza, estólica, bola perdida, boleadora de dos, boleadora de tres y
arco son **el mismo objeto con nueve nombres**. Fusionar a tres, cada una con una razón
distinta de existir: **honda** (barata, presa chica, munición del suelo), **boleadora**
(enreda, no hiere — la de acá, y la que discute la ley) y **arco** (alcance, munición cara y
recuperable). Estólica y lanza vuelven cuando exista alcance; garrote se borra.

**El resto de las fusiones, por orden de ganancia:**

| Fusionar / borrar | Por qué |
|---|---|
| `lasca` + `raspador` → **`cuchillo`** llega antes | El cuchillo habilita la unión exacta de los dos y los deja obsoletos el día que aparece |
| `linea_mano` → borrar | Mismo verbo que `cana_colihue`, sólo peor durabilidad |
| `pico_hierro` + `pala_hierro` + `barreta` → **dos** | `pico_hierro` cubre casi todo `pala_hierro`; `barreta` sólo aporta `palanquear`, que no consume nadie |
| `pala_omoplato` / `pico_asta` | Comparten `extraer_arcilla` entre niveles vecinos |
| **Apicultura entera** (4 objetos + 2 obras + 5 recursos + 2 tecnologías) | Es ~20 % de la entrega y lo más lejos del pedido. Pide una entidad de mundo con reloj de 168 h que no existe, gatilla en nivel 2 y termina en nivel 4. Es un DLC, no un eslabón. **Sacarlo a su propia ronda.** |

Eso baja el catálogo a unos **38 objetos** sin perder un solo verbo, y libera el presupuesto
para lo que sí falta.

---

## 4 · La tensión central

**Mi lectura: el árbol no traiciona la tesis. Le quita el tema, que es peor.**

La tesis dice que la ley es contenido y que la negativa es la lección. Para que eso funcione
tiene que haber **tentación real**: algo valioso del otro lado de la línea. El árbol parece
crearla —`talar` y `abrir cantera` sólo son legales en jurisdicción provincial— pero medido
sobre el mundo, no la crea:

| Jurisdicción | Celdas de tierra | Humedad media | Suelo con troncos caídos |
|---|---|---|---|
| Parque | 2.355.767 | **0,777** | **48,5 %** |
| Reserva | 927.972 | 0,527 | 40,5 % |
| **Fuera** | 515.561 | **0,200** | **0,1 %** |

**Donde talar es legal no hay árboles.** El bosque está adentro. El 0,1 % no es un margen: es
ruido. Así que `talar` —la habilidad titular del hacha de piedra, el verbo que el nivel 2
existe para dar— es **decorativo**. Nadie lo va a usar nunca, porque el mismo hacha da
`trozar` sobre caídos, que es legal en las tres jurisdicciones y cubre el 48,5 % del suelo del
Parque.

Las consecuencias de diseño son tres y ninguna es buena:

1. **El dilema moral no se presenta.** El juego nunca le pregunta al jugador «¿talás o no?»,
   porque en el lugar donde podría hacerlo no hay nada que talar. La lección se enseña con un
   cartel, no con una decisión.
2. **La logística sí se presenta, y es tediosa.** El jugador termina acarreando troncos de
   6 kg **9,5 km desde el bosque protegido hasta la estepa desprotegida** para meterlos en un
   aserradero que la ley obliga a poner ahí. Eso es un absurdo que además es *históricamente
   al revés*: el aserradero se ponía donde estaba el monte. El archivo lo intuye —«en el
   juego se alimenta de troncos caídos; en la historia real no fue así»— y no saca la
   conclusión.
3. **El juego termina premiando irse del parque.** No por talar, sino porque **todo el
   nivel 4 vive afuera**: cantera, chatarra en cantidad, aserradero, galpón, cabaña, casa de
   piedra, molino, ahumadero, colmena de cuadros. Un juego cuyo objetivo declarado es el
   códice del parque hace que su última hora transcurra en el ejido de Bariloche.

**La solución de diseño, y creo que es la corrección más importante de este informe:**

> **Convertir la línea en una gestión, no en una frontera.** La Reserva Nacional ya existe en
> el mapa (927.972 celdas, humedad 0,527, 40,5 % con caídos) y su regla real es
> «**autorizable, no autorizado**». Ahí es donde tiene que vivir la tensión: un **permiso de
> aprovechamiento forestal** que se tramita en la intendencia —la misma que ya da el permiso
> de pesca, el gesto ya está escrito y probado—, con volumen máximo, especie declarada y
> vigencia. Talar con permiso adentro de la Reserva es legal, mejor y **más cerca**; talar
> sin permiso es furtivismo y el guardaparque cobra. Eso hace tres cosas: le devuelve el tema
> al hacha, pone el aserradero donde están los árboles, y —sobre todo— transforma «acá no se
> puede» en «acá se puede así», que es lo que un parque nacional de verdad enseña y lo que la
> pesca ya hace bien en este mismo juego.

---

## 5 · Qué agregaría — cinco propuestas

Todas suponen que antes se recorta lo del punto 3. No propongo nada que no reemplace algo.

### 1. `intercambiar` — el trueque, en el nivel 0

**Verbo nuevo: conseguir sin extraer.**
El propio archivo escribe la verdad histórica y después la desobedece: *«No hay obsidiana en
el Nahuel Huapi: la de los sitios arqueológicos vino del norte neuquino por redes de
intercambio de cientos de kilómetros»*. Y después la pone bajo una piedra a 1500 m. **La
respuesta correcta era el trueque, y es además la que arregla el arranque.** Un punto de
intercambio —una posta, un puesto, un sitio del códice ya existente— donde 6 frutos, 4 fibra
o 3 pescados se cambian por una lasca terminada, en la primera media hora y sin subir un
cerro. La obsidiana suelta en altura queda como la vía cara y solitaria; el trueque como la
barata y social. **Vale más que cualquier objeto nuevo porque desactiva el peor problema del
archivo, y es la única propuesta que el propio archivo ya justificó y no siguió.**

### 2. Un segundo filo que no sea obsidiana — nivel 1, primeros diez minutos

**Verbo nuevo: ninguno. Redundancia deliberada.**
Una lasca de **basalto o de dacita** —la roca que sí hay en el Batolito, y la que de verdad
usaron los sitios de la zona junto con la obsidiana importada— sacada de una piedra suelta
sin cota mínima: filo peor (durabilidad 12 contra 40), rinde peor, se rompe. La obsidiana
deja de ser una compuerta y pasa a ser **una mejora**, que es lo que el archivo dice que
quiere («el filo más agudo que existe en la naturaleza»). Un buen filo se merece un viaje;
*tener filo* no. Cuesta un objeto y devuelve la primera hora entera.

### 3. `acarrear` / arrastre de troncos — nivel 2

**Verbo nuevo: mover lo que no entra en el bolso.**
La `rastra` ya está en el archivo (+30 kg, inútil cuesta arriba, `requiereSuelo`) y es la
mejor idea del catálogo, pero está declarada como contenedor pasivo. Convertirla en **verbo**:
enganchar troncos y arrastrarlos, con la ruta importando de verdad —el valle sirve, el cerro
no—. Eso hace legible el paso 20 de la cadena de tablones en vez de esconderlo, convierte la
topografía real del mapa (que es el activo más caro del proyecto) en decisión de ruta, y le da
al nivel 2 un segundo motivo de existir además del hacha. Reemplaza a `barreta`, `pala_hierro`
y `garrote`.

### 4. `permiso de aprovechamiento forestal` — nivel 2, en la intendencia

**Verbo nuevo: pedir autorización.**
Detallado en el punto 4. Reutiliza `Pesca.sacarPermiso()`, `enIntendencia()` y
`comoLlegarAlPermiso()`, que ya están escritos, probados y con la mejor ergonomía del juego
(rumbo, distancia y motivo). Es la única propuesta que **le devuelve el tema a la tesis** y la
que más contenido educativo real agrega por línea de código. Vale más que las 5 tecnologías
nuevas del archivo juntas.

### 5. Extender el planificador del códice de tecnologías a objetos y acciones

**Verbo nuevo: saber qué hacer ahora.**
`Codice._rutaHacia()` (`src/ui/Codice.js:826`) ya resuelve, en posorden, *«todo lo que falta
para llegar a esto, en el orden en que hay que hacerlo»*, con los materiales sumados de toda
la cadena y el conteo de puntos. **Eso es literalmente la respuesta a «necesito tablones pero
no sé cómo hacerlos» y ya está escrito** — sólo que el árbol que recorre son tecnologías, y
la mitad de la cadena nueva son objetos, acciones, estaciones y jurisdicciones. Extender ese
mismo recorrido para que al pedir «tabla» conteste los veintiún pasos con el que falta
resaltado. **El dueño no pidió más objetos: pidió una sucesión de eventos lógica. Esto es esa
sucesión, hecha visible, y cuesta menos que cualquier objeto nuevo del archivo.**

---

## Anexo — cómo se midieron las distancias

DEM real de `public/data/dem/alturas.r16` (2048², 32 m/texel) y máscara de agua del canal B
de `alturas.png`. Dijkstra en 8 vecinos desde el punto de aparición
(`main.js:195`, lat −41,0870 lon −71,4290, cota 827 m), con el coste en segundos derivado de
`Jugador._mover()`: 3,4 m/s de base, `penalizacion = max(0,25 ; 1 − subida·0,55·carga)`
subiendo con `carga = 1,2`, `1 + min(0,22 ; −subida·0,3)` bajando, corte en 48° de pendiente,
0,55× sobre agua. Son **rutas óptimas**: un jugador que no sabe adónde va tarda más, nunca
menos.

| Destino | Recta | Tiempo caminando |
|---|---|---|
| Primera celda ≥ 1500 m (obsidiana) | 6,36 km | **37,1 min** |
| Primera celda ≥ 1700 m | 7,28 km | 42,4 min |
| Jurisdicción provincial (talar, cantera, aserradero) | 9,50 km | **58,4 min** |
| Intendencia (permiso de pesca) | 11,22 km | **67,6 min** |

Con el ciclo de carrera de `Jugador.js:265` (4,17 m/s efectivos, 23 % mejor que caminar) esos
tiempos bajan un 18 %. El reloj del mundo corre a 72× (día de 20 min reales) y el metabolismo
a 24×, así que la caminata a la obsidiana cruza aproximadamente una noche y media.

Reparto por jurisdicción: humedad reconstruida con el modelo de `Mundo._calcularHumedad()`
(interpolación logarítmica de precipitación + término de cercanía al agua) y condición de
tronco caído tomada de `Sotobosque.js:139` (`alt < 1600 && hum > 0,45 && pend < 30°`), sobre
3.799.300 celdas de tierra.
