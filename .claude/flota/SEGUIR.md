# CÓMO SEGUIR — al 3/10/2026

**Las rondas 8 y 9 están en `main` y en GitHub, y nadie las jugó.** Esta es la lista
de lo que hay que probar jugando y de lo que hay que elegir. Lo de más abajo (desde
«al 7/9/2026») es historia de las rondas 2 y 3.

```sh
git checkout main
npm run dev
```

**Ojo con la partida guardada:** la fecha nueva de arranque (primavera) es sólo para
partidas nuevas. Para probar el primer año: Esc → Partida → Reiniciar.

## A · Probar jugando — ronda 9

1. **Arranca en primavera** (21/9). La primera noche es fría (~0 °C): ¿se pasa con lo
   que el juego te da?
2. **Dormir.** Parapeto (8 leña, 3 fibra) y fogata encendida (6 leña, 4 piedra); de
   noche, a menos de 6 m del parapeto y 8 m del fuego, la E dice «Dormir». Te despierta
   el sol. Con poca leña el fuego se apaga a mitad de la noche y amanecés con frío.
3. **El códice**, los primeros tres días: debajo del contador dice el objetivo del año.
4. **El percutor se gasta picando piedra** (30 usos). Cuando se rompe mientras fabricás
   no hay aviso en ese momento (leído en el código, no probado jugando).
5. **Al coihue ya no le asoman ramas peladas** de la copa.
6. **Los íconos del bolso** tienen que verse igual que antes.

## B · Probar jugando — ronda 8

7. La brújula centrada, la flecha del mapa, el minimapa y el zoom del mapa.
8. La trampa de lazo: ponerla, verla en el mapa, revisarla a la mañana.
9. El suelo de cerca: la textura nueva, la piedra que ya no es verde, la sombra de los
   árboles sobre el suelo.
10. Las coníferas (ciprés, pino) con la copa llena.
11. La cadena de la piedra desde cero: percutor → … → hacha, sin obsidiana ni cuero.
12. Las noches de luna en cuarto, bastante más oscuras que antes.
13. La pestaña Normativa del códice, con las licencias.

## C · Elegir

14. **La luna** — A, B o C. Mirala con F8 (ver abajo) o en `capturas/r9-f6-luna-ABC.png`.
15. **El fuego** — A, B o C. F9, o `capturas/r9-f6-fuego-ABC.png`.
16. **Las tres decisiones de balance de la ronda 8:** morir pierde todo (también las
    cuatro ranuras y la llama), la lana del coirón en 1 de cada 4, el hacha en cinco
    pasos con 3 de saber. ¿Se quedan?
17. **Azuela, pala de omóplato y rastra:** ¿pasan por la preforma y el pulido (encima
    del hacha de cinco pasos) o esperan a que decidas el punto 16?
18. **Dormir con T al máximo es una noche gratis** (la noche de junio cuesta 47 de sed a
    24×, 16 a 72× y 0,2 a 7200×). ¿Se deja así o dormir cobra siempre a la velocidad
    normal?
19. **Dos cosas vistas de paso:** la cara oscura de la luna sale más oscura que el
    cielo (un círculo apagado), y con el alcance de hoy un tronco a ~12 m del fuego se
    enciende rojo. ¿Se arreglan?
20. **El cierre del año** dice «llegaste sin morir»; tu respuesta 4 pedía también
    noches sobrevividas y si pasó el invierno. ¿Se suman?
21. **Los hitos intermedios del primer año** (primera noche, semana, otoño, invierno):
    propuestos, no construidos. ¿Se hacen?
22. **Sin fase todavía:** el tiento como variante del hacha con más durabilidad, y el
    total nuevo de `balanceSaber` (necesita un instrumento nuevo).

Para mirar la luna y el fuego jugando, en la consola del navegador (no toca el reloj
ni el guardado; al recargar vuelve todo):

```js
(await import('/.claude/flota/mirar.js')).teclas()
```

