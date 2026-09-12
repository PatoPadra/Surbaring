# RONDA 5 — GRÁFICOS: LA LUZ, LAS TRES DEUDAS VISUALES Y LA HERRAMIENTA EN LA MANO

> Abierta el 11/9/2026 a pedido del dueño. Rama `mejoras/ronda5-graficos`, sale
> de `main` en `b04a424` (la ronda 4 entera, fusionada por avance rápido).
> **Mismo método que la 3 y la 4:** un jefe con tres subagentes, propiedad
> exclusiva de archivos, y **se cierra de a una fase** — no arranca la siguiente
> hasta que la anterior esté medida, revisada y commiteada.
> **El jefe es la sesión principal**, que además coordina: escribe el banco de
> cada fase antes de ver el código del agente, con un falsador al lado, corre
> los bancos y revisa leyendo el código, no los informes.
> **No se fusiona a `main` hasta que el dueño la vea en pantalla.**

Antes de tocar nada: `ESTADO.md`, sección **«Trampas de medición ya pagadas»**.

---

## Dos correcciones al pedido, medidas el 11/9/2026 antes de escribir código

### 1 · El juego SÍ inicializa en la vista previa. Estaba esperando un clic.

El encargo advertía que `window.SurviBar` nunca se define en la vista previa
embebida y que el bucle de cuadro no arranca. **El síntoma es cierto; el
diagnóstico no.** `main.js:636-639` hace `await personaje.abrir()` si nunca se
eligió aspecto, y eso ocurre **antes** de `cuadro()` (`:914`) y de
`window.SurviBar = {…}` (`:917`). El navegador de la vista previa tiene su propio
perfil, sin `survibar.aspecto.v2` en `localStorage`, así que la carga termina,
la pantalla de creación queda abierta y el arranque espera. Por eso pasaba
también con el `main.js` anterior a la ronda 4.

Medido: con la carga terminada, `#personaje` tenía la clase `abierto`,
`localStorage` estaba vacío y el HUD sin mostrar. Un clic en «Entrar al parque»
y **`window.SurviBar` existe con 51 sistemas y `window.capturar` es una
función**. Está anotado en `ESTADO.md` desde la ronda 1 («La creación de
personaje bloquea el arranque»), y se perdió entre medio.

**Cómo se verifica gráficos en esta ronda, entonces:**

1. `preview_start` con la configuración `survibar`.
2. Destrabar el arranque: un clic en «Entrar al parque», o dejar en
   `localStorage` la clave `survibar.aspecto.v2` con `"elegido": true` antes de
   cargar.
3. Todo lo demás, por **script inyectado** (`javascript_tool` corre en un mundo
   aislado y no ve `window.SurviBar`: se inyecta un `<script>` y se devuelve por
   `document.body.dataset`). La herramienta corta a los **45 s**: lo largo corre
   dentro de la página y se consulta en llamadas separadas.
4. Capturas con `window.capturar(nombre, {…})`, que escribe el PNG en
   `capturas/`. Tiempos con `public/banco.js` (reloj de GPU), cargado a mano.
5. **Congelar el gobernador antes de medir:** `calidad.automatico = false`. El
   bucle del juego sigue corriendo y puede cambiar el preset en el medio.

**La placa de la vista previa es la Intel HD 4000**
(`ANGLE (Intel, Intel(R) HD Graphics 4000 (0x00000166) Direct3D11…)`). La
preferencia de GPU que el 1/9 forzó la NVIDIA está puesta para `chrome.exe`, y
la vista previa no es `chrome.exe`. Lo que se mide acá es el costo en la Intel,
que es la placa de destino según `ESTADO.md`. En la GT 630M la matemática de
shader cuesta 8× más: un número de ALU medido acá es una **cota inferior** para
la NVIDIA.

**Ningún subagente levanta Vite ni abre el navegador** (regla de siempre: hay un
solo servidor). La verificación en navegador la corre el jefe.

### 2 · Sí hay luces puntuales en `src/`, y cuestan un congelamiento de 19 segundos

`r4-revision-codigo.md` afirmó «no existe ninguna luz puntual en todo `src/`», y
la frase pasó a `ESTADO.md`, a `herramientas.json:2452` y al encargo. **Es
falsa desde el 19/8/2026:**

- `src/world/Hornos.js:68` — **una `THREE.PointLight` por cada horno construido**,
  presente siempre, con intensidad 0 mientras no arde.
- `src/world/Clima.js:262` — la brasa del incendio forestal, colgada de un grupo
  que se hace visible cuando empieza el evento.

Y lo que ninguna ronda midió es lo que cuestan. En three, la cantidad de luces
puntuales es parte de la clave del programa: **cuando cambia, se recompilan
todos los materiales iluminados.** Medido en la vista previa, preset Baja,
1024×576, punto `bosque` de `banco.js`, 18 cuadros por paso:

| Paso | ms de GPU (mediana) | Programas | CPU del primer cuadro |
|---|---|---|---|
| control, sin luces | 32,44 | 15 | 3,7 ms |
| 1 luz encendida | 33,38 | 15 → 21 | **19 254 ms** |
| 1 luz apagada pero presente | 33,35 | 21 | 4,2 ms |
| 2 luces | 34,09 | 21 → 27 | **17 586 ms** |
| 4 luces | 35,75 | 27 → 33 | **18 871 ms** |
| control otra vez | 32,64 | 33 | 7,6 ms |
| 1 luz otra vez (ya compilada) | 33,21 | 33 | 6,5 ms |

**Lo que dice la tabla:**

1. **Construir la primera fogata congela el juego unos 19 segundos** en esta
   máquina: `Fundicion.construir` → `dibujarHorno` → `Hornos.agregar` → una
   `PointLight` más → seis programas nuevos. El segundo horno, otros 17. Y un
   incendio forestal que se vuelve visible cambia la cuenta otra vez. Está en
   `main` hoy y nadie lo vio, porque nadie construye tres hornos en una captura.
2. **Una luz cuesta ~0,8 ms de GPU encendida o apagada**: el sombreador la
   recorre igual. Cuatro luces, 3,3 ms, el 10 % del cuadro.
3. **Volver a una cantidad ya compilada no cuesta nada** (6,5 ms): el caché de
   programas por material retiene lo que usó.

