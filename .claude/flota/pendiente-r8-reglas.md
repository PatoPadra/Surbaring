# Pendiente de la fase 7 · `reglas` — las decisiones del dueño y las deudas

Agente `reglas`, ronda 8. Escrito al terminar, 23/9/2026.
Archivos que toqué, y ninguno más: `src/systems/Partida.js`,
`src/systems/Recoleccion.js`, `src/systems/Fabricacion.js`,
`src/systems/Fundicion.js` (una línea: exportar el radio), `src/ui/Codice.js`
(sólo `_pintarNormativa`), `src/ui/Iconos.js` y `src/ui/Bolso.js` (sólo
comentarios), `src/data/herramientas.json`, `src/data/historia.json` (sólo la
cestería). **Nada de `main.js`** — el único renglón que hacía falta lo puso el
jefe por su lado mientras yo cerraba; está en el punto 3.
**Ningún banco ni falsador** — hay una cuenta para el jefe en el punto 5.

**Cómo quedó medido:** banco de la fase 7 **7/7** entero (30 aserciones de las
guardas 1 a 5, los 16 bancos de la regresión en su número y `vite build` en 0);
falsador **14/15 «lo vio»** con los **3 controles verdes**, y el que falta es un
defecto del propio falsador, con la cuenta en el punto 5.

**En una frase:** morir ahora cuesta todo lo que llevabas encima y apaga la
llama; la lana del coirón baja a 1 de cada 4 y el poncho pasa de 17,6 a 47,2
apretadas; recolectar dentro del Parque queda declarado como licencia con la Ley
22.351 art. 5, dicho una sola vez y leíble en el códice; la estación de
fabricación se busca entre todas las que están a mano; y la cestería deja de
sumar dos veces.

---

## 1 · Lo que hice, guarda por guarda

### G1 · Se pierde todo (`Partida.js`)

`registrarMuerte()` anota primero y saca después, que es el orden que esta misma
función ya había tenido mal una vez:

1. anota el bolso (`listar()`), las herramientas sueltas (`instancias()`) y **lo
   puesto** (las cuatro ranuras, con su ranura y sus usos);
2. lee `pesoKg` **antes** de vaciar las ranuras, porque el peso de lo puesto
   entra por `pesoAparte()` y si no el quillango y el canasto no pesarían nada;
3. `equipo.apagar(fecha del mundo)` **antes** de vaciar las ranuras: `apagar()`
   le cobra el uso a la instancia que ardía, que es la de la mano, y con la
   ranura ya en null la llama se apagaría igual pero por «se te cayó», avisándole
   al jugador de un accidente en vez de una muerte;
4. las cuatro ranuras a `null` —no por `desequipar()`, que devuelve al bolso—,
   `equipo.alCambiar()` (que en `main.js` es `aplicarEfectos`, así que la
   capacidad vuelve a 38 sola) y recién ahí `inventario.vaciar()`.

Lo puesto va **primero** en `ultimaMuerte.perdido`: `Fin.js` nombra los seis
primeros y resume el resto, y de todo lo que se pierde el hacha que llevabas en
la mano es lo que uno quiere leer, no las cuatro fibras.

Las trampas no se tocan (no son del bolso) y el guardado viejo carga igual:
`VERSION` sigue en 1 y no se agregó ni se sacó ningún campo del formato.

### G2 · La lana, 1 de cada 4 (`Recoleccion.js`, `herramientas.json`)

`EXTRAS_MATA.coiron` pasa a `probabilidad: 1 / 4`. El criterio viejo **está
escrito, no borrado**: el comentario dice qué decía (el peso de la paja no puede
superar al de la lana: 2 fibras de 100 g contra una lana de 150 g ⇒ una cada
apretada y media), qué no miraba (cuánto tiene que costar el poncho) y cuál lo
reemplaza (el costo: 48 apretadas, una caminata y no una parada). Y dice lo que
se resigna, con el número: 48 apretadas traen 96 fibras, 4,8 kg, contra 1,8 kg de
lana — la paja pesa **2,7 veces** lo que la lana. Se resigna a sabiendas porque
la fibra se suelta y la lana no.

Lo mismo en la licencia `lanaDelCoiron`: `que` pasa a «una de cada cuatro»,
`porQueSeToma` conserva el criterio de la ronda 7 y hay un campo nuevo
`porQueCambio` con la cuenta entera, y `nota` apunta al número real.

