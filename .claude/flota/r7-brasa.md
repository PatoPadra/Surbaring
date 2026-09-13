# Bitácora `brasa` — ronda 7, fase 2

> Contrato: `RONDA7.md`, sección 6 y «FASE 2 · `brasa`» (B1 a B7), más el encargo
> del jefe. Bancos: `banco-r7-fase2.mjs` y `.navegador.js`, del jefe, sin tocar.
> Escribo sólo `src/world/Hornos.js` y la tabla `LLAMAS` de `src/engine/Luces.js`.

## Lo leído antes de tocar nada (12/9)

- `RONDA7.md` §6 y fase 2; `RONDA5.md` fase 1 `lumbre` y su cierre: el conjunto de
  luces es fijo desde la carga, el bloque Lambert con caída `(1 − d²/r²)²` va en
  `lights_fragment_begin`, y construir con una luz de three congelaba 19 s.
- Banco Node contra la base: **ROJO 1/2** — «la fogata prendida tiene algo visible
  que brilla» [0], horno_barro [0 → 0], fragua [0 → 0]. `LLAMAS` verde. Lo esperado.
- La cadena (`main.js:543-575`): RenderPass → PasoOclusion → UnrealBloom (0,34 ·
  0,62 · umbral 0,86 sobre la luminancia HDR con pesos 0,299/0,587/0,114, **pasa el
  texel entero**, no el exceso) → OutputPass (ACES de three + sRGB) → FXAA →
  PasoColor (nitidez 0,30, techo 0,94, curva 0,30, sombras/luces, saturación 1,12,
  viñeteado 0,34).
- **La exposición de noche no es 0,78: es 1,1345.** `main.js:849` pone
  `toneMappingExposure = est.exposicion`, y `Tiempo._exposicion` devuelve
  `diurna · (0,78 + 0,22·día)` con `diurna = 2,24/(1,54 + max(0, sen h))` = 1,4545
  de noche. El 0,78 es el factor; la exposición es 1,4545 · 0,78 · (1 − 0,1·nubes).
  Al mediodía del 15/2 (sol a ~51,6°): 2,24/(1,54 + 0,784) = 0,964.
- three 0.169: `receiveShadow` es un uniforme (no entra en la clave); `emissive`
  tampoco; `transparent`/`blending` sí (`opaque`), `side` sí.

## Hallazgo 1 · un material compartido entre hornos compila en la SEGUNDA fogata

`dibujarHorno` (`main.js:417-420`) pasa **cada malla del nodo** por `conCSM` en
cada construcción. `conCSM` (`main.js:1007`) envuelve `onBeforeCompile` y reescribe
`customProgramCacheKey` leyendo la clave anterior. Con un material por horno (las
piedras de hoy) pasa una sola vez. **Con el material de la llama compartido, pasa
una vez por horno, y la clave crece**: réplica en Node con three de verdad
(`.tmp-brasa-conCSM.mjs`):

```
piedra == llama tras 1 pasada: true
llama tras 2 pasadas == tras 1: false | largo 188 → 326
```

O sea: la primera fogata comparte programa con las piedras, **la segunda compila
uno nuevo** — B2 rojo en p3, y es exactamente el paso que el banco mide. El arreglo
de verdad es que `conCSM` sea idempotente (va a pendiente); el mío, dentro de
`Hornos.js`, es que el material compartido acepte el envoltorio una sola vez.

## El modelo de la cadena (B3/B4) — `r7-brasa-cadena.mjs`

No puedo medir la imagen, así que la cadena está copiada en números, eslabón por
eslabón, del código de verdad: bloque Lambert → ACES de three 0.169 (con las
matrices leídas por filas) → sRGB → `PasoColor` (techo, curva, sombras/luces,
saturación, viñeteado) → luminancia 709 sobre 0..255. Sin nitidez ni FXAA (no
mueven un promedio de 16 anillos) y sin resplandor en los anillos (ver la llama).

