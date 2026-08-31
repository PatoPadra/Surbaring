# Bitácora — agente `luz`

Archivos propios: `src/world/Cielo.js`, `src/engine/Posproceso.js`, `src/world/Tiempo.js`.

## 1. Diagnóstico

### El verde del cielo — YA UBICADO, con la cuenta hecha a mano

Está en `Cielo.js`, en el `FRAG`, en estas tres líneas:

```glsl
vec3 luzIncidente = exp(-(betaR * solR + betaM * solM));
vec3 albedo = (betaR * faseR + betaM * faseM) / max(betaR + betaM, vec3(1e-9));
vec3 dispersion = albedo * (1.0 - exp(-tauVista)) * luzIncidente;
```

Dos errores encadenados:

**(a) El azul se extingue DOS veces.** `luzIncidente` atenúa el rayo que llega al
punto de dispersión con TODO el camino al sol, y después `(1 - exp(-tauVista))`
vuelve a pesar por el camino de la vista. Falta el término de dispersión
múltiple: el fotón azul que el rayo directo pierde no se evapora, rebota y
vuelve. Sin él, el azul —que se extingue más— queda por debajo del verde, que se
extingue la mitad.

**(b) La mezcla Rayleigh/Mie se pesa con los coeficientes POR METRO**, no con la
profundidad óptica de la columna. Rayleigh tiene 8400 m de altura de escala y Mie
1250 m: dividir por `betaR + betaM` compara dos números de aire distintos, y el
Mie —que es gris— pesa lo mismo mirando al cenit que al horizonte. Le come el
azul al cielo alto.

Cuenta a mano, sol a 30°, mirando a 17° de altura, 90° del sol:
`color = dispersion * 26 = (0,192  0,290  0,265)` → **verde oliva medido**, no
una impresión. Coincide con `capturas/base-alta-manana.png`.

### El paisaje en penumbra — el coseno solar entra DOS veces

`Cielo.js:150`: `this.luzSol.intensity = 3.4 * dia + 0.06` con `dia = sin(altura)`.
El sombreado ya multiplica por N·L, que es el mismo coseno. O sea que el terreno
llano recibe `3,4·sin²(h)`. A las 09:00 del 15 de febrero el sol está a 22,4°:
`3,4·0,381 = 1,36` de intensidad, y después otro 0,381 en el N·L → **0,52**.
El disco solar arriba de la atmósfera vale lo mismo a toda hora; lo que baja con
la altura es la transmitancia atmosférica, no la radiancia.

### La exposición no es una curva: es una constante

`Tiempo.js:195`: `exposicion: 1.05 - nubosidad * 0.18 - ceniza * 0.2`.
No depende de la altura solar. No hay curva que arreglar: hay que escribirla.

### El mediodía lavado no es la niebla, es el resplandor

`escena.fog` con `densidadNiebla ≈ 4,75e-5` y la ley lineal de `main.js` da 0,9 %
de velo a 200 m y 9 % a 2 km: no alcanza para lavar el primer plano de
`base-alta-bosque.png`. El `UnrealBloomPass` de `main.js:489` tiene umbral 0,86
**en HDR, antes del mapeo tonal**, y el cielo actual pasa de 1,0 lineal en todo el
horizonte. O sea que el resplandor se come la escena entera. Se arregla bajando el
nivel absoluto del cielo, que es mío, no tocando el bloom, que es del coordinador.

### La luz de relleno existe pero es un gris pastel inventado

`Cielo.js:116`: `HemisphereLight(0x9fc0e8, 0x4a4034, 0.55)`, y en `actualizar()`
la intensidad es `0.62 * sin(h) + 0.055` con un color de rampa fija. A las 18:40
da 0,29 de un celeste que no es el celeste de esa hora. La vegetación cercana es
`MeshLambertMaterial` (`Vegetacion.js:108,499`, `Sotobosque.js:161`), así que SÍ
lee la hemisférica: el problema es el valor, no el cableado.

## 2. Hecho

**Servidor: `http://localhost:5173/`, NO 5174.** `CONTEXTO.md` está desactualizado.

### `Cielo.js`
- Constantes del modelo subidas a nivel de módulo (`BETA_R`, `BETA_M` 21e-6→14e-6,
  `ESCALA_CIELO` 26→21) + helpers `suave()` y `caminoOptico()` en CPU.
