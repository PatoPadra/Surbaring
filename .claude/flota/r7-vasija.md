# Bitácora · ronda 7 · fase 4 · `vasija`

Encargo: que los líquidos viajen en recipientes. Contrato V1–V9 en `RONDA7.md`,
sección `## FASE 4`. Banco: `banco-r7-fase4.mjs` (no se edita).

## 13/9 · Lectura

- Leídos enteros: la sección de la fase en `RONDA7.md`, el banco, `Inventario.js`,
  `Equipo.js`, `Bolso.js`; el caso `beber` de `Recoleccion.js`; `Fundicion.actualizar`
  y `retirar`; las fichas de odre, canasto, mochila y candil; `cesteria_junco` y
  `alfareria_bicroma` en `historia.json`; la receta de cerámica.
- Sin bitácora anterior: se arranca de cero.

## 13/9 · Lo medido antes de escribir

Con `scratchpad/cuenta.mjs`, contra el código de hoy:

- `RECURSOS` son 71 y las cosas de `herramientas.json` que no son receta
  (`!(esReceta || produce)`) son 44: **71 + 44 = 115**. Los objetos, con las 12
  recetas, son 56.
- La hoja de iconos pesa **130,33 kB** de los 140 que permite `banco-r6-fase3`. El
  icono del odre ocupa 1090 bytes en la hoja y el del candil 852: un icono nuevo del
  mismo porte deja la hoja cerca de 131,4 kB.
- Pila: el agua apila de a 2, la infusión de a 10, la cerámica de a 5.

### Un choque entre V3 y V9, con los números

`banco-r6-fase3.mjs:102` pide `todos.length === 115`, y el 115 está escrito a mano.
V3 exige un recipiente sin cuero. Un recipiente, para el banco de esta fase, es un
objeto de `herramientas.objetos` con `efecto.guardaAgua > 0`. Lo que es mío en ese
archivo es el odre y los objetos nuevos. El odre no puede dejar el cuero: la premisa de
la sección 3 es que el recorrido ve su cuero curtido. Queda un objeto nuevo, y un objeto
nuevo que no sea receta hace 71 + 45 = **116**. Así, la sección 1 de `r6-fase3` da 5/6 y
la regresión de esta fase (sección 9) se pone roja.

La salida que no se toma: declararlo con `produce: []` o `esReceta`, que lo saca de la
cuenta. Una receta no pasa por `Equipo.guardar()`, porque `Fabricacion` mete lo que
produce en el bolso. El recipiente no existiría nunca en el juego, y sería esquivar el
banco.

Otras cosas medidas que ordenan el diseño:

- `new Inventario` aparece una sola vez en `src/` (`main.js:288`): los depósitos no son
  inventarios, así que el tope no les llega.
- `sacar()` tiene dos llamadores: `tirar_obj` del bolso y `Equipo.equipar()`. Por eso el
  derrame no puede vivir adentro de `sacar()`, porque equipar derramaría. Va explícito en
  el bolso.
- `Fabricacion.estado()` no mira el nivel de la mano: mira tecnología, materiales,
  estación y lugar. Un objeto de nivel 3 se fabrica sin herramienta de nivel 3, y el
  nivel del recipiente no mete cuero por la ventana.

## 13/9 · V3, la investigación

### La cestería tupida de `historia.json`: verificada a medias, y no sirve para la región

`cesteria_junco` dice «algunos tejidos apretados podían contener líquidos». Lo que se
encontró:

- **Sí hay un dato**, y es de Chile, no del Nahuel Huapi. Carrasco y Cisterna (2019),
  *Cestería mapuche: usos y prácticas culturales*, Bajo la Lupa, Museo Mapuche de
  Cañete, p. 16, citan a Olga Piñeiro (1967), *La cestería chilena*, p. 26. Habla de la
  técnica de **aduja** (espiral cosida) y dice que es «tan bien amarrado que se puede
  inclusive echar agua dentro del objeto tejido sin que deje pasar una gota». La
  técnica se usa en Arauco, Cautín y San Juan de la Costa (Mora, 1992, en el mismo
  artículo). El material de enlace es la **ñocha**, que la ronda 4 ya sacó del juego
  por endémica de Chile. El relleno es coirón y el alma es colihue.
