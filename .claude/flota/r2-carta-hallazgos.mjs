/**
 * Banco de hallazgos — ¿marcar esto es información o es pintar el mapa entero?
 *
 * Ésa es LA pregunta de diseño del sistema de marcas, y no se puede contestar
 * leyendo: `Mineria.yacimientoEn()` devuelve algo en casi todos lados, pero
 * «casi todos» no es un número. Acá se mide.
 *
 * Importa la `Mineria` y los `Limites` **de verdad** —no una copia de sus
 * reglas— y les pone debajo un mundo armado con el DEM real:
 * `alturas.r16` para el relieve, el canal B de `alturas.png` para los lagos y
 * el canal R de `rios.png` para los cauces, decodificados acá mismo con `zlib`,
 * sin dependencias.
 *
 * Dos honestidades sobre el banco:
 *
 * - No se replica `_excavarLagos()`, que hunde el lecho de los lagos y por lo
 *   tanto empina un poco la pendiente junto a la orilla. Eso hace que el banco
 *   **sobreestime la arena**, que pide `pendiente < 0,22` cerca del agua. O sea
 *   que el número real de arena es igual o menor que el que sale acá.
 * - `alturaEn` se toma sin el ruido decorativo de 1,9 m. Contra umbrales de
 *   1.450 y 1.000 m eso no mueve nada.
 *
 * Ninguna de las dos toca la comparación que importa —lo que escasea contra lo
 * que sale en todos lados—, que es de un orden de magnitud.
 *
 * Este banco ya se ganó el sueldo una vez: la pómez entró al sistema de marcas
 * por parecer un hallazgo («caída volcánica que se conserva en altura») y salió
 * al medirla, porque es el 22,8 % del parque.
 *
 *   node .claude/flota/r2-carta-hallazgos.mjs
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dem = p => join(RAIZ, 'public/data/dem/', p);

// ── PNG a píxeles crudos (color 6 = RGBA, 8 bits, sin entrelazar) ───────────

function leerPNG(ruta) {
  const b = readFileSync(ruta);
  const ancho = b.readUInt32BE(16), alto = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) {
    throw new Error(`${ruta}: se esperaba RGBA de 8 bits sin entrelazar`);
  }
  const trozos = [];
  for (let off = 8; off < b.length;) {
    const len = b.readUInt32BE(off);
    if (b.slice(off + 4, off + 8).toString('ascii') === 'IDAT') {
      trozos.push(b.slice(off + 8, off + 8 + len));
    }
    off += 12 + len;
  }
  const crudo = inflateSync(Buffer.concat(trozos));

  // Deshacer los filtros por línea. Es la parte que todo el mundo se olvida:
  // un PNG sin desfiltrar se lee como ruido y parece que el dato está roto.
  const bpp = 4, linea = ancho * bpp;
  const px = Buffer.alloc(alto * linea);
  for (let j = 0; j < alto; j++) {
    const filtro = crudo[j * (linea + 1)];
    const ent = crudo.subarray(j * (linea + 1) + 1, j * (linea + 1) + 1 + linea);
    const sal = px.subarray(j * linea, (j + 1) * linea);
    const arriba = j > 0 ? px.subarray((j - 1) * linea, j * linea) : null;
    for (let i = 0; i < linea; i++) {
      const a = i >= bpp ? sal[i - bpp] : 0;
      const bb = arriba ? arriba[i] : 0;
      const c = arriba && i >= bpp ? arriba[i - bpp] : 0;
      let v = ent[i];
      switch (filtro) {
        case 1: v += a; break;
        case 2: v += bb; break;
        case 3: v += (a + bb) >> 1; break;
        case 4: {
          const p = a + bb - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
          break;
        }
      }
      sal[i] = v & 255;
    }
  }
  return { ancho, alto, px };
}

// ── El mundo, con la aritmética de src/world/Mundo.js ───────────────────────

const meta = JSON.parse(readFileSync(dem('meta.json'), 'utf8'));
const N = meta.resolucion, TAMANO = meta.tamanoM, MITAD = TAMANO / 2;
const MPT = meta.metrosPorTexel;

const buf = readFileSync(dem('alturas.r16'));
const crudo16 = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
const escala = meta.alturaMaxCodificada / 65535;
const altura = new Float32Array(N * N);
for (let k = 0; k < N * N; k++) altura[k] = crudo16[k] * escala;

const pngA = leerPNG(dem('alturas.png'));
const pngR = leerPNG(dem('rios.png'));
const agua = new Uint8Array(N * N), cauce = new Uint8Array(N * N);
for (let k = 0; k < N * N; k++) {
  agua[k] = pngA.px[k * 4 + 2];     // canal B
  cauce[k] = pngR.px[k * 4];        // gris en R
}

const pendiente = new Float32Array(N * N);
for (let j = 0; j < N; j++) {
  const jm = j > 0 ? j - 1 : 0, jp = j < N - 1 ? j + 1 : N - 1;
  for (let i = 0; i < N; i++) {
    const im = i > 0 ? i - 1 : 0, ip = i < N - 1 ? i + 1 : N - 1;
    const dx = (altura[j * N + ip] - altura[j * N + im]) / ((ip - im) * MPT);
    const dz = (altura[jp * N + i] - altura[jm * N + i]) / ((jp - jm) * MPT);
    pendiente[j * N + i] = Math.atan(Math.hypot(dx, dz));
  }
}

const dentro = (x, z) => x >= -MITAD && x <= MITAD && z >= -MITAD && z <= MITAD;
const texelDe = w => Math.max(0, Math.min(N - 1, (w / TAMANO + 0.5) * N - 0.5));
const indiceDe = (x, z) => {
  if (!dentro(x, z)) return -1;
  const i = Math.min(N - 1, Math.max(0, Math.round(texelDe(x))));
  const j = Math.min(N - 1, Math.max(0, Math.round(texelDe(z))));
  return j * N + i;
};

const mundo = {
  tamano: TAMANO, mitad: MITAD, metrosPorTexel: MPT,
  dentro,
  alturaEn(x, z) {
    if (!dentro(x, z)) return meta.elevacionMin;
    const fx = texelDe(x), fz = texelDe(z);
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(N - 1, i0 + 1), j1 = Math.min(N - 1, j0 + 1);
    const sx = fx - i0, sz = fz - j0;
    const a = altura[j0 * N + i0], b = altura[j0 * N + i1];
    const c = altura[j1 * N + i0], d = altura[j1 * N + i1];
    return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
  },
  pendienteEn(x, z) { const k = indiceDe(x, z); return k < 0 ? 0 : pendiente[k]; },
  esAgua(x, z) { const k = indiceDe(x, z); return k >= 0 && agua[k] > 127; },
  cauceEn(x, z) { const k = indiceDe(x, z); return k < 0 ? 0 : cauce[k] / 255; },
  aLatLon(x, z) {
    return {
      lat: meta.centro.lat - z / 111320,
      lon: meta.centro.lon + x / (111320 * Math.cos(meta.centro.lat * Math.PI / 180)),
    };
  },
};

const { Mineria } = await import('../../src/systems/Mineria.js');
const { Limites } = await import('../../src/world/Limites.js');
const limites = new Limites(mundo);
const mineria = new Mineria({}, { mundo, limites, inventario: { disponiblePara: () => 0 } });

// ── 1. Cuánto del parque marcaría cada tipo ────────────────────────────────

const PASO = 128;                       // la celda de Hallazgos
const LADO_C = Math.round(TAMANO / PASO);
console.log(`\nBarriendo el parque entero en celdas de ${PASO} m: ${LADO_C}×${LADO_C} = ${(LADO_C * LADO_C).toLocaleString('es-AR')} celdas\n`);

const cuenta = { arena: 0, pomez: 0, ripio: 0, tosca: 0, nada: 0, chatarra: 0, agua: 0, jur: {} };
for (let j = 0; j < LADO_C; j++) {
  for (let i = 0; i < LADO_C; i++) {
    const x = -MITAD + (i + 0.5) * PASO, z = -MITAD + (j + 0.5) * PASO;
    if (mundo.esAgua(x, z)) { cuenta.agua++; continue; }
    const y = mineria.yacimientoEn(x, z);
    cuenta[y ? y.id : 'nada']++;
    if (mineria.hayChatarra(x, z)) cuenta.chatarra++;
    const jj = limites.jurisdiccion(x, z);
    cuenta.jur[jj] = (cuenta.jur[jj] || 0) + 1;
  }
}
const tierra = LADO_C * LADO_C - cuenta.agua;
const pct = n => (n / tierra * 100).toFixed(1).padStart(5) + ' %';

console.log(`  Celdas de tierra: ${tierra.toLocaleString('es-AR')} (${cuenta.agua.toLocaleString('es-AR')} son lago)`);
console.log(`  Jurisdicción: ${Object.entries(cuenta.jur).map(([k, v]) => `${k} ${(v / (tierra + cuenta.agua) * 100).toFixed(0)} %`).join(' · ')}\n`);
console.log('  Lo que devuelve yacimientoEn(), sobre celdas de tierra:');
console.log(`    ripio      ${pct(cuenta.ripio)}   ← cajón de fondo de valle`);
console.log(`    tosca      ${pct(cuenta.tosca)}   ← cajón de sastre (pendiente < 0,30)`);
console.log(`    arena      ${pct(cuenta.arena)}`);
console.log(`    pómez      ${pct(cuenta.pomez)}`);
console.log(`    nada       ${pct(cuenta.nada)}`);
console.log(`\n  hayChatarra():`);
console.log(`    chatarra   ${pct(cuenta.chatarra)}`);

const marcado = cuenta.arena + cuenta.chatarra;
const todo = cuenta.arena + cuenta.pomez + cuenta.chatarra + cuenta.ripio + cuenta.tosca;
console.log(`\n  ► Marcando SÓLO arena y chatarra —lo que quedó—: ${pct(marcado)} del parque.`);
console.log(`     La pómez salió del sistema por este mismo barrido: ${pct(cuenta.pomez)} no es un`);
console.log(`     hallazgo, es lo que da la altura. Misma clase que el ripio y la tosca.`);
console.log(`  ► Marcando todo lo que devuelve yacimientoEn: ${pct(todo)} del parque.`);
console.log(`     Es ${(todo / marcado).toFixed(1)}× más, y a esa densidad el mapa deja de decir nada.`);

// ── 2. Cuántas marcas junta un jugador de verdad ───────────────────────────
//
// Un barrido del parque entero no es lo que ve nadie. Lo que importa es cuántas
// marcas junta quien camina, que es contra lo que se lee el mapa.

console.log('\n\nUna caminata de verdad: 30 km desde el centro del mapa, en zigzag\n');

const celdasVistas = new Map();
const BITS = { arena: 1, chatarra: 4 };
const anotar = (x, z, tipo) => {
  const i = Math.floor((x + MITAD) / PASO), j = Math.floor((z + MITAD) / PASO);
  if (i < 0 || j < 0 || i >= LADO_C || j >= LADO_C) return;
  const k = j * LADO_C + i;
  celdasVistas.set(k, (celdasVistas.get(k) || 0) | BITS[tipo]);
};

let px = 0, pz = 6000, rumbo = 0.7, recorrido = 0, ultima = -1;
const PASO_M = 3.4 * 0.5;              // 3,4 m/s durante medio segundo
const halo = [[90, 0], [-90, 0], [0, 90], [0, -90], [0, 0]];
while (recorrido < 30000) {
  rumbo += (Math.sin(recorrido / 900) + Math.sin(recorrido / 311)) * 0.05;
  px += Math.cos(rumbo) * PASO_M; pz += Math.sin(rumbo) * PASO_M;
  recorrido += PASO_M;
  if (!dentro(px, pz)) { rumbo += Math.PI; continue; }

  const i = Math.floor((px + MITAD) / PASO), j = Math.floor((pz + MITAD) / PASO);
  const k = j * LADO_C + i;
  if (k === ultima) continue;          // sólo al cambiar de celda, como el sistema
  ultima = k;

  for (const [dx, dz] of halo) {
    const x = px + dx, z = pz + dz;
    if (!dentro(x, z) || mundo.esAgua(x, z)) continue;
    const y = mineria.yacimientoEn(x, z);
    if (y && y.id === 'arena') anotar(x, z, 'arena');
    if (mineria.hayChatarra(x, z)) anotar(x, z, 'chatarra');
  }
}

const porTipo = { arena: 0, chatarra: 0 };
for (const m of celdasVistas.values()) {
  for (const [t, b] of Object.entries(BITS)) if (m & b) porTipo[t]++;
}
console.log(`  Celdas con alguna marca: ${celdasVistas.size}`);
console.log(`  Por tipo: arena ${porTipo.arena} · chatarra ${porTipo.chatarra}`);
console.log(`  Densidad: una marca cada ${(30000 / Math.max(1, celdasVistas.size)).toFixed(0)} m caminados`);

const bytes = JSON.stringify({ v: 1, lado: LADO_C, h: [...celdasVistas].flat() }).length;
console.log(`  En almacenamiento: ${(bytes / 1024).toFixed(1)} KB tras 30 km`);

// ── 3. El sistema de verdad: memoria, persistencia y dibujo ────────────────

console.log('\n\nEl módulo Hallazgos, contra el mundo de este mismo banco\n');

const guardado = new Map();
globalThis.localStorage = {
  getItem: k => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, v),
  removeItem: k => guardado.delete(k),
};

const { Hallazgos, TIPOS } = await import('../../src/systems/Hallazgos.js');

let fallos = 0;
const ok = (c, t, e = '') => { console.log(`  ${c ? '✓' : '✗'} ${t} ${e}`); if (!c) fallos++; };

ok(!('pomez' in TIPOS), 'la pómez ya no es un tipo marcable',
  `(quedan: ${Object.keys(TIPOS).join(', ')})`);

const h = new Hallazgos({ mundo, mineria });
ok(h.cantidad === 0, 'arranca sin nada anotado');

// Caminata: la misma de arriba, pero por el sistema real
let hx = 0, hz = 6000, hr = 0.7, hrec = 0;
while (hrec < 30000) {
  hr += (Math.sin(hrec / 900) + Math.sin(hrec / 311)) * 0.05;
  hx += Math.cos(hr) * PASO_M; hz += Math.sin(hr) * PASO_M;
  hrec += PASO_M;
  if (!dentro(hx, hz)) { hr += Math.PI; continue; }
  h.revisar({ x: hx, y: 900, z: hz }, { horaDecimal: 13, densidadNiebla: 0.00003 }, 0.5);
}
ok(h.cantidad > 0, 'la caminata dejó marcas', `(${h.cantidad} celdas)`);
ok(h._sucio, 'queda marcado como sin guardar');

// De noche no se descubre el halo
const hn = new Hallazgos({ mundo, mineria });
const hd = new Hallazgos({ mundo, mineria });
const rutaN = [];
let nx = 0, nz = 6000, nr = 0.7;
for (let s = 0; s < 4000; s++) {
  nr += Math.sin(s / 90) * 0.05;
  nx += Math.cos(nr) * PASO_M; nz += Math.sin(nr) * PASO_M;
  rutaN.push({ x: nx, y: 900, z: nz });
}
for (const p of rutaN) hn.revisar(p, { horaDecimal: 2, densidadNiebla: 0.00003 }, 0.5);
for (const p of rutaN) hd.revisar(p, { horaDecimal: 13, densidadNiebla: 0.00003 }, 0.5);
ok(hn.cantidad < hd.cantidad, 'de noche se descubre menos que de día',
  `(${hn.cantidad} contra ${hd.cantidad})`);
ok(hn.cantidad > 0, 'pero lo que se pisa se anota igual', `(${hn.cantidad})`);

// Persistencia
h.guardar();
ok(!h._sucio, 'guardar limpia la marca');
const h2 = new Hallazgos({ mundo, mineria });
let iguales = h2.cantidad === h.cantidad;
for (const [k, m] of h.celdas) if (h2.celdas.get(k) !== m) { iguales = false; break; }
ok(iguales, 'vuelve idéntico del almacenamiento', `(${h2.cantidad} celdas)`);
console.log(`     ocupa ${(guardado.get('survibar.hallazgos.v1').length / 1024).toFixed(1)} KB`);

// Un guardado de otro tamaño de mundo no se lee: mejor vacío que corrido
guardado.set('survibar.hallazgos.v1', JSON.stringify({ v: 1, lado: 999, h: [1, 1] }));
const h3 = new Hallazgos({ mundo, mineria });
ok(h3.cantidad === 0, 'un guardado de otro mundo se descarta en vez de dibujar marcas corridas');

// El dibujo: un lienzo de mentira que anota lo que se le pide
function lienzoFalso() {
  const r = { trazos: 0, textos: 0, fuera: 0, dichos: [] };
  const marcar = (x, y) => { if (x < -60 || y < -60 || x > 700 || y > 700) r.fuera++; };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, rect() {},
    stroke() { r.trazos++; },
    moveTo: marcar, lineTo: marcar,
    arc(x, y) { marcar(x, y); },
    fillText(t, x, y) { r.textos++; r.dichos.push(t); marcar(x, y); },
    strokeText(t, x, y) { marcar(x, y); },
    set lineWidth(v) {}, set strokeStyle(v) {}, set fillStyle(v) {},
    set font(v) {}, set textBaseline(v) {}, set lineJoin(v) {}, set lineCap(v) {},
  };
  return { ctx, r };
}

// Proyección de nivel 2 (32 m/px) centrada donde caminó
const proyDe = (mpp, cx, cz) => (x, z) => ({ px: 320 + (x - cx) / mpp, py: 320 + (z - cz) / mpp });

const todoConocido = { conocimientoEn: () => 1 };
const nadaConocido = { conocimientoEn: () => 0 };
const obras = [
  { obra: { nombre: 'Refugio', categoria: 'uso_publico' }, x: 200, z: 6200 },
  { obra: { nombre: 'Vivac', categoria: 'efimera' }, x: -300, z: 5800 },
];

{
  const { ctx, r } = lienzoFalso();
  h.dibujar(ctx, proyDe(32, 0, 6000), { mpp: 32, lado: 640, exploracion: todoConocido, construccion: { obras } });
  ok(r.trazos > 0, 'dibuja algo a 32 m/px', `(${r.trazos} trazos, ${r.textos} etiquetas)`);
  ok(r.fuera === 0, 'nada se dibuja fuera del lienzo');
  ok(r.dichos.includes('Refugio') && r.dichos.includes('Vivac'),
    'las obras llevan su nombre a buen zoom', `(${r.dichos.join(', ')})`);
}
{
  const { ctx, r } = lienzoFalso();
  h.dibujar(ctx, proyDe(32, 0, 6000), { mpp: 32, lado: 640, exploracion: nadaConocido, construccion: { obras: [] } });
  ok(r.trazos === 0 && r.textos === 0,
    'sobre terreno desconocido no se dibuja NINGUNA marca',
    '(el velo no se puede burlar por atrás)');
}
{
  const { ctx, r } = lienzoFalso();
  h.dibujar(ctx, proyDe(102.4, 0, 0), { mpp: 102.4, lado: 640, exploracion: todoConocido, construccion: { obras } });
  // Ojo: acá SÍ hay texto, pero es el de la leyenda. Lo que no puede haber es
  // el nombre de una obra: a 102 m por píxel serían cuarenta rótulos encimados.
  ok(!r.dichos.includes('Refugio') && !r.dichos.includes('Vivac'),
    'al parque entero las obras no ponen etiqueta', `(sólo la leyenda: ${r.dichos.join(', ')})`);
  ok(r.fuera === 0, 'y tampoco se sale del lienzo');
}

h.olvidar();
ok(h.cantidad === 0, 'olvidar deja el cuaderno en blanco');

// OJO: hasta acá el banco NO tocó la vegetación ni el sotobosque. Lo que sigue
// es la sección que existe porque eso era un punto ciego. Ver la sección 6.
console.log(`\n  (secciones 1 a 5: sólo tipos derivados del terreno — arena y chatarra)`);

// ── 6. LA COBERTURA DEL PROPIO BANCO ───────────────────────────────────────
//
// Esta sección existe por un defecto del banco, no del código.
//
// Hasta acá todo se corría con `new Hallazgos({ mundo, mineria })` — **sin
// `vegetacion` ni `sotobosque`**. Como `Hallazgos` los consulta con
// encadenamiento opcional, no tiraba ningún error: devolvía cero en silencio. El
// banco declaraba «Todo bien» sin haber ejercitado nunca la arcilla, el cañaveral
// ni el pedrero de altura — 3 de los 5 tipos.
//
// Y el propio banco lo estaba imprimiendo: «Por tipo: arena 0 · chatarra 70».
// Un cero en una columna que debería tener números es un resultado, no un
// renglón de adorno.
//
// Es la trampa n.º 3 de ESTADO.md —«el terreno sintético no muestra todo»— pero
// con dependencias en lugar de terreno: el punto ciego no estaba en el mundo
// falso, estaba en lo que el banco no se molestó en construir.

console.log('\n\n6. Qué tipos ejercita este banco, declarado y comprobado\n');

/**
 * Un sotobosque de mentira con las densidades reales medidas por `bucle` y
 * citadas en el encabezado de `Recoleccion.js`: un coirón por m², una piedra
 * cada 64 m², michay y helecho cada 24. Se siembra en un disco alrededor del
 * punto, que es lo que hace el sembrado de verdad alrededor de la cámara.
 */
