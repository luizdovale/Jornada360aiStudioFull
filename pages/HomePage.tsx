import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { getMonthSummary, formatMinutesToHours, calculateJourney, getJourneysForDisplayMonth } from '../lib/utils';
import OverlappingCard from '../components/ui/OverlappingCard';
import Skeleton from '../components/ui/Skeleton';
import { Plus, BarChart, Settings, Route, CalendarDays, ChevronRight, ListChecks, ChevronLeft } from 'lucide-react';
import { MonthSummary, Journey } from '../types';

const SummaryItem: React.FC<{ label: string; value: string; colorClass?: string }> = ({ label, value, colorClass = 'text-white' }) => (
    <div className="flex flex-col items-center text-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={`text-xl font-bold ${colorClass}`}>{value}</span>
    </div>
);

const ActionCard: React.FC<{ icon: React.ElementType; title: string; subtitle: string; onClick: () => void }> = ({ icon: Icon, title, subtitle, onClick }) => (
    <button onClick={onClick} className="rounded-2xl bg-primary-light text-primary-dark shadow-soft px-3 py-4 flex flex-col gap-2 items-start active:scale-[0.97] transition-transform text-left w-full h-full">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary-dark" />
        </div>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
    </button>
);

const RecentJourneyItem: React.FC<{ journey: Journey }> = ({ journey }) => {
    const { settings } = useJourneys();
    if (!settings) return null;
    const calcs = calculateJourney(journey, settings);
    const date = new Date(journey.date + 'T00:00:00');
    
    return (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-soft">
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary-light text-primary-dark">
                    <span className="text-xs">{date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="font-bold text-lg">{date.getDate()}</span>
                </div>
                <div>
                    <p className="font-semibold text-sm text-primary-dark">{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                    <p className="text-xs text-muted-foreground">{formatMinutesToHours(calcs.totalTrabalhado)} trabalhadas</p>
                </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
    );
};


const HomePageSkeleton: React.FC = () => (
    <>
        <OverlappingCard>
            <div className="space-y-4 h-[164px]">
                <div className="text-center">
                    <Skeleton className="h-4 w-24 mx-auto" />
                    <Skeleton className="h-8 w-48 mx-auto mt-2" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="flex flex-col items-center text-center">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-7 w-20 mt-1" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-7 w-20 mt-1" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-7 w-20 mt-1" />
                    </div>
                </div>
            </div>
        </OverlappingCard>
        <div className="pt-2">
            <Skeleton className="h-7 w-32 mb-3" />
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
            </div>
        </div>
    </>
);


const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { journeys, settings, loading } = useJourneys();
    // Inicia a data de exibição como nula. Ela será definida corretamente quando as configurações carregarem.
    const [displayDate, setDisplayDate] = useState<Date | null>(null);

    // Efeito para calcular e definir a data do mês contábil inicial.
    useEffect(() => {
        if (settings) {
            const now = new Date();
            const startDay = settings.month_start_day || 1;
            
            // Cria uma data baseada no ano/mês atual para representar o período.
            const initialDate = new Date(now.getFullYear(), now.getMonth(), 1);
            
            // Se a data de hoje for anterior ao dia de início contábil,
            // significa que o período contábil atual começou no mês anterior.
            if (now.getDate() < startDay) {
                initialDate.setMonth(initialDate.getMonth() - 1);
            }
            setDisplayDate(initialDate);
        }
    }, [settings]); // Roda o efeito quando as configurações estiverem disponíveis.

    const recentJourneys = useMemo(() => {
        return [...journeys]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);
    }, [journeys]);

    const summary: MonthSummary = useMemo(() => {
        // Proteção contra 'displayDate' nulo durante a renderização inicial
        if (!settings || !displayDate) return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, kmRodados: 0, totalDiasTrabalhados: 0 };
        
        const currentMonthJourneys = getJourneysForDisplayMonth(journeys, displayDate, settings);
        
        return getMonthSummary(currentMonthJourneys, settings);
    }, [journeys, settings, displayDate]);

    const handlePrevMonth = () => {
        setDisplayDate(current => {
            if (!current) return null; // Verificação de segurança
            const newDate = new Date(current);
            newDate.setMonth(newDate.getMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setDisplayDate(current => {
            if (!current) return null; // Verificação de segurança
            const newDate = new Date(current);
            newDate.setMonth(newDate.getMonth() + 1);
            return newDate;
        });
    };
    
    const isCurrentAccountingMonth = () => {
        if (!settings || !displayDate) return false;
        const now = new Date();
        const startDay = settings.month_start_day || 1;
        let currentMonthStartDate = new Date(now.getFullYear(), now.getMonth(), startDay);
        if (now.getDate() < startDay) {
            currentMonthStartDate.setMonth(currentMonthStartDate.getMonth() - 1);
        }
        return currentMonthStartDate.getFullYear() === displayDate.getFullYear() &&
               currentMonthStartDate.getMonth() === displayDate.getMonth();
    };
    
    // Condição de carregamento: mostra o esqueleto se o contexto estiver carregando OU se a data de exibição ainda não foi definida.
    if (loading || !displayDate) {
        return (
            <div className="-mt-16 space-y-5 pb-4">
                <HomePageSkeleton />
            </div>
        );
    }
    
    // Após a proteção, podemos usar 'displayDate' com segurança.
    const formattedMonth = displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="-mt-16 space-y-5 pb-4">
            <>
                <OverlappingCard>
                    {settings ? (
                        <div className="space-y-4">
                             <div className="flex items-center justify-between text-center">
                                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex-1">
                                    <span className="text-card-label font-semibold text-accent uppercase">Resumo do Mês</span>
                                    <h2 className="text-lg font-bold text-white capitalize flex items-center justify-center gap-2 mt-1">
                                        {formattedMonth}
                                        {isCurrentAccountingMonth() && <span className="text-xs bg-accent text-primary-dark font-bold px-2 py-0.5 rounded-full">Atual</span>}
                                    </h2>
                                </div>
                                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <SummaryItem label="Horas" value={formatMinutesToHours(summary.totalTrabalhado)} />
                                <SummaryItem label="Extras 50%" value={formatMinutesToHours(summary.horasExtras50)} colorClass="text-green-400" />
                                <SummaryItem label="Extras 100%" value={formatMinutesToHours(summary.horasExtras100)} colorClass="text-yellow-400" />
                            </div>
                            {settings.km_enabled && (
                                <div className="pt-2 text-center">
                                   <SummaryItem label="KM Rodados" value={`${summary.kmRodados.toFixed(1)} km`} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">Complete suas configurações para ver o resumo.</p>
                            <button onClick={() => navigate('/settings')} className="bg-primary-medium text-primary-dark font-bold py-2 px-4 rounded-lg hover:brightness-95 transition-transform active:scale-[0.98]">Configurar agora</button>
                        </div>
                    )}
                </OverlappingCard>

                 {/* Seção de Jornadas Recentes */}
                <div className="pt-2 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-primary-dark">Últimas Jornadas</h3>
                         {journeys.length > 3 && (
                            <button onClick={() => navigate('/journeys')} className="text-sm font-semibold text-primary hover:underline">Ver Todas</button>
                        )}
                    </div>
                    {recentJourneys.length > 0 ? (
                        <div className="space-y-2">
                            {recentJourneys.map(j => <RecentJourneyItem key={j.id} journey={j} />)}
                        </div>
                    ) : (
                         <div className="text-center py-6 bg-white rounded-2xl shadow-soft flex flex-col items-center gap-3">
                            <ListChecks className="w-10 h-10 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Nenhuma jornada registrada ainda.</p>
                            <button onClick={() => navigate('/journeys?new=true')} className="bg-accent text-primary-dark font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                                <Plus className="w-4 h-4" />Adicionar Jornada
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                     <h3 className="text-lg font-bold text-primary-dark mb-3">Ações Rápidas</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <ActionCard icon={BarChart} title="Minhas Jornadas" subtitle="Ver histórico completo" onClick={() => navigate('/journeys')} />
                            <button
                                onClick={() => navigate('/journeys?new=true')}
                                className="absolute top-3 right-3 w-8 h-8 bg-accent text-primary-dark rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
                                aria-label="Adicionar nova jornada"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <ActionCard icon={CalendarDays} title="Calendário de Escala" subtitle="Planeje seus dias" onClick={() => navigate('/calendar')} />
                        <ActionCard icon={Route} title="Exportar Relatório" subtitle="Gerar PDF do período" onClick={() => navigate('/reports')} />
                        <ActionCard icon={Settings} title="Configurações" subtitle="Ajustar sua jornada" onClick={() => navigate('/settings')} />
                    </div>
                </div>
            </>
        </div>
    );
};

export default HomePage;