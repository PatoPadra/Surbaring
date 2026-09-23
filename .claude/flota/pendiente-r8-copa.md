# Pendiente de la fase 4 · `copa` — árboles y follaje

Agente `copa`, ronda 8. Escrito al terminar, 22/9/2026.
Archivos que toqué, y ninguno más: `tools/hornear-follaje.mjs` (nuevo),
`public/tex/follaje/` (nuevo), `src/world/Vegetacion.js`.

**En una frase:** el follaje pasa a ser cuatro atlas horneados offline, dibujados
a la escala real de cada hoja —la hoja del coihue mide 5 cm en el mundo y no 84—,
con las ramillas agrupadas en matas macizas separadas por huecos de verdad; el
ciprés de la cordillera deja de tener acículas de pino y pasa a tener sus
ramillas aplanadas de escamas; y las coníferas dejan de ser una columna de
elipsoides con el tronco cortado a media altura para ser un cono de ramas por
pisos con el tronco hasta la punta. Para pagarlo, saqué tarjetas: el área
rasterizada de follaje baja un tercio.

---

## 1 · Qué hice y por qué

### El horno (C1)

`node tools/hornear-follaje.mjs` escribe cuatro atlas y su manifiesto en
`public/tex/follaje/`. Nada de `Math.random` ni de `Date`: el azar sale de
mulberry32 sembrado con FNV-1a del id de la clase, y el banco lo corre dos veces
y compara los bytes.

| clase | lado | px/m | hoja dibujada | en el mundo | veces la real | tarjeta más grande | matas |
|---|---|---|---|---|---|---|---|
| `nothofagus` | 1024 | 100 | 5 px | 5,0 cm | ×1,82 | 8,81 m | 29 |
| `ancha` | 1024 | 100 | 5,75 px | 5,75 cm | ×1,44 | 8,81 m | 42 |
| `escama` | 512 | 150 | 1 px | 0,67 cm | ×1,90 | 2,94 m | 13 |
| `aguja` | 512 | 150 | 9,75 px | 6,50 cm | ×1,00 | 2,94 m | 17 |

Antes la hoja medía en el mundo de 24 a 84 cm (×10 a ×20). El horno pinta con
un rasterizador propio (4×4 muestras por texel, composición «encima» con alfa
premultiplicado), porque en Node no hay lienzo.

**De dónde salen las cifras**, en el campo `referencia` de cada clase del
manifiesto, con la fuente:

- **nothofagus** — coihue (*N. dombeyi*) 2-3,5 cm, lanceolada algo romboidal,
  finamente aserrada; lenga (*N. pumilio*) 2-4 cm; ñire (*N. antarctica*)
  1-3,5 cm. SIB (Sistema de Información de Biodiversidad, APN):
  `sib.gob.ar/especies/nothofagus-dombeyi`, `-pumilio`, `-antarctica`. Se toma
  el rango del coihue.
- **ancha** — maitén (*Maytenus boaria*) 2-6 cm, lanceolado-elíptica, aserrada;
  laura (*Schinus patagonicus*) 2,5-5 cm. SIB. **Licencia declarada**: el canelo
  (*Drimys winteri*, 5-15 cm según el SIB) comparte el atlas y queda con la hoja
  más chica que la real.
- **escama** — ciprés de la cordillera (*Austrocedrus chilensis*): hojas
  escamiformes opuestas e imbricadas, en ramillas **aplanadas, en un plano**;
  las laterales 2-5 mm con dos bandas estomáticas blanquecinas, las faciales
  0,5-2 mm; copa piramidal, compacta. SIB,
  `sib.gob.ar/especies/austrocedrus-chilensis`. El alerce comparte la clase por
  forma, sin cifra propia.
- **aguja** — pino murrayana (*Pinus contorta* subsp. *murrayana*): acículas **de
  a dos por fascículo**, 5-8 cm × 1-2 mm, amarillo verdosas; ramas extendidas,
  ascendentes en la punta; copa cónica. The Gymnosperm Database (Earle),
  `conifers.org/pi/Pinus_contorta_murrayana.php`, que sigue a Flora of North
  America. El ponderosa y el oregón comparten el atlas: licencia.

