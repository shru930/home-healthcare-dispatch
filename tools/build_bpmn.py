"""Generates the executable Camunda 8.8 BPMN models and Camunda Forms in bpmn-models/.

    python tools/build_bpmn.py

Main process : home-healthcare-dispatch           -> bpmn-models/main-home-healthcare.bpmn
Child process: pharmacy-prescription-fulfillment  -> bpmn-models/pharmacy-prescription-fulfillment.bpmn
Forms        : bpmn-models/forms/*.form

Everything (IDs, job types, FEEL, mappings, layout) is defined here so the models stay consistent with
the Java workers and the React client. The output opens and edits normally in Camunda Modeler.
"""
import json
import pathlib
from html import escape

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'bpmn-models'
REST_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iOCIgZmlsbD0iIzUwNTU2MiIvPjwvc3ZnPg=='
SIZE = {'startEvent': (36, 36), 'endEvent': (36, 36), 'boundaryEvent': (36, 36), 'intermediateCatchEvent': (36, 36),
        'exclusiveGateway': (50, 50), 'parallelGateway': (50, 50),
        'serviceTask': (120, 80), 'userTask': (120, 80), 'receiveTask': (120, 80), 'callActivity': (120, 80)}


def a(v):
    return escape(str(v), quote=True)


def io(inputs=(), outputs=()):
    """inputs/outputs: (source, target) pairs; a bare name means '=name' -> name."""
    norm = lambda x: ('=' + x, x) if isinstance(x, str) else x
    rows = [f'<zeebe:input source="{a(s)}" target="{a(t)}" />' for s, t in map(norm, inputs)]
    rows += [f'<zeebe:output source="{a(s)}" target="{a(t)}" />' for s, t in map(norm, outputs)]
    return '<zeebe:ioMapping>' + ''.join(rows) + '</zeebe:ioMapping>' if rows else ''


def worker(job_type, inputs=(), outputs=(), retries=3):
    return f'<zeebe:taskDefinition type="{job_type}" retries="{retries}" />' + io(inputs, outputs)


def headers(**h):
    return '<zeebe:taskHeaders>' + ''.join(f'<zeebe:header key="{k}" value="{a(v)}" />' for k, v in h.items()) + '</zeebe:taskHeaders>'


def rest(method, url, auth=('noAuth',), query=None, body=None, result=None, error=None, retries=3):
    ins = [('noAuth' if auth[0] == 'noAuth' else 'bearer', 'authentication.type')]
    if auth[0] == 'bearer':
        ins.append((auth[1], 'authentication.token'))
    ins += [(method, 'method'), (url, 'url'), ('={"Content-Type": "application/json"}', 'headers')]
    if query:
        ins.append((query, 'queryParameters'))
    if body:
        ins.append((body, 'body'))
    ins += [('20', 'connectionTimeoutInSeconds'), ('20', 'readTimeoutInSeconds')]
    h = {'resultExpression': result}
    if error:
        h['errorExpression'] = error
    h['retryBackoff'] = 'PT5S'
    return f'<zeebe:taskDefinition type="io.camunda:http-json:1" retries="{retries}" />' + io(ins) + headers(**h)


REST_ATTRS = f' zeebe:modelerTemplate="io.camunda.connectors.HttpJson.v2" zeebe:modelerTemplateVersion="12" zeebe:modelerTemplateIcon="{REST_ICON}"'


def email(subject, body, result, error):
    ins = [('simple', 'authentication.type'), ('{{secrets.SMTP_USERNAME}}', 'authentication.username'),
           ('{{secrets.SMTP_PASSWORD}}', 'authentication.password'), ('smtp', 'protocol'),
           ('{{secrets.SMTP_HOST}}', 'data.smtpConfig.smtpHost'), ('{{secrets.SMTP_PORT}}', 'data.smtpConfig.smtpPort'),
           ('NONE', 'data.smtpConfig.smtpCryptographicProtocol'), ('sendEmailSmtp', 'data.smtpActionDiscriminator'),
           ('care-team@homecare.example', 'data.smtpAction.from'), ('=familyEmail', 'data.smtpAction.to'),
           (subject, 'data.smtpAction.subject'), ('PLAIN', 'data.smtpAction.contentType'), (body, 'data.smtpAction.body')]
    return ('<zeebe:taskDefinition type="io.camunda:email:1" retries="3" />' + io(ins)
            + headers(resultExpression=result, errorExpression=error, retryBackoff='PT5S'))


def user_task(form_id, assignee=None, groups=None, inputs=(), outputs=()):
    asg = ''
    if assignee or groups:
        asg = '<zeebe:assignmentDefinition' + (f' assignee="{a(assignee)}"' if assignee else '') + \
              (f' candidateGroups="{a(groups)}"' if groups else '') + ' />'
    return f'<zeebe:userTask /><zeebe:formDefinition formId="{form_id}" />' + asg + io(inputs, outputs)


def timer(expr, kind='timeDuration'):
    return f'<bpmn:timerEventDefinition><bpmn:{kind} xsi:type="bpmn:tFormalExpression">{a(expr)}</bpmn:{kind}></bpmn:timerEventDefinition>'


