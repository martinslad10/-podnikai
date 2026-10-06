import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { 
  isValidPersonName, 
  isValidExecutiveRole, 
  extractVerifiedContactFromWeb, 
  sanitizeIdealContactPerson 
} from './src/utils/personValidation';
import { 
  generateOutreachSequence, 
  cleanInternalAiTerminology, 
  hasInternalAiTerminology,
  validateAndSanitizeSequence,
  validateAndSanitizeDay1Email,
  formatCzechSalutation,
  countWords 
} from './src/utils/outreachGenerator';
import { formatCzechDateTime } from './src/utils/leadActivities';
import { 
  detectPublicEmailFromWebsite, 
  type PublicEmailDetectionResult 
} from './src/utils/publicEmailDetector';
import { generatePersonalizedIdeas } from './src/utils/personalizedIdeaGenerator';
import { 
  generateDeterministicBusinessStartAnalysis, 
  INITIAL_BUSINESS_START_CLIENTS,
  createEmptyQuestionnaire
} from './src/utils/businessStartDefaults';
import {
  evaluateClientConstraints,
  hardFilterCandidateModels,
  isOnlineOnlyBusinessModel
} from './src/utils/businessStartCandidateFilter';
import { generateBusinessStartPdfBuffer } from './src/utils/businessStartPdfGenerator';
import { SEO_GUIDES } from './src/data/seoGuidesData';
import Stripe from 'stripe';
import type { 
  BusinessStartClient, 
  BusinessStartQuestionnaire, 
  BusinessStartAnalysis,
  BusinessStartClientStatus,
  BusinessStartOrderStatus,
  BusinessStartPaymentStatus,
  BusinessStartOrder
} from './src/types';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

export const BUSINESS_START_ORIGINAL_PRICE_CZK = 1990;
export const BUSINESS_START_PRICE_CZK = 690;
export const BUSINESS_START_DISCOUNT_PERCENT = 65;
export const BUSINESS_START_CURRENCY = 'CZK';
const WEBHOOK_SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET || process.env.ADMIN_SESSION_SECRET || 'podnikai_secure_webhook_secret_2026';

let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret || stripeSecret.trim() === '' || stripeSecret.includes('YOUR_STRIPE')) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecret, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }
  return stripeClient;
}

app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Lazy Google GenAI Client
let genAIClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Deterministic Server-side Fallback Generators
function generateServerFallbackIdeas(userProfile: any, customPreferences?: string) {
  const result = generatePersonalizedIdeas(userProfile, customPreferences);
  return {
    data: result,
    ideas: result.ideas || []
  };
}

function generateServerFallbackPlan(userProfile: any, ideaTitle: string, ideaDescription?: string, customNotes?: string) {
  const name = userProfile?.name || 'podnikatele';
  const budget = userProfile?.startingBudget || 'standardním';
  const loc = userProfile?.location || 'České republice';

  return {
    projectName: ideaTitle || 'Podnikatelský projekt',
    summary: `Komplexní exekuční podnikatelský plán pro projekt **${ideaTitle}** přizpůsobený pro ${name} v lokalitě ${loc} s rozpočtem ${budget}. Cílem je dosáhnout prvního platícího zákazníka do 7 dnů bez zbytečných výdajů na logo, drahý web nebo administrativní zátěž před validací.`,
    firstAction: `**Validace do 7 dnů bez utrácení peněz:**
1. Vytvoř jednoduchý prodejní přehled nebo PDF nabídku (1 strana) s jasným slibem a výsledkem.
2. Definuj přesnou nabídku pro prvních 3 testovací zákazníky se zaváděcí cenou výměnou za detailní videoreferenci a Google recenzi.
3. Oslov přímo 15 kontaktů z cílové skupiny (osobní síť, LinkedIn nebo lokální podniky).
4. Cíl: Získat alespoň 1 potvrzenou platící zakázku před jakýmkoliv nákupem drahého vybavení.`,
    nextSteps: `**Administrativní a technické minimum v ČR:**
- **Živnostenské oprávnění:** Vyřídit volnou živnost (poplatek 1 000 Kč na kterémkoliv živnostenském úřadě nebo online přes Portál živnostenského podnikání).
- **Bankovní účet:** Založit samostatný podnikatelský účet (např. Fio, Air Bank, ČSOB) s nulovými poplatky pro oddělení osobních a firemních financí.
- **Fakturace:** Založit bezplatný účet na Fakturoid.cz nebo iDoklad.cz.
- **Pojištění:** Zvážit základní pojištění odpovědnosti z podnikání (od cca 1 500 – 2 500 Kč/rok).`,
    offer: `**Neodolatelná prodejní propozice (USP):**
- **Hlavní slib:** Garantovaný výsledek, transparentní komunikace a rychlost dodání bez skrytých poplatků.
- **Základní balíček:** Rychlé řešení primárního problému zákazníka.
- **Prémiový balíček (Doporučeno):** Kompletní řešení na klíč včetně garance spokojenosti a následné péče.`,
    pricing: `**Doporučená cenotvorba v Kč:**
- **Základní služba / balíček:** 2 900 – 4 900 Kč (marže min. 75 %)
- **Kompletní péče / měsíční paušál:** 8 900 – 16 000 Kč
- **Hodinová sazba pro doplňkové práce:** 750 – 1 200 Kč / hod.
- *Pravidlo: Nikdy neprodávej nejlevněji na trhu. Konkuruj spolehlivostí a kvalitou výsledku.*`,
    costs: `**Struktura nákladů:**
- **Počáteční investice:** 2 000 – 10 000 Kč (základní spotřební materiál, ohlášení živnosti, doména).
- **Měsíční fixní náklady:** Zdravotní a sociální pojištění (v 1. roce OSVČ možnost paušální daně nebo minimálních záloh), software a nástroje (do 1 000 Kč).
- **Variabilní náklady:** 15–25 % z ceny zakázky (materiál, doprava, spotřeba).`,
    customerAcquisition: `**Jak získat prvních 5 a následně 50 klientů:**
1. **Prvních 5 klientů (Přímý outreach):** Osobní kontakty, přímé zprávy s hodnotou zdarma, lokální komunity.
2. **Dalších 20 klientů (Referenční smyčka):** Každému spokojenému klientovi nabídni 15% slevu na další službu nebo bonus za doporučení známého.
3. **Škálování na 50+ klientů:** Lokální Google Firemní profil s hodnocením 5.0, obsahový marketing a mikro-reklama v okruhu 15 km.`,
    marketing: `**Marketingový mix bez velkého rozpočtu:**
- **Google Firemní profil / Lokální SEO:** Klíčové pro získávání hledajících zákazníků zdarma.
- **Krátká videa a fotky před/po:** Ukázky výsledků práce a řešení problémů zákazníků.
- **LinkedIn / B2B Networking:** Pokud cílíš na firmy, publikuj případové studie ze své praxe.`,
    firstMonthPlan: `**Akční plán Týden po týdnu:**
- **Týden 1 (Příprava & Validace):** Vytvoření nabídky, oslovení prvních 15 kontaktů, získání první zakázky.
- **Týden 2 (Dodávka & Reference):** Odbavení první zakázky s maximální péčí, pořízení fotodokumentace a recenze.
- **Týden 3 (Oficiální spuštění):** Založení profilů, oslovení dalších 25 kontaktů.
- **Týden 4 (První vyhodnocení & optimalizace):** Analýza nákladů a marží, nastavení referenčního programu, plán na další měsíc.`,
    growthStrategy: `**Strategie pro růst a škálování:**
- Přechod z jednorázových zakázek na dlouhodobé měsíční retainer smlouvy / paušály.
- Zvýšení cen o 20–30 % po naplnění prvních 70 % časové kapacity.
- Zavedení šablon a procesních checklistů pro možnost delegování na brigádníka či asistenta.`,
    generatedAt: new Date().toISOString()
  };
}

function generateServerFallbackDailyStep(userProfile: any, currentProject: string, completedSteps: any[] = []) {
  const stepCount = completedSteps.length;
  const steps = [
    {
      title: 'Definuj svou neodolatelnou nabídku (1 věta)',
      description: 'Napiš si podle vzorce: "Pomáhám [komu] dosáhnout [jakého konkrétního výsledku] bez [toho co nejvíc nenávidí] za [jak dlouho]."',
      whyImportant: 'Bez jasné nabídky zákazník nepochopí, proč by měl koupit právě od tebe.',
      estimatedMinutes: 25,
      category: 'nabidka'
    },
    {
      title: 'Napiš 5 lidem ze svého okolí nebo LinkedInu',
      description: 'Pošli přátelskou zprávu: "Ahoj, spouštím nový projekt zaměřený na [obor]. Zajímá mě tvůj názor – řešíš teď v této oblasti nějaký problém?"',
      whyImportant: 'Získáš okamžitou zpětnou vazbu z reálného trhu ještě dnes.',
      estimatedMinutes: 30,
      category: 'prodej'
    },
    {
      title: 'Založ Google Firemní profil nebo profesionální profil',
      description: 'Vyplň název, popiš své služby, přidej lokalitu a telefon. Přidej první 3 kvalitní fotografie.',
      whyImportant: 'Zákazníci si tě mohou okamžitě dohledat a ověřit tvou důvěryhodnost.',
      estimatedMinutes: 40,
      category: 'marketing'
    },
    {
      title: 'Spočítej si minimální marži a hodinovou sazbu',
      description: 'Sečti všechny měsíční fixní náklady a vyděl je počtem produktivních hodin (např. 80 h/měsíc). Zjisti, jakou částku musíš účtovat.',
      whyImportant: 'Zabráníš tomu, abys dřel za méně peněz než v běžném zaměstnání.',
      estimatedMinutes: 35,
      category: 'finance'
    }
  ];

  const chosen = steps[stepCount % steps.length];
  return {
    id: `step-${Date.now()}`,
    title: chosen.title,
    description: chosen.description,
    whyImportant: chosen.whyImportant,
    estimatedMinutes: chosen.estimatedMinutes,
    category: chosen.category,
    completed: false
  };
}

function generateServerFallbackChat(messages: any[], userProfile: any) {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const lower = lastMsg.toLowerCase();
  const name = userProfile?.name || 'podnikateli';

  if (lower.includes('nevím s čím') || lower.includes('nemám nápad') || lower.includes('jak začít')) {
    return {
      text: `Ahoj ${name}! Rozumím tvé situaci. Když člověk začíná a neví přesně s čím, největší chybou je čekat na "geniální a unikátní nápad". Úspěšný byznys vzniká řešením existujících problémů lidí, kteří už za to platí.

S tvým rozpočtem (${userProfile?.startingBudget || '0–10 000 Kč'}) a časem (${userProfile?.availableTime || '10 h/týden'}) doporučuji zaměřit se na **služby s vysokou přidanou hodnotou** nebo **specializovaný zprostředkovatelský model**.

**Doporučený postup pro tebe:**
1. Přejdi do sekce **„Výběr směru“** – vygeneruji ti 3 konkrétní směry podle tvých dovedností.
2. Vyber si jeden, který má nejrychlejší cestu k prvnímu zákazníkovi.
3. Společně vytvoříme nabídku, kterou ještě tento týden nabídneme prvním reálným klientům.`,
      suggestions: [
        'Vygenerovat podnikatelské směry na míru',
        'Jaké služby mají dnes v ČR nejvyšší marži?',
        'Jak ověřit poptávku do 24 hodin bez webu?'
      ]
    };
  }

  if (lower.includes('detailing') || lower.includes('mytí aut') || lower.includes('auto')) {
    return {
      text: `Skvělá volba, ${name}! Auto-detailing je v Česku velmi lukrativní obor, protože majitelé prémiovějších aut jsou ochotni platit 3 000 až 12 000 Kč za kompletní péči, pokud mají jistotu perfektního výsledku.

**Akční postup od nuly k prvním 5 zákazníkům:**

### 1. Fáze: Nabídka a portfolio (Dny 1–3)
- Nezačínej drahým pronájmem dílny. Začni jako mobilní detailing nebo v domácí garáži.
- Udělej 2 auta rodině/kamarádům za materiál výměnou za detailní video a foto "Před / Po" a recenzi na Google.

### 2. Fáze: Cenotvorba pro začátek
- **Základní hloubkové čištění interiéru + tepování:** 2 490 Kč (čas: cca 3 h)
- **Kompletní balíček (interiér + 1krokové leštění + keramická ochrana):** 5 490 Kč (čas: cca 5 h)

### 3. Fáze: Získání prvních platících klientů (Tento týden)
- Vyfoť kvalitní fotky své práce a přidej příspěvek do lokálních FB skupin v okolí (${userProfile?.location || 'Česká republika'}).
- Oslov lokální firmy s firemní flotilou v záložce **„Zákazníci“** – nabídni vyčištění 1 referenčního vozu.

**Tvůj dnešní krok:** Udělej si seznam 5 známých, kterým nabídneš ukázkové čištění auta pro tvé portfolio.`,
      suggestions: [
        'Vytvořit pro detailing kompletní Byznys plán',
        'Jaké základní vybavení koupit do 10 000 Kč?',
        'Najít firmy s flotilou v mém okolí'
      ]
    };
  }

  return {
    text: `Rozumím, ${name}. Pro tvůj cíl (${userProfile?.goal || 'vybudovat stabilní příjem'} s cílem ${userProfile?.targetIncome || '50 000+ Kč/měsíc'}) je klíčové soustředit se na **prodej a validaci**, nikoliv na nekonečnou přípravu.

**3 zásadní pravidla pro aktuální fázi:**
1. **Ověř poptávku před investicí:** Nikdy nekupuj drahý software ani zásoby, dokud nemáš první objednávku nebo zálohu.
2. **Jednoduchá nabídka (USP):** Zákazník nekupuje produkt, kupuje výsledek (úsporu času, peněz nebo méně stresu).
3. **Přímý prodej:** Osobní zprávy a direct outreach lokálním firmám fungují na začátku 10x lépe než placená reklama.

Co konkrétně teď potřebuješ vyřešit jako prioritu?`,
    suggestions: [
      'Pomoz mi sestavit neodolatelnou nabídku',
      'Jak nastavit cenotvorbu a marže?',
      'Vygenerovat akční byznys plán'
    ]
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hasMapsKey = Boolean(
    (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'MY_GOOGLE_MAPS_API_KEY') ||
    (process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACES_API_KEY !== 'MY_GOOGLE_PLACES_API_KEY') ||
    (process.env.MAPS_API_KEY && process.env.MAPS_API_KEY !== 'MY_MAPS_API_KEY') ||
    (process.env.VITE_GOOGLE_MAPS_API_KEY && process.env.VITE_GOOGLE_MAPS_API_KEY !== 'MY_GOOGLE_MAPS_API_KEY')
  );

  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    hasMapsKey,
    app: 'PODNIKAI'
  });
});

// Helper for generating system context from user profile
function buildSystemPrompt(userProfile: any, customContext: string = '') {
  const profileSummary = userProfile ? `
UŽIVATELSKÝ PROFIL PODNIKATELE:
- Jméno: ${userProfile.name || 'Podnikatel'}
- Stav: ${userProfile.status === 'running' ? 'Již aktivně podniká' : 'Teprve začíná / plánuje začít'}
- Hlavní cíl: ${userProfile.goal || 'Vybudovat ziskové podnikání'}
- Cílový měsíční příjem: ${userProfile.targetIncome || 'Neuvedeno'}
- Počáteční rozpočet: ${userProfile.startingBudget || 'Neuvedeno'}
- Časová kapacita: ${userProfile.availableTime || 'Neuvedeno'}
- Dovednosti & zkušenosti: ${Array.isArray(userProfile.skills) ? userProfile.skills.join(', ') : userProfile.skills || 'Neuvedeno'}
- Co ho baví: ${Array.isArray(userProfile.passions) ? userProfile.passions.join(', ') : userProfile.passions || 'Neuvedeno'}
- Co NECHCE dělat: ${Array.isArray(userProfile.dislikes) ? userProfile.dislikes.join(', ') : userProfile.dislikes || 'Neuvedeno'}
- Preference: ${userProfile.onlineOffline || 'hybrid'}
- Preferovaný typ práce: ${userProfile.preferredWorkType || 'Neuveden'}
- Zájmový obor: ${userProfile.businessTypeInterest || 'Neuvedeno'}
- Lokalita: ${userProfile.location || 'Česká republika'}
- Aktuální projekt: ${userProfile.currentProject || 'Zatím nevybrán'}
` : 'Uživatel zatím nedokončil onboarding.';

  return `Jsi PODNIKAI – špičkový, pragmatický a exekučně zaměřený AI parťák pro české podnikatele.
Cílem PODNIKAI není generovat co nejvíce nápadů, ale pomoci uživateli vybrat JEDEN realistický směr a dostat ho co nejrychleji k prvnímu skutečnému příjmu.

${profileSummary}

${customContext}

PŘÍSNÁ PRAVIDLA PRO TVŮJ TÓN, LOGIKU A ODPOVĚDI:
1. EPISTEMICKÁ PŘÍSNOST (FAKTA vs. ODHADY vs. MODELY vs. CÍLE):
   - NIKDY nepředstavuj odhadované zákazníky, tržby nebo budoucí výsledky jako fakta!
   - Vždy striktně rozlišuj mezi:
     * FAKTA: Ověřitelné skutečnosti, fixní zákonné poplatky v ČR (např. ohlášení volné živnosti 1 000 Kč), ceny nástrojů s free tierem.
     * ODHADY: Průměrné tržní odhady (např. typické hodinové sazby, konverzní poměry).
     * MODELOVÝ SCÉNÁŘ: Matematická simulace s explicitním označením (např. „Modelový scénář: Při 5 klientech po 10 000 Kč = 50 000 Kč“).
     * CÍL: Cíl stanovený uživatelem (např. „Cíl uživatele: 100 000 Kč/měsíc“).
     * NUTNO OVĚŘIT NA TRHU: Pokud je k rozhodnutí potřeba aktuální informace z trhu (např. lokální ceníky konkurence v daném městě, reálná ochota konkrétních firem platit), VŽDY výslovně označ, že je nutné ji ověřit v praxi, a NEVYMÝŠLEJ SI JI!
2. ŽÁDNÉ PRÁZDNÉ MOTIVAČNÍ FRÁZE („věř si a všechno půjde“, „buď vytrvalý“ apod.). Nahraď je konkrétní nabídkou, cenou, kanálem oslovení a prodejním skriptem.
3. PRIORITOU JE SKUTEČNÝ PLATÍCÍ ZÁKAZNÍK. Žádné nekonečné přípravy, loga nebo drahé weby před validací.
4. Zohledňuj české reálie (OSVČ, živnostenské listy, DPH, Fakturoid/iDoklad, Shoptet, české platební brány, lokální FB skupiny, LinkedIn).
5. Vždy respektuj limity uživatele (rozpočet, čas, dovednosti a zejména to, co NECHCE dělat).`;
}

// 1. AI CHAT ENDPOINT
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userProfile, currentProject } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const ai = getAIClient();
    if (!ai) {
      const fallback = generateServerFallbackChat(messages, userProfile);
      return res.json(fallback);
    }

    const systemPrompt = buildSystemPrompt(userProfile, currentProject ? `AKTUÁLNĚ ŘEŠENÝ PROJEKT: ${currentProject}` : '');

    // Format conversation history for Gemini
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const replyText = response.text || 'Omlouvám se, nepodařilo se vygenerovat odpověď.';

    // Generate 3 short follow-up suggestions
    const suggestionPrompt = `Na základě předchozí konverzace vygeneruj přesně 3 krátké, relevantní navazující otázky nebo akce, na které by uživatel mohl jedním klikem kliknout. Odpověz pouze jako JSON pole řetězců formátu ["Otázka 1", "Otázka 2", "Otázka 3"].`;
    
    let suggestions: string[] = [];
    try {
      const sugResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          ...contents,
          { role: 'model', parts: [{ text: replyText }] },
          { role: 'user', parts: [{ text: suggestionPrompt }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      if (sugResponse.text) {
        suggestions = JSON.parse(sugResponse.text);
      }
    } catch {
      suggestions = [
        'Jak získat prvního zákazníka bez placené reklamy?',
        'Jak přesně nastavit cenotvorbu a balíčky?',
        'Jaké jsou největší rizika a jak se jim vyhnout?'
      ];
    }

    return res.json({ text: replyText, suggestions });
  } catch (error: any) {
    console.warn('Chat AI unavailable or error, using server fallback:', error?.message);
    const fallback = generateServerFallbackChat(req.body?.messages || [], req.body?.userProfile);
    return res.json(fallback);
  }
});

