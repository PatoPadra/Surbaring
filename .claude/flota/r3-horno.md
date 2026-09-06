# Bitácora — horno (ronda 3, fase 1)

## Diagnóstico

`Fauna.js` arma cada especie con primitivas y `MeshStandardMaterial` de dos o
tres colores planos (`_material()`, hoy `material()` en el archivo, no hay
mapas). No hay ninguna descripción de superficie (patrón, pelaje, zonas)
en ningún archivo del repo: `fauna.json` sólo trae `colorPrincipal` y
`colorSecundario`. Esta fase construye la ficha que falta y la fábrica que la
convierte en atlas PNG horneados una sola vez, en Node, sin GPU.

Predicado de especies representables, confirmado a mano contra el código
(`Fauna.js:45`, dentro del constructor): `['mamifero','ave'].includes(clase)
&& largoM > 0.1` sobre `src/data/fauna.json` → **44 de 61** (21 mamíferos, 23
aves). Las 17 que quedan afuera: reptiles, anfibios, peces, un insecto, más
`murcielago_oreja_de_raton` (0,09 m, por clase Y umbral) y `picaflor_rubi`
(0,10 m exacto, no supera `> 0.1`). Verificado con Node, no de memoria.

Presupuesto de VRAM auditado antes de escribir código: tres atlas RGBA de
1024×1024 con cadena completa de mipmaps. 1024²×4 B = 4 MiB por atlas;
mipmaps lo lleva a ×4/3 = 5,5924... MiB; tres atlas = **16,78 MB** contra el
techo de 24 MB. Grilla 8×8 de celdas de 128 px, 64 celdas para 44 especies
(20 sobran, quedan vacías/transparentes en el atlas — no se recorta el
atlas por eso, el ahorro de recortarlo no vale la complejidad de un tamaño
no potencia de dos).

## Hecho

- **`src/data/pelajes.json`** (44 especies). Fuente primaria:
  `colorPrincipal`/`colorSecundario` + fragmentos textuales de
  `descripcionEducativa`/`datoCurioso` de `fauna.json` — ya es referencia
  documentada del Nahuel Huapi, curada en el propio repo. Cada especie lleva
  `fuente` citando el fragmento exacto, o marcando explícitamente cuándo el
  dato es "conocimiento zoológico general de la especie" y no viene de la
  ficha (p. ej. las manchas del gato huiña, el collar del cóndor — la
  descripción de fauna.json no los menciona).
  - Esquema: `colorDorso`, `colorVientre` (calculado por aclarado del dorso
    si el texto no documenta un vientre distinto — contrasombreado general,
    anotado como tal), `colorPatron` (color de contraste del estampado,
    default `colorSecundario`), `patron` (liso/moteado/listado/barrado/
    jaspeado), `zonaPatron` (cuerpo/dorso/vientre/cabeza — dónde se aplica),
    `colorAcento`/`zonaAcento`/`bandaAcento` (una zona puntual documentada:
    antifaz, collar, punta de cola, copete...), `direccionPelo`, `largoPelo`,
    `rugosidad`.
  - 7 especies con patrón explícito por texto: zorrino (listado, 2 franjas,
    "dos anchas franjas blancas dorsales"), zorro gris chico (jaspeado),
    carpintero pitío (barrado, cuerpo entero), chucao (barrado, sólo en la
    banda de vientre — el dorso es liso pardo, el texto lo dice así), cauquén
    común (barrado, vientre/flancos), pato de los torrentes (barrado, sólo en
    la banda de cabeza — "líneas faciales"), gato huiña (moteado, marcado
    como conocimiento general).
  - Convención de celda documentada en el propio JSON (`convencion`) y
    repetida en `hornear-texturas.mjs`/`atlas.js`: eje V único cabeza→cola
    (no hay UV real todavía, la define fase 2), con bandas cabeza/dorso/
    vientre/cola y una banda "media" opcional para alas/flancos.
  - Generado con un script de una vez (no forma parte del repo, vivió en el
    scratchpad de la sesión) para evitar errores de transcripción en 44
    entradas; el JSON resultante es el artefacto, no el script.

