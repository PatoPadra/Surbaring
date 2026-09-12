/**
 * FALSADOR DEL BANCO R6 · FASE 1.
 *
 * El banco sólo sirve si se pone rojo cuando algo está mal. Acá se le plantan
 * defectos de a uno a una copia del código y se comprueba que la aserción que
 * tenía que caer, cayó.
 *
 * Los defectos NO se plantan buscando texto en el código del agente —eso ataría
 * el falsador a cómo lo escribió—, sino **agregando un parche al final del
 * módulo copiado** que rompe una conducta y nada más. Así el falsador vale
 * cualquiera sea la implementación de adentro.
 *
 * Cada defecto declara `caeEn`: el pedazo exacto de la descripción de la
 * aserción que tiene que pasar de ok a MAL. Cuatro resultados posibles:
 *
 *   LO VIO             cayó la aserción declarada
 *   LO VIO POR OTRO    el banco se puso rojo, pero por otra aserción
 *   NO LO VIO          el banco quedó verde con el defecto puesto  ← el malo
 *   NO SE PUDO PLANTAR el parche no aplicó o el módulo no cargó
 *
 * La copia se hace con `fs.cpSync`, no con tar: bajo Git Bash el tar de GNU lee
 * `C:` como un host remoto y falla en silencio. Esa lección costó una ronda.
 *
 * Uso: node .claude/flota/banco-r6-fase1.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r6-fase1.mjs');

/**
 * Los defectos. `parche` es código que se pega al final del archivo: corre en el
 * ámbito del módulo, así que puede pisar el prototipo de la clase o rebindear
 * una función exportada (las declaraciones de función no son constantes, y las
 * ligaduras de los módulos son vivas: quien importe ve el valor nuevo).
 */
