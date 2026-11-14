/** Loading spinner, error banner, empty state and notice banners shared by all pages. */
export function Spinner({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex items-center gap-2 py-6 text-sm text-stone-500 ${className}`} role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-brand-500/25 border-t-brand-500" />
      {label}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200/80 px-5 py-4 text-sm text-red-800 shadow-sm">
      <span className="font-semibold">Error</span>
      <span className="flex-1 break-words">{message}</span>
      {onRetry && (
        <button type="button" className="font-medium underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', children }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-200 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg text-brand-600 ring-1 ring-brand-500/10">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-4l-2 3h-4l-2-3H4" /></svg>
      </div>
      <p className="font-display text-sm font-semibold text-stone-700">{title}</p>
      {children && <div className="mt-1 text-xs text-stone-500">{children}</div>}
    </div>
  );
}

const NOTICE = {
  info: 'border-sky-200/80    text-sky-900',
  warning: 'border-amber-200    text-amber-900',
  danger: 'border-red-200    text-red-900',
};

export function Notice({ kind = 'info', title, children }) {
  return (
    <div className={`rounded-lg border px-5 py-4 text-sm shadow-sm ${NOTICE[kind]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export const CLINICAL_DISCLAIMER =
  'Workflow-support tool only. Risk flags use configurable demonstration thresholds and are not a clinical diagnosis; decisions are made by qualified clinicians.';
