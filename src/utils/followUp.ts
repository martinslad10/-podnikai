import { PotentialCustomerLead, LeadStatus, ContactChannel } from '../types';

export const DEFAULT_STALE_DAYS = 7;

export type FollowUpCategory = 
  | 'overdue'      // 🔴 Po termínu
  | 'today'        // 🟠 Dnes
  | 'tomorrow'     // 🟡 Zítra
  | 'this_week'    // 🔵 Tento týden
  | 'meeting'      // 🟢 Schůzky
  | 'quote'        // 💰 Nabídky
  | 'no_next_step' // ⚪ Bez dalšího kroku
  | 'stale';       // ⏳ Dlouho bez kontaktu

export type FollowUpFilterType = 
  | 'all'
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'meetings'
  | 'quotes'
  | 'no_next_step'
  | 'stale';

export interface NextStepActionInfo {
  label: string;
  description: string;
  actionType: 'outreach' | 'outreach_next_step' | 'meeting' | 'quote' | 'customer' | 'schedule';
  channelRecommendation?: ContactChannel;
}

/**
 * Returns date boundaries for today, tomorrow, and this week based on client local time.
 */
export function getDateBoundaries(referenceDate: Date = new Date()) {
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);

  const startOfTomorrow = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1, 0, 0, 0, 0);
  const endOfTomorrow = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1, 23, 59, 59, 999);

  // End of current calendar week (Sunday in Czech week)
  const currentDay = referenceDate.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
  const endOfWeek = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + daysUntilSunday, 23, 59, 59, 999);

  return {
    startOfToday,
    endOfToday,
    startOfTomorrow,
    endOfTomorrow,
    endOfWeek
  };
}

/**
 * Resolves the effective next contact date for a lead, respecting real vs simulation separation.
 */
export function getEffectiveNextContactDate(lead: PotentialCustomerLead, includeSimulation: boolean = false): string | undefined {
  if (includeSimulation && lead.simulationNextContactDate) {
    return lead.simulationNextContactDate;
  }
  return lead.realNextContactDate || (lead.activities?.some(a => !a.isSimulation) ? lead.nextContactDate : undefined) || (!lead.simulationStatus ? (lead.nextContactDate || lead.scheduledAt) : undefined);
}

/**
 * Resolves effective last contacted date for a lead.
 */
export function getEffectiveLastContactedAt(lead: PotentialCustomerLead, includeSimulation: boolean = false): string | undefined {
  if (includeSimulation && lead.simulationLastContactedAt) {
    return lead.simulationLastContactedAt;
  }
  return lead.lastContactedAt || lead.activities?.find(a => !a.isSimulation)?.createdAt;
}

/**
 * Resolves effective status for a lead.
 */
export function getEffectiveStatus(lead: PotentialCustomerLead, includeSimulation: boolean = false): LeadStatus {
  if (includeSimulation && lead.simulationStatus) {
    return lead.simulationStatus;
  }
  return lead.realStatus || lead.status || 'Nový';
}

/**
 * Calculates days elapsed between a date string and now.
 */
