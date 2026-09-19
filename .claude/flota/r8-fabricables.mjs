/**
 * Ronda 8 · qué objetos se pueden fabricar con un bolso lleno de todo, sin ninguna
 * tecnología y con todas. Es la base de «ningún objeto queda peor» de la fase 5.
 *
 * Uso: node .claude/flota/r8-fabricables.mjs [src]   → JSON { sinSaber: [...], conTodo: [...] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SRC = path.resolve(process.argv[2] || path.join(RAIZ, 'src'));
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const imp = (p) => import(pathToFileURL(path.join(SRC, p)).href);

export async function fabricables(src = SRC) {
  const cargar = (p) => import(pathToFileURL(path.join(src, p)).href);
  const H = JSON.parse(fs.readFileSync(path.join(src, 'data', 'herramientas.json'), 'utf8'));
  const HI = JSON.parse(fs.readFileSync(path.join(src, 'data', 'historia.json'), 'utf8'));
  const { Inventario } = await cargar('systems/Inventario.js');
  const { Equipo } = await cargar('systems/Equipo.js');
  const { Saberes } = await cargar('systems/Saberes.js');
  const { Fabricacion } = await cargar('systems/Fabricacion.js');
  const recursos = new Set();
  for (const o of H.objetos || []) for (const m of o.materiales || []) recursos.add(m.recurso);
  for (const t of HI.tecnologias || []) for (const m of t.materiales || []) recursos.add(m.recurso);
  const res = {};
  for (const modo of ['sinSaber', 'conTodo']) {
    const inventario = new Inventario(100000);
    for (const r of recursos) inventario.agregar?.(r, 60) ?? inventario.meter?.(r, 60);
    const equipo = new Equipo(H, { inventario });
    const saberes = new Saberes(HI, inventario);
    if (modo === 'conTodo') for (const t of HI.tecnologias || []) saberes.desbloqueadas.add(t.id);
    // Todas las herramientas que alguna receta pide, en el bolso: se mide la receta, no la herramienta
    for (const o of H.objetos || []) for (const id of [].concat(o.pideHerramienta || [])) equipo.guardar?.(id);
    const fundicion = { hornos: [], cercano: () => null, arde: () => true, usaFuego: () => false, hornoPorId: () => null, definicionesHorno: [], jugador: { posicion: { x: 0, y: 0, z: 0 } } };
    const fab = new Fabricacion(H, { inventario, saberes, equipo, fundicion, hud: { aviso() {} } });
    res[modo] = fab.catalogo.filter((o) => (o.donde || 'bolso') === 'bolso').filter((o) => {
      const e = fab.estado(o).estado;
      return e === 'lista' || e === 'no_entra';
    }).map((o) => o.id).sort();
  }
  return res;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await fabricables()));
}
