# Bitácora — agente `vida` (Audio.js, Fauna.js, Peces.js)

Estado: **en curso**. Última actualización: paso 1 de 4 (tabla de voces escrita).

---

## 1. Diagnóstico

### El insumo que no había que inventar

`src/data/fauna.json` ya tiene un campo **`vocalizacion`** por especie, en prosa y
verificado contra fuentes: «Un explosivo chu-CAO, chu-CAO de sílabas rodadas,
seguido de un trino descendente», «doble golpe seco y potente sobre el tronco»,
«prácticamente mudo: carece de siringe». **Toda la tabla de síntesis sale de ahí.**
No hay que inventar ni una voz: hay que traducir 61 descripciones a parámetros.
53 de las 61 especies tienen `vocalizacion` no nula (los 7 peces y nadie más la
tienen en null).

### Parámetros de síntesis elegidos (lo caro de encontrar)

Esquema de la tabla `VOCES` en `src/engine/Audio.js`, arriba de `class Audio`:

    t   timbre: 's' silbo limpio (sine) · 'a' áspero (sawtooth+pasabanda)
        'n' nasal (square+pasabanda) · 'g' golpe percusivo (ruido+pasabanda)
    f   frecuencia base en Hz
    n   notas [desfase_s, ×frecuencia, duración_s, volumen]
    b   barrido: multiplicador de frecuencia al final de la nota
    vb  vibrato en Hz · pv profundidad como fracción de la frecuencia
    r   repeticiones de la frase [mín, máx] · sp separación entre ellas
    a   alcance en metros (a esa distancia ya no se oye)
    q   Q del pasabanda de timbre, sólo timbres 'a' y 'n'

Helper `serie(cant, dt, mult, dur, vol, t0)` arma trinos y parloteos; `mult` y
`vol` aceptan función del índice, así se hacen los acelerados (rayadito) y los
que se apagan (gaviota).

**Los tres que más importan, con sus números:**

- **chucao** — el sonido firma de la selva valdiviana. `t:'s'`, `f:1150`,
  `vb:20`, `pv:0.045`, `a:130`. Frase: dos sílabas rodadas (0.80× corta 55 ms +
  1.30× larga 150 ms) repetidas a los 0.30 s, y después un trino descendente de
  5 notas de 1.22× a 0.85× cada 65 ms. Es la estructura literal de la ficha.
  *La clave para que suene a pájaro y no a pitido: el salto de 0.80× a 1.30× en
  65 ms (la sílaba «rodada») más el vibrato de 20 Hz. Sin vibrato es un timbre
  de horno; sin el salto rápido es una nota de flauta.*
- **huet_huet** — `t:'s'`, `f:430` (grave, como dice la ficha), `b:0.94`
  (cae apenas), `vb:8`, `a:170`, dos notas de 200 ms separadas 300 ms,
  repetidas 2-4 veces. Lo grave es lo que hace que «resuene entre los troncos».
- **carpintero_gigante** — no es voz, es percusión: `t:'g'` (ruido por
  pasabanda), `f:380`, `q:2.2`, dos golpes de 90 y 110 ms separados 75 ms,
  `a:260` porque el tamborileo sobre tronco hueco viaja muchísimo.

Detalles que son contenido educativo y no adorno:

- **cóndor andino**: la ficha dice que carece de siringe. Tiene entrada `t:'g'`
  con un solo siseo de 340 ms a volumen 0.45 y alcance 90 m. **No canta.**
- **puma**: `f:340` con barrido descendente. No ruge (no tiene el hioides de los
  *Panthera*); la ficha lo dice y la síntesis lo respeta.
- **zorzal patagónico**: dos entradas, `zorzal_patagonico` (flauteado, melodioso)
  y `zorzal_patagonico_alarma` (áspero, seco). La ficha dice «al amanecer» vs.
  «al atardecer» — la hora elige cuál suena.
- **cauquén común**: dos entradas, macho (silbido fino 2200 Hz) y hembra
  (cacareo grave 520 Hz), como dice la ficha.
- **ciervo colorado**: la brama es **otoñal**. `a:900` («se oye a kilómetros»).
  Fuera del otoño no debe sonar.