F8 alterna la luna y F9 el fuego; un cartel abajo a la izquierda dice cuál está puesta.
El detalle y los números, en `RONDA9.md`, fase 6.

---

# CÓMO SEGUIR — al 7/9/2026

Esto **no es un encargo**: es el inventario de lo que quedó abierto, para que el
dueño elija por dónde sigue. El encargo de la ronda 2 está en `RONDA2.md`, el de
la ronda 3 en `RONDA3.md`, y el estado general en `ESTADO.md`, que es lo primero
que hay que leer siempre.

---

## LA RONDA 3 CERRÓ, SE VIO Y ESTÁ EN `main`

Las tres fases —`horno`, `fauna`, `flora`— están medidas, revisadas y
commiteadas. **El dueño la jugó el 7/9/2026 antes de fusionarla, y su veredicto
fue «está espectacular, al menos a primera vista».** Recién entonces entró a
`main`, por avance rápido.

**Ése es el cambio de método que conviene conservar.** La ronda 2 se fusionó
antes de que nadie la viera, y quedó cuatro días sin saber si estaba bien. Ésta
esperó al ojo. Esperar costó un comando; no esperar habría costado descubrir en
`main` que un tronco quedó negro.

Lo que sigue se escribió *antes* de que la jugara y se conserva tal cual, porque
es la lista de lo que había que mirar. Quedó mirado por encima: una segunda
pasada con tiempo todavía puede encontrar algo, sobre todo el punto 2, que es el
único que un banco no puede decidir.

**Lo que hay que mirar, que es lo que ningún banco puede ver:**

1. **La corteza de los troncos.** Hasta ahora las 63 especies leñosas
   muestreaban un solo texel blanco: el tronco era color plano. Ahora tiene
   grietas verticales y placas, con el tono de cada especie. Acercate a un
   coihue y a un alerce: tienen corteza distinta a propósito —la conífera va en
   placas gruesas, la latifoliada lisa y estriada.
2. **Que el tronco no haya quedado ni más oscuro ni más claro.** El albedo medio
   está compensado por construcción, pero eso es aritmética: el ojo decide.
3. **La costura del tronco.** Tiene que no existir. Si ves una raya vertical
   recorriendo un tronco de arriba abajo, es eso.
4. **La copa.** El follaje ahora va en matas con claros entre ellas, y en tres
   estratos de tono, en vez de repartido parejo. Miralo de lejos, contra el
   cielo.
5. **Los animales de la fase 2**, que tampoco se vieron nunca: un huemul a
   cinco metros tenía que dejar de ser una cápsula gris.

**Lo que NO vas a ver y está bien:** 45 MiB menos de memoria de video. Es el
resultado más grande de la ronda y es invisible por definición.

**Lo que sí quedó feo y ya está anotado:** el zorrino patagónico tiene dos
cinturones alrededor del cuerpo en vez de sus dos franjas dorsales. Está
diagnosticado con el arreglo escrito en `pendiente-r3-fauna.md`, punto 3, y
postergado a la ronda 4 a propósito.

El detalle entero —incluidas las tres trampas de medición que costó esta ronda—
está en `ESTADO.md`, arriba de todo.

---

---

## En una línea

**La ronda 2 está escrita, medida, commiteada y empujada. Le falta una sola cosa,
y no la puede hacer un agente: que la juegues.**

Nada de esta ronda se vio en pantalla —el panel del navegador no compone
cuadros—, así que está verificada por mecanismo y por bancos de Node. Es
exactamente la clase de trabajo donde el ojo encuentra en diez segundos lo que
un banco no mira. Si algo se ve mal, no es que la medición mintió: es que medía
otra cosa.

Está en `main` desde el 3/9/2026 y empujada. Se fusionó **antes** de jugarla,
por decisión del dueño: lo que sigue abierto no es dónde vive el código, es que
nadie lo vio todavía. Si alguna de las ocho queda fea, se arregla sobre `main`.
La rama `mejoras/ronda2-jugabilidad-graficos` quedó como mojón y se puede borrar.

---

## Paso 1 · Jugarla

