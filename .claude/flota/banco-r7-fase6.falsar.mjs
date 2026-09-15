/**
 * FALSADOR DEL BANCO R7 · FASE 6 (cielo), mitad Node.
 *
 * Copia de `src/`, un defecto plantado, el banco contra la copia, y se mira si cae
 * la aserción declarada. `LO VIO`, `LO VIO POR OTRO`, `NO LO VIO`, `NO SE PUDO
 * PLANTAR`. Y tres CONTROLES al revés: cambios que el contrato permite, y con los
 * que el banco tiene que seguir verde; si cae, el banco fija de más.
 *
 * Se escribe antes que el código del agente y se corre después. Los parches van
 * contra lo que el CONTRATO nombra: `Cielo.prototype.actualizar`, `direccionDe`,
 * `queMiro`, `direccionLuna`, `uFaseLunar`, `uPoloGalactico`, la tabla
 * `src/data/estrellas.json`, el bloque del cielo de `geografia.json` y el texto del
 * HUD. No dependen de la efeméride ni de cómo se dibujan las estrellas.
 *
 * La mitad navegador —la imagen, la fase del disco, la luz de la noche y el costo— no
 * se falsa desde acá, y se dice.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 *
 * Uso: node .claude/flota/banco-r7-fase6.falsar.mjs [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase6.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f6');
const SECCIONES = 'lunaDeLaFecha,cieloGira,catalogoHorneado,viaLactea,cruzDelSur';
const CLASES = { 'world/Cielo.js': 'Cielo' };

/** Envuelve un método de `Cielo` y deja `r` con lo que devolvió el original. */
function envolver(metodo, nombre, cuerpo) {
  return String.raw`
var __orig_` + nombre + String.raw` = Cielo.prototype.` + metodo + String.raw`;
Cielo.prototype.` + metodo + String.raw` = function (...a) {
  let r = __orig_` + nombre + String.raw`.apply(this, a);
  ` + cuerpo + String.raw`
  return r;
};
`;
}

const GIRAR = String.raw`
var __girarY = (v, grados) => { const c = Math.cos(grados * Math.PI / 180), s = Math.sin(grados * Math.PI / 180); return new THREE.Vector3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); };
var __subir = (v, grados) => { const alt = Math.asin(Math.max(-1, Math.min(1, v.y))) + grados * Math.PI / 180; const h = Math.hypot(v.x, v.z) || 1; return new THREE.Vector3(v.x / h * Math.cos(alt), Math.sin(alt), v.z / h * Math.cos(alt)); };
`;

const cieloDe = (d) => Object.keys(d).find((k) => /cielo/i.test(k));