class Model:
    def __init__(self, pid, name, doc):
        self.pid, self.name, self.doc = pid, name, doc
        self.nodes, self.flows, self.errors, self.messages = {}, [], {}, {}

    def node(self, nid, kind, name, cx, cy, parent=None, ext='', attrs='', body='', mi=None, w=None, h=None, label=None):
        if kind == 'subProcess':
            sw, sh = w, h
        else:
            sw, sh = SIZE[kind]
        self.nodes[nid] = dict(id=nid, kind=kind, name=name, cx=cx, cy=cy, w=sw, h=sh, parent=parent, ext=ext, attrs=attrs,
                               body=body, mi=mi, inc=[], out=[], label=label)
        return nid

    def sub(self, nid, name, x0, y0, w, h, parent=None, ext='', mi=None):
        return self.node(nid, 'subProcess', name, x0 + w / 2, y0 + h / 2, parent, ext=ext, mi=mi, w=w, h=h)

    def boundary(self, nid, host, name, body, x=None, side='B', interrupting=True, ext='', label=None):
        hn = self.nodes[host]
        bx = x if x is not None else hn['cx']
        by = hn['cy'] + hn['h'] / 2 if side == 'B' else hn['cy'] - hn['h'] / 2
        self.node(nid, 'boundaryEvent', name, bx, by, hn['parent'], ext=ext, label=label,
                  attrs=f' cancelActivity="{"true" if interrupting else "false"}" attachedToRef="{host}"', body=body)

    def error(self, code, name):
        self.errors[code] = name
        return f'<bpmn:errorEventDefinition errorRef="Error_{code}" />'

    def flow(self, src, tgt, name='', cond=None, pts=None, lbl=None):
        fid = f'Flow_{src}_{tgt}'
        self.flows.append(dict(id=fid, src=src, tgt=tgt, name=name, cond=cond, pts=pts, lbl=lbl))
        self.nodes[src]['out'].append(fid)
        self.nodes[tgt]['inc'].append(fid)

    def shift(self, x0, dx, exclude=()):
        """Moves everything right of x0 by dx (used to make room for new elements)."""
        for n in self.nodes.values():
            if n['id'] in exclude:
                continue
            if n['cx'] >= x0:
                n['cx'] += dx
                if n['label'] and n['label'][0] >= x0:
                    n['label'] = (n['label'][0] + dx, n['label'][1])
        for f in self.flows:
            if f['src'] in exclude:
                continue
            if f['pts']:
                f['pts'] = [(x + dx if x >= x0 else x, y) for x, y in f['pts']]
            if f['lbl'] and f['lbl'][0] >= x0:
                f['lbl'] = (f['lbl'][0] + dx,) + tuple(f['lbl'][1:])

    # ------------------------------------------------------------------ geometry
    def side(self, n, s):
        x, y, w, h = n['cx'], n['cy'], n['w'], n['h']
        return {'L': (x - w / 2, y), 'R': (x + w / 2, y), 'T': (x, y - h / 2), 'B': (x, y + h / 2)}[s]

    def route(self, f):
        s, t = self.nodes[f['src']], self.nodes[f['tgt']]
        if f['pts']:
            return f['pts']
        if abs(s['cy'] - t['cy']) < 1:
            return [self.side(s, 'R'), self.side(t, 'L')]
        if abs(s['cx'] - t['cx']) < 1:
            up = t['cy'] < s['cy']
            return [self.side(s, 'T' if up else 'B'), self.side(t, 'B' if up else 'T')]
        if s['kind'] in ('exclusiveGateway', 'parallelGateway', 'boundaryEvent'):
            p0 = self.side(s, 'T' if t['cy'] < s['cy'] else 'B') if s['kind'] != 'boundaryEvent' else self.side(s, 'B')
            return [p0, (s['cx'], t['cy']), self.side(t, 'L' if t['cx'] > s['cx'] else 'R')]
        p0 = self.side(s, 'R')
        return [p0, (t['cx'], s['cy']), self.side(t, 'T' if t['cy'] > s['cy'] else 'B')]

    # ------------------------------------------------------------------ xml
    def element_xml(self, n):
        k = n['kind']
        out = [f'<bpmn:{k} id="{n["id"]}" name="{a(n["name"])}"{n["attrs"]}>']
        if n['ext']:
            out.append(f'<bpmn:extensionElements>{n["ext"]}</bpmn:extensionElements>')
        out += [f'<bpmn:incoming>{i}</bpmn:incoming>' for i in n['inc']]
        out += [f'<bpmn:outgoing>{o}</bpmn:outgoing>' for o in n['out']]
        if n['mi']:
            seq, coll, elem, ocoll, oelem = n['mi']
            out.append(f'<bpmn:multiInstanceLoopCharacteristics isSequential="{"true" if seq else "false"}"><bpmn:extensionElements>'
                       f'<zeebe:loopCharacteristics inputCollection="{a(coll)}" inputElement="{elem}" outputCollection="{ocoll}" '
                       f'outputElement="{a(oelem)}" /></bpmn:extensionElements></bpmn:multiInstanceLoopCharacteristics>')
        if n['body']:
            out.append(n['body'])
        if k == 'subProcess':
            out.append(self.scope_xml(n['id']))
        out.append(f'</bpmn:{k}>')
        return ''.join(out)

    def scope_xml(self, parent):
        P = [self.element_xml(n) for n in self.nodes.values() if n['parent'] == parent]
        for f in self.flows:
            if self.nodes[f['src']]['parent'] != parent:
                continue
            cond = f'<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">{a(f["cond"])}</bpmn:conditionExpression>' if f['cond'] else ''
            P.append(f'<bpmn:sequenceFlow id="{f["id"]}" name="{a(f["name"])}" sourceRef="{f["src"]}" targetRef="{f["tgt"]}">{cond}</bpmn:sequenceFlow>')
        return '\n'.join(P)

    def di_xml(self):
        D = []
        for n in self.nodes.values():
            x, y = n['cx'] - n['w'] / 2, n['cy'] - n['h'] / 2
            extra = ' isExpanded="true"' if n['kind'] == 'subProcess' else ''
            extra += ' isMarkerVisible="true"' if n['kind'] == 'exclusiveGateway' else ''
            label = ''
            if n['kind'] in ('startEvent', 'endEvent', 'boundaryEvent', 'intermediateCatchEvent', 'exclusiveGateway', 'parallelGateway') and n['name']:
                lw = 110
                lx, ly = n['label'] if n['label'] else (n['cx'] - lw / 2, n['cy'] + n['h'] / 2 + 4)
                label = f'<bpmndi:BPMNLabel><dc:Bounds x="{lx:.0f}" y="{ly:.0f}" width="{lw}" height="27" /></bpmndi:BPMNLabel>'
            D.append(f'<bpmndi:BPMNShape id="{n["id"]}_di" bpmnElement="{n["id"]}"{extra}><dc:Bounds x="{x:.0f}" y="{y:.0f}" '
                     f'width="{n["w"]:.0f}" height="{n["h"]:.0f}" />{label}</bpmndi:BPMNShape>')
        for f in self.flows:
            pts = self.route(f)
            wps = ''.join(f'<di:waypoint x="{px:.0f}" y="{py:.0f}" />' for px, py in pts)
            label = ''
            if f['name']:
                (x1, y1), (x2, y2) = pts[0], pts[1]
                lw = f['lbl'][2] if f['lbl'] and len(f['lbl']) == 3 else 90
                lx, ly = f['lbl'][:2] if f['lbl'] else ((x1 + x2) / 2 - 40 if y1 == y2 else x1 + 6, (y1 + y2) / 2 - 18 if y1 == y2 else (y1 + y2) / 2 - 7)
                label = f'<bpmndi:BPMNLabel><dc:Bounds x="{lx:.0f}" y="{ly:.0f}" width="{lw}" height="14" /></bpmndi:BPMNLabel>'
            D.append(f'<bpmndi:BPMNEdge id="{f["id"]}_di" bpmnElement="{f["id"]}">{wps}{label}</bpmndi:BPMNEdge>')
        return '\n'.join(D)

    def xml(self):
        errs = ''.join(f'<bpmn:error id="Error_{c}" name="{a(n)}" errorCode="{c}" />' for c, n in self.errors.items())
        msgs = ''.join(f'<bpmn:message id="Message_{n}" name="{n}"><bpmn:extensionElements><zeebe:subscription correlationKey="{a(k)}" />'
                       f'</bpmn:extensionElements></bpmn:message>' for n, k in self.messages.items())
        return ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" '
                'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" '
                'xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="Definitions_' + self.pid.replace('-', '_') + '" '
                'targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="5.50.1" '
                'modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.8.0">\n'
                f'<bpmn:process id="{self.pid}" name="{a(self.name)}" isExecutable="true">'
                f'<bpmn:documentation>{a(self.doc)}</bpmn:documentation>\n'
                + self.scope_xml(None) + '\n</bpmn:process>\n' + errs + msgs + '\n'
                f'<bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{self.pid}">\n'
                + self.di_xml() + '\n</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>\n</bpmn:definitions>\n')


NULLS = lambda *names: [('=null', n) for n in names]

