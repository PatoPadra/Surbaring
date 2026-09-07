# Bitácora — flora (ronda 3, fase 3)

> Se escribe mientras se trabaja, no al final (regla 5 de `RONDA3.md`).
> Archivos propios: `src/world/Vegetacion.js` y `src/world/Sotobosque.js`.
> Nada más. Nada commiteado.

## Diagnóstico — leído del código antes de tocar una línea

### 1 · La corteza: 63 especies muestreando UN texel blanco

`pintar()` (`Vegetacion.js:1269`) recibe `modoUV` con valor por defecto
`'madera'`, y en ese modo **escribe la misma constante en los dos canales de UV
de todos los vértices**:

```js
const UV_MADERA = [0.95, 0.05];
...
uv[i * 2] = UV_MADERA[0];
uv[i * 2 + 1] = UV_MADERA[1];
```

O sea: la geometría del tronco **sí trae UV cilíndrica** —`troncoCurvo()` usa
`CylinderGeometry(rTope, rBase, altura, 6, 7)`, que parametriza u alrededor y v
en altura— y `pintar()` **la pisa**. El destino (0,95 · 0,05) cae en el centro
del parche opaco que `atlasFollaje()` reserva con
`c.fillRect(N*0.90, N*0.90, N*0.10, N*0.10)`, es decir **51×51 px de blanco
puro**. Todo el tronco, todas las ramas y **todas las cañas** leen ese único
texel.

Quién pasa por `'madera'` hoy: el tronco, las 5-7 ramas de cada árbol y las 14
cañas + sus hojas del arquetipo `cana` (esas últimas con `colHoja`, no con
`colorTronco`). Los únicos que van por `'hoja'` son las hojas lanceoladas de la
caña; el follaje de tarjetas no pasa por `pintar()` en absoluto (lo arma
`tarjetasFollaje()` con su propia ventana de atlas).

**Por qué es la mejora más barata que hay:** el material ya tiene `map`, ya lee
una textura por fragmento y ya multiplica por `vertexColors`. Poner un patrón de
corteza en escala de gris en ese parche **no agrega ni una lectura ni una
instrucción de ALU**: cambia el valor del texel que ya se estaba leyendo. Y como
el tono de especie viaja en el atributo `color` (`colorTronco` de `flora.json`,
presente en las 63 especies), un patrón gris multiplicado por ese color da
corteza por especie sin un byte de textura extra.

**El detalle que hay que respetar para no regresar:** hoy el texel vale 1,0 y el
albedo del tronco es exactamente `colorTronco`. Cualquier patrón tiene media
< 1 y **oscurece el tronco**. Es el mismo pozo en el que ya cayó la ronda 1 con
el tronco caído del sotobosque (albedo 0,047 → negro). Hay que compensar el
color de vértice con 1/media, y la media hay que tomarla **en lineal**, no en
sRGB: la textura es `SRGBColorSpace`, así que el shader decodifica antes de
multiplicar.

### 2 · El parche blanco ya se derrama sobre el follaje (defecto que nadie anotó)

`tarjetasFollaje()` elige la ventana de atlas de cada tarjeta con
`u0 = Math.random()*0.55`, `uw = 0.30 + Math.random()*0.14`, y usa `uw` también
en V. Máximo alcanzado: **0,99**. El parche opaco empieza en 0,90. O sea que hay
tarjetas de follaje que muestrean el cuadrado blanco: se ven como una mancha
opaca del tinte de la hoja en medio de la copa. Cuenta analítica sobre esas dos
distribuciones: **~0,58 % de las tarjetas** tocan el parche con alguna esquina.
Poco, pero es gratis eliminarlo, y **si agrando el parche para meter corteza el
número crece rapidísimo** (con el parche al 20 % pasa a 5,3 %). Ése es el motivo
por el que la corteza no puede simplemente «ocupar más esquina».

### 3 · Los impostores — la cuenta de VRAM que falta, hecha

Confirmado leyendo: `hornearImpostor()` ya **no** son ocho vistas. Hoy
`COLS = 4, FILAS = 4` → **16 vistas**, teja de 128×192, atlas de **512×768**.
El defecto de `SEGUIR.md` está tocado. Lo que nunca se contó es la memoria.

