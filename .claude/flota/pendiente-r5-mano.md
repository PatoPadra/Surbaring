# Pendiente de `mano` (ronda 5, fase 3) — el cableado de `src/main.js`

`main.js` es del jefe. Acá va el parche exacto, con el texto tal cual. Son
**dos cambios**, los dos dentro de `cuadro()` / `juntarLuces()`, y ninguno toca
`Luces.js` ni `Equipo.js`.

Nada de esto es necesario para que el juego siga andando: sin el cableado,
`cuerpo.enMano` queda en `null` y todo se comporta exactamente como antes de la
fase 3. Lo que falta es que la herramienta aparezca y que la llama salga del
modelo.

---

## 1 · Escribir `cuerpo.enMano` por cuadro

**Dónde:** en `cuadro()`, justo antes de `cuerpo.actualizar(dt, jugador)`
(hoy `main.js:934`).

```js
    // El cuerpo se anima una vez por cuadro, no una por paso de física: la
    // caminata se lee con el cuadro que se dibuja, no con el que se simula.
    //
    // Y antes, lo que lleva en la mano. Escribir el mismo id no hace nada —el
    // accesor corta de entrada—, así que esto cuesta una comparación por cuadro
    // y sólo cuelga o descuelga un modelo cuando el jugador cambia de
    // herramienta.
    cuerpo.enMano = equipo.enRanura('mano')?.id ?? null;
    cuerpo.actualizar(dt, jugador);
```

**Y la misma línea como primera de `juntarLuces()`** (hoy `main.js:740-741`), por
si el banco o la captura la llaman fuera del bucle: escribirla dos veces por
cuadro es gratis, y así la llama nunca sale de una mano vacía.

```js
  function juntarLuces(est = eventos.aplicar(tiempo.estado())) {
    cuerpo.enMano = equipo.enRanura('mano')?.id ?? null;
    const fuentes = hornos.fuentesDeLuz();
```

## 2 · La llama sale de la punta del modelo, no de una cuenta

**Dónde:** en `juntarLuces()`, `main.js:744-746`.

```js
    const enMano = fuenteDeMano(equipo.luzActiva(tiempo.fecha.getTime(), est),
      jugador, camara, tiempo.segundosTotales);
    if (enMano) {
      // Fase 3: `fuenteDeMano` ya dejó el color, el radio y el parpadeo; el
      // PUNTO se lo pisa el modelo que está colgado de la mano derecha. Así la
      // llama se mece con el brazo, se agacha con el cuerpo y sale de donde se
      // la ve —la punta de la antorcha, el mechero del candil— en vez de un
      // punto calculado sobre la cámara.
      cuerpo.puntoDeMano(enMano);
      fuentes.push(enMano);
    }
```

`puntoDeMano` acepta un `Vector3` o cualquier `{x, y, z}`: `enMano` es un objeto
plano y se le reescriben las tres componentes **en el lugar**, sin reservar nada.
Y actualiza por su cuenta las matrices de los padres, así que da lo mismo que se
la llame antes o después del render.

`radioDeLuzEn(fuentes, jugador.posicion)`, dos líneas más abajo, queda igual y
pasa a leer el punto ya corregido.

---

## Lo que NO hace falta tocar

- **`Luces.js` no se toca.** `posicionDeMano()` sigue existiendo y sigue
  corriendo dentro de `fuenteDeMano`: su resultado se pisa. Son unas veinte
  operaciones de punto flotante por cuadro y sólo cuando hay una llama
  encendida. Si el jefe prefiere ahorrárselas, el cambio limpio sería que
  `fuenteDeMano` acepte el punto como argumento — **pero `Luces.js` es de
  `lumbre` y esta fase no lo edita**.
- **`Personaje.js` no se toca.** Su maniquí construye `Cuerpo` sin equipo:
  `enMano` queda en `null` y no se cuelga nada. Comprobado corriendo 90 cuadros
  del maniquí, con `aplicar()` y `destruir()` incluidos.

## Para mirar en la captura, que yo no puedo ver

1. **Primera persona.** El cuerpo ya se dibujaba en primera persona (sólo se le
   apaga la cabeza), así que ahora **la herramienta también se ve**, abajo a la
   derecha. Medido: con una antorcha, la llama queda a 0,29 m por debajo y
   0,35 m por delante del ojo, o sea bien lejos del plano cercano; pero una
   barreta llega a 1,69 m de alto y puede tapar parte de la vista. Si molesta,
   la decisión —esconderla en primera persona, o acortarla— es del dueño, y el
   cambio entra en `Cuerpo.js` con una línea.
2. **La intensidad de la llama.** La fase 1 dejó anotado que los números de
   `LLAMAS` se eligieron sin ver la captura nocturna. Ahora además hay un cono
   emisivo en la punta de la antorcha (`PALETA.llama`, emisivo `#ff7a22` a 1,5):
   si en la captura nocturna la llama se quema a blanco, lo que se baja es
   `emision` en `Herramientas3D.js`, no la luz.
3. **La llama subió.** Con la mano real y la pose de carga, la punta de la
   antorcha queda a **1,39 m** de alto; `posicionDeMano()` de la fase 1 la ponía
   a 1,12 m. Es 27 cm más arriba, así que el círculo iluminado en el suelo va a
   verse un poco más grande y más adelante.
