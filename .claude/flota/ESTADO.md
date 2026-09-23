# ESTADO DE LA FLOTA — leer esto primero

## Ronda 8 · ABIERTA el 18/9/2026 · rama `mejoras/ronda8-lo-que-vio`

El dueño jugó la ronda 7 y trajo cinco notas. **Se fue a Chile el 18/9 y vuelve el
lunes 21 a la noche**: pidió que la ronda siga sin él, con más peso en los
gráficos. Antes de irse contestó todas las decisiones pendientes, esta vez como
preguntas con opciones. La carta, con las respuestas y lo medido, está en
`RONDA8.md`.

Medido antes de encargar nada: **la trampa de lazo no se puede poner** (`pasiva`
no lo lee nadie, y la nasa y la red tienen el mismo problema), **la flecha del
mapa apunta a 180° justos**, el zoom termina en 8 m/px, el minimapa no existe, y
**la brújula de arriba nunca estuvo centrada**: le falta `position` desde el
prototipo. El hacha de piedra sale de un solo paso, y el único martillo es de
hierro.

Siete fases: `rumbo`, `lazo`, `suelo`, `copa`, `piedra`, `luz`, `reglas`. Más la
propuesta escrita del primer año, sin código.

**La «otra cosa» de gráficos que marcó el dueño no llegó escrita: preguntarle a la
vuelta.**

> **18/9/2026 — FASE 1 (`rumbo`) CERRADA** (`f9d8746`). Banco 7/7, falsador 16/16 con
> 3 controles verdes, navegador 29/29. La flecha apunta bien en el mapa y el minimapa
> (una sola función), la brújula está centrada (y los fenómenos bajaron para no
> taparla), el zoom llega a 2 m/px sin dibujar la grilla del DEM, el mapa abre centrado
> en el jugador, y hay minimapa: 900 m, velo como el mapa, 0,007 ms por cuadro. Dos
> defectos del banco, encontrados por el agente; los dos, míos.
>
> **Fase 2 (`lazo`)**: contrato, banco, falsador y mitad navegador escritos antes del
> agente y validados contra una maqueta del jefe que no se le da (21/21 del falsador).
> Tres defectos del banco encontrados así, antes de que el agente escribiera una línea.
>
> **18/9/2026 — FASE 2 (`lazo`) CERRADA** (`187919f`). Banco 10/10, falsador 21/21
> con 3 controles verdes, navegador 10/10. La trampa se pone, trabaja sola por hora
> del mundo, queda marcada en el mapa y el minimapa, y poner no compila nada. En el
> mundo real un lazo agarra algo el 31,3 % de las noches y la liebre es el 24,5 % de lo
> que cae; lo demás es fauna protegida, que no rinde y lo dice la norma. La tasa es una
> licencia dicha (41× la fuente). La fauna vive donde vive: diez especies ya no están
> pegadas al agua. Y al mirar el mapa al tope apareció la costa en escalones de 32 m:
> arreglada por el coordinador, medida sobre el DEM real. Al agente lo cortó el límite
> de sesión una vez y se lo retomó con su contexto.
>
> **Preparado mientras corre la fase 2**: el contrato, el banco (validado contra la
> base) y el falsador de la **fase 3** (`suelo`); la medición de apertura de la **fase
> 4** (`copa`: el problema de las coníferas es el dibujo del atlas, 8 % de cobertura, no
> el mipmap); y **la propuesta del primer año**, escrita y sin código, en
> `r8-primer-anio.md`, con cinco preguntas para el dueño.
>
> **19/9/2026 — FASE 3 (`suelo`) CERRADA.** Navegador 6/6, banco 7/7, falsador 10/10 con
> sus controles. El suelo de cerca es una textura de capas horneada (hojarasca, andisol
> con pómez, estepa, acarreo): el detalle cercano sube ×8 a ×12, y el terreno mirando al
> suelo baja de 13,4 a 4,6 ms (al frente, de 13,3 a 9,3), medido contra la base en la
> misma sesión. La piedra dejó de ser verde. Siete defectos del banco, todos del jefe; el
> más caro: **el clima de cada carga sale de dos semillas al azar**, y comparar capturas
> de dos cargas medía el cielo (ahora se fijan). El agente encontró que **la normal del
> terreno se ilumina en el marco equivocado** desde el prototipo: es la fase 3b, con
> banco, falsador (9/9, 3 controles) y mitad navegador escritos y validados antes de
> encargarla. Para el dueño: el suelo del bosque queda un 13 % más claro mirando abajo,
> porque el ruido viejo lo oscurecía por debajo de la paleta calibrada.
>
> **19/9/2026 — FASE 3b (`suelo`, la luz) CERRADA.** Una línea: la normal del terreno pasa
> al marco de la cámara. Girar la cámara sobre su eje ya no cambia la luz del suelo (antes
> hasta +446 %; ahora 0,1 %), el mismo punto visto desde cuatro rumbos cambia sólo por el
> especular (≤ 14,4 %), y el costo no se distingue de la deriva (tres pares alternados).
> Banco 5/5, falsador 10/10, navegador verde. El agente encontró además que **el terreno
> no recibe ninguna sombra** (normal del vértice en cero → NaN en ANGLE): confirmado
> restando y con la causa probada (poner la normal en (0,1,0) la devuelve). Cuesta +0,9
> ms al frente, medido en la misma carga. Es la **fase 3c**, abierta con su medición.
> Preparado también: el instrumento de la fase 4 rehecho (un árbol solo, clima fijo), y
> con él se vio que la cobertura de apertura estaba sesgada, que los modelos de árbol
> cambian en cada carga, y que el problema de las coníferas es real igual.
>
> **19/9/2026 — FASE 3c (`suelo`, las sombras) ENCARGADA** (banco `6a56ade`). Banco
> escrito antes: recibe contra un plano de control, sin acné contra una verdad de campo
> sobre el DEM, las sombras del relieve aparecen, y el costo. Base 11/15 roja por el
> motivo correcto, maqueta 15/15, falsador 4/4. La sospecha de acné del jefe se refutó
> midiendo antes de encargar. Después viene la **fase 4** (copa), con el contrato C4
> reescrito sobre el relleno de la silueta y C7 (modelo de árbol determinista) primero.
>
> **19/9/2026 — FASE 3c CERRADA.** El atributo `normal` del terreno en (0, 1, 0): el suelo
> recibe la sombra de los árboles, las obras y (en Media y Alta) el relieve. Navegador
> 17/17 con la base en la misma carga, banco 4/4, falsador 4/4. Cuesta +0,95 ms al frente y
> +0,6 al suelo; sin acné (0 de 16.384 contra el DEM). En la sombra queda el 11 % de la
> luz del sol. En Baja el relieve no proyecta (decisión del preset, anotada).
>
> **19/9/2026 — FASE 4 (`copa`) ENCARGADA** (apertura `beccf51`). C4 reescrito sobre el
> relleno de la silueta con la base de cinco cargas (coníferas 0,38 → ≥ 0,50; puntitos
> 5,35 y 9,41 → ≤ 3,4), C7 (el mismo árbol en cada carga), y un falsador nuevo (8 de 8, 3
> controles) validado contra un horno y un `Vegetacion.js` de maqueta. Agente nuevo.
>
> **22/9/2026 — FASE 4 (`copa`) CERRADA** (`6b7c91d`). Navegador 9/9, banco 6/6, falsador
> 8/8. El ciprés pasa de 0,32 a 0,76 de relleno y el pino de 0,28 a 0,70; los puntitos, de
> 7,2 y 14,4 por mil a 0,27 y 0,37; las hojas miden entre ×1,0 y ×1,9 del largo real (antes
> ×10 a ×20). Y **los árboles cuestan la mitad**: 2,5 → 1,2 ms. Al agente lo cortaron dos
> veces los límites (de sesión y semanal) y se lo retomó con su contexto. Queda a la vista,
> fuera de contrato, que a las latifoliadas les asoman ramas desnudas: sería la fase 4b.
>
> **Preparado mientras corre la 4** (todo con banco validado contra la base y, donde se
> pudo, contra una maqueta del jefe; falsadores con controles):
> - **Fase 5 (piedra)** `ef06b61`: contrato P1–P12; el banco recorre la cadena del hacha con
>   los sistemas de verdad desde un bolso vacío (hoy pide obsidiana y cuero); falsador 11/11.
> - **Fase 6 (luz)** `9c04c2c`: la luna alumbra según la fracción (cuarto = 0,48 de la llena;
>   Allen = 0,09); banco sobre dos meses de noches; falsador 8/8. **El suelo naranja junto al
>   fuego ya bajó un 60 % a 5 m con la 3b**: no se toca más hasta que el dueño lo mire.
> - **Fase 7 (reglas)** `07fc6c5`, `8b5714e`: `efectosAAgregar` está toda aplicada; la
>   cestería suma dos veces (38 → 50 kg); el telar satisface recetas de fogata sin fuego. El
>   banco reproduce los 17,7 apretadas del poncho de la ronda 7.

