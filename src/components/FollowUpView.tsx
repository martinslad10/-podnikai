import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  ArrowRight, 
  Phone, 
  Mail, 
  ExternalLink, 
  Building2, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  Filter, 
  PhoneCall, 
  MessageSquare, 
  Plus, 
  UserCheck, 
  Briefcase, 
  ChevronRight, 
  History, 
  FileText, 
  Timer, 
  AlertCircle,
  TrendingUp,
  Search,
  Lock,
  FlaskConical
} from 'lucide-react';
import { 
  PotentialCustomerLead, 
  LeadStatus, 
  ContactChannel,
  AppExecutionMode
} from '../types';
import { 
  FollowUpCategory, 
  FollowUpFilterType, 
  DEFAULT_STALE_DAYS,
  computeFollowUpStats, 
  getLeadFollowUpCategories, 
  getPrioritizedAttentionLeads, 
  getRecommendedNextStep, 
  getEffectiveNextContactDate, 
  getEffectiveLastContactedAt, 
  getEffectiveStatus, 
  getDaysSince 
} from '../utils/followUp';
import { 
  formatCzechDateTime, 
  formatCzechDateOnly, 
  getChannelLabel, 
  getFollowUpStatusInfo 
} from '../utils/leadActivities';
import { LeadActivityLoggerModal } from './LeadActivityLoggerModal';

interface FollowUpViewProps {
  leads: PotentialCustomerLead[];
  onSelectLead: (leadId: string) => void;
  onUpdateLeadStatus?: (leadId: string, status: LeadStatus, note?: string) => void;
  onSaveLeadActivity: (
    leadId: string,
    channel: ContactChannel,
    result: string,
    newStatus: LeadStatus,
    note?: string,
    nextContactDate?: string,
    isSimulation?: boolean
  ) => void;
  onUpdateLeadDealValue?: (leadId: string, dealValue: number | undefined) => void;
  onNavigateToFinder?: () => void;
  appMode?: AppExecutionMode;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({
  leads = [],
  onSelectLead,
  onUpdateLeadStatus,
  onSaveLeadActivity,
  onUpdateLeadDealValue,
  onNavigateToFinder,
  appMode = 'test'
}) => {
  // Filter & view state
  const [activeFilter, setActiveFilter] = useState<FollowUpFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeSimulation, setIncludeSimulation] = useState<boolean>(false);

  // Modal state for logging activity or scheduling next contact
  const [activeModalLead, setActiveModalLead] = useState<{
    lead: PotentialCustomerLead;
    mode: 'log_contact' | 'schedule_only';
  } | null>(null);

  // Toast / notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Compute stats dynamically from real CRM data
  const stats = useMemo(() => {
    return computeFollowUpStats(leads, includeSimulation);
  }, [leads, includeSimulation]);

  // Priority leads for "Co vyžaduje pozornost"
  const prioritizedAttention = useMemo(() => {
    return getPrioritizedAttentionLeads(leads, includeSimulation);
  }, [leads, includeSimulation]);

  // Section 6: Upcoming meetings
  const upcomingMeetings = useMemo(() => {
    return leads.filter(l => {
      const status = getEffectiveStatus(l, includeSimulation);
      return status === 'Schůzka';
    }).sort((a, b) => {
      const dateA = getEffectiveNextContactDate(a, includeSimulation) || '';
      const dateB = getEffectiveNextContactDate(b, includeSimulation) || '';
      return dateA.localeCompare(dateB);
    });
  }, [leads, includeSimulation]);

  // Section 7: Quotes to close
  const openQuotes = useMemo(() => {
    return leads.filter(l => {
      const status = getEffectiveStatus(l, includeSimulation);
      return status === 'Nabídka';
    }).sort((a, b) => {
      const dealA = a.dealValue || 0;
      const dealB = b.dealValue || 0;
      return dealB - dealA;
    });
  }, [leads, includeSimulation]);

