/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { OnboardingFlow } from './components/OnboardingFlow';
import { DashboardView } from './components/DashboardView';
import { ChatView } from './components/ChatView';
import { IdeasView } from './components/IdeasView';
import { BusinessPlanView } from './components/BusinessPlanView';
import { CustomersFinderView } from './components/CustomersFinderView';
import { SalesDashboardView } from './components/SalesDashboardView';
import { FollowUpView } from './components/FollowUpView';
import { ProfileDrawer } from './components/ProfileDrawer';
import { BusinessStartAdminView } from './components/admin/BusinessStartAdminView';
import { BusinessStartClientFlowView } from './components/BusinessStartClientFlowView';
import { BusinessDirection, BusinessIdea, BusinessPlan, DailyStep, PotentialCustomerLead, UserProfile, LeadStatus, ContactChannel, SalesCostsTracking, AppExecutionMode } from './types';
import { generateNextDailyStep, fetchSavedLeads, saveLeadsToServer } from './services/api';
import { createActivityEntry, normalizeLeadStatusSeparation } from './utils/leadActivities';
import { mergeLeadsWithExisting } from './utils/leadMerge';

const STORAGE_KEY_PROFILE = 'podnikai_user_profile';
const STORAGE_KEY_PROJECT = 'podnikai_current_project';
const STORAGE_KEY_DAILY_STEP = 'podnikai_daily_step';
const STORAGE_KEY_COMPLETED_STEPS = 'podnikai_completed_steps';
const STORAGE_KEY_BUSINESS_PLAN = 'podnikai_business_plan';
const STORAGE_KEY_RECOMMENDED_DIR = 'podnikai_recommended_direction';
const STORAGE_KEY_LEADS = 'podnikai_customer_leads';
const STORAGE_KEY_APP_MODE = 'podnikai_app_execution_mode';

