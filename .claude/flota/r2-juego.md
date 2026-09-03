# Bitácora — jefe `juego`, ronda 2

Área: `src/systems/*.js` salvo `Exploracion.js` y `Relevamiento.js`;
`src/ui/HUD.js`, `Taller.js`, `Bolso.js`, `Norma.js`; `src/world/Hornos.js`,
`src/world/Obras.js`; `src/data/*.json`.

---

## 0. Reparto interno de los tres frentes (para que no se pisen)

El encargo avisaba del conflicto: los tres frentes tocan la tecla de acción y
`Recoleccion.js`. Repartido **antes** de largarlos:

| Frente | Escribe | Sólo lee |
|---|---|---|
| **1 · ripio** | `src/systems/Recoleccion.js`, `src/systems/Mineria.js` | el resto |
| **2 · recursos** | `src/data/*.json`, `src/systems/Recursos.js`, `.claude/flota/r2-recursos.mjs` | `Recoleccion.js`, `Mineria.js`, `Sotobosque.js` |
| **3 · gestos** | `src/systems/Caza.js`, `Pesca.js`, `Saberes.js`, `Fundicion.js`, `src/ui/HUD.js`, `Taller.js`, `Bolso.js`, `Norma.js` | `Recoleccion.js` |
| **jefe** | integración, `Construccion.js`, `Eventos.js`, `Inventario.js`, `Partida.js`, `Hornos.js`, `Obras.js` | — |

`Recoleccion.js` tiene **un solo escritor**: el frente 1. Lo que salga de la
medición del frente 2 y necesite tocar ese archivo lo aplico yo al integrar.

Bitácoras propias: `r2-juego-f1.md`, `r2-juego-f2.md`, `r2-juego-f3.md`.

---

## 1. Diagnóstico (comprobado contra el código, no contra la bitácora vieja)

### Frente 1 — el aviso de «Abrir depósito de ripio (o R)»

Comprobado en el código, línea por línea:

- `Mineria.yacimientoEn()` (`src/systems/Mineria.js:63-91`) es una cascada de
  cuatro ramas **sin cláusula de jurisdicción**: pómez (y>1450), arena (junto al
  agua, pend<0,22), **ripio (pend<0,16 && y<1000)** y tosca (pend<0,30). La rama
  de ripio se come casi todo el fondo de valle, y la de tosca casi todo el resto:
  `yacimientoEn()` devuelve **algo** en casi cualquier punto con pendiente < 0,30.
- `Recoleccion.quePuedoHacer()` (`src/systems/Recoleccion.js:165-171`) ofrece
  `cantera` con sólo preguntar `yacimientoEn()`, **sin consultar `evaluar()`**.
- `Mineria.evaluar()` (`src/systems/Mineria.js:101-126`) niega **siempre** en
  `parque` y **siempre** en `reserva`. Sólo permite en jurisdicción `fuera`
  (provincial), y encima pide herramienta de hierro.
- El spawn está en `reserva` (medido por `bucle`). O sea: el juego ofrece de
  entrada, casi todo el tiempo, una tecla que **no puede funcionar nunca**.
- El parpadeo: `pendienteEn()` cruza 0,16 y 0,30 a cada paso, así que la etiqueta
  salta entre «ripio», «tosca» y nada. No hay histéresis en ningún lado.

La rama de **chatarra** es otra cosa y está bien donde está: `hayChatarra()`
niega en `parque` pero da verdadero en `reserva` (p = 0,14 por celda de 40 m), y
`recuperarChatarra()` **no** consulta `evaluar()` ni pide herramienta: sólo mira
el sitio patrimonial. O sea, la chatarra sí se puede levantar donde se ofrece.
El defecto es exclusivamente de la cantera.

### Frente 2 — caña colihue, arcilla, arena

- **Caña colihue**: existe en `flora.json` como especie (`cana_colihue`, línea
  1060) y como bioma (`canaveral_colihue`, línea 2220), y `bosque_coihue` la
  lista entre sus especies dominantes. Pero `src/world/Sotobosque.js` sólo
  siembra nueve tipos —coiron, pasto_humedo, coiron_lejos, pasto_lejos, helecho,
  michay, piedra, carronia, tronco— y **ninguno es colihue**. Falta comprobar si
  `Vegetacion.js` la siembra como especie de flora.
