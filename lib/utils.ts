import { Journey, Settings, JourneyCalculations, MonthSummary, SettingsVersion, AccountingPeriod } from '../types';

/**
 * Retorna a data atual (ou uma data específica) formatada como YYYY-MM-DD no fuso horário local.
 * Isso evita que o dia mude às 21h (caso do UTC).
 */
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Retorna o horário atual (ou de uma data específica) formatado como HH:mm no fuso horário local.
 */
export const getLocalNowTime = (date: Date = new Date()): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

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

// ---------------------------------------------------------------------------
// Histórico de configurações
//
// Jornada diária, dia contábil, escala e empresa têm versões com data de
// início (settings_versions). Cada dia é calculado com a versão vigente naquela
// data, então mudar as configurações não altera o que já passou.
// ---------------------------------------------------------------------------

export const SETTINGS_BASELINE_DATE = '1900-01-01';

export const DEFAULT_TRIP_LABEL = 'RV';

// Nome do registro de viagem configurado pelo usuário ("RV", "Shift"...).
export const getTripLabel = (settings: Pick<Settings, 'trip_label'> | null | undefined): string =>
    settings?.trip_label?.trim() || DEFAULT_TRIP_LABEL;

// Configurações vigentes numa data (YYYY-MM-DD).
export type SettingsAt = (date: string) => Settings;

const parseLocalDate = (date: string): Date => new Date(date + 'T00:00:00');

export const addDaysToDateString = (date: string, days: number): string => {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
};

export const sortSettingsVersions = (versions: SettingsVersion[]): SettingsVersion[] =>
    [...versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from));

// `versions` precisa estar ordenado (sortSettingsVersions). Sem versão para a
// data, valem os campos da própria tabela settings.
export const resolveSettingsAt = (base: Settings, versions: SettingsVersion[], date: string): Settings => {
    let active: SettingsVersion | null = null;
    for (const v of versions) {
        if (v.effective_from <= date) active = v;
        else break;
    }
    if (!active) return base;
    return {
        ...base,
        jornada_base: active.jornada_base,
        month_start_day: active.month_start_day,
        escala_pattern: active.escala_pattern,
        escala_start_date: active.escala_start_date ?? undefined,
        company_name: active.company_name ?? null,
        trip_label: active.trip_label ?? null,
    };
};

// Início do período dentro de um mês; meses mais curtos que o dia contábil
// (ex.: dia 31 em novembro) começam no último dia do mês.
const periodStartInMonth = (year: number, month: number, startDay: number): Date => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(startDay, daysInMonth));
};

/**
 * Período contábil que contém cada data. Quando o dia contábil muda, o período
 * em andamento termina na véspera da mudança e o seguinte começa nela — então
 * pode existir um período de transição mais curto (ex.: 21/11 a 30/11).
 * Versões que não mudam o dia contábil não cortam períodos.
 */
export const buildPeriodResolver = (base: Settings, versions: SettingsVersion[]) => {
    const segments: { from: string; day: number }[] = [];
    const push = (from: string, day: number) => {
        if (!segments.length || segments[segments.length - 1].day !== day) segments.push({ from, day });
    };
    if (!versions.length || versions[0].effective_from > SETTINGS_BASELINE_DATE) {
        push(SETTINGS_BASELINE_DATE, base.month_start_day || 1);
    }
    for (const v of versions) push(v.effective_from, v.month_start_day || 1);

    return (date: string): AccountingPeriod => {
        let i = 0;
        while (i + 1 < segments.length && segments[i + 1].from <= date) i++;
        const segment = segments[i];
        const segmentEnd = i + 1 < segments.length ? addDaysToDateString(segments[i + 1].from, -1) : null;

        const d = parseLocalDate(date);
        let start = periodStartInMonth(d.getFullYear(), d.getMonth(), segment.day);
        if (d < start) start = periodStartInMonth(d.getFullYear(), d.getMonth() - 1, segment.day);
        const nextStart = periodStartInMonth(start.getFullYear(), start.getMonth() + 1, segment.day);

        let startStr = getLocalDateString(start);
        let endStr = addDaysToDateString(getLocalDateString(nextStart), -1);
        if (startStr < segment.from) startStr = segment.from;
        if (segmentEnd && endStr > segmentEnd) endStr = segmentEnd;
        return { start: startStr, end: endStr };
    };
};

// O período leva o nome do mês em que começa (ex.: 21/10 a 20/11 = Outubro).
export const getPeriodMonthDate = (period: AccountingPeriod): Date => {
    const d = parseLocalDate(period.start);
    return new Date(d.getFullYear(), d.getMonth(), 1);
};

export const formatPeriodRange = (period: AccountingPeriod): string => {
    const fmt = (date: string) => parseLocalDate(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${fmt(period.start)} a ${fmt(period.end)}`;
};

export const getJourneysInPeriod = (journeys: Journey[], period: AccountingPeriod | null): Journey[] => {
    if (!journeys || !period) return [];
    return journeys.filter(j => j.date >= period.start && j.date <= period.end);
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

// Cada jornada é calculada com as configurações vigentes na data dela.
export const getMonthSummary = (journeys: Journey[], settingsAt: SettingsAt | null): MonthSummary => {
    const summary: MonthSummary = {
        totalTrabalhado: 0, horasExtras50: 0, horasExtras100: 0, adicionalNoturno: 0,
        kmRodados: 0, totalDiasTrabalhados: 0, totalDeliveries: 0
    };
    if (!settingsAt || !journeys || !Array.isArray(journeys)) return summary;
    summary.totalDiasTrabalhados = journeys.filter(j => !j.is_day_off).length;
    return journeys.reduce((acc, journey) => {
        const calcs = calculateJourney(journey, settingsAt(journey.date));
        acc.totalTrabalhado += calcs.totalTrabalhado;
        acc.horasExtras50 += calcs.horasExtras50;
        acc.horasExtras100 += calcs.horasExtras100;
        acc.adicionalNoturno += calcs.adicionalNoturno;
        acc.kmRodados += calcs.kmRodados;
        acc.totalDeliveries += Number(journey.deliveries) || 0;
        return acc;
    }, summary);
};

/**
 * Converte o padrão de escala (ex: "6x1", "5x2") em dias de trabalho/folga por ciclo.
 * "12x36" é um padrão por HORAS (12h trabalhando, 36h de folga) e não por dias — na
 * prática isso equivale a trabalhar um dia sim, um dia não, então é tratado à parte
 * em vez de ser interpretado literalmente como 12 dias de trabalho e 36 de folga.
 */
export const parseEscalaPattern = (pattern: string): { work: number; off: number } => {
    if (pattern === '12x36') return { work: 1, off: 1 };
    const [work, off] = pattern.split('x').map(Number);
    return { work: work || 1, off: off || 0 };
};

export const getDayTypeForScale = (date: Date, settings: Settings): 'work' | 'off' | null => {
    if (!settings?.escala_pattern || !settings?.escala_start_date) return null;
    const { work, off } = parseEscalaPattern(settings.escala_pattern);
    const cycle = work + off;
    const diffDays = Math.round((new Date(date).getTime() - new Date(settings.escala_start_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
    const dayInCycle = ((diffDays % cycle) + cycle) % cycle;
    return dayInCycle < work ? 'work' : 'off';
};
