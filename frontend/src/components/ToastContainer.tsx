import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-full max-w-sm flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((toast) => {
          const iconMap = {
            success: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
            error: <XCircle className="h-5 w-5 text-rose-600" />,
            warning: <AlertCircle className="h-5 w-5 text-amber-600" />,
            info: <Info className="h-5 w-5 text-teal-600" />,
          };

          const borderMap = {
            success: 'border-emerald-200 bg-white',
            error: 'border-rose-200 bg-white',
            warning: 'border-amber-200 bg-white',
            info: 'border-teal-200 bg-white',
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg ${borderMap[toast.type]}`}
            >
              <div className="mt-0.5 shrink-0">{iconMap[toast.type]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{toast.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.message}</div>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
