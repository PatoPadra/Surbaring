# SurviBar

Juego de supervivencia educativo ambientado en el **Parque Nacional Nahuel Huapi**
(San Carlos de Bariloche, Argentina), hecho en Three.js sobre el relieve real de
la cordillera.

> **Estado: prototipo jugable en desarrollo.** El mundo carga, se camina y se
> renderiza. Varios sistemas visuales están a medio pulir. Ver
> [Estado real](#estado-real) antes de esperar calidad final.

---

## Cómo correrlo

```bash
npm install
```

```bash
npm run dev
```

El terreno ya viene generado en `public/data/dem/`. Para regenerarlo desde cero
(descarga ~360 teselas de elevación, unos 15 MB):

```bash
npm run dem
```

### Controles

| Tecla | Acción |
|---|---|
| `WASD` | Moverse |
| `Shift` | Correr |
| `Espacio` | Saltar / nadar hacia arriba |
| `Ctrl` / `C` | Agacharse |
| `F` | Alternar primera y tercera persona |
| `E` | Recolectar / identificar / beber |
| `Q` | Comer lo mejor del bolso |
| `H` | Intentar cazar (fijate qué dice la ley) |
| `R` | Extraer áridos o levantar chatarra (fijate dónde estás parado) |
| `G` | Abrir el taller: cantera, hornos, hornadas y obras |
| `P` | Tirar la línea (el permiso se saca en la intendencia) |
| `Tab` | Abrir el códice |
| `T` | Acelerar el paso del tiempo |
| `M` | Silenciar o activar el sonido |
| `O` | Posproceso: completo / sin oclusión / crudo |
| `C` | Cambiar calidad: alta / media / baja / mínima |
| `F3` | Panel de diagnóstico |

---

## El mundo es real

El relieve **no es procedural**: son datos de elevación satelital
(Terrarium / Mapzen sobre SRTM y NASADEM) descargados, remuestreados y
verificados contra hitos reales.

Mundo de **65,5 × 65,5 km** a 32 m por texel, de lat −41,39 a −40,81 y
lon −71,91 a −71,13. Sin edificios: sólo relieve, como se pidió.

El build valida el terreno y **falla si no coincide con Bariloche**:

```
OK   Cerro Tronador   3437 m  (real 3478, dif  -41 m)
OK   Cerro Catedral   2370 m  (real 2388, dif  -18 m)
OK   Cerro López      2064 m  (real 2076, dif  -12 m)
OK   Cerro Otto       1419 m  (real 1405, dif  +14 m)
OK   Lago Nahuel Huapi 769 m  (real  764, dif   +5 m)
OK   Lago Gutiérrez    808 m  (real  800, dif   +8 m)
OK   Lago Mascardi     807 m  (real  800, dif   +7 m)
OK   Nahuel Huapi ocupa 354 km2 dentro del mundo
```

Las diferencias de pocos metros en los lagos son el sesgo geoidal EGM96, y la
subestimación de las cumbres es el suavizado propio del SRTM en picos afilados.

Los **35 cuerpos de agua** no se dibujaron a mano: se detectan buscando
superficies planas conectadas en el DEM y se bautizan por cercanía a coordenadas
conocidas. La **red de arroyos** sale de acumulación de flujo D8 sobre el propio
relieve, así que los cauces corren por donde correría el agua de verdad.

### La sombra de lluvia manda

El hecho ecológico que ordena la región está modelado explícitamente: la
precipitación cae de ~3500 mm/año en el oeste a ~600 mm en el este en 60 km.
De ahí sale sola la distribución del bosque —selva valdiviana húmeda al oeste,
coihue en el medio, ciprés y ñire hacia el este, estepa en el extremo seco— sin
pintar biomas a mano.

---

## Contenido educativo

Investigado y verificado contra fuentes oficiales (Parques Nacionales, SIB,
CONICET, SAREM, IUCN, SMN).

- **`src/data/flora.json`** — 63 especies y 12 biomas, con altitud, exigencia
  hídrica, floración, usos mapuche y nombre en mapuzugun cuando se pudo verificar.
  6 invasoras.
- **`src/data/fauna.json`** — 61 especies con estado UICN real, medidas, dieta,
  hábito de actividad y rol ecológico. 9 invasoras, 8 amenazadas.
- **`src/data/geografia.json`** — gradiente de precipitación en 8 puntos,
  6 unidades litológicas, 5 volcanes, 5 glaciares, 17 lagos, 7 ríos, 16 cerros
  y 14 fenómenos naturales.
- **`src/data/caza.json`** — 6 normas citadas, 3 categorías de protección,
  11 especies con temporada, 4 vedas y 4 fuentes de carroña. Distingue lo que
  rige dentro del parque de lo que rige en Río Negro: el ciervo colorado y el
  jabalí se cazan de marzo a mayo por turnos de subasta (Res. Directorio APN
  277/2011), mientras que la liebre, fuera del parque, no tiene temporada ni
  cupo. El huemul es Monumento Natural por Ley 24.702. Incluye el régimen de
  pesca: permiso obligatorio, tres ambientes con su temporada, cinco
  modalidades, medidas y devolución obligatoria.
- **`src/data/mineria.json`** — 4 normas citadas, la geología que explica por
  qué acá no hay metal, 7 materiales con su origen real, 5 recursos declarados
  sin fuente local, 4 hornos y 12 recetas. El artículo 5 de la Ley 22.351
  prohíbe la minería en el Parque igual que la caza; en la Reserva Nacional
  puede autorizarse una cantera, y fuera del área protegida rige el dominio
  provincial y el Código de Minería.
- **`src/data/construccion.json`** — 4 normas citadas, 4 categorías de obra
  según jurisdicción, 11 obras y 4 recetas de aserradero, ahumadero y molino.
  El mismo artículo 5 que prohíbe cazar y extraer prohíbe también construir,
  con la excepción de las obras de uso público autorizadas: por eso existen los
  refugios de montaña y no las cabañas particulares al lado.
- **`src/data/historia.json`** — 6 eras, 32 eventos, 12 personajes,
  16 entradas de mitología, 30 topónimos en mapuzugun, 47 tecnologías
  encadenadas en un árbol de saberes y 20 sitios históricos.

Durante la investigación se detectó que tres especies pedidas **no habitan la
región** (el sapo rococó es del litoral; la lagartija de Magallanes y el
chinchillón anaranjado son de Santa Cruz). Se dejaron documentadas con su
distribución real en vez de inventarlas, y se agregaron las especies que sí
están registradas en el parque.

El **códice** (`Tab`) es el objetivo del juego, con seis secciones: fauna,
flora, geografía, historia, mitología y saberes.

Qué se colecciona y qué no es una decisión deliberada:

- **Fauna y flora** se descubren avistándolas en su hábitat real y se completan
  identificándolas de cerca.
- **Cerros, lagos, glaciares y sitios históricos** se descubren llegando hasta
  ellos. El radio depende de qué tan lejos se ven: 6 km para el Tronador,
  1,8 km para un cerro, 260 m para un sitio.
- **Los hechos históricos** se revelan al descubrir el lugar donde ocurrieron.
- **La mitología mapuche, la toponimia y el árbol de saberes** están
  disponibles desde el principio. Poner la cosmovisión de un pueblo vivo
  detrás de una mecánica de recolección sería tratarla como un trofeo.

---

## Estado real

### Funciona

- Carga del DEM, consultas de altura, pendiente, agua y humedad
- Terreno CDLOD instanciado, un solo draw call, sin grietas entre niveles
- Física del jugador: cápsula sobre campo de alturas, escalón, resbalón en
  pendientes de más de 48°, flotación y daño por caída
- Lagos con Fresnel, absorción de Beer-Lambert por profundidad real y espuma
  de orilla, sobre grilla radial centrada en la cámara
- Vegetación instanciada por aptitud ecológica (5700 plantas, 26 especies),
  con follaje en tarjetas recortadas por alfa sobre un atlas de hojas dibujado
  proceduralmente: hoja oval para los Nothofagus, acícula para las coníferas
- Nivel de detalle con impostores horneados: más allá de 120 m cada árbol pasa
  a ser una cartelera cilíndrica de dos triángulos. La vegetación baja de
  1.935.700 a 45.262 triángulos, 43 veces menos, y el cuadro completo de
  11,8 M a 2,4 M. Cada especie se hornea desde 8 azimuts en un atlas de 4 × 2,
  y el shader interpola entre las dos vistas vecinas, así el árbol lejano
  cambia de perfil al rodearlo (26 MB de atlas en total)
- Sotobosque de 13 700 elementos en dos escalones: coirón, pastizal húmedo,
  helechos, michay, piedras sueltas y troncos caídos hasta 64 m, y champas más
  grandes y ralas en el anillo de 64 a 192 m. Cada tipo con su regla ecológica.
  El sembrado se reparte entre cuadros con presupuesto de 5 ms, así cruzar una
  celda no produce un tirón
- Fauna con máquina de estados, animación por partes y filtro de hábitat
- Ciclo día/noche con posición solar astronómica para latitud −41,13
- Clima mensual con las normales de Bariloche Aero
- Códice de seis secciones con descubrimiento por proximidad, 41 lugares
  reales y unos 65.000 caracteres de contenido verificado accesible en juego
- HUD en español con posición geográfica real, clima y estado vital
- Inventario por peso (38 kg), que además frena al jugador cuesta arriba
- Recolección con una sola tecla: identifica al animal cercano, bebe si hay
  agua, o cosecha la planta o la mata que tenga delante
- Supervivencia con temperatura real: gradiente de 6,5 °C/km, enfriamiento por
  viento y mojadura. En un día de verano a 14,6 °C, la costa del lago es
  segura, el cerro Otto ya produce hipotermia leve y la cumbre del Catedral
  (sensación 0,1 °C) va bajando la salud
- Puntos de saber que se ganan conociendo, no matando, y desbloqueo de
  tecnologías que consume materiales del bolso
- Cantera, fragua y hornos con cocción en horas del mundo, y once obras
  construibles que abrigan, guardan y procesan material
- Tres jurisdicciones dibujadas sobre el mapa —Parque, Reserva Nacional y
  provincia— que cambian lo que la ley permite hacer en cada lugar
- Peces instanciados en el agua y pesca con permiso, temporada por ambiente,
  devolución obligatoria de nativos y medida máxima de salmónidos
- Los catorce fenómenos naturales del dataset ocurriendo, con aviso previo,
  desarrollo y amaine, y con lluvia, nieve, granizo, ceniza, rayos y humo que
  se ven caer
- Audio sintetizado en tiempo real: viento, lluvia, granizo, orilla, fuego,
  truenos con su demora por distancia y pasos con cadencia por zancada

### Roto o a medio hacer

1. **El follaje no tiene variación de brillo por cara.** Las tarjetas se
   iluminan con la normal de la copa, que da volumen pero aplana el detalle
   interno; falta oclusión propia dentro de la copa.
2. **Ocho vistas siguen siendo pocas para un giro rápido.** El cruce entre
   vistas vecinas se nota si la cámara barre rápido en horizontal. Subir a 12 o
   16 vistas lo suavizaría a costa de memoria.
3. **El árbol de saberes llega hasta la mitad y ahí se corta por honestidad.**
   Con la caza regulada, la carroña, la cantera y la fragua, 26 de las 47
   tecnologías tienen todos sus materiales al alcance. Las 21 restantes piden
   batería, motor, radio, sensor, panel o combustible nuclear, y ninguna de
   esas cosas sale de un bosque: para llegar ahí haría falta industria, no otro
   sistema de recolección.
4. El audio es de ambiente y de acciones; no hay música ni voces de fauna.
5. El sotobosque llega hasta 192 m. Más allá el suelo queda desnudo, aunque a
   esa distancia la niebla aérea ya disimula bastante el corte.

#### La caza, y por qué casi siempre te la van a negar

El árbol de tecnologías arranca con punta de proyectil, boleadora, arco de
colihue y toldo, y los cuatro piden cuero y tendón. Se resolvió por las dos vías
que la realidad admite, y ninguna es cazar fauna nativa.

**Dentro de un parque nacional argentino, la fauna autóctona no se caza nunca.**
No hay temporada, no hay cupo, no hay permiso que lo habilite. Esto es lo que
más se malentiende del tema, así que el juego lo enseña haciéndolo: si apuntás a
un huemul y pulsás `H`, el juego no bloquea la acción en silencio, te explica
qué es un Monumento Natural y te descuenta puntos de saber. La negativa es el
contenido, no un obstáculo.

Lo que sí se puede:

- **Exóticas invasoras** (ciervo colorado, jabalí, liebre, visón), porque
  arrasan con el bosque nativo: el ciervo ramonea los renovales de coihue y
  lenga e impide que el bosque se regenere. Aun así no es libre: hay temporada,
  y cazar fuera de ella también penaliza, porque las vedas existen para no
  interrumpir la reproducción incluso de una especie que se quiere controlar.
- **Aprovechar restos hallados**: presas de puma, animales muertos por el
  invierno, astas de desmogue. No es cazar, es lo que hace cualquier carroñero
  del bosque. Un puma deja cerca del 40 % de su presa y de ahí comen el cóndor,
  el zorro y el chimango.

Con estas dos vías el árbol pasó de 7 a 15 tecnologías alcanzables: las dos
primeras eras quedan jugables completas.

#### Los eventos naturales, y por qué avisan antes

`geografia.json` describía catorce fenómenos con su estacionalidad, su
peligrosidad, su frecuencia y —lo más útil— **sus señales previas**. Eso último
es la parte educativa: en montaña casi nada pasa de golpe, y saber leer el aviso
es la diferencia entre volver y no volver. Por eso cada evento tiene tres
momentos y el jugador los ve: el aviso con las señales previas, el desarrollo, y
el amaine.

Los eventos **no se sortean contra el vacío**: se disparan cuando el clima
simulado los habilita. No hay viento blanco sin viento y sin nieve, ni incendio
con el suelo mojado. La frecuencia del dataset pondera, no decide, y el
resultado tiene firma geográfica: medido sobre un año simulado, la lluvia
orográfica sólo aparece en la ladera húmeda del oeste, el viento blanco y la
avalancha sólo arriba de la cota de nieve, y la niebla de valle sólo abajo. Son
entre 40 y 76 episodios por año según dónde se esté parado, con el ambiente
alterado alrededor del 10 % del tiempo.

Hay una cadena que me gusta especialmente porque no está escrita a mano: la
**sequía estival** sube el riesgo de incendio, y con el suelo seco y viento el
**incendio forestal** se enciende solo. Salieron siete incendios en tres años
simulados. Costó un defecto de orden: el sorteo corría antes de aplicar los
eventos activos, así que el riesgo que levantaba la sequía todavía no existía
cuando se tiraba el dado y el incendio no podía ocurrir nunca.

#### Lo que ahora se ve caer

Hasta acá el clima existía en los números y en el color del cielo, pero no se
veía caer nada. `src/world/Clima.js` dibuja lluvia, nieve, granizo, ceniza,
rayos y humo, con tres decisiones que importan:

- **La precipitación viaja con la cámara**, en una caja de 62 m que se recicla
  por los bordes. Dibujar lluvia en 65 km de mundo no tiene sentido.
- **La lluvia son segmentos, no puntos.** Una gota vista de costado es una raya
  corta —medio metro, no tres— inclinada por el viento real del estado del
  ambiente.
- **El rayo no es una textura, es un golpe de luz**: sube la intensidad de las
  cascadas y la exposición por unos cuadros, que es lo que hace un relámpago de
  verdad e ilumina el paisaje entero.

El humo del incendio son bocanadas con degradado radial y grumos generados en un
canvas; con planos lisos la columna se veía como una pila de cajas.

**Un defecto que costó encontrar y que vale documentar**: el render usa
`logarithmicDepthBuffer`, y un `ShaderMaterial` propio que no incluya los chunks
`logdepthbuf_*` escribe una profundidad que no se corresponde con la del resto de
la escena. El terreno se come las partículas y no se ve caer nada, sin ningún
error en consola. Es el mismo patrón que los otros tres defectos de shader de más
abajo: **un shader mal integrado no lanza excepciones, sólo desaparece**.

#### Las grietas del terreno, y por qué la primera solución no funcionó

Desde el aire aparecían líneas blancas a trazos recorriendo el valle, con
quiebres en ángulo recto: grietas de un píxel entre nodos del terreno, por las
que se veía el cielo. El morphing de CDLOD sólo cierra la costura entre un nodo y
su vecino de **un** nivel de diferencia, y este árbol no está balanceado a 2:1
—la distancia se mide contra la caja del nodo, y en terreno montañoso dos nodos
contiguos pueden diferir en dos niveles—.

La solución es una falda: un anillo de vértices duplicados en el borde de cada
nodo, hundido en proporción a su tamaño, que tapa la rendija. Cuesta 768
triángulos por nodo sobre 6.144.

Lo que vale contar es que **la falda no funcionó la primera vez**, y el resultado
era exactamente idéntico a no tenerla: el devanado de las tiras estaba invertido
y el culling de caras traseras se las comía enteras. Se descubrió poniendo el
material en `DoubleSide` un momento: las grietas desaparecieron, y eso señalaba
al devanado y no a la geometría. Antes de eso se había probado —y descartado—
que fueran plantas, que fuera el agua, y que fuera la distancia de morphing
medida en planta en vez de en 3D. Esa última no era la causa, pero el arreglo se
dejó igual: la selección de nodos mide en 3D y el shader medía en planta, y desde
el aire eso hacía que el morphing terminara en otro lado. También se le dio su
propio uniforme de cámara, porque en el paso de sombras `cameraPosition` es la de
la luz.

#### Las ramas que sobresalían de la copa

Los árboles de lejos mostraban patas de araña: ramas oscuras y rectas que
pasaban de largo el follaje y se recortaban contra el cielo. Eran proporcionales
al tronco en vez de al alcance de la copa, y en el coihue, que es el de copa más
ancha, sobraban por casi un 15 %. Ahora el largo se deriva del alcance del
follaje y del ángulo de elevación de la rama, así que toda rama termina dentro de
la copa, que es donde no se la ve.

#### El error de método que costó el rendimiento

Vale escribirlo porque es la lección más cara del proyecto: **se verificó con
capturas fijas, nunca con un cuadro corriendo.** Una captura dice si algo se
dibuja bien; no dice si el juego anda. El contador de fps que se leía durante el
desarrollo daba números imposibles —656 fps, una llamada de dibujo— porque el
panel del navegador no estaba componiendo cuadros, y en vez de desconfiar de la
medición se siguió construyendo encima.

Cuando por fin se midió con `EXT_disjoint_timer_query_webgl2` sobre la placa de
destino real —una **Intel HD Graphics 4000, de 2012**— el cuadro tardaba
**504 ms**. Dos cuadros por segundo.

El desglose por subsistema encontró el culpable enseguida, y no era el que
parecía: **el terreno se llevaba 377 de esos 504 ms**, y no por polígonos sino
por el shader de fragmento. Calculaba unas **180 octavas de ruido por píxel** y
después multiplicaba la mitad por cero: las escalas finas —la mata de 3,5 m, el
grano de 40 cm, la gravilla de 12 cm, el relieve fino de la normal— se computaban
completas aunque su factor de desvanecimiento fuera 0 a doscientos metros.

El arreglo es aburrido y enorme: envolver cada escala en el `if` de su propio
factor y bajar las octavas de cinco a tres o dos según el término. Un píxel
lejano pasó de 180 octavas a nueve.

| | antes | después |
|---|---|---|
| Cuadro completo | 504 ms (2 fps) | **26 ms (39 fps)** |
| Terreno | 377 ms | 1,7 ms |

El resto del cuadro se reparte hoy en sombras (7 ms), oclusión ambiental
(4,5 ms), vegetación (2,3 ms) y resplandor (1,8 ms).

#### Presets de calidad, detección y gobernador

Que el juego ande en la máquina de quien lo escribe no significa nada, y elegir
la calidad a ojo desde otra máquina es adivinar. Así que `src/engine/Calidad.js`
hace tres cosas:

1. **Detecta la placa** por su cadena de identificación y arranca en el nivel que
   le corresponde. Una HD 4000 arranca en *Baja*, no en *Alta*.
2. **Aplica el preset en caliente**: resolución de render —la palanca más grande,
   porque casi todo lo caro se paga por píxel—, tamaño y alcance de los mapas de
   sombra, oclusión, resplandor, suavizado, distancia de vista y un recorte de
   instancias de pasto y árboles.
3. **Mide el cuadro de verdad y se ajusta solo**, con histéresis y tiempo de
   gracia. Si el jugador elige a mano con `C`, el gobernador se apaga: ya
   decidió alguien con más información que el programa.

#### Oclusión ambiental y corrección de color

Era lo que más pesaba en el aspecto general: nada se apoyaba en nada. El pasto no
oscurecía su base, las matas no se sombreaban entre sí y todo parecía calcomanía
pegada sobre el terreno.

**Por qué una oclusión propia y no la de three.** `GTAOPass` y `SSAOPass`
dibujan la escena una segunda vez con `scene.overrideMaterial` para sacar
normales y profundidad. Acá eso no sirve: el terreno no existe como geometría
—se genera desplazando vértices en el shader— y un material impuesto desde
afuera lo dibujaría plano a cota cero. Lo mismo con la vegetación instanciada y
con las tarjetas recortadas por alfa, que serían rectángulos sólidos.

La salida fue no dibujar nada de nuevo: se le engancha una textura de
profundidad al objetivo del compositor, y esa profundidad es —por
construcción— la de la escena tal como se dibujó. De ahí se reconstruye la
posición de cada píxel y la normal por diferencias, se muestrea en espiral, se
desenfoca en dos pasadas conscientes de la profundidad y recién ahí se mezcla con
el color. La oclusión se calcula a media resolución: es de baja frecuencia y a
resolución completa se paga cuatro veces por una diferencia que no se ve.

Dos trampas costaron su rato y quedan documentadas en el código:

- **`this.render = renderer` dentro de un `Pass` lo rompe.** `Pass` tiene un
  método `render`, y asignarle el renderer lo pisa: el compositor falla con
  `pass.render is not a function`.
- **Los dos búferes del compositor comparten la textura de profundidad.** El
  segundo objetivo sale de `clone()`, y el clon de una textura comparte su
  `source`; como three indexa las texturas de GPU por `source`, ambos terminan
  con la MISMA textura. Al leerla mientras se dibuja sobre el otro búfer, el
  driver detecta un bucle de realimentación, **descarta el dibujo y la pantalla
  queda negra**, avisando sólo con un `GL_INVALID_OPERATION` en la consola. La
  solución es darle al segundo objetivo su propia textura de profundidad.

La corrección de color agrega techo suave a las luces —el cielo nublado se iba a
blanco puro—, curva en S, sombras frías contra luces cálidas, algo de saturación
y un viñeteado apenas perceptible.

Todo esto se apaga con `O`, en tres estados. La oclusión cuesta, y cuánto depende
mucho de la placa; que se pueda comparar es más honesto que elegir por el
jugador.

#### Dos patrones que se veían y ya no

- **La grilla del valle.** Desde el aire, el terreno se veía como un damero
  regular de manchones verdes: era el mosaico de detalle repitiéndose. Se rompe
  con una tercera lectura de la misma textura, con los ejes cambiados, un período
  muy distinto y un corrimiento, que **modula** en vez de sumarse.
- **El pastizal pegado.** La oclusión de pantalla resuelve el contacto de cerca
  pero se desvanece a los pocos metros por costo. El sotobosque lleva ahora su
  propia oclusión horneada: la base de cada mata recibe casi la mitad de luz que
  la punta.

#### El suelo de cerca

El terreno tenía detalle en tres escalas —manchones de 48 m, matas de 3,5 m y
grano de 40 cm— y ninguna resolvía los últimos metros, que es justamente donde el
jugador mira. Se agregó una cuarta escala de 12 cm para el moteado del albedo y
para la normal, que es la que hace que la luz rasante enganche en el grano en vez
de resbalar sobre una superficie lisa.

Un detalle que salió mal en el camino y vale como aviso: esa gravilla se metió
primero en el campo `detalle`, que decide parches de vegetación y vetas de roca.
El resultado fue un suelo lleno de manchas negras del tamaño de una mano. La
frecuencia alta sirve para el moteado y la normal, no para la estructura.

#### Los peces, y la contradicción que el parque administra

La pesca deportiva es **la única actividad extractiva que un visitante común
puede ejercer legalmente dentro del parque**, y existe sobre una contradicción:
casi todo lo que se pesca es exótico. Los salmónidos —trucha arcoíris, trucha
marrón, salmón encerrado— se sembraron desde principios del siglo XX en aguas
que no los tenían, con la Estación de Piscicultura de Bariloche entre los focos
de esa introducción. Hoy sostienen una actividad turística enorme y al mismo
tiempo desplazan a la perca criolla, al puyén y al pejerrey patagónico. El
parque no resuelve esa contradicción: la administra, y el juego la muestra.

Los siete peces del dataset ahora existen en el agua, en cardúmenes instanciados
que se pueblan alrededor del jugador: el puyén chico en la orilla y en
superficie, la perca y el puyén grande más hondo, los salmónidos en todos lados
—que es el problema— y dominando el arroyo chico, donde más desplazan a los
nativos.

Pescar pregunta lo mismo que pregunta un guardaparque, y en ese orden:

1. **Permiso.** Es obligatorio y no se consigue en cualquier lado: hay que ir a
   la intendencia, en el Centro Cívico. Tirar la línea sin permiso es la
   infracción más común y la más fácil de evitar.
2. **Ambiente y temporada.** El lago Nahuel Huapi tiene temporada extendida, del
   1 de octubre al 31 de mayo; los ríos y arroyos la general, del 1 de noviembre
   al 30 de abril. En octubre el juego te deja pescar en el lago y te lo niega en
   el río, que es exactamente la diferencia que fija el reglamento.
3. **Especie.** Los nativos se devuelven siempre, por la misma razón por la que
   no se caza un huemul: son fauna autóctona dentro de un área protegida.
4. **Medida.** Al salmónido grande también se lo devuelve, porque el reproductor
   grande vale más en el agua que en la mochila.

Sobre 200 tiradas medidas en el lago en febrero: picaron 128 peces, el 79 % de
ellos salmónidos introducidos, y de esos se conservó el 46 % —el resto se pasaba
de medida—. Los 27 nativos volvieron al agua sin excepción. Que lo exótico domine
el anzuelo no es un sesgo del juego: es el estado del lago.

#### La minería, que es la misma ley leída de nuevo

El artículo 5 de la Ley 22.351 es el mismo que prohíbe la caza: también prohíbe
**la exploración y la explotación mineras** dentro de un Parque Nacional. Así
que la mecánica es hermana de la de caza, y la negativa vuelve a ser el
contenido. Lo nuevo es que ahora la ley tiene un lugar en el mapa: hay tres
jurisdicciones y cambian lo que se puede hacer.

- **Parque Nacional**, el área núcleo: no se extrae nada, y el fuego sólo se
  hace en sitios habilitados. Intentarlo explica la norma y descuenta saber.
- **Reserva Nacional**, la franja de la ruta, las villas y el Catedral: acá la
  Administración de Parques Nacionales *puede* autorizar canteras, pero
  autorizable no es lo mismo que autorizado.
- **Fuera del área protegida**, el ejido de Bariloche y la estepa del este: rige
  el dominio provincial de los recursos y el Código de Minería, y sacar áridos
  es una actividad normal y regulada.

El trazado de esos límites en `src/world/Limites.js` es **esquemático**: umbrales
de latitud y longitud elegidos para que cada lugar conocido caiga en la
categoría correcta —el Centro Cívico afuera, Llao Llao y el Catedral en reserva,
Blest y el Tronador en el área núcleo—. Sirve para enseñar que la línea existe,
no para decidir nada real.

La segunda mitad del asunto no es jurídica sino geológica, y sorprende más: **en
la comarca andina del Nahuel Huapi no hay metal**. El Batolito Norpatagónico es
roca plutónica sin mineralización explotable, y el hierro del país sale de
Sierra Grande, a unos seiscientos kilómetros al este. Lo que de verdad se extrae
alrededor de Bariloche son áridos: arena, ripio, tosca. Así que el juego no
inventa una mina de hierro en el bosque. El metal se consigue como se consiguió
siempre acá: **recuperando chatarra y volviéndola a forjar**, que es lo que hizo
cada fragua de puesto durante un siglo. La chatarra aparece donde hubo gente y
no aparece en el área núcleo, y levantarla de un sitio histórico está penado por
la Ley 25.743, así que ahí también hay una negativa que enseña.

De ahí sale una cadena que sí es jugable entera: leña → carbonera → carbón
vegetal → fragua → hierro → herramienta → cantera → arena y ripio → horno de
barro → cerámica, ladrillo, vidrio de bosque y hormigón puzolánico. El vidrio se
hace con arena y ceniza de leña, sin sosa ni cal traídas de lejos, como el
vidrio de bosque europeo; el acero se saca por cementación en la fragua. Cada
receta lleva horas del mundo, no segundos reales, así que la carbonera de
treinta horas se resuelve acelerando el reloj con `T`.

Con esto el árbol pasó de 15 a 26 tecnologías con todos sus materiales al
alcance.

#### La construcción, que es la misma ley leída por tercera vez

El artículo 5 de la Ley 22.351 vuelve a aparecer: también prohíbe levantar
edificios e instalaciones dentro de un Parque Nacional, salvo los destinados al
control del área y a la atención del turismo, autorizados por la Administración
de Parques Nacionales. Esa excepción no es un detalle: **es la razón por la que
existen los refugios de montaña del Nahuel Huapi** —Frey, Jakob, López, Otto
Meiling, sostenidos en general por el Club Andino Bariloche— y por la que no
existe una cabaña particular al lado, a la misma altura y con la misma vista.

El juego lo pone en la mano del jugador con cuatro categorías, cada una con su
jurisdicción:

- **Refugio efímero** (parapeto, vivac): va a todos lados, incluida el área
  núcleo, porque la ley no lo trata como obra. Es material caído y se desarma
  solo a los tres días. Ese vencimiento no es una limitación técnica: es
  exactamente la condición que lo hacía legal.
- **Campamento** (toldo, troje): en reserva y afuera. Dentro del parque el
  acampe sólo va en áreas habilitadas.
- **Obra de uso público** (refugio de montaña): la excepción de la propia ley.
  Pide la tecnología correspondiente y estar por encima de los 1.100 m, porque
  un refugio se justifica donde el clima es un peligro.
- **Construcción permanente** (galpón, cabaña, casa de piedra, aserradero,
  ahumadero, molino): sólo fuera del área protegida.

Las obras no son decorado: hacen tres cosas medibles.

**Abrigan**, y eso entra en el modelo térmico. Estar bajo techo no calienta el
aire de la montaña, pero corta el viento —de donde sale casi toda la pérdida de
calor— y un recinto cerrado se sostiene por encima del ambiente. En la cumbre
del Catedral, un día de 6 °C con viento de 45 km/h, el equilibrio del cuerpo a
la intemperie cae a 33,3 °C y la salud se va a 63; un vivac lo lleva a 34,3 y un
refugio de montaña a 35,1, apenas por encima del umbral de daño. Sin fuego, eso
es exactamente lo que da un refugio de piedra. En la costa del lago, en cambio,
un vivac alcanza para pasar de perder salud a estar seguro.

**Guardan**: un troje aguanta 60 kg y un galpón 240. Con el bolso limitado a 38
kg, poder dejar material sin cargarlo es lo que permite dejar de vivir en viaje.

**Procesan**: el aserradero convierte troncos en tabla y poste, el ahumadero
carne en charqui y el molino semilla en harina. Aparecen en el mismo taller que
los hornos, porque para el jugador es todo cargar y esperar.

Un detalle de vocabulario que cambió el juego: **la madera en bruto ya no
satisface los pedidos de tabla ni de poste**. Antes cualquier rama servía para
todo; ahora hace falta el aserradero. Es la diferencia entre construir y talar, y
prefiero que esté en las reglas y no sólo en un texto.

#### El audio, sintetizado y sin un solo archivo

No hay banco de muestras y no lo va a haber. Grabaciones de campo del Nahuel
Huapi con licencia clara son difíciles de conseguir, y una biblioteca genérica de
"bosque" traería mirlos europeos y cigarras que acá no existen. Antes que poner
fauna equivocada, se sintetiza lo que sí es honesto describir con física.

Y resulta que casi todo el ambiente de la Patagonia andina **es ruido filtrado**:
el viento del oeste, la lluvia sobre el follaje, el agua contra la orilla, el
crepitar de una fogata y el trueno son el mismo ruido blanco pasado por filtros
distintos. Lo que cambia es dónde está el filtro y cómo se mueve.

Tres cosas que se modelaron en serio porque cambian cómo se siente el lugar:

- **El viento sube con la altura, no sólo con su velocidad.** En la cumbre suena
  aunque abajo esté calmo. Y el silbido agudo entre las ramas recién aparece
  pasados los 35 km/h; por debajo hay sólo aire moviéndose.
- **La nevada silencia.** La nieve cae sin energía y además absorbe el resto del
  ambiente: medido en la mezcla, una nevada intensa deja el canal de
  precipitación en 0,011 contra los 0,126 de la lluvia. El silencio de una
  nevada no es una licencia poética, es absorción acústica.
- **El trueno llega tarde.** El rayo dispara luz al instante y el sonido viaja a
  343 m/s, así que el trueno se agenda con esa demora: a 3.430 m, diez segundos
  exactos. Contar esos segundos es cómo se mide la distancia de una tormenta, y
  el juego permite hacerlo.

Los pasos no se reproducen por temporizador sino **por distancia recorrida**, así
que la cadencia sale sola: 30 pasos en 26 m caminando, 46 en 62 m corriendo, y
ninguno en el aire. El timbre cambia en el agua y agachado.

#### Sobre la suavidad del terreno

El terreno tiene ondulaciones largas y suaves, y **no es un defecto**: es lo que
mide el dato. El SRTM entrega una muestra cada 32 m, así que todo accidente más
chico que eso sencillamente no existe en la fuente. Se le suma un campo de
relieve fino de 1,9 m, pero la escala media —barrancas de 5 m, terrazas,
afloramientos— no está y no se puede inventar sin dejar de ser Bariloche.

Vale la pena decirlo porque se descartaron tres explicaciones equivocadas antes
de llegar a esta: estiramiento de la proyección (se resolvió con triplanar y no
cambió), un hash de ruido con franjas diagonales (se cambió por el de Hoskins y
no cambió) y mipmapping en ángulo rasante (se probó sin mipmaps y no cambió).

### Corregido en la segunda pasada

- El cielo salía negro y después anaranjado con el sol alto: la profundidad
  óptica mezclaba kilómetros con metros y daba `exp(-33)`. Ahora usa la forma
  de albedo por `(1 - transmitancia)`, que satura hacia el blanco en el
  horizonte en vez de dispararse.
- El bosque salía negro por acné de sombra: el follaje se auto-sombreaba. Se
  corrigió con sesgo de sombra escalado por cascada, más un término de
  translucidez foliar.
- El modelo de humedad estaba calibrado a ojo y daba estepa en casi todo el
  mapa. Ahora interpola precipitación real en escala logarítmica y reproduce
  el gradiente medido: 4082 / 1602 / 800 / 499 mm contra los 4000 / 1500 /
  800 / 500 reales de Puerto Blest, Llao Llao, Bariloche y Dina Huapi.
- El reloj mostraba UTC en vez de hora local, y el ciclo diario de temperatura
  y los hábitos de actividad de la fauna corrían tres horas corridos.

### Lecciones que quedaron en el código

Tres defectos costaron mucho tiempo y están comentados en el código para que no
se repitan:

- **`CSM.setupMaterial()` no encadena: reemplaza `onBeforeCompile`.** Si se
  llama después de preparar un material con inyecciones propias, esas
  inyecciones desaparecen sin ningún error. El terreno se dibujaba liso, a cota
  cero y negro. Ver `conCSM()` en `src/main.js`.
- **No declarar `geometryNormal` al sustituir `<normal_fragment_begin>`**: lo
  declara después `<lights_fragment_begin>` y el programa no enlaza.
- **Una luz direccional de más desborda `CSM_cascades[]`** en el shader.
- **No apoyarse en `vWorldPosition` de three**: sólo existe según qué chunks
  estén activos, y CSM lo declara en el vértice pero no en el fragmento. La
  vegetación usa su propio varying `vAlturaMundo`.

Los tres primeros comparten un patrón: **un shader que no enlaza no lanza una
excepción**, sólo deja un aviso `useProgram: program not valid` en la consola y
el objeto se dibuja negro o no se dibuja. Ante cualquier cosa que salga negra,
lo primero es interceptar `gl.linkProgram` y leer `getShaderInfoLog`.

---

## Estructura

```
tools/build-dem.mjs     Descarga y valida el relieve real
src/world/Mundo.js      Datos del terreno y consultas
src/world/Terreno.js    CDLOD instanciado + mezclado de materiales
src/world/Cielo.js      Atmósfera, sol astronómico, luna y estrellas
src/world/Agua.js       Lagos
src/world/Vegetacion.js Bosque instanciado por aptitud ecológica
src/world/Tiempo.js     Calendario, estaciones y clima
src/entities/Jugador.js Controlador y física
src/entities/Fauna.js   Animales y comportamiento
src/entities/Peces.js   Cardúmenes en lagos, ríos y arroyos
src/systems/Pesca.js    Permiso, temporada, especie, medida y devolución
src/systems/Eventos.js  Los catorce fenómenos naturales, disparados por el clima
src/world/Clima.js      Lluvia, nieve, granizo, ceniza, rayos y humo
src/engine/Audio.js     Ambiente y acciones sintetizados con WebAudio
src/world/Limites.js    Parque, Reserva y jurisdicción provincial
src/world/Hornos.js     Geometría de fogatas, carboneras, hornos y fraguas
src/systems/Mineria.js  Áridos, chatarra y lo que la ley no deja sacar
src/systems/Fundicion.js  Hornadas, fragua y tiempo de cocción
src/systems/Construccion.js  Obras, abrigo, depósito y lo efímero
src/world/Obras.js      Geometría de refugios, cabañas y obras
src/ui/Taller.js        Panel de cantera, hornos, hornadas y obras
src/ui/Codice.js        Enciclopedia del parque
src/ui/HUD.js           Interfaz
```

---

## Créditos y licencias

- Relieve: [Terrarium DEM](https://registry.opendata.aws/terrain-tiles/)
  (Mapzen / AWS Open Data), derivado de SRTM, NASADEM y datos nacionales.
  Ver [atribución](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- Motor: [three.js](https://threejs.org/)

Proyecto educativo sin fines comerciales. No está afiliado a la Administración
de Parques Nacionales ni la representa.