---

## Ronda 7, fase 6 · `cielo` · CERRADA

Banco Node 7/7 con `vite build`, falsador 18/18 con 3 controles verdes, mitad navegador
18/18. La luna es la de la fecha (0,15° y 0,12 puntos contra JPL Horizons), el cielo gira
con el tiempo sidéreo y la precesión, las 4484 estrellas salen del Bright Star Catalogue
sin ninguna inventada, el disco muestra su fase y la Cruz del Sur enseña el método para
encontrar el sur. La noche le suma 3,48 ms a la GPU contra los 5,06 de la base: cuesta
menos que el ruido que reemplazó.

Tres defectos del propio banco, encontrados midiendo: una premisa astronómicamente
imposible (luna llena alta en verano), una razón que no discriminaba (una luna gibosa
tomada por cuarto) y un barrido que contaba los bordes de los árboles como estrellas
inventadas. Los tres arreglados y vueltos a medir.

Con esto **cierra la ronda 7**. El dueño la jugó el 18/9/2026, y la ronda se fusionó a
`main` y se subió ese mismo día.

> **15/9/2026 — RONDA 7, FASE 5 (`witral`) CERRADA: el telar es una cosa, se hila, y
> la lana alcanza.** Banco 9/9, falsador 20 de 20 con 3 controles verdes, mitad
> navegador 8 de 8. En el juego, **la lana de la cadena del poncho cuesta 17,7
> apretadas y 1,8 kg** en la mediana de 61 puntos; antes eran 84 y 8,4. **Levantar el
> telar no compila nada** (15 programas antes y después), y el telar se ve en pie con
> su urdimbre.
>
> La lana del coirón es **una licencia dicha**: no hay fuente para el vellón en las
> matas. El huso con tortero y el witral de pelo de camélido y de oveja tienen fuente.
>
> *El agente se cortó por el límite semanal y se lo retomó con su contexto. Su
> predicción dio exacta. Encontró además que el telar le tapaba el fuego a la fogata
> en el taller. El arreglo fue del coordinador, y tiró el banco de la fase 3: su
> `Fundicion` falsa era más pobre que la de verdad.*
>
> **Queda para el dueño**: la lana dejó de ser escasa.

> **13/9/2026 — RONDA 7, FASE 4 (`vasija`) CERRADA: el agua viaja en un
> recipiente.** Banco 10/10 con la regresión de siete bancos, falsador 24 de 24 y los
> 3 controles al revés verdes. En el juego, **sin recipiente entran 0 medidas**; con
> el metawe nuevo, **2 de 5**; y soltarlo con un odre y 8 medidas **derrama 2 y lo
> dice**. El cartel de beber promete la medida sólo si entra, con la misma cuenta que
> la da.
>
> El recipiente de antes del cuero es **un metawe de greda**, con cerámica local de la
> Isla Victoria como fuente y los 2 litros declarados como criterio. La cestería
> tupida de `historia.json` era verdad a medias para la región, y se corrigió.
>
> *Dos defectos de los bancos fueron míos, y los encontró el agente haciendo la cuenta
> en vez de esquivarla: el `=== 115` de la ronda 6 y un número en la descripción de una
> aserción, que le escondía un defecto al falsador.*
>
> **Queda para mirar jugando**: el metawe parece un retroceso al lado del odre, y lo
> es a propósito.

> **13/9/2026 — RONDA 7, FASE 3 (`barro`) CERRADA: la arcilla y la arena se
> alcanzan, y el juego dice dónde.** Banco 6/6, falsador 18 de 18, y en el juego
> real **la orilla promete arcilla en 240 de 240 puntos** (antes, «a veces» en 72),
> con la más cercana a 499 m del arranque y **la arena a puñados a 524 m** (antes, la
> legal a 8,6 km).
>
> La arcilla sale de la barranca con `extraer_arcilla`, que el dataset declaraba y
> nadie usaba. La arena, a puñados en la Reserva, como **licencia declarada
> `arenaDePlaya`**; la cantera no cambió. El taller dice de dónde sale lo que falta y
> hacia dónde queda lo más cercano **que ya se vio**, sin revelar lo no visitado.
>
> *La predicción del agente dio exacta —100 % y 524 m—, la primera en la ronda. Y dos
> de los defectos del falsador y uno del banco fueron míos.*
>
> **Queda para el dueño**: la recolección en el Parque —y ahora la barranca— es una
> licencia sin declarar desde la ronda 1.

> **13/9/2026 — RONDA 7, FASE 2b (`empuñadura`) CERRADA: el garrote se ve en la
> mano.** Los 12 objetos de la ranura del arma tienen modelo, y la mano lleva la
> herramienta si hay y si no el arma. Banco 7/7, falsador 14 de 14. En el juego,
> **equipar cualquiera de los doce no compila nada** (17 programas antes y después),
> la caña cuesta +0,11 ms en primera persona, y **la antorcha apagada ya no muestra
> el triángulo amarillo**.
>
> El agente se cortó por el límite de uso antes de escribir código y **se lo retomó
> con su contexto**, no se lo relanzó. Y encontró un defecto del banco leyéndolo
> antes de escribir una línea: la sección del suelo medía cada objeto contra la
> matriz vieja de la mano, unos 10 cm más abajo que en el juego.
>
> *De espaldas, en tercera persona, el garrote no se ve: lo tapa el cuerpo. Es para
> mirar jugando.*

> **12/9/2026 — RONDA 7, FASE 2 (`brasa`) CERRADA: el fuego se ve encendido y
> alumbra.** Mitad Node 4/4, falsador 12 de 12, **mitad navegador 38 de 38**. La
> fogata tenía el suelo en +5,5 de 255 a 2 m, o sea negro, y ahora en **+45,3**; la
> antorcha, de +4,5 a **+32,3**. La fogata tiene llama —pico de 241,8 desde 6 m— y
> **construir sigue sin compilar nada** (17 programas antes y después). Al mediodía
> el fuego baja solo: +2,7, menos que los +5,9 de antes.
>
> **El agente encontró que `conCSM` compilaba programas de más**: el primer horno de
> barro y la primera fragua ya compilaban uno cada uno en la base. Arreglado de
> raíz en `main.js`.
>
> *Sus predicciones, sin navegador, dieron adentro en tres de cuatro. La fogata
> midió un 22 % menos que el centro de la suya: la cuarta vez en dos rondas que el
> número propio de un agente cae del lado optimista.*

> **12/9/2026 — RONDA 7, FASE 1 (`tecla`) CERRADA: andar solo con Z, y el cartel
> dice qué da.** Banco 6/6 con los cuatro anteriores y `vite build`; **falsador 27
> de 27** y los dos controles al revés en verde: cambiar el rinde en su fuente no
> pone rojo al banco, así que el cartel no tiene ningún número copiado.
>
> **El número del agente reproduce**, y el informe no redondeó a su favor: dijo
> 6/6 y dio 6/6. La C ya no cambia la calidad (pasó a F2).
>
> Verificado en el juego: 300 posiciones reales alrededor del arranque, todas con
> su paréntesis, y **en la primera orilla que se miró, a 1,3 km, la piedra dice «a
> veces arcilla»**. Es la primera vez que el juego cuenta de dónde sale.
>
> *Los dos defectos del falsador fueron míos: escribían por un setter que se niega
> a prender sin puntero, y no plantaban nada.*

