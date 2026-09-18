# El primer año — propuesta escrita (ronda 8)

> Pedido del dueño el 18/9/2026 (nota 5): *«uno de los limitantes que tengo con el
> juego es pensar la trama/objetivo, se me ocurrió uno que puede ser cumplir el primer
> año de supervivencia, que el juego arranque en primavera y que uno de los primeros
> desafíos de verdad verdadera sea pasar el invierno con un buen refugio»*, y antes:
> *«enfocarse en la primera hora real de vida puede ser un buen objetivo»*.
>
> Contestó que quería **una propuesta escrita, sin tocar código de esto**. Es lo que
> sigue: lo que hay, medido, y las decisiones que le tocan, como preguntas.

---

## 1 · Lo que ya existe: el año del cuaderno

**El juego ya tiene un arco de un año** (`src/systems/Relevamiento.js`): cuenta 365
días de juego desde la primera partida, lo muestra en el códice («Día N de 365»), se
guarda aparte y **no se reinicia al morir**. Cumplirlo avisa una vez y no termina el
juego. El marco es el de un **relevamiento** —recorrer, identificar, anotar, como
Moreno en 1876—, no el de sobrevivir.

O sea que la idea del dueño no necesita un sistema nuevo: **cambia el sentido del año
que ya está**, de «describir el parque» a «vivir un año en él», y agrega hitos que hoy
no existen. Las dos cosas pueden convivir: el cuaderno sigue siendo el registro de ese
año.

## 2 · El reloj, medido en el código

| | valor | de dónde |
|---|---|---|
| velocidad del mundo por defecto | **72×**: un día de juego = **20 minutos reales** | `Tiempo.js:62`, `VELOCIDADES = [24, 72, 900, 7200]` |
| el cuerpo envejece a | **24×** (aparte del reloj): la sed llena dura ~50 min caminando, el hambre más de 1 h | `main.js:711`, `ESCALA_METABOLISMO` |
| la primera hora real | **3 días de juego**, con **tres noches** de ~8 minutos cada una | |
| un año a 72× | **121,7 horas reales** | 365 × 20 min |
| un año a 900× | 9,7 horas reales | |
| hoy se arranca | **12 de febrero, 10:20** (verano) | `Tiempo.js:69` |
| la primera noche llega | a los **~8 minutos** de juego (de las 10:20 a las 20:00 son 9,67 h de juego: 9,67 × 3600 / 72 = 483 s) | |

## 3 · El clima de Bariloche que ya simula el juego

`Tiempo.js`, `CLIMATOLOGIA` (medias mensuales):

| | sep | oct | nov | dic–feb | mar | abr | may | **jun** | **jul** | **ago** |
|---|---|---|---|---|---|---|---|---|---|---|
| máxima °C | 11,4 | 15,0 | 18,2 | 20,7–22,0 | 18,9 | 14,5 | 10,2 | **7,3** | **6,8** | **8,6** |
| mínima °C | 0,2 | 2,3 | 4,1 | 5,6–6,6 | 4,9 | 2,9 | 1,0 | **−1,0** | **−1,6** | **−1,2** |
| lluvia mm | 65 | 46 | 34 | 22–30 | 33 | 61 | 130 | **148** | **138** | **108** |

**El invierno ya es un desafío en el modelo del cuerpo** (`Jugador.js:643-700`): el
viento resta hasta 11 °C de sensación, mojarse triplica la velocidad de enfriamiento,
un refugio corta el 85 % del viento y suma 10 °C, y el fuego suma 14. **Una noche de
julio a la intemperie, con lluvia, es hipotermia** en minutos. Lo que falta no es el
frío: es que el juego lo **anuncie como la meta**.

## 4 · La primera hora de hoy

Con arranque en verano, a 72×:

1. **Minuto 0.** Se puede fabricar, sin tecnología, **cordel, garrote y antorcha**
   (`herramientas.json`, nivel 0). Todo lo demás pide una tecnología.
