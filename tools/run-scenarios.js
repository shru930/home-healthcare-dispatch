// End-to-end scenario tests against the RUNNING stack (React-equivalent calls to the Spring Boot API,
// which talks to Camunda 8 and PostgreSQL). Every result is read back from the real systems.
//
//   node tools/run-scenarios.js            -> all scenarios
//   node tools/run-scenarios.js TC01 TC04  -> selected scenarios
//
// Writes documentation/evidence/scenario-results.json and scenario-results.md
const fs = require('fs');
const path = require('path');

const API = process.env.BACKEND_URL || 'http://localhost:8090/api';
const CAM = (process.env.CAMUNDA_REST_ADDRESS || 'http://localhost:8080') + '/v2';
const OUT = path.join(__dirname, '..', 'documentation', 'evidence');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date();
const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(today.getTime() - n * 86400000));

async function api(method, p, body) {
  const r = await fetch(API + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${j.message || t}`);
  return j;
}
async function cam(resource, filter) {
  const r = await fetch(`${CAM}/${resource}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, page: { limit: 1000 } }) });
  return (await r.json()).items || [];
}
const fault = (f, mode) => api('POST', '/demo/faults', { fault: f, mode });
const resetFaults = () => api('POST', '/demo/faults/reset');

let seq = Date.now() % 100000;
async function startCase({ name, lat = 12.9791, lng = 80.2209, physio = [{ dayNumber: 2, focus: 'Knee mobility' }, { dayNumber: 4, focus: 'Walking practice' }],
                           rx = [{ medication: 'Paracetamol 500mg', dosage: '1 tablet every 8 hours', quantity: 21, controlled: false, doctorApproved: true },
                                 { medication: 'Pantoprazole 40mg', dosage: '1 tablet before breakfast', quantity: 7, controlled: false, doctorApproved: true }],
                           discharge = daysAgo(0), surgery = daysAgo(3), timers = undefined, familyPhone = '9876500002' }) {
  seq++;
  const [first, last] = name.split(' ');
  const p = await api('POST', '/patients', {
    mrn: `MRN-${seq}`, firstName: first, lastName: last, dateOfBirth: '1960-05-14', gender: 'F', phone: '9876500001',
    email: `${first.toLowerCase()}@example.com`, addressLine: '12 Lake View Road', city: 'Chennai', postalCode: '600042',
    latitude: lat, longitude: lng, familyContactName: 'Family of ' + first, familyContactPhone: familyPhone,
    familyContactEmail: `family.${first.toLowerCase()}${seq}@example.com` });
  const w = await api('POST', `/patients/${p.id}/discharge`, {
    surgeryType: 'Total knee replacement', surgeryDate: surgery, dischargeDate: discharge, hospital: 'City General Hospital',
    doctorName: 'Dr. Meera Rao', doctorEmail: 'meera.rao@citygeneral.example', requiredSkill: 'WOUND_CARE',
    physioSessions: physio, prescriptions: rx, timerOverrides: timers });
  return { patientId: p.id, key: String(w.processInstanceKey), mrn: p.mrn };
}

const normal = { visitStatus: 'COMPLETED', painScore: 2, temperature: 36.9, woundRedness: false, woundDischarge: false, swelling: false, nurseNotes: 'Wound clean, patient comfortable' };

