# Ronda 9 — contratos por fase

Arranca sobre `main` el 28/9/2026, rama `mejoras/ronda9-bandeja`. El origen de cada
fase y el orden elegido están en `ESTADO.md` y `RONDA9-ARRANQUE.md`.

---

## FASE 1 · `iconos` — empaquetar la hoja para bajarla de 137,8 kB

### El problema, medido antes de escribir el contrato

`node .claude/flota/banco-r6-fase3.mjs` da hoy: **137,8 kB de 140** para 122 íconos
(1156 bytes cada uno de promedio). Con dos dibujos más se pone rojo, y le va a aparecer
al primer agente que agregue un ícono como si fuera culpa suya.

`hoja()` en `src/ui/Iconos.js` arma un `data:image/svg+xml,...` **completo y aparte por
cada ícono** (`arteDe` → `envolver` → `aUri`), como fondo de una clase CSS distinta.
Cada uno paga su propio `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
stroke-linecap="round" stroke-linejoin="round">…</svg>`: **121 bytes ya codificados,
repetidos 123 veces** (122 íconos + el de reserva) sólo de envoltorio, antes de una sola
línea de dibujo. Medido: eso son **~14,9 kB de puro envoltorio duplicado**, el 11 % de
la hoja entera.

**Se probaron dos caminos alternativos y los dos midieron peor de lo que parecían:**

- Sacar `xmlns` del envoltorio (ahorraría ~4,3 kB): **probado en el navegador real y NO
  funciona** — sin `xmlns`, el `data:image/svg+xml` puesto como `background-image` no
  carga (`Image` con `onerror`, y en pantalla no aparece nada). `xmlns` es obligatorio
  para este uso exacto. **No lo intentes de nuevo sin volver a medirlo.**
- Agrupar colores repetidos dentro de un mismo ícono en una clase local (`<style>.a{fill:…}`):
  la técnica **sí renderiza** (probado), pero medido con números reales sólo ahorra
  cuando un mismo color se repite 3 veces o más dentro del mismo ícono, y así y todo el
  ahorro total simulado es de **apenas ~1,6 kB en 64 de los 122 íconos** — el costo fijo
  de declarar la regla se come casi toda la ganancia. **No alcanza solo.**

**Lo que sí mide bien: una sola hoja combinada (sprite), con un `<svg>` por toda la
hoja y un `<g transform="translate(x,y)">` por ícono, y cada clase CSS eligiendo su
celda con `background-position` en vez de traer su propio `data:` URI.** Simulado con
los 122 dibujos reales en una grilla de 12×11: **hoja completa (`background-image` +
las 123 reglas de posición) ≈ 128,6 kB**, contra 137,8 hoy — **~9,2 kB de ahorro real**,
sin tocar un solo dibujo. Probado en el navegador con 4 figuras de colores distintos en
grilla 2×2, a los dos tamaños reales de uso (79 px en `.bp-cs > .ic` de `Bolso.js`, y
2,3 rem ≈ 34-37 px en `.bp-det-ic`, los dos **cuadrados**): **sin sangrado entre celdas
y sin desplazamiento visible** en ninguno de los dos tamaños.

**Es una decisión de la flota, y ya está tomada: la hoja pasa a ser un sprite.**

### El contrato

- **C1 — Misma API, mismo comportamiento externo.** `hoja()`, `inyectar()`, `arteDe()`,
  `claseDe()`, `IDS`, `CLASE_BASE`, `CLASE_RESERVA`, `MATERIAS` mantienen firma y
  comportamiento. Ningún archivo fuera de `src/ui/Iconos.js` cambia (`Bolso.js`,
  `Taller.js`, `Codice.js`, `HUD.js`, `Mapa.js`, etc. quedan intactos: siguen pidiendo
  la clase con `claseDe(id)` como hoy).
- **C2 — La hoja pesa 132 kB o menos.** `Buffer.byteLength(hoja(), 'utf8') <= 132*1024`.
  (Medido que 128,6 kB es alcanzable; 132 deja margen de implementación real.)
- **C3 — Cada ícono se ve igual.** Renderizado en el navegador a los dos tamaños reales
  de uso (79 px y ~35 px, cuadrados), la imagen resultante de la hoja NUEVA es
  indistinguible en píxeles de la hoja VIEJA (comprada contra la instantánea guardada en
  `.claude/flota/base-r9/Iconos.js`) para una muestra amplia de íconos, **sin bordes de
  la celda vecina visibles** (sangrado) y **sin recorte** del dibujo.
- **C4 — El ícono de reserva (`ic-x`) se ve igual**, incluida su selección por `claseDe`
  para un id sin receta.
- **C5 — La hoja se arma una sola vez y queda cacheada** (igual que hoy: `_hoja` no
  se reconstruye en llamadas siguientes a `hoja()`).
- **C6 — El costo de armar la hoja la primera vez no empeora de forma relevante** contra
  la base (hoy: "unos pocos milisegundos").
- **C7 — Sin regresión:** `banco-r6-fase3.mjs` sigue en verde (su propio techo de 140 kB
  sigue cumplido, con más margen que antes).
- **C8 — `vite build` limpio.**

### Lo que NO pide este contrato

- No pide bajar el peso de ningún dibujo individual — el problema es el empaquetado, no
  el arte (ver `RONDA9-ARRANQUE.md`, punto 1).
- No pide una hoja de contacto nueva ni tocar la paleta.
- No pide raster: la hoja sigue siendo vectorial (SVG), un solo `<svg>` con todos los
  `<g>` adentro, no una imagen de píxeles.

### Instrumentos

- `.claude/flota/banco-r9-fase1.mjs` — API, C2, C5, C6, C7, C8 (Node).
- `.claude/flota/banco-r9-fase1.navegador.js` — C3, C4 (navegador, corre contra un
  Vite real comparando contra `base-r9/Iconos.js`).
- `.claude/flota/banco-r9-fase1.falsar.mjs` — planta defectos sobre una copia y trae
  controles.
