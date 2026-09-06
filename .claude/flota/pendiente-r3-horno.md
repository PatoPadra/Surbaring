# Pendiente de horno — parche para `package.json`

> **APLICADO Y CERRADO — 6/9/2026, jefe de la fase 3.** Comprobado contra el
> archivo, no contra la bitácora: `package.json` ya tiene
> `"hornear": "node tools/hornear-texturas.mjs"` en `scripts`. No queda nada
> que hacer acá. Se deja el texto abajo como registro de por qué `horno` no lo
> aplicó él mismo, que fue lo correcto.

No lo aplico porque `package.json` no es mío (fase 1 sólo tiene exclusividad
sobre `tools/hornear-texturas.mjs`, `public/tex/`, `src/util/atlas.js` y
`src/data/pelajes.json`). El script ya corre perfecto invocado directo con
`node tools/hornear-texturas.mjs` — esto es sólo el atajo de `npm run`.

Agregar en `"scripts"`:

```diff
   "scripts": {
     "dev": "vite",
     "build": "vite build",
     "preview": "vite preview",
     "dem": "node tools/build-dem.mjs",
+    "hornear": "node tools/hornear-texturas.mjs"
   },
```

Verificado que corre limpio como `node tools/hornear-texturas.mjs` (sin
argumentos, sin variables de entorno) — ver `.claude/flota/r3-horno.md`.
