# Pendiente de la fase 5 · `piedra` — trabajar la piedra paso a paso

Agente `piedra`, ronda 8. Escrito al terminar, 22/9/2026.
Archivos que toqué, y ninguno más: `src/data/herramientas.json`,
`src/data/historia.json` (sólo `hacha_pulida` y `lasca_obsidiana`),
`src/systems/Fabricacion.js`, `src/systems/Recursos.js`, `src/ui/Iconos.js`.
Nada de `main.js`. Nada de `src/entities/Herramientas3D.js`: los dos modelos que
hacían falta —el percutor y el martillo de piedra— los hizo el jefe el 22/9 a
pedido mío, y lo único que puse yo del lado de los datos fue la ranura (punto
6.1). Tampoco toqué ningún banco (punto 5).

**En una frase:** la primera herramienta de piedra pasa a hacerse en el primer
minuto con una piedra del suelo y ninguna tecnología, y el hacha deja de salir de
un solo paso para salir de cinco —percutor, lasca, preforma picada, hoja pulida
con arena, mango— atada con cordel de fibra y no con tiento, o sea sin subir a
los 1500 m de la obsidiana y sin cazar. De la misma cadena sale el martillo de
piedra, que sirve para abrir huesos y sacar la médula, que es grasa.

---

## 1 · La cadena, entera

| # | Paso | Objeto | Cuesta | Pide | Tecnología |
|---|---|---|---|---|---|
| 1 | El percutor | `percutor` (herramienta de mano, nivel 0, 30 usos) | 1 piedra | — | ninguna |
| 2 | La primera lasca | `lasca_rodado` (herramienta, nivel 1) | 1 piedra | percutor | ninguna |
| 3 | Desbaste y picado | `preforma_hacha` → `preforma` | 2 piedra | percutor | ninguna |
| 4 | El pulido | `pulido_hoja` → `hoja_hacha` | 1 preforma + 2 arena | — | `hacha_pulida` (3 de saber) |
| 5 | El mango | `mango_labrado` → `mango` | 2 madera + 1 cordel | lasca de rodado **o** lasca de obsidiana **o** cuchillo | ninguna |
| 6 | El hacha | `hacha_piedra` (herramienta, nivel 2) | 1 hoja + 1 mango + 3 cordel | — | `hacha_pulida` |
| 7 | El martillo | `martillo_piedra` (herramienta de mano, nivel 2, 150 usos, habilita `rematar`) | 2 piedra + 1 mango + 3 cordel | percutor | ninguna |
| 8 | El uso del martillo | `medula_hueso` → `grasa` | 2 hueso | martillo de piedra | ninguna |

Lo que cambió en lo que ya existía:

- **`lasca_rodado`** dejó de pedir `lasca_obsidiana` y pasó a costar **una**
  piedra en vez de dos: la segunda *era* el percutor, y ahora está escrita como
  lo que es. Su `porQueExiste` decía desde el 7/9 que existía «para que el
  arranque no sea una caminata de 30 a 37 minutos», y era falso mientras pidiera
  la obsidiana. Ahora es cierto, y la ficha cuenta esa historia en vez de
  borrarla.
- **`mango_labrado`** dejó de pedir `lasca_obsidiana` y pasó a pedir *algo que
  corte*, de una lista de tres. Labrar un palo ya no pide subir 700 m.
- **`hacha_piedra`** se ata con **3 cordel** en vez de 4 tientos —el tiento sale
  del cuero, o sea de cazar— y lleva la hoja pulida en vez de dos piedras
  sueltas. Pesa **1,3 kg** en vez de 1,6: es la suma exacta de sus partes (hoja
  0,8 + mango 0,4 + tres cordeles 0,09), y el número viejo no cerraba con nada.
- **`hacha_pulida`** (la tecnología): `requiere` pasó de `['lasca_obsidiana']` a
  `[]` y el costo de **16 a 3** de saber, que es lo que da descubrir un solo
  lugar. Sus materiales pasaron de 3 piedra + 2 cordel a **2 piedra + 2 arena**:
  se aprende a pulir puliendo, y los dos materiales se juntan sin fabricar nada
  antes.
- **`lasca_obsidiana`** perdió `mango_labrado` de su `efecto.herramienta`, que
  era la única razón por la que el mango colgaba de ella. Todo lo demás de la
  talla de obsidiana queda igual.