> **12/9/2026 — RONDA 7 ABIERTA: lo que vio el dueño.** Las rondas 5 y 6 están
> en `main` (`96dc0bf`, sin empujar). El dueño jugó un rato y trajo siete
> anotaciones; la carta las mide una por una antes de encargar nada y está en
> `RONDA7.md`. Rama `mejoras/ronda7-lo-que-vio`.
>
> Tres cosas que salieron de medir y no estaban en las anotaciones:
>
> 1. **La C agacha y además cambia la calidad gráfica**, y apaga el ajuste
>    automático (`Entrada.js:77` y `main.js:267`). Pasa a F2.
> 2. **La arena legal más cercana está a 8,6 km del arranque** y pide
>    herramienta; hay arena a 515 m, pero en la Reserva, donde la cantera se niega
>    siempre. La arcilla sale desde el **1,06 %** de la tierra como mucho, porque
>    junto al agua la tecla bebe. `extraer_arcilla` está declarada en el dataset y
>    no la usa nadie.
> 3. ~~La fogata alumbra el suelo menos de la mitad que la antorcha~~ — **falso,
>    y lo escribí yo sin medir.** Salía de una cuenta sobre suelo liso. En la imagen
>    final la fogata alumbra más que la antorcha, y lo grave es otra cosa: **las
>    dos dejan el suelo en 5 de 255, o sea negro**. Y la fogata **no tiene llama**:
>    prendida se ve igual que apagada. **La luna es inventada**: la fase no es la de
>    la fecha.
>
> Siete fases, en este orden: `tecla`, `brasa`, `empuñadura` (2b: el garrote no
> se veía en la mano, confirmado por el dueño), `barro`, `vasija`, `witral`,
> `cielo`. **El catálogo de estrellas ya está bajado, con permiso del dueño**:
> `tools/catalogos/bsc5/`, con su fuente y su cita en `LEEME.md`.

> **12/9/2026 — RONDA 6 TERMINADA. FASE 3 (`estampa`) CERRADA: los 115 iconos.**
> El bolso dejó de ser una planilla con bordes. **Banco 6/6, falsador 14 de 14
> sin puntos ciegos, compañero de navegador 7/7**, y `vite build` limpio.
>
> **Los tres bancos de la ronda 6 y el de la ronda 5 están verdes a la vez**, y
> los tres falsadores dieron perfecto: 24/24, 21/21 y 14/14.
>
> **Y por primera vez en la ronda el número de costo de un agente reproduce.**
> Medido alternado: 0,72 ms sin herramientas contra 0,71 de la fase 2, y 0,835
> con ocho contra 0,82. **Los iconos no cuestan nada**, y el presupuesto de
> +0,07 que yo había puesto era pesimista.
>
> Cómo se dibujaron, en una línea: **un solo sol** —toda la familia sombreada
> con la luz en el mismo lado, la silueta tres veces— más 45 tintes por materia y
> ~40 piezas compartidas. **Un solo `<svg>` escrito a mano en todo el archivo**
> para 115 dibujos, y 115 siluetas distintas al sacarles el color. La hoja pesa
> 130,3 kB de los 140 permitidos.
>
> **Lo caro no era el CSS sino correr las recetas la primera vez**: abrir el
> bolso costaba 22,1 ms con la hoja perezosa, y con un precalentado en el primer
> rato libre bajó a 3,9. El agente usó `requestIdleCallback` con `setTimeout` de
> respaldo, porque con la pestaña de atrás el rato libre no llega nunca — que es
> el mismo defecto que tuvo mi compañero de la fase 1 con `requestAnimationFrame`.
>
> *Los tres defectos del falsador fueron míos y los tres del mismo tipo: código
> del falsador que decía plantar algo y no plantaba nada. El peor, una expresión
> regular escrita dentro de una plantilla de texto —donde `\s` es una `s` y `\b`
> un retroceso—: doce «no se pudo plantar» seguidos contra un módulo que
> exportaba todo bien.*

> **12/9/2026 — RONDA 6, FASE 2 (`instancia`) CERRADA: dos hachas son dos
> hachas.** Las herramientas viven en la grilla, cada una con su durabilidad;
> `Equipo` **dejó de tener lista propia** —no hay más `taller`, la fuente es la
> grilla más las cuatro ranuras—; lo puesto pesa pero no ocupa casillero, y
> desequipar con el bolso lleno falla limpio. El guardado viejo entra y `VERSION`
> sigue en 1.
>
> **Banco 8/8 y falsador 21 de 21 sin puntos ciegos**, después de arreglar tres
> defectos míos: la sección que probaba la pila abierta la llenaba de una sola
> vez, el peso del objeto sólo se medía puesto, y un parche del falsador escribía
> por `enRanura()` —que devuelve una **vista**— y no plantaba nada.
>
> **El banco de la ronda 5 se cayó a 7/9 y NO era una regresión.** No se le creyó
> al agente: se verificó por el camino real, con una sola `Partida` y un solo
> `Inventario`, y dio 10/10 —el hacha gastada a 32/40, las dos del bolso con sus
> usos, el peso y los casilleros—. La causa estaba en el banco viejo, que le
> pasaba a `Partida` un inventario **distinto** del que tenía el equipo. Se
> arregló y volvió a **9/9 con 160 aserciones**: un banco rojo que nadie cree es
> peor que no tener banco.
>
> **El costo informado no reproduce, otra vez.** El informe decía que las
> herramientas «no cuestan nada medible»; medido alternado dan **+0,11 ms, un
> 15 %** (0,71 → 0,82), con las tres lecturas de cada condición a 0,015 ms entre
> sí. No es un problema —`pintar()` no corre por cuadro— pero el número no era el
> que hay. **Va dos de dos: en las dos fases el costo informado por el agente
> cayó del lado que le favorecía.**
>
> Tres cosas que arregló el coordinador y el agente declaró sin poder tocar:
> `equipo.alCambiar` no lo escuchaba nadie —guardar el canasto no bajaba los kilos
> hasta el próximo desbloqueo—; la pantalla de muerte **no nombraba las
> herramientas perdidas**; y `Fabricacion.estado()` ofrecía «Hacer» con el bolso
> lleno para negarse recién al apretar.

> **12/9/2026 — RONDA 6, FASE 1 (`casillero`) CERRADA: la grilla.** El bolso es
> una grilla de **24 casilleros** que crece con la capacidad, las pilas salen del
> peso sin una sola tabla escrita a mano, las posiciones no se compactan al
> sacar, y mover, partir y juntar no pierden un gramo. **El guardado viejo entra
> y `VERSION` sigue en 1.** Los 75 sitios de llamada en 16 archivos no se
> tocaron: la API de afuera es la misma.
>
> **Banco 7/7 con 118 aserciones y falsador 24 de 24, todos cazados por la
> aserción declarada: cero puntos ciegos.** Es el mejor resultado de falsador de
> todas las rondas, y costó: **cuatro de los defectos que encontró eran del
> banco**, no del código. El más caro fue una aserción imposible —le puse al
> bolso 999 kg para «sacar del medio» el tope de peso, sin ver que las casillas
> se derivan de la capacidad, así que pedía llenar 630 casilleros con las 42
> fichas livianas que existen. **El agente lo demostró en vez de acomodar su
> código**, que es exactamente lo que tiene que hacer un agente con un banco
> ajeno.
>
> **C10 no reproduce.** El agente informó que la grilla sale a 0,58× el costo de
> la lista. Medido por el coordinador alternando A/B/A/B con la misma carga y en
> tandas de 20 pintadas —el reloj cuantiza a 0,1 ms y una sola pintada no se
> puede medir—, la lista da 0,76 ms de mediana y la grilla 0,775: **+2 %, no
> −42 %**. No hay regresión, pero la ganancia informada no existe.
>
> *Un informe que dice un número redondo a favor propio es el que hay que volver
> a medir. Éste dio al revés, y el resto del informe era honesto.*

> **12/9/2026 — RONDA 6 ABIERTA: el inventario de casilleros.** Estilo Diablo 2
> o Rust, pedido por el dueño. Rama `mejoras/ronda6-inventario`, sacada de
> `mejoras/ronda5-graficos`. **La ronda 5 sigue sin fusionarse a `main` y sigue
> esperando el ojo del dueño en pantalla.** El encargo está en `RONDA6.md`.
>
> Se abrió midiendo el código antes de contestar cuánto costaba, y la respuesta
> fue mejor de lo que parecía: **la mitad cara ya estaba pagada.** De los 75
> sitios que tocan el inventario en 16 archivos, sólo 20 mutan, y **11 de los 12
> que agregan ya leen cuánto entró de verdad**, porque el tope de 38 kg los
> obligó hace rondas. El rechazo parcial —«cazaste el ciervo pero no te entra»—
> está resuelto en todo el juego. Se reescribe `Inventario.js`, cien líneas, y
> el resto no se entera.
>
> Dos números se midieron antes de escribir el contrato, para no inventarlos:
>
> 1. **La pila sale del peso**, por la escalera `[1,2,5,10,20,50]` con tope de
>    3 kg. Se probaron 2, 3, 4 y 5: con 2 quedan nueve recursos que no apilan,
>    con 4 y 5 la mitad de la tabla se va a 50. **Cero datos escritos a mano**
>    para las 71 fichas.
> 2. **24 casillas** a capacidad base. En 4000 cargas simuladas, una mixta de
>    38 kg usa 22 casillas en el peor caso —así que la grilla nunca bloquea un
>    bolso lleno normal—, pero una recorrida de sólo cosas livianas llega a 28 y
>    ahí muerde la grilla. **Los dos topes muerden y ninguno es adorno.**
>
> Lo caro no es el código: son **127 iconos** (71 recursos + 56 objetos) en una
> interfaz donde hoy **no hay una sola imagen**. Eso es la fase 3. Y
> `Equipo.taller` es un `Map<id, usos>` —hoy no se pueden tener dos hachas—, que
> es la fase 2.
>
> *El falsador cazó un defecto propio antes de plantar ninguno: la copia de
> `src/` queda fuera del proyecto, y sin un `package.json` al lado Node lee los
> `.js` como CommonJS. Todas las secciones morían por la misma razón, y el
> falsador lo habría contado como que el defecto plantado se vio.*

