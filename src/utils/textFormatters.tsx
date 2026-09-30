import React from 'react';

/**
 * Converts text containing HTML break tags (<br>, <br/>, </br>) to plain newlines,
 * strips <p> and </p> tags or converts them into clean paragraph breaks,
 * removes any remaining HTML tags safely, and decodes HTML entities.
 */
export function sanitizeReportText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') return String(text);

  return text
    // Replace <br>, <br/>, <br />, </br> with actual newlines
    .replace(/<\s*\/?\s*br\s*\/?>/gi, '\n')
    // Replace closing paragraph with double newline
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    // Remove opening paragraph
    .replace(/<\s*p\s*>/gi, '')
    // Remove other stray HTML tags
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    // QA Terminology & text corrections (Items 2, 6, 7, 8, 9, 10)
    .replace(/ztrvalá hodnota/gi, 'bod zvratu')
    .replace(/ztrvalé hodnoty/gi, 'bodu zvratu')
    .replace(/ztrvalou hodnotu/gi, 'bod zvratu')
    .replace(/celkový \/ obchodní orgán zvratu/gi, 'CELKOVÝ / PODNIKATELSKÝ BOD ZVRATU')
    .replace(/obchodní orgán zvratu/gi, 'podnikatelský bod zvratu')
    .replace(/odpovídá nabídce nabídky\?/gi, 'Odpovídá ideální zákazník hlavní nabídce?')
    .replace(/odpovídá prodejní nabídka\?/gi, 'Odpovídá prodejní kanál a způsob získávání zákazníků hlavní nabídce?')
    .replace(/celodenní sezóna u pc/gi, 'celodenní sezení u PC')
    .replace(/odkaz na nafotit/gi, 'pořízení referenčních fotografií')
    .replace(/počítače klienta/gi, 'vlastního stávajícího počítače')
    .replace(/spotřeba stavebního materiálu je 100% přeúčtována zákazníkovi/gi, 'model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb')
    .replace(/materiál je 100% přeúčtován zákazníkovi/gi, 'model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb')
    .replace(/materiálu je 100% přeúčtována/gi, 'materiálu je řešena zálohou nebo průběžnými platbami')
    .replace(/přímá spotřeba materiálu přeúčtována klientovi/gi, 'model předpokládá zahrnutí materiálu do nabídky a financování prostřednictvím zálohy nebo průběžných plateb')
    .replace(/s garantovaným termínem dokončení/gi, 's předem dohodnutým harmonogramem a čistým předáním')
    .replace(/v garantovaném termínu/gi, 'v dohodnutém termínu za definovaných podmínek')
    .replace(/garantovaný termín dokončení/gi, 'předem dohodnutý harmonogram')
    .replace(/garantovaným termínem/gi, 'dohodnutým harmonogramem')
    .replace(/smluvní garance pevného termínu dokončení/gi, 'smluvně dohodnutý harmonogram dokončení za definovaných podmínek')
    .replace(/s garantovanou pravidelností/gi, 's předem dohodnutou pravidelností')
    .replace(/nikoliv jistý příjem/gi, 'orientační výsledek modelového scénáře kapacity')
    .replace(/jistý příjem/gi, 'modelový provozní přebytek')
    .replace(/garantovaný příjem/gi, 'modelový provozní přebytek')
    .replace(/jistý výdělek/gi, 'orientační výsledek')
    .replace(/garantovaný výdělek/gi, 'orientační výsledek')
    .replace(/jistého příjmu/gi, 'modelového provozního přebytku')
    .replace(/garantovaného příjmu/gi, 'modelového provozního přebytku')
    .replace(/jistým příjmem/gi, 'modelovým provozním přebytkem')
    .replace(/garantovaným příjmem/gi, 'modelovým provozním přebytkem')
    .replace(/jistotu výdělku/gi, 'orientační modelový scénář')
    .replace(/0 kč fixní režie/gi, '0 Kč při využití bezplatných nástrojů a stávajícího vybavení')
    .replace(/diagnostická a uvolňující masáž/gi, 'vstupní konzultace + regenerační masáž')
    .replace(/diagnostická masáž/gi, 'vstupní konzultace + regenerační masáž')
    .replace(/vstupní diagnostika/gi, 'vstupní konzultace')
    .replace(/vstupní pohybové diagnostiky/gi, 'vstupní pohybové konzultace')
    .replace(/pohybová diagnostika/gi, 'pohybová konzultace')
    .replace(/diagnostika/gi, 'konzultace')
    .replace(/diagnostické pomůcky/gi, 'pomůcky pro mobilitu a cvičení')
    .replace(/trpící chronickými bolestmi zad a šíje/gi, 'lidé se sedavým zaměstnáním, rekreační sportovci a lidé hledající regeneraci a uvolnění')
    .replace(/reálné české ceny/gi, 'modelový cenový předpoklad')
    .replace(/ověřené tržní ceny/gi, 'modelový cenový předpoklad')
    .replace(/tržních benchmarkech/gi, 'modelových cenových předpokladech')
    // Normalize excessive consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Deeply sanitizes all string properties in an object or array.
 */
export function sanitizeAllStrings<T>(input: T): T {
  if (typeof input === 'string') {
    return sanitizeReportText(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeAllStrings(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const res: any = {};
    for (const key of Object.keys(input)) {
      res[key] = sanitizeAllStrings((input as any)[key]);
    }
    return res as T;
  }
  return input;
}

/**
 * React component to safely render report text with real newlines,
 * completely eliminating any raw <br> or HTML tags from appearing on screen or in PDF.
 */
export const FormattedReportText: React.FC<{
  text: string | null | undefined;
  className?: string;
  fallback?: string;
}> = ({ text, className = '', fallback = '' }) => {
  const cleaned = sanitizeReportText(text) || fallback;
  if (!cleaned) return null;

  return (
    <span className={`whitespace-pre-line ${className}`}>
      {cleaned}
    </span>
  );
};
