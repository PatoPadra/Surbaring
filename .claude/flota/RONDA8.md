# RONDA 8 — Lo que vio el dueño, segunda vuelta

> Abierta el 18/9/2026. Rama `mejoras/ronda8-lo-que-vio`, sacada de `main` en
> `e465149` (la ronda 7 fusionada y subida ese mismo día).
>
> El dueño jugó la ronda 7 y trajo cinco anotaciones. Esta carta las mide antes de
> encargar nada. **El dueño se va a Chile el 18/9 y vuelve el lunes 21 a la noche**:
> pidió que la ronda siga sin él, con más peso en los gráficos. Contestó las
> decisiones que le tocaban antes de irse (abajo).
>
> Método, el mismo de las rondas 3 a 7: un jefe con subagentes, propiedad exclusiva
> de archivos, y se cierra de a una fase. El banco de cada fase lo escribe el jefe
> antes de ver el código del agente, lo valida contra la base y le pone un falsador
> al lado. Se revisa leyendo código y midiendo en el juego, nunca por el informe.
> Se commitea en cuanto algo está medido. **No se fusiona a `main` ni se sube nada
> hasta que el dueño lo juegue y lo pida.**

---

## Las cinco anotaciones, tal como llegaron

1. trampa de lazo no se puede poner, tiene que poder ponerse y que quede en el mapa
   marcado (si no no sé adónde tengo que volver)
2. + zoom en el mapa
3. minimapa chico abajo derecha
4. la flecha del pj en el mapa está al revés
5. es un poco más macro, pero le falta más «paso a paso» de crafteo, por ejemplo,
   trabajar piedra para después hacer un hacha, un martillo, etc. Por eso también
   creo que enfocarse en la primera hora real de vida puede ser un buen objetivo.
   Después, más en general, como uno de los limitantes que tengo con el juego es
   pensar la trama/objetivo, se me ocurrió uno que puede ser cumplir el primer año
   de supervivencia, que el juego arranque en primavera y que uno de los primeros
   desafíos de verdad verdadera sea pasar el invierno con un buen refugio.

---

## Las decisiones del dueño, contestadas el 18/9/2026

Llegaron como afirmaciones en la carta anterior y el dueño pidió preguntas. Se le
hicieron como preguntas con opciones, y contestó todas:

| decisión | lo que eligió | qué quiere decir en esta ronda |
|---|---|---|
| **Recolección en el Parque** (ilegal en la vida real) | **licencia dicha** | sigue permitida; el códice y el primer cartel dicen que en la realidad está prohibida y por qué. Como `arenaDePlaya`. Fase 7 |
| **Regla de la muerte** | **se pierde todo** | bolso y las cuatro ranuras. La llama se apaga. La pantalla de fin lo dice. Fase 7 |
| **La lana** (2 de cada 3 coirones) | **bajarla** | el jefe la baja a **1 de cada 4** (≈47 matas por poncho, contra 17,7 hoy y 84 antes de la ronda 7). Fase 7. La propuesta de *vellón por mata* queda descartada |
| **El metawe** (2 medidas, pesa más que el odre de 6) | **sí, es el paso previo** | no se toca |
| **El suelo naranja junto al fuego** | **bajarlo un poco** | menos naranja y menos alcance, sin volver a negro. Fase 6 |
| **La luz de la luna** | **ley real de Allen** | en cuarto alumbra la décima parte que llena. Fase 6 |
| **El primer año** (arrancar en primavera, pasar el invierno) | **propuesta escrita** | se mide la primera hora y el calendario y se escribe el diseño; **no se toca código de eso** |
| **Alcance mientras no está** | **todo, incluido el paso a paso** | notas 1 a 4, gráficos, y el trabajo de la piedra de la nota 5 |
| **Qué gráfico molesta más** | **el suelo de cerca · árboles y follaje** · «otra cosa» sin texto | fases 3 y 4. **La «otra cosa» no llegó escrita: preguntarle a la vuelta** |

---

## Lo que se midió antes de encargar nada

Medido el 18/9/2026 en la vista previa (Intel HD 4000, Baja, 1024×768), con
`partida.guardar` y `calidad.automatico` anulados. La partida de la vista previa
estaba en el 12/2/2025 a las 10:49 y quedó ahí.

### 1 · La trampa de lazo no se puede poner — confirmado, y no está sola

`trampa_lazo` (`herramientas.json:898`) declara `"pasiva": true` y `"habilita":
["trampear"]`. **Ningún archivo de `src/` lee `pasiva` ni `trampear`.** No tiene
`ranura`, así que `equipo.equipar('trampa_lazo')` devuelve `false` —medido—, y en el
bolso el único botón que le toca es «Tirar» (`Bolso.js:699-702`: «Sacar» pide
`def.ranura`). Es otro efecto declarado sin consumidor.

**La nasa de junco y la red de fibra son la misma familia**: «se deja calada y se
vuelve al otro día» (`herramientas.json:1494`, y la acción «Calar una nasa o una
red», `:2223`). `Pesca.js` no las nombra. Entran en la misma fase, con el mismo
mecanismo, porque el defecto es uno: **no existe «dejar algo en el mundo que trabaja
solo y volver a buscarlo»**.

Y la parte que el dueño subraya: **«que quede en el mapa marcado»**. `Hallazgos`
ya pinta las obras propias como una X (`Hallazgos.js:467`), así que el camino
existe.

### 2 · Más zoom — confirmado: el techo es 8 m por píxel

`ZOOMS = [1, 2, 3.2, 6.4, 12.8]` (`Mapa.js:86`): el último peldaño es **8 m/px**,
una ventana de **5,1 km**. Medido: al zoom máximo, la zona explorada al arrancar
ocupa un cuadrado de ~1 km en el medio del lienzo, y **una trampa a 200 m queda a
25 px de la flecha**. Pasado ×3,2 el relieve es el dibujo de 32 m/px estirado, y el
pie lo dice.

Y un detalle que muerde con más zoom: **la vista no se centra en el jugador al
abrir**. `vista.cx/cz` sobreviven entre aperturas, así que quien camina 3 km y abre
el mapa ampliado mira el lugar de antes.

### 3 · El minimapa — no existe

Ni una línea en `src/`. En 1024×768 los elementos visibles del HUD son `#geo`
(16,16–259,155), `#reloj` (840,16–1008,238), `#cruz-sur` (728,276–1008,502),
`#vitales` (16,621–232,752), `#bolso` (240,691–440,752) y `#accion`. **La esquina
de abajo a la derecha, de x 840 a 1008 y de y 540 a 752, está libre.**

### 4 · La flecha del jugador, al revés — confirmado: 180° justos

`Mapa.js:476`: `rumbo = -this.jugador.giro + Math.PI`, y la punta se dibuja en
`(0, −7)`. Medido en el juego con cinco giros (0, π/2, π, −π/2, 0,7): la dirección
de avance es `(−sin g, −cos g)` —comprobado contra `camara.getWorldDirection()`,
que dio (−0,25 · 0,97) con `giro` 2,89— y **la flecha apunta a exactamente la
opuesta en los cinco**. El `+ Math.PI` sobra.

### 4b · Encontrado midiendo: la brújula de arriba nunca estuvo centrada

`#brujula` (`index.html:93`) tiene `top: 0; left: 50%; transform:
translateX(-50%)` **y ninguna `position`**: queda `static`. Medido: su caja va de
**x = −220 a x = 220**, o sea que se ve media brújula en la esquina de arriba a la
izquierda, y `#geo` la tapa. Viene así desde el prototipo (`6035732`): nadie la vio
nunca en su lugar. Entra en la fase 1, que es la de orientarse.

### 5 · El paso a paso — confirmado: el hacha sale de un solo paso

Del árbol de `herramientas.json`, por nivel:

- **nivel 0** (sin tecnología): cordel, garrote, antorcha.
- **nivel 1**: `lasca_rodado` (2 piedras), y todo lo demás pide obsidiana, hueso o
  cuero.
- **nivel 2**: `hacha_piedra` = **2 piedras + 1 mango + 4 tientos**, con la
  tecnología `hacha_pulida`. `azuela` igual con 3 tientos.
- **el único martillo del juego es de hierro** (nivel 4, en la fragua).

No hay percutor, ni preforma, ni pulido: la piedra del suelo entra directo al
hacha. «Pulida» está en el nombre de la tecnología y en ningún paso.

**Y el juego arranca el 12 de febrero, en verano** (medido en el HUD). El dueño
quiere arrancar en primavera: queda para la propuesta escrita.

### 6 · Gráficos — medido en Baja, que es donde juega el dueño

Capturas en `capturas/r8-medir-suelo.png` y `capturas/r8-medir-arboles.png`
(-41,10 · -71,52, 12/2/2025 10:49, 1024×576).

- **El suelo de cerca** es una mancha marrón de ruido borroso. No hay piedritas, ni
  hojarasca, ni transición de tierra a pasto: la tierra desnuda llega hasta el pie
  de la mata y el pasto de lejos es una capa verde lisa. Las piedras son poliedros
  facetados de un gris pálido que no es el del suelo.
- **Las copas** son masas verde oscuro saturado con el borde picado por el recorte
  alfa, y el tronco apenas asoma. De lejos, en la ladera, puntos.

Esto es la descripción de lo que se ve. **El diagnóstico de cada una se hace al
abrir su fase**, midiendo: un argumento que cierra no es una causa.

---

## El orden, y por qué

| fase | agente | notas | qué |
|---|---|---|---|
| **1** | `rumbo` | 2, 3, 4 y la brújula | la flecha, la brújula, más zoom, centrar al abrir, y el minimapa |
| 2 | `lazo` | 1 | poner la trampa, la nasa y la red; que trabajen solas; marcadas en el mapa y el minimapa |
| 3 | `suelo` | gráficos | el suelo de cerca |
| 3b | `suelo` | encontrado en la 3 | la luz del terreno en el marco de la cámara |
| 4 | `copa` | gráficos | árboles y follaje |
| 5 | `piedra` | 5 | trabajar la piedra paso a paso: percutor, preforma, pulido; el hacha y el martillo de piedra salen de ahí |
| 6 | `luz` | decisiones | la fogata menos naranja; la luna con la ley de Allen |
| 7 | `reglas` | decisiones y deudas | la muerte, la lana, la licencia de recolección, y las deudas anotadas |

Y aparte, del jefe: **la propuesta del primer año**, escrita en
`r8-primer-anio.md`, cuando la fase 5 haya medido la primera hora.

- **La 1 primero** porque son tres de las cinco notas, son chicas, y la 2 necesita
  el minimapa para marcar.
- **La 2 pegada** porque es la nota que el dueño puso primera.
- **Los gráficos antes que la piedra**, porque el dueño pidió más peso en los
  gráficos y la piedra es trabajo de datos con fuentes que conviene hacer con calma.
- **La 6 y la 7 al final** porque son decisiones ya tomadas y chicas.

**Regla que sigue de la ronda 7:** todo objeto o recurso nuevo necesita su icono en
`Iconos.js`, y el banco de la ronda 6, fase 3, lo exige.

---

## FASE 1 · `rumbo` — la flecha, la brújula, más zoom y el minimapa

### Propiedad exclusiva de archivos

El agente escribe **sólo**:

- `src/ui/Mapa.js` — la flecha, la escalera de zoom, centrar al abrir, y lo que
  haga falta compartir con el minimapa
- `src/ui/Minimapa.js` — **nuevo**
- `index.html` — **sólo** la regla de `#brujula`

Del coordinador: `src/main.js` (crear el minimapa y llamarlo en el bucle), los
bancos, el falsador y esta carta. `Hallazgos.js` no se toca en esta fase: el
minimapa lo usa como el mapa, por `dibujar(c, proy, op)`. Cualquier otro archivo se
pide en `pendiente-r8-rumbo.md`.

### El contrato

**R1 · La flecha apunta hacia donde mira el jugador.** En el mapa y en el
minimapa, la punta de la flecha va en la dirección de avance `(−sin giro, −cos
giro)` proyectada al lienzo, **a menos de 1°**, para cualquier giro. Una sola
función decide el rumbo de las dos flechas: no puede pasar que se arregle una y la
otra quede al revés, así que `Minimapa.js` la importa de `Mapa.js`.

La flecha sigue siendo **un polígono relleno de 3 a 6 vértices, sin curvas**,
centrado en el jugador: es lo que el banco reconoce en el lienzo. La forma, el color
y el tamaño los elige el agente.

**R2 · La brújula centrada.** `#brujula` queda centrada arriba: el centro de su caja
a menos de 1 px del centro de la ventana, y sin pisar `#geo` ni `#reloj`.

**R3 · Más zoom.** La escalera llega **a 2 m/px o menos** (una ventana de 1,3 km o
menos), sin quitar ninguno de los peldaños de hoy. Lo que sigue valiendo:

- el zoom va hacia el cursor y deja quieto lo que está bajo el cursor;
- la vista no se sale del mundo en ningún nivel;
- el pie dice la verdad: pasado el techo del DEM, dice que el relieve está
  ampliado sobre el dato, y la equidistancia que promete es la que está trazada;
- **las marcas, los topónimos y la flecha se dibujan a su tamaño en píxeles** en
  cualquier nivel: no se estiran con el relieve.

Cómo se ve el relieve pasado el techo —estirado como hoy o reconstruido desde el
DEM— lo decide el agente, con dos condiciones: **no inventa filos** (el mapa sigue
leyendo `alturaBaseEn`) y abrir el mapa y llevarlo al zoom máximo no cuesta más de
lo que cuesta hoy llevarlo al máximo actual. Se mide en el juego de dos maneras:
**las alturas leídas del terreno** —la base lee 412.164, un recorte de 642²— con
25 % de margen, y **el tiempo alternado** con una copia del `Mapa.js` de la base en
la misma sesión, con 50 % de margen.

`Mapa` conserva su superficie pública: `alternar()`, `dibujar()`, `verTodo()`,
`aPixel(x, z)`, `aMundo(px, py)`, `nivel`, `vista`, `abierto`, `lienzo`, `ctx`, `el`.
La rueda y el arrastre siguen en el lienzo.

**R4 · Al abrir, el mapa mira al jugador.** Abrir el mapa conserva el nivel de zoom
y centra la vista en el jugador (con el límite de siempre: la vista no se sale del
mundo). Al nivel 0 no cambia nada, porque la ventana es el mundo.

**R5 · El minimapa.** Un módulo nuevo, `src/ui/Minimapa.js`, que exporta
`class Minimapa` con `constructor(deps)` —las mismas dependencias que `Mapa` más el
mapa: `{mundo, jugador, exploracion, hallazgos, construccion, codice, mapa}`— y
`actualizar(dt)`, que el coordinador llama una vez por cuadro. Crea su propio
elemento, `#minimapa`, dentro de `#hud`, y expone como `Mapa`: `el` (el
`#minimapa`), `lienzo`, `ctx`, `aPixel(x, z)` y `dibujar()`, que redibuja ya.

- **Dónde**: abajo a la derecha, con al menos 12 px de margen a los dos bordes,
  entre **110 y 200 px CSS** de lado a 1024×768, **sin pisar ningún otro elemento
  visible del HUD** (`#vitales`, `#bolso`, `#accion`, `#cruz-sur`, `#reloj`).
- **Qué muestra**: el relieve como el mapa (los mismos colores, el mismo
  sombreado, el agua), **el velo de lo no explorado** —lo desconocido tapado igual
  que en el mapa: el minimapa no puede revelar lo que el mapa esconde—, las marcas
  de `Hallazgos` (hallazgos y obras) y la flecha del jugador.
- **Orientación**: norte arriba, como el mapa, con el jugador en el centro. Expone
  `aPixel(x, z)` con la misma convención que `Mapa.aPixel`: el norte (−z) hacia
  arriba, el este (+x) a la derecha.
- **Escala**: una ventana de **entre 400 m y 1500 m** de lado, fija. Con escala
  gráfica o sin ella, a elección del agente.
- **Costo**: `actualizar()` no redibuja todos los cuadros. Medido en el juego
  caminando 10 s en Baja: **promedio menor a 0,25 ms por cuadro y ninguna llamada
  mayor a 6 ms**. El relieve se reconstruye sólo cuando el jugador se acerca al
  borde de lo ya dibujado, no por metro caminado.
- **Se esconde** cuando el mapa grande está abierto: `#minimapa` lleva la clase
  `oculto` y no dibuja nada mientras tanto. Con el HUD escondido se esconde solo,
  porque vive adentro.
- **Las marcas** salen de `hallazgos.dibujar(c, proy, op)`, con la misma proyección
  que `aPixel` y `op.construccion`, como en el mapa.

**R6 · Sin regresión.** Los siete bancos de la ronda 7 siguen verdes (6/6, 4/4,
7/7, 6/6, 10/10, 9/9, 7/7 contra la base), y `vite build` limpio.
`r2-carta-mapa.mjs` mira métodos internos del mapa y fija la escalera vieja: se
corre y se informa, pero no manda, porque el contrato nuevo permite construir el
relieve pasado el techo. Lo que medía de comportamiento —el zoom hacia el cursor,
la vista dentro del mundo, la proyección de ida y vuelta— lo vuelve a medir este
banco por la rueda y el arrastre, sin mirar métodos internos.

### Lo que el banco no mide

Si el minimapa se lee bien de un vistazo mientras se camina, y si 160 px o 180 px es
«chico». Eso es del ojo del dueño.

### CERRADA el 18/9/2026

**Banco 7/7** con la regresión de los siete bancos de la ronda 7 y `vite build`;
**falsador 16 de 16** con los 3 controles verdes; **mitad navegador 29/29**.

- **La flecha** apunta a 0,0° de la dirección de avance en los ocho giros, en el mapa
  y en el minimapa: una sola función, `rumboEnLienzo(giro) = −giro`, exportada de
  `Mapa.js`. En el juego, con giro 2,89 (rumbo 194°, la brújula en la S), la punta de
  la flecha del minimapa se midió en los píxeles del lienzo a 105,8° contra 104,4°.
- **La brújula** quedó centrada (292–732 a 1024 px). **Y destapó otra superposición**:
  con un fenómeno activo, sus etiquetas (y 16–38) tapaban los rumbos (y 0–30). El
  coordinador bajó `#fenomenos` a `top: 2.6rem` (`HUD.js`): medido, y 42–64, sin
  pisarse.
- **El zoom** llega a 2 m/px en siete peldaños. El relieve se reconstruye en cada uno
  leyendo `alturaBaseEn` y mide la pendiente sobre dos texels: medirla entre píxeles
  vecinos a 2 m dibujaba la grilla de 32 m del DEM (la luz saltaba 6,94 veces más en
  los bordes de texel). Hasta 32 m/px el dibujo es idéntico al de la base, canal por
  canal. Al tope se leen **451.584 alturas contra 412.164** de la base (1,10; el
  agente predijo el número exacto), y alternado con la base tarda 182,0 ms contra
  191,4.
- **Al abrir**, el mapa se centra en el jugador y conserva el zoom.
- **El minimapa**: 180 px, 5 m/px, una ventana de 900 m, abajo a la derecha con 16 px
  de margen. Con la exploración en cero es 99,9 % velo; entera, 0,0 % oscuro. Se
  esconde con el mapa abierto. **Cuesta 0,007 ms por cuadro caminando** (máximo
  0,20) y **1,20 ms como máximo** reconstruyendo el relieve, que se arma de a 12 filas
  por cuadro. El agente había predicho 0,03–0,06: esta vez su número cayó del lado
  pesimista.

**Dos defectos del banco, los dos míos y los dos encontrados por el agente haciendo la
cuenta**: la X de la obra se medía ampliando hacia el centro del mundo, y a 2 m/px la
obra (a 1230 m) quedaba fuera de la ventana de ±640 m —con la escalera vieja cabía—; y
el parche `flecha-mini-al-reves` sumaba π en `actualizar` y otra vez en `dibujar`, que
se llaman uno al otro: 2π, nada plantado. Y dos más que encontré yo midiendo: con el
panel oculto el bucle no corre, así que N4 y N6 manejan los cuadros a mano; y N7 medido
suelto variaba de 50,5 a 72,4 ms entre sesiones, así que cuenta alturas y alterna con
una copia de la base.

**Para que lo mire el dueño**: la flecha es de 12 px con una muesca atrás; agrandada y
borrosa, a mí me pareció apuntar al revés y la medida dijo que no. Si a él también le
confunde, es cambiar la forma en `pintarFlecha`.

**Queda anotado** (`pendiente-r8-rumbo.md`): que `Hallazgos.dibujar` acepte
`op.leyenda === false`, para sacar el truco del `lado` corrido con que el minimapa
esconde la leyenda. Va con la fase 2, que es dueña de `Hallazgos.js`.

---

## FASE 2 · `lazo` — lo que se deja puesto y se vuelve a buscar

### Lo que se midió antes de escribir el contrato

Medido el 18/9/2026 en la vista previa, con los cuatro guardados anulados.

**1 · De qué vive una trampa.** `Fauna._aptitud(esp, altitud, humedad, pendiente,
estacion, distanciaAgua)` y `Fauna._actividad(esp, hora)` ya dicen qué tan probable
es cada especie en un lugar y a qué hora anda: es la misma cuenta con la que
`_reponer()` elige qué animal hace aparecer. La trampa puede sortear su presa con
eso, sin inventar una tabla aparte. Las especies de hasta 6 kg (`presaMaxKg` del
lazo) entre mamíferos y aves de más de 100 g, a las 2 de la mañana de verano:

| lugar | fracción de lo que anda que pesa ≤ 6 kg | las primeras |
|---|---|---|
| arranque (Reserva, 822 m) | 42 % | zorro gris chico 15 · zorrino 9,5 · **gato huiña 6,9** · cachaña 2,3 |
| centro (874 m) | 39 % | zorro gris chico 12,3 · zorrino 8,9 · **gato huiña 7,6** |
| sur (1552 m) | 65 % | zorro gris chico 35 · zorrino 26 |

**2 · Encontrado midiendo: diez especies viven pegadas al agua sin serlo.**
`Fauna._esAcuatica()` (`Fauna.js:91`) marca como acuática a toda especie que tenga
en sus biomas algo que case con `/ribera|lacustre|mallin|humedal|acuatic|rio|lago/`,
y a las acuáticas `_aptitud` les da **cero a más de 70 m del agua**. Pero `mallin`
es una vega húmeda, no agua, y `costa_lago` casa por `lago`. Caen ahí **el huemul,
el ciervo colorado, el jabalí, la liebre europea, el perro asilvestrado, el
tuco-tuco colonial, el aguilucho, el carancho, el chimango y la bandurria**: todos
tienen el mallín entre varios ambientes secos.

Medido, en proporción de lo que puede aparecer a las 2 de la mañana de verano:

| lugar (agua a) | liebre | ciervo | jabalí | huemul | gato huiña |
|---|---|---|---|---|---|
| arranque (543 m) — hoy | **0,0** | **0,0** | **0,0** | 0,0 | 6,9 |
| arranque — si «acuática» es que *todos* sus biomas son de agua | 10,7 | 3,5 | 27,9 | 0,1 | 2,8 |
| centro (1786 m) — hoy | 0,0 | 0,0 | 0,0 | 0,0 | 7,6 |
| centro — con la regla corregida | 9,2 | 3,5 | 27,7 | 0,1 | 3,3 |
| sur (5540 m) — hoy | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 |
| sur — con la regla corregida | 27,0 | 10,2 | 11,3 | 0,3 | 0,0 |

O sea: **hoy el ciervo colorado y el jabalí —las dos presas que la caza regulada
existe para nombrar— sólo aparecen a menos de 70 m de un lago o un arroyo**, y la
liebre, que es la presa de un lazo en la estepa, lo mismo. Es un defecto de la
ronda de fauna que nadie trajo porque nadie mira dónde aparece un animal. Entra en
esta fase porque la trampa sortea su presa con esa misma cuenta: con la regla de
hoy, un lazo en la estepa nunca agarraría una liebre.

**3 · La trampa no elige.** Con la regla corregida, en el arranque el gato huiña
—Vulnerable— sigue siendo el 2,8 % de lo que anda de noche. Un lazo no distingue, y
ésa es exactamente la razón que da `herramientas.json` para que el trampeo esté
prohibido en todo el Parque. El juego lo tiene que mostrar, no esconder.

**4 · Todo lo nativo está protegido.** En `fauna.json`, de las 25 especies de hasta
6 kg entre mamíferos y aves de más de 100 g, **23 tienen `protegida: true`**: son
nativas de un Parque Nacional. Sólo la liebre europea y el visón americano no lo
están. Así que casi todo lo que agarre un lazo va a ser fauna protegida, y ése es
exactamente el argumento de la ficha (`herramientas.json:919`): *«En el juego
funciona, bajo la misma licencia que el arco, y el aviso explica por qué un método
que no elige a quién agarra no entra en ningún reglamento del mundo real»*.

**5 · El reloj.** `tiempo.segundosTotales` son segundos **reales**
(`Tiempo.avanzar(dt)`); el tiempo del mundo es `tiempo.fecha`, que corre a
`velocidad` × —72 por defecto, 24, 900 o 7200 con la tecla—. Una noche de diez
horas son ~8 minutos de juego. La trampa trabaja con **`tiempo.fecha`**.

**6 · La nasa y la red.** `nasa_junco` (durabilidad 20, 1,8 kg) y `red_fibra` (50,
3,2 kg) son de categoría `pesca`, sin ranura, y tampoco tienen gesto. `Pesca`
elige qué pica con `_loQuePica(ambiente)`, que cruza `peces._aptitud` con `PICA`:
es la cuenta que les corresponde.

