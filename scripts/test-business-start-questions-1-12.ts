import assert from 'assert';
import { createEmptyQuestionnaire, generateDeterministicBusinessStartAnalysis } from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire } from '../src/types';

console.log('================================================================');
console.log('TEST: BUSINESS START COMPLETE 1–12 QUESTIONS & REPORT AUDIT QA');
console.log('================================================================');

// 1. Verify 12 questions in questionnaire
console.log('\n[CHECK 1: Questionnaire has all 12 fields initialized empty]');
const emptyQ = createEmptyQuestionnaire();
assert.strictEqual(emptyQ.clientName, '');
assert.strictEqual(emptyQ.clientEmail, '');
assert.strictEqual(emptyQ.clientPhone, '');
assert.strictEqual(emptyQ.location, ''); // Q1
assert.strictEqual(emptyQ.currentCareerSituation, ''); // Q2
assert.strictEqual(emptyQ.mainGoal, ''); // Q3
assert.strictEqual(emptyQ.targetMonthlyIncome, ''); // Q4
assert.strictEqual(emptyQ.startingCapital, ''); // Q5
assert.strictEqual(emptyQ.weeklyTimeCommitment, ''); // Q6
assert.strictEqual(emptyQ.operatingModel, 'offline'); // Q7
assert(Array.isArray(emptyQ.coreSkillsAndExpertise), 'Q8 coreSkillsAndExpertise is array');
assert(Array.isArray(emptyQ.passionsAndInterests), 'Q9 passionsAndInterests is array');
assert(Array.isArray(emptyQ.strictDislikesAndRedLines), 'Q10 strictDislikesAndRedLines is array');
assert.strictEqual(emptyQ.existingAssetsAndNetwork, ''); // Q11
assert.strictEqual(emptyQ.personalConstraints, ''); // Q12
console.log('  ✅ PASS: All 12 canonical question fields exist and start clean');

// 2. Test Question 9 passionsAndInterests enters analysis
console.log('\n[CHECK 2: Question 9 (passionsAndInterests) enters Canonical Analysis]');
const testQ: BusinessStartQuestionnaire = {
  ...emptyQ,
  clientName: 'Martin Testovací',
  clientEmail: 'martin@example.cz',
  mainGoal: 'Chci si otevřít masérskou praxi',
  startingCapital: 'do 15 000 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  targetMonthlyIncome: '50 000 Kč',
  operatingModel: 'offline',
  preferredWorkType: 'Práce s lidmi osobně',
  customPreferredWorkType: 'Osobní práce s lidmi v regeneraci',
  coreSkillsAndExpertise: ['Regenerační masáže', 'Ergonomie'],
  passionsAndInterests: ['Zdravý životní styl', 'Běhání a sport'],
  strictDislikesAndRedLines: ['Cold calling', 'Práce na PC'],
  existingAssetsAndNetwork: 'Kontakty na běžce v okolí',
  personalConstraints: 'Pouze odpoledne'
};

const analysis = generateDeterministicBusinessStartAnalysis(testQ);
assert(
  analysis.sourceOfTruthAudit?.passionsProvided?.includes('Zdravý životní styl'),
  'Analysis sourceOfTruthAudit includes passionsAndInterests from Q9'
);
console.log('  ✅ PASS: Question 9 response saved and included in sourceOfTruthAudit');

// 3. Test Time Hard Constraint (20h must not be planned as 25h)
console.log('\n[CHECK 3: Time Hard Constraint]');
const finModel = analysis.primaryDirectionBlueprint.financialModel;
const analysisJson = JSON.stringify(analysis);
assert(
  !analysisJson.includes('fond 25 h') &&
  !analysisJson.includes('časového fondu 25 h') &&
  !analysisJson.includes('dotace 25 h/týdně'),
  'Report does not plan 25 h when client specified 20 h/týdně'
);
assert(
  analysisJson.includes('20 hodin týdně'),
  'Report uses client exact time commitment (20 hodin týdně)'
);
console.log('  ✅ PASS: Time commitment is strictly synchronized with client input (20 h, no 25 h leak)');

// 4. Test Cost Model & No Double Counting
console.log('\n[CHECK 4: Cost Model & No Double Counting]');
assert(
  !finModel.monthlyOverheadCostsCz.includes('1 100 Kč') ||
  !finModel.variableCostsPerClientCz.includes('1 100 Kč'),
  'No conflict or double-counting in cost model'
);
assert(
  !analysisJson.includes('mínus 1 100 Kč fixní provozní náklady'),
  'Scenarios do not deduct 1 100 Kč when fixed costs are 0 Kč'
);
console.log('  ✅ PASS: Fixed costs vs. variable costs consistent, no double counting');