**Calibración.** El factor geométrico del suelo real a cada distancia (pasto,
coseno, albedo, oclusión) es una incógnita y se despeja de la base: la radiancia
que, sumada al fondo de la noche, da lo medido. Después se cambia sólo lo que
cambio yo (intensidad, radio, color) y se vuelve a pasar por la cadena. Base:
2 y 3 m de la corrida del encargo (+5,46 · +5,23), 1/5/8/12 m de la tabla de §6.

**El fondo de la noche** sale 0 de 255 pero no se sabe en radiancia, y ahí está
el pie de ACES: `RRTAndODTFit` es negativo por debajo de v = 0,00325 (ya
multiplicado por exposición/0,6), así que hay una zona muerta. Tres supuestos:
β = 0 (el fuego atraviesa todo el pie), 0,35, 0,95 (el suelo al borde).

**Validación con un dato que no se usó para calibrar: el mediodía de la base.**
Calibrado de noche, el modelo predice que la fogata de hoy al mediodía suma a 2 m:
β 0 → +6,49 · β 0,5 → +5,59 · β 0,95 → +5,06 (albedo pasto: +6,56 · +5,61 ·
+5,11). **Medido: +5,86.** Cae adentro, cerca de β ≈ 0,35. Las nubes (factor
1 − 0,1·n) dan predicciones idénticas: la calibración las absorbe.

**El error que el modelo de un solo valor no ve: el anillo promedia briznas
encendidas y suelo casi negro.** Con la radiancia repartida lognormal alrededor
de la calibrada, la predicción baja: fogata 20 · 0xff8c3a... (ver abajo) — con
16 · 0xff8c3a a 2 m: σ 0 → 47,3 · σ 1,0 → 41,0 · σ 1,4 → 35,8 (β 0,35), y en el
peor rincón (β 0,95, σ 1,4) **33,5, debajo del piso**. Por eso no me quedo con 16.

**Barrido** (mín–máx sobre los supuestos de fondo y albedo, un solo valor):

| fogata | 1 m | 2 m | 3 m | 8 m | mediodía sin cablear |
|---|---|---|---|---|---|
| 0xff7a2e · 16 | 28–36 | 35,5–44 | 34–43 | 15–22 | 28–36 |
| 0xff7a2e · 20 | 34–45 | 44–54,5 | 42–53 | 18,5–28 | 34–44 |
| 0xff8c3a · 16 | 33–44 | 42–53 | 41–51,5 | 17,6–27 | 33–42 |
| **0xff8c3a · 20** | 41–54 | **52–65** | 50–63 | 22–34 | 40–51 |

Con intensidad de día 1,0 el mediodía da **+2,3 a +3,0** con cualquiera de ellas.
El color un poco más amarillo (0xff8c3a ≈ 2100 K, sigue siendo leña) rinde ~20 %
más luminancia por la misma energía: el verde pesa 0,7152 en la luminancia y
0xff7a2e tiene G lineal 0,195 contra 0,262.

| antorcha 0xff8a3a | 1 m | 2 m | 3 m | 5 m | 8 m | 2 m con la corrida del encargo |
|---|---|---|---|---|---|---|
| 12 | 19–28 | 26–35 | 26–35 | 24–33 | 7–16 | 33–43 |
| **14** | 22–33 | **30,5–41** | 30,5–41 | 27,5–38 | 8–19 | 39–50 |

## B5 · el triángulo amarillo — confirmado: es la llama del modelo de la antorcha

**Por el código.** `Herramientas3D.js:66`, `PALETA.llama` = albedo 0xffa14a,
emisivo 0xff7a22 × 1,5. `construirHerramienta` (`:441-452`) crea la malla de la
llama siempre, y `Cuerpo._colgar` cuelga el modelo cada vez que cambia `enMano`,
que `juntarLuces` (`main.js:752`) pone con `equipo.enRanura('mano')?.id` **esté
prendida o no**. Nada apaga el emisivo ni esconde esa malla: **una antorcha
guardada y apagada muestra la llama igual**. `util/captura.js:57` pone primera
persona salvo que se pida la tercera.

**Por la cuenta** (`r7-brasa-cadena.mjs`, en el centro del triángulo):

