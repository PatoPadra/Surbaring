# Bitácora — fauna (ronda 3, fase 2)

> Se escribe mientras se trabaja, no al final (regla 5 de `RONDA3.md`).

## Diagnóstico — leído del código, no del informe de fase 1

### Mitad A — los atlas no están aplicados en ningún lado

`Fauna.js:628` `material(color, rugosidad)` devuelve un `MeshStandardMaterial`
con `color`, `roughness`, `metalness:0` y ni un mapa. Nadie importa
`src/util/atlas.js`. Confirmado con grep sobre todo `src/`.

### Mitad B — la silueta, y el número que la condena

`construirCuadrupedo()` (`Fauna.js:707`) arma el tronco con
`SphereGeometry(1,12,9)` escalada a `(ancho, H*0.34, L*0.46)`, con
`ancho = L*0.34`. Como el radio de la esfera es 1, la escala **es** el semieje.

Para el huemul (L=1,65 · H=0,90 · 75 kg):

- semiejes = (0,561 · 0,306 · 0,759) m → **1,12 m de ancho de tronco**.
- volumen del elipsoide = (4/3)π·0,561·0,306·0,759 = **0,546 m³**.
- a densidad de mamífero (≈1000 kg/m³) eso es un tronco de **546 kg** sobre un
  animal que la ficha declara de **75 kg**. **7,3× de más.**

`pesoKg` está en la ficha de las 44 especies y **no se usa para nada de la
forma**: el ancho sale de `largoM` y nada más. Ése es el dato que estaba en la
ficha sin usarse, y explica por qué a cinco metros un huemul es una cápsula: no
es sólo que no tenga textura, es que es cuatro veces más ancho de lo que debería.

Ancho derivado de la masa, para el tronco tratado como elipsoide que contiene el
65 % de la masa corporal (el resto va en cabeza, cuello y patas):

| especie | L | H(cruz) | kg | semiancho hoy `L*0.34` | semiancho por masa |
|---|---|---|---|---|---|
| ciervo_colorado | 2,10 | 1,30 | 200 | 0,714 | 0,216 |
| guanaco | 1,90 | 1,15 | 100 | 0,646 | 0,135 |
| huemul | 1,65 | 0,90 | 75 | 0,561 | 0,149 |
| puma | 1,90 | 0,65 | 55 | 0,646 | 0,131 |
| pudu | 0,80 | 0,40 | 10 | 0,272 | 0,092 |
| huillin | 1,20 | 0,28 | 9 | 0,408 | 0,079 |

**`alturaCruzM` es `null` en 7 de las 21 especies de mamífero**
(chinchillón ×2, tuco-tuco ×2, comadrejita, monito del monte y
`chinchillon_anaranjado`). El código ya tiene el respaldo `?? L*0.6`; hay que
conservarlo o esas siete se rompen. Verificado con Node contra `fauna.json`.

### El dato de forma que además está en la ficha: `dieta`

Un herbívoro rumiante tiene panza; un felino tiene el abdomen recogido y el
pecho hondo. `dieta` está en las 44 fichas y hoy sólo se usa para decidir si el
animal pasta. Es el tercer campo real que define silueta, junto con `pesoKg` y
la relación `alturaCruzM/largoM`.

## Los cuatro peligros — verificados uno por uno

### 1. `compactar()` agrupa por color — CONFIRMADO, y hay un matiz

`Fauna.js:650`: `const clave = m.material.color.getHexString()`. El matiz que
encontré leyendo: `compactar()` corre sobre **un solo modelo de especie**
(`_obtenerModelo` lo llama por especie), así que hoy dos celdas distintas del
atlas no se pueden cruzar por ahí. **El defecto real que sí queda vivo es
dentro de una misma especie:** dos piezas del mismo color pero con materiales
distintos (una con mapas y otra sin, o con bandas de UV distintas) se fusionan
bajo `grupo[0].material` y la que pierde queda muestreando lo que no es. Con la
reforma de abajo —un material por especie— la clave correcta es la **identidad
del material** (`uuid`), no el color; y como el material pasa a estar cacheado
por especie, `uuid` agrupa exactamente lo que tiene que agrupar.

### 2. `fusionarGeometrias()` sólo copia `position` y `normal` — CONFIRMADO

