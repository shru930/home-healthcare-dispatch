import { useState } from 'react';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, Notice } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDateTime } from '../format.js';

export default function Notifications() {
  const list = useApi(api.notifications, [], { intervalMs: 8000 });
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const rows = (list.data || []).filter((n) => (!channel || n.channel === channel) && (!status || n.status === status));
  const channels = [...new Set((list.data || []).map((n) => n.channel))].sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Last 100 notifications sent by the workflow (e-mail, SMS, in-app)" />
      <Notice kind="info" title="Demo mode">
        Demo mode: e-mails are delivered to an embedded SMTP server and SMS to a mock gateway by the Camunda connectors.
      </Notice>
      <Section
        title="Notification log"
        actions={
          <>
            <select className="input w-auto" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Filter by channel">
              <option value="">All channels</option>
              {channels.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
            </select>
          </>
        }
      >
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={rows}
            empty="No notifications"
            columns={[
              { key: 'createdAt', header: 'Time', render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</span> },
              { key: 'channel', header: 'Channel', render: (r) => <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium">{r.channel}</span> },
              { key: 'category', header: 'Category', render: (r) => <span className="text-xs">{r.category}</span> },
              { key: 'patientName', header: 'Patient', render: (r) => r.patientName || '-' },
              { key: 'recipient', header: 'Recipient', render: (r) => <span className="break-all text-xs">{r.recipient}</span> },
              {
                key: 'subject',
                header: 'Subject / message',
                render: (r) => (
                  <div className="max-w-md text-xs">
                    {r.subject && <p className="font-medium text-stone-800">{r.subject}</p>}
                    {r.message && <p className="line-clamp-2 text-stone-500" title={r.message}>{r.message}</p>}
                  </div>
                ),
              },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'error', header: 'Error', render: (r) => (r.error ? <span className="text-xs text-red-700">{r.error}</span> : '-') },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
