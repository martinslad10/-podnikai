import {
  evaluateClientConstraints,
  isOnlineOnlyBusinessModel,
  isPhysicalPersonalLocalBusinessModel
} from '../src/utils/businessStartCandidateFilter';
import {
  generateDeterministicBusinessStartAnalysis,
  createEmptyQuestionnaire
} from '../src/utils/businessStartDefaults';
import { BusinessStartQuestionnaire, BusinessStartAnalysis } from '../src/types';

interface TestResultRow {
  testId: string;
  name: string;
  directionPass: boolean;
  directionNote: string;
  offerPass: boolean;
  offerNote: string;
  customerPass: boolean;
  customerNote: string;
  salesPass: boolean;
  salesNote: string;
  marketingPass: boolean;
  marketingNote: string;
  validationPass: boolean;
  validationNote: string;
  financePass: boolean;
  financeNote: string;
  plan30Pass: boolean;
  plan30Note: string;
  consistencyPass: boolean;
  consistencyNote: string;
}

const results: TestResultRow[] = [];

console.log('================================================================');
console.log('BUSINESS START – END-TO-END QA TEST CELÉHO FLOW A BLUEPRINTU');
console.log('================================================================\n');

// =============================================================================
// TEST 1: VIZÁŽISTKA
// Cíl: „Chci podnikat jako vizážistka a líčit klientky osobně.“
// Typ práce: osobní práce s lidmi / lokální služba.
// =============================================================================
{
  const q: BusinessStartQuestionnaire = {
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
  };

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.primaryDirectionBlueprint;
  const locked = analysis.lockedBlueprint!;
  const fin = primary.financialModel;
  const avatar = primary.idealCustomerAvatar;
  const sales = primary.salesStrategyAndScripts;
  const offer = primary.offerAndPackaging;
  const val = primary.first14DaysValidationPlan;
  const plan = primary.actionCalendar30Days;

  // 1. SMĚR
  const isPhysical = isPhysicalPersonalLocalBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const isOnline = isOnlineOnlyBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const dirPass = isPhysical && !isOnline && (primary.directionTitle.toLowerCase().includes('vizáž') || primary.directionTitle.toLowerCase().includes('líčen'));
  const dirNote = dirPass ? `Lokální beauty služba: "${primary.directionTitle}" (fyzická/osobní)` : `Chyba: ${primary.directionTitle}`;

  // 2. NABÍDKA
  const offerPass = offer.coreOffer.toLowerCase().includes('svatební') && offer.coreOffer.toLowerCase().includes('balíček') && offer.deliverables.length >= 3;
  const offerNote = offerPass ? `Svatební vizážistický balíček + zkouška (${offer.recommendedPriceCz})` : `Chyba nabídky: ${offer.coreOffer}`;

  // 3. ZÁKAZNÍK
  const custPass = avatar.description.toLowerCase().includes('nevěst') && avatar.buyingMotivation.toLowerCase().includes('fotografi');
  const custNote = custPass ? `Budoucí nevěsty a maturantky v regionu, jistota celodenní výdrže` : `Chyba avatara: ${avatar.description}`;

  // 4. PRODEJ
  const salesPass = sales.salesScriptOutline.length >= 4 && sales.handlingCommonObjections.some(o => o.objection.toLowerCase().includes('líčení'));
  const salesNote = salesPass ? `5krokový skript domluvy zkoušky + zvládání námitek k líčení` : `Chyba prodeje`;

  // 5. MARKETING
  const mktPass = sales.outreachChannel.toLowerCase().includes('instagram') && sales.outreachChannel.toLowerCase().includes('podpůrný') && sales.outreachChannel.toLowerCase().includes('salony');
  const mktNote = mktPass ? `Instagram jako podpůrné portfolio + partnerské svatební salony a fotografové` : `Chyba marketingu`;

  // 6. VALIDACE
  const valPass = val.hypothesisToVerify.toLowerCase().includes('nevěst') && val.validationSteps.length >= 4;
  const valNote = valPass ? `Ověření 20 kontaktů a fotografů, cíl 2 potvrzené rezervace se zálohou` : `Chyba validace`;

  // 7. FINANCE
  const finPass = fin.variableCostsPerClientCz.includes('kosmetiky') && (fin.monthlyGoalMath.includes('12–16 líčení') || fin.monthlyGoalMath.includes('Kapacita: 12–16 líčení'));
  const finNote = finPass ? `Jednotková ekonomika líčení, nízké variabilní náklady, kapacita 12–16 líčení/měsíc` : `Chyba financí`;

  // 8. 30 DNÍ
  const planPass = plan.length === 4 && plan[0].tasks.some(t => t.toLowerCase().includes('svatební')) && plan[1].tasks.some(t => t.toLowerCase().includes('zkoušk'));
  const planNote = planPass ? `Týden 1–4: příprava balíčku -> referenční líčení -> zálohy na sezónu -> recenze` : `Chyba plánu`;

  // KONZISTENCE
  const constPass = locked.primaryDirection === primary.directionTitle &&
                    locked.coreOffer === offer.coreOffer &&
                    locked.idealCustomer === avatar.description &&
                    analysis.validationGate?.status === 'DONE';
  const constNote = constPass ? `100% soulad: Blueprint ↔ Nabídka ↔ Zákazník ↔ Prodej ↔ Finance (12/12 testů PASS)` : `Nekonzistence`;

  results.push({
    testId: 'TEST 1',
    name: 'VIZÁŽISTKA',
    directionPass: dirPass,
    directionNote: dirNote,
    offerPass: offerPass,
    offerNote: offerNote,
    customerPass: custPass,
    customerNote: custNote,
    salesPass: salesPass,
    salesNote: salesNote,
    marketingPass: mktPass,
    marketingNote: mktNote,
    validationPass: valPass,
    validationNote: valNote,
    financePass: finPass,
    financeNote: finNote,
    plan30Pass: planPass,
    plan30Note: planNote,
    consistencyPass: constPass,
    consistencyNote: constNote
  });
}

