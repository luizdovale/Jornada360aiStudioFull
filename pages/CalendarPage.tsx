import React, { useEffect, useState } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getDayTypeForScale, getLocalDateString } from '../lib/utils';
import { ChevronLeft, ChevronRight, Lock, Gift, Loader2 } from 'lucide-react';
import ScheduleWeekPreview from '../components/ui/ScheduleWeekPreview';

const monthKey = (date: Date) => getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
const monthLabel = (key: string) => new Date(key + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

// Componente de conteúdo reutilizável para o widget e a página completa
export const CalendarPageContent: React.FC<{ isWidget?: boolean }> = ({ isWidget = false }) => {
    const { settings, settingsAt } = useJourneys();
    const { user, isPro } = useAuth();
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Plano free: 1 crédito por mês do calendário libera 1 mês à escolha uma
    // única vez — fica visível só enquanto o usuário está nesta tela. Ao sair,
    // o estado abaixo se perde e o mês volta a ficar bloqueado.
    const [freeViewedMonth, setFreeViewedMonth] = useState<string | null>(null);
    const [sessionUnlockedMonth, setSessionUnlockedMonth] = useState<string | null>(null);
    const [freeUsageLoaded, setFreeUsageLoaded] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const now = new Date();
    const usageMonth = monthKey(now);
    const usageMonthName = now.toLocaleDateString('pt-BR', { month: 'long' });
    const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

    useEffect(() => {
        if (!user || isPro || isWidget) return;
        let cancelled = false;
        supabase
            .from('free_calendar_usage')
            .select('viewed_month')
            .eq('user_id', user.id)
            .eq('month', usageMonth)
            .maybeSingle()
            .then(({ data, error }: { data: { viewed_month: string } | null, error: any }) => {
                if (cancelled) return;
                if (error) console.error('Erro ao consultar visualização grátis do calendário:', error);
                setFreeViewedMonth(data?.viewed_month ?? null);
                setFreeUsageLoaded(true);
            });
        return () => { cancelled = true; };
    }, [user, isPro, isWidget, usageMonth]);

    // Estados para controle do Swipe (Toque)
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Distância mínima (em pixels) para considerar um swipe válido
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reseta o fim ao tocar
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            changeMonth(1); // Deslizar para esquerda -> Próximo Mês
        }
        if (isRightSwipe) {
            changeMonth(-1); // Deslizar para direita -> Mês Anterior
        }
    };

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(1);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    const shownMonth = monthKey(currentDate);

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDayOfMonth });

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    // Reserva o crédito do mês para o mês exibido. O banco aceita só um por
    // mês (unique), então vale também entre aparelhos diferentes.
    const claimFreeView = async () => {
        if (!user) return;
        setClaiming(true);
        const { error } = await supabase
            .from('free_calendar_usage')
            .insert({ user_id: user.id, month: usageMonth, viewed_month: shownMonth });
        if (!error) {
            setFreeViewedMonth(shownMonth);
            setSessionUnlockedMonth(shownMonth);
        } else if (error.code === '23505') {
            // Já usado (por exemplo, em outro aparelho): continua bloqueado.
            const { data } = await supabase
                .from('free_calendar_usage')
                .select('viewed_month')
                .eq('user_id', user.id)
                .eq('month', usageMonth)
                .maybeSingle();
            setFreeViewedMonth(data?.viewed_month ?? null);
        } else {
            console.error('Erro ao liberar visualização grátis:', error);
            alert('Não foi possível liberar a visualização. Tente novamente.');
        }
        setClaiming(false);
    };

    if (!settings || !settings.escala_start_date) {
        return (
            <div className="text-center p-4">
                <p className="text-muted-foreground">Configure sua escala e o primeiro dia de trabalho para visualizar o calendário.</p>
            </div>
        );
    }

    // Widget do free: só a semana atual.
    if (!isPro && isWidget) {
        return <ScheduleWeekPreview settings={settings} settingsAt={settingsAt ?? undefined} label="Sua semana" />;
    }

    const isUnlocked = isPro || sessionUnlockedMonth === shownMonth;

    const monthGrid = (
        <>
            <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
                {weekDays.map((day, i) => <div key={i} className="font-bold text-muted-foreground">{day}</div>)}

                {emptyDays.map((_, i) => <div key={`empty-${i}`}></div>)}

                {days.map(day => {
                    const date = new Date(year, month, day);
                    // Escala vigente naquele dia: trocar de escala não muda os meses passados.
                    const dayType = getDayTypeForScale(date, settingsAt ? settingsAt(getLocalDateString(date)) : settings);

                    let bgColor = 'bg-transparent';
                    let textColor = 'text-gray-800';

                    if (dayType === 'work') {
                        bgColor = 'bg-blue-100';
                        textColor = 'text-blue-800 font-semibold';
                    } else if (dayType === 'off') {
                        bgColor = 'bg-green-100';
                        textColor = 'text-green-800 font-semibold';
                    }

                    // Highlight today
                    const today = new Date();
                    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

                    if (isToday) {
                        bgColor = 'bg-primary';
                        textColor = 'text-white';
                    }

                    return (
                        <div key={day} className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${bgColor} ${textColor}`}>
                            {day}
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-100"></span>
                    <span>Trabalho</span>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-100"></span>
                    <span>Folga</span>
                </div>
            </div>
        </>
    );

    return (
        <div className="w-full space-y-5">
            {/* Free: a semana atual continua sempre visível. */}
            {!isPro && (
                <ScheduleWeekPreview settings={settings} settingsAt={settingsAt ?? undefined} label="Sua semana" />
            )}

            <div
                className="w-full select-none" // select-none evita selecionar texto ao arrastar
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-primary-dark capitalize">{monthName} <span className="text-muted-foreground font-normal">{year}</span></h3>
                    {!isWidget && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="p-1 rounded-full hover:bg-gray-200"><ChevronLeft className="w-5 h-5" /></button>
                            <button onClick={() => changeMonth(1)} aria-label="Próximo mês" className="p-1 rounded-full hover:bg-gray-200"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    )}
                </div>

                {isUnlocked ? (
                    <>
                        {monthGrid}
                        {!isPro && (
                            <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                                <Gift className="w-4 h-4 flex-shrink-0 text-primary" />
                                <span>Visualização grátis de {usageMonthName}: este mês fica visível enquanto você estiver nesta tela. Ao sair, ele volta a ficar bloqueado. Renova em 1º de {nextMonthName}.</span>
                            </p>
                        )}
                    </>
                ) : (
                    <div className="relative min-h-[320px]">
                        {/* Prévia desfocada do mês bloqueado. */}
                        <div aria-hidden="true" className="blur-[6px] opacity-50 pointer-events-none">
                            {monthGrid}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                            <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-4 text-center space-y-3">
                                <div className="w-9 h-9 mx-auto rounded-full bg-primary-light flex items-center justify-center">
                                    <Lock className="w-4 h-4 text-primary" />
                                </div>
                                {!freeUsageLoaded ? (
                                    <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-400" />
                                ) : freeViewedMonth ? (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                        Você já usou sua visualização grátis de {usageMonthName} (<span className="font-medium text-primary-dark">{monthLabel(freeViewedMonth)}</span>). Renova em 1º de {nextMonthName}.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold text-primary-dark">1 visualização grátis disponível este mês</p>
                                        <p className="text-xs text-gray-500">Mostra a escala completa de um mês à sua escolha, uma única vez: ao sair desta tela, ele volta a ficar bloqueado. Com o PRO, todos os meses ficam liberados.</p>
                                        <button
                                            type="button"
                                            onClick={claimFreeView}
                                            disabled={claiming}
                                            className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                        >
                                            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                            Ver {monthName} grátis
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate('/subscription')}
                                    className="w-full h-10 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-primary-dark hover:bg-gray-50 transition-colors"
                                >
                                    Assinar PRO
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


const CalendarPage: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Calendário de Escala</h1>
            <div className="bg-white p-6 rounded-2xl shadow-soft">
                <CalendarPageContent />
            </div>
        </div>
    );
};

export default CalendarPage;