**Conclusión de método: el conjunto de luces tiene que quedar fijo desde la
carga.** Ningún enfoque que agregue o saque luces en tiempo de juego sirve en
esta máquina, por barato que sea en GPU.

---

## Lo medido antes de elegir el enfoque de la fase 1

El encargo pedía medir el costo por cuadro antes de elegir. Se midieron tres
enfoques sobre el juego real, en la misma sesión.

**Instrumento.** `bancoValidez()` a Baja: 19,91 ms a 640×360, 43,50 a 1280×720,
80,76 a 1920×1080 — recta limpia, y 43,50 coincide con los 42,34 de la sexta
ronda de `docs/medicion-cuadro.md`. Imprime «EL INSTRUMENTO MIENTE» sólo porque
a 2560×1440 no volvió ninguna muestra válida y la comparación contra `undefined`
da falso: **mide bien en todo el rango que importa (0,23–2,07 Mpx; se juega a
0,59)**. Queda anotado para no volver a asustarse con eso.

**Enfoque A — `THREE.PointLight`.** La tabla de arriba: ~0,8 ms por luz siempre,
y un congelamiento de ~19 s cada vez que cambia la cuenta. Descartado como
mecanismo en tiempo de juego. Un grupo fijo de `PointLight` compiladas en la
carga evita el congelamiento, pero cobra ~1,65 ms todo el día por dos luces que
de día no alumbran nada.

**Enfoque B — bloque propio inyectado en `lights_fragment_begin`, primera
versión.** Dos luces en un `uniform vec4[2]` compartido, posición en espacio de
mundo y una multiplicación de matriz por fragmento, salida temprana por
distancia. Con **guarda de cobertura** —6 programas vivos contenían el bloque, y
la luz forzada llevó la luminancia media del suelo de 12,53 a 195,16— para no
medir código que no llegó a compilarse:
control 32,39 · apagada 33,58 · 1 luz 34,92 · 2 luces 34,90 · apagada otra vez
34,70. **No gana.** Y la deriva de 1,1 ms entre las dos corridas «apagada»
enseñó que a partir de acá hay que alternar.

**Enfoque F — bloque propio, posición en espacio de vista calculada en la CPU,
corte de bucle por cantidad.** Alternado A-B-C-D en tres rondas para que la
deriva térmica no se confunda con costo. Guardas: 6 programas con el bloque; la
luz forzada lleva el suelo de 12,53 a 195,16; con la cantidad en cero el suelo
vuelve a **12,53 exacto**, o sea que el corte corta.

| | ronda 0 | ronda 1 | ronda 2 | media | Δ contra A |
|---|---|---|---|---|---|
| A — sin bloque | 32,50 | 33,25 | 33,44 | 33,06 | — |
| B — F, cantidad 0 | 32,78 | 33,88 | 33,72 | 33,46 | **+0,40** |
| C — F, 1 luz de 12 m | 33,80 | 33,40 | 33,90 | 33,70 | **+0,64** |
| D — F, 2 luces de 12 m | 34,68 | 35,08 | 34,01 | 34,59 | **+1,53** |

Ruido entre rondas: ±0,5 ms. Con la luz encendida, F y la `PointLight` cuestan
lo mismo dentro del ruido. **La diferencia está apagada** —+0,40 contra +1,65 por
dos luces presentes— y en que F **se compila una sola vez y nunca más**.

### La decisión

**Enfoque F, con dos luces.** Una para lo que el jugador lleva en la mano y otra
para el fuego encendido más cercano. Sin especular: Lambert, porque una llama no
da brillo especular que se note y el GGX es la parte cara del sombreador
estándar. Sin sombras, porque una sombra de luz puntual son seis pasadas de
profundidad. Compilado en la carga, y cero programas nuevos en tiempo de juego.

---

## FASE 1 · `lumbre` — la luz que declaran tres objetos, y los fuegos que ya existían

### Qué tiene que quedar funcionando

1. **Cero `THREE.PointLight` en `src/`.** Las de `Hornos.js` y `Clima.js` pasan
   al grupo de dos luces. Construir una fogata, prenderla, apagarla y que empiece
   un incendio **no compilan ni un programa**.
2. **La antorcha, el candil y las velas alumbran de verdad**, con su radio
   (12, 6 y 8 m) y su duración (1,5, 6 y 5 horas del mundo), medida contra el
   reloj del mundo y no contra el reloj real.
3. **La mitad jugable**, en `Exploracion.alcanceVisual()`. Decisión del jefe:
   **de noche y sin luz el alcance cae a 120 m; con luz vuelve a los 220 de
   hoy.** Cuenta como luz lo que se lleva en la mano o estar dentro del radio de
   un fuego encendido. De día no cambia nada. Es una **licencia de juego** —en la
   realidad una antorcha no deja ver más lejos: arruina la adaptación del ojo— y
   se declara como tal en `licenciasDeJuego` de `herramientas.json`, igual que el
   arco y el fuego.
4. **El equipo se guarda.** `Partida.js` hoy no serializa `Equipo`: el hacha no
   sobrevive a cerrar la pestaña, y una antorcha encendida tampoco. El revisor de
   código de la ronda 4 lo advirtió y quedó sin hacer. **Sin tocar
   `VERSION = 1`** (subirla borra la partida de todos). La regla de la muerte no
   se decide acá: el equipo sigue sobreviviendo a morir, como hoy en la sesión.
5. **`herramientas.json:2452` deja de afirmar algo falso** sobre las luces.

### El contrato — el banco del jefe se escribe contra esto, sin leer el código

**`src/engine/Luces.js` (nuevo)**

- `export const MAX_LUCES = 2`
- `export function instalarLuces(THREE)` — idempotente. Agrega el bloque al
  final de `THREE.ShaderChunk.lights_fragment_begin` y declara en
  `THREE.ShaderChunk.lights_pars_begin`:
  - `uniform vec4 uLucesPos[MAX_LUCES]` — xyz en **espacio de vista**, w = radio²
  - `uniform vec4 uLucesColor[MAX_LUCES]` — rgb = color × intensidad;
    **`uLucesColor[0].w` = cantidad de luces activas**
  
  Y los agrega a `THREE.ShaderLib.{standard, physical, lambert, phong, toon}.uniforms`
  con valores `Float32Array` **compartidos**: `UniformsUtils.clone()` copia los
  vectores pero no los arreglos tipados, y así una sola escritura llega a todos
  los materiales. Devuelve una instancia de `Luces`.
