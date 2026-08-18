import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Puente de capturas para desarrollo.
 *
 * El panel del navegador integrado no siempre compone cuadros, así que no
 * siempre se puede sacar una captura desde afuera. Este middleware recibe el
 * contenido del canvas por POST y lo escribe a disco, que es la única forma
 * fiable de revisar el aspecto del juego durante el desarrollo.
 *
 * Sólo existe en el servidor de desarrollo; no forma parte de la compilación.
 */
function puenteCapturas() {
  return {
    name: 'survibar-capturas',
    configureServer(servidor) {
      servidor.middlewares.use('/api/captura', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Sólo POST');
        }
        let cuerpo = '';
        req.setEncoding('utf8');
        req.on('data', (t) => {
          cuerpo += t;
          if (cuerpo.length > 64 * 1024 * 1024) {
            res.statusCode = 413;
            res.end('Captura demasiado grande');
            req.destroy();
          }
        });
        req.on('end', () => {
          try {
            const { nombre, datos } = JSON.parse(cuerpo);
            const limpio = String(nombre || 'captura').replace(/[^a-z0-9_-]/gi, '_');
            const base64 = String(datos).replace(/^data:image\/png;base64,/, '');
            const dir = path.resolve(process.cwd(), 'capturas');
            fs.mkdirSync(dir, { recursive: true });
            const destino = path.join(dir, `${limpio}.png`);
            fs.writeFileSync(destino, Buffer.from(base64, 'base64'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, ruta: destino, bytes: base64.length }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [puenteCapturas()],
  server: { host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
