# r5-lumbre — FASE 1 de la ronda 5: la luz

> Agente `lumbre`. Encargo: `RONDA5.md`, sección «FASE 1 · lumbre». Rama
> `mejoras/ronda5-graficos`. Sin navegador ni Vite: todo se comprueba leyendo el
> código de three 0.169 y con Node en `.claude/flota/.tmp-lumbre/`.

## Diagnóstico

Comprobado leyendo, no copiado del encargo:

- `node_modules/three` es **0.169.0**. `lights_fragment_begin` declara
  `geometryPosition = -vViewPosition` y `geometryNormal = normal` en sus dos
  primeras líneas; `BRDF_Lambert` está en `common.glsl.js:106`; los cuatro
  structs (lambert, phong, physical, toon) tienen `vec3 diffuseColor`. Sólo
  `meshlambert`, `meshphong`, `meshphysical` y `meshtoon` incluyen
  `lights_fragment_begin`; `lights_pars_begin` además lo incluye `shadow.glsl.js`
  (declaración sin uso: no rompe).
- `WebGLPrograms.getProgramCacheKey` usa **`shaderID`**, no el texto, para los
  materiales de three. Un programa compilado antes de `instalarLuces` se
  reutilizaría sin el bloque: por eso tiene que ir antes del primer render.
- `WebGLPrograms.getUniforms` clona `ShaderLib[id].uniforms` con
  `UniformsUtils.clone`, que copia por referencia lo que no es vector, color,
  matriz, textura ni `Array` → un `Float32Array` queda compartido.
- `WebGLRenderer.render`: `camera.updateMatrixWorld()` (si no tiene padre) →
  `scene.onBeforeRender(this, scene, camera, target)` → … →
  `scene.onAfterRender(this, scene, camera)` → `_currentMaterialId = -1`.
  `setValueV4fArray` no tiene caché: sube el arreglo entero cada vez que el
  material se refresca.
- Quién dibuja qué: `Agua.dibujarReflejo` dibuja **la misma** `escena` con otra
  cámara (actualiza `matrixWorld` a mano); `Vegetacion` hornea impostores con su
  **propia** escena; `captura.js` pasa por el compositor (la escena principal);
  `Personaje.js:190` tiene **otro** `WebGLRenderer`. Ninguno pone
  `onBeforeRender` en ninguna escena hoy.
- Ningún material de `src/` reemplaza `lights_fragment_begin`: Vegetación y
  Sotobosque agregan después de `lights_fragment_end` y lo conservan; Terreno
  toca `normal_fragment_begin`. No hay `ShaderMaterial` con `lights: true`.
- Luces puntuales de three en `src/`: `Hornos.js:68` (una por horno) y
  `Clima.js:262` (el incendio). Nada más.

Hallazgos que el encargo no traía:

1. **El candil en la mano diría «trabajás en nivel 3».** `Equipo.nivel` devuelve
   el `nivel` del objeto en la mano, y el candil declara nivel 3 (es el nivel del
   árbol, no un filo). Hoy no se nota porque el candil no tiene ranura; con
   `ranura: "mano"` aparecería en el encabezado del bolso. Único consumidor de
   `equipo.nivel`: `Bolso.js:185`.
2. **`Caza._tiro()` (`Caza.js:268`) desgasta lo que está en la MANO al tirar con
   el ARMA.** Con una antorcha en la mano (durabilidad 1), un flechazo la dejaría
   gastada ardiendo. `Caza.js` no es mío: se protege desde `Equipo.desgastar()`
   (una luz se consume con el reloj, no a golpes) y se avisa en el informe.
3. **La brasa del incendio no alumbraba casi nada.** Luz física con decaimiento
   2: con intensidad máxima 31, a 12 m (el suelo bajo el humo) daba 0,21 y a
   25 m 0,05. La frase del comentario —«el frente se ve como una línea naranja en
   la ladera»— no la cumplía.
4. **A velocidad normal (72×) la antorcha dura 75 s reales**; el candil, 5 min;
   una vela, 4 min 10 s. Es lo que manda el contrato (reloj del mundo). Con T al
   máximo (7200×) la antorcha dura 0,75 s. Queda anotado para el dueño.