### Decisiones del jefe, tomadas midiendo

- **Qué cae**: una especie sorteada entre las que el lazo puede sostener
  (`presaMaxKg`, mamíferos y aves de 100 g o más) **con el mismo peso que usa
  `Fauna._reponer`**: `_aptitud × _actividad` en ese lugar y a esa hora. En el agua,
  la nasa y la red sortean con `Pesca._loQuePica`.
- **Cuándo cae**: un proceso de Poisson por hora de mundo. En tierra, la tasa en
  cada hora es **λ(h) = T × Σ aptitud × actividad(h)** sobre las especies que el
  objeto puede sostener, con los mismos argumentos que usa `_reponer` en ese punto
  (altura, humedad, pendiente en grados, distancia al agua, la estación de
  `tiempo.estado()` y la hora local de cada momento transcurrido, como la da
  `Tiempo.horaDecimalLocal`). En el agua, **λ = T**
  constante. `T` es un número por objeto declarado en `herramientas.json` como
  `tasaCapturaPorHora`, al lado de `criterioTasaCaptura`: la fuente, o la palabra
  «licencia» y el criterio a la vista. El resultado no puede depender de cada cuánto se mira: revisar una vez a
  las diez horas o cada diez minutos da la misma distribución.
- **Los peces de la nasa y la red están vivos**, así que siguen las reglas que ya
  tiene la caña en `Pesca.intentar`: el nativo se devuelve (y enseña), el salmónido
  de más de 40 cm se devuelve, el resto da pescado. La nasa y la red están
  prohibidas en toda la Patagonia (`notaLegal`): el juego las deja usar bajo la
  misma licencia y lo dice al ponerlas.
- **Lo protegido**: si cae una especie protegida, **no se aprovecha nada** —la ley
  que prohíbe cazarla no cambia porque el animal ya esté muerto— y el juego lo dice
  con la norma del trampeo: la primera vez por especie en el panel que espera
  (`Norma`), las siguientes en el cartel. Se registra igual. Es la tesis del juego
  —*la negativa es el contenido*— aplicada a la trampa. **Para que lo mire el
  dueño**: puede ser frustrante que la mayoría de lo que cae no se pueda usar.
  Es lo verdadero, y es lo que la ficha prometía.
- **Lo que no está protegido** (la liebre, el visón) rinde lo mismo que si se lo
  cazara: `Caza._faena(esp)`, entero, como en `Caza.intentar` (la caza no pide
  filo; el filo es regla de la carroña).
- **El lazo agarra uno solo y se gasta al agarrar** (durabilidad 1): después de la
  primera presa queda cerrado. Vacío, se levanta y vuelve al bolso entero. **La
  nasa y la red juntan todo lo que caiga** entre visita y visita (el conteo de
  Poisson entero, sin tope salvo los usos que les quedan) y gastan un uso por pez.
- **Lo puesto en el mundo no es del bolso**: con la regla de la muerte nueva
  («se pierde todo», fase 7), las trampas puestas quedan donde están.

### Propiedad exclusiva de archivos

El agente escribe **sólo**:

- `src/systems/Trampas.js` — **nuevo**: el modelo de lo puesto
- `src/world/Trampas3D.js` — **nuevo**: lo que se ve en el mundo
- `src/systems/Hallazgos.js` — **sólo** dibujar las trampas y su renglón de leyenda,
  y aceptar `op.leyenda === false` para no pintar la leyenda (lo pidió la fase 1)
- `src/ui/Minimapa.js` — **sólo** pasar `leyenda: false` y `lado: LADO` a
  `hallazgos.dibujar`, y borrar `LEYENDA_AFUERA`, que era el truco para esconderla
- `src/ui/Bolso.js` — **sólo** el botón «Poner» y su manejador
- `src/systems/Recoleccion.js` — **sólo** la rama de la trampa en
  `quePuedoHacer()` y en `actuar()`
- `src/systems/Partida.js` — **sólo** guardar y reponer las trampas
- `src/entities/Fauna.js` — **sólo** `_esAcuatica()`
- `src/systems/Pesca.js` — **sólo** sacar a un método la resolución de un pez ya
  capturado (devolver o guardar), para que la caña y la trampa usen la misma
- `src/data/herramientas.json` — **sólo** `tasaCapturaPorHora` y
  `criterioTasaCaptura` en `trampa_lazo`, `nasa_junco` y `red_fibra`

Del coordinador: `src/main.js` (crear `Trampas` y `Trampas3D`, pasarlas a quien las
pida, llamar `actualizar()` en el bucle), los bancos, el falsador y esta carta.

### El contrato

**L1 · La fauna vive donde vive.** Una especie es acuática si **todos** sus biomas
son de agua (`lago`, `rio`, `arroyo`, `costa_lago`, `humedal`, `mallin`), si es
piscívora, o si está en la lista de nombres de hoy. Las diez especies del punto 2
dejan de serlo; el huillín, el coipo, el visón, los macás, el biguá, el martín
pescador, el pato de los torrentes, el cauquén y todos los peces siguen siéndolo.

**L2 · Poner.** `Trampas` exporta la clase con `constructor(deps)` —`{mundo,
fauna, peces, pesca, inventario, equipo, caza, norma, hud, tiempo, jugador,
objetos}`, donde `objetos` es `herramientas.json` `.objetos` y `tiempo` es el
`Tiempo` de verdad— y:

- `evaluarPoner(objetoId, x, z)` → `{ ok, motivo, x, z }`: dónde iría y si puede. El
  lazo va en tierra firme, fuera del agua; la nasa y la red, **en el agua**, a no más
  de 3 m de donde está parado el jugador (el punto de agua más cercano).
- `poner(objetoId)` → `{ ok, motivo, trampa }`: la saca del bolso (la instancia con
  su durabilidad, si la tiene) y la deja en el mundo. Sin la trampa en el bolso, o
  en un lugar que no sirve, no hace nada y dice por qué.
- `lista`: lo puesto, cada uno con `{ id, objeto, x, z, puestaEn, presas }`, donde
  `presas` es la lista de lo que cayó y todavía no se revisó (cada una con al menos
  `especieId`), y `puestaEn` un número de milisegundos del reloj del mundo.
- `serializar()` → datos planos; `reponer(datos)` los vuelve a poner, modelos
  incluidos cuando haya `Trampas3D`.

**L3 · Cae algo, con la cuenta del juego.** `actualizar()` lee `tiempo.fecha` y
resuelve lo que pasó desde la última vez. La presa se sortea como dice arriba, y la
cantidad de capturas por noche en un lugar sigue la tasa declarada: medido sobre
muchas noches, la media cae a menos del 15 % de la que da la fórmula, y la
composición por especie a menos de 3 puntos de los pesos de `_aptitud × _actividad`.
**Sólo especies que el objeto puede sostener.** Mirar cada diez minutos o una sola
vez a las diez horas da la misma distribución.

**L4 · Revisar y levantar.** `cerca(x, z)` devuelve la trampa a menos de 2,5 m.
`revisar(trampa)` → `{ ok, presa, rinde, protegida, motivo }`: con presa no
protegida, el rinde de `Caza` entra al bolso; con presa protegida, nada entra, la
norma se muestra y se registra; el lazo se gasta. `levantar(trampa)` devuelve la
trampa vacía al bolso con su durabilidad; si el bolso no tiene lugar, no la levanta
y lo dice.

**L5 · La tecla.** El coordinador le pone a `Recoleccion` y a `Bolso` la propiedad
`trampas`. A menos de 2,5 m de una trampa, `recoleccion.quePuedoHacer()`
ofrece `tipo: 'trampa'` con una etiqueta que dice qué hay («Revisar la trampa ·
cayó una liebre europea», «Levantar la trampa · vacía»), y `actuar()` la resuelve.
Beber con sed y lo que ya tenía prioridad sobre la tecla la conserva.

**L6 · El bolso.** Los objetos `pasiva: true` y los de pesca que se calan tienen el
botón «Poner» en el bolso, que llama a `trampas.poner`.

**L7 · En el mapa y el minimapa.** El coordinador le pone a `Hallazgos` la
propiedad `trampas` (`hallazgos.trampas = trampas`); `Mapa` y `Minimapa` no se
tocan. `Hallazgos.dibujar` pinta cada trampa puesta con
un glifo propio por tipo, **a cualquier zoom y aunque el velo tape el lugar** (es
lo propio, como las obras), y un renglón «Tus trampas» en la leyenda. Una trampa
con presa se distingue de una vacía **sólo después de revisarla** (el mapa no sabe
lo que el jugador no vio). El minimapa la muestra solo, porque dibuja por
`Hallazgos`.

**L8 · Se guarda.** `Partida` recibe `trampas` entre sus dependencias y guarda y
repone las trampas por `serializar()` y `reponer()` —con su lugar, su
objeto, su durabilidad y lo que tengan adentro— como un campo opcional: `VERSION`
sigue en 1 y un guardado viejo entra igual.

**L9 · Se ve, sin compilar nada.** Cada trampa puesta tiene un modelo en el mundo,
chico y legible (el lazo con su estaca, la nasa como un cono de junco, la red como
un paño con flotadores). **Poner la primera trampa no compila ningún programa
nuevo**, medido en el juego como en la ronda 7: los materiales se compilan en la
carga. `Trampas3D` exporta la clase con `constructor(trampas)`, expone
`grupo` (el `THREE.Group` que el coordinador agrega a la escena), `sincronizar()`
(que el coordinador llama después de cada cambio de `trampas.lista`, o en el
bucle, a elección del agente mientras sea barato) y `modeloDe(trampa)`, que
devuelve el objeto 3D de esa trampa. Así el banco del navegador lo apaga y lo
prende para restar cuadros.

**L10 · Sin regresión.** Los bancos de la ronda 7 y la fase 1 de ésta siguen
verdes, y `vite build` limpio.

### CERRADA el 18/9/2026

**Banco 10/10** con la regresión (ronda 7 y fase 1) y `vite build`, corrido por el
coordinador sobre el código final; **falsador 21 de 21** con los 3 controles verdes;
**mitad navegador 10/10**.

- **La fauna vive donde vive.** Las diez especies con el mallín entre ambientes secos
  dejaron de ser acuáticas: el ciervo, el jabalí y la liebre aparecen lejos del agua.
- **La trampa se pone, trabaja sola y se marca.** El lazo va en tierra, un paso
  adelante; la nasa y la red, en el agua a 3 m o menos. Caen presas por un proceso de
  Poisson contra el reloj del mundo, integrado minuto a minuto con la misma cuenta de
  `Fauna`. En el mapa y el minimapa, un glifo propio por tipo, bajo el velo, y «Tus
  trampas» en la leyenda. En el juego, a 3 m el lazo cambia el 0,44 % de la pantalla
  (la caña doblada, las estacas, el ojal) y en el minimapa 35 píxeles.
- **Poner no compila nada**: 26 programas antes y después. `Trampas3D` dibuja siempre
  una muestra a 100 km bajo el suelo para que el programa exista desde la carga: cuesta
  una llamada de dibujo por pase, sin píxeles. No medido en la placa.
- **En el mundo real** —60 lugares a menos de 3 km del arranque, 300 noches de verano—
  **un lazo agarra algo el 31,3 % de las noches**, y de lo que cae **la liebre es el
  24,5 %**; el zorro gris chico el 24 %, el zorrino el 14 % y el gato huiña el 12 %.
  El agente había predicho 33,7 % y 26 %: su número cayó apenas del lado favorable.

**La tasa es una licencia, y está dicha.** Las fuentes que encontró el agente dan
0,85 liebres cada 100 lazos-noche (Short et al. 2012) y 3,2 capturas cada 100 con el 73 %
de otra especie (Defra 2012): llevado al juego, T ≈ 0,0012, o sea algo en el 0,9 % de las
noches. **Se usa T = 0,05, 41 veces la fuente**, con el criterio escrito en
`criterioTasaCaptura`. La nasa, con fuente (Merilä 2015: 0,66 peces por nasa y por
día); la red, derivada de la nasa. **Para que lo mire el dueño**: ¿es mucho, poco?

**Un defecto más del banco, el tercero de esta ronda encontrado por un agente**: la
aserción de la segunda norma prohibía cualquier llamada 'grave', incluida `anotar()`, que
nunca abre el panel, y empujaba a registrar como leve lo que no lo es. Corregido; el
código anota el veredicto grave de verdad. **Y un límite del banco que dice el agente con
la cuenta**: con una tasa realista el banco estadístico no alcanzaría a decidir (54 lazos
con presa de 6000, un error del 13,5 % contra un tope del 15 %). La tasa se eligió por el
juego, no por el banco, pero el banco no la dejaba ser realista.

