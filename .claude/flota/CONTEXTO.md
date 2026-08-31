# Contexto compartido para la flota de mejora — SurviBar

Leé esto entero antes de tocar nada. Está escrito para que no tengas que
re-descubrir lo que ya se midió.

## Qué es el proyecto

Juego de supervivencia educativo en Three.js (vanilla, sin framework) sobre el
relieve real del Parque Nacional Nahuel Huapi, Bariloche. Mundo de 65,5 × 65,5 km
a partir de un DEM satelital real. Todo el código y los comentarios están **en
español rioplatense**, y los comentarios explican *por qué*, no *qué*. Respetá
ese estilo: es la voz del proyecto.

`README.md` (41 KB) documenta el estado real, los defectos conocidos y varias
trampas de shader que ya costaron caro. Leé al menos la sección `## Estado real`
y lo que toque a tu área antes de proponer nada.

## Cómo se corre y cómo se verifica — LEER SÍ O SÍ

El servidor de desarrollo **ya está corriendo** en `http://localhost:5173/`.
No lo levantes de nuevo con Bash. Si necesitás reiniciarlo, avisá en tu informe.

**El panel del navegador no compone cuadros.** Consecuencias, todas medidas:

- El contador de fps del juego miente. Marca ~656 fps y "1 llamada de dibujo".
  No es rendimiento: es que el panel no dibuja. **Nunca uses ese número como
  medición.** Este error de método ya costó el rendimiento del proyecto una vez.
- Las capturas de pantalla del navegador salen vacías o desgarradas.
- `javascript_tool` corre en un **mundo aislado** y NO ve `window.SurviBar`.

La forma que sí funciona es inyectar un `<script>` y devolver el resultado por
`document.body.dataset`:

```js
const s = document.createElement('script');
s.textContent = `document.body.dataset.r = JSON.stringify({ lo: window.SurviBar.loQueSea });`;
document.documentElement.appendChild(s);
s.remove();
document.body.dataset.r
```

### El puente de capturas

`src/util/captura.js` (sólo en desarrollo) expone:

```js
window.capturar(nombre, { lat, lon, altura, rumbo, cabeceo, fecha,
                          tercerPersona, paso, evento, lluvia, nieve,
                          vientoKmh, rayo, ancho, alto })
```

Escribe un PNG en `capturas/<nombre>.png` que después leés con la herramienta
Read. Dibuja **por el compositor**, así que la captura incluye oclusión
ambiental y corrección de color: es lo que ve el jugador. Fija su propio tamaño
(1280×720 por defecto), así que no depende de que el panel esté visible.

Es asíncrona y tarda unos segundos. Llamala dentro de un IIFE async en el script
inyectado, marcá el final en `document.body.dataset.algo`, y esperá con
`await new Promise(r => setTimeout(r, N))` antes de leer.

`window.SurviBar` expone: `escena camara render mundo terreno cielo agua
vegetacion sotobosque fauna jugador cuerpo aspecto personaje tiempo compositor
csm hud codice entrada inventario saberes recoleccion caza audio limites mineria
fundicion hornos taller construccion obras peces pesca eventos clima oclusion
color calidad exploracion mapa bolso opciones fin partida norma relevamiento
cierre`.

### Protocolo de navegador para no pisarte con los demás

Hay **siete agentes trabajando en paralelo sobre el mismo repo y el mismo
servidor**. Para no pisarse:

1. Abrí **tu propia pestaña** con `tabs_create` y navegá a `http://localhost:5173/`.
   Usá siempre tu `tabId`. No uses la pestaña de otro.
2. La creación de personaje ya está resuelta en `localStorage`, así que la página
   entra directo al juego. Esperá ~10 s tras cargar y comprobá que
   `window.SurviBar` existe antes de capturar.
3. **Prefijá TODAS tus capturas con tu nombre de agente**: `luz-`, `veg-`,
   `agua-`, `feel-`, `bucle-`, `ui-`, `vida-`. Si no, te sobrescriben la foto.
4. Vite recarga en caliente cuando cualquiera guarda un archivo. Si una captura
   sale rara, recargá tu pestaña y repetí antes de concluir que rompiste algo.

