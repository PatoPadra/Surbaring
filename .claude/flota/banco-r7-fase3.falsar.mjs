/**
 * FALSADOR DEL BANCO R7 · FASE 3 (barro), mitad Node.
 *
 * Copia de `src/`, un defecto plantado, el banco contra la copia, y se mira si cae
 * la aserción declarada. `LO VIO`, `NO LO VIO`, `NO SE PUDO PLANTAR`.
 *
 * Los parches van contra lo que el CONTRATO nombra y ya existía antes del agente:
 * `Recoleccion.prototype.quePuedoHacer` y `actuar`, la gramática del paréntesis de
 * la fase 1, `Taller.prototype.pintar` y el `#tl-cuerpo` donde escribe,
 * `Hallazgos.prototype.revisar` y su tabla `TIPOS`, `Mineria.prototype.evaluar`,
 * `Equipo.puesto` de la ronda 6, y el dataset. No dependen de cómo el agente llamó
 * a sus gestos.
 *
 * La mitad navegador (A3 y los 600 m) no se falsa desde acá, y se dice.
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 *
 * Uso: node .claude/flota/banco-r7-fase3.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase3.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f3');

/**
 * Lo común a los parches de Recoleccion: qué promete una etiqueta.
 *
 * Con `var` y no con `const`: un defecto que junta un envoltorio del cartel y uno de
 * `actuar` pega esto dos veces, y un `const` repetido es un error de sintaxis que no
 * deja cargar el módulo. La primera corrida lo contó como «lo vio por otro motivo»,
 * cuando el defecto no había llegado a existir.
 */
const COMUN_REC = String.raw`
var __prometeNumero = (etq, nombre) => new RegExp('\\d+\\s*(?:[–-]\\s*\\d+)?\\s*×\\s*' + nombre, 'i').test(etq || '');
`;

function cartel(cuerpo) {
  return COMUN_REC + String.raw`
const __qph = Recoleccion.prototype.quePuedoHacer;
Recoleccion.prototype.quePuedoHacer = function (...args) {
  let acc = __qph.apply(this, args);
  ` + cuerpo + String.raw`
  return acc;
};
`;
}

function actuar(antes, despues) {
  return COMUN_REC + String.raw`
const __actuar = Recoleccion.prototype.actuar;
Recoleccion.prototype.actuar = function (...args) {
  const acc = this.quePuedoHacer(...args);
  ` + antes + String.raw`
  const salida = __actuar.apply(this, args);
  ` + despues + String.raw`
  return salida;
};
`;
}

function taller(cuerpo) {
  return String.raw`
const __pintar = Taller.prototype.pintar;
Taller.prototype.pintar = function (...args) {
  const r = __pintar.apply(this, args);
  const el = document.getElementById('tl-cuerpo');
  if (el) { let html = String(el.innerHTML); ` + cuerpo + String.raw` el.innerHTML = html; }
  return r;
};
`;
}

