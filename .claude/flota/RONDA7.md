# RONDA 7 — Lo que vio el dueño

> Abierta el 12/9/2026. Rama `mejoras/ronda7-lo-que-vio`, sacada de `main` en
> `96dc0bf` (las rondas 5 y 6 fusionadas, sin empujar).
> **Es la primera ronda que sale de jugar y no de leer código.** El dueño jugó
> «un pantallazo» con el garrote y la antorcha en la mano, y trajo siete
> anotaciones. Esta carta las mide antes de encargar nada.
>
> Método, el mismo de las rondas 3 a 6: un jefe con subagentes, propiedad
> exclusiva de archivos, y se cierra de a una fase. El banco de cada fase lo
> escribe el jefe antes de ver el código del agente, con un falsador al lado. El
> coordinador corre los bancos y revisa leyendo el código. Se commitea parcial en
> cuanto haya algo medido. **No se fusiona a `main` hasta que el dueño la vea.**

---

## Las siete anotaciones, tal como llegaron

1. una tecla para auto andar
2. no hay arcilla o arena, o es muy difícil de encontrar; si es lo segundo tiene
   que haber alguna manera de solucionarlo, como dirigir al primer spot, o que
   haya más, aunque se pierda realismo
3. hacer algo para poder tejer (¿telar?)
4. el agua se puede tomar pero no cargar en el bolso: hace falta alguna
   vasija o bolsa para hacerlo
5. entre paréntesis del «recolectar», que aparezca qué te da
6. el fuego da poca luz
7. ¿cielo estrellado real? Da referencias, y el juego es de supervivencia y
   educativo

Y una frase suelta que acompañaba la lista: *«puse lo del garrote porque fue lo
que llegué a probar, la antorcha sí se ve en mano»*. Leída contra el código: el
garrote es de ranura `arma` y `Herramientas3D.js` modela sólo los 18 objetos de
ranura `mano`, así que **lo que va en la ranura del arma no se dibuja en ninguna
parte**. Se le preguntó al dueño si era eso lo que vio.

> **Contestó el 12/9/2026: «el garrote no se veía».** Pasa a la fase 2b,
> `empuñadura`. Son **12 objetos en la ranura del arma** —garrote, honda, lanza de
> colihue, estólica, bola perdida, las dos boleadoras y el arco, más la línea de
> mano, la caña de colihue, el arpón de hueso y el equipo de mosca— y ninguno
> tiene modelo. `main.js:752` pone en la mano sólo lo de la ranura `mano`.

---

## Lo que se midió antes de encargar nada

### 1 · Andar solo — no existe, y el arreglo vive entero en `Entrada`

`Entrada.adelante` lee W, S y las flechas, y **`Jugador` no lee ninguna tecla**:
sólo `entrada.adelante`, `lateral`, `correr`, `saltar` y `agachar`
(`Jugador.js:176-236`). O sea que andar solo es un estado de `Entrada` y nada
más. Teclas libres en todo `src/`: B, J, K, L, N, U, V, X, Y, Z. **Se elige Z**:
queda bajo la mano izquierda, al lado de Shift, y se aprieta corriendo.

**Y apareció un defecto que el dueño no trajo, pero seguro pisó.** La C está dos
veces: `Entrada.agachar` la lee (`Entrada.js:77`) y `main.js:267` la registra para
`calidad.siguiente()`, **que además apaga el ajuste automático**. Cada vez que uno
se agacha con C, cambia el preset gráfico. En la HD 4000 eso puede ser pasar de
Baja a Media en medio de una subida. Ctrl no sirve de reemplazo: en un navegador,
Ctrl+W cierra la pestaña, y por eso existe la C. **La calidad pasa a F2**, que
está libre y `Entrada` ya la protege con `preventDefault`.

### 5 · El cartel no dice qué da — y cuando lo diga, puede marcar mal la tecla

`quePuedoHacer()` arma «Recolectar maqui», «Juntar piedra suelta», «Abrir banco de
arena (o R)», sin rinde. Pero el rinde **ya se sabe en ese momento**, y tiene tres
formas distintas, que el cartel tiene que distinguir para no mentir:

| forma | dónde | ejemplo |
|---|---|---|
| fijo | `COSECHA_SOTOBOSQUE`, `Recoleccion._rinde()`, la cantera | piedra: 2 · tronco: 4 leña y 1 corteza, o 2 rollizos con hacha |
| cantidad al azar | `cosechaDe()` (`Recursos.js:359`), `recuperarChatarra()` (`Mineria.js:249`) | fruto: de 2 a 4 · chatarra: de 1 a 3 |
| sale o no sale, y **sólo en ciertos lugares** | `Recoleccion.actuar()`, `:513-540` | lana 16 % en el coirón · pluma 22 % en el pasto húmedo · arcilla 45 % en la piedra de orilla · obsidiana 28 % en la piedra sobre 1500 m |

