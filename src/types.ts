export type EntrepreneurStatus = 'starting' | 'running';
export type OnlineOfflinePreference = 'online' | 'offline' | 'hybrid' | 'dont_know';
export type OfferingTypePreference = 'services' | 'products' | 'digital' | 'hybrid';
export type TeamPreference = 'solo' | 'team' | 'flexible';

export const PREFERRED_WORK_TYPE_OPTIONS = [
  'Fyzická práce / řemeslo / terén',
  'Práce s lidmi osobně',
  '100% práce na počítači / online',
  'Kombinace více typů práce',
  'Vlastní provozovna / studio / dílna',
  'Nevím / ještě nemám vyhraněno'
] as const;

export type PreferredWorkType = typeof PREFERRED_WORK_TYPE_OPTIONS[number] | string;

export function getEffectivePreferredWorkType(q?: { preferredWorkType?: string; customPreferredWorkType?: string }): string {
  if (!q) return 'Nevím / ještě nemám vyhraněno';
  if (q.customPreferredWorkType && q.customPreferredWorkType.trim()) {
    return q.customPreferredWorkType.trim();
  }
  return q.preferredWorkType || 'Nevím / ještě nemám vyhraněno';
}

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
  preferredWorkType?: PreferredWorkType;
  businessTypeInterest: string;
  location: string;
  currentProject: string;
  createdAt: string;

  // Rozšířené parametry pro maximální personalizaci nápadů
  workExperience?: string; // Současné zaměstnání a pracovní zkušenosti / historie
  currentJob?: string; // Současné zaměstnání / pozice
  education?: string; // Vzdělání, kurzy a certifikace
  soloOrTeam?: TeamPreference; // Podnikat sám nebo s týmem
  offeringType?: OfferingTypePreference; // Služby vs. Produkty vs. Digitální
  existingNetwork?: string; // Kontakty a síť (např. lokální firmy, známí, oborová komunita)
  constraints?: string; // Případná omezení (např. bez auta/řidičáku, pouze večery, péče o děti)
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

export interface IdeaScoreFactor {
  score: number; // 1-10
  note: string; // Odůvodnění bodového zisku
}

export interface MarketValidationPlan {
  whatIsSold: string; // Co přesně se prodává
  toWhom: string; // Komu
  modelPrice: string; // Modelová cena (pracovní cenový předpoklad)
  whyCustomerWantsIt: string; // Proč by to zákazník mohl chtít
  howToVerifyDemand: string; // Jak ověřit poptávku
  targetAudienceCount: string; // Kolik potenciálních zákazníků je potřeba oslovit
  signalGo: string; // Jaký signál znamená, že má smysl pokračovat
  signalPivot: string; // Jaký signál znamená, že je potřeba nabídku změnit
  potentialPitfall: string; // Co může být problém a řešení
  validationSteps: string[]; // Doporučený validační postup (bez falešných slibů dnů)
}

export interface IdeaMathematicalModel {
  workingPriceAssumption: string; // Pracovní cenový předpoklad / ověřovaná cena
  requiredClients: string; // Počet potřebných klientů
  modelMonthlyIncome: string; // Modelovaný příjem
  weeklyHoursBreakdown: string; // Rozpad hodin (dodání + akvizice + administrativa)
  toVerifyOnMarket: string; // Co je potřeba ověřit na trhu
}

export interface IdeaScoreBreakdown {
  // 10 explicitních hodnotících faktorů shody s profilem uživatele
  experienceMatch: IdeaScoreFactor; // 1. Shoda se zkušenostmi
  skillsMatch: IdeaScoreFactor; // 2. Shoda s konkrétními dovednostmi
  passionsMatch: IdeaScoreFactor; // 3. Shoda se zájmy a tématy
  onlineOfflineMatch: IdeaScoreFactor; // 4. Shoda s požadovaným online/offline modelem
  budgetFit: IdeaScoreFactor; // 5. Shoda s dostupným kapitálem
  timeFeasibility: IdeaScoreFactor; // 6. Shoda s časovou kapacitou
  incomeTargetViability: IdeaScoreFactor; // 7. Realističnost dosažení cílového příjmu
  acquisitionEase: IdeaScoreFactor; // 8. Náročnost získání prvního zákazníka
  networkLeverage: IdeaScoreFactor; // 9. Využitelnost existujících aktiv a kontaktů
  scalabilityPotential: IdeaScoreFactor; // 10. Potenciál škálování