Dos cosas que hay que decir de frente sobre la escala:

- En la **escama**, a 150 px/m una escama lateral mide **un texel**. Lo que está
  a escala de verdad es la ramilla aplanada (abanicos de 9 a 19 cm, ramitas de
  un texel = 6,7 mm contra 2-4 mm reales); la escama es el grano claro-oscuro a
  lo largo de cada ramita. `hojaPx = 1` es honesto, no un truco para pasar C3,
  pero es el límite de lo que un texel puede decir.
- En la **aguja** el largo es el real (×1,00); el ancho no: 0,8 px son 5 mm
  contra 1-2 mm. Una acícula de un tercio de texel la borra el mipmap.

### Cada especie con su hoja (C2)

`claseHojaDe(esp)` exportada, y decide por el **género y la familia de la
ficha**, no por el id: `Nothofagus *` → `nothofagus`; Cupressaceae → `escama`;
Pinaceae → `aguja`; el resto → `ancha`. Da lo que pide el contrato en las nueve
especies del banco. Antes todo lo `columnar` era `aguja`, así que el ciprés de
la cordillera —que no tiene una sola acícula— usaba el atlas del pino.

### La hoja de su tamaño (C3)

`pxPorMetro` es ahora **la escala del atlas sobre la tarjeta**, y las tarjetas se
dimensionan con él: una tarjeta de `2s` metros de lado muestra exactamente
`2s · pxPorMetro` texels, y ninguna pasa de `uMax · lado / pxPorMetro` metros.
Antes la ventana era una fracción fija del atlas (0,30 a 0,44) fuera cual fuera
el tamaño de la tarjeta: de ahí salía el estiramiento a ~25 px/m y la hoja de
caricatura. Lo mismo para las hojas sueltas de la caña colihue (`pintar`, camino
`'hoja'`), que ahora declaran su tamaño en metros.

Los números viven en dos lados a propósito: el manifiesto los declara con su
referencia, y `CLASES_HOJA` en `Vegetacion.js` los repite **porque el modelo se
arma con ellos aunque el atlas no haya llegado** (en Node, en el banco, o si
falla el `fetch`). Si el manifiesto trae otros, manda el manifiesto para lo que
se arme después y se avisa por consola; lo ya armado no se toca.

### El atlas que no se ralea ni se espesa (C4, la mitad que mido en Node)

El follaje se agrupa en **matas** —el extremo de una rama, tres a cinco lóbulos a
lo largo de un eje— separadas por huecos de verdad, y **macizas por dentro**
(las ramitas se reparten uniformes en el área, no amontonadas en el centro). Eso
es lo que hace que la cobertura no cambie al promediar: un bloque de mipmap que
cae adentro de una mata sigue pasando el corte de 0,28 y uno que cae en un hueco
sigue sin pasarlo.

| clase | 1024 | 512 | 256 | 128 | 64 | 32 | peor desvío |
|---|---|---|---|---|---|---|---|
| nothofagus | 0,361 | 0,378 | 0,394 | 0,405 | 0,415 | 0,458 | **+27 %** |
| ancha | 0,355 | 0,378 | 0,396 | 0,402 | 0,418 | 0,449 | **+26 %** |
| escama | — | 0,321 | 0,341 | 0,353 | 0,368 | 0,392 | **+22 %** |
| aguja | — | 0,417 | 0,441 | 0,451 | 0,463 | 0,500 | **+20 %** |

Contra la lámina de hoy (0,219 → 0,307 a 32 px, **+40 %**) y la aguja de hoy
(0,081, que no llegaba ni al piso de 0,18). Lo que sube todavía es el borde de
cada mata, que al promediar se dilata: con matas de 0,5 a 1 m y bloques de 32
texels (32 cm a 100 px/m) esa dilatación es geométrica y no la saco sin agrandar
las matas hasta que dejen de parecer ramas.

