# Pendiente de `suelo` — parches para archivos que no son míos

Cada parche dice el archivo, dónde va y por qué. Ninguno está aplicado.

## 1 · `src/main.js` — el cielo al sotobosque (punto d)

Sin esto `Sotobosque.uniformes.uLuzCielo` se queda en 1 y el pasto sigue
brillando de noche; la vegetación ya lo recibe en `main.js:228`.

```js
// main.js:233, justo después de crear el sotobosque
  const sotobosque = new Sotobosque(mundo);
  sotobosque.cielo = cielo;          // ← agregar: la traslucidez sigue a la luz de cielo
  escena.add(sotobosque.grupo);
```

`captura.js` no necesita nada: llama a `cielo.actualizar()` y después a
`sotobosque.actualizar()`, que lee `this.cielo`.

## 2 · `src/entities/Peces.js` — que el cardumen no quede bajo el lecho (punto c)

Con la orilla nueva el fondo sube hasta 0,8 m en la primera corona. Medido en
1132 orillas: desde el borde hasta 4,9 m de fondo —el cardumen más hondo que
siembra `sembrar()`— hay 27,8 m de mediana y 61,5 en el p90; hasta 2 m, 20,3 m.
Antes el borde ya tenía 9,7 m y esto no podía pasar. Hoy un cardumen sembrado o
derivado a esa franja queda dibujado dentro del terreno.

```js
// Peces.js, sembrar(), reemplazar la línea 171
      const fondo = amb.id === 'rios'
        ? Infinity
        : amb.cota - this.mundo.alturaBaseEn(x, z);
      // Un cardumen necesita agua encima del lecho: en la playa no hay dónde.
      if (fondo < 0.7) continue;
      const profundidad = Math.min(
        0.4 + Math.random() * (amb.id === 'rios' ? 0.8 : 4.5),
        fondo - 0.3);
```

```js
// Peces.js, _derivar(), reemplazar el bloque de :280-284
      const amb = this.ambienteEn(nx, nz);
      const fondo = amb && amb.id !== 'rios' ? amb.cota - this.mundo.alturaBaseEn(nx, nz) : Infinity;
      if (amb && amb.id === c.ambiente && fondo >= 0.7) {
        c.x = nx; c.z = nz;
        // La superficie de destino manda, y el fondo también: el cardumen
        // guarda su profundidad, pero no la baja del lecho.
        c.cota = amb.cota - Math.min(c.profundidad, fondo - 0.3);
      } else {
```

`alturaBaseEn` y no `alturaEn`: el relieve fino se apaga sobre el agua y es la
misma lectura que hace el vértice del agua.

## 4 · `src/main.js` — el suelo a los pasos (punto b)

`Audio.pasos()` pregunta `mundo.sueloEn()` sólo cuando el pie apoya. Sin
`mundo` suena la hojarasca para todo, que es lo mismo que sonaba antes.

```js
// main.js:906
    audio.pasos(dt, jugador, mundo, est.cotaNieve);   // ← antes: audio.pasos(dt, jugador);
```

`est.cotaNieve` es la misma que recibe `terreno.aplicarEstacion()` en `:844`.

## 3 · Para saber, sin parche — cambios de juego que trae la orilla nueva

- **Minería da arena en toda la costa llana.** `Mineria.js:104` pide tocar agua
  y `pendienteEn < 0,22`. La tierra que toca agua pasó de 16,7° a 1,3° de
  pendiente mediana (el pozo la inclinaba): arena posible en el 25 % antes y en
  el 100 % ahora.
- **Se vadea.** `Jugador` empuja hacia arriba desde 1,1 m y flota desde 1,48 m:
  ~21 y ~23 m de agua caminable desde el borde (medianas).
- **La tierra que toca agua sube** hasta 1,55 m (media 0,67; 29 299 texels, el
  0,7 % del mundo). Es parte del arreglo: sin eso la mediana de profundidad y la
  del ancho no entran a la vez. Ver `r5-suelo.md`, c).
- **La espuma se acortó** (`Agua.js:794`, 1,35 → 0,7): hay que mirarla en captura
  de día y al atardecer.
- **El mediodía no siempre da `uLuzCielo = 1`.** La nubosidad sale de una semilla
  al azar; a las 12 del 15/2 el factor es 1 recién desde nubes ≈ 0,55 (0,93 con
  0,35; 0,75 con cielo limpio). Para la prueba «idéntico al píxel» hay que fijar
  el tiempo o comprobar `cielo.intensidadCielo ≥ 0,85` antes de comparar.
- **Banda de ambigüedad de la nieve.** Con `detalle = 0,5` la máscara de nieve
  no pasa de 0,5214: la nieve plena está a 0,021 del umbral. Una banda de ±0,03
  sobre la máscara excluye toda la nieve del acuerdo de `sueloEn`. Conviene
  ponerla sobre el término previo al factor (umbral 0,9589).
- **La roca por pendiente del terreno pide ~70°.** `Mundo._construirTexturas`
  arma `texNormal` con 2 en la vertical sobre pendientes ya divididas por la
  distancia; con eso `pend ≥ 0,42` es 0,02 % de la tierra, y la roca que se ve
  es el pedregal sobre 1635 m (17,4 %). No lo toqué: cambia la luz y la roca de
  todo el terreno aprobado. Es decisión del jefe o del dueño.