function sotobosqueFalso(centro, opciones = {}) {
  const alt = opciones.alt ?? 900;
  const radio = opciones.radio ?? 30;
  const conPiedra = opciones.conPiedra !== false;
  const DENS = { coiron: 1, michay: 1 / 24, helecho: 1 / 24, piedra: conPiedra ? 1 / 64 : 0 };
  let semilla = 12345;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };
  const lotes = [];
  for (const id of Object.keys(DENS)) {
    const n = Math.round(Math.PI * radio * radio * DENS[id]);
    const array = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * radio;
      array[i * 16 + 12] = centro.x + Math.cos(a) * r;
      array[i * 16 + 13] = alt;
      array[i * 16 + 14] = centro.z + Math.sin(a) * r;
    }
    lotes.push({ tipo: { id }, n, malla: { instanceMatrix: { array } } });
  }
  return {
    lotes,
    // La consulta que usaba `Hallazgos` antes: el más cercano de cualquier tipo.
    masCercano(pos, alcance = 5) {
      let mejor = null, mejorD = alcance;
      for (const lote of lotes) {
        const a = lote.malla.instanceMatrix.array;
        for (let i = 0; i < lote.n; i++) {
          const o = i * 16;
          const d = Math.hypot(a[o + 12] - pos.x, a[o + 14] - pos.z);
          if (d < mejorD) {
            mejorD = d;
            mejor = { tipo: lote.tipo, x: a[o + 12], y: a[o + 13], z: a[o + 14], distancia: d };
          }
        }
      }
      return mejor;
    },
  };
}

