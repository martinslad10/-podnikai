import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Layers,
  Award,
  Zap,
  HelpCircle,
  Eye,
  Check,
  Target,
  DollarSign,
  TrendingUp,
  Calendar,
  Compass,
  Lightbulb,
  UserCheck,
  XCircle,
  CheckCheck
} from 'lucide-react';
import { 
  BusinessStartQuestionnaire, 
  BusinessStartClient, 
  BusinessStartOrder 
} from '../types';
import { createEmptyQuestionnaire } from '../utils/businessStartDefaults';
import { 
  saveBusinessStartDraft, 
  fetchBusinessStartOrder, 
  initiateBusinessStartCheckout, 
  simulateBusinessStartPayment,
  retryBusinessStartAnalysis 
} from '../services/api';
import { BusinessStartReportTab } from './admin/BusinessStartReportTab';
import { 
  BUSINESS_START_PRICE_CZK 
} from '../utils/businessStartPricing';
import { 
  trackQuestionnaireStart, 
  trackQuestionnaireComplete, 
  trackOfferView,
  trackCheckoutStart, 
  trackPurchase, 
  trackReportReady, 
  resetQuestionnaireStartState,
  resetCookieConsent 
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
  // 'intro': prodejní landing page
  // 'intake': všech 12 otázek na jedné stránce pod sebou
  // 'summary': rekapitulace zadaných odpovědí a prodej Business Reportu za 690 Kč
  // 'analyzing': zpracování reportu po potvrzené platbě
  // 'report': hotový interaktivní report + stažení PDF
  const [currentStep, setCurrentStep] = useState<'intro' | 'intake' | 'summary' | 'analyzing' | 'report'>('intro');
  const [previewTab, setPreviewTab] = useState<'blueprint' | 'financial' | 'action' | 'pdf'>('blueprint');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Form & Order State
  const [formData, setFormData] = useState<BusinessStartQuestionnaire>(createEmptyQuestionnaire());
  const [order, setOrder] = useState<BusinessStartOrder | null>(null);
  const [client, setClient] = useState<BusinessStartClient | null>(null);
  const [savedSessionNotice, setSavedSessionNotice] = useState<{ orderId: string; orderToken: string } | null>(null);

  // Validation & Error states
  const [missingQuestionId, setMissingQuestionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);

  // Restore existing session ONLY if explicit in URL/props, or offer optional restore
  useEffect(() => {
    let orderIdToLoad = initialOrderId;
    let tokenToLoad = initialOrderToken;

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

    if (orderIdToLoad && tokenToLoad) {
      loadOrder(orderIdToLoad, tokenToLoad);
      return;
    }

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

  // Analytics tracking when step changes
  useEffect(() => {
    if (currentStep === 'intake') {
      trackQuestionnaireStart();
    }
    if (currentStep === 'summary') {
      trackOfferView(order?.id, order?.priceCz || BUSINESS_START_PRICE_CZK);
    }
  }, [currentStep, order?.id, order?.priceCz]);

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
        } else if (res.order.status === 'ANALYZING' || res.order.status === 'PAID') {
          setCurrentStep('analyzing');
        } else if (res.order.status === 'PAYMENT_PENDING' || res.order.status === 'PAYMENT_FAILED' || res.order.status === 'READY_FOR_PAYMENT') {
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
    if (error) setError('');
    setMissingQuestionId(null);
  };

  // Append a chip to array/string fields
  const handleAppendChip = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', chip: string) => {
    const currentVal = formData[field];
    const currentStr = Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || '');
    if (currentStr.includes(chip)) return;
    const updated = currentStr ? `${currentStr}, ${chip}` : chip;
    handleFieldChange(field, updated);
  };

  const handleStartFresh = () => {
    resetQuestionnaireStartState();
    localStorage.removeItem('podnikai_client_bs_order');
    setSavedSessionNotice(null);
    setOrder(null);
    setClient(null);
    setFormData(createEmptyQuestionnaire());
    setError('');
    setMissingQuestionId(null);
    setSuccessNotice('Dotazník byl vyčištěn.');
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

  // Calculate dynamic questions completion count (out of 12)
  const getFilledQuestionsCount = (): number => {
    let count = 0;
    if (formData.clientName?.trim() && formData.clientEmail?.trim()) count++; // Q1
    if (formData.currentCareerSituation?.trim()) count++; // Q2
    if (formData.mainGoal?.trim()) count++; // Q3
    if (formData.targetMonthlyIncome?.trim()) count++; // Q4
    if (formData.startingCapital?.trim()) count++; // Q5
    if (formData.weeklyTimeCommitment?.trim()) count++; // Q6
    if (formData.operatingModel || formData.customPreferredWorkType?.trim() || formData.preferredWorkType) count++; // Q7
    const skills = Array.isArray(formData.coreSkillsAndExpertise) ? formData.coreSkillsAndExpertise.join('') : (formData.coreSkillsAndExpertise || '');
    if (skills.trim()) count++; // Q8
    const passions = Array.isArray(formData.passionsAndInterests) ? formData.passionsAndInterests.join('') : (formData.passionsAndInterests || '');
    if (passions.trim()) count++; // Q9
    const redLines = Array.isArray(formData.strictDislikesAndRedLines) ? formData.strictDislikesAndRedLines.join('') : (formData.strictDislikesAndRedLines || '');
    if (redLines.trim()) count++; // Q10
    if (formData.existingAssetsAndNetwork?.trim()) count++; // Q11
    if (formData.personalConstraints?.trim()) count++; // Q12
    return count;
  };

  const scrollToQuestion = (questionNumber: number) => {
    setMissingQuestionId(questionNumber);
    const element = document.getElementById(`question-card-${questionNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = element.querySelector('input, textarea, select') as HTMLElement | null;
      if (firstInput) {
        firstInput.focus();
      }
    }
  };

  // Submit and validate all 12 questions on the single page
  const handleCompleteIntake = async () => {
    setError('');
    setMissingQuestionId(null);

    // Validation with smooth jump to first missing question
    if (!formData.clientName?.trim()) {
      setError('Vyplňte prosím své jméno nebo název projektu (otázka 1).');
      scrollToQuestion(1);
      return;
    }
    if (!formData.clientEmail?.trim() || !formData.clientEmail.includes('@')) {
      setError('Zadejte prosím platný e-mail pro bezpečné doručení reportu (otázka 1).');
      scrollToQuestion(1);
      return;
    }
    if (!formData.mainGoal?.trim()) {
      setError('Vyplňte prosím svůj hlavní podnikatelský cíl a záměr (otázka 3).');
      scrollToQuestion(3);
      return;
    }
    if (!formData.targetMonthlyIncome?.trim()) {
      setError('Zadejte prosím svůj cílový měsíční příjem (otázka 4).');
      scrollToQuestion(4);
      return;
    }
    if (!formData.startingCapital?.trim()) {
      setError('Zadejte prosím svůj počáteční kapitál (otázka 5). Pokud začínáte bez peněz, zadejte 0 Kč.');
      scrollToQuestion(5);
      return;
    }
    if (!formData.weeklyTimeCommitment?.trim()) {
      setError('Zadejte prosím svoji týdenní časovou kapacitu (otázka 6).');
      scrollToQuestion(6);
      return;
    }

    setIsLoading(true);
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
      }
      
      // Sandbox / Test Mode (pokud v prostředí není nastaven živý STRIPE_SECRET_KEY):
      // Bezpečně odbaví serverově ověřenou simulaci platby 690 Kč (podepsanou HMAC a ověřenou na serveru)
      if (res.success && res.mode === 'sandbox') {
        setCurrentStep('analyzing');
        const simRes = await simulateBusinessStartPayment(order.id, order.orderToken, 'SUCCESS');
        if (simRes.success) {
          await loadOrder(order.id, order.orderToken, false);
          return;
        } else {
          setError(simRes.error || 'Simulace platby v testovacím režimu selhala.');
          setCurrentStep('summary');
        }
        return;
      }

      setError(res.error || 'Platební brána Stripe se připravuje nebo nebyla nalezena platební adresa. Zkuste to prosím za okamžik.');
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

  const filledCount = getFilledQuestionsCount();

  return (
    <div className="min-h-screen bg-[#080C16] text-slate-100 pb-20 selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0A0F1D]/90 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (currentStep === 'intake') {
                    setCurrentStep('intro');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                title="Zpět na předchozí krok"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-lg tracking-tight text-white">
                  PODNIK<span className="text-blue-500">AI</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  Business Start
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                12 otázek zdarma <span className="text-slate-600">·</span> Individuální Business Report a PDF: <strong className="text-emerald-400 font-bold">690 Kč</strong> jednorázově
              </p>
            </div>
          </div>

          {/* Stepper indicator */}
          <nav aria-label="Kroky procesu" className="hidden md:flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('intro');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                currentStep === 'intro' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white bg-slate-900/40'
              }`}
            >
              1. Úvod
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <button
              type="button"
              onClick={() => {
                setCurrentStep('intake');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                currentStep === 'intake' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white bg-slate-900/40'
              }`}
            >
              2. Dotazník (12 otázek)
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              currentStep === 'summary' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-slate-900/40'
            }`}>
              3. Rekapitulace & Report (690 Kč)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              currentStep === 'report' ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20' : 'text-slate-400 bg-slate-900/40'
            }`}>
              4. Hotový Report & PDF
            </span>
          </nav>

          {order && (
            <div className="text-right text-[11px]">
              <span className="text-slate-500 block">Objednávka:</span>
              <span className="font-mono text-slate-300 font-semibold">{order.id}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 sm:pt-8">
        {/* Alerts / Error Notices */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setError('')} 
              className="text-red-400 hover:text-white font-bold text-xs p-1"
              title="Zavřít chybové hlášení"
            >
              ✕
            </button>
          </div>
        )}

        {successNotice && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 0: PRODEJNÍ LANDING PAGE                                            */}
        {/* ========================================================================= */}
        {currentStep === 'intro' && (
          <div className="space-y-16 py-2 sm:py-6">
            {/* HERO SECTION */}
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs font-semibold text-blue-300">
                <Compass className="w-4 h-4 text-blue-400" />
                <span>Praktický start podnikání pro český trh</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black tracking-tight text-white leading-tight">
                Zjistěte, v čem začít podnikat <span className="text-blue-400">– a jak získat prvního zákazníka.</span>
              </h1>

              <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
                Odpovězte na 12 otázek. Získáte konkrétní podnikatelský směr přizpůsobený vašim schopnostem, času, rozpočtu a cílům.
              </p>

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
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>12 otázek v dotazníku je zdarma</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span><strong>Jednorázová platba</strong> – žádné předplatné</span>
                  </div>
                </div>

                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5">
                  💡 <em>Dotazník vyplníte 100% nezávazně. Teprve po jeho dokončení a kontrole odpovědí se svobodně rozhodnete, zda si chcete kompletní Business Report za 690 Kč pořídit.</em>
                </p>
              </div>

              {/* Primary CTA Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  id="btn-hero-start-intake"
                  onClick={() => {
                    setCurrentStep('intake');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-9 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base sm:text-lg shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <span>Začít 12 otázek zdarma</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto px-5 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700/80 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Máte rozpracovanou objednávku ({order.id})</span>
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                  </button>
                )}

                {!order && savedSessionNotice && (
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreSession}
                      className="px-4 py-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/70 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-all flex items-center gap-2"
                    >
                      <span>Obnovit koncept ({savedSessionNotice.orderId})</span>
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 px-2 py-1"
                    >
                      Nový čistý formulář
                    </button>
                  </div>
                )}
              </div>

              {/* Trust Subtext */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" /> 100% nezávazné vyplnění
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Všech 12 otázek na jedné stránce
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Bez nutnosti platební karty na startu
                </span>
              </div>
            </div>

            {/* KEY VALUE BENEFITS (6 CORE DELIVERABLES) */}
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-heading font-black text-white">
                  Co přesně v Business Startu získáte
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Konkrétní výstupy a čísla pro vaši situaci místo obecné motivační teorie:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">1. Vhodný podnikatelský směr</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Doporučený hlavní model vybraný ze 3 kandidátů odpovídající vašemu rozpočtu, zkušenostem a dovednostem.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">2. Konkrétní nabídka & zákazník</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Jasně formulovaný balíček služeb, komu ho nabízet a jaké konkrétní problémy platícího klienta řeší.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">3. Plán získání prvních zákazníků</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Praktický způsob oslovení prvních platících klientů včetně vzorového skriptu bez nutnosti drahých reklam.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">4. Finanční model & bod zvratu</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Jednotková ekonomika pro ČR: kalkulace počátečních nákladů, měsíčních výdajů a bod zvratu (break-even) v Kč.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">5. Konkrétní plán prvních 30 dní</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Přehledný harmonogram krok za krokem: od přípravy a živnosti až po první reálně odbavenou zakázku.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">6. Kompletní Business Report v PDF</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sazovaný dokument v tiskové kvalitě pro trvalé uchování, plánování a návrat k číslům kdykoliv offline.
                  </p>
                </div>
              </div>
            </div>

            {/* HOW IT WORKS (4 PROCESS STEPS) */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Přehledný proces</span>
                <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                  Jak to funguje: 4 jednoduché kroky
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Krok 1</span>
                  <h3 className="text-sm font-bold text-white">12 odpovědí zdarma</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Na jedné stránce vyplníte své zkušenosti, kapitál, časové možnosti a cíl.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Krok 2</span>
                  <h3 className="text-sm font-bold text-white">Individuální analýza</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Systém vyhodnotí data a ověří, které byznys modely přesně sedí do vašich mantinelů.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Krok 3</span>
                  <h3 className="text-sm font-bold text-white">Kontrola a rekapitulace</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Zkontrolujete své údaje a prohlédnete si detailní strukturu výsledného výstupu.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Krok 4</span>
                  <h3 className="text-sm font-bold text-white">Business Report (690 Kč)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Volitelný jednorázový nákup kompletního reportu a PDF ke stažení bez předplatného.
                  </p>
                </div>
              </div>
            </div>

            {/* REPORT PREVIEW / STRUCTURE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Předem víte, za co platíte</span>
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Ukázka struktury výsledného Business Reportu
                  </h2>
                </div>
                <span className="text-xs text-slate-400">Formát A4 PDF + interaktivní online report</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span>Kapitola 1: Individuální Business Blueprint</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-light">
                    Výběr vítězného směru s nejvyšší marží a nejnižším rizikem, jádrová nabídka a USP pro český trh.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <span>Kapitola 2: Profil cílového platícího zákazníka</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-light">
                    Detailní nákupní motivace, konkrétní bolesti, kde zákazníka najít a proč si vybere právě vás.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Kapitola 3: Finanční model se 3 scénáři v Kč</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-light">
                    Přesný výpočet bodu zvratu, fixní a variabilní náklady, marže a cenové hladiny (akviziční vs. standardní).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Kapitola 4: 30denní harmonogram & oslovovací skripty</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-light">
                    Přímý postup týden po týdnu k první zakázce a hotový komunikační skript (Icebreaker) bez nátlaku.
                  </p>
                </div>
              </div>
            </div>

            {/* PRO KOHO JE BUSINESS START */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Cílové zaměření</span>
                <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                  Pro koho je Business Start určen
                </h2>
                <p className="text-xs text-slate-400">
                  Produkt je vytvořený specificky pro lidi, kteří chtějí začít podnikat, ale ještě nezačali.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Business Start je pro vás ideální, pokud:</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>Jste zaměstnanec a zvažujete rozjezd podnikání vedle práce či přechod na volnou nohu.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>Máte dovednosti, praxi nebo řemeslo, ale nevíte, jak nastavit ceny a získat první zakázky.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>Jste na rodičovské dovolené a potřebujete flexibilní výdělek přizpůsobený rodině a omezenému času.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>Máte chuť podnikat, ale potřebujete spočítat rizika, bod zvratu a vybrat správný směr bez zbytečných ztrát.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                    <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Pro koho služba určena není:</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>Zavedené korporace a firmy s existujícím týmem, které hledají procesní reorganizaci poboček.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>Hledači „zázračného zbohatnutí přes noc“ bez reálného poskytování poctivých služeb či produktů.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>Lidé, kteří již mají vybudovanou stabilní klientelu a řeší výhradně investiční holdingy.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* FAQ SECTION */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5 mb-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-heading font-black text-white">
                  Časté otázky a odpovědi
                </h2>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    q: 'Kolik služba stojí a platí se předem?',
                    a: 'Vyplnění všech 12 otázek dotazníku je 100% zdarma a nezávazné. Teprve po vyplnění a kontrole odpovědí se rozhodnete, zda chcete vygenerovat kompletní individuální Business Report a PDF za jednorázových 690 Kč. Žádné skryté poplatky ani předplatné.'
                  },
                  {
                    q: 'Jak dlouho trvá vyplnění dotazníku?',
                    a: 'Vyplnění trvá běžně 4 až 7 minut. Všech 12 otázek máte přehledně pod sebou na jedné stránce, takže se v nich neztratíte a můžete se mezi nimi volně posouvat.'
                  },
                  {
                    q: 'Co když zatím nemám žádný počáteční kapitál?',
                    a: 'V otázce na rozpočet jednoduše zadáte „0 Kč“. Systém to vezme jako striktní podmínku a doporučí výhradně modely s nulovými vstupními investicemi založené na vašich stávajících schopnostech.'
                  },
                  {
                    q: 'Jak probíhá platba?',
                    a: 'Platba probíhá přes ověřenou a zabezpečenou platební bránu Stripe Checkout. Můžete platit běžnou platební kartou, Apple Pay nebo Google Pay. Platba je jednorázová (690 Kč).'
                  },
                  {
                    q: 'Kdy a v jaké formě obdržím svůj Business Report?',
                    a: 'Okamžitě po úspěšném zaúčtování platby proběhne zpracování vašeho zadání. Do několika sekund se vám v aplikaci otevře hotový interaktivní report a získáte tlačítko pro stažení kompletního sazovaného PDF dokumentu.'
                  },
                  {
                    q: 'Garantujete budoucí zisk nebo úspěch?',
                    a: 'Ne. Žádná seriózní služba nemůže garantovat zisk bez vaší osobní práce. PODNIKAI vám však dá realistická čísla, konkrétní ověřovací postup a ochranu před zbytečnými chybami, abyste věděli, co přesně dělat.'
                  }
                ].map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={idx} className="rounded-xl bg-slate-900/60 border border-slate-800/80 overflow-hidden transition-colors">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(prev => prev === idx ? null : idx)}
                        className="w-full p-4 text-left text-xs sm:text-sm font-semibold text-white flex items-center justify-between gap-3 hover:text-blue-300"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-xs sm:text-sm text-slate-300 font-light border-t border-slate-800/60 pt-3 leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BOTTOM CALL TO ACTION */}
            <div className="p-8 rounded-2xl bg-gradient-to-b from-[#0D1322] to-[#0A0F1D] border border-blue-600/30 text-center space-y-4 shadow-xl">
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-white">
                Připraveni zjistit, v čem a jak začít podnikat?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                Vyplňte 12 otázek zdarma a získejte jasný přehled o svých možnostech, zákaznících a ekonomice podnikání.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('intake');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/30 transition-all inline-flex items-center gap-2"
                >
                  <span>Začít 12 otázek zdarma</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: DOTAZNÍK – VŠECH 12 OTÁZEK NA JEDNÉ STRÁNCE POD SEBOU            */}
        {/* ========================================================================= */}
        {currentStep === 'intake' && (
          <div className="space-y-6 max-w-3xl mx-auto py-2">
            {/* Top Navigation & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('intro');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 transition-colors font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Zpět na představení</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-4"
                >
                  Uložit rozpracovaný koncept
                </button>
                <span className="text-[11px] px-2.5 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 font-bold">
                  100% zdarma
                </span>
              </div>
            </div>

            {/* Continuous Form Progress Indicator */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1322] border border-slate-800 shadow-xl space-y-3 sticky top-16 z-30 backdrop-blur-md bg-[#0D1322]/95">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-sm text-white">
                    Vyplněno {filledCount} z 12 otázek
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-blue-400 font-bold">
                    {Math.round((filledCount / 12) * 100)} %
                  </span>
                </div>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  Všech 12 otázek na jedné stránce · Cca 5 minut
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, (filledCount / 12) * 100)}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Vyplňujte otázky postupně posouváním stránky. Na konci klikněte na <strong>Vyhodnotit moje odpovědi</strong>.
              </p>
            </div>

            {/* Error jump notice if validation failed */}
            {error && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
                {missingQuestionId && (
                  <button
                    type="button"
                    onClick={() => scrollToQuestion(missingQuestionId)}
                    className="px-3 py-1 rounded-lg bg-red-800/60 hover:bg-red-700/60 text-white font-bold text-xs shrink-0"
                  >
                    Přejít k otázce {missingQuestionId}
                  </button>
                )}
              </div>
            )}

            {/* SINGLE CONTINUOUS FORM: ALL 12 QUESTIONS */}
            <form onSubmit={e => { e.preventDefault(); handleCompleteIntake(); }} className="space-y-6">
              
              {/* OTÁZKA 1 */}
              <div 
                id="question-card-1"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 1 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      1 / 12
                    </span>
                    <span className="text-xs text-red-400 font-semibold">* Povinné</span>
                  </div>
                  <span className="text-xs text-slate-500">Doručení reportu</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Vaše jméno a kontaktní údaje pro doručení reportu
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Zadejte své jméno a e-mail, na který vám máme vygenerovaný Business Report a PDF bezpečně doručit.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Jméno a příjmení (nebo název projektu) *
                    </label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={e => handleFieldChange('clientName', e.target.value)}
                      placeholder="Např. Jan Novák"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      E-mail pro doručení výstupů *
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={e => handleFieldChange('clientEmail', e.target.value)}
                      placeholder="jan.novak@email.cz"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Lokalita působení (volitelné)
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={e => handleFieldChange('location', e.target.value)}
                      placeholder="Např. Brno a okolí / Celá ČR (online)"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Telefon (volitelné)
                    </label>
                    <input
                      type="text"
                      value={formData.clientPhone}
                      onChange={e => handleFieldChange('clientPhone', e.target.value)}
                      placeholder="+420 777 000 000"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* OTÁZKA 2 */}
              <div 
                id="question-card-2"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 2 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    2 / 12
                  </span>
                  <span className="text-xs text-slate-500">Výchozí pozice</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Současná profesní situace a kariérní historie
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    V jakém oboru dnes působíte a jaké máte dosavadní pracovní zkušenosti, na které lze navázat?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <textarea
                    value={formData.currentCareerSituation}
                    onChange={e => handleFieldChange('currentCareerSituation', e.target.value)}
                    placeholder="Např. 8 let v administrativě, hledám přechod na volnou nohu / 5 let praxe jako truhlář / zaměstnanec zvažující první podnikání vedle práce..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Rychlá inspirace:</span>
                    {[
                      'Zaměstnanec zvažující volnou nohu',
                      'Rodičovská dovolená s volným časem',
                      'Mám praxi v oboru, chci vlastní firmu',
                      'Student / absolvent hledající rozjezd'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('currentCareerSituation', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 3 */}
              <div 
                id="question-card-3"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 3 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      3 / 12
                    </span>
                    <span className="text-xs text-red-400 font-semibold">* Povinné</span>
                  </div>
                  <span className="text-xs text-slate-500">Hlavní záměr</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Hlavní podnikatelský cíl a záměr *
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Co přesně byste rádi dělali, nebo jaký problém na trhu chcete řešit? Pokud ještě nemáte přesný nápad, napište své přání.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.mainGoal}
                    onChange={e => handleFieldChange('mainGoal', e.target.value)}
                    placeholder="Např. Chci otevřít masérské studio / Chci nabízet svatební líčení / Hledám podnikání online z domova..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Rychlá inspirace:</span>
                    {[
                      'Fyzické řemeslné či kosmetické služby v lokalitě',
                      '100% online činnost nebo poradenství z domova',
                      'Asistenční a organizační služby pro firmy (B2B)',
                      'Zatím nemám přesný nápad, chci doporučit nejvhodnější směr'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('mainGoal', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 4 */}
              <div 
                id="question-card-4"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 4 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      4 / 12
                    </span>
                    <span className="text-xs text-red-400 font-semibold">* Povinné</span>
                  </div>
                  <span className="text-xs text-slate-500">Cílový příjem</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Cílový měsíční příjem (po stabilizaci) *
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Kolik čistého měsíčně by vám mělo podnikání generovat, aby vám dávalo plný smysl?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.targetMonthlyIncome}
                    onChange={e => handleFieldChange('targetMonthlyIncome', e.target.value)}
                    placeholder="Např. 50 000 – 70 000 Kč měsíčně"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {[
                      '30 000 – 45 000 Kč (přivýdělek/start)',
                      '50 000 – 75 000 Kč (plná náhrada mzdy)',
                      '80 000 – 120 000 Kč (nadstandard)',
                      '150 000 Kč+ (růst)'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('targetMonthlyIncome', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 5 */}
              <div 
                id="question-card-5"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 5 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      5 / 12
                    </span>
                    <span className="text-xs text-red-400 font-semibold">* Povinné</span>
                  </div>
                  <span className="text-xs text-slate-500">Striktní finanční limit</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Reálný počáteční kapitál *
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Kolik peněz jste ochotni na startu maximálně investovat ze svých úspor? (Systém limit striktně dodrží).
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.startingCapital}
                    onChange={e => handleFieldChange('startingCapital', e.target.value)}
                    placeholder="Např. do 15 000 Kč / 50 000 Kč / 0 Kč"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {[
                      '0 Kč (striktně bez investic)',
                      'do 15 000 Kč (nízký rozpočet)',
                      'do 50 000 Kč (střední kapitál)',
                      '100 000 Kč+ (plné vybavení)'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('startingCapital', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 6 */}
              <div 
                id="question-card-6"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 6 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      6 / 12
                    </span>
                    <span className="text-xs text-red-400 font-semibold">* Povinné</span>
                  </div>
                  <span className="text-xs text-slate-500">Časová kapacita</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Týdenní časová kapacita *
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Kolik hodin týdně můžete podnikání věnovat vedle zaměstnání či rodiny?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.weeklyTimeCommitment}
                    onChange={e => handleFieldChange('weeklyTimeCommitment', e.target.value)}
                    placeholder="Např. 15 hodin týdně / 30 hodin týdně"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {[
                      '10 hodin / týdně (večery a volno)',
                      '20 hodin / týdně (půl úvazku)',
                      '30 hodin / týdně (intenzivní rozjezd)',
                      'Plný úvazek (40 h+)'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('weeklyTimeCommitment', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 7 */}
              <div 
                id="question-card-7"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 7 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    7 / 12
                  </span>
                  <span className="text-xs text-slate-500">Styl práce</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Požadovaný model provozu & preferovaný styl práce
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Vyhovuje vám spíše práce s lidmi osobně, manuální činnost, nebo 100% online činnost z domova?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Model provozu:
                    </label>
                    <select
                      value={formData.operatingModel}
                      onChange={e => handleFieldChange('operatingModel', e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="offline">Fyzická služba / osobní kontakt (offline)</option>
                      <option value="hybrid">Kombinovaný / hybridní model</option>
                      <option value="online">100% online / z domova</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Upřesnění stylu práce:
                    </label>
                    <input
                      type="text"
                      value={formData.customPreferredWorkType || formData.preferredWorkType || ''}
                      onChange={e => handleFieldChange('customPreferredWorkType', e.target.value)}
                      placeholder="Např. Osobní práce s klienty / Manuální práce"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-500 text-[11px]">Rychlá inspirace:</span>
                  {[
                    'Osobní kontakt s klienty',
                    'Práce na PC / digitální služby',
                    'Manuální a řemeslná práce',
                    'Poradenství a konzultace'
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleFieldChange('customPreferredWorkType', chip)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* OTÁZKA 8 */}
              <div 
                id="question-card-8"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 8 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    8 / 12
                  </span>
                  <span className="text-xs text-slate-500">Dovednosti</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Vaše dovednosti a silné stránky
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    V čem máte přirozenou výhodu, praxi nebo dovednosti, za které vám lidé rádi zaplatí?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={Array.isArray(formData.coreSkillsAndExpertise) ? formData.coreSkillsAndExpertise.join(', ') : (formData.coreSkillsAndExpertise ?? '')}
                    onChange={e => handleFieldChange('coreSkillsAndExpertise', e.target.value)}
                    placeholder="Např. Komunikace s lidmi, organizace akcí, technická zručnost, grafika..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Přidat kliknutím:</span>
                    {[
                      'Komunikace a empatie',
                      'Technická zručnost a řemeslo',
                      'Organizace a administrativa',
                      'Práce s počítačem a sítěmi',
                      'Obchod a prodej'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAppendChip('coreSkillsAndExpertise', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 9 */}
              <div 
                id="question-card-9"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 9 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    9 / 12
                  </span>
                  <span className="text-xs text-slate-500">Zájmy a obory</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Zájmy, obory a témata, která vás baví
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Která témata vás přirozeně zajímají a věnovali byste se jim i ve volném čase?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={Array.isArray(formData.passionsAndInterests) ? formData.passionsAndInterests.join(', ') : (formData.passionsAndInterests ?? '')}
                    onChange={e => handleFieldChange('passionsAndInterests', e.target.value)}
                    placeholder="Např. Zdravý životní styl, gastro, káva, udržitelnost, dřevo, design..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Přidat kliknutím:</span>
                    {[
                      'Zdraví a sport',
                      'Gastro a káva',
                      'Design a estetika',
                      'Technologie a AI',
                      'Práce s materiály a řemeslo',
                      'Vzdělávání a rozvoj'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAppendChip('passionsAndInterests', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 10 */}
              <div 
                id="question-card-10"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 10 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                    10 / 12
                  </span>
                  <span className="text-xs text-red-400">Červené linie</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Odmítnuté činnosti (Čemu se striktně vyhýbáte)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Činnosti, které za žádnou cenu nechcete dělat. Systém je v analýze bez kompromisů vyřadí.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={Array.isArray(formData.strictDislikesAndRedLines) ? formData.strictDislikesAndRedLines.join(', ') : (formData.strictDislikesAndRedLines ?? '')}
                    onChange={e => handleFieldChange('strictDislikesAndRedLines', e.target.value)}
                    placeholder="Např. Cold calling (studené volání), práce o víkendech, sezení 8 hodin u PC..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Přidat kliknutím:</span>
                    {[
                      'Cold calling (studené volání)',
                      'Práce o víkendech',
                      'Celodenní sezení u PC',
                      'Multilevel marketing',
                      'Těžká fyzická práce'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAppendChip('strictDislikesAndRedLines', chip)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-500/30 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 11 */}
              <div 
                id="question-card-11"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 11 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    11 / 12
                  </span>
                  <span className="text-xs text-slate-500">Stávající aktiva</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Dosavadní kontakty a stávající aktiva
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    O jaké kontakty, vybavení, auto či zázemí se můžeme hned na začátku opřít?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.existingAssetsAndNetwork ?? ''}
                    onChange={e => handleFieldChange('existingAssetsAndNetwork', e.target.value)}
                    placeholder="Např. Vlastní notebook, automobil, kontakty na majitele firem v okolí..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Rychlá volba:</span>
                    {[
                      'Vlastní spolehlivé PC / notebook',
                      'Vlastní automobil',
                      'Síť kontaktů z dosavadní práce',
                      'Zatím začínám od nuly'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('existingAssetsAndNetwork', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* OTÁZKA 12 */}
              <div 
                id="question-card-12"
                className={`p-6 sm:p-7 rounded-2xl bg-[#0D1322] border transition-all ${
                  missingQuestionId === 12 ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800'
                } space-y-4`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    12 / 12 (Poslední otázka)
                  </span>
                  <span className="text-xs text-slate-500">Osobní mantinely</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                    Osobní limitace a specifické podmínky pro rozjezd
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Máte nějaká specifická rodinná, časová nebo jiná omezení, která musí analýza zohlednit?
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={formData.personalConstraints ?? ''}
                    onChange={e => handleFieldChange('personalConstraints', e.target.value)}
                    placeholder="Např. Pouze večery a pátky, péče o děti, bez možnosti platit drahé nájmy..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-500 text-[11px]">Rychlá volba:</span>
                    {[
                      'Pouze večery a volné dny',
                      'Péče o děti / flexibilní režim',
                      'Bez drahých nájmů a prostor',
                      'Žádná zásadní omezení'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleFieldChange('personalConstraints', chip)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FORM SUBMISSION BAR */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1322] border border-blue-600/30 text-center space-y-4 shadow-xl">
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-heading font-black text-white">
                    Máte vyplněno? Zkontrolujte a vyhodnoťte své odpovědi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Odpovědi se bezpečně uloží a zobrazí se přehledná rekapitulace před vytvořením Business Reportu.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Uložit koncept
                  </button>

                  <button
                    type="submit"
                    id="btn-submit-intake"
                    disabled={isLoading}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                  >
                    <span>{isLoading ? 'Ukládám...' : 'Vyhodnotit moje odpovědi'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: REKAPITULACE A PRODEJ REPORTU (690 KČ)                           */}
        {/* ========================================================================= */}
        {currentStep === 'summary' && (
          <div className="max-w-3xl mx-auto space-y-8 py-2">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Všech 12 otázek je úspěšně uloženo</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-heading font-black text-white">
                Vaše odpovědi jsou připravené.
              </h1>
              <p className="text-xs sm:text-base text-slate-300 max-w-xl mx-auto">
                Na jejich základě pro vás vytvoříme individuální Business Report a PDF dokument s přesnými čísly pro český trh.
              </p>
            </div>

            {/* Rekapitulace zadaných odpovědí */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0D1322] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rekapitulace vašich mantinelů:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('intake');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs text-blue-400 hover:text-white transition-colors underline underline-offset-4"
                >
                  Upravit odpovědi v dotazníku
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[11px]">Klient & doručení:</span>
                  <strong className="text-white">{formData.clientName || 'Klient'}</strong> ({formData.clientEmail})
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Podnikatelský záměr:</span>
                  <strong className="text-white">{formData.mainGoal}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Dostupný kapitál:</span>
                  <strong className="text-emerald-400">{formData.startingCapital}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Týdenní časová kapacita:</span>
                  <strong className="text-blue-400">{formData.weeklyTimeCommitment}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Cílový příjem:</span>
                  <strong className="text-white">{formData.targetMonthlyIncome}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Model provozu:</span>
                  <span className="text-white">{formData.operatingModel} {formData.customPreferredWorkType ? `(${formData.customPreferredWorkType})` : ''}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block text-[11px]">Odmítnuté činnosti (Červené linie):</span>
                  <span className="text-red-300">
                    {Array.isArray(formData.strictDislikesAndRedLines) 
                      ? formData.strictDislikesAndRedLines.join(', ') 
                      : (formData.strictDislikesAndRedLines || 'Neuvedeno')}
                  </span>
                </div>
              </div>
            </div>

            {/* Prezentace hodnoty placeného reportu */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0D1322] border border-slate-800 space-y-6">
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 block">
                  Individuální výstup na míru
                </span>
                <h2 className="text-xl sm:text-2xl font-heading font-black text-white">
                  Co získáte v kompletním Business Reportu za 690 Kč
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Žádná generická šablona. Individuální rozpracování vytvořené přesně podle vašich 12 odpovědí:
                </p>
              </div>

              {/* 6 pilířů výstupu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Target className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>1. Doporučený směr (Blueprint)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Vítězný model vybraný ze 3 kandidátů odpovídající vašemu rozpočtu i času.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>2. Konkrétní nabídka & cenotvorba</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Co přesně prodávat, za kolik a s jakou doporučenou marží na českém trhu.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>3. Profil cílového zákazníka</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Konkrétní nákupní bolesti, priority a důvody, proč si zákazník vybere právě vás.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>4. Získání prvních zákazníků</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Hotový oslovovací skript (Icebreaker) bez nutnosti utrácet za drahé reklamy.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>5. Finanční model se 3 scénáři</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Přesný bod zvratu (break-even), fixní náklady a kapacitní matematika v Kč.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>6. 30denní plán & PDF ke stažení</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    Konkrétní úkoly týden po týdnu + kompletní profesionálně sazované PDF ke stažení.
                  </p>
                </div>
              </div>

              {/* Ukázka reportu – Přepínací karty */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Ukázka částí výstupního reportu:
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">Reprezentativní části výstupu</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('blueprint')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'blueprint'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1. Blueprint & nabídka
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('financial')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'financial'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2. Finanční model
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('action')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'action'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3. 30denní plán & skripty
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('pdf')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewTab === 'pdf'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    4. PDF dokument
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-3 font-mono">
                  {previewTab === 'blueprint' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-blue-400 font-bold border-b border-slate-800 pb-1.5">
                        <span>[UKÁZKA ČÁSTI 1: DOPORUČENÝ BYZNYS SMĚR]</span>
                        <span className="text-[10px] text-slate-500">INDIVIDUÁLNÍ BLUEPRINT</span>
                      </div>
                      <p className="text-slate-300 font-sans leading-relaxed">
                        <strong>Doporučený model:</strong> Zakázková specializovaná činnost s vysokou marží a nízkými počátečními náklady.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-sans text-slate-400">
                        <div className="p-2 rounded-lg bg-slate-900/60">
                          <span className="text-white block font-semibold mb-0.5">Jádrová nabídka:</span>
                          Konkrétní balíček řešení s jasně dohodnutým termínem a transparentní cenou.
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60">
                          <span className="text-white block font-semibold mb-0.5">Cílový avatar:</span>
                          Zákazník s vysokou ochotou platit za spolehlivost a ušetřený čas.
                        </div>
                      </div>
                    </div>
                  )}

                  {previewTab === 'financial' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                        <span>[UKÁZKA ČÁSTI 2: FINANČNÍ MODEL & BOD ZVRATU]</span>
                        <span className="text-[10px] text-slate-500">ČESKÉ REÁLIE V KČ</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-sans">
                        <div className="p-2 rounded-lg bg-slate-900/60">
                          <span className="text-slate-400 block text-[10px]">Fixní náklady:</span>
                          <span className="text-white font-bold">2 500 – 4 500 Kč / měsíc</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60">
                          <span className="text-slate-400 block text-[10px]">Bod zvratu (Break-even):</span>
                          <span className="text-emerald-400 font-bold">Pouze 2 až 3 zakázky</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60">
                          <span className="text-slate-400 block text-[10px]">Doporučená cena:</span>
                          <span className="text-blue-300 font-bold">Dle kalkulované marže</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans italic">
                        Model počítá s pesimistickým, realistickým i růstovým scénářem s ohledem na vaši časovou kapacitu.
                      </p>
                    </div>
                  )}

                  {previewTab === 'action' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-blue-400 font-bold border-b border-slate-800 pb-1.5">
                        <span>[UKÁZKA ČÁSTI 3: 30DENNÍ PLÁN & OSLOVENÍ]</span>
                        <span className="text-[10px] text-slate-500">PRAKTICKÉ KROKY</span>
                      </div>
                      <div className="space-y-1.5 font-sans text-[11px] text-slate-300">
                        <div><strong>Týden 1:</strong> Příprava 1stránkové nabídky & sepsání seznamu prvních 20 kontaktů</div>
                        <div><strong>Týden 2:</strong> Odeslání vzorového oslovovacího skriptu (Icebreaker) bez nátlaku</div>
                        <div><strong>Týden 3:</strong> Uzavření první zakázky za zaváděcí referenční cenu</div>
                        <div><strong>Týden 4:</strong> Odbavení, sběr referencí a oslovení další vlny klientů</div>
                      </div>
                    </div>
                  )}

                  {previewTab === 'pdf' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                        <span>[UKÁZKA ČÁSTI 4: PROFESIONÁLNÍ PDF KE STAŽENÍ]</span>
                        <span className="text-[10px] text-slate-500">A4 DOKUMENT V KVALITĚ</span>
                      </div>
                      <div className="flex items-center gap-3 font-sans text-xs text-slate-300">
                        <FileText className="w-7 h-7 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="text-white block">Kompletní sazovaný PDF report ke stažení</strong>
                          <span className="text-[11px] text-slate-400">
                            Obsahuje veškeré kapitoly, tabulky finančního modelu, rozpočty a skripty. Přístupné trvale v aplikaci i offline.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Garance přizpůsobení */}
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/25 space-y-1 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-blue-300 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Co když to nebude pro mě?</span>
                </div>
                <p className="leading-relaxed text-slate-300">
                  Report nevzniká z obecné šablony. Vychází z vašich konkrétních odpovědí, vašeho reálného rozpočtu, časové kapacity a červených linií. PODNIKAI striktně respektuje vaše zadané mantinely.
                </p>
              </div>

              {/* Cenový blok & Stripe Checkout */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0A0F1D] to-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Cena za kompletní report:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-heading font-black text-white">690 Kč</span>
                      <span className="text-xs text-slate-300 font-medium">jednorázově · bez předplatného</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 sm:text-right">
                    <span className="inline-block px-3 py-1 rounded text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 font-semibold text-[11px]">
                      ✓ Okamžité zpracování po úhradě
                    </span>
                    <span className="block text-[11px] text-slate-500">Žádné skryté poplatky ani další platby</span>
                  </div>
                </div>

                {/* Primary Checkout Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    id="btn-checkout-proceed"
                    onClick={handleProceedToPayment}
                    disabled={isLoading}
                    className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base sm:text-lg shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <CreditCard className="w-5 h-5 text-white" />
                    <span>{isLoading ? 'Přesměrovávám na zabezpečený Stripe...' : 'Získat Business Report za 690 Kč'}</span>
                  </button>

                  <p className="text-center text-[11px] text-slate-400 pt-2 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Jednorázová platba · bez předplatného · zabezpečeno přes Stripe Checkout (karta, Apple Pay, Google Pay)</span>
                  </p>
                </div>
              </div>

              {/* Pre-purchase FAQ */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Otázky k nákupu reportu:
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80">
                    <strong className="text-white block mb-1">Je to jednorázová platba nebo předplatné?</strong>
                    <p className="text-slate-400 leading-relaxed font-light">
                      Jde o jednorázovou platbu 690 Kč. Žádné měsíční poplatky se vám v budoucnu strhávat nebudou.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80">
                    <strong className="text-white block mb-1">Kdy a jak získám PDF?</strong>
                    <p className="text-slate-400 leading-relaxed font-light">
                      Ihned po potvrzení platby systém dokončí analýzu a na obrazovce se vám zobrazí tlačítko pro stažení PDF reportu v tiskové kvalitě.
                    </p>
                  </div>
                </div>
              </div>

              {/* Back to edit questionnaire */}
              <div className="pt-2 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('intake');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Upravit odpovědi v dotazníku</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: ANALYZING (STAV ZPRACOVÁNÍ PO PLATBĚ)                            */}
        {/* ========================================================================= */}
        {currentStep === 'analyzing' && (
          <div className="max-w-xl mx-auto space-y-6 text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2 animate-spin">
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
                Systém zpracovává vaše zadání v souladu se zadanými limity a tržními pravidly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0D1322] border border-slate-800 shadow-xl text-left space-y-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Průběh zpracování:
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Přijali jsme vaše odpovědi</span>
                </div>
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ověřili jsme vstupní údaje a mantinely</span>
                </div>
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Platba {order?.priceCz || 690} Kč úspěšně zaúčtována na serveru</span>
                </div>
                <div className="flex items-center gap-2.5 text-blue-400 font-medium">
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
                    Platba byla přijata, ale generování narazilo na chvilkovou prodlevu.
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

        {/* ========================================================================= */}
        {/* STEP 4: HOTOVÝ REPORT & PDF DOWNLOAD                                      */}
        {/* ========================================================================= */}
        {currentStep === 'report' && client && (
          <div className="space-y-6 py-2">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1322] border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-heading font-black text-lg text-white">
                    Váš Business Report je připraven
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Objednávka <span className="font-mono text-white">{order?.id}</span> · Platba <span className="text-emerald-400 font-semibold">{order?.priceCz || 690} Kč potvrzena</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  ✓ ZAPLACENO & PŘIPRAVENO
                </span>
              </div>
            </div>

            {/* Embedded Full Report Tab */}
            <div className="bg-[#0D1322] rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-2xl">
              <BusinessStartReportTab client={client} />
            </div>
          </div>
        )}

        {/* Public Informational & SEO Guides Navigation Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-800 text-center space-y-6">
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
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
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
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
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
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
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
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
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
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                Jak získat první zákazníky
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 max-w-xl mx-auto leading-relaxed">
            <span>PODNIKAI Business Start · 12 otázek zdarma · Individuální Business Report & 30denní plán za 690 Kč.</span>
            <button
              type="button"
              onClick={() => resetCookieConsent()}
              className="text-slate-400 hover:text-blue-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Nastavení cookies a soukromí
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};