Por especie instanciada:

| concepto | cuenta | MiB |
|---|---|---|
| color del render target | 512·768·4 B | 1,500 |
| sus mipmaps (`generateMipmaps: true`) | ×1/3 | 0,500 |
| **buffer de profundidad** | 512·768·4 B | **1,500** |
| matrices+color de 7000 impostores | 7000·19·4 B | 0,507 |
| matrices+color de 600 mallas | 600·19·4 B | 0,044 |
| **total por especie** | | **4,051** |

Con `CUPO_ESPECIES = 30`: **121,5 MiB**. Los atlas de follaje suman
2·512·512·4·4/3 = **2,67 MiB** más.

El comentario de `CUPO_ESPECIES` declara 76,5 MiB. La diferencia son
**45,0 MiB de buffers de profundidad que nadie contó**: `WebGLRenderTarget`
crea uno por objetivo (`depthBuffer: true` por defecto), el objetivo queda vivo
en `horneado.objetivo` y nunca se libera, y con `stencilBuffer: false` el
formato es `DEPTH_COMPONENT24`, que el driver almacena padeado a 32 bits.
Verificado en `three.module.js`: `getInternalDepthFormat()` y
`setupRenderBufferStorage()`.

**El agujero, medido:** los 24 MB de techo de la ronda 3 —de los que fauna gastó
16,00— conviven con **121,5 MiB que la vegetación ya gastaba antes de que la
ronda empezara**, y que **ningún preset baja**: `Calidad.recortarInstancias()`
sólo toca `malla.count`; el número de especies, el tamaño del atlas y los
buffers de instancia son idénticos en Alta y en Mínima.

**Y por eso no toco el número de vistas.** La medición dice que las vistas no
son el problema: el 37 % del gasto es el buffer de profundidad, que **sólo hace
falta mientras se hornea** y después queda ocupando lugar para siempre. Bajar de
16 a 8 vistas ahorraría 30 MiB y costaría el pestañeo de 45° que la ronda
anterior arregló; compartir un solo buffer de profundidad ahorra **43,5 MiB sin
tocar un píxel de la imagen**. Ver «Hecho».

### 4 · El follaje es de una sola capa y además está repartido al azar uniforme

`atlasFollaje('lamina')`: 620 elipses con centro uniforme sobre todo el lienzo.
Un dosel real está **agrupado** —matas de hojas con huecos entre ellas—, y el
azar uniforme da sopa homogénea: la silueta recortada por alfa sale pareja, sin
grumos ni claros. `'aguja'`: 54 ramillas, también uniformes, y todas del mismo
rango de verde claro (190-250).

Lo que se puede poner ahí cuesta **cero por cuadro**: se dibuja una vez por
clase al arranque. Lo único que sí se paga por cuadro es la **cobertura de
alfa**: con `alphaTest: 0.28` un fragmento que pasa el corte paga el Lambert
entero. Así que la regla de esta parte es *más capas, misma cobertura*.

### 5 · Sotobosque: hoy no tiene un solo `map`

`Sotobosque.js` es Lambert + color por vértice, sin textura. Es la pieza con más
instancias del juego (30.000 de tope, ~4.500 reales) y ya bajó al 4,5 % del
cuadro. Agregarle una textura es sumar una lectura por fragmento a la pieza que
más fragmentos emite. **Decisión tomada de entrada: no se toca** salvo que
aparezca una razón medida. Ver «Descartado».

---

## Decisiones, con el motivo — escritas antes de editar

### D1 · La corteza va en una franja vertical, no en un cuadrado más grande

Por el punto 2: agrandar el cuadrado de la esquina multiplica las tarjetas de
follaje contaminadas. La salida es al revés: **acotar la ventana de las tarjetas
a [0 · 0,86]** y quedarme con la franja `u ∈ [0,875 · 1,0]`, **64 px de ancho por
512 de alto**. Tres cosas a favor:

1. Elimina el derrame del punto 2 (las tarjetas dejan de poder tocar la franja).
2. Una franja alta es la forma correcta para corteza: las grietas corren a lo
   largo del tronco, así que quiero muchos texels en V y pocos en U.
