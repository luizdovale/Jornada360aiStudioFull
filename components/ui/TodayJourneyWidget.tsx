
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../../contexts/JourneyContext';
import { useToast } from '../../hooks/useToast';
import { Journey } from '../../types';
import {
    Play, Coffee, CheckCircle2, Square, Edit2,
    AlertTriangle, AlertCircle, Clock, Plus, ChevronRight, Map, Package, FileText
} from 'lucide-react';
import { getLocalDateString, getLocalNowTime } from '../../lib/utils';

// ─── Utilitários ────────────────────────────────────────────────────────────

const getTodayString = () => getLocalDateString();

const getNowTime = () => getLocalNowTime();

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

const minutesSince = (date?: string, timeStr?: string): number => {
    if (!date || !timeStr || timeStr === '00:00') return 0;
    try {
        const start = new Date(`${date}T${timeStr}:00`);
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
        return diff > 0 ? diff : 0;
    } catch (e) {
        return 0;
    }
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
    const [isEnteringKm, setIsEnteringKm] = useState(false);
    const [tempKm, setTempKm] = useState('');
    const [tempRv, setTempRv] = useState('');
    const [tempDeliveries, setTempDeliveries] = useState('');
    const [tempNotes, setTempNotes] = useState('');
    const [, setTick] = useState(0); // força re-render a cada minuto para alertas

    // Atualiza a cada minuto para os alertas ficarem em tempo real
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    const today = getTodayString();
    
    // Busca jornada ativa (aberta e iniciada há no máximo 13h)
    const activeJourney = journeys
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(j => {
            if (isSet(j.end_at) || j.is_day_off) return false;
            const diffHours = minutesSince(j.date, j.start_at) / 60;
            return diffHours <= 13;
        });

    const displayedJourney = activeJourney || journeys.find(j => j.date === today);
    const step = getStep(displayedJourney);
    const isRetroactive = activeJourney && activeJourney.date !== today;

    // ── Verifica alertas trabalhistas ────────────────────────────────────────
    const getAlerts = useCallback(() => {
        if (!displayedJourney || step === 'done' || displayedJourney.is_day_off) return [];
        const alerts: { type: 'warning' | 'danger'; message: string }[] = [];

        // Alerta de refeição (só se ainda não iniciou)
        if (step === 'started') {
            const minsWorking = minutesSince(displayedJourney.date, displayedJourney.start_at);
            if (minsWorking >= 360) {
                alerts.push({ type: 'danger', message: `Você já trabalhou ${formatHM(minsWorking)} sem refeição! Regra CLT: máximo 6h contínuas.` });
            } else if (minsWorking >= 330) {
                const remaining = 360 - minsWorking;
                alerts.push({ type: 'warning', message: `Atenção: você tem apenas ${formatHM(remaining)} para iniciar a refeição (limite CLT: 6h contínuas).` });
            }
        }

        // Alerta de encerramento de jornada (quando jornada ainda está aberta)
        const minsTotal = minutesSince(displayedJourney.date, displayedJourney.start_at);
        if (minsTotal >= 720) {
            alerts.push({ type: 'danger', message: `Sua jornada está com ${formatHM(minsTotal)}! Regra CLT: máximo 12h por dia.` });
        } else if (minsTotal >= 660) {
            const remaining = 720 - minsTotal;
            alerts.push({ type: 'warning', message: `Atenção: faltam ${formatHM(remaining)} para o limite máximo de 12h de jornada (CLT).` });
        }

        return alerts;
    }, [displayedJourney, step]);

    // ── Ações dos botões ─────────────────────────────────────────────────────

    const handleIniciarJornada = async () => {
        if (settings?.km_enabled && !isEnteringKm) {
            setIsEnteringKm(true);
            return;
        }

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
            km_start: tempKm ? Number(tempKm.replace(',', '.')) : 0,
            km_end: 0,
            deliveries: tempDeliveries ? Number(tempDeliveries) : 0,
            rv_number: tempRv,
            notes: '',
        });
        setIsEnteringKm(false);
        setTempKm('');
        setTempRv('');
        setTempDeliveries('');
        setLoading(false);
    };

    const handleIniciarRefeicao = async () => {
        if (!displayedJourney) return;
        setLoading(true);
        await updateJourney({ ...displayedJourney, meal_start: getNowTime() });
        setLoading(false);
    };

    const handleFimRefeicao = async () => {
        if (!displayedJourney) return;
        setLoading(true);
        const mealEnd = getNowTime();
        const ms = timeToMinutes(displayedJourney.meal_start);
        const me = timeToMinutes(mealEnd);
        let duration = me - ms;
        if (duration < 0) duration += 24 * 60;
        await updateJourney({ ...displayedJourney, meal_end: mealEnd, meal_duration: duration });
        setLoading(false);
    };

    const handleEncerrar = async () => {
        if (settings?.km_enabled && !isEnteringKm) {
            setIsEnteringKm(true);
            return;
        }

        setLoading(true);
        await updateJourney({
            ...displayedJourney!,
            end_at: getNowTime(),
            km_end: tempKm ? Number(tempKm.replace(',', '.')) : (displayedJourney?.km_end || 0),
            notes: tempNotes ? `${displayedJourney?.notes ? displayedJourney.notes + '\n' : ''}${tempNotes}` : displayedJourney?.notes
        });
        setIsEnteringKm(false);
        setTempKm('');
        setTempNotes('');
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
    const elapsedMins = displayedJourney && step !== 'done' ? minutesSince(displayedJourney.date, displayedJourney.start_at) : 0;

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
                    {!isEnteringKm && (
                        <button
                            onClick={() => navigate('/journeys/new')}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                        >
                            Manual <ChevronRight className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {isEnteringKm ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                            <Map className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="KM Inicial (Opcional)"
                                value={tempKm}
                                onChange={(e) => setTempKm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1c3152] focus:border-transparent outline-none text-sm transition-all"
                                autoFocus
                            />
                        </div>
                        <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Número da RV (Opcional)"
                                value={tempRv}
                                onChange={(e) => setTempRv(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1c3152] focus:border-transparent outline-none text-sm transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder="Quantidade de Entregas (Opcional)"
                                value={tempDeliveries}
                                onChange={(e) => setTempDeliveries(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1c3152] focus:border-transparent outline-none text-sm transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setIsEnteringKm(false); setTempKm(''); setTempRv(''); setTempDeliveries(''); }}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleIniciarJornada}
                                disabled={loading}
                                className="flex-[2] bg-[#1c3152] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? 'Iniciando...' : 'Confirmar Início'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleIniciarJornada}
                        disabled={loading}
                        className="w-full bg-[#1c3152] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <Play className="w-4 h-4" />
                        {loading ? 'Iniciando...' : 'Iniciar Jornada'}
                    </button>
                )}
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Render: jornada CONCLUÍDA ou FOLGA
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'done' || displayedJourney?.is_day_off) {
        if (displayedJourney?.is_day_off) {
            return (
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <p className="text-sm font-bold text-gray-800">Hoje é sua folga 🌴</p>
                        </div>
                        <button
                            onClick={() => navigate(`/journeys/edit/${displayedJourney!.id}`)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1c3152] transition-colors"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 italic">Aproveite o descanso!</p>
                </div>
            );
        }

        const totalMins = (() => {
            const s = timeToMinutes(displayedJourney!.start_at);
            const e = timeToMinutes(displayedJourney!.end_at);
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
                        onClick={() => navigate(`/journeys/edit/${displayedJourney!.id}`)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1c3152] transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                </div>

                {/* Timeline */}
                <div className="flex items-start justify-between relative px-2 mb-1">
                    <div className="absolute top-4 left-6 right-6 h-px bg-gray-100 -z-0" />
                    <TimelineEvent label="Início" time={formatDisplayTime(displayedJourney!.start_at)} icon={<Play className="w-3 h-3" />} done />
                    {isSet(displayedJourney!.meal_start) && (
                        <TimelineEvent label="Refeição" time={`${formatDisplayTime(displayedJourney!.meal_start)} - ${formatDisplayTime(displayedJourney!.meal_end)}`} icon={<Coffee className="w-3 h-3" />} done />
                    )}
                    <TimelineEvent label="Fim" time={formatDisplayTime(displayedJourney!.end_at)} icon={<Square className="w-3 h-3" />} done />
                </div>

                <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-xs text-gray-500">Total trabalhado: </span>
                    <span className="text-sm font-bold text-[#1c3152]">{formatHM(totalMins - (displayedJourney!.meal_duration || 0))}</span>
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
                {isRetroactive && (
                    <div className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                        INICIADA ONTEM
                    </div>
                )}
                <button
                    onClick={() => navigate(`/journeys/edit/${displayedJourney!.id}`)}
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
                <span>Jornada iniciada há <strong className="text-gray-700">{formatHM(elapsedMins)}</strong> • desde <strong className="text-gray-700">{formatDisplayTime(displayedJourney!.start_at)}</strong></span>
            </div>

            {/* Timeline */}
            <div className="flex items-start justify-between relative px-2">
                <div className="absolute top-4 left-6 right-6 h-px bg-gray-100" />
                <TimelineEvent label="Início" time={formatDisplayTime(displayedJourney!.start_at)} icon={<Play className="w-3 h-3" />} done />
                <TimelineEvent
                    label="Refeição"
                    time={isSet(displayedJourney!.meal_start) ? formatDisplayTime(displayedJourney!.meal_start) : undefined}
                    icon={<Coffee className="w-3 h-3" />}
                    done={step === 'meal_started' || step === 'meal_ended'}
                />
                <TimelineEvent label="Fim" icon={<Square className="w-3 h-3" />} done={false} />
            </div>

            {/* Botão de ação principal */}
            {isEnteringKm && step === 'meal_ended' ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="relative">
                        <Map className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="KM Final (Opcional)"
                            value={tempKm}
                            onChange={(e) => setTempKm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="relative">
                        <FileText className="absolute left-4 top-3 text-gray-400 w-4 h-4" />
                        <textarea
                            placeholder="Observações (Opcional)"
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm transition-all resize-none h-24"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setIsEnteringKm(false); setTempKm(''); setTempNotes(''); }}
                            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm hover:bg-gray-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleEncerrar}
                            disabled={loading}
                            className="flex-[2] bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? 'Encerrando...' : 'Confirmar Fim'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={config.action}
                    disabled={loading}
                    className={`w-full ${config.color} text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] disabled:opacity-50`}
                >
                    <config.Icon className="w-4 h-4" />
                    {loading ? 'Salvando...' : config.label}
                </button>
            )}
        </div>
    );
};

export default TodayJourneyWidget;
