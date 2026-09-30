import React from 'react';
import { PotentialCustomerLead, ContactChannel, LeadStatus, AppExecutionMode, UserProfile } from '../types';
import { DailyOutreachPlan } from './DailyOutreachPlan';

export interface TodayContactsOverviewProps {
  leads?: PotentialCustomerLead[];
  userProfile?: UserProfile | null;
  concreteOffer?: string;
  businessDirectionTitle?: string;
  onUpdateLead?: (updatedLead: PotentialCustomerLead) => void;
  onUpdateLeadStatus?: (leadId: string, status: LeadStatus, note?: string) => void;
  onSaveLeadActivity?: (
    leadId: string, 
    channel: ContactChannel, 
    result: string, 
    newStatus: LeadStatus, 
    note?: string, 
    nextContactDate?: string,
    isSimulation?: boolean
  ) => void;
  onNavigateToFinder?: (leadId?: string) => void;
  onNavigateToLeads?: (leadId?: string) => void;
  onNavigateToFollowUp?: () => void;
  appMode?: AppExecutionMode;
}

export const TodayContactsOverview: React.FC<TodayContactsOverviewProps> = ({
  leads = [],
  userProfile,
  concreteOffer,
  businessDirectionTitle,
  onUpdateLead,
  onUpdateLeadStatus,
  onSaveLeadActivity,
  onNavigateToFinder,
  onNavigateToLeads,
  onNavigateToFollowUp,
  appMode = 'test'
}) => {
  return (
    <DailyOutreachPlan
      leads={leads}
      userProfile={userProfile}
      concreteOffer={concreteOffer}
      businessDirectionTitle={businessDirectionTitle}
      onUpdateLead={onUpdateLead}
      onUpdateLeadStatus={onUpdateLeadStatus}
      onSaveLeadActivity={onSaveLeadActivity}
      onNavigateToFinder={onNavigateToFinder || onNavigateToLeads}
      onNavigateToFollowUp={onNavigateToFollowUp}
      appMode={appMode}
    />
  );
};