3. No cambia el aspecto del follaje: el dibujo es estadísticamente homogéneo, y
   muestrear [0 · 0,86] en vez de [0 · 0,99] toma lo mismo.

### D2 · La corteza se genera por píxel con `createImageData`, no con primitivas

Motivo: necesito **la media exacta en lineal** para compensar el brillo (punto
1), y necesito poder medirla en Node sin inventarle comportamiento a un lienzo
de mentira. Un bucle por píxel sobre 64×512 es aritmética pura: corre igual en
Node y en el navegador, y el propio código devuelve la media que midió, así que
la compensación **no depende de que yo haya calculado bien nada a mano**.

El follaje, en cambio, **se queda con las primitivas del lienzo**: reescribirlo
con un rasterizador propio cambiaría un aspecto ya afinado que no puedo mirar
(regla: no abro el navegador). El riesgo no vale el rédito.

### D3 · Repetición vertical en ping-pong, y por qué no puede ser cualquier número

La franja tiene 512 texels de alto. Si un tronco de 15 m la usa entera, la
grieta mide 3 cm de ancho y 3 m de largo: escala inconsistente entre un alerce y
un arbusto. La solución es repetir el patrón K veces a lo largo del tronco.

Un `frac()` por vértice **no sirve**: el vértice donde v salta de 0,99 a 0
genera un triángulo que interpola la textura al revés, de punta a punta. Con una
onda triangular (ping-pong) pasa lo mismo salvo que **el pliegue caiga
exactamente sobre un anillo de vértices**. `CylinderGeometry` pone anillos en
`v = i/segs`, y los pliegues de la onda caen en `v = n/K`, así que la condición
es **K = segs/m con m entero**. Para el tronco (`segs = 7`) los valores legales
son 7 · 3,5 · 2,33 · 1,75 · 1,4 · 1,17 · 1. Para las ramas y las cañas
(`heightSegments = 1`) el único legal es **K = 1**.

Como la corteza es de grietas verticales, el espejado del ping-pong (arriba
abajo) es invisible; un `frac()` con patrón periódico costaría lo mismo y
tendría el mismo problema de pliegue.

### D4 · Periódica en U por construcción

El cilindro duplica los vértices de la costura (u = 0 y u = 1 existen los dos).
Si el patrón no es periódico en U, la costura se ve como una línea. Se resuelve
generando el patrón con funciones periódicas en x, no recortando después.

### D5 · Un solo buffer de profundidad para los 30 hornos

Es el resultado del punto 3. `THREE.DepthTexture` compartida y asignada a los 30
`WebGLRenderTarget`: `setupDepthRenderbuffer()` de three, si el objetivo trae
`depthTexture`, **no crea renderbuffer** y adjunta la textura
(`three.module.js`, `setupDepthTexture`). Se hornea de a uno, así que nunca hay
dos objetivos escribiendo la misma profundidad a la vez.

Ahorro: 29 × 1,5 MiB = **43,5 MiB**, sin tocar ni una vista ni un píxel.

### D6 · Cero regresión: qué cambia por cuadro y qué no

| cambio | costo por cuadro |
|---|---|
| corteza con patrón | **cero**: mismo material, misma lectura, mismo texel count. Y mejora la selección de mip: hoy la derivada de UV es 0 y el tronco lee siempre el nivel 0. |
| franja de corteza + ventana acotada | **cero**: sólo cambian números de UV. |
| follaje por capas | **cero si la cobertura de alfa no sube**. Es lo que hay que medir. |
| profundidad compartida | **cero**: es memoria, no trabajo por cuadro. |

---

## Hecho

### H0 · El archivo volvió a correr (antes que nada)

La sesión anterior se cortó a mitad de una edición: `UV_MADERA` sacada y sus dos
usos vivos en `pintar()`. `npx vite build` pasaba igual —es una referencia en
tiempo de ejecución— pero el juego tiraba `ReferenceError` con el primer tronco.
Se cerró **por el lado bueno**: el camino de corteza terminado, no la constante
restaurada. No queda ninguna referencia a `UV_MADERA` en `src/`.

### H1 · La corteza, cableada de punta a punta

