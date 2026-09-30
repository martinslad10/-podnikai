import {
  generateDeterministicBusinessStartAnalysis,
  createEmptyQuestionnaire
} from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire, BusinessStartAnalysis } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

console.log('================================================================');
console.log('BUSINESS START – DEDICATED FINANCIAL QA TEST SUITE');
console.log('Kontrola 7 finančních pilířů PODNIKAI proti klamavým příslibům');
console.log('================================================================\n');

// 5 Testovacích person
const testPersonas: Array<{ id: string; name: string; q: BusinessStartQuestionnaire }> = [
  {
    id: 'TEST 1',
    name: 'VIZÁŽISTKA (Lokální osobní služba)',
    q: {
      ...createEmptyQuestionnaire(),
      clientName: 'Kateřina Malá',
      mainGoal: 'Chci podnikat jako vizážistka a líčit klientky osobně.',
      preferredWorkType: 'Práce s lidmi osobně',
      customPreferredWorkType: 'osobní práce s lidmi / lokální služba',
      strictDislikesAndRedLines: ['Nechci celý den pracovat na PC', 'Cold calling'],
      startingCapital: 'do 10 000 Kč',
      weeklyTimeCommitment: '20 hodin týdně',
      operatingModel: 'offline',
      coreSkillsAndExpertise: ['Líčení a make-up', 'Péče o pleť', 'Komunikace se zákazníky']
    }
  },
  {
    id: 'TEST 2',
    name: 'MASÉR (Regenerační studio)',
    q: {
      ...createEmptyQuestionnaire(),
      clientName: 'Martin Kovář',
      mainGoal: 'Chci si otevřít vlastní masérské studio.',
      preferredWorkType: 'Vlastní provozovna / studio / dílna',
      customPreferredWorkType: 'osobní práce s lidmi / studio',
      strictDislikesAndRedLines: ['Celodenní sezení u počítače', 'Cold calling'],
      startingCapital: 'do 15 000 Kč',
      weeklyTimeCommitment: '25 hodin týdně',
      operatingModel: 'offline',
      coreSkillsAndExpertise: ['Sportovní masáže', 'Regenerace a rekondice', 'Ergonomie']
    }
  },
  {
    id: 'TEST 3',
    name: 'ZEDNÍK (Fyzické řemeslo v terénu)',
    q: {
      ...createEmptyQuestionnaire(),
      clientName: 'Josef Novák',
      mainGoal: 'Chci podnikat jako zedník a dělat zakázky v regionu.',
      preferredWorkType: 'Fyzická práce / řemeslo / terén',
      customPreferredWorkType: 'fyzická práce / řemeslo / terén',
      strictDislikesAndRedLines: ['Celodenní sezení u počítače', 'Práce v kanceláři'],
      startingCapital: 'do 20 000 Kč',
      weeklyTimeCommitment: '30 hodin týdně',
      operatingModel: 'offline',
      coreSkillsAndExpertise: ['Zednické práce', 'Obklady a dlažby', 'Rekonstrukce bytových jader']
    }
  },
  {
    id: 'TEST 4',
    name: 'ONLINE MARKETÉR (100% online retainer)',
    q: {
      ...createEmptyQuestionnaire(),
      clientName: 'Jan Sýkora',
      mainGoal: 'Chci podnikat v online marketingu.',
      preferredWorkType: '100% práce na počítači / online',
      customPreferredWorkType: '100 % online / PC',
      strictDislikesAndRedLines: ['Fyzická manuální práce', 'Dojíždění do provozovny'],
      startingCapital: '0 Kč',
      weeklyTimeCommitment: '20 hodin týdně',
      operatingModel: 'online',
      coreSkillsAndExpertise: ['Sociální sítě', 'Copywriting', 'Obsahový marketing']
    }
  },
  {
    id: 'TEST 5',
    name: 'NEVYHRANĚNÝ KLIENT (Hybridní asistence)',
    q: {
      ...createEmptyQuestionnaire(),
      clientName: 'Petr Svoboda',
      mainGoal: 'Chci začít podnikat, ale zatím nevím přesně v čem.',
      preferredWorkType: 'Nevím / ještě nemám vyhraněno',
      customPreferredWorkType: 'nevím / ještě nemám vyhraněno',
      strictDislikesAndRedLines: ['Neetické prodejní praktiky', 'Nekalé praktiky'],
      startingCapital: 'do 5 000 Kč',
      weeklyTimeCommitment: '15 hodin týdně',
      operatingModel: 'hybrid',
      coreSkillsAndExpertise: ['Organizace', 'Komunikace', 'Běžná práce na PC i v terénu']
    }
  }
];

let totalChecks = 0;
let passedChecks = 0;

