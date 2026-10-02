import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  DollarSign, 
  Clock, 
  Globe, 
  Target, 
  Briefcase, 
  Heart, 
  Ban, 
  Layers, 
  AlertCircle,
  Save,
  Check,
  Edit3,
  Wrench
} from 'lucide-react';
import { BusinessStartClient, BusinessStartQuestionnaire, PREFERRED_WORK_TYPE_OPTIONS, PreferredWorkType } from '../../types';

interface QuestionnaireTabProps {
  client: BusinessStartClient;
  onSaveQuestionnaire: (updatedQ: BusinessStartQuestionnaire) => Promise<void>;
  isSaving: boolean;
}

function normalizeAdminQuestionnaire(q: BusinessStartQuestionnaire): BusinessStartQuestionnaire {
  return {
    ...q,
    coreSkillsAndExpertise: Array.isArray(q.coreSkillsAndExpertise)
      ? q.coreSkillsAndExpertise
      : (typeof q.coreSkillsAndExpertise === 'string' && q.coreSkillsAndExpertise
          ? q.coreSkillsAndExpertise.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    passionsAndInterests: Array.isArray(q.passionsAndInterests)
      ? q.passionsAndInterests
      : (typeof q.passionsAndInterests === 'string' && q.passionsAndInterests
          ? q.passionsAndInterests.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    strictDislikesAndRedLines: Array.isArray(q.strictDislikesAndRedLines)
      ? q.strictDislikesAndRedLines
      : (typeof q.strictDislikesAndRedLines === 'string' && q.strictDislikesAndRedLines
          ? q.strictDislikesAndRedLines.split(',').map(s => s.trim()).filter(Boolean)
          : []),
  };
}

export const BusinessStartQuestionnaireTab: React.FC<QuestionnaireTabProps> = ({
  client,
  onSaveQuestionnaire,
  isSaving
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BusinessStartQuestionnaire>(normalizeAdminQuestionnaire(client.questionnaire));
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync if client changes
  React.useEffect(() => {
    setFormData(normalizeAdminQuestionnaire(client.questionnaire));
  }, [client]);

  const handleFieldChange = (field: keyof BusinessStartQuestionnaire, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getArrayField = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines'): string[] => {
    const val = q[field];
    return Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(',').map(s => s.trim()).filter(Boolean) : []);
  };

  const handleArrayFieldChange = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', index: number, value: string) => {
    setFormData(prev => {
      const arr = [...(Array.isArray(prev[field]) ? (prev[field] as string[]) : (typeof prev[field] === 'string' && prev[field] ? (prev[field] as string).split(',').map(s => s.trim()).filter(Boolean) : []))];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const handleAddArrayItem = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines') => {
    setFormData(prev => {
      const arr = Array.isArray(prev[field]) ? (prev[field] as string[]) : (typeof prev[field] === 'string' && prev[field] ? (prev[field] as string).split(',').map(s => s.trim()).filter(Boolean) : []);
      return {
        ...prev,
        [field]: [...arr, '']
      };
    });
  };

  const handleRemoveArrayItem = (field: 'coreSkillsAndExpertise' | 'passionsAndInterests' | 'strictDislikesAndRedLines', index: number) => {
    setFormData(prev => {
      const arr = Array.isArray(prev[field]) ? (prev[field] as string[]) : (typeof prev[field] === 'string' && prev[field] ? (prev[field] as string).split(',').map(s => s.trim()).filter(Boolean) : []);
      return {
        ...prev,
        [field]: arr.filter((_, i) => i !== index)
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveQuestionnaire(formData);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const q = formData;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Vstupní dotazník klienta (12 otázek)</h3>
          <p className="text-xs text-slate-400">
            Kompletní podklady pro AI analýzu a návrh exekučního byznys plánu.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Check className="w-4 h-4" /> Uloženo
            </span>
          )}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData(client.questionnaire);
                  setIsEditing(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Ukládám...' : 'Uložit změny'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
              Upravit odpovědi
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Q1: Identifikace a kontakty */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <User className="w-4 h-4" />
            <span>Otázka 1: Identifikace a kontakty</span>
          </div>
          {isEditing ? (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Jméno a příjmení</label>
                <input
                  type="text"
                  value={q.clientName}
                  onChange={e => handleFieldChange('clientName', e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={q.clientEmail}
                    onChange={e => handleFieldChange('clientEmail', e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Telefon</label>
                  <input
                    type="text"
                    value={q.clientPhone}
                    onChange={e => handleFieldChange('clientPhone', e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Lokalita / Město</label>
                <input
                  type="text"
                  value={q.location}
                  onChange={e => handleFieldChange('location', e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="font-semibold text-white text-sm">{q.clientName}</div>
              <div className="text-slate-300 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> {q.clientEmail || 'Neuveden'}</div>
              <div className="text-slate-300 flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {q.clientPhone || 'Neuveden'}</div>
              <div className="text-slate-300 flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {q.location}</div>
            </div>
          )}
        </div>

        {/* Q2: Současná situace */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Otázka 2: Současná profesní situace & zkušenosti</span>
          </div>
          {isEditing ? (
            <textarea
              rows={4}
              value={q.currentCareerSituation}
              onChange={e => handleFieldChange('currentCareerSituation', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white resize-none"
              placeholder="Dosavadní zaměstnání, obor, délka praxe..."
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              {q.currentCareerSituation || 'Klient neuvedl podrobnosti o dosavadní kariéře.'}
            </p>
          )}
        </div>

        {/* Q3: Hlavní cíl */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Target className="w-4 h-4" />
            <span>Otázka 3: Hlavní cíl v podnikání</span>
          </div>
          <p className="text-xs text-slate-400">
            Co chce klient podnikáním skutečně dosáhnout? Pomůže AI nastavit vhodný podnikatelský model – online, fyzický, lokální nebo hybridní.
          </p>
          {isEditing ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      onClick={() => handleFieldChange('mainGoal', `${item.title}: ${item.desc}`)}
                      className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-white text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
              <textarea
                rows={3}
                value={q.mainGoal}
                onChange={e => handleFieldChange('mainGoal', e.target.value)}
                placeholder="Konkrétní cíl klienta (např. vlastní masérské studio, zednické práce, online konzultace)..."
                className="w-full bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl p-3 text-xs text-white resize-none"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-200 font-medium leading-relaxed">
              {q.mainGoal}
            </p>
          )}
        </div>

        {/* Q4: Cílový příjem */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <DollarSign className="w-4 h-4" />
            <span>Otázka 4: Cílový měsíční příjem</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={q.targetMonthlyIncome}
              onChange={e => handleFieldChange('targetMonthlyIncome', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
            />
          ) : (
            <div className="text-sm font-bold text-emerald-400">
              {q.targetMonthlyIncome}
            </div>
          )}
        </div>

        {/* Q5: Počáteční kapitál */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <DollarSign className="w-4 h-4" />
              <span>Otázka 5: Reálný počáteční kapitál</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              Tvrdý limit
            </span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={q.startingCapital}
              onChange={e => handleFieldChange('startingCapital', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              placeholder="např. 0 Kč (striktní limit) nebo Do 10 000 Kč"
            />
          ) : (
            <div className="space-y-1">
              <div className="text-sm font-bold text-amber-300">{q.startingCapital}</div>
              <p className="text-[11px] text-slate-400">
                {q.startingCapital.includes('0') 
                  ? '⚠️ Model nesmí vyžadovat žádné počáteční výdaje za software, sklad ani licence.' 
                  : 'Rozpočet je striktním stropem pro investiční doporučení.'}
              </p>
            </div>
          )}
        </div>

        {/* Q6: Týdenní časová kapacita */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Otázka 6: Týdenní časová kapacita</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={q.weeklyTimeCommitment}
              onChange={e => handleFieldChange('weeklyTimeCommitment', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
            />
          ) : (
            <div className="text-sm font-semibold text-sky-300">
              {q.weeklyTimeCommitment}
            </div>
          )}
        </div>

        {/* Q7: Model provozu & preferovaný typ práce (Metodika 12 otázek) */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
              <Globe className="w-4 h-4" />
              <span>Otázka 7: Požadovaný model provozu & preferovaný typ práce</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
              Tvrdý filtr & SOURCE OF TRUTH
            </span>
          </div>

          {/* 7.1 Provozní model */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-300 block">
              7.1 Požadovaný provozní model
            </label>
            {isEditing ? (
              <select
                value={q.operatingModel}
                onChange={e => handleFieldChange('operatingModel', e.target.value as any)}
                className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="online">100% ONLINE (bez nutnosti fyzické přítomnosti u zákazníka)</option>
                <option value="hybrid">HYBRIDNÍ (kombinace online a osobního kontaktu)</option>
                <option value="offline">LOKÁLNÍ / OFFLINE (fyzické služby, řemesla, práce u zákazníka, provozovny)</option>
                <option value="dont_know">NEVÍM / NECHÁM PODNIKAI ROZHODNOUT (porovná online, hybridní i fyzické možnosti)</option>
              </select>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                    q.operatingModel === 'online'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : q.operatingModel === 'hybrid'
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : q.operatingModel === 'offline'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}>
                    {q.operatingModel === 'online' ? '100% ONLINE MODEL' : q.operatingModel === 'hybrid' ? 'HYBRIDNÍ MODEL' : q.operatingModel === 'offline' ? 'LOKÁLNÍ / OFFLINE' : 'NEVÍM / ROZHODNE ENGINE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {q.operatingModel === 'online' 
                    ? 'Přísně vyřazeny fyzické a lokální modely vyžadující osobní přítomnost.'
                    : q.operatingModel === 'offline'
                    ? 'Povolena řemesla, manuální práce, práce u zákazníka, terén a provozovny.'
                    : q.operatingModel === 'hybrid'
                    ? 'Povoleny online i fyzické/lokální modely.'
                    : 'Engine objektivně porovná online, hybridní i fyzické směry dle profilu.'}
                </p>
              </div>
            )}
          </div>

          {/* 7.2 Preferovaný typ práce (podpoložka otázky č. 7) */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-teal-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                7.2 Preferovaný typ práce (podpoložka otázky č. 7)
              </label>
              {q.customPreferredWorkType?.trim() && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  Vlastní text klienta má prioritu
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={q.preferredWorkType || 'Nevím / ještě nemám vyhraněno'}
                  onChange={e => handleFieldChange('preferredWorkType', e.target.value as PreferredWorkType)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {PREFERRED_WORK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Vlastní text klienta (má vždy přednost před předvolenou možností výše):
                  </label>
                  <input
                    type="text"
                    value={q.customPreferredWorkType || ''}
                    onChange={e => handleFieldChange('customPreferredWorkType', e.target.value)}
                    placeholder="Např. Truhlářské zakázky z masivu, mobilní pneuservis, doučování jazyků..."
                    className="w-full bg-black/40 border border-teal-500/30 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {q.customPreferredWorkType?.trim() ? (
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>{q.customPreferredWorkType}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Vlastní text (Priorita)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Předvolba: {q.preferredWorkType || 'Nevím / ještě nemám vyhraněno'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-teal-300">
                    {q.preferredWorkType || 'Nevím / ještě nemám vyhraněno'}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Klíčový parametr pro určení optimálního provozního a profesního směru bez předsudků k fyzickému či digitálnímu světu.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Q8: Dovednosti & expertíza */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              <Briefcase className="w-4 h-4" />
              <span>Otázka 8: Dovednosti & silné stránky</span>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => handleAddArrayItem('coreSkillsAndExpertise')}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                + Přidat dovednost
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              {getArrayField('coreSkillsAndExpertise').map((skill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={skill}
                    onChange={e => handleArrayFieldChange('coreSkillsAndExpertise', i, e.target.value)}
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem('coreSkillsAndExpertise', i)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {getArrayField('coreSkillsAndExpertise').map((skill, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Q9: Zájmy & obory */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
              <Heart className="w-4 h-4" />
              <span>Otázka 9: Zájmy & co klienta baví</span>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => handleAddArrayItem('passionsAndInterests')}
                className="text-[10px] text-rose-400 hover:text-rose-300"
              >
                + Přidat zájem
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              {getArrayField('passionsAndInterests').map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p}
                    onChange={e => handleArrayFieldChange('passionsAndInterests', i, e.target.value)}
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem('passionsAndInterests', i)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {getArrayField('passionsAndInterests').map((p, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Q10: Červené linie / Čemu se vyhýbá */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-500 uppercase tracking-wider">
              <Ban className="w-4 h-4" />
              <span>Otázka 10: Červené linie (Striktně odmítá)</span>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => handleAddArrayItem('strictDislikesAndRedLines')}
                className="text-[10px] text-rose-400 hover:text-rose-300"
              >
                + Přidat červenou linii
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              {getArrayField('strictDislikesAndRedLines').map((dislike, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dislike}
                    onChange={e => handleArrayFieldChange('strictDislikesAndRedLines', i, e.target.value)}
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem('strictDislikesAndRedLines', i)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {getArrayField('strictDislikesAndRedLines').map((dislike, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800/40 font-medium">
                  🚫 {dislike}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Q11: Existující aktiva & síť */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Otázka 11: Existující aktiva, síť kontaktů & výhody</span>
          </div>
          {isEditing ? (
            <textarea
              rows={3}
              value={q.existingAssetsAndNetwork}
              onChange={e => handleFieldChange('existingAssetsAndNetwork', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white resize-none"
              placeholder="Vybavení, sledující, kontakty, licence..."
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              {q.existingAssetsAndNetwork || 'Žádná specifická aktiva neuvedena.'}
            </p>
          )}
        </div>

        {/* Q12: Osobní překážky & limity */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" />
            <span>Otázka 12: Osobní překážky, omezení & podmínky</span>
          </div>
          {isEditing ? (
            <textarea
              rows={3}
              value={q.personalConstraints}
              onChange={e => handleFieldChange('personalConstraints', e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white resize-none"
              placeholder="Děti, práce na směny, bez auta, jazyková bariéra..."
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              {q.personalConstraints || 'Žádná významná omezení neuvedena.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
