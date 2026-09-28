# Pendiente de la fase 6 · `luz` — la luna con la ley de Allen

Agente `luz`, ronda 8. Escrito al terminar, 23/9/2026.
Archivo que toqué, y ninguno más: **`src/world/Cielo.js`**.
Ningún banco, ningún falsador, ningún commit, ningún Vite, ningún navegador.

**En una frase:** la luna dejó de alumbrar según cuánto disco muestra y pasó a
alumbrar según cuánta luz manda. La fracción iluminada se quedó con lo único que
es suyo —dónde cae el terminador del disco que se dibuja— y todo lo que ilumina
(el suelo, la niebla, el halo y cuánto se lavan las estrellas) pasó a la ley de
Allen. La llena no cambió; **el cuarto quedó 5,1 veces más flojo**.

---

## 1 · Lo que hice, punto por punto del contrato

### A1 · La ley, exportada

`Cielo.js` exporta ahora

```js
export function brilloLunar(alfaGrados) {
  const a = Math.abs(alfaGrados);
  return Math.pow(10, -0.4 * (0.026 * a + 4e-9 * a * a * a * a));
}
```

Es una **declaración** `export function`, no un `export const` con flecha: el
falsador la envuelve con `/export\s+function\s+brilloLunar\s*\(/` y con una
flecha no habría podido plantar cuatro de sus ocho defectos.

Está justo debajo de `RADIO_LUNA`, con la fuente escrita en la ficha (Allen,
*Astrophysical Quantities*, 3ª ed., § 68) y con el porqué físico: en el cuarto
media cara está iluminada, pero el sol la toca de costado, el relieve se llena de
sombras largas y el regolito devuelve mucho más hacia atrás que de lado — la
retrodispersión, el mismo efecto de oposición por el que la llena se dispara.

Lo que da, medido por el banco: `0° → 1,00000`, `30° → 0,48608`,
`90° → 0,09100`, `135° → 0,01160`, `160° → 0,00194`. Los cinco a menos del
0,001 % de Allen (el banco pide ±2 %).

### A2 · La luz de la noche la sigue

`_lunaDeLaFecha()` ya calculaba `cosFase`; ahora, del **mismo** coseno, saca las
dos cosas y las guarda separadas:

- `this.uniformes.uFaseLunar.value = (1 + cosFase) / 2` — **geometría**, la forma.
- `this.anguloFase = acos(cosFase)` en grados y
  `this.brilloLuna = brilloLunar(this.anguloFase)` — **fotometría**, lo que alumbra.
  El mismo valor viaja al shader en `uniformes.uBrilloLunar.value`.

Nota de aritmética: `α = acos(cosFase)` es exactamente lo que el banco
reconstruye como `acos(2k − 1)`, porque `2k − 1 = cosFase`. No hay dos ángulos de
fase distintos dando vueltas.

Con eso, las dos líneas de luz cambiaron de factor y de **nada más**:

| | antes | ahora |
|---|---|---|
| ambiente (`_encenderLuces`) | `(0,045 + 0,09·sen h·k)·noche` | `(0,045 + 0,09·sen h·B)·noche` |
| niebla (`colorNiebla`) | `noche·(0,020 + 0,045·sen h·k)` | `noche·(0,020 + 0,045·sen h·B)` |

Los coeficientes 0,045 / 0,09 / 0,020 / 0,045 quedaron intactos: la llena
(`B = 1`) da **exactamente** lo mismo que daba (`k = 1`). Lo único que cambió es
la curva entre la llena y la nueva.

### A3 · La llena y la noche sin luna

Medido corriendo el `Cielo` de antes y el de ahora **en el mismo proceso**, sobre
los mismos dos meses (febrero y marzo de 2025, de 2 a 8 UTC, lat −41,13):

- noche sin luna: `0,04594 → 0,04594`. **0,00 % de cambio**, y no por tolerancia:
  es la misma rama de código y el mismo número.
