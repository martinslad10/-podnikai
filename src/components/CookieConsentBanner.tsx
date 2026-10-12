import React, { useState, useEffect } from 'react';
import { 
  getCookieConsent, 
  setCookieConsent, 
  CookieConsentState 
} from '../utils/analytics';
import { ShieldCheck, Cookie, ChevronRight, Check, X } from 'lucide-react';

interface CookieConsentBannerProps {
  onConsentChange?: (consent: CookieConsentState) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onConsentChange }) => {
  const [consentState, setConsentStateState] = useState<CookieConsentState | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    // Check initial consent from localStorage
    const saved = getCookieConsent();
    setConsentStateState(saved);

    const handleConsentEvent = (e: CustomEvent<CookieConsentState>) => {
      setConsentStateState(e.detail);
    };

    window.addEventListener('podnikai-consent-change' as any, handleConsentEvent as any);
    return () => {
      window.removeEventListener('podnikai-consent-change' as any, handleConsentEvent as any);
    };
  }, []);

  const handleAcceptAll = () => {
    setCookieConsent('all');
    setConsentStateState('all');
    if (onConsentChange) onConsentChange('all');
  };

  const handleAcceptNecessary = () => {
    setCookieConsent('necessary');
    setConsentStateState('necessary');
    if (onConsentChange) onConsentChange('necessary');
  };

  // If user already made a choice and details modal is not triggered, don't show the floating banner
  if (consentState !== null && !isDetailsOpen) {
    return null;
  }

  return (
    <aside 
      aria-label="Nastavení souhlasu s cookies"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 md:p-6 pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="max-w-4xl mx-auto bg-[#0A0F1D]/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl shadow-black/80 pointer-events-auto text-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Cookie className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-heading font-bold text-white tracking-tight">
                Ochrana soukromí a nastavení cookies
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
              Pro správné fungování aplikace používáme nezbytné technické cookies. S vaším souhlasem využíváme také anonymní analytiku návštěvnosti a měření marketingových kampaní (Meta Pixel a Google), abychom mohli PODNIKAI dále rozvíjet. Před udělením souhlasu jsou marketingové cookies přísně zablokovány.
            </p>

            {isDetailsOpen && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-2 text-slate-400">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200">Nezbytné cookies:</strong> Bezpečný běh aplikace, uložení rozpracovaného dotazníku a platební proces přes Stripe. (Aktivní vždy)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200">Analytické a marketingové měření:</strong> Měření zobrazení stránek a úspěšně ověřených nákupů (Meta Pixel ID: 1598776808008151 a GA4). Nikdy nepřenáší osobní údaje, e-maily ani bezpečnostní tokeny.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAcceptNecessary}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs sm:text-sm transition-all text-center focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Pouze nezbytné
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Přijmout vše
            </button>
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="text-[11px] text-slate-400 hover:text-slate-300 underline underline-offset-2 py-1 px-1 sm:hidden text-center"
            >
              {isDetailsOpen ? 'Skrýt podrobnosti' : 'Více informací'}
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500">
          <span>Svůj souhlas můžete kdykoliv změnit nebo odvolat odkazem v zápatí stránky.</span>
          <button
            type="button"
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="hover:text-slate-400 underline underline-offset-2 transition-colors"
          >
            {isDetailsOpen ? 'Skrýt podrobnosti' : 'Podrobnosti o cookies'}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
