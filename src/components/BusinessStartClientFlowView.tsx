import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  CreditCard, 
  FileText, 
  Download, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  RotateCw, 
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Award,
  Zap,
  HelpCircle,
  Eye
} from 'lucide-react';
import { 
  BusinessStartQuestionnaire, 
  BusinessStartClient, 
  BusinessStartOrder, 
  BusinessStartOrderStatus 
} from '../types';
import { createEmptyQuestionnaire } from '../utils/businessStartDefaults';
import { 
  saveBusinessStartDraft, 
  fetchBusinessStartOrder, 
  initiateBusinessStartCheckout, 
  retryBusinessStartAnalysis,
  markBusinessStartPdfReady
} from '../services/api';
import { BusinessStartReportTab } from './admin/BusinessStartReportTab';
import { 
  BUSINESS_START_PRICE_CZK, 
  BUSINESS_START_ORIGINAL_PRICE_CZK, 
  BUSINESS_START_DISCOUNT_PERCENT, 
  BUSINESS_START_SAVINGS_CZK 
} from '../utils/businessStartPricing';
import { 
  trackQuestionnaireStart, 
  trackQuestionnaireComplete, 
  trackCheckoutStart, 
  trackPurchase, 
  trackReportReady, 
  resetQuestionnaireStartState 
} from '../utils/analytics';

interface BusinessStartClientFlowViewProps {
  onBackToHome?: () => void;
  initialOrderId?: string;
  initialOrderToken?: string;
  onNavigateGuide?: (slug: string) => void;
}