  // Section 8: Leads without next step
  const leadsWithoutNextStep = useMemo(() => {
    return leads.filter(l => {
      const cats = getLeadFollowUpCategories(l, includeSimulation);
      return cats.includes('no_next_step');
    }).sort((a, b) => {
      const lastA = getEffectiveLastContactedAt(a, includeSimulation) || a.addedAt || '';
      const lastB = getEffectiveLastContactedAt(b, includeSimulation) || b.addedAt || '';
      return lastB.localeCompare(lastA);
    });
  }, [leads, includeSimulation]);

  // Section 9: Leads stale without contact >= 7 days
  const staleLeads = useMemo(() => {
    return leads.filter(l => {
      const cats = getLeadFollowUpCategories(l, includeSimulation);
      return cats.includes('stale');
    }).sort((a, b) => {
      const lastA = getEffectiveLastContactedAt(a, includeSimulation) || '';
      const lastB = getEffectiveLastContactedAt(b, includeSimulation) || '';
      return lastA.localeCompare(lastB); // oldest first
    });
  }, [leads, includeSimulation]);

  // Filtered leads when a specific filter pill is clicked
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (activeFilter === 'overdue') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('overdue'));
    } else if (activeFilter === 'today') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('today'));
    } else if (activeFilter === 'this_week') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('this_week'));
    } else if (activeFilter === 'meetings') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('meeting'));
    } else if (activeFilter === 'quotes') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('quote'));
    } else if (activeFilter === 'no_next_step') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('no_next_step'));
    } else if (activeFilter === 'stale') {
      result = leads.filter(l => getLeadFollowUpCategories(l, includeSimulation).includes('stale'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l => 
        (l.companyName && l.companyName.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.industry && l.industry.toLowerCase().includes(q))
      );
    }

    return result;
  }, [leads, activeFilter, searchQuery, includeSimulation]);

  // Helper to format category badge
  const renderCategoryBadge = (category: FollowUpCategory) => {
    switch (category) {
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            PO TERMÍNU
          </span>
        );
      case 'today':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            DNES
          </span>
        );
      case 'tomorrow':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            ZÍTRA
          </span>
        );
      case 'this_week':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            TENTO TÝDEN
          </span>
        );
      case 'meeting':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            SCHŮZKA
          </span>
        );
      case 'quote':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            NABÍDKA
          </span>
        );
      case 'no_next_step':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            BEZ DALŠÍHO KROKU
          </span>
        );
      case 'stale':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
            <Timer className="w-3.5 h-3.5 text-orange-400" />
            DLOUHO BEZ KONTAKTU
          </span>
        );
    }
  };

  // Status color badge
  const renderStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'Nový':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Nový</span>;
      case 'Dnes oslovit':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Dnes oslovit</span>;
      case 'Osloveno':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Osloveno</span>;
      case 'Odpověděl':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">Odpověděl</span>;
      case 'Zájem':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Zájem</span>;
      case 'Schůzka':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-500/40">Schůzka</span>;
      case 'Nabídka':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-500/40">Nabídka</span>;
      case 'Zákazník':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">Zákazník</span>;
      case 'Odmítnuto':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">Odmítnuto</span>;
      case 'Nekontaktovat':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">Nekontaktovat</span>;
    }
  };

  // Lead card component used across sections
  const renderLeadCard = (lead: PotentialCustomerLead, primaryCat?: FollowUpCategory) => {
    const status = getEffectiveStatus(lead, includeSimulation);
    const nextDate = getEffectiveNextContactDate(lead, includeSimulation);
    const lastContactAt = getEffectiveLastContactedAt(lead, includeSimulation);
    const nextStep = getRecommendedNextStep(lead, includeSimulation);
    const daysSinceLast = lastContactAt ? getDaysSince(lastContactAt) : null;

    const hasPhone = Boolean(lead.phone && lead.phone !== 'Nedostupné');
    const hasEmail = Boolean(lead.email && lead.email !== 'Nedostupné');
    const isSimulated = Boolean(lead.simulationStatus || lead.simulationNextContactDate || lead.activities?.some(a => a.isSimulation));

    // Calculate last contact channel & result
    const lastActivity = lead.activities && lead.activities.length > 0 ? lead.activities[0] : null;
    const lastChannel = lead.lastContactChannel || lastActivity?.channel;
    const lastResult = lead.lastContactResult || lastActivity?.result;

    return (
      <div 
        key={lead.id}
        id={`followup-lead-${lead.id}`}
        className="bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all shadow-lg flex flex-col justify-between gap-4 group"
      >
        {/* Card Top: Company, Badges, Status */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {primaryCat && renderCategoryBadge(primaryCat)}
                {renderStatusBadge(status)}
                {isSimulated && includeSimulation && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3 text-amber-400" />
                    TESTOVACÍ SIMULACE
                  </span>
                )}
                {lead.dealValue !== undefined && lead.dealValue > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    {lead.dealValue.toLocaleString('cs-CZ')} Kč
                  </span>
                )}
              </div>

              <button
                id={`btn-open-lead-title-${lead.id}`}
                onClick={() => onSelectLead(lead.id)}
                className="text-left group-hover:text-blue-400 transition-colors"
              >
                <h3 className="font-heading font-bold text-base sm:text-lg text-white leading-snug truncate">
                  {lead.companyName}
                </h3>
              </button>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                {lead.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {lead.city}
                  </span>
                )}
                {lead.industry && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    {lead.industry}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-3 my-2 border-y border-white/5 bg-white/[0.02] rounded-xl px-3">
            {/* Next Contact */}
            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Další plánovaný kontakt:</span>
              {nextDate ? (
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  {formatCzechDateTime(nextDate)}
                </span>
              ) : (
                <span className="text-slate-400 italic">Další kontakt není naplánován</span>
              )}
            </div>

            {/* Last Contact */}
            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Poslední kontakt:</span>
              {lastContactAt ? (
                <span className="text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  {formatCzechDateTime(lastContactAt)}
                  {daysSinceLast !== null && (
                    <span className="text-slate-400 text-[10px]">({daysSinceLast} d.)</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400 italic">Zatím nekontaktováno</span>
              )}
            </div>

            {/* Channel & Last Result */}
            {lastResult && (
              <div className="sm:col-span-2 mt-1 pt-1.5 border-t border-white/5 text-[11px]">
                <span className="text-slate-400">Poslední výsledek ({lastChannel ? getChannelLabel(lastChannel) : 'kontakt'}):</span>
                <p className="text-slate-300 font-medium truncate mt-0.5">{lastResult}</p>
              </div>
            )}

            {/* Contact details: phone & verified public email */}
            <div className="sm:col-span-2 flex items-center gap-4 flex-wrap pt-1 text-[11px]">
              {hasPhone ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  {lead.phone}
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  Telefon nedostupný
                </span>
              )}

              {hasEmail ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <Mail className="w-3 h-3 text-blue-400" />
                  {lead.email}
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  E-mail nedostupný
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Bottom: Prominent "Další krok" + Quick Actions */}
        <div className="space-y-2.5 pt-1">
          {/* Section 4: Prominent "Další krok" Button */}
          <button
            id={`btn-next-step-${lead.id}`}
            onClick={() => onSelectLead(lead.id)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] group"
          >
            <div className="flex items-center gap-2 text-left">
              <Sparkles className="w-4 h-4 text-blue-200" />
              <div>
                <span className="block leading-tight">Další krok: {nextStep.label}</span>
                <span className="text-[10px] text-blue-100/80 font-normal leading-tight hidden sm:block">
                  {nextStep.description}
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Section 5: Quick Actions Bar */}
          <div className="flex items-center justify-between gap-1 sm:gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {/* Phone Quick Action (only if phone available) */}
              {hasPhone ? (
                <a
                  id={`btn-call-quick-${lead.id}`}
                  href={`tel:${lead.phone?.replace(/\s+/g, '')}`}
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title={`Zavolat na ${lead.phone}`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Zavolat</span>
                </a>
              ) : null}

              {/* Email Quick Action (strictly only if public email available) */}
              {hasEmail ? (
                <a
                  id={`btn-email-quick-${lead.id}`}
                  href={`mailto:${lead.email}?subject=Spolupráce%20–%20${encodeURIComponent(lead.companyName)}`}
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title={`Napsat e-mail na ${lead.email}`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">E-mail</span>
                </a>
              ) : null}

              {/* Log Activity */}
              <button
                id={`btn-log-act-${lead.id}`}
                onClick={() => setActiveModalLead({ lead, mode: 'log_contact' })}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Zapsat výsledek hovoru, schůzky či zprávy"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Zapsat aktivitu</span>
              </button>

              {/* Schedule Follow-up */}
              <button
                id={`btn-schedule-followup-${lead.id}`}
                onClick={() => setActiveModalLead({ lead, mode: 'schedule_only' })}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Naplánovat konkrétní termín dalšího kontaktu"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Naplánovat</span>
              </button>
            </div>

            {/* Open Detail button */}
            <button
              id={`btn-detail-quick-${lead.id}`}
              onClick={() => onSelectLead(lead.id)}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors ml-auto"
              title="Otevřít kompletní profil firmy a Outreach Studio"
            >
              <span>Detail</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      {/* Toast message */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xl flex items-center gap-2 border border-blue-400">
          <CheckCircle2 className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      {/* Section 1: Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md shadow-blue-500/10">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white tracking-tight">
                Follow-up centrum
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Všechny další obchodní kroky na jednom místě.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector (Test vs Real) & Search */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Test simulation toggle (Section 10) */}
          <button
            id="btn-toggle-simulation-mode"
            onClick={() => setIncludeSimulation(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              includeSimulation 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Přepnout zobrazení testovacích simulací z Outreach Studia"
          >
            <FlaskConical className={`w-3.5 h-3.5 ${includeSimulation ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{includeSimulation ? 'Včetně testovacích simulací' : 'Reálná data (výchozí)'}</span>
          </button>

          {/* Quick link to finder */}
          {onNavigateToFinder && (
            <button
              id="btn-nav-to-finder"
              onClick={onNavigateToFinder}
              className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Najít nové firmy</span>
            </button>
          )}
        </div>
      </div>

      {/* Prominent Real Data Stats Banner (Section 1 & 18) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Overdue */}
        <button
          id="stat-card-overdue"
          onClick={() => setActiveFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === 'overdue'
              ? 'bg-rose-500/25 border-rose-500/60 ring-2 ring-rose-500/40'
              : 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15'
          }`}
        >
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Po termínu</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-rose-200">
            {stats.overdueCount}
          </div>
          <span className="text-[11px] text-rose-300/80 mt-0.5 block">vyžaduje okamžitou reakci</span>
        </button>

        {/* Today */}
        <button
          id="stat-card-today"
          onClick={() => setActiveFilter(activeFilter === 'today' ? 'all' : 'today')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === 'today'
              ? 'bg-amber-500/25 border-amber-500/60 ring-2 ring-amber-500/40'
              : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Dnes</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-amber-200">
            {stats.todayCount}
          </div>
          <span className="text-[11px] text-amber-300/80 mt-0.5 block">naplánováno na dnešek</span>
        </button>

        {/* This Week */}
        <button
          id="stat-card-this-week"
          onClick={() => setActiveFilter(activeFilter === 'this_week' ? 'all' : 'this_week')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === 'this_week'
              ? 'bg-blue-500/25 border-blue-500/60 ring-2 ring-blue-500/40'
              : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15'
          }`}
        >
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Tento týden</span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-blue-200">
            {stats.thisWeekCount}
          </div>
          <span className="text-[11px] text-blue-300/80 mt-0.5 block">naplánováno do neděle</span>
        </button>

        {/* Upcoming Meetings */}
        <button
          id="stat-card-meetings"
          onClick={() => setActiveFilter(activeFilter === 'meetings' ? 'all' : 'meetings')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === 'meetings'
              ? 'bg-emerald-500/25 border-emerald-500/60 ring-2 ring-emerald-500/40'
              : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Schůzky</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-emerald-200">
            {stats.upcomingMeetingsCount}
          </div>
          <span className="text-[11px] text-emerald-300/80 mt-0.5 block">domluvená jednání</span>
        </button>

        {/* Open Quotes */}
        <button
          id="stat-card-quotes"
          onClick={() => setActiveFilter(activeFilter === 'quotes' ? 'all' : 'quotes')}
          className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            activeFilter === 'quotes'
              ? 'bg-indigo-500/25 border-indigo-500/60 ring-2 ring-indigo-500/40'
              : 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/15'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Nabídky</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-indigo-200">
            {stats.openQuotesCount}
          </div>
          <span className="text-[11px] text-indigo-300/80 mt-0.5 block">k dotažení do prodeje</span>
        </button>
      </div>

      {/* Section 12: Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          <button
            id="filter-tab-all"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Vše ({leads.length})
          </button>

          <button
            id="filter-tab-overdue"
            onClick={() => setActiveFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
            }`}
          >
            🔴 Po termínu ({stats.overdueCount})
          </button>

          <button
            id="filter-tab-today"
            onClick={() => setActiveFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'today'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            🟠 Dnes ({stats.todayCount})
          </button>

          <button
            id="filter-tab-this-week"
            onClick={() => setActiveFilter('this_week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'this_week'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
            }`}
          >
            🔵 Tento týden ({stats.thisWeekCount})
          </button>

          <button
            id="filter-tab-meetings"
            onClick={() => setActiveFilter('meetings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'meetings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            🟢 Schůzky ({stats.upcomingMeetingsCount})
          </button>

          <button
            id="filter-tab-quotes"
            onClick={() => setActiveFilter('quotes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'quotes'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
            }`}
          >
            💰 Nabídky ({stats.openQuotesCount})
          </button>

          <button
            id="filter-tab-no-next-step"
            onClick={() => setActiveFilter('no_next_step')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'no_next_step'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            ⚪ Bez dalšího kroku ({stats.noNextStepCount})
          </button>

          <button
            id="filter-tab-stale"
            onClick={() => setActiveFilter('stale')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'stale'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10'
            }`}
          >
            ⏳ Dlouho bez kontaktu ({stats.staleCount})
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-followup-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat firmu nebo město..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* FILTERED VIEW: If a specific filter is selected (other than 'all') */}
      {activeFilter !== 'all' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg sm:text-xl text-white flex items-center gap-2">
              <span>Vyfiltrované úkoly</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {filteredLeads.length}
              </span>
            </h2>
            <button
              onClick={() => setActiveFilter('all')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Zpět na celkový přehled
            </button>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="font-bold text-white text-sm">Žádné leady v této kategorii</p>
              <p className="text-xs text-slate-400 mt-1">Všechny úkoly jsou vyřešené nebo nemají odpovídající termín.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredLeads.map(lead => {
                const cats = getLeadFollowUpCategories(lead, includeSimulation);
                return renderLeadCard(lead, cats[0]);
              })}
            </div>
          )}
        </div>
      ) : (
        /* PANORAMIC VIEW: All Sections 2, 6, 7, 8, 9 */
        <div className="space-y-10">
          {/* Section 2: HLAVNÍ PRIORITY ("Co vyžaduje pozornost") */}
          <section id="section-attention">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  Co vyžaduje pozornost
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pracovní pořadí: Po termínu → Dnes → Zítra → Schůzky → Nabídky → Tento týden
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {prioritizedAttention.length} prioritních úkolů
              </span>
            </div>

            {prioritizedAttention.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="font-bold text-white text-base">Skvělá práce! Žádné resty na dnešek.</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Nemáte žádné leady po termínu ani naplánované na dnešní den. Můžete vyhledat nové firmy nebo naplánovat follow-up u rozpracovaných kontaktů.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {prioritizedAttention.map(item => renderLeadCard(item.lead, item.primaryCategory))}
              </div>
            )}
          </section>

          {/* Section 6: SCHŮZKY ("Nadcházející schůzky") */}
          <section id="section-meetings">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Nadcházející schůzky
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Domluvená jednání s klienty (automatický outreach je bezpečně pozastaven).
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {upcomingMeetings.length} schůzek
              </span>
            </div>

            {upcomingMeetings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-slate-400">
                Zatím nemáte žádnou aktivní schůzku. Posuňte oslovené firmy se zájmem do stavu „Schůzka“.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingMeetings.map(lead => {
                  const meetingDate = getEffectiveNextContactDate(lead, includeSimulation);
                  return (
                    <div 
                      key={lead.id}
                      className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            🤝 Schůzka
                          </span>
                          {meetingDate && (
                            <span className="text-xs font-bold text-emerald-200 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                              {formatCzechDateTime(meetingDate)}
                            </span>
                          )}
                        </div>

                        <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                          {lead.companyName}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {lead.city || 'Česká republika'}
                        </p>

                        {lead.notes && (
                          <div className="mt-3 p-2.5 rounded-xl bg-black/30 border border-emerald-500/20 text-xs text-slate-300">
                            <span className="text-emerald-400 font-semibold block text-[11px] mb-0.5">Poznámka ke schůzce:</span>
                            <p className="line-clamp-2">{lead.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-500/20">
                        <span className="text-[11px] text-emerald-400/80">
                          {lead.phone && lead.phone !== 'Nedostupné' ? `Tel: ${lead.phone}` : 'Osobní / online jednání'}
                        </span>
                        <button
                          id={`btn-open-meeting-lead-${lead.id}`}
                          onClick={() => onSelectLead(lead.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                        >
                          <span>Otevřít lead</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 7: NABÍDKY ("Nabídky k dotažení") */}
          <section id="section-quotes">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                  Nabídky k dotažení
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Odeslané nebo rozjednané nabídky, které čekají na finální rozhodnutí klienta.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {openQuotes.length} otevřených nabídek
              </span>
            </div>

            {openQuotes.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-slate-400">
                Zatím žádné otevřené nabídky. Jakmile klient požádá o cenovou nabídku, změňte stav firmy na „Nabídka“.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {openQuotes.map(lead => {
                  const lastContactAt = getEffectiveLastContactedAt(lead, includeSimulation);
                  const nextDate = getEffectiveNextContactDate(lead, includeSimulation);
                  const daysSinceLast = lastContactAt ? getDaysSince(lastContactAt) : null;

                  return (
                    <div 
                      key={lead.id}
                      className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            📄 Nabídka
                          </span>
                          {lead.dealValue !== undefined && lead.dealValue > 0 && (
                            <span className="text-sm font-black text-indigo-200">
                              {lead.dealValue.toLocaleString('cs-CZ')} Kč
                            </span>
                          )}
                        </div>

                        <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                          {lead.companyName}
                        </h3>

                        <div className="grid grid-cols-2 gap-2 text-xs mt-2.5 pt-2 border-t border-indigo-500/20 text-slate-300">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Poslední kontakt:</span>
                            <span>{lastContactAt ? formatCzechDateOnly(lastContactAt) : 'Neuvedeno'}</span>
                            {daysSinceLast !== null && (
                              <span className="text-indigo-400 text-[10px] ml-1">({daysSinceLast} d. zpět)</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Další plánovaný kontakt:</span>
                            <span className="font-medium text-slate-200">
                              {nextDate ? formatCzechDateOnly(nextDate) : 'Není naplánován'}
                            </span>
                          </div>
                        </div>

                        {lead.lastContactResult && (
                          <p className="text-xs text-slate-400 mt-2 bg-black/30 p-2 rounded-lg truncate">
                            Poslední výsledek: <span className="text-slate-200 font-medium">{lead.lastContactResult}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-indigo-500/20">
                        <button
                          id={`btn-schedule-quote-${lead.id}`}
                          onClick={() => setActiveModalLead({ lead, mode: 'schedule_only' })}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                        >
                          Naplánovat hovor
                        </button>
                        <button
                          id={`btn-continue-deal-${lead.id}`}
                          onClick={() => onSelectLead(lead.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                        >
                          <span>Pokračovat v obchodu</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 8: LEADY BEZ DALŠÍHO KROKU ("Leady bez dalšího kroku") */}
          <section id="section-no-next-step">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                  Leady bez dalšího kroku
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rozpracované kontakty, které nemají naplánovaný žádný navazující termín.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
                {leadsWithoutNextStep.length} k naplánování
              </span>
            </div>

            {leadsWithoutNextStep.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Všechny aktivní leady mají naplánovaný další krok!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {leadsWithoutNextStep.map(lead => {
                  const status = getEffectiveStatus(lead, includeSimulation);
                  return (
                    <div 
                      key={lead.id}
                      className="bg-slate-900/50 border border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          {renderStatusBadge(status)}
                          <span className="text-[11px] text-slate-500">
                            {lead.city || 'ČR'}
                          </span>
                        </div>
                        <h3 className="font-heading font-bold text-base text-white truncate">
                          {lead.companyName}
                        </h3>
                        <p className="text-xs text-rose-300/90 font-semibold mt-1">
                          Další kontakt není naplánován.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                          id={`btn-schedule-nonext-${lead.id}`}
                          onClick={() => setActiveModalLead({ lead, mode: 'schedule_only' })}
                          className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Naplánovat follow-up</span>
                        </button>
                        <button
                          onClick={() => onSelectLead(lead.id)}
                          className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                          title="Detail leadu"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 9: LEADY DLOUHO BEZ KONTAKTU ("Dlouho bez kontaktu") */}
          <section id="section-stale">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white flex items-center gap-2">
                  <Timer className="w-5 h-5 text-orange-400" />
                  Dlouho bez kontaktu
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aktivní firmy, kde od posledního kontaktu uplynulo alespoň {DEFAULT_STALE_DAYS} dní a nemají domluvenou schůzku.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {staleLeads.length} spících leadů
              </span>
            </div>

            {staleLeads.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-slate-400">
                Žádný kontakt není zanedbaný déle než {DEFAULT_STALE_DAYS} dní.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {staleLeads.map(lead => {
                  const lastContactAt = getEffectiveLastContactedAt(lead, includeSimulation);
                  const daysSinceLast = lastContactAt ? getDaysSince(lastContactAt) : null;
                  const status = getEffectiveStatus(lead, includeSimulation);

                  return (
                    <div 
                      key={lead.id}
                      className="bg-orange-950/15 border border-orange-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          {renderStatusBadge(status)}
                          {daysSinceLast !== null && (
                            <span className="text-xs font-bold text-orange-400">
                              {daysSinceLast} dní bez kontaktu
                            </span>
                          )}
                        </div>
                        <h3 className="font-heading font-bold text-base text-white truncate">
                          {lead.companyName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Naposledy kontaktováno: {lastContactAt ? formatCzechDateOnly(lastContactAt) : 'Neuvedeno'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-orange-500/20">
                        <button
                          id={`btn-reactivate-${lead.id}`}
                          onClick={() => onSelectLead(lead.id)}
                          className="flex-1 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Obnovit kontakt</span>
                        </button>
                        <button
                          onClick={() => setActiveModalLead({ lead, mode: 'schedule_only' })}
                          className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                          title="Naplánovat follow-up"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Section 5: Activity & Schedule Modal */}
      {activeModalLead && (
        <LeadActivityLoggerModal
          isOpen={true}
          onClose={() => setActiveModalLead(null)}
          lead={activeModalLead.lead}
          mode={activeModalLead.mode}
          appMode={appMode}
          onSaveActivity={(leadId, channel, result, newStatus, note, nextContactDate, isSim) => {
            onSaveLeadActivity(leadId, channel, result, newStatus, note, nextContactDate, isSim);
            setActiveModalLead(null);
            showToast(activeModalLead.mode === 'schedule_only' ? 'Termín follow-upu byl úspěšně naplánován' : 'Aktivita byla zaznamenána do CRM');
          }}
        />
      )}
    </div>
  );
};
