/**
 * FALSADOR DEL BANCO R7 · FASE 4 (vasija).
 *
 * Copia de `src/`, un defecto plantado, el banco contra la copia, y se mira si cae
 * la aserción declarada. `LO VIO`, `LO VIO POR OTRO`, `NO LO VIO`, `NO SE PUDO
 * PLANTAR`. Y tres CONTROLES al revés: cambios que el contrato permite, y con los
 * que el banco tiene que seguir verde; si cae, el banco fija de más.
 *
 * Se escribe antes que el código del agente y se corre después: la mayoría de los
 * defectos se montan sobre el tope de líquido, que en la base no existe. Los parches
 * van contra lo que el CONTRATO nombra: `Inventario.prototype.agregar`, `sacar`,
 * `reponer`, `consumirPara` y la puerta `liquido`; `Equipo.prototype.equipar`;
 * `Recoleccion.prototype.quePuedoHacer`, `actuar` y `comer`; el `_crear` del bolso,
 * donde se engancha la acción `tirar_obj`; el dataset y `Iconos.js`. No dependen de
 * dónde puso el agente el tope adentro de `Inventario`.
 *
 * Para saber cuánto guarda un objeto desde el inventario, los defectos que lo
 * necesitan le cuelgan al inventario un puntero a su `Equipo` (una subclase que se
 * pega al final de `Equipo.js`): es andamio del falsador, no una costura del juego.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados como texto.
 * Los ayudantes comunes van con `var`, que se puede repetir sin romper la carga.
 *
 * Uso: node .claude/flota/banco-r7-fase4.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase4.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f4');
const SECCIONES = 'sinRecipiente,elRecipiente,antesDelCuero,beber,hornos,soltarYCargar,seVe,nadaMas';

const HERRAMIENTAS = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'herramientas.json'), 'utf8'));
/** Los recipientes que trajo el agente: los que guardan agua y no son el odre. */
const NUEVOS = (HERRAMIENTAS.objetos || []).filter((o) => Number(o.efecto?.guardaAgua) > 0 && o.id !== 'odre_cuero').map((o) => o.id);

