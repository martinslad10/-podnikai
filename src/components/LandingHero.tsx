import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Target, 
  TrendingUp, 
  Lightbulb, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Compass, 
  DollarSign, 
  Layers
} from 'lucide-react';

interface LandingHeroProps {
  onStart: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-blue-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[250px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Main Container */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-blue-400 text-xs font-semibold shadow-lg backdrop-blur-xl">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>Profesionální AI podnikatelský systém pro ČR</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-4">
          <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
            PODNIK<span className="text-blue-500">AI</span>
          </h1>
          <p className="font-heading text-2xl sm:text-3xl font-semibold text-slate-200 tracking-tight">
            „Tvůj AI parťák pro podnikání.“
          </p>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 font-normal leading-relaxed">
            „Od prvního nápadu až po růst fungujícího podnikání.“
          </p>
        </div>

        {/* CTA Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            id="btn-landing-start"
            onClick={onStart}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-base shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <span>Začít</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Target Audience Cards */}
        <div className="pt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm mb-1">Chceš začít podnikat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Konkrétní kroky bez omáčky – od živnosti po první zakázku v ČR.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm mb-1">Hledáš byznys nápad</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Návrhy na míru tvému rozpočtu, času a dovednostem s hodnocením rizik.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm mb-1">Už podnikáš a chceš růst</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zvýšení marží, cenotvorba, automatizace a škálování na další úroveň.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm mb-1">Řešíš konkrétní problém</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Přímý akční plán na marketing, prodej a získávání platících klientů.
            </p>
          </div>

        </div>

        {/* Value Pillars Banner */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>Žádné obecné motivační fráze</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>České reálie & konkrétní čísla</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>Okamžitý denní krok k realizaci</span>
          </div>
        </div>

      </div>
    </div>
  );
};
