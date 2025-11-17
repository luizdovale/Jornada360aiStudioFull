import React, { useState, TouchEvent, useRef } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { getDayTypeForScale } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Componente de conteúdo reutilizável para o widget e a página completa
export const CalendarPageContent: React.FC<{ isWidget?: boolean }> = ({ isWidget = false }) => {
    const { settings } = useJourneys();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [isSwiping, setIsSwiping] = useState(false);
    const [translateX, setTranslateX] = useState(0);
    const calendarRef = useRef<HTMLDivElement>(null);

    const changeMonth = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + amount);
        setCurrentDate(newDate);
    };

    const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (touchStartX === null) return;
        const currentX = e.targetTouches[0].clientX;
        const diff = currentX - touchStartX;
        setTranslateX(diff);
        setIsSwiping(true);
    };

    const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
        if (touchStartX === null) return;

        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX;
        const swipeThreshold = 50; // Distância mínima para um swipe

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) { // Swipe para a direita
                changeMonth(-1);
            } else { // Swipe para a esquerda
                changeMonth(1);
            }
        }
        
        setTouchStartX(null);
        setTranslateX(0); // Reseta a posição
        setIsSwiping(false);
    };


    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDayOfMonth });
    
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    if (!settings || !settings.escala_start_date) {
        return (
            <div className="text-center p-4">
                <p className="text-muted-foreground">Configure sua escala e o primeiro dia de trabalho para visualizar o calendário.</p>
            </div>
        );
    }
    
    return (
         <div 
            className="w-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-primary-dark capitalize">{monthName} <span className="text-muted-foreground font-normal">{year}</span></h3>
                {!isWidget && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-gray-200"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-gray-200"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                )}
            </div>
            
            <div 
                ref={calendarRef}
                key={`${year}-${month}`} 
                className="grid grid-cols-7 gap-y-2 text-center text-sm transition-opacity duration-300"
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
                    opacity: isSwiping ? (1 - Math.abs(translateX) / (calendarRef.current?.offsetWidth || 1)) : 1,
                }}
            >
                {weekDays.map((day, i) => <div key={i} className="font-bold text-muted-foreground">{day}</div>)}
                
                {emptyDays.map((_, i) => <div key={`empty-${i}`}></div>)}

                {days.map(day => {
                    const date = new Date(year, month, day);
                    const dayType = getDayTypeForScale(date, settings);
                    
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
        </div>
    )
}


const CalendarPage: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Calendário de Escala</h1>
            <div className="bg-white p-6 rounded-2xl shadow-soft overflow-x-hidden">
                <CalendarPageContent />
            </div>
        </div>
    );
};

export default CalendarPage;
