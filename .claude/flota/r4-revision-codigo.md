# Revisión de viabilidad técnica — `src/data/herramientas.json`

Revisor: agente de código. Rama `mejoras/ronda3-graficos`, árbol limpio, `npx vite build`
pasa (72 módulos, 6,78 s). `herramientas.json` **no lo importa nadie**: `grep -rn
"herramientas" src/ --include=*.js` sólo devuelve un comentario en `src/ui/Personaje.js:98`.
Confirmado: es dato puro y no está en el bundle.

Todo lo que sigue está verificado contra el código, no contra la prosa del propio archivo.

---

## 1. ¿Las líneas citadas en `engancheAlCodigo` existen y dicen lo que se afirma?

| Afirmación | Veredicto | Línea real |
|---|---|---|
| `Recursos.js`: «sacar la equivalencia madera_dura → tronco de la **línea 29**» | **Cierto, exacto** | `src/systems/Recursos.js:29` → `madera_dura: ['madera', 'tronco'],` |
| `Recursos.js`: «agregar los **11** recursos nuevos» | **Falso el número** | `recursosNuevos` tiene **16** entradas: cordel, mango, tiento, cuero_curtido, brea, punta, flecha, bola, anzuelo, aguja, pluma, miel, cera, propoleo, hidromiel, vela. Y hay un decimoséptimo sin declarar: `equipo_mosca` produce `mosca`, que no está en `recursosNuevos` ni en `RECURSOS` |
| `Mineria.js`: «la compuerta de la **línea 127**» | **Cierto, exacto** | `src/systems/Mineria.js:127` → `return this.inventario.disponiblePara('herramienta') > 0;` dentro de `tieneHerramienta()` (126) |
| `Caza.js`: «la **línea 128** ya pregunta `faltaPara('caza')`» | **Cierto, exacto** | `src/systems/Caza.js:128` → `const arma = this.saberes?.faltaPara('caza');` |
| `Pesca.js`: «la **línea 146** se conforma con fibra suelta en el bolso» | **Cierto, incompleto** | `src/systems/Pesca.js:146` es la mitad fibra/tendón de `tieneEquipo()`; la línea 145 pide además `cana`. Y acepta `tendon`, cosa que la afirmación omite |
| `Recoleccion.js`: «`COSECHA_SOTOBOSQUE` deja de ser una constante» | **Cierto el fondo, mal el archivo** | La constante vive en `src/systems/Recursos.js:217`, no en `Recoleccion.js`; éste sólo la importa (línea 14) y la usa en dos lugares: la guarda del barrido (`Recoleccion.js:74`) y el rinde (`Recoleccion.js:425`) |
| `Bolso.js`: «la categoría `remedio` ya existía y no se dibujaba» | **Obsoleto: ya está arreglado** | `src/ui/Bolso.js:77` incluye `'remedio'` en `ORDEN`, `TITULOS` lo mapea a «Botica» (línea 47) y desde la línea 164 los grupos salen de lo que de verdad hay en el bolso, con red «Otros» para lo que no tenga título. El defecto que se pide revisar ya no puede repetirse |
| `Jugador.js / Clima.js`: «el mismo cálculo térmico que ya usa el abrigo de las obras» | **Cierto el fondo, mal los archivos** | El cálculo está en `src/entities/Jugador.js:661-685` (`actualizarSupervivencia`). `src/world/Clima.js` es la lluvia **visual** y no participa: el `clima` que lee el cuerpo es `Tiempo.estado()` filtrado por `Eventos.aplicar()` en `main.js:703`. El abrigo se lo pone `main.js:808` desde `construccion.abrigoEn()` |

### Lo que `engancheAlCodigo` no nombra y hace falta igual

- **`src/data/historia.json`.** Es donde vive el árbol de saberes. Las 5 `tecnologiasNuevas`
  (`hacha_pulida`, `canteria_litica`, `pesca_con_mosca`, `apicultura_rustica`,
  `apicultura_cuadros`) están citadas como `tecnologia` de objetos y **no existen** ahí.
  Y `efectosAAgregar` son 10 reescrituras de ese archivo. La sección no lo menciona.
- **`src/main.js`.** El cableado, y sobre todo `aplicarEfectos()` (líneas 428-433), que es el
  único lugar donde `capacidadExtraKg` se convierte en kilos.
