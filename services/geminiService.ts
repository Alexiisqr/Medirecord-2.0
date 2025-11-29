import { GoogleGenAI, Type } from "@google/genai";
import { FrequencyType, HistoryLog, MedicationAdvice } from "../types";

// Support both process.env (Standard/Cloud) and import.meta.env (Vite/Local)
const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;

if (!apiKey) {
  console.error("API KEY not found. Make sure VITE_API_KEY is set in .env or API_KEY in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

export const parseMedicationInstruction = async (instruction: string, existingMeds: string[]) => {
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza esta instrucción: "${instruction}". El paciente ya toma: [${existingList}].
      Extrae datos, cantidad total de pastillas (si se menciona, ej: "caja de 30") y genera recomendaciones.
      Si hay interacciones peligrosas, adviértelo.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nombre del medicamento" },
            dosage: { type: Type.STRING, description: "Dosis (ej: 500mg)" },
            frequencyType: { 
              type: Type.STRING, 
              enum: [FrequencyType.DAILY, FrequencyType.HOURLY, FrequencyType.WEEKLY, FrequencyType.AS_NEEDED],
              description: "Tipo de frecuencia"
            },
            frequencyValue: { type: Type.NUMBER, description: "Valor numérico de la frecuencia" },
            info: { type: Type.STRING, description: "Nota breve" },
            inventory: { type: Type.NUMBER, description: "Cantidad total de pastillas si se menciona (default 20 si no)" },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING, description: "¿Con comida o ayunas? (Máx 10 palabras)" },
                sideEffects: { type: Type.STRING, description: "2-3 efectos secundarios principales" },
                interactions: { type: Type.STRING, description: "Advertencia de interacciones con la lista provista o 'Ninguna conocida'." }
              },
              required: ["food", "sideEffects", "interactions"]
            }
          },
          required: ["name", "frequencyType", "advice"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error parsing medication with Gemini:", error);
    return null;
  }
};

export const getMedicationRisks = async (newMedName: string, existingMeds: string[]): Promise<MedicationAdvice | undefined> => {
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Voy a tomar "${newMedName}". Ya estoy tomando: [${existingList}].
      Genera un JSON con recomendaciones de seguridad.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            food: { type: Type.STRING, description: "¿Con comida o ayunas? (Máx 10 palabras)" },
            sideEffects: { type: Type.STRING, description: "2-3 efectos secundarios principales" },
            interactions: { type: Type.STRING, description: "Advertencia de interacciones con la lista provista o 'Ninguna conocida'." }
          },
          required: ["food", "sideEffects", "interactions"]
        }
      }
    });

    return JSON.parse(response.text) as MedicationAdvice;
  } catch (error) {
    console.error("Error getting risks:", error);
    return undefined;
  }
};

export const analyzeHistory = async (logs: HistoryLog[]) => {
  try {
    const logsText = logs.map(l => `${l.medicationName} tomado el ${new Date(l.takenAt).toLocaleString()}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza este historial de medicamentos tomados por un paciente:\n${logsText}\n\nDame un resumen breve (máximo 50 palabras) motivacional sobre su adherencia o indicando si parece constante. Háblale directamente al usuario ("Has estado...").`,
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing history:", error);
    return "No pude analizar el historial en este momento.";
  }
};