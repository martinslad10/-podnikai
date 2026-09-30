import { generateDeterministicBusinessStartAnalysis, createEmptyQuestionnaire } from '../src/utils/businessStartDefaults';
import { parseClientBudget, evaluateCandidateBudgetCompatibility } from '../src/utils/businessStartBudgetCompatibility';
import { BusinessStartQuestionnaire } from '../src/types';

console.log('====================================================');
console.log('BUSINESS START BUDGET COMPATIBILITY QA TEST SUITE');
console.log('====================================================\n');

let failedTests = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

// -------------------------------------------------------------------------
// TEST 1: Client with 50 000 Kč+ in Masér domain
// Should NOT return 3 models with 0 Kč start.
// Primary recommendation should sensibly leverage available capital.
// -------------------------------------------------------------------------
console.log('\n--- TEST 1: Masér s rozpočtem 50 000 Kč+ ---');
const masseurQuestionnaire50k: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Jan Masér',
  mainGoal: 'Vybudovat stabilní praxi sportovního a rekondičního maséra',
  targetMonthlyIncome: '45 000 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  startingCapital: '50 000 Kč+',
  operatingModel: 'offline',
  preferredWorkType: 'fyzická práce v terénu / u klientů či v provozovně',
  coreSkillsAndExpertise: ['Sportovní masáže', 'Anatomie', 'Práce s klienty'],
  existingAssetsAndNetwork: 'Kontakty na sportovní kluby v okolí',
  strictDislikesAndRedLines: ['Cold calling', 'Online prodej kurzů']
};

const analysisMasseur50k = generateDeterministicBusinessStartAnalysis(masseurQuestionnaire50k);
const budgetMasseur = parseClientBudget(masseurQuestionnaire50k);

assert(budgetMasseur.availableCapitalNumber >= 50000, 'Budget parsed >= 50 000 Kč');
assert(budgetMasseur.hasSubstantialCapital === true, 'hasSubstantialCapital is true for 50k+');

const directionsMasseur = analysisMasseur50k.topDirections;
console.log('Top directions generated for 50k Masér:');
directionsMasseur.forEach((d, i) => {
  console.log(`  Směr #${i + 1}: ${d.title}`);
  console.log(`    Náklady min-max: ${d.estimatedStartupCostMin} – ${d.estimatedStartupCostMax} Kč`);
  console.log(`    Doporučená investice: ${d.recommendedInitialInvestment} Kč`);
  console.log(`    Kompatibilita: ${d.budgetCompatibility}, skóre: ${d.budgetScore}`);
});

// Verify NOT all candidates are 0 Kč:
const hasNonZeroMasseur = directionsMasseur.some(d => d.estimatedStartupCostMin > 0);
assert(hasNonZeroMasseur, 'Candidate models for 50k+ do NOT default to 0 Kč exclusively');

// Primary direction should have realistic equipment startup cost
const primaryMasseur = directionsMasseur.find(d => d.isPrimary) || directionsMasseur[0];
assert(primaryMasseur.estimatedStartupCostMin >= 5000, 'Primary direction has realistic startup cost (>= 5000 Kč for massage table/equipment)');

// Verify Capital Usage Plan exists and has required categories
const planMasseur = analysisMasseur50k.capitalUsagePlan;
assert(planMasseur !== undefined, 'Capital Usage Plan is generated');
if (planMasseur) {
  assert(planMasseur.availableCapital.includes('50'), 'Plan reflects available capital 50 000 Kč');
  assert(planMasseur.unspentCapitalReserve.length > 0, 'Unspent capital reserve is calculated');
  assert(planMasseur.noForcedSpendingNotice.includes('nenutí'), 'No forced spending notice present');

  const categories = planMasseur.breakdown.map(b => b.category);
  console.log('Capital plan categories:', categories);
  assert(categories.includes('vybavení'), 'Plan contains category vybavení');
  assert(categories.includes('marketing'), 'Plan contains category marketing');
  assert(categories.some(c => c.includes('rezerva')), 'Plan contains category rezerva / pohotovostní rezerva');
}

// -------------------------------------------------------------------------
// TEST 2: Client with 50 000 Kč+ in Zedník / Řemeslo domain
// -------------------------------------------------------------------------
console.log('\n--- TEST 2: Zedník / Obkladač s rozpočtem 50 000 Kč+ ---');
const masonQuestionnaire50k: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Petr Zedník',
  mainGoal: 'Založit zednickou a obkladačskou živnost pro rekonstrukce',
  targetMonthlyIncome: '60 000 Kč',
  weeklyTimeCommitment: '30 hodin týdně',
  startingCapital: '50 000 Kč – 100 000 Kč',
  operatingModel: 'offline',
  preferredWorkType: 'fyzická řemeslná práce na stavbách',
  coreSkillsAndExpertise: ['Zednické práce', 'Obklady a dlažby', 'Stavební rekonstrukce'],
  existingAssetsAndNetwork: 'Osobní dodávka, základní ruční nářadí',
  strictDislikesAndRedLines: ['Sociální sítě', 'Studené telefonování']
};

const analysisMason50k = generateDeterministicBusinessStartAnalysis(masonQuestionnaire50k);
const directionsMason = analysisMason50k.topDirections;
console.log('Top directions generated for 50k Zedník:');
directionsMason.forEach((d, i) => {
  console.log(`  Směr #${i + 1}: ${d.title} (min: ${d.estimatedStartupCostMin} Kč, doporučeno: ${d.recommendedInitialInvestment} Kč, kompatibilita: ${d.budgetCompatibility})`);
});

