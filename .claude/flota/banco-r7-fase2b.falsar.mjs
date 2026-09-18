/**
 * FALSADOR DEL BANCO R7 · FASE 2b (empuñadura).
 *
 * Copia de `src/`, un defecto plantado, el banco contra la copia, y se mira si cae
 * la aserción declarada. `LO VIO`, `NO LO VIO`, `NO SE PUDO PLANTAR`.
 *
 * Los parches van contra los nombres del CONTRATO y de la ronda 5, no contra el
 * código del agente: `construirHerramienta` (exportada desde la ronda 5; se
 * rebindea, porque las ligaduras de un módulo son vivas y `Cuerpo.js` la importa),
 * la propiedad `llamaEncendida` de `Cuerpo`, el nombre `mano:<id>` de cada modelo, y
 * las dos líneas de `main.js`.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 * Las copias van adentro del proyecto para que `three` se resuelva.
 *
 * Uso: node .claude/flota/banco-r7-fase2b.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase2b.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f2b');

/** Envuelve `construirHerramienta` para un id, con el grupo que devolvió la original. */
function modelo(id, cuerpo) {
  return String.raw`
const __construirOriginal = construirHerramienta;
construirHerramienta = function (id, tinta) {
  const grupo = __construirOriginal(id, tinta);
  if (grupo && id === '` + id + String.raw`') {
    ` + cuerpo + String.raw`
  }
  return grupo;
};
`;
}

/** Envuelve el setter de `enMano` de `Cuerpo`. */
function alColgar(cuerpo) {
  return String.raw`
{
  const __d = Object.getOwnPropertyDescriptor(Cuerpo.prototype, 'enMano');
  Object.defineProperty(Cuerpo.prototype, 'enMano', {
    configurable: true, enumerable: __d.enumerable, get: __d.get,
    set(v) { __d.set.call(this, v); ` + cuerpo + String.raw` },
  });
}
`;
}

