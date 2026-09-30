import {
  BusinessStartQuestionnaire,
  BusinessStartDirectionCandidate,
  BusinessStartCapitalUsagePlan,
  CapitalUsageBreakdownItem,
  StartupCostLevel,
  CapitalIntensity,
  BudgetCompatibilityLevel
} from '../types';
import { ClientHardConstraints, ClientDomain } from './businessStartCandidateFilter';

export type BudgetTier =
  | 'tier_0_5k'      // 0–5 000 Kč
  | 'tier_5_20k'     // 5 000–20 000 Kč
  | 'tier_20_50k'    // 20 000–50 000 Kč
  | 'tier_50_100k'   // 50 000–100 000 Kč
  | 'tier_100k_plus';// 100 000 Kč+

export interface ClientBudgetProfile {
  rawStartingCapital: string;
  availableCapitalNumber: number;
  budgetTier: BudgetTier;
  isZeroOrMinimalBudget: boolean; // <= 5 000 Kč
  hasSubstantialCapital: boolean; // >= 50 000 Kč
  wantsLeanBootstrap: boolean;    // preference minimálního utrácení
  tierDescription: string;
}

/**
 * 5. AVAILABLE CAPITAL / STARTING BUDGET PARSER
 * Parses starting capital into numeric amount, determines tier (0-5k, 5-20k, 20-50k, 50-100k, 100k+)
 * and detects whether the client explicitly demands a lean/bootstrap approach.
 */
export function parseClientBudget(q: BusinessStartQuestionnaire): ClientBudgetProfile {
  const raw = (q.startingCapital || '').trim();
  const rawLower = raw.toLowerCase();

  // Check if client explicitly expresses desire to start lean despite having budget
  const contextText = [
    rawLower,
    q.mainGoal || '',
    q.personalConstraints || '',
    q.customPreferredWorkType || '',
    (q.strictDislikesAndRedLines || []).join(' ')
  ].join(' ').toLowerCase();

  const wantsLeanBootstrap =
    contextText.includes('minimální investic') ||
    contextText.includes('minimální riziko') ||
    contextText.includes('nízké riziko') ||
    contextText.includes('nechci utrácet') ||
    contextText.includes('nechci moc investovat') ||
    contextText.includes('nechci moc utrácet') ||
    contextText.includes('začít nízkonákladov') ||
    contextText.includes('bez zbytečných výdajů') ||
    contextText.includes('bootstrap') ||
    contextText.includes('co nejméně peněz') ||
    contextText.includes('s nulovými náklady') ||
    contextText.includes('nechci riskovat úspory') ||
    contextText.includes('nechci riskovat peníze') ||
    contextText.includes('neriskovat úspory');

  // Robust numeric extraction
  let availableCapitalNumber = 0;
  const cleanStr = raw.replace(/\s+/g, '').replace(/(\d+)[.,](\d{3})/g, '$1$2');

  const isExplicitZeroOnly =
    /^(0|nula|žádný|žádné|nemám|nic)(kč|czk|\.-)?$/i.test(cleanStr) ||
    cleanStr === '0' ||
    cleanStr === '0kč';

  if (!isExplicitZeroOnly) {
    const numMatches = cleanStr.match(/\d+/g);
    if (numMatches && numMatches.length > 0) {
      const numbers = numMatches.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      if (cleanStr.startsWith('0-') || cleanStr.startsWith('0–')) {
        availableCapitalNumber = numbers.find(n => n > 0) || 0;
      } else {
        const nonZeros = numbers.filter(n => n > 0);
        availableCapitalNumber = nonZeros.length > 0 ? nonZeros[0] : 0;
      }
    }
  }

  // Determine Budget Tier
  let budgetTier: BudgetTier = 'tier_0_5k';
  let tierDescription = '0–5 000 Kč (minimální / nulový kapitál)';

  if (availableCapitalNumber > 100000 || (availableCapitalNumber === 100000 && rawLower.includes('+'))) {
    budgetTier = 'tier_100k_plus';
    tierDescription = '100 000 Kč+ (vysoký rozpočet pro komplexní vstup)';
  } else if (availableCapitalNumber >= 50000) {
    budgetTier = 'tier_50_100k';
    tierDescription = '50 000–100 000 Kč (významný rozpočet s možností investice do kvality)';
  } else if (availableCapitalNumber >= 20000) {
    budgetTier = 'tier_20_50k';
    tierDescription = '20 000–50 000 Kč (střední rozpočet pro profesionální výbavu)';
  } else if (availableCapitalNumber > 5000) {
    budgetTier = 'tier_5_20k';
    tierDescription = '5 000–20 000 Kč (nízký rozpočet pro základní vybavení)';
  } else {
    budgetTier = 'tier_0_5k';
    tierDescription = '0–5 000 Kč (minimální rozpočet, lean start)';
  }

  return {
    rawStartingCapital: raw || '0 Kč',
    availableCapitalNumber,
    budgetTier,
    isZeroOrMinimalBudget: availableCapitalNumber <= 5000,
    hasSubstantialCapital: availableCapitalNumber >= 50000,
    wantsLeanBootstrap,
    tierDescription
  };
}

