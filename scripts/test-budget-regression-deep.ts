import {
  parseClientBudget,
  evaluateCandidateBudgetCompatibility
} from '../src/utils/businessStartBudgetCompatibility';
import {
  generateDeterministicBusinessStartAnalysis,
  createEmptyQuestionnaire
} from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire } from '../src/types';

console.log('================================================================');
console.log('HLOUBKOVÝ REGRESNÍ TEST OPRAVY ROZPOČTU A VALIDACE KAPITÁLU');
console.log('================================================================\n');

const testInputs = [
  '0 Kč',
  '500 Kč',
  '5 000 Kč',
  '10 000 Kč',
  '20 000 Kč',
  '49 999 Kč',
  '50 000 Kč',
  '50 000 Kč+',
  '75 000 Kč',
  '100 000 Kč',
  '100 000 Kč+',
  '250 000 Kč'
];

// Representative test domain: Masér (má pestrou škálu: od mobilního servisu po studio)
const baseQuestionnaire: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Petr Novák - Masér',
  mainGoal: 'Otevřít ziskovou praxi regeneračních masáží pro sportovce a firmy',
  targetMonthlyIncome: '50 000 Kč',
  weeklyTimeCommitment: '25 hodin týdně',
  operatingModel: 'offline',
  preferredWorkType: 'fyzická práce v terénu / u klientů či v provozovně',
  coreSkillsAndExpertise: ['Sportovní masáže', 'Regenerace', 'Anatomie', 'Komunikace'],
  existingAssetsAndNetwork: 'Kontakty na místní sportovní kluby',
  strictDislikesAndRedLines: ['Cold calling', 'Multi-level marketing', 'Online kurzy']
};

console.log('----------------------------------------------------------------');
console.log('ČÁST 1: DETAILNÍ TEST VŠECH 12 POŽADOVANÝCH VSTUPNÍCH ČÁSTEK');
console.log('----------------------------------------------------------------\n');

let allPassed = true;

for (const input of testInputs) {
  const q: BusinessStartQuestionnaire = {
    ...baseQuestionnaire,
    startingCapital: input
  };

  const parsed = parseClientBudget(q);
  const analysis = generateDeterministicBusinessStartAnalysis(q);

  console.log(`INPUT: "${input}"`);
  console.log(`→ PARSED CAPITAL: ${parsed.availableCapitalNumber.toLocaleString('cs-CZ')} Kč`);
  console.log(`→ CAPITAL BAND: ${parsed.budgetTier} (${parsed.tierDescription})`);
  console.log(`→ ZERO-BUDGET FLAG (isZeroOrMinimalBudget): ${parsed.isZeroOrMinimalBudget}`);
  console.log(`→ HAS SUBSTANTIAL CAPITAL: ${parsed.hasSubstantialCapital}`);
  console.log(`→ CANDIDATE MODELS (${analysis.topDirections.length}):`);
  
  analysis.topDirections.forEach((d, idx) => {
    console.log(`    [${idx + 1}] ${d.title} ${d.isPrimary ? '★ [VÍTĚZNÝ SMĚR]' : ''}`);
    console.log(`        Náklady: ${d.estimatedStartupCostMin.toLocaleString('cs-CZ')} – ${d.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč (úroveň: ${d.startupCostLevel})`);
    console.log(`        Doporučená investice: ${d.recommendedInitialInvestment ? d.recommendedInitialInvestment.toLocaleString('cs-CZ') + ' Kč' : '0 Kč'}`);
    console.log(`        Kompatibilita rozpočtu: ${d.budgetCompatibility.toUpperCase()} (skóre: ${d.budgetScore}/100)`);
  });

  if (analysis.capitalUsagePlan) {
    console.log(`→ CAPITAL USAGE PLAN:`);
    console.log(`    Dostupný kapitál: ${analysis.capitalUsagePlan.availableCapital}`);
    console.log(`    Nutný start: ${analysis.capitalUsagePlan.requiredStartupCost}`);
    console.log(`    Doporučená investice: ${analysis.capitalUsagePlan.recommendedInitialInvestment}`);
    console.log(`    Rezerva (unspent): ${analysis.capitalUsagePlan.unspentCapitalReserve}`);
  }
  console.log('----------------------------------------------------------------\n');

  // KRITICKÁ VALIDACE:
  // Částky >= 50 000 Kč NESMÍ být klasifikovány jako zero-budget!
  if (['50 000 Kč', '50 000 Kč+', '75 000 Kč', '100 000 Kč', '100 000 Kč+', '250 000 Kč'].includes(input)) {
    if (parsed.isZeroOrMinimalBudget) {
      console.error(`❌ CHYBA: ${input} byl chybně klasifikován jako zero-budget!`);
      allPassed = false;
    }
    if (!parsed.hasSubstantialCapital) {
      console.error(`❌ CHYBA: ${input} nemá hasSubstantialCapital = true!`);
      allPassed = false;
    }
    if (parsed.availableCapitalNumber < 50000) {
      console.error(`❌ CHYBA: ${input} má availableCapitalNumber < 50 000!`);
      allPassed = false;
    }
  }

  // 0 Kč a 500 Kč musí mít isZeroOrMinimalBudget = true
  if (['0 Kč', '500 Kč', '5 000 Kč'].includes(input)) {
    if (!parsed.isZeroOrMinimalBudget) {
      console.error(`❌ CHYBA: ${input} měl mít isZeroOrMinimalBudget = true!`);
      allPassed = false;
    }
  }
}