  totalScore: number; // 0-100 (vážené skóre shody s profilem)

  // Zpětná kompatibilita pro starší reference
  skillsLeverage?: IdeaScoreFactor;
  validationAccessibility?: IdeaScoreFactor;
  financialFeasibility?: IdeaScoreFactor;
  timeAvailability?: IdeaScoreFactor;
  skillsUtilization?: IdeaScoreFactor;
  incomePotential?: IdeaScoreFactor;
  marketDemand?: IdeaScoreFactor;
  speedToStart?: IdeaScoreFactor;
  scalability?: IdeaScoreFactor;
}

export interface BusinessDirection {
  id: string;
  title: string;
  tagline: string;
  description: string;
  isRecommended: boolean; // Pouze JEDEN směr je doporučený jako #1
  recommendationReason: string; // Proč vyhrál nad ostatními
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

  // Propojení s novým 12-bodovým schématem
  problemSolved?: string;
  monetization?: string;
  howToStart?: string;
  timeCommitment?: string;
  scalabilityText?: string;
  mainRisk?: string;
  fitScore?: number;
  scoreBreakdown?: IdeaScoreBreakdown;
  category?: string;
  marketValidation?: MarketValidationPlan;
  mathematicalModel?: IdeaMathematicalModel;
}

export interface BusinessIdea {
  id: string;
  // 1. Název podnikání
  title: string;
  // 2. Krátký popis
  tagline: string;
  description: string;
  // 3. Proč je vhodný právě pro tohoto uživatele
  whyItFits: string;
  // 4. Jaký problém zákazníka řeší
  problemSolved: string;
  // 5. Pro koho je určen
  targetAudience: string;
  // 6. Jakým způsobem může vydělávat
  monetization: string;
  // 7. Jak lze začít
  howToStart: string;
  // 8. Přibližná počáteční investice
  initialCosts: string;
  initialCostsLevel: 'low' | 'medium' | 'high';
  // 9. Odhad časové náročnosti
  timeCommitment: string;
  launchSpeed: string;
  // 10. Potenciál škálování
  scalability: string;
  // 11. Co by měl uživatel udělat jako první krok
  firstValidationStep: string;
  // 12. Hlavní riziko nebo nevýhoda
  mainRisk: string;

  // Skóre vhodnosti (0-100) a reálná kritéria
  fitScore: number;
  scoreBreakdown?: IdeaScoreBreakdown;

  difficulty: 'low' | 'medium' | 'high';
  incomePotential: string;
  risk: 'low' | 'medium' | 'high';
  isRecommended?: boolean;
  category?: string;

  marketValidation?: MarketValidationPlan;
  mathematicalModel?: IdeaMathematicalModel;

  // Linkage to full direction structure if available
  directionData?: BusinessDirection;
}

