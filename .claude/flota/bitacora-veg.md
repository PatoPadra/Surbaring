# Bitácora — agente `veg` (Vegetacion.js + Sotobosque.js)

Actualizada a medida que avanzo. Si la sesión se corta, esto es lo único que sobrevive.

## 0. Estado del servidor — LEER PRIMERO

**El servidor de `CONTEXTO.md` (5174) estaba caído** cuando llegué (curl daba 000
en 5173/5174/5175/5176). Lo levanté con la herramienta del arnés
`preview_start({name:'survibar'})`, que usa `.claude/launch.json`, y quedó en
**http://localhost:5173/** (no 5174). El puente de capturas de `vite.config.js`
escribe igual en `capturas/`. El coordinador debería avisar a los demás agentes
que el puerto cambió.

## 1. Diagnóstico

### Piedras negras — CONFIRMADO que son `piedra`, descartado que sea normales

**Cómo lo medí.** Pase de identidad: puse `material.color = 0x000000` y
`material.emissive` a un color único por lote, y saqué una captura. Cada lote se
dibuja de su color plano, sin luz. Resultado en `capturas/veg-id-bosque.png`
contra `capturas/veg-antes-bosque.png` (misma vista: lat −41,10 lon −71,55
rumbo 300 altura 1,7 cabeceo −8, 2025-02-15 13:00).

- Los manchones negros salen **blancos** en el pase de identidad → índice 6 del
  arreglo `this.tipos` → **`piedra`**. No son los troncos: los troncos son las
  cosas alargadas oscuras, mucho más escasas.
- **El pase de identidad también descarta el compositor.** Con emisivo las
  piedras salen blancas y brillantes, o sea que ni la oclusión ambiental de
  pantalla ni la corrección de color las están aplastando. El negro se produce
  en la iluminación del material, no después.

**Descartado por medición: las normales están bien.** Script inyectado que
recorre los 80 triángulos de la geometría de `piedra` y compara la normal
guardada contra la normal de la cara deducida del bobinado (`cross(b−a, c−a)`):

| geometría | triángulos | normal coincide con bobinado | anti-paralelas | degeneradas | cara hacia afuera |
|---|---|---|---|---|---|
| `piedra` | 80 | **80** | 0 | 0 | **80** |
| `tronco` | 28 | 28 | 0 | 0 | 26 |
| `michay` | 100 | 100 | 0 | 0 | 63 |

Sol en `(0.254, 0.856, −0.451)`, o sea alto: `dot(N,L)` tiene que dar positivo
en las caras de arriba. **Con normales correctas y sol alto, `FrontSide` no
explica el negro por sí solo.** La pista del README apuntaba ahí y la medición
la desmiente; hay que seguir buscando en el material/shader.

### Hallazgo lateral: la geometría de `piedra` está *desgarrada*

`piedra()` (Sotobosque.js:552) hace `IcosahedronGeometry(radio, 1)` —que es **no
indexada**, 80 triángulos y 240 vértices sueltos— y después escala **cada
vértice por un factor aleatorio propio**:

```js
const f = 0.68 + Math.random() * 0.62;
p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.62, p.getZ(i) * f);
```

Como los vértices de una misma esquina no están compartidos, cada uno se va para
otro lado y **el sólido se abre en 80 placas sueltas**. Por eso las piedras se
ven como un montón de plaquitas poligonales dispersas y no como un canto rodado.
Se ve clarísimo en el pase de identidad. Esto explica **la forma**; falta
confirmar si también explica el negro (un montón de placas sueltas con
`FrontSide` deja ver el hueco interior).

### Pastos con normal cero en la punta — medido

`normCero` por geometría: `coiron` 16 de 128 vértices, `pasto_humedo` 18 de 144,
`coiron_lejos` 7 de 56, `pasto_lejos` 8 de 64. **Es exactamente una por hoja**
(coirón tiene 16 hojas, pasto_humedo 18, etc.).

Causa: en `matoja()` (Sotobosque.js:473) el ancho `an` vale 0 en la punta
(`t = 1`), así que los dos vértices de la punta coinciden y el último triángulo
del quad es degenerado. `computeVertexNormals()` le da normal cero al vértice
que sólo toca ese triángulo degenerado. Resultado: la punta de cada hoja se va a
negro en el sombreado. Contribuye al aspecto de "triángulo plano oscuro".

## 1 bis. Experimentos A y B — SÍ salieron, antes del corte

