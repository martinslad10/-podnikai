import { 
  BusinessIdea, 
  BusinessPlan, 
  CustomerFinderResponse, 
  CustomerSearchCriteria, 
  DailyStep, 
  PotentialCustomerLead, 
  UserProfile,
  BusinessStartClient,
  BusinessStartQuestionnaire,
  BusinessStartAnalysis,
  BusinessStartStats,
  BusinessStartOrder,
  BusinessStartOrderStatus,
  BusinessStartPaymentStatus
} from '../types';
import { generatePersonalizedIdeas } from '../utils/personalizedIdeaGenerator';

export async function checkServerHealth(): Promise<{ status: string; hasApiKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline', hasApiKey: false };
  }
}

export async function sendChatMessage(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  userProfile: UserProfile | null,
  currentProject?: string
): Promise<{ text: string; suggestions?: string[] }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, userProfile, currentProject }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('Backend chat API failed, using intelligent client fallback:', err);
    return getFallbackChatResponse(messages[messages.length - 1]?.content || '', userProfile);
  }
}

export async function generateBusinessIdeas(
  userProfile: UserProfile,
  customPreferences?: string
): Promise<{ ideas: BusinessIdea[]; generationData?: import('../types').IdeaGenerationResponse }> {
  try {
    const res = await fetch('/api/ideas/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile, customPreferences }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.data && Array.isArray(data.data.directions) && data.data.directions.length > 0) {
      return {
        ideas: data.ideas || [],
        generationData: data.data
      };
    }
    if (Array.isArray(data.ideas) && data.ideas.length > 0) {
      return { ideas: data.ideas, generationData: data.data };
    }
    throw new Error('Empty ideas response');
  } catch (err: any) {
    console.warn('Backend ideas API failed, generating tailored fallback directions:', err);
    return getFallbackIdeasResult(userProfile);
  }
}

export async function generateBusinessPlan(
  userProfile: UserProfile,
  ideaTitle: string,
  ideaDescription: string,
  customNotes?: string
): Promise<BusinessPlan> {
  try {
    const res = await fetch('/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile, ideaTitle, ideaDescription, customNotes }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.plan && data.plan.projectName) {
      return data.plan;
    }
    throw new Error('Invalid plan structure');
  } catch (err: any) {
    console.warn('Backend plan API failed, generating fallback business plan:', err);
    return getFallbackBusinessPlan(userProfile, ideaTitle, ideaDescription);
  }
}

export async function generateNextDailyStep(
  userProfile: UserProfile,
  currentProject: string,
  completedSteps: DailyStep[],
  businessPlan?: BusinessPlan | null
): Promise<DailyStep> {
  try {
    const res = await fetch('/api/daily-step/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile, currentProject, completedSteps, businessPlan }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.step && data.step.title) {
      return data.step;
    }
    throw new Error('Invalid step response');
  } catch (err: any) {
    console.warn('Backend step API failed, using fallback daily step:', err);
    return getFallbackDailyStep(userProfile, currentProject, completedSteps);
  }
}

export async function findPotentialCustomers(
  userProfile: UserProfile,
  criteria: CustomerSearchCriteria
): Promise<CustomerFinderResponse> {
  const res = await fetch('/api/customers/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userProfile, criteria }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    throw new Error(`Server vrátil neočekávanou odpověď (HTTP ${res.status}): ${rawText.slice(0, 120)}`);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Chyba při vyhledávání firem (HTTP ${res.status})`);
  }

  if (data && Array.isArray(data.leads)) {
    return data;
  }
  throw new Error('Neplatný formát odpovědi od poskytovatele vyhledávání.');
}

