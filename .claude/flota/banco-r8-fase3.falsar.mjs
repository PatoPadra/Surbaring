/**
 * FALSADOR DEL BANCO R8 · FASE 3 (suelo), mitad Node.
 *
 * Copia de `src/`, `tools/`, `public/tex/suelo/` e `index.html` **con sus fechas**
 * —el banco exige capturas más nuevas que el código, y copiar sin fechas haría
 * todo «nuevo»—, un defecto plantado, el banco contra la copia, y se mira si cae la
 * aserción declarada. Los parches del horno se agregan al final del script del
 * horno y trabajan sobre lo que él escribió: no dependen de cómo está hecho
 * adentro, sólo del manifiesto que pide el contrato. Después de plantar se le
 * devuelve la fecha al archivo tocado, salvo en el defecto que prueba justamente
 * la fecha.
 *
 * Lo que no se falsa desde acá: el costo en la placa y la compilación (mitad
 * navegador), y las imágenes mismas (se miden las capturas que ya existen).
 *
 * Uso: node --max-old-space-size=6144 .claude/flota/banco-r8-fase3.falsar.mjs [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const BANCO = path.join(AQUI, 'banco-r8-fase3.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r8f3');
const SECCIONES = 'horno,terreno,imagen,piso';

/** Código que se agrega al final del horno: corre después de que él escribió todo. */
const alFinalDelHorno = (cuerpo) => String.raw`
{
  const __fs = await import('node:fs');
  const __path = await import('node:path');
  const __url = await import('node:url');
  const __png = (await import('pngjs')).default.PNG;
  const __dir = __path.join(__path.dirname(__url.fileURLToPath(import.meta.url)), '..', 'public', 'tex', 'suelo');
  const __man = JSON.parse(__fs.readFileSync(__path.join(__dir, 'manifiesto.json'), 'utf8'));
  ` + cuerpo + String.raw`
}
`;