const DEFECTOS = [
  // ── Los doce ──
  {
    id: 'garrote-sin-modelo', archivo: 'entities/Herramientas3D.js', que: 'el garrote sigue sin modelo',
    caeEn: 'garrote: tiene modelo',
    anexo: String.raw`
const __cO = construirHerramienta;
construirHerramienta = function (id, tinta) { return id === 'garrote' ? null : __cO(id, tinta); };
`,
  },
  {
    id: 'arco-pesado', archivo: 'entities/Herramientas3D.js', que: 'el arco se lleva una esfera de veinte mil triángulos',
    caeEn: 'arco_colihue_obj: ≤ 900 triángulos',
    anexo: modelo('arco_colihue_obj', String.raw`const m0 = grupo.children.find((o) => o.isMesh);
    const bola = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02, 20), m0.material);
    grupo.add(bola);`),
  },
  {
    id: 'honda-tres-mallas', archivo: 'entities/Herramientas3D.js', que: 'la honda se arma con cuatro mallas sueltas',
    caeEn: 'honda: ≤ 2 mallas',
    anexo: modelo('honda', String.raw`const m0 = grupo.children.find((o) => o.isMesh);
    for (let k = 0; k < 2; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), m0.material); p.position.y = 0.05 * k; grupo.add(p); }`),
  },
  {
    id: 'lanza-material-propio', archivo: 'entities/Herramientas3D.js', que: 'la lanza estrena un material fuera de la paleta',
    caeEn: 'lanza_colihue: sus materiales son de la paleta del cuerpo',
    anexo: modelo('lanza_colihue', String.raw`const m0 = grupo.children.find((o) => o.isMesh); m0.material = m0.material.clone();`),
  },
  {
    id: 'cana-igual-a-lanza', archivo: 'entities/Herramientas3D.js', que: 'la caña es la misma vara que la lanza',
    caeEn: 'ningún par de modelos con las tres medidas dentro del 15 %',
    anexo: String.raw`
const __cI = construirHerramienta;
construirHerramienta = function (id, tinta) {
  if (id !== 'cana_colihue') return __cI(id, tinta);
  const g = __cI('lanza_colihue', tinta);
  if (g) g.name = 'mano:cana_colihue';
  return g;
};
`,
  },
  {
    id: 'arpon-enterrado', archivo: 'entities/Herramientas3D.js', que: 'el arpón se clava dos metros en el suelo',
    caeEn: 'ningún modelo baja a menos de 2 cm de la planta de los pies',
    anexo: modelo('arpon_hueso', String.raw`for (const o of grupo.children) if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.translate(0, -2.2, 0); }`),
  },
  {
    id: 'grafo-crece', archivo: 'entities/Cuerpo.js', que: 'cada cambio de mano cuelga un nudo más',
    caeEn: 'el grafo de la mano no crece con los cambios',
    anexo: alColgar(String.raw`if (this.manos && this.manos[1]) this.manos[1].add(new THREE.Object3D());`),
    necesita: /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/,
  },
  {
    id: 'cache-borrada', archivo: 'entities/Cuerpo.js', que: 'el cuerpo arma el modelo de nuevo en cada cambio, sin caché',
    caeEn: 'después de cien cambios el garrote pesa lo mismo',
    // Sin caché los triángulos del garrote no cambian: lo que crece es la cantidad
    // de geometrías vivas. Se planta volviendo a construir y sumando una pieza por
    // vuelta, que es la firma de un modelo que no se reusa.
    anexo: alColgar(String.raw`
      const g = this.manos && this.manos[1] && this.manos[1].getObjectByName('mano:garrote');
      if (g) { const m0 = g.children.find((o) => o.isMesh); if (m0) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), m0.material)); }`),
    necesita: /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/,
  },

  // ── La llama apagada ──
  {
    // La primera versión reemplazaba el setter por uno que no hacía nada, y eso no
    // planta «no esconde»: el cuerpo cuelga cada modelo con la llama según su
    // estado interno, que arranca apagado, así que la llama no se mostraba nunca y
    // caían las premisas. Ahora la fuerza visible al escribir y al colgar.
    id: 'llama-siempre', archivo: 'entities/Cuerpo.js', que: 'llamaEncendida existe pero no esconde nada',
    caeEn: 'apagada, la antorcha en la mano no brilla',
    anexo: String.raw`
function __mostrarLlama(cuerpo) {
  const mano = cuerpo.manos && cuerpo.manos[1];
  if (mano) mano.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive && (o.material.emissive.r + o.material.emissive.g + o.material.emissive.b) > 0.3) o.visible = true;
  });
}
{
  const __dL = Object.getOwnPropertyDescriptor(Cuerpo.prototype, 'llamaEncendida');
  Object.defineProperty(Cuerpo.prototype, 'llamaEncendida', {
    configurable: true, get: __dL.get,
    set(v) { __dL.set.call(this, v); __mostrarLlama(this); },
  });
  const __dM = Object.getOwnPropertyDescriptor(Cuerpo.prototype, 'enMano');
  Object.defineProperty(Cuerpo.prototype, 'enMano', {
    configurable: true, enumerable: __dM.enumerable, get: __dM.get,
    set(v) { __dM.set.call(this, v); __mostrarLlama(this); },
  });
}
`,
  },
  {
    id: 'llama-no-vuelve', archivo: 'entities/Cuerpo.js', que: 'apagarla la esconde y prenderla no la vuelve a mostrar',
    caeEn: 'prenderla la vuelve a mostrar',
    anexo: String.raw`
{
  const __d = Object.getOwnPropertyDescriptor(Cuerpo.prototype, 'llamaEncendida');
  Object.defineProperty(Cuerpo.prototype, 'llamaEncendida', {
    configurable: true, get: __d.get,
    set(v) { __d.set.call(this, false); this.__pedida = !!v; },
  });
}
`,
  },
  {
    id: 'olvida-al-colgar', archivo: 'entities/Cuerpo.js', que: 'al colgar otra vez la antorcha, la llama aparece aunque esté apagada',
    caeEn: 'cambiar de objeto y volver a colgarla la deja apagada',
    anexo: alColgar(String.raw`
      const m = this.manos && this.manos[1] && v && this.manos[1].getObjectByName('mano:' + v);
      if (m) m.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && (o.material.emissive.r + o.material.emissive.g + o.material.emissive.b) > 0.3) o.visible = true; });`),
  },

  // ── El cableado ──
  {
    id: 'cableado-solo-mano', archivo: 'main.js', que: 'la mano vuelve a mirar sólo la ranura de la mano',
    caeEn: 'con la mano vacía, va el arma',
    reemplazo: [/\s*\?\?\s*equipo\.enRanura\(\s*['"]arma['"]\s*\)\?\.id/, ''],
  },
  {
    id: 'cableado-arma-primero', archivo: 'main.js', que: 'el arma le gana a la herramienta',
    caeEn: 'con herramienta y arma, va la herramienta',
    reemplazo: [/equipo\.enRanura\(\s*['"]mano['"]\s*\)\?\.id\s*\?\?\s*equipo\.enRanura\(\s*['"]arma['"]\s*\)\?\.id/, "equipo.enRanura('arma')?.id ?? equipo.enRanura('mano')?.id"],
  },
  {
    id: 'main-no-avisa-la-llama', archivo: 'main.js', que: 'main.js deja de decirle al cuerpo si la llama está prendida',
    caeEn: 'main.js le dice al cuerpo si la llama está prendida',
    reemplazo: [/cuerpo\.llamaEncendida\s*=\s*!!enMano;/, ';'],
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
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '', BANCO_SECCIONES: 'cableado,losDoce,siluetas,suelo,llamaApagada' },
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
  if (d.archivo === 'entities/Herramientas3D.js' && !/export\s+function\s+construirHerramienta\b/.test(txt)) return 'construirHerramienta ya no es una función exportada';
  if (d.archivo === 'entities/Herramientas3D.js' && !/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/.test(txt)) return 'Herramientas3D no importa THREE';
  if (d.archivo === 'entities/Cuerpo.js' && !/export\s+class\s+Cuerpo\b/.test(txt)) return 'Cuerpo no es una clase exportada';
  if (d.necesita && !d.necesita.test(txt)) return `${d.archivo} no tiene lo que el parche necesita`;
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
console.log(`\n  FALSADOR R7 · FASE 2b   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: las secciones 6 y 7 (regresión y build) se saltean con BANCO_SRC.\n');

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
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
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
console.log(`\n  ${cuenta.no === 0 ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}\n`);
if (cuenta.no === 0 && cuenta.otro === 0 && cuenta.sin === 0)
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* no importa */ }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = cuenta.no === 0 ? 0 : 1;