const DEFECTOS = [
  // ── La luna ──
  {
    id: 'luna-sin-paralaje', archivo: 'world/Cielo.js', que: 'la luna se calcula geocéntrica: queda un grado arriba',
    caeEn: 'la luna queda a 0,5° o menos de JPL',
    anexo: GIRAR + envolver('actualizar', 'LSP', String.raw`this.direccionLuna.copy(__subir(this.direccionLuna.clone().normalize(), 0.95 * Math.cos(Math.asin(Math.max(-1, Math.min(1, this.direccionLuna.y))))));`),
  },
  {
    id: 'luna-en-oposicion', archivo: 'world/Cielo.js', que: 'la luna va siempre en oposición al sol',
    caeEn: 'la luna queda a 0,5° o menos de JPL',
    anexo: envolver('actualizar', 'LEO', String.raw`this.direccionLuna.copy(this.direccionSol).negate();`),
  },
  {
    id: 'fase-vieja', archivo: 'world/Cielo.js', que: 'la fase vuelve a ser la cuenta sin época',
    caeEn: 'uFaseLunar es la fracción iluminada',
    anexo: envolver('actualizar', 'FV', String.raw`const f = ((a[0].getTime() / 86400000) % 29.53) / 29.53; this.uniformes.uFaseLunar.value = 0.5 - 0.5 * Math.cos(f * Math.PI * 2);`),
  },
  {
    id: 'fase-es-edad', archivo: 'world/Cielo.js', que: 'uFaseLunar es la edad de la luna, no la fracción iluminada',
    caeEn: 'uFaseLunar es la fracción iluminada',
    anexo: envolver('actualizar', 'FE', String.raw`const k = this.uniformes.uFaseLunar.value; this.uniformes.uFaseLunar.value = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * k))) / (2 * Math.PI);`),
  },

  // ── El cielo gira ──
  {
    id: 'cielo-quieto', archivo: 'world/Cielo.js', que: 'direccionDe no gira con la hora',
    caeEn: 'siete estrellas en cuatro instantes',
    anexo: envolver('direccionDe', 'CQ', String.raw`const clave = a[0] + ',' + a[1]; this.__quieto = this.__quieto || new Map(); if (this.__quieto.has(clave)) r = this.__quieto.get(clave).clone(); else this.__quieto.set(clave, r.clone());`),
  },
  {
    id: 'eje-torcido', archivo: 'world/Cielo.js', que: 'el cielo gira alrededor de un eje corrido 5° del sur',
    caeEn: 'el eje de giro está sobre el sur',
    anexo: GIRAR + envolver('direccionDe', 'ET', String.raw`r = __girarY(r, 5);`),
  },
  {
    id: 'hemisferio-norte', archivo: 'world/Cielo.js', que: 'el cielo se dibuja espejado de norte a sur',
    caeEn: 'siete estrellas en cuatro instantes',
    anexo: envolver('direccionDe', 'HN', String.raw`r = new THREE.Vector3(r.x, r.y, -r.z);`),
  },

  // ── El catálogo ──
  {
    id: 'tabla-incompleta', archivo: 'data/estrellas.json', que: 'faltan las estrellas entre magnitud 4,5 y 5',
    caeEn: 'están todas las estrellas hasta magnitud 5',
    json: (d) => { if (!Array.isArray(d.estrellas)) return 'la tabla no tiene estrellas'; d.estrellas = d.estrellas.filter((f) => !(f[2] > 4.5 && f[2] <= 5.0)); },
  },
  {
    id: 'magnitudes-corridas', archivo: 'data/estrellas.json', que: 'las magnitudes de la tabla están corridas medio punto',
    caeEn: 'están todas las estrellas hasta magnitud 5',
    json: (d) => { if (!Array.isArray(d.estrellas)) return 'la tabla no tiene estrellas'; for (const f of d.estrellas) f[2] = +(f[2] + 0.5).toFixed(2); },
  },
  {
    id: 'tabla-sin-cita', archivo: 'data/estrellas.json', que: 'la tabla no cita el catálogo',
    caeEn: 'la tabla cita el catálogo',
    json: (d) => { for (const k of Object.keys(d)) if (k !== 'estrellas') delete d[k]; },
  },
  {
    id: 'ruido-vuelve', archivo: 'world/Cielo.js', que: 'el campo de estrellas de ruido vuelve al shader',
    caeEn: 'el campo de estrellas de ruido ya no está en el shader',
    texto: (t) => t.replace(/void main\(\) \{\s*\n\s*vec3 dir = normalize\(vDir\);/, (m) => m + '\n  vec3 pe = dir * 260.0;'),
  },

  // ── La Vía Láctea ──
  {
    id: 'galactico-fijo', archivo: 'world/Cielo.js', que: 'el polo galáctico queda fijo en el mundo',
    caeEn: 'apunta al polo norte galáctico',
    anexo: envolver('actualizar', 'GF', String.raw`if (this.uniformes.uPoloGalactico) this.uniformes.uPoloGalactico.value.set(0.42, 0.36, -0.83).normalize();`),
  },
  {
    id: 'galactico-corrido', archivo: 'world/Cielo.js', que: 'el polo galáctico está corrido 10°',
    caeEn: 'apunta al polo norte galáctico',
    anexo: GIRAR + envolver('actualizar', 'GC', String.raw`if (this.uniformes.uPoloGalactico) this.uniformes.uPoloGalactico.value.copy(__girarY(this.uniformes.uPoloGalactico.value, 10));`),
  },

  // ── La Cruz del Sur ──
  {
    id: 'quemiro-siempre', archivo: 'world/Cielo.js', que: 'queMiro dice cruz_del_sur mire donde mire',
    caeEn: 'a 20° del centro, no',
    anexo: envolver('queMiro', 'QS', String.raw`r = 'cruz_del_sur';`),
  },
  {
    id: 'quemiro-de-dia', archivo: 'world/Cielo.js', que: 'queMiro nombra la Cruz también de día',
    caeEn: 'de día, mirando la Cruz, no',
    anexo: envolver('queMiro', 'QD', String.raw`
  if (r === null && typeof this.direccionDe === 'function') {
    const c = new THREE.Vector3();
    for (const [ra, dec] of [[186.65, -63.1], [191.93, -59.69], [187.79, -57.11], [183.79, -58.75]]) c.add(this.direccionDe(ra, dec));
    c.normalize();
    const d = a[0].clone().normalize();
    if (Math.acos(Math.max(-1, Math.min(1, c.dot(d)))) * 180 / Math.PI <= 12) r = 'cruz_del_sur';
  }`),
  },
  {
    id: 'quemiro-estrecho', archivo: 'world/Cielo.js', que: 'queMiro sólo nombra la Cruz a 3° de su centro',
    caeEn: 'a 8° del centro, también',
    anexo: envolver('queMiro', 'QE', String.raw`
  if (r !== null && typeof this.direccionDe === 'function') {
    const c = new THREE.Vector3();
    for (const [ra, dec] of [[186.65, -63.1], [191.93, -59.69], [187.79, -57.11], [183.79, -58.75]]) c.add(this.direccionDe(ra, dec));
    c.normalize();
    const d = a[0].clone().normalize();
    if (Math.acos(Math.max(-1, Math.min(1, c.dot(d)))) * 180 / Math.PI > 3) r = null;
  }`),
  },
  {
    id: 'hud-sin-metodo', archivo: 'ui/HUD.js', que: 'el HUD nombra la Cruz pero no dice cuánto prolongar',
    caeEn: 'el HUD dice el método',
    texto: (t) => t.replace(/cuatro veces y media/gi, 'un buen trecho').replace(/4[,.]5 veces/gi, 'un buen trecho'),
  },
  {
    id: 'codice-sin-cielo', archivo: 'data/geografia.json', que: 'el códice no tiene el cielo austral',
    caeEn: 'geografia.json tiene el cielo austral',
    json: (d) => { const k = cieloDe(d); if (!k) return 'no hay bloque del cielo'; delete d[k]; },
  },

  // ── Controles al revés ──
  {
    id: 'control-luna-corrida-poco', control: true, archivo: 'world/Cielo.js', que: 'la luna corrida 0,2°, dentro de la tolerancia',
    anexo: GIRAR + envolver('actualizar', 'CL', String.raw`this.direccionLuna.copy(__girarY(this.direccionLuna.clone().normalize(), 0.2));`),
  },
  {
    id: 'control-tabla-con-mas', control: true, archivo: 'data/estrellas.json', que: 'la tabla trae estrellas de más, más débiles',
    json: (d) => { if (!Array.isArray(d.estrellas)) return 'la tabla no tiene estrellas'; for (let k = 0; k < 50; k++) d.estrellas.push([k * 7.1 % 360, -80 + (k * 3.3 % 160), 6.4]); },
  },
  {
    id: 'control-quemiro-10', control: true, archivo: 'world/Cielo.js', que: 'queMiro nombra la Cruz hasta 10°, no 12°',
    anexo: envolver('queMiro', 'C10', String.raw`
  if (r !== null && typeof this.direccionDe === 'function') {
    const c = new THREE.Vector3();
    for (const [ra, dec] of [[186.65, -63.1], [191.93, -59.69], [187.79, -57.11], [183.79, -58.75]]) c.add(this.direccionDe(ra, dec));
    c.normalize();
    const d = a[0].clone().normalize();
    if (Math.acos(Math.max(-1, Math.min(1, c.dot(d)))) * 180 / Math.PI > 10) r = null;
  }`),
  },
];

// ── La corrida ──────────────────────────────────────────────────────────────

/**
 * Borrar una carpeta recién escrita falla en Windows con ENOTEMPTY cuando el
 * antivirus o el indexador todavía tienen abierto alguno de sus archivos, y los
 * reintentos de `rmSync` no siempre alcanzan: una corrida se cayó al limpiar,
 * después de haber dado el veredicto. Se reintenta con esperas que crecen.
 *
 * @returns {boolean} si quedó borrada
 */
function borrar(p) {
  for (let i = 0; i < 6; i++) {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      return true;
    } catch {
      // Espera sincrónica: acá no hay nada más que hacer mientras tanto
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (i + 1));
    }
  }
  return !fs.existsSync(p);
}