- niebla sin luna: `0,02176 → 0,02176`, igual.
- la llena real (α → 0): idéntica, por construcción.

### A4 · El disco sigue mostrando la fracción

`uFaseLunar` quedó **en un solo lugar del shader**, la línea del terminador:

```glsl
float terminador = (1.0 - 2.0 * uFaseLunar) * sqrt(max(0.0, 1.0 - q.y * q.y));
```

El halo del disco y el lavado de las estrellas pasaron a `uBrilloLunar`. Del lado
de JavaScript, `uFaseLunar.value` **sólo se escribe** (en `_lunaDeLaFecha`) y no
se lee en ninguna parte. El banco de la ronda 7 (`banco-r7-fase6.mjs`), que fija
`uFaseLunar` como fracción iluminada contra JPL Horizons, no vio ningún cambio
porque no hubo ninguno.

### A5 · Sin compilar de más

El brillo entra como **valor de uniforme**, `uBrilloLunar: { value: 1 }`, no como
`#define`. Cambia cada noche y no recompila nada: el shader del domo y el de las
estrellas son un programa cada uno, el mismo de la llena y el de la nueva. El
objeto de uniformes de las estrellas comparte la misma referencia que el del domo
(`uBrilloLunar: this.uniformes.uBrilloLunar`), así que hay un solo número y no dos
que puedan desincronizarse — que es como ya estaba `uFaseLunar` y por eso lo
respeté. Un uniform `float` más por shader; ninguna rama nueva por píxel.

---

## 2 · Qué va a medir cada guarda, con la cuenta

Corrido por mí con `BANCO_SECCIONES=ley,noche,cielo,shader BANCO_DETALLE=1`:
**4/4**, con guarda del camino feliz 4/4. Y el falsador, **8/8 con los 3 controles
verdes**. Esto es lo que predigo para cada línea, y por qué:

**Sección 1 · LA LEY — 6/6.**
`brilloLunar` existe y es una función; los cinco ángulos dan Allen al 0,001 %
(mismo `Math.pow(10, -0.4·(0.026a + 4e-9·a⁴))`, la misma fórmula literal que el
banco escribió en su constante `ALLEN`). El margen es el 2 %; uso el 0,05 % de él.

**Sección 2 · LA NOCHE — 5/5.**

| guarda | pide | mide | margen usado |
|---|---|---|---|
| premisa | ≥ 30 sin luna, ≥ 60 con luna alta | 98 y 83 | — |
| la noche sin luna no cambia | ±2 % de 0,0459 | **0,0459** | 0 % |
| la llena alumbra como hoy | ±10 % de 0,0889 | **0,0850** | 4,4 de 10 |
| el ambiente sigue a Allen | ±15 % (±0,02 si Allen < 0,13) | peor `2025-03-23T06, α 99°: 0,070 contra 0,068` | 1,5 de 15 |
| la niebla sigue a Allen | ídem | peor `2025-02-24T08, α 132°: 0,014 contra 0,014` | < 1 de 15 |

La cuenta de la tercera, que es la única que no es exacta y conviene entender
antes de que alguien la lea como un defecto: el banco promedia el exceso por seno
de altura sobre las noches con **α < 6°**, que en estos dos meses son cinco, con
α = 5,78°, 2,56°, 1,90°, 1,27° y 0,65°. Con la fracción, esas cinco valían
k = 0,9975 … 1,0000, promedio 0,99931, y el banco midió 0,08994 (≈ 0,09·0,99931).
Con Allen valen B = 0,8697 … 0,9961, promedio **0,94429**, y la medición da
0,09·0,94429 = **0,08499**. No es que la llena se haya apagado: la llena exacta
(α = 0°) sigue dando 0,09 clavado. Es que **la luna a 5,78° de la llena ya está un
13 % más floja**, y eso es la ley, no un error. 0,0850/0,0889 = 0,956.

