export enum FrequencyType {
  DAILY = 'DAILY',
  HOURLY = 'HOURLY',
  WEEKLY = 'WEEKLY',
  AS_NEEDED = 'AS_NEEDED'
}

export interface MedicationAdvice {
  food: string;
  sideEffects: string;
  interactions: string;
}

export interface Medication {
  id: string;
  name: string;
  description?: string; // Nuevo campo para "Para qué sirve"
  dosage: string;
  frequencyType: FrequencyType;
  frequencyValue: number;
  notes?: string;
  startDate: string; // ISO string containing the PREFERRED time
  nextDose?: string; // ISO string
  color: string;
  icon: string;
  advice?: MedicationAdvice;
  inventory?: number;
}

export interface HistoryLog {
  id: string;
  medicationName: string;
  takenAt: string;
  status: 'taken' | 'skipped';
  pointsEarned?: number;
}

export interface UserProfile {
  xp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string; // ISO date only (YYYY-MM-DD)
  achievements: string[];
}

export interface AICorrectionResult {
  correctedName: string;
  description: string;
  advice: MedicationAdvice;
}

export interface AIAnalysisResult {
  suggestedName?: string;
  suggestedFrequencyType?: FrequencyType;
  suggestedFrequencyValue?: number;
  info?: string;
  suggestedInventory?: number;
  description?: string;
}

export type View = 'dashboard' | 'add' | 'profile' | 'settings' | 'achievements';

export interface Theme {
  id: string;
  name: string;
  classes: {
    bg: string;
    textMain: string;
    textSec: string;
    card: string;
    cardBorder: string;
    primary: string;
    accent: string;
    nav: string;
  };
}