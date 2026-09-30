import { PotentialCustomerLead } from '../types';
import { normalizeLeadStatusSeparation } from './leadActivities';

/**
 * Normalizes an identifier string for robust comparison.
 */
function normalizeId(id?: string): string {
  return (id || '').trim();
}

/**
 * Checks if two leads represent the same business entity.
 * Priority:
 * 1. Google Place ID / stable lead ID
 * 2. Identical Google Maps CID / URI (if non-empty)
 * Never matches purely by company name if stable ID exists.
 */
export function areSameLead(a: PotentialCustomerLead, b: PotentialCustomerLead): boolean {
  const idA = normalizeId(a.id);
  const idB = normalizeId(b.id);
  
  // 1. Match by stable ID
  if (idA && idB && idA === idB) {
    return true;
  }
  
  // 2. Match by exact Google Maps URI if available (cid query param)
  if (a.googleMapsUri && b.googleMapsUri && a.googleMapsUri.trim() === b.googleMapsUri.trim()) {
    return true;
  }

  return false;
}

/**
 * Merges a single existing lead with a fresh search result.
 * 
 * STRICT RULES:
 * 1. ALL CRM / sales / activity / pipeline / user data from existingLead are strictly preserved:
 *    - id
 *    - status (canonical CRM status, e.g. 'Schůzka', 'Zájem', etc.)
 *    - realStatus
 *    - simulationStatus
 *    - activities (complete history array, never truncated)
 *    - notes
 *    - dealValue
 *    - costsTracking
 *    - addedAt
 *    - lastContactedAt, lastContactChannel, lastContactResult
 *    - nextContactDate, scheduledAt, realNextContactDate
 *    - simulationNextContactDate, simulationLastContactedAt, simulationLastContactResult
 *    - outreachSequence
 *    - leadIntelligence
 *    - contactToday (preserved if lead was already in pipeline or scheduled)
 * 
 * 2. Public / profile data from freshLead can update the lead ONLY if fresh data is valid:
 *    - companyName
 *    - address (if fresh is not 'Nedostupné')
 *    - phone (if fresh is not 'Nedostupné')
 *    - website (if fresh is not 'Nedostupné')
 *    - googleRating (if fresh is not 'Nedostupné')
 *    - distanceKm
 *    - coordinates
 *    - industry
 *    - googleMapsUri
 *    - public email & metadata (only if fresh detected a verified email, otherwise keep existing)
 *    - fitScore, scoreBreakdown, dataSummary, businessHypothesis, fitReason
 * 
 * 3. Never replace a complete existing lead with an incomplete search result object!
 */
export function mergeSingleLead(
  existingLead: PotentialCustomerLead,
  freshLead: PotentialCustomerLead
): PotentialCustomerLead {
  // Determine if fresh lead has valid non-empty public contact details
  const freshHasValidPhone = Boolean(freshLead.phone && freshLead.phone !== 'Nedostupné' && freshLead.phone.trim().length > 0);
  const freshHasValidWebsite = Boolean(freshLead.website && freshLead.website !== 'Nedostupné' && freshLead.website.trim().length > 0);
  const freshHasValidAddress = Boolean(freshLead.address && freshLead.address !== 'Nedostupné' && freshLead.address.trim().length > 0);
  const freshHasValidRating = Boolean(freshLead.googleRating && freshLead.googleRating !== 'Nedostupné');
  const freshHasValidEmail = Boolean(freshLead.email && freshLead.email !== 'Nedostupné' && freshLead.email.trim().length > 0);

  // Preserve email if fresh search didn't detect one or returned 'Nedostupné'
  const email = freshHasValidEmail ? freshLead.email : (existingLead.email || 'Nedostupné');
  const emailSourceUrl = freshHasValidEmail ? freshLead.emailSourceUrl : (existingLead.emailSourceUrl || (existingLead.website !== 'Nedostupné' ? existingLead.website : undefined));
  const emailSourceType = freshHasValidEmail ? freshLead.emailSourceType : (existingLead.emailSourceType || 'official_website');
  const emailStatus = freshHasValidEmail ? freshLead.emailStatus : (existingLead.emailStatus || (email && email !== 'Nedostupné' ? 'public' : 'not_found'));
  const emailMetadata = freshHasValidEmail ? freshLead.emailMetadata : (existingLead.emailMetadata || undefined);

  // Preserve contactToday if existing lead is already in progress or has explicit date
  const isExistingInProgress = existingLead.status !== 'Nový' || 
    Boolean(existingLead.nextContactDate || existingLead.scheduledAt || existingLead.realNextContactDate || existingLead.simulationNextContactDate);
  const contactToday = isExistingInProgress ? (existingLead.contactToday ?? false) : (freshLead.contactToday ?? existingLead.contactToday ?? false);

  const merged: PotentialCustomerLead = {
    // 1. Base on existing lead to prevent ANY missing custom CRM properties
    ...existingLead,

    // 2. Updated public/profile fields (if fresh has valid data)
    companyName: freshLead.companyName || existingLead.companyName,
    address: freshHasValidAddress ? freshLead.address : existingLead.address,
    phone: freshHasValidPhone ? freshLead.phone : existingLead.phone,
    website: freshHasValidWebsite ? freshLead.website : existingLead.website,
    googleRating: freshHasValidRating ? freshLead.googleRating : existingLead.googleRating,
    distanceKm: typeof freshLead.distanceKm === 'number' ? freshLead.distanceKm : existingLead.distanceKm,
    coordinates: freshLead.coordinates || existingLead.coordinates,
    industry: freshLead.industry || existingLead.industry,
    googleMapsUri: freshLead.googleMapsUri || existingLead.googleMapsUri,
    
    email,
    emailSourceUrl,
    emailSourceType,
    emailStatus,
    emailMetadata,

    // Fresh score & search rationale
    fitScore: typeof freshLead.fitScore === 'number' ? freshLead.fitScore : existingLead.fitScore,
    scoreBreakdown: freshLead.scoreBreakdown || existingLead.scoreBreakdown,
    dataSummary: freshLead.dataSummary || existingLead.dataSummary,
    businessHypothesis: freshLead.businessHypothesis || existingLead.businessHypothesis,
    fitReason: freshLead.fitReason || existingLead.fitReason,
    outreach: existingLead.outreach || freshLead.outreach,

    // 3. STRICTLY PROTECTED CRM / SALES FIELDS (NEVER OVERWRITTEN BY FRESH SEARCH)
    id: existingLead.id,
    status: existingLead.status,
    realStatus: existingLead.realStatus || existingLead.status,
    simulationStatus: existingLead.simulationStatus,
    activities: Array.isArray(existingLead.activities) ? existingLead.activities : [],
    notes: existingLead.notes !== undefined ? existingLead.notes : freshLead.notes,
    dealValue: existingLead.dealValue !== undefined ? existingLead.dealValue : freshLead.dealValue,
    costsTracking: existingLead.costsTracking || freshLead.costsTracking,
    addedAt: existingLead.addedAt || freshLead.addedAt || new Date().toISOString(),
    lastContactedAt: existingLead.lastContactedAt,
    lastContactChannel: existingLead.lastContactChannel,
    lastContactResult: existingLead.lastContactResult,
    nextContactDate: existingLead.nextContactDate,
    scheduledAt: existingLead.scheduledAt,
    realNextContactDate: existingLead.realNextContactDate,
    simulationNextContactDate: existingLead.simulationNextContactDate,
    simulationLastContactedAt: existingLead.simulationLastContactedAt,
    simulationLastContactResult: existingLead.simulationLastContactResult,
    outreachSequence: existingLead.outreachSequence || freshLead.outreachSequence,
    leadIntelligence: existingLead.leadIntelligence || freshLead.leadIntelligence,
    contactToday
  };

  return normalizeLeadStatusSeparation(merged);
}

