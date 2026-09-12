/**
 * BANCO DE LA FASE 1 (casillero) — ronda 6.
 *
 * Lo escribe el JEFE contra el contrato de RONDA6.md, en paralelo al agente y sin
 * leer su código. Corre el `Inventario` y la `Partida` de verdad en Node: los dos
 * módulos ya están escritos para poder construirse sin ventana ni documento.
 *
 *   1. LA API VIEJA — las diez funciones que usan 75 sitios de llamada en 16
 *      archivos conservan firma y semántica. Esta sección tiene que estar VERDE
 *      en la base: es la red que atrapa la regresión, no una medición nueva.
 *   2. LAS PILAS — `pilaDe` sale del peso por la escalera [1,2,5,10,20,50] con
 *      tope de 3 kg, es monótona, y no hay tabla de 71 renglones escondida.
 *   3. LOS DOS TOPES — `casillasPara(38) === 24`; la grilla muerde cuando sobra
 *      peso, y NO bloquea una carga mixta que llena los 38 kg.
 *   4. LA PILA ABIERTA Y LAS POSICIONES — se completa la pila antes de abrir
 *      casilla, y sacar de la casilla 2 no corre la 3.
 *   5. MOVER, PARTIR, JUNTAR — mueve, junta hasta el tope, intercambia, parte
 *      por la mitad, y el peso total no cambia nunca.
 *   6. EL GUARDADO — el formato viejo entra, el nuevo ida y vuelta, la muerte
 *      vacía, y `items` ya no existe.
 *   7. ARRANQUE — `vite build`.
 *
 * Guarda de cobertura: cada sección declara qué tenía que funcionar de verdad
 * para que sus aserciones signifiquen algo. Una sección donde el camino feliz no
 * pasó es ROJA aunque no falle ninguna aserción — si no entró nada al bolso,
 * «la grilla no se pasó de casillas» es cierto por vacío.
 *
 * Uso: node .claude/flota/banco-r6-fase1.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}`;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, desc, det) => { s.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** Un inventario nuevo, con la capacidad que se pida. */
async function nuevoInv(cap = 38) {
  const { Inventario } = await import(urlDe('systems/Inventario.js'));
  const inv = new Inventario(cap);
  inv.capacidadKg = cap;
  return inv;
}

/** Las fichas de verdad, ordenadas por peso. */
async function fichas() {
  const R = await import(urlDe('systems/Recursos.js'));
  return Object.entries(R.RECURSOS)
    .map(([id, r]) => ({ id, kg: r.kg ?? 0.5, cat: r.cat || 'material' }))
    .sort((a, b) => a.kg - b.kg);
}

const ESCALERA = [1, 2, 5, 10, 20, 50];
const TOPE_PILA_KG = 3;
/** Lo que el contrato dice que tiene que dar `pilaDe`, calculado acá aparte. */
function pilaEsperada(kg) {
  const crudo = TOPE_PILA_KG / kg;
  return ESCALERA.reduce((m, e) =>
    Math.abs(Math.log(e / crudo)) < Math.abs(Math.log(m / crudo)) ? e : m, ESCALERA[0]);
}
function casillasEsperadas(capacidadKg) {
  return 6 * Math.max(3, Math.round(capacidadKg * 0.63 / 6));
}