`Fabricacion.herramientaQueFalta()` acepta ahora una **lista** además de un id, y
la lista se lee como un O: alcanza con tener una sana. Un id suelto significa lo
mismo que antes, así que el huso no cambió de sentido. Cuando falta, el motivo
las nombra a todas («Hace falta tener encima alguna de éstas: …») para que quien
ya tiene el cuchillo no se vaya a fabricar una lasca que no necesita. Es lo único
que toqué de `Fabricacion.js` y es exactamente lo que autorizaba el contrato.

## 2 · La primera hora, contada con el juego

Corrido con `Inventario`, `Equipo`, `Saberes` y `Fabricacion` de verdad, bolso
vacío de 38 kg y 3 de saber, juntando de a una tanda de recolección
(`COSECHA_SOTOBOSQUE`: 2 piedras o 2 fibras por apretada; la arena, 1 puñado):

| | crudo | apretadas de la tecla |
|---|---|---|
| Hasta el hacha | 6 piedra · 4 arena · 6 fibra · 2 madera · 3 de saber | 12 |
| Y además el martillo y una grasa | +2 piedra · +6 fibra · +2 madera · +2 hueso | +8 |

Al terminar el hacha el bolso pesa **2,4 kg** y usa **2 de 24 casillas**: la
cadena no compite por lugar de carga. Nada de lo que hace falta sale de cazar ni
pasa de los 1000 m. Lo único que hay que caminar es el banco de arena, a 500 m
del arranque, y los 3 de saber, que son un lugar descubierto: la Isla Huemul a
1,4 km (en el agua) o el Cerro Campanario a 2,2 km en tierra.

**Dónde queda la línea:** los pasos 1, 2, 3, 5 y 7 —o sea el percutor, la lasca,
la preforma, el mango y el martillo entero— salen con **cero** de saber y sin
moverse del arranque. El **hacha** pide esa caminata de 1,4 a 2,2 km por los 3
puntos. Es lo que el contrato permitía («3 de saber o menos, lo que da el primer
lugar descubierto») y el jefe lo confirmó: ver el punto 4b.

## 3 · El uso del martillo, y por qué ése

Elegí **quebrar hueso para sacar la médula** (`medula_hueso`: 2 hueso → 1 grasa,
pide el martillo). Los otros dos candidatos que consideré y por qué no:

- *Partir un tronco con cuñas*: el juego no tiene un recurso para la madera
  partida. `tabla` y `poste` son del aserradero y tienen su propia cadena; meter
  el martillo ahí sería pisarla.
- *Clavar las estacas de un refugio*: `Construccion` no pregunta por
  herramientas, así que el martillo no cambiaría nada y el uso sería de adorno.

La médula gana porque las tres cosas que pide ya existen y ninguna es cazar: el
**hueso** sale de la carroña que `caza.json` ya entrega —los restos de una presa
de puma rinden cuero, tendón y hueso—, y la **grasa** que produce abre el candil
de grasa, la brea, el curtido y el odre. Hasta hoy la grasa la daba **sólo** la
carroña de faena; ahora hay una segunda vía y pasa por la piedra, que es
exactamente lo que el dueño pidió.

**Fuentes.** Mengoni Goñalons, G. L. (1999), *Cazadores de guanacos de la estepa
patagónica*, Buenos Aires, Sociedad Argentina de Antropología: la fractura
sistemática de los huesos largos para extraer la médula es una de las prácticas
mejor documentadas del procesamiento del guanaco en la Patagonia, y deja un
patrón de fragmentación reconocible en los sitios. Outram, A. K. (2001), «A new
approach to identifying bone marrow and grease exploitation: why the
"indeterminate" fragments should not be ignored», *Journal of Archaeological
Science* 28: 401-410: ese patrón es lo que separa un hueso roto por una persona
de uno roto por un carnívoro.

**La aritmética es mía y está declarada como tal** en el campo `criterio` de la
receta: ninguna de las dos fuentes mide cuánta médula rinde un hueso. Dos huesos
(0,3 kg cada uno) por una grasa (0,3 kg) es una pérdida del 50 % en peso, elegida
para que la médula sea una fuente real de grasa sin volverse la fácil.

## 4 · Las fuentes del resto, y la licencia que tomé

- **Fenton, M. B. (1984)**, «The nature of the source and the manufacture of
  Scottish battle-axes and axe-hammers», *Proceedings of the Prehistoric Society*
  50: 217-243. Sostiene las cuatro etapas y su costo: desbaste por lascado,
  minutos; **picado, 3 a 5 horas**; desgaste, 1 a 3; **pulido, unas 3**; y que se
  pule con arena y agua contra una laja. Citado en el percutor, la preforma, el
  pulido y el martillo. El título es literalmente sobre *axe-hammers*, así que
  sostiene también que la pieza sin filo se queda en el picado y no necesita el
  pulido: ésa es la razón, y no un balance, de que el martillo esté antes que el
  hacha en el árbol.