`Fauna.js:700-702`: escribe `position`, `normal` e `index`. **No escribe `uv`.**
Con `map` puesto y sin atributo `uv`, WebGL entrega (0,0) en todos los vértices:
la malla fusionada entera muestrea **un solo texel**, el de la esquina
`(u0,v0)` de la celda. No hay error ni aviso — es el mismo defecto silencioso
del punto 1, a diez líneas.

**Canal de UV de `aoMap` en three 0.169** (leído en `node_modules`, no de
memoria): `WebGLPrograms.js:262` → `aoMapUv: getChannel(material.aoMap.channel)`
y `Texture.js:38` → `this.channel = 0` → **`aoMap` usa el atributo `uv`, no
`uv1`**. La nota de la cabecera de `atlas.js` que habla de «un segundo set de UV
(uv2)» es de three anterior a r151 y ya no aplica.

**Y un hallazgo que no estaba en la lista:** three lee el mapa combinado con la
convención ORM de glTF —
`aomap_fragment.glsl.js`: «reads channel R»; `roughnessmap_fragment.glsl.js`:
«reads channel G» — mientras que `hornear-texturas.mjs:323` hornea
**R = rugosidad, G = oclusión**. Están **cruzados**. Enchufar
`roughnessMap = rugosidadOclusion` a secas hace que la rugosidad la maneje la
oclusión y viceversa, otra vez sin error ni aviso. Ver «Decisiones» abajo.

### 3. La convención de bandas UV — CONFIRMADO que deja de valer, y es peor: es contradictoria

La convención del manifiesto es **un solo eje V** con bandas
cabeza [0 · 0,14] / dorso [0,14 · 0,62] / vientre [0,62 · 0,86] / cola [0,86 · 1].
Leyendo `hornear-texturas.mjs` se ve que el horno **quiso** que V fuera
longitudinal (cabeza→cola): el `listado` del zorrino son franjas a `u` constante
(«dos anchas franjas blancas dorsales» corren a lo largo del lomo) y las estrías
de pelo son seno de `u` a 40-60 ciclos, o sea crestas que corren a lo largo de V.

Pero `SphereGeometry` mapea V al **ángulo polar**: V=0 es el polo +Y (arriba) y
V=1 el polo −Y (abajo). Con `flipY=false`, hoy la banda «cabeza» cae sobre el
lomo y la banda «cola» sobre la panza: la convención **ya está aplicada al revés
en el código de hoy**, no es algo que rompa la fase 2.

Y no se puede tener las dos cosas: `colorDorso` vs `colorVientre` es una
distinción **dorsoventral** (contrasombreado), y cabeza vs cola es
**longitudinal**. Un solo eje V no lleva las dos.

**Decisión, explícita:** en la geometría nueva **V es dorsoventral en el tronco**
y las piezas de cabeza y cola se colocan a mano en sus bandas longitudinales.
El mapeo exacto que produce mi geometría está más abajo y en
`pendiente-r3-fauna.md`.

### 4. `cargarAtlasFauna()` memoiza el fracaso — CONFIRMADO

`atlas.js:85`: `if (!promesaCarga) promesaCarga = cargarInterno()`. Nunca se
reintenta. Lo llamo **una sola vez**, en el constructor de `Fauna`, y no lo
espero: cuando resuelve, **muto los materiales ya cacheados** en vez de
reconstruir modelos. Así el orden de llegada del atlas no puede dejar animales
con colores planos ni obliga a bloquear el arranque.

## Decisiones tomadas, con el motivo

> Escritas **antes** de tocar el código, no después.

### D1 · Un material por especie, con `vertexColors`

El cache de materiales que pide el punto 3 del horno se puede hacer de dos
maneras: cachear los **dos o tres** materiales que hoy tiene cada especie
(pelaje, oscuro, asta), o cachear **uno solo** y meter el tono de cada pieza en
un atributo `color` por vértice.

Elegí uno solo con `vertexColors: true`, y el motivo es el presupuesto: con
cuatro cascadas **cada malla se dibuja cinco veces**, y `compactar()` sólo puede
fusionar piezas que comparten material. Con un material por especie, todas las
piezas de un pivote colapsan en un dibujo:

| | hoy | con un material |
|---|---|---|
| cuadrúpedo | 12–13 mallas | **7** |
| ave | 6–7 mallas | **5–6** |