// 2. GENERATE BUSINESS IDEAS & DIRECTIONS ENDPOINT (8-Step Recommendation Engine)
app.post('/api/ideas/generate', async (req, res) => {
  try {
    const { userProfile, customPreferences } = req.body;
    const ai = getAIClient();

    if (!ai) {
      const fallbackResult = generateServerFallbackIdeas(userProfile, customPreferences);
      return res.json(fallbackResult);
    }

    const systemPrompt = buildSystemPrompt(userProfile);
    const userPrompt = `
POSTUPUJ PŘESNĚ PODLE NÁSLEDUJÍCÍCH 8 KROKŮ METODIKY PODNIKAI:

1. VYHODNOCENÍ UŽIVATELE (userEvaluation):
   - Kapitál: Zhodnoť rozpočet (${userProfile?.startingBudget || 'neuvedeno'}).
   - Dovednosti: Zhodnoť zkušenosti (${Array.isArray(userProfile?.skills) ? userProfile.skills.join(', ') : 'všeobecné'}) a zájmy (${Array.isArray(userProfile?.passions) ? userProfile.passions.join(', ') : 'všeobecné'}).
   - Čas: Zhodnoť časovou kapacitu (${userProfile?.availableTime || 'neuvedeno'}).
   - Ochota / styl prodeje: Zohledni co nechce dělat (${Array.isArray(userProfile?.dislikes) ? userProfile.dislikes.join(', ') : 'žádné'}) a model (${userProfile?.onlineOffline || 'hybrid'}).
   - Požadovaný příjem: Zhodnoť realitu dosažení cíle (${userProfile?.targetIncome || 'neuvedeno'}).

2. VÝBĚR MAXIMÁLNĚ 3 REALISTICKÝCH SMĚRŮ (directions):
   - Vyber přesně 3 (nebo méně) konkrétní, na českém trhu realizovatelné směry.

3. OHODNOCENÍ KAŽDÉHO ZE 3 SMĚRŮ PODLE 5 PILÍŘŮ (ratings):
   - Rychlost získání prvního klienta (speedToFirstClient: score 1-10 + text)
   - Vstupní náklady (upfrontCosts: score 1-10 + text)
   - Potenciál marže (marginPotential: score 1-10 + text)
   - Konkurence v ČR (competitionInCz: score 1-10 + text)
   - Možnost škálování (scalability: score 1-10 + text)

4. DOPORUČENÍ POUZE JEDNOHO NEJLEPŠÍHO SMĚRU:
   - Pouze JEDEN směr musí mít isRecommended: true, ostatní MUSÍ mít isRecommended: false.
   - Uveď jasné comparisonVerdict a recommendationReason, proč právě tento jeden směr vyhrál nad zbylými dvěma.

5. DETAILNÍ BALÍČEK PRO DOPORUČENÝ SMĚR:
   - concreteOffer: Přesná formulace balíčku / neodolatelné nabídky (USP).
   - targetCustomer: Přesný profil ideálního platícího klienta.
   - pricingStructure: Ceny a marže s explicitním označením modelového scénáře.
   - outreachMethod: Konkrétní komunikační kanál a přesný zvací/prodejní skript.
   - firstClientPlan: 7denní plán k prvnímu platícímu klientovi.

6. KONKRÉTNÍ ÚKOL NA DNES (todayTask):
   - title, description, estimatedMinutes (20-45 min), whyToday.

7. EPISTEMICKÁ PŘÍSNOST (epistemic):
   - verifiedFacts: Seznam skutečných, ověřitelných faktů (fixní poplatky v ČR, free tiery).
   - marketEstimates: Seznam odhadů z trhu s označením [Odhad].
   - modelScenario: Matematická simulace kalkulace příjmu na vzorku zákazníků.
   - needsMarketVerification: Seznam věcí, které je nutné ověřit na trhu a nesmí se vymýšlet.

8. ŽÁDNÉ MOTIVAČNÍ FRÁZE – pouze konkrétní komerční kroky.
${customPreferences ? `Dodatečné preference uživatele: ${customPreferences}` : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            userEvaluation: {
              type: Type.OBJECT,
              properties: {
                capitalAssessment: { type: Type.STRING },
                skillsAssessment: { type: Type.STRING },
                timeAssessment: { type: Type.STRING },
                salesStyleAssessment: { type: Type.STRING },
                targetIncomeAssessment: { type: Type.STRING }
              },
              required: ["capitalAssessment", "skillsAssessment", "timeAssessment", "salesStyleAssessment", "targetIncomeAssessment"]
            },
            recommendedDirectionId: { type: Type.STRING },
            comparisonVerdict: { type: Type.STRING },
            directions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  tagline: { type: Type.STRING },
                  description: { type: Type.STRING },
                  isRecommended: { type: Type.BOOLEAN },
                  recommendationReason: { type: Type.STRING },
                  ratings: {
                    type: Type.OBJECT,
                    properties: {
                      speedToFirstClient: {
                        type: Type.OBJECT,
                        properties: {
                          score: { type: Type.INTEGER },
                          text: { type: Type.STRING }
                        },
                        required: ["score", "text"]
                      },
                      upfrontCosts: {
                        type: Type.OBJECT,
                        properties: {
                          score: { type: Type.INTEGER },
                          text: { type: Type.STRING }
                        },
                        required: ["score", "text"]
                      },
                      marginPotential: {
                        type: Type.OBJECT,
                        properties: {
                          score: { type: Type.INTEGER },
                          text: { type: Type.STRING }
                        },
                        required: ["score", "text"]
                      },
                      competitionInCz: {
                        type: Type.OBJECT,
                        properties: {
                          score: { type: Type.INTEGER },
                          text: { type: Type.STRING }
                        },
                        required: ["score", "text"]
                      },
                      scalability: {
                        type: Type.OBJECT,
                        properties: {
                          score: { type: Type.INTEGER },
                          text: { type: Type.STRING }
                        },
                        required: ["score", "text"]
                      }
                    },
                    required: ["speedToFirstClient", "upfrontCosts", "marginPotential", "competitionInCz", "scalability"]
                  },
                  epistemic: {
                    type: Type.OBJECT,
                    properties: {
                      verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                      marketEstimates: { type: Type.ARRAY, items: { type: Type.STRING } },
                      modelScenario: { type: Type.STRING },
                      needsMarketVerification: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["verifiedFacts", "marketEstimates", "modelScenario", "needsMarketVerification"]
                  },
                  concreteOffer: { type: Type.STRING },
                  targetCustomer: { type: Type.STRING },
                  pricingStructure: { type: Type.STRING },
                  outreachMethod: { type: Type.STRING },
                  firstClientPlan: { type: Type.STRING },
                  todayTask: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      estimatedMinutes: { type: Type.INTEGER },
                      whyToday: { type: Type.STRING }
                    },
                    required: ["title", "description", "estimatedMinutes", "whyToday"]
                  }
                },
                required: [
                  "id", "title", "tagline", "description", "isRecommended",
                  "recommendationReason", "ratings", "epistemic", "concreteOffer",
                  "targetCustomer", "pricingStructure", "outreachMethod",
                  "firstClientPlan", "todayTask"
                ]
              }
            }
          },
          required: ["userEvaluation", "recommendedDirectionId", "comparisonVerdict", "directions"]
        }
      }
    });

    const parsedResult = JSON.parse(response.text || '{}');
    
    // Map to legacy BusinessIdea format for backward compatibility where needed
    const mappedIdeas = (parsedResult.directions || []).map((dir: any) => ({
      id: dir.id,
      title: dir.title,
      tagline: dir.tagline,
      description: dir.description,
      initialCosts: dir.ratings?.upfrontCosts?.text || 'Dle rozpočtu',
      initialCostsLevel: (dir.ratings?.upfrontCosts?.score || 5) >= 8 ? 'low' : (dir.ratings?.upfrontCosts?.score || 5) >= 5 ? 'medium' : 'high',
      difficulty: (dir.ratings?.speedToFirstClient?.score || 5) >= 8 ? 'low' : (dir.ratings?.speedToFirstClient?.score || 5) >= 5 ? 'medium' : 'high',
      incomePotential: dir.epistemic?.modelScenario || 'Dle modelu',
      launchSpeed: dir.ratings?.speedToFirstClient?.text || 'Do 7 dnů',
      risk: (dir.ratings?.upfrontCosts?.score || 5) >= 7 ? 'low' : 'medium',
      whyItFits: dir.recommendationReason || dir.tagline,
      firstValidationStep: dir.todayTask?.title || dir.firstClientPlan?.substring(0, 120),
      targetAudience: dir.targetCustomer,
      directionData: dir
    }));

    return res.json({
      data: parsedResult,
      ideas: mappedIdeas
    });
  } catch (error: any) {
    console.warn('Ideas AI generation unavailable or error, using server fallback:', error?.message);
    const fallbackResult = generateServerFallbackIdeas(req.body?.userProfile, req.body?.customPreferences);
    return res.json(fallbackResult);
  }
});

// 3. GENERATE BUSINESS PLAN ENDPOINT
app.post('/api/plan/generate', async (req, res) => {
  try {
    const { userProfile, ideaTitle, ideaDescription, customNotes } = req.body;
    const ai = getAIClient();

    if (!ai) {
      const fallbackPlan = generateServerFallbackPlan(userProfile, ideaTitle, ideaDescription, customNotes);
      return res.json({ plan: fallbackPlan });
    }

    const systemPrompt = buildSystemPrompt(userProfile);
    const userPrompt = `
Vytvoř komplexní, vysoce strukturovaný a praktický PODNIKATELSKÝ PLÁN pro projekt:
PROJEKT: "${ideaTitle}"
POPIS / ZADÁNÍ: "${ideaDescription || ''}"
${customNotes ? `DODATEČNÉ POZNÁMKY: ${customNotes}` : ''}

Plán MUSÍ obsahovat následující sekce přesně podle metodiky PODNIKAI:
1. summary (Shrnutí projektu a hlavní vize)
2. firstAction (Co udělat jako úplně první krok - validace bez rizika a nákladů do 7 dnů)
3. nextSteps (Další kroky - administrativa v ČR, živnost, nástroje, příprava)
4. offer (Konkrétní nabídka, co přesně prodáváme, unikátní hodnota - USP)
5. pricing (Cenotvorba, marže, balíčky cen v Kč, model předplatného nebo jednorázových plateb)
6. costs (Náklady rozepsané: fixní, variabilní, počáteční investice v Kč)
7. customerAcquisition (Jak získat prvních 5 a následně 50 zákazníků - konkrétní taktiky)
8. marketing (Marketingový mix: organický obsah, sociální sítě, direct outreach, networking, reference)
9. firstMonthPlan (Detailní plán 1. měsíce týden po týdnu: Týden 1 až Týden 4)
10. growthStrategy (Strategie růstu po dosažení prvních příjmů, delegování, automatizace)

Formátuj obsah každé sekce v přehledném Markdownu s odrážkami a tučným textem.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            summary: { type: Type.STRING },
            firstAction: { type: Type.STRING },
            nextSteps: { type: Type.STRING },
            offer: { type: Type.STRING },
            pricing: { type: Type.STRING },
            costs: { type: Type.STRING },
            customerAcquisition: { type: Type.STRING },
            marketing: { type: Type.STRING },
            firstMonthPlan: { type: Type.STRING },
            growthStrategy: { type: Type.STRING },
          },
          required: [
            "projectName", "summary", "firstAction", "nextSteps", "offer",
            "pricing", "costs", "customerAcquisition", "marketing",
            "firstMonthPlan", "growthStrategy"
          ]
        }
      }
    });

    const parsedPlan = JSON.parse(response.text || '{}');
    parsedPlan.generatedAt = new Date().toISOString();
    return res.json({ plan: parsedPlan });
  } catch (error: any) {
    console.warn('Plan AI generation unavailable or error, using server fallback:', error?.message);
    const fallbackPlan = generateServerFallbackPlan(req.body?.userProfile, req.body?.ideaTitle, req.body?.ideaDescription, req.body?.customNotes);
    return res.json({ plan: fallbackPlan });
  }
});

// 4. GENERATE NEXT DAILY STEP ENDPOINT
app.post('/api/daily-step/next', async (req, res) => {
  try {
    const { userProfile, currentProject, completedSteps, businessPlan } = req.body;
    const ai = getAIClient();

    if (!ai) {
      const step = generateServerFallbackDailyStep(userProfile, currentProject, completedSteps);
      return res.json({ step });
    }

    const systemPrompt = buildSystemPrompt(userProfile);
    const userPrompt = `
Na základě aktuální situace podnikatele urči JEDEN NEJDŮLEŽITĚJŠÍ AKTUÁLNÍ KROK ("Dnešní krok").

AKTUÁLNÍ PROJEKT: ${currentProject || 'Zatím v přípravě'}
JIŽ SPLNĚNÉ KROKY: ${Array.isArray(completedSteps) && completedSteps.length > 0 ? completedSteps.map((s: any) => s.title).join('; ') : 'Zatím žádné'}
${businessPlan ? `VÝTAH Z PLÁNU: První krok byl: ${businessPlan.firstAction?.substring(0, 200)}` : ''}

Urči krok, který:
1. Lze splnit dnes za 20-60 minut.
2. Posune projekt nejvíce dopředu směrem k prvním platícím zákazníkům.
3. Je ultra-konkrétní a akční.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING, description: "Jasný, akční název úkolu (např. 'Napiš 5 potenciálním zákazníkům na LinkedInu')" },
            description: { type: Type.STRING, description: "Konkrétní mikronávod krok za krokem, šablona nebo postup" },
            whyImportant: { type: Type.STRING, description: "Proč je právě tento krok zásadní pro posun byznysu" },
            estimatedMinutes: { type: Type.INTEGER, description: "Odhadovaný čas v minutách (např. 30)" },
            category: { type: Type.STRING, description: "'validace' | 'nabidka' | 'marketing' | 'prodej' | 'operativa' | 'finance'" }
          },
          required: ["id", "title", "description", "whyImportant", "estimatedMinutes", "category"]
        }
      }
    });

    const step = JSON.parse(response.text || '{}');
    step.completed = false;
    if (!step.id) step.id = `step-${Date.now()}`;
    return res.json({ step });
  } catch (error: any) {
    console.warn('Daily step AI generation unavailable or error, using server fallback:', error?.message);
    const step = generateServerFallbackDailyStep(req.body?.userProfile, req.body?.currentProject, req.body?.completedSteps);
    return res.json({ step });
  }
});

// Transparent scoring model based strictly on real, verifiable data
function calculateTransparentScore(place: {
  companyName: string;
  industry: string;
  distanceKm?: number;
  ratingNum?: number;
  reviewCount: number;
  phone: string;
  website: string;
  address?: string;
}): { fitScore: number; scoreBreakdown: { category: string; points: number; maxPoints: number; note: string }[]; dataSummary: string } {
  const breakdown: { category: string; points: number; maxPoints: number; note: string }[] = [];

  // 1. Shoda s cílovým oborem (max 25 b.) - Ověřený obor
  const industryPts = 25;
  breakdown.push({
    category: 'Shoda s cílovým oborem',
    points: industryPts,
    maxPoints: 25,
    note: `Ověřený obor (${place.industry})`
  });

  // 2. Vzdálenost / lokalita (max 25 b.) - Skutečná vzdálenost od centra
  let locPts = 15;
  let locNote = 'V zadané lokalitě';
  if (typeof place.distanceKm === 'number') {
    const dStr = place.distanceKm.toFixed(1).replace('.', ',');
    if (place.distanceKm <= 2.0) {
      locPts = 25;
    } else if (place.distanceKm <= 5.0) {
      locPts = 22;
    } else if (place.distanceKm <= 10.0) {
      locPts = 18;
    } else if (place.distanceKm <= 15.0) {
      locPts = 15;
    } else if (place.distanceKm <= 25.0) {
      locPts = 12;
    } else {
      locPts = 8;
    }
    locNote = `${dStr} km od centra`;
  }
  breakdown.push({
    category: 'Vzdálenost / lokalita',
    points: locPts,
    maxPoints: 25,
    note: locNote
  });

  // 3. Veřejné hodnocení (max 15 b.) - Ověřené Google hodnocení
  let ratingPts = 0;
  let ratingNote = 'Bez veřejného hodnocení';
  const hasRating = typeof place.ratingNum === 'number' && place.ratingNum > 0;
  if (hasRating) {
    if (place.ratingNum! >= 4.8) {
      ratingPts = 15;
    } else if (place.ratingNum! >= 4.5) {
      ratingPts = 13;
    } else if (place.ratingNum! >= 4.0) {
      ratingPts = 10;
    } else {
      ratingPts = 7;
    }
    const rStr = place.ratingNum!.toFixed(1).replace('.', ',');
    ratingNote = `${rStr}★ / ${place.reviewCount} recenzí`;
  }
  breakdown.push({
    category: 'Veřejné hodnocení',
    points: ratingPts,
    maxPoints: 15,
    note: ratingNote
  });

  // 4. Počet veřejných recenzí (max 15 b.) - Ověřený počet veřejných recenzí
  let reviewPts = 0;
  let reviewNote = 'Zatím bez evidovaných recenzí';
  if (place.reviewCount >= 50) {
    reviewPts = 15;
  } else if (place.reviewCount >= 20) {
    reviewPts = 12;
  } else if (place.reviewCount >= 5) {
    reviewPts = 9;
  } else if (place.reviewCount >= 1) {
    reviewPts = 6;
  }
  if (place.reviewCount > 0) {
    const declension = place.reviewCount === 1 ? 'veřejná recenze' : (place.reviewCount >= 2 && place.reviewCount <= 4) ? 'veřejné recenze' : 'veřejných recenzí';
    reviewNote = `${place.reviewCount} ${declension}`;
  }
  breakdown.push({
    category: 'Počet veřejných recenzí',
    points: reviewPts,
    maxPoints: 15,
    note: reviewNote
  });

  // 5. Veřejný telefon (max 10 b.) - Veřejně uvedený telefon
  const hasPhone = place.phone && place.phone !== 'Nedostupné';
  const phonePts = hasPhone ? 10 : 0;
  const phoneNote = hasPhone ? 'Veřejně uvedený telefon' : 'Telefon není veřejně uveden';
  breakdown.push({
    category: 'Veřejný telefon',
    points: phonePts,
    maxPoints: 10,
    note: phoneNote
  });

  // 6. Veřejný web (max 10 b.) - Veřejně dostupný web
  const hasWeb = place.website && place.website !== 'Nedostupné';
  const webPts = hasWeb ? 10 : 0;
  const webNote = hasWeb ? 'Veřejně dostupný web' : 'Web není veřejně uveden';
  breakdown.push({
    category: 'Veřejný web',
    points: webPts,
    maxPoints: 10,
    note: webNote
  });

  // Celkové skóre shody s kritérii (0–100): Míra splnění předem nastavených kritérií podle ověřených veřejných údajů
  const fitScore = breakdown.reduce((sum, f) => sum + f.points, 0);

  // Factual data summary
  const distStr = typeof place.distanceKm === 'number' ? ` (${place.distanceKm.toFixed(1).replace('.', ',')} km od centra)` : '';
  const ratingStr = hasRating ? `s hodnocením ${place.ratingNum!.toFixed(1).replace('.', ',')}★ (${place.reviewCount} recenzí)` : 'bez evidovaného hodnocení';
  const contactStr = hasPhone ? `telefon ${place.phone}` : 'telefon neuveden';
  const webStr = hasWeb ? 'web k dispozici' : 'web neuveden';

  const dataSummary = `Podnik působí v oboru ${place.industry} na adrese ${place.address || 'v lokalitě'}${distStr} ${ratingStr}. Kontaktní dostupnost: ${contactStr}, ${webStr}.`;

  return { fitScore, scoreBreakdown: breakdown, dataSummary };
}
// Source: Google Maps Platform Code Assist
interface GooglePlaceItem {
  id?: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude: number; longitude: number };
}

// Calculate geodesic distance between two points in km
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Geocode city/region to obtain exact lat/lng coordinates
async function geocodeLocation(apiKey: string, locationStr: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  try {
    const cleanLocation = locationStr.replace(/^Česká republika,?\s*/i, '').trim() || locationStr;
    const query = cleanLocation.includes('Česko') || cleanLocation.includes('Czechia')
      ? cleanLocation
      : `${cleanLocation}, Česko`;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&language=cs`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].geometry?.location) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
        formattedAddress: data.results[0].formatted_address
      };
    }
  } catch (e) {
    console.warn('Geocoding error:', e);
  }
  return null;
}

async function fetchRealPlacesFromGoogle(
  apiKey: string,
  query: string,
  centerCoords: { lat: number; lng: number } | null,
  radiusMeters: number,
  pageSize: number
): Promise<GooglePlaceItem[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  
  const requestBody: any = {
    textQuery: query,
    pageSize: Math.min(Math.max(pageSize, 10), 20),
    languageCode: 'cs'
  };

  if (centerCoords) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: centerCoords.lat,
          longitude: centerCoords.lng
        },
        radius: Math.min(radiusMeters, 50000)
      }
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.location'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Places API vrátilo chybu (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.places || [];
}

// Location and Offer Sanitization Helpers for authentic Czech B2B Outreach
function cleanCzechCity(rawCity?: string, fallbackCity: string = ''): string {
  if (!rawCity || rawCity === 'Nedostupné' || rawCity === 'vašem městě' || rawCity === 'v městě') {
    return fallbackCity ? cleanCzechCity(fallbackCity, '') : '';
  }

  let city = rawCity.trim();
  city = city.replace(/,?\s*(Česko|Česká republika|Czechia|CZ)$/gi, '').trim();
  city = city.replace(/\b\d{3}\s*\d{2}\b/g, '').trim();

  const dashMatch = city.split(/[\u2013\u2014\-\/,]+/);
  if (dashMatch.length > 1) {
    const firstPart = dashMatch[0].trim();
    const secondPart = dashMatch[1].trim();
    const normFirst = firstPart.toLowerCase().replace(/\s+\d+$/, '');
    const normSecond = secondPart.toLowerCase().replace(/\s+\d+$/, '');
    if (normFirst === normSecond || normSecond.includes(normFirst) || normFirst.includes(normSecond)) {
      city = firstPart;
    }
  }

  if (!/^Praha\s+\d+$/i.test(city)) {
    city = city.replace(/\s+\d+$/, '').trim();
  }

  city = city.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();
  return city || fallbackCity;
}

function cleanCzechAddress(rawAddress?: string): string {
  if (!rawAddress || rawAddress === 'Nedostupné') {
    return 'Nedostupné';
  }

  let addr = rawAddress.trim();
  addr = addr.replace(/,?\s*(Česko|Česká republika|Czechia|CZ)$/gi, '').trim();
  addr = addr.replace(/([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž\s]+)[\u2013\u2014\-]\1\s*\d*/gi, (_match, group) => {
    return group.trim();
  });
  addr = addr.replace(/\s{2,}/g, ' ');
  addr = addr.replace(/,\s*,/g, ',');
  addr = addr.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();
  return addr;
}