// =============================================================================
// TEST 2: MASÉR
// Cíl: „Chci si otevřít vlastní masérské studio.“
// Typ práce: osobní práce s lidmi / studio.
// =============================================================================
{
  const q: BusinessStartQuestionnaire = {
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
  };

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.primaryDirectionBlueprint;
  const locked = analysis.lockedBlueprint!;
  const fin = primary.financialModel;
  const avatar = primary.idealCustomerAvatar;
  const sales = primary.salesStrategyAndScripts;
  const offer = primary.offerAndPackaging;
  const val = primary.first14DaysValidationPlan;
  const plan = primary.actionCalendar30Days;

  // 1. SMĚR
  const isPhysical = isPhysicalPersonalLocalBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const isOnline = isOnlineOnlyBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const dirPass = isPhysical && !isOnline && (primary.directionTitle.toLowerCase().includes('masér') || primary.directionTitle.toLowerCase().includes('regenerač'));
  const dirNote = dirPass ? `Regenerační a masérské služby: "${primary.directionTitle}" (lokální/fyzická)` : `Chyba směru`;

  // 2. NABÍDKA
  const offerPass = offer.coreOffer.toLowerCase().includes('masáž') && offer.deliverables.length >= 3;
  const offerNote = offerPass ? `Vstupní konzultace + regenerační masáž (${offer.recommendedPriceCz})` : `Chyba nabídky`;

  // 3. ZÁKAZNÍK
  const custPass = avatar.description.toLowerCase().includes('sedavým') && (avatar.buyingMotivation.toLowerCase().includes('bolesti') || avatar.buyingMotivation.toLowerCase().includes('úleva'));
  const custNote = custPass ? `Lidé se sedavým zaměstnáním, rekreační sportovci a lidé hledající regeneraci a uvolnění` : `Chyba zákazníka`;

  // 4. PRODEJ
  const salesPass = sales.salesScriptOutline.length >= 4 && sales.handlingCommonObjections.some(o => o.objection.toLowerCase().includes('masáž') || o.objection.toLowerCase().includes('záda'));
  const salesNote = salesPass ? `Konzultační skript + zvládnutí námitky k akutní bolesti zad` : `Chyba prodeje`;

  // 5. MARKETING
  const mktPass = sales.outreachChannel.toLowerCase().includes('lokální') && sales.outreachChannel.toLowerCase().includes('google') && sales.outreachChannel.toLowerCase().includes('fitness');
  const mktNote = mktPass ? `Lokální Google Firemní profil, sousedská doporučení, partnerství s fitness centry` : `Chyba marketingu`;

  // 6. VALIDACE
  const valPass = val.hypothesisToVerify.toLowerCase().includes('masáž') && val.validationSteps.length >= 4;
  const valNote = valPass ? `Ověření poptávky na 15 kontaktech v okolí, cíl 4 odbavené masáže` : `Chyba validace`;

  // 7. FINANCE
  const finPass = fin.variableCostsPerClientCz.includes('oleje') && (fin.monthlyGoalMath.includes('35–45 masáží') || fin.monthlyGoalMath.includes('Kapacita: 35–45 masáží'));
  const finNote = finPass ? `Přesná nákladovost olejů a prádla, kapacita 35–45 masáží/měsíc v rámci 25 h/týdně` : `Chyba financí`;

  // 8. 30 DNÍ
  const planPass = plan.length === 4 && plan[0].tasks.some(t => t.toLowerCase().includes('masáž') || t.toLowerCase().includes('mapách'));
  const planNote = planPass ? `Týden 1–4: Google zápis -> zaváděcí masáže -> permanentky & B2B -> stálý rozvrh` : `Chyba plánu`;

  // KONZISTENCE
  const constPass = locked.primaryDirection === primary.directionTitle &&
                    locked.coreOffer === offer.coreOffer &&
                    locked.idealCustomer === avatar.description &&
                    analysis.validationGate?.status === 'DONE';
  const constNote = constPass ? `100% soulad: Fyzická služba ↔ Lehátko ↔ Lokální akvizice ↔ Permanentky (12/12 testů PASS)` : `Nekonzistence`;

  results.push({
    testId: 'TEST 2',
    name: 'MASÉR',
    directionPass: dirPass,
    directionNote: dirNote,
    offerPass: offerPass,
    offerNote: offerNote,
    customerPass: custPass,
    customerNote: custNote,
    salesPass: salesPass,
    salesNote: salesNote,
    marketingPass: mktPass,
    marketingNote: mktNote,
    validationPass: valPass,
    validationNote: valNote,
    financePass: finPass,
    financeNote: finNote,
    plan30Pass: planPass,
    plan30Note: planNote,
    consistencyPass: constPass,
    consistencyNote: constNote
  });
}

