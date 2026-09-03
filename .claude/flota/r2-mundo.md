# Bitácora — jefe **mundo**, ronda 2

Archivos propios: `src/world/Agua.js`, `Terreno.js`, `Vegetacion.js`,
`Sotobosque.js`, `Cielo.js`, `src/engine/Posproceso.js`.
Rama `mejoras/ronda2-jugabilidad-graficos`. **Nadie commitea acá.**

Se escribe a medida que se trabaja. Lo que no esté en disco no existe.

---

## 0. Reparto de territorio entre los tres frentes — resuelto antes de largarlos

El encargo avisa de dos costuras reales. Así quedaron cortadas:

| Frente | Escribe | Lee pero NO escribe |
|---|---|---|
| **F1 agua** | `src/world/Agua.js` | `Terreno.js`, `Calidad.js`, `Cielo.js` |
| **F2 vegetación** | `src/world/Vegetacion.js`, `src/world/Sotobosque.js` | `Terreno.js`, `Calidad.js` |
| **F3 terreno** | `src/world/Terreno.js` | `Agua.js`, `Vegetacion.js`, `Calidad.js` |
| **jefe (yo)** | `Cielo.js`, `Posproceso.js`, integración | — |

- **Costura orilla (F1 ↔ F3):** el alfa, la espuma y el color del agua son de
  F1 dentro de `Agua.js`. El oscurecido del lecho mojado (`Terreno.js:613`) es
  de F3. Si F1 necesita tocar el lecho, me pasa el parche y lo aplico yo.
- **Costura suelo (F2 ↔ F3):** el albedo/grano del suelo es de F3. El apoyo de
  las matas sobre el suelo y el corte del sotobosque son de F2.
- **Los dos defectos de `veg` que piden medición de memoria** (ocho vistas de
  impostor, corte del sotobosque a 192 m) se los di a **F2**, no a F3, porque
  viven en sus archivos. F2 mide su propia memoria.
- `Calidad.js` es del coordinador: los parches por preset van a
  `.claude/flota/pendiente-r2-mundo.md`.

## 1. Diagnóstico

### 1.1 Confirmado leyendo el código: el reparto malla/cartelera salta 96 m de golpe

`Vegetacion.js:284-427`. `_sembrar(cx,cz)` corre **entero** en cada cambio de
celda, y la distancia con la que decide malla contra cartelera se mide desde
**el centro de la celda nueva**:

```js
const centroX = (cx + 0.5) * TAM_CELDA;   // TAM_CELDA = 96
const dist = Math.hypot(x - centroX, z - centroZ);
const umbral = DIST_IMPOSTOR * (1 + (hashPos(x,z) - 0.5) * JITTER_IMPOSTOR);  // 120 m
```

O sea: la referencia **se teletransporta 96 m (135 m en diagonal) de una vez**
contra un umbral de 120 m. No es un ajuste fino que el desvío por `hashPos`
pueda absorber: es un corrimiento del orden del propio umbral. Todos los
árboles de una banda ancha cambian de estado **en el mismo cuadro**. Ese es el
candidato número uno del frente 2 y queda confirmado por lectura; falta el
número (cuántas instancias cambian) y eso lo mide F2.

Lo que la ronda anterior **sí** arregló y no hay que rehacer: `_ordenarPorDistancia`
(444) y el desvío estable `hashPos` (353, 1291). Los dos están en el código.

### 1.2 El agua en Baja: el preset apaga el espejo, y ahí es donde el dueño juega

`Calidad.js` da `reflejoAgua: 0` en `baja` y `minima`. Medido por el
coordinador: el reflejo cuesta **0,0 ms** en Baja. O sea que **la definición
que el dueño ve no pasa por el mapa de reflejo en absoluto**: es todo camino
procedural. Cualquier hipótesis del frente 1 que dependa del espejo está
mirando otro juego. Es lo primero que tiene que verificar F1.

### 1.3 Terreno: 11,0 ms de 31,1, el 35 % del cuadro

Es la única pieza con algo grande para ganar. Ronda 3 de
`docs/medicion-cuadro.md` ya dictaminó que **es costo por píxel, no por
vértices** (recortar el 64 % de los nodos del cuadrantoárbol ahorró el 13 %).
F3 arranca de ahí, no de la geometría.

## 2. Hecho

- Reparto de territorio cerrado y escrito (arriba).
- Comprobación barata de sintaxis GLSL validada en esta máquina:
  `node --input-type=module -e "await import('./src/world/Agua.js')"` → OK en
  los seis módulos. Es la red que evita el `SyntaxError` por comilla invertida
  que ya tumbó el juego dos veces.

### `.claude/flota/lint-shader.mjs` — herramienta nueva, y VALIDADA

Corre sin navegador y sin servidor: `node .claude/flota/lint-shader.mjs`.
Atrapa los tres defectos de shader que este proyecto ya pagó con una ronda cada
uno: **uniforme usado y no declarado**, **`${` dentro de un comentario GLSL** y
**chunks de profundidad logarítmica faltantes**. De yapa marca uniformes
muertos.

