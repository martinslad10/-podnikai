import {
  generateDeterministicBusinessStartAnalysis,
  createEmptyQuestionnaire
} from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

console.log('================================================================');
console.log('BUSINESS START – DEEP CONTENT & FINANCIAL QA VERIFICATION');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test Case 1: Masér s 50 000 Kč+ a cílem 50 000 – 80 000 Kč
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Masér (50k+ kapitál, cíl 50 000 – 80 000 Kč) ---');
const qMasseur50k: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Martin Kovář',
  mainGoal: 'Chci si otevřít vlastní masérské studio.',
  targetMonthlyIncome: '50 000 Kč – 80 000 Kč',
  preferredWorkType: 'Vlastní provozovna / studio / dílna',
  customPreferredWorkType: 'osobní práce s lidmi / studio',
  strictDislikesAndRedLines: ['Celodenní sezení u počítače', 'Cold calling'],
  startingCapital: '50 000 Kč+',
  weeklyTimeCommitment: '25 hodin týdně',
  operatingModel: 'offline',
  coreSkillsAndExpertise: ['Sportovní masáže', 'Regenerace a rekondice', 'Ergonomie']
};

const a1 = generateDeterministicBusinessStartAnalysis(qMasseur50k);
const p1 = a1.primaryDirectionBlueprint;
const fin1 = p1.financialModel;
const plan1 = a1.capitalUsagePlan!;

// GATE 1: TARGET_INCOME_VS_MODEL
console.log('\n[GATE 1: TARGET_INCOME_VS_MODEL]');
assert(
  fin1.monthlyGoalMath.includes('Cílový příjem zadaný klientem') &&
  fin1.monthlyGoalMath.includes('Tržby') &&
  fin1.monthlyGoalMath.includes('Modelový provozní přebytek') &&
  fin1.monthlyGoalMath.includes('Čistý příjem podnikatele'),
  'Explicitly distinguishes target income, gross revenue, operating surplus and net income'
);
assert(
  fin1.monthlyGoalMath.includes('nedosahuje zadaného cíle') &&
  fin1.monthlyGoalMath.includes('K dosažení cíle je nutná změna ceny, kapacity, nabídky nebo dalšího příjmového kanálu'),
  'States explicitly that conservative scenario does not reach 50k–80k goal'
);
assert(
  fin1.monthlyGoalMath.includes('CO JE NUTNÉ ZMĚNIT PRO DOSAŽENÍ CÍLE'),
  'Contains dedicated section on what to change to reach target (pricing, packages, B2B)'
);

// GATE 2: CAPACITY_VS_SCENARIO
console.log('\n[GATE 2: CAPACITY_VS_SCENARIO]');
assert(
  fin1.scenarios?.pessimistic.includes('25 masáží') &&
  fin1.scenarios?.pessimistic.includes('25–30'),
  'Conservative/pessimistic scenario aligns with 25–30 visits'
);
assert(
  fin1.scenarios?.realistic.includes('35 masáží') &&
  fin1.scenarios?.realistic.includes('30–35'),
  'Realistic scenario aligns with recommended sustainable capacity 30–35 visits'
);
assert(
  fin1.scenarios?.optimistic.includes('45 masáží') &&
  fin1.scenarios?.optimistic.includes('40–45'),
  'Optimistic scenario aligns with operational ceiling 40–45 visits'
);

// GATE 3: RECOMMENDED_INVESTMENT_VS_CAPITAL_PLAN
console.log('\n[GATE 3: RECOMMENDED_INVESTMENT_VS_CAPITAL_PLAN]');
assert(plan1.availableCapital.replace(/\s+/g, ' ').includes('50 000'), 'Available capital is 50 000 Kč');
assert(plan1.recommendedInitialInvestment.replace(/\s+/g, ' ').includes('45 000'), 'Recommended investment is 45 000 Kč');
assert(plan1.unspentCapitalReserve.replace(/\s+/g, ' ').includes('5 000'), 'Unspent reserve is 5 000 Kč');