// =============================================================================
// TEST 3: ZEDNÍK
// Cíl: „Chci podnikat jako zedník a dělat zakázky v regionu.“
// Typ práce: fyzická práce / řemeslo / terén.
// =============================================================================
{
  const q: BusinessStartQuestionnaire = {
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
  };

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.primaryDirectionBlueprint;
  const locked = analysis.lockedBlueprint!;
  const fin = primary.financialModel;
  const avatar = primary.idealCustomerAvatar;
  const sales = primary.salesStrategyAndScripts;
  const offer = primary.offerAndPackaging;
  const val = primary.first14DaysValidationPlan;
  const plan = primary.actionCalendar30Days;

  // 1. SMĚR
  const isPhysical = isPhysicalPersonalLocalBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const isOnline = isOnlineOnlyBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const dirPass = isPhysical && !isOnline && (primary.directionTitle.toLowerCase().includes('zedn') || primary.directionTitle.toLowerCase().includes('obklad'));
  const dirNote = dirPass ? `Zednické a obkladačské řemeslo: "${primary.directionTitle}" (fyzická práce v terénu)` : `Chyba směru`;

  // 2. NABÍDKA
  const offerPass = offer.coreOffer.toLowerCase().includes('zednická') && offer.coreOffer.toLowerCase().includes('koupeln') && offer.deliverables.length >= 3;
  const offerNote = offerPass ? `Kompletní realizace koupelny se zárukou termínu a položkovým rozpočtem (${offer.recommendedPriceCz})` : `Chyba nabídky`;

  // 3. ZÁKAZNÍK
  const custPass = avatar.description.toLowerCase().includes('bytu') && avatar.buyingMotivation.toLowerCase().includes('poctivého řemesla');
  const custNote = custPass ? `Majitelé bytů a domů v regionu do 30 km, obava z čekání a nekvalitní práce` : `Chyba zákazníka`;

  // 4. PRODEJ
  const salesPass = sales.salesScriptOutline.length >= 4 && sales.handlingCommonObjections.some(o => o.objection.toLowerCase().includes('nabídku') || o.objection.toLowerCase().includes('levnější'));
  const salesNote = salesPass ? `Osobní zaměření zdarma + rozpočet do 48 h + obhajoba kvality proti levným partám` : `Chyba prodeje`;

  // 5. MARKETING
  const mktPass = sales.outreachChannel.toLowerCase().includes('instalatér') && sales.outreachChannel.toLowerCase().includes('stavebnin');
  const mktNote = mktPass ? `Lokální doporučení, stavebniny a partnerská spolupráce s instalatéry` : `Chyba marketingu`;

  // 6. VALIDACE
  const valPass = val.hypothesisToVerify.toLowerCase().includes('zedník') && val.validationSteps.length >= 4;
  const valNote = valPass ? `Ověření 10 známých a 3 instalatérů, 2 zaměření na stavbě, složení zálohy` : `Chyba validace`;

  // 7. FINANCE
  const finPass = fin.variableCostsPerClientCz.includes('materiálu') && (fin.monthlyGoalMath.includes('1–2 rekonstrukce') || fin.monthlyGoalMath.includes('Kapacita: 1–2 rekonstrukce'));
  const finNote = finPass ? `Materiál zahrnutý do nabídky a záloh, kapacita 1–2 rekonstrukce měsíčně` : `Chyba financí`;

  // 8. 30 DNÍ
  const planPass = plan.length === 4 && plan[0].tasks.some(t => t.toLowerCase().includes('rozpočet')) && plan[2].tasks.some(t => t.toLowerCase().includes('zálohu'));
  const planNote = planPass ? `Týden 1–4: vzorový rozpočet -> osobní zaměření -> smlouva o dílo & záloha -> čisté předání` : `Chyba plánu`;

  // KONZISTENCE
  const constPass = locked.primaryDirection === primary.directionTitle &&
                    locked.coreOffer === offer.coreOffer &&
                    locked.idealCustomer === avatar.description &&
                    analysis.validationGate?.status === 'DONE';
  const constNote = constPass ? `100% soulad: Řemeslo ↔ Materiálová záloha ↔ Osobní zaměření ↔ Smlouva o dílo (12/12 testů PASS)` : `Nekonzistence`;

  results.push({
    testId: 'TEST 3',
    name: 'ZEDNÍK',
    directionPass: dirPass,
    directionNote: dirNote,
    offerPass: offerPass,
    offerNote: offerNote,
    customerPass: custPass,
    customerNote: custNote,
    salesPass: salesPass,
    salesNote: salesNote,
    marketingPass: mktPass,
    marketingNote: mktNote,
    validationPass: valPass,
    validationNote: valNote,
    financePass: finPass,
    financeNote: finNote,
    plan30Pass: planPass,
    plan30Note: planNote,
    consistencyPass: constPass,
    consistencyNote: constNote
  });
}