**Validado con un control negativo**, que es lo que `medicion-cuadro.md` exige y
lo que nadie había hecho: se le sacó a `Terreno.js` la línea
`uniform float uDetalleAlcance;` —el defecto exacto de la ronda 3, el que hizo
medir una mejora de 3,4× que era el suelo dibujado en blanco liso— y el lint lo
cantó: «`uDetalleAlcance` se usa en GLSL y NO está declarado». Sobre el árbol
real da cero errores. **El instrumento reacciona a lo que dice medir.**

Dos hallazgos reales suyos, los dos ciertos:

1. **`Terreno.js` `uMezclaEstacion` es un uniforme muerto**: se declara en la
   tabla (263) y en el shader (355) y **nadie lo lee**. Se sube a la GPU en cada
   cuadro para nada.
2. **`Cielo.js` no lleva los chunks `logdepthbuf_*`.** En Baja no importa —la
   profundidad logarítmica está apagada en la placa de destino— pero en Alta y
   Media sí está encendida. Anotado abajo, en «lo que miro yo».

### Los subagentes murieron, y NO fue una decisión de nadie

**Corrección del 3/9, importante para no heredar un error.** Esta bitácora decía
que «el dueño detuvo» dos de los tres frentes y que por eso no los relancé. Es
falso: **los tres murieron por el mismo error 429 de límite de tokens** que
cortó la sesión entera, igual que los subagentes de los otros dos jefes. No hubo
ningún acto deliberado que respetar. El razonamiento era correcto para la
información que había; la información era falsa.

Ninguno de los tres dejó nada en disco —ni bitácora ni una línea de fuente—, así
que **los tres frentes se rehacen desde cero**, con la ventaja de que el
diagnóstico caro (1.1 y 1.2, acá arriba) ya está hecho y no se repite.

**Instrucción nueva del dueño (3/9), textual:** «de a 3 a la vez, volvé por las
más avanzadas e iterá así hasta terminar; va a ser más prolijo y eficiente». O
sea: los tres jefes corren en paralelo y **ninguno despliega subagentes**. Los
tres frentes los hago yo, en serie, en este orden:

1. **Aparecer/desaparecer** — diagnosticado, pedido explícito, es el más avanzado.
2. **El agua en Baja** — arranca del hallazgo 1.2, que es la pista más fuerte.
3. **El terreno** — el más caro de medir y el que más margen necesita.

Si el límite vuelve a cortar, que corte con lo más importante ya escrito.

---

# FRENTE 1 — «los elementos siguen apareciendo y desapareciendo» · CERRADO

## El número que faltaba

Medido con la siembra real reproducida en Node (`popin.mjs`), caminata recta de
1500 m: **~100 instancias cambian de estado malla↔cartelera en cada cruce de
celda, sobre 103 árboles de malla en total.** No es que se vea entrar y salir un
árbol: **es el bosque cercano entero dándose vuelta de un cuadro al otro.**

Confirmado por un segundo camino independiente, analítico: la diferencia
simétrica de dos discos de radio 120 m con los centros a 96 m es el **99 %** del
disco. En diagonal (135 m de salto) da más del 100 %, o sea que se da vuelta más
de una vez el equivalente de la población.

## Lo que NO era, y se midió antes de descartarlo

**Usar la posición real del jugador en vez del centro de la celda casi no
ayuda**: 100 → 96 cambios en línea recta, 103 → 71 en diagonal. Era el arreglo
«obvio» y habría costado una tanda de trabajo para nada. El problema no es
**dónde** está la referencia sino **cada cuánto se actualiza**.

## El mecanismo, y por qué el arreglo es una separación y no un ajuste

`_sembrar` hacía dos trabajos pegados:

1. **Decidir qué árbol hay y dónde** — caro: 6.842 candidatos por resiembra, y
   cada uno paga la aptitud de **26 especies**. Son ~178.000 evaluaciones de
   aptitud más ~34.000 consultas al mundo, **todas en un solo cuadro**. No
   depende de dónde esté parado el jugador dentro de la celda.
2. **Decidir cómo se dibuja cada uno** — barato: una distancia y una matriz.
   Es lo único que sí depende del jugador.

Como estaban juntos, el barato heredaba la cadencia del caro: una vez cada 96 m.

**Separados**, el reparto puede correr cada **8 m**, que es un reparto cada 2,4 s
caminando y no cuesta una sola consulta al mundo. La caída es proporcional al
paso, medida analíticamente: 96 m → 99 %, 48 → 51 %, 24 → 25 %, **8 → 8 %**.

## Verificación — con el `_repartir` REAL, no con una copia

Arnés de Node que invoca `Vegetacion.prototype._repartir.call(...)` sobre un
objeto con la forma que el método espera: **lo que se mide es el código que va a
correr en el juego.** Caminata recta de 1500 m:

| | eventos | cambios simultáneos (media) | **pico** | total en 1500 m |
|---|---|---|---|---|
| **Antes** — una vez por celda de 96 m, desde el centro | 15 | 72,9 | **105** | 1094 |
| **Ahora** — cada 8 m, desde el jugador | 187 | 6,4 | **15** | **1203** |

**El pico de cambios simultáneos baja de 105 a 15: siete veces menos.** La media,
de 72,9 a 6,4: once veces menos. Eso es lo que el dueño ve.

Y el resultado incómodo, que hay que decir con todas las letras: **el total de
relevos en 1500 m SUBE un 10 %** (1094 → 1203). No baja, y no queda igual: sube.

### Por qué sube, que es más interesante que el número

Los dos totales **no cuentan el mismo fenómeno**.

Con el esquema viejo el estado de un árbol sólo podía cambiar en una resiembra,
o sea cada 96 m. Un árbol que cruzaba su umbral hacia afuera y volvía a entrar
dentro del mismo tramo de 96 m **no producía ningún cambio**: los dos cruces se
cancelaban antes de que nadie los mirara. El esquema viejo no es que tuviera
menos transiciones: **tenía menos oportunidades de expresarlas**, y agrupaba en
un solo salto grande lo que en el mundo eran varios cruces chicos.

Con el reparto cada 8 m cada cruce real se expresa cuando ocurre. El 10 % de
más son, en su mayor parte, cruces que antes existían igual y quedaban tapados
por el muestreo grueso.

O sea: el total no es la magnitud a comparar, porque el «antes» lo
**subdeclaraba**. La magnitud que sí compara lo mismo de los dos lados es la
**simultaneidad**, y ahí la mejora es de siete veces. De a seis árboles en vez
de a cien es la diferencia entre «el bosque parpadeó» y «cambió un árbol» —
aunque en total cambien un poco más árboles.

### Y un error de método mío, que es lo que hay que aprender de esto

Los números 5,7 y 1058 que estaban acá antes **salían de otra corrida**. El
arnés se puede correr trasplantando o no el estado de histéresis entre
resiembras; la fila «antes» la tomé de la corrida CON trasplante —que es la
correcta, porque sin él esa fila da 0 por un artefacto del conteo— y la fila
«ahora» de la corrida SIN. **Mezclé dos corridas en una tabla**, y la mezcla
cayó justo del lado que me favorecía: hacía parecer que el total bajaba.

Lo detectó el coordinador corriendo el banco que dejé en disco, que es
exactamente para lo que sirve dejarlo. `r2-mundo-repartir.mjs` corre siempre con
trasplante, o sea que las dos filas salen de la misma corrida y son comparables.
**Si un número no se puede recalcular, no vale — y si sale de dos corridas
distintas, tampoco.**

## Qué quedó cambiado en `src/world/Vegetacion.js`

1. **`_sembrar(cx, cz, px, pz)`** ya no escribe en los búferes de instancia:
   deja los individuos en una lista plana de arreglos tipados (posición, escala,
   cuaternión, color, umbral, lote). Sigue corriendo una vez por celda de 96 m.
2. **`_repartir(px, pz)`** es nuevo: clasifica y llena los búferes. Corre cada
   8 m (`PASO_REPARTO`), y también al final de cada resiembra.
3. **`HISTERESIS_IMPOSTOR = 3` m**: banda muerta para que un árbol parado justo
   sobre su umbral no rebote con cada paso. Hace falta **por** el reparto fino.
4. **El filtro de claros se movió ANTES de la ruleta de 26 especies.** Descarta
   uno de cada cinco candidatos, y ahora cada descarte se ahorra las 26
   aptitudes. El resultado es idéntico —el claro no depende de la especie— y
   **paga el costo del reparto más frecuente**.
5. Se dejaron de asignar `new THREE.Quaternion()` y `new THREE.Vector3()` por
   árbol (eran ~8.600 objetos por resiembra); ahora se reusan.

## Costo

**Neto negativo o nulo**, razonado pieza por pieza:

- **Se saca** ~20 % del trabajo de la resiembra (el filtro de claros adelantado)
  y ~8.600 asignaciones por resiembra.
- **Se agrega** el reparto cada 8 m en vez de cada 96: 12× más repeticiones de
  la mitad barata. Esa mitad es ~4.300 composiciones de matriz y un ordenamiento
  por lote — **cero consultas al mundo, cero aptitudes**, que es donde estaba el
  99 % del costo.
- **Sube a la GPU** 4.300×16 flotantes (~275 KB) cada 2,4 s en vez de cada 28 s:
  ~115 KB/s. Irrelevante.
- **No cambia un solo píxel del shader**, así que el costo por píxel —que es
  donde vive el presupuesto de esta placa— queda **exactamente igual**.

Lo que además desaparece es un **tirón de cuadro cada 96 m**: las 178.000
aptitudes seguían siendo un pico en un cuadro, pero ahora hay ~20 % menos y la
otra mitad del trabajo ya no se suma encima.

## Comprobado