function vegetacionFalsa(centro, opciones = {}) {
  const conCana = opciones.conCana !== false;
  const radio = opciones.radio ?? 30;
  const especies = [{ tipo: 'arbol', n: 40 }, { tipo: 'arbusto', n: 25 }];
  if (conCana) especies.push({ tipo: 'cana', n: 12 });
  let semilla = 999;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };
  const lotes = especies.map(({ tipo, n }) => {
    const array = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * radio;
      array[i * 16 + 12] = centro.x + Math.cos(a) * r;
      array[i * 16 + 13] = 900;
      array[i * 16 + 14] = centro.z + Math.sin(a) * r;
    }
    return { esp: { tipo }, n, malla: { instanceMatrix: { array } } };
  });
  return {
    lotes,
    masCercana(pos, alcance = 7) {
      let mejor = null, mejorD = alcance;
      for (const lote of lotes) {
        const a = lote.malla.instanceMatrix.array;
        for (let i = 0; i < lote.n; i++) {
          const o = i * 16;
          const d = Math.hypot(a[o + 12] - pos.x, a[o + 14] - pos.z);
          if (d < mejorD) {
            mejorD = d;
            mejor = { esp: lote.esp, x: a[o + 12], y: a[o + 13], z: a[o + 14], distancia: d };
          }
        }
      }
      return mejor;
    },
  };
}

