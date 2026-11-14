import { TaskForm, RadioGroup, TextArea } from './FormKit.jsx';
import { validateHealthAssessment } from './validation.js';
import { Field } from '../components/Ui.jsx';
import { Notice, CLINICAL_DISCLAIMER } from '../components/Feedback.jsx';

export function toHealthVariables(v) {
  if (v.visitStatus === 'INCOMPLETE') return { visitStatus: 'INCOMPLETE', nurseNotes: v.nurseNotes.trim() };
  return {
    visitStatus: 'COMPLETED',
    painScore: Number(v.painScore),
    temperature: Number(v.temperature),
    woundRedness: !!v.woundRedness,
    woundDischarge: !!v.woundDischarge,
    swelling: !!v.swelling,
    nurseNotes: v.nurseNotes?.trim() || null,
  };
}

export default function HealthAssessmentForm({ onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ visitStatus: 'COMPLETED', painScore: 2, temperature: 37.0, woundRedness: false, woundDischarge: false, swelling: false, nurseNotes: '' }}
      validate={validateHealthAssessment}
      toVariables={toHealthVariables}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          <Notice kind="warning">{CLINICAL_DISCLAIMER}</Notice>
          <RadioGroup name="visitStatus" label="Visit status *" options={['COMPLETED', 'INCOMPLETE']} value={v.visitStatus} onChange={(x) => set('visitStatus', x)} error={e.visitStatus} />
          {v.visitStatus === 'COMPLETED' && (
            <>
              <Field label="Pain score (0-10) *" htmlFor="ha-pain" error={e.painScore}>
                <div className="flex items-center gap-3">
                  <input aria-label="Pain score slider" type="range" min={0} max={10} step={1} className="flex-1 accent-brand-700" value={v.painScore === '' ? 0 : v.painScore} onChange={(ev) => set('painScore', Number(ev.target.value))} />
                  <input id="ha-pain" type="number" min={0} max={10} step={1} className="input w-20" value={v.painScore} onChange={(ev) => set('painScore', ev.target.value === '' ? '' : Number(ev.target.value))} />
                </div>
              </Field>
              <Field label="Temperature (°C, 34-43) *" htmlFor="ha-temp" error={e.temperature}>
                <input id="ha-temp" type="number" min={34} max={43} step={0.1} className="input w-32" value={v.temperature} onChange={(ev) => set('temperature', ev.target.value === '' ? '' : Number(ev.target.value))} />
              </Field>
              <fieldset>
                <legend className="label">Infection indicators</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    ['woundRedness', 'Wound redness'],
                    ['woundDischarge', 'Wound discharge'],
                    ['swelling', 'Swelling'],
                  ].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={!!v[k]} onChange={(ev) => set(k, ev.target.checked)} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <TextArea id="ha-notes" label={v.visitStatus === 'INCOMPLETE' ? 'Nurse notes * (why is the visit incomplete?)' : 'Nurse notes'} value={v.nurseNotes} onChange={(x) => set('nurseNotes', x)} error={e.nurseNotes} />
        </>
      )}
    </TaskForm>
  );
}