/**
 * 8. BUDGET COMPATIBILITY FILTER & SCORING
 * Computes compatibility score, level, and detailed reasoning for each candidate direction.
 */
export function evaluateCandidateBudgetCompatibility(
  candidate: BusinessStartDirectionCandidate,
  budget: ClientBudgetProfile
): {
  level: BudgetCompatibilityLevel;
  score: number;
  reason: string;
} {
  const available = budget.availableCapitalNumber;
  const costMin = candidate.estimatedStartupCostMin;
  const costMax = candidate.estimatedStartupCostMax;

  // Case 1: Client has zero or minimal budget (0 - 5 000 Kč)
  if (budget.isZeroOrMinimalBudget) {
    if (costMin <= available) {
      // Model is fully executable with current minimal capital
      return {
        level: 'high',
        score: 95 - (costMin / 5000) * 10,
        reason: `Model je 100% spustitelný s minimálním kapitálem (požadováno ${costMin.toLocaleString('cs-CZ')} Kč při dostupných ${available.toLocaleString('cs-CZ')} Kč).`
      };
    } else if (costMin <= 15000) {
      // Slight gap, can be bootstrapped or phased
      return {
        level: 'medium',
        score: 65,
        reason: `Model vyžaduje cca ${costMin.toLocaleString('cs-CZ')} Kč (rozpočet klienta je ${available.toLocaleString('cs-CZ')} Kč), nutno začít s výpůjčkou či stávajícím vybavením.`
      };
    } else {
      // Severe gap: capital-intensive model recommended to a zero-budget client
      return {
        level: 'incompatible',
        score: 20,
        reason: `Model vyžaduje ${costMin.toLocaleString('cs-CZ')} Kč+, což výrazně převyšuje dostupný rozpočet (${available.toLocaleString('cs-CZ')} Kč). Není doporučen bez zajištění financování.`
      };
    }
  }

  // Case 2: Client has substantial capital (50 000 Kč+) BUT explicitly wants lean bootstrap
  if (budget.hasSubstantialCapital && budget.wantsLeanBootstrap) {
    if (costMin <= 10000) {
      return {
        level: 'high',
        score: 98,
        reason: `Klient disponuje rozpočtem ${available.toLocaleString('cs-CZ')} Kč, ale preferuje minimální investici. Model vyžaduje pouze ${costMin.toLocaleString('cs-CZ')} Kč a ponechává 90 %+ v rezervě.`
      };
    } else {
      return {
        level: 'medium',
        score: 60,
        reason: `Model využívá ${costMin.toLocaleString('cs-CZ')} – ${costMax.toLocaleString('cs-CZ')} Kč, což sice rozpočet dovoluje, ale odporuje preferenci klienta začít nízkonákladově.`
      };
    }
  }

  // Case 3: Client has substantial capital (50 000 Kč+) and is open to meaningful capital use
  if (budget.hasSubstantialCapital) {
    if (costMin > available) {
      return {
        level: 'incompatible',
        score: 30,
        reason: `Překračuje i vyšší rozpočet klienta (${costMin.toLocaleString('cs-CZ')} Kč > ${available.toLocaleString('cs-CZ')} Kč).`
      };
    }

    // Model that meaningfully leverages capital (e.g. 12k - available) gets top priority
    if (costMin >= 12000 && costMin <= available) {
      return {
        level: 'high',
        score: 96,
        reason: `Optimální využití kapitálu: Model smysluplně využívá dostupný rozpočet (${costMin.toLocaleString('cs-CZ')} – ${costMax.toLocaleString('cs-CZ')} Kč z dostupných ${available.toLocaleString('cs-CZ')} Kč) na profesionální vybavení a zázemí bez nuceného vyčerpání celé rezervy.`
      };
    }

    if (costMin >= 4000 && costMin < 12000) {
      return {
        level: 'high',
        score: 90,
        reason: `Velmi dobrá kompatibilita: Model vyžaduje umírněný startovní náklad (${costMin.toLocaleString('cs-CZ')} Kč), zbytek rozpočtu slouží jako silný finanční polštář.`
      };
    }

    // 0–4k model is still compatible, but scored slightly lower than a model that leverages capital
    return {
      level: 'high',
      score: 84,
      reason: `Nízkonákladový model (0–${costMax.toLocaleString('cs-CZ')} Kč): Plně kompatibilní, ale nevyužívá konkurenční výhodu plynoucí z dostupného kapitálu ${available.toLocaleString('cs-CZ')} Kč.`
    };
  }

  // Case 4: Mid-range budget (5 000–50 000 Kč)
  if (costMin <= available) {
    const usageRatio = costMin / available;
    const score = usageRatio <= 0.8 ? 92 : 80;
    return {
      level: 'high',
      score,
      reason: `Model plně odpovídá dostupnému kapitálu (${costMin.toLocaleString('cs-CZ')} – ${costMax.toLocaleString('cs-CZ')} Kč z ${available.toLocaleString('cs-CZ')} Kč).`
    };
  } else if (costMin <= available * 1.3) {
    return {
      level: 'medium',
      score: 65,
      reason: `Mírně těsný rozpočet (${costMin.toLocaleString('cs-CZ')} Kč vs ${available.toLocaleString('cs-CZ')} Kč), doporučeno etapové pořízení.`
    };
  } else {
    return {
      level: 'incompatible',
      score: 25,
      reason: `Vyžaduje vyšší kapitál (${costMin.toLocaleString('cs-CZ')} Kč), než je stanovený limit (${available.toLocaleString('cs-CZ')} Kč).`
    };
  }
}

