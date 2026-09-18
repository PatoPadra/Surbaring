# Pendiente de `brasa` — ronda 7, fase 2

`main.js`, `Cuerpo.js` y `Herramientas3D.js` no son míos: son **cuatro parches**
contra el árbol de `96dc0bf` (los números de línea son de ese árbol). Nada de esto
se vio corriendo en el navegador. **No hace falta precompilar nada en la carga**:
la llama comparte programa con las piedras (`r7-brasa-claves.mjs`, una sola clave
entre las 25 mallas de seis hornos).

| parche | archivo | para qué | sin él |
|---|---|---|---|
| **1** | `main.js` | B4: la fogata baja de 20 a 1 al sol | **B4 rojo: +40 a +51 al mediodía** (predicción) |
| 2 | `main.js` | la antorcha baja al sol igual | la antorcha al mediodía suma +28,7 a 2 m (hoy +4,1); el banco no lo mide |
| 3 | `Herramientas3D.js`, `Cuerpo.js`, `main.js` | B5: la llama del modelo sólo con la luz prendida | una antorcha apagada en la mano sigue mostrando la llama |
| 4 | `main.js` | `conCSM` idempotente | nada se rompe hoy: `Hornos.js` ya se defiende solo |

---

## 1 · La luz del fuego sabe la hora — `main.js:753`, dentro de `juntarLuces`

`Hornos.fuentesDeLuz(senoSol)` recibe el seno de la altura del sol y, sin él,
devuelve la luz de noche (20). `cielo` está en el mismo alcance (`main.js:137`), y
`public/banco.js:83` actualiza `cielo.direccionSol` al cambiar la fecha, así que el
banco del navegador lo recibe bien.

```diff
     cuerpo.enMano = equipo.enRanura('mano')?.id ?? null;
-    const fuentes = hornos.fuentesDeLuz();
+    // Con la altura del sol el fuego baja de 20 a 1 de día: la adaptación del ojo
+    // que la exposición no hace (ver `Hornos.luzDeFuegoSegunSol`).
+    const fuentes = hornos.fuentesDeLuz(cielo.direccionSol.y);
     const incendio = clima.fuenteDeLuz?.();
```

## 2 · La antorcha al sol — `main.js:41` y `:758`

`LLAMAS.antorcha` pasó de 2,0 a 14. `fuenteDeMano()` no sabe la hora y no es de la
tabla, así que el factor se aplica donde se juntan las luces.

```diff
-import { Hornos } from './world/Hornos.js';
+import { Hornos, luzDeFuegoSegunSol } from './world/Hornos.js';
```

```diff
     const enMano = fuenteDeMano(equipo.luzActiva(tiempo.fecha.getTime(), est),
       jugador, camara, tiempo.segundosTotales);
     if (enMano) {
+      // Al sol una antorcha no alumbra nada que se vea, igual que la fogata
+      enMano.intensidad *= luzDeFuegoSegunSol(cielo.direccionSol.y);
       // La llama sale de la punta del modelo, no de la cuenta aproximada de la
```

## 3 · B5: la llama del modelo sólo con la luz prendida

**Qué es el triángulo amarillo** (medido en `r7-brasa.md`, sección B5): la llama
del modelo de la antorcha. `PALETA.llama` es emisiva (0xff7a22 × 1,5), la malla se
crea siempre y `juntarLuces` cuelga el modelo con `equipo.enRanura('mano')`, esté
prendida o no. La cadena modelada da 244·177·53 donde la captura tiene 241·171·50;
una hoja de pasto con albedo 1 de frente a la fogata no pasa de 230·110·21.
Esconder una malla no compila nada.

### `src/entities/Herramientas3D.js:449-458` y `:484`

```diff
+  let llama = null;
   for (const nombre of Object.keys(piezas)) {
     const geo = fusionar(piezas[nombre]);
     const malla = new THREE.Mesh(geo, tinta(nombre));
     malla.castShadow = true;
     // `receiveShadow` queda en false a propósito: las mallas del cuerpo tampoco
     // lo activan, y es uno de los parámetros que entran en la clave del programa.
     grupo.add(malla);
+    if (nombre === 'llama') llama = malla;
     triangulos += triangulosDe(geo);
     dibujos++;
   }
```

```diff
   grupo.punta = nudoPunta;
+  // La malla de la llama, o null. `Cuerpo` la esconde mientras la luz está
+  // apagada: el emisivo brilla aunque no haya fuego (ronda 7, B5).
+  grupo.llama = llama;
   return grupo;
```

### `src/entities/Cuerpo.js:612-615`

```diff
     if (!modelo) return;
     mano.add(modelo);
     this._modeloEnMano = modelo;
+    if (modelo.llama) modelo.llama.visible = !!this._llamaEncendida;
   }
+
+  /**
+   * Si lo que está en la mano está prendido. Una antorcha guardada y apagada
+   * mostraba la llama igual, porque su material es emisivo (ronda 7, B5).
+   * Esconder la malla no toca la clave del programa.
+   */
+  set llamaEncendida(v) {
+    this._llamaEncendida = !!v;
+    const llama = this._modeloEnMano?.llama;
+    if (llama) llama.visible = this._llamaEncendida;
+  }
+
+  get llamaEncendida() { return !!this._llamaEncendida; }
```

### `src/main.js:756-758`, dentro de `juntarLuces`

```diff
     const enMano = fuenteDeMano(equipo.luzActiva(tiempo.fecha.getTime(), est),
       jugador, camara, tiempo.segundosTotales);
+    cuerpo.llamaEncendida = !!enMano;
     if (enMano) {
```

## 4 · `conCSM` idempotente — `main.js:1007`

**Hallazgos 1 y 2 de `r7-brasa.md`.** `conCSM` arma la clave nueva encima de la
vieja, así que un material que pasa dos veces queda con otra clave y compila otro
programa. Pasaba con cualquier material repetido dentro de un nodo que
`dibujarHorno` o `dibujarObra` recorren entero: en la base, **el primer horno de
barro y la primera fragua compilaban un programa cada uno** (sus dos mallas
compartían material), y un material de llama compartido entre hornos habría
compilado en la segunda fogata. `Hornos.js` ya lo esquiva por su lado (`clone()` en
las piedras y `envolverUnaVez()` en lo que arde); esto lo arregla para todos, y con
esto lo de `Hornos.js` sobra y no molesta. Revisé las llamadas (`:169, :230, :237,
:414, :419, :598`): todas registran un material recién creado, ninguna re-envuelve
a propósito.

```diff
+/** Lo que ya pasó por `conCSM`. Envolver dos veces le cambia la clave al programa. */
+const envueltosCSM = new WeakSet();
+
 function conCSM(csm, material) {
+  // Dos vueltas arman la clave nueva sobre la vieja y compilan otro programa: le
+  // pasaba a todo material repetido dentro de un nodo que se recorre entero.
+  if (envueltosCSM.has(material)) return;
+  envueltosCSM.add(material);
   const propio = material.onBeforeCompile;
```
