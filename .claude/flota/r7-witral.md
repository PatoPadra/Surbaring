# Bitácora · ronda 7, fase 5 · `witral`

Agente `witral`. Encargo: `RONDA7.md`, sección «FASE 5 · witral». Banco:
`banco-r7-fase5.mjs` (Node) y `.navegador.js` (la corre el coordinador).

## 13/9 · lectura

Leído entero: la carta de la fase, las dos mitades del banco, el falsador, y mis
archivos (`construccion.json`, `Obras.js`, `Construccion.js`, `Fabricacion.js`,
`Recursos.js`, `Recoleccion.js`, el poncho, las moscas y `licenciasDeJuego` de
`herramientas.json`, la cabecera de `Iconos.js`). Además, sin tocar:
`Fundicion.cercano()`, `Partida._reponerObras()`, `main.js` (el cableado de obras y
`construccion.actualizar()`), `Saberes.desbloquear()`, `Bolso._pintarFabricacion()`.

Lo que sale de leer, antes de escribir nada:

- `Saberes.desbloquear()` **consume** los materiales de la tecnología. Las 6 lanas
  del nodo `telar_witral` se gastan al aprender, y cuentan en `lanaTotal()`.
- `Bolso._pintarFabricacion()` sólo distingue `faltan_materiales` (lista lo que
  falta) y «todo lo demás» (escribe `e.motivo`). Un estado nuevo con `motivo` se
  pinta bien sin tocar el bolso.
- El rinde fijo del coirón (2 × fibra, 0,1 kg) vive en `COSECHA_SOTOBOSQUE` de
  `Recursos.js`, que no es mío. Lo mío del coirón es `EXTRAS_MATA.coiron`.
- El cartel promete lana con `a veces lana` sólo si el renglón no trae `donde` o su
  `donde` da verdadero: un `donde` de estepa dejaría sin lana al arranque, que es
  bosque, y la mitad navegador daría «nunca».

## 15/9 · W5, la investigación (retomado después del corte)

Hecha el 13/9 y no anotada: el corte cayó entre buscar y escribir. Queda acá.

**1 · ¿El guanaco deja vellón en el coirón o en las matas? No encontré nada que lo
diga, y encontré fuentes que dicen de dónde salía de verdad.**
- Méndez, P. M. (2009). «Herencia textil, identidad indígena y recursos económicos
  en la Patagonia Argentina. Estudio de un caso: la Comarca de la Meseta Central de
  la Provincia de Chubut». *AIBR. Revista de Antropología Iberoamericana* 4(1):
  11-53, § 3.2. El pelo de guanaco salía **del cuero**: en el sur del Neuquén se
  enterraba el cuero una semana y el pelo se desprendía (cita a Millán, 1960). Hoy,
  en la meseta del Chubut, las tejedoras «reciben los cueros enteros» y lo esquilan
  o lo arrancan en caliente. De matas, nada.
- Quispe, Rodríguez, Iñiguez y Mueller (2009). «Producción de fibra de alpaca, llama,
  vicuña y guanaco en Sudamérica». *Animal Genetic Resources Information* 45: 1-14
  (FAO). Hoy la fibra de guanaco sale de animales vivos, arreados, esquilados y
  soltados; el vellón de un adulto pesa **300-700 g**; la fibra fina es el **35-50 %**
  del vellón; separando a mano la cerda, el rinde es del **65-95 %** según cuánto se
  separe (cita a Sacchero et al., 2006).
- Tres búsquedas (castellano e inglés) sobre muda, revolcaderos y pelo en arbustos:
  nada que sostenga «vellón enganchado en el coirón». Los revolcaderos existen, pero
  ninguna fuente dice que se juntara fibra ahí.
- **Conclusión: no se sostiene. Va como licencia**, y el comentario de
  `Recoleccion.js` que lo dice como hecho se reescribe.

**2 · El huso con tortero en la región: se sostiene.**
- Méndez (2009), § 3.3: huso de «una varilla cilíndrica de unos 30 a 40 centímetros
  terminada en punta en ambas extremidades y atravesada ajustadamente por una
  piedra discoidal pulida y horadada denominada tortera o tortero». Cita a Kermes
  (1893), Joseph (1931), Taullard (1949), Millán (1960) y Chertudi y Nardi (1961).
  Sigue en uso en Cushamen y Gan Gan (Chubut), más que la rueca. El hilo de una
  hebra se «tuerce» de a dos en un huso más grande para que aguante la urdimbre.