const breakdownCosts = plan1.breakdown.map(b => {
  const m = b.estimatedCostCz.replace(/\s+/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
});
const breakdownSum = breakdownCosts.reduce((a, b) => a + b, 0);
assert(
  breakdownSum === 45000,
  `Capital Usage Plan breakdown items sum to EXACTLY 45 000 Kč (got ${breakdownSum} Kč)`
);

// GATE 4: NO_DUPLICATE_CAPITAL_ITEMS
console.log('\n[GATE 4: NO_DUPLICATE_CAPITAL_ITEMS]');
const categories = plan1.breakdown.map(b => b.category);
const items = plan1.breakdown.map(b => b.item);
const uniqueItems = new Set(items);
assert(
  uniqueItems.size === items.length,
  'All breakdown items have unique, non-duplicative descriptions'
);
assert(
  !categories.includes('první zásoby') &&
  categories.includes('prostor/nájem') &&
  categories.includes('hygiena a spotřební materiál'),
  'Categories are unambiguous and follow clean taxonomy (prostor/nájem, hygiena a spotřební materiál)'
);

// GATE 5: NO_FORCED_SPENDING
console.log('\n[GATE 5: NO_FORCED_SPENDING]');
assert(
  plan1.noForcedSpendingNotice.includes('nenutí utratit celý rozpočet') &&
  plan1.noForcedSpendingNotice.replace(/\s+/g, ' ').includes('5 000 Kč'),
  'NO_FORCED_SPENDING preserved: 5 000 Kč stays as safe unallocated reserve'
);

// GATE 6: OFFER_PRICE_VS_FINANCIAL_PRICE
console.log('\n[GATE 6: OFFER_PRICE_VS_FINANCIAL_PRICE]');
assert(
  fin1.assumedPrice.includes('Prodejní/modelová cena nabídky') &&
  fin1.assumedPrice.includes('Konzervativní finanční stress-test: 1 000 Kč'),
  'Clear distinction between offer price range and conservative stress-test price'
);

// GATE 7: NO_DIAGNOSTIC_LANGUAGE
console.log('\n[GATE 7: NO_DIAGNOSTIC_LANGUAGE]');
const fullAnalysisStr = JSON.stringify(a1).toLowerCase();
assert(
  !fullAnalysisStr.includes('vstupní diagnostika') &&
  !fullAnalysisStr.includes('diagnostická masáž') &&
  !fullAnalysisStr.includes('diagnostika zad'),
  'No diagnostic or medicalized terms present in output'
);
assert(
  p1.offerAndPackaging.coreOffer.includes('vstupní konzultace'),
  'Uses vstupní konzultace + regenerační masáž'
);
assert(
  (a1.lockedBlueprint?.idealCustomer?.includes('sedavým zaměstnáním') || p1.idealCustomerAvatar.description.includes('sedavým zaměstnáním')) &&
  !JSON.stringify(p1.idealCustomerAvatar).toLowerCase().includes('chronick'),
  'Customer avatar uses sedavé zaměstnání / regenerace and avoids medical chronic terms'
);

// -----------------------------------------------------------------------------
// Test Case 2: Zedník – rozlišení cena práce, materiál a způsob financování
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Zedník (práce vs. materiál a zálohy) ---');
const qMason: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Josef Novák',
  mainGoal: 'Chci podnikat jako zedník a dělat zakázky v regionu.',
  targetMonthlyIncome: '45 000 Kč – 60 000 Kč',
  preferredWorkType: 'Fyzická práce / řemeslo / terén',
  customPreferredWorkType: 'fyzická práce / řemeslo / terén',
  strictDislikesAndRedLines: ['Celodenní sezení u počítače', 'Práce v kanceláři'],
  startingCapital: 'do 20 000 Kč',
  weeklyTimeCommitment: '30 hodin týdně',
  operatingModel: 'offline',
  coreSkillsAndExpertise: ['Zednické práce', 'Obklady a dlažby', 'Rekonstrukce bytových jader']
};

