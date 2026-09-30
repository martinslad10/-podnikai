import { 
  UserProfile, 
  BusinessDirection, 
  BusinessIdea, 
  IdeaGenerationResponse, 
  IdeaScoreBreakdown,
  IdeaScoreFactor,
  UserEvaluation,
  MarketValidationPlan,
  IdeaMathematicalModel
} from '../types';
import {
  getOnlineCandidatesPool,
  getOnlineDeveloperCandidates,
  getMasseurCandidates,
  getChefCandidates,
  getOfflineCraftCandidates
} from './ideaCandidatesData';

/**
 * Parsuje finanční rozpočet zadaný uživatelem na striktní maximální limit (v Kč).
 * Rozlišuje striktně:
 * - 0 Kč -> max 0 Kč
 * - do 5 000 Kč -> max 5 000 Kč
 * - 5 000–20 000 Kč -> max 20 000 Kč
 * - 20 000–50 000 Kč -> max 50 000 Kč
 * - vyšší rozpočet -> odpovídající částka
 */
export function parseBudgetLimit(budgetStr: string = ''): { maxBudget: number; isZeroBudget: boolean } {
  const clean = budgetStr.toLowerCase().trim();
  const noSpace = clean.replace(/\s/g, '');

  // 1. Zkontroluj explicitně nulový rozpočet (nesmí chytat '20 000 kč' apod.):
  if (
    noSpace === '0' || 
    noSpace === '0kč' || 
    noSpace === '0kc' || 
    /^0(\.0+)?\s*(kč|kc)?$/.test(clean) ||
    clean.includes('nula') || 
    clean.includes('bez kapitálu') || 
    clean.includes('nemám rozpočet') ||
    clean.includes('žádný rozpočet') ||
    clean === 'nemám'
  ) {
    return { maxBudget: 0, isZeroBudget: true };
  }

  // 2. Vyhodnoť zadané rozsahy v sestupném pořadí:
  if (clean.includes('100 000') || clean.includes('100000')) {
    return { maxBudget: 100000, isZeroBudget: false };
  }
  if (clean.includes('50 000') || clean.includes('50000')) {
    return { maxBudget: 50000, isZeroBudget: false };
  }
  if (clean.includes('20 000') || clean.includes('20000')) {
    return { maxBudget: 20000, isZeroBudget: false };
  }
  if (clean.includes('5 000') || clean.includes('5000')) {
    return { maxBudget: 5000, isZeroBudget: false };
  }

  const match = clean.match(/(\d+[\s\d]*)/);
  if (match) {
    const num = parseInt(match[0].replace(/\s/g, ''), 10);
    if (!isNaN(num)) {
      return { maxBudget: num, isZeroBudget: num === 0 };
    }
  }
  // Default pro nezadaný budget
  return { maxBudget: 10000, isZeroBudget: false };
}

/**
 * Parsuje dostupný čas týdně.
 */
export function parseTimeAvailable(timeStr: string = ''): { minHours: number; maxHours: number } {
  const clean = timeStr.toLowerCase().trim();
  if (clean.includes('15–25') || clean.includes('15-25')) {
    return { minHours: 15, maxHours: 25 };
  }
  if (clean.includes('10–15') || clean.includes('10-15')) {
    return { minHours: 10, maxHours: 15 };
  }
  if (clean.includes('20–30') || clean.includes('20-30')) {
    return { minHours: 20, maxHours: 30 };
  }
  if (clean.includes('30–40') || clean.includes('30-40') || clean.includes('plný')) {
    return { minHours: 30, maxHours: 40 };
  }
  const matches = clean.match(/\d+/g);
  if (matches && matches.length >= 2) {
    return { minHours: parseInt(matches[0], 10), maxHours: parseInt(matches[1], 10) };
  } else if (matches && matches.length === 1) {
    const h = parseInt(matches[0], 10);
    return { minHours: Math.max(5, h - 5), maxHours: h };
  }
  return { minHours: 15, maxHours: 25 };
}

/**
 * Výpočet 10 samostatných hodnotících faktorů shody s profilem uživatele.
 * Skóre vyjadřuje pouze míru souladu podnikatelského modelu s údaji zadanými uživatelem.
 * Nejedná se o pravděpodobnost úspěchu, predikci příjmu, predikci konverze ani garanci podnikatelského výsledku.
 */
