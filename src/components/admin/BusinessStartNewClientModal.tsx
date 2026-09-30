import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Save, 
  User, 
  DollarSign, 
  Clock, 
  Globe, 
  Target, 
  Briefcase, 
  Heart, 
  Ban, 
  Layers, 
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  BookmarkCheck,
  Wrench
} from 'lucide-react';
import { BusinessStartQuestionnaire, PREFERRED_WORK_TYPE_OPTIONS, PreferredWorkType } from '../../types';
import { createEmptyQuestionnaire } from '../../utils/businessStartDefaults';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateClient: (q: BusinessStartQuestionnaire, consultantName?: string, autoAnalyze?: boolean) => Promise<void>;
  isCreating: boolean;
}

const WIZARD_DRAFT_KEY = 'podnikai_bs_wizard_draft';

const STEPS = [
  { id: 1, title: 'Identifikace & Kontakty', icon: User, short: 'Klient' },
  { id: 2, title: 'Kariéra & Současná situace', icon: Briefcase, short: 'Kariéra' },
  { id: 3, title: 'Hlavní cíl podnikání', icon: Target, short: 'Cíl' },
  { id: 4, title: 'Cílový měsíční příjem', icon: DollarSign, short: 'Příjem' },
  { id: 5, title: 'Počáteční kapitál', icon: DollarSign, short: 'Kapitál' },
  { id: 6, title: 'Časová kapacita', icon: Clock, short: 'Čas' },
  { id: 7, title: 'Model provozu', icon: Globe, short: 'Model' },
  { id: 8, title: 'Dovednosti & Silné stránky', icon: Sparkles, short: 'Dovednosti' },
  { id: 9, title: 'Zájmy & Oblasti', icon: Heart, short: 'Zájmy' },
  { id: 10, title: 'Červené linie (Odmítá)', icon: Ban, short: 'Odmítá' },
  { id: 11, title: 'Existující aktiva', icon: Layers, short: 'Aktiva' },
  { id: 12, title: 'Osobní limity & Start', icon: AlertCircle, short: 'Rekapitulace' }
];

