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
  description?: string; // New: AI explanation
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

export interface UserStats {
  level: number;
  currentPoints: number;
  streakDays: number;
  lastTakenDate?: string;
  achievementsUnlocked: string[];
}

export type View = 'dashboard' | 'add' | 'profile' | 'settings' | 'rewards';

export interface Theme {
  id: string;
  name: string;
  price?: number; // Cost in points
  unlocked?: boolean;
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