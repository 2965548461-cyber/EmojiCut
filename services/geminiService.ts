import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is not set. Skipping AI features.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateStickerName = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "sticker";

  try {
    // Remove data:image/png;base64, prefix
    const cleanBase64 = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: cleanBase64
                }
            },
            {
                text: "Analyze this sticker. Return a JSON object with a 'filename' property containing a short, descriptive name (max 3 words) in English using snake_case. If there is text, try to capture the meaning or emotion. Example: 'sad_crying', 'thumbs_up', 'working_hard'."
            }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                filename: { type: Type.STRING }
            }
        }
      }
    });

    if (response.text) {
        const data = JSON.parse(response.text);
        return data.filename || "sticker";
    }
    return "sticker";

  } catch (error) {
    console.error("Gemini Naming Error:", error);
    return "sticker"; // Fallback
  }
};
