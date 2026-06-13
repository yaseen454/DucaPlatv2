import { Handler } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured in Netlify environment values." }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { image, mimeType, prompt } = body;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const schemaPrompt = prompt || `You are a Warframe Prime inventory screenshot analyzer. 
Review the given screenshot image of Warframe, specifically looking at any listed prime blueprints, prime weapon links, chassis, barrels, stocks, receivers, or components.
Extract each visible prime item and its count. Keep in mind:
- If a count prefix is visible like '5 X Acceltra Prime Stock', extract count = 5.
- If it's a single item listed, count = 1.
- Filter out items that are not prime parts.
Return a structured JSON list. Only return a plain JSON array of objects conforming to the type { name: string, count: number }[]. Do not write markdown blocks or any other explanation, just the raw JSON.`;

    const contents: any[] = [];
    contents.push({ text: schemaPrompt });
    if (image) {
      contents.push({
        inlineData: {
          mimeType: mimeType || "image/png",
          data: image,
        },
      });
    }

    // Call ai.models.generateContent using 'gemini-2.5-flash' as requested
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Raw matched item name" },
              count: { type: Type.INTEGER, description: "Quantity of the part" }
            },
            required: ["name", "count"]
          }
        }
      }
    });

    const finalData = JSON.parse(response.text || "[]");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalData),
    };
  } catch (error: any) {
    console.error("Netlify Function Gemini OCR error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to execute serverless OCR scan" }),
    };
  }
};