## Reglas de propiedad de archivos — INNEGOCIABLE

Cada agente es dueño exclusivo de sus archivos. **No edites archivos de otro
agente ni aunque veas ahí el arreglo obvio.** Si el arreglo está afuera de tu
territorio, anotalo en tu informe final y seguí con lo tuyo.

`src/main.js` y `src/engine/Calidad.js` son **del coordinador**. No los toques.
Si necesitás una línea de cableado en `main.js`, escribí el parche exacto
—con el texto viejo y el nuevo— en `.claude/flota/pendiente-<tu-nombre>.md` y
seguí. El coordinador los aplica todos juntos al final.

Los `.json` de `src/data/` son contenido verificado contra fuentes oficiales
(Parques Nacionales, SIB, CONICET, SAREM, UICN, SMN). Podés **agregar** campos o
ajustar números de juego, pero **no inventes datos naturales ni normativos**: si
un dato no lo podés sostener, no lo pongas.

## Presupuesto de rendimiento — la restricción dura

La placa de destino es una **Intel HD Graphics 4000 de 2012**. El cuadro completo
está hoy en 26 ms (39 fps) en el preset Baja tras un arreglo que bajó el terreno
de 377 ms a 1,7 ms. Reparto actual: sombras 7 ms, oclusión 4,5 ms, vegetación
2,3 ms, resplandor 1,8 ms.

**Casi todo lo caro se paga por píxel.** Antes de agregar cualquier cosa al
shader de fragmento, preguntate si se puede envolver en el `if` de su propio
factor de desvanecimiento, o resolver en el vértice, o hornear una vez.
Una mejora visual que cueste 10 ms no es una mejora: es un juego que no anda.

Si tu cambio agrega costo, decilo en el informe con una estimación honesta.

## Tres trampas de shader ya pagadas, para que no las vuelvas a pagar

1. **`logarithmicDepthBuffer` está activo.** Todo `ShaderMaterial` propio tiene
   que incluir los chunks `logdepthbuf_pars_vertex`, `logdepthbuf_vertex`,
   `logdepthbuf_pars_fragment` y `logdepthbuf_fragment`. Si no, escribe una
   profundidad que no se corresponde con el resto de la escena y **el objeto
   desaparece detrás del terreno sin ningún error en consola**.
2. **`CSM.setupMaterial()` no encadena**: pisa `onBeforeCompile`. Para eso está
   la función `conCSM()` en `main.js`. Si registrás un material en las sombras
   después de inyectarle tu shader, tus inyecciones desaparecen en silencio.
3. **Un shader mal integrado no lanza excepciones, sólo desaparece.** Si algo no
   se ve, sospechá del shader antes que de la geometría.

## Cómo trabajar

- **Medí antes de tocar.** En un juego 3D suponer sale caro: varios defectos de
  este proyecto (el bosque que se evaporaba, la física medio texel corrida)
  sólo aparecieron al medir.
- **Verificá después de tocar**, con una captura o con un número, no con la
  lectura del propio código.
- Cambios quirúrgicos sobre el código que ya está, no reescrituras. El proyecto
  tiene decisiones pensadas y documentadas; si vas a revertir una, explicá por qué.
- **No hagas `git commit` ni `git add`.** El coordinador revisa y commitea.
- Si algo se rompe y no lo podés arreglar, **dejalo funcionando como estaba** y
  reportalo. Un área que anda vale más que una a medio mejorar.

## Tu informe final

Terminá con, en este orden:

1. **Qué cambiaste**, archivo por archivo, en dos líneas cada uno.
2. **Con qué lo verificaste** — nombre de la captura o el número que mediste.
3. **Qué costo agregaste** en ms, estimado y de dónde sale la estimación.
4. **Qué dejaste sin hacer** y por qué.
5. **Qué necesitás de otro agente o de `main.js`.**

El coordinador no ve tu transcripción, sólo este informe. Si algo importa, va acá.

---

## Línea de base medida en esta máquina (agregado por el coordinador)

