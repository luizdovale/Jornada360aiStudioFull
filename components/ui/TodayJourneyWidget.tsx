
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../../contexts/JourneyContext';
import { useToast } from '../../hooks/useToast';
import { Journey } from '../../types';
import {
    Play, Coffee, CheckCircle2, Square, Edit2,
    AlertTriangle, AlertCircle, Clock, Plus, ChevronRight
} from 'lucide-react';

// ─── Utilitários ────────────────────────────────────────────────────────────

const getTodayString = () => new Date().toISOString().split('T')[0];

const getNowTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const isSet = (t?: string) => !!t && t !== '00:00' && t !== '00:00:00';

const formatDisplayTime = (t?: string) => {
    if (!isSet(t)) return '';
    const parts = t!.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

const timeToMinutes = (t?: string): number => {
    if (!isSet(t) || !t?.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const minutesSince = (timeStr?: string): number => {
    if (!timeStr || timeStr === '00:00') return 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const tMins = timeToMinutes(timeStr);
    const diff = nowMins - tMins;
    return diff < 0 ? diff + 24 * 60 : diff;
};

const formatHM = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};

// ─── Máquina de estados ──────────────────────────────────────────────────────

type JourneyStep = 'idle' | 'started' | 'meal_started' | 'meal_ended' | 'done';

const getStep = (j?: Journey): JourneyStep => {
    if (!j) return 'idle';
    if (isSet(j.end_at)) return 'done';
    if (isSet(j.meal_end)) return 'meal_ended';
    if (isSet(j.meal_start)) return 'meal_started';
    return 'started';
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const TimelineEvent: React.FC<{
    label: string;
    time?: string;
    icon: React.ReactNode;
    active?: boolean;
    done?: boolean;
}> = ({ label, time, icon, done }) => (
    <div className={`flex flex-col items-center gap-1 flex-1 ${done ? 'opacity-100' : 'opacity-30'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs
            ${done ? 'bg-[#1c3152]' : 'bg-gray-200'}`}>
            {icon}
        </div>
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {time && time !== '00:00' && (
            <span className="text-[11px] font-bold text-gray-800">{time}</span>
        )}
    </div>
);

const AlertBanner: React.FC<{ type: 'warning' | 'danger'; message: string }> = ({ type, message }) => (
    <div className={`flex items-start gap-2 p-3 rounded-xl text-xs font-semibold
        ${type === 'warning'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
        {type === 'warning'
            ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        }
        <span>{message}</span>
    </div>
);

// ─── Componente principal ────────────────────────────────────────────────────

const TodayJourneyWidget: React.FC = () => {
    const navigate = useNavigate();
    const { journeys, settings, addJourney, updateJourney } = useJourneys();
    const { toast } = useToast();

    const [loading, setLoading] = useState(false);
    const [, setTick] = useState(0); // força re-render a cada minuto para alertas

    // Atualiza a cada minuto para os alertas ficarem em tempo real
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    const today = getTodayString();
    const todayJourney = journeys.find(j => j.date === today);
    const step = getStep(todayJourney);

    // ── Verifica alertas trabalhistas ────────────────────────────────────────
    const getAlerts = useCallback(() => {
        if (!todayJourney || step === 'done') return [];
        const alerts: { type: 'warning' | 'danger'; message: string }[] = [];

        // Alerta de refeição (só se ainda não iniciou)
        if (step === 'started') {
            const minsWorking = minutesSince(todayJourney.start_at);
            if (minsWorking >= 360) {
                alerts.push({ type: 'danger', message: `Você já trabalhou ${formatHM(minsWorking)} sem refeição! Regra CLT: máximo 6h contínuas.` });
            } else if (minsWorking >= 330) {
                const remaining = 360 - minsWorking;
                alerts.push({ type: 'warning', message: `Atenção: você tem apenas ${formatHM(remaining)} para iniciar a refeição (limite CLT: 6h contínuas).` });
            }
        }

        // Alerta de encerramento de jornada (quando jornada ainda está aberta)
        const minsTotal = minutesSince(todayJourney.start_at);
        if (minsTotal >= 720) {
            alerts.push({ type: 'danger', message: `Sua jornada está com ${formatHM(minsTotal)}! Regra CLT: máximo 12h por dia.` });
        } else if (minsTotal >= 660) {
            const remaining = 720 - minsTotal;
            alerts.push({ type: 'warning', message: `Atenção: faltam ${formatHM(remaining)} para o limite máximo de 12h de jornada (CLT).` });
        }

        return alerts;
    }, [todayJourney, step]);

    // ── Ações dos botões ─────────────────────────────────────────────────────

    const handleIniciarJornada = async () => {
        setLoading(true);
        const now = getNowTime();
        await addJourney({
            date: today,
            start_at: now,
            end_at: '00:00', // rascunho: jornada aberta
            meal_start: '00:00',
            meal_end: '00:00',
            meal_duration: 0,
            rest_duration: 0,
            is_feriado: false,
            is_day_off: false,
            is_plantao: false,
            km_start: 0,
            km_end: 0,
            deliveries: 0,
            rv_number: '',
            notes: '',
        });
        setLoading(false);
    };

    const handleIniciarRefeicao = async () => {
        if (!todayJourney) return;
        setLoading(true);
        await updateJourney({ ...todayJourney, meal_start: getNowTime() });
        setLoading(false);
    };

    const handleFimRefeicao = async () => {
        if (!todayJourney) return;
        setLoading(true);
        const mealEnd = getNowTime();
        const ms = timeToMinutes(todayJourney.meal_start);
        const me = timeToMinutes(mealEnd);
        let duration = me - ms;
        if (duration < 0) duration += 24 * 60;
        await updateJourney({ ...todayJourney, meal_end: mealEnd, meal_duration: duration });
        setLoading(false);
    };

    const handleEncerrar = async () => {
        if (!todayJourney) return;
        setLoading(true);
        await updateJourney({ ...todayJourney, end_at: getNowTime() });
        setLoading(false);
    };

    // ── Config do botão principal por step ───────────────────────────────────
    const actionConfig: Record<Exclude<JourneyStep, 'idle' | 'done'>, {
        label: string;
        Icon: React.ElementType;
        action: () => void;
        color: string;
    }> = {
        started: {
            label: 'Início de Refeição',
            Icon: Coffee,
            action: handleIniciarRefeicao,
            color: 'bg-amber-500 hover:brightness-110',
        },
        meal_started: {
            label: 'Fim de Refeição',
            Icon: CheckCircle2,
            action: handleFimRefeicao,
            color: 'bg-green-500 hover:brightness-110',
        },
        meal_ended: {
            label: 'Encerrar Jornada',
            Icon: Square,
            action: handleEncerrar,
            color: 'bg-red-500 hover:brightness-110',
        },
    };

    const alerts = getAlerts();
    const elapsedMins = todayJourney && step !== 'done' ? minutesSince(todayJourney.start_at) : 0;

    // ────────────────────────────────────────────────────────────────────────
    // Render: estado IDLE (sem jornada hoje)
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'idle') {
        // Estado padrão: sem jornada
        return (
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hoje</p>
                        <p className="text-sm font-bold text-gray-800">Nenhuma jornada iniciada</p>
                    </div>
                    <button
                        onClick={() => navigate('/journeys/new')}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                    >
                        Manual <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <button
                    onClick={handleIniciarJornada}
                    disabled={loading}
                    className="w-full bg-[#1c3152] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    <Play className="w-4 h-4" />
                    {loading ? 'Iniciando...' : 'Iniciar Jornada'}
                </button>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Render: jornada CONCLUÍDA
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'done') {
        const totalMins = (() => {
            const s = timeToMinutes(todayJourney!.start_at);
            const e = timeToMinutes(todayJourney!.end_at);
            let diff = e - s;
            if (diff < 0) diff += 24 * 60;
            return diff;
        })();

        return (
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="text-sm font-bold text-gray-800">Jornada encerrada</p>
                    </div>
                    <button
                        onClick={() => navigate(`/journeys/edit/${todayJourney!.id}`)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1c3152] transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                </div>

                {/* Timeline */}
                <div className="flex items-start justify-between relative px-2 mb-1">
                    <div className="absolute top-4 left-6 right-6 h-px bg-gray-100 -z-0" />
                    <TimelineEvent label="Início" time={formatDisplayTime(todayJourney!.start_at)} icon={<Play className="w-3 h-3" />} done />
                    {isSet(todayJourney!.meal_start) && (
                        <TimelineEvent label="Refeição" time={`${formatDisplayTime(todayJourney!.meal_start)} - ${formatDisplayTime(todayJourney!.meal_end)}`} icon={<Coffee className="w-3 h-3" />} done />
                    )}
                    <TimelineEvent label="Fim" time={formatDisplayTime(todayJourney!.end_at)} icon={<Square className="w-3 h-3" />} done />
                </div>

                <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-xs text-gray-500">Total trabalhado: </span>
                    <span className="text-sm font-bold text-[#1c3152]">{formatHM(totalMins - (todayJourney!.meal_duration || 0))}</span>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Render: jornada EM ANDAMENTO
    // ────────────────────────────────────────────────────────────────────────
    const config = actionConfig[step as Exclude<JourneyStep, 'idle' | 'done'>];

    return (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4 space-y-3">

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-sm font-bold text-gray-800">Jornada em andamento</p>
                </div>
                <button
                    onClick={() => navigate(`/journeys/edit/${todayJourney!.id}`)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1c3152] transition-colors"
                >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
            </div>

            {/* Alertas */}
            {alerts.map((a, i) => <AlertBanner key={i} type={a.type} message={a.message} />)}

            {/* Timer */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Jornada iniciada há <strong className="text-gray-700">{formatHM(elapsedMins)}</strong> • desde <strong className="text-gray-700">{formatDisplayTime(todayJourney!.start_at)}</strong></span>
            </div>

            {/* Timeline */}
            <div className="flex items-start justify-between relative px-2">
                <div className="absolute top-4 left-6 right-6 h-px bg-gray-100" />
                <TimelineEvent label="Início" time={formatDisplayTime(todayJourney!.start_at)} icon={<Play className="w-3 h-3" />} done />
                <TimelineEvent
                    label="Refeição"
                    time={isSet(todayJourney!.meal_start) ? formatDisplayTime(todayJourney!.meal_start) : undefined}
                    icon={<Coffee className="w-3 h-3" />}
                    done={step === 'meal_started' || step === 'meal_ended'}
                />
                <TimelineEvent label="Fim" icon={<Square className="w-3 h-3" />} done={false} />
            </div>

            {/* Botão de ação principal */}
            <button
                onClick={config.action}
                disabled={loading}
                className={`w-full ${config.color} text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] disabled:opacity-50`}
            >
                <config.Icon className="w-4 h-4" />
                {loading ? 'Salvando...' : config.label}
            </button>
        </div>
    );
};

export default TodayJourneyWidget;
