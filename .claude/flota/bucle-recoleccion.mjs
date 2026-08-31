/**
 * Banco de pruebas de la tecla de recolección — agente `bucle`.
 *
 * Reproduce la densidad medida del sotobosque en el punto de partida (alt 822 m,
 * humedad 0,51) y pregunta qué haría la tecla de acción con el jugador parado
 * encima de un tronco caído, de un resto de carroña y de una celda con chatarra.
 *
 * Corre con: node .claude/flota/bucle-recoleccion.mjs
 */
import { Recoleccion } from '../../src/systems/Recoleccion.js';

const TAM = 16;
// Instancias por celda de 16 m medidas con la fórmula de aptitud del propio
// Sotobosque.js en el spawn, con pendiente 10°.
const PORCELDA = {
  coiron: 205.85, pasto_humedo: 65.28, helecho: 8.47, michay: 8.68,
  piedra: 3.98, carronia: 0.05, tronco: 0.13,
};
const NOMBRES = {
  coiron: 'Coirón', pasto_humedo: 'Pastizal húmedo', helecho: 'Helecho',
  michay: 'Michay', piedra: 'Piedra suelta', carronia: 'Restos de un animal',
  tronco: 'Tronco caído',
};

/** Azar determinista, para que el banco dé siempre lo mismo. */
let sem = 12345;
const azar = () => (sem = (sem * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/** Siembra un cuadrado de `lado` metros centrado en el origen. */
function sembrar(lado) {
  const lotes = [];
  const celdas = (lado / TAM) ** 2;
  for (const [id, porCelda] of Object.entries(PORCELDA)) {
    const n = Math.max(0, Math.round(porCelda * celdas));
    const arr = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      arr[i * 16 + 12] = (azar() - 0.5) * lado;
      arr[i * 16 + 13] = 822;
      arr[i * 16 + 14] = (azar() - 0.5) * lado;
    }
    lotes.push({ tipo: { id, nombre: NOMBRES[id] }, n, malla: { instanceMatrix: { array: arr } } });
  }
  return lotes;
}

/** Pone una instancia exactamente a `d` metros del jugador. */
function plantar(lotes, id, d) {
  const l = lotes.find(x => x.tipo.id === id);
  const a = l.malla.instanceMatrix.array;
  a[l.n * 16 + 12] = d; a[l.n * 16 + 13] = 822; a[l.n * 16 + 14] = 0;
  l.n++;
  return l;
}

function banco({ conTronco = false, conCarronia = false, conChatarra = false } = {}) {
  const lotes = sembrar(240);
  // margen para las instancias que agregamos a mano
  for (const l of lotes) {
    const a = new Float32Array((l.n + 4) * 16);
    a.set(l.malla.instanceMatrix.array);
    l.malla.instanceMatrix.array = a;
  }
  if (conTronco) plantar(lotes, 'tronco', 1.7);
  if (conCarronia) plantar(lotes, 'carronia', 2.0);

  const r = new Recoleccion({
    mundo: { esAgua: () => false, cauceEn: () => 0 },
    jugador: { posicion: { x: 0, y: 822, z: 0 }, enAgua: false },
    vegetacion: { masCercana: () => null },
    sotobosque: { lotes },
    fauna: { masCercano: () => null },
    inventario: { agregar: () => 1, pesoKg: 0, listar: () => [] },
    saberes: { otorgar() {} },
    codice: { identificadas: new Set() },
    hud: { aviso() {} },
  });
  r.mineria = {
    hayChatarra: () => conChatarra,
    yacimientoEn: () => null,
  };
  return r.quePuedoHacer(1000);
}

const casos = [
  ['Parado sobre un TRONCO CAÍDO', { conTronco: true }],
  ['Parado sobre CARROÑA', { conCarronia: true }],
  ['Parado sobre una celda con CHATARRA', { conChatarra: true }],
  ['Parado sobre CHATARRA y un TRONCO', { conChatarra: true, conTronco: true }],
  ['En pasto pelado (sin nada especial)', {}],
];

let fallas = 0;
const espera = {
  'Parado sobre un TRONCO CAÍDO': 'sotobosque/Tronco caído',
  'Parado sobre CARROÑA': 'carronia',
  'Parado sobre una celda con CHATARRA': 'chatarra',
  'Parado sobre CHATARRA y un TRONCO': 'sotobosque/Tronco caído',
  'En pasto pelado (sin nada especial)': 'sotobosque/Piedra suelta',
};

console.log('\n=== Qué hace la tecla de acción ===\n');
for (const [nombre, opts] of casos) {
  const a = banco(opts);
  const dio = a?.tipo === 'sotobosque' ? `sotobosque/${a.mata.tipo.nombre}` : (a?.tipo || 'nada');
  const ok = dio === espera[nombre];
  if (!ok) fallas++;
  console.log(`${ok ? 'OK  ' : 'MAL '} ${nombre.padEnd(38)} → ${dio.padEnd(24)} (${a?.etiqueta || '—'})`);
}
console.log(fallas ? `\n${fallas} caso(s) mal.` : '\nTodo como se espera.');
process.exit(fallas ? 1 : 0);
