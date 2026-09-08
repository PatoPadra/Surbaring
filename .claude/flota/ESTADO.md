# ESTADO DE LA FLOTA — leer esto primero

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