- **Arcilla**: sale de una sola rama, `Recoleccion.js:284`, y es un producto
  condicionado tres veces: hay que estar levantando una **piedra suelta** del
  sotobosque (1 cada 64 m²), que además esté **junto al agua**, y encima ganar un
  45 %. Falta medir cuántas piedras del mundo cumplen «junto al agua».
- **Arena**: `yacimientoEn()` la da como «banco de arena», o sea depende de
  `extraer()`, o sea del mismo muro de `evaluar()` del frente 1. Es el mismo
  defecto.

### Frente 3 — los gestos

Teclas ya cableadas en `main.js` (leído, líneas 240-462): F, T, C, O, M, I, E, Q,
G, P (pesca), R (minería), H (caza). O sea **caza y pesca ya tienen tecla**; lo
que hay que preguntar no es «¿existe el gesto?» sino «¿el jugador se entera de
que existe, y le devuelve algo cuando lo usa?». El aviso de bienvenida quedó
reducido a dos teclas en la ronda anterior.

`Saberes.js`, `Fundicion.js`: hay que ver qué gesto los abre.
`Relevamiento.js` y `Exploracion.js` **son del agente carta**: no se tocan.

---

## 2. Hecho

### Los tres frentes largados, con el conflicto resuelto de antemano

Ver el reparto de la sección 0. `Recoleccion.js` tiene un solo escritor.

### Coordinación con el agente `carta`: no hace falta nada

Leído `.claude/flota/r2-carta.md`, línea 97: «No hace falta pedirle nada al
agente `juego`». `Construccion.obras` ya es un array plano de
`{obra, x, z, y, vence, guardado}` y se puede leer sin exponer nada nuevo.

**Un aviso que sí le dejo a `carta` y al coordinador:**
`Construccion.alCambiar` es **una sola ranura**, no una lista, y hoy está
**libre** (`grep` sobre `src/main.js`: nadie la asigna; el único que la usa es
`Partida._reponerObras()` para dispararla). Si `carta` la engancha para redibujar
las marcas del mapa y mañana alguien más la necesita, el segundo pisa al primero
en silencio. Si va a haber dos oyentes, que se convierta en lista.

### Revisión propia de lo que no le tocó a ningún frente

- `src/world/Hornos.js` (87 líneas): leído entero, sin defectos. La brasa se
  interpola hacia `horno.ardiendo` y no hay `quitar()`, pero tampoco hay ningún
  camino que borre un horno, así que no falta.
- **Dónde vive el gesto de la construcción y del depósito**: `grep` sobre todo
  `src/` da que `construccion.levantar()`, `guardarTodo()` y `retirar()` los
  llama **únicamente `src/ui/Taller.js`** (líneas 87, 91, 95), o sea la tecla
  `G`. No hay ningún otro camino: si el jugador no descubre `G`, no construye,
  no guarda y no retira nada, nunca. Eso cae en el frente 3, que es dueño de
  `Taller.js`, y se lo anoto acá para que quede el rastro.
### Herramienta nueva: `.claude/flota/r2-juego-integridad.mjs`

Semáforo de dos segundos para correr al integrar, sin navegador. Existe porque
con tres frentes escribiendo en paralelo un JSON roto o un literal sin cerrar
tumba el arranque **sin decir por qué**, y deja a todos sin poder verificar nada
(la trampa está anotada en `CONTEXTO.md` y ya costó una sesión). Comprueba:

1. Que los siete `src/data/*.json` parseen.
2. Que los 25 módulos del área importen.
3. Que ningún recurso que el juego **entregue** carezca de ficha en `RECURSOS`.

El punto 3 hubo que afinarlo: la primera versión marcaba 35 fallas y **34 eran
falsas**. Un material *pedido* por una tecnología y que no existe **no es un
defecto**: `Recursos.js` lo dice con todas las letras —el árbol llega al reactor
nuclear y pide 31 materiales que ninguna planta puede dar— y `tieneFuente()` los
declara imposibles con honestidad. Eso es contenido. El defecto es el simétrico:
lo que el mundo **te da** y no tiene ficha.

### DOS DEFECTOS ENCONTRADOS: el bolso se come cosas

