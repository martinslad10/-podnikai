import { BusinessIdea, BusinessPlan, DailyStep, UserProfile } from '../types';

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
): Promise<BusinessIdea[]> {
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
    if (Array.isArray(data.ideas) && data.ideas.length > 0) {
      return data.ideas;
    }
    throw new Error('Empty ideas response');
  } catch (err: any) {
    console.warn('Backend ideas API failed, generating tailored fallback ideas:', err);
    return getFallbackIdeas(userProfile);
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

function getFallbackIdeas(profile: UserProfile): BusinessIdea[] {
  const budget = profile.startingBudget || 'střední';
  const loc = profile.location || 'ČR';
  const skill = profile.skills?.[0] || 'organizace a komunikace';

  return [
    {
      id: 'idea-1',
      title: 'B2B Specializované služby & Konzultace',
      tagline: 'Pomoc malým firmám s optimalizací procesů a získáváním klientů',
      description: `Využití tvých dovedností (${skill}) k řešení konkrétního palčivého problému lokálních firem v lokalitě ${loc}. Firmy mají rozpočty a platí za úsporu času a přímý přínos.`,
      initialCosts: '0 – 2 000 Kč',
      initialCostsLevel: 'low',
      difficulty: 'medium',
      incomePotential: '45 000 – 110 000 Kč / měsíc',
      launchSpeed: '7–14 dní',
      risk: 'low',
      whyItFits: `Využívá tvou dovednost (${skill}), nevyžaduje počáteční kapitál (${budget}) a umožňuje rychlý start bez složitého schvalování.`,
      firstValidationStep: 'Napsat 10 majitelům firem na LinkedInu krátkou zprávu s nabídkou bezplatného 20min auditu.',
      targetAudience: 'Majitelé malých firem (5–25 zaměstnanců) a lokální živnostníci v ČR.'
    },
    {
      id: 'idea-2',
      title: 'Mikro-agentura / Správa obsahu s AI asistencí',
      tagline: 'Tvorba vizuálů, textů a automatizací pro firmy, které na to nemají čas',
      description: 'Firmy zoufale potřebují být vidět na sítích a komunikovat se zákazníky, ale nemají čas. Nabídni jim měsíční paušál za kompletní správu profilu s podporou moderních AI nástrojů.',
      initialCosts: '1 500 – 5 000 Kč',
      initialCostsLevel: 'low',
      difficulty: 'low',
      incomePotential: '35 000 – 90 000 Kč / měsíc',
      launchSpeed: '1–2 týdny',
      risk: 'low',
      whyItFits: 'Perfektní pro online/hybridní model s flexibilní časovou dotací při práci.',
      firstValidationStep: 'Vytvořit 3 ukázkové posty a nabídnout 1 měsíc správy za poloviční cenu prvnímu zájemci.',
      targetAudience: 'E-shopy, lokální kavárny, fitness trenéři a poradci.'
    },
    {
      id: 'idea-3',
      title: 'Prémiová lokální mobilní služba na míru',
      tagline: 'Služba přímo u zákazníka s důrazem na špičkový klientský zážitek',
      description: `Lokální specializovaná služba (např. mobilní detailing, hloubkové čištění, organizace prostor, montáže/servis) v lokalitě ${loc}. Zákazníci milují pohodlí, kdy nemusí nikam jezdit.`,
      initialCosts: '5 000 – 20 000 Kč',
      initialCostsLevel: 'medium',
      difficulty: 'medium',
      incomePotential: '60 000 – 140 000 Kč / měsíc',
      launchSpeed: '2–3 týdny',
      risk: 'medium',
      whyItFits: 'Vysoké marže na zakázku a přímý kontakt se spokojenými zákazníky, kteří dávají doporučení.',
      firstValidationStep: 'Vytvořit jednoduchou jednostránkovou prezentaci na sociálních sítích a poptat poptávku ve svém okolí.',
      targetAudience: 'Vytížení profesionálové a rodiny hledající spolehlivé řemeslníky a služby.'
    }
  ];
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