const DEFECTOS = [
  // ── Sección 1 · la API vieja ──────────────────────────────────────────────
  {
    id: 'agregar-miente',
    que: 'agregar devuelve lo que se pidió, no lo que entró',
    archivo: 'systems/Inventario.js',
    caeEn: 'agregar devuelve lo parcial que sí entró',
    parche: `{ const _a = Inventario.prototype.agregar;
  Inventario.prototype.agregar = function (r, n) { _a.call(this, r, n); return n; }; }`,
  },
  {
    id: 'listar-por-casilla',
    que: 'listar devuelve un renglón por casilla en vez de juntar las pilas',
    archivo: 'systems/Inventario.js',
    caeEn: 'listar junta las pilas en un renglón',
    parche: `{ const _l = Inventario.prototype.listar;
  Inventario.prototype.listar = function () {
    const filas = _l.call(this);
    const cas = (this.casillas || []).filter(Boolean);
    if (!cas.length) return filas;
    return cas.map(c => { const f = filas.find(x => x.id === c.id) || {};
      return { ...f, id: c.id, cantidad: c.n }; });
  }; }`,
  },
  {
    id: 'equivalencia-rota',
    que: 'disponiblePara deja de contar la equivalencia madera_dura -> madera',
    archivo: 'systems/Inventario.js',
    caeEn: 'disponiblePara cuenta la equivalencia',
    parche: `Inventario.prototype.disponiblePara = function (p) { return this.cantidad(p); };`,
  },

  // ── Sección 2 · las pilas ─────────────────────────────────────────────────
  {
    id: 'pila-fija',
    que: 'pilaDe devuelve siempre 20, sin mirar el peso',
    archivo: 'systems/Recursos.js',
    caeEn: 'las 71 fichas dan lo que dice la fórmula',
    parche: `pilaDe = function () { return 20; };`,
  },
  {
    id: 'pila-tabla-escondida',
    que: 'pilaDe acierta en las 71 fichas por tabla, y erra en cualquier otro peso',
    archivo: 'systems/Recursos.js',
    caeEn: 'un peso inventado también sale de la fórmula',
    parche: `{ const _p = pilaDe;
  const tabla = new Map(Object.values(RECURSOS).map(r => [r.kg ?? 0.5, _p(r.kg ?? 0.5)]));
  pilaDe = function (kg) { return tabla.has(kg) ? tabla.get(kg) : 1; }; }`,
  },
  {
    id: 'pila-no-monotona',
    que: 'pilaDe le da una pila más grande al tronco de 6 kg que a la madera',
    archivo: 'systems/Recursos.js',
    caeEn: 'más pesado nunca apila más que más liviano',
    parche: `{ const _p = pilaDe; pilaDe = function (kg) { return kg >= 6 ? 50 : _p(kg); }; }`,
  },
  {
    id: 'pila-fuera-de-escalera',
    que: 'pilaDe devuelve 7, que no está en la escalera',
    archivo: 'systems/Recursos.js',
    caeEn: 'toda pila está en la escalera',
    parche: `{ const _p = pilaDe; pilaDe = function (kg) { const v = _p(kg); return v === 5 ? 7 : v; }; }`,
  },

  // ── Sección 3 · los dos topes ─────────────────────────────────────────────
  {
    id: 'casillas-mal-contadas',
    que: 'casillasPara(38) da 30 en vez de 24',
    archivo: 'systems/Recursos.js',
    caeEn: 'casillasPara(38) = 24',
    parche: `{ const _c = casillasPara; casillasPara = function (k) { return _c(k) + 6; }; }`,
  },
  {
    id: 'casillas-media-fila',
    que: 'casillasPara devuelve filas incompletas',
    archivo: 'systems/Recursos.js',
    caeEn: 'siempre son filas completas de 6',
    parche: `{ const _c = casillasPara; casillasPara = function (k) { return _c(k) - (k > 40 ? 1 : 0); }; }`,
  },
  {
    id: 'grilla-no-muerde',
    que: 'agregar ignora el tope de casillas: mete todo mientras haya peso',
    archivo: 'systems/Inventario.js',
    caeEn: 'entraron exactamente',
    parche: `{ const _a = Inventario.prototype.agregar;
  Inventario.prototype.agregar = function (r, n) {
    const antes = this.casillas.length;
    this.casillas.length = antes + 64; this.casillas.fill(null, antes);
    const e = _a.call(this, r, n);
    this.casillas.length = Math.max(antes, this.casillas.findLastIndex(Boolean) + 1);
    return e; }; }`,
  },
  {
    id: 'grilla-ahoga',
    que: 'la grilla queda en 18 casillas y estrangula una carga mixta de 38 kg',
    archivo: 'systems/Recursos.js',
    caeEn: 'ninguna de 500 cargas mixtas se quedó sin casillas',
    parche: `casillasPara = function () { return 18; };`,
  },

  // ── Sección 4 · la pila abierta y las posiciones ──────────────────────────
  {
    id: 'no-completa-la-pila',
    que: 'cada agregar abre casilla nueva en vez de completar la abierta',
    archivo: 'systems/Inventario.js',
    // Con el defecto puesto siguen siendo dos casillas —[3,3] en vez de
    // [5,1]—, asi que la que cae es la que mira el contenido, no la cuenta.
    caeEn: 'la primera queda llena',
    // Se le esconden las pilas abiertas cambiándoles el id un instante: la
    // implementación no encuentra dónde juntar y abre casilla nueva.
    //
    // Sólo las del MISMO recurso. Escondiéndolas todas —como estaba— el parche
    // le mentía además al peso y a las equivalencias, y el banco caía por la
    // sección 1 en vez de por la que este defecto ataca: el falsador decía «lo
    // vio por otro motivo», que es medio ver.
    parche: `{ const _a = Inventario.prototype.agregar;
  Inventario.prototype.agregar = function (r, n) {
    const tocadas = [];
    for (const c of this.casillas) if (c && c.id === r) { tocadas.push([c, c.id]); c.id = '__oculto__' + c.id; }
    const e = _a.call(this, r, n);
    for (const [c, id] of tocadas) c.id = id;
    return e; }; }`,
  },
  {
    id: 'quitar-compacta',
    que: 'quitar compacta la grilla y corre todo hacia la izquierda',
    archivo: 'systems/Inventario.js',
    caeEn: 'la de al lado no se corrió',
    parche: `{ const _q = Inventario.prototype.quitar;
  Inventario.prototype.quitar = function (r, n) {
    const ok = _q.call(this, r, n);
    if (ok) { const vivas = this.casillas.filter(Boolean), largo = this.casillas.length;
      this.casillas.length = 0;
      for (const c of vivas) this.casillas.push(c);
      while (this.casillas.length < largo) this.casillas.push(null); }
    return ok; }; }`,
  },
  {
    id: 'no-reusa-el-hueco',
    que: 'lo nuevo se agrega al final en vez de tapar el hueco',
    archivo: 'systems/Inventario.js',
    caeEn: 'lo nuevo entra en el hueco',
    parche: `{ const _a = Inventario.prototype.agregar;
  Inventario.prototype.agregar = function (r, n) {
    const huecos = [];
    for (let i = 0; i < this.casillas.length; i++)
      if (!this.casillas[i] && this.casillas.slice(i + 1).some(Boolean)) { huecos.push(i); this.casillas[i] = { id: '__tapon__', n: 1 }; }
    const e = _a.call(this, r, n);
    for (const i of huecos) if (this.casillas[i]?.id === '__tapon__') this.casillas[i] = null;
    return e; }; }`,
  },
  {
    id: 'achicar-pierde',
    que: 'bajar la capacidad tira lo que quedaba en las casillas de más',
    archivo: 'systems/Inventario.js',
    caeEn: 'ni una casilla ocupada',
    parche: `Inventario.prototype.ajustarCasillas = function () {
    const n = Math.max(18, 6 * Math.round(this.capacidadKg * 0.63 / 6));
    this.casillas.length = n; };`,
  },

  // ── Sección 5 · mover, partir, juntar ─────────────────────────────────────
  {
    id: 'juntar-desborda',
    que: 'mover junta las dos pilas sin respetar el tope',
    archivo: 'systems/Inventario.js',
    caeEn: 'la de destino no se pasa del tope',
    parche: `Inventario.prototype.mover = function (a, b) {
    const A = this.casillas[a], B = this.casillas[b];
    if (!A) return false;
    if (B && B.id === A.id) { B.n += A.n; this.casillas[a] = null; return true; }
    this.casillas[b] = A; this.casillas[a] = B ?? null; return true; };`,
  },
  {
    id: 'mover-pisa',
    que: 'mover sobre otra cosa la pisa en vez de intercambiar',
    archivo: 'systems/Inventario.js',
    caeEn: 'mover sobre otra cosa intercambia',
    parche: `{ const _m = Inventario.prototype.mover;
  Inventario.prototype.mover = function (a, b) {
    const A = this.casillas[a], B = this.casillas[b];
    if (A && B && B.id !== A.id) { this.casillas[b] = A; this.casillas[a] = null; return true; }
    return _m.call(this, a, b); }; }`,
  },
  {
    id: 'partir-duplica',
    que: 'partir deja la mitad y además la copia entera: se crea materia',
    archivo: 'systems/Inventario.js',
    // Se declara «partidas por la mitad» y no «sin perder una sola» a
    // sabiendas: el parche escribe `casillas[i].n` a mano, y la implementación
    // lleva el total por recurso en un contador que recuenta cuando algo se
    // mueve. Escribiendo la casilla por atrás, `cantidad()` no se entera, pero
    // `pesoKg` y la forma de las pilas sí. La aserción que cae es la que mira
    // la grilla, que es donde el defecto de verdad se ve.
    caeEn: 'partidas por la mitad',
    parche: `{ const _p = Inventario.prototype.partir;
  Inventario.prototype.partir = function (i) {
    const antes = this.casillas[i]?.n ?? 0;
    const ok = _p.call(this, i);
    if (ok && this.casillas[i]) this.casillas[i].n = antes;
    return ok; }; }`,
  },
  {
    id: 'partir-de-uno',
    que: 'partir una pila de 1 devuelve true y deja una casilla en cero',
    archivo: 'systems/Inventario.js',
    caeEn: 'una pila de 1 no se parte',
    parche: `{ const _p = Inventario.prototype.partir;
  Inventario.prototype.partir = function (i) {
    const c = this.casillas[i];
    if (c && c.n === 1) { const libre = this.casillas.findIndex(x => !x);
      if (libre >= 0) { this.casillas[libre] = { id: c.id, n: 0 }; return true; } }
    return _p.call(this, i); }; }`,
  },
  {
    id: 'mover-al-azar-rompe',
    que: 'mover a una casilla que no existe tira una excepción',
    archivo: 'systems/Inventario.js',
    // Se declaraba contra los 400 movimientos al azar, y ésa fue justamente la
    // lección: el sorteo nunca sale del rango, así que el defecto no lo podía
    // ver nadie. La aserción que lo ve es la de índices imposibles, que se
    // agregó al banco por culpa de este mismo defecto.
    caeEn: 'ni mover ni partir tiran con un índice imposible',
    parche: `{ const _m = Inventario.prototype.mover;
  Inventario.prototype.mover = function (a, b) {
    if (b >= this.casillas.length || b < 0) throw new Error('casilla ' + b + ' fuera de la grilla');
    return _m.call(this, a, b); }; }`,
  },

  // ── Sección 6 · el guardado ───────────────────────────────────────────────
  {
    id: 'guardado-viejo-ignorado',
    que: 'reponer sólo entiende el formato nuevo y descarta la partida vieja',
    archivo: 'systems/Inventario.js',
    caeEn: 'el formato viejo entra: 3 maderas',
    parche: `{ const _r = Inventario.prototype.reponer;
  Inventario.prototype.reponer = function (d) {
    if (Array.isArray(d) && Array.isArray(d[0])) return false;
    return _r.call(this, d); }; }`,
  },
  {
    id: 'serializar-compacta',
    que: 'serializar guarda las pilas compactadas y pierde las posiciones',
    archivo: 'systems/Inventario.js',
    caeEn: 'ida y vuelta deja la grilla idéntica',
    // Compacta la grilla venga en la forma que venga. La primera versión sólo
    // sabía compactar un array pelado, y la implementación devuelve
    // `{ casillas: [...] }`: el parche no tocaba nada y el falsador cantaba «NO
    // LO VIO» contra un defecto que en realidad nunca llegó a plantarse. Un
    // falsador que no planta lo que dice es peor que no tenerlo.
    parche: `{ const _s = Inventario.prototype.serializar;
  const compactar = (a) => a.filter(Boolean);
  Inventario.prototype.serializar = function () {
    const d = _s.call(this);
    if (Array.isArray(d)) return compactar(d);
    if (d && Array.isArray(d.casillas)) return { ...d, casillas: compactar(d.casillas) };
    return d; }; }`,
  },
  {
    id: 'muerte-no-vacia',
    que: 'la muerte deja el bolso lleno',
    archivo: 'systems/Inventario.js',
    caeEn: 'la muerte vacía el bolso',
    parche: `Inventario.prototype.vaciar = function () { this.alCambiar?.(); };`,
  },
  {
    id: 'items-sobrevive',
    que: 'items sigue existiendo y el resto del juego lo puede seguir usando por atrás',
    archivo: 'systems/Inventario.js',
    caeEn: 'items ya no existe',
    parche: `Object.defineProperty(Inventario.prototype, 'items', {
    get() { return new Map((this.casillas || []).filter(Boolean).map(c => [c.id, c.n])); } });`,
  },
];

