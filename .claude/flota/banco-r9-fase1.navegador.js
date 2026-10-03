/**
 * BANCO DE LA FASE 1 (iconos), MITAD NAVEGADOR — ronda 9.
 *
 * Mide lo que Node no puede: que CADA ícono se vea igual después del reempaquetado.
 * No asume grilla, ni cantidad de columnas, ni ninguna forma particular de armar la
 * hoja nueva — sólo pide la clase (`claseDe(id)`) y deja que EL NAVEGADOR resuelva el
 * `background-image`/`background-position`/`background-size` reales con
 * `getComputedStyle`, y con eso recorta al canvas exactamente lo que se vería en
 * pantalla. Así sirve sea cual sea la técnica de empaquetado que haya elegido el
 * agente (sprite en grilla, o cualquier otra).
 *
 *   C3 · cada ícono, recortado igual que lo vería un jugador, a los dos tamaños
 *        reales de uso (79 px de `.bp-cs > .ic` y ~35 px de `.bp-det-ic`, los dos
 *        cuadrados — Bolso.js), comparado en píxeles contra la hoja VIEJA
 *        (`.claude/flota/base-r9/Iconos.js`, servida por Vite). Sin sangrado de la
 *        celda vecina, sin recorte del dibujo.
 *   C4 · el ícono de reserva (`ic-x`) se ve igual, con el mismo método.
 *
 * Uso, desde la consola del navegador con Vite corriendo:
 *   const m = await import('/.claude/flota/banco-r9-fase1.navegador.js');
 *   const r = await m.bancoR9F1();   // { ok, porIcono: [...], peor: {...} }
 *
 * El módulo viejo se sirve tal cual desde `.claude/flota/base-r9/Iconos.js` (Vite ya
 * sirve `.claude/` en desarrollo — comprobado: 200 en `/.claude/flota/banco-r6-fase3.mjs`).
 */

const TAMANOS = [
  { nombre: '79px (grilla del bolso)', px: 79 },
  { nombre: '35px (renglón de detalle)', px: 35 },
];
// Tolerancia por canal: el recorte nuevo puede rasterizar el borde con un
// antialiasing levemente distinto al viejo (self-contained vs recorte de una hoja
// más grande); una diferencia de unos pocos niveles en el borde no es un defecto.
const TOLERANCIA_MEDIA = 3;
const TOLERANCIA_MAX = 40; // por canal, para no cazar antialiasing de borde como defecto
const FRACCION_PIXELES_SOBRE_TOLERANCIA_MAX = 0.02; // hasta 2% de píxeles pueden pasarse del máximo (bordes)

function urlDeHoja(css, id) {
  const re = new RegExp(`\\.ic-${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\{[^}]*background-image\\s*:\\s*url\\(("|')(.*?)\\1\\)`, 's');
  const m = css.match(re);
  return m ? m[2] : null;
}

const _imgCache = new Map();
function cargarImagen(src) {
  if (_imgCache.has(src)) return _imgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no cargó: ' + src.slice(0, 80)));
    img.src = src;
  });
  _imgCache.set(src, p);
  return p;
}

function parseTokens(valor, refPx) {
  // Acepta "50% 46%", "1200% 1100%", "contain", tokens en px.
  return valor.trim().split(/\s+/).map((t) => {
    if (t === 'contain') return { contain: true };
    if (t.endsWith('%')) return { pct: parseFloat(t) };
    if (t.endsWith('px')) return { px: parseFloat(t) };
    return { pct: 0 };
  });
}

/**
 * Recorta al canvas lo que un `background-image` con `background-size`/
 * `background-position` reales mostraría en una caja de boxPx × boxPx, sin asumir
 * NINGUNA estructura particular (sprite, imagen sola, lo que sea).
 */