5. **Apagar sin cobrar deja la antorcha eterna.** Si `apagar()` no guarda lo que
   quedaba, prender-apagar-prender da hora y media nueva cada vez.

## Hecho

### 1 · `src/engine/Luces.js` (nuevo) — terminado
(Líneas al cierre de la fase; la sección de la corrección del CSM de abajo
cambió `instalarLuces`.)
- `MAX_LUCES = 2` (`:41`). `instalarLuces(THREE)` (`:133`): agrega la
  declaración (`:57`) al final de `lights_pars_begin` y el bloque (`:72`) al
  final de `lights_fragment_begin`; pone `uLucesPos`/`uLucesColor` con los
  MISMOS dos `Float32Array(8)` en `standard, physical, lambert, phong, toon`.
  Idempotente: detecta el bloque por el texto y devuelve la misma instancia
  (un `WeakMap` por `ShaderChunk`).
- El bloque es el del jefe letra por letra, con `MAX_LUCES` interpolado en vez
  del 2. No se tocó la caída ni el tono: ninguna operación más por fragmento.
- `class Luces` (`:166`): `asignar` (`:225`) elige sin reservar memoria —mano
  primero, después por distancia, descarta a más de radio+60 m y las de
  intensidad 0—, guarda en espacio de mundo y NO escribe los uniformes.
  `escribir(camara)` (`:283`) pasa a espacio de vista con
  `camara.matrixWorldInverse` (la misma que three sube como `viewMatrix`),
  pone en cero lo que sobra y la cantidad en `colores[3]`. `enganchar` (`:317`)
  pone los dos ganchos (encadena uno previo ajeno si lo hubiera; no se encadena
  consigo mismo si se llama dos veces). `get activas`.
- Agregados fuera del contrato, sin romperlo, para que `main.js` no tenga
  lógica propia sin probar: `radioDeLuzEn(fuentes, pos)` (`:359`), la cuenta del
  `luzM`; `LLAMAS` (`:389`), color/intensidad/parpadeo de antorcha (2,0 ±12 %),
  candil (1,2 ±6 %) y vela (0,9 ±4 %), en lineal como `THREE.Color`; y
  `fuenteDeMano(luz, jugador, camara, t)` (`:408`), que arma la fuente de la mano
  desde `Equipo.luzActiva()` y `posicionDeMano()`.
- `posicionDeMano(jugador, camara, salida)` (`:446`): primera persona desde la
  cámara (trae estatura, agachado y balanceo), tercera desde el cuerpo; mismo
  punto con el jugador quieto. 1,12 m de alto, 0,30 a la derecha, 0,32 adelante
  del eje. Acepta `Vector3` o `{x,y,z}`.
- El módulo no importa three: recibe el espacio de nombres y hace la matriz a
  mano. Así se prueba en Node con objetos planos.
- **Cómo se comprobó:** `.tmp-lumbre/prueba-luces.mjs`, 62 comprobaciones, todo
  ok: idempotencia, arreglos compartidos después de `UniformsUtils.clone` en los
  cinco, includes resueltos a mano en los cuatro sombreadores (declaración
  antes de `main`, bloque después de `geometryPosition = - vViewPosition` y de
  `ReflectedLight reflectedLight = ReflectedLight(`), espacio de vista contra
  `Vector3.applyMatrix4`, cámara del espejo, vuelta a cero, selección.
  `lint-shader.mjs src/engine/Luces.js`: ok.
- **Ojo con el lint:** la cabecera de uniformes sola tenía una única marca
  (`uniform vec4`) y `lint-shader` no la tomaba como GLSL, así que decía que
  `uLucesPos` se usaba sin declarar. El comentario de formato que tiene ahora es
  GLSL de verdad (`vec4( … )`) y le da la segunda marca. Es un hueco del lint:
  una cabecera de uniformes de una sola clase no cuenta.

### 2 · `src/world/Hornos.js` — terminado
- Sin luz de three. Constantes de la brasa `:28-32` con los números de la luz
  vieja: color `0xff7a2e`, 14 m, altura 0,6, latido 2,6 ± 0,5 a 7,3 rad/s y el
  mismo suavizado de 0,15 por cuadro (`actualizar`, `:95`).
