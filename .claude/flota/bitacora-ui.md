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

## 3. Siguiente

1. En `src/ui/Codice.js`, método `_actualizarCuenta()`: agregar cálculo y
   escritura de conteos por pestaña en los `<small class="cx-cnt">` de la
   nav (fauna, flora, geografía ya tienen el `<small>` en el HTML; historia y
   saberes también). Patrón:
   ```js
   const setCnt = (p, txt) => {
     const el = this.el?.querySelector(`nav button[data-p="${p}"] .cx-cnt`);
     if (el) el.textContent = txt;
   };
   setCnt('fauna', `${this.fauna.especies.filter(e => this.identificadas.has(e.id)).length}/${this.fauna.especies.length}`);
   setCnt('flora', `${this.flora.especies.filter(e => this.identificadas.has(e.id)).length}/${this.flora.especies.length}`);
   setCnt('geografia', `${this.lugares.size}/${this.listaLugares.length}`);
   ```
   Historia y saberes son más caros de calcular (requieren `_eventosDesbloqueados()`
   y `this.saberes.resumen()`); si el tiempo aprieta, dejarlos sin conteo (ya
   tienen el `<small>` vacío en el HTML, no rompe nada) y sacar esos dos
   `<small>` del markup si se decide no completarlos.
2. Agregar al bloque `const CSS = \`...\`` al final de Codice.js:
   - `.cx-cnt` (número chico junto al nombre de la pestaña, atenuado)
   - `.cx-buscar` (el contenedor del input, padding acorde al resto del panel)
   - `.cx-buscar input` + `:focus` + `::placeholder`
   - `.cx-filtro-oculto { display: none !important; }`
   - `.cx-buscar-vacio` (mensaje centrado, itálica, atenuado — mismo tono que
     `.cx-vacio` de Bolso.js si sirve de referencia visual)
3. Abrir el juego en una pestaña propia (`tabs_create` + `navigate` a
   `http://127.0.0.1:5174/`, prefijo de capturas `ui-` si hiciera falta,
   aunque las capturas del HUD no van a salir por el problema conocido —
   usar `read_page`/`get_page_text`/`find` en cambio) y con `read_page`
   comprobar: que el `<input>` de búsqueda existe y tiene el placeholder
   correcto, que escribir en él no dispara acciones de juego (revisar que
   Tab/Taller/Mapa sigan cerrados), que los `<small class="cx-cnt">` muestran
   números una vez identificada alguna especie.
4. Escribir el parche de `main.js` (líneas 619-622, la bienvenida) en
   `.claude/flota/pendiente-ui.md`, con el texto viejo y el nuevo — todavía
   no escrito, sólo diagnosticado. Ver la propuesta completa en la sección
   Diagnóstico de esta bitácora.
5. Terminar con el informe final en el formato de `CONTEXTO.md` (5 puntos).

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
