# Bitácora · ronda 7, fase 6 · `cielo`

Agente `cielo`. Encargo: `RONDA7.md`, sección «FASE 6 · cielo», con la nota «El banco,
contra la base». Banco: `banco-r7-fase6.mjs` (Node) y `.navegador.js` (la corre el
coordinador). Falsador: `banco-r7-fase6.falsar.mjs`.

## 15/9 · lectura

Leído entero: la carta de la fase, las dos mitades del banco, el falsador, `Cielo.js`,
`HUD.js`, `LEEME.md` y `ReadMe` del catálogo. Además, sin tocar: `main.js` (el orden de
los pases, la cámara, el bucle), `Tiempo.js` (la fecha es UTC; `_exposicion`),
`Codice._pintarGeografia()`, `Agua.dibujarReflejo()`, `captura.js`, `Jugador.js` (la
cámara).

Lo que sale de leer, antes de escribir nada:

- **`Tiempo.js` importa `posicionSolar` de `Cielo.js`**, y los bancos de otras fases
  cargan `Tiempo.js` en Node. `Cielo.js` no puede tener nada a nivel de módulo que
  explote en Node: ni un `import` estático de JSON (Node pide `with { type: 'json' }`),
  ni una promesa rechazada sin atajar. Ningún módulo que carguen los bancos importa JSON
  estático: sólo `main.js`, que en Node no se carga.
- **La tabla de estrellas se carga con `import()` dinámico**, como `main.js` hace con
  `caza.json`. En Vite anda; en Node se rechaza y se ataja. El banco Node no necesita
  las estrellas dentro de `Cielo`: `direccionDe` recibe AR y Dec, y la tabla la lee él.
- **El HUD no necesita a `main.js` para saber adónde se mira.** `Jugador` pone la cámara
  con `rotation.set(cabeceo, giro, balanceo)` en orden YXZ, y el HUD ya recibe
  `jugador`. La dirección es (−sen giro·cos cabeceo, sen cabeceo, −cos giro·cos
  cabeceo), la misma que da el rumbo de la brújula.
- **El domo sigue a la cámara** (`cielo.malla.position.copy(camara.position)`, en
  `main.js` y en `captura.js`). Si las estrellas son hijas de la malla, la siguen solas.
- **Los pases:** `RenderPass` → oclusión → resplandor (umbral 0,86, en HDR) →
  `OutputPass` (ACES y sRGB) → FXAA → color. Una estrella muy por encima de 0,86 en HDR
  derrama resplandor alrededor, y el banco cuenta como inventado cualquier punto con 20
  de contraste a más de 0,5° (≈ 4,5 px con el campo de 62° a 576 px) de toda estrella
  del catálogo. Las estrellas tienen que ser chicas y no tan pasadas de 0,86.
- **Los programas iguales de día y de noche:** un objeto con `visible = false` de día
  compila recién cuando se prende. Las estrellas quedan siempre visibles y se apagan en
  el shader.
- **Baja no tiene resplandor** (`Calidad.js`, `resplandor: false`), y el banco mide en
  Baja. En Alta y Media sí: ahí una estrella muy pasada de 0,86 derrama halo.
- **La exposición de noche** es 2,24/1,54 · 0,78 = 1,13, por (1 − 0,1·nubosidad). ACES de
  three multiplica por exposición/0,6: un valor lineal v llega a la curva como 1,89·v.
  Cuentas a mano con la curva de three (gris, sin la matriz de color): v = 0,014 (el
  fondo del cielo de noche) sale en ~16/255; v = 0,053 en 58; v = 0,53 en 206; v = 1,6 en
  240; v = 5,3 en 252. Sirve para calibrar las estrellas sin navegador.

## 15/9 · la luna, prototipo contra JPL

`scratchpad/proto-luna.mjs`. Efeméride de baja precisión del *Astronomical Almanac*
(longitud con seis términos, latitud con cuatro, paralaje con cuatro), tiempo sidéreo de
Meeus 12.4, paralaje topocéntrica con la latitud geocéntrica y los 800 m. Sol de baja
precisión del mismo Almanac para la fase. Peor de las diez filas:

