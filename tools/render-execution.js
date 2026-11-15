// Renders the REAL execution path of a process instance onto its BPMN diagram.
// Data source: Camunda 8 REST API /v2/element-instances (the same data Operate shows).
//   green  = completed   blue = active (waiting)   red = incident   grey = cancelled by a boundary event/timer
// Usage: node tools/render-execution.js <processInstanceKey> <bpmnFile> <out.png> [x y width height]
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const CAM = 'http://localhost:8080/v2';

(async () => {
  const [, , key, bpmnFile, out, ...box] = process.argv;
  const r = await fetch(`${CAM}/element-instances/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: { processInstanceKey: key }, page: { limit: 2000 } }) });
  const items = (await r.json()).items || [];
  const state = {};
  const rank = { TERMINATED: 1, COMPLETED: 2, ACTIVE: 3 };
  for (const e of items) {
    const s = e.incident ? 'INCIDENT' : e.state;
    if (s === 'INCIDENT' || !state[e.elementId] || rank[s] > rank[state[e.elementId]]) state[e.elementId] = s;
  }
  const count = {};
  for (const e of items) if (e.state === 'COMPLETED' && e.type !== 'MULTI_INSTANCE_BODY') count[e.elementId] = (count[e.elementId] || 0) + 1;

  const xml = fs.readFileSync(bpmnFile, 'utf8');
  const js = fs.readFileSync(require.resolve('bpmn-js/dist/bpmn-viewer.production.min.js'), 'utf8');
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const page = await browser.newPage();
  const [bx, by, bw, bh] = box.map(Number);
  const vw = bw ? Math.round(bw * 1.25) : 2400, vh = bh ? Math.round(bh * 1.25) : 700;
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: vw > 3000 ? 1 : 2 });
  const css = `
    body{margin:0;background:#fff;font-family:Arial}
    #c{width:${vw}px;height:${vh}px}
    .done .djs-visual > :first-child{fill:#e3f4e6!important;stroke:#1f7a3a!important;stroke-width:2.5px!important}
    .active .djs-visual > :first-child{fill:#dbe7f7!important;stroke:#2b4266!important;stroke-width:3px!important}
    .incident .djs-visual > :first-child{fill:#fde2e2!important;stroke:#b91c1c!important;stroke-width:3px!important}
    .cancelled .djs-visual > :first-child{fill:#eeeeee!important;stroke:#777!important;stroke-dasharray:5 3}
    .done-sp .djs-visual > :first-child{fill:none!important;stroke:#1f7a3a!important;stroke-width:2.5px!important}
    .active-sp .djs-visual > :first-child{fill:none!important;stroke:#2b4266!important;stroke-width:3px!important}
    .cancelled-sp .djs-visual > :first-child{fill:none!important;stroke:#777!important;stroke-dasharray:6 4}
    .incident-sp .djs-visual > :first-child{fill:none!important;stroke:#b91c1c!important}
    .badge{background:#1f7a3a;color:#fff;border-radius:9px;padding:1px 6px;font:bold 11px Arial}
    .badge.active{background:#2b4266}.badge.incident{background:#b91c1c}`;
  await page.setContent(`<html><head><style>${css}</style></head><body><div id="c"></div><script>${js}</script></body></html>`);
  await page.evaluate(async (x, state, count, b) => {
    const v = new BpmnJS({ container: '#c' });
    await v.importXML(x);
    const canvas = v.get('canvas'), overlays = v.get('overlays'), reg = v.get('elementRegistry');
    const cls = { COMPLETED: 'done', ACTIVE: 'active', INCIDENT: 'incident', TERMINATED: 'cancelled' };
    for (const [id, s] of Object.entries(state)) {
      if (!reg.get(id)) continue;
      const el = reg.get(id);
      canvas.addMarker(id, el.type === 'bpmn:SubProcess' ? cls[s] + '-sp' : cls[s]);
      if (el.type === 'bpmn:SequenceFlow' || el.type === 'bpmn:SubProcess') continue;
      const label = s === 'INCIDENT' ? 'incident' : s === 'ACTIVE' ? 'waiting' : count[id] > 1 ? 'x' + count[id] : null;
      if (label) overlays.add(id, { position: { top: -10, right: 12 }, html: `<span class="badge ${s === 'INCIDENT' ? 'incident' : s === 'ACTIVE' ? 'active' : ''}">${label}</span>` });
    }
    if (b[2]) canvas.viewbox({ x: b[0], y: b[1], width: b[2], height: b[3] }); else canvas.zoom('fit-viewport');
  }, xml, state, count, [bx, by, bw, bh]);
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: out });
  await browser.close();
  console.log('wrote', out, Object.keys(state).length, 'elements coloured');
})().catch(e => { console.error(e); process.exit(1); });