/**
 * 8 & 9. BUDGET COMPATIBILITY SCORING AND DIRECTION SELECTION
 * Enriches candidates with budget metadata, scores them, and sorts them.
 * Sets the highest scoring, fully constraint-compatible model as isPrimary.
 */
export function scoreAndSelectCandidateDirections(
  candidates: BusinessStartDirectionCandidate[],
  budget: ClientBudgetProfile,
  constraints: ClientHardConstraints
): BusinessStartDirectionCandidate[] {
  if (!candidates || candidates.length === 0) return [];

  // 1. Enrich every candidate with budget compatibility metrics & sensible initial investment
  const scored = candidates.map(c => {
    const comp = evaluateCandidateBudgetCompatibility(c, budget);
    let recInv = c.recommendedInitialInvestment;
    if (recInv === undefined || recInv === null) {
      if (budget.availableCapitalNumber === 0) {
        recInv = 0;
      } else if (c.estimatedStartupCostMin <= budget.availableCapitalNumber) {
        recInv = Math.min(
          budget.availableCapitalNumber,
          Math.max(c.estimatedStartupCostMin, Math.round((c.estimatedStartupCostMin + c.estimatedStartupCostMax) / 2))
        );
      } else {
        recInv = c.estimatedStartupCostMin;
      }
    }

    return {
      ...c,
      recommendedInitialInvestment: recInv,
      budgetCompatibility: comp.level,
      budgetScore: comp.score,
      budgetCompatibilityReason: comp.reason
    };
  });

  // 2. Sort candidates:
  // - Incompatible models move down
  // - Candidates with higher budgetScore move up
  scored.sort((a, b) => {
    // If one is incompatible and other is not, non-incompatible wins
    if (a.budgetCompatibility === 'incompatible' && b.budgetCompatibility !== 'incompatible') return 1;
    if (b.budgetCompatibility === 'incompatible' && a.budgetCompatibility !== 'incompatible') return -1;

    // Both compatible: sort by budgetScore descending
    return (b.budgetScore || 50) - (a.budgetScore || 50);
  });

  // 3. Mark the top candidate as isPrimary, rest as false
  scored.forEach((c, idx) => {
    c.isPrimary = idx === 0;
  });

  return scored;
}

