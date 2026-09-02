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

Al retomar, lo escrito era **mucho mas** de lo que decia esta bitacora: el
agente alcanzo a escribir el motor entero y no a anotarlo antes de que lo
cortara el limite. Ya estaban `voz()`, `tieneVoz`, `alcanceVoz`, la tabla de 42
voces, `Fauna._vocalizar`, `_alarma`, `_contagiar`, la distancia de fuga sin el
`* 0.55`, el sigilo y el despegue de las aves chicas.

Lo que faltaba, y se hizo ahora:

1. **El cableado de `main.js`** - sin `bichos.audio = audio` la fauna quedaba
   muda con las 42 voces escritas, y **sin que nada fallara ni avisara**, porque
   del lado de `Fauna` el acceso es opcional (`audio?.listo`). Esa opcionalidad,
   puesta para que la falta no rompiera nada, era justo lo que escondia la falta.
2. **El testigo de las voces** - ver seccion 3.
3. **Los pasos enganchados a `jugador.fasePaso`** - el traspaso de `feel`.
4. **`Peces.js`**, el unico archivo del plan que nunca se habia abierto.
5. Una fuga latente en `voz()`: la salida por `!fuentes.length` ocurre despues
   de arrancar el vibrato, asi que dejaba un oscilador sonando para siempre. No
   es alcanzable con la tabla actual, pero la salida ahora limpia.

## 3. El defecto que habia, y era el inverso del que se buscaba

La tarea escrita era "comprobar que no haya fuga de osciladores". **No la hay.**
Lo que habia era lo contrario: **todo se desarmaba demasiado pronto**.

`voz()` cuenta las voces con un `BufferSource` mudo que arranca con la frase y
termina con la ultima nota. Ese testigo usaba `this.ruido`, que dura
`SEG_RUIDO = 2` segundos, y **sin `loop`**. Un `BufferSource` sin bucle termina
cuando se le acaba el bufer e **ignora su propio `stop()`**: el testigo moria
siempre a los dos segundos.

Consecuencias, las tres medidas:

- **27 de las 42 voces se cortaban siempre**, y 35 al menos a veces. Entre ellas
  el chucao, que es el sonido firma del bosque y al que esta bitacora le dedico
  la mayor parte del trabajo de sintesis.
- El `onended` disparaba temprano, asi que `vocesActivas` bajaba antes de tiempo
  y **el tope de `MAX_VOCES` dejaba pasar mas frases de las que decia permitir**
  - justo la proteccion de CPU que el testigo existe para sostener.
- Los `disconnect()` corrian con notas todavia programadas: la frase se cortaba
  a la mitad en vez de terminar.

Arreglo: `testigo.loop = true`. Una linea.

### Medido, en el juego corriendo

Duracion real de la frase, disparada a 8 m:

| voz | antes | despues |
|---|---|---|
| ciervo colorado (brama) | 2,00 s (tope) | **12,78 s** |
| zorzal patagonico | 2,00 s (tope) | **6,19 s** |
| churrin | 2,00 s (tope) | **4,06 s** |
| tuco-tuco colonial | 2,00 s (tope) | **3,17 s** |
| huet-huet | 2,00 s (tope) | **2,31 s** |
| cachana | 2,00 s (tope) | **2,14 s** |

### Fuga de osciladores: no hay

Coro del amanecer forzado, 240 s simulados, hora 7,0, otono, sin lluvia:

| | |
|---|---|
| animales vivos | 52 (el tope) |
| **voces activas al terminar** | **0** |
| tiempo hasta llegar a cero | 1,96 s |
| pico de voces simultaneas | **4** - nunca paso `MAX_VOCES` |

Los 90 rechazos de esa corrida **no son un dato del juego**: comprimi 240 s
simulados en 10 s reales, y las frases suenan en tiempo real. Con la tasa real
del amanecer -un canto cada 2,6 s contra frases de 3,3 s de media- la carga
ofrecida es 1,27 voces simultaneas sobre 4 lugares, asi que el rechazo es raro.

