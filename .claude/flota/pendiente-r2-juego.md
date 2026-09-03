# Pendiente del jefe `juego` sobre `src/main.js` — ronda 2

Dos parches, de una línea cada uno. Es cableado, no lógica, y **sin ninguno de
los dos no se rompe nada**: las dos funciones que los usan arrancan con un
encadenamiento opcional. Lo único que pasa sin ellos es que no se cumple la
mejora.

## 1. `recoleccion.fundicion = fundicion;`

**Por qué.** `Recoleccion._avisarTaller()` (nuevo) enseña la tecla `G` en el
único momento en que sirve: el paso en que el bolso completa la primera fogata.
Para saberlo tiene que preguntarle a la fundición qué pide una fogata y si el
jugador ya levantó algún horno, y hoy `Recoleccion` recibe `caza`, `mineria` y
`pesca` pero no `fundicion`.

`G` era la única de las teclas del juego sin **ninguna** forma de descubrirse, y
no es un panel más: `grep` sobre todo `src/` dice que `construccion.levantar()`,
`guardarTodo()` y `retirar()` los llama **únicamente** `src/ui/Taller.js`. Sin
`G` el jugador no construye, no guarda, no retira y **no prende fuego** — y sin
fuego no hay comida cocida, ni agua hervida, ni calor, ni carbón, ni cadena del
metal.

**Sin el parche no se rompe nada**: `_avisarTaller()` arranca con
`if (this._talleraAvisado || !this.fundicion) return;`, así que sin la línea
simplemente no avisa. Es exactamente el defecto que quiere arreglar, nada más.

**Ubicación**: `src/main.js`, alrededor de la línea 337, en el bloque que ya
engancha las otras tres dependencias.

```js
// ANTES
  recoleccion.caza = caza;
  recoleccion.mineria = mineria;
  recoleccion.pesca = pesca;
```

```js
// DESPUÉS
  recoleccion.caza = caza;
  recoleccion.mineria = mineria;
  recoleccion.pesca = pesca;
  // Para que la tecla del taller se enseñe sola en el momento en que sirve:
  // ver `Recoleccion._avisarTaller()`.
  recoleccion.fundicion = fundicion;
```

**Ojo con el orden**: `fundicion` tiene que estar construida antes de esta línea.
En el archivo de hoy se construye más arriba que el bloque de `recoleccion.*`, así
que va tal cual; si al integrar quedara al revés, mover la línea abajo de la
construcción de `fundicion` alcanza.

---

## 2. `recoleccion,` en las dependencias de `Partida`

**Por qué.** Los dos avisos que enseñan una tecla (`G` y `Tab`) se dan **una vez
y nunca más**, y esos dos testigos viven en `Recoleccion`. Sin guardarlos, «una
vez» es «una vez por sesión»: quien cierre el juego con seis leña y cuatro piedra
en el bolso y sin ningún horno levantado se come el aviso del taller, nueve
segundos, **en cada arranque**. `Partida._serializar()` ya los escribe bajo
`enseniado` y `cargar()` los repone, pero para eso necesita la referencia.

**Ubicación**: `src/main.js`, en el `new Partida({ … })` de alrededor de la
línea 378. `recoleccion` ya está construida bastante más arriba (línea ~334).

```js
// ANTES
  const partida = new Partida({
    jugador, inventario, saberes, codice, construccion, fundicion, tiempo,
    mundo, hud, exploracion,
```

```js
// DESPUÉS
  const partida = new Partida({
    jugador, inventario, saberes, codice, construccion, fundicion, tiempo,
    mundo, hud, exploracion, recoleccion,
```

---

## Lo que NO va acá pero el coordinador tiene que rutear

**`src/world/Vegetacion.js:65-68` — del agente `mundo`, no lo toqué.** El
`.slice(0, 26)` recorta una lista filtrada de **38** especies, así que **12 no
existen en el juego**, elegidas por orden de archivo y en silencio. Entre ellas
estaban `cana_colihue` —el recurso que el dueño nunca vio— y las tres coníferas
exóticas que sostienen la tesis del control de invasoras y de la pinocha como
yesca. El detalle y el parche sugerido están en `.claude/flota/r2-juego.md`,
sección «FRENTE 2 CERRADO».

Lo resolví por mi lado para la caña, sin costo de cuadro y sin tocar su archivo:
intercambié `cana_colihue` con `taique` en `src/data/flora.json`, que es mío.
Pero el recorte silencioso sigue ahí para las otras once.

**`Construccion.alCambiar` es una sola ranura, no una lista, y hoy está libre.**
Si el agente `carta` la engancha para redibujar las marcas de obras en el mapa y
mañana alguien más la necesita, el segundo pisa al primero sin avisar.

**`src/systems/Hallazgos.js` — del agente `carta`. Tres cosas, una es mía.**

La revisión independiente (`.claude/flota/r2-revision-juego.md`, D2/D3/D4)
encontró tres defectos ahí. No lo toqué porque es archivo de `carta`, pero **una
de las tres la causé yo** y hay que rutearla sí o sí:

- **D4, y es consecuencia directa de mi cambio.** `Hallazgos._aguaCerca()` usa
  radio 3 m y lleva el comentario «el mismo criterio que usa `Recoleccion` para
  dar arcilla». **Dejó de ser cierto**: `Recoleccion` ahora usa
  `_orillaCerca()`, 12 m, porque con 3 m la arcilla era inalcanzable. Medido
  alrededor del punto de partida sobre 15.418 muestras: 0,05 % contra 0,77 %.
  O sea que el mapa marcaría el **6 %** de la arcilla real. Es «ofrecer lo que no
  se puede cumplir» mudado del HUD al mapa. La función a copiar está en
  `src/systems/Recoleccion.js`, se llama `_orillaCerca()`.
- **D2**: `Hallazgos._mirarVegetacion()` usa `sotobosque.masCercano()`, que
  devuelve la instancia más próxima **de cualquier tipo**. Es textual el defecto
  que `bucle` diagnosticó y arregló en `Recoleccion._delSuelo()` con la tabla
  `VALE`, reintroducido en un archivo nuevo. La tabla y el barrido único están
  escritos y comentados en `Recoleccion.js`: se copian.
- **D3**: `r2-carta-hallazgos.mjs` construye `new Hallazgos({ mundo, mineria })`
  sin `vegetacion` ni `sotobosque`, así que con el encadenamiento opcional
  `_mirarVegetacion()` devuelve 0 siempre y el banco declara 60/60 sin haber
  ejercitado nunca arcilla, cañaveral ni obsidiana.
