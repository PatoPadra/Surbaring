# Bitácora — agente ui

Se actualiza a cada paso, no al final. Si esto se corta, retomar desde acá sin
repetir la recorrida de paneles.

## 1. Diagnóstico

Recorrida por lectura de código (leí HUD.js, Codice.js, Bolso.js, Mapa.js,
Taller.js, Norma.js, Opciones.js, Fin.js, Cierre.js, Personaje.js, index.html
y main.js sólo en los tramos de arranque/teclado). Panel del navegador no
compone cuadros (confirmado por CONTEXTO.md), así que no verifico con
capturas del HUD — no existen capturas de la interfaz porque `capturar()`
sólo lee el framebuffer WebGL, y el HUD es DOM encima: no sale en la foto.
Verifico leyendo CSS/JS con cuidado y razonando contraste de color a mano.

Hallazgos, panel por panel:

- **`index.html` — brújula (`#brujula .marca`, `.aguja`)**: es el único
  elemento del HUD que va directo sobre el lienzo sin fondo propio (los demás
  paneles tienen `.panel` con fondo oscuro + blur). No tenía `text-shadow` ni
  `box-shadow`. Contra el cielo lavado a blanco del mediodía (ver
  `capturas/base-alta-bosque.png`), un texto casi blanco sin sombra se funde
  con el fondo. Bug real, confirmado por lectura de CSS, no por captura.