- **tuco-tuco**: `f:190`, `q:1.1`, golpe sordo, `a:35`. Suena desde debajo de
  la tierra, por eso el alcance corto y el pasabanda casi abierto y grave.

Cobertura: 40 entradas (24 aves + mamíferos + 2 variantes de sexo/hora).
**El que no tiene entrada no canta**, a propósito: mejor menos voces que la voz
equivocada. Es la misma política que ya declara la cabecera de `Audio.js` sobre
no usar bibliotecas genéricas de «bosque».

### La máquina de estados de la fauna: qué encontré

Leído `src/entities/Fauna.js` entero (656 líneas). Defectos concretos:

1. **La distancia de fuga del dataset está siendo ignorada.** Línea ~250:
   `if (distancia < huida * 0.55 && !agresivo)`. El `* 0.55` hace que el huemul
   (`distanciaHuidaM: 45`) recién arranque a **24,75 m** y el guanaco (100 m) a
   55 m. El dato verificado dice otra cosa. Es el defecto de comportamiento más
   grave y el más barato de arreglar.
2. **No hay sigilo.** Agachado o corriendo da exactamente lo mismo. `jugador`
   ya expone `.agachado` y `.corriendo`.
3. **La alarma no se propaga.** Las especies gregarias (guanaco 3-25, ciervo
   colorado 2-30, cachaña 5-40) huyen de a uno aunque estén al lado. Un guanaco
   que relincha y una tropa que sigue pastando no es una tropa.
4. **Las aves chicas no vuelan nunca.** `const vuela = esp.clase === 'ave' &&
   (esp.pesoKg ?? 0) > 1.5` (línea ~210). Con ese umbral **sólo vuelan cóndor
   (11,3 kg), águila mora (2,5), cauquén (3)**. El chucao (40 g), el rayadito
   (11 g) y la cachaña (150 g) caminan por el suelo — y `construirAve()` no les
   modela patas, así que **patinan**. Al huir tendrían que despegar.
5. **Las aves grandes no se posan nunca.** Nacen con
   `objeto.position.y += alturaVuelo` (40-170 m) y se quedan ahí para siempre.
6. **Radio de aparición 187-340 m** (`RADIO_APARICION * (0.55 + rnd*0.45)`).
   Ningún animal aparece cerca; se acercan caminando a ~1 m/s. Consecuencia para
   el audio: si las voces salieran sólo de animales simulados, casi todas
   sonarían a 200 m y por lo tanto casi inaudibles. **Decisión de diseño:** la
   población viva decide *qué especie* canta (ya viene filtrada por bioma,
   altitud, estación, hora y distancia al agua por `_aptitud` y `_actividad`,
   que es exactamente la lógica correcta y no hay que duplicarla); la *posición*
   del que canta se sortea dentro del alcance de la especie. Es honesto:
   `MAX_VIVOS` es 52 y en el parque hay miles — el que canta es uno de los que
   no se simulan.

### Convención de ejes verificada (para el paneo estéreo)

`src/entities/Jugador.js`: `this.giro` es la rotación horizontal.
Líneas 458-460 (`ojo.x - sin(giro)*OJOS_ADELANTE`) confirman que el **frente** es
`(-sin giro, -cos giro)`, así que la **derecha de la cámara** es
`(cos giro, -sin giro)`. Paneo = `normalizar(dx,dz) · (cos giro, -sin giro)`.
No hace falta `atan2`.

---

## 2. Hecho

- **`src/engine/Audio.js`** — agregado arriba de `class Audio`: constante
  `MAX_VOCES = 4`, helper `serie()`, y la tabla `VOCES` con 40 entradas
  derivadas del campo `vocalizacion` de `fauna.json`. En el `constructor`,
  cuatro contadores nuevos: `vocesActivas`, `vocesEmitidas`, `vocesPico`,
  `vocesRechazadas` (para poder medir fugas de osciladores desde el script
  inyectado, que es la única forma de verificar audio acá).
  **Todavía sin verificar** — falta el motor de síntesis que consuma la tabla.

---

## 3. Siguiente

Paso concreto, en orden:

1. **`Audio.js`: escribir el motor `voz(id, {distancia, azimut, ganancia})`**
   que consuma `VOCES`. Cadena por frase, compartida entre todas sus notas para
   que salga barata: `[osc por nota → gain por nota] → gainFrase →
   [pasabanda de timbre si t es 'a'/'n'] → pasabajos de distancia → StereoPanner
   → this.bus`. Un solo LFO de vibrato por frase conectado a todos los
   `osc.frequency`. Atenuación `(1 - d/alcance)^1.6`; el pasabajos de distancia
   va de ~16 kHz cerca a ~1,2 kHz en el borde (el aire se come los agudos: el
   mismo principio que ya usa `_trueno`). Cortar con `return false` si
   `vocesActivas >= MAX_VOCES` (y sumar `vocesRechazadas`). Contar
   `vocesActivas++` al empezar y `--` en el `onended` de la última fuente, con
   `disconnect()`.
2. **`Fauna.js`: `_vocalizar(dt, jugador, est, hora)`**, llamado desde
   `actualizar()`. Proceso de Poisson (`-Math.log(1-Math.random())`) para que
   **no haya período audible por construcción**. Modulación de las ganas de
   cantar: coro del amanecer (gaussiana centrada en 7,2 h) y del atardecer
   (19,6 h, más floja); con lluvia o granizo fuerte los pájaros callan
   (`1 - min(1, lluvia*2.2)`); el viento fuerte también los baja. Elegir
   candidato entre `this.vivos` pesando por `_actividad(esp, hora)`. Enfriamiento
   por individuo. Tras una alarma, silencio del coro 4-8 s.
3. **`Fauna.js`: distancia de fuga.** Sacar el `* 0.55`, usar el valor del
   dataset tal cual, multiplicar por sigilo (agachado 0.55, corriendo 1.35) y
   poner la detección/alerta en `huida * 1.9`. Alarma sonora al pasar a HUYENDO
   y propagación a conespecíficos gregarios a menos de 40 m.
4. **`Fauna.js`: despegue de las aves chicas** al huir (hoy patinan por el
   suelo sin patas modeladas).
5. **`Peces.js`: deriva del centro del cardumen + reacción al jugador** en la
   orilla (hoy giran en un círculo de centro fijo).
6. **Verificar**: pestaña propia en `http://127.0.0.1:5174/`, script inyectado
   que hace `window.SurviBar.fauna.audio = window.SurviBar.audio` **en caliente**
   (así se prueba la cadena completa sin tocar `main.js`, que es del
   coordinador), y después medir a lo largo de varios minutos simulados:
   `vocesActivas` (tiene que volver a 0), `vocesPico` (≤ 4), `vocesEmitidas`, y
   la lista de intervalos entre cantos para confirmar que no hay período.
   Capturas con prefijo `vida-`.
7. **Escribir `.claude/flota/pendiente-vida.md`** con el parche exacto de una
   línea para `main.js`: después de `const audio = new Audio();` (línea ~228),
   agregar `bichos.audio = audio;`. Sin esa línea la fauna queda muda en
   producción (pero el juego anda igual que hoy: `this.audio?.` es opcional).

---

## 4. Descartado

- **Duplicar el filtro de hábitat dentro de `Audio.js`** para decidir qué
  especie canta. `Fauna._aptitud()` ya resuelve bioma, altitud, estación y
  distancia al agua contra el dataset; reimplementarlo en el audio sería lógica
  duplicada que tarde o temprano contradice el JSON verificado. El audio recibe
  la especie ya elegida.
- **Poner los parámetros de síntesis dentro de `fauna.json`.** El CONTEXTO
  permite agregar campos, pero frecuencias y Q son números de audio, no datos
  naturales: mezclarlos con el contenido verificado lo ensucia. Van en
  `Audio.js`, al lado del código que los usa.
- **Boids completos (cohesión/separación/alineación) en `Peces.js`.** Con hasta
  22 peces por cardumen y 14 cardúmenes, las consultas de vecinos son O(n²) por
  cuadro para una diferencia visual mínima a la distancia a la que se ven los
  peces bajo el agua. Se hace lo que sí se nota: que el centro del cardumen
  derive y que el cardumen reaccione al jugador.