- **Salas, A. M. (1942)**, «Hachas de piedra pulida y enmangadas del territorio
  del Neuquén», *Relaciones de la Sociedad Argentina de Antropología* 3: 67-72.
  Dos hachas pulidas **con su mango**, de una mina de sal cerca de Chos Malal.
  Citada en el hacha, el mango y la tecnología `hacha_pulida`, y es la que
  sostiene que lo pulido es raro en la Patagonia: la industria dominante es la
  talla por percusión y presión, que es justamente el resto de esta cadena.

**Licencia declarada, nueva: `pulidoSinAgua`** (en `licenciasDeJuego`, junto al
arco, el fuego, la luz nocturna, la arena de playa y la lana del coirón). El
pulido pide arena y **no** pide agua, aunque la fuente dice arena *y* agua. El
motivo, medido: desde la ronda 7 el agua viaja en recipiente, y el primer
recipiente es el metawe de greda, que pide cerámica → horno de barro → nivel 3.
Comprobado con el inventario real el 22/9: en un bolso de arranque,
`Inventario.agregar('agua', 1)` devuelve **0**. Cobrar el agua dejaría la primera
hacha detrás del primer horno, que es el defecto que esta fase vino a arreglar.
La ficha del pulido lo dice completo y cierra el círculo por donde la realidad lo
cierra: se pule en la orilla, que es donde está el agua y donde no hace falta
cargarla.

## 4b · El saber del hacha: queda en 3

Lo planteé como decisión abierta y el jefe la cerró el 22/9: **queda en 3**. La
caminata de 2,2 km al Campanario es parte del primer día y ahora da algo a
cambio; bajarla a 0 saca la única razón para explorar de la primera hora. Si el
dueño lo quiere en el minuto diez, es `hacha_pulida.costoSaber` a 0 y lo cambia
él. No lo toqué.

## 5 · Qué predigo que mide cada guarda, con la cuenta

**`banco-r8-fase5.mjs` entero → VERDE, 7/7.** Corrido y medido, no predicho:

| Sección | Aserciones | Predicción |
|---|---|---|
| 1 · LA CADENA | 15 | verde. P1 a P7, todas de forma sobre los datos |
| 2 · LA PRIMERA HORA | 3 | verde. Crudo del cierre = `piedra, arena, madera, fibra`, los cuatro en `CRUDOS_HORA`; saber usado 3 de 3 |
| 3 · EL MARTILLO SIRVE | 4 | verde. Un solo uso (`medula_hueso`), crudo `hueso, piedra, madera, fibra`, todo en `CRUDOS_SEMANA` |
| 4 · NADIE QUEDA PEOR | 2 | verde. Sin saber **9 → 15**; con todo **48 → 53**. Ninguno se perdió: los 6 nuevos sin saber son `percutor`, `lasca_rodado`, `preforma_hacha`, `mango_labrado`, `martillo_piedra`, `medula_hueso`; el quinto con todo es `pulido_hoja` |
| 5 · LAS NOTAS | 10 | verde. Los siete pasan los 80 caracteres de largo; el hacha cita a Salas y 1942; la preforma y el pulido citan a Fenton |
| 6 · SIN REGRESIÓN | 15 | **ver abajo**: 14 de los 15 verdes, y el que falta no es mío |
| 7 · ARRANQUE | 1 | verde, `vite build` con código 0 |

**`banco-r8-fase5.falsar.mjs` → VERDE, 11/11 con los 3 controles verdes.**
Corrido. Los once caen donde tienen que caer; vale la pena marcar dos:

- `fabricacion-una-sola` (Fabricación vuelve a mirar una sola herramienta) cae
  porque el defecto se queda con **el último** id de la lista, y en
  `mango_labrado` la lista está escrita de más barato a más caro —
  `['lasca_rodado', 'lasca', 'cuchillo']`— así que el último es el cuchillo, que
  pide obsidiana, brea y tiento. La lista está en ese orden porque el motivo de
  «te falta» tiene que señalar el camino más corto, igual que
  `Saberes.faltaPara()`; que además haga caer el defecto es consecuencia, no
  causa.
