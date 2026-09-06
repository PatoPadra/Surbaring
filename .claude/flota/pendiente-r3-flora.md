# Pendiente de flora — lo que cae fuera de mis dos archivos

Mis archivos son `src/world/Vegetacion.js` y `src/world/Sotobosque.js`, y no
toqué nada más. Esto es lo que encontré midiendo y que **no me corresponde
escribir**. Está ordenado por tamaño del número, no por facilidad.

---

## 1 · Ningún preset baja un solo byte de la VRAM de la vegetación

**Archivos ajenos:** `src/engine/Calidad.js`, `src/main.js`.

`Calidad.recortarInstancias()` (`Calidad.js:370`) sólo toca `malla.count`:

```js
lote.malla.count = Math.floor(lote.n * p.vegetacion);
lote.impostor.malla.count = Math.floor(lote.impostor.n * p.vegetacion);
```

Eso baja el **trabajo por cuadro**, y está bien que lo haga. Pero la **memoria**
es idéntica en Alta y en Mínima: el número de especies (`CUPO_ESPECIES = 30`), el
tamaño del atlas de impostor (512×768) y los buffers de instancia
(`MAX_POR_ESPECIE = 600`, `MAX_IMPOSTORES = 7000`) se fijan en el constructor y
nadie los mueve nunca. Un preset «Mínima» que promete menos consumo entrega el
mismo consumo de VRAM que «Alta».

Después de D5 la cuenta queda así, por especie:

| concepto | MiB |
|---|---|
| color del render target 512×768 | 1,500 |
| sus mipmaps | 0,500 |
| matrices + color de 7000 impostores | 0,507 |
| matrices + color de 600 mallas | 0,044 |
| **por especie** | **2,551** |
| **× 30 especies** | **76,5** |

Más 2,67 MiB de los dos atlas de follaje. **La profundidad ya no está**: eran 45,0
MiB y los devolví (ver `r3-flora.md`, H5).

Las tres palancas, con su número, para que se decida con datos:

| palanca | dónde | ahorro |
|---|---|---|
| `CUPO_ESPECIES` 30 → 18 en Baja/Mínima | la constante es mía, **pero nadie le pasa un valor según el preset**: el cableado es de `main.js` | ~30,6 MiB |
| teja del impostor 128×192 → 96×144 en Baja | mía, mismo problema de cableado | ~22,5 MiB → **26,25** ‡ |
| `MAX_IMPOSTORES` 7000 → 4000 en Mínima | ídem | ~6,5 MiB |

> ‡ **Corregido por el jefe de la fase 3, rehaciendo la cuenta.** Con la rejilla
> 4×4 la teja 96×144 da un atlas de 384×576, o sea 0,844 MiB de color + 0,281 de
> mipmaps = 1,125 contra los 2,000 de hoy: **0,875 por especie, 26,25 en total**,
> no 22,5. La palanca es **más grande** de lo que decía su autor. Las otras dos
> dan exacto (30,61 y 6,52). Se anota en vez de pisarlo porque el archivo es de
> `flora` y porque el error apunta en la dirección incómoda de verificar: el que
> se equivoca a su favor se revisa solo, el que se equivoca en contra no.

**Lo que hace falta de afuera es el conducto**, no la constante: que el preset
llegue al constructor de `Vegetacion`. Hoy `Calidad` recibe el objeto ya
construido y sólo puede recortar cuentas. Si el coordinador abre ese conducto, la
parte de adentro la escribo yo en una línea.

## 2 · La vegetación no libera nada al morir

**Archivo mío**, pero lo dejo anotado porque decidí no hacerlo en esta fase y
alguien tiene que saberlo. `Vegetacion.dispose()` (`Vegetacion.js:~667`) suelta la
geometría y el material de las mallas completas, y nada más: quedan vivos los 30
`WebGLRenderTarget` de impostor con sus 2,0 MiB de color+mipmaps cada uno, los 30
materiales de cartelera, las 30 mallas instanciadas y los dos atlas de follaje.
Son **~63 MiB que no vuelven**.

No lo arreglé porque hoy **nadie llama a `dispose()`** —la vegetación vive lo que
vive la sesión— y porque tocarlo es cambiar el comportamiento de un camino que
ninguna medición ejercita, en una fase cuyo presupuesto es cero regresión. Queda
para cuando exista un banco que lo ejercite.

Dato de mecanismo que hace falta si alguien lo escribe: **después de
`liberarProfundidadHorno()` estos objetivos no se pueden volver a usar para
renderizar** (su framebuffer conserva un adjunto de profundidad ya liberado, y
three no vuelve a llamar a `setupDepthRenderbuffer()` sobre un objetivo ya
compuesto). Disponerlos está bien; rehornear en ellos, no. Está escrito al lado
del código, en el comentario de `profundidadHorno()`.

## 3 · La elección de `repV` supone `anisotropy = 8` efectivo

**Nada que hacer, pero conviene saberlo.** El `repV = 1,75` del tronco se eligió
para que la razón de densidad de texels (7,2) entre en la anisotropía de la
textura. `tex.anisotropy = 8` es un **pedido**: three lo recorta a
`renderer.capabilities.getMaxAnisotropy()` al subir. En la GT 630M de esta máquina
el tope es 16, así que se cumple. En una placa que sólo dé 4, la corteza del
tronco se ve algo más borrosa a contraluz; no se rompe nada y no hay que hacer
nada. Lo anoto para que, si alguna vez alguien mide borrosidad en el tronco en
otra máquina, sepa de dónde sale y no salga a buscarlo.
