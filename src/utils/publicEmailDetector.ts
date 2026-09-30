/**
 * Public Email Detector
 * 
 * Strictly extracts publicly listed email addresses directly from a company's official website.
 * Follows strict compliance rules:
 * - NEVER guesses emails based on company name, domain, owner name, or other patterns.
 * - Searches homepage, contact pages, footer, contact sections, mailto links, and plain text.
 * - Supports obfuscated patterns: info [at] firma.cz, info(at)firma.cz, info<span>@</span>firma.cz, etc.
 * - Categorizes found email as "Veřejně dostupný e-mail" (sourceType = official_website, status = public).
 * - Categorizes missing email as "E-mail nenalezen ve veřejných zdrojích".
 * - Never claims deliverability verification unless actual deliverability check was run.
 */

export interface PublicEmailMetadata {
  email: string;
  sourceUrl: string;
  sourceType: 'official_website';
  status: 'public' | 'not_found';
  detectedAt?: string;
  label?: string;
  details?: string;
}

export interface PublicEmailDetectionResult {
  found: boolean;
  email?: string;
  sourceUrl?: string;
  sourceType: 'official_website';
  status: 'public' | 'not_found';
  label: string;
  details?: string;
}

// Banned dummy, template, file extension, or platform emails
const BANNED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'domain.com',
  'domena.cz',
  'vaseweb.cz',
  'sentry.io',
  'wix.com',
  'wordpress.org',
  'schema.org',
  'google.com',
  'github.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'linkedin.com'
]);

const BANNED_EMAIL_USERNAMES = new Set([
  'your',
  'name',
  'user',
  'test',
  'demo',
  'sample',
  'vas',
  'vase',
  'jmeno',
  'prijmeni',
  'email',
  'mail',
  'noreply',
  'no-reply',
  'donotreply',
  'postmaster'
]);

const BANNED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
  'css', 'js', 'json', 'xml', 'woff', 'woff2', 'ttf', 'eot',
  'mp4', 'webm', 'mp3', 'wav', 'pdf', 'zip', 'gz'
]);

/**
 * Validates whether an extracted string is a genuine, plausible email.
 */
export function isValidPublicEmail(rawEmail: string): boolean {
  if (!rawEmail || typeof rawEmail !== 'string') return false;
  const clean = rawEmail.trim().toLowerCase();

  // Basic structure
  if (!clean.includes('@') || clean.length < 6 || clean.length > 100) return false;
  
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  
  const [user, domain] = parts;
  if (!user || !domain) return false;

  // Local part validation
  if (!/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(user)) return false;
  if (user.includes('..')) return false;
  if (BANNED_EMAIL_USERNAMES.has(user)) return false;

  // Domain validation
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return false;
  }
  if (domain.includes('..')) return false;

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || tld.length > 12) return false;

  // Reject file extensions disguised as domains/emails (e.g. image@2x.png)
  if (BANNED_EXTENSIONS.has(tld)) return false;

  // Reject banned domains
  if (BANNED_EMAIL_DOMAINS.has(domain)) return false;

  return true;
}

/**
 * Normalizes obfuscated text representations into standard email candidates.
 * Supports:
 * - info [at] firma.cz
 * - info (at) firma.cz
 * - info [AT] firma.cz
 * - info(at)firma.cz
 * - info<span>@</span>firma.cz
 * - info&#64;firma.cz, &commat;
 * - info [zavinac] firma.cz
 */