> **11/9/2026 — RONDA 5, FASE 1 (`lumbre`) CERRADA: la luz.** La antorcha, el
> candil y las velas alumbran y se consumen contra el reloj del mundo. Los
> hornos y el incendio alumbran de verdad, y ya no queda ninguna luz de three en
> `src/`: `src/engine/Luces.js` compila dos luces fijas en la carga. **Construir
> una fogata ya no congela el juego**: 7,6 ms el primer cuadro, contra 19 254.
> Cuesta +0,48 ms apagado, +1,08 con la antorcha y +1,46 con antorcha y
> fogata, en la HD 4000 a Baja 1024×576. El equipo se guarda con la partida.
> Banco de Node 9/9, falsador sin puntos ciegos, y cinco capturas. Todo el
> detalle, incluidas las cuatro veces que se equivocó el banco, está en
> `RONDA5.md`.
>
> **Lo que dejó a la vista y pasa a la fase 2: la vegetación brilla de noche.**
> A medianoche el pasto se ve más que el suelo que alumbra una antorcha.
>
> *La mitad jugable del contrato estaba bien calculada y no hacía nada:
> `revisar()` cuenta celdas de 256 m, y los dos topes pedidos revelaban la misma.
> Lo midió el agente, no el banco. Un número correcto que no cambia ninguna
> consecuencia es un efecto declarado que nadie consume, con otro nombre.*

> **11/9/2026 — RONDA 5 ABIERTA: gráficos.** Luz puntual, las tres deudas
> visuales del README y la herramienta en la mano. Rama
> `mejoras/ronda5-graficos`; el encargo, con todo lo medido, está en
> `RONDA5.md`. Se abrió corrigiendo dos cosas que se venían repitiendo:
>
> 1. **El juego sí inicializa en la vista previa.** Esperaba el clic de «Entrar
>    al parque»: `main.js` hace `await personaje.abrir()` antes de arrancar el
>    bucle y de definir `window.SurviBar`, y el navegador de la vista previa no
>    tiene el aspecto guardado. Con el clic, `window.SurviBar` y
>    `window.capturar` existen. La placa de la vista previa es la **Intel HD
>    4000**.
> 2. **Sí había luces puntuales en `src/`** —una por horno en `Hornos.js:68`, y
>    la del incendio en `Clima.js:262`— y **cambiar la cantidad congela el juego
>    ~19 s** en esta máquina, porque recompila seis programas. Construir la
>    primera fogata lo dispara hoy, en `main`. La frase «no hay ninguna luz
>    puntual» salió de un informe de la ronda 4 y pasó a tres archivos sin que
>    nadie la comprobara.
>
> *Una afirmación de un informe no es un hecho hasta que alguien la mira en el
> código, y copiarla a otro archivo no la vuelve más cierta: la vuelve más
> difícil de encontrar.*

> **8/9/2026 — RONDA 4: CUATRO FASES CERRADAS Y COMMITEADAS.** El arbol de
> herramientas dejó de ser un archivo. `Equipo.js` y `Fabricacion.js` existen, se
> fabrica desde el bolso, `COSECHA_SOTOBOSQUE` rinde por nivel, el indicador de
> accion cambia solo --"Juntar ramas del tronco caido" contra "Trozar un caido ·
> hacha de piedra"--, las nueve armas leen alcance, porte y municion, y las
> cuatro tecnologias nuevas entraron al codice encadenadas. El arbol de saberes
> paso de 26 a 32 alcanzables sobre 52 nodos, y cada movimiento del numero esta
> explicado en el README.
>
> **Cuatro bancos, los cuatro con mutacion plantada y detectada:**
> `r4-banco-saberes.mjs`, `r4-banco-fabricacion.mjs`, `r4-banco-cadena.mjs` y
> `r4-banco-arma.mjs`. El de la cadena camina la pregunta original del dueño
> —«necesito tablones», «tengo que cazar con qué»— contra los sistemas reales.
>
> **Trampa n.º 10, en el banco del arma.** La primera version no le daba piedra a
> la honda, asi que el sistema cortaba en la comprobacion de municion y dos
> aserciones daban OK por el motivo equivocado: decian "no abate un ciervo" y el
> verdadero motivo era "no tenes con que tirar". *Un OK por la razon equivocada
> es peor que una falla, porque nadie lo va a mirar.*
>
> **Lo que NO se hizo y hay que hacer junto:** sacar la equivalencia
> `madera_dura → tronco`. Hay que pagarla con el peso en el mismo movimiento,
> porque la cabaña pide 12 troncos —72 kg sobre un bolso de 38— y
> `Construccion.faltaPara()` no mira los depósitos. Sacarla sola deja tres obras
> imposibles. Está anotado en el código, donde alguien lo va a leer.
>
> Queda sin sistema la luz puntual (antorcha, candil y velas declaran radio y
> duración, y no hay ninguna luz puntual en `src/`) y la colmena, que pide una
> entidad de mundo con reloj de 168 h.

> **7/9/2026 — RONDA 4 ABIERTA: la cadena de fabricación.** A pedido del dueño:
> *«no hay una sucesión de eventos lógico para poder construir; necesito tablones
> pero no sé cómo hacerlos, tengo que cazar pero ¿con qué?»*. El encargo está en
> `RONDA4.md`. Rama `mejoras/ronda4-crafteo`, salida de `main`.
>
> **Se revisó ANTES de escribir código, no después.** Cuatro revisores
> independientes sobre el dataset —economía, rigor, código y juego— y ninguno con
> permiso para editarlo: es la lección de la ronda 2 aplicada de entrada. Sacaron
> 34 hallazgos de economía, 12 falsedades de contenido y 3 roturas de código que
> el jefe no había visto. Tres de los cuatro murieron por límite de sesión
> **después** de escribir su informe; el de economía dejó banco y salida, y el
> jefe le pasó los números a prosa.
>
> Lo que encontraron y más duele: **el árbol se podía saltear entero**
> (`herreria_colonial.requiere` vacío daba el nivel 4 sin una sola herramienta de
> piedra, por el 4,3 % del pool de saber), el árbol cobra 1480 puntos y el juego
> reparte 469, y la obsidiana a 1500 m dejaba 52 de 57 objetos detrás de 6,4 km y
> 700 m de desnivel. Se agregó la lasca de rodado para que el arranque no sea una
> caminata.
>
> **Trampa nº 9, y esta vez en el validador del jefe:** la lista blanca del
> comprobador tenía `mosca` puesta a mano, así que un recurso que se producía y no
> tenía ficha pasó verde tres veces seguidas. *Un validador con excepciones
> escritas a mano no valida: confirma lo que ya creías.*
>
> **Decisiones del dueño el 7/9/2026:** se fabrica desde el bolso sin banco de
> trabajo; la apicultura queda recortada a la colmena de tronco y la cera; las
> nueve armas se quedan y se les dan estadísticas en vez de fusionarlas; y **el
> arco caza aunque la norma no lo admita**, como licencia declarada con su
> advertencia, igual que ya se hace con el fuego. Ver `licenciasDeJuego` en
> `src/data/herramientas.json`.

> **7/9/2026 — LA RONDA 3 SE JUGÓ Y ENTRÓ A `main`.** El dueño la miró en
> pantalla **antes** de fusionarla: *«está espectacular, al menos a primera
> vista»*. Fusión por avance rápido, ocho commits. La rama
> `mejoras/ronda3-graficos` queda como mojón y se puede borrar.
>
> **Es la primera ronda de las tres que se ve antes de entrar.** La 1 y la 2 se
> fusionaron a ciegas; la 2 estuvo cuatro días en `main` sin que nadie supiera si
> estaba bien. El costo de esperar fue un comando. Conservar ese orden.
>
> Queda una salvedad honesta: «a primera vista» no es una revisión. El punto 2 de
> `SEGUIR.md` —si el tronco quedó más oscuro o más claro— es el único que ningún
> banco puede decidir y el que más fácil se escapa en una mirada rápida.