- **Es una prueba de estanqueidad, no un uso documentado.** Ni Piñeiro, en lo citado,
  ni el artículo dicen que esos cestos se usaran para cargar agua. Las piezas de aduja
  son el llepu, el paquei, el loñho, el culco y el gañihue: fuentes, platos y canastos.
  El **chaiwe**, que sí trabaja con líquido, es un colador: sirve para lavar el mote y
  colar la chicha, o sea para dejar pasar el agua (mismo artículo; Tesauro Regional
  Patrimonial, «chaiwe»).
- La cestería que sí cargó agua es la de la Gran Cuenca norteamericana. Los paiute
  hacían botellas de tejido triple, impermeabilizadas con resina de pino derretida y
  repartida con piedras calientes adentro. Fuente: Oregon History Project, «Paiute Water
  Basket»; Smithsonian NMAI, *Infinity of Nations*, «Water bottle baskets». O sea, lo
  tupido solo no alcanza: hace falta la resina. Y no es de acá.
- Para el Nahuel Huapi no apareció nada de cestos para líquidos.

**Veredicto**: la frase exagera. Un tejido en aduja retiene agua echada adentro. Pero
en la región, con junco, no hay registro de un recipiente para llevarla. El canasto de
junco no se vuelve recipiente. Queda como pedido corregir la frase de `historia.json`.

### La cerámica: sí, y con dato del propio parque

- Hajduk, Scartascini, Vargas y Lezcano (2018), «Arqueología de la Isla Victoria, Parque
  Nacional Nahuel Huapi», *Intersecciones en Antropología* (Redalyc 179559026009):
  - hay cerámica desde ca. 640 años AP;
  - «se reconoce, al menos, la presencia de formas de ollas y jarras»;
  - hay «fragmentos de recipientes sin cocción, lo que indicaría la producción local».
- **Metawe**, según el Tesauro Regional Patrimonial (término 2581, que cita a Joseph,
  1931): recipiente mapuche de uso doméstico para servir líquidos. Tiene base plana,
  cuerpo globular, cuello cilíndrico o troncocónico, boca ancha y asa vertical. Hay
  *fütametawe* (cántaros grandes) y *pichimetawe* (chicos).
- Para el tamaño, un jarro bícromo del Complejo El Vergel en SURDOC (registro 67-30):
  13 cm de alto y 13,4 de ancho, un «contenedor de base convexa y asa plana». Una
  esfera de 13 cm son 1,15 litros, así que esa pieza es un pichimetawe de alrededor de
  un litro.
- No apareció ninguna capacidad en litros publicada. El número se saca de la cuenta
  geométrica, y se dice como criterio.

### Decisión

- **Metawe de greda**: id `metawe_greda`, tecnología `alfareria_bicroma`, 2 cerámicas
  y 3 fibras, a mano. Guarda **2** medidas: un metawe mediano, de unos 16 cm de
  cuerpo (una esfera de 16 cm son 2,14 litros), el doble del pichimetawe medido.
  Pesa 0,9 kg. Queda en nivel 3, como el candil, que es la otra cosa de la misma
  tecnología.
- El odre sigue guardando 6 en 0,8 kg y queda como la mejora: el triple de agua en
  menos peso.
- Licencia que se declara en la ficha: la greda cocida a fuego abierto es frágil, y el
  juego no la rompe en el bolso. La red de fibra para colgarla es el agregado de
  diseño, no un dato.
- Ojo con el falsador (`capacidad-sin-fuente` le suma 7 al número): el texto no puede
  decir «9» ni «nueve».

## 13/9 · Código, en curso

Hecho, sin correr todavía:

- `herramientas.json`: agregado `metawe_greda`, con `fuente`, `criterio` y `nota`,
  después del odre. El odre no se tocó. El bloque `efectosAAgregar` no se tocó, porque
  no lo lee ningún código (buscado en `src/`).
- `Iconos.js`: el icono `metawe_greda`, con la panza redonda, el cuello, el agua en la
  boca, el asa y una malla de fibra.
