import React from 'react';
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
  Users
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  activeTab: 'dashboard' | 'chat' | 'ideas' | 'plan' | 'leads';
  setActiveTab: (tab: 'dashboard' | 'chat' | 'ideas' | 'plan' | 'leads') => void;
  userProfile: UserProfile | null;
  currentProject: string;
  onOpenProfile: () => void;
  onResetToLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  userProfile,
  currentProject,
  onOpenProfile,
  onResetToLanding
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050505]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button 
              id="brand-logo-btn"
              onClick={() => setActiveTab('dashboard')} 
              className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-base font-heading">P</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-bold text-lg tracking-tight text-white">
                    PODNIK<span className="text-blue-500">AI</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-wider">
                    PRO
                  </span>
                </div>
              </div>
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
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Přehled</span>
        </button>

        <button
          id="mobile-nav-chat"
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'chat' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>

        <button
          id="mobile-nav-ideas"
          onClick={() => setActiveTab('ideas')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'ideas' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Nápady</span>
        </button>

        <button
          id="mobile-nav-leads"
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'leads' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Zákazníci</span>
        </button>

        <button
          id="mobile-nav-plan"
          onClick={() => setActiveTab('plan')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'plan' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Plán</span>
        </button>
      </div>
    </header>
  );
};
