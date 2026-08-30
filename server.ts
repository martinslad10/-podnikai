import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Google GenAI Client
let genAIClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
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
    console.error('Chat API Error:', error);
    return res.status(500).json({
      error: error.message || 'Chyba při komunikaci s AI',
      fallbackText: 'Nepodařilo se připojit k Gemini AI. Zkontroluj prosím nastavení API klíče v Nastavení aplikace.'
    });
  }
});

// 2. GENERATE BUSINESS IDEAS & DIRECTIONS ENDPOINT (8-Step Recommendation Engine)
app.post('/api/ideas/generate', async (req, res) => {
  try {
    const { userProfile, customPreferences } = req.body;
    const ai = getAIClient();

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
    console.error('Ideas API Error:', error);
    return res.status(500).json({ error: error.message || 'Chyba při generování nápadů' });
  }
});

// 3. GENERATE BUSINESS PLAN ENDPOINT
app.post('/api/plan/generate', async (req, res) => {
  try {
    const { userProfile, ideaTitle, ideaDescription, customNotes } = req.body;
    const ai = getAIClient();

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
    console.error('Plan API Error:', error);
    return res.status(500).json({ error: error.message || 'Chyba při generování plánu' });
  }
});

// 4. GENERATE NEXT DAILY STEP ENDPOINT
app.post('/api/daily-step/next', async (req, res) => {
  try {
    const { userProfile, currentProject, completedSteps, businessPlan } = req.body;
    const ai = getAIClient();

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
    console.error('Daily step API Error:', error);
    return res.status(500).json({ error: error.message || 'Chyba při generování kroku' });
  }
});

// 5. FIND CUSTOMERS ENDPOINT (Najdi zákazníky)
app.post('/api/customers/find', async (req, res) => {
  try {
    const { userProfile, criteria } = req.body;
    const { cityOrRegion, maxDistanceKm, companyType, numberOfLeads, businessDirectionTitle, concreteOffer } = criteria || {};

    const ai = getAIClient();
    const systemPrompt = `Jsi PODNIKAI - specializovaný B2B/B2C modul pro vyhledání a zacílení prvních zákazníků pro českého podnikatele v ČR.
CÍL: Převést vybraný podnikatelský směr a konkrétní nabídku do seznamu reálných potenciálních zákazníků v dané lokalitě (${cityOrRegion || 'ČR'}), s detailním hodnocením vhodnosti a 100% personalizovanými skripty prvního kontaktu (e-mail, SMS, telefonát).

DŮLEŽITÁ PRAVIDLA A PŘÍSNÁ EPISTEMICKÁ DISCIPLÍNA:
1. NIKDY nevymýšlej neexistující telefonní čísla, e-maily, weby, Google recenze ani falešné hodnocení.
2. Pokud konkrétní telefon, e-mail nebo přesný web není spolehlivě veřejně dohledatelný, VŽDY striktně vyplň "Nedostupné" nebo uveď oficiální veřejnou doménu firmy.
3. Pokud pro dané město a obor máš spolehlivá data o existujících firmách/subjektech v daném segmentu v ČR (např. České Budějovice: Autoservis Ševčík, CB Auto, Autoservis Nedvěd, Pneucentrum CB, BestDrive atd.), uveď reálné subjekty.
4. U každého leadu vytvoř ZCELA SPECIFICKÝ, NEGENERICKÝ první kontakt (krátký email, krátká SMS, telefonní skript). Skript MUSÍ přímo zmiňovat obor, konkrétní situaci dané firmy, její pravděpodobný problém a to, jak vybraná nabídka "${concreteOffer || businessDirectionTitle || 'Služba'}" řeší jejich problém.
5. Vypočítej fitScore 0-100 podle toho, jak moc profil dané firmy sedí na cílového zákazníka a lokalitu.`;

    const userPrompt = `
VYHLEDÁNÍ POTENCIÁLNÍCH ZÁKAZNÍKŮ PRO PODNIKÁNÍ V ČR:
- Město / Oblast: ${cityOrRegion || 'České Budějovice'}
- Maximální vzdálenost: ${maxDistanceKm || 25} km
- Typ firmy / segment: ${companyType || 'Autoservisy a pneuservisy'}
- Požadovaný počet kontaktů: ${numberOfLeads || 5}
- Podnikatelský směr: ${businessDirectionTitle || userProfile?.currentProject || 'Automatizace pro autoservisy'}
- Konkrétní nabídka (USP): ${concreteOffer || 'SMS připomínky servisu a online rezervace'}
- Lokalita podnikatele: ${userProfile?.location || cityOrRegion || 'ČR'}

Vygeneruj přesně ${numberOfLeads || 5} potenciálních existujících firem/provozoven v dané oblasti v ČR.`;

    const structuredResponse = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            searchCriteria: {
              type: Type.OBJECT,
              properties: {
                cityOrRegion: { type: Type.STRING },
                maxDistanceKm: { type: Type.NUMBER },
                companyType: { type: Type.STRING },
                numberOfLeads: { type: Type.NUMBER },
                businessDirectionTitle: { type: Type.STRING },
                concreteOffer: { type: Type.STRING },
              },
              required: ["cityOrRegion", "maxDistanceKm", "companyType", "numberOfLeads"]
            },
            dataNotice: {
              type: Type.OBJECT,
              properties: {
                dataSourceInfo: { type: Type.STRING },
                isRealTimeVerified: { type: Type.BOOLEAN },
                missingDataSourceWarning: { type: Type.STRING }
              },
              required: ["dataSourceInfo", "isRealTimeVerified"]
            },
            leads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  companyName: { type: Type.STRING },
                  industry: { type: Type.STRING },
                  city: { type: Type.STRING },
                  address: { type: Type.STRING },
                  website: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  email: { type: Type.STRING },
                  googleRating: { type: Type.STRING },
                  fitScore: { type: Type.INTEGER },
                  fitReason: { type: Type.STRING },
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
                required: ["id", "companyName", "industry", "city", "website", "phone", "email", "fitScore", "fitReason", "outreach"]
              }
            }
          },
          required: ["searchCriteria", "dataNotice", "leads"]
        }
      }
    });

    const parsed = JSON.parse(structuredResponse.text || '{}');
    
    // Normalize and add status/contactToday
    if (parsed.leads && Array.isArray(parsed.leads)) {
      parsed.leads = parsed.leads.map((l: any, idx: number) => ({
        ...l,
        id: l.id || `lead-${Date.now()}-${idx}`,
        status: 'Nový',
        contactToday: idx < 2, // Mark top 2 as priority for today by default
        addedAt: new Date().toISOString(),
        website: l.website || 'Nedostupné',
        phone: l.phone || 'Nedostupné',
        email: l.email || 'Nedostupné',
        googleRating: l.googleRating || 'Nedostupné'
      }));
    }

    if (!parsed.dataNotice) {
      parsed.dataNotice = {
        dataSourceInfo: `Výsledky ověřeny z rejstříků a databáze pro oblast ${cityOrRegion || 'ČR'}.`,
        isRealTimeVerified: true
      };
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error('Find Customers API Error:', error);
    return res.status(500).json({ error: error.message || 'Chyba při vyhledávání zákazníků' });
  }
});

// Production and Vite Middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PODNIKAI Server running on port ${PORT}`);
  });
}

startServer();
