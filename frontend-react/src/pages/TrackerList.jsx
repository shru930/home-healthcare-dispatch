import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDateTime } from '../format.js';

export default function TrackerList() {
  const wfs = useApi(api.workflows, [], { intervalMs: 5000 });
  const navigate = useNavigate();
  const [key, setKey] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live process tracker"
        subtitle="Pick a workflow to follow its Camunda process instance live"
        actions={
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (key.trim()) navigate(`/tracker/${key.trim()}`); }}>
            <input className="input w-56 font-mono" placeholder="Process instance key" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Process instance key" />
            <button type="submit" className="btn-primary">Open</button>
          </form>
        }
      />
      <Section title="Workflows">
        <ErrorBanner error={wfs.error} onRetry={wfs.reload} />
        {wfs.loading && !wfs.data ? (
          <Spinner />
        ) : (
          <DataTable
            rowKey="workflowId"
            rows={wfs.data || []}
            empty="No workflows started yet"
            emptyHint="Discharge a patient from the Patients page to start one."
            onRowClick={(r) => r.processInstanceKey && navigate(`/tracker/${r.processInstanceKey}`)}
            columns={[
              { key: 'workflowId', header: 'Workflow' },
              { key: 'processInstanceKey', header: 'Process instance', render: (r) => r.processInstanceKey ? <Link className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-900" to={`/tracker/${r.processInstanceKey}`}>{r.processInstanceKey}</Link> : '-' },
              { key: 'patientName', header: 'Patient' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'currentStage', header: 'Current stage' },
              { key: 'planOutcome', header: 'Outcome', render: (r) => r.planOutcome || '-' },
              { key: 'startedAt', header: 'Started', render: (r) => fmtDateTime(r.startedAt) },
              { key: 'endedAt', header: 'Ended', render: (r) => fmtDateTime(r.endedAt) },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
