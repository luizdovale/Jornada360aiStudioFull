
import React, { useState } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { Journey } from '../../types';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';

interface IncompleteField {
    field: string;
    label: string;
}

interface IncompleteJourney {
    journey: Journey;
    missing: IncompleteField[];
}

const isBlank = (val?: string) => !val || val === '00:00' || val === '00:00:00';

export const detectIncomplete = (journeys: Journey[]): IncompleteJourney[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return journeys
        .filter(j => {
            // Ignora folgas e dias muito antigos
            if (j.is_day_off) return false;
            if (j.date < cutoffStr) return false;
            return true;
        })
        .map(j => {
            const missing: IncompleteField[] = [];
            const isPlantao = j.is_plantao;

            if (isBlank(j.start_at)) {
                missing.push({ field: 'start_at', label: 'Início de Jornada' });
            }
            if (isBlank(j.end_at)) {
                missing.push({ field: 'end_at', label: 'Fim de Jornada' });
            }

            // Refeição só é obrigatória em dias normais (não plantão)
            if (!isPlantao) {
                if (isBlank(j.meal_start)) {
                    missing.push({ field: 'meal_start', label: 'Início de Refeição' });
                }
                if (!isBlank(j.meal_start) && isBlank(j.meal_end)) {
                    missing.push({ field: 'meal_end', label: 'Fim de Refeição' });
                }
            }

            return { journey: j, missing };
        })
        .filter(item => item.missing.length > 0)
        .sort((a, b) => b.journey.date.localeCompare(a.journey.date)); // mais recente primeiro
};

const IncompleteJourneysAlert: React.FC<{ items: IncompleteJourney[] }> = ({ items }) => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || items.length === 0) return null;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            {/* Cabeçalho colapsável */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3"
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-bold text-amber-800">
                        {items.length === 1
                            ? '1 jornada com preenchimento incompleto'
                            : `${items.length} jornadas com preenchimento incompleto`}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={e => { e.stopPropagation(); setDismissed(true); }}
                        className="text-xs text-amber-500 hover:text-amber-700 font-semibold px-2"
                    >
                        Fechar
                    </button>
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-amber-500" />
                        : <ChevronDown className="w-4 h-4 text-amber-500" />
                    }
                </div>
            </button>

            {/* Lista expandida */}
            {expanded && (
                <div className="border-t border-amber-200 px-4 pb-3 pt-2 space-y-2">
                    {items.map(({ journey, missing }) => (
                        <div
                            key={journey.id}
                            className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-700">
                                    {formatDate(journey.date)} — {new Date(journey.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                                </p>
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                    Faltando: {missing.map(m => m.label).join(' · ')}
                                </p>
                            </div>
                            <button
                                onClick={() => navigate(`/journeys/edit/${journey.id}`)}
                                className="flex items-center gap-1 text-xs bg-amber-500 text-white font-bold px-2.5 py-1.5 rounded-lg hover:brightness-110 transition-all flex-shrink-0"
                            >
                                <Edit2 className="w-3 h-3" /> Corrigir
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IncompleteJourneysAlert;
