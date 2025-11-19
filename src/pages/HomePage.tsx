
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
    // FIX: Add useNavigate to handle clicks on recent journeys
    const navigate = useNavigate();
    if (!settings) return null;
    const calcs = calculateJourney(journey, settings);
    const date = new Date(journey.date + 'T00:00:00');
    
    // FIX: Add handler to navigate to the journey edit page
    const handleItemClick = () => {
        navigate(`/journeys?edit=${journey.id}`);
    };

    return (
        // FIX: Change div to button to make it interactive and add click handler
        <button 
            onClick={handleItemClick}
            className="w-full text