- `node --input-type=module -e "await import('./src/world/Vegetacion.js')"` → OK.
- `node .claude/flota/lint-shader.mjs src/world/Vegetacion.js` → sin errores.
- El contrato con `Calidad.recortarInstancias()` se respeta: `lote.n` sigue
  siendo el total sembrado y el recorte sigue siendo idempotente. De hecho
  **mejora**, porque `lote.n` ahora se actualiza cada 8 m y no cada 96.
- `masCercana()` no se tocó y sigue leyendo `lote.n`.

## Para que lo mire el dueño en pantalla

Que camine por bosque cerrado en Baja y mire la franja de **100 a 140 m**. Lo
que tiene que haber cambiado es la **simultaneidad**: antes se veía un pestañeo
del bosque entero al cruzar ciertas líneas invisibles cada 96 m; ahora tendría
que verse, si acaso, un árbol suelto cambiando de vez en cuando.

---

---

# FRENTE 2 — «el agua sigue con problemas de definición» · CERRADO

## Qué era, y por qué no era ninguna de las hipótesis habituales

Se verificó primero lo que el hallazgo 1.2 señalaba, y es lo que ordena todo lo
demás: **en Baja y Mínima `reflejoAgua` vale 0 y el espejo planar cuesta 0,0 ms**
—o sea que no se dibuja—. El jugador de la placa de destino **nunca ve el
espejo**: ve el camino procedural. Eso descarta de entrada «la resolución del
mapa de reflejo», que era uno de los candidatos.

Lo que quedaba era mirar qué hace ese camino procedural lejos, y ahí estaba:

```glsl
float nitidez = 1.0 - smoothstep(60.0, 420.0, distOjo);
vec3 N = vec3(0.0, 1.0, 0.0);
if (nitidez > 0.01) { N = normalOleaje(...); }
```

**Pasados 420 m la normal es (0,1,0) exacta.** El aplanado es correcto y la ronda
anterior lo puso por una razón buena —el ruido de período 1,8 m ahí es subpíxel y
hormiguea— pero deja al agua lejana con **una sola** fuente de variación: el
reguero del sol, que sólo existe mirando hacia el sol.

**Medido, reimplementando este mismo camino en Node:** la desviación de
luminancia del agua a más de 420 m era **cero exacto**, a 420, 700, 1.200, 2.500
y 6.000 m. No «poca»: cero. Matemáticamente una constante.

Y eso es justo lo que el dueño ve, porque el Nahuel Huapi es enorme: **parado en
la orilla, casi todo el lago que entra en pantalla está más allá de 420 m.** La
ronda anterior arregló el agua de cerca y el color; lo que quedó sin resolver es
la superficie de casi toda el agua visible.

## El arreglo: rugosidad, no geometría

Las olas no se pueden devolver —volverían con su aliasing—. Lo que un lago tiene
a esa distancia no son olas: son **rachas**, los manchones de agua rizada y agua
vidriada de cientos de metros que dibuja el viento.

Se modelan como **rugosidad**, un escalar de baja frecuencia (período ~285 m),
y ahí está el punto: **no puede caer por debajo del píxel ni hormiguear por lejos
que se mire**. A 2.500 m un manchón de 285 m subtiende ~6,5°, unos 90 píxeles de
alto a 576p. Es el detalle que faltaba, resuelto por el único lado que no
reintroduce el defecto que el aplanado vino a matar.

## Un error propio, encontrado midiendo, que vale dejar escrito

El primer intento mezclaba la racha **contra el color de horizonte**. Medido:
±0,4 % de luminancia — invisible. La razón es que mirando rasante **el domo
reflejado ya ES color de horizonte**, así que mezclar hacia el horizonte no mueve
nada. Si me hubiera quedado en «lo escribí, se ve bien», habría entregado un
cambio que no hace nada.

Donde sí hay contraste que romper es en la **silueta del cerro**: la ladera
reflejada es mucho más oscura que el cielo, y lo que hace el agua rizada es
precisamente romper esa imagen. La racha entra ahora bajando `tapa` y subiendo la
elevación efectiva del rayo reflejado.

## Verificación

Reimplementación del camino lejano en Node, barrido de 120×120 puntos a 1.200 m:

| caso | contraste pico | sd/media | antes |
|---|---|---|---|
| **con el cerro reflejado** (lago de montaña rasante) | **49 %** | 19,1 % | **0 exacto** |
| con el cerro a medias | 13 % | 5,0 % | 0 exacto |
| agua abierta sin cerro | 5 % | 1,9 % | 0 exacto |

Reparto de superficie: **19 % rizada, 37 % vidriada**, el resto en transición. Es
una **veta**, no un moteado parejo — que era el riesgo de cambiar «lámina de
plástico» por «manchas de camuflaje».

Que el efecto sea proporcional a cuánto cerro se refleja es **físicamente
correcto**: las ondas sólo se ven donde hay contraste que romper.

