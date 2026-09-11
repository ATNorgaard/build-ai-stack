// Nyt indhold ud over det porterede katalog: roller, betalingsmodel, AI-behov og hensyn.
import type { LayerId } from './catalog';

export type RoleId = 'platform' | 'dataejer' | 'dpo' | 'oekonomi' | 'udvikler' | 'analytiker' | 'ml';
export const ROLE_LABELS: Record<RoleId, string> = {
  platform: 'Platformsingeniør (drift)',
  dataejer: 'Dataejer i forretningen',
  dpo: 'DPO / jurist (databehandleraftaler)',
  oekonomi: 'Økonomiansvarlig (forbrug)',
  udvikler: 'Udvikler',
  analytiker: 'Analytiker / SQL',
  ml: 'ML-/AI-ingeniør',
};

/** Roller organisationen skal kunne bemande for at bruge teknologien forsvarligt. */
export const ROLES: Record<string, RoleId[]> = {
  'azure-ai': ['udvikler', 'dpo', 'oekonomi'],
  copilot: ['dataejer', 'dpo'],
  databricks: ['ml', 'platform', 'oekonomi'],
  openai: ['udvikler', 'dpo', 'oekonomi'],
  claude: ['udvikler', 'dpo', 'oekonomi'],
  'aabne-modeller': ['ml', 'platform'],
  mlflow: ['ml', 'platform'],
  'fabric-pipelines': ['analytiker'],
  'dbt-cloud': ['analytiker', 'udvikler'],
  astronomer: ['udvikler'],
  airflow: ['platform', 'udvikler'],
  dagster: ['platform', 'udvikler'],
  purview: ['dataejer'],
  collibra: ['dataejer'],
  datahub: ['platform', 'dataejer'],
  openmetadata: ['platform', 'dataejer'],
  fabric: ['analytiker', 'oekonomi'],
  onelake: ['analytiker'],
  snowflake: ['analytiker', 'oekonomi'],
  clickhouse: ['platform', 'udvikler'],
  postgresql: ['platform'],
  dataverse: ['dataejer'],
  reltio: ['dataejer'],
  semarchy: ['dataejer', 'udvikler'],
  'egen-service': ['udvikler', 'platform', 'dataejer'],
  'data-factory': ['udvikler'],
  fivetran: ['analytiker', 'oekonomi'],
  airbyte: ['platform', 'udvikler'],
  kafka: ['platform', 'udvikler'],
};

export type CostModel = 'licens' | 'forbrug' | 'kapacitet' | 'arbejdstid';
export const COST_LABELS: Record<CostModel, string> = {
  licens: 'Fast licens', forbrug: 'Forbrug', kapacitet: 'Kapacitet', arbejdstid: 'Arbejdstid',
};
export const COST: Record<string, CostModel> = {
  'azure-ai': 'forbrug', copilot: 'licens', databricks: 'forbrug', openai: 'forbrug', claude: 'forbrug',
  'aabne-modeller': 'arbejdstid', mlflow: 'arbejdstid',
  'fabric-pipelines': 'kapacitet', 'dbt-cloud': 'licens', astronomer: 'licens', airflow: 'arbejdstid', dagster: 'arbejdstid',
  purview: 'forbrug', collibra: 'licens', datahub: 'arbejdstid', openmetadata: 'arbejdstid',
  fabric: 'kapacitet', onelake: 'kapacitet', snowflake: 'forbrug', clickhouse: 'arbejdstid', postgresql: 'arbejdstid',
  dataverse: 'licens', reltio: 'licens', semarchy: 'licens', 'egen-service': 'arbejdstid',
  'data-factory': 'forbrug', fivetran: 'forbrug', airbyte: 'arbejdstid', kafka: 'arbejdstid',
};

export type NeedLevel = 'kraevet' | 'anbefalet' | 'valgfri';
export const NEED_LABELS: Record<NeedLevel, string> = { kraevet: 'Kræves', anbefalet: 'Anbefales', valgfri: 'Valgfrit' };

export interface UseCase {
  id: string; name: string; kort: string; eksempel: string;
  needs: Record<LayerId, { level: NeedLevel; reason: string }>;
  /** Teknologier der typisk passer i AI-laget til dette behov. */
  aiFit: string[];
  /** Spørgsmål ledelsen bør kunne svare på, før behovet er reelt. */
  ledelse: string[];
}

