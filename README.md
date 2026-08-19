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
| `E` | Identificar al animal más cercano |
| `Tab` | Abrir el códice |
| `T` | Acelerar el paso del tiempo |
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
- **`src/data/historia.json`** — 6 eras, 32 eventos, 12 personajes,
  16 entradas de mitología, 30 topónimos en mapuzugun, 47 tecnologías
  encadenadas en un árbol de saberes y 20 sitios históricos.

Durante la investigación se detectó que tres especies pedidas **no habitan la
región** (el sapo rococó es del litoral; la lagartija de Magallanes y el
chinchillón anaranjado son de Santa Cruz). Se dejaron documentadas con su
distribución real en vez de inventarlas, y se agregaron las especies que sí
están registradas en el parque.

El **códice** (`Tab`) es el objetivo del juego: cada especie se descubre
avistándola en su hábitat real y se completa identificándola de cerca.

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
  11,8 M a 2,4 M
- Sotobosque de 11 400 elementos: coirón, pastizal húmedo, helechos, michay,
  piedras sueltas y troncos caídos, cada uno con su regla ecológica. El
  sembrado se reparte entre cuadros con presupuesto de 5 ms, así cruzar una
  celda no produce un tirón
- Fauna con máquina de estados, animación por partes y filtro de hábitat
- Ciclo día/noche con posición solar astronómica para latitud −41,13
- Clima mensual con las normales de Bariloche Aero
- Códice educativo y HUD en español

### Roto o a medio hacer

1. **El follaje no tiene variación de brillo por cara.** Las tarjetas se
   iluminan con la normal de la copa, que da volumen pero aplana el detalle
   interno; falta oclusión propia dentro de la copa.
2. **Las carteleras se hornean desde un solo ángulo.** Al rodear un árbol
   lejano, su imagen no cambia de perfil. Se resolvería con un atlas de varias
   vistas, interpolando entre las dos más cercanas al ángulo de cámara.
3. El códice todavía no consume `geografia.json` ni `historia.json`: los datos
   están, la interfaz que los muestra no.
4. No hay todavía: inventario, crafteo, construcción, audio, ni eventos
   naturales (incendio, ceniza, viento blanco) más allá de los parámetros.
5. El sotobosque llega hasta 64 m del jugador (112 m para piedras y troncos).
   Más allá el suelo queda desnudo: hace falta una capa de impostores o una
   textura de detalle que tome el relevo.

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
