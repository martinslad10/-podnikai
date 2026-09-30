import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Mail, 
  Phone,
  PhoneCall, 
  MessageSquare, 
  Calendar, 
  Check, 
  Copy, 
  ExternalLink, 
  Edit3, 
  Save, 
  RefreshCw, 
  Sparkles, 
  Clock, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  FlaskConical,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CalendarClock,
  ThumbsUp,
  ThumbsDown,
  X,
  Eye,
  EyeOff,
  FileText
} from 'lucide-react';
import { 
  PotentialCustomerLead, 
  LeadOutreachSequence, 
  OutreachStep, 
  OutreachTone, 
  UserProfile, 
  ContactChannel, 
  LeadStatus,
  AppExecutionMode
} from '../types';
import { 
  OUTREACH_TONES, 
  generateOutreachSequence, 
  validateAndSanitizeSequence,
  validateAndSanitizeDay1Email,
  cleanInternalAiTerminology,
  hasInternalAiTerminology,
  cleanBrokenCompanyFragments,
  cleanUngroundedClaims,
  hasBrokenCompanyFragments,
  hasUngroundedClaims,
  countWords,
  getSequenceStepTitle,
  getStepTabSubtitle,
  hasVerifiedEmail,
  hasVerifiedWhatsApp,
  hasRealSentEmail,
  hasRealPhoneCall,
  buildMailtoUrl, 
  buildWhatsAppUrl, 
  buildTelUrl, 
  calculateFollowUpDate, 
  cleanPhoneNumberForWhatsApp 
} from '../utils/outreachGenerator';
import { fetchOutreachSequence, saveOutreachSequenceToServer } from '../services/api';
import { formatCzechDateTime, formatToDatetimeLocal } from '../utils/leadActivities';
import { isValidPersonName, isValidExecutiveRole } from '../utils/personValidation';