# ====================================================================================== MAIN PROCESS
M = Model('home-healthcare-dispatch', 'Home Healthcare Nurse & Pharmacy Dispatch',
          'Seven-day post-operative home-care plan: discharge validation, nearest-nurse dispatch (Distance Matrix REST connector), '
          'daily visits (sequential multi-instance), physiotherapy (parallel multi-instance), pharmacy fulfilment (parallel multi-instance '
          'call activity), Readmission Risk Intervention sub-process, e-mail/SMS family notifications. Risk flags are workflow support only.')
Y = 400
M.node('Start_Discharged', 'startEvent', 'Patient discharged', 100, Y)
M.node('Task_ValidateDischarge', 'serviceTask', 'Validate discharge details', 220, Y,
       ext=worker('hh.validate-discharge', inputs=['workflowId', 'patientId', 'patientPhone', 'familyPhone', 'familyEmail',
                                                   'dischargeDate', 'patientLat', 'patientLng', 'prescriptions']))
M.node('Gw_DischargeValid', 'exclusiveGateway', 'Details valid?', 360, Y, label=(305, 352))
M.node('Task_CorrectDischarge', 'userTask', 'Correct discharge details', 360, 530,
       ext=user_task('correct-discharge-form', groups='coordinators',
                     inputs=['patientName', 'validationErrors', 'patientPhone', 'familyPhone', 'familyEmail', 'dischargeDate'],
                     outputs=['patientPhone', 'familyPhone', 'familyEmail', 'dischargeDate']))
M.node('Task_ApprovePlan', 'userTask', 'Approve home-care plan', 500, Y,
       ext=user_task('approve-plan-form', groups='admins',
                     inputs=['patientName', 'patientMrn', 'patientAddress', 'surgeryType', 'dischargeDate', 'hospital', 'doctorName',
                             'familyContactName', 'familyPhone', 'prescriptions', 'physioSessions', 'requestedBy'],
                     outputs=['approvalDecision', ('=approvalNotes', 'approvalNotes'), ('=approvedBy', 'approvedBy')]))
M.node('Gw_Approved', 'exclusiveGateway', 'Approved?', 640, Y, label=(585, 352))
M.node('Task_RejectPlan', 'serviceTask', 'Record rejection and inform requester', 640, 540,
       ext=worker('hh.reject-plan', inputs=['workflowId', 'patientId', 'patientName', 'requestedBy', ('=approvalNotes', 'approvalNotes')]))
M.node('End_PlanRejected', 'endEvent', 'Plan rejected', 780, 540)
M.node('Task_GenerateCarePlan', 'serviceTask', 'Generate 7-day care plan', 480, Y,
       ext=worker('hh.generate-care-plan', inputs=['workflowId', 'dischargeDate', 'requiredSkill', 'physioSessions'],
                  outputs=['carePlanId', 'carePlanDays', 'physioSessions', 'careStartDate', 'careEndDate']))
M.node('Task_FetchNurses', 'serviceTask', 'Retrieve available nurses', 640, Y,
       ext=worker('hh.fetch-available-nurses', inputs=['workflowId', 'requiredSkill', ('=nurseSearchAttempts', 'nurseSearchAttempts')],
                  outputs=['candidateNurses', 'nurseCount', 'nurseSearchAttempts', 'nurseDestinations']))
M.node('Gw_NursesFound', 'exclusiveGateway', 'Nurses found?', 780, Y, label=(788, 446))
M.node('Task_DistanceMatrix', 'serviceTask', 'Get travel times (Google Distance Matrix)', 920, Y, attrs=REST_ATTRS,
       ext=rest('GET', '{{secrets.DISTANCE_MATRIX_URL}}',
                query='={origins: patientLocation, destinations: nurseDestinations, key: "{{secrets.GOOGLE_MAPS_API_KEY}}", mode: "driving"}',
                result='={distanceMatrix: response.body, distanceSource: "DISTANCE_MATRIX_API"}',
                error='=if is defined(error) then bpmnError("DISTANCE_API_ERROR", "Distance Matrix call failed: " + error.message) '
                      'else null'))
M.boundary('Err_DistanceApi', 'Task_DistanceMatrix', 'Distance API error', M.error('DISTANCE_API_ERROR', 'Distance API error'), label=(926, 466))
M.node('Task_FallbackDistance', 'serviceTask', 'Rank nurses by straight-line distance', 920, 540,
       ext=worker('hh.rank-nurses-fallback', inputs=['candidateNurses', 'patientLat', 'patientLng']))
M.node('Task_MatchNurse', 'serviceTask', 'Select nearest suitable nurse', 1080, Y,
       ext=worker('hh.match-nurse', inputs=['workflowId', 'candidateNurses', ('=distanceMatrix', 'distanceMatrix'),
                                            ('=nurseDistances', 'nurseDistances'), 'distanceSource', 'maxTravelMinutes'],
                  outputs=['nurseDistances', 'selectedNurseId', 'selectedDistanceMeters', 'selectedTravelSeconds', 'assignmentMode']))
M.boundary('Err_DistanceInvalid', 'Task_MatchNurse', 'Unusable response', '<bpmn:errorEventDefinition errorRef="Error_DISTANCE_API_ERROR" />',
           x=1080, label=(990, 586))
M.boundary('Err_NoNurse', 'Task_MatchNurse', 'No suitable nurse', M.error('NO_SUITABLE_NURSE', 'No suitable nurse'), x=1120, label=(1126, 600))
M.node('Task_ManualNurse', 'userTask', 'Arrange nurse manually', 1240, 670,
       ext=user_task('manual-nurse-form', groups='coordinators', inputs=['patientName', 'patientAddress', 'requiredSkill',
                                                                         ('=nurseDistances', 'nurseDistances')],
                     outputs=['selectedNurseId', 'manualAssignmentNote', ('="MANUAL"', 'assignmentMode')]))
M.node('Task_AssignNurse', 'serviceTask', 'Assign nurse', 1240, Y,
       ext=worker('hh.assign-nurse', inputs=['workflowId', 'carePlanId', 'selectedNurseId', ('=selectedDistanceMeters', 'selectedDistanceMeters'),
                                             ('=selectedTravelSeconds', 'selectedTravelSeconds'), ('=distanceSource', 'distanceSource'),
                                             'assignmentMode', ('=manualAssignmentNote', 'manualAssignmentNote')]))
ASSIGN_BODY = ('="Dear " + familyContactName + ",\\n\\n" + patientName + " is enrolled in a seven-day home-care plan from " + careStartDate + '
               '" to " + careEndDate + ".\\n\\nAssigned nurse: " + assignmentSummary + ". The nurse will visit every day for the seven days. "'
               ' + string(count(physioSessions)) + " physiotherapy sessions and " + string(count(prescriptions)) + '
               '" medication deliveries are also scheduled.\\n\\nThis is an automated message from the City Home Care team."')
M.node('Task_EmailAssignment', 'serviceTask', 'E-mail family: nurse assigned', 1400, Y,
       ext=email('="Home-care nurse assigned for " + patientName', ASSIGN_BODY, '={familyNotified: true}',
                 '=if is defined(error) then bpmnError("NOTIFICATION_FAILED", "E-mail failed: " + error.message) else null'))