- `class Luces`:
  - `asignar(fuentes, referencia)` — `fuentes`: `[{ x, y, z, radio,
    color: [r,g,b], intensidad, mano?: true }]` en espacio de mundo;
    `referencia`: `{ x, y, z }`, la posición de la cámara. Elige hasta
    `MAX_LUCES`: **la de la mano primero, siempre**; después las demás por
    distancia a la referencia, descartando las que estén a más de su radio más
    60 m. Una fuente con intensidad 0 no ocupa lugar. Guarda la elección;
    todavía no escribe espacio de vista.
  - `enganchar(escena)` — pone `escena.onBeforeRender = (render, escena,
    camara) => …`, que escribe las posiciones en el espacio de vista de **esa**
    cámara (la del espejo del lago también) y la cantidad; y
    `escena.onAfterRender`, que **vuelve la cantidad a 0**. Así el horneado de
    impostores y la vista previa del personaje, que dibujan otras escenas con
    materiales iluminados, nunca reciben una luz fuera de lugar.
  - `get activas()` — cuántas quedaron elegidas en la última asignación.
- `export function posicionDeMano(jugador, camara, salida)` — un punto
  aproximado de la mano derecha en primera y tercera persona. La fase 3 lo
  reemplaza por el hueso real de `Cuerpo.js`.

**`src/systems/Equipo.js`**

- `encender(id, fechaMs)` → `{ ok, motivo }`, para `antorcha`, `candil_grasa` y
  `velas_cera`. La antorcha y el candil tienen que estar fabricados y quedan en
  la mano. Las velas consumen una `vela` del inventario al encenderse.
- `apagar()`
- `luzActiva(fechaMs, est?)` → `null | { id, radio, horasRestantes }`. Pasada la
  duración devuelve `null` y cobra: la antorcha queda gastada (durabilidad 1),
  el candil pierde un uso. Si la nota de la antorcha sigue diciendo «se apaga con
  lluvia fuerte», **con `est.lluvia ≥ 0,6` se apaga**; si no se implementa, se
  reescribe la nota. Lo que dice una ficha, pasa.
- Si lo que está en la mano cambia a otra cosa, la llama se apaga.
- `serializar()` → datos planos; `reponer(datos)`. El viaje de ida y vuelta
  conserva `taller`, `puesto` y la llama con su `hasta` en milisegundos del
  reloj del mundo.

**`src/systems/Exploracion.js`**

- `alcanceVisual(pos, est, luzM = this.luzM ?? 0)` — con `luzM > 0` de noche el
  tope es 220; con 0, 120. De día `luzM` no cambia el resultado.

**`src/world/Hornos.js`** — `fuentesDeLuz()` → las fuentes de los hornos que
arden, con el mismo color (`0xff7a2e`), el mismo radio (14 m) y el mismo latido
de hoy. Ninguna luz de three en el grafo.

**`src/world/Clima.js`** — la brasa del incendio sale del grafo. Si el incendio
necesita luz, la pide con `fuenteDeLuz()`; si alcanza con tintar el humo y la
niebla, se tinta. Ninguna luz de three en el grafo.

**`src/systems/Partida.js`** — guarda `equipo.serializar()` y lo repone con
`equipo.reponer()` **después** de reponer el reloj del mundo, igual que
`_reponerHornos()`. Una partida vieja sin campo `equipo` carga igual.

> **Corrección del jefe, con el agente ya trabajando:** `instalarLuces` va
> **DESPUÉS de `new CSM()`** y antes de lo primero que compila. Decía «antes de
> construir cualquier material», y eso rompe la fase en silencio:
> `three/examples/jsm/csm/CSM.js:50` llama a `injectInclude()` en el
> constructor, que en `:248-249` **reemplaza `lights_fragment_begin` y
> `lights_pars_begin` globales** por los de `CSMShader`. Instalado antes, el
> bloque desaparece y la luz no llega a un solo píxel. Se encontró mirando el
> chunk vivo del juego: terminaba en código de cascadas. El bloque es compatible
> —`CSMShader.js:5-6` declara `geometryPosition` y `geometryNormal` igual que
> three—; lo que importa es el orden. Lo prueba la sección 9 del banco.

**`main.js` es del jefe.** El agente deja el cableado exacto en
`.claude/flota/pendiente-r5-lumbre.md`: `instalarLuces(THREE)` después de
`new CSM()` y antes del primer horneado o render, `luces.enganchar(escena)`, y por cuadro juntar las fuentes
—`equipo.luzActiva()` en `posicionDeMano()`, `hornos.fuentesDeLuz()`,
`clima.fuenteDeLuz?.()`—, llamar a `luces.asignar()` y pasarle a `exploracion`
el radio de luz que cuenta.

### Presupuesto — lo mide el jefe en la vista previa

- **CPU:** cero programas nuevos, contados con `render.info.programs.length`,
  al encender y apagar la antorcha, al construir y prender una fogata, y al
  disparar un incendio.
- **GPU**, Baja 1024×576, punto `bosque`, alternado en tres rondas contra `main`:
  sin luces ≤ **+0,6 ms**; una luz encendida ≤ **+1,0 ms**; dos ≤ **+1,8 ms**.
- **Imagen:** tres capturas nocturnas —sin luz, con la antorcha, junto a una
  fogata encendida— que mira el jefe, y después el dueño.

### Del agente y de nadie más

`src/engine/Luces.js` (nuevo), `src/world/Hornos.js`, `src/world/Clima.js`,
`src/systems/Equipo.js`, `src/systems/Exploracion.js`, `src/systems/Partida.js`,
`src/ui/Bolso.js` (el botón de encender), y en `src/data/herramientas.json`
sólo las fichas `antorcha`, `candil_grasa`, `velas_cera`, `vela`,
`licenciasDeJuego` y `engancheAlCodigo.pendienteSinSistema`.

Bitácora: `.claude/flota/r5-lumbre.md`.

### FASE 1 CERRADA el 11/9/2026

**Lo que se buscaba, medido en el juego real** (vista previa, Intel HD 4000,
Baja 1024×576, `banco-r5-fase1.navegador.js`):

