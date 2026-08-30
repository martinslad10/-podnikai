import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  MessageSquare, 
  Lightbulb, 
  FileText, 
  ArrowRight, 
  Target, 
  Briefcase, 
  Clock, 
  DollarSign, 
  ChevronRight, 
  RotateCw, 
  Award,
  Zap,
  TrendingUp,
  MapPin
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyStep, UserProfile } from '../types';

interface DashboardViewProps {
  userProfile: UserProfile;
  currentProject: string;
  dailyStep: DailyStep | null;
  completedSteps: DailyStep[];
  onCompleteDailyStep: (stepId: string) => void;
  onRefreshDailyStep: () => void;
  isGeneratingStep: boolean;
  onNavigateTab: (tab: 'chat' | 'ideas' | 'plan') => void;
  onEditProfile: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userProfile,
  currentProject,
  dailyStep,
  completedSteps,
  onCompleteDailyStep,
  onRefreshDailyStep,
  isGeneratingStep,
  onNavigateTab,
  onEditProfile
}) => {
  const [completedAnimation, setCompletedAnimation] = useState(false);

  const handleStepDone = () => {
    if (!dailyStep || dailyStep.completed) return;
    
    // Fire confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#6366f1', '#06b6d4', '#10b981']
      });
    } catch {
      // Fallback if canvas-confetti is not loaded
    }

    setCompletedAnimation(true);
    setTimeout(() => {
      onCompleteDailyStep(dailyStep.id);
      setCompletedAnimation(false);
    }, 600);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* 1. Header with User Name & Goal */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{userProfile.status === 'running' ? 'Aktivní byznys režim' : 'Fáze rozjezdu & validace'}</span>
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Vítej zpět, <span className="text-blue-400">{userProfile.name || 'Podnikateli'}</span>!
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/10">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Hlavní cíl:</span>
                <span className="font-semibold text-slate-200">{userProfile.goal}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/10">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Projekt:</span>
                <span className="font-semibold text-slate-200">{currentProject || 'Zatím nevybrán'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/10">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-200">{userProfile.location}</span>
              </div>
            </div>
          </div>

          <button
            id="btn-edit-profile-overview"
            onClick={onEditProfile}
            className="self-start md:self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-all backdrop-blur-md"
          >
            Upravit parametry
          </button>
        </div>
      </div>

      {/* 2. DNEŠNÍ KROK (The Daily Action Engine) */}
      <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-white">Dnešní krok</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Priorita #1
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Jediný nejdůležitější úkol, který dnes posune tvé podnikání k zákazníkům.
              </p>
            </div>
          </div>

          <button
            id="btn-refresh-step"
            onClick={onRefreshDailyStep}
            disabled={isGeneratingStep}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors self-start sm:self-auto"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isGeneratingStep ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isGeneratingStep ? 'Generuji nový krok...' : 'Nový návrh kroku'}</span>
          </button>
        </div>

        {dailyStep ? (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Odhadovaný čas: cca {dailyStep.estimatedMinutes || 30} minut</span>
                  <span className="text-slate-600">•</span>
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    {dailyStep.category}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-100">
                  {dailyStep.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {dailyStep.description}
                </p>

                {dailyStep.whyImportant && (
                  <div className="pt-2 border-t border-white/10 text-xs text-slate-400 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span><strong className="text-slate-300">Proč právě teď:</strong> {dailyStep.whyImportant}</span>
                  </div>
                )}
              </div>

              {/* Action Button: "Splněno" */}
              <div className="pt-2 md:pt-0 shrink-0">
                <button
                  id="btn-complete-daily-step"
                  onClick={handleStepDone}
                  className={`w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                    completedAnimation
                      ? 'bg-blue-600 text-white scale-105 shadow-xl shadow-blue-500/40'
                      : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 active:scale-95'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Splněno</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300">
            <p className="text-sm">Všechny dnešní kroky jsou splněny!</p>
            <button
              onClick={onRefreshDailyStep}
              className="mt-3 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20"
            >
              Vygenerovat další krok
            </button>
          </div>
        )}

        {/* Completed Milestones Preview */}
        {completedSteps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-400" />
              <span>Splněno celkem <strong className="text-blue-400">{completedSteps.length}</strong> akčních kroků</span>
            </div>
            <span className="text-slate-400">Skvělé tempo!</span>
          </div>
        )}
      </div>

      {/* 3. HLAVNÍ AKCE (3 Main Core Pillars) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-white">
            Hlavní nástroje PodnikAI
          </h2>
          <span className="text-xs text-slate-400">Vyber další akci</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Zeptat se PodnikAI */}
          <button
            id="btn-dash-ask-ai"
            onClick={() => onNavigateTab('chat')}
            className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-left transition-all duration-200 flex flex-col justify-between space-y-6 shadow-lg backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                Zeptat se PodnikAI
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Přímý AI byznys konzultant. Vyřeš konkrétní problém, otestuj nabídku, připrav prodejní zprávu nebo zeptej se na strategii.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
              <span>Otevřít AI chat</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Card 2: Najít podnikatelský nápad */}
          <button
            id="btn-dash-find-idea"
            onClick={() => onNavigateTab('ideas')}
            className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-left transition-all duration-200 flex flex-col justify-between space-y-6 shadow-lg backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Lightbulb className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                Najít podnikatelský nápad
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personalizovaný generátor nápadů s kalkulací nákladů, náročnosti, potenciálu příjmu a rychlosti spuštění v ČR.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
              <span>Vygenerovat nápady</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Card 3: Vytvořit podnikatelský plán */}
          <button
            id="btn-dash-create-plan"
            onClick={() => onNavigateTab('plan')}
            className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-left transition-all duration-200 flex flex-col justify-between space-y-6 shadow-lg backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                Vytvořit podnikatelský plán
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kompletní 9-krokový byznys plán: od prvního kroku, přes cenotvorbu, marketing, získávání klientů až po plán na 1. měsíc.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
              <span>Sestavit plán</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* 4. ENTREPRENEUR METRICS SUMMARY */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>Tvé nastavené parametry pro AI asistenta</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
            <span className="text-slate-500 block mb-1">Cílový měsíční příjem:</span>
            <span className="font-bold text-slate-200 text-sm">{userProfile.targetIncome}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
            <span className="text-slate-500 block mb-1">Počáteční rozpočet:</span>
            <span className="font-bold text-slate-200 text-sm">{userProfile.startingBudget}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
            <span className="text-slate-500 block mb-1">Časová kapacita:</span>
            <span className="font-bold text-slate-200 text-sm">{userProfile.availableTime}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
            <span className="text-slate-500 block mb-1">Model:</span>
            <span className="font-bold text-slate-200 text-sm capitalize">{userProfile.onlineOffline}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
