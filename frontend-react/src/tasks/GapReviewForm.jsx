import { TaskForm, RadioGroup, TextArea } from './FormKit.jsx';
import { validateGapReview } from './validation.js';

function Summary({ value }) {
  if (value == null) return <p className="text-sm text-stone-500">No plan summary available.</p>;
  if (typeof value === 'string') return <p className="whitespace-pre-wrap text-sm text-stone-700">{value}</p>;
  return <pre className="max-h-64 overflow-auto rounded bg-stone-900 p-3 text-xs text-stone-100">{JSON.stringify(value, null, 2)}</pre>;
}

export default function GapReviewForm({ context = {}, onSubmit, submitting, disabled }) {
  return (
    <TaskForm
      initial={{ gapReviewDecision: '', reviewNotes: '' }}
      validate={validateGapReview}
      toVariables={(v) => ({ gapReviewDecision: v.gapReviewDecision, reviewNotes: v.reviewNotes.trim() })}
      onSubmit={onSubmit}
      submitting={submitting}
      disabled={disabled}
    >
      {(v, set, e) => (
        <>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="label">Plan summary{context.gapCount != null ? ` · ${context.gapCount} gap(s)` : ''}</p>
            <Summary value={context.planSummary} />
          </div>
          <RadioGroup name="gapReviewDecision" label="Decision *" options={['ACCEPT_AND_CLOSE', 'FOLLOW_UP_BOOKED']} value={v.gapReviewDecision} onChange={(x) => set('gapReviewDecision', x)} error={e.gapReviewDecision} />
          <TextArea id="gr-notes" label="Review notes *" value={v.reviewNotes} onChange={(x) => set('reviewNotes', x)} error={e.reviewNotes} />
        </>
      )}
    </TaskForm>
  );
}
