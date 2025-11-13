
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { getMonthSummary, formatMinutesToHours } from '../lib/utils';
import OverlappingCard from '../components/ui/OverlappingCard';
import Skeleton from '../components/ui/Skeleton';
import { Plus, BarChart, Settings, Route, CalendarDays } from 'lucide-react';
import { MonthSummary } from '../types';

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

    const summary: MonthSummary = React.useMemo(() => {
        if (!settings) return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, kmRodados: 0, totalDiasTrabalhados: 0 };
        // Lógica para filtrar jornadas do mês contábil atual
        const now = new Date();
        const startDay = settings.monthStartDay || 1;
        
        let startDate = new Date(now.getFullYear(), now.getMonth(), startDay);
        if(now.getDate() < startDay) {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
        }
        
        let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDay -1);
        
        const currentMonthJourneys = journeys.filter(j => {
            const journeyDate = new Date(j.date + 'T00:00:00'); // Evita problemas de fuso
            return journeyDate >= startDate && journeyDate <= endDate;
        });
        
        return getMonthSummary(currentMonthJourneys, settings);
    }, [journeys, settings]);


    return (
        <div className="-mt-16 space-y-5">
            {loading ? <HomePageSkeleton /> : (
            <>
                <OverlappingCard>
                    {settings ? (
                        <div className="space-y-4">
                            <div className="text-center">
                                <span className="text-card-label font-semibold text-accent uppercase">Resumo do Mês</span>
                                <h2 className="text-title-lg text-white">Seu Desempenho</h2>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <SummaryItem label="Horas" value={formatMinutesToHours(summary.totalTrabalhado)} />
                                <SummaryItem label="Extras 50%" value={formatMinutesToHours(summary.horasExtras50)} colorClass="text-green-400" />
                                <SummaryItem label="Extras 100%" value={formatMinutesToHours(summary.horasExtras100)} colorClass="text-yellow-400" />
                            </div>
                            {settings.kmEnabled && (
                                <div className="pt-2 text-center">
                                   <SummaryItem label="KM Rodados" value={`${summary.kmRodados.toFixed(1)} km`} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">Complete suas configurações para ver o resumo.</p>
                            <button onClick={() => navigate('/settings')} className="bg-accent text-primary font-bold py-2 px-4 rounded-lg">Configurar agora</button>
                        </div>
                    )}
                </OverlappingCard>

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
            )}
        </div>
    );
};

export default HomePage;