- **`pintar()` cambió de firma**: `pintar(geo, color, flexion, opciones)` con
  `{ variacion, modoUV, clase, repV }`. Eran cinco posicionales y hacían falta
  siete; con objeto, además, cada llamador dice en el sitio qué está pidiendo.
  Los cuatro llamadores (`Vegetacion.js:1400·1410·1423·1444` de antes) están
  actualizados.
- **`claseHojaDe(esp)`**, nueva y con una sola definición. La usan `_crearLote()`
  para el `map` del material y `construirPlanta()` para las UV. Era el riesgo que
  el jefe marcó: si el tronco compensa con la media de un atlas y muestrea de
  otro, sale con el brillo mal **y sin ningún error**. Ahora no hay dos
  expresiones que puedan separarse.
- **U** va de `u0` a `u1` sin envolver. Un `frac()` mandaría a 0 la segunda
  columna de vértices de la costura (el cilindro la duplica: existen u=0 y u=1) y
  dejaría un cuadrilátero recorriendo la franja entera al revés.
- **V** va en ping-pong con `repV`, y `repV` se eligió por anisotropía, no a ojo
  — ver «Números medidos».
- **El derrame del punto 2 quedó cerrado**: `FOLLAJE_U_MAX` llega ahora a
  `tarjetasFollaje()` **y** al camino `'hoja'` de `pintar()`, que era el segundo
  lugar que elegía ventana y que en el diagnóstico no estaba anotado (llegaba
  hasta 0,97). Las dos ventanas se acotan con `u0 = random·(FOLLAJE_U_MAX − uw)`,
  que respeta el ancho sorteado en vez de comprimirlo.

### H2 · Dos defectos de costura que el diagnóstico no había visto

D4 decía «periódica en U por construcción». Al escribirla resultó que **no lo
era**, en dos términos de tres:

1. `ci = floor(xp·nSurcos + 0.5)` daba `0` en xp≈0 y `nSurcos` en xp≈1. Son la
   **misma placa partida al medio por la costura**, y cada mitad recibía un
   brillo distinto de `hash2(ci, cj)`: una raya vertical a lo largo del tronco.
   Se cierra con `% nSurcos`.
2. Las dos capas de fibra indexaban por la **columna absoluta del lienzo**
   (`hash2(x + xIni, …)`), que no es periódica en nada. Se cierra indexando por
   `xi`, la columna reducida al módulo de una vuelta.

Los surcos y las placas sí cerraban solos, por el `dd -= Math.round(dd)`.

### H3 · La guarda pasó a ser de los dos lados

Era de uno solo (izquierda) y por eso `u1` valía 1: el borde derecho de la franja
es el borde del lienzo, donde `ClampToEdge` repite el último texel en vez de
seguir la vuelta, y el filtro bilineal metía medio texel de asimetría justo en la
costura. Ahora la franja de 64 px se reparte en 8 de guarda + **48 útiles** + 8
de guarda, y las dos guardas llevan la continuación periódica del patrón, no una
copia del borde. Comprobado: la diferencia peor entre una columna de guarda y la
columna útil que le corresponde una vuelta más allá es **0/255**, en las dos
clases y en las dos guardas.

Cuesta 8 texels de resolución por vuelta (56 → 48). Se paga con gusto: es lo que
convierte «la costura casi no se ve» en «la costura no existe».

### H4 · El flip en V, razonado explícitamente (era la trampa ya pagada)

`THREE.CanvasTexture` sube con `flipY`, así que **la fila 0 del lienzo termina en
v = 1**: `yn` de `dibujarCorteza()` corre al revés que la v del tronco. Es
indiferente —la corteza es estadísticamente simétrica arriba-abajo, y las grietas
son verticales— pero queda escrito.

Lo que importa es **por qué acá no se repite la trampa del parche**: la nota
vieja de `UV_MADERA` tenía que poner V en 0,05 y no en 0,95 porque el parche
ocupaba **una esquina** del lienzo, y con 0,95 los troncos muestreaban zona
transparente, el recorte por alfa los borraba y desaparecían enteros. La franja,
en cambio, **ocupa el alto entero del lienzo** (`x = 448..511`, `y = 0..511`), así
que en V no hay adentro ni afuera: cualquier v cae sobre corteza opaca. La
ambigüedad que costó una sesión no existe en esta geometría. En U tampoco, porque
la ventana la declara la misma función que dibuja (`dibujarCorteza` devuelve
`{media, max, u0, u1}`) en vez de recalcularse aparte.

