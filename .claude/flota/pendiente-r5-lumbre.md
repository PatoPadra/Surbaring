# Pendiente de lumbre — cableado de la fase 1 en `src/main.js`

`main.js` es del jefe: `lumbre` no lo toca. Son **seis parches** contra el
`main.js` de `b04a424` (los números de línea son de ese archivo). Todo lo que
cablean está probado en Node en `.claude/flota/.tmp-lumbre/` y anotado en
`r5-lumbre.md`; **nada de esto se vio corriendo en el navegador**.

Sin aplicar nada, el juego ya no tiene luces de three (se sacaron de
`Hornos.js` y `Clima.js`), así que **hasta aplicar los parches 1, 2 y 5 las
fogatas y el incendio no alumbran**. El guardado del equipo (`Partida`) y el botón
del bolso sí andan sin parche: encuentran el equipo por `recoleccion.equipo` y el
reloj por `fabricacion.fundicion.tiempo`.

---

## 1 · Import — después de la línea 51

```diff
 import { Calidad, detectarPlaca } from './engine/Calidad.js';
+import { instalarLuces, fuenteDeMano, radioDeLuzEn } from './engine/Luces.js';
 import { Exploracion } from './systems/Exploracion.js';
```

## 2 · Instalar y enganchar — DESPUÉS de `new CSM(...)`, antes de `conCSM` (líneas 152-154)

**El orden es la corrección del jefe del 11/9 y no es negociable.**
`new CSM()` llama a `injectInclude()` en su constructor (`CSM.js:50`), que
REEMPLAZA `lights_fragment_begin` y `lights_pars_begin` por los de
`CSMShader.js` (`CSM.js:248-249`). Si las luces se instalan antes, el bloque
desaparece y la luz no llega a ningún píxel sin un solo error. Y tiene que ser
antes del primer render: para los materiales de three la clave del programa es
el `shaderID` (`WebGLPrograms.getProgramCacheKey`), así que lo que compile antes
se reusa sin el bloque. Entre la línea 143 y `new Vegetacion` (línea 211, que
hornea impostores) no hay ningún render.

```diff
     lightIntensity: 0,   // la intensidad la maneja el sol del cielo
   });
   csm.fade = true;
+  // Las dos luces puntuales propias: lo que se lleva en la mano y el fuego más
+  // cercano. DESPUÉS del CSM, que pisa los chunks de luz en su constructor; y
+  // antes del primer render, porque three reusa programas por `shaderID`.
+  // Cambiar la cantidad de luces de three recompila todo y congela el juego
+  // ~19 s en la HD 4000: éstas se compilan una vez y nunca más (RONDA5.md).
+  const luces = instalarLuces(THREE);
+  luces.enganchar(escena);
   conCSM(csm, terreno.material);
```

`luces.enganchar(escena)` pone `escena.onBeforeRender`/`onAfterRender`. El primer
`onBeforeRender` llama solo a `luces.verificar()`: si alguien pisó los chunks
después (otro `new CSM`), sale **un** `console.warn` en el primer cuadro.

## 3 · Aviso cuando una luz se apaga sola — después de la línea 274

```diff
   const equipo = new Equipo(herramientas, { inventario });
+  // Una luz que se consume, que apaga la lluvia o que se suelta para agarrar
+  // otra cosa lo dice. Apagarla a mano desde el bolso no avisa: ya lo sabe.
+  equipo.alApagarse = (a) => hud.aviso(a.titulo, a.detalle);
```

(`hud` existe desde la línea 269.)

## 4 · El reloj al bolso y el equipo a la partida — líneas 378 y 405-407

```diff
-  const bolso = new Bolso({ inventario, jugador, hud, recoleccion, equipo, fabricacion });
+  const bolso = new Bolso({ inventario, jugador, hud, recoleccion, equipo, fabricacion, tiempo });
```

```diff
   const partida = new Partida({
     jugador, inventario, saberes, codice, construccion, fundicion, tiempo,
-    mundo, hud, exploracion, recoleccion,
+    mundo, hud, exploracion, recoleccion, equipo,
     obras: { agregar: dibujarObra },
```