**Encontrado al mirar el mapa al tope, y arreglado por el coordinador**: la costa salía en
escalones de 32 m, la grilla de la máscara de agua (el mapa preguntaba `esAgua`, el texel
más cercano). Pasado el techo del DEM, la máscara ahora se interpola como la altura.
Medido sobre el DEM real en ocho costas: la fracción del borde en tramos rectos de 8 px o
más baja de 0,995 a 0,565, el agua ocupa lo mismo (+0,3 %), y **hasta 32 m/px el dibujo
sigue siendo el de la base, byte a byte** (3 de 3 recortes, 0 canales distintos: lo había
afirmado el agente de la fase 1 y nadie lo había medido). Es la sección 8 nueva del banco
de la fase 1, que pasa a 8/8.

**Para que lo mire el dueño**: agarrar fauna protegida no descuenta saber (el contrato
no lo pedía), y los peces que la nasa devuelve no suman saber, para no premiar un arte
de pesca prohibido. Y una que es del contrato, no del agente: **con la trampa
vacía a menos de 2,5 m, la E la levanta**, antes que la planta o la piedra de al lado.
Recién puesto el lazo, apretar E para juntar algo cerca lo devuelve al bolso. El cartel
lo dice («Levantar la trampa de lazo · vacía»), pero jugando puede molestar.

---

## FASE 3 · `suelo` — el suelo de cerca, por textura

### Lo que se midió antes de escribir el contrato

**1 · Qué es hoy el suelo de cerca.** Es ruido y nada más: no hay una sola textura
de material. En los últimos metros el fragmento del terreno evalúa unas quince
funciones de ruido de valor —`macro`, `grano` y `meso` (fbm de 3 octavas), `micro` y
`gravilla` (fbm de 2), y ocho fbm más para la normal fina, cuatro en `f2` y cuatro en
`f3` (`Terreno.js:712-730`)—, más cuatro lecturas de `uTexDetalle`. El ruido de
valor da manchas redondeadas: no hay bordes de piedra, ni hojas, ni ramitas. Es la
«mancha marrón de ruido borroso» de la captura `r8-medir-suelo.png`.

**2 · Cuánto cuesta.** Medido con `bancoDesglose` (`public/banco.js`, reloj de la
GPU) en la HD 4000, Baja, 1024×576, en el arranque, tres corridas cada una:

| vista | cuadro entero | el terreno | fracción |
|---|---|---|---|
| al frente (cabeceo −4°) | 32,3 · 32,5 · 32,6 ms | **12,8 · 13,1 · 12,8 ms** | 40 % |
| **al suelo** (cabeceo −35°, 1,7 m) | 30,0 · 30,1 · 29,5 ms | **17,6 · 17,8 · 17,1 ms** | **59 %** |

El instrumento repite a ±0,4 ms. Mirando al suelo, el terreno es más de la mitad
del cuadro: ahí se paga el ruido del suelo cercano, y es justo lo que se ve mal.

**3 · Por qué por textura.** Es la regla de la ronda 3 (`RONDA3.md`, «Por qué por
textura y no por shader»), medida en esta máquina: la GT 630M con la que juega el
dueño pierde 8× en matemática de shader y gana 2,3× en lecturas de textura. Un
suelo horneado offline a una textura con capas (three 0.169 es WebGL2: hay
`DataArrayTexture` con mipmaps limpios, sin la costura de un atlas) puede verse
mejor **y** costar menos que el ruido que reemplaza.

**4 · Cómo se ve, en números.** Capturas de 1024×576 en tres suelos distintos, el
12/2/2025 a las 12:00 hora local, a 1,7 m, **con el sotobosque apagado** para medir
el suelo y no el pasto (`r8-suelo-metricas.mjs`, prefijo `r8-base-sinpasto`):

| lugar (lat · lon) | detalle cercano¹ | brillo cercano² | detalle a 10–40 m³ |
|---|---|---|---|
| bosque húmedo (−41,05186 · −71,60042, 774 m, humedad 0,76) | **1,87** | 32,63 | 3,07 |
| estepa (−41,05534 · −71,26063, 850 m, humedad 0,27) | **2,09** | 44,61 | 11,43 |
| pedregal (−41,18125 · −71,54561, 1901 m) | **2,33** | 83,69 | 6,42 |

¹ media de |laplaciano| de la luminancia en el 43 % de abajo, mirando a −35°.
² luminancia media de esa franja, de 0 a 255. ³ lo mismo en la franja del 40 al 62 %,
mirando a −8°: es la guarda contra el aliasing.

La franja cercana repite exacto entre corridas (1,87 y 32,63 dos veces). Se descartó
medir el titileo con dos capturas corridas 2 cm: `capturar` vuelve a prender los
árboles según la distancia y el pasto se mueve con el reloj real, así que el par no
difería sólo en los 2 cm (42,8 de diferencia media en la estepa).

**5 · La piedra del suelo.** En la captura del pedregal, la piedra del sotobosque
es un poliedro de caras planas y **verdoso** (`r8-base-suelo-pedregal.png`), que no
es el gris de la granodiorita del terreno (`rocaBase` 0,222 · 0,212 · 0,200 lineal).

### Propiedad exclusiva de archivos

El agente escribe **sólo**:

- `tools/hornear-suelo.mjs` — **nuevo**: el horno, en Node, determinista
- `public/tex/suelo/` — **nuevo**: lo que hornea y su `manifiesto.json`
- `src/util/suelo.js` — **nuevo**: el cargador en tiempo de ejecución, con la misma
  degradación que `src/util/atlas.js` (sin archivos, el juego arranca igual)
- `src/world/Terreno.js` — el fragmento del terreno y lo que haga falta para darle
  las texturas
- `src/world/Sotobosque.js` — **sólo** el material de la piedra
- `src/engine/Calidad.js` — **sólo** si hace falta un alcance por preset

Del coordinador: `src/main.js`, los bancos y esta carta.

### El contrato

**S1 · Se hornea, no se inventa por píxel.** `node tools/hornear-suelo.mjs` escribe
en `public/tex/suelo/` al menos **cuatro capas** de suelo —la hojarasca del bosque
húmedo (coihue, lenga), el andisol pardo con lapilli de pómez, la estepa (arena
volcánica con coirón seco y gravilla) y el acarreo granítico de altura—, cada una
cuadrada, de lado potencia de dos entre 256 y 1024, en dos PNG: el de **albedo**
(RGB en sRGB, y la **altura** en A) y el de **normal** (la normal en R y G, la z se
reconstruye; la **oclusión** en B y la **rugosidad** en A). Más un `manifiesto.json`
que diga por capa `id`, `nombre`, `referencia` (qué suelo real retrata y de dónde sale
el dato), `periodoM` (cuántos metros abarca), `albedoMedio` lineal y
`archivos: { albedo, normal }`. Correrlo dos veces da los mismos bytes. Cada capa
**calza consigo misma**: la diferencia media entre la primera y la última columna (y
fila) no supera 1,25 veces la media entre columnas vecinas de adentro. Todo junto, con
mipmaps, entra en **12 MB** de memoria de video (cuatro capas de 512² con los dos
archivos son 10,7; los atlas de la fauna, 16,8).

**S2 · El suelo de cerca se lee.** En las mismas tres capturas de la tabla, con el
sotobosque apagado, el **detalle cercano sube al menos 1,5 veces** en los tres
lugares (≥ 2,81 · 3,14 · 3,50), **el brillo cercano queda a ±10 %** (el suelo no se
aclara ni se oscurece: la paleta calibrada de `Terreno.js` sigue mandando, y la
textura la modula), y **el detalle a 10–40 m no pasa de 1,6 veces** el de la base
(≤ 4,91 · 18,29 · 10,27): sin mipmaps esa franja se llena de ruido.

**S3 · Y cuesta menos.** Con `bancoDesglose` (reloj de la GPU, Baja, 1024×576, el
arranque), mediana de tres corridas, **alternado con la base en la misma sesión** (el
coordinador pone un rato el `Terreno.js` de la base y vuelve): **mirando al suelo, el
terreno baja al menos 1,0 ms** (esta mañana 17,1 a 17,8), y **al frente no sube más de
0,3 ms** (esta mañana 12,8 a 13,1). *Corregido el 18/9 a la noche: la misma base midió
13,7 y 14,1 al frente en otra sesión; con esa deriva, un umbral absoluto medía la
placa y no el código.* La
textura reemplaza al ruido de los últimos metros, no se le suma: donde la textura
manda, el fragmento no evalúa el `micro`, la `gravilla` ni la normal fina de ruido
de `f2` y `f3`.

**S4 · Sin compilar de más y sin mover el piso.** Cargar las texturas no recompila el
programa del terreno (se compila en la carga con un reemplazo del mismo tipo y la
textura llega por el valor del uniforme): medido en el juego, los programas no cambian
entre el primer cuadro y diez segundos después. Y **la física no se toca**:
`Mundo.alturaEn` da los mismos números en mil puntos al azar antes y después.

**S5 · La piedra.** La piedra del sotobosque se viste con la capa de roca del mismo
horneado, y su tono medio es el de la roca del terreno: se deja de ver verdosa.
Medido restando la captura del pedregal con sólo la piedra prendida y sin nada: sus
13.654 píxeles dan (74, 79, 63), un **verdor** —(G − (R+B)/2) / luminancia— de
**0,129**, contra 0,021 del suelo de alrededor. Tiene que quedar **por debajo de
0,05**.

**S6 · La repetición no se lee.** Cada capa se lee al menos con dos transformaciones de
coordenadas distintas (escala, giro o corrimiento) mezcladas, o con otra técnica de
anti-repetición que el agente declare en el comentario. Lo último lo decide el ojo del
dueño.

**S7 · Sin regresión.** Los bancos de la ronda 7 y de las fases 1 y 2 de ésta siguen
verdes, `lint-shader.mjs` sin errores, y `vite build` limpio.

### CERRADA el 19/9/2026

**Medido por el jefe, no por el informe.** Mitad navegador, con la base (el `Terreno.js` y
el `Sotobosque.js` de `HEAD`) medida en la misma sesión: **6/6**.

| | base de la sesión | fase 3 |
|---|---|---|
| terreno mirando al suelo (−35°) | 13,5 · 13,4 · 13,3 → **13,4 ms** | 4,6 · 4,6 · 4,6 → **4,6 ms** (−8,8) |
| terreno al frente | 13,1 · 13,3 · 13,3 → **13,3 ms** | 10,2 · 9,0 · 9,3 → **9,3 ms** (−4,0) |
| programas, dibujando y al cambiar la textura | | 31 → 31 · 31 → 31 |

Banco Node **7/7**, con las capturas de semilla fija contra la base sacada con el mismo
instrumento:

| lugar | detalle cercano | brillo contra la paleta sola | brillo contra la imagen de la base |
|---|---|---|---|
| bosque | 1,88 → **17,09** (×9,1) | **+2,1 %** | +13,4 % |
| estepa | 2,14 → **17,84** (×8,3) | **−0,4 %** | +5,3 % |
| pedregal | 2,61 → **30,43** (×11,7) | **−4,8 %** | +0,3 % |

La piedra: verdor **0,003** (base 0,129), color (90, 88, 86). El piso: la huella de mil
puntos, igual. Falsador: **10/10**, con sus controles.

El agente predijo el brillo en +3,9 / +4,9 / −0,7 % y el costo entre 12 y 14,5 ms: el
brillo cayó del lado favorable (el bosque salió +13,4 % contra la imagen de antes) y el
costo del desfavorable (4,6 ms). Las dos cosas se midieron de nuevo acá.

**Del coordinador.** `main.js` espera las capas en la pantalla de carga y las sube con
`render.initTexture` (el punto 2 del pendiente del agente), así el primer paso no paga la
subida ni los mipmaps. Y el comentario del sesgo de LOD en `Terreno.js` citaba una guarda
que ya no existe: se reescribió con lo medido (el sesgo no cambia nada distinguible del
ruido de una recarga en el error contra el supermuestreo 2×; queda por el movimiento).

**Siete defectos del banco, todos del jefe:**

1. Los umbrales absolutos de costo medían la placa (la misma base dio 12,8 y 14,1 ms en
   dos sesiones) → alternar con la base en la misma sesión.
2. La guarda de «a 10–40 m el detalle no pasa de ×1,6» contaba detalle de verdad como
   aliasing y empujó al agente a desenfocar → se sacó; los mipmaps y el LOD por derivadas
   se miran en el código (sección 2), y el filtrado con `r8-filtrado.navegador.js`.
3. T2 no podía ver una recompilación: para cuando corre, las capas ya llegaron → T2b
   cambia la textura por su reemplazo y vuelve.