### Periodo audible: no hay

El generador es `1.4 - Math.log(1 - Math.random()) * 4.6`: exponencial con piso.
20.000 muestras por escenario.

| escenario | ganas | intervalo medio | CV | autocorrelacion (retardos 1-8) |
|---|---|---|---|---|
| amanecer 7,0 h | 2,30 | 2,62 s | **0,759** | todas < 0,006 |
| media manana 10,3 h | 0,24 | 24,98 s | 0,761 | todas < 0,014 |
| atardecer 19,8 h | 1,06 | 5,66 s | 0,755 | todas < 0,010 |
| noche 3,0 h | 0,28 | 21,67 s | 0,766 | todas < 0,007 |
| amanecer con lluvia 0,5 | **0** | - | - | callados del todo |

Un metronomo daria CV = 0. Una exponencial con piso de 1,4 s sobre media 6,0 da
0,767, y eso es lo que sale. La autocorrelacion esta en el ruido de fondo
(1/raiz(20000) = 0,007). **Los intervalos son sin memoria: no hay periodo que el
oido pueda encontrar.**

## 4. Los pasos, del traspaso de `feel`

`Audio.pasos` acumulaba distancia por su cuenta y disparaba cada 0,85 m -o 1,25
corriendo-, mientras la camara cabeceaba cada 1,736 m y las piernas apoyaban
cada 1,309 m. Ahora dispara cuando `jugador.fasePaso` cruza un multiplo de PI,
que **es** el fotograma del apoyo. Medido en tierra firme, terreno real:

| | sonidos | pasos de fase | m por sonido | `zancada` |
|---|---|---|---|---|
| caminando | 15 | 13,98 | 1,13 | 1,21 |
| corriendo | 20 | 19,34 | 1,55 | 1,60 |
| agachado | 14 | 12,58 | 0,56 | 0,62 |

El sonido va uno por delante de la fase a proposito: al arrancar a caminar se
oye el primer paso en el acto en vez de esperar al siguiente cruce. El timbre
sale correcto solo: `tierra` caminando y corriendo, `suave` agachado.

## 5. `Peces.js` - el archivo que nunca se habia abierto

Los cardumenes giraban alrededor de un punto **fijo para siempre**: parado en la
orilla se veia el mismo carrusel repetirse, y acercarse no cambiaba nada.

- El centro ahora deriva con un paseo al azar y se dobla contra la orilla en vez
  de encallar. El cardumen guarda su **profundidad**, no su cota, asi que al
  cambiar de sitio recalcula contra la superficie de ahi: no termina volando
  sobre el agua ni enterrado.
- A menos de 9 m el cardumen registra al jugador, se cierra -los peces se
  juntan, no se desbandan- y se va derecho para el lado contrario.
- La fase orbital paso de `t * vel` a un `c.giro` integrado. **Era necesario:**
  si la velocidad cuelga de `t`, cambiarla mueve el angulo de golpe y el
  cardumen entero se teletransporta.

Verificado con 14 cardumenes y 101 peces en el lago: los 14 se mueven, **14 de
14 siguen en agua**, **14 de 14 con cota coherente**, y al pararse encima la
distancia al jugador **crece**. Cuesta 14 vueltas por cuadro y ninguna consulta
de vecinos, que es justo lo que se descarto al decidir no hacer boids.

## 6. Trampas de medicion pagadas aca

- **El panel del navegador corre a ~1 cuadro por segundo** en este entorno. Con
  eso `peces.actualizar` recibe 5 llamadas en 4,6 s reales y acumula 0,23 s de
  `dt`: las magnitudes parecen ridiculas y el mecanismo esta bien. Antes de
  llamar defecto a un numero chico, medir el `dt` que de verdad llega.
- **El silencio de Opciones se activo solo a mitad de una corrida** y `voz()`
  devolvia `false` sin decir por que. Comprobar `audio.silenciado` antes de
  creerle a un `false`.