Los dos andan sin esto (ver arriba), pero con esto no dependen de un rodeo.

## 5 · Por cuadro: juntar fuentes, elegir y pasarle la luz a la exploración — entre las líneas 892 y 894

Va justo antes del espejo del lago, cuando ya están puestos la cámara del jugador
(`jugador.actualizar`), los hornos (`hornos.actualizar`, línea 820) y el incendio
(`clima.actualizar`, línea 787). Tiene que ser antes de `agua.dibujarReflejo`
porque ese render ya usa las luces.

```diff
     // El domo del cielo acompaña a la cámara
     cielo.malla.position.copy(camara.position);
 
+    // ── Luces: la de la mano, los hornos que arden y el incendio. `asignar`
+    // elige dos —la mano primero— y cada render las escribe en el espacio de
+    // vista de su propia cámara, el espejo del lago incluido. `luzActiva` es
+    // también el reloj de la llama: acá se consume y acá la apaga la lluvia.
+    const fuentesLuz = hornos.fuentesDeLuz();
+    const incendio = clima.fuenteDeLuz?.();
+    if (incendio) fuentesLuz.push(incendio);
+    const enMano = fuenteDeMano(equipo.luzActiva(tiempo.fecha.getTime(), est),
+      jugador, camara, tiempo.segundosTotales);
+    if (enMano) fuentesLuz.push(enMano);
+    luces.asignar(fuentesLuz, camara.position);
+    // La mitad jugable: de noche, con luz, el mapa cuenta 300 m; a oscuras, 220
+    exploracion.luzM = radioDeLuzEn(fuentesLuz, jugador.posicion);
+
     // El espejo del lago se dibuja antes del pase principal: necesita la escena
     // ya actualizada y la superficie del agua todavía sin dibujar.
     agua.dibujarReflejo(render, escena, camara);
```

`exploracion.revisar()` (línea 761) lee `luzM` del cuadro anterior: corre cada
0,4 s, así que un cuadro de atraso no cambia nada.

**Resuelto por el jefe el 11/9:** los topes nocturnos son 220 a oscuras y 300 con
luz. Con celdas de 256 m, 300 abre las cuatro vecinas (nitidez 104) y 220 deja
sólo la que se pisa. Ver «PROBLEMA DEL CONTRATO — RESUELTO» en `r5-lumbre.md`.

## 6 · Exponer para medir — línea 923

```diff
     eventos, clima, oclusion, color, calidad,
-    exploracion, hallazgos, mapa, bolso, opciones, fin, partida, norma, relevamiento, cierre,
+    exploracion, hallazgos, mapa, bolso, opciones, fin, partida, norma, relevamiento, cierre,
+    luces,
   };
```

Para el banco en la vista previa: `SurviBar.luces.activas`,
`SurviBar.luces.instalada`, `SurviBar.luces.elegidas` y los arreglos
`SurviBar.luces.posiciones` / `.colores` (el `colores[3]` es la cantidad, y
vuelve a 0 después de cada render: leerlo desde afuera del render da 0 siempre,
eso no es un defecto).

---

## Cómo comprobarlo en la vista previa (lo corre el jefe)

- `SurviBar.luces.instalada` → `true` después de la carga (mira que
  `lights_fragment_begin` y `lights_pars_begin` vivos contengan `uLucesPos`; en la
  página `THREE` no es global). Si da `false`, el parche 2 quedó antes del CSM, y
  la consola tiene el aviso de `verificar()` del primer cuadro.
- `render.info.programs.length` igual antes y después de: encender y apagar la
  antorcha desde el bolso, construir y prender una fogata, disparar un incendio
  (`SurviBar.eventos.disparar('incendio_forestal')`).
- Para forzar una antorcha sin fabricarla:
  `SurviBar.equipo.guardar('antorcha'); SurviBar.equipo.encender('antorcha', SurviBar.tiempo.fecha.getTime())`.
- Números para mirar en la captura, todos en una constante arriba de su archivo:
  llamas de mano en `Luces.js` (`LLAMAS`), brasa de los hornos en `Hornos.js`
  (`BRASA_*`), resplandor del incendio y tinte del humo en `Clima.js`
  (`RESPLANDOR_*`).
