/**
 * Validace a sanitizace kontaktních osob v Lead Intelligence a Outreach Studiu.
 * 
 * PRAVIDLA:
 * 1. Nikdy nepovažovat název značky, název firmy, část názvu webu, slogan, název služby
 *    nebo náhodný text nalezený na webu za jméno konkrétní osoby.
 * 2. Pokud není na veřejném webu jednoznačně uvedeno celé jméno konkrétní osoby
 *    a zároveň její role (majitel, jednatel, founder apod.), zobrazuje se pouze:
 *    „Majitel / jednatel společnosti“
 *    a:
 *    „Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.“
 * 3. Jméno se zobrazuje pouze tehdy, pokud je skutečně identifikováno jako osoba a zdroj to jednoznačně potvrzuje.
 */

export const BRAND_OR_NON_PERSON_TOKENS = new Set([
  'cowo', 'coworking', 'cb', 'bussaba', 'avista', 'tempo', 'orchidea',
  'studio', 'centrum', 'servis', 'salon', 'group', 'holding', 'agency',
  'czech', 'czechia', 'budejovice', 'budějovice', 'praha', 'brno', 'auto', 'firma',
  'spolecnost', 'společnost', 'sro', 'as', 'spol', 'gastro', 'pneu', 'stavby',
  'reality', 'stav', 'matrika', 'urad', 'úřad', 'magistrat', 'magistrát', 'mesto',
  'město', 'obec', 'technicke', 'technické', 'sluzby', 'služby', 'kadernictvi',
  'kadeřnictví', 'masaze', 'masáže', 'restaurace', 'hotel', 'penzion', 'obchod',
  'prodejna', 'eshop', 'web', 'online', 'kontakt', 'tym', 'tým', 'pobocka', 'pobočka',
  'nabidka', 'nabídka', 'cenik', 'ceník', 'poptavka', 'poptávka', 'rezervace',
  'informace', 'provozovna', 'republika', 'ceska', 'česká', 'ceske', 'české',
  'ceskych', 'českých', 'partner', 'partneri', 'partneři', 'klient', 'klienti',
  'novinky', 'blog', 'reference', 'uvod', 'úvod', 'onas', 'o nás', 'domů', 'home',
  'ka', 'cb', 'cz', 's.r.o', 's.r.o.', 'a.s.', 'z.s.', 'z.ú.',
  'spoluzakladatelka', 'zakladatelka', 'jednatelka', 'majitelka', 'jednatel', 'majitel'
]);

export const VALID_EXECUTIVE_ROLES = [
  'majitel', 'majitelka', 'jednatel', 'jednatelka',
  'zakladatel', 'zakladatelka', 'spoluzakladatel', 'spoluzakladatelka',
  'founder', 'co-founder', 'ceo', 'ředitel', 'ředitelka'
] as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'majitel': 'Majitel',
  'majitelka': 'Majitelka',
  'jednatel': 'Jednatel',
  'jednatelka': 'Jednatelka',
  'zakladatel': 'Zakladatel',
  'zakladatelka': 'Zakladatelka',
  'spoluzakladatel': 'Spoluzakladatel',
  'spoluzakladatelka': 'Spoluzakladatelka',
  'founder': 'Founder',
  'co-founder': 'Co-Founder',
  'ceo': 'CEO',
  'ředitel': 'Ředitel',
  'ředitelka': 'Ředitelka'
};

/**
 * Ověří, zda je role konkrétní exekutivní/majitelskou rolí uvedenou na webu
 */
export function isValidExecutiveRole(role?: string | null): boolean {
  if (!role || typeof role !== 'string') return false;
  const lower = role.toLowerCase().trim();
  return /\b(majitel(?:ka)?|jednatel(?:ka)?|zakladatel(?:ka)?|spoluzakladatel(?:ka)?|founder|co-founder|ceo|ředitel(?:ka)?)\b/i.test(lower);
}

/**
 * Zkontroluje, zda daný řetězec představuje platné plné jméno reálné osoby (např. "Týna Kocifajová", "Petr Novák")
 * a nikoli název značky, firmy, část názvu webu nebo náhodný text (např. "ka Cowo", "Cowo CB", "Bussaba").
 */
