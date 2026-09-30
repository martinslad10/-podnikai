import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Target, 
  DollarSign, 
  Clock, 
  Briefcase, 
  MapPin, 
  RotateCcw, 
  ShieldCheck, 
  Sparkles,
  Info,
  CheckCircle2,
  Save,
  Edit3,
  FlaskConical
} from 'lucide-react';
import { OnlineOfflinePreference, UserProfile, AppExecutionMode } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onRestartOnboarding: () => void;
  onUpdateProfile?: (updatedProfile: UserProfile) => void;
  appMode?: AppExecutionMode;
  onToggleAppMode?: (mode?: AppExecutionMode) => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  userProfile,
  onRestartOnboarding,
  onUpdateProfile,
  appMode = 'test',
  onToggleAppMode
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Editable Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [goal, setGoal] = useState('');
  const [currentProject, setCurrentProject] = useState('');
  const [targetIncome, setTargetIncome] = useState('');
  const [startingBudget, setStartingBudget] = useState('');
  const [availableTime, setAvailableTime] = useState('');
  const [onlineOffline, setOnlineOffline] = useState<OnlineOfflinePreference>('hybrid');

  // Sync state with userProfile whenever it changes or drawer opens
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setLocation(userProfile.location || 'Česká republika, České Budějovice');
      setGoal(userProfile.goal || '');
      setCurrentProject(userProfile.currentProject || '');
      setTargetIncome(userProfile.targetIncome || '');
      setStartingBudget(userProfile.startingBudget || '');
      setAvailableTime(userProfile.availableTime || '');
      setOnlineOffline(userProfile.onlineOffline || 'hybrid');
    }
  }, [userProfile, isOpen]);

  if (!isOpen || !userProfile) return null;

  const handleSave = () => {
    if (!onUpdateProfile) return;

    const updatedProfile: UserProfile = {
      ...userProfile,
      name: name.trim() || userProfile.name || 'Podnikatel',
      location: location.trim() || userProfile.location || 'Česká republika, České Budějovice',
      goal: goal.trim() || userProfile.goal,
      currentProject: currentProject.trim() || userProfile.currentProject,
      targetIncome: targetIncome.trim() || userProfile.targetIncome,
      startingBudget: startingBudget.trim() || userProfile.startingBudget,
      availableTime: availableTime.trim() || userProfile.availableTime,
      onlineOffline: onlineOffline || userProfile.onlineOffline
    };

    onUpdateProfile(updatedProfile);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsEditing(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-[#0a0a0f]/95 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto backdrop-blur-2xl">
          
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30">
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'P'}
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-white leading-tight">
                    {userProfile.name || 'Profil podnikatele'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-blue-400 font-medium">
                    <span>{userProfile.status === 'running' ? 'Aktivní podnikatel' : 'Začínající podnikatel'}</span>
                    <span>•</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      {userProfile.location}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-toggle-edit-profile"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    isEditing 
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Zrušit úpravy' : 'Upravit'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Form (Edit Mode vs View Mode) */}
            {isEditing ? (
              <div className="space-y-4 text-xs">
                
                {/* Location Input (Priority field) */}
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1.5">
                  <label className="text-blue-300 block font-semibold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    Země a město působení (Lokalita)
                  </label>
                  <input
                    id="input-edit-profile-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="např. Česká republika, České Budějovice"
                    className="w-full px-3 py-2 bg-slate-900/90 border border-blue-500/40 rounded-xl text-white text-xs focus:outline-none focus:border-blue-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Tato lokalita se okamžitě projeví v Dashboardu, hledání zákazníků i byznys plánu.
                  </p>
                </div>

                {/* Name */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Jméno / Přezdívka
                  </label>
                  <input
                    id="input-edit-profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Current Project */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Aktuální projekt / Obor
                  </label>
                  <input
                    id="input-edit-profile-project"
                    type="text"
                    value={currentProject}
                    onChange={(e) => setCurrentProject(e.target.value)}
                    placeholder="např. Masérské služby, Mobilní pneuservis..."
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Goal */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Hlavní cíl podnikání
                  </label>
                  <textarea
                    id="input-edit-profile-goal"
                    rows={2}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">Cílový příjem</label>
                    <input
                      type="text"
                      value={targetIncome}
                      onChange={(e) => setTargetIncome(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900/80 border border-white/10 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">Rozpočet na start</label>
                    <input
                      type="text"
                      value={startingBudget}
                      onChange={(e) => setStartingBudget(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900/80 border border-white/10 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    id="btn-save-profile-changes"
                    onClick={handleSave}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                      savedSuccess 
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/25'
                    }`}
                  >
                    {savedSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Změny byly úspěšně uloženy!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Uložit nové parametry</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            ) : (
              /* View Mode */
              <div className="space-y-4 text-xs">
                
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-slate-500 block font-semibold uppercase text-[10px] tracking-wider">
                    Hlavní cíl podnikání
                  </span>
                  <p className="text-slate-200 text-sm font-medium">
                    {userProfile.goal}
                  </p>
                </div>

                {/* Location & Current Project Highlight */}
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      Lokalita působení:
                    </span>
                    <span className="text-blue-300 font-bold">{userProfile.location}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      Projekt / Obor:
                    </span>
                    <span className="text-slate-200 font-medium">{userProfile.currentProject || 'Nespecifikováno'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Cílový příjem</span>
                    <span className="text-slate-200 font-bold">{userProfile.targetIncome}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Rozpočet na start</span>
                    <span className="text-slate-200 font-bold">{userProfile.startingBudget}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Časová kapacita</span>
                    <span className="text-slate-200 font-bold">{userProfile.availableTime}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Model</span>
                    <span className="text-slate-200 font-bold capitalize">{userProfile.onlineOffline}</span>
                  </div>
                </div>

                {/* Skills */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-slate-500 block font-semibold uppercase text-[10px] tracking-wider">
                    Dovednosti & zkušenosti
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {userProfile.skills.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-slate-300 text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dislikes */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-rose-400 block font-semibold uppercase text-[10px] tracking-wider">
                    Co nechceš dělat (Anti-goals)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {userProfile.dislikes.map((d, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px]">
                        ✕ {d}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Režim aplikace (Globální TEST / REÁLNÝ režim) */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">
                  Režim aplikace PODNIKAI
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  appMode === 'real'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {appMode === 'real' ? 'REÁLNÝ REŽIM' : 'TESTOVACÍ REŽIM'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {appMode === 'real'
                  ? 'Aktivní reálný režim: Oslovení, hovory, schůzky i follow-upy se zapisují přímo do skutečného CRM.'
                  : 'Aktivní testovací režim: Aktivity se bezpečně simulují bez vlivu na reálný CRM stav firem a bez nechtěných hovorů/e-mailů.'}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onToggleAppMode && onToggleAppMode('test')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    appMode === 'test'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Testovací režim</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleAppMode && onToggleAppMode('real')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    appMode === 'real'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Reálný režim</span>
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t border-white/10 space-y-3">
            <button
              id="btn-restart-onboarding"
              onClick={() => {
                onClose();
                onRestartOnboarding();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors backdrop-blur-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Znovu projít celý onboarding (průvodce)</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
