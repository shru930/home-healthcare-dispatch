/**
 * Dynamic array item builder: renders one row of fields per item with add/remove controls.
 *
 * fields: [{ name, label, type: 'text'|'number'|'checkbox'|'select', options?, min?, max?, list?, placeholder?, width? }]
 * value: array of item objects; onChange(newArray); newItem(): template for added rows.
 */
export default function ArrayBuilder({ label, fields, value = [], onChange, newItem, addLabel = 'Add item', minItems = 0, maxItems = 50, errors = {}, hint }) {
  const update = (index, name, v) => {
    const next = value.map((item, i) => (i === index ? { ...item, [name]: v } : item));
    onChange(next);
  };
  const add = () => {
    if (value.length >= maxItems) return;
    onChange([...value, typeof newItem === 'function' ? newItem(value.length) : { ...(newItem || {}) }]);
  };
  const remove = (index) => {
    if (value.length <= minItems) return;
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="rounded-lg border border-stone-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-stone-700">
          {label} <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-500">{value.length}</span>
        </legend>
        <button type="button" className="btn-secondary" onClick={add} disabled={value.length >= maxItems}>
          + {addLabel}
        </button>
      </div>
      {hint && <p className="mb-2 text-xs text-stone-500">{hint}</p>}
      {value.length === 0 && <p className="py-2 text-xs italic text-stone-400">No items. Use "{addLabel}" to add one.</p>}
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} data-testid="array-row" className="flex flex-wrap items-end gap-2 rounded-md bg-stone-50 p-2">
            <span className="mb-1.5 w-6 text-xs font-semibold text-stone-400">#{i + 1}</span>
            {fields.map((f) => {
              const id = `${label}-${i}-${f.name}`.replace(/\s+/g, '-');
              const err = errors[`${i}.${f.name}`];
              if (f.type === 'checkbox') {
                return (
                  <label key={f.name} htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs text-stone-700">
                    <input id={id} type="checkbox" checked={!!item[f.name]} onChange={(e) => update(i, f.name, e.target.checked)} className="h-4 w-4 accent-brand-700" />
                    {f.label}
                  </label>
                );
              }
              return (
                <div key={f.name} className={f.width || 'min-w-[8rem] flex-1'}>
                  <label htmlFor={id} className="label">
                    {f.label}
                  </label>
                  {f.type === 'select' ? (
                    <select id={id} className="input" value={item[f.name] ?? ''} onChange={(e) => update(i, f.name, f.numeric ? Number(e.target.value) : e.target.value)}>
                      {f.options.map((o) => {
                        const ov = typeof o === 'object' ? o.value : o;
                        const ol = typeof o === 'object' ? o.label : o;
                        return (
                          <option key={ov} value={ov}>
                            {ol}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      id={id}
                      className="input"
                      type={f.type || 'text'}
                      min={f.min}
                      max={f.max}
                      list={f.list}
                      placeholder={f.placeholder}
                      value={item[f.name] ?? ''}
                      onChange={(e) => update(i, f.name, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                    />
                  )}
                  {err && <p className="field-error">{err}</p>}
                </div>
              );
            })}
            <button type="button" className="btn mb-0.5 text-red-600 hover:bg-red-50" onClick={() => remove(i)} disabled={value.length <= minItems} aria-label={`Remove item ${i + 1}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