Los dos son del mismo patrón que el `if (!h.trabajo)` del fuego —sistema entero,
inexistente para el jugador— y ninguno tira error.

**1. `hueso` no tiene ficha.** `src/data/caza.json` lo entrega en tres rindes de
carroña (líneas 349, 366, 387), y la carroña **es alcanzable** desde que la ronda
anterior destrabó la tecla de acción (`Recoleccion.actuar()`, caso `'carronia'`).
No está en `RECURSOS` ni en `EQUIVALE_A`, así que `pesoDe()` cae en el `?? 0.5`
de omisión —medio kilo por unidad que nadie decidió— y `cat` queda `undefined`.
`grep '"hueso"'` sobre el resto de `src/data/*.json` no da **ningún** resultado:
tampoco lo pide ninguna receta. Es peso muerto invisible.
→ Pasado al **frente 2**, dueño de `Recursos.js` y de `caza.json`.

**2. Los dos remedios del juego no se ven en el bolso.** Éste es el grave.
`src/ui/Bolso.js:111-112` dibuja sólo dos grupos:

```js
    for (const cat of ['alimento', 'material']) {
      const grupo = items.filter(i => i.cat === cat);
```

Pero `src/systems/Recursos.js:102-103` declara `emplasto_maqui` y
`lavado_michay` con **`cat: 'remedio'`**, que no es ninguno de los dos. O sea que
los dos remedios —los que `Recoleccion.comer()` usa para curar cuando la salud
baja de 65, y que son el cierre de la tesis del juego entero, «identificar una
planta te salva la noche siguiente»— **el jugador los junta, los tiene, lo curan
y no tiene forma de enterarse de que los tiene**.
→ Pasado al **frente 3**, dueño de `Bolso.js`, con la sugerencia de dibujar los
grupos que de verdad aparecen en vez de agregar `'remedio'` a la lista literal,
que deja la trampa armada para la próxima categoría.

- `src/systems/Partida.js` (349 líneas): leído entero. El guardado serializa
  bien los `Map` (`[...o.guardado]`), repone el trabajo de los hornos y trata la
  hornada vencida. Sin defectos que valgan un cambio.

---

### Corrección: a los tres frentes los mató el límite, no una decisión

Lo había anotado al revés. Los tres subagentes **murieron por el mismo error 429
que cortó la sesión**, igual que les pasó a los otros dos jefes; nadie tomó
ninguna decisión sobre ellos. Instrucción nueva del dueño para esta ronda:
**los tres jefes en paralelo y ninguno despliega subagentes**. Así que los tres
frentes los hago yo, en serie, en esta misma bitácora, del más avanzado al menos.

Lo que alcanzaron a dejar en disco y **no hay que volver a medir**:
`.claude/flota/r2-cantera.mjs` (frente 1, medición hecha) y
`.claude/flota/r2-juego-f2.md` (frente 2, tres diagnósticos cerrados).

### ARREGLADO · `src/ui/Bolso.js`: DOS recursos eran invisibles

> **Corrección tras la revisión independiente (D8).** Acá decía «tres de 55» y
> eran **dos**. `Inventario.listar()` ya rellena la categoría con `'material'`
> por omisión, así que el `hueso` **sí se dibujaba**, bajo «Materiales»; lo suyo
> era otra cosa —pesaba los 0,5 kg de omisión de `pesoDe()` en vez de un peso
> decidido— y se arregló fichándolo. Los invisibles eran los dos remedios. El
> hallazgo se sostiene solo y no necesitaba inflarse. De paso: el grupo «Otros»
> que agregué es, hoy, una red que no atrapa nada; se deja porque cuesta cero y
> evita que el próximo que devuelva una categoría sin título desaparezca.

Los grupos salían de la lista literal `['alimento', 'material']`, así que todo lo
demás desaparecía de la pantalla sin dejar rastro. Ahora los grupos salen **de lo
que de verdad hay en el bolso** y la lista `ORDEN` manda sólo la secuencia, con
«Otros» al final para lo que no tenga categoría. Agregar una categoría nueva a
`Recursos.js` ya no vuelve a esconder nada.

