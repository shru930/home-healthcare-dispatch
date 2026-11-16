// Captures REAL screenshots of the running system (React portal + Camunda Operate) for the README and report.
// Requires: backend :8090, frontend dev server :5173, Camunda 8 Run :8080, Chrome, and puppeteer-core on NODE_PATH.
//   node tools/capture-screenshots.js
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const OUT = path.join(__dirname, '..', 'documentation', 'screenshots');
const APP = 'http://localhost:5173';
const OPERATE = 'http://localhost:8080/operate';
const API = 'http://localhost:8090/api';
const CAM = 'http://localhost:8080/v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'documentation', 'evidence', 'scenario-results.json'))).results;
const key = id => results.find(r => r.id === id).processInstanceKey;

let TOKEN = null;
async function json(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN && url.startsWith(API)) headers.Authorization = 'Bearer ' + TOKEN;
  const r = await fetch(url, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  return r.json();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  TOKEN = (await json(API + '/auth/login', { username: 'admin', password: process.env.APP_ADMIN_PASSWORD || 'admin@123' })).token;
  const workflows = await json(`${API}/workflows`);
  const byName = n => workflows.find(w => w.patientName === n && w.status === 'ACTIVE')?.processInstanceKey;
  const live = { meena: byName('Meena Subramanian'), ramesh: byName('Ramesh Babu'), saraswathi: byName('Saraswathi Krishnan') };
  const child = (await json(`${CAM}/process-instances/search`, { filter: { parentProcessInstanceKey: key('TC10') } })).items
    .map(c => c.processInstanceKey);

  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 } });
  const page = await browser.newPage();
  const shot = async (name, opts = {}) => {
    await sleep(opts.wait ?? 2500);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!opts.full });
    console.log('saved', name);
  };
  const toForm = () => page.evaluate(() => { const f = document.querySelector('main form') || document.querySelector('main select, main textarea'); if (f) f.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
  const go = async (url, name, opts) => { await page.goto(url, { waitUntil: 'networkidle2' }); await shot(name, opts); };
  const clickText = async (text, selector = 'button, a, li, tr, div[role=button]') => {
    const ok = await page.evaluate((t, sel) => {
      const el = [...document.querySelectorAll(sel)].filter(e => e.textContent.includes(t) && e.offsetParent !== null)
        .sort((a, b) => (a.tagName === 'BUTTON' ? 0 : 1) - (b.tagName === 'BUTTON' ? 0 : 1) || a.textContent.length - b.textContent.length)[0];
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
      return false;
    }, text, selector);
    if (!ok) console.warn('  (not found: ' + text + ')');
    return ok;
  };

  // ------------------------------------------------------------------ React portal (two logins)
  const sessions = {};
  for (const [u, pw] of [['admin', process.env.APP_ADMIN_PASSWORD || 'admin@123'], ['user', process.env.APP_USER_PASSWORD || 'user@123']]) {
    const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: pw }) });
    sessions[u] = await r.json();
  }
  const loginAs = async (u) => {
    await page.goto(APP + '/login', { waitUntil: 'networkidle2' });
    await page.evaluate((s) => localStorage.setItem('hh.session', JSON.stringify(s)), sessions[u]);
  };
  await go(APP + '/login', '00-login', { wait: 1500 });
  await loginAs('admin');
  await go(APP + '/', '01-dashboard', { wait: 3500 });
  await go(APP + '/patients', '02-patients');
  if (await clickText('Discharge & start 7-day plan')) {
    await sleep(800);
    await clickText('Add session'); await clickText('Add prescription');
    await shot('03-discharge-form-array-builders', { wait: 1200 });
    await page.keyboard.press('Escape');
  }
  await go(APP + '/nurses', '04-nurses-and-assignments', { full: true });
  await go(APP + '/visits', '05-home-care-visits');
  await go(APP + '/physio', '06-physiotherapy');
  await go(APP + '/pharmacy', '07-pharmacy-deliveries', { full: true });
  await go(APP + '/risk', '08-readmission-risk');

  await go(APP + '/tasks', '09-tasklist-admin-approvals', { wait: 4000 });
  if (await clickText('Approve home-care plan')) { await sleep(3500); await page.evaluate(() => window.scrollTo(0, 250)); await shot('09b-tasklist-approve-plan', { wait: 800 }); }
  if (await clickText('Doctor review')) { await sleep(3500); await toForm(); await shot('11-tasklist-doctor-review', { wait: 800 }); }
  await loginAs('user');
  await go(APP + '/tasks', '09-tasklist-inbox', { wait: 4000 });
  if (await clickText('Home visit and health assessment')) { await sleep(3500); await toForm(); await shot('10-tasklist-health-assessment-form', { wait: 800 }); }
  await loginAs('admin');

  if (live.saraswathi) await go(`${APP}/tracker/${live.saraswathi}`, '12-tracker-active-plan', { full: true, wait: 4000 });
  if (live.ramesh) await go(`${APP}/tracker/${live.ramesh}`, '13-tracker-incident', { wait: 4000 });
  await go(`${APP}/tracker/${key('TC01')}`, '14-tracker-completed-plan', { full: true, wait: 4000 });
  await go(APP + '/notifications', '15-notifications');
  await go(APP + '/demo', '16-demo-fault-injection');

  // ------------------------------------------------------------------ Camunda Operate
  await page.goto(OPERATE, { waitUntil: 'networkidle2' });
  if (await page.$('input[name=username], #username')) {
    await page.type('input[name=username], #username', 'demo');
    await page.type('input[name=password], #password', 'demo');
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  }
  await go(`${OPERATE}/processes?active=true&incidents=true&completed=true&canceled=true&process=home-healthcare-dispatch&version=all`, '20-operate-instances', { wait: 5000 });
  const op = [
    ['TC01', '21-operate-happy-path-completed'],
    ['TC04', '22-operate-error-boundary-emergency'],
    ['TC05', '23-operate-timer-boundaries-missed-visits'],
    ['TC06', '24-operate-distance-api-fallback'],
    ['TC09', '25-operate-notification-failure'],
    ['TC10', '26-operate-pharmacy-call-activity'],
    ['TC14', '27-operate-intervention-timeout'],
    ['TC02', '28-operate-doctor-reminder-timer'],
  ];
  for (const [id, name] of op) await go(`${OPERATE}/processes/${key(id)}`, name, { wait: 5000 });
  if (child[0]) await go(`${OPERATE}/processes/${child[0]}`, '29-operate-child-pharmacy-instance', { wait: 5000 });
  if (live.ramesh) await go(`${OPERATE}/processes/${live.ramesh}`, '30-operate-incident-sms-gateway-down', { wait: 5000 });
  if (live.meena) await go(`${OPERATE}/processes/${live.meena}`, '31-operate-active-instance-waiting', { wait: 5000 });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
