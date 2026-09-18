/**
 * FALSADOR DEL BANCO R8 · FASE 1 (rumbo), mitad Node.
 *
 * Copia de `src/` y de `index.html`, un defecto plantado, el banco contra la copia,
 * y se mira si cae la aserción declarada. `LO VIO`, `LO VIO POR OTRO`, `NO LO VIO`,
 * `NO SE PUDO PLANTAR`. Y tres CONTROLES al revés: cambios que el contrato permite, y
 * con los que el banco tiene que seguir verde; si cae, el banco fija de más.
 *
 * Se escribe antes que el código del agente y se corre después. Los parches van
 * contra lo que el CONTRATO nombra: `Mapa.prototype.dibujar` y `alternar`,
 * `Minimapa.prototype.actualizar`, `dibujar` y `aPixel`, el lienzo del mapa, la
 * constante de la escalera y la regla de `#brujula`. Casi todos envuelven un método
 * y no dependen de cómo esté escrito adentro; los dos que tocan texto (la escalera
 * y la brújula) dicen NO SE PUDO PLANTAR si el texto no está.
 *
 * La mitad navegador —el centro real de la brújula, el velo en los píxeles, el
 * costo— no se falsa desde acá, y se dice.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 *
 * Uso: node .claude/flota/banco-r8-fase1.falsar.mjs [--solo <id>] [--sintaxis] [--contra-base]
 *
 * `--contra-base` corre aunque la base tenga rojos, mirando sólo lo que estaba verde:
 * sirve para validar los parches antes de que exista el código del agente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const HTML = path.join(RAIZ, 'index.html');
const BANCO = path.join(AQUI, 'banco-r8-fase1.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r8f1');
const SECCIONES = 'flecha,brujula,zoom,abrirCentrado,minimapa';
const CLASES = { 'ui/Mapa.js': 'Mapa', 'ui/Minimapa.js': 'Minimapa' };

/** Envuelve un método de una clase; adentro, `a` son los argumentos y `r` lo que devolvió. */
function envolver(clase, metodo, nombre, antes, despues = '') {
  return String.raw`
var __orig_` + nombre + ' = ' + clase + '.prototype.' + metodo + String.raw`;
` + clase + '.prototype.' + metodo + String.raw` = function (...a) {
  ` + antes + String.raw`
  let r = __orig_` + nombre + String.raw`.apply(this, a);
  ` + despues + String.raw`
  return r;
};
`;
}

/**
 * Con el giro cambiado sólo mientras dibuja: la flecha sale mal y nada más. El giro
 * se cambia sólo en la llamada de más afuera (`__hondoGiro`, compartido): si se
 * envuelven `actualizar` y `dibujar` y uno llama al otro, sumar π dos veces da 2π y
 * no planta nada. Lo encontró el agente midiendo 0,0° con el parche puesto.
 */
const conGiro = (clase, metodo, nombre, expr) => String.raw`
var __orig_` + nombre + ' = ' + clase + '.prototype.' + metodo + String.raw`;
globalThis.__hondoGiro = globalThis.__hondoGiro || 0;
` + clase + '.prototype.' + metodo + String.raw` = function (...a) {
  if (globalThis.__hondoGiro > 0) return __orig_` + nombre + String.raw`.apply(this, a);
  const j = this.jugador; const g = j.giro;
  j.giro = ` + expr + String.raw`;
  globalThis.__hondoGiro++;
  try { return __orig_` + nombre + String.raw`.apply(this, a); } finally { globalThis.__hondoGiro--; j.giro = g; }
};
`;

/** Envuelve el dispatchEvent del lienzo del mapa la primera vez que se abre. */
const enElLienzo = (nombre, cuerpo) => String.raw`
var __alt_` + nombre + String.raw` = Mapa.prototype.alternar;
Mapa.prototype.alternar = function (...a) {
  if (this.lienzo && !this.lienzo.__falsado) {
    this.lienzo.__falsado = true;
    const lz = this.lienzo, yo = this, disp = lz.dispatchEvent.bind(lz);
    lz.dispatchEvent = function (ev) {
      const antes = { cx: yo.vista.cx, cz: yo.vista.cz };
      const r = disp(ev);
      ` + cuerpo + String.raw`
      return r;
    };
  }
  return __alt_` + nombre + String.raw`.apply(this, a);
};
`;

