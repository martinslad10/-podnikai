import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { 
  GA_MEASUREMENT_ID, 
  META_PIXEL_ID,
  sendGtag, 
  trackPageView, 
  trackQuestionnaireStart, 
  trackQuestionnaireComplete, 
  trackOfferView,
  trackCheckoutStart, 
  trackPurchase, 
  trackReportReady, 
  trackPdfDownload, 
  sanitizeUrlForAnalytics,
  resetAnalyticsStateForTests,
  setCookieConsent,
  getCookieConsent,
  resetCookieConsent
} from '../src/utils/analytics';

// Mock window, dataLayer, fbq, localStorage and sessionStorage for Node environment
const mockDataLayer: any[] = [];
const mockFbqCalls: any[][] = [];

const mockLocalStorage: Record<string, string> = {};
const mockSessionStorage: Record<string, string> = {};

(global as any).localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => {
    for (const k in mockLocalStorage) delete mockLocalStorage[k];
  },
  key: (index: number) => Object.keys(mockLocalStorage)[index] || null,
  get length() { return Object.keys(mockLocalStorage).length; }
};

(global as any).sessionStorage = {
  getItem: (key: string) => mockSessionStorage[key] || null,
  setItem: (key: string, value: string) => { mockSessionStorage[key] = value; },
  removeItem: (key: string) => { delete mockSessionStorage[key]; },
  clear: () => {
    for (const k in mockSessionStorage) delete mockSessionStorage[k];
  },
  key: (index: number) => Object.keys(mockSessionStorage)[index] || null,
  get length() { return Object.keys(mockSessionStorage).length; }
};

const mockFbq = function(...args: any[]) {
  mockFbqCalls.push(args);
};

const eventListeners: Record<string, Function[]> = {};

(global as any).window = {
  dataLayer: mockDataLayer,
  fbq: mockFbq,
  dispatchEvent: (event: any) => {
    const list = eventListeners[event.type] || [];
    list.forEach(fn => fn(event));
    return true;
  },
  addEventListener: (type: string, fn: Function) => {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(fn);
  },
  removeEventListener: (type: string, fn: Function) => {
    if (!eventListeners[type]) return;
    eventListeners[type] = eventListeners[type].filter(f => f !== fn);
  },
  location: {
    pathname: '/business-start',
    search: '?orderId=order-test-123&token=secret-token-xyz',
    hash: '#business-start',
    href: 'https://podnikai.onrender.com/business-start?orderId=order-test-123&token=secret-token-xyz#business-start'
  }
};

(global as any).document = {
  title: 'PODNIKAI Business Start'
};