export interface IdeaGenerationResponse {
  userEvaluation: UserEvaluation;
  directions: BusinessDirection[]; // Všech 10-15 směrů
  ideas?: BusinessIdea[];
  recommendedDirectionId: string;
  comparisonVerdict: string;
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

export type LeadStatus =
  | 'Nový'
  | 'Dnes oslovit'
  | 'Osloveno'
  | 'Odpověděl'
  | 'Zájem'
  | 'Schůzka'
  | 'Nabídka'
  | 'Zákazník'
  | 'Odmítnuto'
  | 'Nekontaktovat';

export type ContactChannel = 'phone' | 'sms' | 'email' | 'meeting' | 'whatsapp' | 'other';

export type OutreachTone = 'direct' | 'professional' | 'consultative' | 'case_study';

export type OutreachStepType = 
  | 'day1_email' 
  | 'day1_phone' 
  | 'day3_phone_whatsapp' 
  | 'day3_phone' 
  | 'day7_followup' 
  | 'day7_phone' 
  | 'day14_breakup' 
  | 'day14_phone' 
  | 'meeting_prep';

export interface OutreachStep {
  stepNumber: number; // 1, 2, 3, 4
  day: number; // 1, 3, 7, 14
  type: OutreachStepType;
  channel: 'email' | 'phone' | 'whatsapp';
  title: string; // e.g. "1. den: Personalizovaný e-mail"
  subject?: string; // for emails
  content: string; // the actual message / call script
  callScript?: string; // if step has phone script
  whatsappMessage?: string; // if step has whatsapp message
  keyArgument: string; // Proč tento krok funguje
  personalizationBasis?: string; // Interní podklad personalizace (např. 'Kontaktní formulář na webu')
  recommendedTiming: string; // e.g. "Doporučeno: Úterý–Čtvrtek 9:00–11:30"
  status?: 'pending' | 'sent' | 'skipped' | 'paused';
  sentAt?: string;
}

export interface LeadOutreachSequence {
  id: string;
  tone: OutreachTone;
  createdAt: string;
  updatedAt?: string;
  steps: OutreachStep[];
  activeStepIndex?: number;
  isPaused?: boolean;
  pausedReason?: string;
  pausedAt?: string;
}

export interface LeadActivity {
  id: string;
  createdAt: string; // ISO date string
  leadId?: string;
  companyName?: string;
  channel: ContactChannel;
  result: string; // výsledek kontaktu (např. 'Zájem o nabídku', 'Dohodnuta schůzka', 'Nezvednuto', 'Odmítnuto')
  statusBefore?: LeadStatus;
  statusAfter: LeadStatus;
  note?: string; // doplňující poznámka
  // Historický snapshot původního termínu naplánovaného při tomto kontaktu (neměnný historický údaj)
  historicalPlannedDate?: string;
  nextContactDate?: string; // historický snapshot (pro zpětnou kompatibilitu)
  scheduledAt?: string; // historický snapshot sjednoceného termínu (alias)
  isSimulation?: boolean; // označení testovací / simulační aktivity z Outreach Studia
}

export type SalesTimeFilter = 'all' | '7days' | '30days' | 'thisMonth';
export type SalesDataMode = 'real_only' | 'all_including_test';
export type AppExecutionMode = 'test' | 'real';

export interface SalesCostsTracking {
  acquisitionCost?: number; // Náklady na získání leadu (Kč)
  outreachCost?: number; // Náklady na outreach (Kč)
  otherCosts?: number; // Případně další náklady (Kč)
  timeSpentMinutes?: number; // Čas strávený akvizicí (minuty)
}

export interface LeadOutreachScripts {
  email: string;
  sms: string;
  phoneScript: string;
}

export interface ScoreFactor {
  category: string; // e.g. 'Obor', 'Lokalita', 'Hodnocení', 'Recenze', 'Telefon', 'Web'
  points: number; // e.g. 25
  maxPoints: number; // e.g. 25
  note: string; // e.g. '0.2 km od centra (vysoká dostupnost)'
}

export interface PublicEmailMetadata {
  email: string;
  sourceUrl: string;
  sourceType: 'official_website';
  status: 'public' | 'not_found';
  detectedAt?: string;
  label?: string; // "Veřejně dostupný e-mail" nebo "E-mail nenalezen ve veřejných zdrojích"
  details?: string;
}

export interface PotentialCustomerLead {
  id: string;
  companyName: string;
  industry?: string;
  city?: string;
  address?: string;
  website?: string; // Real URL or "Nedostupné"
  phone?: string; // Real phone or "Nedostupné"
  email?: string; // Real email or "Nedostupné"
  emailSourceUrl?: string; // Official website source URL
  emailSourceType?: 'official_website'; // Strictly 'official_website'
  emailStatus?: 'public' | 'not_found'; // 'public' or 'not_found'
  emailMetadata?: PublicEmailMetadata;
  googleRating?: string; // e.g. "4.8 (24 recenzí)" or "Nedostupné"
  distanceKm?: number; // Calculated distance from search center in km
  coordinates?: { lat: number; lng: number };
  fitScore: number; // 0-100 (exact sum of scoreBreakdown factors)
  scoreBreakdown?: ScoreFactor[];
  dataSummary?: string; // Factual summary based only on verified data
  businessHypothesis?: string; // Commercial rationale / outreach potential
  fitReason?: string; // Specific reason why this company is an ideal client
  outreach?: LeadOutreachScripts;
  status: LeadStatus; // Reálný stav firmy v CRM (např. 'Nový')
  realStatus?: LeadStatus; // Explicitní zrcadlení skutečného stavu (oddělené od testovací simulace)
  simulationStatus?: LeadStatus; // Testovací simulovaný stav z Outreach Studia (např. 'Osloveno')
  contactToday?: boolean;
  notes?: string;
  dealValue?: number; // Value in CZK when won/quoted
  costsTracking?: SalesCostsTracking; // Příprava pro budoucí sledování ROI (náklady, čas)
  isEstimateOrUnverifiedData?: boolean;
  dataSource?: string;
  googleMapsUri?: string;
  addedAt: string;
  lastContactedAt?: string; // datum a čas posledního skutečného kontaktu
  lastContactChannel?: ContactChannel; // způsob posledního skutečného kontaktu
  lastContactResult?: string; // výsledek posledního skutečného kontaktu
  nextContactDate?: string; // skutečně naplánovaný další kontakt (datum a čas)
  scheduledAt?: string; // sjednocený termín skutečného dalšího kontaktu / schůzky (alias pro CRM a Outreach)
  realNextContactDate?: string; // explicitní skutečný termín dalšího kontaktu
  simulationNextContactDate?: string; // testovací termín dalšího kontaktu ze simulace
  simulationLastContactedAt?: string; // datum a čas poslední testovací simulace
  simulationLastContactResult?: string; // výsledek poslední testovací simulace
  activities?: LeadActivity[]; // chronologická historie aktivit od nejnovější
  outreachSequence?: LeadOutreachSequence; // Outreach Studio 4kroková sekvence
  leadIntelligence?: LeadIntelligence; // Hloubková analýza z veřejného webu a povolených zdrojů
}

export interface LeadIntelligenceSignal {
  observation: string; // konkrétní pozorování (např. 'Web uvádí pouze telefonický kontakt pro objednání')
  signal?: string; // zpětná kompatibilita
  source: string; // přesný zdroj (např. 'Veřejný web firmy – stránka Kontakty')
  relevanceReason: string; // stručné vysvětlení, proč může být obchodně relevantní (stojí za ověření při kontaktu)
  type?: 'verified_fact' | 'ai_hypothesis'; // typ zjištění
  significance?: 'high' | 'medium' | 'low';
}

export interface LeadIntelligenceIdealContact {
  role: string; // např. 'Majitel / jednatel společnosti'
  name?: string; // POUZE pokud je skutečně na veřejném webu nalezeno, jinak undefined
  confidence: 'verified_on_web' | 'derived_role_only';
  sourceNote: string; // 'Konkrétní jméno nebylo ve veřejných zdrojích ověřeno.' nebo 'Ověřeno ve veřejných kontaktech'
  source: string; // přesný zdroj informace
}

export type LeadIntelligenceContactPerson = LeadIntelligenceIdealContact;

export interface LeadIntelligenceVerifiedFacts {
  companyName: string;
  industry: string;
  address: string;
  website: string;
  phone: string;
  ratingAndReviews?: string; // Čistě popisný fakt: hodnocení a počet recenzí bez nepodložených závěrů
  webFindings?: string[]; // Skutečné informace nalezené na veřejném webu firmy (titulek, uvedené sekce služeb)
  sourceSummary: string; // Přehled povolených zdrojů
}

export interface LeadIntelligenceHypotheses {
  opportunity: string; // AI hypotéza – ověřit při kontaktu (např. 'Absence online formuláře může představovat příležitost...')
  opportunitySourceSignal: string; // Z jakého veřejného signálu hypotéza vychází
  offer: string; // AI hypotéza – návrh konkrétního řešení
  offerSourceSignal: string; // Vysvětlení, z jakého signálu návrh vychází
  whyThisCompany: string; // Proč tato firma – opatrná hypotéza k ověření
  whyThisCompanySourceSignal: string;
}

export interface LeadIntelligenceRecommendedApproach {
  icebreaker: string; // 1–2 věty z reálně nalezených informací nebo neutrální uctivé oslovení
  icebreakerSource: string;
  idealContactPerson: LeadIntelligenceIdealContact;
  nextStepRecommendation: string;
}

export interface LeadIntelligence {
  // 1. Ověřená fakta
  verifiedFacts: LeadIntelligenceVerifiedFacts;

