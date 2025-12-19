
import { Journey, Settings, JourneyCalculations, MonthSummary } from '../types';

/**
 * Converte string "HH:mm" para minutos totais desde a meia-noite.
 */
const timeToMinutes = (timeString: string | undefined | null): number => {
    if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) return 0;
    const parts = timeString.split(':');
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    return hours * 60 + minutes;
};

/**
 * Calcula a interseção (em minutos) entre dois intervalos [s1, e1] e [s2, e2].
 */
const getOverlap = (start: number, end: number, targetStart: number, targetEnd: number): number => {
    const s = Math.max(start, targetStart);
    const e = Math.min(end, targetEnd);
    return Math.max(0, e - s);
};

/**
 * Calcula os minutos de Adicional Noturno considerando a hora reduzida (fator 1.1428).
 * Janela: 22:00 às 05:00.
 * Desconta o tempo de refeição se ele ocorrer dentro dessa janela.
 */
const calculateNightMinutes = (
    startAt: string, 
    endAt: string, 
    mealStart?: string, 
    mealEnd?: string
): number => {
    let start = timeToMinutes(startAt);
    let end = timeToMinutes(endAt);
    if (end < start) end += 24 * 60; // Cruza meia-noite

    let mStart = timeToMinutes(mealStart);
    let mEnd = timeToMinutes(mealEnd);
    if (mEnd < mStart && (mealStart || mealEnd)) mEnd += 24 * 60;

    // Definição das janelas noturnas no eixo contínuo (até 48h para cobrir viradas)
    // Janela 1: 22h - 05h (dia 1)
    // Janela 2: 22h - 05h (dia 2 - caso a jornada seja muito longa ou comece cedo)
    const windows = [
        { s: 1320, e: 1740 }, // 22:00 às 05:00 (dia 1/2) -> 1320m a 1740m (29h)
        { s: -120, e: 300 },   // 22:00 às 05:00 (dia anterior/1) -> -120m a 300m
        { s: 2760, e: 3180 }  // 22:00 às 05:00 (dia 2/3)
    ];

    let workNightMinutes = 0;
    let mealNightMinutes = 0;

    windows.forEach(w => {
        workNightMinutes += getOverlap(start, end, w.s, w.e);
        if (mealStart && mealEnd) {
            mealNightMinutes += getOverlap(mStart, mEnd, w.s, w.e);
        }
    });

    const netNightMinutesRelogio = Math.max(0, workNightMinutes - mealNightMinutes);
    
    // Fator de Redução da Hora Noturna (CLT): 60 / 52.5 = 1.142857
    const FATOR_REDUCAO = 1.142857;
    
    return Math.round(netNightMinutesRelogio * FATOR_REDUCAO);
};

export const calculateJourney = (journey: Journey, settings: Settings): JourneyCalculations => {
    if (!journey || !settings) {
        return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, adicionalNoturno: 0, kmRodados: 0 };
    }

    const kmStart = Number(journey.km_start) || 0;
    const kmEnd = Number(journey.km_end) || 0;
    const kmRodados = kmEnd - kmStart;

    if (journey.is_day_off) {
        return { 
            totalTrabalhado: 0, 
            horasExtras50: 0, 
            horasExtras100: 0, 
            adicionalNoturno: 0, 
            kmRodados: kmRodados > 0 ? kmRodados : 0 
        };
    }

    const startMinutes = timeToMinutes(journey.start_at);
    const endMinutes = timeToMinutes(journey.end_at);
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const mealDuration = Number(journey.meal_duration) || 0;
    const totalTrabalhado = diffMinutes - mealDuration - (Number(journey.rest_duration) || 0);
    const jornadaBase = Number(settings.jornada_base) || 480;
    
    // Cálculo de Adicional Noturno com hora reduzida e desconto de refeição
    const adicionalNoturno = calculateNightMinutes(
        journey.start_at, 
        journey.end_at, 
        journey.meal_start, 
        journey.meal_end
    );

    let horasExtras50 = 0;
    let horasExtras100 = 0;

    // Lógica de Prioridade: Feriado > Plantão > Normal
    if (journey.is_feriado) {
        // Se é feriado, tudo é 100%, independente de ser plantão
        horasExtras100 = totalTrabalhado;
        horasExtras50 = 0;
    } else if (journey.is_plantao) {
        // Se é apenas plantão (e não feriado), não gera HE (entra no banco/base)
        horasExtras50 = 0;
        horasExtras100 = 0;
    } else if (totalTrabalhado > jornadaBase) {
        // Dia comum, excedeu a base
        horasExtras50 = totalTrabalhado - jornadaBase;
        horasExtras100 = 0;
    }

    return {
        totalTrabalhado: Math.max(0, totalTrabalhado),
        horasExtras50: Math.max(0, horasExtras50),
        horasExtras100: Math.max(0, horasExtras100),
        adicionalNoturno: Math.max(0, adicionalNoturno),
        kmRodados: Math.max(0, kmRodados),
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
    const startDate = new Date(displayDate.getFullYear(), displayDate.getMonth(), startDay);
    const endDate = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, startDay - 1);
    endDate.setHours(23, 59, 59, 999);
    return journeys.filter(j => {
        const d = new Date(j.date + 'T00:00:00');
        return d >= startDate && d <= endDate;
    });
};

export const getJourneysForCalendarMonth = (journeys: Journey[], displayDate: Date): Journey[] => {
    if (!journeys || !displayDate) return [];
    const startDate = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1);
    const endDate = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    return journeys.filter(j => {
        const d = new Date(j.date + 'T00:00:00');
        return d >= startDate && d <= endDate;
    });
};

export const getMonthSummary = (journeys: Journey[], settings: Settings | null): MonthSummary => {
    const summary: MonthSummary = { 
        totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, adicionalNoturno: 0, 
        kmRodados: 0, totalDiasTrabalhados: 0, totalDeliveries: 0 
    };
    if (!settings || !journeys || !Array.isArray(journeys)) return summary;
    summary.totalDiasTrabalhados = journeys.filter(j => !j.is_day_off).length;
    return journeys.reduce((acc, journey) => {
        const calcs = calculateJourney(journey, settings);
        acc.totalTrabalhado += calcs.totalTrabalhado;
        acc.horasExtras50 += calcs.horasExtras50;
        acc.horasExtras100 += calcs.horasExtras100;
        acc.adicionalNoturno += calcs.adicionalNoturno;
        acc.kmRodados += calcs.kmRodados;
        acc.totalDeliveries += Number(journey.deliveries) || 0;
        return acc;
    }, summary);
};

export const getDayTypeForScale = (date: Date, settings: Settings): 'work' | 'off' | null => {
    if (!settings?.escala_pattern || !settings?.escala_start_date) return null;
    const [work, off] = settings.escala_pattern.split('x').map(Number);
    const cycle = work + off;
    const diffDays = Math.round((new Date(date).getTime() - new Date(settings.escala_start_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
    const dayInCycle = ((diffDays % cycle) + cycle) % cycle;
    return dayInCycle < work ? 'work' : 'off';
};