const DEFECTOS = [
  // ── La flecha ──
  {
    id: 'flecha-mapa-al-reves', archivo: 'ui/Mapa.js', que: 'la flecha del mapa vuelve a apuntar al revés',
    caeEn: 'mapa al nivel 0: la flecha apunta hacia donde avanza',
    anexo: conGiro('Mapa', 'dibujar', 'FMR', 'g + Math.PI'),
  },
  {
    id: 'flecha-mapa-espejada', archivo: 'ui/Mapa.js', que: 'la flecha del mapa gira para el otro lado (bien en 0 y en π, mal en el resto)',
    caeEn: 'mapa al nivel 0: la flecha apunta hacia donde avanza',
    anexo: conGiro('Mapa', 'dibujar', 'FME', '-g'),
  },
  {
    id: 'flecha-mini-al-reves', archivo: 'ui/Minimapa.js', que: 'la flecha del minimapa apunta al revés',
    caeEn: 'la flecha del minimapa apunta hacia donde avanza',
    anexo: conGiro('Minimapa', 'dibujar', 'FNR', 'g + Math.PI') + conGiro('Minimapa', 'actualizar', 'FNR2', 'g + Math.PI'),
  },

  // ── La brújula ──
  {
    id: 'brujula-sin-posicion', html: true, que: 'la regla de #brujula pierde su position',
    caeEn: '#brujula tiene position absolute o fixed',
    texto: (t) => t.replace(/(#brujula\s*\{[^}]*?)position\s*:\s*(absolute|fixed)\s*;?/, '$1'),
  },

  // ── El zoom ──
  {
    id: 'zoom-corto', archivo: 'ui/Mapa.js', que: 'la escalera vuelve a terminar en 8 m/px',
    caeEn: 'llega a 2 m/px o menos',
    texto: (t) => t.replace(/const\s+ZOOMS\s*=\s*\[[^\]]*\]/, 'const ZOOMS = [1, 2, 3.2, 6.4, 12.8]'),
  },
  {
    id: 'zoom-al-centro', archivo: 'ui/Mapa.js', que: 'la rueda amplía hacia el centro de la vista y no hacia el cursor',
    caeEn: 'la rueda deja quieto lo que está bajo el cursor',
    anexo: enElLienzo('ZAC', "if (ev.type === 'wheel') { yo.vista.cx = antes.cx; yo.vista.cz = antes.cz; }"),
  },
  {
    id: 'vista-se-sale', archivo: 'ui/Mapa.js', que: 'arrastrando, la vista se va del mundo',
    caeEn: 'la ventana nunca se sale del mundo',
    anexo: enElLienzo('VSS', "if (ev.type === 'pointermove' && yo.nivel > 0) { yo.vista.cx += 40000; }"),
  },
  {
    id: 'flecha-escala', archivo: 'ui/Mapa.js', que: 'todo lo que se dibuja encima escala con el zoom',
    caeEn: 'la flecha mide lo mismo en píxeles',
    anexo: envolver('Mapa', 'dibujar', 'FE',
      "const k = Math.sqrt(102.4 / this.vista.mpp); const c = this.ctx; const tr = c.translate.bind(c); c.translate = function (x, y) { tr(x, y); if (k !== 1 && !c.__k) { c.__k = true; c.scale(k, k); } }; ",
      'delete this.ctx.translate; this.ctx.__k = false;'),
  },
  {
    id: 'no-centra', archivo: 'ui/Mapa.js', que: 'abrir el mapa deja la vista donde estaba',
    caeEn: 'abrir centra la vista en el jugador',
    anexo: envolver('Mapa', 'alternar', 'NC', 'const v = { cx: this.vista.cx, cz: this.vista.cz };',
      'if (this.abierto) { this.vista.cx = v.cx; this.vista.cz = v.cz; }'),
  },

  // ── El minimapa ──
  {
    id: 'mini-norte-abajo', archivo: 'ui/Minimapa.js', que: 'el minimapa se proyecta con el norte abajo',
    caeEn: 'el norte (−z) queda arriba',
    anexo: envolver('Minimapa', 'aPixel', 'MNA', '', 'r = { px: r.px, py: this.lienzo.height - r.py };'),
  },
  {
    id: 'mini-ventana-grande', archivo: 'ui/Minimapa.js', que: 'la ventana del minimapa mide cinco veces más',
    caeEn: 'la ventana mide entre 400 y 1500 m',
    anexo: envolver('Minimapa', 'aPixel', 'MVG', '', 'const W = this.lienzo.width / 2, H = this.lienzo.height / 2; r = { px: W + (r.px - W) / 5, py: H + (r.py - H) / 5 };'),
  },
  {
    id: 'mini-cada-cuadro', archivo: 'ui/Minimapa.js', que: 'el minimapa se redibuja en todos los cuadros',
    caeEn: 'y no en todos los cuadros',
    anexo: envolver('Minimapa', 'actualizar', 'MCC', '', "if (!this.el.classList.contains('oculto')) this.dibujar();"),
  },
  {
    id: 'mini-no-se-esconde', archivo: 'ui/Minimapa.js', que: 'con el mapa abierto el minimapa no se esconde',
    caeEn: 'lleva la clase oculto',
    anexo: envolver('Minimapa', 'actualizar', 'MNE', '', "this.el.classList.remove('oculto');"),
  },
  {
    id: 'mini-dibuja-oculto', archivo: 'ui/Minimapa.js', que: 'con el mapa abierto el minimapa se sigue dibujando',
    caeEn: 'y no dibuja nada mientras tanto',
    anexo: envolver('Minimapa', 'actualizar', 'MDO', '', 'if (this.mapa && this.mapa.abierto) this.dibujar();'),
  },
  {
    id: 'mini-sin-marcas', archivo: 'ui/Minimapa.js', que: 'el minimapa no pide las marcas a Hallazgos',
    caeEn: 'dibujar() pide las marcas a hallazgos.dibujar',
    anexo: envolver('Minimapa', 'dibujar', 'MSM', 'const h = this.hallazgos; this.hallazgos = null;', 'this.hallazgos = h;')
      + envolver('Minimapa', 'actualizar', 'MSM2', 'const h2 = this.hallazgos; this.hallazgos = null;', 'this.hallazgos = h2;'),
  },
  {
    id: 'mini-reconstruye', archivo: 'ui/Minimapa.js', que: 'el minimapa tira su relieve en cada cuadro',
    caeEn: 'a lo sumo una reconstrucción',
    anexo: envolver('Minimapa', 'actualizar', 'MR',
      "for (const k of Object.keys(this)) { if (/tile|recorte|cache|relieve|fondo|lamina|lámina/i.test(k) && this[k] && typeof this[k] === 'object' && !(this[k] === this.el || this[k] === this.lienzo || this[k] === this.ctx)) this[k] = null; }"),
  },

  // ── Controles: cambios que el contrato permite ──
  {
    id: 'control-flecha-doble', archivo: 'ui/Mapa.js', control: true, que: 'el mapa se dibuja dos veces seguidas',
    anexo: envolver('Mapa', 'dibujar', 'CFD', '', '__orig_CFD.apply(this, a);'),
  },
  {
    id: 'control-abrir-dibuja', archivo: 'ui/Mapa.js', control: true, que: 'abrir el mapa lo dibuja una vez de más',
    anexo: envolver('Mapa', 'alternar', 'CAD', '', 'if (this.abierto) this.dibujar();'),
  },
  {
    id: 'control-mini-primero', archivo: 'ui/Minimapa.js', control: true, que: 'el minimapa se dibuja de más en su primer cuadro',
    anexo: envolver('Minimapa', 'actualizar', 'CMP', '', "if (!this.__primero) { this.__primero = true; if (!this.el.classList.contains('oculto')) this.dibujar(); }"),
  },
];

function borrar(p) {
  for (let i = 0; i < 6; i++) {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      return true;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (i + 1));
    }
  }
  return !fs.existsSync(p);
}

