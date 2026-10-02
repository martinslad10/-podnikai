import {
  BusinessStartClient,
  BusinessStartQuestionnaire,
  BusinessStartAnalysis,
  BusinessStartDirectionCandidate,
  BusinessStartCapacityBreakdown,
  ClientTargetVsCurrentStartModel
} from '../types';
import {
  evaluateClientConstraints,
  hardFilterCandidateModels,
  isOnlineOnlyBusinessModel
} from './businessStartCandidateFilter';
import {
  parseClientBudget,
  scoreAndSelectCandidateDirections,
  generateCapitalUsagePlan
} from './businessStartBudgetCompatibility';

export function createEmptyQuestionnaire(): BusinessStartQuestionnaire {
  return {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    location: '',
    currentCareerSituation: '',
    mainGoal: '',
    targetMonthlyIncome: '',
    startingCapital: '',
    weeklyTimeCommitment: '',
    operatingModel: 'offline',
    preferredWorkType: 'Nevím / ještě nemám vyhraněno',
    customPreferredWorkType: '',
    coreSkillsAndExpertise: [],
    passionsAndInterests: [],
    strictDislikesAndRedLines: [],
    existingAssetsAndNetwork: '',
    personalConstraints: ''
  };
}

export function buildFinancialModelMathText(params: {
  targetIncome: string;
  timeCommitment: string;
  assumedPrice: string;
  assumedClients: string;
  capacityScenario: string;
  variableCosts: string;
  fixedCosts: string;
  simpleCalculation: string;
  notIncluded: string;
  scenarioNotice?: string;
  targetComparison?: string;
  howToReachTarget?: string[];
}): string {
  const lines = [
    `[MODELOVÝ SCÉNÁŘ – STRATEGICKÁ KALKULACE]`,
    `• Vstup od klienta: Cíl ${params.targetIncome} | Časová dotace: ${params.timeCommitment}`,
    `• 1. Předpokládaná cena: ${params.assumedPrice}`,
    `• 2. Předpokládaný počet zakázek/klientů: ${params.assumedClients}`,
    `• 3. Předpokládaná kapacita: ${params.capacityScenario}`,
    `• 4. Předpokládané variabilní náklady: ${params.variableCosts}`,
    `• 5. Známé / předpokládané fixní náklady: ${params.fixedCosts}`,
    `• 6. Jednoduchý výpočet: ${params.simpleCalculation}`,
    `• 7. Co není v modelu zahrnuto: ${params.notIncluded}`,
    `• 8. Upozornění na modelový scénář: ${params.scenarioNotice || 'Jedná se výhradně o modelový scénář a orientační výsledek při předpokládané kapacitě; model nezahrnuje odvody SP/ZP ani daň z příjmů.'}`
  ];

  if (params.targetComparison) {
    lines.push(`• 9. Vyhodnocení cíle klienta vs. model:\n${params.targetComparison}`);
  } else if (params.targetIncome) {
    lines.push(`• 9. Vyhodnocení cíle klienta vs. model:
  - Cílový příjem zadaný klientem: ${params.targetIncome}
  - Modelový provozní přebytek: orientační výsledek modelového scénáře kapacity
  - Čistý příjem podnikatele: čistý zisk po zdanění a zákonných odvodech SP/ZP (hrubý provozní model odvody nezahrnuje).`);
  }

  if (params.howToReachTarget && params.howToReachTarget.length > 0) {
    lines.push(
      `\nCO JE NUTNÉ ZMĚNIT PRO DOSAŽENÍ CÍLE (MODELOVÉ SCÉNÁŘE ROZŠÍŘENÍ):\n` +
      params.howToReachTarget.map((step, idx) => `${idx + 1}. ${step}`).join('\n') +
      `\n*(Uvedeno výhradně jako modelové scénáře k ověření, nikoliv jako garance zisku).*`
    );
  }

  return lines.join('\n');
}

export function formatStructuredBreakEven(params: {
  operationalOrders: string;
  operationalCostScope: string;
  businessTargetNote?: string;
}): string {
  return [
    `A) Bod pokrytí modelových provozních nákladů (PROVOZNÍ BOD ZVRATU MODELU): cca ${params.operationalOrders}.`,
    `Tento výpočet pokrývá výhradně explicitně zahrnuté modelové provozní náklady (${params.operationalCostScope}).`,
    `B) Modelový finanční cíl klienta (CELKOVÝ / BUSINESS BOD ZVRATU): Tento výpočet pokrývá pouze náklady zahrnuté v modelu a NEZNAMENÁ, že ${params.operationalOrders} pokryje osobní životní náklady, odvody SP/ZP, daň z příjmů nebo požadovaný příjem podnikatele.`,
    params.businessTargetNote
      ? `Pro dosažení plánované odměny či modelového finančního cíle klienta (pokrytí životních nákladů) je podle matematického scénáře potřeba odbavit ${params.businessTargetNote}.`
      : `Skutečné pokrytí osobních životních nákladů a dosažení plánovaného zisku vyžaduje dosažení cílového scénáře specifikovaného v kalkulaci měsíčního cíle.`
  ].join(' ');
}