  // 2. AI obchodní hypotézy (jasně označené: AI hypotéza – ověřit při kontaktu)
  hypotheses: LeadIntelligenceHypotheses;

  // 3. Doporučený postup
  recommendedApproach: LeadIntelligenceRecommendedApproach;

  // Signály k oslovení (pozorování, zdroj, relevance)
  signals: LeadIntelligenceSignal[];

  // Zpětná kompatibilita pro stávající volání
  opportunity: string;
  opportunitySource: string;
  offer: string;
  offerSource: string;
  whyThisCompany: string;
  whyThisCompanySource: string;
  icebreaker: string;
  icebreakerSource: string;
  idealContactPerson: LeadIntelligenceIdealContact;

  analyzedAt: string; // ISO timestamp analýzy
  sourceWebsite?: string; // URL analyzovaného webu
  analysisMethod: 'web_deep_dive' | 'public_domain_analysis';
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
    provider?: string;
    isConfigured?: boolean;
  };
  leads: PotentialCustomerLead[];
}

// ==========================================
// PODNIKAI BUSINESS START (INTERNÍ ADMIN NÁSTROJ)
// ==========================================

export type BusinessStartClientStatus = 'new' | 'analysis' | 'control' | 'done';

export interface BusinessStartRegulatoryRequirements {
  isRegulated: boolean; // Zda jde o řemeslnou, vázanou nebo jinak regulovanou profesi
  tradeLicenseType: 'volna' | 'remeslna' | 'vazana' | 'koncesovana' | 'jina'; // Typ živnosti dle zákona č. 455/1991 Sb.
  requiredQualification: string; // Požadované vzdělání, praxe, výuční list či akreditovaný rekvalifikační kurz MŠMT/MZ
  permitsAndLicenses: string; // Oprávnění, hygiena, provozní řád, odpovědný zástupce (garant)
  mandatoryInsurance: string; // Doporučené nebo zákonné pojištění profesní a obecné odpovědnosti
  necessaryEquipment: string; // Nezbytné profesionální vybavení a ochranné pomůcky
  legalNotice: string; // Právní upozornění na nutnost splnění zákonných podmínek
}

