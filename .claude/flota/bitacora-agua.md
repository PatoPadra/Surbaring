# Bitácora — agente **agua** (`src/world/Agua.js`, `src/world/Terreno.js`)

Estado: **terminado y verificado**. Sin commitear, como corresponde.

---

## 0. DOS TRAMPAS QUE COSTARON CARO — leer antes que nada

### (A) `window.capturar` sobre un lago se hunde hasta el fondo

`capturar()` corre **90 pasos de física** por omisión (`pasos ?? 90`, 1,5 s) antes
de dibujar. Sobre agua el jugador **se hunde**: se pide altura 15 sobre una
superficie de 768,9 m y la captura sale desde el lecho.

| `pasos` | altitud pedida | altitud real |
|---|---|---|
| 90 (por omisión) | 783,9 | **762** ← siete metros bajo el agua |
| 0 | 783,9 | **784** ✓ |

Perdí una tanda entera de capturas por esto. El síntoma engañaba: un gris pardo
liso ocupando media pantalla (el lecho del lago), una banda moteada arriba (la
superficie vista desde abajo), y "el lago negro" de `agua-antes-cerca.png`, que
era simplemente estar sumergido. **Toda captura sobre agua lleva `pasos: 0`.**

### (B) Una comilla invertida en un comentario GLSL tumba el juego entero

Los shaders viven en literales de plantilla. Una comilla invertida dentro de un
comentario GLSL **cierra el literal** y el resto se lee como JavaScript. No da
error de shader: da `SyntaxError` y **la aplicación no carga**. Me pasó en
`Agua.js` y después a `luz` en `Cielo.js`, dejando a los tres agentes sin poder
verificar nada. Comprobación barata, sin navegador:

```sh
node --input-type=module -e "await import('./src/world/Agua.js'); console.log('OK')"
grep -n '`' src/world/Agua.js     # sólo deben quedar las de FUERA de VERT/FRAG
```

### Herramienta de medición de píxeles

El navegador **no puede leer `/capturas/`** (fuera de la raíz que sirve Vite).
Se mide decodificando el PNG en Node con un lector propio sin dependencias:
`<scratchpad>/pix.mjs` (`leerPNG`, `region` → rgb media y desvío de luminancia).
Son ~60 líneas: IHDR + IDAT + `zlib.inflateSync` + desfiltrado de scanlines.

---

## 1. Diagnóstico (todo medido, nada supuesto)

**El lago era plástico celeste por cuatro causas independientes:**

**(a) El cenit reflejado era un azul inventado.** Se armaba como
`colorNiebla * (0.55, 0.72, 1.00)`: baja el rojo a la mitad y deja el azul
intacto. Medido sobre `base-alta-manana.png`: cielo cenit **rgb(102,133,117)**
(verde, G > B) y lago debajo **rgb(31,76,111)** (B/R = 3,6). El agua devolvía un
color que no existía en ninguna parte de la escena.

**(b) El espejo planar está APAGADO en la placa de destino.** `Calidad.js` pone
`reflejoAgua: 0` en `baja` y `mínima`; esta máquina corre `baja`. Verificado en
vivo: `uReflejo.value === null`. **El jugador de la HD 4000 nunca ve el espejo**,
sólo el camino procedural, que era el que estaba sin trabajar.

**(c) El agua profunda vista desde arriba era negra**: no había ningún término de
dispersión de volumen, así que pasados 14 m de fondo la refracción era la
constante `colorHondo` y nada más.

**(d) A la distancia no quedaba NINGUNA estructura.** La normal se aplana pasados
~1200 m —arreglo correcto que hay que conservar— y el lóbulo especular era
`pow(dot(R,sol), 420)`, un círculo subpíxel. Sin pendiente y sin lóbulo ancho no
hay reguero de sol: el agua lejana era papel pintado.

**(e) Añadido después, defecto que encontró `luz`:** a las 20:40 los lagos del
fondo tomaban el rosa del poniente y el de adelante seguía celeste de mediodía.
El lejano se ve rasante (manda el reflejo, que sigue al cielo); el cercano se ve
empinado (manda la refracción, que era **constante**).

**Los churretes del terreno** eran moiré, no teselado: `relieveFino` lee el
mosaico con período 13,4 m sobre 256 texels **sin mipmaps** = 5,2 cm por texel, y
iba multiplicado por `cercania`, que en el preset bajo llega a **147 m**. Cien
metros de ladera resolviendo una textura de 5 cm por texel, sin mipmap que
promedie. Alimenta `parche`, que elige entre `mataOscura` y `pastoClaro`, así que
el patrón entraba con 56 % de contraste.

**El suelo liso de cerca**: en preset `baja` (`detalleTerreno = 0.35`) la gravilla
de 12 cm muere a **5,6 m** y el moteado del albedo entraba con amplitud ±10 %. El
ruido se pagaba y no se usaba.

---

## 2. Qué quedó cambiado

### `src/world/Agua.js`

1. **Cenit** = `colorNiebla * (0.48, 0.52, 0.58)` en vez de `(0.55, 0.72, 1.00)`:
   mismo cielo, más oscuro y apenas más frío. Sesgo al azul de 1,8 → 1,2.
2. **Curva del domo** `pow(alturaR, 0.55)` → `1.15`: manda el horizonte, que es el
   color de niebla y sí integra con la escena.
3. **Silueta reflejada del cerro, sacada del DEM con UNA muestra**: se avanza el
   rayo reflejado 1200 m y se pregunta si el terreno está por encima de la altura
   a la que llegó. Donde tapa, ladera en sombra; donde se escapa, cielo. Es el
   reemplazo barato del espejo planar apagado. *Primer intento: oscurecer con una
   constante. Salió mal —el lago pasó de lámina celeste a lámina gris, el mismo
   defecto con otro color— y por eso la silueta sale del relieve.*
4. **Dispersión de volumen** que satura con el camino óptico: el agua profunda
   deja de ser negra sin tocar la orilla.
5. **Refracción tratada como ALBEDO × luz** (tinte normalizado por su brillo, para
   que aporte color y no exposición; nivel colgado de `uFactorDia` y **no** de
   `colorNiebla`, que `luz` dejó llegar a ~1,28 y no conviene atarse a esa
   escala). Arregla (e).
6. **Lóbulo especular que se ensancha con la distancia**: `mix(34, 420, nitidez)`
   con la intensidad compensada. La ola lejana no se resuelve pero su pendiente
   existe; ensanchar el lóbulo es ese fenómeno en estadística.
7. **Banda de aplanado de la normal 80–1200 m → 60–420 m.** Con el lóbulo ancho,
   la franja de normal ruidosa y subpíxel se llenó de destellos: el medio campo
   quedaba como papel de aluminio. Achicarla lo apaga **y ahorra**.
8. **Alfa mínimo 0,62 → 0,18** en los primeros centímetros: la orilla deja de ser
   un canto duro.

### `src/world/Terreno.js`

1. **`relieveFino` con puerta propia y corta** (6–34 m en vez de `cercania`, que
   llegaba a 147 m en bajo y 420 en alto) **y decorrelacionado** con una segunda
   lectura de ejes cambiados, período 0,77× y corrimiento, que **modula** en vez
   de sumarse — la misma idea que ya rompió la grilla del valle.
2. **El grano de 40 cm (`micro`), ya calculado, entra también en el moteado del
   albedo**: extiende el grano de 5,6 m a 15,8 m sin una sola evaluación nueva.
3. **Amplitud del moteado ±10 % → ±18 %** (`0.90+0.20·m` → `0.82+0.36·m`). Neutro
   a la distancia por construcción: con `m = 0.5` da 1,0 exacto.

Respetada la disciplina del arreglo de 377 → 1,7 ms: **cada escala sigue dentro
del `if` de su factor de desvanecimiento**, y la gravilla sigue **fuera** del
campo `detalle`.

---

## 3. Verificación

Punto de orilla hallado por sondeo: **lat −41,0325 lon −71,4928** (cota 769,
Nahuel Huapi, agua en 19 de 24 rumbos). Punto sobre el agua: **−41,0335 / −71,4915**
(superficie 768,9, lecho 733,2 → 35,7 m de fondo).

| captura | qué muestra |
|---|---|
| `agua-fin-espejo.png` | rasante sobre el lago a las 13 h: olas, reguero, gradiente |
| `agua-fin-crepusculo.png` | 20:40 — agua cercana oscura y lejana tomando el poniente |
| `agua-fin-espejo2.png` | control de mediodía tras el cambio de color |
| `agua-fin-suelo.png` | suelo a ras: grano fino, sin churretes |
| `agua-fin-aerea.png` | aérea a 1400 m: moteado orgánico, **sin damero** |
| `agua-fin-reguero.png` / `agua-fin-arriba.png` | especular y absorción |

Medido con el lector de PNG:

| región | 13 h antes del cambio (e) | 13 h después | 20:40 | cielo 20:40 |
|---|---|---|---|---|
| agua cerca | rgb(42,107,132) lum 95,1 | rgb(46,110,135) lum 98,2 | **rgb(4,15,27) lum 13,2** | — |
| agua lejos | rgb(195,205,197) lum 202 | rgb(192,201,194) lum 199 | **rgb(49,48,65) lum 49,1** | rgb(68,53,62) lum 56,7 |

O sea: **el mediodía no se movió** (+3 %, dentro del ruido) y el agua cercana
ahora **sí** responde a la hora — de cian saturado a azul oscuro—, mientras la
lejana sigue al cielo. El defecto (e) está cerrado.

---

## 4. Costo — medido con el reloj de GPU, preset **Alta** forzado

`bancoValidez()` dictaminó "EL INSTRUMENTO MIENTE", pero es la **falsa alarma que
`CONTEXTO.md` anticipa**: la muestra de 2560×1440 faltaba por corte, no por el
reloj. Las tres que completaron son estrictamente crecientes —52,46 / 84,05 /
127,96 ms sobre 0,23 / 0,92 / 2,07 Mpx—, o sea que el instrumento mide.

| resolución | línea de base (árbol limpio) | ahora | delta |
|---|---|---|---|
| 640×360 | 57,1 ms | **52,12 / 52,44** | **−4,8 ms** |
| 1280×720 | 88,3 ms | **83,17 / 82,88** | **−5,3 ms** |

Dos corridas por resolución, dispersión ~0,3 ms: el delta está muy fuera del
ruido. **El cuadro quedó ~5 ms más rápido que la línea de base**, no más lento.

Terreno solo, apagando la malla con calentamiento descartado, 1280×720 Alta:
con = 82,80 / 83,21, sin = 58,81 / 58,19 → **24,5 ms**. Ese número **no** es
comparable con el "1,7 ms" del informe previo, que era preset **Baja** (0,8 de
escala, `detalleTerreno` 0,35): acá hay ~4× los píxeles y ~3× el radio de detalle.

---

## 5. Lo que quedó sin cerrar, y por qué

- **No pude aislar mi parte de los −5 ms.** `luz` y `veg` editaban en paralelo, así
  que el delta total es de los tres. Intenté el A/B honesto (`git stash` de
  `Terreno.js`, medir, restaurar) y la recarga en caliente de otro agente me
  volteó la medición dos veces; restauré el stash antes de arriesgarlo más. Lo que
  sí sostengo por mecanismo: mi cambio de terreno **saca** una lectura de textura
  de la enorme mayoría de los píxeles y **agrega** una sólo dentro de 34 m, y el
  de agua saltea nueve evaluaciones de ruido en toda la franja de 420 a 1200 m.
  Ambos son netos negativos.
- **La transición agua-costa** quedó a medias: bajé el alfa de la orilla, pero no
  llegué a agregar piedra mojada ni a verificar la línea de espuma con una captura
  dedicada. El punto de orilla que encontré mira a pasto, no a agua; haría falta
  buscar uno con la costa en el encuadre.
- **`bancoDesglose()`** no llegó a completar ninguna vez (recargas ajenas).

---

# Cerrado por el coordinador — 2/9/2026

Con la flota terminada ya no hay recargas ajenas, así que las dos mediciones que
no habías podido completar salieron a la primera.

## `bancoDesglose()` completó, y confirma tu deducción

Preset **Baja**, 1024×576, punto bosque. Cuadro completo 31,1 ms:

| Pieza | ms | % |
|---|---|---|
| Terreno | 11,0 | 35 % |
| Árboles | 6,8 | 22 % |
| Sombras | 2,9 | 9 % |
| **Agua** | **1,4** | **4,5 %** |
| Sotobosque | 1,4 | 4,5 % |
| Cielo | 1,3 | 4 % |
| Posproceso | 0,9 | 3 % |
| **Reflejo** | **0,0** | **0 %** |

**El reflejo planar cuesta exactamente cero en Baja**, que es lo que habías
deducido leyendo `Calidad.js` y no habías podido medir. Queda medido: el jugador
de la placa de destino nunca ve el espejo, sólo el camino procedural — o sea que
todo tu trabajo fue al camino que efectivamente se usa.

Y tu agua entera cuesta **1,4 ms de 31,1**, el 4,5 % del cuadro.

## Lo de los −5 ms: la pregunta cambió, y la respuesta es mejor

No se pudo aislar tu parte, y ya no hace falta. Lo que importaba era si la flota
había agregado costo. Medido contra la línea de base registrada, preset Alta:

| Resolución | antes | después | |
|---|---|---|---|
| 640×360 | 57,1 ms | 49,21 ms | **−13,8 %** |
| 1280×720 | 88,3 ms | 77,84 ms | **−11,8 %** |

## La transición agua-costa: el mecanismo, verificado

Tu código estaba completo; faltaba comprobarlo. Evaluadas las mismas fórmulas
del fragment sobre un barrido de profundidad:

| profundidad | alfa final | fondo mojado visible |
|---|---|---|
| 0,00 m | 0,965 (manda la espuma) | 4 % |
| 0,10 m | 0,876 | 12 % |
| 0,35 m | 0,516 | 48 % |
| **0,50 m** | **0,332** | **67 %** |
| 1,20 m | 0,776 | 22 % |
| 1,80 m | 0,985 | 2 % |

La orilla no es un canto duro: son **tres bandas**. Espuma blanca pegada al
borde, una franja transparente a medio metro donde se ve el lecho mojado que
`Terreno.js` ya oscurece, y el agua cerrándose a 1,8 m. Que el máximo de
transparencia esté a 0,5 m y no en el borde es correcto: en el borde la espuma
tapa.

**Lo único que queda sin hacer** es la confirmación visual con una captura
dedicada de la línea de espuma. El panel del navegador no compone un cuadro
utilizable —a 238×594 no se distingue agua de tierra en los píxeles—, así que
esto queda para una mirada del dueño en el juego, no para una medición.

La «piedra mojada» que te habías anotado no hace falta como pieza aparte:
`Terreno.js:613` ya oscurece el lecho húmedo, y bajar el alfa es exactamente lo
que la deja ver.