const primaryMason = directionsMason.find(d => d.isPrimary) || directionsMason[0];
assert(primaryMason.estimatedStartupCostMin >= 8000, 'Primary mason direction reflects realistic professional tool setup (>= 8000 Kč)');
assert(analysisMason50k.capitalUsagePlan !== undefined, 'Mason has capital usage plan');
if (analysisMason50k.capitalUsagePlan) {
  const cats = analysisMason50k.capitalUsagePlan.breakdown.map(b => b.category);
  assert(cats.includes('vybavení'), 'Mason plan includes vybavení');
}

// -------------------------------------------------------------------------
// TEST 3: Client with 0–5 000 Kč in Online Marketing domain
// Should get low-cost / zero-budget models without penalty
// -------------------------------------------------------------------------
console.log('\n--- TEST 3: Marketing s rozpočtem 0–5 000 Kč ---');
const marketingQuestionnaireLean: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Eva Marketerka',
  mainGoal: 'Rozjet freelance správu sociálních sítí pro malé firmy',
  targetMonthlyIncome: '35 000 Kč',
  weeklyTimeCommitment: '15 hodin týdně',
  startingCapital: '0 – 5 000 Kč',
  operatingModel: 'online',
  preferredWorkType: 'práce z domova online u počítače',
  coreSkillsAndExpertise: ['Copywriting', 'Canva', 'Instagram', 'Meta Ads'],
  existingAssetsAndNetwork: 'Vlastní notebook, smartphone',
  strictDislikesAndRedLines: ['Telefonování naslepo']
};

const analysisMarketingLean = generateDeterministicBusinessStartAnalysis(marketingQuestionnaireLean);
const directionsMarketing = analysisMarketingLean.topDirections;
console.log('Top directions generated for lean Marketing:');
directionsMarketing.forEach((d, i) => {
  console.log(`  Směr #${i + 1}: ${d.title} (min: ${d.estimatedStartupCostMin} Kč, kompatibilita: ${d.budgetCompatibility}, skóre: ${d.budgetScore})`);
});

const primaryMarketing = directionsMarketing.find(d => d.isPrimary) || directionsMarketing[0];
assert(primaryMarketing.estimatedStartupCostMin <= 5000, 'Lean marketing model starts within 0–5 000 Kč');
assert(primaryMarketing.budgetCompatibility === 'high', '0–5k model gets high compatibility for lean budget');

// -------------------------------------------------------------------------
// TEST 4: Client with 50 000 Kč+ in Marketing domain
// Model that sensibly leverages capital (video stack, paid ad testing) should be available
// -------------------------------------------------------------------------
console.log('\n--- TEST 4: Marketing s rozpočtem 50 000 Kč+ ---');
const marketingQuestionnaire50k: BusinessStartQuestionnaire = {
  ...marketingQuestionnaireLean,
  startingCapital: '50 000 Kč+'
};

const analysisMarketing50k = generateDeterministicBusinessStartAnalysis(marketingQuestionnaire50k);
const directionsMarketing50k = analysisMarketing50k.topDirections;
console.log('Top directions generated for 50k Marketing:');
directionsMarketing50k.forEach((d, i) => {
  console.log(`  Směr #${i + 1}: ${d.title} (min: ${d.estimatedStartupCostMin} Kč, doporučeno: ${d.recommendedInitialInvestment} Kč, kompatibilita: ${d.budgetCompatibility})`);
});

const hasCapitalOption = directionsMarketing50k.some(d => d.estimatedStartupCostMin > 0 || (d.recommendedInitialInvestment && d.recommendedInitialInvestment > 5000));
assert(hasCapitalOption, 'Marketing for 50k has direction that sensibly leverages capital (e.g. video equipment/retainers/ads)');

// -------------------------------------------------------------------------
// TEST 5: Client with 50 000 Kč but explicitly prefers minimal spending
// Should respect lean bootstrap preference without forcing spend
// -------------------------------------------------------------------------
console.log('\n--- TEST 5: Klient s 50 000 Kč preferující minimální investice ---');
const leanPreference50k: BusinessStartQuestionnaire = {
  ...masseurQuestionnaire50k,
  startingCapital: 'Mám 50 000 Kč, ale preferuji minimální investice a začít co nejvíce lean'
};

const budgetLeanPref = parseClientBudget(leanPreference50k);
assert(budgetLeanPref.wantsLeanBootstrap === true, 'wantsLeanBootstrap correctly recognized');

// -------------------------------------------------------------------------
// TEST 6: Validation Gate Checks (All 6 Budget Gates)
// -------------------------------------------------------------------------
console.log('\n--- TEST 6: Validation Gates ---');
const gates = analysisMasseur50k.validationGate;
assert(gates.budgetIsUsedInCandidateGeneration === true, 'Gate: BUDGET_IS_USED_IN_CANDIDATE_GENERATION is true');
assert(gates.budgetCompatibilityChecked === true, 'Gate: BUDGET_COMPATIBILITY_CHECKED is true');
assert(gates.startupCostMatchesModel === true, 'Gate: STARTUP_COST_MATCHES_MODEL is true');
assert(gates.capitalUsagePlanPresent === true, 'Gate: CAPITAL_USAGE_PLAN_PRESENT is true');
assert(gates.noForcedSpending === true, 'Gate: NO_FORCED_SPENDING is true');
assert(gates.no0CzkBiasWhenBudgetExists === true, 'Gate: NO_0_CZK_BIAS_WHEN_BUDGET_EXISTS is true');

console.log('\n====================================================');
if (failedTests === 0) {
  console.log('🎉 ALL BUSINESS START BUDGET QA TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} TEST(S) FAILED!`);
  console.log('====================================================');
  process.exit(1);
}
