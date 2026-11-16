// Pads the last line of every external label (spaces + zero-width space) so the diagram viewer and Camunda Modeler
// never split words. usage: node pad.js in.bpmn out.bpmn fontPx
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const [, , inF, outF, fontPx] = process.argv;
const ZW = '\u200B';
const dec = s => s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const enc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
(async () => {
  let xml = fs.readFileSync(inF, 'utf8');
  const labelled = new Set();
  for (const m of xml.matchAll(/<bpmndi:BPMN(?:Shape|Edge)[^>]*bpmnElement="([^"]+)"[^>]*>(?:(?!<\/bpmndi:BPMN(?:Shape|Edge)>)[\s\S])*?<bpmndi:BPMNLabel>/g)) labelled.add(m[1]);
  const names = {};
  for (const m of xml.matchAll(/<bpmn:(\w+) id="([^"]+)"[^>]*? name="([^"]*)"/g)) {
    if (labelled.has(m[2]) && m[3]) names[m[2]] = dec(m[3]).replace(/\u200B/g, '').split('\n').map(l => l.trim()).join('\n');
  }
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  const out = await p.evaluate((names, ZW, px) => {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `normal ${px}px Arial, sans-serif`;
    const w = s => ctx.measureText(s.replace(/\s+$/, '')).width;
    const res = {};
    for (const [id, name] of Object.entries(names)) {
      const lines = name.split('\n'); const last = lines.pop();
      const others = Math.max(0, ...lines.map(w));
      let k = 1; while (w(last + ' '.repeat(k) + ZW) < others + 2) k++;
      res[id] = [...lines, last + ' '.repeat(k) + ZW].join('\n');
    }
    return res;
  }, names, ZW, +fontPx);
  await b.close();
  for (const [id, nm] of Object.entries(out)) xml = xml.replace(new RegExp(`(<bpmn:\\w+ id="${id}"[^>]*? name=")([^"]*)(")`), (_, a, __, c) => a + enc(nm) + c);
  fs.writeFileSync(outF, xml);
  console.log('padded', Object.keys(out).length, 'labels ->', outF);
})().catch(e => { console.error(e); process.exit(1); });
