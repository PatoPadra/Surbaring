// r7-brasa-claves.mjs — comprobación de `brasa` (B2 en Node): los materiales de lo que
// arde, pasados por una copia exacta de conCSM (main.js:1007) como lo hace dibujarHorno.
import * as THREE from 'three';
import { Hornos, luzDeFuegoSegunSol } from '../../src/world/Hornos.js';
const csm = { cascades: 3, fade: true, shaders: new Map(),
  setupMaterial(material) {
    material.defines = material.defines || {};
    material.defines.USE_CSM = 1; material.defines.CSM_CASCADES = this.cascades;
    if (this.fade) material.defines.CSM_FADE = '';
    const shaders = this.shaders;
    material.onBeforeCompile = function (shader) { shaders.set(material, shader); };
    shaders.set(material, null);
  } };
function conCSM(csm, material) {
  const propio = material.onBeforeCompile;
  const clavePropia = material.customProgramCacheKey;
  csm.setupMaterial(material);
  const deCSM = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    if (deCSM) deCSM.call(this, shader, renderer);
    if (propio) propio.call(this, shader, renderer);
  };
  material.customProgramCacheKey = function () {
    const mia = clavePropia ? clavePropia.call(this) : '';
    return `${mia}|${propio ? propio.toString() : ''}`;
  };
  material.needsUpdate = true;
}
const hornos = new Hornos();
const dibujar = (h) => { const n = hornos.agregar(h); n.traverse(o => { if (o.isMesh) conCSM(csm, o.material); }); return n; };
const h = (id, x) => ({ def: { id }, x, y: 0, z: 0, ardiendo: true });
const nodos = [dibujar(h('carbonera', 0)), dibujar(h('fogata', 10)), dibujar(h('fogata', 20)), dibujar(h('horno_barro', 30)), dibujar(h('fragua', 40)), dibujar(h('fogata', 50))];
const clave = (m) => JSON.stringify([m.type, m.customProgramCacheKey(), m.defines, m.side, m.transparent, m.blending, m.vertexColors, m.flatShading, m.fog, m.toneMapped]);
const piedra = nodos[1].children.find(o => o.name === '').material;
const claves = new Map();
nodos.forEach((n) => n.traverse(o => { if (o.isMesh) { const k = clave(o.material); claves.set(k, (claves.get(k) || 0) + 1); } }));
console.log('claves de programa distintas entre TODAS las mallas de seis hornos:', claves.size, '(1 = todas comparten el de las piedras)');
const m = hornos._materiales.nucleo;
console.log('núcleo == piedra:', clave(m) === clave(piedra), '| largo de la clave', m.customProgramCacheKey().length, '| piedra', piedra.customProgramCacheKey().length);
// onBeforeCompile sigue llamando a CSM (la primera vuelta)
const sh = { uniforms: {} }; m.onBeforeCompile(sh, null);
console.log('onBeforeCompile del núcleo anota su sombreador en las cascadas:', csm.shaders.get(m) === sh);
// Winding del torno: la cara de un triángulo mira hacia afuera
const g = hornos._formas.lengua; const p = g.attributes.position, idx = g.index;
let afuera = 0, adentro = 0;
for (let t = 0; t < idx.count; t += 3) {
  const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(t)), b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(t + 1)), c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(t + 2));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (n.lengthSq() < 1e-12) continue;
  const centro = a.clone().add(b).add(c).divideScalar(3); centro.y = 0;
  if (centro.lengthSq() < 1e-9) continue;
  if (n.dot(centro) > 0) afuera++; else adentro++;
}
console.log('torno: triángulos que miran afuera', afuera, '· adentro', adentro, '· total índices/3', idx.count / 3);
for (const [i, n] of nodos.entries()) {
  let tris = 0, mallas = 0;
  n.traverse(o => { if (o.isMesh && o.material !== n.children[0].material && hornos.piezas[i].fuego.some(f => f.malla === o)) { mallas++; const gg = o.geometry; tris += gg.index ? gg.index.count / 3 : gg.attributes.position.count / 3; } });
  console.log(`  ${hornos.piezas[i].horno.def.id}: lo que arde = ${mallas} mallas, ${tris} triángulos`);
}
console.log('luzDeFuegoSegunSol: sin dato', luzDeFuegoSegunSol(), '· sol −10°', luzDeFuegoSegunSol(Math.sin(-10 * Math.PI / 180)).toFixed(3), '· −3°', luzDeFuegoSegunSol(Math.sin(-3 * Math.PI / 180)).toFixed(3), '· 0°', luzDeFuegoSegunSol(0).toFixed(3), '· 51,6°', luzDeFuegoSegunSol(Math.sin(51.6 * Math.PI / 180)).toFixed(3));
console.log('fuentes de noche / mediodía:', hornos.fuentesDeLuz().map(f => +f.intensidad.toFixed(2)).join(','), '/', hornos.fuentesDeLuz(0.78).map(f => +f.intensidad.toFixed(2)).join(','));
const muestras = new Map();
nodos.forEach((n, i) => n.traverse(o => { if (o.isMesh) { const k = clave(o.material); if (!muestras.has(k)) muestras.set(k, []); muestras.get(k).push(`${hornos.piezas[i].horno.def.id}:${o.name || o.geometry.type}`); } }));
let j = 0;
for (const [k, v] of muestras) { console.log(`clave ${j++} (${v.length} mallas): ${v.slice(0, 6).join(' ')}\n   ${k.slice(0, 60)} … ${k.slice(-140)}`); }
