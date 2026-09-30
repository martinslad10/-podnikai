import { 
  PotentialCustomerLead, 
  LeadStatus, 
  ContactChannel, 
  AppExecutionMode,
  LeadOutreachSequence
} from '../types';
import { 
  hasVerifiedEmail, 
  hasVerifiedWhatsApp, 
  hasRealSentEmail,
  generateOutreachSequence,
  validateAndSanitizeSequence
} from './outreachGenerator';
import { formatCzechDateOnly } from './leadActivities';

export interface DailyPlanLeadItem {
  lead: PotentialCustomerLead;
  priorityRank: number;
  priorityLabel: string;
  recommendedChannel: 'email' | 'phone' | 'whatsapp';
  recommendedChannelLabel: string;
  recommendedTime: string;
  recommendationReason: string;
  hasPublicEmail: boolean;
  hasPhone: boolean;
  hasVerifiedWhatsApp: boolean;
  isFollowUp: boolean;
  isOverdue: boolean;
  hasSentRealEmail: boolean;
  currentStepIndex: number;
  currentStepTitle: string;
  preparedSubject?: string;
  preparedContent?: string;
  preparedCallScript?: string;
  preparedWhatsApp?: string;
}

export interface DailyPlanCounters {
  todayToContact: number;
  doneToday: number;
  waitingForFollowUp: number;
  meetings: number;
  quotes: number;
}

/**
 * Returns true if the lead has a valid, non-empty, non-dummy phone number.
 */
export function hasPhone(lead: PotentialCustomerLead): boolean {
  if (!lead || !lead.phone) return false;
  const trimmed = lead.phone.trim();
  if (trimmed === '' || trimmed === 'Nedostupné' || trimmed.toLowerCase() === 'neuveden') {
    return false;
  }
  return true;
}

/**
 * Checks whether the lead was contacted today.
 * In real mode: checks real activities and real lastContactedAt.
 * In test mode: checks simulation activities or lastContactedAt.
 */
export function wasContactedToday(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): boolean {
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);

  // Check activities
  const acts = lead.activities || [];
  const hadActToday = acts.some(a => {
    if (!a.createdAt) return false;
    if (appMode === 'real' && a.isSimulation) return false;
    const t = new Date(a.createdAt).getTime();
    return t >= startOfToday.getTime() && t <= endOfToday.getTime();
  });
  if (hadActToday) return true;

  // Check lastContactedAt timestamp
  const contactTimestamp = appMode === 'real'
    ? lead.lastContactedAt
    : (lead.simulationLastContactedAt || lead.lastContactedAt);

  if (contactTimestamp) {
    const t = new Date(contactTimestamp).getTime();
    if (!isNaN(t) && t >= startOfToday.getTime() && t <= endOfToday.getTime()) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the effective next contact date string for a lead, respecting real vs simulation.
 */
export function getEffectiveNextDate(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test'
): string | undefined {
  if (appMode === 'real') {
    return lead.realNextContactDate || (lead.activities?.some(a => !a.isSimulation) ? lead.nextContactDate : undefined);
  }
  return lead.simulationNextContactDate || lead.realNextContactDate || lead.nextContactDate;
}

/**
 * Resolves the effective status of the lead, respecting real vs simulation.
 */
export function getEffectiveLeadStatus(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test'
): LeadStatus {
  if (appMode === 'real') {
    return lead.realStatus || lead.status || 'Nový';
  }
  return lead.simulationStatus || lead.realStatus || lead.status || 'Nový';
}

/**
 * Returns true if the lead has an active follow-up scheduled for the future (tomorrow or later).
 */
export function hasFutureFollowUp(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): boolean {
  const nextDateStr = getEffectiveNextDate(lead, appMode);
  if (!nextDateStr) return false;
  const nextTime = new Date(nextDateStr).getTime();
  if (isNaN(nextTime)) return false;

  const endOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);
  return nextTime > endOfToday.getTime();
}

/**
 * Returns true if the lead has an active follow-up scheduled for today or overdue.
 */
export function hasFollowUpDueTodayOrOverdue(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): boolean {
  const nextDateStr = getEffectiveNextDate(lead, appMode);
  if (!nextDateStr) return false;
  const nextTime = new Date(nextDateStr).getTime();
  if (isNaN(nextTime)) return false;

  const endOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);
  return nextTime <= endOfToday.getTime();
}

/**
 * Returns true if the follow-up is strictly overdue (before start of today).
 */
