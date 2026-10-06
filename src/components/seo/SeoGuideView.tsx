import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ChevronRight, 
  Sparkles, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle, 
  ShieldCheck, 
  ChevronDown, 
  Compass, 
  Home
} from 'lucide-react';
import { SEO_GUIDES, SeoGuide } from '../../data/seoGuidesData';

interface SeoGuideViewProps {
  guideSlug: string;
  onNavigateHome: () => void;
  onNavigateGuide: (slug: string) => void;
  onStartBusinessStart: () => void;
}

export const SeoGuideView: React.FC<SeoGuideViewProps> = ({
  guideSlug,
  onNavigateHome,
  onNavigateGuide,
  onStartBusinessStart
}) => {
  const guide = SEO_GUIDES[guideSlug] || SEO_GUIDES['jak-zacit-podnikat'];
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const otherGuides = Object.values(SEO_GUIDES).filter(g => g.slug !== guide.slug);

  useEffect(() => {
    const originalTitle = document.title;
    const descMeta = document.querySelector('meta[name="description"]');
    const originalDesc = descMeta?.getAttribute('content') || '';
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const originalCanonical = canonicalLink?.getAttribute('href') || 'https://podnikai.onrender.com/';
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const originalOgTitle = ogTitle?.getAttribute('content') || '';
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const originalOgDesc = ogDesc?.getAttribute('content') || '';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const originalOgUrl = ogUrl?.getAttribute('content') || '';

    // Update document title and meta tags
    document.title = guide.metaTitle;
    if (descMeta) descMeta.setAttribute('content', guide.metaDescription);
    if (canonicalLink) canonicalLink.setAttribute('href', `https://podnikai.onrender.com/${guide.slug}`);
    if (ogTitle) ogTitle.setAttribute('content', guide.metaTitle);
    if (ogDesc) ogDesc.setAttribute('content', guide.metaDescription);
    if (ogUrl) ogUrl.setAttribute('content', `https://podnikai.onrender.com/${guide.slug}`);

    // Create or update Guide JSON-LD Schema
    const scriptId = 'guide-schema-ld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }

    const schemaData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          'headline': guide.title,
          'description': guide.metaDescription,
          'inLanguage': 'cs-CZ',
          'url': `https://podnikai.onrender.com/${guide.slug}`,
          'publisher': {
            '@type': 'Organization',
            'name': 'PODNIKAI',
            'url': 'https://podnikai.onrender.com'
          }
        },
        ...(guide.faq && guide.faq.length > 0 ? [{
          '@type': 'FAQPage',
          'mainEntity': guide.faq.map(item => ({
            '@type': 'Question',
            'name': item.q,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': item.a
            }
          }))
        }] : [])
      ]
    };
    scriptEl.textContent = JSON.stringify(schemaData);

    return () => {
      document.title = originalTitle;
      if (descMeta) descMeta.setAttribute('content', originalDesc);
      if (canonicalLink) canonicalLink.setAttribute('href', originalCanonical);
      if (ogTitle) ogTitle.setAttribute('content', originalOgTitle);
      if (ogDesc) ogDesc.setAttribute('content', originalOgDesc);
      if (ogUrl) ogUrl.setAttribute('content', originalOgUrl);
      const existingScript = document.getElementById(scriptId);
      if (existingScript) existingScript.remove();
    };
  }, [guide]);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 selection:bg-blue-500/25 selection:text-blue-200">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="border-b border-white/10 bg-[#090D1A]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 overflow-x-auto">
            <button
              type="button"
              onClick={onNavigateHome}
              className="hover:text-white flex items-center gap-1 shrink-0 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>PODNIKAI</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-slate-300 shrink-0">Průvodce</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-blue-400 truncate max-w-[200px] sm:max-w-none">{guide.title}</span>
          </div>

          <button
            type="button"
            onClick={onStartBusinessStart}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vyzkoušet Business Start</span>
            <span className="sm:hidden">Start (690 Kč)</span>
          </button>
        </div>
      </nav>

      {/* Main Article Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10">
        {/* Article Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {guide.badge}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{guide.readTime}</span>
            </span>
            <span className="text-xs text-slate-500">• Aktualizováno pro rok 2026</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black tracking-tight text-white leading-tight">
            {guide.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-light border-l-2 border-blue-500 pl-4 py-1 bg-blue-500/5 rounded-r-xl">
            {guide.perex}
          </p>
        </header>

        {/* Embedded Top CTA Box */}
        <section aria-label="Doporučená služba" className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#090D1A] to-emerald-950/40 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Oficiální nástroj PODNIKAI</span>
            </div>
            <h2 className="font-heading font-extrabold text-base sm:text-lg text-white">
              Víte, jaké jsou vaše mantinely a reálný tržní potenciál?
            </h2>
            <p className="text-xs text-slate-300">
              Vyplňte 12 cílených otázek zdarma. Získejte individuální akční plán a finanční rozvahu za <strong>690 Kč</strong> <span className="line-through text-slate-500 ml-1 text-[11px]">1 990 Kč</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartBusinessStart}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20 shrink-0 flex items-center justify-center gap-2"
          >
            <span>Vyplnit 12 otázek zdarma</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>

        {/* Article Body Sections */}
        <article className="space-y-8 text-slate-200 leading-relaxed">
          {guide.sections.map((section, idx) => (
            <section key={idx} className="space-y-4 pt-4 border-t border-white/5 first:border-0 first:pt-0">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
                <span>{section.heading}</span>
              </h2>

              <div className="space-y-3 text-sm sm:text-base text-slate-300 font-light">
                {section.content.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}
              </div>

              {section.tips && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-200 space-y-1">
                  {section.tips.map((tip, tIdx) => (
                    <div key={tIdx} className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </article>

        {/* FAQ Section */}
        {guide.faq && guide.faq.length > 0 && (
          <section aria-labelledby="faq-heading" className="space-y-4 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h2 id="faq-heading" className="text-xl sm:text-2xl font-heading font-bold text-white">
                Často kladené otázky k tématu
              </h2>
            </div>

            <div className="space-y-2.5">
              {guide.faq.map((item, fIdx) => {
                const isOpen = openFaqIndex === fIdx;
                return (
                  <div
                    key={fIdx}
                    className="rounded-xl bg-[#090D1A] border border-white/10 overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(fIdx)}
                      className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-white hover:text-blue-300 transition-colors"
                    >
                      <span>{item.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-xs sm:text-sm text-slate-300 font-light border-t border-white/5 pt-3">
                        <p>{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Large Bottom Conversion Box */}
        <section aria-label="Zahájit analýzu" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#090D1A] to-blue-950/40 border border-blue-500/30 text-center space-y-5 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PODNIKAI Business Start (690 Kč)</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-black text-white max-w-xl mx-auto">
            Nezůstávejte u teorie. Nechte si vypracovat ucelený byznys plán na míru.
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Vyplňte 12 cílených otázek zdarma. Náš analytický systém prověří vaše mantinely (čas, rozpočet, červené linie) a připraví konkrétní doporučení a profesionální PDF ke stažení za zvýhodněných 690 Kč (startovací sleva 65 % z 1 990 Kč).
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onStartBusinessStart}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Vyplnit 12 otázek zdarma</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Related Guides Grid */}
        <section aria-labelledby="other-guides-heading" className="space-y-4 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 id="other-guides-heading" className="text-lg font-heading font-bold text-white">
              Další praktičtí průvodci podnikáním
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherGuides.map(other => (
              <button
                key={other.slug}
                type="button"
                onClick={() => onNavigateGuide(other.slug)}
                className="p-4 rounded-xl bg-[#090D1A] border border-white/10 hover:border-blue-500/40 text-left space-y-2 transition-all hover:bg-white/5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    {other.badge}
                  </span>
                  <span className="text-[10px] text-slate-500">{other.readTime}</span>
                </div>
                <h3 className="font-heading font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                  {other.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 font-light">
                  {other.perex}
                </p>
                <div className="text-xs text-blue-400 font-semibold flex items-center gap-1 pt-1 group-hover:translate-x-1 transition-transform">
                  <span>Číst průvodce</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#090D1A] py-10 mt-16 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Compass className="w-4 h-4 text-blue-400" />
            <span className="font-heading font-black text-sm text-white">PODNIKAI</span>
            <span>– AI parťák pro rozjezd a růst podnikání v ČR</span>
          </div>
          <p className="max-w-xl mx-auto text-[11px] leading-relaxed text-slate-400">
            Veškeré materiály a kalkulace mají informační a strategický charakter. Nejsou daňovým, právním ani investičním poradenstvím a negarantují budoucí zisk.
          </p>
          <div className="pt-2 text-[11px] text-slate-600">
            © 2026 PODNIKAI. Všechna práva vyhrazena.
          </div>
        </div>
      </footer>
    </div>
  );
};