/** Copia `src/` y `index.html` a `dest/src` y `dest/index.html`: el banco lee el html al lado de src. */
function copiar(dest) {
  if (!borrar(dest)) throw new Error(`no se pudo borrar la copia anterior, ${dest}`);
  fs.cpSync(SRC, path.join(dest, 'src'), { recursive: true });
  fs.copyFileSync(HTML, path.join(dest, 'index.html'));
  fs.writeFileSync(path.join(dest, 'src', 'package.json'), '{ "type": "module" }\n');
  return path.join(dest, 'src');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_SECCIONES: SECCIONES },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/@@RESULTADO (.+)/);
  return m ? { secciones: JSON.parse(m[1]) } : { error: salida.slice(-800) || '(el banco no imprimió nada)' };
}

function aplanar(secciones) {
  const m = new Map();
  for (const s of secciones) {
    for (const c of s.checks) m.set(`${s.num}·${c.desc}`, c.ok);
    m.set(`${s.num}·CAMINO FELIZ`, s.feliz);
  }
  return m;
}

function plantar(destSrc, d) {
  const archivo = d.html ? path.join(destSrc, '..', 'index.html') : path.join(destSrc, ...d.archivo.split('/'));
  const nombre = d.html ? 'index.html' : d.archivo;
  if (!fs.existsSync(archivo)) return `no existe ${nombre}`;
  let txt = fs.readFileSync(archivo, 'utf8');
  const clase = CLASES[d.archivo];
  if (clase && !new RegExp('export\\s+class\\s+' + clase + '\\b').test(txt)) return `${clase} ya no es una clase exportada`;
  if (d.texto) {
    const nuevo = d.texto(txt);
    if (nuevo === txt) return `el texto de ${nombre} no cambió: no está lo que el parche busca`;
    txt = nuevo;
  }
  if (d.anexo) txt += `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.anexo}\n`;
  fs.writeFileSync(archivo, txt);
  return null;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

if (process.argv.includes('--sintaxis')) {
  borrar(TMP);
  fs.mkdirSync(TMP, { recursive: true });
  let malos = 0;
  for (const d of DEFECTOS) {
    if (solo && d.id !== solo) continue;
    const destSrc = copiar(path.join(TMP, d.id));
    const motivo = plantar(destSrc, d);
    if (motivo) { console.log(`  no se planta             ${d.id.padEnd(24)} ${motivo}`); continue; }
    if (d.html) { console.log(`  html      ${d.id.padEnd(24)} index.html`); continue; }
    const r = spawnSync(process.execPath, ['--check', path.join(destSrc, ...d.archivo.split('/'))], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    const ok = r.status === 0;
    if (!ok) malos++;
    console.log(`  ${ok ? 'sintaxis ok' : 'NO PARSEA  '}  ${d.id.padEnd(24)} ${d.archivo}${ok ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' / ')}`);
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} archivos parchados no parsean\n`);
  borrar(TMP);
  process.exit(malos ? 1 : 0);
}

borrar(TMP);
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R8 · FASE 1, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (el centro real de la brújula, el velo en los píxeles, el costo)');
console.log('        no se falsa desde acá, y las secciones 6 y 7 se saltean con BANCO_SRC.\n');

const limpio = copiar(path.join(TMP, 'limpio'));
const base = correrBanco(limpio);
if (base.error) { console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`); process.exit(1); }
const baseMapa = aplanar(base.secciones);
const rojasBase = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
const contraBase = process.argv.includes('--contra-base');
if (rojasBase.length && contraBase) {
  console.log(`  --contra-base: la base tiene ${rojasBase.length} aserciones rojas; se mira sólo lo que estaba verde
`);
} else if (rojasBase.length) {
  console.log(`  ROJO  la base ya tiene ${rojasBase.length} aserciones caídas; arreglar primero:`);
  for (const k of rojasBase.slice(0, 14)) console.log(`          ${k}`);
  process.exit(1);
}
console.log(`  base limpia: ${baseMapa.size} aserciones, todas verdes\n`);

const cuenta = { vio: 0, otro: 0, no: 0, sin: 0, controlOk: 0, controlMal: 0 };
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  const destSrc = copiar(path.join(TMP, d.id));
  const motivo = plantar(destSrc, d);
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(destSrc);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  if (d.control) {
    if (caidas.length) {
      console.log(`  CONTROL ROJO        ${d.id.padEnd(24)} ${d.que}`);
      console.log(`                      el banco fija de más, cayó: ${caidas.slice(0, 3).join(' · ')}`);
      cuenta.controlMal++;
    } else {
      console.log(`  CONTROL VERDE       ${d.id.padEnd(24)} ${d.que}`);
      cuenta.controlOk++;
    }
    continue;
  }
  const declarada = caidas.find((k) => k.includes(d.caeEn));
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
    console.log('                      el banco quedó VERDE con el defecto puesto');
    cuenta.no++;
  }
}

const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
const bien = cuenta.no === 0 && cuenta.controlMal === 0;
console.log(`\n  ${bien ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}` +
  `  ·  controles ${cuenta.controlOk} verdes, ${cuenta.controlMal} rojos\n`);
if (bien && cuenta.otro === 0 && cuenta.sin === 0)
  try { borrar(TMP); } catch { /* no importa */ }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = bien ? 0 : 1;
