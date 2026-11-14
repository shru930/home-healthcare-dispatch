import { useState } from 'react';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, Notice } from '../components/Feedback.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { humanize } from '../format.js';

const DESCRIPTIONS = {
  DISTANCE_API: 'Distance Matrix API used for nurse matching. Failures fall back to straight-line distance.',
  SMS_GATEWAY: 'Mock SMS gateway called by the SMS connector.',
  EMAIL_SERVER: 'Embedded SMTP server used by the e-mail connector (DOWN stops it).',
  COURIER: 'Courier service used for medication delivery dispatch.',
  EMERGENCY_DISPATCH: 'Emergency dispatch service for critical-risk escalation.',
  NURSE_POOL: 'Nurse search result (EMPTY / FAR_AWAY trigger manual nurse assignment).',
};

export default function Demo() {
  const faults = useApi(api.faults, []);
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [state, setState] = useState(null);
  const data = state || faults.data;

  const change = async (fault, mode) => {
    setBusy(fault);
    try {
      setState(await api.setFault(fault, mode));
      toast.success(`${fault} set to ${mode}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy('reset');
    try {
      setState(await api.resetFaults());
      toast.success('All faults reset to OK');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo controls"
        subtitle="Fault injection for demonstrating exception paths"
        actions={<button type="button" className="btn-danger" disabled={busy === 'reset' || !data} onClick={reset}>Reset all faults</button>}
      />
      <Notice kind="warning" title="Fault injection for demonstrating exception paths">
        Switch an external dependency into a failure mode, then start or continue a workflow to see the BPMN error boundaries, retries,
        incidents and manual fallback tasks. Settings are held in memory by the backend.
      </Notice>
      <ErrorBanner error={faults.error} onRetry={faults.reload} />
      {faults.loading && !data ? (
        <Spinner />
      ) : (
        data && (
          <>
            <Section title="Embedded SMTP server">
              <StatusBadge value={data.smtpServerRunning ? 'OK' : 'DOWN'} label={data.smtpServerRunning ? 'running' : 'stopped'} />
            </Section>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(data.modes || {}).map(([fault, modes]) => {
                const active = data.active?.[fault];
                return (
                  <div key={fault} className="card p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-stone-800">{humanize(fault)}</h3>
                      <StatusBadge value={active === 'OK' ? 'OK' : 'FAILED'} label={active} />
                    </div>
                    <p className="mb-3 text-xs text-stone-500">{DESCRIPTIONS[fault] || fault}</p>
                    <label htmlFor={`fault-${fault}`} className="label">Mode</label>
                    <select id={`fault-${fault}`} className="input" value={active || ''} disabled={busy === fault} onChange={(e) => change(fault, e.target.value)}>
                      {modes.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}