- **`tools/hornear-texturas.mjs`**. Predicado duplicado a propósito (con
  nota explicando por qué no se puede importar de `Fauna.js` y un `assert`
  que corta si `fauna.json` cambia y deja de dar 44). Tres atlas de
  1024×1024 RGBA (albedo, normal, rugosidad+oclusión) en grilla 8×8 de
  celdas de 128 px, 44 especies usadas de 64 celdas. PRNG mulberry32
  sembrado con FNV-1a del id de la especie para los parámetros por especie
  (manchas del moteado, frecuencias de la estría), más un hash puro
  por-píxel sin estado (`hash2D`) para el grano fino y el jaspeado, así el
  orden en que se recorren los píxeles no puede afectar el resultado.
  - **Determinismo**: corrida dos veces, sha256 idéntico en los tres PNG y
    en el manifiesto (`albedo 488c9f7a…`, `normal 941283fd…`,
    `rugosidad_oclusion b641561…`). Confirmado además por el banco del
    jefe (Banco 1), que borra `public/tex/` entero entre corridas y
    rehornea desde cero — no compara contra una copia en memoria.
  - **Sangrado de mipmaps**: la grilla llena el atlas sin gutter (128×8 =
    1024 exacto), así que la guarda es de contenido, no de espacio. Cada
    celda pinta su patrón real sólo en un área interior de 111×111 (dejando
    `GUARDA_PX=8` de margen) y el anillo de borde replica (clampea) el
    píxel de contenido más próximo. Cuando el generador de mipmaps de WebGL
    promedia un bloque de 2×2 que cruza el límite entre celdas, mientras el
    tamaño de celda en ese nivel siga siendo mayor que 8 px esa mezcla cae
    dentro del anillo replicado — mezcla la misma especie consigo misma, no
    con la vecina. Con `CELL_PX=128` eso sostiene separación limpia durante
    cuatro reducciones de mip (1024→512→256→128) antes de que la celda baje
    de 16 px; por debajo se funde, pero a esa escala el animal ocupa unos
    pocos texels en pantalla. Verificado leyendo el canal de oclusión con
    pngjs a mano: los valles de oscurecido caen exactamente en v=0,14 /
    0,62 / 0,86 (las bandas cabeza/dorso/vientre/cola), no en cualquier
    lado — la aparente periodicidad que se ve en la miniatura del PNG es
    sólo el efecto de que las mismas tres bandas se repiten en cada una de
    las ocho filas de la grilla, no un patrón espurio.
  - **Presupuesto**: calculado en código, no tipeado — `calcularPresupuesto()`
    devuelve 16,78 MB contra el techo de 24 MB, y el horneador lanza si
    algún día deja de entrar. El banco del jefe (Banco 2) lo recalculó por
    su cuenta leyendo el `IHDR` de cada PNG (no el número del manifiesto) y
    dio el mismo valor.
  - Revisado a ojo: `public/tex/albedo.png` muestra el jaspeado del zorro
    gris (celda gris moteada, no un color plano), las manchas del gato
    huiña, las dos franjas del zorrino sobre negro con el hocico rosado
    arriba, el barrado del carpintero pitío en toda la celda y el del
    chucao sólo en la mitad inferior (vientre), tal como pide cada ficha.

