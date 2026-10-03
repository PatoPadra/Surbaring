/**
 * BANCO DE LA FASE 5 (dormir-b) — ronda 9, mitad navegador.
 *
 * Lo escribe el JEFE, ANTES que el código del agente, después de medir los
 * defectos a mano en el juego (3/10/2026, ver RONDA9.md, fase 5). Reemplaza a
 * `banco-r9-fase4b.navegador.js`, que era ciego a los dos defectos: su G1 aceptaba
 * cualquier resultado, y su G4 falseaba `fundicion.cercano` mientras el calor del
 * fuego se lee de `fundicion.hornos[].ardiendo`, así que su «con refugio y fuego»
 * corrió sin fuego.
 *
 * Por eso ESTE banco no reemplaza NINGUNA dependencia de `puedeDormir`/`dormir`:
 * el parapeto se levanta con `construccion.levantar` y la fogata con
 * `fundicion.construir`, de verdad, con materiales en el bolso. Lo único que fija
 * a mano son las condiciones del experimento: el lugar y la hora (posición y
 * `tiempo.fecha`), las horas de leña de la fogata (la misma forma
 * `{ hasta }` que escribe `encender()`), el clima (semillas fijas y el sorteo de
 * eventos apagado, para que dos noches sean comparables) y el estado del cuerpo
 * al acostarse. La cadena de base del cartel se lee del prototipo de
 * `Recoleccion` —es el código real de la clase, sin la envoltura de `main.js`—.
 *
 *   N1 · DE DÍA no se duerme: con refugio y fuego, a las 14:00, el cartel dice lo
 *        mismo que la cadena de base y E no salta el reloj.
 *   N2 · DE NOCHE se puede: con refugio y fuego, en lugares reales donde la
 *        cadena de base ofrece algo que puede esperar (una mata, la orilla, una
 *        chatarra…), el cartel dice «dormir» y E duerme.
 *   N3 · EL FUEGO VIVE DURMIENDO: con 3 h de leña, al despertar la fogata no arde
 *        y la noche terminó al menos 1,0 °C más fría que con 15 h; con 15 h, igual
 *        que la base (±0,05 °C).
 *   N4 · HASTA QUE SALE EL SOL: se despierta dentro de un paso del amanecer real
 *        (no a las 7:00 fijas), en septiembre y en la noche más larga de junio.
 *   N5 · Y, NO O: de noche, refugio sin fuego, o fuego sin refugio, no ofrecen
 *        dormir.
 *   N6 · LA SED MANDA: de noche junto al agua y con sed, el cartel dice beber; sin
 *        sed, dormir.
 *   N7 · AL DESPERTAR NO SE VUELVE A OFRECER (el sol ya salió).
 *
 * Guarda de cobertura: N2 tiene que haber probado al menos 6 lugares donde la
 * base ofrecía otra cosa, y N6 tiene que haber encontrado una orilla; si no, la
 * sección sale ROJA por «no ejercitó», no verde por vacía.
 *
 * DEJA el parapeto y la fogata en la escena y el reloj movido: correrlo en una
 * carga limpia de la vista previa y RECARGAR después. Anula los cuatro guardados
 * al entrar (no toca la partida del dueño).
 *
 * Uso, desde la consola con Vite corriendo y el jugador ya en el parque:
 *   const m = await import('/.claude/flota/banco-r9-fase5.navegador.js?v=' + Date.now());
 *   const r = await m.bancoR9F5();              // r.resumen, r.secciones
 */

const PASO_TOLERANCIA_MIN = 7; // un paso del bucle de dormir a 72× son 6 min de mundo

function anularGuardados(S) {
  S.partida.guardar = () => {};
  S.calidad.automatico = false;
  for (const k of ['exploracion', 'hallazgos']) {
    if (S[k]) { S[k].guardar = () => {}; S[k].guardarSiHaceFalta = () => {}; }
  }
}

function seccion(nombre) {
  const s = { nombre, checks: [], ejercito: true, nota: '' };
  s.ok = (cond, desc, det) => { s.checks.push({ ok: !!cond, desc, det: det === undefined ? '' : String(det) }); return !!cond; };
  return s;
}

