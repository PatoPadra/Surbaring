/**
 * FALSADOR DEL BANCO R8 · FASE 2 (lazo), mitad Node.
 *
 * Copia de `src/` e `index.html`, un defecto plantado, el banco contra la copia, y
 * se mira si cae la aserción declarada. `LO VIO`, `LO VIO POR OTRO`, `NO LO VIO`,
 * `NO SE PUDO PLANTAR`. Y tres CONTROLES al revés: cambios que el contrato permite,
 * con los que el banco tiene que seguir verde.
 *
 * Se escribe antes que el código del agente y se corre después. Casi todos los
 * parches envuelven lo que el CONTRATO nombra —`Trampas.prototype.evaluarPoner`,
 * `poner`, `actualizar`, `revisar`, `levantar`, `serializar`; `Recoleccion.
 * prototype.quePuedoHacer`; `Bolso.prototype._detalleHTML`; `Hallazgos.prototype.
 * dibujar`; `Partida.prototype._serializar`— y no dependen de cómo esté escrito
 * adentro. El de `_esAcuatica` reemplaza el método entero por el de la base.
 *
 * Se validó antes del código del agente contra una maqueta del jefe:
 * `FALSAR_SRC=<copia con la maqueta> node … --contra-base` no, contra la maqueta
 * todo verde, así que corre en modo normal.
 *
 * La mitad navegador —compilar, verse en el mundo y en el minimapa— no se falsa
 * desde acá, y se dice.
 *
 * Uso: node .claude/flota/banco-r8-fase2.falsar.mjs [--solo <id>] [--sintaxis]
 *      FALSAR_SRC=<otra carpeta src> para correrlo contra otra copia.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = process.env.FALSAR_SRC ? path.resolve(process.env.FALSAR_SRC) : path.join(RAIZ, 'src');
const HTML = path.join(RAIZ, 'index.html');
const BANCO = path.join(AQUI, 'banco-r8-fase2.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r8f2');
const SECCIONES = 'faunaDondeVive,poner,captura,revisar,tecla,bolso,mapa,guardar';
const CLASES = {
  'systems/Trampas.js': 'Trampas', 'systems/Recoleccion.js': 'Recoleccion', 'ui/Bolso.js': 'Bolso',
  'systems/Hallazgos.js': 'Hallazgos', 'systems/Partida.js': 'Partida', 'entities/Fauna.js': 'Fauna',
};

/** Envuelve un método; adentro, `a` son los argumentos y `r` lo que devolvió. */
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

