// Safety net for live demos: drives ONE running case to the end with normal ("happy path") answers.
//   node tools/finish-happy-path.js <processInstanceKey>
// It approves the plan (admin), completes every nurse assessment with normal values and every physio
// session (user), and confirms every dispatched delivery, until the process instance is COMPLETED.
const API = 'http://localhost:8090/api';
const CAM = 'http://localhost:8080/v2';
const key = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = {};
async function login(u, p) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  return (await r.json()).token;
}
async function api(m, p, body, as) {
  const h = { Authorization: 'Bearer ' + T[as] };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(API + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${t}`);
  return t ? JSON.parse(t) : {};
}
const ANSWERS = {
  Task_ApprovePlan: { approvalDecision: 'APPROVED', approvalNotes: 'Approved' },
  Task_HealthAssessment: { visitStatus: 'COMPLETED', painScore: 2, temperature: 36.9, woundRedness: false, woundDischarge: false, swelling: false, nurseNotes: 'Normal visit' },
  Task_PhysioSession: { physioStatus: 'COMPLETED', physioNotes: 'Session completed' },
  Task_DoctorReview: { doctorDecision: 'HOME_CARE', doctorNotes: 'Continue home care' },
  Task_GapReview: { gapReviewDecision: 'ACCEPT_AND_CLOSE', reviewNotes: 'Accepted' },
};
(async () => {
  if (!key) throw new Error('usage: node tools/finish-happy-path.js <processInstanceKey>');
  T.ADMIN = await login('admin', process.env.APP_ADMIN_PASSWORD || 'admin@123');
  T.USER = await login('user', process.env.APP_USER_PASSWORD || 'user@123');
  const done = new Set(), confirmed = new Set();
  for (let i = 0; i < 300; i++) {
    const inst = (await (await fetch(`${CAM}/process-instances/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: { processInstanceKey: key } }) })).json()).items[0];
    if (inst && inst.state !== 'ACTIVE') { console.log('Process instance', key, inst.state); return; }
    for (const as of ['ADMIN', 'USER']) {
      for (const t of await api('GET', `/tasks?processInstanceKey=${key}`, null, as)) {
        if (done.has(t.userTaskKey) || !ANSWERS[t.elementId]) continue;
        const d = await api('GET', `/tasks/${t.userTaskKey}`, null, as);
        if (d.contextLoading) continue;
        try {
          await api('POST', `/tasks/${t.userTaskKey}/complete`, { variables: ANSWERS[t.elementId], actingUser: t.assignee || as.toLowerCase() }, as);
          done.add(t.userTaskKey);
          console.log('completed', t.name, d.context?.careDay ? `(day ${d.context.careDay.day})` : '');
        } catch (e) { if (!/already|not open/.test(e.message)) throw e; }
      }
    }
    const st = await api('GET', `/workflows/${key}/status`, null, 'ADMIN');
    for (const rx of st.prescriptions || []) {
      if (rx.deliveryStatus === 'DISPATCHED' && !confirmed.has(rx.deliveryRef)) {
        await api('POST', `/deliveries/${rx.deliveryRef}/confirm`, null, 'USER');
        confirmed.add(rx.deliveryRef);
        console.log('confirmed delivery', rx.deliveryRef, rx.medication);
      }
    }
    await sleep(1500);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