### G3 · La licencia de recolección, dicha (`herramientas.json`, `Recoleccion.js`, `Codice.js`)

- **Declarada** como `recoleccionEnElParque`, última de `licenciasDeJuego`, con
  la Ley 22.351 art. 5 citada por lo que dice de verdad: prohíbe la explotación
  agropecuaria y forestal y «cualquier tipo de aprovechamiento de los recursos
  naturales», y además «toda otra acción u omisión que pudiere originar alguna
  modificación del paisaje o del equilibrio biológico». Sin excepción por
  cantidad ni por juntar sin cortar. Y dice el otro lado: en las Reservas el
  art. 10 admite actividades reglamentadas, y el arranque está en la Reserva.
  Y con cuánto mapa: medido el 23/9 sobre las mismas cajas de `Limites.js`, en
  una grilla de 400 × 400 sobre los 65.536 m del mundo, **Parque 60,5 %**,
  Reserva 25,4 %, fuera del área protegida 14,1 %; y a menos de 5 km del punto
  de partida, **100 % Reserva**. (La primera redacción decía «la mitad más alta
  del mapa» y la saqué: el cerro más alto de la zona, el Catedral, cae del lado
  de la **Reserva** en el trazado esquemático de `Limites.js`, así que era una
  frase que no podía sostener. Queda la superficie, que sí medí.)
- **Dicha una vez**, en el mismo renglón del rinde (`HUD.aviso()` es una sola
  ranura), con la marca en `_licenciasDichas`, el mismo conjunto de la lana.
- **Sólo en el Parque.** La jurisdicción sale de `this.limites` y, si nadie la
  cableó, del `limites` que ya tiene `Mineria` — es el mismo objeto. Sin límites
  no se dice nada.
- **En el códice**: bloque nuevo «Dónde el juego se aparta de la norma» en la
  pestaña Normativa, entre las normas citadas y «Lo que intentaste». Muestra las
  **siete** licencias enteras —las seis que había más ésta— con qué afloja, la
  norma real, por qué se toma y qué NO se afloja. Hasta hoy ninguna de las siete
  se podía leer en ninguna pantalla: cada una se decía una vez en un cartel de
  cuatro segundos y después no existía más. El número del encabezado sale de
  `licencias.length`, así que la próxima entra sola.

Se dice en tres gestos y no en todos, a propósito: el sotobosque, la planta y la
orilla, que es lo que «juntar» quiere decir. La carroña la avisa `Caza`, y la
chatarra y la cantera ya pasan por la negativa de `Mineria`, que explica el mismo
artículo 5 y lo registra en el códice. Y sólo si **entró algo al bolso**: la
licencia es por aprovechar, y una apretada que no puso nada no aprovechó nada.

### G4 · Las deudas

- **La estación, entre todas las que están a mano.** `estacion()` ya no llama a
  `cercano()` sin filtro. `'fogata'` (que no nombra a la fogata sino al fuego)
  pide `usaFuego(h) && arde(h)`; cualquier otro id pide `h.def.id === id &&
  arde(h)`. Los tres casos medidos quedan bien: fragua a 6 m con fogata a 2,
  fogata a 5 m con telar a 1, y fogata prendida a 5 m con una apagada a 1. Y el
  contrario también: telar a 1 m **sin** fogata ya no cuece brea.
- **Un solo radio.** `Fundicion.js` exporta `RADIO_HORNO_M = 8` (es el único
  cambio en ese archivo) y `Fabricacion.js` lo importa. `RADIO_ESTACION_M` no
  existe más.
- **El «115»** sale de los nueve comentarios. Los números nuevos están
  recontados, no copiados: **122** dibujos (`IDS.length`), **74** de `RECURSOS`
  y **48** objetos de `herramientas.json`; los **16** que faltan para los **64**
  objetos llevan `produce` o `esReceta`. La hoja va en **137,78 kB** de 140.
- **`efectosAAgregar` queda en `[]`**, y al lado hay un `efectosAplicados` con
  qué tenía, la fecha del recuento y por qué se vació (ver punto 4).

### G5 · La cestería suma una vez (`historia.json`)

Fuera `capacidadExtraKg: 6` del efecto de `cesteria_junco`, con un `notaRonda8`
que cuenta la doble suma. El bono lo da el canasto puesto, que ya lo declaraba, y
`main.js:509` no hace falta tocarlo: sigue sumando `saberes.suma` +
`equipo.suma`, y ahora uno de los dos es cero. Bolso: **38** kg con la cestería
aprendida, **44** con el canasto puesto.

