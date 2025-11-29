import { GoogleGenAI, Type } from "@google/genai";
import { FrequencyType, HistoryLog, MedicationAdvice } from "../types";

// Inicialización segura. Si process.env.API_KEY está vacío (por error de config), 
// usamos un string vacío para que la app cargue y muestre la alerta visual en lugar de romperse.
const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper para limpiar respuestas de la IA (Más robusto)
const cleanJson = (text: string) => {
  if (!text) return "{}";
  let clean = text.trim();
  // Eliminar bloques de código markdown, insensible a mayúsculas
  clean = clean.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "");
  return clean.trim();
};

// Función para verificar estado desde la UI
export const checkSystemStatus = () => {
  // Verificamos si la key tiene longitud válida
  const hasKey = apiKey.length > 0;
  return {
    hasKey,
    keySource: hasKey ? 'Configurada' : 'Faltante'
  };
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
  } catch (error) {
    console.error("Error Gemini Parse:", error);
    return { isValid: false, info: "Error al procesar. Intenta escribirlo manualmente." };
  }
};

export const analyzeMedicationDetails = async (rawName: string, existingMeds: string[]) => {
  if (!apiKey) {
    return {
      isMedication: true, // Permitir pasar para no bloquear al usuario si falla la API, pero avisar
      correctedName: rawName,
      description: "Modo Offline",
      validationMessage: "API Key no configurada. Funcionando en modo manual.",
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
  } catch (error) {
    console.error("Error Gemini Analyze:", error);
    // Fallback seguro
    return {
      isMedication: true, 
      correctedName: rawName,
      description: "Sin conexión IA",
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