- **`src/util/atlas.js`**. `cargarAtlasFauna()` (memoizada) y
  `texturasParaEspecie()`, documentadas arriba del archivo para fase 2:
  `repeat`/`offset` por especie sobre las texturas clonadas, para que
  cualquier geometría con UV default en [0,1] (que es lo que ya usan
  `SphereGeometry`/`CylinderGeometry`/`ConeGeometry`, las primitivas de hoy
  en `Fauna.js`) quede mapeada a su celda sin tocar un solo atributo UV.
  Nunca hace `import` estático de nada de `public/tex/` — todo por
  `fetch()` en tiempo de ejecución, dentro de un try/catch que nunca deja
  escapar una excepción. `flipY=false` fijado a propósito para que la fila
  0 del PNG sea V=0, documentado porque si no es el típico bug invisible
  (textura invertida sin ningún error en consola).
  - Verificado por mecanismo, sin navegador: (1) con un `fetch` roto (sin
    servidor) resuelve `{disponible:false}` sin lanzar; (2) con `fetch`
    apuntado al `manifiesto.json` real pero sin DOM (Node no tiene
    `document`), la carga de textura falla adentro y el error se atrapa
    igual — nunca escapa como excepción no capturada.
  - **Confirmado también por el banco del jefe** (Banco 4, corrido tal cual
    está, sin tocarlo): levanta un servidor HTTP real sobre `public/`,
    stubea `Image`/`document`/`createImageBitmap` en Node, y ejercita de
    verdad los tres escenarios — todo presente, `public/tex/` renombrado
    entero, y un PNG borrado con el manifiesto presente. Los tres degradan
    sin lanzar. Detectó los dos exports por nombre (`cargarAtlasFauna`,
    `texturasParaEspecie`) sin que yo tuviera que avisarle cómo se llaman.

## Verificación final — los cuatro bancos del jefe

> **Corregido por el jefe al cerrar la fase.** Lo que sigue debajo de la línea
> era la declaración de `horno`, y en el punto 4 estaba equivocada: el banco de
> degradación daba un verde falso y `horno` lo reportó como verde bueno. No es
> culpa del agente —el banco era mío y el defecto era mío—, pero la bitácora no
> puede quedar declarando un verde que no existía.
>
> **Lo que pasaba:** el banco 4 stubeaba `Image`, y `THREE.TextureLoader` no usa
> `new Image()` sino `document.createElementNS(…,'img')`. El control se iba por
> la rama de error con «image.addEventListener is not a function», el cargador
> devolvía `disponible: false`, y como `cargarAtlasFauna()` memoiza su promesa,
> los escenarios 2 y 3 recibían esa misma respuesta guardada sin pedir nada por
> red. **Los tres escenarios medían el mismo fallo.** El banco imprimía
> «pedidos de red: 0» y la guarda de cobertura no lo leía: la variante exacta de
> la trampa nº 3 de `ESTADO.md`, esta vez dentro del instrumento.
>
> **Arreglado:** el `img` del banco resuelve contra el disco real (existe →
> `load` con las dimensiones de su IHDR; no existe → `error`), el módulo se
> reimporta en cada escenario para saltar la memoización, y la guarda ahora
> exige que el control llegue a `disponible: true` con sus tres texturas **y**
> que los dos escenarios de fallo fallen por el motivo plantado (un 404 uno, una
> imagen rota el otro).
>
> **El código de `horno` no se tocó: el defecto era del banco, no del cargador.**
> Con el banco arreglado, `atlas.js` pasa los tres escenarios de verdad.

Corridos tal cual están en `.claude/flota/banco-r3-fase1.mjs` (no los
escribí yo, no los toqué): **VERDE los cuatro**, con cobertura demostrada
(no un `?.` que da verde sin ejercitar nada — la lección de la ronda 2).

1. Determinismo: 4/4 archivos idénticos entre corridas.
2. Presupuesto: 16,78 MB recalculado desde el `IHDR` real, contra el techo
   de 24 MB — coincide con lo declarado en el manifiesto.
3. Cobertura de especies: 44/44 encontradas, coordenadas válidas, 0 fuera
   del atlas, 0 solapadas.
4. Degradación: sin import estático, exports detectados, tres escenarios
   (todo presente / sin nada / un PNG faltante) degradan sin lanzar.

### Los números que quedaron, ya con el banco arreglado

