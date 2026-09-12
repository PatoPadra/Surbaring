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
