/**
 * FALSADOR DEL BANCO R7 · FASE 1.
 *
 * El mismo método de la ronda 6: se copia `src/`, se planta un defecto, se corre
 * el banco contra la copia y se mira si cae **la aserción que corresponde**. Tres
 * desenlaces, que no se mezclan: `LO VIO`, `NO LO VIO`, `NO SE PUDO PLANTAR`.
 *
 * Tres cosas propias de esta fase:
 *
 * 1. **Las copias van adentro del proyecto** (`.claude/flota/.tmp-falsar-r7f1/`,
 *    ignorado por git) y no en la carpeta temporal del sistema. El banco carga el
 *    `Jugador` de verdad, que importa `three`, y desde afuera del proyecto Node no
 *    encuentra `node_modules`: todas las secciones morirían por la misma razón y
 *    el falsador lo contaría como que vio el defecto.
 * 2. **Los defectos de `Entrada` se plantan en el entorno, no en el código del
 *    agente.** `Entrada` escucha eventos que el banco dispara; el parche subclasea
 *    la clase exportada y envuelve los escuchas que registra al construirse. Así
 *    se rompe «W corta el andar solo» sin saber cómo lo escribió el agente: sólo
 *    con los nombres del contrato (`autoAndar`, `adelante`, `bloqueado`).
 * 3. **Hay dos controles al revés**: cambios legítimos que el banco NO tiene que
 *    marcar. Se cambia el rinde en su fuente —`COSECHA_SOTOBOSQUE` y la acción
 *    `trozar` del dataset— y el banco tiene que quedar verde, porque el cartel
 *    tiene que seguir a la fuente solo. Si se pone rojo, el defecto no es del
 *    banco: es que el agente escribió el número dos veces.
 *
 * Adentro de los parches no hay comillas invertidas ni `${`: van pegados en una
 * plantilla de texto. Y las expresiones regulares de los parches van en cadenas
 * crudas, porque en una plantilla `\s` es una `s` suelta (la trampa de la ronda 6).
 *
 * Uso: node .claude/flota/banco-r7-fase1.falsar.mjs [--solo <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.join(RAIZ, 'src');
const BANCO = path.join(AQUI, 'banco-r7-fase1.mjs');
const TMP = path.join(AQUI, '.tmp-falsar-r7f1');

// ── Parches de Entrada: una subclase que envuelve los escuchas ───────────────

function entrada({ ventana = '', doc = '', despues = '', proto = '' }) {
  return `
const __EntradaOriginal = Entrada;
function __envVentana(t, fn, yo) { ${ventana}
  return fn; }
function __envDoc(t, fn, yo) { ${doc}
  return fn; }
Entrada = class extends __EntradaOriginal {
  constructor(lienzo) {
    const __add = globalThis.addEventListener;
    const __d = globalThis.document;
    const __dadd = __d && __d.addEventListener;
    let __yo = null;
    const yo = () => __yo;
    globalThis.addEventListener = (t, fn, o) => __add(t, __envVentana(t, fn, yo), o);
    if (__d) __d.addEventListener = (t, fn, o) => __dadd.call(__d, t, __envDoc(t, fn, yo), o);
    try { super(lienzo); } finally {
      globalThis.addEventListener = __add;
      if (__d) __d.addEventListener = __dadd;
    }
    __yo = this;
    ${despues}
  }
};
${proto}
`;
}

// ── Parches de Recoleccion: envuelven lo que devuelve quePuedoHacer ──────────

function cartel(cuerpo) {
  return `
const __qph = Recoleccion.prototype.quePuedoHacer;
Recoleccion.prototype.quePuedoHacer = function (...args) {
  const acc = __qph.apply(this, args);
  if (!acc) return acc;
  const r = { ...acc };
  ${cuerpo}
  return r;
};
`;
}

function actuar(cuerpo) {
  return `
const __actuar = Recoleccion.prototype.actuar;
Recoleccion.prototype.actuar = function (...args) {
  const acc = this.quePuedoHacer(...args);
  const salida = __actuar.apply(this, args);
  ${cuerpo}
  return salida;
};
`;
}

const DEFECTOS = [
  // ── Andar solo ──
  {
    id: 'w-no-corta', archivo: 'engine/Entrada.js', que: 'apretar W no corta el andar solo',
    caeEn: 'KeyW corta el andar solo',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') return (e) => { const antes = yo() && yo().autoAndar; fn(e); if (antes && e.code === 'KeyW') yo().autoAndar = true; };` }),
  },
  {
    id: 's-no-corta', archivo: 'engine/Entrada.js', que: 'apretar S no corta el andar solo',
    caeEn: 'KeyS corta el andar solo',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') return (e) => { const antes = yo() && yo().autoAndar; fn(e); if (antes && e.code === 'KeyS') yo().autoAndar = true; };` }),
  },
  {
    id: 'soltar-no-corta', archivo: 'engine/Entrada.js', que: 'abrir un panel suelta el puntero y el personaje sigue caminando',
    caeEn: 'soltar el puntero (abrir un panel, morir) lo corta',
    anexo: entrada({ doc: String.raw`if (t === 'pointerlockchange') return (e) => { const antes = yo() && yo().autoAndar; fn(e); if (antes) yo().autoAndar = true; };` }),
  },
  {
    id: 'blur-no-corta', archivo: 'engine/Entrada.js', que: 'cambiar de ventana no corta el andar solo',
    caeEn: 'perder el foco de la ventana lo corta',
    anexo: entrada({ ventana: String.raw`if (t === 'blur') return (e) => { const antes = yo() && yo().autoAndar; fn(e); if (antes) yo().autoAndar = true; };` }),
  },
  {
    id: 'a-corta', archivo: 'engine/Entrada.js', que: 'doblar con A corta el andar solo',
    caeEn: 'KeyA no corta el andar solo',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') return (e) => { fn(e); if (e.code === 'KeyA' && yo()) yo().autoAndar = false; };` }),
  },
  {
    id: 'z-sin-puntero', archivo: 'engine/Entrada.js', que: 'Z prende con un panel abierto y el personaje se va caminando solo',
    caeEn: 'con el puntero suelto (un panel abierto), Z no prende',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') return (e) => { fn(e); if (e.code === 'KeyZ' && !e.repeat && yo() && !yo().bloqueado) yo().autoAndar = true; };` }),
  },
  {
    id: 'z-escribiendo', archivo: 'engine/Entrada.js', que: 'escribir una z en el buscador del códice prende el andar solo',
    caeEn: 'escribiendo en un campo, Z no prende',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') return (e) => { fn(e); if (e.code === 'KeyZ' && e.target && e.target.tagName === 'INPUT' && yo()) yo().autoAndar = true; };` }),
  },
  {
    id: 'repeticion-alterna', archivo: 'engine/Entrada.js', que: 'dejar Z apretada la apaga por repetición',
    caeEn: 'dejar Z apretada no la prende y apaga por repetición',
    anexo: entrada({ ventana: String.raw`if (t === 'keydown') { let rep = false; return (e) => { fn(e); if (e.code === 'KeyZ' && e.repeat && !rep && yo()) { rep = true; yo().autoAndar = !yo().autoAndar; } }; }` }),
  },
  {
    id: 'sin-clase', archivo: 'engine/Entrada.js', que: 'el andar solo no se ve: la clase del documento no se pone nunca',
    caeEn: 'prendido, el cuerpo del documento lleva la clase auto-andar',
    anexo: entrada({ despues: String.raw`const cl = globalThis.document && globalThis.document.body && globalThis.document.body.classList;
    if (cl) { const t0 = cl.toggle.bind(cl), a0 = cl.add.bind(cl);
      cl.toggle = (n, f) => (n === 'auto-andar' ? false : t0(n, f));
      cl.add = (...n) => a0(...n.filter((x) => x !== 'auto-andar')); }` }),
  },
  {
    id: 'adelante-sin-auto', archivo: 'engine/Entrada.js', que: 'autoAndar se prende pero adelante no lo lee: el Jugador no se mueve',
    caeEn: 'con Z el Jugador de verdad camina lo mismo que con W',
    anexo: entrada({ proto: String.raw`Object.defineProperty(Entrada.prototype, 'adelante', { configurable: true, get() {
  return (this.tecla('KeyW') || this.tecla('ArrowUp') ? 1 : 0) - (this.tecla('KeyS') || this.tecla('ArrowDown') ? 1 : 0); } });` }),
  },

  // ── La C y los controles ──
  {
    id: 'c-vuelve', archivo: 'main.js', que: 'la calidad vuelve a la C, que agacha',
    caeEn: 'ninguna tecla registrada es una tecla de movimiento',
    reemplazo: [/entrada\.registrar\((['"])F2\1/, "entrada.registrar('KeyC'"],
  },
  {
    id: 'tabla-sin-z', archivo: 'ui/Opciones.js', que: 'la tabla de controles no nombra Z',
    caeEn: 'la tabla nombra Z para andar solo',
    reemplazo: [/\[\s*(['"])Z\1[^\]]*\],?\s*/, ''],
  },
  {
    id: 'tabla-sin-h', archivo: 'ui/Opciones.js', que: 'la tabla de controles se olvida la H de cazar',
    caeEn: 'toda tecla registrada en main.js aparece en la tabla de controles',
    reemplazo: [/\[\s*(['"])H\1[^\]]*\],?\s*/, ''],
  },

  // ── El cartel ──
  {
    id: 'sin-parentesis', archivo: 'systems/Recoleccion.js', que: 'el cartel vuelve a no decir qué da',
    caeEn: 'planta maqui: la etiqueta termina en un paréntesis con el rinde',
    anexo: cartel(String.raw`r.etiqueta = String(r.etiqueta).replace(/\s*\([^()]*\)\s*$/, '');`),
  },
  {
    id: 'olvida-a-veces', archivo: 'systems/Recoleccion.js', que: 'el cartel calla lo que sale a veces: el coirón no avisa de la lana',
    caeEn: 'coirón: todo lo que entra al bolso está nombrado',
    anexo: cartel(String.raw`r.etiqueta = String(r.etiqueta).replace(/\s*·\s*a veces [^·()]+/g, '').replace(/\(\s*a veces [^·()]+·?\s*/g, '(');`),
  },
  {
    id: 'promete-arcilla-siempre', archivo: 'systems/Recoleccion.js', que: 'toda piedra promete arcilla, esté o no en la orilla',
    caeEn: 'piedra lejos del agua y abajo: acá no promete arcilla',
    anexo: cartel(String.raw`if ((r.mata && r.mata.tipo && r.mata.tipo.id === 'piedra') || /piedra/i.test(r.etiqueta)) {
    if (!/arcilla/.test(r.etiqueta)) r.etiqueta = String(r.etiqueta).replace(/\)\s*$/, ' · a veces arcilla)'); }`),
  },
  {
    id: 'numero-inflado', archivo: 'systems/Recoleccion.js', que: 'el cartel promete una unidad más de lo que da',
    caeEn: 'helecho: fibra cae siempre entre lo prometido',
    anexo: cartel(String.raw`r.etiqueta = String(r.etiqueta).replace(/\((\d+)(\s*×)/, (m, n, x) => '(' + (Number(n) + 1) + x);`),
  },
  {
    id: 'rango-ancho', archivo: 'systems/Recoleccion.js', que: 'el cartel estira el rango: promete hasta dos más de lo que puede salir',
    caeEn: 'llega a los dos extremos que promete',
    anexo: cartel(String.raw`r.etiqueta = String(r.etiqueta).replace(/(\d+)\s*([–-])\s*(\d+)/, (m, a, g, b) => a + g + (Number(b) + 2));`),
  },
  {
    id: 'parpadea', archivo: 'systems/Recoleccion.js', que: 'el cartel cambia con el azar y parpadea cada medio segundo',
    caeEn: 'el cartel no cambia con el azar',
    anexo: cartel(String.raw`if (Math.random() < 0.5) r.etiqueta = String(r.etiqueta).replace(/^(\S+)/, (m) => m + ' ya');`),
  },
  {
    id: 'o-r-adentro', archivo: 'systems/Recoleccion.js', que: 'la etiqueta vuelve a traer «(o R)» adentro',
    caeEn: 'la etiqueta ya no trae «(o',
    anexo: cartel(String.raw`if (r.tecla) r.etiqueta = String(r.etiqueta) + ' (o ' + r.tecla + ')';`),
  },
  {
    id: 'doble-barrido', archivo: 'systems/Recoleccion.js', que: 'armar el cartel recorre los lotes del sotobosque otra vez',
    caeEn: 'quePuedoHacer lee los lotes y la vegetación una vez como mucho',
    anexo: cartel(String.raw`void (this.sotobosque && this.sotobosque.lotes);`),
  },
  {
    id: 'taique-promete', archivo: 'systems/Recoleccion.js', que: 'una planta que no da nada promete frutos',
    caeEn: 'no promete nada si no da nada',
    anexo: cartel(String.raw`if (r.tipo === 'planta' && r.planta && r.planta.esp && r.planta.esp.id === 'taique')
    r.etiqueta = String(r.etiqueta).replace(/\s*\([^()]*\)\s*$/, '') + ' (1 × frutos)';`),
  },
  {
    id: 'actuar-da-de-mas', archivo: 'systems/Recoleccion.js', que: 'la tecla da una piedra más de lo que dice el cartel',
    caeEn: 'piedra lejos del agua y abajo: piedra cae siempre entre lo prometido',
    anexo: actuar(String.raw`if (acc && acc.tipo === 'sotobosque' && /piedra/i.test(acc.etiqueta)) this.inventario.agregar('piedra', 1);`),
  },
  {
    id: 'arcilla-escondida', archivo: 'systems/Recoleccion.js', que: 'la piedra lejos del agua da arcilla sin que el cartel lo diga',
    caeEn: 'piedra lejos del agua y abajo: todo lo que entra al bolso está nombrado',
    anexo: actuar(String.raw`if (acc && acc.tipo === 'sotobosque' && /piedra/i.test(acc.etiqueta) && !/arcilla/.test(acc.etiqueta) && Math.random() < 0.45) this.inventario.agregar('arcilla', 2);`),
  },

  // ── La tecla en su lugar ──
  {
    id: 'hud-replace-viejo', archivo: 'ui/HUD.js', que: 'mostrarAccion vuelve a marcar la primera R que aparezca',
    caeEn: 'una R mayúscula en el rinde no se marca',
    anexo: String.raw`
HUD.prototype.mostrarAccion = function (accion) {
  if (!accion) { this.elAccion.classList.remove('visible'); return; }
  const tecla = accion.tecla || 'E';
  this.elAccion.innerHTML = accion.tecla
    ? accion.etiqueta.replace(tecla, '<b>' + tecla + '</b>')
    : '<b>E</b> · ' + accion.etiqueta;
  this.elAccion.classList.add('visible');
};
`,
  },
  {
    id: 'hud-sin-e', archivo: 'ui/HUD.js', que: 'con tecla propia el cartel deja de nombrar la E, que también funciona',
    caeEn: 'con tecla propia también empieza con E',
    anexo: String.raw`
const __mostrar = HUD.prototype.mostrarAccion;
HUD.prototype.mostrarAccion = function (a) {
  __mostrar.call(this, a);
  if (a && a.tecla) this.elAccion.innerHTML = String(this.elAccion.innerHTML).replace(/^<b>E<\/b>\s*·\s*/, '');
};
`,
  },
  {
    id: 'hud-sin-indicador', archivo: 'ui/HUD.js', que: 'el HUD no dibuja nada para el andar solo',
    caeEn: 'HUD.js dibuja algo para la clase auto-andar',
    reemplazo: [/auto-andar/g, 'auto-xndar'],
  },
];

/** Cambios legítimos: el banco tiene que quedar VERDE con ellos puestos. */
const CONTROLES = [
  {
    id: 'rinde-en-la-fuente', que: 'el helecho y la piedra pasan a dar 3 en COSECHA_SOTOBOSQUE',
    archivo: 'systems/Recursos.js',
    anexo: '\nCOSECHA_SOTOBOSQUE.helecho[0].cantidad = 3;\nCOSECHA_SOTOBOSQUE.piedra[0].cantidad = 3;\n',
  },
  {
    id: 'rinde-en-el-dataset', que: 'trozar con hacha pasa a dar 4 rollizos en herramientas.json',
    archivo: 'data/herramientas.json',
    json: (d) => { d.acciones.find((a) => a.id === 'trozar').conHerramienta.rinde[0].cantidad = 4; },
  },
];

function copiarSrc(dest) {
  fs.rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  fs.cpSync(SRC, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), '{ "type": "module" }\n');
}

function correrBanco(src) {
  const r = spawnSync(process.execPath, [BANCO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env, BANCO_SRC: src, BANCO_JSON: '1', BANCO_SIN_BUILD: '1', BANCO_DETALLE: '',
      BANCO_SECCIONES: 'andarSolo,controles,cartel,teclaEnSuLugar',
    },
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

/** Planta un defecto en la copia. Devuelve un motivo si no se pudo. */
function plantar(dest, d) {
  const archivo = path.join(dest, ...d.archivo.split('/'));
  if (!fs.existsSync(archivo)) return `no existe ${d.archivo}`;
  let txt = fs.readFileSync(archivo, 'utf8');
  if (d.archivo === 'engine/Entrada.js' && !/export\s+class\s+Entrada\b/.test(txt)) return 'Entrada no es una clase exportada: no se puede subclasear';
  if (d.archivo === 'ui/HUD.js' && d.anexo && !/export\s+class\s+HUD\b/.test(txt)) return 'HUD no es una clase exportada';
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
console.log(`\n  FALSADOR R7 · FASE 1   (copias en ${path.relative(RAIZ, TMP)})\n`);
console.log('  nota: las secciones 5 y 6 (regresión y build) corren contra src/ de verdad y se');
console.log('        saltean con BANCO_SRC, así que el falsador no las mide.\n');

const limpio = path.join(TMP, 'limpio');
copiarSrc(limpio);
const base = correrBanco(limpio);
if (base.error) { console.log(`  El banco no corrió sobre la copia limpia:\n${base.error}\n`); process.exit(1); }
const baseMapa = aplanar(base.secciones);
const rojasBase = [...baseMapa].filter(([, ok]) => !ok).map(([k]) => k);
if (rojasBase.length) {
  console.log(`  ROJO  la base ya tiene ${rojasBase.length} aserciones caídas; el falsador no puede`);
  console.log('        distinguir su defecto de lo que ya estaba mal. Arreglar primero:');
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
  if (motivo) {
    console.log(`  NO SE PUDO PLANTAR  ${d.id.padEnd(24)} ${motivo}`);
    cuenta.sin++; continue;
  }
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

console.log('\n  controles al revés — cambios legítimos que el banco tiene que dejar pasar:\n');
let controlesMal = 0;
for (const c of CONTROLES) {
  if (solo && c.id !== solo) continue;
  const dest = path.join(TMP, c.id);
  copiarSrc(dest);
  const motivo = plantar(dest, c);
  if (motivo) { console.log(`  NO SE PUDO PLANTAR  ${c.id.padEnd(24)} ${motivo}`); controlesMal++; continue; }
  const r = correrBanco(dest);
  if (r.error) { console.log(`  NO CORRIÓ           ${c.id.padEnd(24)} ${r.error.split('\n').slice(-3).join(' / ')}`); controlesMal++; continue; }
  const caidas = [...aplanar(r.secciones)].filter(([k, ok]) => !ok && baseMapa.get(k) === true).map(([k]) => k);
  if (!caidas.length) {
    console.log(`  BIEN, QUEDÓ VERDE   ${c.id.padEnd(24)} ${c.que}`);
  } else {
    controlesMal++;
    console.log(`  SE PUSO ROJO        ${c.id.padEnd(24)} ${c.que}`);
    console.log(`                      el cartel no sigue a la fuente: ${caidas.slice(0, 3).join(' · ')}`);
  }
}

const total = cuenta.vio + cuenta.otro + cuenta.no + cuenta.sin;
console.log(`\n  ${cuenta.no === 0 ? 'VERDE' : 'ROJO '}  lo vio ${cuenta.vio}/${total}` +
  `  ·  por otro motivo ${cuenta.otro}  ·  NO lo vio ${cuenta.no}  ·  no se pudo plantar ${cuenta.sin}` +
  `  ·  controles al revés mal ${controlesMal}\n`);
if (cuenta.no === 0 && cuenta.otro === 0 && cuenta.sin === 0 && controlesMal === 0)
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { console.log(`  (no se pudieron borrar las copias de ${TMP}; no importa)`); }
else console.log(`  las copias quedan en ${path.relative(RAIZ, TMP)} para mirarlas\n`);
process.exitCode = cuenta.no === 0 && controlesMal === 0 ? 0 : 1;
