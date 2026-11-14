import { TaskForm, RadioGroup, TextArea } from './FormKit.jsx';
import { validateManualEmergency } from './validation.js';
import { Notice } from '../components/Feedback.jsx';

export default function ManualEmergencyForm({ context = {}, onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ emergencyOutcome: '', emergencyNotes: '' }}
      validate={validateManualEmergency}
      toVariables={(v) => ({ emergencyOutcome: v.emergencyOutcome, emergencyNotes: v.emergencyNotes.trim() })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          <Notice kind="danger" title="Automatic emergency dispatch failed">
            Coordinate the emergency response manually for {context.patientName || 'the patient'}
            {context.patientAddress ? ` at ${context.patientAddress}` : ''}
            {context.patientPhone ? ` (phone ${context.patientPhone})` : ''}.
          </Notice>
          <RadioGroup name="emergencyOutcome" label="Outcome *" options={['AMBULANCE_ARRANGED', 'HOSPITAL_CONTACTED', 'DOCTOR_ATTENDED']} value={v.emergencyOutcome} onChange={(x) => set('emergencyOutcome', x)} error={e.emergencyOutcome} />
          <TextArea id="me-notes" label="Emergency notes *" value={v.emergencyNotes} onChange={(x) => set('emergencyNotes', x)} error={e.emergencyNotes} />
        </>
      )}
    </TaskForm>
  );
}
