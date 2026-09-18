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
- `src/systems/Hallazgos.js` — **sólo** dibujar las trampas y su renglón de leyenda
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
