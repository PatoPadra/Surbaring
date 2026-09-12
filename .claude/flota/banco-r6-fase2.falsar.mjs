/**
 * FALSADOR DEL BANCO R6 · FASE 2.
 *
 * Mismo método que el de la fase 1, y por las mismas razones: los defectos se
 * plantan **pegando un parche al final del módulo copiado**, no buscando texto
 * en el código del agente, así el falsador vale cualquiera sea la
 * implementación de adentro. La copia se hace con `fs.cpSync` y con un
 * `package.json` al lado, sin el cual Node lee los `.js` como CommonJS y todas
 * las secciones mueren por la misma razón.
 *
 *   LO VIO             cayó la aserción declarada
 *   LO VIO POR OTRO    el banco se puso rojo, pero por otra aserción
 *   NO LO VIO          el banco quedó verde con el defecto puesto  ← el malo
 *   NO SE PUDO PLANTAR el parche no aplicó o el módulo no cargó
 *
 * Uso: node .claude/flota/banco-r6-fase2.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r6-fase2.mjs');

const DEFECTOS = [
  // ── Sección 1 · la fase 1 sigue en pie ────────────────────────────────────
  {
    id: 'pila-abierta-rota',
    que: 'meter herramientas rompió el completar la pila abierta de los recursos',
    archivo: 'systems/Inventario.js',
    caeEn: 'se sigue completando la pila abierta',
    parche: `{ const _a = Inventario.prototype.agregar;
  Inventario.prototype.agregar = function (r, n) {
    const tocadas = [];
    for (const c of this.casillas) if (c && c.id === r) { tocadas.push([c, c.id]); c.id = '__x__' + c.id; }
    const e = _a.call(this, r, n);
    for (const [c, id] of tocadas) c.id = id;
    return e; }; }`,
  },
  {
    id: 'listar-cuenta-herramientas',
    que: 'listar() empieza a devolver también las instancias, y el HUD las cuenta como recurso',
    archivo: 'systems/Inventario.js',
    caeEn: 'listar sigue juntando las pilas en un renglón',
    parche: `{ const _l = Inventario.prototype.listar;
  Inventario.prototype.listar = function () {
    const filas = _l.call(this);
    for (const c of this.casillas) if (c && c.usos !== undefined)
      filas.push({ id: c.id, nombre: c.id, cantidad: 1, kg: 0, cat: 'material' });
    // y ademas parte en dos el renglon de la madera blanda
    const i = filas.findIndex(f => f.id === 'madera_blanda');
    if (i >= 0) filas.splice(i + 1, 0, { ...filas[i], cantidad: 0 });
    return filas; }; }`,
  },

  // ── Sección 2 · la API vieja de Equipo ────────────────────────────────────
  {
    id: 'enranura-devuelve-id',
    que: 'enRanura devuelve el id pelado y no algo con .nombre',
    archivo: 'systems/Equipo.js',
    caeEn: 'y con .nombre, que lo leen main, Cuerpo, Caza y Recoleccion',
    parche: `{ const _e = Equipo.prototype.enRanura;
  Equipo.prototype.enRanura = function (r) { const v = _e.call(this, r); return v ? { id: v.id } : v; }; }`,
  },
  {
    id: 'suma-ignora-lo-puesto',
    que: 'suma() deja de leer el efecto de lo puesto y el abrigo no abriga',
    archivo: 'systems/Equipo.js',
    caeEn: 'suma() lee el efecto de lo puesto',
    parche: `Equipo.prototype.suma = function () { return 0; };`,
  },
  {
    id: 'luz-se-gasta-a-golpes',
    que: 'la antorcha vuelve a gastarse a golpes, el defecto que arregló la ronda 5',
    archivo: 'systems/Equipo.js',
    caeEn: 'una luz no se gasta a golpes',
    parche: `{ const _d = Equipo.prototype.desgastar;
  Equipo.prototype.desgastar = function (c = 1) {
    const puesta = this.enRanura && this.enRanura('mano');
    if (puesta && this.definicion(puesta.id)?.efecto?.luz) return true;
    return _d.call(this, c); }; }`,
  },
  {
    id: 'luz-no-se-apaga',
    que: 'apagar() no apaga: la antorcha queda encendida para siempre',
    archivo: 'systems/Equipo.js',
    caeEn: 'y apagada deja de verse',
    parche: `Equipo.prototype.apagar = function () { return false; };`,
  },

  // ── Sección 3 · instancias ────────────────────────────────────────────────
  {
    id: 'segunda-renueva',
    que: 'fabricar la segunda hacha le renueva los usos a la primera, como antes',
    archivo: 'systems/Equipo.js',
    caeEn: 'fabricar dos veces da DOS, no una renovada',
    parche: `{ const _g = Equipo.prototype.guardar;
  Equipo.prototype.guardar = function (id) {
    const inv = this.inventario;
    const ya = (inv?.casillas || []).find(c => c && c.id === id && c.usos !== undefined)
      || (this.enRanura && this.enRanura('mano')?.id === id ? this.enRanura('mano') : null);
    if (ya) { ya.usos = this.definicion(id)?.durabilidad ?? ya.usos; inv?.alCambiar?.(); return true; }
    return _g.call(this, id); }; }`,
  },
  {
    id: 'instancias-apilan',
    que: 'mover una instancia sobre otra igual las apila en n = 2',
    archivo: 'systems/Inventario.js',
    caeEn: 'mover una sobre la otra NO las apila',
    parche: `{ const _m = Inventario.prototype.mover;
  Inventario.prototype.mover = function (a, b) {
    const A = this.casillas[a], B = this.casillas[b];
    if (A && B && A.id === B.id && A.usos !== undefined) {
      B.n = (B.n || 1) + (A.n || 1); this.casillas[a] = null;
      this._recontar?.(); this.alCambiar?.(); return true; }
    return _m.call(this, a, b); }; }`,
  },
  {
    id: 'durabilidad-compartida',
    que: 'gastar la que está en la mano gasta también la del bolso',
    archivo: 'systems/Equipo.js',
    caeEn: 'y la del bolso no',
    parche: `{ const _d = Equipo.prototype.desgastar;
  Equipo.prototype.desgastar = function (c = 1) {
    const r = _d.call(this, c);
    const puesta = this.enRanura && this.enRanura('mano');
    if (puesta) for (const cel of (this.inventario?.casillas || []))
      if (cel && cel.id === puesta.id && cel.usos !== undefined) cel.usos = puesta.usos;
    return r; }; }`,
  },
  {
    id: 'objeto-pesa-por-omision',
    que: 'el objeto pesa el 0,5 kg por omisión de pesoDe en vez de su kg fichado',
    archivo: 'systems/Inventario.js',
    // Contra la asercion de la herramienta GUARDADA: `guardar()` equipa sola,
    // asi que el parche --que solo toca la grilla-- no llega a la primera.
    caeEn: 'guardada en un casillero pesa los mismos',
    parche: `{ const _p = Object.getOwnPropertyDescriptor(Inventario.prototype, 'pesoKg');
  Object.defineProperty(Inventario.prototype, 'pesoKg', { configurable: true, get() {
    let extra = 0;
    for (const c of this.casillas || []) if (c && c.usos !== undefined) extra += 0.5 - 0.2;
    return _p.get.call(this) + extra; } }); }`,
  },

  // ── Sección 4 · la ranura ─────────────────────────────────────────────────
  {
    id: 'equipar-no-libera',
    que: 'lo puesto sigue ocupando su casillero además de la ranura',
    archivo: 'systems/Equipo.js',
    caeEn: 'equipar libera el casillero',
    parche: `{ const _e = Equipo.prototype.equipar;
  Equipo.prototype.equipar = function (id) {
    const inv = this.inventario;
    const antes = (inv?.casillas || []).map(c => c && { ...c });
    const r = _e.call(this, id);
    // devuelve la copia al casillero que se acaba de liberar
    if (r && inv) for (let i = 0; i < antes.length; i++)
      if (antes[i] && antes[i].id === id && !inv.casillas[i]) { inv.casillas[i] = antes[i]; break; }
    inv?._recontar?.();
    return r; }; }`,
  },
  {
    id: 'desequipar-con-todo-lleno',
    que: 'desequipar con la grilla llena tira la herramienta al vacío',
    archivo: 'systems/Equipo.js',
    caeEn: 'con la grilla llena, desequipar devuelve false',
    parche: `{ const _d = Equipo.prototype.desequipar;
  Equipo.prototype.desequipar = function (r) {
    const inv = this.inventario;
    if (inv && inv.casillas && inv.casillas.every(Boolean)) {
      const p = this.puesto?.[r];
      if (p) { this.puesto[r] = null; this.alCambiar?.(); return true; }
    }
    return _d.call(this, r); }; }`,
  },
  {
    id: 'puesto-no-pesa',
    que: 'lo que llevás puesto deja de pesar: el quillango de 4,5 kg sale gratis',
    archivo: 'systems/Equipo.js',
    caeEn: 'pero sigue pesando: la estás cargando igual',
    parche: `{ const _e = Equipo.prototype.equipar;
  Equipo.prototype.equipar = function (id) {
    const r = _e.call(this, id);
    if (r && this._puestoFuera === undefined) {
      const inv = this.inventario;
      if (inv) { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inv), 'pesoKg');
        Object.defineProperty(inv, 'pesoKg', { configurable: true, get() {
          let m = 0; for (const ran of ['mano','arma','abrigo','espalda']) {
            const p = this.__eq?.enRanura?.(ran); if (p) m += (this.__eq.definicion(p.id)?.kg) || 0; }
          return d.get.call(this) - m; } });
        inv.__eq = this; }
    }
    return r; }; }`,
  },

  // ── Sección 5 · fabricar ──────────────────────────────────────────────────
  {
    id: 'fabrica-sin-lugar',
    que: 'con todo lleno la fabricación se hace igual y el objeto se pierde',
    archivo: 'systems/Fabricacion.js',
    caeEn: 'con todo lleno la fabricación NO se hace',
    parche: `{ const _f = Fabricacion.prototype.fabricar;
  Fabricacion.prototype.fabricar = function (obj) {
    const r = _f.call(this, obj);
    if (r && r.estado !== 'hecho' && r.estado !== 'falta_saber' && r.estado !== 'faltan_materiales')
      return { estado: 'hecho', objeto: obj, salida: [] };
    return r; }; }`,
  },
  {
    id: 'fabrica-y-come-materiales',
    que: 'la fabricación que no se puede hacer igual consume los materiales',
    archivo: 'systems/Fabricacion.js',
    caeEn: 'los materiales no se consumen',
    parche: `{ const _f = Fabricacion.prototype.fabricar;
  Fabricacion.prototype.fabricar = function (obj) {
    const r = _f.call(this, obj);
    if (r && r.estado !== 'hecho')
      for (const m of obj.materiales || []) this.inventario.consumirPara(m.recurso, m.cantidad);
    return r; }; }`,
  },

  // ── Sección 6 · el guardado ───────────────────────────────────────────────
  {
    id: 'taller-viejo-ignorado',
    que: 'reponer descarta el taller del formato viejo',
    archivo: 'systems/Equipo.js',
    caeEn: 'lo que estaba puesto vuelve puesto',
    parche: `{ const _r = Equipo.prototype.reponer;
  Equipo.prototype.reponer = function (d) {
    if (d && Array.isArray(d.taller) && Array.isArray(d.taller[0])) return false;
    return _r.call(this, d); }; }`,
  },
  {
    id: 'guardado-pierde-usos',
    que: 'al reponer, todo vuelve con la durabilidad entera y no con la que traía',
    archivo: 'systems/Equipo.js',
    caeEn: 'con los usos que traía',
    parche: `{ const _r = Equipo.prototype.reponer;
  Equipo.prototype.reponer = function (d) {
    const r = _r.call(this, d);
    // Por puesto[ranura] y no por enRanura(): eso devuelve una VISTA, y
    // escribirle los usos no llega a la instancia. Buen diseno del codigo y mal
    // parche del falsador -- decia plantar un defecto y no plantaba ninguno en
    // lo equipado. Sin acentos ni comillas invertidas: esto vive adentro de un
    // template literal y una comilla invertida corta la cadena.
    for (const ran of ['mano','arma','abrigo','espalda']) {
      const p = this.puesto?.[ran];
      if (p && p.usos !== undefined) p.usos = this.definicion(p.id)?.durabilidad ?? p.usos;
    }
    for (const c of (this.inventario?.casillas || []))
      if (c && c.usos !== undefined) c.usos = this.definicion(c.id)?.durabilidad ?? c.usos;
    return r; }; }`,
  },
  {
    id: 'guardado-no-cae-en-grilla',
    que: 'lo guardado y no puesto se pierde al reponer: sólo vuelve lo que estaba equipado',
    archivo: 'systems/Equipo.js',
    caeEn: 'lo guardado y no puesto cae en un casillero',
    parche: `{ const _r = Equipo.prototype.reponer;
  Equipo.prototype.reponer = function (d) {
    const r = _r.call(this, d);
    const inv = this.inventario;
    if (inv) for (let i = 0; i < inv.casillas.length; i++)
      if (inv.casillas[i] && inv.casillas[i].usos !== undefined) inv.casillas[i] = null;
    inv?._recontar?.();
    return r; }; }`,
  },
  {
    id: 'desborde-callado',
    que: 'un guardado con más objetos que casilleros pierde los que sobran sin avisar',
    archivo: 'systems/Inventario.js',
    caeEn: 'no se pierde callado',
    parche: `Object.defineProperty(Inventario.prototype, 'desbordado', {
    configurable: true, get() { return false; }, set() {} });`,
  },

  // ── Sección 7 · nueve no ahogan ───────────────────────────────────────────
  {
    id: 'herramientas-no-ocupan',
    que: 'las herramientas no ocupan casillero: la grilla pierde los dientes',
    archivo: 'systems/Equipo.js',
    caeEn: 'con DOCE se ahoga más del 10 %',
    parche: `{ const _g = Equipo.prototype.guardar;
  Equipo.prototype.guardar = function (id) {
    const inv = this.inventario;
    const r = _g.call(this, id);
    if (inv) for (let i = 0; i < inv.casillas.length; i++)
      if (inv.casillas[i] && inv.casillas[i].id === id && inv.casillas[i].usos !== undefined) { inv.casillas[i] = null; break; }
    inv?._recontar?.();
    return r; }; }`,
  },
  {
    id: 'grilla-agrandada',
    que: 'se agranda la grilla para que quepa todo, y deja de morder',
    archivo: 'systems/Recursos.js',
    caeEn: 'con DOCE se ahoga más del 10 %',
    parche: `{ const _c = casillasPara; casillasPara = function (k) { return _c(k) + 24; }; }`,
  },
];

/**
 * Copia `src/` a un destino de afuera del proyecto, con el `package.json` al
 * lado: sin él Node lee los `.js` como CommonJS y todas las secciones mueren
 * por la misma razón, que el falsador confundiría con el defecto plantado.
 */
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
  if (!m) return { error: salida.slice(-800) };
  return { secciones: JSON.parse(m[1]) };
}

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'falsar-r6f2-'));
console.log(`\n  FALSADOR R6 · FASE 2   (copias en ${tmp})\n`);

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
for (const d of DEFECTOS) {
  if (solo && d.id !== solo) continue;
  const dest = path.join(tmp, d.id);
  copiarSrc(dest);
  const archivo = path.join(dest, ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(26)} no existe ${d.archivo}`);
    cuenta.sin++; continue;
  }
  fs.appendFileSync(archivo, `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${d.parche}\n`);

  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(26)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(0, 3).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  const declarada = caidas.find(k => k.includes(d.caeEn));

  if (declarada) {
    console.log(`  LO VIO              ${d.id.padEnd(26)} ${d.que}`);
    console.log(`                      cayó «${declarada}»${caidas.length > 1 ? ` (y ${caidas.length - 1} más)` : ''}`);
    cuenta.vio++;
  } else if (caidas.length) {
    console.log(`  LO VIO POR OTRO     ${d.id.padEnd(26)} ${d.que}`);
    console.log(`                      esperaba «${d.caeEn}», cayó: ${caidas.slice(0, 3).join(' · ')}`);
    cuenta.otro++;
  } else {
    console.log(`  NO LO VIO           ${d.id.padEnd(26)} ${d.que}`);
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