export const USE_CASES: UseCase[] = [
  {
    id: 'historik', name: 'Spørg i historiske data',
    kort: 'En sprogmodel svarer på spørgsmål om salg, drift eller kunder ud fra jeres egne tal.',
    eksempel: '«Hvorfor faldt omsætningen i region Nord i marts?» – besvaret ud fra warehouset, ikke ud fra gæt.',
    needs: {
      ai: { level: 'kraevet', reason: 'Der skal være en model og en flade, brugeren spørger i.' },
      dwh: { level: 'kraevet', reason: 'Modellen kan kun svare rigtigt på data, der er samlet og gjort klar ét sted. Uden et datalag svarer den på det, den gætter.' },
      int: { level: 'kraevet', reason: 'Historikken skal ind fra kildesystemerne, før den kan spørges i.' },
      gov: { level: 'anbefalet', reason: 'Modellen skal vide, hvilke tal der er de officielle, og hvem der må se dem.' },
      ork: { level: 'anbefalet', reason: 'Svarene er kun så friske som sidste kørsel. Nogen skal styre, hvornår den var.' },
      mdm: { level: 'valgfri', reason: 'Bliver vigtigt, når «kunden» findes i flere systemer med forskellige navne.' },
    },
    aiFit: ['azure-ai', 'openai', 'claude', 'copilot', 'databricks'],
    ledelse: ['Hvilke beslutninger skal svarene bruges til?', 'Hvor gammel må data være, når der spørges?', 'Hvem må se hvilke tal?'],
  },
  {
    id: 'agenter', name: 'Agenter på tværs af SaaS-systemer',
    kort: 'AI udfører opgaver i CRM, økonomi og support – ikke kun svarer på spørgsmål.',
    eksempel: 'En agent opretter sagen i supportsystemet, opdaterer kunden i CRM og lægger en note i økonomisystemet.',
    needs: {
      ai: { level: 'kraevet', reason: 'Agenten skal have en model, der kan planlægge og kalde værktøjer.' },
      int: { level: 'kraevet', reason: 'Agenten kan kun handle i systemer, den har en vej ind i. Integrationslaget er dens hænder – via API eller hændelser.' },
      gov: { level: 'kraevet', reason: 'En agent, der kan handle, skal have tydelige rettigheder. Hvad må den ændre, og hvem godkender?' },
      ork: { level: 'anbefalet', reason: 'Flere trin på tværs af systemer skal kunne genoptages, når ét trin fejler.' },
      mdm: { level: 'anbefalet', reason: 'Agenten skal vide, at kunden i CRM og kunden i økonomi er den samme.' },
      dwh: { level: 'valgfri', reason: 'Kun nødvendigt, hvis agenten også skal analysere historik.' },
    },
    aiFit: ['azure-ai', 'openai', 'claude', 'copilot'],
    ledelse: ['Hvilke handlinger må agenten udføre uden et menneske?', 'Hvem har ansvaret, når agenten gør noget forkert?', 'Hvilke systemer skal den have adgang til?'],
  },
  {
    id: 'dokumenter', name: 'Assistent over interne dokumenter',
    kort: 'Spørg i håndbøger, kontrakter, procedurer og referater og få svar med kilde.',
    eksempel: 'En ny medarbejder spørger «hvordan håndterer vi reklamationer over 10.000 kr.?» og får svar med link til proceduren.',
    needs: {
      ai: { level: 'kraevet', reason: 'Model plus søgning i dokumenterne (RAG).' },
      gov: { level: 'kraevet', reason: 'Assistenten ser det, brugeren må se. Er rettighederne på dokumenterne forkerte, lækker den dem.' },
      int: { level: 'anbefalet', reason: 'Dokumenterne skal hentes fra SharePoint, drev eller sagssystem – og holdes opdaterede.' },
      ork: { level: 'valgfri', reason: 'Kun for at holde indekset friskt, når dokumenter ændres.' },
      dwh: { level: 'valgfri', reason: 'Ikke nødvendigt for dokumenter alene. Et vektorindeks er ikke et data warehouse.' },
      mdm: { level: 'valgfri', reason: 'Sjældent relevant for dokumentsøgning.' },
    },
    aiFit: ['azure-ai', 'copilot', 'openai', 'claude'],
    ledelse: ['Hvilke dokumenter er de gældende – og hvem ejer dem?', 'Må assistenten svare på personfølsomt indhold?', 'Hvad sker der, når svaret er forkert?'],
  },
  {
    id: 'forudsigelse', name: 'Forudsigelser og klassisk ML',
    kort: 'Kundeafgang, efterspørgsel, fejl på udstyr – modeller trænet på jeres historik.',
    eksempel: 'Hver mandag får salg en liste over de 50 kunder med størst risiko for at opsige.',
    needs: {
      ai: { level: 'kraevet', reason: 'Model, træning og et sted, forudsigelsen bliver brugt.' },
      dwh: { level: 'kraevet', reason: 'Modeller trænes på samlede, rensede historiske data.' },
      ork: { level: 'kraevet', reason: 'Træning, scoring og levering skal køre i fast rækkefølge – hver uge, hver nat.' },
      int: { level: 'kraevet', reason: 'Data skal ind, og forudsigelsen skal ud til det system, der bruger den.' },
      gov: { level: 'anbefalet', reason: 'Hvem ejer definitionen af «afgang» – og hvem ser, når modellen driver?' },
      mdm: { level: 'anbefalet', reason: 'Én kunde, ét ID. Ellers scores samme kunde tre gange.' },
    },
    aiFit: ['databricks', 'mlflow', 'aabne-modeller', 'azure-ai'],
    ledelse: ['Hvad gør vi konkret anderledes med en forudsigelse?', 'Hvor præcis skal den være, før vi stoler på den?', 'Hvem følger op, når modellen tager fejl?'],
  },
  {
    id: 'copilot', name: 'Copilot i værktøjer, I allerede har',
    kort: 'Assistent i Office, Power BI eller Fabric – uden egen udvikling.',
    eksempel: 'En controller beder Copilot i Excel om at opsummere månedens afvigelser.',
    needs: {
      ai: { level: 'kraevet', reason: 'Copilot er AI-laget – købt, ikke bygget.' },
      gov: { level: 'kraevet', reason: 'Copilot ser alt, brugeren må se. Oprydning i rettigheder kommer før licensen.' },
      dwh: { level: 'valgfri', reason: 'Copilot i Power BI/Fabric bliver først nyttig, når data ligger samlet der.' },
      int: { level: 'valgfri', reason: 'Ikke nødvendigt for Office-brugen.' },
      ork: { level: 'valgfri', reason: 'Ikke nødvendigt.' },
      mdm: { level: 'valgfri', reason: 'Ikke nødvendigt.' },
    },
    aiFit: ['copilot'],
    ledelse: ['Hvilken Copilot mener vi – M365, Fabric eller Studio?', 'Hvad koster licensen pr. bruger pr. år?', 'Er rettighederne på vores dokumenter i orden?'],
  },
  {
    id: 'kundeservice', name: 'Kundevendt chatbot',
    kort: 'Kunder får svar om ordrer, levering og vilkår døgnet rundt.',
    eksempel: '«Hvor er min ordre?» besvares med den faktiske status fra ordresystemet – ikke et generisk svar.',
    needs: {
      ai: { level: 'kraevet', reason: 'Model og en brugerflade, kunden møder.' },
      int: { level: 'kraevet', reason: 'Botten skal slå op i ordre- og kundesystemer i realtid for at svare konkret.' },
      gov: { level: 'kraevet', reason: 'Botten taler med kunder. Hvad må den sige, og hvad må den aldrig udlevere?' },
      mdm: { level: 'anbefalet', reason: 'Botten skal vide, hvem kunden er – på tværs af webshop, CRM og økonomi.' },
      ork: { level: 'valgfri', reason: 'Kun hvis botten skal starte processer bagefter.' },
      dwh: { level: 'valgfri', reason: 'Ikke nødvendigt for opslag i realtid.' },
    },
    aiFit: ['azure-ai', 'openai', 'claude'],
    ledelse: ['Hvad skal botten kunne, som kunden ikke kan finde selv?', 'Hvornår skal den sende videre til et menneske?', 'Hvad er omkostningen ved et forkert svar til en kunde?'],
  },
];

export type PriorityId = 'enkel-drift' | 'dataplacering' | 'pris' | 'fleksibilitet' | 'kapacitet' | 'hurtig-start';
export interface Priority { id: PriorityId; label: string; kort: string; }
export const PRIORITIES: Priority[] = [
  { id: 'enkel-drift', label: 'Enkel drift', kort: 'Få ting, vi selv skal passe.' },
  { id: 'dataplacering', label: 'Data bliver hos os', kort: 'Data må ikke forlade EU eller vores aftaler.' },
  { id: 'pris', label: 'Forudsigelig pris', kort: 'Hellere fast regning end forbrug, der svinger.' },
  { id: 'fleksibilitet', label: 'Frihed til at skifte', kort: 'Ingen enkelt leverandør må eje alt.' },
  { id: 'kapacitet', label: 'Få interne kræfter', kort: 'Vi har ikke platformsfolk at sætte af.' },
  { id: 'hurtig-start', label: 'Hurtigt i gang', kort: 'Værdi inden for få måneder.' },
];