La tercera es la que importa: **decir «a veces arcilla» en la piedra de la orilla
es la mitad de la nota 2 resuelta sin tocar la geología**, porque hoy nada en el
juego dice que la arcilla sale de ahí.

Y una trampa encontrada leyendo: `HUD.mostrarAccion()` marca la tecla propia con
`etiqueta.replace(tecla, '<b>R</b>')`, o sea **la primera R mayúscula que
aparezca**. Hoy da bien porque «(o R)» es la única. En cuanto el paréntesis del
rinde nombre algo con R antes, se pinta la letra equivocada.

### 2 · Arcilla y arena: las dos existen, una es invisible y la otra está prohibida donde está

Medido con `.claude/flota/r7-arcilla.mjs` sobre el mundo real —el DEM, el
`Sotobosque`, la `Mineria` y los `Limites` del juego, importados y no copiados—
desde el punto de partida (-41,0870 · -71,4290, en la **Reserva**).

**La arcilla** sale de un solo lugar: levantar una piedra con el agua a menos de
12 m (`Recoleccion.js:520`), al 45 %, dos por vez. Pero la cadena de la tecla le
pone cuatro filtros encima:

| a menos de 3 km de la partida | |
|---|---|
| tierra en la orilla (`Mundo.orillaCerca`, 12 m) | 3,4 % |
| …de esa orilla, con el agua a mano: **gana beber** y la piedra no llega | 27,6 % |
| banda donde la piedra podría dar arcilla | 2,5 % de la tierra |
| en la banda, una piedra a 5 m | 50,8 % |
| en la banda, un tronco a 5 m, que le gana la tecla a la piedra | 8,8 % |
| **tierra desde donde E puede dar arcilla** | **1,06 %** |
| el punto útil más cercano · p10 · mediana | 518 m · 842 m · 1830 m |

**Y el 1,06 % es una cota superior**: `quePuedoHacer()` le da la tecla a cualquier
planta a menos de 7 m antes que a la piedra, y la vegetación no se arma en Node
(hornea impostores con la placa). En una orilla de bosque ese filtro puede comerse
casi todo. El horno de barro pide 10 de arcilla y la carbonera 4: a 0,9 por
piedra son **16 piedras de orilla**, y ningún cartel dice que hay que buscarlas
ahí.

El dataset ya lo sabía: `herramientas.json` declara la acción
**`extraer_arcilla`** —«De barranca, con la mano, un puñado», con y sin
herramienta— y anota *«a un puñado por vez son treinta viajes: ése es el motivo
real por el que hoy nadie llega al horno»*. **Ningún archivo de `src/` la usa.**
Es otra vez un efecto declarado que nadie consume.

**La arena** sale sólo de abrir cantera con R (`Mineria._resolverFrente`: junto al
agua y con pendiente menor a 0,22):

| a menos de 22 km | frentes de arena | el más cercano |
|---|---|---|
| Parque | 2900 | 10,1 km |
| **Reserva** | **7735** | **515 m** |
| fuera del área protegida | 1591 | **8,6 km** |

`Mineria.evaluar()` niega **siempre** en Parque y en Reserva. Así que hay arena a
515 m, pero la arena legal más cercana está **a 8,6 km y pide herramienta**. El
horno de barro pide 4 de arena: queda a ocho kilómetros y medio del arranque.
**Ésa es la respuesta a «muy difícil».** Y el juego tampoco dice dónde está la
legal.

### 4 · El agua entra suelta al bolso, y el odre es un número que nadie lee

`beber` hace `inventario.agregar('agua', 1)` (`Recoleccion.js:465`): la medida
entra al bolso **sin recipiente**, como si fuera una piedra de un kilo. Sea lo que
sea que vio el dueño —el bolso lleno, o que no se notaba—, el mecanismo realista
no existe. `odre_cuero` declara `efecto: { guardaAgua: 6 }` y **`grep` no
encuentra `guardaAgua` en ningún archivo de `src/`**. El odre es el único
contenedor de líquido del juego, está en el nivel 2 y pide cuero curtido.

Los líquidos del juego son tres: `agua`, `agua_segura` (hervida) e
`infusion_canelo`. Es la deuda 13 de la ronda 6: *«con la grilla, el odre pide
ser un contenedor de verdad y no un número»*.

### 3 · Tejer: el telar es una tecnología que produce una sola prenda, y no existe como cosa

`telar_witral` es un nodo del árbol —madera 4, lana 6, 24 de saber— cuyo único
efecto es habilitar `poncho_witral` (lana 8, cordel 3), que se fabrica **desde el
bolso**. No hay telar en el mundo ni en la mano. La lana sale de un solo lugar: el
coirón, al 16 %, de a una (`Recoleccion.js:532`). Nodo más poncho son 14 de lana:
**unos 88 coirones**. Y la lana tiene dos consumidores en todo el juego: el poncho
y las moscas de pesca.

