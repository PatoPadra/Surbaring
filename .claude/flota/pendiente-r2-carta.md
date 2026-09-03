# Pendiente de `main.js` — jefe `carta`, ronda 2

Cinco parches sobre `src/main.js`, que es del coordinador. Todos son cableado:
ninguno cambia lógica. El único sistema nuevo es `Hallazgos`, que es el modelo
de memoria de las marcas del mapa.

**Sin estos parches nada se rompe**: `Mapa` llama a las marcas con `?.`, así que
si `hallazgos` no llega, el mapa dibuja como siempre —con zoom, relieve y
velo— y sencillamente no hay marcas. Está verificado en el banco.

---

## 1 · Importar el sistema nuevo

**Antes** (línea ~49):

```js
import { Exploracion } from './systems/Exploracion.js';
import { Mapa } from './ui/Mapa.js';
```

**Después**:

```js
import { Exploracion } from './systems/Exploracion.js';
import { Hallazgos } from './systems/Hallazgos.js';
import { Mapa } from './ui/Mapa.js';
```

---

## 2 · Crearlo y pasárselo al mapa

`Hallazgos` necesita `mineria`, `vegetacion` y `sotobosque`, y los tres ya
existen mucho antes de esta línea (207, 214 y 297). `construccion` existe desde
la 315. Así que va donde está, sin mover nada de orden.

**Antes** (líneas ~355-356):

```js
  const exploracion = new Exploracion(mundo);
  const mapa = new Mapa({ mundo, jugador, tiempo, exploracion, codice });
```

**Después**:

```js
  const exploracion = new Exploracion(mundo);
  // Lo que el jugador vio dónde. Va aparte de la exploración a propósito: el
  // velo se abre a kilómetros desde un mirador, y desde un mirador no se
  // distingue si esa playa tiene arena o canto rodado.
  const hallazgos = new Hallazgos({ mundo, mineria, vegetacion, sotobosque });
  const mapa = new Mapa({
    mundo, jugador, tiempo, exploracion, codice, construccion, hallazgos,
  });
```

---

## 3 · Mirarlo en el bucle, al lado de la exploración

**Antes** (líneas ~734-741):

```js
    if (jugador.vivo) {
      exploracion.revisar(jugador.posicion, est, dt);
      if (exploracion.nuevasDesdeUltimoDibujo > 400) {
        exploracion.nuevasDesdeUltimoDibujo = 0;
        exploracion.guardar();
        if (mapa.abierto) mapa.dibujar();
      }
```

**Después**:

```js
    if (jugador.vivo) {
      exploracion.revisar(jugador.posicion, est, dt);
      // Barato por construcción: sólo trabaja cuando el jugador cambia de celda
      // de 128 m, o sea cada ~38 s caminando. Entre medio son dos sumas.
      const hallados = hallazgos.revisar(jugador.posicion, est, dt);
      if (hallados > 0) {
        hallazgos.guardar();
        if (mapa.abierto) mapa.dibujar();
      }
      if (exploracion.nuevasDesdeUltimoDibujo > 400) {
        exploracion.nuevasDesdeUltimoDibujo = 0;
        exploracion.guardar();
        if (mapa.abierto) mapa.dibujar();
      }
```

---

## 4 · Exponerlo para inspección

**Antes** (línea ~892):

```js
    exploracion, mapa, bolso, opciones, fin, partida, norma, relevamiento, cierre,
```

**Después**:

```js
    exploracion, hallazgos, mapa, bolso, opciones, fin, partida, norma, relevamiento, cierre,
```

---

## 5 bis · APLICADO — nada que hacer acá

Los cinco parches de arriba y el de `Opciones.js` **ya los integró el
coordinador**. Quedan escritos como registro de qué se cambió, no como tarea.

---

## 6 · Propuesta para el jefe `juego`: un solo criterio de orilla

**No es urgente y no rompe nada; es para que no vuelva a pasar.**

La revisión encontró que `Hallazgos` decidía la arcilla con un radio de 3 m
copiado de una versión anterior de `Recoleccion._orillaCerca()`. Cuando `juego`
lo movió a 12 m, la copia quedó atrás: el mapa habría marcado el **6 % de la
arcilla real**, diciendo «acá no hay» donde sí hay, que es el peor error que
puede cometer una carta. Ya está corregido de mi lado.

Para que la próxima vez no haya dos números, `Hallazgos.js` ahora **exporta** el
predicado, escrito una sola vez:

```js
export function orillaCerca(mundo, x, z) { … }   // 12 m, cauce > 0,15
```

Si a `juego` le sirve, `Recoleccion._orillaCerca()` queda en dos líneas:

**Antes** (`src/systems/Recoleccion.js:295`):

```js
  _orillaCerca() {
    const p = this.jugador.posicion;
    for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8]]) {
      if (this.mundo.esAgua(p.x + dx, p.z + dz)) return true;
    }
    return this.mundo.cauceEn(p.x, p.z) > 0.15;
  }
```

**Después**:

```js
  _orillaCerca() {
    const p = this.jugador.posicion;
    return orillaCerca(this.mundo, p.x, p.z);
  }
```

con `import { orillaCerca } from './Hallazgos.js';` arriba.

**La decisión es de ellos, no mía.** La dirección de la dependencia es discutible
—un sistema de memoria del mapa exportándole un predicado de terreno a la
recolección— y si prefieren que viva en `Recursos.js` o en `Mundo.js`, mejor:
lo importante es que el número esté escrito **una sola vez**, no dónde. Mientras
tanto los dos lados dicen 12 m y hay un banco que lo comprueba.

---

## 7 · Que se olvide cuando se borra la partida

Esto **no es de `main.js`**: está en `src/ui/Opciones.js:227`, que no tiene dueño
en el reparto de la ronda 2 (`carta` tiene `Mapa.js` y `Codice.js`; `juego` tiene
`HUD`, `Taller`, `Bolso` y `Norma`). Por eso no lo toqué. Lo aplica quien
corresponda.

**Antes**:

```js
        this.exploracion.olvidar();
```

**Después**:

```js
        this.exploracion.olvidar();
        this.hallazgos?.olvidar();
```

Y donde se construye el panel de opciones en `main.js`, agregarle `hallazgos` a
sus dependencias. Si esto no se aplica, el efecto es acotado y no rompe nada:
al borrar la partida el velo vuelve a negro y las marcas quedan guardadas, pero
**no se ven**, porque `Hallazgos.dibujar()` no dibuja nada donde
`exploracion.conocimientoEn()` da cero. O sea que quedan latentes hasta que se
vuelva a explorar esa zona. Es un residuo, no una filtración.

---

## Un aviso de coordinación, para el jefe `juego`

**No enganché `Construccion.alCambiar`.** Me avisaron que es una sola ranura y
que hoy está libre, y era la forma obvia de redibujar el mapa cuando se levanta
una obra. No hizo falta: `Hallazgos.dibujar()` **lee `construccion.obras` en el
momento de dibujar**, así que una obra nueva aparece sola la próxima vez que se
abre el mapa. La ranura sigue libre y nadie la pisa.