El color medio lineal de cada atlas se lleva al del atlas de hoy (0,282 · 0,567 ·
0,258, medido sobre `capturas/r8-atlas-alfa-*.png`): el tinte de la especie
multiplica al texel, así que un atlas más oscuro oscurecería el bosque entero sin
que nadie lo decidiera. Y el color de los texels transparentes se rellena con el
de las hojas vecinas: el mipmap promedia RGB sin mirar el alfa, y sin eso cada
hoja lejana tiene su halo negro.

### La conífera, en pisos

El ciprés y el pino eran una columna de siete elipsoides con doce tarjetas cada
uno, **sin ramas y con el tronco cortado a media altura**. Ahora:

- el tronco llega al 88 % de la altura (son de eje único) y es más fino (radio
  2,4 % de la altura, contra 3,2 %: un pino de 20 m no tiene 1,3 m de diámetro);
- la copa es un cono **del ancho de la ficha** (`diametroCopaM`), con la base de
  copa más alta cuanto más alto el árbol (el alerce y el oregón tienen fuste
  limpio; el ciprés de la estepa, copa casi hasta el suelo);
- el follaje va en **ramas por pisos**, repartidas por el ángulo de oro, con una
  mata de tarjetas por rama; en el pino la rama se ve —es de verdad—, en el
  ciprés la tapa el follaje;
- la normal y la oclusión salen del **eje del árbol** y no del centro de cada
  mata: la copa se ilumina como un cono y es oscura hacia el tronco;
- cuántas tarjetas lleva cada mata sale del área de la mata sobre el área de una
  tarjeta, así que un alerce de 45 m no queda ralo aunque su tarjeta no pueda
  pasar de 2,94 m.

### El mismo árbol en cada carga (C7)

`construirPlanta(esp)` exportada, y su azar sale de mulberry32 sembrado con
FNV-1a de `'planta:' + esp.id`: no toca `Math.random` ni una vez, así que da
igual qué especies se armaron antes o si el atlas de su clase ya estaba
dibujado. Banco: cinco especies, dos llamadas cada una con el azar global movido
entre medio, misma geometría byte a byte, y las cinco distintas entre sí.

### Cómo llega el atlas, y qué pasa si no llega

`cargarFollaje()` exportada, memoizada, **nunca rechaza**: `fetch` del manifiesto
y de los cuatro PNG, decodificados a mano (como en `src/util/suelo.js`: un lienzo
premultiplicaría por el alfa y se perdería el color de lo transparente, que es
justo lo que evita los halos). Si falta cualquier cosa, `{ disponible: false }` y
el juego sigue con **el atlas procedural de hoy**, que quedó intacto.

Lo ideal es esperarla antes de `new Vegetacion(...)` —ver el pedido de `main.js`
más abajo—. Si llega después, la vegetación la aplica sola: cambia el valor de
`map` (no toca la clave del programa: no se compila nada), reescala el color de
los vértices del tronco por la nueva media de la franja de corteza, y **vuelve a
hornear las carteleras**, que si no quedarían de otro color y otra silueta que el
árbol de malla al que reemplazan.

Probé el camino entero en Node, con un `fetch` de mentira contra `public/` y sin
navegador (`_aplicarFollaje` sobre una `Vegetacion` ya construida con el atlas
procedural):

- `cargarFollaje()` devuelve las cuatro clases; la textura queda `DataTexture`
  de 1024, `flipY` en false, espacio sRGB;
- **los bytes que decodifico a mano son idénticos a los de pngjs**: 0 distintos
  de 4.194.304;
- de los 570.760 texels transparentes del atlas del nothofagus, **ninguno quedó
  en negro**: todos traen el color de las hojas vecinas (es lo que evita el halo
  en los mipmaps);
- el cambio en caliente tocó el color de **834 componentes, todos en vértices de
  corteza y ninguno de follaje**, con una razón de 0,999276 (la media de la
  franja horneada contra la procedural): el tronco no cambia de brillo.