const DEFECTOS = [
  // ── La barranca ──
  {
    id: 'barranca-muda', archivo: 'systems/Recoleccion.js', que: 'la barranca no se ofrece nunca',
    caeEn: 'en la banda de orilla, la tecla ofrece arcilla con su paréntesis',
    anexo: cartel(String.raw`if (acc && __prometeNumero(acc.etiqueta, 'arcilla')) acc = null;`),
  },
  {
    id: 'rinde-de-mas', archivo: 'systems/Recoleccion.js', que: 'la barranca da una arcilla más de la que promete',
    caeEn: 'y la tecla da eso',
    anexo: actuar('', String.raw`if (acc && __prometeNumero(acc.etiqueta, 'arcilla')) this.inventario.agregar('arcilla', 1);`),
  },
  {
    id: 'numero-escrito', archivo: 'systems/Recoleccion.js', que: 'el cartel tiene el 1 escrito a mano y no sigue al dataset',
    caeEn: 'con el dataset cambiado, el cartel y la tecla dan el número nuevo',
    anexo: cartel(String.raw`if (acc && __prometeNumero(acc.etiqueta, 'arcilla')) acc = { ...acc, etiqueta: String(acc.etiqueta).replace(/\d+(\s*[–-]\s*\d+)?(\s*×\s*arcilla)/i, '1$2') };`),
  },
  {
    id: 'no-descansa', archivo: 'systems/Recoleccion.js', que: 'la barranca recién sacada se vuelve a ofrecer: es una canilla',
    caeEn: 'recién sacada, la barranca descansa',
    anexo: cartel(String.raw`const p = this.jugador.posicion;
  if (acc && __prometeNumero(acc.etiqueta, 'arcilla')) this.__ultima = { x: p.x, z: p.z, acc };
  else if (this.__ultima && Math.hypot(this.__ultima.x - p.x, this.__ultima.z - p.z) < 0.5) acc = this.__ultima.acc;`),
  },
  {
    id: 'no-vuelve', archivo: 'systems/Recoleccion.js', que: 'una barranca sacada no vuelve a dar nunca',
    caeEn: 'y con el tiempo vuelve a ofrecerla',
    anexo: actuar('', String.raw`if (acc && __prometeNumero(acc.etiqueta, 'arcilla')) { const p = this.jugador.posicion; (this.__agotadas ||= []).push([p.x, p.z]); }`)
      + String.raw`
const __qphNV = Recoleccion.prototype.quePuedoHacer;
Recoleccion.prototype.quePuedoHacer = function (...args) {
  const acc = __qphNV.apply(this, args);
  const p = this.jugador.posicion;
  if (acc && __prometeNumero(acc.etiqueta, 'arcilla') && (this.__agotadas || []).some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 0.5)) return null;
  return acc;
};
`,
  },
  {
    id: 'sin-desgaste', archivo: 'systems/Recoleccion.js', que: 'sacar arcilla con la pala no la gasta',
    caeEn: 'y gasta un uso de la herramienta',
    anexo: actuar(String.raw`const __cosa = this.equipo && this.equipo.puesto && this.equipo.puesto.mano; const __usos = __cosa ? __cosa.usos : null;`,
      String.raw`if (__cosa && acc && __prometeNumero(acc.etiqueta, 'arcilla')) __cosa.usos = __usos;`),
  },
  {
    id: 'arcilla-lejos', archivo: 'systems/Recoleccion.js', que: 'la tecla promete arcilla lejos del agua',
    caeEn: 'lejos del agua la tecla no ofrece arcilla',
    anexo: cartel(String.raw`if (!this.mundo.orillaCerca(this.jugador.posicion.x, this.jugador.posicion.z)) acc = { tipo: 'falsa', etiqueta: 'Sacar arcilla (1 × arcilla)' };`),
  },

  // ── La arena ──
  {
    id: 'arena-en-parque', archivo: 'systems/Recoleccion.js', que: 'en el Parque la playa da arena igual',
    caeEn: 'en el Parque la tecla no ofrece arena',
    anexo: cartel(String.raw`const p = this.jugador.posicion;
  if (this.mineria && this.mineria.limites.jurisdiccion(p.x, p.z) === 'parque' && this.mineria.yacimientoEn(p.x, p.z)?.id === 'arena' && !(this.__yaDio)) acc = { tipo: 'arena_falsa', etiqueta: 'Juntar arena (1 × arena)' };`)
      + actuar('', String.raw`if (acc && acc.tipo === 'arena_falsa') { this.inventario.agregar('arena', 1); this.__yaDio = true; }`),
  },
  {
    id: 'arena-carga', archivo: 'systems/Recoleccion.js', que: 'el puñado de arena es una carga de cantera',
    caeEn: 'es un puñado: dos o menos por vez',
    anexo: actuar('', String.raw`if (acc && /arena/i.test(acc.etiqueta || '') && /×\s*arena|a veces arena/i.test(acc.etiqueta || '')) this.inventario.agregar('arena', 3);`),
  },
  {
    id: 'aviso-sin-licencia', archivo: 'systems/Recoleccion.js', que: 'el primer puñado no dice que es una licencia',
    caeEn: 'el aviso del primer puñado dice que es una licencia',
    anexo: actuar(String.raw`const __aviso = this.hud.aviso; this.hud.aviso = (t, d) => __aviso.call(this.hud, String(t).replace(/licencia/gi, 'permiso'), String(d ?? '').replace(/licencia/gi, 'permiso'));`,
      String.raw`this.hud.aviso = __aviso;`),
  },
  {
    id: 'licencia-borrada', archivo: 'data/herramientas.json', que: 'la licencia de la arena no está declarada',
    caeEn: 'licenciasDeJuego tiene una licencia de la arena',
    json: (d) => { d.licenciasDeJuego.licencias = d.licenciasDeJuego.licencias.filter((l) => !/arena/i.test(`${l.id} ${l.que}`)); },
  },
  {
    id: 'cantera-abierta', archivo: 'systems/Mineria.js', que: 'la cantera en la Reserva pasa a estar permitida',
    caeEn: 'la cantera en Reserva sigue negándose',
    // Con el yacimiento del lugar: el veredicto negado de la Reserva no lo trae, y la
    // cadena de la tecla lee `v.yacimiento.nombre` cuando está permitido. Sin él, la
    // primera versión no abría la cantera: rompía `quePuedoHacer` con una excepción.
    anexo: String.raw`
const __evaluar = Mineria.prototype.evaluar;
Mineria.prototype.evaluar = function (x, z, ahora) {
  const v = __evaluar.call(this, x, z, ahora);
  const yac = this.yacimientoEn(x, z);
  return v.jurisdiccion === 'reserva' && yac ? { ...v, permitido: true, yacimiento: yac, castigo: 0 } : v;
};
`,
  },

  // ── Lo que falta ──
  {
    id: 'sin-origen', archivo: 'ui/Taller.js', que: 'lo que falta no dice de dónde sale',
    caeEn: 'lo que falta dice el origen de la arcilla',
    anexo: taller(String.raw`html = html.replace(/dep[oó]sitos glacilacustres de las orillas/gi, '').replace(/dep[oó]sitos glacifluviales y playas de lago/gi, '');`),
  },
  {
    id: 'distancia-inventada', archivo: 'ui/Taller.js', que: 'sin nada anotado, el taller inventa un lugar',
    caeEn: 'sin nada anotado, no inventa un lugar',
    anexo: taller(String.raw`if (!this.hallazgos || !this.hallazgos.celdas || this.hallazgos.celdas.size === 0) html += ' <small>la más cercana a 815 m al noroeste · a 1218 m al sur</small>';`),
  },
  {
    id: 'sin-rumbo', archivo: 'ui/Taller.js', que: 'el taller dice a cuánto pero no hacia dónde',
    caeEn: 'y hacia dónde: la arcilla queda al noroeste',
    anexo: taller(String.raw`html = html.replace(/\b(noroeste|noreste|suroeste|sureste|norte|sur|este|oeste|NO|NE|SO|SE|N|S|E|O)\b/g, '');`),
  },
  {
    id: 'distancia-doble', archivo: 'ui/Taller.js', que: 'el taller dice el doble de la distancia',
    caeEn: 'con arcilla anotada, dice a cuánto queda la más cercana',
    anexo: taller(String.raw`html = html.replace(/(\d+(?:[.,]\d+)?)(\s*)(km|m)\b/g, (m, n, e, u) => (parseFloat(n.replace(',', '.')) * 2).toString().replace('.', ',') + e + u);`),
  },

  // ── Una sola regla ──
  {
    id: 'mapa-viejo', archivo: 'systems/Hallazgos.js', que: 'el mapa no marca la barranca que la tecla da',
    caeEn: 'en cada punto, el mapa marca arcilla si y sólo si la tecla la da',
    anexo: String.raw`
const __revisar = Hallazgos.prototype.revisar;
Hallazgos.prototype.revisar = function (...a) {
  const r = __revisar.apply(this, a);
  for (const [k, v] of this.celdas) this.celdas.set(k, v & ~TIPOS.arcilla.bit);
  return r;
};
`,
  },
  {
    id: 'mapa-de-mas', archivo: 'systems/Hallazgos.js', que: 'el mapa marca arcilla en cualquier lado',
    caeEn: 'en cada punto, el mapa marca arcilla si y sólo si la tecla la da',
    anexo: String.raw`
const __revisarM = Hallazgos.prototype.revisar;
Hallazgos.prototype.revisar = function (pos, ...a) {
  const r = __revisarM.call(this, pos, ...a);
  this.anotar(pos.x, pos.z, 'arcilla');
  return r;
};
`,
  },
];