Y como el número de curación no se veía en ninguna pantalla, se agregó `· cura N`
al renglón y un botón **«Curarte»**. Q sólo cura por debajo de 65 de salud, que
está bien como reflejo automático y mal como única puerta: uno se venda **antes**
de salir, no cuando ya está tirado. El botón no gasta el remedio con la salud
llena —gastar un emplasto entero cuando no hace falta es tirar a la basura la
planta que costó identificar—.

**Medido** con un script de Node que reproduce el filtro viejo y el nuevo sobre
el registro entero de `Recursos.js`:

| | antes | después |
|---|---|---|
| recursos en el registro | 55 | 55 |
| **dibujados en el bolso** | **53** | **55** |
| grupos | alimento, material | alimento > botica > materiales |

Lo que se perdía: `emplasto_maqui` (cura 15) y `lavado_michay` (cura 10), los dos
`cat: 'remedio'`. O sea **los dos remedios del juego**,
que son el cierre de la tesis —identificar una planta es lo que te salva la noche
siguiente—: el jugador los juntaba, los tenía encima, lo curaban al apretar Q, y
no tenía forma de enterarse de que los tenía.

Tres recursos con botón «Curarte»: `infusion_canelo` (8), `emplasto_maqui` (15),
`lavado_michay` (10).

### FRENTE 1 CERRADO · el aviso de «Abrir depósito de ripio (o R)»

Tres cambios, en `src/systems/Mineria.js` y `src/systems/Recoleccion.js`.

**1. Un yacimiento es un lugar, no un píxel.** `yacimientoEn()` leía altura y
pendiente del punto exacto bajo los pies, así que la respuesta cambiaba con cada
paso. Ahora se resuelve una vez por celda de 24 m —`FRENTE_M`, la **misma** con
la que se lleva la cuenta de los frentes agotados: el frente que abrís es el que
se agota— y se memoriza la última, que es la que se pregunta dos veces por
segundo para el indicador y otra vez al apretar R. El defecto no estaba en los
umbrales sino en la escala: una terraza glacifluvial tiene decenas de metros, y
preguntarle a un píxel del DEM si es una terraza es preguntarle mal.

**2. No se ofrece nada que la jurisdicción vaya a negar.** `quePuedoHacer()`
anunciaba cantera con sólo preguntar `yacimientoEn()`, **sin consultar
`evaluar()`**. Ahora consulta. La ley no se suavizó ni se escondió: sigue entera
en `evaluar()` y sale por `hud.negativa()` cuando el jugador aprieta `R` a
propósito, que es donde ya estaba escrita y funciona bien.

**3. La chatarra y el árido se separaron.** Salían por la misma rama y son casos
opuestos. La chatarra **se queda arriba**: está en el 13 % de las celdas, sólo
donde hubo gente, es el único hierro de la comarca y —esto es lo que decide—
`recuperarChatarra()` no consulta `evaluar()` ni pide herramienta, así que **si
el aviso aparece, la tecla funciona**. El árido bajó **debajo de la planta**, por
la misma vara con la que la chatarra había subido: donde el árido es legal hay
yacimiento en el 83,5 % de las posiciones, y algo que está en cuatro de cada
cinco pasos no necesita que se lo anuncien.

**Y de yapa, el mismo defecto en el agua.** «Beber agua» se ofrecía siempre que
hubiera agua a mano, incluso con la hidratación llena: una acción que el jugador
puede hacer y que no hace nada, y que encima le sacaba la tecla al tronco que
estaba pisando —la orilla es justo donde se junta la leña varada—. Ahora se queda
con la tecla mientras la sed apriete (`sed < 92`) y cae al fondo de la cadena
cuando no. Con sed sigue primero: la sed mata.

**MEDIDO** con `.claude/flota/r2-cantera.mjs`, que carga el **DEM real** de disco
con `pngjs` y usa las clases del juego tal cual están —no reimplementa nada, que
es la trampa que este proyecto ya pagó una vez—. Le agregué una pasada `viejo:
true` para que imprima el antes y el después en la misma corrida. 3210 m a pie
desde el punto de partida, en ocho rumbos, muestreando cada 1,7 m, que es lo que
el jugador camina entre dos repintados del HUD.

*(Tabla corregida tras la revisión: los números de ANTES de la primera versión
salían de una bandera que no deshacía el arreglo entero y **subdeclaraban la
mejora**. Éstos salen de la clase de `main` traída con `git show`.)*

