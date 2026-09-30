import React, { useState } from 'react';
import { 
  X, 
  PhoneCall, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  AlertCircle,
  FileText,
  Send
} from 'lucide-react';
import { ContactChannel, LeadActivity, LeadStatus, PotentialCustomerLead, AppExecutionMode } from '../types';
import { getChannelLabel, formatToDatetimeLocal } from '../utils/leadActivities';

interface LeadActivityLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: PotentialCustomerLead;
  onSaveActivity: (
    leadId: string, 
    channel: ContactChannel, 
    result: string, 
    newStatus: LeadStatus, 
    note?: string, 
    nextContactDate?: string,
    isSimulation?: boolean
  ) => void;
  mode?: 'log_contact' | 'schedule_only';
  initialMode?: 'log_contact' | 'schedule_only';
  appMode?: AppExecutionMode;
}

const QUICK_RESULTS: Array<{ label: string; recommendedStatus?: LeadStatus; channel?: ContactChannel }> = [
  { label: '🤝 Dohodnuta schůzka', recommendedStatus: 'Schůzka' },
  { label: '✅ Má velký zájem o nabídku', recommendedStatus: 'Zájem' },
  { label: '📄 Požadavek na zaslání nabídky/podkladů', recommendedStatus: 'Nabídka' },
  { label: '⏰ Zavolat později / zaneprázdněn', recommendedStatus: 'Osloveno' },
  { label: '📵 Nezvednuto / Hlasová schránka', recommendedStatus: 'Osloveno' },
  { label: '💬 Odeslána zpráva / SMS', recommendedStatus: 'Osloveno', channel: 'sms' },
  { label: '✉️ Odeslán e-mail', recommendedStatus: 'Osloveno', channel: 'email' },
  { label: '🎉 Uzavřen obchod / Zákazník', recommendedStatus: 'Zákazník' },
  { label: '❌ Nemá zájem / Odmítnuto', recommendedStatus: 'Odmítnuto' }
];