El contraste (hocico, pezuñas, orejas, pico, asta) no se pierde: viaja en el
atributo de color, que en el fragmento es **una multiplicación**, no una lectura
de textura ni ALU de la que esta máquina cobra caro. `material.color` queda en
blanco puro, así que ningún material puede quedar en negro (la trampa que la
ronda 1 pagó con las piedras).

Los colores del atributo se escriben desde `THREE.Color`, que con
`ColorManagement` (activo: `main.js:117` fija `outputColorSpace = SRGBColorSpace`
y nadie desactiva la gestión) ya convierte de sRGB a lineal-de-trabajo — que es
exactamente el espacio en el que el shader espera el atributo de color. Sin
atlas, el resultado es **idéntico** al plano de hoy.

### D2 · `compactar()` nunca fusiona una malla con nombre

La clave de agrupación pasa a ser `m.material.uuid` (identidad, no color: el
defecto del punto 1). Pero con **un** material por especie aparece un riesgo
nuevo que hoy no existe: en el cóndor, `cuerpo` y el collar son dos mallas
hermanas de la raíz con colores distintos; con un solo material se fusionarían y
la malla resultante **perdería el nombre `cuerpo` y su `userData.y0`**, con lo
cual `_animar()` dejaría de encontrarla y el animal se quedaría quieto sin lanzar
un solo error. Es justo el modo de falla silenciosa que el encargo prohíbe.

Solución: `compactar()` excluye del fusionado toda malla que tenga `name`. Cuesta
un dibujo en una sola especie (el cóndor) y hace estructuralmente imposible que
la compactación se coma un nombre que la animación busca.

### D3 · `fusionarGeometrias()` copia la **unión** de atributos, con relleno neutro

El caso mixto (una geometría del grupo sin `uv`) tiene tres salidas posibles.
Descarté las dos primeras:

- **Intersectar** (copiar sólo los atributos que están en todas): si una sola
  pieza del grupo viene sin `uv`, la malla fusionada entera se queda sin `uv` y
  con `map` puesto muestrea **un único texel** — el defecto exacto que esta fase
  viene a arreglar, reintroducido por la vía de atrás.
- **Abortar el fusionado**: silenciosamente devuelve el costo de dibujos que la
  fase compra.

Va la unión con relleno neutro por atributo: `uv` → `(0.5, 0.5)`, `color` →
`(1,1,1)`, `normal` → `(0,1,0)`. El daño queda acotado a la pieza que faltaba, y
`(0.5,0.5)` es el centro de la celda —un texel de contenido real— y no la esquina
`(u0,v0)`, que cae dentro de los 8 px de guarda replicada del atlas.

En la práctica el caso no se da: `SphereGeometry`, `CylinderGeometry`,
`ConeGeometry`, `BoxGeometry` y `TorusGeometry` traen `uv` todas, y el `color` lo
escribo yo en todas las piezas. El relleno es la red, no el plan.

### D4 · Mapa combinado: se enchufa y nada más

R = oclusión, G = rugosidad (ORM de glTF), que es lo que three lee. El jefe
arregla el horno; acá no va ni un `onBeforeCompile` ni un swizzle de canales.
`aoMap` usa el atributo `uv` (canal 0) en three 0.169 — verificado en
`WebGLPrograms.js:262` y `Texture.js:38` — así que no hace falta ningún `uv1`.

### D5 · Anisotropía 8

La pongo. El motivo del número: el terreno usa 16 (`Mundo.js:578`) y el follaje
usa 8 (`Vegetacion.js:993`). Un animal no es un plano infinito visto de canto
como el suelo: es un volumen chico, en movimiento, cuya celda de atlas mide
128 px. 16 paga muestras extra para una superficie que casi nunca está en el
ángulo rasante que las justifica; 0 lo deja más borroso que el pasto que tiene al
lado. **8** es la anisotropía del vecino visual directo (el sotobosque), se paga
en ancho de banda —donde esta máquina gana 2,3×— y three la recorta sola al
máximo del driver en `WebGLTextures`, así que no puede pedir de más.

### D6 · El mapeo UV exacto, y lo que se rompe con él

Sostengo lo decidido: **V es dorsoventral**. Se paga un precio y hay que dejarlo
escrito.

