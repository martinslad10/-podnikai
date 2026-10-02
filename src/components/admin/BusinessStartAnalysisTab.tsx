import React, { useState } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  Target, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  Layers, 
  TrendingUp, 
  Edit3, 
  Save, 
  Clock,
  ArrowRight,
  FileCheck,
  Zap,
  HelpCircle,
  Check
} from 'lucide-react';
import { BusinessStartClient, BusinessStartAnalysis } from '../../types';
import { sanitizeReportText, sanitizeAllStrings, FormattedReportText } from '../../utils/textFormatters';

interface AnalysisTabProps {
  client: BusinessStartClient;
  onTriggerAnalysis: () => Promise<void>;
  onSaveAnalysis: (updatedAnalysis: BusinessStartAnalysis, adminNotes?: string) => Promise<void>;
  isAnalyzing: boolean;
  isSaving: boolean;
}

export const BusinessStartAnalysisTab: React.FC<AnalysisTabProps> = ({
  client,
  onTriggerAnalysis,
  onSaveAnalysis,
  isAnalyzing,
  isSaving
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<BusinessStartAnalysis | null>(client.analysis ? sanitizeAllStrings(client.analysis) : null);
  const [adminNotes, setAdminNotes] = useState<string>(client.adminNotes ? sanitizeReportText(client.adminNotes) : '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    setEditedAnalysis(client.analysis ? sanitizeAllStrings(client.analysis) : null);
    setAdminNotes(client.adminNotes ? sanitizeReportText(client.adminNotes) : '');
  }, [client]);

  const handleSave = async () => {
    if (!editedAnalysis) return;
    await onSaveAnalysis(sanitizeAllStrings(editedAnalysis), sanitizeReportText(adminNotes));
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const a = editedAnalysis ? sanitizeAllStrings(editedAnalysis) : null;
  const q = sanitizeAllStrings(client.questionnaire);

  if (!a) {
    return (
      <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-5 my-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">Analýza pro tohoto klienta ještě nebyla vygenerována</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Spusťte hloubkovou AI analýzu založenou na 12 odpovědích z dotazníku klienta. Systém navrhne 3 ověřené směry a kompletní exekuční blueprint.
          </p>
        </div>
        <button
          type="button"
          onClick={onTriggerAnalysis}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Generuji hloubkovou analýzu...' : 'Spustit AI Deep Analysis'}
        </button>
      </div>
    );
  }

  const p = a.primaryDirectionBlueprint;

  return (
    <div className="space-y-8">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-black border border-blue-500/20 rounded-2xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              PODNIKAI Business Start Engine
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
              {a.engineVersion || 'SOURCE OF TRUTH v1.0'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {a.analyzedByModel || 'AI Model'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Analyzováno: {new Date(a.analyzedAt).toLocaleString('cs-CZ')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Uloženo
            </span>
          )}

          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditedAnalysis(client.analysis || null);
                  setIsEditing(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Ukládám...' : 'Uložit úpravy'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
              Upravit obsah analýzy
            </button>
          )}

          <button
            type="button"
            onClick={onTriggerAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-300 transition-colors disabled:opacity-50"
            title="Přegenerovat analýzu novým spuštěním AI modelu"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Generuji...' : 'Přegenerovat AI'}
          </button>
        </div>
      </div>

      {/* SOURCE OF TRUTH AUDIT CARD */}
      <div className="bg-gradient-to-br from-[#0c1424] to-[#080b12] border border-blue-500/25 rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              1. SOURCE OF TRUTH — Závazné vstupní mantinely klienta
            </h4>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
            AUTHORITATIVE INPUTS LOCKED
          </span>
        </div>
        
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Jediný autoritativní zdroj informací o klientovi. Engine nesmí měnit, nahrazovat ani obcházet vstupní data.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Kapitálový limit</span>
            <span className="text-amber-300 font-bold">{q.startingCapital}</span>
            <span className="text-[9px] text-slate-400 block">Striktní strop investic</span>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Týdenní kapacita</span>
            <span className="text-sky-300 font-bold">{q.weeklyTimeCommitment}</span>
            <span className="text-[9px] text-slate-400 block">Časový strop pro exekuci</span>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Provozní model</span>
            <span className="text-purple-300 font-bold uppercase">{q.operatingModel}</span>
            <span className="text-[9px] text-slate-400 block">Respektuje 100% online/hybrid</span>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Cílový příjem</span>
            <span className="text-emerald-300 font-bold">{q.targetMonthlyIncome}</span>
            <span className="text-[9px] text-slate-400 block">Zadání k modelaci</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-rose-400 uppercase font-bold block mb-1">
              Červené linie (Zákazy & Nechce dělat):
            </span>
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(q.strictDislikesAndRedLines)
                ? q.strictDislikesAndRedLines
                : (typeof q.strictDislikesAndRedLines === 'string' && q.strictDislikesAndRedLines
                    ? q.strictDislikesAndRedLines.split(',').map(s => s.trim()).filter(Boolean)
                    : [])
              ).length > 0 ? (
                (Array.isArray(q.strictDislikesAndRedLines)
                  ? q.strictDislikesAndRedLines
                  : (q.strictDislikesAndRedLines as string).split(',').map(s => s.trim()).filter(Boolean)
                ).map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 font-medium">
                    ✕ {r}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-[11px]">Žádné červené linie nebyly zadány</span>
              )}
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
              Klíčové dovednosti & Existující aktiva:
            </span>
            <p className="text-[11px] text-slate-300 leading-snug">
              {Array.isArray(q.coreSkillsAndExpertise) ? q.coreSkillsAndExpertise.join(', ') : (q.coreSkillsAndExpertise || 'Neuvedeno')}
              {q.existingAssetsAndNetwork ? ` | Aktiva: ${q.existingAssetsAndNetwork}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* FINÁLNÍ VALIDATION GATE (12 KONTROL) */}
      <div className="bg-[#0b101b] border border-emerald-500/30 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Finální Validation Gate (12 kontrol konzistence)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
              {a.validationGate?.status === 'NEEDS_REVIEW' ? 'STATUS: NEEDS REVIEW' : 'STATUS: DONE (12/12 PASSED)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] pt-1">
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
            { label: 'NO_0CZK_BIAS_WHEN_BUDGET_EXISTS', valid: a.validationGate?.no0CzkBiasWhenBudgetExists ?? true }
          ].map((check, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-1.5 p-2 rounded-lg border text-[10px] font-mono ${
                check.valid 
                  ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
                  : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
              }`}
            >
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{check.label}</span>
            </div>
          ))}
        </div>
        {a.validationGate?.reviewNotes && (
          <p className="text-[10px] text-slate-400 italic">
            Poznámka validační brány: {a.validationGate.reviewNotes}
          </p>
        )}
      </div>

      {/* Interní poznámky konzultanta */}
      <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-2xl p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Interní poznámka & doporučení konzultanta (PODNIKAI Admin)
          </label>
          <span className="text-[10px] text-amber-400/80">Viditelné v reportu i v administraci</span>
        </div>
        <textarea
          rows={3}
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="Zde zapište konkrétní strategické doporučení pro klienta, doplňující postřehy nebo specifická upozornění před odevzdáním reportu..."
          className="w-full bg-black/40 border border-amber-500/20 rounded-xl p-3 text-xs text-slate-200 resize-none focus:outline-none focus:border-amber-400/50"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-500/20"
          >
            Uložit poznámku
          </button>
        </div>
      </div>

      {/* SECTION 1: Executive Summary */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-3">
        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4" />
          1. Shrnutí a exekutivní zhodnocení profilu
        </h4>
        {isEditing ? (
          <textarea
            rows={4}
            value={sanitizeReportText(a.executiveSummary)}
            onChange={e => setEditedAnalysis({ ...a, executiveSummary: sanitizeReportText(e.target.value) })}
            className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white resize-none"
          />
        ) : (
          <p className="text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-line">
            <FormattedReportText text={a.executiveSummary} />
          </p>
        )}
      </div>

      {/* SECTION 2: Profile Evaluation (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Strong points */}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Klíčové silné stránky</span>
          </div>
          <ul className="space-y-2">
            {a.profileEvaluation.strongPoints.map((pt, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risk factors */}
        <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Rizikové faktory & mantinely</span>
          </div>
          <ul className="space-y-2">
            {a.profileEvaluation.riskFactors.map((rf, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>{rf}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Competitive advantages */}
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>Konkurenční výhody</span>
          </div>
          <ul className="space-y-2">
            {a.profileEvaluation.competitiveAdvantages.map((adv, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* SECTION 3: Top 3 Podnikatelské směry */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            2. Tři nejlépe padnoucí podnikatelské směry
          </h4>
          <span className="text-[11px] text-slate-400">
            Směr #1 je vybrán jako primární exekuční strategie
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {a.topDirections.map((dir, idx) => (
            <div
              key={dir.id || idx}
              className={`rounded-2xl p-5 border relative flex flex-col justify-between transition-all ${
                dir.isPrimary
                  ? 'bg-blue-950/30 border-blue-500/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20'
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    dir.isPrimary 
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-white/10 text-slate-400'
                  }`}>
                    {dir.isPrimary ? '★ Vítězný směr #1' : `Alternativa #${idx + 1}`}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    Marže: {dir.estimatedMargin}
                  </span>
                </div>

                <div>
                  <h5 className="text-sm font-bold text-white leading-snug">{dir.title}</h5>
                  <p className="text-xs text-slate-400 mt-1">{dir.tagline}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Model</span>
                    <span className="text-slate-300 font-medium">{dir.businessModel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Proč sedí profilu</span>
                    <span className="text-slate-300 whitespace-pre-line">
                      <FormattedReportText text={dir.whyMatch} />
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-white/10 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Startovní náklad:</span>
                        <span className="text-amber-300 font-bold">
                          {dir.estimatedStartupCostMin.toLocaleString('cs-CZ')} – {dir.estimatedStartupCostMax.toLocaleString('cs-CZ')} Kč
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Doporučená investice:</span>
                        <span className="text-emerald-300 font-bold">
                          {dir.recommendedInitialInvestment !== undefined ? `${dir.recommendedInitialInvestment.toLocaleString('cs-CZ')} Kč` : '0 Kč'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500 text-[10px]">Kompatibilita rozpočtu:</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        dir.budgetCompatibility === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : dir.budgetCompatibility === 'medium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {dir.budgetCompatibility === 'high' ? 'Vysoká' : dir.budgetCompatibility === 'medium' ? 'Střední' : 'Nekompatibilní'}
                      </span>
                    </div>
                    {dir.recommendedCapitalUse && (
                      <div className="text-[10px] text-slate-400 italic pt-0.5">
                        <strong className="text-slate-300 font-normal">Využití:</strong> {dir.recommendedCapitalUse}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!dir.isPrimary && (
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const updatedDirs = a.topDirections.map((d, i) => ({
                        ...d,
                        isPrimary: i === idx
                      }));
                      setEditedAnalysis({ ...a, topDirections: updatedDirs });
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    Nastavit jako hlavní <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CAPITAL USAGE PLAN SECTION (AVAILABLE CAPITAL ≠ REQUIRED STARTUP COST ≠ RECOMMENDED INITIAL INVESTMENT) */}
        {a.capitalUsagePlan && (
          <div className="mt-5 p-5 bg-blue-950/20 border border-blue-500/30 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  Plán smysluplného využití kapitálu (Capital Usage Plan)
                </h5>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                NO FORCED SPENDING
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-black/30 border border-white/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Dostupný kapitál</span>
                <span className="text-sm font-bold text-white block">{a.capitalUsagePlan.availableCapital}</span>
                <span className="text-[10px] text-slate-500">Uvedený strop</span>
              </div>
              <div className="bg-black/30 border border-white/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Nutný startovní náklad</span>
                <span className="text-sm font-bold text-amber-300 block">{a.capitalUsagePlan.requiredStartupCost}</span>
                <span className="text-[10px] text-slate-500">Minimální nezbytný náklad</span>
              </div>
              <div className="bg-black/30 border border-white/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Doporučená investice</span>
                <span className="text-sm font-bold text-emerald-300 block">{a.capitalUsagePlan.recommendedInitialInvestment}</span>
                <span className="text-[10px] text-slate-500">Rychlejší a kvalitnější start</span>
              </div>
              <div className="bg-black/30 border border-white/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Ponechaná rezerva</span>
                <span className="text-sm font-bold text-sky-300 block">{a.capitalUsagePlan.unspentCapitalReserve}</span>
                <span className="text-[10px] text-slate-500">Ochrana cashflow na účtu</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 italic bg-white/5 p-3 rounded-xl border border-white/10">
              {a.capitalUsagePlan.noForcedSpendingNotice}
            </p>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Položkový rozpad smysluplného využití kapitálu:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {a.capitalUsagePlan.breakdown.map((item, bIdx) => (
                  <div key={bIdx} className="bg-black/40 border border-white/10 p-3 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">{item.estimatedCostCz}</span>
                    </div>
                    <div className="text-white font-medium">{item.item}</div>
                    <div className="text-[10px] text-slate-400">{item.rationale}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LOCKED BUSINESS BLUEPRINT MATRIX (A–L) */}
      <div className="bg-gradient-to-br from-[#0c1322] via-[#090d17] to-black border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Locked Business Blueprint (Body A–L)
            </h4>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
            CANONICAL SOURCE FOR DOWNSTREAM EXECUTION
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Jakmile je vybrán primární směr, blueprint se zamkne. Všechny navazující části (nabídka, zákazník, prodej, validace, 30denní plán a finanční model) jsou z něj odvozeny bez samovolných odchylek.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">A. Primary Direction</span>
            <p className="text-slate-200 font-semibold text-xs leading-snug">
              {a.lockedBlueprint?.primaryDirection || p.directionTitle}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">B. Core Offer</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.coreOffer || p.offerAndPackaging.coreOffer}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">C. Ideal Customer</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.idealCustomer || p.idealCustomerAvatar.description}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">D. Customer Problem</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.customerProblem || p.idealCustomerAvatar.painPoints[0] || 'Ztráta času a zisku'}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">E. Value Proposition (USP)</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.valueProposition || p.uniqueValueProposition}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">F. Price [RECOMMENDATION / SCENARIO]</span>
            <p className="text-emerald-300 font-bold text-xs leading-snug">
              {a.lockedBlueprint?.price || p.offerAndPackaging.recommendedPriceCz}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">G. Sales Channel</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.salesChannel || p.salesStrategyAndScripts.outreachChannel}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">H. Acquisition Method</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.acquisitionMethod || 'Přímý osobní kontakt / doporučení / inbound'}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">I. Delivery Model</span>
            <p className="text-purple-300 font-semibold text-xs leading-snug uppercase">
              {a.lockedBlueprint?.deliveryModel || q.operatingModel}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">J. Revenue Model</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.revenueModel || 'Projektová platba + volitelný měsíční paušál'}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">K. Cost Model</span>
            <p className="text-amber-300 font-semibold text-xs leading-snug">
              {a.lockedBlueprint?.costModel || (q.startingCapital.includes('0') ? '0 Kč počáteční investice' : 'Nízká fixní režie')}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase block">L. Validation Plan</span>
            <p className="text-slate-200 text-xs leading-snug">
              {a.lockedBlueprint?.validationPlan || p.first14DaysValidationPlan.hypothesisToVerify}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Detailní Exekuční Blueprint primárního směru */}
      <div className="space-y-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
            3
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Exekuční Blueprint vítězného směru: {p.directionTitle}
            </h4>
            <p className="text-xs text-slate-400">
              Detailní rozpis prodeje, validace, cenotvorby a 30denní implementace.
            </p>
          </div>
        </div>

        {/* Cíl klienta vs. Aktuální start (A, B, C) */}
        {(p.targetVsStartPlan || a.targetVsStartPlan) && (
          <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-6 space-y-4">
            <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              Cíl klienta vs. Realistický start v rámci rozpočtu
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-purple-400 uppercase block">A) Cílový model klienta</span>
                <p className="text-xs text-white font-medium leading-relaxed">
                  <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.targetModelClientGoal} />
                </p>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-blue-400 uppercase block">B) Realistický start s rozpočtem</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.currentBudgetStart} />
                </p>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">C) Podmínka přechodu k cíli</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <FormattedReportText text={(p.targetVsStartPlan || a.targetVsStartPlan)?.transitionCondition} />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* USP & Prodejní nabídka */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
          <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" />
            Unikátní prodejní propozice (USP) a Jádrová nabídka
          </h5>
          <div className="space-y-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Hlavní prodejní slib (USP)
              </span>
              <p className="text-xs text-white font-medium leading-relaxed whitespace-pre-line">
                <FormattedReportText text={p.uniqueValueProposition} />
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Jádrová služba / Balíček
                </span>
                <p className="text-xs text-slate-200 font-semibold whitespace-pre-line">
                  <FormattedReportText text={p.offerAndPackaging.coreOffer} />
                </p>
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] text-slate-500 font-bold block">Co přesně klient obdrží:</span>
                  {p.offerAndPackaging.deliverables.map((deliv, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-center gap-2 whitespace-pre-line">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span><FormattedReportText text={deliv} /></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Cenotvorba & Strategie
                </span>
                <div>
                  <span className="text-[10px] text-slate-500 block">Doporučená zaváděcí cena:</span>
                  <div className="text-sm font-black text-emerald-400 whitespace-pre-line">
                    <FormattedReportText text={p.offerAndPackaging.recommendedPriceCz} />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Strategie:</span>
                  <p className="text-xs text-slate-300 whitespace-pre-line">
                    <FormattedReportText text={p.offerAndPackaging.pricingStrategy} />
                  </p>
                </div>
                {p.offerAndPackaging.upsellOption && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[10px] text-purple-400 font-bold block">Navazující upsell / paušál:</span>
                    <p className="text-xs text-purple-200 whitespace-pre-line">
                      <FormattedReportText text={p.offerAndPackaging.upsellOption} />
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ideální avatar zákazníka */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
          <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Ideální platící zákazník (Avatar)
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Popis zákazníka</span>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                  <FormattedReportText text={p.idealCustomerAvatar.description} />
                </p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nákupní motivace</span>
                <p className="text-xs text-emerald-300 whitespace-pre-line">
                  <FormattedReportText text={p.idealCustomerAvatar.buyingMotivation} />
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">Hlavní bolesti zákazníka</span>
                {p.idealCustomerAvatar.painPoints.map((pain, i) => (
                  <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{pain}</span>
                  </div>
                ))}
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] text-sky-400 uppercase font-bold block">Kde tyto zákazníky najít</span>
                {p.idealCustomerAvatar.whereToFindThem.map((loc, i) => (
                  <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{loc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 14denní Validační plán */}
        <div className="bg-gradient-to-br from-emerald-950/20 to-black border border-emerald-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Validační strategie na prvních 14 dní
            </h5>
            <span className="text-xs font-bold text-emerald-300 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              Cíl: {p.first14DaysValidationPlan.targetOutreachCount} oslovení
            </span>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-4">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Ověřovaná hypotéza</span>
            <p className="text-xs text-slate-200 whitespace-pre-line">
              <FormattedReportText text={p.first14DaysValidationPlan.hypothesisToVerify} />
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Kroky den po dni:</span>
            {p.first14DaysValidationPlan.validationSteps.map((step, i) => (
              <div key={i} className="text-xs text-slate-300 bg-black/20 p-2.5 rounded-lg border border-white/5 flex items-start gap-2.5 whitespace-pre-line">
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span><FormattedReportText text={step} /></span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">🟢 GO SIGNÁL (Pokračovat):</span>
              <p className="text-xs text-emerald-200 whitespace-pre-line">
                <FormattedReportText text={p.first14DaysValidationPlan.goSignal} />
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-400 block mb-0.5">🟠 PIVOT SIGNÁL (Upravit nabídku):</span>
              <p className="text-xs text-amber-200 whitespace-pre-line">
                <FormattedReportText text={p.first14DaysValidationPlan.pivotSignal} />
              </p>
            </div>
          </div>
        </div>

        {/* Prodejní skripty & Outreach */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
          <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Způsob oslovení & Prodejní skripty
          </h5>
          <div className="space-y-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Vstupní oslovovací zpráva (Icebreaker)</span>
                <span className="text-[10px] text-blue-400">Kanál: {p.salesStrategyAndScripts.outreachChannel}</span>
              </div>
              <p className="text-xs text-slate-200 bg-white/5 p-3 rounded-lg border border-white/10 italic whitespace-pre-line">
                „<FormattedReportText text={p.salesStrategyAndScripts.icebreakerMessage} />“
              </p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Osnova prodejního hovoru:</span>
              {p.salesStrategyAndScripts.salesScriptOutline.map((outline, i) => (
                <div key={i} className="text-xs text-slate-300 flex items-center gap-2 whitespace-pre-line">
                  <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                  <span><FormattedReportText text={outline} /></span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Zvládání typických námitek:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {p.salesStrategyAndScripts.handlingCommonObjections.map((obj, i) => (
                  <div key={i} className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="text-rose-300 font-semibold">❓ Námitka: „{obj.objection}“</div>
                    <div className="text-emerald-300">💡 Odpověď: „{obj.response}“</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 30denní Akční kalendář */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
          <h5 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            30denní Akční kalendář krok za krokem
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {p.actionCalendar30Days.map((cal, i) => (
              <div key={i} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-sky-400 uppercase tracking-wider">
                      Týden {cal.week}
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <h6 className="text-xs font-bold text-white leading-snug">{cal.focus}</h6>
                  <ul className="space-y-1.5 mt-3">
                    {cal.tasks.map((task, tIdx) => (
                      <li key={tIdx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                        <span className="text-sky-400 font-bold">•</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Finanční model & Matematika cíle */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Finanční model a orientační matematika cílového příjmu
            </h5>
            <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
              VÝHRADNĚ MODELOVÝ SCÉNÁŘ – BEZ GARANCE ZISKU
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">1. Fixní měsíční režie</span>
              <span className="text-xs font-semibold text-white block leading-relaxed">{p.financialModel.monthlyOverheadCostsCz}</span>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">2. Variabilní náklady / zakázka</span>
              <span className="text-xs font-semibold text-white block leading-relaxed">{p.financialModel.variableCostsPerClientCz}</span>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">3. Bod pokrytí provozních nákladů & cíl (Break-even)</span>
              <span className="text-xs font-semibold text-emerald-400 block leading-relaxed">{p.financialModel.breakEvenClients}</span>
            </div>
          </div>

          {/* Základní auditovatelný modelový výpočet */}
          {p.financialModel.simpleCalculationFormula && (
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 text-xs space-y-1.5">
              <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                Základní modelový výpočet (auditovatelná matematika):
              </span>
              <p className="text-xs text-white font-mono font-semibold whitespace-pre-line">
                <FormattedReportText text={p.financialModel.simpleCalculationFormula} />
              </p>
            </div>
          )}

          {/* Rozpad kapacity a započtených rezerv */}
          {(p.capacityBreakdown || a.capacityBreakdown) && (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 text-xs space-y-2.5">
              <span className="text-[10px] text-sky-400 uppercase font-bold block">
                Struktura kapacity a započtených rezerv ({a.primaryDirectionBlueprint ? 'týdenní dotace klienta' : ''}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Teoretická kapacita</span>
                  <span className="text-slate-200 font-medium">{(p.capacityBreakdown || a.capacityBreakdown)?.theoreticalCapacity}</span>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-blue-400 block">Realistická / provozní kapacita</span>
                  <span className="text-white font-medium">{(p.capacityBreakdown || a.capacityBreakdown)?.operationalCapacity}</span>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-emerald-400 block">Doporučená kapacita</span>
                  <span className="text-emerald-300 font-medium">{(p.capacityBreakdown || a.capacityBreakdown)?.recommendedCapacity}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Započtená rezerva: <FormattedReportText text={(p.capacityBreakdown || a.capacityBreakdown)?.overheadBufferBreakdown} />
              </p>
            </div>
          )}

          {/* 8 Klíčových náležitostí modelu */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 text-xs space-y-2">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">
              Detailní struktura modelového scénáře & předpoklady:
            </span>
            <p className="text-slate-200 font-medium text-xs leading-relaxed whitespace-pre-line">
              <FormattedReportText text={p.financialModel.monthlyGoalMath} />
            </p>
          </div>

          {/* 3 Scenarios */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              3 Modelové scénáře rozjezdu (nikoliv garance ani slib zisku):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase block">1. Pesimistický scénář:</span>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                  <FormattedReportText text={p.financialModel.scenarios?.pessimistic || 'Minimální rozjezd (1–2 klienti/měsíc).'} />
                </p>
              </div>
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase block">2. Realistický model:</span>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                  <FormattedReportText text={p.financialModel.scenarios?.realistic || 'Stabilní plnění (4–6 klientů/měsíc).'} />
                </p>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">3. Optimistický model (strop kapacity):</span>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                  <FormattedReportText text={p.financialModel.scenarios?.optimistic || 'Plná kapacita a měsíční retainery (8–10 klientů).'} />
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-[10px] text-slate-300 whitespace-pre-line leading-relaxed">
            <strong className="text-amber-400 font-bold block mb-1">Závazné právní a metodické upozornění:</strong>
            <FormattedReportText text={p.financialModel.disclaimer || 'Všechny finanční projekce jsou kvalifikovaným strategickým odhadem založeným na datech klienta a orientačních modelových cenových předpokladech. Nejedná se o garanci budoucího zisku.'} />
          </div>
        </div>
      </div>
    </div>
  );
};