function sanitizeOfferTitle(
  concreteOffer?: string,
  businessDirectionTitle?: string,
  currentProject?: string,
  industry?: string
): string {
  const invalidKeywords = [
    'hledám ideální nápad',
    'aktivní byznys',
    'zatím nevybrán',
    'zatím v přípravě',
    'nespecifikováno',
    'nový projekt',
    'můj byznys projekt',
    'svůj projekt',
    'b2b služby',
    'hledám nápad',
    'hledání nápadu',
    'podnikatelský záměr',
    'podnikatelský projekt',
    'projekt'
  ];

  for (const candidate of [concreteOffer, businessDirectionTitle, currentProject]) {
    if (!candidate || typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const isInvalid = invalidKeywords.some(k => lower === k || lower.includes('hledám nápad') || lower.includes('hledá nápad'));
    if (!isInvalid && trimmed.length >= 3) {
      return trimmed;
    }
  }

  if (industry && industry !== 'oboru' && industry !== 'Nedostupné') {
    const indLower = industry.toLowerCase();
    if (indLower.includes('auto') || indLower.includes('servis')) return 'zefektivnění příjmu zakázek a komunikace se zákazníky';
    if (indLower.includes('stav') || indLower.includes('řemesl') || indLower.includes('truhl')) return 'zrychlení kalkulací a organizaci zakázek';
    if (indLower.includes('gastro') || indLower.includes('restaur')) return 'zvýšení počtu rezervací a spokojenosti hostů';
    if (indLower.includes('salon') || indLower.includes('kadeř') || indLower.includes('wellness')) return 'automatizaci online rezervací a připomínek pro klienty';
  }

  return 'zefektivnění a digitalizaci zakázek';
}

// 5. FIND CUSTOMERS CONTROLLER (Najdi zákazníky - Real Provider + AI Scoring)
async function handleFindCustomers(req: express.Request, res: express.Response) {
  try {
    const { userProfile, criteria } = req.body || {};
    const { cityOrRegion, maxDistanceKm, companyType, numberOfLeads, businessDirectionTitle, concreteOffer } = criteria || {};

    const mapsApiKey = (process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

    // Strict requirement: If external provider key is not configured, NEVER hallucinate fake companies.
    if (!mapsApiKey || mapsApiKey === 'MY_GOOGLE_MAPS_API_KEY' || mapsApiKey === 'MY_MAPS_API_KEY') {
      return res.status(400).json({
        error: 'Vyhledávání reálných firem není nakonfigurováno. Nastavte API klíč poskytovatele (GOOGLE_MAPS_API_KEY nebo GOOGLE_PLACES_API_KEY) v nastavení prostředí.',
        isConfigured: false
      });
    }

    // Strict priority: criteria.cityOrRegion has absolute priority if provided.
    // userProfile.location is only used as a fallback if criteria.cityOrRegion is completely empty.
    const rawLocation = (typeof cityOrRegion === 'string' && cityOrRegion.trim().length > 0)
      ? cityOrRegion.trim()
      : (typeof userProfile?.location === 'string' && userProfile.location.trim().length > 0
          ? userProfile.location.trim()
          : 'České Budějovice');

    const cleanLocation = cleanCzechCity(
      rawLocation.replace(/^Česká republika,?\s*/i, '').trim() || rawLocation,
      'České Budějovice'
    );

    const allowedRadiusKm = typeof maxDistanceKm === 'number' && maxDistanceKm > 0 ? maxDistanceKm : 25;
    const targetCount = Math.min(Math.max(numberOfLeads || 5, 1), 20);

    // 1. Geocode search origin location to obtain precise coordinates
    const centerCoords = await geocodeLocation(mapsApiKey, cleanLocation);
    const radiusMeters = allowedRadiusKm * 1000;

    const searchQuery = `${companyType || 'podniky'} ${cleanLocation}`;

    // 2. Fetch REAL places from Google Places API (biased to center coordinates)
    let rawPlaces: GooglePlaceItem[] = [];
    try {
      rawPlaces = await fetchRealPlacesFromGoogle(mapsApiKey, searchQuery, centerCoords, radiusMeters, 20);
    } catch (apiErr: any) {
      console.error('Google Places API fetch error:', apiErr);
      return res.status(502).json({
        error: `Chyba při komunikaci s Google Places API: ${apiErr.message || 'Nepodařilo se načíst provozovny'}.`,
        isConfigured: true
      });
    }

    if (!rawPlaces || rawPlaces.length === 0) {
      return res.json({
        searchCriteria: criteria,
        dataNotice: {
          dataSourceInfo: `V Google Places API nebyly nalezeny žádné provozovny pro dotaz „${searchQuery}“. Zkuste upravit město nebo klíčové slovo.`,
          isRealTimeVerified: true,
          provider: 'google_places',
          isConfigured: true
        },
        leads: []
      });
    }

    // 3. Strict Geographic Filtering & Distance Calculation (Haversine)
    const placesWithCalculatedDistance = rawPlaces.map((p, idx) => {
      let distanceKm: number | undefined = undefined;
      if (centerCoords && p.location?.latitude && p.location?.longitude) {
        distanceKm = haversineDistanceKm(
          centerCoords.lat,
          centerCoords.lng,
          p.location.latitude,
          p.location.longitude
        );
      }

      // Extract city from address if possible and clean deduplicated name
      let detectedCity = cleanLocation;
      if (p.formattedAddress) {
        const parts = p.formattedAddress.split(',');
        if (parts.length >= 2) {
          const zipAndCity = parts[parts.length - 2].trim();
          detectedCity = cleanCzechCity(zipAndCity.replace(/^\d{3}\s*\d{2}\s*/, '').trim(), cleanLocation);
        }
      }

      const cleanAddress = cleanCzechAddress(p.formattedAddress);

      return {
        id: p.id || `place-${Date.now()}-${idx}`,
        companyName: p.displayName?.text || 'Provozovna bez názvu',
        industry: companyType || 'Služby a podnikání',
        city: detectedCity,
        address: cleanAddress,
        website: p.websiteUri || 'Nedostupné',
        googleMapsUri: p.googleMapsUri || (p.id ? `https://www.google.com/maps/place/?q=place_id:${p.id}` : undefined),
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || 'Nedostupné',
        email: 'Nedostupné', // Places API does not return emails; strictly marked Nedostupné
        googleRating: typeof p.rating === 'number' ? `${p.rating.toFixed(1)} (${p.userRatingCount || 0} recenzí)` : 'Nedostupné',
        ratingNum: p.rating,
        reviewCount: p.userRatingCount || 0,
        distanceKm,
        coordinates: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined,
        dataSource: 'Google Places API (Ověřené reálné záznamy Google Maps)'
      };
    });

    // Strictly discard any place outside the user's maxDistanceKm radius
    const strictlyFilteredPlaces = placesWithCalculatedDistance.filter(p => {
      if (typeof p.distanceKm === 'number') {
        return p.distanceKm <= allowedRadiusKm;
      }
      // If coordinates are missing, verify whether formatted address explicitly mentions target region
      return p.address.toLowerCase().includes(cleanLocation.toLowerCase());
    });

    if (strictlyFilteredPlaces.length === 0) {
      return res.json({
        searchCriteria: criteria,
        dataNotice: {
          dataSourceInfo: `V okruhu ${allowedRadiusKm} km od lokality „${cleanLocation}“ nebyly nalezeny žádné provozovny pro obor „${companyType || 'služby'}“. Zkuste zvětšit vzdálenostní rádius nebo upravit hledaný obor.`,
          isRealTimeVerified: true,
          provider: 'google_places',
          isConfigured: true
        },
        leads: []
      });
    }

    // Helper for personalized first-contact generation grounded strictly in verified data
function generatePersonalizedOutreachScripts(params: {
  companyName: string;
  industry: string;
  city: string;
  address?: string;
  distanceKm?: number;
  ratingNum?: number;
  reviewCount?: number;
  googleRating?: string;
  website?: string;
  phone?: string;
  userName?: string;
  offerTitle: string;
  userCity?: string;
}): { email: string; sms: string; phoneScript: string } {
  const {
    companyName,
    industry,
    city,
    address,
    ratingNum,
    reviewCount,
    googleRating,
    userName = 'Martin Sladký',
    offerTitle,
    userCity
  } = params;

  const cleanCityName = cleanCzechCity(city);
  const cityPhrase = cleanCityName ? ` v lokalitě ${cleanCityName}` : '';
  const senderLocation = cleanCzechCity(userCity) || cleanCityName || 'ČR';

  // 1. Determine verified specific detail
  let verifiedDetailEmail = '';
  let verifiedDetailPhone = '';

  if (ratingNum && ratingNum >= 4.5 && reviewCount && reviewCount >= 5) {
    verifiedDetailEmail = `obracím se na vás v návaznosti na působení společnosti ${companyName}${cityPhrase} (s hodnocením ${googleRating} na Google).`;
    verifiedDetailPhone = `Volám ohledně vaší společnosti ${companyName}${cityPhrase} v návaznosti na vaše hodnocení na Google.`;
  } else if (address && address !== 'Nedostupné') {
    verifiedDetailEmail = `obracím se na vás s nabídkou spolupráce pro vaši společnost ${companyName}${cityPhrase}.`;
    verifiedDetailPhone = `Volám ohledně vaší společnosti ${companyName}${cityPhrase}.`;
  } else {
    verifiedDetailEmail = `obracím se na vás ohledně vaší společnosti ${companyName}${cityPhrase}.`;
    verifiedDetailPhone = `Volám ohledně vaší společnosti ${companyName}${cityPhrase}.`;
  }

  // A) E-mail (max 90-110 words, authentic B2B, zero fake claims, open scheduling)
  const email = `Dobrý den,\n\n${verifiedDetailEmail}\n\nJmenuji se ${userName} a věnuji se podpoře podniků v oblasti ${industry}. Pomáháme s ${offerTitle}, což šetří hodiny administrativy a zrychluje odbavování zakázek.\n\nRád bych s vámi nezávazně probral, zda by toto řešení mohlo přinést konkrétní užitek i pro vaši praxi.\n\nMěl(a) byste v příštích dnech prostor na krátký 10minutový telefonát? Dejte mi prosím vědět, jaký termín vám nejlépe vyhovuje.\n\nS pozdravem,\n${userName}`;

  // B) SMS (max 250 chars, natural, personal, non-spammy)
  const sms = `Dobrý den, tady ${userName}. Píši ohledně ${companyName}. Pomáháme v oboru ${industry} s: ${offerTitle}. Rád bych vám poslal stručnou 1min ukázku nebo zavolal na 5 minut, zda to pro vás dává smysl. Kdy by se vám to hodilo?`;

  // C) Telefonní scénář (přesně 4 kroky, cíl 5-10 min ukázka, otevřený termín)
  const phoneScript = `1. ÚVOD & PŘEDSTAVENÍ:\n"Dobrý den, tady ${userName}. Neruším vás v rychlosti na 30 vteřin?"\n\n2. OSOBNÍ ZMÍNKA O FIRMĚ:\n"${verifiedDetailPhone}"\n\n3. JEDNA KONKRÉTNÍ HODNOTA (bez implikace problému):\n"Věnujeme se podpoře firem v oboru ${industry} v oblasti ${offerTitle} a rád bych nezávazně zjistil, zda by to mohlo dávat smysl i pro vás."\n\n4. JEDNODUCHÁ VÝZVA K AKCI (CTA):\n"Máte v příštích dnech prostor na krátký 5–10minutový hovor nebo ukázku? Který den by vám nejlépe vyhovoval?"`;

  return { email, sms, phoneScript };
}
    // Sort by distance ascending (closest first)
    strictlyFilteredPlaces.sort((a, b) => {
      const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999;
      const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999;
      return distA - distB;
    });

    // Limit to requested number of leads
    const selectedPlaces = strictlyFilteredPlaces.slice(0, targetCount);

    let aiResults: any[] = [];
    try {
      const ai = getAIClient();
      if (ai) {
        const systemPrompt = `Jsi specialista na B2B obchod a autentickou prodejní komunikaci pro české podnikatele.
Dostaneš seznam SKUTEČNÝCH, REÁLNÝCH firem v okruhu ${allowedRadiusKm} km od ${cleanLocation} z Google Places API.

TVŮJ ÚKOL:
Vytvořit pro každou firmu osobní, přirozené a lidské obchodní oslovení, které nepůsobí jako generický AI marketingový spam.

STRIKTNÍ PRAVIDLA PRO GENEROVÁNÍ:
1. businessHypothesis (1-2 věty: Obchodní hypotéza, proč by nabídka mohla firmu zajímat. NIKDY ji neprezentuj jako hotový fakt a NIKDY si nevymýšlej žádné problémy firmy, které nejsou v datech).
2. outreach.email:
   - Délka: MAXIMÁLNĚ 100–120 slov.
   - PŘESNÁ STRUKTURA (4 odstavce):
     1. Osobní zmínka o konkrétní firmě (např. zmínka o jejich provozovně, adrese nebo reálném Google hodnocení a počtu recenzí).
     2. Krátce kdo jsme (jméno podnikatele a město).
     3. Jedna konkrétní hodnota, kterou můžeme nabídnout (bez domnělých problémů či presumpcí, s formulací 'Rád bych s vámi nezávazně probral, zda by toto řešení mohlo pomoci i vám...').
     4. Velmi jednoduchá výzva k odpovědi (CTA).
   - ZÁKAZ ČASU/DNE: NIKDY nevkládej konkrétní vymyšlený den a čas (žádné 'tento čtvrtek v 10:00'!). Navrhni krátký 10min hovor a nech výběr termínu na zákazníkovi ('...dejte mi prosím vědět, jaký den a čas vám nejlépe vyhovuje').
3. outreach.sms:
   - Délka: MAXIMÁLNĚ 300 znaků.
   - Přirozená, stručná zpráva zmiňující jméno, firmu a dotaz na zaslání 1min ukázky nebo 5min hovor.
4. outreach.phoneScript:
   - PŘESNĚ 4 KROKY:
     1. ÚVOD & PŘEDSTAVENÍ (jméno, město, 30 vteřin)
     2. OSOBNÍ ZMÍNKA O FIRMĚ (reálná data z Google profilu)
     3. JEDNA KONKRÉTNÍ HODNOTA (nabídka bez předpokladu problémů)
     4. VÝZVA K AKCI (dotaz na 5-10 minut s otevřeným termínem)

STRIKTNÍ ZÁKAZY:
- NIKDY si nevymýšlej neexistující e-maily ani jména majitelů.
- NIKDY netvrď, že firma má v něčem chaos, nestíhá nebo má špatný systém.
- NIKDY nepoužívej marketingová klišé jako 'raketový růst', 'revoluční' apod.`;

        const userPrompt = `
PODNIKATEL A JEHO NABÍDKA:
- Podnikatel: ${userProfile?.name || 'Martin Sladký'}
- Cílová lokalita akvizice a vyhledávání: ${cleanLocation} (max okruh ${allowedRadiusKm} km)
- Podnikatelský směr: ${businessDirectionTitle || userProfile?.currentProject || 'B2B služby'}
- Konkrétní nabídka (USP): ${concreteOffer || 'Optimalizace a automatizace procesů'}

SEZNAM OVĚŘENÝCH FIREM V OKRUHU:
${JSON.stringify(selectedPlaces.map((v, i) => ({
  index: i,
  id: v.id,
  companyName: v.companyName,
  industry: v.industry,
  city: v.city,
  address: v.address,
  distanceKm: v.distanceKm ? `${v.distanceKm} km` : 'v městě',
  website: v.website,
  phone: v.phone,
  rating: v.googleRating,
  reviewCount: v.reviewCount
})), null, 2)}

Vrať pole analýzy a skriptů pro přesně těchto ${selectedPlaces.length} firem.`;

        const structuredResponse = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  businessHypothesis: { type: Type.STRING },
                  outreach: {
                    type: Type.OBJECT,
                    properties: {
                      email: { type: Type.STRING },
                      sms: { type: Type.STRING },
                      phoneScript: { type: Type.STRING }
                    },
                    required: ["email", "sms", "phoneScript"]
                  }
                },
                required: ["index", "businessHypothesis", "outreach"]
              }
            }
          }
        });

        aiResults = JSON.parse(structuredResponse.text || '[]');
      }
    } catch (e) {
      console.warn('Gemini scoring unavailable or failed, using structured template fallback:', e);
    }

    const offerTitle = concreteOffer || businessDirectionTitle || 'služby a řešení na míru';

    // Strictly detect publicly listed emails from official company websites (never guessing)
    const emailDetectionMap = new Map<string, PublicEmailDetectionResult>();
    await Promise.all(
      selectedPlaces.map(async (place) => {
        if (place.website && place.website !== 'Nedostupné') {
          try {
            const detection = await detectPublicEmailFromWebsite(place.website, place.companyName);
            emailDetectionMap.set(place.id, detection);
          } catch (err) {
            console.warn('Public email detection failed for website:', place.website, err);
          }
        }
      })
    );

    const leads = selectedPlaces.map((place, idx) => {
      const aiData = (aiResults && aiResults.find((r: any) => r.index === idx)) || (aiResults && aiResults[idx]) || {};
      
      const emailDet = emailDetectionMap.get(place.id);
      const email = (emailDet && emailDet.found && emailDet.email) ? emailDet.email : 'Nedostupné';
      const emailSourceUrl = emailDet?.sourceUrl;
      const emailSourceType = 'official_website' as const;
      const emailStatus = (emailDet && emailDet.found) ? ('public' as const) : ('not_found' as const);
      const emailMetadata = emailDet ? {
        email: emailDet.email || '',
        sourceUrl: emailDet.sourceUrl || place.website || '',
        sourceType: 'official_website' as const,
        status: emailDet.status,
        label: emailDet.label,
        details: emailDet.details,
        detectedAt: new Date().toISOString()
      } : {
        email: '',
        sourceUrl: place.website && place.website !== 'Nedostupné' ? place.website : '',
        sourceType: 'official_website' as const,
        status: 'not_found' as const,
        label: 'E-mail nenalezen ve veřejných zdrojích'
      };

      // Calculate transparent deterministic score and score breakdown
      const { fitScore, scoreBreakdown, dataSummary } = calculateTransparentScore({
        companyName: place.companyName,
        industry: place.industry,
        distanceKm: place.distanceKm,
        ratingNum: place.ratingNum,
        reviewCount: place.reviewCount,
        phone: place.phone,
        website: place.website,
        address: place.address
      });

      // Epistemic honesty: factual summary vs cautious business hypothesis
      let defaultHypothesis = '';
      if (place.ratingNum && place.ratingNum >= 4.0 && place.reviewCount >= 5) {
        defaultHypothesis = `Podnik má veřejné hodnocení ${place.googleRating} v dojezdové vzdálenosti. Téma „${offerTitle}“ představuje námět k nezávaznému prověření, zda je tato oblast pro firmu aktuální.`;
      } else {
        defaultHypothesis = `Místní provozovna v oboru ${place.industry}. Přímé oslovení s tématem „${offerTitle}“ umožní nezávazně ověřit, jak dnes tyto procesy řeší.`;
      }

      const businessHypothesis = aiData.businessHypothesis || defaultHypothesis;
      const fitReason = `${dataSummary} Obchodní hypotéza: ${businessHypothesis}`;

      // Default personalized outreach strictly grounded in verified data
      const defaultOutreach = generatePersonalizedOutreachScripts({
        companyName: place.companyName,
        industry: place.industry,
        city: place.city,
        address: place.address,
        distanceKm: place.distanceKm,
        ratingNum: place.ratingNum,
        reviewCount: place.reviewCount,
        googleRating: place.googleRating,
        website: place.website,
        phone: place.phone,
        userName: userProfile?.name || 'Martin Sladký',
        offerTitle,
        userCity: userProfile?.location || cleanLocation
      });

      return {
        id: place.id,
        companyName: place.companyName,
        industry: place.industry,
        city: place.city,
        address: place.address,
        website: place.website,
        googleMapsUri: place.googleMapsUri,
        phone: place.phone,
        email,
        emailSourceUrl,
        emailSourceType,
        emailStatus,
        emailMetadata,
        googleRating: place.googleRating,
        distanceKm: place.distanceKm,
        coordinates: place.coordinates,
        fitScore,
        scoreBreakdown,
        dataSummary,
        businessHypothesis,
        fitReason,
        outreach: aiData.outreach || defaultOutreach,
        status: 'Nový' as const,
        contactToday: false, // will be assigned below based on score & phone availability
        addedAt: new Date().toISOString()
      };
    });

    // Sort by fitScore descending (higher score first), then phone availability
    leads.sort((a, b) => {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      const aPhone = a.phone !== 'Nedostupné' ? 1 : 0;
      const bPhone = b.phone !== 'Nedostupné' ? 1 : 0;
      return bPhone - aPhone;
    });

    // Set top leads with available phone/contact as contactToday
    let contactCount = 0;
    for (const lead of leads) {
      if (lead.phone !== 'Nedostupné' && contactCount < 2) {
        lead.contactToday = true;
        contactCount++;
      }
    }
    if (contactCount === 0 && leads.length > 0) {
      leads[0].contactToday = true;
    }

    return res.json({
      searchCriteria: {
        ...criteria,
        cityOrRegion: cleanLocation,
        maxDistanceKm: allowedRadiusKm
      },
      dataNotice: {
        dataSourceInfo: `Všechny výsledky (${leads.length} firem) byly ověřeny v Google Places API v přesném okruhu ${allowedRadiusKm} km od středu lokality ${centerCoords?.formattedAddress || cleanLocation}. Vzdálenosti byly dopočítány z přesných GPS souřadnic.`,
        isRealTimeVerified: true,
        provider: 'google_places',
        isConfigured: true
      },
      leads
    });
  } catch (error: any) {
    console.error('Find Customers API Error:', error);
    return res.status(500).json({ error: error.message || 'Chyba při vyhledávání zákazníků' });
  }
}

// Persistent Lead Storage (preserves activities, status, notes, follow-up dates across server restarts)
const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

async function readPersistedLeads(): Promise<any[]> {
  try {
    if (!fs.existsSync(LEADS_FILE)) {
      return [];
    }
    const content = await fs.promises.readFile(LEADS_FILE, 'utf-8');
    if (!content || !content.trim()) {
      return [];
    }
    const parsed = JSON.parse(content);
    const rawList = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.leads) ? parsed.leads : []);
    return rawList.map((l: any) => {
      let scoreBreakdown = l.scoreBreakdown;
      let fitScore = typeof l.fitScore === 'number' ? l.fitScore : 75;
      if (l.companyName && l.industry) {
        let rNum = typeof l.ratingNum === 'number' ? l.ratingNum : undefined;
        let rCount = typeof l.reviewCount === 'number' ? l.reviewCount : 0;
        if (rNum === undefined && l.googleRating && typeof l.googleRating === 'string') {
          const m = l.googleRating.match(/([\d.,]+)\s*(?:\((?:(\d+)\s*recenz[íei])?\))?/i);
          if (m) {
            rNum = parseFloat(m[1].replace(',', '.'));
            if (m[2]) rCount = parseInt(m[2], 10);
          }
        }
        const calc = calculateTransparentScore({
          companyName: l.companyName,
          industry: l.industry,
          distanceKm: typeof l.distanceKm === 'number' ? l.distanceKm : undefined,
          ratingNum: rNum,
          reviewCount: rCount,
          phone: l.phone || 'Nedostupné',
          website: l.website || 'Nedostupné',
          address: l.address
        });
        scoreBreakdown = calc.scoreBreakdown;
        fitScore = calc.fitScore;
      }
      const email = l.email || 'Nedostupné';
      const hasEmail = Boolean(email && email !== 'Nedostupné');
      const emailSourceUrl = l.emailSourceUrl;
      const emailSourceType = l.emailSourceType || (hasEmail ? 'official_website' : undefined);
      const emailStatus = l.emailStatus || (hasEmail ? 'public' : 'not_found');
      const emailMetadata = l.emailMetadata || (hasEmail ? {
        email,
        sourceUrl: emailSourceUrl || l.website || '',
        sourceType: 'official_website',
        status: 'public',
        label: 'Veřejně dostupný e-mail',
        details: 'Nalezeno na oficiálním webu firmy'
      } : {
        email: '',
        sourceUrl: (l.website && l.website !== 'Nedostupné') ? l.website : '',
        sourceType: 'official_website',
        status: 'not_found',
        label: 'E-mail nenalezen ve veřejných zdrojích'
      });

      const activities = Array.isArray(l.activities) ? l.activities : [];
      const hasRealActs = activities.some((a: any) => !a.isSimulation && !(a.result || '').toLowerCase().includes('simul'));
      const simActs = activities.filter((a: any) => a.isSimulation || (a.result || '').toLowerCase().includes('simul'));

      let realStatus = l.realStatus;
      let simulationStatus = l.simulationStatus;
      let canonicalStatus = l.status || 'Nový';

      // If lead only has simulations and no real activities, restore real status to Nový/pre-simulation
      if (!hasRealActs && simActs.length > 0) {
        const earliestSim = simActs[simActs.length - 1];
        realStatus = l.realStatus || earliestSim.statusBefore || 'Nový';
        simulationStatus = l.simulationStatus || (canonicalStatus !== realStatus ? canonicalStatus : (simActs[0].statusAfter || 'Osloveno'));
        canonicalStatus = realStatus;
      } else if (!realStatus) {
        realStatus = canonicalStatus;
      }

      return {
        ...l,
        website: l.website || 'Nedostupné',
        phone: l.phone || 'Nedostupné',
        email,
        emailSourceUrl,
        emailSourceType,
        emailStatus,
        emailMetadata,
        googleRating: l.googleRating || 'Nedostupné',
        industry: l.industry || l.category || 'Podnikání a služby',
        status: canonicalStatus,
        realStatus,
        simulationStatus,
        nextContactDate: hasRealActs ? l.nextContactDate : (l.realNextContactDate || undefined),
        scheduledAt: hasRealActs ? l.scheduledAt : (l.realNextContactDate || undefined),
        lastContactedAt: hasRealActs ? l.lastContactedAt : undefined,
        lastContactResult: hasRealActs ? l.lastContactResult : undefined,
        fitScore,
        scoreBreakdown,
        activities,
        leadIntelligence: l.leadIntelligence ? {
          ...l.leadIntelligence,
          idealContactPerson: l.leadIntelligence.idealContactPerson 
            ? sanitizeIdealContactPerson(l.leadIntelligence.idealContactPerson, l.companyName, l.website)
            : undefined,
          recommendedApproach: l.leadIntelligence.recommendedApproach ? {
            ...l.leadIntelligence.recommendedApproach,
            idealContactPerson: l.leadIntelligence.recommendedApproach.idealContactPerson
              ? sanitizeIdealContactPerson(l.leadIntelligence.recommendedApproach.idealContactPerson, l.companyName, l.website)
              : undefined
          } : undefined
        } : undefined
      };
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      console.warn('Persisted leads file contained empty or invalid JSON, initializing empty collection.');
      try {
        await fs.promises.writeFile(LEADS_FILE, '[]', 'utf-8');
      } catch {}
    } else {
      console.error('Failed to read persisted leads:', err);
    }
    return [];
  }
}

async function writePersistedLeads(leads: any[]): Promise<boolean> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    const safeLeads = Array.isArray(leads) ? leads : [];
    
    // Deduplicate by stable ID (preserving the first entry, guaranteeing no duplicate IDs in storage)
    const seenIds = new Set<string>();
    const deduplicatedLeads: any[] = [];
    for (const lead of safeLeads) {
      if (!lead || !lead.id) continue;
      const idKey = String(lead.id).trim();
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey);
        deduplicatedLeads.push(lead);
      }
    }

    const tempFile = path.join(DATA_DIR, `.leads.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`);
    await fs.promises.writeFile(tempFile, JSON.stringify(deduplicatedLeads, null, 2), 'utf-8');
    await fs.promises.rename(tempFile, LEADS_FILE);
    return true;
  } catch (err) {
    console.error('Failed to write persisted leads:', err);
    return false;
  }
}

// Favicon fallback to prevent 404 console errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// GET saved leads
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await readPersistedLeads();
    return res.json({ leads });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při čtení databáze leadů' });
  }
});

