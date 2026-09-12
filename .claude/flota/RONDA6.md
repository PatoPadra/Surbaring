# RONDA 6 — El inventario de casilleros

Rama: `mejoras/ronda6-inventario`, sacada de `mejoras/ronda5-graficos`.
**La ronda 5 todavía no está fusionada a `main` y no se fusiona hasta que el dueño
la vea en pantalla.** Esta ronda se apila encima igual, por decisión suya.

Método, el mismo de las rondas 3, 4 y 5: un jefe y subagentes, propiedad
exclusiva de archivos, y se cierra de a una fase — no arranca la siguiente hasta
que la anterior esté medida, revisada y commiteada.

- El banco de cada fase lo escribe el JEFE, antes de ver el código del agente, y
  con un falsador al lado que le plante defectos y compruebe que se pone rojo.
- El coordinador corre los bancos y revisa **leyendo el código**, no los informes.
- Se commitea parcial en cuanto haya algo medido.

---

## Lo que se midió antes de encargar nada

El pedido fue «el inventario de casilleros típico de Diablo 2 o de Rust», con la
pregunta honesta de qué tan caro sale. Se midió el código antes de contestar.

### 1. La mitad cara ya está pagada

El inventario se toca **75 veces en 16 archivos**. Pero **55 de esas son
consultas** (`disponiblePara`, `pesoKg`, `listar`, `cantidad`) y sólo **20 mutan**:
12 `agregar` y 8 `quitar`.

Y de los 12 lugares que agregan, **11 ya leen cuánto entró de verdad**:

```js
const n = this.inventario.agregar(r.recurso, r.cantidad);
if (n > 0) obtenido.push(`${n} × ${r.recurso}`);
```

El rechazo parcial —«cazaste el ciervo pero no te entra»— es lo difícil de un
inventario de casilleros, y está resuelto en todos lados desde que existe el tope
de 38 kg. El único que lo ignora es `Recoleccion.js:460`, tomar agua: un renglón.

**Consecuencia para el encargo: el loteo no se reescribe.** Se reescribe
`Inventario.js`, que son 100 líneas, y el resto del juego no se entera.

### 2. Las pilas salen del peso: cero datos escritos a mano

`RECURSOS` tiene **71 fichas** con peso declarado (no 92: ese número contaba
también las equivalencias). Escribir a mano 71 tamaños de pila sería el tipo de
dato que se desincroniza en cuanto se agrega un recurso.

Se midió si se puede derivar. La regla: **la pila es el número redondo de la
escalera `[1, 2, 5, 10, 20, 50]` más cercano —en escala logarítmica— a lo que
entra en 3 kg.**

| kg de la ficha | p10 0,02 | mediana 0,35 | p90 1,6 | máx 6 |
|---|---|---|---|---|

Reparto que da sobre las 71 fichas, con tope de 3 kg:

| pila de | 1 | 2 | 5 | 10 | 20 | 50 |
|---|---|---|---|---|---|---|
| recursos | 5 | 13 | 11 | 14 | 8 | 20 |

Y leído a mano, da números que un jugador acepta sin explicación:

```
yesca      0,01 kg -> pila de 50 = 0,5 kg
junco      0,1  kg -> pila de 20 = 2,0 kg
miel       0,35 kg -> pila de 10 = 3,5 kg
ceramica   0,7  kg -> pila de  5 = 3,5 kg
chatarra   1,1  kg -> pila de  2 = 2,2 kg
tronco     6    kg -> pila de  1 = 6,0 kg
```

Se probaron topes de 2, 3, 4 y 5 kg. Con 2 kg quedan 9 recursos con pila de 1
—demasiada cosa que no apila—; con 4 y 5 kg la mitad de la tabla se va a pilas de
50 y la escalera deja de decir nada. **Se elige 3 kg.**

### 3. Cuántas casillas, medido para que los dos topes muerdan

