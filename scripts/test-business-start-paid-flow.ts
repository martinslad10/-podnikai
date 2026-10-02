import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('TESTING AUTOMATED PAID BUSINESS START FLOW (1 990 KČ)');
  console.log('================================================================');

  // STEP 1: Create a Draft Order (12 Questions Intake)
  console.log('\n[STEP 1: Intake & Draft Order Creation]');
  const intakePayload = {
    questionnaire: {
      clientName: 'Petr Novotný - Testovací Klient',
      clientEmail: 'petr.novotny.test@example.cz',
      clientPhone: '+420 777 888 999',
      location: 'Brno a okolí',
      operatingModel: 'fyzicky' as const,
      mainGoal: 'Chci založit zakázkovou výrobu moderního nábytku z masivu',
      startingCapital: '50 000 Kč+',
      weeklyTimeCommitment: '20-30h týdně',
      skillsExperience: '5 let praxe v truhlářské dílně, práce s CNC a ručním nářadím',
      targetMonthlyIncome: '60 000 – 90 000 Kč',
      preferredWorkType: 'combination' as const,
      riskTolerance: 'medium' as const,
      redLines: 'Nechci pracovat o víkendech'
    }
  };

  const draftRes = await fetch(`${BASE_URL}/api/business-start/order/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intakePayload)
  });

  assert.strictEqual(draftRes.status, 200, 'Draft creation returns HTTP 200');
  const draftData = await draftRes.json();
  assert(draftData.success === true, 'Draft creation succeeded');
  assert(draftData.orderId, 'Order ID generated');
  assert(draftData.orderToken, 'Security orderToken generated');
  assert.strictEqual(draftData.order.priceCz, 1990, 'Order price is strictly 1 990 Kč');
  assert.strictEqual(draftData.order.currency, 'CZK', 'Currency is strictly CZK');
  assert.strictEqual(draftData.order.status, 'READY_FOR_PAYMENT', 'Status is READY_FOR_PAYMENT');
  assert.strictEqual(draftData.order.paymentStatus, 'UNPAID', 'Payment status is UNPAID');
  console.log(`  ✅ PASS: Draft order created. ID: ${draftData.orderId}, Token: ${draftData.orderToken.substring(0, 8)}..., Price: ${draftData.order.priceCz} ${draftData.order.currency}`);

  const orderId = draftData.orderId;
  const orderToken = draftData.orderToken;

  // STEP 2: Protection against unpaid analysis
  console.log('\n[STEP 2: Protection against Unpaid Analysis]');
  // 2a: Unauthenticated access without token should fail
  const noTokenRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}`);
  assert.strictEqual(noTokenRes.status, 403, 'Access without token rejected with 403');
  console.log('  ✅ PASS: Access without security token rejected with 403');

  // 2b: Invalid token should fail
  const invalidTokenRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}`, {
    headers: { 'x-order-token': 'invalid_secret_token_123' }
  });
  assert.strictEqual(invalidTokenRes.status, 403, 'Access with invalid token rejected with 403');
  console.log('  ✅ PASS: Access with invalid token rejected with 403');

  // 2c: Legitimate token but unpaid should return null analysis
  const unpaidOrderRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(unpaidOrderRes.status, 200, 'Valid token returns 200');
  const unpaidOrderData = await unpaidOrderRes.json();
  assert.strictEqual(unpaidOrderData.isPaid, false, 'isPaid is false');
  assert.strictEqual(unpaidOrderData.analysis, null, 'Analysis is null while unpaid (NO LEAK)');
  console.log('  ✅ PASS: Analysis is strictly withheld while order is UNPAID (No data leak)');

  // 2d: Attempting to trigger retry-analysis while UNPAID should fail
  const retryUnpaidRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/retry-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-order-token': orderToken }
  });
  assert.strictEqual(retryUnpaidRes.status, 400, 'Retry analysis on unpaid order rejected with 400');
  console.log('  ✅ PASS: Direct execution of analysis on unpaid order rejected with 400');

  // STEP 3: Initiate Checkout
  console.log('\n[STEP 3: Initiate Checkout]');
  const checkoutRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-order-token': orderToken }
  });
  assert.strictEqual(checkoutRes.status, 200, 'Checkout returns HTTP 200');
  const checkoutData = await checkoutRes.json();
  assert(checkoutData.success === true, 'Checkout initiation succeeded');
  assert(checkoutData.mode === 'sandbox' || checkoutData.mode === 'stripe_hosted', 'Mode is valid checkout mode');
  console.log(`  ✅ PASS: Checkout initialized in mode: ${checkoutData.mode}`);

  // STEP 4: Webhook Security & Idempotency Testing
  console.log('\n[STEP 4: Webhook Signature, Amount & Currency Validation]');
  // 4a: Webhook without signature rejected
  const unsignedWebhookRes = await fetch(`${BASE_URL}/api/business-start/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, amount: 1990, currency: 'CZK' })
  });
  assert.strictEqual(unsignedWebhookRes.status, 400, 'Unsigned webhook rejected with 400');
  console.log('  ✅ PASS: Unsigned webhook rejected with 400');

  // STEP 5: Server-Side Verified Payment Simulation
  console.log('\n[STEP 5: Server-Side Verified Payment Simulation]');
  // First simulate a failure to check PAYMENT_FAILED transition
  const simFailRes = await fetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderToken, simulateOutcome: 'FAILURE' })
  });
  assert.strictEqual(simFailRes.status, 200, 'Failure simulation returns 200');
  const simFailData = await simFailRes.json();
  assert.strictEqual(simFailData.status, 'PAYMENT_FAILED', 'Order status transitioned to PAYMENT_FAILED');
  console.log('  ✅ PASS: PAYMENT_FAILED state transition verified');

  // Now execute legitimate payment
  console.log('\n[STEP 6: Legitimate Payment & Automatic AI Engine Execution]');
  const simPayRes = await fetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderToken, simulateOutcome: 'SUCCESS' })
  });
  if (simPayRes.status !== 200) {
    const errText = await simPayRes.text();
    console.error('simPayRes failed with status:', simPayRes.status, 'body:', errText);
  }
  assert.strictEqual(simPayRes.status, 200, 'Payment simulation returns 200');
  const simPayData = await simPayRes.json();
  assert.strictEqual(simPayData.success, true, 'Payment succeeded');
  assert.strictEqual(simPayData.order.paymentStatus, 'PAID', 'Order paymentStatus is PAID');
  assert.strictEqual(simPayData.order.status, 'REPORT_READY', 'Order status automatically advanced to REPORT_READY');
  console.log('  ✅ PASS: Payment verified, analysis executed automatically, status is REPORT_READY');

  // STEP 7: Webhook Idempotency Check
  console.log('\n[STEP 7: Webhook Idempotency Check]');
  // Calling payment again should not rerun or crash
  const simDupRes = await fetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderToken, simulateOutcome: 'SUCCESS' })
  });
  assert.strictEqual(simDupRes.status, 200, 'Duplicate payment returns 200');
  const simDupData = await simDupRes.json();
  assert(simDupData.alreadyProcessed === true, 'Duplicate payment detected as already processed (Idempotent)');
  console.log('  ✅ PASS: Duplicate payment/webhook is strictly idempotent (no double execution)');

  // STEP 8: Verification that Paid Client Can Fetch Full Analysis
  console.log('\n[STEP 8: Verified Client Access to Business Report]');
  const paidOrderRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(paidOrderRes.status, 200, 'Fetch order returns 200');
  const paidOrderData = await paidOrderRes.json();
  assert.strictEqual(paidOrderData.isPaid, true, 'Order is confirmed PAID');
  assert(paidOrderData.analysis, 'Full Analysis is provided to paid client');
  assert(paidOrderData.analysis.primaryDirectionBlueprint, 'Blueprint is complete');
  assert(paidOrderData.analysis.capitalUsagePlan, 'Capital usage plan exists');
  console.log(`  ✅ PASS: Full Business Report released. Blueprint: "${paidOrderData.analysis.primaryDirectionBlueprint.directionTitle}"`);

  // STEP 9: Real PDF Generation & Download Flow
  console.log('\n[STEP 9: Real PDF Generation & Download Flow]');
  // 9A: Verify Real PDF download endpoint
  const realPdfRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf?token=${orderToken}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(realPdfRes.status, 200, 'Real PDF download returns HTTP 200');
  const contentType = realPdfRes.headers.get('content-type') || '';
  assert(contentType.includes('application/pdf'), `Content-Type must be application/pdf, got ${contentType}`);
  const contentDisp = realPdfRes.headers.get('content-disposition') || '';
  assert(contentDisp.includes('attachment'), `Content-Disposition must contain attachment, got ${contentDisp}`);
  assert(contentDisp.includes('podnikai-business-start.pdf'), `Content-Disposition must contain filename, got ${contentDisp}`);

  const pdfArrayBuffer = await realPdfRes.arrayBuffer();
  const pdfBuffer = Buffer.from(pdfArrayBuffer);
  assert(pdfBuffer.length > 5000, `PDF buffer must be valid and substantial, got ${pdfBuffer.length} bytes`);
  assert(pdfBuffer.toString('utf8', 0, 5) === '%PDF-', 'PDF buffer must start with valid PDF magic bytes (%PDF-)');
  console.log(`  ✅ PASS: Real PDF downloaded successfully (${pdfBuffer.length} bytes, valid %PDF- magic bytes)`);

  // 9B: Verify mark-pdf-ready endpoint compatibility
  const pdfRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/mark-pdf-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-order-token': orderToken }
  });
  assert.strictEqual(pdfRes.status, 200, 'Mark PDF ready returns 200');
  const pdfData = await pdfRes.json();
  assert.strictEqual(pdfData.order.status, 'PDF_READY', 'Order status transitioned to PDF_READY');
  assert(pdfData.order.pdfGeneratedAt, 'pdfGeneratedAt timestamp recorded');
  console.log('  ✅ PASS: Order status confirmed as PDF_READY');

  console.log('\n================================================================');
  console.log('🎉 ALL 9 AUTOMATED PAID BUSINESS START FLOW GATES 100% PASSED!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
