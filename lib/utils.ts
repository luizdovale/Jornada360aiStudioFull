
import { Journey, Settings, JourneyCalculations, MonthSummary } from '../types';

/**
 * Converte uma string de tempo "HH:mm" para o número total de minutos desde a meia-noite.
 * @param timeString String no formato "HH:mm"
 * @returns Número total de minutos
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
 * @param journey O objeto da jornada
 * @param settings As configurações do usuário
 * @returns Um objeto com os totais calculados para a jornada
 */
export const calculateJourney = (journey: Journey, settings: Settings): JourneyCalculations => {
    // Proteção contra objetos nulos
    if (!journey || !settings) {
        return { totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, kmRodados: 0 };
    }

    // Converte para número garantindo que não seja NaN
    const kmStart = Number(journey.km_start) || 0;
    const kmEnd = Number(journey.km_end) || 0;
    const kmRodados = kmEnd - kmStart;

    // Se for dia de folga, zera horas e retorna apenas KM
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
    // Lida com jornadas que cruzam a meia-noite
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }

    // Garante que as durações sejam números
    const mealDuration = Number(journey.meal_duration) || 0;
    const restDuration = Number(journey.rest_duration) || 0;

    const totalTrabalhado = diffMinutes - mealDuration - restDuration;
    const jornadaBase = Number(settings.jornada_base) || 480; // Padrão de 8h se não configurado
    
    let horasExtras50 = 0;
    let horasExtras100 = 0;

    if (journey.is_feriado) {
        horasExtras100 = totalTrabalhado;
    } else if (totalTrabalhado > jornadaBase) {
        horasExtras50 = totalTrabalhado - jornadaBase;
    }

    return {
        totalTrabalhado: totalTrabalhado > 0 ? totalTrabalhado : 0,
        horasExtras50: horasExtras50 > 0 ? horasExtras50 : 0,
        horasExtras100: horasExtras100 > 0 ? horasExtras100 : 0,
        kmRodados: kmRodados > 0 ? kmRodados : 0,
    };
};


/**
 * Formata minutos em uma string de tempo "HH:mm".
 * @param totalMinutes Total de minutos
 * @returns String formatada "HHh mm"
 */
export const formatMinutesToHours = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 00m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

/**
 * Filtra as jornadas para um mês de exibição específico, respeitando o dia de início contábil (Ciclo de Horas).
 * @param journeys Todas as jornadas do usuário
 * @param displayDate A data (mês/ano) para a qual o resumo deve ser gerado
 * @param settings As configurações do usuário, contendo month_start_day
 * @returns Um array de jornadas que pertencem ao período contábil do mês de exibição
 */
export const getJourneysForDisplayMonth = (journeys: Journey[], displayDate: Date, settings: Settings): Journey[] => {
    if (!journeys || !displayDate || !settings) return [];

    const startDay = settings.month_start_day || 1;
    
    const displayYear = displayDate.getFullYear();
    const displayMonth = displayDate.getMonth();

    const startDate = new Date(displayYear, displayMonth, startDay);
    const endDate = new Date(displayYear, displayMonth + 1, startDay - 1);
    endDate.setHours(23, 59, 59, 999); // Garante que o último dia seja incluído completamente

    return journeys.filter(j => {
        if (!j || !j.date) return false;
        const journeyDate = new Date(j.date + 'T00:00:00');
        if (isNaN(journeyDate.getTime())) return false;
        return journeyDate >= startDate && journeyDate <= endDate;
    });
};

/**
 * Filtra as jornadas estritamente pelo mês civil (1 a 30/31), ignorando o ciclo contábil (Ciclo de KM).
 * @param journeys Todas as jornadas do usuário
 * @param displayDate A data (mês/ano) para a qual o resumo deve ser gerado
 * @returns Um array de jornadas que pertencem ao mês civil
 */
export const getJourneysForCalendarMonth = (journeys: Journey[], displayDate: Date): Journey[] => {
    if (!journeys || !displayDate) return [];

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    // Do dia 1 do mês atual até o último dia do mês atual
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); 
    endDate.setHours(23, 59, 59, 999);

    return journeys.filter(j => {
        if (!j || !j.date) return false;
        const journeyDate = new Date(j.date + 'T00:00:00');
        if (isNaN(journeyDate.getTime())) return false;
        return journeyDate >= startDate && journeyDate <= endDate;
    });
};


/**
 * Gera um resumo para um conjunto de jornadas.
 * @param journeys Array de jornadas
 * @param settings Configurações do usuário
 * @returns Um objeto com os totais consolidados
 */
export const getMonthSummary = (journeys: Journey[], settings: Settings | null): MonthSummary => {
    const summary: MonthSummary = {
        totalTrabalhado: 0,
        horasExtras50: 0,
        horasExtras100: 0,
        kmRodados: 0,
        totalDiasTrabalhados: 0,
    };
    
    if (!settings || !journeys || !Array.isArray(journeys)) return summary;

    // Calcula apenas os dias que NÃO são folga
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

/**
 * Calcula o tipo do dia (trabalho ou folga) com base na escala.
 * @param date A data para verificar
 * @param settings As configurações do usuário contendo o padrão e a data de início da escala
 * @returns 'work', 'off', ou null se não for possível calcular
 */
export const getDayTypeForScale = (date: Date, settings: Settings): 'work' | 'off' | null => {
    if (!settings || !settings.escala_pattern || !settings.escala_start_date) {
        return null;
    }

    const [workDays, offDays] = settings.escala_pattern.split('x').map(Number);
    if (isNaN(workDays) || isNaN(offDays)) return null;

    const cycleLength = workDays + offDays;
    
    // Zera a hora para evitar problemas de fuso horário na contagem de dias
    const startDate = new Date(settings.escala_start_date + 'T00:00:00');
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    // Calcula a diferença em milissegundos e converte para dias
    const diffTime = currentDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Usa o operador de módulo para encontrar a posição no ciclo
    const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;

    if (dayInCycle < workDays) {
        return 'work';
    } else {
        return 'off';
    }
};