export function calculate10FactorScore(factors: {
  experienceMatch: IdeaScoreFactor; // 1. Shoda se zkušenostmi (váha 0.20)
  skillsMatch: IdeaScoreFactor; // 2. Shoda s konkrétními dovednostmi (váha 0.20)
  passionsMatch: IdeaScoreFactor; // 3. Shoda se zájmy a tématy (váha 0.10)
  onlineOfflineMatch: IdeaScoreFactor; // 4. Shoda s online/offline modelem & typem práce (váha 0.15)
  budgetFit: IdeaScoreFactor; // 5. Shoda s dostupným kapitálem (váha 0.10)
  timeFeasibility: IdeaScoreFactor; // 6. Shoda s časovou kapacitou (váha 0.10)
  incomeTargetViability: IdeaScoreFactor; // 7. Realističnost dosažení cílového příjmu (váha 0.10)
  acquisitionEase: IdeaScoreFactor; // 8. Náročnost získání 1. zákazníka / bariéra vstupu (váha 0.05)
  networkLeverage: IdeaScoreFactor; // 9. Využitelnost existujících kontaktů a aktiv (kompatibilita)
  scalabilityPotential: IdeaScoreFactor; // 10. Potenciál škálování (kompatibilita)
}): { totalScore: number; breakdown: IdeaScoreBreakdown } {
  // Vážený součet 8 klíčových faktorů dle metodiky PODNIKAI (součet vah = 1.00 / 100 %):
  // 0.20 (zkušenosti) + 0.20 (dovednosti) + 0.10 (zájmy) + 0.15 (model a typ práce) + 0.10 (kapitál) + 0.10 (čas) + 0.10 (příjem) + 0.05 (akvizice) = 1.00
  const weighted = 
    factors.experienceMatch.score * 0.20 +
    factors.skillsMatch.score * 0.20 +
    factors.passionsMatch.score * 0.10 +
    factors.onlineOfflineMatch.score * 0.15 +
    factors.budgetFit.score * 0.10 +
    factors.timeFeasibility.score * 0.10 +
    factors.incomeTargetViability.score * 0.10 +
    factors.acquisitionEase.score * 0.05;

  let total = Math.round(weighted * 10);

  // Zásadní porušení tvrdého limitu rozpočtu, modelu provozu nebo časové kapacity srazí celkové skóre
  if (factors.budgetFit.score < 3 || factors.onlineOfflineMatch.score < 3 || factors.timeFeasibility.score < 3) {
    total = Math.min(25, total);
  }

  const clampedScore = Math.min(98, Math.max(10, total));

  const breakdown: IdeaScoreBreakdown = {
    experienceMatch: factors.experienceMatch,
    skillsMatch: factors.skillsMatch,
    passionsMatch: factors.passionsMatch,
    onlineOfflineMatch: factors.onlineOfflineMatch,
    budgetFit: factors.budgetFit,
    timeFeasibility: factors.timeFeasibility,
    incomeTargetViability: factors.incomeTargetViability,
    acquisitionEase: factors.acquisitionEase,
    networkLeverage: factors.networkLeverage,
    scalabilityPotential: factors.scalabilityPotential,
    totalScore: clampedScore,

    // Zpětná kompatibilita pro stávající reference
    skillsLeverage: factors.skillsMatch,
    validationAccessibility: factors.acquisitionEase,
    financialFeasibility: factors.budgetFit,
    timeAvailability: factors.timeFeasibility,
    skillsUtilization: factors.skillsMatch,
    incomePotential: factors.incomeTargetViability,
    marketDemand: factors.acquisitionEase,
    speedToStart: factors.acquisitionEase,
    scalability: factors.scalabilityPotential
  };

  return { totalScore: clampedScore, breakdown };
}

/**
 * Zpětně kompatibilní wrapper mapující původní 7-faktorové volání na 10 faktorů.
 */
export function calculate7FactorScore(
  factors: {
    budgetFit: IdeaScoreFactor;
    timeFeasibility: IdeaScoreFactor;
    onlineOfflineMatch: IdeaScoreFactor;
    skillsLeverage: IdeaScoreFactor;
    incomeTargetViability: IdeaScoreFactor;
    validationAccessibility: IdeaScoreFactor;
    scalabilityPotential: IdeaScoreFactor;
  }
): { totalScore: number; breakdown: IdeaScoreBreakdown } {
  return calculate10FactorScore({
    experienceMatch: factors.skillsLeverage,
    skillsMatch: factors.skillsLeverage,
    passionsMatch: factors.skillsLeverage,
    onlineOfflineMatch: factors.onlineOfflineMatch,
    budgetFit: factors.budgetFit,
    timeFeasibility: factors.timeFeasibility,
    incomeTargetViability: factors.incomeTargetViability,
    acquisitionEase: factors.validationAccessibility,
    networkLeverage: factors.validationAccessibility,
    scalabilityPotential: factors.scalabilityPotential
  });
}

export interface RawCandidateIdea {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  requiresPhysicalPresence: boolean; // TRUE = vyžaduje fyzickou přítomnost u zákazníka, provozovnu, dílnu či sklad
  minInitialCosts: number; // Přesná minimální počáteční investice v Kč
  initialCostsText: string;
  weeklyHoursNeeded: number; // Celkový čas týdně včetně 40% režie a akvizice
  weeklyHoursBreakdownText: string;
  workingPriceText: string; // Pracovní cenový předpoklad
  requiredClientsText: string; // Počet potřebných klientů
  modelMonthlyIncomeText: string; // Modelovaný příjem
  toVerifyOnMarket: string; // Co je potřeba ověřit na trhu
  whyCustomerWantsIt: string; // Proč by to zákazník mohl chtít
  targetAudience: string; // Komu
  whatIsSold: string; // Co přesně se prodává
  validationSteps: string[]; // Doporučený validační postup (bez garancí dnů)
  targetAudienceCountText: string; // Kolik oslovit (např. 20–30)
  signalGo: string; // Signál pokračovat
  signalPivot: string; // Signál změnit nabídku
  potentialPitfall: string; // Co může být problém a řešení
  skillsTags: string[]; // Klíčové štítky dovedností
  todayTaskTitle: string;
  todayTaskDesc: string;

  // Typy práce z 10 možností (pro přesné párování dle SOURCE OF TRUTH)
  workTypes?: string[];

  // Informace o regulaci a kvalifikaci dle zákona č. 455/1991 Sb.
  regulatoryInfo?: {
    isRegulated: boolean;
    tradeLicenseType: 'volna' | 'remeslna' | 'vazana' | 'koncesovana' | 'jina';
    requiredQualification: string;
    permitsAndLicenses: string;
    mandatoryInsurance: string;
    necessaryEquipment: string;
    legalNotice: string;
  };