El dueño decidió el 7/9 que se fabrica desde el bolso sin banco de trabajo. **El
telar es la excepción que corresponde y la pide él**: un witral es un bastidor
vertical de dos metros, no algo que se lleva encima. Y `Fabricacion` ya sabe pedir
estar al lado de algo —`donde: 'fogata'` y `'fragua'`, `Fabricacion.js:36-49`—,
así que el telar entra por un camino que existe.

### 6 · El fuego da poca luz — y es aritmética, no impresión

Irradiancia difusa que deja el bloque de `Luces.js` en suelo plano de albedo 0,2,
con la caída `(1 − d²/r²)²` y el coseno de incidencia, en luminancia:

| | 1 m | 2 m | 3 m | 5 m | 8 m |
|---|---|---|---|---|---|
| fogata (2,1 en el valle del latido, 14 m) | 0,0240 | 0,0130 | **0,0084** | 0,0043 | 0,0016 |
| antorcha (2,0, 12 m) | 0,0394 | 0,0265 | **0,0182** | 0,0090 | 0,0025 |

~~**La fogata alumbra el suelo menos de la mitad que una antorcha**~~ — **FALSO
en la imagen.** La cuenta de arriba supone suelo liso con la normal hacia arriba, y
así la altura de 0,6 m (`Hornos.js:30`) pesa mucho. Medido en la imagen final el
mismo día, con la vista previa en la HD 4000 a Baja 1024×576, cámara cenital a
22 m sobre suelo plano y seco junto a una orilla, a las 23:40, restando la noche
sin luz, y con los árboles fuera del cuadro para medir el suelo y no la copa:

| luminancia de 0 a 255 | 1 m | 2 m | 3 m | 5 m | 8 m | 12 m |
|---|---|---|---|---|---|---|
| noche sin luz | 0 | 0 | 0 | 0,03 | 0,06 | 0,55 |
| fogata (2,6 · 14 m · a 0,6 m) | +4,12 | +5,27 | **+5,00** | +4,61 | +1,95 | +0,09 |
| antorcha (1,82 · 12 m · a 1,33 m) | +2,29 | +3,38 | **+3,38** | +2,97 | +0,79 | 0 |

**La fogata alumbra más que la antorcha**, no la mitad. El suelo de verdad tiene
pasto, con hojas casi verticales que reciben la luz baja de frente, y el coseno del
suelo liso no dice nada de eso. *Es otra vez el banco sintético que no alcanza, y
esta vez lo escribí yo en la carta sin medir.*

**Lo que sí dice la imagen es peor que lo que decía la cuenta: las dos luces dejan
el suelo en 5 de 255, que a la vista es negro.** Coincide con los 3,41 que midió la
ronda 5 para la antorcha. Ése es el «da poca luz» del dueño, y no es un problema de
altura sino de nivel: algo entre el bloque de `Luces.js`, el mapeo tonal y el pase
de color se come casi toda la luz.

**Y hay una segunda mitad que la aritmética no ve: la fogata encendida no se ve
encendida.** `Hornos.agregar()` dibuja un anillo de piedras con un solo material
mate (`Hornos.js:49-54`): no hay llama, ni brasa, ni nada que brille. Lo único
que distingue una fogata prendida de una apagada es esa luz débil a 0,6 m. La
fase 2 pide las dos cosas, y la segunda con la regla que costó la ronda 5: **el
material de la llama se compila en la carga**, porque un programa nuevo al
construir la primera fogata es el congelamiento de 19 segundos otra vez.

### 7 · El cielo es inventado — también la luna

`Cielo.js:561-566`: las estrellas son `pow(ruido3(floor(dir·260)), 34)`, puntos al
azar **pegados al mundo**, que no giran con la hora. La Vía Láctea es una banda
fija en `(0,42 · 0,36 · −0,83)`. **Y la luna es inventada** (`:188-192`): va
«aproximadamente en oposición», y la fase sale de `fecha / 86 400 000 mód 29,53`,
sin una época sinódica: **la fase no es la de esa fecha**. El sol sí es real
(NOAA, `:56`).

Un cielo que dé referencias pide un catálogo de estrellas de verdad —el *Yale
Bright Star Catalogue* es de dominio público—, el tiempo sidéreo local para que
el cielo gire alrededor del polo sur celeste a −41°, la luna con efemérides de
baja precisión, y la Cruz del Sur con sus punteros para enseñar a encontrar el
sur. **Descargar el catálogo pide permiso del dueño.**

> **Permiso dado el 12/9/2026, y ya está bajado:** `tools/catalogos/bsc5/`, desde
> el CDS (catálogo V/50), 9110 objetos en 574 kB comprimidos. La fuente, la cita y
> lo que hay que saber antes de usarlo están en `tools/catalogos/bsc5/LEEME.md`.

---

## El orden, y por qué

