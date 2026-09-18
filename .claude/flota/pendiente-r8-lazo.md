# Pendiente · ronda 8, fase 2 · `lazo`

Lo que la fase necesita fuera de sus archivos. Lo único que bloquea que se vea en el
juego es el punto 1: sin él `Trampas` y `Trampas3D` no existen en `main.js`, y el
botón «Poner» del bolso no aparece (lo muestra sólo si `bolso.trampas` está).

## 1 · `main.js`: crear, cablear y llamar (bloquea)

```js
import { Trampas } from './systems/Trampas.js';
import { Trampas3D } from './world/Trampas3D.js';

// Después de `const fabricacion = …` (línea ~379), con bichos, peces, pesca, caza,
// norma, hud, equipo, inventario, tiempo, jugador y herramientas ya armados, y ANTES
// de `new Partida(…)`:
const trampas = new Trampas({
  mundo, fauna: bichos, peces, pesca, inventario, equipo, caza, norma, hud, tiempo, jugador,
  objetos: herramientas.objetos,
});
const trampas3D = new Trampas3D(trampas);
// Antes del primer cuadro, como el terreno y las obras: así el programa que compila
// la muestra (ver la cabecera de Trampas3D.js) ya es el de las cascadas. Si se hace
// más tarde también anda —conCSM pone needsUpdate y la muestra recompila en el
// cuadro siguiente—, pero ese tirón cae donde caiga.
for (const m of trampas3D.materiales) conCSM(csm, m);
escena.add(trampas3D.grupo);

recoleccion.trampas = trampas;   // la tecla E: revisar o levantar
bolso.trampas = trampas;         // el botón «Poner» (el bolso se arma en la línea ~409)
hallazgos.trampas = trampas;     // el mapa y el minimapa

// En `new Partida({ … })` (línea ~436), una dependencia más:
//   jugador, inventario, …, equipo, trampas,
// (o `partida.trampas = trampas;` antes de `partida.cargar()`, línea ~627)

// En cuadro(), después del bucle de paso fijo (tiempo.avanzar ya corrió):
trampas.actualizar();
trampas3D.sincronizar();

// Y en window.SurviBar: trampas, trampas3D   (los usa la mitad navegador)
```

Qué cuesta cada llamada, medido en Node (cota, no la placa):

- `trampas.actualizar()` con el reloj quieto no hace nada. A 72× y 60 cuadros, un cuadro
  son 1,2 s del mundo: por trampa, uno o dos minutos de integración. `_aptitud` se
  pregunta una vez por trampa y por estación, no por cuadro. **22,6 µs por cuadro con
  diez lazos vacíos** (20 000 cuadros seguidos, `performance.now()`); antes de guardar
  los pesos por trampa eran 152 µs. La sección 3 del banco (cuatro corridas de 6000
  lazos por diez horas, y 2000 nasas) corre en 2,2 s con la carga de módulos.
- `trampas3D.sincronizar()` con 50 trampas y sin cambios: **2,0 µs por llamada**
  (20 000 llamadas, `performance.now()`). No reserva nada. Hace falta llamarla en el
  bucle sólo por una razón: la mitad navegador (W4) vacía `trampas.lista` a mano, sin
  pasar por `poner`/`levantar`, y los modelos de esas trampas quedarían en la escena
  hasta el próximo cambio. Todo lo que pasa por la API ya avisa solo (`trampas.oyentes`).

La muerte no toca nada: lo puesto en el mundo no es del bolso, y `Partida.registrarMuerte`
vacía sólo el inventario.

## 2 · La muestra de `Trampas3D` (para quien mida W1)

`Trampas3D` agrega a su grupo cuatro mallas diminutas a 100 km bajo el suelo, con
`frustumCulled = false` y un solo material con color por vértice para las tres trampas.
Una queda siempre (una llamada de dibujo por pase, sin píxeles: más allá del plano lejano
de 90 km) y las otras tres se apagan después de su primer dibujo. Es lo que hace que
poner la primera trampa no compile: el programa existe desde el primer cuadro y se
recompila junto con todos cuando la calidad cambia el tipo de sombra. **Espero un
programa más que en la ronda 7 al cargar (17 → 18 con el mismo cuadro), y ninguno al
poner.** La llamada de dibujo de más no está medida en la placa.

## 3 · Lo que espero de la mitad navegador, y de dónde sale

- **W1**: N → N al poner el primer lazo. Con el mismo cuadro que la ronda 7, N = 18 (los
  17 de entonces y el de las trampas, que compila la muestra al cargar). No medido.
- **W2**: el lazo cubre entre el 0,44 % y el 0,72 % de la pantalla desde la cámara de W2,
  según el giro (rasterizado por software en Node a 1024×576 y 1024×768, sin luz ni
  fondo). Lo que pase el umbral de 24 contra el suelo es menos que eso; espero entre
  0,3 y 0,6 %, contra el 0,2 % que pide.
- **W3**: el glifo del lazo es un aro de 3,2 px de radio con 3,2 px de trazo y una cola; la
  flecha del jugador tapa el centro, pero el aro sale por los costados. Espero 20 a 40
  píxeles cambiados, contra 6.
- **W4**: corrí el W4 paso por paso en Node, con los módulos de verdad sobre el DEM de
  verdad, las mismas semillas (31 y 32) y el mismo orden: **300 noches, 101 con presa
  (33,7 %), 26 o 27 liebres (26 % de lo que cae)**, después zorro gris chico 19 %, zorrino
  16 %, gato huiña 10 %. El giro del jugador corre el lazo 0,9 m y cambia una liebre. Lo
  esperado sin azar, con la fórmula, es 29,7 % y 33 %: la muestra de 300 cae a 1,5 σ.

## 4 · Los bancos (no es código mío; va con la cuenta en el informe)

- `banco-r8-fase2.mjs`, sección 4, «la segunda vez se anota»: pedía que ninguna llamada
  nueva a la norma fuera 'grave', y eso obligaba a anotar como «leve» algo que no lo es.
  **Corregido por el coordinador**: ahora sólo prohíbe `mostrar()` con 'grave'. La
  segunda vez va por `norma.anotar(v, ctx)` con el veredicto grave de verdad, y el
  registro ya no miente.
- `banco-r8-fase2.navegador.js`, W1: si el bolso de la vista previa está lleno de
  casilleros, `equipo.guardar('trampa_lazo')` falla y `poner` dice «No tenés trampa de
  lazo en el bolso»: la premisa cae por el bolso, no por la trampa. W4 lo mismo con
  `puestas >= 250`.
- W4 vacía `T.lista` a mano y la vuelve a llenar: ver el punto 1, `sincronizar()` en el
  bucle.
