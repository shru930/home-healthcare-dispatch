import { TaskForm, RadioGroup, TextArea } from './FormKit.jsx';
import { validatePhysioSession } from './validation.js';

export default function PhysioSessionForm({ onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ physioStatus: 'COMPLETED', physioNotes: '' }}
      validate={validatePhysioSession}
      toVariables={(v) => ({ physioStatus: v.physioStatus, physioNotes: v.physioNotes.trim() || null })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          <RadioGroup name="physioStatus" label="Session outcome *" options={['COMPLETED', 'PATIENT_DECLINED']} value={v.physioStatus} onChange={(x) => set('physioStatus', x)} error={e.physioStatus} />
          <TextArea id="ps-notes" label="Physiotherapy notes" value={v.physioNotes} onChange={(x) => set('physioNotes', x)} error={e.physioNotes} />
        </>
      )}
    </TaskForm>
  );
}
