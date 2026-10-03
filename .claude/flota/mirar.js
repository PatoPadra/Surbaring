/**
 * PARA MIRAR — la luna y el fuego, puntos 4 y 7 de la bandeja de la ronda 9.
 *
 * No es parte del juego ni lo cambia: parchea EN VIVO, en la pestaña donde se
 * corre, el sombreador del cielo y la luz de los hornos, para que el dueño compare
 * a ojo y decida. Al recargar la página todo vuelve a ser lo de siempre. No mueve
 * el reloj ni toca el guardado.
 *
 * Desde la consola, con el juego andando (`npm run dev`):
 *
 *   const m = await import('/.claude/flota/mirar.js');
 *   m.teclas();        // F8 alterna la luna, F9 el fuego; un cartel dice cuál es
 *   m.luna('B');       // o a mano
 *   m.fuego('C');
 *
 * LA LUNA (punto 4) — cuánto brilla la parte iluminada del disco:
 *   A · hoy: 2,6 fijo, sea creciente o llena.
 *   B · la física: el brillo por unidad de superficie que da la ley de Allen,
 *       (brillo de Allen ÷ fracción iluminada). En cuarto, 0,16 del de la llena.
 *   C · la mitad del camino EN LA IMAGEN: B con exponente 0,8. En cuarto, 0,23 del
 *       de la llena. (La raíz de B, que era la mitad de la cuenta, salía casi igual
 *       que A: la curva de tono satura. Medido el 3/10: máximo 246 · 232 · 203.)
 *   La llena es igual en las tres (es la referencia del contrato A3 de la ronda 8).
 *
 * EL FUEGO (punto 7) — el resplandor naranja en el suelo:
 *   A · hoy: 14 m de alcance, intensidad 20 de noche (ya bajó 60 % a 5 m con la 3b).
 *   B · menos alcance: 11 m.
 *   C · menos alcance y menos fuerza: 11 m e intensidad 16.
 *
 * Si se elige B o C, el cambio en el juego es de una línea: el `2.6` del disco en
 * `Cielo.js` (FRAG, «iluminado * 2.6») o `BRASA_RADIO_M`/`BRASA_NOCHE` en
 * `Hornos.js`.
 */

const LUNA = { A: 0, B: 1, C: 0.8 };
const FUEGO = { A: [1, 1], B: [11 / 14, 1], C: [11 / 14, 16 / 20] };
const estado = { luna: 'A', fuego: 'A' };

function S() {
  const s = window.SurviBar;
  if (!s) throw new Error('window.SurviBar no existe: falta entrar al parque');
  return s;
}

function prepararLuna() {
  const mat = S().cielo.malla.material;
  if (mat.uniforms.uMirarDisco) return mat;
  const viejo = mat.fragmentShader;
  const nuevo = viejo
    .replace('uniform float uBrilloLunar;', 'uniform float uBrilloLunar;\nuniform float uMirarDisco;')
    .replace('iluminado * 2.6',
      'iluminado * 2.6 * pow(clamp(uBrilloLunar / max(uFaseLunar, 0.02), 1e-4, 1.0), uMirarDisco)');
  if (nuevo === viejo || !nuevo.includes('uMirarDisco)')) {
    throw new Error('no encuentro «iluminado * 2.6» en el sombreador del cielo: Cielo.js cambió');
  }
  mat.uniforms.uMirarDisco = { value: 0 };
  mat.fragmentShader = nuevo;
  mat.needsUpdate = true;
  return mat;
}

export function luna(v = 'A') {
  if (!(v in LUNA)) throw new Error('luna: A, B o C');
  prepararLuna().uniforms.uMirarDisco.value = LUNA[v];
  estado.luna = v;
  cartel();
  return v;
}

export function fuego(v = 'A') {
  if (!(v in FUEGO)) throw new Error('fuego: A, B o C');
  const h = S().hornos;
  if (!h.__mirarOriginal) h.__mirarOriginal = h.fuentesDeLuz;
  const [kRadio, kLuz] = FUEGO[v];
  h.fuentesDeLuz = (senoSol) => h.__mirarOriginal.call(h, senoSol)
    .map(f => ({ ...f, radio: f.radio * kRadio, intensidad: f.intensidad * kLuz }));
  estado.fuego = v;
  cartel();
  return v;
}

function cartel() {
  let el = document.getElementById('mirar-cartel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mirar-cartel';
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;padding:6px 10px;'
      + 'background:rgba(0,0,0,.6);color:#e8e4dc;font:13px system-ui,sans-serif;border-radius:4px;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = `Mirar · luna ${estado.luna} (F8) · fuego ${estado.fuego} (F9)`;
}

export function teclas() {
  if (window.__mirarTeclas) return 'ya estaban';
  const sig = (o, v) => { const k = Object.keys(o); return k[(k.indexOf(v) + 1) % k.length]; };
  window.__mirarTeclas = (e) => {
    if (e.code === 'F8') { e.preventDefault(); luna(sig(LUNA, estado.luna)); }
    if (e.code === 'F9') { e.preventDefault(); fuego(sig(FUEGO, estado.fuego)); }
  };
  window.addEventListener('keydown', window.__mirarTeclas);
  cartel();
  return 'F8 luna · F9 fuego';
}