M.boundary('Err_EmailAssign', 'Task_EmailAssignment', 'E-mail failed', M.error('NOTIFICATION_FAILED', 'Notification failed'), label=(1406, 462))
M.node('Task_RecordNotifyFailure', 'serviceTask', 'Record failed notification', 1400, 540,
       ext=worker('hh.record-notification-failure', inputs=['patientId', 'familyEmail', 'familyPhone',
                                                             ('="NURSE_ASSIGNMENT"', 'notificationCategory'),
                                                             ('="Nurse-assignment e-mail could not be delivered"', 'notificationError')]))
M.node('Gw_NotifyJoin', 'exclusiveGateway', '', 1540, Y)
M.node('Gw_Fork', 'parallelGateway', 'Start care tracks', 1640, Y, label=(1585, 430))

# ---- Track 1: physiotherapy, parallel multi-instance sub-process
M.sub('Sub_Physio', 'Physiotherapy session (parallel, one per session)', 1720, 60, 720, 280,
      ext=io(NULLS('appointmentId', 'physiotherapist', 'physioStatus', 'physioNotes')),
      mi=(False, '=physioSessions', 'session', 'physioResults',
          '={sessionNo: session.sessionNo, dayNumber: session.dayNumber, appointmentId: appointmentId, status: physioStatus}'))
M.node('Start_Physio', 'startEvent', 'Session due', 1760, 160, parent='Sub_Physio')
M.node('Task_BookPhysio', 'serviceTask', 'Book physiotherapy appointment', 1880, 160, parent='Sub_Physio',
       ext=worker('hh.schedule-physio', inputs=['carePlanId', 'session']))
M.node('Task_PhysioSession', 'userTask', 'Record physiotherapy session', 2040, 160, parent='Sub_Physio',
       ext=user_task('physio-session-form', assignee='=physiotherapist', groups='physiotherapists',
                     inputs=['patientName', 'patientAddress', 'session', 'appointmentId'], outputs=['physioStatus', 'physioNotes']))
M.boundary('Timer_PhysioWindow', 'Task_PhysioSession', 'Window passed', timer('=physioWindow'), label=(2046, 214))
M.node('Task_MissedPhysio', 'serviceTask', 'Record missed appointment', 2040, 280, parent='Sub_Physio',
       ext=worker('hh.record-missed-physio', inputs=['patientId', 'appointmentId', 'session']))
M.node('End_PhysioMissed', 'endEvent', 'Session missed', 2180, 280, parent='Sub_Physio')
M.node('Task_CompletePhysio', 'serviceTask', 'Save session outcome', 2200, 160, parent='Sub_Physio',
       ext=worker('hh.complete-physio', inputs=['appointmentId', 'physioStatus', ('=physioNotes', 'physioNotes')]))
M.node('End_Physio', 'endEvent', 'Session recorded', 2340, 160, parent='Sub_Physio')

# ---- Track 2: pharmacy, parallel multi-instance call activity
M.node('Call_Pharmacy', 'callActivity', 'Pharmacy fulfilment', 1840, Y,
       ext='<zeebe:calledElement processId="pharmacy-prescription-fulfillment" propagateAllChildVariables="false" propagateAllParentVariables="false" />'
           + io(inputs=['workflowId', 'patientId', 'patientName', 'familyPhone', 'patientAddress', 'prescription', 'deliveryReminder',
                        'deliveryTimeout'] + NULLS('fulfillmentStatus', 'deliveryRef', 'fulfillmentNote'),
                outputs=[('=fulfillmentStatus', 'fulfillmentStatus'), ('=deliveryRef', 'deliveryRef'), ('=fulfillmentNote', 'fulfillmentNote')]),
       mi=(False, '=prescriptions', 'prescription', 'pharmacyResults',
           '={prescriptionId: prescription.prescriptionId, medication: prescription.medication, status: fulfillmentStatus, '
           'deliveryRef: deliveryRef, note: fulfillmentNote}'))

# ---- Track 3: daily visits, sequential multi-instance sub-process with the Readmission Risk Intervention sub-process inside
M.sub('Sub_DailyVisit', 'Daily home-care visit (sequential, day 1 to 7)', 1720, 480, 2040, 860,
      ext=io(NULLS('visitId', 'visitStatus', 'painScore', 'temperature', 'woundRedness', 'woundDischarge', 'swelling', 'nurseNotes',
                   'riskLevel', 'riskReasons', 'assessmentId', 'interventionId', 'interventionStatus', 'doctorDecision', 'doctorNotes',
                   'doctorReminded', 'emergencyOutcome', 'emergencyNotes')),
      mi=(True, '=carePlanDays', 'careDay', 'visitResults',
          '={day: careDay.day, date: careDay.date, visitId: visitId, visitStatus: visitStatus, riskLevel: riskLevel, '
          'interventionStatus: interventionStatus}'))
P = 'Sub_DailyVisit'
VY = 640
M.node('Start_Visit', 'startEvent', 'Visit day', 1760, VY, parent=P)
M.node('Task_ScheduleVisit', 'serviceTask', 'Schedule daily visit', 1880, VY, parent=P,
       ext=worker('hh.schedule-visit', inputs=['workflowId', 'carePlanId', 'careDay', 'assignedNurse']))
M.node('Task_HealthAssessment', 'userTask', 'Home visit and health assessment', 2040, VY, parent=P,
       ext=user_task('health-assessment-form', assignee='=assignedNurse.username', groups='nurses',
                     inputs=['patientName', 'patientAddress', 'careDay', 'visitId', 'surgeryType'],
                     outputs=['visitStatus', ('=painScore', 'painScore'), ('=temperature', 'temperature'), ('=woundRedness', 'woundRedness'),
                              ('=woundDischarge', 'woundDischarge'), ('=swelling', 'swelling'), ('=nurseNotes', 'nurseNotes')]))
M.boundary('Timer_VisitWindow', 'Task_HealthAssessment', 'Visit window passed', timer('=visitWindow'), label=(2046, 706))
M.node('Task_MissedVisit', 'serviceTask', 'Record missed visit', 2040, 940, parent=P,
       ext=worker('hh.record-missed-visit', inputs=['patientId', 'visitId', 'careDay']))
M.node('End_VisitMissed', 'endEvent', 'Visit missed', 2180, 940, parent=P)
M.node('Gw_VisitDone', 'exclusiveGateway', 'Visit completed?', 2180, VY, parent=P, label=(2125, 600))
M.node('Task_IncompleteVisit', 'serviceTask', 'Record incomplete visit', 2180, 800, parent=P,
       ext=worker('hh.record-incomplete-visit', inputs=['patientId', 'visitId', 'careDay', 'nurseNotes']))
M.node('End_VisitIncomplete', 'endEvent', 'Follow-up arranged', 2320, 800, parent=P)
M.node('Task_EvaluateRisk', 'serviceTask', 'Evaluate readmission risk', 2300, VY, parent=P,
       ext=worker('hh.evaluate-risk', inputs=['workflowId', 'visitId', 'careDay', 'painScore', 'temperature', 'woundRedness',
                                              'woundDischarge', 'swelling', ('=nurseNotes', 'nurseNotes')]))
M.node('Gw_Risk', 'exclusiveGateway', 'Risk level?', 2440, VY, parent=P, label=(2380, 668))
M.node('End_VisitNormal', 'endEvent', 'Visit done, normal risk', 2560, 550, parent=P)