Los dos se completaron y las capturas están en disco. Resultado, que es el que
manda:

| Experimento | `side` | inyección | resultado |
|---|---|---|---|
| línea de base | FrontSide | sí | **negro puro** |
| A — `veg-diag-doubleside.png` | DoubleSide | sí | **se ve**, gris oliva oscuro |
| B — `veg-diag-sinshader.png` | FrontSide | **no** | **blanco brillante**, bien iluminada |

Lo importante es B: **con `FrontSide` y sin inyección la piedra se ilumina
perfecto.** O sea que `FrontSide` por sí solo NO es el culpable, y la nota del
README que lo señalaba está mal atribuida. Hace falta la combinación de las tres
cosas: cáscara desgarrada + `FrontSide` + inyección que oscurece.

Mecanismo completo:

1. La geometría desgarrada deja a la vista placas de canto, casi todas con
   `dot(N,L)` chico o negativo, y por los huecos se ve el interior.
2. `FrontSide` descarta las caras internas de las placas de atrás, así que ni
   siquiera queda el relleno del interior.
3. La inyección multiplica lo poco que queda por el tinte (**≈0,24 lineal**,
   medido) y por la oclusión de base (**0,55 a 0,89** para la piedra), y
   **el sólido no tenía ningún término de relleno**: la hoja tenía el suyo
   —`indirectDiffuse += diffuseColor * vec3(0.22,0.30,0.17)`— dentro de un
   `if (tipo.flexible)`, y la piedra y el tronco no tenían nada.

Casi cero por 0,24 por 0,55 es negro.

## 2. Hecho — `src/world/Sotobosque.js`

1. **`piedra()` cerrada.** El bulto sale ahora de cuatro lóbulos senoidales
   sobre la *dirección* del vértice en vez de un `Math.random()` por vértice.
   Dos vértices que ocupan el mismo lugar reciben el mismo desplazamiento y la
   cáscara queda cerrada. Se deja sin indexar a propósito para conservar las
   facetas planas.
2. **Relleno hemisférico para los sólidos** (piedra, tronco, carroña): cielo
   arriba, rebote de tierra abajo, con `vArriba` resuelto **en el vértice**.
   Un `mix` de dos constantes en el fragmento, sin texturas.
3. **La oclusión de base dejó de ser del fragmento.** Se hornea en el atributo
   `color` del vértice, que ya existía relleno de unos sin usarse. Al fragmento
   de las decenas de miles de briznas le saqué un `clamp`, un `mix`, una
   multiplicación y el varying `vAlturaLocal`. **Es una mejora que además
   ahorra.** Y la base ahora vira a tierra, no sólo se oscurece.
4. **Normal cero de la punta, arreglada.** La punta conserva un ancho mínimo
   (5 % del ancho de base) para que el último quad no salga degenerado.
5. **`customProgramCacheKey` por variante** — ver «trampa nueva» abajo.
6. Variación entre individuos: **tono** (rojo contra azul, verde casi quieto,
   así se abre el color sin volver el ruido de brillo que ya se había sacado),
   **inclinación** de ±10° y **escala no uniforme en planta**.
7. Hojas más arqueadas y con un tramo más (4 en vez de 3) para que la curva se
   lea como curva y no como codo.

### Trampa nueva, y vale para todos: `conCSM()` borra la clave de caché

`conCSM()` (main.js:893) envuelve el `onBeforeCompile` de cada material en una
**función anónima nueva y siempre idéntica**. La clave de caché de programa que
arma three sale por defecto de `onBeforeCompile.toString()`, así que **después
de pasar por `conCSM()` todos los materiales del juego dan el mismo texto**. Lo
único que los sigue separando son los parámetros del material (tipo, doble cara,
colores por vértice…).

Consecuencia concreta acá: la carroña (doble cara, no flexible) y los pastos
(doble cara, flexible) quedaban con la MISMA clave. Mientras los dos shaders
eran idénticos daba igual; desde que la lámina y el sólido compilan fuentes
distintas, el que compilara primero se llevaba puesto al otro **en silencio**.
Resuelto con `customProgramCacheKey = () => 'sotobosque-lamina|solido'`.

**`Vegetacion.js` y cualquier otro que inyecte shaders distintos en materiales
del mismo tipo tiene el mismo problema latente.** Vale la pena que el
coordinador lo mire.

## 2 bis. Verificado

