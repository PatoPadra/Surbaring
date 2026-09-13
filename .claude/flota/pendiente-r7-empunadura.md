# Pendiente de `empuñadura` — ronda 7, fase 2b

## `main.js`: no hay parche

Las dos líneas que pide la fase ya las puso el coordinador, y el banco las
ejercita contra el código tocado:

- `main.js:755` — `cuerpo.enMano = equipo.enRanura('mano')?.id ?? equipo.enRanura('arma')?.id ?? null;`
  (E1, sección «cableado» verde).
- `main.js:767` — `cuerpo.llamaEncendida = !!enMano;` (E7, sección «llama apagada»
  verde: la antorcha y el candil apagados no brillan, y cambiar de objeto y volver
  respeta el estado).

`Cuerpo.llamaEncendida` arranca en `false`. Antes del primer cuadro de `main`, y en
el maniquí de `Personaje.js`, la antorcha no muestra llama.

## Para medir en el navegador (E8)

- **El que espero peor: `cana_colihue`.** No por triángulos: tiene 72 y ningún
  modelo nuevo pasa de 304 (el arco). Es por las sombras. Cada malla se dibuja en
  cada cascada del CSM que la toca, y la caña es la más alta (3 m, la punta a
  3,56 m) con dos mallas, así que es la que más cascadas cruza. Techo teórico:
  2 dibujos en el pase principal y 8 en sombras, lo mismo que declaró la ronda 5.
  Mi número: +0,05 a +0,15 ms. Las predicciones de los agentes vienen cayendo del
  lado optimista: que decida la medición.
- Si la caña sale bien y se quiere un segundo, el arco (304 triángulos, 1,20 m).

## Lo que hay que mirar jugando

1. **Las varas en primera persona.** Se agarran del regatón y van casi paradas
   (rx −0,35). Mirando al frente, el ángulo mínimo al centro de la vista da 30°
   para las cuatro, contra 23 a 25° del pico, la pala y la barreta de hoy. No lo
   vi en pantalla.
2. **Al correr, dos siguen tocando el muslo derecho**, según una aproximación del
   cuerpo con cápsulas (`scratchpad/holgura.mjs` de la sesión): el arco, 1,1 cm, y
   el equipo de mosca, 4,8 cm. Parado y andando, los doce están libres. La misma
   medida marca 1,8 cm del **ahumador de la ronda 5** contra la muñeca parado: es
   el roce del puño, y nadie lo vio como defecto.
3. **Agachado**, lo que cuelga baja a 9–11 cm del suelo (boleadora de dos, 0,09
   m). E4 es de pie.
4. **Color de las boleadoras**: bolas y ramales van con `cuero`, que es curtido y
   más oscuro que el cuero crudo de la ficha. Quedó libre la duodécima tinta si el
   ojo del dueño la pide.

## Para quien tenga `herramientas.json`

Con las medidas elegidas y las densidades a mano (colihue 560–660 kg/m³, coihue
~600), tres fichas pesan más de lo que dan sus medidas reales: **lanza** 1,1 kg
contra ~0,75 (a 1,70 m pediría un astil de 3,6 cm, el tope del colihue),
**estólica** 0,6 contra ~0,38, **línea de mano** 0,2 contra ~0,1. No lo toqué:
no es mío y no cambia nada del juego que se vea.