const DEFECTOS = [
  // ── La fauna ──
  {
    id: 'acuatica-vieja', archivo: 'entities/Fauna.js', que: '_esAcuatica vuelve a tomar el mallín por agua',
    caeEn: 'las diez especies con el mallín',
    anexo: String.raw`
Fauna.prototype._esAcuatica = function (esp) {
  const biomas = (esp.biomas || []).join(' ');
  return /ribera|lacustre|mallin|humedal|acuatic|rio|lago/.test(biomas) || esp.dieta === 'piscivoro'
    || /maca|huillin|coipo|pato|cauquen|biguá|bigua|gaviota|martin_pescador|torrente/.test(esp.id);
};
`,
  },
  // ── Poner ──
  {
    id: 'lazo-en-el-agua', archivo: 'systems/Trampas.js', que: 'el lazo se pone parado en el agua',
    caeEn: 'parado en el agua, el lazo no se pone',
    anexo: envolver('Trampas', 'evaluarPoner', 'LEA', '', "if (a[0] === 'trampa_lazo' && r && !r.ok) r = { ok: true, x: a[1], z: a[2] };"),
  },
  {
    id: 'nasa-en-tierra', archivo: 'systems/Trampas.js', que: 'la nasa se pone tierra adentro',
    caeEn: 'a 100 m del agua la nasa no se pone',
    anexo: envolver('Trampas', 'evaluarPoner', 'NET', '', "if (a[0] === 'nasa_junco' && r && !r.ok) r = { ok: true, x: a[1], z: a[2] };"),
  },
  {
    id: 'no-sale-del-bolso', archivo: 'systems/Trampas.js', que: 'poner deja una copia en el bolso',
    caeEn: 'y salió del bolso',
    anexo: envolver('Trampas', 'poner', 'NSB', '', "if (r && r.ok) this.inventario.meter({ id: a[0], n: 1, usos: 1 });"),
  },
  // ── La captura ──
  {
    id: 'aptitud-doble', archivo: 'systems/Trampas.js', que: 'la trampa cuenta el doble de animales de los que hay',
    caeEn: 'la fracción de lazos con presa',
    anexo: envolver('Trampas', 'actualizar', 'AD',
      'const f = this.fauna; const ap = f._aptitud; f._aptitud = function (...b) { return 2 * ap.apply(this, b); };',
      'f._aptitud = ap;'),
  },
  {
    id: 'sin-actividad', archivo: 'systems/Trampas.js', que: 'la trampa ignora a qué hora anda cada especie',
    caeEn: 'la composición por especie',
    anexo: envolver('Trampas', 'actualizar', 'SA',
      'const f = this.fauna; const ac = f._actividad; f._actividad = function () { return 0.5; };',
      'f._actividad = ac;'),
  },
  {
    id: 'lazo-agarra-dos', archivo: 'systems/Trampas.js', que: 'el lazo sigue agarrando después de la primera',
    caeEn: 'el lazo agarra uno solo',
    anexo: envolver('Trampas', 'actualizar', 'LAD', '',
      "for (const t of this.lista) if (t.objeto === 'trampa_lazo' && t.presas && t.presas.length === 1) t.presas.push({ ...t.presas[0] });"),
  },
  {
    id: 'nasa-una-sola', archivo: 'systems/Trampas.js', que: 'la nasa se queda con un solo pez',
    caeEn: 'la nasa junta en diez horas',
    anexo: envolver('Trampas', 'actualizar', 'NUS', '',
      "for (const t of this.lista) if (t.objeto !== 'trampa_lazo' && t.presas && t.presas.length > 1) t.presas.length = 1;"),
  },
  // ── Revisar ──
  {
    id: 'protegida-rinde', archivo: 'systems/Trampas.js', que: 'lo protegido también rinde carne',
    caeEn: 'no entra nada al bolso',
    anexo: envolver('Trampas', 'revisar', 'PR', '', "if (r && r.protegida) this.inventario.agregar('carne', 1);"),
  },
  {
    id: 'panel-siempre', archivo: 'systems/Trampas.js', que: 'cada huiña frena el juego con el panel',
    caeEn: 'la segunda vez se anota, sin frenar',
    anexo: envolver('Trampas', 'revisar', 'PS',
      "const n = this.norma; const an = n.anotar; const mo = n.mostrar; n.anotar = function (v, c) { return mo.call(this, { ...v, gravedad: 'grave' }, c); }; n.mostrar = function (v, c) { return mo.call(this, { ...v, gravedad: 'grave' }, c); };",
      'n.anotar = an; n.mostrar = mo;'),
  },
  {
    id: 'lazo-eterno', archivo: 'systems/Trampas.js', que: 'el lazo no se gasta al agarrar',
    caeEn: 'el lazo se gastó',
    anexo: envolver('Trampas', 'revisar', 'LE', "const t = a[0]; const antes = this.lista.includes(t);",
      "if (antes && t.objeto === 'trampa_lazo' && !this.lista.includes(t)) { t.presas = []; this.lista.push(t); }"),
  },
  {
    id: 'levanta-sin-lugar', archivo: 'systems/Trampas.js', que: 'con el bolso lleno la trampa se levanta igual y se pierde',
    caeEn: 'con el bolso lleno no se levanta',
    anexo: envolver('Trampas', 'levantar', 'LSL', '', "if (r && !r.ok) { const i = this.lista.indexOf(a[0]); if (i >= 0) this.lista.splice(i, 1); r = { ok: true }; }"),
  },
  {
    id: 'nasa-no-gasta', archivo: 'systems/Trampas.js', que: 'la nasa no gasta usos',
    caeEn: 'y gastó un uso por pez',
    anexo: envolver('Trampas', 'revisar', 'NNG', "const t = a[0]; const u = t.usos; const ui = t.instancia ? t.instancia.usos : undefined;",
      'if (u !== undefined) t.usos = u; if (t.instancia && ui !== undefined) t.instancia.usos = ui;'),
  },
  // ── La tecla ──
  {
    id: 'tecla-muda', archivo: 'systems/Recoleccion.js', que: 'la tecla no ofrece la trampa',
    caeEn: 'a 1,5 m de un lazo, la tecla ofrece la trampa',
    anexo: envolver('Recoleccion', 'quePuedoHacer', 'TM', '', "if (r && r.tipo === 'trampa') r = null;"),
  },
  {
    id: 'trampa-antes-que-sed', archivo: 'systems/Recoleccion.js', que: 'la trampa le gana la tecla a la sed',
    caeEn: 'beber le gana a la trampa',
    anexo: envolver('Recoleccion', 'quePuedoHacer', 'TAS', '',
      "if (r && r.tipo === 'beber' && this.trampas) { const p = this.jugador.posicion; const t = this.trampas.cerca(p.x, p.z); if (t) r = { tipo: 'trampa', trampa: t, etiqueta: 'Revisar la trampa' }; }"),
  },
  // ── El bolso ──
  {
    id: 'bolso-sin-poner', archivo: 'ui/Bolso.js', que: 'el bolso no tiene el botón «Poner»',
    caeEn: 'tiene el botón «Poner»',
    anexo: envolver('Bolso', '_detalleHTML', 'BSP', '', "if (typeof r === 'string') r = r.replace(/<button[^>]*>\\s*Poner\\s*<\\/button>/g, '');"),
  },
  // ── El mapa ──
  {
    id: 'mapa-bajo-el-velo', archivo: 'systems/Hallazgos.js', que: 'el velo tapa las trampas propias',
    caeEn: 'con el velo tapando todo',
    anexo: envolver('Hallazgos', 'dibujar', 'MBV',
      "const tr = this.trampas; const ex = a[2] && a[2].exploracion; if (tr && ex) this.trampas = { ...tr, lista: tr.lista.filter((t) => ex.conocimientoEn(t.x, t.z) > 0) };",
      'this.trampas = tr;'),
  },
  {
    id: 'mapa-delata', archivo: 'systems/Hallazgos.js', que: 'el mapa marca la presa antes de revisarla',
    caeEn: 'se dibuja igual que uno vacío',
    anexo: envolver('Hallazgos', 'dibujar', 'MD', '',
      "for (const t of (this.trampas && this.trampas.lista) || []) if (t.presas && t.presas.length) { const p = a[1](t.x, t.z); a[0].beginPath(); a[0].moveTo(p.px - 2, p.py); a[0].lineTo(p.px + 2, p.py); a[0].stroke(); }"),
  },
  {
    id: 'mapa-sin-leyenda', archivo: 'systems/Hallazgos.js', que: 'la leyenda no nombra las trampas',
    caeEn: 'la leyenda dice «Tus trampas»',
    anexo: envolver('Hallazgos', 'dibujar', 'MSL',
      "const c = a[0]; const ft = c.fillText; c.fillText = function (t, ...b) { if (/tus trampas/i.test(String(t))) return; return ft.call(this, t, ...b); };",
      'c.fillText = ft;'),
  },
  // ── Se guarda ──
  {
    id: 'guarda-sin-presas', archivo: 'systems/Trampas.js', que: 'guardar pierde lo que había adentro',
    caeEn: 'las trampas vuelven con su lugar',
    anexo: envolver('Trampas', 'serializar', 'GSP', '',
      "r = JSON.parse(JSON.stringify(r, (k, v) => (k === 'presas' ? [] : v)));"),
  },
  {
    id: 'partida-olvida', archivo: 'systems/Partida.js', que: 'la partida no guarda las trampas',
    caeEn: 'las trampas vuelven con su lugar',
    anexo: envolver('Partida', '_serializar', 'PO',
      "const tr = this.trampas; const se = tr && tr.serializar; if (tr) tr.serializar = () => [];",
      'if (tr) tr.serializar = se;'),
  },

  // ── Controles ──
  {
    id: 'control-actualizar-dos', archivo: 'systems/Trampas.js', control: true, que: 'actualizar() se llama dos veces con el mismo reloj',
    anexo: envolver('Trampas', 'actualizar', 'CAD', '', '__orig_CAD.apply(this, a);'),
  },
  {
    id: 'control-poner-avisa', archivo: 'systems/Trampas.js', control: true, que: 'poner avisa de más',
    anexo: envolver('Trampas', 'poner', 'CPA', '', "if (r && r.ok && this.hud) this.hud.aviso('Trampa puesta', 'Volvé mañana');"),
  },
  {
    id: 'control-revisar-avisa', archivo: 'systems/Trampas.js', control: true, que: 'revisar avisa de más',
    anexo: envolver('Trampas', 'revisar', 'CRA', '', "if (this.hud) this.hud.aviso('Revisaste la trampa', '');"),
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
  if (!borrar(dest)) throw new Error(`no se pudo borrar la copia anterior, ${dest}`);
  fs.cpSync(SRC, path.join(dest, 'src'), { recursive: true });
  fs.copyFileSync(HTML, path.join(dest, 'index.html'));
  fs.writeFileSync(path.join(dest, 'src', 'package.json'), '{ "type": "module" }\n');
  return path.join(dest, 'src');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
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
  const archivo = path.join(destSrc, ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) return `no existe ${d.archivo}`;
  let txt = fs.readFileSync(archivo, 'utf8');
  const clase = CLASES[d.archivo];
  if (clase && !new RegExp('export\\s+class\\s+' + clase + '\\b').test(txt)) return `${clase} ya no es una clase exportada`;
  if (d.texto) {
    const nuevo = d.texto(txt);
    if (nuevo === txt) return `el texto de ${d.archivo} no cambió`;
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
    if (motivo) { console.log(`  no se planta   ${d.id.padEnd(24)} ${motivo}`); continue; }
    const r = spawnSync(process.execPath, ['--check', path.join(destSrc, ...d.archivo.split('/'))], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) malos++;
    console.log(`  ${r.status === 0 ? 'sintaxis ok' : 'NO PARSEA  '}  ${d.id.padEnd(24)} ${d.archivo}${r.status === 0 ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' / ')}`);
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} archivos parchados no parsean\n`);
  borrar(TMP);
  process.exit(malos ? 1 : 0);
}

borrar(TMP);
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R8 · FASE 2, mitad Node   (src: ${path.relative(RAIZ, SRC)} · copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (compilar, verse en el mundo y en el minimapa) no se falsa desde acá.\n');

const limpio = copiar(path.join(TMP, 'limpio'));
const base = correrBanco(limpio);
if (base.error) { console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`); process.exit(1); }
const baseMapa = aplanar(base.secciones);
const rojasBase = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
if (rojasBase.length) {
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
    } else { console.log(`  CONTROL VERDE       ${d.id.padEnd(24)} ${d.que}`); cuenta.controlOk++; }
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
if (bien && cuenta.otro === 0 && cuenta.sin === 0) try { borrar(TMP); } catch { /* no importa */ }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = bien ? 0 : 1;