> **6/9/2026 — RONDA 3 ABIERTA: definición y realismo de animales y árboles.**
> Un jefe con tres subagentes —`horno`, `fauna`, `flora`—, en la rama
> `mejoras/ronda3-graficos`. El encargo está en `RONDA3.md`; las bitácoras son
> `r3-horno.md`, `r3-fauna.md`, `r3-flora.md`.
>
> Tres cosas la distinguen de las anteriores:
>
> 1. **Se cierra de a una fase**, por pedido del dueño. `fauna` y `flora` no
>    arrancan hasta que `horno` esté medido, revisado y commiteado. No es
>    prolijidad: `horno` produce los atlas que las otras dos consumen.
> 2. **El banco lo escribe el jefe, no el agente**, desde el primer día. Es la
>    lección de la ronda 2 aplicada de entrada y no como revisión final.
> 3. **La mejora se paga con textura, no con shader.** Está medido: esta máquina
>    pierde 8× en matemática de shader y gana 2,3× en ancho de banda de texturas.
>    Cualquier idea que sume `pow`/`noise`/`fbm` por píxel va contra el hardware.
>
> Se descartó la fotogrametría —una foto suelta no da un modelo 3D— y también
> descargar fotos ajenas. El origen es **procedural desde referencia documentada,
> horneado offline**: decisión del dueño el 6/9/2026.
>
> **FASE 1 (`horno`) CERRADA el 6/9/2026.** La fábrica de atlas existe y corre
> con `npm run hornear`: `tools/hornear-texturas.mjs`, `src/data/pelajes.json`
> (44 especies, todas con campo `fuente`), tres atlas de 1024×1024 en
> `public/tex/` y el cargador `src/util/atlas.js`. **16,00 MiB de VRAM con
> mipmaps contra el techo de 24 MB**, recalculado desde el IHDR de los PNG y no
> leído del manifiesto. Determinista: dos horneadas dan bytes idénticos. Nadie
> importa `atlas.js` todavía —eso es de la fase 2— y `vite build` pasa limpio,
> así que el arranque no cambió. Banco: `.claude/flota/banco-r3-fase1.mjs`.
>
> **Trampa nº 8, y esta vez estaba dentro del instrumento.** El banco de
> degradación de la fase 1 daba **verde sin ejercitar nada**, y el agente lo
> reportó como verde bueno. Causa: stubeaba `Image`, pero `THREE.TextureLoader`
> usa `document.createElementNS(…,'img')`. El control se iba por la rama de
> error, el cargador devolvía `disponible: false`, y como `cargarAtlasFauna()`
> memoiza su promesa, los otros dos escenarios recibían esa misma respuesta
> guardada sin pedir nada por red: **los tres escenarios medían el mismo fallo.**
> El banco imprimía «pedidos de red: 0» y la guarda no lo leía. La lección no es
> nueva —es la nº 3 otra vez— pero la variante sí: *una guarda de cobertura que
> sólo pregunta «¿corrió?» y no «¿el camino feliz llegó a funcionar?» no es una
> guarda.* Ahora el banco exige que el control llegue a `disponible: true` con
> sus tres texturas y que cada escenario de fallo falle por el motivo plantado.
> El código del agente no tenía el defecto: lo tenía el banco.
>
> Queda anotado un desvío del reparto: `horno` escribió el encabezado de la
> ronda 3 en este mismo archivo, que no es suyo. El contenido era correcto y se
> conservó, pero la regla es que un archivo ajeno se pide por
> `pendiente-r3-<fase>.md` y no se toca.
>
> **FASE 2 (`fauna`) CERRADA el 6/9/2026.** Los seis bancos de
> `.claude/flota/banco-r3-fase2.mjs` en verde con cobertura demostrada, corridos
> por el coordinador y no por su autor. `src/entities/Fauna.js` es el único
> archivo de entidades tocado: `Cuerpo.js` y `Peces.js` quedaron intactos a
> propósito, porque el atlas no tiene celda para los siete peces ni para el
> jugador.
>
> **Los números, que fueron al revés de lo que se temía.** La fase no gastó del
> presupuesto de 2 ms: lo devolvió. Mallas de los 44 modelos **393 → 263**
> (−33 %), materiales **114 → 44** con una sola variante de programa, y la cota
> que manda con `MAX_VIVOS = 52` y cuatro cascadas, **dibujos 3 380 → 1 820**.
> Triángulos 22 282 → 21 822: el mamífero queda en 628 exactos, los mismos de
> antes, mejor repartidos. Lo único que sube es lectura de textura, que es la
> moneda barata de esta máquina.
>
> **La silueta era el defecto grande, y no la textura.** El tronco del huemul era
> un elipsoide de 1,12 m de ancho y **546 kg** sobre un animal que la ficha
> declara de 75. Ahora son **0,228 m y 48,7 kg**, el 65 % de su masa declarada;
> el cóndor pasó de 78 cm de ancho de cuerpo a 25, que es la medida real. El
> ancho salía sólo de `largoM` y **`pesoKg` estaba en las 44 fichas sin usarse
> para nada de la forma**. El techo del tronco cae exactamente en `alturaCruzM`
> en las 21 especies que lo declaran, y se conservó el respaldo `?? L*0.6` para
> las **6** que lo tienen en `null`.
>
> **Dos defectos silenciosos que encontró escribiendo, no midiendo:**
> `fusionarGeometrias()` copiaba `position`, `normal` e `index` pero **no `uv`**,
> así que una malla fusionada con mapa muestreaba un solo texel. Y
> `SphereGeometry` corrige el U de sus polos ±0,5/widthSegments, con lo que el
> hocico salía con U entre −0,071 y 1,071: ese sobrante **cae en la celda vecina
> del atlas**, y `ClampToEdgeWrapping` no salva porque recorta contra el borde
> del atlas y no el de la celda.
>
> **El cruce ORM de la fase 1, arreglado.** El horno hornea ahora
> **R = oclusión, G = rugosidad, B = 0** y el manifiesto lo declara en un campo
> `canales`. Rehorneado y con el banco de la fase 1 entero de vuelta en verde;
> `albedo.png` y `normal.png` conservan su hash de `858ae717`, así que el arreglo
> no se derramó. Lo encontró la fase 2 al enchufar lo que la fase 1 había cerrado
> — que es exactamente para lo que sirve que las fases se revisen entre sí.
>
> **El falsador quedó con una zona sin falsar, y se cierra declarándola:** el
> defecto «la geometría fusionada pierde `uv`» ya no se puede plantar, porque el
> arreglo copia la **unión** de atributos y no queda dónde engancharlo. El banco 1
> sí está falsado por otros defectos. No es lo mismo que un punto ciego, y el
> informe del falsador ahora separa `lo vio` / `NO lo vio` / `no se pudo plantar`
> en vez de mezclarlos, que era lo que hacía parecer ciego a un banco sano.
>
> **Lo que la fase 2 le debe a la 3:** el manifiesto no declara la
> **orientación** de sus bandas. La fase 2 eligió V dorsoventral, porque el
> contrasombreado `colorDorso`/`colorVientre` es un dato real en las 44 especies;
> el precio es que un patrón de franja longitudinal ya no corre a lo largo del
> lomo, y **el zorrino patagónico pierde sus dos franjas dorsales**. Arreglarlo
> bien es del lado del horno. Está entero en `pendiente-r3-fauna.md`, punto 3.

