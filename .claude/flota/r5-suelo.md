# Bitácora de `suelo` — ronda 5, fase 2

Encargo: `RONDA5.md`, «FASE 2 · suelo». Orden: d → c → b.
Archivos propios: `Vegetacion.js`, `Sotobosque.js`, `Mundo.js`, `Audio.js`, `Agua.js`.
Pruebas en `.claude/flota/.tmp-suelo/`. Parches ajenos en `pendiente-r5-suelo.md`.

## Diagnóstico

### d) brillo nocturno
- Las tres constantes del contrato están donde decía: `Vegetacion.js` (antes
  :1948), `Sotobosque.js` (antes :297 y :310). Se suman a `indirectDiffuse`
  después de `lights_fragment_end`, así que las luces de la fase 1 (que entran
  en el bloque de luces) no se tocan.
- `Vegetacion` ya tenía `this.cielo` (lo pone `main.js:228`). `Sotobosque` no:
  hace falta que `main` se lo asigne → pendiente nº 1.
- **Al mediodía el factor NO siempre es 1.** La nubosidad sale de una semilla
  al azar (`Tiempo._semillaB`) y el cielo gana brillo con nubes. Medido con
  `Cielo` real en Node, 15/2 12:00, turbiedad como la pone `Tiempo`:
  nubes 0 → 0,638 (factor 0,750); 0,20 → 0,730 (0,859); 0,35 → 0,789 (0,928);
  0,45 → 0,823 (0,968); 0,55 → 0,854 (1). El 0,85 del jefe corresponde a
  nubes ≈ 0,53. **Para el banco «idéntico al píxel» hay que fijar el tiempo o
  comprobar `cielo.intensidadCielo ≥ 0,85` antes de comparar**: con otra
  semilla el mediodía atenúa la traslucidez hasta un 25 %. No cambié el
  contrato: la fórmula es literal.
- Medianoche en mi corrida (15/2 00:00 local): 0,063 → factor 0,074. El jefe
  midió ~0,10: la luna depende de la fecha exacta. Mismo orden.

## Hecho (archivo:línea)

### d) — terminado
- `Vegetacion.js:121-149`: `LUZ_CIELO_MEDIODIA = 0,85` y `luzCielo(cielo)`
  exportados (sin cielo o sin `intensidadCielo` → 1; tope 1).
- `Vegetacion.js:190-191`: `uLuzCielo` en `this.uniformes` (compartido por los
  30 lotes).
- `Vegetacion.js:360`: se escribe en `actualizar()`, una vez por cuadro.
- `Vegetacion.js:1945` declaración; `:1987` traslucidez `* (vFlexion * uLuzCielo)`.
- `Sotobosque.js:18` importa `luzCielo` de Vegetacion (una sola fórmula).
- `Sotobosque.js:43` uniforme; `:47` `this.cielo = null`; `:347` escritura.
- `Sotobosque.js:278` declaración; `:307` traslucidez de lámina; `:324`
  relleno de sólidos, los dos `* uLuzCielo`.
- Pendiente nº 1: `sotobosque.cielo = cielo` en `main.js:233`.

## Números medidos

### d) `prueba-d-luz.mjs` — todo en verde
- Sotobosque real en Node, `onBeforeCompile` corrido sobre `ShaderLib.lambert`:
  los 9 tipos declaran `uLuzCielo`, reciben el MISMO objeto uniforme, y el
  producto está en la línea que corresponde (6 láminas, 3 sólidos).
- Claves de programa con el `conCSM` de `main.js:987` copiado: **2 claves,
  una sola fuente por clave**; carroña y coirón con claves y fuentes distintas,
  la carroña conserva `vArriba`.
- Vegetacion real en Node (lienzo 2D falso): **30 lotes**, todos con el uniforme
  compartido y el producto; una sola clave entre los 30 (igual que antes).
- `luzCielo`: null → 1; `{}` → 1; 0,85 → 1; 2 → 1; 0,10 → 0,1176.
- Costo por fragmento: un producto por un escalar en cada término. Ni `pow`, ni
  ruido, ni lecturas. El tiempo de cuadro lo mide el jefe.

## c) la orilla — TERMINADO (ver también «Lectores» y «Espuma» al final de c)

### Diagnóstico
- Máscara de agua binaria (0/255): el modelo 1D de interpolación vale.
- **La tierra de la costa está a la cota del lago, y casi la mitad por debajo.**
  Primera corona de tierra: h − cota p10 −0,46, p50 +0,09, p90 +0,50; el 45 %
  bajo el espejo (igual en la 2ª y 3ª corona). La superficie DEM de las celdas
  de agua de costa: −0,15…+0,17 (p10-p90) respecto de la cota de meta.