Si la grilla es chica reemplaza al peso, y el peso es un sistema con dientes que
funciona: frena en la subida y sostiene cuatro objetos contenedores. Si es
grande, la grilla es decoración. Se simularon 4000 cargas al azar hasta llenar la
capacidad, con las pilas de arriba:

| carga | 38 kg (base) | 80 kg (con rastra y mochila) |
|---|---|---|
| de todo un poco | p50 15 · p90 17 · máx 22 | p50 31 · p90 33 · máx 39 |
| sólo livianos | p50 17 · p90 20 · **máx 28** | p50 36 · p90 39 · **máx 47** |
| sólo pesados | p50 13 · p90 14 · máx 17 | p50 26 · p90 28 · máx 32 |

Con **24 casillas** a capacidad base: una carga mixta de 38 kg entra siempre
(máx 22 < 24), así que la grilla nunca bloquea un bolso lleno normal — **muerde el
peso primero, como hoy**. Pero una recorrida de sólo cosas livianas —el día de
juntar hierbas y yesca— llega a 28 y **ahí muerde la grilla**. Los dos topes
existen y ninguno es adorno.

La regla, derivada y no escrita a mano, en filas completas de 6:

```js
casillas = 6 * max(3, round(capacidadKg * 0.63 / 6))
```

38 kg → 24 · 44 kg (canasto) → 30 · 50 kg (mochila) → 30 · 68 kg (rastra) → 42.
Los contenedores siguen dando kg como hoy, y las casillas salen solas de ahí: no
hay que ficharles nada nuevo a los cuatro objetos.

### 4. Lo caro de verdad, que NO es esta fase

**No hay una sola imagen en toda la interfaz.** Son 71 recursos + 56 objetos =
**127 iconos** para que esto se parezca a Diablo 2 en vez de a una planilla con
bordes. Eso es la fase 3 y no entra en una fase normal.

**`Equipo.taller` es un `Map<id, usos>`: hoy no se pueden tener dos hachas**, y
`guardar()` le renueva los usos a la que ya está. Una grilla de verdad implica
instancias. Eso es la fase 2, y toca el archivo de guardado.

---

## Las tres fases

| | qué | tamaño |
|---|---|---|
| **1** | La grilla: casilleros, pilas derivadas del peso, mover/partir/juntar, y el bolso dibujado como grilla. `Equipo` sin tocar. | como la fase de la luz |
| 2 | Las herramientas entran a la grilla, con instancias y durabilidad propia. | más chica, pero toca el guardado |
| 3 | Los 127 iconos. | trabajo aparte |

---

## FASE 1 — La grilla · agente `casillero`

### Propiedad exclusiva de archivos

El agente escribe **sólo** estos cuatro:

- `src/systems/Inventario.js` — reescritura interna
- `src/ui/Bolso.js` — la grilla
- `src/systems/Partida.js` — **sólo** las tres líneas del inventario (105, 178, 311)
- `src/systems/Recursos.js` — **sólo agregar** la escalera y `pilaDe()`; no se
  toca ni una ficha ni una equivalencia existente

El coordinador se queda con `src/main.js`, el banco, el falsador y esta carta.
Cualquier otro archivo que haga falta se pide, no se toca.

### El contrato

**C1 · La API pública no cambia.** `agregar`, `quitar`, `cantidad`,
`disponiblePara`, `consumirPara`, `listar`, `comestibles`, `pesoKg`, `lleno` y
`capacidadKg` conservan firma y semántica exactas. Son 75 sitios de llamada en 16
archivos y **ninguno se edita en esta fase**. Lo que cambia es lo de adentro.

Excepción declarada: `items` deja de ser un `Map` público. Los tres usos directos
están en `Partida.js` y se reemplazan por `vaciar()`, `serializar()` y
`reponer()`, que es lo que `Equipo.js` ya hace.

**C2 · Las pilas se derivan.** `pilaDe(kg)` devuelve el valor de la escalera
`[1,2,5,10,20,50]` más cercano en log a `3 / kg`. Ninguna tabla de 71 renglones.

