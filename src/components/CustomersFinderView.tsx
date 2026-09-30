import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  MapPin, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  Send, 
  PhoneCall, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  TrendingUp, 
  DollarSign, 
  Flame, 
  ArrowRight, 
  Filter, 
  Sparkles, 
  Plus, 
  Trash2, 
  RotateCw,
  ExternalLink,
  ShieldAlert,
  Info,
  Compass,
  BarChart3,
  Lock,
  FlaskConical
} from 'lucide-react';
import { 
  PotentialCustomerLead, 
  LeadStatus, 
  CustomerSearchCriteria, 
  CustomerFinderResponse, 
  UserProfile, 
  BusinessDirection,
  ContactChannel,
  LeadActivity,
  LeadIntelligence,
  AppExecutionMode
} from '../types';
import { findPotentialCustomers, fetchSavedLeads, saveLeadsToServer, saveOutreachSequenceToServer, recordLeadActivityOnServer } from '../services/api';
import { generateOutreachSequence } from '../utils/outreachGenerator';
import { LeadActivityLoggerModal } from './LeadActivityLoggerModal';
import { LeadActivityHistoryList } from './LeadActivityHistoryList';
import { OutreachStudio } from './OutreachStudio';
import { LeadIntelligenceSection } from './LeadIntelligenceSection';
import { 
  createActivityEntry, 
  normalizeLeadStatusSeparation,
  formatCzechDateTime, 
  getFollowUpStatusInfo, 
  isFollowUpDueTodayOrOverdue, 
  isFollowUpOverdue 
} from '../utils/leadActivities';
import { mergeLeadsWithExisting } from '../utils/leadMerge';
import { cleanCzechAddress, cleanCzechCity } from '../utils/locationCleaner';

export const formatFactorCategory = (category: string): string => {
  switch (category) {
    case 'Oborová shoda':
      return 'Shoda s cílovým oborem';
    case 'Vzdálenost':
    case 'Vzdělanost':
    case 'Vzdelanost':
      return 'Vzdálenost / lokalita';
    case 'Hodnocení':
      return 'Veřejné hodnocení';
    case 'Počet recenzí':
      return 'Počet veřejných recenzí';
    case 'Telefonní kontakt':
      return 'Veřejný telefon';
    case 'Webová prezentace':
      return 'Veřejný web';
    default:
      return category;
  }
};

interface CustomersFinderViewProps {
  userProfile: UserProfile;
  currentProject: string;
  recommendedDirection?: BusinessDirection | null;
  onNavigateToIdeas?: () => void;
  onSetDailyStepFromLead?: (lead: PotentialCustomerLead) => void;
  leads?: PotentialCustomerLead[];
  onUpdateLeads?: (leads: PotentialCustomerLead[]) => void;
  initialExpandedLeadId?: string | null;
  onNavigateToSales?: () => void;
  appMode?: AppExecutionMode;
}

const STORAGE_KEY_LEADS = 'podnikai_customer_leads';
const STORAGE_KEY_LAST_CRITERIA = 'podnikai_customer_search_criteria';

