
// types.ts

export interface Journey {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  startAt: string; // HH:mm
  endAt: string; // HH:mm
  mealDuration: number; // in minutes
  restDuration?: number; // in minutes
  isFeriado: boolean;
  kmStart?: number;
  kmEnd?: number;
  rvNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  id?: string;
  user_id: string;
  jornadaBase: number; // in minutes
  kmEnabled: boolean;
  monthStartDay: number; // 1-31
  escalaPattern: string; // e.g., "6x2", "5x2"
  escalaStartDate?: string; // YYYY-MM-DD
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
