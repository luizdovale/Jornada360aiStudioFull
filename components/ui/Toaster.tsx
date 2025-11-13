
import React from 'react';
import { useToast } from '../../hooks/useToast';
import { Info, AlertTriangle, CheckCircle, X } from 'lucide-react';

const ToastIcon = ({ variant }: { variant?: 'default' | 'destructive' }) => {
    if (variant === 'destructive') {
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-0 right-0 z-50 p-4 w-full max-w-sm">
        <div className="flex flex-col-reverse gap-2">
      {toasts.map(function ({ id, title, description, variant, ...props }) {
        return (
          <div
            key={id}
            className={`relative flex w-full items-start gap-3 rounded-xl p-4 shadow-lg transition-all
                ${variant === 'destructive' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}
                animate-in slide-in-from-top-5
            `}
          >
            <ToastIcon variant={variant} />
            <div className="grid gap-1 flex-1">
              {title && <p className="font-semibold text-sm">{title}</p>}
              {description && (
                <p className="text-xs opacity-90">{description}</p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