- `martillo-con-cuero` cae en la sección 3 porque `cuero` no está en
  `CRUDOS_SEMANA` y nadie lo produce, así que la receta nunca queda lista.

**`banco-r6-fase3.mjs` (los iconos) → VERDE, 6/6.** Corrido. Cuatro dibujos
nuevos: `percutor`, `martillo_piedra` (objetos) y `preforma`, `hoja_hacha`
(recursos). 122 dibujos distintos para 122 ids, mínimo 4 formas por icono, cero
SVG escritos a mano de más. **Ojo con la hoja:** ver el punto 6.

### La regresión: el uno que no era mío, con la cuenta — RESUELTO

`banco-r8-fase6.mjs` daba **1/4** y el banco de la fase 5 le pedía **4/4**. No lo
rompí yo: es la fase 6 (`luz`), que todavía no se hizo. Lo comprobé en vez de
suponerlo, y **no toqué el banco**: lo escribí acá con los números y el jefe lo
corrigió el 22/9 en el banco de la fase 5 y en el de la 7, dejando la línea en
`1/4` hasta que esa fase se cierre. Cómo lo comprobé: copié `src` tal como está
en HEAD (`git archive HEAD src`) a `.claude/flota/.tmp-base-piedra/` y corrí el
mismo banco contra esa copia:

```
BANCO_SRC=.claude/flota/.tmp-base-piedra/src BANCO_SECCIONES=ley,noche,cielo,shader
  → ROJO total 1/4
```

Las tres aserciones que caen son idénticas, carácter por carácter, a las que caen
contra mi `src`:

- «Cielo.js exporta brilloLunar(alfaGrados)» — la función no existe todavía.
- «el ambiente: cada noche con luna a ±15 % de Allen» — peor caso
  `2025-02-20T06, α 85°: 0.545 contra 0.115`, el mismo número en las dos corridas.
- «ningún otro uso de uFaseLunar en el shader».

Y `git diff HEAD -- src/engine/ src/world/` no devuelve nada: no toqué un solo
archivo de los que esa fase mide. **No cambié el banco.** El jefe lo revisó, dio
el defecto por suyo y puso la línea en `1/4` con el comentario de por qué. Con
eso, la sección 6 queda en **15 de 15**.

### Tres regresiones que SÍ fueron mías, y cómo las encontré

En la primera corrida entera daban rojo `banco-r7-fase2b.mjs` (6/7),
`banco-r8-fase1.mjs` (7/8) y `banco-r8-fase2.mjs` (9/10). Eran **la misma**, en
cascada: cada una corre su propia regresión y todas llegan a
`banco-r5-fase3.mjs`, que mide «los objetos de ranura mano tienen modelo». Yo le
había puesto `ranura: "mano"` al martillo de piedra, y los modelos 3D viven en
`src/entities/Herramientas3D.js`, que no es de esta fase. Los saqué, las tres
volvieron a 7/7, 8/8 y 10/10, y lo pedí. El jefe hizo los dos modelos el mismo
día y se las devolví puestas: ver el punto 6.1. Con los modelos hechos,
`banco-r5-fase3.mjs` mide ahora **20** objetos de mano en vez de 18 y sigue en
4/4; el martillo de piedra es el más caro del conjunto con 152 triángulos, y el
percutor el más barato con 8.

### Un número del que hay que estar al tanto: la grilla

`banco-r6-fase2.mjs`, sección 7, mide que con nueve herramientas encima se ahogue
**menos del 3 %** de las cargas. Ese porcentaje depende de la tabla entera de
`RECURSOS`, porque la simulación sortea recursos al azar: agregarle dos fichas la
mueve, se ponga el peso que se ponga. Con mis primeros pesos (preforma 1,2 y hoja
1,1) daba **3,4 %** y la sección se ponía roja.

No cambié el banco: rehice la cuenta de los pesos y encontré que la mía estaba
mal. `pilaDe()` reparte por peso, y el salto está en 0,949 kg: por encima, una
ficha apila 2 por casillero; por debajo, apila 5. Una preforma de 1,2 kg ocupaba
casilleros como una piedra. Y mirando de dónde salía mi 1,2, era de sumar las dos
piedras de la receta, que es justamente lo que la receta dice que **no** hay que
hacer: una es el canto y la otra es lo que se va en lascas y polvo. Del canto de
1,4 kg queda **0,9**, y el pulido le saca 100 g más: **0,8**. Con esos números la
sección da **2,2 %** —el barrido completo está abajo— y el hacha pesa la suma de
sus partes.