- **`src/systems/Partida.js`.** Sin tocarlo, el equipo no sobrevive a cerrar la pestaña.
- **`src/ui/Codice.js:851`.** El árbol de saberes también consulta `disponiblePara`.

### Lo que `efectosAAgregar` sí acierta

Verificado en `historia.json`: de 48 tecnologías, **43 tienen `efecto: null`**. Las 5 con
efecto son exactamente `arco_colihue {caza:true}`, `cesteria_junco {capacidadExtraKg:6}`,
`alfareria_bicroma {horno}`, `botica_bosque {recetas}`, `herreria_colonial {recetas}`. Las
diez notas del archivo («efecto null», «ya tiene caza:true», «ya habilita el horno», «ya
tiene recetas») son todas correctas.

---

## 2. Efectos declarados vs. sistema que los soporta vs. costo

Sólo **2 de 18** claves de efecto tienen consumidor hoy. `grep -rn` sobre `src/` de cada una:

| Efecto | Objetos | ¿Sistema hoy? | Costo | Dónde entra, exactamente |
|---|---|---|---|---|
| `abrigo` | quillango, tamangos, poncho_witral | **SÍ** | **trivial** | `main.js:808` — hoy `jugador.abrigo = construccion.abrigoEn(x,z)`. Pasa a ser el máximo (o la suma topada) entre la obra y lo puesto. La fórmula que lo consume ya existe: `Jugador.js:679` |
| `capacidadExtraKg` | canasto_junco_obj, mochila_cuero, rastra | **SÍ** | **trivial + una migración** | `main.js:432` — `inventario.capacidadKg = 38 + saberes.suma('capacidadExtraKg')`. Sumar `equipo.suma(...)` y **volver a llamar a `aplicarEfectos()` al equipar y al sacar**. Ojo: hay que quitar el `capacidadExtraKg: 6` de `cesteria_junco` en `historia.json` o el bono se cuenta dos veces; a quien ya la aprendió le baja la capacidad hasta que fabrique el canasto |
| `resistenciaViento` | quillango, poncho_witral | no | **trivial** | `Jugador.js:662` — `const vientoSentido = viento * (1 - 0.85 * abrigo);`. Es un factor más en ese producto |
| `resistenciaMojadura` | tamangos, poncho_witral | no | **trivial** | `Jugador.js:684-685` — `const mojado = this.enAgua \|\| ((clima?.lluvia ?? 0) > 0.2 && abrigo < 0.5 && fuego < 0.5);`. Es el umbral `0.2` o el `0.5` |
| `resistenciaMojaduraExtra` | encerado | no | **trivial** | El mismo lugar que la anterior |
| `encenderBajoLluvia` | eslabon | no | **trivial** | `Fundicion.condicionEncendido()` (`Fundicion.js:360`). El sistema de humedad está entero: `resistenciaAPrender()`, `_ayudaParaPrender()`, `_precipitacionSobre()`, `horno.mojado`, `umbralNoPrende`, `leniaExtra`, `demora`. Es el `if (r >= h.umbralNoPrende)` de la línea 366 |
| `encenderSinYesca` / `encenderMasRapido` | eslabon, taladro_arco | no | **trivial** | Mismo sitio: `cond.usos` (lo que se cobra en `_cobrarEncendido`) y `cond.demora` |
| `guardaAgua` | odre_cuero | no | **trivial** | `Recoleccion.js:389` — `this.inventario.agregar('agua', 1);` es el **único** `agregar('agua')` de todo `src/`. Pasa a `1 + equipo.suma('guardaAgua')` |
| `selectivo` | equipo_mosca | no | **trivial** | `Pesca._loQuePica()` (`Pesca.js:179-191`): el vector `pesos = aptitud × PICA`. Sesgarlo contra `esp.nativa` es una línea |
| `penalizaPendiente` / `requiereSuelo` | rastra | no | **trivial** | `Jugador._mover()` línea ~204: `const carga = 1 + Math.min(1, this.pesoCargado / 40) * 0.5;` dentro de la rama `subida > 0`. Ahí mismo se lee `pendienteEn()` |
| `luz` (mitad de juego) | antorcha, candil_grasa, velas_cera | no | **trivial** | `Exploracion.alcanceVisual()` línea ~109: `if (deNoche) alcance = Math.min(alcance, 220);`. Ese `220` es el radio nocturno |
| `luz` (mitad visual) | ídem | **no existe ninguna luz puntual en todo `src/`** | **caro** | Sólo hay el sol direccional del CSM (`main.js:140-159`) y el bloom. Meter una `PointLight` obliga a recompilar los materiales del terreno, la vegetación y el sotobosque, y la máquina ya va a 31,8 fps a 1024×576 con el terreno en el 35 % del cuadro. **Es la advertencia que el propio archivo se hace en `pendienteSinSistema` y hay que hacerle caso** |
| `duracionHoras` | antorcha, candil_grasa, velas_cera | no | **medio** | No hay reloj de objeto, pero el patrón está copiable entero: `Fundicion.encender()` (`Fundicion.js:162`) pone `horno.fuego = { hasta: base + horas * MS_HORA }`, `arde()` lo compara, `horasDeFuego()` lo informa y `Partida._serializar()` (línea 182) ya guarda un `hasta` de reloj del mundo. Función nueva en `Equipo.js` |
| `devolucionSegura` | equipo_mosca | no | **medio** | `Pesca.intentar()` tiene los dos caminos de devolución (`Pesca.js:278-285` nativa, `289-295` medida) y los dos sólo hacen `devoluciones++` y `saberes.otorgar()`. Falta un tercer desenlace —devuelto y no sobrevive— y su contador |
| `mejora` | encerado | no | **medio** | No es un efecto sobre el mundo sino una operación sobre una instancia de equipo. Vive dentro de `Fabricacion.js`, que hay que escribir igual |
| `velocidadPedregal` | tamangos | no | **medio** | La penalización de terreno existe (`Jugador._mover()`), pero **no existe la noción de «pedregal»**: `Mundo` expone `alturaEn`, `pendienteEn`, `humedadEn`, `esAgua`, `orillaCerca`, `cauceEn` y nada más. Hay que definirlo (pendiente > X y humedad < Y, que es lo que ya usa `Mineria._resolverFrente()`) antes de poder resistirlo |
| `resistenciaPicadura` | careta_velo | no | **caro por dependencia** | No hay ningún daño por picadura en el juego: el único daño ambiental es `Eventos.golpear()` (`main.js:742`). Y el efecto sólo tiene sentido dentro de la acción `catar`, que tampoco existe. Es la última pieza de la apicultura, no un efecto suelto |
| `recuperacion: 0.6` | flechas | no | **caro** | **No es recuperación de salud**: es el 60 % de flechas que se recuperan del tiro (`herramientas.json:815`, campo de primer nivel del objeto, no dentro de `efecto`). Hoy `Caza.intentar()` resuelve la caza sin proyectil que vuele —de `evaluar()` pasa directo a `_faena()`— así que no hay dónde caiga la flecha. El propio `pendienteSinSistema` ya lo admite |

