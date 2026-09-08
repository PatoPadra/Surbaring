# Ronda 4 — Revisión de rigor de contenido: `src/data/herramientas.json`

Revisor independiente. **No se editó `herramientas.json`.** Se contrastaron sus ~57 objetos,
29 acciones, 5 tecnologías nuevas, 16 recursos y la `notaEcologicaApicultura` contra
`flora.json`, `fauna.json`, `caza.json`, `mineria.json`, `construccion.json`, `historia.json`,
`README.md`, `Recursos.js`/`Recoleccion.js`/`Hallazgos.js`, y contra fuentes públicas
(Ley 22.351, RD APN 277/2011, Reglamento General de Pesca Deportiva Continental Patagónico,
Res. 7/DFS-2026 de Río Negro, SIB, FAO, literatura sobre *Bombus*).

Tres categorías, como pide el encargo:
**FALSO** (sacar), **IMPRECISO** (matizar), **NO VERIFICABLE** (declararlo, que es lo que el
proyecto hace).

Resumen numérico: **12 FALSO**, **15 IMPRECISO**, **9 NO VERIFICABLE + 4 cadenas rotas**.
De 57 objetos, sólo 3 tienen campo `certeza`. El archivo declara en su `notaDeContenido` que
"donde el objeto es genérico … la ficha lo dice" y "donde no se pudo verificar el uso regional
concreto, se declara en `certeza`": esa promesa se cumple en 3 de 57 fichas.

---

## A. FALSO — hay que sacarlo o reescribirlo

### A1. GRAVE · El colihue es macizo, no hueco — contradice `flora.json`
**Dónde:** `objetos[cana_colihue].nota`
> "El colihue es la caña de pescar que la cordillera regala hecha: derecha, **hueca**, liviana y flexible."

`flora.json` (`cana_colihue`, *Chusquea culeou*) dice literalmente lo contrario, y lo pone como
el rasgo distintivo de la especie: "A diferencia de la mayoría de los bambúes, **sus cañas son
macizas, no huecas**, lo que las hace muy resistentes". El SIB de Parques Nacionales coincide.
Es además el rasgo por el que la especie sirve de astil de lanza, cosa que el propio archivo
afirma dos fichas más arriba (`lanza_colihue`: "liviano, recto y **duro**").
El juego se contradice a sí mismo en dos fichas del mismo dataset.

**Reescritura sugerida:**
> "El colihue es la caña que la cordillera regala hecha: derecha, maciza y elástica. A
> diferencia de casi todos los bambúes no es hueca, y por eso la misma vara sirve de astil de
> lanza y de caña de pescar. Alcanza más lejos que la línea de mano y llega a los pozones donde
> está lo grande."

**Fuente:** SIB — *Chusquea culeou*, https://sib.gob.ar/especies/chusquea-culeou · `src/data/flora.json` id `cana_colihue`

---

### A2. GRAVE · "Acá no hay lúpulo" — contradice `historia.json` y es falso
**Dónde:** `recursosNuevos[hidromiel].nota` y `objetos[hidromiel_receta].nota`
> "no pide cebada ni lúpulo, que es justamente lo que la cervecería del árbol pide y **en esta comarca no existe**"
> "Destraba lo que la cervecería artesanal del árbol pide y no puede tener: **acá no hay cebada ni lúpulo**"

`historia.json`, tecnología `cerveceria_artesanal`, dice: "**El lúpulo del valle de El Bolsón
abastece a buena parte del país**". Es correcto: la Comarca Andina (El Bolsón, El Hoyo, Lago
Puelo, Epuyén) concentra **más del 70 % de la producción nacional de lúpulo**, con cultivo
comercial desde los años 60-70 y primeras plantas en 1905. El Bolsón tiene Fiesta Nacional del
Lúpulo. Está a ~120 km de Bariloche, en la misma provincia.

La cebada sí es defendible como ausente del valle. El lúpulo no.

**Reescritura sugerida (ambas notas):**
> "Miel, agua y tiempo. No pide malta ni fermentador: es la vía a una bebida fermentada mil
> años antes de que existiera una cervecería. El lúpulo de la cervecería del árbol sí existe en
> la comarca —El Bolsón produce la mayor parte del del país— pero es cultivo de valle y de
> chacra, no algo que se junte del bosque."

**Fuentes:** Diario Río Negro, "El Bolsón: por qué es la capital del lúpulo", https://www.rionegro.com.ar/gastronomia/el-bolson-por-que-es-la-capital-del-lupulo-y-el-corazon-de-la-cerveza-argentina/ · Municipalidad de El Bolsón, Fiesta Nacional del Lúpulo, https://elbolson.gob.ar/index.php/centenario/fiesta-nacional-lupulo · `src/data/historia.json` id `cerveceria_artesanal`

---

