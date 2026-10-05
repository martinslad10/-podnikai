import React, { useState } from 'react';
import { 
  Sparkles, 
  LayoutDashboard, 
  MessageSquare, 
  Lightbulb, 
  FileText, 
  User, 
  ChevronRight,
  Briefcase,
  Layers,
  Users,
  BarChart3,
  ClipboardList,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRightLeft,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, AppExecutionMode } from '../types';

interface NavbarProps {
  activeTab: 'dashboard' | 'chat' | 'ideas' | 'plan' | 'leads' | 'sales' | 'followup' | 'admin-business-start' | 'business-start';
  setActiveTab: (tab: 'dashboard' | 'chat' | 'ideas' | 'plan' | 'leads' | 'sales' | 'followup' | 'admin-business-start' | 'business-start') => void;
  userProfile: UserProfile | null;
  currentProject: string;
  onOpenProfile: () => void;
  onResetToLanding?: () => void;
  appMode?: AppExecutionMode;
  onToggleAppMode?: (mode?: AppExecutionMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  userProfile,
  currentProject,
  onOpenProfile,
  onResetToLanding,
  appMode = 'test',
  onToggleAppMode
}) => {
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);

  const handleSelectMode = (newMode: AppExecutionMode) => {
    if (onToggleAppMode) {
      onToggleAppMode(newMode);
    }
    setIsModeModalOpen(false);
  };
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050505]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              id="brand-logo-btn"
              onClick={() => setActiveTab('dashboard')} 
              className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-base font-heading">P</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-lg tracking-tight text-white">
                  PODNIK<span className="text-blue-500">AI</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-wider">
                  PRO
                </span>
              </div>
            </button>

            {/* Global App Mode Switcher Button */}
            <button 
              id="global-app-mode-toggle"
              type="button"
              onClick={() => setIsModeModalOpen(true)}
              className={`flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider transition-all cursor-pointer border shadow-sm ${
                appMode === 'real'
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-amber-500/10'
              }`}
              title={`Aktivní ${appMode === 'real' ? 'REÁLNÝ REŽIM (zápis do CRM)' : 'TESTOVACÍ REŽIM (bezpečné simulace)'}. Klikněte pro přepnutí.`}
            >
              {appMode === 'real' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>REÁLNÝ REŽIM</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </>
              ) : (
                <>
                  <FlaskConical className="w-3 h-3 text-amber-400" />
                  <span>TESTOVACÍ REŽIM</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </>
              )}
            </button>

            {/* Active Project Tag (if any) */}
            {currentProject && (
              <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-white/10 text-xs text-slate-400">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-500">Projekt:</span>
                <span className="font-medium text-slate-200 truncate max-w-[180px] bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                  {currentProject}
                </span>
              </div>
            )}
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-xl shadow-inner">
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className={`w-3.5 h-3.5 ${activeTab === 'dashboard' ? 'text-blue-400' : ''}`} />
              <span>Přehled</span>
            </button>

            <button
              id="nav-tab-followup"
              onClick={() => setActiveTab('followup')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'followup'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ClipboardList className={`w-3.5 h-3.5 ${activeTab === 'followup' ? 'text-blue-400' : ''}`} />
              <span>📋 Follow-up</span>
            </button>

            <button
              id="nav-tab-leads"
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'leads'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${activeTab === 'leads' ? 'text-blue-400' : ''}`} />
              <span>Najdi zákazníky</span>
            </button>

            <button
              id="nav-tab-sales"
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'sales'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'sales' ? 'text-blue-400' : ''}`} />
              <span>Obchod</span>
            </button>

            <button
              id="nav-tab-chat"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 ${activeTab === 'chat' ? 'text-blue-400' : ''}`} />
              <span>AI Chat</span>
            </button>

            <button
              id="nav-tab-ideas"
              onClick={() => setActiveTab('ideas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'ideas'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Lightbulb className={`w-3.5 h-3.5 ${activeTab === 'ideas' ? 'text-blue-400' : ''}`} />
              <span>Nápady</span>
            </button>

            <button
              id="nav-tab-plan"
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'plan'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-white font-bold shadow-md shadow-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'plan' ? 'text-blue-400' : ''}`} />
              <span>Byznys plán</span>
            </button>
          </nav>

          {/* Right Action / Profile */}
          <div className="flex items-center gap-2">
            {/* PODNIKAI Business Start Client Paid Flow */}
            <button
              id="btn-client-business-start"
              onClick={() => setActiveTab('business-start')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
                activeTab === 'business-start'
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white border-emerald-500/30'
              }`}
              title="Spustit Business Start (690 Kč) – 12 otázek, AI Blueprint & PDF"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Business Start</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40">690 Kč</span>
            </button>

            {/* PODNIKAI Business Start Internal Admin Link */}
            <button
              id="btn-admin-business-start"
              onClick={() => setActiveTab('admin-business-start')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all border ${
                activeTab === 'admin-business-start'
                  ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-md shadow-blue-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
              }`}
              title="PODNIKAI Business Start – Interní administrace klientů"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Admin</span>
            </button>

            {userProfile ? (
              <button
                id="btn-user-profile-toggle"
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all text-xs backdrop-blur-xl"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'P'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="font-semibold text-slate-200 text-xs block leading-tight">
                    {userProfile.name || 'Podnikatel'}
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {userProfile.status === 'running' ? 'Aktivní podnikatel' : 'Začínající podnikatel'}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
              </button>
            ) : (
              <button
                id="btn-start-onboarding"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                Začít
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-white/10 bg-[#050505]/80 backdrop-blur-xl px-2 py-2">
        <button
          id="mobile-nav-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Přehled</span>
        </button>

        <button
          id="mobile-nav-followup"
          onClick={() => setActiveTab('followup')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'followup' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Follow-up</span>
        </button>

        <button
          id="mobile-nav-leads"
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'leads' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Zákazníci</span>
        </button>

        <button
          id="mobile-nav-sales"
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'sales' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Obchod</span>
        </button>

        <button
          id="mobile-nav-plan"
          onClick={() => setActiveTab('plan')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'plan' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Plán</span>
        </button>
      </div>
      {/* Global App Mode Switcher Modal */}
      {isModeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-xl bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-100 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                  appMode === 'real' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading text-lg sm:text-xl font-bold text-white">
                    Globální režim aplikace PODNIKAI
                  </h2>
                  <p className="text-xs text-slate-400">
                    Aktuálně aktivní:{' '}
                    <strong className={appMode === 'real' ? 'text-emerald-400' : 'text-amber-400'}>
                      {appMode === 'real' ? 'REÁLNÝ REŽIM' : 'TESTOVACÍ REŽIM'}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                id="close-mode-modal-btn"
                type="button"
                onClick={() => setIsModeModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Testovací režim */}
              <div 
                onClick={() => handleSelectMode('test')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  appMode === 'test'
                    ? 'bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                      <FlaskConical className="w-4 h-4 text-amber-400" />
                      TESTOVACÍ REŽIM
                    </span>
                    {appMode === 'test' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider">
                        Aktivní
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Bezpečný sandbox pro zkoušení sekvencí, telefonátů a e-mailů.
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-1 pt-1 list-disc list-inside">
                    <li>Simulace nemění skutečný CRM stav</li>
                    <li>Aktivity se oddělují s příznakem simulace</li>
                    <li>Nezapočítává se do reálných statistik</li>
                    <li>Žádné reálné hovory ani e-maily</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelectMode('test'); }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    appMode === 'test'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                >
                  {appMode === 'test' ? 'Zvoleno (Aktivní)' : 'Přepnout na testovací'}
                </button>
              </div>

              {/* Option 2: Reálný režim */}
              <div 
                onClick={() => handleSelectMode('real')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  appMode === 'real'
                    ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      REÁLNÝ REŽIM
                    </span>
                    {appMode === 'real' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 uppercase tracking-wider">
                        Aktivní
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Plný obchodní provoz se skutečným zápisem do CRM databáze.
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-1 pt-1 list-disc list-inside">
                    <li>Skutečný stav CRM u oslovených firem</li>
                    <li>Skutečná historie kontaktů a záznamů</li>
                    <li>Reálné follow-up termíny a schůzky</li>
                    <li>Povoleno volání i otevírání e-mailů</li>
                    <li>Reálné statistiky nabídek i zákazníků</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelectMode('real'); }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    appMode === 'real'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                >
                  {appMode === 'real' ? 'Zvoleno (Aktivní)' : 'Přepnout na reálný'}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400">
              🛡️ <strong>Bezpečné přepnutí:</strong> Změna režimu pouze určuje, jak se zaznamenávají nové akce a jak se zobrazují přehledy. Vaše existující data, poznámky ani leady se přepnutím režimu nikdy nemažou ani nepoškodí.
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