const DEFECTOS = [
  {
    id: 'horno-con-reloj', archivo: 'tools/hornear-suelo.mjs', que: 'el horno escribe la hora en su salida',
    caeEn: 'correrlo dos veces da los mismos bytes',
    anexo: alFinalDelHorno("__fs.writeFileSync(__path.join(__dir, 'sello.txt'), String(Date.now()) + Math.random());"),
  },
  {
    id: 'capa-con-costura', archivo: 'tools/hornear-suelo.mjs', que: 'la primera capa no calza: su última columna es negra',
    caeEn: 'calza consigo misma',
    anexo: alFinalDelHorno("const f = __path.join(__dir, __man.capas[0].archivos.albedo); const p = __png.sync.read(__fs.readFileSync(f)); for (let y = 0; y < p.height; y++) { const k = (y * p.width + p.width - 1) * 4; p.data[k] = p.data[k + 1] = p.data[k + 2] = 0; } __fs.writeFileSync(f, __png.sync.write(p));"),
  },
  {
    id: 'albedo-mentido', archivo: 'tools/hornear-suelo.mjs', que: 'el manifiesto declara un albedo medio que no es',
    caeEn: 'el albedo medio declarado es el medido',
    anexo: alFinalDelHorno("__man.capas[0].albedoMedio = +(__man.capas[0].albedoMedio + 0.05).toFixed(4); __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2));"),
  },
  {
    id: 'normal-fuera', archivo: 'tools/hornear-suelo.mjs', que: 'la normal se sale del disco unidad',
    caeEn: 'la normal (R, G) cae en el disco unidad',
    anexo: alFinalDelHorno("const f = __path.join(__dir, __man.capas[0].archivos.normal); const p = __png.sync.read(__fs.readFileSync(f)); for (let k = 0; k < p.data.length; k += 4 * 37) { p.data[k] = 255; p.data[k + 1] = 255; } __fs.writeFileSync(f, __png.sync.write(p));"),
  },
  {
    id: 'tres-capas', archivo: 'tools/hornear-suelo.mjs', que: 'el manifiesto tiene sólo tres capas',
    caeEn: 'cuatro capas o más',
    anexo: alFinalDelHorno("__man.capas = __man.capas.slice(0, 3); __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2));"),
  },
  {
    id: 'sin-referencia', archivo: 'tools/hornear-suelo.mjs', que: 'una capa no dice de dónde sale',
    caeEn: 'declara nombre, referencia, período y albedo medio',
    anexo: alFinalDelHorno("__man.capas[1].referencia = ''; __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2));"),
  },
  {
    id: 'terreno-sin-capas', archivo: 'src/world/Terreno.js', que: 'el terreno no declara la textura de capas',
    caeEn: 'declara una textura de capas',
    texto: (t) => t.replace(/sampler2DArray/g, 'sampler2D'),
  },
  {
    id: 'cargador-miente', archivo: 'src/util/suelo.js', que: 'sin archivos, el cargador dice que hay',
    caeEn: 'dice que no hay',
    texto: (t) => t.replace(/disponible\s*:\s*false/g, 'disponible: true'),
  },
  {
    id: 'piso-movido', archivo: 'src/world/Mundo.js', que: 'la altura del piso se corre un milímetro',
    caeEn: 'la huella de la base',
    anexo: 'var __alt = Mundo.prototype.alturaEn; Mundo.prototype.alturaEn = function (...a) { return __alt.apply(this, a) + 0.001; };',
  },
  {
    id: 'captura-vieja', archivo: 'src/world/Terreno.js', que: 'el código es más nuevo que las capturas',
    caeEn: 'más nuevas que el código', tocarFecha: true,
    texto: (t) => t + '\n// (sin cambios: sólo la fecha)\n',
  },
  // ── Controles ──
  {
    id: 'control-horno-leeme', archivo: 'tools/hornear-suelo.mjs', control: true, que: 'el horno escribe además un LEEME fijo',
    anexo: alFinalDelHorno("__fs.writeFileSync(__path.join(__dir, 'LEEME.txt'), 'Salida de tools/hornear-suelo.mjs. No se edita a mano.\\n');"),
  },
  {
    id: 'control-comentario', archivo: 'src/world/Terreno.js', control: true, que: 'un comentario más en el terreno, sin tocar la fecha',
    texto: (t) => t + '\n// Comentario de control del falsador.\n',
  },
  {
    id: 'control-periodo', archivo: 'tools/hornear-suelo.mjs', control: true, que: 'otro período declarado en una capa',
    anexo: alFinalDelHorno("__man.capas[0].periodoM = +(__man.capas[0].periodoM * 1.5).toFixed(3); __fs.writeFileSync(__path.join(__dir, 'manifiesto.json'), JSON.stringify(__man, null, 2));"),
    // Sólo las secciones del horno y del terreno: el período de la capa 0 es el que usa
    // el juego (uSueloPeriodo), así que la imagen cambia de verdad y la sección 3 hace
    // bien en pedir capturas nuevas. El control mira que el horno no fije el número.
    secciones: [1, 2],
  },
];

function borrar(p) {
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); return true; } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (i + 1));
    }
  }
  return !fs.existsSync(p);
}

function copiar(dest) {
  if (!borrar(dest)) throw new Error(`no se pudo borrar ${dest}`);
  const op = { recursive: true, preserveTimestamps: true };
  fs.cpSync(path.join(RAIZ, 'src'), path.join(dest, 'src'), op);
  fs.cpSync(path.join(RAIZ, 'tools'), path.join(dest, 'tools'), { ...op, filter: (f) => !f.includes(`${path.sep}catalogos`) });
  if (fs.existsSync(path.join(RAIZ, 'public', 'tex', 'suelo'))) fs.cpSync(path.join(RAIZ, 'public', 'tex', 'suelo'), path.join(dest, 'public', 'tex', 'suelo'), op);
  fs.copyFileSync(path.join(RAIZ, 'index.html'), path.join(dest, 'index.html'));
  fs.writeFileSync(path.join(dest, 'src', 'package.json'), '{ "type": "module" }\n');
  fs.writeFileSync(path.join(dest, 'tools', 'package.json'), '{ "type": "module" }\n');
  return path.join(dest, 'src');
}