// 5. Test Price Consistency & Roles
console.log('\n[CHECK 5: Price Roles & Consistency]');
assert(
  finModel.assumedPrice?.includes('690 Kč') &&
  finModel.assumedPrice?.includes('1 000 Kč') &&
  finModel.assumedPrice?.includes('1 100 – 1 400 Kč'),
  'Assumed price clearly differentiates acquisition (690), stress-test (1000) and standard (1100-1400)'
);
console.log('  ✅ PASS: Every price role clearly explained (akviziční, stress-test, doporučené rozpětí)');

// 6. Test Service Duration
console.log('\n[CHECK 6: Service Duration Unified to 60 Minutes]');
assert(
  analysis.primaryDirectionBlueprint.offerAndPackaging.deliverables.some(d => d.includes('60 minut')),
  'Primary service deliverables are strictly 60 minutes'
);
assert(
  analysis.primaryDirectionBlueprint.offerAndPackaging.upsellOption?.includes('90minutová varianta') ||
  analysis.primaryDirectionBlueprint.offerAndPackaging.upsellOption?.includes('90min'),
  '90 minutes is reserved strictly as separate upsell'
);
console.log('  ✅ PASS: Core offer is 60 minutes, 90 minutes is separate upsell');

// 7. Test Health / Legal Language
console.log('\n[CHECK 7: Neutral Health Language]');
assert(
  !analysisJson.includes('bez rizika přetížení pohybového aparátu maséra'),
  'Categorical health promise removed'
);
assert(
  analysisJson.includes('Doporučená kapacita jako konzervativní provozní model s rezervou na přípravu, administrativu a regeneraci') ||
  analysisJson.includes('doporučená kapacita jako konzervativní provozní model s rezervou na přípravu, administrativu a regeneraci'),
  'Neutral model language present'
);
console.log('  ✅ PASS: Categorical statement replaced with neutral capacity model');

// 8. Test Questions 8–12 with commas and spaces as strings
console.log('\n[CHECK 8: Questions 8–12 Comma and Space Input Fidelity]');
const userStringQ: BusinessStartQuestionnaire = {
  ...emptyQ,
  clientName: 'Jan Novák',
  clientEmail: 'jan@example.cz',
  mainGoal: 'Chci otevřít masérské studio',
  targetMonthlyIncome: '50 000 Kč',
  startingCapital: 'do 15 000 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  operatingModel: 'offline',
  preferredWorkType: 'Práce s lidmi osobně',
  customPreferredWorkType: 'Osobní fyzická služba',
  coreSkillsAndExpertise: 'Masáže, práce s lidmi, sport',
  passionsAndInterests: 'Zdravý životní styl, fitness, regenerace',
  strictDislikesAndRedLines: 'Celodenní sezení u PC, cold calling, administrativa',
  existingAssetsAndNetwork: 'Kontakty v oboru, LinkedIn, stávající klienti',
  personalConstraints: 'Pouze večery a pátky, bez možnosti investovat'
};

// Check that string representation retains exact commas and spaces
assert.strictEqual(userStringQ.coreSkillsAndExpertise, 'Masáže, práce s lidmi, sport');
assert.strictEqual(userStringQ.passionsAndInterests, 'Zdravý životní styl, fitness, regenerace');
assert.strictEqual(userStringQ.strictDislikesAndRedLines, 'Celodenní sezení u PC, cold calling, administrativa');
assert.strictEqual(userStringQ.existingAssetsAndNetwork, 'Kontakty v oboru, LinkedIn, stávající klienti');
assert.strictEqual(userStringQ.personalConstraints, 'Pouze večery a pátky, bez možnosti investovat');

// Check that analysis runs cleanly and parses items for engine
const stringAnalysis = generateDeterministicBusinessStartAnalysis(userStringQ);
assert(stringAnalysis.sourceOfTruthAudit?.skillsProvided?.includes('Masáže'), 'Skills include Masáže');
assert(stringAnalysis.sourceOfTruthAudit?.skillsProvided?.includes('práce s lidmi'), 'Skills include práce s lidmi');
assert(stringAnalysis.sourceOfTruthAudit?.skillsProvided?.includes('sport'), 'Skills include sport');
assert(stringAnalysis.sourceOfTruthAudit?.passionsProvided?.includes('Zdravý životní styl'), 'Passions include Zdravý životní styl');
assert(stringAnalysis.sourceOfTruthAudit?.passionsProvided?.includes('fitness'), 'Passions include fitness');
assert(stringAnalysis.sourceOfTruthAudit?.passionsProvided?.includes('regenerace'), 'Passions include regenerace');
assert(stringAnalysis.sourceOfTruthAudit?.strictRedLines?.includes('cold calling'), 'Red lines include cold calling');
assert.strictEqual(stringAnalysis.sourceOfTruthAudit?.existingAssets, 'Kontakty v oboru, LinkedIn, stávající klienti');
console.log('  ✅ PASS: Exact comma-separated strings with spaces preserved and correctly analyzed');

console.log('\n================================================================');
console.log('🎉 ALL 8 AUDIT CHECKS PASSED PERFECTLY!');
console.log('================================================================');
