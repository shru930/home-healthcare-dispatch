// Creates live demo instances (left ACTIVE on purpose) for the presentation and screenshots:
//  A) "Meena Subramanian": days 1-2 done, waiting for the day-3 nurse assessment, deliveries in transit.
//  B) "Ramesh Babu": CRITICAL assessment while the SMS gateway is down -> connector retries exhausted -> INCIDENT in Operate.
const API = 'http://localhost:8090/api';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(m, p, b) { const r = await fetch(API + p, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(m + ' ' + p + ' ' + t); return t ? JSON.parse(t) : {}; }
const d = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
async function start(first, last, lat, lng, mrn) {
  const p = await api('POST', '/patients', { mrn, firstName: first, lastName: last, dateOfBirth: '1957-08-21', gender: 'F', phone: '9840022001',
    email: first.toLowerCase() + '@example.com', addressLine: '4 Gandhi Street, Adyar', city: 'Chennai', postalCode: '600020', latitude: lat, longitude: lng,
    familyContactName: 'Karthik ' + last, familyContactPhone: '9840022002', familyContactEmail: 'karthik.' + last.toLowerCase() + '@example.com' });
  const w = await api('POST', `/patients/${p.id}/discharge`, { surgeryType: 'Hip replacement', surgeryDate: d(3), dischargeDate: d(0), hospital: 'City General Hospital',
    doctorName: 'Dr. Meera Rao', doctorEmail: 'meera.rao@citygeneral.example', requiredSkill: 'WOUND_CARE',
    physioSessions: [{ dayNumber: 2, focus: 'Bed mobility' }, { dayNumber: 4, focus: 'Walking with frame' }, { dayNumber: 6, focus: 'Stairs' }],
    prescriptions: [{ medication: 'Paracetamol 500mg', dosage: '1 tablet every 8 hours', quantity: 21, controlled: false, doctorApproved: true },
                    { medication: 'Enoxaparin 40mg', dosage: '1 injection daily', quantity: 7, controlled: false, doctorApproved: true }],
    timerOverrides: { interventionTimeout: 'PT12H', doctorReviewReminder: 'PT12H', visitWindow: 'PT12H', deliveryTimeout: 'PT12H' } });
  return String(w.processInstanceKey);
}
const doneTasks = new Set();
async function completeAssessment(key, vars) {
  for (let i = 0; i < 40; i++) {
    const t = (await api('GET', `/tasks?processInstanceKey=${key}`)).find(x => x.elementId === 'Task_HealthAssessment' && !doneTasks.has(x.userTaskKey));
    if (t) { const det = await api('GET', `/tasks/${t.userTaskKey}`); if (!det.contextLoading) { await api('POST', `/tasks/${t.userTaskKey}/complete`, { variables: vars, actingUser: t.assignee }); doneTasks.add(t.userTaskKey); return; } }
    await sleep(1000);
  }
  throw new Error('no assessment task');
}
(async () => {
  const s = Date.now() % 10000;
  const a = await start('Meena', 'Subramanian', 13.0012, 80.2565, 'MRN-DEMO-A' + s);
  await completeAssessment(a, { visitStatus: 'COMPLETED', painScore: 3, temperature: 37.0, woundRedness: false, woundDischarge: false, swelling: false, nurseNotes: 'Day 1: settled at home' });
  await completeAssessment(a, { visitStatus: 'COMPLETED', painScore: 2, temperature: 36.8, woundRedness: false, woundDischarge: false, swelling: true, nurseNotes: 'Day 2: mild swelling' });
  console.log('A active, waiting for the doctor review of day 2 (swelling = ELEVATED):', a);
  await api('POST', '/demo/faults', { fault: 'SMS_GATEWAY', mode: 'DOWN' });
  const b = await start('Ramesh', 'Babu', 12.9249, 80.1, 'MRN-DEMO-B' + s);
  await completeAssessment(b, { visitStatus: 'COMPLETED', painScore: 9, temperature: 38.9, woundRedness: true, woundDischarge: true, swelling: true, nurseNotes: 'Severe pain, discharge and fever' });
  // connector: 3 attempts with 5 s backoff -> incident
  for (let i = 0; i < 60; i++) { const st = await api('GET', `/workflows/${b}/status`); if ((st.incidents || []).length) { console.log('B incident:', st.incidents[0].elementId, st.incidents[0].errorMessage.slice(0, 120)); break; } await sleep(2000); }
  await api('POST', '/demo/faults/reset');
  console.log('B active with incident:', b);
})().catch(e => { console.error(e.message); process.exit(1); });