### H5 · D5, la profundidad compartida — y devuelta

Hecho, y con una vuelta de tuerca sobre lo que decía D5. Compartir una
`THREE.DepthTexture` entre los treinta hornos ahorra 43,5 MiB, pero deja la
trampa que el jefe hizo bien en preguntar: **`deallocateRenderTarget()` de three
llama a `renderTarget.depthTexture.dispose()`** (`three.module.js:24508`), así
que con la textura compartida y viva, un `objetivo.dispose()` sobre **uno** de
los treinta le saca la profundidad a los otros veintinueve. Hoy nadie llama a ese
dispose —`Vegetacion.dispose()` sólo suelta geometría y material— pero queda
cargada para el que venga.

La salida cierra las dos cosas de una vez: **la profundidad sólo hace falta
mientras se hornea**. Los dieciséis viewports se dibujan de a uno en el
constructor y después la cartelera lee el color y nada más. Así que se comparte
durante el horneado y se **libera al terminar el último**
(`liberarProfundidadHorno()`, llamada desde el constructor apenas cierra el
bucle de lotes). Gana dos veces: el ahorro sube de 43,5 a **45,0 MiB** —no queda
ni una copia— y la trampa desaparece, porque cuando el constructor termina ningún
objetivo referencia nada compartido.

Detalles de mecanismo, verificados en `node_modules/three/build/three.module.js`
y no de memoria:

- `setupDepthRenderbuffer()` (`:25744`) salta el renderbuffer y adjunta la
  textura **sólo si** el objetivo trae `depthTexture` y `__autoAllocateDepthBuffer`
  no está definido. Ese campo lo pone únicamente `setRenderTargetTextures()`
  (`:30956`), que este código no usa.
- `setupRenderTarget()` llama a `setupDepthRenderbuffer()` **mientras compone el
  framebuffer** (`:26044`), o sea en el primer `setRenderTarget`. Por eso la
  textura va en el **descriptor de construcción**: puesta después, no la mira
  nadie y cada objetivo se crea su renderbuffer igual. El instrumento tiene una
  guarda que falla si alguien la saca del descriptor.
- `new THREE.DepthTexture(w, h)` sale con `DepthFormat` + `UnsignedIntType`
  (`:18107`) → `DEPTH_COMPONENT24`, el mismo formato que el renderbuffer que
  reemplaza: no hay regresión de formato escondida.

**La contracara, escrita para que se sepa:** después de liberar, estos objetivos
**no se pueden volver a usar para renderizar**. Su framebuffer conserva un
adjunto de profundidad que ya no existe, y `setupDepthRenderbuffer()` no se
vuelve a llamar sobre un objetivo ya compuesto. Si alguna vez hace falta
rehornear en caliente —cambio de estación, LOD dinámico— hay que **crear el
objetivo de nuevo**, no reusarlo. Está en el comentario de `profundidadHorno()`,
al lado del código, que es donde lo va a leer quien lo necesite.

## Números medidos

### D5 · profundidad de los hornos

Instrumento: `scratchpad/medir-profundidad.mjs`, contra el three real del
proyecto (r0.169). Sin contexto GL no hay VRAM que medir; lo que se comprueba es
el contrato del que depende el ahorro.

| | |
|---|---|
| objetivos | 30 |
| texturas de profundidad distintas | **1** |
| formato / tipo | `DepthFormat` / `UnsignedIntType` → `DEPTH_COMPONENT24` |
| tamaño declarado | 512×768 = el del objetivo (si no coincidiera, three la redimensiona y la reasigna) |
| por objetivo | 512·768·4 B = 1,500 MiB |
| **antes** | **45,0 MiB** |
| compartiendo | 1,5 MiB |
| **después de liberar** | **0 MiB → ahorro 45,0 MiB** |
| objetivos que sueltan la referencia | 30/30 |
| eventos de `dispose` | 1 (una sola liberación) |
| segunda llamada | 0 objetivos, sigue en 1 dispose → idempotente |

