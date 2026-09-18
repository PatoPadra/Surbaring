# Bitácora de `empuñadura` — ronda 7, fase 2b

Rama `mejoras/ronda7-lo-que-vio`. Escribo sólo `src/entities/Herramientas3D.js` y
`src/entities/Cuerpo.js`. Lo de `main.js` va a `pendiente-r7-empunadura.md`.

## 0 · Lo leído antes de tocar nada (12/9/2026)

- RONDA7 «FASE 2b» (E1–E9) y B5 en «FASE 2 CERRADA»; RONDA5 «FASE 3 · mano» y
  su cierre; cabecera de `Herramientas3D.js`; punto 3 de `pendiente-r7-brasa.md`.
- `main.js:755` ya tiene `enRanura('mano')?.id ?? enRanura('arma')?.id ?? null` y
  `main.js:767` ya escribe `cuerpo.llamaEncendida = !!enMano`.
- El banco r5-fase3 cuenta tintas **sólo entre los 18 de mano** (≤ 9). El de r7
  cuenta materiales entre los treinta (≤ 12). Así que las tintas nuevas pueden ser
  de los doce sin tocar el tope de los dieciocho, pero entran en el de doce.
- Detalle del banco r7 que importa para E4: `suelo()` actualiza las matrices del
  cuerpo una sola vez con la mano vacía y después, por modelo, sólo
  `m.updateMatrixWorld(true)`. O sea que mide el modelo contra la matriz de la
  mano **de la pose sin carga**. Lo verifico con la cuenta antes de fiarme.
- E3 mide la caja de las geometrías en el espacio del grupo (las mallas no tienen
  transformación propia), ordenada de mayor a menor.

## 1 · La base, medida con mi script (`scratchpad/medir.mjs`, replica el banco)

- Banco contra la base: cableado VERDE; losDoce, siluetas, suelo y llamaApagada
  ROJO (0/12 modelos, sin `llamaEncendida`). Es lo esperado.
- Cajas de los 18 (m, de mayor a menor): barreta 1,060×0,032×0,028 es la más larga;
  pala_hierro 0,921×0,214×0,044; pala_omoplato 0,755×0,171×0,064; hacha_hierro
  0,620×0,173×0,044; antorcha 0,620×0,082×0,082; pico_hierro 0,684×0,323×0,081.
  Par más cercano de hoy: sierra~antorcha, 17 % de diferencia máxima.
- **La mano con la carga asentada** (60 cuadros parado): y = 0,943 m, adelantada
  0,218 m, afuera 0,128 m. Es la del juego.
- **Lo que mide `suelo()` del banco no es esa pose.** Actualiza las matrices del
  cuerpo una vez con la mano vacía (mano en y = 0,844, codo 0,28 rad) y después
  cada modelo sólo con `m.updateMatrixWorld(true)`: la matriz del padre queda
  vieja. Pero la rotación propia del modelo ya descuenta el codo **cargado**
  (`rx − codo − brazo`, con codo = 0,28·(1−k/2) + 0,78·k y k la carga suavizada,
  que en ese recorrido va de 0,93 a 0,99 para los doce del arma porque el cuerpo
  es el mismo y cada id suma un cuadro). Resultado: el banco ve el objeto 0,10 m
  más abajo que en el juego y girado ~0,61 rad más hacia adelante que la pose
  declarada. En la base se nota: pico_asta da 0,636 en el banco y 0,815 asentado.
  No es imposible de cumplir, sólo mide otra cosa: **cumplo las dos** y reporto las
  dos columnas. Para lo que cuelga, la del juego es la peor (la mano está más alta
  pero el colgado va derecho, sin la inclinación que lo levanta).

## 2 · Fuentes leídas (13/9, retomado después del corte por límite de uso)

En disco no había nada mío en `src/`: el corte cayó antes de escribir código. Lo
que sigue lo leí en la página misma (WebFetch) salvo donde digo «resumen de
búsqueda», que no verifiqué contra el texto.

- **Colihue.** SIB, Parques Nacionales (sib.gob.ar/especies/chusquea-culeou):
  «hasta 7 m de alto», «las cañas son sólidas». No da diámetro. `flora.json`
  (`cana_colihue`): 3 a 7 m, macizas. Diámetro en la base 2 a 3,5 cm: resumen de
  búsqueda (iNaturalist, redalyc), sin verificar.