2. **Minuto ~8: la primera noche.** Incluso en febrero, a 822 m y con 22 km/h de
   viento, la mínima de 6,3 °C da una sensación cercana a 0 °C: sin fuego ni abrigo,
   el cuerpo tiende a unos 34,9 °C, debajo del umbral de daño. **La primera noche ya
   pide fuego o parapeto**, y el juego no lo dice antes de que pase.
3. **Minuto ~50:** la sed.
4. **El hacha de piedra** sale de un paso: 2 piedras, un mango y 4 tientos, con la
   tecnología `hacha_pulida` (fase 5 de esta ronda: el paso a paso de la piedra).

## 5 · El problema de arrancar en primavera, en números

Si el juego arranca el **21 de septiembre**, el invierno (1 de junio) llega el **día
253**: a 72× son **84 horas reales de juego**. Es muy lejos para ser «uno de los
primeros desafíos». Tres maneras de acercarlo, con sus números:

| opción | cuándo llega el invierno | qué cambia |
|---|---|---|
| **A · Arrancar en primavera y dejar el reloj** | día 253 · 84 h reales | la primavera es fría de noche (0 °C en septiembre): el primer desafío real es la primera noche, y el invierno es el final |
| **B · Arrancar en otoño (21 de marzo)** | día 72 · **24 h reales** | el año arranca con el frío acercándose: juntar, abrigarse y guardar comida tiene apuro desde el día uno. El año cierra en otoño otra vez |
| **C · Primavera, con un reloj más rápido** | día 253 · **21 h** a 288× (un día = 5 min) | todo pasa cuatro veces más rápido: una noche de 10 h dura unos 2 minutos (36.000 s / 288 = 125 s). Afecta a todo el juego, no sólo al año |

Y una cuarta que no es de reloj: **D · dormir.** Con un refugio y fuego, poder pasar la
noche durmiendo (adelantar el reloj) acorta el año sin apurar el día. Es lo que hacen
casi todos los juegos de supervivencia, y en éste tiene sentido: dormir a la
intemperie en julio es la muerte, y ésa es la lección.

## 6 · Una forma de convertir el año en supervivencia

Hitos que salen de lo que el juego ya simula, sin inventar una trama. Cada uno se
anota en el cuaderno cuando se cumple:

1. **La primera noche**: fuego o parapeto antes de que oscurezca. El juego lo anuncia
   a la tarde («se viene la noche: sin fuego ni reparo, a 6 °C y con viento…»).
2. **La primera semana**: un refugio que abrigue (el vivac o la ruca de
   `construccion.json`) y agua que viaje (el metawe).
3. **El otoño**: juntar para el invierno —leña apilada, carne seca, el poncho o el
   quillango—. El juego puede medir cuántas noches de frío te alcanzan.
4. **El invierno**: pasar junio, julio y agosto con vida. **Es el desafío central.**
5. **El año**: el cuaderno se cierra, el juego sigue.

## 7 · Lo que cambiaría en el código (para cuando se decida)

- `Tiempo.js:69` — la fecha de arranque (una línea), sólo para partidas nuevas.
- `Relevamiento.js` — los hitos, y el texto del año como supervivencia.
- `Partida.js` — nada: la fecha ya se guarda.
- Un aviso de la tarde (`HUD` o `Eventos`) y, si se elige **D**, dormir.
- La ficha del códice que presenta el objetivo.

Nada de esto toca lo que hace esta ronda, y no se empezó.

---

## Las decisiones que te tocan, como preguntas

1. **¿En qué estación arranca una partida nueva?** Primavera como pediste (y el
   invierno queda a 84 h de juego), otoño (a 24 h), o primavera con otro reloj.
2. **¿Se puede dormir** con refugio y fuego para pasar la noche?
3. **¿El año de supervivencia reemplaza al año del cuaderno o lo acompaña?** (Hoy el
   año es de relevamiento; la propuesta es que sea los dos.)
4. **¿Qué pasa al cumplir el año?** Hoy avisa y se sigue jugando. ¿Alcanza, o tiene
   que haber un cierre con lo que se hizo?
5. **¿Morir en el año reinicia la cuenta?** Hoy el cuaderno sobrevive a la muerte. Para
   un «primer año de supervivencia», ¿morir lo vuelve a empezar?
