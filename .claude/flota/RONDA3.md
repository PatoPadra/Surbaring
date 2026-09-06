# RONDA 3 — DEFINICIÓN Y REALISMO DE ANIMALES Y ÁRBOLES

> Abierta el 6/9/2026 a pedido del dueño: *«mejorar los gráficos; los animales y
> árboles quizá se pueden escanear para mejorar la definición y el realismo»*.
> Rama: `mejoras/ronda3-graficos`, salida de `main` limpio.
> **Se cierra de a una fase.** No arranca la fase siguiente hasta que la anterior
> esté medida, revisada y commiteada. Es una decisión explícita del dueño.

Antes de tocar nada: `ESTADO.md`, y de ahí la sección **«Trampas de medición ya
pagadas»**, que son siete y costaron una sesión cada una.

---

## El diagnóstico, medido sobre el código

**Los animales no tienen ni una textura.** `Fauna.js` arma cada especie con
primitivas —`SphereGeometry(1, 12, 9)` para el cuerpo, cilindros para las patas,
conos para orejas y cola— y les aplica `MeshStandardMaterial` con **dos o tres
colores planos** y ni un mapa (`_material()`, `Fauna.js:629`). A cinco metros un
huemul es una cápsula gris. Ésa es toda la deuda: no hay albedo, no hay normal,
no hay rugosidad variable, y la silueta sale de esferas escaladas y no de la
forma del animal.

**Los árboles sí tienen algo, y es de dónde hay que copiar.** `Vegetacion.js`
genera el follaje con `CanvasTexture` (`:990`) y hornea impostores de **ocho
vistas** a un render target (`hornearImpostor`, `:676`). El sistema existe y
funciona; lo que falta es resolución de detalle: corteza sin mapa, follaje de una
sola capa, y las ocho vistas que ya están anotadas como defecto sin medir.

**Las fichas ya traen la mitad del trabajo hecho.** `src/data/fauna.json` y
`flora.json` tienen medidas reales por especie —`largoM`, `alturaCruzM`,
`pesoKg`, bioma, estación— pero **ninguna descripción de color, patrón ni
pelaje**. Ese hueco es exactamente lo que la ronda tiene que llenar.

## Por qué por textura y no por shader

Está medido el 1/9/2026 sobre esta máquina (ver la memoria `gpu-optimus-medida`):

| Prueba | Intel HD 4000 | GT 630M (la que usa Chrome hoy) |
|---|---|---|
| Shader cargado de `sin`/`cos` | **0,196 ms**/draw | 1,552 ms/draw |
| Ancho de banda de texturas | 78,2 ms/draw | **33,6 ms**/draw |

La dedicada pierde **8×** en matemática de shader y gana **2,3×** en texturas.
Cualquier mejora de realismo que se pague con ALU en el fragmento va contra el
hardware; la que se paga con un texel leído va a favor. **La ronda entera se
apoya en eso.** Si una idea necesita más `pow`, `noise` o `fbm` por píxel, está
mal encarada para esta máquina, por linda que se vea.

## De dónde sale la imagen — decidido por el dueño el 6/9/2026

**Procedural desde referencia, horneado offline.** Nadie descarga nada. Los
patrones, paletas y proporciones se derivan de la referencia documentada y se
hornean **una sola vez, en Node**, a atlas PNG que el juego carga como cualquier
otro archivo. No hay riesgo de licencia, no se suman megas de fotos al repo, y el
costo en VRAM lo fija esta ronda y no un `.jpg` ajeno.

Se descartó explícitamente la fotogrametría: una foto suelta de internet no da un
modelo 3D — hace falta un juego de tomas múltiples del mismo individuo, y no
existe. Lo que sí da una foto es información de **color, patrón y proporción**, y
eso se captura como datos en la ficha, no como píxeles en el repo.

---

## El reparto — propiedad exclusiva, sin excepciones

Es lo que evitó los conflictos en las rondas 1 y 2 con doce contextos en
paralelo. Un agente que necesita tocar un archivo ajeno **no lo toca**: escribe
el parche en `pendiente-r3-<fase>.md` y sigue.

| Fase | Agente | Archivos suyos y de nadie más |
|---|---|---|
| **1** | **horno** | `tools/hornear-texturas.mjs` (nuevo), `public/tex/` (nuevo), `src/util/atlas.js` (nuevo), `src/data/pelajes.json` (nuevo) |
| **2** | **fauna** | `src/entities/Fauna.js`, `src/entities/Cuerpo.js`, `src/entities/Peces.js` |
| **3** | **flora** | `src/world/Vegetacion.js`, `src/world/Sotobosque.js` |

Del coordinador y de nadie más: `src/main.js`, `src/engine/Calidad.js`,
`index.html`, `README.md`, y las fusiones.

**El orden no es arbitrario: es una dependencia real.** `fauna` y `flora`
consumen lo que produce `horno`. Si `horno` no cerró, las otras dos no tienen qué
aplicar.

---

## Qué tiene que hacer cada fase

### Fase 1 · horno — la fábrica de atlas

Construir el horneador offline y dejarlo corriendo con `npm run hornear`.