- **Con la tierra a la cota, las dos condiciones de la mediana chocan.** En 1D,
  profundidad en el borde d = F/2 y ancho con < 0,5 m = 16·(0,5 − d)/d. d ≤ 0,3
  obliga a ancho ≥ 10,7; ancho ≤ 12 obliga a d ≥ 0,286. Ventana de 1,4 cm.
- Medido sin tocar la tierra (1132 transectos, 700 por eje y 700 girados ±45°,
  semilla 20260911), rampa F·dm/32 hasta D0 y raíz desde ahí:
  F0,6 D0 45 → prof. orilla (superficieEn − alturaEn) p50 0,33 ✗, ancho p10 0 ✗
  (18 % de orillas ya pasan 0,5 en el primer punto). Compensando la primera
  corona por la tierra baja (c 0,28): con la profundidad SIN relieve fino
  (cota − alturaBaseEn) cumple las cuatro (0,28 / 0,43 / 2,8 / 10,3), pero con
  `alturaEn` no: p50 0,34 y 19 % sin franja. El relieve fino y las esquinas de
  la máscara (tres de cuatro celdas mezcladas son agua) hacen la cola.
- La salida es levantar la tierra que toca el agua: con la tierra a +β y el
  agua a −F, el ancho es 16·(0,5 − d)/(d + β). **β = F** pone la línea donde el
  lecho corta el espejo justo en el borde de la máscara.

### Hecho
- `Mundo.js:163-235` (`_excavarLagos`): primera corona de agua (dist ≤ √2) a
  `ORILLA = 0,8` bajo el espejo; raíz `0,8 + 3,4·√((dist − √2)·32)` después; la
  tierra 8-vecina del agua sube a `espejo + 0,8` si estaba más baja (mínimo de
  los espejos que la tocan). `this.texelsBerma` cuenta los levantados.
  Referencia: la superficie del DEM de cada celda (como antes), no la cota de
  meta: con la cota daba peor en `superficieEn − alturaEn` (cola 6-8 % contra
  3-4 %) y levantaba hasta 2,48 m en vez de 1,55.

### Números (`orilla-real.mjs`, Mundo.js REAL, tres semillas) — todo en verde
| def. de profundidad | orilla p50 | p90 | ancho<0,5 p10 | p50 | sin franja |
|---|---|---|---|---|---|
| superficieEn − alturaEn | 0,11-0,12 | 0,35-0,37 | 4,8-5,5 | 9,8-10,0 | 3-4 % |
| cotaLagoEn − alturaEn (Jugador) | 0,09-0,11 | 0,40-0,42 | 4,8-5,5 | 9,8-10,0 | — |
| cotaLagoEn − alturaBaseEn (vértice del agua) | 0,04-0,05 | 0,36-0,39 | 3,5-4,0 | 10,0-10,3 | 4-5 % |
- Cubeta a 290-310 m de la costa (6186 texels): 0,932-0,937 de la de antes. PROF_MAX 120.
- Tierra levantada: 29 299 texels (0,70 % del mundo), media 0,67 m, p50 0,55,
  p90 1,17, p99 1,36, máx 1,55. Ninguno bajó; todos tocan agua.
- Textura del agua (lectura bilineal replicada sobre `texAltura.image.data`)
  contra `alturaBaseEn`: diferencia máxima 0 en 200 orillas.
- Vadeo (Jugador nada con `profundidadAgua > 1,1`, `Jugador.js:231`; flota del
  todo desde 1,48 m, donde 1 − 1,08·min(1, p/1,6) cambia de signo): se caminan
  **~21 m** de agua (p10 16,5, p50 20-21) antes de 1,1 m y ~23 m antes de 1,48.

- Otros β con la misma forma (β = F), `orilla-disenos.mjs k`: 0,6 → ancho p50
  13,5 m ✗; 1,0 → ancho 7,8 m, 5-6 % sin franja, tierra media 0,87 máx 1,75.

### Tiempo de carga (`tiempo-excavar.mjs`, antes y ahora alternados, 5 rondas)
- Antes (copia de b04a424): 210 212 149 149 167 → mediana 167 ms.
- Ahora: 230 185 208 208 188 → mediana 208 ms. **+41 ms** (tope +200).

### Espuma (`espuma-umbral.mjs`, espuma media con turbulencia 0,5, prof. del vértice)
- Con el umbral de hoy `smoothstep(0, 1,35)`: espuma > 0,6 cubre **10,3 m de
  mediana y 31,8 m en el p90**; > 0,3: 12,8 / 37,3 m. Es el cinturón.
