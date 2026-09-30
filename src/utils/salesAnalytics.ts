import { 
  PotentialCustomerLead, 
  LeadActivity, 
  LeadStatus, 
  ContactChannel, 
  SalesTimeFilter, 
  SalesDataMode 
} from '../types';
import { isFollowUpDueTodayOrOverdue, isFollowUpOverdue, formatCzechDateTime } from './leadActivities';

export function isSimulationActivity(activity: LeadActivity): boolean {
  if (activity.isSimulation === false) return false;
  if (activity.isSimulation === true) return true;
  const res = (activity.result || '').toLowerCase();
  const note = (activity.note || '').toLowerCase();
  return (
    res.includes('simulov') ||
    res.includes('simulace') ||
    note.includes('simulace testovacího') ||
    note.includes('[simulace')
  );
}

export function isDateWithinFilter(dateStr?: string, filter: SalesTimeFilter = 'all'): boolean {
  if (!dateStr || filter === 'all') return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  
  if (filter === '7days') {
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 7);
    return d >= past7;
  }
  if (filter === '30days') {
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    return d >= past30;
  }
  if (filter === 'thisMonth') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

/**
 * Returns the effective status of a lead under a given mode.
 * In 'real_only' mode, if a lead only has simulation activities (e.g. AVISTA or Cowo CB),
 * its real status is restored to before the simulations so simulated meetings
 * do not falsely skew real conversion rates.
 */
export function getLeadEffectiveStatus(lead: PotentialCustomerLead, mode: SalesDataMode): LeadStatus {
  if (mode === 'all_including_test') {
    return lead.simulationStatus || lead.status;
  }

  // V režimu 'real_only' striktně vracíme skutečný reálný stav leadu
  if (lead.realStatus) {
    return lead.realStatus;
  }

  const activities = lead.activities || [];
  const simulationActs = activities.filter(isSimulationActivity);
  const realActs = activities.filter(a => !isSimulationActivity(a));

  // If there are no simulations, the status is 100% genuine
  if (simulationActs.length === 0) {
    return lead.status;
  }

  // If there are real activities, use the statusAfter of the latest real activity
  if (realActs.length > 0) {
    return realActs[0].statusAfter || lead.status;
  }

  // If there are ONLY simulation activities and NO real activities,
  // the lead's true commercial status is the status before simulations began.
  const earliestSim = simulationActs[simulationActs.length - 1];
  return earliestSim.statusBefore || 'Nový';
}

export interface FunnelStepData {
  id: string;
  label: string;
  count: number;
  conversionFromPrev: number | null; // null if prev is 0 (Nedostatek dat)
  percentageOfTotal: number | null;
}

export interface ConversionRateItem {
  id: string;
  label: string;
  fromLabel: string;
  toLabel: string;
  numerator: number;
  denominator: number;
  rate: number | null; // percentage or null if denominator === 0
}

export interface ActivityBreakdown {
  emails: number;
  phones: number;
  whatsapps: number;
  meetings: number;
  all: number;
}

export interface SalesMetricsResult {
  mode: SalesDataMode;
  timeFilter: SalesTimeFilter;
  filteredLeads: PotentialCustomerLead[];
  totalLeads: number;

  // A) Hlavní metriky (stavy)
  statusCounts: {
    total: number;
    new: number; // Nový + Dnes oslovit
    contacted: number; // Osloveno + Odpověděl
    interested: number; // Zájem
    meeting: number; // Schůzka
    proposal: number; // Nabídka
    customer: number; // Zákazník
    lost: number; // Odmítnuto + Nekontaktovat
    breakdown: Record<LeadStatus, number>;
  };

  // B) Obchodní funnel
  funnel: FunnelStepData[];

  // 2. Konverzní metriky
  conversions: {
    contactToInterest: ConversionRateItem;
    interestToMeeting: ConversionRateItem;
    meetingToProposal: ConversionRateItem;
    proposalToCustomer: ConversionRateItem;
    leadToCustomer: ConversionRateItem;
  };

  // 3. Aktivita (Reálné vs Testovací)
  activityStats: {
    real: ActivityBreakdown;
    simulation: ActivityBreakdown;
    totalContacts: number;
    hasSimulations: boolean;
    simulationNotice: string;
  };

  // 4. Reálný obchodní výkon
  realPerformance: {
    contactedCompanies: number;
    interestedCompanies: number;
    meetingCompanies: number;
    proposalCompanies: number;
    customerCompanies: number;
  };