export async function bancoR9F5() {
  const S = window.SurviBar;
  if (!S) return { ok: false, error: 'window.SurviBar no existe: falta entrar al parque' };
  anularGuardados(S);
  const { posicionSolar } = await import('/src/world/Cielo.js');

  const proto = Object.getPrototypeOf(S.recoleccion);
  const cadenaBase = (t) => proto.quePuedoHacer.call(S.recoleccion, t);
  const cartel = () => S.recoleccion.quePuedoHacer(S.tiempo.segundosTotales);
  const p = S.jugador.posicion;
  const lat = S.tiempo.lat, lon = S.tiempo.lon;
  const alturaSol = (ms) => posicionSolar(new Date(ms), lat, lon).altura;
  const horaLocal = (ms) => { const d = new Date(ms - 3 * 3600e3); return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  /** El primer minuto, desde `ms`, con el sol arriba del horizonte. */
  const amanecerDesde = (ms) => { for (let m = 0; m < 24 * 60; m++) { const t = ms + m * 60e3; if (alturaSol(t) >= 0) return t; } return null; };

  // ── Lo que se guarda para devolver al final ─────────────────────────────
  const antes = {
    fecha: S.tiempo.fecha.getTime(), seg: S.tiempo.segundosTotales,
    sA: S.tiempo._semillaA, sB: S.tiempo._semillaB,
    entre: S.eventos.horasEntreTiradas, activos: S.eventos.activos,
    pos: { x: p.x, y: p.y, z: p.z },
    cuerpo: { vivo: S.jugador.vivo, salud: S.jugador.salud, hambre: S.jugador.hambre, sed: S.jugador.sed, temperatura: S.jugador.temperatura },
  };

  // Clima fijo y sin sorteo de eventos: dos noches tienen que poder compararse.
  S.tiempo._semillaA = 137; S.tiempo._semillaB = 23;
  S.eventos.activos = [];
  S.eventos.horasEntreTiradas = 1e9;

  const secciones = [];
  let campamento = null;

  const acostar = (iso, { sed = 95, hambre = 95 } = {}) => {
    const t = Date.parse(iso);
    S.tiempo.fecha = new Date(t);
    S.fundicion._ultimoMs = t; // el juego nunca mueve el reloj para atrás; el banco sí, entre noche y noche
    Object.assign(S.jugador, { vivo: true, salud: 100, hambre, sed, temperatura: 36.6 });
    return t;
  };
  const leña = (horas, desde) => {
    const f = campamento.fogata;
    f.mojado = 0;
    if (horas > 0) { f.fuego = { hasta: desde + horas * 3600e3 }; f.ardiendo = true; }
    else { f.fuego = null; f.ardiendo = false; }
  };
  const moverA = (x, z) => {
    p.x = x; p.z = z; p.y = S.mundo.alturaEn(x, z) + 1.7;
    S.sotobosque.sembrarTodo(p);
    S.vegetacion.actualizar(p, S.tiempo.segundosTotales, S.tiempo.estado(), S.camara);
    if (campamento) {
      const o = campamento.obra, f = campamento.fogata;
      o.x = x; o.z = z; o.y = S.mundo.alturaEn(x, z);
      f.x = x + 2; f.z = z; f.y = S.mundo.alturaEn(x + 2, z);
    }
  };
  const apretarE = () => S.recoleccion.actuar(S.tiempo.segundosTotales);
  /**
   * Dormir para N3 y N4, que miden LA NOCHE y no el cartel (eso es N2). Si el
   * cartel ofrece dormir, se duerme por el camino del jugador. Si no —la base no
   * lo ofrece casi nunca—, se fuerza el gesto como hacía el banco de 4b: el
   * cartel devuelve «dormir» durante esa sola llamada a E. Lo que se reemplaza
   * es la DECISIÓN del cartel, nunca el abrigo, el fuego ni el reloj que dormir
   * usa. Devuelve por qué camino durmió, para que el informe lo diga.
   */
  const dormirAhora = () => {
    if (cartel()?.tipo === 'dormir') { apretarE(); return 'cartel'; }
    const real = S.recoleccion.quePuedoHacer;
    S.recoleccion.quePuedoHacer = () => ({ tipo: 'dormir' });
    try { apretarE(); } finally { S.recoleccion.quePuedoHacer = real; }
    return 'forzado';
  };

  try {
    // ── El campamento, levantado de verdad ─────────────────────────────────
    const prep = seccion('Preparación — parapeto y fogata con las funciones del juego');
    const inv = S.inventario;
    const defParapeto = S.construccion.d.obras.find(o => o.id === 'parapeto');
    const defFogata = S.fundicion.hornoPorId('fogata');
    // Lugar libre en el bolso: el banco no mide el peso.
    inv.capacidadKg = Math.max(inv.capacidadKg, 200);
    for (const m of [...defParapeto.materiales, ...defFogata.materiales]) inv.agregar(m.recurso, m.cantidad + 2);
    const obra = S.construccion.levantar(defParapeto);
    p.x += 2;
    const fogata = S.fundicion.construir(defFogata);
    p.x -= 2;
    prep.ok(obra, 'el parapeto se levantó con construccion.levantar', obra ? `abrigo ${obra.obra.abrigo}` : 'null — ¿jurisdicción? correr en el punto de arranque');
    prep.ok(fogata, 'la fogata se armó con fundicion.construir', fogata ? `a ${Math.hypot(fogata.x - p.x, fogata.z - p.z).toFixed(1)} m` : 'null');
    secciones.push(prep);
    if (!obra || !fogata) throw new Error('sin campamento no hay banco');
    campamento = { obra, fogata };
    const origen = { x: p.x, z: p.z };

    // Lugares reales de tierra donde la cadena de base ofrece algo que puede esperar.
    let semilla = 11;
    const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    const lugares = [];
    const vistos = {};
    for (let i = 0; i < 80 && lugares.length < 8; i++) {
      const ang = rnd() * Math.PI * 2, r = 120 + rnd() * 2500;
      moverA(origen.x + Math.cos(ang) * r, origen.z + Math.sin(ang) * r);
      if (S.mundo.esAgua(p.x, p.z)) continue;
      S.jugador.sed = 100; S.jugador.hambre = 100;
      const b = cadenaBase(S.tiempo.segundosTotales);
      vistos[b ? b.tipo : 'nada'] = (vistos[b ? b.tipo : 'nada'] || 0) + 1;
      if (b && b.tipo !== 'beber' && b.tipo !== 'identificar') lugares.push({ x: p.x, z: p.z, base: b.tipo });
    }

    // ── N1 · de día no se duerme ───────────────────────────────────────────
    const n1 = seccion('N1 · de día, con refugio y fuego, no se duerme');
    let probados1 = 0;
    for (const l of lugares.slice(0, 4)) {
      moverA(l.x, l.z);
      const t = acostar('2025-09-22T17:00:00Z'); // 14:00 hora local
      leña(15, t);
      const b = cadenaBase(S.tiempo.segundosTotales);
      const c = cartel();
      n1.ok(c?.tipo !== 'dormir' && c?.tipo === b?.tipo, `de día el cartel es el de la base (${l.base})`, `cartel ${c?.tipo} · base ${b?.tipo}`);
      apretarE();
      const salto = (S.tiempo.fecha.getTime() - t) / 60e3;
      n1.ok(salto < 1, 'E de día no salta el reloj', `${salto.toFixed(1)} min`);
      probados1++;
    }
    if (probados1 < 3) { n1.ejercito = false; n1.nota = `sólo ${probados1} lugares`; }
    secciones.push(n1);

    // ── N2 · de noche se puede ──────────────────────────────────────────────
    const n2 = seccion('N2 · de noche, con refugio y fuego, el cartel dice dormir');
    let probados2 = 0;
    for (const l of lugares) {
      moverA(l.x, l.z);
      const t = acostar('2025-09-22T01:00:00Z'); // 22:00 hora local
      leña(15, t);
      const b = cadenaBase(S.tiempo.segundosTotales);
      if (!b || b.tipo === 'identificar' || b.tipo === 'beber') continue;
      probados2++;
      const c = cartel();
      n2.ok(c?.tipo === 'dormir', `noche en un lugar con «${b.tipo}» → dormir`, `cartel ${c?.tipo ?? 'nada'}`);
    }
    // E duerme de verdad, en el último lugar probado
    {
      const t = acostar('2025-09-22T01:00:00Z');
      leña(15, t);
      apretarE();
      const horas = (S.tiempo.fecha.getTime() - t) / 3600e3;
      n2.ok(horas > 6, 'E de noche duerme (el reloj salta horas)', `${horas.toFixed(2)} h`);
    }
    if (probados2 < 6) { n2.ejercito = false; n2.nota = `sólo ${probados2} lugares con otra acción (vistos: ${JSON.stringify(vistos)})`; }
    secciones.push(n2);

    // ── N3 · el fuego vive durmiendo ────────────────────────────────────────
    // Números de la base medidos el 3/10/2026 en ESTAS condiciones (semillas 137/23,
    // sin eventos, 22/9 22:00, parapeto + fogata a 2 m): 36,178 °C con 3 h y con
    // 15 h —el defecto—. Con el arreglo simulado (la fundición actualizada en cada
    // vuelta): 34,818 °C con 3 h y 36,178 con 15 h; y despertando al amanecer
    // (9,7 h en vez de 9) 34,807 y 36,181. El umbral de 1,0 °C deja margen a las
    // dos duraciones de noche.
    const n3 = seccion('N3 · la leña se acaba mientras se duerme');
    moverA(origen.x, origen.z);
    const noche = (horasLeña) => {
      const t = acostar('2025-09-22T01:00:00Z');
      leña(horasLeña, t);
      const via = dormirAhora();
      return {
        via, temp: S.jugador.temperatura, salud: S.jugador.salud,
        // `ardiendo` y no `fundicion.arde()`: `arde()` mira la fecha y da «no»
        // aunque la llama siga calentando; `ardiendo` es lo que leen el calor
        // (`fuegoCercano`) y la llama dibujada.
        arde: campamento.fogata.ardiendo,
        horas: (S.tiempo.fecha.getTime() - t) / 3600e3,
      };
    };
    const corta = noche(3), larga = noche(15);
    if (corta.horas < 6 || larga.horas < 6) {
      n3.ok(false, 'no se llegó a dormir en el campamento para medir', `durmió ${corta.horas.toFixed(2)} h y ${larga.horas.toFixed(2)} h (${corta.via})`);
    } else {
      n3.ok(!corta.arde, 'con 3 h de leña, al despertar la fogata ya no arde', `arde=${corta.arde} · durmió ${corta.horas.toFixed(1)} h · ${corta.via}`);
      n3.ok(larga.temp - corta.temp >= 1.0, 'con 3 h de leña la noche termina ≥ 1,0 °C más fría que con 15 h',
        `3 h → ${corta.temp.toFixed(2)} °C · 15 h → ${larga.temp.toFixed(2)} °C`);
      n3.ok(Math.abs(larga.temp - 36.178) <= 0.05, 'con 15 h la noche es la de la base (36,178 ± 0,05 °C)', `${larga.temp.toFixed(3)} °C`);
      n3.ok(larga.arde, 'con 15 h la fogata sigue ardiendo al despertar (control)', `arde=${larga.arde}`);
    }
    secciones.push(n3);

    // ── N4 · hasta que sale el sol ──────────────────────────────────────────
    const n4 = seccion('N4 · se despierta con el sol, no a las 7:00');
    for (const [iso, nombre] of [['2025-09-22T01:00:00Z', '22/9, 22:00'], ['2026-06-21T22:00:00Z', '21/6, 19:00']]) {
      moverA(origen.x, origen.z);
      const t = acostar(iso);
      leña(20, t);
      const via = dormirAhora();
      const fin = S.tiempo.fecha.getTime();
      if (fin - t < 3600e3) { n4.ok(false, `${nombre}: no se llegó a dormir`, `${((fin - t) / 60e3).toFixed(0)} min · ${via}`); continue; }
      const sale = amanecerDesde(t);
      const dif = (fin - sale) / 60e3;
      n4.ok(S.jugador.vivo, `${nombre}: sobrevive la noche con refugio y 20 h de fuego`, `salud ${S.jugador.salud.toFixed(1)}`);
      n4.ok(dif >= -1 && dif <= PASO_TOLERANCIA_MIN, `${nombre}: despierta al amanecer (${horaLocal(sale)})`,
        `despertó ${horaLocal(fin)} · ${dif.toFixed(0)} min del amanecer · durmió ${((fin - t) / 3600e3).toFixed(2)} h · ${via}`);
      // N7 de paso: con el sol arriba no se vuelve a ofrecer
      const otra = cartel();
      n4.ok(otra?.tipo !== 'dormir', `${nombre}: recién despierto, el cartel ya no ofrece dormir`, otra?.tipo ?? 'nada');
    }
    secciones.push(n4);

    // ── N5 · Y, no O ────────────────────────────────────────────────────────
    const n5 = seccion('N5 · de noche, refugio sin fuego o fuego sin refugio no alcanzan');
    {
      moverA(origen.x, origen.z);
      let t = acostar('2025-09-22T01:00:00Z');
      leña(0, t);
      const sinFuego = cartel();
      n5.ok(sinFuego?.tipo !== 'dormir', 'refugio con la fogata apagada → no dormir', sinFuego?.tipo ?? 'nada');
      t = acostar('2025-09-22T01:00:00Z');
      leña(15, t);
      const o = campamento.obra; const ox = o.x, oz = o.z;
      o.x += 60; o.z += 60; // el parapeto lejos: fuego sin refugio
      const sinRefugio = cartel();
      o.x = ox; o.z = oz;
      n5.ok(sinRefugio?.tipo !== 'dormir', 'fogata ardiendo sin refugio a mano → no dormir', sinRefugio?.tipo ?? 'nada');
      const conTodo = cartel();
      n5.ok(conTodo?.tipo === 'dormir', 'control: con los dos, sí', conTodo?.tipo ?? 'nada');
    }
    secciones.push(n5);

    // ── N6 · la sed manda ───────────────────────────────────────────────────
    const n6 = seccion('N6 · de noche junto al agua: con sed se bebe, sin sed se duerme');
    let orilla = null;
    for (let i = 0; i < 120 && !orilla; i++) {
      const ang = rnd() * Math.PI * 2, r = 100 + rnd() * 3500;
      moverA(origen.x + Math.cos(ang) * r, origen.z + Math.sin(ang) * r);
      if (S.mundo.esAgua(p.x, p.z)) continue;
      S.jugador.sed = 50;
      const b = cadenaBase(S.tiempo.segundosTotales);
      if (b?.tipo === 'beber') orilla = { x: p.x, z: p.z };
    }
    if (!orilla) { n6.ejercito = false; n6.nota = 'no se encontró una orilla en tierra'; }
    else {
      moverA(orilla.x, orilla.z);
      let t = acostar('2025-09-22T01:00:00Z', { sed: 50 });
      leña(15, t);
      const conSed = cartel();
      n6.ok(conSed?.tipo === 'beber', 'con sed (50) junto al agua → beber', conSed?.tipo ?? 'nada');
      t = acostar('2025-09-22T01:00:00Z', { sed: 100 });
      leña(15, t);
      const sinSed = cartel();
      n6.ok(sinSed?.tipo === 'dormir', 'sin sed (100) junto al agua → dormir', sinSed?.tipo ?? 'nada');
    }
    secciones.push(n6);
  } catch (e) {
    const err = seccion('ERROR');
    err.ok(false, e.message, e.stack?.split('\n').slice(0, 3).join(' | '));
    secciones.push(err);
  } finally {
    S.tiempo._semillaA = antes.sA; S.tiempo._semillaB = antes.sB;
    S.eventos.horasEntreTiradas = antes.entre; S.eventos.activos = antes.activos;
    S.tiempo.fecha = new Date(antes.fecha); S.tiempo.segundosTotales = antes.seg;
    S.fundicion._ultimoMs = antes.fecha;
    Object.assign(S.jugador, antes.cuerpo);
    p.x = antes.pos.x; p.y = antes.pos.y; p.z = antes.pos.z;
  }

  const resumen = secciones.map(s => {
    const malos = s.checks.filter(c => !c.ok).length;
    const estado = !s.ejercito ? 'ROJO (no ejercitó)' : malos ? 'ROJO' : 'VERDE';
    return `${estado.padEnd(18)} ${s.nombre} — ${s.checks.length - malos}/${s.checks.length}${s.nota ? ' · ' + s.nota : ''}`;
  });
  const ok = secciones.every(s => s.ejercito && s.checks.every(c => c.ok));
  const r = { ok, resumen, secciones };
  document.body.dataset.bancoR9F5 = JSON.stringify({ ok, resumen });
  return r;
}