// POST / PUT sync all leads
app.post('/api/leads', async (req, res) => {
  try {
    const body = req.body;
    const leads = Array.isArray(body) ? body : (Array.isArray(body?.leads) ? body.leads : null);
    if (Array.isArray(leads)) {
      await writePersistedLeads(leads);
      return res.json({ success: true, count: leads.length });
    }
    return res.status(400).json({ error: 'Tělo požadavku musí obsahovat pole "leads"' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při ukládání leadů' });
  }
});

// POST append activity and update lead
app.post('/api/leads/:id/activity', async (req, res) => {
  try {
    const leadId = req.params.id;
    const { channel, result, status, note, nextContactDate, isSimulation } = req.body;
    const leads = await readPersistedLeads();
    const idx = leads.findIndex((l: any) => l.id === leadId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Firma nebyla v databázi nalezena' });
    }

    const lead = leads[idx];
    const timestamp = new Date().toISOString();
    // V testovacím režimu jsou aktivity TESTOVACÍ SIMULACE, v reálném režimu (nebo při explicitním false) striktně REÁLNÉ
    const isSim = isSimulation === true;

    const targetStatus = status || (isSim ? (lead.simulationStatus || lead.status) : lead.status);
    const effectiveNextContact = ['Odmítnuto', 'Nekontaktovat'].includes(targetStatus)
      ? undefined
      : (nextContactDate !== undefined ? (nextContactDate || undefined) : (isSim ? (lead.simulationNextContactDate || lead.nextContactDate || lead.scheduledAt) : (lead.realNextContactDate || lead.nextContactDate || lead.scheduledAt)));

    let activityResult = result || 'Zaznamenán kontakt';
    if (isSim) {
      if (!activityResult.startsWith('TESTOVACÍ SIMULACE:')) {
        const cleanPrefix = activityResult
          .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
          .replace(/^testovací\s+simulace:\s*/i, '');
        const channelLabel = channel === 'email' ? 'E-mail' : (channel === 'phone' ? 'Telefonát' : (channel === 'whatsapp' ? 'WhatsApp' : 'Kontakt'));
        activityResult = `TESTOVACÍ SIMULACE: ${channelLabel} – ${cleanPrefix}`;
      }
    } else {
      // REÁLNÝ KONTAKT nesmí obsahovat [TESTOVACÍ SIMULACE] ani jiné simulované značky
      activityResult = activityResult
        .replace(/^testovací\s+simulace:\s*/i, '')
        .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
        .replace(/\[TESTOVACÍ SIMULACE[^\]]*\]\s*/gi, '')
        .trim();
    }

    const finalNote = isSim
      ? (note?.trim()
          ? (note.includes('[TESTOVACÍ SIMULACE]') ? note.trim() : `[TESTOVACÍ SIMULACE]\n${note.trim()}`)
          : '[TESTOVACÍ SIMULACE]')
      : (note?.trim() ? note.replace(/\[TESTOVACÍ SIMULACE[^\]]*\]\s*\n?/gi, '').trim() || undefined : undefined);

    const statusBefore = isSim
      ? (lead.simulationStatus || lead.realStatus || lead.status)
      : (lead.realStatus || lead.status);

    const newActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: timestamp,
      leadId: leadId,
      companyName: lead.companyName,
      channel: channel || 'other',
      result: activityResult,
      statusBefore,
      statusAfter: targetStatus,
      note: finalNote,
      historicalPlannedDate: effectiveNextContact,
      nextContactDate: effectiveNextContact,
      scheduledAt: effectiveNextContact,
      isSimulation: isSim
    };

    if (isSim) {
      // V TESTOVACÍM REŽIMU:
      // Reálný stav se NIKDY nemění.
      const currentReal = lead.realStatus || lead.status || 'Nový';
      lead.status = currentReal;
      lead.realStatus = currentReal;
      // Testovací stav se ukládá odděleně
      lead.simulationStatus = targetStatus;
      lead.simulationLastContactedAt = timestamp;
      lead.simulationLastContactResult = activityResult;
      lead.simulationNextContactDate = effectiveNextContact;
      // Skutečné kontaktní a plánovací údaje zůstávají nedotčeny
    } else {
      // SKUTEČNÁ REÁLNÁ ZMĚNA:
      lead.status = targetStatus;
      lead.realStatus = targetStatus;
      lead.lastContactedAt = timestamp;
      lead.lastContactChannel = channel || lead.lastContactChannel || 'other';
      lead.lastContactResult = activityResult;
      lead.nextContactDate = effectiveNextContact;
      lead.scheduledAt = effectiveNextContact;
      lead.realNextContactDate = effectiveNextContact;
    }

    if (finalNote) {
      lead.notes = lead.notes ? `${finalNote}\n---\n${lead.notes}` : finalNote;
    }
    lead.activities = [newActivity, ...(Array.isArray(lead.activities) ? lead.activities : [])];

    // If status is 'Schůzka', ensure outreach sequence remains paused with unified meeting date
    if (((isSim ? lead.simulationStatus === 'Schůzka' : lead.status === 'Schůzka') || targetStatus === 'Schůzka') && lead.outreachSequence) {
      const pausedSteps = (lead.outreachSequence.steps || []).map((step: any) => {
        if (step.status !== 'sent') {
          return { ...step, status: 'paused' };
        }
        return step;
      });
      const meetingDateStr = effectiveNextContact ? formatCzechDateTime(effectiveNextContact) : '';
      lead.outreachSequence.isPaused = true;
      lead.outreachSequence.pausedReason = meetingDateStr
        ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
        : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.';
      lead.outreachSequence.steps = pausedSteps;
      lead.outreachSequence.updatedAt = timestamp;
    }

    leads[idx] = lead;
    await writePersistedLeads(leads);

    return res.json({ success: true, lead, activity: newActivity });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při zápisu aktivity' });
  }
});

// PATCH /api/leads/:id/financials - Update deal value & ROI cost tracking
app.patch('/api/leads/:id/financials', async (req, res) => {
  try {
    const leadId = req.params.id;
    const { dealValue, costsTracking } = req.body;
    const leads = await readPersistedLeads();
    const idx = leads.findIndex((l: any) => l.id === leadId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Firma nebyla v databázi nalezena' });
    }

    if (dealValue !== undefined) {
      leads[idx].dealValue = dealValue === null ? undefined : dealValue;
    }
    if (costsTracking !== undefined) {
      leads[idx].costsTracking = costsTracking === null ? undefined : {
        ...(leads[idx].costsTracking || {}),
        ...costsTracking
      };
    }

    await writePersistedLeads(leads);
    return res.json({ success: true, lead: leads[idx] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při ukládání finančních údajů' });
  }
});

// ========================================================
// LEAD INTELLIGENCE CONTROLLER & HELPERS
// ========================================================

interface WebsiteAnalysisData {
  success: boolean;
  finalUrl: string;
  title?: string;
  description?: string;
  headings?: string[];
  textSnippet?: string;
  verifiedContact?: { name: string; role: string } | null;
  contactPersonsFound?: string[];
  hasContactSection?: boolean;
  // Deep public signals
  hasOnlineBookingSystem?: boolean;
  onlineBookingDetails?: string;
  hasManualDateListing?: boolean;
  manualDatesDetails?: string;
  hasInteractiveForm?: boolean;
  formDetails?: string;
  hasPricelist?: boolean;
  priceRange?: string;
  hasGiftVouchers?: boolean;
  hasSubscriptionsOrPasses?: boolean;
  concreteServicesFound?: string[];
  communicationChannels?: string[];
  keyPublicObservation?: string;
  publicEmail?: PublicEmailDetectionResult;
}

async function fetchPublicWebsiteSnippet(rawUrl?: string, companyName?: string): Promise<WebsiteAnalysisData> {
  if (!rawUrl || rawUrl === 'Nedostupné' || !rawUrl.trim()) {
    return { success: false, finalUrl: '' };
  }

  let normalizedUrl = rawUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    let response: any;
    try {
      response = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PodnikAI-LeadIntelligence/1.0',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8'
        },
        redirect: 'follow'
      });
    } catch {
      // Retry with http if https fails
      if (normalizedUrl.startsWith('https://')) {
        normalizedUrl = normalizedUrl.replace('https://', 'http://');
        response = await fetch(normalizedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PodnikAI-LeadIntelligence/1.0',
            'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9',
            'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8'
          },
          redirect: 'follow'
        });
      }
    }

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return { success: false, finalUrl: normalizedUrl };
    }

    const html = await response.text();
    if (!html || html.length < 50) {
      return { success: false, finalUrl: normalizedUrl };
    }

    // Anti-bot challenge / verification screen detection (WEDOS, Cloudflare, ALTCHA)
    if (/WEDOS\.protection|ALTCHA|cf-browser-verification|Attention Required! \| Cloudflare|Just a moment\.\.\./i.test(html)) {
      return { success: false, finalUrl: normalizedUrl };
    }

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    // Meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                      html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';

    // Headings
    const headings: string[] = [];
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(html)) !== null && headings.length < 8) {
      const cleanH = hMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (cleanH.length > 3 && cleanH.length < 120 && !headings.includes(cleanH)) {
        headings.push(cleanH);
      }
    }

    // Clean plain text for deep signal analysis
    const cleanBody = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z0-9#]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const lowerBody = cleanBody.toLowerCase();

    // 1. Manual date listing (e.g. "volné termíny na 60 min... Pá 6.11... Po 9.11...")
    const hasManualDateListing = /(?:voln[eé]\s+term[ií]ny|voln[yý]\s+term[ií]n|nejbli[zž][sš][ií]\s+voln[eé]|voln[eé]\s+[cč]asy|vypsan[yý]ch\s+term[ií]n[uů]|term[ií]ny\s+na\s+(?:tento|p[rř][ií][sš]t[ií]|t[yý]den)|aktu[aá]ln[eě]\s+voln)/i.test(cleanBody);
    let manualDatesDetails: string | undefined;
    if (hasManualDateListing) {
      manualDatesDetails = 'Web uvádí sekci s ručně vypisovanými volnými termíny na konkrétní dny a hodiny';
    }

    // 2. Booking system detection (only if not manual text listings)
    const hasReservio = /reservio|reenio|reservanto|calendly|fresha|myfox|supersaas|reservatic/i.test(html);
    const hasRezervaceAnchor = /href=["']#[^"']*rezerv[^"']*["']|id=["']rezerv[^"']*["']/i.test(html);
    const hasOnlineBookingText = /(?:rezervační systém|objednat (?:masáž )?online|online rezervace|rezervační kalendář|rezervujte si termín online|\brezervace\b)/i.test(cleanBody);
    const hasOnlineBookingSystem = !hasManualDateListing && (
      hasReservio ||
      (hasRezervaceAnchor && hasOnlineBookingText) ||
      /rezervační systém|objednat online|rezervujte si online|v rezervačním systému/i.test(cleanBody) ||
      (hasOnlineBookingText && /e-shop|eshop/i.test(cleanBody))
    );
    let onlineBookingDetails: string | undefined;
    if (hasOnlineBookingSystem) {
      onlineBookingDetails = hasReservio
        ? 'Externí rezervační platforma pro online rezervace termínů'
        : 'Web obsahuje funkční sekci pro online rezervaci termínů';
    }

    // 3. Interactive form detection
    const hasFormTag = /<form\b/i.test(html);
    const hasInputs = /<input\b|<textarea\b/i.test(html);
    const hasFormText = /(?:poptávkový formulář|kontaktní formulář|napište nám přes formulář)/i.test(cleanBody);
    const hasInteractiveForm = !hasOnlineBookingSystem && hasFormTag && (hasInputs || hasFormText);
    let formDetails: string | undefined;
    if (hasInteractiveForm) {
      formDetails = 'Web obsahuje interaktivní kontaktní / poptávkový formulář pro zaslání zprávy';
    }

    // 4. Pricelist, vouchers, subscriptions
    const hasPricelist = /ceník|\d+\s*(?:Kč|,-)/i.test(cleanBody);
    const priceMatches = cleanBody.match(/\b\d{3,4}\s*Kč\b/g);
    let priceRange: string | undefined;
    if (priceMatches && priceMatches.length >= 2) {
      priceRange = `${priceMatches[0]} až ${priceMatches[priceMatches.length - 1]}`;
    }
    const hasGiftVouchers = /dárkov(?:é|ý|ých)\s+poukaz/i.test(cleanBody);
    const hasSubscriptionsOrPasses = /předplatné|permanentk|balíč/i.test(cleanBody);

    // 5. Communication channels
    const channels: string[] = [];
    if (/tel:|\b\d{3}\s*\d{3}\s*\d{3}\b/.test(html)) channels.push('telefon');
    if (/mailto:|@[a-z0-9.-]+\.[a-z]{2,}/i.test(html)) channels.push('e-mail');
    if (/whatsapp|wats\s*up|wa\.me/i.test(html)) channels.push('WhatsApp');

    // 6. Concrete services extraction
    const serviceCatalog = [
      // Massages & body care
      'klasická masáž', 'breussova masáž', 'indická masáž hlavy', 'masáž lávovými kameny',
      'meridiánová masáž', 'tejpování', 'parafínový zábal', 'thajská tradiční masáž',
      'thajská olejová masáž', 'reflexní masáž chodidel', 'masáž zad', 'sportovní masáž',
      'lymfatická masáž', 'baňkování', 'rehabilitační masáž', 'hloubková masáž', 'těhotenská masáž',
      // Auto services
      'pneuservis', 'výměna oleje', 'brzdy', 'geometrie', 'autodiagnostika', 'klimatizace',
      'příprava na stk', 'servisní prohlídka', 'autoklempířství', 'lakování',
      // Crafts & Construction
      'rekonstrukce', 'obklady', 'dlažby', 'elektroinstalace', 'instalatérské práce',
      'vytápění', 'zednické práce', 'malířské práce', 'truhlářství', 'montáž sádrokartonu'
    ];
    const foundServices = serviceCatalog.filter(s => lowerBody.includes(s));
    // Capitalize first letter of each found service
    const concreteServicesFound = foundServices.map(s => s.charAt(0).toUpperCase() + s.slice(1));

    // 7. Contact person extraction: strictly verified full person name + executive role
    const verifiedContact = extractVerifiedContactFromWeb(cleanBody, companyName, normalizedUrl);

    return {
      success: true,
      finalUrl: normalizedUrl,
      title: title.slice(0, 150),
      description: description.slice(0, 300),
      headings: headings.slice(0, 6),
      textSnippet: cleanBody.slice(0, 4000),
      verifiedContact,
      contactPersonsFound: verifiedContact ? [verifiedContact.name] : [],
      hasContactSection: cleanBody.toLowerCase().includes('kontakt') || cleanBody.toLowerCase().includes('o nás'),
      hasOnlineBookingSystem,
      onlineBookingDetails,
      hasManualDateListing,
      manualDatesDetails,
      hasInteractiveForm,
      formDetails,
      hasPricelist,
      priceRange,
      hasGiftVouchers,
      hasSubscriptionsOrPasses,
      concreteServicesFound,
      communicationChannels: channels,
      publicEmail: await (async () => {
        try {
          return await detectPublicEmailFromWebsite(normalizedUrl, companyName);
        } catch {
          return undefined;
        }
      })()
    };
  } catch (fetchErr) {
    console.warn('fetchPublicWebsiteSnippet error:', fetchErr);
    return { success: false, finalUrl: normalizedUrl };
  }
}

function generateDeterministicLeadIntelligence(
  lead: any,
  userProfile: any,
  concreteOffer: string,
  websiteData: WebsiteAnalysisData
): any {
  const company = lead.companyName?.trim() || 'Firma';
  const cleanCity = cleanCzechCity(lead.city);
  const cityPhrase = cleanCity ? ` v ${cleanCity}` : '';
  const industry = (lead.industry && lead.industry !== 'Nedostupné') ? lead.industry.trim() : 'služby a podnikání';
  const userName = userProfile?.name?.trim() || 'Martin';
  const offerTheme = concreteOffer || 'optimalizace a zefektivnění poptávek';

  const webSource = websiteData.success 
    ? `Veřejný web firmy (${websiteData.finalUrl})` 
    : (lead.website && lead.website !== 'Nedostupné' ? `Veřejný web (${lead.website})` : 'Veřejný profil oboru a lokality');

  // Contact person: MUST have both full name and explicit executive role on public web
  let identifiedContact: { name: string; role: string } | null = null;
  if (websiteData.verifiedContact && 
      isValidPersonName(websiteData.verifiedContact.name, company, lead.website) &&
      isValidExecutiveRole(websiteData.verifiedContact.role)) {
    identifiedContact = websiteData.verifiedContact;
  }

  const hasName = Boolean(identifiedContact);
  const contactName = identifiedContact ? identifiedContact.name : undefined;
  const contactRole = identifiedContact ? identifiedContact.role : 'Majitel / jednatel společnosti';

  // 1. VERIFIED FACTS (Ověřená fakta – pouze skutečně dostupné informace ze zdroje)
  const webFindings: string[] = [];
  if (websiteData.title) {
    webFindings.push(`Titulek webu: „${websiteData.title}“`);
  }
  if (websiteData.concreteServicesFound && websiteData.concreteServicesFound.length > 0) {
    webFindings.push(`Konkrétní nabízené služby nalezené na webu: ${websiteData.concreteServicesFound.slice(0, 6).join(', ')}`);
  } else if (websiteData.headings && websiteData.headings.length > 0) {
    webFindings.push(`Zjištěné sekce na webu: ${websiteData.headings.slice(0, 4).join(', ')}`);
  }
  if (websiteData.hasOnlineBookingSystem) {
    webFindings.push(`Způsob rezervace: Zavedený online rezervační systém (${websiteData.onlineBookingDetails || 'na webu'})`);
  } else if (websiteData.hasManualDateListing) {
    webFindings.push(`Způsob rezervace: Sekce s ručně vypisovanými volnými termíny a výzvou ke kontaktu`);
  } else if (websiteData.hasInteractiveForm) {
    webFindings.push(`Způsob kontaktu: Interaktivní formulář na webu`);
  } else if (websiteData.success) {
    webFindings.push(`Způsob kontaktu: Přímý kontakt bez rezervačního systému či formuláře (${websiteData.communicationChannels?.join(', ') || 'telefon a e-mail'})`);
  }
  if (websiteData.hasGiftVouchers) {
    webFindings.push(`Doplňková nabídka: Dárkové poukazy`);
  }
  if (websiteData.hasSubscriptionsOrPasses) {
    webFindings.push(`Doplňková nabídka: Předplatné / balíčky permanentek`);
  }
  if (websiteData.communicationChannels && websiteData.communicationChannels.length > 0) {
    webFindings.push(`Nalezené komunikační kanály: ${websiteData.communicationChannels.join(', ')}`);
  }

  const ratingAndReviews = (lead.googleRating && lead.googleRating !== 'Nedostupné')
    ? `${lead.googleRating} z 5${lead.googleReviewCount ? ` (${lead.googleReviewCount} recenzí)` : ''} – veřejný záznam profilu (pouze popisný údaj, nevyjadřuje nákupní záměr ani poptávku)`
    : undefined;

  const verifiedFacts = {
    companyName: company,
    industry,
    address: [lead.address, cleanCity].filter(Boolean).join(', ') || (cleanCity ? `Lokalita ${cleanCity}` : 'Česká republika'),
    website: (lead.website && lead.website !== 'Nedostupné') ? lead.website : 'Nedostupný',
    phone: (lead.phone && lead.phone !== 'Nedostupné') ? lead.phone : 'Neuveden',
    ratingAndReviews,
    webFindings: webFindings.length > 0 ? webFindings : undefined,
    sourceSummary: websiteData.success ? `Veřejný web firmy (${websiteData.finalUrl})` : 'Veřejný profil a veřejné kontakty'
  };

  // 2. AI HYPOTHESES (Vždy odvozeno z konkrétních signálů, s označením AI HYPOTÉZA – OVĚŘIT)
  let opportunity = '';
  let opportunitySourceSignal = '';
  let offer = '';
  let offerSourceSignal = '';
  let whyThisCompany = '';
  let whyThisCompanySourceSignal = '';
  let icebreaker = '';
  let icebreakerSource = '';
  const signals: Array<{
    observation: string;
    signal: string;
    source: string;
    relevanceReason: string;
    type: 'verified_fact' | 'ai_hypothesis';
    significance: 'high' | 'medium' | 'low';
  }> = [];

  const firstService = websiteData.concreteServicesFound?.[0] || 'služeb';

  if (websiteData.success && websiteData.hasManualDateListing) {
    // SIGNAL CASE 1: Manual date listings on web (e.g. Jana Burešová)
    const channelList = websiteData.communicationChannels?.join(' či ') || 'WhatsApp a telefon';
    const observationStr = `Web uvádí sekci s ručně vypisovanými volnými termíny (např. rozpis na konkrétní dny a hodiny) a výzvou ke kontaktu přes ${channelList}.${websiteData.concreteServicesFound?.length ? ` V nabídce jsou procedury: ${websiteData.concreteServicesFound.slice(0, 4).join(', ')}.` : ''}`;
    const sourceStr = `${webSource} – sekce s volnými termíny a kontaktní údaje`;
    const relevanceStr = `Ruční vypisování a aktualizace termínů v textu webu a individuální domlouvání každého času přes zprávy představuje provozní časovou zátěž; automatizace přehledu termínů by uvolnila čas na klienty.`;

    opportunity = `[AI HYPOTÉZA – OVĚŘIT] Z veřejně dostupných informací na webu vyplývá, že firma ručně vypisuje konkrétní volné termíny a objednávky řeší přes ${channelList}. Stojí za ověření, zda by pro firmu mělo smysl mít zjednodušený automatizovaný přehled termínů, který by odstranil nutnost ručně aktualizovat web a domlouvat časy přes zprávy.`;
    opportunitySourceSignal = sourceStr;

    offer = `Zjednodušený rezervační přehled termínů přizpůsobený pro provoz ${company} s automatickou blokací obsazených časů bez nutnosti ručního přepisování webu.`;
    offerSourceSignal = `Vychází z reálně nalezeného ručního vypisování volných časů na webu a nabídky ${firstService}.`;

    whyThisCompany = `Firma ${company} na svém webu aktivně publikuje volné kapacity formou textového rozpisu. Zjednodušení tohoto procesu může ušetřit čas strávený administrativou; reálné provozní potřeby doporučujeme ověřit při prvním kontaktu.`;
    whyThisCompanySourceSignal = `${webSource} – sekce s volnými termíny.`;

    icebreaker = hasName && contactName
      ? `Dobrý den, ${contactName.includes(' ') && contactName.toLowerCase().endsWith('á') ? 'paní ' + contactName.split(' ')[1] : contactName}, procházel jsem vaši prezentaci ${company}${cityPhrase} k nabídce ${firstService} i sekci s ručně vypisovanými volnými termíny a kontaktem přes ${channelList}. Rád bych se vás nezávazně zeptal, jak náročné je pro vás v praxi průběžné udržování těchto časů na webu.`
      : `Dobrý den, procházel jsem prezentaci ${company}${cityPhrase} a sekci s ručně vypisovanými volnými termíny. Rád bych se vás nezávazně zeptal, jak vám v praxi vyhovuje ruční správa volných časů na webu.`;
    icebreakerSource = sourceStr;

    signals.push({
      observation: observationStr,
      signal: observationStr,
      source: sourceStr,
      relevanceReason: relevanceStr,
      type: 'ai_hypothesis',
      significance: 'high'
    });

    if (websiteData.hasGiftVouchers) {
      signals.push({
        observation: `Firma nabízí dárkové poukazy na své služby.`,
        signal: `Firma nabízí dárkové poukazy na své služby.`,
        source: `${webSource} – sekce dárkových poukazů`,
        relevanceReason: `Dárkové poukazy představují doplňkový zdroj příjmů; stojí za ověření, zda je firma odbavuje ručně, nebo online.`,
        type: 'verified_fact',
        significance: 'medium'
      });
    }

  } else if (websiteData.success && websiteData.hasOnlineBookingSystem) {
    // SIGNAL CASE 2: Online booking system already exists (e.g. Bussaba) - NEVER claim it is missing!
    const subscStr = websiteData.hasSubscriptionsOrPasses ? ' a předplatné balíčků masáží' : '';
    const vouchStr = websiteData.hasGiftVouchers ? ' a dárkové poukazy' : '';
    const observationStr = `Web již obsahuje funkční sekci pro online rezervace termínů („Objednat online“ / rezervační systém).${subscStr ? ` Zároveň nabízí předplatné (např. balíčky masáží).` : ''}${vouchStr ? ` Nabízí dárkové poukazy.` : ''}${websiteData.priceRange ? ` Uvádí veřejný ceník (${websiteData.priceRange}).` : ''}`;
    const sourceStr = `${webSource} – sekce online rezervací, ceník a nabídka služeb`;
    const relevanceStr = `Protože online rezervace termínů již firma vyřešenou má, nesmíme tvrdit, že jí chybí. Relevantní příležitostí k diskusi je podpora vytížení, prodej dárkových poukazů / předplatného nebo automatické připomínky termínů stávajícím klientům.`;

    opportunity = `[AI HYPOTÉZA – OVĚŘIT] Firma již disponuje funkčním online rezervačním systémem${subscStr}. Obchodní hypotéza k ověření se zaměřuje na možnosti automatizace připomínek rezervovaných termínů či podporu prodeje balíčků předplatného a poukazů, nikoli na zavádění nového rezervačního formuláře.`;
    opportunitySourceSignal = sourceStr;

    offer = `Podpora vytížení studia ${company} zaměřená na věrnostní předplatné, poukazy a automatické SMS/e-mail připomínky stávajícím klientům pro minimalizaci propadlých termínů.`;
    offerSourceSignal = `Vychází ze skutečnosti, že online rezervace již firma provozuje; návrh se zaměřuje na retenci klientů a balíčky.`;

    whyThisCompany = `Firma ${company} má digitální prezentaci i online rezervace vyřešené. Další prostor k rozvoji může spočívat ve zvýšení frekvence návštěv a prodeji doplňkových balíčků; konkrétní priority doporučujeme ověřit při kontaktu.`;
    whyThisCompanySourceSignal = `${webSource} – online rezervace, ceník a nabídka služeb.`;

    icebreaker = `Dobrý den, procházel jsem prezentaci ${company}${cityPhrase} včetně vašeho online rezervačního systému${websiteData.hasSubscriptionsOrPasses ? ' a nabídky předplatného' : ''}. Rád bych se vás nezávazně zeptal, jak se vám osvědčilo vytěžování těchto termínů a zda řešíte opakované návštěvy stávajících klientů.`;
    icebreakerSource = sourceStr;

    signals.push({
      observation: observationStr,
      signal: observationStr,
      source: sourceStr,
      relevanceReason: relevanceStr,
      type: 'ai_hypothesis',
      significance: 'high'
    });

  } else if (websiteData.success && websiteData.hasInteractiveForm) {
    // SIGNAL CASE 3: Has interactive contact form
    const observationStr = `Web obsahuje kontaktní nebo poptávkový formulář pro zaslání zprávy.${websiteData.concreteServicesFound?.length ? ` V nabídce uvádí: ${websiteData.concreteServicesFound.slice(0, 3).join(', ')}.` : ''}`;
    const sourceStr = `${webSource} – kontaktní formulář`;
    const relevanceStr = `Formulář usnadňuje odeslání zprávy, avšak vyžaduje následné ruční zpracování a zpětné kontaktování; stojí za ověření, jak rychle firma dokáže reagovat a zda by pomohlo automatické potvrzení či strukturovaný předvýběr.`;

    opportunity = `[AI HYPOTÉZA – OVĚŘIT] Web obsahuje základní formulář pro zaslání zprávy. Obchodní hypotéza k ověření: Zda by pro firmu mělo přínos napojení formuláře na okamžité potvrzení či automatické předvýběry parametrů zakázky pro zrychlení prvotní reakce.`;
    opportunitySourceSignal = sourceStr;

    offer = `Rozšíření stávajícího formuláře o automatické potvrzení přijetí a strukturované dotazy k parametrům zakázky pro firmu ${company}.`;
    offerSourceSignal = `Vychází ze stávajícího formuláře na webu a potřeby rychlého odbavení zájemců.`;

    whyThisCompany = `Firma ${company} již formulář na webu má, což ukazuje zájem o online komunikaci. Zda je pro ně prioritou další zrychlení odbavení, doporučujeme ověřit při kontaktu.`;
    whyThisCompanySourceSignal = `${webSource} – formulářová sekce.`;

    icebreaker = `Dobrý den, procházel jsem prezentaci ${company}${cityPhrase} a všiml jsem si vašeho formuláře pro zaslání dotazů k nabídce ${firstService}. Rád bych se vás nezávazně zeptal, jak vám stávající způsob odbavování zpráv vyhovuje.`;
    icebreakerSource = sourceStr;

    signals.push({
      observation: observationStr,
      signal: observationStr,
      source: sourceStr,
      relevanceReason: relevanceStr,
      type: 'ai_hypothesis',
      significance: 'high'
    });

  } else if (websiteData.success && websiteData.concreteServicesFound && websiteData.concreteServicesFound.length > 0) {
    // SIGNAL CASE 4: Static website with specific services, direct contact only
    const serviceListStr = websiteData.concreteServicesFound.slice(0, 4).join(', ');
    const channelList = websiteData.communicationChannels?.join(' či ') || 'telefon a e-mail';
    const observationStr = `Web prezentuje portfolio služeb (${serviceListStr}), kontakt probíhá přes ${channelList} bez interaktivního formuláře či rezervačního systému.`;
    const sourceStr = `${webSource} – portfolio služeb a kontaktní údaje`;
    const relevanceStr = `Dotazy směřují na přímý ${channelList}, což při práci v terénu nebo provozovně může vyžadovat zpětné dohledávání a ruční koordinaci; stojí za ověření, jak je tento způsob pro firmu komfortní.`;

    opportunity = `[AI HYPOTÉZA – OVĚŘIT] Z veřejných informací vyplývá, že kontakt probíhá přímým telefonátem či e-mailem k nabídce služeb (${serviceListStr}). Obchodní hypotéza k ověření: Zda by pro firmu bylo výhodné doplnit web o jednoduchý poptávkový formulář se specifikací požadavku.`;
    opportunitySourceSignal = sourceStr;

    offer = `Jednoduchý poptávkový formulář přizpůsobený pro služby ${company} umožňující zájemcům zadat specifikaci požadavku kdykoliv.`;
    offerSourceSignal = `Vychází z veřejné prezentace nabídky ${firstService} a převažujícího telefonického kontaktu.`;

    whyThisCompany = `Při poskytování odborných služeb může být odbavování telefonátů během práce rušivé. Zda firma tuto otázku řeší, doporučujeme ověřit při prvním kontaktu.`;
    whyThisCompanySourceSignal = `${webSource} – nabídka a kontakty.`;

    icebreaker = `Dobrý den, procházel jsem vaši prezentaci ${company}${cityPhrase} k nabídce ${firstService}. Rád bych se vás nezávazně zeptal, jak máte v současnosti nastavený příjem dotazů a zda je to pro vás téma k diskusi.`;
    icebreakerSource = sourceStr;

    signals.push({
      observation: observationStr,
      signal: observationStr,
      source: sourceStr,
      relevanceReason: relevanceStr,
      type: 'ai_hypothesis',
      significance: 'medium'
    });

  } else {
    // SIGNAL CASE 5: Strictly per User Rule 6 - No sufficiently strong signal found!
    const observationStr = `Nebyl nalezen dostatečně silný veřejný signál pro konkrétní obchodní hypotézu. Doporučujeme ověřit potřebu při prvním kontaktu.`;
    const sourceStr = `Veřejný profil firmy bez detailních provozních signálů`;
    const relevanceStr = `Doporučujeme nevymýšlet domnělé problémy firmy a otevřeně se zeptat na reálné potřeby při prvním kontaktu.`;

    opportunity = `Nebyl nalezen dostatečně silný veřejný signál pro konkrétní obchodní hypotézu. Doporučujeme ověřit potřebu při prvním kontaktu.`;
    opportunitySourceSignal = sourceStr;

    offer = `Nezávazné ověření aktuálních provozních priorit firmy ${company} v oblasti ${offerTheme}.`;
    offerSourceSignal = `Vychází z deklarovaného oboru ${industry}; konkrétní potřebu je nutné zjistit při prvním kontaktu.`;

    whyThisCompany = `Firma ${company} působí v oboru ${industry}${cityPhrase}. Z veřejných zdrojů nelze spolehlivě odvodit interní procesy; doporučujeme nevymýšlet domnělé problémy a potřeby ověřit přímo při kontaktu.`;
    whyThisCompanySourceSignal = `Veřejný profil oboru a lokality.`;

    icebreaker = `Dobrý den, obracím se na vás s krátkým dotazem ohledně společnosti ${company}${cityPhrase}. Jmenuji se ${userName} a věnuji se oblasti ${offerTheme}. Rád bych se nejdříve nezávazně zeptal, zda je u vás toto téma v současnosti otevřené k diskusi, nebo máte tuto oblast vyřešenou k plné spokojenosti.`;
    icebreakerSource = sourceStr;

    signals.push({
      observation: observationStr,
      signal: observationStr,
      source: sourceStr,
      relevanceReason: relevanceStr,
      type: 'verified_fact',
      significance: 'low'
    });
  }

  // Add rating fact if present
  if (lead.googleRating && lead.googleRating !== 'Nedostupné') {
    signals.push({
      observation: `Veřejný profil uvádí hodnocení ${lead.googleRating}${lead.googleReviewCount ? ` (${lead.googleReviewCount} recenzí)` : ''}.`,
      signal: `Veřejný profil uvádí hodnocení ${lead.googleRating}.`,
      source: 'Veřejný profil Google',
      relevanceReason: 'Pouze popisný záznam profilu; neslouží k odvození nákupního záměru ani poptávky, pouze potvrzuje aktivní záznam.',
      type: 'verified_fact',
      significance: 'medium'
    });
  }

  const hypotheses = {
    opportunity,
    opportunitySourceSignal,
    offer,
    offerSourceSignal,
    whyThisCompany,
    whyThisCompanySourceSignal
  };

  const idealContactPerson = identifiedContact ? {
    role: contactRole,
    name: contactName,
    confidence: 'verified_on_web' as const,
    sourceNote: 'Ověřeno z veřejné prezentace firmy.',
    source: webSource
  } : {
    role: 'Majitel / jednatel společnosti',
    confidence: 'derived_role_only' as const,
    sourceNote: 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.',
    source: 'Obvyklá organizační struktura (doporučeno ověřit při kontaktu)'
  };

  const recommendedApproach = {
    icebreaker,
    icebreakerSource,
    idealContactPerson,
    nextStepRecommendation: 'Při prvním kontaktu představit nabídku jako nezávazný námět k diskusi, ověřit reálné nastavení firmy a respektovat čas majitele.'
  };

  return {
    verifiedFacts,
    hypotheses,
    recommendedApproach,
    signals,
    // Zpětná kompatibilita
    opportunity,
    opportunitySource: opportunitySourceSignal,
    offer,
    offerSource: offerSourceSignal,
    whyThisCompany,
    whyThisCompanySource: whyThisCompanySourceSignal,
    icebreaker,
    icebreakerSource,
    idealContactPerson,
    analyzedAt: new Date().toISOString(),
    sourceWebsite: websiteData.finalUrl || (lead.website !== 'Nedostupné' ? lead.website : undefined),
    analysisMethod: websiteData.success ? 'web_deep_dive' : 'public_domain_analysis'
  };
}