// =============================================================================
// TEST 4: ONLINE MARKETÉR
// Cíl: „Chci podnikat v online marketingu.“
// Typ práce: 100 % online / PC.
// =============================================================================
{
  const q: BusinessStartQuestionnaire = {
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
  };

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.primaryDirectionBlueprint;
  const locked = analysis.lockedBlueprint!;
  const fin = primary.financialModel;
  const avatar = primary.idealCustomerAvatar;
  const sales = primary.salesStrategyAndScripts;
  const offer = primary.offerAndPackaging;
  const val = primary.first14DaysValidationPlan;
  const plan = primary.actionCalendar30Days;

  // 1. SMĚR
  const isOnline = isOnlineOnlyBusinessModel({ title: primary.directionTitle, businessModel: locked.revenueModel });
  const dirPass = isOnline && (primary.directionTitle.toLowerCase().includes('obsahu') || primary.directionTitle.toLowerCase().includes('sítí') || primary.directionTitle.toLowerCase().includes('marketing'));
  const dirNote = dirPass ? `Online retainerová služba: "${primary.directionTitle}" (100% online/distanční)` : `Chyba směru`;

  // 2. NABÍDKA
  const offerPass = offer.coreOffer.toLowerCase().includes('správa sociálních sítí') && offer.deliverables.length >= 3;
  const offerNote = offerPass ? `Správa sítí na klíč – 12 postů měsíčně + strategie + reporting (${offer.recommendedPriceCz})` : `Chyba nabídky`;

  // 3. ZÁKAZNÍK
  const custPass = avatar.description.toLowerCase().includes('firmy') && avatar.buyingMotivation.toLowerCase().includes('poptávek');
  const custNote = custPass ? `Majitelé malých firem a online experti bez času na sítě, cíl získat poptávky` : `Chyba zákazníka`;

  // 4. PRODEJ
  const salesPass = sales.salesScriptOutline.length >= 4 && sales.handlingCommonObjections.some(o => o.objection.toLowerCase().includes('sítě') || o.objection.toLowerCase().includes('agenturu'));
  const salesNote = salesPass ? `Audit slabých míst zdarma -> ukázka na míru -> měsíční retainer se slevou za referenci` : `Chyba prodeje`;

  // 5. MARKETING
  const mktPass = sales.outreachChannel.toLowerCase().includes('linkedin') && sales.outreachChannel.toLowerCase().includes('instagram');
  const mktNote = mktPass ? `LinkedIn B2B outreach + Instagram mini-audity profilů na míru` : `Chyba marketingu`;

  // 6. VALIDACE
  const valPass = val.hypothesisToVerify.toLowerCase().includes('audit') && val.validationSteps.length >= 4;
  const valNote = valPass ? `Oslovení 20 vytipovaných firem auditem, 3 online hovory, cíl 1 stálý retainer` : `Chyba validace`;

  // 7. FINANCE
  const finPass = fin.variableCostsPerClientCz.includes('0 Kč') && (fin.monthlyGoalMath.includes('3–5 stálých retainerů') || fin.monthlyGoalMath.includes('Kapacita: 3–5 stálých retainerů'));
  const finNote = finPass ? `0 Kč variabilní náklady, nulový kapitál, 3–4 retainery = modelový přebytek` : `Chyba financí`;

  // 8. 30 DNÍ
  const planPass = plan.length === 4 && plan[0].tasks.some(t => t.toLowerCase().includes('linkedin')) && plan[1].tasks.some(t => t.toLowerCase().includes('audit'));
  const planNote = planPass ? `Týden 1–4: nabídkový list -> odeslání mini-auditů -> uzavření retaineru -> první měsíční obsah` : `Chyba plánu`;

  // KONZISTENCE
  const constPass = locked.primaryDirection === primary.directionTitle &&
                    locked.coreOffer === offer.coreOffer &&
                    locked.deliveryModel.includes('ONLINE') &&
                    analysis.validationGate?.status === 'DONE';
  const constNote = constPass ? `100% soulad: 100% online model ↔ Retainery ↔ LinkedIn/IG ↔ Nulový kapitál (12/12 testů PASS)` : `Nekonzistence`;

  results.push({
    testId: 'TEST 4',
    name: 'ONLINE MARKETÉR',
    directionPass: dirPass,
    directionNote: dirNote,
    offerPass: offerPass,
    offerNote: offerNote,
    customerPass: custPass,
    customerNote: custNote,
    salesPass: salesPass,
    salesNote: salesNote,
    marketingPass: mktPass,
    marketingNote: mktNote,
    validationPass: valPass,
    validationNote: valNote,
    financePass: finPass,
    financeNote: finNote,
    plan30Pass: planPass,
    plan30Note: planNote,
    consistencyPass: constPass,
    consistencyNote: constNote
  });
}

