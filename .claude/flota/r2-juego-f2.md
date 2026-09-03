# Bitácora — frente 2 (`recursos`) del jefe `juego`, ronda 2

Encargo: los tres recursos que el dueño **nunca vio jugando** —caña colihue,
arcilla y arena—. Primero medir, después arreglar.

Escribo en: `src/data/*.json`, `src/systems/Recursos.js`, esta bitácora y
`.claude/flota/r2-recursos.mjs`. Todo lo demás es sólo lectura.

---

## 1. Diagnóstico

### Caña colihue — NUNCA. La cortó un `.slice(0, 26)`.

`src/world/Vegetacion.js:65-68` arma la lista de especies leñosas así:

```js
this.especies = flora.especies
  .filter(e => ['arbol', 'arbusto', 'cana'].includes(e.tipo))
  .filter(e => e.altitudMinM !== null && e.altitudMaxM !== null)
  .slice(0, 26);
```

El filtro **sí** deja pasar el tipo `cana`. El que la mata es el `.slice(0, 26)`:
la lista filtrada tiene **38 especies** y `cana_colihue` cae en el **índice 32**.
O sea que nunca se le crea el lote, nunca se instancia una sola caña y
`vegetacion.masCercana()` no la puede devolver jamás. **No es que sea rara: no
existe.** Medido con Node sobre `flora.json`, no leído de una bitácora.

El corte se lleva puestas **12 especies**, y no son doce cualesquiera:

| # | especie | qué se pierde con ella |
|---|---|---|
| 26 | palo_piche | resina |
| 27 | espino_negro | madera dura de estepa |
| 28 | mata_negra | madera dura de estepa |
| 29 | murtilla_negra | fruto de altura |
| 30 | neneo | **la estepa oriental se queda sin su arbusto insignia** |
| 31 | quilembay | ídem |
| **32** | **cana_colihue** | **caña — la de la caña de pescar y el arco** |
| 33 | retamo | exótica invasora |
| 34 | rosa_mosqueta | exótica invasora, fruto |
| 35 | pino_oregon | **exótica invasora + pinocha (yesca)** |
| 36 | pino_murrayana | ídem |
| 37 | pino_ponderosa | ídem |

Las tres coníferas exóticas y las dos invasoras leñosas están **todas** afuera.
El juego cuenta la tesis del control de exóticas y de la pinocha como yesca, y
ninguna de las plantas que la sostienen se dibuja nunca.

`cana_colihue` tiene `recursoJuego: "caña"` y `rendimientoRecurso: 25`, o sea
que `cosechaDe()` daría **4 × caña** por mata, más 2..4 semillas (es
`comestible` con `parteComestible: "semilla"`). El vocabulario ya está resuelto:
`normalizar('caña') === 'cana'` y `RECURSOS.cana` existe. **Todo el camino está
hecho salvo el último metro.**

### Arcilla — probabilidad exactamente 0. Es código muerto por orden de ramas.

`Recoleccion.js:284` empuja arcilla cuando se levanta una **piedra** y
`this._aguaCerca()`. Pero `quePuedoHacer()` tiene, más arriba, en la línea 124:

```js
if (this.jugador.enAgua || this._aguaCerca()) { ... return { tipo: 'beber', ... }; }
```

`actuar()` llama a `quePuedoHacer()` y despacha sobre su resultado, sin que el
jugador se mueva en el medio. O sea: **`acc.tipo === 'sotobosque'` implica que
`_aguaCerca()` dio falso**, y la condición de la línea 284 es la misma función,
sobre la misma posición, en el mismo tick. Nunca puede dar verdadero.

No es «poco probable»: es **imposible**. El 45 % de la línea 284 nunca se tira.

### Arena — el mismo muro del frente 1, y además un círculo

`yacimientoEn()` sí devuelve `arena` junto al agua con pendiente < 0,22. Pero
`extraer()` pasa por `evaluar()`, que niega **siempre** en `parque` y en
`reserva`, y el spawn está en `reserva`. Es el defecto del frente 1: **no lo
duplico**.

Lo que sí es mío de medir es el **círculo que hay detrás**: aun parado en
jurisdicción `fuera`, `evaluar()` pide `tieneHerramienta()`, y la herramienta
sale de la fragua, y la fragua pide arcilla, y la arcilla es inobtenible. O sea
que **arena es inalcanzable aunque se arregle la jurisdicción**, hasta que se
arregle arcilla.

---

## 2. Hecho

(se va llenando)

---

## 3. Siguiente

---

## 4. Descartado