### A3. GRAVE · La cuña de asta no se hincha
**Dónde:** `objetos[maza_cuna].nota` y `tecnologiasNuevas[canteria_litica].descripcion`
> "**La cuña de asta hincha al mojarse** y hace parte del trabajo sin que nadie la golpee."
> "La cuña de asta o de madera seca se mete en la diaclasa y se moja: al hincharse abre la piedra sin un solo golpe fuerte, **que es como se cortaron los bloques de medio mundo antes del acero**."

Dos errores encadenados:

1. El asta (queratina/hueso) **no aumenta de volumen de forma útil al mojarse**. La técnica
   documentada es con **cuña de madera seca**, que absorbe agua y se dilata. El asta en cantería
   y minería antigua se usó como **pico y palanca**, no como cuña expansiva — que es exactamente
   lo que el propio archivo dice bien dos fichas después, en `pico_asta`.
2. "Como se cortaron los bloques de medio mundo antes del acero" está exagerado: la cuña húmeda
   está documentada para **cantería romana**, y su uso en el Egipto faraónico es **discutido en
   la literatura** (varios autores sostienen que las marcas corresponden a cuñas metálicas
   percutidas). El grueso de la cantería antigua se hizo con cuña metálica, pico y cincel.

**Reescritura sugerida (`maza_cuna`):**
> "La roca no se rompe a golpes: se le buscan las diaclasas, se meten cuñas y se las golpea por
> turno hasta que se abre por donde ya quería abrirse. La cuña de madera seca, embutida y
> mojada, se dilata y trabaja sola durante la noche; el asta va de palanca para desprender el
> bloque una vez fisurado, que es lo suyo."

**Reescritura sugerida (`canteria_litica.descripcion`):**
> "Leer la roca antes de golpearla. La cuña de madera seca se mete en la diaclasa y se moja: al
> hincharse abre la piedra sin un solo golpe fuerte. La cantería romana la usó documentadamente;
> para otras canteras antiguas la técnica se discute, y la mayor parte del trabajo lo hicieron
> el pico y la cuña metálica."

**Fuentes:** Región de Murcia Digital, canteras romanas (cunei de madera empapados), https://www.regmurcia.com/servlet/s.Sl?sit=c,373,m,3492&r=ReP-14379-DETALLE_REPORTAJESABUELO · Amigos de la Egiptología, materiales de construcción (discusión sobre cuñas húmedas), https://egiptologia.com/materiales-de-construccion-en-el-antiguo-egipto/2/

---

### A4. GRAVE · "Resina de coihue" — el coihue no da resina, y contradice `flora.json`
**Dónde:** `objetos[antorcha].nota`
> "**Resina de coihue** sobre un envoltorio de fibra."

