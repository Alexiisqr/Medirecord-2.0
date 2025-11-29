import { GoogleGenAI, Type } from "@google/genai";
import { FrequencyType, HistoryLog, MedicationAdvice } from "../types";

// LÓGICA DE API KEY:
// 1. import.meta.env.VITE_API_KEY -> Estándar para producción en Vite/Vercel/Netlify.
// 2. process.env.API_KEY -> Estándar para entornos locales o de prueba (AI Studio).
const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY;

if (!apiKey) {
  console.error("CRITICAL: API KEY not found. Please set VITE_API_KEY in your environment variables (Vercel/Netlify) or .env file.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key-to-prevent-crash" });

// Helper para limpiar respuestas de la IA que incluyen bloques de código markdown
const cleanJson = (text: string) => {
  return text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

export const parseMedicationInstruction = async (instruction: string, existingMeds: string[]) => {
  if (!apiKey) return null;
  
  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza esta instrucción: "${instruction}". El paciente ya toma: [${existingList}].
      Si el nombre del medicamento está mal escrito, corrígelo al nombre genérico o comercial más probable.
      IMPORTANTE: Responde SOLO con el JSON raw, sin markdown.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "True si es una instrucción válida sobre medicamentos. False si es texto sin sentido o no relacionado a salud." },
            name: { type: Type.STRING, description: "Nombre corregido y estandarizado del medicamento" },
            description: { type: Type.STRING, description: "Breve explicación (máx 15 palabras) de para qué sirve este medicamento." },
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
          required: ["isValid", "name", "frequencyType", "advice"]
        }
      }
    });

    const parsed = JSON.parse(cleanJson(response.text));
    return parsed;
  } catch (error) {
    console.error("Error parsing medication with Gemini:", error);
    return null;
  }
};

export const analyzeMedicationDetails = async (rawName: string, existingMeds: string[]) => {
  if (!apiKey) {
    return {
      isMedication: true, 
      correctedName: rawName,
      description: "Error de conexión",
      validationMessage: "No se detectó API KEY.",
      advice: { food: "Consultar médico", sideEffects: "-", interactions: "-" }
    };
  }

  try {
    const existingList = existingMeds.length > 0 ? existingMeds.join(", ") : "Ninguno";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `El usuario quiere agregar "${rawName}".
      1. Determina si "${rawName}" es un medicamento real, suplemento o insumo médico válido. Si es algo como "piedra", "carro", "frijol", marca isMedication como false.
      2. Si es válido, corrige el nombre y da detalles.
      3. Analiza riesgos con: [${existingList}].
      IMPORTANTE: Responde SOLO con el JSON raw, sin markdown.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMedication: { type: Type.BOOLEAN, description: "Es TRUE si es un medicamento, vitamina o tratamiento real. FALSE si es una palabra aleatoria, comida o tontería." },
            validationMessage: { type: Type.STRING, description: "Si no es medicamento, explica por qué brevemente. Ej: 'Una piedra no se puede recetar'." },
            correctedName: { type: Type.STRING, description: "Nombre oficial/correcto del medicamento" },
            description: { type: Type.STRING, description: "Explicación sencilla de su uso (Máx 12 palabras)" },
            advice: {
              type: Type.OBJECT,
              properties: {
                food: { type: Type.STRING, description: "¿Con comida o ayunas?" },
                sideEffects: { type: Type.STRING, description: "Efectos secundarios breves" },
                interactions: { type: Type.STRING, description: "Interacciones detectadas" }
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
    console.error("Error analyzing details:", error);
    return {
      isMedication: true, 
      correctedName: rawName,
      description: "Medicamento",
      advice: { food: "Consultar médico", sideEffects: "-", interactions: "-" }
    };
  }
};

export const analyzeHistory = async (logs: HistoryLog[]) => {
  if (!apiKey) return "Error: API Key no configurada.";

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