# Readmission Risk Intervention (embedded sub-process with error + timer boundary events)
M.sub('Sub_RiskIntervention', 'Readmission Risk Intervention', 2540, 600, 1060, 540, parent=P)
R = 'Sub_RiskIntervention'
RY = 680
M.node('Start_Risk', 'startEvent', 'High pain or infection reported', 2580, RY, parent=R, label=(2525, 702))
M.node('Task_OpenIntervention', 'serviceTask', 'Open intervention and alert doctor', 2700, RY, parent=R,
       ext=worker('hh.open-intervention', inputs=['workflowId', 'patientId', 'patientName', 'assessmentId', 'riskLevel', 'riskReasons']))
M.node('Gw_Severity', 'exclusiveGateway', 'Severity?', 2840, RY, parent=R, label=(2760, 636))
M.node('Task_DispatchEmergency', 'serviceTask', 'Dispatch urgent response', 2960, RY, parent=R,
       ext=worker('hh.dispatch-emergency', inputs=['interventionId', 'patientAddress']))
M.node('Task_SmsCritical', 'serviceTask', 'SMS family: critical alert', 3110, RY, parent=R, attrs=REST_ATTRS,
       ext=rest('POST', '{{secrets.SMS_GATEWAY_URL}}', auth=('bearer', '{{secrets.SMS_API_KEY}}'),
                body='={to: familyPhone, category: "CRITICAL_ALERT", message: "URGENT: " + patientName + " needs urgent clinical attention. '
                     'An urgent response team has been dispatched and the care team will call you."}',
                result='={criticalAlertSid: response.body.sid}'))
M.node('Task_DoctorReview', 'userTask', 'Doctor review', 2960, 840, parent=R,
       ext=user_task('doctor-review-form', groups='doctors',
                     inputs=['patientName', 'careDay', 'riskLevel', 'riskReasons', 'painScore', 'temperature', 'nurseNotes', 'interventionId'],
                     outputs=['doctorDecision', 'doctorNotes']))
M.boundary('Timer_DoctorReminder', 'Task_DoctorReview', 'Reminder', timer('=doctorReviewReminder'), interrupting=False, label=(2966, 904))
M.node('Task_RemindDoctor', 'serviceTask', 'Remind on-call doctor', 2960, 1000, parent=R,
       ext=worker('hh.remind-doctor', inputs=['patientId', 'interventionId', 'patientName']))
M.node('End_Reminded', 'endEvent', 'Reminder sent', 2960, 1090, parent=R, label=(3000, 1080))
M.node('Gw_Decision', 'exclusiveGateway', 'Doctor decision?', 3110, 840, parent=R, label=(3125, 810))
M.node('Task_Readmit', 'serviceTask', 'Arrange hospital readmission', 3110, 960, parent=R,
       ext=worker('hh.arrange-readmission', inputs=['workflowId', 'patientId', 'interventionId']))
M.node('Gw_RiskJoin', 'exclusiveGateway', '', 3260, RY, parent=R)
M.node('Task_CloseIntervention', 'serviceTask', 'Close intervention', 3390, RY, parent=R,
       ext=worker('hh.close-intervention', inputs=['interventionId', 'riskLevel', 'doctorDecision', 'doctorNotes']))
M.node('End_Risk', 'endEvent', 'Intervention closed', 3520, RY, parent=R)
M.boundary('Err_EmergencyDispatch', 'Sub_RiskIntervention', 'Emergency dispatch failed',
           M.error('EMERGENCY_DISPATCH_FAILED', 'Emergency dispatch failed'), x=2700, label=(2706, 1162))
M.boundary('Timer_InterventionTimeout', 'Sub_RiskIntervention', 'Intervention timed out', timer('=interventionTimeout'), x=3200, label=(3206, 1162))
M.node('Task_ManualEmergency', 'userTask', 'Coordinate emergency manually', 2700, 1240, parent=P,
       ext=user_task('manual-emergency-form', groups='coordinators',
                     inputs=['patientName', 'patientAddress', 'patientPhone', 'familyPhone', 'riskReasons', 'interventionId'],
                     outputs=['emergencyOutcome', 'emergencyNotes']))
M.node('Task_RecordEscalation', 'serviceTask', 'Record manual escalation', 2860, 1240, parent=P,
       ext=worker('hh.record-escalation', inputs=['interventionId', 'emergencyOutcome', 'emergencyNotes']))
M.node('End_Escalated', 'endEvent', 'Escalation recorded', 3000, 1240, parent=P)
M.node('Task_ClinicalLead', 'serviceTask', 'Escalate to clinical lead', 3200, 1240, parent=P,
       ext=worker('hh.escalate-clinical-lead', inputs=['patientId', 'interventionId', 'patientName']))
M.node('End_LeadEscalated', 'endEvent', 'Clinical lead notified', 3340, 1240, parent=P)
M.node('End_Intervened', 'endEvent', 'Visit done, intervention closed', 3680, 870, parent=P)

# ---- Join and close-out
M.node('Gw_Join', 'parallelGateway', 'All care tracks done', 3880, Y, label=(3895, 430))
M.node('Task_VerifyPlan', 'serviceTask', 'Verify 7-day plan completion', 4010, Y,
       ext=worker('hh.verify-plan', inputs=['workflowId', 'carePlanId', 'visitResults', 'physioResults', 'pharmacyResults']))
M.node('Gw_Outcome', 'exclusiveGateway', 'Plan complete?', 4150, Y, label=(4095, 360))
M.node('Task_GapReview', 'userTask', 'Coordinator reviews gaps', 4285, 530,
       ext=user_task('gap-review-form', groups='coordinators', inputs=['patientName', 'planSummary', 'gapCount', 'visitResults',
                                                                         'physioResults', 'pharmacyResults'],
                     outputs=['gapReviewDecision', 'reviewNotes']))
M.node('Gw_OutcomeJoin', 'exclusiveGateway', '', 4420, Y)
FINAL_BODY = ('="Dear " + familyContactName + ",\\n\\nThe seven-day home-care plan for " + patientName + " has finished.\\n" + planSummary + '
              '".\\n\\nThank you. City Home Care team"')
M.node('Task_EmailFinal', 'serviceTask', 'E-mail family: final status', 4550, Y,
       ext=email('="Care plan complete for " + patientName', FINAL_BODY, '={finalNotificationSent: true}',
                 '=if is defined(error) then bpmnError("NOTIFICATION_FAILED", "E-mail failed: " + error.message) else null'))
M.boundary('Err_EmailFinal', 'Task_EmailFinal', 'E-mail failed', '<bpmn:errorEventDefinition errorRef="Error_NOTIFICATION_FAILED" />', label=(4556, 462))
M.node('Task_RecordFinalNotifyFailure', 'serviceTask', 'Record failed notification', 4550, 540,
       ext=worker('hh.record-notification-failure', inputs=['patientId', 'familyEmail', 'familyPhone', ('="FINAL_STATUS"', 'notificationCategory'),
                                                            ('="Final status e-mail failed"', 'notificationError')]))
M.node('Gw_FinalJoin', 'exclusiveGateway', '', 4690, Y)
M.node('Task_ClosePlan', 'serviceTask', 'Close care plan', 4820, Y,
       ext=worker('hh.complete-workflow', inputs=['workflowId', 'carePlanId', 'planOutcome']))