---

## 2 · Lo que predigo que va a medir cada guarda

Corrido contra `src` con `BANCO_SECCIONES=muerte,lana,licencia,deudas,cesteria`,
**5/5**, 30 aserciones. Con la cuenta:

| Guarda | Qué mide | Antes | Ahora |
|---|---|---|---|
| 1 · muerte | ranuras que quedan puestas | 4 | **0** |
| 1 · muerte | `equipo.encendida` | `antorcha` | **null** |
| 1 · muerte | ids de lo puesto que nombra `perdido` | 0 de 4 | **4 de 4** |
| 1 · muerte | bolso, trampas, guardado viejo | ya estaban bien | siguen |
| 2 · lana | lana en 4000 apretadas sembradas | 2724 (68,1 %) | **1016 (25,4 %)** |
| 2 · lana | poncho: 12 lanas ÷ la tasa | 17,6 apretadas | **47,2** (tope: 47 ± 15 % ⇒ 39,9 a 54,1) |
| 3 · licencia | `licenciasDeJuego` con «22.351» y «art. 5» | no está | **`recoleccionEnElParque`** |
| 3 · licencia | «22.351» en el HTML de Normativa | no | **sí, 6 licencias** |
| 3 · licencia | primera apretada en el Parque / segunda | no dice / no dice | **dice / no dice** |
| 3 · licencia | dos apretadas en la Reserva | no dice | **no dice** |
| 4 · deudas | fragua a 6 m con fogata a 2 | `falta_estacion` | **`lista`** |
| 4 · deudas | fogata a 5 m con telar a 1 | `lista` **por el motivo equivocado** | **`lista`** |
| 4 · deudas | telar a 1 m sin fogata | `lista` (mal) | **`falta_estacion`** |
| 4 · deudas | fogata apagada a 1 m, prendida a 5 | `falta_estacion` | **`lista`** |
| 4 · deudas | `const RADIO_*` en `Fabricacion.js` | 1 | **0**, importado |
| 4 · deudas | «115» en `Iconos.js` / `Bolso.js` | 9 comentarios | **0** |
| 4 · deudas | entradas de `efectosAAgregar` ya aplicadas | 9 | **0** (la lista quedó vacía) |
| 5 · cestería | kg sin canasto / con canasto | 44 / 50 | **38 / 44** |

**Secciones 6 y 7: corridas enteras y verdes.** Alcancé a lanzar el banco
completo antes de que el jefe me pidiera no correrlo (ya estaba en marcha y
terminó solo, así que no hubo dos corridas a la vez de punta a punta):

```
  VERDE  ejercitó  16  6 · SIN REGRESIÓN — la ronda 7, los iconos de la ronda 6, y las fases 1 a 6
  VERDE  ejercitó   1  7 · ARRANQUE — vite build
  VERDE  total 7/7
```

Los 16 bancos de la regresión dieron su número esperado, incluidos los tres que
podían tocar lo que cambié, y `vite build` salió con 0. Lo que **podía** tocar la
regresión y por qué no la tocó:

- `banco-r7-fase5.mjs` (9/9) mide el telar a 30 m, a 12 m y con una fogata a 1 m
  y el telar a 5. Mi `_estacionDeObra()` conserva el radio (8 m), la cadena de
  nombres (`hornos` del mapa → `definicionesHorno` → `nombreDe(id)`, así que el
  motivo sigue diciendo «telar») y el texto «Esto se hace al lado de: …».
- `banco-r6-fase3.mjs` (6/6) mide la hoja de iconos: **no agregué ni saqué
  ningún dibujo**, sólo comentarios. Sigue en 137,78 kB / 140 y 122 iconos.
- Lo que toqué de datos no cambia ninguna receta ni ningún material: la lana es
  una probabilidad, la licencia es un objeto nuevo en una lista que nadie
  recorre para jugar, `efectosAAgregar` no lo lee ni una línea de `src/`
  (`grep` sobre todo `src/`: la única aparición es el propio JSON) y de la
  cestería salió un efecto que sólo leía `main.js:509`.

**Falsador** (`banco-r8-fase7.falsar.mjs`, corrido entero, y antes
`--sintaxis`: los 18 se plantan): fuente limpia todas verdes, **lo vio 14/15**,
por otro motivo 1, no lo vio 0, no se pudo plantar 0, **controles 3 verdes**. El
que no es «lo vio» es un defecto del falsador y no del código: la cuenta está en
el punto 5.

