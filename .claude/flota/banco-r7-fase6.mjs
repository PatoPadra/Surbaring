/**
 * BANCO DE LA FASE 6 (cielo) — ronda 7, mitad Node.
 *
 * Lo escribe el JEFE contra el contrato de RONDA7.md, antes de que exista una
 * línea del agente. Carga `Cielo.js` de verdad y el catálogo BSC5 crudo de
 * `tools/catalogos/bsc5/catalog.gz`, que es la referencia de las estrellas.
 *
 *   1. LA LUNA ES LA DE LA FECHA (C1) — contra diez filas de JPL Horizons, pedidas el
 *      15/9/2026: altura y azimut sin refracción vistos desde el arranque (−41,087°,
 *      −71,429°, 800 m) e iluminación. A 0,5° y 2 puntos.
 *   2. EL CIELO GIRA (C2) — `cielo.direccionDe(ra, dec)` contra la cuenta propia del
 *      banco: tiempo sidéreo de Meeus (12.4), precesión rigurosa (21.2) y la convención
 *      de `vectorSolar()`. Siete estrellas en cuatro instantes, a 0,5°; y el eje de giro
 *      sobre el sur a la altura de la latitud.
 *   3. LAS ESTRELLAS SON LAS DEL CATÁLOGO (C3, la parte de Node) — la tabla horneada
 *      tiene todas las de magnitud 5 que suben a −41,1°, cita el catálogo, y el ruido
 *      viejo del shader ya no está.
 *   4. LA VÍA LÁCTEA GIRA CON EL CIELO (C4) — `uPoloGalactico` contra el polo norte
 *      galáctico, y cambia con la hora.
 *   5. LA CRUZ DEL SUR ENSEÑA EL SUR (C7) — `queMiro()`, y el método —prolongar el palo
 *      largo cuatro veces y media, la mediatriz de los punteros— medido sobre las
 *      direcciones que da el propio cielo del juego; el HUD y el códice lo dicen.
 *   6. SIN REGRESIÓN (C9) — ronda 6 y ronda 7, fases 1 a 5.
 *   7. ARRANQUE — `vite build`.
 *
 * La mitad navegador —`banco-r7-fase6.navegador.js`— mide C3 en la imagen, C5, C6 y C8.
 *
 * Qué SE fija, porque el contrato lo dice: `direccionLuna`, `uFaseLunar` como fracción
 * iluminada, `direccionDe(ra, dec)` en grados J2000, `uPoloGalactico`, `queMiro()` y
 * `'cruz_del_sur'`, y `src/data/estrellas.json` con `estrellas: [[ra, dec, v, …]]`.
 *
 * Qué NO se fija: la efeméride que se use —se juzga el resultado—, si se aplica la
 * precesión —cabe en la tolerancia—, cómo se dibujan las estrellas, cuántas de más de
 * magnitud 5 se hornean, ni las palabras del HUD más allá de las piezas del método.
 *
 * A −41° la Cruz del Sur es circumpolar: nunca se pone. No hay prueba de «bajo el
 * horizonte» porque desde el parque no pasa.
 *
 * Uso: node .claude/flota/banco-r7-fase6.mjs   ·   BANCO_SRC, BANCO_SIN_BUILD,
 *      BANCO_DETALLE, BANCO_JSON, BANCO_SECCIONES
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const leer = (rel) => fs.readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');

const modulos = new Map();
async function imp(rel) {
  if (!modulos.has(rel)) modulos.set(rel, import(pathToFileURL(path.join(SRC, ...rel.split('/'))).href));
  return modulos.get(rel);
}

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = globalThis.document || { addEventListener() {}, createElement: () => ({ getContext: () => null, style: {} }) };

// ═══════════════════════════════════════════════════════════════════════════
// La astronomía del banco: propia, y no la del agente
// ═══════════════════════════════════════════════════════════════════════════

const RAD = Math.PI / 180;
const sen = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);
const norm360 = (d) => ((d % 360) + 360) % 360;
const JD = (f) => f.getTime() / 86400000 + 2440587.5;
const SITIO = { lat: -41.087, lon: -71.429 };

/**
 * JPL Horizons, 15/9/2026. Luna (301), observador en −71,429° E, −41,087°, 0,8 km,
 * `APPARENT='AIRLESS'`, cantidades 4 (azimut y elevación aparentes) y 10 (fracción
 * iluminada, %). Instantes en UT.
 */
