import {
  BusinessStartQuestionnaire,
  BusinessStartDirectionCandidate
} from '../types';

export type WorkTypeCategory =
  | 'physical_personal_local' // Fyzická práce / řemeslo / práce s lidmi osobně / vlastní provozovna / studio
  | 'online_only'             // 100% online / PC
  | 'combination'             // Kombinace více typů práce
  | 'undetermined';           // Nevím / ještě nemám vyhraněno

export type ClientDomain =
  | 'makeup'        // vizážistka, líčení, kosmetika, beauty
  | 'masseur'       // masér, masáže, masérské studio, regenerace
  | 'craft_mason'   // zedník, obkladač, stavební práce
  | 'craft_other'   // truhlář, instalatér, elektrikář, úklid, zahrada, kadeřník, trenér, řemeslo
  | 'marketing'     // online marketing, správa sítí, copywriting
  | 'it'            // programování, web development, IT podpora
  | 'general';      // ostatní / všeobecné zaměření

export interface ClientHardConstraints {
  // 1. SOURCE OF TRUTH
  rawGoal: string;
  rawCareer: string;
  rawPreferredWorkType: string;
  rawCustomWorkType: string;
  rawOperatingModel: string;
  rawStartingCapital: string;
  rawTimeCommitment: string;
  rawRedLines: string[];
  rawSkills: string[];

  // 2. CLIENT GOAL & DOMAIN
  detectedDomain: ClientDomain;
  goalHighlightsDomain: boolean;

  // 3. PREFERRED WORK TYPE & CATEGORY
  effectiveWorkType: string;
  isCustomTextPriority: boolean;
  category: WorkTypeCategory;
  isPhysicalPersonalLocal: boolean;
  isOnlineOnly: boolean;
  isCombination: boolean;
  isUndetermined: boolean;

  // 4. RED LINES / ODMÍTNUTÉ ČINNOSTI
  rejectsComputer: boolean;
  rejectsPhysical: boolean;
  rejectsColdCalling: boolean;

  // 5. HARD FILTER RULES
  forbiddenModelTypes: string[];
  allowedModelTypes: string[];
  reason: string;
}

/**
 * 1. SOURCE OF TRUTH + 2. CLIENT GOAL + 3. PREFERRED WORK TYPE + 4. RED LINES
 * Evaluates raw questionnaire inputs strictly respecting user priority:
 * Custom text > Pre-selected option.
 */
