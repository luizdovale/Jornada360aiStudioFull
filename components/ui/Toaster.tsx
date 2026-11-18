
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
    // Abaixo da barra de status: no iPhone o sistema desfoca o que fica por baixo
    // dela, e com top fixo a mensagem ficava ilegível.
    <div
        className="fixed left-1/2 -translate-x-1/2 z-[100] w-[90vw] sm:w-auto sm:min-w-[320px] max-w-sm pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
    >
        <div className="flex flex-col-reverse gap-2 pointer-events-auto">
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