Con esto la vegetación baja de los 121,5 MiB del diagnóstico a **76,5 MiB**, que
es justo lo que el comentario de `CUPO_ESPECIES` venía declarando y no era cierto.

### La corteza

Instrumento: `scratchpad/medir-corteza.mjs`. **No es un banco** —el banco lo
escribe el jefe—: es el aparato con el que tomo estos números. Recorta las
funciones del archivo real por coincidencia de nombre y balance de llaves y las
evalúa **tal cual están escritas**, así que no hay una segunda copia del
algoritmo que pueda quedar desincronizada. El lienzo es de mentira porque
`dibujarCorteza` es aritmética pura sobre un `ImageData`: no rasteriza nada (D2).
Guarda de cobertura propia: falla si `putImageData` no se llamó, y verifica que
las 64 columnas quedaron escritas y que la columna de la izquierda de la franja
sigue con alfa 0 (follaje intacto).

### La franja

| | latifoliada | conífera |
|---|---|---|
| columnas escritas | 64/64 | 64/64 |
| ventana útil | u ∈ [0,890625 · 0,984375] = texels 456-503 | ídem |
| texels por vuelta | 48 | 48 |
| gris sRGB (min · media · max) | 154 · 232,3 · 255 | 24 · 206,6 · 255 |
| **media en lineal** | **0,81685** | **0,65222** |
| **compensación 1/media** | **1,2242** | **1,5332** |
| costura, peor diferencia | **0/255** izq · **0/255** der | ídem |

La conífera va mucho más contrastada a propósito: son placas gruesas de alerce o
ponderosa, contra la corteza lisa y estriada de un Nothofagus.

### Albedo del tronco, las 63 especies

- **La media no se mueve**: por construcción `compensación · media = 1`, y la
  compensación se toma **en lineal**, que es donde multiplica el shader después
  de decodificar el texel sRGB.
- Pico antes (texel 1,0): **0,837**. Pico ahora (texel más claro de la franja):
  **1,025**, y sólo en el canal rojo de la especie de tronco más claro de las 63
  (`morchella`, `#c8b48a`). Los dos números incluyen el `×1,45` del fragmento.
  Un 2,5 % de desborde en el texel más claro de la especie más clara: no se
  compensa, porque hacerlo oscurecería las otras 62 para nada.

### `repV`, y por qué 1,75 y no otro

Legales (`repV = segs/m`, m entero, `segs = 7`): 7 · 3,5 · 2,33 · 1,75 · 1,4 ·
1,17 · 1. Se elige por **anisotropía**: la franja son 48 texels por vuelta contra
512 a lo alto, el tronco mide `0,52·alturaRef` y su perímetro `2π·0,032·alturaRef`,
así que la razón de densidad de texels queda en `4,12·repV`. La textura va con
`anisotropy = 8`: **repV = 1,75 → 7,2**, que el filtro cubre entero; el siguiente
legal (2,33) da 9,6 y ya no llega. Ramas y cañas tienen `heightSegments = 1`, así
que su único legal es **1**.

Verificado sobre la geometría real (`CylinderGeometry` de three, no una maqueta),
contando los enteros que caen **estrictamente adentro** de cada franja de anillo
a anillo del torso —que es exactamente el defecto que hace ilegal un `repV`:

| | pliegues adentro de un cuadrilátero | salto de v anillo a anillo |
|---|---|---|
| tronco `segs=7 repV=1,75` | **0** | 0,2500 (ideal 0,2500) |
| rama `segs=1 repV=1` | **0** | 1,0000 (ideal 1,0000) |
| caña `segs=1 repV=1` | **0** | 1,0000 (ideal 1,0000) |
| tronco `repV=2,0` (ilegal, de control) | **1** | — |

El caso de control importa: sin él, «0 pliegues» no demuestra que el detector
sepa ver un pliegue.

Las **tapas** del cilindro sí pueden plegarse: sus UV vienen de un mapeo de disco
y no de la parametrización en altura. Son los seis triángulos del disco de arriba
—que queda adentro del follaje— y los seis de abajo —que quedan bajo tierra—.
Se deja así: cerrarlo pediría `openEnded` y eso cambia la geometría de las 63
especies para arreglar algo que no se ve.