export interface BusinessStartQuestionnaire {
  // 1. Základní identifikační a kontaktní údaje klienta
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  location: string;

  // 2. Současná profesní situace a kariérní historie
  currentCareerSituation: string;

  // 3. Hlavní cíl podnikání
  mainGoal: string;

  // 4. Cílový měsíční příjem (v Kč)
  targetMonthlyIncome: string;

  // 5. Reálný dostupný počáteční kapitál
  startingCapital: string;

  // 6. Týdenní časová kapacita
  weeklyTimeCommitment: string;

  // 7. Požadovaný model provozu a preferovaný typ práce (Metodika 12 otázek)
  operatingModel: 'online' | 'hybrid' | 'offline' | 'dont_know';
  // 7. Podpoložka: Jaký typ práce vám nejvíce vyhovuje?
  preferredWorkType?: PreferredWorkType;
  customPreferredWorkType?: string; // Vlastní text klienta má vždy prioritu před předvolenou možností

  // 8. Klíčové dovednosti, expertíza a silné stránky
  coreSkillsAndExpertise: string[] | string;

  // 9. Zájmy, obory a témata, která klienta baví
  passionsAndInterests: string[] | string;

  // 10. Červené linie / Čemu se klient striktně vyhýbá
  strictDislikesAndRedLines: string[] | string;