M.node('End_Completed', 'endEvent', 'Seven-day plan completed', 4960, Y)

# ---- flows (main)
f = M.flow
f('Start_Discharged', 'Task_ValidateDischarge')
f('Task_ValidateDischarge', 'Gw_DischargeValid')
f('Gw_DischargeValid', 'Task_ApprovePlan', 'Valid', '=dischargeValid = true', lbl=(386, 382, 32))
f('Task_ApprovePlan', 'Gw_Approved')
f('Gw_Approved', 'Task_GenerateCarePlan', 'Yes', '=approvalDecision = "APPROVED"', lbl=(668, 382, 30))
f('Gw_Approved', 'Task_RejectPlan', 'No', '=approvalDecision = "REJECTED"', lbl=(646, 455))
f('Task_RejectPlan', 'End_PlanRejected')
f('Gw_DischargeValid', 'Task_CorrectDischarge', 'Invalid', '=dischargeValid = false', lbl=(366, 450))
f('Task_CorrectDischarge', 'Task_ValidateDischarge', pts=[(300, 530), (220, 530), (220, 440)])
f('Task_GenerateCarePlan', 'Task_FetchNurses')
f('Task_FetchNurses', 'Gw_NursesFound')
f('Gw_NursesFound', 'Task_DistanceMatrix', 'Yes', '=nurseCount > 0', lbl=(806, 382, 30))
f('Gw_NursesFound', 'Task_ManualNurse', 'None available', '=nurseCount = 0',
  pts=[(780, 425), (780, 760), (1240, 760), (1240, 710)], lbl=(800, 740))
f('Task_DistanceMatrix', 'Task_MatchNurse')
f('Err_DistanceApi', 'Task_FallbackDistance')
f('Task_FallbackDistance', 'Task_MatchNurse', pts=[(980, 525), (1040, 525), (1040, 440)])
f('Err_DistanceInvalid', 'Task_FallbackDistance', pts=[(1080, 458), (1080, 555), (980, 555)])
f('Err_NoNurse', 'Task_ManualNurse', pts=[(1120, 458), (1120, 670), (1180, 670)])
f('Task_ManualNurse', 'Task_AssignNurse')
f('Task_MatchNurse', 'Task_AssignNurse')
f('Task_AssignNurse', 'Task_EmailAssignment')
f('Task_EmailAssignment', 'Gw_NotifyJoin')
f('Err_EmailAssign', 'Task_RecordNotifyFailure')
f('Task_RecordNotifyFailure', 'Gw_NotifyJoin', pts=[(1460, 540), (1540, 540), (1540, 425)])
f('Gw_NotifyJoin', 'Gw_Fork')
f('Gw_Fork', 'Sub_Physio', pts=[(1640, 375), (1640, 200), (1720, 200)])
f('Gw_Fork', 'Call_Pharmacy')
f('Gw_Fork', 'Sub_DailyVisit', pts=[(1640, 425), (1640, 640), (1720, 640)])
f('Start_Physio', 'Task_BookPhysio')
f('Task_BookPhysio', 'Task_PhysioSession')
f('Task_PhysioSession', 'Task_CompletePhysio')
f('Task_CompletePhysio', 'End_Physio')
f('Timer_PhysioWindow', 'Task_MissedPhysio')
f('Task_MissedPhysio', 'End_PhysioMissed')
f('Start_Visit', 'Task_ScheduleVisit')
f('Task_ScheduleVisit', 'Task_HealthAssessment')
f('Task_HealthAssessment', 'Gw_VisitDone')
f('Timer_VisitWindow', 'Task_MissedVisit')
f('Task_MissedVisit', 'End_VisitMissed')
f('Gw_VisitDone', 'Task_EvaluateRisk', 'Done', '=visitStatus = "COMPLETED"', lbl=(2206, 622, 30))
f('Gw_VisitDone', 'Task_IncompleteVisit', 'Incomplete', '=visitStatus = "INCOMPLETE"', lbl=(2186, 700))
f('Task_IncompleteVisit', 'End_VisitIncomplete')
f('Task_EvaluateRisk', 'Gw_Risk')
f('Gw_Risk', 'End_VisitNormal', 'NORMAL', '=riskLevel = "NORMAL"', pts=[(2440, 615), (2440, 550), (2542, 550)], lbl=(2450, 560))
f('Gw_Risk', 'Sub_RiskIntervention', 'At risk', '=riskLevel = "ELEVATED" or riskLevel = "CRITICAL"',
  pts=[(2465, 640), (2540, 640)], lbl=(2470, 622, 60))
f('Start_Risk', 'Task_OpenIntervention')
f('Task_OpenIntervention', 'Gw_Severity')
f('Gw_Severity', 'Task_DispatchEmergency', 'CRITICAL', '=riskLevel = "CRITICAL"', lbl=(2866, 662, 52))
f('Gw_Severity', 'Task_DoctorReview', 'ELEVATED', '=riskLevel = "ELEVATED"', lbl=(2846, 780))
f('Task_DispatchEmergency', 'Task_SmsCritical')
f('Task_SmsCritical', 'Gw_RiskJoin')
f('Task_DoctorReview', 'Gw_Decision')
f('Timer_DoctorReminder', 'Task_RemindDoctor')
f('Task_RemindDoctor', 'End_Reminded')
f('Gw_Decision', 'Gw_RiskJoin', 'Home care / urgent visit', '=doctorDecision = "HOME_CARE" or doctorDecision = "URGENT_VISIT"',
  pts=[(3135, 840), (3260, 840), (3260, 705)], lbl=(3150, 845))
f('Gw_Decision', 'Task_Readmit', 'Readmit', '=doctorDecision = "READMIT"', lbl=(3116, 880))
f('Task_Readmit', 'Task_CloseIntervention', pts=[(3170, 960), (3390, 960), (3390, 720)])
f('Gw_RiskJoin', 'Task_CloseIntervention')
f('Task_CloseIntervention', 'End_Risk')
f('Sub_RiskIntervention', 'End_Intervened', pts=[(3600, 870), (3662, 870)])
f('Err_EmergencyDispatch', 'Task_ManualEmergency')
f('Task_ManualEmergency', 'Task_RecordEscalation')
f('Task_RecordEscalation', 'End_Escalated')
f('Timer_InterventionTimeout', 'Task_ClinicalLead')
f('Task_ClinicalLead', 'End_LeadEscalated')
f('Sub_Physio', 'Gw_Join', pts=[(2440, 200), (3880, 200), (3880, 375)])
f('Call_Pharmacy', 'Gw_Join', pts=[(1900, 400), (3855, 400)])
f('Sub_DailyVisit', 'Gw_Join', pts=[(3760, 900), (3880, 900), (3880, 425)])
f('Gw_Join', 'Task_VerifyPlan')
f('Task_VerifyPlan', 'Gw_Outcome')
f('Gw_Outcome', 'Gw_OutcomeJoin', 'Yes', '=planOutcome = "COMPLETED"')
f('Gw_Outcome', 'Task_GapReview', 'Gaps found', '=planOutcome = "COMPLETED_WITH_GAPS"', lbl=(4156, 470))
f('Task_GapReview', 'Gw_OutcomeJoin', pts=[(4345, 530), (4420, 530), (4420, 425)])
f('Gw_OutcomeJoin', 'Task_EmailFinal')
f('Task_EmailFinal', 'Gw_FinalJoin')
f('Err_EmailFinal', 'Task_RecordFinalNotifyFailure')
f('Task_RecordFinalNotifyFailure', 'Gw_FinalJoin', pts=[(4610, 540), (4690, 540), (4690, 425)])
f('Gw_FinalJoin', 'Task_ClosePlan')
f('Task_ClosePlan', 'End_Completed')