export const BusinessStartNewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onCreateClient,
  isCreating
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<BusinessStartQuestionnaire>(() => {
    try {
      const saved = localStorage.getItem(WIZARD_DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed restoring wizard draft:', e);
    }
    return createEmptyQuestionnaire();
  });
  const [consultantName, setConsultantName] = useState('Konzultant PODNIKAI');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [stepError, setStepError] = useState<string>('');
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Auto-save draft changes to localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(formData));
      } catch (e) {
        console.warn('Failed saving draft:', e);
      }
    }
  }, [formData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof BusinessStartQuestionnaire, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setStepError('');
  };

  const handleArrayChange = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', index: number, val: string) => {
    setFormData(prev => {
      const arr = [...prev[field]];
      arr[index] = val;
      return { ...prev, [field]: arr };
    });
  };

  const handleAddItem = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', defaultVal: string = '') => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], defaultVal] }));
  };

  const handleToggleItem = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', val: string) => {
    setFormData(prev => {
      const exists = prev[field].includes(val);
      if (exists) {
        return { ...prev, [field]: prev[field].filter(item => item !== val) };
      } else {
        return { ...prev, [field]: [...prev[field], val] };
      }
    });
  };

  const handleRemoveItem = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', index: number) => {
    setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const validateStep = (stepNumber: number): boolean => {
    if (stepNumber === 1) {
      if (!formData.clientName.trim()) {
        setStepError('Prosím vyplňte jméno klienta pro pokračování.');
        return false;
      }
    }
    if (stepNumber === 7) {
      if (!formData.operatingModel) {
        setStepError('Prosím zvolte požadovaný model provozu.');
        return false;
      }
    }
    setStepError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 12) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(formData));
      setDraftSavedToast(true);
      setTimeout(() => setDraftSavedToast(false), 2500);
    } catch (e) {
      console.warn('Draft save error:', e);
    }
  };

  const handleComplete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }
    await onCreateClient(formData, consultantName, autoAnalyze);
    // Clear draft on successful completion
    try {
      localStorage.removeItem(WIZARD_DRAFT_KEY);
    } catch {}
    onClose();
  };

  const q = formData;
  const progressPercent = Math.round((currentStep / 12) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Wizard Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">PODNIKAI Business Start – Průvodce dotazníkem</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Krok {currentStep} z 12
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  12 otázek pro vytvoření vašeho podnikatelského plánu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-colors border border-white/10"
                title="Uložit rozpracovaný koncept do prohlížeče"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Uložit rozpracované</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar & Indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-white">{STEPS[currentStep - 1].title}</span>
              <span className="font-mono text-blue-400 font-bold">{progressPercent} %</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stepper Dots/Buttons */}
            <div className="flex items-center justify-between pt-1 overflow-x-auto gap-1 no-scrollbar">
              {STEPS.map((s) => {
                const isCompleted = s.id < currentStep;
                const isCurrent = s.id === currentStep;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (validateStep(currentStep) || s.id < currentStep) {
                        setCurrentStep(s.id);
                      }
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors shrink-0 ${
                      isCurrent 
                        ? 'bg-blue-600 text-white font-bold' 
                        : isCompleted 
                          ? 'text-emerald-400 hover:bg-emerald-500/10' 
                          : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <span>{s.id}.</span>
                    )}
                    <span className="hidden md:inline">{s.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Draft notification toast */}
        {draftSavedToast && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-300 flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Rozpracovaný dotazník byl bezpečně uložen. Můžete jej kdykoliv dopracovat.
          </div>
        )}

        {/* Step Validation Error */}
        {stepError && (
          <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-2 text-xs text-rose-300 flex items-center justify-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            {stepError}
          </div>
        )}

        {/* Step Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[340px] flex flex-col justify-center">
          
          {/* STEP 1: IDENTIFIKACE */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <User className="w-4 h-4" /> Krok 1 z 12: Identifikace a kontaktní údaje klienta
              </div>
              <p className="text-xs text-slate-400">
                Uveďte základní identifikační údaje pro vystavení profilu klienta a vazbu na report.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Jméno a příjmení klienta * <span className="text-rose-400">(povinné)</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="např. Tomáš Dvořák"
                    value={q.clientName}
                    onChange={e => handleChange('clientName', e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
                    <input
                      type="email"
                      placeholder="tomas.dvorak@example.cz"
                      value={q.clientEmail}
                      onChange={e => handleChange('clientEmail', e.target.value)}
                      className="w-full bg-black/40 border border-white/15 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Telefon</label>
                    <input
                      type="tel"
                      placeholder="+420 777 123 456"
                      value={q.clientPhone}
                      onChange={e => handleChange('clientPhone', e.target.value)}
                      className="w-full bg-black/40 border border-white/15 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Město / Lokalita působení</label>
                  <input
                    type="text"
                    placeholder="např. Praha / Brno / Celá ČR (online)"
                    value={q.location}
                    onChange={e => handleChange('location', e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: KARIÉRNÍ HISTORIE */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Briefcase className="w-4 h-4" /> Krok 2 z 12: Kariérní historie a současná profesní situace
              </div>
              <p className="text-xs text-slate-400">
                Popište současnou práci, pozici, dosavadní zkušenosti a co klienta k podnikání přivádí.
              </p>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 mr-1 self-center">Rychlá volba:</span>
                {[
                  'Zaměstnanec hledající přivýdělek nebo přechod na podnikání',
                  'Začínající OSVČ hledající první stabilní směr',
                  'Rodič hledající flexibilnější způsob práce',
                  'Zkušený odborník, který chce podnikat ve svém oboru',
                  'Student nebo začátečník',
                  'Jiná situace'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChange('currentCareerSituation', preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                placeholder="Např. 7 let jako projektový manažer v IT. Zkušenosti s organizací týmů, komunikací s klienty a nastavováním procesů. Hledá směr, kde zúročí své silné organizační stránky bez nutnosti technického programování."
                value={q.currentCareerSituation}
                onChange={e => handleChange('currentCareerSituation', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-blue-500 rounded-xl p-3.5 text-xs text-white resize-none"
              />
            </div>
          )}

          {/* STEP 3: HLAVNÍ CÍL PODNIKÁNÍ */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Target className="w-4 h-4" /> Krok 3 z 12: Hlavní cíl podnikání
              </div>
              <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed">
                Co chce klient podnikáním skutečně dosáhnout?{'\n'}Pomůže AI nastavit vhodný podnikatelský model – online, fyzický, lokální nebo hybridní.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {[
                  { title: 'Plná nezávislost', desc: 'Nahradit stávající plat a opustit zaměstnání do 6 měsíců' },
                  { title: 'Bezpečný přivýdělek', desc: 'Stabilní vedlejší příjem 30–50 tisíc Kč k práci' },
                  { title: 'Škálovatelná agentura/tým', desc: 'Vybudovat firmu s procesy a najímat další lidi' },
                  { title: 'Časová a pracovní svoboda', desc: 'Podnikat způsobem, který mi dává větší kontrolu nad pracovním časem a způsobem práce.' }
                ].map((item, idx) => {
                  const isSelected = q.mainGoal?.includes(item.title);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChange('mainGoal', `${item.title}: ${item.desc}`)}
                      className={`p-3 text-left rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 hover:border-indigo-500/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                placeholder="Konkrétní cíl klienta (např. vlastní masérské studio, zednické práce, online konzultace)..."
                value={q.mainGoal}
                onChange={e => handleChange('mainGoal', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl p-3 text-xs text-white resize-none"
              />
            </div>
          )}

          {/* STEP 4: CÍLOVÝ MĚSÍČNÍ PŘÍJEM */}
          {currentStep === 4 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" /> Krok 4 z 12: Cílový měsíční příjem (Kč/měsíc)
              </div>
              <p className="text-xs text-slate-400">
                Stanovte realistickou finanční metu pro první fázi (3–6 měsíců).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  '20 000 – 35 000 Kč',
                  '40 000 – 60 000 Kč',
                  '60 000 – 80 000 Kč',
                  '100 000 Kč+'
                ].map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChange('targetMonthlyIncome', `${val} / měsíc`)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      q.targetMonthlyIncome.includes(val)
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{val}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">čistý zisk</div>
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="např. 50 000 – 80 000 Kč / měsíc (postupně s cílem 100 000 Kč)"
                value={q.targetMonthlyIncome}
                onChange={e => handleChange('targetMonthlyIncome', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          )}

          {/* STEP 5: POČÁTEČNÍ KAPITÁL */}
          {currentStep === 5 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" /> Krok 5 z 12: Reálný počáteční kapitál (Tvrdý limit)
              </div>
              <p className="text-xs text-slate-400">
                Kolik reálných peněz má klient k dispozici bez zadlužování? Pokud 0 Kč, AI navrhne výhradně model s nulovými vstupními náklady.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { val: '0 Kč (striktní nula)', desc: 'Pouze existující PC/mobil, bez placeného softwaru a zásob' },
                  { val: 'Do 10 000 Kč', desc: 'Drobný rozpočet na doménu, Canva Pro a základní nástroje' },
                  { val: '50 000 Kč+', desc: 'Prostor pro branding, reklamu nebo nákup specializovaného vybavení' }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChange('startingCapital', item.val)}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      q.startingCapital.includes(item.val)
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.val}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="např. 0 Kč (bezpečný start bez rizika) nebo do 5 000 Kč"
                value={q.startingCapital}
                onChange={e => handleChange('startingCapital', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          )}

          {/* STEP 6: ČASOVÁ KAPACITA */}
          {currentStep === 6 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Krok 6 z 12: Týdenní časová kapacita
              </div>
              <p className="text-xs text-slate-400">
                Kolik reálných hodin týdně může klient věnovat exekuci, získávání klientů a dodávání zakázek?
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { label: '8–12 h / týden', sub: 'Večery a víkendy' },
                  { label: '15–20 h / týden', sub: 'Poloviční úvazek' },
                  { label: '25–30 h / týden', sub: 'Většina týdne' },
                  { label: '40+ h / týden', sub: 'Plné nasazení' }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChange('weeklyTimeCommitment', item.label)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      q.weeklyTimeCommitment.includes(item.label)
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-bold'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="např. 15–20 hodin týdně (cca 2–3 h denně večer + sobota dopoledne)"
                value={q.weeklyTimeCommitment}
                onChange={e => handleChange('weeklyTimeCommitment', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          )}

          {/* STEP 7: PROVOZNÍ MODEL A TYP PRÁCE */}
          {currentStep === 7 && (
            <div className="space-y-5 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Globe className="w-4 h-4" /> Krok 7 z 12: Požadovaný provozní model & typ práce
              </div>
              <p className="text-xs text-slate-400">
                Zvolte provozní model a styl práce. PODNIKAI navrhuje online i fyzické/řemeslné podnikání podle skutečného profilu.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {[
                  {
                    key: 'online',
                    title: '100 % ONLINE',
                    badge: 'Distanční',
                    desc: 'Digitální služby, konzultace, správa. Vyřadí modely vyžadující osobní přítomnost.'
                  },
                  {
                    key: 'hybrid',
                    title: 'HYBRIDNÍ',
                    badge: 'Online + Osobní',
                    desc: 'Kombinace vzdálené práce s osobními schůzkami, workshopy či dodávkou.'
                  },
                  {
                    key: 'offline',
                    title: 'LOKÁLNÍ / OFFLINE',
                    badge: 'Řemesla & služby',
                    desc: 'Služby v terénu, provozovna, řemeslo, práce u zákazníka.'
                  },
                  {
                    key: 'dont_know',
                    title: 'NEVÍM / ENGINE',
                    badge: 'Doporučení AI',
                    desc: 'Objektivní porovnání online i fyzických směrů podle celého profilu.'
                  }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleChange('operatingModel', item.key)}
                    className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                      q.operatingModel === item.key
                        ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500 text-white'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{item.title}</div>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/20 text-purple-300">
                        {item.badge}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Sub-question: JAKÝ TYP PRÁCE VÁM NEJVÍCE VYHOVUJE? */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Preferovaný typ práce (podpoložka kroku č. 7)</span>
                  </div>
                  <span className="text-[10px] text-teal-300">
                    SOURCE OF TRUTH
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PREFERRED_WORK_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleChange('preferredWorkType', opt)}
                      className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                        (!q.customPreferredWorkType?.trim() && (q.preferredWorkType || 'Nevím / ještě nemám vyhraněno') === opt)
                          ? 'bg-teal-600/20 border-teal-500 text-teal-200 font-semibold'
                          : 'bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="pt-1.5 space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 block">
                    Nebo zadejte vlastní text klienta (má vždy přednost před předvolenou možností):
                  </label>
                  <input
                    type="text"
                    placeholder="Např. Truhlářské zakázky z masivu, mobilní masér, doučování, servis kol..."
                    value={q.customPreferredWorkType || ''}
                    onChange={e => handleChange('customPreferredWorkType', e.target.value)}
                    className="w-full bg-black/40 border border-teal-500/30 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {q.customPreferredWorkType?.trim() && (
                    <p className="text-[10px] text-amber-400 font-medium">
                      ✓ Aktivní vlastní specifikace klienta s prioritou: „{q.customPreferredWorkType.trim()}“
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: DOVEDNOSTI A EXPERTÍZA */}
          {currentStep === 8 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Krok 8 z 12: Klíčové dovednosti a silné stránky
              </div>
              <p className="text-xs text-slate-400">
                Naklikejte nebo doplňte dovednosti, které klient reálně ovládá.
              </p>

              {/* Quick skill chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Komunikace a vyjednávání',
                  'Organizace a projektové řízení',
                  'Sociální sítě & Reels video',
                  'Canva grafika & vizuály',
                  'Copywriting & psaní textů',
                  'B2B obchod & sales',
                  'E-mail marketing & automatizace',
                  'Zákaznická podpora',
                  'Notion & procesní systémy',
                  'Účetnictví & finance',
                  'Jazyky & překlady',
                  'Mentoring & doučování'
                ].map((skill, idx) => {
                  const selected = q.coreSkillsAndExpertise.includes(skill);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleItem('coreSkillsAndExpertise', skill)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '} {skill}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic array inputs */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Vybrané a vlastní dovednosti ({q.coreSkillsAndExpertise.length}):</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('coreSkillsAndExpertise')}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    + Přidat vlastní dovednost
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {q.coreSkillsAndExpertise.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={e => handleArrayChange('coreSkillsAndExpertise', idx, e.target.value)}
                        className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        placeholder="Název dovednosti..."
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('coreSkillsAndExpertise', idx)}
                        className="w-7 h-7 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-sm flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: ZÁJMY A OBORY */}
          {currentStep === 9 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <Heart className="w-4 h-4" /> Krok 9 z 12: Zájmy, obory a témata, která klienta baví
              </div>
              <p className="text-xs text-slate-400">
                V jakých oblastech má klient přirozený zájem? Podnikání v blízkém tématu násobně zvyšuje výdrž a úspěšnost.
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Gastro & kavárny',
                  'Zdravý životní styl & fitness',
                  'Udržitelná móda & krása',
                  'Vzdělávání & osobní růst',
                  'E-commerce & online obchody',
                  'Moderní technologie & AI',
                  'Reality & architektura',
                  'Cestování & outdoor',
                  'Psi & domácí mazlíčci',
                  'Kultura, knihy & umění'
                ].map((passion, idx) => {
                  const selected = q.passionsAndInterests.includes(passion);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleItem('passionsAndInterests', passion)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-rose-600/30 border-rose-500 text-rose-300 font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '} {passion}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Vybrané obory ({q.passionsAndInterests.length}):</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('passionsAndInterests')}
                    className="text-rose-400 hover:text-rose-300 text-xs"
                  >
                    + Přidat vlastní obor
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {q.passionsAndInterests.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={e => handleArrayChange('passionsAndInterests', idx, e.target.value)}
                        className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        placeholder="Např. Káva a výběrové pražírny..."
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('passionsAndInterests', idx)}
                        className="w-7 h-7 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-sm flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 10: ČERVENÉ LINIE (ODMÍTÁ) */}
          {currentStep === 10 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-rose-500 text-xs font-bold uppercase tracking-wider">
                <Ban className="w-4 h-4" /> Krok 10 z 12: Červené linie (Čemu se klient striktně vyhýbá)
              </div>
              <p className="text-xs text-slate-400">
                Pravidla, která AI nesmí porušit při tvorbě nabídky a prodejního kanálu.
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Studené telefonování (cold calling)',
                  'Nákup zboží na sklad a fyzická logistika',
                  'Práce po nocích a o víkendech',
                  'Složitá IT instalace a programování',
                  'Osobní schůzky a dojíždění autem',
                  'Prodej rodině a přátelům',
                  'Manuální těžká práce',
                  'Komplikovaná administrativa a licence'
                ].map((redLine, idx) => {
                  const selected = q.strictDislikesAndRedLines.includes(redLine);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleItem('strictDislikesAndRedLines', redLine)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {selected ? '⛔ ' : '+ '} {redLine}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Aktivní červené linie ({q.strictDislikesAndRedLines.length}):</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('strictDislikesAndRedLines')}
                    className="text-rose-400 hover:text-rose-300 text-xs"
                  >
                    + Přidat vlastní červenou linii
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {q.strictDislikesAndRedLines.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={e => handleArrayChange('strictDislikesAndRedLines', idx, e.target.value)}
                        className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        placeholder="Co klient za žádnou cenu nechce dělat..."
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('strictDislikesAndRedLines', idx)}
                        className="w-7 h-7 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-sm flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 11: EXISTUJÍCÍ AKTIVA */}
          {currentStep === 11 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Layers className="w-4 h-4" /> Krok 11 z 12: Existující aktiva a síť kontaktů
              </div>
              <p className="text-xs text-slate-400">
                Co už má klient k dispozici? (LinkedIn kontakty, existující web, kvalitní telefon, známosti v konkrétním odvětví).
              </p>

              <textarea
                rows={5}
                placeholder="Např. Aktivní LinkedIn profil s 800 kontakty z oblasti B2B obchodu. Přístup k MacBooku a iPhone. Osobní kontakty na 5 majitelů e-shopů a 3 agentury, kteří mohou poskytnout první zpětnou vazbu."
                value={q.existingAssetsAndNetwork}
                onChange={e => handleChange('existingAssetsAndNetwork', e.target.value)}
                className="w-full bg-black/40 border border-white/15 focus:border-cyan-500 rounded-xl p-3.5 text-xs text-white resize-none"
              />
            </div>
          )}

          {/* STEP 12: OSOBNÍ PŘEKÁŽKY A DOKONČENÍ */}
          {currentStep === 12 && (
            <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" /> Krok 12 z 12: Osobní překážky, limity a zahájení
              </div>
              <p className="text-xs text-slate-400">
                Závěrečné upřesnění limitací a nastavení zpracovatele pro generování byznys analýzy.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Osobní překážky a specifické podmínky
                </label>
                <textarea
                  rows={3}
                  placeholder="Např. Práce na plný úvazek od 9 do 17 hod., čas na komunikaci s klienty pouze ráno nebo po 17:30. Žádné technické znalosti kódování."
                  value={q.personalConstraints}
                  onChange={e => handleChange('personalConstraints', e.target.value)}
                  className="w-full bg-black/40 border border-white/15 focus:border-emerald-500 rounded-xl p-3 text-xs text-white resize-none"
                />
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Nastavení zpracování v PODNIKAI
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Konzultant / Business architekt
                    </label>
                    <input
                      type="text"
                      value={consultantName}
                      onChange={e => setConsultantName(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                      placeholder="Jméno konzultanta"
                    />
                  </div>

                  <div className="flex items-center pt-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={autoAnalyze}
                        onChange={e => setAutoAnalyze(e.target.checked)}
                        className="rounded border-white/20 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-black/40"
                      />
                      <span className="font-semibold">Po vytvoření ihned spustit AI analýzu</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 border-t border-white/5 flex items-center justify-between">
                  <span>Klient: <strong className="text-white">{q.clientName || 'Není zadáno'}</strong></span>
                  <span>Model: <strong className="text-purple-300">{q.operatingModel.toUpperCase()}</strong></span>
                  <span>Kapitál: <strong className="text-amber-300">{q.startingCapital}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Zpět
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Zavřít
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Průběžně uložit
            </button>

            {currentStep < 12 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all"
              >
                <span>Další krok</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={isCreating}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isCreating ? 'Vytvářím a analyzuji...' : (autoAnalyze ? 'Dokončit a spustit AI analýzu' : 'Dokončit a uložit klienta')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
