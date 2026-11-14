import { TaskForm, TextArea } from './FormKit.jsx';
import { validateManualNurse } from './validation.js';
import { Field } from '../components/Ui.jsx';
import { km, minutes } from '../format.js';

function DistanceTable({ data }) {
  if (data == null) return null;
  const rows = Array.isArray(data) ? data : typeof data === 'object' ? Object.entries(data).map(([k, v]) => ({ nurse: k, ...(typeof v === 'object' ? v : { value: v }) })) : null;
  if (!rows || rows.length === 0) return <p className="text-xs text-stone-500">{Array.isArray(data) ? 'No distances computed.' : String(data)}</p>;
  if (rows.every((r) => r && typeof r === 'object' && ('distanceMeters' in r || 'travelSeconds' in r))) {
    return (
      <div className="overflow-x-auto rounded border border-stone-200">
        <table className="min-w-full text-xs">
          <thead className="bg-stone-50">
            <tr>{['Nurse', 'Distance (km)', 'Travel (min)', 'Status'].map((c) => <th key={c} className="px-2 py-1 text-left font-semibold text-stone-500">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.nurseId ?? i} className="border-t border-stone-100">
                <td className="px-2 py-1">{r.fullName || r.username || r.nurseId}</td>
                <td className="px-2 py-1 tabular-nums">{km(r.distanceMeters)}</td>
                <td className="px-2 py-1 tabular-nums">{minutes(r.travelSeconds)}</td>
                <td className="px-2 py-1">{r.status ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const cols = [...new Set(rows.flatMap((r) => (typeof r === 'object' ? Object.keys(r) : [])))];
  if (cols.length === 0) return <p className="text-xs text-stone-500">{rows.join(', ')}</p>;
  return (
    <div className="overflow-x-auto rounded border border-stone-200">
      <table className="min-w-full text-xs">
        <thead className="bg-stone-50">
          <tr>{cols.map((c) => <th key={c} className="px-2 py-1 text-left font-semibold text-stone-500">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-100">
              {cols.map((c) => <td key={c} className="px-2 py-1">{r[c] == null ? '-' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManualNurseForm({ context = {}, nurses = [], onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ selectedNurseId: '', manualAssignmentNote: '' }}
      validate={validateManualNurse}
      toVariables={(v) => ({ selectedNurseId: Number(v.selectedNurseId), manualAssignmentNote: v.manualAssignmentNote.trim() })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          {context.nurseDistances != null && (
            <div>
              <p className="label">Nurse distances computed by the workflow</p>
              <DistanceTable data={context.nurseDistances} />
            </div>
          )}
          <Field label="Nurse *" htmlFor="mn-nurse" error={e.selectedNurseId}>
            <select id="mn-nurse" className="input" value={v.selectedNurseId} onChange={(ev) => set('selectedNurseId', ev.target.value)}>
              <option value="">Select a nurse...</option>
              {nurses.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.fullName} · {n.baseArea} · {n.skills} · {n.currentPatients}/{n.maxPatients}
                  {n.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
          </Field>
          <TextArea id="mn-note" label="Manual assignment note *" value={v.manualAssignmentNote} onChange={(x) => set('manualAssignmentNote', x)} error={e.manualAssignmentNote} />
        </>
      )}
    </TaskForm>
  );
}