4. `import('/banco.js')` desde un módulo servido por Vite da 500 → etiqueta `<script>`.
5. **El clima es al azar en cada carga** (`Tiempo._semillaA/_semillaB`): la misma vista
   dio −1 % en una sesión y +26 % en otra contra la misma constante. → T3 fija las
   semillas, vacía los eventos y apaga lo que se siembra al azar; la base se saca con el
   mismo instrumento. Dos cargas dan ahora capturas idénticas bit a bit
   (`r8-repetible.mjs`).
6. **El brillo contra la imagen de la base castigaba sacar el ruido viejo.** Con el suelo
   horneado totalmente plano —módulo 1 exacto, normal plana: la paleta sola— el bosque ya
   sale +11 %, la estepa +5,7 % y el pedregal +5,4 % (`r8-suelo-aislar.navegador.js`): el
   ruido viejo no era neutro, dejaba el suelo por debajo de sus albedos calibrados. La
   hipótesis anterior —que era la luz torcida del punto de abajo— se probó y se descartó:
   con la luz corregida en las dos, el bosque sale +20 %, no menos. → La referencia es la
   paleta sola, sacada en la misma tanda (`r8-f3-plano-*`), y el cambio contra la imagen
   de antes queda informado.
7. La sección del horno reescribía `public/tex/suelo/` con los mismos bytes y fecha nueva:
   las capturas quedaban «viejas» en la misma corrida, y Vite recargaba la página. → Lo
   que el horno reescribe idéntico recupera su fecha; la frescura se mide sólo contra lo
   que lee el cargador; y el control del período del falsador mira las secciones 1 y 2,
   porque el período de la capa 0 sí cambia la imagen.

**Encontrado por el agente y confirmado midiendo:** la normal del terreno se ilumina en
el marco equivocado desde el prototipo. Es la fase 3b.

**Para que mire el dueño:** el suelo de cerca en los tres ambientes (y si el mosaico de
2 m se lee como repetido, que es S6 y lo decide el ojo); y que el suelo del bosque, mirando
abajo, queda **un 13 % más claro que antes**: no es la textura, es que el ruido viejo lo
oscurecía por debajo de la paleta calibrada.

---

## FASE 3b · `suelo`, retomado — la luz del terreno, en el marco de la cámara

### Lo que se midió antes de escribir el contrato

**1 · El defecto, encontrado por el agente `suelo` en la fase 3** (`pendiente-r8-suelo.md`,
punto 3). En el reemplazo de `<normal_fragment_begin>` el terreno arma `normal` desde
`gNormalDEM`, que es la normal del DEM **en el marco del mundo**, le suma el relieve fino
(el DEM fino, `f2`, `f3` y ahora la normal horneada) en ese mismo marco, y se la pasa así
a three, que ilumina **en el marco de la cámara** (las luces vienen multiplicadas por
`viewMatrix`). Así desde el prototipo (`6035732`). La luz del suelo depende de hacia dónde
mira la cámara. Nadie lo vio porque la paleta se calibró mirando al frente, donde el error
es chico: con el cabeceo de −8°, el sol directo se equivoca a lo sumo en sen 8° ≈ ±14 %
de su componente horizontal.

**2 · Medido en el juego, con el código de la fase 3** (`banco-r8-fase3b.navegador.js`,
semillas del clima fijas, sólo terreno y cielo). Mirando derecho abajo desde 4 m y
**girando la cámara sobre su propio eje** —la vista no cambia, sólo gira la imagen—, el
brillo del mismo pedazo de suelo:

| lugar | 0° | 90° | 180° | 270° | cambio |
|---|---|---|---|---|---|
| bosque (15°) | 45,8 | 47,3 | 8,7 | 8,7 | **+446 %** |
| estepa (3°) | 62,0 | 60,7 | 14,9 | 14,9 | +315 % |
| pedregal (15°) | 96,0 | 100,0 | 41,3 | 39,7 | +152 % |
| ladera de 25° | 51,4 | 75,7 | 21,0 | 21,0 | +261 % |

Y desde 10 m, bajando 35°, mirando el mismo punto llano de la estepa desde cuatro rumbos:
92,4 · 60,2 · 57,5 · 92,0, un **61 %**.

**3 · Qué va a cambiar a la vista, medido antes de encargar** (experimento del jefe, no
el arreglo: la línea que propuso el agente, puesta en una copia de la base y en otra de
la fase 3, sólo para saber qué esperar). Mirando al suelo a −35° con el sol a la espalda
—el caso de las capturas de la fase 3—, el suelo se aclara **un 35 a 40 %**: el sol entraba
como si estuviera a 20° sobre el horizonte. Mirando al frente, entre +2 y +11 %. De cara al
sol, mirando abajo, se va a oscurecer: ahí el defecto le daba de más.

### Decisiones del jefe

- **Es física, no gusto:** la paleta de `Terreno.js` son albedos lineales medidos, y la luz
  les llegaba torcida. No se recalibra nada para compensar: si algo queda claro u oscuro de
  más con la luz derecha, es otra fase y la decide el ojo del dueño.
- **La hace el mismo agente que la encontró**, retomado con `SendMessage`: ya tiene el
  terreno en la cabeza y el arreglo escrito en su pendiente. El banco lo escribió el jefe
  sin mirar el arreglo: mide invariancias que tiene que cumplir cualquier luz bien puesta.

### Propiedad exclusiva de archivos

El agente escribe **sólo** `src/world/Terreno.js`, y en él sólo el reemplazo de
`<normal_fragment_begin>` (y sus comentarios). Del coordinador: los bancos y esta carta.

### El contrato

**B1 · El marco.** En el reemplazo de `<normal_fragment_begin>` la normal sale de
`gNormalDEM`, recibe todo su relieve en el marco del mundo y **pasa al de la cámara una
sola vez**, con la parte de giro de `viewMatrix` (no su traspuesta), después del último
relieve y justo antes de `nonPerturbedNormal`. Ningún otro trozo del shader la pasa por
su cuenta.

**B2 · El giro.** Mirando derecho abajo desde 4 m en el bosque, la estepa, el pedregal y
una ladera de 25°, girar la cámara sobre su eje no cambia el brillo del centro más de un
**2 %**, y la imagen girada de vuelta calza con la del giro 0 a menos de **1,5** niveles de
diferencia media.

**B3 · La vuelta.** El mismo punto llano (menos de 2,5°), visto desde cuatro rumbos a 10 m
bajando 35°, no cambia más de un **20 %**: lo que queda es el brillo especular, que sí
depende de desde dónde se mira (calculado ≲ 15 % con la rugosidad 0,94 del terreno).

**B4 · Lo que se ve.** Con las semillas fijas: mirando al frente (−8°), el brillo de la
franja cercana y de la del medio queda a **±15 %** del de antes; mirando al suelo se
informa. Y la guarda de la fase 3 sigue en pie con la luz derecha: la textura a ±10 % de la
paleta calibrada sola.

**B5 · Sin costo y sin compilar de más.** El terreno no sube más de **0,3 ms** al frente
ni al suelo contra la fase 3 medida en la misma sesión, y una segunda pasada no compila
programas nuevos.

**B6 · Sin regresión.** La ronda 7, las fases 1, 2 y 3, `lint-shader` y `vite build`.

Bancos: `banco-r8-fase3b.mjs` (B1, B4, B6), `banco-r8-fase3b.navegador.js` (B2, B3, B4,
B5), falsador `banco-r8-fase3b.falsar.mjs` (diez arreglos mal hechos y tres controles).

### CERRADA el 19/9/2026

Una línea del agente, dentro de su reemplazo y en su lugar:
`normal = normalize(mat3(viewMatrix) * normal);`. Leída: correcta, y todo el relieve
queda arriba, en el marco del mundo.

**Mitad navegador**, con el programa compilado verificado en la placa (el texto del
shader del terreno trae la línea):

| | resultado | umbral |
|---|---|---|
| B2 · el giro, brillo del centro | bosque 0,1 %, estepa 0,0, pedregal 0,0, ladera 0,0 | ≤ 2 % |
| B2 · la imagen girada de vuelta | ≤ 0,97 niveles (bosque); ≤ 0,47 los demás | ≤ 1,5 |
| B3 · la vuelta, punto llano | bosque 14,4 %, estepa 2,6, pedregal 1,8 | ≤ 20 % |
| B5 · compilar | 24 → 24 | igual |

(Son idénticos, al centésimo, a los de la maqueta del jefe con que se validó el banco.)

**B5 · el costo necesitó tres pares.** El primero, contra la fase 3 en la misma sesión,
dio rojo: al frente 9,7 contra 9,1 ms, al suelo 5,1 contra 4,6. Una matriz por píxel no
cuesta medio milisegundo, así que se alternó dos veces más, recargando:

| par | fase 3, frente · suelo | 3b, frente · suelo | diferencia |
|---|---|---|---|
| 1 | 9,1 · 4,6 | 9,7 · 5,1 | +0,6 · +0,5 |
| 2 | 9,1 · 4,9 | 9,4 · 4,8 | +0,3 · −0,1 |
| 3 | 9,0 · 4,4 | 9,0 · 4,4 | 0,0 · 0,0 |

Mediana de las diferencias: **+0,3 al frente y 0,0 al suelo**, dentro del umbral; lo del
primer par es deriva de la placa entre cargas, que baja a cero en el tercero.

**Banco Node 5/5** (marco, imagen, regresión de diez bancos, lint, `vite build`) y
**falsador 10/10** con 3 controles verdes. La imagen, con las semillas fijas:

| lugar | al frente, cercana · del medio | textura contra la paleta sola | mirando al suelo |
|---|---|---|---|
| bosque | **+13,6 % · +14,2 %** | +3,6 % | +47,7 % |
| estepa | +4,1 % · +1,8 % | −3,1 % | +36,9 % |
| pedregal | +7,4 % · +6,8 % | −7,4 % | +31,6 % |

El agente predijo al frente +4 a +5 % (cayó del lado favorable: el bosque quedó a 1,4
puntos del tope), el pedregal contra la paleta en −8,4 a −8,9 % (salió −7,4, mejor) y
mirando al suelo +31 a +34 % en bosque y estepa y +21 % en el pedregal (salió más).

**Un defecto del banco, encontrado por el agente:** aceptaba `normalMatrix × normal`, y
`normalMatrix` no existe en el fragmento (three la declara sólo en el vértice,
`WebGLProgram.js:666` contra `:828`). Con esa línea el terreno no compilaría y la mitad
Node daba verde. Corregido: la forma dejó de aceptarse y el control pasó a ser el décimo
defecto plantado.

**Y un hallazgo del agente, confirmado midiendo: el terreno no recibe ninguna sombra.**
Es la fase 3c.

**Del agente, una falta a las reglas, dicha por él:** abrió una vez el panel del
navegador para una captura de pantalla, sin tocar nada. No cambió la partida ni se usó
como dato.

**Para que mire el dueño:** el suelo mirando hacia abajo con el sol a la espalda queda
bastante más claro (+32 a +48 %), y de cara al sol, más oscuro: es la luz de verdad. La
antorcha y el fuego también se ven distinto en el piso (su círculo de luz ya no cambia al
girar la cabeza).

---

## FASE 3c · `suelo`, retomado — el terreno no recibe ninguna sombra

### Lo que se midió antes de escribir el contrato

**1 · Lo sospechó el agente `suelo` cerrando la 3b** (pendiente, «Fase 3b», punto 1): la
geometría del terreno lleva el atributo `normal` entero en cero (`_construirMalla`,
`new Float32Array(total * 3).fill(0)`), y three arma con él la corrección de la sombra en
el vértice (`shadowmap_vertex`: `normalize` de un vector cero). En ANGLE sobre D3D11 eso
da NaN, las coordenadas de sombra salen NaN, la prueba de frustum da falso y la sombra
vale 1.

**2 · Confirmado en el juego, restando** (`r8-sombra.navegador.js`, 19/9). Un coihue
invisible para la cámara pero que sigue proyectando sombra, mirado derecho abajo desde
30 m, con su sombra prendida y apagada: **el terreno no se oscurece ni un píxel**. Un plano
de prueba de three puesto 0,6 m sobre el mismo suelo, en el mismo cuadro: **el 40 % del
cuadro se oscurece 81 niveles**. Nadie proyecta sombra sobre el terreno: ni los árboles,
ni las montañas, ni las obras.

**3 · La causa, confirmada y no sólo el síntoma.** Con el atributo `normal` puesto en
(0, 1, 0) —un dato, no recompila: los programas no cambian— el terreno recibe la misma
sombra: el 41 % del cuadro, 58 niveles más oscuro.

**4 · Lo que cuesta, medido en la misma carga** alternando el dato tres veces (sin
recargar, así que sin deriva): al frente 9,3 · 8,9 · 9,1 → **10,0 · 10,0 · 9,8 ms
(+0,9)**; mirando al suelo 4,7 · 4,9 · 5,0 → **5,5 · 5,4 · 5,8 (+0,6)**. Hoy la sombra
sale NaN y el terreno se saltea el filtrado de las cascadas; recibirla lo paga. Es un 3 %
del cuadro en Baja.

