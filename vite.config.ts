import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { runGuide, type GuideConfig, type GuideRequest } from './supabase/functions/_shared/guide';

/**
 * Lokal udgave af Supabase Edge Function'en `guide`: serverer POST /api/guide fra Vite-dev-serveren,
 * så OpenRouter-nøglen aldrig når browseren. I produktion peger VITE_GUIDE_URL på edge-funktionen.
 */
function guideDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'guide-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/guide', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          if (!env.OPENROUTER_API_KEY) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Ingen OPENROUTER_API_KEY. Læg den i .env (se .env.example) og genstart `npm run dev`.' }));
            return;
          }
          const cfg: GuideConfig = {
            apiKey: env.OPENROUTER_API_KEY,
            model: env.GUIDE_MODEL || undefined,
            reasoning: (env.GUIDE_REASONING as GuideConfig['reasoning']) || undefined,
            referer: 'http://localhost:5173',
            title: 'Løsningsbygger (dev)',
          };
          try {
            const body = JSON.parse(raw) as GuideRequest;
            const result = await runGuide(cfg, body);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Relative stier, så dist/ kan ligge under en undermappe (fx Supabase Storage public bucket).
    base: './',
    plugins: [react(), guideDevApi(env)],
    server: { port: 5173 },
  };
});