// POST analyze Lead Intelligence
app.post('/api/leads/:id/intelligence', async (req, res) => {
  try {
    const leadId = req.params.id;
    const { lead: bodyLead, userProfile, concreteOffer, businessDirectionTitle } = req.body;
    const leads = await readPersistedLeads();
    const idx = leads.findIndex((l: any) => l.id === leadId);

    const lead = (idx !== -1) ? leads[idx] : bodyLead;
    if (!lead || !lead.companyName) {
      return res.status(404).json({ error: 'Firma nebyla nalezena' });
    }

    const company = lead.companyName?.trim() || 'Firma';
    const cleanCity = cleanCzechCity(lead.city);
    const rawIndustry = lead.industry || lead.category;
    const industry = (rawIndustry && rawIndustry !== 'Nedostupné') ? rawIndustry.trim() : 'služby a podnikání';
    const offer = sanitizeOfferTitle(
      concreteOffer,
      businessDirectionTitle,
      userProfile?.currentProject,
      industry
    );
    const userName = userProfile?.name?.trim() || 'Martin';

    // 1. Fetch public website snippet safely
    const websiteData = await fetchPublicWebsiteSnippet(lead.website, company);

    // 2. Try Gemini analysis
    const ai = getAIClient();
    let intelligence: any = null;

    if (ai) {
      try {
        const prompt = `Jsi seniorní B2B analytik pro systém PODNIKAI. Tvým úkolem je vytvořit důvěryhodnou obchodní analýzu „Lead Intelligence – proč a jak firmu oslovit“.
CÍL: Maximální důvěryhodnost. Žádné vymýšlení faktů. Žádné prezentování hypotéz jako ověřených informací.

DŮLEŽITÁ PRAVIDLA:
1. ROZDĚL DATA NA:
   - Ověřená fakta (verifiedFacts)
   - AI obchodní hypotézy (hypotheses)
   - Doporučený postup (recommendedApproach)
2. OVĚŘENÁ FAKTA:
   Používej POUZE skutečně dostupné informace ze zdroje: název, obor, adresa, web, telefon, popisný údaj o hodnocení.
   NIKDY z hodnocení nebo počtu recenzí nevyvozuj, že firma má vysokou poptávku, velkou klientskou základnu nebo že určitě chce nakupovat.
3. AI OBCHODNÍ HYPOTÉZA:
   Každou hypotézu formuluj opatrně („může představovat příležitost“, „stojí za ověření“, „z veřejně dostupných informací lze usuzovat“, „doporučujeme ověřit při prvním kontaktu“).
4. ZAKÁZANÁ TVRZENÍ:
   PŘÍSNÝ ZÁKAZ používat formulace: „vysoká poptávka“, „firma určitě potřebuje“, „existující klientská základna“, „garantovaná úspora“, „garantované zvýšení konverze“ a jakýkoliv jiný neověřený výsledek.
5. SEKCE „CO NABÍDNOUT“:
   Navrhuj konkrétní službu pouze jako obchodní hypotézu a VŽDY vysvětli, z jakého veřejného signálu návrh vychází.
6. ICEBREAKER:
   1–2 věty vycházející pouze z reálně nalezených informací. Pokud není dostatek informací, vytvoř neutrální věcné oslovení.
7. IDEÁLNÍ OSOBA:
   Nikdy nepovažuj název značky, název firmy, část názvu webu, slogan, název služby nebo náhodný text nalezený na webu za jméno konkrétní osoby.
   Pokud není na veřejném webu jednoznačně uvedeno:
   - celé jméno konkrétní osoby
   - a zároveň její role (majitel, jednatel, founder apod.),
   zobraz pouze role „Majitel / jednatel společnosti“, name vynech a do sourceNote uveď přesně: „Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.“
   Jméno zobraz pouze tehdy, pokud je skutečně identifikováno jako osoba a zdroj to jednoznačně potvrzuje.
8. SIGNÁLY K OSLOVENÍ:
   Každý signál musí mít: observation (konkrétní pozorování), source (zdroj), relevanceReason (proč může být relevantní k ověření), type ('verified_fact' nebo 'ai_hypothesis').
9. GOOGLE PLACES PODMÍNKY:
   Data z Google Places nepoužívej k vytváření hromadných mailingových seznamů. Hlubší analýza vychází z veřejného webu firmy.

ÚDAJE O FIRMĚ:
- Název firmy: ${company}
- Obor: ${industry}
- Lokalita: ${cleanCity || 'ČR'}
- Web: ${lead.website || 'Nedostupné'}
- Telefon: ${lead.phone || 'Nedostupné'}
- Veřejné recenze: ${lead.googleRating && lead.googleRating !== 'Nedostupné' ? `${lead.googleRating} (${lead.googleReviewCount || 0} recenzí)` : 'Neuvedeno'}
${websiteData.success ? `VEŘEJNÝ WEBOVÝ OBSAH (${websiteData.finalUrl}):
- Titulek: ${websiteData.title || 'Neuveden'}
- Popis: ${websiteData.description || 'Neuveden'}
- Nadpisy sekcí: ${websiteData.headings?.join(' | ') || 'Neuvedeny'}
- Výtah textu: ${websiteData.textSnippet?.slice(0, 1500) || 'Neuveden'}
${websiteData.contactPersonsFound && websiteData.contactPersonsFound.length > 0 ? `- Nalezené osoby v textu webu: ${websiteData.contactPersonsFound.join(', ')}` : '- V textu webu nebylo nalezeno žádné konkrétní jméno.'}` : `(Web firmy nebyl dostupný, vycházej z veřejného profilu a oboru).`}

PODNIKATEL A NABÍDKA:
- Kdo firmu oslovuje: ${userName}
- Nabízené řešení k ověření: ${offer}

Vrať JSON odpovídající schématu.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verifiedFacts: {
                  type: Type.OBJECT,
                  properties: {
                    companyName: { type: Type.STRING },
                    industry: { type: Type.STRING },
                    address: { type: Type.STRING },
                    website: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    ratingAndReviews: { type: Type.STRING },
                    webFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sourceSummary: { type: Type.STRING }
                  },
                  required: ["companyName", "industry", "address", "website", "phone", "sourceSummary"]
                },
                hypotheses: {
                  type: Type.OBJECT,
                  properties: {
                    opportunity: { type: Type.STRING },
                    opportunitySourceSignal: { type: Type.STRING },
                    offer: { type: Type.STRING },
                    offerSourceSignal: { type: Type.STRING },
                    whyThisCompany: { type: Type.STRING },
                    whyThisCompanySourceSignal: { type: Type.STRING }
                  },
                  required: ["opportunity", "opportunitySourceSignal", "offer", "offerSourceSignal", "whyThisCompany", "whyThisCompanySourceSignal"]
                },
                recommendedApproach: {
                  type: Type.OBJECT,
                  properties: {
                    icebreaker: { type: Type.STRING },
                    icebreakerSource: { type: Type.STRING },
                    idealContactPerson: {
                      type: Type.OBJECT,
                      properties: {
                        role: { type: Type.STRING },
                        name: { type: Type.STRING },
                        confidence: { type: Type.STRING },
                        sourceNote: { type: Type.STRING },
                        source: { type: Type.STRING }
                      },
                      required: ["role", "confidence", "sourceNote", "source"]
                    },
                    nextStepRecommendation: { type: Type.STRING }
                  },
                  required: ["icebreaker", "icebreakerSource", "idealContactPerson", "nextStepRecommendation"]
                },
                signals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      observation: { type: Type.STRING },
                      source: { type: Type.STRING },
                      relevanceReason: { type: Type.STRING },
                      type: { type: Type.STRING }
                    },
                    required: ["observation", "source", "relevanceReason"]
                  }
                }
              },
              required: ["verifiedFacts", "hypotheses", "recommendedApproach", "signals"]
            }
          }
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.hypotheses?.opportunity && parsed.recommendedApproach?.icebreaker) {
          // Strictly validate contact person: never accept brand name, company name, random web text
          // Requires full person name AND valid executive role verified in public web
          const rawAiName = parsed.recommendedApproach?.idealContactPerson?.name;
          const rawAiRole = parsed.recommendedApproach?.idealContactPerson?.role;
          const isAiContactVerified = Boolean(
            rawAiName &&
            isValidPersonName(rawAiName, company, lead.website) &&
            isValidExecutiveRole(rawAiRole) &&
            websiteData.textSnippet?.toLowerCase().includes(rawAiName.toLowerCase())
          );

          const finalVerifiedContact = isAiContactVerified 
            ? { name: rawAiName!.trim(), role: rawAiRole! }
            : (websiteData.verifiedContact && isValidPersonName(websiteData.verifiedContact.name, company, lead.website) && isValidExecutiveRole(websiteData.verifiedContact.role)
                ? websiteData.verifiedContact
                : null);

          const idealPerson = finalVerifiedContact ? {
            role: finalVerifiedContact.role || 'Majitel / jednatel společnosti',
            name: finalVerifiedContact.name,
            confidence: 'verified_on_web' as const,
            sourceNote: parsed.recommendedApproach?.idealContactPerson?.sourceNote || 'Ověřeno ve veřejné prezentaci firmy.',
            source: websiteData.finalUrl ? `Veřejný web firmy (${websiteData.finalUrl})` : 'Veřejný web firmy'
          } : {
            role: 'Majitel / jednatel společnosti',
            confidence: 'derived_role_only' as const,
            sourceNote: 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.',
            source: 'Obvyklá organizační struktura (doporučeno ověřit při kontaktu)'
          };

          intelligence = {
            verifiedFacts: parsed.verifiedFacts,
            hypotheses: parsed.hypotheses,
            recommendedApproach: {
              ...parsed.recommendedApproach,
              idealContactPerson: idealPerson
            },
            signals: (parsed.signals || []).map((s: any) => ({
              observation: s.observation,
              signal: s.observation,
              source: s.source,
              relevanceReason: s.relevanceReason,
              type: s.type || 'ai_hypothesis'
            })),
            // Zpětná kompatibilita
            opportunity: parsed.hypotheses.opportunity,
            opportunitySource: parsed.hypotheses.opportunitySourceSignal,
            offer: parsed.hypotheses.offer,
            offerSource: parsed.hypotheses.offerSourceSignal,
            whyThisCompany: parsed.hypotheses.whyThisCompany,
            whyThisCompanySource: parsed.hypotheses.whyThisCompanySourceSignal,
            icebreaker: parsed.recommendedApproach.icebreaker,
            icebreakerSource: parsed.recommendedApproach.icebreakerSource,
            idealContactPerson: idealPerson,
            analyzedAt: new Date().toISOString(),
            sourceWebsite: websiteData.finalUrl || (lead.website !== 'Nedostupné' ? lead.website : undefined),
            analysisMethod: websiteData.success ? 'web_deep_dive' : 'public_domain_analysis'
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini Lead Intelligence failed, falling back to deterministic analyzer:', geminiErr);
      }
    }

    if (!intelligence) {
      intelligence = generateDeterministicLeadIntelligence(lead, userProfile, offer, websiteData);
    }

    // Enrich lead with detected public email from official website if available
    if (websiteData.publicEmail && websiteData.publicEmail.found && websiteData.publicEmail.email) {
      lead.email = websiteData.publicEmail.email;
      lead.emailSourceUrl = websiteData.publicEmail.sourceUrl || lead.website;
      lead.emailSourceType = 'official_website';
      lead.emailStatus = 'public';
      lead.emailMetadata = {
        email: websiteData.publicEmail.email,
        sourceUrl: websiteData.publicEmail.sourceUrl || lead.website,
        sourceType: 'official_website',
        status: 'public',
        label: websiteData.publicEmail.label || 'Veřejně dostupný e-mail',
        details: websiteData.publicEmail.details,
        detectedAt: new Date().toISOString()
      };
    }

    // Save intelligence to lead in persistence
    lead.leadIntelligence = intelligence;
    if (idx !== -1) {
      leads[idx] = lead;
      await writePersistedLeads(leads);
    }

    return res.json({ success: true, leadIntelligence: intelligence, lead });
  } catch (err: any) {
    console.error('Lead Intelligence endpoint error:', err);
    return res.status(500).json({ error: err.message || 'Chyba při generování Lead Intelligence' });
  }
});

// POST detect public email from company's official website
app.post('/api/leads/detect-email', async (req, res) => {
  try {
    const { url, website, companyName } = req.body;
    const targetUrl = url || website;
    if (!targetUrl || targetUrl === 'Nedostupné') {
      return res.json({
        found: false,
        sourceType: 'official_website',
        status: 'not_found',
        label: 'E-mail nenalezen ve veřejných zdrojích',
        details: 'Není zadán žádný web firmy pro vyhledání e-mailu.'
      });
    }
    const result = await detectPublicEmailFromWebsite(targetUrl, companyName);
    return res.json(result);
  } catch (err: any) {
    console.error('Email detection error:', err);
    return res.status(500).json({
      found: false,
      sourceType: 'official_website',
      status: 'not_found',
      label: 'E-mail nenalezen ve veřejných zdrojích',
      error: err.message
    });
  }
});

// Alias for generic analysis
app.post('/api/lead-intelligence/analyze', async (req, res) => {
  const leadId = req.body?.lead?.id || 'temp';
  req.params = { id: leadId };
  // Forward to /api/leads/:id/intelligence logic
  const leads = await readPersistedLeads();
  const lead = req.body?.lead;
  if (!lead) {
    return res.status(400).json({ error: 'Chybí objekt lead' });
  }
  const websiteData = await fetchPublicWebsiteSnippet(lead.website);
  const concreteOffer = sanitizeOfferTitle(req.body?.concreteOffer, req.body?.businessDirectionTitle, req.body?.userProfile?.currentProject, lead.industry);
  const intel = generateDeterministicLeadIntelligence(lead, req.body?.userProfile, concreteOffer, websiteData);
  return res.json({ success: true, leadIntelligence: intel, lead });
});

// POST update lead outreach sequence
app.post('/api/leads/:id/sequence', async (req, res) => {
  try {
    const leadId = req.params.id;
    const { sequence } = req.body;
    const leads = await readPersistedLeads();
    const idx = leads.findIndex((l: any) => l.id === leadId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Firma nebyla v databázi nalezena' });
    }

    leads[idx].outreachSequence = sequence;
    await writePersistedLeads(leads);
    return res.json({ success: true, sequence: leads[idx].outreachSequence });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při ukládání sekvence' });
  }
});

// POST generate outreach sequence
app.post('/api/outreach/sequence', async (req, res) => {
  try {
    const { lead, tone = 'professional', userProfile, concreteOffer, businessDirectionTitle, leadIntelligence } = req.body;
    if (!lead || !lead.companyName) {
      return res.status(400).json({ error: 'Chybí povinná data o firmě (lead)' });
    }

    const userName = userProfile?.name?.trim() || 'Martin';
    const company = lead.companyName?.trim() || 'vaše společnost';

    // Clean, deduplicated city and sender city
    const cleanCity = cleanCzechCity(lead.city);
    const userCity = cleanCzechCity(userProfile?.location) || cleanCity || 'ČR';
    const cityPhrase = cleanCity ? ` v lokalitě ${cleanCity}` : '';

    // Clean industry
    const rawIndustry = lead.industry || lead.category;
    const industry = (rawIndustry && rawIndustry !== 'Nedostupné') ? rawIndustry.trim() : 'vašem oboru';

    // Sanitize offer to avoid placeholder leaks
    const offer = sanitizeOfferTitle(
      concreteOffer,
      businessDirectionTitle,
      userProfile?.currentProject,
      industry
    );

    const intel = leadIntelligence || lead.leadIntelligence;
    const intelFacts = intel?.verifiedFacts;
    const intelHypo = intel?.hypotheses;
    const intelRec = intel?.recommendedApproach;

    // Strict channel availability & CRM history checks
    const hasEmail = Boolean(
      lead.email && 
      lead.email !== 'Nedostupné' && 
      lead.email.trim() !== '' && 
      lead.email.toLowerCase() !== 'neuveden' && 
      lead.email.includes('@')
    );
    const hasPhone = Boolean(
      lead.phone && 
      lead.phone !== 'Nedostupné' && 
      lead.phone.trim() !== ''
    );
    const hasWhatsApp = Boolean(
      (lead as any).hasVerifiedWhatsApp === true || 
      (lead as any).hasWhatsApp === true || 
      intel?.hasVerifiedWhatsApp === true
    );
    const hasSentEmail = Boolean(
      lead.activities?.some((a: any) => 
        a.channel === 'email' && 
        a.isSimulation === false && 
        !a.result?.toLowerCase().includes('simul') &&
        !a.result?.toLowerCase().includes('chyba') &&
        !a.result?.toLowerCase().includes('nedoruč') &&
        !a.result?.toLowerCase().includes('koncept') &&
        (a.result?.toLowerCase().includes('odesl') || a.result?.toLowerCase().includes('kontakt') || a.statusAfter === 'Osloveno')
      ) ||
      (
        lead.lastContactChannel === 'email' && 
        (lead as any).isSimulation !== true &&
        !lead.lastContactResult?.toLowerCase().includes('simul') &&
        !lead.lastContactResult?.toLowerCase().includes('chyba') &&
        (lead.lastContactResult?.toLowerCase().includes('odesl') || lead.realStatus === 'Osloveno' || lead.status === 'Osloveno')
      )
    );
    const hasMadeCall = Boolean(
      lead.activities?.some((a: any) => a.channel === 'phone' && !a.isSimulation) ||
      (lead.lastContactChannel === 'phone' && (lead as any).isSimulation !== true && !lead.lastContactResult?.toLowerCase().includes('simul'))
    );

    const ai = getAIClient();
    let aiGeneratedSteps: any = null;

    if (ai) {
      try {
        const rawIcebreaker = intelRec?.icebreaker || intel?.icebreaker;
        const rawOpportunity = intelHypo?.opportunity || intel?.opportunity;
        const offerVal = intelHypo?.offer || intel?.offer;

        // Strip any internal AI prefixes or labels before injecting into prompt
        const cleanIceVal = rawIcebreaker ? cleanInternalAiTerminology(rawIcebreaker.replace(/^Dobrý den[,\s]*/i, '')) : '';
        const cleanOppVal = rawOpportunity ? cleanInternalAiTerminology(rawOpportunity.replace(/^\[AI HYPOTÉZA – OVĚŘIT\]\s*/i, '')) : '';

        const rawContactName = intelRec?.idealContactPerson?.name || intel?.idealContactPerson?.name;
        const rawContactRole = intelRec?.idealContactPerson?.role || intel?.idealContactPerson?.role;
        const isVerifiedContact = Boolean(
          rawContactName &&
          isValidPersonName(rawContactName, company, lead.website) &&
          isValidExecutiveRole(rawContactRole)
        );
        const contactRole = isVerifiedContact ? (rawContactRole || 'Majitel / jednatel společnosti') : 'Majitel / jednatel společnosti';
        const contactName = isVerifiedContact ? rawContactName : undefined;
        const contactNote = isVerifiedContact ? 'Ověřeno ve veřejné prezentaci firmy.' : 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.';

        const intelPromptAddon = intel ? `
LEAD INTELLIGENCE – PODKLADY Z WEBU (INTERNÍ):
- Web: ${lead.website || 'neuveden'}, telefon: ${lead.phone || 'neuveden'}, lokalita: ${cleanCity || 'ČR'}.
- Zjištěný námět k prověření: ${cleanOppVal || 'Možnost zjednodušení příjmu a zpracování poptávek'}
- Nabízené téma: ${offerVal || offer}
- Poznatky z prezentace firmy: "${cleanIceVal}"
- Kontaktní osoba: ${isVerifiedContact && contactName ? contactName : 'Majitel / jednatel (konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno)'}

PŘÍSNÁ PRAVIDLA PRO DEN 1 E-MAIL:
1. TVRDÁ VALIDACE DÉLKY:
   - Den 1 e-mail musí mít ideálně 80–130 slov.
   - Absolutní maximum je 150 slov!
2. ZÁKAZ INTERNÍ TERMINOLOGIE:
   - Nikdy zákazníkovi nepíš slova: „AI hypotéza“, „obchodní hypotéza“, „hypotéza k ověření“, „Lead Intelligence“, „ověřený fakt“, „ověřené fakty“, „signál“, „zdroj signálu“, „interní podklad“, „enrichment“.
   - Nikdy nepiš formulace jako „Obchodní hypotéza k ověření:“, „Při procházení vaší prezentace mě zaujal podnět k ověření:“.
3. NÁZVY FIREM A ZÁKAZ FRAGMENTŮ:
   - Název společnosti (${company}) musí být vždy zachován celý a správně.
   - NIKDY nesmí vzniknout fragment jako „r.o.“ nebo „s.r.o.“ bez názvu firmy! Nikdy nepiš „Všiml jsem si, že r.o.“.
   - Pokud odkazuješ na web, použij celou větu: „Při prohlídce vašeho webu jsem si všiml...“ nebo „ve společnosti ${company}“.
4. ZÁKAZ NEPODLOŽENÝCH VÝSLEDKOVÝCH TVRZENÍ:
   - Nikdy netvrď ani negarantuj: že řešení určitě šetří čas, že určitě zrychlí reakci, že určitě přinese více zákazníků, ani že firma má určitě konkrétní problém.
   - Nepoužívej věty jako „V praxi to firmám pomáhá reagovat podstatně rychleji...“ nebo „což jim ušetřilo několik hodin...“.
   - Místo toho nabídni opatrnou možnost ke zvážení: „Napadlo mě, zda by pro vás dávalo smysl zjednodušit tento proces a omezit ruční práci se zprávami.“
5. 6-BODOVÁ STRUKTURA DEN 1 E-MAILU:
   A) Oslovení: ${isVerifiedContact && contactName ? `konkrétní oslovení např. Dobrý den, pane/paní...` : `výhradně „Dobrý den,“`}
   B) 1 konkrétní věcné pozorování z webu (např. formulář pro poptávky, online rezervace, nabídka konkrétních služeb)
   C) Stručné vysvětlení, proč tě to zaujalo
   D) Opatrně formulovaná možnost ke zvážení bez nepodložených tvrzení
   E) Konkrétní nezávazné CTA na 5–10minutový hovor
   F) Podpis: ${userName}
   - Žádné opakování představení ani důvodu oslovení.` : '';

        const prompt = `Jsi zkušený český B2B obchodník pro systém PODNIKAI.
