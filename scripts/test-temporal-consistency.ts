import {
  hasRealSentEmail,
  getLastRealSentEmailDate,
  getDaysSinceEmail,
  getEmailFollowUpOpening,
  generateOutreachSequence,
  hasEmailReference
} from '../src/utils/outreachGenerator';
import { PotentialCustomerLead } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

const baseLead: PotentialCustomerLead = {
  id: 'lead_test_1',
  companyName: 'Stavba Plus s.r.o.',
  email: 'novak@stavbaplus.cz',
  phone: '+420 777 123 456',
  industry: 'Stavebnictví',
  status: 'Nový',
  addedAt: new Date().toISOString(),
  fitScore: 85,
  city: 'Brno',
  website: 'https://stavbaplus.cz'
};

console.log('--- RUNNING OUTREACH SEQUENCE TEMPORAL CONSISTENCY TESTS ---');

// SCENARIO A: Email sent today (0 days ago)
{
  const todayLead: PotentialCustomerLead = {
    ...baseLead,
    id: 'lead_today',
    status: 'Osloveno',
    activities: [
      {
        id: 'act_1',
        leadId: 'lead_today',
        channel: 'email',
        result: 'E-mail odeslán',
        statusAfter: 'Osloveno',
        createdAt: new Date().toISOString(),
        isSimulation: false
      }
    ]
  };

  assert(hasRealSentEmail(todayLead) === true, 'Scenario A: detects real sent email');
  const lastDate = getLastRealSentEmailDate(todayLead);
  assert(lastDate !== null, 'Scenario A: finds real sent email date');
  const daysDiff = getDaysSinceEmail(lastDate);
  assert(daysDiff === 0, 'Scenario A: correctly identifies 0 days elapsed');

  const opening = getEmailFollowUpOpening(todayLead, todayLead.companyName);
  assert(opening.includes('dnes'), `Scenario A: opening references today ("${opening}")`);
  assert(!opening.includes('minulého týdne'), 'Scenario A: NEVER claims last week when sent today');

  const seq = generateOutreachSequence(todayLead, { userProfile: { name: 'Petr' } });
  const day7Step = seq.steps.find(s => s.stepNumber === 3);
  assert(day7Step !== undefined, 'Scenario A: Step 3 exists');
  assert(!day7Step!.content.includes('minulého týdne'), 'Scenario A: Step 3 generated content does not claim last week');
  assert(day7Step!.content.includes('dnes'), 'Scenario A: Step 3 generated content references today');
}

// SCENARIO B: Email sent 3 days ago
{
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const threeDaysLead: PotentialCustomerLead = {
    ...baseLead,
    id: 'lead_3days',
    status: 'Osloveno',
    activities: [
      {
        id: 'act_2',
        leadId: 'lead_3days',
        channel: 'email',
        result: 'E-mail odeslán',
        statusAfter: 'Osloveno',
        createdAt: threeDaysAgo.toISOString(),
        isSimulation: false
      }
    ]
  };

  assert(hasRealSentEmail(threeDaysLead) === true, 'Scenario B: detects real sent email');
  const lastDate = getLastRealSentEmailDate(threeDaysLead);
  assert(lastDate !== null, 'Scenario B: finds real sent email date');
  const daysDiff = getDaysSinceEmail(lastDate);
  assert(daysDiff === 3, `Scenario B: correctly identifies 3 days elapsed (got ${daysDiff})`);

  const opening = getEmailFollowUpOpening(threeDaysLead, threeDaysLead.companyName);
  assert(opening.includes('před několika dny') || opening.includes('poslal'), `Scenario B: opening references email sent a few days ago ("${opening}")`);
  assert(!opening.includes('minulého týdne'), 'Scenario B: NEVER claims last week when sent 3 days ago');

  const seq = generateOutreachSequence(threeDaysLead, { userProfile: { name: 'Petr' } });
  const day7Step = seq.steps.find(s => s.stepNumber === 3);
  assert(!day7Step!.content.includes('minulého týdne'), 'Scenario B: Step 3 generated content does not claim last week');
  assert(day7Step!.content.includes('před několika dny') || day7Step!.content.includes('navazuji na e-mail'), 'Scenario B: Step 3 properly references recent email');
}

// SCENARIO C: Email sent 7 days ago (last week)
{
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLead: PotentialCustomerLead = {
    ...baseLead,
    id: 'lead_7days',
    status: 'Osloveno',
    activities: [
      {
        id: 'act_3',
        leadId: 'lead_7days',
        channel: 'email',
        result: 'E-mail odeslán',
        statusAfter: 'Osloveno',
        createdAt: sevenDaysAgo.toISOString(),
        isSimulation: false
      }
    ]
  };

  assert(hasRealSentEmail(sevenDaysLead) === true, 'Scenario C: detects real sent email');
  const lastDate = getLastRealSentEmailDate(sevenDaysLead);
  assert(lastDate !== null, 'Scenario C: finds real sent email date');
  const daysDiff = getDaysSinceEmail(lastDate);
  assert(daysDiff === 7, `Scenario C: correctly identifies 7 days elapsed (got ${daysDiff})`);

  const opening = getEmailFollowUpOpening(sevenDaysLead, sevenDaysLead.companyName);
  assert(opening.includes('minulého týdne'), `Scenario C: can legitimately use last week ("${opening}")`);

  const seq = generateOutreachSequence(sevenDaysLead, { userProfile: { name: 'Petr' } });
  const day7Step = seq.steps.find(s => s.stepNumber === 3);
  assert(day7Step!.content.includes('minulého týdne'), 'Scenario C: Step 3 uses last week reference when 7 days elapsed');
}

// SCENARIO D: Simulated email (test simulation -> isSimulation: true)
{
  const simulatedLead: PotentialCustomerLead = {
    ...baseLead,
    id: 'lead_sim',
    status: 'Nový',
    activities: [
      {
        id: 'act_sim',
        leadId: 'lead_sim',
        channel: 'email',
        result: '[Testovací simulace] E-mail odeslán',
        statusAfter: 'Nový',
        createdAt: new Date().toISOString(),
        isSimulation: true
      }
    ]
  };

  assert(hasRealSentEmail(simulatedLead) === false, 'Scenario D: strictly ignores simulated email');
  assert(getLastRealSentEmailDate(simulatedLead) === null, 'Scenario D: returns null for real email date');

  const opening = getEmailFollowUpOpening(simulatedLead, simulatedLead.companyName);
  assert(!opening.includes('navazuji'), `Scenario D: opening has NO email reference for simulation ("${opening}")`);
  assert(!opening.includes('minulého týdne'), 'Scenario D: does not claim last week');
  assert(opening.includes('obracím se na vás ohledně prezentace'), `Scenario D: treats as fresh first contact ("${opening}")`);

  const seq = generateOutreachSequence(simulatedLead, { userProfile: { name: 'Petr' } });
  const day7Step = seq.steps.find(s => s.stepNumber === 3);
  assert(!hasEmailReference(day7Step!.content), 'Scenario D: Step 3 content contains no false email reference');
  assert(!day7Step!.subject.startsWith('Re:'), 'Scenario D: Step 3 subject is not Re:');
}

console.log('\n🎉 ALL 4 TEMPORAL AND CONTEXTUAL CONSISTENCY SCENARIOS PASSED SUCCESSFULLY!');
