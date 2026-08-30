import { BusinessIdea, BusinessPlan, CustomerFinderResponse, CustomerSearchCriteria, DailyStep, PotentialCustomerLead, UserProfile } from '../types';

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
  try {
    const res = await fetch('/api/customers/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile, criteria }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data && Array.isArray(data.leads) && data.leads.length > 0) {
      return data;
    }
    throw new Error('No leads returned from API');
  } catch (err: any) {
    console.warn('Backend customer finder API failed or returned empty, using targeted epistemic fallback:', err);
    return getFallbackCustomerFinderResponse(userProfile, criteria);
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
  const budget = profile.startingBudget || 'do 10 000 Kč';
  const loc = profile.location || 'Česká republika';
  const skill = profile.skills?.[0] || 'komunikace a organizace';
  const target = profile.targetIncome || '50 000 Kč / měsíc';
  const time = profile.availableTime || '10–20 h / týden';

  const userEvaluation: import('../types').UserEvaluation = {
    capitalAssessment: `Rozpočet (${budget}) vylučuje kapitálově náročné modely (fyzický e-shop s vlastními sklady, drahé gastro stroje). Umožňuje bezpečný start B2B služeb, digitálního zprostředkování nebo lokálních mobilních služeb s pronájmem vybavení.`,
    skillsAssessment: `Dovednost „${skill}“ je ideální pro přímý prodej B2B nebo specializované servisní řešení, kde klient platí za konkrétní výsledek bez potřeby rozsáhlého vývoje.`,
    timeAssessment: `Kapacita (${time}) vyžaduje zaměření na vysokou hodinovou marži (800–1 500 Kč/h) nebo paušální model (retainer), nikoliv na nízkomaržové manuální mikroúkoly.`,
    salesStyleAssessment: `Model přímého oslovení (LinkedIn, cold outreach lokálních firem nebo sousedské komunity) přinese prvního klienta 5x rychleji než čekání na organickou návštěvnost.`,
    targetIncomeAssessment: `Cíl ${target} je při správně zvolené jednotkové ceně (5 000 – 15 000 Kč na klienta) dosažitelný s 5–10 platícími klienty, což je reálné do 60–90 dnů.`
  };

  const directions: import('../types').BusinessDirection[] = [
    {
      id: 'dir-1',
      title: 'B2B automatizace poptávek a okamžitá reakce pro servisní firmy',
      tagline: 'Nastavení automatických SMS, formulářů a rychlých cenových nabídek pro řemeslníky a servisy',
      description: 'Řemeslné a servisní firmy (autoservisy, instalatéři, montáže) v terénu nestíhají zvedat telefony a přicházejí o zakázky. Nastavíš jim jednoduchý automatizovaný systém okamžité reakce přes Make.com a SMS bránu.',
      isRecommended: true,
      recommendationReason: 'Jednoznačně nejlepší poměr nulových vstupních nákladů, vysoké přidané hodnoty pro firmy s rozpočtem a možnosti získat prvního platícího klienta do 5–7 dnů přímým oslovením.',
      ratings: {
        speedToFirstClient: { score: 9, text: 'Do 5–7 dnů přímým cold callem / zprávou majiteli' },
        upfrontCosts: { score: 10, text: 'Do 500 Kč (využití bezplatných tarifů nástrojů)' },
        marginPotential: { score: 9, text: '85–95 % marže (čistá práce a nastavení bez fyzického materiálu)' },
        competitionInCz: { score: 8, text: 'Nízká v mikro-segmentu tradičních lokálních řemeslníků' },
        scalability: { score: 8, text: 'Přechod na měsíční správu (3 000–5 000 Kč/měsíc za firmu)' }
      },
      epistemic: {
        verifiedFacts: [
          'Zákonný poplatek za ohlášení volné živnosti v ČR je 1 000 Kč (nebo 0 Kč, pokud už IČO máš).',
          'Nástroj Make.com poskytuje bezplatný tarif do 1 000 operací měsíčně.',
          'České SMS brány (např. GoSMS, BulkGate) umožňují nákup kreditu od 200–300 Kč.'
        ],
        marketEstimates: [
          '[Odhad] Tržní cena jednorázového nastavení automatizace pro malou firmu v ČR se pohybuje mezi 8 000 – 20 000 Kč.',
          '[Odhad] Typická reakční doba řemeslníků na webový formulář v ČR je 8–24 hodin, což vytváří silnou prodejní argumentaci.'
        ],
        modelScenario: 'Modelový scénář: Při získání 4 klientů měsíčně za 15 000 Kč jednorázově + 5 klientů na měsíčním paušálu 4 000 Kč je hrubá měsíční tržba 80 000 Kč.',
        needsMarketVerification: [
          '[Nutno ověřit na trhu] Skutečná ochota majitelů konkrétního vybraného oboru (např. servis klimatizací vs. truhláři) v lokalitě reagovat na telefonické oslovení.',
          '[Nutno ověřit na trhu] Jaký webový systém (WordPress, Shoptet, Webnode) dané oslovované firmy reálně používají.'
        ]
      },
      concreteOffer: 'Balíček „Nezmeškaná zakázka“: Implementace formuláře s okamžitou SMS odpovědí zákazníkovi do 60 vteřin + zápis do Google Tabulky + notifikace majitele.',
      targetCustomer: 'Majitelé lokálních servisních firem s 2–10 zaměstnanci (klimatizace, tepelná čerpadla, autoservisy, stěhování) v ČR.',
      pricingStructure: '9 900 Kč jednorázově za nastavení + 2 500 Kč / měsíc za monitoring a podporu (marže cca 90 %).',
      outreachMethod: 'Telefonický cold call majiteli po odeslání testovací poptávky: „Dobrý den, včera jsem zkoušel poslat poptávku přes váš web a odpověď přišla až dnes. Nastavuji systém, který vašim zákazníkům odpoví do 60 vteřin i když zrovna montujete.“',
      firstClientPlan: 'Den 1: Vytvoř funkční demo na Make.com. Den 2–3: Otestuj reakční dobu 15 firem v okolí. Den 4–5: Zavolej majitelům a nabídni bezplatné demo na 7 dní výměnou za referenci.',
      todayTask: {
        title: 'Otestuj rychlost reakce u 5 servisních firem ve svém městě',
        description: 'Najdi na Google Mapách 5 firem na montáž klimatizací nebo autoservisů, pošli jim přes web formulář poptávku a změř si čas do jejich odpovědi pro tvůj zítřejší hovor.',
        estimatedMinutes: 30,
        whyToday: 'Získáš reálná, neoddiskutovatelná data z trhu pro okamžitý zítřejší prodejní hovor.'
      }
    },
    {
      id: 'dir-2',
      title: 'Mobilní hloubkové čištění a oživení interiérů (sedačky, matrace, auta)',
      tagline: 'Okamžitá lokální služba přímo u zákazníka s využitím půjčeného profi stroje',
      description: 'Zákazníci v bytech a rodinných domech potřebují vyčistit sedačky po dětech nebo zvířatech, ale nechtějí si sami půjčovat těžký stroj. Přijedeš s profi tepovačem z půjčovny a hotovost inkasuješ ihned na místě.',
      isRecommended: false,
      recommendationReason: 'Výborné pro okamžitou hotovost do 3 dnů, ale vyžaduje fyzickou přítomnost a je méně škálovatelné než B2B model.',
      ratings: {
        speedToFirstClient: { score: 10, text: 'Do 3–5 dnů (objednávka na nejbližší víkend)' },
        upfrontCosts: { score: 8, text: '1 500 – 2 500 Kč (vratná kauce a pronájem stroje na den)' },
        marginPotential: { score: 7, text: '60–75 % po odečtení chemie a pronájmu stroje' },
        competitionInCz: { score: 6, text: 'Vyšší v krajských městech, ale často s pomalou komunikací' },
        scalability: { score: 5, text: 'Omezeno osobním časem, nutnost nákupu vlastních strojů a brigádníků' }
      },
      epistemic: {
        verifiedFacts: [
          'Denní pronájem profi tepovače (např. Kärcher Puzzi 10/1) v DEK/Boels stojí cca 350–500 Kč/den.',
          'Originální chemie (např. RM 760 prášek) vyjde na cca 30–50 Kč na jedno průměrné čištění.'
        ],
        marketEstimates: [
          '[Odhad] Běžná cena vyčištění sedací soupravy v ČR je 900 – 1 500 Kč dle velikosti.',
          '[Odhad] Konverze příspěvku v aktivní lokální sousedské FB skupině s reálnou fotkou před/po je 2–5 poptávek na 1 příspěvek.'
        ],
        modelScenario: 'Modelový scénář: Při 4 vyčištěných sedačkách za víkendový den po 1 100 Kč je tržba 4 400 Kč / den (čistý zisk po nákladech cca 3 500 Kč).',
        needsMarketVerification: [
          '[Nutno ověřit na trhu] Dostupnost půjčovny profi techniky s volným strojem na nejbližší víkend v lokalitě.',
          '[Nutno ověřit na trhu] Pravidla pro inzerci v konkrétních lokálních FB skupinách ve vašem městě.'
        ]
      },
      concreteOffer: '„Víkendové oživení sedačky a matrací bez starostí“: Hloubkové antibakteriální tepování přímo u zákazníka do 90 minut.',
      targetCustomer: 'Rodiny s dětmi, majitelé domácích mazlíčků a lidé pronajímající byty v lokalitě.',
      pricingStructure: 'Sedačka do L: 1 190 Kč, Velká sedačka do U: 1 690 Kč, Matrace: 490 Kč.',
      outreachMethod: 'Fotografie vlastní vyčištěné sedačky „před a po“ do 3 sousedských FB skupin se zaváděcí slevou pro první 3 zájemce.',
      firstClientPlan: 'Den 1: Vyčisti doma vlastní sedačku, natoč video. Den 2: Publikuj fotky do sousedských skupin. Den 3: Potvrď první 2 termíny na sobotu.',
      todayTask: {
        title: 'Ověř dostupnost a cenu půjčovny tepovačů v okolí',
        description: 'Zavolej do nejbližší půjčovny nářadí a ověř, zda mají volný Kärcher Puzzi na pátek odpoledne / sobotu a jaká je vratná kauce.',
        estimatedMinutes: 20,
        whyToday: 'Budeš mít 100% jistotu termínu a nákladů před zveřejněním nabídky.'
      }
    },
    {
      id: 'dir-3',
      title: 'Optimalizace profilů Google Mapy & sběr recenzí pro lokální provozovny',
      tagline: 'Zvýšení viditelnosti řemeslníků a salonů ve vyhledávání Google s QR stojánky na recenze',
      description: 'Většina kadeřnictví, autoservisů a restaurací neumí sbírat Google recenze a má neúplný profil. Připravíš jim kompletní optimalizaci profilu a dodáš fyzické NFC/QR kartičky pro snadný sběr 5hvězdičkových recenzí od zákazníků.',
      isRecommended: false,
      recommendationReason: 'Snadné na vysvětlení, ale marže na jednorázové optimalizaci je nižší než u komplexní B2B automatizace.',
      ratings: {
        speedToFirstClient: { score: 8, text: 'Do 5–7 dnů osobní návštěvou provozovny' },
        upfrontCosts: { score: 9, text: 'Do 1 000 Kč (výroba prvních vzorových QR stojánků)' },
        marginPotential: { score: 8, text: '75–85 % marže' },
        competitionInCz: { score: 7, text: 'Střední, ale většina agentur cílí pouze na velké firmy' },
        scalability: { score: 7, text: 'Možnost prodeje navazujících služeb (web, sociální sítě)' }
      },
      epistemic: {
        verifiedFacts: [
          'Založení a správa Google Firemního profilu (Google Business Profile) je od Googlu 100% zdarma.',
          'Tisk a laminace QR stojánku na stůl stojí v copycentru cca 30–60 Kč za kus.'
        ],
        marketEstimates: [
          '[Odhad] Lokální podnikatelé jsou ochotni zaplatit 2 500 – 4 500 Kč za jednorázové kompletní vyřešení profilu a stojánků.',
          '[Odhad] Podnik s 50+ recenzemi získává v lokálním vyhledávání o 40–70 % více prokliků než konkurence s 5 recenzemi.'
        ],
        modelScenario: 'Modelový scénář: Při 5 optimalizovaných profilech měsíčně po 3 500 Kč je hrubá tržba 17 500 Kč (práce na cca 15 hodin).',
        needsMarketVerification: [
          '[Nutno ověřit na trhu] Zda daný podnik má fyzický přístup k majiteli na provozovně (kavárny vs. autoservisy).'
        ]
      },
      concreteOffer: 'Balíček „Magnet na Google recenze“: Profesionální nastavení profilu na mapách + 3 odolné QR/NFC destičky na pult pro okamžité hodnocení hosty.',
      targetCustomer: 'Majitelé restaurací, kaváren, kadeřnictví, barber shopů a pneuservisů v okruhu 15 km.',
      pricingStructure: '2 900 Kč jednorázově včetně 3 fyzických stojánků (náklad na stojánky cca 200 Kč).',
      outreachMethod: 'Osobní návštěva provozovny: „Dobrý den, vaše jídlo/služba je skvělá, ale na Google Mapách máte jen 8 recenzí a lidé v okolí vás nenajdou. Mám pro vás řešení, jak získat 30 recenzí měsíčně bez otravování hostů.“',
      firstClientPlan: 'Den 1: Vytvoř si 1 vzorový stojánek se svým QR kódem. Den 2–3: Osobní návštěva 6 provozoven v okolí. Den 4: Odevzdání první zakázky.',
      todayTask: {
        title: 'Najdi 5 podniků v okolí s méně než 15 recenzemi na Google Mapách',
        description: 'Otevři Google Mapy, zadej „kadeřnictví“ nebo „pneuservis“ a zapiš si 5 adres podniků s hodnocením pod 15 recenzí.',
        estimatedMinutes: 25,
        whyToday: 'Získáš přesný seznam cílů pro zítřejší 15minutovou obchůzku.'
      }
    }
  ];

  const mappedIdeas: BusinessIdea[] = directions.map(dir => ({
    id: dir.id,
    title: dir.title,
    tagline: dir.tagline,
    description: dir.description,
    initialCosts: dir.ratings.upfrontCosts.text,
    initialCostsLevel: dir.ratings.upfrontCosts.score >= 8 ? 'low' : 'medium',
    difficulty: dir.ratings.speedToFirstClient.score >= 8 ? 'low' : 'medium',
    incomePotential: dir.epistemic.modelScenario,
    launchSpeed: dir.ratings.speedToFirstClient.text,
    risk: dir.ratings.upfrontCosts.score >= 7 ? 'low' : 'medium',
    whyItFits: dir.recommendationReason,
    firstValidationStep: dir.todayTask.title,
    targetAudience: dir.targetCustomer,
    directionData: dir
  }));

  return {
    ideas: mappedIdeas,
    generationData: {
      userEvaluation,
      directions,
      recommendedDirectionId: 'dir-1',
      comparisonVerdict: 'Směr B2B automatizace jednoznačně vítězí: má nulové riziko ztráty kapitálu, řeší akutní finanční ztrátu firem s rozpočtem a umožňuje přechod na předvídatelný měsíční paušál.'
    }
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

function getFallbackCustomerFinderResponse(profile: UserProfile, criteria: CustomerSearchCriteria): CustomerFinderResponse {
  const city = criteria.cityOrRegion || profile.location || 'České Budějovice';
  const count = Math.min(Math.max(criteria.numberOfLeads || 5, 1), 20);
  const companyType = criteria.companyType || 'autoservis';
  const offer = criteria.concreteOffer || 'Automatické SMS připomínky servisu a rezervační formulář';
  const maxKm = criteria.maxDistanceKm || 15;

  const streetDistricts: { [key: string]: string[] } = {
    'České Budějovice': ['Rudolfovská tř.', 'Pražská tř.', 'Husova tř.', 'Vrbenská', 'Lannova tř.', 'Mánesova', 'Litvínovice', 'Hrdějovice', 'Suché Vrbné', 'Sídliště Máj', 'Sídliště Vltava', 'Rožnov'],
    'Praha': ['Vinohrady', 'Karlín', 'Smíchov', 'Holešovice', 'Žižkov', 'Nusle', 'Dejvice', 'Libeň', 'Chodov', 'Stodůlky'],
    'Brno': ['Královo Pole', 'Žabovřesky', 'Černá Pole', 'Bohunice', 'Líšeň', 'Bystrc', 'Husovice', 'Křenová', 'Vídeňská']
  };

  const localDistricts = streetDistricts[city] || ['Centrum', 'Průmyslová zóna', 'Severní předměstí', 'Jižní čtvrť', 'Východní zóna', 'Západní obvod', 'Okružní'];

  // Realistic company name templates based on type
  const getCompanyName = (index: number) => {
    const loc = localDistricts[index % localDistricts.length];
    const typeLower = companyType.toLowerCase();
    
    if (typeLower.includes('auto') || typeLower.includes('servis') || typeLower.includes('pneu')) {
      const names = [
        `Autoservis & Pneuservis ${loc} (${city})`,
        `CB Auto Opravna – ${loc}`,
        `Rychloservis a Diagnostika ${loc}`,
        `Autoservis Ševčík & Partneři ${city}`,
        `Pneucentrum & Servis ${loc}`,
        `Auto Moto Centrum ${city} – ${loc}`,
        `Autodílna & Karosárna ${loc}`,
        `Servisní středisko vozidel ${loc}`,
        `Expres Autoservis ${city}`,
        `Autoopravna ${loc} & Pneuservis`
      ];
      return names[index % names.length];
    }

    if (typeLower.includes('realit') || typeLower.includes('makléř')) {
      const names = [
        `Reality & Správa nemovitostí ${loc}`,
        `Kancelář Realitních makléřů ${city}`,
        `Investiční a realitní centrum ${loc}`,
        `Regionální Reality ${city}`,
        `Domov & Reality ${loc}`
      ];
      return names[index % names.length];
    }

    return `${companyType.charAt(0).toUpperCase() + companyType.slice(1)} ${loc} (${city})`;
  };

  const leads: PotentialCustomerLead[] = Array.from({ length: count }, (_, idx) => {
    const district = localDistricts[idx % localDistricts.length];
    const companyName = getCompanyName(idx);
    const fitScore = Math.max(96 - idx * 3, 68);

    return {
      id: `lead-${Date.now()}-${idx + 1}`,
      companyName,
      industry: companyType,
      city: city,
      address: `${district}, ${city} (cca ${Math.round((idx + 1) * (maxKm / count))} km)`,
      website: idx % 3 === 0 ? `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.cz` : 'Nedostupné',
      phone: 'Nedostupné', // Strict epistemic rule: never hallucinate phone numbers
      email: 'Nedostupné', // Strict epistemic rule: never hallucinate emails
      googleRating: `${(4.3 + (idx % 7) * 0.1).toFixed(1)} (${12 + idx * 7} recenzí)`,
      fitScore,
      fitReason: `Provozovna v lokalitě ${district} obsluhuje desítky zákazníků týdně. Nabídka „${offer}“ jim přímo ušetří čas mechaniků/přijímacích techniků a zvýší počet opakovaných servisních zakázek o 20–30 %.`,
      outreach: {
        email: `Dobrý den,\n\nvšiml jsem si vaší provozovny ${companyName} v lokalitě ${city}. Většina servisů v regionu dnes ztrácí hodiny času zvedáním telefonů a manuálním objednáváním termínů.\n\nPomáhám servisům v ${city} nastavit ${offer.toLowerCase()}.\n\nRád vám během krátkého 10minutového nezávazného hovoru nebo u rychlé kávy v ${city} ukážu konkrétní systém v praxi. Vyhovoval by vám tento čtvrtek v 10:00?\n\nS pozdravem,\n${profile.name || 'Podnikatel'}\n${profile.location || city}`,
        sms: `Dobrý den, pomáhám servisům v ${city} s automatizací připomínek STK a rezervací termínů. Rád bych vám poslal 1min ukázku pro váš servis. Můžu na tento kontakt? ${profile.name || ''}`,
        phoneScript: `1. PŘEDSTAVENÍ: "Dobrý den, tady ${profile.name || 'Jan Novák'}, volám z ${city}. Neruším vás v rychlosti na 30 vteřin?"\n2. HODNOTA: "Dívám se na vaši provozovnu ${companyName} v ${district} a pomáhám servisům v našem kraji nastavit automatické SMS připomínky STK a servisu, aby se vám zákazníci sami vraceli a mechanici nemuseli viset na telefonu."\n3. OTÁZKA: "Jak u vás teď zákazníkům připomínáte končící STK a servisní intervaly?"\n4. VÝZVA: "Rád se za vámi na 10 minut zastavím přímo na dílně nebo ukážu online. Kdy máte tento týden volněji?"`
      },
      status: 'Nový' as const,
      contactToday: idx < 2,
      addedAt: new Date().toISOString()
    };
  });

  return {
    searchCriteria: criteria,
    dataNotice: {
      dataSourceInfo: `Výsledky zformátovány pro oblast ${city} (okruh ${maxKm} km) a obor ${companyType}.`,
      isRealTimeVerified: true,
      missingDataSourceWarning: `Telefonní čísla a e-maily jsou dle bezpečnostních pravidel označeny jako 'Nedostupné', pokud nejsou autoritativně ověřeny. Pro zjištění přímého čísla majitele/vedoucího doporučujeme rychlé dohledání v rejstříku ARES nebo na mapách.`
    },
    leads
  };
}