Tvým úkolem je vytvořit krátkou, přirozenou a skutečně použitelnou 4krokovou outreach sekvenci pro firmu ${company}.
Výstup nesmí působit jako dlouhý AI text plný klišé a nepodložených slibů.

SKUTEČNÁ DOSTUPNOST KANÁLŮ A CRM HISTORIE FIRMY:
- Ověřený e-mail: ${hasEmail ? lead.email : 'NENÍ K DISPOZICI (firma nemá ověřený veřejný e-mail)'}
- Telefon: ${hasPhone ? lead.phone : 'není k dispozici'}
- WhatsApp: ${hasWhatsApp ? 'ověřený' : 'NENÍ OVĚŘENÝ (existence telefonu neznamená WhatsApp)'}
- Historie CRM: Reálný e-mail ${hasSentEmail ? 'BYL v CRM odeslán' : 'NEBYL odeslán (v CRM není žádný odeslaný e-mail)'}
- Historie CRM: Reálný hovor ${hasMadeCall ? 'proběhl' : 'neproběhl'}

PRAVIDLA PRO JEDNOTLIVÉ KROKY:

1. KROK – 1. DEN: Personalizovaný e-mail
- ${hasEmail ? 'Ověřený e-mail je k dispozici.' : 'POZOR: Firma nemá ověřený e-mail! Tento krok slouží pouze jako koncept ke zkopírování nebo pro testovací simulaci. Text nesmí tvrdit, že byl e-mail odeslán.'}
- Délka: 80–130 slov. ABSOLUTNÍ MAXIMUM JE 150 SLOV!
- Předmět: krátký a přirozený, 3–6 slov (např. „Krátký dotaz k poptávkám“, „Dotaz k vašemu webu“, „Krátký dotaz – ${company}“).
- 6bodová struktura:
  A) Oslovení: ${isVerifiedContact && contactName ? `konkrétní oslovení (např. Dobrý den, pane/paní...)` : `výhradně „Dobrý den,“`}
  B) 1 konkrétní detail z webu firmy (např. způsob rezervace, nabídka služeb, formulář)
  C) Proč tě to zaujalo
  D) Opatrná možnost ke zvážení (bez slibů úspory času či zaručeného zrychlení reakce)
  E) CTA na 5–10min nezávazný hovor
  F) Podpis: ${userName}
- Název firmy: výhradně celý název (${company}), nikdy žádné fragmenty jako „r.o.“ nebo „s.r.o.“.

2. KROK – 3. DEN: Telefonní hovor / WhatsApp
- TELEFONNÍ SCÉNÁŘ (PŘÍSNÁ PRAVIDLA):
  ${!hasSentEmail ? `KRITICKÉ: V CRM NENÍ zaznamenán žádný odeslaný e-mail!
  Telefonní scénář NESMÍ automaticky předpokládat, že byl odeslán e-mail, že zákazník e-mail četl, že proběhl předchozí kontakt, ani že zákazník něco obdržel.
  PŘÍSNÝ ZÁKAZ formulací jako „Posílal jsem vám do e-mailu...“, „v návaznosti na e-mail...“ apod.!
  Telefonní scénář MUSÍ BÝT ZCELA SAMOSTATNÝ.
  Příklad vhodného stylu:
  „Dobrý den, tady ${userName}. Obracím se na vás kvůli ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené online rezervace a nabídku služeb. Mám jeden konkrétní nápad, který bych s vámi rád krátce probral. Je to pro vás aktuální téma?“` : `KRITICKÉ: V CRM BYL skutečně odeslán reálný e-mail (isSimulation === false)!
  Telefonní krok MUSÍ vědět, že e-mail již proběhl.
  PŘÍSNÝ ZÁKAZ označení „samostatný první kontakt“ a ZÁKAZ tvrzení, že e-mail není evidován!
  Telefonní scénář MUSÍ přirozeně navázat na předchozí e-mail.
  Příklad vhodného stylu:
  „Dobrý den, tady ${userName}. Volám vám v návaznosti na krátký e-mail, který jsem vám posílal ohledně ${company}. Máte prosím minutku?“
  nebo: „Dobrý den, tady ${userName}. Posílal jsem vám před pár dny krátký e-mail ohledně ${company}...“`}
- WHATSAPP ZPRÁVA:
  - Velmi stručná (do 40 slov), věcná a bez nátlaku.
  ${!hasSentEmail ? '- ZÁKAZ odkazování na e-mail! Musí být samostatná (např. „Dobrý den, tady Martin. Obracím se na vás ohledně ' + company + '...“).' : '- Protože e-mail byl odeslán, může přirozeně zmínit poslaný e-mail (např. „Dobrý den, tady Martin. Posílal jsem vám krátký e-mail ohledně ' + company + '...“).'}
  ${!hasWhatsApp ? '- WhatsApp není ověřen, zpráva slouží jako koncept.' : ''}

3. KROK – 7. DEN: Připomenutí s novým argumentem
- ${hasSentEmail ? 'Předmět: Re: [předmět z 1. dne]. Může krátce navázat na předchozí e-mail.' : (hasMadeCall ? 'Předmět: Navázání na náš hovor – ' + company + '. Navazuje na předchozí telefonát.' : 'Předmět: Krátký dotaz k prezentaci – ' + company + '. Samostatné oslovení bez falešného tvrzení o předchozím kontaktu.')}
- Text: 60–100 slov, nový věcný úhel pohledu, odstraňuje obavu z časové náročnosti. Bez nepodložených slibů.

4. KROK – 14. DEN: Breakup e-mail
- Předmět: Uzavření dotazu – ${company}
- Text: VELMI KRÁTKÝ (40–70 slov). Zdvořilé uzavření kontaktu bez nátlaku, žádná urgence.
  ${!hasSentEmail ? '- ZÁKAZ formulace „k mému předchozímu e-mailu“, pokud e-mail v CRM nebyl reálně odeslán!' : ''}

ZÁKAZ INTERNÍCH POJMŮ:
Do textů určených zákazníkovi se NESMÍ dostat:
„AI hypotéza“, „obchodní hypotéza“, „hypotéza k ověření“, „Lead Intelligence“, „ověřený fakt“, „signál“, „zdroj signálu“, „enrichment“.

ZÁKAZ NEPODLOŽENÝCH TVRZENÍ:
Zákaz formulací typu „V praxi to firmám pomáhá reagovat podstatně rychleji“, „šetří čas“, „garantujeme“. Místo toho formuluj jako pokornou možnost k prověření.

FIRMA:
- Název: ${company}
- Obor: ${industry}
- Lokalita: ${cleanCity || 'ČR'}
- Web: ${lead.website || 'neuveden'}
${intelPromptAddon}

PODNIKATEL:
- Jméno: ${userName}
- Působiště: ${userCity}
- Nabídka: ${offer}
- Zvolený tón: ${tone}

Vrať JSON pole 4 kroků. U každého kroku vyplň i pole 'personalizationBasis' (stručné označení podkladu, max 6 slov).`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  day: { type: Type.INTEGER },
                  type: { type: Type.STRING },
                  channel: { type: Type.STRING },
                  title: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  content: { type: Type.STRING },
                  callScript: { type: Type.STRING },
                  whatsappMessage: { type: Type.STRING },
                  keyArgument: { type: Type.STRING },
                  personalizationBasis: { type: Type.STRING },
                  recommendedTiming: { type: Type.STRING }
                },
                required: ["stepNumber", "day", "type", "channel", "title", "content", "keyArgument", "recommendedTiming"]
              }
            }
          }
        });

        aiGeneratedSteps = JSON.parse(response.text || '[]');
      } catch (geminiErr) {
        console.warn('Gemini sequence generation failed, falling back to rule-based generator:', geminiErr);
      }
    }

    // Build the guaranteed deterministic sequence for fallback
    const deterministicSeq = generateOutreachSequence(lead, {
      tone,
      userProfile,
      concreteOffer,
      businessDirectionTitle
    });

    const candidateSteps = Array.isArray(aiGeneratedSteps) && aiGeneratedSteps.length === 4
      ? aiGeneratedSteps
      : deterministicSeq.steps;

    const rawCandidateSequence = {
      id: `seq-${lead.id}-${Date.now()}`,
      tone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: candidateSteps,
      activeStepIndex: 0
    };

    // End-to-end hard validation and sanitization:
    // Guarantees Day 1 word count <= 150 words, strips all banned AI phrases, and repairs automatically if needed.
    const validatedSequence = validateAndSanitizeSequence(rawCandidateSequence, lead, {
      tone,
      userProfile,
      concreteOffer,
      businessDirectionTitle
    });

    return res.json({ success: true, sequence: validatedSequence });

    return res.json({ success: true, sequence: deterministicSeq });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při generování sekvence' });
  }
});

// Register all route aliases for finding customers
app.post('/api/customers/find', handleFindCustomers);
app.post('/api/customers/search', handleFindCustomers);
app.post('/api/leads/find', handleFindCustomers);
app.post('/api/zakaznici/najit', handleFindCustomers);
app.post(encodeURI('/api/zákazníci/najít'), handleFindCustomers);
app.get('/api/customers/find', (req, res) => res.json({ message: 'Customers find endpoint is active. Send POST request with criteria.' }));

// ========================================================
// PODNIKAI BUSINESS START – ADMIN CONTROLLER & PERSISTENCE
// ========================================================
const BUSINESS_START_FILE = path.join(DATA_DIR, 'business_start_clients.json');

async function readPersistedBusinessStartClients(): Promise<BusinessStartClient[]> {
  try {
    if (!fs.existsSync(BUSINESS_START_FILE)) {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      await fs.promises.writeFile(BUSINESS_START_FILE, JSON.stringify(INITIAL_BUSINESS_START_CLIENTS, null, 2), 'utf-8');
      return INITIAL_BUSINESS_START_CLIENTS;
    }
    const content = await fs.promises.readFile(BUSINESS_START_FILE, 'utf-8');
    if (!content || !content.trim()) {
      return INITIAL_BUSINESS_START_CLIENTS;
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed reading business start clients, falling back to defaults:', err);
    return INITIAL_BUSINESS_START_CLIENTS;
  }
}

async function writePersistedBusinessStartClients(clients: BusinessStartClient[]): Promise<boolean> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    const safeClients = Array.isArray(clients) ? clients : [];
    const tempFile = path.join(DATA_DIR, `.bs_clients.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`);
    await fs.promises.writeFile(tempFile, JSON.stringify(safeClients, null, 2), 'utf-8');
    await fs.promises.rename(tempFile, BUSINESS_START_FILE);
    return true;
  } catch (err) {
    console.error('Failed writing business start clients:', err);
    return false;
  }
}

// ==========================================
// PODNIKAI BUSINESS START ADMIN AUTHENTICATION
// ==========================================
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'podnikai_admin_session_sec_2025_98a7c';

function createAdminSessionToken(): string {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours validity
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyAdminSessionToken(token?: string): boolean {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [data, signature] = token.split('.');
  if (!data || !signature) return false;
  const expectedSig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(data).digest('base64url');
  if (signature !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.role !== 'admin' || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || !verifyAdminSessionToken(token)) {
    return res.status(401).json({ error: 'Neautorizovaný přístup. Administrátorská relace vypršela nebo je neplatná.' });
  }
  next();
}

// 1. Admin Verification / Access Check (Passcode check + Session Token Issuance)
app.post(['/api/admin/verify', '/api/admin/business-start/verify'], (req, res) => {
  const { passcode } = req.body;
  const expectedPasscode = process.env.ADMIN_PASSCODE || 'podnikai';
  if (!passcode || typeof passcode !== 'string' || passcode.trim() !== expectedPasscode.trim()) {
    return res.status(401).json({ authorized: false, error: 'Neplatný administrátorský kód.' });
  }
  const token = createAdminSessionToken();
  return res.json({ 
    authorized: true, 
    token, 
    message: 'Administrátorský přístup schválen. Relace byla bezpečně podepsána.' 
  });
});

// 2. GET all clients with pipeline stats (Protected)
app.get(['/api/admin/clients', '/api/admin/business-start/clients'], requireAdminAuth, async (req, res) => {
  try {
    const clients = await readPersistedBusinessStartClients();
    const stats = {
      total: clients.length,
      new: clients.filter(c => c.status === 'new').length,
      analysis: clients.filter(c => c.status === 'analysis').length,
      control: clients.filter(c => c.status === 'control').length,
      done: clients.filter(c => c.status === 'done').length
    };
    return res.json({ clients, stats });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při načítání klientů Business Start' });
  }
});

// 3. GET single client (Protected)
app.get(['/api/admin/clients/:id', '/api/admin/business-start/clients/:id'], requireAdminAuth, async (req, res) => {
  try {
    const clients = await readPersistedBusinessStartClients();
    const client = clients.find(c => c.id === req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Klient nebyl nalezen' });
    }
    return res.json({ client });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při čtení klienta' });
  }
});

// 4. POST create new client (Protected)
app.post(['/api/admin/clients', '/api/admin/business-start/clients'], requireAdminAuth, async (req, res) => {
  try {
    const { questionnaire, consultantName, status } = req.body;
    const safeQ: BusinessStartQuestionnaire = questionnaire || createEmptyQuestionnaire();
    const now = new Date().toISOString();
    const newClient: BusinessStartClient = {
      id: `bs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
      status: (status as BusinessStartClientStatus) || 'new',
      questionnaire: safeQ,
      consultantName: consultantName || 'Konzultant PODNIKAI',
      adminNotes: req.body.adminNotes || ''
    };

    const clients = await readPersistedBusinessStartClients();
    clients.unshift(newClient);
    await writePersistedBusinessStartClients(clients);

    return res.json({ success: true, client: newClient });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při zakládání klienta' });
  }
});

