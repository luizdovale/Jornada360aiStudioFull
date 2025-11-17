import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { getMonthSummary, formatMinutesToHours, calculateJourney, getJourneysForDisplayMonth } from '../lib/utils';
import OverlappingCard from '../components/ui/OverlappingCard';
import Skeleton from '../components/ui/Skeleton';
import { Plus, BarChart, Settings, Route, CalendarDays, ChevronRight, ListChecks, ChevronLeft } from 'lucide-react';
import { Journey, MonthSummary } from '../types';

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
    const navigate = useNavigate();
    if (!settings) return null;
    const calcs = calculateJourney(journey, settings);
    const date = new Date(journey.date + 'T00:00:00');
    
    const handleItemClick = () => {
        navigate(`/journeys?edit=${journey.id}`);
    };
    
    return (
        <button 
            onClick={handleItemClick}
            className="w-full text-left flex items-center justify-between p-3 bg-white rounded-xl shadow-soft transition-transform hover:scale-105 active:scale-100"
            aria-label={`Ver detalhes da jornada de ${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`}
        >
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
        </button>
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
            .slice(