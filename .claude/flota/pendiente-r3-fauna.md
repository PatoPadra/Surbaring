# Pendiente de `fauna` (ronda 3, fase 2) — parches en archivos que no son míos

Nada de esto lo toqué. `src/util/atlas.js` es de `horno` y el manifiesto es su
salida; los dos primeros puntos son de documentación y el tercero es una decisión
de diseño para la ronda que viene.

---

> **APLICADO — 6/9/2026, coordinador.** El punto 1 ya estaba resuelto cuando
> `fauna` escribio esto: el jefe de la fase 2 corrigio la cabecera de
> `src/util/atlas.js` en paralelo, como parte del arreglo del cruce ORM.
> Verificado leyendo el archivo: las lineas dicen `roughnessMap` -> canal G y
> `aoMap` -> canal R, y la nota de `uv2` ya no esta. El punto 2 es una
> observacion sin accion. **Quedan abiertos el 3 —la orientacion de las bandas,
> que es de `horno` y va a la ronda siguiente— y el 4, cosmetico.**

## 1 · La cabecera de `src/util/atlas.js` documenta los canales al revés

Líneas 32-38. El ejemplo de uso dice `canal R = rugosidad` / `canal G = oclusión`
y menciona un segundo set de UV. Las dos cosas son falsas contra three 0.169 y
contra la convención ORM que el horno hornea ahora:

- three lee `aoMap` del **canal R** (`aomap_fragment.glsl.js`) y `roughnessMap`
  del **canal G** (`roughnessmap_fragment.glsl.js`).
- `aoMap` usa el atributo **`uv`** (canal 0): `Texture.channel = 0`
  (`Texture.js:38`) y `WebGLPrograms.js:262` deriva `aoMapUv` de ahí. Lo de
  `uv2` es de three anterior a r151.

Quien lea esa cabecera y la siga al pie de la letra escribe el defecto. El parche
exacto, reemplazando las líneas 32-38:

```js
 *       material.map = t.albedo;
 *       material.normalMap = t.normal;
 *       material.roughnessMap = t.rugosidadOclusion;  // canal G = rugosidad
 *       material.aoMap = t.rugosidadOclusion;          // canal R = oclusión
 *       material.roughness = 1;   // con mapa, el escalar sólo multiplicaría
 *       // Convención ORM de glTF. `aoMap` usa el atributo `uv` (canal 0) en
 *       // three 0.169: no hace falta duplicar nada en `uv1`.
```

## 2 · `cargarAtlasFauna()` no fija `anisotropy`

Lo resolví del lado de `Fauna.js` (8, el mismo valor que el follaje de
`Vegetacion.js:993`; el razonamiento del número está en `r3-fauna.md`, D5). Queda
sólo como observación: si `flora` termina queriendo otro valor para su propio
atlas, el lugar natural sería un parámetro del cargador y no dos decisiones
sueltas en dos archivos.

## 3 · El manifiesto no declara la **orientación** de sus bandas, y eso cuesta

`manifiesto.convencion` describe qué hay en cada tramo de V —cabeza, dorso,
vientre, cola— pero da por sentado que V corre **a lo largo** del animal, que es
lo que hacía la UV por defecto de `SphereGeometry`. La fase 2 rehizo la
geometría y eligió **V dorsoventral** (motivo completo en `r3-fauna.md`, D6): con
eso el contrasombreado `colorDorso`/`colorVientre` cae bien en las 44 especies,
que es un dato real por especie.

El precio es concreto y conviene que quede escrito para no volver a pagarlo: el
patrón que el horno dibuja como franja a **`u` constante** ya no corre a lo largo
del lomo. **El zorrino patagónico pierde sus dos franjas dorsales** y le quedan
dos cinturones alrededor del cuerpo.

Lo que haría falta del lado del horno, para la ronda que viene:

- que `pelajes.json` (o el manifiesto) declare por especie si el patrón es
  **longitudinal** o **transversal**, y que el horno lo dibuje sobre el eje que
  corresponda dentro de la banda;
- o, más simple y probablemente mejor, que el manifiesto agregue un campo
  `orientacionV: "dorsoventral"` para que el acuerdo entre las dos fases esté
  escrito en el archivo y no en dos bitácoras.

## 4 · Menor, ya anotado por `horno`

`atlas.js:141` imprime `[object Object]` cuando falta un PNG, porque el evento de
error de `TextureLoader` no tiene `.message`. Cosmético; no afecta la
degradación, que verifiqué que funciona.
