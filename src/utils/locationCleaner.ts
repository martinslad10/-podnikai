/**
 * Location, Address and Offer Sanitization Helpers
 * Ensures authentic, deduplicated, and natural Czech addresses and B2B offers.
 */

const INVALID_OFFER_KEYWORDS = [
  'hledám ideální nápad',
  'aktivní byznys',
  'zatím nevybrán',
  'zatím v přípravě',
  'nespecifikováno',
  'nový projekt',
  'můj byznys projekt',
  'svůj projekt',
  'b2b služby',
  'hledám nápad',
  'hledání nápadu',
  'podnikatelský záměr',
  'podnikatelský projekt',
  'projekt'
];

/**
 * Cleans and deduplicates Czech city names (e.g. "České Budějovice–České Budějovice 1" -> "České Budějovice")
 */
export function cleanCzechCity(rawCity?: string, fallbackCity: string = ''): string {
  if (!rawCity || rawCity === 'Nedostupné' || rawCity === 'vašem městě' || rawCity === 'v městě') {
    return fallbackCity ? cleanCzechCity(fallbackCity, '') : '';
  }

  let city = rawCity.trim();

  // 1. Remove country suffix
  city = city.replace(/,?\s*(Česko|Česká republika|Czechia|CZ)$/gi, '').trim();

  // 2. Remove ZIP codes (e.g. "370 01", "11000")
  city = city.replace(/\b\d{3}\s*\d{2}\b/g, '').trim();

  // 3. Handle dash / slash / comma duplicates (e.g. "České Budějovice - České Budějovice 1", "České Budějovice–České Budějovice 1")
  const dashMatch = city.split(/[\u2013\u2014\-\/,]+/);
  if (dashMatch.length > 1) {
    const firstPart = dashMatch[0].trim();
    const secondPart = dashMatch[1].trim();

    const normFirst = firstPart.toLowerCase().replace(/\s+\d+$/, '');
    const normSecond = secondPart.toLowerCase().replace(/\s+\d+$/, '');

    if (normFirst === normSecond || normSecond.includes(normFirst) || normFirst.includes(normSecond)) {
      city = firstPart;
    }
  }

  // 4. Strip trailing postal district number if not Prague (e.g. "České Budějovice 1" -> "České Budějovice", but keep "Praha 1" if preferred)
  if (!/^Praha\s+\d+$/i.test(city)) {
    city = city.replace(/\s+\d+$/, '').trim();
  }

  // 5. Remove any leftover punctuation or spaces
  city = city.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();

  return city || fallbackCity;
}

/**
 * Cleans full Czech street address by removing duplicates and redundant country labels
 */
export function cleanCzechAddress(rawAddress?: string): string {
  if (!rawAddress || rawAddress === 'Nedostupné') {
    return 'Nedostupné';
  }

  let addr = rawAddress.trim();

  // 1. Remove trailing country
  addr = addr.replace(/,?\s*(Česko|Česká republika|Czechia|CZ)$/gi, '').trim();

  // 2. Replace duplicated city-district dash constructions in the address
  // e.g. "České Budějovice–České Budějovice 1" -> "České Budějovice"
  addr = addr.replace(/([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž\s]+)[\u2013\u2014\-]\1\s*\d*/gi, (_match, group) => {
    return group.trim();
  });

  // 3. Replace multiple spaces and trailing commas
  addr = addr.replace(/\s{2,}/g, ' ');
  addr = addr.replace(/,\s*,/g, ',');
  addr = addr.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();

  return addr;
}

/**
 * Sanitizes business offer / USP to ensure internal system placeholder strings
 * like "Hledám ideální nápad" or "Aktivní byznys" are never inserted into outreach emails.
 */
export function sanitizeOfferTitle(
  concreteOffer?: string,
  businessDirectionTitle?: string,
  currentProject?: string,
  industry?: string
): string {
  const candidates = [concreteOffer, businessDirectionTitle, currentProject];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const isInvalid = INVALID_OFFER_KEYWORDS.some(k => lower === k || (lower.includes('hledám nápad') || lower.includes('hledá nápad')));
    if (!isInvalid && trimmed.length >= 3) {
      return trimmed;
    }
  }

  // Domain-appropriate default based on target industry if available
  if (industry && industry !== 'oboru' && industry !== 'Nedostupné') {
    const indLower = industry.toLowerCase();
    if (indLower.includes('auto') || indLower.includes('servis')) {
      return 'zefektivnění příjmu zakázek a komunikace se zákazníky';
    }
    if (indLower.includes('stav') || indLower.includes('řemesl') || indLower.includes('truhl')) {
      return 'zrychlení kalkulací a organizaci zakázek';
    }
    if (indLower.includes('gastro') || indLower.includes('restaur')) {
      return 'zvýšení počtu rezervací a spokojenosti hostů';
    }
    if (indLower.includes('salon') || indLower.includes('kadeř') || indLower.includes('wellness')) {
      return 'automatizaci online rezervací a připomínek pro klienty';
    }
  }

  return 'zjednodušení práce s poptávkami';
}