export const LeadActivityLoggerModal: React.FC<LeadActivityLoggerModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSaveActivity,
  mode,
  initialMode = 'log_contact',
  appMode
}) => {
  const activeMode = mode || initialMode;
  const [isSimulation, setIsSimulation] = useState<boolean>(() => {
    return appMode !== undefined ? appMode === 'test' : true;
  });

  const [channel, setChannel] = useState<ContactChannel>(() => {
    if (lead.phone && lead.phone !== 'Nedostupné') return 'phone';
    if (lead.email && lead.email !== 'Nedostupné') return 'email';
    return 'phone';
  });

  const [result, setResult] = useState<string>(() => {
    return activeMode === 'schedule_only' ? 'Naplánován další kontakt' : '';
  });

  const [status, setStatus] = useState<LeadStatus>(() => {
    if (appMode === 'real') {
      return lead.realStatus || lead.status || 'Nový';
    }
    return lead.simulationStatus || lead.realStatus || lead.status || 'Nový';
  });
  const [note, setNote] = useState<string>('');
  
  // Datetime picker state: YYYY-MM-DDTHH:mm
  const [nextContactDate, setNextContactDate] = useState<string>(() => {
    return formatToDatetimeLocal(lead.nextContactDate || lead.scheduledAt);
  });

  const [includeNextContact, setIncludeNextContact] = useState<boolean>(() => {
    return activeMode === 'schedule_only' || Boolean(lead.nextContactDate || lead.scheduledAt);
  });

  if (!isOpen) return null;

  const handleQuickResultClick = (item: typeof QUICK_RESULTS[0]) => {
    setResult(item.label);
    if (item.recommendedStatus) {
      setStatus(item.recommendedStatus);
      if (item.recommendedStatus === 'Schůzka') {
        setIncludeNextContact(true);
        if (!nextContactDate) {
          handlePresetTomorrow(10);
        }
      }
    }
    if (item.channel) {
      setChannel(item.channel);
    }
  };

  const handleQuickPresetDate = (hoursFromNow: number, specificHour?: number) => {
    const d = new Date();
    if (hoursFromNow === 0 && specificHour !== undefined) {
      d.setHours(specificHour, 0, 0, 0);
    } else if (hoursFromNow > 0) {
      d.setHours(d.getHours() + hoursFromNow);
    }
    setIncludeNextContact(true);
    setNextContactDate(formatToDatetimeLocal(d.toISOString()));
  };

  const handlePresetTomorrow = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setIncludeNextContact(true);
    setNextContactDate(formatToDatetimeLocal(d.toISOString()));
  };

  const handlePresetDaysLater = (days: number, hour: number = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + days);
    d.setHours(hour, 0, 0, 0);
    setIncludeNextContact(true);
    setNextContactDate(formatToDatetimeLocal(d.toISOString()));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalResult = result.trim() || `Kontakt přes ${getChannelLabel(channel)}`;
    if (isSimulation) {
      if (!finalResult.startsWith('TESTOVACÍ SIMULACE:')) {
        const cleanPrefix = finalResult
          .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
          .replace(/^testovací\s+simulace:\s*/i, '');
        const stepLabel = getChannelLabel(channel);
        finalResult = `TESTOVACÍ SIMULACE: ${stepLabel} – ${cleanPrefix}`;
      }
    } else {
      // In real mode, clean any simulation tags from the label
      finalResult = finalResult
        .replace(/^testovací\s+simulace:\s*/i, '')
        .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
        .trim();
    }
    const finalNextContact = includeNextContact && nextContactDate ? new Date(nextContactDate).toISOString() : undefined;
    const finalNote = note.trim()
      ? (isSimulation
          ? (note.includes('[TESTOVACÍ SIMULACE]') ? note.trim() : `[TESTOVACÍ SIMULACE]\n${note.trim()}`)
          : note.replace(/\[TESTOVACÍ SIMULACE\]\n?/g, '').trim())
      : (isSimulation ? '[TESTOVACÍ SIMULACE]' : undefined);

    onSaveActivity(
      lead.id,
      channel,
      finalResult,
      status,
      finalNote,
      finalNextContact,
      isSimulation
    );
    onClose();
  };

  const allStatuses: LeadStatus[] = [
    'Nový',
    'Dnes oslovit',
    'Osloveno',
    'Odpověděl',
    'Zájem',
    'Schůzka',
    'Nabídka',
    'Zákazník',
    'Odmítnuto',
    'Nekontaktovat'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-bold text-white">
                {initialMode === 'schedule_only' ? 'Naplánovat další kontakt' : 'Zaznamenat aktivitu a kontakt'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Firma: <strong className="text-blue-300 font-semibold">{lead.companyName}</strong> ({lead.city})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Execution Mode Banner with Manual Toggle */}
        <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isSimulation
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isSimulation ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
            }`}>
              {isSimulation ? 'TESTOVACÍ SIMULACE' : 'SKUTEČNÝ ZÁPIS (REÁLNÉ CRM)'}
            </span>
            <span className="text-[11px] leading-snug">
              {isSimulation
                ? 'Uloží se bezpečně jako simulace. Neovlivní skutečný CRM stav firmy.'
                : 'Uloží se do skutečného CRM: trvale změní stav firmy, historii i follow-up termín.'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSimulation(!isSimulation)}
            className="text-[10px] underline hover:no-underline font-semibold text-slate-400 hover:text-white whitespace-nowrap self-start sm:self-auto"
          >
            {isSimulation ? 'Zapsat do reálného CRM →' : 'Přepnout na testovací simulaci →'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* 1. Způsob kontaktu (Channel) */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-300">
              1. Způsob kontaktu:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setChannel('phone')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  channel === 'phone'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>Telefon</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  channel === 'sms'
                    ? 'bg-blue-500/25 border-blue-400 text-blue-300 shadow-md shadow-blue-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>SMS</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  channel === 'email'
                    ? 'bg-purple-500/25 border-purple-400 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="w-4 h-4 text-purple-400" />
                <span>E-mail</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('meeting')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  channel === 'meeting'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Schůzka</span>
              </button>
            </div>
          </div>

          {/* 2. Výsledek kontaktu (Result) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-300">
                2. Výsledek kontaktu:
              </label>
              <span className="text-[11px] text-slate-400">Rychlá volba nebo vlastní popis</span>
            </div>

            {/* Quick Result Badges */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {QUICK_RESULTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickResultClick(item)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                    result === item.label
                      ? 'bg-blue-500/30 border-blue-400 text-white font-bold'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="např. Domluvena ukázka na pátek v 10:00 / Pan Novák má zájem o kalkulaci..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 3. Změna stavu leadu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300 flex items-center justify-between">
                <span>3. Simulovaný stav po kontaktu:</span>
                <span className="text-[10px] text-amber-300 font-bold uppercase">Simulace</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-amber-500/30 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-bold"
              >
                {allStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                Uloží se jako testovací simulace. Reálný CRM stav (<strong className="text-slate-200">{lead.realStatus || lead.status}</strong>) zůstane beze změny.
              </p>
            </div>

            {/* Poznámka */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300">
                Poznámka (volitelné):
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Doplňující detail, dohodnutá cena..."
                className="w-full px-3 py-2.5 bg-slate-950/80 border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 4. Naplánovat další kontakt (Follow-up scheduler) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeNextContact}
                  onChange={(e) => setIncludeNextContact(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Naplánovat další kontakt (Follow-up)
                </span>
              </label>

              {includeNextContact && (
                <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                  Zobrazí se v přehledu „Dnes kontaktovat“
                </span>
              )}
            </div>

            {includeNextContact && (
              <div className="space-y-2.5 pt-1">
                {/* Quick date presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetTomorrow(9)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-blue-500/20 text-[10px] font-semibold"
                  >
                    Zítra 09:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetTomorrow(14)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-blue-500/20 text-[10px] font-semibold"
                  >
                    Zítra 14:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetDaysLater(2, 10)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-blue-500/20 text-[10px] font-semibold"
                  >
                    Za 3 dny v 10:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetDaysLater(6, 10)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-blue-500/20 text-[10px] font-semibold"
                  >
                    Příští týden
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="datetime-local"
                    value={nextContactDate}
                    onChange={(e) => setNextContactDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Uložit TESTOVACÍ SIMULACI do CRM</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
