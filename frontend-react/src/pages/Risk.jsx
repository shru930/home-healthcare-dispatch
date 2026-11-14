import { Link } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, CLINICAL_DISCLAIMER } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDateTime } from '../format.js';

export default function Risk() {
  const interventions = useApi(api.interventions, [], { intervalMs: 8000 });
  const alerts = useApi(api.alerts, [], { intervalMs: 8000 });
  const rows = interventions.data || [];
  const open = rows.filter((r) => !r.closedAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Readmission risk"
        subtitle={`${open} open of ${rows.length} interventions`}
        actions={<Link to="/tasks" className="btn-primary">Submit assessment (Tasklist)</Link>}
      />
      <div role="note" className="flex gap-3 rounded-md border-2 border-amber-400 bg-amber-50 px-5 py-4 text-amber-900">
        <span className="text-2xl leading-none" aria-hidden="true">!</span>
        <div>
          <p className="font-semibold">{CLINICAL_DISCLAIMER}</p>
          <p className="mt-1 text-sm">
            The nurse enters pain score, temperature and infection indicators through the{' '}
            <Link to="/tasks" className="font-medium underline">Tasklist assessment form</Link>; the workflow evaluates them against the thresholds (NORMAL / ELEVATED / CRITICAL) and
            opens an intervention with a doctor review for ELEVATED or CRITICAL results.
          </p>
        </div>
      </div>
      <Section title="Interventions">
        <ErrorBanner error={interventions.error} onRetry={interventions.reload} />
        {interventions.loading && !interventions.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={rows}
            empty="No interventions"
            emptyHint="Interventions open when an assessment is flagged ELEVATED or CRITICAL."
            columns={[
              { key: 'patientName', header: 'Patient' },
              { key: 'dayNumber', header: 'Day' },
              { key: 'riskLevel', header: 'Risk', render: (r) => <StatusBadge value={r.riskLevel} /> },
              { key: 'riskReasons', header: 'Reasons', render: (r) => <span className="text-xs">{r.riskReasons || '-'}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'escalationLevel', header: 'Escalation', render: (r) => <span className="text-xs">{r.escalationLevel || '-'}</span> },
              { key: 'doctorDecision', header: 'Doctor decision', render: (r) => (r.doctorDecision ? <StatusBadge value={r.doctorDecision} /> : '-') },
              { key: 'open', header: 'Open/closed', render: (r) => (r.closedAt ? <StatusBadge value="CLOSED" label={`closed ${fmtDateTime(r.closedAt)}`} /> : <StatusBadge value="OPEN" />) },
              { key: 'openedAt', header: 'Opened', render: (r) => fmtDateTime(r.openedAt) },
            ]}
          />
        )}
      </Section>
      <Section title="Staff alerts">
        <ErrorBanner error={alerts.error} onRetry={alerts.reload} />
        {alerts.loading && !alerts.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={alerts.data || []}
            empty="No alerts"
            columns={[
              { key: 'createdAt', header: 'Time', render: (r) => fmtDateTime(r.createdAt) },
              { key: 'patientName', header: 'Patient', render: (r) => r.patientName || '-' },
              { key: 'category', header: 'Category', render: (r) => <span className="text-xs font-medium">{r.category}</span> },
              { key: 'channel', header: 'Channel' },
              { key: 'recipient', header: 'Recipient', render: (r) => <span className="text-xs">{r.recipient}</span> },
              { key: 'subject', header: 'Subject', render: (r) => <span className="text-xs">{r.subject || r.message}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