---

## 3 · Lo que necesito que cablee el jefe en `main.js` — YA ESTÁ HECHO

**Era una línea, y sin ella la pestaña Normativa no mostraba ninguna licencia en
el juego aunque el banco estuviera verde.** `main.js:393` armaba
`codice.normativa` con tres datasets y `herramientas.json` no estaba:

```js
  codice.normativa = {
    caza: normativaCaza, mineria: datosMineria, construccion: datosConstruccion,
    herramientas,                    // ← esto
  };
```

**El jefe lo puso mientras yo terminaba** (lo vi en `git status`), y llegó por su
lado: leyendo `main.js` contra mi código, no midiendo. Comprobado con la forma
real que arma `main.js` —`normativa` con `herramientas` y nada de licencias
sueltas—: el bloque se dibuja, cita la Ley 22.351 y pinta las **7** licencias. Y
sin el cable no explota: devuelve la pestaña de antes, sin el bloque.

`_pintarNormativa()` lo busca por cuatro caminos (`normativa.licenciasDeJuego`,
`normativa.herramientas.licenciasDeJuego`, `this.licenciasDeJuego`,
`this.herramientas.licenciasDeJuego`), así que cualquiera sirve; el que puso el
jefe es el que sigue la convención del archivo.

**Y es exactamente el caso del «banco sintético no alcanza»:** el banco arma su
propio `normativa` con `herramientas` adentro, así que la guarda 3 queda verde con
o sin el cable. **Ninguna de las 30 aserciones de esta fase se habría puesto roja
con la pestaña vacía en el juego.** Lo dejo escrito porque es el único agujero de
medición que le encontré al contrato: si algún día la fase 7 se revisa, la
aserción que falta es «`main.js` le pasa las licencias al códice», leída del
archivo y no de un objeto armado en el banco.

**Lo que NO hace falta cablear:** `recoleccion.limites`. Lo busco en
`this.limites` y, si no está, en `this.mineria.limites`, que `main.js:376` ya
cablea y es el mismo objeto `Limites`. Si algún día se quiere explícito, una
línea `recoleccion.limites = limites` junto a las otras no rompe nada y ahorra el
rodeo.

---

## 4 · Lo que encontré y no está en el contrato

1. **`RONDA8.md` dice que las diez entradas de `efectosAAgregar` estaban
   aplicadas. Son nueve.** La décima, `lasca_obsidiana`, pide agregarle
   `mango_labrado` a su `efecto.herramienta` y **no hay que aplicarla**: la fase
   5 de esta misma ronda se lo sacó a propósito —el mango se labra con cualquier
   filo y pedir la obsidiana dejaba la primera hacha a 1500 m— y hoy
   `mango_labrado` tiene `tecnologia: null` y pide filo por `pideHerramienta`.
   Aplicar ese pedido sería deshacer una decisión posterior. Quedó anotado en
   `efectosAplicados.unaRetirada`, con el motivo. El banco medía bien: contaba
   nueve.
2. **El comentario de los atributos heredados de `Iconos.js` estaba a la mitad.**
   Decía «se ahorran 14 kB — 648 repeticiones». Recontado el 23/9 sobre la hoja
   de verdad: **605 elementos con trazo** en los 122 dibujos, y los dos atributos
   (`stroke-linecap` y `stroke-linejoin`) ocupan **47 bytes** cada uno junto, o
   sea **27,8 kB**. Los 14 kB eran el ahorro de **uno solo** de los dos (605 ×
   22 B = 13,6 kB hoy), y 648 era la cuenta de la ronda 6. Está corregido y dicho
   en el comentario.
3. **La hoja de iconos, a 2,22 kB del techo** (137,78 de 140, 122 iconos): no la
   toqué, no agregué dibujos y no la muevo. Ya está en `pendiente-r8-piedra.md` y
   es decisión de la flota.
4. **Una costura de `Equipo`, mínima, que no toqué porque el archivo no es mío.**
   `apagar()` guarda en `_resto[id]` lo que le quedaba a la antorcha, y ese
   sobrante es por id y no por instancia. Al morir eso queda escrito aunque la
   antorcha se haya perdido. **No tiene consecuencia**: la única forma de volver
   a tener una antorcha después de morir es fabricarla, y `Equipo.guardar(id)`
   hace `delete this._resto[id]`. Lo anoto para que quede medido y no descubierto.
