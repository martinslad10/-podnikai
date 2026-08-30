export type EntrepreneurStatus = 'starting' | 'running';
export type OnlineOfflinePreference = 'online' | 'offline' | 'hybrid';

export interface UserProfile {
  name: string;
  status: EntrepreneurStatus;
  goal: string;
  targetIncome: string;
  startingBudget: string;
  availableTime: string;
  skills: string[];
  passions: string[];
  dislikes: string[];
  onlineOffline: OnlineOfflinePreference;
  businessTypeInterest: string;
  location: string;
  currentProject: string;
  createdAt: string;
}

export interface BusinessIdea {
  id: string;
  title: string;
  tagline: string;
  description: string;
  initialCosts: string; // e.g. "Do 10 000 Kč"
  initialCostsLevel: 'low' | 'medium' | 'high';
  difficulty: 'low' | 'medium' | 'high';
  incomePotential: string; // e.g. "50 000 – 100 000 Kč / měsíc"
  launchSpeed: string; // e.g. "1–2 týdny"
  risk: 'low' | 'medium' | 'high';
  whyItFits: string;
  firstValidationStep: string;
  targetAudience: string;
}

export interface BusinessPlanSection {
  title: string;
  iconName: string;
  content: string;
  actionItems?: string[];
}

export interface BusinessPlan {
  projectName: string;
  summary: string;
  firstAction: string;
  nextSteps: string;
  offer: string;
  pricing: string;
  costs: string;
  customerAcquisition: string;
  marketing: string;
  firstMonthPlan: string;
  growthStrategy: string;
  generatedAt: string;
}

export interface DailyStep {
  id: string;
  title: string;
  description: string;
  whyImportant: string;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  category: 'validace' | 'nabidka' | 'marketing' | 'prodej' | 'operativa' | 'finance';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: string[];
}