- **`HUD.js` — barras vitales críticas**: `b.barra.style.opacity = v < 22 ?
  '0.55' : '1'` — al entrar en zona crítica la barra se ponía MÁS
  transparente, exactamente lo contrario de lo que hace falta. Contradice
  directamente lo que pide el brief ("¿se nota cuando algo entra en zona
  crítica?"). Bug real, no ambigüedad de diseño.
- **`HUD.js` — `#accion` y `#termico`**: mismo problema que la brújula pero
  más leve: tenían un solo `text-shadow` difuso (`0 2px 10px #000`), sin capa
  angosta que dibuje el borde. Reforzado a dos capas, mismo patrón que se usó
  en la brújula.
- **`Codice.js`**: sin buscador y sin ningún indicador de progreso en la nav
  (sólo el header mostraba especies/lugares totales, no por pestaña). El
  brief marca esto como más valioso que cualquier retoque estético. Las
  fichas ya distinguen bien "oculta / avistada / identificada" — ESO ya
  estaba resuelto, no hacía falta tocarlo.
- **`Entrada.js` (motor, NO es mío)**: escucha `keydown` en `window` sin
  mirar el foco ni si hay un panel abierto. Hoy no importaba porque ningún
  panel tenía `<input type=text>`. Al agregar el buscador del Códice esto se
  vuelve un problema real: escribir "g" cerraría el Taller, "tab" cerraría el
  propio Códice, etc. Lo resolví DENTRO de mi territorio (Codice.js) cortando
  `stopPropagation` en el input, sin tocar Entrada.js. Documentado en el
  código con el porqué.
- **Bolso, Mapa, Taller, Norma, Fin, Cierre, Opciones, Personaje**: revisados
  enteros. Todos cierran con Escape (cascada centralizada en `main.js` línea
  ~573-582, que no es mía), todos tienen texto claro, ninguno cruza la
  pantalla sin `max-width`/`overflow`. No encontré bugs de legibilidad ahí.
  Son paneles ya muy trabajados — no necesitan intervención.
- **Bienvenida al arrancar** (`main.js` líneas 613-622, NO es mío): el aviso
  de 9 s para quien vuelve a jugar lista 17 teclas de un tirón
  ("Clic para mirar · F1 para los controles · E recolecta e identifica · Q
  come · Tab abre el códice · G el taller · M el mapa"). El brief lo señala
  explícitamente como una lista que nadie retiene. No puedo tocar main.js:
  dejo el parche exacto en `pendiente-ui.md` para que el coordinador lo
  aplique. La idea: confiar en `HUD.mostrarAccion()` (que ya avisa "E ·
  Recolectar" parado frente a algo) para enseñar el resto en el momento, y
  reducir el aviso genérico a lo mínimo imprescindible.

## 2. Hecho

- `index.html`: agregada sombra de texto en dos capas a `#brujula .marca` y
  `.marca.card`, y `box-shadow` a `.aguja`. Verificado leyendo los valores de
  color (`--tinta` #e8e4dc, `--tinta-tenue` #a49e93) contra fondo blanco: sin
  sombra, contraste casi nulo; con sombra oscura de borde, legible.
- `index.html`: agregada clase `.vital.critico` con animación de pulso
  (`@keyframes vitalCritico`, opacity 1↔0.5 + brightness) y color de aviso en
  el número, en vez del `opacity: 0.55` fijo de antes.
- `src/ui/HUD.js`: `_construirVitales()` ahora guarda referencia a `.vital`
  (el contenedor, no sólo la barra `<i>`). `actualizar()` cambia
  `b.barra.style.opacity = ...` por `b.vital.classList.toggle('critico', v <
  22)`. Mismo umbral que antes (22), sólo cambia el efecto.
- `src/ui/HUD.js`: reforzado `text-shadow` de `#accion` y `#termico` a dos
  capas (borde angosto + halo ancho), mismo criterio que la brújula.
- `src/ui/Codice.js`:
  - Nuevo `<input id="cx-q" type="search">` bajo la nav, con placeholder
    "Buscar en esta sección…".
  - `this.filtro` en el constructor, persiste entre pestañas.
  - `_aplicarFiltro()`: filtra por `textContent` normalizado (sin tildes,
    minúsculas) sobre `.cx-ficha, .cx-linea, .cx-saber, .cx-topo` ya
    pintados — no reconstruye HTML, así no pierde el foco del input. Muestra
    "Nada con «X» en esta sección" cuando no hay resultados.
  - Se llama desde el evento `input` del buscador y al final de `_pintar()`
    (así el filtro sobrevive a un cambio de pestaña).
  - Blindaje de teclado: `keydown`/`keyup` del input cortan
    `stopPropagation()` para no disparar los atajos globales de juego
    (E, G, M, Tab, etc. — ver diagnóstico sobre Entrada.js). Caso especial
    Escape: si hay texto, lo limpia y no deja subir el evento (no cierra el
    panel); si ya está vacío, deja subir y cierra como siempre.
  - Nueva función top-level `normaliza()` (normaliza tildes + minúsculas),
    reutilizable.
  - **Pendiente en este mismo paso**: agregar `<small class="cx-cnt">` con
    conteo (ej. "4/23") a los botones de nav de fauna/flora/geografía/
    historia/saberes, actualizado desde `_actualizarCuenta()`. Ya agregué el
    marcado HTML de los `<small>` vacíos en la nav; falta escribir la lógica
    que los llena. CSS de `.cx-cnt`, `.cx-buscar`, `.cx-filtro-oculto`,
    `.cx-buscar-vacio` en el bloque `CSS` del archivo: **todavía no
    agregado** (el HTML ya referencia esas clases, pero el CSS no está
    escrito — sin esto el buscador se ve sin estilo, aunque funciona).

## 3. Verificado (lo que esta bitacora nunca alcanzo a hacer)

Al retomar, **lo escrito estaba completo**: los conteos de `_actualizarCuenta()`
y el bloque CSS que esta bitacora daba por pendientes ya estaban en el archivo.
El agente los escribio y no llego a anotarlo antes de que lo cortara el limite.
Lo que faltaba de verdad era comprobar que todo eso funcionara.

Comprobado en el juego corriendo, con el Codice abierto:

| | |
|---|---|
| buscador presente, `type="search"`, con su placeholder | si |
| conteos en la nav | **fauna 0/61 · flora 0/63 · geografia 0/41 · historia 0/32 · saberes 0/48** |
| CSS vivo | `.cx-filtro-oculto` → `display:none`; `.cx-cnt` opacidad 0,62; padding del buscador aplicado |

Los cinco conteos estan llenos, incluidos historia y saberes, que esta bitacora
daba por opcionales.

### El filtro filtra, y discrimina

| busqueda | fichas visibles | mensaje |
|---|---|---|
| (vacio) | 61 de 61 | — |
| `descubrir` | **61 de 61** | — |
| `guanaco` | **0 de 61** | «Nada con «guanaco» en esta seccion.» |

Que `guanaco` no encuentre nada **es correcto y deliberado**: sin identificar,
la ficha en pantalla dice "Sin descubrir" y el nombre real no esta en el
marcado. No se puede buscar lo que todavia no se sabe. Sin el caso `descubrir`
—que muestra las 61— este cero pareceria un filtro roto.

### El blindaje de teclado, con teclas de verdad

Escribiendo `guanaco` dentro del buscador, con pulsaciones reales del navegador:

| | |
|---|---|
| texto que llego al campo | `guanaco` |
| Taller abierto por la `g` | **no** |
| Mapa / Bolso / Opciones | **no** |
| Codice seguia abierto | si |
| teclas retenidas en `entrada.teclas` | **ninguna** |

Y con eventos despachados, las cuatro reglas del panel:

1. Escape con texto → limpia el campo y **no** cierra. ✔
2. Escape con el campo vacio → sube y **cierra** el codice. ✔
3. `G`, `M`, `I`, `Tab`, `E`, `Q` dentro del buscador → no abren nada. ✔
4. **La misma `M` fuera del campo → abre el mapa.** ✔

El cuarto es el control que importa: prueba que el blindaje es puntual y no un
bloqueo general que romperia el juego.

### Las vitales criticas

| salud | clase | animacion de la barra | color del numero |
|---|---|---|---|
| 60 | `vital` | ninguna | gris `rgb(164,158,147)` |
| **12** | `vital critico` | **`vitalCritico` 1,15 s** | **naranja `rgb(232,131,111)`** |
| 99 (recuperado) | `vital` | ninguna | gris |

Antes la barra critica se ponia **mas transparente** (`opacity: 0.55`), o sea lo
contrario de lo que hace falta. Ahora pulsa y el numero cambia de color.

### La brujula y los avisos sobre el lienzo

Sombra de dos capas confirmada en los tres: `#brujula .marca`, `#accion` y
`#termico` dan `rgba(0,0,0,.95) 0 1px 2px, rgba(0,0,0,.8) 0 0 8px`, y la aguja
lleva `box-shadow`. Es lo que los despega del cielo lavado del mediodia, que es
el unico fondo contra el que se fundian.

## 4. Lo que hizo el coordinador, fuera del territorio de `ui`

Dos cosas que esta bitacora diagnostico y escalo correctamente:

- **`src/engine/Entrada.js` ahora respeta el foco.** Escuchaba `keydown` en
  `window` sin mirar quien lo tenia. `Codice.js` lo tapo por su lado con
  `stopPropagation`, que funciona, pero dejaba **la trampa armada para el
  proximo panel que estrenara un campo de texto**. El arreglo de raiz es una
  guarda: si el foco esta en un `input`, `textarea`, `select` o algo editable,
  el teclado no es del juego. Ademas suelta las teclas retenidas, porque si uno
  estaba caminando y hace clic en el buscador, el `keyup` de la W nunca llega y
  el jugador sigue caminando solo para siempre.
- **El aviso de bienvenida de `main.js`.** Listaba seis teclas de un tiron
  («Clic para mirar · F1 para los controles · E recolecta e identifica · Q come
  · Tab abre el codice · G el taller · M el mapa»). Quedo en **«Clic para
  mirar» / «F1 muestra todos los controles»**: lo unico que no se puede deducir,
  y donde esta el resto cuando se lo busque. Lo demas lo enseña
  `hud.mostrarAccion()` parado enfrente de la mata —se lo ve funcionando en la
  captura, «E · Juntar piedra suelta»—, que es cuando se aprende.

## 5. Trampas de medicion pagadas aca

- **La tecla Escape de la herramienta del navegador no llega a la pagina.** Una
  sonda en fase de captura sobre `window` no vio el evento ni con el foco en el
  campo ni fuera de el. Parecia que el segundo Escape no cerraba el panel y el
  codigo estaba bien: hay que ejercitar esa logica con eventos despachados.
- **`getComputedStyle` sobre el elemento equivocado.** La animacion critica vive
  en `.vital.critico .pista i`, no en `.vital.critico`: medir el contenedor daba
  `animation: none` y parecia que el pulso no corria.
- **El panel no compone con viewport emulado.** A 1280x720 la escena se dibuja
  en una esquina. Las capturas del HUD sirven para mirar, no para medir; para
  medir, `getComputedStyle` y `classList`.

## 4. Descartado

- Filtrar los datos ANTES de pintar (por especie/lugar) en vez de filtrar el
  HTML ya renderizado: se descartó porque cada `_pintarX()` tiene forma
  distinta (fauna/flora son arrays planos, historia agrupa por era, saberes
  por era también) y hubiera significado tocar las seis funciones de pintado.
  Filtrar el DOM ya pintado por `textContent` es una sola función, más barato
  y con el efecto colateral correcto: una especie "Sin descubrir" no tiene su
  nombre real en el marcado, así que buscarlo no la encuentra — no hace falta
  lógica aparte para no filtrar datos.
- Foco en el buscador con la tecla `/`: se consideró pero no se implementó
  todavía (no descartado del todo, es un lindo remate si sobra tiempo — no
  crítico).
- Tocar `src/engine/Entrada.js` para que respete `document.activeElement`:
  sería la solución "correcta" al problema de raíz (cualquier futuro input de
  texto en cualquier panel choca con esto), pero ese archivo no es mío. Lo
  resolví localmente en Codice.js con `stopPropagation`. Si otro agente
  agrega un input de texto en su propio panel, va a pisar el mismo problema:
  vale la pena que el coordinador lo sepa (va en el informe final).
