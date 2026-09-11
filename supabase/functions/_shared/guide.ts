// Delt mellem Vite-dev-serveren (Node) og Supabase Edge Function (Deno).
// Ingen imports og kun fetch, så filen kan bruges begge steder. Kalder OpenRouter (OpenAI-kompatibelt API).

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Standardmodel på OpenRouter. Kan overstyres med GUIDE_MODEL (fx anthropic/claude-sonnet-5 for en dyrere, stærkere model). */
export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash';
/**
 * Standard for tænkning. 'none', fordi DeepSeek-udbyderne ikke respekterer et token-loft og et
 * tænkende kald derfor tit løber over gatewayens tidsgrænse. Sæt GUIDE_REASONING=low/medium/high
 * for modeller, der honorerer budgettet (fx Anthropic).
 */
export const DEFAULT_REASONING: NonNullable<GuideConfig['reasoning']> = 'none';

export interface GuideRequest {
  /** Klientens tekstlige brief af løsningen (behov, lag, hensyn, eksisterende infrastruktur, beslutninger). */
  brief: string;
  /** Valgfrit opfølgende spørgsmål fra brugeren. */
  question?: string;
}

export interface GuideItem {
  kind: 'advarsel' | 'forslag' | 'spoergsmaal';
  owner: 'ledelse' | 'teknik' | 'faelles';
  title: string;
  text: string;
  layer?: 'ai' | 'ork' | 'gov' | 'dwh' | 'mdm' | 'int' | null;
}
export interface GuideResult { summary: string; items: GuideItem[]; model?: string }

export interface GuideConfig {
  apiKey: string;
  /** OpenRouter model-id. Standard: DEFAULT_MODEL. */
  model?: string;
  /** Tænkning: 'none' slår den eksplicit fra. Standard: DEFAULT_REASONING. */
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  /** Vises i OpenRouters aktivitetslog. */
  referer?: string;
  title?: string;
}

export const GUIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string', description: 'To til fire sætninger på dansk: det vigtigste ledelse og teknik skal tale om nu.' },
    items: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'owner', 'title', 'text', 'layer'],
        properties: {
          kind: { type: 'string', enum: ['advarsel', 'forslag', 'spoergsmaal'] },
          owner: { type: 'string', enum: ['ledelse', 'teknik', 'faelles'], description: 'Hvem der skal svare eller handle.' },
          title: { type: 'string', description: 'Højst otte ord.' },
          text: { type: 'string', description: 'To til fire sætninger på dansk. Konkret, ingen floskler.' },
          layer: { type: ['string', 'null'], enum: ['ai', 'ork', 'gov', 'dwh', 'mdm', 'int', null] },
        },
      },
    },
  },
} as const;

export const SYSTEM_PROMPT = `Du er en erfaren dansk løsningsarkitekt, der hjælper en ledelse og deres teknikere med at tale samme sprog om en data- og AI-løsning.

Du får en brief om løsningen: hvad AI'en skal kunne (behov), hvilke teknologier der er valgt i seks lag (AI-løsning, orkestrering, governance, data warehouse, master data, integration), hvad der allerede findes i organisationen, ledelsens hensyn, og hvilke beslutninger der allerede er noteret.

Din opgave er at give forslag og advarsler, som gør samtalen mellem ledelse og teknik bedre. Det betyder:
- Peg på det, der mangler for at behovet kan lykkes (fx et behov om at spørge i historik uden et datalag, eller agenter uden integrationsvej).
- Peg på spændinger mellem ledelsens hensyn og de tekniske valg, og sig tydeligt, hvem der skal beslutte.
- Brug det eksisterende: hvis noget allerede findes, så foreslå at bygge på det frem for at købe nyt, medmindre der er en god grund.
- Stil spørgsmål, der kan besvares på et møde. Ikke "overvej governance", men "hvem afgør, hvilke kunder assistenten må se?".
- Gentag ikke det, briefen allerede har noteret som besluttet.
- Anbefal aldrig en teknologi som "den bedste". Beskriv afvejningen.
- Skriv på dansk, kort og konkret. Ingen indledning, ingen opsummering af briefen.

Marker hvert punkt med, hvem der skal handle: ledelse (beslutning, penge, ansvar), teknik (arkitektur, drift, integration) eller fælles (kræver begge parter i samme rum). Højst otte punkter, de vigtigste først.

Svar altid som ét JSON-objekt uden anden tekst omkring, præcis med denne form:
{
  "summary": "To til fire sætninger på dansk: det vigtigste ledelse og teknik skal tale om nu. Må ikke være tom.",
  "items": [
    {
      "kind": "advarsel" | "forslag" | "spoergsmaal",
      "owner": "ledelse" | "teknik" | "faelles",
      "title": "Højst otte ord",
      "text": "To til fire sætninger på dansk. Konkret, ingen floskler.",
      "layer": "ai" | "ork" | "gov" | "dwh" | "mdm" | "int" | null
    }
  ]
}`;