  // 5. Hodnota obchodu & Přesná ROI kalkulace
  financials: {
    hasFinancialData: boolean;
    pipelineValue: number; // backward-compat: open deals sum
    proposalsValue: number; // backward-compat: proposals sum
    wonValue: number; // backward-compat: won customers sum
    openDealsValue: number | null; // null if not entered
    openDealsCount: number;
    wonCustomersValue: number | null; // null if not entered
    wonCustomersCount: number;
    avgCustomerValue: number | null; // null if not entered
    acquisitionCostsTotal: number | null; // null if not entered
    timeSpentMinutesTotal: number | null; // null if not entered
    netRevenue: number | null; // null if either missing
    roiPercentage: number | null; // null if either missing or costs <= 0
    leadsWithValueCount: number;
  };

  // 6. Pipeline (Potenciální obchody)
  pipeline: {
    meetings: PotentialCustomerLead[];
    proposals: PotentialCustomerLead[];
    customers: PotentialCustomerLead[];
    totalPipelineValue: number;
  };

  // 7. Nejlepší leady (Nejzajímavější obchodní příležitosti)
  topOpportunities: PotentialCustomerLead[];

  // 8. Follow-up (Co mám řešit dnes)
  todayFollowUps: {
    lead: PotentialCustomerLead;
    priorityReason: string;
    priorityLevel: 'critical' | 'high' | 'medium';
    scheduledText: string;
  }[];

  // 9. Trendy
  trends: {
    hasEnoughData: boolean;
    summary: {
      contacts: number;
      interests: number;
      meetings: number;
      proposals: number;
      customers: number;
    };
    dataPoints: {
      dateKey: string;
      displayDate: string;
      newLeads: number;
      contacts: number;
      interests: number;
      meetings: number;
      proposals: number;
      customers: number;
    }[];
  };

  // 12. Testovací oddělení info
  testSeparation: {
    simulatedLeadsCount: number;
    simulatedActivitiesCount: number;
    noticeText: string;
  };
}

