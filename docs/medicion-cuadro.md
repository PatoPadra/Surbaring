# Medición del cuadro — línea de base

Placa: **Intel HD Graphics 4000 (2012)**, que es la de destino real.
Instrumento: `EXT_disjoint_timer_query_webgl2`, el reloj de la GPU.

## Por qué no sirve medir con performance.now()

El primer intento usó el reloj de la CPU con `gl.finish()` para forzar la
sincronización, y dio **374 fps** dibujando 1,8 millones de triángulos en una
HD 4000. La prueba de validez lo desmintió: subiendo la resolución de 640×360 a
2560×1440 —dieciséis veces más píxeles— el tiempo medido **bajó** de 2,64 a
2,08 ms. Con el panel del navegador oculto `finish()` no bloquea: se estaba
midiendo el encolado de llamadas, no el trabajo de la placa.

Regla que queda: **antes de usar un número, comprobar que el instrumento
reacciona a lo que dice medir.** `window.bancoValidez()` hace exactamente eso.

## Curva de resolución (bosque, mediodía de febrero)

| Resolución | Mpx | ms GPU | fps |
|---|---|---|---|
| 640×360 | 0,23 | 81,5 | 12,3 |
| 1280×720 | 0,92 | 156,8 | 6,4 |
| 1920×1080 | 2,07 | 253,6 | 3,9 |
| 2560×1440 | 3,69 | 370,7 | 2,7 |

Recta ajustada: **≈62 ms fijos + ≈84 ms por megapíxel.**

La mitad del cuadro no depende de la resolución. Eso importa para la estrategia:
bajar la resolución interna —que es la palanca que usa `Calidad`— no puede
llevar el juego más allá de unos 16 fps por más que se dibuje diminuto.

## Desglose por pieza (1024×576, la resolución interna del preset «Baja»)

Total del cuadro: **122,8 ms = 8,1 fps**

| Pieza | ms | % del cuadro |
|---|---|---|
| Terreno | 48,6 | 40 % |
| Sotobosque | 45,0 | 37 % |
| Árboles | 19,5 | 16 % |
| Sombras | 11,6 | 9 % |
| Cielo | 4,3 | 3,5 % |
| Agua | 1,2 | 1 % |
| Posproceso | 0,7 | 0,6 % |
| Reflejo del lago | 0 | apagado en este preset |
| Fauna | 0 | 0 % |

Los porcentajes suman más de 100 porque sacar una pieza cambia el sobredibujo de
las otras. El orden, en cambio, es firme.

**Terreno y sotobosque son el 77 % del cuadro.** El agua, el reflejo y el
posproceso juntos son el 1,6 %: cualquier optimización ahí es irrelevante para
los fps, por más que el diagnóstico de código la señale como desperdicio.

## Resultado de la primera ronda

| Pieza | Antes | Después | Δ |
|---|---|---|---|
| **Cuadro completo** | **122,8 ms (8,1 fps)** | **88,6 ms (11,3 fps)** | **−28 %** |
| Terreno | 48,6 | 33,6 | −15,0 |
| Sotobosque | 45,0 | 31,8 | −13,2 |
| Árboles | 19,5 | 16,6 | −2,9 |
| Sombras | 11,6 | 12,1 | +0,5 |
| Cielo | 4,3 | 1,8 | −2,5 |

De dónde salió cada cosa:

- **Puertas por eje en `fbmTri`** — el ruido triplanar evaluaba los tres ejes
  siempre, y `pow(w, 4)` deja casi todo el peso en uno solo: en suelo llano seis
  de cada nueve octavas se multiplicaban por cero. Es el cambio más grande.
- **Puerta de distancia en el `grano`** — sus tres hermanos ya la tenían.
- **El cielo dibujándose último** en vez de primero, para que la prueba de
  profundidad temprana descarte lo que la geometría ya tapó.
- **Lambert en follaje y sotobosque** — con rugosidad 0,88 el lóbulo especular
  de GGX no aporta un píxel que se distinga, y se pagaba el BRDF completo.