- **Lanza.** El arcón de la historia argentina, «Armas y estrategias…»: la de
  caballería de pampas y araucanos «hasta 3,60 metros de largo»; **«la lanza corta
  que no era mayor de 1,70 metro de largo»** para el combate de a pie.
- **Boleadoras** (esgrimacriolla, «Las boleadoras, historia documentada», que cita
  a los cronistas):
  - bola perdida, Oviedo (1535): la bola «del tamaño de una de trucos», el tiento
    «largo como vara o poco más» (vara castellana = 0,836 m).
  - Darwin: bolas «del tamaño de una manzana»; tiento de **8 pies** (2,44 m) en la
    de dos bolas para avestruz.
  - Vidal (1820): cada bola «pesa una media libra» (≈ 0,23 kg).
  - D'Orbigny: tientos «más de un metro de largo».
  - El arcón: la de dos bolas unidas por un cordón de **alrededor de un metro**.
  - Wikipedia (Boleadoras): bolas de **unos 10 cm** en las de caza mayor.
- **Honda.** MNHN Chile, «La honda prehispánica»: las del norte «suelen medir
  aproximadamente dos metros de largo» (total, las dos ramas y la cuna). Resumen de
  búsqueda (EcuRed): «cordón de metro medio de largo aproximadamente».
- **Caña de mosca.** 9 pies = 2,74 m, línea 5 o 6 para Patagonia: pesca.news y
  solomosca (resumen de búsqueda; el 9 pies es el estándar de trucha y la
  conversión es exacta).
- **Garrote.** La macana mapuche mide «un metro y medio» (profesorenlinea.cl, resumen
  de búsqueda), pero es un arma de guerra de dos manos: con esa madera pesaría más
  del doble que los 1,2 kg de la ficha. El garrote de la ficha es otra cosa.
- Estólica, arco y arpón: sin medida todavía. El Tesauro Regional Patrimonial sólo
  dice «vara corta».
- **Arco** (verificado en la página): newenmapu, «Arcos y flechas»: «una vara o
  una rama de 1,20 ó 1,70 de largo». Museo de la Patagonia (PDF «El pueblo
  tehuelche», resumen de búsqueda): los arcos de caza tehuelches eran «chicos».
- **Carrete de mosca** (verificado): Wild Water, carrete para línea 5/6, «Overall
  Reel Diameter: 85 mm».
- **Densidad del colihue** (resumen de búsqueda, SciELO Maderas 2009 no resolvió
  DNS): densidad básica de 560 a 660 kg/m³ de la base a la punta del culmo.
- **Densidad del coihue** (resumen de búsqueda): 601 kg/m³ al 12 % de humedad.
- **Estólica** (resumen de búsqueda, sin verificar): «mango de madera de longitud
  variable entre 60 y 90 centímetros».
- Honda (verificado, es.wikipedia «Honda (arma)»): «una longitud de aproximadamente
  61 a 100 cm […] es típica». Estólica: es.wikipedia no da medida; la de 60 a 90 cm
  sigue sin verificar. Coihue: la página de la maderera dio 404, sigue sin verificar.
- **Lo que dice el propio juego** (`herramientas.json`, `recursosNuevos`): `bola`
  = «piedra redondeada con surco ecuatorial, forrada en cuero crudo», 0,5 kg;
  `punta` = punta lítica, casi todas de **obsidiana** en el Nahuel Huapi, 0,02 kg;
  `cordel` = fibra de junquillo o coirón torcida; `tiento` = cuero crudo;
  `anzuelo` = espina de calafate o astilla de hueso. Cámara de tercera persona a
  4,2 m (`Jugador.distanciaCamara`).

## 3 · Aviso del coordinador: `suelo()` corregido

`suelo()` ahora asienta 60 cuadros por objeto y actualiza el grupo entero antes de
medir: pico_asta 0,82, los 18 entre 0,82 y 0,94. **E4 es contra la pose del
juego**, la columna «asentado» de mi script. Dejo de perseguir la otra.

## 4 · Decisiones de diseño (antes de escribir código)

