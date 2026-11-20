import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dev only: serve netlify/functions/* at their `config.path` (e.g. /api/delete-account)
 * so server code can be exercised locally. Non-VITE_ vars from .env.development.local
 * (emulator hosts) are put on process.env, so the functions talk to the emulators.
 * Production uses Netlify's real function runtime; this plugin never ships.
 */
const netlifyFunctionsInDev = (mode: string): Plugin => ({
  name: 'netlify-functions-dev',
  apply: 'serve',
  configureServer(server: ViteDevServer) {
    const env = loadEnv(mode, process.cwd(), '');
    for (const [k, v] of Object.entries(env)) if (!k.startsWith('VITE_') && !(k in process.env)) process.env[k] = v;

    const dir = path.resolve(__dirname, 'netlify/functions');
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (!url.pathname.startsWith('/api/')) return next();
      try {
        for (const file of fs.readdirSync(dir).filter(f => /\.m?[tj]s$/.test(f))) {
          const mod = await server.ssrLoadModule(path.join(dir, file));
          if (mod.config?.path !== url.pathname) continue;
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(url.toString(), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(chunks),
          });
          const response: Response = await mod.default(request, {});
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'No local function for this path.' }));
      } catch (err) {
        console.error('[netlify-functions-dev]', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
  },
});

/** The app version shown in the footer: the Android versionName, so there is one place to bump. */
const appVersion = /versionName\s+"([^"]+)"/.exec(fs.readFileSync(path.resolve(__dirname, 'android/app/build.gradle'), 'utf8'))?.[1] ?? 'dev';

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss(), netlifyFunctionsInDev(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
