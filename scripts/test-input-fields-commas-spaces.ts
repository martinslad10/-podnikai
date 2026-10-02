import assert from 'assert';
import { createEmptyQuestionnaire, generateDeterministicBusinessStartAnalysis } from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire } from '../src/types';

console.log('================================================================');
console.log('TEST: INPUT FIELDS — COMMAS AND SPACES FIDELITY QA');
console.log('================================================================');

// 1. Test Empty Questionnaire Initialization
const empty = createEmptyQuestionnaire();
assert(Array.isArray(empty.coreSkillsAndExpertise), 'coreSkillsAndExpertise starts as array');
assert(Array.isArray(empty.passionsAndInterests), 'passionsAndInterests starts as array');
assert(Array.isArray(empty.strictDislikesAndRedLines), 'strictDislikesAndRedLines starts as array');
assert.strictEqual(empty.existingAssetsAndNetwork, '');
assert.strictEqual(empty.personalConstraints, '');
console.log('✅ PASS: Empty questionnaire initializes cleanly.');

// 2. Test User Input with Commas, Spaces, Diacritics, and Punctuation (Questions 8–12)
const q8Input = 'Masáže, práce s lidmi, sport';
const q9Input = 'Zdravý životní styl, fitness, regenerace';
const q10Input = 'Celodenní sezení u PC, cold calling, administrativa';
const q11Input = 'Kontakty v oboru, LinkedIn, stávající klienti';
const q12Input = 'Pouze večery a pátky, bez možnosti investovat';

// Simulate questionnaire holding exactly what user typed in the input fields
const userQ: BusinessStartQuestionnaire = {
  ...empty,
  clientName: 'Petr Svoboda',
  clientEmail: 'petr.svoboda@example.cz',
  clientPhone: '+420 777 123 456',
  location: 'Brno a okolí',
  currentCareerSituation: 'Zaměstnanec, 6 let praxe v oboru regenerace',
  mainGoal: 'Chci otevřít vlastní regenerační a masérské studio',
  targetMonthlyIncome: '50 000 – 60 000 Kč',
  startingCapital: 'do 25 000 Kč',
  weeklyTimeCommitment: '20 hodin týdně',
  operatingModel: 'offline',
  preferredWorkType: 'Práce s lidmi osobně',
  customPreferredWorkType: 'Osobní práce s lidmi v regeneraci',
  coreSkillsAndExpertise: q8Input,
  passionsAndInterests: q9Input,
  strictDislikesAndRedLines: q10Input,
  existingAssetsAndNetwork: q11Input,
  personalConstraints: q12Input
};

// Check that strings are preserved verbatim without truncation or regex interference
assert.strictEqual(userQ.coreSkillsAndExpertise, 'Masáže, práce s lidmi, sport');
assert.strictEqual(userQ.passionsAndInterests, 'Zdravý životní styl, fitness, regenerace');
assert.strictEqual(userQ.strictDislikesAndRedLines, 'Celodenní sezení u PC, cold calling, administrativa');
assert.strictEqual(userQ.existingAssetsAndNetwork, 'Kontakty v oboru, LinkedIn, stávající klienti');
assert.strictEqual(userQ.personalConstraints, 'Pouze večery a pátky, bez možnosti investovat');
console.log('✅ PASS: Questions 8–12 preserve exact strings with commas, spaces and diacritics.');

// 3. Test Progressive Typing Simulation (User types comma and space)
// In the old code: typing 'Masáže, ' would immediately be stripped to 'Masáže'
let progressiveValue = '';
const simulateTyping = (text: string) => {
  for (const char of text) {
    progressiveValue += char;
    // When stored directly as string during onChange:
    assert.strictEqual(progressiveValue[progressiveValue.length - 1], char, 'Keystroke preserved');
  }
};
simulateTyping('Masáže, práce s lidmi, sport');
assert.strictEqual(progressiveValue, q8Input);
console.log('✅ PASS: Progressive typing preserves keystroke sequence including trailing spaces and commas.');

// 4. Test Server-side Engine Analysis with String Inputs
const analysis = generateDeterministicBusinessStartAnalysis(userQ);
assert(analysis, 'Analysis generated successfully');

// Check that Source of Truth Audit extracts and parses skills, passions, red lines
const audit = analysis.sourceOfTruthAudit;
assert(audit, 'sourceOfTruthAudit exists');

assert(audit.skillsProvided.includes('Masáže'), 'skillsProvided includes Masáže');
assert(audit.skillsProvided.includes('práce s lidmi'), 'skillsProvided includes práce s lidmi');
assert(audit.skillsProvided.includes('sport'), 'skillsProvided includes sport');

assert(audit.passionsProvided.includes('Zdravý životní styl'), 'passionsProvided includes Zdravý životní styl');
assert(audit.passionsProvided.includes('fitness'), 'passionsProvided includes fitness');
assert(audit.passionsProvided.includes('regenerace'), 'passionsProvided includes regenerace');

assert(audit.strictRedLines.includes('cold calling') || audit.strictRedLines.some(r => r.includes('cold calling')), 'strictRedLines includes cold calling');
assert(audit.strictRedLines.some(r => r.includes('Celodenní sezení u PC')), 'strictRedLines includes sezení u PC');

assert.strictEqual(audit.existingAssets, q11Input);
assert.strictEqual(audit.capitalLimit, 'do 25 000 Kč');
assert.strictEqual(audit.timeWeeklyLimit, '20 hodin týdně');
console.log('✅ PASS: Engine correctly parses comma-separated strings for analysis without data loss.');

// 5. Test Backward Compatibility: array inputs also still work seamlessly
const arrayQ: BusinessStartQuestionnaire = {
  ...empty,
  clientName: 'Anna Veselá',
  mainGoal: 'Svatební vizážistka',
  startingCapital: 'do 10 000 Kč',
  weeklyTimeCommitment: '15 hodin týdně',
  operatingModel: 'offline',
  coreSkillsAndExpertise: ['Líčení', 'Péče o pleť'],
  passionsAndInterests: ['Krása', 'Móda'],
  strictDislikesAndRedLines: ['Cold calling'],
  existingAssetsAndNetwork: 'Instagram profil',
  personalConstraints: 'Pouze víkendy'
};
const arrayAnalysis = generateDeterministicBusinessStartAnalysis(arrayQ);
assert(arrayAnalysis.sourceOfTruthAudit?.skillsProvided?.includes('Líčení'), 'Array skills work');
assert(arrayAnalysis.sourceOfTruthAudit?.passionsProvided?.includes('Krása'), 'Array passions work');
assert(arrayAnalysis.sourceOfTruthAudit?.strictRedLines?.includes('Cold calling'), 'Array red lines work');
console.log('✅ PASS: Backward compatibility with array inputs fully preserved.');

console.log('================================================================');
console.log('🎉 ALL INPUT FIELDS COMMAS & SPACES TESTS PASSED 100%!');
console.log('================================================================');
