// Regelmotoren: oversætter en løsning til beskeder (konsekvenser, overlap, blinde punkter,
// AI-behov og spændinger mellem ledelsens hensyn og teknikernes valg). Ingen score – kun beskeder.
import { LAYERS, TECHS, OSS, VENDOR, PAIR_NOTES, TRADE, type LayerId, type Tech } from './catalog';
import { COST, ROLES, USE_CASES, type CostModel, type RoleId, type PriorityId } from './extra';

export type Role = 'primaer' | 'supplement';
export type ItemStatus = 'planlagt' | 'eksisterende';
export interface StackItem { id: string; role: Role; status: ItemStatus }
export type Layers = Record<LayerId, StackItem[]>;

export type Owner = 'ledelse' | 'teknik' | 'faelles';
export const OWNER_LABELS: Record<Owner, string> = { ledelse: 'Ledelse', teknik: 'Teknik', faelles: 'Fælles' };

export type Tag = 'samlet' | 'overlap' | 'samspil' | 'afklaring' | 'blindt' | 'mangler' | 'rolle' | 'behov' | 'spaending';
export const TAG_LABELS: Record<Tag, string> = {
  samlet: 'Samlet billede', overlap: 'Muligt overlap', samspil: 'Samspil i stakken', afklaring: 'Afklaring nødvendig',
  blindt: 'Blindt punkt', mangler: 'Manglende beskrivelse', rolle: 'Rolle dækket', behov: 'AI-behov', spaending: 'Spænding',
};
/** Hvem der som udgangspunkt skal svare på en besked af den type. */
export const TAG_OWNER: Record<Tag, Owner> = {
  samlet: 'ledelse', overlap: 'teknik', samspil: 'teknik', afklaring: 'faelles', blindt: 'ledelse',
  mangler: 'ledelse', rolle: 'teknik', behov: 'faelles', spaending: 'ledelse',
};

export interface Msg { key: string; tag: Tag; text: string; owner: Owner; layer?: LayerId }

export interface SolutionInput {
  layers: Layers;
  useCases: string[];
  priorities: PriorityId[];
}

export function emptyLayers(): Layers {
  const o = {} as Layers;
  LAYERS.forEach((l) => (o[l.id] = []));
  return o;
}

export function techById(id: string): (Tech & { vh: string; uh: string }) | undefined {
  const t = TECHS.find((x) => x.id === id);
  if (!t) return undefined;
  const tr = TRADE[id] || { v: '', u: '' };
  return { ...t, vh: tr.v ? 'Vælg det, hvis ' + tr.v : '', uh: tr.u ? 'Undgå det, hvis ' + tr.u : '' };
}
export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
/** Lagets navn i løbende tekst: «AI-løsning» beholder sine versaler, «Governance» bliver «governance». */
export const lbl = (id: LayerId) => {
  const s = layerById(id).label;
  return /^[A-ZÆØÅ]{2,}/.test(s) ? s : s.toLowerCase();
};
const nm = (id: string) => techById(id)?.n ?? id;

export interface Profile {
  uniq: string[]; covered: number; self: string[]; vendors: string[]; fabricLayers: number;
  existing: string[]; planned: string[];
  roles: RoleId[]; cost: Record<CostModel, string[]>;
}

export function profile(L: Layers): Profile {
  const all: StackItem[] = [];
  (Object.keys(L) as LayerId[]).forEach((k) => (L[k] || []).forEach((x) => all.push(x)));
  const uniq = [...new Set(all.map((x) => x.id))];
  const covered = LAYERS.filter((l) => (L[l.id] || []).length).length;
  const self = uniq.filter((id) => OSS.includes(id));
  const vendors = [...new Set(uniq.map((id) => VENDOR[id]).filter((v) => v && !['Open source', '—', 'Jer selv'].includes(v)))];
  const fabricLayers = LAYERS.filter((l) => (L[l.id] || []).some((x) => techById(x.id)?.pf === 'Microsoft Fabric')).length;
  const existing = [...new Set(all.filter((x) => x.status === 'eksisterende').map((x) => x.id))];
  const planned = uniq.filter((id) => !existing.includes(id));
  const roles = [...new Set(uniq.flatMap((id) => ROLES[id] || []))];
  const cost: Record<CostModel, string[]> = { licens: [], forbrug: [], kapacitet: [], arbejdstid: [] };
  uniq.forEach((id) => { const c = COST[id]; if (c) cost[c].push(id); });
  return { uniq, covered, self, vendors, fabricLayers, existing, planned, roles, cost };
}