  // 11. Dosavadní síť kontaktů, existující aktiva a výhody
  existingAssetsAndNetwork: string;

  // 12. Osobní překážky, limitace a specifické podmínky
  personalConstraints: string;
}

export interface BusinessStartProfileEvaluation {
  strongPoints: string[];
  riskFactors: string[];
  competitiveAdvantages: string[];
  capitalFeasibilityNote: string;
  timeFeasibilityNote: string;
}

export type StartupCostLevel = 'minimal' | 'low' | 'medium' | 'high' | 'very_high';
export type CapitalIntensity = 'low' | 'medium' | 'high';
export type BudgetCompatibilityLevel = 'high' | 'medium' | 'low' | 'incompatible';

export interface CapitalUsageBreakdownItem {
  category: 'vybavení' | 'první zásoby' | 'prostor/nájem' | 'hygiena a spotřební materiál' | 'licence/software' | 'branding' | 'web' | 'marketing' | 'rezerva' | 'provozní kapitál' | 'pohotovostní rezerva' | string;
  item: string;
  estimatedCostCz: string;
  priority: 'nutné pro start' | 'doporučené pro zrychlení' | 'volitelné / rezerva';
  rationale: string;
  itemRequirement?: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  modelLink?: string;
}

export interface BusinessStartCapitalUsagePlan {
  availableCapital: string;
  availableCapitalNumber: number;
  requiredStartupCost: string;
  requiredStartupCostNumber: number;
  recommendedInitialInvestment: string;
  recommendedInitialInvestmentNumber: number;
  unspentCapitalReserve: string;
  unspentCapitalAdvice: string;
  breakdown: CapitalUsageBreakdownItem[];
  noForcedSpendingNotice: string;
  startupScenarios?: {
    minimalStart: string;
    recommendedStart: string;
    futureUpgradeOrBuffer: string;
  };
}

export interface BusinessStartDirectionCandidate {
  id: string;
  title: string;
  tagline: string;
  businessModel: string;
  whyMatch: string;
  estimatedMargin: string;
  timeToFirstRevenue: string;
  requiredCapital: string;
  isPrimary: boolean;
  regulatoryNotice?: string;

  // EXPLICITNÍ BUDGET KOMPATIBILITA & KAPITÁLOVÁ NÁROČNOST
  estimatedStartupCostMin: number;
  estimatedStartupCostMax: number;
  startupCostLevel: StartupCostLevel;
  capitalIntensity: CapitalIntensity;
  recommendedCapitalUse: string;
  budgetCompatibility: BudgetCompatibilityLevel;
  budgetScore?: number;
  budgetCompatibilityReason?: string;
  recommendedInitialInvestment?: number;
}

export interface ClientTargetVsCurrentStartModel {
  targetModelClientGoal: string; // A) CÍLOVÝ MODEL KLIENTA
  currentBudgetStart: string; // B) REALISTICKÝ START V RÁMCI AKTUÁLNÍHO ROZPOČTU
  transitionCondition: string; // C) PODMÍNKA PŘECHODU K CÍLOVÉMU MODELU
}