**Resumen del bloque:** de los 15 efectos que el encargo lista, **9 son triviales** (un número
en una fórmula que ya existe), **4 son medios** (una función nueva en un sistema existente),
y **2 son caros** (`luz` visual y `recuperacion` de flechas) y hay que recortarlos o
posponerlos explícitamente.

---

## 3. Roturas

### 3.1 Sacar `madera_dura → tronco` de `Recursos.js:29`

Consumidores de `tronco`, enumerados sobre los tres datasets:

| Quién | Pide | Peso real (tronco = 6,0 kg) | Peso hoy con `madera_dura` (0,8 kg) |
|---|---|---|---|
| obra `cabana_troncos` | 12 tronco | **72,0 kg** | 9,6 kg |
| tec `construccion_troncos` (costo 30) | 12 tronco | **72,0 kg** | 9,6 kg |
| tec `capilla_troncos` (costo 28) | 10 tronco | **60,0 kg** | 8,0 kg |
| tec `canoa_troncos` (costo 22) | 1 tronco | 6,0 kg | 0,8 kg |
| receta `aserrar_tabla` | 1 tronco | 6,0 kg | 0,8 kg |
| receta `aserrar_poste` | 1 tronco | 6,0 kg | 0,8 kg |

**Se rompen tres cosas, en orden de gravedad:**