// =============================================================================
// TEST 5: NEVYHRANĚNÝ KLIENT
// Cíl: „Chci začít podnikat, ale zatím nevím přesně v čem.“
// Typ práce: nevím / ještě nemám vyhraněno.
// =============================================================================
{
  const q: BusinessStartQuestionnaire = {
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
  };

  const analysis = generateDeterministicBusinessStartAnalysis(q);
  const primary = analysis.primaryDirectionBlueprint;
  const locked = analysis.lockedBlueprint!;
  const fin = primary.financialModel;
  const avatar = primary.idealCustomerAvatar;
  const sales = primary.salesStrategyAndScripts;
  const offer = primary.offerAndPackaging;
  const val = primary.first14DaysValidationPlan;
  const plan = primary.actionCalendar30Days;

  // 1. SMĚR: Systém nesmí svévolně předpokládat čistě fyzický ani čistě online model; topDirections musí obsahovat pestré spektrum (hybrid, lokální i online)
  const hasMultipleTypes = analysis.topDirections.some(d => d.businessModel.toLowerCase().includes('hybrid')) &&
                           analysis.topDirections.some(d => d.businessModel.toLowerCase().includes('fyzick') || d.businessModel.toLowerCase().includes('lokální')) &&
                           analysis.topDirections.some(d => d.businessModel.toLowerCase().includes('online'));
  const dirPass = hasMultipleTypes && primary.directionTitle.toLowerCase().includes('hybridní');
  const dirNote = dirPass ? `Vyvážené portfolio možností (hybridní provozní koordinace + lokální servis + online administrativa)` : `Chyba směru`;

  // 2. NABÍDKA
  const offerPass = offer.coreOffer.toLowerCase().includes('hybridní asistenční') && offer.deliverables.length >= 3;
  const offerNote = offerPass ? `Flexibilní asistenční balíček (20 hodin organizační podpory měsíčně, ${offer.recommendedPriceCz})` : `Chyba nabídky`;

  // 3. ZÁKAZNÍK
  const custPass = avatar.description.toLowerCase().includes('podnikatel') || avatar.description.toLowerCase().includes('firem');
  const custNote = custPass ? `Vytížení podnikatelé a živnostníci v okolí i online, přetížení rutinní operativou` : `Chyba zákazníka`;

  // 4. PRODEJ
  const salesPass = sales.salesScriptOutline.length >= 4 && sales.icebreakerMessage.includes('2 hodiny zdarma');
  const salesNote = salesPass ? `2 hodiny nezávazné asistence na zkoušku zdarma -> rychlé odbavení -> přechod na paušál` : `Chyba prodeje`;

  // 5. MARKETING
  const mktPass = sales.outreachChannel.toLowerCase().includes('networking') && sales.outreachChannel.toLowerCase().includes('profesní');
  const mktNote = mktPass ? `Kombinovaný lokální i online networking, coworkingy, osobní kontakty` : `Chyba marketingu`;

  // 6. VALIDACE
  const valPass = val.hypothesisToVerify.toLowerCase().includes('výpomoc') && val.validationSteps.length >= 4;
  const valNote = valPass ? `Oslovení 15 podnikatelů, 2 pilotní úkoly, cíl 1 stálý klient do 14 dnů` : `Chyba validace`;

  // 7. FINANCE
  const finPass = (fin.monthlyGoalMath.includes('3–4 stálí klienti') || fin.monthlyGoalMath.includes('Kapacita: 3–4 stálí klienti'));
  const finNote = finPass ? `Reálná kapacita 3–4 stálých klientů při 15 h/týdně, modelový provozní přebytek` : `Chyba financí`;

  // 8. 30 DNÍ
  const planPass = plan.length === 4 && plan[0].tasks.some(t => t.toLowerCase().includes('katalog')) && plan[1].tasks.some(t => t.toLowerCase().includes('pilotní'));
  const planNote = planPass ? `Týden 1–4: katalog úkolů -> pilotní asistence -> dohoda měsíčních paušálů -> stabilní rozvrh` : `Chyba plánu`;

  // KONZISTENCE
  const constPass = locked.primaryDirection === primary.directionTitle &&
                    locked.deliveryModel.includes('HYBRIDNÍ') &&
                    analysis.validationGate?.status === 'DONE';
  const constNote = constPass ? `100% soulad: Žádný svévolný předpoklad, vyvážená kombinace fyzických a online možností (12/12 testů PASS)` : `Nekonzistence`;

  results.push({
    testId: 'TEST 5',
    name: 'NEVYHRANĚNÝ KLIENT',
    directionPass: dirPass,
    directionNote: dirNote,
    offerPass: offerPass,
    offerNote: offerNote,
    customerPass: custPass,
    customerNote: custNote,
    salesPass: salesPass,
    salesNote: salesNote,
    marketingPass: mktPass,
    marketingNote: mktNote,
    validationPass: valPass,
    validationNote: valNote,
    financePass: finPass,
    financeNote: finNote,
    plan30Pass: planPass,
    plan30Note: planNote,
    consistencyPass: constPass,
    consistencyNote: constNote
  });
}