**Tintas: 9 → 11.** Dos nuevas, y una de reserva que no uso:
- `colihue` 0xc8b45e: el `colorTronco` de `cana_colihue` en `flora.json`, o sea el
  color con que el mundo ya pinta el cañaveral; rugosidad baja (la caña es lisa).
  Cinco de los doce son de colihue (lanza, arco, caña, arpón, mosca): con `madera`
  (0x6b4a2c) la lanza sería un palo pardo.
- `cordel`: fibra de coirón torcida, gris pajizo, más oscuro que el hueso y más claro
  que la madera. La honda es cordel y badana, y con `cuero` para las dos era una
  sola mancha oscura.
- **No agrego `cuero_crudo`**: bolas y ramales de tiento van con `cuero`, que es
  curtido y más oscuro de lo que es el cuero crudo. Es una inexactitud de color, y
  la dejo declarada a cambio de guardar la duodécima tinta.

**Cómo se lleva lo largo.** Con la mano asentada en y = 0,943, adelantada 0,218 y
afuera 0,128, la cuenta sale así:
- Una vara agarrada por el centro (lanza de 1,70 con 0,75 m bajo el puño) y
  llevada vertical tiene la regatón **dentro de la pantorrilla** (x 0,128 contra
  una pantorrilla en x 0,093 ± 0,06). Inclinada, cruza el plano del cuerpo a la
  altura del muslo, y el muslo ocupa x 0,093 ± 0,09. Si se abre para que no lo
  toque, en primera persona la punta queda en el medio de la pantalla. **Así que las
  cuatro varas se agarran cerca del regatón** (0,15 a 0,30 m) y se llevan casi
  paradas (familia `vara`, rx −0,35): la parte bajo el puño queda delante del muslo,
  y la punta sale por arriba del cuadro en primera persona.
- Lo que cuelga (familia `colgando`, rx −3,0 ≈ π con 0,14 rad hacia adelante): el
  brazo cargado lleva `rotation.z` −0,14, y eso mete lo colgado hacia la pierna.
  Con rz −0,24 en el modelo queda ~0,1 rad hacia afuera.
- El arco (familia `arco`): vertical (rz +0,14 compensa el −0,14 del brazo), casi sin
  inclinación: agarrado por el medio, una inclinación de 0,35 le metería la pala de
  abajo en la canilla.
- Garrote y estólica van con `cabo`; la línea de mano, con `cuenco`.

## 5 · Código escrito y primera corrida (13/9)

Tocado: `Herramientas3D.js` (IDS_ARMA, tintas `colihue` y `cordel`, `esfera()` y
`tramo()`, familias `vara`/`arco`/`colgando`, los doce modelos, `grupo.llama`) y
`Cuerpo.js` (`_llamaEncendida` en el constructor, visibilidad al colgar, getter y
setter de `llamaEncendida`).

**Banco, cinco secciones: 5/5 VERDE** a la primera. Mi script:

| id | caja (m) | tri | mallas | tintas | pose | bajo pies |
|---|---|---|---|---|---|---|
| garrote | 0,729×0,119×0,113 | 336 | 2 | madera+cordel | cabo | 0,78 |
| honda | 0,749×0,063×0,027 | 112 | 2 | cordel+cuero | colgando | 0,20 |
| lanza_colihue | 1,700×0,034×0,034 | 80 | 2 | colihue+obsidiana | vara | 0,68 |
| estolica | 0,680×0,051×0,046 | 44 | 2 | madera+asta | cabo | 0,83 |
| bola_perdida | 0,380×0,073×0,073 | 96 | 1 | cuero | colgando | 0,55 |
| boleadora_dos | 0,803×0,078×0,078 | 176 | 1 | cuero | colgando | 0,20 |
| boleadora_tres | 0,763×0,175×0,113 | 296 | 1 | cuero | colgando | 0,23 |
| arco_colihue_obj | 1,205×0,122×0,024 | 304 | 2 | colihue+cordel | arco | 0,33 |
| linea_mano | 0,247×0,112×0,019 | 192 | 1 | cordel | cuenco | 0,77 |
| cana_colihue | 3,000×0,048×0,036 | 72 | 2 | colihue+cordel | vara | 0,71 |
| arpon_hueso | 2,200×0,078×0,032 | 176 | 2 | colihue+hueso | vara | 0,64 |
| equipo_mosca | 2,740×0,113×0,030 | 124 | 2 | colihue+hierro | vara | 0,77 |