export function isFollowUpOverdueStrict(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): boolean {
  const nextDateStr = getEffectiveNextDate(lead, appMode);
  if (!nextDateStr) return false;
  const nextTime = new Date(nextDateStr).getTime();
  if (isNaN(nextTime)) return false;

  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0, 0);
  return nextTime < startOfToday.getTime();
}

/**
 * Core eligibility function for "Dnes kontaktovat":
 * 1. Must be ready for outreach.
 * 2. MUST NOT be:
 *    - Customer (Zákazník)
 *    - Meeting (Schůzka)
 *    - Offer (Nabídka) with active future step
 *    - Active follow-up that has not yet occurred (future date)
 *    - Just contacted today with no subsequent step for today
 *    - Dead / Rejected (Odmítnuto / Nekontaktovat)
 */
export function isLeadEligibleForTodayPlan(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): boolean {
  const status = getEffectiveLeadStatus(lead, appMode);

  // 1. Never show customers
  if (status === 'Zákazník') return false;

  // 2. Never show meetings
  if (status === 'Schůzka') return false;

  // 3. Never show rejected or dead leads
  if (status === 'Odmítnuto' || status === 'Nekontaktovat') return false;

  // 4. Offer (Nabídka): do not show if it has an active next step not due today, or if no step due today
  if (status === 'Nabídka') {
    if (hasFutureFollowUp(lead, appMode, referenceDate)) return false;
    if (!hasFollowUpDueTodayOrOverdue(lead, appMode, referenceDate)) return false;
  }

  // 5. Active follow-up that hasn't arrived yet (future date)
  if (hasFutureFollowUp(lead, appMode, referenceDate)) {
    return false;
  }

  // 6. Contacted today and not scheduled for a subsequent step today
  if (wasContactedToday(lead, appMode, referenceDate)) {
    // If it has a follow-up specifically scheduled for today that hasn't passed, check timestamps
    const nextDateStr = getEffectiveNextDate(lead, appMode);
    if (!nextDateStr) return false;
    const nextTime = new Date(nextDateStr).getTime();
    const lastContactTime = new Date(
      (appMode === 'real' ? lead.lastContactedAt : (lead.simulationLastContactedAt || lead.lastContactedAt)) || 0
    ).getTime();
    if (nextTime <= lastContactTime) {
      return false;
    }
  }

  // 7. Check if lead is scheduled for today/overdue
  if (hasFollowUpDueTodayOrOverdue(lead, appMode, referenceDate)) {
    // Has due follow-up, ensure at least one contact method exists
    return hasVerifiedEmail(lead) || hasPhone(lead);
  }

  // 8. Otherwise, must be a new / ready lead awaiting initial outreach
  const isNewUncontacted = (status === 'Nový' || status === 'Dnes oslovit');
  if (isNewUncontacted) {
    // Must have at least one verified contact method
    const canEmail = hasVerifiedEmail(lead);
    const canCall = hasPhone(lead);
    return canEmail || canCall;
  }

  return false;
}

/**
 * Resolves the recommended channel and time according to strict rules:
 * - Public email -> Email
 * - Only phone -> Phone
 * - WhatsApp only if verified
 * - If no email, never suggest email
 * - If no phone, never suggest phone
 */
