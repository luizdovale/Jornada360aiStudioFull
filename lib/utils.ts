
import { Journey, Settings, JourneyCalculations, MonthSummary } from '../types';

/**
 * Converte uma string de tempo "HH:mm" para o número total de minutos desde a meia-noite.
 */
const timeToMinutes = (timeString: string | undefined | null): number => {
    if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) return 0;
    const parts = timeString.split(':');
    if (parts.length < 2) return 0;
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    return hours * 60 + minutes;
};

/**
 * Calcula os detalhes de uma única jornada.
 */
export const calculateJourney = (journey: Journey, settings: Settings): JourneyCalculations => {
    if (!journey || !settings) {
        return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, kmRodados: 0 };
    }

    const kmStart = Number(journey.km_start) || 0;
    const kmEnd = Number(journey.km_end) || 0;
    const kmRodados = kmEnd - kmStart;

    if (journey.is_day_off) {
        return {
            totalTrabalhado: 0,
            horasExtras50: 0,
            horasExtras100: 0,
            kmRodados: kmRodados > 0 ? kmRodados : 0,
        };
    }

    const startMinutes = timeToMinutes(journey.start_at);
    const endMinutes = timeToMinutes(journey.end_at);

    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const mealDuration = Number(journey.meal_duration) || 0;
    const restDuration = Number(journey.rest_duration) || 0;

    const totalTrabalhado = diffMinutes - mealDuration - restDuration;
    const jornadaBase = Number(settings.jornada_base) || 480;
    
    let horasExtras50 = 0;
    let horasExtras100 = 0;

    // NOVA LÓGICA DE PRIORIDADE:
    // 1. Se for Feriado (mesmo que seja Plantão), ganha 100% de HE em todas as horas.
    // 2. Se for APENAS Plantão (sem feriado), ganha 0% de HE (dia normal).
    // 3. Caso contrário, segue a regra normal de HE 50% após a jornada base.
    
    if (journey.is_feriado) {
        // Feriado = 100% em tudo (mesmo se for plantão)
        horasExtras100 = totalTrabalhado;
        horasExtras50 = 0;
    } else if (journey.is_plantao) {
        // Plantão sem feriado = 0% extra
        horasExtras50 = 0;
        horasExtras100 = 0;
    } else if (totalTrabalhado > jornadaBase) {
        // Dia normal acima da base = 50%
        horasExtras50 = totalTrabalhado - jornadaBase;
        horasExtras100 = 0;
    }

    return {
        totalTrabalhado: totalTrabalhado > 0 ? totalTrabalhado : 0,
        horasExtras50: horasExtras50 > 0 ? horasExtras50 : 0,
        horasExtras100: horasExtras100 > 0 ? horasExtras100 : 0,
        kmRodados: kmRodados > 0 ? kmRodados : 0,
    };
};

export const formatMinutesToHours = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 00m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

export const getJourneysForDisplayMonth = (journeys: Journey[], displayDate: Date, settings: Settings): Journey[] => {
    if (!journeys || !displayDate || !settings) return [];
    const startDay = settings.month_start_day || 1;
    const displayYear = displayDate.getFullYear();
    const displayMonth = displayDate.getMonth();
    const startDate = new Date(displayYear, displayMonth, startDay);
    const endDate = new Date(displayYear, displayMonth + 1, startDay - 1);
    endDate.setHours(23, 59, 59, 999);
    return journeys.filter(j => {
        if (!j || !j.date) return false;
        const journeyDate = new Date(j.date + 'T00:00:00');
        return journeyDate >= startDate && journeyDate <= endDate;
    });
};

export const getJourneysForCalendarMonth = (journeys: Journey[], displayDate: Date): Journey[] => {
    if (!journeys || !displayDate) return [];
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); 
    endDate.setHours(23, 59, 59, 999);
    return journeys.filter(j => {
        if (!j || !j.date) return false;
        const journeyDate = new Date(j.date + 'T00:00:00');
        return journeyDate >= startDate && journeyDate <= endDate;
    });
};

export const getMonthSummary = (journeys: Journey[], settings: Settings | null): MonthSummary => {
    const summary: MonthSummary = { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, kmRodados: 0, totalDiasTrabalhados: 0 };
    if (!settings || !journeys || !Array.isArray(journeys)) return summary;
    summary.totalDiasTrabalhados = journeys.filter(j => !j.is_day_off).length;
    return journeys.reduce((acc, journey) => {
        if (!journey) return acc;
        const calcs = calculateJourney(journey, settings);
        acc.totalTrabalhado += calcs.totalTrabalhado;
        acc.horasExtras50 += calcs.horasExtras50;
        acc.horasExtras100 += calcs.horasExtras100;
        acc.kmRodados += calcs.kmRodados;
        return acc;
    }, summary);
};

export const getDayTypeForScale = (date: Date, settings: Settings): 'work' | 'off' | null => {
    if (!settings || !settings.escala_pattern || !settings.escala_start_date) return null;
    const [workDays, offDays] = settings.escala_pattern.split('x').map(Number);
    if (isNaN(workDays) || isNaN(offDays)) return null;
    const cycleLength = workDays + offDays;
    const startDate = new Date(settings.escala_start_date + 'T00:00:00');
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);
    const diffTime = currentDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    return dayInCycle < workDays ? 'work' : 'off';
};
