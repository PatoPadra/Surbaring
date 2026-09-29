/**
 * BANCO DE LA FASE 4c (primer-año / hitos) — ronda 9.
 *
 * `Relevamiento.js` es una clase pura (sin DOM más que `localStorage`, que se
 * stubea acá mismo), así que corre en Node de verdad, no contra el navegador.
 *
 *   H1 · `registrarMuerte()` pone `murioEnElAnio = true` y `resumen().sinMorir`
 *        pasa a `false`, SIN tocar `dias`/`inicioMs`.
 *   H2 · `registrarMuerte()` persiste: una instancia nueva que lee el mismo
 *        `localStorage` recupera `murioEnElAnio = true`.
 *   H3 · sin morir nunca, `sinMorir` es `true` desde el principio.
 *   H4 · `olvidar()` también borra la racha (vuelve a `true`).
 *   H5 · `actualizar()`/`cerrado`/`dias` siguen exactamente igual que antes
 *        (sin regresión de lo que ya existía).
 *
 * Uso: node .claude/flota/banco-r9-fase4c.mjs   ·   BANCO_SRC, BANCO_JSON,
 *      BANCO_DETALLE
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.BANCO_SRC ? path.resolve(process.env.BANCO_SRC) : path.join(RAIZ, 'src');
const urlDe = (rel) => pathToFileURL(path.join(SRC, ...rel.split('/'))).href + `?v=${Date.now()}_${Math.random()}`;

function seccion(num, nombre) {
  const s = { num, nombre, checks: [], feliz: false, felizQue: '', notas: [] };
  s.ok = (c, d, det) => { s.checks.push({ ok: !!c, desc: d, detalle: det === undefined ? undefined : String(det) }); return !!c; };
  s.nota = (t) => s.notas.push(String(t));
  return s;
}

/** Un `localStorage` de mentira, propio por corrida, para no pisar el real. */
function localStorageFalso() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _mapa: m,
  };
}

async function Relevamiento() {
  const mod = await import(urlDe('systems/Relevamiento.js'));
  return mod.Relevamiento;
}

/** Un `tiempo` de mentira: sólo hace falta `.fecha`, mutable. */
function tiempoFalso(fechaIso = '2025-09-21T13:20:00.000Z') {
  return { fecha: new Date(fechaIso) };
}

// ── 1 · H1, la racha se reinicia sin tocar los días ─────────────────────────

async function rachaSinTocarDias() {
  const s = seccion(1, 'H1 · registrarMuerte() marca la racha sin tocar dias/inicioMs');
  const R = await Relevamiento();
  globalThis.localStorage = localStorageFalso();
  const tiempo = tiempoFalso();
  const rel = new R({ tiempo });
  rel.comenzar(tiempo.fecha);
  const inicioAntes = rel.inicioMs;
  // El reloj avanza ANTES de morir: si registrarMuerte() reiniciara inicioMs a
  // la fecha de hoy (el defecto que se quiere cazar), inicioAntes y el nuevo
  // valor difieren. Sin este avance, un reinicio a "la fecha de hoy" pasaría
  // inadvertido cuando "hoy" coincide por casualidad con el inicio real.
  tiempo.fecha = new Date(tiempo.fecha.getTime() + 10 * 86400000);
  const diasAntes = rel.dias;

  s.ok(rel.resumen().sinMorir === true, 'antes de morir, sinMorir es true', rel.resumen().sinMorir);
  rel.registrarMuerte();
  s.ok(rel.murioEnElAnio === true, 'murioEnElAnio pasa a true', rel.murioEnElAnio);
  s.ok(rel.resumen().sinMorir === false, 'resumen().sinMorir pasa a false', rel.resumen().sinMorir);
  s.ok(rel.inicioMs === inicioAntes, 'inicioMs no cambió', `${inicioAntes} → ${rel.inicioMs}`);
  s.ok(rel.dias === diasAntes, 'dias no cambió', `${diasAntes} → ${rel.dias}`);

  // Morir dos veces no rompe nada (idempotente en los hechos que importan).
  rel.registrarMuerte();
  s.ok(rel.murioEnElAnio === true, 'una segunda muerte no revierte la bandera', rel.murioEnElAnio);

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'la racha tocó algo que no debía, o no se marcó';
  return s;
}

// ── 2 · H2, persiste ─────────────────────────────────────────────────────────

