import { GoogleGenAI, Type } from "@google/genai";
import { FrequencyType, HistoryLog, MedicationAdvice } from "../types";

// Inicialización segura.
const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper para limpiar respuestas de la IA
const cleanJson = (text: string) => {
  if (!text) return "{}";
  let clean = text.trim();
  clean = clean.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "");
  return clean.trim();
};

export const checkSystemStatus = () => {
  const hasKey = apiKey.length > 0;
  return {
    hasKey,
    keySource: hasKey ? 'Configurada' : 'Faltante'
  };
};

// Nueva función específica para REGENERAR información de un medicamento existente
export const regenerateMedicationInfo = async (medName: string) => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `El usuario tiene un medicamento llamado "${medName}" pero le falta información detallada.
      Genera la descripción, consejos y verifica el nombre correcto.
      Responde SOLO JSON raw.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedName: { type: Type.STRING },
            description: { type: Type.STRING },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING },
                sideEffects: { type: Type.STRING },
                interactions: { type: Type.STRING }
              },
              required: ["food", "sideEffects", "interactions"]
            }
          },
          required: ["correctedName", "description", "advice"]
        }
      }
    });

    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Error regenerando info:", error);
    return null;
  }
};

export const parseMedicationInstruction = async (instruction: string, existingMeds: string[]) => {
  if (!apiKey) return { isValid: false, info: "Falta configuración de API Key" };
  
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza: "${instruction}". Contexto actual: [${existingList}].
      Si hay errores ortográficos, asume el medicamento más probable.
      Responde SOLO el JSON raw, sin markdown.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            dosage: { type: Type.STRING },
            frequencyType: { 
              type: Type.STRING, 
              enum: [FrequencyType.DAILY, FrequencyType.HOURLY, FrequencyType.WEEKLY, FrequencyType.AS_NEEDED]
            },
            frequencyValue: { type: Type.NUMBER },
            info: { type: Type.STRING },
            inventory: { type: Type.NUMBER },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING },
                sideEffects: { type: Type.STRING },
                interactions: { type: Type.STRING }
              },
              required: ["food", "sideEffects", "interactions"]
            }
          },
          required: ["isValid", "name", "frequencyType", "advice"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Respuesta vacía de la IA");
    
    const parsed = JSON.parse(cleanJson(text));
    return parsed;
  } catch (error: any) {
    console.error("Error Gemini Parse:", error);
    let msg = "Error al procesar.";
    if (error.message?.includes("403")) msg = "Error de API Key (403).";
    if (error.message?.includes("429")) msg = "Límite de cuota excedido.";
    return { isValid: false, info: msg };
  }
};

export const analyzeMedicationDetails = async (rawName: string, existingMeds: string[]) => {
  if (!apiKey) {
    return {
      isMedication: true, 
      correctedName: rawName,
      description: "Modo Offline",
      validationMessage: "API Key no configurada.",
      advice: { food: "Consultar médico", sideEffects: "-", interactions: "-" }
    };
  }

  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Validar adición de: "${rawName}".
      1. ¿Es un medicamento/suplemento real? (isMedication).
      2. Corrige nombre y da detalles.
      3. Revisa cruces con: [${existingList}].
      JSON raw solamente.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMedication: { type: Type.BOOLEAN },
            validationMessage: { type: Type.STRING },
            correctedName: { type: Type.STRING },
            description: { type: Type.STRING },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING },
                sideEffects: { type: Type.STRING },
                interactions: { type: Type.STRING }
              },
              required: ["food", "sideEffects", "interactions"]
            }
          },
          required: ["isMedication", "correctedName", "description", "advice"]
        }
      }
    });

    const parsed = JSON.parse(cleanJson(response.text));
    return parsed;
  } catch (error: any) {
    console.error("Error Gemini Analyze:", error);
    // Identificar tipo de error para mostrar al usuario
    let errorMsg = "Error de conexión IA";
    if (error.message?.includes("403") || error.message?.includes("API key")) errorMsg = "Error: API Key Inválida";
    if (error.message?.includes("429")) errorMsg = "Error: Cuota Excedida";
    
    return {
      isMedication: true, 
      correctedName: rawName,
      description: errorMsg,
      advice: { food: "Consultar médico", sideEffects: "-", interactions: "-" }
    };
  }
};

export const analyzeHistory = async (logs: HistoryLog[]) => {
  if (!apiKey) return "⚠️ No puedo analizar el historial sin una API Key configurada.";

  try {
    const logsText = logs.map(l => `${l.medicationName}: ${l.takenAt}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Resumen motivacional breve (30 palabras) para paciente:\n${logsText}`,
    });
    return response.text;
  } catch (error) {
    return "No se pudo conectar con el asistente.";
  }
};