M.shift(420, 300, exclude={'Task_ApprovePlan', 'Gw_Approved', 'Task_RejectPlan', 'End_PlanRejected'})

# ====================================================================================== CHILD PROCESS
C = Model('pharmacy-prescription-fulfillment', 'Pharmacy Prescription Fulfillment',
          'Reusable child process called once per prescription: verify, reserve stock (primary or partner pharmacy), dispatch a courier, '
          'wait for the delivery confirmation message and notify the family by SMS. Returns fulfillmentStatus, deliveryRef and fulfillmentNote.')
CY = 200
C.node('Start_Rx', 'startEvent', 'Prescription received', 100, CY)
C.node('Task_VerifyRx', 'serviceTask', 'Verify prescription', 220, CY, ext=worker('rx.verify-prescription', inputs=['prescription']))
C.node('Gw_RxValid', 'exclusiveGateway', 'Prescription valid?', 360, CY, label=(290, 152))
C.node('Task_NotifyRejection', 'serviceTask', 'Notify prescribing doctor', 360, 330,
       ext=worker('rx.notify-rejection', inputs=['patientId', 'prescription', 'rxRejectionReason']))
C.node('End_Rejected', 'endEvent', 'Prescription rejected', 500, 330)
C.node('Task_CheckStock', 'serviceTask', 'Check and reserve stock', 480, CY, ext=worker('rx.check-stock', inputs=['prescription']))
C.node('Gw_Stock', 'exclusiveGateway', 'In stock?', 620, CY, label=(635, 160))
C.node('Task_SourcePartner', 'serviceTask', 'Source from partner pharmacy', 620, 330, ext=worker('rx.source-partner', inputs=['prescription']))
C.node('Gw_Partner', 'exclusiveGateway', 'Partner has it?', 760, 330, label=(775, 360))
C.node('Task_MarkUnavailable', 'serviceTask', 'Mark unavailable and alert coordinator', 760, 470,
       ext=worker('rx.mark-unavailable', inputs=['patientId', 'prescription']))
C.node('End_Unavailable', 'endEvent', 'Medicine unavailable', 900, 470)
C.node('Gw_StockJoin', 'exclusiveGateway', '', 900, CY)
C.node('Task_Dispatch', 'serviceTask', 'Dispense and book courier', 1030, CY, ext=worker('rx.dispatch-delivery', inputs=['prescription']))
C.boundary('Err_Courier', 'Task_Dispatch', 'No courier', C.error('COURIER_UNAVAILABLE', 'Courier unavailable'), label=(1036, 262))
C.node('Task_Reschedule', 'serviceTask', 'Reschedule delivery', 1030, 330, ext=worker('rx.reschedule-delivery', inputs=['patientId', 'prescription']))
C.node('End_Delayed', 'endEvent', 'Delivery delayed', 1030, 440)
C.messages['MedicationDelivered'] = '=deliveryRef'
C.node('Task_AwaitDelivery', 'receiveTask', 'Await delivery confirmation', 1220, CY, attrs=' messageRef="Message_MedicationDelivered"',
       ext=io(inputs=['deliveryRef']))
C.boundary('Timer_DeliveryReminder', 'Task_AwaitDelivery', 'Taking longer than expected', timer('=deliveryReminder'), x=1190, interrupting=False, label=(1196, 268))
C.boundary('Timer_DeliveryTimeout', 'Task_AwaitDelivery', 'Delivery deadline passed', timer('=deliveryTimeout'), side='T', label=(1228, 106))
C.node('Task_SmsDelayed', 'serviceTask', 'SMS family: delivery delayed', 1220, 360, attrs=REST_ATTRS,
       ext=rest('POST', '{{secrets.SMS_GATEWAY_URL}}', auth=('bearer', '{{secrets.SMS_API_KEY}}'),
                body='={to: familyPhone, category: "DELIVERY_DELAYED", message: "Delivery of " + prescription.medication + " (" + deliveryRef + '
                     '") for " + patientName + " is taking longer than expected. City Home Care"}',
                result='={delayNoticeSid: response.body.sid}'))
C.node('End_DelayNotified', 'endEvent', 'Family informed', 1360, 360)
C.node('Task_MarkFailed', 'serviceTask', 'Mark delivery failed', 1220, 60,
       ext=worker('rx.mark-delivery-failed', inputs=['patientId', 'deliveryRef', 'prescription']))
C.node('End_Failed', 'endEvent', 'Delivery failed', 1360, 60)
C.node('Task_RecordDelivery', 'serviceTask', 'Record delivery', 1380, CY, ext=worker('rx.record-delivery', inputs=['deliveryRef']))
C.node('Task_SmsDelivered', 'serviceTask', 'SMS family: medicine delivered', 1530, CY, attrs=REST_ATTRS,
       ext=rest('POST', '{{secrets.SMS_GATEWAY_URL}}', auth=('bearer', '{{secrets.SMS_API_KEY}}'),
                body='={to: familyPhone, category: "MEDICATION_DELIVERED", message: prescription.medication + " for " + patientName + '
                     '" has been delivered (" + deliveryRef + "). City Home Care"}',
                result='={deliveryNoticeSid: response.body.sid}'))
C.node('End_Delivered', 'endEvent', 'Medicine delivered', 1670, CY)
g = C.flow
g('Start_Rx', 'Task_VerifyRx')
g('Task_VerifyRx', 'Gw_RxValid')
g('Gw_RxValid', 'Task_CheckStock', 'Valid', '=rxValid = true', lbl=(386, 182, 32))
g('Gw_RxValid', 'Task_NotifyRejection', 'Invalid', '=rxValid = false', lbl=(366, 250))
g('Task_NotifyRejection', 'End_Rejected')
g('Task_CheckStock', 'Gw_Stock')
g('Gw_Stock', 'Gw_StockJoin', 'In stock', '=stockStatus = "IN_STOCK"')
g('Gw_Stock', 'Task_SourcePartner', 'Out of stock', '=stockStatus = "OUT_OF_STOCK"', lbl=(626, 250))
g('Task_SourcePartner', 'Gw_Partner')
g('Gw_Partner', 'Gw_StockJoin', 'Yes', '=partnerFound = true', pts=[(785, 330), (900, 330), (900, 225)], lbl=(800, 312))
g('Gw_Partner', 'Task_MarkUnavailable', 'No', '=partnerFound = false', lbl=(766, 395))
g('Task_MarkUnavailable', 'End_Unavailable')
g('Gw_StockJoin', 'Task_Dispatch')
g('Task_Dispatch', 'Task_AwaitDelivery')
g('Err_Courier', 'Task_Reschedule')
g('Task_Reschedule', 'End_Delayed')
g('Task_AwaitDelivery', 'Task_RecordDelivery')
g('Timer_DeliveryReminder', 'Task_SmsDelayed', pts=[(1190, 258), (1190, 360), (1160, 360)])
g('Task_SmsDelayed', 'End_DelayNotified')
g('Timer_DeliveryTimeout', 'Task_MarkFailed')
g('Task_MarkFailed', 'End_Failed')
g('Task_RecordDelivery', 'Task_SmsDelivered')
g('Task_SmsDelivered', 'End_Delivered')