export function isValidPersonName(
  name: string | undefined | null,
  companyName?: string,
  websiteUrl?: string
): boolean {
  if (!name || typeof name !== 'string') return false;
  let trimmed = name.trim();
  // Strip common academic titles if present at the beginning
  trimmed = trimmed.replace(/^(?:ing|bc|mgr|mudr|mvdr|judr|rndr|paeddr|phdr|doc|prof)\.?\s+/i, '').trim();
  const parts = trimmed.split(/\s+/);

  // Musí mít 2 až 3 části (např. Jméno Příjmení nebo Jméno DruhéJméno Příjmení)
  if (parts.length < 2 || parts.length > 3) return false;

  // Odstranění firemních slov
  const compWords = (companyName || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 1);
  const domainClean = (websiteUrl || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[\/.-]+/)[0];

  const forbidden = new Set([...BRAND_OR_NON_PERSON_TOKENS, ...compWords]);
  if (domainClean && domainClean.length > 2) {
    forbidden.add(domainClean);
  }

  for (const part of parts) {
    if (part.length < 2) return false;
    const lower = part.toLowerCase();
    if (forbidden.has(lower)) return false;

    // Musí začínat velkým písmenem a pokračovat malými (česká abeceda)
    if (!/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/.test(part)) return false;
  }

  // Příjmení musí mít alespoň 3 znaky
  const surname = parts[parts.length - 1];
  if (surname.length < 3) return false;

  // Křestní jméno alespoň 2 znaky, a pokud má 2 znaky, musí být běžné jméno
  const firstName = parts[0];
  if (firstName.length < 2) return false;
  if (firstName.length === 2 && !['Jan', 'Eva', 'Dan', 'Ema', 'Ota', 'Vít'].includes(firstName)) {
    return false;
  }

  return true;
}

/**
 * Vyhledá na webu ověřenou kontaktní osobu, která má v textu jednoznačně uvedeno
 * CELÉ JMÉNO a ZÁROVEŇ ROLI (majitel, jednatel, founder apod.).
 */
export function extractVerifiedContactFromWeb(
  text: string | undefined | null,
  companyName?: string,
  websiteUrl?: string
): { name: string; role: string } | null {
  if (!text) return null;

  // Vzor 1: Role následovaná jménem (např. "Jednatel: Ing. Petr Svoboda" nebo "Majitel Jan Novák")
  const roleThenName = /\b(majitel(?:ka)?|jednatel(?:ka)?|zakladatel(?:ka)?|spoluzakladatel(?:ka)?|founder|co-founder|ceo|ředitel(?:ka)?)\b\s*[:–-]?\s*(?:(?:ing|bc|mgr|mudr|mvdr|judr|rndr|paeddr|phdr|doc|prof)\.?\s+)?([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,})?)/gi;
  let match;
  while ((match = roleThenName.exec(text)) !== null) {
    const rawRole = match[1].toLowerCase();
    const rawName = match[2].trim();
    if (isValidPersonName(rawName, companyName, websiteUrl)) {
      return {
        role: ROLE_DISPLAY_NAMES[rawRole] || 'Majitel / jednatel společnosti',
        name: rawName
      };
    }
  }

  // Vzor 2: Jméno následované rolí (např. "Týna Kocifajová, spoluzakladatelka Cowo CB")
  const nameThenRole = /\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,})?)\s*[,–-]?\s+\b(majitel(?:ka)?|jednatel(?:ka)?|zakladatel(?:ka)?|spoluzakladatel(?:ka)?|founder|co-founder|ceo|ředitel(?:ka)?)\b/gi;
  while ((match = nameThenRole.exec(text)) !== null) {
    const rawName = match[1].trim();
    const rawRole = match[2].toLowerCase();
    if (isValidPersonName(rawName, companyName, websiteUrl)) {
      return {
        role: ROLE_DISPLAY_NAMES[rawRole] || 'Majitel / jednatel společnosti',
        name: rawName
      };
    }
  }

  return null;
}

/**
 * Normalizuje objekt kontaktní osoby:
 * Pokud není na veřejném webu jednoznačně uvedeno celé jméno konkrétní osoby
 * a zároveň její role, vrací striktní fallback:
 * Role: „Majitel / jednatel společnosti“
 * Note: „Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.“
 */
export function sanitizeIdealContactPerson(
  person: any,
  companyName?: string,
  websiteUrl?: string
) {
  const rawName = person?.name;
  const rawRole = person?.role;
  const isNameVerified = isValidPersonName(rawName, companyName, websiteUrl);
  const isRoleVerified = isValidExecutiveRole(rawRole);

  // Musí být splněno obojí: ověřené konkrétní jméno osoby i konkrétní exekutivní role
  if (isNameVerified && isRoleVerified) {
    return {
      role: rawRole || 'Majitel / jednatel společnosti',
      name: rawName.trim(),
      confidence: 'verified_on_web' as const,
      sourceNote: person.sourceNote || 'Ověřeno z veřejné prezentace firmy.',
      source: person.source || (websiteUrl ? `Veřejný web firmy (${websiteUrl})` : 'Veřejný web firmy')
    };
  }

  return {
    role: 'Majitel / jednatel společnosti',
    confidence: 'derived_role_only' as const,
    sourceNote: 'Konkrétní jméno nebylo ve veřejných zdrojích jednoznačně ověřeno.',
    source: 'Obvyklá organizační struktura (doporučeno ověřit při kontaktu)'
  };
}
