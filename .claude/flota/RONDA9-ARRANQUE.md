# Arranque de la ronda 9 — lo que quedó servido al cerrar la 8

Escrito por el jefe el 27/9/2026, después de cerrar las siete fases de la ronda 8.
**Esto no es un contrato: es la bandeja de entrada.** El contrato de cada fase se
escribe al abrirla, con su medición previa, como siempre.

## Estado al empezar

Rama `mejoras/ronda8-lo-que-vio`, 48 commits por delante de `main`, **sin fusionar y
sin subir**: espera a que el dueño la juegue. Las siete fases cerradas con banco y
falsador verdes. Lo medido y lo que quedó abierto, fase por fase, está en
`RONDA8.md`; el resumen corto, en `ESTADO.md`.

## Lo que ya está anotado, medido y sin tocar

Por orden de lo que va a morder primero:

1. **La hoja de iconos, a 2,22 kB de su techo.** 137,78 kB de 140 con 122 iconos, y lo
   corta `banco-r6-fase3.mjs` sección 3. **Con dos dibujos más se pone roja**, y le va a
   aparecer al primer agente que agregue un icono como si fuera culpa suya. No se
   arregla dibujando más chico —el techo lo consumen los 122, no los últimos—: se
   arregla en cómo se empaqueta la hoja (hoy es un `data:` URI por clase, sin comprimir
   y con los colores repetidos en cada dibujo). Es una decisión de la flota.
   Anotado en `pendiente-r8-piedra.md`, punto 4.
2. **`Fabricacion` no gasta la herramienta que pide.** El percutor tiene 30 usos y casi
   no bajan: `Equipo.desgastar()` lo llaman `Recoleccion._gastarHerramienta()` —y sólo
   si la herramienta habilita la acción, y el percutor no habilita ninguna— y
   `Caza._tiro()`. O sea que **el percutor se gasta tirando flechas y no picando
   piedra**. No puede ser una regla ciega: la ficha de `hilar_lana` dice explícitamente
   que hilar NO gasta el huso. Necesita una marca por receta (`gastaHerramienta`) y una
   decisión de balance. Anotado en `notaDurabilidad` del percutor y en
   `pendiente-r8-piedra.md`, punto 2.
3. **Fase 4b: las ramas peladas de las latifoliadas.** Al coihue y a las otras les asoman
   ramas desnudas fuera de la copa, del modelo viejo; se ve en todas las capturas de la
   fase 5 y 6. **Intenté medirlo de costado con geometría y la prueba dio un cero
   demasiado perfecto para creerlo** (la clasificación por color de vértice mete casi
   todo en un balde): **no está medido**. Medirlo bien es restar en la imagen, como hizo
   la fase 4 con el relleno de la copa.
4. **El disco de la luna sigue con brillo fijo (`2.6`)**, que es lo que mandaba A4. Ahora
   el creciente sale igual de blanco mientras todo lo que lo rodea bajó 0,68 paradas y el
   halo quedó en el 19,6 %. Y el `0.30` del halo quedó calibrado para la ley vieja. **Es
   decisión del ojo del dueño, no del banco.** Anotado en `pendiente-r8-luz.md`.
5. **La azuela, la pala de omóplato y la rastra** siguen saliendo de piedra cruda en un
   solo paso, y la azuela además pide 3 tientos, o sea cazar. Son las otras tres que
   cuelgan de `hacha_pulida`: lo natural es que pasen por la misma preforma y el mismo
   pulido. Tocarlas mueve `conTodo`, así que pide medición previa.
6. **`balanceSaber` del dataset quedó desactualizado**: dice que el árbol pide 1480 puntos
   y propone justamente lo que P6 de la fase 5 prohíbe. Lo mide `r4-economia.mjs`, que no
   está en ninguna lista de regresión.
7. **El suelo naranja junto al fuego.** El dueño pidió bajarlo; **ya bajó 60 % a 5 m solo**,
   por el arreglo de la luz del terreno de la fase 3b. **Decidí no tocarlo más hasta que lo
   mire**: si sigue molestando, es un cambio de una línea en el radio de la luz de fogata.

## Lo que hay que preguntarle al dueño, y lo que NO

- **NO preguntar la «otra cosa» de gráficos.** El 27/9/2026 confirmó que no existe: eran
  dos, el suelo de cerca y los árboles. Cerrado.
- **Sí** hay que escuchar lo que traiga de jugar: las tres decisiones de balance de la
  ronda 8 (morir pierde todo, la lana en 1 de cada 4, la cadena de cinco pasos con 3 de
  saber) son suyas y pueden volver.

## Lo que esta ronda enseñó y hay que seguir haciendo

- **Un banco que arma sus dependencias a mano no mide el cableado.** En la fase 7, 30
  aserciones verdes con la pestaña de licencias vacía en el juego, porque `main.js` no le
  colgaba `herramientas` al códice. Lo encontré leyendo, no midiendo. Al revisar una fase:
  listar qué falsea el banco y abrir `main.js` por cada cosa. Ver
  `banco-con-dependencias-falsas` en la memoria.
- **Cinco defectos de esta ronda fueron del jefe**, y los cinco los encontraron los agentes
  trayendo la cuenta sin tocar mis archivos. Esa regla paga: mantenerla.
- **El clima de cada carga es al azar.** Fijar `Tiempo._semillaA/_semillaB`, vaciar eventos
  y reiniciar Vite antes de comparar dos versiones. Y **re-anular `partida.guardar`,
  `calidad.automatico`, `exploracion` y `hallazgos` después de cada recarga.**