# ====================================================================================== FORMS
def form(fid, title, intro, fields):
    comps = [{'type': 'text', 'id': 'Heading', 'text': f'# {title}\n\n{intro}'}]
    for i, fl in enumerate(fields):
        c = {'id': f'Field_{i}', **fl}
        comps.append(c)
    return {'executionPlatform': 'Camunda Cloud', 'executionPlatformVersion': '8.8.0',
            'exporter': {'name': 'Camunda Modeler', 'version': '5.50.1'}, 'schemaVersion': 16, 'id': fid, 'type': 'default',
            'components': comps}


ro = lambda key, label: {'type': 'textfield', 'key': key, 'label': label, 'readonly': True}
sel = lambda key, label, opts: {'type': 'select', 'key': key, 'label': label, 'validate': {'required': True},
                                'values': [{'label': l, 'value': v} for v, l in opts]}
area = lambda key, label, req=False: {'type': 'textarea', 'key': key, 'label': label, 'validate': {'required': req}}
FORMS = [
    form('approve-plan-form', 'Approve home-care plan',
         'A ward staff member submitted this discharge request. Check the details and approve or reject the seven-day plan.',
         [ro('patientName', 'Patient'), ro('surgeryType', 'Surgery'), ro('dischargeDate', 'Discharge date'),
          ro('requestedBy', 'Requested by'),
          sel('approvalDecision', 'Decision', [('APPROVED', 'Approve the plan'), ('REJECTED', 'Reject the request')]),
          area('approvalNotes', 'Notes (required when rejecting)')]),
    form('health-assessment-form', 'Home visit and health assessment',
         'Record today\'s visit. High pain or infection indicators start the Readmission Risk Intervention. '
         'This is workflow support, not a diagnosis.',
         [ro('patientName', 'Patient'), ro('careDay.day', 'Care day'), ro('patientAddress', 'Address'),
          sel('visitStatus', 'Visit outcome', [('COMPLETED', 'Visit completed'), ('INCOMPLETE', 'Visit incomplete')]),
          {'type': 'number', 'key': 'painScore', 'label': 'Pain score (0 to 10)', 'validate': {'min': 0, 'max': 10}},
          {'type': 'number', 'key': 'temperature', 'label': 'Temperature (°C)', 'decimalDigits': 1, 'validate': {'min': 34, 'max': 43}},
          {'type': 'checkbox', 'key': 'woundRedness', 'label': 'Redness around the wound'},
          {'type': 'checkbox', 'key': 'woundDischarge', 'label': 'Discharge from the wound'},
          {'type': 'checkbox', 'key': 'swelling', 'label': 'Swelling'},
          area('nurseNotes', 'Nurse notes')]),
    form('doctor-review-form', 'Doctor review', 'Review the escalated assessment and decide the next step.',
         [ro('patientName', 'Patient'), ro('riskLevel', 'Risk flag'), ro('painScore', 'Pain score'), ro('temperature', 'Temperature'),
          sel('doctorDecision', 'Decision', [('HOME_CARE', 'Continue home care with changes'), ('URGENT_VISIT', 'Urgent home visit'),
                                              ('READMIT', 'Readmit to hospital')]),
          area('doctorNotes', 'Clinical notes', True)]),
    form('physio-session-form', 'Physiotherapy session', 'Record the outcome of the session.',
         [ro('patientName', 'Patient'), ro('session.focus', 'Session focus'), ro('session.date', 'Date'),
          sel('physioStatus', 'Outcome', [('COMPLETED', 'Session completed'), ('PATIENT_DECLINED', 'Patient declined')]),
          area('physioNotes', 'Notes')]),
    form('manual-nurse-form', 'Arrange nurse manually', 'No nurse could be matched automatically. Choose a nurse (by ID) after calling them.',
         [ro('patientName', 'Patient'), ro('patientAddress', 'Address'), ro('requiredSkill', 'Required skill'),
          {'type': 'number', 'key': 'selectedNurseId', 'label': 'Nurse ID', 'validate': {'required': True, 'min': 1}},
          area('manualAssignmentNote', 'Arrangement note', True)]),
    form('correct-discharge-form', 'Correct discharge details', 'Validation failed. Fix the contact details and confirm.',
         [ro('patientName', 'Patient'),
          {'type': 'textfield', 'key': 'patientPhone', 'label': 'Patient phone (10 digits)', 'validate': {'required': True, 'pattern': '^[0-9]{10}$'}},
          {'type': 'textfield', 'key': 'familyPhone', 'label': 'Family phone (10 digits)', 'validate': {'required': True, 'pattern': '^[0-9]{10}$'}},
          {'type': 'textfield', 'key': 'familyEmail', 'label': 'Family e-mail', 'validate': {'required': True, 'validationType': 'email'}},
          {'type': 'textfield', 'key': 'dischargeDate', 'label': 'Discharge date (YYYY-MM-DD)', 'validate': {'required': True}}]),
    form('manual-emergency-form', 'Coordinate emergency manually', 'The urgent response service failed. Arrange help by phone.',
         [ro('patientName', 'Patient'), ro('patientAddress', 'Address'), ro('familyPhone', 'Family phone'),
          sel('emergencyOutcome', 'What was arranged', [('AMBULANCE_ARRANGED', 'Ambulance arranged'),
                                                         ('HOSPITAL_CONTACTED', 'Hospital contacted'), ('DOCTOR_ATTENDED', 'Doctor attended')]),
          area('emergencyNotes', 'Notes', True)]),
    form('gap-review-form', 'Review care-plan gaps', 'Some visits, sessions or deliveries were not completed.',
         [ro('patientName', 'Patient'), ro('planSummary', 'Summary'),
          sel('gapReviewDecision', 'Decision', [('ACCEPT_AND_CLOSE', 'Accept and close'), ('FOLLOW_UP_BOOKED', 'Follow-up booked')]),
          area('reviewNotes', 'Notes', True)]),
]

if __name__ == '__main__':
    (OUT / 'forms').mkdir(parents=True, exist_ok=True)
    (OUT / 'main-home-healthcare.bpmn').write_text(M.xml(), encoding='utf-8')
    (OUT / 'pharmacy-prescription-fulfillment.bpmn').write_text(C.xml(), encoding='utf-8')
    for fm in FORMS:
        (OUT / 'forms' / f'{fm["id"]}.form').write_text(json.dumps(fm, indent=2, ensure_ascii=False), encoding='utf-8')
    types = sorted({n['ext'].split('type="')[1].split('"')[0] for mdl in (M, C) for n in mdl.nodes.values() if 'taskDefinition type="' in n['ext']})
    print('wrote 2 BPMN files and', len(FORMS), 'forms; job types:', len(types))
    print('\n'.join(types))
