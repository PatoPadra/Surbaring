# Pendiente — de **agua** para el coordinador

## URGENTE y ajeno: `src/world/Cielo.js` no compila y bloquea a TODA la flota

No es mi archivo (es de **luz**), así que no lo toco. Pero tumba la aplicación
entera: `window.SurviBar` no llega a existir, el juego no carga y **ningún
agente puede verificar nada**.

Error en consola, repetido:

```
Uncaught SyntaxError: Unexpected identifier 'betaR'
```

**Causa**: hay comillas invertidas (`` ` ``) dentro de comentarios GLSL que viven
dentro del literal de plantilla `const FRAG = /* glsl */` … `` ` ``
(líneas 425–617). Cada una de esas comillas **cierra el literal de JavaScript**,
y lo que sigue el motor lo lee como código.

Líneas ofensoras: **504, 518, 522, 530**.

**Arreglo**: sacarles las comillas invertidas a esos cuatro comentarios (poner el
identificador pelado, p. ej. `betaR / (betaR + betaM)` → `betaR / (betaR + betaM)`
sin comillas). Comprobación rápida de que no quedó ninguna:

```sh
grep -n '`' src/world/Cielo.js     # sólo deben quedar las de fuera de VERT/FRAG
```

Yo cometí exactamente el mismo error en `Agua.js` y lo arreglé así. **Vale como
trampa para el README**: una comilla invertida dentro de un comentario GLSL no da
error de shader, da error de *sintaxis de JavaScript*, y el síntoma es que el
juego entero deja de cargar por un comentario.

---

## Mío, y no urgente: el espejo del agua está apagado en la placa de destino

`src/engine/Calidad.js` define `reflejoAgua: 0` para los presets `baja` y
`mínima`. Esta máquina —que es la Intel HD 4000 de destino— corre `baja`.
Verificado en vivo: `uReflejo.value === null` y `uFuerzaReflejo === 0` en las
cuatro cotas.

**No pido que se encienda**: dibujar la escena dos veces es justo lo que esa
placa no aguanta, y la decisión del preset me parece correcta. Lo anoto porque
cambia qué hay que mirar: **el jugador de la placa de destino nunca ve el espejo
planar**, sólo el camino procedural. Todo lo que hice en `Agua.js` apunta a ese
camino, que era el que estaba sin trabajar.

No necesito ninguna línea de cableado en `main.js`.
