import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDeliveryButton from '../components/ConfirmDeliveryButton.jsx';
import { fmtDateTime } from '../format.js';

export default function Pharmacy() {
  const rx = useApi(api.prescriptions, [], { intervalMs: 8000 });
  const deliveries = useApi(api.deliveries, [], { intervalMs: 5000 });
  const stock = useApi(api.stock, [], { intervalMs: 15000 });

  return (
    <div className="space-y-6">
      <PageHeader title="Pharmacy" subtitle="Prescription fulfilment child processes, courier deliveries and pharmacy stock" />
      <Section title="Prescriptions">
        <ErrorBanner error={rx.error} onRetry={rx.reload} />
        {rx.loading && !rx.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={rx.data || []}
            empty="No prescriptions"
            columns={[
              { key: 'patientName', header: 'Patient' },
              { key: 'medication', header: 'Medication', render: (r) => <span className="font-medium">{r.medication}</span> },
              { key: 'dosage', header: 'Dosage' },
              { key: 'quantity', header: 'Qty' },
              { key: 'flags', header: 'Flags', render: (r) => <div className="flex flex-wrap gap-1">{r.controlled && <StatusBadge value="HIGH" label="controlled" />}{r.doctorApproved ? <StatusBadge value="OK" label="approved" /> : <StatusBadge value="PENDING" label="not approved" />}</div> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'pharmacy', header: 'Pharmacy', render: (r) => r.pharmacy || '-' },
              { key: 'statusReason', header: 'Reason', render: (r) => <span className="text-xs">{r.statusReason || '-'}</span> },
            ]}
          />
        )}
      </Section>
      <Section title="Deliveries">
        <ErrorBanner error={deliveries.error} onRetry={deliveries.reload} />
        {deliveries.loading && !deliveries.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={deliveries.data || []}
            empty="No deliveries dispatched"
            columns={[
              { key: 'deliveryRef', header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.deliveryRef}</span> },
              { key: 'patientName', header: 'Patient' },
              { key: 'medication', header: 'Medication' },
              { key: 'pharmacy', header: 'Pharmacy' },
              { key: 'courier', header: 'Courier', render: (r) => r.courier || '-' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'dispatchedAt', header: 'Dispatched', render: (r) => fmtDateTime(r.dispatchedAt) },
              { key: 'expectedBy', header: 'Expected by', render: (r) => fmtDateTime(r.expectedBy) },
              { key: 'deliveredAt', header: 'Delivered', render: (r) => fmtDateTime(r.deliveredAt) },
              { key: 'action', header: '', render: (r) => (r.status === 'DISPATCHED' ? <ConfirmDeliveryButton deliveryRef={r.deliveryRef} onDone={() => { deliveries.reload(); rx.reload(); }} /> : r.note ? <span className="text-xs text-stone-500">{r.note}</span> : null) },
            ]}
          />
        )}
      </Section>
      <Section title="Pharmacy stock">
        <ErrorBanner error={stock.error} onRetry={stock.reload} />
        {stock.loading && !stock.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={stock.data || []}
            empty="No stock records"
            columns={[
              { key: 'pharmacy', header: 'Pharmacy' },
              { key: 'partner', header: 'Type', render: (r) => (r.partner ? 'Partner' : 'Primary') },
              { key: 'medication', header: 'Medication' },
              { key: 'quantity', header: 'Quantity', render: (r) => <span className={`tabular-nums ${r.quantity === 0 ? 'font-semibold text-red-600' : ''}`}>{r.quantity}</span> },
              { key: 'state', header: '', render: (r) => <StatusBadge value={r.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'} /> },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