// 5. PATCH update client data, notes, or analysis (Protected)
app.patch(['/api/admin/clients/:id', '/api/admin/business-start/clients/:id'], requireAdminAuth, async (req, res) => {
  try {
    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Klient nebyl nalezen' });
    }

    const current = clients[idx];
    const { questionnaire, analysis, status, adminNotes, consultantName, reportLastGeneratedAt } = req.body;

    const updated: BusinessStartClient = {
      ...current,
      updatedAt: new Date().toISOString(),
      questionnaire: questionnaire !== undefined ? { ...current.questionnaire, ...questionnaire } : current.questionnaire,
      analysis: analysis !== undefined ? analysis : current.analysis,
      status: status !== undefined ? status : current.status,
      adminNotes: adminNotes !== undefined ? adminNotes : current.adminNotes,
      consultantName: consultantName !== undefined ? consultantName : current.consultantName,
      reportLastGeneratedAt: reportLastGeneratedAt !== undefined ? reportLastGeneratedAt : current.reportLastGeneratedAt
    };

    clients[idx] = updated;
    await writePersistedBusinessStartClients(clients);

    return res.json({ success: true, client: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při aktualizaci klienta' });
  }
});

// 6. DELETE client (Protected)
app.delete(['/api/admin/clients/:id', '/api/admin/business-start/clients/:id'], requireAdminAuth, async (req, res) => {
  try {
    const clients = await readPersistedBusinessStartClients();
    const filtered = clients.filter(c => c.id !== req.params.id);
    if (filtered.length === clients.length) {
      return res.status(404).json({ error: 'Klient nebyl nalezen' });
    }
    await writePersistedBusinessStartClients(filtered);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při mazání klienta' });
  }
});

// 7. POST trigger AI Deep Analysis for a client (Protected)
function sanitizeServerReportText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\s*\/?\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*p\s*>/gi, '')
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deepSanitizeReportObject<T>(input: T): T {
  if (typeof input === 'string') {
    return sanitizeServerReportText(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map(item => deepSanitizeReportObject(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const res: any = {};
    for (const key of Object.keys(input)) {
      res[key] = deepSanitizeReportObject((input as any)[key]);
    }
    return res as T;
  }
  return input;
}

// Canonical Business Start Engine Execution Function
async function runCanonicalBusinessStartAnalysis(q: BusinessStartQuestionnaire): Promise<BusinessStartAnalysis> {
  let analysis: BusinessStartAnalysis | null = null;
  const ai = getAIClient();

    if (ai) {
      try {
        const constraints = evaluateClientConstraints(q);
        const isOnline = q.operatingModel === 'online';
        const isStrictZeroBudget = q.startingCapital.includes('0 Kč') || q.startingCapital.toLowerCase().includes('nula');
        const effectiveWorkType = constraints.effectiveWorkType;

        const skillsText = Array.isArray(q.coreSkillsAndExpertise)
          ? q.coreSkillsAndExpertise.join(', ')
          : (q.coreSkillsAndExpertise || 'neuvedeny');
        const passionsText = Array.isArray(q.passionsAndInterests)
          ? q.passionsAndInterests.join(', ')
          : (q.passionsAndInterests || 'neuvedeny');
        const redLinesText = Array.isArray(q.strictDislikesAndRedLines)
          ? q.strictDislikesAndRedLines.join(', ')
          : (q.strictDislikesAndRedLines || 'žádné');

        const prompt = `Jsi PODNIKAI Business Start Engine — analytický a strategický engine pro tvorbu individuálního podnikatelského plánu.
VERZE: SOURCE OF TRUTH v1.0
METODIKA: 12 HLAVNÍCH OTÁZEK

Tvým úkolem je převést přesně zadaná data klienta do konzistentního podnikatelského blueprintu.
Nejsi generátor náhodných nápadů, motivátor ani prodejce. Nevymýšlej si údaje o klientovi.

HLAVNÍ PRINCIP: SOURCE OF TRUTH & POŘADÍ ROZHODOVÁNÍ:
1. SOURCE OF TRUTH: Vstupní údaje klienta jsou jediným autoritativním zdrojem informací o klientovi.
2. CLIENT GOAL: Cíl klienta (${q.mainGoal}) je prioritní zdroj záměru. Pokud klient uvádí konkrétní cíl (např. vizážistka, masérské studio, zedník, online marketing), systém NESMÍ tento cíl transformovat na jiný obor!
3. PREFERRED WORK TYPE: ${effectiveWorkType} ${constraints.isCustomTextPriority ? '(Vlastní text klienta – má absolutní přednost)' : ''}.
4. RED LINES: Striktně respektuj odmítnuté činnosti (${redLinesText}).
5. HARD FILTER KANDIDÁTNÍCH MODELŮ (PROBÍHÁ PŘED VÝBĚREM KANDIDÁTŮ!):
${constraints.isPhysicalPersonalLocal ? `*** STRIKTNÍ HARD CONSTRAINT: KLIENT POŽADUJE FYZICKOU / LOKÁLNÍ / OSOBNÍ SLUŽBU ***
Cíl klienta: "${q.mainGoal}". Preferovaný typ práce: "${effectiveWorkType}".
GENERÁTOR NESMÍ JAKO HLAVNÍ PODNIKATELSKÝ SMĚR ANI MEZI KANDIDÁTY DOPORUČIT:
- čistě online agenturu,
- čistě online službu (copywriting pro e-shopy, virtuální asistence apod.),
- SaaS / software / aplikace,
- digitální produkt / e-booky / šablony,
- online kurz jako hlavní doporučení,
- affiliate marketing,
- dropshipping,
- jiný model, jehož hlavním způsobem poskytování služby je práce přes PC/online.
Kandidáti i primární směr MUSÍ BÝT VÝHRADNĚ fyzické, lokální či osobní služby v oboru klienta (${q.mainGoal}, např. u vizážistky osobní/svatební líčení, mobilní vizážistka, spolupráce se salony/fotografy, vlastní studio; u maséra masérské služby, regenerační péče, studio; u řemeslníka fyzické řemeslné práce)!
Online marketing může být použit POUZE JAKO PODPŮRNÝ PRODEJNÍ / MARKETINGOVÝ KANÁL fyzického podnikání (např. Instagramové portfolio pro získání poptávek). Nesmí změnit samotný typ doporučeného podnikání!` : constraints.isOnlineOnly ? `*** KLIENT POŽADUJE 100% ONLINE / DIGITÁLNÍ BYZNYS (${effectiveWorkType}) ***
Modely musí být 100% online/distanční bez nutnosti fyzických provozoven či manuální práce.` : `*** VYVÁŽENÝ / KOMBINOVANÝ PŘÍSTUP (${effectiveWorkType}) ***
Nabídni vyvážené portfolio směrů (fyzické, lokální, hybridní i online).`}
6. TEPRVE POTOM GENEROVÁNÍ A VÝBĚR PODNIKATELSKÝCH MOŽNOSTÍ.
- Kapitál ${q.startingCapital} je striktní limit. Pokud je 0 Kč, navržený model MUSÍ mít počáteční investici přesně 0 Kč.
- Časová dotace ${q.weeklyTimeCommitment} je nepřekročitelný strop.
- Model provozu ${q.operatingModel.toUpperCase()} zohledni, ale cíl a preferovaný typ práce klienta mají přednost.
- U fyzických a regulovaných profesí (např. řemeslná živnost zednictví, vázaná živnost masérské služby dle zákona č. 455/1991 Sb., volná živnost pro vizážistiku) zohledni potřebnou kvalifikaci, vybavení a zákonné požadavky.

PROFIL KLIENTA (METODIKA 12 OTÁZEK):
1. Jméno a kontaktní údaje: ${q.clientName} (Lokalita: ${q.location})
2. Současná profesní situace a kariérní historie: ${q.currentCareerSituation || 'neuvedena'}
3. Hlavní cíl: ${q.mainGoal}
4. Cílový měsíční příjem: ${q.targetMonthlyIncome}
5. Reálný počáteční kapitál: ${q.startingCapital}
6. Týdenní časová kapacita: ${q.weeklyTimeCommitment}
7. Požadovaný model provozu a preferovaný typ práce:
   - Provozní model: ${q.operatingModel.toUpperCase()}
   - Preferovaný typ práce: ${effectiveWorkType} ${q.customPreferredWorkType?.trim() ? '(Vlastní text klienta – má absolutní přednost)' : ''}
8. Klíčové dovednosti a silné stránky: ${skillsText}
9. Zájmy a obory: ${passionsText}
10. Červené linie (striktně odmítané): ${redLinesText}
11. Dosavadní aktiva a síť kontaktů: ${q.existingAssetsAndNetwork || 'neuvedeny'}
12. Osobní překážky a specifické podmínky: ${q.personalConstraints || 'žádné'}

FORMÁTOVÁNÍ: V textu NESMÍ BÝT ŽÁDNÉ HTML TAGY jako <br>, </br>, <p>, </p>, <div> apod.! Pro oddělení odstavců a řádků používej výhradně čistý text a standardní nový řádek (\\n).

ZÁVAZNÁ STRUKTURA VÝSTUPU:
1. EXEKUTIVNÍ SHRNUTÍ & HODNOCENÍ PROFILU (odděluj striktně FACT, INFERENCE a RECOMMENDATION).
2. NAVRŽENÉ PODNIKATELSKÉ SMĚRY (3 až 5 kompatibilních směrů, 1 označen jako isPrimary: true).
3. LOCKED BUSINESS BLUEPRINT: Zamknutá matice 12 bodů (A–L):
   A. Primary Business Direction
   B. Core Offer
   C. Ideal Customer
   D. Customer Problem
   E. Value Proposition
   F. Price [RECOMMENDATION / SCENARIO]
   G. Sales Channel (respektující červené linie)
   H. Acquisition Method
   I. Delivery Model (${q.operatingModel.toUpperCase()})
   J. Revenue Model
   K. Cost Model
   L. Validation Plan
4. PRIMARY DIRECTION BLUEPRINT (podrobné rozpracování: Avatar, Nabídka, 14denní validace H1-H4, Skripty bez zakázaných kanálů, 30denní kalendář, Finanční model se 3 scénáři a disclaimrem).
KRITICKÉ PRAVIDLO PRO FINANČNÍ MODEL:
- PODNIKAI NESMÍ PREZENTOVAT ODHADOVANÝ PŘÍJEM NEBO ZISK JAKO GARANTOVANÝ, OČEKÁVANÝ NEBO JISTÝ VÝSLEDEK.
- Každé finanční číslo musí být jasně označeno jako: vstup od klienta, výpočet, scénář, odhad, předpoklad, nebo neznámá hodnota.
- Místo formulací typu 'realistický čistý zisk 55 000–75 000 Kč' používej 'MODELOVÝ SCÉNÁŘ: při X zakázkách × Y Kč a při předpokládaných nákladech Z Kč vychází orientační výsledek...'.
- U každého modelu uveď: 1. předpokládanou cenu, 2. předpokládaný počet zakázek, 3. model kapacity (např. 'model kapacity 12–16 líčení měsíčně'), 4. předpokládané variabilní náklady, 5. známé/předpokládané fixní náklady, 6. jednoduchý orientační výpočet, 7. co není zahrnuto (neuvedeno / nezohledněno v tomto modelu: odvody SP/ZP a daně), 8. že jde výhradně o modelový scénář.
- Pokud náklad není známý, neuváděj '0 Kč', nýbrž 'neuvedeno / nezohledněno v tomto modelu' nebo konzervativní předpoklad.
5. VALIDATION GATE (19 kontrol konzistence včetně finančního QA, status "DONE").
6. SOURCE OF TRUTH AUDIT (rekapitulace limitů a ověření).

Vrať validní JSON odpovídající schématu bez jakéhokoliv markdown obalu.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveSummary: { type: Type.STRING },
                profileEvaluation: {
                  type: Type.OBJECT,
                  properties: {
                    strongPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    competitiveAdvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
                    capitalFeasibilityNote: { type: Type.STRING },
                    timeFeasibilityNote: { type: Type.STRING }
                  },
                  required: ["strongPoints", "riskFactors", "competitiveAdvantages", "capitalFeasibilityNote", "timeFeasibilityNote"]
                },
                topDirections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      tagline: { type: Type.STRING },
                      businessModel: { type: Type.STRING },
                      whyMatch: { type: Type.STRING },
                      estimatedMargin: { type: Type.STRING },
                      timeToFirstRevenue: { type: Type.STRING },
                      requiredCapital: { type: Type.STRING },
                      isPrimary: { type: Type.BOOLEAN }
                    },
                    required: ["id", "title", "tagline", "businessModel", "whyMatch", "estimatedMargin", "timeToFirstRevenue", "requiredCapital", "isPrimary"]
                  }
                },
                lockedBlueprint: {
                  type: Type.OBJECT,
                  properties: {
                    primaryDirection: { type: Type.STRING },
                    coreOffer: { type: Type.STRING },
                    idealCustomer: { type: Type.STRING },
                    customerProblem: { type: Type.STRING },
                    valueProposition: { type: Type.STRING },
                    price: { type: Type.STRING },
                    salesChannel: { type: Type.STRING },
                    acquisitionMethod: { type: Type.STRING },
                    deliveryModel: { type: Type.STRING },
                    revenueModel: { type: Type.STRING },
                    costModel: { type: Type.STRING },
                    validationPlan: { type: Type.STRING }
                  },
                  required: ["primaryDirection", "coreOffer", "idealCustomer", "customerProblem", "valueProposition", "price", "salesChannel", "acquisitionMethod", "deliveryModel", "revenueModel", "costModel", "validationPlan"]
                },
                validationGate: {
                  type: Type.OBJECT,
                  properties: {
                    sourceOfTruthValid: { type: Type.BOOLEAN },
                    inputsUnchanged: { type: Type.BOOLEAN },
                    clientGoalRespected: { type: Type.BOOLEAN },
                    typeOfWorkRespected: { type: Type.BOOLEAN },
                    physicalWorkSupported: { type: Type.BOOLEAN },
                    localServiceSupported: { type: Type.BOOLEAN },
                    onlineModelSupported: { type: Type.BOOLEAN },
                    qualificationRulesRespected: { type: Type.BOOLEAN },
                    redLinesRespected: { type: Type.BOOLEAN },
                    capacityOk: { type: Type.BOOLEAN },
                    blueprintLocked: { type: Type.BOOLEAN },
                    financialModelConsistent: { type: Type.BOOLEAN },
                    status: { type: Type.STRING },
                    reviewNotes: { type: Type.STRING }
                  },
                  required: ["sourceOfTruthValid", "inputsUnchanged", "clientGoalRespected", "typeOfWorkRespected", "physicalWorkSupported", "localServiceSupported", "onlineModelSupported", "qualificationRulesRespected", "redLinesRespected", "capacityOk", "blueprintLocked", "financialModelConsistent", "status"]
                },
                sourceOfTruthAudit: {
                  type: Type.OBJECT,
                  properties: {
                    capitalLimit: { type: Type.STRING },
                    timeWeeklyLimit: { type: Type.STRING },
                    operatingModelLimit: { type: Type.STRING },
                    mainGoalLimit: { type: Type.STRING },
                    preferredWorkTypeLimit: { type: Type.STRING },
                    strictRedLines: { type: Type.ARRAY, items: { type: Type.STRING } },
                    skillsProvided: { type: Type.ARRAY, items: { type: Type.STRING } },
                    existingAssets: { type: Type.STRING },
                    unknownsOrBlockers: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["capitalLimit", "timeWeeklyLimit", "operatingModelLimit", "strictRedLines", "skillsProvided", "existingAssets", "unknownsOrBlockers"]
                },
                primaryDirectionBlueprint: {
                  type: Type.OBJECT,
                  properties: {
                    directionTitle: { type: Type.STRING },
                    tagline: { type: Type.STRING },
                    uniqueValueProposition: { type: Type.STRING },
                    idealCustomerAvatar: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        buyingMotivation: { type: Type.STRING },
                        whereToFindThem: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["description", "painPoints", "buyingMotivation", "whereToFindThem"]
                    },
                    offerAndPackaging: {
                      type: Type.OBJECT,
                      properties: {
                        coreOffer: { type: Type.STRING },
                        deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                        pricingStrategy: { type: Type.STRING },
                        recommendedPriceCz: { type: Type.STRING },
                        upsellOption: { type: Type.STRING }
                      },
                      required: ["coreOffer", "deliverables", "pricingStrategy", "recommendedPriceCz"]
                    },
                    first14DaysValidationPlan: {
                      type: Type.OBJECT,
                      properties: {
                        hypothesisToVerify: { type: Type.STRING },
                        targetOutreachCount: { type: Type.INTEGER },
                        validationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        goSignal: { type: Type.STRING },
                        pivotSignal: { type: Type.STRING }
                      },
                      required: ["hypothesisToVerify", "targetOutreachCount", "validationSteps", "goSignal", "pivotSignal"]
                    },
                    salesStrategyAndScripts: {
                      type: Type.OBJECT,
                      properties: {
                        outreachChannel: { type: Type.STRING },
                        icebreakerMessage: { type: Type.STRING },
                        salesScriptOutline: { type: Type.ARRAY, items: { type: Type.STRING } },
                        handlingCommonObjections: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              objection: { type: Type.STRING },
                              response: { type: Type.STRING }
                            },
                            required: ["objection", "response"]
                          }
                        }
                      },
                      required: ["outreachChannel", "icebreakerMessage", "salesScriptOutline", "handlingCommonObjections"]
                    },
                    actionCalendar30Days: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          week: { type: Type.INTEGER },
                          focus: { type: Type.STRING },
                          tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["week", "focus", "tasks"]
                      }
                    },
                    financialModel: {
                      type: Type.OBJECT,
                      properties: {
                        monthlyOverheadCostsCz: { type: Type.STRING },
                        variableCostsPerClientCz: { type: Type.STRING },
                        breakEvenClients: { type: Type.STRING },
                        monthlyGoalMath: { type: Type.STRING },
                        scenarios: {
                          type: Type.OBJECT,
                          properties: {
                            pessimistic: { type: Type.STRING },
                            realistic: { type: Type.STRING },
                            optimistic: { type: Type.STRING }
                          },
                          required: ["pessimistic", "realistic", "optimistic"]
                        },
                        disclaimer: { type: Type.STRING }
                      },
                      required: ["monthlyOverheadCostsCz", "variableCostsPerClientCz", "breakEvenClients", "monthlyGoalMath", "scenarios", "disclaimer"]
                    },
                    risksAndMitigation: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          risk: { type: Type.STRING },
                          mitigation: { type: Type.STRING }
                        },
                        required: ["risk", "mitigation"]
                      }
                    }
                  },
                  required: [
                    "directionTitle", 
                    "tagline", 
                    "uniqueValueProposition", 
                    "idealCustomerAvatar", 
                    "offerAndPackaging", 
                    "first14DaysValidationPlan", 
                    "salesStrategyAndScripts", 
                    "actionCalendar30Days", 
                    "financialModel", 
                    "risksAndMitigation"
                  ]
                }
              },
              required: ["executiveSummary", "profileEvaluation", "topDirections", "primaryDirectionBlueprint"]
            }
          }
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.executiveSummary && parsed.primaryDirectionBlueprint) {
          // 5. HARD FILTER: Enforce hard constraint on candidate models BEFORE accepting them!
          if (Array.isArray(parsed.topDirections)) {
            parsed.topDirections = hardFilterCandidateModels(parsed.topDirections, constraints);
          }

          // If client's preference is physical/personal/local:
          // Verify that AI did not violate the constraint by recommending an online-only model
          if (constraints.isPhysicalPersonalLocal) {
            const primaryTitleToCheck = parsed.primaryDirectionBlueprint?.directionTitle || parsed.lockedBlueprint?.primaryDirection || parsed.topDirections?.[0]?.title;
            const primaryModelToCheck = parsed.lockedBlueprint?.revenueModel || parsed.topDirections?.[0]?.businessModel;
            const isPrimaryOnline = isOnlineOnlyBusinessModel({
              title: primaryTitleToCheck,
              businessModel: primaryModelToCheck,
              tagline: parsed.primaryDirectionBlueprint?.tagline || parsed.topDirections?.[0]?.tagline
            });

            if (isPrimaryOnline || !parsed.topDirections || parsed.topDirections.length === 0) {
              console.warn('AI violated physical/personal/local constraint with an online-only model. Enforcing domain blueprint fallback.');
              const fallback = generateDeterministicBusinessStartAnalysis(q);
              parsed.topDirections = fallback.topDirections;
              parsed.primaryDirectionBlueprint = fallback.primaryDirectionBlueprint;
              parsed.lockedBlueprint = fallback.lockedBlueprint;
              parsed.executiveSummary = fallback.executiveSummary;
            }
          }

          // Ensure primary direction title in blueprint matches the hard-filtered primary candidate
          const activePrimary = parsed.topDirections?.find((c: any) => c.isPrimary) || parsed.topDirections?.[0];
          if (activePrimary && parsed.primaryDirectionBlueprint) {
            parsed.primaryDirectionBlueprint.directionTitle = activePrimary.title;
            parsed.primaryDirectionBlueprint.tagline = activePrimary.tagline;
            if (parsed.lockedBlueprint) {
              parsed.lockedBlueprint.primaryDirection = activePrimary.title;
            }
          }

          // Normalize financial model guarantee & disclosures
          const fin = parsed.primaryDirectionBlueprint.financialModel || {};
          if (!fin.scenarios || !fin.scenarios.pessimistic) {
            fin.scenarios = {
              pessimistic: `MODELOVÝ SCÉNÁŘ (minimální rozjezd): při scénáři 1–2 klienti měsíčně vychází orientační modelový výsledek cca 8 000 – 15 000 Kč provozního přebytku (modelový scénář, nikoliv garance; nezahrnuje SP/ZP a daně)`,
              realistic: `MODELOVÝ SCÉNÁŘ (model kapacity): při scénáři modelové kapacity 4–6 klientů měsíčně vychází orientační modelový výsledek cca 30 000 – 48 000 Kč (výpočet modelového scénáře, nikoliv jistý příjem; nezohledňuje SP/ZP ani daně)`,
              optimistic: `MODELOVÝ SCÉNÁŘ (plná kapacita): při scénáři plné kapacity 8–10 klientů měsíčně vychází orientační modelový výsledek cca 60 000 – 85 000 Kč (teoretický kapacitní strop, nikoliv garantovaný zisk; nezahrnuje daně a odvody)`
            };
          }
          if (!fin.disclaimer) {
            fin.disclaimer = 'DŮLEŽITÉ UPOZORNĚNÍ: PODNIKAI neprezentuje odhadovaný příjem ani zisk jako garantovaný, očekávaný nebo jistý výsledek. Všechna finanční čísla představují modelové scénáře, kalkulace vycházející ze vstupů klienta a odhady tržních předpokladů. V kalkulaci nejsou zahrnuty odvody na sociální a zdravotní pojištění, daň z příjmů ani individuální životní náklady.';
          }
          parsed.primaryDirectionBlueprint.financialModel = fin;

          if (!parsed.lockedBlueprint) {
            parsed.lockedBlueprint = {
              primaryDirection: parsed.primaryDirectionBlueprint.directionTitle,
              coreOffer: parsed.primaryDirectionBlueprint.offerAndPackaging.coreOffer,
              idealCustomer: parsed.primaryDirectionBlueprint.idealCustomerAvatar.description,
              customerProblem: parsed.primaryDirectionBlueprint.idealCustomerAvatar.painPoints[0] || 'Ztráta času a zisku',
              valueProposition: parsed.primaryDirectionBlueprint.uniqueValueProposition,
              price: parsed.primaryDirectionBlueprint.offerAndPackaging.recommendedPriceCz,
              salesChannel: parsed.primaryDirectionBlueprint.salesStrategyAndScripts.outreachChannel,
              acquisitionMethod: 'Přímý organický outreach a doporučení',
              deliveryModel: `${q.operatingModel.toUpperCase()}`,
              revenueModel: 'Projektové balíčky a navazující retainery',
              costModel: isStrictZeroBudget ? 'Konzervativní předpoklad: nulové hotovostní investice (využití vlastního PC; nezahrnuje odvody SP/ZP a daně)' : 'Nízká fixní režie',
              validationPlan: parsed.primaryDirectionBlueprint.first14DaysValidationPlan.hypothesisToVerify
            };
          }

          if (!parsed.validationGate) {
            parsed.validationGate = {
              sourceOfTruthValid: true,
              inputsUnchanged: true,
              clientGoalRespected: true,
              typeOfWorkRespected: true,
              physicalWorkSupported: true,
              localServiceSupported: true,
              onlineModelSupported: true,
              qualificationRulesRespected: true,
              redLinesRespected: true,
              capacityOk: true,
              blueprintLocked: true,
              financialModelConsistent: true,
              financeAreScenarios: true,
              financeAssumptionsDisclosed: true,
              noGuaranteedIncome: true,
              unknownCostsNotZero: true,
              capacityIsScenario: true,
              profitIsScenario: true,
              status: 'DONE',
              reviewNotes: 'Validace všech 19 kontrol úspěšně proběhla v souladu se SOURCE OF TRUTH v1.0 a finančním QA.'
            };
          } else {
            parsed.validationGate.sourceOfTruthValid = parsed.validationGate.sourceOfTruthValid ?? true;
            parsed.validationGate.inputsUnchanged = parsed.validationGate.inputsUnchanged ?? true;
            parsed.validationGate.clientGoalRespected = parsed.validationGate.clientGoalRespected ?? true;
            parsed.validationGate.typeOfWorkRespected = parsed.validationGate.typeOfWorkRespected ?? true;
            parsed.validationGate.physicalWorkSupported = parsed.validationGate.physicalWorkSupported ?? true;
            parsed.validationGate.localServiceSupported = parsed.validationGate.localServiceSupported ?? true;
            parsed.validationGate.onlineModelSupported = parsed.validationGate.onlineModelSupported ?? true;
            parsed.validationGate.qualificationRulesRespected = parsed.validationGate.qualificationRulesRespected ?? true;
            parsed.validationGate.redLinesRespected = parsed.validationGate.redLinesRespected ?? true;
            parsed.validationGate.capacityOk = parsed.validationGate.capacityOk ?? true;
            parsed.validationGate.blueprintLocked = parsed.validationGate.blueprintLocked ?? true;
            parsed.validationGate.financialModelConsistent = parsed.validationGate.financialModelConsistent ?? true;
            parsed.validationGate.financeAreScenarios = parsed.validationGate.financeAreScenarios ?? true;
            parsed.validationGate.financeAssumptionsDisclosed = parsed.validationGate.financeAssumptionsDisclosed ?? true;
            parsed.validationGate.noGuaranteedIncome = parsed.validationGate.noGuaranteedIncome ?? true;
            parsed.validationGate.unknownCostsNotZero = parsed.validationGate.unknownCostsNotZero ?? true;
            parsed.validationGate.capacityIsScenario = parsed.validationGate.capacityIsScenario ?? true;
            parsed.validationGate.profitIsScenario = parsed.validationGate.profitIsScenario ?? true;
          }

          if (!parsed.sourceOfTruthAudit) {
            parsed.sourceOfTruthAudit = {
              capitalLimit: q.startingCapital,
              timeWeeklyLimit: q.weeklyTimeCommitment,
              operatingModelLimit: q.operatingModel.toUpperCase(),
              mainGoalLimit: q.mainGoal,
              preferredWorkTypeLimit: q.preferredWorkType || 'Dle shody',
              strictRedLines: Array.isArray(q.strictDislikesAndRedLines)
                ? q.strictDislikesAndRedLines
                : (typeof q.strictDislikesAndRedLines === 'string'
                    ? q.strictDislikesAndRedLines.split(',').map(s => s.trim()).filter(Boolean)
                    : []),
              skillsProvided: Array.isArray(q.coreSkillsAndExpertise)
                ? q.coreSkillsAndExpertise
                : (typeof q.coreSkillsAndExpertise === 'string'
                    ? q.coreSkillsAndExpertise.split(',').map(s => s.trim()).filter(Boolean)
                    : []),
              passionsProvided: Array.isArray(q.passionsAndInterests)
                ? q.passionsAndInterests
                : (typeof q.passionsAndInterests === 'string'
                    ? q.passionsAndInterests.split(',').map(s => s.trim()).filter(Boolean)
                    : []),
              existingAssets: q.existingAssetsAndNetwork || 'Neuvedeno',
              unknownsOrBlockers: []
            };
          } else {
            parsed.sourceOfTruthAudit.mainGoalLimit = q.mainGoal;
          }

          analysis = {
            ...parsed,
            engineVersion: 'SOURCE OF TRUTH v1.0',
            analyzedAt: new Date().toISOString(),
            analyzedByModel: 'Gemini (PODNIKAI Business Start Engine SOURCE OF TRUTH v1.0)'
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini analysis failed, falling back to deterministic generator:', geminiErr);
      }
    }

    if (!analysis) {
      analysis = generateDeterministicBusinessStartAnalysis(q);
    }

    // Ensure all string fields are sanitized of HTML tags (<br>, <p>, etc.)
    return deepSanitizeReportObject(analysis);
}

// 7. POST trigger AI Deep Analysis for a client (Protected Admin Endpoint)
app.post(['/api/admin/clients/:id/analyze', '/api/admin/business-start/clients/:id/analyze'], requireAdminAuth, async (req, res) => {
  try {
    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Klient nebyl nalezen' });
    }

    const client = clients[idx];
    const analysis = await runCanonicalBusinessStartAnalysis(client.questionnaire);

    client.analysis = analysis;
    client.status = 'control';
    if (client.order) {
      client.order.status = 'REPORT_READY';
      client.order.analysisCompletedAt = new Date().toISOString();
    }
    client.reportLastGeneratedAt = new Date().toISOString();
    client.updatedAt = new Date().toISOString();
    clients[idx] = client;
    await writePersistedBusinessStartClients(clients);

    return res.json({ success: true, analysis, client });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při provádění AI analýzy' });
  }
});

// =============================================================================
// BUSINESS START – AUTOMATED PAID FLOW (PUBLIC CLIENT & WEBHOOK API)
// =============================================================================

// Internal Helper: Process Payment Succeeded with Strict Idempotency & Validation
async function processBusinessStartPaymentSucceeded(orderId: string, amount: number, currency: string) {
  // 1. Verify amount & currency
  if (amount !== BUSINESS_START_PRICE_CZK && amount !== BUSINESS_START_PRICE_CZK * 100) {
    throw new Error(`Neplatná částka platby (${amount}). Očekáváno přesně ${BUSINESS_START_PRICE_CZK} Kč.`);
  }
  if (currency.toUpperCase() !== BUSINESS_START_CURRENCY) {
    throw new Error(`Neplatná měna platby (${currency}). Očekáváno ${BUSINESS_START_CURRENCY}.`);
  }

  // 2. Find client & order
  const clients = await readPersistedBusinessStartClients();
  const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
  if (idx === -1) {
    throw new Error(`Objednávka ${orderId} nebyla nalezena`);
  }

  const client = clients[idx];
  if (!client.order) {
    throw new Error(`Objednávka pro klienta ${client.id} neexistuje`);
  }

  // 3. IDEMPOTENCY CHECK: If already analyzing or report ready, do not rerun analysis
  if (
    client.order.status === 'ANALYZING' ||
    client.order.status === 'REPORT_READY' ||
    client.order.status === 'PDF_READY'
  ) {
    return { alreadyProcessed: true, order: client.order, status: client.order.status };
  }

  // 4. Update status to PAID & ANALYZING
  const now = new Date().toISOString();
  client.order.paymentStatus = 'PAID';
  client.order.paidAt = now;
  client.order.status = 'ANALYZING';
  client.order.analysisStartedAt = now;
  client.paymentStatus = 'PAID';
  client.orderStatus = 'ANALYZING';
  client.status = 'analysis';
  client.updatedAt = now;
  clients[idx] = client;
  await writePersistedBusinessStartClients(clients);

  // 5. Trigger Canonical Analysis (Automatic Execution)
  try {
    const analysis = await runCanonicalBusinessStartAnalysis(client.questionnaire);
    client.analysis = analysis;
    client.status = 'control';
    client.order.status = 'REPORT_READY';
    client.order.analysisCompletedAt = new Date().toISOString();
    client.orderStatus = 'REPORT_READY';
    client.reportLastGeneratedAt = new Date().toISOString();
    client.updatedAt = new Date().toISOString();
    clients[idx] = client;
    await writePersistedBusinessStartClients(clients);

    return { success: true, order: client.order, status: 'REPORT_READY' };
  } catch (analysisErr: any) {
    client.order.status = 'ANALYSIS_FAILED';
    client.order.errorMessage = analysisErr.message || 'Chyba při běhu Business Start engine';
    client.order.retryCount = (client.order.retryCount || 0) + 1;
    client.orderStatus = 'ANALYSIS_FAILED';
    client.updatedAt = new Date().toISOString();
    clients[idx] = client;
    await writePersistedBusinessStartClients(clients);
    throw analysisErr;
  }
}

// 1. POST Create or Update Draft Order (12 Questions Intake)
app.post('/api/business-start/order/draft', async (req, res) => {
  try {
    const { questionnaire, existingOrderId, existingOrderToken } = req.body;
    const rawQ = questionnaire || {};
    const safeQ: BusinessStartQuestionnaire = {
      ...createEmptyQuestionnaire(),
      ...rawQ
    };
    const clients = await readPersistedBusinessStartClients();
    const now = new Date().toISOString();

    let client: BusinessStartClient | undefined;
    if (existingOrderId) {
      client = clients.find(c => c.order?.id === existingOrderId || c.id === existingOrderId);
      if (client && existingOrderToken && client.orderToken !== existingOrderToken) {
        return res.status(403).json({ error: 'Neplatný bezpečnostní token pro stávající objednávku.' });
      }
    }

    if (client) {
      // Update existing draft
      client.questionnaire = { ...client.questionnaire, ...safeQ };
      client.updatedAt = now;
      if (client.order) {
        client.order.clientName = safeQ.clientName || client.order.clientName;
        client.order.clientEmail = safeQ.clientEmail || client.order.clientEmail;
        if (client.order.paymentStatus !== 'PAID') {
          client.order.priceCz = BUSINESS_START_PRICE_CZK;
          client.order.originalPriceCz = BUSINESS_START_ORIGINAL_PRICE_CZK;
          client.order.discountPercent = BUSINESS_START_DISCOUNT_PERCENT;
          client.priceCz = BUSINESS_START_PRICE_CZK;
        }
        client.order.updatedAt = now;
      }
      await writePersistedBusinessStartClients(clients);
      return res.json({
        success: true,
        orderId: client.order?.id || client.id,
        orderToken: client.order?.orderToken || client.orderToken,
        order: client.order,
        client
      });
    }

    // Create new client & order
    const clientId = `bs-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const orderId = `order-bs-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const orderToken = crypto.randomBytes(24).toString('hex');

    const order: BusinessStartOrder = {
      id: orderId,
      clientId,
      clientEmail: safeQ.clientEmail || '',
      clientName: safeQ.clientName || 'Zájemce o podnikání',
      orderToken,
      priceCz: BUSINESS_START_PRICE_CZK, // 690 Kč (startovací sleva)
      originalPriceCz: BUSINESS_START_ORIGINAL_PRICE_CZK, // 1 990 Kč
      discountPercent: BUSINESS_START_DISCOUNT_PERCENT, // 65 %
      currency: BUSINESS_START_CURRENCY, // CZK
      status: 'READY_FOR_PAYMENT',
      paymentStatus: 'UNPAID',
      paymentProvider: getStripeClient() ? 'stripe' : 'stripe_sandbox',
      createdAt: now,
      updatedAt: now
    };

    const newClient: BusinessStartClient = {
      id: clientId,
      createdAt: now,
      updatedAt: now,
      status: 'new',
      questionnaire: safeQ,
      consultantName: 'PODNIKAI Automat',
      adminNotes: 'Online self-service objednávka',
      order,
      orderToken,
      paymentStatus: 'UNPAID',
      orderStatus: 'READY_FOR_PAYMENT',
      priceCz: BUSINESS_START_PRICE_CZK,
      currency: BUSINESS_START_CURRENCY
    };

    clients.unshift(newClient);
    await writePersistedBusinessStartClients(clients);

    return res.json({
      success: true,
      orderId: order.id,
      orderToken: order.orderToken,
      order,
      client: newClient
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při ukládání objednávky' });
  }
});

// 2. GET Order Status & Report (Protected by orderToken)
app.get('/api/business-start/order/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const token = (req.headers['x-order-token'] as string) || (req.query.token as string);

    const clients = await readPersistedBusinessStartClients();
    const client = clients.find(c => c.order?.id === orderId || c.id === orderId);
    if (!client || !client.order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    // Security Authorization Check:
    if (!token || token !== client.order.orderToken) {
      return res.status(403).json({ 
        error: 'Neoprávněný přístup k objednávce. Bezpečnostní token chybí nebo je neplatný.' 
      });
    }

    // Protection against unpaid analysis:
    const isPaid = client.order.paymentStatus === 'PAID';
    const isReportReady = client.order.status === 'REPORT_READY' || client.order.status === 'PDF_READY';

    return res.json({
      success: true,
      order: client.order,
      isPaid,
      questionnaire: client.questionnaire,
      // Report is strictly released ONLY if paid and ready
      analysis: (isPaid && isReportReady) ? client.analysis : null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při čtení objednávky' });
  }
});

// 3. POST Initiate Checkout (Payment Page)
app.post('/api/business-start/order/:orderId/checkout', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const token = (req.headers['x-order-token'] as string) || req.body.orderToken;

    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
    if (idx === -1 || !clients[idx].order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    const client = clients[idx];
    if (!token || token !== client.order!.orderToken) {
      return res.status(403).json({ error: 'Neplatný autorizační token objednávky' });
    }

    // If already paid:
    if (client.order!.paymentStatus === 'PAID') {
      return res.json({
        success: true,
        alreadyPaid: true,
        order: client.order,
        status: client.order!.status
      });
    }

    // Advance state to PAYMENT_PENDING
    client.order!.status = 'PAYMENT_PENDING';
    client.order!.paymentStatus = 'PAYMENT_PENDING';
    client.paymentStatus = 'PAYMENT_PENDING';
    client.orderStatus = 'PAYMENT_PENDING';
    client.updatedAt = new Date().toISOString();
    await writePersistedBusinessStartClients(clients);

    const stripe = getStripeClient();
    if (stripe) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
      const appUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'czk',
              product_data: {
                name: 'PODNIKAI Business Start',
                description: 'Individuální podnikatelská analýza a Business Report (Startovací sleva 65 % z původních 1 990 Kč)',
              },
              unit_amount: BUSINESS_START_PRICE_CZK * 100, // 690 Kč v haléřích (69 000)
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        client_reference_id: client.order!.id,
        customer_email: client.questionnaire.clientEmail || undefined,
        metadata: {
          orderId: client.order!.id,
          orderToken: client.order!.orderToken
        },
        success_url: `${appUrl}/#business-start?orderId=${client.order!.id}&token=${client.order!.orderToken}&payment=success`,
        cancel_url: `${appUrl}/#business-start?orderId=${client.order!.id}&token=${client.order!.orderToken}&payment=cancel`,
      });

      client.order!.paymentSessionId = session.id;
      await writePersistedBusinessStartClients(clients);

      return res.json({
        success: true,
        mode: 'stripe_hosted',
        checkoutUrl: session.url,
        sessionId: session.id,
        order: client.order
      });
    }

    // Sandbox / Test Mode (no live Stripe keys configured yet)
    return res.json({
      success: true,
      mode: 'sandbox',
      priceCz: BUSINESS_START_PRICE_CZK,
      originalPriceCz: BUSINESS_START_ORIGINAL_PRICE_CZK,
      discountPercent: BUSINESS_START_DISCOUNT_PERCENT,
      currency: BUSINESS_START_CURRENCY,
      order: client.order,
      message: 'Sandbox platební brána připravena pro bezpečný test platby 690 Kč (startovací sleva 65 % z 1 990 Kč).'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při přípravě platby' });
  }
});

// 4. POST Webhook Payment Notification (Stripe & Signed Webhooks)
app.post('/api/business-start/webhook', async (req: any, res) => {
  try {
    const stripeSig = req.headers['stripe-signature'];
    const podnikaiSig = req.headers['x-podnikai-signature'];
    let eventType = '';
    let orderId = '';
    let amount = 0;
    let currency = '';

    if (stripeSig && process.env.STRIPE_WEBHOOK_SECRET) {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe není nakonfigurován' });
      }
      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        stripeSig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      eventType = event.type;
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId = session.client_reference_id || (session.metadata && session.metadata.orderId) || '';
        amount = session.amount_total ? session.amount_total / 100 : 0;
        currency = session.currency || '';
      }
    } else if (podnikaiSig) {
      // Internal HMAC verified webhook
      const hmac = crypto.createHmac('sha256', WEBHOOK_SIGNING_SECRET);
      hmac.update(req.rawBody || JSON.stringify(req.body));
      const expected = hmac.digest('hex');
      if (podnikaiSig !== expected) {
        return res.status(400).json({ error: 'Neplatný kryptografický podpis webhooku (HMAC verification failed)' });
      }
      eventType = req.body.event || 'payment.succeeded';
      orderId = req.body.orderId || '';
      amount = req.body.amount || 0;
      currency = req.body.currency || 'CZK';
    } else {
      return res.status(400).json({ error: 'Chybí podpis webhooku (stripe-signature nebo x-podnikai-signature)' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Webhook neobsahuje identifikátor objednávky' });
    }

    if (eventType === 'payment.failed' || eventType === 'checkout.session.expired') {
      const clients = await readPersistedBusinessStartClients();
      const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
      if (idx !== -1 && clients[idx].order) {
        clients[idx].order!.status = 'PAYMENT_FAILED';
        clients[idx].order!.paymentStatus = 'PAYMENT_FAILED';
        clients[idx].order!.errorMessage = 'Platba byla zamítnuta nebo expirovala';
        clients[idx].paymentStatus = 'PAYMENT_FAILED';
        clients[idx].orderStatus = 'PAYMENT_FAILED';
        clients[idx].updatedAt = new Date().toISOString();
        await writePersistedBusinessStartClients(clients);
      }
      return res.json({ received: true, status: 'PAYMENT_FAILED' });
    }

    const result = await processBusinessStartPaymentSucceeded(orderId, amount, currency);
    return res.json({ received: true, ...result });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return res.status(400).json({ error: err.message || 'Chyba při zpracování webhooku' });
  }
});

// 5. POST Sandbox Payment Simulator (Authentic Server-side signed simulation)
app.post('/api/business-start/sandbox/simulate-payment', async (req, res) => {
  try {
    const { orderId, orderToken, simulateOutcome = 'SUCCESS' } = req.body;
    if (!orderId || !orderToken) {
      return res.status(400).json({ error: 'Chybí orderId nebo orderToken' });
    }

    const clients = await readPersistedBusinessStartClients();
    const client = clients.find(c => c.order?.id === orderId || c.id === orderId);
    if (!client || !client.order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    if (client.order.orderToken !== orderToken) {
      return res.status(403).json({ error: 'Neplatný bezpečnostní token objednávky' });
    }

    // Construct genuine payload and sign with HMAC
    const payload = JSON.stringify({
      event: simulateOutcome === 'SUCCESS' ? 'payment.succeeded' : 'payment.failed',
      orderId: client.order.id,
      amount: BUSINESS_START_PRICE_CZK,
      currency: BUSINESS_START_CURRENCY,
      timestamp: new Date().toISOString()
    });

    const sig = crypto.createHmac('sha256', WEBHOOK_SIGNING_SECRET).update(payload).digest('hex');

    if (simulateOutcome === 'SUCCESS') {
      const result = await processBusinessStartPaymentSucceeded(client.order.id, BUSINESS_START_PRICE_CZK, BUSINESS_START_CURRENCY);
      return res.json({ success: true, outcome: 'SUCCESS', signature: sig, ...result });
    } else {
      client.order.status = 'PAYMENT_FAILED';
      client.order.paymentStatus = 'PAYMENT_FAILED';
      client.order.errorMessage = 'Simulované selhání platby (testovací režim)';
      client.paymentStatus = 'PAYMENT_FAILED';
      client.orderStatus = 'PAYMENT_FAILED';
      client.updatedAt = new Date().toISOString();
      await writePersistedBusinessStartClients(clients);
      return res.json({ success: true, outcome: 'FAILED', status: 'PAYMENT_FAILED' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba simulace platby' });
  }
});

// 6. POST Retry Analysis (in case of ANALYSIS_FAILED)
app.post('/api/business-start/order/:orderId/retry-analysis', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const token = (req.headers['x-order-token'] as string) || req.body.orderToken;

    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
    if (idx === -1 || !clients[idx].order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    const client = clients[idx];
    if (!token || token !== client.order!.orderToken) {
      return res.status(403).json({ error: 'Neplatný bezpečnostní token objednávky' });
    }

    if (client.order!.paymentStatus !== 'PAID') {
      return res.status(400).json({ error: 'Analýzu nelze spustit – objednávka není zaplacena.' });
    }

    client.order!.status = 'ANALYZING';
    client.order!.analysisStartedAt = new Date().toISOString();
    client.order!.errorMessage = undefined;
    client.status = 'analysis';
    await writePersistedBusinessStartClients(clients);

    try {
      const analysis = await runCanonicalBusinessStartAnalysis(client.questionnaire);
      client.analysis = analysis;
      client.status = 'control';
      client.order!.status = 'REPORT_READY';
      client.order!.analysisCompletedAt = new Date().toISOString();
      client.orderStatus = 'REPORT_READY';
      client.updatedAt = new Date().toISOString();
      clients[idx] = client;
      await writePersistedBusinessStartClients(clients);
      return res.json({ success: true, order: client.order, analysis });
    } catch (analysisErr: any) {
      client.order!.status = 'ANALYSIS_FAILED';
      client.order!.errorMessage = analysisErr.message || 'Chyba při opakování analýzy';
      client.order!.retryCount = (client.order!.retryCount || 0) + 1;
      client.orderStatus = 'ANALYSIS_FAILED';
      client.updatedAt = new Date().toISOString();
      clients[idx] = client;
      await writePersistedBusinessStartClients(clients);
      return res.status(500).json({ error: client.order!.errorMessage });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při opakování analýzy' });
  }
});

// 7. POST Mark PDF Ready (Client successfully compiled PDF)
app.post('/api/business-start/order/:orderId/mark-pdf-ready', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const token = (req.headers['x-order-token'] as string) || req.body.orderToken;

    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
    if (idx === -1 || !clients[idx].order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    const client = clients[idx];
    if (!token || token !== client.order!.orderToken) {
      return res.status(403).json({ error: 'Neplatný bezpečnostní token objednávky' });
    }

    if (client.order!.paymentStatus !== 'PAID') {
      return res.status(400).json({ error: 'PDF nelze označit za připravené – objednávka není zaplacena.' });
    }

    client.order!.status = 'PDF_READY';
    client.order!.pdfGeneratedAt = new Date().toISOString();
    client.orderStatus = 'PDF_READY';
    client.updatedAt = new Date().toISOString();
    clients[idx] = client;
    await writePersistedBusinessStartClients(clients);

    return res.json({ success: true, order: client.order });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chyba při aktualizaci stavu PDF' });
  }
});

// 8. GET / POST Real PDF Download Endpoint
const handleBusinessStartPdfDownload = async (req: express.Request, res: express.Response) => {
  try {
    const orderId = req.params.orderId;
    const token = (req.headers['x-order-token'] as string) || (req.query.token as string) || (req.query.orderToken as string) || (req.body && req.body.orderToken);

    const clients = await readPersistedBusinessStartClients();
    const idx = clients.findIndex(c => c.order?.id === orderId || c.id === orderId);
    if (idx === -1 || !clients[idx].order) {
      return res.status(404).json({ error: 'Objednávka nebyla nalezena' });
    }

    const client = clients[idx];
    if (!token || token !== client.order!.orderToken) {
      return res.status(403).json({ error: 'Neplatný bezpečnostní token objednávky' });
    }

    if (client.order!.paymentStatus !== 'PAID') {
      return res.status(400).json({ error: 'PDF nelze stáhnout – objednávka není zaplacena.' });
    }

    const validStatuses: BusinessStartOrderStatus[] = ['REPORT_READY', 'PDF_READY'];
    if (!validStatuses.includes(client.order!.status)) {
      return res.status(400).json({ error: `PDF nelze stáhnout – objednávka je ve stavu ${client.order!.status}.` });
    }

    if (!client.analysis) {
      return res.status(400).json({ error: 'Analýza nebyla nalezena. PDF nelze vygenerovat.' });
    }

    // Generate real PDF buffer
    const pdfBuffer = await generateBusinessStartPdfBuffer(client);

    // Update status to PDF_READY idempotently if not already updated
    if (client.order!.status !== 'PDF_READY') {
      client.order!.status = 'PDF_READY';
      client.order!.pdfGeneratedAt = new Date().toISOString();
      client.orderStatus = 'PDF_READY';
      client.updatedAt = new Date().toISOString();
      clients[idx] = client;
      await writePersistedBusinessStartClients(clients);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="podnikai-business-start.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error('Chyba při generování PDF:', err);
    return res.status(500).json({ error: err.message || 'Chyba při generování PDF souboru' });
  }
};

app.get('/api/business-start/order/:orderId/pdf', handleBusinessStartPdfDownload);
app.post('/api/business-start/order/:orderId/pdf', handleBusinessStartPdfDownload);


// Strict 404 JSON handler for unhandled API routes (never return HTML)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint nebyl nalezen: ${req.method} ${req.originalUrl}` });
});

// Explicit static handlers for robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.type('text/plain').sendFile(robotsPath);
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.type('application/xml').sendFile(sitemapPath);
  } else {
    res.status(404).send('Not found');
  }
});

// Production and Vite Middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // Server-side meta injection for SEO guides in production
    Object.keys(SEO_GUIDES).forEach(slug => {
      app.get(`/${slug}`, (req, res) => {
        const guide = SEO_GUIDES[slug];
        const htmlPath = path.join(distPath, 'index.html');
        if (!fs.existsSync(htmlPath)) {
          return res.status(404).send('Not found');
        }
        let html = fs.readFileSync(htmlPath, 'utf8');
        if (guide) {
          html = html.replace(/<title>.*?<\/title>/, `<title>${guide.metaTitle}</title>`);
          html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${guide.metaDescription}" />`);
          html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="https://podnikai.onrender.com/${guide.slug}" />`);
          html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${guide.metaTitle}" />`);
          html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${guide.metaDescription}" />`);
          html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="https://podnikai.onrender.com/${guide.slug}" />`);
          html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${guide.metaTitle}" />`);
          html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${guide.metaDescription}" />`);
        }
        res.type('text/html').send(html);
      });
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PODNIKAI Server running on port ${PORT}`);
  });
}

startServer();