*Nothofagus dombeyi* es una fagácea austral, no una conífera: no produce resina aprovechable.
En `flora.json` el coihue tiene `recursoJuego: "madera_dura"`, y los **únicos dos productores de
`resina`** de todo el dataset son **laura** (*Schinus patagonicus*, cuya ficha dice "su resina
aromática se masticó") y **palo piche** (*Fabiana imbricata*). La ficha de la laura es además la
que sostiene el `pellet_resina` de `mineria.json`.

**Reescritura sugerida:**
> "Resina de laura o de palo piche sobre un envoltorio de fibra. Dura una hora y media del mundo
> y se apaga con lluvia fuerte."

**Fuente:** `src/data/flora.json`, ids `laura`, `palo_piche`, `coihue`

---

### A5. GRAVE · La ñocha no vive de este lado de la cordillera
**Dónde:** `recursosNuevos[cordel].nota`
> "**Fibra de ñocha** o de coirón torcida a dos cabos."

La *ñocha* es **Greigia landbeckii** (bromeliácea), **endémica de Chile**; su pariente el chupón
(*G. sphacelata*) también es endémico chileno, de Maule a Los Lagos. **No hay registros del
género en Río Negro ni Neuquén**, y **ninguna de las 63 especies de `flora.json` es ñocha**.

Es exactamente el caso que el proyecto ya resolvió bien tres veces: especie pedida que no habita
la región. Acá se coló, y además viene heredada: `historia.json` (`cesteria_junco`) también dice
"fibras de ñocha". **Corregir en los dos archivos.**

Nota: la salida elegante existe y es la que el propio juego ya usa con la obsidiana — declararla
como material de intercambio transcordillerano.

**Reescritura sugerida:**
> "Fibra de junquillo o de coirón torcida a dos cabos. Es el insumo invisible de toda la
> tecnología lítica: sin algo que ate, la piedra y el palo son dos cosas separadas."

**Reescritura alternativa (si se quiere conservar la ñocha):**
> "…La ñocha, la fibra de cestería más buscada del sur, es chilena y no crece de este lado: como
> la obsidiana, cruzaba la cordillera por intercambio. Acá se tuerce lo que hay."

**Fuentes:** Fundación R.A. Philippi — *Greigia landbeckii*, https://fundacionphilippi.cl/catalogo/greigia-landbeckii/ · Wikipedia — *Greigia sphacelata* (endémica de Chile), https://en.wikipedia.org/wiki/Greigia_sphacelata · `src/data/flora.json` (63 especies, sin ñocha)

---

### A6. GRAVE · La liebre en Río Negro **sí** tiene temporada y cupo — el juego lo dice mal tres veces
**Dónde:** `objetos[trampa_lazo].jurisdiccion`, `acciones[caza_menor].nota`, y también
`caza.json` (`liebre_europea`) y `README.md` línea 114.
> "Sobre liebre europea fuera del área protegida **no hay temporada ni cupo**, y ahí la trampa es legal"

La **Resolución 7/DFS-2026** de la Dirección de Fauna Silvestre de Río Negro —**la misma que
`caza.json` cita por nombre**— fija para la **liebre europea temporada del 1 de mayo al 31 de
julio y cupo de 10 piezas por cazador**. Lo que sí está habilitado todo el año y sin cupo es el
**conejo silvestre, la codorniz de California y el visón**. Además exige licencia con formulario
C-01-SFS, autorización del propietario, certificado policial y **documentación de armas
vigente**.

Dos consecuencias:
1. La afirmación es falsa en `herramientas.json`, en `caza.json` y en el `README`. El proyecto la
   repite tres veces.
2. La trampa **no** es "exactamente la especie para la que sirve": el régimen provincial se
   estructura sobre arma de fuego con documentación, no sobre trampeo.

**Reescritura sugerida (`trampa_lazo.jurisdiccion`):**
> "El trampeo de fauna nativa está prohibido en todo el Parque sin excepción, y el Reglamento
> Único de caza (RD 277/2011, art. 50) prohíbe expresamente trampas y lazos incluso sobre las
> exóticas habilitadas. Fuera del área protegida la liebre europea tiene temporada (1 de mayo a
> 31 de julio) y cupo (10 piezas), y la resolución provincial se escribe sobre arma de fuego con
> licencia: la trampa queda afuera igual. Este objeto existe para que el jugador vea por qué un
> método que no elige a quién agarra no entra en ningún reglamento."

**Fuentes:** AICACYP — Temporada de Caza 2026 Río Negro (Res. 7/DFS-2026), https://www.aicacyp.ar/blog/temporada-de-caza-2026-rio-negro/ · Diario Río Negro, https://www.rionegro.com.ar/sociedad/caza-en-rio-negro-que-animales-estan-habilitados-cuantos-se-pueden-capturar-y-que-requisitos-hay/

---

### A7. GRAVE · Red y nasa no están "reguladas": están prohibidas
**Dónde:** `objetos[red_fibra].nota`, `objetos[nasa_junco].nota`, `acciones[trampear_pez].nota`
> "Rinde mucho más que la caña y **por eso está regulada hasta la muerte**"
> nasa y `trampear_pez`: **ninguna nota legal**

El **Reglamento General de Pesca Deportiva Continental Patagónico** (Neuquén, Río Negro, Chubut,
Santa Cruz y Parques Nacionales del sur) **prohíbe pescar con redes, trampas, nasas, fijas,
arpones, garfios o armas de cualquier tipo**, más la pesca submarina y el uso de cebo. No hay
ambiente donde estén reguladas: están prohibidas en toda la jurisdicción, dentro y fuera del
parque.

Y `caza.json` ya lo dice bien: modalidad `red` → `"permitida": false`, "Prohibida para la pesca
deportiva: no selecciona especie ni talla". El juego se contradice.

**Reescritura sugerida (`red_fibra`):**
> "Malla anudada con lastre de piedra abajo. Rinde más que cualquier otra cosa del árbol y por
> eso está lisa y llanamente prohibida: el Reglamento de Pesca Continental Patagónico no admite
> red, nasa, fija ni arpón en ningún ambiente. Se puede fabricar y se puede saber cómo se hacía;
> usarla es infracción en las tres jurisdicciones, y ésa es la ficha."

**Reescritura sugerida (`nasa_junco`, agregar `notaLegal`):**
> "La nasa entra en la misma prohibición que la red y el arpón: el reglamento patagónico no
> admite trampas para peces. Es tecnología histórica real y hoy es un delito de pesca."

**Fuente:** Reglamento General de Pesca Deportiva Continental Patagónico, https://reglamentodepesca.org.ar/reglamento/ · texto oficial: https://www.argentina.gob.ar/sites/default/files/parte_primera_reglamento_general_de_pesca_deportiva_continental_patagonico.pdf

---

### A8. La fija no está prohibida "en casi todos los ambientes": está prohibida
**Dónde:** `objetos[arpon_hueso].notaLegal` y `acciones[fijar].nota`
> "La fija está prohibida **en casi todos los ambientes del parque**"

Misma fuente que A7: la prohibición de fija y arpón es **general** para toda la pesca deportiva
continental patagónica, sin excepción por ambiente. El "casi" atenúa una prohibición absoluta y,
en un juego que enseña marco legal, enseña mal.

**Reescritura sugerida:**
> "La fija y el arpón están prohibidos en toda la pesca deportiva patagónica, dentro y fuera del
> parque, justamente porque no permiten devolver vivo lo que se saca ni elegir la medida."

---

### A9. GRAVE · Sumar la boleadora "a las armas que Caza.js acepta"
**Dónde:** `efectosAAgregar[boleadora].nota`
> "Y hay que sumarla a las armas que Caza.js acepta: hoy el arco es la única."

El **Reglamento Único de Caza de Ciervo Colorado y Jabalí Europeo (RD APN 277/2011)** —la única
caza habilitada dentro del Nahuel Huapi— **art. 44** autoriza **exclusivamente arma larga de caño
rayado**, de repetición manual o disparo simple, **calibre mínimo 6,5 mm**, vaina ≥51 mm y
proyectil ≥9 g semiblindado. El **art. 50** prohíbe expresamente armas cortas, **trampas, lazos y
venenos**, perros, caza nocturna y disparo desde vehículo.

O sea: **ni boleadora, ni estólica, ni lanza, ni honda, ni garrote, ni trampa de lazo — ni el
arco** son método legal dentro del parque. Hacer que `Caza.js` "acepte" la boleadora convierte al
juego en algo que enseña lo contrario de la norma que cita.

Efecto colateral: **`caza.json` también está mal** — lista `"arco"` en `metodosPermitidos` de
`ciervo_colorado` y `jabali_europeo`, y el reglamento no lo admite.

**Reescritura sugerida (`efectosAAgregar[boleadora].nota`):**
> "Habilita fabricar y practicar. NO habilita cazar legalmente: el Reglamento Único (RD APN
> 277/2011, art. 44) sólo admite arma larga de caño rayado de 6,5 mm o más para el ciervo y el
> jabalí, y el art. 50 prohíbe trampas y lazos. La boleadora, la estólica y el arco son el arma
> real de esta cordillera y hoy no son un método autorizado en ningún lado del mapa. Caza.js
> tiene que poder decir «sabés hacerla, sabés usarla, y acá no se puede», que es la lección."

