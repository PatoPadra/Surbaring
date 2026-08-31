# Bitácora — agente `bucle`

Área: `src/systems/*.js`, `src/world/Hornos.js`, `src/world/Obras.js`, números de
juego en `src/data/*.json`. Misión: acortar la cadena del metal, medir los
primeros veinte minutos, y que cada sistema tenga su gesto.

---

## 1. Diagnóstico

### Cómo medir (importante: el servidor se mudó)

- **El servidor de desarrollo NO está en 5174**: está en **`http://127.0.0.1:5173/`**.
  `curl 127.0.0.1:5174` da 000 y `5173` da 200. El CONTEXTO.md dice 5174 y está
  desactualizado.
- El bucle de render **no corre** en la pestaña del panel (`tiempo.segundosTotales`
  se queda en 0 y la cola del sotobosque no se vacía). Para medir el sotobosque
  hay que forzar la siembra a mano desde el script inyectado:
  `S.sotobosque.sembrarTodo(S.jugador.posicion)` — es síncrono y no depende de rAF.
- Con siete agentes guardando archivos, **Vite recarga la página cada pocos
  minutos** y el arranque tarda ~30 s. Medir en el navegador es caro. Lo que sea
  función pura (jurisdicción, chatarra, recetas, pesos) conviene medirlo en Node.

### Punto de partida (medido en el navegador, sesión anterior)

| dato | valor |
|---|---|
| spawn | x 7633,7 · z −1447,2 · y 824,2 |
| lat/lon | −41,0870 / −71,4290 |
| jurisdicción | **`reserva`** (no `parque`) |
| altura | 822 m |
| humedad del suelo | 0,51 |
| bolso inicial | **vacío** (0 kg) |
| fecha inicial | 12 de febrero de 2025 |
| hornos / obras / saberes | 0 / 0 / 0 |

Que el spawn caiga en `reserva` es la noticia buena y no estaba escrita en ningún
lado: **el fuego está permitido desde el primer paso** (`evaluarFuego` sólo niega
en `parque`) y **la chatarra ya existe ahí** (`hayChatarra` la niega sólo en
`parque`; en `reserva` la da con probabilidad 0,14 por celda de 40 m).

### La cadena del metal, contada en pasos (ANTES)

Leída de `src/data/mineria.json` y `src/systems/Fundicion.js`:

1. chatarra ×3 — `Mineria.recuperarChatarra`, 1..3 por celda de 40 m ⇒ **2 a 3 celdas**
2. carbonera — 12 leña + 4 arcilla (arcilla sólo sale de piedra junto al agua, 45 %)
3. carbón vegetal — 6 leña → 2 carbón · **30 h de mundo**
4. fragua — 12 piedra + 6 arcilla + **2 cuero** (cuero ⇒ caza de exótica o carroña)
5. reforjar hierro — 3 chatarra + 2 carbón → 2 hierro · 4 h
6. herramienta — 2 hierro + 1 madera + 1 carbón → 1 herramienta · 4 h

Total mínimo de horas de mundo hasta la primera herramienta: **30 + 4 + 4 = 38 h**,
y el carbón alcanza justo: 2 carbón de una hornada, pero el paso 5 pide 2 y el
paso 6 pide 1 ⇒ **hacen falta 2 carboneras ⇒ 68 h de mundo**.
Materiales acumulados: 18 leña + 12 piedra + 10 arcilla + 3 chatarra + 2 cuero + 1 madera.

**Números pendientes de medir**: distancia del spawn a la chatarra más cercana,
metros de caminata hasta 6 leña + 4 piedra, y si la primera noche mata.

---

## 2. Hecho

### La chatarra NO está lejos: la premisa del encargo era falsa

Medido en Node (`jurisdiccion` y `hayChatarra` son funciones puras; conversión
`lat = -41.10 - z/111320`, `lon = -71.52 + x/83888`):

- El spawn cae en **`reserva`**, no en `parque`.
- La celda con chatarra más cercana está a **40 m** del spawn. Las ocho primeras:
  40, 100, 110, 130, 140, 160, 180, 180 m.
- El **13,0 %** de las celdas de 40 m del km² alrededor del spawn tienen chatarra
  (88 de 676). Con un rinde de 1..3 (media 2), juntar 3 chatarra son **~2 celdas**.

O sea: el primer eslabón está a la vuelta de la esquina y **no hay que cruzar
medio mundo**. Lo que hacía inalcanzable la cadena estaba más adelante.

### Lo que sí la hacía inalcanzable: un círculo en el árbol de saberes