1. **Dos tecnologías y una obra quedan matemáticamente imposibles.** La capacidad máxima del
   bolso hoy es **44 kg** (`CAPACIDAD_BASE = 38` en `main.js:427` más el único
   `capacidadExtraKg` que existe, los 6 de `cesteria_junco`). `Construccion.faltaPara()`
   (`Construccion.js:57-61`) y `Saberes.estado()` (`Saberes.js:51-60`) resuelven **sólo contra
   `inventario.disponiblePara()`: los depósitos no cuentan**. 72 kg y 60 kg no entran nunca.
   Hoy funcionan por accidente, porque 12 ramas de 0,8 kg pesan 9,6.
2. **Y quedan imposibles en silencio, que es peor.** `OBTENIBLES` (`Recursos.js:157`) se deriva
   de `Object.keys(RECURSOS)`, y `tronco` **es** una clave de `RECURSOS` (línea 51). O sea que
   `tieneFuente('tronco')` sigue devolviendo `true` aunque nada lo produzca, y
   `Saberes.estado()` marca `faltan_materiales` en vez de `inalcanzable`. El mecanismo de
   honestidad que ese archivo se escribió para no mentir —«no es que falte juntarlo, es que no
   se puede conseguir»— **no se dispara**. Es exactamente el defecto de `curtido_cuero` que el
   propio `herramientas.json` señala, cometido de nuevo.
3. **Hoy `tronco` no lo produce nada.** `COSECHA_SOTOBOSQUE.tronco` (`Recursos.js:218`) entrega
   `lena` y `corteza`, no `tronco`. No hay un solo `agregar('tronco'` en `src/`. La afirmación
   del archivo («el recurso `tronco` no lo entregaba nada en todo el juego») es **cierta**.

**Conclusión:** la equivalencia se puede sacar, pero el mismo commit tiene que traer `trozar`
entregando tronco **y** rebajar las cantidades de `cabana_troncos`, `construccion_troncos` y
`capilla_troncos`, o dar a `Construccion.faltaPara()` acceso al depósito cercano. La regla que
el archivo se puso —«sacarla en el mismo commit que agregue la acción, no antes»— es correcta
pero **insuficiente**: falta la parte del peso.

### 3.2 Cambiar la compuerta de `Mineria.js:127`

Hoy `disponiblePara('herramienta') > 0` se satisface por dos vías:

- El recurso `herramienta` forjado: receta `herramienta` en la fragua (2 hierro + 1 madera +
  1 carbón), fragua que pide 10 piedra + 4 arcilla + 1 cuero, hierro que sale de
  `refundir_hierro` (3 chatarra + 1 carbón). Cadena larga pero completa.
- `asta`, por la equivalencia `asta: ['herramienta']` (`Recursos.js:33`).

**Y `asta` es inalcanzable hoy.** Su única fuente es `caza.json` → `carronia.fuentes` →
`desmogue_astas`, y `Recoleccion.actuar()` **cablea la fuente a mano**:

```js
// src/systems/Recoleccion.js:420
this.caza?.aprovechar({ fuenteId: 'presa_puma' });
```

Es el único llamador de `aprovechar()` en todo `src/`. `Caza._faena()` tampoco entrega asta.

**Qué se rompe al pedir «nivel 3 en la mano»:** los dos únicos objetos de nivel 3 del propio
`herramientas.json` son `maza_cuna` (pide **1 asta**) y `pico_asta` (pide **2 asta**).
Cantera → nivel 3 → asta → carroña que el juego nunca ofrece. **Deadlock cerrado.** Hay que
darle fuente al asta *antes* de tocar la compuerta.

Efecto colateral menor: el detalle de la negativa (`Mineria.js:181`) dice «una herramienta de
hierro **o de asta**», y hoy la segunda mitad de esa frase es mentira.

### 3.3 Cambiar la compuerta de `Pesca.js:145-146`

Rotura menor y una trampa:

- `tieneEquipo()` no tiene ningún otro llamador que `Pesca.evaluar()` (línea 205). Cambiarlo es
  local.