> **FASE 3 (`flora`) CERRADA el 6/9/2026 — y con ella la ronda 3.** Los seis
> bancos de `.claude/flota/banco-r3-fase3.mjs` en verde con cobertura demostrada,
> corridos por el jefe y no por su autor. Único archivo de mundo tocado:
> `src/world/Vegetacion.js`. **`Sotobosque.js` quedó intacto a propósito** —ya
> había bajado al 4,5 % del cuadro y es la pieza con más instancias del juego:
> agregarle un `map` es sumar una lectura por fragmento a la que más fragmentos
> emite. Decisión escrita con el motivo, no por olvido.
>
> **La corteza: 63 especies muestreaban UN texel blanco.** `troncoCurvo()` genera
> el tronco con `CylinderGeometry` —que parametriza u alrededor y v en altura— y
> `pintar()` **pisaba esa UV con una constante**, los dos canales al mismo valor,
> apuntando al centro del cuadrado opaco de 51×51 px de la esquina del atlas.
> Tronco, ramas y cañas de todo el bosque leían ese punto. Medido sobre la
> superficie: **el 100,0 % de la madera caía en una UV degenerada; ahora es el
> 0,00 %**. La franja de corteza no agrega ni una lectura ni una instrucción de
> ALU por fragmento —cambia el valor del texel que ya se leía— y de yapa arregla
> la selección de mip, porque la derivada de UV era 0 y el tronco leía siempre el
> nivel 0.
>
> **El número grande de la ronda, y estaba escondido: 45,0 MiB de profundidad.**
> `WebGLRenderTarget` crea un renderbuffer de profundidad por objetivo
> (`depthBuffer: true` es el defecto), el objetivo queda vivo dentro de
> `horneado.objetivo` y **nunca se libera**. Pero la profundidad **sólo hace falta
> mientras se hornea**: después la cartelera lee el color y nada más. Se comparte
> una `DepthTexture` entre los treinta hornos y se libera al terminar el último.
> **VRAM real de la vegetación: 125,07 → 80,07 MiB.** Sin tocar una vista ni un
> píxel: bajar de 16 a 8 vistas habría costado el pestañeo de 45° que la ronda
> anterior ya había arreglado.
>
> Liberar no fue adorno: **`deallocateRenderTarget()` de three llama a
> `renderTarget.depthTexture.dispose()`**, así que con la textura compartida y
> viva, un `objetivo.dispose()` sobre **uno** de los treinta le sacaría la
> profundidad a los otros veintinueve. Hoy nadie llama a ese dispose, pero
> quedaba cargada. Contracara escrita al lado del código: **esos objetivos ya no
> se pueden reusar para renderizar**.
>
> ### Trampa nº 9: TRES números de VRAM, y los tres caían del lado cómodo
>
> Es la nº 3 de la ronda 2 —«un número mezclado de dos corridas que caía del lado
> cómodo»— pero en una variante peor, porque acá **ninguno de los números estaba
> mal calculado**: los tres estaban bien, y medían cosas distintas sin decirlo.
>
> | número | qué contaba | qué le faltaba |
> |---|---|---|
> | **62,67 MiB** (jefe anterior) | color + mipmaps de los 30 objetivos + atlas de follaje | profundidad **y** búferes de instancia |
> | **121,5 MiB** (`r3-flora.md`) | color + mipmaps + profundidad + instancias | los dos atlas de follaje |
> | **76,5 MiB** (cabecera de `CUPO_ESPECIES`) | color + mipmaps + instancias | la profundidad |
> | **125,07 MiB** | **todo, más la geometría (0,87)** | — |
>
> El 62,67 no era una estimación de nadie: **el banco de la fase lo calculaba
> así**, con `w*h*4*(mip?4/3:1)` y nada más. O sea que el instrumento escrito para
> auditar la memoria **era ciego justo a la partida más grande**, y el jefe
> reportó de buena fe lo que su propio banco le imprimía. La lección: *un número
> sin su desglose no es un número, es una opinión con decimales.* El banco ahora
> imprime las cinco partidas y la reconciliación de los tres números, siempre.
>
> **Y una del mismo día, del otro lado del mismo espejo.** El banco leía
> `objetivo.depthTexture` **al final** de la construcción. Eso sirve mientras la
> textura quede enganchada, y deja de servir en cuanto alguien hace lo correcto:
> compartir y liberar. Leído al final se ve `null` en los treinta y se les cobra
> un renderbuffer propio a cada uno — 45 MiB que ya no existen. El banco habría
> informado «no hay ahorro» **justo cuando el ahorro es total**. Se arregló
> tomando la instantánea en el primer `setRenderTarget` (que es cuando three
> compone el framebuffer y decide) y escuchando el evento `dispose`.
>
> ### Y una tercera, que es la que más fácil se repite
>
> Los bancos 1 y 2 **medían la unidad equivocada**, y los dos daban rojo contra un
> código correcto:
>
> - El banco 1 contaba qué fracción de **vértices** comparte una UV.
>   `CylinderGeometry` emite un vértice central por segmento en cada tapa, todos
>   con uv (0,5 · 0,5): las tapas del tronco y de sus siete ramas juntan decenas
>   de vértices con UV idéntica **por construcción de three**, en discos que ni se
>   ven. Un árbol perfecto daba 12,9 % y parecía roto. «Muestrear un solo texel»
>   es una propiedad de la **superficie**, no del conteo de vértices.
> - El banco 2 medía el follaje **sobre el lienzo entero, incluida la franja de
>   corteza**, que es opaca por definición. Con eso la cobertura de alfa «subía»
>   de 23,1 % a 31,4 % y parecía una regresión clara del 22 % del cuadro. Medida
>   sobre lo que las tarjetas pueden muestrear, la lámina **baja** de 23,2 % a
>   21,5 %. **La regresión no existía: la había inventado el instrumento.**
>
> *Antes de creerle a un banco que dice que el agente rompió algo, hay que
> comprobar que el banco esté midiendo la pieza que nombra.*
>
> **El falsador, que es lo que hace que todo lo de arriba valga.**
> `.claude/flota/banco-r3-fase3.falsar.mjs`: **los 15 defectos plantados, los 15
> vistos; cero puntos ciegos, cero zonas sin falsar, y los seis bancos con al
> menos un defecto que los pone rojos.** Para llegar ahí encontró dos puntos
> ciegos reales y los dos se cerraron. Uno era un defecto **obsoleto**: D2
> anulaba `fillRect`, que era como se pintaba la reserva de madera hasta la ronda
> 2; la fase 3 la genera píxel a píxel, así que el defecto se plantaba **con
> éxito** y no tocaba nada — y el falsador lo cantaba como punto ciego cuando era
> el defecto el que había quedado viejo. El otro fue culpa del jefe: al
> reemplazar el gate de «capas» por uno de cobertura de alfa, lo dejó de **un solo
> lado**, y «el atlas pierde la mitad de sus marcas» pasaba en verde. La banda es
> de dos lados: subir cuesta cuadros, bajar adelgaza el dosel. Y el falsador ganó
> una regla: **un banco que ya estaba rojo en el control no demuestra nada al
> ponerse rojo con el defecto** —habría dado rojo igual sin plantar nada—, así que
> ahora se descuenta antes de juzgar.
>
> **Lo que la ronda 3 deja sin cerrar**, todo con su número y su archivo:
>
> 1. **Ningún preset baja un solo byte de la VRAM de la vegetación.**
>    `Calidad.recortarInstancias()` sólo toca `malla.count`: baja el trabajo por
>    cuadro y no la memoria. «Mínima» entrega la misma VRAM que «Alta». Las tres
>    palancas están medidas en `pendiente-r3-flora.md` (**30,61 + 26,25 + 6,52
>    MiB**), pero lo que falta **no es la constante: es el conducto** desde
>    `main.js`/`Calidad.js` al constructor de `Vegetacion`. Es del coordinador.
> 2. **`Vegetacion.dispose()` no libera casi nada** —~63 MiB de objetivos,
>    materiales y mallas—. Hoy nadie lo llama, y por eso `flora` no lo tocó en una
>    fase de cero regresión. Queda para cuando exista un banco que lo ejercite.
> 3. **La orientación de las bandas del manifiesto** (`pendiente-r3-fauna.md`,
>    punto 3): el zorrino patagónico sigue con dos cinturones en vez de dos
>    franjas dorsales. **Postergado a la ronda 4 con el motivo escrito**: tocarlo
>    obliga a rehornear y a correr enteros los bancos de dos fases ya cerradas, y
>    la fase 3 se cortó dos veces por límite de uso antes de llegar a su falsador.
> 4. **Nada de esta ronda se vio en pantalla.** Ni la fauna de la fase 2 ni la
>    corteza de la 3. Todo está verificado por mecanismo y con bancos de Node,
>    que es la regla, pero **la regla no reemplaza mirar el bosque**.

> **3/9/2026 — LA RONDA 2 CERRÓ.** Tres jefes —carta, mundo, juego— más una
> revisión independiente. El encargo está en `RONDA2.md`; las bitácoras son
> `r2-carta.md`, `r2-mundo.md`, `r2-juego.md` y `r2-revision-juego.md`. Rama
> `mejoras/ronda2-jugabilidad-graficos`, **fusionada a `main` y empujada el
> 3/9/2026** (avance rápido, `1a12624`). Ojo con esto: se fusionó **antes** de
> que el dueño la jugara, por decisión suya, así que `main` lleva trabajo que
> nadie vio en pantalla. Las ocho cosas para mirar están acá abajo y en
> `SEGUIR.md`; si alguna quedó fea, se arregla sobre `main`. Lo de más abajo es el cierre de la ronda 1 y
> sigue valiendo como diagnóstico e historia.
>
> **La lección cara de esta ronda:** el que escribe el arreglo, el banco que lo
> mide y el informe que lo aprueba no pueden ser el mismo. La revisión
> independiente encontró una rama muerta nueva **creada por el arreglo del
> ripio** —y que estrangulaba la única fuente de agua del juego—, un banco que
> declaraba 17/17 sin ejercitar 3 de 5 tipos porque construía sus dependencias a
> mano y las consultaba con `?.`, y un número mezclado de dos corridas distintas
> que caía del lado cómodo. Ninguna de las tres la podía ver su propio autor.
>
> **Variante nueva de la trampa nº 3:** un banco que arma sus dependencias a mano
> y las consulta con encadenamiento opcional **da verde sin ejercitar nada**. El
> banco de hallazgos lo estaba imprimiendo —«arena 0 · chatarra 70»— y nadie leyó
> el cero. Toda medición de esta flota necesita una guarda de cobertura.

