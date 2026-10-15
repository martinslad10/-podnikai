import assert from 'assert';
import { spawn, ChildProcess } from 'child_process';
import Stripe from 'stripe';

const BASE_URL = 'http://localhost:3000';
const TEST_PORT = 3098;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_WEBHOOK_SECRET = 'whsec_test_stripe_webhook_secret_for_qa_tests_1234567890';

// Helper for generating official Stripe HMAC signatures
function signStripeEvent(payload: string, secret: string = TEST_WEBHOOK_SECRET): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000)
  });
}

const nativeFetch = globalThis.fetch;
// Helper with Connection: close and retry for robust local integration testing
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const headers = new Headers(init?.headers);
      headers.set('Connection', 'close');
      return await nativeFetch(url, { ...init, headers });
    } catch (err: any) {
      if (attempts >= 3) throw err;
      await new Promise(r => setTimeout(r, 150));
    }
  }
  throw new Error('Unreachable');
}

// Helper to create a draft order on a given server base URL
async function createTestDraftOrder(baseUrl: string, nameSuffix: string = '') {
  const intakePayload = {
    questionnaire: {
      clientName: `Stripe QA Klient ${nameSuffix}`,
      clientEmail: `stripe.qa.${Date.now()}.${Math.random().toString(36).substring(7)}@example.cz`,
      clientPhone: '+420 777 111 222',
      location: 'Praha',
      operatingModel: 'online' as const,
      mainGoal: 'Automatizace firemních procesů a AI konzultace',
      startingCapital: '10 000 – 30 000 Kč',
      weeklyTimeCommitment: '15-20h týdně',
      skillsExperience: 'Správa CRM systémů, automatizace',
      targetMonthlyIncome: '50 000 – 80 000 Kč',
      preferredWorkType: 'combination' as const,
      riskTolerance: 'low' as const,
      redLines: 'Pouze online práce'
    }
  };

  const res = await safeFetch(`${baseUrl}/api/business-start/order/draft`, {
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

// Helper to wait until test server is responsive
async function waitForServerReady(url: string, timeoutMs: number = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await safeFetch(`${url}/api/health`);
      if (res.status === 200) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function runStripeWebhookTests() {
  console.log('================================================================');
  console.log('TESTING STRIPE WEBHOOK SECURITY, SIGNATURES & EVENT DISPATCH');
  console.log('================================================================');

  let testServerChild: ChildProcess | null = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION A: Tests on server without STRIPE_WEBHOOK_SECRET (Default state)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION A: Missing Secret & Missing Signature Handling ---');

    // TEST 1: Missing signature header rejected with HTTP 400
    console.log('\n[TEST 1: Chybějící podpis Stripe webhooku odmítnut s HTTP 400]');
    const unsignedRes = await safeFetch(`${BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'evt_test_1', type: 'checkout.session.completed' })
    });
    assert.strictEqual(unsignedRes.status, 400, 'Požadavek bez stripe-signature musí vrátit HTTP 400');
    const unsignedData = await unsignedRes.json();
    assert(unsignedData.error.includes('stripe-signature'), 'Odpověď správně hlásí chybějící stripe-signature');
    console.log('  ✅ PASS: Požadavek bez stripe-signature odmítnut s HTTP 400');

    // TEST 2: Legacy signature header (x-podnikai-signature) is strictly rejected
    console.log('\n[TEST 2: Alternativní hlavička x-podnikai-signature je striktně odmítnuta]');
    const legacySigRes = await safeFetch(`${BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-podnikai-signature': '0000000000000000000000000000000000000000000000000000000000000000'
      },
      body: JSON.stringify({ id: 'evt_test_2', type: 'checkout.session.completed', orderId: 'test' })
    });
    assert.strictEqual(legacySigRes.status, 400, 'Požadavek s x-podnikai-signature bez stripe-signature musí vrátit HTTP 400');
    const legacyData = await legacySigRes.json();
    assert(legacyData.error.includes('stripe-signature'), 'Server odmítá alternativní hlavičku a vyžaduje pouze stripe-signature');
    console.log('  ✅ PASS: Stará hlavička x-podnikai-signature byla striktně odmítnuta (HTTP 400)');

    // TEST 3: Stripe signature when STRIPE_WEBHOOK_SECRET is missing on server
    console.log('\n[TEST 3: Stripe signature bez nakonfigurovaného STRIPE_WEBHOOK_SECRET]');
    const missingSecretRes = await safeFetch(`${BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=123456789,v1=dummy_signature_hash'
      },
      body: JSON.stringify({ id: 'evt_test_3', type: 'checkout.session.completed' })
    });
    assert.strictEqual(missingSecretRes.status, 500, 'Chybějící STRIPE_WEBHOOK_SECRET musí bezpečně vrátit HTTP 500');
    const missingSecretData = await missingSecretRes.json();
    assert(missingSecretData.error.includes('STRIPE_WEBHOOK_SECRET is missing'), 'Chybová zpráva jasně identifikuje chybějící secret');
    console.log('  ✅ PASS: Webhook bezpečně odmítl Stripe požadavek při chybějícím server secretu s HTTP 500');

    // TEST 3b: Ve vývojovém/testovacím prostředí lze sandbox používat podle dosavadních pravidel
    console.log('\n[TEST 3b: Sandbox ve vývojovém režimu funguje korektně]');
    const devDraft = await createTestDraftOrder(BASE_URL, 'Dev Sandbox');
    const devCheckoutRes = await safeFetch(`${BASE_URL}/api/business-start/order/${devDraft.orderId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-order-token': devDraft.orderToken },
      body: JSON.stringify({ orderToken: devDraft.orderToken })
    });
    assert.strictEqual(devCheckoutRes.status, 200, 'Checkout ve vývojovém režimu vrací HTTP 200');
    const devCheckoutData = await devCheckoutRes.json();
    assert.strictEqual(devCheckoutData.mode, 'sandbox', 'Ve vývojovém režimu bez živého Stripe klíče je aktivní mode: "sandbox"');

    // Ověření simulace selhání i úspěchu v dev prostředí
    const devSimFailRes = await safeFetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: devDraft.orderId, orderToken: devDraft.orderToken, simulateOutcome: 'FAILURE' })
    });
    assert.strictEqual(devSimFailRes.status, 200, 'Simulace selhání v dev vrací HTTP 200');
    const devSimFailData = await devSimFailRes.json();
    assert.strictEqual(devSimFailData.status, 'PAYMENT_FAILED', 'Stav objednávky po simulovaném selhání je PAYMENT_FAILED');

    const devSimSuccessRes = await safeFetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: devDraft.orderId, orderToken: devDraft.orderToken, simulateOutcome: 'SUCCESS' })
    });
    assert.strictEqual(devSimSuccessRes.status, 200, 'Simulace úspěchu v dev vrací HTTP 200');
    const devSimSuccessData = await devSimSuccessRes.json();
    assert.strictEqual(devSimSuccessData.status, 'REPORT_READY', 'Stav objednávky po simulovaném úspěchu je REPORT_READY');
    console.log('  ✅ PASS: Ve vývojovém/testovacím prostředí sandbox a simulate-payment plně fungují');

    // -------------------------------------------------------------------------
    // SECTION B: Tests on isolated server with configured STRIPE_WEBHOOK_SECRET
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION B: Isolated Server with Active STRIPE_WEBHOOK_SECRET ---');
    console.log(`Starting isolated test server on port ${TEST_PORT} with STRIPE_WEBHOOK_SECRET...`);

    testServerChild = spawn('npx', ['tsx', 'server.ts'], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'production',
        STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET
      },
      stdio: 'pipe'
    });
    testServerChild.stdout?.on('data', d => console.log('child stdout:', d.toString()));
    testServerChild.stderr?.on('data', d => console.error('child stderr:', d.toString()));
    testServerChild.on('error', (err) => {
      console.error('testServerChild error:', err);
    });
    testServerChild.on('exit', (code, sig) => {
      console.log(`testServerChild exited with code ${code}, signal ${sig}`);
    });

    const isReady = await waitForServerReady(TEST_BASE_URL, 15000);
    assert(isReady, `Isolated test server failed to start on ${TEST_BASE_URL} within 15s`);
    console.log(`  ✅ PASS: Isolated test server running on ${TEST_BASE_URL}`);

    // TEST 3c: Produkční sandbox simulace je striktně odmítnuta (HTTP 404)
    console.log('\n[TEST 3c: Produkční sandbox simulace (simulate-payment) je striktně odmítnuta s HTTP 404]');
    const prodDraft = await createTestDraftOrder(TEST_BASE_URL, 'Produkční Pokus o Simulaci');
    const prodSimRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/sandbox/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: prodDraft.orderId, orderToken: prodDraft.orderToken, simulateOutcome: 'SUCCESS' })
    });
    assert.strictEqual(prodSimRes.status, 404, 'V produkci musí simulate-payment vrátit HTTP 404');
    const prodSimData = await prodSimRes.json();
    assert(prodSimData.error, 'Odpověď obsahuje chybové hlášení');

    // Ověř, že objednávka nebyla v produkci označena jako PAID
    const prodOrderCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${prodDraft.orderId}`, {
      headers: { 'x-order-token': prodDraft.orderToken }
    });
    const prodOrderCheckData = await prodOrderCheckRes.json();
    assert.strictEqual(prodOrderCheckData.order.paymentStatus, 'UNPAID', 'Objednávka v produkci NESMÍ být označena jako PAID přes simulate-payment');
    assert.strictEqual(prodOrderCheckData.isPaid, false, 'isPaid zůstává false');
    assert.strictEqual(prodOrderCheckData.analysis, null, 'Analýza nebyla vygenerována');
    console.log('  ✅ PASS: V produkci je endpoint simulate-payment zcela zablokován (HTTP 404) a objednávku nezaplatí');

    // TEST 3d: Produkční Checkout bez STRIPE_SECRET_KEY selže bezpečně (HTTP 503) a nepřepne se do sandboxu
    console.log('\n[TEST 3d: Produkční Checkout bez STRIPE_SECRET_KEY selže bezpečně s HTTP 503 a nepřepne se do sandboxu]');
    const prodCheckoutRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${prodDraft.orderId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-order-token': prodDraft.orderToken },
      body: JSON.stringify({ orderToken: prodDraft.orderToken })
    });
    assert.strictEqual(prodCheckoutRes.status, 503, 'V produkci bez STRIPE_SECRET_KEY musí checkout vrátit HTTP 503');
    const prodCheckoutData = await prodCheckoutRes.json();
    assert.strictEqual(prodCheckoutData.code, 'STRIPE_NOT_CONFIGURED', 'Chybový kód je STRIPE_NOT_CONFIGURED');
    assert.notStrictEqual(prodCheckoutData.mode, 'sandbox', 'V produkci NESMÍ být vrácen mode: "sandbox"');
    console.log('  ✅ PASS: V produkci bez STRIPE_SECRET_KEY checkout bezpečně vrátil HTTP 503 a nespadl do sandboxu');

    // TEST 4: Invalid Stripe cryptographic signature (tampered payload / invalid signature)
    console.log('\n[TEST 4: Neplatný / podvržený Stripe podpis odmítnut s HTTP 400]');
    const tamperedPayload = JSON.stringify({
      id: 'evt_tampered',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_tampered', payment_status: 'paid' } }
    });
    const badSigRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=1700000000,v1=bad_signature_hash_00000000000000000000000000000000'
      },
      body: tamperedPayload
    });
    assert.strictEqual(badSigRes.status, 400, 'Neplatný podpis musí vrátit HTTP 400');
    const badSigData = await badSigRes.json();
    assert(badSigData.error.includes('Neplatný podpis Stripe'), 'Odpověď správně identifikuje neplatný podpis');
    console.log('  ✅ PASS: Podvržený / neplatný Stripe podpis byl okamžitě odmítnut (HTTP 400)');

    // TEST 5: Valid Stripe signature but missing order identifier
    console.log('\n[TEST 5: Platný Stripe podpis, ale chybějící orderId v události]');
    const noOrderIdPayload = JSON.stringify({
      id: 'evt_no_order',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_no_order',
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'czk'
        }
      }
    });
    const noOrderIdSig = signStripeEvent(noOrderIdPayload);
    const noOrderIdRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': noOrderIdSig
      },
      body: noOrderIdPayload
    });
    assert.strictEqual(noOrderIdRes.status, 400, 'Chybějící orderId musí vrátit HTTP 400');
    console.log('  ✅ PASS: Stripe událost bez vazby na objednávku správně vrátila HTTP 400');

    // TEST 6: Valid Stripe signature but non-existent order
    console.log('\n[TEST 6: Platný Stripe podpis s neexistující objednávkou vrací HTTP 404]');
    const nonExistentPayload = JSON.stringify({
      id: 'evt_non_existent',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_non_existent',
          client_reference_id: 'order-bs-non-existent-999999',
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'czk'
        }
      }
    });
    const nonExistentSig = signStripeEvent(nonExistentPayload);
    const nonExistentRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': nonExistentSig
      },
      body: nonExistentPayload
    });
    assert.strictEqual(nonExistentRes.status, 404, 'Neexistující objednávka musí vrátit HTTP 404');
    console.log('  ✅ PASS: Neexistující objednávka správně vrací HTTP 404');

    // TEST 7: Unpaid Checkout Session (payment_status: 'unpaid')
    console.log('\n[TEST 7: Nezaplacená Checkout Session (payment_status: "unpaid") nesmí označit objednávku jako PAID]');
    const draftUnpaid = await createTestDraftOrder(TEST_BASE_URL, 'Nezaplacená Relace');
    const unpaidPayload = JSON.stringify({
      id: 'evt_unpaid_session',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unpaid_test',
          client_reference_id: draftUnpaid.orderId,
          payment_status: 'unpaid',
          amount_total: 69000,
          currency: 'czk'
        }
      }
    });
    const unpaidSig = signStripeEvent(unpaidPayload);
    const unpaidRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': unpaidSig
      },
      body: unpaidPayload
    });
    assert.strictEqual(unpaidRes.status, 200, 'Webhook pro odloženou platbu vrací HTTP 200 pro Stripe');
    const unpaidData = await unpaidRes.json();
    assert.strictEqual(unpaidData.status, 'PAYMENT_PENDING', 'Stav zůstává PAYMENT_PENDING');

    const unpaidCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftUnpaid.orderId}`, {
      headers: { 'x-order-token': draftUnpaid.orderToken }
    });
    const unpaidCheckData = await unpaidCheckRes.json();
    assert.strictEqual(unpaidCheckData.order.paymentStatus, 'PAYMENT_PENDING', 'paymentStatus NESMÍ být PAID, musí zůstat PAYMENT_PENDING');
    assert.strictEqual(unpaidCheckData.isPaid, false, 'isPaid je striktně false');
    assert.strictEqual(unpaidCheckData.analysis, null, 'Analýza nesmí být vygenerována pro nezaplacenou objednávku');
    console.log('  ✅ PASS: Nezaplacená Checkout Session (unpaid) nebyla označena jako PAID (zůstává PAYMENT_PENDING)');

    // TEST 8: Checkout Session with INCORRECT amount (e.g. 1 990 Kč instead of 690 Kč)
    console.log('\n[TEST 8: Platba v nesprávné částce (např. 1 990 Kč vs 690 Kč) odmítnuta]');
    const draftWrongAmount = await createTestDraftOrder(TEST_BASE_URL, 'Špatná Částka');
    const wrongAmountPayload = JSON.stringify({
      id: 'evt_wrong_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_wrong_amount',
          client_reference_id: draftWrongAmount.orderId,
          payment_status: 'paid',
          amount_total: 199000, // 1 990 Kč místo 690 Kč
          currency: 'czk'
        }
      }
    });
    const wrongAmountSig = signStripeEvent(wrongAmountPayload);
    const wrongAmountRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': wrongAmountSig
      },
      body: wrongAmountPayload
    });
    assert.strictEqual(wrongAmountRes.status, 400, 'Platba s nesprávnou částkou musí vrátit HTTP 400');
    const wrongAmountData = await wrongAmountRes.json();
    assert(wrongAmountData.error.includes('690'), 'Chybová zpráva uvádí očekávanou částku 690 Kč');

    const wrongAmountCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftWrongAmount.orderId}`, {
      headers: { 'x-order-token': draftWrongAmount.orderToken }
    });
    const wrongAmountCheckData = await wrongAmountCheckRes.json();
    assert.strictEqual(wrongAmountCheckData.order.paymentStatus, 'UNPAID', 'Objednávka s neplatnou částkou nesmí být označena jako PAID');
    console.log('  ✅ PASS: Platba v nesprávné částce byla striktně odmítnuta a objednávka nebyla označena jako PAID');

    // TEST 9: Checkout Session with INCORRECT currency (e.g. USD instead of CZK)
    console.log('\n[TEST 9: Platba v nesprávné měně (např. USD vs CZK) odmítnuta]');
    const draftWrongCurrency = await createTestDraftOrder(TEST_BASE_URL, 'Špatná Měna');
    const wrongCurrencyPayload = JSON.stringify({
      id: 'evt_wrong_currency',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_wrong_currency',
          client_reference_id: draftWrongCurrency.orderId,
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'usd' // USD místo CZK
        }
      }
    });
    const wrongCurrencySig = signStripeEvent(wrongCurrencyPayload);
    const wrongCurrencyRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': wrongCurrencySig
      },
      body: wrongCurrencyPayload
    });
    assert.strictEqual(wrongCurrencyRes.status, 400, 'Platba s nesprávnou měnou musí vrátit HTTP 400');
    const wrongCurrencyData = await wrongCurrencyRes.json();
    assert(wrongCurrencyData.error.includes('CZK'), 'Chybová zpráva uvádí očekávanou měnu CZK');

    const wrongCurrencyCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftWrongCurrency.orderId}`, {
      headers: { 'x-order-token': draftWrongCurrency.orderToken }
    });
    const wrongCurrencyCheckData = await wrongCurrencyCheckRes.json();
    assert.strictEqual(wrongCurrencyCheckData.order.paymentStatus, 'UNPAID', 'Objednávka s neplatnou měnou nesmí být označena jako PAID');
    console.log('  ✅ PASS: Platba v nesprávné měně byla striktně odmítnuta a objednávka nebyla označena jako PAID');

    // TEST 10: Successful Checkout Session (payment_status: 'paid') verified via Stripe signature
    console.log('\n[TEST 10: Úspěšně zaplacená Checkout Session ověřená Stripe podpisem]');
    const draftPaid = await createTestDraftOrder(TEST_BASE_URL, 'Úspěšná Platba');
    const paidPayload = JSON.stringify({
      id: 'evt_paid_10',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid_test_10',
          client_reference_id: draftPaid.orderId,
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'czk',
          payment_intent: 'pi_test_paid_10'
        }
      }
    });
    const paidSig = signStripeEvent(paidPayload);
    const paidRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': paidSig
      },
      body: paidPayload
    });
    assert.strictEqual(paidRes.status, 200, 'Úspěšná platba vrací HTTP 200');
    const paidData = await paidRes.json();
    assert.strictEqual(paidData.received, true, 'Webhook potvrzuje received');
    assert.strictEqual(paidData.status, 'REPORT_READY', 'Stav objednávky pokročil na REPORT_READY');

    // Ověření stavu objednávky přes API
    const orderCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftPaid.orderId}`, {
      headers: { 'x-order-token': draftPaid.orderToken }
    });
    const orderCheckData = await orderCheckRes.json();
    assert.strictEqual(orderCheckData.order.paymentStatus, 'PAID', 'Objednávka je ve stavu paymentStatus === PAID');
    assert.strictEqual(orderCheckData.order.status, 'REPORT_READY', 'Objednávka má status REPORT_READY');
    assert.strictEqual(orderCheckData.isPaid, true, 'isPaid je true');
    assert(orderCheckData.analysis, 'Plný Business Report byl vygenerován');
    console.log('  ✅ PASS: Úspěšně zaplacená Checkout Session nastavila paymentStatus: PAID a status: REPORT_READY');

    // TEST 11: Idempotency check: duplicate delivery of the exact same event
    console.log('\n[TEST 11: Idempotentní zpracování při opakovaném doručení stejné Stripe události]');
    const duplicateRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': paidSig
      },
      body: paidPayload
    });
    assert.strictEqual(duplicateRes.status, 200, 'Opakované volání vrací HTTP 200');
    const duplicateData = await duplicateRes.json();
    assert.strictEqual(duplicateData.alreadyProcessed, true, 'Opakovaný požadavek detekován jako alreadyProcessed');
    assert.strictEqual(duplicateData.status, 'REPORT_READY', 'Stav zůstává REPORT_READY beze změny');
    console.log('  ✅ PASS: Opakované doručení je 100% idempotentní (nevytváří duplicity ani nespouští znovu analýzu)');

    // TEST 11b: Souběžné doručení dvou platných Stripe webhooků pro stejnou objednávku (Race Condition / Concurrency Mutex)
    console.log('\n[TEST 11b: Souběžné doručení dvou platných Stripe webhooků pro stejnou objednávku]');
    const draftConcurrent = await createTestDraftOrder(TEST_BASE_URL, 'Souběžná Platba');
    const concurrentPayload = JSON.stringify({
      id: 'evt_concurrent_11b',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_concurrent_11b',
          client_reference_id: draftConcurrent.orderId,
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'czk',
          payment_intent: 'pi_test_concurrent_11b'
        }
      }
    });
    const concurrentSig = signStripeEvent(concurrentPayload);

    // Odeslání dvou přesně souběžných HTTP webhook požadavků na stejnou objednávku
    const [resA, resB] = await Promise.all([
      safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': concurrentSig
        },
        body: concurrentPayload
      }),
      safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': concurrentSig
        },
        body: concurrentPayload
      })
    ]);

    assert.strictEqual(resA.status, 200, 'První souběžný webhook vrátil HTTP 200');
    assert.strictEqual(resB.status, 200, 'Druhý souběžný webhook vrátil HTTP 200');
    const dataA = await resA.json();
    const dataB = await resB.json();

    // Přesně jeden z požadavků musí provést primární zpracování a druhý musí být detekován jako duplicate/alreadyProcessed
    const isPrimaryA = !dataA.alreadyProcessed;
    const isPrimaryB = !dataB.alreadyProcessed;
    assert(
      (isPrimaryA && dataB.alreadyProcessed) || (isPrimaryB && dataA.alreadyProcessed),
      'Přesně jeden požadavek zpracoval objednávku a druhý byl detekován jako alreadyProcessed díky per-order mutexu'
    );

    // Ověření, že v persistovaném stavu je analýza uložena a stav je REPORT_READY
    const concurrentCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftConcurrent.orderId}`, {
      headers: { 'x-order-token': draftConcurrent.orderToken }
    });
    const concurrentCheckData = await concurrentCheckRes.json();
    assert.strictEqual(concurrentCheckData.order.paymentStatus, 'PAID', 'Objednávka je ve stavu PAID');
    assert.strictEqual(concurrentCheckData.order.status, 'REPORT_READY', 'Objednávka má status REPORT_READY');
    assert.strictEqual(concurrentCheckData.isPaid, true, 'isPaid je true');
    assert(concurrentCheckData.analysis, 'Business Report byl vygenerován právě jednou');
    console.log('  ✅ PASS: Dva souběžné webhooky byly serializovány – analýza proběhla právě jednou a druhý požadavek byl odbaven jako alreadyProcessed');

    // TEST 12: Failed PaymentIntent (payment_intent.payment_failed)
    console.log('\n[TEST 12: Neúspěšný PaymentIntent (payment_intent.payment_failed)]');
    const draftFailed = await createTestDraftOrder(TEST_BASE_URL, 'Neúspěšná Platba');
    const failPayload = JSON.stringify({
      id: 'evt_fail_12',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_fail_12',
          metadata: { orderId: draftFailed.orderId },
          amount: 69000,
          currency: 'czk',
          last_payment_error: { message: 'Nedostatečný zůstatek na platební kartě' }
        }
      }
    });
    const failSig = signStripeEvent(failPayload);
    const failRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': failSig
      },
      body: failPayload
    });
    assert.strictEqual(failRes.status, 200, 'Zpracování neúspěchu vrací HTTP 200 pro Stripe');
    const failData = await failRes.json();
    assert.strictEqual(failData.status, 'PAYMENT_FAILED', 'Stav objednávky je PAYMENT_FAILED');

    const failOrderRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftFailed.orderId}`, {
      headers: { 'x-order-token': draftFailed.orderToken }
    });
    const failOrderData = await failOrderRes.json();
    assert.strictEqual(failOrderData.order.paymentStatus, 'PAYMENT_FAILED', 'paymentStatus je PAYMENT_FAILED');
    assert.strictEqual(failOrderData.order.status, 'PAYMENT_FAILED', 'status je PAYMENT_FAILED');
    console.log('  ✅ PASS: Neúspěšný PaymentIntent správně nastavil PAYMENT_FAILED s chybovou hláškou');

    // TEST 13: Protection against late failure: late payment_intent.payment_failed for already paid order
    console.log('\n[TEST 13: Pozdní payment_intent.payment_failed NESMÍ přepsat již zaplacenou objednávku]');
    const lateFailPayload = JSON.stringify({
      id: 'evt_late_fail_13',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_late_fail_13',
          metadata: { orderId: draftPaid.orderId }, // Již zaplacená objednávka z TESTU 10!
          amount: 69000,
          currency: 'czk',
          last_payment_error: { message: 'Pozdní signál o zamítnutí jiné karty' }
        }
      }
    });
    const lateFailSig = signStripeEvent(lateFailPayload);
    const lateFailRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': lateFailSig
      },
      body: lateFailPayload
    });
    assert.strictEqual(lateFailRes.status, 200, 'Odpověď pro Stripe je HTTP 200');
    const lateFailData = await lateFailRes.json();
    assert.strictEqual(lateFailData.ignored, true, 'Událost selhání byla ignorována');
    assert.strictEqual(lateFailData.reason, 'order_already_paid', 'Důvod ignorování je order_already_paid');

    const reCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftPaid.orderId}`, {
      headers: { 'x-order-token': draftPaid.orderToken }
    });
    const reCheckData = await reCheckRes.json();
    assert.strictEqual(reCheckData.order.paymentStatus, 'PAID', 'Objednávka zůstala PAID');
    assert.strictEqual(reCheckData.order.status, 'REPORT_READY', 'Objednávka zůstala REPORT_READY');
    console.log('  ✅ PASS: Pozdní neúspěch platby byl bezpečně ignorován a zaplacená objednávka zůstala nepoškozena');

    // TEST 14: Protection against late expired session for already paid order
    console.log('\n[TEST 14: Pozdní checkout.session.expired NESMÍ přepsat již zaplacenou objednávku]');
    const lateExpiredPayload = JSON.stringify({
      id: 'evt_late_expired_14',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_late_expired',
          client_reference_id: draftPaid.orderId
        }
      }
    });
    const lateExpiredSig = signStripeEvent(lateExpiredPayload);
    const lateExpiredRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': lateExpiredSig
      },
      body: lateExpiredPayload
    });
    assert.strictEqual(lateExpiredRes.status, 200, 'Odpověď pro Stripe je HTTP 200');
    const lateExpiredData = await lateExpiredRes.json();
    assert.strictEqual(lateExpiredData.ignored, true, 'Vypršení relace ignorováno');
    assert.strictEqual(lateExpiredData.reason, 'order_already_paid', 'Důvod ignorování je order_already_paid');
    console.log('  ✅ PASS: Pozdní vypršení relace (expired) bylo bezpečně ignorováno');

    // TEST 15: Protection against late unpaid session for already paid order
    console.log('\n[TEST 15: Opožděná nezaplacená relace NESMÍ přepsat již zaplacenou objednávku]');
    const lateUnpaidPayload = JSON.stringify({
      id: 'evt_late_unpaid_15',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_late_unpaid',
          client_reference_id: draftPaid.orderId,
          payment_status: 'unpaid',
          amount_total: 69000,
          currency: 'czk'
        }
      }
    });
    const lateUnpaidSig = signStripeEvent(lateUnpaidPayload);
    const lateUnpaidRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': lateUnpaidSig
      },
      body: lateUnpaidPayload
    });
    assert.strictEqual(lateUnpaidRes.status, 200, 'Odpověď pro Stripe je HTTP 200');
    const lateUnpaidData = await lateUnpaidRes.json();
    assert.strictEqual(lateUnpaidData.ignored, true, 'Opožděná nezaplacená relace ignorována');
    assert.strictEqual(lateUnpaidData.reason, 'order_already_paid', 'Důvod ignorování je order_already_paid');
    console.log('  ✅ PASS: Opožděná nezaplacená relace byla ignorována a neponížila zaplacenou objednávku');

    // TEST 16: Asynchronous payment succeeded (checkout.session.async_payment_succeeded)
    console.log('\n[TEST 16: Asynchronní úspěšná platba (checkout.session.async_payment_succeeded)]');
    const draftAsync = await createTestDraftOrder(TEST_BASE_URL, 'Asynchronní Platba');
    const asyncSuccessPayload = JSON.stringify({
      id: 'evt_async_success_16',
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_async_success_16',
          client_reference_id: draftAsync.orderId,
          payment_status: 'paid',
          amount_total: 69000,
          currency: 'czk'
        }
      }
    });
    const asyncSuccessSig = signStripeEvent(asyncSuccessPayload);
    const asyncSuccessRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': asyncSuccessSig
      },
      body: asyncSuccessPayload
    });
    assert.strictEqual(asyncSuccessRes.status, 200, 'Asynchronní platba vrací HTTP 200');
    const asyncSuccessData = await asyncSuccessRes.json();
    assert.strictEqual(asyncSuccessData.status, 'REPORT_READY', 'Stav objednávky pokročil na REPORT_READY');

    const asyncCheckRes = await safeFetch(`${TEST_BASE_URL}/api/business-start/order/${draftAsync.orderId}`, {
      headers: { 'x-order-token': draftAsync.orderToken }
    });
    const asyncCheckData = await asyncCheckRes.json();
    assert.strictEqual(asyncCheckData.order.paymentStatus, 'PAID', 'Objednávka je ve stavu paymentStatus === PAID');
    assert.strictEqual(asyncCheckData.order.status, 'REPORT_READY', 'Objednávka má status REPORT_READY');
    assert.strictEqual(asyncCheckData.isPaid, true, 'isPaid je true');
    console.log('  ✅ PASS: checkout.session.async_payment_succeeded správně označila objednávku jako PAID a REPORT_READY');

    console.log('\n================================================================');
    console.log('🎉 VŠECH 20 TESTŮ STRIPE WEBHOOKU, SANDBOXU, SOUBĚHU A BEZPEČNOSTI 100% PROŠLO!');
    console.log('================================================================\n');
  } finally {
    if (testServerChild) {
      console.log('Cleaning up isolated test server...');
      try {
        testServerChild.kill('SIGTERM');
      } catch {
        // ignore
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  process.exit(0);
}

runStripeWebhookTests().catch(err => {
  console.error('\n❌ WEBHOOK TEST FAILED:', err);
  process.exit(1);
});
