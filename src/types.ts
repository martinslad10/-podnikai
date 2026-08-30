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

export interface UserEvaluation {
  capitalAssessment: string;
  skillsAssessment: string;
  timeAssessment: string;
  salesStyleAssessment: string;
  targetIncomeAssessment: string;
}

export interface DirectionRatings {
  speedToFirstClient: { score: number; text: string }; // 1-10 (např. 9/10, do 5 dnů)
  upfrontCosts: { score: number; text: string }; // 1-10 (např. 10/10, do 1 500 Kč)
  marginPotential: { score: number; text: string }; // 1-10 (např. 8/10, 75-85 % marže)
  competitionInCz: { score: number; text: string }; // 1-10 (např. 7/10, roztříštěný trh)
  scalability: { score: number; text: string }; // 1-10 (např. 6/10, servis s možností automatizace)
}

export interface EpistemicCategorization {
  verifiedFacts: string[]; // [Fakta] ověřené reálné poplatky, legislativní rámec ČR, bezplatné tarify
  marketEstimates: string[]; // [Odhady] tržní průměrné odhady cen a časů
  modelScenario: string; // [Modelový scénář] matematický výpočet na příkladu (např. 5 klientů x cena)
  needsMarketVerification: string[]; // [Nutno ověřit na trhu] neověřené lokální proměnné, které nelze halucinovat
}

export interface BusinessDirection {
  id: string;
  title: string;
  tagline: string;
  description: string;
  isRecommended: boolean; // Pouze JEDEN směr je doporučený jako #1
  recommendationReason: string; // Proč vyhrál nad zbylými 2 směry
  ratings: DirectionRatings;
  epistemic: EpistemicCategorization;
  
  // Konkrétní exekuční balíček
  concreteOffer: string; // Konkrétní nabídka / balíček (USP)
  targetCustomer: string; // Přesná definice ideálního platícího klienta
  pricingStructure: string; // Cena a cenotvorba (s vyznačením modelového scénáře)
  outreachMethod: string; // Způsob oslovení & skript
  firstClientPlan: string; // 7denní plán k prvnímu platícímu klientovi
  todayTask: {
    title: string;
    description: string;
    estimatedMinutes: number;
    whyToday: string;
  };
}

export interface IdeaGenerationResponse {
  userEvaluation: UserEvaluation;
  directions: BusinessDirection[]; // Max 3
  recommendedDirectionId: string;
  comparisonVerdict: string;
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
  // Optional linkage to enriched direction
  directionData?: BusinessDirection;
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

export type LeadStatus = 'Nový' | 'Osloven' | 'Odpověděl' | 'Schůzka' | 'Nabídka' | 'Vyhráno' | 'Prohráno';

export interface LeadOutreachScripts {
  email: string;
  sms: string;
  phoneScript: string;
}

export interface PotentialCustomerLead {
  id: string;
  companyName: string;
  industry: string;
  city: string;
  address?: string;
  website: string; // Real URL or "Nedostupné"
  phone: string; // Real phone or "Nedostupné"
  email: string; // Real email or "Nedostupné"
  googleRating: string; // e.g. "4.8 (24 recenzí)" or "Nedostupné"
  fitScore: number; // 0-100
  fitReason: string; // Specific reason why this company is an ideal client
  outreach: LeadOutreachScripts;
  status: LeadStatus;
  contactToday: boolean;
  notes?: string;
  dealValue?: number; // Value in CZK when won/quoted
  isEstimateOrUnverifiedData?: boolean;
  addedAt: string;
  lastContactedAt?: string;
}

export interface CustomerSearchCriteria {
  cityOrRegion: string;
  maxDistanceKm: number;
  companyType: string;
  numberOfLeads: number;
  businessDirectionTitle?: string;
  concreteOffer?: string;
}

export interface CustomerFinderResponse {
  searchCriteria: CustomerSearchCriteria;
  dataNotice: {
    dataSourceInfo: string;
    isRealTimeVerified: boolean;
    missingDataSourceWarning?: string;
  };
  leads: PotentialCustomerLead[];
}