**Campo cercano: idéntico bit a bit** (|diferencia de media| = 0,00e+0 a 10, 40 y
59 m). Está garantizado por construcción —`rugosidad` lleva un factor `lejos` que
vale 0 ahí— y además comprobado. Nada de lo que la ronda anterior calibró de
cerca se tocó.

## Qué quedó cambiado en `src/world/Agua.js`

1. Bloque de **rachas de viento** (dos octavas de ruido de período ~285 y ~110 m,
   con arrastre lento en la dirección del viento real), dentro de un
   `if (lejos > 0.01)` para no pagarlo en el campo cercano.
2. La racha **baja `tapa`** (borronea el cerro reflejado) y **sube la elevación
   efectiva** del rayo (una superficie rizada devuelve un pedazo más ancho de
   cielo, no un punto).
3. La racha **ensancha el lóbulo especular** y baja su pico: el reguero queda
   deshilachado en las vetas y afilado entre ellas. Los dos factores valen
   **exactamente 1** con rugosidad 0, así que el reguero de cerca no se movió.
4. Se pisó y se arregló, en vivo, **la trampa de la comilla invertida en un
   comentario GLSL**: escribí ``«tapa»`` con comillas invertidas y cerró el
   literal de plantilla. `node --input-type=module -e "await import(...)"` la
   cantó al instante. Es la tercera vez que este proyecto la paga; la
   comprobación de importación la atrapa gratis.

## Costo

**+0,1 a +0,3 ms estimado en Baja**, y así sale la estimación: son **2
evaluaciones de ruido** por fragmento de agua lejana. La referencia es
`normalOleaje`, que hace **9** y es el grueso del costo del agua cercana. El agua
entera cuesta 1,4 ms de 31,1 (4,5 %); el campo lejano hoy hace **cero** ruido, así
que pasa de 0 a 2 sobre una base de 9. No toca el campo cercano ni el espejo (que
está apagado). Sigue estando muy por debajo de lo que la ronda anterior ahorró al
achicar la banda de aplanado.

## Para que lo mire el dueño en pantalla

Dos cosas, las dos de una sola mirada:

1. **La fuerza de la racha.** Es un solo número: `Agua.js:717`,
   `tapa *= 1.0 - rugosidad * 0.40`. Si el lago lejano queda manchado, bajarlo a
   0,25; si sigue pareciendo plástico, subirlo a 0,55 (64 % de contraste era el
   valor con 0,55; lo bajé a 0,40, que da 49 %, sin poder verlo).
2. **La línea de espuma de la orilla**, que sigue sin poder confirmarse desde
   acá y viene pendiente de la ronda anterior. El mecanismo está verificado
   (tres bandas); falta la mirada.

---

---

# FRENTE 3 — el terreno, 35 % del cuadro · CERRADO

## Dónde se van los 11 ms: se fue por lecturas de textura, no por ruido

La historia del proyecto ya había dictaminado que el terreno **es costo por
píxel y no por vértices** (ronda 3: recortar el 64 % de los nodos del
cuadrantoárbol ahorró el 13 %), y que las octavas de ruido ya están todas detrás
de su puerta de distancia. Así que fui a contar lo otro que se paga por píxel y
que nadie había contado: **las lecturas de textura**.

Contadas una por una sobre la inyección del fragmento, con las puertas de Baja
(`uDetalleAlcance` = 0,35), aparecieron **tres lecturas de texturas de punto
flotante que no hacían falta**:

1. **`uTexNormal` se leía dos veces con la UV idéntica** — una en
   `<map_fragment>` (`nrm`) y otra en `<normal_fragment_begin>` (`normal`). Es
   **incondicional**: la pagaba cada fragmento de terreno, a cualquier distancia.
2. **`uTexCobertura` se leía dos veces con la UV idéntica** — `cob` en
   `<map_fragment>` y `cobN` dentro del bloque de relieve fino. La segunda la
   pagaba todo fragmento a menos de 105 m en Baja.
3. **`uTexCobertura` se leía una TERCERA vez, y el resultado no se usaba.** En
   `<roughnessmap_fragment>`:
   ```glsl
   vec4 cobR = texture2D(uTexCobertura, vMundo.xz / uTamanoMundo + 0.5);
   float altR = vMundo.y;
   float nieveR = smoothstep(..., altR);   // cobR no aparece nunca más
   ```
   Una textura de punto flotante por fragmento de terreno, guardada en una
   variable que nadie lee. **Incondicional.**

Las dos primeras se resuelven guardando la muestra en un global del fragmento y
releyéndola: three pone `map_fragment` **antes** que `normal_fragment_begin` —lo
comprobé leyendo `THREE.ShaderLib.physical.fragmentShader`, no de memoria—, así
que el global ya está escrito cuando la sección de normal lo necesita. **La
salida es idéntica bit a bit**: es la misma muestra, no una aproximación.
Comprobado además que `nrm` no se reasigna en el medio.

### El conteo, antes y después

