import { useState } from 'react';
import { Field } from '../components/Ui.jsx';

/**
 * Shared state/validation wrapper for task forms.
 * Renders children(values, set, errors) and calls onSubmit(variables) when validation passes.
 */
export function TaskForm({ initial, validate, toVariables = (v) => v, onSubmit, submitting, submitLabel = 'Complete task', disabled, children }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit(toVariables(values));
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {children(values, set, errors)}
      <div className="flex justify-end border-t border-stone-100 pt-4">
        <button type="submit" className="btn-primary" disabled={submitting || disabled}>
          {submitting ? 'Completing...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function RadioGroup({ name, label, options, value, onChange, error }) {
  return (
    <Field label={label} error={error}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const lbl = typeof o === 'object' ? o.label : o.replace(/_/g, ' ');
          const checked = value === val;
          return (
            <label key={val} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${checked ? 'border-brand-600 bg-brand-50 font-medium text-brand-800' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}>
              <input type="radio" className="sr-only" name={name} value={val} checked={checked} onChange={() => onChange(val)} />
              {lbl}
            </label>
          );
        })}
      </div>
    </Field>
  );
}

export function TextArea({ id, label, value, onChange, error, rows = 3, placeholder }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <textarea id={id} rows={rows} className="input" placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextInput({ id, label, value, onChange, error, ...props }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
    </Field>
  );
}
