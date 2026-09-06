# Pendiente de horno — parche para `package.json`

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