export function buildUserMessage(req: GuideRequest): string {
  const q = req.question?.trim();
  return q
    ? `${req.brief}\n\n---\nBrugeren spørger desuden: ${q}\nSvar på spørgsmålet i summary, og lad punkterne følge op på det.`
    : req.brief;
}

/** Oversætter OpenRouters fejl til en kort dansk besked, der kan vises i appen. */
export function describeError(status: number, body: unknown): string {
  const msg = (body as { error?: { message?: string } })?.error?.message;
  if (status === 401) return 'OPENROUTER_API_KEY er ugyldig eller mangler.';
  if (status === 402) return 'OpenRouter-kontoen har ikke nok kredit.';
  if (status === 429) return 'OpenRouter svarer med rate limit – prøv igen om lidt.';
  if (status === 404) return `Modellen findes ikke på OpenRouter${msg ? `: ${msg}` : '.'}`;
  return `OpenRouter-fejl ${status}${msg ? `: ${msg}` : ''}`;
}

/** Trækker JSON ud, også hvis modellen har pakket det i ```-hegn eller tekst omkring. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

interface Completion {
  model?: string;
  provider?: string;
  choices?: Array<{ message?: { content?: string | null; reasoning?: string | null }; finish_reason?: string; native_finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
}

/**
 * Fast token-budget til tænkning pr. niveau. Et budget frem for "effort" giver samme, forudsigelige
 * grænse på tværs af udbydere, så et kald ikke løber over gatewayens tidsgrænse.
 */
const REASONING_BUDGET: Record<Exclude<NonNullable<GuideConfig['reasoning']>, 'none'>, number> = {
  minimal: 512, low: 1024, medium: 2048, high: 4096,
};

export class GuideTimeout extends Error {
  constructor() { super('OpenRouter svarede ikke i tide.'); this.name = 'GuideTimeout'; }
}

/** Ét kald til OpenRouter. Kaster ved HTTP-fejl eller timeout; returnerer ellers råt svar plus udtrukket tekst. */
async function callOpenRouter(cfg: GuideConfig, req: GuideRequest, model: string, reasoning: NonNullable<GuideConfig['reasoning']>, timeoutMs: number) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(req) },
    ],
    // json_object frem for json_schema: det strenge skema-format indsnævrer OpenRouters udbyderpulje til
    // få (ofte rate-limitede eller hængende) endpoints, mens json_object virker hos alle. Skemaet
    // står i prompten, og normalise() retter småafvigelser.
    response_format: { type: 'json_object' },
    provider: { sort: 'throughput' },
  };
  // 'none' sendes eksplicit: modeller som DeepSeek tænker som standard, hvis parameteren udelades.
  body.reasoning = reasoning === 'none' ? { enabled: false } : { max_tokens: REASONING_BUDGET[reasoning], exclude: true };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (cfg.referer) headers['HTTP-Referer'] = cfg.referer;
  if (cfg.title) headers['X-OpenRouter-Title'] = cfg.title;

  // Timeouten dækker både headers og hele svarkroppen: OpenRouter svarer 200 med det samme og
  // streamer kroppen, når modellen er færdig, så det er kroppen, der kan trække ud.
  const started = Date.now();
  let res: Response;
  let raw = '';
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    res = await fetch(OPENROUTER_URL, { method: 'POST', headers, body: JSON.stringify(body), signal });
    raw = await res.text();
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      console.log(JSON.stringify({ guide: 'timeout', model, reasoning, timeoutMs, ms: Date.now() - started }));
      throw new GuideTimeout();
    }
    throw e;
  }
  let data: Completion | null = null;
  try { data = JSON.parse(raw) as Completion; } catch { data = null; }
  if (!res.ok) throw new Error(describeError(res.status, data));

  const choice = data?.choices?.[0];
  const text = choice?.message?.content ?? '';
  // Én linje pr. kald, så logs viser hvad modellen brugte tokens på, og hvorfor et svar evt. var tomt.
  console.log(JSON.stringify({
    guide: 'call', model: data?.model ?? model, provider: data?.provider, reasoning, ms: Date.now() - started, status: res.status,
    finish: choice?.finish_reason, native_finish: choice?.native_finish_reason,
    usage: data?.usage, content_chars: text.length,
    reasoning_chars: choice?.message?.reasoning?.length ?? 0,
    raw_head: text ? undefined : raw.slice(0, 400),
  }));
  if (choice?.finish_reason === 'content_filter') throw new Error('Modellen afviste forespørgslen.');
  return { data, text, finish: choice?.finish_reason };
}

