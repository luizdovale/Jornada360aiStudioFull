
// types.ts

export interface Journey {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_at: string; // HH:mm
  end_at: string; // HH:mm
  meal_start?: string; // HH:mm
  meal_end?: string;   // HH:mm
  meal_duration: number; // in minutes
  rest_duration?: number; // in minutes
  is_feriado: boolean;
  is_day_off?: boolean;
  is_plantao?: boolean;
  km_start?: number;
  km_end?: number;
  deliveries?: number;
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
  company_name?: string | null; // exibido no cabeçalho dos relatórios
  trip_label?: string | null; // nome do registro de viagem ("RV", "Shift"...); vazio = "RV"
}

// Campos de Settings que mudam com o tempo: cada versão vale a partir de
// effective_from, e os cálculos de um dia usam a versão vigente naquela data.
export const VERSIONED_SETTINGS_FIELDS = ['jornada_base', 'month_start_day', 'escala_pattern', 'escala_start_date', 'company_name', 'trip_label'] as const;

export interface SettingsVersion {
  id?: string;
  user_id?: string;
  effective_from: string; // YYYY-MM-DD; a versão inicial usa 1900-01-01
  jornada_base: number;
  month_start_day: number;
  escala_pattern: string;
  escala_start_date?: string | null;
  company_name?: string | null;
  trip_label?: string | null;
}

// Período contábil ("mês" de horas), em datas YYYY-MM-DD inclusivas.
export interface AccountingPeriod {
  start: string;
  end: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'trial';
  plan: 'free' | 'pro';
  expires_at?: string;
}

export interface JourneyCalculations {
  totalTrabalhado: number; // minutes
  horasExtras50: number; // minutes
  horasExtras100: number; // minutes
  adicionalNoturno: number; // minutes
  kmRodados: number;
}

export interface MonthSummary extends JourneyCalculations {
  totalDiasTrabalhados: number;
  totalDeliveries: number;
}

// Painel DEV
export interface AdminUserRow {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  journeys_count: number;
  last_journey_date: string | null;
  plan: 'free' | 'pro' | null;
  status: string | null;
  avatar_url: string | null;
}