`herreria_colonial` —la tecnología que habilita la receta `herramienta`— **costaba
4 hierro + 4 carbón**. O sea que para poder hacer tu primera herramienta de hierro
tenías que haber hecho hierro dos veces antes. El comentario de `Fundicion.js` ya
se había cuidado de no poner la fragua detrás de la herrería justamente para
evitar «un bloqueo circular perfecto»; el círculo estaba una casilla más allá, en
el precio de la tecnología.

Medido con `node .claude/flota/cadena-bucle.mjs herramienta 1`:

| | ANTES | DESPUÉS |
|---|---|---|
| horas de mundo | **196** | **38** |
| carboneras (30 h c/u) | 6 | **1** |
| reforjados de hierro | 3 | **1** |
| unidades a juntar | 85 | **54** |
| leña | 48 | **24** |
| chatarra | 9 | **7** |
| cuero | 2 | **1** |
| arcilla | 10 | **8** |
| puntos de saber | 26 | **20** |

A la velocidad normal del reloj (24×) 196 h eran **8 h 10 min de espera real**;
38 h son **1 h 35 min**, y con `T` en 7200× son 19 s. El cuerpo corre siempre a
24× (`ESCALA_METABOLISMO` en `main.js`), así que adelantar el reloj no mata: el
costo de esperar es del mundo, no del cuerpo.

### Los cuatro números que cambié

1. `src/data/historia.json` · `herreria_colonial.materiales`:
   `4 hierro + 4 carbón + 3 piedra` → **`4 chatarra + 2 carbón + 3 piedra`**, y
   `costoSaber` 26 → 20. Rompe el círculo, y es más fiel a la tesis del propio
   README: una fragua de puesto aprendía arruinando chatarra, no gastando barras
   de hierro terminadas. La `descripcion` y el `contextoHistorico` no se tocaron.
2. `src/data/mineria.json` · `carbon_vegetal`: `6 leña → 2 carbón` pasa a
   **`12 leña → 4 carbón`**, **mismas 30 h**. El rendimiento no cambia (un tercio,
   que es el dato educativo), cambia el tamaño de la pila. Es lo históricamente
   correcto: los días de quema los fija el tamaño del montículo y su tiro, no la
   cantidad de leña, y por eso las carboneras se armaban grandes. La `nota` se
   reescribió para que siga diciendo la verdad.
3. `src/data/mineria.json` · `refundir_hierro`: carbón 2 → **1**.
4. `src/data/mineria.json` · `fragua.materiales`: `12 piedra + 6 arcilla + 2 cuero`
   → **`10 piedra + 4 arcilla + 1 cuero`**. El fuelle sigue siendo de cuero —eso
   es histórico— pero pedir 2 obligaba a resolver todo el sistema de caza o de
   carroña **antes** de tocar el primer metal.

**Ninguna negativa se tocó.** El artículo 5 sigue prohibiendo cantera y fuego en
el área núcleo, la fauna nativa sigue sin cazarse y la Ley 25.743 sigue
protegiendo los sitios. Lo que se acortó son pasos y cantidades, no permisos.

### El defecto que rompía el bucle entero: la tecla apuntaba al pasto

`Recoleccion.quePuedoHacer` resolvía el suelo con `sotobosque.masCercano(p, 5)`,
que devuelve la instancia **más próxima de cualquier tipo**. Densidades medidas
con la fórmula de aptitud del propio `Sotobosque.js` en el spawn (alt 822 m,
humedad 0,51, pendiente 10°):

| tipo | 1 cada | vecino más cercano |
|---|---|---|
| coirón | **1 m²** | 0,6 m |
| pastizal húmedo | 4 m² | 1,0 m |
| helecho | 30 m² | 2,7 m |
| michay | 30 m² | 2,7 m |
| piedra suelta | 64 m² | 4,0 m |
| **tronco caído** | **1939 m²** | 22,0 m |
| **carroña** | **5120 m²** | 35,8 m |

Parado sobre el único tronco a la vista, con su centro a 1,7 m, la probabilidad
de que haya un coirón o un pastizal más cerca es del **100,00 %** (P de que no
haya relleno en los 5 m: 5 × 10⁻⁴¹). O sea:

- **Juntar leña era imposible.** La tecla daba 2 de fibra en vez de 4 de leña,
  siempre. Y el aviso de frío de `main.js` termina diciendo «juntá de los troncos
  caídos», que era justo lo único que no se podía hacer.
- **La carroña era inalcanzable**, y es una de las dos vías legales al cuero, o
  sea a la fragua.