```sh
git checkout main
npm run dev
```

Tres cosas que muerden si no se saben:

- **La partida vieja no se borra a mano**: el juego la reescribe al cerrar. Se
  borra desde `Esc → Partida → Reiniciar`.
- El arranque **espera** en la creación de personaje: hasta que no elegís,
  `window.SurviBar` no existe. La elección queda en `localStorage`, clave
  `survibar.aspecto.v2`.
- **Mirá en preset Baja, no en Alta.** Es donde vas a jugar de verdad: 31,8 fps
  a 1024×576. Baja a 720p (23,6 fps) es la combinación a evitar.

### Las ocho cosas para mirar, y dónde se tocan si están mal

| # | Qué mirar | Si está mal |
|---|---|---|
| 1 | **Que el cartel de ripio no esté.** Es el defecto que trajiste con captura. Medido: de un aviso cada 47 m al 6,2 % del recorrido. | `Mineria.js:36` — `FRENTE_M`, el tamaño de celda |
| 2 | **El ritmo de los avisos nuevos** de `G` (taller), `Tab` (códice) y `H` (caza). Si se pisan o molestan. | `Recoleccion.js:486` (1,5 s) y `:365` (4,5 s) |
| 3 | **El bosque caminando**, franja de 100 a 140 m. El pico de cambios simultáneos bajó de 105 a 15. | `Vegetacion.js` — la histéresis de cambio de celda |
| 4 | **El lago lejano contra un cerro.** Si la veta del agua queda manchada o exagerada. | `Agua.js:717` — **un solo número** |
| 5 | **La línea de espuma de la orilla**: tres bandas o un canto duro. Viene sin verificar desde la ronda 1. | `Agua.js:787-799`, y el alfa de `:814` |
| 6 | **El suelo a tres o cuatro metros**: el grano de gravilla tenía que estirarse de 5,6 m a 11 m. | `Terreno.js:550` — `alcanceCerca` |
| 7 | **La estepa al este seco**, que antes no tenía una sola especie leñosa apta. | `Vegetacion.js:1508` — `elegirEspecies()` |
| 8 | **El mapa**: contraste del sombreado a cada zoom, si 50 m de equidistancia raya las cumbres, si los seis glifos se distinguen a 640 px, y si la X de las obras tiene el tamaño que querías. | `Mapa.js` — los cuatro son cambios de tres líneas |

---

## Paso 2 · Según lo que veas

**Si está todo bien**, no hay nada que hacer: ya está en `main` y en GitHub.

**Si algo se ve mal**, no hace falta abrir una ronda entera: los ocho puntos de
arriba son de una línea a tres, y cada uno dice qué archivo se toca. Se arregla
sobre `main` y se commitea aparte, para que quede escrito qué encontró el ojo y
no encontró el banco. Es la información más cara de esta ronda, porque es la
única que ningún script pudo dar.

---

## Paso 3 · Los desafíos que siguen

Todo esto está **diagnosticado y sin empezar**. No es trabajo a medias: no se
abrió a propósito, porque era trabajo nuevo y ampliarlo por cuenta propia no era
lo pedido.

### A · Lo que más hace al juego

1. **Los gestos que faltan — lo que queda es menos de lo que decía acá.** La
   ronda 2 cerró caza (`H`), pesca (`P`, que se anuncia otra vez desde que se
   destrabó la rama de beber), taller (`G`) y códice (`Tab`): los cuatro tenían
   tecla y ninguno se nombraba. **Siguen sin gesto propio saberes, relevamiento y
   exploración**, que son los tres que no tienen nada que apretar. Es lo que más
   se nota jugando, porque es lo que hacés todo el tiempo.
2. **El `hueso` no lo pide ninguna receta.** Tiene ficha, se ve y se junta —lo
   entrega `caza.json` en tres lugares— y no sirve para nada. Es la clase de cabo
   suelto que el jugador lee como «el juego está incompleto».
