/** Layout primitives: page header, section card, KPI card, form field, modal. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-5 py-3">
          {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
          {actions && <div className="flex items-center gap-2 text-sm">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Tone is shown only as a thin coloured rule and the value colour; no gradients. */
const KPI_TONES = {
  teal: ['border-l-brand-600', 'text-ink'],
  sky: ['border-l-brand-400', 'text-ink'],
  amber: ['border-l-amber-500', 'text-amber-800'],
  rose: ['border-l-red-600', 'text-red-700'],
  violet: ['border-l-stone-500', 'text-ink'],
  slate: ['border-l-stone-300', 'text-stone-500'],
};

export function KpiCard({ label, value, tone = 'teal', hint }) {
  const [rule, text] = KPI_TONES[tone] || KPI_TONES.teal;
  return (
    <div className={`card border-l-[3px] ${rule} px-4 py-3.5`}>
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 font-display text-[30px] font-semibold leading-tight tabular-nums ${text}`}>{value ?? '-'}</p>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function Field({ label, htmlFor, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-stone-400">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 sm:p-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-lg border border-stone-200 bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button type="button" className="text-xl leading-none text-stone-400 hover:text-stone-700" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items
        .filter((i) => i)
        .map(([k, v]) => (
          <div key={k} className="min-w-0 border-b border-stone-100 pb-2">
            <dt className="text-xs text-stone-500">{k}</dt>
            <dd className="mt-0.5 break-words text-stone-900">{v ?? '-'}</dd>
          </div>
        ))}
    </dl>
  );
}