const KINDS = new Set(['advarsel', 'forslag', 'spoergsmaal']);
const OWNERS = new Set(['ledelse', 'teknik', 'faelles']);
const LAYERS = new Set(['ai', 'ork', 'gov', 'dwh', 'mdm', 'int']);

/** Uden strengt skema kan modellen afvige lidt; ret enum-værdier, trim tekst og cap på otte punkter. */
function normalise(raw: unknown): GuideResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { summary?: unknown; items?: unknown };
  if (typeof r.summary !== 'string' || !Array.isArray(r.items)) return null;
  const items: GuideItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    if (!title && !text) continue;
    const kind = String(o.kind ?? '').toLowerCase().replace('ø', 'oe');
    const owner = String(o.owner ?? '').toLowerCase().replace('æ', 'ae');
    const layer = typeof o.layer === 'string' ? o.layer.toLowerCase() : null;
    items.push({
      kind: (KINDS.has(kind) ? kind : 'forslag') as GuideItem['kind'],
      owner: (OWNERS.has(owner) ? owner : 'faelles') as GuideItem['owner'],
      title: title || text.slice(0, 60),
      text,
      layer: layer && LAYERS.has(layer) ? (layer as GuideItem['layer']) : null,
    });
    if (items.length === 8) break;
  }
  return { summary: r.summary.trim(), items };
}

function parseResult(text: string): GuideResult | null {
  if (!text.trim()) return null;
  try { return normalise(JSON.parse(extractJson(text))); }
  catch { return null; }
}

export async function runGuide(cfg: GuideConfig, req: GuideRequest): Promise<GuideResult> {
  if (!req || typeof req.brief !== 'string' || !req.brief.trim()) throw new Error('brief mangler');
  if (req.brief.length > 40_000) throw new Error('brief er for lang');
  if (!cfg.apiKey) throw new Error('OPENROUTER_API_KEY mangler');

  const model = cfg.model || DEFAULT_MODEL;
  const reasoning = cfg.reasoning ?? DEFAULT_REASONING;

  // Første forsøg med den ønskede reasoning. Nogle modeller ignorerer token-budgettet og tænker,
  // til tiden er gået, eller leverer tom eller halv JSON; så prøves én gang til uden reasoning,
  // før vi giver op. Tidsbudgettet er lagt, så begge forsøg tilsammen holder sig under gatewayens
  // grænse på omkring 60 sekunder.
  let attempt: Awaited<ReturnType<typeof callOpenRouter>> | null = null;
  let parsed: GuideResult | null = null;
  let why = '';
  try {
    attempt = await callOpenRouter(cfg, req, model, reasoning, reasoning === 'none' ? 50_000 : 30_000);
    parsed = parseResult(attempt.text);
    if (!parsed) why = 'unparsable';
    else if (!parsed.summary.trim() || parsed.items.length === 0) why = 'empty summary/items';
  } catch (e) {
    if (!(e instanceof GuideTimeout) || reasoning === 'none') throw e;
    why = 'timeout';
  }
  if (why && reasoning !== 'none') {
    console.log(JSON.stringify({ guide: 'retry', reason: why, finish: attempt?.finish }));
    attempt = await callOpenRouter(cfg, req, model, 'none', 22_000);
    parsed = parseResult(attempt.text);
  }
  if (!attempt) throw new GuideTimeout();

  if (!parsed) {
    if (attempt.finish === 'length') throw new Error('Svaret blev for langt og er afbrudt. Prøv med en kortere brief.');
    if (!attempt.text.trim()) throw new Error('Tomt svar fra modellen.');
    throw new Error('Modellen svarede ikke med gyldig JSON.');
  }
  return { ...parsed, model: attempt.data?.model || model };
}