## Lo que hay que mirar JUGANDO, todo junto — ronda 2

El panel del navegador no compone cuadros, así que nada de esto se pudo ver. Es
lo único que la ronda no pudo cerrar sola.

1. **Que el cartel de ripio haya desaparecido.** Es el defecto que trajo el
   dueño con captura. Medido: de un aviso cada 47 m al 6,2 % del recorrido.
2. **El ritmo de los avisos nuevos** de `G` (taller), `Tab` (códice) y `H`
   (caza). Escalonados a 1,5 s y 4,5 s; si se pisan o molestan, se toca ahí.
3. **El bosque caminando**, franja de 100 a 140 m: el pico de cambios
   simultáneos bajó de 105 a 15.
4. **El lago lejano contra un cerro**, en Baja. Y si la veta del agua queda
   manchada, es **un solo número**: `Agua.js:717`.
5. **La línea de espuma de la orilla**: tres bandas o un canto duro. Viene
   pendiente desde la ronda 1 y nunca se pudo verificar.
6. **El suelo a tres o cuatro metros**: el grano de gravilla tenía que estirarse
   de 5,6 m a 11 m.
7. **La estepa al este seco**, que antes no tenía una sola especie leñosa apta.
8. **El mapa**: contraste del sombreado a cada nivel de zoom, si 50 m de
   equidistancia raya la zona de cumbres, si los seis glifos se distinguen a
   640 px, y si la X de las obras tiene el tamaño que el dueño quería. Los
   cuatro son cambios de tres líneas.


## Al 2/9/2026 — LA FLOTA CERRÓ. Los siete agentes están terminados.

**Todo está en GitHub y todo está en `main`.** `origin/main` había quedado 19
commits atrás; ya se empujó todo.

**No queda ningún agente pendiente y ningún `pendiente-*.md` sin aplicar.**

### Los siete

| Agente | Qué cerró |
|---|---|
| **luz** | Cielo verde, coseno solar doble, exposición constante → curva. |
| **veg** | Piedras negras, normal nula en la punta del pasto, albedo de 8 especies, oclusión propia de la copa. |
| **agua** | Cenit reflejado, silueta del cerro en el agua, relieve fino. −5 ms de cuadro. |
| **bucle** | La leña no se podía juntar; cadena del metal de 196 a 38 h de mundo. |
| **feel** | Velocidad real = declarada (1,91 → 3,40 m/s). Una sola zancada. Agachado con transición, golpe al aterrizar, campo visual al correr. El cuerpo dejó de ir por el aire: **0 cuadros de 180** contra 112 de 150. |
| **vida** | El testigo de las voces moría a los 2 s y **cortaba 27 de las 42 voces**. La fauna estaba muda: faltaba el cableado en `main.js`. Pasos enganchados a la zancada. `Peces.js` abierto por primera vez. |
| **ui** | Barra crítica que se ponía **más** transparente. Buscador y conteos en el Códice. Brújula ilegible contra el cielo del mediodía. Y el teclado del juego se disparaba escribiendo. |

### Lo que hizo el coordinador

- `src/main.js`: `bichos.audio = audio` (sin eso la fauna quedaba muda) y el
  aviso de bienvenida reducido de seis teclas a dos.
- `src/engine/Entrada.js`: respeta el foco. Escuchaba `keydown` en `window` sin
  mirar quién lo tenía, así que cualquier campo de texto de cualquier panel
  chocaba con los atajos del juego. `Codice.js` lo había tapado por su lado;
  esto lo arregla de raíz.
- `README.md`: la sección `## Estado real` listaba como defectos la oclusión de
  copa y la falta de voces de fauna, que esta flota resolvió.

## Baja contra Baja: MEDIDO el 2/9/2026

Instrumento validado antes de nada (`bancoValidez()` → «el instrumento mide»),
placa confirmada como la de destino: `ANGLE (Intel, Intel(R) HD Graphics 4000)`.

| Preset | Resolución | ms | fps |
|---|---|---|---|
| Alta | 1280×720 | 77,84 | 12,8 |
| Baja | 1280×720 | 42,34 | 23,6 |
| **Baja** | **1024×576** | **31,42** | **31,8** |
| **Mínima** | **1280×720** | **31,71** | **31,5** |

**La flota no agregó costo: lo bajó.** Contra la línea de base registrada
—preset Alta, árbol limpio—: 57,1 → 49,21 ms a 640×360 (**−13,8 %**) y
88,3 → 77,84 a 720p (**−11,8 %**).

Desglose a Baja 1024×576: terreno **35 %**, árboles 22 %, sombras 9 %, agua
4,5 %, sotobosque 4,5 %, cielo 4 %, posproceso 3 %, **reflejo 0 %**. Dos cosas
que esto corrige de `docs/medicion-cuadro.md`: el sotobosque **ya no** es el
77 % del cuadro junto con el terreno —bajó a 4,5 %—, y el terreno es hoy la
única pieza con algo grande para ganar. Todo escrito en la sexta ronda de ese
documento.

## Lo que queda, y no es de ningún agente

1. **Decidir la velocidad.** Subió un 78 % al arreglar el rozamiento: es lo que
   el código siempre declaró y lo que dice el README, pero el juego se venía
   equilibrando al valor viejo. Si se siente demasiado, se toca
   `velocidadBase` — **no** se vuelve a poner el rozamiento contra la entrada.
2. **Una tanda de capturas finales** contra `capturas/base-*.png`, y de paso la
   confirmación visual de la línea de espuma de la orilla, que es lo único de
   `agua` que quedó sin mirar. El panel del navegador no compone un cuadro
   utilizable, así que esto pide una mirada en el juego de verdad.
3. **Diagnosticado pero sin empezar** — no es trabajo a medias, es trabajo
   nuevo, y por eso no se abrió: los gestos de caza, pesca, saberes,
   relevamiento y exploración que anotó `bucle` (la chatarra y la cantera ya
   tienen el suyo); la legibilidad del árbol de 47 tecnologías; el suelo sin
   material bajo los pies; y los dos defectos de `veg` que piden medición de
   memoria (ocho vistas de impostor, el corte del sotobosque a 192 m).
4. **`capturas/` no está en el repo** (está en `.gitignore`): 204 archivos,
   incluidas las `base-*.png` que son el "antes" de todas las comparaciones y
   los bancos de medición. El dueño lo sabe y decidió dejarlo así.

## Trabajo a medias que se cerró al final

- **El tronco caído seguía negro.** `veg` había arreglado la iluminación de los
  sólidos pero no el albedo del tronco, y el relleno se multiplica por el
  albedo: 0,047 × 0,34 sigue siendo negro. Ahora 0,115, en rango de madera
  muerta a la intemperie. El detalle, en `bitacora-veg.md`.
- **`bancoDesglose()` de `agua`**, que nunca había podido completar por las
  recargas de los otros agentes.
- **La transición agua-costa**, verificada por mecanismo: son tres bandas
  —espuma, franja transparente a 0,5 m, agua cerrada a 1,8 m— y no un canto
  duro. La «piedra mojada» que `agua` se había anotado no hace falta:
  `Terreno.js:613` ya oscurece el lecho y bajar el alfa es lo que la deja ver.

## Herramientas que dejó la flota

- `.claude/flota/cadena-bucle.mjs` — resuelve una receta hacia atrás.
- `.claude/flota/bucle-recoleccion.mjs` — 5 casos de la tecla de acción.
- `capturas/feel-node.mjs` — banco de sensación de movimiento, en Node,
  determinista. `node capturas/feel-node.mjs`.
- `public/banco.js` — reloj de GPU. No está enganchado en `index.html`.

## Trampas de medición ya pagadas — leer antes de medir cualquier cosa

Esto es lo más caro que dejó la flota, porque cada una costó una sesión.