| | RGB | lum |
|---|---|---|
| medido en la captura (mediana de 7655 px) | 241 · 171 · 50 | 178 |
| emisivo de la llama de la antorcha, solo | 244 · 177 · 53 | 182 |
| ídem + la fogata sobre su albedo (cota alta) | 243 · 188 · 68 | 191 |
| hoja de pasto BLANCA (albedo 1, imposible) de frente a 4,5 m de la fogata | 230 · 110 · 21 | 129 |
| hoja verde (albedo 0,5 · 1 · 0,3) ídem | 178 · 102 · 0 | 111 |

Una hoja iluminada por un fuego naranja no llega al verde de 171 ni con albedo 1:
la luz trae G/R = 0,195. El emisivo solo lo clava a 4 de 255.

**Por el tamaño.** El ápice está a 35,0° a la derecha; con la mano a 0,30 m del
eje, la profundidad es 0,43 m, y ahí la base del cono (7,8 cm) mide 87 px. En la
captura, ~90.

Plano y sin sombreado porque el emisivo manda. No es luz del fuego: el arreglo va
en `Herramientas3D`/`Cuerpo`/`main.js`, que no son míos → pendiente, parche 3.

## Hecho (12/9)

**`src/world/Hornos.js`**
- Tres materiales para todos los hornos (`_materiales`: núcleo 0xffc25e×1,25,
  lengua 0xff8a2a×1,3, brasa 0xff5a1e×1,0): estándar, albedo negro, emisivo. Todos
  por debajo de 0,86 de luminancia de resplandor (el núcleo 0,786): sin halo, que
  desde arriba se le sumaría al suelo del mediodía.
- `envolverUnaVez()`: el material compartido acepta la primera vuelta de `conCSM`
  y las siguientes no le cambian la clave (hallazgo 1).
- Fogata: lecho de brasa (dodecaedro achatado, 36 tri), núcleo alto (torno de 7
  lados, 84 tri) y dos lenguas bajas inclinadas → **4 mallas, 288 triángulos**.
  Horno de barro y fragua: boca de brasa + núcleo en caja (2 mallas, 24 tri). La
  carbonera: un respiradero arriba (1 malla, 36 tri), aunque no se pedía.
- `actualizar(t)`: `brillo` (luz relativa, con el MISMO latido `sin(7,3t + x)`, que
  es lo que usa `asentar` del banco para caer en la base), `llama` (0,15 por cuadro)
  y `rescoldo` (sube 0,15, baja 0,04: un segundo de brasa después de apagarse).
  `_animar()` mueve escala y giro: dos senos de 9,3 y 15,1 rad/s, se afina al
  estirarse, se mece.
- **Luz: 0xff8c3a, 20 de noche, 1 al sol, 14 m.** `luzDeFuegoSegunSol(senoSol)`
  exportada, con la frontera de `Tiempo._exposicion`; `fuentesDeLuz(senoSol)`
  opcional — **sin dato, noche**.
- **Radio sin cambiar** (14 m): el costo del bloque no se mueve por esto.

**`src/engine/Luces.js`, sólo `LLAMAS`**: antorcha 14, candil 8,4, velas 6,3 (×7).

## Hallazgo 2 · el horno de barro y la fragua ya compilaban en la base

La comprobación de claves con los seis hornos pasados por `conCSM` dio **dos**
claves, no una. La segunda no era de la llama: eran **las piedras del horno de
barro y de la fragua**, que en la base usan UN material para dos mallas del mismo
nodo (`base`+`cuerpo`, `hogar`+`campana`), así que `dibujarHorno` las envolvía dos
veces. El primer horno de barro y la primera fragua compilaban un programa cada
uno — de base, B2 sólo mide fogatas y no lo veía. Arreglado en `Hornos.js` con
`mat.clone()` (el clon se hace antes de envolver). El parche 4 de pendiente lo
arregla de fondo para cualquier nodo.

## Predicciones que entrego (B3, B4) — para comparar con lo que mida el jefe

Modelo: `node .claude/flota/r7-brasa-cadena.mjs --fogata '{"intensidad":20,"intensidadDia":1,"color":16747578}' --antorcha '{"intensidad":14}'`.
Central = β 0,35 (el que reproduce el mediodía de la base: +5,87 contra +5,86
medido), albedo neutro; rango = los seis supuestos de fondo y albedo.

