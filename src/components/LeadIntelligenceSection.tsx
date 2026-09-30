import React, { useState } from 'react';
import { 
  Sparkles, 
  Target, 
  Lightbulb, 
  HelpCircle, 
  MessageSquare, 
  UserCheck, 
  Zap, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  RefreshCw, 
  ArrowRight,
  Globe,
  Building2,
  FileText
} from 'lucide-react';
import { PotentialCustomerLead, LeadIntelligence, UserProfile } from '../types';
import { analyzeLeadIntelligence } from '../services/api';
import { isValidPersonName, isValidExecutiveRole } from '../utils/personValidation';

interface LeadIntelligenceSectionProps {
  lead: PotentialCustomerLead;
  userProfile?: UserProfile | null;
  concreteOffer?: string;
  businessDirectionTitle?: string;
  onUpdateLead: (updatedLead: PotentialCustomerLead) => void;
  onOpenOutreachStudio?: (lead: PotentialCustomerLead, intelligence?: LeadIntelligence) => void;
}

export const LeadIntelligenceSection: React.FC<LeadIntelligenceSectionProps> = ({
  lead,
  userProfile,
  concreteOffer,
  businessDirectionTitle,
  onUpdateLead,
  onOpenOutreachStudio
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const intelligence: LeadIntelligence | undefined = lead.leadIntelligence;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await analyzeLeadIntelligence(lead, userProfile, {
        concreteOffer,
        businessDirectionTitle
      });

      if (res && res.leadIntelligence) {
        const updatedLead: PotentialCustomerLead = {
          ...lead,
          leadIntelligence: res.leadIntelligence
        };
        onUpdateLead(updatedLead);
      } else {
        throw new Error('Nepodařilo se vygenerovat analýzu.');
      }
    } catch (err: any) {
      console.warn('Lead Intelligence error:', err);
      setErrorMessage(err.message || 'Chyba při analýze firmy. Zkuste to prosím znovu.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasWebsite = lead.website && lead.website !== 'Nedostupné' && lead.website.trim() !== '';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-purple-950/30 border border-indigo-500/30 text-xs space-y-4 shadow-xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </span>
            <h4 className="font-heading font-bold text-white text-sm sm:text-base">
              Lead Intelligence – proč a jak firmu oslovit
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
              Enrichment
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Hloubková analýza z veřejného webu a povolených zdrojů pro přesvědčivé, personalizované oslovení bez domýšlení.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {intelligence ? (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
              title="Aktualizovat analýzu firmy z dostupných zdrojů"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzuji...' : 'Aktualizovat analýzu'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Čtu web a analyzuji...' : '⚡ Spustit Lead Intelligence analýzu'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-6 rounded-xl bg-slate-950/60 border border-indigo-500/20 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
            <span className="text-sm font-semibold text-indigo-200">
              {hasWebsite ? `Analyzuji veřejný web firmy (${lead.website})...` : 'Vyhodnocuji oborová data a indicie pro oslovení...'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            Zjišťuji konkrétní příležitost, návrh služby, přirozený icebreaker a veřejné signály. Žádné smyšlené kontakty.
          </p>
        </div>
      )}

      {/* Not analyzed yet banner */}
      {!intelligence && !isLoading && (
        <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-200 block text-xs">
                Chcete vědět přesně, co firmě {lead.companyName} nabídnout a jak přirozeně otevřít konverzaci?
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Lead Intelligence projde {hasWebsite ? `veřejný web firmy (${lead.website})` : 'veřejné charakteristiky oboru'} a připraví konkrétní argumenty, přirozený icebreaker a signály k oslovení, které se pak automaticky zapojí do Outreach Studia.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-white/5">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Povolené zdroje: veřejný web firmy a veřejné oborové indicie (bez hromadného scrapingu).
            </span>
            <button
              type="button"
              onClick={handleAnalyze}
              className="text-indigo-400 hover:text-indigo-300 font-bold underline"
            >
              Spustit nyní →
            </button>
          </div>
        </div>
      )}

      {/* Active Intelligence Presentation */}
      {intelligence && !isLoading && (() => {
        // Safe extraction with backward compatibility
        const facts: import('../types').LeadIntelligenceVerifiedFacts = intelligence.verifiedFacts || {
          companyName: lead.companyName,
          industry: lead.industry || 'služby a podnikání',
          address: [lead.address, lead.city].filter(Boolean).join(', ') || (lead.city ? `Lokalita ${lead.city}` : 'ČR'),
          website: (lead.website && lead.website !== 'Nedostupné') ? lead.website : 'Nedostupný',
          phone: (lead.phone && lead.phone !== 'Nedostupné') ? lead.phone : 'Neuveden',
          ratingAndReviews: (lead.googleRating && lead.googleRating !== 'Nedostupné')
            ? `${lead.googleRating} – veřejný záznam profilu (pouze popisný údaj; nevyjadřuje nákupní záměr ani poptávku)`
            : undefined,
          webFindings: [],
          sourceSummary: intelligence.sourceWebsite ? `Veřejný web firmy (${intelligence.sourceWebsite})` : 'Veřejný profil a kontakty'
        };

        const hypotheses = intelligence.hypotheses || {
          opportunity: intelligence.opportunity,
          opportunitySourceSignal: intelligence.opportunitySource || 'Zjištěno z veřejné prezentace',
          offer: intelligence.offer,
          offerSourceSignal: intelligence.offerSource || 'Návrh řešení pro daný obor',
          whyThisCompany: intelligence.whyThisCompany,
          whyThisCompanySourceSignal: intelligence.whyThisCompanySource || 'Veřejný oborový profil'
        };

        const approach = intelligence.recommendedApproach || {
          icebreaker: intelligence.icebreaker,
          icebreakerSource: intelligence.icebreakerSource || 'Veřejný profil',
          idealContactPerson: intelligence.idealContactPerson,
          nextStepRecommendation: 'Při prvním kontaktu představit námět k diskusi, ověřit reálné nastavení firmy a respektovat čas majitele.'
        };

        const signalsList = Array.isArray(intelligence.signals) ? intelligence.signals : [];

        return (
          <div className="space-y-4">
            
            {/* Metadata banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-[11px]">
              <div className="flex items-center gap-2 text-slate-300">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zdroj hloubkové analýzy:</span>
                {intelligence.sourceWebsite ? (
                  <a
                    href={intelligence.sourceWebsite.startsWith('http') ? intelligence.sourceWebsite : `https://${intelligence.sourceWebsite}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>{intelligence.sourceWebsite}</span>
                    <ExternalLink className="w-3 h-3 text-indigo-400" />
                  </a>
                ) : (
                  <span className="text-slate-300 font-medium">Veřejný profil oboru a lokality (web neuveden)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  OVĚŘENÝ FAKT
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  AI HYPOTÉZA – OVĚŘIT
                </span>
              </div>
            </div>

            {/* ======================================================== */}
            {/* 1. SEKCE: OVĚŘENÁ FAKTA (Pouze skutečně dostupná fakta) */}
            {/* ======================================================== */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </span>
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    1. Ověřená fakta
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    OVĚŘENÝ FAKT
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-white/10">
                  ZDROJ: {facts.sourceSummary}
                </span>
              </div>

              {/* Grid of verified parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Název a obor</span>
                  <div className="text-slate-200 text-xs font-medium">
                    {facts.companyName} <span className="text-slate-400 font-normal">({facts.industry})</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sídlo / Adresa</span>
                  <div className="text-slate-200 text-xs font-medium">
                    {facts.address}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Veřejný telefon</span>
                  <div className="text-slate-200 text-xs font-medium">
                    {facts.phone}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Webová prezentace</span>
                  <div className="text-slate-200 text-xs font-medium truncate">
                    {facts.website !== 'Nedostupný' ? (
                      <a
                        href={facts.website.startsWith('http') ? facts.website : `https://${facts.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                      >
                        {facts.website}
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                      </a>
                    ) : (
                      <span className="text-slate-400">Nedostupný</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Public rating - strictly descriptive */}
              {facts.ratingAndReviews && (
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Veřejné hodnocení a počet recenzí
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      ZDROJ: Veřejný profil
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    ⭐ <strong>{facts.ratingAndReviews}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    Poznámka souladu: Tento údaj slouží výhradně jako popisný fakt z veřejného profilu. Nevyvozujeme z něj výši poptávky, velikost klientské základny ani nákupní záměr firmy.
                  </p>
                </div>
              )}

              {/* Web findings */}
              {facts.webFindings && facts.webFindings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Konkrétní informace nalezené na veřejném webu firmy
                  </span>
                  <ul className="space-y-1">
                    {facts.webFindings.map((finding, idx) => (
                      <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* 2. SEKCE: AI OBCHODNÍ HYPOTÉZY (Vždy označeno k ověření) */}
            {/* ======================================================== */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-amber-500/20 text-amber-300">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                  </span>
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    2. AI obchodní hypotézy
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    AI HYPOTÉZA – OVĚŘIT PŘI KONTAKTU
                  </span>
                </div>
                <span className="text-[10px] text-amber-200/90 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                  Doporučujeme ověřit při prvním kontaktu
                </span>
              </div>

              {/* Příležitost k řešení */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      Příležitost (obchodní hypotéza)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      AI HYPOTÉZA – OVĚŘIT
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10" title={hypotheses.opportunitySourceSignal}>
                    ZDROJ: {hypotheses.opportunitySourceSignal}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {hypotheses.opportunity}
                </p>
              </div>

              {/* Co nabídnout */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      Co nabídnout (návrh řešení)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      AI HYPOTÉZA – OVĚŘIT
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10" title={hypotheses.offerSourceSignal}>
                    ZDROJ SIGNÁLU: {hypotheses.offerSourceSignal}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed font-medium">
                  {hypotheses.offer}
                </p>
              </div>

              {/* Proč právě tato firma */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5 text-sky-400" />
                      Proč právě tato firma (odvozeno z veřejných informací)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      AI HYPOTÉZA – OVĚŘIT
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10" title={hypotheses.whyThisCompanySourceSignal}>
                    ZDROJ SIGNÁLU: {hypotheses.whyThisCompanySourceSignal}
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {hypotheses.whyThisCompany}
                </p>
              </div>

              {/* Signály k oslovení */}
              {signalsList.length > 0 && (
                <div className="pt-2 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Signály k oslovení (konkrétní pozorování a jejich relevance)
                  </span>

                  <div className="space-y-2">
                    {signalsList.map((sig: any, idx: number) => {
                      const observationText = sig.observation || sig.signal;
                      const isHypo = sig.type === 'ai_hypothesis';
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${isHypo ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isHypo ? 'text-amber-300' : 'text-emerald-300'}`}>
                                {isHypo ? 'AI HYPOTÉZA – OVĚŘIT' : 'OVĚŘENÝ FAKT'}
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                              ZDROJ: {sig.source}
                            </span>
                          </div>

                          <p className="text-slate-200 text-[11px] leading-relaxed">
                            {observationText}
                          </p>

                          {sig.relevanceReason && (
                            <p className="text-[10px] text-amber-200/90 pl-3 border-l-2 border-amber-500/30">
                              Obchodní relevance: {sig.relevanceReason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* 3. SEKCE: DOPORUČENÝ POSTUP (Icebreaker, ideální osoba, postup) */}
            {/* ======================================================== */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-3.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-300">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                  </span>
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    3. Doporučený postup
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 uppercase tracking-wider">
                    DOPORUČENÝ POSTUP
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Připraveno pro první kontakt
                </span>
              </div>

              {/* Icebreaker */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      Icebreaker pro první kontakt
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                      1–2 VĚTY
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10" title={approach.icebreakerSource}>
                      ZDROJ: {approach.icebreakerSource}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(approach.icebreaker, 'icebreaker')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-semibold transition-all flex items-center gap-1 border border-white/10"
                    >
                      {copiedKey === 'icebreaker' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Zkopírováno</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Kopírovat</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-indigo-950/40 border border-indigo-500/25 text-indigo-100 font-serif italic text-xs leading-relaxed">
                  „{approach.icebreaker}“
                </div>
              </div>

              {/* Ideální osoba ke kontaktování (Striktní pravidlo: Nic nevymýšlet) */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Ideální osoba ke kontaktování
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10" title={approach.idealContactPerson?.source}>
                    ZDROJ: {approach.idealContactPerson?.source || 'Organizační struktura'}
                  </span>
                </div>

                {(() => {
                  const rawName = approach.idealContactPerson?.name;
                  const rawRole = approach.idealContactPerson?.role;
                  const isVerified = Boolean(rawName && isValidPersonName(rawName, lead.companyName, lead.website) && isValidExecutiveRole(rawRole));
                  const displayRole = isVerified 
                    ? (rawRole || 'Majitel / jednatel')
                    : 'Majitel / jednatel';
                  const displayNote = isVerified
                    ? (approach.idealContactPerson?.sourceNote || 'Ověřeno z veřejné prezentace firmy.')
                    : 'Konkrétní osoba nebyla ve veřejných zdrojích ověřena.';

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-white text-xs font-semibold">
                            Doporučený kontakt: {displayRole}
                          </strong>
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Ověřené jméno: {rawName}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-white/10">
                              Konkrétní osoba nebyla ve veřejných zdrojích ověřena.
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {displayNote}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Zákaz domýšlení jmen</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Doporučení pro další krok */}
              {approach.nextStepRecommendation && (
                <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-slate-300 space-y-1">
                  <strong className="text-indigo-200 block font-semibold text-[11px]">
                    Doporučený postup při hovoru:
                  </strong>
                  <p className="leading-relaxed">
                    {approach.nextStepRecommendation}
                  </p>
                </div>
              )}

              {/* Action CTA: Zapojit do Outreach Studia */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Lead Intelligence je připravena k automatickému zapojení do sekvence v Outreach Studiu.</span>
                </div>

                {onOpenOutreachStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const latestIntel = intelligence || lead.leadIntelligence;
                      const leadToPass: PotentialCustomerLead = {
                        ...lead,
                        leadIntelligence: latestIntel
                      };
                      onOpenOutreachStudio(leadToPass, latestIntel);
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
                  >
                    <span>Otevřít Outreach Studio se zapojenou inteligencí</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>

          </div>
        );
      })()}

      {/* Compliance footer disclaimer */}
      <div className="pt-1 text-[10px] text-slate-400 leading-relaxed border-t border-white/5 flex items-center justify-between flex-wrap gap-1">
        <span>
          🛡️ <strong>Pravidla souladu:</strong> Google Places data jsou použita výhradně pro základní ověření firmy v souladu s podmínkami API. Hlubší analýza vychází ze samotného veřejného webu a povolených zdrojů bez hromadných marketingových seznamů.
        </span>
        {intelligence?.analyzedAt && (
          <span className="text-slate-400">
            Analyzováno: {new Date(intelligence.analyzedAt).toLocaleDateString('cs-CZ')} v {new Date(intelligence.analyzedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

    </div>
  );
};
