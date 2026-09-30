import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  Clock, 
  Mail, 
  PhoneCall, 
  MessageSquare, 
  FileText, 
  Sparkles, 
  Calendar, 
  Building2, 
  MapPin, 
  ChevronRight, 
  Lock, 
  ExternalLink,
  Users,
  Briefcase,
  Layers,
  ArrowRight,
  AlertTriangle,
  X,
  Copy,
  Info
} from 'lucide-react';
import { 
  PotentialCustomerLead, 
  LeadStatus, 
  ContactChannel, 
  AppExecutionMode, 
  UserProfile 
} from '../types';
import { 
  DailyPlanLeadItem, 
  DailyPlanCounters, 
  getDailyPlanItems, 
  getDailyPlanCounters 
} from '../utils/dailyPlan';
import { formatCzechDateTime } from '../utils/leadActivities';
import { OutreachStudio } from './OutreachStudio';
import { LeadActivityLoggerModal } from './LeadActivityLoggerModal';

interface DailyOutreachPlanProps {
  leads?: PotentialCustomerLead[];
  userProfile?: UserProfile | null;
  concreteOffer?: string;
  businessDirectionTitle?: string;
  onUpdateLead?: (updatedLead: PotentialCustomerLead) => void;
  onUpdateLeadStatus?: (leadId: string, status: LeadStatus, note?: string) => void;
  onSaveLeadActivity?: (
    leadId: string,
    channel: ContactChannel,
    result: string,
    newStatus: LeadStatus,
    note?: string,
    nextContactDate?: string,
    isSimulation?: boolean
  ) => void;
  onNavigateToFinder?: (leadId?: string) => void;
  onNavigateToFollowUp?: () => void;
  appMode?: AppExecutionMode;
}