export function messages(input: SolutionInput): Msg[] {
  const { layers: L, useCases, priorities } = input;
  const out: Msg[] = [];
  const has = (id: string) => (Object.keys(L) as LayerId[]).some((k) => L[k].some((x) => x.id === id));
  const inL = (l: LayerId, id: string) => (L[l] || []).some((x) => x.id === id);
  const both = (a: string, b: string) => has(a) && has(b);
  const push = (tag: Tag, text: string, key: string, layer?: LayerId) => out.push({ tag, text, key, owner: TAG_OWNER[tag], layer });
  const P = profile(L);
  const n = P.uniq.length;

  // ---- AI-behov: hvad løsningen skal kunne, og hvad det kræver af lagene ----
  useCases.forEach((ucId) => {
    const uc = USE_CASES.find((u) => u.id === ucId);
    if (!uc) return;
    (Object.keys(uc.needs) as LayerId[]).forEach((lid) => {
      const need = uc.needs[lid];
      const filled = (L[lid] || []).length > 0;
      if (need.level === 'kraevet' && !filled)
        push('behov', `«${uc.name}» kræver laget «${layerById(lid).label}», men det er tomt. ${need.reason}`, `uc-${uc.id}-${lid}`, lid);
      else if (need.level === 'anbefalet' && !filled)
        push('behov', `«${uc.name}» fungerer sjældent godt uden ${lbl(lid)}. ${need.reason} Er det bevidst udeladt?`, `uc-${uc.id}-${lid}`, lid);
    });
    const aiIds = (L.ai || []).map((x) => x.id);
    if (aiIds.length && !aiIds.some((id) => uc.aiFit.includes(id)))
      push('behov', `Ingen af valgene i AI-laget (${aiIds.map(nm).join(', ')}) er det typiske match til «${uc.name}». Typiske valg: ${uc.aiFit.map(nm).join(', ')}. Forklar, hvordan jeres valg dækker behovet.`, `uc-${uc.id}-fit`, 'ai');
    if (uc.id === 'agenter' && L.int.length && !has('kafka') && L.int.every((x) => ['fivetran', 'airbyte', 'data-factory'].includes(x.id)))
      push('behov', 'Agenter skal handle i systemerne i nuet. Integrationslaget består kun af planlagt replikering (kopier ind i platformen) – det giver agenten øjne, ikke hænder. Hvem leverer API-adgangen, agenten skal bruge?', 'uc-agenter-api', 'int');
    if (uc.id === 'historik' && L.dwh.length && L.dwh.every((x) => x.id === 'postgresql'))
      push('behov', 'PostgreSQL alene som datalag til historiske spørgsmål bliver langsomt, når spørgsmålene bliver tunge. Det er en driftsdatabase. Er datamængden lille nok til, at det holder?', 'uc-historik-pg', 'dwh');
    if (uc.id === 'copilot' && !has('copilot'))
      push('behov', 'Behovet er Copilot i eksisterende værktøjer, men Copilot er ikke valgt i AI-laget. Er det Copilot, I mener – eller en egen assistent?', 'uc-copilot-missing', 'ai');
  });
  if (!useCases.length && n >= 2)
    push('behov', 'Der er ikke valgt et AI-behov. Uden et konkret behov kan ingen sige, om lagene er de rigtige – vælg mindst ét under «Hvad skal AI kunne?».', 'uc-none');

  // ---- Spændinger: ledelsens hensyn mod teknikernes valg ----
  const consumption = ['fabric', 'databricks', 'snowflake', 'openai', 'claude', 'azure-ai', 'fivetran'].filter(has);
  if (priorities.includes('enkel-drift') && P.self.length >= 3)
    push('spaending', `Hensyn: enkel drift. Men I drifter selv ${P.self.length} komponenter (${P.self.map(nm).join(', ')}). Enten er hensynet ikke reelt, eller også skal nogle af dem købes som tjeneste.`, 'sp-drift');
  if (priorities.includes('kapacitet') && P.self.length >= 2)
    push('spaending', `Hensyn: få interne kræfter. Alligevel kræver løsningen ${P.roles.includes('platform') ? 'en platformsingeniør' : 'egne folk'} til ${P.self.map(nm).join(', ')}. Hvem er det konkret – og hvad laver de ikke imens?`, 'sp-kapacitet');
  if (priorities.includes('dataplacering') && (has('openai') || has('claude')) && !has('azure-ai'))
    push('spaending', 'Hensyn: data bliver hos os. Men modellen kaldes direkte hos OpenAI eller Anthropic. Det kan være i orden med den rette aftale – men det skal ledelsen beslutte, ikke opdage.', 'sp-data');
  if (priorities.includes('pris') && consumption.length >= 2)
    push('spaending', `Hensyn: forudsigelig pris. Men ${consumption.length} komponenter betales efter forbrug (${consumption.map(nm).join(', ')}). Aftal et loft og en person, der ser regningen ugentligt.`, 'sp-pris');
  if (priorities.includes('fleksibilitet') && P.vendors.length === 1 && !P.self.length && n >= 3)
    push('spaending', `Hensyn: frihed til at skifte. Men alt ligger hos ${P.vendors[0]}. Det er et bevidst valg af enkelhed over frihed – sig det højt.`, 'sp-fleks');
  if (priorities.includes('hurtig-start') && (has('egen-service') || P.self.length >= 3 || has('collibra')))
    push('spaending', 'Hensyn: hurtigt i gang. Men løsningen indeholder komponenter, der først giver værdi efter måneders opsætning (egenudvikling, selvdrift eller en governance-proces). Hvad er det første, der kan stå om otte uger?', 'sp-hurtig');

  // ---- Samlet billede ----
  if (n >= 2) {
    if (P.vendors.length === 1 && !P.self.length)
      push('samlet', `Alt ligger hos ${P.vendors[0]}. Det gør hverdagen enkel – én aftale, ét sted at spørge – og binder samtidig ${P.covered} lag til den samme køreplan og prisstruktur.`, 's-vendor');
    else if (P.vendors.length >= 4)
      push('samlet', `${P.vendors.length} leverandøraftaler (${P.vendors.join(', ')}). Hvert lag er valgt for sig, men nogen skal holde sammen på aftaler, opgraderinger og fejl, der falder mellem to leverandører.`, 's-vendor');
    else if (P.vendors.length && P.self.length)
      push('samlet', `${P.vendors.length} købte aftaler og ${P.self.length} komponenter, I selv drifter. Det er en blandet model: omkostningen er dels licens, dels arbejdstid – beslut hvilken af de to I helst vil betale med.`, 's-vendor');
    if (P.self.length >= 4)
      push('samlet', `I drifter selv ${P.self.length} komponenter (${P.self.map(nm).join(', ')}). Ingen licens, men opgraderinger, overvågning og vagt ligger hos jer. Det forudsætter mindst én person med platformskompetence – ikke kun analytikere.`, 's-drift');
    else if (!P.self.length && n >= 4)
      push('samlet', 'Ingen af komponenterne drives af jer selv. Driftsbyrden er lav, og omkostningen ligger i licenser og forbrug, der følger brugen opad.', 's-drift');
    if (P.fabricLayers >= 2)
      push('samlet', `Fabric-moduler optræder i ${P.fabricLayers} lag. Det er én platform og én kapacitet – ikke ${P.fabricLayers} indkøb. Til gengæld afhænger ${P.fabricLayers} lag af samme leverandørs køreplan.`, 's-fabric');
    if (P.existing.length && P.planned.length)
      push('samlet', `${P.existing.length} komponenter findes allerede, ${P.planned.length} er nye (${P.planned.map(nm).join(', ')}). Det nye skal kobles på det gamle – hvem ejer overgangen?`, 's-existing');
  }

  // ---- Overlap ----
  if (both('dagster', 'fabric-pipelines')) push('overlap', 'Både Dagster og Fabric pipelines kan koordinere processer. Hvordan deler de ansvaret?', 'o1', 'ork');
  if (both('airflow', 'dagster')) push('overlap', 'Du har valgt to orkestreringsværktøjer. Hvorfor begge – og hvem ejer det samlede forløb?', 'o2', 'ork');
  if (both('airbyte', 'kafka')) push('overlap', 'Airbyte replikerer på plan, Kafka transporterer hændelser løbende. De kan supplere hinanden – beskriv hvilke data der går hvilken vej.', 'o3', 'int');
  if (both('airbyte', 'fivetran')) push('overlap', 'Fivetran og Airbyte løser samme opgave. Er det en overgangsperiode eller en bevidst deling?', 'o4', 'int');
  if (both('clickhouse', 'postgresql')) push('overlap', 'ClickHouse svarer hurtigt på analyse, PostgreSQL holder styr på transaktionerne. Beskriv arbejdsdelingen.', 'o5', 'dwh');
  if (both('collibra', 'datahub') || both('collibra', 'openmetadata')) push('overlap', 'Du har både et forretningskatalog og et teknisk katalog. Hvem bruger hvilket – og hvor står den officielle definition?', 'o6', 'gov');
  if (has('purview') && (has('collibra') || has('datahub') || has('openmetadata'))) push('overlap', 'Purview og et åbent katalog dækker delvist samme behov. Hvad kan det ene, som det andet ikke skal?', 'o7', 'gov');
  if (both('fabric', 'snowflake')) push('overlap', 'Fabric og Snowflake kan begge være analyseplatform. Hvilke data ligger hvor – og hvem beslutter det?', 'o8', 'dwh');
  if (both('data-factory', 'fabric-pipelines')) push('overlap', 'Data Factory og Fabric pipelines kan begge flytte data. Er det Azure Data Factory eller Data Factory i Fabric, I mener?', 'o9', 'int');

  // ---- Samspil ----
  if (both('fabric', 'dbt-cloud')) push('samspil', 'Fabric har egne notebooks og dataflows til transformation. dbt oven på Fabric er muligt, men I får to måder at skrive forretningslogik. Vælg én som den officielle.', 'k-fabric-dbt');
  if (both('fabric', 'copilot')) push('samspil', 'Copilot i Fabric ser det, brugeren må se. Rettighederne i Fabric er dermed også rettighederne i AI-svaret – de skal være rigtige, før nogen spørger.', 'k-fabric-copilot');
  if (both('snowflake', 'dbt-cloud')) push('samspil', 'Snowflake og dbt er en velafprøvet parring: Snowflake regner, dbt bestemmer hvad. Det svage punkt er forbruget – dbt-kørsler, der starter for tit, bliver til Snowflake-kredit.', 'k-snow-dbt');
  if (both('databricks', 'mlflow')) push('samspil', 'Databricks indeholder allerede MLflow. Et separat MLflow ved siden af giver to logbøger – brug den indbyggede, medmindre andre teams uden Databricks skal skrive til den.', 'k-dbx-mlflow');
  if (both('databricks', 'snowflake')) push('samspil', 'Databricks til modeller, Snowflake til analyse er en almindelig arbejdsdeling. Den koster en kopi af data mellem de to – beslut hvem der ejer den, og hvor tit den opdateres.', 'k-dbx-snow');
  if (both('kafka', 'clickhouse')) push('samspil', 'Kafka ind, ClickHouse ud: det er opsætningen til realtidsdashboards. Forudsætter at nogen definerer, hvad en hændelse er, før den første strøm kobles på.', 'k-kafka-ch');
  if (has('kafka') && (has('snowflake') || has('fabric'))) push('samspil', 'Kafka leverer løbende, men warehouset optager typisk i portioner. Aftal forsinkelsen – er 5 minutter realtid nok, eller lover nogen sekunder?', 'k-kafka-dwh');
  if ((has('openai') || has('claude')) && !has('azure-ai') && has('fabric')) push('samspil', 'Data ligger i Fabric hos Microsoft, men modellen kaldes hos en anden leverandør. Det er to databehandleraftaler for én løsning – juridisk skal begge være på plads.', 'k-llm-fabric');
  if (both('azure-ai', 'openai')) push('samspil', 'Azure AI giver adgang til OpenAI-modeller under Microsofts aftale. Direkte OpenAI ved siden af betyder samme modeller under to aftaler – det er sjældent tilsigtet.', 'k-azure-openai');
  if (both('purview', 'fabric')) push('samspil', 'Purview og Fabric er bygget til hinanden: følsomhedsmærker følger med data over i rapporterne. Gevinsten kræver, at nogen faktisk mærker data – værktøjet gør det ikke selv.', 'k-purview-fabric');
  if (both('fivetran', 'dbt-cloud')) push('samspil', 'Fivetran henter, dbt beregner – en klassisk arbejdsdeling. Det åbne spørgsmål er, hvad der starter dbt, når Fivetran er færdig. Uden orkestrering bliver det et klokkeslæt og et håb.', 'k-fivetran-dbt');
  if ((has('reltio') || has('semarchy')) && L.ai.length) push('samspil', 'Master data under AI er en stærk kombination: modellen svarer om den rigtige kunde. Men kun hvis AI-løsningen faktisk læser fra MDM og ikke fra kildesystemerne direkte – tjek datastrømmen.', 'k-mdm-ai');
  if (both('dataverse', 'fabric')) push('samspil', 'Dataverse kan spejles direkte ind i OneLake uden pipelines. Det fjerner et integrationstrin – og gør Dataverses datamodel til jeres analysemodel, om I vil det eller ej.', 'k-dataverse-fabric');
  if (both('astronomer', 'airflow')) push('samspil', 'Astronomer er Airflow. Begge valgt betyder enten en overgang fra egen drift til købt – eller en misforståelse. Beskriv hvilken.', 'k-astro-airflow');
  if ((has('airflow') || has('dagster') || has('astronomer')) && has('fabric') && !has('fabric-pipelines')) push('samspil', 'Ekstern orkestrering styrer Fabric udefra. Det virker, men fejl ses to steder: i orkestreringen og i Fabric. Aftal hvor man kigger først.', 'k-ork-fabric');

  // ---- Afklaring ----
  if (has('aabne-modeller')) push('afklaring', 'Du har valgt åbne modeller. Hvor skal modellerne køres – hos en leverandør, i jeres eget cloud-miljø eller på egne maskiner?', 'a1', 'ai');
  if (L.ai.length === 1 && L.ai[0].id === 'mlflow') push('afklaring', 'MLflow alene i AI-laget styrer modeller, men er hverken en model eller en brugerrettet AI-app. Hvad er det, brugeren møder?', 'a2', 'ai');
  if (inL('mdm', 'dataverse')) push('afklaring', 'Dataverse opbevarer kerneoplysninger, men giver ikke automatisk komplet master data management. Hvem afgør, hvad der er den rigtige kunde?', 'a3', 'mdm');
  if (has('egen-service')) push('afklaring', 'Vælg ambitionsniveau for jeres egen masterdataservice: fælles ID’er, validering – eller også matchning og godkendelsesprocesser?', 'a4', 'mdm');
  if (has('copilot')) push('afklaring', 'Copilot dækker flere forskellige produkter. Hvilken mener I – Microsoft 365, Copilot i Fabric eller Copilot Studio?', 'a5', 'ai');

  // ---- Blinde punkter (højst fem – de vigtigste først) ----
  const blind: Msg[] = [];
  const bp = (text: string, key: string, layer?: LayerId) => blind.push({ tag: 'blindt', text, key, owner: 'ledelse', layer });
  if (L.ai.length && !L.dwh.length && !useCases.every((u) => ['dokumenter', 'copilot', 'agenter', 'kundeservice'].includes(u)))
    bp('AI-laget er valgt, men ikke stedet hvor data samles. Hvor henter løsningen sin viden fra – og hvem sørger for, at den er opdateret?', 'b-ai-dwh', 'dwh');
  if (L.ai.length && !L.gov.length) bp('Der er ingen governance i løsningen. Hvem svarer på, hvilke data modellen må se – og hvem der må se svarene?', 'b-ai-gov', 'gov');
  if (L.ai.length) bp('Hvem har ansvar for at måle, om AI-svarene er gode nok – og om de bliver dårligere over tid? Det er en rolle, ikke et produkt. Beslut hvem der kigger, og hvor ofte, før løsningen går i drift.', 'b-ai-eval', 'ai');
  if (L.ai.length && (has('openai') || has('claude') || has('azure-ai'))) bp('Forbruget på sprogmodeller følger antallet af kald, ikke antallet af brugere. Hvem ser regningen, før den er kommet – og hvem må sige stop?', 'b-ai-cost', 'ai');
  if (L.int.length && !L.ork.length) bp('Data kommer ind, men ingen styrer rækkefølgen. Hvad sker der, når indlæsningen fejler kl. 03 – og hvem opdager det, før rapporterne åbnes kl. 08?', 'b-int-ork', 'ork');
  if (L.dwh.length && !L.int.length) bp('Der er en platform, men ingen vej ind. Hvordan kommer data derhen – manuelt, med scripts nogen har skrevet, eller er det ikke besluttet endnu?', 'b-dwh-int', 'int');
  if (n >= 3 && !L.gov.length) bp('Tre eller flere komponenter og ingen fælles fortegnelse over, hvad der findes. Om et år ved ingen, hvilken tabel der er den rigtige. Hvem ejer definitionerne?', 'b-no-gov', 'gov');
  if (L.gov.length && !L.mdm.length && (L.ai.length || L.dwh.length)) bp('Kataloget beskriver data, men ingen ejer sandheden om kunden eller produktet. Når to systemer er uenige, hvem har ret?', 'b-gov-mdm', 'mdm');
  if (L.ai.length && L.dwh.length && !has('kafka') && !L.ork.length) bp('AI-løsningen svarer på det, der lå i platformen ved sidste kørsel. Uden orkestrering ved ingen, hvornår det var. Sæt en dato på svarene.', 'b-ai-fresh', 'ork');
  if (has('dbt-cloud') && !L.dwh.length) bp('dbt beregner inde i jeres warehouse. Uden en analyseplatform i laget nedenunder har dbt ikke noget at arbejde på.', 'b-dbt', 'dwh');
  if (has('kafka')) bp('Hændelser i realtid stiller krav i den anden ende: kan warehouse, rapporter og modtagersystemer overhovedet tage imod løbende – eller lander alt alligevel i en natlig kørsel?', 'b-stream', 'int');
  if (L.gov.length) bp('Et katalog fortæller, hvad der findes – ikke om det er rigtigt. Datakvalitet er ikke et af de seks lag. Beslut, hvor den opgave hører hjemme, før nogen regner med tallene.', 'b-kvalitet', 'gov');
  if (['fabric', 'databricks', 'snowflake'].filter(has).length >= 2) bp('To forbrugsbaserede platforme betyder to regninger, der begge svinger med brugen. Aftal, hvem der følger forbruget – det er sjældent den, der starter forespørgslerne.', 'b-cost', 'dwh');
  if (has('egen-service') && L.ai.length) bp('AI ovenpå selvbygget master data: svarene bliver kun så præcise som jeres egne regler for, hvem kunden er.', 'b-mdm-ai', 'mdm');
  if (P.covered === 6 && P.uniq.length === 6) bp('Ét produkt i hvert lag er en ren opsætning. Tjek, at ingen funktion falder mellem to lag – typisk datakvalitet, adgangsstyring og test af det, der bliver leveret.', 'b-tynd');
  blind.slice(0, 5).forEach((b) => out.push(b));

  // ---- Manglende beskrivelse og roller ----
  // Tomme lag meldes først, når der er valgt noget – et tomt lærred skal ikke starte med seks åbne punkter.
  if (n > 0) LAYERS.forEach((l) => { if (!(L[l.id] || []).length) push('mangler', l.mangler, 'm-' + l.id, l.id); });
  LAYERS.forEach((l) => {
    const items = L[l.id] || []; if (!items.length) return;
    const p = items.find((x) => x.role === 'primaer') || items[0];
    const rest = items.filter((x) => x.id !== p.id);
    let t = `Du har valgt ${nm(p.id)} som ${l.rolle}${p.status === 'eksisterende' ? ' (findes allerede)' : ''}.`;
    if (rest.length) t += ' ' + rest.map((x) => nm(x.id)).join(' og ') + ' supplerer.';
    push('rolle', t, 'r-' + l.id, l.id);
  });
  return out;
}

export interface CmpRow { q: string; a: string; b?: string; split: boolean }
export function cmpRows(a: Tech, b: Tech): CmpRow[] {
  const key = [a.id, b.id].sort().join('|');
  const note = PAIR_NOTES[key];
  const same = a.l === b.l;
  return [
    { q: 'Hvilken opgave løser de?', a: a.op, b: b.op, split: true },
    { q: 'Er de alternativer eller supplementer?', a: note || (same ? 'Samme lag – behandl dem som alternativer, medmindre I bevidst deler ansvaret mellem dem.' : 'Forskellige lag. De løser hver sin opgave og kan sagtens stå sammen i den samme løsning.'), split: false },
    { q: 'Hvad skal vi selv udvikle eller drifte?', a: a.an, b: b.an, split: true },
    { q: 'Hvad er den vigtigste forskel?', a: a.fv, b: b.fv, split: true },
    { q: 'Hvilke oplysninger mangler, før vi kan vælge?', a: 'Typisk tre ting: hvor meget data der reelt er, hvem der skal drifte det til daglig, og hvilke krav der gælder for, hvor data må ligge.', split: false },
  ];
}