Aviso para el jefe, con la aritmética: la constante `BASE_LLENA = 0,0889` del
banco no es lo que la base medía. Volví a correr el barrido contra `HEAD` y da
**0,089939**, no 0,0889 — 1,2 % de diferencia. No cambia nada (contra 0,089939 la
razón sería 0,945, igual dentro del ±10 %), y **no toqué el banco**; lo digo
porque si en una ronda futura alguien ajusta la tolerancia al 5 % creyendo que
0,0889 es la medición, va a estar restando un error de transcripción al
presupuesto de la física.

**Sección 3 · EL CIELO — 3/3.**
Un solo uso de `uFaseLunar` en GLSL y es el del terminador; cero usos en el halo y
en las estrellas; cero lecturas de `uFaseLunar.value` en JavaScript (queda sólo la
línea de asignación, que el banco excluye por su `= (1 + cosFase) / 2`).

**Sección 5 · EL SHADER — 1/1.** `lint-shader.mjs` sale en 0. Declaré
`uniform float uBrilloLunar;` en `FRAG` y en `VERT_ESTRELLAS`, que son los dos
trozos donde se usa, y saqué la declaración de `uFaseLunar` de `VERT_ESTRELLAS`,
donde ya no se usa (si la hubiera dejado, el lint la avisaría como uniforme
muerto).

**Sección 6 · ARRANQUE — verde.** Corrí `npm run build` aparte: 84 módulos,
`✓ built in 10.41s`, sin avisos nuevos.

**Sección 4 · SIN REGRESIÓN — 13/13, corrida entera (24 min).** Los trece bancos
en su número: r7 fase 1 (6/6), 2 (4/4), 2b (7/7), 3 (6/6), 4 (10/10), 5 (9/9),
**6 (7/7 — el del cielo, el que fija `uFaseLunar` como fracción contra JPL)**;
r8 fase 1 (8/8), 2 (10/10), 3 (4/4), 3b (2/2), 3c (2/2), 4 (4/4).

**El falsador — 8/8, 3 controles verdes.** Los ocho caen por la línea que les
toca: los cuatro de la ley por `brilloLunar(α°)`; `ambiente-con-fraccion` y
`niebla-con-fraccion` por su «cada noche con luna»; `sin-luna-cambia` por «la
noche sin luna no cambia»; y `halo-con-fraccion` por «ningún otro uso de
uFaseLunar». Que los cuatro de la ley arrastren también la sección 2 es la
señal de que la luz de la noche llama de verdad a la función exportada y no
repite la fórmula por dentro: eso lo hice a propósito.

---

## 3 · Cuánto más oscura queda la noche — lo que va a ver el dueño

Las dos clases de `Cielo` corriendo juntas en el mismo proceso, dos meses reales,
Bariloche. «Ambiente» es `luzAmbiente.intensity`, que es lo que le llega al suelo
y a todo lo que no tiene sol encima.

| fase | α | fracción | Allen | noches | ambiente antes | ambiente ahora | baja | paradas |
|---|---|---|---|---|---|---|---|---|
| llena | 6° | 0,996 | 0,859 | 27 | 0,0956 | 0,0888 | 7,1 % | 0,11 |
| gibosa | 38° | 0,890 | 0,399 | 31 | 0,0952 | 0,0682 | 28,4 % | 0,48 |
| **cuarto** | **92°** | **0,483** | **0,086** | **11** | **0,0724** | **0,0507** | **30,0 %** | **0,51** |
| creciente fina | 116° | 0,281 | 0,032 | 4 | 0,0567 | 0,0472 | 16,9 % | 0,27 |
| fina | 129° | 0,188 | 0,017 | 2 | 0,0515 | 0,0464 | 9,9 % | 0,15 |

La caída del total parece chica porque el total **incluye el piso de 0,0459 que
tiene una noche sin luna** y que no se toca: es la escena que igual se ve con las
estrellas nada más. La curva completa es una U — la llena casi no baja porque
`B ≈ 1`, y la luna fina casi no baja porque ya casi no aportaba nada —, y el
fondo de la U es el cuarto, que es justo lo que el dueño preguntó.