| fase | agente | notas | qué |
|---|---|---|---|
| **1** | `tecla` | 1, 5 y la C | andar solo, el cartel con el rinde, la tecla marcada en su lugar |
| 2 | `brasa` | 6 | la luz del fuego, medida en la imagen final |
| 2b | `empuñadura` | el garrote | lo que va en la ranura del arma también se ve en la mano |
| 3 | `barro` | 2 | arcilla con gesto propio, arena legal alcanzable, y el juego dice dónde |
| 4 | `vasija` | 4 · deuda 13 | los líquidos viajan en recipientes con contenido |
| 5 | `witral` | 3 | el telar como cosa, el hilado, y la lana con fuente suficiente |
| 6 | `cielo` | 7 | estrellas y luna reales, y la Cruz del Sur |

- **La 1 va primero** porque toca el gesto de todo el juego, es chica, y el cartel
  con el rinde ya ataca la mitad de la nota 2.
- **La 2 es chica** pero se mide en el navegador: mejor antes de que las fases de
  datos lo ocupen.
- **La 2b va pegada a la 2**, con número propio para no renumerar la carta: la
  pidió el dueño al contestar, es chica, se ve, y sigue el camino de la ronda 5
  (`Herramientas3D.js`). La regla la decide el jefe y sale de la ficha de la
  ranura —«se saca sin guardar la herramienta»—: **en la mano va la herramienta si
  hay una, y si no, el arma**.
- **La 3 antes que la 4** porque el recipiente más temprano y más local —el cántaro
  de barro cocido— pide arcilla. Y la 3 es la que corta la cadena del metal: sin
  horno de barro no hay carbonera ni fragua.
- **La 6 al final** porque es la más grande en datos y espera un permiso.

**Una regla nueva que vale para las fases 3, 4 y 5:** todo objeto o recurso nuevo
necesita su icono en `Iconos.js`. El banco de la ronda 6, fase 3, exige que no haya
agujeros, así que un objeto sin dibujo lo pone rojo, y eso está bien.

**De la deuda abierta**, esta ronda paga la 13 de la ronda 6 (el odre, fase 4) y
nada más a propósito. La equivalencia `madera_dura → tronco`, los 1480 puntos
contra 469, la humedad de afuera, la regla de la muerte, `Caza.js:268` y el
`_resto` de las antorchas siguen donde estaban.

---

## FASE 1 · `tecla` — andar solo, el cartel que dice qué da, y la C

### Propiedad exclusiva de archivos

El agente escribe **sólo**:

- `src/engine/Entrada.js` — andar solo
- `src/systems/Recoleccion.js` — el rinde en la etiqueta
- `src/ui/HUD.js` — **sólo** `mostrarAccion()` y el CSS del indicador
- `src/ui/Opciones.js` — **sólo** la tabla `CONTROLES`
- `src/systems/Recursos.js`, `src/systems/Mineria.js`, `src/systems/Caza.js` —
  **sólo** para exponer el rinde que ya calculan, de modo que el cartel y la
  acción lean la misma fuente. Ni una ficha, ni un número, ni una regla cambia.

Del coordinador: `src/main.js` (la calidad pasa de C a F2), el banco, el falsador
y esta carta. Cualquier otro archivo se pide en `pendiente-r7-tecla.md`.

### El contrato

**K1 · Andar solo con Z.** `Entrada` gana la propiedad `autoAndar`, de lectura y
escritura. Z la prende y la apaga, **sólo con el puntero bloqueado**, nunca
mientras se escribe en un campo y nunca por repetición de tecla. Prendida,
`adelante` vale 1 aunque no haya ninguna tecla apretada.
- **La apagan:** Z otra vez; apretar W, ↑, S o ↓; soltar el puntero —abrir
  cualquier panel, morir—; perder el foco de la ventana.
- **No la apagan:** A, D, Shift, Espacio, Ctrl ni C. Se dobla, se corre, se salta y
  se agacha andando solo.
- `Jugador` no se toca: lee `entrada.adelante` y con eso alcanza.

**K2 · Se ve que está prendido.** Mientras dura, `document.body` lleva la clase
`auto-andar` y el HUD la muestra. Un personaje que camina solo sin que la pantalla
diga por qué se lee como un juego roto.

**K3 · La C agacha y nada más.** La calidad pasa a F2 en `main.js` (coordinador).
Ninguna tecla registrada con `entrada.registrar()` puede ser una de las que leen
los movimientos de `Entrada`: WASD, flechas, Espacio, Shift, Ctrl, C y Z.

**K4 · Los controles lo dicen.** `CONTROLES` nombra Z y F2, y **toda tecla
registrada en `main.js` aparece en la tabla**.

**K5 · El cartel dice qué da, y no miente.** Para `planta`, `sotobosque` —los seis
tipos, y el tronco con y sin hacha—, `chatarra`, `cantera` y `carronia` —con y sin
filo—, la etiqueta termina en un paréntesis con lo que `actuar()` pone en el
bolso, separado por ` · `:
- lo fijo: `2 × piedra`
- la cantidad al azar: `2–4 × frutos` (guion o raya)
- lo que sale o no sale: `a veces arcilla`, **y sólo donde la condición se cumple
  en ese lugar**: la piedra lejos del agua no promete arcilla.