**Y una corrección pendiente en `caza.json`:** sacar `"arco"` de `metodosPermitidos` de ciervo y
jabalí, o declarar por qué figura.

**Fuente:** Reglamento Único de Caza, PN Nahuel Huapi, arts. 44 y 50, https://www.nahuelhuapi.gov.ar/normativas/manejo/Reglamento%20Cazar%202011.doc · Res. 277/2011, https://www.argentina.gob.ar/normativa/nacional/norma-190582/texto

---

### A10. "El caído es legal en las tres jurisdicciones" — dentro del Parque, no
**Dónde:** `acciones[trozar].nota`, `jurisdiccion: "todas"`
> "El caído es legal en las tres jurisdicciones: está muerto y en el suelo."

El art. 5 de la Ley 22.351 prohíbe en Parques Nacionales "toda explotación económica" y
"toda acción que pueda modificar el aspecto o el equilibrio", y `mineria.json` lo cita así:
"prohíbe … la tala **y todo aprovechamiento de los recursos naturales**". El aprovechamiento
forestal, **incluida la leña de árboles muertos**, puede autorizarse dentro de áreas de Parque
Nacional **sólo a pobladores autorizados, para consumo propio y con autorización de APN**. Un
visitante que corta un caído en rollizos está haciendo aprovechamiento forestal sin permiso.

Además la madera muerta en pie y caída es hábitat (el propio `caza.json` lo dice del huillín:
"costas con vegetación densa y troncos caídos").

**Reescritura sugerida:**
> "…El caído no es tierra de nadie: fuera del área protegida es legal, en Reserva se autoriza, y
> dentro del Parque el aprovechamiento forestal —leña de árbol muerto incluida— sólo se autoriza
> a pobladores con permiso y para consumo propio. Un tronco caído además es casa: ahí vive el
> huillín, el hongo y media docena de bichos que este juego ya tiene en fauna.json."

**Fuentes:** Ley 22.351 art. 5, https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16299/texact.htm · Normativas PN Nahuel Huapi, https://nahuelhuapi.gov.ar/normativas-2/

---

### A11. GRAVE · La Reserva Nacional desaparece de las tres acciones jurisdiccionadas
**Dónde:** `acciones[talar].jurisdiccion = "fuera"`, `acciones[cantera].jurisdiccion = "fuera"`,
`acciones[extraer_arido].jurisdiccion = "fuera"`

La **Ley 22.351 art. 10** dice que en Reservas Nacionales, con reglamentación y **autorización de
la autoridad de aplicación**, pueden realizarse "explotaciones agropecuarias y **de canteras**",
y que APN puede autorizar el **aprovechamiento de la riqueza forestal**. Queda prohibida
cualquier **otra** explotación minera.

