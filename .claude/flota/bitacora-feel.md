# Bitácora — agente `feel` (sensación de movimiento)

Archivos propios: `src/entities/Jugador.js`, `src/entities/Cuerpo.js`,
`src/engine/Entrada.js`.

## 0. Cómo medir (esto costó trabajo: no lo vuelvas a montar)

**El servidor está en `http://127.0.0.1:5173/`, NO en 5174** como dice
`CONTEXTO.md`. Se debe haber reiniciado. Verificá con `tabs_context` a qué
origen apuntan las pestañas de los demás.

El banco de medición está escrito en **`capturas/feel-banco.js`**
(`capturas/` está en `.gitignore`, así que no ensucia el repo). Expone
`window.__feel` con: `medirTodo()`, `rampa`, `salto`, `caida`, `aire`,
`balanceo`, `quieto`, `agachar`, `pendiente`, `fov`, `buscar`, `preparar`.
Simula pasos de `jugador.actualizar(1/60, entradaSintética)` y devuelve curvas.

Busca solo los puntos de terreno que necesita (`buscar(pendMin, pendMax)`
barre círculos alrededor del jugador exigiendo que el entorno de 24 m sea
parejo), guarda el estado del jugador antes y lo restaura después.

### La receta de inyección que funciona

`javascript_tool` corre en un mundo aislado y no ve `window.SurviBar`. Y las
llamadas con `await` largo **se mueren**: hay siete agentes guardando archivos y
Vite recarga la página cada pocos segundos. La forma que aguanta:

```js
// 1) traer el banco por fetch (el mundo aislado sí puede)
const codigo = await fetch('/capturas/feel-banco.js?v=' + Date.now()).then(r => r.text());
const cola = "\ntry { if (window.SurviBar && window.SurviBar.jugador) {" +
  " localStorage.setItem('feelR', JSON.stringify(window.__feel.medirTodo()));" +
  " document.body.dataset.feelR = 'listo'; }" +
  " else { document.body.dataset.feelR = 'esperando'; } }" +
  " catch (e) { document.body.dataset.feelR = 'ERR ' + (e && e.stack || e); }";
// 2) lazo de esperas CORTAS: si la página recarga se pierde una vuelta, no la llamada
let est = 'esperando';
for (let i = 0; i < 45; i++) {
  const s = document.createElement('script');
  s.textContent = codigo + cola;
  document.documentElement.appendChild(s); s.remove();
  est = document.body.dataset.feelR;
  if (est !== 'esperando') break;
  await new Promise(r => setTimeout(r, 700));
}
est + ' || ' + (localStorage.getItem('feelR') || '').slice(0, 120)
```

El resultado va a `localStorage['feelR']`, que **sobrevive a la recarga**: si la
llamada muere, se lee después con otra llamada corta. Si igual muere, reintentar
la llamada entera; tarde o temprano cae en una ventana sin recarga.

Trampa ya pagada: el banco no puede tomar `window.SurviBar` en el momento de
cargarse (el archivo puede llegar antes que el juego). Por eso resuelve
`S/J/M/C` tarde, en `init()`, llamado desde `buscar`, `preparar` y `medirTodo`.

## 1. Diagnóstico

### Leído del código, todavía sin confirmar con el banco

Números que salen de leer `Jugador.js` y que el banco tiene que confirmar:

- **Fricción aplicada siempre.** `_mover` acelera hacia el objetivo con
  `k = 1 - exp(-14·dt)` y después `_resolverTerreno` multiplica por
  `exp(-9·dt)` **aunque haya entrada de movimiento**. Punto fijo:
  `v = 0,5618 · velocidadBase`. O sea que caminar da **1,91 m/s** con una
  `velocidadBase` de 3,4, y correr **3,48 m/s** con una base de 6,2. El README
  declara 3,4 m/s.
- Consecuencia rara: en el aire NO hay fricción, así que al saltar caminando la
  velocidad horizontal **sube** hacia 3,4 en vez de mantenerse.
- Constante de tiempo del arranque y de la frenada: 1/23 s = 43 ms. Muy seco.
- **Agacharse es un escalón instantáneo**: `alturaOjos * (agachado ? 0,62 : 1)`
  baja la cámara 0,64 m en un cuadro. No hay transición.