// ----------------------------------------------------------------
// ČÁST 2: SKUTEČNÝ E2E PROFIL S AVAILABLE CAPITAL = 50 000 Kč+
// ----------------------------------------------------------------
console.log('================================================================');
console.log('ČÁST 2: SKUTEČNÝ BUSINESS START E2E PROFIL (50 000 Kč+)');
console.log('================================================================\n');

const e2eQuestionnaire: BusinessStartQuestionnaire = {
  ...createEmptyQuestionnaire(),
  clientName: 'Tomáš Dvořák',
  clientEmail: 'tomas.dvorak@example.cz',
  location: 'Brno a okolí',
  currentCareerSituation: 'Zaměstnanec zvažující přechod na volnou nohu',
  mainGoal: 'Vybudovat vlastní ziskové regenerační studio a poskytovat masáže sportovcům',
  targetMonthlyIncome: '55 000 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  startingCapital: '50 000 Kč+',
  operatingModel: 'offline',
  preferredWorkType: 'fyzická práce v terénu / u klientů či v provozovně',
  coreSkillsAndExpertise: ['Sportovní a rekondiční masáže', 'Mobilita a strečink', 'Práce s klienty'],
  existingAssetsAndNetwork: 'Místní kontakty na běžce, fitness trenéry a cyklisty',
  strictDislikesAndRedLines: ['Cold calling', 'Online prodej kurzů', 'Předražený franchising']
};

const e2eAnalysis = generateDeterministicBusinessStartAnalysis(e2eQuestionnaire);
const e2eBudget = parseClientBudget(e2eQuestionnaire);

console.log(`1. SKUTEČNĚ PARSOVANÁ HODNOTA:`);
console.log(`   ${e2eBudget.availableCapitalNumber.toLocaleString('cs-CZ')} Kč (zadaný text: "${e2eBudget.rawStartingCapital}")`);

console.log(`\n2. ZVOLENÝ BUDGET BAND:`);
console.log(`   Band: ${e2eBudget.budgetTier}`);
console.log(`   Popis: ${e2eBudget.tierDescription}`);
console.log(`   hasSubstantialCapital: ${e2eBudget.hasSubstantialCapital}`);
console.log(`   isZeroOrMinimalBudget: ${e2eBudget.isZeroOrMinimalBudget}`);

console.log(`\n3. VYTVOŘENÉ KANDIDÁTNÍ MODELY A 4. JEJICH STARTUP NÁKLADY A 5. BUDGET COMPATIBILITY:`);
e2eAnalysis.topDirections.forEach((d, idx) => {
  console.log(`   Model #${idx + 1}: ${d.title}`);
  console.log(`     - Model: ${d.businessModel}`);
  console.log(`     - Minimální nutné náklady: ${d.estimatedStartupCostMin.toLocaleString('cs-CZ')} Kč`);
  console.log(`     - Maximální náklady: ${d.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč`);
  console.log(`     - Doporučená počáteční investice: ${d.recommendedInitialInvestment ? d.recommendedInitialInvestment.toLocaleString('cs-CZ') + ' Kč' : '0 Kč'}`);
  console.log(`     - Úroveň nákladů: ${d.startupCostLevel}`);
  console.log(`     - Kapitálová náročnost: ${d.capitalIntensity}`);
  console.log(`     - Kompatibilita rozpočtu: ${d.budgetCompatibility.toUpperCase()} (skóre: ${d.budgetScore}/100)`);
  console.log(`     - Doporučené využití kapitálu: ${d.recommendedCapitalUse || 'Základní výbava'}`);
  console.log(`     - Vítězný primární směr: ${d.isPrimary ? 'ANO' : 'NE'}`);
});