- `Equipo.js`, en el bloque del constructor: la ficha lleva `guardaLiquido` (leído
  de `efecto.guardaAgua`), y hay `guardaAparte`, que suma lo puesto aunque esté
  gastado.
- `Recoleccion.js`: el aviso de beber distingue tres casos (sin recipiente, llenos,
  bolso al tope). El cartel promete « (1 × agua)» sólo si `inventario.entra('agua', 1)`
  da 1.
- `Bolso.js`: `tirar_obj` mira si bajó `liquido.cabe` y, si bajó, llama a
  `inventario.derramar()` y lo dice en el aviso. La cabecera de la grilla dice
  «líquido N de M medidas». Falta la línea de lo que guarda en el detalle del
  recipiente.
- `Inventario.js`: el encabezado y `LIQUIDOS`. **Faltan** el constructor
  (`guardaAparte`), `fichar`, `_entra`/`entra`, la puerta `liquido` y `derramar`.

Actualización: `Inventario.js` quedó completo. Tiene `guardaAparte` en el
constructor, `fichar` con `guardaLiquido` en medidas enteras, `agregar` montado sobre
`_entra` (los tres topes), `entra()` pública para el cartel, la puerta `liquido`
contada cada vez sin caché, y `derramar()`, que no se llama desde el propio archivo. El
detalle de un recipiente en el bolso dice «guarda N medidas de líquido».

Falsa alarma, anotada para que no se repita: un chequeo mío con la expresión copiada
a mano en la línea de comandos decía que el texto del metawe «dice 9», y rompía el
falsador `capacidad-sin-fuente`. Con la función `diceNumero` sacada tal cual del
banco (`scratchpad/dice.mjs`) da `dice 2: true` y `dice 9: false`. El error era el
escapado de la línea de comandos. «(1931)», «1967» y «2019» no dicen 9.

## 13/9 · Corridas

- `banco-r7-fase4`, secciones 1 a 8 (`BANCO_SIN_BUILD`): **8/8**, todas las
  aserciones en verde. Los avisos, como salieron:
  - beber sin recipiente: «no tenés en qué llevarte una medida: el agua viaja en un
    recipiente»;
  - con el odre lleno: «los recipientes van llenos, 6 de 6 medidas»;
  - el cartel con lugar: «Beber agua (1 × agua)»;
  - soltar: «Tiraste odre · Se derramaron 4 medidas de agua, que ya no tenían en qué ir
    · Cargás 6.8 kg».
- `banco-r6-fase3` solo, secciones 1 a 4: **5/6**, y cae una sola aserción, la
  predicha: «son 115 los que hay que dibujar [116]». Lo demás del icono nuevo pasa:
  - no hay dos idénticos;
  - el mínimo sigue en 4 formas;
  - hay 116 siluetas distintas;
  - la hoja pesa **131,6 kB** de 140;
  - cada id tiene su clase en la hoja.
- La corrida entera quedó lanzada en segundo plano; la salida va a
  `scratchpad/banco-entero.txt`.
- Relectura del diff entero (6 archivos, +311 −45). Lo que se miró a propósito:
  - `_entra` calcula el tope del líquido sólo para los tres líquidos (la condición va
    antes de contar);
  - `agregar` sigue devolviendo lo que entró de verdad;
  - `derramar()` sólo lo llama el bolso;
  - `equipar` y `desequipar` no pasan por ahí;
  - el cartel promete con `entra()`, la misma cuenta que `agregar`.
- **Corrida entera** (`node .claude/flota/banco-r7-fase4.mjs`): **total 9/10**.
  - Secciones 1 a 8: en verde.
  - Sección 10 (`vite build`): en verde.
  - Camino feliz: 10/10.
  - Sección 9: roja por una sola línea, «banco-r6-fase3.mjs sigue en 6/6 [5/6]». Es el
    115 escrito a mano, con la cuenta de más arriba.
  - Los otros seis bancos de la regresión, en verde: r6-fase1 7/7, r6-fase2 8/8,
    r7-fase1 6/6, r7-fase2 4/4, r7-fase2b 7/7, r7-fase3 6/6.
  - **No se esquivó**: el pedido va en `pendiente-r7-vasija.md`, punto 1.
