import React, { useState, useEffect, useMemo } from 'react';
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
  Flame,
  Search,
  X,
  Sparkles,
  Filter,
  Briefcase,
  MapPin,
  BadgePercent,
  ChevronRight,
  Eye,
  Info,
  Calculator
} from 'lucide-react';
import { BusinessIdea, BusinessDirection, IdeaGenerationResponse, UserProfile, IdeaScoreBreakdown } from '../types';
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
  
  // Search & Filter state for the 12-15 ideas catalog
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'fit' | 'speed' | 'cost' | 'margin' | 'scale'>('fit');
  
  // Detailed modal for any idea
  const [inspectingIdea, setInspectingIdea] = useState<BusinessIdea | null>(null);
  const [inspectingScoreBreakdown, setInspectingScoreBreakdown] = useState<IdeaScoreBreakdown | null>(null);

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

  const recommendedDirection = useMemo(() => {
    return generationData?.directions?.find(d => d.isRecommended) || generationData?.directions?.[0];
  }, [generationData]);

  const recommendedIdea = useMemo(() => {
    if (!recommendedDirection) return ideas[0] || null;
    return ideas.find(i => i.id === recommendedDirection.id) || ideas[0] || null;
  }, [ideas, recommendedDirection]);

  const handleSetTodayTask = (task?: { title: string; description: string; estimatedMinutes: number; whyToday?: string }) => {
    if (onSetTodayTaskAsDailyStep && task) {
      onSetTodayTaskAsDailyStep(task);
      setTaskAddedToast(true);
      setTimeout(() => setTaskAddedToast(false), 4000);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80 || (score <= 10 && score >= 8)) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 60 || (score <= 10 && score >= 6)) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  };

  // Distinct categories available in current ideas
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    ideas.forEach(i => {
      if (i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [ideas]);

  // Filtered and sorted ideas list
  const filteredIdeas = useMemo(() => {
    let result = [...ideas];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(i => 
        i.title.toLowerCase().includes(q) ||
        i.tagline.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.problemSolved.toLowerCase().includes(q) ||
        i.targetAudience.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(i => i.category === selectedCategory);
    }

    result.sort((a, b) => {
      if (sortBy === 'fit') {
        return (b.fitScore || 0) - (a.fitScore || 0);
      }
      if (sortBy === 'speed') {
        const scoreA = a.directionData?.ratings?.speedToFirstClient?.score || 5;
        const scoreB = b.directionData?.ratings?.speedToFirstClient?.score || 5;
        return scoreB - scoreA;
      }
      if (sortBy === 'cost') {
        const scoreA = a.directionData?.ratings?.upfrontCosts?.score || 5;
        const scoreB = b.directionData?.ratings?.upfrontCosts?.score || 5;
        return scoreB - scoreA; // higher score = lower cost/easier
      }
      if (sortBy === 'margin') {
        const scoreA = a.directionData?.ratings?.marginPotential?.score || 5;
        const scoreB = b.directionData?.ratings?.marginPotential?.score || 5;
        return scoreB - scoreA;
      }
      if (sortBy === 'scale') {
        const scoreA = a.directionData?.ratings?.scalability?.score || 5;
        const scoreB = b.directionData?.ratings?.scalability?.score || 5;
        return scoreB - scoreA;
      }
      return 0;
    });

    return result;
  }, [ideas, searchTerm, selectedCategory, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Toast Notification */}
      {taskAddedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-bold">Úkol byl nastaven jako dnešní krok!</p>
            <p className="text-[11px] text-emerald-300/80">Najdeš ho na Hlavním Dashboardu.</p>
          </div>
        </div>
      )}

      {/* Header Banner with Personalized Profile Details */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Personalizovaný generátor podnikatelských nápadů PODNIKAI</span>
            </div>
            
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {ideas.length > 0 ? `${ideas.length} podnikatelských nápadů přesně pro tebe` : 'Výběr podnikatelských směrů'}
            </h1>
            
            <p className="text-sm text-slate-300 leading-relaxed">
              Nápady nevychází z generické šablony, ale ze <strong>VŠECH informací</strong>, které jsi zadal v dotazníku. 
              Každý nápad je vyhodnocen přesným deterministickým skóre shody s tvými zkušenostmi, časem, kapitálem a cíli.
              <span className="block mt-1 text-xs text-slate-400">
                Skóre shody vyjadřuje pouze míru souladu podnikatelského modelu s údaji zadanými uživatelem.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
            <button
              id="btn-toggle-filters"
              onClick={() => setShowFilterBox(!showFilterBox)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-2 backdrop-blur-md"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Změnit zadání / filtr</span>
            </button>

            <button
              id="btn-refresh-ideas"
              onClick={() => fetchIdeas()}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzuji...' : 'Přegenerovat analýzu'}</span>
            </button>
          </div>
        </div>

        {/* User Profile Context Chips */}
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs relative z-10">
          <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider mr-1">Vstupy profilu:</span>
          
          {userProfile.workExperience && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
              <Briefcase className="w-3 h-3 text-blue-400" />
              <span>{userProfile.workExperience.substring(0, 30)}{userProfile.workExperience.length > 30 ? '...' : ''}</span>
            </span>
          )}

          {userProfile.currentJob && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
              <Users className="w-3 h-3 text-indigo-400" />
              <span>{userProfile.currentJob}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
            <Coins className="w-3 h-3 text-emerald-400" />
            <span>Rozpočet: {userProfile.startingBudget || 'neuveden'}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Čas: {userProfile.availableTime || 'neuveden'}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>Cíl: {userProfile.targetIncome || 'neuveden'}</span>
          </span>

          {userProfile.location && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
              <MapPin className="w-3 h-3 text-rose-400" />
              <span>{userProfile.location}</span>
            </span>
          )}

          {userProfile.onlineOffline && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-200">
              <Zap className="w-3 h-3 text-purple-400" />
              <span>{userProfile.onlineOffline === 'online' ? 'Online model' : userProfile.onlineOffline === 'offline' ? 'Lokální / osobní' : 'Hybridní model'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter / Custom preferences box */}
      {showFilterBox && (
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-5 space-y-3 backdrop-blur-xl animate-in fade-in">
          <label className="block text-xs font-semibold text-blue-300">
            Chceš zúžit analýzu na specifický obor, technologii nebo lokalitu?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              placeholder="např. Zaměř se na B2B firemní klientelu, prémiový segment v Praze nebo online kurzy..."
              className="flex-1 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="animate-pulse bg-white/5 border border-white/10 rounded-2xl p-6 h-64" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* STEP 1: USER EVALUATION ACCORDING TO PROMPT */}
          {generationData?.userEvaluation && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Vyhodnocení tvých možností a limitů</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {/* Kapitál */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kapitál ({userProfile.startingBudget})</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.capitalAssessment}
                  </p>
                </div>

                {/* Dovednosti */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Award className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dovednosti & Zkušenosti</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.skillsAssessment}
                  </p>
                </div>

                {/* Čas */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Čas ({userProfile.availableTime})</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.timeAssessment}
                  </p>
                </div>

                {/* Styl prodeje */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Styl & kanál prodeje</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {generationData.userEvaluation.salesStyleAssessment}
                  </p>
                </div>

                {/* Požadovaný příjem */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
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

          {/* FEATURED: THE #1 RECOMMENDED DIRECTION (Full Execution Blueprint) */}
          {recommendedDirection && recommendedIdea && (
            <div className="bg-gradient-to-b from-blue-950/40 via-slate-900/90 to-slate-900/80 border-2 border-blue-500/60 rounded-3xl p-6 sm:p-9 backdrop-blur-2xl relative overflow-hidden shadow-2xl shadow-blue-500/10 space-y-8">
              
              {/* Highlight badge and fit score */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/30">
                    <Flame className="w-4 h-4 text-amber-300" />
                    <span>Doporučený směr č. 1</span>
                  </div>

                  <button
                    onClick={() => {
                      setInspectingScoreBreakdown(recommendedIdea.scoreBreakdown || null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${getScoreColor(recommendedIdea.fitScore || 95)}`}
                    title="Klikni pro detailní bodový rozpad skóre"
                  >
                    <BadgePercent className="w-3.5 h-3.5" />
                    <span>Skóre shody: {recommendedIdea.fitScore || 95} %</span>
                    <Info className="w-3 h-3 opacity-60" />
                  </button>

                  {recommendedIdea.category && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                      {recommendedIdea.category}
                    </span>
                  )}
                </div>

                {currentProject === recommendedDirection.title && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    ✓ Tvůj aktuálně aktivní projekt
                  </span>
                )}
              </div>

              {/* Title, Tagline, Description & Recommendation Reason */}
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

              {/* 5-PILLAR RATINGS MATRIX */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-400" />
                  <span>Hodnocení podle 5 klíčových pilířů</span>
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

              {/* EPISTEMIC SECTION: FACTS, ESTIMATES & MODEL */}
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

              {/* CONCRETE EXECUTION BLUEPRINT */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span>Konkrétní exekuční balíček</span>
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
                      <Coins className="w-3.5 h-3.5" /> Cenotvorba & marže
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {recommendedDirection.pricingStructure}
                    </p>
                  </div>

                  {/* Způsob oslovení */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" /> Kanál oslovení & prodejní skript
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {recommendedDirection.outreachMethod}
                    </p>
                  </div>
                </div>

                {/* 7-Day Plan */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> 7denní exekuční plán k prvnímu klientovi
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {recommendedDirection.firstClientPlan}
                  </p>
                </div>
              </div>

              {/* TODAY TASK CARD */}
              {recommendedDirection.todayTask && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Konkrétní úkol na dnešek ({recommendedDirection.todayTask.estimatedMinutes} min)
                    </span>
                    <button
                      id="btn-set-today-task-main"
                      onClick={() => handleSetTodayTask(recommendedDirection.todayTask)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Nastavit jako dnešní krok</span>
                    </button>
                  </div>
                  <h5 className="font-heading text-base font-bold text-white">
                    {recommendedDirection.todayTask.title}
                  </h5>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {recommendedDirection.todayTask.description}
                  </p>
                  <p className="text-[11px] text-blue-300 italic">
                    Proč právě dnes: {recommendedDirection.todayTask.whyToday}
                  </p>
                </div>
              )}

              {/* ACTION BUTTONS FOR RECOMMENDED DIRECTION */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id={`btn-plan-${recommendedDirection.id}`}
                  onClick={() => onSelectIdeaForPlan(recommendedIdea)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Zvolit tento směr a vytvořit plán</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id={`btn-leads-${recommendedDirection.id}`}
                  onClick={() => {
                    if (onNavigateToFindCustomers) {
                      onNavigateToFindCustomers(recommendedDirection);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs transition-colors backdrop-blur-md"
                >
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Najít první zákazníky</span>
                </button>

                <button
                  id={`btn-chat-${recommendedDirection.id}`}
                  onClick={() => onAskAiAboutIdea(recommendedIdea)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs transition-colors backdrop-blur-md"
                >
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span>Probrat s AI</span>
                </button>
              </div>

            </div>
          )}

          {/* COMPLETE CATALOG OF ALL 12-15 PERSONALIZED IDEAS */}
          <div className="space-y-6 pt-6">
            
            {/* Catalog Header and Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span>Všech {ideas.length} personalizovaných podnikatelských směrů</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Prozkoumej celé spektrum možností vygenerovaných na míru tvému dotazníku. Každý nápad můžeš ihned rozkliknout nebo rozvinout.
                </p>
              </div>

              {/* Sort & Search Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Hledat v nápadech..."
                    className="pl-8 pr-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">Řadit:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="fit" className="bg-slate-900 text-slate-200">Podle shody (fit score)</option>
                    <option value="speed" className="bg-slate-900 text-slate-200">Podle rychlosti 1. klienta</option>
                    <option value="cost" className="bg-slate-900 text-slate-200">Podle nízkých nákladů</option>
                    <option value="margin" className="bg-slate-900 text-slate-200">Podle marže</option>
                    <option value="scale" className="bg-slate-900 text-slate-200">Podle škálovatelnosti</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            {availableCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  Všechny ({ideas.length})
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    {cat} ({ideas.filter(i => i.category === cat).length})
                  </button>
                ))}
              </div>
            )}

            {/* 12-Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIdeas.map((idea, index) => {
                const isTop1 = idea.id === recommendedDirection?.id;
                const isCurrent = currentProject === idea.title;

                return (
                  <div
                    key={idea.id}
                    className={`rounded-3xl border transition-all duration-200 p-6 flex flex-col justify-between backdrop-blur-xl relative group ${
                      isCurrent
                        ? 'bg-blue-950/20 border-blue-500 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/40'
                        : isTop1
                        ? 'bg-white/[0.07] border-blue-500/40 hover:border-blue-500/60'
                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                    }`}
                  >
                    {/* Card Top: Rank, Category & Fit Score */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                            isTop1 
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}>
                            #{index + 1}
                          </span>
                          
                          {idea.category && (
                            <span className="text-[11px] font-medium text-slate-400 truncate max-w-[140px]">
                              {idea.category}
                            </span>
                          )}
                        </div>

                        {/* Deterministic Score pill */}
                        <button
                          onClick={() => setInspectingScoreBreakdown(idea.scoreBreakdown || null)}
                          className={`px-2 py-0.5 rounded-md font-bold text-xs border flex items-center gap-1 ${getScoreColor(idea.fitScore || 85)}`}
                          title="Zobrazit bodový rozpad skóre"
                        >
                          <span>{idea.fitScore || 85} %</span>
                          <span className="text-[10px] font-normal opacity-75">shoda</span>
                        </button>
                      </div>

                      {/* Title & Tagline */}
                      <div>
                        <h4 className="font-heading text-lg font-bold text-white group-hover:text-blue-300 transition-colors leading-snug">
                          {idea.title}
                        </h4>
                        <p className="text-xs text-blue-300/90 font-medium mt-1">
                          {idea.tagline}
                        </p>
                      </div>

                      {/* 12-Point Essential Insights */}
                      <div className="space-y-2 pt-1 text-xs">
                        {/* Why it fits */}
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-slate-300">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-0.5">
                            Proč se hodí právě pro tebe:
                          </span>
                          <p className="text-[11px] leading-relaxed line-clamp-2">
                            {idea.whyItFits}
                          </p>
                        </div>

                        {/* Problem & Audience */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-slate-950/40 border border-white/5">
                            <span className="text-[10px] font-bold text-slate-400 block">Řešený problém</span>
                            <span className="text-slate-200 line-clamp-2">{idea.problemSolved}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/40 border border-white/5">
                            <span className="text-[10px] font-bold text-slate-400 block">Cílový zákazník</span>
                            <span className="text-slate-200 line-clamp-2">{idea.targetAudience}</span>
                          </div>
                        </div>

                        {/* Monetization & Initial cost */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-slate-950/40 border border-white/5">
                            <span className="text-[10px] font-bold text-emerald-400 block">Investice</span>
                            <span className="text-slate-200 truncate block">{idea.initialCosts}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/40 border border-white/5">
                            <span className="text-[10px] font-bold text-amber-400 block">Rychlost 1. klienta</span>
                            <span className="text-slate-200 truncate block">{idea.launchSpeed}</span>
                          </div>
                        </div>

                        {/* First validation step */}
                        <div className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-200 text-[11px]">
                          <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">
                            První krok validace:
                          </span>
                          <p className="line-clamp-2 text-slate-300">
                            {idea.firstValidationStep}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom: Action Buttons */}
                    <div className="pt-5 space-y-2">
                      <button
                        id={`btn-card-plan-${idea.id}`}
                        onClick={() => onSelectIdeaForPlan(idea)}
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Zvolit a vytvořit plán</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex gap-2">
                        <button
                          id={`btn-card-detail-${idea.id}`}
                          onClick={() => setInspectingIdea(idea)}
                          className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Kompletní rozbor</span>
                        </button>

                        <button
                          id={`btn-card-chat-${idea.id}`}
                          onClick={() => onAskAiAboutIdea(idea)}
                          className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                          title="Probrat nápad s AI parťákem"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {filteredIdeas.length === 0 && (
              <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/10 p-8 space-y-3">
                <p className="text-base text-slate-300 font-semibold">Žádný nápad neodpovídá zadanému hledání.</p>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                >
                  Zobrazit všechny nápady
                </button>
              </div>
            )}

          </div>
        </>
      )}

      {/* FULL DETAIL MODAL FOR ANY SELECTED IDEA */}
      {inspectingIdea && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                    {inspectingIdea.category || 'Podnikatelský směr'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(inspectingIdea.fitScore || 85)}`}>
                    Shoda: {inspectingIdea.fitScore || 85} %
                  </span>
                </div>
                <h3 className="font-heading text-2xl font-extrabold text-white">
                  {inspectingIdea.title}
                </h3>
                <p className="text-sm text-blue-300 font-medium">
                  {inspectingIdea.tagline}
                </p>
              </div>

              <button
                onClick={() => setInspectingIdea(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description & Fit */}
            <div className="space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                {inspectingIdea.description}
              </p>
              
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                <strong className="text-white font-bold block mb-1">Proč se hodí právě pro tebe:</strong>
                {inspectingIdea.whyItFits}
              </div>
            </div>

            {/* 12-Point Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">Řešený problém</span>
                <p className="text-slate-200">{inspectingIdea.problemSolved}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">Cílová skupina</span>
                <p className="text-slate-200">{inspectingIdea.targetAudience}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 block">Způsob výdělku</span>
                <p className="text-slate-200">{inspectingIdea.monetization}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-amber-400 block">Jak začít</span>
                <p className="text-slate-200">{inspectingIdea.howToStart}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-blue-400 block">Počáteční investice</span>
                <p className="text-slate-200">{inspectingIdea.initialCosts}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-purple-400 block">Časová náročnost & rychlost</span>
                <p className="text-slate-200">{inspectingIdea.timeCommitment} ({inspectingIdea.launchSpeed})</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-cyan-400 block">Škálovatelnost</span>
                <p className="text-slate-200">{inspectingIdea.scalability}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-rose-400 block">Hlavní riziko & jak ho omezit</span>
                <p className="text-slate-200">{inspectingIdea.mainRisk}</p>
              </div>
            </div>

            {/* Direction Data Extra if available (Epistemics, Offer, Script, 7-Day Plan) */}
            {inspectingIdea.directionData && (
              <div className="space-y-4 pt-2 border-t border-white/10">
                {/* MATEMATICKÝ MODEL & PRACOVNÍ PŘEDPOKLADY */}
                {inspectingIdea.mathematicalModel && (
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Calculator className="w-4 h-4" />
                      <span>Matematika byznys modelu & jednotková ekonomika</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-slate-400 block font-semibold">Pracovní cenový předpoklad:</span>
                        <span className="text-white font-mono">{inspectingIdea.mathematicalModel.workingPriceAssumption}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-slate-400 block font-semibold">Potřebný počet klientů:</span>
                        <span className="text-white font-mono">{inspectingIdea.mathematicalModel.requiredClients}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-slate-400 block font-semibold">Modelovaný měsíční příjem:</span>
                        <span className="text-emerald-300 font-bold font-mono">{inspectingIdea.mathematicalModel.modelMonthlyIncome}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-slate-400 block font-semibold">Rozpad týdenních hodin:</span>
                        <span className="text-white font-mono">{inspectingIdea.mathematicalModel.weeklyHoursBreakdown}</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                      <strong className="block text-amber-300 font-bold mb-0.5">Co je nutno ověřit v terénu:</strong>
                      {inspectingIdea.mathematicalModel.toVerifyOnMarket}
                    </div>
                  </div>
                )}

                {/* VALIDAČNÍ METRIKY A PLÁN TRHU */}
                {inspectingIdea.marketValidation && (
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-blue-500/20 space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <Target className="w-4 h-4" />
                      <span>Tržní validační plán (Ověření poptávky bez garancí dnů)</span>
                    </div>
                    <div className="space-y-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-slate-400 block font-semibold">Doporučený postup validace:</span>
                        <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-200">
                          {inspectingIdea.marketValidation.validationSteps?.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-200">
                          <strong className="block text-emerald-400 font-bold">Signál pro pokračování (GO):</strong>
                          {inspectingIdea.marketValidation.signalGo}
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-rose-200">
                          <strong className="block text-rose-400 font-bold">Signál pro změnu nabídky (PIVOT):</strong>
                          {inspectingIdea.marketValidation.signalPivot}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2 text-xs">
                  <span className="text-amber-400 font-bold block">
                    Konkrétní nabídka & skript oslovení:
                  </span>
                  <p className="text-slate-200 leading-relaxed font-mono text-[11px] bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    {inspectingIdea.directionData.outreachMethod}
                  </p>
                  <p className="text-emerald-300 font-medium pt-1">
                    Cenotvorba: {inspectingIdea.directionData.pricingStructure}
                  </p>
                </div>

                {inspectingIdea.directionData.todayTask && (
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                        Dnešní 30minutový úkol:
                      </span>
                      <p className="text-xs text-white font-semibold mt-0.5">
                        {inspectingIdea.directionData.todayTask.title}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetTodayTask(inspectingIdea.directionData?.todayTask)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0"
                    >
                      Nastavit jako dnešní krok
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
              <button
                id="btn-modal-choose-plan"
                onClick={() => {
                  onSelectIdeaForPlan(inspectingIdea);
                  setInspectingIdea(null);
                }}
                className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Zvolit tento směr a vytvořit byznys plán</span>
              </button>

              {inspectingIdea.directionData && onNavigateToFindCustomers && (
                <button
                  onClick={() => {
                    onNavigateToFindCustomers(inspectingIdea.directionData);
                    setInspectingIdea(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Najít zákazníky</span>
                </button>
              )}

              <button
                onClick={() => {
                  onAskAiAboutIdea(inspectingIdea);
                  setInspectingIdea(null);
                }}
                className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold"
              >
                Probrat s AI
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SCORE BREAKDOWN MODAL */}
      {inspectingScoreBreakdown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-blue-400" />
                <h4 className="font-heading text-lg font-bold text-white">
                  Deterministický rozpad skóre shody (10 faktorů)
                </h4>
              </div>
              <button
                onClick={() => setInspectingScoreBreakdown(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explicit Epistemic Disclaimer */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed">
              <p className="font-semibold text-white mb-1">
                ℹ️ Princip výpočtu skóre
              </p>
              <p className="text-slate-300">
                Skóre shody vyjadřuje <strong>pouze míru souladu podnikatelského modelu s údaji zadanými uživatelem</strong>. Nejedná se o predikci úspěchu, garanci příjmu, pravděpodobnost konverze ani podnikatelský výsledek.
              </p>
            </div>

            <div className="space-y-2 text-xs max-h-[55vh] overflow-y-auto pr-1">
              {/* 1. Shoda se zkušenostmi */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">1. Shoda se zkušenostmi</span>
                    <span className="text-[10px] text-slate-500">(váha 15 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.experienceMatch?.note || inspectingScoreBreakdown.skillsLeverage?.note || 'Soulad s dosavadní profesní praxí.'}
                  </span>
                </div>
                <span className="font-bold text-blue-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.experienceMatch?.score ?? inspectingScoreBreakdown.skillsLeverage?.score ?? 8}/10
                </span>
              </div>

              {/* 2. Shoda s dovednostmi */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">2. Shoda s konkrétními dovednostmi</span>
                    <span className="text-[10px] text-slate-500">(váha 15 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.skillsMatch?.note || inspectingScoreBreakdown.skillsUtilization?.note || 'Využití silných stránek profilu.'}
                  </span>
                </div>
                <span className="font-bold text-blue-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.skillsMatch?.score ?? inspectingScoreBreakdown.skillsUtilization?.score ?? 8}/10
                </span>
              </div>

              {/* 3. Shoda se zájmy */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">3. Shoda se zájmy a tématy</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.passionsMatch?.note || 'Propojení s preferovanými oblastmi.'}
                  </span>
                </div>
                <span className="font-bold text-teal-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.passionsMatch?.score ?? 8}/10
                </span>
              </div>

              {/* 4. Shoda s online/offline modelem */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">4. Shoda s požadovaným modelem</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.onlineOfflineMatch?.note || '100% soulad s preferovaným online/offline formátem.'}
                  </span>
                </div>
                <span className="font-bold text-cyan-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.onlineOfflineMatch?.score ?? 10}/10
                </span>
              </div>

              {/* 5. Shoda s dostupným kapitálem */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">5. Shoda s dostupným kapitálem</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.budgetFit?.note || inspectingScoreBreakdown.financialFeasibility?.note || 'Soulad s rozpočtovým limitem.'}
                  </span>
                </div>
                <span className="font-bold text-emerald-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.budgetFit?.score || inspectingScoreBreakdown.financialFeasibility?.score || 10}/10
                </span>
              </div>

              {/* 6. Shoda s časovou kapacitou */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">6. Shoda s časovou kapacitou</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.timeFeasibility?.note || inspectingScoreBreakdown.timeAvailability?.note || 'Odpovídá týdennímu časovému fondu.'}
                  </span>
                </div>
                <span className="font-bold text-amber-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.timeFeasibility?.score || inspectingScoreBreakdown.timeAvailability?.score || 9}/10
                </span>
              </div>

              {/* 7. Realističnost cílového příjmu */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">7. Realističnost dosažení cílového příjmu</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.incomeTargetViability?.note || inspectingScoreBreakdown.incomePotential?.note || 'Matematika modelu odpovídá finančnímu cíli.'}
                  </span>
                </div>
                <span className="font-bold text-indigo-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.incomeTargetViability?.score || inspectingScoreBreakdown.incomePotential?.score || 8}/10
                </span>
              </div>

              {/* 8. Náročnost získání prvního zákazníka */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">8. Náročnost získání 1. zákazníka</span>
                    <span className="text-[10px] text-slate-500">(váha 10 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.acquisitionEase?.note || inspectingScoreBreakdown.validationAccessibility?.note || inspectingScoreBreakdown.speedToStart?.note || 'Dostupnost prvního kontaktu a rychlost validace.'}
                  </span>
                </div>
                <span className="font-bold text-rose-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.acquisitionEase?.score ?? inspectingScoreBreakdown.validationAccessibility?.score ?? inspectingScoreBreakdown.speedToStart?.score ?? 8}/10
                </span>
              </div>

              {/* 9. Využitelnost existujících aktiv a kontaktů */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">9. Využitelnost aktiv a kontaktů</span>
                    <span className="text-[10px] text-slate-500">(váha 5 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.networkLeverage?.note || 'Možnost využít stávající síť kontaktů nebo volné nástroje.'}
                  </span>
                </div>
                <span className="font-bold text-violet-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.networkLeverage?.score ?? 8}/10
                </span>
              </div>

              {/* 10. Potenciál škálování */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">10. Potenciál škálování</span>
                    <span className="text-[10px] text-slate-500">(váha 5 %)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {inspectingScoreBreakdown.scalabilityPotential?.note || inspectingScoreBreakdown.scalability?.note || 'Možnost přechodu na paušály či produkty.'}
                  </span>
                </div>
                <span className="font-bold text-purple-400 text-sm shrink-0">
                  {inspectingScoreBreakdown.scalabilityPotential?.score || inspectingScoreBreakdown.scalability?.score || 8}/10
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-white">Celkové vážené skóre shody:</span>
              <span className="text-base font-extrabold text-blue-400">{inspectingScoreBreakdown.totalScore} / 100</span>
            </div>

            <button
              onClick={() => setInspectingScoreBreakdown(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
            >
              Zavřít rozpad
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
