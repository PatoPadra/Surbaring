/**
 * FALSADOR DEL BANCO R6 · FASE 3.
 *
 * Mismo método que en las fases 1 y 2: los defectos se plantan **pegando un
 * parche al final del módulo copiado**, no buscando texto en el código del
 * agente. La copia lleva un `package.json` al lado, sin el cual Node lee los
 * `.js` como CommonJS y todas las secciones mueren por la misma razón.
 *
 * Ojo con una cosa de esta fase: la sección 5 del banco corre los bancos
 * anteriores contra `src/` de verdad, así que se saltea cuando hay `BANCO_SRC`.
 * El falsador no puede medir esa sección, y está bien: lo dice acá y no finge.
 *
 * Uso: node .claude/flota/banco-r6-fase3.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r6-fase3.mjs');

/**
 * Los parches envuelven lo que el módulo exporte, sea cual sea el nombre: el
 * banco ya acepta varias puertas (`arteDe`, `svgDe`, `ARTE`…) y el falsador
 * tiene que romper la que exista, no la que a mí me guste.
 */
const ENVOLVER = `
function __puertaArte() {
  for (const f of ['arteDe','svgDe','dibujoDe','iconoDe']) if (typeof __mod[f] === 'function') return f;
  return null;
}
function __pisarArte(fn) {
  const f = __puertaArte();
  if (f) { const _o = __mod[f]; __mod[f] = (id) => fn(_o(id), id); return true; }
  return false;
}
`;

const DEFECTOS = [
  {
    id: 'todos-el-mismo',
    que: 'los 115 son el mismo dibujo pintado de 115 colores',
    caeEn: 'hay al menos 25 siluetas distintas',
    parche: `__pisarArte((a, id) => {
      const color = '#' + (Math.abs([...String(id)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % 0xffffff).toString(16).padStart(6, '0');
      return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><rect x='8' y='8' width='40' height='40' fill='" + color + "'/><circle cx='28' cy='28' r='12' fill='#222'/><path d='M8 48 L48 48' stroke='#111' stroke-width='3'/></svg>";
    });`,
  },
  {
    id: 'dos-identicos',
    que: 'la lasca y el cuchillo terminan con el dibujo exactamente igual',
    caeEn: 'no hay dos iconos idénticos',
    parche: `__pisarArte((a, id) => (id === 'cuchillo' ? __mod.__arteLasca ?? a : (id === 'lasca' ? (__mod.__arteLasca = a) : a)));`,
    // se corre dos veces para que la primera cachee la lasca
    precalentar: ['lasca', 'cuchillo'],
  },
  {
    id: 'icono-pobre',
    que: 'tres iconos quedan con dos formas y a 56 px no se distinguen',
    caeEn: 'ninguno tiene menos de 3 formas',
    parche: `__pisarArte((a, id) => (['yesca','fibra','pluma'].includes(id)
      ? "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><rect x='10' y='10' width='36' height='36' fill='#8a7'/><circle cx='28' cy='28' r='9' fill='#332'/></svg>" : a));`,
  },
  {
    id: 'sin-viewbox',
    que: 'un icono pierde el viewBox y deja de escalar con la casilla',
    caeEn: 'todos declaran viewBox',
    parche: `__pisarArte((a, id) => (id === 'piedra' ? String(a).replace(/viewBox\\s*=\\s*(['"])[^'"]*\\1/i, '') : a));`,
  },
  {
    id: 'svg-cortado',
    que: 'un icono queda cortado y no cierra la etiqueta',
    caeEn: 'todos son SVG que abre y cierra',
    parche: `__pisarArte((a, id) => (id === 'carne' ? String(a).replace('</svg>', '') : a));`,
  },
  {
    id: 'falta-un-recurso',
    que: 'un recurso se queda sin dibujo y nadie lo nota',
    caeEn: 'recursos tienen dibujo',
    parche: `__pisarArte((a, id) => (id === 'propoleo' ? undefined : a));`,
  },
  {
    id: 'falta-un-objeto',
    que: 'un objeto se queda sin dibujo',
    caeEn: 'objetos tienen dibujo',
    parche: `__pisarArte((a, id) => (id === 'rastra' ? undefined : a));`,
  },
  {
    id: 'sin-reserva',
    que: 'un id desconocido no devuelve nada, y el agujero queda invisible',
    caeEn: 'un id desconocido igual devuelve un dibujo',
    parche: `{ const _ids = new Set(__todosLosIds); __pisarArte((a, id) => (_ids.has(id) ? a : undefined)); }`,
  },
  {
    id: 'reserva-es-un-icono',
    que: 'lo desconocido cae en el dibujo de la piedra y se confunde con una piedra',
    caeEn: 'el de reserva no es el de ninguno de los 115',
    parche: `{ const _ids = new Set(__todosLosIds); __pisarArte((a, id) => (_ids.has(id) ? a : __mod.__arteDeLaPiedra)); }`,
    precalentar: ['piedra'],
    guardar: `__mod.__arteDeLaPiedra = __puertaArte() ? __mod[__puertaArte()]('piedra') : null;`,
  },
  {
    id: 'hoja-gorda',
    que: 'la hoja se va a 300 kB porque cada icono duplica su arte',
    caeEn: 'la hoja pesa 140 kB o menos',
    parche: `{ for (const f of ['hoja','css','construirHoja','hojaDeEstilos']) if (typeof __mod[f] === 'function') {
      const _h = __mod[f]; __mod[f] = (...a) => { const s = _h(...a); return s + s + s + s; }; break; } }`,
  },
  {
    id: 'clase-fuera-de-la-hoja',
    que: 'la clase que pide el bolso no está en la hoja: la casilla queda en blanco',
    caeEn: 'esa clase está en la hoja',
    parche: `{ for (const f of ['claseDe','clasePara','claseIcono']) if (typeof __mod[f] === 'function') {
      const _c = __mod[f]; __mod[f] = (id) => String(_c(id)) + '-x9'; break; } }`,
  },
  {
    id: 'sin-imagen-de-fondo',
    que: 'la hoja deja de usar imagen de fondo y vuelve a costar repintar',
    caeEn: 'el dibujo viaja como imagen de fondo',
    parche: `{ for (const f of ['hoja','css','construirHoja','hojaDeEstilos']) if (typeof __mod[f] === 'function') {
      const _h = __mod[f]; __mod[f] = (...a) => String(_h(...a)).replace(/background(-image)?\\s*:/gi, 'x-bg:'); break; } }`,
  },
];

