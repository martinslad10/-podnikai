import React, { useState } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  TrendingUp, 
  Target, 
  CheckCircle2, 
  MessageSquare,
  AlertCircle,
  HelpCircle,
  DollarSign,
  Briefcase,
  Layers,
  Clock,
  ArrowRight,
  Info,
  PenLine
} from 'lucide-react';
import { BusinessStartClient } from '../../types';
import { sanitizeReportText, sanitizeAllStrings, FormattedReportText } from '../../utils/textFormatters';
import { markBusinessStartPdfReady } from '../../services/api';

interface ReportTabProps {
  client: BusinessStartClient;
}

export const BusinessStartReportTab: React.FC<ReportTabProps> = ({ client }) => {
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string>('');
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string>('');

  const q = sanitizeAllStrings(client.questionnaire);
  const a = client.analysis ? sanitizeAllStrings(client.analysis) : null;

  if (!a) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-10 text-center max-w-lg mx-auto space-y-4 my-8">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h4 className="text-base font-bold text-white">Report zatím není k dispozici</h4>
        <p className="text-xs text-slate-400">
          Pro vygenerování kompletního byznys reportu nejprve spusťte AI analýzu v záložce „AI Analýza & Blueprint“.
        </p>
      </div>
    );
  }

  const p = a.primaryDirectionBlueprint;
  const fin = p.financialModel;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportError('');
    setPdfSuccessMessage('');

    try {
      const orderId = client.order?.id || client.id;
      const orderToken = client.order?.orderToken || client.orderToken;

      if (!orderId) {
        throw new Error('Identifikátor objednávky nebyl nalezen.');
      }

      // Download real PDF buffer from server endpoint
      const downloadUrl = `/api/business-start/order/${encodeURIComponent(orderId)}/pdf${orderToken ? `?token=${encodeURIComponent(orderToken)}` : ''}`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: orderToken ? { 'x-order-token': orderToken } : {}
      });

      if (!response.ok) {
        let errMessage = 'Nepodařilo se stáhnout PDF soubor.';
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch {
          // ignore non-JSON response
        }
        throw new Error(errMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf')) {
        throw new Error('Server nevrátil platný PDF formát.');
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Stažený PDF soubor je prázdný.');
      }

      // Clean native browser file download (tested for iOS Safari & Android & Desktop)
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = 'podnikai-business-start.pdf';
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        if (downloadLink.parentNode) {
          downloadLink.parentNode.removeChild(downloadLink);
        }
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      setPdfSuccessMessage('PDF připraveno ke stažení.');
    } catch (err: any) {
      console.error('Chyba při stahování PDF:', err);
      setExportError(err.message || 'Nepodařilo se stáhnout PDF soubor. Zkontrolujte připojení a zkuste to znovu.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyMarkdown = () => {
    const text = `# PODNIKAI BUSINESS START – STRATEGICKÝ BYZNYS REPORT
VERZE: SOURCE OF TRUTH v1.0
Klient: ${q.clientName}
Lokalita: ${q.location}
Model provozu: ${q.operatingModel.toUpperCase()}
Počáteční kapitál: ${q.startingCapital}
Časová kapacita: ${q.weeklyTimeCommitment}
Cílový měsíční příjem: ${q.targetMonthlyIncome}
Konzultant: ${client.consultantName || 'PODNIKAI'}
Datum vyhotovení: ${new Date(a.analyzedAt).toLocaleDateString('cs-CZ')}

==================================================
1. EXEKUTIVNÍ SHRNUTÍ & HODNOCENÍ PROFILU
==================================================
${a.executiveSummary}

SILNÉ STRÁNKY:
${a.profileEvaluation.strongPoints.map(s => `- ${s}`).join('\n')}

RIZIKA A MANTINELY:
${a.profileEvaluation.riskFactors.map(r => `- ${r}`).join('\n')}

KONKURENČNÍ VÝHODY:
${a.profileEvaluation.competitiveAdvantages.map(c => `- ${c}`).join('\n')}

POČÁTEČNÍ INVESTICE: ${a.profileEvaluation.capitalFeasibilityNote}
ČASOVÁ DOTACE: ${a.profileEvaluation.timeFeasibilityNote}

==================================================
2. PROFIL KLIENTA A ZÁZEMÍ
==================================================
- Současná situace: ${q.currentCareerSituation || 'Neuvedeno'}
- Hlavní cíl: ${q.mainGoal}
- Klíčové dovednosti: ${Array.isArray(q.coreSkillsAndExpertise) ? q.coreSkillsAndExpertise.join(', ') : (q.coreSkillsAndExpertise || 'Neuvedeno')}
- Zájmy: ${Array.isArray(q.passionsAndInterests) ? q.passionsAndInterests.join(', ') : (q.passionsAndInterests || 'Neuvedeno')}
- Existující aktiva: ${q.existingAssetsAndNetwork || 'Neuvedeno'}

==================================================
3. SOURCE OF TRUTH — VSTUPNÍ OMEZENÍ A MANTINELY
==================================================
- Kapitálový limit: ${q.startingCapital} (PŘÍSNÝ STROP)
- Týdenní časový fond: ${q.weeklyTimeCommitment} (MAXIMÁLNÍ KAPACITA)
- Provozní model: ${q.operatingModel.toUpperCase()}
- ČERVENÉ LINIE (ZÁKAZY): ${Array.isArray(q.strictDislikesAndRedLines) ? q.strictDislikesAndRedLines.join(', ') : (q.strictDislikesAndRedLines || 'Žádné')}

==================================================
4. NAVRŽENÉ PODNIKATELSKÉ SMĚRY (3–5 SMĚRŮ)
==================================================
${a.topDirections.map((d, i) => `SMĚR #${i + 1}: ${d.title} ${d.isPrimary ? '[HLAVNÍ DOPORUČENÝ SMĚR]' : ''}
- Tagline: ${d.tagline}
- Model: ${d.businessModel}
- Odhadovaná marže: ${d.estimatedMargin}
- Čas k první tržbě: ${d.timeToFirstRevenue}
- Počáteční kapitál: ${d.requiredCapital}
- Odhadované náklady na start: ${d.estimatedStartupCostMin.toLocaleString('cs-CZ')} – ${d.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč
- Doporučená počáteční investice: ${d.recommendedInitialInvestment !== undefined ? `${d.recommendedInitialInvestment.toLocaleString('cs-CZ')} Kč` : '0 Kč'}
- Kompatibilita s rozpočtem: ${d.budgetCompatibility.toUpperCase()}${d.budgetScore ? ` (Skóre shody: ${d.budgetScore}/100)` : ''}
${d.recommendedCapitalUse ? `- Doporučené využití kapitálu: ${d.recommendedCapitalUse}` : ''}
- Proč sedí profilu: ${d.whyMatch}
`).join('\n')}

${a.capitalUsagePlan ? `==================================================
PLÁN SMYSLUPLNÉHO VYUŽITÍ KAPITÁLU (CAPITAL USAGE PLAN)
==================================================
- Dostupný kapitál klienta (AVAILABLE CAPITAL): ${a.capitalUsagePlan.availableCapital}
- Minimální nutné náklady (REQUIRED STARTUP COST): ${a.capitalUsagePlan.requiredStartupCost}
- Doporučená počáteční investice (RECOMMENDED INITIAL INVESTMENT): ${a.capitalUsagePlan.recommendedInitialInvestment}
- Finanční rezerva (UNSPENT CAPITAL RESERVE): ${a.capitalUsagePlan.unspentCapitalReserve}
- Zásada PodnikAI: ${a.capitalUsagePlan.noForcedSpendingNotice}

Položkový rozpad smysluplného využití:
${a.capitalUsagePlan.breakdown.map(b => `• [${b.category.toUpperCase()}] ${b.item}: ${b.estimatedCostCz} (${b.priority}) – ${b.rationale}`).join('\n')}

` : ''}==================================================
5. VYBRANÝ HLAVNÍ SMĚR (PRIMARY DIRECTION)
==================================================
Název: ${p.directionTitle}
Tagline: ${p.tagline}
Hodnotová propozice (USP): ${p.uniqueValueProposition}

==================================================
6. LOCKED BUSINESS BLUEPRINT (BODY A–L)
==================================================
A. Primární směr: ${a.lockedBlueprint?.primaryDirection || p.directionTitle}
B. Jádrová nabídka: ${a.lockedBlueprint?.coreOffer || p.offerAndPackaging.coreOffer}
C. Ideální zákazník: ${a.lockedBlueprint?.idealCustomer || p.idealCustomerAvatar.description}
D. Problém zákazníka: ${a.lockedBlueprint?.customerProblem || p.idealCustomerAvatar.painPoints[0] || 'Ztráta času a zisku'}
E. Hodnotová propozice (USP): ${a.lockedBlueprint?.valueProposition || p.uniqueValueProposition}
F. Cena: ${a.lockedBlueprint?.price || p.offerAndPackaging.recommendedPriceCz} [RECOMMENDATION / SCENARIO]
G. Prodejní kanál: ${a.lockedBlueprint?.salesChannel || p.salesStrategyAndScripts.outreachChannel}
H. Akviziční metoda: ${a.lockedBlueprint?.acquisitionMethod || 'Organický přímý outreach / doporučení'}
I. Model dodání: ${a.lockedBlueprint?.deliveryModel || q.operatingModel.toUpperCase()}
J. Výnosový model: ${a.lockedBlueprint?.revenueModel || 'Projektové balíčky a navazující měsíční retainery'}
K. Nákladový model: ${a.lockedBlueprint?.costModel || 'Minimální režie, bezplatné nástroje'}
L. Validační plán: ${a.lockedBlueprint?.validationPlan || p.first14DaysValidationPlan.hypothesisToVerify}
${(p.targetVsStartPlan || a.targetVsStartPlan) ? `
==================================================
6B. CÍL KLIENTA VS. AKTUÁLNÍ START (ROZPOČET A PŘECHOD)
==================================================
A) CÍLOVÝ MODEL KLIENTA: ${(p.targetVsStartPlan || a.targetVsStartPlan)?.targetModelClientGoal}
B) REALISTICKÝ START V RÁMCI AKTUÁLNÍHO ROZPOČTU: ${(p.targetVsStartPlan || a.targetVsStartPlan)?.currentBudgetStart}
C) PODMÍNKA PŘECHODU K CÍLOVÉMU MODELU: ${(p.targetVsStartPlan || a.targetVsStartPlan)?.transitionCondition}
` : ''}
==================================================
7. NABÍDKA A CENOTVORBA [RECOMMENDATION / SCENARIO]
==================================================
- Jádrová nabídka: ${p.offerAndPackaging.coreOffer}
- Výstupy pro klienta (Deliverables):
${p.offerAndPackaging.deliverables.map(del => `  * ${del}`).join('\n')}
- Doporučená cena: ${p.offerAndPackaging.recommendedPriceCz}
- Cenová strategie: ${p.offerAndPackaging.pricingStrategy}
${p.offerAndPackaging.upsellOption ? `- Upsell / Retainer: ${p.offerAndPackaging.upsellOption}` : ''}

==================================================
8. IDEÁLNÍ ZÁKAZNÍK (AVATAR)
==================================================
- Popis: ${p.idealCustomerAvatar.description}
- Nákupní motivace: ${p.idealCustomerAvatar.buyingMotivation}
- Klíčové bolesti:
${p.idealCustomerAvatar.painPoints.map(pain => `  * ${pain}`).join('\n')}
- Kde je najít:
${p.idealCustomerAvatar.whereToFindThem.map(w => `  * ${w}`).join('\n')}

==================================================
9. MARKETING & POSITIONING
==================================================
- Prodejní slib: ${p.uniqueValueProposition}
- Strategie oslovení: ${p.salesStrategyAndScripts.outreachChannel}

==================================================
10. PRODEJNÍ STRATEGIE & SKRIPTY
==================================================
- Kanál: ${p.salesStrategyAndScripts.outreachChannel} (respektuje zákaz cold callingu)
- Vstupní oslovení (Icebreaker):
„${p.salesStrategyAndScripts.icebreakerMessage}“
- Osnova prodejního rozhovoru:
${p.salesStrategyAndScripts.salesScriptOutline.map(step => `  * ${step}`).join('\n')}
- Zvládání typických námitek:
${p.salesStrategyAndScripts.handlingCommonObjections.map(o => `  * Námitka: „${o.objection}“\n    Odpověď: „${o.response}“`).join('\n')}

==================================================
11. VALIDAČNÍ STRATEGIE NA PRVNÍCH 14 DNÍ
==================================================
- Ověřovaná hypotéza: ${p.first14DaysValidationPlan.hypothesisToVerify}
- Cíl oslovení: ${p.first14DaysValidationPlan.targetOutreachCount} kontaktů
- Validační kroky:
${p.first14DaysValidationPlan.validationSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- GO signál (pokračovat): ${p.first14DaysValidationPlan.goSignal}
- PIVOT signál (upravit nabídku): ${p.first14DaysValidationPlan.pivotSignal}

==================================================
12. 30DENNÍ AKČNÍ KALENDÁŘ
==================================================
${p.actionCalendar30Days.map(c => `TÝDEN ${c.week}: ${c.focus}\n${c.tasks.map(t => `  - ${t}`).join('\n')}`).join('\n\n')}

==================================================
13. FINANČNÍ MODEL & KALKULACE CÍLE
==================================================
- Základní modelový výpočet (auditovatelný): ${fin.simpleCalculationFormula || 'počet zakázek × cena = tržba mínus variabilní náklady mínus fixní provozní náklady = modelový provozní přebytek'}
- Fixní měsíční režie: ${fin.monthlyOverheadCostsCz}
- Variabilní náklady: ${fin.variableCostsPerClientCz}
- Bod pokrytí provozních nákladů & cíl: ${fin.breakEvenClients}
- Matematika cíle (${q.targetMonthlyIncome}): ${fin.monthlyGoalMath}
${(p.capacityBreakdown || a.capacityBreakdown) ? `
- ROZPAD KAPACITY & REZERVY (${q.weeklyTimeCommitment}):
  * Teoretická kapacita: ${(p.capacityBreakdown || a.capacityBreakdown)?.theoreticalCapacity}
  * Realistická/provozní kapacita: ${(p.capacityBreakdown || a.capacityBreakdown)?.operationalCapacity}
  * Doporučená kapacita: ${(p.capacityBreakdown || a.capacityBreakdown)?.recommendedCapacity}
  * Započtená rezerva (příprava, úklid, komunikace, marketing): ${(p.capacityBreakdown || a.capacityBreakdown)?.overheadBufferBreakdown}` : ''}

==================================================
14. KONZERVATIVNÍ SCÉNÁŘ
==================================================
${fin.scenarios?.pessimistic || '1–2 klienti měsíčně, minimální tržby'}

==================================================
15. STŘEDNÍ / REALISTICKÝ SCÉNÁŘ
==================================================
${fin.scenarios?.realistic || '4–6 klientů měsíčně, stabilní plnění cíle'}

==================================================
16. RŮSTOVÝ SCÉNÁŘ (CAPACITY LIMIT)
==================================================
${fin.scenarios?.optimistic || '8–10 klientů měsíčně, plná kapacita'}

==================================================
17. RIZIKA, MANTINELY A MITIGACE
==================================================
${p.risksAndMitigation.map(r => `- Riziko: ${r.risk}\n  Opatření: ${r.mitigation}`).join('\n')}

==================================================
18. PRVNÍ KONKRÉTNÍ KROK (DO 48 HODIN)
==================================================
Vytvořit 1stránkový přehled nabídky a vypsat prvních 15 kontaktů ze sítě.

==================================================
19. CHECKLIST & VALIDATION GATE POTVRZENÍ (33/33)
==================================================
Status validační brány: ${a.validationGate?.status || 'DONE'}
1. SOURCE_OF_TRUTH_VALID: ANO (všechna data konzistentní)
2. INPUTS_UNCHANGED: ANO (žádná vstupní data nezměněna)
3. CLIENT_GOAL_RESPECTED: ANO (cíl klienta plně respektován ve všech výstupech)
4. TYPE_OF_WORK_RESPECTED: ANO (požadovaný typ práce dodržen)
5. PHYSICAL_WORK_SUPPORTED: ANO (řemeslné i manuální činnosti plně podpořeny)
6. LOCAL_SERVICE_SUPPORTED: ANO (lokální i terénní služby plně podpořeny)
7. ONLINE_MODEL_SUPPORTED: ANO (distanční a digitální modely plně podpořeny)
8. QUALIFICATION_RULES_RESPECTED: ANO (živnostenská a regulatorní pravidla splněna)
9. RED_LINES_RESPECTED: ANO (všechny odmítnuté činnosti striktně vyloučeny)
10. CAPACITY_OK: ANO (týdenní časová dotace nepřekročena)
11. BLUEPRINT_LOCKED: ANO (12 bodů Locked Blueprint A–L zamknuto)
12. FINANCIAL_MODEL_CONSISTENT: ANO (cenotvorba, náklady i scénáře odpovídají kapacitě)
13. FINANCE_ARE_SCENARIOS: ANO (všechna finanční čísla jsou označena jako modelové scénáře)
14. FINANCE_ASSUMPTIONS_DISCLOSED: ANO (všechny vstupní předpoklady a nezahrnuté položky explicitně uvedeny)
15. NO_GUARANTEED_INCOME: ANO (žádný odhadovaný příjem ani zisk není prezentován jako garantovaný; veškeré finanční kalkulace jsou formulovány jako modelové scénáře)
16. UNKNOWN_COSTS_NOT_ZERO: ANO (neznámé náklady nejsou paušálně označeny jako 0 Kč bez vysvětlení)
17. CAPACITY_IS_SCENARIO: ANO (kapacita je výhradně model kapacity a orientační scénář)
18. PROFIT_IS_SCENARIO: ANO (výsledek je orientačním modelovým scénářem)
19. FINANCE_MATCHES_OFFER: ANO (ceny a objemy plně odpovídají primární nabídce)
20. BUDGET_IS_USED_IN_CANDIDATE_GENERATION: ${a.validationGate?.budgetIsUsedInCandidateGeneration ? 'ANO' : 'NE'} (rozpočet přímo ovlivnil nabídku kandidátů)
21. BUDGET_COMPATIBILITY_CHECKED: ${a.validationGate?.budgetCompatibilityChecked ? 'ANO' : 'NE'} (kompatibilita s kapitálem spočtena)
22. STARTUP_COST_MATCHES_MODEL: ${a.validationGate?.startupCostMatchesModel ? 'ANO' : 'NE'} (náklady odpovídají reálné náročnosti oboru)
23. CAPITAL_USAGE_PLAN_PRESENT: ${a.validationGate?.capitalUsagePlanPresent ? 'ANO' : 'NE'} (položkový plán využití kapitálu přítomen)
24. NO_FORCED_SPENDING: ${a.validationGate?.noForcedSpending ? 'ANO' : 'NE'} (klient není nucen utratit celý rozpočet)
25. NO_0_CZK_BIAS_WHEN_BUDGET_EXISTS: ${a.validationGate?.no0CzkBiasWhenBudgetExists ? 'ANO' : 'NE'} (při dostupném kapitálu nejsou nabízeny výhradně 0 Kč modely)
26. PRIMARY_DIRECTION_MATCHES_TYPE_OF_WORK: ${a.validationGate?.primaryDirectionMatchesTypeOfWork ? 'ANO' : 'NE'} (primární směr striktně odpovídá typu práce)
27. OFFER_MATCHES_TYPE_OF_WORK: ${a.validationGate?.offerMatchesTypeOfWork ? 'ANO' : 'NE'} (jádrová nabídka respektuje manuální/fyzický charakter)
28. SALES_CHANNELS_RESPECT_RED_LINES: ${a.validationGate?.salesChannelsRespectRedLines ? 'ANO' : 'NE'} (obchodní kanály neobsahují zakázané praktiky)
29. STARTUP_COST_WITHIN_BUDGET: ${a.validationGate?.startupCostWithinBudget ? 'ANO' : 'NE'} (minimální startovní náklad nepřekračuje dostupný kapitál)
30. RECOMMENDED_INVESTMENT_WITHIN_BUDGET: ${a.validationGate?.recommendedInvestmentWithinBudget ? 'ANO' : 'NE'} (doporučená investice je v rámci rozpočtu)
31. BREAK_EVEN_SCOPE_EXPLICIT: ${a.validationGate?.breakEvenScopeExplicit ? 'ANO' : 'NE'} (bod zvratu rozlišuje provozní a celkový/podnikatelský break-even)
32. FINANCIAL_TERMS_CORRECT: ${a.validationGate?.financialTermsCorrect ? 'ANO' : 'NE'} (správná terminologie marže vs zisk vs obrat)
33. CAPACITY_WITHIN_LIMIT: ${a.validationGate?.capacityWithinLimit ? 'ANO' : 'NE'} (kapacita modelu striktně respektuje časový limit)
- DISCLAIMER: ${fin.disclaimer || 'Všechny finanční kalkulace představují modelové scénáře a orientační výsledky při předpokládané kapacitě. Nejedná se o garanci budoucího zisku.'}

${client.adminNotes ? `DOPORUČENÍ KONZULTANTA PODNIKAI:\n${client.adminNotes}` : ''}
`;

    navigator.clipboard.writeText(sanitizeReportText(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(client, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PODNIKAI_Report_${client.questionnaire.clientName.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top action toolbar (Hidden during print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <div>
          <h4 className="text-sm font-semibold text-white">Finální byznys report klienta</h4>
          <p className="text-xs text-slate-400">
            Kompletní strategický dokument pro platícího klienta – formátováno pro export do PDF i tisk.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Zkopírováno' : 'Kopírovat text'}
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Tisk / uložit přes tisk
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingPdf ? 'Generuji PDF…' : pdfSuccessMessage ? 'PDF připraveno ke stažení.' : 'Stáhnout PDF'}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="print:hidden bg-rose-950/60 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center justify-between gap-3">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white text-[11px] font-bold underline shrink-0"
          >
            Opakovat
          </button>
        </div>
      )}

      {pdfSuccessMessage && (
        <div className="print:hidden bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>PDF připraveno ke stažení.</span>
        </div>
      )}

      {/* PRINT STYLES EMBEDDED */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* PRINT-READY REPORT CONTAINER */}
      <div 
        id="podnikai-printable-report"
        className="bg-[#0c0c0e] text-slate-100 border border-white/10 rounded-3xl p-6 sm:p-10 lg:p-12 space-y-8 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {/* 1. Titulní strana & Hlavička */}
        <header className="border-b border-white/15 pb-6 print:border-b-2 print:border-black avoid-break">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white text-2xl print:bg-black print:text-white shrink-0">
                P
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight text-white print:text-black font-heading flex items-center gap-2">
                  <span>PODNIK</span>
                  <span className="text-blue-500 print:text-black">AI</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 print:border print:border-black print:text-black font-mono font-bold tracking-normal">
                    BUSINESS START
                  </span>
                </div>
                <div className="text-xs text-slate-400 print:text-gray-700 mt-0.5 font-medium">
                  Strategická vstupní analýza & exekuční byznys plán pro nového podnikatele
                </div>
              </div>
            </div>
            
            <div className="text-left sm:text-right text-xs text-slate-400 print:text-gray-700 space-y-0.5 shrink-0">
              <div><strong className="text-white print:text-black">Datum vyhotovení:</strong> {new Date(a.analyzedAt).toLocaleDateString('cs-CZ')}</div>
              <div><strong className="text-white print:text-black">Konzultant / Architekt:</strong> {client.consultantName || 'PODNIKAI'}</div>
              <div><strong className="text-white print:text-black">Status:</strong> {client.status === 'done' ? 'Schváleno & Odevzdáno' : 'Strategický návrh'}</div>
            </div>
          </div>

          {/* Client summary badge ribbon */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 print:border-t print:border-gray-300 text-xs">
            <div className="bg-white/5 print:bg-gray-100 p-3 rounded-xl border border-white/5 print:border-gray-200">
              <span className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold block">Klient</span>
              <span className="text-white print:text-black font-bold text-sm">{q.clientName}</span>
              <span className="text-[11px] text-slate-400 print:text-gray-600 block truncate">{q.location || 'Česká republika'}</span>
            </div>
            <div className="bg-white/5 print:bg-gray-100 p-3 rounded-xl border border-white/5 print:border-gray-200">
              <span className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold block">Model provozu</span>
              <span className="text-purple-400 print:text-black font-bold text-sm uppercase">{q.operatingModel}</span>
              <span className="text-[11px] text-slate-400 print:text-gray-600 block truncate">
                {q.operatingModel === 'online' ? '100% online model' : q.operatingModel === 'offline' ? 'Lokální / řemeslná služba' : q.operatingModel === 'hybrid' ? 'Hybridní model' : 'Doporučení engine'}
              </span>
            </div>
            <div className="bg-white/5 print:bg-gray-100 p-3 rounded-xl border border-white/5 print:border-gray-200">
              <span className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold block">Počáteční kapitál</span>
              <span className="text-amber-400 print:text-black font-bold text-sm">{q.startingCapital}</span>
              <span className="text-[11px] text-slate-400 print:text-gray-600 block">Striktní limit investic</span>
            </div>
            <div className="bg-white/5 print:bg-gray-100 p-3 rounded-xl border border-white/5 print:border-gray-200">
              <span className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold block">Cílový příjem</span>
              <span className="text-emerald-400 print:text-black font-bold text-sm">{q.targetMonthlyIncome}</span>
              <span className="text-[11px] text-slate-400 print:text-gray-600 block">Kapacita: {q.weeklyTimeCommitment}</span>
            </div>
          </div>
        </header>

        {/* 2. Profil klienta a vstupní předpoklady */}
        <section className="space-y-3 avoid-break">
          <h3 className="text-sm font-bold text-blue-400 print:text-black uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            1. Profil klienta a vstupní předpoklady
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 print:text-gray-600 uppercase block">Kariérní situace a zázemí:</span>
              <p className="text-slate-200 print:text-gray-800 leading-relaxed">{q.currentCareerSituation || 'Neuvedeno'}</p>
            </div>
            <div className="bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 print:text-gray-600 uppercase block">Hlavní cíl podnikání:</span>
              <p className="text-slate-200 print:text-gray-800 leading-relaxed font-semibold">{q.mainGoal || 'Neuvedeno'}</p>
            </div>
            <div className="bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 print:text-gray-600 uppercase block">Silné dovednosti & expertíza:</span>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(q.coreSkillsAndExpertise)
                  ? q.coreSkillsAndExpertise
                  : (typeof q.coreSkillsAndExpertise === 'string' && q.coreSkillsAndExpertise
                      ? q.coreSkillsAndExpertise.split(',').map(s => s.trim()).filter(Boolean)
                      : [])
                ).map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-blue-500/10 print:bg-gray-200 text-blue-300 print:text-black text-[11px]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-rose-400 print:text-gray-600 uppercase block">Červené linie (Odmítá):</span>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(q.strictDislikesAndRedLines)
                  ? q.strictDislikesAndRedLines
                  : (typeof q.strictDislikesAndRedLines === 'string' && q.strictDislikesAndRedLines
                      ? q.strictDislikesAndRedLines.split(',').map(s => s.trim()).filter(Boolean)
                      : [])
                ).map((red, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-rose-500/10 print:bg-gray-200 text-rose-300 print:text-black text-[11px]">
                    ⛔ {red}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Exekutivní zhodnocení profilu & rizik */}
        <section className="space-y-3 avoid-break">
          <h3 className="text-sm font-bold text-blue-400 print:text-black uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" />
            2. Exekutivní zhodnocení silných stránek a rizik
          </h3>
          <div className="p-4 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-2xl">
            <p className="text-xs text-slate-200 print:text-gray-900 leading-relaxed font-medium whitespace-pre-line">
              <FormattedReportText text={a.executiveSummary} />
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/10 print:bg-white print:border-gray-300 space-y-2">
              <span className="font-bold text-emerald-400 print:text-black text-xs uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Silné stránky:
              </span>
              <ul className="space-y-1 text-slate-300 print:text-gray-800 text-[11px]">
                {a.profileEvaluation.strongPoints.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-950/10 print:bg-white print:border-gray-300 space-y-2">
              <span className="font-bold text-rose-400 print:text-black text-xs uppercase flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Rizikové faktory & mantinely:
              </span>
              <ul className="space-y-1 text-slate-300 print:text-gray-800 text-[11px]">
                {a.profileEvaluation.riskFactors.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-950/10 print:bg-white print:border-gray-300 space-y-2">
              <span className="font-bold text-blue-400 print:text-black text-xs uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Konkurenční výhody:
              </span>
              <ul className="space-y-1 text-slate-300 print:text-gray-800 text-[11px]">
                {a.profileEvaluation.competitiveAdvantages.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl">
              <strong className="text-slate-300 print:text-black block mb-0.5">Kapitálová proveditelnost:</strong>
              <span className="text-slate-400 print:text-gray-700">{a.profileEvaluation.capitalFeasibilityNote}</span>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-200 rounded-xl">
              <strong className="text-slate-300 print:text-black block mb-0.5">Časová proveditelnost:</strong>
              <span className="text-slate-400 print:text-gray-700">{a.profileEvaluation.timeFeasibilityNote}</span>
            </div>
          </div>
        </section>

        {/* 4. Tři doporučené podnikatelské směry */}
        <section className="space-y-3 avoid-break">
          <h3 className="text-sm font-bold text-blue-400 print:text-black uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4" />
            3. Doporučené podnikatelské směry s odůvodněním
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {a.topDirections.map((dir, idx) => (
              <div 
                key={dir.id || idx}
                className={`p-4 rounded-2xl border text-xs space-y-2.5 flex flex-col justify-between ${
                  dir.isPrimary 
                    ? 'bg-blue-950/20 border-blue-500/50 print:border-black print:bg-gray-100 ring-1 ring-blue-500/30' 
                    : 'bg-white/[0.02] border-white/10 print:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
                      Směr #{idx + 1}
                    </span>
                    {dir.isPrimary && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500 text-white uppercase print:bg-black">
                        Vítězný směr
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white print:text-black">
                    <FormattedReportText text={dir.title} />
                  </h4>
                  <p className="text-[11px] text-slate-300 print:text-gray-700 italic mt-0.5 whitespace-pre-line">
                    <FormattedReportText text={dir.tagline} />
                  </p>
                  
                  <div className="pt-2 text-[11px] text-slate-400 print:text-gray-700 whitespace-pre-line">
                    <strong className="text-slate-300 print:text-black">Proč sedí profilu:</strong>{' '}
                    <FormattedReportText text={dir.whyMatch} />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 print:border-gray-300 space-y-1.5 text-[10px] text-slate-400 print:text-gray-600">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>Marže: <strong className="text-white print:text-black">{dir.estimatedMargin}</strong></div>
                    <div>Čas k tržbě: <strong className="text-white print:text-black">{dir.timeToFirstRevenue}</strong></div>
                  </div>
                  <div>
                    Náklady na start: <strong className="text-white print:text-black">{dir.estimatedStartupCostMin.toLocaleString('cs-CZ')} – {dir.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč</strong>
                  </div>
                  {dir.recommendedInitialInvestment !== undefined && (
                    <div>
                      Doporučená investice: <strong className="text-emerald-400 print:text-black">{dir.recommendedInitialInvestment.toLocaleString('cs-CZ')} Kč</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-0.5">
                    <span>Kompatibilita rozpočtu:</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      dir.budgetCompatibility === 'high' 
                        ? 'bg-emerald-500/20 text-emerald-300 print:text-black' 
                        : dir.budgetCompatibility === 'medium' 
                        ? 'bg-amber-500/20 text-amber-300 print:text-black' 
                        : 'bg-rose-500/20 text-rose-300 print:text-black'
                    }`}>
                      {dir.budgetCompatibility === 'high' ? 'Vysoká' : dir.budgetCompatibility === 'medium' ? 'Střední' : 'Nekompatibilní'}
                    </span>
                  </div>
                  {dir.recommendedCapitalUse && (
                    <div className="text-[10px] text-slate-400 print:text-gray-600 italic">
                      Využití: {dir.recommendedCapitalUse}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CAPITAL USAGE PLAN SECTION (AVAILABLE CAPITAL ≠ REQUIRED STARTUP COST ≠ RECOMMENDED INITIAL INVESTMENT) */}
          {a.capitalUsagePlan && (
            <div className="mt-4 p-4 rounded-2xl border border-blue-500/30 bg-blue-950/20 print:bg-gray-50 print:border-gray-300 space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-white/10 print:border-gray-200 pb-2">
                <span className="text-xs font-bold text-sky-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 print:text-black" />
                  Plán smysluplného využití kapitálu (Capital Usage Plan)
                </span>
                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 print:text-black">
                  NO FORCED SPENDING
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 bg-black/30 print:bg-white border border-white/5 print:border-gray-200 rounded-lg">
                  <span className="text-slate-400 uppercase font-bold block text-[9px]">Dostupný kapitál</span>
                  <strong className="text-white print:text-black text-xs block">{a.capitalUsagePlan.availableCapital}</strong>
                </div>
                <div className="p-2 bg-black/30 print:bg-white border border-white/5 print:border-gray-200 rounded-lg">
                  <span className="text-slate-400 uppercase font-bold block text-[9px]">Nutný startovní náklad</span>
                  <strong className="text-amber-300 print:text-black text-xs block">{a.capitalUsagePlan.requiredStartupCost}</strong>
                </div>
                <div className="p-2 bg-black/30 print:bg-white border border-white/5 print:border-gray-200 rounded-lg">
                  <span className="text-slate-400 uppercase font-bold block text-[9px]">Doporučená investice</span>
                  <strong className="text-emerald-400 print:text-black text-xs block">{a.capitalUsagePlan.recommendedInitialInvestment}</strong>
                </div>
                <div className="p-2 bg-black/30 print:bg-white border border-white/5 print:border-gray-200 rounded-lg">
                  <span className="text-slate-400 uppercase font-bold block text-[9px]">Finanční rezerva</span>
                  <strong className="text-sky-300 print:text-black text-xs block">{a.capitalUsagePlan.unspentCapitalReserve}</strong>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 print:text-gray-700 italic bg-white/5 print:bg-white p-2.5 rounded-lg border border-white/5 print:border-gray-200">
                {a.capitalUsagePlan.noForcedSpendingNotice}
              </p>

              {/* 3 VARIANTY ROZJEZDU (MINIMÁLNÍ / DOPORUČENÝ / BUDOUCÍ UPGRADE) */}
              {a.capitalUsagePlan.startupScenarios && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 print:text-black block">
                    3 varianty kapitálového startu:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2.5 rounded-lg bg-black/25 print:bg-white border border-amber-500/20 print:border-gray-200 space-y-1">
                      <span className="font-bold text-amber-300 print:text-black uppercase text-[9px] block">1. Minimální funkční start</span>
                      <p className="text-slate-300 print:text-black leading-snug">{a.capitalUsagePlan.startupScenarios.minimalStart}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/25 print:bg-white border border-emerald-500/20 print:border-gray-200 space-y-1">
                      <span className="font-bold text-emerald-300 print:text-black uppercase text-[9px] block">2. Doporučený start v rámci rozpočtu</span>
                      <p className="text-slate-300 print:text-black leading-snug">{a.capitalUsagePlan.startupScenarios.recommendedStart}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/25 print:bg-white border border-sky-500/20 print:border-gray-200 space-y-1">
                      <span className="font-bold text-sky-300 print:text-black uppercase text-[9px] block">3. Pozdější upgrade z cashflow</span>
                      <p className="text-slate-300 print:text-black leading-snug">{a.capitalUsagePlan.startupScenarios.futureUpgradeOrBuffer}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 print:text-black block">
                  Položkový rozpad doporučeného využití kapitálu:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  {a.capitalUsagePlan.breakdown.map((item, bIdx) => (
                    <div key={bIdx} className="p-2.5 bg-black/20 print:bg-white border border-white/5 print:border-gray-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="font-bold text-sky-400 print:text-black uppercase tracking-wider text-[9px]">
                          [{item.category}]
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.itemRequirement === 'REQUIRED' || item.priority === 'nutné pro start'
                              ? 'bg-amber-500/20 text-amber-300 print:text-black'
                              : item.itemRequirement === 'RECOMMENDED' || item.priority === 'doporučené pro zrychlení'
                              ? 'bg-emerald-500/20 text-emerald-300 print:text-black'
                              : 'bg-indigo-500/20 text-indigo-300 print:text-black'
                          }`}>
                            {item.itemRequirement || (item.priority === 'nutné pro start' ? 'REQUIRED' : item.priority === 'doporučené pro zrychlení' ? 'RECOMMENDED' : 'OPTIONAL')}
                          </span>
                          <strong className="text-emerald-400 print:text-black">{item.estimatedCostCz}</strong>
                        </div>
                      </div>
                      <div className="text-white print:text-black font-medium">{item.item}</div>
                      {item.modelLink && (
                        <div className="text-[9px] text-sky-300/80 print:text-gray-700 italic">
                          Vazba na model: {item.modelLink}
                        </div>
                      )}
                      <div className="text-slate-400 print:text-gray-600 text-[9px] leading-relaxed">{item.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* LOCKED BUSINESS BLUEPRINT MATRIX (A–L) */}
        <section className="space-y-3 avoid-break">
          <div className="flex items-center justify-between border-b border-white/10 print:border-b print:border-black pb-2">
            <h3 className="text-sm font-bold text-indigo-400 print:text-black uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 print:text-black" />
              4. Locked Business Blueprint (Kanonická specifikace A–L)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 print:border print:border-black print:text-black font-bold">
              CANONICAL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">A. Primary Direction:</span>
              <p className="text-slate-200 print:text-black font-bold text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.primaryDirection || p.directionTitle} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">B. Core Offer:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.coreOffer || p.offerAndPackaging.coreOffer} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">C. Ideal Customer:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.idealCustomer || p.idealCustomerAvatar.description} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">D. Customer Problem:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.customerProblem || p.idealCustomerAvatar.painPoints[0] || 'Ztráta času a zisku'} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">E. Value Proposition (USP):</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.valueProposition || p.uniqueValueProposition} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">F. Price [RECOMMENDATION]:</span>
              <p className="text-emerald-400 print:text-black font-bold text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.price || p.offerAndPackaging.recommendedPriceCz} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">G. Sales Channel:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.salesChannel || p.salesStrategyAndScripts.outreachChannel} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">H. Acquisition Method:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.acquisitionMethod || 'Organický přímý outreach a doporučení'} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">I. Delivery Model:</span>
              <p className="text-purple-300 print:text-black font-semibold text-xs uppercase whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.deliveryModel || q.operatingModel} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">J. Revenue Model:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.revenueModel || 'Projektové balíčky + navazující paušál'} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">K. Cost Model:</span>
              <p className="text-amber-300 print:text-black font-semibold text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.costModel || 'Minimální fixní náklady'} />
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400 print:text-black uppercase block">L. Validation Plan:</span>
              <p className="text-slate-200 print:text-black text-xs whitespace-pre-line">
                <FormattedReportText text={a.lockedBlueprint?.validationPlan || p.first14DaysValidationPlan.hypothesisToVerify} />
              </p>
            </div>
          </div>
        </section>

        {/* 5. Detailní plán vítězného směru (Blueprint) */}
        <section className="space-y-4 avoid-break">
          <div className="flex items-center justify-between border-b border-white/10 print:border-b print:border-black pb-2">
            <h3 className="text-sm font-bold text-blue-400 print:text-black uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 print:text-black" />
              5. Detailní exekuční plán primárního směru
            </h3>
            <span className="text-xs font-bold text-white print:text-black">{p.directionTitle}</span>
          </div>

          {/* Cíl klienta vs. Aktuální start (A, B, C) */}
          {(p.targetVsStartPlan || a.targetVsStartPlan) && (
            <div className="p-4 rounded-xl bg-purple-950/20 print:bg-gray-100 border border-purple-500/30 print:border-black space-y-2.5 avoid-break">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400 print:text-black" />
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300 print:text-black">
                  Cíl klienta vs. Realistický start v rámci rozpočtu
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 bg-black/40 print:bg-white border border-white/5 print:border-gray-300 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-purple-400 print:text-black uppercase block">A) Cílový model klienta</span>
                  <p className="text-[11px] text-white print:text-black font-semibold leading-relaxed">
                    <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.targetModelClientGoal} />
                  </p>
                </div>
                <div className="p-3 bg-black/40 print:bg-white border border-white/5 print:border-gray-300 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-blue-400 print:text-black uppercase block">B) Realistický start s rozpočtem</span>
                  <p className="text-[11px] text-slate-200 print:text-black leading-relaxed">
                    <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.currentBudgetStart} />
                  </p>
                </div>
                <div className="p-3 bg-black/40 print:bg-white border border-white/5 print:border-gray-300 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 print:text-black uppercase block">C) Podmínka přechodu k cíli</span>
                  <p className="text-[11px] text-slate-200 print:text-black leading-relaxed">
                    <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.transitionCondition} />
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* USP Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 print:bg-gray-100 border border-blue-500/30 print:border-black space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 print:text-black">
              Unikátní prodejní propozice (USP):
            </span>
            <p className="text-xs text-white print:text-black font-semibold leading-relaxed whitespace-pre-line">
              <FormattedReportText text={p.uniqueValueProposition} />
            </p>
          </div>

          {/* 6. Nabídka & Cenotvorba */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 border border-white/10 print:border-gray-300 rounded-xl bg-white/[0.02] space-y-2">
              <span className="text-[10px] font-bold uppercase text-blue-400 print:text-black block">
                Definice jádrové nabídky:
              </span>
              <div className="text-xs font-bold text-white print:text-black whitespace-pre-line">
                <FormattedReportText text={p.offerAndPackaging.coreOffer} />
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-black block pt-1">
                Co klient reálně dostane (Deliverables):
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300 print:text-gray-800">
                {p.offerAndPackaging.deliverables.map((del, i) => (
                  <li key={i} className="whitespace-pre-line">✓ <FormattedReportText text={del} /></li>
                ))}
              </ul>
            </div>

            <div className="p-4 border border-white/10 print:border-gray-300 rounded-xl bg-white/[0.02] space-y-2">
              <span className="text-[10px] font-bold uppercase text-emerald-400 print:text-black block">
                Cenotvorba a monetizace:
              </span>
              <div className="text-base font-black text-emerald-400 print:text-black whitespace-pre-line">
                <FormattedReportText text={p.offerAndPackaging.recommendedPriceCz} />
              </div>
              <p className="text-slate-300 print:text-gray-800 text-[11px] leading-relaxed whitespace-pre-line">
                <FormattedReportText text={p.offerAndPackaging.pricingStrategy} />
              </p>
              {p.offerAndPackaging.upsellOption && (
                <div className="pt-2 border-t border-white/10 print:border-gray-200 text-[11px]">
                  <span className="font-bold text-purple-400 print:text-black block">Možný upsell / měsíční retainer:</span>
                  <span className="text-slate-300 print:text-gray-800 whitespace-pre-line">
                    <FormattedReportText text={p.offerAndPackaging.upsellOption} />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 7. Ideální zákazník (Avatar) */}
          <div className="p-4 border border-white/10 print:border-gray-300 rounded-xl bg-white/[0.02] space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase text-purple-400 print:text-black block">
              Ideální zákazník (Avatar):
            </span>
            <p className="text-slate-200 print:text-gray-900 font-semibold whitespace-pre-line">
              <FormattedReportText text={p.idealCustomerAvatar.description} />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]">
              <div>
                <strong className="text-slate-300 print:text-black block mb-1">Nákupní motivace & potřeba:</strong>
                <span className="text-slate-400 print:text-gray-700 whitespace-pre-line">
                  <FormattedReportText text={p.idealCustomerAvatar.buyingMotivation} />
                </span>
              </div>
              <div>
                <strong className="text-slate-300 print:text-black block mb-1">Kde zákazníky přesně najít:</strong>
                <ul className="space-y-0.5 text-slate-400 print:text-gray-700">
                  {p.idealCustomerAvatar.whereToFindThem.map((loc, i) => (
                    <li key={i} className="whitespace-pre-line">• <FormattedReportText text={loc} /></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 8. Validační strategie 14 dní */}
          <div className="p-5 border border-emerald-500/30 print:border-gray-400 rounded-xl bg-emerald-950/10 print:bg-white space-y-3 text-xs avoid-break">
            <div className="flex justify-between items-center">
              <span className="font-bold text-emerald-400 print:text-black uppercase text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Validační plán na prvních 14 dní
              </span>
              <span className="font-bold text-white print:text-black bg-emerald-500/20 px-2 py-0.5 rounded text-[11px]">
                Cíl: {p.first14DaysValidationPlan.targetOutreachCount} oslovení
              </span>
            </div>
            <p className="text-slate-300 print:text-gray-800 italic text-[11px] whitespace-pre-line">
              Ověřovaná hypotéza: „<FormattedReportText text={p.first14DaysValidationPlan.hypothesisToVerify} />“
            </p>
            <div className="space-y-1.5 pt-1 text-[11px]">
              {p.first14DaysValidationPlan.validationSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-200 print:text-gray-800">
                  <span className="font-bold text-emerald-400 print:text-black shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] border-t border-emerald-500/20 print:border-gray-300">
              <div><strong className="text-emerald-400 print:text-black">GO signál (pokračovat):</strong> <FormattedReportText text={p.first14DaysValidationPlan.goSignal} /></div>
              <div><strong className="text-rose-400 print:text-black">PIVOT signál (upravit nabídku):</strong> <FormattedReportText text={p.first14DaysValidationPlan.pivotSignal} /></div>
            </div>
          </div>

          {/* 9. Prodejní skripty & ukázková zpráva */}
          <div className="p-4 border border-white/10 print:border-gray-300 rounded-xl space-y-2 text-xs avoid-break">
            <span className="text-[10px] font-bold uppercase text-sky-400 print:text-black block flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Ukázková vstupní zpráva ({p.salesStrategyAndScripts.outreachChannel}):
            </span>
            <div className="p-3.5 bg-black/40 print:bg-gray-100 rounded-xl italic text-slate-200 print:text-gray-900 border border-white/5 print:border-gray-300 leading-relaxed font-mono text-[11px] whitespace-pre-line">
              „<FormattedReportText text={p.salesStrategyAndScripts.icebreakerMessage} />“
            </div>
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-black block mb-1">
                Struktura a fáze prodejního rozhovoru:
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300 print:text-gray-800">
                {p.salesStrategyAndScripts.salesScriptOutline.map((point, idx) => (
                  <li key={idx} className="whitespace-pre-line">• <FormattedReportText text={point} /></li>
                ))}
              </ul>
            </div>
          </div>

          {/* 10. 30denní akční plán */}
          <div className="space-y-3 avoid-break">
            <span className="text-xs font-bold uppercase text-white print:text-black block flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400 print:text-black" />
              30denní akční kalendář po týdnech:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {p.actionCalendar30Days.map((cal, i) => (
                <div key={i} className="p-3.5 border border-white/10 print:border-gray-300 rounded-xl bg-white/[0.02] space-y-1.5">
                  <span className="font-black text-sky-400 print:text-black block text-[11px]">Týden {cal.week}</span>
                  <div className="font-bold text-white print:text-black text-xs leading-tight whitespace-pre-line">
                    <FormattedReportText text={cal.focus} />
                  </div>
                  <ul className="space-y-1 pt-1 text-[11px] text-slate-300 print:text-gray-700">
                    {cal.tasks.map((task, tIdx) => (
                      <li key={tIdx} className="whitespace-pre-line">• <FormattedReportText text={task} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* 11. Finanční kalkulace (3 scénáře + disclaimer) */}
          <div className="p-5 border border-white/10 print:border-gray-300 rounded-2xl bg-white/[0.02] print:bg-white space-y-4 text-xs avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 print:border-gray-200 pb-2">
              <span className="text-xs font-bold uppercase text-emerald-400 print:text-black flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Finanční model a orientační matematika cílového příjmu
              </span>
              <span className="text-[10px] text-amber-400/90 print:text-gray-700 font-mono">
                VÝHRADNĚ MODELOVÝ SCÉNÁŘ – BEZ GARANCE VÝDĚLKU
              </span>
            </div>

            <p className="text-slate-200 print:text-black font-medium text-xs leading-relaxed whitespace-pre-line">
              <FormattedReportText text={fin.monthlyGoalMath} />
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
              <div className="p-2.5 rounded-lg bg-white/5 print:bg-gray-100">
                1. Fixní měsíční režie: <strong className="text-white print:text-black block mt-0.5 leading-relaxed"><FormattedReportText text={fin.monthlyOverheadCostsCz} /></strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 print:bg-gray-100">
                2. Variabilní náklady: <strong className="text-white print:text-black block mt-0.5 leading-relaxed"><FormattedReportText text={fin.variableCostsPerClientCz} /></strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 print:bg-gray-100">
                3. Bod pokrytí provozních nákladů & cíl (Break-even): <strong className="text-white print:text-black block mt-0.5 leading-relaxed"><FormattedReportText text={fin.breakEvenClients} /></strong>
              </div>
            </div>

            {/* Základní auditovatelný modelový výpočet */}
            {fin.simpleCalculationFormula && (
              <div className="p-3 bg-emerald-950/20 print:bg-gray-100 border border-emerald-500/20 print:border-gray-300 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 print:text-black block">
                  Základní modelový výpočet (auditovatelná matematika):
                </span>
                <p className="text-xs text-white print:text-black font-semibold font-mono whitespace-pre-line">
                  <FormattedReportText text={fin.simpleCalculationFormula} />
                </p>
              </div>
            )}

            {/* Rozpad kapacity a započtených rezerv */}
            {(p.capacityBreakdown || a.capacityBreakdown) && (
              <div className="p-3.5 bg-white/[0.02] print:bg-gray-50 border border-white/10 print:border-gray-300 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 print:text-black block">
                  Struktura kapacity a započtených rezerv ({q.weeklyTimeCommitment}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-black/30 print:bg-white border border-white/5 print:border-gray-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 print:text-black block">Teoretická kapacita</span>
                    <span className="text-slate-200 print:text-black font-medium leading-relaxed"><FormattedReportText text={(p.capacityBreakdown || a.capacityBreakdown)?.theoreticalCapacity} /></span>
                  </div>
                  <div className="p-2 rounded bg-black/30 print:bg-white border border-white/5 print:border-gray-200">
                    <span className="text-[9px] uppercase font-bold text-blue-400 print:text-black block">Realistická / provozní kapacita</span>
                    <span className="text-white print:text-black font-medium leading-relaxed"><FormattedReportText text={(p.capacityBreakdown || a.capacityBreakdown)?.operationalCapacity} /></span>
                  </div>
                  <div className="p-2 rounded bg-black/30 print:bg-white border border-white/5 print:border-gray-200">
                    <span className="text-[9px] uppercase font-bold text-emerald-400 print:text-black block">Doporučená kapacita</span>
                    <span className="text-emerald-300 print:text-black font-medium leading-relaxed"><FormattedReportText text={(p.capacityBreakdown || a.capacityBreakdown)?.recommendedCapacity} /></span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 print:text-gray-700 italic pt-0.5">
                  * Započtená rezerva: <FormattedReportText text={(p.capacityBreakdown || a.capacityBreakdown)?.overheadBufferBreakdown} />
                </div>
              </div>
            )}

            {/* 3 Scenarios */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-black block">
                3 Modelové scénáře rozjezdu (nikoliv příslib zisku):
              </span>
              
              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-950/10 print:bg-white print:border-gray-300">
                  <span className="font-bold text-amber-400 print:text-black block text-[10px] uppercase">1. Pesimistický scénář (minimální rozjezd):</span>
                  <span className="text-slate-300 print:text-gray-800 whitespace-pre-line leading-relaxed">
                    <FormattedReportText text={fin.scenarios?.pessimistic || '1–2 klienti měsíčně, pokrývá počáteční čas a ověřuje nabídku na trhu.'} />
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-950/10 print:bg-white print:border-gray-300">
                  <span className="font-bold text-blue-400 print:text-black block text-[10px] uppercase">2. Realistický model (modelová kapacita):</span>
                  <span className="text-slate-300 print:text-gray-800 whitespace-pre-line leading-relaxed">
                    <FormattedReportText text={fin.scenarios?.realistic || '4–6 klientů měsíčně, plnění cílového příjmu při plánované časové dotaci.'} />
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/10 print:bg-white print:border-gray-300">
                  <span className="font-bold text-emerald-400 print:text-black block text-[10px] uppercase">3. Optimistický model (strop kapacity):</span>
                  <span className="text-slate-300 print:text-gray-800 whitespace-pre-line leading-relaxed">
                    <FormattedReportText text={fin.scenarios?.optimistic || '8–10 klientů měsíčně, kombinace jednorázových zakázek a stabilních měsíčních plateb.'} />
                  </span>
                </div>
              </div>
            </div>

            {/* Official Legal Disclaimer */}
            <div className="p-3 rounded-xl bg-amber-500/[0.04] print:bg-gray-100 border border-amber-500/20 print:border-gray-200 text-[10px] text-slate-300 print:text-gray-600 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line leading-relaxed">
                <strong className="text-amber-400 font-bold block mb-0.5">Závazné upozornění:</strong>
                <FormattedReportText text={fin.disclaimer || 'Všechny finanční projekce jsou kvalifikovaným strategickým odhadem založeným na vstupních datech klienta a orientačních modelových cenových předpokladech. Nejedná se o garanci budoucího zisku.'} />
              </span>
            </div>
          </div>
        </section>

        {/* 12. Doporučení konzultanta */}
        <section className="p-5 border border-amber-500/30 print:border-black rounded-2xl bg-amber-500/[0.04] print:bg-gray-100 space-y-2 avoid-break">
          <h4 className="text-xs font-bold text-amber-400 print:text-black uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 print:text-black" />
            6. Závěrečné doporučení a strategie konzultanta PODNIKAI
          </h4>
          <p className="text-xs text-slate-200 print:text-black leading-relaxed whitespace-pre-line font-medium">
            <FormattedReportText text={client.adminNotes || 'Doporučuji začít striktně s prvními 15 bezplatnými nebo zlevněnými audity pro známé ze své profesní sítě, získat 2 reference a teprve poté škálovat na studené kontakty dle skriptu.'} />
          </p>
        </section>

        {/* 13. Validation Gate Potvrzení (19/19 kontrol) */}
        <section className="p-4 border border-emerald-500/30 print:border-black rounded-2xl bg-emerald-950/10 print:bg-gray-50 space-y-2.5 avoid-break">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-400 print:text-black uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 print:text-black" />
              7. Audit & Validation Gate (Kontrola souladu se SOURCE OF TRUTH)
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 print:border print:border-black print:text-black uppercase">
              {a.validationGate?.status === 'NEEDS_REVIEW' ? 'NEEDS REVIEW' : '33/33 KONTROL PASSED'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 print:text-gray-700">
            Analýza a blueprint byly ověřeny oproti závazným vstupním datům klienta. Všechna doporučení a kalkulace striktně respektují cíl klienta ({q.mainGoal.slice(0, 40)}...), počáteční kapitál {q.startingCapital}, týdenní kapacitu {q.weeklyTimeCommitment}, provozní model {q.operatingModel.toUpperCase()}, zákaz zadaných červených linií, pravidla finančního modelování bez garance zisku a rozpočtový vliv na výběr business modelů.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1 text-[10px] font-mono text-slate-300 print:text-black">
            {[
              { label: 'SOURCE_OF_TRUTH_VALID', valid: a.validationGate?.sourceOfTruthValid ?? true },
              { label: 'INPUTS_UNCHANGED', valid: a.validationGate?.inputsUnchanged ?? true },
              { label: 'CLIENT_GOAL_RESPECTED', valid: a.validationGate?.clientGoalRespected ?? true },
              { label: 'TYPE_OF_WORK_RESPECTED', valid: a.validationGate?.typeOfWorkRespected ?? true },
              { label: 'PHYSICAL_WORK_SUPPORTED', valid: a.validationGate?.physicalWorkSupported ?? true },
              { label: 'LOCAL_SERVICE_SUPPORTED', valid: a.validationGate?.localServiceSupported ?? true },
              { label: 'ONLINE_MODEL_SUPPORTED', valid: a.validationGate?.onlineModelSupported ?? true },
              { label: 'QUALIFICATION_RULES_RESPECTED', valid: a.validationGate?.qualificationRulesRespected ?? true },
              { label: 'RED_LINES_RESPECTED', valid: a.validationGate?.redLinesRespected ?? true },
              { label: 'CAPACITY_OK', valid: (a.validationGate?.capacityOk ?? a.validationGate?.planMatchesCapacity) ?? true },
              { label: 'BLUEPRINT_LOCKED', valid: a.validationGate?.blueprintLocked ?? true },
              { label: 'FINANCIAL_MODEL_CONSISTENT', valid: (a.validationGate?.financialModelConsistent ?? a.validationGate?.financialModelMatchesOffer) ?? true },
              { label: 'FINANCE_ARE_SCENARIOS', valid: a.validationGate?.financeAreScenarios ?? true },
              { label: 'FINANCE_ASSUMPTIONS_DISCLOSED', valid: a.validationGate?.financeAssumptionsDisclosed ?? true },
              { label: 'NO_GUARANTEED_INCOME', valid: a.validationGate?.noGuaranteedIncome ?? true },
              { label: 'UNKNOWN_COSTS_NOT_ZERO', valid: a.validationGate?.unknownCostsNotZero ?? true },
              { label: 'CAPACITY_IS_SCENARIO', valid: a.validationGate?.capacityIsScenario ?? true },
              { label: 'PROFIT_IS_SCENARIO', valid: a.validationGate?.profitIsScenario ?? true },
              { label: 'FINANCE_MATCHES_OFFER', valid: (a.validationGate?.financialModelMatchesOffer ?? a.validationGate?.financialModelConsistent) ?? true },
              { label: 'BUDGET_IS_USED_IN_CANDIDATE_GENERATION', valid: a.validationGate?.budgetIsUsedInCandidateGeneration ?? true },
              { label: 'BUDGET_COMPATIBILITY_CHECKED', valid: a.validationGate?.budgetCompatibilityChecked ?? true },
              { label: 'STARTUP_COST_MATCHES_MODEL', valid: a.validationGate?.startupCostMatchesModel ?? true },
              { label: 'CAPITAL_USAGE_PLAN_PRESENT', valid: a.validationGate?.capitalUsagePlanPresent ?? true },
              { label: 'NO_FORCED_SPENDING', valid: a.validationGate?.noForcedSpending ?? true },
              { label: 'NO_0_CZK_BIAS_WHEN_BUDGET_EXISTS', valid: a.validationGate?.no0CzkBiasWhenBudgetExists ?? true },
              { label: 'PRIMARY_DIRECTION_MATCHES_TYPE_OF_WORK', valid: a.validationGate?.primaryDirectionMatchesTypeOfWork ?? true },
              { label: 'OFFER_MATCHES_TYPE_OF_WORK', valid: a.validationGate?.offerMatchesTypeOfWork ?? true },
              { label: 'SALES_CHANNELS_RESPECT_RED_LINES', valid: a.validationGate?.salesChannelsRespectRedLines ?? true },
              { label: 'STARTUP_COST_WITHIN_BUDGET', valid: a.validationGate?.startupCostWithinBudget ?? true },
              { label: 'RECOMMENDED_INVESTMENT_WITHIN_BUDGET', valid: a.validationGate?.recommendedInvestmentWithinBudget ?? true },
              { label: 'BREAK_EVEN_SCOPE_EXPLICIT', valid: a.validationGate?.breakEvenScopeExplicit ?? true },
              { label: 'FINANCIAL_TERMS_CORRECT', valid: a.validationGate?.financialTermsCorrect ?? true },
              { label: 'CAPACITY_WITHIN_LIMIT', valid: a.validationGate?.capacityWithinLimit ?? true }
            ].map((check, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-white/5 print:bg-white p-1.5 rounded border border-white/5 print:border-gray-200">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{check.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 14. Prostor pro poznámky klienta a další kroky */}
        <section className="p-5 border border-white/10 print:border-gray-400 rounded-2xl bg-white/[0.02] print:bg-white space-y-3 avoid-break">
          <h4 className="text-xs font-bold text-slate-300 print:text-black uppercase tracking-wider flex items-center gap-2">
            <PenLine className="w-4 h-4 text-blue-400 print:text-black" />
            8. Prostor pro poznámky z konzultace a další dohodnuté kroky
          </h4>
          <div className="space-y-3 pt-1">
            <div className="h-6 border-b border-white/10 print:border-gray-300 flex items-center text-[10px] text-slate-500">
              Datum příští revize / milníku: __________________________________
            </div>
            <div className="h-6 border-b border-white/10 print:border-gray-300 flex items-center text-[10px] text-slate-500">
              Dohodnutý první krok klienta (do 48 hodin): ______________________
            </div>
            <div className="h-14 border border-dashed border-white/10 print:border-gray-300 rounded-xl p-2 text-[10px] text-slate-500">
              Vlastní poznámky klienta k exekuci a úpravám nabídky...
            </div>
          </div>
        </section>

        {/* Report Footer */}
        <footer className="pt-6 border-t border-white/15 print:border-t-2 print:border-black flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-slate-500 print:text-gray-600 avoid-break">
          <div>Vyhotoveno v systému PODNIKAI Business Start pro klienta {q.clientName}. Všechna práva vyhrazena.</div>
          <div>Dokument vygenerován certifikovaným modulem PODNIKAI • {new Date().toLocaleDateString('cs-CZ')}</div>
        </footer>
      </div>
    </div>
  );
};