const JPL = [
  ['2024-02-09T22:59Z', 256.762835569, 12.319192005, 0.09063],
  ['2024-02-16T02:40Z', 300.478379069, 1.627417625, 44.17298],
  ['2024-02-16T15:01Z', 87.114547844, -33.617880418, 50.77705],
  ['2024-02-24T12:30Z', 265.611078363, -25.247953744, 99.89614],
  ['2024-03-03T15:23Z', 260.767529971, 31.197862942, 50.76715],
  ['2025-02-12T13:20Z', 259.731780061, -37.056004591, 99.91769],
  ['2025-07-21T00:00Z', 231.211152409, -69.648509595, 18.40994],
  ['2025-10-01T06:00Z', 247.909276435, 13.231246410, 61.97272],
  ['2026-01-15T03:00Z', 164.337527343, -20.535118184, 12.58961],
  ['2026-09-13T02:00Z', 243.492645146, -15.619098830, 4.19258],
];

/** Altura y azimut —desde el norte, hacia el este— a una dirección del mundo, como `vectorSolar()`. */
const vectorMundo = (altDeg, azDeg) => new THREE.Vector3(cos(altDeg) * sen(azDeg), sen(altDeg), -cos(altDeg) * cos(azDeg));
const alturaDe = (v) => Math.asin(Math.max(-1, Math.min(1, v.y / v.length()))) / RAD;
const azimutDe = (v) => norm360(Math.atan2(v.x, -v.z) / RAD);
const angulo = (u, v) => Math.acos(Math.max(-1, Math.min(1, u.dot(v) / (u.length() * v.length())))) / RAD;

/** Precesión rigurosa de J2000 a la fecha (Meeus, 21.2). */
function precesar(ra, dec, jd) {
  const t = (jd - 2451545) / 36525;
  const z = (2306.2181 * t + 0.30188 * t * t) / 3600;
  const zeta = (2306.2181 * t + 1.09468 * t * t) / 3600;
  const th = (2004.3109 * t - 0.42665 * t * t) / 3600;
  const A = cos(dec) * sen(ra + zeta);
  const B = cos(th) * cos(dec) * cos(ra + zeta) - sen(th) * sen(dec);
  const C = sen(th) * cos(dec) * cos(ra + zeta) + cos(th) * sen(dec);
  return { ra: norm360(Math.atan2(A, B) / RAD + z), dec: Math.asin(Math.max(-1, Math.min(1, C))) / RAD };
}

/** Dirección en el mundo de una posición J2000, con precesión y tiempo sidéreo de Meeus (12.4). */
function direccionBanco(ra, dec, fecha, sitio = SITIO, conPrecesion = true) {
  const jd = JD(fecha);
  const p = conPrecesion ? precesar(ra, dec, jd) : { ra, dec };
  const T = (jd - 2451545) / 36525;
  const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000);
  const H = gmst + sitio.lon - p.ra;
  const alt = Math.asin(sen(sitio.lat) * sen(p.dec) + cos(sitio.lat) * cos(p.dec) * cos(H)) / RAD;
  const az = norm360(Math.atan2(-cos(p.dec) * sen(H), sen(p.dec) * cos(sitio.lat) - cos(p.dec) * sen(sitio.lat) * cos(H)) / RAD);
  return vectorMundo(alt, az);
}

/** El BSC5 crudo, con las columnas del `ReadMe`. Los 14 objetos sin posición se descartan. */
let _catalogo = null;
function catalogo() {
  if (_catalogo) return _catalogo;
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(RAIZ, 'tools', 'catalogos', 'bsc5', 'catalog.gz'))).toString('latin1').split('\n');
  _catalogo = [];
  for (const r of txt) {
    if (r.length < 107 || r.slice(75, 77).trim() === '' || r.slice(102, 107).trim() === '') continue;
    _catalogo.push({
      hr: +r.slice(0, 4), nombre: r.slice(4, 14).trim(),
      ra: 15 * (+r.slice(75, 77) + +r.slice(77, 79) / 60 + +r.slice(79, 83) / 3600),
      dec: (r[83] === '-' ? -1 : 1) * (+r.slice(84, 86) + +r.slice(86, 88) / 60 + +r.slice(88, 90) / 3600),
      v: +r.slice(102, 107),
    });
  }
  return _catalogo;
}
const porHR = (hr) => catalogo().find((e) => e.hr === hr);

