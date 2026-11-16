import { useState } from 'react';
import { KeyValue } from '../components/Ui.jsx';
import { TextArea } from './FormKit.jsx';
import { validateApprovePlan } from './validation.js';
import { asList, fmtDate } from '../format.js';

/**
 * Task_ApprovePlan (candidate group "admins"): the admin reviews a discharge request from ward staff
 * and approves or rejects the 7-day home-care plan.
 * Completes with { approvalDecision: 'APPROVED' | 'REJECTED', approvalNotes }.
 */
export default function ApprovePlanForm({ context = {}, onSubmit, submitting, disabled }) {
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const prescriptions = asList(context.prescriptions);
  const sessions = asList(context.physioSessions);

  const decide = (approvalDecision) => {
    const values = { approvalDecision, approvalNotes: notes };
    const errs = validateApprovePlan(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit({ approvalDecision, approvalNotes: notes.trim() || null });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <KeyValue
          items={[
            ['Patient', context.patientName ? `${context.patientName}${context.patientMrn ? ` (${context.patientMrn})` : ''}` : '-'],
            ['Address', context.patientAddress],
            ['Surgery', context.surgeryType],
            ['Discharge date', context.dischargeDate ? fmtDate(context.dischargeDate) : '-'],
            ['Doctor', context.doctorName],
            ['Family contact', context.familyContactName ? `${context.familyContactName}${context.familyPhone ? ` · ${context.familyPhone}` : ''}` : '-'],
            ['Requested by', context.requestedBy],
          ]}
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-800">Prescriptions ({prescriptions.length})</h3>
        {prescriptions.length === 0 ? (
          <p className="text-sm text-stone-500">No prescriptions in this request.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Medication</th>
                  <th className="px-3 py-2 font-medium">Dosage</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Controlled</th>
                  <th className="px-3 py-2 font-medium">Doctor approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {prescriptions.map((p, i) => (
                  <tr key={`${p.medication}-${i}`}>
                    <td className="px-3 py-2 font-medium text-stone-800">{p.medication}</td>
                    <td className="px-3 py-2">{p.dosage || '-'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.quantity ?? '-'}</td>
                    <td className="px-3 py-2">{p.controlled ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{p.doctorApproved ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-800">Physiotherapy sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-stone-500">No physiotherapy sessions in this request.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
            {sessions.map((s, i) => (
              <li key={`${s.dayNumber}-${i}`} className="px-3 py-2">
                <span className="font-medium text-stone-800">Day {s.dayNumber}</span> · {s.focus || '-'}
              </li>
            ))}
          </ul>
        )}
      </div>

      <TextArea
        id="approval-notes"
        label="Notes (required when rejecting)"
        value={notes}
        onChange={(x) => setNotes(x)}
        error={errors.approvalNotes}
      />
      {errors.approvalDecision && <p className="field-error">{errors.approvalDecision}</p>}

      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4">
        <button type="button" className="btn-primary py-3 text-base" disabled={submitting || disabled} onClick={() => decide('APPROVED')}>
          {submitting ? 'Saving...' : 'Approve'}
        </button>
        <button type="button" className="btn-danger py-3 text-base" disabled={submitting || disabled} onClick={() => decide('REJECTED')}>
          {submitting ? 'Saving...' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
