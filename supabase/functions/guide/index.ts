// Supabase Edge Function: POST /functions/v1/guide  { brief, question? }
// Secrets: OPENROUTER_API_KEY (påkrævet), GUIDE_MODEL og GUIDE_REASONING (valgfri).
import { runGuide, type GuideConfig, type GuideRequest } from '../_shared/guide.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simpel rate limit pr. IP og pr. instans. Hvert kald koster kredit hos OpenRouter, og funktionen
// er åben for alle med linket. Tællerne lever kun i den enkelte isolate, så det er en
// bremse, ikke en garanti – men den stopper en løbsk klient og tilfældig misbrug.
const PER_IP_PER_MIN = Number(Deno.env.get('GUIDE_RATE_PER_MIN') ?? 6);
const PER_INSTANCE_PER_HOUR = Number(Deno.env.get('GUIDE_RATE_PER_HOUR') ?? 120);
const perIp = new Map<string, number[]>();
let perInstance: number[] = [];

function limited(ip: string): string | null {
  const now = Date.now();
  perInstance = perInstance.filter((t) => now - t < 3_600_000);
  if (perInstance.length >= PER_INSTANCE_PER_HOUR) return 'Guiden har nået sit timeloft. Prøv igen senere.';
  const hits = (perIp.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= PER_IP_PER_MIN) return 'For mange kald på kort tid. Vent et minut.';
  hits.push(now); perIp.set(ip, hits); perInstance.push(now);
  if (perIp.size > 5000) perIp.clear();
  return null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'ukendt';
  const block = limited(ip);
  if (block) return json({ error: block }, 429);
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return json({ error: 'OPENROUTER_API_KEY er ikke sat som secret på edge-funktionen (Dashboard → Edge Functions → Secrets, eller `supabase secrets set`).' }, 500);
  const cfg: GuideConfig = {
    apiKey,
    model: Deno.env.get('GUIDE_MODEL') || undefined,
    reasoning: (Deno.env.get('GUIDE_REASONING') as GuideConfig['reasoning']) || undefined,
    referer: req.headers.get('origin') || undefined,
    title: 'Løsningsbygger',
  };
  try {
    const body = (await req.json()) as GuideRequest;
    const result = await runGuide(cfg, body);
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('guide failed', msg);
    return json({ error: msg }, 500);
  }
});