export async function fetchSavedLeads(): Promise<PotentialCustomerLead[]> {
  try {
    const res = await fetch('/api/leads');
    if (!res.ok) return [];
    const data = await res.json();
    const rawList = Array.isArray(data?.leads) ? data.leads : [];
    return rawList.map((l: any) => ({
      ...l,
      website: l.website || 'Nedostupné',
      phone: l.phone || 'Nedostupné',
      email: l.email || 'Nedostupné',
      emailSourceUrl: l.emailSourceUrl,
      emailSourceType: l.emailSourceType,
      emailStatus: l.emailStatus,
      emailMetadata: l.emailMetadata,
      googleRating: l.googleRating || 'Nedostupné',
      industry: l.industry || l.category || 'Podnikání a služby',
      status: l.status || 'Nový',
      fitScore: typeof l.fitScore === 'number' ? l.fitScore : 75,
      scoreBreakdown: Array.isArray(l.scoreBreakdown) ? l.scoreBreakdown.map((sb: any) => ({
        ...sb,
        category: (sb.category === 'Vzdělanost' || sb.category === 'Vzdelanost') ? 'Vzdálenost' : sb.category
      })) : l.scoreBreakdown,
      activities: Array.isArray(l.activities) ? l.activities : []
    }));
  } catch (err) {
    console.warn('Could not fetch leads from server, using local data:', err);
    return [];
  }
}

export async function saveLeadsToServer(leads: PotentialCustomerLead[]): Promise<boolean> {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not persist leads to server:', err);
    return false;
  }
}

export async function recordLeadActivityOnServer(
  leadId: string,
  activityData: {
    channel: import('../types').ContactChannel;
    result: string;
    status?: import('../types').LeadStatus;
    note?: string;
    nextContactDate?: string;
    scheduledAt?: string;
    isSimulation?: boolean;
  }
): Promise<{ success: boolean; lead?: PotentialCustomerLead; activity?: import('../types').LeadActivity }> {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData),
    });
    if (!res.ok) {
      return { success: false };
    }
    return await res.json();
  } catch (err) {
    console.warn('Could not record activity on server:', err);
    return { success: false };
  }
}

export async function fetchOutreachSequence(
  lead: PotentialCustomerLead,
  tone: import('../types').OutreachTone = 'professional',
  userProfile?: UserProfile | null,
  offerContext?: { concreteOffer?: string; businessDirectionTitle?: string }
): Promise<import('../types').LeadOutreachSequence> {
  try {
    const res = await fetch('/api/outreach/sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead,
        tone,
        userProfile,
        concreteOffer: offerContext?.concreteOffer,
        businessDirectionTitle: offerContext?.businessDirectionTitle,
        leadIntelligence: lead.leadIntelligence
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.sequence) {
        const { validateAndSanitizeSequence } = await import('../utils/outreachGenerator');
        return validateAndSanitizeSequence(data.sequence, lead, {
          tone,
          userProfile: userProfile || undefined,
          concreteOffer: offerContext?.concreteOffer,
          businessDirectionTitle: offerContext?.businessDirectionTitle
        });
      }
    }
  } catch (err) {
    console.warn('Backend sequence generation failed, using local generator:', err);
  }

  // Local fallback generator import
  const { generateOutreachSequence } = await import('../utils/outreachGenerator');
  return generateOutreachSequence(lead, {
    tone,
    userProfile: userProfile || undefined,
    concreteOffer: offerContext?.concreteOffer,
    businessDirectionTitle: offerContext?.businessDirectionTitle
  });
}