| variante | posición | iluminación |
|---|---|---|
| sin paralaje | 1,040° | 0,67 p |
| con paralaje, fase geocéntrica | 0,148° | 0,67 p |
| con paralaje y ΔT = 69 s | 0,140° | 0,66 p |
| **con paralaje, fase topocéntrica** | **0,148°** | **0,12 p** |

- La fase **vista desde el lugar** baja el error de iluminación de 0,67 a 0,12 puntos: la
  paralaje corre la luna hasta un grado, y eso cambia el ángulo de fase lo mismo. Sale
  gratis: es restar el mismo vector del observador.
- ΔT (TT − UT, 69 s) mueve 0,008°. No se usa: no vale una constante que envejece.

## 15/9 · el catálogo, contado

Estrellas que alguna vez suben a −41,087° (Dec < 49,0°), de 9096:

| hasta magnitud | suben | en todo el cielo |
|---|---|---|
| 5,0 | 1441 | 1630 |
| 5,5 | 2534 | 2887 |
| 6,0 | 4443 | 5080 |
| 6,5 | 7323 | 8404 |

B−V falta en 199 estrellas (38 hasta magnitud 6). Las de la Cruz y los punteros
coinciden con `LEEME.md`. α¹ y α² Cru están a 4″, y α¹ y α² Cen también: en la imagen
caen en el mismo píxel y sus brillos se suman.

## 15/9 · la tabla, horneada

`node tools/catalogos/bsc5/hornear.mjs` → `src/data/estrellas.json`: **4484 estrellas,
161 KB**, `[ra, dec, v, bv, hr]`, de la más brillante a la más débil. Decisión:

- **Hasta magnitud 6,0 y declinación hasta +50°.** 6,0 es el ojo desnudo bajo cielo
  oscuro; de 6,0 a 6,5 hay 2880 más que no se distinguen a 576 renglones. +50° porque
  el norte del parque está a −40,1°. Suben a −41,087° 4443 (con la décima de margen del
  banco), 1441 hasta magnitud 5.
- **Sin movimiento propio:** la que más se corre en 26 años es 61 Cyg, 0,038°.
- **La precesión no va en la tabla**: la aplica `Cielo.js` con la fecha. Son 0,25° en
  2025: cabe en la tolerancia, pero cuesta cuatro senos por cuadro y deja la cuenta
  igual a la del banco. Se aplica.
- **Carga.** `import()` dinámico en `Cielo.js`: 161 KB no van en el paquete principal,
  y en Node el rechazo se ataja.

## 15/9 · el nombre mapuche de la Cruz, con fuente

Tres fuentes leídas, no resúmenes:

1. **Universidad de Chile, noticia del 11/11/2024** sobre la charla de Margarita Canio
   Llanquinao y Gabriel Pozo Menares (Universidad Católica de Temuco, autores de
   *Wenumapu. Astronomía y cosmología mapuche*, Ocho Libros, 2014, ISBN
   978-956-335-205-4): la Cruz del Sur con α y β Centauri «marcan un referente del sur»
   y cuentan el relato del choike que deja la huella en el cielo, perseguido toda la
   noche por una boleadora. `https://uchile.cl/noticias/222343/-con-charla-de-astronomia-mapuche-culmina-encuentro-apru`
2. **Blog Millalikan, «El We Tripantu y la reconstrucción de la Astronomía Mapuche
   (Parte II)», 16/6/2010**: *Pünon Choyke* o *Namün Choyke*, «huella de avestruz» o «pie
   de avestruz», la Cruz del Sur; *Lükay* o *Xana Lükay*, «boleadora lanzada», α y β
   Centauri; *Wenu Lewfü*, «río del cielo», la Vía Láctea. Cita el diario de viaje de
   Claraz (1865-1866). `http://millalikan.blogspot.com/2010/06/el-we-tripantu-y-la-reconstruccion-de_16.html`