1. **Con el panel del navegador oculto, `requestAnimationFrame` no dispara** y
   el bucle del juego queda congelado: la corrida devuelve vacío sin decir por
   qué. Lo que sí funciona es mover la física a mano desde el script inyectado
   —`j.actualizar(1/60, entradaSintética)`— guardando y restaurando el estado
   del jugador alrededor.
2. **Con el panel visible, el bucle corre a ~1 cuadro por segundo.** Cualquier
   sistema que integre `dt` avanza cien veces menos de lo esperado y sus
   magnitudes parecen defectos. **Medir el `dt` que de verdad llega antes de
   llamar defecto a un número chico.**
3. **El terreno sintético no muestra todo.** El banco de `feel` corre contra una
   rampa perfecta: midió bien nueve defectos y fue incapaz de ver que el cuerpo
   salía despedido en las bajadas, porque una rampa perfecta no tiene por dónde
   despegar. Las dos mediciones hacen falta.
4. **Una recarga de Vite tira el contexto de audio** (`listo` vuelve a `false`)
   y hace falta un gesto real —un clic en el lienzo— para revivirlo. Comprobar
   también `audio.silenciado` antes de creerle a un `false` de `voz()`.
5. **La tecla Escape de la herramienta del navegador no llega a la página.** Ni
   con una sonda en fase de captura sobre `window`. La lógica de Escape hay que
   ejercitarla con eventos despachados.
6. **`getComputedStyle` sobre el elemento equivocado miente sin avisar.** La
   animación de la vital crítica vive en `.vital.critico .pista i`, no en el
   contenedor: medir el padre daba `animation: none` y parecía un defecto.
7. **El panel no compone con viewport emulado.** A 1280×720 la escena se dibuja
   en una esquina. Las capturas del HUD sirven para mirar, no para medir.

## Y una lección de método, que es la que más se repitió

**Tres de los siete agentes habían escrito mucho más de lo que decía su
bitácora.** El límite de tokens los cortó entre hacer el trabajo y anotarlo, así
que `vida` decía «paso 1 de 4» con el motor entero escrito, y `ui` daba por
pendiente un CSS que ya estaba en el archivo. Retomar leyendo sólo la bitácora
habría significado reescribir trabajo bueno.

**Al retomar un agente: leer su bitácora para el diagnóstico y lo descartado,
pero comprobar contra el código qué está hecho de verdad.**

---

## Qué se está haciendo

El dueño pidió mejorar **calidad visual y jugabilidad en todas sus facetas**,
hasta un punto en que pueda probarlo y sea una gran experiencia, para desde ahí
seguir mejorando. Se repartió el trabajo en siete agentes con **propiedad
exclusiva de archivos**, para que puedan correr en paralelo sin pisarse.

## Lo importante que hay que entender antes de retomar

**Los subagentes son locales a la sesión: mueren con ella y no se los puede
retomar desde otra.** Lo único que cruza de una sesión a la siguiente es lo que
está en disco. Por eso cada agente lleva una bitácora, y por eso existe este
archivo.

Para retomar no se "reconecta" con los agentes viejos: se **lanzan agentes
nuevos**, y a cada uno se le dice que lea su bitácora antes de trabajar. La
bitácora tiene el diagnóstico, lo hecho, el siguiente paso y lo ya descartado,
así que el agente nuevo no repite el trabajo caro.

## Reparto de archivos — innegociable, es lo que evita los conflictos

| Agente | Archivos propios | Bitácora |
|---|---|---|
| **luz** | `src/world/Cielo.js`, `src/engine/Posproceso.js`, `src/world/Tiempo.js` | `bitacora-luz.md` |
| **veg** | `src/world/Vegetacion.js`, `src/world/Sotobosque.js` | `bitacora-veg.md` |
| **agua** | `src/world/Agua.js`, `src/world/Terreno.js` | `bitacora-agua.md` |
| **feel** | `src/entities/Jugador.js`, `src/entities/Cuerpo.js`, `src/engine/Entrada.js` | `bitacora-feel.md` |
| **bucle** | `src/systems/*.js`, `src/world/Hornos.js`, `src/world/Obras.js` | `bitacora-bucle.md` |
| **ui** | `src/ui/*.js`, `index.html` | `bitacora-ui.md` |
| **vida** | `src/engine/Audio.js`, `src/entities/Fauna.js`, `src/entities/Peces.js` | `bitacora-vida.md` |

**Del coordinador, que ningún agente toca:** `src/main.js` y
`src/engine/Calidad.js`. Los agentes que necesitan una línea de cableado en
`main.js` dejan el parche exacto en `.claude/flota/pendiente-<nombre>.md`, y el
coordinador los aplica todos juntos al final. **Revisá si hay archivos
`pendiente-*.md` sin aplicar.**

Sin dueño y sin tocar: `src/world/Mundo.js`, `src/world/Limites.js`,
`src/world/Clima.js`, `src/util/captura.js`, `public/banco.js`, `tools/`.

## Los defectos que motivaron el reparto, con su evidencia

Medidos con capturas, no leyendo código. Las capturas de referencia están en
`capturas/base-*.png` y **no hay que borrarlas**: son el "antes" contra el que se
compara todo.

1. **El cielo es verde** a las 09:00 del 15 de febrero, y el paisaje está en
   penumbra como si fuera el crepúsculo — `base-alta-manana.png`. → agente luz
2. **El mediodía se quema a blanco**, con neblina lechosa que aplana el
   contraste — `base-alta-bosque.png`. → agente luz
3. **Nada tiene luz de relleno**: al atardecer los árboles son siluetas negro
   puro — `base-lago.png`. → agente luz
4. **Piedras y troncos caídos se dibujan negro puro** a pleno sol, en todos los
   presets — `base-alta-bosque.png`, `base-bosque.png`. Es el artefacto más feo
   del juego. Pista: en `docs/medicion-cuadro.md` consta que en una ronda de
   optimización se les puso `FrontSide` y se les cambió el BRDF a Lambert.
   → agente veg
5. **El pasto son triángulos planos** de un solo tono, sin doblarse y sin
   apoyarse en el suelo — `base-cumbre.png`. → agente veg
6. **Las copas son bolas de un solo verde**, sin oclusión interna. → agente veg
7. **El lago es una lámina de plástico celeste**, pese a tener Fresnel,
   absorción de Beer-Lambert y espejo ya escritos — `base-alta-manana.png`.
   → agente agua
8. **El suelo de cerca no tiene grano** y se le ve un patrón repetido de manchas
   alargadas — `base-cumbre.png`. → agente agua

## Línea de base de rendimiento

La placa de esta máquina **es** la de destino: `Intel(R) HD Graphics 4000`.
Medido con el reloj de GPU, árbol de trabajo limpio, preset Alta forzado:

| Resolución | Mpx | ms de GPU |
|---|---|---|
| 640×360 | 0,23 | **57,1** |
| 1280×720 | 0,92 | **88,3** |

Instrumento: `public/banco.js`, que **no** está enganchado en `index.html` —
hay que cargarlo a mano con `<script src="/banco.js">`. `window.bancoValidez()`
antes de creerle a cualquier número.

`docs/medicion-cuadro.md` tiene cuatro rondas de optimización documentadas, con
los resultados negativos incluidos. Terreno y sotobosque fueron el 77 % del
cuadro: **cualquier detalle nuevo ahí se paga caro.**

## Lo que le queda al coordinador

1. Aplicar los `.claude/flota/pendiente-*.md` sobre `src/main.js`.
2. **Volver a medir con el banco** y comparar contra los 57,1 / 88,3 ms de
   arriba. Si la flota agregó costo, decidir qué entra y qué se recorta por
   preset en `src/engine/Calidad.js`.
3. **Verificar en preset Baja, no en Alta.** El dueño juega en una HD 4000 y el
   gobernador termina en Baja o Mínima; de nada sirve que se vea bien en Alta.
4. Sacar una tanda de capturas finales y compararlas contra `base-*.png`.
5. Actualizar el README: la sección `## Estado real` lista defectos conocidos
   que esta flota resuelve, y quedaría mintiendo.
6. Commitear. **Ningún agente commitea; eso es del coordinador.**

## Cómo se corre

Servidor de desarrollo con la herramienta de vista previa, configuración
`survibar` en `.claude/launch.json`. Ojo: el puerto 5173 puede estar ocupado por
otra sesión y Vite se corre a 5173. Confirmá el puerto en los registros del
servidor antes de navegar, porque la vista previa informa un puerto de proxy que
puede no responder.

La creación de personaje bloquea el arranque: hasta que no se elige, `main.js`
espera en `await personaje.abrir()` y `window.SurviBar` no existe. La elección
queda guardada en `localStorage` bajo `survibar.aspecto.v2`.