/** Un azar repetible: dos corridas del banco tienen que dar lo mismo. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// ── 1 · LA API VIEJA ────────────────────────────────────────────────────────

async function api() {
  const s = seccion(1, 'LA API VIEJA — los 75 sitios de llamada siguen andando');
  const inv = await nuevoInv(38);

  // Camino feliz: juntar tres maderas y que estén.
  const n0 = inv.agregar('madera_dura', 3);
  s.feliz = n0 === 3 && inv.cantidad('madera_dura') === 3;
  s.felizQue = `agregar 3 madera_dura con el bolso vacío devolvió ${n0} y quedaron ${inv.cantidad('madera_dura')}`;

  s.ok(typeof inv.agregar === 'function', 'existe agregar');
  s.ok(typeof inv.quitar === 'function', 'existe quitar');
  s.ok(typeof inv.cantidad === 'function', 'existe cantidad');
  s.ok(typeof inv.disponiblePara === 'function', 'existe disponiblePara');
  s.ok(typeof inv.consumirPara === 'function', 'existe consumirPara');
  s.ok(typeof inv.listar === 'function', 'existe listar');
  s.ok(typeof inv.comestibles === 'function', 'existe comestibles');

  s.ok(Math.abs(inv.pesoKg - 2.4) < 1e-6, 'pesoKg suma bien', inv.pesoKg);
  s.ok(inv.lleno === false, 'lleno es false con 2,4 de 38 kg');

  // `agregar` devuelve lo que entró de verdad, no lo que se pidió: es de lo que
  // dependen once de los doce sitios que agregan.
  const chico = await nuevoInv(1);
  const entro = chico.agregar('tronco', 3); // 6 kg cada uno en 1 kg de bolso
  s.ok(entro === 0, 'agregar devuelve 0 cuando no entra nada', entro);
  const medio = await nuevoInv(2);
  const entro2 = medio.agregar('madera_dura', 10); // 0,8 kg × 10 = 8 kg en 2 kg
  s.ok(entro2 === 2, 'agregar devuelve lo parcial que sí entró', entro2);
  s.ok(medio.cantidad('madera_dura') === entro2, 'lo devuelto coincide con lo guardado');

  // Quitar
  s.ok(inv.quitar('madera_dura', 5) === false, 'quitar de más devuelve false');
  s.ok(inv.cantidad('madera_dura') === 3, 'y no toca nada al fallar');
  s.ok(inv.quitar('madera_dura', 1) === true, 'quitar de menos devuelve true');
  s.ok(inv.cantidad('madera_dura') === 2, 'y descuenta');

  // Equivalencias: la madera dura satisface pedidos de «madera».
  s.ok(inv.disponiblePara('madera') === 2, 'disponiblePara cuenta la equivalencia', inv.disponiblePara('madera'));
  inv.agregar('madera_blanda', 4);
  s.ok(inv.disponiblePara('madera') === 6, 'suma las dos maderas', inv.disponiblePara('madera'));

  // consumirPara gasta primero lo específico.
  const inv2 = await nuevoInv(38);
  inv2.agregar('madera_dura', 2);
  inv2.agregar('tronco', 2);
  const c = inv2.consumirPara('tronco', 1);
  s.ok(c === true, 'consumirPara devuelve true si alcanza');
  s.ok(inv2.cantidad('tronco') === 1, 'gastó el tronco, que es lo específico', inv2.cantidad('tronco'));
  s.ok(inv2.cantidad('madera_dura') === 2, 'y no tocó la madera dura', inv2.cantidad('madera_dura'));

  // listar: la forma exacta que consumen Bolso, HUD, Taller y Partida.
  const lista = inv.listar();
  const it = lista.find(i => i.id === 'madera_dura');
  s.ok(!!it, 'listar trae lo que hay');
  s.ok(it && typeof it.nombre === 'string' && it.nombre.length > 0, 'listar trae nombre');
  s.ok(it && it.cantidad === 2, 'listar trae cantidad', it?.cantidad);
  s.ok(it && typeof it.kg === 'number', 'listar trae kg');
  s.ok(it && typeof it.cat === 'string', 'listar trae cat');
  s.ok(lista.every(i => i.cat), 'ninguna categoría llega vacía');

  // Un recurso repetido en varias casillas tiene que salir en UN renglón: el
  // bolso viejo y el HUD cuentan con eso, y es lo primero que rompe una grilla.
  const inv3 = await nuevoInv(38);
  inv3.agregar('madera_blanda', 12); // pila de 5 -> tres casillas
  const l3 = inv3.listar().filter(i => i.id === 'madera_blanda');
  s.ok(l3.length === 1, 'listar junta las pilas en un renglón', l3.length);
  s.ok(l3[0]?.cantidad === 12, 'y el renglón dice el total', l3[0]?.cantidad);

  const com = await nuevoInv(38);
  com.agregar('carne', 2);
  com.agregar('piedra', 1);
  const cs = com.comestibles();
  s.ok(cs.length >= 1 && cs.every(i => i.id !== 'piedra'), 'comestibles filtra lo que no se come',
    cs.map(i => i.id).join(','));

  let avisos = 0;
  const inv4 = await nuevoInv(38);
  inv4.alCambiar = () => avisos++;
  inv4.agregar('fibra', 1);
  inv4.quitar('fibra', 1);
  s.ok(avisos >= 2, 'alCambiar avisa al agregar y al quitar', avisos);

  return s;
}

// ── 2 · LAS PILAS ───────────────────────────────────────────────────────────

async function pilas() {
  const s = seccion(2, 'LAS PILAS — derivadas del peso, sin tabla a mano');
  const R = await import(urlDe('systems/Recursos.js'));
  const f = await fichas();

  if (typeof R.pilaDe !== 'function') {
    s.ok(false, 'Recursos.js exporta pilaDe', typeof R.pilaDe);
    s.felizQue = 'no existe pilaDe: no hay nada que medir';
    return s;
  }
  s.ok(true, 'Recursos.js exporta pilaDe');

  const mb = R.pilaDe(0.5);
  s.feliz = mb === 5;
  s.felizQue = `pilaDe(0.5) dio ${mb}, y la madera blanda tiene que apilar de a 5`;

  // Los seis casos leídos a mano en RONDA6.md
  const casos = [[0.01, 50], [0.02, 50], [0.1, 20], [0.35, 10], [0.5, 5], [0.7, 5], [1.1, 2], [1.6, 2], [6, 1]];
  for (const [kg, esperado] of casos)
    s.ok(R.pilaDe(kg) === esperado, `pilaDe(${kg}) = ${esperado}`, R.pilaDe(kg));

  // Las 71 fichas de verdad, contra la fórmula calculada acá aparte.
  const malas = f.filter(r => R.pilaDe(r.kg) !== pilaEsperada(r.kg));
  s.ok(malas.length === 0, 'las 71 fichas dan lo que dice la fórmula',
    malas.slice(0, 4).map(r => `${r.id} ${r.kg}kg dio ${R.pilaDe(r.kg)} y va ${pilaEsperada(r.kg)}`).join(' · '));

  s.ok(f.every(r => ESCALERA.includes(R.pilaDe(r.kg))), 'toda pila está en la escalera');

  // Monótona: nada más pesado apila más que algo más liviano.
  let mono = true, dondeMono = '';
  for (let i = 1; i < f.length; i++)
    if (R.pilaDe(f[i].kg) > R.pilaDe(f[i - 1].kg)) { mono = false; dondeMono = `${f[i - 1].id}(${f[i - 1].kg}) -> ${f[i].id}(${f[i].kg})`; break; }
  s.ok(mono, 'más pesado nunca apila más que más liviano', dondeMono);

  // La promesa de la escalera: una pila llena pesa entre 0,5 y 6 kg.
  const pesos = f.map(r => ({ id: r.id, p: R.pilaDe(r.kg) * r.kg }));
  const fuera = pesos.filter(x => x.p < 0.5 - 1e-9 || x.p > 6 + 1e-9);
  s.ok(fuera.length === 0, 'una pila llena pesa entre 0,5 y 6 kg',
    fuera.slice(0, 4).map(x => `${x.id} ${x.p.toFixed(2)}kg`).join(' · '));
  s.nota(`pila llena: mín ${Math.min(...pesos.map(x => x.p)).toFixed(2)} kg · máx ${Math.max(...pesos.map(x => x.p)).toFixed(2)} kg`);

  // Que no haya una tabla escondida: un peso que no existe en ninguna ficha
  // tiene que dar igual el valor de la fórmula.
  s.ok(R.pilaDe(0.123) === pilaEsperada(0.123), 'un peso inventado también sale de la fórmula', R.pilaDe(0.123));
  s.ok(R.pilaDe(3.7) === pilaEsperada(3.7), 'y uno pesado inventado también', R.pilaDe(3.7));

  return s;
}

// ── 3 · LOS DOS TOPES ───────────────────────────────────────────────────────

async function topes() {
  const s = seccion(3, 'LOS DOS TOPES — la grilla muerde, y no bloquea un bolso lleno');
  const R = await import(urlDe('systems/Recursos.js'));
  const f = await fichas();

  const inv = await nuevoInv(38);
  if (!Array.isArray(inv.casillas)) {
    s.ok(false, 'el inventario expone casillas como array', typeof inv.casillas);
    s.felizQue = 'no hay grilla: no hay nada que medir';
    return s;
  }
  s.ok(true, 'el inventario expone casillas como array');
  s.ok(inv.casillas.length === 24, 'con 38 kg son 24 casillas', inv.casillas.length);

  inv.agregar('madera_dura', 1);
  const usadas = inv.casillas.filter(Boolean).length;
  s.feliz = usadas === 1 && inv.casillas.find(c => c && c.id === 'madera_dura')?.n === 1;
  s.felizQue = `agregar 1 madera_dura ocupó ${usadas} casillas y la casilla dice ${JSON.stringify(inv.casillas.find(Boolean))}`;

  if (typeof R.casillasPara === 'function') {
    s.ok(R.casillasPara(38) === 24, 'casillasPara(38) = 24', R.casillasPara(38));
    s.ok(R.casillasPara(68) === 42, 'casillasPara(68) = 42, la rastra', R.casillasPara(68));
    s.ok(R.casillasPara(0) === 18, 'casillasPara(0) = 18, el piso', R.casillasPara(0));
    let mono = true;
    for (let k = 1; k <= 120; k++) if (R.casillasPara(k) < R.casillasPara(k - 1)) { mono = false; break; }
    s.ok(mono, 'más capacidad nunca da menos casillas');
    let filas = true;
    for (let k = 0; k <= 120; k++) if (R.casillasPara(k) % 6 !== 0) { filas = false; break; }
    s.ok(filas, 'siempre son filas completas de 6');
    for (const k of [38, 44, 50, 68])
      s.ok(R.casillasPara(k) === casillasEsperadas(k), `casillasPara(${k}) sigue la fórmula`, R.casillasPara(k));
  } else {
    s.ok(false, 'Recursos.js exporta casillasPara', typeof R.casillasPara);
  }

  // LA GRILLA MUERDE: con peso de sobra, la casilla 25 no existe.
  //
  // Acá el banco se equivocó primero, y vale escribirlo. Para «sacar del medio»
  // el tope de peso le puse al bolso una capacidad de 999 kg — el reflejo de
  // cuando el peso y las casillas eran cosas separadas. Pero **las casillas se
  // derivan de la capacidad**: 999 kg dan 630 casilleros, y en el registro hay
  // 42 fichas livianas, así que la aserción pedía meter 630 recursos distintos
  // sacándolos de una bolsa de 42. Imposible con cualquier implementación
  // correcta, y el agente lo demostró en vez de acomodar su código.
  //
  // La forma correcta de dejar el peso afuera no es agrandar el bolso sino
  // llenarlo de plumas: con la grilla de siempre y sólo cosas de menos de 0,4
  // kg, las 24 casillas se acaban con 1,1 kg encima de un tope de 38.
  const ancho = await nuevoInv(38);
  const cuantas = ancho.casillas.length;
  const distintos = f.filter(r => r.kg <= 0.4).slice(0, cuantas + 6);
  let metidos = 0, rechazado = null;
  for (const r of distintos) {
    const n = ancho.agregar(r.id, 1);
    if (n > 0) metidos++; else if (!rechazado) rechazado = r;
  }
  s.ok(metidos === cuantas, `entraron exactamente ${cuantas} recursos distintos, uno por casilla`, metidos);
  s.ok(!!rechazado, 'el que no tenía casilla fue rechazado', rechazado?.id);
  s.ok(ancho.pesoKg < ancho.capacidadKg * 0.5, 'y fue rechazado con peso de sobra',
    `${ancho.pesoKg.toFixed(1)} de ${ancho.capacidadKg} kg`);

  // LA GRILLA NO BLOQUEA: 500 cargas mixtas al azar de 38 kg tienen que llegar
  // al tope de peso sin quedarse antes sin casillas. Es la medición de RONDA6.md
  // convertida en aserción: mixto máx 22 casillas < 24.
  //
  // La cuenta se llena como en RONDA6.md y no de a pilas enteras, y eso importa:
  // pedir siempre la pila completa mete ~3 kg por casilla, con lo que 38 kg
  // entran en trece y la aserción se vuelve floja. El falsador lo mostró — con
  // la grilla estrangulada a 18 casillas esta prueba seguía verde. Una carga de
  // verdad se junta de a lo que se encuentra, y ahí es donde llega a 22.
  const rnd = azar(20260912);
  let peor = 0, fallidas = 0, ejemplo = '';
  for (let v = 0; v < 500; v++) {
    const i2 = await nuevoInv(38);
    let vueltas = 0;
    while (i2.pesoKg < 38 * 0.95 && vueltas++ < 400) {
      // El fallo es que la grilla se llene mientras el bolso todavía quiere
      // peso, y punto. Antes esto se contaba sólo si además el peso estaba por
      // debajo del 90 % del tope, y esa tolerancia se comía el defecto: con la
      // grilla estrangulada a 18 casillas las cargas llegaban a 34 de 38 kg y
      // la prueba las daba por buenas. Lo cazó el falsador.
      if (i2.casillas.every(Boolean)) {
        fallidas++;
        if (!ejemplo) ejemplo = `${i2.pesoKg.toFixed(1)} de 38 kg con las ${i2.casillas.length} casillas llenas`;
        break;
      }
      const r = f[Math.floor(rnd() * f.length)];
      const pila = R.pilaDe ? R.pilaDe(r.kg) : 1;
      const pide = Math.min(pila, Math.max(1, Math.floor((38 - i2.pesoKg) / r.kg)));
      i2.agregar(r.id, pide);
    }
    peor = Math.max(peor, i2.casillas.filter(Boolean).length);
  }
  s.ok(fallidas === 0, 'ninguna de 500 cargas mixtas se quedó sin casillas antes que sin peso',
    fallidas ? `${fallidas} fallaron, p.ej. ${ejemplo}` : '');
  s.nota(`la carga mixta más ancha de las 500 usó ${peor} de 24 casillas`);

  return s;
}

// ── 4 · LA PILA ABIERTA Y LAS POSICIONES ────────────────────────────────────

async function posiciones() {
  const s = seccion(4, 'LA PILA ABIERTA Y LAS POSICIONES');
  const R = await import(urlDe('systems/Recursos.js'));
  const inv = await nuevoInv(38);
  if (!Array.isArray(inv.casillas)) {
    s.ok(false, 'hay grilla que mirar', typeof inv.casillas);
    s.felizQue = 'no hay grilla';
    return s;
  }

  // Se llena la pila abierta antes de abrir casilla nueva.
  inv.agregar('madera_blanda', 3);   // pila de 5
  inv.agregar('madera_blanda', 3);
  const ocupadas = inv.casillas.filter(Boolean);
  s.feliz = inv.cantidad('madera_blanda') === 6;
  s.felizQue = `dos veces 3 de madera blanda dejaron ${inv.cantidad('madera_blanda')} en el bolso`;
  s.ok(ocupadas.length === 2, '3 + 3 con pila de 5 ocupa dos casillas', ocupadas.length);
  s.ok(ocupadas[0]?.n === 5, 'la primera queda llena', ocupadas[0]?.n);
  s.ok(ocupadas[1]?.n === 1, 'y la segunda con el resto', ocupadas[1]?.n);
  const tope = R.pilaDe ? R.pilaDe(0.5) : 5;
  s.ok(inv.casillas.filter(c => c?.id === 'madera_blanda').every(c => c.n <= tope),
    `ninguna casilla de madera blanda se pasa de ${tope}`,
    inv.casillas.filter(c => c?.id === 'madera_blanda').map(c => c.n).join('+'));

  // Las posiciones no se corren.
  const inv2 = await nuevoInv(38);
  const seis = ['madera_dura', 'piedra', 'fibra', 'carne', 'cuero', 'hueso'];
  for (const id of seis) inv2.agregar(id, 1);
  const antes = inv2.casillas.map(c => c && c.id);
  const idx2 = antes.indexOf(seis[2]);
  s.ok(idx2 >= 0, 'el tercero está en la grilla', idx2);
  inv2.quitar(seis[2], 1);
  const desp = inv2.casillas.map(c => c && c.id);
  s.ok(desp[idx2] == null, 'la casilla vaciada queda vacía', desp[idx2]);
  s.ok(desp[idx2 + 1] === antes[idx2 + 1], 'la de al lado no se corrió', `${antes[idx2 + 1]} -> ${desp[idx2 + 1]}`);
  s.ok(desp[antes.indexOf(seis[5])] === seis[5], 'la última sigue donde estaba');

  // Un hueco se reusa antes que abrir una casilla más adelante.
  inv2.agregar('yesca', 1);
  s.ok(inv2.casillas[idx2]?.id === 'yesca', 'lo nuevo entra en el hueco', inv2.casillas[idx2]?.id);

  // La capacidad sube en caliente —la cestería, la mochila— y no se pierde nada.
  //
  // La carga tiene que pasar de la casilla 24, o la prueba no prueba: con seis
  // recursos en las seis primeras casillas, achicar de 42 a 24 no toca ninguna
  // ocupada y el banco quedaba verde aunque `ajustarCasillas` recortara a lo
  // bruto. Lo cazó el falsador. Se llena con plumas —todo de menos de 0,3 kg—
  // así que ocupa treinta y pico de casilleros y pesa menos de 38: cuando la
  // capacidad vuelve a bajar, nada tendría por qué caerse por peso.
  const inv3 = await nuevoInv(68);
  const plumas = (await fichas()).filter(r => r.kg <= 0.3).slice(0, 34);
  for (const r of plumas) inv3.agregar(r.id, 1);
  const antesKg = inv3.pesoKg, antesN = inv3.casillas.filter(Boolean).length;
  s.ok(inv3.casillas.length === 42, 'con 68 kg son 42 casillas', inv3.casillas.length);
  s.ok(antesN > 24, 'la carga de prueba pasa de la casilla 24', antesN);
  s.ok(antesKg < 38, 'y pesa menos de 38 kg, así que nada se cae por peso', antesKg.toFixed(2));
  inv3.capacidadKg = 38;
  if (typeof inv3.ajustarCasillas === 'function') inv3.ajustarCasillas();
  s.ok(Math.abs(inv3.pesoKg - antesKg) < 1e-9, 'achicar la capacidad no pierde un gramo',
    `${antesKg.toFixed(3)} -> ${inv3.pesoKg.toFixed(3)}`);
  s.ok(inv3.casillas.filter(Boolean).length === antesN, 'ni una casilla ocupada',
    `${antesN} -> ${inv3.casillas.filter(Boolean).length}`);
  s.ok(inv3.casillas.length >= antesN, 'la grilla sólo se achica hasta la última ocupada',
    `${inv3.casillas.length} casillas para ${antesN} ocupadas`);
  inv3.capacidadKg = 68;
  if (typeof inv3.ajustarCasillas === 'function') inv3.ajustarCasillas();
  s.ok(Math.abs(inv3.pesoKg - antesKg) < 1e-9, 'ni volver a agrandar', `${antesKg} -> ${inv3.pesoKg}`);

  return s;
}

// ── 5 · MOVER, PARTIR, JUNTAR ───────────────────────────────────────────────

async function mover() {
  const s = seccion(5, 'MOVER, PARTIR, JUNTAR — y el peso que no cambia');
  const R = await import(urlDe('systems/Recursos.js'));
  const inv = await nuevoInv(38);
  if (typeof inv.mover !== 'function' || typeof inv.partir !== 'function') {
    s.ok(typeof inv.mover === 'function', 'existe mover', typeof inv.mover);
    s.ok(typeof inv.partir === 'function', 'existe partir', typeof inv.partir);
    s.felizQue = 'no hay mover ni partir';
    return s;
  }
  s.ok(true, 'existen mover y partir');

  // Mover a una casilla vacía.
  inv.agregar('madera_dura', 1);
  const libre = inv.casillas.findIndex((c, i) => !c && i > 0);
  const movio = inv.mover(0, libre);
  s.feliz = movio === true && inv.casillas[libre]?.id === 'madera_dura' && inv.casillas[0] == null;
  s.felizQue = `mover(0,${libre}) devolvió ${movio} y la casilla ${libre} quedó ${JSON.stringify(inv.casillas[libre])}`;
  s.ok(inv.casillas[0] == null, 'el origen queda vacío');
  s.ok(inv.cantidad('madera_dura') === 1, 'y no se creó ni se perdió nada');

  // Juntar lo mismo, hasta el tope de la pila.
  const j = await nuevoInv(38);
  j.agregar('madera_blanda', 8);        // pila 5 -> [5, 3]
  const a = j.casillas.findIndex(Boolean);
  const b = j.casillas.findIndex((c, i) => c && i > a);
  s.ok(a >= 0 && b > a, 'quedaron dos pilas para juntar', `${a},${b}`);
  j.mover(b, a);                         // 3 sobre 5: la primera ya está llena
  s.ok(j.cantidad('madera_blanda') === 8, 'juntar no pierde nada', j.cantidad('madera_blanda'));
  s.ok(j.casillas[a]?.n === 5, 'la de destino no se pasa del tope', j.casillas[a]?.n);
  s.ok(j.casillas[b]?.n === 3, 'y el resto se queda donde estaba', j.casillas[b]?.n);

  const j2 = await nuevoInv(38);
  j2.agregar('madera_blanda', 5);
  j2.quitar('madera_blanda', 3);         // [2]
  j2.agregar('madera_blanda', 2);        // se apila en la misma: [4]
  const ja = j2.casillas.findIndex(Boolean);
  s.ok(j2.casillas[ja]?.n === 4, 'una pila a medio llenar se completa sola', j2.casillas[ja]?.n);

  // Intercambiar cosas distintas.
  const x = await nuevoInv(38);
  x.agregar('piedra', 1); x.agregar('carne', 1);
  const p0 = x.casillas.findIndex(c => c?.id === 'piedra');
  const c0 = x.casillas.findIndex(c => c?.id === 'carne');
  x.mover(p0, c0);
  s.ok(x.casillas[c0]?.id === 'piedra' && x.casillas[p0]?.id === 'carne',
    'mover sobre otra cosa intercambia', `${x.casillas[p0]?.id},${x.casillas[c0]?.id}`);

  // Partir por la mitad.
  const q = await nuevoInv(38);
  q.agregar('junco', 20);                // pila de 20, una casilla llena
  const qi = q.casillas.findIndex(Boolean);
  const partio = q.partir(qi);
  s.ok(partio === true, 'partir devuelve true', partio);
  const trozos = q.casillas.filter(c => c?.id === 'junco').map(c => c.n).sort((m, n) => m - n);
  s.ok(trozos.length === 2, 'partir deja dos pilas', trozos.length);
  s.ok(trozos[0] === 10 && trozos[1] === 10, 'partidas por la mitad', trozos.join('+'));
  s.ok(q.cantidad('junco') === 20, 'y sin perder una sola', q.cantidad('junco'));
  const uno = await nuevoInv(38);
  uno.agregar('tronco', 1);
  s.ok(uno.partir(uno.casillas.findIndex(Boolean)) === false, 'una pila de 1 no se parte');

  // Índices imposibles. Los manda la interfaz, no el banco, y una grilla que
  // tira una excepción con un índice raro deja el panel a medio dibujar. El
  // falsador mostró que sin esto el banco no lo veía: el sorteo de más abajo
  // nunca sale del rango, así que nunca ejercitaba el caso.
  const z = await nuevoInv(38);
  z.agregar('piedra', 2);
  const kgZ = z.pesoKg;
  let tiro = '';
  for (const [a, b] of [[-1, 3], [0, 999], [999, 0], [3, 3], [0.5, 2], [NaN, 1]]) {
    try { z.mover(a, b); } catch (e) { if (!tiro) tiro = `mover(${a},${b}): ${e.message}`; }
  }
  for (const i of [-1, 999, NaN, 0.5]) {
    try { z.partir(i); } catch (e) { if (!tiro) tiro = `partir(${i}): ${e.message}`; }
  }
  s.ok(!tiro, 'ni mover ni partir tiran con un índice imposible', tiro);
  s.ok(Math.abs(z.pesoKg - kgZ) < 1e-9, 'y un índice imposible no cambia nada', `${kgZ} -> ${z.pesoKg}`);
  s.ok(z.mover(3, 3) === false || z.casillas.filter(Boolean).length === 1,
    'moverse a sí mismo no duplica');

  // Conservación bajo 400 movimientos al azar: ni un gramo.
  const w = await nuevoInv(38);
  const semillas = ['madera_dura', 'madera_blanda', 'junco', 'piedra', 'fibra', 'carne'];
  for (const id of semillas) w.agregar(id, 7);
  const kg0 = w.pesoKg;
  const cuenta0 = {};
  for (const id of semillas) cuenta0[id] = w.cantidad(id);
  const rnd = azar(777);
  let excepcion = '';
  for (let k = 0; k < 400 && !excepcion; k++) {
    const i = Math.floor(rnd() * w.casillas.length), o = Math.floor(rnd() * w.casillas.length);
    try { if (rnd() < 0.25) w.partir(i); else w.mover(i, o); }
    catch (e) { excepcion = `${e.message} en mover(${i},${o})`; }
  }
  s.ok(!excepcion, 'ni una excepción en 400 movimientos al azar', excepcion);
  s.ok(Math.abs(w.pesoKg - kg0) < 1e-9, 'el peso total no cambió', `${kg0.toFixed(3)} -> ${w.pesoKg.toFixed(3)}`);
  const iguales = semillas.every(id => w.cantidad(id) === cuenta0[id]);
  s.ok(iguales, 'ni una unidad de nada apareció o desapareció',
    semillas.map(id => `${id} ${cuenta0[id]}->${w.cantidad(id)}`).join(' '));
  // Cada casilla contra el tope de SU recurso, que es lo que de verdad importa:
  // un mover mal hecho junta 20 juncos sobre 20 y deja una pila de 40.
  const kgDe = (id) => R.RECURSOS[id]?.kg ?? 0.5;
  const excedidas = w.casillas.filter(c => c && c.n > R.pilaDe(kgDe(c.id)));
  s.ok(excedidas.length === 0, 'ninguna casilla supera el tope de su propia pila',
    excedidas.slice(0, 4).map(c => `${c.id} ${c.n}>${R.pilaDe(kgDe(c.id))}`).join(' · '));
  const vacias = w.casillas.filter(c => c && !(c.n >= 1));
  s.ok(vacias.length === 0, 'una casilla en cero queda en null, no en {n:0}',
    vacias.slice(0, 4).map(c => `${c.id} n=${c.n}`).join(' · '));
  s.ok(w.casillas.every(c => !c || typeof c.id === 'string' && Number.isInteger(c.n)),
    'toda casilla ocupada sigue siendo {id, n} con n entero');

  return s;
}

// ── 6 · EL GUARDADO ─────────────────────────────────────────────────────────

async function guardado() {
  const s = seccion(6, 'EL GUARDADO — el formato viejo entra y el nuevo vuelve');
  const inv = await nuevoInv(38);

  if (typeof inv.reponer !== 'function' || typeof inv.serializar !== 'function') {
    s.ok(typeof inv.serializar === 'function', 'existe serializar', typeof inv.serializar);
    s.ok(typeof inv.reponer === 'function', 'existe reponer', typeof inv.reponer);
    s.felizQue = 'no hay serializar ni reponer';
    return s;
  }
  s.ok(true, 'existen serializar y reponer');
  s.ok(typeof inv.vaciar === 'function', 'existe vaciar', typeof inv.vaciar);
  s.ok(inv.items === undefined, 'items ya no existe', typeof inv.items);

  // EL FORMATO VIEJO: una partida guardada antes de esta ronda.
  inv.reponer([['madera_dura', 3], ['yesca', 10]]);
  s.feliz = inv.cantidad('madera_dura') === 3 && inv.cantidad('yesca') === 10;
  s.felizQue = `el guardado viejo dio ${inv.cantidad('madera_dura')} madera y ${inv.cantidad('yesca')} yesca`;
  s.ok(inv.cantidad('madera_dura') === 3, 'el formato viejo entra: 3 maderas', inv.cantidad('madera_dura'));
  s.ok(inv.cantidad('yesca') === 10, 'y 10 yescas', inv.cantidad('yesca'));
  s.ok(inv.casillas.filter(Boolean).length >= 2, 'y ocupan casillas de verdad');

  // Una partida vieja con más recursos que casillas no puede perder nada en
  // silencio: o entra todo, o se avisa.
  const f = await fichas();
  const muchos = f.slice(0, 40).map(r => [r.id, 1]);
  const inv5 = await nuevoInv(38);
  inv5.reponer(muchos);
  const guardados = f.slice(0, 40).filter(r => inv5.cantidad(r.id) > 0).length;
  s.ok(guardados === 40 || inv5.desbordado === true,
    'un guardado con más recursos que casillas entra entero o se declara desbordado',
    `entraron ${guardados} de 40, desbordado=${inv5.desbordado}`);

  // IDA Y VUELTA del formato nuevo, con las posiciones intactas.
  //
  // Tiene que haber un HUECO en el medio, y no es un detalle de gusto: con las
  // casillas ocupadas de corrido desde la cero, un `serializar` que compacta da
  // exactamente el mismo resultado que uno que respeta las posiciones, y la
  // aserción no prueba nada. El falsador lo cazó — con las pilas compactadas al
  // guardar, esta sección seguía verde.
  const inv2 = await nuevoInv(38);
  inv2.agregar('madera_blanda', 8);
  inv2.agregar('piedra', 2);
  inv2.agregar('carne', 1);
  inv2.agregar('junco', 5);
  inv2.quitar('piedra', 2);              // deja el hueco en el medio
  s.ok(inv2.casillas.some((c, i) => !c && inv2.casillas.slice(i + 1).some(Boolean)),
    'la prueba de ida y vuelta tiene un hueco en el medio',
    inv2.casillas.map(c => c ? c.id[0] : '·').join('').replace(/·+$/, ''));
  const foto = JSON.stringify(inv2.casillas);
  const kg = inv2.pesoKg;
  const inv3 = await nuevoInv(38);
  inv3.reponer(JSON.parse(JSON.stringify(inv2.serializar())));
  s.ok(JSON.stringify(inv3.casillas) === foto, 'ida y vuelta deja la grilla idéntica',
    JSON.stringify(inv3.casillas).slice(0, 160));
  s.ok(Math.abs(inv3.pesoKg - kg) < 1e-9, 'y el mismo peso', `${kg} -> ${inv3.pesoKg}`);

  // LA PARTIDA de verdad, con localStorage de mentira.
  const guarda = new Map();
  globalThis.localStorage = {
    getItem: (k) => (guarda.has(k) ? guarda.get(k) : null),
    setItem: (k, v) => guarda.set(k, String(v)),
    removeItem: (k) => guarda.delete(k),
  };
  const { Partida } = await import(urlDe('systems/Partida.js'));
  const jugador = {
    posicion: { x: 1, y: 2, z: 3, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    giro: 0, salud: 90, energia: 80, hambre: 70, sed: 60, temperatura: 36.6, horasVividas: 5,
  };
  const saberes = { puntos: 0, ganadosTotales: 0, desbloqueadas: new Set() };
  const invP = await nuevoInv(38);
  invP.agregar('madera_blanda', 8);
  invP.agregar('carne', 2);
  const fotoP = JSON.stringify(invP.casillas);
  let excepcion = '';
  try {
    const p = new Partida({ jugador, inventario: invP, saberes });
    p.guardar();
    const invQ = await nuevoInv(38);
    const q = new Partida({ jugador, inventario: invQ, saberes });
    const cargo = q.cargar();
    s.ok(cargo !== false, 'la partida guardada se carga', cargo);
    s.ok(JSON.stringify(invQ.casillas) === fotoP, 'y el bolso vuelve casilla por casilla',
      JSON.stringify(invQ.casillas).slice(0, 160));

    // La muerte vacía el bolso, y el resumen dice lo que se perdió.
    const muerte = p.registrarMuerte({ causa: 'frío' });
    s.ok(invP.pesoKg === 0, 'la muerte vacía el bolso', invP.pesoKg);
    s.ok(invP.casillas.every(c => !c), 'y no deja casillas ocupadas');
    s.ok(muerte?.perdido?.length >= 2, 'el resumen dice lo que se perdió', muerte?.perdido?.length);
  } catch (e) {
    excepcion = e.message;
  }
  s.ok(!excepcion, 'Partida.js no se rompió con el inventario nuevo', excepcion);

  return s;
}

// ── 7 · ARRANQUE ────────────────────────────────────────────────────────────

async function arranque() {
  const s = seccion(7, 'ARRANQUE — vite build');
  if (process.env.BANCO_SIN_BUILD) { s.feliz = true; s.nota('salteado por BANCO_SIN_BUILD'); return s; }
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, encoding: 'utf8', shell: true, timeout: 600000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  s.feliz = r.status === 0;
  s.felizQue = `vite build salió con ${r.status}`;
  s.ok(r.status === 0, 'vite build termina bien', r.status === 0 ? '' : salida.slice(-1200));
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { api, pilas, topes, posiciones, mover, guardado, arranque };

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  try {
    todas.push(await fn());
  } catch (e) {
    todas.push({
      num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`,
      checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }],
      feliz: false, felizQue: 'la sección tiró una excepción', notas: [],
    });
  }
}
todas.sort((a, b) => a.num - b.num);

// El falsador necesita el resultado en crudo para comparar aserción por
// aserción: leer el texto de la salida sería adivinar.
if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every(s => s.feliz && s.checks.every(c => c.ok)) ? 0 : 1;
} else {

console.log(`\n  BANCO R6 · FASE 1 — la grilla   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
let verdes = 0;
for (const s of todas) {
  const verde = s.checks.every((c) => c.ok) && s.feliz;
  if (verde) verdes++;
  console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(2)}  ${s.num} · ${s.nombre}`);
  for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
  if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
  for (const n of s.notas) console.log(`         nota ${n}`);
}
console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
process.exitCode = verdes === todas.length ? 0 : 1;

}