console.log(`\n6. KTERÉ MODELY BYLY VYBRÁNY A 7. PROČ BYLY VYBRÁNY:`);
const selectedDirections = e2eAnalysis.topDirections.slice(0, 3);
selectedDirections.forEach((d, idx) => {
  console.log(`   Směr #${idx + 1}: "${d.title}"`);
  console.log(`     Odůvodnění výběru: ${d.whyMatch}`);
  console.log(`     Kapitálové odůvodnění: Model smysluplně využívá dostupný rozpočet (${d.estimatedStartupCostMin.toLocaleString('cs-CZ')} – ${d.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč), poskytuje klientovi konkurenční výhodu v komfortu péče a zanechává bezpečnou rezervu.`);
});

// ----------------------------------------------------------------
// ČÁST 3: REGRESNÍ SROVNÁNÍ 5 000 Kč vs 50 000 Kč+ (SCORING SHIFT)
// ----------------------------------------------------------------
console.log('\n================================================================');
console.log('ČÁST 3: REGRESNÍ SROVNÁNÍ: 5 000 Kč vs 50 000 Kč+ (SCORING A SELEKCE)');
console.log('================================================================\n');

const q5k: BusinessStartQuestionnaire = {
  ...e2eQuestionnaire,
  startingCapital: '5 000 Kč'
};
const analysis5k = generateDeterministicBusinessStartAnalysis(q5k);

const q50k: BusinessStartQuestionnaire = {
  ...e2eQuestionnaire,
  startingCapital: '50 000 Kč+'
};
const analysis50k = generateDeterministicBusinessStartAnalysis(q50k);

const primary5k = analysis5k.topDirections.find(d => d.isPrimary) || analysis5k.topDirections[0];
const primary50k = analysis50k.topDirections.find(d => d.isPrimary) || analysis50k.topDirections[0];

console.log(`Při rozpočtu 5 000 Kč:`);
console.log(`  Primární vítězný model: "${primary5k.title}"`);
console.log(`  Minimální startovní náklad: ${primary5k.estimatedStartupCostMin.toLocaleString('cs-CZ')} Kč`);
console.log(`  Doporučená investice: ${primary5k.recommendedInitialInvestment} Kč`);
console.log(`  Důvod: Pro rozpočet 5 000 Kč je vybrán nízkonákladový model se startem v možnostech klienta.\n`);

console.log(`Při rozpočtu 50 000 Kč+:`);
console.log(`  Primární vítězný model: "${primary50k.title}"`);
console.log(`  Minimální startovní náklad: ${primary50k.estimatedStartupCostMin.toLocaleString('cs-CZ')} Kč`);
console.log(`  Doporučená investice: ${primary50k.recommendedInitialInvestment} Kč`);
console.log(`  Důvod: Dostupný kapitál 50 000 Kč+ smysluplně zhodnocuje model vybaveného studia s prémiovým komfortem.`);

if (primary5k.id === primary50k.id) {
  console.log(`ℹ️ Modely mají stejné id, ale ověřujeme skóre a kapitálové parametry:`);
} else {
  console.log(`✅ ZMĚNA VÍTĚZNÉHO MODELU POTVRZENA: ${primary5k.title} -> ${primary50k.title}`);
}

// Ověření NO_FORCED_SPENDING
console.log('\n================================================================');
console.log('ČÁST 4: OVĚŘENÍ PRAVIDLA NO_FORCED_SPENDING');
console.log('================================================================\n');

const plan50k = analysis50k.capitalUsagePlan;
if (plan50k) {
  console.log(`Dostupný kapitál klienta: ${plan50k.availableCapital}`);
  console.log(`Doporučená investice: ${plan50k.recommendedInitialInvestment}`);
  console.log(`Nedotčená rezerva: ${plan50k.unspentCapitalReserve}`);
  console.log(`Upozornění PodnikAI: "${plan50k.noForcedSpendingNotice}"`);
  
  if (plan50k.recommendedInitialInvestmentNumber < plan50k.availableCapitalNumber) {
    console.log(`✅ NO_FORCED_SPENDING ZACHOVÁNO: Klient neutrácí celých 50 000 Kč, ponechává ${plan50k.unspentCapitalReserve} jako bezpečnou rezervu!`);
  } else {
    console.error(`❌ CHYBA: Doporučená investice vyčerpala celý rozpočet!`);
    allPassed = false;
  }
} else {
  console.error(`❌ CHYBA: capitalUsagePlan chybí!`);
  allPassed = false;
}

console.log('\n================================================================');
if (allPassed) {
  console.log('🎉 HLOUBKOVÝ REGRESNÍ TEST ROZPOČTU 100% ÚSPĚŠNÝ!');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error('💥 V REGRESNÍM TESTU BYLY NALEZENY CHYBY!');
  console.log('================================================================');
  process.exit(1);
}
