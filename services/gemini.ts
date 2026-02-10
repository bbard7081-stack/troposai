
import { GoogleGenAI } from "@google/genai";

// Check if API key is available
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY;
const isAIEnabled = API_KEY && API_KEY !== 'PLACEHOLDER_API_KEY';

// Log warning if AI features are disabled
if (!isAIEnabled) {
  console.warn('⚠️ AI Features Disabled: GOOGLE_API_KEY is not configured. Smart Summary and AI insights will not be available.');
}

// Initialize AI only if key is available
const ai = isAIEnabled ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const getClientInsights = async (clientData: any) => {
  if (!isAIEnabled || !ai) {
    console.warn('⚠️ AI insights unavailable: GOOGLE_API_KEY is not configured');
    return "AI insights are currently disabled. Please configure GOOGLE_API_KEY to enable this feature.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this client data and suggest 3 high-priority follow-up actions: ${JSON.stringify(clientData)}`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insights Error:", error);
    return "Unable to generate insights at this time.";
  }
};

// Export AI availability status
export const isAIAvailable = isAIEnabled;
