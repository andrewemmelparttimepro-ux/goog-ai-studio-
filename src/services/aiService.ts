import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  recommendations: string[];
  confidence: number;
}

export const analyzeObjectiveRisk = async (objectiveData: any): Promise<RiskAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following objective data and provide a risk assessment. 
      Objective: ${JSON.stringify(objectiveData)}
      
      Consider:
      1. Progress vs. Due Date (is it lagging?)
      2. Metric trends (if available)
      3. Subtask completion rate
      4. Priority vs. Status
      
      Provide the response in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: {
              type: Type.STRING,
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
              description: "The overall risk level of the objective."
            },
            summary: {
              type: Type.STRING,
              description: "A concise summary of the current risk status."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of actionable recommendations to mitigate risk."
            },
            confidence: {
              type: Type.NUMBER,
              description: "The model's confidence in this assessment (0-1)."
            }
          },
          required: ['riskLevel', 'summary', 'recommendations', 'confidence']
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as RiskAnalysis;
  } catch (error) {
    console.error("AI Risk Analysis Error:", error);
    return {
      riskLevel: 'MEDIUM',
      summary: "Unable to perform automated risk analysis at this time.",
      recommendations: ["Manually review objective progress", "Check external data sync status"],
      confidence: 0
    };
  }
};

export const generatePortfolioSummary = async (objectives: any[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a high-level strategic executive summary of the current objective portfolio. 
      Portfolio Data: ${JSON.stringify(objectives.map(o => ({ title: o.title, status: o.status, progress: o.progress, priority: o.priority })))}
      
      Focus on:
      1. Overall portfolio health
      2. Critical bottlenecks
      3. Strategic wins
      4. Immediate priorities for management
      
      Keep it professional, concise, and impactful (max 150 words).`,
      config: {
        systemInstruction: "You are a strategic advisor for a high-performance organization. Your tone is professional, direct, and insightful."
      }
    });

    return response.text;
  } catch (error) {
    console.error("AI Portfolio Summary Error:", error);
    return "Portfolio summary currently unavailable. Please review individual objective health.";
  }
};