export function resolveRecommendedChannelAndTime(
  lead: PotentialCustomerLead,
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): {
  channel: 'email' | 'phone' | 'whatsapp';
  channelLabel: string;
  recommendedTime: string;
  reason: string;
  isFollowUp: boolean;
  isOverdue: boolean;
  hasSentRealEmail: boolean;
} {
  const canEmail = hasVerifiedEmail(lead);
  const canPhone = hasPhone(lead);
  const canWhatsApp = hasVerifiedWhatsApp(lead);
  const isDueFollowUp = hasFollowUpDueTodayOrOverdue(lead, appMode, referenceDate);
  const isOverdue = isFollowUpOverdueStrict(lead, appMode, referenceDate);
  const realEmailSent = hasRealSentEmail(lead);

  // Extract scheduled time if available
  const nextDateStr = getEffectiveNextDate(lead, appMode);
  let explicitTimeStr: string | null = null;
  if (nextDateStr) {
    try {
      const d = new Date(nextDateStr);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours();
        const mins = d.getMinutes();
        // If hours and mins are not 00:00 (which is often just midnight date), format as HH:mm
        if (hours !== 0 || mins !== 0) {
          explicitTimeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }
      }
    } catch {
      explicitTimeStr = null;
    }
  }

  // Case A: Follow-up lead (either follow-up due or already has contact history)
  if (isDueFollowUp) {
    // If real email was sent, follow-up call is recommended
    if (realEmailSent && canPhone) {
      return {
        channel: 'phone',
        channelLabel: 'Follow-up (Telefon)',
        recommendedTime: explicitTimeStr || '10:00–12:00',
        reason: 'Navazuje na skutečně odeslaný e-mail',
        isFollowUp: true,
        isOverdue,
        hasSentRealEmail: true
      };
    }

    // Overdue without email
    if (isOverdue && canPhone) {
      return {
        channel: 'phone',
        channelLabel: 'Telefon (Po termínu)',
        recommendedTime: explicitTimeStr || '09:30–11:30',
        reason: canEmail ? 'Termín kontaktu vypršel – doporučen rychlý telefonát' : 'E-mail není veřejně dostupný, telefon je po termínu',
        isFollowUp: true,
        isOverdue: true,
        hasSentRealEmail: realEmailSent
      };
    }

    // Follow-up via verified WhatsApp if preferred/verified
    if (canWhatsApp) {
      return {
        channel: 'whatsapp',
        channelLabel: 'WhatsApp',
        recommendedTime: explicitTimeStr || '11:00–12:30',
        reason: 'Ověřený WhatsApp kontakt k dispozici pro follow-up',
        isFollowUp: true,
        isOverdue,
        hasSentRealEmail: realEmailSent
      };
    }

    // Follow-up via phone if available
    if (canPhone) {
      return {
        channel: 'phone',
        channelLabel: 'Telefon',
        recommendedTime: explicitTimeStr || '13:30–15:00',
        reason: canEmail ? 'Plánovaný telefonický follow-up na dnešek' : 'E-mail není veřejně dostupný, telefon je dostupný',
        isFollowUp: true,
        isOverdue,
        hasSentRealEmail: realEmailSent
      };
    }

    // Follow-up via email if available and no phone
    if (canEmail) {
      return {
        channel: 'email',
        channelLabel: 'E-mail',
        recommendedTime: explicitTimeStr || '09:00–10:30',
        reason: 'Plánovaný e-mailový follow-up na dnešek',
        isFollowUp: true,
        isOverdue,
        hasSentRealEmail: realEmailSent
      };
    }
  }

  // Case B: First Outreach (Nový lead)
  // Rule 4: veřejný e-mail -> E-mail
  if (canEmail) {
    return {
      channel: 'email',
      channelLabel: 'E-mail',
      recommendedTime: '09:00–10:30',
      reason: 'Veřejný e-mail nalezen na oficiálním webu',
      isFollowUp: false,
      isOverdue: false,
      hasSentRealEmail: false
    };
  }

  // Rule 4: pouze telefon -> Telefon
  if (canPhone) {
    return {
      channel: 'phone',
      channelLabel: 'Telefon',
      recommendedTime: '10:00–12:00',
      reason: 'E-mail není veřejně dostupný, telefon je dostupný',
      isFollowUp: false,
      isOverdue: false,
      hasSentRealEmail: false
    };
  }

  // Rule 4: WhatsApp pouze pokud je skutečně ověřený
  if (canWhatsApp) {
    return {
      channel: 'whatsapp',
      channelLabel: 'WhatsApp',
      recommendedTime: '11:00–12:30',
      reason: 'Ověřený WhatsApp kontakt k dispozici',
      isFollowUp: false,
      isOverdue: false,
      hasSentRealEmail: false
    };
  }

  // Fallback (neither available)
  return {
    channel: 'phone',
    channelLabel: 'Ověřit kontakt',
    recommendedTime: '10:00–12:00',
    reason: 'Kontakt vyžaduje dohledání',
    isFollowUp: false,
    isOverdue: false,
    hasSentRealEmail: false
  };
}

/**
 * Returns prioritized items for the Daily Outreach Plan.
 */
