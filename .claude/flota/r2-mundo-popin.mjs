/**
 * popin.mjs — cuántas instancias cambian de estado malla<->cartelera en un
 * cambio de celda. Constantes y funciones copiadas TAL CUAL de Vegetacion.js.
 *
 * No hay mundo (DEM, agua, humedad) así que no se filtran candidatos por
 * terreno: lo que se mide es la GEOMETRÍA del problema, que es lo que decide
 * quién cambia de estado. La densidad real se aplica después escalando al
 * conteo medido en el juego (mallasCompletas 103, impostores 4194).
 */

const TAM_CELDA = 96;
const RADIO_CELDAS = 13;
const DIST_IMPOSTOR = 120;
const JITTER_IMPOSTOR = 0.34;

function hashPos(x, z) {
  let n = Math.round(x * 10) * 374761393 + Math.round(z * 10) * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function ruidoValor(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => {
    let n = a * 374761393 + b * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
  };
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v)
       + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

/**
 * Los árboles de una celda. Determinista por celda, igual que en el juego: la
 * misma celda produce siempre los mismos individuos, sin importar desde dónde
 * se la siembre. Eso es lo que permite comparar dos resiembras.
 */
const cacheCelda = new Map();
function arbolesDeCelda(gx, gz, factorDistancia) {
  // El número de intentos SÍ depende de la distancia a la celda del jugador,
  // así que la caché va por celda y por factor redondeado.
  const clave = `${gx},${gz},${Math.round(factorDistancia * 100)}`;
  if (cacheCelda.has(clave)) return cacheCelda.get(clave);
  let semilla = (gx * 73856093) ^ (gz * 19349663);
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };
  const out = [];
  const intentos = Math.round(22 * factorDistancia);
  for (let k = 0; k < intentos; k++) {
    const x = gx * TAM_CELDA + azar() * TAM_CELDA;
    const z = gz * TAM_CELDA + azar() * TAM_CELDA;
    // Claros del bosque: es el único filtro puro que se puede reproducir sin DEM
    if (ruidoValor(x * 0.0042, z * 0.0042) < 0.24) continue;
    out.push([x, z]);
  }
  cacheCelda.set(clave, out);
  return out;
}

/** Una resiembra: devuelve un Map de "x,z" -> usaImpostor(bool). */
function sembrar(cx, cz, refX, refZ) {
  const estado = new Map();
  for (let dz = -RADIO_CELDAS; dz <= RADIO_CELDAS; dz++) {
    for (let dx = -RADIO_CELDAS; dx <= RADIO_CELDAS; dx++) {
      const distCeldas = Math.hypot(dx, dz);
      if (distCeldas > RADIO_CELDAS) continue;
      const factorDistancia = 1 - Math.min(1, distCeldas / RADIO_CELDAS) * 0.62;
      for (const [x, z] of arbolesDeCelda(cx + dx, cz + dz, factorDistancia)) {
        const dist = Math.hypot(x - refX, z - refZ);
        const umbral = DIST_IMPOSTOR * (1 + (hashPos(x, z) - 0.5) * JITTER_IMPOSTOR);
        estado.set(x + ',' + z, dist > umbral);
      }
    }
  }
  return estado;
}

/**
 * Camina y cuenta. `refDe` decide qué punto se usa como referencia del reparto:
 * el centro de la celda (lo que hace el juego hoy) o la posición real del
 * jugador (la alternativa que hay que medir, no suponer).
 */
function caminata(refDe, dirX, dirZ, metros, paso = 2) {
  const largo = Math.hypot(dirX, dirZ);
  dirX /= largo; dirZ /= largo;
  let px = 0.37 * TAM_CELDA, pz = 0.21 * TAM_CELDA;   // arranque fuera del centro
  let celda = { x: Math.floor(px / TAM_CELDA), z: Math.floor(pz / TAM_CELDA) };
  let ref = refDe(celda, px, pz);
  let estado = sembrar(celda.x, celda.z, ref[0], ref[1]);
  const cambiosPorResiembra = [];
  let cambiosTotales = 0, resiembras = 0;
  const vecesQueCambio = new Map();

  for (let s = paso; s <= metros; s += paso) {
    px += dirX * paso; pz += dirZ * paso;
    const cx = Math.floor(px / TAM_CELDA), cz = Math.floor(pz / TAM_CELDA);
    if (cx === celda.x && cz === celda.z) continue;
    celda = { x: cx, z: cz };
    ref = refDe(celda, px, pz);
    const nuevo = sembrar(cx, cz, ref[0], ref[1]);
    let cambios = 0;
    for (const [k, v] of nuevo) {
      if (estado.has(k) && estado.get(k) !== v) {
        cambios++;
        vecesQueCambio.set(k, (vecesQueCambio.get(k) || 0) + 1);
      }
    }
    // Población comparable: árboles presentes en las dos resiembras y que
    // están del lado de la malla en alguna de las dos (los de 800 m no cuentan)
    let poblacionCerca = 0;
    for (const [k, v] of nuevo) {
      const [xs, zs] = k.split(',').map(Number);
      if (Math.hypot(xs - ref[0], zs - ref[1]) < 220) poblacionCerca++;
    }
    cambiosPorResiembra.push({ cambios, poblacionCerca });
    cambiosTotales += cambios;
    resiembras++;
    estado = nuevo;
  }
  return { cambiosPorResiembra, cambiosTotales, resiembras, vecesQueCambio };
}