- Pares más cercanos donde entra uno nuevo: sierra~bola_perdida 26 %,
  antorcha~boleadora_dos 23 %. Caña~mosca: 9 % de largo, 58 % de ancho (el carrete).
- **Tintas: el banco dice 10, son 11.** El banco cuenta materiales de mallas
  *visibles*, y con `llamaEncendida` en false por omisión la llama de la antorcha
  y el candil no se ve, así que no entra. Entre los treinta modelos hay 11: las
  nueve de antes, `colihue` y `cordel`. Queda una libre. Lo digo para no quedarme con
  el 10.
- El peor en triángulos es el garrote, con 336 (37 % del tope); le sigue el arco,
  con 304. En mallas, siete de los doce usan dos.

## 6 · Holgura contra el cuerpo (E4 dice «ni atraviesa el cuerpo parado»; el banco no lo mide)

Script propio `scratchpad/holgura.mjs`. Aproxima el cuerpo con cápsulas y elipses
en el espacio de cada nudo, muestrea las aristas del modelo cada 1,5 cm y excluye
el puño. Parado es contrato; andando (1,5 m/s) y corriendo (5,5 m/s), 16 fases
del paso, es informativo.

- **Primera versión (agarre a 25–30 cm del regatón, colgado abierto 0,1 rad):**
  parado, todo libre. Andando, el arco entraba 5,1 cm en el muslo derecho.
  Corriendo, casi todos los nuevos entraban de 3 a 10 cm en el muslo derecho, y los
  18 viejos no (candil 0,3 cm). La cuenta: el muslo avanza 0,62 rad al correr y
  la rodilla llega a z −0,33, así que todo lo que queda bajo el puño y delante del
  muslo se lo lleva.
- **Segunda:** varas agarradas a 8 cm del regatón; lo colgado corrido 3 cm afuera
  y con 0,2 rad de apertura; el arco con la pala de abajo hacia adelante (rx
  +0,20). Resultado: todo lo colgado, libre también corriendo; las varas, de 10 a
  1,2 cm corriendo. **Pero el arco pasó a entrar 2,8 cm en el antebrazo derecho
  PARADO**, que es contrato: la pala de arriba, echada atrás, va a lo largo del
  antebrazo. Además, al correr seguían chocando el fiador del garrote (7,8 cm),
  la cola de la línea (6,9) y el carrete de la mosca (9,1).
- **Tercera, en curso:** fuera el fiador del garrote; la cola de la línea, hacia
  afuera; el carrete, del lado de adelante de la caña. El script ahora afina las
  cápsulas con los radios de `Cuerpo.js`, mide cuánto tapa en primera persona (el
  ángulo mínimo entre el centro de la vista y el modelo) y barre poses para el arco
  sin tocar el código.
- **Tercera, medida con el cuerpo afinado** (radios de `Cuerpo.js`, palma
  excluida 11 cm): de los doce, parado sólo toca el arco (3,3 cm en el antebrazo
  derecho con rx +0,20); corriendo, sólo la mosca (4,8 cm en el muslo, el carrete).
  Garrote, línea, lanza, caña y arpón, libres también corriendo.
- **Calibración de la medida, y no la escondo:** con el cuerpo afinado, el
  **ahumador de la ronda 5** da 1,8 cm en el antebrazo derecho parado, y el candil
  0,2 corriendo. Nadie vio eso como defecto en la ronda 5: es lo que se lleva en el
  puño rozando la muñeca, donde el antebrazo sube hacia el codo (codo cargado 0,92
  rad: desde el puño, el codo está 0,16 m arriba y 0,21 m atrás). Una pieza
  vertical que sale del puño toca esa cápsula en sus primeros 7 cm. **Leo 1 a 2 cm
  «en el antebrazo» como agarre y no como atravesar**, pero busco cero para el arco
  igual. El ahumador no lo toco: no es de esta fase y r5-fase3 lo cubre.