- Mazzanti y Puente (2013), «La producción textil como actividad doméstica de los
  cazadores-recolectores prehispánicos en la región pampeana», *Intersecciones en
  Antropología* 16(1) (SciELO). Resumen de antecedentes: cinco torteros sobre tiesto
  de cerámica en Rincón Chico 2 (Neuquén; Aldazabal y Eugenio, 2007) y uno en
  Bichara 2, ca. 290 AP (Sanguinetti de Bórmida).
- Vitores Spinetta y Fernández (2016), «La textilería aborigen en el noroeste
  patagónico: evidencias y discusión», *Anti* (CONICET, hdl 11336/109536): tiestos
  reciclados del Limay medio (Neuquén y Río Negro) que «podrían haber sido
  utilizados como pesos de huso»; el tejido llegó tarde a los cazadores de Patagonia.

**3 · ¿Con qué se tejía el witral de la región? Primero pelo de camélido; desde el
siglo XVII, sobre todo oveja.**
- Méndez (2009), § 3.1: los ovinos traídos por los españoles se criaron y
  prevalecieron sobre el pelo de camélido; a fines del siglo XVI ya tenían lana más
  larga y gruesa; «a comienzos del siglo XVII esta actividad ganadera y textil se
  extendió hacia el este, en las faldas de la Cordillera de los Andes y noroeste de la
  Patagonia Argentina» (cita a Onelli, 1916; Palermo, 1994). En el presente, oveja y
  «en menor medida» guanaco.
- Wikipedia, «Mapuche textiles»: tejidos de técnica compleja en Alboyanco (Biobío) y
  en el cementerio de Rebolledo Arriba (Neuquén), 1300-1350 d. C. (Brugnoli y Hoces
  de la Guardia, 1995); la lana de oveja reemplazó de a poco al pelo de camélido.
- Museo Regional de Ancud: antes de la conquista, lana de guanaco llamada *weke* o
  *chiliweke*; después, oveja. Nombra el *huitral* de Malleco, Cautín y Valdivia.
- **Conclusión: la frase del nodo («lana de oveja hilada») es verdad para la era del
  nodo (contacto colonial), pero en el juego no hay ovejas y la lana es de guanaco
  por licencia. Se pide reescribirla en el pendiente.**

**Para el peso del poncho.** Chile a Mano, «Lama en telar mapuche verde, negro y
blanco»: 150 × 55 cm, tejido grueso y tupido, lana de oveja hilada a mano, 1000 g.
Un poncho son unos dos paños así: el 1,4 kg que ya tiene `poncho_witral` es
verosímil y **no se toca**.

## 15/9 · el diseño, con la cuenta de W4 antes del código

### Lo que se descartó, con el número que lo descarta

**Vellón por mata, sin fibra** (lo que sugirió el coordinador). Una fracción de los
coirones lleva vellón, fijada por lugar con `_azarDelLugar()` como la carroña: el
cartel diría «Sacar el vellón del coirón (1 × lana)» y no entraría fibra. Es lo más
honesto físicamente, porque sacar vellón no arranca la mata. **Lo descarto por W8:**
el caso «coirón» de `banco-r7-fase1.mjs` (línea 507) pone un coirón en (1,5; 0) y
pide que prometa lana. `_azarDelLugar(1.5, 0)` = **0,626**. Con el 16 % que ya tenía
el juego, ese coirón no tiene vellón, no promete lana y el banco se pone rojo por
diseño. No elijo la fracción ni el hash para que ese lugar caiga del lado bueno: eso
sería ajustar al banco. Va como propuesta en el pendiente.

Además, sin preferir en la tecla el coirón con vellón, el instrumento del navegador
quedaba ciego. Cuenta sólo las apretadas que prometen lana, y las apretadas a
coirones sin vellón (con fibra) no las vería. Mediría T apretadas y 0 kg cuando el
jugador parado pagaría T/f apretadas y 0,1·T·(1−f)/f kg. Con f = 0,16 y T = 18 eso
es 112 apretadas y 9,4 kg. Para que no mintiera haría falta tocar `_delSuelo()`,
que no es «lo que da el coirón».

**Tocar `COSECHA_SOTOBOSQUE.coiron`** (2 × fibra): no es mío, y no hace falta. W4
cierra sin tocarlo (abajo).