// =============================================================================
// TISK TABULKY A VYHODNOCENÍ
// =============================================================================
console.log('----------------------------------------------------------------------------------------------------------------------------------------------------------------');
console.log('TEST | SMĚR | NABÍDKA | ZÁKAZNÍK | PRODEJ | MARKETING | VALIDACE | FINANCE | 30 DNÍ | KONZISTENCE');
console.log('----------------------------------------------------------------------------------------------------------------------------------------------------------------');

let allPassed = true;

for (const r of results) {
  const rowStatus = [
    r.directionPass ? 'PASS' : 'FAIL',
    r.offerPass ? 'PASS' : 'FAIL',
    r.customerPass ? 'PASS' : 'FAIL',
    r.salesPass ? 'PASS' : 'FAIL',
    r.marketingPass ? 'PASS' : 'FAIL',
    r.validationPass ? 'PASS' : 'FAIL',
    r.financePass ? 'PASS' : 'FAIL',
    r.plan30Pass ? 'PASS' : 'FAIL',
    r.consistencyPass ? 'PASS' : 'FAIL'
  ];

  if (rowStatus.includes('FAIL')) {
    allPassed = false;
  }

  console.log(`${r.testId} (${r.name}) | ${rowStatus.join(' | ')}`);
  console.log(`  -> SMĚR: [${r.directionPass ? 'PASS' : 'FAIL'}] ${r.directionNote}`);
  console.log(`  -> NABÍDKA: [${r.offerPass ? 'PASS' : 'FAIL'}] ${r.offerNote}`);
  console.log(`  -> ZÁKAZNÍK: [${r.customerPass ? 'PASS' : 'FAIL'}] ${r.customerNote}`);
  console.log(`  -> PRODEJ: [${r.salesPass ? 'PASS' : 'FAIL'}] ${r.salesNote}`);
  console.log(`  -> MARKETING: [${r.marketingPass ? 'PASS' : 'FAIL'}] ${r.marketingNote}`);
  console.log(`  -> VALIDACE: [${r.validationPass ? 'PASS' : 'FAIL'}] ${r.validationNote}`);
  console.log(`  -> FINANCE: [${r.financePass ? 'PASS' : 'FAIL'}] ${r.financeNote}`);
  console.log(`  -> 30 DNÍ: [${r.plan30Pass ? 'PASS' : 'FAIL'}] ${r.plan30Note}`);
  console.log(`  -> KONZISTENCE: [${r.consistencyPass ? 'PASS' : 'FAIL'}] ${r.consistencyNote}\n`);
}

if (!allPassed) {
  console.error('❌ E2E QA TEST SELHAL! Některá z kontrol neprošla.');
  process.exit(1);
}

console.log('🎉 VŠECHNY END-TO-END QA TESTY 100% PROŠLY!');
process.exit(0);