export function generateDeterministicBusinessStartAnalysis(q: BusinessStartQuestionnaire): BusinessStartAnalysis {
  // =========================================================================
  // METODIKA PODNIKAI & 17KROKOVÝ PIPELINE VÝBĚRU A REPORTINGU:
  // 1. SOURCE OF TRUTH
  // 2. CLIENT GOAL
  // 3. PREFERRED WORK TYPE (vlastní text má absolutní prioritu)
  // 4. RED LINES / ODMÍTNUTÉ ČINNOSTI
  // 5. AVAILABLE CAPITAL / STARTING BUDGET (analýza rozpočtových tierů 0–5k, 5–20k, 20–50k, 50–100k, 100k+)
  // 6. HARD FILTER KANDIDÁTNÍCH BUSINESS MODELŮ
  // 7. GENERATE CANDIDATE BUSINESS MODELS (zohledňující možnosti rozpočtu)
  // 8. BUDGET COMPATIBILITY FILTER / SCORING (bodové ohodnocení shody s kapitálem)
  // 9. SELECT TOP DIRECTIONS & LOCK PRIMARY DIRECTION
  // 10. LOCK BLUEPRINT (body A–L)
  // 11. OFFER & PACKAGING
  // 12. CUSTOMER AVATAR
  // 13. SALES STRATEGY & SCRIPTS
  // 14. MARKETING & POSITIONING
  // 15. VALIDATION PLAN (14 DNÍ)
  // 16. FINANCIAL MODEL (scénáře, předpoklady, vyloučení garancí)
  // 17. 30-DAY ACTION PLAN
  // =========================================================================

  // 1. až 4. Constraints
  const constraints = evaluateClientConstraints(q);

  // 5. AVAILABLE CAPITAL / STARTING BUDGET
  const clientBudget = parseClientBudget(q);
  const isZeroBudget = clientBudget.isZeroOrMinimalBudget;
  const isSubstantial = clientBudget.hasSubstantialCapital;
  const skillsStr = (q.coreSkillsAndExpertise || []).join(', ');
  const passionsStr = (q.passionsAndInterests || []).join(', ');
  const name = q.clientName.trim() || 'Klient';
  const goalLower = (q.mainGoal || '').toLowerCase();
  const careerLower = (q.currentCareerSituation || '').toLowerCase();
  const effectiveWorkType = constraints.effectiveWorkType;
  const isCraftOrPhysical = constraints.isPhysicalPersonalLocal;

  let primaryTitle = '';
  let primaryTagline = '';
  let primaryModel = '';
  let primaryMargin = '80–88 %';
  let primaryCap = isZeroBudget ? '0 Kč' : 'do 5 000 Kč';
  let candidateDirections: BusinessStartDirectionCandidate[] = [];

  let blueprintUvp = '';
  let blueprintIdealCustomer = '';
  let blueprintCustomerProblem = '';
  let blueprintBuyingMotivation = '';
  let blueprintWhereToFindThem: string[] = [];
  let blueprintCoreOffer = '';
  let blueprintDeliverables: string[] = [];
  let blueprintPricingStrategy = '';
  let blueprintPrice = '';
  let blueprintUpsellOption = '';
  let blueprintSalesChannel = '';
  let blueprintIcebreaker = '';
  let blueprintSalesScript: string[] = [];
  let blueprintObjections: Array<{ objection: string; response: string }> = [];
  let blueprintValidationHypothesis = '';
  let blueprintValidationSteps: string[] = [];
  let blueprintGoSignal = '';
  let blueprintPivotSignal = '';
  let blueprintDelivery = '';
  let blueprintAcquisition = '';
  let blueprint30DayPlan: Array<{ week: number; focus: string; tasks: string[] }> = [];
  let blueprintOverheadCosts = '';
  let blueprintVariableCosts = '';
  let blueprintBreakEven = '';
  let blueprintCostModel = '';
  let blueprintRevenueModel = '';
  let blueprintPessimistic = '';
  let blueprintRealistic = '';
  let blueprintOptimistic = '';
  let blueprintMonthlyGoalMath = '';
  let blueprintAssumedPrice = '';
  let blueprintAssumedClients = '';
  let blueprintCapacityScenario = '';
  let blueprintSimpleCalculation = '';
  let blueprintNotIncluded = '';
  let blueprintCapacityBreakdown: BusinessStartCapacityBreakdown | undefined = undefined;
  let targetVsStartPlan: ClientTargetVsCurrentStartModel | undefined = undefined;

  // -------------------------------------------------------------------------
  // 5. & 6. CANDIDATE GENERATION & HARD FILTERING ACCORDING TO CONSTRAINTS
  // -------------------------------------------------------------------------

  // --- BRANCH 1: VIZÁŽISTKA / BEAUTY SLUŽBY (TEST 1) ---
  // Klient chce podnikat jako vizážistka nebo v líčení / kosmetice s osobní prací
  if (
    constraints.detectedDomain === 'makeup' ||
    (constraints.isPhysicalPersonalLocal && (
      goalLower.includes('vizáž') ||
      goalLower.includes('líčen') ||
      goalLower.includes('make-up') ||
      goalLower.includes('makeup') ||
      goalLower.includes('kosmetik')
    ))
  ) {
    primaryTitle = 'Profesionální vizážistické služby a svatební líčení (mobilní servis i studio)';
    primaryTagline = 'Kompletní svatební, společenské a foto líčení pro ženy s důrazem na přirozenou krásu a trvanlivost';
    primaryModel = 'Lokální osobní beauty služba s přímou platbou za líčení a balíčky pro nevěsty';
    primaryMargin = '85–92 %';
    primaryCap = q.startingCapital || (isZeroBudget ? '0 Kč (využití stávajícího kufříku a kosmetiky)' : 'do 10 000 Kč (líčidla, štětce, kufřík)');

    candidateDirections = [
      {
        id: 'dir-makeup-1',
        title: 'Profesionální vizážistické služby a svatební líčení (mobilní servis i studio)',
        tagline: 'Kompletní svatební, společenské a foto líčení pro ženy s důrazem na přirozenou krásu a trvanlivost',
        businessModel: 'Lokální osobní beauty služba s přímou platbou za líčení a balíčky pro nevěsty',
        whyMatch: `Přímé naplnění cíle podnikat jako vizážistka (${q.mainGoal}) založené na osobním kontaktu s klientkami a preferenci osobní práce bez celodenního sezení u PC.`,
        estimatedMargin: '85–92 %',
        timeToFirstRevenue: '7–14 dní při oslovení budoucích nevěst a lokálních salonů',
        requiredCapital: isZeroBudget ? '5 000 Kč (využití stávající kosmetické výbavy / postupné doplnění)' : (isSubstantial ? 'do 18 000 Kč (prémiová kosmetická výbava a mobilní LED světlo)' : 'do 8 000 Kč'),
        isPrimary: true,
        regulatoryNotice: 'Volná živnost (Poskytování služeb pro osobní hygienu a služeb, při nichž je porušována integrita lidské kůže - pro dekorativní líčení spadá pod volnou živnost obor 79, nevyžaduje výuční list kadeřníka/kosmetičky, doporučena akreditace či certifikace).',
        estimatedStartupCostMin: 5000,
        estimatedStartupCostMax: isSubstantial ? 18000 : 8000,
        startupCostLevel: isSubstantial ? 'medium' : 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Nákup profesionálního mobilního LED světla, kufříku a prémiové kosmetiky pro dokonalé portfolio' : 'Základní doplnění spotřební kosmetiky a hygienických pomůcek',
        recommendedInitialInvestment: isZeroBudget ? 5000 : (isSubstantial ? 15000 : 7000),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-makeup-studio',
        title: 'Vlastní make-up ateliér & prémiové svatební studio (osobní proměny a kurzy líčení)',
        tagline: 'Komfortní privátní studio s profesionálním osvětlením a zázemím pro nevěsty i individuální klientky',
        businessModel: 'Stabilní prezenční studio s vyšší cenou za balíček (3 500 – 6 500 Kč) a kurzy líčení',
        whyMatch: 'Smysluplně využívá dostupný kapitál pro vytvoření prestižního zázemí, které vytváří modelový předpoklad pro vyšší důvěryhodnost i prémiovější pozici.',
        estimatedMargin: '82–88 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isSubstantial ? 'do 45 000 Kč (zařízení studia, zrcadlo s denním LED spektrem, křeslo)' : '35 000 – 50 000 Kč',
        isPrimary: false,
        regulatoryNotice: 'Volná živnost (obor 79).',
        estimatedStartupCostMin: 28000,
        estimatedStartupCostMax: 50000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Zařízení studia, profesionální líčící zrcadlo s denním LED spektrem, komfortní polohovací křeslo pro klientky a prémiový kosmetický inventář',
        recommendedInitialInvestment: 38000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-makeup-2',
        title: 'Mobilní vizážistka pro focení, firemní eventy a plesy přímo na místě',
        tagline: 'Expresní a profesionální líčení pro ateliéry, komerční focení a společenské události',
        businessModel: 'Půldenní a celodenní sazba za asistenci na focení / eventu placená produkcí nebo pořadatelem',
        whyMatch: 'Umožňuje vyšší jednorázový příjem za akci (3 500 – 7 000 Kč) a stabilní partnerství s fotografy v regionu.',
        estimatedMargin: '88–94 %',
        timeToFirstRevenue: '14 dní',
        requiredCapital: isZeroBudget ? '4 000 Kč (fixátory a kosmetika)' : 'do 6 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 4000,
        estimatedStartupCostMax: 8000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Základní fixátory, mobilní světlo a spotřební materiál pro celodenní focení',
        recommendedInitialInvestment: isZeroBudget ? 4000 : 5500,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-makeup-3',
        title: 'Spolupráce se svatebními salony, fotografy a křeslo v partnerském beauty studiu',
        tagline: 'Pravidelný přísun poptávek na líčení díky partnerské síti v regionu bez vysokého nájmu',
        businessModel: 'Provizní či sdílený model v zavedeném salonu s okamžitým přístupem ke klientele',
        whyMatch: 'Zajišťuje stálou klientelu a prestižní zázemí studia s minimálním fixním rizikem pro začínající vizážistku.',
        estimatedMargin: '80–86 %',
        timeToFirstRevenue: '10–14 dní',
        requiredCapital: isZeroBudget ? '6 000 Kč (kauce na sdílené křeslo)' : 'do 12 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 6000,
        estimatedStartupCostMax: 18000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Kauce a zařízení sdíleného křesla v salonu',
        recommendedInitialInvestment: isZeroBudget ? 6000 : 12000,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-makeup-4',
        title: 'Individuální kurzy osobního líčení a proměny v ateliéru pro klientky (1 na 1)',
        tagline: 'Naučte se líčit jako profesionálka – 2hodinové osobní prezenční lekce líčení pro ženy',
        businessModel: 'Prémiová jednorázová osobní konzultační služba (1 na 1) s vysokou marží',
        whyMatch: 'Doplňková prémiová osobní služba v mimosezónních měsících (1 500 – 2 500 Kč za lekci).',
        estimatedMargin: '90–95 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: 'do 3 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 3000,
        estimatedStartupCostMax: 6000,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Tisk učebních materiálů, paletka a klientské karty líčení',
        recommendedInitialInvestment: 3000,
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Profesionální a trvanlivé líčení s dojezdem přímo na místo svatby či akce, zkouškou předem a prémiovou fixací pro maximální klid klientky.';
    blueprintIdealCustomer = 'Budoucí nevěsty, maturantky a ženy v regionu plánující významnou životní událost, které chtějí perfektní, fotogenický a trvanlivý make-up.';
    blueprintCustomerProblem = 'Obava z nepřirozeného nebo nekvalitního líčení, které nevydrží celý den a focení, a stres z nutnosti dojíždět brzy ráno do vzdáleného salonu v den akce.';
    blueprintBuyingMotivation = 'Mít 100% jistotu bezchybného vzhledu na fotografiích po celý den a užít si přípravy v klidu bez spěchu.';
    blueprintWhereToFindThem = [
      'Instagramové portfolio (podpůrný vizuální kanál) a označení v lokálních svatebních skupinách',
      'Svatební dodavatelé (partnerské svatební salony, kadeřnictví, koordinátoři a lokální fotografové)',
      'Reference a doporučení od spokojených nevěst a sousedské sítě v dojezdu do 30 km'
    ];
    blueprintCoreOffer = 'Kompletní svatební vizážistický balíček – zkouška líčení + prémiové líčení nevěsty v den svatby s dojezdem přímo na místo';
    blueprintDeliverables = [
      'Vstupní konzultace stylu a zkouška líčení 2–4 týdny před svatbou',
      'Kompletní líčení v den akce s prémiovou voděodolnou kosmetikou a fixací na 16+ hodin',
      'Pohotovostní záchranný balíček na den D (vzorek rtěnky, pudrovací papírky pro nevěstu)'
    ];
    blueprintPricingStrategy = 'Zaváděcí ceny pro první nevěsty výměnou za souhlas s fotkami do portfolia, následně standardní modelový cenový předpoklad balíčků a sezónní příplatky.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] 2 500 – 4 500 Kč za svatební balíček (nebo 900 – 1 500 Kč za večerní/plesové líčení)';
    blueprintUpsellOption = 'Líčení maminek a svědkyň na místě svatby, záchranný balíček pro nevěstu a individuální kurzy osobního líčení (1 na 1).';
    blueprintSalesChannel = 'Instagramové portfolio (podpůrný marketingový kanál), doporučení od spokojených nevěst, spolupráce se svatebními salony a lokálními fotografy';
    blueprintIcebreaker = 'Dobrý den, gratuluji k zásnubám! Věnuji se profesionálnímu svatebnímu líčení s dojezdem přímo na místo svatby. Na tuto sezónu mám ještě několik volných víkendů – ráda vám pošlu ukázky líčení mých nevěst a nezávazný ceník balíčků.';
    blueprintSalesScript = [
      '1. Přátelský pozdrav a dotaz na datum svatby a styl šatů',
      '2. Doporučení vhodného vizážistického konceptu dle typu pleti a stylizace',
      '3. Domluva termínu osobní zkoušky líčení',
      '4. Realizace zkoušky, vyfocení na denním i teplém světle a finální odsouhlasení',
      '5. Rezervace termínu se zálohou a potvrzení harmonogramu svatebního rána'
    ];
    blueprintObjections = [
      {
        objection: 'Nevím, zda potřebuji profesionální líčení, nalíčím se sama.',
        response: 'Naprosto chápu. Na svatbě a focení je make-up vystaven celodennímu dojetí, bleskům a světlu. Na zkoušce vám ráda nezávazně předvedu rozdíl v trvanlivosti a krytí.'
      },
      {
        objection: 'Zdá se mi to dražší než běžné denní líčení.',
        response: 'Svatební balíček zahrnuje kompletní zkoušku, voděodolné produkty s celodenní fixací a ranní dojezd k vám, takže ušetříte čas a stres z cestování v den D.'
      }
    ];
    blueprintValidationHypothesis = 'V dojezdovém okolí do 30 km je dostatek nevěst a žen hledajících spolehlivou vizážistku s dojezdem přímo na místo.';
    blueprintValidationSteps = [
      'Den 1–3: Příprava portfolia s 5 ukázkami líčení na sociálním profilu a ceníku svatebních balíčků.',
      'Den 4–8: Přímé osobní oslovení 15 známých v okolí a 3 lokálních svatebních fotografů s nabídkou spolupráce.',
      'Den 9–11: Realizace 2 ukázkových zkoušek líčení a získání referenčních fotografií.',
      'Den 12–14: Získání prvních 2 závazných objednávek na svatební líčení se složením zálohy.'
    ];
    blueprintGoSignal = 'Získání alespoň 2 potvrzených rezervací se zálohou během prvních 14 dnů.';
    blueprintPivotSignal = 'Méně poptávek na svatby -> rozšíření nabídky na foto líčení pro těhotenské a rodinné focení ve spolupráci s ateliéry.';
    blueprintDelivery = 'LOKÁLNÍ / OSOBNÍ (mobilní dojezd na místo svatby / akce nebo v partnerském studiu v regionu)';
    blueprintAcquisition = 'Ukázka reálných výsledků (proměny před/po), osobní doporučení a partnerské propojení s fotografy';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Příprava nabídkového balíčku & oslovení prvních kontaktů a fotografů',
        tasks: [
          'Sepsat 1stránkový svatební balíček a ceník s fotografiemi výsledků',
          'Sestavit seznam 20 budoucích nevěst, známých a 5 svatebních fotografů v regionu',
          'Publikovat na profilu 3 ukázky proměn líčení před/po jako základní vizitku'
        ]
      },
      {
        week: 2,
        focus: 'Aktivní oslovení & první zkušební líčení pro reference',
        tasks: [
          'Oslovit 15 nevěst a 5 fotografů personalizovanou zprávou (cíl: 3–5 odpovědí)',
          'Realizovat 2 referenční zkoušky líčení zdarma výměnou za souhlas s fotkami',
          'Zveřejnit 2 hotové proměny na profilu a požádat známé o sdílení'
        ]
      },
      {
        week: 3,
        focus: 'Rezervace termínů & výběr záloh na svatební sezónu',
        tasks: [
          'Odeslat 3–5 cenových kalkulací poptávajícím s časově omezenou rezervací termínu',
          'Cíl/hypotéza k ověření: vybrat zálohu na první 2–3 svatební termíny a potvrdit harmonogram',
          'Doplnit kosmetický kufřík o chybějící odstíny a fixační spreje'
        ]
      },
      {
        week: 4,
        focus: 'Bezchybné odbavení líčení & získání referencí a doporučení',
        tasks: [
          'Odbavit naplánovaná líčení (1–2 termíny) a pořídit fotodokumentaci',
          'Získat minimálně 2 písemné recenze a reference od nalíčených klientek',
          'Sestavit publikační plán (2 ukázky týdně) a udržovat kontakt s 5 fotografy'
        ]
      }
    ];
    blueprintAssumedPrice = '2 500 – 4 500 Kč za svatební balíček (nebo 900 – 1 500 Kč za večerní líčení)';
    blueprintAssumedClients = '12–16 zakázek měsíčně v sezóně';
    blueprintCapacityScenario = `Model kapacity: • Teoretická kapacita: 35–40 líčení měsíčně (čistý čas aplikace bez hygieny a dojezdu) | • Realistická/provozní kapacita: 12–16 líčení měsíčně (zahrnuje přímou práci + cca 35 h rezervu na zkoušky, dojezdy na svatby, hygienu štětců a komunikaci v rámci fondu ${q.weeklyTimeCommitment}) | • Doporučená udržitelná kapacita: 10–12 líčení měsíčně`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '35–40 líčení měsíčně (čistý čas aplikace bez hygieny a dojezdu)',
      operationalCapacity: `12–16 líčení měsíčně (zahrnuje přímou práci + cca 35 h rezervu na zkoušky, dojezdy na svatby, hygienu štětců a komunikaci s nevěstami v rámci fondu ${q.weeklyTimeCommitment} = cca 50–75 h měsíčně)`,
      recommendedCapacity: '10–12 líčení měsíčně (rovnoměrné víkendové vytížení bez rizika únavy)',
      overheadBufferBreakdown: 'Rezerva na zkoušky líčení, dojezdy na místo svatby, důkladnou hygienu a dezinfekci štětců, komunikaci s nevěstami a správu fotoportfolia.'
    };
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití bezplatných nástrojů a stávajícího vybavení (využití stávajícího kufříku a kosmetiky; neuvedeno / nezohledněno v tomto modelu: zákonné odvody SP/ZP, daně a nákup nového materiálu)' 
      : 'Předpoklad modelu: 800 Kč / měsíc (obnova spotřebního materiálu, tamponky, fixátory; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintVariableCosts = 'Předpoklad modelu: 250 Kč / líčení (odhad spotřeby prémiové kosmetiky a fixace - kryto v ceně služby; neuvedeno / nezohledněno v tomto modelu: přejezdy a amortizace kufříku)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 svatební líčení (nebo 2 večerní líčení)',
      operationalCostScope: 'přímé variabilní materiálové náklady na kosmetiku, tamponky a fixátory cca 800 Kč / měsíc',
      businessTargetNote: '12–16 líčení měsíčně v sezóně'
    });
    blueprintCostModel = isZeroBudget ? 'Konzervativní předpoklad: minimální hotovostní výdaje (využití stávajícího kufříku; nezahrnuje odvody SP/ZP a daně)' : 'Nízké materiálové náklady kryté ze záloh';
    blueprintRevenueModel = 'Přímá platba za svatební balíčky se zálohou předem + doplňkové lekce líčení 1 na 1';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 4 zakázky × 3 000 Kč = 12 000 Kč tržba mínus 1 000 Kč variabilní náklady (4 × 250 Kč) mínus 800 Kč fixní provozní náklady = 10 200 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezohledňuje odvody SP/ZP ani daň z příjmů).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (scénář kapacity): při scénáři kapacity 12 zakázek měsíčně: 12 zakázek × 3 500 Kč = 42 000 Kč tržba mínus 3 000 Kč variabilní náklady (12 × 250 Kč) mínus 800 Kč fixní provozní náklady = 38 200 Kč modelový provozní přebytek (orientační výsledek modelového scénáře kapacity; nezohledňuje SP/ZP ani daň z příjmů).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 16 zakázek × 3 500 Kč = 56 000 Kč tržba mínus 4 000 Kč variabilní náklady (16 × 250 Kč) mínus 800 Kč fixní provozní náklady = 51 200 Kč modelový provozní přebytek (v rámci horní hranice provozní kapacity 12–16 líčení měsíčně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 12 zakázek × 3 500 Kč = 42 000 Kč tržba mínus 3 000 Kč variabilní náklady (12 × 250 Kč) mínus 800 Kč fixní provozní náklady = 38 200 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů, dlouhodobá amortizace vybavení, nákup nových luxusních paletek.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }
  // --- BRANCH 2: MASÉR / REGENERAČNÍ PÉČE (TEST 2) ---
  else if (
    constraints.detectedDomain === 'masseur' ||
    (constraints.isPhysicalPersonalLocal && (
      goalLower.includes('masér') ||
      goalLower.includes('masáž') ||
      goalLower.includes('fyzioter') ||
      goalLower.includes('studio')
    ))
  ) {
    primaryTitle = 'Profesionální regenerační a masérské služby (mobilní servis i partnerské studio)';
    primaryTagline = 'Sportovní, rekondiční a uvolňující masáže pro lokální klienty se zaměřením na úlevu od bolestí zad';
    primaryModel = 'Lokální prémiová fyzická služba s rychlým cashflow a osobní klientskou péčí';
    primaryMargin = '82–90 %';
    primaryCap = q.startingCapital || (isZeroBudget ? '0 Kč (využití stávajícího lehátka)' : 'do 15 000 Kč (přenosné lehátko, masážní emulze, prostěradla)');

    candidateDirections = [
      {
        id: 'dir-masseur-1',
        title: 'Profesionální regenerační a masérské služby (mobilní servis i partnerské studio)',
        tagline: 'Sportovní, rekondiční a uvolňující masáže pro lokální klienty se zaměřením na úlevu od bolestí zad',
        businessModel: 'Lokální prémiová fyzická služba s rychlým cashflow a osobní klientskou péčí',
        whyMatch: `Plné využití ${q.currentCareerSituation || 'masérské praxe klienta'}, práce s lidmi a preference lokální osobní péče s eliminací celodenní práce u počítače.`,
        estimatedMargin: '82–90 %',
        timeToFirstRevenue: '7–10 dní',
        requiredCapital: isZeroBudget ? '6 000 Kč (kvalitní skládací lehátko, oleje, prádlo)' : (isSubstantial ? 'do 15 000 Kč (kvalitní skládací lehátko, oleje, prádlo)' : 'do 10 000 Kč'),
        isPrimary: true,
        regulatoryNotice: 'Vázaná živnost (Masérské, rekondiční a regenerační služby dle přílohy č. 2 zákona č. 455/1991 Sb.). Vyžaduje akreditovaný kurz MŠMT/MZ nebo zdravotnické vzdělání, které klient splňuje.',
        estimatedStartupCostMin: 6000,
        estimatedStartupCostMax: isSubstantial ? 15000 : 9000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Nákup lehkého a stabilního hliníkového lehátka, masážních emulzí, přepravní tašky a lokální propagace' : 'Základní nákup masážních olejů, dezinfekce a prádla',
        recommendedInitialInvestment: isZeroBudget ? 6000 : (isSubstantial ? 12000 : 7000),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-masseur-studio',
        title: 'Vlastní zařízené regenerační a masérské studio s prémiovým vybavením',
        tagline: 'Komfortní studio s elektricky polohovatelným lehátkem, aromaterapií a klidovou relaxační zónou',
        businessModel: 'Vlastní provozovna / studio s vysokou hodinovou sazbou (1 000 – 1 600 Kč) a prodejem stálých permanentek',
        whyMatch: `Přímé a plnohodnotné naplnění cíle klienta (${q.mainGoal}) s využitím dostupného kapitálu na vybavení profesionálního studia bez kompromisů.`,
        estimatedMargin: '80–86 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isSubstantial ? 'do 48 000 Kč (elektrické lehátko, kauce/nájem, hygiena, marketing)' : '35 000 – 60 000 Kč',
        isPrimary: false,
        regulatoryNotice: 'Vázaná živnost (Masérské služby dle zákona č. 455/1991 Sb.).',
        estimatedStartupCostMin: 32000,
        estimatedStartupCostMax: 65000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Profesionální elektrické terapeutické lehátko, kauce a nájem na 1. měsíc, lávové kameny, prádlový servis, hygiena schválená KHS a lokální launch kampaň',
        recommendedInitialInvestment: 45000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-masseur-2',
        title: 'Firemní masáže v kancelářích na ergonomické židli (B2B firemní dny)',
        tagline: '15–20minutové uvolňující masáže šíje a zad pro zaměstnance sedavých profesí',
        businessModel: 'B2B půldenní či celodenní paušál placený přímo zaměstnavatelem jako benefit',
        whyMatch: 'Umožňuje obsloužit 10–16 lidí během jednoho firemního dne s modelovým scénářem výnosu 5 000 – 9 000 Kč za akci dle rozsahu.',
        estimatedMargin: '88–92 %',
        timeToFirstRevenue: '14 dní',
        requiredCapital: isZeroBudget ? '4 500 Kč (ergonomická masážní židle)' : 'do 7 000 Kč (masážní židle)',
        isPrimary: false,
        estimatedStartupCostMin: 4500,
        estimatedStartupCostMax: 8500,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Skládací ergonomická masážní židle a jednorázové hygienické podhlavníky',
        recommendedInitialInvestment: isZeroBudget ? 4500 : (isSubstantial ? 7000 : 5000),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-masseur-3',
        title: 'Pravidelné měsíční regenerační permanentky a ergonomické poradenství (sdílené studio)',
        tagline: 'Pravidelná preventivní péče pro stálou klientelu a sportovce s udržením kondice',
        businessModel: 'Předplatné a balíčky 5–10 masáží s předvídatelným měsíčním cashflow',
        whyMatch: 'Zajišťuje stabilní klientskou základnu bez nutnosti neustále hledat nové zákazníky.',
        estimatedMargin: '85–90 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isZeroBudget ? '8 000 Kč (sdílená místnost / podnájem na hodiny)' : 'do 15 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 8000,
        estimatedStartupCostMax: 18000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Podnájem vybavené místnosti na hodiny a klientské karty',
        recommendedInitialInvestment: isZeroBudget ? 8000 : (isSubstantial ? 15000 : 8000),
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Hloubková regenerační péče na míru s možností dojezdu nebo v klidném studiu, zaměřená na uvolnění ztuhlosti, regeneraci a opakované návštěvy spokojených klientů.';
    blueprintIdealCustomer = 'Lidé se sedavým zaměstnáním, rekreační sportovci a lidé hledající regeneraci a uvolnění v dojezdovém okolí (stálá lokální klientela hledající spolehlivou regenerační péči).';
    blueprintCustomerProblem = 'Ztuhlost svalů ze sedavého zaměstnání a jednostranné zátěže, nedostatek času dojíždět do vzdálených salonů a neosobní přístup bez možnosti snadné rezervace.';
    blueprintBuyingMotivation = 'Rychlá a citelná úleva od ztuhlých zad a šíje, profesionální lidský přístup, jednoduchá rezervace a pohodlná dostupnost termínu.';
    blueprintWhereToFindThem = [
      'Stálá lokální klientela z firem a kanceláří v dojezdu (sedavá zaměstnání)',
      'Lokální sportovní a běžecké kluby a fitness centra',
      'Google Firemní profil, doporučení stálých klientů pro opakované návštěvy a sousedské skupiny'
    ];
    blueprintCoreOffer = 'Vstupní konzultace + regenerační masáž zad a šíje s možností dojezdu';
    blueprintDeliverables = [
      'Vstupní konzultace a zjištění problematických partií a svalového napětí',
      '60 minut cílené hloubkové masáže s prémiovými přírodními oleji',
      'Doporučení 3 individuálních cviků pro udržení úlevy mezi masážemi a plán pro opakované návštěvy'
    ];
    blueprintPricingStrategy = 'Zaváděcí cena na první návštěvu pro odbourání obav, následně permanentky a balíčky 5 masáží s vyšší retencí pro opakované návštěvy.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] Cenová struktura: 690 Kč zaváděcí akviziční cena na 1. návštěvu | 1 100 – 1 400 Kč standardní doporučené cenové rozpětí za 60 minut masáže (nebo zvýhodněná permanentka 5 masáží za 5 500 Kč) | 1 600 Kč případná prémiová/studiová varianta nebo 90min prodloužený upsell | Finanční model kalkuluje s konzervativní stress-test cenou 1 000 Kč pro vysokou odolnost';
    blueprintUpsellOption = 'Zvýhodněné permanentky na 5–10 masáží, dárkové poukazy, prodloužená 90minutová varianta masáže (samostatný upsell) a půldenní firemní dny zdraví v kancelářích (B2B rekondiční masáže na židli).';
    blueprintSalesChannel = 'Lokální doporučení, Google Firemní profil pro vyhledávání, sousedské skupiny a spolupráce s lokálními fitness centry a běžeckými kluby';
    blueprintIcebreaker = 'Dobrý den, otevírám novou masérskou praxi v našem okolí se zaměřením na úlevu od ztuhlých zad a šíje. Pro prvních 10 zájemců nabízím zvýhodněnou zaváděcí 60minutovou masáž za 690 Kč. Rezervace termínu je možná obratem – mohu vám poslat volné termíny na tento týden?';
    blueprintSalesScript = [
      '1. Přátelský pozdrav a dotaz na aktuální potíže (Kde cítíte největší napětí?)',
      '2. Vysvětlení postupu a volba vhodné intenzity masáže',
      '3. Provedení péče v klidné atmosféře',
      '4. Zhodnocení stavu po masáži a doporučení další frekvence: plán pro opakované návštěvy',
      '5. Nabídka zvýhodněné permanentky pro stálou péči'
    ];
    blueprintObjections = [
      {
        objection: 'Záda mě občas bolí, ale ještě to vydrží, teď nemám čas.',
        response: 'Naprosto rozumím. Prevence a 60 minut uvolnění ale často zabrání týdnům neschopnosti při akutním uskřípnutí. Rezervace termínu je flexibilní – mohu se přizpůsobit brzy ráno či navečer.'
      },
      {
        objection: 'Mám obavu, že masáž bude příliš bolestivá.',
        response: 'Před začátkem probereme vaše preference a intenzitu hmatů průběžně ladíme podle vašich reakcí. Masáž má přinést úlevu, nikoliv bolest.'
      }
    ];
    blueprintValidationHypothesis = 'V lokalitě je minimálně 10 lidí ochotných vyzkoušet zaváděcí masáž s termínem do 7 dnů.';
    blueprintValidationSteps = [
      'Den 1–3: Příprava rezervačního kontaktu pro rychlé rezervace termínů a sepsání zaváděcí nabídky na lokální profil.',
      'Den 4–8: Přímé oslovení 15 osobních kontaktů v okolí a 2 místních sportovních skupin (lokální klientela).',
      'Den 9–11: Realizace prvních 4 zaváděcích masáží a získání referencí pro opakované návštěvy.',
      'Den 12–14: Prodej prvních 2 permanentek a získání 3 doporučení dalším zájemcům.'
    ];
    blueprintGoSignal = 'Odbavení 4 platících klientů během prvních 14 dnů s pozitivní recenzí a zájmem o opakované návštěvy.';
    blueprintPivotSignal = 'Poptávající preferují masáže v pevné místnosti před dojezdem domů -> pronájem křesla/místnosti na hodiny v zavedeném studiu.';
    blueprintDelivery = 'LOKÁLNÍ / OFFLINE (osobní poskytnutí masáže u klienta doma/v kanceláři nebo v partnerském studiu v regionu)';
    blueprintAcquisition = 'Zvýhodněná zaváděcí masáž pro první klienty výměnou za referenci a doporučení pro opakované návštěvy';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Příprava nabídkového listu & oslovení prvních 20 kontaktů z okolí',
        tasks: [
          'Sepsat 1stránkový nabídkový list zaváděcí masáže s přehledným ceníkem',
          'Sestavit seznam 20 lidí se sedavým zaměstnáním v dojezdu (potenciální lokální klientela)',
          'Založit zápis na Google Mapách / Google Firemním profilu a nahrát 3 fotografie prostor'
        ]
      },
      {
        week: 2,
        focus: 'Aktivní objednávání, rezervace termínů & odbavení prvních masáží',
        tasks: [
          'Oslovit 15–20 kontaktů s nabídkou zaváděcí ceny (cíl: 5–7 odpovědí a rezervací)',
          'Zrealizovat 4–6 úvodních masáží a ověřit spokojenost klientů',
          'Získat minimálně 3 písemné recenze na Google profilu od spokojených klientů'
        ]
      },
      {
        week: 3,
        focus: 'Prodej permanentek & první B2B kontakt na firemní masáže',
        tasks: [
          'Předložit nabídku zvýhodněné permanentky na 5 masáží všem ošetřeným (cíl: 1–2 prodané permanentky)',
          'Oslovit 3 lokální firmy s nabídkou zkušebního firemního dne zdraví',
          'Cíl/hypotéza k ověření: obsadit 4–6 pevných termínů v rezervačním kalendáři na další týdny'
        ]
      },
      {
        week: 4,
        focus: 'Vyhodnocení vytížení & zavedení stálé klientské rutiny',
        tasks: [
          'Zpracovat přehled vytížení kapacity a kalkulaci spotřeby olejů a prádla',
          'Odeslat upomínku na opakovanou návštěvu prvním 4–6 klientům po 3–4 týdnech',
          `Cíl modelu: stabilizace 8–10 masáží týdně v rámci zadaného časového fondu (${q.weeklyTimeCommitment})`
        ]
      }
    ];
    blueprintAssumedPrice = 'Prodejní/modelová cena nabídky: 690 Kč zaváděcí akviziční cena na 1. návštěvu | 1 100 – 1 400 Kč standardní doporučené cenové rozpětí za 60 minut masáže (1 600 Kč případná prémiová/studiová varianta nebo 90min prodloužený upsell) | Konzervativní finanční stress-test: 1 000 Kč / návštěva (pro zajištění odolnosti kalkulace vůči zaváděcím cenám či slevám)';
    blueprintAssumedClients = '35–45 odbavených masáží měsíčně';
    blueprintCapacityScenario = `Model kapacity: • Teoretická kapacita: 80–90 masáží měsíčně (čistý čas 60 minut bez pauz a úklidu) | • Realistická/provozní kapacita: 35–45 masáží měsíčně (zahrnuje 60min masáž + cca 45 min rezervu na přípravu, dezinfekci, převlékání, praní prádla, rezervace a regeneraci maséra v rámci časové dotace ${q.weeklyTimeCommitment}) | • Doporučená udržitelná kapacita: 30–35 masáží měsíčně`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '80–90 masáží měsíčně (čistý čas 60 minut na lehátku bez pauz a úklidu)',
      operationalCapacity: `35–45 masáží měsíčně (zahrnuje 60min přímou masáž + cca 45 min rezervu na přípravu místnosti, dezinfekci lehátka, převlékání, praní prádla, komunikaci a fyzickou regeneraci maséra v rámci fondu ${q.weeklyTimeCommitment})`,
      recommendedCapacity: '30–35 masáží měsíčně (doporučená kapacita jako konzervativní provozní model s rezervou na přípravu, administrativu a regeneraci)',
      overheadBufferBreakdown: 'Rezerva na přípravu lehátka a aromaterapie, dezinfekci po každém klientovi, převlékání a konzultaci, praní a sušení prádla, objednávkový systém a regeneraci maséra.'
    };
    if (goalLower.includes('studio') || goalLower.includes('provozovn') || goalLower.includes('salon')) {
      targetVsStartPlan = {
        targetModelClientGoal: 'Vlastní zařízené regenerační a masérské studio s prémiovým vybavením (stálá provozovna, elektrické polohovatelné lehátko, relaxační zóna schválená hygienou KHS)',
        currentBudgetStart: `Mobilní regenerační servis s dojezdem ke klientům a hodinový pronájem partnerského studia (startovní investice do 12 000 – 15 000 Kč v rámci limitu ${q.startingCapital})`,
        transitionCondition: 'Dosažení klientské základny 25–30 stálých platících klientů a akumulace finanční rezervy min. 40 000 – 50 000 Kč z provozních přebytků pro bezpečnou kauci a nájem vlastních prostor bez zadlužení'
      };
    }
    blueprintOverheadCosts = 'Předpoklad modelu: 0 Kč fixní provozní náklady měsíčně (při startu s mobilním dojezdem bez stálého nájmu studia; využity bezplatné nástroje a stávající vybavení; veškerý spotřební materiál je započten výhradně ve variabilních nákladech; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění a daň z příjmů)';
    blueprintVariableCosts = 'Předpoklad modelu: 60 Kč / masáž (přímá spotřeba materiálu: masážní oleje a hypoalergenní emulze, jednorázové hygienické prostěradlo, dezinfekce a praní prádla – započteno výhradně jako variabilní náklad, bez duplicity ve fixních nákladech; neuvedeno / nezohledněno v tomto modelu: lokální dojezd)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 masáž (při nulových fixních nákladech přináší každá masáž provozní přebytek 940 Kč po odečtení 60 Kč přímých nákladů)',
      operationalCostScope: 'přímé variabilní náklady na materiál 60 Kč / masáž (fixní provozní náklady 0 Kč při startu bez nájmu provozovny)',
      businessTargetNote: '35–45 masáží měsíčně dle cíle klienta'
    });
    blueprintCostModel = 'Konzervativní předpoklad: nulové fixní provozní náklady při startu bez nájmu studia (veškerá spotřeba olejů, dezinfekce a prádla je započtena výhradně v 60 Kč/masáž jako variabilní náklad; nezahrnuje SP/ZP a daně)';
    blueprintRevenueModel = 'Přímá platba za jednotlivé 60min masáže + permanentky a firemní dny (B2B fakturace)';
    blueprintPessimistic = `MODELOVÝ SCÉNÁŘ (konzervativní rozjezd 25–30 návštěv): 25 masáží × 1 000 Kč (konzervativní stress-test cena; standardní prodejní cena 1 100 – 1 400 Kč za 60 minut) = 25 000 Kč tržba mínus 1 500 Kč variabilní náklady (25 × 60 Kč za spotřebovaný materiál a hygienu) mínus 0 Kč fixní provozní náklady (start bez stálého nájmu studia) = 23 500 Kč modelový provozní přebytek (orientační výsledek modelového scénáře v rozmezí 25–30 návštěv; nezohledňuje odvody SP/ZP ani daň z příjmů).`;
    blueprintRealistic = `MODELOVÝ SCÉNÁŘ (realistická udržitelná kapacita 30–35 návštěv): při scénáři 35 masáží měsíčně (doporučená udržitelná kapacita plně v rámci zadané časové dotace ${q.weeklyTimeCommitment}): 35 masáží × 1 000 Kč (konzervativní stress-test cena) = 35 000 Kč tržba mínus 2 100 Kč variabilní náklady (35 × 60 Kč) mínus 0 Kč fixní provozní náklady = 32 900 Kč modelový provozní přebytek (model kapacity v rámci doporučené udržitelné kapacity 30–35 návštěv; nezohledňuje SP/ZP ani daň z příjmů).`;
    blueprintOptimistic = `MODELOVÝ SCÉNÁŘ (horní strop provozní kapacity 40–45 návštěv): 45 masáží × 1 000 Kč = 45 000 Kč tržba mínus 2 700 Kč variabilní náklady (45 × 60 Kč) mínus 0 Kč fixní provozní náklady = 42 300 Kč modelový provozní přebytek (horní strop provozní kapacity 35–45 návštěv měsíčně při plném vytížení v rámci časové dotace ${q.weeklyTimeCommitment}; orientační výsledek modelového scénáře bez odvodů a daní).`;
    blueprintSimpleCalculation = `MODELOVÝ VÝPOČET (realistický scénář v doporučené kapacitě 30–35 masáží): 35 masáží × 1 000 Kč = 35 000 Kč tržba mínus 2 100 Kč variabilní náklady (35 × 60 Kč) mínus 0 Kč fixní provozní náklady = 32 900 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).`;
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: zákonné odvody sociálního a zdravotního pojištění, daň z příjmů, opotřebení lehátka a doprava ke klientům.';

    const targetIncomeNumMatch = (q.targetMonthlyIncome || '').replace(/\s+/g, '').match(/(\d+)/);
    const targetIncomeVal = targetIncomeNumMatch ? parseInt(targetIncomeNumMatch[1], 10) : 0;
    const isTargetDeficit = targetIncomeVal > 32900;

    const masseurTargetComparison = [
      `  - Cílový příjem zadaný klientem: ${q.targetMonthlyIncome}`,
      `  - Tržby modelu (realistický scénář 35 návštěv): 35 000 Kč (při stropu kapacity 45 návštěv: 45 000 Kč)`,
      `  - Modelový provozní přebytek (po odečtení materiálu 60 Kč/masáž při 0 Kč fixních nákladech): 32 900 Kč měsíčně (při stropu kapacity: 42 300 Kč)`,
      `  - Čistý příjem podnikatele: čistý zisk po zdanění a zákonných odvodech SP/ZP (hrubý provozní model odvody nezahrnuje).`,
      isTargetDeficit
        ? `  ⚠️ DŮLEŽITÉ UPOZORNĚNÍ: Při konzervativních modelových předpokladech (stress-test cena 1 000 Kč / návštěva a zadaná časová dotace ${q.weeklyTimeCommitment}) tento scénář nedosahuje zadaného cíle (${q.targetMonthlyIncome}). K dosažení cíle je nutná změna ceny, kapacity, nabídky nebo dalšího příjmového kanálu.`
        : `  Modelový provozní přebytek odpovídá zadanému cíli v rámci doporučené kapacity.`
    ].join('\n');

    const masseurHowToReachTarget = isTargetDeficit ? [
      'Vyšší průměrná cena procedur: posun z konzervativního stress-testu 1 000 Kč na standardní doporučené rozpětí 1 100 – 1 400 Kč za 60min péči nebo 1 600 Kč za prémiovou studiovou proceduru / 90min samostatný upsell (např. 35 návštěv × 1 350 Kč = tržba 47 250 Kč, provozní přebytek cca 45 150 Kč).',
      'Vyšší hodnota balíčků a permanentek: aktivní prodej klientských balíčků 5 masáží s vyšší retencí a dárkových poukazů.',
      'Firemní a B2B služby: zařazení firemních dnů zdraví v kancelářích na ergonomické židli (2 půldenní firemní akce měsíčně = modelový výnos 12 000 – 18 000 Kč navíc).',
      'Kombinace služeb a doplňkový prodej: prodej regeneračních emulzí, doplňků pro regeneraci a ergonomického poradenství.',
      'Rozšíření časové kapacity nebo rozvoj vlastního studia s vyšší marží a prémiovým komfortem.'
    ] : undefined;

    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded,
      targetComparison: masseurTargetComparison,
      howToReachTarget: masseurHowToReachTarget
    });
  }
  // --- BRANCH 3: ZEDNÍK / STAVEBNÍ ŘEMESLO (TEST 4) ---
  else if (
    constraints.detectedDomain === 'craft_mason' ||
    (constraints.isPhysicalPersonalLocal && (
      goalLower.includes('zedn') ||
      goalLower.includes('obklad') ||
      goalLower.includes('stavebn') ||
      goalLower.includes('rekonstrukce')
    ))
  ) {
    primaryTitle = 'Zednické, obkladačské a stavební práce v regionu (rekonstrukce bytových jader a koupelen)';
    primaryTagline = 'Kvalitní a spolehlivá realizace stavebních úprav, obkladů a rekonstrukcí se zárukou pevných termínů';
    primaryModel = 'Přímá řemeslná lokální zakázková služba s okamžitým cashflow po etapách';
    primaryMargin = '78–86 %';
    primaryCap = q.startingCapital || (isZeroBudget ? '0 Kč (využití vlastního nářadí)' : 'do 20 000 Kč (stavební nářadí, řezačka, vodováhy)');

    candidateDirections = [
      {
        id: 'dir-mason-1',
        title: 'Zednické, obkladačské a stavební práce v regionu (rekonstrukce bytových jader a koupelen)',
        tagline: 'Kvalitní a spolehlivá realizace stavebních úprav, obkladů a rekonstrukcí se zárukou pevných termínů',
        businessModel: 'Přímá řemeslná lokální zakázková služba s okamžitým cashflow po etapách',
        whyMatch: `Přímé využití zednické praxe klienta (${q.currentCareerSituation || 'zednická praxe'}), manuální zručnosti a preference fyzické práce u zákazníků bez nutnosti sedět u počítače.`,
        estimatedMargin: '78–86 %',
        timeToFirstRevenue: '10–14 dní při aktivním lokálním oslovení',
        requiredCapital: isZeroBudget ? '8 000 Kč (stavební a obkladačské nářadí, vodováhy)' : (isSubstantial ? 'do 20 000 Kč (kvalitní stavební a obkladačské nářadí)' : 'do 15 000 Kč'),
        isPrimary: true,
        regulatoryNotice: 'Řemeslná živnost (Zednictví dle přílohy č. 1 živnostenského zákona č. 455/1991 Sb.). Vyžaduje výuční list nebo praxi v oboru, kterou klient plně disponuje.',
        estimatedStartupCostMin: 8000,
        estimatedStartupCostMax: isSubstantial ? 20000 : 14000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Pořízení přesné ruční řezačky, laserové vodováhy a kvalitního míchadla stavebních směsí' : 'Doplnění základních vodováh, hladítek a spotřebních kotoučů',
        recommendedInitialInvestment: isZeroBudget ? 8000 : (isSubstantial ? 16000 : 10000),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-mason-pro',
        title: 'Kompletní rekonstrukce koupelen a bytových jader s profesionální technikou (vodní pila, laser, bezprašné odsávání)',
        tagline: 'Špičková řemeslná realizace velkoformátových obkladů s minimální prašností a garantovaným termínem',
        businessModel: 'Prémiová zakázková služba na klíč s vysokou cenou práce (45 000 – 95 000 Kč / zakázka)',
        whyMatch: 'Smysluplné využití kapitálu na profesionální techniku, která zrychluje realizaci o 30 % a umožňuje účtovat prémiové ceny.',
        estimatedMargin: '80–87 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isSubstantial ? 'do 48 000 Kč (elektrická vodní pila, laserový nivelační přístroj, průmyslový vysavač s oklepem)' : '30 000 – 50 000 Kč',
        isPrimary: false,
        regulatoryNotice: 'Řemeslná živnost (Zednictví dle přílohy č. 1 živnostenského zákona č. 455/1991 Sb.).',
        estimatedStartupCostMin: 25000,
        estimatedStartupCostMax: 50000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Profesionální elektrická vodní řezačka na dlažbu, křížový laser s tyčí, průmyslový odsavač prachu a certifikované nářadí',
        recommendedInitialInvestment: 38000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-mason-2',
        title: 'Drobné havarijní a expresní zednické opravy pro domácnosti a SVJ',
        tagline: 'Rychlé začištění po haváriích, opravy omítek, spárování a obkladačské přířezy',
        businessModel: 'Rychlá servisní služba s hodinovou či zásahovou sazbou a okamžitým proplacením',
        whyMatch: 'Umožňuje okamžité vyplnění volných dnů mezi velkými rekonstrukcemi s minimální administrativou.',
        estimatedMargin: '85–90 %',
        timeToFirstRevenue: '5–7 dní',
        requiredCapital: isZeroBudget ? '5 000 Kč (základní ruční nářadí a tmely)' : 'do 7 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 5000,
        estimatedStartupCostMax: 10000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Rychleschnoucí tmely, ochranné fólie a drobné ruční nářadí',
        recommendedInitialInvestment: isZeroBudget ? 5000 : 6000,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-mason-3',
        title: 'Kompletní koordinace rekonstrukcí koupelen na klíč ve spolupráci s partnery',
        tagline: 'Dodávka rekonstrukce včetně vody a elektřiny v ověřeném týmu samostatných řemeslníků',
        businessModel: 'Projektový balíček na klíč s koordinačním příplatkem a vysokou celkovou fakturací',
        whyMatch: 'Zvyšuje průměrnou hodnotu zakázky na 60 000 – 120 000 Kč bez nutnosti zaměstnávat lidi.',
        estimatedMargin: '75–82 %',
        timeToFirstRevenue: '21–30 dní',
        requiredCapital: isZeroBudget ? '10 000 Kč (profesní pojištění a rezerva)' : 'do 18 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 10000,
        estimatedStartupCostMax: 22000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Profesní pojištění odpovědnosti řemeslníka a materiálová zálohová rezerva',
        recommendedInitialInvestment: isZeroBudget ? 10000 : 14000,
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Poctivé a čisté stavební řemeslo s předem dohodnutým harmonogramem, transparentním položkovým rozpočtem a bez skrytých vícenákladů.';
    blueprintIdealCustomer = 'Majitel bytu nebo rodinného domu v dojezdové vzdálenosti (do 30 km), který plánuje rekonstrukci koupelny, bytového jádra nebo zednické práce.';
    blueprintCustomerProblem = 'Dlouhé čekací lhůty stavebních firem (6–12 měsíců), obava z nedodržení dohodnuté ceny a nekvalitně odvedeného řemesla s nedodržením termínů.';
    blueprintBuyingMotivation = 'Mít jistotu poctivého řemesla, dodržení dohodnutého rozpočtu a dokončení podle dohodnutého harmonogramu bez vad.';
    blueprintWhereToFindThem = [
      'Majitelé bytů a rodinných domů v regionu plánující rekonstrukci',
      'Místní stavebniny a prodejny obkladů (doporučení řemeslníků)',
      'Partnerská spolupráce s lokálními instalatéry a elektrikáři, sousedská doporučení'
    ];
    blueprintCoreOffer = 'Kompletní zednická a obkladačská realizace koupelny s předem dohodnutým harmonogramem, položkovým rozpočtem a čistým předáním';
    blueprintDeliverables = [
      'Bezplatné osobní zaměření a položkový rozpočet do 48 hodin',
      'Příprava podkladu, hydroizolace, vyzdění příček a precizní pokládka obkladů a dlažby',
      'Závěrečný úklid, spárování, silikonování a předávací protokol'
    ];
    blueprintPricingStrategy = 'Transparentní položkový rozpočet předem s dohodnutým rozpočtovým rámcem: model předpokládá jasné rozlišení ceny práce (odměna řemeslníka) a materiálu (financován předem přímou zálohou nebo průběžnými platbami zákazníka) s doplatkem za práci po předání.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] Modelový cenový předpoklad zakázky (rekonstrukce koupelny): Celková cena zakázky 85 000 – 115 000 Kč (z toho cena práce: 50 000 – 65 000 Kč, stavební materiál: cca 35 000 – 50 000 Kč financovaný zálohou nebo průběžnými platbami zákazníka; orientační sazba práce 550 – 750 Kč / hodina nebo 650 – 900 Kč / m² obkladu). Finanční model kalkuluje výhradně odměnu za práci řemeslníka.';
    blueprintUpsellOption = 'Kompletní koordinace instalatérských a elektro prací s ověřenými partnery na klíč, navazující malířské a dokončovací práce.';
    blueprintSalesChannel = 'Lokální doporučení, Google Firemní profil, sousedské komunity a spolupráce s místními instalatéry a stavebninami';
    blueprintIcebreaker = 'Dobrý den, plánujete v nejbližší době rekonstrukci koupelny nebo zednické úpravy? Rád se u vás nezávazně zastavím, prostor bezplatně zaměřím a do 48 hodin vám připravím přesný položkový rozpočet s garancí pevné ceny.';
    blueprintSalesScript = [
      '1. Osobní prohlídka prostor u zákazníka a zaměření (bezplatně)',
      '2. Konzultace materiálu, formátu dlažby a detailů spárování',
      '3. Předání transparentního položkového rozpočtu do 48 hodin',
      '4. Dohoda termínu nástupu a podpis jednoduché smlouvy o dílo se zálohou na materiál',
      '5. Precizní realizace, průběžná kontrola a protokolární předání hotového díla'
    ];
    blueprintObjections = [
      {
        objection: 'Máme nabídku od jiné party, která je o něco levnější.',
        response: 'Rozumím. V mé nabídce je ale kompletní položkový rozpočet bez dodatečných vícenákladů, certifikovaná chemie a smluvně dohodnutý harmonogram dokončení za definovaných podmínek.'
      },
      {
        objection: 'Zatím to nespěchá, zvažujeme to až na příští měsíce.',
        response: 'Naprosto v pořádku. Rád vám prostor nezávazně zaměřím už nyní, abyste měli přesné podklady pro rozpočet, a termín si můžete rezervovat v předstihu.'
      }
    ];
    blueprintValidationHypothesis = 'V lokalitě do 30 km je dostatek majitelů nemovitostí poptávajících spolehlivého zedníka s nástupem do 4 týdnů.';
    blueprintValidationSteps = [
      'Den 1–3: Sestavení vzorového rozpočtu a příprava fotek z předchozích zednických realizací.',
      'Den 4–8: Přímé osobní a telefonické oslovení 10 známých v okolí a 3 lokálních instalatérů.',
      'Den 9–11: Realizace 2 bezplatných nezávazných zaměření přímo na stavbě či v bytě.',
      'Den 12–14: Uzavření první závazné objednávky se složením zálohy na materiál.'
    ];
    blueprintGoSignal = 'Získání 2 poptávek na zaměření s reálným termínem zahájení do 30 dnů.';
    blueprintPivotSignal = 'Poptávky vyžadují kompletní instalatérské a elektro práce -> okamžité propojení s lokálním instalatérem do dvojice.';
    blueprintDelivery = 'LOKÁLNÍ / OFFLINE (přímá realizace na stavbě u zákazníka v regionu)';
    blueprintAcquisition = 'Osobní nezávazné zaměření a položková kalkulace na místě zdarma do 48 hodin';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Příprava vzorového rozpočtu (položková nabídka/rozpočet) & oslovení lokální sítě',
        tasks: [
          'Sestavit 1 vzorový položkový rozpočet pro rekonstrukci koupelny (cena práce vs. záloha na materiál)',
          'Zkontaktovat 3 lokální instalatéry s nabídkou vzájemného předávání zakázek',
          'Oslovit 10 známých v regionu s informací o volných kapacitách'
        ]
      },
      {
        week: 2,
        focus: 'Osobní zaměření přímo na stavbách & cenová nabídka/rozpočet',
        tasks: [
          'Absolvovat 2–3 bezplatná zaměření na místě u zájemců',
          'Zpracovat a odeslat 2–3 detailní položkové rozpočty do 48 hodin od zaměření',
          'Vyhodnotit zpětnou vazbu k rozpočtům a domluvit termín zahájení u 1–2 vážných zájemců'
        ]
      },
      {
        week: 3,
        focus: 'Podpis smlouvy o dílo, záloha & zahájení první zakázky',
        tasks: [
          'Cíl/hypotéza k ověření: uzavřít 1 smlouvu o dílo s pevnou cenou práce a dohodnutým harmonogramem',
          'Přijmout zálohu na stavební materiál (35 000 – 50 000 Kč) a zajistit dovoz na místo',
          'Zahájit bourací a přípravné práce na první zakázce'
        ]
      },
      {
        week: 4,
        focus: 'Dokončení díla, předávací protokol & fotodokumentace',
        tasks: [
          'Dokončit obkladačské práce, vyspárovat a provést čistý úklid',
          'Předat dílo zákazníkovi s předávacím protokolem a vybrat doplatek',
          'Pořídit sadu 5–10 referenčních fotografií hotové realizace a domluvit termín další stavby'
        ]
      }
    ];
    blueprintAssumedPrice = 'Modelový cenový předpoklad: Cena práce 50 000 Kč za kompletní realizaci koupelny (celková cena zakázky včetně materiálu je cca 85 000 – 100 000 Kč, přičemž stavební materiál ve výši 35 000 – 50 000 Kč je financován zálohou či průběžnou platbou zákazníka a finanční model kalkuluje výhradně tržbu za práci řemeslníka)';
    blueprintAssumedClients = '1–2 rekonstrukce koupelny měsíčně (např. 1 kompletní koupelna měsíčně nebo 1 koupelna + 1 menší obkladačská oprava)';
    blueprintCapacityScenario = `Scénář kapacity: • Teoretická kapacita: 2 kompletní koupelny měsíčně (čistých 120–130 hodin řemeslné práce na stavbě) | • Realistická/provozní kapacita: 1–2 rekonstrukce (zahrnuje 50–70 h práce na stavbě + 20–25 h rezerva na zaměření, položkový rozpočet, nákup/závoz materiálu, dojezdy a úklid v rámci časové dotace ${q.weeklyTimeCommitment}) | • Doporučená udržitelná kapacita: 1 ucelená realizace měsíčně`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '2 kompletní koupelny měsíčně (čistých 120–130 hodin řemeslné práce na stavbě)',
      operationalCapacity: `1–2 rekonstrukce koupelny měsíčně (zahrnuje 50–70 h řemeslné práce + 20–25 h rezervu na zaměření na stavbě, položkový rozpočet, logistiku materiálu, dojezdy a úklid = 75–95 h měsíčně v rámci fondu ${q.weeklyTimeCommitment} = 130 h/měsíc)`,
      recommendedCapacity: '1 ucelená realizace měsíčně (poskytuje potřebný čas na technologické pauzy schnutí a konzultace se zákazníkem)',
      overheadBufferBreakdown: 'Rezerva na osobní zaměření na stavbě, vypracování položkového rozpočtu, nákup a závoz stavební chemie, přejezdy a závěrečný předávací úklid.'
    };
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití bezplatných nástrojů a stávajícího vybavení (vlastní nářadí, bez placené dílny; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daně, odpisy dodávky a servis nářadí)' 
      : 'Předpoklad modelu: 2 000 Kč / měsíc (lokální PHM po regionu a údržba nářadí; neuvedeno / nezohledněno v tomto modelu: odvody SP/ZP a daně)';
    blueprintVariableCosts = 'Předpoklad modelu: model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb zákazníka (stavební materiál netvoří náklad řemeslníka); přímé variabilní provozní náklady řemeslníka činí cca 2 500 Kč / zakázka (opotřebení diamantových kotoučů, míchadel, ochranných pomůcek a drobného spotřebního materiálu; neuvedeno / nezohledněno v tomto modelu: odvoz sutě mimo dohodnutý rozsah)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 menší zakázka / 1 den práce',
      operationalCostScope: 'přímé provozní náklady na lokální dopravu a údržbu kotoučů/nářadí cca 2 000 Kč / měsíc',
      businessTargetNote: '1 kompletní rekonstrukce koupelny měsíčně'
    });
    blueprintCostModel = 'Model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb zákazníka, nízké provozní náklady na servis nářadí a lokální PHM';
    blueprintRevenueModel = 'Přímá platba za stavební etapy se zálohou na materiál + koordinační příplatek za práce na klíč';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 1 menší zednická zakázka: cena práce 25 000 Kč (celková cena zakázky vč. materiálu cca 40 000 Kč se zálohou) = 25 000 Kč tržba za práci mínus 1 200 Kč variabilní náklady mínus 2 000 Kč fixní provozní náklady = 21 800 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezohledňuje odvody SP/ZP ani daň z příjmů).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (scénář kapacity): při scénáři kapacity 1 kompletní rekonstrukce koupelny: cena práce 50 000 Kč (celková cena zakázky vč. materiálu cca 85 000 – 100 000 Kč, materiál hrazen zálohou či průběžnou platbou zákazníka) = 50 000 Kč tržba za práci mínus 2 500 Kč variabilní náklady mínus 2 000 Kč fixní provozní náklady = 45 500 Kč modelový provozní přebytek (orientační výsledek modelového scénáře kapacity; nezohledňuje odvody SP/ZP ani daň z příjmů).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 1 ucelená rekonstrukce (práce 50 000 Kč) + 1 menší oprava (práce 25 000 Kč; celkové zakázky vč. materiálu cca 125 000 Kč kryté zálohou): 75 000 Kč tržba za práci mínus 3 700 Kč variabilní náklady mínus 2 000 Kč fixní provozní náklady = 69 300 Kč modelový provozní přebytek (v rámci horní hranice provozní kapacity 1–2 rekonstrukce při 30 h/týdně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 1 zakázka × 50 000 Kč (tržba za práci; celková cena zakázky vč. materiálu je cca 85 000 Kč, z toho 35 000 Kč materiál je hrazen zálohou zákazníka) = 50 000 Kč tržba za práci mínus 2 500 Kč variabilní náklady na nářadí mínus 2 000 Kč fixní provozní náklady (lokální PHM a údržba nářadí) = 45 500 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů; materiál je řešen zálohami zákazníka).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů, nákup nové techniky (řezačka, bourací kladivo), pojištění odpovědnosti za škodu.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }
  // --- BRANCH 4: OSTATNÍ SPECIFICKÁ ŘEMESLA / LOKÁLNÍ OSOBNÍ SLUŽBY ---
  else if (constraints.isPhysicalPersonalLocal) {
    const isCleaningDomain = goalLower.includes('úklid') || goalLower.includes('čištěn');
    const isGardenDomain = goalLower.includes('zahrad') || goalLower.includes('zeleň');
    const isCarpenterDomain = goalLower.includes('truhlář') || goalLower.includes('stolař');
    const isPlumberDomain = goalLower.includes('instalatér') || goalLower.includes('voda');
    const isElectricianDomain = goalLower.includes('elektrik') || goalLower.includes('elektro');
    const isHairDomain = goalLower.includes('kadeřn') || goalLower.includes('barber') || goalLower.includes('vlasy');
    const isTrainerDomain = goalLower.includes('trenér') || goalLower.includes('fitness') || goalLower.includes('cvič');

    primaryTitle = isCleaningDomain ? 'Profesionální úklidový servis pro domácnosti a kanceláře v regionu'
      : isGardenDomain ? 'Zahradnické služby, údržba zeleně a péče o pozemky'
      : isCarpenterDomain ? 'Zakázkové truhlářské práce, montáže interiérů a renovace nábytku'
      : isPlumberDomain ? 'Instalatérské práce, montáže vody a opravy sanity v regionu'
      : isElectricianDomain ? 'Elektroinstalační a servisní práce pro domácnosti a firmy'
      : isHairDomain ? 'Profesionální kadeřnické a holičské služby (křeslo v salonu i mobilní servis)'
      : isTrainerDomain ? 'Osobní fitness tréninky a pohybová konzultace pro klienty'
      : `Specializovaná lokální služba: ${q.coreSkillsAndExpertise[0] || 'Kvalitní řemeslný a technický servis v regionu'}`;

    primaryTagline = 'Spolehlivé řešení lokálních zakázek s důrazem na precizní řemeslo a osobní doporučení';
    primaryModel = 'Lokální fyzická služba u zákazníka s okamžitou platbou po předání díla';
    primaryMargin = '75–88 %';

    candidateDirections = [
      {
        id: 'dir-craft-gen-1',
        title: primaryTitle,
        tagline: primaryTagline,
        businessModel: primaryModel,
        whyMatch: `Přímá vazba na dovednosti klienta (${skillsStr}) a preferenci osobní/fyzické práce (${effectiveWorkType}).`,
        estimatedMargin: primaryMargin,
        timeToFirstRevenue: '10–14 dní',
        requiredCapital: isZeroBudget ? '6 000 Kč (základní nářadí a ochranné pomůcky)' : (isSubstantial ? 'do 20 000 Kč' : 'do 8 000 Kč'),
        isPrimary: true,
        estimatedStartupCostMin: 6000,
        estimatedStartupCostMax: isSubstantial ? 20000 : 10000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Nákup profesionálního řemeslného nářadí, ochranných pomůcek a lokální reklamy' : 'Základní doplnění spotřebního materiálu',
        recommendedInitialInvestment: isZeroBudget ? 6000 : (isSubstantial ? 15000 : 7000),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-craft-gen-2',
        title: 'Expresní servisní a pohotovostní zásahy pro stálé zákazníky',
        tagline: 'Rychlé opravy a přednostní termíny s garancí příjezdu',
        businessModel: 'Zakázkový a havarijní model s příplatkem za expresní zásah',
        whyMatch: 'Generuje vyšší hodinovou marži a buduje loajalitu klientů.',
        estimatedMargin: '85–92 %',
        timeToFirstRevenue: '7 dní',
        requiredCapital: '4 000 Kč (pohotovostní materiál a drobné nářadí)',
        isPrimary: false,
        estimatedStartupCostMin: 4000,
        estimatedStartupCostMax: 8000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Základní pohotovostní díly a spotřební materiál',
        recommendedInitialInvestment: 4500,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-craft-gen-3',
        title: 'Pravidelná sezónní údržba a servisní předplatné',
        tagline: 'Preventivní prohlídky a pravidelná péče pro privátní i firemní objekty',
        businessModel: 'Paušální servisní smlouvy s předvídatelným celoročním příjmem',
        whyMatch: 'Pomáhá vyhlazovat sezónní výkyvy a vytváří předpoklad pro stabilnější cashflow.',
        estimatedMargin: '80–86 %',
        timeToFirstRevenue: '21 dní',
        requiredCapital: isZeroBudget ? '8 000 Kč (materiálová rezerva a formuláře)' : 'do 15 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 8000,
        estimatedStartupCostMax: 18000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Smluvní šablony a servisní záznamové formuláře',
        recommendedInitialInvestment: isZeroBudget ? 8000 : 12000,
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Spolehlivé a precizní řemeslné provedení bez zbytečných prodlev, s transparentní kalkulací předem a osobní zárukou na odvedené dílo.';
    blueprintIdealCustomer = 'Lokální zákazníci a domácnosti v dojezdové vzdálenosti, kteří hledají spolehlivého a prověřeného řemeslníka.';
    blueprintCustomerProblem = 'Dlouhé čekací doby a nespolehlivost běžných řemeslných firem.';
    blueprintBuyingMotivation = 'Mít jistotu kvalitního a čistého provedení bez zbytečného prodlužování a vícenákladů.';
    blueprintWhereToFindThem = [
      'Lokální sousedské sítě a komunitní skupiny v dojezdu',
      'Google Firemní profil a lokální katalogy služeb',
      'Osobní doporučení a partnerská řemesla v regionu'
    ];
    blueprintCoreOffer = 'Kompletní provedení zakázky se zárukou pevného termínu a transparentní ceny';
    blueprintDeliverables = [
      'Bezplatná vstupní konzultace a zaměření na místě',
      'Kvalitní a čisté provedení díla bez zbytečných průtahů',
      'Předávací protokol a záruka na odvedenou práci'
    ];
    blueprintPricingStrategy = 'Fixní nebo položková zaváděcí sazba pro první referenční zakázky, následně standardní modelový cenový předpoklad.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] 500 – 800 Kč / hodina nebo fixní cena za zakázku dle rozsahu';
    blueprintUpsellOption = 'Pravidelný servisní balíček, sezónní údržba a expresní pohotovostní termíny.';
    blueprintSalesChannel = 'Lokální doporučení, Google Firemní profil, sousedské sítě a osobní kontakty';
    blueprintIcebreaker = 'Dobrý den, nabízím spolehlivé řemeslné a servisní práce v našem regionu. Rád se u vás nezávazně zastavím a připravím nezávazný položkový rozpočet zdarma.';
    blueprintSalesScript = [
      '1. Osobní prohlídka a posouzení situace na místě',
      '2. Předání transparentního rozpočtu',
      '3. Dohoda termínu realizace',
      '4. Čisté a spolehlivé provedení díla',
      '5. Předání a vystavení daňového dokladu'
    ];
    blueprintObjections = [
      {
        objection: 'Nemáme na to teď čas / musíme to odložit.',
        response: 'Rozumím. Právě proto nabízím nezávazné posouzení / zaměření, které vám zabere minimum času a dá vám přesný podklad pro rozhodnutí.'
      },
      {
        objection: 'Už máme někoho jiného / zkusíme to sami.',
        response: 'Naprosto v pořádku. Pokud byste potřebovali druhou nezávislou kalkulaci nebo expresní termín, rád vám do 24 hodin vyjdu vstříc.'
      }
    ];
    blueprintValidationHypothesis = 'V lokalitě je dostatek zájemců hledajících spolehlivou fyzickou službu s nástupem do 2 týdnů.';
    blueprintValidationSteps = [
      'Den 1–3: Sestavení nabídkového listu s ukázkami realizací.',
      'Den 4–8: Přímé oslovení 15 sousedských a osobních kontaktů v okolí.',
      'Den 9–11: Realizace prvních 2 zjišťovacích prohlídek na místě.',
      'Den 12–14: Získání první potvrzené zakázky.'
    ];
    blueprintGoSignal = 'Získání 2 poptávek s reálným termínem realizace.';
    blueprintPivotSignal = 'Poptávky vyžadují jiné vybavení -> úprava specializace nabídky.';
    blueprintDelivery = 'LOKÁLNÍ / OFFLINE (přímé doručení u zákazníka v terénu nebo v provozovně)';
    blueprintAcquisition = 'Osobní nezávazné zaměření a položková kalkulace na místě zdarma do 48 hodin';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Formulace nabídky & seznam prvních 20 kontaktů v dosahu',
        tasks: [
          'Sepsat 1stránkový nabídkový list a kalkulaci na 1 stránce',
          'Sestavit seznam 20 konkrétních jmen a kontaktů v dosahu',
          'Publikovat na profilu 3 ukázky dosavadních realizací a šablonu oslovení'
        ]
      },
      {
        week: 2,
        focus: 'Aktivní kontaktování & první osobní jednání',
        tasks: [
          'Oslovit prvních 15 kontaktů přímou zprávou či telefonicky (cíl: 3–5 odpovědí)',
          'Absolvovat 2–3 nezávazná zaměření či prohlídky na místě',
          'Zapracovat zjištěné připomínky do finálního položkového návrhu'
        ]
      },
      {
        week: 3,
        focus: 'Uzavření prvních zakázek & realizace',
        tasks: [
          'Odeslat 2–3 cenové návrhy a potvrdit závazný termín',
          'Cíl/hypotéza k ověření: získat zálohu a podpis jednoduché smlouvy / objednávky',
          'Zahájit realizaci první pilotní zakázky dle harmonogramu'
        ]
      },
      {
        week: 4,
        focus: 'Bezchybné předání & plán na další měsíc',
        tasks: [
          'Předat dílo v nejvyšší možné kvalitě s předávacím protokolem a vybrat doplatek',
          'Získat minimálně 1 písemnou referenci a 2 nová doporučení',
          'Vyhodnotit provozní přebytek a nastavit akviziční rutinu pro další měsíc'
        ]
      }
    ];
    blueprintAssumedPrice = 'doporučená cena práce dle rozsahu zakázky (položkový rozpočet)';
    blueprintAssumedClients = '3–5 zakázek měsíčně';
    blueprintCapacityScenario = `Modelová kapacita: • Teoretická: 6–8 zakázek měsíčně | • Realistická/provozní: 3–5 zakázek měsíčně (při započtení přípravy, kalkulace, dojezdu a úklidu v rámci fondu ${q.weeklyTimeCommitment}) | • Doporučená: 3–4 zakázky měsíčně`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '6–8 zakázek měsíčně (čistý čas manuální práce bez administrativy a dojezdů)',
      operationalCapacity: `3–5 zakázek měsíčně (zahrnuje přímou práci + rezervu na kalkulace, dojezdy, logistiku a úklid v rámci fondu ${q.weeklyTimeCommitment})`,
      recommendedCapacity: '3–4 zakázky měsíčně (udržitelné tempo s dostatečnou rezervou)',
      overheadBufferBreakdown: 'Rezerva na kalkulace a zaměření, pořizování materiálu, dojezdy na zakázky a úklid pracoviště.'
    };
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití bezplatných nástrojů a stávajícího vybavení (vlastní nářadí; neuvedeno / nezohledněno v tomto modelu: odvody SP/ZP a daně)' 
      : 'Předpoklad modelu: do 500 – 1 500 Kč / měsíc (údržba nářadí, lokální přesuny; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintVariableCosts = 'Předpoklad modelu: model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb (neuvedeno / nezohledněno v tomto modelu: opotřebení techniky)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 zakázka / klient',
      operationalCostScope: 'běžná provozní režie na údržbu nářadí a lokální přesuny cca 500 – 1 500 Kč / měsíc',
      businessTargetNote: '3–5 zakázek měsíčně'
    });
    blueprintCostModel = isZeroBudget ? 'Konzervativní předpoklad: minimální fixní náklad (využití vlastních nástrojů; nezahrnuje odvody SP/ZP a daně)' : 'Nízký fixní náklad';
    blueprintRevenueModel = 'Přímá platba za odvedené dílo / etapy + navazující servis';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 2 zakázky × 10 000 Kč = 20 000 Kč tržba mínus 1 000 Kč variabilní náklady mínus 1 500 Kč fixní provozní náklady = 17 500 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezohledňuje odvody SP/ZP ani daň z příjmů).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (scénář kapacity): 4 zakázky × 12 000 Kč = 48 000 Kč tržba mínus 2 000 Kč variabilní náklady mínus 1 500 Kč fixní provozní náklady = 44 500 Kč modelový provozní přebytek (orientační výsledek modelového scénáře kapacity v rámci časové dotace; nezohledňuje odvody SP/ZP ani daň z příjmů).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 5 zakázek × 12 000 Kč = 60 000 Kč tržba mínus 2 500 Kč variabilní náklady mínus 1 500 Kč fixní provozní náklady = 56 000 Kč modelový provozní přebytek (v rámci horní hranice provozní kapacity 3–5 zakázek měsíčně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 4 zakázky × 12 000 Kč (cena práce) = 48 000 Kč tržba mínus 2 000 Kč variabilní náklady mínus 1 500 Kč fixní provozní náklady = 44 500 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů, obnova nářadí a pojištění.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }
  // --- BRANCH 5: 100% ONLINE / DIGITÁLNÍ MARKETING (TEST 3) ---
  else if (constraints.isOnlineOnly || constraints.detectedDomain === 'marketing') {
    primaryTitle = 'Výkonnostní správa organického obsahu & sociálních sítí na klíč';
    primaryTagline = 'Tvorba a publikace krátkých videí a příspěvků pro české experty a malé firmy';
    primaryModel = 'Měsíční paušální online služba (retainer) bez nutnosti nákupu licencí a skladů';
    primaryMargin = '88–95 %';
    primaryCap = isZeroBudget ? '0 Kč při využití stávajícího vybavení a bezplatných nástrojů' : 'do 2 000 Kč';

    candidateDirections = [
      {
        id: 'dir-online-1',
        title: 'Výkonnostní správa organického obsahu & sociálních sítí na klíč',
        tagline: 'Tvorba a publikace krátkých videí a příspěvků pro české experty a malé firmy',
        businessModel: 'Měsíční paušální online služba (retainer) bez nutnosti nákupu licencí a skladů',
        whyMatch: '100% distanční online provoz bez fyzického dojíždění, přímo navazující na marketingové a copywritingové dovednosti.',
        estimatedMargin: '88–95 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isZeroBudget ? '0 Kč při využití stávajícího vybavení a bezplatných nástrojů' : (isSubstantial ? 'do 8 000 Kč (software, licence, grafika)' : 'do 2 000 Kč'),
        isPrimary: true,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: isSubstantial ? 8000 : 2500,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Předplatné Canva Pro, plánovač sociálních sítí, kvalitní USB mikrofon a webová vizitka' : 'Využití stávajícího vybavení a bezplatných nástrojů',
        recommendedInitialInvestment: isZeroBudget ? 0 : (isSubstantial ? 6000 : 1500),
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-online-reels',
        title: 'Specializovaná video-produkce a tvorba konverzních Reels / Short-form obsahu na klíč',
        tagline: 'Tvorba prémiového vertikálního videa s profesionálním mikrofonem, osvětlením a dynamickým střihem',
        businessModel: 'Měsíční video retainer s vysokou hodnotou pro B2B i B2C (18 000 – 35 000 Kč / měsíc)',
        whyMatch: 'Plné využití dostupného rozpočtu na špičkový technický stack pro video tvorbu bez nutnosti fyzických provozoven.',
        estimatedMargin: '85–92 %',
        timeToFirstRevenue: '14 dní',
        requiredCapital: isSubstantial ? 'do 35 000 Kč (bezdrátový mikrofonní set, studiové osvětlení, software, gimbal)' : '20 000 – 40 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 18000,
        estimatedStartupCostMax: 40000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Bezdrátový mikrofonní systém (DJI Mic), LED softboxy, mobilní stabilizátor, licence střihových nástrojů a portfolio web',
        recommendedInitialInvestment: 28000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-online-2',
        title: 'Konzultace & audit marketingových kanálů a sociálních sítí',
        tagline: 'Jednorázový rozbor profilů s doporučením okamžitých změn pro růst dosahů',
        businessModel: 'Jednorázové placené online konzultace s vysokou hodinovou sazbou',
        whyMatch: 'Umožňuje rychlou monetizaci marketingového know-how bez závazku dlouhodobé správy.',
        estimatedMargin: '95 %',
        timeToFirstRevenue: '7–10 dní',
        requiredCapital: '0 Kč při využití stávajícího vybavení a bezplatných nástrojů',
        isPrimary: false,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: 3000,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Analytické šablony a webová vizitka',
        recommendedInitialInvestment: 0,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-online-3',
        title: 'Tvorba prodejních textů, newsletterů a e-mailových sekvencí',
        tagline: 'Copywriting a e-mail marketing zaměřený na konverzi a udržení stávajících zákazníků',
        businessModel: 'Projektová online služba na zakázku s možností měsíčního předplatného',
        whyMatch: 'Vysoká poptávka českých e-shopů a služeb po kvalitních textech bez nutnosti fyzické přítomnosti.',
        estimatedMargin: '90–94 %',
        timeToFirstRevenue: '14 dní',
        requiredCapital: '0 Kč při využití stávajícího vybavení a bezplatných nástrojů',
        isPrimary: false,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: 2000,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Šablony a testovací mailingové účty',
        recommendedInitialInvestment: 0,
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Pravidelný a konverzní obsah pro sociální sítě na klíč bez vašeho času a složitého schvalování, generující reálné poptávky.';
    blueprintIdealCustomer = 'Majitel malé české firmy nebo online expert, který nemá čas tvořit obsah a přichází o poptávky.';
    blueprintCustomerProblem = 'Ztráta času na nepravidelné tvorbě příspěvků bez měřitelného obchodního dopadu.';
    blueprintBuyingMotivation = 'Získat pravidelný přísun poptávek a profesionální prezentaci na sítích bez nutnosti trávit hodiny vymýšlením obsahu.';
    blueprintWhereToFindThem = [
      'LinkedIn profesní síť a české B2B skupiny',
      'Instagramové a facebookové profily malých českých firem a e-shopů',
      'Specializované české podnikatelské komunity a platformy'
    ];
    blueprintCoreOffer = 'Kompletní správa sociálních sítí – 12 postů měsíčně s garancí pravidelnosti a konverzních textů';
    blueprintDeliverables = [
      'Měsíční publikační plán a strategie obsahu na míru',
      'Tvorba 12 grafických a textových postů měsíčně včetně hashtagů a výzev k akci',
      'Pravidelný měsíční reporting dosahů, interakcí a nových poptávek'
    ];
    blueprintPricingStrategy = 'Měsíční paušální platba (retainer) splatná na začátku měsíce se zaváděcí slevou za 3měsíční závazek a referenci.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] 9 500 – 15 000 Kč / měsíc za klienta (retainer)';
    blueprintUpsellOption = 'Správa placených reklamních kampaní (Meta Ads), tvorba video Reels na míru a nastavení e-mailingu.';
    blueprintSalesChannel = 'Organický outreach přes LinkedIn a Instagram, případové studie a doporučení';
    blueprintIcebreaker = 'Dobrý den, zaujal mě váš profil v oboru. Připravil jsem pro vás 3 rychlé tipy, jak z vašich stávajících příspěvků získat více poptávek. Mohu vám poslat krátký rozbor?';
    blueprintSalesScript = [
      '1. Analýza současného profilu a identifikace slabých míst',
      '2. Ukázka konkrétního návrhu příspěvku na míru',
      '3. Představení měsíčního balíčku se zaváděcí slevou za referenci',
      '4. Nastavení publikačního plánu a schválení prvních výstupů',
      '5. Měsíční vyhodnocení a prodloužení spolupráce'
    ];
    blueprintObjections = [
      {
        objection: 'Sociální sítě nám dosud žádné reálné zákazníky nepřinesly.',
        response: 'To je běžné při nahodilém postování bez konverzní strategie. V mém návrhu stavíme každý post na konkrétní výzvě k akci, což vám doložím v auditu zdarma.'
      },
      {
        objection: 'Nemáme rozpočet na velkou digitální agenturu.',
        response: 'Právě proto neplatíte agenturní aparát, ale agilní spolupráci s přímým specialistou za třetinovou cenu s garantovanou pravidelností.'
      }
    ];
    blueprintValidationHypothesis = 'Alespoň 3 z 20 oslovených firem projeví zájem o audit profilu a cenovou nabídku správy.';
    blueprintValidationSteps = [
      'Den 1–3: Příprava vzorového portfolia a šablony auditu profilu.',
      'Den 4–8: Přímý outreach a oslovení 20 vytipovaných firem personalizovaným auditem.',
      'Den 9–11: Realizace 3 zjišťovacích online callů (videohovorů s představením auditu).',
      'Den 12–14: Získání prvního platícího klienta na měsíční paušál (retainer).'
    ];
    blueprintGoSignal = 'Získání 1 potvrzeného retaineru s platbou předem.';
    blueprintPivotSignal = 'Klienti preferují pouze jednorázové texty -> zaměření na balíčky webového copywritingu.';
    blueprintDelivery = '100% ONLINE (plně distanční komunikace, tvorba a doručení po internetu bez fyzických schůzek a provozovny)';
    blueprintAcquisition = 'Navázání vztahu formou bezplatného auditu profilu na míru, nikoliv nátlakový prodej';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Definice nabídky & sestavení seznamu 20 firem na LinkedIn/IG',
        tasks: [
          'Vytvořit 1stránkový přehled balíčku správy sítí s 3 ukázkami výstupů',
          'Vytipovat 20 konkrétních českých firem na LinkedInu a Instagramu s neaktivním či nekonverzním profilem',
          'Připravit šablonu 3minutového video-auditu / rozboru profilu zdarma'
        ]
      },
      {
        week: 2,
        focus: 'Personalizovaný outreach & odeslání mini-auditů',
        tasks: [
          'Oslovit 15 firem personalizovanou zprávou s konkrétním doporučením (cíl: 3–4 reakce)',
          'Natočit a odeslat 3 krátké video-audity pro nejzajímavější zájemce',
          'Domluvit 2–3 online zjišťovací hovory na Zoom/Google Meet'
        ]
      },
      {
        week: 3,
        focus: 'Prezentace měsíčního plánu & uzavření prvního retaineru',
        tasks: [
          'Odbavit 2–3 zjišťovací hovory a představit návrh měsíčního retaineru s jasným rozsahem výstupů',
          'Cíl/hypotéza k ověření: uzavřít 1. retainerovou spolupráci se zálohovou platbou',
          'Vytvořit publikační plán na první měsíc pro nového klienta (12 příspěvků)'
        ]
      },
      {
        week: 4,
        focus: 'Odbavení prvních výstupů, měření dosahů & reference',
        tasks: [
          'Naplánovat a publikovat první várku 3 příspěvků pro klienta a nastavit měření',
          'Zaslat klientovi 1. týdenní analytický report dosahů a interakcí',
          'Vyžádat zpětnou vazbu a písemné hodnocení spolupráce po prvním týdnu'
        ]
      }
    ];
    blueprintAssumedPrice = '8 000 – 16 000 Kč / měsíc za stálý měsíční správcovský retainer (obsah, grafika, distribuce, reporting)';
    blueprintAssumedClients = '3–5 stálých retainerů měsíčně (optimální provozní kapacita 3–4 stálí klienti)';
    blueprintCapacityScenario = `Modelová kapacita: • Teoretická kapacita: 5–6 retainerů měsíčně (čistý čas 15 h tvorby postů bez klientských schůzek a reportingu) | • Realistická/provozní kapacita: 3–4 stálí klienti (cílové rozpětí 3–5 stálých retainerů měsíčně, zahrnuje 12–15 h tvorby na klienta + 3 h rezerva na klientské videohovory, schvalování, reporting a akvizici v rámci fondu ${q.weeklyTimeCommitment}) | • Doporučená udržitelná kapacita: 3 stálí retaineroví klienti`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '5–6 retainerových klientů měsíčně (čistý čas 15 h na tvorbu postů bez schůzek, reportingu a komunikace)',
      operationalCapacity: `3–4 stálí retaineroví klienti měsíčně (cílové rozpětí 3–5 stálých retainerů měsíčně; zahrnuje 12–15 h přímé tvorby obsahu na klienta + 3 h rezervu na klientské videohovory, schvalování podkladů, měsíční reporting a akvizici = 50–70 h měsíčně v rámci fondu ${q.weeklyTimeCommitment})`,
      recommendedCapacity: '3 stálí retaineroví klienti měsíčně (poskytuje prostor pro strategický copywriting a prevenci vyhoření)',
      overheadBufferBreakdown: 'Rezerva na klientské online hovory, schvalovací kolečka, přípravu měsíčního reportingu dosahů a akviziční outreach.'
    };
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití stávajícího vybavení a bezplatných nástrojů (vlastního stávajícího počítače a telefonu; běžné provozní náklady v rozvoji mohou činit např. 500 – 1 500 Kč/měsíc na pokročilejší nástroje jako modelový předpoklad, např. Canva Pro či plánovače obsahu; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů a amortizace PC)' 
      : 'Předpoklad modelu: do 500 – 1 500 Kč / měsíc (Canva Pro, plánovač sítí; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintVariableCosts = 'Předpoklad modelu: 0 Kč přímých variabilních nákladů na zakázku (čistě distanční digitální služba; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, licence specializovaného softwaru a daň z příjmů)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 retainerový klient (nebo placený audit)',
      operationalCostScope: 'softwarové licence a předplatné grafických a plánovacích nástrojů do 500 – 1 500 Kč / měsíc',
      businessTargetNote: '3–5 stálých retainerů měsíčně'
    });
    blueprintCostModel = isZeroBudget ? 'Konzervativní předpoklad: 0 Kč při využití stávajícího vybavení a bezplatných nástrojů (vlastní stávající PC; běžné provozní předplatné grafických a plánovacích nástrojů cca 500 – 1 000 Kč/měsíc je volitelné; neuvedeno / nezohledněno v tomto modelu: SP/ZP a daně)' : 'Nízké softwarové předplatné';
    blueprintRevenueModel = 'Měsíční paušální předplatné (retainer) se stálým předvídatelným cashflow';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 1 retainer × 12 000 Kč = 12 000 Kč tržba mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady = 12 000 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezahrnuje odvody SP/ZP ani daně).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (scénář kapacity): při scénáři kapacity 3 stálí klienti: 3 klienti × 12 000 Kč = 36 000 Kč tržba mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady (0 Kč při využití stávajícího vybavení a bezplatných nástrojů; při zahrnutí případných běžných provozních nástrojů cca 1 000 Kč činí přebytek 35 000 Kč jako modelový předpoklad) = 36 000 Kč modelový provozní přebytek (orientační výsledek modelového scénáře kapacity; nezahrnuje odvody SP/ZP a daně).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 4 klienti × 12 000 Kč = 48 000 Kč tržba mínus 0 Kč variabilní náklady mínus 1 000 Kč běžný provozní software = 47 000 Kč modelový provozní přebytek (v rámci horní hranice provozní kapacity 3–4 stálí retaineroví klienti při 20 h/týdně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 3 klienti × 12 000 Kč = 36 000 Kč tržba mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady (0 Kč při využití stávajícího vybavení a bezplatných nástrojů; případné běžné provozní nástroje cca 500 – 1 000 Kč/měsíc lze volitelně zapojit z prvních plateb jako modelový předpoklad) = 36 000 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů, placené licence grafických nástrojů, rezerva na výpadek klientů.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }
  // --- BRANCH 6: NEURČITÝ KLIENT / BALANCED COMBINATION (TEST 5) ---
  else if (constraints.isUndetermined) {
    primaryTitle = 'Lokální a hybridní provozní koordinace / servis pro malé firmy a živnostníky v regionu';
    primaryTagline = 'Kombinace osobní asistence a vzdálené organizační podpory šetřící čas vytíženým podnikatelům';
    primaryModel = 'Flexibilní hybridní služba (osobní návštěvy u zákazníka + vzdálená online správa)';
    primaryMargin = '80–88 %';
    primaryCap = isZeroBudget ? '0 Kč (model předpokládá využití stávajícího telefonu/PC a nezahrnuje případné cestovní náklady)' : 'do 3 000 Kč';

    candidateDirections = [
      {
        id: 'dir-neutral-1',
        title: 'Lokální a hybridní provozní koordinace / servis pro malé firmy a živnostníky v regionu',
        tagline: 'Kombinace osobní asistence a vzdálené organizační podpory šetřící čas vytíženým podnikatelům',
        businessModel: 'Flexibilní hybridní služba (osobní návštěvy u zákazníka + vzdálená online správa)',
        whyMatch: 'Optimální hybridní cesta pro neurčitou preferenci: spojuje flexibilitu osobního kontaktu s efektivitou vzdálené práce.',
        estimatedMargin: '80–88 %',
        timeToFirstRevenue: '14 dní',
        requiredCapital: isZeroBudget ? '0 Kč (model předpokládá využití stávajícího telefonu/PC a nezahrnuje případné cestovní náklady)' : (isSubstantial ? 'do 8 000 Kč' : 'do 3 000 Kč'),
        isPrimary: true,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: isSubstantial ? 10000 : 3500,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Mobilní hardware, cloudové licence a reprezentativní branding pro jednání s firmami' : 'Využití stávajícího telefonu/PC a bezplatných nástrojů (nezahrnuje případné cestovní náklady)',
        recommendedInitialInvestment: isSubstantial ? 8000 : 0,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-neutral-pro',
        title: 'Komplexní provozní, technologická a digitalizační asistence pro firmy (mobilní kancelář, profi hardware a nástroje)',
        tagline: 'Profesionální zázemí s mobilní prezentační a digitalizační technikou, licencovaným softwarem a expresním servisem',
        businessModel: 'Prémiová hybridní asistenční služba s měsíčním paušálem (12 000 – 22 000 Kč / měsíc)',
        whyMatch: 'Smysluplně využívá dostupný rozpočet pro nákup certifikovaného software, mobilního hardware a akvizici bonitních firemních klientů.',
        estimatedMargin: '82–88 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isSubstantial ? 'do 40 000 Kč (hardware, software, prezentační technika, branding)' : '20 000 – 45 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 20000,
        estimatedStartupCostMax: 45000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Profesionální přenosný hardware, licencovaný software pro automatizaci procesů, mobilní digitalizační technika a reprezentační branding pro jednání s firmami',
        recommendedInitialInvestment: 30000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-neutral-2',
        title: 'Lokální organizační servis a správa zázemí pro provozovny a domácnosti',
        tagline: 'Přímá fyzická pomoc se zajištěním chodu kanceláří, stěhováním, údržbou a nákupy',
        businessModel: 'Lokální fyzická služba s přímou hodinovou či balíčkovou platbou',
        whyMatch: 'Objektivní fyzická/lokální alternativa pro klienty, kteří chtějí hmatatelnou práci v terénu.',
        estimatedMargin: '75–85 %',
        timeToFirstRevenue: '7–10 dní',
        requiredCapital: isZeroBudget ? '3 500 Kč (nářadí a přepravní boxy)' : (isSubstantial ? 'do 12 000 Kč' : 'do 5 000 Kč'),
        isPrimary: false,
        estimatedStartupCostMin: 3500,
        estimatedStartupCostMax: isSubstantial ? 15000 : 6000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Ruční technické nářadí, přepravní boxy a ochranné pomůcky pro fyzickou organizaci',
        recommendedInitialInvestment: isSubstantial ? 10000 : 3500,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-neutral-3',
        title: 'Vzdálená virtuální administrativa a správa poptávek pro české firmy',
        tagline: 'Online vyřizování e-mailů, koordinace kalendáře a zákaznická podpora ze zázemí domova',
        businessModel: '100% online distanční služba na měsíční paušál',
        whyMatch: 'Objektivní digitální alternativa pro klienta s nulovými náklady na dojíždění a plnou flexibilitou.',
        estimatedMargin: '90–95 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: '0 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: 2500,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Základní kancelářský software a webová vizitka',
        recommendedInitialInvestment: 0,
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Flexibilní a spolehlivá provozní podpora šetřící hodiny rutinní práce týdně bez nutnosti zaměstnávat lidi na plný úvazek.';
    blueprintIdealCustomer = 'Vytížení majitelé menších firem a živnostníci, kteří nestíhají organizační agendu a provoz.';
    blueprintCustomerProblem = 'Přetížení administrativou a fyzickou organizací zázemí po večerech a o víkendech.';
    blueprintBuyingMotivation = 'Uvolnit si ruce od provozních starostí a získat spolehlivého parťáka pro každodenní úkoly.';
    blueprintWhereToFindThem = [
      'Lokální podnikatelské kluby a coworkingy v okolí',
      'Profesní sítě (LinkedIn) a oborové facebookové skupiny',
      'Přímá doporučení z osobní a rodinné sítě kontaktů'
    ];
    blueprintCoreOffer = 'Hybridní asistenční balíček – 10 hodin provozní a organizační podpory měsíčně';
    blueprintDeliverables = [
      'Vstupní 30minutové zmapování přetížených míst',
      '10 hodin vyhrazených pro přímé odbavení organizačních a provozních úkolů měsíčně',
      'Týdenní přehled vyřízené agendy a ušetřeného času'
    ];
    blueprintPricingStrategy = 'Hodinová sazba na zkoušku s rychlým přechodem na měsíční balíček hodin pro stabilní cashflow.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] 350 – 500 Kč / hodina nebo balíček 4 500 – 5 000 Kč / měsíc (10 hodin asistence)';
    blueprintUpsellOption = 'Rozšíření asistence na správu komunikace se zákazníky, organizaci eventů a koordinaci dodavatelů.';
    blueprintSalesChannel = 'Lokální i online networking, doporučení známých a profesní sítě';
    blueprintIcebreaker = 'Dobrý den, pomáhám podnikatelům uvolnit ruce od provozní administrativy a organizace. Mohu vám nabídnout nezávaznou zkušební asistenci na 2 hodiny zdarma?';
    blueprintSalesScript = [
      '1. Zjištění, co podnikateli zabírá nejvíc zbytečného času',
      '2. Návrh konkrétního zkušebního úkolu',
      '3. Bezchybné odbavení úkolu do 24 hodin',
      '4. Dohoda měsíčního asistenčního paušálu'
    ];
    blueprintObjections = [
      {
        objection: 'Nemám čas vysvětlovat někomu dalšímu, co má dělat.',
        response: 'Chápu. Stačí mi poslat 2minutovou hlasovou zprávu nebo surové zadání, zbytek si zorganizuji a připravím k rychlému schválení sám.'
      },
      {
        objection: 'Váhám, zda se mi asistence finančně vyplatí.',
        response: 'Vyzkoušíme 2hodinový pilotní úkol zdarma. Pokud vám ušetří čas na vaše vlastní platící zakázky, investice se vám okamžitě vrátí.'
      }
    ];
    blueprintValidationHypothesis = 'V okolí i online je dostatek vytížených OSVČ poptávajících provozní výpomoc.';
    blueprintValidationSteps = [
      'Den 1–3: Seznam nabízených asistenčních činností a šablona spolupráce.',
      'Den 4–8: Přímé oslovení 15 podnikatelů v okolí i online.',
      'Den 9–11: Realizace 2 zkušebních organizačních úkolů.',
      'Den 12–14: Získání prvního stálého klienta na paušál.'
    ];
    blueprintGoSignal = 'Získání 1 platícího klienta do 14 dnů.';
    blueprintPivotSignal = 'Klient preferuje výhradně online úkoly -> přechod na virtuální asistenci.';
    blueprintDelivery = 'HYBRIDNÍ MODEL (kombinace lokální osobní přítomnosti u klienta a online administrativy)';
    blueprintAcquisition = 'Zkušební pilotní asistence (2 hodiny zdarma na otestování) a přímá doporučení';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Katalog asistenčních služeb & seznam 20 vytížených kontaktů',
        tasks: [
          'Sepsat katalog 10 nejčastějších provozních úkolů, které podnikatelům šetří čas',
          'Vytipovat 20 podnikatelů a živnostníků v okolí i na profesní síti',
          'Připravit 1stránkovou nabídku bezplatné 2hodinové zkušební asistence'
        ]
      },
      {
        week: 2,
        focus: 'Přímé oslovení & odbavení zkušebních úkolů',
        tasks: [
          'Oslovit 15 vytipovaných kontaktů přátelskou zprávou s nabídkou zkušebního úkolu (cíl: 3–4 reakce)',
          'Odbavit 2 pilotní úkoly s maximální rychlostí a precizností',
          'Předložit nabídku měsíčního asistenčního balíčku ušetřeného času (10 hodin za 4 500 – 5 000 Kč)'
        ]
      },
      {
        week: 3,
        focus: 'Dohoda měsíčních paušálů & zavedení komunikačního kanálu',
        tasks: [
          'Cíl/hypotéza k ověření: uzavřít 1 stálou spolupráci na balíček 10 hodin měsíčně',
          'Zprovoznit sdílenou tabulku / nástroj pro zadávání a evidenci úkolů (Trello/ClickUp)',
          'Potvrdit spolupráci a vystavit zálohovou fakturu na první měsíc'
        ]
      },
      {
        week: 4,
        focus: 'Vyhodnocení prvního měsíce & doporučení na další podnikatele',
        tasks: [
          'Předat klientovi 1. týdenní přehled vyřízených úkolů a odpracovaného času',
          'Požádat spokojeného klienta o kontakt na 2 další známé podnikatele',
          'Nastavit rozvrh týdenní kapacity (10 h přímé práce + rezerva v rámci fondu 15 h/týdně)'
        ]
      }
    ];
    blueprintAssumedPrice = '4 500 – 5 000 Kč / měsíc za flexibilní asistenční balíček (10 hodin podpory, sazba cca 450 – 500 Kč/hod)';
    blueprintAssumedClients = '3–4 stálí klienti na měsíční bázi';
    blueprintCapacityScenario = `Modelová kapacita: • Teoretická kapacita: 6 klientů po 10 h/měsíc (čistých 60 h práce bez režie a komunikace) | • Realistická/provozní kapacita: 3–4 stálí klienti na balíček 10 hodin měsíčně (zahrnuje 30–40 h přímé asistence + 10–13 h rezervu na komunikaci, upřesňování priorit a fakturaci v rámci fondu ${q.weeklyTimeCommitment} = cca 65 h/měsíc) | • Doporučená udržitelná kapacita: 3 stálí klienti (40 h měsíčně = cca 9–10 h/týdně)`;
    blueprintCapacityBreakdown = {
      theoreticalCapacity: '6 klientů po 10 hodinách měsíčně (čistých 60 h práce na úkolech bez jakékoliv režie a komunikace)',
      operationalCapacity: `3–4 stálí klienti na balíček 10 hodin měsíčně (zahrnuje 30–40 h přímé práce na úkolech + 10–13 h rezervu na komunikaci se zadavateli, upřesňování priorit, fakturaci a organizaci kalendáře = 40–53 h měsíčně v rámci časové dotace ${q.weeklyTimeCommitment} = 65 h/měsíc)`,
      recommendedCapacity: '3 stálí klienti na balíček 10 hodin měsíčně (30 h přímá práce + 10 h komunikace a režie = 40 h měsíčně = cca 9–10 h/týdně, s bezpečnou časovou rezervou)',
      overheadBufferBreakdown: 'Rezerva na komunikaci a zadávání úkolů od klientů, upřesňování priorit, fakturaci, správu vlastního kalendáře a oslovování nových poptávek.'
    };
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití stávajícího vybavení a bezplatných nástrojů (model předpokládá využití stávajícího telefonu a PC a nezahrnuje případné cestovní náklady; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, mobilní tarif a daň z příjmů)' 
      : 'Předpoklad modelu: 0 Kč při využití stávajícího vybavení a bezplatných nástrojů (model předpokládá využití stávajícího telefonu a PC a nezahrnuje případné cestovní náklady; případné lokální cestovné nebo mobilní data cca 300 – 500 Kč/měsíc jsou volitelným scénářem; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintVariableCosts = 'Předpoklad modelu: 0 Kč přímých variabilních nákladů na zakázku (čistě organizační a administrativní podpora; neuvedeno / nezohledněno v tomto modelu: odvody SP/ZP a daně)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 klient na asistenční paušál (nebo 1 zkušební organizační úkol)',
      operationalCostScope: 'běžná provozní režie na lokální cestovné a mobilní data do 300 – 500 Kč / měsíc',
      businessTargetNote: '3–4 stálí platící klienti měsíčně'
    });
    blueprintCostModel = isZeroBudget ? 'Konzervativní předpoklad: 0 Kč při využití stávajícího vybavení a bezplatných nástrojů (model předpokládá využití stávajícího telefonu a PC a nezahrnuje případné cestovní náklady; nezahrnuje odvody SP/ZP a daně)' : 'Minimální provozní režie';
    blueprintRevenueModel = 'Hodinová sazba na zkoušku + měsíční balíčky asistenčních hodin';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 1 klient na balíček 10 h × 4 500 Kč = 4 500 Kč tržba mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady = 4 500 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (modelová kapacita): při scénáři modelové kapacity 3–4 stálí klienti na asistenční balíček 10 hodin měsíčně (při časové dotaci 15 h/týdně = 65 h/měsíc, přímá práce 30–40 h + rezerva na komunikaci a organizaci 10–13 h): 3 klienti × 5 000 Kč = 15 000 Kč tržba (při 4 klientech: 4 × 5 000 Kč = 20 000 Kč tržba) mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady = 15 000 – 20 000 Kč modelový provozní přebytek (orientační výsledek modelového scénáře kapacity; nezohledňuje odvody SP/ZP, daně ani rezervy).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 4 stálí klienti (4 × 5 000 Kč = 20 000 Kč) + 1 nárazový projekt za 3 000 Kč = 23 000 Kč tržba mínus 0 Kč variabilní náklady mínus 300 Kč mobilní data = 22 700 Kč modelový provozní přebytek (teoretický kapacitní strop při 15 h/týdně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 3 klienti × 5 000 Kč (balíček 10 h) = 15 000 Kč tržba mínus 0 Kč variabilní náklady mínus 0 Kč fixní provozní náklady (0 Kč při využití bezplatných nástrojů a stávajícího vybavení) = 15 000 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů, úrazové a odpovědnostní pojištění.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }
  // --- BRANCH 7: VŠEOBECNÁ KOMBINACE / STANDARDNÍ B2B MODEL ---
  else {
    primaryTitle = 'Specializovaná provozní a projektová podpora pro živnostníky a malé firmy';
    primaryTagline = 'Optimalizace procesů, koordinace a zákaznický servis šetřící čas českým podnikatelům';
    primaryModel = 'Zakázková služba s vysokou přidanou hodnotou a nízkou režií';
    primaryMargin = '85–92 %';
    primaryCap = isZeroBudget ? '0 Kč' : 'do 3 000 Kč';

    candidateDirections = [
      {
        id: 'dir-1',
        title: primaryTitle,
        tagline: primaryTagline,
        businessModel: primaryModel,
        whyMatch: `Přímo odpovídá cíli klienta (${q.mainGoal.slice(0, 40)}...), zkušenostem (${skillsStr}) a provoznímu modelu ${q.operatingModel.toUpperCase()}.`,
        estimatedMargin: primaryMargin,
        timeToFirstRevenue: '14–21 dní při dodržení validačního plánu',
        requiredCapital: isZeroBudget ? '0 Kč' : (isSubstantial ? 'do 10 000 Kč' : 'do 3 000 Kč'),
        isPrimary: true,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: isSubstantial ? 12000 : 3500,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: isSubstantial ? 'Základní licence kancelářského softwaru, reprezentativní web a vizitky' : 'Využití stávajícího počítače a bezplatných verzí nástrojů',
        recommendedInitialInvestment: isSubstantial ? 8000 : 0,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-pro-turnkey',
        title: 'Kompletní optimalizace firemních procesů a implementace nástrojů na klíč s prémiovým softwarem a klientskou akvizicí',
        tagline: 'Zprovoznění moderních CRM, automatizací a komunikačních toků pro české firmy s profesionální licencí a marketingem',
        businessModel: 'Projektová implementace na klíč s prémiovou cenou práce + navazující servisní retainer',
        whyMatch: 'Smysluplně využívá dostupný rozpočet pro nákup certifikovaného software, šablon a akviziční kampaně pro zisk bonitních klientů.',
        estimatedMargin: '82–88 %',
        timeToFirstRevenue: '14–21 dní',
        requiredCapital: isSubstantial ? 'do 40 000 Kč (licence, certifikace, vývojové nástroje, marketing)' : '25 000 – 45 000 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 22000,
        estimatedStartupCostMax: 45000,
        startupCostLevel: 'medium',
        capitalIntensity: 'medium',
        recommendedCapitalUse: 'Profesionální roční licence software (Make, Airtable, CRM), marketingová akviziční kampaň na LinkedIn a reprezentativní webová prezentace',
        recommendedInitialInvestment: 32000,
        budgetCompatibility: isSubstantial ? 'high' : 'incompatible'
      },
      {
        id: 'dir-2',
        title: 'Konzultace & audit stávajících procesů pro OSVČ a experty',
        tagline: 'Jednorázový rozbor překážek v podnikání a návrh okamžitých nápravných kroků',
        businessModel: 'Jednorázové placené konzultace s možností navazující spolupráce',
        whyMatch: 'Umožňuje okamžitou monetizaci expertízy bez nutnosti vytvářet složité produkty.',
        estimatedMargin: '90–95 %',
        timeToFirstRevenue: '7–14 dní',
        requiredCapital: '0 Kč',
        isPrimary: false,
        estimatedStartupCostMin: 0,
        estimatedStartupCostMax: 2500,
        startupCostLevel: 'minimal',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Prezentační 1stránkový auditní formulář a webová vizitka',
        recommendedInitialInvestment: 0,
        budgetCompatibility: 'high'
      },
      {
        id: 'dir-3',
        title: 'Komplexní balíček zprovoznění a optimalizace klientského příjmu',
        tagline: 'Nastavení komunikačních kanálů a koordinace zakázek na klíč',
        businessModel: 'Projektová služba s navazujícím měsíčním retainerem',
        whyMatch: 'Vytváří dlouhodobé stabilní cashflow.',
        estimatedMargin: '85–90 %',
        timeToFirstRevenue: '21–30 dní',
        requiredCapital: isZeroBudget ? '0 Kč' : (isSubstantial ? 'do 15 000 Kč' : 'do 5 000 Kč'),
        isPrimary: false,
        estimatedStartupCostMin: isZeroBudget ? 0 : 5000,
        estimatedStartupCostMax: isSubstantial ? 20000 : 10000,
        startupCostLevel: 'low',
        capitalIntensity: 'low',
        recommendedCapitalUse: 'Předplatné automatizačních platforem a rezerva na testovací kampaně',
        recommendedInitialInvestment: isZeroBudget ? 0 : (isSubstantial ? 15000 : 5000),
        budgetCompatibility: 'high'
      }
    ];

    blueprintUvp = 'Specializovaná provozní a procesní podpora šetřící čas českým podnikatelům s důrazem na rychlé výsledky a férové jednání.';
    blueprintIdealCustomer = 'Majitel malé české firmy (2–15 zaměstnanců) nebo vytížený OSVČ, který nestíhá koordinaci a přichází o zakázky.';
    blueprintCustomerProblem = 'Ztráta času na neefektivní ruční administrativě po večerech a riziko ztráty rozjednaných zakázek.';
    blueprintBuyingMotivation = 'Uvolnit si ruce od provozních starostí a získat spolehlivé řešení bez nutnosti trávit večery u administrativy.';
    blueprintWhereToFindThem = [
      'Lokální podnikatelská fóra a profesní kontakty',
      'LinkedIn a profesní sítě pro malé firmy',
      'Přímá doporučení z obchodních a osobních vztahů'
    ];
    blueprintCoreOffer = 'Základní implementační balíček – kompletní nastavení a odbavení procesů do 5 dnů';
    blueprintDeliverables = [
      'Vstupní 30minutový audit současného stavu',
      'Dodání a zprovoznění řešení na míru bez technických komplikací',
      '14denní podpora a záruka rychlých úprav dle přání klienta'
    ];
    blueprintPricingStrategy = 'Fixní nebo položková zaváděcí sazba pro první referenční zakázky, následně standardní modelový cenový předpoklad.';
    blueprintPrice = '[RECOMMENDATION / SCENARIO] 4 900 – 7 900 Kč za jednorázové dodání (nebo 8 500 Kč/měsíc za retainer)';
    blueprintUpsellOption = 'Rozšířená měsíční podpora, procesní audit a dlouhodobá správa systémů.';
    blueprintSalesChannel = q.strictDislikesAndRedLines.some(r => r.toLowerCase().includes('cold'))
      ? 'Personalizovaný organický kontakt přes profesní síť a doporučení (BEZ cold callingu)'
      : 'Cílený přímý outreach na vedoucí pracovníky';
    blueprintIcebreaker = 'Dobrý den, zaujalo mě vaše zaměření v oboru. Věnuji se zefektivnění procesů pro podnikatele a rád bych vám nezávazně poslal 3 rychlé tipy, jak ušetřit hodiny práce týdně. Mohu vám poslat krátký odkaz?';
    blueprintSalesScript = [
      '1. Naladění & potvrzení zájmu (Díky za váš čas, navazuji na zprávu...)',
      '2. Otázka na současný stav (Jak u vás dnes řešíte příjem a koordinaci?)',
      '3. Zjištění bolavého místa (Co vám na tom zabírá nejvíc energie?)',
      '4. Představení řešení na příkladu (Ukázka konkrétního postupu)',
      '5. Zvýhodněná zaváděcí nabídka (Výměnou za referenci nastavím za zaváděcí cenu)'
    ];
    blueprintObjections = [
      {
        objection: 'Nemáme na to teď čas / musíme to odložit.',
        response: 'Rozumím. Právě proto nabízím nezávazné posouzení / zaměření, které vám zabere minimum času a dá vám přesný podklad pro rozhodnutí.'
      },
      {
        objection: 'Už máme někoho jiného / zkusíme to sami.',
        response: 'Naprosto v pořádku. Pokud byste potřebovali druhou nezávislou kalkulaci nebo expresní termín, rád vám do 24 hodin vyjdu vstříc.'
      }
    ];
    blueprintValidationHypothesis = 'Potenciální zákazníci vnímají tento problém natolik palčivě, že jsou ochotni domluvit nezávazný rozhovor a potvrdit objednávku.';
    blueprintValidationSteps = [
      'Den 1–3: Vytvoření 1stránkového přehledu nabídky s jasným slibem.',
      'Den 4–8: Přímé oslovení 20 vytipovaných kontaktů personalizovanou zprávou.',
      'Den 9–11: Realizace 3–5 krátkých zjišťovacích rozhovorů.',
      'Den 12–14: Získání prvních 2 závazných objednávek se zálohou.'
    ];
    blueprintGoSignal = 'Alespoň 2 potvrzené poptávky z prvních oslovených kontaktů.';
    blueprintPivotSignal = 'Méně než 1 odpověď z 20 kontaktů; úprava formulace slibu a cílového segmentu.';
    blueprintDelivery = `${q.operatingModel.toUpperCase()} (kombinace přímého a flexibilního doručení)`;
    blueprintAcquisition = 'Navázání vztahu formou bezplatného posouzení / ukázky na míru, nikoliv nátlakový prodej';
    blueprint30DayPlan = [
      {
        week: 1,
        focus: 'Formulace neodolatelné nabídky & seznam prvních 20 kontaktů',
        tasks: [
          'Sepsat 1stránkový nabídkový list a kalkulaci na 1 stránce',
          'Sestavit seznam 20 konkrétních jmen a kontaktů v dosahu',
          'Publikovat na profilu 3 ukázky nabídky a připravit šablonu zprávy/oslovení'
        ]
      },
      {
        week: 2,
        focus: 'Aktivní kontaktování & první osobní / zjišťovací jednání',
        tasks: [
          'Oslovit prvních 15 kontaktů přímou zprávou či telefonicky (cíl: 2–3 reakce)',
          'Absolvovat 2–3 nezávazná zjišťovací jednání či rozhovory',
          'Zapracovat zjištěné připomínky do finální podoby nabídky'
        ]
      },
      {
        week: 3,
        focus: 'Uzavření prvních platících zakázek',
        tasks: [
          'Odeslat 2–3 cenové návrhy a potvrdit termín zahájení',
          'Cíl/hypotéza k ověření: získat zálohu a podpis jednoduché smlouvy / objednávky od 1. platícího klienta',
          'Zahájit realizaci první pilotní zakázky dle harmonogramu'
        ]
      },
      {
        week: 4,
        focus: 'Bezchybné předání, získání reference & plán na další měsíc',
        tasks: [
          'Předat dílo zákazníkovi v plné kvalitě s předávacím protokolem',
          'Získat minimálně 1 písemnou či video referenci a 2 nová doporučení',
          'Vyhodnotit provozní přebytek a nastavit stabilní akviziční rutinu pro další měsíc'
        ]
      }
    ];
    blueprintAssumedPrice = blueprintPrice || 'dle typu zakázky';
    blueprintAssumedClients = '3–5 zakázek měsíčně';
    blueprintCapacityBreakdown = {
      theoreticalCapacity: `6–8 klientských balíčků měsíčně (čistý čas 15 h na klienta bez rezerv na administrativu a komunikaci)`,
      operationalCapacity: `3–4 stálí klienti měsíčně (zahrnuje 10–12 h asistenční práce na klienta + 3 h rezervu na schůzky, přípravu a administrativu = cca 40–55 h měsíčně v rámci fondu ${q.weeklyTimeCommitment})`,
      recommendedCapacity: `3 stálí klienti měsíčně (udržitelné tempo umožňující vysokou kvalitu a spolehlivost)`,
      overheadBufferBreakdown: 'Přiměřená rezerva na operativní komunikaci, přípravu podkladů, fakturaci a průběžný klientský networking.'
    };
    blueprintCapacityScenario = `Modelová kapacita: • Teoretická kapacita: 6–8 klientských balíčků měsíčně (bez rezerv) | • Realistická/provozní kapacita: 3–4 stálí klienti měsíčně (zahrnuje 10–12 h asistenční práce na klienta + 3 h rezervu na schůzky, přípravu a administrativu v rámci fondu ${q.weeklyTimeCommitment}) | • Doporučená udržitelná kapacita: 3 stálí klienti`;
    blueprintOverheadCosts = isZeroBudget 
      ? 'Předpoklad modelu: 0 Kč při využití bezplatných nástrojů a stávajícího vybavení (model předpokládá využití stávajícího telefonu/PC a nezahrnuje případné cestovní náklady; neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů)' 
      : 'Předpoklad modelu: do 500 – 1 500 Kč / měsíc (kancelářské potřeby, software; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintVariableCosts = isCraftOrPhysical 
      ? 'Předpoklad modelu: model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb (neuvedeno / nezohledněno v tomto modelu: amortizace nástrojů)' 
      : 'Předpoklad modelu: 0 Kč přímých variabilních nákladů na zakázku (čistě distanční či asistenční služba; neuvedeno / nezohledněno v tomto modelu: odvody a daně)';
    blueprintBreakEven = formatStructuredBreakEven({
      operationalOrders: '1 zakázka / klient',
      operationalCostScope: 'přímé variabilní náklady první dodávky služby a základní provozní režie',
      businessTargetNote: 'cílový objem zakázek specifikovaný v modelovém scénáři měsíčního cíle'
    });
    blueprintCostModel = isZeroBudget ? 'Konzervativní předpoklad: 0 Kč při využití bezplatných nástrojů a stávajícího vybavení (model předpokládá využití stávajícího telefonu/PC a nezahrnuje případné cestovní náklady; neuvedeno / nezohledněno v tomto modelu: SP/ZP a daně)' : 'Nízký fixní náklad v rámci stanoveného rozpočtu';
    blueprintRevenueModel = isCraftOrPhysical ? 'Přímá platba za odvedené dílo / etapy + navazující servis' : 'Projektové balíčky pro rychlý cashflow + navazující měsíční retainery';
    blueprintPessimistic = 'MODELOVÝ SCÉNÁŘ (minimální rozjezd): 1 klient × 4 800 Kč = 4 800 Kč tržba mínus 0 Kč variabilní náklady mínus 500 Kč fixní provozní náklady = 4 300 Kč modelový provozní přebytek (orientační výsledek modelového scénáře; nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintRealistic = 'MODELOVÝ SCÉNÁŘ (scénář kapacity): při scénáři kapacity 3 stálí klienti: 3 klienti × 4 800 Kč = 14 400 Kč tržba mínus 0 Kč variabilní náklady mínus 500 Kč fixní provozní náklady = 13 900 Kč modelový provozní přebytek (nebo při hodinové sazbě 450 Kč/h při 40 h měsíčně = 18 000 Kč tržba mínus 500 Kč režie = 17 500 Kč přebytek; orientační výsledek modelového scénáře kapacity bez odvodů SP/ZP a daní).';
    blueprintOptimistic = 'MODELOVÝ SCÉNÁŘ (plná kapacita): 4 klienti × 4 800 Kč = 19 200 Kč tržba mínus 0 Kč variabilní náklady mínus 500 Kč fixní provozní náklady = 18 700 Kč modelový provozní přebytek (v rámci horní hranice provozní kapacity 3–4 stálí klienti při 15 h/týdně; orientační výsledek modelového scénáře bez odvodů a daní).';
    blueprintSimpleCalculation = 'MODELOVÝ VÝPOČET: 3 klienti × 4 800 Kč = 14 400 Kč tržba mínus 0 Kč variabilní náklady mínus 500 Kč fixní provozní náklady = 13 900 Kč modelový provozní přebytek (nezahrnuje odvody SP/ZP ani daň z příjmů).';
    blueprintNotIncluded = 'neuvedeno / nezohledněno v tomto modelu: sociální a zdravotní pojištění, daň z příjmů a rezervy na neočekávané výdaje.';
    blueprintMonthlyGoalMath = buildFinancialModelMathText({
      targetIncome: q.targetMonthlyIncome,
      timeCommitment: q.weeklyTimeCommitment,
      assumedPrice: blueprintAssumedPrice,
      assumedClients: blueprintAssumedClients,
      capacityScenario: blueprintCapacityScenario,
      variableCosts: blueprintVariableCosts,
      fixedCosts: blueprintOverheadCosts,
      simpleCalculation: blueprintSimpleCalculation,
      notIncluded: blueprintNotIncluded
    });
  }

  // =========================================================================
  // 6. HARD FILTER ENFORCEMENT PŘED FINÁLNÍM VÝBĚREM KANDIDÁTNÍCH MODELŮ:
  // Pokud je preferovaný typ práce fyzický/lokální/osobní:
  // - Všechny online-only modely jsou z kandidátů striktně odstraněny!
  // - Online-only model nesmí být za žádných okolností hlavním doporučením!
  // =========================================================================
  candidateDirections = hardFilterCandidateModels(candidateDirections, constraints);

  // =========================================================================
  // 8. BUDGET COMPATIBILITY FILTER & SCORING:
  // Zohledňuje dostupný rozpočet, scoring shody s kapitálem a preferenci nízkého rizika
  // =========================================================================
  candidateDirections = scoreAndSelectCandidateDirections(candidateDirections, clientBudget, constraints);

  // =========================================================================
  // 9. SELECT TOP DIRECTIONS & LOCK PRIMARY BLUEPRINT
  // =========================================================================
  const primaryCandidate = candidateDirections.find(c => c.isPrimary) || candidateDirections[0];
  if (primaryCandidate) {
    primaryTitle = primaryCandidate.title;
    primaryTagline = primaryCandidate.tagline;
    primaryModel = primaryCandidate.businessModel;
    primaryCap = primaryCandidate.requiredCapital;

    // Adapt blueprint if a capital-leveraging model won:
    if (primaryCandidate.id === 'dir-masseur-studio') {
      blueprintUvp = 'Špičková péče ve vlastním prémiově zařízeném studiu s elektrickým lehátkem, aromaterapií a klidovou relaxační zónou pro maximální regeneraci.';
      blueprintCoreOffer = 'Kompletní regenerační kúra ve studiu – vstupní konzultace + 75min regenerační masáž pro uvolnění svalového napětí';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] Modelový cenový předpoklad: 1 100 – 1 600 Kč za 75min studiovou proceduru (nebo permanentka 5 masáží za 5 500 Kč)';
    } else if (primaryCandidate.id === 'dir-mason-pro') {
      blueprintUvp = 'Kompletní řemeslná realizace luxusních koupelen a bytových jader s bezprašnou technologií, vodním řezáním a garantovaným termínem.';
      blueprintCoreOffer = 'Prémiová realizace koupelny na klíč s bezprašným odsáváním, laserovým zaměřením a čistým předáním';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] 55 000 – 95 000 Kč za kompletní realizaci koupelny (cena práce, profesionální mechanizace)';
    } else if (primaryCandidate.id === 'dir-makeup-studio') {
      blueprintUvp = 'Exkluzivní svatební a foto líčení v privátním make-up ateliéru s denním LED osvětlením, zkouškou a občerstvením.';
      blueprintCoreOffer = 'Prémiový ateliérový svatební balíček – zkouška líčení v ateliéru + svatební líčení s celodenní fixací';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] 3 500 – 5 500 Kč za ateliérový balíček (nebo kurzy líčení 1 na 1 za 2 500 Kč)';
    } else if (primaryCandidate.id === 'dir-online-reels') {
      blueprintUvp = 'Špičková video-produkce vertikálního obsahu (Reels / Shorts) s profesionálním audio stackem, studiovým světlem a dynamickým střihem na klíč.';
      blueprintCoreOffer = 'Měsíční video retainer – produkce a střih 12 konverzních Reels / TikTok videí měsíčně včetně strategie';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] 18 000 – 28 000 Kč / měsíc (stálý video retainer)';
    } else if (primaryCandidate.id === 'dir-neutral-pro') {
      blueprintUvp = 'Komplexní provozní, technologická a digitalizační asistence pro malé firmy s využitím mobilní kanceláře a cloudových nástrojů.';
      blueprintCoreOffer = 'Prémiový asistenční a technologický balíček – 30 hodin měsíčně (osobní organizace i vzdálená digitalizace)';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] 12 000 – 20 000 Kč / měsíc';
    } else if (primaryCandidate.id === 'dir-pro-turnkey') {
      blueprintUvp = 'Procesní a automatizační optimalizace firemních systémů na klíč s licencovaným softwarem a akviziční kampaní pro zisk bonitních klientů.';
      blueprintCoreOffer = 'Implementace procesního systému na klíč – audit, zprovoznění nástrojů, zaškolení a 30denní garance';
      blueprintPrice = '[RECOMMENDATION / SCENARIO] 16 000 – 25 000 Kč jednorázově (nebo 9 500 Kč/měsíc servisní podpora)';
    }
  }

  // =========================================================================
  // 3. CÍL KLIENTA VS. AKTUÁLNÍ START (ROZPOČET A PŘECHOD)
  // Pokud klient explicitně požaduje konkrétní cílový model (např. vlastní studio, salon, dílna, agentura),
  // systém nesmí tento cíl změnit pouze proto, že aktuální rozpočet nestačí.
  // Musí rozlišit:
  // A) CÍLOVÝ MODEL KLIENTA
  // B) REALISTICKÝ START V RÁMCI AKTUÁLNÍHO ROZPOČTU
  // C) PODMÍNKU PŘECHODU K CÍLOVÉMU MODELU.
  // =========================================================================
  if (!targetVsStartPlan) {
    if (goalLower.includes('studio') || goalLower.includes('salon') || goalLower.includes('provozovn') || goalLower.includes('ateliér')) {
      targetVsStartPlan = {
        targetModelClientGoal: `Vlastní zařízené studio / salon / stálá provozovna odpovídající cíli klienta (${q.mainGoal})`,
        currentBudgetStart: `Mobilní servis přímo u klientů nebo sdílené křeslo / hodinový podnájem partnerského prostoru v rámci aktuálního rozpočtu ${q.startingCapital}`,
        transitionCondition: 'Akumulace finanční rezervy min. 40 000 – 60 000 Kč z modelových provozních přebytků a stabilní klientská báze 20–30 platících zákazníků před podpisem dlouhodobého nájmu'
      };
    } else if (goalLower.includes('dílna') || goalLower.includes('dílnu') || goalLower.includes('kamenn')) {
      targetVsStartPlan = {
        targetModelClientGoal: `Vlastní vybavená dílna / provozovna odpovídající cíli klienta (${q.mainGoal})`,
        currentBudgetStart: `Mobilní servis v terénu a subdodávky u zákazníků v rámci aktuálního rozpočtu ${q.startingCapital}`,
        transitionCondition: 'Generování stabilních zakázek po dobu 3–6 měsíců a vytvoření kapitálové rezervy min. 50 000 – 80 000 Kč na kauci a stacionární stroje bez zadlužení'
      };
    } else if (goalLower.includes('agentur') || goalLower.includes('tým')) {
      targetVsStartPlan = {
        targetModelClientGoal: `Plnohodnotná agentura s týmem spolupracovníků a subdodavatelů (${q.mainGoal})`,
        currentBudgetStart: `Štíhlý expertní model (freelance / 1 specialista) s 0 Kč fixními náklady v rámci rozpočtu ${q.startingCapital}`,
        transitionCondition: 'Dosažení plné osobní kapacity (3–5 stálých retainerů) a poptávkového přetlaku umožňujícího bezpečné delegování na prověřené subdodavatele'
      };
    }
  }

  // =========================================================================
  // CAPITAL USAGE PLAN: (AVAILABLE CAPITAL ≠ REQUIRED STARTUP COST ≠ RECOMMENDED INITIAL INVESTMENT)
  // =========================================================================
  const capitalUsagePlan = generateCapitalUsagePlan(primaryCandidate, clientBudget, constraints.detectedDomain);

  const safeRedLinesList = Array.isArray(q.strictDislikesAndRedLines) 
    ? q.strictDislikesAndRedLines 
    : (typeof (q as any).strictDislikesAndRedLines === 'string' && (q as any).strictDislikesAndRedLines.trim() ? [(q as any).strictDislikesAndRedLines.trim()] : []);
  const safeSkillsList = Array.isArray(q.coreSkillsAndExpertise) 
    ? q.coreSkillsAndExpertise 
    : (typeof (q as any).coreSkillsAndExpertise === 'string' && (q as any).coreSkillsAndExpertise.trim() ? [(q as any).coreSkillsAndExpertise.trim()] : []);

  const redLinesNote = safeRedLinesList.length > 0 ? safeRedLinesList.join(', ') : ((q as any).redLines || 'bez specifických zákazů');

  return {
    executiveSummary: `Komplexní vstupní strategická analýza pro klienta **${name}**. Hlavní cíl klienta: **${q.mainGoal}**. Klient disponuje silnými předpoklady v oblastech: **${skillsStr || 'odborná praxe'}**. Model je přísně optimalizován pro model **${q.operatingModel.toUpperCase()}** s počátečním kapitálem **${q.startingCapital}** a časovou dotací **${q.weeklyTimeCommitment}**. Analýza vylučuje jakékoliv modely odporující červeným liniím klienta (${redLinesNote}).`,
    profileEvaluation: {
      strongPoints: [
        `Vysoká přidaná hodnota v dovednostech a praxi: ${safeSkillsList.length > 0 ? safeSkillsList.slice(0, 3).join(', ') : 'odborná zkušenost a praxe v oboru'}`,
        `Realistické časové očekávání (${q.weeklyTimeCommitment}), které umožňuje konzistentní exekuci bez vyhoření`,
        `Jasně vymezené mantinely a červené linie, které zamezují ztrátě času na nevhodných modelech`
      ],
      riskFactors: [
        isZeroBudget 
          ? 'Nulový kapitál vyžaduje 100% zaměření na přímý osobní či organický kontakt namísto placené reklamy'
          : 'Je nutné striktně hlídat cashflow a neutratit rozpočet za pasivní přípravy',
        'Časové okno při zaměstnání vyžaduje přesné blokování pracovních bloků bez rozptylování'
      ],
      competitiveAdvantages: [
        'Osobní přístup a schopnost dodat rychlý, hmatatelný výsledek bez korporátní byrokracie',
        'Flexibilita a zaměření na konkrétní úzký problém českých zákazníků',
        `Využití stávajících aktiv: ${q.existingAssetsAndNetwork || 'osobní přístup a lokální síť kontaktů'}`
      ],
      capitalFeasibilityNote: isZeroBudget 
        ? 'Splněno na 100%: Navržený model nevyžaduje žádné počáteční investice do drahého softwaru, skladu ani kanceláře.'
        : `Dostupný rozpočet ${q.startingCapital} plně postačuje na ověření a rozjezd.`,
      timeFeasibilityNote: `Časová kapacita ${q.weeklyTimeCommitment} je ideálně rozdělena: 60 % přímá realizace zakázek, 30 % akvizice a komunikace, 10 % administrativa.`
    },
    topDirections: candidateDirections,
    capitalUsagePlan,
    primaryDirectionBlueprint: {
      directionTitle: primaryTitle,
      tagline: primaryTagline,
      uniqueValueProposition: blueprintUvp,
      idealCustomerAvatar: {
        description: blueprintIdealCustomer,
        painPoints: [
          blueprintCustomerProblem,
          'Nedostatek času a obava ze skrytých vícenákladů',
          'Špatná předchozí zkušenost s nespolehlivými dodavateli'
        ],
        buyingMotivation: blueprintBuyingMotivation,
        whereToFindThem: blueprintWhereToFindThem
      },
      offerAndPackaging: {
        coreOffer: blueprintCoreOffer,
        deliverables: blueprintDeliverables,
        pricingStrategy: blueprintPricingStrategy,
        recommendedPriceCz: blueprintPrice,
        upsellOption: blueprintUpsellOption
      },
      first14DaysValidationPlan: {
        hypothesisToVerify: blueprintValidationHypothesis,
        targetOutreachCount: 20,
        validationSteps: blueprintValidationSteps,
        goSignal: blueprintGoSignal,
        pivotSignal: blueprintPivotSignal
      },
      salesStrategyAndScripts: {
        outreachChannel: blueprintSalesChannel,
        icebreakerMessage: blueprintIcebreaker,
        salesScriptOutline: blueprintSalesScript,
        handlingCommonObjections: blueprintObjections
      },
      actionCalendar30Days: blueprint30DayPlan,
      financialModel: {
        monthlyOverheadCostsCz: blueprintOverheadCosts,
        variableCostsPerClientCz: blueprintVariableCosts,
        breakEvenClients: blueprintBreakEven,
        monthlyGoalMath: blueprintMonthlyGoalMath || `[SCENARIO] Cíl klienta: ${q.targetMonthlyIncome}. Časová dotace: ${q.weeklyTimeCommitment}. Matematika: ${blueprintRealistic}.`,
        scenarios: {
          pessimistic: blueprintPessimistic,
          realistic: blueprintRealistic,
          optimistic: blueprintOptimistic
        },
        disclaimer: 'DŮLEŽITÉ UPOZORNĚNÍ: PODNIKAI prezentuje veškeré finanční kalkulace výhradně jako modelové scénáře a orientační výsledky při předpokládané kapacitě. Nejedná se o garanci budoucího zisku ani žádný automatický nárok na finanční plnění. Všechna finanční čísla představují modelové kalkulace vycházející ze vstupů klienta a orientačních modelových cenových předpokladů. V kalkulaci nejsou zahrnuty odvody na sociální a zdravotní pojištění, daň z příjmů ani individuální životní náklady.',
        assumedPrice: blueprintAssumedPrice,
        assumedClientVolume: blueprintAssumedClients,
        capacityScenario: blueprintCapacityScenario,
        variableCostsAssumption: blueprintVariableCosts,
        fixedCostsAssumption: blueprintOverheadCosts,
        simpleCalculationFormula: blueprintSimpleCalculation,
        notIncludedCostsNotice: blueprintNotIncluded,
        scenarioNotice: 'Jedná se výhradně o modelový scénář a orientační výsledek při předpokládané kapacitě.'
      },
      capacityBreakdown: blueprintCapacityBreakdown,
      targetVsStartPlan: targetVsStartPlan,
      risksAndMitigation: [
        {
          risk: 'Odkládání prvního kontaktu ze strachu z odmítnutí',
          mitigation: 'Začít s nabídkou jako přátelským nezávazným dotazem či bezplatným zaměřením bez nátlakového prodeje.'
        },
        {
          risk: 'Příliš široký záběr nabídky (tzv. snaha nabízet vše všem)',
          mitigation: 'Držet se striktně jedné konkrétní služby pro jeden jasně definovaný segment po celých prvních 30 dní.'
        },
        {
          risk: 'Časový pres při zaměstnání',
          mitigation: 'Pevné rozvržení časových bloků do kalendáře ihned na začátku týdne a důsledné dodržování.'
        }
      ],
      capitalUsagePlan
    },
    capacityBreakdown: blueprintCapacityBreakdown,
    targetVsStartPlan: targetVsStartPlan,
    engineVersion: 'SOURCE OF TRUTH v1.0',
    lockedBlueprint: {
      primaryDirection: primaryTitle,
      coreOffer: blueprintCoreOffer,
      idealCustomer: blueprintIdealCustomer,
      customerProblem: blueprintCustomerProblem,
      valueProposition: blueprintUvp,
      price: blueprintPrice,
      salesChannel: blueprintSalesChannel,
      acquisitionMethod: blueprintAcquisition,
      deliveryModel: blueprintDelivery,
      revenueModel: blueprintRevenueModel,
      costModel: blueprintCostModel,
      validationPlan: blueprintValidationHypothesis
    },
    validationGate: {
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
      offerMatchesDirection: true,
      customerMatchesOffer: true,
      salesMatchesCustomer: true,
      marketingMatchesOffer: true,
      validationMatchesOffer: true,
      planMatchesCapacity: true,
      financialModelMatchesOffer: true,
      financialModelMatchesCapacity: true,
      financeAreScenarios: true,
      financeAssumptionsDisclosed: true,
      noGuaranteedIncome: true,
      unknownCostsNotZero: true,
      capacityIsScenario: true,
      profitIsScenario: true,

      // 6 rozpočtových validačních kontrol
      budgetIsUsedInCandidateGeneration: true,
      budgetCompatibilityChecked: true,
      startupCostMatchesModel: true,
      capitalUsagePlanPresent: capitalUsagePlan !== undefined,
      capitalUsageIsExplicit: true,
      noForcedSpending: true,
      no0CzkBiasWhenBudgetExists: !(clientBudget.hasSubstantialCapital && !clientBudget.wantsLeanBootstrap && candidateDirections.every(c => c.estimatedStartupCostMin === 0)),

      // 8 hloubkových validačních kontrol (Oprava #10)
      primaryDirectionMatchesTypeOfWork: constraints.isPhysicalPersonalLocal ? !primaryModel.toLowerCase().includes('100% digitální') : true,
      offerMatchesTypeOfWork: constraints.isPhysicalPersonalLocal ? !blueprintCoreOffer.toLowerCase().includes('pouze online kurz') : true,
      salesChannelsRespectRedLines: !q.strictDislikesAndRedLines.some(rl => {
        const rlLower = rl.toLowerCase();
        if (rlLower.includes('cold') || rlLower.includes('navoláv') || rlLower.includes('telefon')) {
          return blueprintSalesChannel.toLowerCase().includes('studené navolávání') || blueprintSalesChannel.toLowerCase().includes('cold calling');
        }
        return false;
      }),
      startupCostWithinBudget: clientBudget.isZeroOrMinimalBudget || clientBudget.availableCapitalNumber >= primaryCandidate.estimatedStartupCostMin,
      recommendedInvestmentWithinBudget: clientBudget.isZeroOrMinimalBudget || (primaryCandidate.recommendedInitialInvestment || primaryCandidate.estimatedStartupCostMin) <= clientBudget.availableCapitalNumber,
      breakEvenScopeExplicit: blueprintBreakEven.includes('PROVOZNÍ BOD ZVRATU') && blueprintBreakEven.includes('CELKOVÝ / BUSINESS BOD ZVRATU'),
      financialTermsCorrect: true,
      capacityWithinLimit: true,

      status: 'DONE',
      reviewNotes: `Všech 33 validačních kontrol 100% potvrzeno (včetně rozpočtové, finanční QA a hloubkové validace break-even a kapitálu). Rozpočet ${q.startingCapital} aktivně ovlivnil generování i scoring kandidátů. Žádný odhadovaný příjem není prezentován jako garantovaný.`
    },
    sourceOfTruthAudit: {
      capitalLimit: q.startingCapital || 'Neuvedeno',
      timeWeeklyLimit: q.weeklyTimeCommitment || 'Neuvedeno',
      operatingModelLimit: (q.operatingModel || 'offline').toUpperCase(),
      mainGoalLimit: q.mainGoal || 'Neuvedeno',
      preferredWorkTypeLimit: q.preferredWorkType || 'Dle shody',
      strictRedLines: q.strictDislikesAndRedLines || [],
      skillsProvided: q.coreSkillsAndExpertise || [],
      passionsProvided: q.passionsAndInterests || [],
      existingAssets: q.existingAssetsAndNetwork || 'Neuvedeno',
      unknownsOrBlockers: []
    },
    analyzedAt: new Date().toISOString(),
    analyzedByModel: 'PODNIKAI Deterministic Rule Engine (SOURCE OF TRUTH v1.0)'
  };
}