### H6 · El follaje de tres capas, calibrado contra su cobertura de alfa

Las tres capas ya estaban escritas; lo que faltaba era el número, y el número
**encontró una regresión que la intención no veía**. D6 decía «cero si la
cobertura de alfa no sube». Con el reparto que había escrito, subía:

| primer reparto | Δ cobertura de la ventana |
|---|---|
| lámina 150 · 300 · 190 | **−16,1 %** (demasiado rala: rompía la promesa al revés) |
| acícula 16 · 38 · 20 | **+27 a +38 %** ← regresión pura |

La acícula era el error de fondo, y vale anotarlo porque es contraintuitivo:
**una ramilla no cuesta como una hoja**. Su tinta va con `n · largo · grosor²`,
no con `n`, así que la capa de sombra —la más larga y la más gruesa de las tres—
pesa el doble de lo que sugiere su cuenta de 16. Repartir «a ojo, parecido» daba
un 32 % de tinta de más.

Reparto final, calibrado contra la medición:

- **lámina 173 · 345 · 218** (736 hojas, contra 620 de una capa)
- **acícula 12 · 28 · 16** (56 ramillas, contra 54 de una capa)

### Cobertura de alfa del follaje — el número que D6 pedía

Instrumento: `scratchpad/medir-follaje.mjs`. Recorta las funciones de dibujo
**reales**, viejas (`git show HEAD:` → `atlasFollaje`) y nuevas, y las corre
contra un lienzo que sabe rasterizar las dos únicas primitivas que usan: elipse
rellena y segmento de punta recta (`lineCap: butt`, el de por defecto). El alfa
se compone `source-over`, que es lo que hace el lienzo de verdad. El antialias se
aproxima con 4×4 submuestras por texel: no es el rasterizador de Chrome, pero es
**el mismo para las dos versiones**, y lo que se compara es la diferencia.
Guarda de cobertura: falla si una versión dibujó menos de 50 primitivas.
**200 atlas por caso**; el error declarado es el de **atlas a atlas**, no el de
las 400 ventanas de un atlas, que están correlacionadas entre sí. Hicieron falta
los 200: con 48 el mismo código daba −0,70 pp en una corrida y +0,16 pp en la
siguiente, o sea que a esa cuenta el signo del resultado todavía era ruido.

**La medida que gobierna el costo es la de la VENTANA, no la del atlas entero.**
Una tarjeta muestrea una ventana de `uw ∈ [0,30 · 0,44]`, no el lienzo completo, y
las dos medidas se separan: el agrupamiento en matas concentra el follaje en
`x ∈ [0,04 · 0,90]` y las ventanas paran en 0,86, así que la ventana ve más
densidad que el promedio del lienzo. Medir el atlas entero habría dado por bueno
un reparto que en la ventana subía 8,5 %. Es la trampa de medición de esta fase.

| | atlas entero | **ventana de tarjeta** |
|---|---|---|
| lámina, antes (620, 1 capa) | 23,39 % ± 0,03 | **26,31 % ± 0,07** |
| lámina, ahora (736, 3 capas) | 21,51 % ± 0,04 | **25,94 % ± 0,22** |
| **Δ lámina** | −8,0 % | **−0,37 pp ± 0,23 (−1,4 %)** |
| acícula, antes (54, 1 capa) | 7,46 % ± 0,02 | **9,21 % ± 0,07** |
| acícula, ahora (56, 3 capas) | 7,06 % ± 0,02 | **8,99 % ± 0,13** |
| **Δ acícula** | −5,2 % | **−0,22 pp ± 0,15 (−2,4 %)** |

**Las dos clases quedan por debajo de la línea de base**, cada una a ~1,5 errores
estándar de cero. El presupuesto de cero regresión se cumple con el número y no
con una promesa: hay *menos* fragmentos pagando el Lambert que antes, con tres
estratos en vez de uno. Y queda dicho lo que el número no dice: −1,4 % y −2,4 %
son, en rigor, **indistinguibles de cero**. Eso es exactamente lo que se pedía —
misma cobertura, más capas—, no una mejora de rendimiento que no hay que
prometerle a nadie.