export async function analyzeLeadIntelligence(
  lead: PotentialCustomerLead,
  userProfile?: UserProfile | null,
  offerContext?: { concreteOffer?: string; businessDirectionTitle?: string }
): Promise<{ success: boolean; leadIntelligence: import('../types').LeadIntelligence; lead?: PotentialCustomerLead }> {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead,
        userProfile,
        concreteOffer: offerContext?.concreteOffer,
        businessDirectionTitle: offerContext?.businessDirectionTitle
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.leadIntelligence) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Server lead intelligence analysis failed, using local fallback:', err);
  }

  // Client-side fallback adhering strictly to guidelines (verified facts, AI hypotheses, recommended approach)
  const company = lead.companyName || 'Firma';
  const city = lead.city || 'v regionu';
  const industry = (lead.industry && lead.industry !== 'Nedostupné') ? lead.industry : 'služby a podnikání';
  const offer = offerContext?.concreteOffer || 'optimalizace a zrychlení poptávek';
  const webSource = (lead.website && lead.website !== 'Nedostupné') 
    ? `Veřejný web firmy (${lead.website})` 
    : 'Veřejný profil oboru a lokality';

  const verifiedFacts: import('../types').LeadIntelligenceVerifiedFacts = {
    companyName: company,
    industry,
    address: [lead.address, lead.city].filter(Boolean).join(', ') || 'Česká republika',
    website: (lead.website && lead.website !== 'Nedostupné') ? lead.website : 'Nedostupný',
    phone: (lead.phone && lead.phone !== 'Nedostupné') ? lead.phone : 'Neuveden',
    ratingAndReviews: (lead.googleRating && lead.googleRating !== 'Nedostupné') 
      ? `${lead.googleRating} – veřejný záznam profilu (pouze popisný údaj; nevyjadřuje nákupní záměr ani poptávku)`
      : undefined,
    sourceSummary: (lead.website && lead.website !== 'Nedostupné') ? `Veřejný web firmy (${lead.website})` : 'Veřejný záznam profilu a lokality'
  };

  const hypotheses: import('../types').LeadIntelligenceHypotheses = {
    opportunity: `Nebyl nalezen dostatečně silný veřejný signál pro konkrétní obchodní hypotézu. Doporučujeme ověřit potřebu při prvním kontaktu.`,
    opportunitySourceSignal: `Veřejný profil firmy bez detailních provozních signálů.`,
    offer: `Nezávazné ověření aktuálních provozních priorit firmy ${company} v oblasti ${offer}.`,
    offerSourceSignal: `Vychází z deklarovaného oboru ${industry}; konkrétní potřebu je nutné zjistit při prvním kontaktu.`,
    whyThisCompany: `Firma ${company} působí v oboru ${industry} v lokalitě ${city}. Z veřejných zdrojů nelze spolehlivě odvodit interní procesy; doporučujeme nevymýšlet domnělé problémy a potřeby ověřit přímo při kontaktu.`,
    whyThisCompanySourceSignal: `Veřejný profil oboru a lokality.`
  };

  const idealContactPerson: import('../types').LeadIntelligenceContactPerson = {
    role: 'Majitel / jednatel společnosti',
    confidence: 'derived_role_only',
    sourceNote: 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.',
    source: 'Obvyklá organizační struktura (doporučeno ověřit při kontaktu)'
  };

  const recommendedApproach: import('../types').LeadIntelligenceRecommendedApproach = {
    icebreaker: `Dobrý den, obracím se na vás ohledně působení ${company} v ${city}. Z vašich veřejných informací vnímám zaměření na ${industry} a rád bych s vámi nezávazně ověřil, zda u vás řešíte zjednodušení příjmu a odbavování poptávek.`,
    icebreakerSource: `${webSource} – zaměření firmy a lokalita`,
    idealContactPerson,
    nextStepRecommendation: 'Při prvním kontaktu představit hypotézu jako nezávazný námět k diskusi, ověřit reálné nastavení firmy a respektovat čas majitele.'
  };

  const fallbackIntel: import('../types').LeadIntelligence = {
    verifiedFacts,
    hypotheses,
    recommendedApproach,
    opportunity: hypotheses.opportunity,
    opportunitySource: hypotheses.opportunitySourceSignal,
    offer: hypotheses.offer,
    offerSource: hypotheses.offerSourceSignal,
    whyThisCompany: hypotheses.whyThisCompany,
    whyThisCompanySource: hypotheses.whyThisCompanySourceSignal,
    icebreaker: recommendedApproach.icebreaker,
    icebreakerSource: recommendedApproach.icebreakerSource,
    idealContactPerson,
    signals: [
      {
        observation: lead.website && lead.website !== 'Nedostupné'
          ? `Prezentace firmy uvádí kontaktní telefon a e-mail, ale postrádá interaktivní poptávkový či rezervační formulář.`
          : `Zákaznický kontakt probíhá převážně telefonicky či e-mailem, chybí online specifikace zakázky.`,
        signal: lead.website && lead.website !== 'Nedostupné'
          ? `Prezentace firmy uvádí kontaktní telefon a e-mail, ale postrádá interaktivní poptávkový či rezervační formulář.`
          : `Zákaznický kontakt probíhá převážně telefonicky či e-mailem, chybí online specifikace zakázky.`,
        source: webSource,
        relevanceReason: 'Může indikovat manuální administrativu při evidenci zájemců – doporučujeme ověřit při kontaktu.',
        type: 'verified_fact',
        significance: 'high'
      },
      {
        observation: `Firma působí v oboru ${industry} v lokalitě ${city}.`,
        signal: `Firma působí v oboru ${industry} v lokalitě ${city}.`,
        source: 'Veřejný profil firmy',
        relevanceReason: 'Místní konkurence v oboru často vyžaduje rychlé reakce na poptávky – doporučujeme ověřit stav u firmy.',
        type: 'ai_hypothesis',
        significance: 'medium'
      }
    ],
    analyzedAt: new Date().toISOString(),
    sourceWebsite: lead.website !== 'Nedostupné' ? lead.website : undefined,
    analysisMethod: lead.website && lead.website !== 'Nedostupné' ? 'web_deep_dive' : 'public_domain_analysis'
  };

  return { success: true, leadIntelligence: fallbackIntel };
}