const refCentroCelda = (c) => [(c.x + 0.5) * TAM_CELDA, (c.z + 0.5) * TAM_CELDA];
const refJugador = (c, px, pz) => [px, pz];

function informe(nombre, r, mallasReales) {
  const cs = r.cambiosPorResiembra.map(o => o.cambios);
  const media = cs.reduce((a, b) => a + b, 0) / cs.length;
  const pobl = r.cambiosPorResiembra.map(o => o.poblacionCerca);
  const poblMedia = pobl.reduce((a, b) => a + b, 0) / pobl.length;
  // Escalado a la población real del juego: la densidad sintética es mayor
  // porque acá no filtran agua, pendiente ni aptitud de especie.
  const fraccion = media / poblMedia;
  console.log(`  ${nombre}`);
  console.log(`    resiembras: ${r.resiembras}   cambios por resiembra: ${media.toFixed(1)}`);
  console.log(`    población dentro de 220 m: ${poblMedia.toFixed(0)}  ->  ${(fraccion * 100).toFixed(1)} % cambia de estado`);
  console.log(`    escalado a los ${mallasReales} árboles de malla del juego: ~${Math.round(fraccion * mallasReales / 0.30)} instancias por cruce`);
  const rep = [...r.vecesQueCambio.values()];
  const media2 = rep.length ? rep.reduce((a, b) => a + b, 0) / rep.length : 0;
  console.log(`    árboles que cambiaron alguna vez: ${rep.length}   veces cada uno: ${media2.toFixed(2)}`);
}

console.log('\n=== Cambios de estado malla<->cartelera por cruce de celda ===');
console.log('Umbral 120 m con desvío ±17 % (franja 100-140 m). Celda de 96 m.\n');

console.log('Caminata recta este-oeste, 1500 m:');
informe('referencia = CENTRO DE CELDA (lo que hace el juego hoy)',
  caminata(refCentroCelda, 1, 0, 1500), 103);
informe('referencia = POSICIÓN REAL DEL JUGADOR',
  caminata(refJugador, 1, 0, 1500), 103);

console.log('\nCaminata en diagonal, 1500 m (el peor caso: la celda salta 135 m):');
informe('referencia = CENTRO DE CELDA',
  caminata(refCentroCelda, 1, 1, 1500), 103);
informe('referencia = POSICIÓN REAL DEL JUGADOR',
  caminata(refJugador, 1, 1, 1500), 103);

// ── Comprobación analítica independiente, para no creerle a un solo método.
// Dos discos de radio T con centros a J metros: la diferencia simétrica es la
// gente que cambia de lado. Si el número cuadra con el conteo, el conteo mide.
function difSimetrica(T, J) {
  if (J >= 2 * T) return 2;
  const inter = 2 * T * T * Math.acos(J / (2 * T)) - (J / 2) * Math.sqrt(4 * T * T - J * J);
  const disco = Math.PI * T * T;
  return 2 * (disco - inter) / disco;
}
console.log('\n=== Control analítico independiente ===');
for (const [J, q] of [[96, 'recta'], [96 * Math.SQRT2, 'diagonal']]) {
  console.log(`  salto de referencia ${J.toFixed(0)} m (${q}): ${(difSimetrica(120, J) * 100).toFixed(0)} % del disco de malla cambia de lado`);
}
for (const J of [48, 24, 12]) {
  console.log(`  salto de ${J} m: ${(difSimetrica(120, J) * 100).toFixed(0)} %`);
}