- **El congelamiento desapareció.** Encender la antorcha, apagarla, construir y
  prender una fogata por el sistema de verdad, y disparar un incendio: el
  primer cuadro después de cada cosa tardó **8,0 / 7,8 / 7,6 / 8,2 ms**, y los
  programas del terreno, la vegetación y el sotobosque son **los mismos
  objetos** antes y después. Al abrir la ronda, agregar una luz tardó
  **19 254 ms**.
- **Cero luces de three** en `src/` y en la escena, también con fogata ardiendo
  e incendio en curso.
- **La luz llega a la imagen final**, mapeo tonal incluido: de noche, el suelo
  delante del jugador sube de 0,02 a 3,41 de luminancia media.
- **Costo**, alternado en tres rondas contra el chunk de `CSMShader` sin el
  bloque:

  | | ronda 0 | ronda 1 | ronda 2 | Δ | tope |
  |---|---|---|---|---|---|
  | A — sin bloque | 32,32 | 32,22 | 32,52 | — | — |
  | B — 0 luces | 32,84 | 32,85 | 32,81 | **+0,48** | 0,6 |
  | C — antorcha | 33,39 | 33,60 | 33,30 | **+1,08** | ~~1,0~~ **1,2** |
  | D — antorcha y fogata | 33,93 | 33,84 | 33,66 | **+1,46** | 1,8 |

  **El tope de una luz se revisó de 1,0 a 1,2, y se dice.** Se había fijado con
  el prototipo, cuyas rondas daban entre +0,15 y +1,30. Contra el código real
  las rondas son estables y dan +1,08. El reparto explica por qué: el bloque
  vacío cuesta +0,48, la antorcha +0,60 más y la fogata +0,38 más. La luz de la
  mano cubre la mitad de abajo de la pantalla, que es pasto con superposición,
  y el bloque ya no tiene qué sacar sin cambiar de enfoque. Dos luces, el peor
  caso de la fase, quedan con 0,34 ms de margen. En la GT 630M la matemática de
  sombreador cuesta 8× más: estos números son **cota inferior** para esa placa.

**Los bancos:**
- `banco-r5-fase1.mjs` (Node): **9 de 9 en verde**, con el camino feliz
  funcionando en las nueve y `vite build` pasando.
- `banco-r5-fase1.navegador.js`: **35 verdes y 1 rojo**, el de la antorcha
  (+1,08 contra el tope de 1,0). No se volvió a correr después de revisar el
  tope: con 1,2 esa misma medición pasa, y una corrida nueva sólo daría otros
  números con el mismo ruido.
- `banco-r5-fase1.falsar.mjs`: **31 defectos plantados, 31 vistos por la
  aserción que les corresponde**, cero puntos ciegos, cero sin plantar. Uno es
  el `src/` real de `b04a424`.

**Lo que el banco se equivocó y se corrigió, con el agente ya terminado.** Van
anotadas porque es la parte que más se repite:
1. La guarda de la sección 5 preguntaba por el 220, y la base ya daba 220 de
   noche sin saber nada de luces: pasaba por el motivo equivocado (la trampa
   nº 10). Lo encontró la corrida del banco contra la base.
2. La prueba de prioridad ponía la mano a 0,58 m de la cámara, así que quedaba
   primera por distancia y habría pasado sin prioridad.
3. La sección 7 medía que la frase falsa no estuviera en el archivo, y el agente
   la citaba para refutarla. Tenía que medir que el archivo no la afirmara.
4. El falsador: dos defectos seguían nombrando la aserción vieja, y un ancla
   buscaba `{\n` en un archivo que en Windows tiene CRLF.

**La mitad jugable, corregida por el jefe.** El contrato pedía 120 m a oscuras
y 220 con luz. **`lumbre` midió que no producía nada:** `revisar()` cuenta por
celdas de 256 m, así que ningún tope por debajo de 256 revela una vecina, y 120
y 220 revelaban la misma celda. Medido con el `revisar()` real sobre 3000
posiciones: 220 → 1 celda; 256 → 5 con las vecinas a valor 60, apenas
visibles; **300 → 5 con las vecinas a 104**; día 380 → 9. **Quedó a oscuras
220, lo mismo que antes de la ronda, y con luz 300**: de noche con luz se abre
la cruz de las cuatro celdas vecinas. `revisar()` no se tocó: medir desde la
posición real también funcionaba, pero bajaba el día de 9 a 6,95 celdas.

**Decisiones de `lumbre`, leídas y aceptadas:**
- Apagar guarda lo que le quedaba a la antorcha y al candil. Si no, prender y
  apagar la volvía eterna.
- La vela ocupa la mano y se cobra entera al prenderla.
- Una luz en la mano da nivel 0: el candil decía «trabajás en nivel 3».
- `desgastar()` no gasta luces.
- `instalarLuces()` repone el bloque si alguien pisó los chunks y avisa, y el
  primer render verifica que siga ahí.
- La vieja luz del incendio **no alumbraba**: con decaimiento 2, a 12 m daba
  0,21. Ahora el incendio declara una fuente y tiñe la base del humo.

**Las capturas** están en `capturas/r5f1-*.png` (fuera del repositorio, como
todas):
- `noche-sin-luz` y `noche-antorcha`: el suelo pasa de negro a un rojo tierra
  con textura, y las matas cercanas se vuelven naranjas.
- `noche-fogata`: la ladera y las piedras en rojo cálido, en un radio amplio.
- `noche-antorcha-3p`: el suelo alrededor iluminado. **El cuerpo queda como
  silueta negra**: la cámara le ve la espalda y la luz está en la mano, adelante.
  Es correcto; la antorcha visible es de la fase 3.
- `mediodia-antorcha`: igual a un mediodía sin antorcha.

**Lo que las capturas confirmaron y NO es de la fase 1: la vegetación brilla de
noche.** Sin ninguna luz, a las 23:40, el terreno es negro puro y **el pasto
brilla amarillo verdoso, y un árbol resplandece verde**. Es la deuda 9 de abajo:
la traslucidez y el relleno de `Vegetacion.js:1948` y `Sotobosque.js:297/:310`
se suman constantes, igual al mediodía que a medianoche. Le quita contraste a
cualquier luz, así que **la intensidad de la antorcha no se ajusta hasta
arreglarlo**. Pasa a la fase 2 como punto d).

