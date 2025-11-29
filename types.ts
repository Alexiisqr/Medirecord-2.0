export enum FrequencyType {
  DAILY = 'DAILY',
  HOURLY = 'HOURLY',
  WEEKLY = 'WEEKLY',
  AS_NEEDED = 'AS_NEEDED'
}

export interface MedicationAdvice {
  food: string; // Instructions regarding food (e.g., after meals)
  sideEffects: string; // Common side effects
  interactions: string; // Warnings about interactions with existing meds
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequencyType: FrequencyType;
  frequencyValue: number; // e.g., every 8 (hours), 1 (time a day)
  notes?: string;
  startDate: string; // ISO string
  nextDose?: string; // ISO string
  color: string;
  icon: string;
  advice?: MedicationAdvice; // New field for AI recommendations
  inventory?: number; // Number of pills left
}

export interface HistoryLog {
  id: string;
  medicationName: string;
  takenAt: string; // ISO string
  status: 'taken' | 'skipped';
}

export interface AIAnalysisResult {
  suggestedName?: string;
  suggestedFrequencyType?: FrequencyType;
  suggestedFrequencyValue?: number;
  info?: string;
  suggestedInventory?: number;
}

export type View = 'dashboard' | 'add' | 'profile';