**5 · ¿Hay acné con una normal vertical en las laderas?** Era la sospecha del jefe al ver
la resta a 40 m sobre la ladera de 25° con el sol a 14,7°: un moteado con rayas. Se armó
una **verdad de campo sobre el DEM** (`medirAcne`: para 128 × 128 puntos del cuadro, el
punto del suelo, su normal y si el sol lo alcanza marchando 3 km hacia él) y **la sospecha
se refutó**: esa cara entera está tapada por el relieve, y lo oscurecido es sombra de
verdad (el 100 % de lo tapado se ve en sombra). En una ladera de 24° que mira al sol y que
nada tapa, con la normal vertical, **0 de 16.384 puntos al sol se oscurecen**, con el sol a
14,7° y a 31,6°, desde 40 y desde 200 m.

### El contrato

- **S1 · Recibe.** Un coihue invisible que proyecta sombra, junto al arranque: el terreno
  se oscurece en una fracción del cuadro a **±25 %** de la del plano de control, y su
  oscurecimiento medio no baja de **la mitad** del del plano.
- **S2 · Sin acné**, contra el DEM: en la ladera al sol, de los puntos al sol se oscurece
  **el 1 % o menos**, y de los rasantes (N·L entre 0,03 y 0,15), el 5 % o menos.
- **S2b · Las sombras del relieve aparecen**: de lo que el relieve tapa a menos de 150 m,
  **el 90 % o más** se ve en sombra.
- **S3 · Costo**: **≤ +1,2 ms** al frente y al suelo contra la 3b en la misma sesión.
- **S4 · Sin compilar de más**, y el vértice ya no usa una normal en cero (banco Node,
  sección 1, con el terreno construido sobre un mundo de juguete).
- **S5 · Sin regresión**: la ronda 7, las fases 1, 2, 3 y 3b, `lint-shader`, `vite build`.

Validado antes de encargar: la base da 11/15 en el navegador, roja en S1 (0 contra 0,31
del plano) y en S2b (0 de 1763 y 0 de 3852), y 0/1 en el vértice; la maqueta del jefe (la
normal en (0, 1, 0) como dato, en la misma carga) da 15/15 (el terreno 0,297 contra 0,320
del plano). Falsador: 4/4 con 2 controles verdes (las dos formas del arreglo, el dato y el
vértice). Bancos: `banco-r8-fase3c.mjs`, `banco-r8-fase3c.navegador.js`,
`banco-r8-fase3c.falsar.mjs`; instrumentos en `r8-sombra.navegador.js`.

**Propiedad exclusiva:** `src/world/Terreno.js`, y en él sólo la malla (`_construirMalla`,
el atributo `normal`) o la inyección del vértice del material de color. Nada de
`Calidad.js`: si hiciera falta apagarlo en Baja, lo decide el jefe con el dueño.

La decisión de pagarlo es del jefe por medición (3 % del cuadro en Baja por que los
árboles, las obras y el relieve den sombra en el suelo); si al dueño le pesa, se apaga
por preset.

### CERRADA el 19/9/2026

El agente arregló **el dato**, no el vértice: el atributo `normal` de la malla vale
(0, 1, 0) en los 1221 vértices (tablero y falda). El programa no cambia, no hay nada nuevo
que compilar, y es exactamente la maqueta con que se validó el banco. Eligió la vertical
y no la normal del DEM con la cuenta: la vertical da cos θ de la protección contra el
acné (0,91 a 25°) y la del DEM costaría una lectura de textura por vértice, para un
margen que ya medía 0 de 16.384.

**Mitad navegador 17/17**, con la base medida **en la misma carga** (el dato en cero, que
es la 3b), sin deriva posible:

| | resultado | umbral |
|---|---|---|
| S1 · recibe | terreno 0,326 del cuadro contra 0,344 del plano; 59 contra 79,6 niveles | ±25 %; ≥ la mitad |
| S2 · acné | 0 de 16.384 (sol 14,7°, 40 m), 0 de 16.044 (200 m), 0 de 16.384 (sol 31,6°); rasantes 0 de 101 | ≤ 1 %; ≤ 5 % |
| S2b · el relieve | 100 % de 1763 (40 m), 94,2 % de 3852 (200 m) | ≥ 90 % |
| S3 · costo | frente 9,1 · 9,4 → **10,2 ms (+0,95)**; suelo 4,7 · 5,1 → **5,5 (+0,6)** | ≤ +1,2 |
| S4 · compilar | 28 → 28 | igual |

El agente, escarmentado por la 3b, no predijo con su modelo sino con lo que midió la
maqueta, y acertó.

**A la vista** (`r8-f3c-antes.png` y `r8-f3c-despues.png`, el mismo cuadro con el dato en
cero y arreglado): la sombra del coihue cae ahora sobre el suelo; antes el piso quedaba
al sol debajo del árbol. En la sombra queda el **11 %** de la luz del sol (en lineal, sobre
la imagen ya con la curva tonal), que es el rango de la luz del cielo sola un día
despejado (10 a 20 %): se ve muy oscura, pero es así.

**Anotado por el agente, sin tocar:** en Baja y en Mínima el terreno **no proyecta**
(`Calidad.js`, `terrenoProyecta: false`, 7,7 ms), así que en Baja el suelo recibe la sombra
de los árboles y las obras pero **no la de los cerros**; S2b pasa porque el instrumento
prende la proyección mientras mide. Y en Baja las sombras lejanas salen blandas (mapa de
512 para 240 m). Las dos son decisiones de preset que antes no se notaban.

**Para que mire el dueño:** los árboles y las obras ahora dan sombra en el suelo; cuesta
casi 1 ms (3 % del cuadro en Baja) y se puede apagar en ese preset si pesa. La sombra es
oscura de verdad. Y en el andisol de cerca, los puntitos claros de pómez se ven mucho al
sol (`r8-f3c-antes.png`): si le parecen ruido, es un ajuste del horno de la fase 3.

---

## FASE 4 · `copa` — árboles y follaje (medición de apertura, sin contrato todavía)

Medido el 18/9/2026, mientras corría la fase 2, para no abrirla a ciegas.

**1 · La hipótesis del alfa en los mipmaps no se sostiene para las latifoliadas.**
Armando en el navegador la cadena de mipmaps del atlas real con el mismo promedio de
2×2 que la GPU, y contando qué fracción pasa el corte de `alphaTest: 0.28` en la
ventana de las tarjetas (u < 0,86):

| lado del nivel | 512 | 256 | 128 | 64 | 32 | 16 | 8 |
|---|---|---|---|---|---|---|---|
| **lámina** | 0,219 | 0,229 | 0,248 | 0,280 | 0,307 | 0,250 | 0,271 |
| **aguja** | **0,081** | 0,090 | 0,102 | 0,113 | 0,089 | **0,038** | **0** |

La lámina no pierde cobertura con la distancia. **La aguja arranca en el 8 %**: el
problema de las coníferas no es el mipmap, es el dibujo.

**2 · Los atlas** (`capturas/r8-atlas-lamina.png`, `r8-atlas-aguja.png`): la lámina
son elipses planas de un solo color, del petróleo al menta casi blanco, sueltas y con
mucho vacío; la aguja son ramitas de pino de 2 px. **Y el ciprés de la cordillera y el
alerce no tienen agujas**: tienen ramitas aplanadas de hojas escamosas. Hoy usan el
mismo atlas que el pino murrayana (`claseHojaDe`: todo lo `columnar` es `aguja`).

**3 · El árbol entero, restando.** Render directo (sin posproceso: sirve para la máscara,
no para el color) a 18 m de cada árbol, con su lote prendido y apagado:

| especie | cobertura del recuadro | puntitos sueltos (≤ 6 px) por mil píxeles |
|---|---|---|
| coihue | 0,323 | 3,75 |
| ñire | 0,171 | 5,28 |
| maitén | 0,132 | 3,73 |
| **ciprés de la cordillera** | **0,088** | **10,73** |
| **pino murrayana** | **0,053** | **17,73** |

Medido otra vez esa noche con el banco (`banco-r8-fase4.navegador.js`, lienzo fijo de
819×614): ciprés 0,127 y 10,97 · pino 0,079 y 21,63 · coihue 0,342 y 2,59 · maitén 0,203 y
4,31 · ñire 0,147 y 3,85. **No repite exacto porque `Vegetacion` arma cada árbol con
`Math.random()` en la carga**: cada sesión tiene árboles distintos. Los umbrales del
contrato quedan lejos de las dos mediciones.

`capturas/r8-base-arbol-*.png`. El ciprés se ve como un esqueleto con agujas sueltas;
el coihue, como un palo con hojas de caricatura: elipses enormes y ramas desnudas.

**4 · Las hojas miden diez veces lo que miden.** Las tarjetas de follaje de una copa
ancha miden `0,105 × alturaRef` de semilado (`Vegetacion.js:1680`), por un azar de 0,62 a
1,42: para el coihue (alturaRef 35 m), de 4,6 a 10,4 m de ancho. La ventana del atlas
que se estira encima son 154 a 225 px de los 512, o sea unos **25 px por metro**. Y la
hoja del atlas mide de 6 a 21 px de largo (`dibujarLaminas`, radios de 3 a 10,5 px):
**en el mundo, hojas de 24 a 84 cm**. El coihue real tiene hojas de 2 a 3,5 cm. Es la
«hoja de caricatura» de la captura, en números: diez a veinte veces.

**5 · El costo de base de los árboles**, alternado en la misma sesión que el resto:
`bancoDesglose` en el arranque, Baja, 1024×576, al frente: **2,3 ms** (dos corridas
después del calentamiento; la primera dio −1,3 y se descarta).

### Propiedad exclusiva de archivos

El agente escribe **sólo**:

- `tools/hornear-follaje.mjs` — **nuevo**: el horno de follaje, en Node, determinista
- `public/tex/follaje/` — **nuevo**: los atlas y su `manifiesto.json`
- `src/world/Vegetacion.js` — el follaje, las clases de hoja, el tamaño de las
  tarjetas y lo que haga falta para usar los atlas horneados

Del coordinador: `src/main.js`, los bancos y esta carta.

### El contrato

**C1 · Cuatro clases de follaje, horneadas.** `node tools/hornear-follaje.mjs` escribe
en `public/tex/follaje/` un atlas por clase —al menos `nothofagus` (coihue, lenga,
ñire: hoja chica, aserrada, en ramitas), `ancha` (maitén, canelo, laurel y el resto de
las latifoliadas: hoja elíptica más grande), `escama` (ciprés de la cordillera, alerce:
ramitas aplanadas de hojas escamosas) y `aguja` (los pinos: fascículos de acículas)—,
cada uno cuadrado de 512 o 1024, RGBA, con un `manifiesto.json` que diga por clase
`referencia` (qué hoja y de dónde sale el dato), `hojaCm` (el largo real, [mín, máx]),
`hojaPx` (lo que mide en el atlas), `pxPorMetro` (a qué escala se estira sobre la
tarjeta) y `uMax` (la ventana de las tarjetas). Determinista: dos corridas, los mismos
bytes.

**C2 · Cada especie con su hoja.** `Vegetacion.js` exporta `claseHojaDe(esp)`, y da
`nothofagus` para el coihue, la lenga y el ñire; `escama` para el ciprés y el alerce;
`aguja` para el pino murrayana; `ancha` para el maitén, el canelo y el laurel.

**C3 · La hoja de su tamaño.** Con los números del manifiesto, `hojaPx / pxPorMetro` cae
a menos de **3 veces** el largo real de la hoja (hoy, 10 a 20 veces), y las tarjetas se
dimensionan con `pxPorMetro` (el banco lo lee en el código).

**C4 · Las coníferas dejan de ser esqueletos.** La cobertura de alfa del atlas, en su
ventana, es de **0,18 o más** en las cuatro clases (la aguja de hoy, 0,081), y la de cada
nivel de mipmap que usa el juego queda a ±30 % de la del nivel 0 hasta los 32 px. En el
juego, con el instrumento rehecho (tres árboles por especie, cada uno solo, clima fijo)
y la base de **cinco cargas** (reescrito el 19/9, antes de encargar; ver abajo):

| especie | relleno de la silueta, base | umbral | puntitos por mil, base | umbral |
|---|---|---|---|---|
| ciprés | 0,380 (0,352–0,439) | **≥ 0,50** | 5,35 | **≤ 3,4** |
| pino | 0,386 (0,327–0,449) | **≥ 0,50** | 9,41 | **≤ 3,4** |
| coihue | 0,550 (0,526–0,567) | ≥ 0,506 | 0,67 (0,49–0,89) | ≤ 1,39 |
| ñire | 0,533 (0,504–0,564) | ≥ 0,484 | 1,68 (1,37–2,05) | ≤ 2,55 |
| maitén | 0,564 (0,501–0,616) | ≥ 0,481 | 1,58 (1,48–1,70) | ≤ 2,20 |