- 0,9 → 6,8 / 21,0 m; **0,7 → 5,0 / 16,3 m** (> 0,3: 6,3 / 19,3; 14 % de orillas
  sin espuma > 0,3); 0,55 → 4,0 / 14,0 (18 % sin).
- Hecho: `Agua.js:784-795`, umbral 1,35 → **0,7**. La espuma media se apaga
  desde 0,24 m. La lengua (`:793`) y el alfa (`:813`) no se tocaron.
- **Sin captura**: el jefe tiene que mirarla de día y al atardecer.

### Lectores del lecho y de la tierra de costa, y qué les cambia
- `Jugador.js:363-373` (`alturaEn`, `cotaLagoEn`): antes nadaba al primer paso
  (9,7 m); ahora camina ~21 m de agua antes de `profundidadAgua > 1,1`
  (`:231`, empuje) y ~23 m antes de 1,48 m (flota). Vadeando, `vel·0,55`
  (`:190`). **No se tocó la física.**
- `Cuerpo.js:289`: hunde el cuerpo `min(0,55, prof·0,35)` al estar en agua: al
  vadear el cuerpo se ve metido en el agua. Nada que cambiar.
- `Peces.js:171/180/284`: el cardumen va a `cota − (0,4…4,9 m)` sin mirar el
  fondo. Antes el borde tenía 9,7 m y nunca quedaba enterrado; **ahora desde la
  orilla hasta 4,9 m de fondo hay 27,8 m de mediana (p90 61,5)**, y hasta 2 m,
  20,3 m. Un cardumen sembrado ahí queda bajo el lecho → pendiente nº 2.
- `Pesca.js:180`: profundidad fija 2,5 m para elegir especie. No cambia.
- `Mineria.js:95-108`: «banco de arena» si toca agua y `pendienteEn < 0,22`.
  **La pendiente de la tierra que toca agua bajó de 16,7° a 1,3° de mediana
  (p90 23,3° → 2,0°)**: el pozo la inclinaba. Arena posible en el 25 % de esa
  tierra antes y en el 100 % ahora. Es correcto —una playa es arena— pero es
  un cambio de economía que el jefe tiene que saber.
- Siembra de vegetación y sotobosque, fauna (`pendienteEn`, `alturaEn`): la
  orilla deja de ser una ladera de 17°; lo que filtra por pendiente puede
  llegar hasta el agua. No medí la cuenta de plantas.
- `Mapa.js:305` (`alturaBaseEn` para el sombreado): los píxeles de tierra junto
  a la costa restaban un vecino de lecho 19 m más bajo; ahora 1,6 m. El borde
  de los lagos en la carta pierde el ribete de sombra. No medido en imagen.
- `captura.js:52`, `Agua._cotaMirada` (`superficieEn`): `superficieLago` no
  cambió. Nada.
- `Terreno.js` (vértice y `texNormal`): leen `texAltura`/`texNormal`, que salen
  del mismo arreglo. La normal de costa se aplana igual que `pendiente`.

## b) el suelo bajo los pies — escrito y probado; falta cerrar dos hallazgos

### Hecho
- `Mundo.js:35-49`: `NIEVE_SUAVIDAD = 220`, `LINEA_BOSQUE = 1620` (copias de
  `Terreno.js:260-261`, con el aviso) y `suave()`, el smoothstep de GLSL con
  bordes invertidos.
- `Mundo.js` `sueloEn(x, z, cotaNieve = 1750)` (después de `cotaLagoEn`):
  agua si `esAgua`; normal de `texNormal.image.data` bilineal, `normalize(·2−1)`,
  `pend = 1 − clamp(y)`; humedad del azul de `texCobertura`; `alt = alturaEn`;
  nieve si `clamp(nA·nP + nA·0,12)·(1 − smoothstep(0, 0,35, 0,17)) ≥ 0,5`;
  roca si `smoothstep(0,26, 0,58, pend) ≥ 0,5` o `smoothstep(1460, 1810, alt) ≥ 0,5`;
  pasto si humedad < 0,45; si no, hojarasca. `_leerRGBA()` es la lectura
  bilineal en la convención de la GPU (`_texelDe`).
