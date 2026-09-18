/**
 * FALSADOR DEL BANCO R7 · FASE 2, mitad Node.
 *
 * El método de siempre: copia de `src/`, un defecto plantado, el banco contra la
 * copia, y se mira si cae la aserción que corresponde. `LO VIO`, `NO LO VIO`,
 * `NO SE PUDO PLANTAR`, sin mezclar.
 *
 * La mitad navegador no se puede falsar desde acá —mide la imagen y la GPU—, y se
 * dice en vez de fingir. Lo que sí se falsa es la mitad Node, que es la que decide
 * si la llama existe, se mueve, pesa poco y se comparte.
 *
 * Los parches se escriben contra el CONTRATO y no contra el código del agente:
 * envuelven `Hornos.prototype.agregar` y `Hornos.prototype.actualizar`, que ya
 * existían, y encuentran «lo que brilla» con la misma regla que el banco. Para
 * llegar a los hornos se usa `this.piezas`, que ya existía antes de la fase; si el
 * agente la renombra, esos defectos salen como NO SE PUDO PLANTAR y no como puntos
 * ciegos.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 *
 * Uso: node .claude/flota/banco-r7-fase2.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase2.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f2');

/** Lo común a los parches de Hornos: la regla de «brilla» y el acceso a los hornos. */
const COMUN = String.raw`
function __brillan(nodo) {
  const out = [];
  if (!nodo) return out;
  nodo.traverse((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && ((m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) / 3 * (m.emissiveIntensity ?? 1) > 0.15)
      || m.blending === THREE.AdditiveBlending || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isShaderMaterial))) out.push(o);
  });
  return out;
}
function __piezas(h) { if (!Array.isArray(h.piezas)) throw new Error('NO_PIEZAS'); return h.piezas; }
`;

function envolverActualizar(antes = '', despues = '') {
  return COMUN + String.raw`
const __actualizar = Hornos.prototype.actualizar;
Hornos.prototype.actualizar = function (t, ...resto) {
  let args = [t, ...resto];
  ` + antes + String.raw`
  const salida = __actualizar.apply(this, args);
  ` + despues + String.raw`
  return salida;
};
`;
}

function envolverAgregar(despues) {
  return COMUN + String.raw`
const __agregar = Hornos.prototype.agregar;
Hornos.prototype.agregar = function (horno, ...resto) {
  const nodo = __agregar.call(this, horno, ...resto);
  ` + despues + String.raw`
  return nodo;
};
`;
}

