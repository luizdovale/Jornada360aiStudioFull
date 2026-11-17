import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { DEFAULT_TRIP_LABEL } from '../../lib/utils';

const PRESETS = [DEFAULT_TRIP_LABEL, 'Shift'];

interface TripLabelPickerProps {
    // Vazio significa o padrão ("RV").
    value: string;
    onChange: (value: string) => void;
}

// Nome do registro de viagem: RV, Shift ou um nome livre ("Outro").
const TripLabelPicker: React.FC<TripLabelPickerProps> = ({ value, onChange }) => {
    const trimmed = value.trim();
    const [custom, setCustom] = useState(() => trimmed !== '' && !PRESETS.includes(trimmed));
    const selected = custom ? 'other' : (trimmed || DEFAULT_TRIP_LABEL);

    const optionClass = (active: boolean) =>
        `relative flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all
        ${active ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`;

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                {PRESETS.map(preset => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => { setCustom(false); onChange(preset === DEFAULT_TRIP_LABEL ? '' : preset); }}
                        className={optionClass(selected === preset)}
                        aria-pressed={selected === preset}
                    >
                        {preset}
                        {selected === preset && <Check className="w-3.5 h-3.5 absolute top-1.5 right-1.5" />}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => { setCustom(true); onChange(''); }}
                    className={optionClass(selected === 'other')}
                    aria-pressed={selected === 'other'}
                >
                    Outro
                    {selected === 'other' && <Check className="w-3.5 h-3.5 absolute top-1.5 right-1.5" />}
                </button>
            </div>
            {custom && (
                <input
                    type="text"
                    autoFocus
                    maxLength={20}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Ex.: Ordem de Serviço, Romaneio..."
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-primary-dark shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    aria-label="Nome do registro de viagem"
                />
            )}
        </div>
    );
};

export default TripLabelPicker;