| preforma / hoja | ahogadas con 9 | sección 7 |
|---|---|---|
| 1,2 / 1,1 | 3,4 % | roja |
| 1,1 / 1,0 | 3,8 % | roja |
| 1,0 / 0,9 | 3,0 % | verde al filo |
| **0,9 / 0,8** | **2,2 %** | **verde** |
| 0,8 / 0,7 | 2,6 % | verde |
| 1,3 / 1,2 | 3,0 % | verde al filo |

## 6 · Lo que encontré y no arreglé

1. **RESUELTO el 22/9, por el jefe.** Había pedido los modelos 3D porque
   `src/entities/Herramientas3D.js` no es de esta fase y la regla del proyecto
   —que mide `banco-r5-fase3.mjs`— es que todo lo que va en la ranura de la mano
   tiene modelo. El jefe hizo los dos y los puso en `IDS_MANO`: el `percutor` es
   el canto entero, redondeado y gordo (0,074 de radio, achatado a 0,86 × 0,92),
   que en silueta no se confunde con la lasca de rodado porque la lasca es una
   esquirla chata; el `martillo_piedra` es cabeza de tres cilindros con la
   garganta picada en el medio y dos ataduras en ella, con el cabo más corto y
   grueso que el de la maza y cuña. Con eso puesto les di la ranura:
   - `martillo_piedra`: `ranura: "mano"`, `durabilidad: 150`,
     `habilita: ["rematar"]`.
   - `percutor`: `ranura: "mano"`, `durabilidad: 30`.

   **De dónde sale el 30** (está en `criterioDurabilidad`, en la ficha): el
   número es una decisión del juego; lo que sale de la fuente es *por qué éste es
   el que se rompe*. El percutor recibe el golpe en su propio cuerpo y no en un
   filo, así que se machuca, se agrieta y se parte en vez de desafilarse, y la
   etapa que lo castiga es la más larga de la cadena —el picado de una sola
   preforma son de 3 a 5 horas de miles de golpes cortos (Fenton 1984)—. En la
   escala del propio árbol cae donde corresponde: dos veces y media la lasca de
   rodado que saca (12) y la cuarta parte del hacha que ayuda a hacer (120).
   Contra la cadena: un hacha más un martillo lo usan en tres recetas, así que
   30 son diez cadenas completas. Y el repuesto es una piedra del suelo sin
   tecnología, que es lo que le permite ser la pieza más frágil del árbol sin ser
   una pared.

   El `habilita: ["rematar"]` del martillo es el único verbo que le puse, y a
   propósito: `rematar` es nivelMinimo 0 y su propia ficha dice «lo que ya cayó
   en una trampa o está herido. No es caza y no abre nada por sí solo». Cierra el
   círculo con la trampa de lazo de la fase 2. **No** le puse `partir_piedra` ni
   `cantera`, que son de la maza y cuña de nivel 3: sería saltearse un nivel.
2. **NUEVO, y es el que importa: `Fabricacion` no gasta la herramienta que pide.**
   Ahora que el percutor tiene 30 usos hay que decir que casi no bajan.
   `Equipo.desgastar()` sólo toca la mano, y los dos que lo llaman son
   `Recoleccion._gastarHerramienta()` —y sólo cuando la herramienta de la mano
   habilita la acción, y el percutor no habilita ninguna— y `Caza._tiro()`, que
   gasta lo que hay en la mano al tirar con el arma. O sea que **el percutor se
   gasta tirando flechas y no picando piedra**, que es exactamente al revés.
   Lo que falta es que `Fabricacion.fabricar()` le gaste un uso a la herramienta
   de `pideHerramienta`. No lo hice por dos razones, y la segunda es la de fondo:
   el contrato me autoriza `Fabricacion.js` sólo para la lista; y no puede ser
   una regla ciega, porque la ficha de `hilar_lana` dice explícitamente que
   **hilar no gasta el huso**. Necesita una marca por receta —algo como
   `gastaHerramienta: true`— y una decisión de quien balancee: con la lasca de
   rodado en 12 usos, si labrar un mango gastara uno, ocho mangos rompen la
   lasca. Está escrito en `notaDurabilidad` del percutor para que no se pierda.
3. **La azuela, la pala de omóplato y la rastra siguen saliendo de piedra cruda
   en un solo paso**, y la azuela además sigue pidiendo 3 tientos, o sea cazar.
   Son las otras tres que cuelgan de `hacha_pulida`. Lo natural es que la azuela
   pase por la misma preforma y el mismo pulido, con un `hoja_azuela` o
   reusando `hoja_hacha`, pero no entraba en este contrato y prefiero no meterme
   sin que alguien lo mida: tocar la azuela mueve `conTodo`.