- **No hay golpe de aterrizaje.** `_ySuave` persigue con k=90 en el aire, así
  que la cámara llega clavada.
- **No hay apertura de campo visual al correr**: nadie toca `camara.fov`
  (62° fijo).
- **Tres zancadas distintas y desacopladas**:
  - cámara: `_balanceo += rapidez·dt·2,1`, `sin(_balanceo·2)` → 1,496 m por
    ciclo de cabeceo;
  - cuerpo (`Cuerpo.js`): `fase += rapidez·dt·2,4` → 2,618 m por ciclo de dos
    pasos, o sea 1,31 m por paso;
  - audio (`Audio.js`, de **vida**): 0,85 m por paso caminando, 1,25 corriendo.
  El pie apoya, el sonido suena y la cámara cabecea en tres momentos distintos.
- **Pendiente: sólo penaliza subir** (`penalizacion = 1 - subida·0,55`), no hay
  ninguna ayuda al bajar. Y la penalización **no depende del peso cargado**: la
  carga sólo escala `velocidadBase` parejo, así que "el inventario frena cuesta
  arriba" del README no está implementado como tal.
- **Terreno bajo los pies**: nada en `Jugador.js` ni en `Cuerpo.js` mira el
  material del suelo. Roca, pasto y nieve caminan igual.
- **Ratón**: 0,0022 rad/px, sin suavizado, sin zona muerta, sin aceleración.
  Está bien como está. Único reparo: `_mirar` corre dentro del paso fijo, así
  que con `dt < 1/60` el giro espera al próximo paso (hasta 16 ms de retardo).
  Arreglarlo pide tocar `main.js`, que es del coordinador.

### Medido con el banco — el ANTES

**El navegador no sirve para esto.** Siete agentes guardando archivos hacen que
Vite recargue cada pocos segundos y ninguna corrida llega a terminar. La física
del jugador es JS puro, así que el banco definitivo es
**`capturas/feel-node.mjs`**: importa `src/entities/Jugador.js` en Node contra un
**terreno sintético** (`mundoPlano(m)`, un plano de pendiente exacta). Corre en
un segundo, es determinista y mide mejor que buscar un lugar parejo en el DEM.

```
node capturas/feel-node.mjs
```

| medida | ANTES |
|---|---|
| caminar, velocidad de régimen | **1,913 m/s** (`velocidadBase` declara 3,4) |
| correr | **3,488 m/s** (declara 6,2) |
| agachado | 0,844 m/s (declara 1,5) |
| rampa de arranque t90 / t99 | 117 ms / 217 ms |
| frenada hasta 0,2 m/s | 100 ms |
| salto: altura / tiempo en el aire | 0,878 m / 550 ms (subida 283 ms) |
| caída de 4 m: impacto / salud / hundimiento de cámara | 12,83 m/s / −18,0 / **0 mm** |
| en el aire, velocidad horizontal | 1,913 → **2,641 m/s** (acelera solo) |
| cabeceo de cámara | 28 mm pp, **1,736 m por ciclo**, 1,10 /s |
| zancada del cuerpo (`Cuerpo.js`) | **1,309 m por paso** |
| zancada del audio (`Audio.js`) | **0,85 m por paso** |
| agacharse | **escalón de 0,638 m en UN cuadro** |
| campo visual al correr | 62° → 62° (no pasa nada) |
| velocidad subiendo 10° | **2,436 m/s — MÁS RÁPIDO que el llano** |
| velocidad subiendo 30° | 1,799 m/s |
| velocidad bajando 10° / 30° | 1,913 / 2,663 m/s |
| carga de 40 kg subiendo 30° | 1,786 m/s (empujada por el mismo defecto) |

### Los dos defectos que explican casi todo

**1. El rozamiento se aplica aunque el jugador esté pidiendo moverse.**
`_mover` acelera hacia el objetivo con `k = 1 − exp(−14·dt)` y después
`_resolverTerreno` multiplica por `exp(−9·dt)`. Punto fijo: `0,5618 ·
velocidadBase`. Por eso caminar declara 3,4 y da 1,91. Y como en el aire el
rozamiento NO corre, saltar caminando **acelera** de 1,91 a 2,64 m/s.