/** Gira `v` alrededor del eje unitario `n`, `grados` con la regla de la mano derecha. */
function girar(v, n, grados) {
  const c = cos(grados), s = sen(grados);
  return v.clone().multiplyScalar(c).add(n.clone().cross(v).multiplyScalar(s)).add(n.clone().multiplyScalar(n.dot(v) * (1 - c)));
}

async function nuevoCielo() {
  const { Cielo } = await imp('world/Cielo.js');
  return new Cielo(new THREE.Scene());
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LA LUNA ES LA DE LA FECHA
// ═══════════════════════════════════════════════════════════════════════════

async function lunaDeLaFecha() {
  const s = seccion(1, 'LA LUNA ES LA DE LA FECHA — contra JPL Horizons, vista desde el arranque');
  const cielo = await nuevoCielo();
  let peorPos = 0, peorIlu = 0, corrio = 0;
  const filas = [];
  for (const [f, az, el, ilu] of JPL) {
    cielo.actualizar(new Date(f), SITIO.lat, SITIO.lon, 0);
    const d = angulo(cielo.direccionLuna, vectorMundo(el, az));
    const i = Math.abs(cielo.uniformes.uFaseLunar.value - ilu / 100) * 100;
    peorPos = Math.max(peorPos, d);
    peorIlu = Math.max(peorIlu, i);
    corrio++;
    filas.push(`${f.slice(0, 10)} ${d.toFixed(2)}° ${i.toFixed(1)}p`);
  }
  s.ok(corrio === JPL.length, 'premisa: el cielo se actualizó en los diez instantes de JPL', corrio);
  s.ok(peorPos <= 0.5, 'la luna queda a 0,5° o menos de JPL, vista desde el arranque', `peor ${peorPos.toFixed(2)}° · ${filas.join(' · ')}`);
  s.ok(peorIlu <= 2, 'uFaseLunar es la fracción iluminada, a 2 puntos o menos', `peor ${peorIlu.toFixed(1)} puntos`);
  cielo.actualizar(new Date('2024-02-09T22:59Z'), SITIO.lat, SITIO.lon, 0);
  const nueva = cielo.uniformes.uFaseLunar.value;
  cielo.actualizar(new Date('2024-02-24T12:30Z'), SITIO.lat, SITIO.lon, 0);
  const llena = cielo.uniformes.uFaseLunar.value;
  s.ok(nueva < 0.05 && llena > 0.95, 'en la luna nueva real está a oscuras, y en la llena, entera', `${nueva.toFixed(2)} · ${llena.toFixed(2)}`);
  s.feliz = corrio === JPL.length;
  s.felizQue = s.feliz ? 'el cielo se actualizó' : 'el cielo no se actualizó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · EL CIELO GIRA
// ═══════════════════════════════════════════════════════════════════════════

const HR = { acrux: 4730, mimosa: 4853, gacrux: 4763, deltaCru: 4656, alfaCen: 5459, betaCen: 5267, sirio: 2491, canopo: 2326 };

async function cieloGira() {
  const s = seccion(2, 'EL CIELO GIRA — direccionDe(ra, dec) contra el tiempo sidéreo y la precesión del banco');
  const acrux = porHR(HR.acrux), sirio = porHR(HR.sirio), canopo = porHR(HR.canopo);
  s.ok(acrux?.v === 1.33 && sirio?.v === -1.46 && canopo?.v === -0.72, 'premisa: el catálogo trae Acrux, Sirio y Canopo con su magnitud', `${acrux?.v} · ${sirio?.v} · ${canopo?.v}`);
  // La apertura calculó a Acrux SIN precesión: 37,71° y 145,23°. Comparar así
  // comprueba que el tiempo sidéreo del banco es el mismo. Con la precesión, que el
  // banco sí aplica, la estrella se corre 0,2°. La primera versión comparaba la
  // cuenta con precesión contra los números sin ella, y la premisa caía por el
  // motivo equivocado.
  const sinPrec = direccionBanco(acrux.ra, acrux.dec, new Date('2025-02-12T02:00Z'), SITIO, false);
  s.ok(Math.abs(alturaDe(sinPrec) - 37.71) < 0.05 && Math.abs(azimutDe(sinPrec) - 145.23) < 0.05, 'premisa: sin precesión, la cuenta del banco da Acrux donde la dio la apertura', `${alturaDe(sinPrec).toFixed(2)}° · ${azimutDe(sinPrec).toFixed(2)}°`);
  const conPrec = direccionBanco(acrux.ra, acrux.dec, new Date('2025-02-12T02:00Z'));
  s.nota(`Acrux el 12/2/2025 a las 2:00 UTC, con precesión: ${alturaDe(conPrec).toFixed(2)}° de altura · ${azimutDe(conPrec).toFixed(2)}° de azimut`);

  const cielo = await nuevoCielo();
  const hay = typeof cielo.direccionDe === 'function';
  s.ok(hay, 'existe cielo.direccionDe(ra, dec)');
  if (!hay) { s.felizQue = 'sin direccionDe'; return s; }

  const fechas = ['2025-02-12T02:00Z', '2025-02-12T06:00Z', '2025-07-21T00:00Z', '2026-09-13T02:00Z'];
  let peor = 0;
  const detalle = [];
  for (const f of fechas) {
    const fecha = new Date(f);
    cielo.actualizar(fecha, SITIO.lat, SITIO.lon, 0);
    for (const [clave, hr] of Object.entries(HR)) {
      const e = porHR(hr);
      const d = angulo(cielo.direccionDe(e.ra, e.dec), direccionBanco(e.ra, e.dec, fecha));
      if (d > peor) { peor = d; detalle.length = 0; detalle.push(`${clave} ${f}`); }
    }
  }
  s.ok(peor <= 0.5, 'siete estrellas en cuatro instantes quedan a 0,5° o menos', `peor ${peor.toFixed(3)}° · ${detalle.join('')}`);

  cielo.actualizar(new Date('2025-02-12T06:00Z'), SITIO.lat, SITIO.lon, 0);
  const polo = cielo.direccionDe(0, -90);
  s.ok(Math.abs(alturaDe(polo) - Math.abs(SITIO.lat)) <= 0.5 && Math.abs(azimutDe(polo) - 180) <= 0.5,
    'el eje de giro está sobre el sur, a la altura de la latitud', `${alturaDe(polo).toFixed(2)}° · ${azimutDe(polo).toFixed(2)}°`);

  s.feliz = true;
  s.felizQue = 'direccionDe corrió';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · LAS ESTRELLAS SON LAS DEL CATÁLOGO
// ═══════════════════════════════════════════════════════════════════════════

async function catalogoHorneado() {
  const s = seccion(3, 'LAS ESTRELLAS SON LAS DEL CATÁLOGO — la tabla horneada, su cita, y sin el ruido viejo');
  const visibles = catalogo().filter((e) => e.v <= 5.0 && e.dec < 90 - Math.abs(SITIO.lat) + 0.1);
  s.ok(visibles.length >= 1430 && visibles.length <= 1450, 'premisa: son unas 1439 estrellas hasta magnitud 5 que suben a −41,1°', visibles.length);

  const ruta = path.join(SRC, 'data', 'estrellas.json');
  const script = path.join(RAIZ, 'tools', 'catalogos', 'bsc5', 'hornear.mjs');
  s.ok(fs.existsSync(script), 'existe tools/catalogos/bsc5/hornear.mjs');
  const existe = fs.existsSync(ruta);
  s.ok(existe, 'existe src/data/estrellas.json');
  let completa = false;
  if (existe) {
    const tabla = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const filas = tabla.estrellas;
    const forma = Array.isArray(filas) && filas.length > 0 && filas.every((f) => Array.isArray(f) && f.length >= 3 && f.slice(0, 3).every(Number.isFinite));
    s.ok(forma, 'la tabla es estrellas: [[ra, dec, v, …], …]', Array.isArray(filas) ? filas.length : typeof filas);
    if (forma) {
      const porDec = new Map();
      for (const f of filas) {
        const k = Math.round(f[1]);
        if (!porDec.has(k)) porDec.set(k, []);
        porDec.get(k).push(f);
      }
      const faltan = [];
      for (const e of visibles) {
        const cerca = [-1, 0, 1].flatMap((d) => porDec.get(Math.round(e.dec) + d) || []);
        const esta = cerca.some((f) => Math.abs(f[1] - e.dec) <= 0.05
          && Math.abs(((f[0] - e.ra + 540) % 360) - 180) * cos(e.dec) <= 0.05
          && Math.abs(f[2] - e.v) <= 0.06);
        if (!esta) faltan.push(`HR ${e.hr}`);
      }
      completa = faltan.length === 0;
      s.ok(completa, 'están todas las estrellas hasta magnitud 5 que suben a −41,1°, con su magnitud', faltan.length ? `faltan ${faltan.length}: ${faltan.slice(0, 5).join(', ')}` : `${visibles.length} de ${visibles.length}`);
    }
    s.ok(/Hoffleit/.test(JSON.stringify(tabla)) && /V\/50/.test(JSON.stringify(tabla)), 'la tabla cita el catálogo: Hoffleit y Warren, CDS V/50');
  }
  const codigo = leer('world/Cielo.js');
  s.ok(/Hoffleit/.test(codigo), 'Cielo.js cita el catálogo');
  s.ok(!/dir \* 260\.0/.test(codigo) && !/dir \* 520\.0/.test(codigo), 'el campo de estrellas de ruido ya no está en el shader');

  s.feliz = visibles.length > 0;
  s.felizQue = s.feliz ? 'el catálogo se leyó' : 'el catálogo no se leyó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LA VÍA LÁCTEA GIRA CON EL CIELO
// ═══════════════════════════════════════════════════════════════════════════

const POLO_GALACTICO = { ra: 192.859, dec: 27.128 };

async function viaLactea() {
  const s = seccion(4, 'LA VÍA LÁCTEA GIRA CON EL CIELO — uPoloGalactico sobre el polo norte galáctico');
  const cielo = await nuevoCielo();
  const u = cielo.uniformes.uPoloGalactico;
  s.ok(!!u && u.value?.isVector3, 'existe uniformes.uPoloGalactico, un vector');
  if (!u?.value?.isVector3) { s.felizQue = 'sin polo galáctico'; return s; }
  const fechas = ['2025-02-12T02:00Z', '2025-02-12T08:00Z'];
  const vistos = [];
  let peor = 0;
  for (const f of fechas) {
    const fecha = new Date(f);
    cielo.actualizar(fecha, SITIO.lat, SITIO.lon, 0);
    peor = Math.max(peor, angulo(u.value, direccionBanco(POLO_GALACTICO.ra, POLO_GALACTICO.dec, fecha)));
    vistos.push(u.value.clone());
  }
  s.ok(peor <= 1, 'apunta al polo norte galáctico, a 1° o menos', `peor ${peor.toFixed(2)}°`);
  s.ok(angulo(vistos[0], vistos[1]) >= 30, 'y gira con la hora: seis horas lo mueven más de 30°', angulo(vistos[0], vistos[1]).toFixed(1));
  s.feliz = true;
  s.felizQue = 'el polo se leyó';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LA CRUZ DEL SUR ENSEÑA EL SUR
// ═══════════════════════════════════════════════════════════════════════════

async function cruzDelSur() {
  const s = seccion(5, 'LA CRUZ DEL SUR ENSEÑA EL SUR — queMiro(), el método en el cielo del juego, el HUD y el códice');
  const NOCHE = new Date('2025-02-12T06:00Z');   // tres de la mañana en Bariloche: la Cruz a 63°
  const DIA = new Date('2025-02-12T16:00Z');     // la una de la tarde
  const cruz = [HR.acrux, HR.mimosa, HR.gacrux, HR.deltaCru].map(porHR);
  const raC = cruz.reduce((a, e) => a + e.ra, 0) / 4, decC = cruz.reduce((a, e) => a + e.dec, 0) / 4;

  // El método, con la cuenta del banco: si el banco no lo ve andar, el contrato pide de más
  const metodo = (dir) => {
    const g = dir(porHR(HR.gacrux)), a = dir(porHR(HR.acrux));
    const n = g.clone().cross(a).normalize();
    const llega = girar(a, n, 4.5 * angulo(g, a));
    const ca = dir(porHR(HR.alfaCen)), cb = dir(porHR(HR.betaCen));
    const m = ca.clone().sub(cb).normalize();
    return { llega, mediatriz: m };
  };
  const poloBanco = direccionBanco(0, -90, NOCHE);
  const mb = metodo((e) => direccionBanco(e.ra, e.dec, NOCHE));
  const errPalo = angulo(mb.llega, poloBanco), errMed = Math.abs(Math.asin(poloBanco.dot(mb.mediatriz)) / RAD);
  // El método erra por sí solo: con la cuenta del banco, 2,7° el palo y 3,0° la
  // mediatriz. Por eso el contrato pide 4° en el cielo del juego, que admite los 0,5°
  // de cada estrella. La primera versión pedía 3° y habría tirado un cielo correcto.
  s.ok(errPalo <= 3.5 && errMed <= 3.5, 'premisa: con la cuenta del banco, el método llega a 3,5° o menos del polo sur celeste', `palo ${errPalo.toFixed(2)}° · mediatriz ${errMed.toFixed(2)}°`);

  const cielo = await nuevoCielo();
  const hay = typeof cielo.queMiro === 'function' && typeof cielo.direccionDe === 'function';
  s.ok(hay, 'existen cielo.queMiro(direccion) y cielo.direccionDe(ra, dec)');
  if (hay) {
    cielo.actualizar(NOCHE, SITIO.lat, SITIO.lon, 0);
    const centro = cielo.direccionDe(raC, decC);
    s.ok(cielo.queMiro(centro.clone()) === 'cruz_del_sur', 'de noche, mirando el centro de la Cruz, queMiro dice cruz_del_sur', cielo.queMiro(centro.clone()));
    s.ok(cielo.queMiro(cielo.direccionDe(raC, decC + 8)) === 'cruz_del_sur', 'a 8° del centro, también');
    s.ok(cielo.queMiro(cielo.direccionDe(raC, decC + 20)) === null, 'a 20° del centro, no', cielo.queMiro(cielo.direccionDe(raC, decC + 20)));
    const mj = metodo((e) => cielo.direccionDe(e.ra, e.dec));
    const polo = cielo.direccionDe(0, -90);
    const ePalo = angulo(mj.llega, polo), eMed = Math.abs(Math.asin(polo.dot(mj.mediatriz)) / RAD);
    s.ok(ePalo <= 4 && eMed <= 4, 'en el cielo del juego, el método llega a 4° o menos del polo', `palo ${ePalo.toFixed(2)}° · mediatriz ${eMed.toFixed(2)}°`);
    cielo.actualizar(DIA, SITIO.lat, SITIO.lon, 0);
    s.ok(cielo.queMiro(cielo.direccionDe(raC, decC)) === null, 'de día, mirando la Cruz, no', cielo.queMiro(cielo.direccionDe(raC, decC)));
  }

  const hud = leer('ui/HUD.js');
  s.ok(/queMiro/.test(hud), 'el HUD pregunta queMiro');
  s.ok(/Cruz del Sur/.test(hud) && /cuatro veces y media|4[,.]5 veces/i.test(hud) && /puntero/i.test(hud) && /mediatriz|perpendicular|mitad/i.test(hud) && /\bsur\b/i.test(hud),
    'el HUD dice el método: el palo largo cuatro veces y media, los punteros, y el sur');
  const geo = JSON.parse(leer('data/geografia.json'));
  const claveCielo = Object.keys(geo).find((k) => /cielo/i.test(k));
  const textoCielo = claveCielo ? JSON.stringify(geo[claveCielo]) : '';
  s.ok(!!claveCielo && /Acrux/.test(textoCielo) && /Mimosa/.test(textoCielo) && /Gacrux/.test(textoCielo) && /Hoffleit/.test(textoCielo),
    'geografia.json tiene el cielo austral con los nombres y la cita del catálogo', claveCielo || 'sin bloque');
  s.ok(!!claveCielo && new RegExp(`geo\\??\\.${claveCielo}\\b|\\['${claveCielo}'\\]`).test(leer('ui/Codice.js')), 'y el códice lo pinta', claveCielo || 'sin bloque');

  s.feliz = true;
  s.felizQue = 'la sección corrió';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · SIN REGRESIÓN  ·  7 · ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════

async function regresion() {
  const s = seccion(6, 'SIN REGRESIÓN — la ronda 6 y las fases anteriores de la ronda 7');
  if (process.env.BANCO_SRC) { s.feliz = true; s.nota('salteado: corriendo contra una copia'); return s; }
  const real = { BANCO_SRC: path.join(RAIZ, 'src') };
  const otros = [
    ['banco-r6-fase1.mjs', '7/7', {}],
    ['banco-r6-fase2.mjs', '8/8', {}],
    ['banco-r6-fase3.mjs', '6/6', real],
    ['banco-r7-fase1.mjs', '6/6', real],
    ['banco-r7-fase2.mjs', '4/4', real],
    ['banco-r7-fase2b.mjs', '7/7', real],
    ['banco-r7-fase3.mjs', '6/6', real],
    ['banco-r7-fase4.mjs', '10/10', real],
    ['banco-r7-fase5.mjs', '9/9', real],
  ];
  let corrio = 0;
  for (const [archivo, esperado, env] of otros) {
    const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 900000,
      env: { ...process.env, BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_JSON: '', BANCO_SECCIONES: '', ...env },
    });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/total (\d+)\/(\d+)/);
    if (m) corrio++;
    s.ok(!!m && `${m[1]}/${m[2]}` === esperado, `${archivo} sigue en ${esperado}`, m ? `${m[1]}/${m[2]}` : salida.slice(-300));
  }
  s.feliz = corrio === otros.length;
  s.felizQue = `corrieron ${corrio} de ${otros.length} bancos anteriores`;
  return s;
}

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

const SECCIONES = { lunaDeLaFecha, cieloGira, catalogoHorneado, viaLactea, cruzDelSur, regresion, arranque };
const soloEstas = (process.env.BANCO_SECCIONES || '').split(',').filter(Boolean);

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
  if (soloEstas.length && !soloEstas.includes(nombre)) continue;
  try { todas.push(await fn()); }
  catch (e) {
    todas.push({
      num: Object.keys(SECCIONES).indexOf(nombre) + 1, nombre: `sección ${nombre}`,
      checks: [{ ok: false, desc: 'la sección corrió sin explotar', detalle: `${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}` }],
      feliz: false, felizQue: 'la sección tiró una excepción', notas: [],
    });
  }
}
todas.sort((a, b) => a.num - b.num);

if (process.env.BANCO_JSON) {
  console.log('@@RESULTADO ' + JSON.stringify(todas));
  process.exitCode = todas.every(s => s.feliz && s.checks.every(c => c.ok)) ? 0 : 1;
} else {

console.log(`\n  BANCO R7 · FASE 6 — el cielo, mitad Node   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
let verdes = 0;
for (const s of todas) {
  const verde = s.checks.every((c) => c.ok) && s.feliz;
  if (verde) verdes++;
  console.log(`  ${verde ? 'VERDE' : 'ROJO '}  ejercitó ${String(s.checks.length).padStart(3)}  ${s.num} · ${s.nombre}`);
  for (const c of s.checks) if (!c.ok || process.env.BANCO_DETALLE) console.log(`         ${c.ok ? 'ok ' : 'MAL'}  ${c.desc}${c.detalle !== undefined && c.detalle !== '' ? `  [${c.detalle}]` : ''}`);
  if (!s.feliz) console.log(`         MAL  camino feliz NO funcionó: ${s.felizQue}`);
  for (const n of s.notas) console.log(`         nota ${n}`);
}
console.log(`\n  ${todas.every((s) => s.feliz) ? 'VERDE' : 'ROJO '}  guarda del camino feliz (${todas.filter((s) => s.feliz).length}/${todas.length})`);
console.log(`  ${verdes === todas.length ? 'VERDE' : 'ROJO '}  total ${verdes}/${todas.length}\n`);
process.exitCode = verdes === todas.length ? 0 : 1;

}
