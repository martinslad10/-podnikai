import React, { useState } from 'react';
import {
  PotentialCustomerLead,
  SalesTimeFilter,
  SalesDataMode,
  LeadStatus,
  SalesCostsTracking
} from '../types';
import {
  calculateSalesMetrics,
  ConversionRateItem,
  isSimulationActivity
} from '../utils/salesAnalytics';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  Calendar,
  PhoneCall,
  Mail,
  MessageCircle,
  Users,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  FlaskConical,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Flame,
  Filter,
  Sparkles,
  Edit3,
  Check,
  X,
  Plus,
  Receipt,
  PiggyBank,
  Wallet
} from 'lucide-react';

interface SalesDashboardViewProps {
  leads: PotentialCustomerLead[];
  onSelectLead: (leadId: string) => void;
  onUpdateLeadDealValue: (leadId: string, dealValue: number | undefined) => void;
  onUpdateLeadFinancials?: (
    leadId: string,
    financials: {
      dealValue?: number;
      costsTracking?: SalesCostsTracking;
    }
  ) => void;
  onNavigateToFinder: () => void;
}

export const SalesDashboardView: React.FC<SalesDashboardViewProps> = ({
  leads,
  onSelectLead,
  onUpdateLeadDealValue,
  onUpdateLeadFinancials,
  onNavigateToFinder
}) => {
  const [timeFilter, setTimeFilter] = useState<SalesTimeFilter>('all');
  const [dataMode, setDataMode] = useState<SalesDataMode>('real_only');
  const [editingDealLeadId, setEditingDealLeadId] = useState<string | null>(null);
  const [dealInputVal, setDealInputVal] = useState<string>('');
  const [showRoiExplanation, setShowRoiExplanation] = useState<boolean>(false);

  // Financial & Cost Modal state
  const [financialModalLead, setFinancialModalLead] = useState<PotentialCustomerLead | null>(null);
  const [modalDealValue, setModalDealValue] = useState<string>('');
  const [modalAcquisitionCost, setModalAcquisitionCost] = useState<string>('');
  const [modalTimeSpentMinutes, setModalTimeSpentMinutes] = useState<string>('');
  const [modalOtherCosts, setModalOtherCosts] = useState<string>('');

  const openFinancialModal = (lead?: PotentialCustomerLead) => {
    const target = lead || (leads.length > 0 ? leads[0] : null);
    setFinancialModalLead(target);
    if (target) {
      setModalDealValue(target.dealValue !== undefined ? String(target.dealValue) : '');
      setModalAcquisitionCost(target.costsTracking?.acquisitionCost !== undefined ? String(target.costsTracking.acquisitionCost) : '');
      setModalTimeSpentMinutes(target.costsTracking?.timeSpentMinutes !== undefined ? String(target.costsTracking.timeSpentMinutes) : '');
      setModalOtherCosts(target.costsTracking?.otherCosts !== undefined ? String(target.costsTracking.otherCosts) : '');
    }
  };

  const handleSaveFinancialModal = () => {
    if (!financialModalLead) return;
    const dv = modalDealValue.trim() !== '' ? Math.max(0, parseInt(modalDealValue.replace(/\s+/g, ''), 10)) : undefined;
    const ac = modalAcquisitionCost.trim() !== '' ? Math.max(0, parseInt(modalAcquisitionCost.replace(/\s+/g, ''), 10)) : undefined;
    const time = modalTimeSpentMinutes.trim() !== '' ? Math.max(0, parseInt(modalTimeSpentMinutes.replace(/\s+/g, ''), 10)) : undefined;
    const other = modalOtherCosts.trim() !== '' ? Math.max(0, parseInt(modalOtherCosts.replace(/\s+/g, ''), 10)) : undefined;

    const costsTracking: SalesCostsTracking = {
      ...(financialModalLead.costsTracking || {}),
      acquisitionCost: isNaN(ac as any) ? undefined : ac,
      timeSpentMinutes: isNaN(time as any) ? undefined : time,
      otherCosts: isNaN(other as any) ? undefined : other
    };

    if (onUpdateLeadFinancials) {
      onUpdateLeadFinancials(financialModalLead.id, {
        dealValue: isNaN(dv as any) ? undefined : dv,
        costsTracking
      });
    } else {
      onUpdateLeadDealValue(financialModalLead.id, isNaN(dv as any) ? undefined : dv);
    }
    setFinancialModalLead(null);
  };

  // Calculate metrics deterministically from real CRM data
  const metrics = calculateSalesMetrics(leads, timeFilter, dataMode);

  const handleStartEditDeal = (lead: PotentialCustomerLead) => {
    setEditingDealLeadId(lead.id);
    setDealInputVal(lead.dealValue ? String(lead.dealValue) : '');
  };

  const handleSaveDealValue = (leadId: string) => {
    const num = parseFloat(dealInputVal.replace(/\s+/g, ''));
    if (!isNaN(num) && num >= 0) {
      onUpdateLeadDealValue(leadId, Math.round(num));
    } else if (dealInputVal.trim() === '') {
      onUpdateLeadDealValue(leadId, undefined);
    }
    setEditingDealLeadId(null);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 0. Top Header with Title, Mode Switcher & Time Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/30 border border-blue-500/30 text-blue-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Obchodní Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Reálná analýza prodejního funnelu vypočítaná z databáze CRM
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real vs Simulation Mode Toggle */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              id="sales-mode-real"
              onClick={() => setDataMode('real_only')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                dataMode === 'real_only'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Zobrazuje pouze skutečné CRM aktivity a vylučuje testovací simulace ze Studia"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Reálný výkon</span>
            </button>
            <button
              id="sales-mode-all"
              onClick={() => setDataMode('all_including_test')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                dataMode === 'all_including_test'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Zahrnuje i testovací simulace z Outreach Studia"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Včetně simulací</span>
            </button>
          </div>

          {/* Time Filter Tabs */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: 'Vše' },
                { id: '7days', label: '7 dní' },
                { id: '30days', label: '30 dní' },
                { id: 'thisMonth', label: 'Tento měsíc' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                id={`time-filter-${f.id}`}
                onClick={() => setTimeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  timeFilter === f.id
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 12. Test Data Separation Notice Banner */}
      {metrics.activityStats.hasSimulations && (
        <div className="flex items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-950/30 border border-indigo-900/40 rounded-xl text-xs text-indigo-200">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-semibold text-indigo-300">
                Testovací data jsou oddělena od reálných výsledků.
              </span>{' '}
              <span className="text-indigo-300/80">
                {dataMode === 'real_only'
                  ? `V CRM existuje ${metrics.activityStats.simulation.all} testovacích simulací z Outreach Studia (nezapočítáno do reálných konverzí).`
                  : `Aktuálně máte zapnuto zobrazení včetně testovacích simulací (${metrics.activityStats.simulation.all} simulovaných kroků).`}
              </span>
            </div>
          </div>
          <button
            onClick={() => setDataMode(dataMode === 'real_only' ? 'all_including_test' : 'real_only')}
            className="text-[11px] underline underline-offset-2 text-indigo-300 hover:text-white shrink-0"
          >
            {dataMode === 'real_only' ? 'Zobrazit i simulace' : 'Přepnout na reálný výkon'}
          </button>
        </div>
      )}

      {/* =========================================================================
          PRIORITA 1: CO MÁM ŘEŠIT DNES (FOLLOW-UP)
          ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Co mám řešit dnes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {metrics.todayFollowUps.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Dnešní a urgentní obchodní kroky
          </span>
        </div>

        {metrics.todayFollowUps.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-slate-200">
              Dnes nemáte žádný naplánovaný follow-up.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Všechny kontakty jsou vyřízené. Můžete vyhledat nové firmy v Customer Finderu nebo projít stávající databázi.
            </p>
            <button
              onClick={onNavigateToFinder}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-medium transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Otevřít Customer Finder</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.todayFollowUps.map(({ lead, priorityReason, priorityLevel, scheduledText }) => (
              <div
                key={lead.id}
                id={`follow-up-card-${lead.id}`}
                onClick={() => onSelectLead(lead.id)}
                className="group relative p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        priorityLevel === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : priorityLevel === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {priorityLevel === 'critical' && <AlertTriangle className="w-3 h-3" />}
                      {priorityLevel === 'high' && <Clock className="w-3 h-3" />}
                      {priorityLevel === 'medium' && <Calendar className="w-3 h-3" />}
                      {priorityReason}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {lead.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                    {lead.companyName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {lead.city || 'Lokalita neupřesněna'} • {lead.industry || 'Obor neupřesněn'}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Termín:
                    </span>
                    <span className="font-medium text-slate-200">
                      {scheduledText}
                    </span>
                  </div>
                </div>

                <button
                  id={`btn-open-lead-crm-${lead.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLead(lead.id);
                  }}
                  className="mt-3 w-full flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-blue-400 hover:text-blue-300 font-medium group-hover:text-blue-300 transition-colors"
                >
                  <span>Otevřít firmu v CRM</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          PRIORITA 2: OBCHODNÍ FUNNEL
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Obchodní Funnel (Průchod procesem)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lead → Osloveno → Zájem → Schůzka → Nabídka → Zákazník
            </p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            Krok za krokem
          </span>
        </div>

        {/* Funnel visual container */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.funnel.map((step, idx) => {
              const colors = [
                'from-blue-600/20 to-blue-500/10 border-blue-500/30 text-blue-400',
                'from-cyan-600/20 to-cyan-500/10 border-cyan-500/30 text-cyan-400',
                'from-indigo-600/20 to-indigo-500/10 border-indigo-500/30 text-indigo-400',
                'from-purple-600/20 to-purple-500/10 border-purple-500/30 text-purple-400',
                'from-amber-600/20 to-amber-500/10 border-amber-500/30 text-amber-400',
                'from-emerald-600/20 to-emerald-500/10 border-emerald-500/30 text-emerald-400'
              ];
              const colorClass = colors[idx] || colors[0];

              return (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-xl border bg-gradient-to-b ${colorClass} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {idx + 1}. {step.label}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight mt-1">
                      {step.count}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Z předchozího:</span>
                      <span className="font-semibold text-slate-200">
                        {idx === 0
                          ? '100 %'
                          : step.conversionFromPrev !== null
                          ? `${step.conversionFromPrev} %`
                          : 'Nedostatek dat'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Z celku:</span>
                      <span className="font-medium text-slate-300">
                        {step.percentageOfTotal !== null
                          ? `${step.percentageOfTotal} %`
                          : 'Nedostatek dat'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversion rate pills between stages */}
          <div className="pt-3 border-t border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">
              Konverzní poměry mezi fázemi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {Object.values(metrics.conversions).map((conv: ConversionRateItem) => (
                <div
                  key={conv.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                >
                  <span className="text-[11px] text-slate-400 font-medium line-clamp-1">
                    {conv.label}
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-bold text-white">
                      {conv.rate !== null ? `${conv.rate} %` : 'Nedostatek dat'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {conv.numerator} / {conv.denominator}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRIORITA 3: HLAVNÍ ČÍSLA (STAV CRM DAT) & REÁLNÝ OBCHODNÍ VÝKON
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Hlavní metriky CRM
          </h2>
          <span className="text-xs text-slate-400">
            Aktuální počty leadů podle stavu
          </span>
        </div>

        {/* 8 Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Celkem</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.total}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-blue-500/20">
            <span className="text-[11px] text-blue-400 font-medium">Nové</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.new}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/20">
            <span className="text-[11px] text-cyan-400 font-medium">Osloveno</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.contacted}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/20">
            <span className="text-[11px] text-indigo-400 font-medium">Zájem</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.interested}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/20">
            <span className="text-[11px] text-purple-400 font-medium">Schůzka</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.meeting}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/20">
            <span className="text-[11px] text-amber-400 font-medium">Nabídka</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.proposal}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-400 font-medium">Zákazník</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.customer}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-rose-400 font-medium">Ztraceno</span>
            <div className="text-xl font-bold text-white mt-0.5">
              {metrics.statusCounts.lost}
            </div>
          </div>
        </div>

        {/* Reálný obchodní výkon Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/20 border border-blue-900/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Reálný obchodní výkon
                </h3>
                <p className="text-xs text-slate-400">
                  Ověřené metriky očištěné od simulací a testovacích akcí
                </p>
              </div>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 self-start sm:self-auto">
              Pouze reálná CRM data
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Skutečně osloveno</span>
              <div className="text-xl font-bold text-white mt-1">
                {metrics.realPerformance.contactedCompanies}
              </div>
              <span className="text-[10px] text-slate-500">firem s reálným kontaktem</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Skutečný zájem</span>
              <div className="text-xl font-bold text-indigo-300 mt-1">
                {metrics.realPerformance.interestedCompanies}
              </div>
              <span className="text-[10px] text-slate-500">potvrzená poptávka</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Domluvené schůzky</span>
              <div className="text-xl font-bold text-purple-300 mt-1">
                {metrics.realPerformance.meetingCompanies}
              </div>
              <span className="text-[10px] text-slate-500">reálně domluveno</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Odeslané nabídky</span>
              <div className="text-xl font-bold text-amber-300 mt-1">
                {metrics.realPerformance.proposalCompanies}
              </div>
              <span className="text-[10px] text-slate-500">předané kalkulace</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Získaní zákazníci</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {metrics.realPerformance.customerCompanies}
              </div>
              <span className="text-[10px] text-slate-500">uzavřené obchody</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRIORITA 4: PIPELINE & HODNOTA OBCHODU
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Pipeline a hodnota obchodu
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rozpracované obchody ve fázích Schůzka, Nabídka a Zákazník
            </p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            Finanční pipeline
          </span>
        </div>

        {/* Financial metrics banner */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Hodnota pipeline (otevřené)</span>
              <div className="text-2xl font-bold text-white mt-1">
                {metrics.financials.hasFinancialData
                  ? `${metrics.financials.pipelineValue.toLocaleString('cs-CZ')} Kč`
                  : 'Nezadáno'}
              </div>
              <span className="text-[11px] text-slate-500">Schůzky + Nabídky</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Hodnota nabídek</span>
              <div className="text-2xl font-bold text-amber-300 mt-1">
                {metrics.financials.hasFinancialData
                  ? `${metrics.financials.proposalsValue.toLocaleString('cs-CZ')} Kč`
                  : 'Nezadáno'}
              </div>
              <span className="text-[11px] text-slate-500">Ve stavu Nabídka</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Hodnota získaných zákazníků</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {metrics.financials.hasFinancialData
                  ? `${metrics.financials.wonValue.toLocaleString('cs-CZ')} Kč`
                  : 'Nezadáno'}
              </div>
              <span className="text-[11px] text-slate-500">Úspěšně uzavřeno</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">Průměrná hodnota zákazníka</span>
              <div className="text-2xl font-bold text-blue-400 mt-1">
                {metrics.financials.hasFinancialData && metrics.financials.avgCustomerValue > 0
                  ? `${metrics.financials.avgCustomerValue.toLocaleString('cs-CZ')} Kč`
                  : 'Nezadáno'}
              </div>
              <span className="text-[11px] text-slate-500">Na 1 získaného klienta</span>
            </div>
          </div>

          {!metrics.financials.hasFinancialData && (
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between">
              <span>
                💡 <strong>Finanční data zatím nejsou k dispozici.</strong> Můžete zadat hodnotu zakázky u kteréhokoliv leadu níže v pipeline.
              </span>
            </div>
          )}
        </div>

        {/* Pipeline columns: Schůzky, Nabídky, Zákazníci */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Schůzky */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Schůzky</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {metrics.pipeline.meetings.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {metrics.pipeline.meetings.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Žádná firma v této fázi
                  </p>
                ) : (
                  metrics.pipeline.meetings.map(lead => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          onClick={() => onSelectLead(lead.id)}
                          className="text-xs font-semibold text-white hover:text-blue-400 cursor-pointer line-clamp-1"
                        >
                          {lead.companyName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {lead.fitScore ? `${lead.fitScore}/100` : ''}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">Hodnota obchodu:</span>
                        {editingDealLeadId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={dealInputVal}
                              onChange={e => setDealInputVal(e.target.value)}
                              placeholder="Kč"
                              className="w-20 px-1.5 py-0.5 bg-slate-800 border border-blue-500 text-white text-xs rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveDealValue(lead.id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-950/50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditDeal(lead)}
                            className="text-slate-300 hover:text-white font-medium flex items-center gap-1"
                          >
                            {lead.dealValue ? `${lead.dealValue.toLocaleString('cs-CZ')} Kč` : '+ Zadat Kč'}
                            <Edit3 className="w-3 h-3 text-slate-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={onNavigateToFinder}
              className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 py-1"
            >
              <span>Zobrazit v CRM</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Column 2: Nabídky */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Nabídky</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {metrics.pipeline.proposals.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {metrics.pipeline.proposals.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Žádná firma v této fázi
                  </p>
                ) : (
                  metrics.pipeline.proposals.map(lead => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          onClick={() => onSelectLead(lead.id)}
                          className="text-xs font-semibold text-white hover:text-blue-400 cursor-pointer line-clamp-1"
                        >
                          {lead.companyName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {lead.fitScore ? `${lead.fitScore}/100` : ''}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">Hodnota nabídky:</span>
                        {editingDealLeadId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={dealInputVal}
                              onChange={e => setDealInputVal(e.target.value)}
                              placeholder="Kč"
                              className="w-20 px-1.5 py-0.5 bg-slate-800 border border-blue-500 text-white text-xs rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveDealValue(lead.id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-950/50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditDeal(lead)}
                            className="text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1"
                          >
                            {lead.dealValue ? `${lead.dealValue.toLocaleString('cs-CZ')} Kč` : '+ Zadat Kč'}
                            <Edit3 className="w-3 h-3 text-slate-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={onNavigateToFinder}
              className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 py-1"
            >
              <span>Zobrazit v CRM</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Column 3: Zákazníci */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Zákazníci</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {metrics.pipeline.customers.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {metrics.pipeline.customers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Zatím žádný uzavřený zákazník
                  </p>
                ) : (
                  metrics.pipeline.customers.map(lead => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/30 hover:border-emerald-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          onClick={() => onSelectLead(lead.id)}
                          className="text-xs font-semibold text-white hover:text-emerald-300 cursor-pointer line-clamp-1"
                        >
                          {lead.companyName}
                        </span>
                        <span className="text-[10px] text-emerald-400 shrink-0 font-medium">
                          Vyhráno 🎉
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">Tržba:</span>
                        {editingDealLeadId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={dealInputVal}
                              onChange={e => setDealInputVal(e.target.value)}
                              placeholder="Kč"
                              className="w-20 px-1.5 py-0.5 bg-slate-800 border border-emerald-500 text-white text-xs rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveDealValue(lead.id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-950/50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditDeal(lead)}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                          >
                            {lead.dealValue ? `${lead.dealValue.toLocaleString('cs-CZ')} Kč` : '+ Zadat Kč'}
                            <Edit3 className="w-3 h-3 text-slate-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={onNavigateToFinder}
              className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 py-1"
            >
              <span>Zobrazit v CRM</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRIORITA 5: AKTIVITA & NEJLEPŠÍ PŘÍLEŽITOSTI
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aktivita v CRM */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Aktivita v CRM
            </h2>
            <span className="text-xs text-slate-400">
              Celkem {metrics.activityStats.totalContacts} kontaktů
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            {/* Real activities breakdown */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Skutečné aktivity
                </span>
                <span className="text-slate-400 font-mono">
                  {metrics.activityStats.real.all} celkem
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <Mail className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400">E-maily</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {metrics.activityStats.real.emails}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <PhoneCall className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400">Hovory</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {metrics.activityStats.real.phones}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <MessageCircle className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400">WhatsApp</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {metrics.activityStats.real.whatsapps}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <Calendar className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400">Schůzky</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {metrics.activityStats.real.meetings}
                  </div>
                </div>
              </div>
            </div>

            {/* Test activities breakdown */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-indigo-400" />
                  Simulované aktivity (testovací režim)
                </span>
                <span className="text-indigo-400/80 font-mono">
                  {metrics.activityStats.simulation.all} simulací
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-slate-400">
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Sim. E-maily</span>
                  <div className="text-base font-semibold text-slate-300 mt-0.5">
                    {metrics.activityStats.simulation.emails}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Sim. Hovory</span>
                  <div className="text-base font-semibold text-slate-300 mt-0.5">
                    {metrics.activityStats.simulation.phones}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Sim. WhatsApp</span>
                  <div className="text-base font-semibold text-slate-300 mt-0.5">
                    {metrics.activityStats.simulation.whatsapps}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500">Sim. Schůzky</span>
                  <div className="text-base font-semibold text-slate-300 mt-0.5">
                    {metrics.activityStats.simulation.meetings}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Nejzajímavější obchodní příležitosti */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Nejzajímavější příležitosti
            </h2>
            <span className="text-xs text-slate-400">
              Podle CRM signálů a skóre
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            {metrics.topOpportunities.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                Žádné aktivní příležitosti
              </p>
            ) : (
              metrics.topOpportunities.map(lead => {
                const acts = lead.activities || [];
                const realActs = acts.filter(a => !isSimulationActivity(a));
                const simActs = acts.filter(isSimulationActivity);
                const lastRealAct = realActs.length > 0 ? realActs[0] : null;
                const isOnlySimulated = realActs.length === 0 && simActs.length > 0;

                return (
                  <div
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                          {lead.companyName}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                          {lead.status}
                        </span>

                        {isOnlySimulated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            <FlaskConical className="w-3 h-3" />
                            Simulovaný kontakt (Studio)
                          </span>
                        ) : lastRealAct ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            Reálný kontakt
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        {lead.fitScore ? (
                          <span className="text-blue-400 font-medium">
                            Shoda: {lead.fitScore}/100
                          </span>
                        ) : null}
                        {lead.dealValue ? (
                          <span className="text-emerald-400 font-medium">
                            {lead.dealValue.toLocaleString('cs-CZ')} Kč
                          </span>
                        ) : null}
                        {isOnlySimulated ? (
                          <span className="text-indigo-400/80 italic">
                            Pouze testovací simulace – bez reálného výkonu
                          </span>
                        ) : lastRealAct ? (
                          <span className="truncate max-w-[260px] text-slate-300">
                            Poslední krok: {lastRealAct.result}
                          </span>
                        ) : (
                          <span className="text-slate-500">Zatím bez kontaktu</span>
                        )}
                        {(lead.nextContactDate || lead.scheduledAt) && (
                          <span className="text-amber-400 font-medium">
                            {lead.status === 'Schůzka' ? 'Schůzka: ' : 'Plán: '}
                            {(lead.nextContactDate || lead.scheduledAt)!.substring(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-[11px] font-medium text-blue-400 transition-colors"
                      >
                        <span>Otevřít firmu v CRM</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* =========================================================================
          PRIORITA 6: OBCHODNÍ TRENDY (REÁLNÁ HISTORIE PODLE DNŮ)
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Obchodní trendy
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Agregovaná historie skutečných aktivit podle dnů (žádné odhady)
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs self-start sm:self-auto">
            {(
              [
                { id: '7days', label: '7 dní' },
                { id: '30days', label: '30 dní' },
                { id: 'thisMonth', label: 'Tento měsíc' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                id={`trend-filter-${f.id}`}
                onClick={() => setTimeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  timeFilter === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
          {!metrics.trends.hasEnoughData ? (
            <div className="py-8 text-center space-y-3">
              <div className="p-3 w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-300">
                  Nedostatek dat pro obchodní trendy v tomto období
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Pro zobrazení časového trendu je nutná historie reálných aktivit alespoň za 2 různé dny. Systém nevytváří smyšlená čísla ani odhady.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 5 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Reálné kontakty</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {metrics.trends.summary.contacts}
                  </div>
                  <span className="text-[10px] text-slate-500">v období</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-blue-500/20">
                  <span className="text-[11px] text-blue-400 block">Reálné zájmy</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {metrics.trends.summary.interests}
                  </div>
                  <span className="text-[10px] text-slate-500">získaný zájem</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-purple-500/20">
                  <span className="text-[11px] text-purple-400 block">Schůzky</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {metrics.trends.summary.meetings}
                  </div>
                  <span className="text-[10px] text-slate-500">domluveno</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/20">
                  <span className="text-[11px] text-amber-400 block">Nabídky</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {metrics.trends.summary.proposals}
                  </div>
                  <span className="text-[10px] text-slate-500">odesláno</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                  <span className="text-[11px] text-emerald-400 block">Zákazníci</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {metrics.trends.summary.customers}
                  </div>
                  <span className="text-[10px] text-slate-500">uzavřeno</span>
                </div>
              </div>

              {/* Day-by-Day Historical Breakdown */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span className="font-semibold text-slate-300">
                    Rozpad reálných aktivit podle dnů ({metrics.trends.dataPoints.length} dnů s aktivitou)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {metrics.trends.dataPoints.map((pt) => (
                    <div
                      key={pt.dateKey}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5"
                    >
                      <span className="text-[11px] font-semibold text-slate-300 block border-b border-slate-800 pb-1">
                        {pt.displayDate}
                      </span>
                      <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                        <span className="text-slate-400">Kontakty:</span>
                        <span className="font-bold text-white text-right">{pt.contacts}</span>

                        <span className="text-blue-400">Zájmy:</span>
                        <span className="font-bold text-white text-right">{pt.interests}</span>

                        <span className="text-purple-400">Schůzky:</span>
                        <span className="font-bold text-white text-right">{pt.meetings}</span>

                        <span className="text-amber-400">Nabídky:</span>
                        <span className="font-bold text-white text-right">{pt.proposals}</span>

                        <span className="text-emerald-400">Zákazníci:</span>
                        <span className="font-bold text-white text-right">{pt.customers}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          PRIORITA 7: NÁVRATNOST INVESTIC (ROI) & FINANČNÍ VÝKON
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Návratnost investic (ROI)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Počítáno pouze ze skutečně zadaných hodnot zakázek a nákladů (žádné odhady)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-open-financial-modal"
              onClick={() => openFinancialModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Zadat finance a náklady</span>
            </button>
            <button
              onClick={() => setShowRoiExplanation(!showRoiExplanation)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Vysvětlení výpočtu ROI"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ROI Explanation Tooltip/Box */}
        {showRoiExplanation && (
          <div className="p-4 bg-slate-900/95 border border-emerald-500/30 rounded-2xl text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between font-semibold text-emerald-300">
              <span>Pravidla pro výpočet ROI v PODNIKAI:</span>
              <button onClick={() => setShowRoiExplanation(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400">
              • <strong>ROI se nikdy neodhaduje:</strong> Pokud u žádné firmy nejsou zadány náklady nebo hodnota, systém zobrazí „Nezadáno“.
            </p>
            <p className="text-slate-400">
              • <strong>Čistý výnos:</strong> Hodnota vyhraných zákazníků minus součet všech nákladů (akvizice, oslovení, ostatní).
            </p>
            <p className="text-slate-400">
              • <strong>Vzorec ROI:</strong> (Čistý výnos / Celkové náklady) × 100 %.
            </p>
          </div>
        )}

        {/* 6 Key ROI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Hodnota otevřených obchodů */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Otevřené obchody</span>
            <div className="text-lg font-bold text-white mt-1">
              {metrics.financials.openDealsValue !== null
                ? `${metrics.financials.openDealsValue.toLocaleString('cs-CZ')} Kč`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">
              {metrics.financials.openDealsCount > 0
                ? `${metrics.financials.openDealsCount} v jednání`
                : 'Schůzky a nabídky'}
            </span>
          </div>

          {/* 2. Hodnota získaných zákazníků */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30">
            <span className="text-[11px] text-emerald-400 block font-medium">Získaní zákazníci</span>
            <div className="text-lg font-bold text-emerald-300 mt-1">
              {metrics.financials.wonCustomersValue !== null
                ? `${metrics.financials.wonCustomersValue.toLocaleString('cs-CZ')} Kč`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">
              {metrics.financials.wonCustomersCount} zákazníků
            </span>
          </div>

          {/* 3. Průměrná hodnota zákazníka */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Průměr / zákazník</span>
            <div className="text-lg font-bold text-white mt-1">
              {metrics.financials.avgCustomerValue !== null
                ? `${metrics.financials.avgCustomerValue.toLocaleString('cs-CZ')} Kč`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">průměrná zakázka</span>
          </div>

          {/* 4. Náklady na akvizici */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Náklady na akvizici</span>
            <div className="text-lg font-bold text-slate-200 mt-1">
              {metrics.financials.acquisitionCostsTotal !== null
                ? `${metrics.financials.acquisitionCostsTotal.toLocaleString('cs-CZ')} Kč`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">zadané přímé náklady</span>
          </div>

          {/* 5. Čistý výnos */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Čistý výnos</span>
            <div
              className={`text-lg font-bold mt-1 ${
                metrics.financials.netRevenue !== null
                  ? metrics.financials.netRevenue >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-white'
              }`}
            >
              {metrics.financials.netRevenue !== null
                ? `${metrics.financials.netRevenue.toLocaleString('cs-CZ')} Kč`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">tržby – náklady</span>
          </div>

          {/* 6. ROI */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 bg-emerald-950/20">
            <span className="text-[11px] text-emerald-300 block font-semibold">Návratnost (ROI)</span>
            <div
              className={`text-xl font-extrabold mt-1 ${
                metrics.financials.roiPercentage !== null
                  ? metrics.financials.roiPercentage >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {metrics.financials.roiPercentage !== null
                ? `${metrics.financials.roiPercentage > 0 ? '+' : ''}${metrics.financials.roiPercentage} %`
                : 'Nezadáno'}
            </div>
            <span className="text-[10px] text-slate-500">
              {metrics.financials.timeSpentMinutesTotal !== null
                ? `Čas: ${Math.floor(metrics.financials.timeSpentMinutesTotal / 60)} h ${metrics.financials.timeSpentMinutesTotal % 60} min`
                : 'Bez odhadu'}
            </span>
          </div>
        </div>

        {/* Firmy s evidovanými financemi / náklady */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Evidované hodnoty zakázek a nákladů u firem
            </h3>
            <button
              onClick={() => openFinancialModal()}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Zadat další firmu</span>
            </button>
          </div>

          {leads.filter(l => l.dealValue || l.costsTracking?.acquisitionCost || l.costsTracking?.otherCosts || l.costsTracking?.timeSpentMinutes).length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 space-y-2">
              <p>Zatím nemáte u žádné firmy zadanou hodnotu zakázky ani náklady na akvizici.</p>
              <button
                onClick={() => openFinancialModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kliknutím zadejte finance u prvního leadu</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="pb-2">Firma</th>
                    <th className="pb-2">Stav CRM</th>
                    <th className="pb-2 text-right">Hodnota zakázky</th>
                    <th className="pb-2 text-right">Náklady na lead</th>
                    <th className="pb-2 text-right">Čas akvizice</th>
                    <th className="pb-2 text-right">Ostatní náklady</th>
                    <th className="pb-2 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {leads
                    .filter(l => l.dealValue || l.costsTracking?.acquisitionCost || l.costsTracking?.otherCosts || l.costsTracking?.timeSpentMinutes)
                    .map(l => (
                      <tr key={l.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 font-medium text-white">
                          <button
                            onClick={() => onSelectLead(l.id)}
                            className="hover:text-blue-400 transition-colors text-left"
                          >
                            {l.companyName}
                          </button>
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {l.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-emerald-400">
                          {l.dealValue !== undefined ? `${l.dealValue.toLocaleString('cs-CZ')} Kč` : '–'}
                        </td>
                        <td className="py-2.5 text-right text-slate-300">
                          {l.costsTracking?.acquisitionCost !== undefined ? `${l.costsTracking.acquisitionCost.toLocaleString('cs-CZ')} Kč` : '–'}
                        </td>
                        <td className="py-2.5 text-right text-slate-400">
                          {l.costsTracking?.timeSpentMinutes !== undefined ? `${l.costsTracking.timeSpentMinutes} min` : '–'}
                        </td>
                        <td className="py-2.5 text-right text-slate-400">
                          {l.costsTracking?.otherCosts !== undefined ? `${l.costsTracking.otherCosts.toLocaleString('cs-CZ')} Kč` : '–'}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => openFinancialModal(l)}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Upravit
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          FINANČNÍ MODAL: ZADÁNÍ HODNOT A NÁKLADŮ
          ========================================================================= */}
      {financialModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Finance & Náklady (ROI)</span>
              </div>
              <button
                onClick={() => setFinancialModalLead(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Firm Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Vyberte firmu v CRM</label>
              <select
                value={financialModalLead.id}
                onChange={(e) => {
                  const sel = leads.find(l => l.id === e.target.value);
                  if (sel) openFinancialModal(sel);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} ({l.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Inputs */}
            <div className="space-y-3.5">
              {/* Deal value */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Hodnota zakázky / nabídky (Kč)
                </label>
                <input
                  type="number"
                  placeholder="např. 50000"
                  value={modalDealValue}
                  onChange={(e) => setModalDealValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Tržba z realizované zakázky nebo výše nabídky
                </span>
              </div>

              {/* Acquisition cost */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Přímé náklady na získání leadu (Kč)
                </label>
                <input
                  type="number"
                  placeholder="např. 1500"
                  value={modalAcquisitionCost}
                  onChange={(e) => setModalAcquisitionCost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Např. nákup databáze, inzerce, kredit na ověření kontaktů
                </span>
              </div>

              {/* Time spent */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Čas strávený akvizicí (v minutách)
                </label>
                <input
                  type="number"
                  placeholder="např. 120"
                  value={modalTimeSpentMinutes}
                  onChange={(e) => setModalTimeSpentMinutes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Příprava nabídky, volání, schůzky (60 min = 1 hodina)
                </span>
              </div>

              {/* Other costs */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Případně další náklady (Kč)
                </label>
                <input
                  type="number"
                  placeholder="např. 500"
                  value={modalOtherCosts}
                  onChange={(e) => setModalOtherCosts(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Doprava na schůzku, občerstvení, subdodávky apod.
                </span>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setFinancialModalLead(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Zrušit
              </button>
              <button
                type="button"
                id="btn-save-financial-modal"
                onClick={handleSaveFinancialModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
              >
                Uložit do CRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