- `agregar` guarda `intensidad` en la pieza (`:85`), encendida de entrada si el
  horno ya arde (lo que pedía el comentario de `Partida._reponerHornos`).
- `fuentesDeLuz()` (`:111`): un arreglo NUEVO por llamada (uno reusado le cambia
  el contenido a quien lo guardó), sólo los que `ardiendo`. Color =
  `THREE.Color(0xff7a2e)` en espacio lineal, que es lo que recibía el sombreador
  con la luz vieja. Mientras arde la intensidad no baja de 2,1 (el valle del
  latido): si no, una fogata recién prendida tarda medio segundo en dar luz.
- **Decisión:** un horno que se apaga deja de alumbrar en el acto; la luz vieja
  se desvanecía en ~0,3 s. «Las que arden» es literal en el contrato y un
  apagado con intensidad residual competiría por un lugar.
- **Cómo se comprobó:** `.tmp-lumbre/prueba-mundo.mjs` — sin luces en el grupo,
  sólo el que arde, radio/altura/color, arranque sin negro, latido medido
  2,10..3,00 en 600 cuadros, apagados → 0, el arreglo anterior no cambia.

### 3 · `src/world/Clima.js` — terminado
- La luz del incendio salió del grafo (`_crearHumo`, `:285`). Constantes del
  resplandor `:44-48`, con el porqué medido en el comentario (la luz vieja daba
  0,21 a 12 m y 0,05 a 25 m: no alumbraba).
- `fuenteDeLuz()` (`:299`) → null o `{x, y: suelo+12, z, radio 35→80, color
  0xff5a1e, intensidad 2→6}` según la intensidad del evento. `_humo` guarda
  `_fuego` (`:426`) y lo borra cuando no hay incendio (`:419`).
- Se tiñe la base de la columna de humo (`:444`): `lerpColors` del gris de
  siempre al naranja con `(1-t)³`, hasta 55 %. Es un uniforme que ya existía.
- **Decisión (a mirar en la captura):** radio 35–80 e intensidad 2–6 se eligieron
  sin imagen, contra la zona de daño de `Eventos.golpear` (90 m). Tres
  constantes arriba del archivo.
- **Cómo se comprobó:** `prueba-mundo.mjs` con un `document` falso — sin luces en
  la escena, null sin incendio, radio/intensidad a 1 y a 0,2, tinte distinto por
  capa (`d6735e … 8f8b84`, la de arriba queda en el gris original), null al
  terminar y con intensidad 0. Y `grep PointLight|SpotLight src/` → 0.

### CORRECCIÓN DEL JEFE (11/9, en medio de la fase): `instalarLuces` va DESPUÉS de `new CSM()`
- El contrato decía «antes de construir cualquier material». Mal: `CSM.js:50`
  llama a `injectInclude()` en el constructor y `:248-249` REEMPLAZA
  `lights_fragment_begin` y `lights_pars_begin` por los de `CSMShader.js`, que
  copió el chunk de three **al importarse el módulo**. Instalar antes = bloque
  borrado, luz en ningún píxel, sin error. Lo vio el jefe en el chunk vivo.
- Leído yo en `node_modules/three/examples/jsm/csm/`: es así. `CSMShader.js:5-6`
  declara `geometryPosition`/`geometryNormal` igual que three. Único
  `new CSM` de `src/`: `main.js:143`. No hay ningún render ni `compile` entre
  `main.js:143` y `new Vegetacion` (`:211`, que hornea impostores).
- Cambios en `Luces.js`:
  - `instalarLuces` (`:133`) ya no corta con la instancia cacheada: siempre
    revisa los chunks (`ponerBloque`, `:96`), repone lo que falte sin duplicar,
    devuelve la misma instancia y, si tuvo que reponer en una segunda llamada,
    `console.warn` explicando el porqué.
  - `luces.instalada` (`:192`) y `luces.verificar()` (`:202`): mira los chunks
    vivos y avisa UNA vez si falta el bloque. No lo repone solo (a esa altura
    puede haber programas compilados sin él, y arreglar la mitad confunde).
  - El primer `onBeforeRender` de la escena enganchada llama a `verificar()` una
    vez: un cableado en el orden equivocado grita en consola en el primer cuadro.
