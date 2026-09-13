# Bitácora `barro` — ronda 7, fase 3

> Contrato: `RONDA7.md`, «FASE 3 · `barro`» (A1 a A7) y sus dos notas. Banco:
> `banco-r7-fase3.mjs` y `.navegador.js`, del jefe, sin tocar. Escribo sólo
> `Recoleccion.js`, `Hallazgos.js`, `Taller.js` y la licencia nueva en
> `herramientas.json`.

## Lo leído antes de tocar nada (13/9)

- `extraer_arcilla` (en `acciones[]`, arreglo): sin herramienta 1 arcilla,
  «De barranca, con la mano, un puñado»; con herramienta 6. La habilitan
  `pala_omoplato` (dur. 70), `pico_asta` (60) y `pala_hierro` (250).
- `Mundo.orillaCerca(x,z)`: agua en 7 muestras a ≤12 m o cauce > 0,15.
  `_aguaCerca()` de `Recoleccion`: 7 muestras a ≤3 m o cauce > 0,25. La banda =
  orilla y no agua a mano.
- `Mineria._resolverFrente`: celda de 24 m; arena si agua en 5 muestras a 12 m
  del centro y pendiente < 0,22, **después** de la pómez (y > 1450). `evaluar()`
  niega en parque (castigo 8) y reserva (3); se queda igual.
- `mineria.json` → `materiales[]`: arcilla «Depósitos glacilacustres de las
  orillas» (superficie); arena «Depósitos glacifluviales y playas de lago»
  (cantera). `normas[]`: ley_22351_art5, ley_22351_reservas, dominio_provincial,
  ley_25743.
- `Hallazgos`: marca arcilla con la piedra más cercana a 22 m **en** la orilla, y
  la arena con `yacimientoEn().id === 'arena'` en el punto y en el halo de 90 m.
  La tesis: no revela lo no visitado.
- Cadena de `quePuedoHacer()` hoy: identificar · carroña · permiso · beber con
  sed · tronco (vale 4) · chatarra · planta a 7 m · cantera legal · beber sin sed
  · mata que vale · relleno · ficha · espera.
- `Taller.pintar()`: el botón del horno dice `Arcilla 0/10`; `faltaPara()` da
  `{recurso, nombre, pide, hay}`.
- Banco Node: la barranca con `Math.random = 0.99`, cuatro apretadas seguidas;
  la arena en la misma ORILLA (x 980, agua desde 990), y en `unaRegla` un
  `Hallazgos` nuevo por punto con `sotobosque.lotes = []`: el mapa tiene que
  marcar arcilla **sin** piedras sembradas.

- Contra la base: premisas verdes, contrato rojo (0/4), como dice el encargo.

## Corte y retomada (13/9)

Me cortó el límite antes de escribir `src/`. El coordinador confirmó: en disco
sólo esta bitácora. `git status` lo confirma. Sigo con el contexto que tenía.

## Decisiones tomadas antes de escribir

1. **Un solo gesto de orilla, que da lo que la orilla tiene ahí.** En la banda,
   la barranca; en el frente de arena fuera del Parque, la playa; donde se tocan
   (153 de 240 en la medición real), las dos en la misma apretada: «Sacar arcilla
   de la barranca y arena de la playa (1 × arcilla · 1 × arena)». Por qué no una
   después de la otra: por la vara del archivo la playa (0,4 % de las celdas) es
   más escasa que la barranca (2,5 % de la tierra) y tendría que ir primero, y
   entonces el primer cartel prometería arena y no arcilla en el 64 % de la banda.
   Juntas no hay orden que decidir entre las dos. Cada parte descansa aparte,
   porque son predicados de lugar distintos dentro de la misma celda.
