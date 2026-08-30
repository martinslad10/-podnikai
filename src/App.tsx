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
import { ProfileDrawer } from './components/ProfileDrawer';
import { BusinessIdea, BusinessPlan, DailyStep, UserProfile } from './types';
import { generateNextDailyStep } from './services/api';

const STORAGE_KEY_PROFILE = 'podnikai_user_profile';
const STORAGE_KEY_PROJECT = 'podnikai_current_project';
const STORAGE_KEY_DAILY_STEP = 'podnikai_daily_step';
const STORAGE_KEY_COMPLETED_STEPS = 'podnikai_completed_steps';
const STORAGE_KEY_BUSINESS_PLAN = 'podnikai_business_plan';

export default function App() {
  // App Phase State: 'landing' | 'onboarding' | 'app'
  const [appPhase, setAppPhase] = useState<'landing' | 'onboarding' | 'app'>(() => {
    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    return savedProfile ? 'app' : 'landing';
  });

  // Active Tab in main app: 'dashboard' | 'chat' | 'ideas' | 'plan'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'ideas' | 'plan'>('dashboard');

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

  const [isGeneratingStep, setIsGeneratingStep] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Sync state with localStorage
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

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Frosted Glass Ambient Lighting Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none z-0" />
      
      {/* Navbar (displayed in app phase) */}
      {appPhase === 'app' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
          currentProject={currentProject}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
          onResetToLanding={() => setAppPhase('landing')}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {/* PHASE 1: Landing Hero */}
        {appPhase === 'landing' && (
          <LandingHero
            onStart={() => setAppPhase('onboarding')}
          />
        )}

        {/* PHASE 2: Onboarding Flow */}
        {appPhase === 'onboarding' && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            initialProfile={userProfile}
          />
        )}

        {/* PHASE 3: Main App Tabs */}
        {appPhase === 'app' && userProfile && (
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
                currentProject={currentProject}
              />
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
      />

    </div>
  );
}
