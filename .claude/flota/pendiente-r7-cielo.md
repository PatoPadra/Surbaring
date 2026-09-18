# Pendiente · ronda 7, fase 6 · `cielo`

**Nada bloquea.** La fase no necesita una línea de `main.js` para cerrar el contrato: el
HUD saca la dirección de la mirada del jugador, y las estrellas cuelgan de
`cielo.malla`, que `main.js` ya mueve con la cámara. Lo que sigue es para que el
coordinador lo sepa y para dejar la parte de acá lista.

## 1 · `main.js`: la dirección de la cámara, el día que haga falta

**Qué.** `hud.actualizar(dt, cielo)` podría pasar un tercer argumento con la dirección
de la cámara: `hud.actualizar(dt, cielo, camara.getWorldDirection(dirCamara))`, con
`dirCamara` un `THREE.Vector3` de los que ya se reciclan por cuadro.

**Mi parte ya está.** `HUD.actualizar(dt, cielo, mirada = null)` acepta ese tercer
argumento y se lo pasa a `_pintarCruz()`. Sin él la dirección sale de
`jugador.giro` y `jugador.cabeceo`, que es exactamente de donde `Jugador._colocarCamara()`
saca la rotación de la cámara (orden YXZ), así que hoy dan lo mismo.

**Por qué podría hacer falta.** El día que la cámara deje de seguir al jugador —una
cinemática, una cámara libre de depuración, un modo espectador—, el cartel de la Cruz
hablaría de lo que mira el cuerpo y no de lo que mira la pantalla.

## 2 · Para el banco navegador: `leer()` no mueve `cielo.malla`

`banco-r7-fase6.navegador.js` mueve `camara.position` a `ojo` y dibuja sin tocar
`cielo.malla.position`, que quedó donde la dejó `irA()` (o sea, `captura.js`, en el ojo
del jugador en el mismo punto). Con el domo de 42 km, dos metros de diferencia entre
los dos puntos corren el cielo **0,003°**: no hay que cambiar nada. Va anotado para que
un corrimiento no se le atribuya a esto: si algo apareciera corrido medio grado, sería
otra cosa.

## 3 · Aviso: el brillo de las estrellas está calibrado contra la exposición de la noche

`Tiempo._exposicion()` de noche da `2,24/1,54 · 0,78 = 1,13`, y ACES de three divide por
0,6: un valor lineal `v` llega a la curva como `1,89·v`. Sobre eso está elegido
`uBrilloEstrellas = 0,8` —una estrella de magnitud 1 en ~225 de 255, una de 6 en ~28
sobre un fondo de ~16—. Si alguna fase toca la exposición de la noche, el número a
mover es `cielo.uniformesEstrellas.uBrilloEstrellas.value`, que está para eso; no hay
que tocar el shader.

## 4 · Propuesta para otra fase: la luz de la luna no es lineal con la fase

`_encenderLuces()` y `colorNiebla()` alumbran con `direccionLuna.y · uFaseLunar`, que
ahora sí es la fracción iluminada. Pero la luna real en cuarto no alumbra la mitad que
llena: alumbra la décima parte. Con la ley de fase de Allen —`Δm = 0,026·i +
4·10⁻⁹·i⁴`, con `i` el ángulo de fase en grados— un cuarto (i = 90°) da 2,6 magnitudes
menos que la llena, o sea 0,091, contra el 0,5 de hoy.

**No lo toqué**: C6 pide que esas dos funciones sigan leyendo `uFaseLunar` y
`direccionLuna`, y cambiar la curva cambia el brillo de todas las noches que no son de
luna llena —eso lo mira el dueño, no el banco—. Queda dicho con el número.