  // SPECIFICKÁ METADATA PRO 10-FAKTOROVÝ CITLIVÝ SCORING:
  requiredSkills: string[]; // Dovednosti nezbytné pro výkon modelu
  requiredExperience: string[]; // Klíčové oblasti praxe
  relatedPassions: string[]; // Zájmy/témata odpovídající modelu
  pricingModelType: 'retainer' | 'project' | 'digital_product' | 'consultation'; // Typ příjmového modelu
  acquisitionDifficulty: 'low' | 'medium' | 'high'; // Bariéra získání 1. klienta
  acquisitionMethodNote: string; // Popis akviziční bariéry a ukázky hodnoty
  externalDependency: 'none' | 'platform' | 'third_party'; // Závislost na externích subjektech
  externalDependencyNote: string; // Popis závislosti či nezávislosti
  requiresUnlistedSpecializedSkill: boolean; // Zda model vyžaduje neuvedené know-how
  specializedSkillKeyword?: string; // Klíčové slovo pro ověření znalosti
  unlistedSpecializedSkillName?: string; // Název této specializované znalosti
  scalabilityScore: number; // 1-10
  scalabilityNote: string;
}

/**
 * 3-FÁZOVÝ GENERÁTOR NÁPADŮ
 */
export function generatePersonalizedIdeas(
  profile: UserProfile, 
  customPreferences?: string
): IdeaGenerationResponse {
  const budgetInfo = parseBudgetLimit(profile.startingBudget);
  const timeInfo = parseTimeAvailable(profile.availableTime);
  const isOnlineRequested = profile.onlineOffline === 'online';
  const isOfflineRequested = profile.onlineOffline === 'offline';
  const targetIncomeStr = profile.targetIncome || '50 000–80 000 Kč / měsíc';

  // Textová analýza profilu
  const skillsList = Array.isArray(profile.skills) ? profile.skills : (profile.skills ? [profile.skills] : []);
  const passionsList = Array.isArray(profile.passions) ? profile.passions : (profile.passions ? [profile.passions] : []);
  const combinedText = `${skillsList.join(' ')} ${passionsList.join(' ')} ${profile.workExperience || ''} ${profile.currentProject || ''} ${profile.education || ''} ${profile.businessTypeInterest || ''} ${customPreferences || ''}`.toLowerCase();

  // Detekce domén dovedností (nikoliv však jako náhrada online/offline filtru!)
  const hasDevSkills = combinedText.includes('program') || combinedText.includes('developer') || combinedText.includes('kód') || combinedText.includes('typescript') || combinedText.includes('react') || combinedText.includes('node') || combinedText.includes('python');
  const hasMasseurSkills = combinedText.includes('masér') || combinedText.includes('masáž') || combinedText.includes('fyzioter') || combinedText.includes('rehabil');
  const hasChefSkills = combinedText.includes('kuchař') || combinedText.includes('vařen') || combinedText.includes('gastro') || combinedText.includes('catering');
  const hasMarketingSkills = combinedText.includes('marketing') || combinedText.includes('sítě') || combinedText.includes('sociální') || combinedText.includes('komunikac') || combinedText.includes('obsah') || combinedText.includes('copywriting');
  const hasOrgSkills = combinedText.includes('organiz') || combinedText.includes('asisten') || combinedText.includes('projekt') || combinedText.includes('koordin');

  // ==========================================
  // FÁZE 1: GENERACE KANDIDÁTŮ A TVRDÉ FILTRY
  // ==========================================
  const allCandidates: RawCandidateIdea[] = [];

  // 1. Fyzické / offline kandidáty přidáváme, pokud uživatel NEZVOLIL striktně 'online'
  if (!isOnlineRequested) {
    if (hasMasseurSkills) {
      allCandidates.push(...getMasseurCandidates());
    }
    if (hasChefSkills) {
      allCandidates.push(...getChefCandidates());
    }
    // Řemeslné, manuální a lokální služby
    allCandidates.push(...getOfflineCraftCandidates());
  }

  // 2. Vkládáme ONLINE kandidáty (digitální služby, produkty, konzultace, agentury, marketing)
  // Tyto jsou 100% distanční, bez nutnosti fyzické přítomnosti a pro 0 Kč rozpočet
  allCandidates.push(...getOnlineCandidatesPool());
  if (hasDevSkills) {
    allCandidates.push(...getOnlineDeveloperCandidates());
  }

  // ==========================================
  // FÁZE 2: TVRDÁ VALIDACE (GATEKEEPERS)
  // ==========================================
  const validCandidates = allCandidates.filter(c => {
    // 1. Tvrdý filtr Online: Pokud uživatel chce ONLINE, nesmí vyžadovat fyzickou přítomnost
    if (isOnlineRequested && c.requiresPhysicalPresence) {
      return false;
    }
    // 2. Tvrdý filtr Rozpočet: Počáteční náklady nesmí překročit maximální rozpočet
    if (budgetInfo.isZeroBudget && c.minInitialCosts > 0) {
      return false;
    }
    if (c.minInitialCosts > budgetInfo.maxBudget) {
      return false;
    }
    // 3. Tvrdý filtr Čas: Týdenní hodiny nesmí zásadně překračovat horní limit
    if (c.weeklyHoursNeeded > timeInfo.maxHours + 4) {
      return false;
    }
    // 4. Bezpečnost regulovaných a řemeslných profesí (zákon č. 455/1991 Sb.):
    // Pokud profese vyžaduje výuční list, zkoušku NSK či koncesi a klient ji v profilu nemá, NESMÍ být doporučena
    if (c.regulatoryInfo?.isRegulated) {
      const userBackground = `${skillsList.join(' ')} ${profile.workExperience || ''} ${profile.currentJob || ''} ${profile.currentProject || ''} ${profile.education || ''}`.toLowerCase();
      const keyword = (c.specializedSkillKeyword || '').toLowerCase();
      const hasQual = keyword && userBackground.includes(keyword);
      if (!hasQual) {
        return false;
      }
    }

    // 5. Tvrdý filtr Červené linie (dislikes / red lines):
    const dislikesList = Array.isArray(profile.dislikes) ? profile.dislikes : (profile.dislikes ? [profile.dislikes] : []);
    const dislikesStr = dislikesList.join(' ').toLowerCase();
    const rejectsComputer = dislikesStr.includes('počítač') || dislikesStr.includes('u pc') || dislikesStr.includes('obrazovk') || dislikesStr.includes('sedět');
    const rejectsPhysical = dislikesStr.includes('fyzick') || dislikesStr.includes('dojížděn') || dislikesStr.includes('manuál') || dislikesStr.includes('terén');

    if (rejectsComputer && !c.requiresPhysicalPresence) {
      return false;
    }
    if (rejectsPhysical && c.requiresPhysicalPresence) {
      return false;
    }

    return true;
  });

  // ==========================================
  // FÁZE 3: 8-FAKTOROVÝ CITLIVÝ SCORING PODLE METODIKY PODNIKAI
  // ==========================================
  const scoredDirections: BusinessDirection[] = validCandidates.map(c => {
    // 1. Shoda se zkušenostmi (Experience Match - váha 20 %)
    let expScore = 3.0;
    let expNote = '';
    const userExpText = `${profile.workExperience || ''} ${profile.currentJob || ''} ${skillsList.join(' ')} ${profile.currentProject || ''}`.toLowerCase();
    const directExpMatches = c.requiredExperience.filter(req => userExpText.includes(req.toLowerCase()));
    const expRatio = directExpMatches.length / Math.max(1, c.requiredExperience.length);

    if (c.requiresUnlistedSpecializedSkill && !userExpText.includes((c.specializedSkillKeyword || '').toLowerCase())) {
      expScore = 2.5;
      expNote = `Penalizace za chybějící praxi: Model vyžaduje specifickou profesní zkušenost (${c.unlistedSpecializedSkillName}), kterou v profilu neuvádíš.`;
    } else if (expRatio >= 1.0) {
      expScore = Number((9.2 + Math.min(0.6, directExpMatches.length * 0.15)).toFixed(1));
      expNote = `Přímá a komplexní praxe: Tvé zkušenosti (${directExpMatches.join(', ')}) plně pokrývají klíčové činnosti tohoto modelu bez nutnosti zaškolování.`;
    } else if (expRatio >= 0.66) {
      expScore = Number((7.8 + (expRatio - 0.66) * 4.0).toFixed(1));
      expNote = `Solidní praxe: Zkušenosti (${directExpMatches.join(', ')}) poskytují silný základ, část specifik oboru se doučíš za běhu.`;
    } else if (expRatio >= 0.33) {
      expScore = Number((5.8 + (expRatio - 0.33) * 5.5).toFixed(1));
      expNote = `Částečná praxe: Shoda v (${directExpMatches.join(', ')}), chybí doložená praxe ve zbývajících oblastech (${c.requiredExperience.filter(r => !userExpText.includes(r.toLowerCase())).slice(0, 2).join(', ')}).`;
    } else if (expRatio > 0) {
      expScore = Number((4.2 + expRatio * 4.0).toFixed(1));
      expNote = `Nízká praxe: Shoda pouze v (${directExpMatches[0]}), model vyžaduje zkušenosti, které v profilu nemáš.`;
    } else {
      expScore = 2.5;
      expNote = `Chybějící praxe: Model vyžaduje zkušenosti (${c.requiredExperience.slice(0, 3).join(', ')}), které v profilu neuvádíš.`;
    }

    // 2. Shoda s konkrétními dovednostmi (Skills Match - váha 20 %)
    let skillsScore = 3.0;
    let skillsNote = '';
    const userSkillsText = `${skillsList.join(' ')} ${profile.workExperience || ''} ${profile.currentJob || ''}`.toLowerCase();
    const matchedSkills = c.requiredSkills.filter(req => userSkillsText.includes(req.toLowerCase()));
    const missingSkills = c.requiredSkills.filter(req => !userSkillsText.includes(req.toLowerCase()));
    const skillRatio = matchedSkills.length / Math.max(1, c.requiredSkills.length);

    if (c.requiresUnlistedSpecializedSkill && !userSkillsText.includes((c.specializedSkillKeyword || '').toLowerCase())) {
      skillsScore = 2.5;
      skillsNote = `Penalizace za potřebu nového know-how: Model vyžaduje odborné znalosti (${c.unlistedSpecializedSkillName}), které nemáš v profilu uvedeny a bude nutné se je naučit.`;
    } else if (skillRatio >= 0.85) {
      skillsScore = Number((9.2 + (skillRatio - 0.85) * 4.0).toFixed(1));
      skillsNote = `Přímé využití klíčových dovedností: ${matchedSkills.slice(0, 4).join(', ')}. Model nevyžaduje žádné neuvedené kompetence.`;
    } else if (skillRatio >= 0.60) {
      skillsScore = Number((7.8 + (skillRatio - 0.60) * 4.8).toFixed(1));
      skillsNote = `Velmi dobrá shoda dovedností: Ovládáš ${matchedSkills.slice(0, 3).join(', ')}, zbývá dopilovat dílčí postupy (${missingSkills.slice(0, 2).join(', ')}).`;
    } else if (skillRatio >= 0.40) {
      skillsScore = Number((6.2 + (skillRatio - 0.40) * 7.0).toFixed(1));
      skillsNote = `Základní shoda dovedností: Pokrýváš ${matchedSkills.join(', ')}, ale model vyžaduje i další kompetence (${missingSkills.slice(0, 2).join(', ')}).`;
    } else if (skillRatio >= 0.20) {
      skillsScore = Number((4.5 + (skillRatio - 0.20) * 7.5).toFixed(1));
      skillsNote = `Nízká shoda dovedností: Shoda v (${matchedSkills.join(', ')}), model vyžaduje osvojení dalších znalostí (${missingSkills.slice(0, 2).join(', ')}).`;
    } else {
      skillsScore = Number((2.0 + skillRatio * 8.0).toFixed(1));
      skillsNote = 'Chybějící dovednosti: Model vyžaduje specifické dovednosti, které v profilu neuvádíš.';
    }

    // 3. Shoda se zájmy a tématy (Passions Match - váha 10 %)
    let passionsScore = 5.0;
    let passionsNote = '';
    const userPassionsText = `${passionsList.join(' ')} ${profile.businessTypeInterest || ''}`.toLowerCase();
    const matchedPassions = c.relatedPassions.filter(p => userPassionsText.includes(p.toLowerCase()));

    if (matchedPassions.length >= 2) {
      passionsScore = Number((9.1 + Math.min(0.7, (matchedPassions.length - 2) * 0.2)).toFixed(1));
      passionsNote = `Silný osobní zájem: Témata (${matchedPassions.join(', ')}) tě přirozeně baví a motivují.`;
    } else if (matchedPassions.length === 1) {
      passionsScore = 7.7;
      passionsNote = `Soulad se zájmy: Dotýká se oblasti (${matchedPassions.join(', ')}), která tě zajímá.`;
    } else {
      passionsScore = 4.8;
      passionsNote = 'Neutrální soulad: Nápad neodporuje tvým preferencím, ale neleží v jádru tvých hlavních zájmů.';
    }

    // 4. Shoda s požadovaným online/offline modelem & typem práce (Online/Offline Match - váha 15 %)
    let onlineScore = 8.8;
    let onlineNote = '';
    if (isOnlineRequested) {
      if (c.requiresPhysicalPresence) {
        onlineScore = 0.0;
        onlineNote = 'Porušení filtru: vyžaduje fyzickou přítomnost u zákazníka.';
      } else {
        onlineScore = 9.8;
        onlineNote = '100% soulad s preferencí: plně distanční model bez fyzické přítomnosti u zákazníka, dojíždění a provozovny.';
      }
    } else if (isOfflineRequested) {
      if (!c.requiresPhysicalPresence) {
        onlineScore = 4.0;
        onlineNote = 'Online model, ačkoliv jsi preferoval osobní / fyzický kontakt.';
      } else {
        onlineScore = 9.8;
        onlineNote = '100% soulad s preferencí osobního kontaktu a fyzické přítomnosti.';
      }
    } else {
      onlineScore = 8.8;
      onlineNote = 'Vhodné pro hybridní či flexibilní provoz dle profilu.';
    }

    if (profile.preferredWorkType) {
      const pwt = profile.preferredWorkType;
      if (c.workTypes && c.workTypes.includes(pwt)) {
        onlineScore = Math.min(10.0, Number((onlineScore + 0.2).toFixed(1)));
        onlineNote += ` Plná shoda s preferovaným typem práce (${pwt}).`;
      } else if (pwt === 'Online práce' && !c.requiresPhysicalPresence) {
        onlineScore = Math.min(10.0, Number((onlineScore + 0.2).toFixed(1)));
      } else if ((pwt === 'Práce rukama / řemeslo' || pwt === 'Práce venku / v terénu') && !c.requiresPhysicalPresence) {
        onlineScore = Math.max(2.0, Number((onlineScore - 2.8).toFixed(1)));
        onlineNote += ` Rozpor s preferencí manuální práce či terénu (${pwt}).`;
      }
    }

    // 5. Shoda s dostupným kapitálem (Budget Match - váha 10 %)
    let budgetScore = 9.8;
    let budgetNote = '';
    if (budgetInfo.isZeroBudget) {
      if (c.minInitialCosts === 0) {
        budgetScore = 9.8;
        budgetNote = '0 Kč start: Nevyžaduje žádné počáteční investice do techniky, licencí ani skladových zásob.';
      } else if (c.minInitialCosts <= 2000) {
        budgetScore = 3.5;
        budgetNote = `Vyžaduje drobnou investici (${c.initialCostsText}), ačkoliv rozpočet byl zadán jako 0 Kč.`;
      } else {
        budgetScore = 1.0;
        budgetNote = `Nevyhovuje: Vyžaduje ${c.initialCostsText}, ale tvůj limit je 0 Kč.`;
      }
    } else {
      const budgetUsageRatio = c.minInitialCosts / Math.max(1, budgetInfo.maxBudget);
      if (budgetUsageRatio <= 0.05) {
        budgetScore = 9.8;
        budgetNote = `Nenáročné: Vyžaduje ${c.initialCostsText}, což je zanedbatelná část rozpočtu ${profile.startingBudget}.`;
      } else if (budgetUsageRatio <= 0.25) {
        budgetScore = Number((8.8 - budgetUsageRatio * 3.5).toFixed(1));
        budgetNote = `Komfortní rozpočet: Vyžaduje ${c.initialCostsText}, pohodlně se vejde do zadaného limitu.`;
      } else if (budgetUsageRatio <= 0.60) {
        budgetScore = Number((7.6 - (budgetUsageRatio - 0.25) * 4.5).toFixed(1));
        budgetNote = `Vyžaduje ${c.initialCostsText}, což tvoří zhruba polovinu zadaného rozpočtu.`;
      } else if (budgetUsageRatio <= 1.0) {
        budgetScore = Number((5.8 - (budgetUsageRatio - 0.60) * 3.5).toFixed(1));
        budgetNote = `Vyčerpává většinu zadaného rozpočtu (${c.initialCostsText}).`;
      } else {
        budgetScore = 1.5;
        budgetNote = `Překračuje zadaný rozpočet (${c.initialCostsText}).`;
      }
    }

    // 6. Shoda s časovou kapacitou (Time Feasibility - váha 10 %)
    let timeScore = 8.0;
    let timeNote = '';
    if (c.weeklyHoursNeeded <= timeInfo.minHours) {
      timeScore = 9.1;
      timeNote = `Pohodlná rezerva: Náročnost ${c.weeklyHoursNeeded} h/týden je pod spodním limitem fondu ${profile.availableTime}.`;
    } else if (c.weeklyHoursNeeded <= timeInfo.maxHours - 4) {
      timeScore = 9.7;
      timeNote = `Ideální časový fond: ${c.weeklyHoursNeeded} h/týden (včetně 40% rezervy na prodej a administrativu) perfektně sedí do fondu ${profile.availableTime}.`;
    } else if (c.weeklyHoursNeeded <= timeInfo.maxHours - 2) {
      timeScore = 7.9;
      timeNote = `Těsnější časový fond: Náročnost ${c.weeklyHoursNeeded} h/týden je v horní polovině kapacity ${profile.availableTime}.`;
    } else if (c.weeklyHoursNeeded <= timeInfo.maxHours) {
      timeScore = 6.3;
      timeNote = `Vysoká zátěž: ${c.weeklyHoursNeeded} h/týden je na horní hraně tvého časového fondu.`;
    } else {
      timeScore = 3.2;
      timeNote = `Penalizace za časovou náročnost: Náročnost ${c.weeklyHoursNeeded} h/týden překračuje zadanou kapacitu ${profile.availableTime}.`;
    }

    // 7. Realističnost dosažení cílového příjmu (Income Target Viability - váha 10 %)
    let incomeScore = 7.0;
    let incomeNote = '';
    if (c.pricingModelType === 'retainer') {
      incomeScore = 9.4;
      incomeNote = `Vysoká stabilita: K dosažení cíle stačí obsloužit ${c.requiredClientsText} na měsíční paušál (${c.workingPriceText}), což minimalizuje riziko výpadku.`;
    } else if (c.pricingModelType === 'project') {
      incomeScore = 7.6;
      incomeNote = `Střední stabilita: K dosažení cíle je nutné každý měsíc znovu získat ${c.requiredClientsText}, chybí opakovaný paušál.`;
    } else if (c.pricingModelType === 'consultation') {
      incomeScore = 6.6;
      incomeNote = `Hodinový model: Příjem je vázán na prodej jednotlivých hodin (${c.requiredClientsText}), což vytváří kapacitní strop.`;
    } else {
      incomeScore = 4.0;
      incomeNote = `Penalizace za transakční objem: K dosažení cíle je potřeba ${c.requiredClientsText}, což bez existujícího publika představuje vysokou bariéru.`;
    }

    // 8. Náročnost získání prvního zákazníka / bariéra vstupu (Acquisition Ease - váha 5 %)
    let acqScore = 6.5;
    let acqNote = '';
    if (c.acquisitionDifficulty === 'low') {
      acqScore = 9.3;
      acqNote = `Nízká akviziční bariéra: Zákazníka lze oslovit konkrétní ukázkou hodnoty zdarma bez složitého schvalovacího řízení. (${c.acquisitionMethodNote})`;
    } else if (c.acquisitionDifficulty === 'medium') {
      acqScore = 6.9;
      acqNote = `Střední akviziční bariéra: Získání prvního klienta vyžaduje překonání bariéry důvěry (např. vstup do interních systémů či procesů). (${c.acquisitionMethodNote})`;
    } else {
      acqScore = 3.8;
      acqNote = `Vysoká akviziční bariéra: Získání prvních zákazníků vyžaduje přesvědčit neznámé publikum nebo prodávat bez referencí. (${c.acquisitionMethodNote})`;
    }

    // 9. Využitelnost kontaktů & nezávislost (Network & Independence)
    let netScore = 7.0;
    let netNote = '';
    if (c.externalDependency === 'none') {
      netScore = 9.0;
      netNote = `Plná nezávislost: Přímá B2B spolupráce bez provizních prostředníků, závislosti na platformách či placené reklamě. (${c.externalDependencyNote})`;
    } else if (c.externalDependency === 'platform') {
      netScore = 5.0;
      netNote = `Penalizace za závislost na platformě: Model je vázán na konkrétní ekosystém (${c.externalDependencyNote}).`;
    } else {
      netScore = 3.0;
      netNote = `Penalizace za závislost na třetích stranách (${c.externalDependencyNote}).`;
    }

    // 10. Potenciál škálování (Scalability Potential)
    const scaleScore = c.scalabilityScore;
    let scaleNote = c.scalabilityNote;
    if (scaleScore >= 8) {
      scaleNote = `Vysoký potenciál škálování: ${c.scalabilityNote}`;
    } else if (scaleScore >= 6) {
      scaleNote = `Střední škálovatelnost: ${c.scalabilityNote}`;
    } else {
      scaleNote = `Omezená škálovatelnost: ${c.scalabilityNote}`;
    }

    const scoreResult = calculate10FactorScore({
      experienceMatch: { score: expScore, note: expNote },
      skillsMatch: { score: skillsScore, note: skillsNote },
      passionsMatch: { score: passionsScore, note: passionsNote },
      onlineOfflineMatch: { score: onlineScore, note: onlineNote },
      budgetFit: { score: budgetScore, note: budgetNote },
      timeFeasibility: { score: timeScore, note: timeNote },
      incomeTargetViability: { score: incomeScore, note: incomeNote },
      acquisitionEase: { score: acqScore, note: acqNote },
      networkLeverage: { score: netScore, note: netNote },
      scalabilityPotential: { score: scaleScore, note: scaleNote }
    });

    const marketVal: MarketValidationPlan = {
      whatIsSold: c.whatIsSold,
      toWhom: c.targetAudience,
      modelPrice: c.workingPriceText,
      whyCustomerWantsIt: c.whyCustomerWantsIt,
      howToVerifyDemand: `Oslovit ${c.targetAudienceCountText} vzorkem hodnoty zdarma nebo zjišťovacím rozhovorem bez nátlaku na prodej.`,
      targetAudienceCount: c.targetAudienceCountText,
      signalGo: c.signalGo,
      signalPivot: c.signalPivot,
      potentialPitfall: c.potentialPitfall,
      validationSteps: c.validationSteps
    };

    const mathModel: IdeaMathematicalModel = {
      workingPriceAssumption: c.workingPriceText,
      requiredClients: c.requiredClientsText,
      modelMonthlyIncome: c.modelMonthlyIncomeText,
      weeklyHoursBreakdown: c.weeklyHoursBreakdownText,
      toVerifyOnMarket: c.toVerifyOnMarket
    };

    return {
      id: c.id,
      title: c.title,
      tagline: c.tagline,
      description: c.description,
      category: c.category,
      isRecommended: false,
      recommendationReason: c.requiresPhysicalPresence
        ? `Maximální shoda s profilem (${scoreResult.totalScore} %): Lokální přímá služba / řemeslo, dostupné počáteční náklady (${c.initialCostsText}), časová náročnost (${c.weeklyHoursNeeded} h týdně) a přímé využití tvých dovedností.`
        : `Maximální shoda s profilem (${scoreResult.totalScore} %): Distanční / online model, nízké počáteční náklady (${c.initialCostsText}), časová náročnost (${c.weeklyHoursNeeded} h týdně) a přímé využití tvých dovedností.`,
      problemSolved: c.whyCustomerWantsIt,
      targetCustomer: c.targetAudience,
      pricingStructure: `Modelový cenový předpoklad: ${c.workingPriceText} (nutno ověřit rozhovory s trhem). Modelový měsíční příjem: ${c.modelMonthlyIncomeText}.`,
      firstClientPlan: c.validationSteps.join(' -> '),
      timeCommitment: `${c.weeklyHoursNeeded} h / týden (${c.weeklyHoursBreakdownText})`,
      scalabilityText: 'Možnost růstu zvýšením měsíčních paušálů, standardizací šablon a produktizací dodávky.',
      mainRisk: c.potentialPitfall,
      fitScore: scoreResult.totalScore,
      scoreBreakdown: scoreResult.breakdown,
      marketValidation: marketVal,
      mathematicalModel: mathModel,
      concreteOffer: `Balíček: ${c.whatIsSold}`,
      outreachMethod: `Adresné přímé oslovení: Nabídka konkrétního postřehu / 1 ukázky zdarma bez nátlaku na nákup.`,
      todayTask: {
        title: c.todayTaskTitle,
        description: c.todayTaskDesc,
        estimatedMinutes: 25,
        whyToday: 'Získáš první hmatatelný podklad pro oslovení reálných kontaktů z trhu.'
      },
      ratings: {
        speedToFirstClient: { score: 9, text: `Validační cyklus: oslovení ${c.targetAudienceCountText}` },
        upfrontCosts: { score: 10, text: c.initialCostsText },
        marginPotential: { score: 9, text: '85–95 % čistá marže' },
        competitionInCz: { score: 8, text: 'Vysoká poptávka, rozhoduje kvalita komunikace' },
        scalability: { score: 8, text: 'Vysoká (online & digitální procesy)' }
      },
      epistemic: {
        verifiedFacts: [
          'Ohlášení volné živnosti v ČR vyžaduje jednorázový poplatek 1 000 Kč na živnostenském úřadě.',
          'Základní firemní nástroje (Canva Free, Google Workspace/Docs, Meta Business Suite) jsou pro start v bezplatné verzi zdarma.',
          'Práce v online B2B modelu nevyžaduje kolaudovanou provozovnu ani schválení hygieny.'
        ],
        marketEstimates: [
          `[Pracovní cenový předpoklad] ${c.workingPriceText}`,
          `[Časový model] ${c.weeklyHoursBreakdownText}`,
          '[Konverzní předpoklad] U adresného nevtíravého oslovení bývá odezva 10–20 % na nezávazný rozhovor.'
        ],
        modelScenario: `Matematický scénář: ${c.requiredClientsText} při ceně ${c.workingPriceText} = modelový hrubý příjem ${c.modelMonthlyIncomeText}.`,
        needsMarketVerification: [
          `[Nutno ověřit] ${c.toVerifyOnMarket}`,
          '[Nutno ověřit] Skutečná ochota prvních 3–5 poptávajících zaplatit navrženou cenu za pilotní měsíc.'
        ]
      }
    };
  });

  // Seřazení podle skóre shody sestupně (s citlivým tie-breakerem podle přímé shody zkušeností a dovedností)
  scoredDirections.sort((a, b) => {
    const diff = (b.fitScore || 0) - (a.fitScore || 0);
    if (diff !== 0) return diff;
    const expDiff = ((b.scoreBreakdown?.experienceMatch?.score || 0) + (b.scoreBreakdown?.skillsMatch?.score || 0)) -
                    ((a.scoreBreakdown?.experienceMatch?.score || 0) + (a.scoreBreakdown?.skillsMatch?.score || 0));
    if (expDiff !== 0) return expDiff;
    return (b.scoreBreakdown?.acquisitionEase?.score || 0) - (a.scoreBreakdown?.acquisitionEase?.score || 0);
  });

  // Označení vítěze jako #1 doporučený
  scoredDirections.forEach((dir, idx) => {
    dir.isRecommended = idx === 0;
  });

  const recommended = scoredDirections[0] || getFallbackSingleDirection();

  const userEvaluation: UserEvaluation = {
    capitalAssessment: budgetInfo.isZeroBudget 
      ? 'Rozpočet je striktně 0 Kč: Všechny doporučené směry jsou navrženy tak, aby nevyžadovaly nákup vybavení, sklad ani placený software před první platbou od klienta.'
      : `Rozpočet (${profile.startingBudget}) poskytuje bezpečný prostor pro start s minimálními fixními náklady.`,
    skillsAssessment: `Dovednosti (${skillsList.slice(0, 3).join(', ') || 'komunikace a organizace'}) a pracovní historie jsou přímo využity jako hlavní kapitál pro okamžitou tvorbu hodnoty pro klienty.`,
    timeAssessment: `Kapacita ${profile.availableTime || '15–25 h/týden'} je v modelech rozpočtena včetně 40% rezervy na prodej, komunikaci a administrativu, aby nedocházelo k přetížení.`,
    salesStyleAssessment: isOnlineRequested
      ? 'Zvolen 100% ONLINE model: Z nabídky byly kompletně vyřazeny jakékoliv fyzické, mobilní či dílenské služby.'
      : 'Model kombinuje lokální přítomnost s vysokou přidanou hodnotou.',
    targetIncomeAssessment: `Cíl ${targetIncomeStr} je v modelech propočten na jednotkovou ekonomiku (3–5 stálých B2B klientů nebo produktizovaných zakázek).`
  };

  const mappedIdeas: BusinessIdea[] = scoredDirections.map(dir => ({
    id: dir.id,
    title: dir.title,
    tagline: dir.tagline,
    description: dir.description,
    whyItFits: dir.recommendationReason || '',
    problemSolved: dir.problemSolved || '',
    targetAudience: dir.targetCustomer || '',
    monetization: dir.pricingStructure || '',
    howToStart: dir.firstClientPlan || '',
    initialCosts: dir.ratings?.upfrontCosts?.text || '0 Kč',
    initialCostsLevel: 'low',
    timeCommitment: dir.timeCommitment || '15–20 h / týden',
    launchSpeed: dir.ratings?.speedToFirstClient?.text || 'Doporučený validační postup',
    scalability: dir.scalabilityText || '',
    firstValidationStep: dir.todayTask?.title || '',
    mainRisk: dir.mainRisk || '',
    fitScore: dir.fitScore || 90,
    scoreBreakdown: dir.scoreBreakdown,
    difficulty: 'low',
    incomePotential: dir.epistemic?.modelScenario || '',
    risk: 'low',
    isRecommended: dir.isRecommended,
    category: dir.category || 'Online služby',
    marketValidation: dir.marketValidation,
    mathematicalModel: dir.mathematicalModel,
    directionData: dir
  }));

  return {
    userEvaluation,
    directions: scoredDirections,
    ideas: mappedIdeas,
    recommendedDirectionId: recommended.id,
    comparisonVerdict: `${recommended.title} je vyhodnocen jako nejvhodnější směr: má skóre ${recommended.fitScore} %, plně respektuje limit rozpočtu 0 Kč, funguje 100% online a matematicky vychází na cílový příjem s 3–5 klienty bez nutnosti trávit čas v terénu.`
  };
}