**Píxeles casi negros (luma < 14) en la misma vista, mismo encuadre:**

| | % negro |
|---|---|
| `veg-antes-bosque.png` | **2,540 %** |
| `veg-final-bosque.png` | **1,124 %** |

Menos de la mitad. Y queda por debajo del 1,241 % del diagnóstico
`veg-diag-sinshader.png`, que era el piso teórico con las piedras en blanco
puro: lo que falta de ahí para abajo lo aportó la variación de tono de las
copas.

**Normales nulas: 0.** Recorridas las nueve geometrías en caliente, `normalCero`
da 0 en todas (antes: 16, 18, 7 y 8 en los cuatro pastos).

**Claves de programa separadas**, comprobado en caliente: la carroña —doble cara
y no flexible— saca `sotobosque-solido` y los pastos `sotobosque-lamina`. Sin
esto compartían programa y uno se llevaba puesto al otro en silencio.

**Capturas:** `veg-final-bosque.png`, `veg-final-pasto.png`,
`veg-despues-media.png` (vista media, piedras cerradas con luz y sombra propias),
`veg-despues-contraluz.png` (atardecer a contraluz: las copas tienen relleno
verde, ya no son siluetas negras).

## 2 ter. Un cambio que hice y deshice, con el número

Subí los tramos de la hoja de 3 a 4 para que el arco se leyera como curva.
Medido en la ladera: **562.106 triángulos contra 438.554, un +28 %** con el
mismo sembrado (5.980 instancias). Es la pieza más instanciada del juego y en
esta placa el costo fijo de geometría ya es la mayor parte del cuadro. **Lo
revertí**: el arqueo se ganó subiendo `inclina`, que es gratis. Queda escrito
para que nadie lo vuelva a intentar sin medirlo.

## 2 quater. Tanda de `luz` — albedo, ambiente de carteleras y contrato de niebla

### Albedo del follaje (`src/data/flora.json`)

Calculé el albedo lineal de **las 64 especies**, no sólo del coihue. Ocho estaban
por debajo del 7 %. Las corregí escalando en espacio lineal, **conservando el
tono exacto** (mismo cromatismo, sólo sube la luminancia):

| especie | antes | después |
|---|---|---|
| coihue | `#1f3d2b` 3,8 % | `#346045` **9,5 %** |
| pino_oregon | `#2c4636` 5,2 % | `#395946` 8,5 % |
| chaura | `#2c4a2e` 5,6 % | `#395d3b` 9,0 % |
| alerce | `#2e4a38` 5,8 % | `#395944` 8,4 % |
| murtilla_negra | `#2f4b2c` 5,8 % | `#3b5d38` 9,0 % |
| maniu_macho | `#2b5236` 6,8 % | `#325e3e` 9,0 % |
| chaura_enana | `#33512f` 6,8 % | `#3b5d37` 9,0 % |
| michay | `#2e5233` 6,9 % | `#355e3b` 9,1 % |

Es el rango de reflectancia de una hoja verde real (8–12 %). No inventé ningún
dato natural ni normativo: sólo subí un número de aspecto que estaba fuera de la
física. Las otras 56 especies ya estaban bien y no las toqué.

**Medido en caliente sobre el atributo `color` del lote**, que es lo que
midió `luz`: coihue **3 % → 7,34 %**. Queda por debajo del 9,5 % del hexadecimal
porque la oclusión propia de la copa (`ao`) y el `brillo` por tarjeta lo bajan, y
eso es correcto: el hexadecimal es la hoja, el atributo es la hoja ya ocluida.
Ninguna especie queda hundida: la más baja ahora es chaura_enana con 6,65 %.

### Ambiente de las carteleras (`Vegetacion.js`)

`uAmbiente` sale ahora de `cielo.irradianciaCielo` en vez de la rampa inventada
`0.18 + 0.34*factorDia`. Medido al atardecer: `(0,137 0,155 0,202)` —más bajo y
más azul que el `(0,18 0,21 0,26)` de la rampa, que es lo que corresponde.

### Contrato de niebla: **no me afecta**, comprobado

`colorNiebla()` puede pasar de 1,0. Busqué `getHex`/`getStyle` en mis dos
archivos: **cero**. `uNiebla` se usa en un solo lugar (`Vegetacion.js:723`) y es
`color = mix(color, uNiebla, f)` — destino de mezcla, no multiplicador. Un valor
mayor que 1 ahí es correcto para una perspectiva aérea aditiva. Medido al
atardecer: `(0,326 0,329 0,382)`. Sin cambios necesarios.