**2. El escalón levanta al cuerpo del suelo en cualquier cuesta arriba.**
`_resolverTerreno` mira la cota a 61 cm adelante y, si es más alta, sube al
cuerpo. En una ladera pareja SIEMPRE es más alta: a 10° son 10,7 cm de
levantada por cuadro. El cuerpo queda flotando sobre el terreno, `enSuelo` se
apaga y de ahí salen tres cosas medidas:

- no se aplica el rozamiento → **subir 10° sale más rápido que el llano**;
- el balanceo de cámara se multiplica por `(enSuelo ? 1 : 0)` → **parpadea**;
- `Audio.pasos` arranca con `if (!jugador.enSuelo) return` → **el sonido de los
  pasos desaparece cuesta arriba**. Esto es de `vida` pero la causa es mía.

## 2. Hecho

### Herramientas (en `capturas/`, ignorado por git)

`feel-banco.js` (navegador) y `feel-node.mjs` (Node, el que vale). Al medir el
DESPUÉS aparecieron **dos artefactos del propio banco** que daban números
falsos, y quedaron arreglados:

- `zancadaCuerpoM` estaba **clavada a mano** en `2·PI/2,4/2` — no medía nada,
  reflejaba una línea de `Cuerpo.js` que ya no existe. Ahora lee `j.zancada`.
- `zancadas.cuerpo` tomaba `f0 = c.fase` de un `Cuerpo` recién creado (0) y lo
  restaba contra la fase del jugador, que viene **acumulada de todas las medidas
  anteriores**. Daba 5,788 rad/m donde eran 2,596. Ahora corre un cuadro en seco
  antes de tomar `f0`, y mide la distancia recorrida de verdad en vez de
  suponerla como `v·n·P`.

### Cambios, todos en `src/entities/Jugador.js` salvo el último

1. **El rozamiento ya no corre contra la entrada.** Era el defecto 1 del
   diagnóstico. Se aplica sólo cuando no hay pedido de movimiento, y el
   coeficiente pasó de 9 a 16 para que la frenada no se volviera blanda al
   desaparecer la pelea. Con esto la velocidad real **coincide con la
   declarada**, y de paso se cae solo el defecto de saltar caminando: ya no
   quedaba margen para acelerar en el aire.
2. **El escalón sólo corre cuando el avance quedó frenado.** Era el defecto 2.
   Antes levantaba al cuerpo en cualquier cuesta arriba. Además prueba en la
   dirección en la que se camina y no en la que se mira.
3. **Pegado al suelo** (`pegado`, tolerancia proporcional a la velocidad).
   **Esto no estaba en el diagnóstico: lo encontró la medición en el navegador
   contra el terreno real.** El plano sintético del banco no puede mostrarlo
   porque una rampa perfecta no tiene por dónde despegar. Ver sección 5.
4. **Transición de agachado**, 140 ms hasta el 90 %.
5. **Golpe de cámara al aterrizar**: resorte amortiguado, tope 11 cm.
6. **Una sola zancada**: `fasePaso` y `zancada` expuestas en `Jugador`. La
   cámara y `Cuerpo.js` ya cuelgan de ellas. **Falta `Audio.js`, que es de
   `vida`** — el traspaso está escrito en `bitacora-vida.md`.
7. **Campo visual**: +5° al correr, con rampa de 180 ms. Detecta que Opciones
   escribió `camara.fov` a mano y adopta ese valor como nuevo reposo, así el
   control deslizante y la apertura de correr no se pelean.
8. **Pendientes**: bajar ayuda (con techo) y subir cuesta más con carga.
9. `Cuerpo.js` lee `j.fasePaso`. Conserva su reloj viejo como respaldo para el
   maniquí de la creación de personaje, que no es un `Jugador`.

## 3. Medido — el DESPUÉS

`node capturas/feel-node.mjs`, terreno sintético, determinista.