- **`FrontSide` en piedras y troncos** del sotobosque, que son sólidos cerrados.

## Un resultado negativo que vale la pena dejar escrito

Cambiar el filtro de sombra de `PCFSoftShadowMap` (16 muestreos) a
`PCFShadowMap` (9) **no cambió nada**: 12,3 → 12,1 ms, dentro del ruido. El
diagnóstico que lo proponía estimaba 1,5–3,5 ms de ahorro, y estaba mal
atribuido: midiendo con `castShadow = false` por objeto resultó que de los 12 ms,
3,6 son el terreno proyectando y 2,5 los árboles proyectando. O sea que el costo
está en **generar** los mapas de las cuatro cascadas, no en leerlos. El eje de
preset quedó igual porque es correcto tenerlo, pero no es donde estaba la plata.

## El banco

`public/banco.js` es la herramienta, y es deliberadamente de desarrollo:
`window.banco()` mide un cuadro, `window.bancoDesglose()` apaga una pieza por vez
para tarifarlas, y `window.bancoValidez()` comprueba que el instrumento no esté
mintiendo. Encola todas las consultas de GPU y las cobra juntas: esperar una por
una en una pestaña oculta tarda un segundo por consulta, porque el navegador
limita los temporizadores de las pestañas que nadie mira.

## Segunda ronda: los dos ejes de sombra que faltaban

| Pieza | Base | Ronda 1 | Ronda 2 |
|---|---|---|---|
| **Cuadro** | **122,8 ms (8,1 fps)** | 88,6 (11,3) | **69,2 ms (14,5 fps)** |
| Terreno | 48,6 | 33,6 | 28,3 |
| Sotobosque | 45,0 | 31,8 | 15,7 |
| Árboles | 19,5 | 16,6 | 16,5 |
| Sombras | 11,6 | 12,1 | 6,4 |
| Cielo | 4,3 | 1,8 | 1,5 |

**−44 % de tiempo de cuadro y +79 % de fps** respecto de la línea de base.

Los dos cambios de esta ronda salieron de medir con `castShadow` y
`receiveShadow` por objeto, no de leer código:

- **Que la cubierta de suelo reciba sombra costaba 14,7 ms**, el 16 % del cuadro.
  Son casi quince mil instancias con recorte por alfa, y cada fragmento paga la
  búsqueda en las cuatro cascadas. Apagarlo en los presets bajos no borra la
  sombra del suelo —el terreno la sigue recibiendo, así que la mancha del árbol
  se ve igual—; lo único que se pierde es que cada brizna se oscurezca aparte.
- **Que el terreno proyecte costaba 7,7 ms.** En los presets bajos el alcance de
  la sombra es de 320 m, o sea que la sombra de un cerro sobre el valle nunca
  llega a verse: se pagaba por algo fuera de alcance.

### Otro intento que no dio nada

Recortar las instancias de vegetación durante el pase de sombra: cero. El bosque
cercano tiene 103 árboles de malla completa y todos caen dentro del alcance; el
resto son carteleras, que ya no proyectaban sombra. El diagnóstico suponía miles
de árboles dibujándose cuatro veces y no era así. El gancho quedó puesto porque
es correcto y porque en los presets altos, con más alcance y más densidad, sí va
a cortar.

### La curva de resolución, otra vez

| Resolución | Mpx | antes | después |
|---|---|---|---|
| 640×360 | 0,23 | 81,5 | 61,6 |
| 1280×720 | 0,92 | 156,8 | 117,2 |
| 1920×1080 | 2,07 | 253,6 | 183,2 |
| 2560×1440 | 3,69 | 370,7 | 262,5 |

La recta pasó de **62 ms fijos + 84 por megapíxel** a **48 + 58**. El costo fijo
es ahora la mayoría del cuadro, y eso dice dónde buscar lo que queda: geometría
y llamadas de dibujo, no trabajo por píxel.