export const BusinessStartClientFlowView: React.FC<BusinessStartClientFlowViewProps> = ({
  onBackToHome,
  initialOrderId,
  initialOrderToken,
  onNavigateGuide
}) => {
  // Navigation & Step State
  // 0: intro (free introduction), 1: intake (12 questions), 2: checkout_summary, 3: analyzing, 4: report_ready
  const [currentStep, setCurrentStep] = useState<'intro' | 'intake' | 'summary' | 'analyzing' | 'report'>('intro');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);

  // Form & Order State
  const [formData, setFormData] = useState<BusinessStartQuestionnaire>(createEmptyQuestionnaire());
  const [order, setOrder] = useState<BusinessStartOrder | null>(null);
  const [client, setClient] = useState<BusinessStartClient | null>(null);
  const [savedSessionNotice, setSavedSessionNotice] = useState<{ orderId: string; orderToken: string } | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);

  // Restore existing session ONLY if explicit in URL/props, or keep as an optional prompt
  useEffect(() => {
    let orderIdToLoad = initialOrderId;
    let tokenToLoad = initialOrderToken;

    // Check URL parameters (e.g. returning from Stripe checkout: #business-start?orderId=...&token=...)
    if ((!orderIdToLoad || !tokenToLoad) && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const queryStr = hash.includes('?') ? hash.split('?')[1] : (search ? search.substring(1) : '');
      const params = new URLSearchParams(queryStr);
      const urlOrderId = params.get('orderId');
      const urlToken = params.get('token');
      if (urlOrderId && urlToken) {
        orderIdToLoad = urlOrderId;
        tokenToLoad = urlToken;
      }
    }

    // If explicit URL params or props provided (e.g. after payment redirect), load that order
    if (orderIdToLoad && tokenToLoad) {
      loadOrder(orderIdToLoad, tokenToLoad);
      return;
    }

    // Otherwise check localStorage only for offering an optional restore, but NEVER auto-prefill new visitor
    const savedSession = localStorage.getItem('podnikai_client_bs_order');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.orderId && parsed.orderToken) {
          setSavedSessionNotice({ orderId: parsed.orderId, orderToken: parsed.orderToken });
        }
      } catch (e) {
        console.warn('Failed parsing saved session', e);
      }
    }
  }, [initialOrderId, initialOrderToken]);

  // Polling while in ANALYZING or PAYMENT_PENDING state
  useEffect(() => {
    if (!order || !order.id || !order.orderToken) return;

    if (order.status === 'ANALYZING' || order.status === 'PAYMENT_PENDING') {
      const interval = setInterval(() => {
        loadOrder(order.id, order.orderToken, false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [order?.status]);

  // Track questionnaire start when user begins intake (12 questions)
  useEffect(() => {
    if (currentStep === 'intake') {
      trackQuestionnaireStart();
    }
  }, [currentStep]);

  const loadOrder = async (orderId: string, orderToken: string, showLoader: boolean = true) => {
    if (showLoader) setIsLoading(true);
    setError('');
    try {
      const res = await fetchBusinessStartOrder(orderId, orderToken);
      if (res.success && res.order) {
        setOrder(res.order);
        if (res.questionnaire) {
          setFormData(res.questionnaire);
        }
        if (res.analysis) {
          setClient({
            id: res.order.clientId,
            createdAt: res.order.createdAt,
            updatedAt: res.order.updatedAt,
            status: 'done',
            questionnaire: res.questionnaire || formData,
            analysis: res.analysis,
            order: res.order
          });
        }

        // Server-confirmed purchase tracking (CRITICAL: Only if server confirmed PAID!)
        if (res.isPaid || res.order.paymentStatus === 'PAID') {
          trackPurchase(res.order.id, res.order.priceCz || BUSINESS_START_PRICE_CZK, 'CZK');
        }

        // Map order status to UI step
        if (res.order.status === 'REPORT_READY' || res.order.status === 'PDF_READY') {
          if (res.analysis) {
            trackReportReady(res.order.id);
          }
          setCurrentStep('report');
        } else if (res.order.status === 'ANALYZING') {
          setCurrentStep('analyzing');
        } else if (res.order.status === 'PAID') {
          setCurrentStep('analyzing');
        } else if (res.order.status === 'PAYMENT_PENDING' || res.order.status === 'PAYMENT_FAILED') {
          setCurrentStep('summary');
        } else if (res.order.status === 'READY_FOR_PAYMENT') {
          setCurrentStep('summary');
        }
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst stav objednávky');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof BusinessStartQuestionnaire, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartFresh = () => {
    resetQuestionnaireStartState();
    localStorage.removeItem('podnikai_client_bs_order');
    setSavedSessionNotice(null);
    setOrder(null);
    setClient(null);
    setFormData(createEmptyQuestionnaire());
    setError('');
    setSuccessNotice('Formulář byl nastaven jako čistý a prázdný.');
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  const handleRestoreSession = () => {
    if (savedSessionNotice) {
      loadOrder(savedSessionNotice.orderId, savedSessionNotice.orderToken);
    }
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await saveBusinessStartDraft(formData, order?.id, order?.orderToken);
      if (res.success && res.order) {
        setOrder(res.order);
        if (res.client) setClient(res.client);
        localStorage.setItem('podnikai_client_bs_order', JSON.stringify({
          orderId: res.order.id,
          orderToken: res.order.orderToken
        }));
        setSuccessNotice('Rozpracovaný dotazník byl bezpečně uložen.');
        setTimeout(() => setSuccessNotice(''), 3000);
      } else {
        setError(res.error || 'Uložení konceptu selhalo');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při ukládání');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteIntake = async () => {
    // Basic validation
    if (!formData.clientName?.trim()) {
      setError('Vyplňte prosím své jméno nebo název projektu.');
      return;
    }
    if (!formData.mainGoal?.trim()) {
      setError('Vyplňte prosím svůj hlavní podnikatelský cíl (otázka 3).');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await saveBusinessStartDraft(formData, order?.id, order?.orderToken);
      if (res.success && res.order) {
        setOrder(res.order);
        if (res.client) setClient(res.client);
        localStorage.setItem('podnikai_client_bs_order', JSON.stringify({
          orderId: res.order.id,
          orderToken: res.order.orderToken
        }));
        trackQuestionnaireComplete();
        setCurrentStep('summary');
      } else {
        setError(res.error || 'Příprava objednávky selhala');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při zpracování objednávky');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!order || !order.id || !order.orderToken) return;

    trackCheckoutStart();
    setIsLoading(true);
    setError('');
    try {
      const res = await initiateBusinessStartCheckout(order.id, order.orderToken);
      if (res.success && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      } else {
        setError(res.error || 'Platební brána Stripe se připravuje nebo nebyla nalezena platební adresa. Zkuste to prosím za okamžik.');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při inicializaci platby přes Stripe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!order || !order.id || !order.orderToken) return;

    setIsRetryingAnalysis(true);
    setError('');
    try {
      const res = await retryBusinessStartAnalysis(order.id, order.orderToken);
      if (res.success) {
        await loadOrder(order.id, order.orderToken, false);
      } else {
        setError(res.error || 'Opakování analýzy selhalo');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při opakování analýzy');
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 pb-20 selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <div className="border-b border-white/10 bg-[#090D1A]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentStep !== 'intro' && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'report') {
                    if (onBackToHome) onBackToHome();
                    else setCurrentStep('intro');
                  } else if (currentStep === 'summary') {
                    setCurrentStep('intake');
                  } else if (currentStep === 'intake') {
                    setCurrentStep('intro');
                  }
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Zpět"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-base tracking-tight text-white">
                  PODNIK<span className="text-blue-500">AI</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Business Start
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                12 otázek zdarma • Komplexní analýza a PDF: <strong className="text-emerald-400 font-bold">690 Kč</strong> <span className="line-through text-slate-500">1 990 Kč</span>
              </p>
            </div>
          </div>

          {/* Stepper indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCurrentStep('intro')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                currentStep === 'intro' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-white/5 hover:text-white'
              }`}
            >
              1. Úvod
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <button
              type="button"
              onClick={() => setCurrentStep('intake')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                currentStep === 'intake' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-white/5 hover:text-white'
              }`}
            >
              2. Dotazník (12 otázek)
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'summary' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-white/5'
            }`}>
              3. Platba (690 Kč)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'analyzing' ? 'bg-amber-600 text-white font-bold animate-pulse' : 'text-slate-400 bg-white/5'
            }`}>
              4. AI Analýza
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'report' ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20' : 'text-slate-400 bg-white/5'
            }`}>
              5. Hotový Report
            </span>
          </div>

          {order && (
            <div className="text-right text-[11px]">
              <span className="text-slate-500 block">Objednávka:</span>
              <span className="font-mono text-slate-300 font-semibold">{order.id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        {/* Alerts / Error Notices */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setError('')} 
              className="text-red-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {successNotice && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* STEP 0: FREE INTRODUCTION (PŘEDSTAVENÍ SLUŽBY ZDARMA) */}
        {currentStep === 'intro' && (
          <div className="space-y-10 py-4">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300">Oficiální služba PODNIKAI Business Start</span>
                <span className="text-slate-500 line-through text-[11px]">1 990 Kč</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/40">
                  🔥 Startovací sleva 65 %: 690 Kč
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black tracking-tight text-white leading-tight">
                Váš ucelený byznys plán a strategie pro <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">rozjezd podnikání v ČR</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Žádné obecné motivační fráze. Vyplňte 12 cílených otázek zdarma. Náš analytický systém striktně zmapuje vaše dovednosti, časovou kapacitu, rozpočet a červené linie a po bezpečné platbě vygeneruje ucelený akční plán, finanční rozvahu a profesionální PDF ke stažení.
              </p>

              {/* Pricing Display Box */}
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-[#090D1A] border border-emerald-500/30 shadow-xl text-center space-y-1.5">
                <div className="text-xs uppercase tracking-wider font-bold text-slate-300">Business Start</div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400">Původní cena:</span>
                  <span className="text-slate-500 line-through font-medium">1 990 Kč</span>
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold">
                    🔥 Startovací sleva 65 % (–1 300 Kč)
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-3xl sm:text-4xl font-heading font-black text-white">690 Kč</span>
                  <span className="text-xs text-slate-400 ml-2">jednorázově</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!order) {
                      setFormData(createEmptyQuestionnaire());
                    }
                    setCurrentStep('intake');
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <span>Vyplnit 12 otázek zdarma (cca 5 min)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {order && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order.status === 'REPORT_READY' || order.status === 'PDF_READY') {
                        setCurrentStep('report');
                      } else if (order.status === 'ANALYZING' || order.status === 'PAID') {
                        setCurrentStep('analyzing');
                      } else if (order.status === 'READY_FOR_PAYMENT') {
                        setCurrentStep('summary');
                      } else {
                        setCurrentStep('intake');
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Máte rozpracovanou objednávku ({order.id})</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                )}

                {!order && savedSessionNotice && (
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreSession}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Obnovit koncept ({savedSessionNotice.orderId})</span>
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 px-2 py-1"
                    >
                      Zahájit nový čistý formulář
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Vyplnění 12 otázek je 100% nezávazné. Platba 690 Kč probíhá až po dokončení a kontrole rekapitulace.
              </p>
            </div>

            {/* Key Value Pillars (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-[#090D1A] border border-white/10 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">1. Striktní respektování vašich mantinelů</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Systém pracuje jako nekompromisní Source of Truth audit. Zadaný kapitál, časové limity a červené linie (např. žádné víkendy, žádný studený telefonát) jsou pevnou podmínkou pro veškeré výpočty.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#090D1A] border border-white/10 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">2. Finanční matematika & bod zvratu</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Realistická jednotková ekonomika přizpůsobená českému trhu: kalkulace počátečních investic, měsíčních fixních nákladů, marží a doporučené prodejní cenotvorby v Kč.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#090D1A] border border-white/10 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">3. Kapacitní model na míru</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Žádné odhady od stolu. Spočítáme vám, kolik platících zakázek měsíčně a kolik odpracovaných hodin týdně přesně potřebujete k dosažení vašeho požadovaného čistého příjmu.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#090D1A] border border-white/10 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">4. Akční 30denní plán & PDF ke stažení</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Jasný návod k prvním zákazníkům, ověřovací hypotézy a profesionálně formátovaný PDF dokument, ke kterému se můžete kdykoliv vrátit i po zavření prohlížeče.
                </p>
              </div>
            </div>

            {/* How It Works (4 Process Steps) */}
            <div className="p-6 rounded-2xl bg-[#090D1A] border border-white/10 space-y-5">
              <h2 className="text-base font-bold text-white text-center">
                Jak probíhá vytvoření vašeho Business Startu
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">Krok 1</span>
                  <h4 className="text-xs font-bold text-white">12 otázek zdarma</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Zadáte své zkušenosti, kapitál, lokalitu, časové možnosti a cíl.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">Krok 2</span>
                  <h4 className="text-xs font-bold text-white">Kontrola a rekapitulace</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Zkontrolujete své odpovědi a potvrdíte spuštění objednávky (690 Kč).
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">Krok 3</span>
                  <h4 className="text-xs font-bold text-white">Platba přes Stripe</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Rychlá a zabezpečená platba kartou přes ověřenou platební bránu Stripe Checkout.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Krok 4</span>
                  <h4 className="text-xs font-bold text-white">Hotový report & PDF</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Okamžité automatické vygenerování byznys plánu a stažení PDF dokumentu.
                  </p>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep('intake')}
                  className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all inline-flex items-center gap-2"
                >
                  <span>Začít vyplňovat 12 otázek zdarma</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Trust Footer */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Zabezpečená platba Stripe
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" /> Okamžité zpracování po úhradě
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-400" /> Vaše limity a preference jsou součástí analýzy
              </span>
            </div>
          </div>
        )}

        {/* STEP 1: INTAKE QUESTIONNAIRE (12 QUESTIONS) */}
        {currentStep === 'intake' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('intro')}
                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Zpět na představení služby</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartFresh}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                  title="Vymaže případný koncept a nastaví formulář od začátku"
                >
                  Vyčistit formulář
                </button>
                <span className="text-[11px] text-slate-500">
                  12 cílených otázek • Zcela zdarma
                </span>
              </div>
            </div>

            <div className="text-center max-w-2xl mx-auto mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>12 klíčových otázek pro váš Business Blueprint</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white mb-2">
                Získejte svůj ucelený Business Start
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Vyplňte své reálné časové, finanční a oborové preference. Systém respektuje vaše mantinely 
                a po zaplacení automaticky vygeneruje auditovatelný byznys plán a PDF dokument.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D1A] border border-white/10 shadow-2xl space-y-6">
              {/* Question 1: Name and Location */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  1. Jméno a kontaktní údaje *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    name="client_name_field"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={formData.clientName}
                    onChange={e => handleFieldChange('clientName', e.target.value)}
                    placeholder="Vaše jméno a příjmení *"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="email"
                    name="client_email_field"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={formData.clientEmail}
                    onChange={e => handleFieldChange('clientEmail', e.target.value)}
                    placeholder="E-mail pro doručení reportu *"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <input
                    type="text"
                    name="client_phone_field"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={formData.clientPhone}
                    onChange={e => handleFieldChange('clientPhone', e.target.value)}
                    placeholder="Telefon (volitelné)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    name="client_location_field"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    value={formData.location}
                    onChange={e => handleFieldChange('location', e.target.value)}
                    placeholder="Lokalita (město, okres, např. Brno a okolí)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Question 2: Career History */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  2. Současná profesní situace a kariérní historie
                </label>
                <textarea
                  value={formData.currentCareerSituation}
                  onChange={e => handleFieldChange('currentCareerSituation', e.target.value)}
                  placeholder="Např. 8 let v administrativě, hledám přechod na volnou nohu / 5 let praxe jako truhlář / zaměstnanec zvažující první podnikání..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Question 3: Main Goal */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  3. Hlavní podnikatelský cíl (Source of Truth) *
                </label>
                <input
                  type="text"
                  value={formData.mainGoal}
                  onChange={e => handleFieldChange('mainGoal', e.target.value)}
                  placeholder="Např. Chci otevřít vlastní masérské studio / Chci nabízet svatební líčení / Chci dělat rekonstrukce koupelen..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Question 4 & 5: Income & Capital */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    4. Cílový měsíční příjem *
                  </label>
                  <input
                    type="text"
                    value={formData.targetMonthlyIncome}
                    onChange={e => handleFieldChange('targetMonthlyIncome', e.target.value)}
                    placeholder="Např. 40 000 – 60 000 Kč měsíčně"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    5. Reálný počáteční kapitál (Striktní limit) *
                  </label>
                  <input
                    type="text"
                    value={formData.startingCapital}
                    onChange={e => handleFieldChange('startingCapital', e.target.value)}
                    placeholder="Např. do 15 000 Kč / 50 000 Kč+ / 0 Kč"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Question 6 & 7: Time & Operating Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    6. Týdenní časová kapacita *
                  </label>
                  <input
                    type="text"
                    value={formData.weeklyTimeCommitment}
                    onChange={e => handleFieldChange('weeklyTimeCommitment', e.target.value)}
                    placeholder="Např. 20 hodin týdně / 30 hodin týdně"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    7. Požadovaný model provozu *
                  </label>
                  <select
                    value={formData.operatingModel}
                    onChange={e => handleFieldChange('operatingModel', e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="offline">Fyzická služba / osobní kontakt (offline)</option>
                    <option value="hybrid">Kombinovaný / hybridní model</option>
                    <option value="online">100% online / z domova</option>
                  </select>
                </div>
              </div>

              {/* Sub-item of Question 7: Preferred Work Type (Hard Constraint) */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-black/20 border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    7b. Preferovaný typ práce (Hard Constraint k modelu provozu)
                  </label>
                  <span className="text-[10px] text-teal-400 font-semibold">Striktně respektováno</span>
                </div>
                <input
                  type="text"
                  value={formData.customPreferredWorkType || formData.preferredWorkType}
                  onChange={e => handleFieldChange('customPreferredWorkType', e.target.value)}
                  placeholder="Např. Práce s lidmi osobně / Fyzická manuální práce / Vlastní studio / Práce na PC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Question 8 & 9: Skills & Passions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    8. Dovednosti a silné stránky (oddělené čárkou)
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={Array.isArray(formData.coreSkillsAndExpertise) ? formData.coreSkillsAndExpertise.join(', ') : (formData.coreSkillsAndExpertise ?? '')}
                    onChange={e => handleFieldChange('coreSkillsAndExpertise', e.target.value)}
                    placeholder="Např. Masáže, regenerace, komunikace s lidmi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-rose-300 block">
                    9. Zájmy, obory a témata, která vás baví (oddělené čárkou)
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={Array.isArray(formData.passionsAndInterests) ? formData.passionsAndInterests.join(', ') : (formData.passionsAndInterests ?? '')}
                    onChange={e => handleFieldChange('passionsAndInterests', e.target.value)}
                    placeholder="Např. Zdravý životní styl, gastro, káva, udržitelnost, technologie"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Question 10: Strict Dislikes / Red Lines */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-red-400 block">
                  10. Odmítnuté činnosti (RED LINES – Čemu se striktně vyhýbáte)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={Array.isArray(formData.strictDislikesAndRedLines) ? formData.strictDislikesAndRedLines.join(', ') : (formData.strictDislikesAndRedLines ?? '')}
                  onChange={e => handleFieldChange('strictDislikesAndRedLines', e.target.value)}
                  placeholder="Např. Celodenní sezení u PC, cold calling, multilevel"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Question 11 & 12 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    11. Dosavadní kontakty a stávající aktiva
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={formData.existingAssetsAndNetwork ?? ''}
                    onChange={e => handleFieldChange('existingAssetsAndNetwork', e.target.value)}
                    placeholder="Např. Kontakty v oboru, profil na LinkedIn, stávající PC/vybavení"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    12. Osobní limitace a specifické podmínky
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={formData.personalConstraints ?? ''}
                    onChange={e => handleFieldChange('personalConstraints', e.target.value)}
                    placeholder="Např. Pouze večery a pátky, bez možnosti investovat do drahého vybavení"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                >
                  Uložit rozpracovaný koncept
                </button>

                <button
                  type="button"
                  onClick={handleCompleteIntake}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  <span>Přejít k objednávce (690 Kč)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ORDER SUMMARY & PRODUCT OFFER (690 KČ) */}
        {currentStep === 'summary' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Potvrzení objednávky
              </span>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-white">
                PODNIKAI Business Start
              </h1>
              <p className="text-xs text-slate-400">
                Individuální podnikatelská analýza a kompletní Business Report
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D1A] border border-blue-500/30 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400">Původní cena:</span>
                    <span className="text-xs text-slate-500 line-through">1 990 Kč</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      🔥 Startovací sleva 65 % (–1 300 Kč)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-heading font-black text-white">690 Kč</span>
                    <span className="text-xs text-slate-400">jednorázově včetně kompletního PDF reportu</span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 self-start sm:self-center">
                  Okamžité automatické zpracování
                </span>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Co přesně v reportu získáte:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Analýza podnikatelského profilu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Doporučené podnikatelské směry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Hlavní Business Blueprint na míru</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Definice nabídky a cenotvorby</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Cílový zákazník a nákupní motivace</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Způsob získávání prvních zákazníků</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>14denní validační plán</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Finanční modelové scénáře & kapacita</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>30denní konkrétní akční plán</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Kompletní PDF dokument ke stažení</span>
                  </div>
                </div>
              </div>

              {/* Klient Summary */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Shrnutí vašeho zadání:</span>
                <div>Klient: <strong className="text-white">{formData.clientName}</strong> ({formData.clientEmail})</div>
                <div>Záměr: <strong className="text-white">{formData.mainGoal}</strong></div>
                <div>Kapitál: <strong className="text-white">{formData.startingCapital}</strong> | Čas: <strong className="text-white">{formData.weeklyTimeCommitment}</strong></div>
              </div>

              {/* Payment status banners */}
              {order?.status === 'PAYMENT_PENDING' && (
                <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span>Platba čeká na potvrzení z platební brány Stripe. Pokud jste již zaplatili, systém stránku automaticky aktualizuje.</span>
                </div>
              )}

              {order?.status === 'PAYMENT_FAILED' && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Předchozí pokus o platbu nebyl dokončen nebo byl zrušen. Objednávku můžete bez obav zaplatit nyní.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('intake')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  ← Upravit odpovědi
                </button>

                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isLoading ? 'Přesměrovávám na Stripe...' : 'Zaplatit 690 Kč (Stripe Checkout)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ANALYZING (REAL-TIME PROGRESS) */}
        {currentStep === 'analyzing' && (
          <div className="max-w-xl mx-auto space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2 animate-spin">
              <RotateCw className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                ✓ Platba proběhla úspěšně
              </span>
              <h1 className="text-2xl font-heading font-black text-white">
                Nyní připravujeme váš Business Report
              </h1>
              <p className="text-xs text-slate-400">
                Systém zpracovává vaše zadání v souladu se SOURCE OF TRUTH a hard filteringem.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D1A] border border-white/10 shadow-2xl text-left space-y-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Skutečný průběh zpracování:
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Přijali jsme vaše odpovědi</span>
                </div>
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ověřili jsme vstupní údaje (Source of Truth)</span>
                </div>
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Platba {order?.priceCz || 690} Kč úspěšně zaúčtována na serveru</span>
                </div>
                <div className="flex items-center gap-2.5 text-blue-300 font-medium">
                  <RotateCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Vyhodnocujeme podnikatelské směry & Business Blueprint...</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>Připravujeme finanční model & 30denní akční plán</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>Generujeme finální Business Report & PDF</span>
                </div>
              </div>

              {order?.status === 'ANALYSIS_FAILED' && (
                <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 space-y-2">
                  <p>
                    Platba byla přijata, ale dokončení analýzy se nepodařilo dokončit. Systém se pokusí analýzu automaticky dokončit.
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryAnalysis}
                    disabled={isRetryingAnalysis}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px]"
                  >
                    {isRetryingAnalysis ? 'Zkouším znovu...' : 'Opakovat generování analýzy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: FINAL REPORT READY & PDF DOWNLOAD */}
        {currentStep === 'report' && client && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#090D1A] to-blue-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-heading font-black text-lg text-white">
                    Váš Business Report je připraven
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Objednávka <span className="font-mono text-white">{order?.id}</span> • Platba <span className="text-emerald-400 font-semibold">{order?.priceCz || 690} Kč potvrzena</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  ✓ PAID & READY
                </span>
              </div>
            </div>

            {/* Embedded Full Report */}
            <div className="bg-[#090D1A] rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl">
              <BusinessStartReportTab client={client} />
            </div>
          </div>
        )}

        {/* Public Informational & SEO Guides Navigation Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Praktičtí průvodci pro začínající podnikatele v ČR
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
              <a
                href="/jak-zacit-podnikat"
                onClick={(e) => {
                  if (onNavigateGuide) {
                    e.preventDefault();
                    onNavigateGuide('jak-zacit-podnikat');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              >
                Jak začít podnikat
              </a>
              <a
                href="/v-cem-podnikat"
                onClick={(e) => {
                  if (onNavigateGuide) {
                    e.preventDefault();
                    onNavigateGuide('v-cem-podnikat');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              >
                V čem podnikat
              </a>
              <a
                href="/podnikani-pro-zacatecniky"
                onClick={(e) => {
                  if (e.defaultPrevented) return;
                  if (onNavigateGuide) {
                    e.preventDefault();
                    onNavigateGuide('podnikani-pro-zacatecniky');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              >
                Podnikání pro začátečníky
              </a>
              <a
                href="/podnikatelsky-plan"
                onClick={(e) => {
                  if (onNavigateGuide) {
                    e.preventDefault();
                    onNavigateGuide('podnikatelsky-plan');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              >
                Podnikatelský plán
              </a>
              <a
                href="/jak-ziskat-prvni-zakazniky"
                onClick={(e) => {
                  if (onNavigateGuide) {
                    e.preventDefault();
                    onNavigateGuide('jak-ziskat-prvni-zakazniky');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              >
                Jak získat první zákazníky
              </a>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 max-w-xl mx-auto leading-relaxed">
            PODNIKAI Business Start • 12 otázek zdarma • Komplexní analýza mantinelů & 30denní plán za 690 Kč (startovací sleva 65 % z 1 990 Kč). Informační podklady negarantují budoucí zisk.
          </p>
        </footer>
      </div>
    </div>
  );
};