const DEFECTOS = [
  {
    id: 'sin-llama', archivo: 'world/Hornos.js', que: 'la fogata prendida sigue sin nada que brille',
    caeEn: 'la fogata prendida tiene algo visible que brilla',
    anexo: envolverActualizar('', String.raw`for (const p of __piezas(this)) if (p.horno.def.id === 'fogata') for (const o of __brillan(p.malla)) o.visible = false;`),
  },
  {
    id: 'llama-siempre', archivo: 'world/Hornos.js', que: 'la llama se ve también con la fogata apagada',
    caeEn: 'la fogata apagada no tiene nada que brille',
    anexo: envolverActualizar(
      String.raw`const __estaban = __piezas(this).map((p) => p.horno.ardiendo); for (const p of __piezas(this)) p.horno.ardiendo = true;`,
      String.raw`__piezas(this).forEach((p, k) => { p.horno.ardiendo = __estaban[k]; });`),
  },
  {
    id: 'prende-la-vecina', archivo: 'world/Hornos.js', que: 'prender una fogata enciende la llama de todas',
    caeEn: 'prender una fogata no prende la de al lado',
    anexo: envolverActualizar(
      String.raw`const __alguna = __piezas(this).some((p) => p.horno.ardiendo); const __estaban = __piezas(this).map((p) => p.horno.ardiendo); if (__alguna) for (const p of __piezas(this)) p.horno.ardiendo = true;`,
      String.raw`__piezas(this).forEach((p, k) => { p.horno.ardiendo = __estaban[k]; });`),
  },
  {
    id: 'quieta', archivo: 'world/Hornos.js', que: 'la llama no se mueve: es un cono naranja',
    caeEn: 'la llama se mueve',
    anexo: envolverActualizar(String.raw`args = [0, ...resto];`),
  },
  {
    id: 'material-por-horno', archivo: 'world/Hornos.js', que: 'cada fogata estrena su propio material de llama',
    caeEn: 'las dos fogatas comparten el material de la llama',
    anexo: envolverAgregar(String.raw`nodo.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material = o.material.clone(); });`),
  },
  {
    id: 'llama-pesada', archivo: 'world/Hornos.js', que: 'la llama pasa a ser una esfera de cinco mil triángulos',
    caeEn: 'la llama pesa 400 triángulos o menos',
    anexo: COMUN + String.raw`
const __matPesada = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
const __agregarP = Hornos.prototype.agregar;
Hornos.prototype.agregar = function (horno, ...resto) {
  const nodo = __agregarP.call(this, horno, ...resto);
  const bola = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 4), __matPesada);
  bola.position.y = 0.5; bola.name = 'pesada'; bola.visible = false;
  nodo.add(bola);
  return nodo;
};
const __actualizarP = Hornos.prototype.actualizar;
Hornos.prototype.actualizar = function (...a) {
  const r = __actualizarP.apply(this, a);
  for (const p of __piezas(this)) { const b = p.malla.getObjectByName('pesada'); if (b) b.visible = !!p.horno.ardiendo; }
  return r;
};
`,
  },
  {
    id: 'llama-en-el-aire', archivo: 'world/Hornos.js', que: 'la llama queda flotando tres metros arriba',
    caeEn: 'la llama queda sobre la fogata, entre el suelo y 2,5 m',
    anexo: envolverActualizar('', String.raw`for (const p of __piezas(this)) for (const o of __brillan(p.malla)) { if (!o.userData.__subida) { o.position.y += 3; o.userData.__subida = true; } }`),
  },
  {
    id: 'luz-de-three', archivo: 'world/Hornos.js', que: 'vuelve una PointLight por horno: el congelamiento de 19 s',
    caeEn: 'ninguna luz de three en los hornos',
    anexo: envolverAgregar(String.raw`nodo.add(new THREE.PointLight(0xff7a2e, 2, 14));`),
  },
  {
    id: 'barro-sin-brillo', archivo: 'world/Hornos.js', que: 'el horno de barro arde sin que se note',
    caeEn: 'horno_barro: muestra que arde',
    anexo: envolverActualizar('', String.raw`for (const p of __piezas(this)) if (p.horno.def.id === 'horno_barro') for (const o of __brillan(p.malla)) o.visible = false;`),
  },
  {
    id: 'fragua-sin-brillo', archivo: 'world/Hornos.js', que: 'la fragua arde sin que se note',
    caeEn: 'fragua: muestra que arde',
    anexo: envolverActualizar('', String.raw`for (const p of __piezas(this)) if (p.horno.def.id === 'fragua') for (const o of __brillan(p.malla)) o.visible = false;`),
  },
  {
    id: 'antorcha-apagada', archivo: 'engine/Luces.js', que: 'la antorcha pierde la intensidad',
    caeEn: 'antorcha: color lineal en [0,1], intensidad y parpadeo sanos',
    anexo: '\nLLAMAS.antorcha.intensidad = 0;\n',
  },
  {
    id: 'bloque-tocado', archivo: 'engine/Luces.js', que: 'alguien cambia la caída del bloque del sombreador',
    caeEn: 'el bloque del sombreador es el de la ronda 5',
    reemplazo: [/aLuz \*= aLuz;/, 'aLuz = aLuz;'],
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
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_SECCIONES: 'llama,llamas' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/@@RESULTADO (.+)/);
  return m ? { secciones: JSON.parse(m[1]), salida } : { error: salida.slice(-800) || '(el banco no imprimió nada)' };
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
  if (d.archivo === 'world/Hornos.js' && !/export\s+class\s+Hornos\b/.test(txt)) return 'Hornos no es una clase exportada';
  if (d.reemplazo) {
    const nuevo = txt.replace(d.reemplazo[0], d.reemplazo[1]);
    if (nuevo === txt) return `el reemplazo no encontró ${d.reemplazo[0]}`;
    txt = nuevo;
  }
  if (d.anexo) txt += `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.anexo}\n`;
  fs.writeFileSync(archivo, txt);
  return null;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R7 · FASE 2, mitad Node   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: la mitad navegador (compilación, imagen, costo) no se falsa desde acá, y');
console.log('        las secciones 3 y 4 (regresión y build) se saltean con BANCO_SRC.\n');

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
  if (/NO_PIEZAS/.test(JSON.stringify(r.secciones))) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(22)} Hornos ya no tiene «piezas»: el parche no encuentra los hornos`);
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