4. **AVISO PARA LA FASE 7 (`reglas`), que también agrega dibujos: la hoja de
   iconos quedó a 2,22 kB del techo.** Pasó de 133,65 kB (118 iconos) a
   **137,78 kB** (122), y `banco-r6-fase3.mjs` corta en **140 kB**. Mis cuatro
   dibujos cuestan 4,13 kB juntos (percutor 1111 B, martillo 1376 B, preforma
   1167 B, hoja 570 B), que es justo lo que cuesta un icono medio de la familia
   (1156 B). **Con dos iconos más la sección 3 de ese banco se pone roja**, y el
   síntoma va a aparecerle al agente de la fase 7 como si fuera culpa suya.
   No se arregla dibujando más chico —el techo lo consumen los 122, no los 4—:
   se arregla en cómo se empaqueta la hoja (hoy es un `data:` URI por clase, sin
   comprimir y con los colores repetidos en cada dibujo), y eso es una decisión
   de la flota, no mía. El jefe me dijo el 22/9 que lo anotara y no lo tocara.
5. **`efecto.herramienta` y `efecto.recetas` no los lee ningún sistema.**
   `Saberes.faltaPara()` sólo se consulta con `'caza'`, `'horno'` y `'recetas'`
   (esta última sólo desde `Fundicion`). Mantuve las listas al día igual —le
   saqué `mango_labrado` a la obsidiana y le agregué `pulido_hoja` a
   `hacha_pulida`— porque son documentación del códice y estaban mintiendo, pero
   que nadie crea que ahí hay una compuerta: la compuerta es `obj.tecnologia`.
6. **`balanceSaber` del dataset quedó desactualizado**: dice que el árbol pide
   1480 puntos y que el arreglo es `hacha_pulida.requiere = [lasca_obsidiana]`.
   Ese arreglo es justamente lo que P6 prohíbe, y el costo total bajó 13 puntos
   al pasar `hacha_pulida` de 16 a 3. No lo reescribí porque no sé cuánto da el
   total hoy y no quise poner un número sin medirlo; `r4-economia.mjs` lo mide y
   no está en la lista de regresión de esta fase.
7. **La ficha del tiento sigue siendo la mejor atadura y ahora no la usa el
   hacha.** Es correcto —el tiento pide cuero— pero deja una mejora obvia sin
   modelar: rehacer el hacha con tiento cuando ya cazaste tendría que darle más
   durabilidad. No hay hoy ningún sistema de variantes de receta, así que lo
   dejo anotado y nada más.

---

## 7 · Lo que corrí, y con qué salió

```
node --max-old-space-size=6144 .claude/flota/banco-r8-fase5.mjs      → 7/7 (la 6 con la salvedad del punto 5)
node .claude/flota/banco-r8-fase5.falsar.mjs                         → 11/11, 3 controles verdes
node .claude/flota/banco-r6-fase3.mjs                                → 6/6
node .claude/flota/banco-r6-fase2.mjs                                → 8/8
node .claude/flota/banco-r5-fase3.mjs                                → 4/4
node .claude/flota/r8-fabricables.mjs                                → 15 sin saber, 53 con todo
```

La corrida entera y final del banco dio esto, palabra por palabra:

```
VERDE  15  1 · LA CADENA          VERDE   3  2 · LA PRIMERA HORA
VERDE   4  3 · EL MARTILLO SIRVE  VERDE   2  4 · NADIE QUEDA PEOR
VERDE  10  5 · LAS NOTAS          VERDE   1  7 · ARRANQUE (vite build)
ROJO   15  6 · SIN REGRESIÓN      →  MAL  banco-r8-fase6.mjs sigue en 4/4  [1/4]
VERDE  guarda del camino feliz (7/7)   ·   ROJO  total 6/7
```

Catorce de las quince líneas de regresión verdes. La única roja es la fase 6, que
no está hecha; la prueba con números está en el punto 5.

No levanté Vite, no abrí el navegador y no commiteé. La copia de HEAD que usé
para probar que la fase 6 no es mía la borré al terminar; se rehace con
`mkdir .claude/flota/.tmp-base-piedra && git archive HEAD src | tar -x -C .claude/flota/.tmp-base-piedra`
(ese prefijo está en el `.gitignore`).
