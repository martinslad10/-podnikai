import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Plus, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  ChevronRight, 
  Trash2, 
  Lock, 
  Unlock, 
  ArrowLeft,
  RotateCw,
  Printer,
  Edit,
  ExternalLink,
  DollarSign,
  Globe
} from 'lucide-react';
import { 
  BusinessStartClient, 
  BusinessStartClientStatus, 
  BusinessStartStats, 
  BusinessStartQuestionnaire,
  BusinessStartAnalysis
} from '../../types';
import { 
  fetchBusinessStartClients, 
  fetchBusinessStartClient, 
  createBusinessStartClient, 
  updateBusinessStartClient, 
  deleteBusinessStartClient, 
  triggerBusinessStartAnalysis,
  verifyAdminPasscode,
  getAdminSessionToken,
  clearAdminSessionToken
} from '../../services/api';
import { BusinessStartQuestionnaireTab } from './BusinessStartQuestionnaireTab';
import { BusinessStartAnalysisTab } from './BusinessStartAnalysisTab';
import { BusinessStartReportTab } from './BusinessStartReportTab';
import { BusinessStartNewClientModal } from './BusinessStartNewClientModal';

export const BusinessStartAdminView: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAdminSessionToken());
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Clients & Pipeline State
  const [clients, setClients] = useState<BusinessStartClient[]>([]);
  const [stats, setStats] = useState<BusinessStartStats>({ total: 0, new: 0, analysis: 0, control: 0, done: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Client State
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<'questionnaire' | 'analysis' | 'report'>('report');

  // Modals & Async Operations
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Load clients on mount or auth change
  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBusinessStartClients();
      if (!getAdminSessionToken()) {
        setIsAuthenticated(false);
        return;
      }
      setClients(data.clients || []);
      setStats(data.stats || { total: 0, new: 0, analysis: 0, control: 0, done: 0 });
    } catch (err) {
      console.error('Failed loading clients:', err);
      if (!getAdminSessionToken()) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadClients();
    }
  }, [isAuthenticated]);

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setIsVerifying(true);
    try {
      const res = await verifyAdminPasscode(passcodeInput.trim());
      if (res.success && res.token) {
        setIsAuthenticated(true);
        setPasscodeInput('');
      } else {
        setPasscodeError(res.error || 'Nesprávný administrátorský kód.');
      }
    } catch {
      setPasscodeError('Chyba při ověřování. Zkuste znovu.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    clearAdminSessionToken();
    setIsAuthenticated(false);
    setSelectedClientId(null);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  // Actions for Client
  const handleUpdateStatus = async (client: BusinessStartClient, newStatus: BusinessStartClientStatus) => {
    const updated = await updateBusinessStartClient(client.id, { status: newStatus });
    if (updated) {
      setClients(prev => prev.map(c => c.id === client.id ? updated : c));
      // update stats locally
      loadClients();
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm('Opravdu si přejete smazat tohoto klienta a všechny jeho data?')) return;
    const ok = await deleteBusinessStartClient(clientId);
    if (ok) {
      setClients(prev => prev.filter(c => c.id !== clientId));
      if (selectedClientId === clientId) setSelectedClientId(null);
      loadClients();
    }
  };

  const handleTriggerAnalysis = async (clientId: string) => {
    setIsAnalyzing(true);
    try {
      const res = await triggerBusinessStartAnalysis(clientId);
      if (res.success && res.client) {
        setClients(prev => prev.map(c => c.id === clientId ? res.client! : c));
        loadClients();
      } else {
        alert(res.error || 'Nepodařilo se provést analýzu.');
      }
    } catch (err: any) {
      alert('Chyba při spuštění analýzy: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveQuestionnaire = async (updatedQ: BusinessStartQuestionnaire) => {
    if (!selectedClientId) return;
    setIsSaving(true);
    try {
      const updated = await updateBusinessStartClient(selectedClientId, { questionnaire: updatedQ });
      if (updated) {
        setClients(prev => prev.map(c => c.id === selectedClientId ? updated : c));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAnalysis = async (updatedAnalysis: BusinessStartAnalysis, adminNotes?: string) => {
    if (!selectedClientId) return;
    setIsSaving(true);
    try {
      const updated = await updateBusinessStartClient(selectedClientId, { 
        analysis: updatedAnalysis,
        adminNotes: adminNotes
      });
      if (updated) {
        setClients(prev => prev.map(c => c.id === selectedClientId ? updated : c));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateClient = async (q: BusinessStartQuestionnaire, consultantName?: string, autoAnalyze?: boolean) => {
    setIsCreatingClient(true);
    try {
      const newClient = await createBusinessStartClient(q, consultantName);
      if (newClient) {
        setClients(prev => [newClient, ...prev]);
        setSelectedClientId(newClient.id);
        setActiveClientTab(autoAnalyze ? 'analysis' : 'questionnaire');
        loadClients();

        if (autoAnalyze) {
          handleTriggerAnalysis(newClient.id);
        }
      }
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      c.questionnaire.clientName.toLowerCase().includes(q) ||
      c.questionnaire.clientEmail.toLowerCase().includes(q) ||
      c.questionnaire.clientPhone.toLowerCase().includes(q) ||
      c.questionnaire.location.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // 1. If not authenticated, render Admin Passcode Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-[#0b0b0b] border border-white/10 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white font-heading">PODNIKAI Business Start</h2>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold tracking-wider uppercase">
              Interní sekce pro konzultanty
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Tento modul slouží k internímu zpracování platících klientů, generování hloubkových byznys plánů a PDF reportů.
            </p>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4 text-left">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                Heslo / PIN administrátora
              </label>
              <input
                type="password"
                value={passcodeInput}
                onChange={e => setPasscodeInput(e.target.value)}
                placeholder="Zadejte kód (např. podnikai)"
                autoFocus
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {passcodeError && (
                <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {passcodeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isVerifying ? 'Ověřuji...' : 'Odemknout administraci'}
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Výchozí administrátorský klíč: <code className="text-slate-400">podnikai</code> nebo <code className="text-slate-400">1234</code>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // 2. Client Detail View (Workspace)
  if (selectedClient) {
    const q = selectedClient.questionnaire;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedClientId(null)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět na klienty</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white leading-tight">{q.clientName}</h2>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                  selectedClient.status === 'done'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : selectedClient.status === 'control'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : selectedClient.status === 'analysis'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                }`}>
                  {selectedClient.status === 'done' ? 'Dokončeno' : selectedClient.status === 'control' ? 'Kontrola adminem' : selectedClient.status === 'analysis' ? 'V analýze' : 'Nový'}
                </span>

                {selectedClient.order && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                    selectedClient.order.paymentStatus === 'PAID'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {selectedClient.order.paymentStatus === 'PAID' ? `✓ PAID ${selectedClient.order.priceCz || 690} Kč` : '⏳ NEZAPLACENO'}
                  </span>
                )}
                {selectedClient.order?.status && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Objednávka: {selectedClient.order.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {q.location} • {q.clientEmail || 'Bez e-mailu'} • {q.clientPhone || 'Bez telefonu'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedClient.status}
              onChange={e => handleUpdateStatus(selectedClient, e.target.value as BusinessStartClientStatus)}
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="new">Stav: Nový</option>
              <option value="analysis">Stav: V analýze</option>
              <option value="control">Stav: Kontrola adminem</option>
              <option value="done">Stav: Dokončeno & Předáno</option>
            </select>

            <button
              type="button"
              onClick={() => handleTriggerAnalysis(selectedClient.id)}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Počítám...' : 'Spustit AI analýzu'}
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveClientTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeClientTab === 'report'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Finální Byznys Report</span>
            {selectedClient.analysis && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveClientTab('analysis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeClientTab === 'analysis'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Analýza & Blueprint</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveClientTab('questionnaire')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeClientTab === 'questionnaire'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Vstupní dotazník (12 otázek)</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeClientTab === 'questionnaire' && (
          <BusinessStartQuestionnaireTab
            client={selectedClient}
            onSaveQuestionnaire={handleSaveQuestionnaire}
            isSaving={isSaving}
          />
        )}

        {activeClientTab === 'analysis' && (
          <BusinessStartAnalysisTab
            client={selectedClient}
            onTriggerAnalysis={() => handleTriggerAnalysis(selectedClient.id)}
            onSaveAnalysis={handleSaveAnalysis}
            isAnalyzing={isAnalyzing}
            isSaving={isSaving}
          />
        )}

        {activeClientTab === 'report' && (
          <BusinessStartReportTab
            client={selectedClient}
          />
        )}
      </div>
    );
  }

  // 3. Main Overview: Client Pipeline & Statistics
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/30 via-black to-indigo-950/20 border border-white/10 rounded-3xl p-6 sm:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-lg font-heading shadow-lg shadow-blue-600/30">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white font-heading">
                  PODNIK<span className="text-blue-500">AI</span> Business Start
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                  Admin panel
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interní správa platících klientů • 12otázkový intake • AI Deep Blueprint • PDF export
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadClients}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/10"
            title="Aktualizovat data"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsNewClientModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nový klient (Intake)</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors border border-white/10"
            title="Zamknout / Odhlásit se"
          >
            <Unlock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pipeline Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-white/10 border-blue-500/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Celkem klientů</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'new'
              ? 'bg-slate-500/20 border-slate-400 shadow-sm'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Nové (Intake)</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-200">{stats.new}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('analysis')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'analysis'
              ? 'bg-blue-500/20 border-blue-400 shadow-sm'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-blue-400 text-xs mb-1">
            <span>V analýze</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats.analysis}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('control')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'control'
              ? 'bg-amber-500/20 border-amber-400 shadow-sm'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 text-xs mb-1">
            <span>Kontrola adminem</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.control}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('done')}
          className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            statusFilter === 'done'
              ? 'bg-emerald-500/20 border-emerald-400 shadow-sm'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
            <span>Dokončeno</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.done}</div>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Hledat klienta, e-mail, město..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Zobrazeno <strong>{filteredClients.length}</strong> z <strong>{clients.length}</strong> klientů
        </div>
      </div>

      {/* Clients Cards / Table */}
      {filteredClients.length === 0 ? (
        <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-3xl p-12 text-center space-y-4">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Nenalezeni žádní klienti</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery ? 'Zadanému vyhledávání neodpovídá žádný záznam.' : 'Zatím v systému nemáte žádné klienty pro tento filtr.'}
          </p>
          <button
            type="button"
            onClick={() => setIsNewClientModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Vytvořit nového klienta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredClients.map(c => {
            const q = c.questionnaire;
            const hasAnalysis = Boolean(c.analysis);

            return (
              <div
                key={c.id}
                className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-white text-sm">{q.clientName}</span>
                    
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : c.status === 'control'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : c.status === 'analysis'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                    }`}>
                      {c.status === 'done' ? 'Dokončeno' : c.status === 'control' ? 'Kontrola adminem' : c.status === 'analysis' ? 'V analýze' : 'Nový'}
                    </span>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      q.operatingModel === 'online'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {q.operatingModel.toUpperCase()}
                    </span>

                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                      {q.startingCapital}
                    </span>

                    {c.order && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        c.order.paymentStatus === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {c.order.paymentStatus === 'PAID' ? `✓ PAID ${c.order.priceCz || 690} Kč` : '⏳ NEZAPLACENO'}
                      </span>
                    )}

                    {c.order?.status && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                        {c.order.status}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1">
                    <strong className="text-slate-300">Cíl:</strong> {q.mainGoal} • <strong className="text-slate-300">Příjem:</strong> {q.targetMonthlyIncome}
                  </p>

                  <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-0.5">
                    <span>Lokalita: {q.location}</span>
                    <span>•</span>
                    <span>Čas: {q.weeklyTimeCommitment}</span>
                    <span>•</span>
                    <span>Konzultant: {c.consultantName || 'PODNIKAI'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {!hasAnalysis ? (
                    <button
                      type="button"
                      onClick={() => handleTriggerAnalysis(c.id)}
                      disabled={isAnalyzing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Spustit AI</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-semibold px-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Report připraven
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId(c.id);
                      setActiveClientTab('report');
                    }}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <span>Otevřít detail</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClient(c.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors"
                    title="Smazat klienta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Client Modal */}
      <BusinessStartNewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        onCreateClient={handleCreateClient}
        isCreating={isCreatingClient}
      />
    </div>
  );
};