- el nombre es `nombreDe(id)` en minúsculas.

Lo que el cartel promete es lo que la tecla da: todo lo que entra al bolso está
nombrado, todo lo fijo entra con su número, lo al azar cae dentro del rango, y un
«a veces» sale alguna vez y no sale siempre. **Ningún número del rinde se escribe
dos veces**: si `COSECHA_SOTOBOSQUE` cambia, el cartel cambia solo.

`beber` queda como está: la fase 4 le cambia el rinde entero.

**K6 · La tecla se marca donde va.** `hud.mostrarAccion()` escribe `<b>E</b> ·
etiqueta`, y si la acción tiene tecla propia agrega al final ` · o <b>R</b>`. La
etiqueta deja de traer «(o R)» adentro. Un solo `<b>` por tecla, y el paréntesis
del rinde sale textual.

**K7 · El mismo trabajo por consulta.** `quePuedoHacer()` corre dos veces por
segundo. Sigue leyendo `sotobosque.lotes` **una** vez y llamando a
`vegetacion.masCercana` **una** vez por llamada.

**K8 · Sin regresión.** Los bancos r5-fase1 (9/9), r6-fase1 (7/7), r6-fase2 (8/8)
y r6-fase3 (6/6) siguen verdes, y `vite build` limpio.

### Lo que NO es de esta fase

El agua y su rinde (fase 4). Dónde está la arcilla (fase 3): acá sólo se **dice**
lo que ya pasa. La velocidad al andar solo: es la misma que caminando, y la decisión
sobre `velocidadBase` sigue siendo del dueño.

Bitácora: `.claude/flota/r7-tecla.md`.

---

## FASE 1 CERRADA — 12/9/2026

**Banco 6/6**, corrido por el coordinador y no por el agente: las cuatro secciones
nuevas con 29 · 10 · 198 · 12 aserciones, los cuatro bancos anteriores en su número
y `vite build` limpio. **Falsador 27 de 27, todos vistos por la aserción
declarada**, y **los dos controles al revés en verde**: cambiar el rinde en
`COSECHA_SOTOBOSQUE` o en el dataset no pone rojo al banco, o sea que el cartel lee
la misma fuente que la tecla y ningún número está escrito dos veces. El agente tocó
sus siete archivos y ninguno más; no hizo falta `pendiente-r7-tecla.md`.

### Lo que quedó, leído en el código

- **`Entrada.autoAndar`** pone y saca la clase `auto-andar` desde el setter y desde
  ningún otro lado, así que ningún camino de apagado la deja puesta. **El setter se
  niega a prender sin el puntero bloqueado**, también desde afuera: todo lo que
  apaga pasa por soltar el puntero, así que prendido suelto no lo frenaría nada. Es
  la decisión correcta y le costó dos defectos al falsador (abajo).
- **El rinde se arma una vez y viaja en la acción.** `quePuedoHacer()` arma el
  paréntesis y guarda el rinde en el objeto que devuelve; `actuar()` sortea sobre
  ese mismo objeto. No hay forma de que el cartel y la tecla prometan cosas
  distintas. Las probabilidades que vivían escritas en línea en `actuar()` pasaron a
  `EXTRAS_MATA`, con su condición de lugar. `Recursos.cosechaPosibleDe()`,
  `Mineria.rindeChatarra()` y `Caza.fuenteDe()`/`rindeDeRestos()` exponen lo que ya
  calculaban, y los sorteos se consumen en el mismo orden que antes: el filtro de
  lugar corre antes del sorteo, igual que el `&&` viejo.
- **Lo repetido se suma**: el maqui da 3 frutos fijos y 2 a 4 al azar, y el cartel
  dice «5–7 × frutos». El banco confirma que salen los dos extremos.
- **La carroña queda fija por lugar**, y es el único cambio de juego de la fase. Un
  hash de la posición en la grilla de 25 cm del descanso elige la fuente, y esa
  fuente viaja hasta `aprovechar()`. La otra salida honesta daba cinco «a veces» con
  filo y escondía el asta, que es la puerta del nivel 3. Medido por el agente sobre
  200 000 posiciones: 0,400 · 0,250 · 0,243 · 0,107 contra 0,40 · 0,25 · 0,25 · 0,10
  del dataset. La consecuencia: esperar 150 s junto al mismo resto ya no vuelve a
  sortear qué animal era.

### Los dos defectos del falsador, que fueron míos

`soltar-no-corta` y `z-sin-puntero` plantaban el defecto escribiendo `autoAndar =
true` con el puntero ya suelto. El setter del agente se niega, con razón, así que
**el parche decía plantar y no plantaba nada**, y el falsador lo contó como punto
ciego. Ahora pisan la propiedad en la instancia, que planta el defecto visto desde
afuera sin depender de cómo se escribió adentro. Con eso, los dos vistos.