**C3 · Las casillas se derivan de la capacidad**, con la fórmula de arriba, en
filas de 6.

**C4 · Los dos topes muerden.** `agregar` devuelve lo que entró de verdad
considerando **peso y casillas**: si sobra peso pero no hay casilla, entra lo que
quepa en las pilas abiertas y se devuelve eso.

**C5 · Se llena la pila abierta antes de abrir casilla nueva.** Agregar 3 y
después 3 de madera blanda (pila 5) deja una casilla con 5 y otra con 1, no dos
con 3.

**C6 · Las posiciones son estables.** Sacar de la casilla 5 no compacta ni corre
la 6. Es lo que distingue una grilla de una lista con bordes.

**C7 · Mover, partir y juntar conservan el peso.** `mover(a,b)`: si el destino
está vacío mueve; si tiene lo mismo junta hasta el tope de la pila y deja el
resto; si tiene otra cosa intercambia. `partir(i)` manda la mitad a la primera
casilla libre. El peso total antes y después es idéntico, siempre.

**C8 · El guardado viejo entra.** Una partida guardada con
`inventario: [['madera_dura',3],['yesca',10]]` carga y da 3 y 10. `VERSION`
sigue en 1: el campo se lee en los dos formatos, como se hizo con el equipo.

**C9 · El bolso dibuja la grilla** y conserva lo que ya sabía hacer: tirar 1,
tirar todo, comer, curarte, encender las velas, el equipo y el taller arriba.
Clic para tomar y clic para poner —**no arrastrar**: cuesta el triple y da el 80 %
de la sensación—, y clic derecho parte la pila.

**C10 · Sin regresión de costo.** `pintar()` con la grilla llena no puede tardar
más que lo que tarda hoy la lista llena, medido en la página.

**C11 · La grilla se ve desde afuera, con esta forma exacta**, porque el banco la
mide y el bolso la dibuja:

```js
inv.casillas          // Array de largo casillasPara(capacidadKg)
                      // cada una es null, o { id: 'madera_dura', n: 3 }
inv.mover(a, b)       // true si algo pasó
inv.partir(i)         // true si partió
inv.vaciar()          // la muerte
inv.serializar()      // lo que va al guardado
inv.reponer(datos)    // acepta el formato viejo Y el nuevo
```

`items` deja de existir. Si `capacidadKg` cambia en caliente —y cambia: la
cestería y la mochila lo suben en pleno juego— el largo de `casillas` se ajusta
**sin perder nada**: achicar sólo se permite hasta la última casilla ocupada.

### Lo que NO es de esta fase

Las herramientas siguen en `Equipo`, fuera de la grilla. Los iconos no existen.
No hay contenedores en el mundo ni cadáveres que lotear. El agua de
`Recoleccion.js:460` la arregla el coordinador, no el agente: no es su archivo.

---

## Deuda que NO es de esta ronda

Sigue viva la lista de RONDA5.md, entera y sin tocar. Se le suman:

12. **`Recoleccion.js:460` tira el sobrante de agua al piso**: es el único
    `agregar` de los doce que no lee lo que devuelve. Un renglón, y es del
    coordinador.
13. **Los cuatro contenedores dan kg y nada más.** Con la grilla, `odre_cuero`
    («guarda 6 de agua») pide ser un contenedor de verdad y no un número suelto.

---

## FASE 1 CERRADA — 12/9/2026

**Banco 7/7 con 118 aserciones. Falsador 24 de 24, todos cazados por la aserción
declarada: cero puntos ciegos.** `vite build` limpio. El agente tocó sus cuatro
archivos y ninguno más.

### Lo que quedó

`Recursos.js` sumó `pilaDe` y `casillasPara`, y nada más: ni una ficha ni una
equivalencia cambiaron. `Inventario.js` se reescribió con `casillas` como única
fuente de verdad y un caché de totales que **se recuenta entero** después de cada
cambio en vez de actualizarse al vuelo — la decisión es del agente y es la
correcta: un caché que se toca a mano en siete lugares se desincroniza en el
octavo, y el síntoma sería que el bolso dice cuatro leñas y la grilla muestra
tres.