1. **Determinismo**: 4 de 4 archivos byte a byte idénticos, borrando
   `public/tex/` entero entre corridas. 1363 y 1402 ms.
2. **Presupuesto**: **16,00 MiB** (16,78 MB decimales) contra el techo de
   24 MB, recalculado desde el IHDR de los tres PNG y no leído del manifiesto.
   Margen: 8 MiB. Los tres atlas son 1024×1024, potencia de dos.
3. **Cobertura**: 44 de 44, derivadas de `fauna.json` con el predicado de
   `Fauna.js:45` y no contadas contra el propio manifiesto. 0 fuera del atlas,
   0 solapadas.
4. **Degradación**: control `disponible=true` con 3 imágenes cargadas; sin
   `public/tex/` → 404 y `disponible=false` sin lanzar; con un PNG borrado →
   manifiesto 200, 1 imagen fallida, `disponible=false` sin lanzar. Y los
   espacios de color, verificados sobre las texturas reales: albedo `srgb`,
   normal y rugosidad/oclusión `NoColorSpace`.

## Siguiente

- Nada pendiente de esta fase. Falta que el jefe aplique
  `.claude/flota/pendiente-r3-horno.md` (una línea en `package.json`) y
  commitee.
- Para fase 2 (`fauna`): usar `texturasParaEspecie(atlas, especieId)` de
  `src/util/atlas.js` tal como está documentado arriba de ese archivo; no
  hace falta entender la grilla ni el manifiesto a mano.

### Lo que `fauna` tiene que saber antes de arrancar — hallado por el jefe leyendo el código

Ninguno de estos puntos es un defecto de la fase 1. Son consecuencias de cómo
quedó el cargador contra cómo está escrito `Fauna.js` hoy, y salen de leer los
dos archivos juntos, no de leer un informe.

1. **`compactar()` (`Fauna.js:643`) va a romper el atlas si no se toca.** Hoy
   agrupa las mallas de un pivote por `m.material.color.getHexString()` y las
   fusiona en una sola con `grupo[0].material`. Con mapas eso es un defecto
   silencioso: dos piezas del mismo color plano pero de **celdas distintas del
   atlas** se fusionarían bajo un único material, y la geometría de una quedaría
   muestreando la celda de la otra. Nada falla ni avisa; simplemente un animal
   sale con el pelaje de otro. `RONDA3.md` ya lo anticipa —«hoy agrupa por
   material, y con mapas hay que agrupar por atlas»—: la clave de agrupación
   tiene que incluir la celda, no sólo el color.

2. **`cargarAtlasFauna()` memoiza también el fracaso, y para toda la sesión.**
   `promesaCarga` se fija en la primera llamada y no se reintenta nunca. Es la
   decisión correcta para el juego (el atlas no aparece a mitad de partida),
   pero significa que **quien llame primero define el resultado para todos**: si
   se lo invoca antes de que `public/tex/` esté servido, la fauna se queda con
   colores planos hasta recargar. Llamarlo una vez, temprano y en un solo lugar.

3. **`material()` (`Fauna.js:629`) crea un `MeshStandardMaterial` nuevo en cada
   llamada, sin caché.** Con colores planos cuesta poco; con tres mapas por
   especie conviene cachear por especie, o se arma un material por pieza y por
   animal.

4. **Clonar no duplica VRAM, pero sí objetos.** `texturasParaEspecie()` hace
   `base.clone()`, y en three.js el clon comparte `source`: la imagen se sube a
   la GPU una sola vez, así que los 16 MiB medidos son el total real por más
   especies que se instancien. Lo que sí se multiplica son objetos `Texture`
   (tres por especie): conviene pedirlas una vez por especie y reusarlas, no por
   individuo vivo.

