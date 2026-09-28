# Pendiente · ronda 8, fase 1 · `rumbo`

Lo que la fase necesita fuera de `Mapa.js`, `Minimapa.js` y la regla de `#brujula`.
Lo único que bloquea que el minimapa se vea en el juego es el punto 1.

## 1 · `main.js`: crear el minimapa y llamarlo (bloquea)

```js
import { Minimapa } from './ui/Minimapa.js';
// después de `const mapa = new Mapa({...})`, con #hud ya en el documento:
const minimapa = new Minimapa({ mundo, jugador, exploracion, hallazgos, construccion, codice, mapa });
// en cuadro(), al lado de hud.actualizar(dt, cielo):
minimapa.actualizar(dt);
// y en window.SurviBar: minimapa
```

`actualizar(dt)` hace casi nada casi siempre: decide si toca redibujar (giró 2°, se corrió
un píxel, cambió lo explorado, o pasó medio segundo) y, cuando hace falta, da una tanda de
12 filas del relieve. Con `mapa.abierto` pone `oculto` y vuelve sin tocar nada. No hace
falta llamar a `minimapa.dibujar()` cuando aparece un hallazgo o una obra: sale en el
próximo dibujo, a lo sumo medio segundo después.

El primer relieve tarda 32 cuadros en armarse (un segundo a 30 fps). Si el bucle nunca
corrió, el minimapa muestra sólo el velo sobre fondo oscuro: para la mitad navegador (N4,
«explorado entero muestra relieve») el juego tiene que haber andado un segundo antes.

## 2 · `Hallazgos.js`: que la leyenda se pueda apagar

`_pintarLeyenda` dibuja un recuadro de 132 px en la esquina de arriba a la derecha de
`op.lado`. En el minimapa (180 px) taparía casi todo. Hoy el minimapa pasa
`lado: 180 + 150`, así la leyenda cae afuera del lienzo; el costo es que las marcas hasta
162 px pasado el borde derecho y el de abajo se dibujan igual, fuera de la vista.

Pedido: que `dibujar(c, proy, op)` acepte `op.leyenda === false` y no la pinte. Con eso,
en `Minimapa.dibujar()` va `lado: LADO, leyenda: false` y se borra `LEYENDA_AFUERA`.

## 3 · `HUD.js`: `#fenomenos` pisa la brújula, ahora que está en su lugar

`#brujula` queda en `top: 0`, 30 px de alto, centrada. `#fenomenos` (`HUD.js`, en
`_construirBolso`) va en `top: 1rem`, también centrado: cuando hay un fenómeno activo sus
etiquetas empiezan en y = 16 px, y las letras de la brújula (0,68rem, centradas en 30 px)
van de ~10 a ~20 px: se enciman. Antes no se veía porque la brújula estaba fuera de
lugar. No lo medí en pantalla; es la cuenta con las reglas. Propuesta:
`#fenomenos { top: 2.6rem }`.

## 4 · Los bancos (no es código mío; va con la cuenta en el informe)

- `banco-r8-fase1.mjs`, sección 3: «la X de una obra mide lo mismo… al tope» da NaN
  porque al tope la obra queda fuera de la vista, no por su tamaño. La rueda sube en
  (320, 320), el centro del mundo; a 2 m/px la ventana va de −640 a 640 m y la obra está
  en x = 1230 → px = 320 + 1230/2 = 935, y `Hallazgos._pintarObras` descarta px > 680.
  Con la escalera vieja (8 m/px) caía en 473,75. Subiendo hacia la obra
  (`subirHastaElTope(m, po.px, po.py)`) da 7,60 contra 7,60 px.
- `banco-r8-fase1.falsar.mjs`, `flecha-mini-al-reves`: envuelve `actualizar` y `dibujar`
  con `giro + π`; como `actualizar` llama a `this.dibujar()`, la flecha sale con
  `giro + 2π` y apunta bien (0,0° en los ocho giros, medido). El parche no planta nada.
  Con una guarda de anidamiento (sumar π sólo en la llamada de más afuera) lo vería.
- `r2-carta-mapa.mjs` (informativo): 16 de 18. Caen «nunca se construye relieve por
  debajo del dato» y «los niveles 3 y 4 estiran el dibujo del 2»: fijan el estirado, y
  ahora cada peldaño se construye (ver la cabecera de `Mapa.js`).
