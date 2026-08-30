import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  RotateCw, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Users, 
  Megaphone, 
  Calendar, 
  ArrowRight,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Markdown from 'react-markdown';
import { BusinessPlan, UserProfile } from '../types';
import { generateBusinessPlan } from '../services/api';

interface BusinessPlanViewProps {
  userProfile: UserProfile;
  currentProject: string;
  businessPlan: BusinessPlan | null;
  setBusinessPlan: (plan: BusinessPlan) => void;
  onSetFirstActionAsDailyStep: (actionText: string) => void;
  onNavigateToChatWithContext: (topic: string) => void;
}

export const BusinessPlanView: React.FC<BusinessPlanViewProps> = ({
  userProfile,
  currentProject,
  businessPlan,
  setBusinessPlan,
  onSetFirstActionAsDailyStep,
  onNavigateToChatWithContext
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('all');
  const [projectNameInput, setProjectNameInput] = useState(currentProject || 'Podnikatelský projekt');

  const fetchPlan = async (nameToUse?: string) => {
    setIsLoading(true);
    try {
      const plan = await generateBusinessPlan(
        userProfile,
        nameToUse || projectNameInput || currentProject || 'Můj byznys projekt',
        `Podnikání se zaměřením na ${userProfile.businessTypeInterest} v lokalitě ${userProfile.location}. Cíl: ${userProfile.targetIncome}.`
      );
      setBusinessPlan(plan);
    } catch (err) {
      console.error('Failed to generate business plan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!businessPlan) {
      fetchPlan(currentProject);
    }
  }, [currentProject]);

  const handleCopyFullPlan = () => {
    if (!businessPlan) return;
    const text = `
PODNIKATELSKÝ PLÁN: ${businessPlan.projectName}
Vytvořeno v PODNIKAI (${new Date(businessPlan.generatedAt).toLocaleDateString()})

SHRNUTÍ:
${businessPlan.summary}

1. CO UDĚLAT JAKO PRVNÍ:
${businessPlan.firstAction}

2. DALŠÍ KROKY (ADMINISTRATIVA & NÁSTROJE):
${businessPlan.nextSteps}

3. NABÍDKA & USP:
${businessPlan.offer}

4. CENOTVORBA & MARŽE:
${businessPlan.pricing}

5. NÁKLADY & ROZPOČET:
${businessPlan.costs}

6. ZÍSKÁVÁNÍ ZÁKAZNÍKŮ:
${businessPlan.customerAcquisition}

7. MARKETING & VIDITELNOST:
${businessPlan.marketing}

8. PLÁN NA PRVNÍ MĚSÍC:
${businessPlan.firstMonthPlan}

9. STRATEGIE DALŠÍHO RŮSTU:
${businessPlan.growthStrategy}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = businessPlan ? [
    {
      id: 'firstAction',
      title: '1. Co udělat jako první (Validace do 7 dnů)',
      icon: <Zap className="w-4 h-4 text-blue-400" />,
      content: businessPlan.firstAction,
      highlight: true
    },
    {
      id: 'nextSteps',
      title: '2. Další kroky (Živnost & Administrativa ČR)',
      icon: <CheckCircle2 className="w-4 h-4 text-indigo-400" />,
      content: businessPlan.nextSteps
    },
    {
      id: 'offer',
      title: '3. Nabídka & Unikátní hodnota (USP)',
      icon: <Target className="w-4 h-4 text-blue-400" />,
      content: businessPlan.offer
    },
    {
      id: 'pricing',
      title: '4. Cenotvorba & Marže v Kč',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      content: businessPlan.pricing
    },
    {
      id: 'costs',
      title: '5. Náklady & Počáteční investice',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      content: businessPlan.costs
    },
    {
      id: 'customerAcquisition',
      title: '6. Získávání prvních zákazníků (1–50)',
      icon: <Users className="w-4 h-4 text-indigo-400" />,
      content: businessPlan.customerAcquisition
    },
    {
      id: 'marketing',
      title: '7. Marketing & Lokální viditelnost',
      icon: <Megaphone className="w-4 h-4 text-blue-400" />,
      content: businessPlan.marketing
    },
    {
      id: 'firstMonthPlan',
      title: '8. Akční plán na první měsíc (Týdny 1–4)',
      icon: <Calendar className="w-4 h-4 text-emerald-400" />,
      content: businessPlan.firstMonthPlan
    },
    {
      id: 'growthStrategy',
      title: '9. Strategie dalšího růstu & Škálování',
      icon: <TrendingUp className="w-4 h-4 text-teal-400" />,
      content: businessPlan.growthStrategy
    }
  ] : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Banner */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[90px] pointer-events-none rounded-full" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30">
              <FileText className="w-3.5 h-3.5" />
              <span>Praktický 9-krokový byznys plán</span>
            </div>
            <h1 className="font-heading text-3xl font-extrabold text-white">
              Podnikatelský plán: <span className="text-blue-400">{businessPlan?.projectName || projectNameInput}</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Konkrétní plán bez obecných frází přizpůsobený pro český trh, tvůj rozpočet ({userProfile.startingBudget}) a čas ({userProfile.availableTime}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-copy-plan"
              onClick={handleCopyFullPlan}
              disabled={!businessPlan}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 backdrop-blur-md"
            >
              {copied ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Plán zkopírován' : 'Kopírovat celý plán'}</span>
            </button>

            <button
              id="btn-regenerate-plan"
              onClick={() => fetchPlan()}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Sestavuji plán...' : 'Přeplánovat s AI'}</span>
            </button>
          </div>
        </div>

        {/* Project Name customizer */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3 relative z-10">
          <span className="text-xs text-slate-400 shrink-0">Změnit název projektu:</span>
          <input
            type="text"
            value={projectNameInput}
            onChange={(e) => setProjectNameInput(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => fetchPlan(projectNameInput)}
            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-semibold backdrop-blur-md transition-colors"
          >
            Přegenerovat pro tento název
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4 backdrop-blur-xl">
          <Sparkles className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
          <p className="font-heading text-lg font-bold text-white">
            PODNIKAI vytváří komplexní 9-krokový plán...
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Počítáme cenotvorbu, marketingový mix a kroky pro první měsíc podle tvých parametrů.
          </p>
        </div>
      )}

      {/* Plan Content */}
      {!isLoading && businessPlan && (
        <div className="space-y-6">
          
          {/* Executive Summary Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
            <h2 className="font-heading text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <span>Vize a shrnutí projektu</span>
            </h2>
            <div className="prose-dark text-sm leading-relaxed">
              <Markdown>{businessPlan.summary}</Markdown>
            </div>
          </div>

          {/* Quick Filter Section Tabs */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => setActiveSection('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'all'
                  ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/25'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 backdrop-blur-md'
              }`}
            >
              Všechny sekce (9)
            </button>
            {sections.map((sec, idx) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === sec.id
                    ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/25'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 backdrop-blur-md'
                }`}
              >
                {idx + 1}. {sec.title.split('(')[0].replace(/^\d+\.\s*/, '')}
              </button>
            ))}
          </div>

          {/* Render Sections */}
          <div className="space-y-5">
            {sections
              .filter(sec => activeSection === 'all' || activeSection === sec.id)
              .map((sec) => (
                <div
                  key={sec.id}
                  className={`rounded-3xl p-6 sm:p-7 backdrop-blur-xl transition-all ${
                    sec.highlight
                      ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/40 shadow-xl shadow-blue-500/10'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-center">
                        {sec.icon}
                      </div>
                      <h3 className="font-heading text-base sm:text-lg font-bold text-slate-100">
                        {sec.title}
                      </h3>
                    </div>

                    {/* Specific Action for Section 1: Set as today's step */}
                    {sec.id === 'firstAction' && (
                      <button
                        id="btn-set-first-action-as-daily"
                        onClick={() => onSetFirstActionAsDailyStep(sec.content)}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all"
                      >
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span>Nastavit jako Dnešní krok</span>
                      </button>
                    )}
                  </div>

                  <div className="prose-dark text-sm leading-relaxed">
                    <Markdown>{sec.content}</Markdown>
                  </div>

                  {/* Ask AI about this specific section */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                    <button
                      onClick={() => onNavigateToChatWithContext(`Chci podrobněji rozpracovat sekci "${sec.title}" pro můj projekt ${businessPlan.projectName}.`)}
                      className="text-xs text-slate-400 hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 font-medium"
                    >
                      <span>Probrat tuto sekci v AI chatu</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>

        </div>
      )}

    </div>
  );
};