`capacidadKg` pasó a ser propiedad con `set`, que llama a `ajustarCasillas()`.
Por eso **la fase no necesitó una sola línea de cableado en `main.js`**:
`aplicarEfectos()` ya escribía `inventario.capacidadKg = …` derecho, y sin el
setter el canasto habría dado kilos y ningún casillero hasta el próximo arranque.
Se comprobó que `aplicarEfectos()` corre en tres puntos sueltos y no por cuadro.

`quitar` descuenta **desde el final hacia adelante**, así los restos del fondo se
van primero y las pilas llenas del principio quedan enteras. `mover` sobre una
pila ya llena devuelve `false` a propósito, para que la interfaz no suelte lo que
tiene tomado creyendo que lo puso.

### Los cuatro defectos del banco, que fueron míos

1. **La aserción imposible.** Para sacar del medio el tope de peso le puse al
   bolso 999 kg de capacidad — el reflejo de cuando peso y casillas eran cosas
   separadas. Pero las casillas se derivan de la capacidad: 999 kg dan 630
   casilleros, y hay 42 fichas livianas. La aserción pedía llenar 630 casillas
   sacando de una bolsa de 42. **El agente lo demostró en vez de acomodar su
   código**, que es exactamente lo que tiene que hacer. La forma correcta de
   dejar el peso afuera no es agrandar el bolso sino llenarlo de plumas.
2. **`achicar-pierde` no se veía**: la carga de prueba usaba seis casillas, así
   que recortar de 42 a 24 no tocaba ninguna ocupada. Ahora la carga pasa de la
   casilla 24 a propósito.
3. **`serializar-compacta` no se veía**: las casillas de la prueba estaban
   ocupadas de corrido desde la cero, y sin un hueco en el medio compactar da
   idéntico resultado que respetar las posiciones.
4. **La prueba de las 500 cargas perdonaba una grilla estrangulada.** Sólo
   contaba fallo si además el peso estaba por debajo del 90 % del tope, y con la
   grilla ahogada a 18 casilleros las cargas llegaban a 34 de 38 kg y pasaban. El
   fallo es que la grilla se llene mientras el bolso todavía quiere peso, y punto.

Y dos del falsador: un parche que decía compactar el guardado **nunca se
plantaba** porque buscaba un array y `serializar()` devuelve `{casillas:[…]}`
—un falsador que no planta lo que dice es peor que no tenerlo—, y otro que
escondía todas las pilas en vez de las del mismo recurso, con lo que el banco
caía por la sección equivocada.

### C10 · el costo, medido por el coordinador y no por el informe

El agente informó que la grilla sale a **0,58× el costo** de la lista. **No
reproduce.** Medido alternando A/B/A/B con `git stash`, la misma carga de 37,9 kg
y la misma semilla, en tandas de 20 pintadas para tener resolución de verdad —el
reloj del navegador cuantiza a 0,1 ms y una sola pintada no se puede medir:

| | mediana de `pintar()` |
|---|---|
| lista vieja | 0,755 · 0,765 · 0,760 · 0,765 ms |
| grilla nueva | 0,775 · 0,775 · 0,765 ms |

**La grilla sale +0,015 ms, o sea un 2 % más cara, no un 42 % más barata.** C10
se cumple —no hay regresión— pero la ganancia informada no existe. La medición
del agente decía «los dos bolsos vivos a la vez en la página», que es otra cosa.

### Verificado en pantalla

Compañero de navegador 11/11 contra el juego corriendo: 24 casilleros dibujados
para 24 casillas, 23 llenas para 23 ocupadas, las cantidades escritas, el detalle
aparece al apuntar con «Tirar», y clic-clic mueve sin cambiar un gramo.

