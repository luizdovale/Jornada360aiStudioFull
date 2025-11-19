
import { Journey, Settings, JourneyCalculations, MonthSummary } from '../types';

/**
 * Converte uma string de tempo "HH:mm" para o número total de minutos desde a meia-noite.
 * @param timeString String no formato "HH:mm"
 * @returns Número total de minutos
 */
const timeToMinutes = (timeString: string): number => {
    if (!timeString || !timeString.includes(':')) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Calcula os detalhes de uma única jornada.
 * @param journey O objeto da jornada
 * @param settings As configurações do usuário
 * @returns Um objeto com os totais calculados para a jornada
 */
export const calculateJourney = (journey: Journey, settings: Settings): JourneyCalculations => {
    const kmRodados = (journey.km_end || 0) - (journey.km_start || 0);

    if (journey.is_day_off) {
        return {
            totalTrabalhado: 0,
            horasExtras50: 0,
            horasExtras100: 0,
            kmRodados: (journey.km_end || 0) - (journey.km_start || 0),
        };
    }

    const startMinutes = timeToMinutes(journey.start_at);
    const endMinutes = timeToMinutes(journey.end_at);

    let diffMinutes = endMinutes - startMinutes;
    // Lida com jornadas que cruzam a meia-noite
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }

    const totalTrabalhado = diffMinutes - (journey.meal_duration || 0) - (journey.rest_duration || 0);
    const jornadaBase = settings.jornada_base || 480; // Padrão de 8h se não configurado
    
    let horasExtras50 = 0;
    let horasExtras100 = 0;

    if (journey.is_feriado) {
        horasExtras100 = totalTrabalhado;
    } else if (totalTrabalhado > jornadaBase) {
        horasExtras50 = totalTrabalhado - jornadaBase;
    }

    return {
        totalTrabalhado: totalTrabalhado > 0 ? totalTrabalhado : 0,
        horasExtras50,
        horasExtras100,
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
 * Filtra as jornadas para um mês de exibição específico, respeitando o dia de início contábil.
 * @param journeys Todas as jornadas do usuário
 * @param displayDate A data (mês/ano) para a qual o resumo deve ser gerado
 * @param settings As configurações do usuário, contendo month_start_day
 * @returns Um array de jornadas que pertencem ao período contábil do mês de exibição
 */
export const getJourneysForDisplayMonth = (journeys: Journey[], displayDate: Date, settings: Settings): Journey[] => {
    const startDay = settings.month_start_day || 1;
    
    const displayYear = displayDate.getFullYear();
    const displayMonth = displayDate.getMonth();

    const startDate = new Date(displayYear, displayMonth, startDay);
    const endDate = new Date(displayYear, displayMonth + 1, startDay - 1);
    endDate.setHours(23, 59, 59, 999); // Garante que o último dia seja incluído completamente

    return journeys.filter(j => {
        const journeyDate = new Date(j.date + 'T00:00:00');
        return journeyDate >= startDate && journeyDate <= endDate;
    });
};


/**
 * Gera um resumo para um conjunto de jornadas, tipicamente de um mês.
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
        totalDiasTrabalhados: 0, // Inicializa com 0
    };
    
    if (!settings) return summary;

    return journeys.reduce((acc, journey) => {
        const calcs = calculateJourney(journey, settings);
        
        // Só conta como dia trabalhado se não for folga e tiver horas trabalhadas > 0
        // ou se você considerar que folga não entra na contagem.
        // Geralmente "Dias Trabalhados" exclui folgas.
        if (!journey.is_day_off) {
             acc.totalDiasTrabalhados += 1;
        }

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
    if (!settings.escala_pattern || !settings.escala_start_date) {
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