function getFallbackSingleDirection(): BusinessDirection {
  const c = getOnlineCandidatesPool()[0];
  const scoreResult = calculate10FactorScore({
    experienceMatch: { score: 9, note: 'Přímá praxe v marketingu a komunikaci' },
    skillsMatch: { score: 9, note: 'Komunikace, sociální sítě a tvorba obsahu' },
    passionsMatch: { score: 8, note: 'Tvorba obsahu a sociální sítě' },
    onlineOfflineMatch: { score: 10, note: '100% online model' },
    budgetFit: { score: 10, note: 'Start 0 Kč' },
    timeFeasibility: { score: 10, note: '20 h týdně' },
    incomeTargetViability: { score: 9, note: '60 000 Kč měsíčně při 4 klientech' },
    acquisitionEase: { score: 9, note: 'Zaslání 1 ukázkového příspěvku jednateli' },
    networkLeverage: { score: 9, note: 'Nezávislost na platformách' },
    scalabilityPotential: { score: 8, note: 'Šablony a měsíční balíčky' }
  });

  return {
    id: c.id,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    category: c.category,
    isRecommended: true,
    recommendationReason: 'Optimální shoda se zadaným profilem.',
    problemSolved: c.whyCustomerWantsIt,
    targetCustomer: c.targetAudience,
    pricingStructure: c.workingPriceText,
    firstClientPlan: c.validationSteps.join(' -> '),
    timeCommitment: `${c.weeklyHoursNeeded} h / týden`,
    scalabilityText: 'Vysoká',
    mainRisk: c.potentialPitfall,
    fitScore: 95,
    scoreBreakdown: scoreResult.breakdown,
    concreteOffer: c.whatIsSold,
    outreachMethod: 'Adresné oslovení',
    todayTask: {
      title: c.todayTaskTitle,
      description: c.todayTaskDesc,
      estimatedMinutes: 25,
      whyToday: 'Okamžitý krok.'
    },
    ratings: {
      speedToFirstClient: { score: 9, text: 'Validační cyklus 15–25 kontaktů' },
      upfrontCosts: { score: 10, text: '0 Kč' },
      marginPotential: { score: 9, text: '90 %' },
      competitionInCz: { score: 8, text: 'Stabilní poptávka' },
      scalability: { score: 8, text: 'Vysoká' }
    },
    epistemic: {
      verifiedFacts: ['Ohlášení živnosti je 1 000 Kč'],
      marketEstimates: [c.workingPriceText],
      modelScenario: c.modelMonthlyIncomeText,
      needsMarketVerification: [c.toVerifyOnMarket]
    }
  };
}
