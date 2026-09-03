# Revisión independiente — ronda 2

Revisor externo. **Sólo lectura sobre `src/`**: no toqué una línea de código.
Todo se verificó leyendo el código y corriendo Node; no se levantó el servidor
ni se abrió el navegador.

## Qué corrí

| Instrumento | Resultado |
|---|---|
| `node .claude/flota/r2-juego-integridad.mjs` | verde · 7 JSON, 25 módulos, 55 recursos fichados, 0 entregados sin ficha |
| `node .claude/flota/r2-cantera.mjs` | reproduce **exactos** los números declarados (55→12, 63,5 %→6,2 %, mata 79,3 %) |
| `node .claude/flota/r2-carta-hallazgos.mjs` | «Todo bien», y ver D2/D3 |
| `r2-carta-{arbol,exploracion,mapa,relieve}.mjs` | verdes |
| `node .claude/flota/lint-shader.mjs` | verde · 1 aviso en `Cielo.js` (sin chunks `logdepthbuf`) |
| banco propio de revisión | ANTES real contra `git show main:src/systems/Mineria.js`; censo de sitios patrimoniales; `_orillaCerca` vs `_aguaCerca`; alcanzabilidad de las ramas |

## Veredicto en una línea

**El defecto de la captura está arreglado de verdad, y mejor de lo que dice la
bitácora.** Pero el arreglo dejó una rama muerta nueva por el mismo mecanismo
que el de la arcilla, y el sistema nuevo `Hallazgos.js` reintrodujo textual un
defecto que esta flota ya había diagnosticado y arreglado en la ronda 1.

---

# 1 · Lo que confirmé, con evidencia

### La cantera: arreglada, y el banco subdeclara la mejora

Corrí el mismo recorrido de 3210 m contra la clase `Mineria` **de `main`**
(`git show main:src/systems/Mineria.js`, cargada como módulo aparte), que es lo
que el banco del autor ya no puede hacer:

| recorrido de 3210 m, 8 rumbos, paso 1,7 m | cambios | uno cada | visible |
|---|---|---|---|
| **ANTES de verdad** (clase de `main`, por píxel) | **68** | **47 m** | **61,6 %** |
| «ANTES» que imprime `r2-cantera.mjs` | 55 | 58 m | 63,5 % |
| **DESPUÉS** | **12** | **267 m** | **6,2 %** |

Las tres afirmaciones centrales se sostienen: celda de 24 m en vez de píxel,
`quePuedoHacer()` consulta `evaluar()`, chatarra y árido separados. Los 12
cambios que quedan son todos de chatarra.

### La arcilla: el diagnóstico viejo era cierto, y el arreglo no rompe nada

- **Comprobado contra el código de `main`**: la rama de beber estaba arriba, sin
  condición y con `return`; `_aguaCerca()` es determinista sobre la misma
  posición y el mismo tick. Probabilidad **exactamente** cero. No era «raro».
- **El problema simétrico no existe**: medido sobre 15.418 muestras en tierra
  alrededor del punto de partida, las posiciones con `_aguaCerca` verdadero y
  `_orillaCerca` falso son el **0,000 %**. Nada que antes diera arcilla dejó de
  darla.
- `_orillaCerca` 0,77 % contra `_aguaCerca` 0,05 %: **confirmado**.

### La caña colihue: canje limpio, y nada quedó colgando

`cana_colihue` índice filtrado **22** (entra), `taique` **32** (sale). JSON
válido, 63 especies, sin ids duplicados. `grep taique` sobre todo `src/`: **cero
referencias de código** — sólo su propio `nombreMapuzugun` y una mención en prosa
dentro de la `descripcionEducativa` del corcolén.

Lo que se pierde al sacar el taique: deja de instanciarse y por lo tanto **deja
de poder identificarse** (`Codice` lista `this.flora.especies`, las 63, así que
su ficha queda como fila inalcanzable). Es el intercambio exacto de lo que le
pasaba a la caña, y la caña da `caña` (Vivac, Arco de colihue), semillas
comestibles y un bioma; el taique no da nada. **Canje limpio.**

⚠ `.slice(0, 26)` **sigue en `src/world/Vegetacion.js:107`**: `mundo` no lo tocó.
O sea que el canje pasó a ser carga estructural — si alguien reordena
`flora.json` o cambia el corte, la caña desaparece otra vez en silencio.