/**
 * Merges existing CRM leads with fresh search results.
 * 
 * Rules:
 * - Existing leads matching fresh search results are merged (CRM data preserved, profile data updated).
 * - Fresh search leads not in CRM are appended as new leads.
 * - Existing leads NOT in fresh search results are strictly preserved!
 * - Guarantees NO duplicate leads (by stable ID).
 * - Order: Fresh search results (merged or new) first, followed by remaining existing CRM leads.
 */
export function mergeLeadsWithExisting(
  existingLeads: PotentialCustomerLead[],
  freshLeads: PotentialCustomerLead[]
): PotentialCustomerLead[] {
  const currentExisting = Array.isArray(existingLeads) ? existingLeads : [];
  const currentFresh = Array.isArray(freshLeads) ? freshLeads : [];

  if (currentFresh.length === 0) {
    return currentExisting.map(normalizeLeadStatusSeparation);
  }

  const existingMap = new Map<string, PotentialCustomerLead>();
  for (const lead of currentExisting) {
    if (lead && lead.id) {
      existingMap.set(normalizeId(lead.id), lead);
    }
  }

  const mergedResults: PotentialCustomerLead[] = [];
  const processedIds = new Set<string>();

  // 1. Process all fresh search results first
  for (const fresh of currentFresh) {
    if (!fresh || !fresh.id) continue;
    const freshId = normalizeId(fresh.id);
    if (processedIds.has(freshId)) continue; // skip duplicates within fresh search

    const existingMatch = existingMap.get(freshId) || 
      currentExisting.find(ex => areSameLead(ex, fresh));

    if (existingMatch) {
      // Merge with existing CRM data
      const mergedLead = mergeSingleLead(existingMatch, fresh);
      mergedResults.push(mergedLead);
      processedIds.add(normalizeId(existingMatch.id));
      processedIds.add(freshId);
    } else {
      // Brand new lead
      const normalizedNew = normalizeLeadStatusSeparation({
        ...fresh,
        status: fresh.status || 'Nový',
        realStatus: fresh.realStatus || fresh.status || 'Nový',
        activities: Array.isArray(fresh.activities) ? fresh.activities : [],
        addedAt: fresh.addedAt || new Date().toISOString()
      });
      mergedResults.push(normalizedNew);
      processedIds.add(freshId);
    }
  }

  // 2. Append all remaining existing CRM leads that were NOT in fresh search results
  for (const ex of currentExisting) {
    if (!ex || !ex.id) continue;
    const exId = normalizeId(ex.id);
    if (!processedIds.has(exId)) {
      mergedResults.push(normalizeLeadStatusSeparation(ex));
      processedIds.add(exId);
    }
  }

  return mergedResults;
}