export async function saveOutreachSequenceToServer(
  leadId: string,
  sequence: import('../types').LeadOutreachSequence
): Promise<boolean> {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save sequence to server:', err);
    return false;
  }
}

// Fallback generators in case API key is not configured or temporary connectivity error occurs
function getFallbackChatResponse(userMsg: string, profile: UserProfile | null): { text: string; suggestions: string[] } {
  const lower = userMsg.toLowerCase();
  const name = profile?.name || 'příteli';

  if (lower.includes('nevím s čím') || lower.includes('nemám nápad') || lower.includes('jak začít')) {
    return {
      text: `Ahoj ${name}! Rozumím tvé situaci. Když člověk začíná a neví přesně s čím, největší chybou je čekat na "geniální a unikátní nápad". Úspěšný byznys vzniká řešením existujících problémů lidí, kteří už za to platí.

S tvým rozpočtem (${profile?.startingBudget || '0–10 000 Kč'}) a časem (${profile?.availableTime || '10 h/týden'}) doporučuji zaměřit se na **služby s vysokou přidanou hodnotou** nebo **specializovaný zprostředkovatelský model**.

**Doporučený postup pro tebe:**
1. Klikni nahoře na záložku **„Najít nápad“** – vygeneruji ti 3 konkrétní směry podle tvých dovedností.
2. Vyber si jeden, který tě nejméně odpuzuje a má nejrychlejší cestu k prvnímu zákazníkovi.
3. Společně vytvoříme nabídku, kterou ještě tento týden nabídneme 3 lidem.`,
      suggestions: [
        'Vygenerovat nápady na míru',
        'Jaké služby mají dnes v ČR nejvyšší marži?',
        'Jak ověřit nápad do 24 hodin bez webu?'
      ]
    };
  }

  if (lower.includes('detailing') || lower.includes('mytí aut') || lower.includes('auto')) {
    return {
      text: `Skvělá volba, ${name}! Auto-detailing je v Česku velmi lukrativní obor, protože majitelé prémiovějších aut jsou ochotni platit 4 000 až 15 000 Kč za kompletní péči, pokud mají jistotu perfektního výsledku.

**Akční postup od nuly k prvním 5 zákazníkům:**

### 1. Fáze: Nabídka a portfolio (Dny 1–3)
- Nezačínej drahým pronájmem dílny. Začni jako mobilní detailing nebo v domácí garáži.
- Udělej 2 auta rodině/kamarádům ZDARMA výměnou za detailní video a foto "Před / Po" a recenzi na Google/Instagram.

### 2. Fáze: Cenotvorba pro začátek
- **Základní hloubkové čištění interiéru + tepování:** 2 490 Kč (čas: cca 3 h)
- **Kompletní balíček (interiér + 1krokové leštění + keramický vosk):** 4 990 Kč (čas: cca 5 h)

### 3. Fáze: Získání prvních platících klientů (Tento týden)
- Vyfoť kvalitní fotky své práce a přidej příspěvek do lokálních FB skupin v okolí (${profile?.location || 'tvé město'}).
- Oslov lokální autobazary a firmy s firemní flotilou – nabídni vyčištění 1 referenčního vozu za 50% cenu.

**Tvůj dnešní krok:** Udělej si seznam 5 známých, kterým nabídneš ukázkové čištění auta pro tvé portfolio.`,
      suggestions: [
        'Vytvořit pro detailing kompletní Byznys plán',
        'Jaké základní vybavení koupit do 15 000 Kč?',
        'Jak napsat prodejní zprávu pro první klienty?'
      ]
    };
  }

  return {
    text: `Rozumím, ${name}. Pojďme se na to podívat z pohledu maximální návratnosti a minimálního rizika.

Pro tvůj cíl (${profile?.goal || 'vybudovat stabilní příjem'} s cílem ${profile?.targetIncome || '50 000+ Kč/měsíc'}) je klíčové soustředit se na **prodej a validaci**, nikoliv na nekonečnou přípravu.

**3 zásadní pravidla pro aktuální fázi:**
1. **Ověř poptávku před investicí:** Nikdy nekupuj zásoby ani drahý software, dokud nemáš první předobjednávku nebo zálohu.
2. **Jednoduchá nabídka (USP):** Zákazník nekupuje produkt, kupuje transformaci (úsporu času, peněz nebo méně stresu).
3. **Přímý prodej:** Osobní zprávy a networking fungují na začátku 10x lépe než placená reklama.

Co konkrétně teď potřebuješ vyřešit jako prioritu? Můžeš využít tlačítka níže nebo mi napsat detail.`,
    suggestions: [
      'Pomoz mi sestavit neodolatelnou nabídku',
      'Jak nastavit cenotvorbu a marže?',
      'Vygenerovat akční byznys plán'
    ]
  };
}