export default function App() {
  // Global Application Execution Mode: 'test' (safe simulations) | 'real' (live CRM & real outreach)
  const [appMode, setAppMode] = useState<AppExecutionMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_APP_MODE);
    return saved === 'real' ? 'real' : 'test';
  });

  const handleToggleAppMode = (mode?: AppExecutionMode) => {
    setAppMode(prev => {
      const next = mode || (prev === 'test' ? 'real' : 'test');
      localStorage.setItem(STORAGE_KEY_APP_MODE, next);
      return next;
    });
  };

  // App Phase State: 'landing' | 'onboarding' | 'app'
  const [appPhase, setAppPhase] = useState<'landing' | 'onboarding' | 'app'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      if (h === '#admin' || h === '#admin-business-start' || h.startsWith('#business-start')) {
        return 'app';
      }
    }
    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    return savedProfile ? 'app' : 'landing';
  });

  // Active Tab in main app
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'ideas' | 'plan' | 'leads' | 'sales' | 'followup' | 'admin-business-start' | 'business-start'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      if (h === '#admin' || h === '#admin-business-start') {
        return 'admin-business-start';
      }
      if (h.startsWith('#business-start')) {
        return 'business-start';
      }
    }
    return 'dashboard';
  });

  // Listen to hash changes for direct deep-linking
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h === '#admin' || h === '#admin-business-start') {
        setAppPhase('app');
        setActiveTab('admin-business-start');
      } else if (h.startsWith('#business-start')) {
        setAppPhase('app');
        setActiveTab('business-start');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Target Lead for quick navigation from Sales Dashboard to Customers Finder
  const [targetLeadId, setTargetLeadId] = useState<string | null>(null);

  // Selected Business Direction for Customer Finding
  const [selectedDirection, setSelectedDirection] = useState<BusinessDirection | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECOMMENDED_DIR);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Current Active Project
  const [currentProject, setCurrentProject] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_PROJECT) || '';
  });

  // Daily Step State
  const [dailyStep, setDailyStep] = useState<DailyStep | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DAILY_STEP);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Completed Steps History
  const [completedSteps, setCompletedSteps] = useState<DailyStep[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_COMPLETED_STEPS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Business Plan State
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BUSINESS_PLAN);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Leads State with Durable Server Persistence & LocalStorage Fallback
  const [leads, setLeads] = useState<PotentialCustomerLead[]>(() => {
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

  const [isGeneratingStep, setIsGeneratingStep] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Sync leads from server on initial mount
  useEffect(() => {
    fetchSavedLeads().then((serverLeads) => {
      if (Array.isArray(serverLeads) && serverLeads.length > 0) {
        setLeads((prev) => {
          if (prev.length === 0) {
            const normalized = serverLeads.map(normalizeLeadStatusSeparation);
            localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(normalized));
            return normalized;
          }
          const merged = mergeLeadsWithExisting(prev, serverLeads);
          localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});
  }, []);

  // Sync state with localStorage and Server
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECT, currentProject);
  }, [currentProject]);

  useEffect(() => {
    if (dailyStep) {
      localStorage.setItem(STORAGE_KEY_DAILY_STEP, JSON.stringify(dailyStep));
    }
  }, [dailyStep]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMPLETED_STEPS, JSON.stringify(completedSteps));
  }, [completedSteps]);

  useEffect(() => {
    if (businessPlan) {
      localStorage.setItem(STORAGE_KEY_BUSINESS_PLAN, JSON.stringify(businessPlan));
    }
  }, [businessPlan]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    saveLeadsToServer(leads).catch(() => {});
  }, [leads]);

  // Lead Activity and Status Update Handlers
  const handleUpdateLeadStatus = (leadId: string, newStatus: LeadStatus, note?: string) => {
    const isSim = appMode !== 'real';
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const channel: ContactChannel = l.lastContactChannel || (l.phone && l.phone !== 'Nedostupné' ? 'phone' : 'other');
        const currentReal = l.realStatus || l.status;
        const result = isSim 
          ? `Změna simulovaného stavu (Test): ${l.simulationStatus || currentReal} → ${newStatus}` 
          : `Změna reálného stavu CRM: ${currentReal} → ${newStatus}`;
        const { updatedLead } = createActivityEntry(l, channel, result, newStatus, note, undefined, isSim);
        return updatedLead;
      }
      return l;
    }));
  };

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
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const { updatedLead } = createActivityEntry(l, channel, result, newStatus, note, nextContactDate, actualIsSim);
        return updatedLead;
      }
      return l;
    }));

    // Persist activity to server
    fetch(`/api/leads/${leadId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        result,
        status: newStatus,
        note,
        nextContactDate,
        isSimulation: actualIsSim
      })
    }).catch(err => console.error('Error syncing lead activity to server:', err));
  };

  const handleUpdateLeadFinancials = (
    leadId: string,
    financials: {
      dealValue?: number;
      costsTracking?: SalesCostsTracking;
    }
  ) => {
    setLeads(prev => {
      const updated = prev.map(l => {
        if (l.id === leadId) {
          return {
            ...l,
            dealValue: financials.dealValue !== undefined ? financials.dealValue : l.dealValue,
            costsTracking: financials.costsTracking !== undefined ? financials.costsTracking : l.costsTracking
          };
        }
        return l;
      });
      // Sync to server
      fetch(`/api/leads/${leadId}/financials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financials)
      }).catch(err => console.error('Error updating lead financials:', err));
      return updated;
    });
  };

  const handleUpdateLeadDealValue = (leadId: string, dealValue: number | undefined) => {
    handleUpdateLeadFinancials(leadId, { dealValue });
  };

  // Initial Daily Step Generation if none exists
  useEffect(() => {
    if (userProfile && !dailyStep && !isGeneratingStep) {
      handleGenerateNextStep();
    }
  }, [userProfile]);

  const handleOnboardingComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setCurrentProject(profile.currentProject || '');
    setAppPhase('app');
    setActiveTab('dashboard');

    // Generate initial step for this profile
    handleGenerateNextStep(profile, profile.currentProject);
  };

  const handleGenerateNextStep = async (
    profileToUse: UserProfile | null = userProfile,
    projectToUse: string = currentProject
  ) => {
    if (!profileToUse) return;
    setIsGeneratingStep(true);
    try {
      const step = await generateNextDailyStep(
        profileToUse,
        projectToUse || profileToUse.currentProject || 'Nový projekt',
        completedSteps,
        businessPlan
      );
      setDailyStep(step);
    } catch (err) {
      console.error('Failed to generate daily step:', err);
    } finally {
      setIsGeneratingStep(false);
    }
  };

  const handleCompleteDailyStep = (stepId: string) => {
    if (!dailyStep) return;
    const completed: DailyStep = {
      ...dailyStep,
      completed: true,
      completedAt: new Date().toISOString()
    };
    setCompletedSteps(prev => [completed, ...prev]);
    // Automatically generate next actionable step
    handleGenerateNextStep();
  };

  const handleSelectIdeaForPlan = (idea: BusinessIdea) => {
    setCurrentProject(idea.title);
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        currentProject: idea.title
      });
    }
    setActiveTab('plan');
  };

  const handleAskAiAboutIdea = (idea: BusinessIdea) => {
    setCurrentProject(idea.title);
    setActiveTab('chat');
  };

  const handleSetFirstActionAsDailyStep = (actionText: string) => {
    const newStep: DailyStep = {
      id: `step-${Date.now()}`,
      title: 'Validace nápadu podle Byznys plánu',
      description: actionText,
      whyImportant: 'První krok z tvého byznys plánu má nejvyšší prioritu pro ověření trhu.',
      estimatedMinutes: 45,
      completed: false,
      category: 'validace'
    };
    setDailyStep(newStep);
    setActiveTab('dashboard');
  };

  const handleSetTodayTaskAsDailyStep = (task: { title: string; description: string; estimatedMinutes: number; whyToday?: string }) => {
    const newStep: DailyStep = {
      id: `step-${Date.now()}`,
      title: task.title,
      description: task.description,
      whyImportant: task.whyToday || 'Prioritní krok k získání prvního platícího klienta.',
      estimatedMinutes: task.estimatedMinutes || 30,
      completed: false,
      category: 'prodej'
    };
    setDailyStep(newStep);
    setActiveTab('dashboard');
  };

  const handleNavigateToFindCustomers = (direction?: BusinessDirection) => {
    if (direction) {
      setSelectedDirection(direction);
      localStorage.setItem(STORAGE_KEY_RECOMMENDED_DIR, JSON.stringify(direction));
      if (direction.title) {
        setCurrentProject(direction.title);
        if (userProfile) {
          setUserProfile({
            ...userProfile,
            currentProject: direction.title
          });
        }
      }
    }
    setActiveTab('leads');
  };

  const handleSetDailyStepFromLead = (lead: PotentialCustomerLead) => {
    const channel = lead.phone !== 'Nedostupné' ? 'telefonní hovor' : (lead.email !== 'Nedostupné' ? 'e-mail' : 'SMS');
    const newStep: DailyStep = {
      id: `step-${Date.now()}`,
      title: `Oslovit firmu: ${lead.companyName}`,
      description: `Kontaktuj ${lead.companyName} (${lead.city}) přes ${channel}. Použij připravený skript z modulu Najdi zákazníky.`,
      whyImportant: `Firma má skóre shody s kritérii ${lead.fitScore}/100. ${lead.fitReason}`,
      estimatedMinutes: 15,
      completed: false,
      category: 'prodej'
    };
    setDailyStep(newStep);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Frosted Glass Ambient Lighting Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none z-0" />
      
      {/* Navbar (displayed in app phase or when admin/business-start is active) */}
      {(appPhase === 'app' || activeTab === 'admin-business-start' || activeTab === 'business-start') && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
          currentProject={currentProject}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
          onResetToLanding={() => {
            window.location.hash = '';
            setAppPhase('landing');
          }}
          appMode={appMode}
          onToggleAppMode={handleToggleAppMode}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {/* PODNIKAI Business Start (Internal Admin Tool) */}
        {activeTab === 'admin-business-start' && (
          <BusinessStartAdminView />
        )}

        {/* PODNIKAI Business Start (Automated Public Client Flow) */}
        {activeTab === 'business-start' && (
          <BusinessStartClientFlowView
            onBackToHome={() => {
              window.location.hash = '';
              if (userProfile) {
                setActiveTab('dashboard');
              } else {
                setAppPhase('landing');
              }
            }}
          />
        )}

        {/* PHASE 1: Landing Hero */}
        {appPhase === 'landing' && activeTab !== 'admin-business-start' && activeTab !== 'business-start' && (
          <LandingHero
            onStart={() => setAppPhase('onboarding')}
            onOpenAdmin={() => {
              window.location.hash = '#admin';
              setAppPhase('app');
              setActiveTab('admin-business-start');
            }}
            onStartBusinessStart={() => {
              window.location.hash = '#business-start';
              setAppPhase('app');
              setActiveTab('business-start');
            }}
          />
        )}

        {/* PHASE 2: Onboarding Flow */}
        {appPhase === 'onboarding' && activeTab !== 'admin-business-start' && activeTab !== 'business-start' && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            initialProfile={userProfile}
          />
        )}

        {/* PHASE 3: Main App Tabs */}
        {appPhase === 'app' && userProfile && activeTab !== 'admin-business-start' && activeTab !== 'business-start' && (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                userProfile={userProfile}
                currentProject={currentProject}
                dailyStep={dailyStep}
                completedSteps={completedSteps}
                onCompleteDailyStep={handleCompleteDailyStep}
                onRefreshDailyStep={() => handleGenerateNextStep()}
                isGeneratingStep={isGeneratingStep}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onEditProfile={() => setIsProfileDrawerOpen(true)}
                leads={leads}
                onUpdateLead={(updated) => {
                  setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                }}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onSaveLeadActivity={handleSaveLeadActivity}
                appMode={appMode}
              />
            )}

            {activeTab === 'chat' && (
              <ChatView
                userProfile={userProfile}
                currentProject={currentProject}
                onNavigateToIdeas={() => setActiveTab('ideas')}
                onNavigateToPlan={() => setActiveTab('plan')}
              />
            )}

            {activeTab === 'ideas' && (
              <IdeasView
                userProfile={userProfile}
                onSelectIdeaForPlan={handleSelectIdeaForPlan}
                onAskAiAboutIdea={handleAskAiAboutIdea}
                onSetTodayTaskAsDailyStep={handleSetTodayTaskAsDailyStep}
                onNavigateToFindCustomers={handleNavigateToFindCustomers}
                currentProject={currentProject}
              />
            )}

            {activeTab === 'followup' && (
              <FollowUpView
                leads={leads}
                onSelectLead={(leadId) => {
                  setTargetLeadId(leadId);
                  setActiveTab('leads');
                }}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onSaveLeadActivity={handleSaveLeadActivity}
                onUpdateLeadDealValue={handleUpdateLeadDealValue}
                onNavigateToFinder={() => setActiveTab('leads')}
                appMode={appMode}
              />
            )}

            {activeTab === 'leads' && (
              <CustomersFinderView
                userProfile={userProfile}
                currentProject={currentProject}
                recommendedDirection={selectedDirection}
                onNavigateToIdeas={() => setActiveTab('ideas')}
                onSetDailyStepFromLead={handleSetDailyStepFromLead}
                leads={leads}
                onUpdateLeads={(newLeads) => setLeads(newLeads)}
                initialExpandedLeadId={targetLeadId}
                onNavigateToSales={() => setActiveTab('sales')}
                appMode={appMode}
              />
            )}

            {activeTab === 'sales' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <SalesDashboardView
                  leads={leads}
                  onSelectLead={(leadId) => {
                    setTargetLeadId(leadId);
                    setActiveTab('leads');
                  }}
                  onUpdateLeadDealValue={handleUpdateLeadDealValue}
                  onUpdateLeadFinancials={handleUpdateLeadFinancials}
                  onNavigateToFinder={() => setActiveTab('leads')}
                />
              </div>
            )}

            {activeTab === 'plan' && (
              <BusinessPlanView
                userProfile={userProfile}
                currentProject={currentProject}
                businessPlan={businessPlan}
                setBusinessPlan={setBusinessPlan}
                onSetFirstActionAsDailyStep={handleSetFirstActionAsDailyStep}
                onNavigateToChatWithContext={(topic) => {
                  setActiveTab('chat');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Profile & Settings Drawer */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        userProfile={userProfile}
        onRestartOnboarding={() => {
          setAppPhase('onboarding');
        }}
        onUpdateProfile={(updatedProfile) => {
          setUserProfile(updatedProfile);
          if (updatedProfile.currentProject) {
            setCurrentProject(updatedProfile.currentProject);
          }
        }}
        appMode={appMode}
        onToggleAppMode={handleToggleAppMode}
      />

    </div>
  );
}