| banda | antes | después | |
|---|---|---|---|
| **incondicional** (cualquier distancia) | **6** | **4** | **−33 %** |
| dentro de 105 m (relieve fino de la normal) | 11 | 8 | −27 % |
| dentro de 34 m | 13 | 10 | −23 % |

**Dos lecturas de textura de punto flotante menos en CADA fragmento de terreno**,
y tres en el que está a menos de 105 m. El terreno ocupa casi toda la pantalla y
son texturas de punto flotante, que es de lo más caro que se le puede pedir por
píxel a una HD 4000.

**Estimación honesta del ahorro: entre 0,6 y 1,6 ms de los 11,0** (o sea del 5 al
15 % del terreno, del 2 al 5 % del cuadro). El rango es ancho a propósito: sé
exactamente cuántas lecturas saqué —el conteo de arriba es exacto— pero **no
puedo medir en la placa sin el banco de GPU**, que pide navegador, y esta ronda
no lo tiene. Lo que sostengo sin rango es el mecanismo: son lecturas que se
hacían y ya no se hacen, y ninguna de las tres afectaba un solo píxel de la
imagen.

## El defecto de calidad: «el suelo no tiene material bajo los pies»

Estaba en `ESTADO.md` como diagnosticado y sin empezar. **No era falta de
detalle: era un desajuste entre dos mitades del mismo fenómeno.**

- La gravilla del **albedo** (`pasoCorto`) se recortaba con `alcance`, que en
  Baja vale 0,35: moría a **5,6 m**.
- La escala de la **normal** que ilumina ese mismo grano (`f3`) **no** se recorta
  por preset: llega a **11 m**.

O sea que entre 5,6 y 11 m la luz rasante engancha en un grano **que no tiene
color**. El relieve está y el material no: eso es literalmente «no tiene
material». Arreglado poniéndole un piso al alcance de esa única banda
(`alcanceCerca = max(alcance, 0.69)` → 16 × 0,69 = **11,0 m**, el mismo número
que `f3`). No es un gusto: es hacer que las dos mitades terminen en el mismo
lugar.

Es además la banda más barata que existe: son los últimos metros, que mirando al
frente ocupan la franja de abajo de la pantalla. Costo: 2 octavas de ruido
(`fbmTriCorto`) sobre el anillo de 5,6 a 11 m.

## El uniforme muerto

**`uMezclaEstacion` borrado** de `Terreno.js`: se declaraba en la tabla de
uniformes y en el shader, y **nadie lo leía**. Lo encontró el lint. Se subía a la
GPU en cada cuadro para nada.

## El aviso de `Cielo.js`: revisado, y NO se toca

El lint marca que el `ShaderMaterial` del domo no lleva los chunks
`logdepthbuf_*`. Lo revisé antes de arreglar nada, y **no es un defecto en la
placa de destino**:

- En **Baja y Mínima la profundidad logarítmica está apagada** (la ronda 4
  decidió apagarla en esta placa), así que no hay dos codificaciones que mezclar.
- En Alta y Media sí está encendida, pero el domo es una esfera de 42 km con
  `depthWrite: false` dibujada **última**: en las dos codificaciones su
  profundidad queda pegada al plano lejano, o sea detrás de todo. El test da el
  mismo resultado.

Queda como **inconsistencia latente documentada**, no como arreglo. Tocar un
cielo que anda para resolver un no-defecto en hardware que no es el de destino es
exactamente lo que las reglas del proyecto dicen que no se haga.

## Comprobado

- `node --input-type=module -e "await import('./src/world/Terreno.js')"` → OK.
- `node .claude/flota/lint-shader.mjs src/world/Terreno.js` → sin errores, y ya
  **sin** el aviso de uniforme muerto.
- **Volví a pisar la trampa de la comilla invertida**, esta vez en mis propios
  comentarios de `Terreno.js`, y la comprobación de importación la cantó al
  instante. Van dos veces en esta sesión (la otra en `Agua.js`). Sin esa
  comprobación, el juego habría quedado sin cargar y el próximo en abrirlo
  habría buscado el error en el shader, que es donde no está.

## Para que lo mire el dueño en pantalla

Que mire **el suelo a tres o cuatro metros, caminando en Baja**. Tiene que
haberse extendido el grano de gravilla desde 5,6 m hasta 11 m, o sea que el
manchón marrón desenfocado del medio debería tener ahora la misma textura que ya
tenía pegado a los pies.

---

# FRENTE 4 — el `.slice(0, 26)` de las especies · CERRADO

Ruteado por el coordinador. **La decisión la tomé yo y está medida.**

## Lo que el corte estaba haciendo, medido

La lista filtrada tiene **38** especies leñosas y el corte dejaba **26, por
orden de renglón del JSON**. Nadie había decidido eso.

Y el orden del archivo resultó estar **correlacionado con la humedad**, así que
el corte no se llevaba una muestra al azar: se llevaba **el extremo seco entero**
del gradiente oeste-este —neneo, quilembay, mata negra, espino negro, retamo,
rosa mosqueta— más los tres pinos exóticos.