Esto lo dicen ya, correctamente, **tres archivos del propio proyecto**:
- `mineria.json`: "en las Reservas Nacionales … la APN puede autorizar la explotación de canteras"
- `README.md`: "en la Reserva Nacional puede autorizarse una cantera"
- la **`tesis` de este mismo archivo**: "en la Reserva algunas cosas se autorizan"

Y sin embargo las tres acciones marcan `"fuera"` a secas. El juego se afirma a sí mismo dos veces
distinto, dentro del mismo archivo.

**Reescritura sugerida (patrón para las tres):**
> `"jurisdiccion": "fuera|reserva_con_permiso"`
> `talar.nota`: "El artículo 5 de la Ley 22.351 prohíbe dentro del Parque toda explotación
> forestal. En Reserva Nacional el artículo 10 permite que la APN autorice el aprovechamiento
> forestal, con permiso escrito. Fuera del área protegida rige el dominio provincial. Tener el
> hacha no habilita: habilita el hacha, más el lugar, más el papel."
> `cantera.nota`: "Ya implementado en Mineria.js con su jurisdicción y su castigo, y con los tres
> niveles que corresponden: prohibido en Parque, autorizable en Reserva, regulado afuera."

**Fuente:** Ley 22.351 art. 10, https://www.argentina.gob.ar/normativa/nacional/ley-22351-16299/texto

---

### A12. `flora.json` no tiene floración mensual
**Dónde:** `notaEcologicaApicultura.gancho`
> "Michay, maitén, notro y radal son melíferas nativas y ya están en flora.json **con su floración mensual**"

`flora.json` guarda `floracion` como **estaciones** (`["primavera"]`, `["primavera","verano"]`),
no como meses. El gancho propone una mecánica sobre un dato que el dataset no tiene.

Sub-observación: **el notro es ornitófilo** — la propia ficha de `flora.json` dice "polinizadas
por el picaflor rubí". Como melífera es flojo. Michay, maitén y radal sí (el radal, por la propia
ficha: "flores blanco-cremosas muy visitadas por insectos").

**Reescritura sugerida:**
> "Michay, maitén y radal son melíferas nativas y ya están en flora.json con su estación de
> floración: el rinde de la colmena puede salir de qué hay florecido cerca y en qué estación, en
> vez de ser un número fijo. Si se quiere resolución mensual hay que agregarle el campo a
> flora.json primero. El notro queda afuera de la lista: lo poliniza el picaflor, no la abeja."

---

## B. IMPRECISO — hay que matizarlo