const a2 = generateDeterministicBusinessStartAnalysis(qMason);
const p2 = a2.primaryDirectionBlueprint;
const fin2 = p2.financialModel;

assert(
  fin2.assumedPrice.includes('Cena práce 50 000 Kč') &&
  fin2.assumedPrice.includes('materiál') &&
  fin2.assumedPrice.includes('financován zálohou či průběžnou platbou zákazníka'),
  'Mason assumed price clearly differentiates labor price, material, and customer deposit financing'
);
assert(
  fin2.simpleCalculationFormula?.includes('tržba za práci') &&
  fin2.simpleCalculationFormula?.includes('materiál je řešen zálohami'),
  'Mason simple calculation explicitly states model calculates labor revenue with material funded via customer deposits'
);

// -----------------------------------------------------------------------------
// Test Case 3: Online Model s 0 Kč – předpoklad stávajícího vybavení
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Online model (0 Kč rozpočet, stávající vybavení) ---');
const qOnline: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Jan Sýkora',
  mainGoal: 'Chci podnikat v online marketingu.',
  targetMonthlyIncome: '35 000 Kč – 50 000 Kč',
  preferredWorkType: '100% práce na počítači / online',
  customPreferredWorkType: '100 % online / PC',
  strictDislikesAndRedLines: ['Fyzická manuální práce', 'Dojíždění do provozovny'],
  startingCapital: '0 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  operatingModel: 'online',
  coreSkillsAndExpertise: ['Sociální sítě', 'Copywriting', 'Obsahový marketing']
};

const a3 = generateDeterministicBusinessStartAnalysis(qOnline);
const p3 = a3.primaryDirectionBlueprint;
const fin3 = p3.financialModel;

assert(
  fin3.monthlyOverheadCostsCz.includes('0 Kč při využití stávajícího vybavení a bezplatných nástrojů'),
  'Online 0 Kč model explicitly mentions 0 Kč when using existing equipment and free tools'
);

// -----------------------------------------------------------------------------
// Test Case 4: Hybridní asistence – stávající hardware & cestovní náklady
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Hybridní asistence (telefon/PC bez cestovních nákladů) ---');
const qHybrid: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Petr Svoboda',
  mainGoal: 'Chci začít podnikat, ale zatím nevím přesně v čem.',
  targetMonthlyIncome: '25 000 Kč – 40 000 Kč',
  preferredWorkType: 'Nevím / ještě nemám vyhraněno',
  customPreferredWorkType: 'nevím / ještě nemám vyhraněno',
  strictDislikesAndRedLines: ['Neetické prodejní praktiky', 'Nekalé praktiky'],
  startingCapital: '0 Kč',
  weeklyTimeCommitment: '15 hodin týdně',
  operatingModel: 'hybrid',
  coreSkillsAndExpertise: ['Organizace', 'Komunikace', 'Běžná práce na PC i v terénu']
};

const a4 = generateDeterministicBusinessStartAnalysis(qHybrid);
const p4 = a4.primaryDirectionBlueprint;
const fin4 = p4.financialModel;

assert(
  fin4.monthlyOverheadCostsCz.includes('využití stávajícího telefonu a PC') &&
  fin4.monthlyOverheadCostsCz.includes('nezahrnuje případné cestovní náklady'),
  'Hybrid 0 Kč model explicitly states existing phone/PC usage and excludes travel costs'
);

// -----------------------------------------------------------------------------
// Test Case 5: Kontrola absence „reálných českých cen“ / garancí tržních cen
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Tržní ceny – žádné nepodložené garance tržních cen ---');
const allAnalysesStr = JSON.stringify([a1, a2, a3, a4]).toLowerCase();
assert(
  !allAnalysesStr.includes('reálné české ceny') &&
  !allAnalysesStr.includes('ověřené tržní ceny'),
  'Never claims verified Czech market prices without external validation'
);

console.log('\n================================================================');
console.log('🎉 ALL 7 DEEP CONTENT & FINANCIAL QA GATES 100% PASSED!');
console.log('================================================================');