## Dos números de este diagnóstico, corregidos por el jefe de la fase

> Ninguno cambia una decisión —las dos decisiones eran correctas—, pero los dos
> se van a releer, y esta ronda ya pagó caro un número que nadie volvió a mirar.

**1 · El derrame del punto 2 era 0,95 %, no 0,58 %.** El cálculo está hecho del
lado equivocado del flip. `CanvasTexture` hereda `flipY = true` de `Texture`
(`three.module.js:2067`, y `CanvasTexture` no lo toca), así que el parche que
`fillRect(N·0,90, N·0,90, …)` dibuja **abajo** a la derecha del lienzo queda en
`v ∈ [0 · 0,10]` de la textura, no en `[0,90 · 1]`. Es exactamente lo que decía
el comentario de `UV_MADERA`. La condición no es «`u0+uw > 0,90` **y**
`v0+uw > 0,90`» sino «`u0+uw > 0,90` **y** `v0 < 0,10`». Monte Carlo con 2·10⁷
muestras: **0,573 %** con el supuesto viejo y **0,954 %** con el flip bien puesto.
El defecto era **1,7× más grande** de lo reportado, o sea que D1 estaba **más**
justificada, no menos.

**2 · La comparación con «bajar de 16 a 8 vistas» estaba en bases distintas.**
Los 43,5 MiB de compartir la profundidad incluyen la profundidad; los 30 MiB de
bajar a 8 vistas cuentan **sólo color + mipmaps**. En la misma base, 8 vistas
(atlas 512×384) bajan color, mipmaps **y** profundidad de 3,5 a 1,75 MiB por
especie: **52,5 MiB**, más que los 43,5. La conclusión igual se sostiene, pero
por el otro motivo: compartir la profundidad es **gratis en imagen** y bajar las
vistas cuesta el pestañeo de 45° que la ronda anterior arregló. Y una vez hecha
la liberación, bajar a 8 vistas ya sólo ahorraría los 30 MiB de color+mipmaps,
porque la profundidad ya no está. **La decisión era la correcta; el número que
la justificaba, no.**

## Descartado, con el motivo

- **Tocar `Sotobosque.js`. Confirmado: no se toca, y no se abrió el archivo.**
  Es la pieza con más instancias del juego (30.000 de tope, ~4.500 reales) y hoy
  no tiene un solo `map`: es Lambert con color por vértice. Agregarle textura es
  sumar **una lectura por fragmento a la pieza que más fragmentos emite**, y ya
  bajó al 4,5 % del cuadro en la ronda 2. El rédito de imagen de esta fase está
  en el 22 % de los árboles, no en el 4,5 % del sotobosque, y el presupuesto es
  cero regresión. Sube al debe de la ronda 4 sólo si aparece una medición que
  diga otra cosa.
- **Mover el número de vistas del impostor** (`COLS = 4, FILAS = 4`). Ver punto 3:
  el gasto grande no estaba ahí. Bajar de 16 a 8 vistas ahorraba 30 MiB y costaba
  el pestañeo de 45° que la ronda anterior arregló; la profundidad compartida
  ahorró **45,0 MiB sin tocar un píxel**.
- **Agrandar el parche de la esquina** en vez de poner una franja. Ver D1: con el
  parche al 20 %, las tarjetas de follaje contaminadas pasaban de 0,58 % a 5,3 %.
- **Cerrar el pliegue de las tapas del cilindro con `openEnded`.** Cambiaría la
  geometría de las 63 especies para arreglar seis triángulos que quedan adentro
  del follaje y seis que quedan bajo tierra.
- **Compensar el 2,5 % de desborde de albedo** de la especie de tronco más claro.
  Oscurecería las otras 62 para nada.

## Siguiente

1. Que el jefe escriba el banco y lo corra. Los tres instrumentos de medición
   están en el scratchpad de la sesión y **no son bancos**: el jefe los puede
   leer para saber qué se midió, pero el banco es suyo.
2. `pendiente-r3-flora.md` tiene lo único que quedó afuera de mis dos archivos.
3. Nada más de esta fase. `Sotobosque.js` no se tocó y no se va a tocar.