5. **`Equipo` no tiene un `vaciar()`.** Las cuatro ranuras las pongo en `null`
   desde `Partida`, sobre `equipo.puesto`, que es público y lo leen `main.js`,
   `Cuerpo.js`, `Caza.js` y `Recoleccion.js`. Un `Equipo.vaciar()` que apague y
   limpie sería el lugar correcto, pero `Equipo.js` no es de esta fase.
6. **`Fin.js` muestra seis y resume el resto.** Con las cuatro ranuras adentro,
   morir cargado deja el renglón en «4 puestos + 2 del bolso y N cosas más». Por
   eso lo puesto va primero. Si alguna vez se quiere separar en dos renglones
   —«llevabas puesto» / «cargabas»—, el dato ya está: cada entrada de lo puesto
   trae su campo `ranura`.
7. **El motivo de la estación apagada cambió de texto.** Antes: «La fragua está
   apagada.» Ahora: «Falta el fuego: la fragua está sin prender.» Es para que no
   concuerde en género con el nombre: el viejo decía «La horno de barro está
   apagada». Ningún banco mide ese texto (busqué en los veinte de `.claude/flota`).

---

## 5 · El defecto del falsador, con la cuenta (no lo toqué)

`banco-r8-fase7.falsar.mjs`, defecto **`muerte-deja-llama`** (línea 79):

```js
enJs('systems/Partida.js', envolverMuerte('if (eq && prendidaAntes) eq.encendida = prendidaAntes;')),
```

**No se puede plantar, y no depende de cómo escriba yo el código.**
`Equipo.encendida` es un accesor de sólo lectura (`Equipo.js:461`:
`get encendida() { return this._llama?.id ?? null; }`) y no hay `set encendida`
en todo el archivo. Los módulos ES corren en modo estricto, así que asignarle
tira `TypeError`. Reproducido contra la copia plantada:

```
MAL  la sección corrió sin explotar
     [Cannot set property encendida of #<Equipo> which has only a getter
      at Partida.registrarMuerte (…/.tmp-falsar-r8f7/sintaxis/src/systems/Partida.js:500:43)
      at muerte (…/banco-r8-fase7.mjs:99:15)]
```

La sección 1 entera explota, así que el falsador la cuenta como **POR OTRO
MOTIVO** en vez de **LO VIO**, y se lleva puestas las otras siete aserciones de
la sección. Es la única cosa que separa al falsador de 15/15 con 3 controles
verdes.

La premisa del banco enciende la antorcha (`banco-r8-fase7.mjs:94`), así que
`prendidaAntes` es siempre `'antorcha'` y la asignación siempre corre: **el
defecto habría explotado igual contra la base**, antes de que yo escribiera una
línea.

Dos arreglos de una línea, los dos desde afuera y sin tocar `Equipo.js`
(elegí no escribirlos yo; la decisión es del jefe):

```js
// a) sombrear el accesor con una propiedad propia del objeto
if (eq && prendidaAntes) Object.defineProperty(eq, 'encendida', { value: prendidaAntes, configurable: true });

// b) devolver la llama por donde vive de verdad
if (eq && prendidaAntes) eq._llama = { id: prendidaAntes, desde: 0, hasta: Infinity, mano: eq.puesto?.mano ?? null, receta: false };
```

Comprobado que (a) funciona: sobre un objeto con `get encendida()`,
`Object.defineProperty(e, 'encendida', { value: 'antorcha', configurable: true })`
deja `e.encendida === 'antorcha'`. La (b) es más fiel —hace que la llama exista
de verdad, no sólo que se lea— pero toca un campo privado.

---

## 6 · Lo que no hice, a propósito

- **No levanté Vite, no abrí el navegador y no commiteé.** La rama quedó con los
  cambios sin `git add`.
- **No toqué `main.js`**: el único pedido está en el punto 3.
- **No toqué ningún banco ni ningún falsador**: la cuenta del punto 5.
- **No toqué `Equipo.js`, `Fin.js`, `Mineria.js` ni `Caza.js`**, aunque los tres
  primeros aparecen en el camino de G1 y G3.
- **No agregué ni un dibujo** a `Iconos.js`: el techo de la hoja no es de esta
  fase y agregarle dos habría puesto en rojo la sección 3 del banco de la ronda
  6 fase 3 con mi nombre encima.
