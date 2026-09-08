# Ronda 4 — Revisión de economía: `src/data/herramientas.json`

> El agente `economia` escribió el banco (`r4-economia.mjs`, 1040 líneas) y lo corrió
> (`r4-salida.txt`, 301 líneas), y cayó por límite de sesión antes de pasar los números
> a prosa. Este informe lo redacta el jefe **desde la salida del banco**, sin agregar
> hallazgos propios. La evidencia de cada número está en `r4-salida.txt`.
>
> El banco se autocomprueba: **7 mutaciones plantadas, 7 detectadas, 0 ciegas.** Es la
> respuesta a la trampa nº 8 de `ESTADO.md` —un banco que da verde sin ejercitar nada—
> y por eso los números de acá se pueden creer.

**34 hallazgos: 12 críticos, 17 graves, 4 medios, 1 menor.**

---

## 1. Alcanzabilidad — cuatro materiales sostienen 10 objetos y no los produce nada

El cierre transitivo desde un jugador con las manos vacías deja fuera a `moscas` y
`poncho_witral`, y expone cuatro compuertas que el dataset da por sentadas:

| Material | Objetos que caen con él | Estado |
|---|---|---|
| `cera` | 4 de 57 | Sólo la produce la colmena, que pide `cera` para la de cuadros |
| `asta` | 3 de 57 | `desmogue_astas` existe en `caza.json` y `Recoleccion.js:420` nunca lo elige |
| `pluma` | 2 de 57 | No lo entrega ningún sistema |
| `miel` | 1 de 57 | Sólo la colmena |
| `lana` | 2 recetas | **No lo produce nada en ningún dataset del juego** |

Además, el dataset declara de nivel 0 tres recursos que el código no entrega —`hongo`,
`pluma`, `miel`— y no declara la fuente de seis que él mismo pide: `madera`,
`madera_dura`, `obsidiana`, `resina`, `lana`, `junco`.

## 2. La escalera de herramientas no está encadenada

El hallazgo que más duele, porque invalida la premisa del árbol:

- **`herreria_colonial.requiere` está vacío.** El nivel 4 no exige el nivel 3, ni el 2, ni
  el 1. Se llega al hacha de hierro **sin fabricar una sola herramienta de piedra**.
- Cuesta 20 puntos de saber: **10 especies identificadas, el 4,3 % del pool disponible**.

O sea que el jugador que sabe lo que hace puede saltear los cuatro niveles de abajo. La
progresión que la ronda vino a construir se puede esquivar entera por un `requiere: []`.

## 3. El árbol entero cuesta el triple de lo que el juego reparte

**1480 puntos pedidos contra 469 disponibles: faltan 1011.** El juego no entrega, ni
identificando todo lo identificable, ni la mitad de lo que su propio árbol cobra.

## 4. Peso — sacar la equivalencia `madera_dura → tronco` deja tres obras fuera del bolso

| Obra / tecnología | Peso con `tronco` real | Techo |
|---|---|---|
| `cabana_troncos` | **92,4 kg** | 38 kg base, 86 con todos los contenedores |
| `construccion_troncos` | **92,4 kg** | idem |
| `capilla_troncos` | 60,2 kg | idem |
| `casa_piedra` | 69,2 kg | no entra en el bolso base |
| `estilo_bustillo` | 72,1 kg | no entra en el bolso base |
| `refugio_montana` | 46,4 kg | no entra en el bolso base |
| `reactor_investigacion` | 144,5 kg | **no entra ni con todos los contenedores** |

Y una omisión del dataset: **ninguno de los 57 objetos declara peso**. Fabricarlos no
cuesta nada de bolso, lo que rompe la única restricción real que el juego tenía.

## 5. Curva — el nivel 1 tiene 23 objetos y el 0 y el 3 tienen 3 cada uno

Media de 11,4 por nivel. El nivel 1 está inflado a 23; el 0 y el 3 quedan en 3.

Y tres objetos están **mal etiquetados**: `candil_grasa`, `ahumador` e `hidromiel_receta`
declaran nivel 2 y recién son alcanzables en nivel 3, porque sus materiales cuelgan de
compuertas más altas de las que dicen.

## 6. Referencias sueltas

- `mosca` se produce, es munición de `equipo_mosca` y **no tiene ficha en ningún lado**.
  Mi validador la había puesto a mano en la lista blanca y por eso no la vio.
- `vela` se produce, es `cat: material` y **nada la consume**.
- `engancheAlCodigo` dice que hay que agregar 11 recursos y el archivo define 16.
- 28 materiales huérfanos preexistentes, que no los trae este archivo (`plata`, `bronce`,
  `bateria`, `motor`, `combustible_nuclear`…). Es la deuda vieja del árbol de saberes, ya
  documentada en el README, y no es de esta ronda.
