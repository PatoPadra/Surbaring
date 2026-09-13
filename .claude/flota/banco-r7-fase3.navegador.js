/**
 * BANCO DE LA FASE 3 (barro), MITAD NAVEGADOR — ronda 7.
 *
 * Lo que la mitad Node no puede ver: el mundo real, donde una planta a 7 m, un
 * tronco o la chatarra le ganan la tecla a la orilla. Es el MISMO instrumento con el
 * que se abrió la fase: 240 puntos al azar de la banda de orilla —orilla a 12 m y el
 * agua fuera del alcance de beber— a menos de 3 km del arranque, con el sotobosque y
 * la vegetación sembrados de verdad en cada uno.
 *
 *   A3 · la tecla promete arcilla con número —no «a veces»— en al menos el 80 % de
 *        la banda (en la apertura, 30 %, y todo era «a veces»), y el punto más
 *        cercano al arranque queda a menos de 600 m.
 *   A4 · hay arena a puñados a menos de 600 m del arranque: en los puntos de la
 *        banda donde `Mineria` decide banco de arena, apretando la tecla hasta dos
 *        veces seguidas —por si la orilla da primero la arcilla—, sale arena.
 *
 * Apertura (13/9/2026, antes del código): de 240, piedra con «a veces arcilla» 72,
 * michay 63, planta 45, chatarra 27, tronco 21, helecho 12. Más cercano, 499 m.
 *
 * Uso, desde un script inyectado en la página con el juego andando:
 *   await import('/.claude/flota/banco-r7-fase3.navegador.js')
 *   await window.bancoR7F3()   // progreso en document.body.dataset.bancoR7F3
 */

(() => {
  const PARTIDA = { lat: -41.0870, lon: -71.4290 };
  const RADIO_M = 3000;
  const MUESTRAS = 240;
  const PISO_ARCILLA = 0.80;
  const TOPE_CERCA_M = 600;

  const marcar = (o) => { document.body.dataset.bancoR7F3 = JSON.stringify(o); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  window.bancoR7F3 = async function bancoR7F3() {
    const S = window.SurviBar;
    const out = { inicio: new Date().toISOString(), checks: [], numeros: {}, fin: false };
    const ok = (c, desc, det) => { out.checks.push({ ok: !!c, desc, detalle: det === undefined ? undefined : String(det) }); marcar(out); return !!c; };
    try {
      if (S.partida) S.partida.guardar = () => {};
      const { jugador, sotobosque, vegetacion, recoleccion, tiempo, mundo, camara, limites, mineria, inventario } = S;
      const est = tiempo.estado();
      const ahora = tiempo.segundosTotales + 1e6;
      const P = mundo.aMundo(PARTIDA.lat, PARTIDA.lon);
      if (inventario.capacidadKg < 400) inventario.capacidadKg = 400;   // que nada deje de entrar

      const aguaAMano = (x, z) => {
        for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]]) if (mundo.esAgua(x + dx, z + dz)) return true;
        return mundo.cauceEn(x, z) > 0.25;
      };
      const promete = (etq, id) => {
        const m = /\(([^()]*)\)\s*$/.exec(etq || '');
        if (!m) return null;
        const nombre = id === 'arcilla' ? /arcilla/i : /arena/i;
        for (const crudo of m[1].split('·').map((x) => x.trim())) {
          if (!nombre.test(crudo)) continue;
          return /^a veces/i.test(crudo) ? 'veces' : 'numero';
        }
        return null;
      };

      let semilla = 11;
      const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
      const muestras = [];
      let intentos = 0;
      while (muestras.length < MUESTRAS && intentos < 400000) {
        intentos++;
        const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * RADIO_M;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (!mundo.dentro(x, z) || mundo.esAgua(x, z) || !mundo.orillaCerca(x, z) || aguaAMano(x, z)) continue;
        muestras.push({ x, z });
      }
      ok(muestras.length === MUESTRAS, 'premisa: se juntaron los 240 puntos de la banda', muestras.length);

      const porTipo = {};
      let conArcilla = 0, deArena = 0, conArena = 0;
      const distArcilla = [], distArena = [];
      for (let k = 0; k < muestras.length; k++) {
        const { x, z } = muestras[k];
        jugador.posicion.set(x, mundo.alturaEn(x, z) + 1.2, z);
        sotobosque.sembrarTodo(jugador.posicion);
        vegetacion.actualizar(jugador.posicion, 0, est, camara);
        const acc = recoleccion.quePuedoHacer(ahora);
        porTipo[acc ? acc.tipo : 'nada'] = (porTipo[acc ? acc.tipo : 'nada'] || 0) + 1;
        const d = Math.hypot(x - P.x, z - P.z);
        if (promete(acc?.etiqueta, 'arcilla') === 'numero') { conArcilla++; distArcilla.push(d); }

        // La arena: sólo donde la Mineria del juego decide banco de arena, fuera del Parque
        if (mineria.yacimientoEn(x, z)?.id === 'arena' && limites.jurisdiccion(x, z) !== 'parque') {
          deArena++;
          let hay = false;
          let actual = acc;
          for (let vez = 0; vez < 2 && actual && !hay; vez++) {
            if (promete(actual.etiqueta, 'arena')) { hay = true; break; }
            if (!promete(actual.etiqueta, 'arcilla')) break;
            recoleccion.actuar(ahora);
            actual = recoleccion.quePuedoHacer(ahora);
          }
          if (hay) { conArena++; distArena.push(d); }
        }
        if (k % 10 === 0) { out.numeros.progreso = k; marcar(out); await esperar(0); }
      }
      const minimo = (a) => (a.length ? Math.round(Math.min(...a)) : null);
      out.numeros = { banda: muestras.length, intentos, porTipo, conArcilla, fraccionArcilla: +(conArcilla / muestras.length).toFixed(3), arcillaMasCerca: minimo(distArcilla), puntosDeArena: deArena, conArena, arenaMasCerca: minimo(distArena) };

      ok(conArcilla / muestras.length >= PISO_ARCILLA, `A3 · la tecla promete arcilla con número en al menos el ${PISO_ARCILLA * 100} % de la banda`, `${conArcilla}/${muestras.length}`);
      ok(minimo(distArcilla) !== null && minimo(distArcilla) < TOPE_CERCA_M, `A3 · el punto con arcilla más cercano al arranque, a menos de ${TOPE_CERCA_M} m`, minimo(distArcilla));
      ok(deArena > 0, 'premisa: la recorrida pasa por playas de arena fuera del Parque', deArena);
      ok(minimo(distArena) !== null && minimo(distArena) < TOPE_CERCA_M, `A4 · hay arena a puñados a menos de ${TOPE_CERCA_M} m del arranque`, minimo(distArena));
      out.fin = true;
    } catch (e) {
      out.error = e.message;
      out.pila = (e.stack || '').split('\n').slice(0, 4).join(' | ');
    }
    marcar(out);
    return out;
  };
})();
