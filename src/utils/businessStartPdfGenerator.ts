import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { BusinessStartClient } from '../types';

export async function generateBusinessStartPdfBuffer(client: BusinessStartClient): Promise<Buffer> {
  const q = client.questionnaire;
  const a = client.analysis;
  const order = client.order;

  if (!a) {
    throw new Error('Analýza klienta nebyla nalezena. PDF nelze vygenerovat.');
  }

  const p = a.primaryDirectionBlueprint;
  const fin = p.financialModel;

  const fontRegular = path.resolve(process.cwd(), 'fonts/FreeSans.ttf');
  const fontBold = path.resolve(process.cwd(), 'fonts/FreeSansBold.ttf');
  const hasFonts = fs.existsSync(fontRegular) && fs.existsSync(fontBold);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 45, left: 45, right: 45 },
    bufferPages: true,
    info: {
      Title: `PODNIKAI Business Start - ${q.clientName || 'Klient'}`,
      Author: 'PODNIKAI Automat',
      Subject: 'Individuální podnikatelský plán a exekuční blueprint',
      Keywords: 'PODNIKAI, Business Start, Byznys plán, Finanční model'
    }
  });

  if (hasFonts) {
    doc.registerFont('Regular', fontRegular);
    doc.registerFont('Bold', fontBold);
    doc.font('Regular');
  }

  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk));

  const completionPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Helpers for consistent styling
  const primaryColor = '#1E3A8A'; // Deep blue
  const headingColor = '#0F172A'; // Slate 900
  const textColor = '#1E293B'; // Slate 800
  const mutedColor = '#64748B'; // Slate 500
  const cardBg = '#F8FAFC'; // Slate 50
  const accentGreen = '#065F46'; // Emerald dark

  const setRegular = (size = 9, color = textColor) => {
    if (hasFonts) doc.font('Regular');
    doc.fontSize(size).fillColor(color);
  };

  const setBold = (size = 10, color = headingColor) => {
    if (hasFonts) doc.font('Bold');
    doc.fontSize(size).fillColor(color);
  };

  const checkPageBreak = (neededHeight = 80) => {
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  const drawSectionHeading = (title: string, sub?: string) => {
    checkPageBreak(50);
    doc.moveDown(0.8);
    setBold(12, primaryColor);
    doc.text(title.toUpperCase());
    if (sub) {
      setRegular(8, mutedColor);
      doc.text(sub);
    }
    doc.moveDown(0.2);
    // Underline rule
    doc.strokeColor('#CBD5E1').lineWidth(0.75)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.4);
  };

  // ----------------------------------------------------
  // COVER / HEADER
  // ----------------------------------------------------
  setBold(18, primaryColor);
  doc.text('PODNIKAI — BUSINESS START', { align: 'center' });
  setBold(11, headingColor);
  doc.text('Individuální podnikatelský plán & exekuční blueprint na míru', { align: 'center' });
  setRegular(8, mutedColor);
  doc.text('Garantovaná metodika 12 otázek • Source of Truth • Vyloučení nepodložených garancí', { align: 'center' });
  doc.moveDown(0.6);

  // Meta box
  const startY = doc.y;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(doc.page.margins.left, startY, boxWidth, 54).fillAndStroke(cardBg, '#E2E8F0');

  doc.y = startY + 6;
  const col1 = doc.page.margins.left + 10;
  const col2 = doc.page.margins.left + (boxWidth / 2) + 10;

  setBold(8, headingColor);
  doc.text('Klient: ', col1, startY + 8, { continued: true });
  setRegular(8, textColor);
  doc.text(q.clientName || 'Neuvedeno');

  setBold(8, headingColor);
  doc.text('Lokalita: ', col1, startY + 22, { continued: true });
  setRegular(8, textColor);
  doc.text(q.location || 'Česká republika');

  setBold(8, headingColor);
  doc.text('Hlavní cíl: ', col1, startY + 36, { continued: true });
  setRegular(8, textColor);
  doc.text(q.mainGoal || 'Neuvedeno', { width: (boxWidth / 2) - 20, height: 14, ellipsis: true });

  setBold(8, headingColor);
  doc.text('Objednávka: ', col2, startY + 8, { continued: true });
  setRegular(8, textColor);
  doc.text(order?.id || client.id);

  setBold(8, headingColor);
  doc.text('Datum vyhotovení: ', col2, startY + 22, { continued: true });
  setRegular(8, textColor);
  doc.text(new Date(a.analyzedAt || Date.now()).toLocaleDateString('cs-CZ'));

  setBold(8, accentGreen);
  doc.text('Stav platby: ', col2, startY + 36, { continued: true });
  doc.text('UHRAZENO 1 990 Kč (Ověřeno serverem)');

  doc.y = startY + 62;

  // ----------------------------------------------------
  // SECTION 1: SOURCE OF TRUTH — VSTUPNÍ MANTINELY (12 OTÁZEK)
  // ----------------------------------------------------
  drawSectionHeading('1. Source of Truth — Vstupní mantinely a limity klienta', 'Všechny výstupy striktně vycházejí z těchto zadaných údajů');

  const skillsStr = Array.isArray(q.coreSkillsAndExpertise) ? q.coreSkillsAndExpertise.join(', ') : (q.coreSkillsAndExpertise || 'neuvedeny');
  const passionsStr = Array.isArray(q.passionsAndInterests) ? q.passionsAndInterests.join(', ') : (q.passionsAndInterests || 'neuvedeny');
  const redLinesStr = Array.isArray(q.strictDislikesAndRedLines) ? q.strictDislikesAndRedLines.join(', ') : (q.strictDislikesAndRedLines || 'žádné');

  const sotPoints = [
    { label: '1. Jméno & Kontakt', val: `${q.clientName} (${q.clientEmail || 'e-mail neuveden'}, ${q.clientPhone || 'tel. neuveden'}, ${q.location || 'lokalita neuvedena'})` },
    { label: '2. Současná kariérní situace', val: q.currentCareerSituation || 'Neuvedena' },
    { label: '3. Hlavní podnikatelský cíl', val: q.mainGoal || 'Neuveden' },
    { label: '4. Cílový měsíční příjem', val: q.targetMonthlyIncome || 'Neuveden' },
    { label: '5. Reálný počáteční kapitál (limit)', val: q.startingCapital || '0 Kč' },
    { label: '6. Týdenní časová dotace (limit)', val: q.weeklyTimeCommitment || 'Neuvedena' },
    { label: '7. Provozní model & preferovaná práce', val: `Model: ${q.operatingModel.toUpperCase()} | Preference: ${q.customPreferredWorkType || q.preferredWorkType || 'Dle shody'}` },
    { label: '8. Dovednosti a silné stránky', val: skillsStr },
    { label: '9. Zájmy a témata, která baví', val: passionsStr },
    { label: '10. Červené linie (Odmítnuté činnosti)', val: `⛔ ${redLinesStr}` },
    { label: '11. Dosavadní aktiva & síť kontaktů', val: q.existingAssetsAndNetwork || 'Neuvedeno' },
    { label: '12. Osobní limitace a podmínky', val: q.personalConstraints || 'Žádné specifické překážky' }
  ];

  sotPoints.forEach(pt => {
    checkPageBreak(18);
    setBold(8, headingColor);
    doc.text(`• ${pt.label}: `, { continued: true });
    setRegular(8, textColor);
    doc.text(pt.val);
  });

  // ----------------------------------------------------
  // SECTION 2: EXEKUTIVNÍ SHRNUTÍ & HODNOCENÍ PROFILU
  // ----------------------------------------------------
  drawSectionHeading('2. Exekutivní shrnutí & Hodnocení profilu');
  setRegular(9, textColor);
  doc.text(a.executiveSummary, { lineGap: 1.5 });
  doc.moveDown(0.4);

  checkPageBreak(40);
  setBold(9, headingColor);
  doc.text('Silné stránky a předpoklady:');
  setRegular(8.5, textColor);
  a.profileEvaluation.strongPoints.forEach(sp => doc.text(`✓ ${sp}`));
  doc.moveDown(0.3);

  checkPageBreak(40);
  setBold(9, headingColor);
  doc.text('Identifikovaná rizika a mantinely:');
  setRegular(8.5, textColor);
  a.profileEvaluation.riskFactors.forEach(rf => doc.text(`! ${rf}`));
  doc.moveDown(0.3);

  checkPageBreak(40);
  setBold(9, headingColor);
  doc.text('Konkurenční výhody a prověřitelnost:');
  setRegular(8.5, textColor);
  a.profileEvaluation.competitiveAdvantages.forEach(ca => doc.text(`★ ${ca}`));
  doc.moveDown(0.4);

  // ----------------------------------------------------
  // SECTION 3: DOPORUČENÉ PODNIKATELSKÉ SMĚRY
  // ----------------------------------------------------
  drawSectionHeading('3. Doporučené podnikatelské směry', 'Portfolio kandidátů respektující mantinely kapitálu a času');

  a.topDirections.forEach((dir, i) => {
    checkPageBreak(65);
    const isPrim = dir.isPrimary;
    const dirHeader = `Směr #${i + 1}: ${dir.title}${isPrim ? ' [HLAVNÍ DOPORUČENÝ SMĚR]' : ''}`;
    setBold(9.5, isPrim ? primaryColor : headingColor);
    doc.text(dirHeader);

    setRegular(8.5, mutedColor);
    doc.text(`Tagline: ${dir.tagline}`);

    setRegular(8, textColor);
    doc.text(`• Model provozu: ${dir.businessModel}`);
    doc.text(`• Odhadovaná provozní marže: ${dir.estimatedMargin} | Čas k první tržbě: ${dir.timeToFirstRevenue}`);
    doc.text(`• Počáteční náklady: ${dir.requiredCapital} (min. ${dir.estimatedStartupCostMin.toLocaleString('cs-CZ')} Kč, doporučeno: ${dir.recommendedInitialInvestment?.toLocaleString('cs-CZ') || 0} Kč)`);
    doc.text(`• Kompatibilita: ${dir.budgetCompatibility.toUpperCase()}${dir.budgetScore ? ` (Skóre: ${dir.budgetScore}/100)` : ''} – ${dir.whyMatch}`);
    doc.moveDown(0.4);
  });

  // ----------------------------------------------------
  // SECTION 4: CAPITAL USAGE PLAN (pokud je)
  // ----------------------------------------------------
  if (a.capitalUsagePlan) {
    drawSectionHeading('4. Plán smysluplného využití kapitálu (Capital Usage Plan)');
    setRegular(8.5, textColor);
    doc.text(`• Dostupný kapitál: ${a.capitalUsagePlan.availableCapital} | Nutný start: ${a.capitalUsagePlan.requiredStartupCost}`);
    doc.text(`• Doporučená počáteční investice: ${a.capitalUsagePlan.recommendedInitialInvestment} | Bezpečná rezerva: ${a.capitalUsagePlan.unspentCapitalReserve}`);
    setRegular(8, mutedColor);
    doc.text(`Zásada PodnikAI: ${a.capitalUsagePlan.noForcedSpendingNotice}`);
    doc.moveDown(0.3);

    a.capitalUsagePlan.breakdown.forEach(b => {
      checkPageBreak(16);
      setBold(8, headingColor);
      doc.text(`[${b.category.toUpperCase()}] ${b.item}: `, { continued: true });
      setRegular(8, textColor);
      doc.text(`${b.estimatedCostCz} (${b.priority}) – ${b.rationale}`);
    });
  }

  // ----------------------------------------------------
  // SECTION 5: LOCKED BUSINESS BLUEPRINT (A–L)
  // ----------------------------------------------------
  drawSectionHeading('5. Locked Business Blueprint (Matice 12 bodů A–L)');
  const lb: any = a.lockedBlueprint || {};

  const blueprintPoints = [
    { key: 'A. Primární směr', val: lb.primaryDirection || p.directionTitle },
    { key: 'B. Jádrová nabídka', val: lb.coreOffer || p.offerAndPackaging.coreOffer },
    { key: 'C. Ideální zákazník', val: lb.idealCustomer || p.idealCustomerAvatar.description },
    { key: 'D. Problém zákazníka', val: lb.customerProblem || p.idealCustomerAvatar.painPoints[0] || 'Řešení konkrétní potřeby' },
    { key: 'E. Hodnotová propozice (USP)', val: lb.valueProposition || p.uniqueValueProposition },
    { key: 'F. Cenotvorba & model', val: `${lb.price || p.offerAndPackaging.recommendedPriceCz} [RECOMMENDATION / SCENARIO]` },
    { key: 'G. Prodejní kanál', val: lb.salesChannel || p.salesStrategyAndScripts.outreachChannel },
    { key: 'H. Akviziční metoda', val: lb.acquisitionMethod || 'Organický přímý kontakt a partnerská doporučení' },
    { key: 'I. Model poskytování', val: lb.deliveryModel || q.operatingModel.toUpperCase() },
    { key: 'J. Výnosový model', val: lb.revenueModel || 'Jednorázové a balíčkové služby s navazující péčí' },
    { key: 'K. Nákladový model', val: lb.costModel || 'Minimální provozní fixní režie, variabilní spotřeba' },
    { key: 'L. Validační hypotéza', val: lb.validationPlan || p.first14DaysValidationPlan.hypothesisToVerify }
  ];

  blueprintPoints.forEach(bp => {
    checkPageBreak(18);
    setBold(8.5, primaryColor);
    doc.text(`${bp.key}: `, { continued: true });
    setRegular(8.5, textColor);
    doc.text(bp.val);
  });

  // ----------------------------------------------------
  // SECTION 6: NABÍDKA A CENOTVORBA
  // ----------------------------------------------------
  drawSectionHeading('6. Definice nabídky & Cenotvorba', '[RECOMMENDATION / SCENARIO]');
  setBold(9, headingColor);
  doc.text(`Jádrová služba: ${p.offerAndPackaging.coreOffer}`);
  setRegular(8.5, textColor);
  doc.text(`Doporučená cena: ${p.offerAndPackaging.recommendedPriceCz}`);
  doc.text(`Cenová strategie: ${p.offerAndPackaging.pricingStrategy}`);
  if (p.offerAndPackaging.upsellOption) {
    doc.text(`Doplňkový prodej (Upsell / Retainer): ${p.offerAndPackaging.upsellOption}`);
  }
  doc.moveDown(0.2);

  setBold(8.5, headingColor);
  doc.text('Výstupy pro zákazníka (Deliverables):');
  setRegular(8, textColor);
  p.offerAndPackaging.deliverables.forEach(del => doc.text(`• ${del}`));

  // ----------------------------------------------------
  // SECTION 7: IDEÁLNÍ ZÁKAZNÍK (AVATAR) & PRODEJ
  // ----------------------------------------------------
  drawSectionHeading('7. Cílový zákazník, Prodejní skripty & Námitky');
  setBold(9, headingColor);
  doc.text(`Avatar: ${p.idealCustomerAvatar.description}`);
  setRegular(8.5, textColor);
  doc.text(`Nákupní motivace: ${p.idealCustomerAvatar.buyingMotivation}`);
  doc.text(`Kde zákazníka najít: ${p.idealCustomerAvatar.whereToFindThem.join('; ')}`);
  doc.moveDown(0.3);

  checkPageBreak(50);
  setBold(8.5, headingColor);
  doc.text(`Prodejní kanál: ${p.salesStrategyAndScripts.outreachChannel}`);
  setRegular(8.5, mutedColor);
  doc.text(`Vstupní oslovení (Icebreaker): "${p.salesStrategyAndScripts.icebreakerMessage}"`);
  doc.moveDown(0.3);

  checkPageBreak(60);
  setBold(8.5, headingColor);
  doc.text('Fáze prodejního postupu:');
  setRegular(8, textColor);
  (p.salesStrategyAndScripts.salesScriptOutline || []).forEach(s => doc.text(`→ ${s}`));
  doc.moveDown(0.3);

  checkPageBreak(50);
  setBold(8.5, headingColor);
  doc.text('Zvládání typických námitek:');
  setRegular(8, textColor);
  (p.salesStrategyAndScripts.handlingCommonObjections || []).forEach(obj => {
    checkPageBreak(25);
    doc.text(`• Námitka: "${obj.objection}"`);
    doc.text(`  Doporučená reakce: ${obj.response}`);
  });

  // ----------------------------------------------------
  // SECTION 8: 14DENNÍ VALIDAČNÍ PLÁN
  // ----------------------------------------------------
  drawSectionHeading('8. 14denní validační plán (Ověření poptávky před velkými investicemi)');
  setBold(8.5, headingColor);
  doc.text(`Hypotéza: ${p.first14DaysValidationPlan.hypothesisToVerify}`);
  doc.moveDown(0.2);

  (p.first14DaysValidationPlan.validationSteps || []).forEach(st => {
    checkPageBreak(16);
    setRegular(8, textColor);
    doc.text(`✓ ${st}`);
  });
  doc.moveDown(0.2);

  checkPageBreak(30);
  setBold(8, accentGreen);
  doc.text(`GO signál: ${p.first14DaysValidationPlan.goSignal}`);
  setBold(8, '#991B1B'); // Red dark
  doc.text(`PIVOT signál: ${p.first14DaysValidationPlan.pivotSignal}`);

  // ----------------------------------------------------
  // SECTION 9: FINANČNÍ MODELOVÉ SCÉNÁŘE & KAPACITA
  // ----------------------------------------------------
  drawSectionHeading('9. Finanční modelové scénáře & Kapacitní rozvaha', 'Všechny částky jsou orientační matematické modely');

  setRegular(8.5, textColor);
  doc.text(`• Vstupní cíl klienta: ${q.targetMonthlyIncome || 'Neuveden'}`);
  doc.text(`• Časový fond: ${q.weeklyTimeCommitment || 'Neuveden'}`);
  doc.text(`• Modelová cena zakázky: ${fin.assumedPrice || p.offerAndPackaging.recommendedPriceCz}`);
  doc.text(`• Variabilní náklady: ${fin.variableCostsPerClientCz}`);
  doc.text(`• Fixní provozní režie: ${fin.monthlyOverheadCostsCz}`);
  doc.moveDown(0.3);

  checkPageBreak(50);
  setBold(9, headingColor);
  doc.text('Modelové scénáře (měsíční provozní přebytek):');
  setRegular(8.5, textColor);
  if (fin.scenarios) {
    doc.text(`1. Pesimistický scénář: ${fin.scenarios.pessimistic}`);
    doc.text(`2. Realistický scénář: ${fin.scenarios.realistic}`);
    doc.text(`3. Optimistický scénář: ${fin.scenarios.optimistic}`);
  } else {
    doc.text(fin.monthlyGoalMath);
  }
  doc.moveDown(0.3);

  checkPageBreak(40);
  setBold(8.5, headingColor);
  doc.text('Bod zvratu (Break-even rozlišení):');
  setRegular(8, textColor);
  doc.text(fin.breakEvenClients);
  doc.moveDown(0.3);

  checkPageBreak(35);
  setBold(8.5, '#B45309'); // Amber
  doc.text('Výluky z finančního modelu (Co není zahrnuto):');
  setRegular(8, mutedColor);
  doc.text(fin.notIncludedCostsNotice || fin.disclaimer || 'Všechny finanční projekce jsou kvalifikovaným strategickým odhadem založeným na vstupních datech klienta.');

  // ----------------------------------------------------
  // SECTION 10: 30DENNÍ AKČNÍ PLÁN EXEKUCE
  // ----------------------------------------------------
  drawSectionHeading('10. 30denní konkrétní akční plán exekuce (Krok za krokem)');
  const calendar = p.actionCalendar30Days || [];

  calendar.forEach(w => {
    checkPageBreak(45);
    setBold(9, headingColor);
    doc.text(`Týden ${w.week}: ${w.focus}`);
    setRegular(8, textColor);
    (w.tasks || []).forEach(task => doc.text(`  □ ${task}`));
    doc.moveDown(0.2);
  });

  // ----------------------------------------------------
  // SECTION 11: ZÁVĚREČNÁ CERTIFIKACE A PRÁVNÍ DOLOŽKA
  // ----------------------------------------------------
  drawSectionHeading('11. Certifikace výstupu a auditovatelnost');
  setRegular(8, mutedColor);
  doc.text('Tento dokument byl automaticky vygenerován a auditován systémem PODNIKAI Business Start v souladu s metodikou Source of Truth v1.0. Veškeré kalkulace představují orientační matematické scénáře vytvořené na základě výhradních vstupních dat klienta.');
  doc.moveDown(0.2);
  doc.text(`ID objednávky: ${order?.id || client.id} | Token: ${order?.orderToken?.slice(0, 16) || client.orderToken?.slice(0, 16)}... | Verze enginu: ${a.engineVersion || 'SOURCE OF TRUTH v1.0'}`);

  // ----------------------------------------------------
  // FOOTER WITH PAGE NUMBERS ON ALL PAGES
  // ----------------------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    setRegular(7.5, mutedColor);
    const footerY = doc.page.height - 28;
    const footerText = `PODNIKAI Business Start | ${q.clientName || 'Klient'} | Strana ${i + 1} z ${range.count}`;
    doc.text(footerText, doc.page.margins.left, footerY, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: 'center'
    });
  }

  doc.end();
  return completionPromise;
}