| fogata 20 · 0xff8c3a | 1 m | 2 m | 3 m | 5 m | 8 m | 12 m |
|---|---|---|---|---|---|---|
| base medida | +4,12 | +5,46 | +5,23 | +4,61 | +1,95 | +0,09 |
| **predicción central** | **+47** | **+58** | **+56** | **+51** | **+28** | **+3,9** |
| rango | 41–54 | 52–65 | 50–63 | 45–58 | 22–34 | 1–6 |
| piso/techo del banco | ≤ 200 | ≥ 35 | ≥ 30 | — | ≥ 8 | — |

Con la radiancia repartida en el anillo (σ_ln 1,0 → −13 %; σ_ln 1,4 → −24 %):
peor caso a 2 m ≈ **+40**, a 8 m ≈ +17.

| antorcha 14 | 1 m | 2 m | 3 m | 5 m | 8 m |
|---|---|---|---|---|---|
| base medida (tabla) | +2,29 | +3,38 | +3,38 | +2,97 | +0,79 |
| **predicción central** | **+27** | **+36** | **+36** | **+33** | **+13** |
| rango | 22–33 | 30,5–41 | 30,5–41 | 27,5–38 | 8–19 |
| calibrada con +4,5 del encargo | — | 39–50 | — | — | — |
| piso/techo del banco | ≤ 200 | ≥ 25 | — | ≥ 4 | — |

**B4, mediodía, fogata prendida − apagada a 2 m:**
- con el parche 1 de pendiente (`fuentesDeLuz(cielo.direccionSol.y)`, intensidad 1):
  **+2,6** (rango +2,3 a +3,0) ≤ 6,5.
- **SIN el parche 1: rojo, +40 a +51.** `main.js` llama `fuentesDeLuz()` sin dato y
  eso es la noche. Lo dejo dicho antes de que se mida.
- La llama no suma al mediodía por resplandor: queda debajo del umbral.

**La antorcha al mediodía (el banco no lo mide, pero es «el mediodía no se
enciende»):** con 14 y sin factor de día, **+28,7 a 2 m** (hoy +4,1). Con el
parche 2, +1,6.

**B1, pico desde 6 m:** el núcleo solo da ~226 (218 si la oclusión le come un
quinto); apagada no queda nada que brille, así que el pico es el de la base.
**B6:** la llama son 4 dibujos chicos y opacos por fogata, sin sombra → espero
≤ +0,1 ms; dos luces igual que hoy (radios sin cambiar). No medido.

## Bancos (12/9, con el código final)

- `BANCO_SECCIONES=llama,llamas BANCO_DETALLE=1 node .claude/flota/banco-r7-fase2.mjs`:
  **VERDE 2/2**. La llama: 4 piezas, 288 triángulos, `{min −0,04, max 0,96, ancho
  0,85}`, se mueve, compartida (4 de 4), apagada 0; horno de barro 0 → 2, fragua
  0 → 2; carbonera 1 (nota).
- Corrida completa `node .claude/flota/banco-r7-fase2.mjs`: **VERDE 4/4** — llama,
  llamas, sin regresión (r5-f1 9/9, r6-f1 7/7, r6-f2 8/8, r6-f3 6/6, r7-f1 6/6) y
  `vite build`. Corrida dos veces: antes y después del `clone()` del hallazgo 2.
- `r7-brasa-claves.mjs` (mío, Node): **1 clave** entre las 25 mallas de seis
  hornos pasados por `conCSM`; núcleo = piedra (188 caracteres); el torno mira
  afuera (70 de 70 no degenerados).
- No corrí la mitad navegador: la corre el jefe. Sin el parche 1, B4 da rojo.
- `banco-r7-fase2.falsar.mjs` (del jefe) contra mi código: **lo vio 12/12**, por
  otro motivo 0, no lo vio 0, **no se pudo plantar 0** — `piezas` con `horno` y
  `malla` se conservó a propósito para que los parches lleguen.