3. **Blog wiñomapudungutuaiñ, 14/1/2012**, que reproduce a José Llancafil, *Manual de
   Lenguaje Mapuche* (2004): *Melipal*, «cuatro estrellas», la Cruz del Sur; *Wenulewfu*,
   «río del cielo», la Vía Láctea.

El libro de Pozo y Canio no lo pude abrir (AnyFlip da 403). **Va al códice lo que dicen
dos fuentes independientes**: la huella del choyke y la boleadora de los punteros (1 y
2), y el río del cielo (2 y 3). Los nombres *Pünon Choyke* y *Lükay* van con la fuente 2
nombrada; *Melipal*, con la 3. Wikcionario da *Pünon Choyke* y *Ṉamuṉ Choyke* sin
referencia: no cuenta.

## 15/9 · cómo quedó escrito

**`Cielo.js`, la cuenta.** En `actualizar()`: `_girarCielo()` arma la matriz J2000 →
mundo (precesión rigurosa de Meeus 21.2 · giro del tiempo sidéreo local · horizonte del
lugar) y con ella salen `direccionDe()`, `queMiro()`, `uPoloGalactico` y
`uCentroGalactico`; `_lunaDeLaFecha()` resta el observador —latitud geocéntrica— y saca
la fase desde el lugar. Son unos cuarenta senos y dos matrices de 3×3 por cuadro.

**Un defecto chico del banco, dicho con la cuenta.** En `precesar()` del banco, `z`
lleva el término `0,30188 t²` y `zeta` el `1,09468 t²`; en Meeus (21.2) es al revés:
ζ = 2306,2181 t + 0,30188 t², z = 2306,2181 t + 1,09468 t². Con t = 0,25 (2025) la
diferencia entre las dos asignaciones es (1,09468 − 0,30188)·0,0625 = **0,05″**, o sea
0,000014°: no mueve ninguna aserción. Yo uso la asignación de Meeus, con los términos
cúbicos además. No hay que tocar el banco por esto; queda anotado.

**Las estrellas: `THREE.Points`, no ruido en la cúpula.** 4484 vértices, hijos de
`cielo.malla` (que sigue a la cámara), `renderOrder` 1001, suma aditiva, con prueba de
profundidad —el relieve las tapa— y sin escribir profundidad. Siempre visibles, también
de día: se apagan en el vértice, mandándose fuera del recorte. Así los programas son los
mismos de día y de noche (C8) y ninguno compila al caer la noche.

- **Brillo:** `0,8 · 10^(−0,36·(m − 1))` lineal en el píxel del centro. El exponente
  físico sería 0,4; 0,36 comprime la escala un 10 % y deja a una de magnitud 6 en 1/63
  de una de magnitud 1 y no en 1/100. Con la curva ACES y la exposición 1,13: magnitud 6
  → ~28 de 255 sobre un fondo de ~16; magnitud 5 → ~48; δ Cru (2,80) → ~140; Gacrux
  (1,63) → ~200; Acrux con α² → ~230; α Cen con α² → ~245. **El orden de la Cruz sale
  con 60 de margen entre Gacrux y δ**, y ninguna satura: el banco pide 3.
- **Tamaño:** de 2,5 a 6 px según la magnitud. El borde del más grande queda a 3 px del
  centro: 0,36° con campo de 62° y 576 renglones, dentro del medio grado que el banco le
  permite a un punto brillante.
- **Perfil:** meseta y caída, no gaussiana. Con gaussiana el mejor píxel valía entre el
  50 % y el 100 % según dónde cayera el centro dentro del píxel, y el orden de brillo
  dependía de eso; así vale 87 % o más.
