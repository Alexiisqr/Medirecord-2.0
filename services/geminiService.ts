import { GoogleGenAI, Type } from "@google/genai";
import { FrequencyType, HistoryLog, AICorrectionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseMedicationInstruction = async (instruction: string, existingMeds: string[]) => {
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza: "${instruction}". Paciente toma: [${existingList}].
      1. Corrige el nombre del medicamento a su nombre genérico o comercial estándar más probable.
      2. Extrae dosis y frecuencia.
      3. Provee una descripción MUY breve (max 6 palabras) de para qué sirve (ej: "Para el dolor de cabeza").`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nombre corregido y estandarizado (Ej: Acetaminofén)" },
            description: { type: Type.STRING, description: "Uso principal en máx 6 palabras." },
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
          required: ["name", "description", "frequencyType", "advice"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error parsing medication with Gemini:", error);
    return null;
  }
};

export const getMedicationDetails = async (inputName: string, existingMeds: string[]): Promise<AICorrectionResult | undefined> => {
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `El usuario quiere agregar el medicamento: "${inputName}".
      1. Identifica el nombre oficial correcto (ej: si escribe "doli", asume "Doliprane" o "Paracetamol").
      2. Describe para qué sirve en máx 6 palabras.
      3. Analiza riesgos con: [${existingList}].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedName: { type: Type.STRING, description: "Nombre oficial corregido" },
            description: { type: Type.STRING, description: "Uso principal (ej: Analgésico para el dolor)" },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING, description: "¿Con comida o ayunas? (Máx 10 palabras)" },
                sideEffects: { type: Type.STRING, description: "2-3 efectos secundarios principales" },
                interactions: { type: Type.STRING, description: "Interacciones con otros medicamentos o 'Ninguna'." }
              },
              required: ["food", "sideEffects", "interactions"]
            }
          },
          required: ["correctedName", "description", "advice"]
        }
      }
    });

    return JSON.parse(response.text) as AICorrectionResult;
  } catch (error) {
    console.error("Error getting details:", error);
    return undefined;
  }
};

export const analyzeHistory = async (logs: HistoryLog[]) => {
  try {
    const logsText = logs.map(l => `${l.medicationName} tomado el ${new Date(l.takenAt).toLocaleString()}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza historial:\n${logsText}\n\nResumen breve (máx 40 palabras) motivacional para el usuario.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing history:", error);
    return "Sigue así, mantén tu salud bajo control.";
  }
};