Es la tercera vez en dos rondas que un falsador mío no planta lo que dice. La
lección se repite igual: *antes de anotar un punto ciego, comprobar que el defecto
llegó a estar puesto.*

### Verificado en el juego

En la vista previa, con el juego de verdad:
- Las teclas registradas son F, F3, T, **F2**, O, Tab, M, I, F1, E, Q, G, P, R y H:
  **la C ya no está**.
- `autoAndar = true` da `adelante = 1`, la clase puesta, y el indicador «Andando
  solo · W o S para frenar» debajo del cartel de acción.
- **300 posiciones reales a menos de 60 m del arranque**, con el sotobosque y la
  vegetación sembrados: todos los carteles traen su paréntesis.

  | tipo | posiciones | ejemplos |
  |---|---|---|
  | sotobosque | 201 | «Juntar piedra suelta (2 × piedra)» ×157 · «Trozar un caído · hacha de piedra (2 × tronco · 3 × leña · 2 × corteza)» · «Juntar coirón (2 × fibra vegetal · a veces lana)» |
  | planta | 80 | «Recolectar caña colihue (4 × caña colihue · 2–4 × semillas)» · «Recolectar coihue (6 × madera dura)» · «Recolectar maqui (5–7 × frutos)» |
  | chatarra | 16 | «Levantar chatarra (1–3 × chatarra)» |
  | carroña | 3 | «Juntar los huesos · sin filo no sale más (1 × hueso)» |

- **En la primera orilla que se miró, a 1,3 km del arranque, la piedra dice «Juntar
  piedra suelta (2 × piedra · a veces arcilla)».** Es la primera vez que el juego le
  cuenta al jugador dónde sale la arcilla. La captura de esa orilla muestra el
  cartel y el indicador, legibles.

### Lo que hay que mirar jugando

1. **La piedra se queda con la tecla en media zona de arranque**: 157 de 300
   posiciones ofrecen «Juntar piedra suelta (2 × piedra)». Ya pasaba antes; ahora
   se lee, y puede cansar.
2. **Las etiquetas más largas** —el tronco con hacha, la carroña con filo— rondan los
   70 caracteres. A 1280 px entran en una línea; a 1024 no se miró.
3. **La carroña da siempre lo mismo en el mismo lugar.** Es a propósito y está
   escrito arriba.
4. **Una planta que no da nada**, como la taique, sigue diciendo «Recolectar taique»
   sin paréntesis, y está bien: un «()» se leería como un cartel roto.

---

## FASE 2 · `brasa` — que el fuego se vea encendido y alumbre

### Lo que se midió antes de encargar nada

Medido en la vista previa el 12/9/2026, en la HD 4000 a Baja 1024×576, con el
juego de verdad, una fogata construida por `fundicion.construir()` sobre suelo
plano y seco a 1,3 km del arranque, a las 23:40 del 15/2. Cámara cenital a 22 m,
dieciséis muestras por anillo, la noche sin luz restada, y los árboles fuera del
cuadro para medir el suelo y no la copa. La tabla está en la sección 6 de arriba;
en una línea: **la fogata deja el suelo en +5 de 255 a 3 m, y la antorcha en +3,4.**

Y la captura `capturas/r7f2-fogata-noche-6m.png`, desde 6 m y mirando la fogata,
dice lo mismo con los ojos:

1. **El pasto se enciende de naranja** hasta unos 6 a 8 m, y se lee. El suelo entre
   el pasto queda casi negro.
2. **La fogata es un aro oscuro con nada adentro.** No hay llama, ni brasa, ni nada
   que brille (`Hornos.js:49-54`): una fogata prendida se ve igual que una apagada.
   Es lo que más dice «el fuego no alumbra».
3. **Una hoja de pasto pegada a la cámara sale como un triángulo amarillo plano**,
   sin sombreado, abajo a la derecha. Hay que saber si es la luz del fuego
   saturando una hoja a menos de un metro o es otra cosa.

La cadena de la imagen, leída en `main.js:543-575`: escena → oclusión ambiental →
resplandor (umbral 0,86, en HDR) → `OutputPass` (ACES y sRGB) → FXAA → `PasoColor`
(nitidez, techo, curva en S, temperatura, saturación, viñeteado), y de noche la
exposición queda en 0,78 a propósito (`Tiempo._exposicion`). **Cuánto se come cada
eslabón no está medido y es lo primero que mide el agente**: subir la intensidad a
ciegas puede dar un fuego que alumbra y un mediodía que brilla.

### Propiedad exclusiva de archivos

- `src/world/Hornos.js` — la llama, la brasa y sus números
- `src/engine/Luces.js` — **sólo** `LLAMAS` (color, intensidad, parpadeo de lo que
  se lleva en la mano). El bloque del sombreador no se toca: su costo está medido y
  cerrado en la ronda 5.

