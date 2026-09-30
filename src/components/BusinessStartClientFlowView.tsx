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
  simulateBusinessStartPayment, 
  retryBusinessStartAnalysis,
  markBusinessStartPdfReady
} from '../services/api';
import { BusinessStartReportTab } from './admin/BusinessStartReportTab';

interface BusinessStartClientFlowViewProps {
  onBackToHome?: () => void;
  initialOrderId?: string;
  initialOrderToken?: string;
}

export const BusinessStartClientFlowView: React.FC<BusinessStartClientFlowViewProps> = ({
  onBackToHome,
  initialOrderId,
  initialOrderToken
}) => {
  // Navigation & Step State
  // 1: intake (12 questions), 2: checkout_summary, 3: payment_processing, 4: analyzing, 5: report_ready
  const [currentStep, setCurrentStep] = useState<'intake' | 'summary' | 'payment' | 'analyzing' | 'report'>('intake');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);

  // Form & Order State
  const [formData, setFormData] = useState<BusinessStartQuestionnaire>(createEmptyQuestionnaire());
  const [order, setOrder] = useState<BusinessStartOrder | null>(null);
  const [client, setClient] = useState<BusinessStartClient | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);

  // Restore existing session from props or localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('podnikai_client_bs_order');
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

    if (!orderIdToLoad && savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.orderId && parsed.orderToken) {
          orderIdToLoad = parsed.orderId;
          tokenToLoad = parsed.orderToken;
        }
      } catch (e) {
        console.warn('Failed parsing saved session', e);
      }
    }

    if (orderIdToLoad && tokenToLoad) {
      loadOrder(orderIdToLoad, tokenToLoad);
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

        // Map order status to UI step
        if (res.order.status === 'REPORT_READY' || res.order.status === 'PDF_READY') {
          setCurrentStep('report');
        } else if (res.order.status === 'ANALYZING') {
          setCurrentStep('analyzing');
        } else if (res.order.status === 'PAID') {
          setCurrentStep('analyzing');
        } else if (res.order.status === 'PAYMENT_PENDING' || res.order.status === 'PAYMENT_FAILED') {
          setCurrentStep('payment');
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

    setIsLoading(true);
    setError('');
    try {
      const res = await initiateBusinessStartCheckout(order.id, order.orderToken);
      if (res.success) {
        if (res.mode === 'stripe_hosted' && res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }
        // Sandbox mode
        setCurrentStep('payment');
        if (res.order) setOrder(res.order);
      } else {
        setError(res.error || 'Nepodařilo se spustit platební bránu');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při inicializaci platby');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteSandboxPayment = async (outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS') => {
    if (!order || !order.id || !order.orderToken) return;

    setIsSimulatingPayment(true);
    setError('');
    try {
      const res = await simulateBusinessStartPayment(order.id, order.orderToken, outcome);
      if (res.success && outcome === 'SUCCESS') {
        setCurrentStep('analyzing');
        // Reload order state after payment
        await loadOrder(order.id, order.orderToken, false);
      } else if (outcome === 'FAILURE') {
        setError('Platba byla zamítnuta (testovací simulace selhání platby).');
        if (res.order) setOrder(res.order);
      } else {
        setError(res.error || 'Platba nebyla potvrzena');
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při zpracování platby');
    } finally {
      setIsSimulatingPayment(false);
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
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Zpět do aplikace"
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
                Automatizovaný placený flow • Cena: 1 990 Kč
              </p>
            </div>
          </div>

          {/* Stepper indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'intake' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-white/5'
            }`}>
              1. Dotazník
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'summary' || currentStep === 'payment' ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-400 bg-white/5'
            }`}>
              2. Platba (1 990 Kč)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'analyzing' ? 'bg-amber-600 text-white font-bold animate-pulse' : 'text-slate-400 bg-white/5'
            }`}>
              3. AI Analýza
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              currentStep === 'report' ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20' : 'text-slate-400 bg-white/5'
            }`}>
              4. Hotový Report
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

        {/* STEP 1: INTAKE QUESTIONNAIRE (12 QUESTIONS) */}
        {currentStep === 'intake' && (
          <div className="space-y-6">
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
                    value={formData.clientName}
                    onChange={e => handleFieldChange('clientName', e.target.value)}
                    placeholder="Vaše jméno a příjmení *"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={e => handleFieldChange('clientEmail', e.target.value)}
                    placeholder="E-mail pro doručení reportu *"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <input
                    type="text"
                    value={formData.clientPhone}
                    onChange={e => handleFieldChange('clientPhone', e.target.value)}
                    placeholder="Telefon (volitelné)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
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

              {/* Question 8: Preferred Work Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Preferovaný typ práce (Hard Constraint)
                </label>
                <input
                  type="text"
                  value={formData.customPreferredWorkType || formData.preferredWorkType}
                  onChange={e => handleFieldChange('customPreferredWorkType', e.target.value)}
                  placeholder="Např. Práce s lidmi osobně / Fyzická manuální práce / Vlastní studio / Práce na PC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Question 9 & 10: Skills & Red Lines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    8. Dovednosti a silné stránky (oddělené čárkou)
                  </label>
                  <input
                    type="text"
                    value={formData.coreSkillsAndExpertise?.join(', ') || ''}
                    onChange={e => handleFieldChange('coreSkillsAndExpertise', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Např. Masáže, regenerace, komunikace s lidmi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-red-400 block">
                    10. Odmítnuté činnosti (RED LINES)
                  </label>
                  <input
                    type="text"
                    value={formData.strictDislikesAndRedLines?.join(', ') || ''}
                    onChange={e => handleFieldChange('strictDislikesAndRedLines', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Např. Celodenní sezení u PC, cold calling, multilevel"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Question 11 & 12 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    11. Dosavadní kontakty a stávající aktiva
                  </label>
                  <input
                    type="text"
                    value={formData.existingAssetsAndNetwork || ''}
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
                    value={formData.personalConstraints || ''}
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
                  <span>Přejít k objednávce (1 990 Kč)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ORDER SUMMARY & PRODUCT OFFER (1 990 KČ) */}
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
              <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs text-slate-400 block">Jednorázová cena balíčku:</span>
                  <span className="text-3xl font-heading font-black text-white">1 990 Kč</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pokračovat k platbě 1 990 Kč</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PAYMENT SCREEN (SANDBOX / STRIPE) */}
        {currentStep === 'payment' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2">
                <CreditCard className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-heading font-black text-white">
                Bezpečná platba objednávky
              </h1>
              <p className="text-xs text-slate-400">
                Objednávka: <span className="font-mono text-white">{order?.id}</span> • Částka: <strong className="text-emerald-400">1 990 Kč</strong>
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D1A] border border-white/10 shadow-2xl space-y-6">
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Server-side ověření platby</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Analýza a Business Report se spustí výhradně po potvrzení platby serverem (kryptograficky ověřený webhook).
                </p>
              </div>

              {/* Test Sandbox Payment Simulation Actions */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Provést platbu (Testovací & Sandbox prostředí):
                </span>

                <button
                  type="button"
                  onClick={() => handleExecuteSandboxPayment('SUCCESS')}
                  disabled={isSimulatingPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {isSimulatingPayment ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Ověřuji a provádím platbu 1 990 Kč...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      <span>Zaplatit 1 990 Kč (Ověřená platba)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteSandboxPayment('FAILURE')}
                  disabled={isSimulatingPayment}
                  className="w-full py-2 px-3 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-red-400 text-[11px] font-semibold border border-red-500/20 transition-colors"
                >
                  Simulovat neúspěšnou platbu (test chybového stavu)
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
                  <span>Platba 1 990 Kč úspěšně zaúčtována na serveru</span>
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
                  Objednávka <span className="font-mono text-white">{order?.id}</span> • Platba <span className="text-emerald-400 font-semibold">1 990 Kč potvrzena</span>
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
      </div>
    </div>
  );
};