/** Un punto de tierra que cumple una condición, buscado sobre el DEM real. */
function buscarPunto(cond, desde = { x: 0, z: 0 }, salto = 96, vueltas = 300) {
  for (let r = 1; r < vueltas; r++) {
    for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2;
      const x = desde.x + Math.cos(ang) * r * salto;
      const z = desde.z + Math.sin(ang) * r * salto;
      if (dentro(x, z) && !mundo.esAgua(x, z) && cond(x, z)) return { x, z };
    }
  }
  return null;
}

const tieneBit = (h, bit) => [...h.celdas.values()].some(m => m & bit);

// Primero: la prueba de que el criterio viejo estaba muerto.
{
  const centro = { x: 0, z: 6000 };
  const sb = sotobosqueFalso(centro, { alt: 1600 });
  let piedras = 0, total = 0;
  for (let i = 0; i < 3000; i++) {
    const a = i / 3000 * Math.PI * 2, r = (i % 20) + 1;
    const m = sb.masCercano({ x: centro.x + Math.cos(a) * r, z: centro.z + Math.sin(a) * r }, 22);
    if (m) { total++; if (m.tipo.id === 'piedra') piedras++; }
  }
  const pct = piedras / total * 100;
  console.log(`  Con densidades reales, "el más cercano" es una piedra el ${pct.toFixed(1)} % de las veces`);
  ok(pct < 5, 'preguntar por el más cercano casi nunca da la piedra',
    `(${piedras} de ${total} — por eso arcilla y obsidiana no se marcaban nunca)`);
}