export interface BusinessStartCapacityBreakdown {
  theoreticalCapacity: string;
  operationalCapacity: string;
  recommendedCapacity: string;
  overheadBufferBreakdown: string;
}

export interface BusinessStartPrimaryBlueprint {
  directionTitle: string;
  tagline: string;
  uniqueValueProposition: string;
  idealCustomerAvatar: {
    description: string;
    painPoints: string[];
    buyingMotivation: string;
    whereToFindThem: string[];
  };
  offerAndPackaging: {
    coreOffer: string;
    deliverables: string[];
    pricingStrategy: string;
    recommendedPriceCz: string;
    upsellOption?: string;
  };
  regulatoryRequirements?: BusinessStartRegulatoryRequirements;
  first14DaysValidationPlan: {
    hypothesisToVerify: string;
    targetOutreachCount: number;
    validationSteps: string[];
    goSignal: string;
    pivotSignal: string;
  };
  salesStrategyAndScripts: {
    outreachChannel: string;
    icebreakerMessage: string;
    salesScriptOutline: string[];
    handlingCommonObjections: Array<{ objection: string; response: string }>;
  };
  actionCalendar30Days: Array<{
    week: number;
    focus: string;
    tasks: string[];
  }>;
  financialModel: {
    monthlyOverheadCostsCz: string;
    variableCostsPerClientCz: string;
    breakEvenClients: string;
    monthlyGoalMath: string;
    scenarios?: {
      pessimistic: string;
      realistic: string;
      optimistic: string;
    };
    disclaimer?: string;
    assumedPrice?: string;
    assumedClientVolume?: string;
    capacityScenario?: string;
    variableCostsAssumption?: string;
    fixedCostsAssumption?: string;
    simpleCalculationFormula?: string;
    notIncludedCostsNotice?: string;
    scenarioNotice?: string;
  };
  capacityBreakdown?: BusinessStartCapacityBreakdown;
  targetVsStartPlan?: ClientTargetVsCurrentStartModel;
  risksAndMitigation: Array<{
    risk: string;
    mitigation: string;
  }>;
  capitalUsagePlan?: BusinessStartCapitalUsagePlan;
}

export interface BusinessStartLockedBlueprint {
  primaryDirection: string;
  coreOffer: string;
  idealCustomer: string;
  customerProblem: string;
  valueProposition: string;
  price: string;
  salesChannel: string;
  acquisitionMethod: string;
  deliveryModel: string;
  revenueModel: string;
  costModel: string;
  validationPlan: string;
  regulatoryStatus?: string;
}

export interface BusinessStartValidationGate {
  sourceOfTruthValid: boolean;
  inputsUnchanged: boolean;
  clientGoalRespected?: boolean;
  typeOfWorkRespected?: boolean;
  physicalWorkSupported?: boolean;
  localServiceSupported?: boolean;
  onlineModelSupported?: boolean;
  qualificationRulesRespected?: boolean;
  redLinesRespected: boolean;
  capacityOk?: boolean;
  blueprintLocked: boolean;
  financialModelConsistent?: boolean;

  // Stávající rozšířené kontroly konzistence
  offerMatchesDirection?: boolean;
  customerMatchesOffer?: boolean;
  salesMatchesCustomer?: boolean;
  marketingMatchesOffer?: boolean;
  validationMatchesOffer?: boolean;
  planMatchesCapacity?: boolean;
  financialModelMatchesOffer?: boolean;
  financialModelMatchesCapacity?: boolean;

  // Finanční QA brány – zamezení zavádějících finančních příslibů
  financeAreScenarios?: boolean;
  financeAssumptionsDisclosed?: boolean;
  noGuaranteedIncome?: boolean;
  unknownCostsNotZero?: boolean;
  capacityIsScenario?: boolean;
  profitIsScenario?: boolean;