- `uRayleigh` 1,6 → 1,15 y **desacoplado de la turbiedad** (en JS y en GLSL).
- `uMultiple` nuevo (3,0): peso del rebote de dispersión múltiple.
- `FRAG`: albedo pesado por profundidad óptica de COLUMNA + término
  `(1 - exp(-tauSol*0.35)) * uMultiple * brillo` sumado a la fuente.
- `_transmitanciaSolar()`, `_dispersion()` (réplica CPU del shader) y
  `_encenderLuces()` nuevos. `actualizar()` quedó de 50 líneas a 6.
- Sol: `3.9 * transmitancia` en vez de `3.4 * sin(h)`; color = transmitancia
  normalizada. Nubes atenúan el sol (`1 - 0.75·n²`) y prenden el relleno.
- Hemisférica: color e intensidad del cielo real (cenit 65 % + cielo bajo 35 %);
  suelo = lo que rebota × albedo pardo.
- `colorNiebla()` sale de `_dispersion(0.045, 0.35)` con piso nocturno.
- `configurarAtmosfera()` rehace las luces (si no, el sol queda con la nubosidad
  del cuadro anterior; en una captura con salto de fecha, con la de otro día).

### `Tiempo.js`
- `exposicion` pasa a `_exposicion()`: `2.24 / (1.54 + max(0, sen h))` × factor
  de noche × nubes/ceniza. Importa `posicionSolar` de `Cielo.js`.

### Trampa pagada (para el que venga)
Puse comillas invertidas dentro de un comentario **del GLSL**, que vive en una
plantilla literal de JS: `SyntaxError: Unexpected identifier 'betaR'` y el juego
no arranca. En `FRAG`/`VERT` no van comillas invertidas ni `${`.

### Medido tras el cambio (mismo día, 15/2/2025)

| hora | sol | exposición | sol int/color | amb int | cenit del cielo |
|---|---|---|---|---|---|
| 06:55 | −3,4° | 1,203 | 0 | 0,050 | (0,001 0,001 0,003) |
| 09:00 | 19,7° | 1,134 | 2,355 (1 0,80 0,46) | 0,595 | **(0,090 0,167 0,343)** |
| 13:30 | 61,0° | 0,880 | 2,778 (1 0,92 0,74) | 0,971 | (0,350 0,483 0,786) |
| 17:30 | 36,4° | 0,994 | 2,590 (1 0,88 0,64) | 0,726 | (0,137 0,240 0,475) |
| 20:40 | 1,1° | 1,359 | 0,219 (1 0,15 0,00) | 0,048 | (0,007 0,009 0,021) |

A media mañana el cielo a media altura pasó de **(0,192 0,290 0,265)** —g > b,
verde oliva— a **(0,216 0,389 0,691)**, o sea 1 : 1,80 : 3,20. El horizonte del
mediodía bajó de >1,0 en los tres canales a (0,76 0,98 1,11): apenas roza el
umbral 0,86 del resplandor en vez de pasarlo entero.
El sol de las nueve casi se duplicó (1,20 → 2,36) y el mediodía BAJÓ un poco
(3,03 → 2,78), que es exactamente el sentido del arreglo del coseno doble.

### Segunda vuelta (después de mirar las capturas)
- `FRAG`, nubes: la paleta fija crema (1,00 0,93 0,84) pasó a
  `exp(-tauSol*0.4)*0.86 + fuente*0.22`. La nube devuelve la luz que le llega, y
  el 0,4 del camino es porque está ARRIBA: usar la transmitancia del suelo la
  pintaba de naranja al mediodía. Con la paleta vieja la lámina cubierta valía
  0,9 lineal, por encima del umbral 0,86 del resplandor.
- `_encenderLuces()`: expone `irradianciaCielo` / `intensidadCielo` /
  `luzCieloColor` para las carteleras de `Vegetacion.js`, que se iluminan a mano.

### Verificado con capturas (13 en total, prefijo `luz-`)
`luz-mirador-{amanecer,manana,mediodia,tarde,crepusculo}`,
`luz-bosque-{manana,mediodia,crepusculo}`, `luz-nublado`, `luz-lluvia`,
`luz-mirador-manana2`, `luz-diag-impostor`, `luz-diag-relleno5x`.