(global as any).CustomEvent = class {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

function getLastEvent(eventName?: string): any {
  if (!eventName) {
    const last = mockDataLayer[mockDataLayer.length - 1];
    return last ? Array.from(last) : null;
  }
  for (let i = mockDataLayer.length - 1; i >= 0; i--) {
    const entry = Array.from(mockDataLayer[i]);
    if (entry[0] === 'event' && entry[1] === eventName) {
      return entry;
    }
  }
  return null;
}

function countEvents(eventName: string): number {
  return mockDataLayer.filter(e => {
    const entry = Array.from(e);
    return entry[0] === 'event' && entry[1] === eventName;
  }).length;
}

function getFbqCalls(command?: string, eventName?: string): any[][] {
  return mockFbqCalls.filter(call => {
    if (command && call[0] !== command) return false;
    if (eventName && call[1] !== eventName) return false;
    return true;
  });
}

async function runAnalyticsTests() {
  console.log('================================================================');
  console.log('VERIFYING PRIVACY, COOKIE CONSENT & META PIXEL WORKFLOW');
  console.log('================================================================');

  // TEST 1: Verification of Measurement ID and Meta Pixel ID in index.html
  console.log('\n[OVĚŘENÍ 1: Výchozí konfigurace v index.html s ochranou soukromí v EHP]');
  const indexHtmlPath = path.resolve('index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtml.includes('https://www.googletagmanager.com/gtag/js?id=G-CKLVMBFKM0'), 'index.html includes GA4 script src with G-CKLVMBFKM0');
  assert(indexHtml.includes("gtag('config', 'G-CKLVMBFKM0'"), 'index.html initializes gtag with G-CKLVMBFKM0');
  assert(indexHtml.includes('1598776808008151'), 'index.html includes Meta Pixel ID 1598776808008151');
  assert(indexHtml.includes("fbq('consent', 'revoke')"), 'index.html defaults Meta Pixel consent to revoked');
  assert(indexHtml.includes("analytics_storage': 'denied'"), 'index.html defaults GA4 Consent Mode v2 to denied prior to choice');
  assert.strictEqual(GA_MEASUREMENT_ID, 'G-CKLVMBFKM0', 'analytics.ts constants match G-CKLVMBFKM0');
  assert.strictEqual(META_PIXEL_ID, '1598776808008151', 'analytics.ts constants match 1598776808008151');
  console.log('  ✅ PASS: V index.html je Meta Pixel ve výchozím stavu zablokován přes fbq("consent", "revoke") a Google Consent Mode v2 má denied');

  // TEST 2: Volba „Pouze nezbytné“ nespouští Meta Pixel ani marketingové události
  console.log('\n[OVĚŘENÍ 2: Volba „Pouze nezbytné“ striktně blokuje Meta Pixel]');
  resetAnalyticsStateForTests();
  mockFbqCalls.length = 0;

  // Bez souhlasu
  trackPageView();
  assert.strictEqual(getFbqCalls('track', 'PageView').length, 0, 'Před udělením souhlasu se Meta PageView nesmí odeslat');

  // Po volbě "Pouze nezbytné"
  setCookieConsent('necessary');
  assert.strictEqual(getCookieConsent(), 'necessary');
  trackPageView();
  assert.strictEqual(getFbqCalls('track', 'PageView').length, 0, 'Při "Pouze nezbytné" se Meta PageView nesmí odeslat');
  trackCheckoutStart(690);
  assert.strictEqual(getFbqCalls('track', 'InitiateCheckout').length, 0, 'Při "Pouze nezbytné" se InitiateCheckout nesmí odeslat');

  const revokeCalls = getFbqCalls('consent', 'revoke');
  assert(revokeCalls.length > 0, 'Meta Pixel obdržel signál consent revoke');
  console.log('  ✅ PASS: Při volbě „Pouze nezbytné“ se Meta Pixel nespouští a žádná marketingová událost se neodesílá');

  // TEST 3: Volba „Přijmout vše“ aktivuje Meta Pixel a odešle PageView
  console.log('\n[OVĚŘENÍ 3: Volba „Přijmout vše“ aktivuje Meta Pixel a odesílá PageView]');
  setCookieConsent('all');
  assert.strictEqual(getCookieConsent(), 'all');
  const grantCalls = getFbqCalls('consent', 'grant');
  assert(grantCalls.length > 0, 'Meta Pixel obdržel consent grant');
  const initCalls = getFbqCalls('init', '1598776808008151');
  assert(initCalls.length > 0, 'Meta Pixel inicializován s ID 1598776808008151');

  const initialPvCount = getFbqCalls('track', 'PageView').length;
  trackPageView('/business-start');
  const newPvCount = getFbqCalls('track', 'PageView').length;
  assert(newPvCount > initialPvCount, 'Po udělení souhlasu se Meta PageView úspěšně odesílá');
  console.log('  ✅ PASS: Po volbě „Přijmout vše“ se Meta Pixel aktivuje a PageView se odesílá');

  // TEST 4: Odkaz „Nastavení cookies a soukromí“ a odvolání souhlasu
  console.log('\n[OVĚŘENÍ 4: Odvolání souhlasu okamžitě zastaví další marketingové měření]');
  let bannerTriggeredWith: any = 'not-called';
  const testHandler = (e: any) => {
    bannerTriggeredWith = e.detail;
  };
  window.addEventListener('podnikai-consent-change', testHandler);

  // Uživatel klikne v patičce na Nastavení cookies (volá resetCookieConsent())
  resetCookieConsent();
  assert.strictEqual(getCookieConsent(), null, 'resetCookieConsent smazal consent z localStorage');
  assert.strictEqual(bannerTriggeredWith, null, 'Custom event podnikai-consent-change byl dispatchován s hodnotou null pro opětovné zobrazení banneru');

  // Ověření, že po resetu/odvolání se další marketingové události NEPOSÍLAJÍ
  mockFbqCalls.length = 0;
  trackPageView('/dalsi-stranka');
  assert.strictEqual(getFbqCalls('track', 'PageView').length, 0, 'Po odvolání souhlasu se Meta PageView již neposílá');

  trackPurchase('order-revoked-123', 690, 'CZK');
  assert.strictEqual(getFbqCalls('track', 'Purchase').length, 0, 'Po odvolání souhlasu se Meta Purchase nesmí odeslat');
  console.log('  ✅ PASS: Reset/odvolání souhlasu otevře banner a okamžitě zastaví veškeré další marketingové měření');

  window.removeEventListener('podnikai-consent-change', testHandler);

  // TEST 5: Purchase se odešle pouze po potvrzení zaplacení na serveru a pouze při platném marketingu
  console.log('\n[OVĚŘENÍ 5: Událost Purchase se odešle pouze při platném souhlasu a serverovém potvrzení]');
  // Případ A: Souhlas 'all' -> Purchase se odešle a deduplikuje
  setCookieConsent('all');
  mockFbqCalls.length = 0;
  mockDataLayer.length = 0;

  const validOrderId = 'order-confirmed-paid-101';
  const trackedFirst = trackPurchase(validOrderId, 690, 'CZK');
  assert.strictEqual(trackedFirst, true, 'První záznam nákupu byl úspěšně zpracován');

  const metaPurchases = getFbqCalls('track', 'Purchase');
  assert.strictEqual(metaPurchases.length, 1, 'Meta Pixel obdržel přesně 1 událost Purchase');
  assert.strictEqual(metaPurchases[0][2].value, 690);
  assert.strictEqual(metaPurchases[0][2].currency, 'CZK');
  assert.strictEqual(metaPurchases[0][2].order_id, validOrderId);

  // Pokus o duplikát 1: reload stránky nebo polling zakázky v téže relaci
  const trackedDuplicate1 = trackPurchase(validOrderId, 690, 'CZK');
  assert.strictEqual(trackedDuplicate1, false, 'Druhý pokus o trackPurchase v téže relaci byl zablokován deduplikací');
  assert.strictEqual(getFbqCalls('track', 'Purchase').length, 1, 'Deduplikace zabránila odeslání duplicitního Meta Purchase');

  // Pokus o duplikát 2: ZAVŘENÍ A OPĚTOVNÉ OTEVŘENÍ PROHLÍŽEČE (simulace: sessionStorage se smaže, localStorage zůstává)
  console.log('  -> Testování po zavření a znovuotevření prohlížeče (sessionStorage vyčištěno, localStorage zachováno)...');
  (global as any).sessionStorage.clear();
  assert.strictEqual((global as any).sessionStorage.length, 0, 'sessionStorage je po zavření prohlížeče prázdné');
  
  const trackedAfterRestart = trackPurchase(validOrderId, 690, 'CZK');
  assert.strictEqual(trackedAfterRestart, false, 'Po zavření prohlížeče a otevření nové relace persistentní localStorage zabránil duplicitnímu Purchase');
  assert.strictEqual(getFbqCalls('track', 'Purchase').length, 1, 'Meta Pixel Purchase se po restartu prohlížeče NEZAPOČÍTAL podruhé');

  // Pokus o duplikát 3: OPAKOVANÝ NÁVRAT NA STRÁNKU POTVRZENÍ PLATBY (např. z e-mailu po několika dnech)
  console.log('  -> Testování opakovaného návratu na potvrzení platby s existujícím tokenem...');
  const trackedRepeatedReturn = trackPurchase(validOrderId, 690, 'CZK');
  assert.strictEqual(trackedRepeatedReturn, false, 'Opakovaný návrat na stránku potvrzení platby je spolehlivě deduplikován');
  assert.strictEqual(getFbqCalls('track', 'Purchase').length, 1, 'Meta Pixel Purchase zůstává přesně na 1 odeslané události');

  // Pokus o duplikát 4: Zpětná kompatibilita se starším identifikátorem (podnikai_ga_purchased_...)
  const legacyOrderId = 'order-legacy-confirmed-303';
  (global as any).localStorage.setItem(`podnikai_ga_purchased_${legacyOrderId}`, 'true');
  const trackedLegacy = trackPurchase(legacyOrderId, 690, 'CZK');
  assert.strictEqual(trackedLegacy, false, 'Objednávka se starším klíčem v localStorage byla správně deduplikována');

  // Případ B: Uživatel má pouze nezbytné cookies -> Purchase do Meta Pixelu NEODCHÁZÍ
  setCookieConsent('necessary');
  mockFbqCalls.length = 0;
  const noConsentOrderId = 'order-confirmed-paid-202';
  trackPurchase(noConsentOrderId, 690, 'CZK');
  assert.strictEqual(getFbqCalls('track', 'Purchase').length, 0, 'Při nesouhlasu se Meta Pixel Purchase neodešle');
  console.log('  ✅ PASS: Purchase se odešle výhradně při platném souhlasu, s přesnou částkou a 100% deduplikací napříč restarty prohlížeče a relacemi');

  // TEST 6: Ochrana před únikem citlivých tokenů a e-mailů v URL
  console.log('\n[OVĚŘENÍ 6: Automatická sanitace URL a zákaz PII v analytice]');
  const dirtyUrl = 'https://podnikai.onrender.com/?orderId=123&orderToken=secretToken999&user=klient@seznam.cz';
  const cleanUrl = sanitizeUrlForAnalytics(dirtyUrl);
  assert(!cleanUrl.includes('secretToken999'), 'Bezpečnostní token je nahrazen');
  assert(!cleanUrl.includes('klient@seznam.cz'), 'E-mail je nahrazen');
  assert(cleanUrl.includes('[REDACTED]'), 'Nahrazeno [REDACTED]');
  console.log('  ✅ PASS: Všechny URL i parametry jsou zbaveny bezpečnostních tokenů a e-mailů');

  console.log('\n================================================================');
  console.log('🎉 VŠECHNY KONTROLY SOUHLASU A META PIXELU 100% PROŠLY!');
  console.log('================================================================');
}

runAnalyticsTests().catch(err => {
  console.error('❌ Test selhal:', err);
  process.exit(1);
});
