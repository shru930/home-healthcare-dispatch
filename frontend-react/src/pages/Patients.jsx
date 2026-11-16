import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section, Modal } from '../components/Ui.jsx';
import { Spinner, ErrorBanner } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PatientForm from '../components/PatientForm.jsx';
import DischargeForm from '../components/DischargeForm.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDate } from '../format.js';
import { useAuth } from '../auth.jsx';

export default function Patients() {
  const list = useApi(api.patients, []);
  const wfs = useApi(api.workflows, []);
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  // USER submits a request that an admin approves; ADMIN starts the plan directly (same API call).
  const dischargeLabel = isAdmin ? 'Discharge & start 7-day plan' : 'Submit discharge request';
  const [showRegister, setShowRegister] = useState(false);
  const [dischargeFor, setDischargeFor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const workflowOf = (patientId) => (wfs.data || []).find((w) => w.patientId === patientId && w.processInstanceKey);

  const register = async (body) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const p = await api.registerPatient(body);
      toast.success(`Patient ${p.name} (${p.mrn}) registered`);
      setShowRegister(false);
      list.reload();
    } catch (e) {
      setFormError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const discharge = async (body) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.discharge(dischargeFor.id, body);
      if (isAdmin) toast.success(`7-day plan started. Process instance ${res.processInstanceKey} (${res.currentStage || res.status})`);
      else toast.success('Request sent to admin for approval');
      setDischargeFor(null);
      navigate(`/tracker/${res.processInstanceKey}`);
    } catch (e) {
      setFormError(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        subtitle="Register patients and discharge them into the 7-day post-operative home-care workflow"
        actions={
          <button type="button" className="btn-primary" onClick={() => { setFormError(null); setShowRegister(true); }}>
            Register patient
          </button>
        }
      />
      <Section title="Patient register">
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={list.data || []}
            empty="No patients registered"
            emptyHint='Use "Register patient" to add one.'
            columns={[
              { key: 'mrn', header: 'MRN', render: (r) => <span className="font-mono text-xs">{r.mrn}</span> },
              { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'phone', header: 'Phone' },
              { key: 'address', header: 'Address', render: (r) => <span className="text-xs">{[r.addressLine, r.city].filter(Boolean).join(', ')}</span> },
              { key: 'family', header: 'Family contact', render: (r) => <span className="text-xs">{r.familyContactName} ({r.familyContactPhone})</span> },
              { key: 'surgery', header: 'Surgery', render: (r) => (r.surgeryType ? <span className="text-xs">{r.surgeryType} · discharged {fmtDate(r.dischargeDate)}</span> : '-') },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              {
                key: 'actions',
                header: '',
                render: (r) => {
                  const wf = workflowOf(r.id);
                  return (
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.status !== 'IN_CARE' && (
                        <button type="button" className="btn-primary whitespace-nowrap" onClick={() => { setFormError(null); setDischargeFor(r); }}>
                          {dischargeLabel}
                        </button>
                      )}
                      {wf && (
                        <Link to={`/tracker/${wf.processInstanceKey}`} className="btn-secondary whitespace-nowrap">
                          Tracker
                        </Link>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </Section>

      {showRegister && (
        <Modal title="Register patient" onClose={() => setShowRegister(false)} wide>
          <div className="mb-3">
            <ErrorBanner error={formError} />
          </div>
          <PatientForm onSubmit={register} submitting={submitting} onCancel={() => setShowRegister(false)} />
        </Modal>
      )}
      {dischargeFor && (
        <Modal title={isAdmin ? 'Discharge & start 7-day home-care plan' : 'Submit discharge request'} onClose={() => setDischargeFor(null)} wide>
          <div className="mb-3">
            <ErrorBanner error={formError} />
          </div>
          <DischargeForm patient={dischargeFor} submitLabel={dischargeLabel} onSubmit={discharge} submitting={submitting} onCancel={() => setDischargeFor(null)} />
        </Modal>
      )}
    </div>
  );
}
