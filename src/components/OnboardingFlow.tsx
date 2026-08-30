import React, { useState } from 'react';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  User, 
  DollarSign, 
  Clock, 
  Briefcase, 
  Heart, 
  Ban, 
  Globe, 
  MapPin, 
  Target,
  Zap
} from 'lucide-react';
import { EntrepreneurStatus, OnlineOfflinePreference, UserProfile } from '../types';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile) => void;
  initialProfile?: UserProfile | null;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, initialProfile }) => {
  const [step, setStep] = useState<number>(1);
  const totalSteps = 4;

  // Form State
  const [name, setName] = useState<string>(initialProfile?.name || '');
  const [status, setStatus] = useState<EntrepreneurStatus>(initialProfile?.status || 'starting');
  const [goal, setGoal] = useState<string>(initialProfile?.goal || '');
  const [targetIncome, setTargetIncome] = useState<string>(initialProfile?.targetIncome || '80 000 Kč / měsíc');
  const [startingBudget, setStartingBudget] = useState<string>(initialProfile?.startingBudget || 'Do 20 000 Kč');
  const [availableTime, setAvailableTime] = useState<string>(initialProfile?.availableTime || '10–15 h týdně (při práci)');
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills || ['Komunikace s lidmi', 'Organizace & plánování']);
  const [customSkill, setCustomSkill] = useState<string>('');
  const [passions, setPassions] = useState<string[]>(initialProfile?.passions || ['Technologie & inovace']);
  const [customPassion, setCustomPassion] = useState<string>('');
  const [dislikes, setDislikes] = useState<string[]>(initialProfile?.dislikes || ['Cold calling (studené volání)', 'Složitá byrokracie']);
  const [customDislike, setCustomDislike] = useState<string>('');
  const [onlineOffline, setOnlineOffline] = useState<OnlineOfflinePreference>(initialProfile?.onlineOffline || 'hybrid');
  const [businessTypeInterest, setBusinessTypeInterest] = useState<string>(initialProfile?.businessTypeInterest || 'Služby s vysokou přidanou hodnotou');
  const [currentProject, setCurrentProject] = useState<string>(initialProfile?.currentProject || '');
  const [location, setLocation] = useState<string>(initialProfile?.location || 'Česká republika, Praha');

  // Pre-configured tag options
  const defaultSkillsList = [
    'Komunikace s lidmi',
    'Organizace & plánování',
    'Prodej & vyjednávání',
    'Marketing & sociální sítě',
    'IT, software & web',
    'Grafika & vizuální tvorba',
    'Manuální zručnost / řemeslo',
    'Finance & kalkulace',
    'Copywriting & psaní',
    'Řízení týmu & projektů'
  ];

  const defaultPassionsList = [
    'Technologie & inovace',
    'Auta & motorismus',
    'Fitness, sport & zdraví',
    'Gastro & káva',
    'Design & architektura',
    'Vzdělávání & mentoring',
    'Cestování & zážitky',
    'Příroda & ekologie',
    'E-commerce & produkty',
    'Reality & nemovitosti'
  ];

  const defaultDislikesList = [
    'Cold calling (studené volání)',
    'Složitá byrokracie',
    'Fyzická těžká práce',
    'Práce o víkendech',
    'Vysoké finanční riziko',
    'Skladování zboží',
    'Programování / kódování',
    'Nekonečné porady'
  ];

  const toggleSkill = (s: string) => {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !skills.includes(customSkill.trim())) {
      setSkills(prev => [...prev, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const togglePassion = (p: string) => {
    setPassions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const addCustomPassion = () => {
    if (customPassion.trim() && !passions.includes(customPassion.trim())) {
      setPassions(prev => [...prev, customPassion.trim()]);
      setCustomPassion('');
    }
  };

  const toggleDislike = (d: string) => {
    setDislikes(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const addCustomDislike = () => {
    if (customDislike.trim() && !dislikes.includes(customDislike.trim())) {
      setDislikes(prev => [...prev, customDislike.trim()]);
      setCustomDislike('');
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      const profile: UserProfile = {
        name: name.trim() || 'Podnikatel',
        status,
        goal: goal.trim() || 'Vybudovat ziskové a stabilní podnikání',
        targetIncome,
        startingBudget,
        availableTime,
        skills: skills.length > 0 ? skills : ['Všeobecné obchodní dovednosti'],
        passions: passions.length > 0 ? passions : ['Vlastní seberealizace'],
        dislikes: dislikes.length > 0 ? dislikes : ['Ztráta času'],
        onlineOffline,
        businessTypeInterest,
        location: location.trim() || 'Česká republika',
        currentProject: currentProject.trim() || (status === 'running' ? 'Aktivní byznys' : 'Hledám ideální nápad'),
        createdAt: initialProfile?.createdAt || new Date().toISOString()
      };
      onComplete(profile);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
        
        {/* Progress Bar & Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              Krok {step} z {totalSteps}
            </span>
            <span className="text-slate-300">
              {step === 1 && 'Základní situace & cíl'}
              {step === 2 && 'Finance & časové možnosti'}
              {step === 3 && 'Dovednosti, zájmy a limity'}
              {step === 4 && 'Preference & lokalita'}
            </span>
          </div>

          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Basic Status & Goal */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-1">
                Ahoj! Jaká je tvá aktuální situace?
              </h2>
              <p className="text-sm text-slate-400">
                PodnikAI přizpůsobí veškeré rady a plány přesně tvému výchozímu bodu.
              </p>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Tvé jméno nebo přezdívka
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="input-onboarding-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="např. Martin, Tereza, Tomáš"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>
            </div>

            {/* Starting vs Running Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Podnikáš už, nebo teprve začínáš?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  id="btn-status-starting"
                  onClick={() => setStatus('starting')}
                  className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md ${
                    status === 'starting'
                      ? 'bg-blue-500/15 border-blue-500/60 text-white shadow-lg shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-200">Teprve začínám</span>
                    {status === 'starting' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hledám nápad, ověřuji možnosti nebo chci první platící zákazníky.
                  </p>
                </button>

                <button
                  type="button"
                  id="btn-status-running"
                  onClick={() => setStatus('running')}
                  className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md ${
                    status === 'running'
                      ? 'bg-blue-500/15 border-blue-500/60 text-white shadow-lg shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-200">Už aktivně podnikám</span>
                    {status === 'running' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mám živnost/firmu, chci zvýšit tržby, marže nebo zefektivnit systém.
                  </p>
                </button>
              </div>
            </div>

            {/* Main Goal Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Čeho chceš podnikáním dosáhnout? (Hlavní cíl)
              </label>
              <div className="relative">
                <Target className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <textarea
                  id="input-onboarding-goal"
                  rows={2}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="např. Odejít z korporátu do 6 měsíců, mít svobodu v čase a stabilní příjem 100k měsíčně..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Target Income, Budget & Time */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-1">
                Kapacita & Finanční rámec
              </h2>
              <p className="text-sm text-slate-400">
                Aby měly plány smysl, musíme pracovat s reálnými možnostmi.
              </p>
            </div>

            {/* Target Income Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Cílový měsíční příjem (čistý zisk)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  '30 000 – 50 000 Kč',
                  '50 000 – 80 000 Kč',
                  '80 000 – 150 000 Kč',
                  '200 000+ Kč'
                ].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setTargetIncome(inc)}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                      targetIncome === inc
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {inc}
                  </button>
                ))}
              </div>
            </div>

            {/* Starting Budget Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Počáteční rozpočet na start
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  '0 Kč (pouze vlastní čas)',
                  'Do 10 000 Kč',
                  'Do 30 000 Kč',
                  'Do 100 000 Kč',
                  '250 000 Kč+',
                  'Není limitující faktor'
                ].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setStartingBudget(b)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                      startingBudget === b
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Time Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Kolik času můžeš podnikání věnovat?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  '5–10 h / týden (večery/víkendy)',
                  '15–25 h / týden (částečný úvazek)',
                  '40+ h / týden (plný úvazek naplno)'
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAvailableTime(t)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                      availableTime === t
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Skills, Passions, Dislikes */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-1">
                Dovednosti, zájmy a co nechceš dělat
              </h2>
              <p className="text-sm text-slate-400">
                Nejlepší byznys vychází z toho, co umíš, co tě baví – a vyhýbá se tomu, co nesnášíš.
              </p>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Tvé zkušenosti a silné stránky (vyber více)
              </label>
              <div className="flex flex-wrap gap-2">
                {defaultSkillsList.map((s) => {
                  const active = skills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        active
                          ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {active && '✓ '}
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="+ Přidat vlastní dovednost..."
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                  className="flex-1 px-3 py-1.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-semibold text-slate-200"
                >
                  Přidat
                </button>
              </div>
            </div>

            {/* Passions / Interests */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Co tě baví a o jaká témata se zajímáš?
              </label>
              <div className="flex flex-wrap gap-2">
                {defaultPassionsList.map((p) => {
                  const active = passions.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePassion(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        active
                          ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {active && '✓ '}
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dislikes / Anti-goals */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                Co rozhodně NECHCEŠ dělat? (AI se tomu vyhne)
              </label>
              <div className="flex flex-wrap gap-2">
                {defaultDislikesList.map((d) => {
                  const active = dislikes.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDislike(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        active
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {active && '✕ '}
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Preferences, Business Type & Location */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-1">
                Preference modelu & Lokalita
              </h2>
              <p className="text-sm text-slate-400">
                Poslední detaily pro přesné zacílení nápadů a strategií.
              </p>
            </div>

            {/* Online / Offline preference */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Online vs. Offline preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'online', label: '100% Online (Remote)' },
                  { id: 'offline', label: 'Lokální / Offline' },
                  { id: 'hybrid', label: 'Hybridní (kombinace)' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOnlineOffline(item.id as OnlineOfflinePreference)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      onlineOffline === item.id
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Business type interest */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Typ podnikání, který tě nejvíce láká
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Služby s vysokou přidanou hodnotou',
                  'E-commerce & prodej produktů',
                  'Digitální produkty & online kurzy',
                  'B2B agentura & poradenství',
                  'Lokální řemeslo / auto-moto / servis',
                  'Zprostředkování & affiliate'
                ].map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBusinessTypeInterest(bt)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      businessTypeInterest === bt
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Project / Idea (Optional) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Máš už konkrétní nápad nebo projekt? (Volitelné)
              </label>
              <input
                type="text"
                value={currentProject}
                onChange={(e) => setCurrentProject(e.target.value)}
                placeholder="např. Mobilní detailing aut v Praze, E-shop s doplňky stravy..."
                className="w-full px-4 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60"
              />
            </div>

            {/* Location Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Země a město působení
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="např. Česko – Praha, Brno, Ostrava..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            id="btn-onboarding-next"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
          >
            <span>{step === totalSteps ? 'Dokončit & Přejít na Dashboard' : 'Pokračovat'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
