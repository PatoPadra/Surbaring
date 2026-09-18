/**
 * FALSADOR DEL BANCO R7 · FASE 5 (witral), mitad Node.
 *
 * Copia de `src/`, un defecto plantado, el banco contra la copia, y se mira si cae
 * la aserción declarada. `LO VIO`, `LO VIO POR OTRO`, `NO LO VIO`, `NO SE PUDO
 * PLANTAR`. Y tres CONTROLES al revés: cambios que el contrato permite, y con los
 * que el banco tiene que seguir verde; si cae, el banco fija de más.
 *
 * Se escribe antes que el código del agente y se corre después: casi todos los
 * defectos se montan sobre el telar, el huso o el hilado, que en la base no existen.
 * Los parches van contra lo que el CONTRATO nombra y contra las puertas que ya
 * existían: `Construccion.prototype.evaluar` y `actualizar`, `Obras.prototype.agregar`,
 * `Fabricacion.prototype.estado` y `fabricar`, `Partida.prototype._reponerObras`, la
 * tabla `VALE` de `Recoleccion`, los datos y `Iconos.js`. No dependen de cómo pida el
 * agente el huso ni de dónde decida la estación.
 *
 * La mitad navegador —los programas de W1 y las apretadas de W4— no se falsa desde
 * acá, y se dice.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 * Los ayudantes comunes van con `var`, que se puede repetir sin romper la carga.
 *
 * Uso: node .claude/flota/banco-r7-fase5.falsar.mjs [--solo <id>] [--sintaxis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase5.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f5');
const SECCIONES = 'telarEsCosa,tejerAlLado,hilar,laTecla,fuentes,seVaEntero,nadaMas';

const CLASES = {
  'systems/Fabricacion.js': 'Fabricacion', 'systems/Construccion.js': 'Construccion', 'world/Obras.js': 'Obras',
  'systems/Recoleccion.js': 'Recoleccion', 'systems/Partida.js': 'Partida',
};

const telarDe = (d) => (d.obras || []).find((o) => o.id === 'telar_witral');
const recetaDeHilado = (d) => (d.objetos || []).find((o) => (o.produce || []).some((p) => p.recurso === 'hilado'));

const DA_HILADO = String.raw`
var __daHilado = (o) => !!o && (o.produce || []).some((p) => p.recurso === 'hilado');
var __alcanza = (fab, o) => (o.materiales || []).every((m) => fab.inventario.disponiblePara(m.recurso) >= m.cantidad);
`;

const DEFECTOS = [
  // ── El telar es una cosa ──
  {
    id: 'obra-permanente', archivo: 'data/construccion.json', que: 'el telar es una construcción permanente',
    caeEn: 'es de campamento',
    json: (d) => { const o = telarDe(d); if (!o) return 'no hay obra de telar'; o.categoria = 'permanente'; },
  },
  {
    id: 'sin-procesa', archivo: 'data/construccion.json', que: 'el telar no queda como estación',
    caeEn: 'procesa: queda como estación del taller',
    json: (d) => { const o = telarDe(d); if (!o) return 'no hay obra de telar'; o.procesa = false; },
  },
  {
    id: 'sin-tecnologia', archivo: 'data/construccion.json', que: 'el telar se levanta sin saber tejer',
    caeEn: 'pide la tecnología telar_witral',
    json: (d) => { const o = telarDe(d); if (!o) return 'no hay obra de telar'; delete o.requiereTecnologia; },
  },
  {
    id: 'parque-abierto', archivo: 'systems/Construccion.js', que: 'en el Parque el telar se levanta igual',
    caeEn: 'en el Parque se niega igual que el toldo',
    anexo: String.raw`
var __evaluarPA = Construccion.prototype.evaluar;
Construccion.prototype.evaluar = function (obra, x, z) {
  const v = __evaluarPA.call(this, obra, x, z);
  if (obra && obra.id === 'telar_witral' && this.limites.jurisdiccion(x, z) === 'parque') return { ...v, permitido: true, castigo: 0, titulo: '' };
  return v;
};
`,
  },
  {
    id: 'caja-por-defecto', archivo: 'world/Obras.js', que: 'el telar se dibuja como la caja de cualquier obra nueva',
    caeEn: 'no es la caja por defecto',
    anexo: String.raw`
var __agregarCD = Obras.prototype.agregar;
Obras.prototype.agregar = function (c) {
  if (c && c.obra && c.obra.id === 'telar_witral') return __agregarCD.call(this, { ...c, obra: { ...c.obra, id: 'obra_sin_caso_propio' } });
  return __agregarCD.call(this, c);
};
`,
  },
  {
    id: 'sin-postes', archivo: 'world/Obras.js', que: 'el telar es petiso: no tiene postes',
    caeEn: 'tiene postes y travesaños',
    anexo: String.raw`
var __agregarSP = Obras.prototype.agregar;
Obras.prototype.agregar = function (c) {
  const nodo = __agregarSP.call(this, c);
  if (c && c.obra && c.obra.id === 'telar_witral') nodo.traverse((m) => { if (m.isMesh) m.scale.y *= 0.2; });
  return nodo;
};
`,
  },

  // ── Se teje al lado del telar ──
  {
    id: 'teje-lejos', archivo: 'systems/Fabricacion.js', que: 'el poncho se teje lejos del telar',
    caeEn: 'a 30 m del telar, el estado dice que falta el telar',
    anexo: String.raw`
var __estadoTL = Fabricacion.prototype.estado;
Fabricacion.prototype.estado = function (obj) {
  const r = __estadoTL.call(this, obj);
  return obj && obj.id === 'poncho_witral' && r.estado === 'falta_estacion' ? { estado: 'lista' } : r;
};
`,
  },
  {
    id: 'solo-el-mas-cercano', archivo: 'systems/Fabricacion.js', que: 'con una fogata más cerca que el telar, el poncho dice que falta el telar',
    caeEn: 'con una fogata a 1 m y el telar a 5 m, se teje igual',
    anexo: String.raw`
var __estadoMC = Fabricacion.prototype.estado;
Fabricacion.prototype.estado = function (obj) {
  const r = __estadoMC.call(this, obj);
  if (!obj || obj.id !== 'poncho_witral' || r.estado !== 'lista') return r;
  const h = this.fundicion && this.fundicion.cercano();
  return h && h.def && h.def.id === 'telar_witral' ? r : { estado: 'falta_estacion', motivo: 'Hace falta estar al lado de: telar' };
};
`,
  },

  // ── Se hila antes de tejer ──
  {
    id: 'hila-sin-huso', archivo: 'systems/Fabricacion.js', que: 'se hila sin huso',
    caeEn: 'sin huso, el estado dice que falta el huso',
    anexo: DA_HILADO + String.raw`
var __estadoHS = Fabricacion.prototype.estado;
var __fabricarHS = Fabricacion.prototype.fabricar;
Fabricacion.prototype.estado = function (obj) {
  const r = __estadoHS.call(this, obj);
  if (__daHilado(obj) && r.estado !== 'lista' && r.estado !== 'falta_saber' && __alcanza(this, obj)) return { estado: 'lista' };
  return r;
};
Fabricacion.prototype.fabricar = function (obj) {
  if (!__daHilado(obj) || __estadoHS.call(this, obj).estado === 'lista' || !__alcanza(this, obj)) return __fabricarHS.call(this, obj);
  for (const m of obj.materiales || []) this.inventario.consumirPara(m.recurso, m.cantidad);
  const salida = [];
  for (const p of obj.produce || []) salida.push({ recurso: p.recurso, cantidad: this.inventario.agregar(p.recurso, p.cantidad) });
  return { estado: 'hecho', objeto: obj, salida };
};
`,
  },
  {
    id: 'consume-sin-huso', archivo: 'systems/Fabricacion.js', que: 'intentar hilar sin huso gasta la lana igual',
    caeEn: 'y fabricar sin huso no consume nada',
    anexo: DA_HILADO + String.raw`
var __fabricarCS = Fabricacion.prototype.fabricar;
Fabricacion.prototype.fabricar = function (obj) {
  const r = __fabricarCS.call(this, obj);
  if (__daHilado(obj) && r.estado !== 'hecho') for (const m of obj.materiales || []) this.inventario.consumirPara(m.recurso, m.cantidad);
  return r;
};
`,
  },
  {
    id: 'poncho-con-lana', archivo: 'data/herramientas.json', que: 'el poncho vuelve a pedir lana cruda',
    caeEn: 'el poncho pide hilado, no lana',
    json: (d) => {
      const m = (d.objetos.find((o) => o.id === 'poncho_witral')?.materiales || []).find((x) => x.recurso === 'hilado');
      if (!m) return 'el poncho no pide hilado';
      m.recurso = 'lana';
    },
  },
  {
    id: 'moscas-con-hilado', archivo: 'data/herramientas.json', que: 'las moscas pasan a pedir hilado',
    caeEn: 'las moscas siguen pidiendo lana',
    json: (d) => {
      const m = (d.objetos.find((o) => o.id === 'moscas')?.materiales || []).find((x) => x.recurso === 'lana');
      if (!m) return 'las moscas no piden lana';
      m.recurso = 'hilado';
    },
  },
  {
    id: 'hilar-solo-en-telar', archivo: 'data/herramientas.json', que: 'se hila sólo al lado del telar',
    caeEn: 'con el huso, lejos de toda estación, está lista',
    json: (d) => { const o = recetaDeHilado(d); if (!o) return 'no hay receta de hilado'; o.donde = 'telar_witral'; },
  },

  // ── La tecla ──
  {
    id: 'coiron-le-gana', archivo: 'systems/Recoleccion.js', que: 'el coirón le gana la tecla al tronco caído',
    caeEn: 'el tronco caído le gana la tecla al coirón',
    reemplazo: [/(const VALE = \{[^}]*coiron:\s*)0/, (m, a) => `${a}9`],
  },

  // ── Con fuente o con licencia ──
  {
    id: 'sin-licencia-vellon', archivo: 'data/herramientas.json', que: 'lo del vellón de guanaco queda dicho sin fuente ni licencia',
    caeEn: 'lo del vellón de guanaco en el coirón tiene fuente o licencia',
    json: (d) => {
      d.licenciasDeJuego.licencias = d.licenciasDeJuego.licencias.filter((l) => !/lana|vell[oó]n/i.test(`${l.id} ${l.que}`));
      for (const o of d.objetos) for (const k of ['fuente', 'criterio']) if (typeof o[k] === 'string') o[k] = o[k].replace(/guanacos?/gi, 'animal');
    },
  },
  {
    id: 'huso-sin-tortero', archivo: 'data/herramientas.json', que: 'el huso no dice nada del tortero',
    caeEn: 'el huso trae su fuente, y habla del tortero',
    json: (d) => {
      const o = d.objetos.find((x) => x.id === 'huso');
      if (!o) return 'no hay huso';
      for (const k of ['fuente', 'criterio']) if (typeof o[k] === 'string') o[k] = o[k].replace(/torteros?/gi, 'contrapeso');
    },
  },

  // ── El telar se va entero ──
  {
    id: 'estacion-fantasma', archivo: 'systems/Construccion.js', que: 'el telar vencido deja su estación en Fundicion',
    caeEn: 'y deja de ser estación en Fundicion',
    anexo: String.raw`
var __actualizarEF = Construccion.prototype.actualizar;
Construccion.prototype.actualizar = function (...a) {
  const caidas = __actualizarEF.apply(this, a);
  for (const c of caidas || []) {
    if (c.obra && c.obra.procesa && this.fundicion && !this.fundicion.hornos.some((h) => h.def && h.def.id === c.obra.id && h.x === c.x && h.z === c.z)) {
      this.fundicion.hornos.push({ def: { id: c.obra.id, nombre: c.obra.nombre, temperaturaC: null }, x: c.x, z: c.z, y: c.y, trabajo: null });
    }
  }
  return caidas;
};
`,
  },
  {
    id: 'no-repone', archivo: 'systems/Partida.js', que: 'un guardado repone el telar sin su estación',
    caeEn: 'un guardado con un telar en pie lo repone con su estación',
    anexo: String.raw`
var __reponerNR = Partida.prototype._reponerObras;
Partida.prototype._reponerObras = function (lista) {
  const r = __reponerNR.call(this, lista);
  if (this.fundicion) this.fundicion.hornos = this.fundicion.hornos.filter((h) => !(h.def && h.def.id === 'telar_witral'));
  return r;
};
`,
  },

  // ── Nada más cambia ──
  {
    id: 'estacion-cambia', archivo: 'data/herramientas.json', que: 'la brea se hace en el bolso, sin fuego',
    caeEn: 'los objetos de antes se fabrican donde se fabricaban',
    json: (d) => { const o = d.objetos.find((x) => x.id === 'brea_resina'); if (!o) return 'no hay brea'; o.donde = 'bolso'; },
  },
  {
    id: 'sin-icono-huso', archivo: 'ui/Iconos.js', que: 'el huso no tiene icono',
    caeEn: 'huso tiene icono en Iconos.js',
    texto: (t) => t.replace(/(^|[\s{,'"])huso(['"]?\s*:)/gm, '$1huso_borrado$2'),
  },

  // ── Controles al revés: el contrato los permite, el banco tiene que seguir verde ──
  {
    id: 'control-materiales-del-telar', control: true, archivo: 'data/construccion.json', que: 'el telar pide el doble de materiales',
    json: (d) => { const o = telarDe(d); if (!o) return 'no hay obra de telar'; for (const m of o.materiales || []) m.cantidad *= 2; },
  },
  {
    id: 'control-motivo-reescrito', control: true, archivo: 'systems/Fabricacion.js', que: 'el motivo de la estación dice otra cosa con el mismo sentido',
    anexo: String.raw`
var __estadoMR = Fabricacion.prototype.estado;
Fabricacion.prototype.estado = function (obj) {
  const r = __estadoMR.call(this, obj);
  return r && r.estado === 'falta_estacion' && /telar/i.test(r.motivo || '') ? { ...r, motivo: 'Para tejer tenés que estar junto al witral, el telar.' } : r;
};
`,
  },
  {
    id: 'control-hilado-rinde', control: true, archivo: 'data/herramientas.json', que: 'la receta de hilado da uno más',
    json: (d) => { const o = recetaDeHilado(d); if (!o) return 'no hay receta de hilado'; o.produce.find((p) => p.recurso === 'hilado').cantidad += 1; },
  },
];

// ── La corrida ──────────────────────────────────────────────────────────────

function copiarSrc(dest) {
  fs.rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
  if (d.reemplazo) {
    const nuevo = txt.replace(d.reemplazo[0], d.reemplazo[1]);
    if (nuevo === txt) return `el reemplazo no encontró ${d.reemplazo[0]}`;
    txt = nuevo;
  }
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
  // Sin banco: planta cada defecto y carga el archivo tocado, para ver que el parche
  // es JavaScript que se deja evaluar. Sirve antes de que exista el código del agente.
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  fs.mkdirSync(TMP, { recursive: true });
  const ARRANQUE = 'globalThis.addEventListener=()=>{};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};'
    + 'globalThis.document={addEventListener(){},createElement:()=>({getContext:()=>null,style:{}})};';
  let malos = 0;
  for (const d of DEFECTOS) {
    if (solo && d.id !== solo) continue;
    const dest = path.join(TMP, d.id);
    copiarSrc(dest);
    const motivo = plantar(dest, d);
    if (motivo) { console.log(`  no se planta en la base  ${d.id.padEnd(30)} ${motivo}`); continue; }
    if (!d.archivo.endsWith('.js')) { console.log(`  dato      ${d.id.padEnd(30)} ${d.archivo}`); continue; }
    const url = 'file:///' + path.join(dest, ...d.archivo.split('/')).replace(/\\/g, '/');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `${ARRANQUE}await import(${JSON.stringify(url)});`], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    const ok = r.status === 0;
    if (!ok) malos++;
    console.log(`  ${ok ? 'carga   ' : 'NO CARGA'}  ${d.id.padEnd(30)} ${d.archivo}${ok ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' / ')}`);
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} archivos parchados no cargan\n`);
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.exit(malos ? 1 : 0);
}

fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R7 · FASE 5, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (los programas de W1 y las apretadas de W4) no se falsa');
console.log('        desde acá, y las secciones 8 y 9 (regresión y build) se saltean con BANCO_SRC.\n');

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
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(30)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(30)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  if (d.control) {
    if (caidas.length) {
      console.log(`  CONTROL ROJO        ${d.id.padEnd(30)} ${d.que}`);
      console.log(`                      el banco fija de más, cayó: ${caidas.slice(0, 3).join(' · ')}`);
      cuenta.controlMal++;
    } else {
      console.log(`  CONTROL VERDE       ${d.id.padEnd(30)} ${d.que}`);
      cuenta.controlOk++;
    }
    continue;
  }
  const declarada = caidas.find((k) => k.includes(d.caeEn));
  if (declarada) {
    console.log(`  LO VIO              ${d.id.padEnd(30)} ${d.que}`);
    console.log(`                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`);
    cuenta.vio++;
  } else if (caidas.length) {
    console.log(`  LO VIO POR OTRO     ${d.id.padEnd(30)} ${d.que}`);
    console.log(`                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`);
    cuenta.otro++;
  } else {
    console.log(`  NO LO VIO           ${d.id.padEnd(30)} ${d.que}`);
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
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* no importa */ }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = bien ? 0 : 1;