- **Cómo se comprobó:** `.tmp-lumbre/prueba-csm.mjs` con un `new CSM` real en
  Node: CSM → instalar → los cuatro sombreadores resueltos tienen declaración de
  CSM, la nuestra, `main`, `reflectedLight`, `geometryPosition`, el código de
  cascadas y recién después el bloque, una vez; el primer render no avisa. Un
  segundo `new CSM` borra el bloque → `verificar()` false y un solo aviso →
  `instalarLuces` otra vez lo repone con la misma instancia → una tercera no
  duplica ni avisa. `prueba-luces.mjs` y el lint siguen en verde.

### 4 · `src/systems/Equipo.js` — terminado
- `encender(id, fechaMs)` (`:249`) → `{ok, motivo}`. Lee radio y duración de la
  ficha (`efecto.luz`, `efecto.duracionHoras`). Una ficha con `produce` (las
  velas) gasta una unidad de lo que produce; las demás tienen que estar hechas,
  sanas y ser de mano, y quedan en la mano. Cobra primero una llama vencida
  (sin eso, volver a prender la misma antorcha pasaba la revisión y quedaba
  gastada ya encendida: lo encontré releyendo). Prender lo mismo que ya arde no
  gasta otra vela.
- `apagar(fechaMs?)` (`:303`); `luzActiva(fechaMs, est?)` (`:323`) → null o
  `{id, radio, horasRestantes}`; consume, detecta la mano cambiada y la lluvia.
  `get encendida` (`:232`) mira sin cobrar, para la interfaz.
- `_terminar` (`:371`) decide el cobro en un solo lugar: si no quedaba nada,
  se consumió y se cobra (antorcha 1→0, candil −1) aunque se esté apagando por
  otro motivo —si no, cambiar de mano justo antes del final regalaba una
  antorcha—; si quedaba, antorcha y candil lo guardan en `_resto` (`:76`).
- Lluvia: `APAGA_CON_LLUVIA = { antorcha: 0.6 }` (`:44`). La nota de la ficha
  queda verdadera, no se reescribe. No cobra: guarda lo que le quedaba.
- La mano: `equipar`/`desequipar` llaman a `_revisarMano` (`:359`) y la apagan
  en el acto; `luzActiva` lo vuelve a mirar por si alguien toca `puesto` a pelo.
  `guardar` (`:97`) no auto-equipa en la mano mientras hay una llama, y borra
  `_resto` (una antorcha nueva arde entera); `reparar` también.
- `alApagarse` (`:84`): `{id, motivo, titulo, detalle}` cuando se apaga sola
  (consumida, lluvia, mano). Apagar a mano no avisa.
- `serializar()` (`:425`) → `{taller: [[id, usos|null]], puesto, llama: {id,
  desde, hasta, mano} | null, resto}`. Los infinitos van como null a propósito.
  `reponer(datos)` (`:444`): descarta ids que el dataset ya no conoce, valida
  la ranura, recorta usos al tope; `reponer(undefined)` no toca nada y da false.
- **Dos cambios fuera de la luz, los dos para no romper con ella:**
  `get nivel` (`:139`) da 0 con una luz en la mano (el candil decía «nivel 3»);
  `desgastar` (`:200`) no gasta una luz (por el defecto de `Caza.js:268`).
- **Decisión: la vela ocupa la mano.** Prender una deja la mano sin herramienta
  (`puesto.mano = null`), y sacar otra cosa la apaga. Igual que la antorcha y el
  candil: con una llama en la mano no se hachea. La vela a medias no se guarda:
  se cobró entera al prenderla, que es lo que dice el contrato.
- **Decisión: apagar guarda lo que quedaba** (antorcha y candil). Sin eso la
  antorcha era eterna (hallazgo 5).
- **Cómo se comprobó:** `.tmp-lumbre/prueba-equipo.mjs` con el `herramientas.json`
  real y el `Inventario` real, 62 comprobaciones en verde: las tres luces, radio
  y horas, cobro al vencer, lluvia 0,59 / 0,6, retomar lo que quedaba, reparar da
  entera, la mano en las tres vías, vela que no se cobra dos veces, ida y vuelta
  por `JSON.stringify` con la llama a media hora, basura del dataset.

