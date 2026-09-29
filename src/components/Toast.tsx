import React from 'react';

export interface ToastMessage {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none"
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-sm font-medium transition-all transform translate-y-0 opacity-100 ${
              isError
                ? 'bg-red-600 text-white border-red-700'
                : isSuccess
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="shrink-0">{isError ? '❌' : isSuccess ? '✓' : 'ℹ️'}</span>
              <span className="truncate">{t.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-white/80 hover:text-white font-bold p-1 leading-none text-base cursor-pointer shrink-0"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