async function persiste() {
  const s = seccion(2, 'H2 · registrarMuerte() persiste entre instancias');
  const R = await Relevamiento();
  const ls = localStorageFalso();
  globalThis.localStorage = ls;
  const tiempo = tiempoFalso();
  const rel1 = new R({ tiempo });
  rel1.comenzar(tiempo.fecha);
  rel1.registrarMuerte();

  globalThis.localStorage = ls; // el mismo almacenamiento
  const rel2 = new R({ tiempo });
  s.ok(rel2.murioEnElAnio === true, 'una instancia nueva recupera murioEnElAnio', rel2.murioEnElAnio);
  s.ok(rel2.inicioMs === rel1.inicioMs, 'y el mismo inicioMs', `${rel1.inicioMs} vs ${rel2.inicioMs}`);

  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'la racha no sobrevivió a una instancia nueva';
  return s;
}

// ── 3 · H3, sin morir nunca ──────────────────────────────────────────────────

async function sinMorirNunca() {
  const s = seccion(3, 'H3 · sin morir nunca, sinMorir es true desde el principio');
  const R = await Relevamiento();
  globalThis.localStorage = localStorageFalso();
  const tiempo = tiempoFalso();
  const rel = new R({ tiempo });
  rel.comenzar(tiempo.fecha);
  s.ok(rel.resumen().sinMorir === true, 'sinMorir arranca en true', rel.resumen().sinMorir);
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'sinMorir no arrancó en true';
  return s;
}

// ── 4 · H4, olvidar() también borra la racha ────────────────────────────────

async function olvidarBorraRacha() {
  const s = seccion(4, 'H4 · olvidar() también reinicia la racha');
  const R = await Relevamiento();
  globalThis.localStorage = localStorageFalso();
  const tiempo = tiempoFalso();
  const rel = new R({ tiempo });
  rel.comenzar(tiempo.fecha);
  rel.registrarMuerte();
  rel.olvidar();
  s.ok(rel.murioEnElAnio === false, 'murioEnElAnio vuelve a false', rel.murioEnElAnio);
  s.ok(rel.inicioMs === null, 'inicioMs vuelve a null (comportamiento ya existente)', rel.inicioMs);
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'olvidar() no reinició la racha';
  return s;
}

// ── 5 · H5, sin regresión de lo que ya existía ──────────────────────────────

async function sinRegresionPropia() {
  const s = seccion(5, 'H5 · dias/cerrado/actualizar() siguen igual que antes');
  const R = await Relevamiento();
  globalThis.localStorage = localStorageFalso();
  const tiempo = tiempoFalso('2025-09-21T00:00:00.000Z');
  const rel = new R({ tiempo });
  rel.comenzar(tiempo.fecha);
  s.ok(rel.dias === 0, 'día 0 al arrancar', rel.dias);
  tiempo.fecha = new Date(tiempo.fecha.getTime() + 400 * 86400000); // 400 días después
  // `dias` NO se topa (400 de verdad): el que se topa es `fraccion`, y no es
  // parte de este contrato — no se reimplementa acá lo que ya prueban otras
  // rondas, sólo se confirma que esta fase no lo movió.
  s.ok(rel.dias === 400, 'dias sigue sin techo, como siempre', rel.dias);
  s.ok(rel.fraccion === 1, 'fraccion sigue topada en 1', rel.fraccion);
  s.ok(rel.cerrado === false, 'todavía no se llamó actualizar(): cerrado sigue false', rel.cerrado);
  let llamado = null;
  rel.alCumplirse = (r) => { llamado = r; };
  rel.actualizar();
  s.ok(rel.cerrado === true, 'actualizar() cierra el año pasado el día 365', rel.cerrado);
  s.ok(!!llamado, 'alCumplirse se llamó', !!llamado);
  s.ok(llamado?.sinMorir === true, 'y el resumen que recibe trae sinMorir', llamado?.sinMorir);
  s.feliz = s.checks.every((c) => c.ok);
  s.felizQue = s.feliz ? '' : 'algo del comportamiento viejo cambió';
  return s;
}

// ── Corrida ─────────────────────────────────────────────────────────────────

const SECCIONES = { rachaSinTocarDias, persiste, sinMorirNunca, olvidarBorraRacha, sinRegresionPropia };

const todas = [];
for (const [nombre, fn] of Object.entries(SECCIONES)) {
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

console.log(`\n  BANCO R9 · FASE 4c — hitos (primer-año)   (src: ${path.relative(RAIZ, SRC) || 'src'})\n`);
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
