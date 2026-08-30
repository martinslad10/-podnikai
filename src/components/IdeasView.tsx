import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  RotateCw, 
  ArrowRight, 
  Zap, 
  ShieldCheck,
  FileText,
  MessageSquare,
  SlidersHorizontal,
  Award,
  TrendingUp,
  Clock,
  Coins,
  Scale,
  Users,
  Target,
  PhoneCall,
  Calendar,
  AlertOctagon,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Check,
  Flame
} from 'lucide-react';
import { BusinessIdea, BusinessDirection, IdeaGenerationResponse, UserProfile } from '../types';
import { generateBusinessIdeas } from '../services/api';

interface IdeasViewProps {
  userProfile: UserProfile;
  onSelectIdeaForPlan: (idea: BusinessIdea) => void;
  onAskAiAboutIdea: (idea: BusinessIdea) => void;
  onSetTodayTaskAsDailyStep?: (task: { title: string; description: string; estimatedMinutes: number; whyToday?: string }) => void;
  onNavigateToFindCustomers?: (direction?: BusinessDirection) => void;
  currentProject: string;
}

export const IdeasView: React.FC<IdeasViewProps> = ({
  userProfile,
  onSelectIdeaForPlan,
  onAskAiAboutIdea,
  onSetTodayTaskAsDailyStep,
  onNavigateToFindCustomers,
  currentProject
}) => {
  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [generationData, setGenerationData] = useState<IdeaGenerationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customFilter, setCustomFilter] = useState('');
  const [showFilterBox, setShowFilterBox] = useState(false);
  const [taskAddedToast, setTaskAddedToast] = useState(false);
  const [expandedAlternativeId, setExpandedAlternativeId] = useState<string | null>(null);

  const fetchIdeas = async (customPrompt?: string) => {
    setIsLoading(true);
    try {
      const result = await generateBusinessIdeas(userProfile, customPrompt || customFilter);
      setIdeas(result.ideas || []);
      if (result.generationData) {
        setGenerationData(result.generationData);
      }
    } catch (err) {
      console.error('Failed to load ideas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ideas.length === 0) {
      fetchIdeas();
    }
  }, []);

  const recommendedDirection = generationData?.directions?.find(d => d.isRecommended) || generationData?.directions?.[0];
  const alternativeDirections = generationData?.directions?.filter(d => d.id !== recommendedDirection?.id) || [];

  const handleSetTodayTask = (dir: BusinessDirection) => {
    if (onSetTodayTaskAsDailyStep && dir.todayTask) {
      onSetTodayTaskAsDailyStep(dir.todayTask);
      setTaskAddedToast(true);
      setTimeout(() => setTaskAddedToast(false), 4000);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 6) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Toast Notification */}
      {taskAddedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-bold">Úkol byl nastaven jako dnešní krok!</p>
            <p className="text-[11px] text-emerald-300/80">Najdeš ho na Hlavním Dashboardu.</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="space-y-2.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
            <Target className="w-3.5 h-3.5" />
            <span>Exekuční doporučovací logika PODNIKAI</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Výběr jednoho nejlepšího směru
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Cílem PODNIKAI není zahlcovat tě desítkami obecných nápadů, ale vyhodnotit tvé kapacity, 
            striktně oddělit <strong>fakta od odhadů</strong> a doporučit <strong className="text-blue-400">JEDEN konkrétní směr</strong> s plánem na prvního platícího klienta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            id="btn-toggle-filters"
            onClick={() => setShowFilterBox(!showFilterBox)}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-2 backdrop-blur-md"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Upravit zadání</span>
          </button>

          <button
            id="btn-refresh-ideas"
            onClick={() => fetchIdeas()}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Analyzuji trh...' : 'Přegenerovat analýzu'}</span>
          </button>
        </div>
      </div>

      {/* Filter / Custom preferences box */}
      {showFilterBox && (
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-5 space-y-3 backdrop-blur-xl">
          <label className="block text-xs font-semibold text-blue-300">
            Chceš zúžit analýzu na specifický obor, technologii nebo lokalitu?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              placeholder="např. Zaměř se na automatizace pro realitní makléře, nebo lokální čištění v Brně..."
              className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                fetchIdeas(customFilter);
                setShowFilterBox(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20"
            >
              Filtrovat
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="animate-pulse bg-white/5 border border-white/10 rounded-3xl p-6 h-36 backdrop-blur-xl" />
          <div className="animate-pulse bg-white/5 border border-white/10 rounded-3xl p-8 h-96 backdrop-blur-xl" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* STEP 1: USER EVALUATION ACCORDING TO PROMPT */}
          {generationData?.userEvaluation && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Krok 1: Vyhodnocení tvých možností a limitů</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {/* Kapitál */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kapitál ({userProfile.startingBudget})</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.capitalAssessment}
                  </p>
                </div>

                {/* Dovednosti */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Award className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dovednosti & Zájmy</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.skillsAssessment}
                  </p>
                </div>

                {/* Čas */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Čas ({userProfile.availableTime})</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.timeAssessment}
                  </p>
                </div>

                {/* Styl prodeje */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Styl & kanál prodeje</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.salesStyleAssessment}
                  </p>
                </div>

                {/* Požadovaný příjem */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cíl ({userProfile.targetIncome})</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.targetIncomeAssessment}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 & 5: THE FEATURED RECOMMENDED DIRECTION #1 */}
          {recommendedDirection && (
            <div className="bg-gradient-to-b from-blue-950/40 to-slate-900/80 border-2 border-blue-500/60 rounded-3xl p-6 sm:p-9 backdrop-blur-2xl relative overflow-hidden shadow-2xl shadow-blue-500/10 space-y-8">
              
              {/* Highlight badge */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/30">
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>Doporučený směr č. 1</span>
                </div>
                {currentProject === recommendedDirection.title && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    ✓ Tvůj aktuálně aktivní projekt
                  </span>
                )}
              </div>

              {/* Title & Tagline & Verdict */}
              <div className="space-y-3">
                <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {recommendedDirection.title}
                </h2>
                <p className="text-base text-blue-300 font-medium">
                  {recommendedDirection.tagline}
                </p>
                <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                  {recommendedDirection.description}
                </p>
                
                {/* Recommendation Reason */}
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed">
                  <strong className="text-white font-bold block mb-1">Proč je tento směr doporučen jako #1:</strong>
                  {recommendedDirection.recommendationReason || generationData?.comparisonVerdict}
                </div>
              </div>

              {/* STEP 3: 5-PILLAR RATINGS MATRIX */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-400" />
                  <span>Hodnocení podle 5 klíčových pilířů (1-10)</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  
                  {/* 1. Rychlost 1. klienta */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Rychlost 1. klienta</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getScoreColor(recommendedDirection.ratings?.speedToFirstClient?.score || 9)}`}>
                        {recommendedDirection.ratings?.speedToFirstClient?.score}/10
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium pt-1">
                      {recommendedDirection.ratings?.speedToFirstClient?.text}
                    </p>
                  </div>

                  {/* 2. Vstupní náklady */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Vstupní náklady</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getScoreColor(recommendedDirection.ratings?.upfrontCosts?.score || 9)}`}>
                        {recommendedDirection.ratings?.upfrontCosts?.score}/10
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium pt-1">
                      {recommendedDirection.ratings?.upfrontCosts?.text}
                    </p>
                  </div>

                  {/* 3. Potenciál marže */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Potenciál marže</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getScoreColor(recommendedDirection.ratings?.marginPotential?.score || 8)}`}>
                        {recommendedDirection.ratings?.marginPotential?.score}/10
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium pt-1">
                      {recommendedDirection.ratings?.marginPotential?.text}
                    </p>
                  </div>

                  {/* 4. Konkurence v ČR */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Konkurence v ČR</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getScoreColor(recommendedDirection.ratings?.competitionInCz?.score || 8)}`}>
                        {recommendedDirection.ratings?.competitionInCz?.score}/10
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium pt-1">
                      {recommendedDirection.ratings?.competitionInCz?.text}
                    </p>
                  </div>

                  {/* 5. Škálovatelnost */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Možnost škálování</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getScoreColor(recommendedDirection.ratings?.scalability?.score || 7)}`}>
                        {recommendedDirection.ratings?.scalability?.score}/10
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium pt-1">
                      {recommendedDirection.ratings?.scalability?.text}
                    </p>
                  </div>

                </div>
              </div>

              {/* EPISTEMIC SECTION: STRICT DISTINCTION BETWEEN FACTS, ESTIMATES & MODEL */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/70 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Důsledné ověření dat & Epistemická analýza</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  {/* Verified Facts */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> [Fakta] Reálně ověřitelné skutečnosti & poplatky v ČR
                    </span>
                    <ul className="space-y-1.5 text-slate-300 pl-4 list-disc marker:text-emerald-500">
                      {recommendedDirection.epistemic?.verifiedFacts?.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Needs Market Verification */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/20">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5" /> [Nutno ověřit na trhu] Nesmí se vymýšlet
                    </span>
                    <ul className="space-y-1.5 text-slate-300 pl-4 list-disc marker:text-rose-500">
                      {recommendedDirection.epistemic?.needsMarketVerification?.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Market Estimates */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" /> [Tržní odhady] Orientační cenové hladiny & časy
                    </span>
                    <ul className="space-y-1.5 text-slate-300 pl-4 list-disc marker:text-amber-500">
                      {recommendedDirection.epistemic?.marketEstimates?.map((est, idx) => (
                        <li key={idx}>{est}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Model Scenario */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> [Modelový scénář] Matematická simulace kalkulace
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      {recommendedDirection.epistemic?.modelScenario}
                    </p>
                  </div>

                </div>
              </div>

              {/* CONCRETE EXECUTION BLUEPRINT (Offer, Customer, Pricing, Outreach, 7-Day Plan) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span>Konkrétní exekuční balíček pro doporučený směr</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nabídka (USP) */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> Konkrétní nabídka & balíček (USP)
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {recommendedDirection.concreteOffer}
                    </p>
                  </div>

                  {/* Cílový zákazník */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Cílový platící zákazník
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {recommendedDirection.targetCustomer}
                    </p>
                  </div>

                  {/* Cenotvorba */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" /> Cena a marže
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {recommendedDirection.pricingStructure}
                    </p>
                  </div>

                  {/* Způsob oslovení & Skript */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" /> Způsob oslovení & Prodejní skript
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed italic">
                      {recommendedDirection.outreachMethod}
                    </p>
                  </div>
                </div>

                {/* 7denní plán k 1. platícímu klientovi */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> 7denní plán k získání 1. platícího klienta
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {recommendedDirection.firstClientPlan}
                  </p>
                </div>
              </div>

              {/* STEP 6: TODAY'S CONCRETE TASK BLOCK */}
              {recommendedDirection.todayTask && (
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border-2 border-blue-400/40 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Konkrétní úkol, který můžeš udělat ještě DNES ({recommendedDirection.todayTask.estimatedMinutes} minut):</span>
                    </div>
                    <h4 className="text-base font-bold text-white">
                      {recommendedDirection.todayTask.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {recommendedDirection.todayTask.description}
                    </p>
                    <p className="text-[11px] text-blue-200 italic">
                      Důvod: {recommendedDirection.todayTask.whyToday}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      id="btn-set-today-task"
                      onClick={() => handleSetTodayTask(recommendedDirection)}
                      className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-xl shadow-blue-500/30 flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Nastavit jako dnešní krok</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PRIMARY ACTION BUTTONS */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {/* 1. Najít první zákazníky button (Requirement 1) */}
                <button
                  id={`btn-find-customers-${recommendedDirection.id}`}
                  onClick={() => {
                    if (onNavigateToFindCustomers) {
                      onNavigateToFindCustomers(recommendedDirection);
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span>Najít první zákazníky</span>
                </button>

                <button
                  id={`btn-plan-${recommendedDirection.id}`}
                  onClick={() => {
                    const mappedIdea = ideas.find(i => i.id === recommendedDirection.id) || {
                      id: recommendedDirection.id,
                      title: recommendedDirection.title,
                      tagline: recommendedDirection.tagline,
                      description: recommendedDirection.description,
                      initialCosts: recommendedDirection.ratings?.upfrontCosts?.text || '',
                      initialCostsLevel: 'low',
                      difficulty: 'low',
                      incomePotential: recommendedDirection.epistemic?.modelScenario || '',
                      launchSpeed: recommendedDirection.ratings?.speedToFirstClient?.text || '',
                      risk: 'low',
                      whyItFits: recommendedDirection.recommendationReason,
                      firstValidationStep: recommendedDirection.todayTask?.title || '',
                      targetAudience: recommendedDirection.targetCustomer
                    };
                    onSelectIdeaForPlan(mappedIdea);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-bold text-xs transition-colors backdrop-blur-md"
                >
                  <FileText className="w-4 h-4" />
                  <span>Byznys plán</span>
                </button>

                <button
                  id={`btn-chat-${recommendedDirection.id}`}
                  onClick={() => {
                    const mappedIdea = ideas.find(i => i.id === recommendedDirection.id) || {
                      id: recommendedDirection.id,
                      title: recommendedDirection.title,
                      tagline: recommendedDirection.tagline,
                      description: recommendedDirection.description,
                      initialCosts: '',
                      initialCostsLevel: 'low',
                      difficulty: 'low',
                      incomePotential: '',
                      launchSpeed: '',
                      risk: 'low',
                      whyItFits: '',
                      firstValidationStep: '',
                      targetAudience: ''
                    };
                    onAskAiAboutIdea(mappedIdea);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs transition-colors backdrop-blur-md"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Probrat s AI</span>
                </button>
              </div>

            </div>
          )}

          {/* ALTERNATIVE DIRECTIONS (Max 2 remaining) */}
          {alternativeDirections.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-slate-400" />
                  <span>Alternativní směry (2. a 3. možnost)</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Pokud by ti doporučený směr nevyhovoval, tyto 2 směry jsou rovněž proveditelné.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {alternativeDirections.map((alt) => {
                  const isExpanded = expandedAlternativeId === alt.id;
                  const isCurrent = currentProject === alt.title;

                  return (
                    <div
                      key={alt.id}
                      className={`p-6 rounded-3xl border transition-all duration-200 relative backdrop-blur-xl flex flex-col justify-between space-y-4 ${
                        isCurrent
                          ? 'bg-white/10 border-blue-500 shadow-xl'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Alternativní směr
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                            Rychlost: {alt.ratings?.speedToFirstClient?.text || 'Do 7 dnů'}
                          </span>
                        </div>

                        <h4 className="font-heading text-lg font-bold text-white">
                          {alt.title}
                        </h4>
                        <p className="text-xs text-blue-300 font-medium">
                          {alt.tagline}
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {alt.description}
                        </p>

                        {/* Why not #1 */}
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-300">
                          <strong className="text-slate-200 block mb-0.5">Srovnání s doporučeným #1:</strong>
                          {alt.recommendationReason}
                        </div>

                        {/* Epistemic overview */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                          <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/10 text-slate-300">
                            <span className="text-emerald-400 block font-bold">[Fakta]</span>
                            {alt.epistemic?.verifiedFacts?.[0] || 'Ověřené poplatky'}
                          </div>
                          <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-500/10 text-slate-300">
                            <span className="text-blue-400 block font-bold">[Model]</span>
                            {alt.epistemic?.modelScenario?.substring(0, 75) || 'Dle modelu'}...
                          </div>
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="pt-2 flex gap-2">
                        <button
                          id={`btn-alt-plan-${alt.id}`}
                          onClick={() => {
                            const mappedIdea = ideas.find(i => i.id === alt.id) || {
                              id: alt.id,
                              title: alt.title,
                              tagline: alt.tagline,
                              description: alt.description,
                              initialCosts: alt.ratings?.upfrontCosts?.text || '',
                              initialCostsLevel: 'medium',
                              difficulty: 'medium',
                              incomePotential: alt.epistemic?.modelScenario || '',
                              launchSpeed: alt.ratings?.speedToFirstClient?.text || '',
                              risk: 'medium',
                              whyItFits: alt.recommendationReason,
                              firstValidationStep: alt.todayTask?.title || '',
                              targetAudience: alt.targetCustomer
                            };
                            onSelectIdeaForPlan(mappedIdea);
                          }}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Zvolit tento směr</span>
                        </button>

                        <button
                          id={`btn-alt-chat-${alt.id}`}
                          onClick={() => {
                            const mappedIdea = ideas.find(i => i.id === alt.id) || {
                              id: alt.id,
                              title: alt.title,
                              tagline: alt.tagline,
                              description: alt.description,
                              initialCosts: '',
                              initialCostsLevel: 'medium',
                              difficulty: 'medium',
                              incomePotential: '',
                              launchSpeed: '',
                              risk: 'medium',
                              whyItFits: '',
                              firstValidationStep: '',
                              targetAudience: ''
                            };
                            onAskAiAboutIdea(mappedIdea);
                          }}
                          className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs transition-colors"
                          title="Probrat v AI Chatu"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </>
      )}

    </div>
  );
};