// ── Corrida ─────────────────────────────────────────────────────────────────

/**
 * Copia `src/` a un destino de afuera del proyecto.
 *
 * Con el `package.json` al lado, y no es un detalle: la copia queda fuera del
 * árbol del proyecto, así que Node no encuentra el `"type": "module"` de arriba
 * y lee los `.js` como CommonJS. Sin esto todas las secciones mueren con
 * «Cannot use import statement outside a module» y el falsador confunde eso con
 * que el defecto lo mató.
 */
function copiarSrc(dest) {
  fs.cpSync(SRC, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), '{ "type": "module" }\n');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1' },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/@@RESULTADO (.+)/);
  if (!m) return { error: salida.slice(-800) };
  return { secciones: JSON.parse(m[1]) };
}

/** Aserciones en ok, aplanadas a un mapa descripción -> ok. */
function aplanar(secciones) {
  const m = new Map();
  for (const s of secciones) {
    for (const c of s.checks) m.set(`${s.num}·${c.desc}`, c.ok);
    m.set(`${s.num}·CAMINO FELIZ`, s.feliz);
  }
  return m;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'falsar-r6-'));
console.log(`\n  FALSADOR R6 · FASE 1   (copias en ${tmp})\n`);

// Línea de base: sin defectos, el banco tiene que estar verde. Si no lo está,
// el falsador no puede distinguir su defecto de lo que ya estaba roto.
const limpio = path.join(tmp, 'limpio');
copiarSrc(limpio);
const base = correrBanco(limpio);
if (base.error) {
  console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`);
  process.exit(1);
}
const baseMapa = aplanar(base.secciones);
const rojasBase = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
if (rojasBase.length) {
  console.log(`  ROJO  la base ya tiene ${rojasBase.length} aserciones caídas; el falsador no puede`);
  console.log(`        distinguir su defecto de lo que ya estaba mal. Arreglar primero:`);
  for (const k of rojasBase.slice(0, 12)) console.log(`          ${k}`);
  process.exit(1);
}
console.log(`  base limpia: ${baseMapa.size} aserciones, todas verdes\n`);

const cuenta = { vio: 0, otro: 0, no: 0, sin: 0 };
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  if (d.saltear) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} ${d.que}`);
    console.log(`                      ${d.porQue}`);
    cuenta.sin++;
    continue;
  }
  const dest = path.join(tmp, d.id);
  copiarSrc(dest);
  const archivo = path.join(dest, ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} no existe ${d.archivo}`);
    cuenta.sin++; continue;
  }
  fs.appendFileSync(archivo, `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.parche}\n`);

  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(0, 3).join(' / ')}`);
    cuenta.sin++; continue;
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

const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
console.log(`\n  ${cuenta.no === 0 ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}\n`);
if (cuenta.no === 0 && cuenta.otro === 0) fs.rmSync(tmp, { recursive: true, force: true });
else console.log(`  las copias quedan en ${tmp} para mirarlas\n`);
process.exitCode = cuenta.no === 0 ? 0 : 1;