| # | Dónde | Qué dice | Qué corresponde |
|---|---|---|---|
| B1 | `recursosNuevos[miel]` | "No se pudre **nunca**: se encontró miel comestible en tumbas de tres mil años" | La miel **sellada y con menos de ~18 % de humedad** no se echa a perder; abierta o húmeda fermenta. Lo de las tumbas egipcias es anécdota repetidísima sin publicación arqueológica que acredite la comestibilidad. → "No se echa a perder mientras esté sellada y seca" + declarar la anécdota como anécdota. |
| B2 | `recursosNuevos[cera]` | "**Diez** kilos de miel … dan uno de cera" | El rango aceptado es **6 a 8 kg de miel por kg de cera** (FAO cita ~8:1); hay estimaciones de 3,5 y de 5. Diez está fuera del rango habitual. → "Entre seis y ocho kilos de miel consumidos por la colmena dan uno de cera". Fuente: FAO, *Production and trade of beeswax*, https://www.fao.org/4/i0842e/i0842e12.pdf |
| B3 | `recursosNuevos[propoleo]` | "Es **antibiótico real**", `cura: 14` (3,5× la miel) | El propóleo tiene actividad antimicrobiana **in vitro** demostrada; no es un antibiótico en sentido clínico ni tiene eficacia sistémica acreditada. En un juego educativo es una afirmación sanitaria. → "Tiene actividad antimicrobiana demostrada en laboratorio y un uso popular largo; no es un antibiótico ni reemplaza uno". Y bajar `cura` por debajo de la miel. |
| B4 | `recursosNuevos[hidromiel]` | "la bebida fermentada **más vieja que se conoce**" | La bebida fermentada más antigua **químicamente atestiguada** es la mezcla de Jiahu (arroz, miel y fruta, ~7000 a.C.). Que el hidromiel puro sea el primero es hipótesis frecuente, no dato. → "una de las bebidas fermentadas más viejas que se conocen; la miel aparece en el residuo fermentado más antiguo que se analizó". |
| B5 | `objetos[ahumador]` | "El humo no aturde: hace que la colmena crea que hay incendio y se llene el buche" | Falta **el mecanismo mejor sostenido**: el humo **enmascara la feromona de alarma** (acetato de isopentilo) ocupando los receptores antenales. Y "una abeja cargada no dobla el abdomen" es explicación tradicional discutida entre apicultores e investigadores. → agregar el enmascaramiento como mecanismo principal y presentar el atracón como el segundo, con su matiz. Fuente: Entomology Today, https://entomologytoday.org/2018/09/10/why-smoking-soothes-the-stressed-out-bee-hive/ |
| B6 | `objetos[bola_perdida]` | "Es **la más vieja de las tres**" | Las bolas líticas con surco ecuatorial son antiquísimas en Patagonia (Los Toldos, Holoceno temprano), pero hay literatura que sitúa a la **bola perdida como forma posterior a la llegada del caballo**, ligada a Pampa y norte de Patagonia. La antigüedad relativa de las tres variantes no está resuelta. → agregar `certeza: "forma antigua en el registro lítico; su orden relativo respecto de la ñanducera y la potreadora no está resuelto"`. |
| B7 | `recursosNuevos[punta]` | "Las del Nahuel Huapi son **casi todas** de obsidiana traída de lejos" | La obsidiana es abundante y bien estudiada por procedencia geoquímica en la región, pero los conjuntos incluyen materias primas locales (basaltos, sílices, dacitas). "Casi todas" es un cuantificador sin respaldo. → "Buena parte de las del Nahuel Huapi son de obsidiana traída de lejos, y por eso una punta perdida se buscaba." |
| B8 | `objetos[estolica]` | "Es anterior al arco **en toda América**"; `certeza: "documentado en Patagonia temprana"` | En América el propulsor está bien documentado en Mesoamérica, Colombia y Perú. En **Patagonia no hay estólicas conservadas**: su uso se **infiere** de la métrica de las puntas cola de pescado y de experimentos de lanzamiento. → `certeza: "inferida en Patagonia temprana a partir del tamaño de las puntas cola de pescado y de experimentos de lanzamiento; no hay estólicas conservadas en la región"`, y cambiar "en toda América" por "en buena parte de América". |
| B9 | `objetos[tamangos]` | `resistenciaMojadura: 0.35`; "los pies mojados son **la primera causa** de hipotermia" | El tamango de cuero crudo aísla de la nieve y del pedregal, pero **se empapa**: darle resistencia a la mojadura es al revés de lo que era. Y "primera causa de hipotermia" es un superlativo médico sin respaldo (pesan más la ropa mojada de torso, el viento y la inmersión). → bajar `resistenciaMojadura` a ~0,1 o cambiarlo por `aislamientoDelSuelo`, y reescribir: "Poco abrigo y mucha diferencia: aísla del pedregal y de la nieve, aunque se moja como todo el cuero crudo." |
| B10 | `objetos[lasca].notaGeografica` | Declara bien que no hay obsidiana local, pero luego naturaliza la mecánica | Está bien declarado, pero conviene decir que es **licencia de juego**, no geología. (Y ojo con `Recoleccion.js`, que la racionaliza mal: "la obsidiana es vidrio volcánico y aparece en altura" — la obsidiana aparece en **fuentes volcánicas concretas**, no con la cota.) → "…En el juego aparece levantando piedra por encima de los 1500 m. **Eso es una licencia**: en la realidad no hay fuente local y la obsidiana llegaba por intercambio. El cerro está para que el nivel 1 se pague con algo." |
| B11 | `objetos[raspador]` | "la herramienta **más abundante de cualquier** sitio arqueológico de la estepa" | Los raspadores son efectivamente muy frecuentes en conjuntos patagónicos, pero "de cualquier sitio" es absoluto. → "una de las herramientas más frecuentes de los sitios de la estepa". |
| B12 | `notaEcologicaApicultura.comoLoJuegaElJuego` | "Dentro del área núcleo … no va; **en Reserva y fuera, sí**" | En Reserva Nacional las actividades productivas van **bajo autorización de APN** (art. 10). `mineria.json` y `construccion.json` remarcan justamente eso ("autorizarse no es lo mismo que estar autorizado"). → "en Reserva, con autorización de Parques Nacionales; fuera, con el régimen provincial". |
| B13 | `objetos[hacha_hierro]` | "Rinde el doble … y dura tres veces más" | Números de balance presentados como dato histórico. → declararlos como valores de juego, o quitarlos de la nota. |
| B14 | `objetos[eslabon]` | "Golpear **acero** contra sílex", pero la receta consume `hierro` | Correcto en la física (hace falta **alto carbono**: el hierro dulce no chispea) e **incoherente con la receta**. `mineria.json` ya tiene receta de `acero` por cementación. Además el **pedernal/sílex no figura en `mineria.json`** ni como material regional. → cambiar el material a `acero`, y declarar de dónde sale el pedernal o cambiar el nombre del objeto. |
| B15 | `objetos[quillango]`, `[tamangos]`, `notaDeContenido` | Se los presenta como "cultura material real de **la cordillera norpatagónica**" | El quillango y el tamango son característicamente **tehuelche (Aonikenk / Günün a küna) y selk'nam**, de la estepa y del sur, y llegan a la cordillera por contacto e intercambio. Y el quillango se hacía con **13 a 18 cueros de chulengo de guanaco** — hoy fauna nativa, intocable dentro del parque, dato que el archivo no aprovecha teniendo el guanaco en `fauna.json`. → atribuir bien y agregar el gancho: "se hacía con trece a dieciocho cueros de chulengo de guanaco; hoy el guanaco es fauna nativa dentro del parque y esa prenda no se puede volver a hacer con lo mismo". Fuente: La Voz de Chubut / Scielo Argentina, *La vestimenta como diacrítico identitario*, https://www.scielo.org.ar/scielo.php?script=sci_arttext&pid=S1669-57042018000200003 |