// Obsidiana: piedras por encima de 1.500 m
{
  const alto = buscarPunto((x, z) => mundo.alturaEn(x, z) > 1600 && mundo.pendienteEn(x, z) < 0.5);
  ok(!!alto, 'hay terreno sobre 1.600 m donde probar', alto ? `(${alto.x | 0}, ${alto.z | 0})` : '');
  const h = new Hallazgos({
    mundo, mineria,
    sotobosque: sotobosqueFalso(alto, { alt: 1650 }),
    vegetacion: vegetacionFalsa(alto, { conCana: false }),
  });
  h.revisar({ x: alto.x, y: 1650, z: alto.z }, { horaDecimal: 13, densidadNiebla: 0 }, 1);
  ok(tieneBit(h, TIPOS.obsidiana.bit), 'un pedrero de altura queda marcado');
}

// Arcilla: piedras junto a la orilla
{
  const orilla = buscarPunto((x, z) => {
    for (const [dx, dz] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) {
      if (mundo.esAgua(x + dx, z + dz)) return true;
    }
    return false;
  });
  ok(!!orilla, 'hay orilla donde probar', orilla ? `(${orilla.x | 0}, ${orilla.z | 0})` : '');
  const h = new Hallazgos({
    mundo, mineria,
    sotobosque: sotobosqueFalso(orilla, { alt: 800 }),
    vegetacion: vegetacionFalsa(orilla, { conCana: false }),
  });
  h.revisar({ x: orilla.x, y: 800, z: orilla.z }, { horaDecimal: 13, densidadNiebla: 0 }, 1);
  ok(tieneBit(h, TIPOS.arcilla.bit), 'una barranca de arcilla queda marcada');
}

