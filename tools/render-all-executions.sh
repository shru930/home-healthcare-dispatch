#!/usr/bin/env bash
# Renders the execution-path diagrams used in the README / report from real Camunda instance data.
cd "$(dirname "$0")/.."
R=documentation/evidence/scenario-results.json
k() { python -c "import json;print([r['processInstanceKey'] for r in json.load(open('$R'))['results'] if r['id']=='$1'][0])"; }
live() { curl -s localhost:8090/api/workflows | python -c "import sys,json;print([w['processInstanceKey'] for w in json.load(sys.stdin) if w['patientName']=='$1' and w['status']=='ACTIVE'][0])"; }
child() { curl -s -X POST localhost:8080/v2/process-instances/search -H 'Content-Type: application/json' -d "{\"filter\":{\"parentProcessInstanceKey\":\"$1\"}}" | python -c "import sys,json;print(' '.join(i['processInstanceKey'] for i in json.load(sys.stdin)['items']))"; }
M=bpmn-models/main-home-healthcare.bpmn; C=bpmn-models/pharmacy-prescription-fulfillment.bpmn; O=documentation/diagrams
DISPATCH="60 240 1660 560"; VISIT="1700 460 2080 900"; RISK="2520 570 1280 740"; PHYSIO="1700 40 760 320"; CHILD="40 10 1720 520"
node tools/render-execution.js $(k TC01) $M $O/exec-tc01-happy-path-full.png 40 30 4990 1330
node tools/render-execution.js $(k TC01) $M $O/exec-tc01-dispatch.png $DISPATCH
node tools/render-execution.js $(k TC01) $M $O/exec-tc01-daily-visits.png $VISIT
node tools/render-execution.js $(k TC01) $M $O/exec-tc01-physio.png $PHYSIO
node tools/render-execution.js $(k TC02) $M $O/exec-tc02-elevated-doctor-reminder.png $RISK
node tools/render-execution.js $(k TC03) $M $O/exec-tc03-critical-infection.png $RISK
node tools/render-execution.js $(k TC04) $M $O/exec-tc04-error-boundary.png $RISK
node tools/render-execution.js $(k TC05) $M $O/exec-tc05-missed-visits.png $VISIT
node tools/render-execution.js $(k TC05) $M $O/exec-tc05-missed-physio.png $PHYSIO
node tools/render-execution.js $(k TC06) $M $O/exec-tc06-over-query-limit.png $DISPATCH
node tools/render-execution.js $(k TC15) $M $O/exec-tc15-http-500.png $DISPATCH
node tools/render-execution.js $(k TC07) $M $O/exec-tc07-no-suitable-nurse.png $DISPATCH
node tools/render-execution.js $(k TC08) $M $O/exec-tc08-nurse-retry.png $DISPATCH
node tools/render-execution.js $(k TC09) $M $O/exec-tc09-notification-failure.png $DISPATCH
node tools/render-execution.js $(k TC13) $M $O/exec-tc13-readmit.png $RISK
node tools/render-execution.js $(k TC14) $M $O/exec-tc14-intervention-timeout.png $RISK
i=0; for c in $(child $(k TC10)); do i=$((i+1)); node tools/render-execution.js $c $C $O/exec-tc10-child-$i.png $CHILD; done
for c in $(child $(k TC11)); do node tools/render-execution.js $c $C $O/exec-tc11-courier-unavailable.png $CHILD; done
for c in $(child $(k TC01) | cut -d' ' -f1); do node tools/render-execution.js $c $C $O/exec-tc01-child-delivered.png $CHILD; done
node tools/render-execution.js $(live 'Ramesh Babu') $M $O/exec-live-incident.png $RISK
node tools/render-execution.js $(live 'Meena Subramanian') $M $O/exec-live-doctor-review-waiting.png $RISK