---

## C. NO VERIFICABLE — hay que declararlo (es lo que el proyecto hace)

Ninguna de éstas es falsa. Son afirmaciones que **no se pudieron verificar** y que hoy están
escritas como si fueran hechos. El estándar del proyecto pide `certeza`.

| # | Dónde | Afirmación | `certeza` sugerido |
|---|---|---|---|
| C1 | `tecnologiasNuevas[apicultura_rustica]` | "la comarca la usó **hasta bien entrado el siglo XX**" | `"la colmena de tronco está documentada en Europa y en la colonización rioplatense; su uso concreto en la comarca andina no se pudo verificar"` |
| C2 | `objetos[brea_resina]` | Receta resina + carbón + grasa como adhesivo de enmangue | `"genérico: la brea de resina con carga mineral y grasa está documentada en la arqueología mundial; no se verificó evidencia regional de adhesivos de enmangue en el Nahuel Huapi"` |
| C3 | `objetos[pico_asta]` | "las minas de sílex del neolítico europeo se excavaron enteras con esto" | Verdadero (Grimes Graves, Spiennes) **pero es europeo**. → `"genérico y europeo: no hay minería prehistórica documentada en la comarca; acá el pico de asta es extrapolación técnica, no registro local"` |
| C4 | `recursosNuevos[anzuelo]` / `objetos[anzuelo_hueso]` | "De **espina de calafate** o de astilla de hueso" | El gorjal está bien documentado a escala mundial. La espina de calafate como anzuelo no se verificó, y las espinas trífidas de *Berberis microphylla* son cortas para el uso. → `"el gorjal está documentado globalmente; el anzuelo de espina de calafate no se pudo verificar"` |
| C5 | `objetos[lanza_colihue]` | "las de caballería mapuche … llegaban a los **cuatro metros**" | Cifra sin fuente citada. → declararla como aproximada o quitar el número. |
| C6 | `objetos[hacha_piedra]` | "se tardaban días en hacer una y **por eso se heredaban**" | La inversión de trabajo es real; "se heredaban" es interpretación. → `certeza: "genérico"` |
| C7 | `objetos[arco_colihue_obj].notaCuerda` | "se llevaba una de repuesto seca **bajo la ropa**" | Detalle etnográfico sin fuente. Plausible, no verificado. |
| C8 | `objetos[bola_forrada]` | "El surco impide que el tiento se corra" | Interpretación funcional razonable del surco ecuatorial, no dato. |
| C9 | **Sistémico** | 54 de 57 objetos sin `certeza` | Faltan al menos en: `raspador`, `punzon_hueso`, `azuela`, `pala_omoplato`, `maza_cuna`, `pico_asta`, `brea_resina`, `taladro_arco`, `candil_grasa`, `red_fibra`, `nasa_junco`, `odre_cuero`, `rastra`, `mochila_cuero`, `curtido`, `ahumador`, `careta_velo`. Todos son genéricos de la tecnología preindustrial, no específicos de la cordillera norpatagónica. |

---

## D. Cadenas rotas — el defecto que el archivo denuncia y comete

El archivo abre con la crítica correcta a `curtido_cuero` ("no producía absolutamente nada") y
cierra con `pendienteSinSistema` declarando cuatro huecos (luz, trampas, plumas, recuperar
flechas). Faltan cuatro más, del mismo tipo:

1. **`lana` no tiene fuente en todo el juego.** `poncho_witral` pide 8 y `moscas` pide 1.
   `Recursos.js` la declara (`lana: 0.15 kg`), pero **ninguna especie de `fauna.json` (61) ni de
   `flora.json` (63) la entrega**, y no hay oveja en el dataset. `historia.json` (`telar_witral`)
   también pide 6 de lana. Es exactamente el caso `curtido_cuero`, sin declarar. → agregarlo a
   `pendienteSinSistema`, o resolverlo (oveja de puesto, o hilado de guanaco con la vuelta legal
   que corresponde).