- Primera persona (ángulo mínimo del modelo al centro de la vista, mirando al
  frente; más chico tapa más): los 18 van de 23° (pico de hierro) a 71°. Las
  cuatro varas, 30°; garrote 36°, estólica 35°; lo colgado, ~75°. Nada nuevo
  tapa más que el pico, la pala o la barreta.
- Barrido del arco (rx × rz × x): lo que más aleja el antebrazo es correr la caña
  hacia afuera en el puño; echarla atrás (rx > 0) empeora. rx −0,10, rz 0,14,
  x 0,04: 0,4 cm parado, 0,7 andando, 2,1 corriendo, 54°. Sigo con uno más fino.
- Barrido fino del arco (rx −0,25…−0,10 × rz 0,06…0,14 × x 0,04…0,06): rz bajo
  mete la pala de abajo en la pantorrilla; x 0,04 roza el antebrazo. **Elegido rx
  −0,15, rz 0,14, x 0,05: parado libre, andando libre, corriendo 1,1 cm en el
  muslo, 50° en primera persona.** Con x 0,06 corriendo baja a 0,2, pero la caña
  queda a 6 cm del centro de un puño de ±4,4: se vería suelta.
- Carrete de la mosca subido 1,5 cm hacia el puño (centro en y −0,080), para ver
  si deja de entrar al correr.

## 7 · Estado final de las poses y holgura (13/9)

- `arco` quedó en rx −0,15, rz 0,14, x 0,05. El carrete subido no cambió los 4,8 cm
  de la mosca al correr, así que el choque no era el carrete: es la parte de la
  caña bajo el puño. Lo dejo, porque al correr es informativo.
- Holgura final de los doce: **parado, libres los doce; andando, libres los
  doce**; corriendo, arco 1,1 cm y mosca 4,8 cm en el muslo derecho.
- Banco, cinco secciones: **5/5**. Suelo: el más bajo es la boleadora de dos, a
  0,20 m; el arco, 0,33.

## 8 · De dónde sale cada medida

Los modelos están en el espacio del cuerpo de 1,78 m y escalan con la estatura
(×0,9775 a 1,74 m), igual que los dieciocho.

