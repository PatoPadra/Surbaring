# Bitácora `tecla` — ronda 7, fase 1

> Contrato: `RONDA7.md`, sección «FASE 1 · `tecla`» (K1 a K8). Banco:
> `banco-r7-fase1.mjs`, del jefe, sin tocar.

## Lo leído antes de tocar nada (12/9)

- `Entrada.js`: `adelante` sólo lee W/S/flechas; `blur` limpia teclas;
  `pointerlockchange` pone `bloqueado` y la clase `jugando`. `escribiendo()` ya
  existe.
- `Recoleccion.quePuedoHacer()`: las etiquetas hoy no dicen rinde; chatarra y
  cantera traen «(o R)» adentro. `actuar()` tiene los extras al azar con los
  números escritos en línea (0,28 obsidiana, 0,45 arcilla ×2, 0,16 lana ×1,
  0,22 pluma ×2).
- `Recursos.cosechaDe()`: el fruto/semilla es `2 + floor(random·3)` → 2–4.
- `Mineria.recuperarChatarra()`: `1 + floor(random·3)` → 1–3. La cantera ya
  trae `v.yacimiento.rinde` fijo desde `evaluar()`.
- `Caza.aprovechar()`: sortea la fuente con `Math.random` si no se la pasan.
  Cuatro fuentes en `caza.json`: puma (cuero 2, tendón 1, hueso 2), invernal
  (cuero 3, hueso 3, tendón 1), desmogue (asta 1, hueso 1), faena (cuero 4,
  grasa 2, tendón 2). Sin filo: sólo el hueso de la fuente.
- `HUD.mostrarAccion()`: `etiqueta.replace(tecla, …)`, la trampa de la R.
- Los bancos r5/r6 no leen etiquetas ni `mostrarAccion`: cambiar el texto no
  los toca.

## Hecho

- **Entrada.js (K1, K2).** `autoAndar` get/set sobre `_autoAndar`. Z alterna
  sólo con `bloqueado`, después del filtro de `e.repeat` y de `escribiendo()`.
  W/↑/S/↓ al bajar lo apagan (`CORTAN_EL_ANDAR`). `blur` y `pointerlockchange`
  a suelto lo apagan. La clase `auto-andar` se pone y se saca SÓLO en el
  setter: así ningún camino de apagado se la olvida. `adelante` vale 1 con el
  estado prendido y ninguna tecla de paso apretada; si W ya estaba abajo al
  apretar Z, manda la tecla y al soltarla sigue solo.
- **HUD.js (K2, K6).** `mostrarAccion()`: `<b>E</b> · etiqueta` y, con
  `tecla`, ` · o <b>R</b>` al final. CSS: `body.auto-andar #hud::after` con
  «Andando solo · W o S para frenar», debajo del cartel de acción, con el mismo
  lenguaje que las fichas de `#fenomenos` (fondo oscuro, filete de acento).
- **Opciones.js (K4).** Fila Z en «Moverse»; la calidad pasa de C a F2.
- **Recursos.js.** `cosechaPosibleDe(esp)` devuelve `{recurso,min,max}`;
  `cosechaDe()` sortea sobre eso con un `Math.random` por renglón con rango, en
  el mismo orden de antes (el fruto sigue siendo `2 + floor(r·3)`).
- **Mineria.js.** `rindeChatarra()` → `[{chatarra, 1, 3}]`;
  `recuperarChatarra()` sortea `min + floor(r·(max−min+1))` = `1 + floor(r·3)`.
- **Caza.js.** `sortearFuente(azar = Math.random())`; `fuenteDe(resto)` con la
  cadena de reemplazos que tenía `aprovechar()`; `rindeDeRestos(fuente,
  soloHueso)` con el filtro del hueso. `aprovechar()` usa las dos: mismo
  comportamiento.
- **Recoleccion.js (K5, K7).** `EXTRAS_MATA` con probabilidad, cantidad y
  condición de lugar (los comentarios de obsidiana, arcilla, lana y pluma se
  mudaron ahí). `parentesisDeRinde()` arma el paréntesis. `_rindeMata()` +
  `_accionMata()`: el rinde se arma una vez en `quePuedoHacer()` y viaja en la
  acción; `actuar()` sólo sortea sobre `acc.rinde`. Chatarra y cantera sin
  «(o R)».