async function recortarACanvas(el, boxPx) {
  const cs = getComputedStyle(el);
  const bg = cs.backgroundImage;
  const mUrl = bg.match(/url\(("|')(.*?)\1\)/s);
  if (!mUrl) throw new Error('sin background-image: ' + bg.slice(0, 60));
  const img = await cargarImagen(mUrl[2]);

  const sizeTokens = parseTokens(cs.backgroundSize, boxPx);
  let rw, rh;
  if (sizeTokens[0]?.contain) {
    const escala = Math.min(boxPx / img.naturalWidth, boxPx / img.naturalHeight);
    rw = img.naturalWidth * escala;
    rh = img.naturalHeight * escala;
  } else {
    const sx = sizeTokens[0], sy = sizeTokens[1] || sizeTokens[0];
    rw = sx.pct !== undefined ? boxPx * sx.pct / 100 : sx.px;
    rh = sy.pct !== undefined ? boxPx * sy.pct / 100 : sy.px;
  }

  const posTokens = parseTokens(cs.backgroundPosition, boxPx);
  const px0 = posTokens[0], py0 = posTokens[1] || posTokens[0];
  const offX = px0.pct !== undefined ? (boxPx - rw) * px0.pct / 100 : (px0.px || 0);
  const offY = py0.pct !== undefined ? (boxPx - rh) * py0.pct / 100 : (py0.px || 0);

  const canvas = document.createElement('canvas');
  canvas.width = boxPx; canvas.height = boxPx;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, offX, offY, rw, rh);
  return ctx.getImageData(0, 0, boxPx, boxPx);
}

function diffImageData(a, b) {
  let sumaAbs = 0, max = 0, sobreMax = 0;
  const n = a.data.length;
  for (let i = 0; i < n; i += 4) {
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      sumaAbs += d;
      if (d > max) max = d;
      if (d > TOLERANCIA_MAX) sobreMax++;
    }
  }
  const pixeles = n / 4;
  return { media: sumaAbs / n, max, fraccionSobreMax: sobreMax / n };
}

/** Un div real, con la clase real, de boxPx × boxPx, para que `getComputedStyle` resuelva el cascade tal cual. */
function crearCaja(clase, boxPx) {
  const el = document.createElement('div');
  el.className = clase;
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.width = boxPx + 'px';
  el.style.height = boxPx + 'px';
  document.body.appendChild(el);
  return el;
}

export async function bancoR9F1({ soloIds = null } = {}) {
  const Nueva = await import('/src/ui/Iconos.js?v=' + Date.now());
  const Vieja = await import('/.claude/flota/base-r9/Iconos.js?v=' + Date.now());

  const ID_ESTILO_VIEJA = 'iconosBolsoViejaBancoR9';
  let estiloViejo = document.getElementById(ID_ESTILO_VIEJA);
  if (!estiloViejo) {
    estiloViejo = document.createElement('style');
    estiloViejo.id = ID_ESTILO_VIEJA;
    // Prefijo "icv-" para no chocar con las clases de la hoja nueva ya inyectada.
    const cssVieja = Vieja.hoja().replace(/\.ic\b/g, '.icv').replace(/\.ic-/g, '.icv-');
    estiloViejo.textContent = cssVieja;
    document.head.appendChild(estiloViejo);
  }
  Nueva.inyectar(document);

  const ids = soloIds || [...Nueva.IDS, '__reserva_no_existe__'];
  const porIcono = [];
  const elementos = [];

  for (const tamano of TAMANOS) {
    for (const id of ids) {
      const claseNueva = Nueva.claseDe(id);
      const claseVieja = claseNueva.replace(/\bic\b/g, 'icv').replace(/\bic-/g, 'icv-');
      const elNueva = crearCaja(claseNueva, tamano.px);
      const elVieja = crearCaja(claseVieja, tamano.px);
      elementos.push(elNueva, elVieja);
      try {
        const [imgNueva, imgVieja] = await Promise.all([
          recortarACanvas(elNueva, tamano.px),
          recortarACanvas(elVieja, tamano.px),
        ]);
        const d = diffImageData(imgVieja, imgNueva);
        const ok = d.media <= TOLERANCIA_MEDIA && d.fraccionSobreMax <= FRACCION_PIXELES_SOBRE_TOLERANCIA_MAX;
        porIcono.push({ id, tamano: tamano.nombre, ok, ...d });
      } catch (e) {
        porIcono.push({ id, tamano: tamano.nombre, ok: false, error: e.message });
      }
    }
  }
  for (const el of elementos) el.remove();

  const malos = porIcono.filter((r) => !r.ok);
  const peor = porIcono.reduce((p, c) => (!p || (c.media || 0) > (p.media || 0) ? c : p), null);
  const resultado = { ok: malos.length === 0, total: porIcono.length, malos: malos.length, porIcono, peor };
  document.body.dataset.bancoR9F1 = JSON.stringify({ ok: resultado.ok, total: resultado.total, malos: resultado.malos, peor: resultado.peor });
  return resultado;
}