- `Audio.js:36-66` tabla `PASOS`: hojarasca 230-420 Hz Q0,75 0,046 ataque 12 ms
  caída 160 ms (antes 260-480, 0,055, 130 ms); pasto 2600-3800 Hz Q0,6 0,030
  ataque 35 ms caída 200 ms (roce); roca 1500-2300 Hz Q1,6 0,060 seco 45 ms +
  senoidal de 130 Hz 40 ms (golpe); nieve 900-1400 Hz Q0,7 + pasabajos 1600 Hz,
  5 granos en 180 ms (crujido amortiguado); agua sin cambios.
- `Audio.js` `pasos(dt, jugador, mundo = null, cotaNieve = 1750)`: consulta
  `mundo.sueloEn` sólo cuando el pie apoya; en el agua no consulta; sin mundo,
  hojarasca. Guarda `this.ultimoSuelo`. `_paso(tipo, vel, agachado)`: agachado
  = mitad de fuerza con el mismo timbre (antes cambiaba a un pasabajos de 420).
- Pendiente nº 4: `audio.pasos(dt, jugador, mundo, est.cotaNieve)` en `main.js:906`.

### Números
- `prueba-b-suelo.mjs` (Mundo real): contra una lectura del sombreador escrita
  aparte (uv de la GPU, bilineal sobre bytes, smoothstep, orden de capas):
  **100,00 % de acuerdo** en 6000 puntos de tierra fuera de banda con cota
  1100, 1750 y 2300; agua coincidente. Punto a 2041 m: nieve con cota 1000,
  roca con cota 2600. **3,21 µs por consulta** en Node.
- `prueba-b-pasos.mjs` (AudioContext falso): cinco firmas distintas; roca
  < 60 ms sin ataque y con golpe; nieve ≥ 10 eventos y pasabajos; pasto > 2 kHz
  con entrada; hojarasca grave y más larga que 0,13 s; agachado 0,502 de fuerza;
  todos los nodos llegan al bus y se detienen; eventos en orden y rampas
  exponenciales > 0. **600 cuadros, 37 pasos: 37 consultas y 37 sonidos.**
- Regresiones: `orilla-real.mjs` y `prueba-d-luz.mjs` en verde después de b);
  `npx vite build` pasa (76 módulos).

### Dos hallazgos del sombreador que condicionan el banco (`suelo-estadistica.mjs`)
1. **Con `detalle = 0,5` la máscara de nieve no pasa de 0,5214**
   (`1 − smoothstep(0, 0,35, 0,17)`). «nieve» pide el término previo ≥ 0,9589:
   nieve plena queda a 0,021 del umbral. Mi primera banda de ±0,03 sobre la
   máscara dejaba afuera TODA la nieve (0 puntos de nieve en 18 000). Rehecha
   sobre el término previo: nieve 3086 / 295 / 25 puntos con cota 1100 / 1750 /
   2300, acuerdo 100,00 % en las tres. **Si el banco del jefe pone la banda
   sobre la máscara, no mide la nieve.** No cambié la regla: es literal.
2. **La roca por pendiente casi no existe.** `texNormal` lleva 2 en la vertical
   sobre pendientes ya divididas por la distancia (`Mundo.js`,
   `_construirTexturas`): `pend ≥ 0,42` pide ~70° de pendiente real. Sobre
   1 269 215 texels de tierra: roca por pendiente **0,02 %**; por pedregal sobre
   1635 m **17,40 %**; pendiente geométrica > 30° 22,21 % y > 45° 3,02 %. O sea
   que «roca» es, en la práctica, «más alto que 1635 m», igual en el sombreador
   que en `sueloEn`. No lo toqué: cambiar esa normal cambia la luz y la roca de
   todo el terreno que el dueño ya aprobó. Va al jefe.

### Líneas finales
- `Mundo.js:37` constantes, `:44` `suave`, `:145` `_excavarLagos`, `:228`
  `ORILLA`, `:272` `texelsBerma`, `:427` `sueloEn`, `:465` `_leerRGBA`.
- `Audio.js:50` `PASOS`, `:596` `pasos`, `:624` la consulta, `:634` `_paso`.
- `Agua.js:794` umbral de espuma. `Vegetacion.js:1987`, `Sotobosque.js:307/:324`.

## Estado: d, c y b TERMINADOS. Queda para el jefe
- Aplicar pendientes 1, 2 y 4; mirar la espuma y la orilla en captura; medir
  el costo de d) en la vista previa; decidir sobre la tierra levantada (c) y
  sobre la normal de `texNormal` (b, hallazgo 2).

## Descartado (con el motivo)

- Duplicar la constante 0,85 en Sotobosque: dos copias pueden divergir sin que
  nadie se entere (ya pasó con `orillaCerca`). Se exporta de Vegetacion.