**No se tocan**: `Posproceso.js`, `Tiempo.js` ni la exposición. La luz del día fue
aprobada por el dueño en la ronda 3, y arreglar la noche cambiando la cadena de
color la cambia a toda hora. Lo que necesite `main.js` —precompilar la llama en la
carga, por ejemplo— va a `.claude/flota/pendiente-r7-brasa.md`. Bitácora:
`.claude/flota/r7-brasa.md`.

### El contrato

**B1 · La fogata encendida se ve encendida.** Mientras arde tiene llama y brasa
visibles; apagada, no. Desde 6 m de noche, **el pico de luminancia de la imagen
sobre la fogata es ≥ 180 de 255 prendida y ≤ 40 apagada**. Pocas piezas, material
compartido entre todos los hornos, y que se mueva: una llama quieta se lee como un
cono naranja. Los otros tres hornos muestran que arden donde tengan boca o tiro.

**B2 · Construir y prender no compila nada.** `render.info.programs.length` es el
mismo antes y después de construir una fogata, prenderla, apagarla y construir la
segunda. La llama se compila en la carga. **Es el congelamiento de 19 segundos de
la ronda 5 si se olvida.**

**B3 · El fuego alumbra.** En la imagen final, con la medición de arriba, **con la
misma cámara y el mismo lugar**:

| | a 2 m | a 3 m | a 8 m | a 1 m |
|---|---|---|---|---|
| fogata | ≥ 35 | ≥ 30 | ≥ 8 | ≤ 200 |
| antorcha | ≥ 25 | — | ≥ 4 a 5 m | ≤ 200 |

**Los números son del jefe, declarados como tales**, igual que en la ronda 5: se
eligieron para que el suelo alrededor de un fuego se lea y el borde del campamento
todavía se vea, y se revisan con el ojo del dueño. Lo que el banco garantiza es el
piso: que el «da poca luz» no vuelva en silencio.

**B4 · El mediodía no se enciende.** A las 12:00 del 15/2, en el mismo lugar, la
diferencia entre fuego prendido y apagado a 2 m es **≤ 6,5 de 255**.

> **Corregido por el jefe antes de lanzar al agente, y dicho.** Decía «el mediodía
> no cambia: ≤ 3», y el banco corrido contra la base midió que **hoy la fogata al
> mediodía ya suma +5,86** a 2 m, sobre un suelo en 44. La aserción estaba roja
> antes de que nadie tocara nada: no medía «no cambia», pedía un cambio sin decirlo.
> Lo que hay que cuidar es otra cosa: que al subir la luz de noche el mediodía no
> suba con ella —multiplicada por diez, la fogata al sol daría +50—. Queda en lo de
> hoy más un 10 % de margen de medición. Si el agente además la baja, mejor: una
> fogata al sol casi no alumbra.

**B5 · La hoja amarilla, explicada.** Se dice qué es con una medición, y si es la
luz del fuego, se arregla.

**B6 · Sin regresión de costo.** A Baja 1024×576, alternado A/B/A/B en tandas:
la llama **≤ +0,3 ms**, y las dos luces juntas siguen dentro del tope de la ronda 5
(**+1,8 ms**). Si cambia un radio, se vuelve a medir.

**B7 · Sin regresión.** Los bancos de la ronda 5 fase 1 (9/9), la ronda 6 y la
ronda 7 fase 1 siguen verdes, y `vite build` limpio.

### Lo que NO es de esta fase

El cielo y la luna (fase 6). La exposición nocturna y la cadena de color. El
incendio forestal, salvo que se rompa. La antorcha dibujada en la mano, que ya
existe.

---

## FASE 2b · `empuñadura` — lo que va en la ranura del arma también se ve

Abre cuando cierre la fase 2. Pedida por el dueño el 12/9/2026: *«el garrote no
se veía»*.

### Lo que se midió antes de encargar nada

- **`main.js:752` pone en la mano sólo la ranura `mano`**: `cuerpo.enMano =
  equipo.enRanura('mano')?.id ?? null`. Con el garrote equipado y la mano vacía,
  el cuerpo no recibe nada.
- **`Herramientas3D.js` modela los 18 objetos de ranura `mano`** y ninguno de la
  ranura `arma`. `construirHerramienta()` devuelve `null` para un id sin receta, así
  que aunque se cableara el arma, la mano seguiría vacía.