El eje V de la celda lleva las bandas de tono (cabeza / dorso / vientre / cola) y
el eje U lleva el patrón y las estrías de pelo. Con V dorsoventral, el
contrasombreado —`colorDorso` contra `colorVientre`, un dato real por especie que
el horno horneó para las 44— cae donde tiene que caer en **todas**. A cambio, un
patrón que el horno dibujó como franja a `u` constante deja de correr a lo largo
del lomo y pasa a envolver el contorno: **el zorrino pierde sus dos franjas
dorsales** y le quedan dos cinturones. Se cambia el tono correcto en 44 especies
por el eje de franja correcto en una. Queda pedido en `pendiente-r3-fauna.md`
que el manifiesto declare la orientación de banda para que la ronda que viene lo
pueda arreglar del lado del horno.

El mapeo, pieza por pieza. **V sale siempre de la altura del vértice** dentro de
un rango declarado explícitamente por grupo (contrasombreado), y **U es el que
trae el primitivo**, que es el eje que el horno usa para el patrón:

| pieza | banda V | eje que produce V | U |
|---|---|---|---|
| tronco | `[0.14, 0.86]` dorso→vientre | altura local, techo y piso del tronco | `s` longitudinal, 0 pecho → 1 grupa |
| cuello, cráneo, hocico, orejas, astas | `[0.005, 0.135]` cabeza | altura en el pivote de cabeza | el del primitivo |
| patas y pezuñas | `[0.16, 0.60]` dorso | altura en el pivote de pata | el del primitivo |
| cola (cuadrúpedo) | `[0.865, 0.995]` cola | altura en el pivote de cola | el del primitivo |
| cuerpo de ave | `[0.14, 0.86]` | altura local | `s` longitudinal |
| alas y plumas | `[0.42, 0.58]` acento medio | `|x|`, envergadura hacia afuera | el del primitivo |
| cola de ave | `[0.865, 0.995]` | `|z|` a lo largo | el del primitivo |

Las bandas se toman con un margen adentro (0.005 y 0.995, no 0 y 1) para no
muestrear el borde exacto entre dos bandas del atlas.

### D7 · El ancho sale de la masa — y el largo y el fondo del tronco también

El ancho por masa solo no alcanza, y el número de la bitácora lo demuestra: el
tronco de hoy es `L*0.46` de semilargo, o sea **el 92 % del largo del animal**,
con la cabeza empezando en `L*0.40` — adentro del tronco. Y `H*0.34` de
semialto, o sea **el 68 % de la alzada** metida en el pecho, con lo que al huemul
le quedan 29 cm de pata. Si sólo se corrige el ancho, queda una tabla de planchar.

Las tres medidas del tronco pasan a ser:

- **semilargo** `L*0.29` (tronco = 58 % del largo cabeza-cuerpo; en el huemul,
  0,96 m, que es la medida real de un tronco de huemul).
- **semialto** `H*0.225` (profundidad de pecho = 45 % de la alzada; huemul 0,41 m
  de pecho, y le quedan 0,49 m de pata).
- **semiancho** despejado del volumen: `V = 0,65 · pesoKg / 1000` (fracción de
  masa del tronco a densidad de mamífero), contra el volumen **medido
  numéricamente sobre mi propio perfil de secciones**, no contra la fórmula del
  elipsoide, porque la geometría ya no es un elipsoide. Con clamp a
  `[0.25, 1.6] · semialto` para que un dato raro no produzca ni una plancha ni un
  barril.

### D8 · Lomo, cruz y grupa: un tronco por secciones, con los mismos triángulos

El tronco pasa de `SphereGeometry(1,12,9)` a un barrido de 8 estaciones
longitudinales, cada una con su semiancho, su techo y su piso propios: cruz alta
en la paleta, lomo que baja, grupa que vuelve a subir, panza que se recoge hacia
atrás. Con 12 radiales y 8 estaciones más dos polos son **192 triángulos —
exactamente los mismos** que la esfera de hoy (12·9·2 − 24 = 192). La silueta
sale gratis; es el encargo textual de `RONDA3.md`.

`dieta` entra ahí como tercer campo de forma, modulando el perfil:
herbívoro = panza que baja en el tercio trasero (rumen); carnívoro = abdomen
recogido atrás y pecho más hondo adelante; el resto sin modular.

`alturaCruzM` sigue con el respaldo `?? L*0.6`. Son **6** los mamíferos que lo
necesitan, no 7: la bitácora contaba «chinchillón ×2» y además
`chinchillon_anaranjado` aparte. La lista real es monito del monte, los dos
chinchillones, los dos tuco-tucos y la comadrejita.

