// Lints the BPMN models with bpmnlint (recommended rules + Camunda 8.8 compatibility rules).
const fs = require('fs');
const path = require('path');
const { Linter } = require('bpmnlint');
const NodeResolver = require('bpmnlint/lib/resolver/node-resolver');
const _bm = require('bpmn-moddle'); const BpmnModdle = _bm.default || _bm.BpmnModdle || _bm;
const zeebe = require('zeebe-bpmn-moddle/resources/zeebe.json');
(async () => {
  const linter = new Linter({ config: { extends: ['bpmnlint:recommended', 'plugin:camunda-compat/camunda-cloud-8-8'] }, resolver: new NodeResolver() });
  let total = 0;
  for (const f of ['main-home-healthcare.bpmn', 'pharmacy-prescription-fulfillment.bpmn']) {
    const { rootElement } = await new BpmnModdle({ zeebe }).fromXML(fs.readFileSync(path.join(__dirname, '..', 'bpmn-models', f), 'utf8'));
    const res = await linter.lint(rootElement);
    const issues = Object.entries(res).flatMap(([rule, rs]) => rs.map(r => ({ rule, ...r })));
    console.log(`${f}: ${issues.filter(i => i.category === 'error').length} errors, ${issues.filter(i => i.category === 'warn').length} warnings`);
    issues.forEach(i => console.log(`   [${i.category}] ${i.rule}: ${i.id} ${i.message}`));
    total += issues.filter(i => i.category === 'error').length;
  }
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