### Lo que se hace: la lotería de siempre, con número por criterio

Cada coirón sigue diciendo «(2 × fibra vegetal · a veces lana)», así que el
instrumento cuenta **todas** las apretadas que el jugador paga: lo que mide es lo que
cuesta. Cambian dos números, cada uno por un criterio dicho.

**La cadena (T), por peso.** El poncho pesa 1,4 kg y no se toca.
- Hilar: 4 lana (600 g) → 3 hilado (450 g), un **75 %**. Adentro del 65-95 % que dan
  Quispe et al. (2009) para separar a mano la cerda. Voy del lado bajo porque el
  vellón del juego se junta del monte, con tierra y abrojo.
- `hilado` pesa 0,15 kg, lo mismo que la lana.
- El poncho pide **9 hilado = 1,35 kg** de hilo para 1,4 kg de prenda. El cordel
  sale del poncho (una prenda de witral es toda de lana) y va al telar, que lo
  necesita para amarras y lizos.
- 9 hilado son 3 tandas de hilar, o sea **12 lana**.
- El huso (madera + piedra) y la obra del telar (madera + cordel) no piden lana.
- El nodo `telar_witral` de `historia.json` pide 6 lana que no son míos.
- **T = 18 con el nodo como está; T = 12 si el nodo deja de cobrar lana** (se pide).

**Lana por apretada (p), por peso de lo que entra de paso.** Criterio: juntar lana no
puede meter en el bolso más peso de otra cosa que el peso de la propia lana. Cada
apretada mete 2 fibras = 100 g, y una lana pesa 150 g. Para que por cada lana entren
150 g de paso, hacen falta 1,5 apretadas por lana: **p = 2/3**, con cantidad 1. Antes
era 0,16, con 667 g de paso por lana. Lo digo claro: elegí este criterio conociendo
los topes de W4. Lo que lo sostiene no es que dé, sino qué dice: el vellón no te
llena el bolso de paja.

### La cuenta de W4 (el instrumento: apretadas = T/p, kg = 0,1·T/p)

| cadena | apretadas | kg de paso |
|---|---|---|
| hoy (T = 14, p = 0,16) | 87,5 (medido: 84) | 8,75 (medido: 8,4) |
| **T = 18, p = 2/3 (nodo como está)** | **27** | **2,7** |
| T = 12, p = 2/3 (nodo sin lana) | 18 | 1,8 |

**Predicción para la mediana de los 61 puntos: 27 apretadas y 2,7 kg** (con el nodo
como está).
- Ruido por punto: con unos 55 coirones, la tasa tiene un desvío de
  √(⅔·⅓/55) ≈ 0,064. Los kg de un punto varían ±0,26.
- La mediana de 61 se mueve unos ±0,05 kg.
- Espero entre 26 y 29 apretadas, y entre 2,6 y 2,85 kg.
- **El margen fino es el de los kg: 10 %.** Si el nodo deja de cobrar lana, pasa a 40 %.
- El tope de 60 apretadas no aprieta: el que manda es el de 3 kg (T/p ≤ 30).

El tronco sigue ganando la tecla: `VALE` no se toca.

### El resto del diseño
- **Obra `telar_witral`:** de campamento, con `procesa`, pide la tecnología, madera 6
  y cordel 4. La silueta sale de Méndez (2009): cuatro palos, dos parantes y dos
  travesaños atados en los cruces, separador y tonon. En el campo se apoya oblicuo en
  una pared o un árbol; acá lo sostienen dos puntales.
- **`Fabricacion`:**
  - una `donde` que no es horno de `mineria.json` ni fogata es una estación de obra,
    y se busca por id entre todas a menos de 8 m;
  - la fogata y la fragua siguen por `cercano()`, exactamente igual;
  - la receta que trae `pideHerramienta` da `falta_herramienta` si no está, antes que
    la estación y sin consumir nada.
- **`Construccion.actualizar()`:** la obra que cae saca su estación de
  `Fundicion.hornos`. Coincide por id y posición, en el mismo arreglo.

## 15/9 · código, primera tanda

Hecho en disco (falta correr el banco):
- `Recursos.js`: `hilado`, 0,15 kg.
- `construccion.json`: obra `telar_witral` (campamento, `procesa`, madera 6, cordel 4),
  puesta después del canasto.