export const CustomersFinderView: React.FC<CustomersFinderViewProps> = ({
  userProfile,
  currentProject,
  recommendedDirection,
  onNavigateToIdeas,
  onSetDailyStepFromLead,
  leads: propsLeads,
  onUpdateLeads,
  initialExpandedLeadId,
  onNavigateToSales,
  appMode = 'test'
}) => {
  // Search Form State
  const [cityOrRegion, setCityOrRegion] = useState<string>(() => {
    return userProfile?.location || 'České Budějovice';
  });
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(25);
  const [companyType, setCompanyType] = useState<string>(() => {
    if (recommendedDirection?.targetCustomer) {
      return recommendedDirection.targetCustomer;
    }
    return 'Lokální firmy, živnostníci a provozovny';
  });
  const [numberOfLeads, setNumberOfLeads] = useState<number>(5);

  // Leads and data state
  const [localLeads, setLocalLeads] = useState<PotentialCustomerLead[]>(() => {
    if (propsLeads && propsLeads.length > 0) return propsLeads.map(normalizeLeadStatusSeparation);
    const saved = localStorage.getItem(STORAGE_KEY_LEADS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(normalizeLeadStatusSeparation) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // If propsLeads is passed by parent (App.tsx), it is the single source of truth
  const leads = propsLeads !== undefined ? propsLeads : localLeads;

  // Unified leads updater that notifies parent and persists safely without useEffect loops
  const setLeads = (updater: PotentialCustomerLead[] | ((prev: PotentialCustomerLead[]) => PotentialCustomerLead[])) => {
    const rawNext = typeof updater === 'function' ? updater(leads) : updater;
    const nextLeads = rawNext.map(normalizeLeadStatusSeparation);
    if (onUpdateLeads) {
      onUpdateLeads(nextLeads);
    } else {
      setLocalLeads(nextLeads);
    }
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(nextLeads));
    saveLeadsToServer(nextLeads).catch(() => {});
  };

  const [dataNotice, setDataNotice] = useState<CustomerFinderResponse['dataNotice'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI state
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'today' | LeadStatus>('all');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(initialExpandedLeadId || null);
  const [expandedScoreBreakdownId, setExpandedScoreBreakdownId] = useState<string | null>(null);
  const [activeScriptType, setActiveScriptType] = useState<{ [leadId: string]: 'email' | 'sms' | 'phone' }>({});
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [contactCopyToast, setContactCopyToast] = useState<string | null>(null);
  const [editingDealValueId, setEditingDealValueId] = useState<string | null>(null);
  const [dealValueInput, setDealValueInput] = useState<string>('');

  useEffect(() => {
    if (initialExpandedLeadId) {
      setExpandedLeadId(initialExpandedLeadId);
      setActiveTabFilter('all');
      setTimeout(() => {
        const el = document.getElementById(`lead-card-${initialExpandedLeadId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [initialExpandedLeadId]);

  // View mode map for expanded lead: 'outreach_studio' (default) vs 'quick_script'
  const [leadViewMode, setLeadViewMode] = useState<Record<string, 'outreach_studio' | 'quick_script'>>({});

  const handleUpdateLead = (updatedLead: PotentialCustomerLead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  const handleOpenOutreachStudioWithIntelligence = (leadToOpen: PotentialCustomerLead, passedIntelligence?: LeadIntelligence) => {
    // 1. Ensure latest Lead Intelligence is attached to lead
    const effectiveIntelligence = passedIntelligence || leadToOpen.leadIntelligence;
    const leadWithIntel: PotentialCustomerLead = {
      ...leadToOpen,
      leadIntelligence: effectiveIntelligence
    };

    // 2. Generate or update 4-step sequence using the Lead Intelligence data
    const tone = leadWithIntel.outreachSequence?.tone || 'professional';
    const newSeq = generateOutreachSequence(leadWithIntel, {
      tone,
      userProfile: userProfile || undefined,
      concreteOffer: recommendedDirection?.concreteOffer || userProfile?.currentProject,
      businessDirectionTitle: recommendedDirection?.title || currentProject
    });

    // Preserve status and timestamps of already sent steps
    if (leadWithIntel.outreachSequence?.steps) {
      newSeq.steps = newSeq.steps.map((st, idx) => {
        const prevStep = leadWithIntel.outreachSequence?.steps[idx];
        if (prevStep && prevStep.status === 'sent') {
          return {
            ...st,
            status: 'sent' as const,
            sentAt: prevStep.sentAt
          };
        }
        return st;
      });
    }

    const updatedLead: PotentialCustomerLead = {
      ...leadWithIntel,
      outreachSequence: newSeq
    };

    // 3. Update lead in state & save sequence to server
    handleUpdateLead(updatedLead);
    saveOutreachSequenceToServer(updatedLead.id, newSeq).catch(console.warn);

    // 4. Expand Outreach Studio for this lead and select outreach_studio view
    setExpandedLeadId(updatedLead.id);
    setLeadViewMode(prev => ({ ...prev, [updatedLead.id]: 'outreach_studio' }));

    // 5. Scroll smoothly to the Outreach Studio container
    setTimeout(() => {
      const el = document.getElementById(`lead-outreach-container-${updatedLead.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };
  const [activeModalLead, setActiveModalLead] = useState<{ lead: PotentialCustomerLead; mode: 'log_contact' | 'schedule_only' } | null>(null);

  // Initial load from server only when used standalone (without propsLeads)
  useEffect(() => {
    if (propsLeads === undefined) {
      fetchSavedLeads().then((serverLeads) => {
        if (Array.isArray(serverLeads) && serverLeads.length > 0) {
          setLocalLeads((prev) => {
            if (prev.length === 0) {
              localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(serverLeads));
              return serverLeads;
            }
            return prev;
          });
        }
      }).catch(() => {});
    }
  }, [propsLeads]);

  // Handle Search Trigger
  const handleFindCustomers = async (overrideCriteria?: Partial<CustomerSearchCriteria>) => {
    setIsLoading(true);
    setErrorMsg(null);

    // Rule: Search input location has absolute priority. userProfile.location is only a fallback if input is empty.
    const searchLocation = (overrideCriteria?.cityOrRegion ?? cityOrRegion).trim() || userProfile?.location || 'České Budějovice';

    const criteria: CustomerSearchCriteria = {
      cityOrRegion: searchLocation,
      maxDistanceKm: overrideCriteria?.maxDistanceKm ?? maxDistanceKm,
      companyType: (overrideCriteria?.companyType ?? companyType).trim(),
      numberOfLeads: overrideCriteria?.numberOfLeads ?? numberOfLeads,
      businessDirectionTitle: recommendedDirection?.title || currentProject || 'Služby a automatizace',
      concreteOffer: recommendedDirection?.concreteOffer || 'Zefektivnění procesů a získání zákazníků'
    };

    try {
      const response = await findPotentialCustomers(userProfile, criteria);
      setDataNotice(response.dataNotice);
      
      // Safe CRM Merge: Existing leads are merged preserving all CRM data; fresh search results are added without duplicates
      const freshLeads = response.leads || [];
      setLeads(prevLeads => mergeLeadsWithExisting(prevLeads, freshLeads));

      if (freshLeads.length > 0) {
        setExpandedLeadId(freshLeads[0].id);
      } else {
        setExpandedLeadId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Nepodařilo se vyhledat zákazníky.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear leads completely
  const handleClearAllLeads = () => {
    setLeads([]);
    setDataNotice(null);
    setExpandedLeadId(null);
    localStorage.removeItem(STORAGE_KEY_LEADS);
    saveLeadsToServer([]).catch(() => {});
  };

  // Status Change with Automatic Activity Logging ("Po každé změně stavu se tato aktivita musí uložit do historie firmy.")
  const handleUpdateStatus = (leadId: string, newStatus: LeadStatus, note?: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const channel: ContactChannel = l.lastContactChannel || (l.phone && l.phone !== 'Nedostupné' ? 'phone' : 'other');
        const currentReal = l.realStatus || l.status;
        const result = `Změna reálného stavu CRM: ${currentReal} → ${newStatus}`;
        const { updatedLead } = createActivityEntry(l, channel, result, newStatus, note, undefined, false);
        return updatedLead;
      }
      return l;
    }));

    recordLeadActivityOnServer(leadId, {
      channel: 'other',
      result: `Změna reálného stavu CRM → ${newStatus}`,
      status: newStatus,
      note,
      isSimulation: false
    }).catch(console.warn);
  };

  // Dedicated Activity & Next Contact Save Handler
  const handleSaveLeadActivity = (
    leadId: string, 
    channel: ContactChannel, 
    result: string, 
    newStatus: LeadStatus, 
    note?: string, 
    nextContactDate?: string,
    isSimulation?: boolean
  ) => {
    const actualIsSim = typeof isSimulation === 'boolean' ? isSimulation : (appMode !== 'real');
    let savedLead: PotentialCustomerLead | undefined;
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const { updatedLead } = createActivityEntry(l, channel, result, newStatus, note, nextContactDate, actualIsSim);
        savedLead = updatedLead;
        return updatedLead;
      }
      return l;
    }));

    recordLeadActivityOnServer(leadId, {
      channel,
      result,
      status: newStatus,
      note,
      nextContactDate: nextContactDate || undefined,
      scheduledAt: nextContactDate || undefined,
      isSimulation: actualIsSim
    }).catch(console.warn);

    if (savedLead?.outreachSequence) {
      saveOutreachSequenceToServer(leadId, savedLead.outreachSequence).catch(console.warn);
    }
  };

  // Toggle Contact Today
  const handleToggleContactToday = (leadId: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const nextState = !l.contactToday;
        const currentReal = l.realStatus || l.status;
        const newStatus: LeadStatus = nextState && currentReal === 'Nový' ? 'Dnes oslovit' : currentReal;
        const { updatedLead } = createActivityEntry(
          l, 
          'other', 
          nextState ? 'Zařazeno mezi dnešní prioritní kontakty' : 'Odebráno z dnešních priorit', 
          newStatus,
          undefined,
          undefined,
          false
        );
        updatedLead.contactToday = nextState;
        return updatedLead;
      }
      return l;
    }));
  };

  // Delete Lead
  const handleDeleteLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
  };

  // Copy script to clipboard
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  // Save deal value
  const handleSaveDealValue = (leadId: string) => {
    const val = parseInt(dealValueInput.replace(/\s+/g, ''), 10);
    if (!isNaN(val) && val >= 0) {
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          const currentReal = l.realStatus || l.status;
          const { updatedLead } = createActivityEntry(
            l, 
            'other', 
            `Zadána hodnota zakázky: ${val.toLocaleString('cs-CZ')} Kč`, 
            currentReal,
            `Nastavena hodnota obchodu na ${val.toLocaleString('cs-CZ')} Kč`,
            undefined,
            false
          );
          updatedLead.dealValue = val;
          return updatedLead;
        }
        return l;
      }));
    }
    setEditingDealValueId(null);
    setDealValueInput('');
  };

  // Helper: Get real CRM status strictly unaffected by simulations
  const getRealLeadStatus = (l: PotentialCustomerLead): LeadStatus => l.realStatus || l.status;

  // Funnel & Stats metrics calculation (Strictly real CRM metrics)
  const totalLeads = leads.length;
  const todayDueCount = leads.filter(l => {
    const realStat = getRealLeadStatus(l);
    if (['Odmítnuto', 'Nekontaktovat', 'Zákazník'].includes(realStat)) return false;
    const realNext = l.realNextContactDate || (l.activities?.some(a => !a.isSimulation) ? (l.nextContactDate || l.scheduledAt) : undefined);
    return (realNext && isFollowUpDueTodayOrOverdue(realNext)) || realStat === 'Dnes oslovit' || l.contactToday;
  }).length;
  const contactedCount = leads.filter(l => ['Osloveno', 'Osloven', 'Odpověděl', 'Zájem', 'Schůzka', 'Nabídka', 'Zákazník', 'Vyhráno'].includes(getRealLeadStatus(l))).length;
  const repliedAndInterestCount = leads.filter(l => ['Odpověděl', 'Zájem', 'Schůzka', 'Nabídka', 'Zákazník', 'Vyhráno'].includes(getRealLeadStatus(l))).length;
  const meetingAndOfferCount = leads.filter(l => ['Schůzka', 'Nabídka', 'Zákazník', 'Vyhráno'].includes(getRealLeadStatus(l))).length;
  const customerCount = leads.filter(l => ['Zákazník', 'Vyhráno'].includes(getRealLeadStatus(l))).length;
  const totalRevenue = leads
    .filter(l => ['Zákazník', 'Vyhráno'].includes(getRealLeadStatus(l)) && l.dealValue)
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const todayContacts = leads.filter(l => {
    const realStat = getRealLeadStatus(l);
    if (['Odmítnuto', 'Nekontaktovat', 'Zákazník'].includes(realStat)) return false;
    const realNext = l.realNextContactDate || (l.activities?.some(a => !a.isSimulation) ? (l.nextContactDate || l.scheduledAt) : undefined);
    return (realNext && isFollowUpDueTodayOrOverdue(realNext)) || realStat === 'Dnes oslovit' || l.contactToday;
  });

  // Filtered leads list (strictly by real CRM status)
  const displayedLeads = leads.filter(lead => {
    const realStat = getRealLeadStatus(lead);
    if (activeTabFilter === 'all') return true;
    if (activeTabFilter === 'today') {
      const realNext = lead.realNextContactDate || (lead.activities?.some(a => !a.isSimulation) ? (lead.nextContactDate || lead.scheduledAt) : undefined);
      return (realNext && isFollowUpDueTodayOrOverdue(realNext)) || realStat === 'Dnes oslovit' || lead.contactToday;
    }
    return realStat === activeTabFilter;
  });

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'Nový':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Dnes oslovit':
        return 'bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold';
      case 'Osloveno':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Odpověděl':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Zájem':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-semibold';
      case 'Schůzka':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30 font-semibold';
      case 'Nabídka':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 font-semibold';
      case 'Zákazník':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
      case 'Odmítnuto':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'Nekontaktovat':
        return 'bg-zinc-600/30 text-zinc-400 border-zinc-500/30 line-through';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="space-y-2.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
            <Users className="w-3.5 h-3.5" />
            <span>Exekuční akvizice zákazníků PODNIKAI</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Najdi první zákazníky
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Převeď vybraný podnikatelský směr 
            <strong className="text-blue-400"> {recommendedDirection?.title || currentProject || 'svůj projekt'} </strong> 
            do konkrétního seznamu potenciálních klientů s personalizovanými zprávami a CRM trychtýřem.
          </p>
        </div>

        {recommendedDirection && (
          <div className="relative z-10 flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="p-3.5 rounded-2xl bg-blue-950/50 border border-blue-500/30 text-xs text-blue-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Aktivní směr:</span>
              <span className="font-bold text-white text-sm">{recommendedDirection.title}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. OVERVIEW METRICS FUNNEL (Bod 8) */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Přehled konverzního trychtýře & Výsledky</span>
          </div>
          <span className="text-xs text-slate-400">
            Celkem v databázi: <strong className="text-white">{totalLeads}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-1">
          
          {/* 1. Počet leadů */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-1">
            <span className="text-[11px] font-medium text-slate-400 block">1. Všech leadů</span>
            <span className="text-xl sm:text-2xl font-black text-white font-heading">{totalLeads}</span>
          </div>

          {/* 2. Dnes oslovit */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-amber-500/20 text-center space-y-1">
            <span className="text-[11px] font-medium text-amber-300 block">2. Dnes oslovit</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-heading">{todayDueCount}</span>
          </div>

          {/* 3. Osloveno */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-purple-500/20 text-center space-y-1">
            <span className="text-[11px] font-medium text-purple-300 block">3. Osloveno</span>
            <span className="text-xl sm:text-2xl font-black text-purple-400 font-heading">{contactedCount}</span>
          </div>

          {/* 4. Odpovědi & Zájem */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-cyan-500/20 text-center space-y-1">
            <span className="text-[11px] font-medium text-cyan-300 block">4. Odpověď / Zájem</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-heading">{repliedAndInterestCount}</span>
          </div>

          {/* 5. Schůzky & Nabídky */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-orange-500/20 text-center space-y-1">
            <span className="text-[11px] font-medium text-orange-300 block">5. Schůzka / Nabídka</span>
            <span className="text-xl sm:text-2xl font-black text-orange-400 font-heading">{meetingAndOfferCount}</span>
          </div>

          {/* 6. Zákazníci */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-center space-y-1">
            <span className="text-[11px] font-bold text-emerald-300 block">6. Zákazníci</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-heading">{customerCount}</span>
          </div>

          {/* 7. Tržba */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-emerald-300 block">7. Tržba (Kč)</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 font-heading truncate block">
              {totalRevenue.toLocaleString('cs-CZ')} Kč
            </span>
          </div>

        </div>
      </div>

      {/* 3. SEARCH FORM (Bod 2) */}
      <div className="bg-gradient-to-b from-blue-950/30 to-slate-900/80 border border-blue-500/30 rounded-3xl p-6 sm:p-7 backdrop-blur-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            <h2 className="font-heading text-lg font-bold text-white">
              Vyhledávací parametry potenciálních zákazníků
            </h2>
          </div>
          {recommendedDirection && (
            <span className="text-[11px] text-blue-300 font-medium hidden sm:inline-block">
              Předvyplněno podle doporučeného směru
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Město / Oblast */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Město / Oblast v ČR
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="input-customer-city"
                type="text"
                value={cityOrRegion}
                onChange={(e) => setCityOrRegion(e.target.value)}
                placeholder="např. České Budějovice, Brno, Praha..."
                className="w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Maximální vzdálenost */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Max. vzdálenost: <strong className="text-blue-400">{maxDistanceKm} km</strong>
            </label>
            <div className="pt-2">
              <input
                id="input-customer-distance"
                type="range"
                min={5}
                max={150}
                step={5}
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                <span>5 km</span>
                <span>50 km</span>
                <span>150 km (Celý kraj)</span>
              </div>
            </div>
          </div>

          {/* Typ firmy */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Typ firmy / Obor
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="input-customer-company-type"
                type="text"
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                placeholder="např. Realitní makléři, Pneuservisy, Kadeřnictví..."
                className="w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Počet potenciálních zákazníků */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Počet firem k vyhledání
            </label>
            <select
              id="select-customer-count"
              value={numberOfLeads}
              onChange={(e) => setNumberOfLeads(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value={3}>3 firmy (Rychlý pilot)</option>
              <option value={5}>5 firem (Doporučeno pro dnešek)</option>
              <option value={10}>10 firem (Týdenní sprint)</option>
            </select>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Striktní epistemická validace: Pouze ověřitelná data, žádné vymyšlené kontakty.</span>
          </div>

          <button
            id="btn-trigger-find-customers"
            onClick={() => handleFindCustomers()}
            disabled={isLoading || !cityOrRegion.trim() || !companyType.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Vyhledávám v oblasti...' : 'Najít první zákazníky'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Chyba vyhledávání firem</span>
            </div>
            <p className="leading-relaxed text-rose-200">{errorMsg}</p>
            {errorMsg.includes('není nakonfigurováno') && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/20 text-slate-300 text-[11px] space-y-1">
                <p className="font-semibold text-white">Jak aktivovat reálné vyhledávání firem:</p>
                <p>1. V nastavení projektu (Secrets / .env) přidejte klíč <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded font-mono">GOOGLE_MAPS_API_KEY</code>.</p>
                <p>2. Aplikace začne stahovat skutečné firmy, adresy, weby, telefony a hodnocení přímo z Google Maps v reálném čase bez halucinací a bez mock dat.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EPISTEMIC DATA SOURCE NOTICE BANNER */}
      {dataNotice && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-blue-500/20 text-xs space-y-2 backdrop-blur-xl">
          <div className="flex items-center gap-2 font-bold text-blue-400 uppercase tracking-wider text-[11px]">
            <Info className="w-4 h-4" />
            <span>Epistemický původ dat & Ověření kontaktů</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {dataNotice.dataSourceInfo}
          </p>
          {dataNotice.missingDataSourceWarning && (
            <p className="text-amber-300/90 text-[11px] italic">
              {dataNotice.missingDataSourceWarning}
            </p>
          )}
        </div>
      )}

      {/* 4. TODAY'S CONTACTS SHORTLIST (Bod 7) */}
      {todayContacts.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-blue-950/30 border-2 border-amber-500/40 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
              <Flame className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Dnešní prioritní kontakty ({todayContacts.length})</span>
            </div>
            <span className="text-xs text-slate-400">
              Tyto firmy oslov ještě dnes. Nenechávej oslovení na zítra!
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayContacts.map(lead => (
              <div 
                key={`today-${lead.id}`}
                className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/20 space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white truncate max-w-[170px]">{lead.companyName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 line-clamp-2">
                    {lead.fitReason}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setExpandedLeadId(lead.id);
                      const el = document.getElementById(`lead-card-${lead.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    <span>Otevřít zprávy</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(lead.id, 'Osloveno')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold transition-colors flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Označit: Osloveno</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast notice for test mode copy actions */}
      {contactCopyToast && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{contactCopyToast}</span>
        </div>
      )}

      {/* 5. FILTER TABS & SEARCH LIST */}
      <div className="space-y-4">
        
        {/* Navigation / Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap gap-1.5">
            
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTabFilter === 'all'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Všechny ({totalLeads})
            </button>

            <button
              onClick={() => setActiveTabFilter('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTabFilter === 'today'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-amber-300'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Dnes kontaktovat ({todayContacts.length})</span>
            </button>

            {allStatuses.map(st => {
              const count = leads.filter(l => l.status === st).length;
              if (count === 0 && activeTabFilter !== st) return null;
              return (
                <button
                  key={st}
                  onClick={() => setActiveTabFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTabFilter === st
                      ? 'bg-white/20 text-white border border-white/20'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}

          </div>

          <div className="flex items-center gap-3">
            {onNavigateToSales && (
              <button
                id="btn-goto-sales-analytics"
                onClick={onNavigateToSales}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all shadow-sm"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Obchodní Dashboard</span>
              </button>
            )}

            <span className="text-xs text-slate-400">
              Zobrazeno: <strong className="text-slate-200">{displayedLeads.length}</strong> firem
            </span>
            {leads.length > 0 && (
              <button
                onClick={handleClearAllLeads}
                title="Vymazat stávající seznam a začít znovu"
                className="text-[11px] text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vyčistit</span>
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {displayedLeads.length === 0 && !isLoading && (
          <div className="p-12 rounded-3xl bg-white/5 border border-white/10 text-center space-y-4 backdrop-blur-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-heading text-lg font-bold text-white">
                Zatím tu nemáš žádné potenciální zákazníky
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zadej nahoře své město a obor a klikni na tlačítko <strong>„Najít první zákazníky“</strong>. 
                Aplikace vygeneruje seznam s hodnocením a personalizovanými zprávami.
              </p>
            </div>
            <button
              onClick={() => handleFindCustomers()}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20"
            >
              Vyhledat první firmy
            </button>
          </div>
        )}

        {/* Leads List Cards (Bod 3, 4, 5, 6) */}
        <div className="space-y-4">
          {displayedLeads.map(lead => {
            const isExpanded = expandedLeadId === lead.id;
            const hasPhone = Boolean(lead.phone && lead.phone !== 'Nedostupné');
            const hasEmail = Boolean(lead.email && lead.email !== 'Nedostupné');
            const hasWebsite = Boolean(lead.website && lead.website !== 'Nedostupné');
            const currentScript = activeScriptType[lead.id] || (!hasEmail && hasPhone ? 'phone' : 'email');

            return (
              <div
                key={lead.id}
                id={`lead-card-${lead.id}`}
                className={`rounded-3xl border transition-all duration-200 backdrop-blur-xl overflow-hidden ${
                  lead.contactToday
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-xl'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Main Card Header / Summary Row */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Left: Company Name, Fit Score, Industry */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-heading text-xl font-extrabold text-white">
                          {lead.companyName}
                        </h3>

                        {/* Scheduled Next Contact Badge */}
                        {(lead.nextContactDate || lead.scheduledAt) && (
                          <div className="flex items-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                              lead.status === 'Schůzka'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : getFollowUpStatusInfo(lead.nextContactDate || lead.scheduledAt).badgeClass
                            }`}>
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>
                                {lead.status === 'Schůzka'
                                  ? `Schůzka: ${formatCzechDateTime(lead.nextContactDate || lead.scheduledAt)}`
                                  : getFollowUpStatusInfo(lead.nextContactDate || lead.scheduledAt).displayText}
                              </span>
                            </span>
                          </div>
                        )}

                        {lead.simulationNextContactDate && (
                          <div className="flex items-center">
                            <span 
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"
                              title="Testovací termín příštího kontaktu ze simulace (neovlivňuje reálný CRM kalendář)"
                            >
                              <FlaskConical className="w-3 h-3 text-amber-400" />
                              <span>Testovací follow-up: {formatCzechDateTime(lead.simulationNextContactDate)}</span>
                            </span>
                          </div>
                        )}

                        {lead.contactToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <Flame className="w-3 h-3 fill-slate-950" />
                            <span>Dnes oslovit</span>
                          </span>
                        )}

                        {lead.simulationStatus && (
                          <span 
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1 shadow-sm" 
                            title="Tato hodnota pochází z testovací simulace a neovlivňuje reálný CRM stav"
                          >
                            <FlaskConical className="w-3 h-3 text-amber-400" />
                            <span>TESTOVACÍ STAV: {lead.simulationStatus}</span>
                          </span>
                        )}
                      </div>

                      {/* Skóre shody s kritérii */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                              lead.fitScore >= 80 
                                ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' 
                                : lead.fitScore >= 60 
                                  ? 'text-blue-300 bg-blue-500/20 border-blue-500/40' 
                                  : 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                            }`}
                            title={lead.fitScore === 100 
                              ? 'Firma splňuje předem nastavená kritéria podle dostupných ověřených veřejných údajů.' 
                              : `Firma splňuje předem nastavená kritéria na ${lead.fitScore} / 100 bodů podle dostupných ověřených veřejných údajů.`
                            }
                          >
                            <span>Skóre shody s kritérii:</span>
                            <strong className="font-extrabold">{lead.fitScore} / 100</strong>
                          </span>

                          {lead.scoreBreakdown && lead.scoreBreakdown.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedScoreBreakdownId(expandedScoreBreakdownId === lead.id ? null : lead.id)}
                              className="text-[11px] text-slate-400 hover:text-blue-300 transition-colors underline flex items-center gap-1 px-1.5 py-0.5"
                              title="Zobrazit detailní rozpad bodů za jednotlivá kritéria"
                            >
                              <Info className="w-3 h-3 text-blue-400" />
                              <span>{expandedScoreBreakdownId === lead.id ? 'Skrýt kritéria' : 'Rozpad kritérií'}</span>
                            </button>
                          )}
                        </div>

                        {/* Pod skóre: Míra splnění předem nastavených kritérií podle ověřených veřejných údajů */}
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Míra splnění předem nastavených kritérií podle ověřených veřejných údajů. Skóre není pravděpodobností nákupu, kvalitou leadu ani predikcí konverze.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          {lead.industry}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          {lead.address && lead.address !== 'Nedostupné' ? (
                            <a
                              href={lead.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.companyName} ${cleanCzechAddress(lead.address)}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-300 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
                              title="Otevřít v Google Maps"
                            >
                              <span>{cleanCzechAddress(lead.address)}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            </a>
                          ) : (
                            <span>{cleanCzechCity(lead.city)}</span>
                          )}
                        </span>
                        {typeof lead.distanceKm === 'number' && (
                          <>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 font-bold border border-blue-500/20 text-[11px] flex items-center gap-1">
                              <Compass className="w-3 h-3 text-blue-400" />
                              {lead.distanceKm} km od centra
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                          Google hodnocení: <strong className="text-amber-300 font-semibold">{lead.googleRating}</strong>
                        </span>
                        {lead.lastContactedAt && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 flex items-center gap-1 font-medium">
                              <Send className="w-3 h-3 text-purple-400" />
                              Reálně kontaktováno: {new Date(lead.lastContactedAt).toLocaleDateString('cs-CZ')} {new Date(lead.lastContactedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                        {lead.simulationLastContactedAt && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1 font-medium">
                              <FlaskConical className="w-3 h-3 text-amber-400" />
                              Testovací simulace: {new Date(lead.simulationLastContactedAt).toLocaleDateString('cs-CZ')} {new Date(lead.simulationLastContactedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Status Selector & Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      
                      {/* Outreach Studio 1-Click Sequence Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedLeadId(lead.id);
                          setLeadViewMode(prev => ({ ...prev, [lead.id]: 'outreach_studio' }));
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95"
                        title="Otevřít 4krokovou personalizovanou sekvenci (E-mail, WhatsApp, Hovor, Breakup)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                        <span>Outreach Studio</span>
                      </button>

                      {/* Log Contact / Activity Button */}
                      <button
                        type="button"
                        onClick={() => setActiveModalLead({ lead, mode: 'log_contact' })}
                        className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        title="Zaznamenat testovací simulaci kontaktu"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Zaznamenat kontakt</span>
                      </button>

                      {/* Schedule Next Contact Button */}
                      <button
                        type="button"
                        onClick={() => setActiveModalLead({ lead, mode: 'schedule_only' })}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        title="Naplánovat termín příštího kontaktu"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{(lead.nextContactDate || lead.scheduledAt) ? 'Přeplánovat' : 'Naplánovat kontakt'}</span>
                      </button>

                      {/* Lead Status Select (Bod 6) - Real CRM Status vs Simulation Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold" title="Skutečný stav firmy v reálném CRM">Reálný stav:</span>
                          <select
                            value={lead.realStatus || lead.status}
                            onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors focus:outline-none ${getStatusBadge(lead.realStatus || lead.status)} bg-slate-950`}
                            title="Skutečný stav firmy v reálném CRM"
                          >
                            {allStatuses.map(st => (
                              <option key={st} value={st} className="bg-slate-900 text-white">
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        {lead.simulationStatus && (
                          <div 
                            className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300 flex items-center gap-1.5"
                            title="Testovací stav ze simulace – neovlivňuje reálný stav leadu v CRM"
                          >
                            <FlaskConical className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Simulace: <strong className="text-amber-200">{lead.simulationStatus}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Contact Today Toggle (Bod 7) */}
                      <button
                        onClick={() => handleToggleContactToday(lead.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          lead.contactToday || lead.status === 'Dnes oslovit'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
                        }`}
                        title="Označit k dnešnímu oslovení"
                      >
                        <Flame className="w-3.5 h-3.5 inline mr-1" />
                        <span>{lead.contactToday || lead.status === 'Dnes oslovit' ? 'Dnes vybráno' : 'Na dnešek'}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-colors"
                        title="Smazat firmu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                  {/* Structured Score Breakdown Bar / Factors (Bod 1 & Bod 4) */}
                  {lead.scoreBreakdown && lead.scoreBreakdown.length > 0 && (
                    <div className={`p-3.5 rounded-2xl bg-slate-950/80 border text-xs space-y-2.5 transition-all ${
                      expandedScoreBreakdownId === lead.id ? 'border-blue-500/40 shadow-lg' : 'border-white/5'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            Kritéria skóre shody s kritérii ({lead.fitScore} / 100 bodů):
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 italic">
                          Míra splnění předem nastavených kritérií podle ověřených veřejných údajů
                        </span>
                      </div>

                      {/* Factor Badges / Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {lead.scoreBreakdown.map((factor, fIdx) => (
                          <div 
                            key={fIdx} 
                            className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between gap-1"
                            title={factor.note}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-slate-400 truncate font-medium">
                                {formatFactorCategory(factor.category)}
                              </span>
                              <span className="font-bold text-[11px] text-emerald-400 shrink-0">
                                +{factor.points}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-300 truncate font-normal">
                              {factor.note}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Spodní vysvětlení skóre */}
                      <p className="text-[10px] text-slate-400 border-t border-white/5 pt-1.5 leading-relaxed">
                        Skóre znamená pouze míru splnění předem nastavených kritérií podle ověřených veřejných údajů. Není pravděpodobností nákupu, kvalitou leadu ani predikcí konverze.
                      </p>
                    </div>
                  )}

                  {/* Contact Info Row (Bod 3) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 text-xs">
                    
                    {/* Web */}
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-slate-500 shrink-0">Web:</span>
                      {hasWebsite && lead.website ? (
                        <a 
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-400 hover:underline truncate flex items-center gap-1 font-medium"
                        >
                          {lead.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">Nedostupné</span>
                      )}
                    </div>

                    {/* Telefon */}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-500">Telefon:</span>
                      {hasPhone && lead.phone ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(lead.phone.replace(/\s+/g, ''));
                            setContactCopyToast(`Telefonní číslo (${lead.phone}) bylo zkopírováno. V testovacím režimu je přímé volání uzamčeno.`);
                            setTimeout(() => setContactCopyToast(null), 3500);
                          }}
                          className="text-emerald-400 hover:underline font-bold text-left flex items-center gap-1 cursor-pointer"
                          title="V testovacím režimu je přímé vytáčení uzamčeno – kliknutím zkopírujete číslo"
                        >
                          <span>{lead.phone}</span>
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                        </button>
                      ) : (
                        <span className="text-slate-500 italic">Nedostupné</span>
                      )}
                    </div>

                    {/* Google Maps Link */}
                    <div className="flex items-center gap-2 overflow-hidden">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="text-slate-500">Mapy:</span>
                      <a
                        href={lead.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.companyName || ''} ${lead.address || lead.city || ''}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-300 hover:underline truncate flex items-center gap-1 font-medium"
                      >
                        <span>Otevřít profil</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 overflow-hidden flex-wrap">
                      <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-slate-500">E-mail:</span>
                      {hasEmail && lead.email ? (
                        <div className="flex items-center gap-1.5 truncate max-w-full">
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(lead.email);
                              setContactCopyToast(`E-mail (${lead.email}) byl zkopírován do schránky. V testovacím režimu je poštovní klient uzamčen.`);
                              setTimeout(() => setContactCopyToast(null), 3500);
                            }}
                            className="text-purple-300 hover:underline truncate font-semibold flex items-center gap-1 cursor-pointer"
                            title={lead.emailSourceUrl ? `V testovacím režimu se e-mail neotvírá – kliknutím zkopírujete. (Nalezeno na oficiálním webu: ${lead.emailSourceUrl})` : `V testovacím režimu se e-mail neotvírá – kliknutím zkopírujete`}
                          >
                            <span>{lead.email}</span>
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                          </button>
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap shrink-0 font-medium"
                            title="Veřejně dostupný e-mail nalezený na oficiálním webu firmy (neznamená technické ověření doručitelnosti)"
                          >
                            Veřejně dostupný e-mail
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]" title="Na oficiálním webu firmy ani na kontaktní stránce nebyl nalezen žádný veřejný e-mail">
                          E-mail nenalezen ve veřejných zdrojích
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Context: Separated Data vs Business Hypothesis */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/20 to-indigo-950/20 border border-blue-500/20 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-blue-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        Ověřená data a kontext pro oslovení
                      </strong>
                    </div>

                    {lead.dataSummary && lead.businessHypothesis ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Ověřená data (Google Places):
                          </span>
                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            {lead.dataSummary}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/20 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                            Obchodní hypotéza pro oslovení:
                          </span>
                          <p className="text-blue-100 leading-relaxed text-[11px]">
                            {lead.businessHypothesis}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-300 leading-relaxed">
                        {lead.fitReason}
                      </p>
                    )}
                  </div>

                  {/* Lead Intelligence Section – Proč a jak firmu oslovit */}
                  <LeadIntelligenceSection
                    lead={lead}
                    userProfile={userProfile}
                    concreteOffer={recommendedDirection?.concreteOffer || userProfile?.currentProject}
                    businessDirectionTitle={recommendedDirection?.title || currentProject}
                    onUpdateLead={handleUpdateLead}
                    onOpenOutreachStudio={handleOpenOutreachStudioWithIntelligence}
                  />

                  {/* Lead Activity History Section (Chronological from newest) */}
                  <div className="pt-1">
                    <LeadActivityHistoryList
                      lead={lead}
                      onOpenLogger={(mode) => setActiveModalLead({ lead, mode: mode || 'log_contact' })}
                    />
                  </div>

                  {/* Deal Value Editor (if Won or Quoted) */}
                  {(lead.status === 'Zákazník' || lead.status === 'Nabídka') && (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-200 font-semibold">Hodnota zakázky / Tržba:</span>
                        <strong className="text-emerald-400 font-bold text-sm">
                          {lead.dealValue ? `${lead.dealValue.toLocaleString('cs-CZ')} Kč` : 'Nezadáno'}
                        </strong>
                      </div>

                      {editingDealValueId === lead.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={dealValueInput}
                            onChange={(e) => setDealValueInput(e.target.value)}
                            placeholder="Částka v Kč"
                            className="w-28 px-2 py-1 bg-slate-900 border border-emerald-500/40 rounded-lg text-white text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveDealValue(lead.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
                          >
                            Uložit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingDealValueId(lead.id);
                            setDealValueInput(lead.dealValue ? String(lead.dealValue) : '');
                          }}
                          className="text-[11px] text-emerald-300 underline font-semibold"
                        >
                          {lead.dealValue ? 'Změnit částku' : '+ Zadat hodnotu zakázky'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expand / Collapse Personalized Scripts Toggle */}
                  <div className="pt-1 flex items-center justify-between border-t border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const nextState = !isExpanded;
                          setExpandedLeadId(nextState ? lead.id : null);
                          if (nextState && !leadViewMode[lead.id]) {
                            setLeadViewMode(prev => ({ ...prev, [lead.id]: 'outreach_studio' }));
                          }
                        }}
                        className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>{isExpanded ? 'Skrýt Outreach Studio & skripty' : '🚀 Otevřít Outreach Studio (4kroková sekvence)'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {onSetDailyStepFromLead && (
                      <button
                        onClick={() => onSetDailyStepFromLead(lead)}
                        className="text-[11px] text-slate-300 hover:text-white underline"
                      >
                        Nastavit oslovení do denního plánu
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. EXPANDED OUTREACH STUDIO & PERSONALIZED SCRIPTS */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-slate-950/90 border-t border-white/10 space-y-5 animate-in fade-in duration-200">
                    
                    {/* View Switcher: Outreach Studio (Sequence) vs Quick 1st Contact Script */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                          Režim oslovování:
                        </span>
                      </div>

                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setLeadViewMode(prev => ({ ...prev, [lead.id]: 'outreach_studio' }))}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            (leadViewMode[lead.id] || 'outreach_studio') === 'outreach_studio'
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                          <span>🚀 Outreach Studio (4 kroky)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLeadViewMode(prev => ({ ...prev, [lead.id]: 'quick_script' }))}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            leadViewMode[lead.id] === 'quick_script'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>⚡ Rychlý náhled 1. kontaktu</span>
                        </button>
                      </div>
                    </div>

                    {/* RENDER OUTREACH STUDIO (FÁZE 1) */}
                    <div id={`lead-outreach-container-${lead.id}`}>
                      {(leadViewMode[lead.id] || 'outreach_studio') === 'outreach_studio' ? (
                        <OutreachStudio
                          lead={lead}
                          userProfile={userProfile}
                          concreteOffer={recommendedDirection?.concreteOffer || userProfile?.currentProject}
                          businessDirectionTitle={recommendedDirection?.title || currentProject}
                          onUpdateLead={handleUpdateLead}
                          onSaveActivity={handleSaveLeadActivity}
                          onOpenLoggerModal={(mode) => setActiveModalLead({ lead, mode: mode || 'log_contact' })}
                          appMode={appMode}
                        />
                      ) : (
                      /* RENDER QUICK SCRIPT TABS */
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                              Personalizovaný první kontakt:
                            </span>
                          </div>

                          {/* Script Type Switcher */}
                          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 flex-wrap gap-1">
                            <button
                              onClick={() => setActiveScriptType(prev => ({ ...prev, [lead.id]: 'email' }))}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                currentScript === 'email'
                                  ? 'bg-blue-500 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>E-mail</span>
                              {!hasEmail && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-400 font-normal">
                                  bez e-mailu
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() => setActiveScriptType(prev => ({ ...prev, [lead.id]: 'sms' }))}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                currentScript === 'sms'
                                  ? 'bg-blue-500 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>SMS</span>
                            </button>

                            <button
                              onClick={() => setActiveScriptType(prev => ({ ...prev, [lead.id]: 'phone' }))}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                currentScript === 'phone'
                                  ? 'bg-blue-500 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Telefonní skript</span>
                              {!hasEmail && hasPhone && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                  Doporučeno
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Script Content Display */}
                        <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 relative space-y-3">
                          
                          {/* Top Bar with Info and Copy Button */}
                          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-300">
                                {currentScript === 'email' && '✉️ Profesionální e-mail na míru:'}
                                {currentScript === 'sms' && '💬 Přirozená, nespamová SMS:'}
                                {currentScript === 'phone' && '📞 4-krokový scénář pro telefonní hovor:'}
                              </span>
                              
                              {/* Length / Word Count Badges */}
                              {currentScript === 'email' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                                  {(lead.outreach?.email || '').trim().split(/\s+/).filter(Boolean).length} slov (doporučeno do 120 slov)
                                </span>
                              )}
                              {currentScript === 'sms' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                                  {(lead.outreach?.sms || '').length} / 300 znaků
                                </span>
                              )}
                              {currentScript === 'phone' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                                  Struktura 4 kroků (cíl: 5–10 min ukázka)
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                const textToCopy = currentScript === 'email' 
                                  ? lead.outreach?.email || ''
                                  : currentScript === 'sms' 
                                    ? lead.outreach?.sms || ''
                                    : lead.outreach?.phoneScript || '';
                                handleCopyText(textToCopy, `${lead.id}-${currentScript}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-blue-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              {copiedScript === `${lead.id}-${currentScript}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Zkopírováno!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Kopírovat text</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Warning if Email is unavailable with direct switches to Phone / SMS */}
                          {currentScript === 'email' && (!lead.email || lead.email === 'Nedostupné') && (
                            <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="font-semibold block text-amber-300">
                                    E-mail nenalezen ve veřejných zdrojích
                                  </span>
                                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                                    Na oficiálním webu firmy ani na kontaktní stránce nebyl nalezen žádný veřejný e-mail. Doporučujeme firmu oslovit přes ověřené telefonní číslo 
                                    <strong className="text-white"> {hasPhone ? lead.phone : 'uvedené na webu či profilu'}</strong>.
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => setActiveScriptType(prev => ({ ...prev, [lead.id]: 'phone' }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>Skript pro hovor</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveScriptType(prev => ({ ...prev, [lead.id]: 'sms' }))}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 font-semibold text-[11px] transition-colors flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>SMS</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Script Text Box */}
                          <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-mono p-3 bg-slate-950/60 rounded-xl border border-white/5 selection:bg-blue-500 selection:text-white">
                            {currentScript === 'email' && (lead.outreach?.email || 'E-mailový skript není k dispozici')}
                            {currentScript === 'sms' && (lead.outreach?.sms || 'SMS skript není k dispozici')}
                            {currentScript === 'phone' && (lead.outreach?.phoneScript || 'Telefonní scénář není k dispozici')}
                          </div>
                        </div>

                        {/* Bottom Quick Action: Sent -> Update status */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                          <span className="text-slate-400">
                            Rychlý posun ve stavu oslovení:
                          </span>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {(lead.status === 'Nový' || lead.status === 'Dnes oslovit') && (
                              <button
                                onClick={() => handleUpdateStatus(lead.id, 'Osloveno')}
                                className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Označit jako Osloveno</span>
                              </button>
                            )}

                            {lead.status === 'Osloveno' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(lead.id, 'Odpověděl')}
                                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Odpověděl</span>
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(lead.id, 'Zájem')}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Má zájem</span>
                                </button>
                              </>
                            )}

                            {(lead.status === 'Odpověděl' || lead.status === 'Zájem') && (
                              <button
                                onClick={() => handleUpdateStatus(lead.id, 'Schůzka')}
                                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Domluvena schůzka</span>
                              </button>
                            )}

                            {lead.status === 'Schůzka' && (
                              <button
                                onClick={() => handleUpdateStatus(lead.id, 'Nabídka')}
                                className="px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>Odeslána nabídka</span>
                              </button>
                            )}

                            {lead.status === 'Nabídka' && (
                              <button
                                onClick={() => handleUpdateStatus(lead.id, 'Zákazník')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Získán zákazník 🎉</span>
                              </button>
                            )}

                            {lead.status !== 'Odmítnuto' && lead.status !== 'Nekontaktovat' && lead.status !== 'Zákazník' && (
                              <button
                                onClick={() => handleUpdateStatus(lead.id, 'Odmítnuto')}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 font-medium text-xs transition-colors"
                              >
                                Odmítnuto
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>

      {/* Activity Logger & Next Contact Modal */}
      {activeModalLead && (
        <LeadActivityLoggerModal
          isOpen={true}
          onClose={() => setActiveModalLead(null)}
          lead={activeModalLead.lead}
          mode={activeModalLead.mode}
          appMode={appMode}
          onSaveActivity={(leadId, channel, result, newStatus, note, nextContactDate, isSimulation) => {
            handleSaveLeadActivity(leadId, channel, result, newStatus, note, nextContactDate, isSimulation);
            setActiveModalLead(null);
          }}
        />
      )}

    </div>
  );
};
