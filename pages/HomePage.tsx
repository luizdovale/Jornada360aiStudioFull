
import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { getMonthSummary, formatMinutesToHours, calculateJourney, getJourneysForDisplayMonth, getJourneysForCalendarMonth } from '../lib/utils';
import OverlappingCard from '../components/ui/OverlappingCard';
import Skeleton from '../components/ui/Skeleton';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { Plus, BarChart, Settings, Route, CalendarDays, ChevronRight, ListChecks, ChevronLeft, Map, Clock, Edit2, Trash2, ChevronDown, Coffee, FileText, StickyNote, Package, Shield, Moon } from 'lucide-react';
import { MonthSummary, Journey } from '../types';

const SummaryItem: React.FC<{ label: string; value: string; colorClass?: string }> = ({ label, value, colorClass = 'text-white' }) => (
    <div className="flex flex-col items-center text-center">
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        <span className={`text-sm sm:text-lg font-bold ${colorClass}`}>{value}</span>
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

const RecentJourneyItem: React.FC<{ 
    journey: Journey, 
    isExpanded: boolean, 
    onToggle: () => void,
    onDelete: (id: string) => void 
}> = ({ journey, isExpanded, onToggle, onDelete }) => {
    const { settings } = useJourneys();
    const navigate = useNavigate();
    
    if (!settings) return null;
    
    const calcs = calculateJourney(journey, settings);
    const date = new Date(journey.date + 'T00:00:00');
    
    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/journeys/edit/${journey.id}`);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(journey.id);
    };

    return (
        <div 
            className={`w-full bg-white rounded-2xl shadow-soft border border-transparent transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/10 shadow-md' : 'hover:shadow-md'}`}
        >
            {/* Header do Item */}
            <button 
                onClick={onToggle}
                className="w-full text-left flex items-center justify-between p-3 outline-none"
            >
                <div className="flex items-center gap-3">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${isExpanded ? 'bg-primary text-white' : (journey.is_plantao ? 'bg-blue-100 text-blue-800' : 'bg-primary-light text-primary-dark')}`}>
                        <span className="text-[10px] uppercase font-medium">{date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        <span className="font-bold text-lg leading-none">{date.getDate()}</span>
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-primary-dark">{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                        {journey.is_day_off ? (
                            <p className="text-xs text-red-600 font-bold uppercase tracking-tighter">FOLGA</p>
                        ) : journey.is_plantao ? (
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-tighter flex items-center gap-1"><Shield className="w-3 h-3"/> PLANTÃO</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">{formatMinutesToHours(calcs.totalTrabalhado)} trabalhadas</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100' : ''}`}>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                </div>
            </button>

            {/* Conteúdo Expandido */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] border-t border-gray-50' : 'max-h-0'}`}>
                <div className="p-4 space-y-4">
                    {/* Grid de Resumo */}
                    {!journey.is_day_off ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50 p-2 rounded-xl text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Extra 50%</p>
                                <p className="text-sm font-bold text-green-600">{formatMinutesToHours(calcs.horasExtras50)}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-xl text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Extra 100%</p>
                                <p className="text-sm font-bold text-yellow-600">{formatMinutesToHours(calcs.horasExtras100)}</p>
                            </div>
                             <div className="bg-gray-50 p-2 rounded-xl text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Noturno (Red.)</p>
                                <p className="text-sm font-bold text-indigo-600">{formatMinutesToHours(calcs.adicionalNoturno)}</p>
                            </div>
                            {settings.km_enabled && !journey.is_plantao ? (
                                <div className="bg-gray-50 p-2 rounded-xl text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">KM Rodados</p>
                                    <p className="text-sm font-bold text-primary-dark">{calcs.kmRodados.toFixed(1)} km</p>
                                </div>
                            ) : <div className="bg-gray-50 p-2 rounded-xl text-center flex items-center justify-center"><Clock className="w-4 h-4 text-muted-foreground opacity-30"/></div>}
                        </div>
                    ) : (
                        settings.km_enabled && calcs.kmRodados > 0 && (
                            <div className="bg-red-50/50 p-2 rounded-xl text-center">
                                <p className="text-[10px] text-red-400 uppercase font-bold">KM Rodados (Folga)</p>
                                <p className="text-sm font-bold text-red-600">{calcs.kmRodados.toFixed(1)} km</p>
                            </div>
                        )
                    )}

                    {/* Detalhes de Texto */}
                    <div className="space-y-2 text-xs text-muted-foreground">
                        {journey.deliveries !== undefined && journey.deliveries > 0 && (
                             <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-primary" />
                                <span>Entregas: <strong>{journey.deliveries}</strong></span>
                            </div>
                        )}
                        {!journey.is_day_off && !journey.is_plantao && journey.meal_start && (
                            <div className="flex items-center gap-2">
                                <Coffee className="w-3.5 h-3.5 text-primary" />
                                <span>Refeição: <strong>{journey.meal_start} - {journey.meal_end}</strong></span>
                            </div>
                        )}
                        {journey.rv_number && !journey.is_plantao && (
                            <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                <span>RV: <strong>{journey.rv_number}</strong></span>
                            </div>
                        )}
                        {journey.notes && (
                            <div className="flex items-start gap-2">
                                <StickyNote className="w-3.5 h-3.5 text-primary mt-0.5" />
                                <span className="italic">"{journey.notes}"</span>
                            </div>
                        )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                        <button 
                            onClick={handleEdit}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                    </div>
                </div>
            </div>
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
                <div className="grid grid-cols-4 gap-2 pt-2">
                    <Skeleton className="h-10 rounded-lg" />
                    <Skeleton className="h-10 rounded-lg" />
                    <Skeleton className="h-10 rounded-lg" />
                    <Skeleton className="h-10 rounded-lg" />
                </div>
            </div>
        </OverlappingCard>
    </>
);

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { journeys, settings, loading, deleteJourney } = useJourneys();
    const [displayDate, setDisplayDate] = useState<Date | null>(null);
    const [expandedJourneyId, setExpandedJourneyId] = useState<string | null>(null);
    const [journeyToDelete, setJourneyToDelete] = useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    useEffect(() => {
        if (settings) {
            const now = new Date();
            const startDay = settings.month_start_day || 1;
            const initialDate = new Date(now.getFullYear(), now.getMonth(), 1);
            if (now.getDate() < startDay) {
                initialDate.setMonth(initialDate.getMonth() - 1);
            }
            setDisplayDate(initialDate);
        }
    }, [settings]);

    const recentJourneys = useMemo(() => {
        return [...journeys]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);
    }, [journeys]);

    const summary: MonthSummary = useMemo(() => {
        if (!settings || !displayDate) return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, adicionalNoturno: 0, kmRodados: 0, totalDiasTrabalhados: 0, totalDeliveries: 0 };
        
        const accountingJourneys = getJourneysForDisplayMonth(journeys, displayDate, settings);
        const accountingSummary = getMonthSummary(accountingJourneys, settings);

        const calendarJourneys = getJourneysForCalendarMonth(journeys, displayDate);
        const calendarSummary = getMonthSummary(calendarJourneys, settings);

        return {
            ...accountingSummary,
            kmRodados: calendarSummary.kmRodados
        };
    }, [journeys, settings, displayDate]);

    const handlePrevMonth = () => {
        setDisplayDate(current => {
            if (!current) return null;
            const newDate = new Date(current);
            newDate.setMonth(newDate.getMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setDisplayDate(current => {
            if (!current) return null;
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

    const toggleJourney = (id: string) => {
        setExpandedJourneyId(prev => prev === id ? null : id);
    };

    const handleDeleteRequest = (id: string) => {
        setJourneyToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (journeyToDelete) {
            deleteJourney(journeyToDelete);
            setJourneyToDelete(null);
        }
    };
    
    if (loading || !displayDate) {
        return (
            <div className="-mt-16 space-y-5 pb-4">
                <HomePageSkeleton />
            </div>
        );
    }
    
    const formattedMonth = displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedCalendarMonth = displayDate.toLocaleDateString('pt-BR', { month: 'long' });

    return (
        <div className="-mt-16 space-y-5 pb-4">
            <ConfirmationModal 
                isOpen={isConfirmOpen} 
                onClose={() => setIsConfirmOpen(false)} 
                onConfirm={handleConfirmDelete} 
                title="Excluir Jornada" 
                message="Tem certeza que deseja apagar este registro?" 
            />

            <>
                <OverlappingCard>
                    {settings ? (
                        <div className="space-y-4">
                             <div className="flex items-center justify-between text-center mb-4">
                                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex-1">
                                    <span className="text-card-label font-semibold text-accent uppercase flex items-center justify-center gap-1">
                                        <Clock className="w-3 h-3" /> Resumo do Ciclo
                                    </span>
                                    <h2 className="text-lg font-bold text-white capitalize flex items-center justify-center gap-2 mt-1">
                                        {formattedMonth}
                                        {isCurrentAccountingMonth() && <span className="text-xs bg-accent text-primary-dark font-bold px-2 py-0.5 rounded-full">Atual</span>}
                                    </h2>
                                </div>
                                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <SummaryItem label="Trabalhados" value={`${summary.totalDiasTrabalhados}d`} />
                                <SummaryItem label="50%" value={formatMinutesToHours(summary.horasExtras50)} colorClass="text-green-400" />
                                <SummaryItem label="100%" value={formatMinutesToHours(summary.horasExtras100)} colorClass="text-yellow-400" />
                                <SummaryItem label="Noturno" value={formatMinutesToHours(summary.adicionalNoturno)} colorClass="text-indigo-400" />
                            </div>
                            
                            {settings.km_enabled && (
                                <>
                                    <div className="my-2 border-t border-white/10"></div>
                                    
                                    <div className="flex items-center justify-between px-2 pt-1">
                                        <div className="flex items-center gap-2 text-accent/80">
                                            <Map className="w-4 h-4" />
                                            <span className="text-xs font-medium uppercase tracking-wider">Mês Civil ({formattedCalendarMonth})</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-bold text-white block leading-none">{summary.kmRodados.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">km</span></span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">Complete suas configurações para ver o resumo.</p>
                            <button onClick={() => navigate('/settings')} className="bg-primary-medium text-primary-dark font-bold py-2 px-4 rounded-lg hover:brightness-95 transition-transform active:scale-[0.98]">Configurar agora</button>
                        </div>
                    )}
                </OverlappingCard>

                <div className="pt-2 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-primary-dark">Últimas Jornadas</h3>
                         {journeys.length > 3 && (
                            <button onClick={() => navigate('/journeys')} className="text-sm font-semibold text-primary hover:underline">Ver Todas</button>
                        )}
                    </div>
                    {recentJourneys.length > 0 ? (
                        <div className="space-y-3">
                            {recentJourneys.map(j => (
                                <RecentJourneyItem 
                                    key={j.id} 
                                    journey={j} 
                                    isExpanded={expandedJourneyId === j.id}
                                    onToggle={() => toggleJourney(j.id)}
                                    onDelete={handleDeleteRequest}
                                />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-6 bg-white rounded-2xl shadow-soft flex flex-col items-center gap-3">
                            <ListChecks className="w-10 h-10 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Nenhuma jornada registrada ainda.</p>
                            <button onClick={() => navigate('/journeys/new')} className="bg-accent text-primary-dark font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
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
                                onClick={() => navigate('/journeys/new')}
                                className="absolute top-3 right-3 w-8 h-8 bg-accent text-primary-dark rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
                                aria-label="Adicionar nova jornada"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <ActionCard icon={CalendarDays} title="Calendário de Escala" subtitle="Planeje seus dias" onClick={() => navigate('/calendar')} />
                        <ActionCard icon={Route} title="Exportar Relatório" subtitle="PDFs de Ponto e KM" onClick={() => navigate('/reports')} />
                        <ActionCard icon={Settings} title="Configurações" subtitle="Ajustar sua jornada" onClick={() => navigate('/settings')} />
                    </div>
                </div>
            </>
        </div>
    );
};

export default HomePage;