- `Construccion.actualizar()`: la obra que cae saca su estación de `Fundicion.hornos`,
  con `splice` en el mismo arreglo.
- `Obras.js`: el caso `telar_witral`, con dos parantes 0,12 × 2,1 × 0,12, dos
  travesaños 2 × 0,11 × 0,11, dos puntales, la urdimbre, el tejido, la franja y el
  tonon. Todo con `mat()`.
- `herramientas.json`:
  - el poncho pide 9 hilado y `donde: telar_witral`, con su `criterio`;
  - `huso` (madera + piedra, 0,1 kg, sin ranura ni durabilidad, con `fuente`);
  - `hilar_lana` (4 lana → 3 hilado, `pideHerramienta: huso`, con `criterio`);
  - licencia `lanaDelCoiron`.
- `Recoleccion.js`:
  - `EXTRAS_MATA.coiron` pasa a probabilidad 2/3, con `licencia`, y el comentario
    reescrito;
  - la primera lana que entra dice el aviso de la licencia.
- `Iconos.js`: `hilado` (ovillo) y `huso`.
- `Fabricacion.js`: la cabecera y `RADIO_ESTACION_M`. **Faltan `estacion()` y
  `estado()`.**
- `pendiente-r7-witral.md`: escrito, con cinco puntos.

Decisiones chicas:
- El huso es `categoria: herramienta` sin ranura: se usa en la mano al hilar, pero
  no cambia el rinde de la tecla.
- No declara durabilidad: hilar no lo gasta. Comprobado que una instancia sin
  durabilidad sobrevive al guardado: `Inventario` escribe `null` y repone `Infinity`.
- `efecto.herramienta` del nodo no lo lee ningún código (grep en `Saberes` y `Codice`).

## 15/9 · código, segunda tanda

- `Fabricacion.js` completo:
  - `estacion()` manda a `_estacionDeObra()` toda `donde` que no sea la fogata ni un
    horno de `mineria.json`, siempre que haya `fundicion`. Sin `fundicion` sigue el
    camino viejo, idéntico;
  - `_estacionDeObra()` busca por id entre todas las estaciones a menos de 8 m;
  - `herramientaQueFalta()` mira `pideHerramienta` con `Equipo.tiene()` y `gastado()`;
  - `estado()` da `falta_herramienta` después de los materiales y antes de la estación.
- Comprobado antes del banco: los dos JSON parsean; `huso` tiene 11 formas y `hilado`
  8; la hoja de iconos pesa 133,7 kB (tope 140).

## 15/9 · el banco rápido: 7/7

`BANCO_SECCIONES=telarEsCosa,…,nadaMas`: **total 7/7**, 55 aserciones en ok.
- Silueta medida por el banco: 2 postes y 4 travesaños (dos travesaños, el tonon y
  la franja), 2,10 m de alto.
- `lanaTotal()` da **18**, lo que predije con el nodo como está.
- Regresión suelta mientras tanto: `banco-r7-fase1` 6/6 (el cartel del coirón sigue
  honesto con 2/3) y `banco-r6-fase3` 6/6 (118 iconos, hoja de 133,7 kB).

Falta la corrida entera, con la regresión de ocho bancos y `vite build`, y el falsador.

## 15/9 · la cuenta de W4, simulada con el código de verdad

`scratchpad/sim-w4.mjs`: la `Recoleccion` real con `herramientas.json` cableado; 55
coirones por punto (lo que midió la apertura) y 61 puntos. Parado y apretando, cuenta
igual que la mitad navegador: sólo las apretadas que prometen lana, la lana que dieron
y el peso del resto. **No ve el mundo real** (no hay piedra, michay ni tronco
compitiendo, y los coirones por punto no varían): comprueba la aritmética, no el juego.

| T | mediana apretadas | mediana kg | corridas |
|---|---|---|---|
| 18 | 27,3 · 27,0 · 26,8 | 2,73 · 2,70 · 2,68 | 3 |
| 12 | 17,7 | 1,77 | 1 |

Por punto se cuentan 54 apretadas y no 55: dos coirones cayeron en la misma casilla
de 25 cm y comparten descanso.

**La predicción queda: 27 apretadas y 2,7 kg en la mediana de los 61 puntos**, con el
nodo como está. Lo que el juego real puede mover:
- **menos coirones por punto:** el ruido crece, pero la mediana casi no se mueve;
- **los 3 puntos sin coirón:** dan «nunca» y quedan fuera de la mediana;
- **coirones que caen en la misma casilla de 25 cm:** comparten descanso, se cuentan
  menos apretadas, y la tasa no cambia.