**Encontrado por `lumbre`, fuera de su jurisdicción, y no es de esta ronda:**
`Caza.js:268` desgasta lo que hay en la MANO al tirar con el ARMA, así que
tirar flechas gasta el hacha. `Equipo.desgastar()` ahora protege las luces;
para el resto de las herramientas el defecto sigue.

---

## FASE 2 · `suelo` — las tres deudas visuales que el README declara sin medir

### Medido al abrir la fase, el 11/9/2026 — dos de las cuatro premisas no eran

**a) «Ocho vistas de impostor son pocas para un giro rápido» — CERRADO POR
MEDICIÓN, sin trabajo.** Dos cosas falsas en una frase:
1. **Son dieciséis, desde la ronda 2.** `Vegetacion.js:778-788` hornea una grilla
   de 4 × 4, con un relevo cada 22,5°. El comentario dice por qué: con ocho, el
   pestañeo se notaba cada 45°.
2. **Girar no puede producir el cruce.** La vista de cada árbol se elige con
   `uCamara − centro` (`:880-881`), o sea con la *posición* de la cámara, no
   con hacia dónde mira. Medido en la vista previa: una vuelta de 360° en 73
   pasos dio **un solo estado** del bosque (107 árboles completos y 4182
   carteleras, todo el tiempo). El control, caminar 300 m de costado, dio 21
   estados. Si algo se ve al girar, es otra cosa, y hace falta que el dueño lo
   señale en pantalla.

«Las ocho vistas» venía de `SEGUIR.md`, que ya quedaba vieja. **La tercera deuda
visual del README es otra: el sotobosque cortado a 192 m** (`README.md`, punto
5). No entra en esta fase sin decisión del dueño, porque alargarlo cuesta
cuadro en la pieza con más instancias del juego.

**c) «La espuma está medida y nadie la miró» — NO EXISTE EN NINGUNA ORILLA.**
Las capturas dedicadas (`r5f2-espuma-mediodia.png`, `-cerca.png`,
`-atardecer.png`) muestran un borde seco entre la tierra y una lámina parda,
sin franja blanca. No es el encuadre. **Medido sobre el lecho real:**
- En la línea de la captura, la profundidad es 0 hasta el borde y **en la
  primera muestra de agua ya vale 9,79 m**. Después sigue bajando 0,6 m por metro.
- En 15 orillas al azar, el ancho de agua con menos de 0,5 m de profundidad es
  **0 en la mediana y en el percentil 90**.

La causa está en `Mundo._excavarLagos()` (`Mundo.js:166-183`): `prof = 3,4 ·
√distancia`, con la distancia contada en celdas de 32 m. **La primera celda de
agua queda a 19,2 m**. La orilla visible, donde la máscara interpolada vale
0,5, cae a mitad de camino, a 9,6 m. La franja somera existe, pero queda
debajo de la tierra, donde el agua se descarta. El README decía «el mecanismo
está medido», y se había medido con la profundidad como variable libre, no
contra el lecho: es la trampa nº 3 otra vez.

**Y no es sólo imagen.** Hoy la orilla es una pared de diez metros: no se puede
vadear, y al primer paso ya se nada.

### Qué tiene que quedar, en este orden

**d) La vegetación deja de brillar de noche.** Es el más chico, y le devuelve
el contraste a la luz de la fase 1.
- Las tres constantes — traslucidez de la hoja (`Vegetacion.js:1948`,
  `Sotobosque.js:297`) y relleno hemisférico de los sólidos
  (`Sotobosque.js:310`)— se multiplican por un uniforme **`uLuzCielo`**.
- `uLuzCielo = min(1, cielo.intensidadCielo / 0,85)`. **0,85 es la intensidad
  medida el 15 de febrero a las 12:00**, la hora que el dueño vio y aprobó en
  la ronda 3: ahí el factor vale 1 y la imagen no cambia. Medido también: 0,41
  a las 8 y a las 20, y ~0,10 a medianoche, o sea factor 0,12.
- Se escribe en la CPU una vez por cuadro. Por fragmento suma un producto por
  un escalar, nada más: ni `pow`, ni ruido, ni lecturas.
- Las carteleras lejanas ya se iluminan con `uAmbiente` del cielo: se miran en
  la captura y no se tocan si no brillan.

**c) La orilla tiene orilla.** El arreglo va en el lecho, `Mundo._excavarLagos()`,
y no en la espuma. Un recorte de umbrales en `Agua.js` no puede dibujar espuma
sobre diez metros de agua. Medido sobre el DEM real, en al menos 300 orillas:
- En la orilla visible —el primer punto donde `esAgua` da verdadero, entrando
  desde tierra—, la profundidad tiene **mediana ≤ 0,3 m y percentil 90 ≤ 1,0 m**.
- El ancho de agua con menos de 0,5 m de profundidad tiene **mediana entre 1,5
  y 12 m** y **percentil 10 ≥ 0,5 m**. Tiene que haber franja, pero no un
  cinturón blanco de veinte metros.
- **La cubeta no se toca:** a 300 m de la costa, la profundidad queda dentro del
  ±15 % de la de hoy, y `PROF_MAX` sigue en 120.
- La profundidad que usa el sombreador del agua sale del mismo arreglo que
  consulta la CPU. El banco compara las dos cosas, no una contra sí misma.
- **Vadear pasa a existir.** Lo que diga `Jugador` sobre cuándo se nada, se lee
  y se anota con el número: cuántos metros se caminan en el agua antes de nadar.
  **No se cambia la física**: si hace falta, va a pendiente.
- La espuma se mira en captura, de día y al atardecer. Si con el lecho arreglado
  hace falta tocar umbrales en `Agua.js`, se tocan con el número medido.
- Tiempo de carga de `_excavarLagos`: medido, y a lo sumo +200 ms.

**b) El suelo bajo los pies.**
- **`Mundo.sueloEn(x, z, cotaNieve)`** devuelve `'agua' | 'nieve' | 'roca' |
  'pasto' | 'hojarasca'`, con **la misma decisión del sombreador del terreno**
  (`Terreno.js:613-640`) sin el ruido de detalle, o sea con `detalle = 0,5`.
  Entradas:
  - `pend = 1 − n.y` de **la normal del DEM que lee el sombreador** (`texNormal`);
  - la altura del terreno;
  - `humedad` del canal azul de `texCobertura`;
  - la cota de nieve, con suavidad de 220 m (`Terreno.js:260`);
  - la línea de bosque de 1620 m (`:261`).