### Verificación visual, y por qué la primera captura no mostraba nada

`veg-luz-contraluz.png` y `veg-luz-manana.png` salieron casi idénticas a las
anteriores. **No era que el arreglo no anduviera: en ese punto no hay coihues.**
Medido: es un sitio de **lenga** (1176 carteleras, albedo 14,8 %) y el coihue
tenía 25 carteleras y ningún árbol de malla. Correcto ecológicamente —ladera
alta cerca del límite del bosque—, pero inútil para verificar el coihue.

Busqué un sitio de coihue consultando altura y humedad del mundo, y capturé en
**lat −41,14 lon −71,69** (778 m, humedad 0,89): ahí el coihue manda con 529
carteleras. `veg-coihue-manana.png` muestra las copas como follaje verde con
variación interna, sin chupetines negros.

**Lección de método:** una captura que no cambia no prueba que el arreglo no
sirva; hay que comprobar primero que en el encuadre esté lo que se arregló.

## 3. Siguiente

1. **Defecto 2 del README (ocho vistas de impostor son pocas)** y **defecto 5
   (el sotobosque corta a 192 m)**: no los toqué. Los dos piden medición de
   memoria y de cuadro, y con `luz` y `agua` editando terreno y cielo en
   paralelo no había línea de base estable para comparar.
2. La translucidez foliar es un relleno constante, no depende de dónde está el
   sol. Un contraluz de verdad pediría un término con `dot(V, -L)`, que cuesta
   por píxel. Coordinar con `luz` antes de meterlo.

## 4. Descartado

- **Normales invertidas o en cero en piedra/tronco**: medido, 0 de 80 y 0 de 28.
  No es eso. No repetir la medición.
- **Compositor / oclusión ambiental de pantalla aplastando las piedras**:
  descartado por el pase de identidad (salen blancas y brillantes con emisivo).
- **`javascript_tool` directo**: corre en mundo aislado y no ve `window.SurviBar`.
  Hay que inyectar `<script>` y devolver por `document.body.dataset`. Confirmado.
- **La pestaña de Claude in Chrome (`mcp__claude-in-chrome__*`)**: la extensión
  no está conectada en esta sesión. Sirve el panel `mcp__Claude_Browser__*`.

## Capturas propias hasta ahora

- `capturas/veg-antes-bosque.png` — línea de base mía, misma vista que uso para todo.
- `capturas/veg-id-bosque.png` — pase de identidad por lote.

Números de línea de base: `vegetacion.mallasCompletas = 103`,
`vegetacion.impostores = 4194`, `sotobosque.total = 7916`.

---

# Cerrado por el coordinador — 2/9/2026

## El tronco caído seguía negro, y no era la luz: era el albedo

`veg` arregló la **iluminación** de los sólidos del sotobosque —el relleno
hemisférico que rescató a la piedra— pero el tronco caído siguió saliendo casi
negro. La causa es aritmética y es la misma que `luz` documentó para las hojas
de coihue: **el relleno se multiplica por el albedo**, así que no hay cantidad
de cielo que arregle un albedo de 0,03.

Medido sobre `Sotobosque.js`, luminancia lineal:

| | albedo | con el relleno (×0,34) |
|---|---|---|
| tronco caído, antes | **0,047 / 0,025** | 0,016 / 0,008 — negro |
| piedra (la que `veg` sí subió) | 0,183 / 0,090 | 0,062 / 0,031 |
| **tronco caído, ahora** | **0,115 / 0,080** | 0,039 / 0,027 |

`0x4a3a2c / 0x36291f` → **`0x6f5c46 / 0x5e4d38`**. Queda en el rango de madera
muerta a la intemperie (0,10-0,20 real) y **por debajo** del granito de la
piedra, que es la relación correcta: la madera es más oscura que el canto rodado.

Comprobado vivo en el juego, leyendo `tipo.color` del lote servido.

**Por qué se pasó por alto:** la pasada de albedo de `veg` fue sobre
`flora.json`, que es donde viven los árboles de pie. El tronco caído no es una
especie de `flora.json`: es un tipo del sotobosque con su color escrito a mano
en `Sotobosque.js`. Los troncos **de pie** están bien (coihue 0,061, lenga
0,179); el que estaba mal era el caído, que es otro archivo.