- Banco, cuatro secciones: **4/4 verde** (29 · 10 · 198 · 12 aserciones).
- **Corrida completa** (`node .claude/flota/banco-r7-fase1.mjs`, sin
  variables): **6/6 verde**, con r5-fase1, r6-fase1, r6-fase2 y r6-fase3 en su
  número y `vite build` limpio.
- **Que exponer no cambió nada, medido y no leído**: `git archive HEAD src` al
  scratchpad y el mismo LCG como `Math.random` contra la base y contra el árbol:
  `cosechaDe()` de toda la flora ×30, `recuperarChatarra()` ×500,
  `aprovechar()` ×500 alternando filo más uno por `fuenteId`, y el siguiente
  número de la secuencia para contar sorteos consumidos. Salida **idéntica**
  (87 403 caracteres). El sorteo de extras de `actuar()` no entró en esa
  comparación: queda por lectura (mismo orden, un `Math.random` por renglón que
  cumple el lugar, y `_orillaCerca()` no consume azar).
- Etiquetas que salen hoy, copiadas del detalle del banco: «Recolectar maqui
  (5–7 × frutos)» · «Recolectar pino oregón (5 × madera blanda · 4 × pinocha)»
  · «Juntar piedra suelta (2 × piedra · a veces arcilla)» en la orilla, «(2 ×
  piedra · a veces obsidiana)» en altura, «(2 × piedra)» lejos y abajo ·
  «Juntar coirón (2 × fibra vegetal · a veces lana)» · «Trozar un caído · hacha
  de piedra (2 × tronco · 3 × leña · 2 × corteza)» · «Levantar chatarra (1–3 ×
  chatarra)» · «Abrir depósito de ripio (3 × ripio · 2 × arena)» · «Aprovechar
  los restos (3 × cuero · 3 × hueso · 1 × tendón)».
- Ningún archivo ajeno hizo falta: no hay `pendiente-r7-tecla.md`.

## Lo que el banco no mide y queda para el ojo

- Si el indicador de andar solo y las etiquetas largas se leen bien a su
  tamaño. La más larga es la de la carroña con filo o el tronco con hacha,
  ~70 caracteres en una línea centrada sin ancho máximo.

## Decisiones

- **La carroña: fuente fija por lugar.** `_azarDelLugar(x, z)` es un hash de la
  posición en la grilla de 25 cm del descanso; se lo pasa a
  `caza.fuenteDe({ azar })` y la fuente viaja en la acción hasta
  `aprovechar({ fuente, soloHueso })`. Por qué no la unión con «a veces»: con
  filo serían cinco «a veces» (cuero, tendón, hueso, asta, grasa), verdad que
  no dice nada, y justo el asta —la compuerta del nivel 3— quedaría escondida
  en la lista. Fijada dice exactamente qué da. Además es lo realista: un resto
  es una cosa, no se vuelve otra por esperar el descanso. `Sotobosque` siembra
  con semilla fija por celda, así que el mismo resto da siempre el mismo
  número. Medido con 200 000 posiciones al azar: puma 0,4003 · invernal
  0,2498 · desmogue 0,2425 · faena 0,1074, contra 0,40 · 0,25 · 0,25 · 0,10 del
  dataset.
  **Lo que sí cambia y hay que decirlo:** antes, esperar 150 s junto al mismo
  resto volvía a sortear la fuente; ahora el mismo resto da siempre lo mismo.
  La tasa sobre el mapa no cambia; la de «acampar en un resto» sí.
- **El paréntesis suma lo repetido**: el maqui dice «5–7 × frutos» y no «3 ×
  frutos · 2–4 × frutos». Los dos extremos se alcanzan porque lo fijo no
  depende del sorteo.
- **«a veces» sin número**: el contrato lo pide así y el parser del banco no
  admite «a veces 2 × arcilla». Prometer la cantidad de algo que sale al 45 %
  sería prometer de más.
- **El setter de `autoAndar` no prende con el puntero suelto**, tampoco desde
  afuera: todo lo que lo apaga pasa por soltar el puntero, así que prenderlo
  suelto dejaría un paso que nada detiene.
- **Descartado:** nombrar la fuente de la carroña en el cartel («restos de
  presa de puma»). Sale igual en el aviso al actuar, y el cartel ya es largo.
  Descartado también ponerle «(no da nada)» al taique: no lo pide el contrato y
  cambiaría el verbo de una acción que igual identifica la planta.