- **Son 12 en la ranura del arma**, y la ficha de la ranura dice cómo conviven con
  la herramienta: *«se saca sin guardar la herramienta»*.

  | id | qué es | kg | materiales de la ficha |
  |---|---|---|---|
  | `garrote` | rama con peso en la punta | 1,2 | madera, cordel |
  | `honda` | dos cordeles y una badana | 0,15 | cordel, cuero |
  | `lanza_colihue` | astil de colihue con punta | 1,1 | caña, punta, brea, tiento |
  | `estolica` | palo con tope que lanza el dardo | 0,6 | madera, asta, tiento |
  | `bola_perdida` | una bola con manija corta | 0,7 | bola, tiento |
  | `boleadora_dos` | dos bolas desiguales | 1,3 | bola, tiento, cuero |
  | `boleadora_tres` | tres ramales desde un nudo | 2,0 | bola, tiento, cuero curtido |
  | `arco_colihue_obj` | arco de colihue | 0,9 | caña, tendón, cordel |
  | `linea_mano` | cordel enrollado en la mano | 0,2 | cordel, anzuelo |
  | `cana_colihue` | caña de colihue | 0,6 | caña, cordel, anzuelo |
  | `arpon_hueso` | astil con púas de hueso | 0,8 | hueso, caña, brea, tiento |
  | `equipo_mosca` | caña con carrete | 1,0 | caña, hierro, cordel, cuero curtido |

- **El molde ya existe y está medido** (ronda 5, fase 3): origen en el puño y +Y
  hacia lo que trabaja, a lo sumo dos materiales por objeto con las piezas
  fusionadas, tintas compartidas desde `Cuerpo._tinta()` —así equipar no compila
  nada— y cinco familias de pose en `MONTAJES`. Topes: ≤ 900 triángulos y ≤ 2
  mallas por objeto, y **−0,01 ms** medido para una herramienta en la mano.
- **La tinta `llama` es emisiva siempre** (`PALETA.llama`): la punta de la antorcha
  brilla aunque esté apagada. Es la hipótesis de B5 en la fase 2; si esa fase la
  confirma, el arreglo cae en los archivos de ésta.

### Propiedad exclusiva de archivos

- `src/entities/Herramientas3D.js` — los doce modelos y sus poses
- `src/entities/Cuerpo.js` — **sólo** si una pose o la emisión de la llama lo piden

Del coordinador: `src/main.js` (qué va a la mano). Bitácora:
`.claude/flota/r7-empunadura.md`.

### El contrato

**E1 · Lo del arma se ve.** Con la mano vacía y algo en la ranura del arma, el
cuerpo lo lleva. **Con una herramienta en la mano, va la herramienta** —la antorcha
encendida también es de mano—. El cableado es una línea de `main.js`, del
coordinador.

**E2 · Los doce tienen modelo**, con el molde de los dieciocho: ≤ 900 triángulos y
≤ 2 mallas cada uno, y materiales sacados de la paleta compartida. Si hace falta
una tinta nueva —el colihue no es madera parda—, se agrega a la paleta con su
motivo; **en total, a lo sumo doce tintas**.

**E3 · Se distinguen por la silueta**, que es la regla de la ronda 5 («un hacha de
piedra y un pico de asta se distinguen de lejos por la forma, no por el color»).
Medido: **no hay dos modelos de los treinta con las tres medidas de su caja —en el
espacio del modelo, sin la pose— dentro del 15 % entre sí**.

> **Medido contra los 18 de hoy antes de escribir el banco**: en el espacio del
> modelo, **cero pares** dentro del 15 %; con la caja ya posada en la mano, uno
> —azuela y sierra—, porque la pose las inclina parecido. Medida posada, la
> aserción habría estado roja antes de que nadie tocara nada, que es el defecto de
> B4 otra vez. Por eso va sin la pose. La barreta, la más larga, mide 1,06 m. Las medidas salen de objetos reales —el largo de una lanza de
colihue de a pie, de un arco, de los ramales de una boleadora— y la fuente o el
criterio de cada una va en la bitácora.

**E4 · Nada se clava en el suelo ni atraviesa el cuerpo parado.** Con el jugador
de pie, el punto más bajo de cada modelo queda al menos 2 cm sobre la planta de los
pies. Las boleadoras y la honda pueden colgar: colgar no es enterrarse.

**E5 · Equipar no compila nada.** Todo material de un modelo es un material de la
paleta de `Cuerpo`: ninguna bandera nueva en la clave del programa.

**E6 · Cachear y no crecer.** Cien cambios entre mano y arma dejan el grafo del
mismo tamaño y los modelos con los mismos triángulos.

**E7 · Si la fase 2 confirma B5**: la antorcha y el candil apagados no brillan; la
emisión de la llama sigue a `equipo.luzActiva()`, sin compilar nada.

**E8 · Costo.** A Baja 1024×576, en primera y tercera persona, con el objeto más
grande en pantalla —lo mide el coordinador, alternado—: **≤ +0,3 ms**.

**E9 · Sin regresión.** El banco de la ronda 5 fase 3 (4/4) y los de la ronda 7
siguen verdes, y `vite build` limpio.

### Lo que NO es de esta fase

Animar el gesto de tirar, lanzar o pescar. Cambiar cómo cazan o pescan las armas.
Recuperar flechas.