/** Completes user tasks according to the policy, confirms deliveries, and collects execution statistics. */
async function drive(c, policy = {}, timeoutSec = 240) {
  const stats = { maxOpenAssessments: 0, maxOpenPhysio: 0, assessmentDays: [], completed: [], deliveriesConfirmed: [] };
  const done = new Set();
  const firstSeen = {};
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < timeoutSec) {
    const inst = (await cam('process-instances', { processInstanceKey: c.key }))[0];
    if (inst && inst.state !== 'ACTIVE') { stats.state = inst.state; break; }
    const tasks = await api('GET', `/tasks?processInstanceKey=${c.key}`);
    stats.maxOpenAssessments = Math.max(stats.maxOpenAssessments, tasks.filter(t => t.elementId === 'Task_HealthAssessment').length);
    stats.maxOpenPhysio = Math.max(stats.maxOpenPhysio, tasks.filter(t => t.elementId === 'Task_PhysioSession').length);
    for (const t of tasks) {
      if (done.has(t.userTaskKey)) continue;
      firstSeen[t.userTaskKey] = firstSeen[t.userTaskKey] || Date.now();
      const d = await api('GET', `/tasks/${t.userTaskKey}`);
      if (d.contextLoading || !d.context || !Object.keys(d.context).length) continue; // variables not indexed yet, retry next tick
      const handler = policy[t.elementId] ?? defaults[t.elementId];
      const answer = handler ? await handler(d.context || {}, { ageMs: Date.now() - firstSeen[t.userTaskKey], c, stats }) : undefined;
      if (answer == null) continue; // leave it open (timer paths)
      try {
        await api('POST', `/tasks/${t.userTaskKey}/complete`, { variables: answer, actingUser: t.assignee || 'coordinator' });
        done.add(t.userTaskKey);
        stats.completed.push(t.elementId);
        if (t.elementId === 'Task_HealthAssessment') stats.assessmentDays.push(d.context.careDay?.day);
      } catch (e) { if (!/not open/.test(e.message)) throw e; }
    }
    if (policy.confirmDeliveries !== false) {
      const st = await api('GET', `/workflows/${c.key}/status`);
      for (const rx of st.prescriptions || []) {
        if (rx.deliveryStatus === 'DISPATCHED' && !stats.deliveriesConfirmed.includes(rx.deliveryRef)) {
          firstSeen[rx.deliveryRef] = firstSeen[rx.deliveryRef] || Date.now();
          if (Date.now() - firstSeen[rx.deliveryRef] < (policy.confirmAfterMs || 0)) continue;
          await api('POST', `/deliveries/${rx.deliveryRef}/confirm`);
          stats.deliveriesConfirmed.push(rx.deliveryRef);
        }
      }
    }
    if (policy.onTick) await policy.onTick(c, stats);
    await sleep(1200);
  }
  stats.state = stats.state || 'TIMEOUT';
  await sleep(4000); // let the notification log ingest the last e-mail
  stats.tracker = await api('GET', `/workflows/${c.key}/status`);
  stats.elements = await cam('element-instances', { processInstanceKey: c.key });
  stats.children = await cam('process-instances', { parentProcessInstanceKey: c.key });
  stats.childElements = [];
  for (const ch of stats.children) stats.childElements.push(...await cam('element-instances', { processInstanceKey: ch.processInstanceKey }));
  stats.seconds = Math.round((Date.now() - t0) / 1000);
  return stats;
}

const defaults = {
  Task_HealthAssessment: () => normal,
  Task_PhysioSession: () => ({ physioStatus: 'COMPLETED', physioNotes: 'Exercises completed' }),
  Task_DoctorReview: () => ({ doctorDecision: 'HOME_CARE', doctorNotes: 'Adjust analgesia, continue home care' }),
  Task_ManualNurse: () => ({ selectedNurseId: 4, manualAssignmentNote: 'Agency nurse confirmed by phone' }),
  Task_CorrectDischarge: () => ({ patientPhone: '9876500001', familyPhone: '9876500002', familyEmail: 'corrected.family@example.com', dischargeDate: daysAgo(0) }),
  Task_ManualEmergency: () => ({ emergencyOutcome: 'AMBULANCE_ARRANGED', emergencyNotes: 'Ambulance called, ETA 15 minutes' }),
  Task_GapReview: () => ({ gapReviewDecision: 'ACCEPT_AND_CLOSE', reviewNotes: 'Gaps explained by patient availability' }),
};

// ------------------------------------------------------------------ assertion helpers
const ran = (s, id) => s.elements.some(e => e.elementId === id && e.state === 'COMPLETED') || s.childElements.some(e => e.elementId === id && e.state === 'COMPLETED');
const count = (s, id) => s.elements.filter(e => e.elementId === id && e.state === 'COMPLETED').length + s.childElements.filter(e => e.elementId === id && e.state === 'COMPLETED').length;
const notif = (s, ch, cat, status = 'SENT') => (s.tracker.notifications || []).filter(n => n.channel === ch && n.category === cat && n.status === status).length;
const day = (s, n) => (s.tracker.visits || []).find(v => v.day === n) || {};

