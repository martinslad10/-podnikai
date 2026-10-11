import React from 'react';
import { 
  ArrowRight, 
  Target, 
  Compass, 
  UserCheck, 
  DollarSign, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  Check 
} from 'lucide-react';

interface LandingHeroProps {
  onStart: () => void;
  onOpenAdmin?: () => void;
  onStartBusinessStart?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStart, onOpenAdmin, onStartBusinessStart }) => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8 bg-[#080C16] text-slate-100">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-blue-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Main Container */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold">
          <Compass className="w-4 h-4 text-blue-400" />
          <span>Praktický start podnikání pro český trh</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-4">
          <div className="font-heading font-black text-3xl sm:text-4xl tracking-tight text-white">
            PODNIK<span className="text-blue-500">AI</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Zjistěte, v čem začít podnikat <span className="text-blue-400">– a jak získat prvního zákazníka.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            Odpovězte na 12 otázek. Získáte konkrétní podnikatelský směr přizpůsobený vašim schopnostem, času, rozpočtu a cílům.
          </p>
        </div>

        {/* VÝRAZNÁ CENOVÁ NABÍDKA V HORNÍ ČÁSTI STRÁNKY */}
        <div className="max-w-xl mx-auto p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-blue-950/40 via-[#0D1528] to-[#0A0F1D] border border-blue-500/30 shadow-xl shadow-blue-950/30 text-left sm:text-center space-y-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                Kompletní individuální Business Report + PDF
              </span>
              <span className="text-xs text-slate-400">
                Včetně finančního modelu v Kč, profilu klienta a 30denního plánu
              </span>
            </div>
            
            {/* Cenový blok */}
            <div className="flex items-baseline gap-2.5 sm:self-center">
              <div className="flex flex-col text-right">
                <span className="text-[11px] text-slate-500 line-through font-semibold">
                  1 990 Kč
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Ušetříte 1 300 Kč
                </span>
              </div>
              <div className="flex items-baseline gap-1 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-xl">
                <span className="text-2xl sm:text-3xl font-black text-white font-heading">
                  690
                </span>
                <span className="text-sm font-bold text-blue-300">Kč</span>
              </div>
            </div>
          </div>

          {/* Důležitá garance a vysvětlení procesu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>12 otázek v dotazníku je zdarma</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-400 shrink-0" />
              <span><strong>Jednorázová platba</strong> – žádné předplatné</span>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5">
            💡 <em>Dotazník vyplníte 100% nezávazně. Teprve po jeho dokončení a kontrole odpovědí se svobodně rozhodnete, zda si chcete kompletní Business Report za 690 Kč pořídit.</em>
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            id="btn-landing-start"
            onClick={onStart}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/30 hover:scale-[1.01] active:scale-95 transition-all duration-200"
          >
            <span>Začít 12 otázek zdarma</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {onStartBusinessStart && (
            <button
              id="btn-landing-business-start"
              onClick={onStartBusinessStart}
              className="group relative inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-sm border border-slate-700 shadow-xl transition-all duration-200"
            >
              <span>Individuální Business Report</span>
              <span className="px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 font-extrabold text-xs border border-emerald-500/30">
                690 Kč
              </span>
            </button>
          )}
        </div>

        {/* Value Bullets */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 pt-2">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> 100% nezávazné vyplnění
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> Všech 12 otázek na jedné stránce
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> Bez platební karty na startu
          </span>
        </div>

        {/* Target Audience Cards (Strictly for aspiring beginners) */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm mb-1">Zaměstnanec</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zvažujete přechod na volnou nohu nebo bezpečný rozjezd podnikání vedle práce.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm mb-1">Rodič s rodinou</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hledáte flexibilní příjem s omezeným časovým fondem přizpůsobený dětem.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm mb-1">Odborník / řemeslník</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Máte praxi a šikovné ruce, ale potřebujete spočítat marže a získat klienty.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-100 text-sm mb-1">Začátečník s nápadem</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Chcete si ověřit životaschopnost záměru dříve, než utratíte peníze za chyby.
            </p>
          </div>
        </div>

        {onOpenAdmin && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800/40 border border-transparent hover:border-slate-800"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>PODNIKAI Business Start (Interní klientský portál)</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