export function normalizeObfuscatedHtml(html: string): string {
  if (!html) return '';

  let text = html;

  // Replace HTML entities for @
  text = text.replace(/&#64;|&commat;|&#x40;/gi, '@');

  // Replace spans/tags that only contain @, e.g. info<span>@</span>cecovka.cz
  text = text.replace(/<span[^>]*>\s*@\s*<\/span>/gi, '@');
  text = text.replace(/<span[^>]*>\s*(?:at|zavin[aá][cč])\s*<\/span>/gi, '@');

  // Replace obfuscated [at], (at), [zavinac] flanked by reasonable chars
  text = text.replace(/([a-zA-Z0-9._%+-]+)\s*\[\s*(?:at|AT|zavin[aá][cč]|zavinac)\s*\]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2');
  text = text.replace(/([a-zA-Z0-9._%+-]+)\s*\(\s*(?:at|AT|zavin[aá][cč]|zavinac)\s*\)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2');

  // Replace dot obfuscation e.g. firma [dot] cz, firma (dot) cz
  text = text.replace(/@([a-zA-Z0-9.-]+)\s*\[\s*(?:dot|DOT|te[cč]ka)\s*\]\s*([a-zA-Z]{2,})/g, '@$1.$2');
  text = text.replace(/@([a-zA-Z0-9.-]+)\s*\(\s*(?:dot|DOT|te[cč]ka)\s*\)\s*([a-zA-Z]{2,})/g, '@$1.$2');

  return text;
}

/**
 * Extracts candidate emails from HTML and ranks them by relevance to the business.
 */
export function extractEmailsFromHtml(html: string, pageUrl: string): Array<{ email: string; priority: number; source: string }> {
  if (!html) return [];

  const foundMap = new Map<string, { email: string; priority: number; source: string }>();

  // Extract hostname domain for relevance boosting
  let websiteHost = '';
  try {
    const parsed = new URL(pageUrl);
    websiteHost = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    // ignore
  }

  // 1. Check mailto: links (highest confidence)
  const mailtoRegex = /href=["']mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:\?[^"']*)?["']/gi;
  let match: RegExpExecArray | null;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const raw = match[1].toLowerCase().trim();
    if (isValidPublicEmail(raw)) {
      const isDomainMatch = websiteHost && raw.endsWith(`@${websiteHost}`);
      const isInfo = /^(?:info|kontakt|rezervace|recepce|obchod|objednavky)@/i.test(raw);
      const priority = (isDomainMatch ? 10 : 5) + (isInfo ? 5 : 0);
      
      const existing = foundMap.get(raw);
      if (!existing || existing.priority < priority) {
        foundMap.set(raw, { email: raw, priority: priority + 20, source: 'mailto link' });
      }
    }
  }

  // 2. Check in footer block specifically
  const footerMatch = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch) {
    const footerNormalized = normalizeObfuscatedHtml(footerMatch[1]);
    const footerEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = footerEmailRegex.exec(footerNormalized)) !== null) {
      const raw = fMatch[0].toLowerCase().trim();
      if (isValidPublicEmail(raw)) {
        const isDomainMatch = websiteHost && raw.endsWith(`@${websiteHost}`);
        const isInfo = /^(?:info|kontakt|rezervace|recepce|obchod)@/i.test(raw);
        const priority = (isDomainMatch ? 10 : 4) + (isInfo ? 5 : 0);
        const existing = foundMap.get(raw);
        if (!existing || existing.priority < priority) {
          foundMap.set(raw, { email: raw, priority: priority + 15, source: 'web footer' });
        }
      }
    }
  }

  // 3. Check full normalized HTML body & text
  const normalizedHtml = normalizeObfuscatedHtml(html);
  const generalEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  while ((match = generalEmailRegex.exec(normalizedHtml)) !== null) {
    const raw = match[0].toLowerCase().trim();
    if (isValidPublicEmail(raw)) {
      const isDomainMatch = websiteHost && raw.endsWith(`@${websiteHost}`);
      const isInfo = /^(?:info|kontakt|rezervace|recepce|obchod|provoz|restaurace)@/i.test(raw);
      const priority = (isDomainMatch ? 8 : 2) + (isInfo ? 4 : 0);
      const existing = foundMap.get(raw);
      if (!existing || existing.priority < priority) {
        foundMap.set(raw, { email: raw, priority, source: 'page content' });
      }
    }
  }

  return Array.from(foundMap.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Finds candidate contact page URLs on the website (e.g. /kontakt, /o-nas, /kontakty).
 */
export function findContactPageUrls(html: string, baseUrl: string): string[] {
  if (!html || !baseUrl) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  let origin = '';
  try {
    const parsed = new URL(baseUrl);
    origin = parsed.origin;
    seen.add(parsed.href.replace(/\/$/, ''));
  } catch {
    return [];
  }

  const linkRegex = /<a\b[^>]*href=["']([^"'#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const anchorText = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase();

    // Check if link points to contact or about section
    const isContactPattern = /(?:kontakt|contact|o-nas|o-spolecnosti|kontakty)/i.test(href) ||
                             /(?:kontakt|kontakty|o nás|spojte se|napište nám)/i.test(anchorText);

    if (isContactPattern) {
      try {
        const resolved = new URL(href, baseUrl);
        // Only same-origin links
        if (resolved.origin === origin) {
          const cleanUrl = resolved.href.split('#')[0].replace(/\/$/, '');
          if (!seen.has(cleanUrl) && !cleanUrl.endsWith('.pdf') && !cleanUrl.endsWith('.jpg') && !cleanUrl.endsWith('.png')) {
            seen.add(cleanUrl);
            candidates.push(resolved.href);
            if (candidates.length >= 3) break;
          }
        }
      } catch {
        // invalid URL format, ignore
      }
    }
  }

  // Fallback probing targets if none found in HTML
  if (candidates.length === 0) {
    candidates.push(`${origin}/kontakt`);
    candidates.push(`${origin}/o-nas`);
  }

  return candidates.slice(0, 3);
}

/**
 * Robust fetch helper with timeout and Chrome User-Agent.
 */
async function fetchPageHtml(targetUrl: string, timeoutMs: number = 4000): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let normalized = targetUrl.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  try {
    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 PodnikAI/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return null;
    }

    const html = await response.text();
    return {
      html: html || '',
      finalUrl: response.url || normalized
    };
  } catch {
    clearTimeout(timeoutId);
    // If https failed, retry once with http
    if (normalized.startsWith('https://')) {
      try {
        const httpUrl = normalized.replace('https://', 'http://');
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 3500);

        const httpResponse = await fetch(httpUrl, {
          signal: retryController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 PodnikAI/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow'
        });

        clearTimeout(retryTimeout);
        if (httpResponse && httpResponse.ok) {
          const html = await httpResponse.text();
          return { html: html || '', finalUrl: httpResponse.url || httpUrl };
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}

/**
 * Main public email detection function.
 * Searches official website homepage and contact sections.
 * Strictly NEVER guesses emails!
 */
export async function detectPublicEmailFromWebsite(
  websiteUrl?: string,
  _companyName?: string
): Promise<PublicEmailDetectionResult> {
  if (!websiteUrl || websiteUrl === 'Nedostupné' || !websiteUrl.trim()) {
    return {
      found: false,
      sourceType: 'official_website',
      status: 'not_found',
      label: 'E-mail nenalezen ve veřejných zdrojích',
      details: 'Firma nemá uveden žádný veřejný web.'
    };
  }

  // 1. Fetch Homepage
  const homeResult = await fetchPageHtml(websiteUrl, 4000);
  if (!homeResult || !homeResult.html) {
    return {
      found: false,
      sourceUrl: websiteUrl,
      sourceType: 'official_website',
      status: 'not_found',
      label: 'E-mail nenalezen ve veřejných zdrojích',
      details: 'Oficiální web firmy nebyl v tuto chvíli dostupný.'
    };
  }

  // Extract from homepage
  const homeEmails = extractEmailsFromHtml(homeResult.html, homeResult.finalUrl);
  
  // If high-confidence email found on homepage (e.g. mailto or info@ matching domain)
  if (homeEmails.length > 0 && homeEmails[0].priority >= 15) {
    return {
      found: true,
      email: homeEmails[0].email,
      sourceUrl: homeResult.finalUrl,
      sourceType: 'official_website',
      status: 'public',
      label: 'Veřejně dostupný e-mail',
      details: `Nalezeno na úvodní stránce oficiálního webu (${homeEmails[0].source})`
    };
  }

  // 2. Discover and check contact subpages (e.g. /kontakt, /o-nas)
  const contactUrls = findContactPageUrls(homeResult.html, homeResult.finalUrl);
  let bestContactEmail: { email: string; priority: number; source: string; url: string } | null = null;

  for (const cUrl of contactUrls) {
    try {
      const contactResult = await fetchPageHtml(cUrl, 3500);
      if (contactResult && contactResult.html) {
        const cEmails = extractEmailsFromHtml(contactResult.html, contactResult.finalUrl);
        if (cEmails.length > 0) {
          const candidate = cEmails[0];
          if (!bestContactEmail || candidate.priority > bestContactEmail.priority) {
            bestContactEmail = {
              ...candidate,
              url: contactResult.finalUrl
            };
          }
          // If we found a high priority email on contact page, stop searching
          if (candidate.priority >= 15) break;
        }
      }
    } catch {
      // ignore single subpage failure
    }
  }

  // Pick the best email between contact page and homepage
  if (bestContactEmail && (!homeEmails.length || bestContactEmail.priority >= homeEmails[0].priority)) {
    return {
      found: true,
      email: bestContactEmail.email,
      sourceUrl: bestContactEmail.url,
      sourceType: 'official_website',
      status: 'public',
      label: 'Veřejně dostupný e-mail',
      details: `Nalezeno na kontaktní stránce oficiálního webu (${bestContactEmail.source})`
    };
  }

  if (homeEmails.length > 0) {
    return {
      found: true,
      email: homeEmails[0].email,
      sourceUrl: homeResult.finalUrl,
      sourceType: 'official_website',
      status: 'public',
      label: 'Veřejně dostupný e-mail',
      details: `Nalezeno na oficiálním webu (${homeEmails[0].source})`
    };
  }

  // No email found on website or contact subpages
  return {
    found: false,
    sourceUrl: homeResult.finalUrl || websiteUrl,
    sourceType: 'official_website',
    status: 'not_found',
    label: 'E-mail nenalezen ve veřejných zdrojích',
    details: 'Na oficiálním webu firmy ani v sekci kontakt nebyl nalezen žádný veřejný e-mail.'
  };
}
