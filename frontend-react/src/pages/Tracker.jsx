import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section, KeyValue } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDeliveryButton from '../components/ConfirmDeliveryButton.jsx';
import { SevenDay } from './Visits.jsx';
import { SourceBadge } from './Nurses.jsx';
import { fmtDate, fmtDateTime, OPERATE_URL } from '../format.js';

const firstLine = (s) => String(s ?? '').split('\n')[0];

export default function Tracker() {
  const { processInstanceKey } = useParams();
  const st = useApi(() => api.workflowStatus(processInstanceKey), [processInstanceKey], { intervalMs: 3000 });
  const d = st.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live process tracker"
        subtitle={<span>Process instance <span className="font-mono">{processInstanceKey}</span> · polling every 3 s</span>}
        actions={
          <>
            <Link to="/tracker" className="btn-secondary">All workflows</Link>
            <a className="btn-secondary" href={`${OPERATE_URL}/${processInstanceKey}`} target="_blank" rel="noreferrer">Open in Camunda Operate</a>
            <Link to="/tasks" className="btn-primary">Tasklist</Link>
          </>
        }
      />
      <ErrorBanner error={st.error} onRetry={st.reload} />
      {st.loading && !d ? (
        <Spinner label="Loading process status..." />
      ) : !d ? null : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Workflow" className="lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge value={d.status} label={`Workflow: ${d.status}`} />
                <StatusBadge value={d.engineState} label={`Engine: ${d.engineState}`} />
                {d.planOutcome && <StatusBadge value="COMPLETED" label={`Outcome: ${d.planOutcome}`} />}
              </div>
              <p className="mb-3 text-lg font-semibold text-stone-800">{d.currentStage || '-'}</p>
              <KeyValue
                items={[
                  ['Workflow ID', d.workflowId],
                  ['Process instance key', <span className="font-mono">{d.processInstanceKey}</span>],
                  ['Started', fmtDateTime(d.startedAt)],
                  ['Ended', fmtDateTime(d.endedAt)],
                  ['Completed BPMN steps', d.completedStepCount ?? '-'],
                  d.carePlan && ['Care plan', `#${d.carePlan.id} · ${fmtDate(d.carePlan.startDate)} to ${fmtDate(d.carePlan.endDate)} · ${d.carePlan.status}`],
                ]}
              />
              {d.engineError && <p className="mt-3 text-xs text-red-700">Engine query failed: {firstLine(d.engineError)}</p>}
            </Section>
            <Section title="Patient">
              <KeyValue
                items={[
                  ['Name', d.patient?.name],
                  ['MRN', d.patient?.mrn],
                  ['Status', <StatusBadge value={d.patient?.status} />],
                  ['Surgery', d.patient?.surgeryType],
                  ['Family contact', d.patient?.familyContact],
                ]}
              />
            </Section>
          </div>

          {(d.incidents || []).length > 0 && (
            <div role="alert" className="rounded-md border-2 border-red-300 bg-red-50 p-4">
              <h2 className="mb-2 font-semibold text-red-800">{d.incidents.length} active incident(s)</h2>
              <ul className="space-y-2">
                {d.incidents.map((i, idx) => (
                  <li key={idx} className="text-sm text-red-900">
                    <span className="font-mono text-xs">{i.elementId}</span> · <span className="font-medium">{i.errorType}</span>
                    <p className="text-xs">{firstLine(i.errorMessage)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-700">Resolve the cause (e.g. reset demo faults) and retry the incident in Camunda Operate.</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Active steps" className="lg:col-span-2">
              {(d.activeSteps || []).length === 0 ? (
                <p className="text-sm text-stone-500">{d.engineState === 'COMPLETED' ? 'Process completed.' : 'No active steps.'}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.activeSteps.map((s, i) => (
                    <span key={`${s.elementId}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-600/20" title={`${s.elementId} (${s.type})`}>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                      {s.name && s.name !== 'null' ? s.name : s.elementId}
                      <span className="text-sky-500">{s.type?.replace(/_/g, ' ').toLowerCase()}</span>
                    </span>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Assigned nurse">
              {d.assignment ? (
                <KeyValue
                  items={[
                    ['Nurse', `${d.assignment.nurse} (${d.assignment.username})`],
                    ['Distance', `${d.assignment.distanceKm} km`],
                    ['Travel time', `${d.assignment.travelMinutes} min`],
                    ['Source', <SourceBadge source={d.assignment.source} />],
                    ['Mode', <StatusBadge value={d.assignment.mode} />],
                  ]}
                />
              ) : (
                <p className="text-sm text-stone-500">Not assigned yet.</p>
              )}
            </Section>
          </div>

          <Section
            title="7-day visit timeline"
            actions={d.visits && <span className="text-xs text-stone-500">{d.visitsCompleted ?? 0} completed · {d.visitsPending ?? 0} pending</span>}
          >
            {d.carePlan ? <SevenDay visits={d.visits || []} dayKey="day" dateKey="date" nurseKey="nurse" typeKey="type" /> : <EmptyState title="Care plan not created yet" />}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Physiotherapy sessions">
              <DataTable
                rows={d.physio || []}
                empty="No physiotherapy sessions"
                columns={[
                  { key: 'sessionNo', header: '#' },
                  { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'focus', header: 'Focus' },
                  { key: 'physiotherapist', header: 'Physio', render: (r) => <span className="font-mono text-xs">{r.physiotherapist}</span> },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
                ]}
              />
            </Section>
            <Section title="Prescriptions & delivery">
              <DataTable
                rows={d.prescriptions || []}
                empty="No prescriptions"
                columns={[
                  { key: 'medication', header: 'Medication' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
                  { key: 'pharmacy', header: 'Pharmacy', render: (r) => <span className="text-xs">{r.pharmacy || '-'}{r.reason ? ` · ${r.reason}` : ''}</span> },
                  { key: 'deliveryStatus', header: 'Delivery', render: (r) => (r.deliveryStatus ? <StatusBadge value={r.deliveryStatus} /> : '-') },
                  { key: 'act', header: '', render: (r) => (r.deliveryStatus === 'DISPATCHED' ? <ConfirmDeliveryButton deliveryRef={r.deliveryRef} onDone={st.reload} /> : null) },
                ]}
              />
            </Section>
            <Section title="Pharmacy child instances">
              <DataTable
                rowKey="processInstanceKey"
                rows={d.pharmacyInstances || []}
                empty="No pharmacy fulfilment instances yet"
                columns={[
                  { key: 'processInstanceKey', header: 'Process instance', render: (r) => <a className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-900" href={`${OPERATE_URL}/${r.processInstanceKey}`} target="_blank" rel="noreferrer">{r.processInstanceKey}</a> },
                  { key: 'state', header: 'State', render: (r) => <StatusBadge value={r.state} /> },
                  { key: 'hasIncident', header: 'Incident', render: (r) => (r.hasIncident === 'true' ? <StatusBadge value="INCIDENT" /> : '-') },
                ]}
              />
            </Section>
            <Section title="Interventions">
              <DataTable
                rows={d.interventions || []}
                empty="No interventions"
                columns={[
                  { key: 'riskLevel', header: 'Risk', render: (r) => <StatusBadge value={r.riskLevel} /> },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
                  { key: 'escalationLevel', header: 'Escalation', render: (r) => <span className="text-xs">{r.escalationLevel || '-'}</span> },
                  { key: 'doctorDecision', header: 'Decision', render: (r) => r.doctorDecision || '-' },
                  { key: 'openedAt', header: 'Opened', render: (r) => fmtDateTime(r.openedAt) },
                ]}
              />
            </Section>
          </div>

          <Section title="Notifications log">
            <DataTable
              rowKey={(r, i) => `${r.createdAt}-${i}`}
              rows={d.notifications || []}
              empty="No notifications yet"
              columns={[
                { key: 'createdAt', header: 'Time', render: (r) => fmtDateTime(r.createdAt) },
                { key: 'channel', header: 'Channel' },
                { key: 'category', header: 'Category', render: (r) => <span className="text-xs">{r.category}</span> },
                { key: 'recipient', header: 'Recipient', render: (r) => <span className="break-all text-xs">{r.recipient}</span> },
                { key: 'subject', header: 'Subject', render: (r) => <span className="text-xs">{r.subject !== 'null' ? r.subject : '-'}</span> },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              ]}
            />
          </Section>
        </>
      )}
    </div>
  );
}