- **Una recarga de Vite tira el contexto de audio** y `listo` vuelve a `false`,
  con lo que `pasos()` corta en la primera guarda y no suena nada. Hace falta un
  gesto real -un clic en el lienzo- despues de cada recarga.
- **El jugador teleportado a la orilla se mete al agua**, y nadando no hay
  pasos. Es correcto, pero da un cero que parece defecto. Probar en tierra firme.

## 7. Descartado

- **Duplicar el filtro de habitat dentro de `Audio.js`** para decidir que
  especie canta. `Fauna._aptitud()` ya resuelve bioma, altitud, estacion y
  distancia al agua contra el dataset; reimplementarlo en el audio seria logica
  duplicada que tarde o temprano contradice el JSON verificado.
- **Poner los parametros de sintesis dentro de `fauna.json`.** Frecuencias y Q
  son numeros de audio, no datos naturales.
- **Boids completos en `Peces.js`.** Con hasta 22 peces por cardumen y 14
  cardumenes, las consultas de vecinos son O(n^2) por cuadro para una diferencia
  minima a la distancia a la que se ven los peces bajo el agua.

## 8. Siguiente

- **Nada bloqueante. `vida` queda cerrado.**
- Queda sin medir el costo en cuadro de las voces sobre la HD 4000 real, que es
  parte del pendiente general de "medir Baja contra Baja".
- El coro no distingue especies ya oidas: un chucao puede cantar tres veces
  seguidas si el sorteo lo elige. Hay enfriamiento por individuo (14 s) pero no
  por especie.

---

# ⇐ Traspaso de `feel` — 2/9/2026

`feel` cerró y dejó **una sola zancada** para todo el juego. `Audio.js` es el
único que sigue con reloj propio, y es tuyo.

## Lo que cambió afuera

`Jugador` expone dos cosas nuevas:

- **`jugador.fasePaso`** — fase del paso en radianes. Avanza **PI por paso**, o
  sea 2·PI por ciclo de las dos piernas. Cruzar un múltiplo de PI **es** el
  momento en que el pie toca el suelo.
- **`jugador.zancada`** — largo del paso en metros. 0,95 parado, 1,21 caminando,
  1,60 corriendo, 0,62 agachado. Ya no es un par de constantes.

La cámara y `Cuerpo.js` ya cuelgan de ahí: los dos dan 1,210 m por paso
caminando. El sonido sigue en 0,85, así que **el ruido del pie llega en un
momento y la pierna apoya en otro** — es el último de los tres relojes que
estaban desincronizados.

## Qué tocar

`src/engine/Audio.js`, líneas 554-561:

```js
  pasos(dt, jugador) {
    ...
    if (!jugador.enSuelo || vel < 0.6) { this._pasoAcum = 0.55; return; }
    // Un paso cada 0,85 m de zancada, algo más largo si corre
    const zancada = jugador.corriendo ? 1.25 : 0.85;      // ← acá
    if (this._pasoAcum < zancada) return;
```

Lo mínimo es `jugador.zancada ?? (jugador.corriendo ? 1.25 : 0.85)` — el `??`
conserva el respaldo por si el sonido corre sin jugador. Lo correcto de verdad
es disparar el paso cuando `fasePaso` cruza un múltiplo de PI, y así el sonido
cae **exactamente** en el fotograma en que el pie apoya, en vez de acumular
distancia por su cuenta y derivar.

## Y una buena noticia sobre tu defecto de los pasos que desaparecían

`Audio.pasos` arranca con `if (!jugador.enSuelo) return`, y estaba anotado que
cuesta arriba los pasos se dejaban de oír. **La causa no era tuya y ya está
arreglada**, por dos lados:

- el escalón de `_resolverTerreno` levantaba al cuerpo en cualquier cuesta
  arriba y apagaba `enSuelo`;
- bajando, el terreno caía más rápido que la gravedad y el cuerpo salía
  despedido: medido en el cerro real, **112 cuadros de 150 en el aire**.

Ahora son **0 de 180** caminando y corriendo, en los cuatro rumbos. Tu guarda de
`enSuelo` es correcta y podés dejarla como está: ya no miente.
