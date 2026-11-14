import { TaskForm, TextInput } from './FormKit.jsx';
import { validateCorrectDischarge } from './validation.js';
import { asList, todayIso } from '../format.js';

export default function CorrectDischargeForm({ context = {}, onSubmit, submitting, disabled }) {
  const errors = asList(context.validationErrors);
  const dd = typeof context.dischargeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.dischargeDate) ? context.dischargeDate : todayIso();
  return (
    <TaskForm
      initial={{ patientPhone: context.patientPhone || '', familyPhone: context.familyPhone || '', familyEmail: context.familyEmail || '', dischargeDate: dd }}
      validate={validateCorrectDischarge}
      toVariables={(v) => ({ patientPhone: v.patientPhone.trim(), familyPhone: v.familyPhone.trim(), familyEmail: v.familyEmail.trim(), dischargeDate: v.dischargeDate.trim() })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Validation errors found by the workflow</p>
              <ul className="mt-1 list-inside list-disc">{errors.map((x, i) => <li key={i}>{typeof x === 'object' ? JSON.stringify(x) : x}</li>)}</ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput id="cd-pphone" label="Patient phone (10 digits) *" inputMode="numeric" maxLength={10} value={v.patientPhone} onChange={(x) => set('patientPhone', x)} error={e.patientPhone} />
            <TextInput id="cd-fphone" label="Family phone (10 digits) *" inputMode="numeric" maxLength={10} value={v.familyPhone} onChange={(x) => set('familyPhone', x)} error={e.familyPhone} />
            <TextInput id="cd-femail" label="Family e-mail *" type="email" value={v.familyEmail} onChange={(x) => set('familyEmail', x)} error={e.familyEmail} />
            <TextInput id="cd-date" label="Discharge date (YYYY-MM-DD) *" type="date" value={v.dischargeDate} onChange={(x) => set('dischargeDate', x)} error={e.dischargeDate} />
          </div>
        </>
      )}
    </TaskForm>
  );
}
