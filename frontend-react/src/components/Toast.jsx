import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ success: () => {}, error: () => {}, info: () => {} });

const STYLES = {
  success: 'border-green-300 bg-green-50 text-green-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, message) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[t.kind]}`}>
            <span className="flex-1 break-words">{t.message}</span>
            <button type="button" className="text-current/60 hover:text-current" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