- **Lo que las apaga:** extinción por masa de aire (0,20 mag por masa: 0,2 a 30° de
  altura, 1,9 a 5°), el día (`luz·noche² − 2,5·diurno`: con el sol 3° abajo quedan las
  de magnitud 0, a 6° las de 3, a 8° todas; a pleno día ninguna), la luna alta y llena
  (se lleva las de 5 para abajo), las nubes —con la MISMA `coberturaNubes()` que dibuja
  el domo, en `NUBES_GLSL`, para que no se vea una estrella a través de una nube que el
  domo sí pinta—, la ceniza y el disco de la luna.
- **Baja no tiene resplandor**, así que el halo del bloom no cuenta ahí; en Alta sí, y
  por eso el brillo se queda en 0,8 y el punto es chico.

**La luna se dibuja con su fase.** El disco es de 0,52° de radio, el doble del real y no
las cinco veces de la base; en `q`, coordenadas en radios del disco con `q.x` hacia el
sol, el terminador es la media elipse `q.x = (1 − 2k)·√(1 − q.y²)`, así que **sobre el
eje del sol lo iluminado mide 2k radios: exactamente la fracción iluminada**, que es lo
que mide el perfil del banco navegador. La superficie iluminada brilla igual en
creciente que en llena —lo que cambia es cuánta hay—, la cara oscura tapa la Vía Láctea
y deja el aire que está delante (de noche el fondo, de día el azul), y el halo va
después del disco, porque es aire iluminado delante de la luna.

**El borde del disco no usa `fwidth()`.** Lo escribí primero con derivadas y lo cambié:
un `ShaderMaterial` sin `glslVersion` compila en GLSL ES 1.00, y ahí las derivadas
dependen de una extensión. Si el domo no compilara, no habría cielo. Ahora el tamaño
angular del píxel entra como uniforme, `uPixelAngular`, que escribe `onBeforeRender` con
la cámara que de verdad dibuja: `2 / (|m5| · renglones)`, con `m5 = 1/tan(campo/2)` el
elemento [5] de la matriz de proyección. A 62° y 576 renglones da 0,0021 rad (0,12°); con
el campo de 6° del banco navegador, 0,00018 (0,010°), o sea un borde de 2 px. Anda igual
en el juego, en una captura y en el reflejo del lago.

**Comprobado a mano contra JPL, con el código puesto** (15/1/2026, 3:00 UTC, desde el
arranque): la luna a −20,53° de altura contra los −20,535° de JPL, y 12,63 % iluminada
contra 12,59 %.

## 15/9 · el falsador, y los puntos inventados de la mitad navegador

**Falsador: 18 de 18 defectos vistos**, cada uno en la aserción declarada, y los 3
controles verdes. (Se cayó dos veces antes de terminar, copiando `src/` mientras el
coordinador trabajaba en el repo; él le puso reintentos al borrado y la corrida limpia
salió entera.)

**El coordinador midió en el navegador:** la fracción del disco de la luna, **0,64
contra 0,62** de iluminación (el tope es 0,15), y el costo de la noche, **3,72 ms contra
los 5,06 ms de la base**: las estrellas del catálogo salen 1,34 ms más baratas que el
ruido por píxel que reemplazaron, con el tope en +1 ms. Y contó los puntos brillantes en
la vista de la Cruz con el criterio del banco: **106 con las estrellas prendidas, 3 con
las estrellas apagadas**. Los inventados los producían mis estrellas.

**Dos cosas, y sólo una era el NaN.**

*Uno · la cuenta que sí explica decenas de puntos: el tamaño del punto.* A 62° de campo
y 576 renglones un píxel abarca `2·tan(31°)/576 = 0,1195°`, así que **medio grado son
4,18 px**. Mis puntos más brillantes medían 6 px: radio 3 px, más ~1 px que mezcla el
FXAA y medio píxel de la rejilla con que el banco mide, **4,5 px**. Cada estrella
brillante desparramaba unos píxeles justo afuera del medio grado, y ésos son los
inventados. Ahora el tope es 3,6 px de punto —radio 1,8— y la caída del perfil termina
en r² = 0,95, o sea 1,75 px: `1,75 + 1 + 0,5 = 3,3 px = 0,40°`, con 0,10° de margen. De
paso la meseta quedó más ancha (0,25 a 0,95): el mejor píxel de un punto de 2,5 px vale
el 97 % y no el 87 %, así que el orden de brillo de la Cruz depende menos del subpíxel.