| id | medida del modelo | fuente o criterio | ¿verificada? |
|---|---|---|---|
| garrote | 0,66 m; cabo 4,2→4,8 cm; nudo 11 cm | **Estimación desde la ficha**: 1,2 kg de madera a ~0,60 g/cm³ (coihue al 12 %) son ~2 L; con cabo de muñeca y nudo, 0,66 m. Cuenta: cabo 731 + transición 328 + nudo 737 + protuberancia ~165 cm³ ≈ 1,96 L → 1,18 kg. La macana mapuche, de 1,5 m, se descarta por el peso | densidad: resumen de búsqueda |
| honda | ramas de 0,70 m, cuna 6 cm | es.wikipedia: «61 a 100 cm […] es típica»; EcuRed: «metro y medio» en total; MNHN: las del norte, ~2 m. Tomé 0,70 por rama (≈1,5 m en total) porque con 2 m la cuna colgada toca el suelo | es.wikipedia y MNHN sí; EcuRed no |
| lanza_colihue | 1,70 m; astil 3,0→2,7 cm; punta de obsidiana de 12 cm × 3 × 0,9 | El arcón: «la lanza corta que no era mayor de 1,70 metro de largo»; `punta` de obsidiana y 0,02 kg (`recursosNuevos`); diámetro dentro del rango 2–3,5 cm del colihue. La ficha pesa 1,1 kg y esto da ~0,75 | largo sí; diámetro no |
| estolica | tabla de 0,66 × 4,0 × 1,8 cm; gancho de asta de 3 cm | Rango «60 a 90 centímetros» (resumen de búsqueda, sin verificar: ni el Tesauro ni Wikipedia dan número). Tomé el extremo bajo. Sección y gancho: estimación. Da ~0,38 kg contra 0,6 de la ficha | **no** |
| bola_perdida | bola de 7,3 cm; manija colgando 0,30 m | Bola: `bola` = 0,5 kg forrada (`recursosNuevos`) → ~0,45 kg de piedra a 2,65 g/cm³ = 170 cm³ = 6,9 cm, más el forro. La manija de 0,30 es **estimación**: la ficha dice «manija corta»; Oviedo da un tiento «como vara» (0,836 m) para la de tiro, que colgado entero llega a 4 cm del suelo | bola: dato del juego; manija: no |
| boleadora_dos | chica 6,6 cm en el puño, grande 7,8 cm a 0,66 m | Desiguales por la ficha, con un volumen medio igual al de la `bola` de 7,3 cm; Darwin: «del tamaño de una manzana». Ramal: El arcón da ~1 m y Darwin 8 pies; lo que cuelga (0,66) es **criterio de E4**, con el sobrante recogido en la mano | ramal: sí; lo colgado: criterio |
| boleadora_tres | manija 6,4 cm; nudo a 0,34 m; grandes 7,8 cm a 0,25–0,29 m del nudo | D'Orbigny: tientos de «más de un metro»; bolas como en la de dos. Lo colgado, 0,76 m, es **criterio de E4** (entero arrastraría) | ramal: sí; lo colgado: criterio |
| arco_colihue_obj | 1,20 m; caña 2,8→1,6 cm; puntas 10 cm hacia la cuerda | newenmapu: «una vara o una rama de 1,20 ó 1,70 de largo»; Museo de la Patagonia: tehuelches con arcos «chicos» → el extremo corto. Diámetros y curvatura: **estimación** | largo sí; lo demás no |
| linea_mano | aro de 11,2 cm de diámetro exterior y 6,8 interior; cordel de 2,2 cm; cola de 0,15 m | **Estimación**: la palma envuelta (ancho ~8,5 cm y grosor ~3, perímetro ~23 cm → ~7 cm de diámetro) con las vueltas encima. Da ~0,1 kg contra 0,2 de la ficha | no |
| cana_colihue | 3,00 m; 2,7→0,8 cm | Desde la ficha: 0,6 kg − cordel 0,09 − anzuelos 0,02 = 0,49 kg de colihue a 0,61 g/cm³ → 800 cm³; con la base de 2,7 cm (rango 2–3,5) y la punta de 0,8, 3,0 m (792 cm³ → 0,48 kg). Colihue de 3 a 7 m (SIB, `flora.json`) | largo de caña sí; densidad y diámetro: resumen |
| arpon_hueso | 2,20 m; astil 2,5→2,3 cm; dos puntas de hueso de 20 cm abiertas 7 cm | **Estimación desde la ficha**: 0,8 kg con un astil de 2,5 cm (medio del rango) da ~2 m de astil. La horqueta interpreta los «hueso ×2» y la «fija» de la `notaLegal`, y no es un artefacto patagónico documentado. El arpón fijo yámana llegaba a 3–4 m (resumen de búsqueda), pero es de caza marina | no |
| equipo_mosca | 2,74 m; carrete de 85 mm × 3 cm; empuñadura de 20 × 3 cm | 9 pies = 2,74 m, la caña estándar de trucha (pesca.news, solomosca); carrete 5/6 «Overall Reel Diameter: 85 mm» (Wild Water). Empuñadura y afinado: estimación | largo y carrete sí |

## 9 · E8 — el costo que espero

El peor, a mi juicio, es `cana_colihue`, por las sombras y no por los triángulos:
es la más alta (la punta a 3,56 m) y lleva dos mallas, así que es la que cruza
más cascadas. Espero +0,05 a +0,15 ms. Está en `pendiente-r7-empunadura.md`, con
la advertencia de que las predicciones de los agentes caen optimistas.

## 10 · Corrida completa (13/9)

`node .claude/flota/banco-r7-fase2b.mjs` sin variables: **7/7 VERDE**. Cableado,
los doce, siluetas, suelo, llama apagada, sin regresión (r5-fase3 4/4, r7-fase1
6/6, r7-fase2 4/4) y `vite build`. `git diff --stat`: sólo `Cuerpo.js` (+31) y
`Herramientas3D.js` (+304 −2); fuera de `src/`, esta bitácora y
`pendiente-r7-empunadura.md`. Sin commit, sin Vite, sin navegador.

Nota sobre los números del banco: r5-fase3 cuenta ahora 8 tintas entre los 18
(eran 9) y r7 cuenta 10 entre los 30, porque la llama arranca escondida y los dos
bancos cuentan sólo mallas visibles. Hay 11.