function getFallbackIdeasResult(profile: UserProfile): { ideas: BusinessIdea[]; generationData: import('../types').IdeaGenerationResponse } {
  const result = generatePersonalizedIdeas(profile);
  return {
    ideas: result.ideas || [],
    generationData: result
  };
}

function getFallbackBusinessPlan(profile: UserProfile, ideaTitle: string, ideaDesc: string): BusinessPlan {
  return {
    projectName: ideaTitle || 'Podnikatelský projekt',
    summary: `Komplexní podnikatelský plán pro projekt **${ideaTitle}** přizpůsobený pro ${profile.name || 'podnikatele'} v podmínkách českého trhu s počátečním rozpočtem ${profile.startingBudget || 'standardním'}.`,
    firstAction: `**Validace do 7 dnů bez utrácení peněz:**
1. Vytvoř jednoduchý "one-pager" nebo prodejní PDF dokument (stačí v Canvě nebo Google Docs).
2. Definuj přesnou nabídku pro prvních 3–5 testovacích zákazníků se zvýhodněnou zaváděcí cenou výměnou za detailní videoreferenci.
3. Oslov přímo 20 lidí z cílové skupiny (přes LinkedIn, Instagram nebo osobní síť kontaktů).
4. Cíl: Získat alespoň 2 potvrzené zájemce ještě před nákupem drahého vybavení.`,
    nextSteps: `**Administrativní a technické minimum v ČR:**
- **Živnostenské oprávnění:** Vyřídit volnou živnost (poplatek 1 000 Kč na kterémkoliv živnostenském úřadě nebo online přes Portál živnostenského podnikání).
- **Bankovní účet:** Založit samostatný podnikatelský účet (např. Fio, Air Bank, ČSOB) s nulovými poplatky pro oddělení osobních a firemních financí.
- **Fakturace:** Založit bezplatný účet na Fakturoid.cz nebo iDoklad.cz.
- **Pojištění:** Zvážit základní pojištění odpovědnosti z podnikání (od cca 2 000 Kč/rok).`,
    offer: `**Neodolatelná prodejní propozice (USP):**
- **Hlavní slib:** Garantovaný výsledek, transparentní komunikace a rychlost dodání bez skrytých poplatků.
- **Základní balíček:** Rychlé řešení primárního problému zákazníka.
- **Prémiový balíček (Doporučeno):** Kompletní řešení na klíč včetně podpory a garance spokojenosti.`,
    pricing: `**Doporučená cenotvorba v Kč:**
- **Základní služba / balíček:** 2 900 – 4 900 Kč (marže min. 70 %)
- **Kompletní péče / měsíční paušál:** 8 900 – 18 000 Kč
- **Hodinová sazba pro doplňkové práce:** 650 – 1 200 Kč / hod.
- *Tip: Nikdy neprodávej nejlevněji na trhu. Konkuruj spolehlivostí a kvalitou zážitku.*`,
    costs: `**Struktura nákladů:**
- **Počáteční investice:** 3 000 – 15 000 Kč (základní nástroje, doména, živnost).
- **Měsíční fixní náklady:** Sociální a zdravotní pojištění (v 1. roce OSVČ možnost paušální daně nebo minimálních záloh), software (500–1 500 Kč).
- **Variabilní náklady:** 15–25 % z ceny zakázky (materiál, doprava, spotřeba).`,
    customerAcquisition: `**Jak získat prvních 5 a následně 50 klientů:**
1. **Prvních 5 klientů (Přímý outreach):** Osobní kontakty, přímé zprávy s hodnotou zdarma, lokální komunity.
2. **Dalších 20 klientů (Referenční smyčka):** Každému spokojenému klientovi nabídni 15% slevu na další službu nebo 500 Kč za doporučení známého.
3. **Škálování na 50+ klientů:** Lokální Google Firemní profil s hodnocením 5.0, obsahový marketing a mikro-reklama v okruhu 15 km.`,
    marketing: `**Marketingový mix bez velkého rozpočtu:**
- **Google Firemní profil / Lokální SEO:** Klíčové pro získávání hledajících zákazníků zdarma.
- **Krátká videa (Reels / TikTok / Shorts):** Ukázky před/po, zákulisí práce a řešení problémů zákazníků.
- **LinkedIn / B2B Networking:** Pokud cílíš na firmy, publikuj 2x týdně případové studie ze své praxe.`,
    firstMonthPlan: `**Akční plán Týden po týdnu:**
- **Týden 1 (Příprava & Validace):** Vytvoření nabídky, oslovení prvních 20 kontaktů, získání první zakázky.
- **Týden 2 (Dodávka & Reference):** Odbavení první zakázky s maximální péčí, natočení recenze a fotodokumentace.
- **Týden 3 (Oficiální spuštění):** Založení profilů, spuštění jednoduchého prezentačního webu/profilu, oslovení dalších 30 kontaktů.
- **Týden 4 (První vyhodnocení & optimalizace):** Analýza nákladů a marží, nastavení referenčního programu, plán na další měsíc.`,
    growthStrategy: `**Strategie pro růst a škálování:**
- Přechod z jednorázových zakázek na dlouhodobé měsíční retainer smlouvy / paušály.
- Zvýšení cen o 20–30 % po naplnění prvních 70 % časové kapacity.
- Zavedení šablon a procesních checklistů pro možnost delegování na prvního brigádníka / juniora.`,
    generatedAt: new Date().toISOString()
  };
}

