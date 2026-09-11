# Løsningsbygger

Et letvægtsværktøj til samtalen mellem ledelse og teknikere om en data- og AI-løsning.
Seks lag, 31 teknologier med ensartede videnskort, seks AI-behov der afgør hvilke lag der kræves,
en regelmotor der oversætter valg til beslutninger med ejer, og en AI-guide (LLM via OpenRouter) der peger på det,
reglerne ikke fanger.

## Kør lokalt

```bash
npm install
cp .env.example .env      # læg OPENROUTER_API_KEY i .env (https://openrouter.ai/keys)
npm run dev               # http://localhost:5173
```

Alt gemmes i browseren (localStorage) og i delelinket (`#s=…`). Der er ingen server ud over
Vite-dev-serveren, som proxyer `POST /api/guide` til OpenRouter, så nøglen aldrig når browseren.
Modellen vælges med `GUIDE_MODEL` (standard `deepseek/deepseek-v4.1-flash`; fx `anthropic/claude-sonnet-5` som dyrere alternativ),
og `GUIDE_REASONING` styrer tænkning (`none`, `low`, `medium`, `high`; standard `none`, fordi DeepSeek ignorerer token-loftet og ellers bliver for langsom).

## Struktur

| Sti | Indhold |
|---|---|
| `src/data/catalog.ts` | Lag, teknologier, startløsninger, parvise noter og afvejninger (porteret fra designet) |
| `src/data/extra.ts` | Roller, betalingsmodel, AI-behov (`USE_CASES`) og ledelsens hensyn (`PRIORITIES`) |
| `src/data/rules.ts` | Regelmotoren: samlet billede, overlap, samspil, blinde punkter, AI-behov, spændinger |
| `src/lib/state.ts` | Løsningens tilstand, reducer, persistens og delelink |
| `src/lib/guide.ts` | Bygger briefen til AI-guiden og kalder endpointet |
| `src/lib/storage.ts` | Lagringsadapter: lokalt, eller Supabase når `VITE_SUPABASE_*` er sat |
| `supabase/functions/_shared/guide.ts` | Prompt, JSON-format og kald til OpenRouter (`json_object`, skema i prompten, normalisering af svaret) – delt af dev-server og edge function |
| `supabase/functions/guide/index.ts` | Supabase Edge Function til produktion |
| `supabase/schema.sql` | Én tabel til gemte løsninger |

## Deploy på Supabase (free tier)

1. Opret et projekt og kør `supabase/schema.sql` i SQL-editoren (eller lad Supabase MCP køre den som migration).
2. Edge function (CLI, eller Supabase MCP `deploy_edge_function` med `guide/index.ts` + `_shared/guide.ts`, `verify_jwt=false`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase functions deploy guide
   ```
   (`supabase/config.toml` slår JWT-kontrol fra for `guide` og sætter project ref.)
   Læg OpenRouter-nøglen som secret, enten via CLI eller i Dashboard → Edge Functions → Secrets
   (valgfrit også `GUIDE_MODEL` og `GUIDE_REASONING`):
   ```bash
   npx supabase secrets set OPENROUTER_API_KEY=sk-or-...
   ```
3. Byg frontend med produktionsværdier i `.env`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable key, sb_publishable_…>
   VITE_GUIDE_URL=https://<ref>.supabase.co/functions/v1/guide
   ```
   `npm run build` giver en statisk `dist/`. Værdierne ligger i `.env.production` (kun offentlige nøgler),
   så Vercel kan bygge uden ekstra opsætning.

## Hosting på Vercel

Supabase kan ikke servere HTML uden et betalt custom domain (Storage og Edge Functions omskriver
`text/html` til `text/plain`), så frontend ligger på Vercel. Første gang:

```bash
npx vercel login
npm run deploy
```

Derefter er `npm run deploy` nok. `vercel.json` sætter framework, build-kommando og lange cache-headers
på de hash-navngivne filer. Appen bruger hash-routing, så der skal ingen SPA-rewrites til.

Edge-funktionen er åben for alle med linket, og hvert kald koster kredit på OpenRouter-kontoen. Den har en simpel rate limit (6 kald/min pr. IP, 120/time pr. instans,
justérbar via secrets `GUIDE_RATE_PER_MIN` og `GUIDE_RATE_PER_HOUR`). Tællerne lever pr. isolate, så det er en bremse,
ikke en garanti. Læg rigtig auth på, før linket deles bredt.
