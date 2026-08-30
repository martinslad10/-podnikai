import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Sparkles, 
  RotateCw, 
  ArrowRight, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  ShieldCheck,
  Briefcase,
  FileText,
  MessageSquare,
  Compass,
  SlidersHorizontal
} from 'lucide-react';
import { BusinessIdea, UserProfile } from '../types';
import { generateBusinessIdeas } from '../services/api';

interface IdeasViewProps {
  userProfile: UserProfile;
  onSelectIdeaForPlan: (idea: BusinessIdea) => void;
  onAskAiAboutIdea: (idea: BusinessIdea) => void;
  currentProject: string;
}

export const IdeasView: React.FC<IdeasViewProps> = ({
  userProfile,
  onSelectIdeaForPlan,
  onAskAiAboutIdea,
  currentProject
}) => {
  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customFilter, setCustomFilter] = useState('');
  const [showFilterBox, setShowFilterBox] = useState(false);

  const fetchIdeas = async (customPrompt?: string) => {
    setIsLoading(true);
    try {
      const generated = await generateBusinessIdeas(userProfile, customPrompt || customFilter);
      setIdeas(generated);
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

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'high': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const getDifficultyLabel = (level: string) => {
    switch (level) {
      case 'low': return 'Nízká';
      case 'high': return 'Vysoká';
      default: return 'Střední';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-400';
      case 'high': return 'text-rose-400';
      default: return 'text-amber-400';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'low': return 'Nízké riziko';
      case 'high': return 'Vyšší riziko';
      default: return 'Střední riziko';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[90px] pointer-events-none rounded-full" />
        
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>AI Generátor nápadů na míru</span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-white">
            Podnikatelské nápady pro tebe
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Vygenerováno přesně podle tvého rozpočtu (<strong className="text-slate-200">{userProfile.startingBudget}</strong>), 
            času (<strong className="text-slate-200">{userProfile.availableTime}</strong>) a dovedností, 
            s eliminací toho, co nechceš dělat.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
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
            <span>{isLoading ? 'Generuji nápady...' : 'Vygenerovat nové'}</span>
          </button>
        </div>
      </div>

      {/* Filter / Custom preferences box */}
      {showFilterBox && (
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-5 space-y-3 backdrop-blur-xl">
          <label className="block text-xs font-semibold text-blue-300">
            Máš speciální přání nebo konkrétní obor, který chceš prozkoumat?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              placeholder="např. Chci něco čistě na bázi AI nástrojů, nebo lokální řemeslo s auty..."
              className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                fetchIdeas(customFilter);
                setShowFilterBox(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20"
            >
              Hledat
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 backdrop-blur-xl">
              <div className="h-6 bg-slate-800 rounded-lg w-3/4" />
              <div className="h-4 bg-slate-800/60 rounded-md w-full" />
              <div className="h-4 bg-slate-800/60 rounded-md w-5/6" />
              <div className="grid grid-cols-2 gap-2 pt-4">
                <div className="h-12 bg-slate-800/40 rounded-xl" />
                <div className="h-12 bg-slate-800/40 rounded-xl" />
              </div>
              <div className="h-10 bg-slate-800 rounded-xl mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Ideas List Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ideas.map((idea) => {
            const isCurrent = currentProject === idea.title;

            return (
              <div
                key={idea.id}
                className={`flex flex-col justify-between p-6 sm:p-7 rounded-3xl transition-all duration-200 relative backdrop-blur-xl ${
                  isCurrent
                    ? 'bg-white/10 border-2 border-blue-500 shadow-xl shadow-blue-500/20'
                    : 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 shadow-lg'
                }`}
              >
                {/* Active Indicator */}
                {isCurrent && (
                  <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider shadow-md">
                    Aktuálně zvolený projekt
                  </div>
                )}

                <div className="space-y-4">
                  {/* Title & Tagline */}
                  <div>
                    <h3 className="font-heading text-xl font-bold text-white mb-1.5 leading-snug">
                      {idea.title}
                    </h3>
                    <p className="text-xs font-medium text-blue-400">
                      {idea.tagline}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {idea.description}
                  </p>

                  {/* 5 Core Metric Badges as requested in prompt */}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                    
                    {/* 1. Počáteční náklady */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-slate-500 block text-[10px]">Počáteční náklady</span>
                      <span className="font-bold text-slate-200">{idea.initialCosts}</span>
                    </div>

                    {/* 2. Náročnost */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-slate-500 block text-[10px]">Náročnost</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getDifficultyColor(idea.difficulty)}`}>
                        {getDifficultyLabel(idea.difficulty)}
                      </span>
                    </div>

                    {/* 3. Potenciál příjmu */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-slate-500 block text-[10px]">Potenciál příjmu</span>
                      <span className="font-bold text-blue-400">{idea.incomePotential}</span>
                    </div>

                    {/* 4. Rychlost spuštění */}
                    <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-slate-500 block text-[10px]">Rychlost spuštění</span>
                      <span className="font-bold text-slate-200">{idea.launchSpeed}</span>
                    </div>

                  </div>

                  {/* 5. Riziko */}
                  <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-slate-900/50 border border-white/5">
                    <span className="text-slate-400">Riziko:</span>
                    <span className={`font-bold ${getRiskColor(idea.risk)}`}>
                      {getRiskLabel(idea.risk)}
                    </span>
                  </div>

                  {/* Proč se hodí právě pro tebe */}
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Proč se hodí pro tebe:
                    </span>
                    <p className="text-xs text-slate-300 italic">
                      „{idea.whyItFits}“
                    </p>
                  </div>

                  {/* První krok k ověření */}
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      <Zap className="w-3 h-3" />
                      <span>První krok k ověření do 48h:</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {idea.firstValidationStep}
                    </p>
                  </div>
                </div>

                {/* Card CTA Actions */}
                <div className="pt-6 space-y-2">
                  <button
                    id={`btn-select-idea-${idea.id}`}
                    onClick={() => onSelectIdeaForPlan(idea)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Vybrat & Vytvořit Byznys plán</span>
                  </button>

                  <button
                    id={`btn-ask-idea-${idea.id}`}
                    onClick={() => onAskAiAboutIdea(idea)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-colors backdrop-blur-md"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Probrat v AI Chatu</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
