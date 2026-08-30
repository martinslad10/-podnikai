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
  Info
} from 'lucide-react';
import { 
  PotentialCustomerLead, 
  LeadStatus, 
  CustomerSearchCriteria, 
  CustomerFinderResponse, 
  UserProfile, 
  BusinessDirection 
} from '../types';
import { findPotentialCustomers } from '../services/api';

interface CustomersFinderViewProps {
  userProfile: UserProfile;
  currentProject: string;
  recommendedDirection?: BusinessDirection | null;
  onNavigateToIdeas?: () => void;
  onSetDailyStepFromLead?: (lead: PotentialCustomerLead) => void;
}

const STORAGE_KEY_LEADS = 'podnikai_customer_leads';
const STORAGE_KEY_LAST_CRITERIA = 'podnikai_customer_search_criteria';

export const CustomersFinderView: React.FC<CustomersFinderViewProps> = ({
  userProfile,
  currentProject,
  recommendedDirection,
  onNavigateToIdeas,
  onSetDailyStepFromLead
}) => {
  // Search Form State
  const [cityOrRegion, setCityOrRegion] = useState<string>(() => {
    return userProfile.location || 'Praha';
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
  const [leads, setLeads] = useState<PotentialCustomerLead[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LEADS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [dataNotice, setDataNotice] = useState<CustomerFinderResponse['dataNotice'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI state
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'today' | LeadStatus>('all');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [activeScriptType, setActiveScriptType] = useState<{ [leadId: string]: 'email' | 'sms' | 'phone' }>({});
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [editingDealValueId, setEditingDealValueId] = useState<string | null>(null);
  const [dealValueInput, setDealValueInput] = useState<string>('');

  // Persist leads in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
  }, [leads]);

  // Handle Search Trigger
  const handleFindCustomers = async (overrideCriteria?: Partial<CustomerSearchCriteria>) => {
    setIsLoading(true);
    setErrorMsg(null);

    const criteria: CustomerSearchCriteria = {
      cityOrRegion: overrideCriteria?.cityOrRegion ?? cityOrRegion,
      maxDistanceKm: overrideCriteria?.maxDistanceKm ?? maxDistanceKm,
      companyType: overrideCriteria?.companyType ?? companyType,
      numberOfLeads: overrideCriteria?.numberOfLeads ?? numberOfLeads,
      businessDirectionTitle: recommendedDirection?.title || currentProject || 'Služby a automatizace',
      concreteOffer: recommendedDirection?.concreteOffer || 'Zefektivnění procesů a získání zákazníků'
    };

    try {
      const response = await findPotentialCustomers(userProfile, criteria);
      setDataNotice(response.dataNotice);
      
      // Merge with existing leads avoiding duplicates by company name
      setLeads(prev => {
        const existingNames = new Set(prev.map(l => l.companyName.toLowerCase()));
        const newLeads = response.leads.filter(l => !existingNames.has(l.companyName.toLowerCase()));
        return [...newLeads, ...prev];
      });

      if (response.leads.length > 0) {
        setExpandedLeadId(response.leads[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Nepodařilo se vyhledat zákazníky.');
    } finally {
      setIsLoading(false);
    }
  };

  // Status Change
  const handleUpdateStatus = (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const updated = { ...l, status: newStatus };
        if (newStatus === 'Osloven' && !l.lastContactedAt) {
          updated.lastContactedAt = new Date().toISOString();
        }
        return updated;
      }
      return l;
    }));
  };

  // Toggle Contact Today
  const handleToggleContactToday = (leadId: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return { ...l, contactToday: !l.contactToday };
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
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, dealValue: val } : l));
    }
    setEditingDealValueId(null);
    setDealValueInput('');
  };

  // Funnel & Stats metrics calculation
  const totalLeads = leads.length;
  const contactedCount = leads.filter(l => ['Osloven', 'Odpověděl', 'Schůzka', 'Nabídka', 'Vyhráno'].includes(l.status)).length;
  const repliedCount = leads.filter(l => ['Odpověděl', 'Schůzka', 'Nabídka', 'Vyhráno'].includes(l.status)).length;
  const meetingCount = leads.filter(l => ['Schůzka', 'Nabídka', 'Vyhráno'].includes(l.status)).length;
  const offerCount = leads.filter(l => ['Nabídka', 'Vyhráno'].includes(l.status)).length;
  const wonCount = leads.filter(l => l.status === 'Vyhráno').length;
  const totalRevenue = leads
    .filter(l => l.status === 'Vyhráno' && l.dealValue)
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const todayContacts = leads.filter(l => l.contactToday);

  // Filtered leads list
  const displayedLeads = leads.filter(lead => {
    if (activeTabFilter === 'all') return true;
    if (activeTabFilter === 'today') return lead.contactToday;
    return lead.status === activeTabFilter;
  });

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'Nový':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Osloven':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Odpověděl':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Schůzka':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Nabídka':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'Vyhráno':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
      case 'Prohráno':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const allStatuses: LeadStatus[] = ['Nový', 'Osloven', 'Odpověděl', 'Schůzka', 'Nabídka', 'Vyhráno', 'Prohráno'];

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

          {/* 2. Osloveno */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-1">
            <span className="text-[11px] font-medium text-purple-300 block">2. Osloveno</span>
            <span className="text-xl sm:text-2xl font-black text-purple-400 font-heading">{contactedCount}</span>
          </div>

          {/* 3. Odpověděli */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-1">
            <span className="text-[11px] font-medium text-cyan-300 block">3. Odpovědi</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-heading">{repliedCount}</span>
          </div>

          {/* 4. Schůzky */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-1">
            <span className="text-[11px] font-medium text-amber-300 block">4. Schůzky</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-heading">{meetingCount}</span>
          </div>

          {/* 5. Nabídky */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-1">
            <span className="text-[11px] font-medium text-indigo-300 block">5. Nabídky</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-400 font-heading">{offerCount}</span>
          </div>

          {/* 6. Získaní klienti */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-center space-y-1">
            <span className="text-[11px] font-bold text-emerald-300 block">6. Vyhráno</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-heading">{wonCount}</span>
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
                placeholder="např. Brno, Praha, Ostrava..."
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
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
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
                    onClick={() => handleUpdateStatus(lead.id, lead.status === 'Nový' ? 'Osloven' : 'Schůzka')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold"
                  >
                    {lead.status === 'Nový' ? 'Označit: Osloveno' : 'Změnit stav'}
                  </button>
                </div>
              </div>
            ))}
          </div>
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

          <span className="text-xs text-slate-400">
            Zobrazeno: <strong className="text-slate-200">{displayedLeads.length}</strong> firem
          </span>
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
            const currentScript = activeScriptType[lead.id] || 'email';

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
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-heading text-xl font-extrabold text-white">
                          {lead.companyName}
                        </h3>

                        {/* Fit Score Badge (Bod 4) */}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          lead.fitScore >= 80 
                            ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' 
                            : lead.fitScore >= 60 
                              ? 'text-blue-300 bg-blue-500/20 border-blue-500/40' 
                              : 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                        }`}>
                          Skóre vhodnosti: {lead.fitScore} / 100
                        </span>

                        {lead.contactToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
                            Dnes oslovit
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          {lead.industry}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {lead.city} {lead.address && `(${lead.address})`}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          Google: <strong className="text-slate-300">{lead.googleRating}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right: Status Selector & Actions */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      
                      {/* Lead Status Select (Bod 6) */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Stav:</span>
                        <select
                          value={lead.status}
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors focus:outline-none ${getStatusBadge(lead.status)} bg-slate-950`}
                        >
                          {allStatuses.map(st => (
                            <option key={st} value={st} className="bg-slate-900 text-white">
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contact Today Toggle (Bod 7) */}
                      <button
                        onClick={() => handleToggleContactToday(lead.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          lead.contactToday
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
                        }`}
                        title="Označit k dnešnímu oslovení"
                      >
                        <Flame className="w-3.5 h-3.5 inline mr-1" />
                        <span>{lead.contactToday ? 'Dnes vybráno' : 'Na dnešek'}</span>
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

                  {/* Contact Info Row (Bod 3) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 text-xs">
                    
                    {/* Web */}
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-slate-500 shrink-0">Web:</span>
                      {lead.website !== 'Nedostupné' ? (
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
                      {lead.phone !== 'Nedostupné' ? (
                        <a href={`tel:${lead.phone}`} className="text-emerald-400 hover:underline font-bold">
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">Nedostupné (dohledat na webu)</span>
                      )}
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-slate-500">E-mail:</span>
                      {lead.email !== 'Nedostupné' ? (
                        <a href={`mailto:${lead.email}`} className="text-purple-300 hover:underline truncate">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">Nedostupné</span>
                      )}
                    </div>

                  </div>

                  {/* Fit Reason (Bod 3) */}
                  <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-xs space-y-1">
                    <strong className="text-blue-300 block font-semibold">Proč je firma vhodným zákazníkem:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      {lead.fitReason}
                    </p>
                  </div>

                  {/* Deal Value Editor (if Won or Quoted) */}
                  {(lead.status === 'Vyhráno' || lead.status === 'Nabídka') && (
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
                  <div className="pt-1 flex items-center justify-between border-t border-white/5">
                    <button
                      onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                      className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isExpanded ? 'Skrýt prodejní skripty' : 'Zobrazit personalizované zprávy (E-mail, SMS, Hovory)'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

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

                {/* 5. EXPANDED PERSONALIZED SCRIPTS (Bod 5) */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-slate-950/90 border-t border-white/10 space-y-4 animate-in fade-in duration-200">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Personalizovaný první kontakt:
                        </span>
                      </div>

                      {/* Script Type Switcher */}
                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
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
                        </button>
                      </div>
                    </div>

                    {/* Script Content Display */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 relative space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2">
                        <span className="font-semibold text-slate-300">
                          {currentScript === 'email' && '✉️ Krátký úderný e-mail (max. 4 odstavce):'}
                          {currentScript === 'sms' && '💬 Rychlá SMS (max. 2 věty):'}
                          {currentScript === 'phone' && '📞 Bodový scénář pro telefonní hovor:'}
                        </span>

                        <button
                          onClick={() => {
                            const textToCopy = currentScript === 'email' 
                              ? lead.outreach.email 
                              : currentScript === 'sms' 
                                ? lead.outreach.sms 
                                : lead.outreach.phoneScript;
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

                      <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-mono">
                        {currentScript === 'email' && lead.outreach.email}
                        {currentScript === 'sms' && lead.outreach.sms}
                        {currentScript === 'phone' && lead.outreach.phoneScript}
                      </div>
                    </div>

                    {/* Bottom Quick Action: Sent -> Update status */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                      <span className="text-slate-400">
                        Po odeslání zprávy nebo zavolání nezapomeň posunout stav leadu:
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {lead.status === 'Nový' && (
                          <button
                            onClick={() => handleUpdateStatus(lead.id, 'Osloven')}
                            className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Označit jako Osloveno</span>
                          </button>
                        )}
                        {lead.status === 'Osloven' && (
                          <button
                            onClick={() => handleUpdateStatus(lead.id, 'Schůzka')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Domluvena schůzka</span>
                          </button>
                        )}
                        {lead.status === 'Schůzka' && (
                          <button
                            onClick={() => handleUpdateStatus(lead.id, 'Vyhráno')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Získáno (Vyhráno)</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
