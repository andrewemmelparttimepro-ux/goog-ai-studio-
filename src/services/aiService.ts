import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  recommendations: string[];
  confidence: number;
}

const isQuotaError = (error: any) => {
  const str = typeof error === 'string' ? error : JSON.stringify(error) + (error?.message || '');
  return str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('quota');
};

export const analyzeObjectiveRisk = async (objectiveData: any): Promise<RiskAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
  } catch (error: any) {
    if (isQuotaError(error)) {
      console.warn("AI Risk Analysis: Quota exceeded. Using fallback data.");
    } else {
      console.error("AI Risk Analysis Error:", error);
    }
    return {
      riskLevel: 'MEDIUM',
      summary: "Automated risk analysis is currently unavailable due to service limits.",
      recommendations: ["Manually review objective progress", "Check external data sync status"],
      confidence: 0
    };
  }
};

export interface DailyBriefing {
  headline: string;
  summary: string;
  priorityFocus: string;
  newsInsight: string;
  imageSeed: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimited = 
      error?.status === 429 || 
      error?.response?.status === 429 || 
      error?.error?.code === 429 ||
      (error?.message && error.message.includes('429')) ||
      (error?.message && error.message.includes('RESOURCE_EXHAUSTED'));
      
    // Don't retry if it's a quota error (usually contains "quota" in message)
    const isQuota = error?.message && error.message.toLowerCase().includes('quota');

    if (retries > 0 && isRateLimited && !isQuota) {
      console.warn(`Rate limited, retrying in ${delay}ms...`);
      await sleep(delay);
      return generateWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateDailyBriefing = async (objectives: any[], userProfile: any): Promise<DailyBriefing> => {
  try {
    return await generateWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Generate a daily briefing for ${userProfile?.displayName || 'the user'}. 
        Current Objectives: ${JSON.stringify(objectives.map(o => ({ title: o.title, status: o.status, priority: o.priority, dueDate: o.dueDate })))}
        
        The briefing should feel like a high-level news update or a personal strategic advisor's morning report.
        
        Provide:
        1. A catchy headline (e.g., "The Strategic Landscape: March 20th")
        2. A concise summary of the "most important thing" the user needs to know right now (e.g., a critical deadline, a major win, or a shifting priority).
        3. A specific "Priority Focus" for today.
        4. A "News Insight" - a mock but realistic industry or internal news item relevant to the objectives.
        5. A single word "imageSeed" to be used for a background image (e.g., "mountain", "city", "abstract", "technology").
        
        Provide the response in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              priorityFocus: { type: Type.STRING },
              newsInsight: { type: Type.STRING },
              imageSeed: { type: Type.STRING }
            },
            required: ['headline', 'summary', 'priorityFocus', 'newsInsight', 'imageSeed']
          }
        }
      });
      return JSON.parse(response.text || '{}') as DailyBriefing;
    });
  } catch (error: any) {
    if (isQuotaError(error)) {
      console.warn("AI Daily Briefing: Quota exceeded. Using fallback data.");
    } else {
      console.error("AI Daily Briefing Error:", error);
    }
    return {
      headline: "Daily Strategic Briefing (Offline Mode)",
      summary: "AI analysis is currently paused due to service limits. Focus on your high-priority objectives and upcoming deadlines.",
      priorityFocus: "Review all 'CRITICAL' and 'HIGH' priority objectives for the week.",
      newsInsight: "Internal systems report stable performance. AI insights will return when service limits reset.",
      imageSeed: "workspace"
    };
  }
};

export const generatePortfolioSummary = async (objectives: any[], sources: any[] = []): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Provide a comprehensive high-level strategic executive summary of the current objective portfolio, augmented by the provided custom knowledge base (sources). 
      
      Portfolio Data: ${JSON.stringify(objectives.map(o => ({ title: o.title, status: o.status, progress: o.progress, priority: o.priority, dueDate: o.dueDate })))}
      
      Custom Sources (Knowledge Base): ${JSON.stringify(sources.map(s => ({ name: s.name, content: s.content })))}
      
      Focus on:
      1. Synthesizing the custom sources with the current portfolio objectives.
      2. Identifying how the source material impacts strategic direction or execution.
      3. Overall portfolio health and inventory.
      4. Critical bottlenecks and high-risk objectives.
      5. Strategic wins and significant progress milestones.
      6. Immediate recommended actions for management to unblock teams, specifically referencing the source material where relevant.
      
      Keep it professional, insightful, and impactful (max 300 words). Use bullet points for key actions.`,
      config: {
        systemInstruction: "You are a strategic advisor for a high-performance organization. Your tone is professional, direct, and insightful. You provide a summary that acts as an inventory and status report, synthesizing internal objective data with external knowledge sources."
      }
    });

    return response.text;
  } catch (error: any) {
    if (isQuotaError(error)) {
      console.warn("AI Portfolio Summary: Quota exceeded. Using fallback data.");
    } else {
      console.error("AI Portfolio Summary Error:", error);
    }
    return "Portfolio summary currently unavailable due to AI service limits. Please review individual objective health manually.";
  }
};