3. **La legibilidad del árbol de 47 tecnologías.** Y con ella, una decisión de
   diseño que es tuya: si el juego cierra en las eras 1 y 2, o las 21
   tecnologías industriales quedan como museo en el códice.

### B · Lo que queda de gráficos, con el presupuesto que hay

4. **El terreno es el 35 % del cuadro** y hoy la única pieza con algo grande para
   ganar. El sotobosque ya bajó a 4,5 %, los árboles son 22 %, el reflejo cuesta
   0 %. Cualquier ronda de rendimiento que no empiece por el terreno está
   mirando el número equivocado.
5. ~~**Los dos defectos de vegetación que piden medir memoria**: las ocho vistas de
   impostor y el corte del sotobosque a 192 m.~~ **Corregido el 11/9/2026:** las
   vistas de impostor son **dieciséis desde la ronda 2** (`Vegetacion.js:778`), y
   se eligen por la posición de la cámara, así que girar no produce cruce.
   Medido en la ronda 5: una vuelta de 360° da un solo estado del bosque. Queda
   abierto sólo **el corte del sotobosque a 192 m**, que es decisión del dueño
   porque cuesta cuadro.

### C · Deuda barata, que evita el defecto de mañana

6. **`Construccion.alCambiar` es una sola ranura**, y hoy está libre. El segundo
   que la enganche pisa al primero sin avisar.
7. **`Mineria._ultimoFrente` es un memo de una sola ranura con dos consumidores**
   (`Hallazgos` y `quePuedoHacer`). Hoy no cuesta nada porque pasa cada 128 m,
   pero es la misma forma del punto anterior.
8. ~~Los 12 m de la orilla escritos dos veces.~~ **HECHO** en `93fe80e`. El
   predicado vive en `Mundo.orillaCerca()`, que es donde correspondía: los dos
   que preguntan dependen del terreno y ninguno del otro. `Hallazgos.js:80` y
   `Recoleccion._orillaCerca()` delegan ahí, así que el número está en un solo
   lugar. Queda anotado porque el defecto que causó —el mapa marcando el 6 % de
   la arcilla real— es el ejemplo más barato de por qué una constante duplicada
   se cobra sola.

### D · Decisiones que son tuyas, no de un agente

9. **La velocidad.** Subió 78 % al arreglar el rozamiento (1,91 → 3,40 m/s). Es
   lo que el código siempre declaró y lo que dice el README, pero el juego se
   venía equilibrando al valor viejo. Si se siente demasiado, se toca
   `velocidadBase` — **no** se vuelve a poner el rozamiento contra la entrada.
10. **`capturas/` está fuera del repo** (en `.gitignore`): 204 archivos, con las
    `base-*.png` que son el «antes» de toda comparación futura. Ya decidiste
    dejarlo así; queda anotado porque si esa carpeta se pierde, se pierde la
    línea de base de todo.

---

## Las reglas que no cambian

Están enteras en `RONDA2.md`, sección «Reglas». Las dos que más caro salieron:

- **Leer «Trampas de medición ya pagadas» de `ESTADO.md` antes de medir
  cualquier cosa.** Son siete y costaron una sesión cada una.
- **Quien escribe el arreglo no puede escribir el banco que lo mide.** La
  revisión independiente de la ronda 2 encontró nueve defectos que ninguno de
  los tres jefes podía ver en su propio trabajo, incluida una rama muerta nueva
  creada por un arreglo y un banco que declaraba 17/17 sin ejercitar 3 de 5
  tipos. Cualquier ronda que se cierre sin revisor externo se está mintiendo.

---

## El comando para arrancar la sesión que sigue

Pegá esto y alcanza:

```
Leé .claude/flota/ESTADO.md y .claude/flota/SEGUIR.md antes de tocar nada.
Vengo de jugar la ronda 2. Lo que vi: <lo que hayas visto, aunque sea "está todo bien">.
```

Si lo que sigue es otra ronda de flota, agregale: *«armá la ronda 3 con el mismo
reparto de archivos y las mismas reglas de `RONDA2.md`, y esta vez el revisor
independiente entra desde el principio»*.