/**
 * CAPITAL_USAGE_PLAN GENERATOR
 * Constructs an explicit breakdown for available capital vs required startup cost vs recommended investment.
 * Ensures strict rule: NO FORCED SPENDING.
 * Categories: vybavení, první zásoby, licence/software, branding, web, marketing, rezerva, provozní kapitál.
 */
export function generateCapitalUsagePlan(
  primaryCandidate: BusinessStartDirectionCandidate,
  budget: ClientBudgetProfile,
  domain: ClientDomain
): BusinessStartCapitalUsagePlan {
  const availableNum = budget.availableCapitalNumber;
  const requiredNum = primaryCandidate.estimatedStartupCostMin;
  const recommendedNum = primaryCandidate.recommendedInitialInvestment || Math.min(
    availableNum,
    Math.max(requiredNum, Math.round((primaryCandidate.estimatedStartupCostMax + requiredNum) / 2))
  );

  const unspentNum = Math.max(0, availableNum - recommendedNum);
  const breakdown: CapitalUsageBreakdownItem[] = [];

  // Generate domain-specific authentic breakdown items
  if (domain === 'makeup') {
    breakdown.push({
      category: 'vybavení',
      item: 'Profesionální make-up kufr, ergonomická sada štětců a přenosné denní LED osvětlení',
      estimatedCostCz: `${Math.min(availableNum, Math.max(requiredNum - 2000, 4500)).toLocaleString('cs-CZ')} Kč`,
      priority: 'nutné pro start',
      itemRequirement: 'REQUIRED',
      modelLink: 'Mobilní/studiový beauty servis: základní hygienické a aplikační nástroje',
      rationale: 'Základní pracovní nástroj nezbytný pro bezchybnou hygienu a profesionální dojem u klientek (modelový odhad).'
    });
    breakdown.push({
      category: 'hygiena a spotřební materiál',
      item: 'Prémiová voděodolná kosmetika, fixační spreje, podkladové báze a jednorázové aplikátory',
      estimatedCostCz: `${Math.min(availableNum, 3500).toLocaleString('cs-CZ')} Kč`,
      priority: 'nutné pro start',
      itemRequirement: 'REQUIRED',
      modelLink: 'Svatební a foto líčení: spotřební líčidla na první zakázky',
      rationale: 'Materiál na prvních 15–20 svatebních a společenských líčení s celodenní fixací (modelový předpoklad).'
    });
    if (availableNum >= 20000) {
      breakdown.push({
        category: 'branding',
        item: 'Vizuální identita, logo a tisk reprezentativních vizitek s péčí po líčení',
        estimatedCostCz: '1 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Klientská důvěra nevěst: tištěné vizitky a karty péče',
        rationale: 'Budování prémiového jména pro nevěsty a svatební koordinátorky.'
      });
      breakdown.push({
        category: 'web',
        item: '1stránkové vizuální portfolio proměn před/po na vlastní doméně s ceníkem',
        estimatedCostCz: '2 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Akvizice: online prezentace realizací před/po',
        rationale: 'Klíčové pro budoucí nevěsty hledající ukázky proměn před a po.'
      });
    }
    if (availableNum >= 40000) {
      breakdown.push({
        category: 'marketing',
        item: 'Cílená lokální Instagram/Facebook kampaň na zásnuby v okruhu 30 km',
        estimatedCostCz: '4 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Lokální dosah: oslovení snoubenců v regionu',
        rationale: 'Rychlé naplnění kalendáře na nadcházející svatební sezónu (modelový scénář rozjezdu).'
      });
    }
  } else if (domain === 'masseur') {
    const isStudioModel = primaryCandidate.id === 'dir-masseur-studio' || requiredNum >= 30000;
    
    if (isStudioModel) {
      breakdown.push({
        category: 'vybavení',
        item: 'Stabilní polohovací terapeutické lehátko s nastavitelnou výškou a polohovacím válcem',
        estimatedCostCz: '18 000 Kč',
        priority: 'nutné pro start',
        itemRequirement: 'REQUIRED',
        modelLink: 'Vlastní regenerační studio: klíčové ergonomické pracoviště',
        rationale: 'Základní profesionální vybavení nutné pro spuštění studia bez kompromisů v ergonomii (modelový odhad).'
      });
      breakdown.push({
        category: 'prostor/nájem',
        item: 'Kauce a podíl na nájmu/sdíleném prostoru studia na 1. měsíc',
        estimatedCostCz: '10 000 Kč',
        priority: 'nutné pro start',
        itemRequirement: 'REQUIRED',
        modelLink: 'Vlastní studio: zajištění provozních prostor',
        rationale: 'Počáteční výdaj na zajištění prostor studia před náběhem plateb (modelový předpoklad).'
      });
      breakdown.push({
        category: 'hygiena a spotřební materiál',
        item: 'Přírodní hypoalergenní oleje, prádlový servis, jednorázová prostěradla a hygiena KHS',
        estimatedCostCz: '4 000 Kč',
        priority: 'nutné pro start',
        itemRequirement: 'REQUIRED',
        modelLink: 'Hygienické standardy studia: schválený provoz',
        rationale: 'Základní zásoba materiálu pro hygienický provoz studia na první měsíc (cca 30–40 masáží).'
      });
      if (availableNum >= 35000) {
        breakdown.push({
          category: 'marketing',
          item: 'Lokální propagace a seznámení se studiem (Google Firemní profil, lokální sociální sítě)',
          estimatedCostCz: '3 500 Kč',
          priority: 'doporučené pro zrychlení',
          itemRequirement: 'RECOMMENDED',
          modelLink: 'Akvizice klientů studia: rychlé obsazení prvních termínů',
          rationale: 'Doporučená investice v rámci rozpočtu pro rychlé získání prvních stálých klientů v regionu.'
        });
      }
      if (availableNum >= 40000) {
        breakdown.push({
          category: 'branding',
          item: 'Grafický návrh a tisk permanentek, dárkových poukazů a vizitek',
          estimatedCostCz: '1 500 Kč',
          priority: 'doporučené pro zrychlení',
          itemRequirement: 'RECOMMENDED',
          modelLink: 'Retence stálé klientely: permanentky na 5–10 masáží',
          rationale: 'Podpora prodeje balíčků pro opakované návštěvy stálých klientů a stabilnější cashflow.'
        });
        breakdown.push({
          category: 'vybavení',
          item: 'Ohřívač lávových kamenů a příslušenství pro doplňkové regenerační procedury',
          estimatedCostCz: '4 000 Kč',
          priority: 'doporučené pro zrychlení',
          itemRequirement: 'RECOMMENDED',
          modelLink: 'Doplňkové procedury studia: vyšší hodnota péče',
          rationale: 'Modelový předpoklad: vytváří předpoklad pro rozšíření procedur a vyšší průměrnou hodnotu návštěvy (nikoliv jistý výsledek).'
        });
        breakdown.push({
          category: 'pohotovostní rezerva',
          item: 'Pohotovostní provozní rezerva v rámci investice na krytí drobných výdajů studia',
          estimatedCostCz: '4 000 Kč',
          priority: 'volitelné / rezerva',
          itemRequirement: 'OPTIONAL',
          modelLink: 'Plynulost provozu studia bez výpadků zásob',
          rationale: 'Zajišťuje bezproblémové krytí běžných plateb studia a nečekaných drobných výdajů.'
        });
      }
    } else {
      breakdown.push({
        category: 'vybavení',
        item: 'Stabilní terapeutické lehátko s nastavitelnou výškou, polohovacím válcem a přepravním obalem',
        estimatedCostCz: `${Math.min(availableNum, Math.max(requiredNum - 2500, 6500)).toLocaleString('cs-CZ')} Kč`,
        priority: 'nutné pro start',
        itemRequirement: 'REQUIRED',
        modelLink: 'Mobilní/ambulantní masáže: ergonomické přenosné zázemí',
        rationale: 'Klíčové ergonomické zázemí pro komfort klienta a ochranu páteře maséra (modelový odhad).'
      });
      breakdown.push({
        category: 'hygiena a spotřební materiál',
        item: 'Přírodní hypoalergenní oleje, prádlový servis, jednorázová netkaná prostěradla a dezinfekce',
        estimatedCostCz: `${Math.min(availableNum, 2500).toLocaleString('cs-CZ')} Kč`,
        priority: 'nutné pro start',
        itemRequirement: 'REQUIRED',
        modelLink: 'Mobilní masáže: spotřební hygienický materiál',
        rationale: 'Zásoba pro hygienický provoz na prvních 30–40 masáží.'
      });
      if (availableNum >= 12000) {
        breakdown.push({
          category: 'marketing',
          item: 'Lokální propagace a seznámení se službou (Google Firemní profil, lokální sociální sítě)',
          estimatedCostCz: '1 500 Kč',
          priority: 'doporučené pro zrychlení',
          itemRequirement: 'RECOMMENDED',
          modelLink: 'Lokální dosah: akvizice prvních platících klientů',
          rationale: 'Zajištění prvních stálých platících klientů v regionu.'
        });
        breakdown.push({
          category: 'branding',
          item: 'Grafický návrh a tisk permanentek, dárkových poukazů a vizitek',
          estimatedCostCz: '1 500 Kč',
          priority: 'doporučené pro zrychlení',
          itemRequirement: 'RECOMMENDED',
          modelLink: 'Retence stálé klientely: permanentky',
          rationale: 'Podpora prodeje balíčků pro opakované návštěvy stálých klientů.'
        });
      }
    }
  } else if (domain === 'craft_mason') {
    breakdown.push({
      category: 'vybavení',
      item: 'Přesná řezačka obkladů, digitální laserová vodováha, míchadlo a zednické nářadí',
      estimatedCostCz: `${Math.min(availableNum, Math.max(requiredNum - 3000, 12000)).toLocaleString('cs-CZ')} Kč`,
      priority: 'nutné pro start',
      itemRequirement: 'REQUIRED',
      modelLink: 'Zednické řemeslo: základní montážní a obkladačské nářadí',
      rationale: 'Nezbytné vybavení pro milimetrovou přesnost pokládky a rychlou práci (modelový odhad).'
    });
    breakdown.push({
      category: 'licence/software',
      item: 'Pojištění profesní odpovědnosti za způsobenou škodu při stavebních pracích',
      estimatedCostCz: '3 500 Kč',
      priority: 'doporučené pro zrychlení',
      itemRequirement: 'RECOMMENDED',
      modelLink: 'Důvěra zákazníka: eliminace rizika škody na stavbě',
      rationale: 'Základní jistota pro zákazníky rekonstrukcí rodinných domů a bytových jader.'
    });
    if (availableNum >= 35000) {
      breakdown.push({
        category: 'vybavení',
        item: 'Průmyslový stavební vysavač s oklepem a drážkovačka s odsáváním prachu',
        estimatedCostCz: '9 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Konkurenční výhoda: bezprašná rekonstrukce',
        rationale: 'Zajišťuje bezprašnou čistou práci v obydlených bytech, což je klíčový prodejní argument.'
      });
    }
    if (availableNum >= 40000) {
      breakdown.push({
        category: 'marketing',
        item: 'Lokální letáková a online inzerce pro majitele bytů v rekonstrukci',
        estimatedCostCz: '2 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Akvizice staveb: oslovení v dojezdové vzdálenosti',
        rationale: 'Rychlé oslovení rodin plánujících rekonstrukci v okruhu 25 km.'
      });
    }
    if (availableNum >= 50000) {
      breakdown.push({
        category: 'branding',
        item: 'Označení vozu magnetickým bannerem, pracovní oděv s logem a tištěné vzorové rozpočty',
        estimatedCostCz: '3 000 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Lokální vizibilita řemeslníka přímo na stavbách',
        rationale: 'Okamžitá vizibilita řemeslníka přímo v lokalitě realizovaných staveb.'
      });
    }
  } else if (domain === 'marketing') {
    breakdown.push({
      category: 'licence/software',
      item: 'Roční předplatné profesionálního grafického a plánovacího softwaru (Canva Pro / Scheduler)',
      estimatedCostCz: `${Math.min(availableNum, 3600).toLocaleString('cs-CZ')} Kč`,
      priority: 'doporučené pro zrychlení',
      itemRequirement: 'RECOMMENDED',
      modelLink: 'Online správa: automatizace obsahu pro klienty',
      rationale: 'Efektivní tvorba a automatizovaná distribuce obsahu pro klienty.'
    });
    if (availableNum >= 15000) {
      breakdown.push({
        category: 'vybavení',
        item: 'Kvalitní směrový mikrofon a studiové světlo pro tvorbu video-auditů pro klienty',
        estimatedCostCz: '4 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Akvizice klientů: konverzní video-rozbory',
        rationale: 'Zvyšuje konverzní poměr při zasílání videorozborů na LinkedInu.'
      });
    }
    if (availableNum >= 30000) {
      breakdown.push({
        category: 'web',
        item: 'Prezentační case-study web s ukázkami výsledků a referencemi',
        estimatedCostCz: '3 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Důkaz odbornosti pro B2B decision makery',
        rationale: 'Důkaz odbornosti pro B2B decision makery.'
      });
    }
    if (availableNum >= 40000) {
      breakdown.push({
        category: 'marketing',
        item: 'Testovací akviziční rozpočet na vlastní placenou reklamu a case studies',
        estimatedCostCz: '6 000 Kč',
        priority: 'volitelné / rezerva',
        itemRequirement: 'OPTIONAL',
        modelLink: 'Akcelerace poptávek na měsíční správu',
        rationale: 'Akcelerace přísunu B2B poptávek na měsíční správu.'
      });
    }
  } else {
    // General / Hybrid / Undetermined
    breakdown.push({
      category: 'vybavení',
      item: 'Základní technické a hardwarové vybavení pro spolehlivou koordinaci zakázek',
      estimatedCostCz: `${Math.min(availableNum, Math.max(requiredNum, 2500)).toLocaleString('cs-CZ')} Kč`,
      priority: 'nutné pro start',
      itemRequirement: 'REQUIRED',
      modelLink: 'Provozní koordinace: základní technické zázemí',
      rationale: 'Spolehlivé odbavení organizačních a provozních úkolů pro podnikatele.'
    });
    breakdown.push({
      category: 'licence/software',
      item: 'Licence koordinačních a plánovacích nástrojů pro komunikaci s klienty',
      estimatedCostCz: `${Math.min(availableNum, 2000).toLocaleString('cs-CZ')} Kč`,
      priority: 'doporučené pro zrychlení',
      itemRequirement: 'RECOMMENDED',
      modelLink: 'Efektivita: přehled nad úkoly klientů',
      rationale: 'Zvýšení produktivity a přehledu nad zakázkami.'
    });
    if (availableNum >= 15000) {
      breakdown.push({
        category: 'branding',
        item: 'Prezentační vizitka a katalog služeb v profesionální grafické úpravě',
        estimatedCostCz: '1 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Důvěryhodnost při oslovování malých firem',
        rationale: 'Zvyšuje důvěryhodnost při oslovování malých firem a živnostníků.'
      });
      breakdown.push({
        category: 'web',
        item: 'Jednoduchý 1stránkový web s přehledem nabízených asistenčních a servisních balíčků',
        estimatedCostCz: '2 500 Kč',
        priority: 'doporučené pro zrychlení',
        itemRequirement: 'RECOMMENDED',
        modelLink: 'Online kotva pro reference a doporučení',
        rationale: 'Online kotva pro reference a doporučení.'
      });
    }
  }

  // Enforce mathematical integrity:
  // The items in breakdown represent the allocation of the RECOMMENDED INITIAL INVESTMENT (recommendedNum).
  // The remaining unspentNum is strictly preserved as unspentCapitalReserve (nerozdělená pohotovostní rezerva).
  if (recommendedNum > 0 && breakdown.length > 0) {
    let currentTotal = 0;
    const itemValues: number[] = [];
    for (const b of breakdown) {
      const match = b.estimatedCostCz.replace(/\s+/g, '').match(/(\d+)/);
      const val = match ? parseInt(match[1], 10) : 0;
      itemValues.push(val);
      currentTotal += val;
    }

    const diff = recommendedNum - currentTotal;
    if (diff !== 0) {
      const targetIdx = breakdown.length - 1;
      const adjusted = Math.max(0, itemValues[targetIdx] + diff);
      breakdown[targetIdx].estimatedCostCz = `${adjusted.toLocaleString('cs-CZ')} Kč`;
    }
  }

  const noForcedSpendingNotice = budget.wantsLeanBootstrap
    ? `Klient výslovně preferuje minimální investice. Systém klienta nenutí utratit celý rozpočet a ${((unspentNum / Math.max(1, availableNum)) * 100).toFixed(0)} % rozpočtu zůstává nedotčeno jako finanční rezerva.`
    : `DŮLEŽITÉ PRAVIDLO PODNIKAI (NO_FORCED_SPENDING): Systém klienta nikdy nenutí utratit celý rozpočet. Dostupný kapitál ${availableNum.toLocaleString('cs-CZ')} Kč neznamená povinnost utratit celou částku. Doporučená investice činí ${recommendedNum.toLocaleString('cs-CZ')} Kč a zbývajících ${unspentNum.toLocaleString('cs-CZ')} Kč slouží jako provozní jistota a nedotknutelná rezerva.`;

  const maxCostNum = primaryCandidate.estimatedStartupCostMax;
  const startupScenarios = {
    minimalStart: `${requiredNum.toLocaleString('cs-CZ')} Kč – minimální funkční start (pouze striktně nezbytné položky pro okamžité zahájení činnosti v rámci rozpočtu klienta)`,
    recommendedStart: `${recommendedNum.toLocaleString('cs-CZ')} Kč – doporučená varianta v rámci rozpočtu (zajišťuje vyšší komfort, klientskou retenci a ponechává ${unspentNum.toLocaleString('cs-CZ')} Kč bezpečnou rezervu)`,
    futureUpgradeOrBuffer: maxCostNum > availableNum
      ? `${maxCostNum.toLocaleString('cs-CZ')} Kč – maximální varianta (nad aktuální limit ${availableNum.toLocaleString('cs-CZ')} Kč; doporučeno realizovat až jako budoucí upgrade z vygenerovaného cashflow)`
      : `${maxCostNum.toLocaleString('cs-CZ')} Kč – maximální vybavená varianta v plném rozsahu`
  };

  return {
    availableCapital: `${availableNum.toLocaleString('cs-CZ')} Kč (${budget.rawStartingCapital})`,
    availableCapitalNumber: availableNum,
    requiredStartupCost: `${requiredNum.toLocaleString('cs-CZ')} Kč`,
    requiredStartupCostNumber: requiredNum,
    recommendedInitialInvestment: `${recommendedNum.toLocaleString('cs-CZ')} Kč`,
    recommendedInitialInvestmentNumber: recommendedNum,
    unspentCapitalReserve: `${unspentNum.toLocaleString('cs-CZ')} Kč`,
    unspentCapitalAdvice: unspentNum > 0 && unspentNum <= 10000 && availableNum >= 40000
      ? `Zbývajících ${unspentNum.toLocaleString('cs-CZ')} Kč představuje nerozdělený kapitál / pohotovostní rezervu na bezprostřední drobné výdaje. Pokud klient preferuje bezpečnější rozjezd s vyšším finančním polštářem, lze zvolit minimální variantu startu (${requiredNum.toLocaleString('cs-CZ')} Kč) a ponechat si v rezervě ${(availableNum - requiredNum).toLocaleString('cs-CZ')} Kč až do získání prvních stálých klientů.`
      : `Zbývajících ${unspentNum.toLocaleString('cs-CZ')} Kč doporučujeme ponechat na bankovním účtu jako rezervu. Umožní vám klidný rozjezd bez finančního stresu.`,
    breakdown,
    noForcedSpendingNotice,
    startupScenarios
  };
}