---

## Hecho

Todo en `src/entities/Fauna.js`. `Cuerpo.js` y `Peces.js` quedaron **sin tocar**,
a propósito: el atlas horneado tiene celda para las 44 especies de mamífero y
ave, no para los siete peces ni para el jugador. Aplicarles un mapa sería
inventar una celda que no existe.

### Mitad A — los atlas aplicados

1. **Un material por especie, cacheado** (`materialDeEspecie`). 114 materiales
   pasaron a **44**. Sigue siendo **una sola variante de programa** (medido:
   todos los materiales comparten parámetros), así que no hay compilaciones de
   shader extra.
2. **`compactar()` agrupa por `material.uuid`**, no por color, y **nunca fusiona
   una malla con nombre** (D2).
3. **`fusionarGeometrias()` copia la unión de atributos** con relleno neutro
   (D3): `uv` y `color` viajan, y ninguna malla fusionada queda muestreando un
   solo texel.
4. **`cargarAtlasFauna()` se llama una sola vez**, en el constructor de `Fauna`,
   sin esperar. Cuando resuelve, `aplicarAtlas()` viste los materiales ya
   cacheados; los que se creen después se visten al nacer. Se agregó
   `especiesVestidas()` porque el número que devuelve `aplicarAtlas()` engaña: en
   el juego real el atlas llega **antes** de que exista el primer modelo, así que
   ahí siempre viste cero.
5. **Mapa combinado enchufado tal cual** a `roughnessMap` y `aoMap`, con
   `roughness = 1` para que mande el mapa. Ni un swizzle, ni un
   `onBeforeCompile`.
6. **Anisotropía 8** en los tres mapas.

### Un defecto que encontré escribiendo, y que no estaba en la lista

`SphereGeometry` corrige el U de sus polos con `±0.5/widthSegments`. El hocico es
una esfera de 7 segmentos, así que salía con **U entre −0,071 y 1,071**. Como
`texturasParaEspecie()` mapea [0,1] a la celda con `offset`/`repeat`, ese
sobrante cae **en la celda vecina del atlas** — el hocico de un animal con el
pelaje de otro, sin error ni aviso. Y el `ClampToEdgeWrapping` no salva, porque
recorta contra el borde del atlas entero y no contra el de la celda. `banda()`
ahora recorta U a [0,1] además de escribir V. Medido: las 44 especies quedan con
U∈[0,1] en cuerpo, cabeza y cola.

### Mitad B — la silueta

- Tronco de barrido por 8 estaciones con cruz, lomo y grupa (D8), modulado por
  `dieta`.
- Las tres medidas del tronco salen de los datos (D7), y el ancho se **ajusta
  midiendo el volumen de la malla real** por el teorema de la divergencia, no la
  integral del perfil: la sección es un polígono de 12 lados (95,5 % del área de
  la elipse) y las estaciones se comprimen para cerrar en punta; entre las dos
  cosas se perdía el 14 % y la masa entregada daba 55 % en vez de 65 %.
- El techo del tronco queda **exactamente en `alturaCruzM`**: verificado especie
  por especie (columna `cruz` = `H` en las 21).
- Cuello, cráneo, hocico, orejas, patas, pezuñas, pico y cuerpo de ave
  redimensionados: con el tronco corregido, las fórmulas viejas que salían de
  `ancho = L*0.34` daban patas de centímetro y medio.

## Los números, medidos por mí con Node

Ningún navegador, ningún Vite. Scripts propios en el scratchpad que importan
`Fauna.js` y le miran los objetos.

### Dibujos y triángulos — los 44 modelos, antes contra ahora

| | antes | ahora | |
|---|---|---|---|
| mallas totales (44 especies) | 393 | **263** | **−33,1 %** |
| mallas por mamífero | 12,10 | **7,00** | −42 % |
| mallas por ave | 6,04 | **5,04** | −17 % |
| triángulos totales | 22 282 | **21 822** | −2,1 % |
| triángulos por mamífero | 628 | **628** | igual |
| materiales | 114 | **44** | |
| variantes de programa | 1 | **1** | |