function getFallbackDailyStep(profile: UserProfile, currentProject: string, completedSteps: DailyStep[]): DailyStep {
  const stepCount = completedSteps.length;
  const steps: Array<Omit<DailyStep, 'id' | 'completed'>> = [
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
      title: 'Založ Google Firemní profil nebo profesionální profil na síti',
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

// ==========================================
// PODNIKAI BUSINESS START ADMIN API CLIENT
// ==========================================
// PODNIKAI BUSINESS START ADMIN API SERVICE
// ==========================================

const ADMIN_TOKEN_KEY = 'podnikai_admin_bs_session_token';

export function getAdminSessionToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminSessionToken(token: string): void {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Could not store admin token in storage:', e);
  }
}

export function clearAdminSessionToken(): void {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (e) {
    console.warn('Could not clear admin token from storage:', e);
  }
}

function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function verifyAdminPasscode(passcode: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Neplatný administrátorský kód.' };
    }
    const data = await res.json();
    if (data.authorized && data.token) {
      setAdminSessionToken(data.token);
      return { success: true, token: data.token };
    }
    return { success: false, error: 'Nepodařilo se vystavit administrátorskou relaci.' };
  } catch (err: any) {
    console.warn('Admin verification check failed:', err);
    return { success: false, error: 'Chyba síťového spojení při ověřování.' };
  }
}