  // Rozpočtové QA brány – vliv kapitálu na výběr a scoring kandidátů
  budgetIsUsedInCandidateGeneration?: boolean;
  budgetCompatibilityChecked?: boolean;
  startupCostMatchesModel?: boolean;
  capitalUsagePlanPresent?: boolean;
  capitalUsageIsExplicit?: boolean;
  noForcedSpending?: boolean;
  no0CzkBiasWhenBudgetExists?: boolean;

  // Hloubkové validační kontroly (Oprava #10)
  primaryDirectionMatchesTypeOfWork?: boolean;
  offerMatchesTypeOfWork?: boolean;
  salesChannelsRespectRedLines?: boolean;
  startupCostWithinBudget?: boolean;
  recommendedInvestmentWithinBudget?: boolean;
  breakEvenScopeExplicit?: boolean;
  financialTermsCorrect?: boolean;
  capacityWithinLimit?: boolean;

  status: 'DONE' | 'NEEDS_REVIEW';
  reviewNotes?: string;
}

export interface BusinessStartSourceOfTruthAudit {
  capitalLimit: string;
  timeWeeklyLimit: string;
  operatingModelLimit: string;
  mainGoalLimit?: string;
  preferredWorkTypeLimit?: string;
  strictRedLines: string[];
  skillsProvided: string[];
  passionsProvided?: string[];
  existingAssets: string;
  unknownsOrBlockers: string[];
}

export interface BusinessStartAnalysis {
  engineVersion?: string;
  executiveSummary: string;
  profileEvaluation: BusinessStartProfileEvaluation;
  topDirections: BusinessStartDirectionCandidate[];
  primaryDirectionBlueprint: BusinessStartPrimaryBlueprint;
  lockedBlueprint?: BusinessStartLockedBlueprint;
  capitalUsagePlan?: BusinessStartCapitalUsagePlan;
  targetVsStartPlan?: ClientTargetVsCurrentStartModel;
  capacityBreakdown?: BusinessStartCapacityBreakdown;
  validationGate?: BusinessStartValidationGate;
  sourceOfTruthAudit?: BusinessStartSourceOfTruthAudit;
  adminNotes?: string;
  analyzedAt: string;
  analyzedByModel?: string;
}

export type BusinessStartOrderStatus =
  | 'DRAFT'
  | 'READY_FOR_PAYMENT'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'ANALYZING'
  | 'REPORT_READY'
  | 'PDF_READY'
  | 'PAYMENT_FAILED'
  | 'ANALYSIS_FAILED'
  | 'PDF_FAILED';

export type BusinessStartPaymentStatus =
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED';

export interface BusinessStartOrder {
  id: string; // e.g. 'order-bs-12345'
  clientId: string; // matches BusinessStartClient.id
  clientEmail: string;
  clientName: string;
  orderToken: string; // secure secret token for authorization
  priceCz: number; // 690 Kč (starter discounted price)
  originalPriceCz?: number; // 1990 Kč (original standard price)
  discountPercent?: number; // 65 %
  currency: 'CZK';
  status: BusinessStartOrderStatus;
  paymentStatus: BusinessStartPaymentStatus;
  paymentProvider: 'stripe' | 'stripe_sandbox';
  paymentSessionId?: string;
  paidAt?: string;
  analysisStartedAt?: string;
  analysisCompletedAt?: string;
  pdfGeneratedAt?: string;
  errorMessage?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessStartClient {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BusinessStartClientStatus;
  questionnaire: BusinessStartQuestionnaire;
  analysis?: BusinessStartAnalysis;
  adminNotes?: string;
  consultantName?: string;
  reportLastGeneratedAt?: string;
  // Order & Payment automation extensions
  order?: BusinessStartOrder;
  orderToken?: string;
  paymentStatus?: BusinessStartPaymentStatus;
  orderStatus?: BusinessStartOrderStatus;
  priceCz?: number;
  currency?: string;
}

export interface BusinessStartStats {
  total: number;
  new: number;
  analysis: number;
  control: number;
  done: number;
}