Tres defectos del compañero, todos míos: buscaba `data-casilla` cuando la grilla
marca `data-cs` —un nombre que el contrato nunca fijó y que di por sentado—,
usaba `requestAnimationFrame` para ceder, que con la pestaña oculta no dispara
nunca, y guardaba los nodos entre los dos clics, cuando **tomar repinta el panel
entero** y el segundo nodo quedaba desprendido.

### Lo que hay que mirar jugando

1. **La grilla queda debajo del pliegue.** El panel abre en el taller y la
   primera casilla está a 718 px de arriba, con 618 visibles: se abre el bolso y
   lo que se ve es el taller. Es herencia del orden viejo, pero ahora el bolso
   tiene nombre y no se ve.
2. **Las abreviaturas de tres letras se repiten.** En la captura hay cuatro «Arc»
   y dos «Tos» en casillas distintas. Es el argumento de la fase 3 hecho visible.
3. **«Tirar 1» y «Todo» son del recurso, no de la casilla.** Están sobre el
   detalle de un casillero pero llaman a `quitar(id, n)`, que opera sobre el
   total: con doce maderas en tres pilas, «Todo» tira las doce. Lo dice el
   detalle en texto, pero es la costura más visible entre la grilla y la API vieja.
4. **Tomar es marcar, no levantar**: no hay pila pegada al cursor.
5. **`lleno` sigue siendo sólo el peso.** Con los 24 casilleros ocupados y 10 kg
   libres, `lleno === false`. Es lo que pedía C1 al pie de la letra. El agente
   agregó `sinCasillas` y **no lo usa nadie**: queda para decidir.

---

## FASE 2 — Las herramientas entran a la grilla · agente `instancia`

### Lo que se midió antes de encargar nada

**Los 56 «objetos» son 44 cosas y 12 recetas.** Los doce que no tienen ni peso ni
durabilidad —`cordel_fibra`, `punta_litica`, `flechas`…— llevan `produce` y
`esReceta`, y `Fabricacion.js:118` los manda al inventario como recurso: son la
receta que fabrica `cordel`, no un cordel que se tenga. **Nunca pasan por
`Equipo`**, así que no son de esta fase. Siete de ellos tienen además el recurso
gemelo ya fichado (`cordel` 0,03 kg, `punta` 0,02, `mango` 0,4…), que es de donde
salía la confusión.

Queda **una** cosa sin ficha: `encerado` no es receta y no tiene ni kg ni
durabilidad. Es un agujero de dato, no de código.

**Las herramientas pesan poco: el que se acaba son los casilleros, no los kilos.**
Ocho herramientas plausibles suman **3,1 kg** de los 38. Simulando 2000 cargas
mixtas con el equipo ya adentro de la grilla:

| herramientas encima | casillas | se ahoga | casillas p90 |
|---|---|---|---|
| 0 | 24 | 0 % | 16 |
| 4 | 24 | 0 % | 19 |
| 6 | 24 | 0 % | 21 |
| 8 | 24 | **0 %** | 22 |
| 10 | 24 | 6 % | 24 |
| 12 | 24 | **22 %** | 24 |

**Se deja el coeficiente en 0,63 y no se agranda la grilla.** Hasta nueve
herramientas encima no pasa nada; de ahí para arriba empezás a perder lugar de
carga, y **eso es la regla del juego, no un defecto**: es exactamente lo que uno
siente en Rust cuando sale con el banco de trabajo a cuestas. Con la mochila
puesta —30 casillas— diez herramientas vuelven a entrar sin apretar (1 %).

Se probó subir el coeficiente a 0,75 y 0,85 y las dos dan 30 casillas y 0 % de
ahogo con ocho herramientas; se descarta porque compraría comodidad rompiendo lo
que la fase 1 midió: con 30 casillas la grilla deja de morder también el día de
juntar liviano, y vuelve a ser decoración.

### Propiedad exclusiva de archivos