export async function fetchBusinessStartClients(): Promise<{ clients: BusinessStartClient[]; stats: BusinessStartStats }> {
  try {
    const res = await fetch('/api/admin/clients', {
      headers: getAdminAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearAdminSessionToken();
      }
      throw new Error(`Nepodařilo se načíst klienty Business Start (status ${res.status})`);
    }
    const data = await res.json();
    // Cache locally for resilient offline/container-restart backup
    if (data.clients && Array.isArray(data.clients)) {
      try {
        localStorage.setItem('podnikai_admin_bs_clients', JSON.stringify(data.clients));
      } catch (e) {
        console.warn('Local cache write failed:', e);
      }
    }
    return data;
  } catch (err) {
    console.warn('Error fetching business start clients, falling back to local storage cache:', err);
    const local = localStorage.getItem('podnikai_admin_bs_clients');
    const clients: BusinessStartClient[] = local ? JSON.parse(local) : [];
    const stats: BusinessStartStats = {
      total: clients.length,
      new: clients.filter(c => c.status === 'new').length,
      analysis: clients.filter(c => c.status === 'analysis').length,
      control: clients.filter(c => c.status === 'control').length,
      done: clients.filter(c => c.status === 'done').length
    };
    return { clients, stats };
  }
}

export async function fetchBusinessStartClient(id: string): Promise<BusinessStartClient | null> {
  try {
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
      headers: getAdminAuthHeaders()
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.client || null;
  } catch (err) {
    console.warn('Error fetching client by id:', err);
    return null;
  }
}

export async function createBusinessStartClient(
  questionnaire: BusinessStartQuestionnaire,
  consultantName?: string,
  adminNotes?: string
): Promise<BusinessStartClient | null> {
  try {
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ questionnaire, consultantName, adminNotes })
    });
    if (!res.ok) throw new Error('Chyba při zakládání klienta na serveru');
    const data = await res.json();
    if (data.client) {
      // Sync local cache
      try {
        const local = localStorage.getItem('podnikai_admin_bs_clients');
        const list: BusinessStartClient[] = local ? JSON.parse(local) : [];
        list.unshift(data.client);
        localStorage.setItem('podnikai_admin_bs_clients', JSON.stringify(list));
      } catch (e) {
        console.warn('Local storage sync failed:', e);
      }
    }
    return data.client || null;
  } catch (err) {
    console.error('Error creating business start client:', err);
    return null;
  }
}