| | ANTES | DESPUÉS |
|---|---|---|
| cambios de etiqueta en 3210 m | **68** | **12** |
| o sea, uno cada | **47 m** | **267 m** |
| aviso en pantalla | **61,6 %** del recorrido | **6,2 %** |
| «Abrir frente de tosca» | 28,0 % | **0 %** |
| «Abrir depósito de ripio» | 27,4 % | **0 %** |
| «Levantar chatarra» | 6,2 % | 6,2 % |
| **la cantera se comía de la tecla** | **57,0 %** | **0 %** |
| lo que le quedaba a la mata | 22,3 % | **79,3 %** |

Los 12 cambios que quedan son **todos de chatarra**, o sea hallazgos de verdad:
lo que queda en pantalla es lo que funciona. Y el censo del mundo entero explica
por qué el 0 % es correcto y no una mutilación: alrededor del punto de partida
`yacimientoEn()` ofrecía en el **71,1 %** de las posiciones y era extraíble el
**0,0 %** —el spawn está en reserva, donde `evaluar()` niega siempre—. En
jurisdicción provincial, con herramienta, sigue siendo extraíble el **83,5 %**, y
ahí sí aparece.

Una honestidad del banco: no instancia vegetación, así que `planta` vale cero y
el efecto de haber bajado la cantera **debajo** de la planta no se ve en esos
números. En el juego de verdad la mejora es mayor que la medida.

### FRENTE 2 CERRADO · caña colihue, arcilla y arena

El diagnóstico lo dejó el subagente en `r2-juego-f2.md` antes de caer y es
correcto; lo comprobé y lo cuantifiqué con `.claude/flota/r2-recursos.mjs`, que
también carga el DEM real.

**La arcilla no era rara: era imposible, y se llevaba puesta la cadena del metal.**
`Recoleccion.js` empujaba arcilla al levantar una piedra si `_aguaCerca()`. Pero
la rama de beber usa **la misma función**, está más arriba en la cadena y hace
`return`: llegar a la piedra implicaba que `_aguaCerca()` ya había dado falso.
Misma función, misma posición, mismo tick ⇒ **probabilidad exactamente cero**.

Arreglado con `_orillaCerca()`, una prueba propia de 12 m en vez de 3. No es
`_aguaCerca()` con otro número: es que la arcilla se deposita en la planicie de
inundación y en la barranca, no en la línea del agua, y 12 m es el mismo radio
con el que `Mineria.yacimientoEn()` decide un banco de arena.

| alrededor del punto de partida, 15.418 muestras en tierra | |
|---|---|
| posiciones que pasaban `_aguaCerca()` (3 m) | 0,05 % |
| **…de las que servían, tapadas por la rama de beber** | **0,00 %** |
| posiciones que pasan `_orillaCerca()` (12 m) | **0,77 %** |
| donde la arcilla ahora es posible y antes no | **0,71 %** |
| arcilla por piedra levantada, con el 45 % de la tirada | **0,34 %** |

Y **el daño que reparaba**, medido barriendo las 64 recetas con materiales de los
tres datasets: sin arcilla quedaban bloqueadas **Carbonera, Horno de barro,
Fragua y Alfarería**. O sea la cadena entera del metal —la carbonera da el
carbón, la fragua da el hierro, el hierro da la herramienta— y como `evaluar()`
exige herramienta para abrir cantera, **la arcilla era también lo que bloqueaba
la arena**. Un solo punto de falla, tres recursos caídos.

**La caña colihue no existía: la cortaba un `.slice(0, 26)`.**
`src/world/Vegetacion.js:65-68` filtra bien —el tipo `cana` pasa— pero después
recorta a 26 y la lista filtrada tiene **38**. `cana_colihue` cae en el índice
**32**. Nunca se le crea el lote, nunca se instancia una caña, y
`vegetacion.masCercana()` no la puede devolver jamás.

El corte se lleva **12 especies**, y el problema no es sólo la caña: se van las
tres coníferas exóticas y las dos invasoras leñosas, o sea **todas** las plantas
que sostienen la tesis del control de exóticas y de la pinocha como yesca.

`Vegetacion.js` **es del agente `mundo`**, así que no lo toqué. Lo que sí hice,
que es mío y no cuesta un solo cuadro:

**Intercambié `cana_colihue` y `taique` en `src/data/flora.json`.** Un canje uno
a uno: `taique` ocupaba uno de los 26 lugares y **no le da nada al jugador** —sin
`recursoJuego`, no comestible, sin uso medicinal—, mientras que la caña es la
única fuente de `caña`, es un ambiente entero del parque y desbloquea dos
recetas. La caña queda en el índice filtrado **22** (entra) y el taique en el
**32** (sale). Diff de 52 líneas por 52: se intercambiaron los dos bloques de
texto, no se reformateó el archivo.

Verificado: `cosechaDe(cana_colihue)` da **4 × Caña colihue + 2..4 semillas**, y
su franja de altitud es 700–1300 m, o sea que cubre el punto de partida (822 m).
Sin la caña quedaban bloqueados el **Vivac** y el **Arco de colihue**.

**Lo que le queda a `mundo`, y es el arreglo de fondo** — el canje resuelve la
caña pero deja la trampa armada: el `.slice(0, 26)` sigue tirando 11 especies en
silencio. Patche exacto, `src/world/Vegetacion.js:65-68`:

```js
// viejo
  .slice(0, 26);
// nuevo — sugerencia, la decisión de cuántos lotes caben es de `mundo`
  .slice(0, MAX_LOTES);   // y que MAX_LOTES sea explícito y esté medido
```
No es «sacar el slice»: 38 lotes en vez de 26 son **+46 % de lotes de
vegetación**, que es el 22 % del cuadro en una HD 4000. Lo que hay que evitar es
que el recorte sea **silencioso y por orden de archivo**. Si el presupuesto no da
para 38, que al menos elija por relevancia y avise cuáles quedan afuera.

**La arena.** Era el mismo muro del frente 1 (jurisdicción) más el círculo de la
arcilla, y los dos están arreglados. No hizo falta tocarla.

### ARREGLADO · la ficha de `hueso`

`caza.json` lo entrega en tres rindes de carroña y no tenía ficha, así que pesaba
los 0,5 kg de omisión y se quedaba sin `cat`, o sea invisible en el bolso.
Fichado en `Recursos.js` con `cat: 'material'` y **0,3 kg**, que es lo que pesa un
fémur seco de ciervo colorado o de jabalí. El chequeo de integridad da **cero
recursos entregados sin ficha**.

Queda abierto, y es decisión de contenido: hoy **ninguna receta pide hueso**, así
que sigue siendo peso muerto, sólo que ahora visible y descartable. El punzón, la
aguja y el retocador de hueso son material corriente en los sitios patagónicos,
así que hay con qué darle destino; no lo hice para no meter mano en el árbol de
tecnologías sin medirlo.

### FRENTE 3 CERRADO · los gestos que faltan

La pregunta no era «¿existe el gesto?» sino las tres del encargo. Contestadas
contra el código, no contra la bitácora:

| sistema | ¿cuál es el gesto? | ¿se descubre solo? | ¿qué devuelve? |
|---|---|---|---|
| **Caza** | `H` (`main.js:459`) | **NO** — no se nombraba en ninguna parte | bien: `evaluar()` siempre explica, permitido o no |
| **Pesca** | `P` (`main.js:449`) | **SÍ** — «Beber agua · P para tirar la línea» | bien: veredicto explicado, y devolver suma saber |
| **Saberes** | `Tab` → códice (`main.js:441`) | **NO** — el aviso decía «+2 puntos» y no dónde se gastan | bien, una vez que se llega |
| **Fundición** | `G` → taller (`main.js:447`) | **NO**, y es el peor | bien |

**`G` era el agujero grande.** `grep` sobre todo `src/`: `construccion.levantar()`,
`guardarTodo()` y `retirar()` los llama **únicamente** `src/ui/Taller.js`. O sea
que sin descubrir `G` el jugador no construye, no guarda, no retira y **no prende
fuego**, y sin fuego no hay comida cocida, ni agua hervida, ni calor, ni carbón,
ni cadena del metal. El juego entero colgaba de una tecla que no se nombraba.

Los tres gestos se resolvieron con la regla que el propio `main.js` se escribió
—«lo demás lo enseña `hud.mostrarAccion()` en el momento justo, parado enfrente
de la mata, que es cuando se aprende»— y ninguno es un tutorial:

1. **`H`** se nombra en la rama `ficha` de `quePuedoHacer()`: «Repasar zorro
   gris · **H** para evaluar la caza». Va en `ficha` y no en `identificar` a
   propósito: identificar es lo que hay que hacer la primera vez y no conviene
   ensuciarlo; `ficha` salta justo cuando el jugador está al lado de un animal
   que ya conoce y no tiene nada mejor que hacer.
2. **`G`** con `Recoleccion._avisarTaller()`: un aviso, **uno solo en toda la
   partida**, en el paso exacto en que el bolso completa la primera fogata.
3. **`Tab`** con un aviso único la primera vez que se ganan puntos por
   identificar, que es cuando la frase «puntos de saber» recién tiene sentido.

**Verificado en Node**, con la fundición y el HUD de mentira:

- El aviso del taller salta en el **tercer paso** de la secuencia
  `4 leña → 4 piedra → 4 leña` (o sea al llegar a 8 leña + 4 piedra contra las
  6 + 4 que pide la fogata) y **no se repite**: 1 aviso en 4 recolecciones. Eso
  encaja con la ruta que midió `bucle`: **4 acciones y 32 m** desde el punto de
  partida dejan 8 leña + 4 piedra, así que el jugador se entera de que existe el
  taller a los treinta metros de haber empezado.
- El aviso del códice: **1 aviso en 5 identificaciones**.

**Lo que necesita una línea en `main.js`**, dejada en
`.claude/flota/pendiente-r2-juego.md`: `recoleccion.fundicion = fundicion;`.
Sin ella no se rompe nada —`_avisarTaller()` arranca con `if (… || !this.fundicion) return;`—
simplemente no avisa.

**Lo que no toqué:** `Relevamiento.js` y `Exploracion.js` son del agente `carta`.

---

## 2 bis. La ronda de la revisión independiente

Un revisor externo auditó todo esto (`.claude/flota/r2-revision-juego.md`) y
encontró **nueve** cosas. Confirmó los tres arreglos centrales —y midió que la
mejora de la cantera era **mayor** que la que yo declaraba—. Lo que arreglé:

**D1 · GRAVE, y era mi propio diagnóstico reintroducido por mi propio arreglo.**
Al bajar el árido debajo de la planta, la rama tardía de `beber` se fue con él y
quedó **debajo de `if (mata)`, que retorna sin condición**. Con un coirón por
metro cuadrado, la probabilidad de llegar hasta ahí era **e^−78,5 ≈ 8×10⁻³⁵**:
código muerto, exactamente la forma del defecto de la arcilla.

Y no era un aviso de más. `agregar('agua', 1)` existe **en un solo lugar de todo
`src/`**, que es el caso `beber`; el agua la piden seis recetas, entre ellas los
dos remedios que este mismo cambio acababa de destapar en el bolso. Y la cadena
«P para tirar la línea» sale **también de un solo lugar**, que es `_beber()`: era
la única forma de descubrir la pesca.

Movida arriba de las dos ramas de `mata`, con la vara de siempre —no cuánto vale
sino cuál se puede hacer en otro lado—: el tronco, la chatarra, la planta y el
frente de cantera son hallazgos o están atados a un lugar y le ganan al agua; la
piedra, el michay, el helecho y el coirón están en todas partes y esperan.
**Verificado** con cuatro casos en Node sobre un mundo de mentira:

| caso | resultado |
|---|---|
| sed 40, coirón al lado | `beber` — la sed manda |
| **sed 100, coirón al lado** | **`beber`** — antes: `sotobosque` |
| sed 100, coirón **y tronco** | `sotobosque` (tronco) — el hallazgo gana |
| sed 40, coirón y tronco | `beber` — la sed vuelve a mandar |

**D5 · «si el aviso aparece, la tecla funciona» ahora es cierto para la chatarra.**
`hayChatarra()` es un hash puro de la posición: no consultaba `agotados` ni
`_sitioCercano`. O sea que después de vaciar una veta el cartel seguía **quince
minutos de reloj de pared** mintiendo, y adentro de un sitio patrimonial ofrecía
algo que cobra cinco puntos de saber. Nuevo método `Mineria.chatarraAMano()`, que
es el que consulta el HUD. Lo del sitio lo incluí aunque el revisor lo midiera
chico (0,1 % del mundo, 0 % en el spawn): la regla del encargo es no ofrecer lo
que se va a negar, y la Ley 25.743 se sigue enseñando entera al apretar `R`.
**Verificado**: fresca `true` → agotada `false` → a los 901 s `true`; en sitio
patrimonial `hayChatarra true` pero `chatarraAMano false`.