// Los defectos que tocan el bolso se plantan en su archivo, por texto, porque
// no hay módulo que envolver: es marcado.
const DEFECTOS_BOLSO = [
  {
    id: 'bolso-svg-en-linea',
    que: 'el bolso vuelve a armar SVG en línea por celda, que cuesta doce veces más',
    caeEn: 'el bolso NO arma SVG en línea por celda',
    anexo: `\n// DEFECTO PLANTADO\nexport const __enLinea = (id) => \`<svg viewBox="0 0 56 56"><rect width="56" height="56"/></svg>\`;\n`,
  },
  {
    id: 'bolso-no-importa',
    que: 'el bolso deja de importar los iconos y dibuja las abreviaturas de siempre',
    caeEn: 'el bolso importa los iconos',
    reemplazo: [/Iconos\.js/g, 'Iconos_NO.js'],
  },
];

function copiarSrc(dest) {
  fs.cpSync(SRC, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), '{ "type": "module" }\n');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/@@RESULTADO (.+)/);
  return m ? { secciones: JSON.parse(m[1]) } : { error: salida.slice(-800) };
}

function aplanar(secciones) {
  const m = new Map();
  for (const s of secciones) {
    for (const c of s.checks) m.set(`${s.num}·${c.desc}`, c.ok);
    m.set(`${s.num}·CAMINO FELIZ`, s.feliz);
  }
  return m;
}