Medido sobre el gradiente real del parque (altitud 700-2000 × humedad 0-1, 567
celdas, con la **misma** función de aptitud que usa la siembra):

| humedad (altitud 900) | especies aptas con 26 |
|---|---|
| **0,00 — estepa pura** | **0** |
| 0,05 | 1 |
| 0,10 | 1 |
| 0,20 | 5 |

**Cero.** Media mitad del parque se dibujaba sin un solo arbusto leñoso, y las
dos especies que la definen —neneo y quilembay— eran justamente de las cortadas.
Eso no es una preferencia estética: es un bioma vacío.

## La decisión, y por qué 30 y no 38

El cupo es una cuenta de **memoria de video**, no de gusto: cada especie cuesta
un atlas de vistas de 512×768 con mipmaps (~2,0 MiB) más sus búferes de
instancia. Las 38 enteras costaban ~+20 MiB que **no puedo verificar en la placa
sin navegador**, y el modo de fallar de quedarse sin memoria en una HD 4000 es
pantalla negra por pérdida de contexto. No lo iba a arriesgar a ciegas.

Pero encontré de dónde sacar la plata. **Los topes por lote estaban
sobredimensionados por dos órdenes de magnitud**, y la cota dura es aritmética,
no una estimación: *un lote no puede tener más instancias que candidatos hay en
una resiembra*, y los candidatos son **6.842**. Con `MAX_IMPOSTORES = 12000` se
reservaba casi el doble de lo posible **aunque una sola especie se llevara el
mundo entero**. Medido en el juego: 4.194 carteleras y 103 mallas **entre los 26
lotes juntos**.

| | atlas | carteleras | mallas | total |
|---|---|---|---|---|
| **antes** 26 × (12000 / 1200) | 2,0 | 0,870 | 0,087 | **76,9 MiB** |
| **ahora** 30 × (7000 / 600) | 2,0 | 0,507 | 0,044 | **76,5 MiB** |

**Cuatro especies más y 0,3 MiB MENOS.** Las cuatro se las paga el desperdicio
que ya estaba ahí. 7.000 sigue por encima de la cota dura de 6.842, así que
desbordar es imposible; las mallas quedan con 600 contra un peor caso medido de
~161.

## El criterio nuevo: nicho, no renglón

1. **No se saca ninguna de las que ya estaban.** Probé primero una reordenación
   pura por nicho y **dejaba afuera al alerce y al arrayán** —el árbol emblema de
   la región y el bosque que le da nombre a un sitio de este mismo parque—, más
   los dos mañíos. Un criterio que borra eso está optimizando el número
   equivocado, y además el códice y las recetas nombran especies concretas.
2. **Las plazas que sobran se llenan por escasez**: gana la que más aporta donde
   la lista está más flaca, pesando cada celda por `1/(1 + cubierta²)`. El cupo
   se va solo al extremo seco en vez de agregar el décimo árbol del bosque
   húmedo.

Entran: **neneo, murtilla negra, quilembay, pino murrayana.**

## Verificación — con la función real del archivo, no una copia

| | antes (26) | **ahora (30)** | techo (38) |
|---|---|---|---|
| celdas del gradiente sin especie apta | 89 | **64** | 64 |
| aptas en estepa pura (humedad 0) | 0 | **2** | — |
| aptas con humedad 0,05 | 1 | **3** | — |
| aptas con humedad 0,20 | 5 | **8** | — |

**Con 30 la cobertura iguala a la de las 38 enteras.** Las 8 que quedan afuera no
cierran ni una celda nueva: su nicho ya está cubierto. Y ninguna franja de
humedad empeora respecto de hoy. Comprobado además que **no se sacó ninguna** de
las 26 anteriores.

## Y las especies nuevas no cuestan llamadas de dibujo donde no crecen

`lote.malla.visible = lote.n > 0`. Parece obvio y no lo era: con `count` en 0 la
llamada de dibujo se emite igual, con su cambio de estado y su programa. Con
esto, **el costo por cuadro lo fija la diversidad LOCAL y no el largo de la
lista**: en la estepa no se paga el bosque húmedo y en el bosque húmedo no se
paga la estepa. Hoy había hasta 52 llamadas emitidas (26 lotes × malla +
cartelera) estuvieran o no pobladas; ahora se emiten sólo las pobladas, que en
cualquier punto del mapa son un puñado. **Es un ahorro neto de llamadas de dibujo
respecto de hoy, con cuatro especies más en la lista.**

## Costo

**Memoria: −0,3 MiB.** **Llamadas de dibujo: menos que hoy.** **Resiembra: +15 %**
en el bucle de aptitud (30 especies en vez de 26), compensado por el −20 % que ya
había ganado el frente 1 al adelantar el filtro de claros. Neto de la resiembra:
**−8 %** respecto del árbol original. Cero costo por píxel.

## Para el coordinador: el canje de `cana_colihue` NO sobra