export function getDailyPlanItems(
  leads: PotentialCustomerLead[],
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date(),
  limit?: number
): DailyPlanLeadItem[] {
  // 1. Filter eligible leads
  const eligible = leads.filter(lead => isLeadEligibleForTodayPlan(lead, appMode, referenceDate));

  // 2. Sort by strict daily priority:
  //    1st: Overdue follow-ups
  //    2nd: Today's follow-ups
  //    3rd: Uncontacted ready leads (by fitScore descending)
  eligible.sort((a, b) => {
    const aOverdue = isFollowUpOverdueStrict(a, appMode, referenceDate);
    const bOverdue = isFollowUpOverdueStrict(b, appMode, referenceDate);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const aDue = hasFollowUpDueTodayOrOverdue(a, appMode, referenceDate);
    const bDue = hasFollowUpDueTodayOrOverdue(b, appMode, referenceDate);
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    // Follow-up scheduled time ascending
    const aDate = getEffectiveNextDate(a, appMode);
    const bDate = getEffectiveNextDate(b, appMode);
    if (aDate && bDate) {
      const diff = new Date(aDate).getTime() - new Date(bDate).getTime();
      if (diff !== 0) return diff;
    }

    // Criteria fit score descending (strictly as prioritization order, not purchase probability)
    return (b.fitScore || 0) - (a.fitScore || 0);
  });

  const selectedLeads = typeof limit === 'number' && limit > 0 ? eligible.slice(0, limit) : eligible;

  // 3. Map to rich DailyPlanLeadItem
  return selectedLeads.map((lead, index) => {
    const {
      channel,
      channelLabel,
      recommendedTime,
      reason,
      isFollowUp,
      isOverdue,
      hasSentRealEmail
    } = resolveRecommendedChannelAndTime(lead, appMode, referenceDate);

    // Get prepared sequence
    let seq: LeadOutreachSequence = lead.outreachSequence && lead.outreachSequence.steps?.length === 4
      ? validateAndSanitizeSequence(lead.outreachSequence, lead, { tone: lead.outreachSequence.tone || 'professional' })
      : generateOutreachSequence(lead, { tone: 'professional' });

    // Determine current active step:
    // If step 1 was already sent, current is step 2 (index 1), etc.
    let stepIndex = 0;
    if (seq.steps && seq.steps.length > 0) {
      const firstUnsent = seq.steps.findIndex(s => s.status !== 'sent');
      stepIndex = firstUnsent >= 0 ? firstUnsent : 0;
    }
    const currentStep = seq.steps[stepIndex] || seq.steps[0];

    return {
      lead,
      priorityRank: index + 1,
      priorityLabel: `Priorita #${index + 1}`,
      recommendedChannel: channel,
      recommendedChannelLabel: channelLabel,
      recommendedTime,
      recommendationReason: reason,
      hasPublicEmail: hasVerifiedEmail(lead),
      hasPhone: hasPhone(lead),
      hasVerifiedWhatsApp: hasVerifiedWhatsApp(lead),
      isFollowUp,
      isOverdue,
      hasSentRealEmail,
      currentStepIndex: stepIndex,
      currentStepTitle: currentStep?.title || 'Oslovení',
      preparedSubject: currentStep?.subject,
      preparedContent: currentStep?.content,
      preparedCallScript: currentStep?.callScript,
      preparedWhatsApp: currentStep?.whatsappMessage
    };
  });
}

/**
 * Calculates global counters for the Daily Plan UI:
 * - Dnes kontaktovat
 * - Hotovo
 * - Čeká na follow-up
 * - Schůzky
 * - Nabídky
 */
export function getDailyPlanCounters(
  leads: PotentialCustomerLead[],
  appMode: AppExecutionMode = 'test',
  referenceDate: Date = new Date()
): DailyPlanCounters {
  let todayToContact = 0;
  let doneToday = 0;
  let waitingForFollowUp = 0;
  let meetings = 0;
  let quotes = 0;

  for (const lead of leads) {
    const status = getEffectiveLeadStatus(lead, appMode);

    // 1. Schůzky
    if (status === 'Schůzka') {
      meetings++;
      continue;
    }

    // 2. Nabídky
    if (status === 'Nabídka') {
      quotes++;
      // If a quote has a follow-up due today or overdue, it is also counted in todayToContact
      if (isLeadEligibleForTodayPlan(lead, appMode, referenceDate)) {
        todayToContact++;
      } else if (hasFutureFollowUp(lead, appMode, referenceDate)) {
        waitingForFollowUp++;
      }
      continue;
    }

    // 3. Hotovo (contacted today)
    if (wasContactedToday(lead, appMode, referenceDate)) {
      doneToday++;
    }

    // 4. Dnes kontaktovat
    if (isLeadEligibleForTodayPlan(lead, appMode, referenceDate)) {
      todayToContact++;
    } else if (hasFutureFollowUp(lead, appMode, referenceDate)) {
      // 5. Čeká na follow-up
      waitingForFollowUp++;
    } else if (status === 'Osloveno' && !wasContactedToday(lead, appMode, referenceDate)) {
      // In progress waiting for interval
      waitingForFollowUp++;
    }
  }

  return {
    todayToContact,
    doneToday,
    waitingForFollowUp,
    meetings,
    quotes
  };
}
