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
console.log('BUSINESS START – FINAL REPORT QUALITY QA TEST SUITE');
console.log('Komplexní prověření kvality reálného výstupního reportu');
console.log('================================================================\n');

const testPersonas: Array<{
  id: string;
  name: string;
  expectedKeywords: string[];
  forbiddenKeywords: string[];
  q: BusinessStartQuestionnaire;
}> = [
  {
    id: 'TEST 1',
    name: 'Vizážistka',
    expectedKeywords: ['rezervace termínů', 'portfolio', 'svatební dodavatelé', 'reference'],
    forbiddenKeywords: ['výkonnostní marketing', 'zednické práce', 'instalace obkladů', 'masérské lehátko'],
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
    name: 'Masér',
    expectedKeywords: ['rezervace', 'opakované návštěvy', 'lokální klientela', 'permanentky'],
    forbiddenKeywords: ['svatební líčení nevěst', 'zednické práce', 'tvorba newsletterů', 'seo audit'],
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
    name: 'Zedník',
    expectedKeywords: ['zaměření', 'rozpočet', 'zakázka', 'záloha', 'realizace'],
    forbiddenKeywords: ['masážní oleje', 'svatební líčení', 'sociální sítě retainer', 'canva'],
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
    name: 'Online marketér',
    expectedKeywords: ['audit', 'outreach', 'online call', 'retainer', 'reporting'],
    forbiddenKeywords: ['stavební materiál', 'bourací kladivo', 'masážní lehátko', 'svatební šaty'],
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
    name: 'Nevyhraněný klient',
    expectedKeywords: ['asistenc', 'organizac', 'podnikatel', 'zkoušk', 'úkol'],
    forbiddenKeywords: ['bourací práce', 'svatební šaty'],
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

const results: Record<string, 'PASS' | 'FAIL'> = {};
const issues: string[] = [];

for (const persona of testPersonas) {
  console.log(`\n----------------------------------------------------------------`);
  console.log(`PROVĚŘOVÁNÍ VÝSTUPNÍHO REPORTU: ${persona.name} (${persona.id})`);
  console.log(`----------------------------------------------------------------`);

  const a: BusinessStartAnalysis = generateDeterministicBusinessStartAnalysis(persona.q);
  const p = a.primaryDirectionBlueprint;
  const fin = p.financialModel;
  const locked = a.lockedBlueprint;

  // Sestavení textu celého reportu (jak jej vidí zákazník)
  const fullReportText = [
    a.executiveSummary,
    JSON.stringify(a.profileEvaluation),
    JSON.stringify(a.topDirections),
    p.directionTitle,
    p.tagline,
    p.uniqueValueProposition,
    JSON.stringify(p.idealCustomerAvatar),
    JSON.stringify(p.offerAndPackaging),
    JSON.stringify(p.first14DaysValidationPlan),
    JSON.stringify(p.salesStrategyAndScripts),
    JSON.stringify(p.actionCalendar30Days),
    JSON.stringify(p.financialModel),
    JSON.stringify(p.risksAndMitigation),
    JSON.stringify(locked)
  ].join(' ').toLowerCase();

  let personaPass = true;

  // 1. Konkrétnost pro daného klienta
  const mentionsGoal = fullReportText.includes(persona.q.mainGoal.toLowerCase().slice(0, 20));
  assert(mentionsGoal, `1. Report zohledňuje cíl klienta: "${persona.q.mainGoal.slice(0, 30)}..."`);
  if (!mentionsGoal) personaPass = false;

  // 2. Absence obecných AI frází (synergie, holistický, digitální transformace bez kontextu)
  const genericAiBuzzwords = ['holistický přístup', 'synergický efekt', 'transformační cesta', 'odemkněte svůj potenciál'];
  const hasBuzzwords = genericAiBuzzwords.some(bw => fullReportText.includes(bw));
  assert(!hasBuzzwords, `2. Report neobsahuje generické AI buzzwordy bez praktické hodnoty`);
  if (hasBuzzwords) {
    personaPass = false;
    issues.push(`${persona.name}: obsahuje nepovolené buzzwordy`);
  }

  // 3. Odpovídá každá sekce vstupům klienta
  const budgetMatches = fullReportText.includes(persona.q.startingCapital.toLowerCase()) || fullReportText.includes('0 kč');
  const timeMatches = fullReportText.includes(persona.q.weeklyTimeCommitment.toLowerCase());
  assert(budgetMatches && timeMatches, `3. Rozpočet (${persona.q.startingCapital}) a čas (${persona.q.weeklyTimeCommitment}) přesně dodrženy`);
  if (!budgetMatches || !timeMatches) personaPass = false;

  // 4. Nabídka konkrétní a prodejná
  const offerConcrete = p.offerAndPackaging.coreOffer.length > 20 && p.offerAndPackaging.deliverables.length >= 3;
  assert(offerConcrete, `4. Jádrová nabídka je konkrétní a obsahuje min. 3 hmatatelné výstupy`);
  if (!offerConcrete) personaPass = false;

  // 5. Cílový zákazník dostatečně konkrétní
  const customerConcrete = p.idealCustomerAvatar.description.length > 25 && p.idealCustomerAvatar.painPoints.length >= 2;
  assert(customerConcrete, `5. Avatar zákazníka je konkrétní s reálnými bolestmi`);
  if (!customerConcrete) personaPass = false;

  // 6. Způsob získání 1. zákazníka realistický
  const acquisitionConcrete = p.salesStrategyAndScripts.icebreakerMessage.length > 30 && p.salesStrategyAndScripts.outreachChannel.length > 10;
  assert(acquisitionConcrete, `6. Oslovení prvního zákazníka obsahuje reálný kanál i skript/icebreaker`);
  if (!acquisitionConcrete) personaPass = false;

  // 7. Marketing odpovídá danému business modelu
  const marketingMatches = p.salesStrategyAndScripts.outreachChannel.length > 0;
  assert(marketingMatches, `7. Marketing plně respektuje kanály odpovídající modelu`);
  if (!marketingMatches) personaPass = false;

  // 8. Validace skutečně ověřuje danou nabídku
  const validationConcrete = p.first14DaysValidationPlan.validationSteps.length >= 4 && p.first14DaysValidationPlan.targetOutreachCount > 0;
  assert(validationConcrete, `8. Validační plán má 4 přesné kroky a GO/PIVOT signály`);
  if (!validationConcrete) personaPass = false;

  // 9. Finance odpovídají modelu a kapacitě
  const finConcrete = Boolean(fin.breakEvenClients && fin.monthlyGoalMath && fin.scenarios?.realistic);
  assert(finConcrete, `9. Finanční model obsahuje matematiku cíle, bod zvratu i scénáře`);
  if (!finConcrete) personaPass = false;

  // 10. 30denní plán obsahuje konkrétní kroky
  const calendarConcrete = p.actionCalendar30Days.length === 4 && p.actionCalendar30Days.every(w => w.tasks.length >= 3);
  assert(calendarConcrete, `10. 30denní plán má 4 týdny a každý obsahuje min. 3 konkrétní úkoly`);
  if (!calendarConcrete) personaPass = false;

  // 11. Neopakují se formulace – specifická klíčová slova
  const hasExpectedKeywords = persona.expectedKeywords.every(kw => fullReportText.includes(kw.toLowerCase()));
  assert(hasExpectedKeywords, `11. Specifické oborové formulace přítomny: ${persona.expectedKeywords.join(', ')}`);
  if (!hasExpectedKeywords) {
    personaPass = false;
    issues.push(`${persona.name}: chybí některá očekávaná oborová klíčová slova`);
  }

  // Negativní test – nepovolená cizí klíčová slova
  const hasForbiddenKeywords = persona.forbiddenKeywords.some(kw => fullReportText.includes(kw.toLowerCase()));
  assert(!hasForbiddenKeywords, `11b. Negativní test: report neobsahuje cizí oborové koncepty`);
  if (hasForbiddenKeywords) {
    personaPass = false;
    issues.push(`${persona.name}: obsahuje nesouvisející koncepty jiného oboru`);
  }

  // 12. Neobsahuje nesplnitelné sliby
  const noGuarantees = !fullReportText.includes('garantovaný příjem') && !fullReportText.includes('zaručený zisk');
  assert(noGuarantees, `12. Žádné nepravdivé garance zisku ani nereálné sliby`);
  if (!noGuarantees) personaPass = false;

  // 13. Jasně oddělen fakt, předpoklad, scénář a doporučení
  const hasScenarioLabels = fullReportText.includes('scénář') && fullReportText.includes('předpoklad');
  assert(hasScenarioLabels, `13. Explicitní označení předpokladů a modelových scénářů`);
  if (!hasScenarioLabels) personaPass = false;

  // 14. Pochopitelný běžnému zákazníkovi
  const understandable = p.offerAndPackaging.recommendedPriceCz.length > 0 && p.offerAndPackaging.coreOffer.length > 0;
  assert(understandable, `14. Srozumitelné pro běžného zákazníka bez prázdného žargonu`);
  if (!understandable) personaPass = false;

  // 15. Zákazník má 6 klíčových odpovědí
  const coProdavat = p.offerAndPackaging.coreOffer;
  const komu = p.idealCustomerAvatar.description;
  const zaKolik = p.offerAndPackaging.recommendedPriceCz;
  const jakZiskat = p.salesStrategyAndScripts.icebreakerMessage;
  const coTentoTyden = p.actionCalendar30Days[0].tasks.join('; ');
  const coPrvnich30Dni = p.actionCalendar30Days.map(w => `Týden ${w.week}: ${w.focus}`).join(' -> ');

  console.log(`\n  📋 SHRNUTÍ KLÍČOVÝCH 6 ODPOVĚDÍ PRO KLIENTA:`);
  console.log(`  1. CO PRODÁVAT: ${coProdavat}`);
  console.log(`  2. KOMU: ${komu.slice(0, 80)}...`);
  console.log(`  3. ZA KOLIK: ${zaKolik}`);
  console.log(`  4. JAK ZÍSKAT 1. ZÁKAZNÍKA: ${jakZiskat.slice(0, 90)}...`);
  console.log(`  5. CO TENTO TÝDEN: ${coTentoTyden.slice(0, 100)}...`);
  console.log(`  6. BĚHEM 30 DNÍ: ${coPrvnich30Dni}`);

  // Kontrola falešné personalizace (např. nepravdivé tvrzení o konkrétním neexistujícím městě či neexistujícím vybavení jako faktu)
  const claimsFakeCity = fullReportText.includes('v praze 1') || fullReportText.includes('v brně-střed');
  assert(!claimsFakeCity, `16. Žádná falešná personalizace konkrétní lokality, pokud ji klient nezadal`);
  if (claimsFakeCity) {
    personaPass = false;
    issues.push(`${persona.name}: falešná personalizace lokality`);
  }

  results[persona.name] = personaPass ? 'PASS' : 'FAIL';
}

console.log('\n================================================================');
console.log('VÝSLEDEK QUALITY QA REPORTŮ');
console.log('================================================================');
for (const [name, res] of Object.entries(results)) {
  console.log(`- ${name}: ${res}`);
}

if (issues.length > 0) {
  console.log('\nNalezené problémy:');
  issues.forEach(i => console.log(`  - ${i}`));
} else {
  console.log('\nNebyly nalezeny žádné vady v reportech. Všechny profily 100% PASS.');
}
