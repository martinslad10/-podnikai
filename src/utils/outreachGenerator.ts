import { 
  LeadOutreachSequence, 
  OutreachStep, 
  OutreachTone, 
  PotentialCustomerLead, 
  UserProfile 
} from '../types';
import { 
  cleanCzechCity, 
  sanitizeOfferTitle 
} from './locationCleaner';
import { isValidPersonName, isValidExecutiveRole } from './personValidation';
import { formatCzechDateTime } from './leadActivities';

export interface OutreachGeneratorOptions {
  tone?: OutreachTone;
  userProfile?: Partial<UserProfile>;
  businessDirectionTitle?: string;
  concreteOffer?: string;
}

export const OUTREACH_TONES: Array<{
  id: OutreachTone;
  label: string;
  description: string;
  badgeColor: string;
}> = [
  {
    id: 'direct',
    label: 'Přímý',
    description: 'Úderný, bez zbytečné omáčky, jasný a rychlý přínos',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    id: 'professional',
    label: 'Profesionální',
    description: 'Kultivovaný formální B2B styl, partnerský přístup',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    id: 'consultative',
    label: 'Konzultační',
    description: 'Expertní otázky k procesům, porozumění potřebám firmy',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  {
    id: 'case_study',
    label: 'Referenční',
    description: 'Důraz na reálné výsledky podobných firem a sociální důkaz',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  }
];

export function countWords(text?: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * List of banned internal AI and analytical terminology that MUST NEVER appear
 * in customer-facing outreach texts.
 */
export const BANNED_AI_PATTERNS: RegExp[] = [
  /\[?\s*AI\s+hypotéz[a-yů]\s*(?:–?\s*ověřit)?\s*\]?/gi,
  /\b(?:obchodní\s+)?hypotéz[a-yů]\s*(?:k\s+ověření)?\s*(?:se\s+zaměřuje\s+na|spočívá\s+v|říká,\s*že)?[:\s]*/gi,
  /\bpodnět\s+k\s+ověření[:\s]*/gi,
  /\bk\s+ověření[:\s]*/gi,
  /\blead\s+intelligence\b/gi,
  /\bověřen[ýéá]\s+fakt[yů]?[:\s]*/gi,
  /\bověřená?\s+fakta[:\s]*/gi,
  /\bzdroj\s+signál[uů]\b[:\s]*/gi,
  /\bsignál[yů]?\s*(?:z\s+webu)?[:\s]*/gi,
  /\binterní\s+podklad[yů]?[:\s]*/gi,
  /\benrichment\b/gi,
  /\banalýz[a-y]\s+pomocí\s+AI\b/gi,
  /\banalyzoval\s+jsem\s+vás\s+pomocí\s+AI\b/gi,
  /\bvýstup\s+AI\b/gi,
  /\bAI\s+systém[uů]?\b/gi
];

/**
 * Patterns for ungrounded outcome claims (e.g. guaranteeing saved time,
 * higher conversions, faster reaction without verification).
 */
export const UNGROUNDED_CLAIM_PATTERNS: RegExp[] = [
  /\bv\s+praxi\s+to\s+(?:firmám\s+)?pomáhá\s+reagovat\s+podstatně\s+rychleji[^.\n]*\.?/gi,
  /\bv\s+praxi\s+to\s+pomáhá\s+šetřit\s+čas[^.\n]*\.?/gi,
  /\bcož\s+jim\s+ušetřilo\s+několik\s+hodin[^.\n]*\.?/gi,
  /\bgarantujeme\s+[^.\n]*\.?/gi,
  /\bzaručeně\s+[^.\n]*\.?/gi,
  /\bzaručené\s+(?:výsledky|nárůsty)[^.\n]*\.?/gi,
  /\bgarantovaný\s+výsledek[^.\n]*\.?/gi,
  /\bvám\s+určitě\s+(?:ušetří|přinese|zvýší)[^.\n]*\.?/gi,
  /\bklíčem\s+k\s+udržení\s+zájemců\s+je\s+právě\s+rychlost\s+první\s+reakce[^.\n]*\.?/gi,
  /\b(?:obrovská|vysoká)\s+poptávka\s+po\s+vašich\s+službách[^.\n]*\.?/gi,
  /\b(?:stovky|desítky|tisíce)\s+(?:klientů|zákazníků|poptávek)[^.\n]*\.?/gi
];

/**
 * Returns true if text contains ungrounded outcome claims.
 */
export function hasUngroundedClaims(text?: string): boolean {
  if (!text) return false;
  return UNGROUNDED_CLAIM_PATTERNS.some(pat => {
    pat.lastIndex = 0;
    return pat.test(text);
  });
}

/**
 * Replaces ungrounded outcome claims with polite, humble exploratory proposals.
 */
export function cleanUngroundedClaims(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Replace standard ungrounded claims with humble proposal
  cleaned = cleaned.replace(
    /\b(?:v\s+praxi\s+to\s+(?:firmám\s+)?pomáhá\s+reagovat\s+podstatně\s+rychleji[^.\n]*|v\s+praxi\s+to\s+pomáhá\s+šetřit\s+čas[^.\n]*|což\s+jim\s+ušetřilo\s+několik\s+hodin[^.\n]*)\.?/gi,
    'Napadlo mě, zda by pro vás dávalo smysl zjednodušit tento proces a omezit ruční práci s poptávkami.'
  );

  cleaned = cleaned.replace(
    /\bklíčem\s+k\s+udržení\s+zájemců\s+je\s+právě\s+rychlost\s+první\s+reakce[^.\n]*\.?/gi,
    'často bývá praktické projít si, jak vám stávající způsob vyhovuje.'
  );

  cleaned = cleaned.replace(
    /\b(?:Vícekanálový\s+kontakt(?:\s*\(multichannel\))?|multichannel)[^.\n]*zvedá\s+šanci[^.\n]*\.?/gi,
    'Krátký follow-up po prvním kontaktu umožňuje ověřit, zda firma zprávu zaznamenala a zda je téma pro ni aktuální.'
  );

  for (const pat of UNGROUNDED_CLAIM_PATTERNS) {
    pat.lastIndex = 0;
    cleaned = cleaned.replace(pat, '');
  }

  return cleaned;
}

/**
 * Checks if text contains damaged corporate suffix fragments like "že r.o.", lone "r.o.", or "že s.r.o.".
 */
export function hasBrokenCompanyFragments(text?: string): boolean {
  if (!text) return false;
  const brokenPatterns = [
    /\b(?:všiml\s+jsem\s+si,?\s*že|zaujalo\s+mě,?\s*že)\s+(?:r\.o\.?|s\.r\.o\.?|a\.s\.?)\b/i,
    /\bže\s+(?:r\.o\.?|s\.r\.o\.?|a\.s\.?)\b/i,
    /\b(?:^|[.\n]\s*)(?:r\.o\.?|s\.r\.o\.?|a\.s\.?)\b/i,
    /\bv\s+(?:r\.o\.?)\b/i,
    /\bpro\s+(?:r\.o\.?)\b/i
  ];
  return brokenPatterns.some(pat => pat.test(text));
}

/**
 * Repairs broken company name fragments, ensuring company names are either kept
 * intact as full valid names, or cleanly rewritten without leaving lone suffixes.
 */
export function cleanBrokenCompanyFragments(text: string, companyName?: string): string {
  if (!text) return '';
  let cleaned = text;
  const validCompany = (companyName || '').trim();

  // 1. Specific broken sentence "Všiml jsem si, že r.o."
  cleaned = cleaned.replace(
    /\b(?:všiml\s+jsem\s+si,?\s*že|všiml\s+jsem\s+si\s+že|zaujalo\s+mě,?\s*že)\s+(?:r\.o\.?|s\.r\.o\.?|a\.s\.?|spol\.?)\.?[,\s]*/gi,
    'Při prohlídce vašeho webu jsem si prošel vaši nabídku služeb. '
  );

  // 2. Fragment "že r.o." / "že s.r.o."
  cleaned = cleaned.replace(
    /\bže\s+(?:r\.o\.?|s\.r\.o\.?|a\.s\.?)\b/gi,
    validCompany ? `že ve společnosti ${validCompany}` : 'že na vašem webu'
  );

  // 3. Fragment "v r.o."
  cleaned = cleaned.replace(
    /\bv\s+(?:r\.o\.?)\b/gi,
    validCompany ? `ve společnosti ${validCompany}` : 've vaší firmě'
  );

  // 4. Standalone line of just corporate suffix
  cleaned = cleaned.replace(/^[ \t]*(?:r\.o\.?|s\.r\.o\.?|a\.s\.?)[ \t]*$/gim, '');

  return cleaned;
}

/**
 * Returns true if text contains any banned internal AI / analytical labels.
 */
export function hasInternalAiTerminology(text?: string): boolean {
  if (!text) return false;
  return BANNED_AI_PATTERNS.some(pat => {
    pat.lastIndex = 0;
    return pat.test(text);
  });
}

/**
 * Strips internal AI labels, tags, and banned marketing clichés so the message sounds
 * like a real human B2B professional, not a marketing generator.
 */
export function cleanInternalAiTerminology(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Strip internal system prefixes & banned terms
  for (const pat of BANNED_AI_PATTERNS) {
    pat.lastIndex = 0;
    cleaned = cleaned.replace(pat, '');
  }

  // 2. Clean specific awkward introductory phrases
  cleaned = cleaned.replace(/\bpři\s+procházení\s+vaší\s+prezentace\s+mě\s+zaujal\s+podnět\s+k\s+ověření[:\s]*/gi, 'Při prohlídce vašeho webu mě zaujalo: ');
  cleaned = cleaned.replace(/\bpři\s+procházení\s+vašeho\s+webu\s+mě\s+zaujal\s+podnět\s+k\s+ověření[:\s]*/gi, 'Při prohlídce vašeho webu mě zaujalo: ');
  cleaned = cleaned.replace(/\bpři\s+procházení\s+vaší\s+prezentace\s+mě\s+zaujal(?:o|a)?\s*/gi, 'při prohlídce vašeho webu mě zaujalo ');
  cleaned = cleaned.replace(/\bpři\s+procházení\s+vašeho\s+webu\s+mě\s+zaujal(?:o|a)?\s*/gi, 'při prohlídce vašeho webu mě zaujalo ');
  cleaned = cleaned.replace(/\brád\s+bych\s+vám\s+představil\s+konkrétní\s+řešení[,\s]*/gi, '');
  cleaned = cleaned.replace(/\bzefektivnění\s+a\s+digitalizac[ei]\s+zakázek/gi, 'zjednodušení práce s poptávkami');
  cleaned = cleaned.replace(/\bzefektivnění\s+a\s+digitalizace/gi, 'zjednodušení procesů');
  cleaned = cleaned.replace(/\bstojí\s+za\s+krátkou\s+diskusi/gi, 'by vás mohlo zajímat');
  cleaned = cleaned.replace(/\bkonkrétní\s+bod,\s*který\s+by\s+mohl\s+stát\s+za\s*/gi, '');

  // 3. Clean ungrounded outcome claims
  cleaned = cleanUngroundedClaims(cleaned);

  // 4. Clean broken company fragments
  cleaned = cleanBrokenCompanyFragments(cleaned);

  // 5. Clean multiple spaces / punctuation
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

/**
 * Formats polite Czech salutation:
 * - If verified name is present: "Dobrý den, pane Kašparů," or "Dobrý den, paní Nováková,"
 * - If name is not verified: strictly "Dobrý den,"
 */
export function formatCzechSalutation(verifiedName?: string): string {
  if (!verifiedName || !verifiedName.trim()) {
    return 'Dobrý den,';
  }
  const parts = verifiedName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Dobrý den,';
  const surname = parts[parts.length - 1];

  // Female surname check (-ová, -á, -cká, -ská)
  if (/ová$|ská$|cká$|[a-záčďéěíňóřšťúůýž]á$/i.test(surname)) {
    return `Dobrý den, paní ${surname},`;
  }
  // Male surname ending in -ů (e.g. Kašparů)
  if (/ů$/i.test(surname)) {
    return `Dobrý den, pane ${surname},`;
  }
  // Male surname ending in -ý (e.g. Novotný)
  if (/ý$/i.test(surname)) {
    return `Dobrý den, pane ${surname},`;
  }
  // General polite fallback
  return `Dobrý den, pane ${surname},`;
}

export function cleanPhoneNumberForWhatsApp(phone?: string): string {
  if (!phone || phone === 'Nedostupné') return '';
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.length === 9) {
    // Default Czech prefix if only 9 digits
    cleaned = `420${cleaned}`;
  }
  return cleaned;
}

export function buildMailtoUrl(email: string, subject: string, body: string): string {
  if (!email || email === 'Nedostupné') return '';
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = cleanPhoneNumberForWhatsApp(phone);
  if (!cleaned) return '';
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleaned)}&text=${encodeURIComponent(message)}`;
}

export function buildTelUrl(phone: string): string {
  if (!phone || phone === 'Nedostupné') return '';
  return `tel:${phone.replace(/\s+/g, '')}`;
}

export function calculateFollowUpDate(daysFromNow: number, hour: number = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // Avoid weekend followups if landing on Sat/Sun
  if (d.getDay() === 6) { // Saturday -> Monday
    d.setDate(d.getDate() + 2);
  } else if (d.getDay() === 0) { // Sunday -> Monday
    d.setDate(d.getDate() + 1);
  }
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Generates natural, short, non-marketing email subjects as requested:
 * e.g. „Krátký dotaz – [Název firmy]“, „Dotaz k příjmu poptávek“, „Nápad k online poptávkám“, „10 minut – [Název firmy]“
 */
export function generateNaturalEmailSubject(
  companyName: string,
  tone: OutreachTone = 'professional',
  detailHint?: string
): string {
  const company = companyName?.trim() || '';
  const hint = detailHint?.toLowerCase() || '';
  if (hint.includes('formulář') || hint.includes('formular')) {
    return 'Krátký dotaz k formuláři';
  }
  if (hint.includes('web') || hint.includes('stránk')) {
    return 'Dotaz k vašemu webu';
  }
  if (tone === 'direct') {
    return company ? `10 minut – ${company}` : '10 minut k poptávkám';
  }
  if (tone === 'consultative') {
    return 'Krátký dotaz k poptávkám';
  }
  if (tone === 'case_study') {
    return company ? `Dotaz k poptávkám – ${company}` : 'Dotaz k poptávkám';
  }
  // Professional (default)
  return company ? `Krátký dotaz – ${company}` : 'Krátký dotaz k poptávkám';
}

/**
 * Helper to check whether a real (non-simulated, successfully delivered) email was ever sent to this lead in CRM.
 * CRITICAL RULE: Test simulation (isSimulation === true) MUST NEVER be treated as real sent email.
 * Only activities where isSimulation === false and result indicates actual email dispatch count as real contact context.
 */
export function hasRealSentEmail(lead: PotentialCustomerLead): boolean {
  if (!lead) return false;

  // 1. Primary check: Explicit CRM activities history of the lead
  if (Array.isArray(lead.activities) && lead.activities.length > 0) {
    const realEmailActs = lead.activities.filter(a => 
      a.channel === 'email' && 
      a.isSimulation === false
    );
    if (realEmailActs.length > 0) {
      const hasSent = realEmailActs.some(a => {
        const res = (a.result || '').toLowerCase();
        const note = (a.note || '').toLowerCase();
        // Disallow any test simulation tags or flags
        if (res.includes('simul') || note.includes('[testovací simulace')) return false;
        // Disallow draft concepts, failed deliveries or errors
        if (
          res.includes('koncept') || 
          res.includes('neodesl') || 
          res.includes('chyba') || 
          res.includes('nedoruč') || 
          res.includes('selhal')
        ) {
          return false;
        }
        // Genuine sent email indication
        return res.includes('odesl') || res.includes('kontakt') || a.statusAfter === 'Osloveno';
      });
      if (hasSent) return true;
    }
  }

  // 2. Secondary fallback: lastContactChannel === 'email' in real CRM context
  if (
    lead.lastContactChannel === 'email' &&
    (lead as any).isSimulation !== true
  ) {
    const res = (lead.lastContactResult || '').toLowerCase();
    const hasSimActivity = Array.isArray(lead.activities) && lead.activities.some(a => a.isSimulation === true && a.channel === 'email' && a.result === lead.lastContactResult);
    if (!hasSimActivity && !res.includes('simul') && !res.includes('koncept') && !res.includes('neodesl') && !res.includes('chyba')) {
      if (res.includes('odesl') || lead.realStatus === 'Osloveno' || lead.status === 'Osloveno') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns the Date of the most recent real (non-simulated) sent email for the lead,
 * or null if no real email has been sent.
 */
export function getLastRealSentEmailDate(lead: PotentialCustomerLead): Date | null {
  if (!lead) return null;

  let latestDate: Date | null = null;

  if (Array.isArray(lead.activities) && lead.activities.length > 0) {
    const realEmailActs = lead.activities.filter(a => 
      a.channel === 'email' && 
      a.isSimulation === false
    );

    for (const a of realEmailActs) {
      const res = (a.result || '').toLowerCase();
      const note = (a.note || '').toLowerCase();
      if (res.includes('simul') || note.includes('[testovací simulace')) continue;
      if (
        res.includes('koncept') || 
        res.includes('neodesl') || 
        res.includes('chyba') || 
        res.includes('nedoruč') || 
        res.includes('selhal')
      ) {
        continue;
      }
      if (res.includes('odesl') || res.includes('kontakt') || a.statusAfter === 'Osloveno') {
        const d = a.createdAt ? new Date(a.createdAt) : null;
        if (d && !isNaN(d.getTime())) {
          if (!latestDate || d.getTime() > latestDate.getTime()) {
            latestDate = d;
          }
        }
      }
    }
  }

  if (!latestDate && lead.lastContactChannel === 'email' && (lead as any).isSimulation !== true) {
    const res = (lead.lastContactResult || '').toLowerCase();
    const hasSimActivity = Array.isArray(lead.activities) && lead.activities.some(a => a.isSimulation === true && a.channel === 'email' && a.result === lead.lastContactResult);
    if (!hasSimActivity && !res.includes('simul') && !res.includes('koncept') && !res.includes('neodesl') && !res.includes('chyba')) {
      if (res.includes('odesl') || lead.realStatus === 'Osloveno' || lead.status === 'Osloveno') {
        if (lead.lastContactedAt) {
          const d = new Date(lead.lastContactedAt);
          if (!isNaN(d.getTime())) {
            latestDate = d;
          }
        }
      }
    }
  }

  return latestDate;
}

/**
 * Calculates calendar or elapsed days between the email date and now.
 */
export function getDaysSinceEmail(emailDate: Date | null, now: Date = new Date()): number | null {
  if (!emailDate || isNaN(emailDate.getTime())) return null;
  const diffMs = now.getTime() - emailDate.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Dynamically computes a factually and temporally accurate opening for follow-up emails,
 * strictly grounded in the elapsed time since the previous real email was sent in CRM.
 * Never claims "z minulého týdne" unless at least 5 days have actually elapsed!
 */
export function getEmailFollowUpOpening(lead: PotentialCustomerLead, companyName: string, now: Date = new Date()): string {
  const emailSent = hasRealSentEmail(lead);
  if (!emailSent) {
    return `obracím se na vás ohledně prezentace společnosti ${companyName}.`;
  }

  const lastEmailDate = getLastRealSentEmailDate(lead);
  const daysDiff = getDaysSinceEmail(lastEmailDate, now);

  if (daysDiff === null || daysDiff === 0) {
    // Sent today
    return `navazuji na e-mail, který jsem vám posílal dnes ohledně ${companyName}.`;
  } else if (daysDiff === 1) {
    // Sent yesterday
    return `navazuji na e-mail, který jsem vám posílal včera ohledně ${companyName}.`;
  } else if (daysDiff >= 2 && daysDiff <= 4) {
    // Sent 2-4 days ago
    return `navazuji na e-mail, který jsem vám poslal před několika dny ohledně ${companyName}.`;
  } else if (daysDiff >= 5 && daysDiff <= 11) {
    // Sent 5-11 days ago (last week)
    return `krátce navazuji na svůj e-mail z minulého týdne ohledně ${companyName}.`;
  } else {
    // Sent 12+ days ago
    return `navazuji na svůj dřívější e-mail ohledně ${companyName}.`;
  }
}

/**
 * Helper to check whether a real (non-simulated) phone call was ever recorded for this lead in CRM.
 */
export function hasRealPhoneCall(lead: PotentialCustomerLead): boolean {
  if (!lead) return false;
  const phoneActs = lead.activities?.filter(a => a.channel === 'phone' && a.isSimulation === false);
  if (phoneActs && phoneActs.length > 0) {
    return true;
  }
  if (lead.lastContactChannel === 'phone' && (lead as any).isSimulation !== true && !lead.lastContactResult?.toLowerCase().includes('simul')) {
    return true;
  }
  return false;
}

/**
 * Helper to check whether verified public email exists for this lead.
 */
export function hasVerifiedEmail(lead: PotentialCustomerLead): boolean {
  if (!lead || !lead.email) return false;
  const trimmed = lead.email.trim();
  if (trimmed === '' || trimmed === 'Nedostupné' || trimmed.toLowerCase() === 'neuveden' || !trimmed.includes('@')) {
    return false;
  }
  return true;
}

/**
 * Helper to check whether WhatsApp is genuinely verified for this lead.
 * Samotná existence telefonního čísla neznamená ověřený WhatsApp!
 */
export function hasVerifiedWhatsApp(lead: PotentialCustomerLead): boolean {
  if (!lead) return false;
  if ((lead as any).hasVerifiedWhatsApp === true || (lead as any).hasWhatsApp === true) return true;
  const intel = lead.leadIntelligence || (lead as any).intelligence;
  if ((intel as any)?.hasVerifiedWhatsApp === true) return true;
  return false;
}

/**
 * Detects whether a string contains claims or references to a previous email sent, read, or received.
 */
export function hasEmailReference(text?: string): boolean {
  if (!text) return false;
  const pat = /\b(?:posílal\s+jsem\s+(?:vám\s+)?(?:před\s+pár\s+dny\s+|před\s+několika\s+dny\s+|předevčírem\s+|dnes\s+|včera\s+|do\s+)?e-?mail|v\s+návaznosti\s+na\s+(?:krátký\s+|můj\s+|předchozí\s+|dřívější\s+)?e-?mail|navazuji\s+na\s+(?:krátký\s+|můj\s+|předchozí\s+|dřívější\s+)?e-?mail|navazuji\s+na\s+e-?mail|psal\s+jsem\s+vám\s+(?:do\s+)?e-?mail|v\s+e-?mailu\s+jsem\s+zmiňoval|zkoušel\s+jsem\s+vás\s+kontaktovat\s+e-?mailem|k\s+mému\s+předchozímu\s+e-?mailu|k\s+mému\s+dřívějšímu\s+e-?mailu|na\s+svůj\s+e-?mail\s+z\s+minulého\s+týdne|na\s+svůj\s+dřívější\s+e-?mail|posílal\s+jsem\s+vám\s+předevčírem\s+(?:krátký\s+)?e-?mail|posílal\s+jsem\s+vám\s+do\s+e-?mailu|návaznost\s+na\s+(?:reálně\s+)?odeslaný\s+e-?mail|navazuje\s+na\s+reálně\s+odeslaný\s+e-?mail)\b/i;
  return pat.test(text);
}

/**
 * Detects whether a string contains false/unverified claims of a previous email sent, read, or received.
 */
export function hasFalseEmailClaim(text?: string): boolean {
  return hasEmailReference(text);
}

export interface VerifiedObservationResult {
  observationSentence: string;
  interestSentence: string;
  basis: string;
  observationTopic: string;
}

/**
 * Extracts and formulates a verified observation sentence (Point B) and short reason
 * why it caught attention (Point C) from Lead Intelligence or public website.
 * Crucially: NEVER splits or breaks company names or corporate suffixes (e.g. AVISTA s.r.o.).
 */
export function extractVerifiedObservationAndInterest(
  lead: PotentialCustomerLead,
  effectiveIcebreaker?: string
): VerifiedObservationResult {
  const intel = lead.leadIntelligence;
  const company = (lead.companyName || (lead as any).company || (lead as any).name || '').trim();
  const industry = (lead.industry || (lead as any).category || 'oboru').trim();
  const rawWeb = lead.website && lead.website !== 'Nedostupné' ? lead.website : '';
  const cleanWeb = rawWeb.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/.*$/, '');
  const websiteData = (intel as any)?.websiteData;

  // Check if restaurant, gastro, or booking (e.g. BRIO Restaurant)
  const isRestaurantOrGastro = 
    industry.toLowerCase().includes('restaur') || 
    industry.toLowerCase().includes('gastro') || 
    company.toLowerCase().includes('brio') || 
    company.toLowerCase().includes('restaurant') ||
    company.toLowerCase().includes('bistro') ||
    company.toLowerCase().includes('kavárna');

  if (isRestaurantOrGastro) {
    return {
      observationSentence: 'Při prohlídce vašeho webu mě zaujalo, jak máte řešené online rezervace a nabídku služeb.',
      interestSentence: 'Zaujalo mě vaše konkrétní zaměření a nabídka pro hosty.',
      basis: 'Online rezervace a nabídka na webu',
      observationTopic: 'online rezervace a nabídku služeb'
    };
  }

  // 1. If explicit form flag or booking flag exists
  if (websiteData?.hasInteractiveForm || (lead as any).hasInteractiveForm) {
    return {
      observationSentence: 'Při prohlídce vašeho webu jsem si všiml formuláře pro zasílání poptávek.',
      interestSentence: 'Zaujalo mě, že umožňujete zájemcům odeslat poptávku přímo online.',
      basis: 'Kontaktní formulář na webu',
      observationTopic: 'poptávkový formulář a příjem zpráv z webu'
    };
  }

  if (websiteData?.hasOnlineBookingSystem || (lead as any).hasOnlineBookingSystem) {
    return {
      observationSentence: 'Při prohlídce vašeho webu jsem si všiml online rezervačního systému pro objednávání.',
      interestSentence: 'Zaujalo mě, jak máte objednávání termínů usnadněné.',
      basis: 'Online rezervační systém na webu',
      observationTopic: 'online rezervace a objednávání termínů'
    };
  }

  // 2. Parse from effective icebreaker without breaking company name
  if (effectiveIcebreaker && effectiveIcebreaker.trim()) {
    let cleanIce = cleanInternalAiTerminology(effectiveIcebreaker);
    
    // Check if icebreaker mentions a specific form or inquiries (e.g. AVISTA s.r.o.)
    const formMatch = cleanIce.match(/(?:všiml\s+jsem\s+si|zaujal(?:o|a)?\s+mě)\s+(?:vašeho\s+)?(formuláře\s+pro\s+zaslání\s+dotazů[^\.\n]*|formuláře[^\.\n]*|kontaktního\s+formuláře[^\.\n]*)/i);
    if (formMatch && formMatch[1]) {
      let formDesc = formMatch[1].trim().replace(/\s+rád\s+bych.*$/i, '').trim();
      return {
        observationSentence: `Při prohlídce vašeho webu jsem si všiml ${formDesc}.`,
        interestSentence: 'Zaujalo mě, že umožňujete zájemcům poptat služby přímo online.',
        basis: intel?.recommendedApproach?.icebreakerSource || intel?.icebreakerSource || 'Kontaktní formulář na webu',
        observationTopic: 'jak máte řešený poptávkový formulář a příjem zpráv z webu'
      };
    }

    const offeringMatch = cleanIce.match(/(?:všiml\s+jsem\s+si|zaujal(?:o|a)?\s+mě)\s+(?:vaší\s+|vašeho\s+|vašich\s+)?(nabídky\s+[^\.\n]*|portfolia\s+[^\.\n]*|služeb\s+[^\.\n]*)/i);
    if (offeringMatch && offeringMatch[1]) {
      let offerDesc = offeringMatch[1].trim().replace(/\s+rád\s+bych.*$/i, '').trim();
      return {
        observationSentence: `Při prohlídce vašeho webu mě zaujala vaše ${offerDesc}.`,
        interestSentence: 'Zaujalo mě vaše konkrétní zaměření a nabídka v regionu.',
        basis: intel?.recommendedApproach?.icebreakerSource || intel?.icebreakerSource || 'Veřejná prezentace firmy',
        observationTopic: 'jak máte řešenou nabídku služeb a prezentaci pro zákazníky'
      };
    }

    // Generic safe extraction from icebreaker that avoids "r.o." fragments
    const vsimlMatch = cleanIce.match(/všiml\s+jsem\s+si\s+(?:,\s*že\s+|že\s+)?(.*?)(?:\.|\s+rád\s+bych|\s+chtěl\s+bych|$)/i);
    if (vsimlMatch && vsimlMatch[1] && vsimlMatch[1].trim().length > 15) {
      let snippet = vsimlMatch[1].trim();
      if (!/^(?:r\.o|s\.r\.o|a\.s)\b/i.test(snippet)) {
        if (/^vaše/i.test(snippet)) {
          return {
            observationSentence: `Při prohlídce vašeho webu jsem si všiml ${snippet}.`,
            interestSentence: 'Zaujalo mě vaše konkrétní zaměření a přístup k zákazníkům.',
            basis: intel?.recommendedApproach?.icebreakerSource || intel?.icebreakerSource || 'Veřejná prezentace firmy',
            observationTopic: 'jak máte řešenou prezentaci a přístup k zákazníkům'
          };
        }
        return {
          observationSentence: `Při prohlídce vašeho webu jsem si všiml, že ${snippet.charAt(0).toLowerCase() + snippet.slice(1)}.`,
          interestSentence: 'Zaujalo mě, jak máte prezentaci a služby nastavené.',
          basis: intel?.recommendedApproach?.icebreakerSource || intel?.icebreakerSource || 'Veřejná prezentace firmy',
          observationTopic: 'jak máte řešenou prezentaci a služby na webu'
        };
      }
    }
  }

  // 3. Fallback to first signal observation
  const firstSignal = intel?.signals?.find((s: any) => (s.type === 'verified_fact' || !s.type) && s.observation);
  if (firstSignal?.observation) {
    let cleanObs = cleanInternalAiTerminology(firstSignal.observation);
    cleanObs = cleanObs.replace(/^všiml jsem si,\s*že\s*/i, '').trim();
    if (/formulář/i.test(cleanObs)) {
      return {
        observationSentence: 'Při prohlídce vašeho webu jsem si všiml formuláře pro zasílání poptávek.',
        interestSentence: 'Zaujalo mě, že umožňujete zájemcům poptat práce přímo online.',
        basis: firstSignal.source || 'Kontaktní formulář na webu',
        observationTopic: 'jak máte řešený poptávkový formulář a příjem zpráv z webu'
      };
    }
    return {
      observationSentence: `Při prohlídce vašeho webu mě zaujalo: ${cleanObs.charAt(0).toLowerCase() + cleanObs.slice(1)}.`,
      interestSentence: 'Zaujalo mě vaše konkrétní zaměření a nabídka služeb.',
      basis: firstSignal.source || 'Veřejný web firmy',
      observationTopic: 'jak máte řešenou nabídku služeb a prezentaci pro zákazníky'
    };
  }

  // 4. Fallback to clean web
  if (cleanWeb) {
    return {
      observationSentence: `Při prohlídce vašeho webu ${cleanWeb} jsem si prošel vaši prezentaci a nabídku služeb.`,
      interestSentence: `Zaujalo mě vaše konkrétní působení v oboru ${industry}.`,
      basis: `Veřejný web ${cleanWeb}`,
      observationTopic: 'jak máte řešenou nabídku služeb a prezentaci pro zákazníky'
    };
  }

  return {
    observationSentence: `Obracím se na vás ohledně prezentace společnosti ${company || 'vaší firmy'}.`,
    interestSentence: `Zaujalo mě vaše působení v oboru ${industry}.`,
    basis: `Veřejný profil v oboru ${industry}`,
    observationTopic: 'jak máte řešenou nabídku služeb a prezentaci pro zákazníky'
  };
}

export function generateOutreachSequence(
  lead: PotentialCustomerLead,
  options?: OutreachGeneratorOptions
): LeadOutreachSequence {
  const tone: OutreachTone = options?.tone || 'professional';
  const userName = options?.userProfile?.name?.trim() || 'Martin';
  const company = (lead.companyName || (lead as any).company || (lead as any).name || '').trim() || 'vaše společnost';
  
  // Clean, deduplicated city name without internal repetitive artifacts
  const cleanCity = cleanCzechCity(lead.city);
  const cityPhrase = cleanCity ? ` v lokalitě ${cleanCity}` : '';

  // Clean industry
  const rawIndustry = lead.industry;
  const industry = (rawIndustry && rawIndustry !== 'Nedostupné') ? rawIndustry.trim() : 'vašem oboru';

  // Sanitize offer title to strictly prevent placeholder leaks
  const offer = sanitizeOfferTitle(
    options?.concreteOffer,
    options?.businessDirectionTitle,
    options?.userProfile?.currentProject,
    industry
  );

  const intel = lead.leadIntelligence || (lead as any).intelligence;
  const effectiveIcebreaker = intel?.recommendedApproach?.icebreaker || intel?.icebreaker;
  const effectiveOpportunity = (Array.isArray(intel?.hypotheses) ? intel.hypotheses[0]?.opportunity : intel?.hypotheses?.opportunity) || intel?.opportunity;

  // Strict verification: Never treat company name, brand, or random web text as a person name
  const rawPersonName = intel?.recommendedApproach?.idealContactPerson?.name || intel?.idealContactPerson?.name;
  const rawPersonRole = intel?.recommendedApproach?.idealContactPerson?.role || intel?.idealContactPerson?.role;
  const hasVerifiedPerson = Boolean(
    rawPersonName && 
    isValidPersonName(rawPersonName, company, lead.website) && 
    isValidExecutiveRole(rawPersonRole)
  );
  const idealPersonName = hasVerifiedPerson ? rawPersonName?.trim() : undefined;
  const idealPersonRole = hasVerifiedPerson 
    ? (rawPersonRole || 'Majitel / jednatel společnosti')
    : 'Majitel / jednatel společnosti';
  const idealPersonSourceNote = hasVerifiedPerson
    ? (intel?.recommendedApproach?.idealContactPerson?.sourceNote || intel?.idealContactPerson?.sourceNote || 'Ověřeno ve veřejné prezentaci firmy.')
    : 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.';

  // 1. Salutation: strictly personal if verified name + role, otherwise neutral "Dobrý den,"
  const salutation = formatCzechSalutation(idealPersonName);

  // 2. Verified public detail & personalization foundation for Day 1 (Structure parts B & C)
  const observationData = extractVerifiedObservationAndInterest(lead, effectiveIcebreaker);
  const observationSection = `${observationData.observationSentence} ${observationData.interestSentence}`.trim();
  const day1PersonalizationBasis = observationData.basis;

  // 3. Step 1: Day 1 - Personalized Email (Strictly 80–130 words, max 150 words)
  // Structure: A) Oslovení, B) Pozorování z webu, C) Proč zaujalo, D) Opatrná možnost, E) 5–10min CTA, F) Podpis
  const emailSubject = generateNaturalEmailSubject(company, tone, observationData.observationSentence);
  let emailBody = '';
  let emailKeyArg = '';

  if (tone === 'direct') {
    emailBody = `${salutation}

${observationSection}

Věnuji se oblasti práce s poptávkami. Napadlo mě, zda by pro vás v ${company} dávalo smysl zjednodušit příjem zpráv od zájemců a zrychlit prvotní vyřízení.

Nechci předjímat vaše stávající nastavení – rád bych nejdříve na 5–10 minut nezávazně zjistil, jak to řešíte dnes a zda je to pro vás aktuální.

Dávalo by vám smysl krátce si k tomu zavolat? Dejte mi prosím vědět, jaký termín vám nejlépe vyhovuje.

S pozdravem,
${userName}`;
    emailKeyArg = 'Přímý dotaz bez neověřených slibů s rychlou možností ověřit vzájemnou relevanci v 5–10 minutách.';
  } else if (tone === 'consultative') {
    emailBody = `${salutation}

${observationSection}

Věnuji se oblasti práce s poptávkami. Při komunikaci s firmami v oboru ${industry} vnímáme, že častou otázkou bývá přehledné odbavování zpráv bez zbytečné administrativy.

Napadlo mě, zda by pro vás v ${company} dávalo smysl zjednodušit tento proces a omezit ruční práci se zprávami.

Nechci nic nabízet naslepo – rád bych nejdříve v krátkém 5–10minutovém rozhovoru porozuměl vaší praxi. Dávalo by vám smysl si k tomu krátce zavolat? Dejte mi prosím vědět, kdy se vám to hodí.

S úctou,
${userName}`;
    emailKeyArg = 'Konzultační tón otevírá dialog otázkou na reálné potřeby místo tvrzení neověřených domněnek.';
  } else if (tone === 'case_study') {
    emailBody = `${salutation}

${observationSection}

Věnuji se oblasti práce s poptávkami. S firmami v oboru ${industry} jsme v poslední době probírali způsoby, jak zjednodušit příjem zpráv z webu a usnadnit koordinaci zakázek.

Napadlo mě, zda by pro vás v ${company} dávalo smysl podívat se na možnosti, jak tento proces zpříjemnit vám i zákazníkům.

Rád bych vám tyto zkušenosti nezávazně shrnul během krátkého 5–10minutového telefonátu. Kdy by se vám to v příštích dnech hodilo?

S pozdravem,
${userName}`;
    emailKeyArg = 'Zkušenosti z oboru jsou představeny jako nezávazná inspirace k prověření, nikoliv garantovaný výsledek.';
  } else {
    // Professional (default)
    emailBody = `${salutation}

${observationSection}

Věnuji se oblasti práce s poptávkami. Napadlo mě, zda by pro vás v ${company} dávalo smysl zjednodušit tento proces a omezit ruční práci se zprávami od zájemců.

Nechci předjímat vaše stávající postupy – rád bych nejdříve na 5–10 minut nezávazně zjistil, jak vám stávající řešení vyhovuje a zda je to pro vás vůbec aktuální téma.

Dávalo by vám smysl krátce si k tomu po telefonu popovídat? Dejte mi prosím vědět, jaký termín by vám vyhovoval.

S pozdravem,
${userName}`;
    emailKeyArg = 'Kultivovaný B2B tón vychází z 1 ověřeného detailu a nabízí nezávazný 5–10minutový hovor.';
  }

  const emailVerified = hasVerifiedEmail(lead);
  const phoneVerified = Boolean(lead.phone && lead.phone !== 'Nedostupné' && lead.phone.trim() !== '');
  const whatsAppVerified = hasVerifiedWhatsApp(lead);
  const emailSent = hasRealSentEmail(lead);
  const phoneMade = hasRealPhoneCall(lead);
  const isMeetingScheduled = lead.status === 'Schůzka';

  // Step 2 person formatting
  const personDisplayName = idealPersonName 
    ? `${idealPersonRole} (${idealPersonName})` 
    : `${idealPersonRole} – ${idealPersonSourceNote}`;

  // =========================================================================
  // CASE A: LEAD IS IN 'Schůzka' STATUS – MEETING PREPARATION & CONFIRMATION
  // =========================================================================
  if (isMeetingScheduled) {
    const meetingDateStr = lead.nextContactDate || lead.scheduledAt 
      ? formatCzechDateTime(lead.nextContactDate || lead.scheduledAt) 
      : 'dohodnutý termín';

    const meetingSteps: OutreachStep[] = [
      {
        stepNumber: 1,
        day: 1,
        type: emailVerified ? 'day1_email' : 'day1_phone',
        channel: emailVerified ? 'email' : 'phone',
        title: emailVerified ? '1. KROK – Potvrzení termínu e-mailem' : '1. KROK – Potvrzení termínu hovorem',
        subject: emailVerified ? `Potvrzení schůzky – ${company}` : undefined,
        content: `${salutation}\n\npotvrzuji naše setkání dohodnuté na ${meetingDateStr} ohledně ${company}.\n\nCílem schůzky je nezávazně projít vaše stávající potřeby v oblasti práce s poptávkami a ukázat vám konkrétní možnosti v praxi.\n\nTěším se na rozhovor.\n\nS pozdravem,\n${userName}`,
        callScript: `📞 TELEFONICKÉ POTVRZENÍ TERMÍNU SCHŮZKY\nOsoba: ${personDisplayName}\n\n„Dobrý den, tady ${userName}. Krátce volám k potvrzení našeho termínu schůzky na ${meetingDateStr}. Platí tento čas z vaší strany? Děkuji, těším se na slyšenou.“`,
        whatsappMessage: whatsAppVerified ? `Dobrý den, tady ${userName}. Potvrzuji naše setkání dohodnuté na ${meetingDateStr} ohledně ${company}. Těším se na slyšenou.` : undefined,
        keyArgument: 'Potvrzení schůzky eliminuje propadovost a zajišťuje profesionální přípravu.',
        personalizationBasis: 'Dohodnutá schůzka v CRM',
        recommendedTiming: 'Ihned po domluvě termínu',
        status: 'paused'
      },
      {
        stepNumber: 2,
        day: 3,
        type: whatsAppVerified ? 'day3_phone_whatsapp' : 'day3_phone',
        channel: 'phone',
        title: whatsAppVerified ? '2. KROK – Příprava podkladů (Telefon / WhatsApp)' : '2. KROK – Příprava podkladů hovorem',
        content: whatsAppVerified ? `Dobrý den, tady ${userName}. K našemu setkání na ${meetingDateStr} jsem si připravil 2 konkrétní podněty k ${observationData.observationTopic}. Přeji hezký den.` : `📞 PŘÍPRAVA NA SCHŮZKU\nOvěření podkladů k ${observationData.observationTopic}.`,
        callScript: `📞 PŘÍPRAVA NA SCHŮZKU (20 vteřin před termínem)\nOsoba: ${personDisplayName}\n\n„Dobrý den, tady ${userName}. K naší schůzce ${meetingDateStr} jsem si pro ${company} připravil konkrétní ukázku k ${observationData.observationTopic}. Chci se jen ujistit, zda platí domluvený čas a máte minutku.“`,
        whatsappMessage: whatsAppVerified ? `Dobrý den, tady ${userName}. K naší schůzce na ${meetingDateStr} jsem si připravil konkrétní podklady k ${observationData.observationTopic}.` : undefined,
        keyArgument: 'Cílené podklady před schůzkou zvyšují konverzi a udržují zájem.',
        personalizationBasis: 'Příprava na domluvené jednání',
        recommendedTiming: 'Den před termínem schůzky',
        status: 'paused'
      },
      {
        stepNumber: 3,
        day: 7,
        type: emailVerified ? 'day7_followup' : 'day7_phone',
        channel: emailVerified ? 'email' : 'phone',
        title: emailVerified ? '3. KROK – Shrnutí po schůzce e-mailem' : '3. KROK – Shrnutí po schůzce hovorem',
        subject: emailVerified ? `Shrnutí schůzky a další kroky – ${company}` : undefined,
        content: `${salutation}\n\nděkuji za dnešní rozhovor ohledně ${company}.\n\nV návaznosti na to, co jsme probírali, vám posílám shrnutí dohodnutých bodů a konkrétní návrh dalšího postupu.\n\nDejte mi prosím vědět, zda vám navržený termín vyhovuje.\n\nS pozdravem,\n${userName}`,
        callScript: `📞 NÁSLEDNÝ HOVOR PO SCHŮZCE\n„Dobrý den, tady ${userName}. Děkuji za náš hovor. Krátce volám k upřesnění dohodnutých kroků pro ${company}.“`,
        keyArgument: 'Okamžitá rekapitulace po schůzce posouvá obchod k nabídce.',
        personalizationBasis: 'Realizovaná schůzka',
        recommendedTiming: 'Do 24 hodin po proběhlé schůzce',
        status: 'paused'
      },
      {
        stepNumber: 4,
        day: 14,
        type: emailVerified ? 'day14_breakup' : 'day14_phone',
        channel: emailVerified ? 'email' : 'phone',
        title: emailVerified ? '4. KROK – Finální posun k nabídce e-mailem' : '4. KROK – Finální posun k nabídce hovorem',
        subject: emailVerified ? `Předání nabídky – ${company}` : undefined,
        content: `${salutation}\n\nposílám slíbené podklady a kalkulaci na základě naší schůzky.\n\nRád s vámi jednotlivé body v 5 minutách projdu a zodpovím případné dotazy.\n\nS pozdravem,\n${userName}`,
        callScript: `📞 DOTAŽENÍ NABÍDKY PO SCHŮZCE\n„Dobrý den, tady ${userName}. Posílal jsem slíbenou kalkulaci na základě naší schůzky. Máte prosím prostor na krátké ověření?“`,
        keyArgument: 'Návaznost na schůzku vedoucí k uzavření obchodu.',
        personalizationBasis: 'Závěrečná fáze po schůzce',
        recommendedTiming: 'Dle dohodnutého termínu odevzdání nabídky',
        status: 'paused'
      }
    ];

    return {
      id: `seq-${lead.id}-${Date.now()}`,
      tone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: meetingSteps,
      activeStepIndex: 0,
      isPaused: true,
      pausedReason: `Schůzka je domluvena na ${meetingDateStr}. Další automatické oslovení je pozastaveno.`
    };
  }

  // =========================================================================
  // CASE B: NO EMAIL VERIFIED (PHONE ONLY LEAD, e.g. BRIO Restaurant)
  // =========================================================================
  if (!emailVerified && phoneVerified) {
    const standaloneCallScript = `📞 SCÉNÁŘ HOVORU (SAMOSTATNÝ PRVNÍ KONTAKT)
Doporučená osoba: ${personDisplayName}

1. PŘEDSTAVENÍ A DŮVOD HOVORU (15 vteřin):
„Dobrý den, tady ${userName}. Obracím se na vás kvůli ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené ${observationData.observationTopic}. Máte prosím minutku?“

2. KONKRÉTNÍ NÁPAD K PROBRÁNÍ (20 vteřin):
„Mám jeden konkrétní nápad, který bych s vámi rád krátce probral. Rád bych se nejdříve otevřeně zeptal – jak dnes tuto oblast v ${company} řešíte? Je to pro vás aktuální téma?“

3. JEDNODUCHÉ CTA (10 vteřin):
„Pokud by vám dávalo smysl si k tomu na 5–10 minut nezávazně popovídat po telefonu, kdy by se vám to v tomto týdnu nejlépe hodilo?“`;

    const secondCallScript = `📞 SCÉNÁŘ HOVORU (2. POKUS O SPOJENÍ)
Doporučená osoba: ${personDisplayName}

1. PŘEDSTAVENÍ A POKUS O SPOJENÍ (15 vteřin):
„Dobrý den, tady ${userName}. Zkouším se krátce dovolat ohledně ${company}. Rád bych s vámi otevřel téma ${observationData.observationTopic}. Máte prosím prostor na 2 minuty?“

2. NÁMĚT K DISKUSI:
„Jde o konkrétní námět k zjednodušení práce se zájemci. Pokud máte chvilku, rád vám v jedné větě shrnu, oč jde.“`;

    const day7CallScript = `📞 SCÉNÁŘ HOVORU (7. DEN – NOVÝ VĚCNÝ PODNĚT)
Doporučená osoba: ${personDisplayName}

„Dobrý den, tady ${userName}. Krátce navazuji na svůj pokus o kontakt ohledně ${company}. Při procházení vaší prezentace mě zaujal ještě jeden detail k nabídce služeb. Dávalo by vám smysl krátce si k tomu na 3 minuty popovídat?“`;

    const day14CallScript = `📞 SCÉNÁŘ HOVORU (14. DEN – ZÁVĚREČNÝ RESPEKTUJÍCÍ KONTAKT)
Doporučená osoba: ${personDisplayName}

„Dobrý den, tady ${userName}. Volám naposledy ohledně ${company}. Pokud pro vás téma ${observationData.observationTopic} v tuto chvíli není aktuální, plně to respektuji a nebudu vás dál zdržovat. Pokud by se to v budoucnu změnilo, rád se s vámi spojím. Přeji hezký den.“`;

    const phoneOnlySteps: OutreachStep[] = [
      {
        stepNumber: 1,
        day: 1,
        type: 'day1_phone',
        channel: 'phone',
        title: '1. DEN – Prvotní telefonický hovor',
        callScript: standaloneCallScript,
        content: standaloneCallScript,
        keyArgument: 'Telefonický hovor je primárním ověřeným kontaktním kanálem. E-mail není veřejně dostupný.',
        personalizationBasis: `${observationData.basis} (E-mail není veřejně dostupný)`,
        recommendedTiming: 'Doporučeno: Úterý nebo středa 9:30 – 11:30',
        status: 'pending'
      },
      {
        stepNumber: 2,
        day: 3,
        type: whatsAppVerified ? 'day3_phone_whatsapp' : 'day3_phone',
        channel: 'phone',
        title: whatsAppVerified ? '3. DEN – Telefon / WhatsApp' : '3. DEN – Druhý telefonát / SMS',
        callScript: secondCallScript,
        whatsappMessage: whatsAppVerified ? `Dobrý den, tady ${userName}. Obracím se na vás ohledně ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené ${observationData.observationTopic}. Měl(a) byste prostor na 3minutový hovor? Děkuji!` : undefined,
        content: secondCallScript,
        keyArgument: whatsAppVerified ? 'WhatsApp je ověřený doplňkový kanál.' : 'WhatsApp není u tohoto čísla ověřen – doporučen telefonický hovor nebo SMS.',
        personalizationBasis: observationData.basis,
        recommendedTiming: 'Doporučeno: Čtvrtek 10:00 – 11:30 nebo 14:00 – 15:00',
        status: 'pending'
      },
      {
        stepNumber: 3,
        day: 7,
        type: 'day7_phone',
        channel: 'phone',
        title: '7. DEN – Následný telefonát s novým podnětem',
        callScript: day7CallScript,
        content: day7CallScript,
        keyArgument: 'Věcný následný telefonát s novým detailem bez předstírání odeslaného e-mailu.',
        personalizationBasis: 'Veřejná prezentace firmy (E-mail není veřejně dostupný)',
        recommendedTiming: 'Doporučeno: Úterý další týden 9:30 – 11:00',
        status: 'pending'
      },
      {
        stepNumber: 4,
        day: 14,
        type: 'day14_phone',
        channel: 'phone',
        title: '14. DEN – Závěrečný telefonát / uzavření',
        callScript: day14CallScript,
        content: day14CallScript,
        keyArgument: 'Zdvořilé telefonické uzavření kontaktu bez nátlaku.',
        personalizationBasis: 'Ukončení série pokusů o kontakt',
        recommendedTiming: 'Doporučeno: Čtvrtek po 14 dnech dopoledne',
        status: 'pending'
      }
    ];

    return {
      id: `seq-${lead.id}-${Date.now()}`,
      tone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: phoneOnlySteps,
      activeStepIndex: 0
    };
  }

  // =========================================================================
  // CASE C: STANDARD FLOW WITH VERIFIED EMAIL (+ PHONE)
  // =========================================================================
  // Step 2 Call script: strictly checks CRM history for real sent email!
  const callScript = emailSent
    ? `📞 SCÉNÁŘ HOVORU (NÁVAZNOST NA ODESLANÝ E-MAIL)
Doporučená osoba: ${personDisplayName}

1. PŘEDSTAVENÍ A ZMÍNKA E-MAILU (15 vteřin):
„Dobrý den, tady ${userName}. Volám vám v návaznosti na krátký e-mail, který jsem vám posílal ohledně ${company}${cityPhrase}. Máte prosím minutku?“

2. NÁMĚT K NEZÁVAZNÉMU OVĚŘENÍ (20 vteřin):
„V e-mailu jsem zmiňoval, jak máte řešené ${observationData.observationTopic}. Věnujeme se oblasti ${offer} a rád bych se nejdříve otevřeně zeptal – jak dnes tuto oblast v ${company} řešíte? Je to pro vás aktuální téma?“

3. JEDNODUCHÉ CTA (10 vteřin):
„Pokud by vám dávalo smysl si k tomu na 5–10 minut nezávazně sednout po telefonu bez jakéhokoliv závazku, kdy by se vám to v týdnu nejlépe hodilo?“`
    : phoneMade
      ? `📞 SCÉNÁŘ HOVORU (NÁVAZNOST NA PŘEDCHOZÍ HOVOR)
Doporučená osoba: ${personDisplayName}

1. PŘEDSTAVENÍ A NÁVAZNOST (15 vteřin):
„Dobrý den, tady ${userName}. Navazuji na náš předchozí telefonát ohledně ${company}. Máte prosím minutku?“

2. NÁMĚT K PROBRÁNÍ (20 vteřin):
„Chtěl jsem se krátce doptat, zda jste měli prostor zvážit téma, které jsme nakousli – konkrétně ${observationData.observationTopic}. Je to pro vás aktuální téma?“

3. JEDNODUCHÉ CTA (10 vteřin):
„Pokud by vám dávalo smysl si k tomu na 5 minut popovídat, kdy by se vám to nejlépe hodilo?“`
      : `📞 SCÉNÁŘ HOVORU (SAMOSTATNÝ PRVNÍ KONTAKT)
Doporučená osoba: ${personDisplayName}

1. PŘEDSTAVENÍ A DŮVOD HOVORU (15 vteřin):
„Dobrý den, tady ${userName}. Obracím se na vás kvůli ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené ${observationData.observationTopic}. Máte prosím minutku?“

2. KONKRÉTNÍ NÁPAD K PROBRÁNÍ (20 vteřin):
„Mám jeden konkrétní nápad, který bych s vámi rád krátce probral. Rád bych se nejdříve otevřeně zeptal – jak dnes tuto oblast v ${company} řešíte? Je to pro vás aktuální téma?“

3. JEDNODUCHÉ CTA (10 vteřin):
„Pokud by vám dávalo smysl si k tomu na 5–10 minut nezávazně popovídat po telefonu, kdy by se vám to v tomto týdnu nejlépe hodilo?“`;

  const whatsappMsg = emailSent
    ? (tone === 'direct'
      ? `Dobrý den, tady ${userName}. Posílal jsem vám krátký e-mail ohledně ${company}. Rád bych nejdříve nezávazně ověřil, zda je pro vás toto téma vůbec aktuální. Měl(a) byste prostor na 3minutový hovor? Děkuji!`
      : tone === 'consultative'
        ? `Dobrý den, tady ${userName}. Zkoušel jsem vás kontaktovat e-mailem ohledně práce s poptávkami v ${company}. Rád bych se jen nezávazně zeptal, jak dnes tuto oblast řešíte. Dávalo by vám smysl probrat to krátce po telefonu? Přeji hezký den.`
        : tone === 'case_study'
          ? `Dobrý den, tady ${userName}. Posílal jsem vám do e-mailu inspiraci z oboru ${industry} pro ${company}. Napadlo mě, zda by pro vás mělo smysl si tyto možnosti nezávazně projít. Měl(a) byste minutku na telefonát?`
          : `Dobrý den, tady ${userName}. Posílal jsem vám do e-mailu krátký dotaz ohledně práce s poptávkami pro ${company}. Rád bych se jen ujistil, zda zpráva dorazila a zda je toto téma pro vás aktuální. Dávalo by vám smysl probrat to krátce po telefonu? Děkuji.`)
    : (tone === 'direct'
      ? `Dobrý den, tady ${userName}. Obracím se na vás ohledně ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené ${observationData.observationTopic}. Mám jeden konkrétní nápad k této oblasti. Dávalo by vám smysl krátce si k tomu zavolat? Děkuji!`
      : tone === 'consultative'
        ? `Dobrý den, tady ${userName}. Obracím se na vás ohledně ${company}. Zaujal mě způsob, jak máte řešené ${observationData.observationTopic}. Rád bych se nezávazně zeptal, zda je pro vás tato oblast aktuální téma. Měl(a) byste prostor na krátký hovor? Přeji hezký den.`
        : tone === 'case_study'
          ? `Dobrý den, tady ${userName}. Píši ohledně ${company}. Při prohlídce vašeho webu mě zaujalo, jak řešíte ${observationData.observationTopic}. Rád bych vám nabídl nezávaznou inspiraci z oboru ${industry}. Měl(a) byste prostor na 5minutový hovor?`
          : `Dobrý den, tady ${userName}. Obracím se na vás ohledně ${company}. Při procházení vašeho webu mě zaujalo, jak máte řešené ${observationData.observationTopic}. Mám jeden konkrétní nápad, který bych s vámi rád krátce probral. Je to pro vás aktuální téma? Děkuji.`);

  // Step 3: Day 7 - Follow-up with New Argument or Short Reminder
  const day7Subject = emailSent ? `Re: ${emailSubject}` : `Dotaz k prezentaci – ${company}`;
  let day7Body = '';
  let day7KeyArg = '';
  let day7PersonalizationBasis = '';

  // Check if a second distinct verified signal exists in Lead Intelligence
  const secondSignal = intel?.signals && intel.signals.length > 1
    ? intel.signals.find((s, idx) => idx > 0 && s.observation && s.observation !== observationData.observationSentence)
    : undefined;

  const emailOpening = getEmailFollowUpOpening(lead, company);

  if (secondSignal?.observation) {
    const cleanSecondObs = cleanInternalAiTerminology(secondSignal.observation);
    day7PersonalizationBasis = secondSignal.source || 'Sekundární zjištění z veřejné prezentace';
    day7Body = `${salutation}

${emailOpening}

Při pohledu na vaši prezentaci mě zaujal ještě jeden detail: ${cleanSecondObs.charAt(0).toLowerCase() + cleanSecondObs.slice(1)}. Napadlo mě, zda by pro vás dávalo smysl zjednodušit tento proces a omezit ruční práci se zprávami.

Dávalo by vám smysl probrat to na 5–10 minut po telefonu?

S pozdravem,
${userName}`;
    day7KeyArg = 'Nový věcný úhel pohledu opírající se o další ověřený detail z prezentace firmy bez neověřených slibů.';
  } else {
    // If no distinct second signal exists, create a short respectful reminder instead of made-up claims
    day7PersonalizationBasis = 'Stručné připomenutí respektující čas majitele (bez vymyšlených tvrzení)';
    day7Body = `${salutation}

${emailOpening} Plně respektuji, že máte plný kalendář.

Chtěl jsem se jen bez nátlaku zeptat, zda je u vás téma práce s poptávkami v tomto období otevřené, nebo máte vše vyřešené k plné spokojenosti.

Dávalo by vám smysl probrat to krátce na 5 minut po telefonu?

S pozdravem,
${userName}`;
    day7KeyArg = 'Zdvořilé připomenutí respektující čas majitele bez jakéhokoliv nátlaku.';
  }

  // Step 4: Day 14 - Breakup Email (very short: 40–70 words, strictly respectful, no pressure)
  const day14Subject = `Uzavření dotazu – ${company}`;
  const day14PersonalizationBasis = 'Zdvořilé uzavření kontaktu bez nátlaku';
  const day14Body = `${salutation}

${emailSent ? 'jen poslední krátké připomenutí k mému předchozímu e-mailu.' : 'obracím se na vás naposledy s dotazem.'} Pokud automatizace práce s poptávkami pro ${company} v tuto chvíli není aktuální téma, je to úplně v pořádku.

Pokud ano, rád vám během 10 minut nezávazně ukážu, co jsem měl na mysli.

S pozdravem,
${userName}`;
  const day14KeyArg = 'Zdvořilé uzavření kontaktu bez nátlaku, které respektuje rozhodnutí firmy a zanechává profesionální dojem.';

  const steps: OutreachStep[] = [
    {
      stepNumber: 1,
      day: 1,
      type: 'day1_email',
      channel: 'email',
      title: '1. DEN – Personalizovaný e-mail',
      subject: emailSubject,
      content: emailBody,
      keyArgument: emailKeyArg,
      personalizationBasis: day1PersonalizationBasis,
      recommendedTiming: 'Doporučeno: Úterý nebo středa 8:30 – 10:30 dopoledne',
      status: 'pending'
    },
    {
      stepNumber: 2,
      day: 3,
      type: 'day3_phone_whatsapp',
      channel: phoneVerified ? 'phone' : 'phone',
      title: '3. DEN – Telefon / WhatsApp',
      content: whatsappMsg,
      callScript: callScript,
      whatsappMessage: whatsappMsg,
      keyArgument: emailSent 
        ? 'Telefonický follow-up navazuje na reálně odeslaný e-mail v CRM.' 
        : 'Samostatný telefonický hovor – v CRM není evidován odeslaný e-mail, hovor proto nepředpokládá předchozí kontakt.',
      personalizationBasis: day1PersonalizationBasis,
      recommendedTiming: 'Doporučeno: Čtvrtek 9:30 – 11:30 nebo 14:00 – 15:30',
      status: 'pending'
    },
    {
      stepNumber: 3,
      day: 7,
      type: 'day7_followup',
      channel: 'email',
      title: '7. DEN – Nový argument',
      subject: day7Subject,
      content: day7Body,
      keyArgument: day7KeyArg,
      personalizationBasis: day7PersonalizationBasis,
      recommendedTiming: 'Doporučeno: Úterý následující týden 9:00 – 11:00',
      status: 'pending'
    },
    {
      stepNumber: 4,
      day: 14,
      type: 'day14_breakup',
      channel: 'email',
      title: '14. DEN – Breakup e-mail',
      subject: day14Subject,
      content: day14Body,
      keyArgument: day14KeyArg,
      personalizationBasis: day14PersonalizationBasis,
      recommendedTiming: 'Doporučeno: Čtvrtek po 14 dnech ráno',
      status: 'pending'
    }
  ];

  return {
    id: `seq-${lead.id}-${Date.now()}`,
    tone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps,
    activeStepIndex: 0
  };
}

/**
 * Validates and auto-repairs Day 1 Cold Email content:
 * - Strict length: ideally 80–130 words, ABSOLUTE MAXIMUM 150 words
 * - Zero internal AI terminology (AI hypotéza, Lead Intelligence, signál, ověřený fakt, etc.)
 * - Validates natural B2B structure (verified detail + humble proposal + 10min call CTA + Martin)
 * - Auto-repairs immediately if invalid or over 150 words
 */
export function validateAndSanitizeDay1Email(
  content: string,
  lead: PotentialCustomerLead,
  options?: OutreachGeneratorOptions
): {
  content: string;
  wordCount: number;
  isValid: boolean;
  wasRepaired: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const company = (lead.companyName || (lead as any).company || (lead as any).name || '').trim();
  const hadInternalTerminology = hasInternalAiTerminology(content);
  const hadBrokenFragments = hasBrokenCompanyFragments(content);
  const hadUngroundedClaims = hasUngroundedClaims(content);

  let cleaned = cleanInternalAiTerminology(content || '');
  cleaned = cleanBrokenCompanyFragments(cleaned, company);
  cleaned = cleanUngroundedClaims(cleaned);
  let wCount = countWords(cleaned);

  if (wCount > 150) {
    errors.push(`Délka ${wCount} slov překračuje absolutní limit 150 slov.`);
  }
  if (wCount < 50) {
    errors.push(`Délka ${wCount} slov je příliš krátká pro B2B cold e-mail (minimum 50 slov).`);
  }
  if (hadInternalTerminology || hasInternalAiTerminology(cleaned)) {
    errors.push('E-mail obsahoval interní AI terminologii aplikace (AI hypotéza, Lead Intelligence, signál apod.).');
  }
  if (hadBrokenFragments || hasBrokenCompanyFragments(cleaned)) {
    errors.push('E-mail obsahoval poškozený fragment názvu firmy (např. „r.o.“).');
  }
  if (hadUngroundedClaims || hasUngroundedClaims(cleaned)) {
    errors.push('E-mail obsahoval nepodložené výsledkové tvrzení.');
  }

  // If text violates rules, auto-repair with verified deterministic generation
  if (errors.length > 0) {
    const fallbackSeq = generateOutreachSequence(lead, options);
    const repaired = fallbackSeq.steps[0].content;
    const repairedWords = countWords(repaired);
    return {
      content: repaired,
      wordCount: repairedWords,
      isValid: true,
      wasRepaired: true,
      errors
    };
  }

  return {
    content: cleaned,
    wordCount: wCount,
    isValid: true,
    wasRepaired: false,
    errors: []
  };
}

/**
 * End-to-end safety validator and auto-repair for the entire 4-step sequence.
 * Ensures customer-facing steps NEVER contain internal terminology and strictly respect length limits.
 */
export function validateAndSanitizeSequence(
  sequence: LeadOutreachSequence,
  lead: PotentialCustomerLead,
  options?: OutreachGeneratorOptions
): LeadOutreachSequence {
  const tone = sequence?.tone || options?.tone || 'professional';
  const deterministicSeq = generateOutreachSequence(lead, { ...options, tone });

  // If lead is in 'Schůzka', or has no verified email, return the verified deterministic sequence directly
  if (lead.status === 'Schůzka' || !hasVerifiedEmail(lead)) {
    return deterministicSeq;
  }

  if (!sequence || !Array.isArray(sequence.steps) || sequence.steps.length !== 4) {
    return deterministicSeq;
  }

  const company = (lead.companyName || (lead as any).company || (lead as any).name || '').trim();
  const emailSent = hasRealSentEmail(lead);

  const sanitizedSteps: OutreachStep[] = sequence.steps.map((step, idx) => {
    let cleanContent = cleanInternalAiTerminology(step.content || '');
    cleanContent = cleanBrokenCompanyFragments(cleanContent, company);
    cleanContent = cleanUngroundedClaims(cleanContent);

    let cleanSubject = step.subject ? cleanInternalAiTerminology(step.subject) : undefined;
    if (cleanSubject) {
      cleanSubject = cleanBrokenCompanyFragments(cleanSubject, company);
    }

    let cleanCallScript = step.callScript ? cleanInternalAiTerminology(step.callScript) : undefined;
    if (cleanCallScript) {
      cleanCallScript = cleanBrokenCompanyFragments(cleanCallScript, company);
      cleanCallScript = cleanUngroundedClaims(cleanCallScript);
    }

    let cleanWhatsapp = step.whatsappMessage ? cleanInternalAiTerminology(step.whatsappMessage) : undefined;
    if (cleanWhatsapp) {
      cleanWhatsapp = cleanBrokenCompanyFragments(cleanWhatsapp, company);
      cleanWhatsapp = cleanUngroundedClaims(cleanWhatsapp);
    }

    let cleanKeyArg = cleanInternalAiTerminology(step.keyArgument || '');
    if (
      cleanKeyArg.includes('Vícekanálový kontakt') ||
      cleanKeyArg.includes('multichannel') ||
      cleanKeyArg.includes('zvedá šanci')
    ) {
      cleanKeyArg = 'Krátký follow-up po prvním kontaktu umožňuje ověřit, zda firma zprávu zaznamenala a zda je téma pro ni aktuální.';
    }
    let cleanBasis = step.personalizationBasis ? cleanInternalAiTerminology(step.personalizationBasis) : undefined;

    // STEP 1: Day 1 Email / Phone
    if (idx === 0 || step.stepNumber === 1 || step.type === 'day1_email' || step.type === 'day1_phone') {
      if (!hasVerifiedEmail(lead) || step.channel === 'phone' || step.type === 'day1_phone') {
        return deterministicSeq.steps[0];
      }
      const validation = validateAndSanitizeDay1Email(step.content, lead, { ...options, tone });
      cleanContent = validation.content;

      // Ensure subject is natural, non-clickbait, 3-6 words, no leading dashes or fragments
      if (
        !cleanSubject || 
        cleanSubject.split(/\s+/).length > 7 || 
        hasInternalAiTerminology(cleanSubject) ||
        hasBrokenCompanyFragments(cleanSubject) ||
        cleanSubject.trim().startsWith('–') ||
        cleanSubject.trim().startsWith('-') ||
        cleanSubject.trim().length < 6
      ) {
        cleanSubject = deterministicSeq.steps[0].subject;
      }

      return {
        ...step,
        stepNumber: 1,
        day: 1,
        type: 'day1_email' as const,
        channel: 'email' as const,
        title: '1. DEN – Personalizovaný e-mail',
        subject: cleanSubject,
        content: cleanContent,
        keyArgument: cleanKeyArg || deterministicSeq.steps[0].keyArgument,
        personalizationBasis: cleanBasis || deterministicSeq.steps[0].personalizationBasis
      };
    }

    // STEP 2: Day 3 Phone call & WhatsApp
    if (idx === 1 || step.stepNumber === 2 || step.type === 'day3_phone_whatsapp' || step.type === 'day3_phone') {
      if (!hasVerifiedEmail(lead) || step.channel === 'phone') {
        return deterministicSeq.steps[1];
      }

      if (emailSent) {
        // REÁLNÝ E-MAIL JE V CRM EVIDOVÁN:
        // Telefonický krok MUSÍ vědět, že e-mail proběhl:
        // Zákaz označení "samostatný první kontakt" a zákaz tvrzení, že v CRM není evidován odeslaný e-mail.
        if (
          !cleanCallScript ||
          cleanCallScript.includes('SAMOSTATNÝ PRVNÍ KONTAKT') ||
          cleanCallScript.includes('SAMOSTATNÝ') ||
          !hasEmailReference(cleanCallScript)
        ) {
          cleanCallScript = deterministicSeq.steps[1].callScript;
        }

        if (
          !cleanKeyArg ||
          cleanKeyArg.includes('v CRM není evidován') ||
          cleanKeyArg.includes('Samostatný telefonický hovor') ||
          !hasEmailReference(cleanKeyArg)
        ) {
          cleanKeyArg = deterministicSeq.steps[1].keyArgument;
        }

        if (!cleanWhatsapp || !hasEmailReference(cleanWhatsapp)) {
          cleanWhatsapp = deterministicSeq.steps[1].whatsappMessage;
        }
      } else {
        // E-MAIL V CRM NENÍ EVIDOVÁN:
        // Hovor je samostatný kontakt – nesmí tvrdit ani předpokládat předchozí odeslaný e-mail
        if (cleanCallScript && hasEmailReference(cleanCallScript)) {
          cleanCallScript = deterministicSeq.steps[1].callScript;
        }
        if (cleanWhatsapp && hasEmailReference(cleanWhatsapp)) {
          cleanWhatsapp = deterministicSeq.steps[1].whatsappMessage;
        }
        if (cleanKeyArg && (cleanKeyArg.includes('navazuje na reálně odeslaný e-mail') || hasEmailReference(cleanKeyArg))) {
          cleanKeyArg = deterministicSeq.steps[1].keyArgument;
        }
      }

      if (cleanWhatsapp && (countWords(cleanWhatsapp) > 50 || hasInternalAiTerminology(cleanWhatsapp) || hasBrokenCompanyFragments(cleanWhatsapp))) {
        cleanWhatsapp = deterministicSeq.steps[1].whatsappMessage;
      }
      if (cleanCallScript && (hasInternalAiTerminology(cleanCallScript) || hasBrokenCompanyFragments(cleanCallScript))) {
        cleanCallScript = deterministicSeq.steps[1].callScript;
      }
      return {
        ...step,
        stepNumber: 2,
        day: 3,
        type: 'day3_phone_whatsapp' as const,
        channel: step.channel || deterministicSeq.steps[1].channel,
        title: '3. DEN – Telefon / WhatsApp',
        callScript: cleanCallScript || deterministicSeq.steps[1].callScript,
        whatsappMessage: cleanWhatsapp || deterministicSeq.steps[1].whatsappMessage,
        content: cleanWhatsapp || deterministicSeq.steps[1].whatsappMessage,
        keyArgument: cleanKeyArg || deterministicSeq.steps[1].keyArgument,
        personalizationBasis: cleanBasis || deterministicSeq.steps[1].personalizationBasis
      };
    }

    // STEP 3: Day 7 Follow-up email / Phone
    if (idx === 2 || step.stepNumber === 3 || step.type === 'day7_followup' || step.type === 'day7_phone') {
      if (!hasVerifiedEmail(lead) || step.channel === 'phone' || step.type === 'day7_phone') {
        return deterministicSeq.steps[2];
      }
      const wCount = countWords(cleanContent);
      const isWordCountInvalid = wCount > 120 || wCount < 30;
      const hasAiIssues = hasInternalAiTerminology(cleanContent) || hasBrokenCompanyFragments(cleanContent) || hasUngroundedClaims(cleanContent);

      if (emailSent) {
        // E-MAIL V CRM BYL REÁLNĚ ODESLÁN:
        const lacksEmailReference = !hasEmailReference(cleanContent) && !cleanContent.includes('navazuji na');
        const lacksSubjectRe = !cleanSubject || !cleanSubject.startsWith('Re:');
        
        // Temporal consistency check: Never allow "z minulého týdne" if < 5 days elapsed!
        const lastEmailDate = getLastRealSentEmailDate(lead);
        const daysDiff = getDaysSinceEmail(lastEmailDate);
        const hasPrematureLastWeekClaim = (daysDiff === null || daysDiff < 5) && /z\s+minulého\s+týdne/i.test(cleanContent);

        if (isWordCountInvalid || hasAiIssues || lacksEmailReference || lacksSubjectRe || hasPrematureLastWeekClaim) {
          cleanContent = deterministicSeq.steps[2].content;
          cleanSubject = deterministicSeq.steps[2].subject;
          cleanKeyArg = deterministicSeq.steps[2].keyArgument;
        }
      } else {
        // E-MAIL V CRM NEBYL ODESLÁN:
        if (isWordCountInvalid || hasAiIssues || hasEmailReference(cleanContent) || cleanSubject?.startsWith('Re:')) {
          cleanContent = deterministicSeq.steps[2].content;
          cleanSubject = deterministicSeq.steps[2].subject;
          cleanKeyArg = deterministicSeq.steps[2].keyArgument;
        }
      }

      return {
        ...step,
        stepNumber: 3,
        day: 7,
        type: 'day7_followup' as const,
        channel: 'email' as const,
        title: '7. DEN – Nový argument',
        subject: cleanSubject || deterministicSeq.steps[2].subject,
        content: cleanContent,
        keyArgument: cleanKeyArg || deterministicSeq.steps[2].keyArgument,
        personalizationBasis: cleanBasis || deterministicSeq.steps[2].personalizationBasis
      };
    }

    // STEP 4: Day 14 Breakup email / Phone
    if (idx === 3 || step.stepNumber === 4 || step.type === 'day14_breakup' || step.type === 'day14_phone') {
      if (!hasVerifiedEmail(lead) || step.channel === 'phone' || step.type === 'day14_phone') {
        return deterministicSeq.steps[3];
      }
      const wCount = countWords(cleanContent);
      const isWordCountInvalid = wCount > 80 || wCount < 25;
      const hasAiIssues = hasInternalAiTerminology(cleanContent) || hasBrokenCompanyFragments(cleanContent);

      if (emailSent) {
        // E-MAIL V CRM BYL REÁLNĚ ODESLÁN:
        const lacksEmailReference = !cleanContent.includes('předchozímu e-mailu') && !hasEmailReference(cleanContent);
        if (isWordCountInvalid || hasAiIssues || lacksEmailReference) {
          cleanContent = deterministicSeq.steps[3].content;
          cleanSubject = deterministicSeq.steps[3].subject;
          cleanKeyArg = deterministicSeq.steps[3].keyArgument;
        }
      } else {
        // E-MAIL V CRM NEBYL ODESLÁN:
        if (isWordCountInvalid || hasAiIssues || hasEmailReference(cleanContent) || cleanContent.includes('předchozímu e-mailu')) {
          cleanContent = deterministicSeq.steps[3].content;
          cleanSubject = deterministicSeq.steps[3].subject;
          cleanKeyArg = deterministicSeq.steps[3].keyArgument;
        }
      }

      return {
        ...step,
        stepNumber: 4,
        day: 14,
        type: 'day14_breakup' as const,
        channel: 'email' as const,
        title: '14. DEN – Breakup e-mail',
        subject: cleanSubject || deterministicSeq.steps[3].subject,
        content: cleanContent,
        keyArgument: cleanKeyArg || deterministicSeq.steps[3].keyArgument,
        personalizationBasis: cleanBasis || deterministicSeq.steps[3].personalizationBasis
      };
    }

    return step;
  });

  return {
    ...sequence,
    tone,
    steps: sanitizedSteps
  };
}

/**
 * Standardized single title for sequence step to eliminate "1. den • 1. den" duplicates
 */
export function getSequenceStepTitle(step?: { day?: number; type?: string; stepNumber?: number; title?: string; channel?: string } | null): string {
  if (!step) return '';
  if (step.title && (step.title.includes('KROK') || step.title.includes('telefon') || step.title.includes('Telefon') || step.title.includes('hovor') || step.title.includes('Hovor'))) {
    return step.title;
  }
  const day = step.day || (step.stepNumber === 1 ? 1 : step.stepNumber === 2 ? 3 : step.stepNumber === 3 ? 7 : 14);
  if (day === 1 || step.type === 'day1_email' || step.type === 'day1_phone' || step.stepNumber === 1) {
    if (step.channel === 'phone' || step.type === 'day1_phone') {
      return '1. DEN – Prvotní telefonický hovor';
    }
    return '1. DEN – Personalizovaný e-mail';
  }
  if (day === 3 || step.type === 'day3_phone_whatsapp' || step.type === 'day3_phone' || step.stepNumber === 2) {
    return '3. DEN – Telefon / WhatsApp';
  }
  if (day === 7 || step.type === 'day7_followup' || step.type === 'day7_phone' || step.stepNumber === 3) {
    if (step.channel === 'phone' || step.type === 'day7_phone') {
      return '7. DEN – Následný telefonát s novým podnětem';
    }
    return '7. DEN – Nový argument';
  }
  if (day === 14 || step.type === 'day14_breakup' || step.type === 'day14_phone' || step.stepNumber === 4) {
    if (step.channel === 'phone' || step.type === 'day14_phone') {
      return '14. DEN – Závěrečný telefonát / uzavření';
    }
    return '14. DEN – Breakup e-mail';
  }
  return step.title || `${day}. DEN`;
}

/**
 * Standardized short subtitle for step tabs (e.g. in OutreachStudio tab bar)
 */
export function getStepTabSubtitle(step?: { day?: number; type?: string; stepNumber?: number; title?: string; channel?: string; whatsappMessage?: string } | null): string {
  if (!step) return '';
  if (step.channel === 'phone' || step.type === 'day1_phone' || step.type === 'day3_phone' || step.type === 'day7_phone' || step.type === 'day14_phone') {
    if (step.stepNumber === 1 || step.type === 'day1_phone' || step.day === 1) {
      return 'Prvotní telefonický hovor';
    }
    if (step.stepNumber === 2 || step.type === 'day3_phone' || step.type === 'day3_phone_whatsapp' || step.day === 3) {
      return step.whatsappMessage ? 'Telefon / WhatsApp' : 'Druhý telefonát / SMS';
    }
    if (step.stepNumber === 3 || step.type === 'day7_phone' || step.day === 7) {
      return 'Následný telefonát';
    }
    if (step.stepNumber === 4 || step.type === 'day14_phone' || step.day === 14) {
      return 'Závěrečný telefonát';
    }
    return 'Telefonický hovor';
  }
  if (step.channel === 'whatsapp') {
    return 'WhatsApp zpráva';
  }
  // Email channel
  if (step.stepNumber === 1 || step.type === 'day1_email' || step.day === 1) {
    return 'Personalizovaný e-mail';
  }
  if (step.stepNumber === 2 || step.type === 'day3_phone_whatsapp' || step.day === 3) {
    return 'Telefon / WhatsApp';
  }
  if (step.stepNumber === 3 || step.type === 'day7_followup' || step.day === 7) {
    return 'Nový argument';
  }
  if (step.stepNumber === 4 || step.type === 'day14_breakup' || step.day === 14) {
    return 'Breakup e-mail';
  }
  return step.title?.replace(/^\d+\.\s*(DEN|KROK)\s*[–-]\s*/i, '') || 'Krok sekvence';
}

