# Pendiente · ronda 7 · fase 4 · `vasija`

Pedidos para archivos que no son de esta fase. El código de la fase no depende de
ninguno para quedar en pie: son lo que queda chueco alrededor.

## 1 · `banco-r6-fase3.mjs:102` — el 115 escrito a mano (bloquea el 10/10)

**Qué**: `s.ok(todos.length === 115, 'son 115 los que hay que dibujar', …)` pasa a
116, o se deriva de los datos.

**Por qué**: 71 recursos + 44 cosas = 115 era la cuenta de la ronda 6. V3 pide un
recipiente sin cuero, y lo único de `herramientas.json` que es de esta fase es el odre
y los objetos nuevos. El odre no puede dejar el cuero, porque la premisa de la sección
3 del banco de esta fase lo exige. Queda un objeto nuevo, `metawe_greda`, y con él son
71 + 45 = 116. La cuenta está en `r7-vasija.md`, «Un choque entre V3 y V9». Mientras
tanto la sección 1 de `r6-fase3` da 5/6 y la regresión de `banco-r7-fase4` queda roja
por eso solo.

Lo que no se hizo para esquivarlo: declarar el metawe con `produce: []` o `esReceta`.
Así queda afuera de la cuenta, pero una receta no pasa por `Equipo.guardar()` y el
recipiente no existiría en el juego.

## 2 · `src/data/historia.json`, nodo `cesteria_junco`, `contextoHistorico`

**Qué**: la frase «Algunos tejidos apretados podían contener líquidos» exagera para
la región. Propuesta:

> Los cestos servían para recolectar piñones y frutos del bosque, y para almacenar
> grano. La cestería mapuche en espiral cosida —la aduja— queda tan tupida que retiene
> el agua que se le echa adentro (Piñeiro, 1967), pero se tejía con ñocha, al oeste de
> la cordillera, y no hay registro de cestos para llevar agua en el Nahuel Huapi.

**Por qué**: la fuente es Carrasco y Cisterna (2019), *Cestería mapuche: usos y
prácticas culturales*, Museo Mapuche de Cañete, p. 16, que cita a Piñeiro (1967,
p. 26). Es una prueba de estanqueidad de piezas como el llepu y el culco, no un uso
para cargar líquidos. El chaiwe, la pieza que sí trabaja con líquido, es un colador.
El detalle está en `r7-vasija.md`, «V3, la investigación».

## 3 · `src/data/historia.json`, nodo `alfareria_bicroma`, `efecto.herramienta`

**Qué**: sumar `"metawe_greda"` al lado de `"candil_grasa"`.

**Por qué**: por coherencia del dato. Hoy ningún código lee `efecto.herramienta`
(buscado en `src/`), y `Fabricacion` habilita por `objeto.tecnologia`, así que el
metawe ya se fabrica sin esto. El bloque espejo de `herramientas.json`
(`efectosAAgregar`) tampoco se tocó, por la misma razón.

## 4 · `src/systems/Fundicion.js:638` — el aviso de la hornada que espera por el líquido

**Qué**: cuando lo que no entró es un líquido y `inventario.liquido.cabe` es 0, el
aviso debería decir que hace falta un recipiente, no «hasta que hagas lugar».

**Por qué**: V5 ya funciona sin tocar nada, porque `agregar` dice la verdad y la hornada
queda `esperando`. Pero a quien no tiene recipiente, «hacé lugar» lo manda a vaciar el
bolso, y vaciarlo no le sirve. Es el mismo criterio que usa ahora el aviso de beber
(`Recoleccion.js`, caso `beber`).

## 5 · `banco-r7-fase4.falsar.mjs` — un defecto que el banco ve y el falsador no cuenta

**Qué**: `capacidad-sin-fuente` sale como «NO LO VIO», pero el banco sí lo ve. En
`aplanar()` la clave es `${s.num}·${c.desc}`, y `caidas` sólo cuenta claves que en la
base estaban en `true`. La descripción de la aserción de la sección 3 lleva adentro el
número del recipiente: en la base dice «… guarda (2)», y con el defecto, «… guarda
(9)». La que cae tiene una clave nueva, y el filtro la tira. Arreglo posible: sacar el
número de la descripción en el banco (dejarlo en el detalle), o contar también como
caída una clave nueva en `false`.

**Por qué**: reproducido a mano sobre una copia con el metawe en 9. La sección 3 da ROJO
con «MAL metawe_greda: la fuente dice para cuánto guarda (9)». La corrida del
falsador contra este código dio lo vio 23/24 y controles 3/3, y el único «no lo vio»
es éste.

## 6 · Deuda de texto: «115» en los comentarios

`Iconos.js` (encabezado, `RECETAS`) y `Bolso.js` (encabezado, `_asegurarIconos`) dicen
«115 iconos». Con el metawe son 116. No se tocaron: de `Iconos.js` es de esta fase
sólo el icono nuevo, y de `Bolso.js` sólo lo del líquido.