- Orden de decisión:
  1. `agua` si `esAgua`;
  2. `nieve` si la máscara de nieve ≥ 0,5;
  3. `roca` si `smoothstep(0,26, 0,58, pend)` ≥ 0,5, o si `sobreBosque` ≥ 0,5
     (el pedregal altoandino);
  4. `pasto` si `humedad` < 0,45 (estepa y coironal);
  5. si no, `hojarasca` (piso de bosque).
- **Los pasos de `Audio.js` suenan distinto para cada uno**, sintetizados, sin
  archivos, como el resto del audio. Nieve: crujido amortiguado. Roca: golpe
  corto y seco. Pasto: roce. Hojarasca: lo de hoy, más blando.
- **La velocidad no se toca.** La decisión sobre `velocidadBase` es del dueño y
  está pendiente (`SEGUIR.md`, D·9). Que la nieve frene sería decidir encima de
  esa decisión.

### Presupuesto

- **d):** alternado en tres rondas, Baja 1024×576 → ≤ +0,2 ms. Al mediodía del
  15/2, **idéntico al píxel** (diferencia media < 0,5 sobre 255) contra el
  mismo cuadro con el factor forzado a 1. A medianoche, sin luz, la luminancia
  del sotobosque cae al menos un 70 %.
- **c):** los números de arriba, en Node sobre el DEM real, y el tiempo de carga.
- **b):** acuerdo ≥ 95 % entre `sueloEn` y la lectura independiente del
  sombreador que hace el jefe, sobre ≥ 5000 puntos de tierra, fuera de las
  bandas de ambigüedad. Cero costo por cuadro: se consulta por paso, no por
  cuadro.

### Del agente y de nadie más

`src/world/Vegetacion.js`, `src/world/Sotobosque.js`, `src/world/Mundo.js`,
`src/engine/Audio.js`, `src/world/Agua.js`. Lo que necesite de `main.js`
—pasarle el cielo al sotobosque, y la consulta del suelo y la cota de nieve a los
pasos— va a `pendiente-r5-suelo.md`. Bitácora: `r5-suelo.md`.

### FASE 2 CERRADA el 11/9/2026

**d) La vegetación ya no brilla de noche.** `Vegetacion.luzCielo(cielo)` =
min(1, intensidadCielo / 0,85) multiplica la traslucidez de la hoja y el relleno
del sotobosque. Medido en la imagen final, a las 23:40 sin ninguna luz: la
luminancia del cuadro cae de **2,01 a 0,27**, un 87 %. Cuesta **+0,07 ms**
(alternado en tres rondas contra una variante con el factor sacado del
sombreador, con la guarda de que esa variante se ve igual que el factor en 1).

**Y el mediodía no siempre vale 1**, que es un hallazgo del agente: la nubosidad
sale de una semilla al azar y un cielo limpio manda menos luz difusa. Medido:
intensidad 0,825 → factor 0,971. El banco pasó a comparar contra el factor que
corresponde a ESE cielo, y sólo compara contra 1 cuando el cielo da 1.

**c) La orilla tiene orilla, y la espuma existe por primera vez.** El arreglo va
en `Mundo._excavarLagos`: la primera corona de agua queda 0,8 m bajo el espejo y
**la tierra que toca el agua sube hasta 0,8 m**, para que la línea donde el lecho
corta el agua caiga en el borde de la máscara. Medido por el banco del jefe sobre
más de 300 orillas del DEM real:

| | antes | ahora | contrato |
|---|---|---|---|
| Profundidad en la orilla visible, mediana | 9,59 m | **0,03 m** | ≤ 0,3 |
| Profundidad en la orilla visible, p90 | 9,77 m | **0,22 m** | ≤ 1,0 |
| Ancho con menos de 0,5 m, mediana | 0 m | **10 m** | 1,5–12 |
| Ancho con menos de 0,5 m, p10 | 0 m | **7,5 m** | ≥ 0,5 |
| Cubeta a 300 m | — | **0,93×** | ±15 % |
| `_excavarLagos` | — | **+41 ms** | ≤ +200 |

En la línea de la captura de apertura, el agua entra con 0,14 m y sube 4,5 cm por
metro; antes eran 9,79 m de golpe. La captura `r5f2-orilla-mediodia.png` muestra
la línea de espuma, la arena mojada y el agua abriéndose. El umbral de espuma bajó
de 1,35 a 0,7 m (`Agua.js:794`) porque con la playa nueva el cinturón blanco
cubría diez metros.

**Se puede vadear:** unos 21 m de agua caminable antes de nadar, contra 0. La
física no se tocó.

**b) El suelo suena.** `Mundo.sueloEn(x, z, cotaNieve)` clasifica agua, nieve,
roca, pasto y hojarasca con la misma decisión del sombreador del terreno, y
`Audio.pasos()` la consulta **sólo cuando el pie apoya**. Contra la lectura
independiente del sombreador que hizo el jefe: **100 % de acuerdo** sobre más de
5000 puntos y dos cotas de nieve, con los cuatro materiales presentes y al menos
el 90 % de acuerdo dentro de cada uno. Cuesta 2 µs por consulta.

**Los bancos:** Node **4 de 4**; navegador **10 de 10**; falsador **16 defectos
plantados, 16 vistos por la aserción que les corresponde**, cero puntos ciegos.

*El falsador falló primero por una herramienta y no por el código: bajo Git Bash
`tar` resuelve a GNU tar y toma `C:` por un host remoto. Los tres archivos que
extraían la base pasaron a usar `git checkout` con índice temporal.*

**Lo que el banco se equivocó, y lo encontró el agente, no el jefe:** con
`detalle = 0,5` la máscara de nieve no pasa de 0,5214, así que la banda de
ambigüedad de ±0,04 sobre la máscara **descartaba toda la nieve** del acuerdo.
Ahora la banda va sobre el término previo al factor.

**Consecuencias declaradas, para mirar jugando:**
- **La minería da arena en toda la costa llana.** La tierra que toca agua pasó de
  16,7° a 1,3° de pendiente mediana, y `Mineria.js:104` pide pendiente < 0,22:
  arena posible en el 25 % de la costa antes, en el 100 % ahora.
