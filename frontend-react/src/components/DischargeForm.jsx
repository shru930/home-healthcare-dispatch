import { useState } from 'react';
import ArrayBuilder from './ArrayBuilder.jsx';
import { Field } from './Ui.jsx';
import { Notice } from './Feedback.jsx';
import { todayIso } from '../format.js';

export const SKILLS = ['WOUND_CARE', 'POST_OP', 'CARDIAC', 'ORTHO', 'IV_THERAPY', 'PAEDIATRIC'];
export const MEDICINES = ['Paracetamol 500mg', 'Amoxicillin 500mg', 'Pantoprazole 40mg', 'Enoxaparin 40mg', 'Tramadol 50mg', 'Ondansetron 4mg', 'Cefuroxime 500mg'];
export const TIMER_KEYS = ['visitWindow', 'physioWindow', 'doctorReviewReminder', 'interventionTimeout', 'deliveryReminder', 'deliveryTimeout', 'nurseRetryWait'];
const ISO_DURATION = /^P(?!$)(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PHYSIO_FIELDS = [
  { name: 'dayNumber', label: 'Day (1-7)', type: 'select', numeric: true, options: [1, 2, 3, 4, 5, 6, 7], width: 'w-24' },
  { name: 'focus', label: 'Focus', placeholder: 'e.g. Gait training' },
];
const RX_FIELDS = [
  { name: 'medication', label: 'Medication', list: 'medicine-list', placeholder: 'Paracetamol 500mg' },
  { name: 'dosage', label: 'Dosage', placeholder: '1 tab twice daily' },
  { name: 'quantity', label: 'Qty', type: 'number', min: 1, max: 500, width: 'w-24' },
  { name: 'controlled', label: 'Controlled', type: 'checkbox' },
  { name: 'doctorApproved', label: 'Doctor approved', type: 'checkbox' },
];

export function validateDischarge(d) {
  const e = {};
  ['surgeryType', 'hospital', 'doctorName'].forEach((k) => {
    if (!String(d[k] ?? '').trim()) e[k] = 'Required';
  });
  if (!d.surgeryDate) e.surgeryDate = 'Required';
  if (!d.dischargeDate) e.dischargeDate = 'Required';
  if (d.surgeryDate && d.dischargeDate && d.surgeryDate > d.dischargeDate) e.dischargeDate = 'Must be on/after surgery date';
  if (!EMAIL.test(d.doctorEmail || '')) e.doctorEmail = 'Valid e-mail required';
  if (d.requiredSkill && !SKILLS.includes(d.requiredSkill)) e.requiredSkill = 'Invalid skill';
  d.physioSessions.forEach((s, i) => {
    const day = Number(s.dayNumber);
    if (!Number.isInteger(day) || day < 1 || day > 7) e[`physio.${i}.dayNumber`] = '1-7';
    if (!String(s.focus || '').trim()) e[`physio.${i}.focus`] = 'Required';
  });
  if (d.prescriptions.length === 0) e.prescriptions = 'At least one prescription is required';
  d.prescriptions.forEach((rx, i) => {
    if (!String(rx.medication || '').trim()) e[`rx.${i}.medication`] = 'Required';
    if (!String(rx.dosage || '').trim()) e[`rx.${i}.dosage`] = 'Required';
    const q = Number(rx.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 500) e[`rx.${i}.quantity`] = '1-500';
  });
  Object.entries(d.timerOverrides || {}).forEach(([k, v]) => {
    if (v && !ISO_DURATION.test(v.trim())) e[`timer.${k}`] = 'ISO-8601 duration, e.g. PT30S';
  });
  return e;
}

/** Splits the flat error map into the per-builder `{ "i.field": msg }` maps ArrayBuilder expects. */
function sub(errors, prefix) {
  const out = {};
  Object.entries(errors).forEach(([k, v]) => {
    if (k.startsWith(prefix + '.')) out[k.slice(prefix.length + 1)] = v;
  });
  return out;
}

export function buildDischargePayload(d) {
  const timers = {};
  Object.entries(d.timerOverrides || {}).forEach(([k, v]) => {
    if (v && v.trim()) timers[k] = v.trim();
  });
  return {
    surgeryType: d.surgeryType.trim(),
    surgeryDate: d.surgeryDate,
    dischargeDate: d.dischargeDate,
    hospital: d.hospital.trim(),
    doctorName: d.doctorName.trim(),
    doctorEmail: d.doctorEmail.trim(),
    requiredSkill: d.requiredSkill || null,
    physioSessions: d.physioSessions.map((s) => ({ dayNumber: Number(s.dayNumber), focus: s.focus.trim() })),
    prescriptions: d.prescriptions.map((rx) => ({
      medication: rx.medication.trim(),
      dosage: rx.dosage.trim(),
      quantity: Number(rx.quantity),
      controlled: !!rx.controlled,
      doctorApproved: !!rx.doctorApproved,
    })),
    ...(Object.keys(timers).length ? { timerOverrides: timers } : {}),
  };
}

export default function DischargeForm({ patient, onSubmit, submitting, onCancel }) {
  const [d, setD] = useState({
    surgeryType: patient?.surgeryType || '',
    surgeryDate: '',
    dischargeDate: todayIso(),
    hospital: patient?.hospital || '',
    doctorName: patient?.doctorName || '',
    doctorEmail: patient?.doctorEmail || '',
    requiredSkill: 'WOUND_CARE',
    physioSessions: [],
    prescriptions: [{ medication: '', dosage: '', quantity: 10, controlled: false, doctorApproved: true }],
    timerOverrides: {},
  });
  const [errors, setErrors] = useState({});
  const [showTimers, setShowTimers] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const fillSample = () => {
    const today = todayIso();
    const sd = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    setD({
      ...d,
      surgeryType: 'Total knee replacement',
      surgeryDate: sd,
      dischargeDate: today,
      hospital: 'Apollo Hospitals, Greams Road',
      doctorName: 'Dr. Ramesh Kumar',
      doctorEmail: 'dr.ramesh@example.com',
      requiredSkill: 'WOUND_CARE',
      physioSessions: [
        { dayNumber: 2, focus: 'Knee range of motion' },
        { dayNumber: 4, focus: 'Gait training with walker' },
        { dayNumber: 6, focus: 'Stair climbing' },
      ],
      prescriptions: [
        { medication: 'Paracetamol 500mg', dosage: '1 tab every 6 h', quantity: 20, controlled: false, doctorApproved: true },
        { medication: 'Pantoprazole 40mg', dosage: '1 tab before breakfast', quantity: 7, controlled: false, doctorApproved: true },
        { medication: 'Enoxaparin 40mg', dosage: '1 injection daily', quantity: 7, controlled: false, doctorApproved: true },
      ],
    });
    setErrors({});
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validateDischarge(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(buildDischargePayload(d));
  };

  const input = (k, label, props = {}) => (
    <Field label={label} htmlFor={`df-${k}`} error={errors[k]}>
      <input id={`df-${k}`} className="input" value={d[k]} onChange={set(k)} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          Patient: <span className="font-semibold">{patient?.name}</span> <span className="text-stone-400">({patient?.mrn})</span>
        </p>
        <button type="button" className="btn-secondary" onClick={fillSample}>
          Fill sample data
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {input('surgeryType', 'Surgery type *')}
        {input('surgeryDate', 'Surgery date *', { type: 'date' })}
        {input('dischargeDate', 'Discharge date *', { type: 'date' })}
        {input('hospital', 'Hospital *')}
        {input('doctorName', 'Doctor name *')}
        {input('doctorEmail', 'Doctor e-mail *', { type: 'email' })}
        <Field label="Required nurse skill" htmlFor="df-requiredSkill" error={errors.requiredSkill}>
          <select id="df-requiredSkill" className="input" value={d.requiredSkill} onChange={set('requiredSkill')}>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Notice kind="info" title="Camunda multi-instance input collections">
        The rows below are sent as the <code>physioSessions</code> and <code>prescriptions</code> arrays. The process uses them as
        multi-instance input collections: one physiotherapy session instance per row, and one pharmacy fulfilment child process per prescription.
      </Notice>

      <ArrayBuilder
        label="Physiotherapy sessions"
        fields={PHYSIO_FIELDS}
        value={d.physioSessions}
        onChange={(v) => setD({ ...d, physioSessions: v })}
        newItem={(n) => ({ dayNumber: Math.min(7, 2 + n * 2), focus: '' })}
        addLabel="Add session"
        maxItems={7}
        errors={sub(errors, 'physio')}
        hint="Optional. Each session is scheduled on the given day of the 7-day plan."
      />
      <ArrayBuilder
        label="Prescriptions"
        fields={RX_FIELDS}
        value={d.prescriptions}
        onChange={(v) => setD({ ...d, prescriptions: v })}
        newItem={() => ({ medication: '', dosage: '', quantity: 10, controlled: false, doctorApproved: true })}
        addLabel="Add prescription"
        errors={sub(errors, 'rx')}
        hint="At least one. Controlled drugs without doctor approval are held by the pharmacy process."
      />
      {errors.prescriptions && <p className="field-error">{errors.prescriptions}</p>}
      <datalist id="medicine-list">
        {MEDICINES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="rounded-lg border border-stone-200">
        <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-stone-700" onClick={() => setShowTimers(!showTimers)} aria-expanded={showTimers}>
          Demo timers (optional)
          <span className="text-stone-400">{showTimers ? '−' : '+'}</span>
        </button>
        {showTimers && (
          <div className="border-t border-stone-200 p-3">
            <p className="mb-2 text-xs text-stone-500">
              Sent as <code>timerOverrides</code> (demo mode only). ISO-8601 durations like <code>PT30S</code> or <code>PT2M</code>; empty fields keep the server default.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {TIMER_KEYS.map((k) => (
                <Field key={k} label={k} htmlFor={`tm-${k}`} error={errors[`timer.${k}`]}>
                  <input
                    id={`tm-${k}`}
                    className="input font-mono"
                    placeholder="PT30S"
                    value={d.timerOverrides[k] || ''}
                    onChange={(e) => setD({ ...d, timerOverrides: { ...d.timerOverrides, [k]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Starting workflow...' : 'Discharge & start 7-day plan'}
        </button>
      </div>
    </form>
  );
}