- Que cambiar el valor de `map` no recompila lo dice `needsProgramChange` de
  three 0.169 (`three.module.js:30554-30625`): mira las luces, el espacio de
  color, el instanciado, el `envMap`, la niebla y los planos de recorte; el
  `map` no está. Y los uniformes del material se refrescan igual, porque
  `refreshMaterial` se prende con cada cambio de material (`:30690`).

---

## 2 · Qué predigo para la mitad navegador

### Con qué mido, y en qué NO es tu instrumento

Escribí un rasterizador de software en Node (en mi carpeta de borradores, no en
el repo) que imita tu medición: misma cámara (62°, 819×614, a 18 m al sur, 1,7 m
de alto, mirando a 0,6·alturaMax/2), instancias con la escala, el giro y la
inclinación que les da la siembra, atlas muestreado con mipmaps 2×2, trilineal y
anisotrópico ×8, `alphaTest` 0,28, y **el mismo relleno que medís vos**: píxeles
del árbol sobre el área de su envolvente convexa, con tu misma cadena monótona,
y los puntitos como componentes de 6 px o menos por mil píxeles.

**Lo que mi instrumento no tiene** (y por eso predigo con corrección de sesgo, no
con el número crudo):

- no aplica el **umbral de la resta de 24 niveles** de RGB: cuenta todo píxel
  donde un fragmento pasa el corte, así que puedo contar de más algún píxel de
  borde que en tu resta no llegue a 24;
- no tiene viento (las tarjetas se desplazan hasta ~0,5 m), ni sombras, ni
  posproceso (vos tampoco: render directo), ni la pendiente del terreno;
- usa **mis** tres instancias al azar por carga, no las tres que elegís vos.

**Calibración contra tu base** (5 cargas × 3 árboles mías, contra tu base de 5
cargas): mi relleno sale alto por 0,013 de media, y el peor caso es el ñire.

| especie | relleno mío (base) | tu base | Δ | puntitos míos | tuyos | razón |
|---|---|---|---|---|---|---|
| coihue | 0,550 | 0,550 | 0,000 | 0,60 | 0,67 | ×1,12 |
| ciprés | 0,383 | 0,380 | +0,003 | 7,71 | 5,35 | ×0,69 |
| ñire | 0,576 | 0,533 | +0,043 | 1,75 | 1,68 | ×0,96 |
| pino | 0,401 | 0,386 | +0,015 | 6,93 | 9,41 | ×1,36 |
| maitén | 0,566 | 0,564 | +0,002 | 1,31 | 1,58 | ×1,21 |

Que el relleno calibre a ±0,04 y los puntitos a ±45 % es todo lo que puedo
prometer del instrumento.

### Relleno y puntitos

Medido sobre el árbol que va a salir (el modelo ya es determinista: **el que
mido es el que se dibuja**), 5 cargas × 3 árboles, y después corregido por el
sesgo de arriba:

| especie | relleno mío | rango por carga | peor árbol suelto | **predicción** | umbral | margen |
|---|---|---|---|---|---|---|
| ciprés | 0,760 | 0,754–0,769 | 0,739 | **0,757** | ≥ 0,50 | +0,257 |
| pino | 0,692 | 0,673–0,710 | 0,649 | **0,677** | ≥ 0,50 | +0,177 |
| coihue | 0,556 | 0,537–0,568 | 0,515 | **0,556** | ≥ 0,506 | +0,050 |
| ñire | 0,606 | 0,596–0,623 | 0,563 | **0,563** | ≥ 0,484 | +0,079 |
| maitén | 0,587 | 0,556–0,603 | 0,529 | **0,585** | ≥ 0,481 | +0,104 |

| especie | puntitos míos | **predicción** | umbral |
|---|---|---|---|
| ciprés | 0,25 | **0,17** | ≤ 3,4 |
| pino | 0,32 | **0,44** | ≤ 3,4 |
| coihue | 0,43 | **0,48** | ≤ 1,39 |
| ñire | 0,70 | **0,67** | ≤ 2,55 |
| maitén | 0,88 | **1,06** | ≤ 2,20 |