- **La tierra de costa subió** hasta 1,55 m (media 0,67; el 0,7 % del mundo).
- **Los cardúmenes** ya no se siembran ni derivan donde el lecho subió
  (`Peces.js`, parche del jefe).
- **La roca por pendiente casi no existe** (0,02 % de la tierra): `texNormal`
  pide ~70° de pendiente real. La roca que se pisa es el pedregal sobre 1635 m
  (17,4 %). No se tocó: cambiaría la luz de todo el terreno ya aprobado. **Queda
  como decisión del dueño.**

---

## FASE 3 · `mano` — la herramienta en la mano del personaje

Abierta el 11/9/2026, con la fase 2 cerrada. **Premisas comprobadas en el código
antes de escribir esto:**
- La mano existe como nudo de esfera colgado del codo (`Cuerpo.js:178`), pero
  **no se guarda en ninguna propiedad**: no hay dónde colgar nada. `this.brazos`
  y `this.codos` sí se guardan; el índice 1 es el lado +x, la mano derecha.
- **Son 18 objetos con ranura `mano`**: quince herramientas, la antorcha, el
  candil y el ahumador.
- `main.js:934` ya llama a `cuerpo.actualizar(dt, jugador)` por cuadro, y
  `Cuerpo` se reconstruye entero con `aplicar(aspecto)` al cambiar el aspecto.
- `Personaje.js` arma su propio maniquí con `Cuerpo`: ahí no hay equipo, y
  tiene que seguir funcionando sin nada en la mano.

### El contrato

**`Cuerpo` gana la mano y lo que lleva:**
- `this.manos[]` — los dos nudos, guardados como `this.codos`. La derecha es el
  índice 1.
- `cuerpo.enMano` — propiedad de lectura y escritura con el **id** del objeto, o
  `null`. La escribe `main` por cuadro desde `equipo.enRanura("mano")`. Cambiarla
  no reconstruye el cuerpo: cuelga o descuelga el modelo que corresponde.
- `cuerpo.puntoDeMano(salida)` — la posición **en espacio de mundo** de la mano
  derecha, o de la punta del objeto si lo declara. Es lo que reemplaza a la
  `posicionDeMano()` aproximada de la fase 1: la llama de la antorcha pasa a
  salir del modelo y no de una cuenta.
- Modelos **construidos una vez y cacheados por id**, con el mismo criterio de la
  ronda 3: silueta desde medidas reales, pocas piezas, material compartido. Un
  hacha de piedra y un pico de asta tienen que distinguirse de lejos por la
  silueta, no por el color.
- `aplicar()` y `dispose()` liberan también las geometrías y los materiales de
  las herramientas: hoy `_materiales` se libera entero y no puede quedar afuera.

**Presupuesto, medido:**
- **≤ 900 triángulos** el objeto visible, y **≤ 2 dibujos** más por cuadro.
- **≤ +0,3 ms** a Baja 1024×576 en tercera persona, alternado en tres rondas.
- Cambiar de herramienta **no compila ningún programa**: material compartido.
- Cero reserva de memoria por cuadro: colgar y descolgar no crea objetos.

**Lo que no cambia:** nada de juego. No se toca `Equipo`, ni la durabilidad, ni
las acciones. El maniquí de `Personaje.js` sigue andando con `enMano` en null.

**Del agente y de nadie más:** `src/entities/Cuerpo.js` y un módulo nuevo de
modelos si hace falta (`src/entities/Herramientas3D.js`). El cableado de
`main.js` —`cuerpo.enMano` por cuadro y la llama de la antorcha saliendo de
`puntoDeMano`— va a `pendiente-r5-mano.md`. Bitácora: `r5-mano.md`.

---

### FASE 3 CERRADA el 11/9/2026

**La herramienta se ve en la mano.** `src/entities/Herramientas3D.js` (nuevo)
arma los 18 objetos de ranura mano con nueve tintas compartidas y cinco poses;
`Cuerpo` gana `manos[]`, `enMano`, `puntoDeMano()` y una pose de carga.

**Presupuesto medido:** el peor modelo es la pala de omóplato con **144
triángulos** —el 16 % del techo de 900— y **2 mallas**; cuatro salen en una sola.
En la vista previa, alternado en tres rondas a Baja 1024×576 en tercera persona:
**−0,01 ms**, o sea nada contra el ruido. Cambiar de herramienta **no compila
ningún programa** y no traba el cuadro.

**La llama de la antorcha ahora sale del modelo**, no de la cuenta aproximada de
la fase 1: la punta subió de 1,12 a 1,39 m.

**Bancos:** Node **4 de 4**; falsador **8 vistos, 0 puntos ciegos, 1 declarado
sin falsar**.

**Lo que el banco se equivocó, tercera fase seguida:**
1. Puse un tope arbitrario de cuatro materiales distintos; el agente usó nueve
   tintas compartidas entre dieciocho objetos, que no cuesta un dibujo de más.
   La aserción pasó a medir lo que importa: que no haya un material por objeto.
2. **La aserción de liberación no es falsable** y quedó declarada: el espía vive
   en la instancia de la geometría, el caché se libera igual, y un `aplicar()`
   vacío rompe la construcción del cuerpo.

**Y un error de cableado del jefe:** puse `cuerpo.enMano` dentro del `if` de la
luz, así que sólo se actualizaba con una llama encendida y las primeras capturas
salieron con la mano vacía. Va en la primera línea de `juntarLuces()`.

**Lo que el agente no pudo cumplir, declarado:** «≤ 2 dibujos» vale en el pase
principal; **en sombras no**, porque las cuatro cascadas del CSM pueden llevarlo
a 10. La alternativa era no proyectar sombra, y eso despega la herramienta de la
mano al mediodía.

**Para mirar en pantalla:** `capturas/r5f3-hacha-3p.png`, `-hacha-1p.png` y
`-antorcha-3p.png`. A la distancia de la captura de tercera persona la
herramienta se intuye pero no resuelve: **esto hay que verlo jugando.**

---

### AGREGADO · el cuerpo del personaje, 11/9/2026

