import {
  evaluateClientConstraints,
  hardFilterCandidateModels,
  isOnlineOnlyBusinessModel,
  isPhysicalPersonalLocalBusinessModel
} from '../src/utils/businessStartCandidateFilter';
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
  console.log(`✅ PASS: ${message}`);
}

console.log('================================================================');
console.log('PODNIKAI BUSINESS START – TESTOVACÍ SCÉNÁŘE HARD FILTERINGU');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1 – VIZÁŽISTKA
// Cíl: „Chci podnikat jako vizážistka.“
// Typ práce: osobní práce s lidmi / lokální služba.
// Výsledek: pouze fyzické/lokální/osobní hlavní modely.
// Online-only model nesmí být hlavním doporučením.
// -----------------------------------------------------------------------------
console.log('--- TEST 1: VIZÁŽISTKA (Fyzická/lokální osobní služba) ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Kateřina Malá',
    mainGoal: 'Chci podnikat jako vizážistka.',
    preferredWorkType: 'Práce s lidmi osobně',
    customPreferredWorkType: 'Osobní práce s klientkami a svatební líčení',
    strictDislikesAndRedLines: ['Nechci celý den pracovat na PC', 'Cold calling'],
    startingCapital: 'do 10 000 Kč',
    weeklyTimeCommitment: '20 hodin týdně',
    operatingModel: 'offline',
    coreSkillsAndExpertise: ['Líčení a make-up', 'Péče o pleť', 'Komunikace se zákazníky']
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isPhysicalPersonalLocal === true, 'Test 1: constraint detekuje physical_personal_local');
  assert(constraints.isCustomTextPriority === true, 'Test 1: vlastní text má absolutní prioritu');
  assert(constraints.detectedDomain === 'makeup', 'Test 1: doména správně identifikována jako makeup');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.topDirections.find(d => d.isPrimary) || analysis.topDirections[0];

  assert(Boolean(primary), 'Test 1: primární směr existuje');
  assert(
    !isOnlineOnlyBusinessModel(primary),
    `Test 1: Primární směr NESMÍ být online-only model! Získáno: "${primary.title}"`
  );
  assert(
    isPhysicalPersonalLocalBusinessModel(primary),
    `Test 1: Primární směr MUSÍ být fyzická/lokální/osobní služba! Získáno: "${primary.title}"`
  );
  assert(
    primary.title.toLowerCase().includes('vizáž') || primary.title.toLowerCase().includes('líčen'),
    `Test 1: Primární směr musí přímo odpovídat vizážistice! Získáno: "${primary.title}"`
  );

  // Hard filter audit: ŽÁDNÝ kandidát v topDirections nesmí být online-only model
  for (const dir of analysis.topDirections) {
    assert(
      !isOnlineOnlyBusinessModel(dir),
      `Test 1: Žádný kandidát nesmí být online-only! Nalezeno: "${dir.title}"`
    );
    assert(
      isPhysicalPersonalLocalBusinessModel(dir),
      `Test 1: Všichni kandidáti musí být fyzické/lokální/osobní služby! Nalezeno: "${dir.title}"`
    );
  }

  // Validační brána
  assert(analysis.validationGate?.status === 'DONE', 'Test 1: Validační brána má status DONE');
  assert(analysis.validationGate?.clientGoalRespected === true, 'Test 1: clientGoalRespected je true');
  assert(analysis.validationGate?.typeOfWorkRespected === true, 'Test 1: typeOfWorkRespected je true');
  assert(analysis.validationGate?.physicalWorkSupported === true, 'Test 1: physicalWorkSupported je true');
  assert(analysis.validationGate?.localServiceSupported === true, 'Test 1: localServiceSupported je true');
}
console.log('Test 1 úspěšně dokončen.\n');

