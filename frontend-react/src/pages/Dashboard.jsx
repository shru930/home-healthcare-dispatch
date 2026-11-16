import { Link } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section, KpiCard } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDateTime } from '../format.js';
import { useAuth } from '../auth.jsx';

export const APPROVE_TASK = 'Task_ApprovePlan';

export default function Dashboard() {
  const dash = useApi(api.dashboard, [], { intervalMs: 10000 });
  const wfs = useApi(api.workflows, [], { intervalMs: 10000 });
  const alerts = useApi(api.alerts, [], { intervalMs: 10000 });
  const { isAdmin } = useAuth();
  // Admin only: open "Approve home-care plan" tasks (the backend returns admin tasks for ADMIN).
  const approvals = useApi(() => (isAdmin ? api.tasks() : Promise.resolve([])), [isAdmin], { intervalMs: 10000 });
  const pendingApprovals = (approvals.data || []).filter((t) => t.elementId === APPROVE_TASK).length;
  const d = dash.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's home-care overview"
        subtitle="Seven-day post-operative plans across Chennai. Figures refresh every 10 seconds."
        actions={
          <>
            <Link to="/tasks" className="btn-secondary">Open Tasklist</Link>
            <Link to="/patients" className="btn-primary">{isAdmin ? 'Discharge a patient' : 'Submit discharge request'}</Link>
          </>
        }
      />
      {isAdmin && (
        <Link to="/tasks" className="card card-hover flex items-center justify-between gap-4 border-l-[3px] border-l-amber-500 px-4 py-3.5">
          <div>
            <p className="text-xs font-medium text-stone-500">Pending approvals</p>
            <p className="text-xs text-stone-400">Discharge requests from ward staff waiting for your decision</p>
          </div>
          <p className="font-display text-[30px] font-semibold leading-tight tabular-nums text-ink">
            {approvals.loading && !approvals.data ? '-' : approvals.error ? '?' : pendingApprovals}
          </p>
        </Link>
      )}
      <ErrorBanner error={dash.error} onRetry={dash.reload} />
      {dash.loading && !d ? (
        <Spinner />
      ) : (
        d && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label="Active patients" value={d.activePatients} tone="teal" />
              <KpiCard label="Active care plans" value={d.activeCarePlans} tone="sky" />
              <KpiCard label="Available nurses" value={d.availableNurses} tone="teal" hint="with spare capacity" />
              <KpiCard label="Scheduled visits" value={d.scheduledVisits} tone="sky" />
              <KpiCard label="Pending deliveries" value={d.pendingDeliveries} tone="amber" />
              <KpiCard label="Critical alerts" value={d.criticalAlerts} tone={d.criticalAlerts ? 'rose' : 'slate'} hint="open CRITICAL interventions" />
              <KpiCard label="Open interventions" value={d.openInterventions} tone={d.openInterventions ? 'amber' : 'slate'} />
              <KpiCard label="Failed notifications" value={d.failedNotifications} tone={d.failedNotifications ? 'rose' : 'slate'} />
            </div>
            <Section title="Workflows by status">
              {Object.keys(d.workflowsByStatus || {}).length === 0 ? (
                <EmptyState title="No workflows started yet">Discharge a registered patient to start a 7-day plan.</EmptyState>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(d.workflowsByStatus).map(([s, n]) => (
                    <div key={s} className="flex items-center gap-3 rounded-md border border-stone-200 px-3 py-2">
                      <StatusBadge value={s} />
                      <span className="font-display text-lg font-semibold tabular-nums text-ink">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Recent workflows" className="xl:col-span-2" actions={<Link to="/tracker" className="text-sm font-semibold text-brand-700 hover:text-brand-900">All</Link>}>
          <ErrorBanner error={wfs.error} onRetry={wfs.reload} />
          {wfs.loading && !wfs.data ? (
            <Spinner />
          ) : (
            <DataTable
              rowKey="workflowId"
              rows={(wfs.data || []).slice(0, 10)}
              empty="No workflows yet"
              columns={[
                { key: 'patientName', header: 'Patient' },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
                { key: 'currentStage', header: 'Current stage' },
                { key: 'startedAt', header: 'Started', render: (r) => fmtDateTime(r.startedAt) },
                {
                  key: 'pik',
                  header: 'Tracker',
                  render: (r) =>
                    r.processInstanceKey ? (
                      <Link className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-900" to={`/tracker/${r.processInstanceKey}`}>
                        {r.processInstanceKey}
                      </Link>
                    ) : (
                      '-'
                    ),
                },
              ]}
            />
          )}
        </Section>
        <Section title="Latest alerts" actions={<Link to="/risk" className="text-sm font-semibold text-brand-700 hover:text-brand-900">Risk</Link>}>
          <ErrorBanner error={alerts.error} onRetry={alerts.reload} />
          {alerts.loading && !alerts.data ? (
            <Spinner />
          ) : (alerts.data || []).length === 0 ? (
            <EmptyState title="No alerts">Escalations and failed notifications appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-stone-100">
              {alerts.data.slice(0, 8).map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-stone-500">{a.channel}</span>
                    <span className="ml-auto text-xs text-stone-400">{fmtDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-medium text-stone-800">{a.subject || a.category}</p>
                  <p className="text-xs text-stone-500">
                    {a.patientName || '-'}
                    {a.error ? ` · ${a.error}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