for (const persona of testPersonas) {
  console.log(`--- KONTROLA FINANČNÍHO MODELU: ${persona.id} (${persona.name}) ---`);
  const analysis: BusinessStartAnalysis = generateDeterministicBusinessStartAnalysis(persona.q);
  const p = analysis.primaryDirectionBlueprint;
  const fin = p.financialModel;
  const gate = analysis.validationGate!;

  // 1. FINANCE_ARE_SCENARIOS:
  // Všechny projekce a čísla jsou označeny jako scénář / modelový scénář.
  totalChecks++;
  const mathIsScenario = fin.monthlyGoalMath.includes('MODELOVÝ SCÉNÁŘ') || fin.monthlyGoalMath.includes('scénář');
  const scenariosExist = Boolean(fin.scenarios?.pessimistic && fin.scenarios?.realistic && fin.scenarios?.optimistic);
  const scenariosAreLabeled = (fin.scenarios?.pessimistic || '').includes('SCÉNÁŘ') &&
                             (fin.scenarios?.realistic || '').includes('SCÉNÁŘ') &&
                             (fin.scenarios?.optimistic || '').includes('SCÉNÁŘ');
  const gateFinanceAreScenarios = gate.financeAreScenarios === true;
  assert(
    mathIsScenario && scenariosExist && scenariosAreLabeled && gateFinanceAreScenarios,
    `[FINANCE_ARE_SCENARIOS] Matematika cíle i všechny 3 scénáře jsou explicitně označeny jako modelové scénáře`
  );
  passedChecks++;

  // 2. FINANCE_ASSUMPTIONS_DISCLOSED:
  // Každé finanční číslo má označený vstup od klienta, předpoklad ceny/nákladů a co není zahrnuto.
  totalChecks++;
  const hasClientInput = fin.monthlyGoalMath.includes('Vstup od klienta');
  const hasAssumedPrice = fin.monthlyGoalMath.includes('Předpokládaná cena');
  const hasAssumedVolume = fin.monthlyGoalMath.includes('Předpokládaný počet');
  const hasAssumedCapacity = fin.monthlyGoalMath.includes('Předpokládaná kapacita');
  const hasAssumedCosts = fin.monthlyGoalMath.includes('Předpokládané variabilní náklady');
  const hasNotIncluded = fin.monthlyGoalMath.includes('Co není v modelu zahrnuto');
  const gateAssumptionsDisclosed = gate.financeAssumptionsDisclosed === true;
  assert(
    hasClientInput && hasAssumedPrice && hasAssumedVolume && hasAssumedCapacity && hasAssumedCosts && hasNotIncluded && gateAssumptionsDisclosed,
    `[FINANCE_ASSUMPTIONS_DISCLOSED] Zveřejněno všech 8 bodů: vstupy klienta, předpoklady cen, nákladů i výluky`
  );
  passedChecks++;

  // 3. NO_GUARANTEED_INCOME:
  // PODNIKAI nesmí prezentovat příjem ani zisk jako garantovaný, očekávaný nebo jistý.
  totalChecks++;
  const fullFinText = JSON.stringify(fin).toLowerCase();
  const forbiddenPositiveClaims = [
    'garantujeme zisk',
    'garantujeme příjem',
    'jistý příjem:',
    'jistý zisk:',
    'zaručený příjem',
    'zaručený zisk',
    'realistický čistý zisk 55 000',
    'garance budoucího zisku: ano'
  ];
  const hasForbidden = forbiddenPositiveClaims.some(phrase => fullFinText.includes(phrase));
  const hasDisclaimer = fin.disclaimer && (
    fin.disclaimer.toLowerCase().includes('nejedná se o garanci') ||
    fin.disclaimer.toLowerCase().includes('neprezentuje odhadovaný příjem ani zisk jako garantovaný')
  );
  const gateNoGuaranteed = gate.noGuaranteedIncome === true;
  assert(
    !hasForbidden && Boolean(hasDisclaimer) && gateNoGuaranteed,
    `[NO_GUARANTEED_INCOME] Žádné klamavé či nepodmíněné formulace zisku; přítomen striktní disclaimer`
  );
  passedChecks++;

  // 4. UNKNOWN_COSTS_NOT_ZERO:
  // Pokud některý náklad není známý nebo je nulový kapitál, nesmí být použito prosté "0 Kč" bez kontextu.
  totalChecks++;
  const overheadNotBareZero = fin.monthlyOverheadCostsCz !== '0 Kč' && fin.monthlyOverheadCostsCz !== '0 Kč / měsíc';
  const variableNotBareZero = fin.variableCostsPerClientCz !== '0 Kč' && fin.variableCostsPerClientCz !== '0 Kč / zakázka';
  const hasAssumptionOrUnset = fin.monthlyOverheadCostsCz.includes('Předpoklad') ||
                               fin.monthlyOverheadCostsCz.includes('neuvedeno') ||
                               fin.monthlyOverheadCostsCz.includes('nezohledněno');
  const gateUnknownCostsNotZero = gate.unknownCostsNotZero === true;
  assert(
    overheadNotBareZero && variableNotBareZero && hasAssumptionOrUnset && gateUnknownCostsNotZero,
    `[UNKNOWN_COSTS_NOT_ZERO] Neznámé a nulové náklady mají explicitní předpoklad nebo text 'neuvedeno / nezohledněno'`
  );
  passedChecks++;

  // 5. CAPACITY_IS_SCENARIO:
  // Kapacita (např. 12–16 líčení, 35–45 masáží, 1–2 rekonstrukce, 3–5 retainerů) je označena jako model kapacity.
  totalChecks++;
  const capacityScenarioCheck = fin.monthlyGoalMath.toLowerCase().includes('model kapacity') ||
                                fin.monthlyGoalMath.toLowerCase().includes('scénář kapacity') ||
                                fin.monthlyGoalMath.toLowerCase().includes('modelová kapacita');
  const gateCapacityScenario = gate.capacityIsScenario === true;
  assert(
    capacityScenarioCheck && gateCapacityScenario,
    `[CAPACITY_IS_SCENARIO] Kapacitní limity jsou striktně označeny jako model/scénář kapacity`
  );
  passedChecks++;

  // 6. PROFIT_IS_SCENARIO:
  // Ziskové výstupy jsou výhradně orientačním výsledkem modelového scénáře.
  totalChecks++;
  const mathHasCalc = fin.monthlyGoalMath.includes('Jednoduchý výpočet') || fin.monthlyGoalMath.includes('MODELOVÝ SCÉNÁŘ');
  const realisticIsScenario = (fin.scenarios?.realistic || '').includes('orientační modelový') ||
                              (fin.scenarios?.realistic || '').includes('model kapacity') ||
                              (fin.scenarios?.realistic || '').includes('scénář kapacity') ||
                              (fin.scenarios?.realistic || '').includes('modelová kapacita');
  const gateProfitIsScenario = gate.profitIsScenario === true;
  assert(
    mathHasCalc && realisticIsScenario && gateProfitIsScenario,
    `[PROFIT_IS_SCENARIO] Výsledky kalkulace formulovány jako orientační výsledek modelového scénáře`
  );
  passedChecks++;

  // 7. FINANCE_MATCHES_OFFER:
  // Cenový model a jednotková nabídka odpovídá parametrům v locked blueprintu i v doporučení.
  totalChecks++;
  const recommendedPrice = p.offerAndPackaging.recommendedPriceCz;
  const lockedPrice = analysis.lockedBlueprint?.price;
  const finPricesRespected = Boolean(fin.breakEvenClients && fin.monthlyOverheadCostsCz);
  const gateFinanceMatchesOffer = (gate.financialModelMatchesOffer ?? gate.financialModelConsistent) === true;
  assert(
    recommendedPrice === lockedPrice && finPricesRespected && gateFinanceMatchesOffer,
    `[FINANCE_MATCHES_OFFER] Cenový model plně koresponduje mezi Primary Blueprintem a Locked Blueprintem`
  );
  passedChecks++;

  // 8. BREAK_EVEN_SCOPE_EXPLICIT:
  // Bod zvratu explicitně rozlišuje provozní break-even a celkový/životní business break-even.
  totalChecks++;
  const hasOperationalBreakEven = fin.breakEvenClients.includes('PROVOZNÍ BOD ZVRATU');
  const hasBusinessBreakEven = fin.breakEvenClients.includes('CELKOVÝ / BUSINESS BOD ZVRATU');
  const explainsNotLivingExpenses = fin.breakEvenClients.toLowerCase().includes('neznamená') &&
                                   (fin.breakEvenClients.toLowerCase().includes('životní') || fin.breakEvenClients.toLowerCase().includes('osobní'));
  const gateBreakEvenScopeExplicit = gate.breakEvenScopeExplicit === true;
  assert(
    hasOperationalBreakEven && hasBusinessBreakEven && explainsNotLivingExpenses && gateBreakEvenScopeExplicit,
    `[BREAK_EVEN_SCOPE_EXPLICIT] Bod zvratu striktně rozlišuje A) provozní bod zvratu a B) celkový/business break-even`
  );
  passedChecks++;

  console.log(`  -> Celkové skóre pro ${persona.id}: 8/8 kontrol PASSED\n`);
}

console.log('----------------------------------------------------------------');
console.log(`VÝSLEDEK FINANČNÍHO QA: ${passedChecks}/${totalChecks} KONTROL 100% ÚSPĚŠNÝCH`);
console.log('----------------------------------------------------------------');

if (passedChecks !== totalChecks) {
  console.error('❌ FINANČNÍ QA SELHALO!');
  process.exit(1);
}

console.log('🎉 VŠECHNA KRITICKÁ PRAVIDLA PRO FINANČNÍ MODEL BYLA OVĚŘENA!');
process.exit(0);
