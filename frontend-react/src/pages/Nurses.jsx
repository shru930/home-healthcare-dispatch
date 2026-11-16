import { useState } from 'react';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { asList, fmtDateTime, km, minutes } from '../format.js';
import { useAuth } from '../auth.jsx';

const SOURCE_LABEL = {
  DISTANCE_MATRIX_API: 'Distance Matrix API',
  FALLBACK_STRAIGHT_LINE: 'Fallback (straight line)',
  MANUAL: 'Manual',
};

export function SourceBadge({ source }) {
  const tone = source === 'DISTANCE_MATRIX_API' ? 'COMPLETED' : source === 'FALLBACK_STRAIGHT_LINE' ? 'DELAYED' : 'MANUAL';
  return <StatusBadge value={tone} label={SOURCE_LABEL[source] || source || '-'} />;
}

export default function Nurses() {
  const nurses = useApi(api.nurses, [], { intervalMs: 15000 });
  const assignments = useApi(api.assignments, [], { intervalMs: 15000 });
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const { isAdmin } = useAuth();

  const toggle = async (n) => {
    setBusy(n.id);
    try {
      await api.setNurseAvailability(n.id, !n.available);
      toast.success(`${n.fullName} is now ${!n.available ? 'available' : 'unavailable'}`);
      nurses.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Nurses" subtitle={isAdmin ? 'Nurse pool, availability and distance-based assignments' : 'Nurse pool and assignments (availability is changed by an admin)'} />
      <Section title="Nurse pool">
        <ErrorBanner error={nurses.error} onRetry={nurses.reload} />
        {nurses.loading && !nurses.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={nurses.data || []}
            empty="No nurses"
            columns={[
              { key: 'fullName', header: 'Nurse', render: (r) => <div><p className="font-medium">{r.fullName}</p><p className="font-mono text-xs text-stone-400">{r.username}</p></div> },
              { key: 'phone', header: 'Phone' },
              { key: 'skills', header: 'Skills', render: (r) => <div className="flex flex-wrap gap-1">{asList(r.skills).map((s) => <span key={s} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{s}</span>)}</div> },
              { key: 'baseArea', header: 'Base area' },
              {
                key: 'load',
                header: 'Load',
                render: (r) => {
                  const pct = r.maxPatients ? Math.min(100, (100 * r.currentPatients) / r.maxPatients) : 0;
                  return (
                    <div className="w-28">
                      <p className="text-xs tabular-nums">{r.currentPatients}/{r.maxPatients} patients</p>
                      <div className="mt-1 h-1.5 rounded bg-stone-100"><div className={`h-1.5 rounded ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                },
              },
              {
                key: 'available',
                header: 'Available',
                // Only ADMIN can change availability; USER sees a read-only badge.
                render: (r) => !isAdmin ? (
                  <StatusBadge value={r.available ? 'AVAILABLE' : 'CANCELED'} label={r.available ? 'Available' : 'Unavailable'} />
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!r.available}
                    aria-label={`Toggle availability of ${r.fullName}`}
                    disabled={busy === r.id}
                    onClick={() => toggle(r)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${r.available ? 'bg-brand-600' : 'bg-stone-300'} disabled:opacity-50`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${r.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                ),
              },
            ]}
          />
        )}
      </Section>
      <Section title="Assignments">
        <ErrorBanner error={assignments.error} onRetry={assignments.reload} />
        {assignments.loading && !assignments.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={assignments.data || []}
            empty="No assignments yet"
            emptyHint="The workflow assigns the nearest suitable nurse after discharge."
            columns={[
              { key: 'patientName', header: 'Patient' },
              { key: 'nurseName', header: 'Nurse' },
              { key: 'distance', header: 'Distance (km)', render: (r) => <span className="tabular-nums">{km(r.distanceMeters)}</span> },
              { key: 'travel', header: 'Travel (min)', render: (r) => <span className="tabular-nums">{minutes(r.travelSeconds)}</span> },
              { key: 'distanceSource', header: 'Distance source', render: (r) => <SourceBadge source={r.distanceSource} /> },
              { key: 'assignmentMode', header: 'Mode', render: (r) => <StatusBadge value={r.assignmentMode} /> },
              { key: 'note', header: 'Note', render: (r) => <span className="text-xs">{r.note || '-'}</span> },
              { key: 'assignedAt', header: 'Assigned', render: (r) => fmtDateTime(r.assignedAt) },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
