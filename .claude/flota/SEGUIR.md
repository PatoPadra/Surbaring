# CÓMO SEGUIR — al 3/9/2026

Esto **no es un encargo**: es el inventario de lo que quedó abierto, para que el
dueño elija por dónde sigue. El encargo de la ronda 2 está en `RONDA2.md`, y el
estado general en `ESTADO.md`, que es lo primero que hay que leer siempre.

---

## En una línea

**La ronda 2 está escrita, medida, commiteada y empujada. Le falta una sola cosa,
y no la puede hacer un agente: que la juegues.**

Nada de esta ronda se vio en pantalla —el panel del navegador no compone
cuadros—, así que está verificada por mecanismo y por bancos de Node. Es
exactamente la clase de trabajo donde el ojo encuentra en diez segundos lo que
un banco no mira. Si algo se ve mal, no es que la medición mintió: es que medía
otra cosa.

Rama `mejoras/ronda2-jugabilidad-graficos`, cinco commits, en `origin` desde el
3/9/2026. `main` sigue en `e3e1b45` y no se toca hasta que la juegues.

---

## Paso 1 · Jugarla

```sh
git checkout mejoras/ronda2-jugabilidad-graficos
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

**Si está todo bien**, la fusión es avance rápido y no hay conflicto posible:

```sh
git checkout main && git merge --ff-only mejoras/ronda2-jugabilidad-graficos && git push
```

**Si algo se ve mal**, no hace falta abrir una ronda entera: los ocho puntos de
arriba son de una línea a tres. Se arregla sobre la misma rama y recién después
se fusiona.

---

## Paso 3 · Los desafíos que siguen

Todo esto está **diagnosticado y sin empezar**. No es trabajo a medias: no se
abrió a propósito, porque era trabajo nuevo y ampliarlo por cuenta propia no era
lo pedido.

### A · Lo que más hace al juego

1. **Los gestos que faltan.** Caza, pesca, saberes, relevamiento y exploración no
   tienen gesto propio; la chatarra y la cantera ya tienen el suyo desde la ronda
   2. Es lo que más se nota jugando, porque es lo que hacés todo el tiempo.
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
5. **Los dos defectos de vegetación que piden medir memoria**: las ocho vistas de
   impostor y el corte del sotobosque a 192 m. No se abrieron porque hace falta
   un banco de memoria que todavía no existe.

### C · Deuda barata, que evita el defecto de mañana

6. **`Construccion.alCambiar` es una sola ranura**, y hoy está libre. El segundo
   que la enganche pisa al primero sin avisar.
7. **`Mineria._ultimoFrente` es un memo de una sola ranura con dos consumidores**
   (`Hallazgos` y `quePuedoHacer`). Hoy no cuesta nada porque pasa cada 128 m,
   pero es la misma forma del punto anterior.
8. **Los 12 m de la orilla están escritos dos veces.** `Hallazgos.js:80` ya
   exporta `orillaCerca()`; `Recoleccion._orillaCerca()` puede importarlo y
   quedar en dos líneas. Dónde vive el predicado lo decide `juego`; lo que
   importa es que el número esté en un solo lugar. Ya nos costó un defecto.

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