- Después de la corrida entera va el falsador del jefe
  (`banco-r7-fase4.falsar.mjs`), no a la par: los bancos de la regresión tienen tope
  de tiempo, y no conviene que compitan por el procesador.

## 13/9 · El falsador del jefe, contra este código

`node .claude/flota/banco-r7-fase4.falsar.mjs`: **lo vio 23/24 · por otro motivo 0 ·
NO lo vio 1 · no se pudo plantar 0 · controles 3 verdes, 0 rojos**. La base limpia
tiene 89 aserciones, todas en verde.

El que no vio es `capacidad-sin-fuente`, y **el ciego es el falsador, no el banco**.
Se reprodujo a mano: copia de `src/` en `scratchpad/copia-cap`, el metawe con 9, y el
banco con `BANCO_SRC` sobre la copia. La sección 3 da ROJO con «MAL metawe_greda: la
fuente dice para cuánto guarda (9)». O sea, el banco lo ve.

La causa: el falsador arma la clave de cada aserción con su descripción
(`${s.num}·${c.desc}`), y cuenta como caída sólo la que en la base existía y estaba
verde (`baseMapa.get(k) === true`). Pero la descripción lleva adentro el número que el
defecto cambia:

- en la base, «metawe_greda: la fuente dice para cuánto guarda (2)»;
- con el defecto, «… (9)».

La aserción que cae tiene una clave que la base no conoce, y el filtro la descarta. Lo
mismo le pasa a «metawe_greda guarda las 2 que declara», que con el defecto se llama
«… las 9 …», aunque ésa sigue en verde. No es de esta fase arreglarlo. Va como pedido
en el pendiente.

## 13/9 · Qué quedó, qué falta, deudas y dudas

**Hecho**: V1 a V8 en verde en el banco. En V9, `vite build` y seis de los siete bancos
anteriores están en verde. El séptimo, `r6-fase3`, cae por el 115 escrito a mano.

**Falta, fuera de esta fase** (en `pendiente-r7-vasija.md`):

- el 115 de `banco-r6-fase3.mjs:102`;
- la frase de `cesteria_junco`;
- `metawe_greda` en el efecto de `alfareria_bicroma`, en `historia.json`;
- el aviso de `Fundicion` cuando lo que espera es líquido y no hay recipiente.

**Deudas** que se ven desde acá y no se tocan:

- Que dos odres sean dos aguas (la decisión del jefe).
- Los comentarios «115» de `Iconos.js` y `Bolso.js`.
- El panel lateral del HUD no dice cuánto líquido se lleva: sólo lo dice el bolso.
- La durabilidad del metawe (60) y la del odre (100) no las consume nadie.
- Llenar un recipiente sin beber no existe: la única entrada de agua al andar sigue
  siendo beber con sed, porque con la sed arriba de 92 la tecla no ofrece beber. Es de
  «lo que NO es de esta fase».

**Dudas**:

1. **El nivel del metawe.** Quedó en 3, como el candil, que es la otra cosa de
   alfarería. El odre es nivel 2 y guarda el triple, así que en el árbol parece que se
   retrocede. El nivel no gatea nada (`Fabricacion.estado` no lo mira) y V3 habla de la
   cadena. Si se lee raro en el juego, bajarlo a 2 es una línea.
2. **El derrame con un guardado viejo.** Si se suelta el recipiente, se derrama todo
   lo que no cabe, también lo que sobraba del guardado, que hasta ese momento se
   conservaba. La otra lectura es derramar sólo lo que guardaba ese recipiente. El
   banco no fija ninguna de las dos.
3. **El cartel con pesca a mano.** Queda «Beber agua (1 × agua) · P para tirar la
   línea». El paréntesis no es el último, así que la gramática de la fase 1 no lo lee
   como promesa. Igual sólo aparece cuando la medida entra, así que no promete de más.

Decisión sobre el derrame con un guardado viejo: si se suelta un recipiente,
`derramar()` deja el líquido en lo que cabe después, y con eso se va también lo que
sobraba del guardado. Si se suelta algo que no guarda, no se derrama nada. La regla
es literal: «derrama lo que ya no cabe».