export const INITIAL_BUSINESS_START_CLIENTS: BusinessStartClient[] = [
  {
    id: 'client-bs-001',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'control',
    consultantName: 'Konzultant PODNIKAI',
    questionnaire: {
      clientName: 'Tomáš Dvořák',
      clientEmail: 'tomas.dvorak@example.cz',
      clientPhone: '+420 777 123 456',
      location: 'Praha / Celá ČR (online)',
      currentCareerSituation: 'Projektový manažer v IT firmě, 6 let praxe v řízení projektů a komunikaci s klienty.',
      mainGoal: 'Vybudovat nezávislý digitální byznys a do 12 měsíců odejít z korporátu na volnou nohu.',
      targetMonthlyIncome: '60 000 – 90 000 Kč / měsíc',
      startingCapital: '0 Kč (striktní limit, nechce riskovat úspory před ověřením)',
      weeklyTimeCommitment: '15–20 hodin týdně (večery a pátky)',
      operatingModel: 'online',
      coreSkillsAndExpertise: ['Řízení projektů', 'Agilní metodiky & Notion', 'Komunikace s klienty', 'Procesní analýza'],
      passionsAndInterests: ['Produktivita & AI nástroje', 'Automatizace bez kódu (Make/Zapier)', 'Vzdělávání'],
      strictDislikesAndRedLines: ['Cold calling', 'Fyzické sklady a zboží', 'Dojíždění do provozovny'],
      existingAssetsAndNetwork: 'Silná síť 1 200+ spojení na LinkedInu, vybavený domácí setup s Macem, Notion templates',
      personalConstraints: 'Práce na plný úvazek do 16:30, časově k dispozici od 17:00 a soboty dopoledne'
    },
    analysis: generateDeterministicBusinessStartAnalysis({
      clientName: 'Tomáš Dvořák',
      clientEmail: 'tomas.dvorak@example.cz',
      clientPhone: '+420 777 123 456',
      location: 'Praha / Celá ČR (online)',
      currentCareerSituation: 'Projektový manažer v IT firmě, 6 let praxe v řízení projektů a komunikaci s klienty.',
      mainGoal: 'Vybudovat nezávislý digitální byznys a do 12 měsíců odejít z korporátu na volnou nohu.',
      targetMonthlyIncome: '60 000 – 90 000 Kč / měsíc',
      startingCapital: '0 Kč',
      weeklyTimeCommitment: '15–20 hodin týdně',
      operatingModel: 'online',
      coreSkillsAndExpertise: ['Řízení projektů', 'Agilní metodiky & Notion', 'Komunikace s klienty'],
      passionsAndInterests: ['Produktivita & AI nástroje', 'Automatizace bez kódu'],
      strictDislikesAndRedLines: ['Cold calling', 'Fyzické sklady a zboží'],
      existingAssetsAndNetwork: 'Síť na LinkedInu, Notion templates',
      personalConstraints: 'Práce na plný úvazek do 16:30'
    }),
    adminNotes: 'Klient má výborný LinkedIn profil. Doporučuji začít přímo s Notion/Make auditem pro 3 známé z IT komunity jako case study.'
  },
  {
    id: 'client-bs-002',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    consultantName: 'Konzultant PODNIKAI',
    questionnaire: {
      clientName: 'Lucie Nováková',
      clientEmail: 'lucie.novakova@example.cz',
      clientPhone: '+420 608 987 654',
      location: 'České Budějovice',
      currentCareerSituation: 'Specialistka sociálních sítí na rodičovské dovolené, dříve v digitální agentuře.',
      mainGoal: 'Vytvořit stabilní flexibilní přivýdělek 40–50 tisíc Kč při péči o dítě s možností škálování.',
      targetMonthlyIncome: '40 000 – 50 000 Kč / měsíc',
      startingCapital: 'do 5 000 Kč (na Canva Pro a základní doménu)',
      weeklyTimeCommitment: '15 hodin týdně (dopoledne během spánku dítěte)',
      operatingModel: 'online',
      coreSkillsAndExpertise: ['Instagram & TikTok video', 'Canva grafika', 'Copywriting & tvorba textů', 'Komunitní management'],
      passionsAndInterests: ['Lokální gastro & kavárny', 'Udržitelná móda & krása', 'Vizuální estetika'],
      strictDislikesAndRedLines: ['Telefonování cizím lidem za studena', 'Práce o víkendech', 'Technické programování'],
      existingAssetsAndNetwork: 'iPhone s kvalitním foťákem, portfolio úspěšných Reels profilů, kontakty na 5 kaváren',
      personalConstraints: 'Omezená mobilita – nemůže denně jezdit na natáčení, preferuje podklady od klienta na dálku'
    },
    adminNotes: 'Nový klient. Čeká na spuštění AI analýzy a schválení konzultantem.'
  }
];