**La noche de cuarto concreta.** La más alta de los dos meses,
**20/2/2025, 08:00 UTC, luna a 55,9°, α 85,6°** (fracción 0,538, Allen 0,1056):

|  | antes | ahora | |
|---|---|---|---|
| ambiente | 0,0860 | **0,0538** | −37,5 %, **0,68 paradas** |
| niebla (azul) | 0,0418 | **0,0257** | −38,5 %, 0,70 paradas |
| **lo que aporta la luna sola** | 0,0401 | **0,0078** | **÷ 5,1** |
| halo alrededor del disco | 1,00 | **0,196** | ÷ 5,1 |
| estrellas que sobreviven al lavado | 776 | **2296** | de 2438 sobre el horizonte |

Esa última fila es la que más se va a ver: replicando el cálculo de
`VERT_ESTRELLAS` estrella por estrella contra `src/data/estrellas.json` (sin nubes
ni ceniza), la luna en cuarto **borraba 1662 estrellas de 2438**; ahora borra 142.
Una noche de cuarto pasa de tener un cielo casi vacío a tener un cielo casi lleno,
con la Vía Láctea visible, y el suelo dos tercios de parada más oscuro. Es, en
una imagen, la diferencia entre media luna y el 9 %.

**Los dos meses enteros**, 511 horas con el sol a más de 11,5° bajo el horizonte:

- ambiente medio de todas: `0,06246 → 0,05429`, **13,1 % menos**.
- sólo las 268 horas con la luna arriba: `0,07746 → 0,06189`, **20,1 % menos**.
- la hora que más baja de las 511: α 55°, luna a 71°, `0,1131 → 0,0681`
  (39,8 % menos, **0,73 paradas**).
- horas con la luna arriba en que la luna aporta **menos del 10 % del piso sin
  luna** —o sea: noches que ya se parecen a una noche sin luna—: de **31 a 84**
  de 268. Con la ley real, una luna más fina que α ≈ 120° deja de contar.

Ninguna noche queda más clara que antes, y ninguna queda más oscura que una noche
sin luna: el piso es el mismo de siempre.

---

## 4 · Lo que encontré y NO arreglé

### 4.1 · `lint-shader.mjs` da verde sobre un archivo que no compila