export const getDefaultMeetingDatetime = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun -> Mon
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getDefaultOfferDeadline = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getPresetDatetime = (daysAhead: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export interface SimulationOutcomeOption {
  id: string;
  label: string;
  description: string;
  recommendedStatus: LeadStatus;
  defaultFollowUpDays: number;
  resultTitle: string;
  badgeClass: string;
  isDealConversion?: boolean;
}

// 5 exact outcomes required for phone call simulation
export const PHONE_SIMULATION_OUTCOMES: SimulationOutcomeOption[] = [
  {
    id: 'high_interest',
    label: 'Velký zájem (schůzka / nabídka)',
    description: 'Dohodnuta schůzka nebo vyžádána nabídka – nastaví Schůzka/Nabídka a konkrétní termín',
    recommendedStatus: 'Schůzka',
    defaultFollowUpDays: 0,
    resultTitle: 'TESTOVACÍ SIMULACE: Telefonní hovor – Velký zájem',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    isDealConversion: true
  },
  {
    id: 'interest',
    label: 'Zájem',
    description: 'Klient má zájem o podrobnosti a podklady – follow-up za 2 dny',
    recommendedStatus: 'Zájem',
    defaultFollowUpDays: 2,
    resultTitle: 'TESTOVACÍ SIMULACE: Telefonní hovor – Zájem o podrobnosti a podklady',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    id: 'unreachable',
    label: 'Nedostupný',
    description: 'Nezvedá telefon, obsazeno – pokus o kontakt zítra',
    recommendedStatus: 'Osloveno',
    defaultFollowUpDays: 1,
    resultTitle: 'TESTOVACÍ SIMULACE: Telefonní hovor – Nedostupný / nezvednuto (pokus zítra)',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  },
  {
    id: 'later',
    label: 'Požádal o pozdější kontakt',
    description: 'Zaneprázdněn, řídí auto nebo má jednání – kontaktovat za 7 dní',
    recommendedStatus: 'Osloveno',
    defaultFollowUpDays: 7,
    resultTitle: 'TESTOVACÍ SIMULACE: Telefonní hovor – Požádal o pozdější kontakt (za 7 dní)',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    id: 'not_interested',
    label: 'Nezájem',
    description: 'Nemá zájem, odmítnuto – ukončit plánování',
    recommendedStatus: 'Odmítnuto',
    defaultFollowUpDays: 0,
    resultTitle: 'TESTOVACÍ SIMULACE: Telefonní hovor – Nezájem / odmítnuto (plánování ukončeno)',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  }
];

export const WHATSAPP_SIMULATION_OUTCOMES: SimulationOutcomeOption[] = [
  {
    id: 'sent_waiting',
    label: 'Simulovat odeslání (čeká se na odpověď)',
    description: 'Zpráva označena jako odeslaná, čeká se na reakci (Den 7 v sekvenci)',
    recommendedStatus: 'Osloveno',
    defaultFollowUpDays: 4,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Zpráva odeslána (čeká se na odpověď)',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    id: 'high_interest',
    label: 'Velký zájem',
    description: 'Klient obratem odpověděl s velkým zájmem a navrhuje krátký hovor',
    recommendedStatus: 'Zájem',
    defaultFollowUpDays: 1,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Klient odpověděl s velkým zájmem',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  {
    id: 'interest',
    label: 'Zájem',
    description: 'Klient se ptá na rozsah, reference nebo orientační cenu',
    recommendedStatus: 'Zájem',
    defaultFollowUpDays: 2,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Zájem o podrobnosti a kalkulaci',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  },
  {
    id: 'later',
    label: 'Požádal o pozdější kontakt',
    description: 'Nyní mimo firmu nebo na dovolené, ozvat se později',
    recommendedStatus: 'Osloveno',
    defaultFollowUpDays: 4,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Požádal o kontakt později',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    id: 'unreachable',
    label: 'Nedostupný / bez WhatsAppu',
    description: 'Číslo nemá aktivní WhatsApp účet nebo zpráva nebyla doručena',
    recommendedStatus: 'Osloveno',
    defaultFollowUpDays: 2,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Nedoručeno / bez WhatsApp účtu',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  },
  {
    id: 'not_interested',
    label: 'Nezájem',
    description: 'Slušné odmítnutí zprávou',
    recommendedStatus: 'Odmítnuto',
    defaultFollowUpDays: 0,
    resultTitle: 'TESTOVACÍ SIMULACE: WhatsApp – Nezájem / odmítnuto',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  }
];

export const getEmailSimulationOutcomes = (stepIndex: number, stepTitle: string): SimulationOutcomeOption[] => {
  const defaultWaitingDays = stepIndex === 0 ? 2 : stepIndex === 2 ? 7 : 0;
  return [
    {
      id: 'sent_waiting',
      label: 'Simulovat odeslání (čeká se na odpověď)',
      description: `E-mail označen jako odeslaný, další krok naplánován (${stepIndex === 0 ? 'Den 3: Hovor / WhatsApp' : stepIndex === 2 ? 'Den 14: Breakup e-mail' : 'Konec sekvence'})`,
      recommendedStatus: 'Osloveno',
      defaultFollowUpDays: defaultWaitingDays,
      resultTitle: `TESTOVACÍ SIMULACE: E-mail – ${stepTitle} (odesláno v testovacím režimu)`,
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    {
      id: 'high_interest',
      label: 'Velký zájem',
      description: 'Klient obratem odpověděl s velkým zájmem a žádá hovor či schůzku',
      recommendedStatus: 'Zájem',
      defaultFollowUpDays: 1,
      resultTitle: 'TESTOVACÍ SIMULACE: E-mail – Klient odpověděl s velkým zájmem',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'interest',
      label: 'Zájem',
      description: 'Klient se doptává na podrobnosti, kalkulaci nebo reference',
      recommendedStatus: 'Zájem',
      defaultFollowUpDays: 2,
      resultTitle: 'TESTOVACÍ SIMULACE: E-mail – Zájem a dotaz na nabídku',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'later',
      label: 'Požádal o pozdější kontakt',
      description: 'Nyní nestíhá nebo řeší jiný projekt, ozvat se příští týden',
      recommendedStatus: 'Osloveno',
      defaultFollowUpDays: 7,
      resultTitle: 'TESTOVACÍ SIMULACE: E-mail – Požadavek na kontaktování později',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'not_interested',
      label: 'Nezájem',
      description: 'Slušné odmítnutí e-mailem nebo nemá zájem o spolupráci',
      recommendedStatus: 'Odmítnuto',
      defaultFollowUpDays: 0,
      resultTitle: 'TESTOVACÍ SIMULACE: E-mail – Nezájem / odmítnuto',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    }
  ];
};

interface OutreachStudioProps {
  lead: PotentialCustomerLead;
  userProfile?: UserProfile | null;
  concreteOffer?: string;
  businessDirectionTitle?: string;
  onUpdateLead: (updatedLead: PotentialCustomerLead) => void;
  onSaveActivity: (
    leadId: string, 
    channel: ContactChannel, 
    result: string, 
    newStatus: LeadStatus, 
    note?: string, 
    nextContactDate?: string,
    isSimulation?: boolean
  ) => void;
  onOpenLoggerModal?: (mode?: 'log_contact' | 'schedule_only') => void;
  appMode?: AppExecutionMode;
}

export const OutreachStudio: React.FC<OutreachStudioProps> = ({
  lead,
  userProfile,
  concreteOffer,
  businessDirectionTitle,
  onUpdateLead,
  onSaveActivity,
  onOpenLoggerModal,
  appMode = 'test'
}) => {
  const [selectedTone, setSelectedTone] = useState<OutreachTone>(() => {
    return lead.outreachSequence?.tone || 'professional';
  });

  const [sequence, setSequence] = useState<LeadOutreachSequence>(() => {
    let baseSeq: LeadOutreachSequence;
    if (lead.outreachSequence && lead.outreachSequence.steps?.length === 4) {
      baseSeq = validateAndSanitizeSequence(lead.outreachSequence, lead, {
        tone: lead.outreachSequence.tone || 'professional',
        userProfile: userProfile || undefined,
        concreteOffer,
        businessDirectionTitle
      });
    } else {
      baseSeq = generateOutreachSequence(lead, {
        tone: 'professional',
        userProfile: userProfile || undefined,
        concreteOffer,
        businessDirectionTitle
      });
    }

    if (lead.status === 'Schůzka' || baseSeq.isPaused) {
      const pausedSteps = baseSeq.steps.map(s => (s.status !== 'sent' ? { ...s, status: 'paused' as const } : s));
      const unifiedDate = lead.nextContactDate || lead.scheduledAt;
      const meetingDateStr = unifiedDate ? formatCzechDateTime(unifiedDate) : '';
      const targetReason = lead.status === 'Schůzka' && meetingDateStr
        ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
        : (baseSeq.pausedReason || (meetingDateStr
          ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
          : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.'));
      return {
        ...baseSeq,
        isPaused: true,
        pausedReason: targetReason,
        pausedAt: baseSeq.pausedAt || new Date().toISOString(),
        steps: pausedSteps
      };
    }

    return baseSeq;
  });

  const isSequencePaused = Boolean(
    lead.status === 'Schůzka' || 
    lead.status === 'Nabídka' || 
    lead.status === 'Zákazník' || 
    sequence.isPaused
  );

  // Helper to determine if an individual step is paused
  const isStepPaused = (step: OutreachStep): boolean => {
    return Boolean(isSequencePaused || step.status === 'paused');
  };

  // State to toggle read-only content viewing for paused steps (Requirement 4)
  const [showPausedContentMap, setShowPausedContentMap] = useState<Record<number, boolean>>({});

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [editedSubject, setEditedSubject] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [editedCallScript, setEditedCallScript] = useState<string>('');
  const [editedWhatsappMessage, setEditedWhatsappMessage] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'phone' | 'whatsapp'>('phone');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Robust Email Fallback (iPhone / AI Studio Preview iframe) & Confirmation States
  const [showEmailFallback, setShowEmailFallback] = useState<boolean>(false);
  const [emailConfirmationModalOpen, setEmailConfirmationModalOpen] = useState<boolean>(false);

  // Safe Simulation Mode States
  const [simulationOpen, setSimulationOpen] = useState<boolean>(false);
  const [simulationChannel, setSimulationChannel] = useState<'phone' | 'email' | 'whatsapp'>('email');
  const [simulationOutcomeId, setSimulationOutcomeId] = useState<string>('high_interest');
  const [simulationNote, setSimulationNote] = useState<string>('');
  const [simulationCustomDays, setSimulationCustomDays] = useState<number>(2);

  // Dedicated states for Velký zájem (Schůzka vs Nabídka and exact meeting time)
  // Initialized directly from the lead's stored scheduled date (lead.nextContactDate / scheduledAt) to prevent date discrepancies!
  const [callDealStatus, setCallDealStatus] = useState<'Schůzka' | 'Nabídka'>('Schůzka');
  const [meetingDatetime, setMeetingDatetime] = useState<string>(() => {
    const unified = lead.nextContactDate || lead.scheduledAt;
    return formatToDatetimeLocal(unified) || getDefaultMeetingDatetime();
  });
  const [offerDeadlineDatetime, setOfferDeadlineDatetime] = useState<string>(() => {
    const unified = lead.nextContactDate || lead.scheduledAt;
    return formatToDatetimeLocal(unified) || getDefaultOfferDeadline();
  });

  // Keep meetingDatetime and offerDeadlineDatetime always in sync with stored lead.nextContactDate / scheduledAt
  useEffect(() => {
    const unified = lead.nextContactDate || lead.scheduledAt;
    if (unified) {
      const localVal = formatToDatetimeLocal(unified);
      if (localVal) {
        setMeetingDatetime(prev => prev === localVal ? prev : localVal);
        setOfferDeadlineDatetime(prev => prev === localVal ? prev : localVal);
      }
    }
  }, [lead.id, lead.nextContactDate, lead.scheduledAt]);

  // Auto-pause sequence if lead status is 'Schůzka' or changes, and guarantee pausedReason uses the unified scheduled date
  useEffect(() => {
    if (lead.status === 'Schůzka') {
      const unifiedDate = lead.nextContactDate || lead.scheduledAt;
      const meetingDateStr = unifiedDate ? formatCzechDateTime(unifiedDate) : '';
      const targetReason = meetingDateStr
        ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
        : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.';

      setSequence(prev => {
        const hasUnpausedPending = prev.steps.some(s => s.status !== 'sent' && s.status !== 'paused');
        if (!prev.isPaused || hasUnpausedPending || prev.pausedReason !== targetReason) {
          const pausedSteps = prev.steps.map(s => (s.status !== 'sent' ? { ...s, status: 'paused' as const } : s));
          return {
            ...prev,
            isPaused: true,
            pausedReason: targetReason,
            pausedAt: prev.pausedAt || new Date().toISOString(),
            steps: pausedSteps
          };
        }
        return prev;
      });
    }
  }, [lead.status, lead.nextContactDate, lead.scheduledAt]);

  // Sync sequence when lead prop changes with automatic sanitization & auto-repair
  useEffect(() => {
    const rawSeq = (lead.outreachSequence && lead.outreachSequence.steps?.length === 4)
      ? lead.outreachSequence
      : sequence;

    if (rawSeq && rawSeq.steps?.length === 4) {
      let sanitized = validateAndSanitizeSequence(rawSeq, lead, {
        tone: rawSeq.tone || selectedTone,
        userProfile: userProfile || undefined,
        concreteOffer,
        businessDirectionTitle
      });

      if (lead.status === 'Schůzka' || sanitized.isPaused) {
        const pausedSteps = sanitized.steps.map(s => (s.status !== 'sent' ? { ...s, status: 'paused' as const } : s));
        const unified = lead.nextContactDate || lead.scheduledAt;
        const meetingDateStr = unified ? formatCzechDateTime(unified) : '';
        const targetReason = lead.status === 'Schůzka' && meetingDateStr
          ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
          : (sanitized.pausedReason || (meetingDateStr
            ? `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
            : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.'));
        sanitized = {
          ...sanitized,
          isPaused: true,
          pausedReason: targetReason,
          pausedAt: sanitized.pausedAt || new Date().toISOString(),
          steps: pausedSteps
        };
      }

      setSequence(prev => {
        if (
          prev.id === sanitized.id &&
          prev.isPaused === sanitized.isPaused &&
          prev.pausedReason === sanitized.pausedReason &&
          prev.steps.length === sanitized.steps.length &&
          prev.steps[0]?.content === sanitized.steps[0]?.content &&
          prev.steps[0]?.subject === sanitized.steps[0]?.subject &&
          prev.steps[0]?.channel === sanitized.steps[0]?.channel &&
          prev.steps[0]?.type === sanitized.steps[0]?.type &&
          prev.steps[0]?.title === sanitized.steps[0]?.title &&
          prev.steps[1]?.callScript === sanitized.steps[1]?.callScript &&
          prev.steps[1]?.keyArgument === sanitized.steps[1]?.keyArgument &&
          prev.steps[1]?.whatsappMessage === sanitized.steps[1]?.whatsappMessage &&
          prev.steps[2]?.subject === sanitized.steps[2]?.subject &&
          prev.steps[2]?.content === sanitized.steps[2]?.content
        ) {
          return prev;
        }
        return sanitized;
      });
      setSelectedTone(prev => prev === (sanitized.tone || 'professional') ? prev : (sanitized.tone || 'professional'));

      // If the sequence was repaired or updated based on CRM context (e.g. real sent email), persist back to lead
      const origSeq = lead.outreachSequence;
      if (
        !origSeq ||
        sanitized.steps[0].content !== origSeq.steps[0]?.content ||
        sanitized.steps[0].subject !== origSeq.steps[0]?.subject ||
        sanitized.steps[0].channel !== origSeq.steps[0]?.channel ||
        sanitized.steps[0].type !== origSeq.steps[0]?.type ||
        sanitized.steps[0].title !== origSeq.steps[0]?.title ||
        sanitized.steps[1].callScript !== origSeq.steps[1]?.callScript ||
        sanitized.steps[1].keyArgument !== origSeq.steps[1]?.keyArgument ||
        sanitized.steps[1].whatsappMessage !== origSeq.steps[1]?.whatsappMessage
      ) {
        onUpdateLead({ ...lead, outreachSequence: sanitized });
        saveOutreachSequenceToServer(lead.id, sanitized).catch(console.warn);
      }
    }
  }, [lead.id, lead.outreachSequence?.id, lead.outreachSequence?.updatedAt, lead.status, lead.realStatus, lead.lastContactedAt, lead.lastContactResult, lead.activities?.length, lead.nextContactDate]);

  // Sync active step state for editing
  useEffect(() => {
    const currentStep = sequence.steps[activeStepIndex];
    if (currentStep) {
      setEditedSubject(currentStep.subject || '');
      setEditedContent(currentStep.content || '');
      setEditedCallScript(currentStep.callScript || '');
      setEditedWhatsappMessage(currentStep.whatsappMessage || '');
      setIsEditingText(false);
      setSimulationOpen(false); // Close simulation form on step change
      if (currentStep.channel === 'phone') {
        setSimulationChannel('phone');
      } else if (currentStep.channel === 'whatsapp') {
        setSimulationChannel('whatsapp');
      } else {
        setSimulationChannel('email');
      }
    }
  }, [
    activeStepIndex,
    sequence.steps[activeStepIndex]?.content,
    sequence.steps[activeStepIndex]?.subject,
    sequence.steps[activeStepIndex]?.callScript,
    sequence.steps[activeStepIndex]?.whatsappMessage,
    sequence.steps[activeStepIndex]?.channel
  ]);

  const currentStep: OutreachStep | undefined = sequence.steps[activeStepIndex];
  const isCurrentStepPaused = currentStep ? isStepPaused(currentStep) : false;
  const isCallStep = currentStep?.channel === 'phone' || currentStep?.type === 'day1_phone' || currentStep?.type === 'day3_phone_whatsapp' || currentStep?.type === 'day3_phone' || currentStep?.type === 'day7_phone' || currentStep?.type === 'day14_phone';
  const isPausedContentVisible = Boolean(showPausedContentMap[activeStepIndex]);

  // Guaranteed clean, validated Day 1 email content before UI rendering or copying
  const activeDisplayedText = useMemo(() => {
    if (!currentStep) return '';

    if (isEditingText) {
      if (currentStep.type === 'day3_phone_whatsapp') {
        return activeSubTab === 'phone' ? (editedCallScript || editedContent) : (editedWhatsappMessage || editedContent);
      }
      if (currentStep.channel === 'phone') {
        return editedCallScript || editedContent;
      }
      return editedContent;
    }

    if (currentStep.type === 'day3_phone_whatsapp') {
      const raw = activeSubTab === 'phone' 
        ? (currentStep.callScript || currentStep.content) 
        : (currentStep.whatsappMessage || currentStep.content);
      let c = cleanInternalAiTerminology(raw);
      c = cleanBrokenCompanyFragments(c, lead.companyName);
      c = cleanUngroundedClaims(c);
      return c;
    }

    if (currentStep.channel === 'phone') {
      const raw = currentStep.callScript || currentStep.content;
      let c = cleanInternalAiTerminology(raw);
      c = cleanBrokenCompanyFragments(c, lead.companyName);
      c = cleanUngroundedClaims(c);
      return c;
    }

    if (currentStep.type === 'day1_email' && currentStep.channel === 'email') {
      const validation = validateAndSanitizeDay1Email(currentStep.content, lead, {
        tone: selectedTone,
        userProfile: userProfile || undefined,
        concreteOffer,
        businessDirectionTitle
      });
      return validation.content;
    }

    let cleaned = cleanInternalAiTerminology(currentStep.content);
    cleaned = cleanBrokenCompanyFragments(cleaned, lead.companyName);
    cleaned = cleanUngroundedClaims(cleaned);
    return cleaned;
  }, [
    currentStep,
    isEditingText,
    editedContent,
    editedCallScript,
    editedWhatsappMessage,
    activeSubTab,
    lead,
    selectedTone,
    userProfile,
    concreteOffer,
    businessDirectionTitle
  ]);

  const activeDisplayedSubject = useMemo(() => {
    if (currentStep?.channel === 'phone') return '';
    if (isEditingText) return editedSubject;
    const raw = currentStep?.subject || '';
    if (
      currentStep?.type === 'day1_email' && 
      (hasInternalAiTerminology(raw) || hasBrokenCompanyFragments(raw) || countWords(raw) > 7)
    ) {
      return `Krátký dotaz – ${lead.companyName}`;
    }
    let s = cleanInternalAiTerminology(raw);
    s = cleanBrokenCompanyFragments(s, lead.companyName);
    return s;
  }, [isEditingText, editedSubject, currentStep?.subject, currentStep?.type, currentStep?.channel, lead.companyName]);

  const activeWordCount = useMemo(() => {
    return countWords(activeDisplayedText);
  }, [activeDisplayedText]);

  // Open safe simulation panel
  const openSimulation = (channel: 'phone' | 'email' | 'whatsapp') => {
    setSimulationChannel(channel);
    setSimulationOpen(true);
    setSimulationNote('');
    if (channel === 'phone') {
      setSimulationOutcomeId('high_interest');
      setCallDealStatus('Schůzka');
      const unified = lead.nextContactDate || lead.scheduledAt;
      const localVal = unified ? formatToDatetimeLocal(unified) : '';
      setMeetingDatetime(localVal || getDefaultMeetingDatetime());
      setOfferDeadlineDatetime(localVal || getDefaultOfferDeadline());
      setSimulationCustomDays(0);
    } else if (channel === 'whatsapp') {
      setSimulationOutcomeId('sent_waiting');
      setSimulationCustomDays(4);
    } else {
      setSimulationOutcomeId('sent_waiting');
      const defaultDays = activeStepIndex === 0 ? 2 : activeStepIndex === 2 ? 7 : 0;
      setSimulationCustomDays(defaultDays);
    }
  };

  // Reset sequence back to start for repeatable testing without affecting CRM activities
  const handleResetSequence = () => {
    const resetSteps = sequence.steps.map(step => ({
      ...step,
      status: 'pending' as const,
      sentAt: undefined
    }));
    const updatedSeq: LeadOutreachSequence = {
      ...sequence,
      steps: resetSteps,
      activeStepIndex: 0,
      updatedAt: new Date().toISOString()
    };
    setSequence(updatedSeq);
    setActiveStepIndex(0);
    setSimulationOpen(false);
    const updatedLead = { ...lead, outreachSequence: updatedSeq };
    onUpdateLead(updatedLead);
    saveOutreachSequenceToServer(lead.id, updatedSeq).catch(console.warn);
    showActionNotice('🔄 Sekvence byla resetována do 1. kroku pro nový bezpečný test.');
  };

  // Current simulation outcomes based on active channel
  const currentSimulationOutcomes: SimulationOutcomeOption[] = 
    simulationChannel === 'phone'
      ? PHONE_SIMULATION_OUTCOMES
      : simulationChannel === 'whatsapp'
        ? WHATSAPP_SIMULATION_OUTCOMES
        : getEmailSimulationOutcomes(activeStepIndex, currentStep?.title || 'Personalizovaný e-mail');

  const selectedOutcome = currentSimulationOutcomes.find(o => o.id === simulationOutcomeId) || currentSimulationOutcomes[0];

  const handleSelectOutcome = (outcome: SimulationOutcomeOption) => {
    setSimulationOutcomeId(outcome.id);
    if (outcome.id === 'high_interest' && simulationChannel === 'phone') {
      setSimulationCustomDays(0);
      if (!meetingDatetime) {
        setMeetingDatetime(getDefaultMeetingDatetime());
      }
    } else {
      setSimulationCustomDays(outcome.defaultFollowUpDays);
    }
  };

  // Confirm safe simulation and record into CRM
  const handleConfirmSimulation = () => {
    if (!currentStep) return;
    const outcome = selectedOutcome;
    const finalChannel: ContactChannel = simulationChannel;

    let finalStatus: LeadStatus = outcome.recommendedStatus;
    let finalResult = outcome.resultTitle;
    let calculatedNextDate: string | undefined = undefined;

    if (simulationChannel === 'phone' && outcome.id === 'high_interest') {
      // 1. Velký zájem (dohodnuta schůzka / vyžádána nabídka)
      // Nesmí se automaticky naplánovat běžný follow-up!
      finalStatus = callDealStatus; // 'Schůzka' nebo 'Nabídka'
      if (callDealStatus === 'Schůzka') {
        if (meetingDatetime) {
          calculatedNextDate = new Date(meetingDatetime).toISOString();
          finalResult = `TESTOVACÍ SIMULACE: Telefonní hovor – Velký zájem (schůzka domluvena na ${formatCzechDateTime(calculatedNextDate)})`;
        } else {
          calculatedNextDate = undefined;
          finalResult = 'TESTOVACÍ SIMULACE: Telefonní hovor – Velký zájem (schůzka domluvena)';
        }
      } else {
        // 'Nabídka'
        if (offerDeadlineDatetime) {
          calculatedNextDate = new Date(offerDeadlineDatetime).toISOString();
          finalResult = `TESTOVACÍ SIMULACE: Telefonní hovor – Velký zájem (vyžádána nabídka k ${formatCzechDateTime(calculatedNextDate)})`;
        } else {
          calculatedNextDate = undefined;
          finalResult = 'TESTOVACÍ SIMULACE: Telefonní hovor – Velký zájem (vyžádána nabídka)';
        }
      }
    } else if (outcome.id === 'not_interested') {
      // 2. Nezájem – ukončit plánování
      finalStatus = 'Odmítnuto';
      calculatedNextDate = undefined;
      finalResult = outcome.resultTitle;
    } else if (simulationCustomDays > 0) {
      // 3. Zájem (2 dny), Nedostupný (1 den), Požádal o pozdější kontakt (7 dní)
      calculatedNextDate = calculateFollowUpDate(simulationCustomDays, 9);
      finalResult = outcome.resultTitle;
    } else {
      calculatedNextDate = undefined;
      finalResult = outcome.resultTitle;
    }

    const finalNote = simulationNote.trim() 
      ? `[TESTOVACÍ SIMULACE]\nPoznámka: ${simulationNote.trim()}\n---\nKrok sekvence: ${getSequenceStepTitle(currentStep)}\nObsah:\n${activeDisplayedText}`
      : `[TESTOVACÍ SIMULACE - ${getSequenceStepTitle(currentStep)}]\nObsah:\n${activeDisplayedText}`;

    // Mark step as sent in sequence
    const updatedSteps = [...sequence.steps];
    updatedSteps[activeStepIndex] = {
      ...updatedSteps[activeStepIndex],
      status: 'sent',
      sentAt: new Date().toISOString()
    };

    if (finalStatus === 'Schůzka') {
      // Automatically pause all remaining pending steps
      for (let i = 0; i < updatedSteps.length; i++) {
        if (updatedSteps[i].status !== 'sent') {
          updatedSteps[i] = {
            ...updatedSteps[i],
            status: 'paused'
          };
        }
      }
    }

    // If deal converted (Schůzka/Nabídka) or rejected (Odmítnuto), DO NOT advance sequence to automated follow-up!
    const willAdvance = finalStatus !== 'Odmítnuto' && finalStatus !== 'Nekontaktovat' && finalStatus !== 'Schůzka' && finalStatus !== 'Nabídka' && activeStepIndex < sequence.steps.length - 1;
    const nextActiveIndex = willAdvance ? activeStepIndex + 1 : activeStepIndex;

    const pausedReasonText = calculatedNextDate 
      ? `Schůzka je domluvena na ${formatCzechDateTime(calculatedNextDate)}. Další automatické oslovení je pozastaveno.`
      : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.';

    const updatedSeq: LeadOutreachSequence = {
      ...sequence,
      steps: updatedSteps,
      activeStepIndex: nextActiveIndex,
      isPaused: finalStatus === 'Schůzka' ? true : (['Nabídka', 'Zákazník'].includes(finalStatus) ? true : sequence.isPaused),
      pausedReason: finalStatus === 'Schůzka' ? pausedReasonText : sequence.pausedReason,
      pausedAt: finalStatus === 'Schůzka' ? new Date().toISOString() : sequence.pausedAt,
      updatedAt: new Date().toISOString()
    };

    setSequence(updatedSeq);
    setSimulationOpen(false);

    // Save to CRM activity & update lead (passing '' when undefined to clear previous scheduled dates)
    onSaveActivity(
      lead.id,
      finalChannel,
      finalResult,
      finalStatus,
      finalNote,
      calculatedNextDate || '',
      true
    );

    saveOutreachSequenceToServer(lead.id, updatedSeq).catch(console.warn);

    const noticeMsg = finalStatus === 'Schůzka'
      ? `✓ Sekvence pozastavena. ${pausedReasonText}`
      : finalStatus === 'Nabídka'
        ? `📄 Vyžádána nabídka uložena do CRM! Běžný follow-up zrušen.`
        : finalStatus === 'Odmítnuto'
          ? `⛔ Nezájem uložen do CRM. Plánování ukončeno.`
          : `🧪 Simulace byla uložena do CRM! Výsledek: "${outcome.label}", nový stav: "${finalStatus}".` +
            (calculatedNextDate ? ` Další kontakt naplánován.` : '');

    showActionNotice(noticeMsg);

    if (willAdvance) {
      setTimeout(() => {
        setActiveStepIndex(nextActiveIndex);
      }, 700);
    }
  };

  const handleToneChange = async (newTone: OutreachTone) => {
    setSelectedTone(newTone);
    setIsGenerating(true);
    setActionSuccessMsg(null);
    try {
      const newSeq = await fetchOutreachSequence(lead, newTone, userProfile, {
        concreteOffer,
        businessDirectionTitle
      });
      setSequence(newSeq);
      const updatedLead = { ...lead, outreachSequence: newSeq };
      onUpdateLead(updatedLead);
      saveOutreachSequenceToServer(lead.id, newSeq).catch(console.warn);
    } catch (err) {
      console.warn('Failed to regenerate sequence with tone:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEditedStep = () => {
    const updatedSteps = [...sequence.steps];
    const stepToUpdate = { ...updatedSteps[activeStepIndex] };

    // Strict validation for Day 1 email (only if channel is email)
    if ((activeStepIndex === 0 && stepToUpdate.channel === 'email') || (stepToUpdate.type === 'day1_email' && stepToUpdate.channel === 'email')) {
      const wCount = countWords(editedContent);
      if (wCount > 150) {
        alert(`Délka e-mailu je ${wCount} slov. Maximální povolená délka pro 1. den je 150 slov (ideálně 80–130 slov). Zkraťte prosím text před uložením.`);
        return;
      }
      if (hasInternalAiTerminology(editedContent)) {
        alert('Text e-mailu obsahuje zakázanou interní AI terminologii (např. „AI hypotéza“, „Lead Intelligence“ apod.). Tyto výrazy nesmí být v textu pro zákazníka.');
        return;
      }
    }

    if (stepToUpdate.channel === 'phone') {
      const scriptText = cleanInternalAiTerminology(editedCallScript || editedContent);
      stepToUpdate.callScript = scriptText;
      stepToUpdate.content = scriptText;
    } else {
      stepToUpdate.content = cleanInternalAiTerminology(editedContent);
      if (stepToUpdate.subject !== undefined) {
        stepToUpdate.subject = cleanInternalAiTerminology(editedSubject);
      }
      if (stepToUpdate.callScript !== undefined) {
        stepToUpdate.callScript = cleanInternalAiTerminology(editedCallScript);
      }
      if (stepToUpdate.whatsappMessage !== undefined) {
        stepToUpdate.whatsappMessage = cleanInternalAiTerminology(editedWhatsappMessage);
      }
    }

    updatedSteps[activeStepIndex] = stepToUpdate;
    const updatedSeq: LeadOutreachSequence = {
      ...sequence,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    };

    setSequence(updatedSeq);
    setIsEditingText(false);
    const updatedLead = { ...lead, outreachSequence: updatedSeq };
    onUpdateLead(updatedLead);
    saveOutreachSequenceToServer(lead.id, updatedSeq).catch(console.warn);
    showActionNotice('✅ Změny textu byly úspěšně uloženy.');
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const showActionNotice = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleOpenEmail = () => {
    if (!currentStep) return;
    const subject = activeDisplayedSubject;
    const body = activeDisplayedText;
    const emailTo = lead.email && lead.email !== 'Nedostupné' ? lead.email.trim() : '';

    if (appMode === 'real') {
      const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // 1. Primární pokus otevřít mailto: (přes skrytý <a> s target="_top" i window.location.href fallback)
      try {
        const link = document.createElement('a');
        link.href = mailtoUrl;
        link.target = '_top';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        try {
          window.location.href = mailtoUrl;
        } catch (e) {
          console.warn('Nelze vyvolat mailto:', e);
        }
      }

      // 5. Nikdy netvrdíme, že e-mail byl odeslán, pokud aplikace pouze otevřela klienta!
      showActionNotice(`📧 Pokus o otevření poštovní aplikace pro ${lead.companyName}...`);

      // 2. Pro případ, že se klient na zařízení (např. iPhone v náhledu iFrame) neotevře, aktivujeme robustní fallback
      setShowEmailFallback(true);

      // 3. Otevřeme explicitní dialog pro potvrzení skutečného odeslání e-mailu
      setEmailConfirmationModalOpen(true);
    } else {
      // BEZPEČNOSTNÍ POJISTKA TESTOVACÍHO REŽIMU: Nikdy neotvírat externí poštovní klient
      handleCopy(`Předmět: ${subject}\n\n${body}`, 'email_with_subject');
      showActionNotice('🛡️ Bezpečnostní pojistka testovacího režimu: Skutečné odesílání e-mailů je uzamčeno. Text byl zkopírován do schránky pro náhled. Pro bezpečný test a zápis do CRM použijte TESTOVACÍ SIMULACI.');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!currentStep) return;
    const message = isEditingText 
      ? (editedWhatsappMessage || editedContent) 
      : cleanInternalAiTerminology(currentStep.whatsappMessage || currentStep.content);
    if (appMode === 'real') {
      const phoneClean = (lead.phone || '').replace(/\D/g, '');
      const url = phoneClean 
        ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      showActionNotice(`💬 Otevírám WhatsApp pro ${lead.companyName}...`);
    } else {
      // BEZPEČNOSTNÍ POJISTKA TESTOVACÍHO REŽIMU: Nikdy neotvírat WhatsApp ani externí okno
      handleCopy(message, 'whatsapp_msg');
      showActionNotice('🛡️ Bezpečnostní pojistka testovacího režimu: Skutečné odesílání WhatsApp zpráv je uzamčeno. Zpráva byla zkopírována do schránky. Pro bezpečný test použijte TESTOVACÍ SIMULACI.');
    }
  };

  const handleOpenPhone = () => {
    const hasPhone = lead.phone && lead.phone !== 'Nedostupné';
    if (!hasPhone) {
      showActionNotice('⚠️ Telefonní číslo není k dispozici.');
      return;
    }
    if (appMode === 'real') {
      window.location.href = `tel:${lead.phone.replace(/\s+/g, '')}`;
      showActionNotice(`📞 Vytáčím číslo (${lead.phone})...`);
    } else {
      // BEZPEČNOSTNÍ POJISTKA TESTOVACÍHO REŽIMU: Nikdy nevytáčet reálné telefonní číslo
      handleCopy(lead.phone.replace(/\s+/g, ''), 'phone_number');
      showActionNotice(`🛡️ Bezpečnostní pojistka testovacího režimu: Reálné volání je uzamčeno. Číslo (${lead.phone}) bylo zkopírováno do schránky. Pro bezpečný test hovoru použijte TESTOVACÍ SIMULACI.`);
    }
  };

  // 6. „Zapsat kontakt do CRM“ nesmí být automaticky považováno za skutečně odeslaný e-mail.
  // Aktivitu označ jako skutečně odeslanou pouze po explicitním potvrzení uživatele.
  const handleLogStepActivity = (markCompleted: boolean = true) => {
    if (!currentStep) return;

    const isEmailStep = currentStep.channel === 'email' || currentStep.type === 'day1_email' || currentStep.type === 'day7_followup' || currentStep.type === 'day14_breakup';

    if (appMode === 'real' && isEmailStep) {
      // Otevře explicitní dialog pro potvrzení odeslání e-mailu
      setEmailConfirmationModalOpen(true);
      return;
    }

    // Telefon, WhatsApp nebo testovací režim
    executeLogStepActivity(true);
  };

  const executeLogStepActivity = (actuallySent: boolean = true) => {
    if (!currentStep) return;

    let channel: ContactChannel = 'email';
    let result = '';
    let nextStatus: LeadStatus = appMode === 'real' ? (lead.realStatus || lead.status) : lead.status;
    let nextContactDays = 2; // Default 2 days later (Day 3)

    if (currentStep.type === 'day1_phone' || (currentStep.channel === 'phone' && currentStep.stepNumber === 1)) {
      channel = 'phone';
      result = 'Proveden prvotní telefonický hovor';
      if (['Nový', 'Dnes oslovit'].includes(nextStatus)) {
        nextStatus = 'Osloveno';
      }
      nextContactDays = 2; // Followup on day 3
    } else if (currentStep.type === 'day1_email') {
      channel = 'email';
      if (actuallySent) {
        result = 'Odeslán 1. personalizovaný e-mail';
        if (['Nový', 'Dnes oslovit'].includes(nextStatus)) {
          nextStatus = 'Osloveno';
        }
        nextContactDays = 2; // Followup on day 3
      } else {
        result = 'Připraven koncept 1. e-mailu (zatím neodesláno)';
        nextContactDays = 0; // Žádný automatický posun follow-upu, dokud není odesláno
      }
    } else if (currentStep.type === 'day3_phone_whatsapp' || currentStep.type === 'day3_phone') {
      channel = activeSubTab === 'whatsapp' ? 'whatsapp' : 'phone';
      result = activeSubTab === 'whatsapp' ? 'Odeslána WhatsApp zpráva' : 'Proveden druhý telefonát / follow-up';
      if (['Nový', 'Dnes oslovit'].includes(nextStatus)) {
        nextStatus = 'Osloveno';
      }
      nextContactDays = 4; // Followup on day 7 (4 days later)
    } else if (currentStep.type === 'day7_phone') {
      channel = 'phone';
      result = 'Proveden následný telefonát s novým podnětem';
      nextContactDays = 7; // Followup on day 14 (7 days later)
    } else if (currentStep.type === 'day7_followup') {
      channel = 'email';
      if (actuallySent) {
        result = 'Odesláno připomenutí s novým argumentem';
        nextContactDays = 7; // Followup on day 14 (7 days later)
      } else {
        result = 'Připraven koncept připomenutí (zatím neodesláno)';
        nextContactDays = 0;
      }
    } else if (currentStep.type === 'day14_phone') {
      channel = 'phone';
      result = 'Proveden závěrečný telefonát / uzavření';
      nextContactDays = 0; // No further automatic follow-up scheduled
    } else if (currentStep.type === 'day14_breakup') {
      channel = 'email';
      if (actuallySent) {
        result = 'Odeslán poslední breakup e-mail';
      } else {
        result = 'Připraven koncept breakup e-mailu (zatím neodesláno)';
      }
      nextContactDays = 0; // No further automatic follow-up scheduled
    } else if (currentStep.channel === 'phone') {
      channel = 'phone';
      result = `Proveden telefonický hovor (${getSequenceStepTitle(currentStep)})`;
      nextContactDays = 2;
    } else if (currentStep.channel === 'email') {
      channel = 'email';
      if (actuallySent) {
        result = `Odeslán e-mail (${getSequenceStepTitle(currentStep)})`;
        if (['Nový', 'Dnes oslovit'].includes(nextStatus)) {
          nextStatus = 'Osloveno';
        }
        nextContactDays = 2;
      } else {
        result = `Připraven koncept e-mailu (${getSequenceStepTitle(currentStep)}) (zatím neodesláno)`;
        nextContactDays = 0;
      }
    }

    const calculatedNextDate = nextContactDays > 0 ? calculateFollowUpDate(nextContactDays, 9) : undefined;
    const channelLabel = channel === 'email' ? 'E-mail' : channel === 'phone' ? 'Telefon' : channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
    const isSim = appMode !== 'real';
    const finalResult = isSim ? `TESTOVACÍ SIMULACE: ${channelLabel} – ${result}` : `${channelLabel} – ${result}`;
    const cleanDisplayedText = isSim ? activeDisplayedText : activeDisplayedText.replace(/\[TESTOVACÍ SIMULACE[^\]]*\]\s*\n?/gi, '').trim();
    const noteText = isSim 
      ? `[TESTOVACÍ SIMULACE - Krok sekvence (${getSequenceStepTitle(currentStep)})]:\n${activeDisplayedText}`
      : actuallySent
        ? `[Krok sekvence (${getSequenceStepTitle(currentStep)}) - Odesláno]:\n${cleanDisplayedText}`
        : `[Krok sekvence (${getSequenceStepTitle(currentStep)}) - Připraven koncept, neodesláno]:\n${cleanDisplayedText}`;

    // Pokud byl e-mail/krok skutečně odeslán, označíme krok sekvence za odeslaný
    if (actuallySent) {
      const updatedSteps = [...sequence.steps];
      updatedSteps[activeStepIndex] = {
        ...updatedSteps[activeStepIndex],
        status: 'sent',
        sentAt: new Date().toISOString()
      };
      let updatedSeq: LeadOutreachSequence = {
        ...sequence,
        steps: updatedSteps,
        activeStepIndex: Math.min(activeStepIndex + 1, updatedSteps.length - 1),
        updatedAt: new Date().toISOString()
      };

      // Pokud byl v REÁLNÉM REŽIMU odeslán e-mail (isSim === false),
      // ihned zaktualizujeme celou sekvenci tak, aby 3. den (telefonický hovor) a další kroky
      // věděly o reálně odeslaném e-mailu a správně na něj navázaly.
      if (channel === 'email' && !isSim) {
        const leadWithSentEmail: PotentialCustomerLead = {
          ...lead,
          activities: [
            {
              id: `act-temp-${Date.now()}`,
              createdAt: new Date().toISOString(),
              leadId: lead.id,
              companyName: lead.companyName,
              channel: 'email',
              result: finalResult,
              isSimulation: false,
              note: noteText,
              statusAfter: nextStatus
            },
            ...(lead.activities || [])
          ],
          lastContactChannel: 'email',
          lastContactResult: finalResult,
          status: nextStatus,
          realStatus: nextStatus
        };

        updatedSeq = validateAndSanitizeSequence(
          updatedSeq,
          leadWithSentEmail,
          {
            tone: selectedTone,
            userProfile: userProfile || undefined,
            concreteOffer,
            businessDirectionTitle
          }
        );
      }

      setSequence(updatedSeq);
      saveOutreachSequenceToServer(lead.id, updatedSeq).catch(console.warn);
    }

    // Zápis aktivity do CRM
    onSaveActivity(
      lead.id,
      channel,
      finalResult,
      nextStatus,
      noteText,
      calculatedNextDate,
      isSim
    );

    if (isSim) {
      showActionNotice(`🧪 TESTOVACÍ SIMULACE: Krok "${currentStep.title}" byl bezpečně zaznamenán do CRM.`);
    } else if (actuallySent) {
      showActionNotice(`✅ Krok "${currentStep.title}" byl potvrzen jako odeslaný a zapsán do CRM.`);
    } else {
      showActionNotice(`📝 Koncept kroku "${currentStep.title}" byl uložen do CRM bez označení za odeslaný.`);
    }
    
    // Automatický posun na další krok pouze pokud byl krok skutečně odeslán
    if (actuallySent && activeStepIndex < sequence.steps.length - 1) {
      setTimeout(() => {
        setActiveStepIndex(prev => prev + 1);
      }, 1000);
    }

    setEmailConfirmationModalOpen(false);
    setShowEmailFallback(false);
  };

  const hasPhone = Boolean(lead.phone && lead.phone !== 'Nedostupné' && lead.phone.trim() !== '');
  const hasEmail = hasVerifiedEmail(lead);
  const isWhatsAppVerified = hasVerifiedWhatsApp(lead);

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-blue-500/30 overflow-hidden shadow-xl space-y-4">
      
      {/* Header with Title & Tone Switcher */}
      <div className="p-5 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-b border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </span>
              <h4 className="font-heading font-extrabold text-white text-base sm:text-lg">
                Outreach Studio – Personalizovaná sekvence
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider">
                Fáze 1
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automaticky připravená 4kroková sekvence na základě reálných ověřených dat firmy <strong className="text-slate-200">{lead.companyName}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleResetSequence}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-all flex items-center gap-1.5"
              title="Vynulovat označení hotových kroků pro nový bezpečný test celé sekvence"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Resetovat test</span>
            </button>

            <button
              type="button"
              onClick={() => handleToneChange(selectedTone)}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
              title="Pře-generovat zprávy s novými formulacemi"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generuji sekvenci...' : 'Pře-generovat'}</span>
            </button>
          </div>
        </div>

        {/* Tone Selector Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Komunikační tón:</span>
            </span>
            <span className="text-[11px] text-slate-400 italic">
              {OUTREACH_TONES.find(t => t.id === selectedTone)?.description}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {OUTREACH_TONES.map(tone => {
              const isActive = selectedTone === tone.id;
              return (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => handleToneChange(tone.id)}
                  disabled={isGenerating}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                    isActive 
                      ? `${tone.badgeColor} bg-opacity-30 shadow-md ring-1 ring-blue-400/30 scale-[1.01]` 
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{tone.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[10px] font-normal opacity-80 truncate">
                    {tone.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead Intelligence Context Banner */}
        {lead.leadIntelligence ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Lead Intelligence zapojena v sekvenci</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">Aktivní</span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                🎯 {lead.leadIntelligence.hypotheses?.opportunity || lead.leadIntelligence.opportunity || 'Ověřit relevanci nabídky při kontaktu'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
              {(() => {
                const contactObj = lead.leadIntelligence.recommendedApproach?.idealContactPerson || lead.leadIntelligence.idealContactPerson;
                const rawName = contactObj?.name;
                const rawRole = contactObj?.role;
                const isVerified = Boolean(rawName && isValidPersonName(rawName, lead.companyName, lead.website) && isValidExecutiveRole(rawRole));
                return (
                  <div className="text-right">
                    <span className="text-slate-300">Doporučený kontakt: <strong className="text-white">{isVerified ? `${rawRole} (${rawName})` : 'Majitel / jednatel'}</strong></span>
                    {!isVerified && (
                      <span className="text-[10px] text-slate-400 block">Konkrétní osoba nebyla ve veřejných zdrojích ověřena.</span>
                    )}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => handleToneChange(selectedTone)}
                disabled={isGenerating}
                className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold text-[11px] border border-blue-500/30 transition-all flex items-center gap-1"
                title="Aktualizovat texty podle nejnovější analýzy Lead Intelligence"
              >
                <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Aktualizovat texty</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>Pro přesné podklady spusťte v sekci výše <strong>Lead Intelligence</strong> – zanalyzuje web firmy a doplní ověřená fakta a icebreaker.</span>
            </span>
          </div>
        )}
      </div>

      {/* Paused Outreach Sequence Status Banner */}
      {isSequencePaused && (
        <div className="mx-5 p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 shadow-lg shadow-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-emerald-300">
                  ✓ Sekvence pozastavena
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                  CRM: {lead.status.toUpperCase()}
                </span>
              </div>
              <p className="text-slate-200 text-xs font-semibold">
                {lead.status === 'Schůzka' && (lead.nextContactDate || lead.scheduledAt)
                  ? `Schůzka je domluvena na ${formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}. Další automatické oslovení je pozastaveno.`
                  : (sequence.pausedReason || ((lead.nextContactDate || lead.scheduledAt)
                    ? `Schůzka je domluvena na ${formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}. Další automatické oslovení je pozastaveno.`
                    : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.'))}
              </p>
              <p className="text-[11px] text-emerald-400/80">
                1., 3., 7. ani 14. den nejsou aktivní jako automatický kontakt. Připravené kroky slouží pouze jako archiv / plán.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenLoggerModal && (
              <button
                type="button"
                onClick={() => onOpenLoggerModal('log_contact')}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zaznamenat výsledek schůzky</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4-Step Sequence Timeline / Stepper Tabs */}
      <div className="px-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sequence.steps.map((step, idx) => {
            const isSelected = activeStepIndex === idx;
            const isSent = step.status === 'sent';
            const isPaused = isStepPaused(step);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveStepIndex(idx)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-1.5 ${
                  isPaused
                    ? isSelected
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-md text-amber-200 ring-1 ring-amber-500/40'
                      : 'bg-amber-950/10 border-amber-500/20 text-slate-300 hover:bg-amber-950/20'
                    : isSelected
                      ? 'bg-blue-600/20 border-blue-500/60 shadow-lg text-white ring-1 ring-blue-500/40'
                      : isSent
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-950/30'
                        : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    isPaused
                      ? isSelected
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : isSelected 
                        ? 'bg-blue-500 text-white font-bold' 
                        : isSent 
                          ? 'bg-emerald-500 text-slate-950 font-bold' 
                          : 'bg-white/10 text-slate-300'
                  }`}>
                    {step.day}. DEN
                  </span>

                  {isPaused ? (
                    <span className="text-[10px] font-extrabold text-amber-300 flex items-center gap-0.5" title="Krok pozastaven (archiv / plán)">
                      <span>⏸ POZASTAVENO</span>
                    </span>
                  ) : isSent ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400" title="Krok byl odeslán/zaznamenán">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Hotovo</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-blue-400">
                      Aktivní krok
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                    {step.channel === 'phone' ? (
                      <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : step.channel === 'whatsapp' ? (
                      <MessageCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                    )}
                    <span className="truncate">{getStepTabSubtitle(step)}</span>
                  </div>
                  {isPaused && (
                    <div className="text-[10px] text-amber-300/80 font-medium">
                      Archiv / plán – nespustí se
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content & Action Studio Box */}
      {currentStep && (
        <div className="px-5 pb-5 space-y-4">
          
          {/* Action Success Toast Feedback */}
          {actionSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActionSuccessMsg(null)}
                className="text-emerald-300 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {isCurrentStepPaused ? (
            /* ========================================================================= */
            /* DEDICATED PAUSED STEP VIEW (ARCHIV / PLÁN – ŽÁDNÁ AKČNÍ TLAČÍTKA)          */
            /* ========================================================================= */
            <div className="p-5 rounded-2xl bg-slate-950 border-2 border-amber-500/30 space-y-4">
              
              {/* 1. Jasný stav: ⏸ POZASTAVENO & 2. Archiv / plán – tento krok se automaticky nespustí */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-sm shrink-0 mt-0.5 sm:mt-0">
                    ⏸
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-amber-300 tracking-wide">
                        ⏸ POZASTAVENO
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        {getSequenceStepTitle(currentStep)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                        {currentStep.recommendedTiming}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-semibold mt-1">
                      Archiv / plán – tento krok se automaticky nespustí.
                    </p>
                  </div>
                </div>

                {/* 4. Tlačítko pro prohlížení: „Zobrazit scénář“ nebo „Zobrazit text“ */}
                <button
                  type="button"
                  onClick={() => setShowPausedContentMap(prev => ({ ...prev, [activeStepIndex]: !prev[activeStepIndex] }))}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-100 text-xs font-bold transition-all flex items-center gap-2 border border-white/10 shrink-0 self-start sm:self-center shadow-sm"
                  title={isPausedContentVisible ? (isCallStep ? 'Skrýt scénář' : 'Skrýt text') : (isCallStep ? 'Zobrazit scénář' : 'Zobrazit text')}
                >
                  {isPausedContentVisible ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isCallStep ? 'Skrýt scénář' : 'Skrýt text'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isCallStep ? 'Zobrazit scénář' : 'Zobrazit text'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Strategický záměr / Proč tento krok */}
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-300 text-[11px] block">
                    Proč tento krok (archivní záměr):
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {(currentStep.keyArgument || '').replace(
                      /\b(?:vícekanálový\s+kontakt(?:\s*\(multichannel\))?|multichannel)[^.\n]*zvedá\s+šanci[^.\n]*\.?/gi,
                      'Krátký follow-up po prvním kontaktu umožňuje ověřit, zda firma zprávu zaznamenala a zda je téma pro ni aktuální.'
                    )}
                  </p>
                </div>
              </div>

              {/* 4. Rozbalitelný obsah pro čtení – žádná akční tlačítka! */}
              {isPausedContentVisible ? (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/20 space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Archivní náhled – pouze pro čtení
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {isCallStep ? 'Připravený scénář pro ruční jednání' : 'Připravený text (automaticky se neodešle)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(activeDisplayedText, 'body')}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      {copyFeedback === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copyFeedback === 'body' ? 'Zkopírováno!' : (isCallStep ? 'Kopírovat scénář' : 'Kopírovat text')}</span>
                    </button>
                  </div>

                  {/* Přepínač scénáře hovoru vs WhatsApp zprávy u 3. dne */}
                  {currentStep.type === 'day3_phone_whatsapp' && (
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 w-fit">
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('phone')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeSubTab === 'phone' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Scénář hovoru</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('whatsapp')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeSubTab === 'whatsapp' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp zpráva</span>
                      </button>
                    </div>
                  )}

                  {/* Předmět e-mailu (pouze u e-mailových kroků) */}
                  {currentStep.channel !== 'phone' && currentStep.subject !== undefined && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Předmět e-mailu:</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeDisplayedSubject, 'subject')}
                          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {copyFeedback === 'subject' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copyFeedback === 'subject' ? 'Zkopírováno' : 'Kopírovat předmět'}</span>
                        </button>
                      </label>
                      <div className="px-3 py-2 bg-slate-950 rounded-xl border border-white/5 text-xs text-slate-200 font-medium select-all">
                        {activeDisplayedSubject}
                      </div>
                    </div>
                  )}

                  {/* Tělo zprávy / Scénář */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      {currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'phone'
                        ? 'Scénář telefonního hovoru:'
                        : currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'whatsapp'
                          ? 'WhatsApp zpráva:'
                          : currentStep.channel === 'phone'
                            ? 'Scénář telefonního hovoru:'
                            : 'Text e-mailu:'}
                    </span>
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-white/5 text-xs text-slate-200 font-mono whitespace-pre-line leading-relaxed selection:bg-amber-500 selection:text-slate-950">
                      {activeDisplayedText}
                    </div>
                  </div>
                </div>
              ) : (
                /* Stav bez rozbalení: čistá zpráva a tlačítko */
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <FileText className="w-4 h-4 text-amber-400/70 shrink-0" />
                    <span>
                      Obsah tohoto kroku ({isCallStep ? 'scénář hovoru a zpráva' : 'text e-mailu'}) je připraven v archivu sekvence a automaticky se neodešle.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPausedContentMap(prev => ({ ...prev, [activeStepIndex]: true }))}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 font-semibold text-xs transition-colors shrink-0 border border-white/5 flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isCallStep ? 'Zobrazit scénář' : 'Zobrazit text'}</span>
                  </button>
                </div>
              )}

              {/* 7. Zachovat možnost ručního pokračování v CRM: Schůzka → Nabídka → Zákazník */}
              <div className="p-4 rounded-2xl bg-emerald-950/25 border-2 border-emerald-500/40 text-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-emerald-300">
                          ✓ Sekvence pozastavena
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                          CRM: {lead.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-200 text-xs font-bold leading-relaxed">
                        {lead.status === 'Schůzka' && (lead.nextContactDate || lead.scheduledAt)
                          ? `Schůzka je domluvena na ${formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}. Další automatické oslovení je pozastaveno.`
                          : (sequence.pausedReason || ((lead.nextContactDate || lead.scheduledAt)
                            ? `Schůzka je domluvena na ${formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}. Další automatické oslovení je pozastaveno.`
                            : 'Schůzka je domluvena. Další automatické oslovení je pozastaveno.'))}
                      </p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Tento krok slouží pouze jako archiv a podklad pro jednání. Žádný další kontakt se automaticky neprovede.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 shrink-0">
                    <span>Stav v CRM:</span>
                    <strong className="text-emerald-300">{lead.status}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Ruční pokračování v CRM obchodním procesu:
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenLoggerModal && (
                      <button
                        type="button"
                        onClick={() => onOpenLoggerModal('log_contact')}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                        title="Zaznamenat průběh a výsledek schůzky do CRM"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Zaznamenat výsledek schůzky</span>
                      </button>
                    )}

                    {lead.status === 'Schůzka' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onSaveActivity(
                              lead.id,
                              'meeting',
                              'Schůzka proběhla úspěšně – klient vyžádal konkrétní nabídku',
                              'Nabídka',
                              'Posun z CRM stavu Schůzka do stavu Nabídka na základě proběhlé schůzky.',
                              undefined,
                              false
                            );
                            showActionNotice('📄 Lead posunut do CRM stavu "Nabídka"!');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all"
                          title="Posunout lead do stavu Nabídka (Schůzka → Nabídka)"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Posunout na Nabídku (Nabídka)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSaveActivity(
                              lead.id,
                              'meeting',
                              'Úspěšně uzavřeno – podepsána spolupráce na schůzce',
                              'Zákazník',
                              'Schůzka vedla k přímému uzavření zakázky. Lead je nyní Zákazník.',
                              undefined,
                              false
                            );
                            showActionNotice('🎉 Gratulujeme! Lead byl úspěšně uzavřen jako Zákazník.');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                          title="Uzavřít zakázku jako Zákazník (Schůzka → Zákazník)"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Uzavřít jako Zákazník</span>
                        </button>
                      </>
                    )}

                    {lead.status === 'Nabídka' && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveActivity(
                            lead.id,
                            'other',
                            'Nabídka akceptována – zákazník podepsal objednávku',
                            'Zákazník',
                            'Nabídka byla akceptována. Zakázka vyhrána!',
                            undefined,
                            false
                          );
                          showActionNotice('🎉 Gratulujeme! Lead byl převeden na Zákazníka.');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                        title="Převést nabídku na vyhraného zákazníka"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Převést na Zákazníka (Vyhráno)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3.5">
            
            {/* Step Top Bar: Timing & Key Argument */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  {getSequenceStepTitle(currentStep)}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>{currentStep.recommendedTiming}</span>
                </span>
                {currentStep.channel === 'phone' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                    <Phone className="w-3 h-3 text-amber-400" />
                    <span>Doporučený kanál: Telefon</span>
                  </span>
                ) : currentStep.channel === 'whatsapp' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                    <MessageCircle className="w-3 h-3 text-emerald-400" />
                    <span>Doporučený kanál: WhatsApp</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-semibold">
                      <Mail className="w-3 h-3 text-purple-400" />
                      <span>Doporučený kanál: E-mail</span>
                    </span>
                    {hasEmail && lead.email && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 font-medium">
                        Veřejně dostupný e-mail: <strong className="text-white">{lead.email}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-tab switch for Day 3 (Hovor vs WhatsApp) */}
              {currentStep.type === 'day3_phone_whatsapp' && (
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('phone')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeSubTab === 'phone' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Scénář hovoru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('whatsapp')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeSubTab === 'whatsapp' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WhatsApp zpráva</span>
                  </button>
                </div>
              )}

              {/* Edit text mode toggle button */}
              <div className="flex items-center gap-2">
                {isEditingText ? (
                  <button
                    type="button"
                    onClick={handleSaveEditedStep}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Uložit změny</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingText(true)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 text-xs font-semibold transition-colors flex items-center gap-1 border border-white/10"
                    title="Upravit text nebo předmět před odesláním"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Upravit text</span>
                  </button>
                )}
              </div>
            </div>

            {/* Strategic Argument Box */}
            <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-blue-300 text-[11px] block">
                  Proč tento krok:
                </span>
                <p className="text-blue-100/90 text-[11px] leading-relaxed">
                  {(currentStep.keyArgument || '').replace(
                    /\b(?:vícekanálový\s+kontakt(?:\s*\(multichannel\))?|multichannel)[^.\n]*zvedá\s+šanci[^.\n]*\.?/gi,
                    'Krátký follow-up po prvním kontaktu umožňuje ověřit, zda firma zprávu zaznamenala a zda je téma pro ni aktuální.'
                  )}
                </p>
              </div>
            </div>

            {/* Internal Personalization Basis (Strictly Internal - not in email text) */}
            {currentStep.personalizationBasis && (
              <div className="p-2 px-3 rounded-xl bg-slate-900 border border-white/5 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-medium">Podklad personalizace:</span>
                  <span className="text-slate-200 font-semibold bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    {currentStep.personalizationBasis}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Interní označení – v těle zprávy se nezobrazuje
                </span>
              </div>
            )}

            {/* Email Subject Line (for Email steps only - never for phone calls) */}
            {currentStep.channel !== 'phone' && currentStep.subject !== undefined && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Předmět e-mailu:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeDisplayedSubject, 'subject')}
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {copyFeedback === 'subject' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copyFeedback === 'subject' ? 'Zkopírováno' : 'Kopírovat předmět'}</span>
                  </button>
                </label>
                
                {isEditingText ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-blue-500/40 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium"
                    placeholder="Předmět zprávy..."
                  />
                ) : (
                  <div className="px-3 py-2 bg-slate-900/80 rounded-xl border border-white/5 text-xs text-slate-200 font-medium select-all">
                    {activeDisplayedSubject}
                  </div>
                )}
              </div>
            )}

            {/* Quality & Validation Checklist (Strictly for Day 1 Email) */}
            {currentStep.type === 'day1_email' && currentStep.channel === 'email' && (
              <div className="p-2.5 px-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">Automatická kontrola e-mailu (Den 1):</span>
                  <span className="text-slate-300">
                    {activeWordCount <= 150 ? '✅ Platná délka' : '❌ Překročen limit'} ({activeWordCount} slov) • ✅ 0 interních AI výrazů • ✅ 1 ověřený detail • ✅ CTA na hovor
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Podpis: <strong className="text-slate-200">{userProfile?.name?.trim() || 'Martin'}</strong>
                </span>
              </div>
            )}

            {/* Quality Checklist for Day 1 Phone Call */}
            {(currentStep.type === 'day1_phone' || (currentStep.channel === 'phone' && currentStep.stepNumber === 1)) && (
              <div className="p-2.5 px-3 rounded-xl bg-slate-900/80 border border-blue-500/30 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5 text-blue-300 font-medium">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-bold">Automatická kontrola hovoru (Den 1):</span>
                  <span className="text-slate-300">
                    ✅ Samostatný scénář bez předpokladu e-mailu • ✅ 1 ověřené téma z webu • ✅ Jasné CTA (5–10 min)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Volající: <strong className="text-slate-200">{userProfile?.name?.trim() || 'Martin'}</strong>
                </span>
              </div>
            )}

            {/* Message Body / Script */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-bold uppercase tracking-wider">
                  {currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'phone'
                    ? 'Scénář telefonního hovoru:'
                    : currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'whatsapp'
                      ? 'WhatsApp zpráva pro odeslání:'
                      : currentStep.channel === 'phone'
                        ? 'Scénář telefonního hovoru:'
                        : 'Text e-mailu:'}
                </span>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    currentStep.type === 'day1_email' && currentStep.channel === 'email' && activeWordCount > 150
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                      : currentStep.type === 'day1_email' && currentStep.channel === 'email' && activeWordCount >= 80 && activeWordCount <= 130
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                        : currentStep.type === 'day1_email' && currentStep.channel === 'email' && activeWordCount <= 150
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-white/5 text-slate-300 border border-white/5'
                  }`}>
                    {activeWordCount} slov
                    {currentStep.type === 'day1_email' && currentStep.channel === 'email' && (
                      activeWordCount <= 130 && activeWordCount >= 80 
                        ? ' (ideální cíl 80–130, max 150)' 
                        : activeWordCount <= 150 
                          ? ' (splňuje limit do 150)' 
                          : ' (překročeno max 150!)'
                    )}
                    {currentStep.type === 'day14_breakup' && currentStep.channel === 'email' && ' (cíl 40–70)'}
                  </span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeDisplayedText, 'body')}
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {copyFeedback === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copyFeedback === 'body' ? 'Zkopírováno!' : (currentStep.channel === 'phone' ? 'Kopírovat scénář' : 'Kopírovat text')}</span>
                  </button>
                </div>
              </div>

              {isEditingText ? (
                <div className="space-y-2">
                  {currentStep.type === 'day3_phone_whatsapp' ? (
                    activeSubTab === 'phone' ? (
                      <textarea
                        rows={7}
                        value={editedCallScript}
                        onChange={(e) => setEditedCallScript(e.target.value)}
                        className="w-full p-3 bg-slate-900 border border-blue-500/40 rounded-xl text-white text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Upravte scénář hovoru..."
                      />
                    ) : (
                      <textarea
                        rows={4}
                        value={editedWhatsappMessage}
                        onChange={(e) => setEditedWhatsappMessage(e.target.value)}
                        className="w-full p-3 bg-slate-900 border border-emerald-500/40 rounded-xl text-white text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder="Upravte WhatsApp zprávu..."
                      />
                    )
                  ) : currentStep.channel === 'phone' ? (
                    <textarea
                      rows={8}
                      value={editedCallScript || editedContent}
                      onChange={(e) => {
                        setEditedCallScript(e.target.value);
                        setEditedContent(e.target.value);
                      }}
                      className="w-full p-3 bg-slate-900 border border-blue-500/40 rounded-xl text-white text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Upravte scénář hovoru..."
                    />
                  ) : (
                    <textarea
                      rows={8}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full p-3 bg-slate-900 border border-blue-500/40 rounded-xl text-white text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Upravte text e-mailu..."
                    />
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingText(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                    >
                      Zrušit úpravy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditedStep}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Uložit text do sekvence</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-900/90 rounded-xl border border-white/5 text-xs text-slate-200 font-mono whitespace-pre-line leading-relaxed selection:bg-blue-500 selection:text-white">
                  {activeDisplayedText}
                </div>
              )}
            </div>

            {/* ACTION & SIMULATION SECTION */}
            <div className="pt-3 border-t border-white/10 space-y-3.5">
              
              {/* INTERACTIVE SIMULATION FORM (If open) */}
              {simulationOpen && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/40 via-amber-950/20 to-slate-900 border-2 border-amber-500/60 shadow-2xl shadow-amber-950/40 space-y-4 animate-in fade-in duration-200">
                  {/* Simulation Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-amber-500/30">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <FlaskConical className="w-5 h-5 text-amber-400" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-white text-sm">
                            {simulationChannel === 'phone' 
                              ? 'Simulace telefonního hovoru' 
                              : simulationChannel === 'whatsapp' 
                                ? 'Simulace WhatsApp zprávy' 
                                : 'Simulace odeslání e-mailu'}
                          </h5>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                            TESTOVACÍ SIMULACE
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/80">
                          {simulationChannel === 'phone' 
                            ? 'Telefonní aplikace se neotevře ani se nebude volat. Akce nezpůsobí reálný hovor. Vyberte výsledek pro bezpečný zápis do CRM.'
                            : 'Žádná zpráva se neodešle. Akce nezpůsobí reálné odeslání e-mailu ani WhatsApp zprávy. Vyberte výsledek pro bezpečný zápis do CRM.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSimulationOpen(false)}
                      className="text-amber-300/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Zavřít formulář simulace"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Outcome Selection Grid */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5">
                      <span>1. Zvolte výsledek simulovaného kontaktu:</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {currentSimulationOutcomes.map(outcome => {
                        const isSelected = simulationOutcomeId === outcome.id;
                        return (
                          <button
                            key={outcome.id}
                            type="button"
                            onClick={() => handleSelectOutcome(outcome)}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 shadow-md text-white'
                                : 'bg-slate-900/80 hover:bg-slate-800/80 border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs flex items-center gap-1.5">
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-amber-400 bg-amber-400' : 'border-slate-500 bg-transparent'
                                }`}>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
                                </span>
                                {outcome.label}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${outcome.badgeClass}`}>
                                {outcome.recommendedStatus}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">
                              {outcome.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DEDICATED SETUP FOR VELKÝ ZÁJEM (SCHŮZKA NEBO NABÍDKA + TERMÍN) */}
                  {simulationOutcomeId === 'high_interest' && simulationChannel === 'phone' && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          Upřesnění výsledku: Schůzka nebo nabídka a termín
                        </span>
                        <span className="text-[10px] text-emerald-200/80 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Běžný follow-up nebude naplánován
                        </span>
                      </div>

                      {/* 1. Toggle between Schůzka and Nabídka */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Zvolte konkrétní stav CRM:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCallDealStatus('Schůzka')}
                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                              callDealStatus === 'Schůzka'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/20'
                                : 'bg-slate-900/90 text-slate-300 border-white/10 hover:bg-slate-800'
                            }`}
                          >
                            <Calendar className={`w-4 h-4 flex-shrink-0 ${callDealStatus === 'Schůzka' ? 'text-slate-950' : 'text-emerald-400'}`} />
                            <div>
                              <span className="text-xs block font-bold">1. Dohodnuta schůzka</span>
                              <span className={`text-[10px] block ${callDealStatus === 'Schůzka' ? 'text-slate-900/90' : 'text-slate-400'}`}>
                                Nastavit stav CRM na <strong>Schůzka</strong>
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCallDealStatus('Nabídka')}
                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                              callDealStatus === 'Nabídka'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/20'
                                : 'bg-slate-900/90 text-slate-300 border-white/10 hover:bg-slate-800'
                            }`}
                          >
                            <Edit3 className={`w-4 h-4 flex-shrink-0 ${callDealStatus === 'Nabídka' ? 'text-slate-950' : 'text-indigo-400'}`} />
                            <div>
                              <span className="text-xs block font-bold">2. Vyžádána nabídka</span>
                              <span className={`text-[10px] block ${callDealStatus === 'Nabídka' ? 'text-slate-900/90' : 'text-slate-400'}`}>
                                Nastavit stav CRM na <strong>Nabídka</strong>
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* 2. Concrete Date/Time Input & Presets */}
                      {callDealStatus === 'Schůzka' ? (
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                              <CalendarClock className="w-4 h-4 text-emerald-400" />
                              <span>Konkrétní termín a čas schůzky:</span>
                            </label>
                            <span className="text-[11px] text-emerald-300 font-semibold">
                              {meetingDatetime ? formatCzechDateTime(new Date(meetingDatetime).toISOString()) : 'Nezadáno'}
                            </span>
                          </div>

                          <input
                            type="datetime-local"
                            value={meetingDatetime}
                            onChange={e => setMeetingDatetime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs text-white font-medium focus:outline-none focus:border-emerald-400"
                          />

                          {/* Quick Meeting Presets */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold pr-1">Rychlé předvolby:</span>
                            {[
                              { label: 'Zítra v 10:00', val: getPresetDatetime(1, 10) },
                              { label: 'Zítra ve 14:00', val: getPresetDatetime(1, 14) },
                              { label: 'Pozítří v 10:00', val: getPresetDatetime(2, 10) },
                              { label: 'Za týden v 10:00', val: getPresetDatetime(7, 10) }
                            ].map(preset => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setMeetingDatetime(preset.val)}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                  meetingDatetime === preset.val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-emerald-400" />
                              <span>Termín pro odeslání / zpracování nabídky:</span>
                            </label>
                            <span className="text-[11px] text-emerald-300 font-semibold">
                              {offerDeadlineDatetime ? formatCzechDateTime(new Date(offerDeadlineDatetime).toISOString()) : 'Bez pevného termínu'}
                            </span>
                          </div>

                          <input
                            type="datetime-local"
                            value={offerDeadlineDatetime}
                            onChange={e => setOfferDeadlineDatetime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs text-white font-medium focus:outline-none focus:border-emerald-400"
                          />

                          {/* Quick Offer Presets */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold pr-1">Rychlé předvolby:</span>
                            {[
                              { label: 'Dnes do 17:00', val: getPresetDatetime(0, 17) },
                              { label: 'Zítra do 12:00', val: getPresetDatetime(1, 12) },
                              { label: 'Do 2 dnů (17:00)', val: getPresetDatetime(2, 17) },
                              { label: 'Bez termínu', val: '' }
                            ].map(preset => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setOfferDeadlineDatetime(preset.val)}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                  offerDeadlineDatetime === preset.val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live CRM Synchronization Preview */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span className="uppercase tracking-wider">2. Co se po potvrzení stane v CRM:</span>
                      <span className="font-normal text-slate-400">Automatická synchronizace</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-xs">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">Stav leadu:</span>
                        <span className="font-black text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {simulationOutcomeId === 'high_interest' && simulationChannel === 'phone'
                            ? callDealStatus
                            : selectedOutcome.recommendedStatus}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">Naplánovaný termín:</span>
                        <span className="font-black text-blue-300 truncate block">
                          {simulationOutcomeId === 'high_interest' && simulationChannel === 'phone' ? (
                            callDealStatus === 'Schůzka' ? (
                              meetingDatetime 
                                ? `Schůzka: ${formatCzechDateTime(new Date(meetingDatetime).toISOString())}` 
                                : 'Schůzka: termín nezadán'
                            ) : (
                              offerDeadlineDatetime 
                                ? `Nabídka do: ${formatCzechDateTime(new Date(offerDeadlineDatetime).toISOString())}` 
                                : 'Bez pevného termínu'
                            )
                          ) : selectedOutcome.id === 'not_interested' ? (
                            <span className="text-rose-400 font-bold">Plánování ukončeno</span>
                          ) : simulationCustomDays > 0 ? (
                            `za ${simulationCustomDays} ${simulationCustomDays === 1 ? 'den' : simulationCustomDays < 5 ? 'dny' : 'dní'} (${formatCzechDateTime(calculateFollowUpDate(simulationCustomDays, 9))})`
                          ) : (
                            'Žádný další kontakt'
                          )}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">Zápis do historie aktivit:</span>
                        <span className="font-black text-amber-300 truncate block" title={
                          simulationOutcomeId === 'high_interest' && simulationChannel === 'phone'
                            ? (callDealStatus === 'Schůzka' ? 'Dohodnuta schůzka' : 'Vyžádána nabídka')
                            : selectedOutcome.resultTitle
                        }>
                          {simulationOutcomeId === 'high_interest' && simulationChannel === 'phone'
                            ? (callDealStatus === 'Schůzka' ? 'Dohodnuta schůzka' : 'Vyžádána nabídka')
                            : selectedOutcome.resultTitle}
                        </span>
                      </div>
                    </div>

                    {/* Quick Follow-up Day Buttons (Only for standard follow-ups) */}
                    {!(simulationOutcomeId === 'high_interest' && simulationChannel === 'phone') && selectedOutcome.id !== 'not_interested' && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-semibold pr-1">Upravit termín follow-upu:</span>
                        {[
                          { label: 'Zítra (+1 d)', days: 1 },
                          { label: 'Za 2 dny (+2 d)', days: 2 },
                          { label: 'Za 4 dny (+4 d)', days: 4 },
                          { label: 'Za týden (+7 d)', days: 7 },
                          { label: 'Bez termínu (0 d)', days: 0 }
                        ].map(preset => (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setSimulationCustomDays(preset.days)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                              simulationCustomDays === preset.days
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Explanatory badge for special outcomes */}
                    {simulationOutcomeId === 'high_interest' && simulationChannel === 'phone' && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        <span>Běžný follow-up zrušen. Lead je převeden na stav <strong>{callDealStatus}</strong> s konkrétním termínem.</span>
                      </div>
                    )}

                    {selectedOutcome.id === 'not_interested' && (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                        <span>Plánování kontaktu ukončeno – lead je nastaven na stav <strong>Odmítnuto</strong>. Žádný další kontakt se neplánuje.</span>
                      </div>
                    )}
                  </div>

                  {/* Optional Note Field */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      3. Volitelná poznámka k simulaci (uloží se do historie leadu):
                    </label>
                    <input
                      type="text"
                      value={simulationNote}
                      onChange={e => setSimulationNote(e.target.value)}
                      placeholder="Např. Test: klient požaduje nabídku e-mailem a telefon v pátek..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
                    />
                  </div>

                  {/* Simulation Confirm Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-amber-500/30">
                    <button
                      type="button"
                      onClick={() => setSimulationOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all"
                    >
                      Zrušit
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmSimulation}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-xl shadow-amber-500/30"
                    >
                      <FlaskConical className="w-4 h-4 text-slate-950" />
                      <span>Potvrdit simulaci a uložit do CRM</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TWO DISTINCT ACTION ZONES: 1. BEZPEČNÁ SIMULACE & 2. REÁLNÝ KONTAKT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  
                  {/* ZONE 1: BEZPEČNÁ SIMULACE (TESTOVACÍ REŽIM) */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-amber-900/10 border-2 border-amber-500/40 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <FlaskConical className="w-4 h-4 text-amber-400" />
                          <span className="font-extrabold text-xs text-amber-200 uppercase tracking-wider">
                            Testovací režim
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                          TESTOVACÍ SIMULACE
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/70 leading-relaxed">
                        Simulace reakcí leadu a zápisu do CRM. Nezpůsobí skutečné odeslání e-mailu, hovor ani WhatsApp.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Phone Step Simulation Buttons */}
                      {(currentStep.channel === 'phone' || currentStep.type === 'day3_phone_whatsapp') ? (
                        (currentStep.channel === 'phone' || activeSubTab === 'phone') ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openSimulation('phone')}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                              title="Spustí testovací simulaci hovoru pro bezpečný zápis do CRM"
                            >
                              <FlaskConical className="w-4 h-4 text-slate-950" />
                              <span>TESTOVACÍ SIMULACE (hovor)</span>
                            </button>
                            {isWhatsAppVerified && (
                              <button
                                type="button"
                                onClick={() => openSimulation('whatsapp')}
                                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300/80 hover:text-amber-200 text-xs font-semibold border border-white/5 transition-all flex items-center gap-1.5"
                                title="Spustí testovací simulaci WhatsApp zprávy"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Simulovat WhatsApp</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {isWhatsAppVerified ? (
                              <button
                                type="button"
                                onClick={() => openSimulation('whatsapp')}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                                title="Spustí testovací simulaci WhatsApp zprávy pro zápis do CRM"
                              >
                                <FlaskConical className="w-4 h-4 text-slate-950" />
                                <span>TESTOVACÍ SIMULACE (WhatsApp)</span>
                              </button>
                            ) : (
                              <span 
                                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-500 font-medium text-xs border border-white/5 flex items-center gap-1.5 cursor-not-allowed"
                                title="WhatsApp není pro toto číslo ověřen"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-slate-600" />
                                <span>WhatsApp není ověřen</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openSimulation('phone')}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300/80 hover:text-amber-200 text-xs font-semibold border border-white/5 transition-all flex items-center gap-1.5"
                              title="Spustí testovací simulaci telefonního hovoru"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                              <span>Simulovat hovor</span>
                            </button>
                          </>
                        )
                      ) : (
                        /* Email Steps Simulation Button */
                        <button
                          type="button"
                          onClick={() => openSimulation('email')}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                          title="Spustí testovací simulaci odeslání e-mailu pro bezpečný zápis do CRM"
                        >
                          <FlaskConical className="w-4 h-4 text-slate-950" />
                          <span>TESTOVACÍ SIMULACE (e-mail)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ZONE 2: SKUTEČNÝ KONTAKT (PŘEPÍNATELNÝ DLE GLOBÁLNÍHO REŽIMU) */}
                  <div className={`p-3.5 rounded-2xl space-y-2.5 flex flex-col justify-between border ${
                    appMode === 'real'
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950/80 border-amber-500/20'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {appMode === 'real' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className={`font-extrabold text-xs uppercase tracking-wider ${
                            appMode === 'real' ? 'text-emerald-200' : 'text-slate-300'
                          }`}>
                            {appMode === 'real' ? 'Reálný kontakt s firmou (Aktivní)' : 'Reálný kontakt s firmou (Pojistka)'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          appMode === 'real'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}>
                          {appMode === 'real' ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Reálný obchodní režim</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5" />
                              <span>Uzamčeno v testovacím režimu</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {appMode === 'real'
                          ? 'V reálném režimu můžete přímo otevřít e-mail, WhatsApp nebo vytáčet hovor. Zaznamenaný krok se zapíše do CRM jako reálná obchodní aktivita a aktualizuje skutečný CRM stav.'
                          : 'Skutečné odesílání e-mailů, WhatsApp a volání je v této fázi bezpečně uzamčeno, aby nedošlo k nechtěnému kontaktování reálných firem. Žádná externí aplikace se neotevře. Pro vyzkoušení použijte TESTOVACÍ SIMULACI.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* E-mail real action */}
                        {currentStep.channel !== 'phone' && (currentStep.channel === 'email' || currentStep.type === 'day1_email' || currentStep.type === 'day7_followup' || currentStep.type === 'day14_breakup') && (
                          hasEmail ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleOpenEmail}
                                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                                  appMode === 'real'
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-600/20'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                                }`}
                                title={appMode === 'real' ? `Pokusit se otevřít výchozí e-mailový klient pro ${lead.email}` : "V testovacím režimu je přímé odeslání uzamčeno. Kliknutím zkopírujete text a předmět do schránky."}
                              >
                                {appMode === 'real' ? (
                                  <Mail className="w-3.5 h-3.5 text-white" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                <span>{appMode === 'real' ? 'Odeslat přes e-mail' : 'Otevřít e-mail (Uzamčeno)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(`Předmět: ${activeDisplayedSubject}\n\n${activeDisplayedText}`, 'email_draft')}
                                className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1"
                                title="Zkopírovat koncept e-mailu do schránky"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Kopírovat koncept</span>
                              </button>
                              {appMode === 'real' && !showEmailFallback && (
                                <button
                                  type="button"
                                  onClick={() => setShowEmailFallback(true)}
                                  className="text-[11px] text-amber-400/80 hover:text-amber-300 hover:underline px-1 py-1 transition-colors"
                                  title="Zobrazit samostatná tlačítka pro kopírování adresy, předmětu a textu"
                                >
                                  Neotevírá se e-mail?
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-medium border border-white/5 flex items-center gap-1.5 cursor-not-allowed">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span>E-mail není k dispozici</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`Předmět: ${activeDisplayedSubject}\n\n${activeDisplayedText}`, 'email_draft')}
                                className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1"
                                title="Zkopírovat text konceptu do schránky"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Kopírovat koncept</span>
                              </button>
                            </div>
                          )
                        )}

                        {/* WhatsApp real action */}
                        {(currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'whatsapp') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleOpenWhatsApp}
                              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                                appMode === 'real'
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-600/20'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                              }`}
                              title={appMode === 'real' ? "Otevřít WhatsApp zprávu s předvyplněným textem" : "V testovacím režimu je WhatsApp uzamčen. Kliknutím zkopírujete zprávu do schránky."}
                            >
                              {appMode === 'real' ? (
                                <MessageCircle className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>{appMode === 'real' ? 'Odeslat na WhatsApp' : 'Otevřít WhatsApp (Uzamčeno)'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCopy(activeDisplayedText, 'whatsapp_draft');
                                showActionNotice('Koncept WhatsApp zprávy zkopírován do schránky.');
                              }}
                              className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1"
                              title="Zkopírovat koncept zprávy"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Kopírovat</span>
                            </button>
                          </div>
                        )}

                        {/* Phone call real action */}
                        {(currentStep.channel === 'phone' || (currentStep.type === 'day3_phone_whatsapp' && activeSubTab === 'phone')) && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleOpenPhone}
                              disabled={!hasPhone}
                              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                                !hasPhone
                                  ? 'bg-white/5 text-slate-500 cursor-not-allowed border-white/5'
                                  : appMode === 'real'
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-600/20'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                              }`}
                              title={!hasPhone ? 'Telefon není k dispozici' : appMode === 'real' ? `Vytočit ${lead.phone}` : "V testovacím režimu je vytáčení uzamčeno. Kliknutím zkopírujete telefonní číslo."}
                            >
                              {appMode === 'real' ? (
                                <PhoneCall className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>{hasPhone ? (appMode === 'real' ? `Zavolat (${lead.phone})` : 'Zavolat (Uzamčeno)') : 'Telefon není k dispozici'}</span>
                            </button>
                            {hasPhone && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopy(lead.phone.replace(/\s+/g, ''), 'phone_number');
                                  showActionNotice(`Telefonní číslo ${lead.phone} zkopírováno.`);
                                }}
                                className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1"
                                title="Zkopírovat telefonní číslo"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Kopírovat číslo</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Save simulation / real activity to CRM */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLogStepActivity(true)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            appMode === 'real'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                              : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                          }`}
                          title={appMode === 'real' ? "Zaznamenat tento krok do CRM a aktualizovat skutečný stav leadu" : "Zaznamenat tento krok jako TESTOVACÍ SIMULACI do CRM"}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${appMode === 'real' ? 'text-slate-950' : 'text-amber-400'}`} />
                          <span>{appMode === 'real' ? 'Zapsat kontakt do CRM' : 'Zapsat TESTOVACÍ SIMULACI do CRM'}</span>
                        </button>

                        {onOpenLoggerModal && (
                          <button
                            type="button"
                            onClick={() => onOpenLoggerModal('log_contact')}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-colors"
                            title={appMode === 'real' ? "Otevřít podrobný dialog pro zaznamenání kontaktu do CRM" : "Otevřít podrobný dialog pro zaznamenání testovací simulace do CRM"}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Robustní Fallback pro e-mail (iPhone / Google AI Studio Preview iFrame) */}
                    {showEmailFallback && hasEmail && (currentStep.channel === 'email' || currentStep.type === 'day1_email' || currentStep.type === 'day7_followup' || currentStep.type === 'day14_breakup') && (
                      <div className="mt-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm font-semibold text-amber-200 leading-snug">
                                E-mailového klienta se nepodařilo otevřít. Zkopírujte připravený e-mail a odešlete jej ve své poštovní aplikaci.
                              </p>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                V náhledu aplikace nebo na mobilním zařízení (např. iPhone) může prohlížeč blokovat spuštění poštovní aplikace. Zkopírujte si jednotlivé části přímo:
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowEmailFallback(false)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                            title="Skrýt fallback panel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 3 samostatná tlačítka pro kopírování: adresa, předmět, celý text */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          {/* 1. Kopírovat adresu */}
                          <button
                            type="button"
                            onClick={() => {
                              const emailTo = lead.email && lead.email !== 'Nedostupné' ? lead.email.trim() : '';
                              handleCopy(emailTo, 'fallback_addr');
                              showActionNotice(`Adresa ${emailTo} byla zkopírována do schránky.`);
                            }}
                            className="px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-amber-500/20 hover:border-amber-400/40 text-left transition-all group flex flex-col justify-between gap-1"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-amber-400" />
                                <span>Kopírovat adresu</span>
                              </span>
                              {copyFeedback === 'fallback_addr' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-colors" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate max-w-full font-mono">
                              {lead.email}
                            </span>
                          </button>

                          {/* 2. Kopírovat předmět */}
                          <button
                            type="button"
                            onClick={() => {
                              handleCopy(activeDisplayedSubject, 'fallback_subj');
                              showActionNotice('Předmět e-mailu byl zkopírován do schránky.');
                            }}
                            className="px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-amber-500/20 hover:border-amber-400/40 text-left transition-all group flex flex-col justify-between gap-1"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-amber-400" />
                                <span>Kopírovat předmět</span>
                              </span>
                              {copyFeedback === 'fallback_subj' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-colors" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate max-w-full">
                              {activeDisplayedSubject || '(bez předmětu)'}
                            </span>
                          </button>

                          {/* 3. Kopírovat celý text */}
                          <button
                            type="button"
                            onClick={() => {
                              handleCopy(activeDisplayedText, 'fallback_body');
                              showActionNotice('Celý text e-mailu byl zkopírován do schránky.');
                            }}
                            className="px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-amber-500/20 hover:border-amber-400/40 text-left transition-all group flex flex-col justify-between gap-1"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                                <Copy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Kopírovat celý text</span>
                              </span>
                              {copyFeedback === 'fallback_body' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-colors" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate max-w-full">
                              {activeDisplayedText.slice(0, 32)}...
                            </span>
                          </button>
                        </div>

                        {/* Doplňková akce pro opakovaný pokus */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20 text-xs">
                          <button
                            type="button"
                            onClick={handleOpenEmail}
                            className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 hover:underline"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Zkusit znovu otevřít e-mailový klient</span>
                          </button>

                          {appMode === 'real' && (
                            <button
                              type="button"
                              onClick={() => setEmailConfirmationModalOpen(true)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Zapsat výsledek e-mailu do CRM</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

            </div>
          </div>
        )}

      </div>
    )}

    {/* Explicitní dialog pro potvrzení skutečného odeslání e-mailu do CRM v reálném režimu */}
    {emailConfirmationModalOpen && (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Potvrzení stavu e-mailu</h3>
                <p className="text-[11px] text-slate-400">{lead.companyName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmailConfirmationModalOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1.5">
              <p className="text-xs font-semibold text-slate-200">
                Byl e-mail pro firmu „{lead.companyName}“ již skutečně odeslán ve vaší poštovní aplikaci?
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Webová aplikace otevírá externího e-mailového klienta (či nabízí zkopírování textu), proto nemůže sama ověřit odeslání. Potvrďte skutečný výsledek:
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Volba 1: Skutečně odesláno */}
              <button
                type="button"
                onClick={() => executeLogStepActivity(true)}
                className="w-full p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-left transition-all border border-emerald-400/50 shadow-md shadow-emerald-900/30 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Ano, e-mail byl skutečně odeslán</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-75 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10.5px] text-emerald-100 mt-1 leading-normal">
                  Označí e-mail za odeslaný, posune sekvenci na další krok a nastaví CRM stav na „Osloveno“ (s plánem follow-upu).
                </p>
              </button>

              {/* Volba 2: Pouze připraven koncept */}
              <button
                type="button"
                onClick={() => executeLogStepActivity(false)}
                className="w-full p-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-left transition-all border border-white/10 hover:border-amber-400/40 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-amber-300">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Zatím neodesláno (pouze připraven koncept)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-75 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">
                  Zapíše přípravu zprávy do historie aktivit CRM. Stav leadu i krok sekvence zůstanou neuzavřené pro pozdější odeslání.
                </p>
              </button>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-950/60 border-t border-white/5 flex justify-end">
            <button
              type="button"
              onClick={() => setEmailConfirmationModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
};