2. **El gesto va arriba del tronco, la chatarra y la planta, debajo de beber con
   sed, el permiso, la carroña y el animal sin identificar.** La vara del archivo
   se aplica siempre con la frecuencia global: chatarra «13 % de las celdas»,
   árido legal «83,5 % de las posiciones», tronco «uno cada 1939 m²». La banda es
   el 2,5 % de la tierra; un tronco a 5 m, 1 − e^(−78,5/1939) = 4,0 %; la
   carroña a 5 m, 1 − e^(−78,5/5120) = 1,5 %. Y la chatarra no pierde nada:
   tiene la R. El tronco se ofrece a la apretada siguiente, porque la orilla
   descansa.
3. **El puñado de arena se lee de la licencia**, `rinde` en la entrada nueva de
   `licenciasDeJuego`: la licencia dice exactamente qué se toma. 1 por vez: el
   jefe escribió «cuatro puñados de arena para un horno de barro».
4. **`Taller` lee el origen de `this.mineria.d.materiales`, no de un import.**
   Node 18.12 probado en el scratchpad: `import … from 'mineria.json'` revienta
   (ERR_IMPORT_ASSERTION_TYPE_MISSING), `with {type:'json'}` es error de
   sintaxis, y `assert {type:'json'}` anda con aviso experimental. Pero `assert`
   ya no lo aceptan Chrome 126+ ni Node 22, y en el juego andaría sólo porque el
   import-analysis de Vite 5.4.21 lo borra (`dep-BK3b2jBa.js:64413`, y `:64954`
   en build). Meterle a un archivo de UI sintaxis muerta para que la lea un banco
   es acomodar el código. En el banco, `mineria` es `{ evaluar }` sin `d`: ver
   «Aserciones que miden mal».
5. **El tramo de orilla descansa 900 s por celda de 12 m**, con clave aparte para
   barranca y playa (`orillaTomada`). 900 s como chatarra y cantera; 12 m porque
   es el radio de la orilla: ni la grilla de 25 cm (un paso y otra vez) ni el
   frente de 24 m de la cantera, que es volumen.
6. **Hallazgos marca la arena también con la regla del puñado**: en tierra y
   fuera del Parque. Un banco de arena del Parque ya no se marca: el taller no
   puede mandar a juntar a donde la tecla no junta. Los guardados viejos
   conservan sus marcas del Parque (no hay cómo distinguirlas al cargar).

## Hecho (13/9)

- **`Recoleccion.js`.** Exporta `aguaAMano()`, `barrancaEn()` y `playaEn()`;
  `_aguaCerca()` llama a la primera. `_accionOrilla()` arma las partes
  (barranca con la rama de `extraer_arcilla` que corresponda a la mano; playa
  con `licencia.rinde`) y la etiqueta con `parentesisDeRinde`. En la cadena, justo
  después de beber con sed. `actuar()` caso `orilla`: da, marca los tramos,
  avisa (el primer puñado con el texto `aviso[jurisdicción]` de la licencia, en
  el mismo aviso) y gasta la herramienta **después** del aviso.
- **`herramientas.json`.** Licencia `arenaDePlaya` con `que`, `laNormaReal`,
  `porQueSeToma`, `comoLoDiceElJuego`, `queNOSeAfloja`, `rinde`, `aviso`
  (reserva/fuera) y `nota`.
- **`Hallazgos.js`.** Importa los dos predicados. `_mirarTerreno()` anota arena
  con `playaEn` y arcilla con `barrancaEn` (punto y halo). `_mirarVegetacion()`
  ya no anota arcilla por piedra; sigue la obsidiana. `TIPOS` con `recurso` y
  `articulo`. `masCercanoDe(recurso, x, z)` al centro de celda, con `aca`.
- **`Taller.js`.** `_dondeSale(falta, pedidos, p)` en hornos, hornadas y obras:
  «Arcilla — Depósitos glacilacustres de las orillas. La barranca de arcilla más
  cerca que viste queda a 800 m al noroeste.» Sin anotado: «Buscá una barranca de
  arcilla: cuando pases por una, queda anotada en el mapa.» Distancia de a 50 m,
  «1,2 km» hasta 10 km; rumbo en ocho puntos con +z = sur (`Mundo.aMundo`).
