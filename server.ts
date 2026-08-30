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

  return `Jsi PODNIKAI – špičkový, pragmatický a akčně zaměřený AI parťák pro české podnikatele.
Tvým úkolem je pomoci uživateli vybudovat, validovat a škálovat reálné, ziskové podnikání v podmínkách České republiky a EU.

${profileSummary}

${customContext}

PRAVIDLA PRO TVŮJ TÓN A ODPOVĚDI:
1. Komunikuj VÝHRADNĚ česky (tykej uživateli profesionálně, přátelsky, energicky jako zkušený byznys mentor).
2. Buď PRAKTICKÝ, KONKRÉTNÍ, PŘÍMÝ a STRUKTUROVANÝ.
3. ŽÁDNÉ PRÁZDNÉ MOTIVAČNÍ FRÁZE typu "věř si a všechno půjde". Místo toho dej konkrétní čísla, kalkulace, postupy, prodejní skripty a kroky.
4. Zohledňuj české reálie (OSVČ, živnostenské listy, DPH, Fakturoid/iDoklad, Shoptet, české platební brány, lokální skupiny, sítě LinkedIn/Instagram/Facebook).
5. Vždy respektuj limity uživatele (rozpočet, čas, dovednosti a zejména to, co NECHCE dělat).
6. Každou odpověď zakonči 1 až 2 konkrétními akčními kroky, které může uživatel udělat DNES nebo do 48 hodin.`;
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
        temperature: 0.7,
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

// 2. GENERATE BUSINESS IDEAS ENDPOINT
app.post('/api/ideas/generate', async (req, res) => {
  try {
    const { userProfile, customPreferences } = req.body;
    const ai = getAIClient();

    const systemPrompt = buildSystemPrompt(userProfile);
    const userPrompt = `
Navrhni přesně 3 až 4 vysoce personalizované podnikatelské nápady pro tohoto uživatele.

Kritéria:
- Musí přesně odpovídat jeho rozpočtu (${userProfile?.startingBudget || 'neuvedeno'}),
- Musí být realizovatelné v jeho čase (${userProfile?.availableTime || 'neuvedeno'}),
- Musí využít jeho dovednosti (${Array.isArray(userProfile?.skills) ? userProfile.skills.join(', ') : 'všeobecné'}) a zájmy (${Array.isArray(userProfile?.passions) ? userProfile.passions.join(', ') : 'všeobecné'}),
- NESMÍ obsahovat to, co uživatel nechce dělat (${Array.isArray(userProfile?.dislikes) ? userProfile.dislikes.join(', ') : 'žádná omezení'}),
- Preference: ${userProfile?.onlineOffline || 'hybrid'},
- Lokalita: ${userProfile?.location || 'Česká republika'}.
${customPreferences ? `Dodatečné přání uživatele: ${customPreferences}` : ''}

Každý nápad musí obsahovat konkrétní odhady a hodnocení.`;

    const response = await ai.models.generateContent({
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
              id: { type: Type.STRING, description: "Unikátní ID, např. 'idea-1'" },
              title: { type: Type.STRING, description: "Chytlavý a jasný název byznysu" },
              tagline: { type: Type.STRING, description: "Jednověté shrnutí hodnotové nabídky" },
              description: { type: Type.STRING, description: "Podrobnější vysvětlení jak to funguje v praxi" },
              initialCosts: { type: Type.STRING, description: "Konkrétní odhad v Kč, např. '0 - 5 000 Kč'" },
              initialCostsLevel: { type: Type.STRING, description: "'low' | 'medium' | 'high'" },
              difficulty: { type: Type.STRING, description: "'low' | 'medium' | 'high'" },
              incomePotential: { type: Type.STRING, description: "Měsíční potenciál v Kč, např. '40 000 - 80 000 Kč/měsíc'" },
              launchSpeed: { type: Type.STRING, description: "Odhad času spuštění, např. '1-2 týdny'" },
              risk: { type: Type.STRING, description: "'low' | 'medium' | 'high'" },
              whyItFits: { type: Type.STRING, description: "Proč to přesně sedí na dovednosti a zájmy uživatele" },
              firstValidationStep: { type: Type.STRING, description: "Jeden okamžitý krok jak nápad otestovat do 48 hodin bez utrácení" },
              targetAudience: { type: Type.STRING, description: "Kdo je ideální platící zákazník v ČR" }
            },
            required: [
              "id", "title", "tagline", "description", "initialCosts",
              "initialCostsLevel", "difficulty", "incomePotential",
              "launchSpeed", "risk", "whyItFits", "firstValidationStep", "targetAudience"
            ]
          }
        }
      }
    });

    const parsedIdeas = JSON.parse(response.text || '[]');
    return res.json({ ideas: parsedIdeas });
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