**La cota que importa para el presupuesto**: con `MAX_VIVOS = 52` y la especie
más cara, los dibujos con las cuatro cascadas de sombra pasan de **3 380 a
1 820** (−46 %). Con 52 mamíferos medios, de 3 145 a 1 820.

Es decir: la fase **no gasta** del presupuesto de 2 ms en la moneda cara —paga
**menos** dibujos y **menos** triángulos que antes— y lo que suma es lectura de
textura, que es justo donde esta máquina gana 2,3×. Los 16,78 MB de VRAM del
atlas no son nuevos de esta fase: son los que la fase 1 ya midió y declaró dentro
del techo de 24 MB.

Costo de una sola vez: armar los 44 modelos pasó de 195,7 ms a 214,7 ms (≈4,9 ms
por especie, contra 4,4 antes). Se paga una vez por especie, la primera vez que
aparece, igual que antes.

### El ancho del tronco, especie por especie

`ancho` es el ancho total del tronco en metros; `antes` es el que daba
`L*0.34*2`; `kgTronco` es la masa que encierra la malla a densidad de mamífero.

| especie | L | H | kg | ancho | antes | veces | kgTronco |
|---|---|---|---|---|---|---|---|
| ciervo_colorado | 2,10 | 1,30 | 200 | **0,330** | 1,428 | 4,3× | 130,0 |
| guanaco | 1,90 | 1,15 | 100 | **0,206** | 1,292 | 6,3× | 65,0 |
| jabali_europeo | 1,50 | 0,90 | 90 | **0,317** | 1,020 | 3,2× | 58,5 |
| huemul | 1,65 | 0,90 | 75 | **0,228** | 1,122 | 4,9× | 48,7 |
| puma | 1,90 | 0,65 | 55 | **0,227** | 1,292 | 5,7× | 35,7 |
| perro_asilvestrado | 1,10 | 0,55 | 25 | **0,211** | 0,748 | 3,5× | 16,2 |
| pudu | 0,80 | 0,40 | 10 | **0,141** | 0,544 | 3,9× | 6,5 |
| huillin | 1,20 | 0,28 | 9 | **0,137** | 0,816 | 6,0× | 5,8 |
| zorro_colorado | 1,15 | 0,45 | 8,5 | **0,078** | 0,782 | 10,0× | 5,5 |
| vison_americano | 0,60 | 0,15 | 1,1 | **0,062** | 0,408 | 6,6× | 0,7 |

El huemul deja de ser una cápsula de **1,12 m de ancho y 546 kg de tronco** y
pasa a **0,228 m y 48,7 kg**, que es el 65 % de los 75 kg de la ficha, tal como
se declaró. `kgTronco / pesoKg` da 0,65 en las 21 especies salvo dos, y esas dos
son las que topan el clamp.

**Las dos que topan el clamp**, y por qué está bien que topen: el monito del
monte (30 g) y la comadrejita patagónica (80 g) no tienen `alturaCruzM`, así que
el respaldo `L*0.6` les da una alzada de 14-15 cm que es más de lo que miden de
verdad —`largoM` en esas fichas parece incluir la cola—. Con ese fondo de pecho,
la masa pediría un tronco más angosto que una hoja de papel. El clamp de
`0.25 · semialto` lo impide. Es exactamente para lo que está.

### Aves

| especie | L | kg | ancho | antes |
|---|---|---|---|---|
| condor_andino | 1,15 | 11,3 | **0,249** | 0,782 |
| cauquen_comun | 0,65 | 3,0 | **0,170** | 0,442 |
| aguila_mora | 0,72 | 2,5 | **0,148** | 0,490 |
| bigua | 0,68 | 1,3 | **0,110** | 0,462 |
| chucao | 0,19 | 0,04 | **0,036** | 0,129 |
| rayadito | 0,14 | 0,011 | **0,022** | 0,095 |

Los 25 cm de ancho de cuerpo del cóndor son la medida real del animal; con la
fórmula vieja tenía 78 cm, más que su propio largo.

### Comprobaciones, todas en verde

Sobre las **44** especies, no sobre una muestra:

1. **Nombres de parte**: `cuerpo`, `cabeza`, `cola` y `pd1/pi1/pd2/pi2`
   (cuadrúpedos) o `ala_d`/`ala_i` (aves) existen en las 44, y `cuerpo` conserva
   `userData.y0`.
