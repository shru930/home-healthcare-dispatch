// Deploys the BPMN models and forms to Camunda 8 (Orchestration Cluster REST API /v2/deployments).
// The called child process is deployed first, then the main process together with its forms.
// Usage: node tools/deploy.js [camundaRestUrl]
const fs = require('fs');
const path = require('path');
const API = (process.argv[2] || process.env.CAMUNDA_REST_ADDRESS || 'http://localhost:8080') + '/v2';
const DIR = path.join(__dirname, '..', 'bpmn-models');

async function deploy(files) {
  const form = new FormData();
  for (const f of files) form.append('resources', new Blob([fs.readFileSync(f)]), path.basename(f));
  const r = await fetch(`${API}/deployments`, { method: 'POST', body: form });
  const body = await r.json();
  if (!r.ok) throw new Error(`deployment failed (${r.status}): ${JSON.stringify(body)}`);
  return body;
}

(async () => {
  const child = await deploy([path.join(DIR, 'pharmacy-prescription-fulfillment.bpmn')]);
  const forms = fs.readdirSync(path.join(DIR, 'forms')).map(f => path.join(DIR, 'forms', f));
  const main = await deploy([path.join(DIR, 'main-home-healthcare.bpmn'), ...forms]);
  for (const dep of [child, main]) {
    console.log(`deploymentKey ${dep.deploymentKey}`);
    for (const d of dep.deployments) {
      const [kind, v] = Object.entries(d)[0];
      console.log(`  ${kind.padEnd(18)} ${(v.processDefinitionId || v.formId).padEnd(36)} version ${v.processDefinitionVersion || v.version}  key ${v.processDefinitionKey || v.formKey}`);
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