- **La chatarra y la cantera eran código muerto**: su rama está al final de
  `quePuedoHacer` y sólo se llega si `mata` es null, cosa que no pasa nunca.

Es el mismo defecto que el `if (!h.trabajo)` del fuego: sistema entero, bien
escrito, inexistente para el jugador porque el gesto que lo activa apunta a otra
cosa.

**Arreglo** (todo en `src/systems/Recoleccion.js`):

- Un método nuevo `_delSuelo(p, ahora, radio)` que hace **un solo barrido** —antes
  eran dos llamadas a `masCercano`, dos barridos de 13.700 instancias dos veces
  por segundo— leyendo las matrices de instancia crudas, y devuelve la mejor mata
  y la carroña más cercana juntas. No gana el más cerca: gana el que más vale
  (`VALE`: tronco 4, piedra 3, michay 2, helecho 1, coirón y pasto 0) y entre
  iguales el más cerca. El descanso se consulta sólo para el que va ganando.
- Nuevo orden de la tecla: identificar → carroña → permiso → beber → **tronco**
  → **chatarra/cantera** → planta → piedra/michay/helecho → pasto → ficha.
- El tronco va antes que la planta porque la madera dura del coihue sirve para
  «madera» y para «tronco» pero **no para «leña»**: el tronco caído es la única
  fuente, y hay uno cada 1939 m² contra una planta cada pocos metros.
- La chatarra va antes que la planta y que la piedra. Bajarla sólo un escalón no
  alcanzaba: en los 5 m de alcance hay 2,6 michays, 2,6 helechos y 1,2 piedras,
  así que seguía sin salir el **99,8 %** de las veces. Lo que decide no es cuánto
  vale cada cosa sino cuál se puede juntar en otro lado.

Verificado con `node .claude/flota/bucle-recoleccion.mjs`, un banco que reproduce
las densidades medidas y pregunta qué hace la tecla en cinco situaciones. Los
cinco casos dan lo esperado; antes del arreglo los tres primeros daban coirón.

### Los primeros veinte minutos, medidos en el juego que corre

Verificado en `http://localhost:5173/` con el guión inyectado, forzando la
siembra con `sotobosque.sembrarTodo()` porque el bucle de render no corre en la
pestaña del panel. Ruta codiciosa desde el spawn hasta juntar lo de una fogata
(6 leña + 4 piedra), levantando de verdad con `recoleccion.actuar()`:

**La ruta es cortísima: 4 acciones y 32 metros.** Los dos primeros objetivos —dos
piedras— están a 1 y 2 m; los dos troncos, a 18 y 12 m. El tronco más cercano al
spawn está a 15 m y la chatarra más cercana a 40 m. No hay nada que caminar.

Lo que fallaba era la tecla. Corriendo la línea vieja (`sotobosque.masCercano(p, 5)`)
sobre esos mismos cuatro puntos:

| punto | ANTES | DESPUÉS |
|---|---|---|
| tronco 1 | **coirón** | tronco |
| tronco 2 | **coirón** | tronco |
| piedra 1 | piedra | piedra |
| piedra 2 | piedra | piedra |
| leña juntada | **0** | **8** |
| piedra juntada | 4 | 4 |
| ¿alcanza para la fogata? | **NO** | **SÍ** |

O sea: la piedra sí se podía levantar —uno se para justo encima, distancia 0— y
la leña **nunca**, porque un tronco mide 3,4 m y su centro queda siempre más
lejos que el coirón de al lado. Con 0 de leña la fogata era inalcanzable, y con
ella el calor, la comida cocida y la cadena entera del metal.

Después del arreglo, en el mismo recorrido de 32 m el bolso queda con
**8 leña + 4 piedra + 2 corteza**, y `alcanzaFogata` da verdadero. La chatarra
del punto a 40 m también se levanta con la tecla de acción.

---

## 3. Siguiente

- El resto de los gestos: caza, pesca, saberes, relevamiento y exploración
  siguen sin un disparador propio. La chatarra y la cantera ya lo tienen.
- Queda sin mirar si la primera noche mata. En la partida medida el jugador
  estaba a 36,6 °C con viento de 20 km/h y sin abrigo, a 822 m y en febrero, que
  es el caso benigno del README; falta el caso de altura.

---

## 4. Descartado

- **Medir con `javascript_tool` sin inyectar**: corre en mundo aislado, no ve
  `window.SurviBar`. Confirmado.
- **Esperar a que el bucle de render corra en la pestaña del panel**: no corre.
  `tiempo.segundosTotales` queda en 0 aunque la pestaña esté al frente.
- **Puerto 5174**: no hay nada escuchando.