export function calculateSalesMetrics(
  allLeads: PotentialCustomerLead[],
  timeFilter: SalesTimeFilter = 'all',
  mode: SalesDataMode = 'real_only'
): SalesMetricsResult {
  // 1. Filter leads by time window
  const filteredLeads = allLeads.filter(lead => {
    if (timeFilter === 'all') return true;
    const addedMatch = isDateWithinFilter(lead.addedAt, timeFilter);
    const contactMatch = isDateWithinFilter(lead.lastContactedAt, timeFilter);
    const acts = (lead.activities || []).filter(a => {
      if (mode === 'real_only' && isSimulationActivity(a)) return false;
      return isDateWithinFilter(a.createdAt, timeFilter);
    });
    return addedMatch || contactMatch || acts.length > 0;
  });

  const totalLeads = filteredLeads.length;

  // Initialize breakdown
  const statusBreakdown: Record<LeadStatus, number> = {
    'Nový': 0,
    'Dnes oslovit': 0,
    'Osloveno': 0,
    'Odpověděl': 0,
    'Zájem': 0,
    'Schůzka': 0,
    'Nabídka': 0,
    'Zákazník': 0,
    'Odmítnuto': 0,
    'Nekontaktovat': 0
  };

  let simulatedLeadsCount = 0;

  // Compute effective status for each lead
  filteredLeads.forEach(lead => {
    const hasSim = (lead.activities || []).some(isSimulationActivity);
    if (hasSim) simulatedLeadsCount++;

    const effectiveStatus = getLeadEffectiveStatus(lead, mode);
    if (statusBreakdown[effectiveStatus] !== undefined) {
      statusBreakdown[effectiveStatus]++;
    } else {
      statusBreakdown['Nový']++;
    }
  });

  const newCount = statusBreakdown['Nový'] + statusBreakdown['Dnes oslovit'];
  const contactedCount = statusBreakdown['Osloveno'] + statusBreakdown['Odpověděl'];
  const interestedCount = statusBreakdown['Zájem'];
  const meetingCount = statusBreakdown['Schůzka'];
  const proposalCount = statusBreakdown['Nabídka'];
  const customerCount = statusBreakdown['Zákazník'];
  const lostCount = statusBreakdown['Odmítnuto'] + statusBreakdown['Nekontaktovat'];

  // Funnel progression counts:
  // A lead has reached step X if its effective status is at or past step X.
  let reachedNew = totalLeads;
  let reachedOsloveno = 0;
  let reachedZajem = 0;
  let reachedSchuzka = 0;
  let reachedNabidka = 0;
  let reachedZakaznik = 0;

  filteredLeads.forEach(lead => {
    const effStatus = getLeadEffectiveStatus(lead, mode);
    const realActs = (lead.activities || []).filter(a => mode === 'real_only' ? !isSimulationActivity(a) : true);

    const hasContact = realActs.length > 0 || ['Osloveno', 'Odpověděl', 'Zájem', 'Schůzka', 'Nabídka', 'Zákazník'].includes(effStatus);
    const hasZajem = ['Zájem', 'Schůzka', 'Nabídka', 'Zákazník'].includes(effStatus);
    const hasSchuzka = ['Schůzka', 'Nabídka', 'Zákazník'].includes(effStatus);
    const hasNabidka = ['Nabídka', 'Zákazník'].includes(effStatus);
    const hasZakaznik = effStatus === 'Zákazník';

    if (hasContact) reachedOsloveno++;
    if (hasZajem) reachedZajem++;
    if (hasSchuzka) reachedSchuzka++;
    if (hasNabidka) reachedNabidka++;
    if (hasZakaznik) reachedZakaznik++;
  });

  const calcConversion = (numerator: number, denominator: number): number | null => {
    if (denominator <= 0) return null;
    return Math.round((numerator / denominator) * 1000) / 10;
  };

  const funnel: FunnelStepData[] = [
    {
      id: 'step-new',
      label: 'Nový',
      count: reachedNew,
      conversionFromPrev: reachedNew > 0 ? 100 : null,
      percentageOfTotal: reachedNew > 0 ? 100 : null
    },
    {
      id: 'step-osloveno',
      label: 'Osloveno',
      count: reachedOsloveno,
      conversionFromPrev: calcConversion(reachedOsloveno, reachedNew),
      percentageOfTotal: calcConversion(reachedOsloveno, reachedNew)
    },
    {
      id: 'step-zajem',
      label: 'Zájem',
      count: reachedZajem,
      conversionFromPrev: calcConversion(reachedZajem, reachedOsloveno),
      percentageOfTotal: calcConversion(reachedZajem, reachedNew)
    },
    {
      id: 'step-schuzka',
      label: 'Schůzka',
      count: reachedSchuzka,
      conversionFromPrev: calcConversion(reachedSchuzka, reachedZajem),
      percentageOfTotal: calcConversion(reachedSchuzka, reachedNew)
    },
    {
      id: 'step-nabidka',
      label: 'Nabídka',
      count: reachedNabidka,
      conversionFromPrev: calcConversion(reachedNabidka, reachedSchuzka),
      percentageOfTotal: calcConversion(reachedNabidka, reachedNew)
    },
    {
      id: 'step-zakaznik',
      label: 'Zákazník',
      count: reachedZakaznik,
      conversionFromPrev: calcConversion(reachedZakaznik, reachedNabidka),
      percentageOfTotal: calcConversion(reachedZakaznik, reachedNew)
    }
  ];

  // 2. Konverzní metriky
  const conversions = {
    contactToInterest: {
      id: 'conv-contact-interest',
      label: 'Kontakt → Zájem',
      fromLabel: 'Osloveno',
      toLabel: 'Zájem',
      numerator: reachedZajem,
      denominator: reachedOsloveno,
      rate: calcConversion(reachedZajem, reachedOsloveno)
    },
    interestToMeeting: {
      id: 'conv-interest-meeting',
      label: 'Zájem → Schůzka',
      fromLabel: 'Zájem',
      toLabel: 'Schůzka',
      numerator: reachedSchuzka,
      denominator: reachedZajem,
      rate: calcConversion(reachedSchuzka, reachedZajem)
    },
    meetingToProposal: {
      id: 'conv-meeting-proposal',
      label: 'Schůzka → Nabídka',
      fromLabel: 'Schůzka',
      toLabel: 'Nabídka',
      numerator: reachedNabidka,
      denominator: reachedSchuzka,
      rate: calcConversion(reachedNabidka, reachedSchuzka)
    },
    proposalToCustomer: {
      id: 'conv-proposal-customer',
      label: 'Nabídka → Zákazník',
      fromLabel: 'Nabídka',
      toLabel: 'Zákazník',
      numerator: reachedZakaznik,
      denominator: reachedNabidka,
      rate: calcConversion(reachedZakaznik, reachedNabidka)
    },
    leadToCustomer: {
      id: 'conv-lead-customer',
      label: 'Lead → Zákazník',
      fromLabel: 'Celkem leadů',
      toLabel: 'Zákazník',
      numerator: reachedZakaznik,
      denominator: totalLeads,
      rate: calcConversion(reachedZakaznik, totalLeads)
    }
  };

  // 3. Aktivity rozdělení
  const realActs: ActivityBreakdown = { emails: 0, phones: 0, whatsapps: 0, meetings: 0, all: 0 };
  const simActs: ActivityBreakdown = { emails: 0, phones: 0, whatsapps: 0, meetings: 0, all: 0 };

  filteredLeads.forEach(lead => {
    (lead.activities || []).forEach(act => {
      if (!isDateWithinFilter(act.createdAt, timeFilter)) return;
      const isSim = isSimulationActivity(act);
      const target = isSim ? simActs : realActs;

      target.all++;
      if (act.channel === 'email') target.emails++;
      else if (act.channel === 'phone') target.phones++;
      else if (act.channel === 'whatsapp') target.whatsapps++;
      else if (act.channel === 'meeting' || (act.result || '').toLowerCase().includes('schůzk')) target.meetings++;
    });
  });

  const totalContacts = realActs.all + simActs.all;
  const hasSimulations = simActs.all > 0;

  // 4. Reálný obchodní výkon (Pouze skutečné CRM aktivity a stavy)
  let realContactedCompanies = 0;
  let realInterestedCompanies = 0;
  let realMeetingCompanies = 0;
  let realProposalCompanies = 0;
  let realCustomerCompanies = 0;

  filteredLeads.forEach(lead => {
    const leadRealActs = (lead.activities || []).filter(a => !isSimulationActivity(a));
    const realStatus = getLeadEffectiveStatus(lead, 'real_only');

    if (leadRealActs.length > 0 || ['Osloveno', 'Odpověděl', 'Zájem', 'Schůzka', 'Nabídka', 'Zákazník'].includes(realStatus)) {
      realContactedCompanies++;
    }
    if (['Zájem', 'Schůzka', 'Nabídka', 'Zákazník'].includes(realStatus)) {
      realInterestedCompanies++;
    }
    if (['Schůzka', 'Nabídka', 'Zákazník'].includes(realStatus)) {
      realMeetingCompanies++;
    }
    if (['Nabídka', 'Zákazník'].includes(realStatus)) {
      realProposalCompanies++;
    }
    if (realStatus === 'Zákazník') {
      realCustomerCompanies++;
    }
  });

  // 5. Hodnota obchodu & Přesná ROI kalkulace (bez jakýchkoliv odhadů)
  let openDealsSum = 0;
  let openDealsCount = 0;
  let wonCustomersSum = 0;
  let wonCustomersWithValueCount = 0;
  let wonCustomersCount = 0;

  let totalAcquisitionCost = 0;
  let hasAnyCostEntered = false;
  let totalTimeSpentMinutes = 0;
  let hasAnyTimeEntered = false;
  let leadsWithValueCount = 0;

  filteredLeads.forEach(lead => {
    const effStatus = getLeadEffectiveStatus(lead, mode);
    const val = typeof lead.dealValue === 'number' && lead.dealValue > 0 ? lead.dealValue : undefined;

    if (val !== undefined) {
      leadsWithValueCount++;
      if (['Schůzka', 'Nabídka'].includes(effStatus)) {
        openDealsSum += val;
        openDealsCount++;
      } else if (effStatus === 'Zákazník') {
        wonCustomersSum += val;
        wonCustomersWithValueCount++;
      }
    }

    if (effStatus === 'Zákazník') {
      wonCustomersCount++;
    }

    const ct = lead.costsTracking;
    if (ct) {
      const ac = typeof ct.acquisitionCost === 'number' && ct.acquisitionCost > 0 ? ct.acquisitionCost : 0;
      const oc = typeof ct.outreachCost === 'number' && ct.outreachCost > 0 ? ct.outreachCost : 0;
      const other = typeof ct.otherCosts === 'number' && ct.otherCosts > 0 ? ct.otherCosts : 0;
      const costForLead = ac + oc + other;
      if (costForLead > 0 || ct.acquisitionCost !== undefined || ct.outreachCost !== undefined || ct.otherCosts !== undefined) {
        totalAcquisitionCost += costForLead;
        hasAnyCostEntered = true;
      }
      if (typeof ct.timeSpentMinutes === 'number' && ct.timeSpentMinutes > 0) {
        totalTimeSpentMinutes += ct.timeSpentMinutes;
        hasAnyTimeEntered = true;
      }
    }
  });

  const openDealsValue = openDealsCount > 0 ? openDealsSum : null;
  const wonCustomersValue = wonCustomersWithValueCount > 0 ? wonCustomersSum : null;
  const avgCustomerValue = (wonCustomersValue !== null && wonCustomersWithValueCount > 0)
    ? Math.round(wonCustomersValue / wonCustomersWithValueCount)
    : null;
  const acquisitionCostsTotal = hasAnyCostEntered ? totalAcquisitionCost : null;
  const timeSpentMinutesTotal = hasAnyTimeEntered ? totalTimeSpentMinutes : null;

  // Čistý výnos a ROI: počítáno výhradně z reálně zadaných hodnot
  let netRevenue: number | null = null;
  let roiPercentage: number | null = null;

  if (wonCustomersValue !== null && acquisitionCostsTotal !== null) {
    netRevenue = wonCustomersValue - acquisitionCostsTotal;
    if (acquisitionCostsTotal > 0) {
      roiPercentage = Math.round(((wonCustomersValue - acquisitionCostsTotal) / acquisitionCostsTotal) * 1000) / 10;
    }
  }

  const hasFinancialData = leadsWithValueCount > 0 || hasAnyCostEntered || hasAnyTimeEntered;

  // 6. Pipeline (Potenciální obchody)
  const pipelineMeetings: PotentialCustomerLead[] = [];
  const pipelineProposals: PotentialCustomerLead[] = [];
  const pipelineCustomers: PotentialCustomerLead[] = [];

  filteredLeads.forEach(lead => {
    const effStatus = getLeadEffectiveStatus(lead, mode);
    if (effStatus === 'Schůzka') pipelineMeetings.push(lead);
    else if (effStatus === 'Nabídka') pipelineProposals.push(lead);
    else if (effStatus === 'Zákazník') pipelineCustomers.push(lead);
  });

  // 7. Nejlepší leady (Nejzajímavější obchodní příležitosti)
  const topOpportunities = [...filteredLeads]
    .filter(lead => {
      const effStatus = getLeadEffectiveStatus(lead, mode);
      if (['Odmítnuto', 'Nekontaktovat'].includes(effStatus)) return false;
      const isWarm = ['Zájem', 'Schůzka', 'Nabídka'].includes(effStatus);
      const isHighFit = lead.fitScore >= 70;
      const realActs = (lead.activities || []).filter(a => !isSimulationActivity(a));
      const hasFollowUp = mode === 'real_only'
        ? !!(lead.realNextContactDate || (realActs.length > 0 ? (lead.nextContactDate || lead.scheduledAt) : undefined))
        : !!(lead.simulationNextContactDate || lead.nextContactDate || lead.scheduledAt);
      const hasRecentAct = mode === 'real_only'
        ? realActs.length > 0
        : (lead.activities || []).length > 0;
      return isWarm || isHighFit || hasFollowUp || hasRecentAct;
    })
    .sort((a, b) => {
      const statusWeight: Record<LeadStatus, number> = {
        'Nabídka': 6,
        'Schůzka': 5,
        'Zájem': 4,
        'Odpověděl': 3,
        'Osloveno': 2,
        'Dnes oslovit': 2,
        'Nový': 1,
        'Zákazník': 0,
        'Odmítnuto': -1,
        'Nekontaktovat': -2
      };
      const aWeight = statusWeight[getLeadEffectiveStatus(a, mode)] || 0;
      const bWeight = statusWeight[getLeadEffectiveStatus(b, mode)] || 0;
      if (aWeight !== bWeight) return bWeight - aWeight;

      // Check overdue / due today
      const aDate = mode === 'real_only'
        ? (a.realNextContactDate || (a.activities?.some(act => !isSimulationActivity(act)) ? (a.nextContactDate || a.scheduledAt) : undefined))
        : (a.simulationNextContactDate || a.nextContactDate || a.scheduledAt);
      const bDate = mode === 'real_only'
        ? (b.realNextContactDate || (b.activities?.some(act => !isSimulationActivity(act)) ? (b.nextContactDate || b.scheduledAt) : undefined))
        : (b.simulationNextContactDate || b.nextContactDate || b.scheduledAt);
      const aDue = isFollowUpDueTodayOrOverdue(aDate) ? 1 : 0;
      const bDue = isFollowUpDueTodayOrOverdue(bDate) ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;

      return (b.fitScore || 0) - (a.fitScore || 0);
    })
    .slice(0, 6);

  // 8. Follow-up (Co mám řešit dnes)
  const todayFollowUps: {
    lead: PotentialCustomerLead;
    priorityReason: string;
    priorityLevel: 'critical' | 'high' | 'medium';
    scheduledText: string;
  }[] = [];

  filteredLeads.forEach(lead => {
    const effStatus = getLeadEffectiveStatus(lead, mode);
    if (['Odmítnuto', 'Nekontaktovat', 'Zákazník'].includes(effStatus)) return;

    // V režimu 'real_only' nesmí být započítány testovací simulované follow-upy
    const unifiedDate = mode === 'real_only'
      ? (lead.realNextContactDate || (lead.activities?.some(act => !isSimulationActivity(act)) ? (lead.nextContactDate || lead.scheduledAt) : undefined))
      : (lead.simulationNextContactDate || lead.nextContactDate || lead.scheduledAt);

    const hasNext = !!unifiedDate;
    const isOverdue = isFollowUpOverdue(unifiedDate);
    const isDue = isFollowUpDueTodayOrOverdue(unifiedDate);

    if (isOverdue) {
      todayFollowUps.push({
        lead,
        priorityReason: 'Follow-up je po termínu!',
        priorityLevel: 'critical',
        scheduledText: formatCzechDateTime(unifiedDate)
      });
    } else if (isDue) {
      todayFollowUps.push({
        lead,
        priorityReason: 'Kontakt naplánován na dnešek',
        priorityLevel: 'high',
        scheduledText: formatCzechDateTime(unifiedDate)
      });
    } else if (effStatus === 'Schůzka') {
      todayFollowUps.push({
        lead,
        priorityReason: 'Domluvená schůzka – připravit podklady',
        priorityLevel: 'high',
        scheduledText: hasNext ? formatCzechDateTime(unifiedDate) : 'Termín schůzky'
      });
    } else if (effStatus === 'Nabídka') {
      todayFollowUps.push({
        lead,
        priorityReason: 'Nabídka odeslána – čeká na rozhodnutí zákazníka',
        priorityLevel: 'medium',
        scheduledText: hasNext ? formatCzechDateTime(unifiedDate) : 'Fáze nabídky'
      });
    } else if (lead.contactToday || effStatus === 'Dnes oslovit') {
      todayFollowUps.push({
        lead,
        priorityReason: 'Označeno jako Dnes oslovit',
        priorityLevel: 'medium',
        scheduledText: 'Dnes'
      });
    }
  });

  // Sort today follow-ups by urgency
  todayFollowUps.sort((a, b) => {
    const rank = { critical: 3, high: 2, medium: 1 };
    return rank[b.priorityLevel] - rank[a.priorityLevel];
  });

  // 9. Trendy: Agregace reálných aktivit podle dnů
  interface DayTrendBucket {
    dateKey: string;
    displayDate: string;
    newLeads: number;
    contacts: number;
    interests: number;
    meetings: number;
    proposals: number;
    customers: number;
  }

  const datesMap: Record<string, DayTrendBucket> = {};

  filteredLeads.forEach(lead => {
    if (lead.addedAt && isDateWithinFilter(lead.addedAt, timeFilter)) {
      const day = lead.addedAt.substring(0, 10);
      if (!datesMap[day]) {
        const parts = day.split('-');
        datesMap[day] = {
          dateKey: day,
          displayDate: parts.length === 3 ? `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.` : day,
          newLeads: 0,
          contacts: 0,
          interests: 0,
          meetings: 0,
          proposals: 0,
          customers: 0
        };
      }
      datesMap[day].newLeads++;
    }

    (lead.activities || []).forEach(act => {
      if (mode === 'real_only' && isSimulationActivity(act)) return;
      if (act.createdAt && isDateWithinFilter(act.createdAt, timeFilter)) {
        const day = act.createdAt.substring(0, 10);
        if (!datesMap[day]) {
          const parts = day.split('-');
          datesMap[day] = {
            dateKey: day,
            displayDate: parts.length === 3 ? `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.` : day,
            newLeads: 0,
            contacts: 0,
            interests: 0,
            meetings: 0,
            proposals: 0,
            customers: 0
          };
        }
        targetTrendActivity(datesMap[day], act);
      }
    });
  });

  const distinctDays = Object.keys(datesMap).sort();
  // Zobrazit trendy jakmile existují data za více než 1 den (>= 2 dny), jinak Nedostatek dat
  const hasEnoughData = distinctDays.length >= 2;

  const dataPoints = distinctDays.map(dayKey => datesMap[dayKey]);

  const trendSummary = {
    contacts: dataPoints.reduce((sum, p) => sum + p.contacts, 0),
    interests: dataPoints.reduce((sum, p) => sum + p.interests, 0),
    meetings: dataPoints.reduce((sum, p) => sum + p.meetings, 0),
    proposals: dataPoints.reduce((sum, p) => sum + p.proposals, 0),
    customers: dataPoints.reduce((sum, p) => sum + p.customers, 0)
  };

  return {
    mode,
    timeFilter,
    filteredLeads,
    totalLeads,
    statusCounts: {
      total: totalLeads,
      new: newCount,
      contacted: contactedCount,
      interested: interestedCount,
      meeting: meetingCount,
      proposal: proposalCount,
      customer: customerCount,
      lost: lostCount,
      breakdown: statusBreakdown
    },
    funnel,
    conversions,
    activityStats: {
      real: realActs,
      simulation: simActs,
      totalContacts,
      hasSimulations,
      simulationNotice: hasSimulations 
        ? `${simActs.all} ${simActs.all === 1 ? 'testovací simulace' : 'testovacích simulací'} uloženo v CRM (nezapočítáno do reálných výsledků).`
        : 'Žádné testovací simulace nebyly v CRM nalezeny.'
    },
    realPerformance: {
      contactedCompanies: realContactedCompanies,
      interestedCompanies: realInterestedCompanies,
      meetingCompanies: realMeetingCompanies,
      proposalCompanies: realProposalCompanies,
      customerCompanies: realCustomerCompanies
    },
    financials: {
      hasFinancialData,
      pipelineValue: openDealsValue || 0,
      proposalsValue: openDealsValue || 0,
      wonValue: wonCustomersValue || 0,
      openDealsValue,
      openDealsCount,
      wonCustomersValue,
      wonCustomersCount,
      avgCustomerValue,
      acquisitionCostsTotal,
      timeSpentMinutesTotal,
      netRevenue,
      roiPercentage,
      leadsWithValueCount
    },
    pipeline: {
      meetings: pipelineMeetings,
      proposals: pipelineProposals,
      customers: pipelineCustomers,
      totalPipelineValue: (openDealsValue || 0) + (wonCustomersValue || 0)
    },
    topOpportunities,
    todayFollowUps,
    trends: {
      hasEnoughData,
      summary: trendSummary,
      dataPoints
    },
    testSeparation: {
      simulatedLeadsCount,
      simulatedActivitiesCount: simActs.all,
      noticeText: simulatedLeadsCount > 0
        ? `Testovací data (${simulatedLeadsCount} ${simulatedLeadsCount === 1 ? 'firma' : 'firmy'}, ${simActs.all} simulací) jsou striktně oddělena od reálného obchodního výkonu.`
        : 'Všechny zaznamenané aktivity pocházejí ze skutečného kontaktu.'
    }
  };
}

function targetTrendActivity(
  bucket: { 
    newLeads: number; 
    contacts: number; 
    interests: number; 
    meetings: number; 
    proposals: number; 
    customers: number 
  },
  act: LeadActivity
) {
  bucket.contacts++;
  const res = (act.result || '').toLowerCase();
  const note = (act.note || '').toLowerCase();

  if (act.statusAfter === 'Zájem' || res.includes('zájem') || res.includes('zajem') || note.includes('zájem')) {
    bucket.interests++;
  }
  if (act.statusAfter === 'Schůzka' || act.channel === 'meeting' || res.includes('schůzk') || res.includes('schuzk')) {
    bucket.meetings++;
  }
  if (act.statusAfter === 'Nabídka' || res.includes('nabídk') || res.includes('nabidk')) {
    bucket.proposals++;
  }
  if (act.statusAfter === 'Zákazník' || res.includes('zákazník') || res.includes('zakaznik') || res.includes('uzavřen')) {
    bucket.customers++;
  }
}