La regla, en una frase: **las coníferas, tan llenas como la carga más rala de una
latifoliada (0,501), y con no más puntitos que el doble de la peor latifoliada (ñire,
1,68 → 3,4)**; las latifoliadas no bajan de su mínimo medido (menos 0,02) ni suben más de
medio puntito sobre su máximo. Validado contra la base: 4/8, rojo en las cuatro de las
coníferas y verde en las guardas y en la compilación. La cobertura del recuadro de la
versión anterior de C4 se dejó de usar: castiga la forma y no los huecos.

*La guarda de los mipmaps es simétrica a propósito: medida sobre el atlas de hoy, la
lámina **sube** de 0,241 a 0,348 a 32 px (+44 %). Una copa que se espesa de lejos cambia
de aspecto igual que una que se ralea.*

**C5 · Sin costar más.** Los árboles, con `bancoDesglose` alternado con la base en la
misma sesión, no suben más de un **15 %**. Poner un árbol en pantalla no compila nada
nuevo (los atlas llegan por el valor del uniforme o están en la carga).

**C6 · Sin regresión.** La ronda 7 y las fases 1 a 3 (con la 3b y la 3c), y `vite build`
limpio.

**C7 · El mismo árbol en cada carga** (agregado el 19/9). `Vegetacion.js` exporta
`construirPlanta` (o `modeloDe`), y armar el modelo de una especie dos veces —con
`Math.random` movido entre medio— da la misma geometría byte a byte; cada especie, la
suya. Banco Node, sección 6, validada: la base da rojo (no la exporta), una maqueta que
la exporta con `Math.random` da rojo (las dos llamadas difieren) y una con semilla por
especie da verde. El banco precalienta las cinco especies antes de comparar, porque la
primera de cada clase arma además el atlas de hojas.

**Pendiente del jefe antes de abrirla (anotado el 19/9, cerrando la fase 3).** Los
números de C4 en el juego se midieron en UNA carga, y dos cosas cambian de carga a carga:
el clima (dos semillas al azar en `Tiempo`: la misma vista cambió un 25 % de brillo, y el
umbral de la resta, 24, depende del brillo) y los árboles mismos (`Vegetacion` siembra
con `Math.random`: el árbol «más cercano» es otro). Antes de encargar: la mitad navegador
fija las semillas y vacía los eventos como la T3 de la fase 3, promedia varios árboles
por especie en vez de uno, y la base se vuelve a medir así, en la misma sesión que el
arreglo. Si con eso la base cambia, los umbrales de C4 se reescriben con la misma
proporción antes de encargar, no después.

*Hecho en el banco el 19/9:* la mitad navegador mide ahora tres árboles por especie,
cada uno **solo** (su instancia sola en el lote, las otras especies y los impostores
apagados, sin su sombra: la sombra en el suelo también cambia al restar y contaba como
copa, y los vecinos de la misma especie agrandaban el recuadro), con el clima fijo. Las
posiciones de los árboles son deterministas (semilla por celda); **el modelo de cada
especie no**: `construirPlanta` usa `Math.random` al cargar. La base se promedia sobre
varias cargas, y el contrato suma **C7 · el modelo de cada especie sale de una semilla
propia** (derivada de su id): dos cargas, el mismo árbol, para que el banco mida el
cambio y no la suerte de la carga.

*Primeras dos cargas con el instrumento nuevo (19/9, base):*

| especie | cobertura del recuadro | relleno de la silueta | puntitos por mil |
|---|---|---|---|
| ciprés | 0,280 · 0,251 | — · 0,33 | 6,6 · 8,1 |
| pino | 0,238 · 0,178 | — · 0,25 | 11,9 · 17,7 |
| coihue | 0,356 · 0,336 | — · 0,52 | 0,8 · 0,9 |
| ñire | 0,340 · 0,364 | — · 0,56 | 1,4 · 1,1 |
| maitén | 0,353 · 0,365 | — · 0,55 | 1,5 · 1,1 |

Dos cosas cambian el contrato C4. **Una:** medidos solos, el ciprés y el pino ya pasan
los umbrales de cobertura (0,20 y 0,12): los 0,088 y 0,053 de la apertura eran en buena
parte el instrumento —vecinos de la misma especie que agrandaban el recuadro, y la
sombra—. Pero **las imágenes siguen mostrando esqueletos** de palitos con el cielo
atravesándolos (`r8-f4-base1-arbol-*.png`): el problema es real y la medida era la
equivocada. La cobertura del recuadro castiga la forma (un cono macizo llena la mitad
de su recuadro); lo que se ve como esqueleto son los huecos, y eso lo mide el **relleno:
píxeles del árbol sobre el área de su envolvente convexa**. Las latifoliadas dan 0,52 a
0,56; el ciprés 0,33 y el pino 0,25. **Dos:** de una carga a otra el pino pasó de 0,238 a
0,178 y sus puntitos de 11,9 a 17,7: con modelos al azar, un umbral mide la suerte. C4 se
reescribe al abrir la fase sobre el relleno, con la base promediada en cinco cargas, y
C7 va primero.

---

## FASE 5 · `piedra` — trabajar la piedra paso a paso (medición de apertura)

Medido el 18/9/2026 sobre los datos (`herramientas.json`, `historia.json`).

**1 · El primer hacha, hoy.** Expandida la receta hasta lo crudo:

```
hacha_piedra [tec hacha_pulida] = 2 piedra, 1 mango, 4 tiento
  mango_labrado [tec lasca_obsidiana] = 2 madera, 1 cordel
    cordel_fibra = 3 fibra
  tiento_cuero = 1 cuero
crudo: 2 piedra · 2 madera · 3 fibra · 1 cuero
```

y las tecnologías: `hacha_pulida` (16 de saber, 3 piedras, 2 cordeles) pide
`lasca_obsidiana` (8 de saber, **2 obsidianas**, 1 piedra). La obsidiana sale en el 28 %
de las piedras **por encima de los 1500 m** (ronda 7), y el arranque está a 822. Y el
tiento sale del cuero, o sea de **cazar**. El primer hacha pide subir 700 m y cazar, y
no tiene un solo paso de pulido: «pulida» está en el nombre y en ningún lado más.

**2 · El único martillo es de hierro** (`martillo`, nivel 4, en la fragua). No hay
percutor, ni maza de piedra enmangada. `maza_cuna` (nivel 3) pide asta y la tecnología
de cantería.

**3 · Lo que ya existe y sirve de base**: `lasca_rodado` (2 piedras, pide
`lasca_obsidiana`), `boleadora` (la bola se hace por picado y pulido, una técnica real
de la estepa), la arena a puñados (ronda 7) y el agua con recipiente (ronda 7).

**4 · La lasca de rodado no se puede hacer al arrancar** (medido en el juego el 19/9,
`fabricacion.estado`). Su propia nota dice que «se hace con dos piedras del suelo en el
primer minuto de juego» y su `porQueExiste`, que existe para que el arranque no sea una
caminata de 30 a 37 minutos hasta la obsidiana. Pero pide la tecnología
`lasca_obsidiana`, que cuesta **2 obsidianas** (por encima de 1500 m) y 8 de saber, con el
saber en 0 al arrancar. Así desde que el árbol se escribió (`38c69e4`, 7/9). Al arrancar,
lo único que se fabrica sin tecnología es cordel, garrote, antorcha, anzuelo de hueso,
tiento, honda, trampa de lazo, línea de mano y caña: **ninguna herramienta de piedra**. El
paso a paso que pidió el dueño tiene que empezar, entonces, un paso antes de lo que decía
la carta: con la primera lasca.

El contrato sale de acá cuando se abra la fase, con el pedido del dueño a la vista:
*«trabajar piedra para después hacer un hacha, un martillo, etc.»* y *«enfocarse en la
primera hora real de vida»*.

**5 · Fuentes para el paso a paso** (buscadas el 19/9). Salas, A. M. (1942), «Hachas de
piedra pulida y enmangadas del territorio del Neuquén», *Relaciones de la Sociedad
Argentina de Antropología* 3: 67-72 (dos hachas pulidas **con su mango**, de una mina de
sal cerca de Chos Malal; lo pulido es raro en Patagonia). Fenton, M. B. (1984), «The
nature of the source and the manufacture of Scottish battle-axes and axe-hammers»,
*Proceedings of the Prehistoric Society* 50: 217-243, experimental: el desbaste por
lascado lleva minutos, el **picado 3 a 5 horas**, el **desgaste 1 a 3** y el **pulido
3**. El pulido se hace frotando contra una laja o una roca fija con arena y agua.

**6 · El saber de la primera hora** (medido en el juego el 19/9, desde el arranque, 822
m). El saber se gana descubriendo lugares (3 por lugar), levantando obras (3 o 4),
aprovechando restos (1), el permiso de pesca (5) y los fenómenos (2 o más). El lugar
descubrible más cercano es la **Isla Huemul, a 1,4 km y en el agua**; el primero en
tierra, el **Cerro Campanario, a 2,2 km**; el tercero, la Laguna El Trébol, a 4,8 km.
La talla de obsidiana pide 8: tres lugares. Una tecnología que abra la cadena de la
piedra tiene que costar lo que da la primera hora, o no pedir saber.

**7 · La primera hora, en el mapa** (medido en el juego el 19/9). El jugador arranca sin
nada. Alrededor del arranque hay piedra suelta, fibra y leña; el banco de arena más cercano
está a **500 m** (x 7235, z −1145, 767 m, en la Reserva: la arena no se junta en el Parque).
Con la cadena de abajo, todo lo del primer hacha se junta a menos de 1 km.

**8 · Lo que hoy se fabrica, congelado** (`r8-fabricables.mjs`, con un bolso lleno de todo):
sin ninguna tecnología, 9 objetos; con todas, 48. Es la base de «nadie queda peor».

### El contrato (19/9; reemplaza al borrador de abajo)

- **P1 · El percutor.** Objeto `percutor`, nivel 0, sin tecnología, una piedra, herramienta
  que se lleva.
- **P2 · La primera lasca sin obsidiana.** `lasca_rodado` sin tecnología, **una** piedra, y
  pide el percutor.
- **P3 · La preforma.** Una receta produce el recurso `preforma` con dos piedras, y pide el
  percutor (desbaste y picado).
- **P4 · El pulido.** Una receta produce el recurso `hoja_hacha` con la preforma y arena (y
  agua, si el agente lo justifica).
- **P5 · El mango sin obsidiana.** `mango_labrado` sin la tecnología de la obsidiana, y pide
  algo que corte: cualquier lasca o el cuchillo (`Fabricacion` acepta una lista).
- **P6 · El hacha.** `hacha_piedra` con la hoja, el mango y **cordel** (sin tiento ni cuero).
  Si pide una tecnología, ésta no pide obsidiana y cuesta **3 de saber o menos** (lo que da
  el primer lugar descubierto).
- **P7 · El martillo de piedra**, de la misma cadena (un canto con garganta picada, mango y
  cordel), con **un uso real**: al menos una receta lo pide, con su fuente, y se puede hacer
  en la primera semana sin obsidiana (partir un tronco con cuñas, quebrar hueso para la
  médula: lo elige el agente y lo justifica).
- **P8 · La primera hora, simulada.** Desde un bolso vacío, con sólo piedra, fibra, madera
  y arena, y 3 de saber, el banco recorre la cadena con `Fabricacion` y `Saberes` de verdad
  y termina con el hacha. **Sin obsidiana, sin cuero, sin cazar.**
- **P9 · Nadie queda peor.** Los 9 objetos que hoy se fabrican sin saber y los 48 con todo
  (bolso lleno) se siguen fabricando.
- **P10 · Iconos y nombres** para cada objeto y recurso nuevo (el banco de la ronda 6,
  fase 3, verde; nombre y peso en `Recursos.js`).
- **P11 · Las notas.** Cada objeto nuevo o cambiado dice qué es y cómo se hacía, con su
  fuente: Salas 1942 para el hacha enmangada del Neuquén, Fenton 1984 para los tiempos del
  picado y el pulido, y la que corresponda al martillo.
- **P12 · Sin regresión**, y `vite build`.

**Propiedad exclusiva:** `src/data/herramientas.json`; `src/data/historia.json` (sólo las
tecnologías de la cadena); `src/systems/Fabricacion.js` (sólo para que pida herramienta de
una lista); `src/systems/Recursos.js` (los recursos nuevos); `src/ui/Iconos.js` (los iconos
nuevos). Nada de `main.js`.

### Borrador del contrato (19/9, mientras corre la 3b; se ajusta al abrir)

La cadena, toda sin obsidiana y sin cazar, cada paso con su nota y su fuente:

1. **El percutor** (nivel 0, sin tecnología): un rodado del tamaño de la mano, elegido
   de una piedra. Es herramienta: lo piden los pasos que siguen (`pideHerramienta`).
2. **La primera lasca**: `lasca_rodado` deja de pedir `lasca_obsidiana` y pide el
   percutor; cuesta **una** piedra (la segunda de hoy *era* el percutor). Con esto el
   `porQueExiste` que ya tiene se vuelve cierto.
3. **La preforma**: desbastar y **picar** un canto alargado con el percutor → recurso
   `preforma` (dos piedras: el canto y lo que se va).
4. **El pulido**: la preforma frotada con **arena y agua** (los dos existen desde la
   ronda 7) → recurso `hoja_hacha`.
5. **El mango**: `mango_labrado` deja de pedir obsidiana; pide algo que corte (cualquier
   lasca o cuchillo: hace falta que `Fabricacion` acepte «algo que haga X» y no un id
   solo).
6. **El hacha**: `hacha_piedra` = hoja + mango + **cordel** (el tiento pide cuero, o sea
   cazar; el cordel sale de fibra). La nota dice que el tiento mojado encoge y ata mejor.
7. **El martillo de piedra**: un canto con garganta picada, enmangado; con un **uso
   real** en la primera semana (a decidir al abrir, midiendo qué pide hoy el juego: partir
   hueso para la médula —grasa, documentado en la región— o clavar las estacas de un
   refugio).
8. **La tecnología `hacha_pulida`** deja de pedir `lasca_obsidiana`, o se reemplaza por
   una de talla y pulido que se pueda aprender con el saber de la primera hora (medir
   antes cuánto saber junta el arranque).
9. **Iconos** para cada objeto y recurso nuevo (regla de la ronda 7), y el banco de la
   ronda 6, fase 3, verde.

Guardas: al arrancar, con piedras, fibra, madera, arena y agua a mano, el primer hacha
sale **sin subir de 1000 m y sin cazar**; y **ninguno de los 57 objetos de hoy queda
peor** (lo que hoy se fabrica se sigue fabricando).

---

## FASE 6 · `luz` — la luna con la ley de Allen (y el fuego, que ya cambió)

### Lo que se midió (19/9, con la 3b y la 3c ya cerradas)

**1 · El suelo naranja junto al fuego ya no es el que vio el dueño.** Con el instrumento de
la ronda 7 (`banco-r7-fase2.navegador.js`: cámara cenital, anillos alrededor de una
fogata de noche, la noche sin luz restada), el mismo día y la misma sesión, con el
`Terreno.js` de antes de la 3b y con el de ahora:

| distancia | antes de la 3b | ahora |
|---|---|---|
| 1 m | 35,5 | 62,8 · 67,3 |
| 2 m | 44,3 | 44,6 · 48,2 |
| 3 m | 43,0 | 27,6 · 30,1 |
| 5 m | 40,1 | **14,9 · 16,4** |
| 8 m | 21,4 | 4,4 · 5,3 |

Con la normal en el marco equivocado, una luz a 0,6 m del piso pegaba de frente sobre medio
anillo, y el piso era un disco naranja parejo de unos 8 m (`r8-f6-fogata-noche-antes-3b.png`).
Con la luz derecha, el resplandor se concentra junto al fuego y cae como tiene que caer una
luz baja sobre suelo llano (`r8-f6-fogata-noche-ahora.png`); el pasto, que es vertical y mira
a la llama, sigue naranja. **A 5 m el piso bajó un 60 %: más que el «un poco» que pidió el
dueño.** Decisión del jefe: **no se baja nada más** hasta que el dueño lo mire; y los umbrales
de la ronda 7 (≥ 30 a 3 m, ≥ 8 a 8 m), calibrados con el defecto, quedan viejos (hoy 30,1 y
5,3).

**2 · La luna alumbra según la fracción iluminada, no según su brillo.** `Cielo.js` suma la
luz de la noche con `max(0, altura) × uFaseLunar` (la fracción iluminada k) en el ambiente
(`0,045 + 0,09·luna`), en la niebla (`0,020 + 0,045·luna`), en el halo y en cuánto apaga las
estrellas. Medido en Node sobre dos meses (febrero y marzo de 2025, de 2 a 8 UTC, con el sol a
más de 20° bajo el horizonte y la luna a más de 17° de altura): el exceso de luz ambiente
sobre una noche sin luna, dividido por el seno de la altura de la luna y por el de la llena,
sigue **exactamente k**:

| ángulo de fase | hoy (medido) | k | Allen |
|---|---|---|---|
| 6° | 1,009 | 0,997 | 0,871 |
| 53° | 0,812 | 0,803 | 0,275 |
| 96° (cuarto) | 0,453 | 0,447 | **0,073** |
| 112° | 0,313 | 0,309 | 0,038 |

La ley de Allen (*Astrophysical Quantities*): la magnitud crece 0,026·α + 4·10⁻⁹·α⁴ con el
ángulo de fase α en grados, o sea brillo relativo 10^(−0,4·(0,026α + 4·10⁻⁹α⁴)). La luna en
cuarto brilla un 9 % de la llena, no un 50 %: la mitad del disco está iluminada, pero de
costado, con las sombras largas del relieve. El dueño eligió **«Ley real (Allen)»**.

### El contrato

- **A1 · La ley, exportada.** `Cielo.js` exporta `brilloLunar(alfaGrados)` = 10^(−0,4·(0,026α
  + 4·10⁻⁹α⁴)): 1 a 0°, 0,091 a 90° y 0,0116 a 135° (±2 %).
- **A2 · La luz de la noche la sigue**, medido como arriba (dos meses, las mismas horas y los
  mismos filtros): el exceso normalizado de cada noche queda a ±15 % de Allen(α) relativo a
  la llena (o a ±0,02 donde Allen es menor que 0,13), en el **ambiente** y en la **niebla**.
- **A3 · La llena y la noche sin luna no cambian**: el exceso por seno de altura de las noches
  con α < 6° a ±10 % del de hoy (0,0889), y el ambiente sin luna a ±2 % (0,0459).
- **A4 · El disco sigue mostrando la fracción** (el terminador sigue con `uFaseLunar`, que
  sigue siendo la fracción iluminada: el banco del cielo de la ronda 7 lo fija contra JPL
  Horizons); el halo y lo que la luna apaga las estrellas siguen el brillo, no la fracción.
- **A5 · Sin compilar de más** (el brillo llega por un uniforme, no por un `#define`), y sin
  regresión: la ronda 7 (el banco del cielo, fase 6, sigue en 7/7), las fases 1 a 4.

**Propiedad exclusiva:** `src/world/Cielo.js`. Nada más.

---

## FASE 7 · `reglas` — las decisiones del dueño y las deudas anotadas

### Lo que se midió

- **La muerte, hoy** (`Partida.registrarMuerte`, `Partida.js:101`): vacía el bolso
  —herramientas incluidas, y la pantalla de fin las nombra— y **deja las cuatro
  ranuras**. La llama encendida sigue encendida. El dueño eligió **«se pierde todo»**.
- **La lana, hoy**: 2 de cada 3 coirones (`Recoleccion.js:83-99`, licencia
  `lanaDelCoiron`); el poncho cuesta 17,7 apretadas en la mediana de 61 puntos (ronda
  7). El dueño eligió **bajarla**; el jefe, **1 de cada 4**: con la cuenta de la ronda 7,
  17,7 × (2/3) / (1/4) ≈ 47 apretadas.
- **La recolección en el Parque** es ilegal en la vida real (Ley 22.351, art. 5) y el
  juego la permite sin decirlo. El dueño eligió **licencia dicha**.
- **La trampa de la fragua** (`Fabricacion.estacion`, `:62-72`): pregunta por **un solo**
  horno, el más cercano, y recién después si es el que hace falta. Con una fogata más
  cerca que la fragua, las recetas de fragua dicen «hace falta estar al lado de:
  Fragua» teniéndola al lado. Es el mismo defecto que la ronda 7 le arregló al telar
  con `_estacionDeObra`, y también le pasa a `'fogata'` cuando lo más cercano es el
  telar o un horno apagado.
- **El radio de 8 m, dos veces**: `RADIO_ESTACION_M` (`Fabricacion.js:38`) y
  `RADIO_HORNO_M` (`Fundicion.js:37`).
- **«115»** en nueve comentarios de `Iconos.js` y `Bolso.js`: desde la ronda 7 los
  dibujos son más.
- **`efectosAAgregar`** (`herramientas.json`): diez entradas que dicen «hoy tiene efecto
  null» y cosas que ya no son ciertas. *Recontado el 19/9 contra `historia.json`:* **las diez
  ya están aplicadas** (a ninguna le falta nada de lo que pide). La lista entera es vieja.
- **La cestería suma dos veces** (encontrado recontando la lista, 19/9). La nota del canasto
  dice que el bono de la tecnología «pasa al objeto: ahora hay que hacer el canasto», pero
  `historia.json` le sigue dando `capacidadExtraKg: 6` a la tecnología, y `main.js:496` suma
  las dos: aprender la cestería da **+6 kg sin tejer nada**, y ponerse el canasto, **+6 más**
  (38 → 50 kg).

### El contrato (se escribe entero al abrir la fase)

**G1 · Se pierde todo.** Morir vacía el bolso **y las cuatro ranuras**, apaga la llama,
y la pantalla de fin nombra lo que estaba puesto. Las trampas puestas quedan donde están
(no son del bolso). El guardado viejo entra igual.

**G2 · La lana, 1 de cada 4**, con el criterio reescrito y la cuenta del poncho medida
otra vez en el juego (≈ 47 apretadas, ±15 %).

**G3 · La licencia de recolección, dicha**: declarada en `licenciasDeJuego` con la ley y
el artículo, en el códice, y **una vez** en el cartel la primera vez que se junta algo
dentro del Parque.

**G4 · Las deudas**: la estación se busca entre todas las que están a mano (fragua y
fogata, como el telar); un solo radio; el número de dibujos dicho bien donde se dice; y
`efectosAAgregar` al día, recontado desde `src/`: lo aplicado sale de la lista (o pasa a una
de aplicados, con la fecha), y ninguna nota dice algo que hoy no es cierto.

**G5 · La cestería suma una vez** (agregado el 19/9): el bono de capacidad lo da el canasto
puesto, no la tecnología. Aprender la cestería sin canasto deja el bolso en 38 kg; con el
canasto puesto, 44.

**Cómo lo mide el banco** (escrito el 19/9, antes de encargar; `banco-r8-fase7.mjs`):

- G1, en Node con `Partida`, `Inventario` y `Equipo` de verdad: con el bolso lleno, las
  cuatro ranuras ocupadas y una antorcha encendida, `registrarMuerte()` deja el bolso vacío,
  **las cuatro ranuras vacías y la llama apagada**; `ultimaMuerte.perdido` nombra lo que
  estaba puesto; las trampas puestas siguen; y un guardado de antes del cambio carga.
- G2, con `Recoleccion` y un coirón de juguete junto al jugador, 4000 apretadas con el azar
  sembrado: la lana sale en el **25 % ± 2** de las apretadas; y la cuenta del poncho (9 de
  hilado, a 3 por cada 4 lanas: 12 lanas) da **47 ± 15 %** apretadas.
- G3: `licenciasDeJuego` tiene la de la recolección, con «22.351» y «art. 5»; la pestaña
  Normativa del códice muestra las licencias de juego (hoy no muestra ninguna); y con
  `Recoleccion` en jurisdicción de Parque, la primera apretada dice la licencia y la segunda
  no; en la Reserva, ninguna la dice.
- G4: con una fogata encendida a 2 m y una fragua encendida a 6 m, una receta de fragua dice
  que está lista; con el telar a 1 m y la fogata a 5, una de fogata también; `Fabricacion.js`
  no declara su propio radio (lo importa de `Fundicion.js`); ni `Iconos.js` ni `Bolso.js`
  dicen «115», y donde dicen un número de dibujos es el que hay; y en `efectosAAgregar` no
  queda ninguna entrada ya aplicada en `historia.json`.
- G5: con `Saberes` y `Equipo`: la cestería aprendida sin canasto no suma capacidad; el
  canasto puesto suma 6.

**Propiedad exclusiva:** `src/systems/Partida.js`, `src/systems/Recoleccion.js`,
`src/systems/Fabricacion.js` (sólo la estación y el radio), `src/systems/Fundicion.js` (sólo
exportar el radio), `src/ui/Codice.js` (sólo la pestaña Normativa), `src/ui/Iconos.js` y
`src/ui/Bolso.js` (sólo los comentarios del número), `src/data/herramientas.json` (la
licencia y `efectosAAgregar`), `src/data/historia.json` (sólo la cestería). Si hace falta
cablear algo en `main.js` (los límites para `Recoleccion`, las licencias para el códice), lo
pide en su pendiente y lo hace el jefe.
