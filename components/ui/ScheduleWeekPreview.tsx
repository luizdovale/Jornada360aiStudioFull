
import React, { useMemo } from 'react';
import { Settings } from '../../types';
import { getDayTypeForScale } from '../../lib/utils';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface ScheduleWeekPreviewProps {
    settings: Pick<Settings, 'escala_pattern' | 'escala_start_date'>;
    days?: number;
    variant?: 'dark' | 'light';
    label?: string;
}

// Faixa compacta com os próximos dias marcados como Trabalho/Folga, usada tanto na
// prévia do onboarding quanto na visão semanal (free) do Calendário de Escala.
const ScheduleWeekPreview: React.FC<ScheduleWeekPreviewProps> = ({
    settings,
    days = 7,
    variant = 'light',
    label = 'Sua semana',
}) => {
    const previewDays = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: days }).map((_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            return { date: d, type: getDayTypeForScale(d, settings as Settings) };
        });
    }, [settings, days]);

    const isDark = variant === 'dark';

    return (
        <div className={isDark ? 'bg-white/5 p-4 rounded-2xl border border-white/10' : 'bg-white p-4 rounded-2xl border border-gray-100'}>
            {label && <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-muted-foreground'}`}>{label}</p>}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
                {previewDays.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-muted-foreground'}`}>
                            {i === 0 ? 'Hoje' : WEEKDAY_LABELS[d.date.getDay()]}
                        </span>
                        <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold
                            ${d.type === 'work'
                                ? (isDark ? 'bg-accent text-primary-dark' : 'bg-blue-100 text-blue-800')
                                : (isDark ? 'bg-white/10 text-gray-300' : 'bg-green-100 text-green-800')}
                        `}>
                            {d.date.getDate()}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`flex items-center gap-4 mt-3 text-[11px] ${isDark ? 'text-gray-400' : 'text-muted-foreground'}`}>
                <span className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm inline-block ${isDark ? 'bg-accent' : 'bg-blue-100'}`} /> Trabalho
                </span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm inline-block ${isDark ? 'bg-white/10' : 'bg-green-100'}`} /> Folga
                </span>
            </div>
        </div>
    );
};

export default ScheduleWeekPreview;