`juego` movió `cana_colihue` al índice 22 canjeándola con `taique`. **Sigue
siendo necesario y no quedó redundante**: la base de mi selección son las
primeras 26 por orden de archivo (deliberadamente, para no sacar nada que hoy se
dibuje), así que el orden del JSON **sigue decidiendo** quién entra en esa base.
Sin el canje, `cana_colihue` competiría por las 4 plazas de escasez con humedad
mínima 0,4 —zona bien cubierta— y **no entraría**. Comprobado sobre el
`flora.json` que está en disco: con el canje aplicado, `cana_colihue` queda
adentro y `taique` afuera.

O sea: el acoplamiento «orden del JSON → qué se dibuja» **se achicó pero no
desapareció**, y queda documentado acá para que nadie lo redescubra reordenando
el archivo sin saberlo. No toqué `flora.json`.

---

# Para que el dueño lo mire en pantalla — TODO JUNTO

Cinco cosas, todas de una sentada, **jugando en Baja**:

1. **El bosque, caminando.** Mirá la franja de 100 a 140 m. Antes se veía un
   pestañeo del bosque entero al cruzar líneas invisibles cada 96 m; ahora
   tendría que verse, si acaso, un árbol suelto cambiando de vez en cuando.
   (Pico de cambios simultáneos: 105 → 15.)
2. **El lago lejano, mirando a un cerro que se refleje.** Tiene que haber vetas
   de agua rizada y agua vidriada, de cientos de metros, cruzando despacio con el
   viento. Antes era un degradé liso, sin ninguna variación.
3. **La fuerza de esa veta**, si te queda manchado o si te sigue pareciendo
   plástico. Es **un solo número**: `Agua.js:717`, `tapa *= 1.0 - rugosidad *
   0.40`. Manchado → bajalo a 0,25. Plástico → subilo a 0,55. Lo dejé en 0,40
   por prudencia porque no lo puedo ver.
4. **El suelo a tres o cuatro metros, caminando.** El grano de gravilla ahora
   llega a 11 m en vez de 5,6, así que el manchón marrón desenfocado del medio
   debería tener la misma textura que ya tenía pegado a los pies.
5. **La estepa**, si vas al este seco. Antes no tenía **una sola** especie
   leñosa; ahora tiene neneo y quilembay, que son las que la definen de verdad.

Y una que viene de la ronda anterior y sigue sin poder verificarse desde acá:
**la línea de espuma de la orilla**. El mecanismo está verificado —son tres
bandas, no un canto duro—; falta la mirada.

---

# Bancos en disco — cualquiera puede recalcular estos números

Correr desde la raíz del repositorio. Ninguno necesita navegador ni servidor.

| banco | qué número sostiene |
|---|---|
| `node .claude/flota/r2-mundo-popin.mjs` | los **~100 cambios de estado por cruce de celda**, por dos caminos independientes: la siembra real reproducida y el control analítico de la diferencia simétrica de dos discos |
| `node .claude/flota/r2-mundo-repartir.mjs` | la tabla **105 → 15** de pico de cambios simultáneos, invocando el **`_repartir` REAL** de `Vegetacion.js` |
| `node .claude/flota/r2-mundo-agua.mjs` | el **cero exacto** de variación del agua lejana y el 49 % de contraste de las rachas; lee de `Agua.js` las dos constantes calibradas para no desincronizarse |
| `node .claude/flota/r2-mundo-especies.mjs` | la **estepa sin una sola especie apta**, la cobertura de 30 igualando a la de 38, y la cuenta de memoria; usa las funciones **reales** `aptitudDe` y `elegirEspecies` |
| `node .claude/flota/r2-mundo-siembra.mjs` | el costo de una resiembra: 6.842 candidatos, la cota dura de instancias por lote |
| `node .claude/flota/lint-shader.mjs` | el lint de shaders, validado con control negativo |

**Cuatro cifras se corrigieron contra los bancos**, y valen las de los bancos:

1. El **total de relevos sube a 1203** (no 1058: sube un 10 %, no baja un 3 %) y
   la media es **6,4** (no 5,7). Las viejas salían de mezclar dos corridas del
   arnés. Es la corrección importante y está explicada arriba, en el frente 1.
2. El contraste de la racha es **49 %**, no 48.
3. El reparto de superficie es **19 % rizada / 37 % vidriada**, no 22/35.
4. La memoria da **−0,3 MiB**, no −0,4.

Ninguna cambia una conclusión. Pero las cuatro se corrigieron **porque existían
los bancos**, y la primera se corrigió porque otro los corrió: un número que no
se puede recalcular no vale, y uno que sale de dos corridas distintas tampoco.

---

## Estado: los cuatro frentes cerrados. No commiteé nada.

## 4. Descartado

- **Levantar el servidor / abrir el navegador**: prohibido por el encargo, y
  además el panel no compone cuadros. Todo se verifica por mecanismo y con
  scripts de Node.
- **Medir en preset Alta para decidir sobre Baja**: ya pasó una vez y costó una
  ronda entera. Todo número de esta ronda se razona contra Baja 1024×576.