**Esto lo encontré pisándolo yo**, y es el hallazgo que más me importa pasarte.
Escribí un comentario dentro del GLSL con una comilla invertida adentro
(``// … van por `uBrilloLunar`, que es…``). Eso **cierra el literal de plantilla**
y el archivo deja de ser JavaScript válido. Lo comprobé aparte, con el archivo
guardado y todo:

```
$ node .claude/flota/lint-shader.mjs <copia con la comilla>
── …  (7 trozos de GLSL)  ok
Sin errores: todo uniforme usado está declarado.
salida=0

$ node --check <la misma copia, como .mjs>
SyntaxError: Unexpected identifier
    // prueba con `uBrilloLunar` adentro
                   ^^^^^^^^^^^^
```

El lint sale en **0** sobre un archivo que no parsea. El motivo está escrito en el
propio lint, en el comentario de la regla 2: *«La comilla invertida ya habría
partido el literal, así que lo que se ve acá es el resto: un `${` en un
comentario»*. O sea, la regla 2 busca **sólo** `${` y da por supuesto que la
comilla la caza otra cosa. En este archivo la cazó: las secciones 1 y 2 del banco
`import`an `Cielo.js` y explotaron con el `SyntaxError`, y así lo encontré. Pero
esa red no existe para un archivo que ninguna sección importe —`Terreno.js`,
`Vegetacion.js`, `Sotobosque.js`, `Agua.js`, `Posproceso.js`—, y **el falsador
corre siempre con `BANCO_SIN_BUILD=1`**, que es precisamente la sección que lo
atraparía. Es la clase de defecto que el proyecto ya pagó dos veces (`agua` en
`Agua.js`, `luz` en `Cielo.js`, según el encabezado del propio lint).

No toqué el lint. Dos arreglos posibles, los dos baratos:

1. El lint ya tiene la pista gratis: contó **7 trozos de GLSL** en vez de 6. Una
   comilla suelta siempre cambia la partición. Pero la pista es frágil.
2. Lo sólido: que `lint-shader.mjs` intente parsear el archivo, como hace
   `node --check`. Dos líneas, no necesita el navegador, y atrapa la comilla, el
   `${` y cualquier otra cosa que rompa el literal.

### 4.2 · El disco de la luna ahora canta con todo lo demás

Es **decisión tuya, A4, y la respeté**: el disco sigue dibujando la fracción
iluminada, con la superficie iluminada a `2.6` de brillo fijo sea creciente o
llena. El efecto lateral de esta fase es que **ese brillo fijo ahora contrasta con
todo lo que lo rodea**: en la noche de cuarto del punto 3, el suelo bajó 0,68
paradas y el halo del disco quedó en el 19,6 % del que tenía, pero el creciente en
sí sale con el mismo blanco de siempre. Antes el halo acompañaba a la fracción y
disimulaba; ahora no. Es coherente con la física en un punto (la luminancia de la
superficie iluminada sí baja bastante menos que el disco entero, porque lo que
cae con la fase es sobre todo *cuánta* superficie brilla) e incoherente en otro
(igual baja algo: cerca del terminador la superficie está a contraluz). A 9 px de
diámetro no sé si se ve. **Lo dejo anotado para que lo mires y decidas**, porque
tocarlo era salirme de A4.

### 4.3 · El `0.30` del halo quedó calibrado para otra ley

`haloLuna = pow(max(0.0, cosLuna), 320.0) * 0.30` se eligió cuando el factor que
lo seguía era `uFaseLunar`. Ahora lo sigue `uBrilloLunar`, así que el halo medio
de una noche cualquiera bajó mucho más que la llena: en el cuarto, ÷5,1. La llena
quedó idéntica, que es lo que fija A3, y ningún banco mide el halo. Si al mirarlo
te parece que el halo de la llena quedó demasiado tímido **en comparación** con la
escena, el número a mover es ese `0.30` — pero moverlo cambia la llena, y la
llena es la referencia del contrato. No lo toqué.

### 4.4 · Nada más lee la luna

Verifiqué que fuera de `Cielo.js` no hay un solo `uFaseLunar`, `faseLunar`,
`brilloLunar`, `anguloFase` ni `brilloLuna` en todo `src/`: nadie más consume la
fase de la luna, ni por uniforme ni por propiedad. La luz de luna llega al resto
del juego por `luzAmbiente`, `irradianciaCielo` y `colorNiebla`, y esos tres
siguen exactamente el mismo contrato de antes, sólo que con otro número adentro.
Las carteleras de `Vegetacion.js`, el terreno y el sotobosque se oscurecen solos.

---

## 5 · Estado de la corrida

Corrido todo, en este orden, sobre el árbol como te lo dejo:

- `BANCO_SECCIONES=ley,noche,cielo,shader,arranque` → **5/5**, camino feliz 5/5
  (incluye `vite build`, que sale en 0).
- `BANCO_SECCIONES=regresion` → **1/1**, 13 de 13 bancos en su número.
- O sea, el banco entero: **6/6**.
- `banco-r8-fase6.falsar.mjs` → **lo vio 8/8, 3 controles verdes, 0 rojos**, con
  «fuente limpia: todas verdes».
- `lint-shader.mjs src/world/Cielo.js` → 0.
- `node --check` sobre el archivo → parsea (después de lo del punto 4.1, esto lo
  corrí a mano; el banco no lo hace).

Limpié `.claude/flota/.tmp-luz/`, que fue el único lugar donde escribí fuera de
`src/world/Cielo.js` (dos copias de `Cielo.js` —la de `HEAD` y la mía— para poder
correr las dos versiones en el mismo proceso y medir la diferencia de verdad en
vez de estimarla).
