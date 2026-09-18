# Pendiente · ronda 7, fase 5 · `witral`

Lo que la fase necesita y está en archivos que no son míos. Cada pedido dice qué,
dónde y por qué. Mientras tanto la fase anda sin esto: nada de lo que sigue es
necesario para el banco.

## 1 · `historia.json`, tecnología `telar_witral`: que no cobre lana

**Qué.** `materiales` pasa de `madera 4 · lana 6` a `madera 4`, o a `madera 4 · cordel 2`
si se quiere que aprender cueste algo de las manos. **Que no pida `hilado`:** el huso
y la receta de hilar cuelgan de esta misma tecnología, y pedir hilado para aprenderla
sería un bloqueo circular.

**Por qué.** `Saberes.desbloquear()` consume esos materiales. Hoy las 6 lanas del nodo
son la tercera parte de toda la lana de la cadena, y no van a ningún lado:
- el marco lo paga la obra `telar_witral` (madera 6, cordel 4);
- el hilo lo paga el poncho (9 hilado, que son 12 lana).

**La cuenta de W4** (apretadas = T/p y kg = 0,1·T/p, con p = 2/3):
- con el nodo como está, T = 18: **27 apretadas y 2,7 kg**; el margen contra los
  3 kg es del 10 %;
- sin la lana del nodo, T = 12: **18 apretadas y 1,8 kg**; el margen es del 40 %.

## 2 · `historia.json`, tecnología `telar_witral`: la descripción

**Hoy dice:** «Telar vertical de dos lizos para tejer con lana de oveja hilada y teñida
con plantas.»

**Qué está bien:** para la era del nodo (contacto colonial) es verdad. La oveja llegó al
noroeste de la Patagonia a comienzos del siglo XVII y su lana prevaleció sobre el
pelo de camélido (Méndez, 2009, AIBR 4(1), § 3.1). El teñido con plantas también
(§ 3.4).

**Qué está mal o no se pudo verificar:**
- En el juego no hay ovejas: la lana es de guanaco, por la licencia `lanaDelCoiron`.
- «De dos lizos» no lo pude sostener. Méndez describe una sola serie de lizos atados
  a un tonon, más un separador.

**Propuesta:** «Telar vertical de cuatro palos —dos parantes y dos travesaños— con
separador, lizos y tonon. En la región se tejió primero con pelo de camélido y, desde
el siglo XVII, sobre todo con lana de oveja hilada en huso y teñida con plantas.»

**Opcional:** `efecto.herramienta` podría listar también `huso` e `hilar_lana`. No lo
lee ningún código, así que es sólo para que el dato diga la verdad.

## 3 · `Fundicion.js`: el radio de las estaciones, en un solo lugar

**Qué.** Exportar `RADIO_HORNO_M`, o que `cercano(radio, filtro)` acepte un filtro por
id.

**Por qué.** `Fabricacion._estacionDeObra()` no puede usar `cercano()`, que devuelve
un solo horno, y hoy repite los 8 m como `RADIO_ESTACION_M`. Si uno cambia, cambian
los dos.

**Deuda de la misma trampa, que no toqué.** `Fabricacion.estacion()` con
`donde: 'fragua'` sigue preguntando si el horno MÁS cercano es la fragua. Con una
fogata a 2 m y la fragua a 5 m, el hierro dice «Hace falta estar al lado de: Fragua».
El encargo pedía que la fogata y la fragua siguieran exactamente igual, y siguen igual.

## 4 · `herramientas.json`, `fuentesFaltantes`: la entrada `lana` quedó vieja

Dice «No lo produce nada en ningún dataset del juego». Lo produce el coirón desde
antes de esta fase, y ahora además se hila. No es de mi tramo del archivo (poncho,
huso, receta, licencia).

## 5 · Propuesta, no pedido: el vellón por mata, sin fibra

Es lo que sugirió el coordinador y lo más honesto físicamente, porque sacar vellón no
arranca la mata. Lo diseñé y no lo hice. Los números están en la bitácora.

**Cómo sería:**
- una fracción de los coirones lleva vellón, fijada por lugar con `_azarDelLugar()`
  como la carroña;
- el cartel dice «Sacar el vellón del coirón (1 × lana)» y no entra fibra;
- dejo el 16 % que ya tenía el juego.

**Qué haría falta, y por qué no entró:**
- **`banco-r7-fase1.mjs`, caso «coirón» (línea 507).** Pone un coirón en (1,5; 0) y
  pide que prometa lana. `_azarDelLugar(1.5, 0)` da **0,626**: con el 16 % ese
  coirón no tiene vellón y el banco se pone rojo por diseño. Habría que cambiar el
  caso para que acepte «el coirón con vellón promete lana, el que no, no».
- **`Recoleccion._delSuelo()`.** A igual `VALE`, el coirón con vellón tendría que
  ganarle al coirón sin vellón. Si no, el instrumento de W4 mide T apretadas y 0 kg,
  y el jugador parado paga T/0,16 apretadas y 0,1·T·0,84/0,16 kg: con T = 18, 112
  apretadas y 9,4 kg. No es «lo que da el coirón», así que no lo toqué.

**Cómo daría W4 con esas dos cosas:** con T = 18, **18 apretadas y 0 kg**; con T = 12,
12 y 0.

## 6 · `Taller.js` (y un aviso de `main.js`): el telar le tapa el fuego a la fogata

**Qué pasa.** `Taller.pintar()` elige «el horno que tengo al lado» con
`fundicion.cercano()`, que devuelve un solo horno: el más cercano. Los botones
`encender`, `cocinar` y `retirar` (`Taller.js`, líneas 115-124) usan lo mismo. El
contrato pide que el telar tenga `procesa`, así que queda anotado como horno. Un
campamento pone el telar al lado de la fogata. **Parado más cerca del telar que de la
fogata, el taller muestra las hornadas del telar (vacías), no muestra «Fuego ·
Fogata», y «encender» apunta al telar**, que no quema. Hay que dar un paso hacia la
fogata para poder prenderla.

Es la misma trampa que la del poncho (W2), del lado del taller. Ya existía con el
aserradero y el ahumadero, pero ésos son permanentes y fuera del área protegida: no se
arman al lado de una fogata de campamento en la Reserva. El telar sí.

**En `main.js`, línea 923,** el aviso «Estás perdiendo calor» usa `fundicion.cercano(20)`.
Con el telar más cerca que la fogata apagada, dice «Tenés para una fogata: armala» en
vez de «tenés la fogata apagada acá al lado». Sólo cambia la frase: el calor del cuerpo
sale de `fuegoCercano()`, no de acá.

**Qué propongo.** Que el taller y ese aviso busquen el horno más cercano **que tenga
algo para mostrar**: con fuego (`usaFuego`) o con recetas (`recetasDe(id).length`). Si
se prefiere una sola puerta, que `Fundicion.cercano(radio, filtro)` acepte el filtro
del punto 3. El telar no tiene recetas propias —el poncho se teje desde el bolso al
lado del telar—, así que no le quita nada al taller.