// Cañaveral
{
  const llano = buscarPunto((x, z) => mundo.alturaEn(x, z) < 1000 && mundo.pendienteEn(x, z) < 0.2);
  const h = new Hallazgos({
    mundo, mineria,
    sotobosque: sotobosqueFalso(llano, { alt: 850, conPiedra: false }),
    vegetacion: vegetacionFalsa(llano, { conCana: true }),
  });
  h.revisar({ x: llano.x, y: 850, z: llano.z }, { horaDecimal: 13, densidadNiebla: 0 }, 1);
  ok(tieneBit(h, TIPOS.canaveral.bit), 'un cañaveral queda marcado');
}

// La guarda de método: el banco declara qué cubrió, y falla si quedó algo sin
// cubrir. Sin esto, agregar un tipo nuevo volvería a dar «Todo bien» sin probarlo.
{
  const cubiertos = new Set(['arena', 'chatarra', 'obsidiana', 'arcilla', 'canaveral']);
  const sinCubrir = Object.keys(TIPOS).filter(t => !cubiertos.has(t));
  ok(sinCubrir.length === 0,
    `este banco ejercita los ${Object.keys(TIPOS).length} tipos declarados en TIPOS`,
    sinCubrir.length ? `(SIN CUBRIR: ${sinCubrir.join(', ')})` : '');
}

console.log(fallos ? `\n${fallos} comprobaciones FALLARON` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