2. **`junco` no lo entrega ninguna planta.** Junquillo (*Marsippospermum grandiflorum*) y junco de
   mallín (*Juncus balticus*) tienen `recursoJuego: "fibra"`. El pedido de `junco` se satisface
   sólo por la equivalencia `cana → junco` de `Recursos.js`, así que la "nasa de junco" y el
   "canasto de junco" se tejen, de hecho, con colihue. → o se le cambia el `recursoJuego` a los
   dos juncos, o se les cambia el nombre a los objetos.
3. **`asta` sólo viene del desmogue**, y `caza.json` avisa que "dentro del parque, la recolección
   de material biológico puede requerir autorización". `maza_cuna` y `pico_asta` (nivel 3, la
   compuerta de la cantería) no lo mencionan. → heredar esa advertencia.
4. **Coherencia de nivel:** `hidromiel_receta` está en `nivel: 2` pero cuelga de
   `apicultura_cuadros`, que es `era: parque_nacional`, requiere `aserradero_hidraulico` y pide
   tabla y clavo (nivel 4). Un objeto de nivel 2 detrás de una compuerta de nivel 4.

---

## E. Lo que se sostiene (y bien)

Para que el informe no se lea como una demolición: buena parte del archivo aguanta la
verificación, y un bloque la aguanta con nota alta.

- **`notaEcologicaApicultura` — lo mejor del archivo.** Verificada punto por punto:
  *Apis mellifera* no es americana; *Bombus dahlbomii* es **el abejorro más grande del mundo** y
  está **En Peligro**; *Bombus terrestris* fue **introducido en Chile en 1997 para polinizar
  invernaderos**, escapó, se estableció y **cruzó a la Patagonia argentina**; trajo consigo
  *Apicystis bombi* y *Crithidia bombi* —**detectados a 3 km al oeste de San Carlos de
  Bariloche**—, y el declive de *dahlbomii* se atribuye a esa combinación de competencia y
  contagio. Todo correcto. Fuentes: Scielo Chile, https://scielo.conicyt.cl/scielo.php?script=sci_arttext&pid=S0718-686X2013000100015 · NCBI, *Genetic Variability of Apicystis bombi*, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3855659/ · MMA Chile, ficha de clasificación de *B. dahlbomii*, https://clasificacionespecies.mma.gob.cl/wp-content/uploads/2019/10/Bombus_dahlbomii_12RCE_FIN.pdf
  **Dos cosas para completarla:** (a) **ninguna de las tres especies está en `fauna.json`** (61
  especies con estado UICN); si el juego apoya una nota entera en *B. dahlbomii*, la especie
  debería tener ficha con su UICN **EN**. (b) `fauna.json` ya tiene a **Vespula germanica** y su
  ficha dice literalmente que "**afecta la apicultura**": es el enganche perfecto y la nota no lo
  usa.
- **Quillango y tamango**: correctos y bien descritos — manto de cueros cosidos, pelo hacia
  adentro, pintado del lado de la piel; calzado de cuero atado al pie y la pierna.
- **Tipología de boleadoras**: correcta. Bola perdida (una), **ñanducera/avestrucera** (dos, para
  el choique), **potreadora / Tres Marías** (tres, para presa grande y caballo). Coincide con
  `historia.json`.
- **Colihue como astil de lanza y de flecha**: coincide con `flora.json` ("astas de lanza,
  cestería y la trutruca") y con SIB.
- **Obsidiana alóctona**: coincide exactamente con `mineria.json` e `historia.json`.
- **Nivel 4 = chatarra, no mineral**: coherente con `mineria.json` de punta a punta. Es el mejor
  enganche del archivo.
- **Pico de asta en minas neolíticas**, **retoque a presión con punzón de asta**, **gorjal antes
  del anzuelo curvo**, **cera de iglesia**, **witral = telar vertical mapuche**, **3500 mm en la
  ladera oeste** (coincide con `geografia.json`: Puerto Blest 4000, Paso Puyehue 3500): todo
  correcto.
- **Pesca con mosca como tecnología de parque**, con `devolucionSegura` y `selectivo`: coincide
  con `caza.json` ("la modalidad de menor impacto"). Bien.

---

## F. Orden de trabajo sugerido

1. **A9, A6, A7, A8, A11, A10** — el bloque legal. Es lo que el juego enseña y hoy enseña mal, y
   dos de esos errores viven además en `caza.json` y en el `README`.
2. **A1, A2, A4, A5, A3, A12** — los seis hechos falsos, cada uno con su reescritura arriba.
3. **B1–B15** — matices, en un solo pase.
4. **C1–C9** — poblar `certeza`. Es barato y es la firma del proyecto.
5. **D1–D4** — declarar las cadenas rotas en `pendienteSinSistema` antes de que el código las
   herede.
6. **Fuera de este archivo, pero abierto por él:** `caza.json` (liebre sin temporada; `arco` como
   método permitido), `historia.json` (ñocha; `cerveceria_artesanal` vs. hidromiel), `README.md`
   línea 114 (liebre), `Recoleccion.js` línea ~429 (la obsidiana no "aparece en altura").