### `Bolso.js`: el botón hace lo que dice

Manejador real (delegación sobre `button[data-accion]`, rama `accion === 'curar'`),
descuenta con `inventario.quitar(id, 1)` —que devuelve booleano y sólo saca si
alcanza—, tapa a 100 con `Math.min`, y con salud ≥ 99,5 avisa en vez de gastar.
Tres recursos con `cura`: `infusion_canelo` (8), `emplasto_maqui` (15),
`lavado_michay` (10). **Correcto.**

### El cableado del coordinador: sin defectos

Orden de construcción correcto (`mundo` 126 · `vegetacion` 208 · `sotobosque` 215
· `mineria` 298, todos antes de `Hallazgos` en 360). Ningún `undefined` llega a
un constructor. `hallazgos.revisar()` sale por `_acumulado < 0,5 s` y después por
`k === _ultimaCelda`: dos sumas y una comparación por cuadro. `guardar()` sólo
corre con novedad, acotada por cambio de celda de 128 m. **No agrega trabajo por
cuadro.**

---

# 2 · Defectos encontrados, por gravedad

## D1 · GRAVE — la rama de `beber` de abajo es código muerto, por el mismo mecanismo que la arcilla

`Recoleccion.js:227`, `if (aguaAMano) return this._beber();`, está **debajo** de
`if (mata)` (línea 220). Con un coirón por m² —medido por `bucle`, citado en el
propio encabezado del archivo— la probabilidad de que no haya ninguna mata en los
5 m es `e^−78,5 ≈ 8×10⁻³⁵`. La línea no se ejecuta nunca.

Es exactamente la forma del defecto de la arcilla, introducida por el mismo
cambio que lo arregló. Dos consecuencias concretas:

1. **Se perdió la única forma de descubrir la tecla `P`.** `grep` sobre todo
   `src/`: la cadena «P para tirar la línea» aparece en un solo lugar,
   `Recoleccion.js:265`, dentro de `_beber()`. Con hidratación ≥ 92 parado en la
   orilla ya no aparece.
2. **Se estranguló la única fuente de `agua` del juego.** `grep`:
   `inventario.agregar('agua', 1)` existe una sola vez, en `Recoleccion.js:367`,
   dentro del caso `beber`. Como beber sube +32 y `_beber` sólo se ofrece con
   `sed < 92`, ahora se puede juntar **~1 unidad por ciclo de sed**; antes se
   llenaba la cantimplora parado en la orilla. `agua` la piden 6 recetas, entre
   ellas `agua_hervida` (2), `infusion_canelo` (2), `lavado_michay` (3) y
   `emplasto_maqui` (1) — o sea **la botica que este mismo cambio acaba de hacer
   visible en el Bolso**. Es un cambio de equilibrio que nadie decidió.

Sugerencia (no la apliqué): mover esa línea arriba de `if (mata && mata.vale > 0)`,
o al lugar donde hoy está la rama `ficha`.

## D2 · GRAVE — `Hallazgos._mirarVegetacion()` es código muerto: 2 de 5 tipos no se marcan nunca

`src/systems/Hallazgos.js:230` usa `sotobosque.masCercano(pos, 22)`, que devuelve
**la instancia más próxima de cualquier tipo** (leído en `Sotobosque.js`). Con las
densidades de `bucle` (coirón 1 m², michay y helecho 24, piedra 64), la
probabilidad de que la más cercana sea una `piedra` es
`λ_piedra / Σλ ≈ (1/64)/1,10 ≈ **1,4 %**`. Y arcilla pide además `_aguaCerca`
(0,05 % de las posiciones): el producto da ≈ **7×10⁻⁴ %** por cambio de celda.

**Es el mismo defecto que `bucle` diagnosticó en `Recoleccion._delSuelo` y arregló
con la tabla `VALE`, reintroducido textual en un archivo nuevo.** El cañaveral
(`vegetacion.masCercana(pos, 26)`) corre la misma suerte, aunque menos grave
porque adentro de un cañaveral la caña suele ser la más cercana.

Evidencia directa, del banco **del propio autor**, caminata de 30 km:

```
  Por tipo: arena 0 · chatarra 70
```

Cero de cinco tipos salvo chatarra, y el banco imprime «Todo bien».