/** El preámbulo que le da al parche `__mod` y la lista de ids. */
function preambulo() {
  return `
import * as __modNS from './Iconos.js';
const __mod = __modNS;
`;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'falsar-r6f3-'));
console.log(`\n  FALSADOR R6 · FASE 3   (copias en ${tmp})\n`);
console.log('  nota: la sección 5 del banco (sin regresión) corre los bancos anteriores contra');
console.log('        `src/` de verdad y se saltea con BANCO_SRC, así que el falsador no la mide.\n');

const limpio = path.join(tmp, 'limpio');
copiarSrc(limpio);
const base = correrBanco(limpio);
if (base.error) { console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`); process.exit(1); }
const baseMapa = aplanar(base.secciones);
const rojasBase = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
if (rojasBase.length) {
  console.log(`  ROJO  la base ya tiene ${rojasBase.length} aserciones caídas; el falsador no puede`);
  console.log(`        distinguir su defecto de lo que ya estaba mal. Arreglar primero:`);
  for (const k of rojasBase.slice(0, 14)) console.log(`          ${k}`);
  process.exit(1);
}
console.log(`  base limpia: ${baseMapa.size} aserciones, todas verdes\n`);

const cuenta = { vio: 0, otro: 0, no: 0, sin: 0 };

function informar(d, r) {
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(0, 3).join(' / ')}`);
    cuenta.sin++; return;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  const declarada = caidas.find(k => k.includes(d.caeEn));
  if (declarada) {
    console.log(`  LO VIO              ${d.id.padEnd(24)} ${d.que}`);
    console.log(`                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`);
    cuenta.vio++;
  } else if (caidas.length) {
    console.log(`  LO VIO POR OTRO     ${d.id.padEnd(24)} ${d.que}`);
    console.log(`                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`);
    cuenta.otro++;
  } else {
    console.log(`  NO LO VIO           ${d.id.padEnd(24)} ${d.que}`);
    console.log(`                      el banco quedó VERDE con el defecto puesto`);
    cuenta.no++;
  }
}

// ── Los que envuelven el módulo de iconos ───────────────────────────────────
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  const dest = path.join(tmp, d.id);
  copiarSrc(dest);
  const archivo = path.join(dest, 'ui', 'Iconos.js');
  if (!fs.existsSync(archivo)) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} no existe ui/Iconos.js`);
    cuenta.sin++; continue;
  }
  // Se pega un módulo envoltorio al final del propio archivo: puede pisar sus
  // exportaciones porque las ligaduras de un módulo son vivas.
  const ids = JSON.parse(fs.readFileSync(path.join(AQUI, 'r6-ids.json'), 'utf8'));
  const extra = [
    `\n\n/* DEFECTO PLANTADO: ${d.que} */`,
    `const __mod = await import('./Iconos.js');`,
    `const __todosLosIds = ${JSON.stringify(ids)};`,
    ENVOLVER,
    d.guardar || '',
    ...(d.precalentar || []).map(id => `try { __puertaArte() && __mod[__puertaArte()](${JSON.stringify(id)}); } catch {}`),
    d.parche,
  ].join('\n');
  fs.appendFileSync(archivo, extra + '\n');
  informar(d, correrBanco(dest));
}

// ── Los que tocan el bolso ──────────────────────────────────────────────────
for (const d of DEFECTOS_BOLSO) {
  if (solo && d.id !== solo) continue;
  const dest = path.join(tmp, d.id);
  copiarSrc(dest);
  const archivo = path.join(dest, 'ui', 'Bolso.js');
  let txt = fs.readFileSync(archivo, 'utf8');
  if (d.reemplazo) txt = txt.replace(d.reemplazo[0], d.reemplazo[1]);
  if (d.anexo) txt += d.anexo;
  fs.writeFileSync(archivo, txt);
  informar(d, correrBanco(dest));
}

const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
console.log(`\n  ${cuenta.no === 0 ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}\n`);
if (cuenta.no === 0 && cuenta.otro === 0) fs.rmSync(tmp, { recursive: true, force: true });
else console.log(`  las copias quedan en ${tmp} para mirarlas\n`);
process.exitCode = cuenta.no === 0 ? 0 : 1;
