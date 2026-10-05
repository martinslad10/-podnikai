import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { 
  GA_MEASUREMENT_ID, 
  sendGtag, 
  trackPageView, 
  trackQuestionnaireStart, 
  trackQuestionnaireComplete, 
  trackCheckoutStart, 
  trackPurchase, 
  trackReportReady, 
  trackPdfDownload, 
  sanitizeUrlForAnalytics,
  resetAnalyticsStateForTests
} from '../src/utils/analytics';

// Mock window and dataLayer for Node environment
const mockDataLayer: any[] = [];
(global as any).window = {
  dataLayer: mockDataLayer,
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

const mockSessionStorage: Record<string, string> = {};
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

function getLastEvent(eventName?: string): any {
  if (!eventName) {
    return mockDataLayer[mockDataLayer.length - 1];
  }
  for (let i = mockDataLayer.length - 1; i >= 0; i--) {
    const entry = mockDataLayer[i];
    if (entry[0] === 'event' && entry[1] === eventName) {
      return entry;
    }
  }
  return null;
}

function countEvents(eventName: string): number {
  return mockDataLayer.filter(e => e[0] === 'event' && e[1] === eventName).length;
}

async function runAnalyticsTests() {
  console.log('================================================================');
  console.log('TESTING GOOGLE ANALYTICS 4 (GA4) INTEGRATION & EVENTS');
  console.log('================================================================');

  // TEST 1: Verification of Measurement ID in index.html
  console.log('\n[TEST 1: Verification of GA4 Tag & Measurement ID in index.html]');
  const indexHtmlPath = path.resolve('index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtml.includes('https://www.googletagmanager.com/gtag/js?id=G-CKLVMBFKM0'), 'index.html includes GA4 script src with G-CKLVMBFKM0');
  assert(indexHtml.includes("gtag('config', 'G-CKLVMBFKM0')"), 'index.html initializes gtag with G-CKLVMBFKM0');
  assert.strictEqual(GA_MEASUREMENT_ID, 'G-CKLVMBFKM0', 'analytics.ts constants match G-CKLVMBFKM0');
  console.log('  ✅ PASS: GA4 Google tag correctly present in index.html with Measurement ID G-CKLVMBFKM0');

  // TEST 2: Page View Tracking & Strict Token Sanitization
  console.log('\n[TEST 2: Standard page_view & Strict Privacy Sanitization]');
  trackPageView();
  const pageViewEvent = getLastEvent('page_view');
  assert(pageViewEvent, 'page_view event was recorded');
  const pageViewParams = pageViewEvent[2];
  assert(!pageViewParams.page_location.includes('secret-token-xyz'), 'page_location must never contain raw security tokens');
  assert(!pageViewParams.page_path.includes('secret-token-xyz'), 'page_path must never contain raw security tokens');
  assert(pageViewParams.page_location.includes('[REDACTED]'), 'Tokens are sanitized to [REDACTED]');
  console.log('  ✅ PASS: page_view tracked with automatic security token redaction');

  // Sanitizer test on emails and tokens
  const sampleWithEmail = 'https://podnikai.onrender.com/?user=jan.novak@example.com&token=abc12345';
  const sanitized = sanitizeUrlForAnalytics(sampleWithEmail);
  assert(!sanitized.includes('jan.novak@example.com'), 'Email is redacted');
  assert(!sanitized.includes('abc12345'), 'Token is redacted');
  console.log('  ✅ PASS: Privacy filter sanitizes emails and tokens from URLs');

  // TEST 3: questionnaire_start Event
  console.log('\n[TEST 3: questionnaire_start Event]');
  resetAnalyticsStateForTests();
  trackQuestionnaireStart();
  const qStart = getLastEvent('questionnaire_start');
  assert(qStart, 'questionnaire_start event recorded');
  assert.strictEqual(qStart[2].event_category, 'business_start');

  // Verify idempotency within the same questionnaire session
  const beforeCount = countEvents('questionnaire_start');
  trackQuestionnaireStart();
  const afterCount = countEvents('questionnaire_start');
  assert.strictEqual(beforeCount, afterCount, 'questionnaire_start does not duplicate on redundant calls in same session');
  console.log('  ✅ PASS: questionnaire_start tracked cleanly without duplicate firing');

  // TEST 4: questionnaire_complete Event
  console.log('\n[TEST 4: questionnaire_complete Event]');
  trackQuestionnaireComplete();
  const qComplete = getLastEvent('questionnaire_complete');
  assert(qComplete, 'questionnaire_complete event recorded');
  assert.strictEqual(qComplete[2].questions_count, 12, 'Includes 12 questions count');
  assert.strictEqual(qComplete[2].event_category, 'business_start');
  // Strict Privacy: Verify no answers or PII included
  assert(!qComplete[2].answers, 'No questionnaire answers sent to GA4');
  assert(!qComplete[2].email, 'No email sent to GA4');
  console.log('  ✅ PASS: questionnaire_complete tracked without sensitive data');

  // TEST 5: checkout_start Event
  console.log('\n[TEST 5: checkout_start Event]');
  trackCheckoutStart();
  const checkoutEvent = getLastEvent('checkout_start');
  assert(checkoutEvent, 'checkout_start event recorded');
  assert.strictEqual(checkoutEvent[2].value, 1990, 'Checkout value is 1 990 Kč');
  assert.strictEqual(checkoutEvent[2].currency, 'CZK', 'Currency is CZK');
  console.log('  ✅ PASS: checkout_start tracked with value: 1 990 CZK');

  // TEST 6: purchase Event (Server-Confirmed Only)
  console.log('\n[TEST 6: Server-Confirmed purchase Event]');
  const testOrderId = 'order-bs-test-999';
  const tracked1 = trackPurchase(testOrderId, 1990, 'CZK');
  assert.strictEqual(tracked1, true, 'First purchase tracking succeeded');

  const purchaseEvent = getLastEvent('purchase');
  assert(purchaseEvent, 'purchase event recorded');
  assert.strictEqual(purchaseEvent[2].transaction_id, testOrderId, 'transaction_id matches orderId');
  assert.strictEqual(purchaseEvent[2].value, 1990, 'Purchase value is 1 990 Kč');
  assert.strictEqual(purchaseEvent[2].currency, 'CZK', 'Currency is CZK');
  assert.strictEqual(purchaseEvent[2].items[0].price, 1990, 'Item price is 1 990 Kč');
  assert.strictEqual(purchaseEvent[2].items[0].quantity, 1, 'Quantity is 1');

  // Strict Privacy: Verify no orderToken or user email in purchase payload
  assert(!purchaseEvent[2].orderToken, 'No orderToken sent in purchase payload');
  assert(!purchaseEvent[2].clientEmail, 'No clientEmail sent in purchase payload');
  assert(!purchaseEvent[2].clientName, 'No clientName sent in purchase payload');

  // Verification of Anti-Duplication (e.g. from polling in loadOrder)
  const purchaseCountBefore = countEvents('purchase');
  const tracked2 = trackPurchase(testOrderId, 1990, 'CZK');
  assert.strictEqual(tracked2, false, 'Second purchase tracking for same order was prevented');
  const purchaseCountAfter = countEvents('purchase');
  assert.strictEqual(purchaseCountBefore, purchaseCountAfter, 'Duplicate polling does NOT fire duplicate purchase events');
  console.log('  ✅ PASS: purchase event tracked with strict server-side confirmation and duplicate prevention');

  // TEST 7: report_ready Event
  console.log('\n[TEST 7: report_ready Event]');
  const reportTracked1 = trackReportReady(testOrderId);
  assert.strictEqual(reportTracked1, true, 'Report ready tracked');
  const reportEvent = getLastEvent('report_ready');
  assert(reportEvent, 'report_ready event recorded');
  assert.strictEqual(reportEvent[2].order_id, testOrderId);

  // Verification of Anti-Duplication
  const reportCountBefore = countEvents('report_ready');
  const reportTracked2 = trackReportReady(testOrderId);
  assert.strictEqual(reportTracked2, false, 'Duplicate report_ready was prevented');
  const reportCountAfter = countEvents('report_ready');
  assert.strictEqual(reportCountBefore, reportCountAfter, 'report_ready does not duplicate during polling');
  console.log('  ✅ PASS: report_ready tracked with duplicate prevention');

  // TEST 8: pdf_download Event
  console.log('\n[TEST 8: pdf_download Event]');
  trackPdfDownload(testOrderId);
  const pdfEvent = getLastEvent('pdf_download');
  assert(pdfEvent, 'pdf_download event recorded');
  assert.strictEqual(pdfEvent[2].file_name, 'PODNIKAI_Report.pdf');
  assert.strictEqual(pdfEvent[2].order_id, testOrderId);
  console.log('  ✅ PASS: pdf_download tracked successfully with file_name: PODNIKAI_Report.pdf');

  console.log('\n================================================================');
  console.log('🎉 ALL GOOGLE ANALYTICS 4 TESTS 100% PASSED!');
  console.log('================================================================');
}

runAnalyticsTests().catch(err => {
  console.error('❌ Analytics test failed:', err);
  process.exit(1);
});