## D3 · GRAVE — `r2-carta-hallazgos.mjs` es ciego por construcción a 3 de los 5 tipos

Líneas 268, 284, 285, 302, 310: `new Hallazgos({ mundo, mineria })`. **Sin
`vegetacion` ni `sotobosque`.** Con el encadenamiento opcional
`this.vegetacion?.masCercana?.(...)`, `_mirarVegetacion()` devuelve 0 siempre y
no tira ningún error. El banco declara 60/60 sin haber ejercitado nunca arcilla,
cañaveral ni obsidiana.

Es la trampa nº 3 de `ESTADO.md` otra vez —«el terreno sintético no muestra todo»—
pero con dependencias en lugar de terreno: el punto ciego no está en el mundo
falso, está en las dependencias que el banco no molestó en construir.

## D4 · MEDIO — el mapa marca la arcilla con un criterio que el juego ya no usa

`Hallazgos._aguaCerca()` (radio 3 m) lleva el comentario «El mismo criterio que
usa `Recoleccion` para dar arcilla». **Dejó de ser cierto con este cambio**:
`Recoleccion` usa `_orillaCerca()` (12 m).

Medido alrededor del punto de partida, 15.418 muestras en tierra: `_aguaCerca`
0,05 % · `_orillaCerca` 0,77 %. O sea que el mapa marcaría el **6 %** de la
arcilla real, y justo en la franja donde la rama de beber compite por la tecla.
Es «ofrecer lo que no se puede cumplir» mudado del HUD al mapa. Con D2 encima
hoy no se nota, porque no se marca nunca; si se arregla D2 sin arreglar esto, se
nota enseguida.

## D5 · MEDIO — «si el aviso aparece, la tecla funciona» no es cierto para la chatarra

La afirmación está escrita en el comentario de `Recoleccion.js:168` y es la vara
con la que se decidió dejar la chatarra arriba. Dos contraejemplos, ninguno
modelado por `r2-cantera.mjs` (que corre con `ahora = 0` y nunca extrae):

- **`_agotado`**: `hayChatarra()` es un hash puro de la posición y no consulta
  `agotados`. Después de levantar, la etiqueta sigue en pantalla **900 s** en esa
  celda de 24 m mientras la tecla contesta «Ya juntaste lo que había». Y
  `segundosTotales += dt` con `dt` real (`Tiempo.js:88`), así que son **15
  minutos reales**. Encima ahora se nota más: la chatarra es el 100 % de la
  etiqueta minera que queda.
- **`_sitioCercano`**: `recuperarChatarra()` niega y **cobra 5 puntos de saber
  más una infracción** dentro de 260 m de un sitio patrimonial; la rama del HUD
  no lo consulta. **Medido**: 98 de 81.641 posiciones que ofrecen chatarra en el
  mundo entero (**0,1 %**), y **0 %** alrededor del punto de partida —el sitio
  más cercano, Isla Huemul, está a 1632 m—. Lo anoto por honestidad: es real y
  es chico, no vale una sesión.

## D6 · MEDIO (método) — el banco ya no puede reproducir su propio «antes»

`etiquetaMinera(..., viejo: true)` sólo saltea `evaluar()`: sigue llamando a la
`yacimientoEn()` **nueva**, con las celdas de 24 m ya puestas. Por eso el «ANTES»
que imprime hoy (55 / 58 m / 63,5 %) no es el estado de `main` sino un híbrido.

Lo llamativo: el comentario de `Mineria.js:25-27` tiene los números **correctos**
(68 / 47 m / 61,6 %), de una corrida anterior a que el propio cambio contaminara
el banco. Hoy el código y la bitácora se contradicen y quien vuelva a correr el
banco no va a entender por qué. La mejora real es **mayor** que la declarada.

## D7 · MENOR — los avisos nuevos se pisan entre ellos y pisan al de la acción

`HUD.aviso()` (`HUD.js:203`) es **una sola ranura**: sobreescribe `.t`/`.d` y
reinicia el reloj.

- `actuar()` agenda `_avisarTaller()` con `setTimeout(…, 0)` — el mismo tick del
  navegador. El aviso «4 × leña» se dibuja y lo tapa el del taller antes de que
  se lea un solo carácter. El comentario dice «no se lo pisa»; sí se lo pisa.