- **La trampa está en el orden de `evaluar()`.** El control de equipo va **antes** que el del
  permiso (línea 205 vs. 211), y el contador de gracia se lleva en `intentar()` línea 255:
  `if (!this.tienePermiso && v.primera !== undefined) this.intentosSinPermiso++`. Endurecer el
  equipo hace que el jugador choque más veces con «te falta equipo» y nunca llegue al control
  del permiso — que es justamente lo que ese comentario dice que arreglaron. No se rompe, pero
  la lección del permiso se aleja.
- `Pesca` no recibe `equipo` en sus deps (`main.js:325-327`): hay que agregarlo.
- `cana` sigue siendo satisfecho por `cana` (flora, `recursoJuego: 'caña'`) y `junco` **no**
  satisface `cana` — la equivalencia va al revés (`cana: ['junco']`, `Recursos.js:31`).

### 3.4 La rotura que `engancheAlCodigo` no vio: `boleadora` con `caza: true`

`efectosAAgregar` propone darle `{caza: true}` a `boleadora` para que «el jugador pase a tener
dos vías y no una». **`Saberes` no sabe hacer «o».**

```js
// src/systems/Saberes.js:92-101
requisitoPara(clave, valor) {
  for (const t of this.porId.values()) {
    const v = t.efecto?.[clave];
    if (v === undefined) continue;
    ...
    if (coincide) return t;      // ← devuelve la PRIMERA, aprendida o no
  }
  return null;
}
faltaPara(clave, valor) {
  const t = this.requisitoPara(clave, valor);
  return t && !this.desbloqueadas.has(t.id) ? t : null;
}
```

En `historia.json`, `boleadora` está en el índice **2** y `arco_colihue` en el **3**. Con las
dos marcadas `caza: true`, un jugador que aprendió el arco y no la boleadora recibe
`faltaPara('caza') → boleadora` y **queda bloqueado para cazar con el arco que tiene**. Y el
texto de la negativa (`Caza.js:133-135`) le va a pedir «caña colihue y un tendón», que es la
receta del arco, no la de la boleadora.

**Arreglo obligatorio previo:** `requisitoPara` tiene que devolver la lista y `faltaPara`
devolver `null` si *alguna* está desbloqueada. Son cinco líneas en `Saberes.js`, y hay que
hacerlas antes de tocar el dataset. Es la rotura más silenciosa de todo el encargo.

---

## 4. Los dos sistemas nuevos

### `Equipo.js`

**Dónde se cablea.** `main.js`, entre `Saberes` (línea 268) y `Recoleccion` (línea 334). Después
de `inventario` y `saberes`, antes de todo lo que lo consulta.

**Dependencias:** `{ inventario, saberes, hud }` mínimas, más un callback `alCambiar` para
disparar `aplicarEfectos()` (que es un closure de `iniciar()` y **no está exportado**: hay que
pasárselo, no importarlo).

**Quién lo recibe después:** `Recoleccion`, `Mineria`, `Caza`, `Pesca`, `Fundicion`, `Partida`
y el panel. `Recoleccion` es el caso fácil: su constructor desestructura una lista fija
(`Recoleccion.js:45`) y los sistemas que le faltaban se le asignan a posteriori
(`main.js:338-345`: `.caza`, `.mineria`, `.pesca`, `.fundicion`). `recoleccion.equipo = equipo`
sigue el patrón establecido. `Mineria`, `Caza`, `Pesca` y `Fundicion` usan
`Object.assign(this, deps)`: alcanza con sumar la clave al objeto de deps.

**`Partida.js`: sí, tiene que guardarlo, y hay tres trampas.**

1. **No toques `VERSION`.** `Partida.js:33` tiene `VERSION = 1` y `cargar()` línea 271 hace
   `if (!d || d.version !== VERSION) return false` — **bumpearla borra la partida de todo el
   mundo**. Se agrega un campo `equipo` a `_serializar()` (línea 146) y se lee con
   `d.equipo || []` en `cargar()`. Retrocompatible sin tocar la versión.
2. **Decidir qué pasa al morir.** `registrarMuerte()` (línea 80-97) vacía
   `this.inventario.items` entero. Si el equipo vive fuera del inventario, **el hacha
   sobrevive a la muerte** y eso contradice la regla escrita en la cabecera del archivo («al
   morir perdés lo que cargabas encima»). Es una decisión de diseño que hay que tomar a
   propósito, no por omisión.