function plantar(destSrc, d) {
  const archivo = path.join(destSrc, '..', ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) return `no existe ${d.archivo}`;
  const st = fs.statSync(archivo);
  let txt = fs.readFileSync(archivo, 'utf8');
  if (d.texto) {
    const nuevo = d.texto(txt);
    if (nuevo === txt) return `el texto de ${d.archivo} no cambió`;
    txt = nuevo;
  }
  if (d.anexo) txt += `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.anexo}\n`;
  fs.writeFileSync(archivo, txt);
  if (!d.tocarFecha) fs.utimesSync(archivo, st.atime, st.mtime);
  return null;
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=6144', BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 1800000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_SECCIONES: SECCIONES },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/@@RESULTADO (.+)/);
  return m ? { secciones: JSON.parse(m[1]) } : { error: salida.slice(-800) || '(el banco no imprimió nada)' };
}

function aplanar(secciones) {
  const m = new Map();
  for (const s of secciones) { for (const c of s.checks) m.set(`${s.num}·${c.desc}`, c.ok); m.set(`${s.num}·CAMINO FELIZ`, s.feliz); }
  return m;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

if (process.argv.includes('--sintaxis')) {
  borrar(TMP); fs.mkdirSync(TMP, { recursive: true });
  let malos = 0;
  for (const d of DEFECTOS) {
    if (solo && d.id !== solo) continue;
    const destSrc = copiar(path.join(TMP, d.id));
    const motivo = plantar(destSrc, d);
    if (motivo) { console.log(`  no se planta   ${d.id.padEnd(22)} ${motivo}`); continue; }
    const r = spawnSync(process.execPath, ['--check', path.join(destSrc, '..', ...d.archivo.split('/'))], { cwd: RAIZ, encoding: 'utf8' });
    if (r.status !== 0) malos++;
    console.log(`  ${r.status === 0 ? 'sintaxis ok' : 'NO PARSEA  '}  ${d.id.padEnd(22)} ${d.archivo}${r.status === 0 ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 3).join(' / ')}`);
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} no parsean\n`);
  borrar(TMP);
  process.exit(malos ? 1 : 0);
}

borrar(TMP); fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R8 · FASE 3, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
const base = correrBanco(copiar(path.join(TMP, 'limpio')));
if (base.error) { console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`); process.exit(1); }
const baseMapa = aplanar(base.secciones);
const rojas = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
if (rojas.length) { console.log(`  ROJO  la base tiene ${rojas.length} aserciones caídas:`); for (const k of rojas.slice(0, 14)) console.log(`          ${k}`); process.exit(1); }
console.log(`  base limpia: ${baseMapa.size} aserciones, todas verdes\n`);

const cuenta = { vio: 0, otro: 0, no: 0, sin: 0, controlOk: 0, controlMal: 0 };
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  const destSrc = copiar(path.join(TMP, d.id));
  const motivo = plantar(destSrc, d);
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(destSrc);
  if (r.error) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} el banco no arrancó: ${r.error.split('\n').slice(-3).join(' / ')}`); cuenta.sin++; continue; }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k)
    .filter((k) => !d.secciones || d.secciones.some((n) => k.startsWith(`${n}·`)));
  if (d.control) {
    if (caidas.length) { console.log(`  CONTROL ROJO        ${d.id.padEnd(22)} ${d.que}\n                      cayó: ${caidas.slice(0, 3).join(' · ')}`); cuenta.controlMal++; }
    else { console.log(`  CONTROL VERDE       ${d.id.padEnd(22)} ${d.que}`); cuenta.controlOk++; }
    continue;
  }
  const declarada = caidas.find((k) => k.includes(d.caeEn));
  if (declarada) { console.log(`  LO VIO              ${d.id.padEnd(22)} ${d.que}\n                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`); cuenta.vio++; }
  else if (caidas.length) { console.log(`  LO VIO POR OTRO     ${d.id.padEnd(22)} ${d.que}\n                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`); cuenta.otro++; }
  else { console.log(`  NO LO VIO           ${d.id.padEnd(22)} ${d.que}`); cuenta.no++; }
}
const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
const bien = cuenta.no === 0 && cuenta.controlMal === 0;
console.log(`\n  ${bien ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}  ·  controles ${cuenta.controlOk} verdes, ${cuenta.controlMal} rojos\n`);
if (bien && !cuenta.otro && !cuenta.sin) try { borrar(TMP); } catch { /* no importa */ }
process.exitCode = bien ? 0 : 1;
