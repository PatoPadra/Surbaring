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

`capturas/r8-base-arbol-*.png`. El ciprés se ve como un esqueleto con agujas sueltas;
el coihue, como un palo con hojas de caricatura: elipses enormes y ramas desnudas.