const CLASES = { 'systems/Inventario.js': 'Inventario', 'systems/Equipo.js': 'Equipo', 'systems/Recoleccion.js': 'Recoleccion', 'ui/Bolso.js': 'Bolso' };
const GETTER = ['systems/Inventario.js', /get\s+liquido\s*\(/];

// ── Ayudantes que se pegan ──────────────────────────────────────────────────

const COMUN_INV = String.raw`
var __LIQ = ['agua', 'agua_segura', 'infusion_canelo'];
var __forzar = function (inv, k, n) {
  let falta = n;
  const tope = pilaDe(pesoDe(k));
  for (let i = 0; i < inv.casillas.length && falta > 0; i++) {
    if (inv.casillas[i]) continue;
    const pone = Math.min(falta, tope);
    inv.casillas[i] = { id: k, n: pone };
    falta -= pone;
  }
  inv.recontar();
  return n - falta;
};
var __capDe = function (inv, id) {
  const eq = inv.__equipo;
  const d = eq && eq.definicion(id);
  return (d && d.efecto && Number(d.efecto.guardaAgua)) || 0;
};
`;

const COMUN_EQ = String.raw`
if (!Equipo.__conPuntero) {
  const __Base = Equipo;
  Equipo = class extends __Base {
    constructor(...a) { super(...a); if (this.inventario) this.inventario.__equipo = this; }
  };
  Equipo.__conPuntero = true;
}
`;

function agregar(nombre, cuerpo) {
  return COMUN_INV + String.raw`
var __ag_` + nombre + String.raw` = Inventario.prototype.agregar;
Inventario.prototype.agregar = function (recurso, cantidad) {
  const __orig = __ag_` + nombre + String.raw`;
  const k = normalizar(recurso);
  const n0 = Math.max(0, Math.floor(Number(cantidad) || 0));
  ` + cuerpo + String.raw`
};
`;
}

const ES_BEBER = String.raw`
var __esBeber = (acc) => !!acc && (acc.tipo === 'beber' || /beber/i.test(acc.etiqueta || ''));
`;

function bolso(cuerpo) {
  return String.raw`
var __crear_B = Bolso.prototype._crear;
Bolso.prototype._crear = function (...a) {
  const r = __crear_B.apply(this, a);
  const inv = this.inventario;
  const hud = this.hud;
  const LIQ = ['agua', 'agua_segura', 'infusion_canelo'];
  ` + cuerpo + String.raw`
  return r;
};
`;
}

// ── Los defectos ────────────────────────────────────────────────────────────

const DEFECTOS = [
  // ── Sin recipiente ──
  {
    id: 'sin-tope', que: 'los líquidos entran sueltos, sin recipiente',
    caeEn: 'sin recipiente, agua entra cero',
    anexos: [['systems/Inventario.js', agregar('st', String.raw`
  const n = __orig.call(this, recurso, cantidad);
  if (__LIQ.includes(k) && n < n0) return n + __forzar(this, k, n0 - n);
  return n;`)]],
  },
  {
    id: 'solo-agua', que: 'el tope muerde al agua y no al agua hervida ni a la infusión',
    caeEn: 'sin recipiente, agua_segura entra cero',
    anexos: [['systems/Inventario.js', agregar('sa', String.raw`
  const n = __orig.call(this, recurso, cantidad);
  if ((k === 'agua_segura' || k === 'infusion_canelo') && n < n0) return n + __forzar(this, k, n0 - n);
  return n;`)]],
  },
  {
    id: 'por-hidrata', que: 'todo lo que hidrata se trata como líquido: la fruta pide recipiente',
    caeEn: 'recursos entran como antes',
    anexos: [['systems/Inventario.js', agregar('ph', String.raw`
  if (!__LIQ.includes(k) && RECURSOS[k] && RECURSOS[k].hidrata > 0) {
    const lq = this.liquido;
    if (!lq || lq.cabe - lq.lleva < n0) return 0;
  }
  return __orig.call(this, recurso, cantidad);`)]],
  },

  // ── El recipiente ──
  {
    id: 'tope-escrito', que: 'cada recipiente guarda 6 escrito a mano, diga lo que diga la ficha',
    caeEn: 'con la ficha cambiada a 9, el odre guarda 9',
    anexos: [
      ['systems/Equipo.js', COMUN_EQ],
      ['systems/Inventario.js', agregar('te', String.raw`
  if (!__LIQ.includes(k) || !this.__equipo) return __orig.call(this, recurso, cantidad);
  let cuantos = 0;
  for (const x of this.__equipo.todas()) if (__capDe(this, x.cosa.id) > 0) cuantos++;
  const quiere = Math.min(n0, Math.max(0, 6 * cuantos - this.liquido.lleva));
  const n = __orig.call(this, recurso, quiere);
  return n < quiere ? n + __forzar(this, k, quiere - n) : n;`)],
    ],
  },
  {
    id: 'uno-solo', que: 'dos recipientes guardan lo del más grande, no la suma',
    caeEn: 'dos odres guardan doce',
    anexos: [
      ['systems/Equipo.js', COMUN_EQ],
      ['systems/Inventario.js', agregar('us', String.raw`
  if (!__LIQ.includes(k) || !this.__equipo) return __orig.call(this, recurso, cantidad);
  let max = 0;
  for (const x of this.__equipo.todas()) max = Math.max(max, __capDe(this, x.cosa.id));
  return __orig.call(this, recurso, Math.min(n0, Math.max(0, max - this.liquido.lleva)));`)],
    ],
  },
  {
    id: 'mezcla-no-comparte', que: 'cada clase de líquido tiene su propio tope entero',
    caeEn: 'las tres clases comparten el tope',
    anexos: [['systems/Inventario.js', agregar('mc', String.raw`
  if (!__LIQ.includes(k)) return __orig.call(this, recurso, cantidad);
  const lq = this.liquido;
  const quiere = Math.min(n0, Math.max(0, lq.cabe - this.cantidad(k)));
  const n = __orig.call(this, recurso, quiere);
  return n < quiere ? n + __forzar(this, k, quiere - n) : n;`)]],
  },
  {
    id: 'puesto-no-cuenta', que: 'un recipiente puesto en una ranura no guarda nada',
    caeEn: 'puesto, el odre guarda seis igual',
    anexos: [
      ['systems/Equipo.js', COMUN_EQ],
      ['systems/Inventario.js', agregar('pn', String.raw`
  if (!__LIQ.includes(k) || !this.__equipo) return __orig.call(this, recurso, cantidad);
  let puestos = 0;
  for (const cosa of Object.values(this.__equipo.puesto)) if (cosa) puestos += __capDe(this, cosa.id);
  const lq = this.liquido;
  return __orig.call(this, recurso, Math.min(n0, Math.max(0, lq.cabe - puestos - lq.lleva)));`)],
    ],
  },
  {
    id: 'no-baja', que: 'sacar un recipiente del bolso no baja el tope',
    caeEn: 'sacado el odre del bolso, el agua vuelve a entrar cero',
    anexos: [
      ['systems/Equipo.js', COMUN_EQ],
      ['systems/Inventario.js', String.raw`
var __sacarNB = Inventario.prototype.sacar;
Inventario.prototype.sacar = function (i) {
  const c = __sacarNB.call(this, i);
  if (c && c.usos !== undefined) this.__fantasma = (this.__fantasma || 0) + __capDe(this, c.id);
  return c;
};
` + agregar('nb', String.raw`
  const n = __orig.call(this, recurso, cantidad);
  if (!__LIQ.includes(k) || !this.__fantasma || n >= n0) return n;
  const lq = this.liquido;
  const extra = Math.min(n0 - n, Math.max(0, lq.cabe + this.__fantasma - lq.lleva));
  return n + __forzar(this, k, extra);`)],
    ],
  },
  {
    id: 'equipar-derrama', que: 'pasar un recipiente de la grilla a la ranura derrama lo que llevaba',
    caeEn: 'y volver a ponérselo tampoco',
    anexos: [['systems/Equipo.js', String.raw`
var __equiparD = Equipo.prototype.equipar;
Equipo.prototype.equipar = function (ref) {
  const inv = this.inventario;
  const cosa = typeof ref === 'string' ? null : ref;
  const lq = inv && inv.liquido;
  if (cosa && lq) {
    const d = this.definicion(cosa.id);
    const cap = (d && d.efecto && Number(d.efecto.guardaAgua)) || 0;
    let sobra = cap > 0 ? lq.lleva - (lq.cabe - cap) : 0;
    for (const id of ['agua', 'agua_segura', 'infusion_canelo']) {
      if (sobra <= 0) break;
      const q = Math.min(sobra, inv.cantidad(id));
      if (q) { inv.quitar(id, q); sobra -= q; }
    }
  }
  return __equiparD.call(this, ref);
};
`]],
  },

  // ── Antes del cuero ──
  {
    id: 'cuero-en-cadena', archivo: 'data/herramientas.json', que: 'todos los recipientes piden cuero curtido',
    caeEn: 'al menos un recipiente se fabrica sin cuero',
    json: (d) => { for (const o of d.objetos) if (Number(o.efecto?.guardaAgua) > 0) (o.materiales ||= []).push({ recurso: 'cuero_curtido', cantidad: 1 }); },
  },
  {
    id: 'sin-fuente', archivo: 'data/herramientas.json', que: 'los recipientes no dicen de dónde sale lo que guardan',
    caeEn: 'trae su fuente o su criterio en la ficha',
    json: (d) => { for (const o of d.objetos) if (Number(o.efecto?.guardaAgua) > 0) { delete o.fuente; delete o.criterio; } },
  },
  {
    id: 'capacidad-sin-fuente', archivo: 'data/herramientas.json', que: 'el recipiente nuevo guarda un número que su fuente no dice',
    caeEn: 'la fuente dice para cuánto guarda',
    sinPlantar: () => (NUEVOS.length ? null : 'no hay recipientes nuevos en el dataset'),
    json: (d) => { for (const o of d.objetos) if (NUEVOS.includes(o.id)) o.efecto.guardaAgua += 7; },
  },

  // ── Beber ──
  {
    id: 'beber-no-hidrata', que: 'sin lugar para la medida, beber no hidrata',
    caeEn: 'sin recipiente, beber hidrata como hoy',
    anexos: [['systems/Recoleccion.js', ES_BEBER + String.raw`
var __actBH = Recoleccion.prototype.actuar;
Recoleccion.prototype.actuar = function (...a) {
  const acc = this.quePuedoHacer(...a);
  const sed0 = this.jugador.sed;
  const lq = this.inventario.liquido;
  const r = __actBH.apply(this, a);
  if (__esBeber(acc) && lq && lq.lleva >= lq.cabe) this.jugador.sed = sed0;
  return r;
};
`]],
  },
  {
    id: 'beber-miente', que: 'el aviso de beber dice que te llevaste una medida, entre o no',
    caeEn: 'el aviso dice que no hay en qué llevarla',
    anexos: [['systems/Recoleccion.js', ES_BEBER + String.raw`
var __actBM = Recoleccion.prototype.actuar;
Recoleccion.prototype.actuar = function (...a) {
  const acc = this.quePuedoHacer(...a);
  if (!__esBeber(acc)) return __actBM.apply(this, a);
  const hud = this.hud;
  const aviso = hud.aviso;
  hud.aviso = function (t, d) { return aviso.call(hud, t, String(d == null ? '' : d) + ' · te llevaste una medida'); };
  try { return __actBM.apply(this, a); } finally { hud.aviso = aviso; }
};
`]],
  },
  {
    id: 'cartel-promete', que: 'el cartel de beber promete una medida aunque no entre',
    caeEn: 'sin recipiente, el cartel no promete una medida',
    anexos: [['systems/Recoleccion.js', ES_BEBER + String.raw`
var __qphCP = Recoleccion.prototype.quePuedoHacer;
Recoleccion.prototype.quePuedoHacer = function (...a) {
  const acc = __qphCP.apply(this, a);
  return __esBeber(acc) ? { ...acc, etiqueta: String(acc.etiqueta || '') + ' (1 × Agua)' } : acc;
};
`]],
  },

  // ── Los hornos ──
  {
    id: 'agregar-miente', que: 'agregar dice que entró todo el líquido aunque el tope lo cortó',
    caeEn: 'sin recipiente, el agua hervida queda esperando en el horno',
    anexos: [['systems/Inventario.js', agregar('am', String.raw`
  const n = __orig.call(this, recurso, cantidad);
  return __LIQ.includes(k) ? n0 : n;`)]],
  },

  // ── Soltar y cargar ──
  {
    id: 'derrama-todo', que: 'soltar un recipiente derrama todo el líquido, quepa o no',
    caeEn: 'con tres medidas, soltar un odre no derrama nada',
    anexos: [['ui/Bolso.js', bolso(String.raw`
  const sacar = inv.sacar;
  inv.sacar = function (i) {
    const c = sacar.call(inv, i);
    if (c && c.usos !== undefined) for (const id of LIQ) { const n = inv.cantidad(id); if (n) inv.quitar(id, n); }
    return c;
  };`)]],
  },
  {
    id: 'no-derrama', que: 'soltar un recipiente deja el líquido que ya no cabe',
    caeEn: 'con diez medidas y un odre menos, quedan las seis que caben',
    anexos: [['ui/Bolso.js', bolso(String.raw`
  const sacar = inv.sacar;
  let foto = null;
  inv.sacar = function (i) {
    if (!foto) foto = inv.casillas.map((c, j) => (c && LIQ.includes(c.id) ? [j, { id: c.id, n: c.n }] : null)).filter(Boolean);
    return sacar.call(inv, i);
  };
  const aviso = hud.aviso;
  hud.aviso = function (...x) {
    if (foto) {
      const g = inv.casillas;
      for (const [j, c] of foto) {
        if (g[j] && g[j].id === c.id && g[j].usos === undefined) g[j].n = c.n;
        else if (!g[j]) g[j] = { id: c.id, n: c.n };
        else { const h = g.findIndex((v) => !v); if (h >= 0) g[h] = { id: c.id, n: c.n }; }
      }
      inv.recontar();
      foto = null;
    }
    return aviso.apply(hud, x);
  };`)]],
  },
  {
    id: 'derrama-callado', que: 'soltar derrama pero el aviso no lo dice',
    caeEn: 'el aviso dice que se derramaron cuatro',
    anexos: [['ui/Bolso.js', bolso(String.raw`
  const aviso = hud.aviso;
  const q = (s) => String(s == null ? '' : s).replace(/derram\w*|volc\w*|escurr\w*|se (te )?ca[iy]\w*|perdiste|se perdi\w*/gi, 'quedó');
  hud.aviso = function (t, d, ...x) { return aviso.call(hud, q(t), q(d), ...x); };`)]],
  },
  {
    id: 'carga-recorta', que: 'al cargar un guardado se tira el líquido que sobra',
    caeEn: 'un guardado sin recipiente y con cinco de agua conserva las cinco',
    anexos: [['systems/Inventario.js', COMUN_INV + String.raw`
var __reponerCR = Inventario.prototype.reponer;
Inventario.prototype.reponer = function (...a) {
  const r = __reponerCR.apply(this, a);
  const lq = this.liquido;
  let sobra = lq ? lq.lleva - lq.cabe : 0;
  for (const id of __LIQ) {
    if (sobra <= 0) break;
    const q = Math.min(sobra, this.cantidad(id));
    if (q) { this.quitar(id, q); sobra -= q; }
  }
  return r;
};
`]],
  },

  // ── Se ve ──
  {
    id: 'liquido-kg', que: 'la puerta dice los kilos de líquido, no las medidas',
    caeEn: 'lleva 5, cabe 6',
    requiere: GETTER,
    anexos: [['systems/Inventario.js', COMUN_INV + String.raw`
var __dLK = Object.getOwnPropertyDescriptor(Inventario.prototype, 'liquido');
Object.defineProperty(Inventario.prototype, 'liquido', {
  configurable: true,
  get() {
    const v = __dLK.get.call(this);
    let kg = 0;
    for (const id of __LIQ) kg += this.cantidad(id) * pesoDe(id);
    return { ...v, lleva: Math.round(kg * 10) / 10 };
  },
});
`]],
  },

  // ── Nada más cambia ──
  {
    id: 'q-no-bebe', que: 'la Q ya no toma lo que se lleva en el recipiente',
    caeEn: 'la Q bebe el agua hervida que lleva el odre',
    anexos: [['systems/Recoleccion.js', String.raw`
var __comerQ = Recoleccion.prototype.comer;
Recoleccion.prototype.comer = function (...a) {
  const inv = this.inventario;
  const proto = Object.getPrototypeOf(inv);
  inv.listar = function () { return proto.listar.call(inv).filter((x) => !['agua', 'agua_segura', 'infusion_canelo'].includes(x.id)); };
  try { return __comerQ.apply(this, a); } finally { delete inv.listar; }
};
`]],
  },
  {
    id: 'consumir-al-reves', que: 'consumirPara(agua) gasta primero el agua hervida',
    caeEn: 'consumirPara(agua, 3) usa primero la común',
    anexos: [['systems/Inventario.js', String.raw`
var __consumirCR = Inventario.prototype.consumirPara;
Inventario.prototype.consumirPara = function (pedido, cantidad) {
  if (normalizar(pedido) !== 'agua') return __consumirCR.call(this, pedido, cantidad);
  const s = Math.min(cantidad, this.cantidad('agua_segura'));
  if (s) this.quitar('agua_segura', s);
  return s >= cantidad ? true : __consumirCR.call(this, pedido, cantidad - s);
};
`]],
  },
  {
    id: 'sin-icono', archivo: 'ui/Iconos.js', que: 'el recipiente nuevo no tiene icono',
    caeEn: 'tiene icono en Iconos.js',
    sinPlantar: () => (NUEVOS.length ? null : 'no hay recipientes nuevos en el dataset'),
    texto: (txt) => {
      let t = txt;
      for (const id of NUEVOS) t = t.replace(new RegExp('(^|[\\s{,\'"])' + id + '([\'"]?\\s*:)', 'gm'), '$1' + id + '_borrado$2');
      return t;
    },
  },

  // ── Controles al revés: el contrato los permite, el banco tiene que seguir verde ──
  {
    id: 'control-promete-si-entra', control: true, que: 'el cartel de beber promete la medida cuando sí entra',
    anexos: [['systems/Recoleccion.js', ES_BEBER + String.raw`
var __qphPE = Recoleccion.prototype.quePuedoHacer;
Recoleccion.prototype.quePuedoHacer = function (...a) {
  const acc = __qphPE.apply(this, a);
  const lq = this.inventario.liquido;
  return __esBeber(acc) && lq && lq.cabe - lq.lleva >= 1 ? { ...acc, etiqueta: String(acc.etiqueta || '') + ' (1 × Agua)' } : acc;
};
`]],
  },
  {
    id: 'control-aviso-reescrito', control: true, que: 'el aviso de beber sin lugar dice otra cosa con el mismo sentido',
    anexos: [['systems/Recoleccion.js', ES_BEBER + String.raw`
var __actAR = Recoleccion.prototype.actuar;
Recoleccion.prototype.actuar = function (...a) {
  const acc = this.quePuedoHacer(...a);
  const lq = this.inventario.liquido;
  if (!__esBeber(acc) || !lq || lq.cabe - lq.lleva >= 1) return __actAR.apply(this, a);
  const hud = this.hud;
  const aviso = hud.aviso;
  hud.aviso = function (t) { return aviso.call(hud, t, 'No tenés en qué llevarla'); };
  try { return __actAR.apply(this, a); } finally { hud.aviso = aviso; }
};
`]],
  },
  {
    id: 'control-liquido-extra', control: true, que: 'la puerta liquido trae campos de más',
    requiere: GETTER,
    anexos: [['systems/Inventario.js', String.raw`
var __dLE = Object.getOwnPropertyDescriptor(Inventario.prototype, 'liquido');
Object.defineProperty(Inventario.prototype, 'liquido', {
  configurable: true,
  get() { const v = __dLE.get.call(this); return { ...v, libre: Math.max(0, v.cabe - v.lleva), unidad: 'medida' }; },
});
`]],
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
  if (d.sinPlantar) { const m = d.sinPlantar(); if (m) return m; }
  const partes = d.anexos || [[d.archivo, null]];
  for (const [rel, anexo] of partes) {
    const archivo = path.join(dest, ...rel.split('/'));
    if (!fs.existsSync(archivo)) return `no existe ${rel}`;
    let txt = fs.readFileSync(archivo, 'utf8');
    const clase = CLASES[rel];
    if (clase && !new RegExp('export\\s+class\\s+' + clase + '\\b').test(txt)) return `${clase} ya no es una clase exportada`;
    if (d.requiere && d.requiere[0] === rel && !d.requiere[1].test(txt)) return `${rel} no tiene ${d.requiere[1]}`;
    if (d.json && rel === d.archivo) {
      const datos = JSON.parse(txt);
      d.json(datos);
      txt = JSON.stringify(datos, null, 2);
    }
    if (d.texto && rel === d.archivo) {
      const nuevo = d.texto(txt);
      if (nuevo === txt) return `el texto de ${rel} no cambió`;
      txt = nuevo;
    }
    if (anexo) txt += `\n\n/* DEFECTO PLANTADO: ${d.que} */\n${anexo}\n`;
    fs.writeFileSync(archivo, txt);
  }
  return null;
}

const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1] : null;

if (process.argv.includes('--sintaxis')) {
  // Sin banco: planta cada defecto y carga los archivos tocados, para ver que el
  // parche es JavaScript que se deja evaluar. Sirve antes de que exista el código
  // del agente, cuando la base está roja y la corrida entera no arranca.
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
    if (motivo) { console.log(`  no se planta en la base  ${d.id.padEnd(26)} ${motivo}`); continue; }
    const tocados = (d.anexos || [[d.archivo]]).map(([rel]) => rel).filter((rel) => rel.endsWith('.js'));
    for (const rel of tocados) {
      const url = 'file:///' + path.join(dest, ...rel.split('/')).replace(/\\/g, '/');
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', `${ARRANQUE}await import(${JSON.stringify(url)});`], { encoding: 'utf8', timeout: 60000 });
      const ok = r.status === 0;
      if (!ok) malos++;
      console.log(`  ${ok ? 'carga   ' : 'NO CARGA'}  ${d.id.padEnd(26)} ${rel}${ok ? '' : '  ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' / ')}`);
    }
  }
  console.log(`\n  ${malos ? 'ROJO ' : 'VERDE'}  ${malos} archivos parchados no cargan\n`);
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.exit(malos ? 1 : 0);
}

fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n  FALSADOR R7 · FASE 4   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: las secciones 9 y 10 (regresión y build) se saltean con BANCO_SRC.');
console.log(`        recipientes nuevos en el dataset: ${NUEVOS.join(', ') || 'ninguno'}\n`);

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
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(26)} ${motivo}`); cuenta.sin++; continue; }
  const r = correrBanco(dest);
  if (r.error) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(26)} el banco no arrancó con el parche`);
    console.log(`                      ${r.error.split('\n').slice(-4).join(' / ')}`);
    cuenta.sin++; continue;
  }
  const mapa = aplanar(r.secciones);
  const caidas = [...mapa].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  if (d.control) {
    if (caidas.length) {
      console.log(`  CONTROL ROJO        ${d.id.padEnd(26)} ${d.que}`);
      console.log(`                      el banco fija de más, cayó: ${caidas.slice(0, 3).join(' · ')}`);
      cuenta.controlMal++;
    } else {
      console.log(`  CONTROL VERDE       ${d.id.padEnd(26)} ${d.que}`);
      cuenta.controlOk++;
    }
    continue;
  }
  const declarada = caidas.find((k) => k.includes(d.caeEn));
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