**El que menos margen tiene es el coihue** (+0,050 sobre 0,506), y es también
donde más recorté tarjetas para pagar el costo (ver abajo). Si algo va a salir
rojo, apostaría ahí. Los puntitos los doy con confianza: la cuenta de
componentes chicos cae de 5,35 y 9,41 a menos de 0,5 porque ya no hay ramitas
sueltas que dibujen dos o tres píxeles aislados.

Lo que **no** es el relleno: la cobertura de alfa del atlas (0,32 a 0,42, tabla
de arriba, medida sobre el PNG) y el conteo de fragmentos rasterizados que uso
para el costo. Son tres números distintos y no los mezclo.

**Las otras especies**, que no están en tu banco pero también cambiaron (mi
instrumento, 3 cargas × 3 árboles, sin corregir sesgo; la base con el modelo al
azar de cada carga):

| especie | relleno base → nuevo | puntitos base → nuevo |
|---|---|---|
| alerce | 0,397 → 0,548 | 4,04 → 0,69 |
| pino oregón | 0,381 → 0,556 | 4,95 → 0,47 |
| pino ponderosa | 0,409 → 0,618 | 5,92 → 0,50 |
| lenga | 0,526 → 0,576 | 0,81 → 0,55 |
| canelo | 0,546 → 0,601 | 1,16 → 0,78 |
| arrayán | 0,584 → 0,586 | 1,76 → 1,06 |
| calafate | 0,656 → 0,683 | 11,86 → 3,63 |
| laura | 0,621 → 0,676 | 9,84 → 3,74 |
| caña colihue | 0,310 → 0,278 | 27,90 → 22,73 |

Las tres coníferas que no mide el banco —alerce, oregón, ponderosa— suben de
0,38-0,41 a 0,55-0,62, que es el mismo salto que el ciprés y el pino. Los
arbustos bajan los puntitos a un tercio. **La caña colihue es la única que no
mejora**: es un haz de cañas finas y sigue siéndolo.

### El costo (C5)

Tampoco lo mido: lo estimo con la siembra de verdad. Cargo el DEM en Node, armo
`Vegetacion` en el punto `bosque` de `bancoDesglose` (lat −41,0870, lon
−71,4290, rumbo 20°), reparto malla/cartelera con los umbrales de siempre,
recorto al 42 % que dibuja Baja, y por cada árbol dibujado sumo: vértices,
**píxeles de tarjeta rasterizados** —área de tarjetas por (511/d)² y 0,55 de
proyección media— y **fragmentos que pasan el corte** (esos píxeles por la
cobertura del atlas en el nivel de mipmap que toca a esa distancia).

| | base | nuevo | |
|---|---|---|---|
| vértices procesados | 17.830 | 18.222 | +2,2 % |
| píxeles de tarjeta rasterizados | 1.591.636 | 1.068.231 | **−33 %** |
| fragmentos que pasan el corte | 346.333 | 422.337 | **+22 %** |
| área de tarjetas al pase de sombra | 29.047 m² | 20.083 m² | −31 % |

Las dos cifras del medio tiran para lados opuestos y hay que decir por qué: el
atlas nuevo cubre casi el doble de cada tarjeta (0,40 contra 0,22 en el nivel que
se usa a esas distancias), así que **saqué tarjetas** —el coihue pasa de 34 a 24
por lóbulo, el ñire y el maitén de 28 a 22, el arbusto de 26 a 18, y las
coníferas se rehicieron enteras— hasta que el área total bajó un tercio. El
coihue, que es el 87 % de los píxeles de árbol en ese punto, pasa de 9.710 m² de
tarjetas a 6.380.

Con `costo = rasterizados × (c0 + c1 · fracción que pasa)`, donde `c0` es
interpolar + leer el atlas + el corte y `c1` el Lambert con la sombra en cascada:

| c1/c0 | 1 | 3 | 5 | 10 | ∞ |
|---|---|---|---|---|---|
| costo nuevo / base | 0,77 | 0,88 | 0,94 | 1,04 | 1,22 |

Y hay un argumento más fuerte: el `discard` **no ahorra por píxel sino por warp**
—si un solo carril del warp sobrevive, el warp paga el sombreado entero—, y con
el atlas viejo al 22 % ya sobrevivía casi cualquier warp. Por ese camino el costo
va con los rasterizados: **−33 %**.

**Predicción: los árboles no suben; quedan entre −33 % y +4 %** sobre los 2,5 ms
de la base, y el valor que más creo es la parte baja de ese rango. El techo
absoluto de la tabla es +22 %, pero sale de suponer que leer el atlas y hacer el
corte **no cuesta nada**; para pasar el +15 % del contrato el Lambert con sus
cascadas tendría que costar **33 veces** el resto del fragmento (o sea, la
lectura del atlas por debajo del 3 %), y en esta placa —que gana 2,3× en
texturas y pierde 8× en matemática de shader— eso no pasa.

Si aun así diera rojo, la perilla es el área de tarjetas, que es lineal en el
costo: bajar el coihue de 24 a 20 tarjetas por lóbulo saca otro 15 % del área
sin tocar el atlas (y me costaría ~0,02 de relleno, según la serie que medí:
17 tarjetas dan 0,524; 24, 0,556; 28, 0,582).

Lo que **no** entra en esa cuenta y no puedo estimar: las **carteleras**. Se
vuelven a hornear con el modelo nuevo, y su cuadrilátero mide el recuadro del
árbol, que cambia poco (coihue +8 %, ciprés −8 %, pino +1 %), pero su silueta
horneada es más maciza, así que más fragmentos pasan su corte de 0,32. Su shader
es barato (una o dos lecturas y nada de luces), pero el número no lo tengo.

Y lo de «poner un árbol en pantalla no compila nada nuevo»: el atlas entra como
**valor** de `map`, que no es parte de la clave del programa; ni un `#define`
nuevo, ni un sampler que cambie de tipo.

---

## 3 · Lo que encontré y no arreglé

1. **El coihue sigue con las ramas desnudas asomando de la copa.** Se ven en la
   base y se ven ahora (`capturas/r8-f4-base1-arbol-coihue.png`): siete cilindros
   que salen del tronco y terminan apenas adentro del follaje, que de perfil son
   palos grises contra el cielo. No es el atlas, es el modelo `copa_ancha`, y no
   estaba en el contrato. Se arregla acortándolas o metiéndolas más adentro.
2. **El tronco de las latifoliadas sigue siendo grueso**: radio 3,2 % de la
   altura, o sea 2,2 m de diámetro en un coihue de 35 m. A las coníferas se lo
   bajé a 2,4 % porque estaba rehaciendo el modelo entero; en las otras no toqué
   nada para no mover lo que ya medías.
3. **La caña colihue es un haz de palitos, antes y ahora**: relleno 0,31 → 0,28,
   puntitos 27,9 → 22,7 en mi instrumento. Es una caña: son cañas. Pero si
   alguna vez se mide, que no sorprenda.
4. **Los mañíos (*Saxegothaea*, *Podocarpus*) caen en `ancha`** por descarte.
   Sus hojas son lineales y planas de 1,5 a 3 cm: ni lámina ancha ni escama. Lo
   dejé declarado y no inventé una quinta clase.
5. **`decodificarPNG` quedó duplicada** entre `src/util/suelo.js` y
   `Vegetacion.js`. No exporté la de `suelo.js` porque ese archivo no es mío. Si
   la exportás, borro la mía.
6. **Memoria de video: +11,2 MB** (14,0 contra 2,8: dos atlas de 1024 y dos de
   512, con mipmaps). En disco son 4,8 MB. El comentario de `CUPO_ESPECIES`
   lleva la contabilidad de VRAM y ahora está desactualizado por esos 11 MB; no
   lo toqué porque el número de especies no cambió.