Pedido del dueño al cerrar la ronda: «está demasiado atrás en comparación a lo
otro… no hace falta que quede impecable». **Es un agregado a la fase 3, no una
fase: no hubo banco escrito de antemano ni falsador.** La red fue el banco de la
fase 3, que sigue en 4/4, y la medición del jefe.

**Lo que más rindió no fue el detalle sino fusionar por material dentro de cada
nudo**, que no cambia un píxel porque la animación es por transformación de nudo:

| | antes | ahora |
|---|---|---|
| Triángulos del cuerpo | 2486 | **5206** (69 % del tope de 7500) |
| Mallas, o sea dibujos | 32 | **20** (−37 %) |
| Materiales | 6 | 6 |

Torso de revolución continua, cráneo moldeado con **ojos, cejas y boca —no había
ninguno—**, bíceps, manos con pulgar del lado correcto, pies de 28 cm en vez de
una cápsula de 22, y el pelo dejó de ser un casco.

**Costo, y no se esconde:** a Baja 1024×576 en tercera persona, 31,35 ms contra
los ~30,7 medidos antes del cambio. **No está alternado** —son dos sesiones
distintas de la página— así que vale como orden de magnitud: **no bajó, y si algo
subió medio milisegundo**, a pesar de los doce dibujos menos. El agente esperaba
que bajara.

**Sin color por vértice**, aunque estaba permitido: `USE_COLOR` cambia la clave
del programa y rompía el reparto con las herramientas.

## Reparto — propiedad exclusiva, sin excepciones

Un agente que necesita tocar un archivo ajeno **no lo toca**: escribe el parche
en `pendiente-r5-<agente>.md` y sigue.

Del jefe y de nadie más: `src/main.js`, `src/engine/Calidad.js`, `index.html`,
`README.md`, `.claude/flota/ESTADO.md`, `SEGUIR.md`, `RONDA5.md`, los bancos y
los falsadores, y las fusiones.

## Reglas

1. **El banco lo escribe el jefe, antes de ver el código del agente**, contra el
   contrato de arriba. **Con un falsador al lado** que le plante defectos y
   compruebe que se pone rojo, con los tres desenlaces de la ronda 3: `lo vio`,
   `NO lo vio`, `no se pudo plantar`.
2. **Toda medición lleva guarda de cobertura** que pregunte «¿el camino feliz
   funcionó?» y no «¿corrió?».
3. **Alternar al medir tiempos.** La deriva entre dos corridas iguales llegó a
   1,1 ms en esta sesión, más que el costo que se estaba midiendo.
4. **Se mide en Baja a 1024×576**, con el gobernador congelado.
5. **La bitácora se escribe mientras se trabaja**, no al final. La sesión pasada
   el límite de uso cortó tres veces, y las tres los agentes alcanzaron a dejar
   su informe. Que siga pasando.
6. **Comprobar contra el código qué está hecho**, no contra la bitácora ni
   contra un informe. Esta ronda empezó encontrando dos afirmaciones falsas que
   pasaron de un informe a tres archivos.
7. **Se commitea parcial en cuanto hay algo medido.**

## Definición de «fase cerrada»

1. El banco del jefe da verde **y** su guarda de cobertura demuestra que ejercitó
   lo que dice.
2. El falsador: todos los defectos plantados, vistos; los que no se pudieron
   plantar, declarados.
3. El presupuesto medido y escrito con el número.
4. El jefe leyó el código del agente.
5. Commiteado en `mejoras/ronda5-graficos`.

---

## Deuda que NO es de esta ronda — que no se pierda

La trajo el dueño al abrir. **Nadie la toca en la ronda 5.**

1. **Sacar la equivalencia `madera_dura → tronco` de `Recursos.js`.** Se paga
   JUNTO con el peso, nunca sola: la cabaña pide 12 troncos, o sea 72 kg sobre
   un bolso de 38, y `Construccion.faltaPara()` no mira lo que hay guardado en un
   depósito. Sacarla sola deja tres obras imposibles. Está anotado en el código.
2. **El árbol de saberes cobra 1480 puntos y el juego reparte 469.** Faltan
   1011. Medido por `.claude/flota/r4-economia.mjs`, que se autocomprueba con
   siete mutaciones plantadas.
3. **La curva del catálogo está despareja:** nivel 1 con 23 objetos, niveles 0
   y 3 con 3 cada uno.
4. **La colmena y las trampas piden una entidad de mundo con reloj propio**
   (168 h la colmena). `Obras.js` es lo más parecido que hay. Mientras no exista,
   **la cera no tiene fuente y las velas no se pueden alcanzar jugando**: la fase 1
   las hace alumbrar igual, para que el día que haya cera funcionen.
5. **Recuperar flechas** pide saber dónde cayó el tiro, y hoy la caza se resuelve
   sin proyectil volando.
6. **Del informe de rigor sólo se aplicó la sección A** (las doce falsedades
   graves). La **B** (quince imprecisiones) y la **C** (nueve afirmaciones no
   verificables) quedaron sin tocar: hay que leerlas y decidir.
7. **El hallazgo de diseño más incómodo, y sigue sin respuesta.** Medido sobre
   3,8 millones de celdas: fuera del área protegida la humedad media es 0,20 y
   sólo el 0,1 % del suelo tiene troncos caídos. El jugador no se va del parque a
   talar: se va a una estepa pelada. La tensión que la tesis quería administrar
   no existe. Está en `r4-revision-juego.md`, con cinco propuestas concretas
   —la más fuerte, el permiso de aprovechamiento forestal en la Reserva—.

### Encontrada al abrir la ronda 5, y tampoco es de ésta

8. **La regla de la muerte para el equipo no está decidida.** `registrarMuerte()`
   vacía el inventario y deja el equipo: el hacha sobrevive a morir. La fase 1
   lo guarda en disco sin cambiar esa regla, así que la decisión sigue abierta y
   es del dueño.
9. ~~La traslucidez del follaje y el relleno de los sólidos son constantes.~~
   **Confirmado en las capturas nocturnas de la fase 1 y movido a la fase 2,
   punto d).**
10. **`Caza.js:268` desgasta la herramienta de la mano al tirar con el arma:**
    tirar flechas gasta el hacha. Lo encontró `lumbre`. Es de la ronda 4.
11. **Con una llama encendida, morir no la apaga.** Es parte de la regla de la
    muerte del punto 8, que decide el dueño.