- **Entrada:** `src/data/pelajes.json`, nuevo, escrito en esta fase: por especie,
  la descripción de superficie que hoy no existe en ningún lado. Color base y
  variación, patrón (moteado, listado, liso, agua de pelo), dirección y largo del
  pelo o la pluma, zonas de color distinto (vientre, hocico, collar), rugosidad.
  Sale de la referencia documentada de cada especie del Nahuel Huapi, y se anota
  **de dónde sale cada valor** en un campo `fuente`.
- **Salida:** atlas PNG en `public/tex/` —albedo, normal y un mapa combinado de
  rugosidad/oclusión— más un manifiesto JSON con las coordenadas de cada especie
  dentro del atlas.
- **Presupuesto duro:** el total de todos los atlas nuevos **no pasa de 24 MB en
  VRAM** contando mipmaps. Potencia de dos, mipmaps sí, y el manifiesto declara
  el costo calculado para que se pueda auditar sin abrir el navegador.
- **Cargador:** `src/util/atlas.js` — carga el manifiesto y los PNG, y devuelve
  las texturas ya configuradas. Tiene que degradar solo: si el atlas no está, el
  juego arranca igual con los colores planos de hoy. Nada de esto puede romper el
  arranque.
- El horneador es **determinista**: misma entrada, mismo PNG byte a byte. Sin eso
  no se puede revisar un cambio de textura en un diff.

### Fase 2 · fauna — que un huemul se vea como un huemul

- Aplicar los atlas de la fase 1 a las especies de `Fauna.js`, respetando el
  fusionado por color que ya hace `_compactar()` (`:643`) — hoy agrupa por
  material, y con mapas hay que agrupar por atlas, que es lo mismo pero mejor.
- **Silueta.** Las medidas reales ya están en `fauna.json` y hoy se usan a
  medias: el cuerpo es una esfera escalada. Un cuadrúpedo tiene lomo, cruz y
  grupa, y eso se puede hacer con la misma cantidad de triángulos si se elige
  mejor dónde ponerlos. La mejora de silueta es tan importante como la de textura
  y sale más barata.
- **Presupuesto de triángulos:** la fauna hoy no aparece en el reparto del cuadro
  (está por debajo del 5 %). Puede subir, pero **no más de 2 ms** a Baja
  1024×576, y sólo si la silueta lo justifica.
- No tocar comportamiento, voces ni aptitud de especie: eso lo cerró `vida` en la
  ronda 1 y no es de esta ronda.

### Fase 3 · flora — corteza, follaje y los ocho impostores

- **Corteza con mapa.** Es lo más barato de todo: los troncos ya son geometría
  cilíndrica con UV, y hoy van con color plano.
- **Follaje de más de una capa.** La `CanvasTexture` de `:990` es el punto de
  partida, no el techo.
- **Los ocho impostores.** Está anotado en `SEGUIR.md` como defecto diagnosticado
  y sin abrir, porque pedía un banco de memoria que no existía. Ahora sí existe:
  el presupuesto de VRAM de la fase 1 obliga a construirlo. Medir antes de
  cambiar el número de vistas.
- **Los árboles son el 22 % del cuadro.** Es la pieza cara de esta ronda. El
  presupuesto es **cero regresión**: si algo sube el costo, se compensa en el
  mismo archivo antes de cerrar la fase.

---

## Reglas — las mismas de la ronda 2, y las dos que salieron caras

1. **Quien escribe el arreglo no puede escribir el banco que lo mide.** En esta
   ronda el banco de cada fase lo escribe **el jefe**, no el agente. La revisión
   independiente de la ronda 2 encontró nueve defectos que ninguno de los tres
   jefes podía ver en su propio trabajo.
2. **Todo banco lleva guarda de cobertura.** Un banco que arma sus dependencias a
   mano y las consulta con `?.` da verde sin ejercitar nada. Pasó, y el cero
   estaba impreso en pantalla sin que nadie lo leyera.
3. **Se mide en preset Baja a 1024×576**, que es donde se juega. Medir en Alta es
   medir otro juego. Línea de base: **31,8 fps**; reparto del cuadro: terreno
   35 %, árboles 22 %, sombras 9 %, sotobosque 4,5 %.
4. **Ningún agente levanta Vite ni abre el navegador.** Hay un solo servidor y el
   panel no compone cuadros. Se verifica por mecanismo y con bancos de Node.
5. **La bitácora se escribe mientras se trabaja, no al final.** El corte por
   tokens cae justo entre hacer y anotar, y ya hizo que tres agentes de la ronda
   1 subdeclararan trabajo terminado.
6. **Comprobar contra el código qué está hecho**, no contra la bitácora.

## Bitácoras

`r3-horno.md`, `r3-fauna.md`, `r3-flora.md`. Cada una con diagnóstico, hecho,
siguiente y **descartado con el motivo** — lo descartado es lo que evita que la
sesión siguiente vuelva a pagar lo mismo.

## Definición de «fase cerrada»

Las cinco, y no se negocia ninguna:

1. El banco del jefe da verde **y** su guarda de cobertura demuestra que ejercitó
   lo que dice ejercitar.
2. El presupuesto de la fase está medido y escrito con el número, no con un «no
   debería subir».
3. La bitácora está al día contra el código, no contra la intención.
4. El jefe revisó el trabajo del agente **leyéndolo**, no leyendo su informe.
5. Está commiteado en `mejoras/ronda3-graficos`.
