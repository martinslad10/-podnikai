import React from 'react';
import { 
  PhoneCall, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Plus, 
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ContactChannel, LeadActivity, PotentialCustomerLead } from '../types';
import { formatCzechDateTime, getChannelLabel } from '../utils/leadActivities';

interface LeadActivityHistoryListProps {
  lead: PotentialCustomerLead;
  onOpenLogger: (mode?: 'log_contact' | 'schedule_only') => void;
}

export const LeadActivityHistoryList: React.FC<LeadActivityHistoryListProps> = ({
  lead,
  onOpenLogger
}) => {
  const activities: LeadActivity[] = Array.isArray(lead.activities) ? lead.activities : [];

  const getChannelIcon = (channel: ContactChannel) => {
    switch (channel) {
      case 'phone':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />;
      case 'sms':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      case 'meeting':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getChannelBg = (channel: ContactChannel) => {
    switch (channel) {
      case 'phone':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'sms':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      case 'email':
        return 'bg-purple-500/15 border-purple-500/30 text-purple-300';
      case 'meeting':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      default:
        return 'bg-slate-800 border-white/10 text-slate-300';
    }
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Historie aktivit ({activities.length})
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenLogger('schedule_only')}
            className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 font-semibold flex items-center gap-1 transition-colors text-[11px]"
          >
            <Calendar className="w-3 h-3" />
            <span>Naplánovat</span>
          </button>
          <button
            onClick={() => onOpenLogger('log_contact')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 transition-colors text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>Zaznamenat kontakt</span>
          </button>
        </div>
      </div>

      {/* Sjednocený aktuální termín kontaktu / schůzky v CRM a Outreach */}
      {(lead.nextContactDate || lead.scheduledAt) && (
        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-sm ${
          lead.status === 'Schůzka'
            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
              lead.status === 'Schůzka' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
            }`}>
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">
                {lead.status === 'Schůzka' ? 'Aktuální termín schůzky:' : 'Aktuální termín dalšího kontaktu:'}
              </span>
              <strong className="text-xs font-bold text-white flex items-center gap-1">
                {formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}
                {lead.status === 'Schůzka' && (
                  <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Schůzka
                  </span>
                )}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenLogger('schedule_only')}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-semibold transition-colors shrink-0"
          >
            Změnit termín
          </button>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-center space-y-2">
          <p className="text-slate-400 text-xs">
            Zatím žádná zaznamenaná aktivita u této firmy.
          </p>
          <p className="text-[11px] text-slate-400">
            Kliknutím na tlačítko výše můžeš zaznamenat první hovor, odeslanou SMS nebo naplánovat termín.
          </p>
        </div>
      ) : (
        <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
          {(() => {
            const activeTerm = lead.nextContactDate || lead.scheduledAt;
            // The newest activity that established the currently active scheduled date
            const activeActivityId = activeTerm 
              ? activities.find(a => (a.historicalPlannedDate || a.nextContactDate || a.scheduledAt) === activeTerm)?.id 
              : null;

            return activities.map((act) => {
              const historicalPlan = act.historicalPlannedDate || act.nextContactDate || act.scheduledAt;
              const isCurrentActivePlan = Boolean(activeTerm && act.id === activeActivityId);

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-4 top-1.5 w-3 h-3 rounded-full bg-slate-900 border-2 border-blue-400 group-first:border-emerald-400 group-first:bg-emerald-500/30" />

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 ${getChannelBg(act.channel)}`}>
                          {getChannelIcon(act.channel)}
                          <span>{getChannelLabel(act.channel)}</span>
                        </span>

                        {/* Reálný kontakt vs Testovací simulace */}
                        {act.isSimulation ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                            TESTOVACÍ SIMULACE
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            Reálný kontakt
                          </span>
                        )}

                        {/* Status change badge */}
                        {act.statusBefore && act.statusBefore !== act.statusAfter ? (
                          <span className="text-[10px] text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                            <span>{act.statusBefore}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-blue-400" />
                            <span className="font-bold text-amber-300">
                              {act.statusAfter} {act.isSimulation && <span className="text-[9px] font-normal text-amber-400/90">(simulace)</span>}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {act.isSimulation ? 'Simulovaný stav: ' : 'Stav: '}
                            <strong className="text-slate-200">{act.statusAfter}</strong>
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatCzechDateTime(act.createdAt)}
                      </span>
                    </div>

                    {/* Result */}
                    <div className="font-semibold text-slate-200 text-xs">
                      {act.result}
                    </div>

                    {/* Note */}
                    {act.note && (
                      <div className="text-[11px] text-slate-300 bg-black/20 p-2 rounded-lg border border-white/5 whitespace-pre-wrap">
                        {act.note}
                      </div>
                    )}

                    {/* Scheduled Date: Current Active vs Historical Snapshot */}
                    {historicalPlan && (
                      isCurrentActivePlan ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/25 font-semibold">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          <span>Termín sjednaný v této aktivitě: <strong>{formatCzechDateTime(historicalPlan)}</strong></span>
                          <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            Aktuálně platný termín
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Původně naplánováno: <span className="font-medium text-slate-300">{formatCzechDateTime(historicalPlan)}</span></span>
                          <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded bg-slate-700/50 text-slate-400 font-medium border border-slate-600/40">
                            Historický plán
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};