function copiarSrc(dest) {
  // Limpiar al final es optativo, pero esto no: copiar sobre una copia vieja
  // mezclaría dos parches y el falsador mediría cualquier cosa.
  if (!borrar(dest)) throw new Error(`no se pudo borrar la copia anterior, ${dest}`);
  fs.cpSync(SRC, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), '{ "type": "module" }\n');
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

function plantar(dest, d) {
  const archivo = path.join(dest, ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) return `no existe ${d.archivo}`;
  let txt = fs.readFileSync(archivo, 'utf8');
  const clase = CLASES[d.archivo];
  if (clase && !new RegExp('export\\s+class\\s+' + clase + '\\b').test(txt)) return `${clase} ya no es una clase exportada`;
  if (d.json) {
    const datos = JSON.parse(txt);
    const motivo = d.json(datos);
    if (typeof motivo === 'string') return motivo;
    txt = JSON.stringify(datos, null, 2);
  }
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
  const ARRANQUE = 'globalThis.addEventListener=()=>{};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};'
    + 'globalThis.document={addEventListener(){},createElement:()=>({getContext:()=>null,style:{}})};';
  let malos = 0;
  for (const d of DEFECTOS) {
    if (solo && d.id !== solo) continue;
    const dest = path.join(TMP, d.id);
    copiarSrc(dest);
    const motivo = plantar(dest, d);
    if (motivo) { console.log(`  no se planta en la base  ${d.id.padEnd(28)} ${motivo}`); continue; }
    if (!d.archivo.endsWith('.js')) { console.log(`  dato      ${d.id.padEnd(28)} ${d.archivo}`); continue; }
    const url = 'file:///' + path.join(dest, ...d.archivo.split('/')).replace(/\\/g, '/');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `${ARRANQUE}await import(${JSON.stringify(url)});`], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    const ok = r.status === 0;
    if (!ok) malos++;
    console.log(`  ${ok ? 'carga   ' : 'NO CARGA'}  ${d.id.padEnd(28)} ${d.archivo}${ok ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' / ')}`);
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} archivos parchados no cargan\n`);
  borrar(TMP);
  process.exit(malos ? 1 : 0);
}

borrar(TMP);
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R7 · FASE 6, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (la imagen, la fase del disco, la luz de la noche y el costo)');
console.log('        no se falsa desde acá, y las secciones 6 y 7 se saltean con BANCO_SRC.\n');

const limpio = path.join(TMP, 'limpio');
copiarSrc(limpio);
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
  const dest = path.join(TMP, d.id);
  copiarSrc(dest);
  const motivo = plantar(dest, d);
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(28)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(28)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  if (d.control) {
    if (caidas.length) {
      console.log(`  CONTROL ROJO        ${d.id.padEnd(28)} ${d.que}`);
      console.log(`                      el banco fija de más, cayó: ${caidas.slice(0, 3).join(' · ')}`);
      cuenta.controlMal++;
    } else {
      console.log(`  CONTROL VERDE       ${d.id.padEnd(28)} ${d.que}`);
      cuenta.controlOk++;
    }
    continue;
  }
  const declarada = caidas.find((k) => k.includes(d.caeEn));
  if (declarada) {
    console.log(`  LO VIO              ${d.id.padEnd(28)} ${d.que}`);
    console.log(`                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`);
    cuenta.vio++;
  } else if (caidas.length) {
    console.log(`  LO VIO POR OTRO     ${d.id.padEnd(28)} ${d.que}`);
    console.log(`                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`);
    cuenta.otro++;
  } else {
    console.log(`  NO LO VIO           ${d.id.padEnd(28)} ${d.que}`);
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