export function evaluateClientConstraints(q: BusinessStartQuestionnaire): ClientHardConstraints {
  const goalLower = (q.mainGoal || '').toLowerCase().trim();
  const careerLower = (q.currentCareerSituation || '').toLowerCase().trim();
  const skillsLower = (Array.isArray(q.coreSkillsAndExpertise) ? q.coreSkillsAndExpertise.join(' ') : String(q.coreSkillsAndExpertise || '')).toLowerCase().trim();
  const passionsLower = (Array.isArray(q.passionsAndInterests) ? q.passionsAndInterests.join(' ') : String(q.passionsAndInterests || '')).toLowerCase().trim();
  const rawRedLines = Array.isArray(q.strictDislikesAndRedLines) ? q.strictDislikesAndRedLines : (typeof q.strictDislikesAndRedLines === 'string' ? (q.strictDislikesAndRedLines as string).split(',').map(s => s.trim()).filter(Boolean) : []);
  const dislikesLower = (Array.isArray(q.strictDislikesAndRedLines) ? q.strictDislikesAndRedLines.join(' ') : String(q.strictDislikesAndRedLines || '')).toLowerCase().trim();

  // Custom text has ABSOLUTE priority over pre-selected option
  const hasCustomText = Boolean(q.customPreferredWorkType && q.customPreferredWorkType.trim());
  const effectiveWorkType = hasCustomText
    ? q.customPreferredWorkType.trim()
    : (q.preferredWorkType || 'Nevím / ještě nemám vyhraněno').trim();
  const workTypeLower = effectiveWorkType.toLowerCase();

  // 2. CLIENT GOAL DOMAIN DETECTION
  let detectedDomain: ClientDomain = 'general';
  const combinedGoalAndContext = `${goalLower} ${careerLower} ${skillsLower} ${passionsLower} ${workTypeLower}`;

  if (
    combinedGoalAndContext.includes('vizážist') ||
    combinedGoalAndContext.includes('líčení') ||
    combinedGoalAndContext.includes('make-up') ||
    combinedGoalAndContext.includes('makeup') ||
    combinedGoalAndContext.includes('kosmetik') ||
    combinedGoalAndContext.includes('beauty')
  ) {
    detectedDomain = 'makeup';
  } else if (
    combinedGoalAndContext.includes('masér') ||
    combinedGoalAndContext.includes('masáž') ||
    combinedGoalAndContext.includes('fyzioter') ||
    combinedGoalAndContext.includes('rehabil') ||
    (combinedGoalAndContext.includes('studio') && combinedGoalAndContext.includes('masér'))
  ) {
    detectedDomain = 'masseur';
  } else if (
    combinedGoalAndContext.includes('zedn') ||
    combinedGoalAndContext.includes('obklad') ||
    combinedGoalAndContext.includes('rekonstrukce') ||
    combinedGoalAndContext.includes('stavebn')
  ) {
    detectedDomain = 'craft_mason';
  } else if (
    combinedGoalAndContext.includes('truhlář') ||
    combinedGoalAndContext.includes('stolař') ||
    combinedGoalAndContext.includes('instalatér') ||
    combinedGoalAndContext.includes('elektrik') ||
    combinedGoalAndContext.includes('úklid') ||
    combinedGoalAndContext.includes('čištěn') ||
    combinedGoalAndContext.includes('zahrad') ||
    combinedGoalAndContext.includes('zeleň') ||
    combinedGoalAndContext.includes('kadeřn') ||
    combinedGoalAndContext.includes('barber') ||
    combinedGoalAndContext.includes('trenér') ||
    combinedGoalAndContext.includes('fitness') ||
    combinedGoalAndContext.includes('fotograf') ||
    combinedGoalAndContext.includes('řemesl')
  ) {
    detectedDomain = 'craft_other';
  } else if (
    combinedGoalAndContext.includes('online marketing') ||
    combinedGoalAndContext.includes('sociální sítě') ||
    combinedGoalAndContext.includes('copywriting') ||
    combinedGoalAndContext.includes('marketing')
  ) {
    detectedDomain = 'marketing';
  } else if (
    combinedGoalAndContext.includes('program') ||
    combinedGoalAndContext.includes('developer') ||
    combinedGoalAndContext.includes('kód')
  ) {
    detectedDomain = 'it';
  }

  // 4. RED LINES EVALUATION
  const rejectsComputer =
    dislikesLower.includes('počítač') ||
    dislikesLower.includes('u pc') ||
    dislikesLower.includes('obrazovk') ||
    dislikesLower.includes('sedět') ||
    dislikesLower.includes('práce na pc') ||
    dislikesLower.includes('celý den u pc');

  const rejectsPhysical =
    dislikesLower.includes('fyzick') ||
    dislikesLower.includes('dojížděn') ||
    dislikesLower.includes('manuál') ||
    dislikesLower.includes('terén');

  const rejectsColdCalling =
    dislikesLower.includes('cold') ||
    dislikesLower.includes('studené') ||
    dislikesLower.includes('navoláv');

  // 3. PREFERRED WORK TYPE & CATEGORY RESOLUTION (HARD CONSTRAINT)
  const indicatesPhysicalOrInPerson =
    workTypeLower.includes('fyzick') ||
    workTypeLower.includes('řemesl') ||
    workTypeLower.includes('terén') ||
    workTypeLower.includes('rukama') ||
    workTypeLower.includes('lidmi') ||
    workTypeLower.includes('osobně') ||
    workTypeLower.includes('provozovn') ||
    workTypeLower.includes('studio') ||
    workTypeLower.includes('dílna') ||
    workTypeLower.includes('salon') ||
    workTypeLower.includes('křeslo') ||
    workTypeLower.includes('masáž') ||
    workTypeLower.includes('líčení') ||
    workTypeLower.includes('vizáž');

  const indicatesOnline =
    workTypeLower.includes('100%') ||
    workTypeLower.includes('online') ||
    workTypeLower.includes('počítač') ||
    workTypeLower.includes('u pc');

  const indicatesCombination =
    workTypeLower.includes('kombinace') ||
    workTypeLower.includes('hybrid') ||
    workTypeLower.includes('více typů');

  const indicatesUndetermined =
    workTypeLower.includes('nevím') ||
    workTypeLower.includes('nevyhraněno') ||
    workTypeLower.includes('ještě nemám');

  // Check if goal or custom text explicitly targets physical service:
  // e.g. "Chci podnikat jako vizážistka", "Chci si otevřít vlastní masérské studio", "Chci podnikat jako zedník"
  const goalDemandsPhysicalPersonal =
    detectedDomain === 'makeup' ||
    detectedDomain === 'masseur' ||
    detectedDomain === 'craft_mason' ||
    detectedDomain === 'craft_other';

  const goalDemandsOnline =
    (detectedDomain === 'marketing' || detectedDomain === 'it') &&
    !indicatesPhysicalOrInPerson &&
    !rejectsComputer;

  let category: WorkTypeCategory = 'undetermined';
  let reason = '';

  // Apply precedence:
  // If client expresses physical/craft/in-person preference OR their goal is inherently physical/in-person (vizážistka, masér, zedník) AND they haven't explicitly asked for 100% online
  if (
    (indicatesPhysicalOrInPerson || goalDemandsPhysicalPersonal || rejectsComputer) &&
    !(indicatesOnline && !indicatesPhysicalOrInPerson && !goalDemandsPhysicalPersonal)
  ) {
    category = 'physical_personal_local';
    reason = hasCustomText
      ? `Vlastní text klienta (${effectiveWorkType}) a cíl (${q.mainGoal}) striktně požadují fyzickou, lokální či osobní službu.`
      : `Preferovaný typ práce (${effectiveWorkType}) a obor (${detectedDomain}) vyžadují výhradně osobní, fyzickou či lokální službu.`;
  } else if (indicatesOnline || goalDemandsOnline) {
    category = 'online_only';
    reason = `Klient preferuje 100% online/PC provoz (${effectiveWorkType}) a zaměření na digitální služby.`;
  } else if (indicatesCombination) {
    category = 'combination';
    reason = `Klient zvolil kombinaci více typů práce (${effectiveWorkType}).`;
  } else if (indicatesUndetermined) {
    category = 'undetermined';
    reason = `Klient zvolil možnost Nevím / ještě nemám vyhraněno (${effectiveWorkType}) bez vyhraněného oboru.`;
  } else {
    // Fallback: check operatingModel
    if (q.operatingModel === 'offline') {
      category = 'physical_personal_local';
      reason = 'Provozní model je striktně OFFLINE.';
    } else if (q.operatingModel === 'online' && !goalDemandsPhysicalPersonal) {
      category = 'online_only';
      reason = 'Provozní model je ONLINE bez fyzického zaměření.';
    } else {
      category = 'undetermined';
      reason = 'Vyvážený přístup pro nejednoznačné preference.';
    }
  }

  // 5. HARD FILTER SPECIFICATION: FORBIDDEN & ALLOWED MODEL TYPES
  const forbiddenModelTypes: string[] = [];
  const allowedModelTypes: string[] = [];

  if (category === 'physical_personal_local') {
    forbiddenModelTypes.push(
      'čistě online agentura',
      'čistě online služba (copywriting pro weby, virtuální asistence)',
      'SaaS / software / aplikace',
      'digitální produkt / e-booky / šablony',
      'online kurz jako hlavní doporučení',
      'affiliate marketing',
      'dropshipping',
      'čistě digitální produkt',
      'jakýkoliv model s hlavním poskytováním přes PC / online'
    );
    allowedModelTypes.push(
      'osobní / fyzická služba u klienta',
      'vlastní studio / salon / dílna / provozovna',
      'mobilní servis v terénu / dojezd za zákazníkem',
      'partnerská spolupráce se salony, ateliéry, SVJ či firmami',
      'lokální řemeslné a servisní práce',
      'prezenční osobní péče / kurzy 1 na 1'
    );
  } else if (category === 'online_only') {
    forbiddenModelTypes.push(
      'fyzické řemeslo a manuální práce v terénu',
      'kamenná provozovna vyžadující stálou fyzickou přítomnost',
      'fyzické sklady a logistika (pokud odmítnuto)'
    );
    allowedModelTypes.push(
      'online digitální služby',
      'online marketing a správa obsahu',
      'online konzultace a audity',
      'distanční projektové dodávky'
    );
  } else {
    allowedModelTypes.push(
      'lokální a osobní služby',
      'hybridní modely',
      'online digitální služby'
    );
  }

  return {
    rawGoal: q.mainGoal,
    rawCareer: q.currentCareerSituation || '',
    rawPreferredWorkType: q.preferredWorkType || '',
    rawCustomWorkType: q.customPreferredWorkType || '',
    rawOperatingModel: q.operatingModel,
    rawStartingCapital: q.startingCapital,
    rawTimeCommitment: q.weeklyTimeCommitment,
    rawRedLines,
    rawSkills: Array.isArray(q.coreSkillsAndExpertise)
      ? q.coreSkillsAndExpertise
      : (typeof q.coreSkillsAndExpertise === 'string'
          ? q.coreSkillsAndExpertise.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    detectedDomain,
    goalHighlightsDomain: goalDemandsPhysicalPersonal,
    effectiveWorkType,
    isCustomTextPriority: hasCustomText,
    category,
    isPhysicalPersonalLocal: category === 'physical_personal_local',
    isOnlineOnly: category === 'online_only',
    isCombination: category === 'combination',
    isUndetermined: category === 'undetermined',
    rejectsComputer,
    rejectsPhysical,
    rejectsColdCalling,
    forbiddenModelTypes,
    allowedModelTypes,
    reason
  };
}

/**
 * 5. HARD FILTER: Identifies whether a direction candidate represents an ONLINE-ONLY model.
 * These models are strictly prohibited as primary or candidate models when
 * category === 'physical_personal_local'.
 */
export function isOnlineOnlyBusinessModel(candidate: {
  title?: string;
  tagline?: string;
  businessModel?: string;
  whyMatch?: string;
}): boolean {
  const text = `${candidate.title || ''} ${candidate.tagline || ''} ${candidate.businessModel || ''} ${candidate.whyMatch || ''}`.toLowerCase();

  const onlineOnlyPatterns = [
    'online agentur',
    'digitální agentur',
    'marketingová agentur',
    'b2b digitální podpora',
    'automatizace procesů',
    'správa sociálních sítí',
    'organického obsahu',
    'obsahu & sociálních sítí',
    'sociálních sítí',
    'online marketing',
    'copywriting',
    'prodejních textů',
    'e-mailových sekvencí',
    'newsletter',
    'virtuální asisten',
    'virtuální administrativ',
    'saas',
    'softwar',
    'digitální produkt',
    'digitální informační',
    'provozních šablon',
    'online kurz',
    'webinář',
    'affiliate',
    'dropshipping',
    '100% online distanční',
    '100% distanční online',
    'plně distanční',
    'online služba (retainer)'
  ];

  return onlineOnlyPatterns.some(pattern => text.includes(pattern));
}

/**
 * Checks whether a candidate represents a physical, personal, or local service.
 */
export function isPhysicalPersonalLocalBusinessModel(candidate: {
  title?: string;
  tagline?: string;
  businessModel?: string;
  whyMatch?: string;
}): boolean {
  // Strip negated physical phrases like "bez fyzického dojíždění", "bez nutnosti dojíždět" before checking
  let text = `${candidate.title || ''} ${candidate.tagline || ''} ${candidate.businessModel || ''} ${candidate.whyMatch || ''}`.toLowerCase();
  text = text.replace(/bez\s+fyzick[^\s]*/g, '')
             .replace(/bez\s+dojížd[^\s]*/g, '')
             .replace(/bez\s+nutnosti\s+dojížd[^\s]*/g, '')
             .replace(/bez\s+osobní[^\s]*/g, '');

  const physicalPatterns = [
    'vizáž',
    'líčení',
    'make-up',
    'makeup',
    'svatební',
    'kosmetik',
    'beauty',
    'masér',
    'masáž',
    'regenerač',
    'rekondič',
    'studio',
    'salon',
    'lehátko',
    'zedn',
    'obklad',
    'stavebn',
    'rekonstrukce',
    'truhlář',
    'stolař',
    'instalatér',
    'elektrik',
    'úklid',
    'zahrad',
    'kadeřn',
    'barber',
    'fyzick',
    'lokální',
    'terén',
    'osobní',
    'dojezd',
    'mobilní',
    'u zákazníka',
    'provozovn'
  ];

  return physicalPatterns.some(pattern => text.includes(pattern));
}

/**
 * 5. HARD FILTER FUNCTION (EXECUTES BEFORE CANDIDATE SELECTION).
 *
 * Takes a candidate pool and enforces hard filtering:
 * - If category is physical_personal_local:
 *   * Filters out ALL online-only models.
 *   * Ensures the remaining candidates are physical/local/personal.
 *   * Ensures primary candidate is physical/local/personal.
 * - If category is online_only:
 *   * Permitted online models are kept.
 * - If category is undetermined or combination:
 *   * Balanced distribution is preserved.
 */
export function hardFilterCandidateModels(
  candidates: BusinessStartDirectionCandidate[],
  constraints: ClientHardConstraints
): BusinessStartDirectionCandidate[] {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  if (constraints.isPhysicalPersonalLocal) {
    // STRICT HARD FILTER: Eliminate all online-only models from candidate selection pool
    const filtered = candidates.filter(candidate => !isOnlineOnlyBusinessModel(candidate));

    // Ensure at least one primary direction exists among the filtered candidates
    if (filtered.length > 0) {
      const hasPrimary = filtered.some(c => c.isPrimary);
      if (!hasPrimary) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    }
    // If all candidates were disqualified online models, return empty so domain fallback generates valid physical candidates
    return [];
  }

  // For online only, ensure candidates do not force physical travel if physical is rejected
  if (constraints.isOnlineOnly && constraints.rejectsPhysical) {
    return candidates.filter(c => !isPhysicalPersonalLocalBusinessModel(c));
  }

  return candidates;
}