La placa de esta máquina **es** la de destino: `ANGLE (Intel, Intel(R) HD
Graphics 4000 (0x00000166) Direct3D11)`. O sea que lo que medís acá es lo que
va a sentir el jugador. No hay excusa de "en mi máquina anda".

Medido con el árbol de trabajo limpio, **preset Alta forzado**, con el reloj de
GPU (`EXT_disjoint_timer_query_webgl2`):

| Resolución | Mpx | ms de GPU |
|---|---|---|
| 640×360 | 0,23 | **57,1** |
| 1280×720 | 0,92 | **88,3** |

El instrumento es `public/banco.js`, que **no** está enganchado en `index.html`.
Se carga a mano y recién entonces existen las funciones:

```js
const s = document.createElement('script');
s.src = '/banco.js';
document.documentElement.appendChild(s);
// esperar ~1,5 s, y después ya se puede llamar window.banco() desde un script inyectado
```

- `window.banco({ancho, alto, cuadros})` mide el cuadro en varios puntos del mapa.
- `window.bancoDesglose()` apaga una pieza por vez para tarifarlas.
- `window.bancoValidez()` comprueba que el instrumento no esté mintiendo: el
  tiempo TIENE que crecer con los píxeles. **Corré esto antes de creerle a
  cualquier número.** Tarda más de 40 s; dale tiempo o se corta a la mitad y
  dictamina "EL INSTRUMENTO MIENTE" por muestras faltantes, no por el reloj.

`docs/medicion-cuadro.md` tiene la historia completa de cuatro rondas de
optimización, con los resultados negativos incluidos. Si vas a tocar el terreno
o el sotobosque —que entre los dos fueron el 77 % del cuadro— leelo antes.

## Sobre el uso

Esta sesión tiene un límite de uso y ya se agotó una vez con siete agentes en
paralelo. Trabajá **económico**: leé lo que necesitás y no el repositorio entero,
no releas archivos que ya leíste, y no saques veinte capturas donde alcanzan
cinco. Preferí un cambio bien verificado a cinco a medias.

## Aviso del coordinador (31/8, tras el segundo corte por límite)

- **El servidor está en `http://localhost:5173/`.** Si no responde, levantalo con
  la herramienta de vista previa y la configuración `survibar`; no con Bash.
- **Vite recarga en caliente cuando cualquier agente guarda un archivo, y eso
  mata los scripts largos de los demás.** Lo sufrieron varios en la tanda
  anterior. La forma que funciona: disparar la captura y **no esperarla dentro de
  la página** —consultar el archivo en `capturas/` desde disco hasta que aparezca—.
  Si una captura sale a medias, recargá tu pestaña y repetí antes de concluir que
  rompiste algo.
- Ahora corren **tres agentes por vez**, no siete, por decisión del dueño.

## Dos trampas nuevas, pagadas por `agua` y por `luz` (agregar al README)

**1. Una comilla invertida dentro de un comentario de GLSL tumba el juego entero.**
El shader vive en una plantilla literal de JavaScript, así que una comilla
invertida —o un `${`— dentro de un comentario del GLSL **cierra el literal** y da
un `SyntaxError` de JavaScript que apunta a una variable del shader. No es un
error de shader y no lo parece. Le pasó a los dos, y mientras tanto ningún agente
podía verificar nada porque el juego no arrancaba.

Se detecta gratis, sin navegador, antes de guardar:

```bash
node --input-type=module -e "await import('./src/world/Cielo.js')"
```

**2. `capturar()` sobre un lago se hunde.** Corre 90 pasos de física por omisión
y el jugador se cae al lecho: una captura pedida a 15 m sobre una superficie de
768,9 m salió desde 762 m, siete metros bajo el agua. **Sobre agua hay que pasar
`pasos: 0`.** Se perdió una tanda entera de capturas antes de darse cuenta.

**Falsa alarma conocida:** la comprobación de importación por Node falla en
`src/main.js` con `ERR_IMPORT_ASSERTION_TYPE_MISSING` sobre los `.json`. **No es
un defecto**: Node pide una aserción de tipo que Vite no necesita. En `main.js`
usá `node --check`; la comprobación por importación sirve para los módulos que
llevan GLSL.