// -----------------------------------------------------------------------------
// TEST 2 – MASÉR
// Cíl: „Chci si otevřít vlastní masérské studio.“
// Typ práce: osobní práce s lidmi / vlastní studio.
// Výsledek: masérské služby, studio, mobilní masáže, B2B firemní masáže apod.
// Online agentura nesmí být hlavním směrem.
// -----------------------------------------------------------------------------
console.log('--- TEST 2: MASÉR (Osobní péče / masérské studio) ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Martin Kovář',
    mainGoal: 'Chci si otevřít vlastní masérské studio.',
    preferredWorkType: 'Vlastní provozovna / studio / dílna',
    customPreferredWorkType: 'Osobní práce s lidmi a vlastní masérské studio',
    strictDislikesAndRedLines: ['Celodenní sezení u počítače', 'Cold calling'],
    startingCapital: 'do 15 000 Kč',
    weeklyTimeCommitment: '25 hodin týdně',
    operatingModel: 'offline',
    coreSkillsAndExpertise: ['Sportovní masáže', 'Regenerace a rekondice', 'Ergonomie']
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isPhysicalPersonalLocal === true, 'Test 2: constraint detekuje physical_personal_local');
  assert(constraints.detectedDomain === 'masseur', 'Test 2: doména identifikována jako masseur');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.topDirections.find(d => d.isPrimary) || analysis.topDirections[0];

  assert(Boolean(primary), 'Test 2: primární směr existuje');
  assert(
    !isOnlineOnlyBusinessModel(primary),
    `Test 2: Online agentura NESMÍ být hlavním směrem! Získáno: "${primary.title}"`
  );
  assert(
    isPhysicalPersonalLocalBusinessModel(primary),
    `Test 2: Primární směr MUSÍ být fyzická/lokální masérská služba! Získáno: "${primary.title}"`
  );
  assert(
    primary.title.toLowerCase().includes('masér') || primary.title.toLowerCase().includes('regenerač'),
    `Test 2: Primární směr musí odpovídat masérským službám! Získáno: "${primary.title}"`
  );

  for (const dir of analysis.topDirections) {
    assert(
      !isOnlineOnlyBusinessModel(dir),
      `Test 2: Kandidát nesmí být online agentura! Nalezeno: "${dir.title}"`
    );
  }

  assert(analysis.validationGate?.status === 'DONE', 'Test 2: Validační brána má status DONE');
  assert(analysis.validationGate?.typeOfWorkRespected === true, 'Test 2: typeOfWorkRespected je true');
}
console.log('Test 2 úspěšně dokončen.\n');

// -----------------------------------------------------------------------------
// TEST 3 – ONLINE MARKETING
// Cíl: „Chci podnikat v online marketingu.“
// Typ práce: 100 % online/PC.
// Výsledek: online modely jsou povolené.
// -----------------------------------------------------------------------------
console.log('--- TEST 3: ONLINE MARKETING (100% online/PC) ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Jan Sýkora',
    mainGoal: 'Chci podnikat v online marketingu.',
    preferredWorkType: '100% práce na počítači / online',
    strictDislikesAndRedLines: ['Fyzická manuální práce', 'Dojíždění do provozovny'],
    startingCapital: '0 Kč',
    weeklyTimeCommitment: '20 hodin týdně',
    operatingModel: 'online',
    coreSkillsAndExpertise: ['Copywriting', 'Správa sociálních sítí', 'PPC kampaně']
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isOnlineOnly === true, 'Test 3: constraint detekuje online_only');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.topDirections.find(d => d.isPrimary) || analysis.topDirections[0];

  assert(Boolean(primary), 'Test 3: primární směr existuje');
  assert(
    isOnlineOnlyBusinessModel(primary) || primary.businessModel.toLowerCase().includes('online'),
    `Test 3: Pro online marketing MUSÍ být online model povolen! Získáno: "${primary.title}"`
  );

  assert(analysis.validationGate?.status === 'DONE', 'Test 3: Validační brána má status DONE');
  assert(analysis.validationGate?.onlineModelSupported === true, 'Test 3: onlineModelSupported je true');
}
console.log('Test 3 úspěšně dokončen.\n');

// -----------------------------------------------------------------------------
// TEST 4 – ŘEMESLNÍK (ZEDNÍK)
// Cíl: „Chci podnikat jako zedník.“
// Typ práce: fyzická práce / řemeslo / terén.
// Výsledek: lokální řemeslné služby.
// Online-only modely nesmí být hlavním směrem.
// -----------------------------------------------------------------------------
console.log('--- TEST 4: ŘEMESLNÍK / ZEDNÍK (Fyzická práce / řemeslo / terén) ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Pavel Novák',
    mainGoal: 'Chci podnikat jako zedník.',
    preferredWorkType: 'Fyzická práce / řemeslo / terén',
    strictDislikesAndRedLines: ['Práce u počítače', 'Cold calling'],
    startingCapital: 'do 20 000 Kč',
    weeklyTimeCommitment: '30 hodin týdně',
    operatingModel: 'offline',
    coreSkillsAndExpertise: ['Zednické práce', 'Obklady a dlažby', 'Rekonstrukce']
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isPhysicalPersonalLocal === true, 'Test 4: constraint detekuje physical_personal_local');
  assert(constraints.detectedDomain === 'craft_mason', 'Test 4: doména detekována jako craft_mason');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.topDirections.find(d => d.isPrimary) || analysis.topDirections[0];

  assert(Boolean(primary), 'Test 4: primární směr existuje');
  assert(
    !isOnlineOnlyBusinessModel(primary),
    `Test 4: Zedník NESMÍ mít online-only model jako hlavní směr! Získáno: "${primary.title}"`
  );
  assert(
    isPhysicalPersonalLocalBusinessModel(primary),
    `Test 4: Zedník MUSÍ mít fyzickou/lokální službu! Získáno: "${primary.title}"`
  );
  assert(
    primary.title.toLowerCase().includes('zedn') || primary.title.toLowerCase().includes('obklad'),
    `Test 4: Směr musí přímo odpovídat zednictví! Získáno: "${primary.title}"`
  );

  for (const dir of analysis.topDirections) {
    assert(
      !isOnlineOnlyBusinessModel(dir),
      `Test 4: Žádný kandidát nesmí být online-only! Nalezeno: "${dir.title}"`
    );
  }

  assert(analysis.validationGate?.status === 'DONE', 'Test 4: Validační brána má status DONE');
  assert(analysis.validationGate?.physicalWorkSupported === true, 'Test 4: physicalWorkSupported je true');
}
console.log('Test 4 úspěšně dokončen.\n');

