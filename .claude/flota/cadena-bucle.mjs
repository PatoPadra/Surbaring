/**
 * Medidor de la cadena del metal — herramienta de la flota, agente `bucle`.
 *
 * Resuelve hacia atrás desde «1 herramienta de hierro» sobre los datos reales de
 * `src/data/mineria.json` y `src/data/construccion.json`, y cuenta tres cosas:
 * horas de mundo, materiales de recolección, y cuántas hornadas hay que esperar.
 *
 * Corre con: node .claude/flota/cadena-bucle.mjs
 */
import fs from 'node:fs';

const min = JSON.parse(fs.readFileSync('src/data/mineria.json', 'utf8'));
const con = JSON.parse(fs.readFileSync('src/data/construccion.json', 'utf8'));
const his = JSON.parse(fs.readFileSync('src/data/historia.json', 'utf8'));
const tecs = his.tecnologias || [];

/** La tecnología que habilita una receta o un horno, si alguna la pide. */
function tecDeReceta(id) {
  return tecs.find(t => Array.isArray(t.efecto?.recetas) && t.efecto.recetas.includes(id));
}
function tecDeHorno(id) { return tecs.find(t => t.efecto?.horno === id); }

const recetas = [
  ...(min.recetas || []),
  ...(con.recetas || []).map(r => ({ ...r, horno: r.obra })),
];
const hornos = min.hornos || [];
const obras = con.obras || [];

/** Lo que se junta caminando: no tiene receta. */
const DEL_SUELO = new Set(['lena', 'piedra', 'arcilla', 'chatarra', 'madera', 'madera_dura',
  'madera_blanda', 'arena', 'ripio', 'tosca', 'pomez', 'fibra', 'corteza', 'agua', 'yesca',
  'pinocha', 'resina', 'cana', 'fruto', 'semilla', 'junco', 'hongo', 'obsidiana', 'tronco',
  'cuero', 'tendon', 'grasa', 'asta', 'carne', 'lana', 'pescado']);

function recetaDe(id) { return recetas.find(r => (r.sale || []).some(s => s.recurso === id)); }
function hornoDe(id) { return hornos.find(h => h.id === id) || obras.find(o => o.id === id); }

/**
 * Anota un pedido en la demanda pendiente. NO lo expande en el acto: si lo
 * hiciera, cada consumidor de carbón levantaría su propia carbonera y la cuenta
 * saldría al doble. El carbón se junta en una pila, no en tres.
 */
function resolver(recurso, cantidad, acc) {
  if (DEL_SUELO.has(recurso) || !recetaDe(recurso)) {
    acc.suelo[recurso] = (acc.suelo[recurso] || 0) + cantidad;
    return;
  }
  acc.pendiente[recurso] = (acc.pendiente[recurso] || 0) + cantidad;
}

/**
 * Expande UNA hornada, ya con toda la demanda de ese material acumulada. Se
 * elige siempre el material más profundo primero, así cuando le toca al carbón
 * ya están anotados todos los que lo piden.
 */
function expandir(recurso, acc) {
  const cantidad = acc.pendiente[recurso];
  delete acc.pendiente[recurso];
  const r = recetaDe(recurso);
  const porTanda = (r.sale.find(s => s.recurso === recurso) || {}).cantidad || 1;
  const tandas = Math.ceil(cantidad / porTanda);
  acc.horas += tandas * (r.horas || 0);
  acc.hornadas.push(`${tandas}× ${r.nombre} (${r.horas} h c/u) → ${tandas * porTanda} ${recurso}`);
  if (!acc.hornosNecesarios.has(r.horno)) {
    acc.hornosNecesarios.add(r.horno);
    const h = hornoDe(r.horno);
    for (const m of (h?.materiales || [])) resolver(m.recurso, m.cantidad, acc);
    aprender(tecDeHorno(r.horno), acc);
  }
  // La receta misma puede estar detrás de una tecnología, y esa tecnología
  // CONSUME materiales: es el tramo que faltaba contar y el que manda.
  aprender(tecDeReceta(r.id), acc);
  for (const m of (r.entra || [])) resolver(m.recurso, m.cantidad * tandas, acc);
}

/** Profundidad de un material en el árbol: cuántas hornadas hay debajo. */
const profCache = new Map();
function profundidad(id, visto = new Set()) {
  if (profCache.has(id)) return profCache.get(id);
  if (visto.has(id)) return 0;
  visto.add(id);
  const r = recetaDe(id);
  if (!r || DEL_SUELO.has(id)) return 0;
  let p = 1;
  for (const m of r.entra || []) p = Math.max(p, 1 + profundidad(m.recurso, visto));
  profCache.set(id, p);
  return p;
}

/** Aprender una tecnología cuesta materiales y puntos de saber. */
function aprender(tec, acc) {
  if (!tec || acc.tecnologias.has(tec.id)) return;
  acc.tecnologias.add(tec.id);
  acc.saber += tec.costoSaber || 0;
  for (const r of tec.requiere || []) aprender(tecs.find(t => t.id === r), acc);
  for (const m of tec.materiales || []) resolver(m.recurso, m.cantidad, acc);
}

function medir(recurso, cantidad = 1) {
  const acc = {
    horas: 0, saber: 0, suelo: {}, hornadas: [], pendiente: {},
    hornosNecesarios: new Set(), tecnologias: new Set(),
  };
  resolver(recurso, cantidad, acc);
  let vueltas = 0;
  while (Object.keys(acc.pendiente).length && vueltas++ < 200) {
    // el más profundo primero: así el carbón se expande recién cuando ya lo
    // pidieron la herrería, el reforjado y la herramienta
    const sig = Object.keys(acc.pendiente)
      .sort((a, b) => profundidad(b) - profundidad(a))[0];
    expandir(sig, acc);
  }
  return acc;
}

const objetivo = process.argv[2] || 'herramienta';
const cuantos = Number(process.argv[3] || 1);
const a = medir(objetivo, cuantos);

console.log(`\n=== ${cuantos} × ${objetivo} ===`);
console.log('Horas de mundo:', a.horas.toFixed(1));
console.log('Puntos de saber:', a.saber);
console.log('Tecnologías a aprender:', [...a.tecnologias].join(', ') || '—');
console.log('Hornos/obras a levantar:', [...a.hornosNecesarios].join(', ') || '—');
console.log('Hornadas:');
for (const h of a.hornadas) console.log('  ·', h);
console.log('Material de recolección:');
for (const [k, v] of Object.entries(a.suelo).sort((x, y) => y[1] - x[1])) {
  console.log(`  · ${k}: ${v}`);
}
const totalSuelo = Object.values(a.suelo).reduce((s, v) => s + v, 0);
console.log('Total de unidades juntadas:', totalSuelo);
