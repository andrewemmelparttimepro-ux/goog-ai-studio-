import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const generateEmbedding = async (contents: any[]) => {
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: contents,
    });
    return result.embeddings[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
};
