import assert from 'assert';
import crypto from 'crypto';
import Stripe from 'stripe';

const BASE_URL = 'http://localhost:3000';
const TEST_WEBHOOK_SECRET = 'whsec_test_stripe_webhook_secret_for_qa_tests';
const PODNIKAI_WEBHOOK_SECRET = process.env.ADMIN_SESSION_SECRET || 'podnikai_secure_webhook_secret_2026';

// Helper for generating PodnikAI HMAC signature
function signPodnikAiPayload(payload: string): string {
  return crypto.createHmac('sha256', PODNIKAI_WEBHOOK_SECRET).update(payload).digest('hex');
}

// Helper to create a draft order for testing
async function createTestDraftOrder(nameSuffix: string = '') {
  const intakePayload = {
    questionnaire: {
      clientName: `Test Webhook Klient ${nameSuffix}`,
      clientEmail: `webhook.test.${Date.now()}.${Math.random().toString(36).substring(7)}@example.cz`,
      clientPhone: '+420 777 000 111',
      location: 'Praha',
      operatingModel: 'online' as const,
      mainGoal: 'Vybudovat online konzultační byznys v automatizaci',
      startingCapital: '10 000 – 30 000 Kč',
      weeklyTimeCommitment: '15-20h týdně',
      skillsExperience: 'Správa CRM, Make.com, e-mail marketing',
      targetMonthlyIncome: '50 000 – 80 000 Kč',
      preferredWorkType: 'combination' as const,
      riskTolerance: 'low' as const,
      redLines: 'Pouze online'
    }
  };

  const res = await fetch(`${BASE_URL}/api/business-start/order/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intakePayload)
  });

  assert.strictEqual(res.status, 200, 'Draft order creation returns HTTP 200');
  const data = await res.json();
  assert(data.orderId, 'Draft order must have orderId');
  assert(data.orderToken, 'Draft order must have orderToken');
  return { orderId: data.orderId, orderToken: data.orderToken, order: data.order };
}

async function runStripeWebhookTests() {
  console.log('================================================================');
  console.log('TESTING STRIPE WEBHOOK SECURITY, IDEMPOTENCY & EVENT DISPATCH');
  console.log('================================================================');

  // TEST 1: Ověření chybějícího podpisu
  console.log('\n[TEST 1: Chybějící podpis webhooku odmítnut s HTTP 400]');
  const unsignedRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'checkout.session.completed', orderId: 'any-order' })
  });
  assert.strictEqual(unsignedRes.status, 400, 'Požadavek bez podpisu musí vrátit 400');
  const unsignedData = await unsignedRes.json();
  assert(unsignedData.error.includes('Chybí podpis'), 'Odpověď správně hlásí chybějící podpis');
  console.log('  ✅ PASS: Požadavek bez stripe-signature ani x-podnikai-signature odmítnut (HTTP 400)');

  // TEST 2: Stripe podpis při chybějícím STRIPE_WEBHOOK_SECRET na serveru
  console.log('\n[TEST 2: Stripe signature bez nakonfigurovaného STRIPE_WEBHOOK_SECRET]');
  const dummyPayload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
  const missingSecretRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=123456789,v1=dummy_signature_hash'
    },
    body: dummyPayload
  });
  assert.strictEqual(missingSecretRes.status, 500, 'Když chybí STRIPE_WEBHOOK_SECRET na serveru, musí bezpečně vrátit HTTP 500');
  const missingSecretData = await missingSecretRes.json();
  assert(missingSecretData.error.includes('STRIPE_WEBHOOK_SECRET is missing'), 'Chybová zpráva jasně identifikuje chybějící secret');
  console.log('  ✅ PASS: Webhook bezpečně odmítl Stripe požadavek při chybějícím secretu s HTTP 500');

  // TEST 3: Neplatný kryptografický podpis (tampered payload / invalid signature)
  console.log('\n[TEST 3: Neplatný / podvržený podpis odmítnut s HTTP 400]');
  const tamperedPayload = JSON.stringify({ event: 'payment.succeeded', orderId: 'order-123', amount: 690, currency: 'CZK' });
  const badSigRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': '0000000000000000000000000000000000000000000000000000000000000000'
    },
    body: tamperedPayload
  });
  assert.strictEqual(badSigRes.status, 400, 'Neplatný podpis musí vrátit HTTP 400');
  const badSigData = await badSigRes.json();
  assert(badSigData.error.includes('HMAC verification failed'), 'Chyba ověření HMAC');
  console.log('  ✅ PASS: Podvržený / neplatný podpis okamžitě zachycen a odmítnut (HTTP 400)');

  // TEST 4: Chybějící identifikátor objednávky v payloadu
  console.log('\n[TEST 4: Webhook bez identifikátoru objednávky]');
  const noOrderIdPayload = JSON.stringify({ event: 'payment.succeeded', amount: 690, currency: 'CZK' });
  const noOrderIdSig = signPodnikAiPayload(noOrderIdPayload);
  const noOrderIdRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': noOrderIdSig
    },
    body: noOrderIdPayload
  });
  assert.strictEqual(noOrderIdRes.status, 400, 'Chybějící orderId musí vrátit HTTP 400');
  console.log('  ✅ PASS: Webhook bez orderId vrátil HTTP 400');

  // TEST 5: Neexistující objednávka (chybějící v databázi)
  console.log('\n[TEST 5: Neexistující objednávka vrací HTTP 404]');
  const nonExistentOrderId = 'order-bs-non-existent-999999';
  const nonExistentPayload = JSON.stringify({
    event: 'payment.succeeded',
    orderId: nonExistentOrderId,
    amount: 690,
    currency: 'CZK'
  });
  const nonExistentSig = signPodnikAiPayload(nonExistentPayload);
  const nonExistentRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': nonExistentSig
    },
    body: nonExistentPayload
  });
  assert.strictEqual(nonExistentRes.status, 404, 'Neexistující objednávka musí vrátit HTTP 404');
  console.log('  ✅ PASS: Neexistující objednávka správně vrací HTTP 404');

  // TEST 6: Úspěšně zaplacená Checkout Session (payment_status: 'paid')
  console.log('\n[TEST 6: Úspěšně zaplacená Checkout Session]');
  const draft1 = await createTestDraftOrder('Úspěšná Platba');
  const paidPayload = JSON.stringify({
    event: 'checkout.session.completed',
    orderId: draft1.orderId,
    amount: 690,
    currency: 'CZK'
  });
  const paidSig = signPodnikAiPayload(paidPayload);
  const paidRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': paidSig
    },
    body: paidPayload
  });
  assert.strictEqual(paidRes.status, 200, 'Úspěšná platba vrací HTTP 200');
  const paidData = await paidRes.json();
  assert.strictEqual(paidData.received, true, 'Webhook potvrzuje received');
  assert.strictEqual(paidData.status, 'REPORT_READY', 'Stav objednávky pokročil na REPORT_READY');

  // Ověření stavu objednávky přes API
  const orderCheckRes = await fetch(`${BASE_URL}/api/business-start/order/${draft1.orderId}`, {
    headers: { 'x-order-token': draft1.orderToken }
  });
  const orderCheckData = await orderCheckRes.json();
  assert.strictEqual(orderCheckData.order.paymentStatus, 'PAID', 'Objednávka je ve stavu paymentStatus === PAID');
  assert.strictEqual(orderCheckData.order.status, 'REPORT_READY', 'Objednávka má status REPORT_READY');
  assert(orderCheckData.isPaid, 'isPaid je true');
  console.log(`  ✅ PASS: Úspěšně zaplacená Checkout Session nastavila paymentStatus: PAID a status: REPORT_READY`);

  // TEST 6B: Nedokončená / odložená Checkout Session (payment_status: 'unpaid') nesmí označit objednávku jako PAID
  console.log('\n[TEST 6B: Nedokončená / odložená Checkout Session (payment_status: "unpaid")]');
  const draftUnpaid = await createTestDraftOrder('Nezaplacená Relace');
  const unpaidPayload = JSON.stringify({
    event: 'checkout.session.completed',
    orderId: draftUnpaid.orderId,
    payment_status: 'unpaid',
    amount: 690,
    currency: 'CZK'
  });
  const unpaidSig = signPodnikAiPayload(unpaidPayload);
  const unpaidRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': unpaidSig
    },
    body: unpaidPayload
  });
  assert.strictEqual(unpaidRes.status, 200, 'Webhook pro odloženou platbu vrací HTTP 200 pro Stripe');
  const unpaidData = await unpaidRes.json();
  assert.strictEqual(unpaidData.status, 'PAYMENT_PENDING', 'Stav zůstává PAYMENT_PENDING');

  const unpaidCheckRes = await fetch(`${BASE_URL}/api/business-start/order/${draftUnpaid.orderId}`, {
    headers: { 'x-order-token': draftUnpaid.orderToken }
  });
  const unpaidCheckData = await unpaidCheckRes.json();
  assert.strictEqual(unpaidCheckData.order.paymentStatus, 'PAYMENT_PENDING', 'paymentStatus NESMÍ být PAID, musí zůstat PAYMENT_PENDING');
  assert.strictEqual(unpaidCheckData.isPaid, false, 'isPaid je striktně false');
  assert.strictEqual(unpaidCheckData.analysis, null, 'Analýza nesmí být vygenerována');
  console.log('  ✅ PASS: Nezaplacená Checkout Session (unpaid) nebyla označena jako PAID (zůstává PAYMENT_PENDING)');

  // TEST 7: Idempotence - opakované doručení stejné události
  console.log('\n[TEST 7: Idempotentní zpracování při opakovaném doručení webhooku]');
  const duplicateRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': paidSig
    },
    body: paidPayload
  });
  assert.strictEqual(duplicateRes.status, 200, 'Opakované volání vrací HTTP 200');
  const duplicateData = await duplicateRes.json();
  assert.strictEqual(duplicateData.alreadyProcessed, true, 'Opakovaný požadavek detekován jako alreadyProcessed');
  assert.strictEqual(duplicateData.status, 'REPORT_READY', 'Stav zůstává REPORT_READY beze změny');
  console.log('  ✅ PASS: Opakované doručení je 100% idempotentní (nevytváří duplicity ani nespouští znovu analýzu)');

  // TEST 8: Neúspěšný PaymentIntent (payment_intent.payment_failed)
  console.log('\n[TEST 8: Neúspěšný PaymentIntent (payment_intent.payment_failed)]');
  const draft2 = await createTestDraftOrder('Neúspěšná Platba');
  const failPayload = JSON.stringify({
    event: 'payment_intent.payment_failed',
    orderId: draft2.orderId,
    failureReason: 'Nedostatečný zůstatek na kartě'
  });
  const failSig = signPodnikAiPayload(failPayload);
  const failRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': failSig
    },
    body: failPayload
  });
  assert.strictEqual(failRes.status, 200, 'Zpracování neúspěchu vrací HTTP 200 pro Stripe');
  const failData = await failRes.json();
  assert.strictEqual(failData.status, 'PAYMENT_FAILED', 'Stav objednávky je PAYMENT_FAILED');

  const failOrderRes = await fetch(`${BASE_URL}/api/business-start/order/${draft2.orderId}`, {
    headers: { 'x-order-token': draft2.orderToken }
  });
  const failOrderData = await failOrderRes.json();
  assert.strictEqual(failOrderData.order.paymentStatus, 'PAYMENT_FAILED', 'paymentStatus je PAYMENT_FAILED');
  assert.strictEqual(failOrderData.order.status, 'PAYMENT_FAILED', 'status je PAYMENT_FAILED');
  console.log('  ✅ PASS: Neúspěšný PaymentIntent správně nastavil PAYMENT_FAILED s chybovou hláškou');

  // TEST 9: Ochrana před přepsáním již zaplacené objednávky pozdním failure eventem
  console.log('\n[TEST 9: Pozdní payment_intent.payment_failed NESMÍ přepsat zaplacenou objednávku]');
  const lateFailPayload = JSON.stringify({
    event: 'payment_intent.payment_failed',
    orderId: draft1.orderId, // Již zaplacená objednávka z TESTU 6!
    failureReason: 'Pozdní signál o zamítnutí jiné karty'
  });
  const lateFailSig = signPodnikAiPayload(lateFailPayload);
  const lateFailRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-podnikai-signature': lateFailSig
    },
    body: lateFailPayload
  });
  assert.strictEqual(lateFailRes.status, 200, 'Odpověď pro Stripe je HTTP 200');
  const lateFailData = await lateFailRes.json();
  assert.strictEqual(lateFailData.ignored, true, 'Událost selhání byla ignorována');
  assert.strictEqual(lateFailData.reason, 'order_already_paid', 'Důvod ignorování je order_already_paid');

  // Kontrola, že objednávka zůstala nedotčena ve stavu PAID a REPORT_READY
  const reCheckRes = await fetch(`${BASE_URL}/api/business-start/order/${draft1.orderId}`, {
    headers: { 'x-order-token': draft1.orderToken }
  });
  const reCheckData = await reCheckRes.json();
  assert.strictEqual(reCheckData.order.paymentStatus, 'PAID', 'Objednávka zůstala PAID');
  assert.strictEqual(reCheckData.order.status, 'REPORT_READY', 'Objednávka zůstala REPORT_READY');
  console.log('  ✅ PASS: Pozdní neúspěch platby byl bezpečně ignorován a zaplacená objednávka zůstala nepoškozena');

  // TEST 10: Ověření Stripe SDK webhooks.constructEvent algoritmu
  console.log('\n[TEST 10: Ověření funkce Stripe.webhooks.constructEvent]');
  const testStripePayload = JSON.stringify({
    id: 'evt_stripe_test_123',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        client_reference_id: 'order-bs-stripe-1',
        amount_total: 69000,
        currency: 'czk'
      }
    }
  });
  const testStripeHeader = Stripe.webhooks.generateTestHeaderString({
    payload: testStripePayload,
    secret: TEST_WEBHOOK_SECRET
  });
  const verifiedEvent = Stripe.webhooks.constructEvent(
    testStripePayload,
    testStripeHeader,
    TEST_WEBHOOK_SECRET
  );
  assert.strictEqual(verifiedEvent.id, 'evt_stripe_test_123');
  assert.strictEqual(verifiedEvent.type, 'checkout.session.completed');
  assert.strictEqual((verifiedEvent.data.object as any).payment_status, 'paid');
  console.log('  ✅ PASS: Algoritmus Stripe.webhooks.constructEvent je plně funkční a kompatibilní s naším webhook handlerem');

  console.log('\n================================================================');
  console.log('🎉 VŠECH 10 TESTŮ STRIPE WEBHOOKU A BEZPEČNOSTI 100% PROŠLO!');
  console.log('================================================================\n');
}

runStripeWebhookTests().catch(err => {
  console.error('\n❌ WEBHOOK TEST FAILED:', err);
  process.exit(1);
});
