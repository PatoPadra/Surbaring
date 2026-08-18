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
- Vegetación instanciada por aptitud ecológica (4300 plantas, 26 especies)
- Fauna con máquina de estados, animación por partes y filtro de hábitat
- Ciclo día/noche con posición solar astronómica para latitud −41,13
- Clima mensual con las normales de Bariloche Aero
- Códice educativo y HUD en español

### Roto o a medio hacer

1. **El cielo sale anaranjado con el sol alto.** La dispersión de Rayleigh
   atenúa el azul de más y el término de Mie arrastra el tinte cálido. Debería
   ser azul profundo al mediodía. Es el defecto visual más visible.
2. **El terreno se ve de un beige uniforme.** El mezclado por altura, pendiente
   y humedad funciona, pero el modelo de humedad da valores demasiado bajos
   (0,30 donde debería haber bosque de coihue), así que gana la paleta de estepa
   en casi todo el mapa.
3. **Los árboles son geometría muy facetada.** Son icosaedros y conos sin
   texturas de hoja ni impostores a distancia. Falta trabajo de arte.
4. **8 M de triángulos por cuadro**, casi todos vegetación multiplicada por las
   4 cascadas de sombra. Necesita LOD e impostores.
5. **La hora del HUD está en UTC**, no en hora local (UTC−3).
6. `src/data/historia.json` y `src/data/geografia.json` **no existen todavía**:
   los agentes de investigación de historia y geografía fallaron y hay que
   relanzarlos. El códice y el árbol tecnológico dependen de ellos.
7. No hay todavía: inventario, crafteo, construcción, audio, ni eventos
   naturales (incendio, ceniza, viento blanco) más allá de los parámetros.

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
