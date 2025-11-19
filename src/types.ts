// types.ts

export interface Journey {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_at: string; // HH:mm
  end_at: string; // HH:mm
  meal_duration: number; // in minutes
  rest_duration?: number; // in minutes
  is_feriado: boolean;
  is_day_off?: boolean; // Novo campo para indicar folga
  km_start?: number;
  km_end?: number;
  rv_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id?: string;
  user_id: string;
  jornada_base: number; // in minutes
  km_enabled: boolean;
  month_start_day: number; // 1-31
  escala_pattern: string; // e.g., "6x2", "5x2"
  escala_start_date?: string; // YYYY-MM-DD
}

export interface JourneyCalculations {
  totalTrabalhado: number; // minutes
  horasExtras50: number; // minutes
  horasExtras100: number; // minutes
  kmRodados: number;
}

export interface MonthSummary extends JourneyCalculations {
  totalDiasTrabalhados: number;
}