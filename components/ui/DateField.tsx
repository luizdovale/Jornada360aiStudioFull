import React from 'react';
import { CalendarDays } from 'lucide-react';

interface DateFieldProps {
    id: string;
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    placeholder?: string;
}

/**
 * Campo de data com visual próprio. O Safari do iPhone ignora boa parte do
 * estilo do <input type="date"> (largura mínima, texto centralizado, formato
 * longo), o que quebra layouts lado a lado. Aqui a caixa visível é nossa e o
 * input nativo fica invisível por cima: o toque continua abrindo o calendário
 * do próprio aparelho.
 */
const DateField: React.FC<DateFieldProps> = ({ id, value, onChange, placeholder = 'dd/mm/aaaa' }) => {
    const display = value ? new Date(value + 'T00:00:00').toLocaleDateString('pt-BR') : placeholder;

    const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
        // No computador, clicar no input não abre o calendário sozinho.
        try {
            (e.currentTarget as any).showPicker?.();
        } catch {
            // Alguns navegadores bloqueiam showPicker; o foco já basta.
        }
    };

    return (
        <div className="relative min-w-0">
            <input
                id={id}
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                onClick={openPicker}
                // appearance-none + min/max-w: o Safari impõe largura mínima ao
                // date nativo; sem isso o input invisível invadiria o campo vizinho.
                className="peer absolute inset-0 z-10 w-full h-full min-w-0 max-w-full appearance-none opacity-0 cursor-pointer"
            />
            <div
                aria-hidden="true"
                className="flex items-center gap-2 h-11 px-3 border border-gray-200 rounded-lg bg-white text-sm transition-colors
                    peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20 peer-focus-visible:border-primary peer-hover:border-gray-300"
            >
                <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className={`truncate tabular-nums ${value ? 'text-primary-dark' : 'text-gray-400'}`}>{display}</span>
            </div>
        </div>
    );
};

export default DateField;