| medida | ANTES | DESPUÉS |
|---|---|---|
| caminar (declara 3,4) | 1,913 m/s | **3,400** |
| correr (declara 6,2) | 3,488 | **6,200** |
| agachado (declara 1,5) | 0,844 | **1,500** |
| rampa de arranque t90 | 117 ms | 167 ms |
| frenada a 0,2 m/s | 100 ms | 100 ms |
| en el aire, horizontal | 1,913 → **2,641** (aceleraba solo) | 3,400 → **3,400** |
| hundimiento de cámara al caer 4 m | **0 mm** | **−43 mm** |
| ídem al aterrizar un salto | 0 mm | −16 mm |
| agacharse | **0,638 m en UN cuadro** | 0,638 m en 140 ms, máx **0,117 m/cuadro** |
| campo visual al correr | 62° → 62° | 62° → **67°**, vuelta en 417 ms |
| metros por cabeceo de cámara | 1,736 | **1,210** |
| metros por paso del cuerpo | 1,309 | **1,210** |
| metros por paso del audio | 0,850 | **0,850 — sigue suelto, es de `vida`** |
| subir 10° | **2,436 (más rápido que el llano)** | 3,075 |
| subir 20° / 30° / 40° | 2,252 / 1,799 / 1,852 | 2,760 / 2,465 / 2,198 |
| bajar 10° / 30° | 1,913 / 2,663 | 3,577 / 3,910 |
| 40 kg subiendo 30° | 1,786 | **1,818** (contra 2,465 sin carga) |

Las tres zancadas que iban cada una por su lado ahora son **una**: cámara y
cuerpo dan el mismo 1,210 m. Falta enganchar el sonido.

Subir es por fin monótono: cuanto más empinado, más lento. Antes 10° era más
rápido que el llano y 40° más rápido que 30°, que es la firma del defecto 2.

## 4. El defecto que sólo apareció en el navegador

El banco de Node corre contra `mundoPlano(m)`, una rampa de pendiente exacta.
Contra el **terreno real**, con el jugador vivo en el cerro, apareció esto:

| | ANTES | DESPUÉS |
|---|---|---|
| cuadros en el aire caminando | **112 de 150** | **0 de 180** |
| ídem corriendo | — | **0 de 180**, en los cuatro rumbos |
| velocidad vertical máxima | — | **0,00 m/s** |

Bajando una cuesta el terreno cae más rápido de lo que la gravedad baja al
cuerpo: a 3,4 m/s por una ladera de 30° el suelo se va 3,3 cm por cuadro y la
gravedad sólo lo baja 0,3 cm. El cuerpo salía despedido en cada bajada y
`enSuelo` se apagaba tres cuartas partes del tiempo — o sea los mismos tres
síntomas del defecto 2, por una causa distinta y en un lugar distinto.

**La lección, que vale para toda la flota:** el plano sintético es más rápido,
determinista y midió bien todo lo demás, pero es incapaz de mostrar este
defecto. Un relieve muestreado tiene por dónde despegar y una rampa perfecta no.
Las dos mediciones hacen falta.

## 5. Descartado

- Cargar el banco con `<script src>` y leer `window.__feel` desde el mundo
  aislado: el `onload` corre en el mundo aislado y ahí `window.__feel` no
  existe nunca. Parecía un error de carga y no lo era.
- `javascript_tool` con un `await` de 13 s para esperar la carga del juego: la
  recarga de Vite mata la llamada entera. Hay que esperar en tramos cortos.
- **Medir con `requestAnimationFrame` con el panel del navegador oculto.** No
  dispara: el bucle del juego queda congelado y la corrida devuelve vacío sin
  decir por qué. Lo que sí funciona con el panel oculto es mover la física a
  mano —`j.actualizar(P, entradaSintética)` en el script inyectado— guardando y
  restaurando el estado del jugador alrededor. Mide el módulo real contra el
  mundo real y no depende de que el navegador componga un solo cuadro.

## 6. Siguiente

- **Enganchar `Audio.pasos` a `jugador.fasePaso`.** Es de `vida`; el traspaso
  con el número de línea está en `bitacora-vida.md`.
- Ajustar a gusto: la velocidad real subió un 78 % al arreglar el rozamiento
  (1,91 → 3,40 m/s caminando). Es lo que el código declaraba y lo que dice el
  README, pero el juego se venía jugando y equilibrando al valor viejo. Si se
  siente demasiado, lo que hay que tocar es `velocidadBase`, **no** volver a
  poner el rozamiento contra la entrada.
- El suelo sigue sin material: roca, pasto y nieve caminan y suenan igual.
- `_mirar` corre dentro del paso fijo: con `dt < 1/60` el giro espera al próximo
  paso, hasta 16 ms de retardo. Arreglarlo pide tocar `main.js`.