3. **El reloj de `duracionHoras`.** Si la antorcha tiene un `hasta` en ms del mundo, se
   serializa como ya se serializa `fuego.hasta` (línea 184) y se repone después de
   `this.tiempo.fecha.setTime()` (línea 284), como hace `_reponerHornos()` línea 349. El orden
   importa: reponer el reloj primero.

También hay que sumar `equipo` a las deps de `new Partida({...})` en `main.js:391-396`
(usa `Object.assign`, así que basta la clave).

### `Fabricacion.js`

**Es el sistema más barato de los dos y el que menos riesgo tiene.** La afirmación del archivo
—«reusando `disponiblePara`/`consumirPara`, que ya hacen exactamente esto»— es **correcta**.
El molde exacto ya está escrito tres veces: `Construccion.faltaPara()` + `levantar()`,
`Fundicion.faltaPara()` + `construir()`, y `Saberes.estado()` + `desbloquear()`. Los tres
hacen lo mismo: mapear materiales contra `disponiblePara`, filtrar lo que falta, y consumir
con `consumirPara` normalizado.

**Las cuatro estaciones se resuelven con lo que hay, sin código nuevo de mundo:**

| Estación | Requisito declarado | Cómo se comprueba hoy |
|---|---|---|
| `bolso` | ninguno | nada |
| `fogata` | encendida a < 8 m | `fundicion.cercano()` — `RADIO_HORNO_M = 8` en `Fundicion.js:36`, **el mismo número**. Más `fundicion.arde(horno)` |
| `fragua` | encendida a < 8 m | ídem, filtrando `def.id === 'fragua'` |
| `aserradero` | obra levantada | también sale de `fundicion.cercano()`: `Construccion.levantar()` líneas 160-166 registra toda obra con `procesa: true` como horno con `temperaturaC: null`, y `usaFuego()` (`Fundicion.js:97`) devuelve false para ésos, así que no pide fuego |

**Dependencias:** `{ inventario, saberes, equipo, fundicion, hud }`. Se cablea después de
`construccion` (línea 316) porque necesita que el aserradero ya esté registrado como horno, y
antes del panel.

**Qué guarda `Partida`:** nada propio. Lo fabricado son instancias de `Equipo`, y eso ya lo
guarda `Equipo`.

### Orden de implementación con menos riesgo

Cada paso deja el juego jugable y es verificable por separado.

0. **`Saberes.requisitoPara` con semántica de «o».** Cinco líneas. Sin esto, el paso 5 rompe la
   caza. Es la única deuda que hay que pagar antes que nada.
1. **Dar fuente al asta y a la lana.** `Recoleccion.actuar()` línea 420 tiene el `fuenteId`
   cableado a `'presa_puma'`: elegir la fuente del resto (`sotobosque` ya distingue el lote) y
   `desmogue_astas` empieza a salir. `lana` **no tiene ninguna fuente en ningún dataset** y
   `poncho_witral` la pide. Sin este paso, medio árbol es decorativo y el paso 6 es un
   deadlock.
2. **`Fabricacion.js` + `Equipo.js` sin efectos.** Sólo ranuras, fabricar y equipar. Nada
   cambia en el juego todavía; se puede mirar en el panel y se puede medir.
3. **`Partida`: serializar el equipo.** Sin tocar `VERSION`. Decidir explícitamente la regla de
   la muerte.
4. **Los 9 efectos triviales**, de a uno: `abrigo`, `capacidadExtraKg` (con la migración de
   `cesteria_junco`), `resistenciaViento`, `resistenciaMojadura`, `encenderBajoLluvia`,
   `encenderSinYesca`, `guardaAgua`, `selectivo`, `penalizaPendiente`. Todos son un número en
   una fórmula que ya funciona y se falsan solos.
5. **Los efectos del árbol**: las 5 tecnologías nuevas a `historia.json` y las 10 reescrituras
   de `efecto`. Recién acá, con el paso 0 hecho.
6. **`trozar` + sacar la equivalencia de `Recursos.js:29`**, en el mismo commit, y **con las
   cantidades de `cabana_troncos`, `construccion_troncos` y `capilla_troncos` rebajadas** o el
   depósito contando en `faltaPara()`.
7. **Las compuertas**: `Mineria.js:127` (ya con asta disponible del paso 1) y
   `Pesca.js:145-146`.