### 5 · `src/systems/Exploracion.js` — terminado
- `alcanceVisual(pos, est, luzM = this.luzM ?? 0)`: de noche el tope es
  `TOPE_NOCHE_CON_LUZ_M = 300` con `luzM > 0` y `TOPE_NOCHE_SIN_LUZ_M = 220` con 0
  (`:58-59`, con la tabla y la licencia arriba). De día `luzM` no entra en la
  cuenta. `this.luzM = 0` en el constructor.
- **Cómo se comprobó:** `.tmp-lumbre/prueba-exploracion.mjs` — 380 de día con y
  sin luz, 220/300 de noche, omisión que lee `this.luzM`, 0 explícito que le gana,
  piso de 90 con niebla, instancia sin constructor, y `revisar()` real de noche:
  5 celdas con luz, 1 sin luz. En verde.

#### PROBLEMA DEL CONTRATO — RESUELTO el 11/9 por decisión del jefe: 220 a oscuras, 300 con luz
- El jefe midió el `revisar()` real sobre 3000 posiciones y yo lo confirmé con
  una corrida (`.tmp-lumbre/medir-topes.mjs`, alcance forzado, 3000 posiciones).
  Los dos dan lo mismo:

  | tope | celdas | vecina ortogonal | diagonal |
  |---|---|---|---|
  | 120 m | 1 | 0 | 0 |
  | 220 m | 1 | 0 | 0 |
  | 256 m | 5 | 60 (apenas se ve) | 0 |
  | **300 m** | **5** | **104** | 0 |
  | 320 m | 5 | 119 | 0 |
  | 380 m (día) | 9 | ~151 | 75 |

- **Aplicado:** `Exploracion.js:58-59` → sin luz 220 (lo de siempre: la noche no
  se vuelve más dura para nadie), con luz 300 (se abre la cruz de las cuatro
  vecinas a 104, entre la oscuridad y el día). Comentario con la tabla y el
  motivo en `:24-57`. `revisar()` no se tocó: el día queda idéntico (medir desde
  la posición real lo habría bajado de 9 a 6,95).
- **Arrastrado a:** `herramientas.json` `luzNocturna.que` (`:2569`) y
  `estadoReal` (`:2574`) con la medición; `pendienteSinSistema[1]` (`:2454`);
  la línea de la licencia en `Bolso.js:249`; el comentario del parche 5 y la
  nota «Ojo» de `pendiente-r5-lumbre.md` (`:104`, `:115`), que iban a quedar
  pegados en `main.js` con los números viejos.
- `prueba-integracion.mjs` actualizada (220/300) y en verde; `r2-carta-exploracion`
  exit 0.

Lo que sigue es el registro de cómo se encontró, tal como estaba:

#### (histórico) PROBLEMA DEL CONTRATO: la mitad jugable, tal como está pedida, no cambia nada del mapa
- `alcanceVisual` sólo lo consume `revisar()` (`:150`), que mide la distancia
  **por índice de celda** —`Math.hypot(di, dj) * 256`—, no desde el jugador. De
  noche la única celda a menos de 120 y a menos de 220 es la que se pisa (d = 0);
  la vecina más cercana está a 256. La nitidez de esa celda es 255 en los dos
  casos.
- **Medido** (`.tmp-lumbre/medir-noche-celdas.mjs`, 2000 posiciones al azar con el
  `revisar()` real): **noche sin luz 1 celda, noche con luz 1 celda**, día 9.
- No lo cambié: el encargo pide no tocar lo que está mal del contrato por cuenta
  propia. La cifra que el jefe mide en `alcanceVisual` es correcta; lo que no
  existe es la consecuencia jugable.
- **Variante medida, NO aplicada:** que `revisar()` mida desde la posición real
  del jugador al centro de cada celda, con la celda propia siempre revelada.
  Noche: 1,00 celdas con 120 y **2,33 con 220**. Pero cambia también el día:
  9 → 6,95 celdas con 380 m. Si se quiere que la luz se note en el mapa, hay que
  decidir eso, o subir los topes (con 256 m por celda, un tope nocturno por
  debajo de 256 no revela nunca una vecina con la cuenta de hoy).