Si el juego midiera más de 3 kg, lo primero que miraría es la lana por apretada
realizada: el 13/9 salió 0,151 contra 0,16 nominal, un 6 % abajo. Con 2/3, un 6 % abajo
serían 2,87 kg: todavía pasa, pero justo.

## 15/9 · la corrida entera: 9/9

```
  VERDE  ejercitó  14  1 · EL TELAR ES UNA COSA
  VERDE  ejercitó   8  2 · SE TEJE AL LADO DEL TELAR
  VERDE  ejercitó  12  3 · SE HILA ANTES DE TEJER
  VERDE  ejercitó   4  4 · LA TECLA  (nota: la cadena pide 18 de lana)
  VERDE  ejercitó   4  5 · CON FUENTE O CON LICENCIA
  VERDE  ejercitó   9  6 · EL TELAR SE VA ENTERO
  VERDE  ejercitó   4  7 · NADA MÁS CAMBIA
  VERDE  ejercitó   8  8 · SIN REGRESIÓN
  VERDE  ejercitó   1  9 · ARRANQUE — vite build
  VERDE  guarda del camino feliz (9/9)
  VERDE  total 9/9
```

**Riesgo encontrado leyendo el diff, fuera de mi tramo.** `Taller.js` elige «el
horno que tengo al lado» con `fundicion.cercano()`: un solo horno, el más cercano. El
telar es una estación con `procesa`, y un campamento pone el telar al lado de la
fogata. Parado más cerca del telar que de la fogata, el taller mostraría las hornadas
del telar (vacías) y **no el fuego**. Estoy mirando qué hace `main.js` con
`fundicion.cercano(20)`.

## 15/9 · el falsador, con mi código: 20/20

`banco-r7-fase5.falsar.mjs`: base limpia con 62 aserciones verdes. **Lo vio 20/20**,
ninguno por otro motivo, ninguno sin plantar. Los 3 controles al revés quedaron verdes:
- materiales del telar al doble;
- motivo reescrito;
- hilado que rinde uno más.

`main.js` y el aviso del frío: `cercano(20)` sólo elige la frase del aviso; el calor
del cuerpo sale de `fuegoCercano()`. **El taller sí queda afectado** (el fuego de la
fogata no se ve con el telar más cerca). Va en el pendiente, punto 6.

## Estado al cerrar

**Hecho:** W1, W2, W3, W5, W6 y W7, medidos en Node (9/9); W8 con la regresión de
ocho bancos y `vite build`.

**Para el navegador (lo mide el coordinador):**
- W1: que levantar el telar no compile programas. Usa `mat()` como el resto de las
  obras.
- W4: predicción de **27 apretadas y 2,7 kg** en la mediana, con el nodo como está; 18
  y 1,8 si se acepta el punto 1 del pendiente.

**Pendiente** (`pendiente-r7-witral.md`):
1. el nodo sin lana;
2. la frase del nodo;
3. el radio de `Fundicion` en un solo lugar, y la deuda de la fragua;
4. `fuentesFaltantes.lana` vieja;
5. propuesta: el vellón por mata sin fibra, con el choque con `banco-r7-fase1`;
6. el taller elige el horno más cercano y el telar le tapa el fuego a la fogata.

**Dudas:**
- **El margen de W4 en kg es del 10 %** si el nodo sigue cobrando 6 lanas. La
  simulación da 2,68-2,73 kg, pero no ve el mundo real.
- **El criterio de p = 2/3** («lo que entra de paso no pesa más que la lana») lo elegí
  conociendo el tope de 3 kg. Lo dije en el código y en la licencia; el jefe dirá si
  alcanza como criterio.
- **La lana deja de ser escasa:** dos de cada tres coirones. Las moscas (1 lana cada 4)
  quedan regaladas. Eso no estaba en el contrato, pero es consecuencia.
- **El huso es `categoria: herramienta` sin ranura.** La nota de la categoría dice «van
  en la mano»; no hay categoría mejor.
- **Referencia comercial en el poncho.** El peso del paño (Chile a Mano) es un
  producto a la venta, no una fuente académica. Está en `criterio`, no en `fuente`.