function copiarSrc(dest) {
  fs.rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  fs.cpSync(SRC, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), '{ "type": "module" }\n');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_SECCIONES: 'barranca,arena,loQueFalta,unaRegla' },
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
  const clases = { 'systems/Recoleccion.js': 'Recoleccion', 'ui/Taller.js': 'Taller', 'systems/Hallazgos.js': 'Hallazgos', 'systems/Mineria.js': 'Mineria' };
  const clase = clases[d.archivo];
  if (clase && !new RegExp('export\\s+class\\s+' + clase + '\\b').test(txt)) return `${clase} ya no es una clase exportada`;
  if (d.archivo === 'systems/Hallazgos.js' && !/export\s+const\s+TIPOS\b/.test(txt)) return 'Hallazgos ya no exporta TIPOS';
  if (d.reemplazo) {
    const nuevo = txt.replace(d.reemplazo[0], d.reemplazo[1]);
    if (nuevo === txt) return `el reemplazo no encontró ${d.reemplazo[0]}`;
    txt = nuevo;
  }
  if (d.json) {
    const datos = JSON.parse(txt);
    d.json(datos);
    txt = JSON.stringify(datos, null, 2);
  }
  if (d.anexo) txt += `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.anexo}\n`;
  fs.writeFileSync(archivo, txt);
  return null;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R7 · FASE 3, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (A3 y los 600 m de A4) no se falsa desde acá, y las');
console.log('        secciones 5 y 6 (regresión y build) se saltean con BANCO_SRC.\n');

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

const cuenta = { vio: 0, otro: 0, no: 0, sin: 0 };
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  const dest = path.join(TMP, d.id);
  copiarSrc(dest);
  const motivo = plantar(dest, d);
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  const declarada = caidas.find((k) => k.includes(d.caeEn));
  if (declarada) {
    console.log(`  LO VIO              ${d.id.padEnd(22)} ${d.que}`);
    console.log(`                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`);
    cuenta.vio++;
  } else if (caidas.length) {
    console.log(`  LO VIO POR OTRO     ${d.id.padEnd(22)} ${d.que}`);
    console.log(`                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`);
    cuenta.otro++;
  } else {
    console.log(`  NO LO VIO           ${d.id.padEnd(22)} ${d.que}`);
    console.log('                      el banco quedó VERDE con el defecto puesto');
    cuenta.no++;
  }
}

const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
console.log(`\n  ${cuenta.no === 0 ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}\n`);
if (cuenta.no === 0 && cuenta.otro === 0 && cuenta.sin === 0)
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* no importa */ }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = cuenta.no === 0 ? 0 : 1;
