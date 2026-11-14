import { TaskForm, RadioGroup, TextArea } from './FormKit.jsx';
import { validateDoctorReview } from './validation.js';
import { KeyValue } from '../components/Ui.jsx';
import { Notice, CLINICAL_DISCLAIMER } from '../components/Feedback.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { asList } from '../format.js';

export default function DoctorReviewForm({ context = {}, onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ doctorDecision: '', doctorNotes: '' }}
      validate={validateDoctorReview}
      toVariables={(v) => ({ doctorDecision: v.doctorDecision, doctorNotes: v.doctorNotes.trim() })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <KeyValue
              items={[
                ['Risk level', <StatusBadge value={context.riskLevel} />],
                ['Pain score', context.painScore ?? '-'],
                ['Temperature', context.temperature != null ? `${context.temperature} °C` : '-'],
                ['Nurse notes', context.nurseNotes || '-'],
              ]}
            />
            {asList(context.riskReasons).length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-stone-700">
                {asList(context.riskReasons).map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>
          <Notice kind="warning">{CLINICAL_DISCLAIMER}</Notice>
          <RadioGroup name="doctorDecision" label="Decision *" options={['HOME_CARE', 'URGENT_VISIT', 'READMIT']} value={v.doctorDecision} onChange={(x) => set('doctorDecision', x)} error={e.doctorDecision} />
          <TextArea id="dr-notes" label="Doctor notes *" value={v.doctorNotes} onChange={(x) => set('doctorNotes', x)} error={e.doctorNotes} />
        </>
      )}
    </TaskForm>
  );
}