- **manana**: cielo celeste con horizonte brumoso, laderas iluminadas y verdes.
  Contra `base-alta-manana.png` no hay comparación posible: era verde oliva.
- **mediodia**: cielo azul con degradé, horizonte brumoso pero NO reventado,
  perspectiva aérea intacta. La neblina lechosa de `base-alta-bosque.png` no está.
- **crepusculo**: crema-naranja abajo, rosa, violeta arriba, estrellas asomando,
  nubes teñidas de la hora. Lo mejor que salió.
- **nublado / lluvia**: luz plana y plateada, sin sombras duras, sin reventar.
- `luz-mirador-poniente` salió **negra**: rumbo 285 desde el mirador mete la
  cámara contra la ladera. No es un defecto de luz. Ignorar esa captura.

### Cuánto cuesta
`window.banco({ancho:640, alto:360, cuadros:90})` DESPUÉS del cambio, en la placa
de destino: **18,09 ms de media (55,3 fps)**, preset Baja — bosque 19,05, orilla
19,30, altura 15,92. El A/B con la cúpula apagada se perdió: otro agente guardó
un archivo y la recarga en caliente se llevó el script a la mitad.

## 3. Siguiente

Los cinco pasos están HECHOS. Lo que queda es de otros agentes.

### Para `veg` — las copas negras NO son culpa de la luz. Medido.

`luz-diag-impostor.png`: pinté de magenta el ambiente de las carteleras. Sólo se
volvieron magenta **dos troncos finos del fondo**. Las copas negras del primer
plano NO, o sea que son geometría `MeshLambertMaterial` y sí reciben mi
hemisférica.

Leí el atributo `color` de los lotes. Promedio por especie:

| especie | color medio | máximo |
|---|---|---|
| **coihue** | **(0,028 0,045 0,029)** | (0,068 0,060 0,051) |
| lenga | (0,115 0,166 0,078) | (0,205 0,214 0,138) |
| ñire | (0,093 0,154 0,047) | (0,124 0,295 0,069) |
| ciprés | (0,060 0,082 0,046) | (0,147 0,112 0,064) |

El coihue tiene **un albedo del 3 %**, cuatro veces menos que la lenga de al
lado. Una hoja de coihue real anda por el 8-12 % en el visible. Con el sol en
2,8, el canal rojo del coihue da 2,8 × 0,028 = **0,078 lineal**: negro con
cualquier exposición y con cualquier luz de relleno. Ninguna cantidad de cielo
arregla un albedo de 0,03. Está en `Vegetacion.js`, no en `Cielo.js`.

Y para las carteleras: `Vegetacion.js:260` arma `uAmbiente` con
`0.18 + 0.34 * factorDia` y dos constantes más — la misma rampa inventada que
saqué de acá, así que el bosque lejano se vuelve a despegar del cercano. Dejé
`cielo.irradianciaCielo` (ya es color × intensidad) para que sea una línea:

```js
this.uniformesImpostor.uAmbiente.value.copy(this.cielo.irradianciaCielo);
```

### Para `agua`
En `luz-mirador-crepusculo.png` los dos lagos del fondo reflejan el rosa del
poniente, pero **el lago de adelante queda celeste diurno** a las 20:40. No lee
la hora. Es `Agua.js`.

## 4. Descartado

- **Pesar el albedo con la columna y NADA MÁS**: cuenta hecha, sigue dando verde
  (g > b) porque el problema dominante es la doble extinción, no la mezcla.
- **Término de rebote proporcional a `(1 - transSol)` a secas**: en el atardecer
  `transSol → 0` en los tres canales, el rebote tiende a gris parejo y **mata el
  rojo del atardecer**. Hay que escalarlo por el brillo del sol directo.
- **Rebote neutro (proporcional a la luminancia de `transSol`) sin tinte**: deja
  el horizonte crema/amarillento porque el albedo sube al azul y el rebote no.
  El rebote tiene que ser azulado, que es lo que físicamente le sobra.
- **Bajar `densidadNiebla` para arreglar el mediodía lavado**: no es la niebla.
  Ver diagnóstico. Bajarla mataría la perspectiva aérea, que es lo mejor que
  tiene el juego.
