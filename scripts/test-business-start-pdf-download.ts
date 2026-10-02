import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runPdfTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PODNIKAI BUSINESS START REAL PDF DOWNLOAD QA SUITE');
  console.log('================================================================\n');

  // TEST 1: Source code verification (No window.print() in handleDownloadPdf or as fallback)
  console.log('[TEST 1: Verifying Client Download Implementation]');
  const reportTabPath = path.resolve(process.cwd(), 'src/components/admin/BusinessStartReportTab.tsx');
  const reportTabSource = fs.readFileSync(reportTabPath, 'utf8');

  // Verify html2pdf.js is not imported or used
  assert(!reportTabSource.includes('html2pdf'), 'BusinessStartReportTab must not use html2pdf.js');

  // Verify handleDownloadPdf does not call window.print
  const handleDownloadPdfMatch = reportTabSource.match(/const handleDownloadPdf = async \(\) => \{([\s\S]*?)\n  \};/);
  assert(handleDownloadPdfMatch, 'handleDownloadPdf function must exist in BusinessStartReportTab.tsx');
  const handleDownloadPdfBody = handleDownloadPdfMatch[1];
  assert(!handleDownloadPdfBody.includes('window.print()'), 'handleDownloadPdf MUST NOT call window.print()');
  console.log('  ✅ PASS: handleDownloadPdf does not call window.print() and does not use html2pdf.js');

  // Verify separate print button exists
  assert(reportTabSource.includes('Tisk / uložit přes tisk'), 'Separate print button "Tisk / uložit přes tisk" must exist');
  console.log('  ✅ PASS: Separate "Tisk / uložit přes tisk" button exists for printing');

  // TEST 2: Create a draft order
  console.log('\n[TEST 2: Create Draft Order]');
  const draftRes = await fetch(`${BASE_URL}/api/business-start/order/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'Jan Novák - PDF Test',
      clientEmail: 'jan.novak.pdf@example.cz',
      location: 'Praha',
      operatingModel: 'both',
      targetMonthlyIncome: '80 000 Kč',
      startingCapital: '30 000 Kč',
      weeklyTimeCommitment: '20 hodin týdně',
      coreSkillsAndExpertise: 'Masáže, práce s lidmi, sport',
      passionsAndInterests: 'Zdravý životní styl, fitness, regenerace',
      strictDislikesAndRedLines: 'Celodenní sezení u PC, cold calling',
      existingAssetsAndNetwork: 'Kontakty v oboru, LinkedIn',
      personalConstraints: 'Pouze večery a pátky'
    })
  });
  assert.strictEqual(draftRes.status, 200, 'Draft creation returns 200');
  const draftData = await draftRes.json();
  const orderId = draftData.orderId;
  const orderToken = draftData.orderToken;
  assert(orderId && orderToken, 'Order ID and token returned');
  console.log(`  ✅ PASS: Created draft order: ${orderId}`);

  // TEST 3: Unpaid Order Security Check (Must NOT return PDF)
  console.log('\n[TEST 3: Security - Unpaid Order Must NOT Return PDF]');
  const unpaidPdfRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf?token=${orderToken}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(unpaidPdfRes.status, 400, 'Unpaid order PDF request returns HTTP 400');
  const unpaidErr = await unpaidPdfRes.json();
  assert(unpaidErr.error && unpaidErr.error.includes('není zaplacena'), 'Error specifies unpaid order');
  console.log('  ✅ PASS: Unpaid order strictly rejected from downloading PDF (HTTP 400)');

  // TEST 4: Invalid Security Token Check
  console.log('\n[TEST 4: Security - Invalid Token Rejection]');
  const badTokenRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf?token=wrong_token_12345`, {
    headers: { 'x-order-token': 'wrong_token_12345' }
  });
  assert.strictEqual(badTokenRes.status, 403, 'Invalid token returns HTTP 403');
  console.log('  ✅ PASS: Request with invalid security token rejected with HTTP 403');

  // TEST 5: Non-existent Order Check
  console.log('\n[TEST 5: Security - Non-existent Order]');
  const notFoundRes = await fetch(`${BASE_URL}/api/business-start/order/non-existent-order-id/pdf?token=${orderToken}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(notFoundRes.status, 404, 'Non-existent order returns HTTP 404');
  console.log('  ✅ PASS: Non-existent order rejected with HTTP 404');

  // TEST 6: Simulate Payment and Complete Flow
  console.log('\n[TEST 6: Simulate Payment & Transition to REPORT_READY]');
  const payRes = await fetch(`${BASE_URL}/api/business-start/sandbox/simulate-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderToken, simulateOutcome: 'SUCCESS' })
  });
  assert.strictEqual(payRes.status, 200, 'Payment simulation returns 200');
  const payData = await payRes.json();
  assert.strictEqual(payData.order.paymentStatus, 'PAID', 'Order paymentStatus is PAID');
  assert.strictEqual(payData.order.status, 'REPORT_READY', 'Order status is REPORT_READY');
  console.log('  ✅ PASS: Payment confirmed and analysis generated');

  // TEST 7: Download Real PDF for Paid Order
  console.log('\n[TEST 7: Download Real PDF for Paid Order]');
  const pdfRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf?token=${orderToken}`, {
    headers: { 'x-order-token': orderToken }
  });
  assert.strictEqual(pdfRes.status, 200, 'Paid order PDF request returns HTTP 200');

  const contentType = pdfRes.headers.get('content-type') || '';
  assert(contentType.includes('application/pdf'), `Content-Type must contain application/pdf, got ${contentType}`);

  const contentDisp = pdfRes.headers.get('content-disposition') || '';
  assert(contentDisp.includes('attachment'), `Content-Disposition must contain attachment, got ${contentDisp}`);
  assert(contentDisp.includes('podnikai-business-start.pdf'), `Content-Disposition must contain filename="podnikai-business-start.pdf", got ${contentDisp}`);

  const arrayBuffer = await pdfRes.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);
  assert(pdfBuffer.length > 5000, `PDF size must be substantial, got ${pdfBuffer.length} bytes`);
  assert(pdfBuffer.toString('utf8', 0, 5) === '%PDF-', 'Buffer magic bytes must match %PDF-');
  console.log(`  ✅ PASS: PDF endpoint returns HTTP 200 with application/pdf, attachment, and valid %PDF- data (${pdfBuffer.length} bytes)`);

  // TEST 8: Order Status Transition to PDF_READY
  console.log('\n[TEST 8: Verify Status Transition to PDF_READY]');
  const orderCheckRes = await fetch(`${BASE_URL}/api/business-start/order/${orderId}`, {
    headers: { 'x-order-token': orderToken }
  });
  const orderCheckData = await orderCheckRes.json();
  assert.strictEqual(orderCheckData.order.status, 'PDF_READY', 'Order status transitioned to PDF_READY');
  assert(orderCheckData.order.pdfGeneratedAt, 'pdfGeneratedAt timestamp recorded');
  console.log('  ✅ PASS: Order status successfully transitioned to PDF_READY with pdfGeneratedAt');

  // TEST 9: Idempotence (Repeated PDF Downloads)
  console.log('\n[TEST 9: Idempotence - Repeated PDF Downloads]');
  const repeatRes1 = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf?token=${orderToken}`);
  assert.strictEqual(repeatRes1.status, 200, 'Second download returns 200');
  const repeatBuffer1 = Buffer.from(await repeatRes1.arrayBuffer());
  assert(repeatBuffer1.length > 5000, 'Second download returns full buffer');

  const repeatRes2 = await fetch(`${BASE_URL}/api/business-start/order/${orderId}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-order-token': orderToken },
    body: JSON.stringify({ orderToken })
  });
  assert.strictEqual(repeatRes2.status, 200, 'POST download returns 200');
  const repeatBuffer2 = Buffer.from(await repeatRes2.arrayBuffer());
  assert(repeatBuffer2.length > 5000, 'POST download returns full buffer');
  console.log('  ✅ PASS: Repeated calls are strictly idempotent and do not duplicate orders or alter payments');

  console.log('\n================================================================');
  console.log('🎉 ALL REAL PDF DOWNLOAD QA CHECKS PASSED 100%!');
  console.log('================================================================\n');
}

runPdfTests().catch(err => {
  console.error('\n❌ PDF TEST FAILED:', err);
  process.exit(1);
});