- Si la misma acción identifica especie nueva **y** completa la fogata, el aviso
  del taller (9 s) se lo come el del códice a los 1200 ms.

**No hay bucle**: los dos testigos se ponen antes de mostrar. Pero **no se
persisten** — `Partida.js` no serializa nada de `Recoleccion` (`grep recoleccion`
sobre el archivo: cero resultados). Vuelven a saltar una vez por sesión. Para el
códice es inofensivo. Para el taller hay un caso concreto: quien guarde con ≥6
leña y ≥4 piedra y sin ningún horno levantado se come el aviso de 9 s en cada
arranque. El guardián `if (this.fundicion.hornos?.length)` cubre bien al que ya
construyó.

## D8 · MENOR — dos cosas chicas en `Bolso.js`

- **El grupo «Otros» es inalcanzable.** `Inventario.listar():91` ya hace
  `cat: RECURSOS[k]?.cat || 'material'` —sin cambios respecto de `main`—, así que
  lo que no tiene ficha llega como `'material'` y nunca como `undefined`. La red
  de seguridad no atrapa nada.
- **De ahí se sigue que la cuenta de la bitácora está mal**: los invisibles eran
  **2** (los dos remedios), no 3. `hueso` se dibujaba desde siempre bajo
  «Materiales», con el peso de omisión de 0,5 kg. La ficha nueva sigue valiendo
  —0,3 kg decidido en vez de 0,5 por omisión— pero no arregló ninguna
  invisibilidad.
- `infusion_canelo` es `cat: 'alimento'` con `nutre: 4`, así que queda con **los
  dos botones**: «Curarte» y «Comer». «Comer» no aplica la cura, o sea que
  apretar el botón de al lado tira 8 de curación. No es defecto de este cambio
  —«Comer» ya estaba— pero el cambio puso los dos juntos.

## D9 · MENOR (acoplamiento, no defecto de hoy)

`Hallazgos._mirarTerreno()` llama a `mineria.yacimientoEn()` en 5 puntos
separados hasta 90 m, y `Mineria` ahora memoriza **una sola** celda
(`_ultimoFrente`). Cada revisión de hallazgos deja el memo apuntando a 90 m del
jugador, así que el `quePuedoHacer()` siguiente recalcula. Correcto —el memo está
indexado por celda— y hoy no cuesta nada, porque pasa cada 128 m. Pero es un memo
de una ranura con dos dueños: la misma forma del aviso que el propio agente `juego`
dejó sobre `Construccion.alCambiar`.

---

# 3 · Lo que no pude confirmar, y por qué

- **El ritmo de los avisos jugando.** Si molesta, si llega tarde. No se mide con
  un script y el agente ya lo declaró como pendiente. Sigue siéndolo.
- **La medida estrella de `mundo`** —«el pico de cambios simultáneos baja de 105
  a 15»—. `r2-mundo.md:134` la atribuye a `popin.mjs`, y **ese archivo no está en
  disco**: `find . -name "popin*"` fuera de `node_modules` no devuelve nada. El
  número quedó sin instrumento reproducible. Lo único de `mundo` que sí pude
  correr es `lint-shader.mjs`: verde en los seis archivos.
- **Los otros bancos de `carta`** (`arbol`, `exploracion`, `mapa`, `relieve`) los
  corrí y dan verde, pero no los audité con la profundidad del de hallazgos.
  Prioricé ése porque es el que toca código de `juego`.

---

# 4 · Recomendación

Nada de esto bloquea la ronda. Por orden de lo que yo arreglaría antes de cerrar:

1. **D1** — mover una línea. Es el defecto original de la ronda, mudado de rama,
   y encima se lleva puesta la única forma de descubrir `P` y la única fuente de
   `agua`.
2. **D2 + D3** — `Hallazgos` necesita la misma tabla `VALE` que `Recoleccion`, y
   su banco necesita un `sotobosque` y una `vegetacion` de mentira. Hoy hay dos
   tipos de marca que no se van a dibujar nunca y un banco que dice que sí.
3. **D4** — una línea: que `Hallazgos` use el mismo radio de 12 m.
4. **D6** — que el banco cargue la clase vieja desde `git show`, o que la
   bitácora y el comentario digan el mismo número.

Lo demás es anotación.