- Banco, secciones barranca · arena · unaRegla: **3/3 verde** (14 · 15 · 2).
- `loQueFalta`: **rojo en 2 de 10**, las dos del origen. Distancia, rumbo y «sin
  anotado no inventa» en verde: «800, 800, 1200» contra 815 y 1218.
- **Corrida completa** (sin variables): **5/6**. Verdes barranca, arena,
  unaRegla, regresión (r7-fase1 6/6, r7-fase2 4/4, r7-fase2b 7/7) y `vite build`.
  Rojo sólo `loQueFalta`, por lo de abajo.

## Aserciones que miden mal

**«lo que falta dice el origen de la arcilla/arena, leído de mineria.json».** En
`loQueFalta` las dependencias del taller son `fundicion` (hornos, `faltaPara`),
`hallazgos` (con una `mineria` de dos funciones), `mineria: { evaluar }`,
`limites`, `jugador` e `inventario`. **Ninguna trae `materiales`.** La única
forma de que el taller lea `origen` ahí es un import del JSON dentro de
`Taller.js`, y en Node 18.12 eso sólo anda con `assert { type: 'json' }`: la
sintaxis que Chrome sacó en la 126 y Node en la 22, y que en el juego pasaría
sólo porque Vite la borra. En el juego, `taller.mineria` es la `Mineria` real y
trae `d = mineria.json`, que es de donde lee `_dondeSale()`.

Probado sin tocar el banco: copia en el scratchpad con UNA línea cambiada
(`diff`: línea 378), `BANCO_SRC=src BANCO_SECCIONES=loQueFalta`:

    <     mineria: { evaluar: () => ({ permitido: false, detalle: '' }) },
    >     mineria: { d: MINERIA, evaluar: () => ({ permitido: false, detalle: '' }) },

→ **10/10 verde**. La aserción mide lo correcto; la dependencia falsa no le da el
dato que la real sí tiene.

## A3 predicho, en Node sobre el DEM real

`scratchpad/prediccion-a3.mjs`: el MISMO muestreo del navegador (LCG semilla 11,
240 puntos, mismos filtros) con el `Recoleccion` real, `Sotobosque.sembrarTodo()`
real, `Mineria` y `Limites` reales. Reproduce la apertura: 240 de la Reserva,
**153 de arena** (la carta dice 153), el más cercano a **499 m** (la carta dice
499), **21 troncos** a 5 m (la carta: 21 ganó el tronco).

- Tecla: `orilla` en **240/240**; arcilla con número **100 %**, más cerca 499 m.
- Arena: 153 puntos fuera del Parque, 153 con arena, más cerca **524 m**;
  `actuar()` no se llama nunca (el primer cartel ya promete arena), así que no
  hay descansos que se crucen entre puntos.
- La orilla le gana en esa muestra a 21 troncos, 31 chatarras a mano y 0 carroñas.
- A6 en el mundo real: 60 puntos de la banda, `Hallazgos` anota arcilla en 60.

Lo que Node no ve: la vegetación (irrelevante, la orilla va arriba de la planta)
y la fauna sin identificar a 22 m (en la apertura, 0 de 240). **Espero ≥ 97 % en
el navegador**, y 100 % si ningún animal queda a 22 m de un punto.

## Pendiente

Nada en `Mundo`, `Mineria`, `Exploracion` ni `main.js`: no hizo falta
`pendiente-r7-barro.md`. Para el coordinador, la línea del banco de arriba.

## Dudas para el jefe

- **La barranca da arcilla también en el Parque**, como ya la daba la piedra de
  orilla. El contrato no la restringe y `extraer_arcilla` no trae `jurisdiccion`,
  así que no la restringí. Pero el art. 5 que cita la licencia prohíbe «todo
  aprovechamiento de los recursos naturales» en el Parque: la arcilla del Parque
  es la misma licencia que la arena, sin declarar.
- El aviso de la licencia es una vez **por sesión** (`_licenciaArenaDicha` no se
  guarda con la partida).