export function getDaysSince(dateStr?: string, referenceDate: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diffMs = referenceDate.getTime() - d.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes a single lead into all matching FollowUpCategories.
 */
export function getLeadFollowUpCategories(
  lead: PotentialCustomerLead,
  includeSimulation: boolean = false,
  referenceDate: Date = new Date()
): FollowUpCategory[] {
  const categories: FollowUpCategory[] = [];
  const status = getEffectiveStatus(lead, includeSimulation);
  const nextDateStr = getEffectiveNextContactDate(lead, includeSimulation);
  const lastContactStr = getEffectiveLastContactedAt(lead, includeSimulation);
  const boundaries = getDateBoundaries(referenceDate);

  const isClosed = ['Odmítnuto', 'Nekontaktovat'].includes(status);
  const isCustomer = status === 'Zákazník';

  // Validace skutečného plánovaného termínu dalšího kontaktu
  let hasValidNextDate = false;
  let nextTime = NaN;
  if (nextDateStr && typeof nextDateStr === 'string' && nextDateStr.trim() !== '') {
    nextTime = new Date(nextDateStr).getTime();
    if (!isNaN(nextTime)) {
      hasValidNextDate = true;
    }
  }

  // If customer or closed, do not include in follow-ups UNLESS there is an explicit upcoming scheduled next date
  if ((isClosed || isCustomer) && !hasValidNextDate) {
    return categories;
  }

  // 1. Check scheduled date buckets (PO TERMÍNU, DNES, ZÍTRA, TENTO TÝDEN)
  // Výhradně na základě skutečného plánovaného termínu dalšího kontaktu!
  if (hasValidNextDate) {
    if (nextTime < boundaries.startOfToday.getTime()) {
      categories.push('overdue'); // 🔴 Po termínu
    } else if (nextTime <= boundaries.endOfToday.getTime()) {
      categories.push('today'); // 🟠 Dnes
    } else if (nextTime <= boundaries.endOfTomorrow.getTime()) {
      categories.push('tomorrow'); // 🟡 Zítra
    } else if (nextTime <= boundaries.endOfWeek.getTime()) {
      categories.push('this_week'); // 🔵 Tento týden
    }
  }

  // 2. 🟢 Schůzky (status Schůzka)
  if (status === 'Schůzka') {
    categories.push('meeting');
  }

  // 3. 💰 Nabídky (status Nabídka, still open)
  if (status === 'Nabídka') {
    categories.push('quote');
  }

  // 4. ⚪ Leady bez dalšího kroku
  // Aktivní leady, které:
  // - nemají naplánovaný další kontakt,
  // - nejsou v aktivní schůzce,
  // - nejsou v nabídce čekající na rozhodnutí,
  // - a vyžadují naplánování dalšího kroku.
  if (!isClosed && !isCustomer && status !== 'Schůzka' && status !== 'Nabídka' && !hasValidNextDate) {
    categories.push('no_next_step');
  }

  // 5. ⏳ Leady dlouho bez kontaktu (Section 9)
  // Active, not customer, no active meeting, contacted in the past >= 7 days ago
  if (!isClosed && !isCustomer && status !== 'Schůzka' && lastContactStr) {
    const daysSinceLast = getDaysSince(lastContactStr, referenceDate);
    if (daysSinceLast !== null && daysSinceLast >= DEFAULT_STALE_DAYS) {
      categories.push('stale');
    }
  }

  return categories;
}

/**
 * Computes global statistics for Follow-up dashboard.
 * - počet akcí na dnešek
 * - počet po termínu
 * - počet naplánovaných na tento týden
 * - počet otevřených nabídek
 * - počet nadcházejících schůzek
 */
export function computeFollowUpStats(leads: PotentialCustomerLead[], includeSimulation: boolean = false, referenceDate: Date = new Date()) {
  let todayCount = 0;
  let overdueCount = 0;
  let thisWeekCount = 0;
  let openQuotesCount = 0;
  let upcomingMeetingsCount = 0;
  let noNextStepCount = 0;
  let staleCount = 0;

  for (const lead of leads) {
    const cats = getLeadFollowUpCategories(lead, includeSimulation, referenceDate);
    if (cats.includes('today')) todayCount++;
    if (cats.includes('overdue')) overdueCount++;
    if (cats.includes('this_week')) thisWeekCount++;
    if (cats.includes('quote')) openQuotesCount++;
    if (cats.includes('meeting')) upcomingMeetingsCount++;
    if (cats.includes('no_next_step')) noNextStepCount++;
    if (cats.includes('stale')) staleCount++;
  }

  return {
    todayCount,
    overdueCount,
    thisWeekCount,
    openQuotesCount,
    upcomingMeetingsCount,
    noNextStepCount,
    staleCount,
    totalPriorityCount: overdueCount + todayCount
  };
}

/**
 * Returns prioritized leads for "Co vyžaduje pozornost".
 * Strict order mandated:
 * 1. po termínu
 * 2. dnes
 * 3. zítra
 * 4. schůzky
 * 5. nabídky
 * 6. tento týden
 * 
 * Inside same category:
 * - closest term first
 * - then newest activity
 * - then higher dealValue
 */
export function getPrioritizedAttentionLeads(
  leads: PotentialCustomerLead[],
  includeSimulation: boolean = false,
  referenceDate: Date = new Date()
): Array<{ lead: PotentialCustomerLead; primaryCategory: FollowUpCategory; allCategories: FollowUpCategory[] }> {
  const result: Array<{ lead: PotentialCustomerLead; primaryCategory: FollowUpCategory; allCategories: FollowUpCategory[] }> = [];

  const categoryOrderScore: Record<FollowUpCategory, number> = {
    overdue: 1,
    today: 2,
    tomorrow: 3,
    meeting: 4,
    quote: 5,
    this_week: 6,
    no_next_step: 7,
    stale: 8
  };

  for (const lead of leads) {
    const cats = getLeadFollowUpCategories(lead, includeSimulation, referenceDate);
    // Only items that fall into priority attention (overdue, today, tomorrow, meeting, quote, this_week)
    const priorityCat = (['overdue', 'today', 'tomorrow', 'meeting', 'quote', 'this_week'] as FollowUpCategory[])
      .find(c => cats.includes(c));

    if (priorityCat) {
      result.push({
        lead,
        primaryCategory: priorityCat,
        allCategories: cats
      });
    }
  }

  result.sort((a, b) => {
    const scoreA = categoryOrderScore[a.primaryCategory] ?? 99;
    const scoreB = categoryOrderScore[b.primaryCategory] ?? 99;
    if (scoreA !== scoreB) return scoreA - scoreB;

    // Inside same category:
    const dateA = getEffectiveNextContactDate(a.lead, includeSimulation);
    const dateB = getEffectiveNextContactDate(b.lead, includeSimulation);
    if (dateA && dateB) {
      const timeDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
      if (timeDiff !== 0) return timeDiff;
    } else if (dateA && !dateB) {
      return -1;
    } else if (!dateA && dateB) {
      return 1;
    }

    // Then dealValue descending
    const dealA = a.lead.dealValue || 0;
    const dealB = b.lead.dealValue || 0;
    if (dealB !== dealA) return dealB - dealA;

    // Then newest activity or addedAt
    const lastA = getEffectiveLastContactedAt(a.lead, includeSimulation) || a.lead.addedAt || '';
    const lastB = getEffectiveLastContactedAt(b.lead, includeSimulation) || b.lead.addedAt || '';
    return lastB.localeCompare(lastA);
  });

  return result;
}

/**
 * Determines the concrete "Co udělat teď" (Next Step) recommendation based on CRM state.
 */
export function getRecommendedNextStep(lead: PotentialCustomerLead, includeSimulation: boolean = false): NextStepActionInfo {
  const status = getEffectiveStatus(lead, includeSimulation);
  const hasPhone = Boolean(lead.phone && lead.phone !== 'Nedostupné');
  const hasEmail = Boolean(lead.email && lead.email !== 'Nedostupné');

  switch (status) {
    case 'Nový':
      return {
        label: 'Otevřít Outreach',
        description: 'Zahájit první kontakt (telefonát nebo personalizovaný e-mail)',
        actionType: 'outreach',
        channelRecommendation: hasPhone ? 'phone' : (hasEmail ? 'email' : undefined)
      };

    case 'Dnes oslovit':
      return {
        label: 'Oslovit dnes',
        description: 'Dnes naplánované první oslovení potenciálního zákazníka',
        actionType: 'outreach',
        channelRecommendation: hasPhone ? 'phone' : (hasEmail ? 'email' : undefined)
      };

    case 'Osloveno':
      return {
        label: 'Otevřít další krok Outreach',
        description: 'Zkontrolovat odezvu na 1. kontakt a pokračovat navazujícím krokem',
        actionType: 'outreach_next_step',
        channelRecommendation: hasPhone ? 'phone' : (hasEmail ? 'email' : undefined)
      };

    case 'Odpověděl':
    case 'Zájem':
      return {
        label: 'Domluvit schůzku',
        description: 'Zájemce reagoval pozitivně – nabídnout konkrétní termín hovoru či schůzky',
        actionType: 'meeting',
        channelRecommendation: hasPhone ? 'phone' : (hasEmail ? 'email' : undefined)
      };

    case 'Schůzka':
      return {
        label: 'Detail schůzky / CRM',
        description: 'Příprava na domluvené jednání (automatický outreach je pozastaven)',
        actionType: 'meeting',
        channelRecommendation: 'meeting'
      };

    case 'Nabídka':
      return {
        label: 'Pokračovat v nabídce',
        description: 'Ověřit stav rozhodnutí u klienta a posunout nabídku k podpisu',
        actionType: 'quote',
        channelRecommendation: hasPhone ? 'phone' : (hasEmail ? 'email' : undefined)
      };

    case 'Zákazník':
      return {
        label: 'Otevřít detail zákazníka',
        description: 'Zakázka je vyhrána – sledování realizace a spokojenosti klienta',
        actionType: 'customer',
        channelRecommendation: undefined
      };

    default:
      return {
        label: 'Otevřít CRM detail',
        description: 'Zkontrolovat historii a případně naplánovat další follow-up',
        actionType: 'schedule',
        channelRecommendation: undefined
      };
  }
}
