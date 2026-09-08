# RONDA 4 — LA CADENA DE FABRICACIÓN

> Abierta el 7/9/2026 a pedido del dueño: *«actualmente en el juego no hay una
> sucesión de eventos lógico para poder construir y lograr cometidos. Necesito
> tablones pero no sé cómo hacerlos. Tengo que cazar pero, ¿con qué?»*.
> Referencia que puso él mismo: Rust —hacha de piedra para cortar troncos, maza
> para procesar piedra.
> Rama: sale de `main`, que ya tiene la ronda 3 fusionada.

Antes de tocar nada: `ESTADO.md`, y de ahí la sección **«Trampas de medición ya
pagadas»**, que son ocho y costaron una sesión cada una.

---

## El diagnóstico, medido sobre el código

**Había dos compuertas en veintinueve mil líneas.** `Mineria.js:127` pide
`disponiblePara('herramienta') > 0` para abrir cantera —y se satisface con un
asta suelta en el bolso— y `Caza.js:128` pide aprender el arco. Todo lo demás se
junta a mano limpia desde el primer minuto. No es que la progresión esté mal
calibrada: no existe.

**El recurso `tronco` no lo entregaba nada.** `COSECHA_SOTOBOSQUE.tronco`
devuelve leña y corteza. La única forma de satisfacer un pedido de `tronco` era
la equivalencia `madera_dura → tronco` de `Recursos.js:29`, o sea que una rama de
0,8 kg contaba como un rollizo de 6 kg. Y de `tronco` cuelgan la cabaña, la
canoa, la capilla y —vía aserradero— la tabla y el poste. **Ésa es, literal, la
pregunta del dueño**: los tablones no se sabían hacer porque no se podían hacer.

**Ocho tecnologías del árbol no producían nada.** `curtido_cuero`,
`telar_witral`, `fuego_friccion`, `punta_proyectil`, `boleadora`,
`lasca_obsidiana` y las demás tenían `efecto: null`: se pagaban con puntos de
saber y con materiales, y no habilitaban una sola regla en ningún sistema. El
árbol entero podía quedar apagado sin que cambiara nada del juego. Es el mismo
defecto que la ronda anterior encontró en el fuego y en la recolección: el
sistema estaba escrito y no existía para el jugador.

## La decisión de diseño

**Dos ejes que se multiplican**, y es lo que separa esto de un survival de bosque
genérico:

- **Poder** — la herramienta. Cinco niveles: manos, lasca de obsidiana, hacha de
  piedra, maza y cuñas, hierro.
- **Permiso** — la jurisdicción, que el juego ya dibuja en el mapa. Dentro del
  Parque sólo se junta lo caído; talar y abrir cantera van fuera del área
  protegida.

Herramienta sin permiso es furtivismo; permiso sin herramienta no sirve de nada.
La ley deja de ser un cartel que interrumpe y pasa a ser la mitad del árbol.

**Se fabrica desde el bolso**, sin banco de trabajo — decisión del dueño el
7/9/2026. Excepciones por motivo físico y no por fricción inventada: el hierro
pide fragua, la brea y el curtido piden fogata.

## El estado al abrir la ronda

`src/data/herramientas.json` existe y valida: 57 objetos en 9 categorías, 29
acciones, 5 tecnologías nuevas, 2 obras, 16 recursos nuevos, sin una sola
referencia colgada. **Es dato puro: no lo importa ningún sistema.** El juego se
comporta hoy exactamente igual que antes de escribirlo, y eso está dicho al dueño.

## Lo que esta ronda tiene que probar antes de escribir código

Cuatro revisiones independientes, lanzadas el 7/9/2026. Ninguna puede editar el
dataset: se aplica la lección de la ronda 2 —quien escribe el arreglo no escribe
el banco que lo mide.

| Agente | Bitácora | Encargo |
|---|---|---|
| `economia` | `r4-revision-economia.md` | Cierre transitivo desde cero, candados circulares, presupuesto de 38 kg, costo de saber acumulado contra los puntos que el juego entrega |
| `rigor` | `r4-revision-rigor.md` | Cada afirmación histórica, arqueológica y legal contra los datasets ya verificados y contra fuentes públicas |
| `codigo` | `r4-revision-codigo.md` | Si las líneas citadas en `engancheAlCodigo` dicen lo que se afirma, y los 15 efectos declarados contra el sistema que los pueda consumir |
| `juego` | `r4-revision-juego.md` | Si la cadena se disfruta o es una lista de mandados, los primeros 30 minutos, qué objetos sobran, y si empujar al jugador fuera del Parque traiciona la tesis |

## La trampa que esta ronda tiene que evitar

El proyecto ya cometió este defecto y está documentado: `curtido_cuero` declaraba
una tecnología que no producía nada, y nadie se enteró durante meses. El dataset
nuevo declara quince efectos —`luz`, `abrigo`, `resistenciaPicadura`,
`devolucionSegura`, `recuperacion` y once más— y **varios no tienen hoy ningún
sistema que los pueda leer**. Están anotados en `engancheAlCodigo.pendienteSinSistema`.

La regla para el cierre: **o el efecto se implementa, o el objeto se recorta**.
Un efecto declarado que nadie consume es exactamente el mismo defecto con otro
nombre, y esta vez no hay excusa porque está escrito de antemano.