export const DailyOutreachPlan: React.FC<DailyOutreachPlanProps> = ({
  leads = [],
  userProfile,
  concreteOffer,
  businessDirectionTitle,
  onUpdateLead,
  onUpdateLeadStatus,
  onSaveLeadActivity,
  onNavigateToFinder,
  onNavigateToFollowUp,
  appMode = 'test'
}) => {
  // Modal for full Outreach Studio
  const [selectedLeadForStudio, setSelectedLeadForStudio] = useState<PotentialCustomerLead | null>(null);

  // Modal for logging activity / scheduling
  const [activeModalLead, setActiveModalLead] = useState<{
    lead: PotentialCustomerLead;
    mode: 'log_contact' | 'schedule_only';
  } | null>(null);

  // Quick notice banner (e.g. copied to clipboard / test mode reminder)
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNoticeMsg(msg);
    setTimeout(() => setNoticeMsg(null), 4000);
  };

  // Compute daily plan items and counters
  const now = useMemo(() => new Date(), []);
  const planItems = useMemo(() => getDailyPlanItems(leads, appMode, now), [leads, appMode, now]);
  const counters: DailyPlanCounters = useMemo(() => getDailyPlanCounters(leads, appMode, now), [leads, appMode, now]);

  const handleLeadUpdate = (updatedLead: PotentialCustomerLead) => {
    if (onUpdateLead) {
      onUpdateLead(updatedLead);
    }
  };

  const handleActivitySave = (
    leadId: string,
    channel: ContactChannel,
    result: string,
    newStatus: LeadStatus,
    note?: string,
    nextContactDate?: string,
    isSimulation?: boolean
  ) => {
    if (onSaveLeadActivity) {
      onSaveLeadActivity(leadId, channel, result, newStatus, note, nextContactDate, isSimulation);
    }
    setActiveModalLead(null);
  };

  return (
    <div id="daily-outreach-plan-section" className="rounded-3xl bg-slate-900/90 border border-white/10 p-5 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 blur-[90px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[90px] pointer-events-none rounded-full" />

      {/* 1. Header & Title */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shadow-lg shadow-amber-500/10">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-xl font-bold text-white tracking-tight">
                  DNEŠNÍ PLÁN
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  counters.todayToContact > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}>
                  🔥 Dnes kontaktovat: {counters.todayToContact}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Připravený seznam firem k okamžitému oslovení a naplánované follow-upy pro dnešní den
              </p>
            </div>
          </div>
        </div>

        {/* Global Mode Indicator */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
            appMode === 'real'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10'
          }`}>
            <span className={`w-2 h-2 rounded-full ${appMode === 'real' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{appMode === 'real' ? 'REÁLNÝ REŽIM (zápis do CRM)' : 'TESTOVACÍ REŽIM (simulace)'}</span>
          </div>

          {onNavigateToFollowUp && (
            <button
              onClick={onNavigateToFollowUp}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>📋 Všechny follow-upy</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* 2. POČÍTADLA (Metric counters requested in prompt) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Dnes kontaktovat */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-300 text-xs font-medium">
            <span>Dnes kontaktovat</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-heading">
            {counters.todayToContact}
          </div>
          <div className="text-[10px] text-amber-400/80 font-medium mt-0.5">
            připraveno k oslovení
          </div>
        </div>

        {/* Hotovo */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-medium">
            <span>Hotovo dnes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-heading">
            {counters.doneToday}
          </div>
          <div className="text-[10px] text-emerald-400/80 font-medium mt-0.5">
            dnes odbaveno
          </div>
        </div>

        {/* Čeká na follow-up */}
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-300 text-xs font-medium">
            <span>Čeká na follow-up</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-heading">
            {counters.waitingForFollowUp}
          </div>
          <div className="text-[10px] text-blue-400/80 font-medium mt-0.5">
            budoucí termíny
          </div>
        </div>

        {/* Schůzky */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-medium">
            <span>Schůzky</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-heading">
            {counters.meetings}
          </div>
          <div className="text-[10px] text-indigo-400/80 font-medium mt-0.5">
            domluvená jednání
          </div>
        </div>

        {/* Nabídky */}
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-purple-300 text-xs font-medium">
            <span>Nabídky</span>
            <Briefcase className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-heading">
            {counters.quotes}
          </div>
          <div className="text-[10px] text-purple-400/80 font-medium mt-0.5">
            otevřené cenové nabídky
          </div>
        </div>
      </div>

      {/* Floating Notice / Toast */}
      {noticeMsg && (
        <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{noticeMsg}</span>
          </div>
          <button onClick={() => setNoticeMsg(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. SEZNAM FIREM K DNEŠNÍMU OSLOVENÍ */}
      {planItems.length === 0 ? (
        <div className="py-10 px-4 rounded-2xl bg-slate-950/60 border border-white/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-100">
            Dnešní plán je kompletně splněn!
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Všechny dnešní kontakty a follow-upy byly odbavené. Můžeš vyhledat nové potenciální zákazníky nebo naplánovat další kroky v CRM.
          </p>
          {onNavigateToFinder && (
            <div className="pt-2">
              <button
                onClick={() => onNavigateToFinder()}
                className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all"
              >
                Vyhledat další zákazníky
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {planItems.map((item) => {
            const lead = item.lead;
            const currentRealStatus = lead.realStatus || lead.status || 'Nový';
            const displayStatus = appMode === 'test' && lead.simulationStatus ? lead.simulationStatus : currentRealStatus;

            // Prepared direct email link
            const emailSubject = item.preparedSubject || `Dotaz ke spolupráci – ${lead.companyName}`;
            const emailBody = item.preparedContent || `Dobrý den,\n\nobracím se na vás ohledně ${lead.companyName}...`;
            const mailtoUrl = `mailto:${lead.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

            // Prepared phone link
            const cleanPhone = lead.phone ? lead.phone.replace(/\s+/g, '') : '';
            const telUrl = `tel:${cleanPhone}`;

            return (
              <div
                key={lead.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 relative ${
                  item.isOverdue
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-slate-950/70 border-white/10 hover:border-amber-500/30'
                }`}
              >
                {/* Row 1: Priority rank, Company Name, CRM Status, Channel & Recommended Time */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Rank Badge */}
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-heading font-black text-sm text-slate-200 shrink-0">
                      {item.priorityRank}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-bold text-white text-base">
                          {lead.companyName}
                        </h4>

                        {/* CRM Status Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10">
                          {displayStatus}
                        </span>

                        {appMode === 'test' && lead.simulationStatus && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Simulace: {lead.simulationStatus}
                          </span>
                        )}

                        {/* Priority / Criteria Match Badge (Strictly prioritized order, never purchase probability) */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30" title="Doporučené pořadí na základě shody s kritérii">
                          {item.priorityLabel} • Shoda {lead.fitScore}/100
                        </span>

                        {item.isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                            Po termínu
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {lead.industry}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {lead.city}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Channel & Timing Box */}
                  <div className="flex items-center gap-2 sm:self-start flex-wrap">
                    {/* Recommended Channel Badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                      item.recommendedChannel === 'email'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : item.recommendedChannel === 'whatsapp'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {item.recommendedChannel === 'email' && <Mail className="w-3.5 h-3.5" />}
                      {item.recommendedChannel === 'phone' && <PhoneCall className="w-3.5 h-3.5" />}
                      {item.recommendedChannel === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5" />}
                      <span>{item.recommendedChannelLabel}</span>
                    </div>

                    {/* Recommended Time Slot */}
                    <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.recommendedTime}</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Factual Reason for Recommendation (Strictly factual, no speculative sales claims) */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 font-medium">Důvod doporučení:</span>{' '}
                    <strong className="text-slate-200">„{item.recommendationReason}“</strong>
                  </div>
                </div>

                {/* Row 3: Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Otevřít Outreach / Otevřít scénář button */}
                    <button
                      id={`btn-open-outreach-${lead.id}`}
                      type="button"
                      onClick={() => setSelectedLeadForStudio(lead)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{item.recommendedChannel === 'phone' ? 'Otevřít scénář' : 'Otevřít Outreach'}</span>
                    </button>

                    {/* 2. Přímý reálný kontakt: ODESLAT E-MAIL (pouze pokud existuje veřejný e-mail) */}
                    {item.hasPublicEmail && (
                      appMode === 'real' ? (
                        <a
                          id={`btn-send-email-real-${lead.id}`}
                          href={mailtoUrl}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title={`Odeslat e-mail na ${lead.email}`}
                        >
                          <Mail className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Odeslat e-mail</span>
                        </a>
                      ) : (
                        <button
                          id={`btn-send-email-test-${lead.id}`}
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(lead.email);
                            showNotice(`E-mail (${lead.email}) byl zkopírován. V testovacím režimu je přímý poštovní klient uzamčen.`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="V testovacím režimu je přímé odeslání uzamčeno – kliknutím zkopírujete e-mail"
                        >
                          <Lock className="w-3 h-3 text-amber-400" />
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>Zkopírovat e-mail</span>
                        </button>
                      )
                    )}

                    {/* 3. Přímý reálný kontakt: ZAVOLAT (pouze pokud je telefon k dispozici) */}
                    {item.hasPhone && (
                      appMode === 'real' ? (
                        <a
                          id={`btn-call-real-${lead.id}`}
                          href={telUrl}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title={`Zavolat na ${lead.phone}`}
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Zavolat</span>
                        </a>
                      ) : (
                        <button
                          id={`btn-call-test-${lead.id}`}
                          type="button"
                          onClick={() => {
                            if (lead.phone) {
                              navigator.clipboard?.writeText(lead.phone.replace(/\s+/g, ''));
                              showNotice(`Telefonní číslo (${lead.phone}) bylo zkopírováno. V testovacím režimu je přímé volání uzamčeno.`);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="V testovacím režimu je volání uzamčeno – kliknutím zkopírujete číslo"
                        >
                          <Lock className="w-3 h-3 text-amber-400" />
                          <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                          <span>Zkopírovat číslo</span>
                        </button>
                      )
                    )}
                  </div>

                  {/* 4. Tlačítko: Zapsat kontakt do CRM */}
                  <button
                    id={`btn-log-activity-${lead.id}`}
                    type="button"
                    onClick={() => setActiveModalLead({ lead, mode: 'log_contact' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      appMode === 'real'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>{appMode === 'real' ? 'Zapsat kontakt do CRM' : 'Zapsat TESTOVACÍ SIMULACI'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Outreach Studio in-place viewer/editor */}
      {selectedLeadForStudio && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-heading font-bold text-white text-base sm:text-lg">
                    Outreach Studio: {selectedLeadForStudio.companyName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Konkrétní 4-kroková sekvence oslovení s personalizovanými argumenty
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToFinder && (
                  <button
                    onClick={() => {
                      const id = selectedLeadForStudio.id;
                      setSelectedLeadForStudio(null);
                      onNavigateToFinder(id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1 border border-white/10"
                    title="Otevřít v modulu Najdi zákazníky"
                  >
                    <span>Přejít do Najdi zákazníky</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                <button
                  onClick={() => setSelectedLeadForStudio(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Full Outreach Studio */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <OutreachStudio
                lead={selectedLeadForStudio}
                userProfile={userProfile}
                concreteOffer={concreteOffer}
                businessDirectionTitle={businessDirectionTitle}
                appMode={appMode}
                onUpdateLead={(updated) => {
                  setSelectedLeadForStudio(updated);
                  handleLeadUpdate(updated);
                }}
                onSaveActivity={(leadId, channel, result, newStatus, note, nextContactDate, isSim) => {
                  handleActivitySave(leadId, channel, result, newStatus, note, nextContactDate, isSim);
                  // refresh selected lead
                  const current = leads.find(l => l.id === leadId);
                  if (current) setSelectedLeadForStudio(current);
                }}
                onOpenLoggerModal={(mode) => {
                  setActiveModalLead({ lead: selectedLeadForStudio, mode: mode || 'log_contact' });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Lead Activity Logger */}
      {activeModalLead && (
        <LeadActivityLoggerModal
          isOpen={Boolean(activeModalLead)}
          onClose={() => setActiveModalLead(null)}
          lead={activeModalLead.lead}
          initialMode={activeModalLead.mode}
          appMode={appMode}
          onSaveActivity={(leadId, channel, result, newStatus, note, nextContactDate, isSimulation) => {
            handleActivitySave(leadId, channel, result, newStatus, note, nextContactDate, isSimulation);
          }}
        />
      )}
    </div>
  );
};