7. **La cobertura sigue subiendo ~25 % del nivel 0 al de 32 px** en las cuatro
   clases (el contrato pide ±30 %). Es la dilatación geométrica del borde de cada
   mata al promediar bloques de 32 texels, no una mata rala: bajarla pide matas
   más grandes, y entonces dejan de parecer ramas.
8. **No verifiqué nada en el navegador**: no levanté Vite ni abrí el navegador,
   como me pediste. Todo lo de arriba es Node, PNG leídos como archivo, y
   aritmética.

---

## 4 · Lo que necesito de vos (`src/main.js`, que no es mío)

Un `await` antes de construir la vegetación, para que el modelo, el material y
las carteleras se armen de una con el atlas horneado y no haya que rehornear las
treinta carteleras en caliente:

```js
// con los otros imports
import { Vegetacion, cargarFollaje } from './world/Vegetacion.js';

// … en la pantalla de carga, justo antes de `new Vegetacion(...)`:
progreso(0.75, 'Horneando el follaje…');
await cargarFollaje();          // nunca rechaza; si falta, sigue el procedural
const vegetacion = new Vegetacion(mundo, flora, render);
```

Sin ese cambio el juego anda igual —la vegetación detecta que el atlas llegó
tarde y lo cambia sola— y la medición sigue siendo válida, porque el `fetch` de
cuatro archivos locales resuelve durante la carga, mucho antes de que corras el
banco; lo que se paga es **rehornear las treinta carteleras** una vez, que en la
pantalla de carga no se ve pero en medio de la partida sería un tirón. Si querés
comprobar cuál de los dos caminos tomó, `vegetacion.follajeHorneado` queda
definido (con cuántos lotes cambió) **sólo** si el atlas llegó tarde.

---

## 5 · Lo que corrí

```
  BANCO R8 · FASE 4 — la copa   (src: src)

  VERDE  ejercitó  25  1 · EL HORNO — cuatro clases, bytes que repiten, y cobertura que no se pierde
  VERDE  ejercitó   6  2 · LA HOJA — de su tamaño, a menos de 3 veces el real
  VERDE  ejercitó  10  3 · CADA ESPECIE CON SU HOJA — claseHojaDe
  VERDE  ejercitó  12  4 · SIN REGRESIÓN — la ronda 7 y las fases 1 a 3
  VERDE  ejercitó   1  5 · ARRANQUE — vite build
  VERDE  ejercitó  12  6 · EL MODELO — cada especie, el mismo árbol en cada carga (C7)

  VERDE  guarda del camino feliz (6/6)
  VERDE  total 6/6
```

- `node .claude/flota/banco-r8-fase4.falsar.mjs`: **8 defectos vistos de 8, los
  tres controles verdes**, y la base limpia antes de plantar nada.
- `node .claude/flota/lint-shader.mjs src/world/Vegetacion.js`: sin errores (no
  toqué un solo shader; los siete trozos de GLSL del archivo quedaron igual).
- La prueba de carga en Node descrita más arriba (fetch de mentira, PNG
  decodificado a mano contra pngjs, cambio en caliente).

**Dónde están las perillas**, si al dueño le parece que algún árbol quedó
demasiado tupido o demasiado ralo:

- la densidad del follaje de una conífera: `porte.densidad` en
  `construirConifera` (3,1 el ciprés, 4,0 el pino) — el ciprés es el más macizo
  de los cinco a propósito, porque su copa es «piramidal, compacta»;
- la de una latifoliada: el `cantidad` de cada `tarjetasFollaje` en
  `construirPlanta` (24 el coihue, 22 el ñire y el maitén, 18 el arbusto);
- lo que dibuja cada atlas: `CLASES` en `tools/hornear-follaje.mjs`
  (`matas.fraccion`, `matas.radioM`, `forma.densidad`), y después hay que volver
  a hornear.