### 6 · `src/systems/Partida.js` — terminado
- `VERSION = 1` intacta (`:38`), con un párrafo en la cabecera de por qué agregar
  un campo no es cambiar la forma.
- `_serializar` guarda `equipo: this._equipo?.serializar?.() ?? null` (`:220`).
- `cargar` llama a `_reponerEquipo(d.equipo)` (`:336`) inmediatamente después de
  `_reponerHornos`, o sea con el reloj ya repuesto. `_reponerEquipo` (`:355`): sin
  campo no hace nada (partida vieja); si `reponer` tirara, avisa y sigue sin
  llevarse la partida entera.
- `get _equipo` (`:73`): `this.equipo ?? this.recoleccion?.equipo`. `main.js` hoy
  no le pasa `equipo` a la partida, pero sí a la recolección (`main.js:354`),
  así que el guardado funciona **aun antes** de aplicar el parche. El parche lo
  pasa igual, explícito.
- **Fuera de la luz, chico:** el constructor usa `globalThis.addEventListener` y
  `globalThis.document` (`:58`), igual que `Exploracion`. Antes reventaba al
  construirse en Node; ahora un banco no tiene que simular la ventana.
- **Regla de la muerte: sin tocar.** `registrarMuerte()` sigue vaciando sólo el
  inventario. Una antorcha encendida al morir sigue encendida al reaparecer: no
  lo decidí porque la regla es del dueño (deuda 8 de RONDA5).
- **Cómo se comprobó:** `.tmp-lumbre/prueba-partida.mjs` con `localStorage`
  falso, `Equipo` e `Inventario` reales: guardado con la antorcha a media hora
  → trae `equipo.llama.hasta` en fecha del mundo y `version: 1`; carga en una
  partida armada como `main.js` hoy (equipo sólo en `recoleccion`) → reloj,
  taller, puesto y la antorcha con 1 h justa; partida sin campo `equipo` carga;
  equipo basura carga el resto; sin equipo guarda null. En verde.

### 7 · `src/ui/Bolso.js` — terminado
- Acciones `encender` (`:161`) y `apagar` (`:172`) en el mismo manejador de clics.
  El aviso al prender dice radio y duración («Antorcha · alumbra 12 m / Dura 1,5 h
  del reloj del mundo»); si no prende, el `motivo` de `Equipo`.
- `_pintarEquipo` (`:200`): lo que arde va arriba de todo con «quedan 45 min» y
  **Apagar**; antorcha y candil sanos tienen **Encender** (que los pone en la
  mano; no llevan «Sacar», que sería un botón que hace la mitad); la fila de
  `vela` en Materiales tiene **Encender** (`:357`) mientras no haya una prendida.
  Debajo, la licencia en una línea (`:250`); la sección aparece también con sólo velas en el bolso (`:206`).
- `_fechaMs()` (`:259`): `this.tiempo ?? this.fabricacion.fundicion.tiempo`. El
  parche le pasa `tiempo` al bolso; mientras tanto el botón anda igual.
- `horas()` (`:80`): «1,5 h», «45 min».
- **Decisión de texto:** los mensajes van con dos puntos («Antorcha: se
  consumió», «Todavía no tenés candil de grasa») porque sin saber el género del
  objeto no hay artículo que no falle.
- **Cómo se comprobó:** `.tmp-lumbre/prueba-bolso.mjs` con un DOM mínimo y
  `Equipo`/`Inventario` reales, sin `tiempo` en las dependencias (como `main.js`
  hoy): botón que aparece, clic que prende con el reloj de la fundición, «quedan
  1,5 h» y a los 45 min «quedan 45 min», Apagar, velas que gastan una y aparecen
  arriba, motivo de lo que no se tiene. En verde.

### 8 · `src/data/herramientas.json` — terminado (sólo las entradas permitidas)
- `candil_grasa`: `"ranura": "mano"` (`:1356`), una línea en la `nota` (cada carga
  6 h, un uso de 40) y `notaRanura` (`:1381`) con el porqué, al estilo de
  `notaNivel`.