export async function updateBusinessStartClient(
  id: string,
  updates: Partial<BusinessStartClient>
): Promise<BusinessStartClient | null> {
  try {
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Chyba při aktualizaci klienta');
    const data = await res.json();
    if (data.client) {
      // Sync local cache
      try {
        const local = localStorage.getItem('podnikai_admin_bs_clients');
        if (local) {
          const list: BusinessStartClient[] = JSON.parse(local);
          const idx = list.findIndex(c => c.id === id);
          if (idx !== -1) {
            list[idx] = data.client;
            localStorage.setItem('podnikai_admin_bs_clients', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Local storage sync failed:', e);
      }
    }
    return data.client || null;
  } catch (err) {
    console.error('Error updating business start client:', err);
    return null;
  }
}

export async function deleteBusinessStartClient(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders()
    });
    if (res.ok) {
      // Sync local cache
      try {
        const local = localStorage.getItem('podnikai_admin_bs_clients');
        if (local) {
          const list: BusinessStartClient[] = JSON.parse(local);
          const filtered = list.filter(c => c.id !== id);
          localStorage.setItem('podnikai_admin_bs_clients', JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn('Local storage sync failed:', e);
      }
    }
    return res.ok;
  } catch (err) {
    console.error('Error deleting business start client:', err);
    return false;
  }
}

export async function triggerBusinessStartAnalysis(
  id: string
): Promise<{ success: boolean; analysis?: BusinessStartAnalysis; client?: BusinessStartClient; error?: string }> {
  try {
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/analyze`, {
      method: 'POST',
      headers: getAdminAuthHeaders()
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Chyba při analýze klienta' };
    }
    const data = await res.json();
    if (data.client) {
      // Sync local cache
      try {
        const local = localStorage.getItem('podnikai_admin_bs_clients');
        if (local) {
          const list: BusinessStartClient[] = JSON.parse(local);
          const idx = list.findIndex(c => c.id === id);
          if (idx !== -1) {
            list[idx] = data.client;
            localStorage.setItem('podnikai_admin_bs_clients', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Local storage sync failed:', e);
      }
    }
    return { success: true, analysis: data.analysis, client: data.client };
  } catch (err: any) {
    console.error('Error triggering business start analysis:', err);
    return { success: false, error: err.message || 'Nepodařilo se provést analýzu' };
  }
}

// ==========================================
// BUSINESS START PUBLIC AUTOMATED PAID FLOW
// ==========================================

export async function saveBusinessStartDraft(
  questionnaire: BusinessStartQuestionnaire,
  existingOrderId?: string,
  existingOrderToken?: string
): Promise<{
  success: boolean;
  orderId?: string;
  orderToken?: string;
  order?: BusinessStartOrder;
  client?: BusinessStartClient;
  error?: string;
}> {
  try {
    const res = await fetch('/api/business-start/order/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionnaire, existingOrderId, existingOrderToken })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Nepodařilo se uložit objednávku' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při ukládání objednávky' };
  }
}

export async function fetchBusinessStartOrder(
  orderId: string,
  orderToken: string
): Promise<{
  success: boolean;
  order?: BusinessStartOrder;
  isPaid?: boolean;
  questionnaire?: BusinessStartQuestionnaire;
  analysis?: BusinessStartAnalysis | null;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/business-start/order/${encodeURIComponent(orderId)}`, {
      headers: {
        'x-order-token': orderToken
      }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Nepodařilo se načíst objednávku' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při načítání objednávky' };
  }
}

export async function initiateBusinessStartCheckout(
  orderId: string,
  orderToken: string
): Promise<{
  success: boolean;
  mode?: 'stripe_hosted' | 'sandbox';
  checkoutUrl?: string;
  sessionId?: string;
  order?: BusinessStartOrder;
  alreadyPaid?: boolean;
  priceCz?: number;
  currency?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/business-start/order/${encodeURIComponent(orderId)}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-order-token': orderToken
      },
      body: JSON.stringify({ orderToken })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Nepodařilo se inicializovat platbu' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při inicializaci platby' };
  }
}

export async function simulateBusinessStartPayment(
  orderId: string,
  orderToken: string,
  simulateOutcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
): Promise<{
  success: boolean;
  outcome?: string;
  order?: BusinessStartOrder;
  status?: BusinessStartOrderStatus;
  error?: string;
}> {
  try {
    const res = await fetch('/api/business-start/sandbox/simulate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, orderToken, simulateOutcome })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Simulace platby selhala' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při simulaci platby' };
  }
}

export async function retryBusinessStartAnalysis(
  orderId: string,
  orderToken: string
): Promise<{
  success: boolean;
  order?: BusinessStartOrder;
  analysis?: BusinessStartAnalysis;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/business-start/order/${encodeURIComponent(orderId)}/retry-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-order-token': orderToken
      },
      body: JSON.stringify({ orderToken })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Nepodařilo se spustit analýzu' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při opakování analýzy' };
  }
}

export async function markBusinessStartPdfReady(
  orderId: string,
  orderToken: string
): Promise<{
  success: boolean;
  order?: BusinessStartOrder;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/business-start/order/${encodeURIComponent(orderId)}/mark-pdf-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-order-token': orderToken
      },
      body: JSON.stringify({ orderToken })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Nepodařilo se aktualizovat stav PDF' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Chyba sítě při aktualizaci PDF stavu' };
  }
}