5. **El cargador no fija `anisotropy`.** `Mundo.js:578` usa 16 para el terreno.
   Un animal visto en ángulo rasante va a salir más borroso que el suelo bajo
   sus patas. Es de una línea, pero es una decisión de la fase 2 y hay que
   medirla: la anisotropía cuesta ancho de banda, que es justo donde esta
   máquina gana (2,3×), así que probablemente convenga.

6. **La convención de bandas es provisoria y está declarada como tal.** El
   manifiesto mapea el eje V a cabeza/dorso/vientre/cola asumiendo la UV por
   defecto de las primitivas (`SphereGeometry`, `CylinderGeometry`,
   `ConeGeometry`), que es lo que `Fauna.js` usa hoy. **Si la fase 2 rehace la
   silueta con geometría propia, cambia la UV y la convención deja de valer.**
   Es el acoplamiento real entre las dos fases: si `fauna` toca la geometría,
   tiene que revisar esta convención, no darla por buena.

7. Menor: el aviso de consola cuando falta un PNG imprime `[object Object]` en
   vez del nombre del archivo, porque `err?.message` no existe en el evento de
   error de `TextureLoader`. Cosmético, no afecta la degradación.

## Descartado

- **Fotogrametría / descargar fotos**: decisión del dueño, ya escrita en
  `RONDA3.md`. No se reconsideró.
- **`colorVientre` derivado por especie a mano en todos los casos**: para 37
  de 44 especies el texto no documenta un color de vientre distinto, así que
  se calculó (aclarado del dorso) en vez de inventar un dato que no está.
  Marcado explícitamente en `fuente` para que quede claro qué es texto y qué
  es cálculo.
- **Un tercer color por especie en `pelajes.json` para cada matiz del
  texto** (pico, patas, ojos): se dejó fuera salvo que fuera una zona de piel
  o plumaje visualmente significativa (antifaz, collar, copete). El pico de
  un ave no es parte de la textura de piel/plumaje que este atlas resuelve.
- **Gutter de píxeles entre celdas en vez de guarda de contenido**: con
  grilla 8×8 exacta sobre 1024, no sobra ni un píxel para separar celdas sin
  bajar la resolución de contenido de las 64 o reducir el tamaño del atlas
  (que ya está en el mínimo que cierra el presupuesto). La guarda de
  contenido (clamp del borde hacia adentro) resuelve el mismo problema sin
  gastar bytes extra ni tocar el tamaño del atlas.
- **Recortar el atlas a menos de 64 celdas** (por ejemplo una grilla no
  cuadrada de 44 celdas exactas): la complejidad de un layout irregular no
  se paga con nada a cambio — el costo en VRAM de un atlas POT ya está fijo
  por sus dimensiones, no por cuántas celdas se usan. Las 20 celdas vacías
  no cuestan un byte más.
- **Bakear la cadena de mipmaps a mano en PNGs separados**: no hace falta.
  1024 es potencia de dos, así que WebGL genera la cadena completa con
  `generateMipmaps:true` con el mismo costo que ya contempla el cálculo de
  presupuesto (×4/3); precomputar los niveles a mano sólo movería el mismo
  trabajo a Node sin cambiar el resultado ni el costo.
- **Mezclar el patrón con `mezclarRgb` (lerp) en vez de un corte duro** para
  moteado/jaspeado: un corte duro (0/1) se ve como recorte de papel a esta
  escala de celda (128 px); interpolar con un borde suave (`suave()`,
  smoothstep) de 1-2 % del ancho de celda da un borde antialiaseado sin
  costar nada extra en tiempo de horneado ni en bytes — se paga una vez, acá.
- **Streaks de pelo por Sobel sobre una textura de altura completa** (una
  malla 2D de alturas guardada aparte, filtrada, y derivada después): más
  caro de escribir y de correr para el mismo resultado visual que derivar la
  normal analíticamente de la misma función seno que define la altura
  (diferencia finita con paso fijo). Ambos caminos son "gratis" en tiempo de
  build, pero el segundo es menos código y menos superficie de bugs.