- `antorcha.nota` (`:1347`): se agrega «apagada antes de tiempo, guarda lo que le
  quedaba». Lo de la lluvia fuerte ya era verdad y quedó.
- `velas_cera.nota` (`:1885`): 5 h en la mano, se gasta entera al prenderla.
  `vela.nota` (`:244`): «Se prende desde el bolso».
- `pendienteSinSistema` (`:2453-2454`): la frase de la luz dice que estaba mal y
  qué hay ahora; la primera frase decía «sólo 2 de 18 tienen consumidor» y se
  recontó: **4 de 18** (abrigo, capacidadExtraKg, luz, duracionHoras). Se aclara
  que 9+4+2 suman 15 de 16 y que esa clasificación no se volvió a medir.
- `licenciasDeJuego.licencias` + `luzNocturna` (`:2568`): `que`, `laRealidad`
  (en vez de `laNormaReal`: no hay norma, hay fisiología), `porQueSeToma`,
  `comoLoDiceElJuego` (la línea del bolso), `queNOSeAfloja`, **`estadoReal`** con
  la medición de que hoy no se nota en el mapa, y una `nota` de que es la primera
  licencia sobre física y no sobre norma.
- **Cómo se comprobó:** el JSON parsea; `r4-economia.mjs` corrido contra el JSON de
  `HEAD` (copia con la ruta cambiada, en `.tmp-lumbre/`) y contra el nuevo da
  **salida idéntica** (50 hallazgos, `diff` vacío). Recuento de efectos con
  `.tmp-lumbre/contar-efectos.mjs`.

### 9 · `.claude/flota/pendiente-r5-lumbre.md` — terminado
Seis parches a `main.js` con el texto exacto y la línea de `b04a424` (verificadas
con `grep -n`): 1 import (`:51`); 2 `instalarLuces` + `enganchar` entre
`csm.fade = true` (`:153`) y `conCSM` (`:154`), **después del CSM** con el motivo;
3 `equipo.alApagarse → hud.aviso` (`:274`); 4 `tiempo` al bolso (`:378`) y
`equipo` a la partida (`:407`); 5 el bloque por cuadro entre `:892` y `:894`
(antes del espejo); 6 `luces` en `window.SurviBar` (`:923`). Más cómo comprobarlo
en la vista previa.

### 10 · Build — terminado
- `vite build` del árbol tal cual (a una carpeta del scratchpad, sin `public/`,
  para no pisar `dist/`): OK. Pero ese build no importa `Luces.js` todavía.
- `.tmp-lumbre/construir-con-parche.mjs`: copia `src/` e `index.html` al
  scratchpad, aplica los seis parches **con el texto de contexto exacto** (falla
  si alguno no aparece una sola vez), comprueba el orden `new CSM <
  instalarLuces < new Vegetacion` y construye: **BUILD CON PARCHE OK**, y el
  bundle contiene `uLucesPos`, `fuentesDeLuz`, `fuenteDeLuz`, `luzActiva`,
  `radioDeLuzEn`, `alApagarse`. `src/main.js` del proyecto sin tocar
  (`git diff --quiet`).
- De paso: `main.js` y los archivos editados están en CRLF en el árbol y LF en el
  índice (`autocrlf=true`); las ediciones no mezclaron finales de línea.

### 11 · Integración — terminado
`.tmp-lumbre/prueba-integracion.mjs`: CSM real, `instalarLuces`, `enganchar`,
`Clima`, `Hornos`, `Equipo`, `Exploracion` reales, y el bloque del parche 5 letra
por letra corriendo cuadro a cuadro a 72×: antorcha + fogata → 2 en el render y
0 después; con un incendio a 40 m siguen mano y fogata; sin antorcha, fogata e
incendio; lejos, 0 luces y 120 m; **la antorcha se consume sola en 75,0 s reales
(4498 cuadros)** y avisa; un aguacero la apaga en el cuadro. 12 en verde.