const SCENARIOS = [
  { id: 'TC01', title: 'Happy path: registration, nearest nurse, 7 sequential visits, parallel physio, pharmacy call activity, completion',
    covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18],
    async run() {
      const c = await startCase({ name: 'Lakshmi Iyer' });
      const s = await drive(c);
      return [c, s, [
        ['Patient registered and workflow started', !!c.key],
        ['Nearest nurse = Priya Natarajan (0.6 km, Velachery)', s.tracker.assignment?.username === 'nurse.priya'],
        ['Distance from Google Distance Matrix connector (mock mode)', s.tracker.assignment?.source === 'DISTANCE_MATRIX_API'],
        ['7 visits scheduled and completed', (s.tracker.visits || []).filter(v => v.status === 'COMPLETED').length === 7],
        ['Sequential MI: never more than 1 assessment open', s.maxOpenAssessments === 1],
        ['Sequential MI (engine timestamps): each day starts only after the previous day ended', (() => {
          const a = s.elements.filter(e => e.elementId === 'Task_HealthAssessment').sort((x, y) => x.startDate.localeCompare(y.startDate));
          return a.length === 7 && a.every((e, i) => i === 0 || e.startDate >= a[i - 1].endDate); })()],
        ['Parallel MI: both physio sessions open at the same time', s.maxOpenPhysio === 2],
        ['Pharmacy call activity: one child instance per prescription', s.children.length === 2],
        ['Prescriptions fulfilled and delivered', (s.tracker.prescriptions || []).every(r => r.status === 'DELIVERED')],
        ['Delivery SMS sent for each prescription', notif(s, 'SMS', 'MEDICATION_DELIVERED') === 2],
        ['Nurse-assignment e-mail sent (Email connector)', notif(s, 'EMAIL', 'NURSE_ASSIGNMENT') === 1],
        ['Final status e-mail sent', notif(s, 'EMAIL', 'FINAL_STATUS') === 1],
        ['Plan outcome COMPLETED, process COMPLETED', s.state === 'COMPLETED' && s.tracker.planOutcome === 'COMPLETED'],
      ]];
    } },
  { id: 'TC02', title: 'High pain score -> ELEVATED -> Readmission Risk Intervention -> doctor review with non-interrupting reminder timer',
    covers: [11, 13, 15],
    async run() {
      const c = await startCase({ name: 'Ravi Kumar', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab 8-hourly', quantity: 21, controlled: false, doctorApproved: true }],
                                  timers: { doctorReviewReminder: 'PT5S' } });
      const s = await drive(c, {
        Task_HealthAssessment: ctx => ctx.careDay?.day === 1 ? { ...normal, painScore: 7, temperature: 37.2, nurseNotes: 'Pain 7/10 at the knee' } : normal,
        Task_DoctorReview: (ctx, { ageMs }) => ageMs > 9000 ? { doctorDecision: 'HOME_CARE', doctorNotes: 'Increase analgesia, review tomorrow' } : null,
      });
      const iv = (s.tracker.interventions || [])[0] || {};
      return [c, s, [
        ['Day 1 classified ELEVATED (pain 7 >= 6)', day(s, 1).riskLevel === 'ELEVATED'],
        ['Risk intervention sub-process ran', ran(s, 'Sub_RiskIntervention')],
        ['Non-interrupting reminder timer fired while review stayed open', ran(s, 'Timer_DoctorReminder') && ran(s, 'Task_RemindDoctor')],
        ['Doctor review completed afterwards (task was not cancelled)', ran(s, 'Task_DoctorReview')],
        ['Intervention closed as RESOLVED_HOME_CARE', iv.status === 'RESOLVED_HOME_CARE'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC03', title: 'Infection indicators (wound discharge + fever) -> CRITICAL -> urgent response + SMS critical alert',
    covers: [12, 13],
    async run() {
      const c = await startCase({ name: 'Fatima Begum', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Amoxicillin 500mg', dosage: '1 cap 8-hourly', quantity: 21, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { Task_HealthAssessment: ctx => ctx.careDay?.day === 2
          ? { ...normal, painScore: 5, temperature: 38.6, woundRedness: true, woundDischarge: true, nurseNotes: 'Purulent discharge, fever' } : normal });
      const iv = (s.tracker.interventions || [])[0] || {};
      return [c, s, [
        ['Day 2 classified CRITICAL (discharge + fever)', day(s, 2).riskLevel === 'CRITICAL'],
        ['Urgent response dispatched', ran(s, 'Task_DispatchEmergency')],
        ['Critical SMS sent to family (REST connector)', notif(s, 'SMS', 'CRITICAL_ALERT') === 1],
        ['Intervention RESOLVED_URGENT_RESPONSE', iv.status === 'RESOLVED_URGENT_RESPONSE'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC04', title: 'Error boundary: urgent-response dispatch fails -> EMERGENCY_DISPATCH_FAILED caught on the sub-process -> manual coordination',
    covers: [14],
    async run() {
      await fault('EMERGENCY_DISPATCH', 'FAIL');
      const c = await startCase({ name: 'George Thomas', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { Task_HealthAssessment: ctx => ctx.careDay?.day === 1 ? { ...normal, painScore: 9, temperature: 37.4, nurseNotes: 'Severe pain' } : normal,
        onTick: async (cc, st) => { if (st.completed.includes('Task_ManualEmergency')) await resetFaults(); } });
      await resetFaults();
      const iv = (s.tracker.interventions || [])[0] || {};
      return [c, s, [
        ['Day 1 CRITICAL (pain 9 >= 8)', day(s, 1).riskLevel === 'CRITICAL'],
        ['Error boundary event on the sub-process triggered', ran(s, 'Err_EmergencyDispatch')],
        ['Coordinator handled it in the Tasklist', ran(s, 'Task_ManualEmergency') && ran(s, 'Task_RecordEscalation')],
        ['Intervention RESOLVED_MANUAL_AMBULANCE_ARRANGED', iv.status === 'RESOLVED_MANUAL_AMBULANCE_ARRANGED'],
        ['Process still COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC05', title: 'Interrupting timer boundaries: missed visits and missed physiotherapy -> plan COMPLETED_WITH_GAPS -> coordinator gap review',
    covers: [15, 18],
    async run() {
      const c = await startCase({ name: 'Suresh Pillai', physio: [{ dayNumber: 2, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }],
                                  timers: { visitWindow: 'PT6S', physioWindow: 'PT6S' } });
      const s = await drive(c, { Task_HealthAssessment: ctx => [3, 5].includes(ctx.careDay?.day) ? null : normal, Task_PhysioSession: () => null });
      return [c, s, [
        ['Visit timer fired twice (days 3 and 5 missed)', count(s, 'Timer_VisitWindow') === 2 && day(s, 3).status === 'MISSED' && day(s, 5).status === 'MISSED'],
        ['Physio appointment timer fired (session missed)', ran(s, 'Timer_PhysioWindow') && (s.tracker.physio || [])[0]?.status === 'MISSED'],
        ['Plan COMPLETED_WITH_GAPS and gap review done', s.tracker.planOutcome === 'COMPLETED_WITH_GAPS' && ran(s, 'Task_GapReview')],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC06', title: 'External API failure: Distance Matrix OVER_QUERY_LIMIT -> DISTANCE_API_ERROR boundary -> straight-line fallback',
    covers: [16, 14],
    async run() {
      await fault('DISTANCE_API', 'OVER_QUERY_LIMIT');
      const c = await startCase({ name: 'Anjali Menon', lat: 12.8231, lng: 80.0444, physio: [{ dayNumber: 3, focus: 'Mobility' }],
                                  rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { onTick: async (cc) => { const e = await cam('element-instances', { processInstanceKey: cc.key, elementId: 'Task_FallbackDistance' }); if (e.length) await resetFaults(); } });
      await resetFaults();
      return [c, s, [
        ['HTTP 200 with status OVER_QUERY_LIMIT detected -> DISTANCE_API_ERROR boundary', ran(s, 'Err_DistanceInvalid')],
        ['Fallback ranking used', ran(s, 'Task_FallbackDistance') && s.tracker.assignment?.source === 'FALLBACK_STRAIGHT_LINE'],
        ['Nearest nurse still found (Joseph, SRM Potheri)', s.tracker.assignment?.username === 'nurse.joseph'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC15', title: 'External API failure: Distance Matrix HTTP 500 -> connector errorExpression -> DISTANCE_API_ERROR boundary on the REST task',
    covers: [16, 14],
    async run() {
      await fault('DISTANCE_API', 'HTTP_500');
      const c = await startCase({ name: 'Arjun Reddy', physio: [{ dayNumber: 3, focus: 'Mobility' }],
                                  rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { onTick: async (cc, st) => { const e = await cam('element-instances', { processInstanceKey: cc.key, elementId: 'Task_FallbackDistance' }); if (e.length) await resetFaults(); } });
      await resetFaults();
      return [c, s, [
        ['Error boundary on the REST connector task triggered', ran(s, 'Err_DistanceApi')],
        ['Fallback ranking used', ran(s, 'Task_FallbackDistance') && s.tracker.assignment?.source === 'FALLBACK_STRAIGHT_LINE'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC07', title: 'No suitable nurse: every nurse beyond the travel limit -> NO_SUITABLE_NURSE -> manual assignment',
    covers: [3, 14],
    async run() {
      await fault('NURSE_POOL', 'FAR_AWAY');
      const c = await startCase({ name: 'Mohan Das', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { onTick: async (cc, st) => { if (st.completed.includes('Task_ManualNurse')) await resetFaults(); } });
      await resetFaults();
      return [c, s, [
        ['Error boundary NO_SUITABLE_NURSE triggered', ran(s, 'Err_NoNurse')],
        ['Coordinator assigned a nurse manually', ran(s, 'Task_ManualNurse') && s.tracker.assignment?.mode === 'MANUAL'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC08', title: 'Nurse pool empty -> timer retry loop (3 attempts) -> manual assignment',
    covers: [3, 15],
    async run() {
      await fault('NURSE_POOL', 'EMPTY');
      const c = await startCase({ name: 'Kavitha Raj', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }],
                                  timers: { nurseRetryWait: 'PT3S' } });
      const s = await drive(c, { onTick: async (cc, st) => { if (st.completed.includes('Task_ManualNurse')) await resetFaults(); } });
      await resetFaults();
      return [c, s, [
        ['Nurse search ran 3 times', count(s, 'Task_FetchNurses') === 3],
        ['Retry timer fired twice', count(s, 'Timer_NurseRetry') === 2],
        ['Manual assignment after the retries', ran(s, 'Task_ManualNurse')],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC09', title: 'Notification failure: SMTP down -> SMS fallback; SMS rejected too -> failure recorded, care continues',
    covers: [17],
    async run() {
      await fault('EMAIL_SERVER', 'DOWN');
      await fault('SMS_GATEWAY', 'REJECT');
      const c = await startCase({ name: 'Deepa Nair', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      let reset = false;
      const s = await drive(c, { onTick: async (cc, st) => {
        if (reset) return;
        const els = await cam('element-instances', { processInstanceKey: cc.key, elementId: 'Task_RecordNotifyFailure' });
        if (els.some(e => e.state === 'COMPLETED')) { await resetFaults(); reset = true; }
      } });
      await resetFaults();
      return [c, s, [
        ['E-mail connector failed -> error boundary', ran(s, 'Err_EmailAssign')],
        ['SMS fallback failed -> error boundary', ran(s, 'Err_SmsAssign')],
        ['Failure recorded and coordinator alerted', ran(s, 'Task_RecordNotifyFailure') && notif(s, 'EMAIL+SMS', 'NURSE_ASSIGNMENT', 'FAILED') === 1],
        ['Care plan continued and completed', s.state === 'COMPLETED' && ran(s, 'Task_HealthAssessment')],
      ]];
    } },
  { id: 'TC10', title: 'Pharmacy: rejected (controlled, no approval), partner pharmacy, unavailable, delayed-delivery reminder',
    covers: [8, 9, 10],
    async run() {
      const c = await startCase({ name: 'Imran Khan', physio: [{ dayNumber: 3, focus: 'Mobility' }], timers: { deliveryReminder: 'PT4S' },
        rx: [{ medication: 'Tramadol 50mg', dosage: '1 tab when needed', quantity: 10, controlled: true, doctorApproved: false },
             { medication: 'Cefuroxime 500mg', dosage: '1 tab 12-hourly', quantity: 10, controlled: false, doctorApproved: true },
             { medication: 'Insulin glargine 100U', dosage: '10 units nightly', quantity: 1, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { confirmAfterMs: 9000 });
      const rx = Object.fromEntries((s.tracker.prescriptions || []).map(r => [r.medication, r.status]));
      return [c, s, [
        ['Three child instances (parallel multi-instance call activity)', s.children.length === 3],
        ['Controlled drug without approval -> REJECTED, doctor alerted', rx['Tramadol 50mg'] === 'REJECTED' && ran(s, 'Task_NotifyRejection')],
        ['Out of stock -> partner pharmacy -> DELIVERED', rx['Cefuroxime 500mg'] === 'DELIVERED' && ran(s, 'Task_SourcePartner')],
        ['Not stocked anywhere -> UNAVAILABLE', rx['Insulin glargine 100U'] === 'UNAVAILABLE' && ran(s, 'Task_MarkUnavailable')],
        ['Non-interrupting delivery reminder -> delay SMS', ran(s, 'Timer_DeliveryReminder') && notif(s, 'SMS', 'DELIVERY_DELAYED') >= 1],
        ['Call activity outputs collected in pharmacyResults', ran(s, 'Call_Pharmacy')],
        ['Process COMPLETED with gaps reviewed', s.state === 'COMPLETED' && s.tracker.planOutcome === 'COMPLETED_WITH_GAPS'],
      ]];
    } },
  { id: 'TC11', title: 'Courier unavailable -> COURIER_UNAVAILABLE boundary in the child process -> delivery DELAYED',
    covers: [9, 10, 14],
    async run() {
      await fault('COURIER', 'UNAVAILABLE');
      const c = await startCase({ name: 'Rekha Sharma', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Ondansetron 4mg', dosage: '1 tab 8-hourly', quantity: 9, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { onTick: async (cc, st) => { if (st.children?.length || true) { const ch = await cam('process-instances', { parentProcessInstanceKey: cc.key }); if (ch.some(x => x.state === 'COMPLETED')) await resetFaults(); } } });
      await resetFaults();
      const rx = (s.tracker.prescriptions || [])[0] || {};
      return [c, s, [
        ['Courier error boundary triggered in the child process', ran(s, 'Err_Courier') && ran(s, 'Task_Reschedule')],
        ['Prescription DELAYED, returned to the parent via output mapping', rx.status === 'DELAYED'],
        ['Process COMPLETED with gaps', s.state === 'COMPLETED' && s.tracker.planOutcome === 'COMPLETED_WITH_GAPS'],
      ]];
    } },
  { id: 'TC12', title: 'Invalid discharge (date 20 days old) -> coordinator corrects details -> validation passes',
    covers: [1, 2],
    async run() {
      const c = await startCase({ name: 'Nalini Rao', discharge: daysAgo(20), surgery: daysAgo(23), physio: [{ dayNumber: 3, focus: 'Mobility' }],
                                  rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c);
      return [c, s, [
        ['Validation failed first, correction task completed', ran(s, 'Task_CorrectDischarge')],
        ['Validation re-run passed (2 validations)', count(s, 'Task_ValidateDischarge') === 2],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
  { id: 'TC13', title: 'Doctor decides READMIT -> hospital readmission arranged',
    covers: [13],
    async run() {
      const c = await startCase({ name: 'Vikram Singh', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }] });
      const s = await drive(c, { Task_HealthAssessment: ctx => ctx.careDay?.day === 1 ? { ...normal, painScore: 6, temperature: 38.2, woundRedness: true, nurseNotes: 'Red, warm wound' } : normal,
        Task_DoctorReview: () => ({ doctorDecision: 'READMIT', doctorNotes: 'Suspected wound infection, readmit for IV antibiotics' }) });
      const iv = (s.tracker.interventions || [])[0] || {};
      return [c, s, [
        ['Readmission arranged', ran(s, 'Task_Readmit') && iv.status === 'RESOLVED_READMITTED'],
        ['Patient status READMISSION_ARRANGED', s.tracker.patient?.status === 'READMISSION_ARRANGED'],
      ]];
    } },
  { id: 'TC14', title: 'Interrupting timer on the Readmission Risk sub-process: no doctor decision in time -> clinical lead escalation',
    covers: [13, 15],
    async run() {
      const c = await startCase({ name: 'Usha Krishnan', physio: [{ dayNumber: 3, focus: 'Mobility' }], rx: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }],
                                  timers: { interventionTimeout: 'PT6S', doctorReviewReminder: 'PT30M' } });
      const s = await drive(c, { Task_HealthAssessment: ctx => ctx.careDay?.day === 1 ? { ...normal, painScore: 7, nurseNotes: 'Pain 7' } : normal, Task_DoctorReview: () => null });
      const iv = (s.tracker.interventions || [])[0] || {};
      return [c, s, [
        ['Sub-process timer fired and cancelled the open review', ran(s, 'Timer_InterventionTimeout') && !ran(s, 'Task_DoctorReview')],
        ['Escalated to the clinical lead', ran(s, 'Task_ClinicalLead') && iv.status === 'ESCALATED_CLINICAL_LEAD'],
        ['Process COMPLETED', s.state === 'COMPLETED'],
      ]];
    } },
];

(async () => {
  const only = process.argv.slice(2);
  await resetFaults();
  const results = [];
  for (const sc of SCENARIOS.filter(x => !only.length || only.includes(x.id))) {
    process.stdout.write(`${sc.id} ${sc.title}\n`);
    try {
      const [c, s, checks] = await sc.run();
      const pass = checks.every(([, ok]) => ok);
      results.push({ id: sc.id, title: sc.title, covers: sc.covers, processInstanceKey: c.key, patientMrn: c.mrn, state: s.state, seconds: s.seconds,
                     pass, checks: checks.map(([name, ok]) => ({ name, ok: !!ok })) });
      for (const [name, ok] of checks) process.stdout.write(`   ${ok ? 'PASS' : 'FAIL'}  ${name}\n`);
      process.stdout.write(`   => ${pass ? 'PASS' : 'FAIL'}  key=${c.key}  ${s.seconds}s\n`);
    } catch (e) {
      await resetFaults().catch(() => {});
      results.push({ id: sc.id, title: sc.title, covers: sc.covers, pass: false, error: e.message, checks: [] });
      process.stdout.write(`   ERROR ${e.message}\n`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const prev = fs.existsSync(path.join(OUT, 'scenario-results.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'scenario-results.json'))).results : [];
  const merged = [...prev.filter(p => !results.some(r => r.id === p.id)), ...results].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(OUT, 'scenario-results.json'), JSON.stringify({ runAt: new Date().toISOString(), results: merged }, null, 2));
  const md = ['| ID | Scenario | Covers | Process instance | Result |', '|---|---|---|---|---|',
    ...merged.map(r => `| ${r.id} | ${r.title} | ${(r.covers || []).join(', ')} | ${r.processInstanceKey || '-'} | ${r.pass ? 'PASS' : 'FAIL'} |`)];
  fs.writeFileSync(path.join(OUT, 'scenario-results.md'), md.join('\n') + '\n');
  console.log(`${merged.filter(r => r.pass).length}/${merged.length} scenarios passed`);
})().catch(e => { console.error(e); process.exit(1); });