8. **`duracionHoras` y `devolucionSegura`** — los dos medios que valen la pena.
9. **Recortar o posponer por escrito**: `luz` visual, `recuperacion` de flechas, trampas,
   `resistenciaPicadura`. Declarar un efecto que no existe es el defecto que este proyecto ya
   cometió con `curtido_cuero`, y el propio archivo lo dice.

---

## 5. La capa mínima de interacción: que se note la herramienta

**El circuito completo es cortísimo y ya está escrito.** `main.js:864` llama, dos veces por
segundo, a `hud.mostrarAccion(recoleccion.quePuedoHacer(tiempo.segundosTotales))`.
`quePuedoHacer()` devuelve `{tipo, etiqueta, tecla?}` y `HUD.mostrarAccion()`
(`HUD.js:145-153`) pinta `<b>E</b> · ${etiqueta}` o, si hay `tecla`, la resalta dentro del
texto. Eso es todo el indicador.

**Plan concreto, cinco pasos, ninguno toca el bucle de render:**

1. **`main.js`, después de la línea 345:** `recoleccion.equipo = equipo;` — mismo patrón que
   `.caza`, `.mineria`, `.pesca`, `.fundicion`. Una línea.
2. **`Recursos.js`:** `COSECHA_SOTOBOSQUE` (línea 217) deja de ser un objeto plano y pasa a ser
   una función `cosechaSotobosque(id, nivel = 0)` que devuelve el rinde según el nivel. Hay que
   tocar los **dos** usos de `Recoleccion.js`: la guarda del barrido (línea 74,
   `if (!esCarronia && !COSECHA_SOTOBOSQUE[id]) continue`) necesita seguir sabiendo qué ids son
   cosechables sin llamar a la función 13.700 veces por lote — dejar un `Set` de ids al lado y
   usar la función sólo en el rinde (línea 425). **Esto importa:** el barrido de `_delSuelo()`
   corre sobre matrices de instancia crudas y el comentario de la línea 62-66 explica por qué;
   no hay que meterle una llamada por instancia.
3. **`Recoleccion.quePuedoHacer()`:** que la acción lleve la herramienta. Dos cambios:
   - Devolver un campo más en el objeto, p. ej. `{ ..., con: equipo?.enMano()?.nombre || null }`.
   - Cambiar la etiqueta del tronco caído, que es donde más se nota. Hoy la rama de
     `mata.vale >= 4` (línea 137) dice `Juntar ${tipo.nombre}`. Con hacha en la mano pasa a
     `Trozar el caído` y sin ella sigue diciendo `Juntar leña del caído`. **Es el único cambio
     de texto que hace falta para que el jugador entienda que la herramienta cambia el verbo,
     y no el rinde nada más.**
4. **`HUD.mostrarAccion()` (línea 145):** una segunda línea tenue con `accion.con`. El CSS de
   `#accion` ya está en `HUD._construirBolso()` (líneas 106-111) y ya centra y hace fade; con
   un `<small>` alcanza. No hay que crear ningún elemento nuevo.
5. **Los avisos**, que es la mitad que el dueño pidió y suele olvidarse.
   `Recoleccion.actuar()` case `'sotobosque'` (líneas 424-451) ya arma el texto del aviso con
   lo obtenido. Con el rinde por nivel, el mismo tronco dice «3 × Leña · 1 × Corteza» a mano y
   «2 × Tronco · 3 × Leña · 2 × Corteza» con hacha, **sin tocar una línea del aviso**: sale
   solo de cambiar la fuente del rinde. Ése es el argumento más fuerte para hacer el paso 2
   antes que ningún efecto.

**Cuidado con la ranura única del aviso.** `HUD.aviso()` (línea 203) es una sola ranura que
sobreescribe texto y reinicia el reloj; `Recoleccion.actuar()` ya escalona a mano
—acción → códice (1,5 s) → taller (4,5 s), línea 365 y 485—. Cualquier aviso nuevo de equipo
tiene que entrar en ese escalonamiento o va a pisar al de la propia acción.

**Costo total de la capa mínima:** una línea en `main.js`, una función en `Recursos.js`, dos
ramas de etiqueta en `Recoleccion.js`, un `<small>` en `HUD.js`. Se puede hacer **en el paso 2
del plan**, antes de cualquier efecto, y ya se nota.