2. **Animación viva de verdad**: se simularon 40 pasos de `_simular()` con un
   mundo de prueba para huemul, cóndor, pudú y chucao. En los cuatro se mueve el
   cuerpo (o sea `userData.y0` sigue vivo), articulan patas o alas, y la cabeza
   responde al estado. `_animar()` no se tocó ni una línea.
3. **Atributos**: cero mallas sin `uv`, sin `color` o sin `normal`; cero mallas
   con el UV entero en (0,0).
4. **Bandas UV**: cuerpo en [0,14 · 0,86], cabeza en [0,005 · 0,135], patas en
   [0,16 · 0,60], cola en [0,865 · 0,995], alas en [0,42 · 0,58]. Ninguna se sale
   de la suya, y el U del tronco cubre [0 · 1] completo.
5. **Un material por especie** en las 44, y **ninguno en negro puro** (todos
   quedan en blanco: el tono va en el atributo de vértice).
6. **Degradación sin `public/tex/`**: `atlasListo = false`, los 44 materiales sin
   `map`, sin `normalMap`, sin `roughnessMap` y sin `aoMap`, `roughness` en 0,85
   / 0,72 y el color plano de siempre. **Ni un mapa colgado.** No hay ni un
   `import` estático de nada de `public/tex/`.
7. **Con atlas** (manifiesto real desde disco, texturas simuladas):
   `atlasListo = true`, `especiesVestidas() = 44`, los cuatro mapas puestos,
   `aoMap === roughnessMap`, `roughness = 1`, `anisotropy = 8`, y la celda
   recortada bien (`offset` 0,0 · `repeat` 0,125 · `flipY` false para el huemul,
   que es la celda 0,0).
8. **`npx vite build` pasa**: 72 módulos, sin errores.

## Descartado, con el motivo

- **Cachear dos o tres materiales por especie** (pelaje / oscuro / asta) en vez
  de uno con `vertexColors`. Es lo más obvio y lo más chico de escribir, pero
  deja a `compactar()` sin nada que fusionar: el cuadrúpedo se queda en 12-13
  mallas y con cuatro cascadas eso son 60-65 dibujos por animal. Se descarta por
  el presupuesto, no por gusto.
- **Intersectar los atributos en `fusionarGeometrias()`**. Ver D3: reintroduce
  por la puerta de atrás el defecto del texel único.
- **Abortar el fusionado cuando los atributos no coinciden**. Devuelve
  silenciosamente el ahorro de dibujos que esta fase compra.
- **Cualquier workaround de canales del mapa combinado** —`onBeforeCompile`, un
  shader, invertir R y G a mano—. El horno hornea ORM y three lee ORM; el arreglo
  va del lado del horno y ya está en curso. Un parche acá quedaría enterrado y se
  volvería un defecto en cuanto el horno se arregle.
- **Anisotropía 16** (la del terreno). Un animal no es un plano infinito visto de
  canto; paga muestras extra que casi nunca se justifican. Ver D5.
- **Rugosidad distinta por pieza** (el pico del ave iba en 0,5 y ahora va con la
  del cuerpo). Volver a partir el material por eso costaría un dibujo por animal
  en las 23 aves para un brillo de pico de dos centímetros a cinco metros. El
  `roughnessMap` del atlas varía la rugosidad igual.
- **Mantener V longitudinal** para respetar el patrón del horno. Ver D6: se
  cambia el eje de franja correcto en una especie por el tono correcto en 44.
- **Tocar `Peces.js` y `Cuerpo.js`.** El atlas no tiene celda para los siete
  peces ni para el jugador. `Peces.js` tiene su propio `fusionar()` con la misma
  omisión de `uv` que tenía `Fauna.js`, pero ahí es inofensiva: los peces se
  dibujan con `InstancedMesh` y color plano, sin un solo mapa. Anotado por si
  alguna vez se les hornea celda.
- **Levantar Vite o abrir el navegador.** Regla 4 de la ronda.

## Siguiente

- Nada pendiente de mi lado. Falta que el jefe corra su banco.
- Lo que necesito de afuera está en `.claude/flota/pendiente-r3-fauna.md`: la
  cabecera de `atlas.js` documenta los canales del mapa combinado al revés y
  habla de un `uv2` que three 0.169 ya no usa, y el manifiesto no declara la
  orientación de sus bandas (que es lo que le cuesta las franjas al zorrino).
- No commiteé nada.