// -----------------------------------------------------------------------------
// TEST 5 – NEVYHRANĚNÝ KLIENT
// Typ práce: „Nevím / ještě nemám vyhraněno.“
// Výsledek: systém může nabídnout kombinaci fyzických, lokálních, hybridních i online možností.
// -----------------------------------------------------------------------------
console.log('--- TEST 5: NEVYHRANĚNÝ KLIENT (Nevím / ještě nemám vyhraněno) ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Tereza Černá',
    mainGoal: 'Vybudovat stabilní podnikání a mít časovou flexibilitu.',
    preferredWorkType: 'Nevím / ještě nemám vyhraněno',
    customPreferredWorkType: '',
    strictDislikesAndRedLines: ['Cold calling'],
    startingCapital: '0 Kč',
    weeklyTimeCommitment: '20 hodin týdně',
    operatingModel: 'dont_know',
    coreSkillsAndExpertise: ['Organizace a koordinace', 'Komunikace', 'Zákaznická podpora']
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isUndetermined === true, 'Test 5: constraint detekuje undetermined');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  assert(analysis.topDirections.length >= 3, 'Test 5: Nabízí alespoň 3 různé směry');

  // Ověření, že systém nabízí vyvážené portfolio (hybridní, lokální i online)
  const hasLocalOrHybrid = analysis.topDirections.some(
    d => d.businessModel.toLowerCase().includes('hybrid') || d.businessModel.toLowerCase().includes('lokální')
  );
  const hasOnline = analysis.topDirections.some(
    d => d.businessModel.toLowerCase().includes('online')
  );

  assert(hasLocalOrHybrid, 'Test 5: Portfolio obsahuje lokální nebo hybridní možnost');
  assert(hasOnline, 'Test 5: Portfolio obsahuje online možnost');
  assert(analysis.validationGate?.status === 'DONE', 'Test 5: Validační brána má status DONE');
}
console.log('Test 5 úspěšně dokončen.\n');

// -----------------------------------------------------------------------------
// TEST 6: CUSTOM TEXT PRIORITY OVER PRE-SELECTED OPTION
// Ověření, že když klient napíše vlastní text s fyzickou službou ("Chci být vizážistka"),
// i kdyby v selectu zůstalo "online", vlastní text má absolutní přednost!
// -----------------------------------------------------------------------------
console.log('--- TEST 6: PRIORITA VLASTNÍHO TEXTU PŘED PRE-SELECTED MOŽNOSTÍ ---');
{
  const q: BusinessStartQuestionnaire = {
    ...createEmptyQuestionnaire(),
    clientName: 'Simona K.',
    mainGoal: 'Chci být vizážistka a pracovat s lidmi.',
    preferredWorkType: '100% práce na počítači / online', // select zůstal na online
    customPreferredWorkType: 'Chci líčit nevěsty a pracovat s lidmi osobně', // ale vlastní text je jednoznačný!
    strictDislikesAndRedLines: ['Nechci sedět celý den u PC'],
    operatingModel: 'online'
  };

  const constraints = evaluateClientConstraints(q);
  assert(constraints.isPhysicalPersonalLocal === true, 'Test 6: Vlastní text přebil select a nastavil physical_personal_local');
  assert(constraints.isCustomTextPriority === true, 'Test 6: isCustomTextPriority je true');

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.topDirections.find(d => d.isPrimary) || analysis.topDirections[0];
  assert(
    !isOnlineOnlyBusinessModel(primary),
    `Test 6: Vlastní text zamezil online agentuře! Získáno: "${primary.title}"`
  );
  assert(
    primary.title.toLowerCase().includes('vizáž') || primary.title.toLowerCase().includes('líčen'),
    `Test 6: Vlastní text vedl na vizážistiku! Získáno: "${primary.title}"`
  );
}
console.log('Test 6 úspěšně dokončen.\n');

console.log('================================================================');
console.log('🎉 VŠECHNY TESTOVACÍ SCÉNÁŘE ÚSPĚŠNĚ PROŠLY!');
console.log('================================================================');
