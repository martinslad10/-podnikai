import React from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onRestartOnboarding: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  userProfile,
  onRestartOnboarding
}) => {
  if (!isOpen || !userProfile) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0a0a0f]/90 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto backdrop-blur-2xl">
          
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30">
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'P'}
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-white leading-tight">
                    {userProfile.name}
                  </h2>
                  <span className="text-xs text-blue-400 font-medium">
                    {userProfile.status === 'running' ? 'Aktivní podnikatel' : 'Začínající podnikatel'}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Metrics */}
            <div className="space-y-4 text-xs">
              
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-slate-500 block font-semibold uppercase text-[10px] tracking-wider">
                  Hlavní cíl podnikání
                </span>
                <p className="text-slate-200 text-sm font-medium">
                  {userProfile.goal}
                </p>
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

              {/* Location & Current Project */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Lokalita:</span>
                  <span className="text-slate-200 font-medium">{userProfile.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Aktuální projekt:</span>
                  <span className="text-slate-200 font-medium">{userProfile.currentProject}</span>
                </div>
              </div>

            </div>

          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t border-white/10 space-y-3">
            <button
              onClick={() => {
                onClose();
                onRestartOnboarding();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors backdrop-blur-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Znovu projít onboarding</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
