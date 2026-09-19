# Pendiente de `suelo` (ronda 8, fase 3) — para el coordinador

## 1 · Cableado: no hace falta ninguno para que ande

`Terreno` pide las capas en su constructor (`cargarSuelo()`, sin esperarla, igual que
`Fauna` con el atlas), y el terreno y la piedra del sotobosque enganchan los mismos
uniformes de `src/util/suelo.js` (`uniformesSuelo`). Cuando la carga termina cambia
el valor de los uniformes y nada más: no hay que tocar `main.js` para que el suelo
se vea.

## 2 · Recomendado: subir las texturas en la pantalla de carga

Sin esto, las dos texturas de capas (4 MB cada una, más la generación de mipmaps) se
suben en el primer cuadro en que se dibuja el terreno después de que llegaron: un
tirón único de unas decenas de milisegundos, que puede caer ya jugando, y los
primeros cuadros pueden salir con el ruido de antes si los PNG tardan. Son ocho PNG
locales (5,5 MB en disco); el decodificado en Node tarda ~0,4 s con la importación
de three incluida.

En `src/main.js`, justo antes de `progreso(1, 'Listo.');` (hoy línea 683):

```js
  // Las capas del suelo horneado: Terreno ya las pidió en su constructor; acá se
  // espera la carga y se suben a la placa mientras se ve la pantalla de carga,
  // para que el primer paso del jugador no pague la subida ni los mipmaps.
  // Si no llegan, `disponible` es false y el suelo sigue con el ruido.
  {
    const suelo = await cargarSuelo();
    if (suelo.disponible) { render.initTexture(suelo.albedo); render.initTexture(suelo.normal); }
  }
```

y arriba, con los demás imports:

```js
import { cargarSuelo } from './util/suelo.js';
```

`render.initTexture` sube una `DataArrayTexture` en three 0.169
(`WebGLRenderer.js:2794`, rama `isDataArrayTexture`). No compila nada.

Opcional, en `package.json`, el atajo del horno como el de la fase 1:
`"hornear-suelo": "node tools/hornear-suelo.mjs"`.

## 3 · Un defecto que encontré y NO arreglé: la normal del terreno está en el espacio equivocado

**Qué es.** En `<normal_fragment_begin>` el terreno arma `normal` a partir de
`gNormalDEM`, que es la normal del DEM **en coordenadas de mundo** (sale de
`uTexNormal`), y se la pasa así a la iluminación de three. Pero three ilumina en
**espacio de vista**: `geometryNormal = normal` en `lights_fragment_begin`, y las
direcciones de las luces vienen transformadas por `viewMatrix`
(`WebGLLights.setupView`). Así desde el prototipo (`6035732`). La luz del terreno
depende de hacia dónde mira la cámara.

**La cuenta, en las capturas de la base.** 12/2/2025 a las 12:00 en el Parque, el
sol está a 52° de elevación, rumbo 53°; la cámara, a rumbo 200° y −35°. La luz en
espacio de vista es (−0,335; 0,351; 0,875). El suelo llano recibe
N·L = 0,351 donde debería recibir sen 52° = 0,789: **2,25 veces menos sol
directo mirando al suelo** con el sol a la espalda, y más de lo debido con el sol de
frente. A −8° el error es chico (0,710 contra 0,789) y a 0° desaparece en suelo
llano, por eso nadie lo vio: la paleta se calibró mirando al frente. En laderas el
error depende también del rumbo.

**Por qué no lo arreglé.** No es del contrato, cambia la luz de todo el terreno, y
rompe por construcción la guarda de S2 (brillo ±10 %), que se midió con el defecto
puesto: mirando al suelo a −35° el sol directo subiría ×2,25. Tiene que ser un
cambio propio, medido y visto por el dueño.

**El arreglo es una línea**, al final de la sección de la normal, antes de
`vec3 nonPerturbedNormal = normal;`:

```glsl
        normal = normalize((viewMatrix * vec4(normal, 0.0)).xyz);
```

Todo lo que suma relieve a la normal (el DEM fino, el ruido f2/f3, y ahora la normal
horneada del suelo) está escrito en el marco del mundo, así que con esa línea queda
bien de una vez. Hasta entonces, la normal horneada se ilumina con la misma luz
torcida que el resto: mirando al suelo el sol entra como si estuviera a unos 20°
sobre el horizonte y los cantos de las piedritas se marcan más de lo que deberían.

## 4 · Los avisos de `lint-shader`

`lint-shader` da cero errores. Los avisos de «se declara 2 vez/veces y nadie lo
lee» sobre `uSuelo*` en `Sotobosque.js` (y antes en `Terreno.js`) son falsos: esos
uniformes están definidos en `src/util/suelo.js` y el lint sólo cuenta las menciones
dentro del archivo que revisa. En `Terreno.js` los nombro en el comentario de la
tabla de uniformes porque ahí sirve para leer el archivo; en `Sotobosque.js` no, y
el aviso queda.

Y un cambio de forma que hace falta saber: en `Sotobosque.js` el GLSL de la piedra
son constantes aparte (`PIEDRA_VERT_CABECERA`, `PIEDRA_VERT`, `PIEDRA_FRAG_CABECERA`,
`PIEDRA_COLOR`) y no plantillas anidadas, porque el separador de literales del lint
no entiende el anidado: con las declaraciones adentro de un `${esPiedra ? `…` : ''}`
daba seis errores de «se usa y NO está declarado» sobre un shader que sí las
declaraba.
