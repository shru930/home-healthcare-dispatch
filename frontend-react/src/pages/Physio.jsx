import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section, Modal, Field } from '../components/Ui.jsx';
import { Spinner, ErrorBanner } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDate } from '../format.js';

const PHYSIOTHERAPISTS = ['physio.rahul', 'physio.meena'];

function RescheduleForm({ appt, onDone, onCancel }) {
  const [f, setF] = useState({ appointmentDate: appt.appointmentDate || '', physiotherapist: appt.physiotherapist || '', notes: appt.notes || '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!f.appointmentDate) {
      setError('Appointment date is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updatePhysio(appt.id, { appointmentDate: f.appointmentDate, physiotherapist: f.physiotherapist || null, notes: f.notes });
      toast.success(`Session ${appt.sessionNo} for ${appt.patientName} updated`);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <ErrorBanner error={error} />
      <Field label="Appointment date *" htmlFor="ph-date">
        <input id="ph-date" type="date" className="input" value={f.appointmentDate} onChange={(e) => setF({ ...f, appointmentDate: e.target.value })} />
      </Field>
      <Field label="Physiotherapist" htmlFor="ph-who" hint="Updates the appointment record only; an already-open Camunda task keeps its current assignee.">
        <input id="ph-who" className="input" list="physio-list" value={f.physiotherapist} onChange={(e) => setF({ ...f, physiotherapist: e.target.value })} />
        <datalist id="physio-list">
          {PHYSIOTHERAPISTS.map((p) => <option key={p} value={p} />)}
        </datalist>
      </Field>
      <Field label="Notes" htmlFor="ph-notes">
        <textarea id="ph-notes" rows={3} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function Physio() {
  const list = useApi(api.physio, [], { intervalMs: 10000 });
  const [editing, setEditing] = useState(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physiotherapy"
        subtitle="Sessions created from the physioSessions multi-instance collection"
        actions={<Link to="/tasks" className="btn-secondary">Record session outcome (Tasklist)</Link>}
      />
      <Section title="Appointments">
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={list.data || []}
            empty="No physiotherapy sessions"
            emptyHint="Add physiotherapy sessions when discharging a patient."
            columns={[
              { key: 'patientName', header: 'Patient' },
              { key: 'sessionNo', header: 'Session', render: (r) => `#${r.sessionNo} (day ${r.dayNumber})` },
              { key: 'appointmentDate', header: 'Date', render: (r) => fmtDate(r.appointmentDate) },
              { key: 'focus', header: 'Focus' },
              { key: 'physiotherapist', header: 'Physiotherapist', render: (r) => <span className="font-mono text-xs">{r.physiotherapist || '-'}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'notes', header: 'Notes', render: (r) => <span className="text-xs">{r.notes || '-'}</span> },
              { key: 'actions', header: '', render: (r) => <button type="button" className="btn-secondary" onClick={() => setEditing(r)}>Reschedule</button> },
            ]}
          />
        )}
      </Section>
      {editing && (
        <Modal title={`Reschedule session #${editing.sessionNo} · ${editing.patientName}`} onClose={() => setEditing(null)}>
          <RescheduleForm appt={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); list.reload(); }} />
        </Modal>
      )}
    </div>
  );
}