*Dos · el NaN, medido: es una guarda, pero no es teórica.* La pregunta era si `dir.y`
pasa de 1 de verdad. Sobre la tabla, con la precesión a 2026:

| estrella | V | Dec 2026 | del cenit del arranque | 1 − cos |
|---|---|---|---|---|
| HR 8229 | 5,29 | −41,060° | **0,027°** | 1,12e-7 |
| HR 659 | 5,91 | −41,043° | 0,044° | 2,89e-7 |
| HR 4794 | 5,13 | −41,169° | 0,082° | 1,02e-6 |

El épsilon de float32 es **1,19e-7**: para HR 8229, que cruza el cenit de Bariloche una
vez por día sidéreo, `1 − dir.y` es **más chico que el épsilon**, o sea que en su
culminación `dir.y` vale 1 dentro del redondeo, y que caiga en 1,0 o un ulp por encima
depende de cómo la placa haga el producto (y del vector unitario, que ya viene guardado
en float32 con su propio error). Simulando el producto con redondeo a float32 en cada
paso, 200 000 tiros alrededor de esa declinación: **máximo exactamente 1,0, ninguno por
encima**. O sea: no pude hacerlo fallar, el margen es cero, y **una estrella no alcanza
para 106 puntos**. Va el `min(dir.y, 1.0)` igual, que cuesta una instrucción.

*Y no era el único lugar.* Auditado el vértice entero: `pow(93,885 − acos(c)·57,3;
−1,253)` tiene base ≥ 3,885 sólo si el `acos` no dio NaN; el divisor de la masa de aire
nunca baja de 0,0275; `normalize(uSol)` y `normalize(uLuna)` no reciben vectores nulos;
`aMagnitud` es finita en las 4484 filas —lo comprueba la sección 3 del banco— y
`colorEstelar()` divide por una luminancia que nunca baja de 0,5. Con el coseno acotado
no queda ningún camino a NaN. **Y encontré el mismo agujero en el domo**: `caminoOptico()`
del shader hacía `acos(max(cosCenit, 0))` sin techo, mientras su gemelo de CPU ya hacía
`Math.min(1, c)` — un píxel de cielo mirando al cenit podía salir de cualquier color.
Acotado de los dos lados, como el gemelo.

**Y me rompí solo el archivo, con el comentario del arreglo.** El comentario que
explicaba el `min()` llevaba `Math.min(1, c)` entre comillas invertidas, y lo escribí
DENTRO de la plantilla del shader, que es una cadena delimitada por comillas invertidas:
la comilla cerró la cadena y `Cielo.js` dejó de parsear. El banco entero cayó a 2/7 —las
cuatro secciones que importan el módulo, más `vite build`, que apuntó al renglón
exacto—. Es la misma trampa que el falsador avisa en su encabezado («adentro de los
parches no hay comillas invertidas ni `${`») y que yo no apliqué a mis propios
comentarios. Sacadas las comillas de los dos comentarios que viven dentro de shaders, y
revisadas todas las que quedan en el archivo: están en comentarios de JavaScript o en
los docstrings que van ANTES de cada plantilla, nunca adentro.

**Los dos rojos de la mitad navegador son del banco, no del código**, y los arregla el
coordinador; quedan anotados para que no se pierdan:
- **C6** busca luna llena a más de 40° de altura entre el 1/1/2026 y 60 días después. La
  llena está enfrente del sol, o sea a declinación +16° en verano austral, y desde −41°
  su altura máxima es 90 − |−41 − 16| = **33°**: la premisa es imposible en esa ventana.
