import { ContactChannel, LeadActivity, LeadStatus, PotentialCustomerLead } from '../types';

export function formatCzechDateTime(dateStr?: string): string {
  if (!dateStr) return 'Neuvedeno';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeString = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Dnes v ${timeString}`;
    if (isTomorrow) return `Zítra v ${timeString}`;
    if (isYesterday) return `Včera v ${timeString}`;

    return `${d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })} v ${timeString}`;
  } catch {
    return dateStr;
  }
}

export function formatCzechDateOnly(dateStr?: string): string {
  if (!dateStr) return 'Neuvedeno';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Převede libovolné datum (ISO string nebo jiný platný formát) na formát pro <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
 * v lokálním čase, aby nedocházelo k posunům časových zón a nekonzistenci.
 */
export function formatToDatetimeLocal(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function isFollowUpDueTodayOrOverdue(nextContactDate?: string): boolean {
  if (!nextContactDate) return false;
  try {
    const target = new Date(nextContactDate);
    if (isNaN(target.getTime())) return false;

    const now = new Date();
    // End of today (23:59:59.999)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return target.getTime() <= endOfToday.getTime();
  } catch {
    return false;
  }
}

export function isFollowUpOverdue(nextContactDate?: string): boolean {
  if (!nextContactDate) return false;
  try {
    const target = new Date(nextContactDate);
    if (isNaN(target.getTime())) return false;
    const now = new Date();
    // Start of today (00:00:00.000)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    // Overdue if scheduled strictly before today's start, or if past current minute today
    return target.getTime() < startOfToday.getTime();
  } catch {
    return false;
  }
}

export function getFollowUpStatusInfo(nextContactDate?: string): {
  isDueToday: boolean;
  isOverdue: boolean;
  displayText: string;
  badgeClass: string;
} {
  if (!nextContactDate) {
    return {
      isDueToday: false,
      isOverdue: false,
      displayText: 'Není naplánováno',
      badgeClass: 'bg-white/5 text-slate-400 border-white/10'
    };
  }

  const target = new Date(nextContactDate);
  const now = new Date();
  const isOverdue = isFollowUpOverdue(nextContactDate);
  const isDueTodayOrOverdue = isFollowUpDueTodayOrOverdue(nextContactDate);

  const isToday =
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear();

  if (isOverdue) {
    return {
      isDueToday: false,
      isOverdue: true,
      displayText: `⚠️ Po termínu (${formatCzechDateTime(nextContactDate)})`,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold animate-pulse'
    };
  }

  if (isToday) {
    return {
      isDueToday: true,
      isOverdue: false,
      displayText: `🔥 Dnes (${formatCzechDateTime(nextContactDate)})`,
      badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold'
    };
  }

  return {
    isDueToday: false,
    isOverdue: false,
    displayText: `📅 ${formatCzechDateTime(nextContactDate)}`,
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-medium'
  };
}

export function createActivityEntry(
  lead: PotentialCustomerLead,
  channel: ContactChannel,
  result: string,
  newStatus: LeadStatus,
  note?: string,
  nextContactDate?: string,
  isSimulation?: boolean
): { updatedLead: PotentialCustomerLead; newActivity: LeadActivity } {
  const timestamp = new Date().toISOString();
  // V testovacím režimu jsou aktivity TESTOVACÍ SIMULACE, v reálném režimu (nebo při explicitním false) striktně REÁLNÉ
  const isSim = isSimulation === true;

  const currentActivities = Array.isArray(lead.activities) ? [...lead.activities] : [];

  // Duplicity guard: prevent identical activity from being added twice within 2 seconds
  const isDuplicate = currentActivities.some(a => 
    a.channel === channel &&
    a.result === (result || `Kontakt přes ${getChannelLabel(channel)}`) &&
    a.statusAfter === newStatus &&
    Math.abs(new Date(a.createdAt).getTime() - new Date(timestamp).getTime()) < 2000
  );
  if (isDuplicate) {
    return { updatedLead: lead, newActivity: currentActivities[0] };
  }

  // Canonical unified scheduled date
  const currentScheduled = isSim 
    ? (lead.simulationNextContactDate || lead.nextContactDate || lead.scheduledAt)
    : (lead.realNextContactDate || lead.nextContactDate || lead.scheduledAt);

  const finalNextContactDate = ['Odmítnuto', 'Nekontaktovat'].includes(newStatus)
    ? undefined
    : (nextContactDate !== undefined ? (nextContactDate ? nextContactDate : undefined) : currentScheduled);

  let activityResult = result || `Kontakt přes ${getChannelLabel(channel)}`;
  if (isSim) {
    if (!activityResult.startsWith('TESTOVACÍ SIMULACE:')) {
      const cleanPrefix = activityResult
        .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
        .replace(/^testovací\s+simulace:\s*/i, '');
      const stepLabel = getChannelLabel(channel);
      activityResult = `TESTOVACÍ SIMULACE: ${stepLabel} – ${cleanPrefix}`;
    }
  } else {
    // REÁLNÝ KONTAKT nesmí obsahovat [TESTOVACÍ SIMULACE] ani jiné simulované značky
    activityResult = activityResult
      .replace(/^testovací\s+simulace:\s*/i, '')
      .replace(/^simulovan[ýáé]\s+[^:]*:\s*/i, '')
      .replace(/\[TESTOVACÍ SIMULACE[^\]]*\]\s*/gi, '')
      .trim();
  }

  const finalNote = isSim
    ? (note?.trim()
        ? (note.includes('[TESTOVACÍ SIMULACE]') ? note.trim() : `[TESTOVACÍ SIMULACE]\n${note.trim()}`)
        : '[TESTOVACÍ SIMULACE]')
    : (note?.trim() ? note.replace(/\[TESTOVACÍ SIMULACE[^\]]*\]\s*\n?/gi, '').trim() || undefined : undefined);

  // Status before: in simulation mode, prior simulated status or real status
  const statusBefore = isSim
    ? (lead.simulationStatus || lead.realStatus || lead.status)
    : (lead.realStatus || lead.status);

  const activity: LeadActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    createdAt: timestamp,
    leadId: lead.id,
    companyName: lead.companyName,
    channel,
    result: activityResult,
    statusBefore,
    statusAfter: newStatus,
    note: finalNote,
    historicalPlannedDate: finalNextContactDate,
    nextContactDate: finalNextContactDate,
    scheduledAt: finalNextContactDate,
    isSimulation: isSim
  };

  const updatedActivities = [activity, ...currentActivities];

  let updatedSequence = lead.outreachSequence ? { ...lead.outreachSequence } : undefined;

  // When lead reaches or is in 'Schůzka': automatically pause the remaining sequence and synchronize meeting term!
  if ((newStatus === 'Schůzka' || (isSim ? lead.simulationStatus === 'Schůzka' : lead.status === 'Schůzka')) && updatedSequence) {
    const pausedSteps = updatedSequence.steps.map(step => {
      if (step.status !== 'sent') {
        return { ...step, status: 'paused' as const };
      }
      return step;
    });

    const meetingDateStr = finalNextContactDate ? formatCzechDateTime(finalNextContactDate) : '';
    const reasonText = meetingDateStr
      ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
      : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.';

    updatedSequence = {
      ...updatedSequence,
      isPaused: true,
      pausedReason: reasonText,
      pausedAt: updatedSequence.pausedAt || timestamp,
      steps: pausedSteps,
      updatedAt: timestamp
    };
  } else if (['Nabídka', 'Zákazník'].includes(newStatus) && updatedSequence) {
    const pausedSteps = updatedSequence.steps.map(step => {
      if (step.status !== 'sent') {
        return { ...step, status: 'paused' as const };
      }
      return step;
    });
    updatedSequence = {
      ...updatedSequence,
      isPaused: true,
      pausedReason: newStatus === 'Zákazník'
        ? 'Zákazník získán (obchod uzavřen). Sekvence studeného oslovení ukončena.'
        : 'Lead je ve fázi nabídky. Běžná sekvence studeného oslovení je pozastavena.',
      pausedAt: updatedSequence.pausedAt || timestamp,
      steps: pausedSteps,
      updatedAt: timestamp
    };
  }

  // Determine real vs simulation status separation
  const currentRealStatus: LeadStatus = lead.realStatus || lead.status || 'Nový';

  const updatedLead: PotentialCustomerLead = isSim ? {
    ...lead,
    // REÁLNÝ STAV SE NIKDY NEMĚNÍ BĚHEM TESTOVACÍ SIMULACE
    status: currentRealStatus,
    realStatus: currentRealStatus,
    // TESTOVACÍ STAV SE ULOŽÍ ODDĚLENĚ
    simulationStatus: newStatus,
    simulationLastContactedAt: timestamp,
    simulationLastContactResult: activityResult,
    simulationNextContactDate: finalNextContactDate,
    // Reálné kontaktní údaje zůstávají nedotčeny
    lastContactedAt: lead.lastContactedAt,
    lastContactChannel: lead.lastContactChannel,
    lastContactResult: lead.lastContactResult,
    nextContactDate: lead.realNextContactDate || lead.nextContactDate,
    scheduledAt: lead.realNextContactDate || lead.scheduledAt,
    realNextContactDate: lead.realNextContactDate,
    notes: note ? (lead.notes ? `${note}\n---\n${lead.notes}` : note) : lead.notes,
    activities: updatedActivities,
    outreachSequence: updatedSequence || lead.outreachSequence,
    contactToday: lead.contactToday
  } : {
    ...lead,
    // SKUTEČNÁ REÁLNÁ ZMĚNA STAVU
    status: newStatus,
    realStatus: newStatus,
    lastContactedAt: timestamp,
    lastContactChannel: channel,
    lastContactResult: activityResult,
    nextContactDate: finalNextContactDate,
    scheduledAt: finalNextContactDate,
    realNextContactDate: finalNextContactDate,
    notes: finalNote ? (lead.notes ? `${finalNote}\n---\n${lead.notes}` : finalNote) : lead.notes,
    activities: updatedActivities,
    outreachSequence: updatedSequence || lead.outreachSequence,
    contactToday: newStatus === 'Dnes oslovit' ? true : (['Nový'].includes(newStatus) ? lead.contactToday : false)
  };

  return { updatedLead, newActivity: activity };
}

/**
 * Ensures clean separation between real CRM status and simulation status.
 * If a lead only has simulation activities, its real status is guaranteed to be 'Nový' (or pre-simulation),
 * and the simulated state is cleanly placed in simulationStatus.
 */
export function normalizeLeadStatusSeparation(lead: PotentialCustomerLead): PotentialCustomerLead {
  const activities = Array.isArray(lead.activities) ? lead.activities : [];
  const hasRealActs = activities.some(a => a.isSimulation === false || (!a.isSimulation && !(a.result || '').toLowerCase().includes('simul')));
  const simActs = activities.filter(a => a.isSimulation === true || (a.isSimulation !== false && (a.result || '').toLowerCase().includes('simul')));

  let realStatus = lead.realStatus;
  let simulationStatus = lead.simulationStatus;
  let canonicalStatus = lead.status || 'Nový';

  if (!hasRealActs && simActs.length > 0) {
    const earliestSim = simActs[simActs.length - 1];
    realStatus = lead.realStatus || earliestSim.statusBefore || 'Nový';
    simulationStatus = lead.simulationStatus || (canonicalStatus !== realStatus ? canonicalStatus : (simActs[0].statusAfter || 'Osloveno'));
    canonicalStatus = realStatus;

    return {
      ...lead,
      status: canonicalStatus,
      realStatus,
      simulationStatus,
      nextContactDate: lead.realNextContactDate || undefined,
      scheduledAt: lead.realNextContactDate || undefined,
      lastContactedAt: undefined,
      lastContactResult: undefined,
    };
  } else if (!realStatus) {
    realStatus = canonicalStatus;
  }

  return {
    ...lead,
    status: canonicalStatus,
    realStatus,
    simulationStatus,
    nextContactDate: lead.nextContactDate,
    scheduledAt: lead.scheduledAt || lead.nextContactDate,
    lastContactedAt: lead.lastContactedAt,
    lastContactResult: lead.lastContactResult,
  };
}

export function getChannelLabel(channel: ContactChannel): string {
  switch (channel) {
    case 'phone':
      return 'Telefonát';
    case 'sms':
      return 'SMS';
    case 'whatsapp':
      return 'WhatsApp';
    case 'email':
      return 'E-mail';
    case 'meeting':
      return 'Osobní schůzka';
    case 'other':
      return 'Jiné / Zpráva';
    default:
      return 'Kontakt';
  }
}

export function getChannelIconName(channel: ContactChannel): string {
  switch (channel) {
    case 'phone':
      return 'PhoneCall';
    case 'sms':
      return 'MessageSquare';
    case 'whatsapp':
      return 'MessageCircle';
    case 'email':
      return 'Mail';
    case 'meeting':
      return 'Calendar';
    case 'other':
      return 'CheckCircle2';
    default:
      return 'Send';
  }
}