- `src/systems/Equipo.js` — el grueso: instancias en vez de `Map<id, usos>`
- `src/systems/Inventario.js` — la grilla acepta instancias
- `src/ui/Bolso.js` — las herramientas dibujadas en la grilla, y las cuatro ranuras
- `src/systems/Fabricacion.js` — **sólo** las dos líneas que tocan al equipo
- `src/systems/Partida.js` — **sólo** la migración del guardado

`Recursos.js` **no se toca en esta fase**: `pilaDe` y `casillasPara` quedaron bien
y las herramientas no son recursos. `main.js` es del coordinador.

### El contrato

**D1 · Una casilla puede tener una instancia.** Los recursos siguen siendo
`{id, n}`. Un objeto es `{id, n: 1, usos: 87}`. **Tener `usos` es lo que lo hace
una instancia**, y una instancia **nunca apila**: dos hachas son dos casillas,
aunque una esté al 40 % y la otra al 90 %. Ése es el punto entero de la fase.

**D2 · `Inventario` no aprende de herramientas.** No importa `herramientas.json`
ni sabe qué es una durabilidad. Recibe un catálogo opcional —`id → {kg}`— por el
constructor y con eso pesa lo que no está en `RECURSOS`. Todo lo demás de la
fase 1 sigue igual: los dos topes, las posiciones estables, `mover`, `partir`.

**D3 · Lo puesto vive en la ranura, no en la grilla.** Equipar **saca** la
instancia de la grilla y la pone en `puesto[ranura]`; desequipar la devuelve al
primer casillero libre, y **falla limpio si no hay ninguno**. Lo puesto **sí pesa**
—lo estás cargando— pero no ocupa casillero, que es lo que hace que valga la pena
tener el hacha en la mano y no en el bolso.

**D4 · Fabricar un hacha teniendo un hacha da dos hachas.** Hoy `guardar()` le
renueva los usos a la que ya está, y eso deja de ser cierto. Si no hay casillero
ni ranura libre, **la fabricación no se hace y se avisa**, igual que ya hace la
rama de `produce` con el peso: `Fabricacion.js:122` hoy llama a `equipo.guardar()`
sin comprobar nada, y ahí es donde el objeto se perdería en silencio.

**D5 · La durabilidad es de la instancia.** `desgastar()` gasta la que está en la
mano, no «el hacha». `reparar()` repara una instancia. Dos hachas se gastan por
separado y el bolso muestra el estado de cada una.

**D6 · El guardado viejo entra y `VERSION` sigue en 1.** Un guardado con
`equipo: {taller: [['hacha_piedra', 42]], puesto: {mano: 'hacha_piedra'}}` tiene
que llegar como una instancia de 42 usos puesta en la mano. Si el guardado trae
más objetos que casilleros libres, se prende `desbordado` y **no se pierde nada
en silencio**.

**D7 · La API que usa el resto del juego no cambia de forma.** `enRanura(ranura)`
sigue devolviendo algo con `.id` y `.nombre` —lo leen `main.js`, `Cuerpo.js`,
`Caza.js` y `Recoleccion.js`—, `suma(clave)`, `puede()`, `mejorPara()`,
`luzActiva()`, `encender()`/`apagar()` y `listar()` siguen andando. La llama, la
lluvia que la apaga y el reloj del mundo de la ronda 5 **no se rompen**.

**D8 · Nueve herramientas encima no ahogan la grilla**, y doce sí. Lo primero es
una aserción; lo segundo se mide y se anota, porque es la regla del juego.

**D9 · Sin regresión de costo** en `pintar()` contra la fase 1: 0,775 ms de
mediana con la carga de 37,9 kg, medido en tandas de 20 pintadas.

### Lo que NO es de esta fase

Los iconos (fase 3). Las 12 recetas, que no pasan por `Equipo`. Ficharle un peso
a `encerado`: es dato, y lo decide el dueño. Contenedores en el mundo ni
cadáveres que lotear.