**D6 · el banco ya reproduce su propio ANTES.** La bandera `viejo: true` sólo
salteaba `evaluar()` y seguía usando la `yacimientoEn()` **nueva**, así que el
«antes» que imprimía era un híbrido que nunca existió — y por eso el número de
esta bitácora y el del comentario de `Mineria.js` no coincidían. Ahora
`cargarMineriaVieja()` trae la clase con `git show main:src/systems/Mineria.js`,
la escribe en un temporal y la importa; si no se puede, **lo dice y no imprime
ningún ANTES**, que es mejor que un número que no se sostiene.

Corrida nueva: **68 cambios, uno cada 47 m, visible el 61,6 %**, idéntico a la
medición independiente del revisor y al comentario de `Mineria.js`. **La tabla de
la sección del frente 1 subdeclaraba la mejora**; la buena es 68 → 12, 47 m →
267 m, 61,6 % → 6,2 %.

**D7 · los avisos ya no se pisan ni vuelven cada sesión.** `HUD.aviso()` es una
sola ranura. El del taller salía con `setTimeout(…, 0)` y tapaba al de la propia
acción antes de que se leyera un carácter; ahora sale a los 4,5 s y el del códice
a los 1,5 s, o sea acción → códice → taller, cada uno con su turno. Y los dos
testigos se guardan en la partida (`Partida._serializar()`, campo `enseniado`):
sin eso, quien cerrara con seis leña y cuatro piedra y sin horno se comía el
aviso de nueve segundos en cada arranque.

**D8 · dos cosas del bolso.** El número corregido arriba, y el botón «Comer» ya
no aparece en lo que cura: la infusión de canelo tenía los dos botones pegados y
el de comer **no aplica la curación**, así que apretar el de al lado tiraba 8 de
salud. «Curarte» ya suma lo que nutre y lo que hidrata.

**Y una trampa del repositorio que volví a pagar**: puse el comentario de ese
último arreglo como comentario HTML **adentro de la plantilla literal**, con
comillas invertidas adentro. Eso cierra el literal y tumba el módulo. Está
documentado en `CONTEXTO.md` y lo agarró `r2-juego-integridad.mjs` en dos
segundos, que es exactamente para lo que lo escribí.

**Lo que NO arreglé porque no es mío: D2, D3 y D4**, los tres sobre
`src/systems/Hallazgos.js`, que es del agente `carta`. **D4 la causé yo**:
`Hallazgos._aguaCerca()` tiene radio 3 m y un comentario que dice «el mismo
criterio que usa `Recoleccion` para dar arcilla», y dejó de ser cierto cuando
pasé a `_orillaCerca()` de 12 m — el mapa marcaría el 6 % de la arcilla real.
Ruteado en `pendiente-r2-juego.md` con el detalle de las tres.

---

## 3. Siguiente

Los tres frentes están cerrados: (1) el botón de curar ✔, (2) el ripio ✔,
(3) los tres recursos ✔, (4) los gestos ✔. Más los seis defectos de la revisión
que caían en mi propiedad ✔.

Queda abierto y declarado:

- **El `.slice(0, 26)` de `Vegetacion.js`**, que es de `mundo`. La caña colihue
  la resolví por mi lado con el canje en `flora.json`, pero el recorte silencioso
  se sigue llevando once especies, entre ellas las tres coníferas exóticas y las
  dos invasoras leñosas.
- **Darle uso al `hueso`.** Hoy tiene ficha y se ve, pero ninguna receta lo pide.
- **`Construccion.alCambiar` es una sola ranura.** Aviso para el coordinador.
- **Los avisos nuevos hay que oírlos jugando.** El ritmo de un aviso —si molesta,
  si llega tarde, si se pisa con otro— no se mide con un script.

---

## 4. Descartado

- Levantar el servidor o abrir el navegador: prohibido por el encargo y además
  inútil (el panel no compone cuadros). Todo se verifica con Node.