- **C5** («el lado iluminado mira al sol») tomó como cuarto una noche de k = 0,62, que es
  gibosa: el terminador cae en q.x = −0,24 y tres cuartos del lado opuesto al sol están
  iluminados, así que la razón no llega a 1,5 ni con el dibujo perfecto.

## 15/9 · cierre

Corrida entera del banco sobre el código final —con el `min()` del coseno, los puntos de
3,6 px y las comillas sacadas de los shaders—: **total 7/7**, las siete secciones,
incluidas la regresión de nueve bancos y `vite build`. El falsador, 18 de 18 y los 3
controles verdes.

Queda para el coordinador volver a medir la mitad navegador: lo único que cambió para la
imagen desde su medición es el tamaño del punto y su perfil, que es justamente lo que
apunta a los puntos inventados. La fase del disco (0,64 contra 0,62) y el costo
(3,72 ms) no deberían moverse: el perfil pinta menos píxeles, no más.

No arranqué Vite ni abrí el navegador, y no hay ningún commit hecho.

**La Vía Láctea** gira: la banda es `exp(−(dir·uPoloGalactico · ancho)²)`, más ancha y
más brillante hacia el centro galáctico (Sagitario, que desde acá pasa a 78°), y el
polvo se evalúa en coordenadas del cielo (`dir * uCieloAMundo` es la transpuesta por
`dir`) para que las manchas giren con las estrellas.

**El HUD** pregunta `cielo.queMiro()` con la dirección deducida de `jugador.giro` y
`jugador.cabeceo` —la misma con la que `Jugador` orienta la cámara, orden YXZ— y muestra
los tres pasos del método, con las estrellas nombradas y el error propio del método
(3°). Con el cielo cubierto no dice nada, y el cartel se queda 1,5 s para que no
parpadee en el borde de los 12°. `actualizar(dt, cielo, mirada)` ya acepta una dirección
de afuera, por si algún día la cámara deja de seguir al jugador (va en el pendiente).

**El banco, entero, 15/9:**

```
  VERDE  ejercitó   4  1 · LA LUNA ES LA DE LA FECHA — contra JPL Horizons, vista desde el arranque
  VERDE  ejercitó   5  2 · EL CIELO GIRA — direccionDe(ra, dec) contra el tiempo sidéreo y la precesión del banco
  VERDE  ejercitó   8  3 · LAS ESTRELLAS SON LAS DEL CATÁLOGO — la tabla horneada, su cita, y sin el ruido viejo
  VERDE  ejercitó   3  4 · LA VÍA LÁCTEA GIRA CON EL CIELO — uPoloGalactico sobre el polo norte galáctico
  VERDE  ejercitó  11  5 · LA CRUZ DEL SUR ENSEÑA EL SUR — queMiro(), el método en el cielo del juego, el HUD y el códice
  VERDE  ejercitó   9  6 · SIN REGRESIÓN — la ronda 6 y las fases anteriores de la ronda 7
  VERDE  ejercitó   1  7 · ARRANQUE — vite build
  VERDE  total 7/7
```

Con detalle, los números que importan: la luna, 0,15° y 0,12 puntos en el peor de los
diez instantes de JPL; `direccionDe`, 0,001° contra la cuenta del banco en siete
estrellas y cuatro instantes; el eje de giro, 41,09° de altura y 180,00° de azimut; el
método de la Cruz en el cielo del juego, **2,69° por el palo y 2,95° por la mediatriz**,
los mismos que da el banco sobre el catálogo (el tope es 4°).

**El códice** pinta el bloque `cieloAustral` de `geografia.json` al final de la pestaña
de geografía: la Cruz con sus cuatro estrellas (magnitud y HR), los punteros, el método
en cinco pasos con su error medido, la Vía Láctea, la luna y las fuentes. Los datos de
las estrellas salen del catálogo —incluidas las paralajes de α Cen (0,751″ → 4,3 años
luz) y β Cen (0,009″)— y los nombres mapuches, de las fuentes de arriba.