**Batería final** (todas en verde): `prueba-luces` 62, `prueba-csm` 12,
`prueba-mundo` 19, `prueba-equipo` 62, `prueba-exploracion` 11, `prueba-partida`
14, `prueba-bolso` 15, `prueba-integracion` 12. Bancos viejos que tocan estos
archivos: `r4-banco-cadena`, `r4-banco-fabricacion`, `r4-banco-arma`,
`r4-banco-saberes`, `r2-carta-exploracion` → exit 0. `lint-shader` sobre
`Luces.js` y `Clima.js` → ok. `r4-economia` → salida idéntica a la de `HEAD`.

## Siguiente (para el jefe; `lumbre` terminó su parte)

1. Aplicar `pendiente-r5-lumbre.md`. **Hasta aplicarlo, fogatas e incendio no
   alumbran**: las luces de three ya no están y el reemplazo no está cableado.
2. En la vista previa: `SurviBar.luces.instalada === true`; programas contados al
   prender/apagar la antorcha, construir y prender una fogata, disparar un
   incendio; los tres presupuestos de GPU; las tres capturas nocturnas.
3. Mirar en la captura y ajustar si hace falta: `LLAMAS` (`Luces.js`),
   `RESPLANDOR_*` (`Clima.js`). La brasa de los hornos es la vieja (`BRASA_*`),
   pero con otra caída: `(1-d²/r²)²` es más pareja que el cuadrado inverso, así
   que la fogata va a verse como un charco de luz más ancho que antes.
4. ~~Decidir la mitad jugable~~ — **resuelto:** 220 a oscuras, 300 con luz (ver
   «PROBLEMA DEL CONTRATO — RESUELTO»).
5. **Fuera de mi jurisdicción, para quien corresponda:** `Caza.js:268` desgasta
   la herramienta de la MANO al tirar con el ARMA (`this.equipo?.desgastar?.()`
   gasta `puesto.mano`). Tirar flechas gasta el hacha. `Equipo.desgastar` ahora
   protege las luces, pero el defecto sigue para todo lo demás.
6. Regla de la muerte con una llama encendida: sigue encendida al reaparecer. Es
   parte de la deuda 8 (del dueño).
8. `herramientas.json` (el candil ya tiene `ranura: "mano"`; falta la licencia,
   `pendienteSinSistema` y las notas) · 9. pendiente de main.js

## Descartado

- **Tintar la niebla desde `Clima` por el incendio.** El color de la niebla lo
  escribe `main.js:784` desde el cielo en cada cuadro, justo antes de
  `clima.actualizar`. Que `Clima` lo pise sería un segundo dueño escondido de un
  valor que es de `main.js`. Alcanza con el humo y la luz.
- **Cambiar la caída del bloque** a algo más parecido al cuadrado inverso: suma
  una división o una multiplicación por fragmento, y el jefe pidió cero ALU.
- **Un arreglo de fuentes reusado en `Hornos.fuentesDeLuz`**: ahorra un puñado
  de objetos por cuadro y rompe a cualquiera que guarde el resultado.
- **Que `verificar()` reponga el bloque sola en el primer render.** A esa altura
  el horneado de impostores ya compiló programas sin el bloque y three los
  reusa por `shaderID`: quedaría la mitad de la escena iluminada y la otra no,
  que confunde más que nada iluminado con un aviso claro. Reponer es volver a
  llamar a `instalarLuces(THREE)`, a propósito.
- **Cambiar `Exploracion.revisar()` para que la luz se note en el mapa.** Es mi
  archivo, pero cambia también el día (9 → 6,95 celdas) y el contrato pedía la
  licencia en `alcanceVisual`. Se mide, se propone y decide el jefe.
- **Bloquear `encender('antorcha')` si la última lluvia vista era ≥ 0,6.** Sería
  un estado escondido en `Equipo` que un banco puede pisar sin saberlo; así como
  está, prende y el cuadro siguiente la apaga con aviso, que es honesto.
- **Cobrar la antorcha entera al apagarla a mano.** Resolvía el exploit sin
  llevar la fecha, pero cambiar de mano por error tiraba la antorcha. Se guarda
  lo que quedaba.
- **Que la vela no ocupe la mano.** Habría dejado hachear con una vela en la otra
  mano y a la antorcha y al candil desplazando herramientas: dos reglas para lo
  mismo.
