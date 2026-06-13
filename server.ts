/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { PRIME_ITEMS } from "./src/data/primeData.ts";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  
  // Set json upload limits large enough for typical high-res screenshots
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Helper matching function
  function findBestMatch(scannedName: string) {
    const cleanScanned = scannedName.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
    if (!cleanScanned) return null;

    let bestMatch = null;
    let maxOverlapScore = 0;

    for (const official of PRIME_ITEMS) {
      const cleanOfficial = official.part.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
      
      // Exact match
      if (cleanScanned === cleanOfficial) {
        return official;
      }

      // Check containment
      if (cleanScanned.includes(cleanOfficial) || cleanOfficial.includes(cleanScanned)) {
        const overlap = Math.min(cleanScanned.length, cleanOfficial.length) / Math.max(cleanScanned.length, cleanOfficial.length);
        if (overlap > maxOverlapScore) {
          maxOverlapScore = overlap;
          bestMatch = official;
        }
      }
    }

    // fallback segment-wise word matching
    if (!bestMatch) {
      const scannedWords = cleanScanned.split(/\s+/).filter(w => w.length > 2 && w !== "prime");
      for (const official of PRIME_ITEMS) {
        const officialWords = official.part.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "prime");
        const matchCount = scannedWords.filter(w => officialWords.includes(w)).length;
        if (matchCount >= 2 && matchCount / officialWords.length > maxOverlapScore) {
          maxOverlapScore = matchCount / officialWords.length;
          bestMatch = official;
        }
      }
    }

    return bestMatch;
  }

  // API Route for Gemini-guided Warframe prime item OCR and text mining
  app.post("/api/ocr", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image attachment raw base64 data" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("WARNING: GEMINI_API_KEY is not defined in the server environment secrets.");
        return res.status(500).json({ 
          error: "Gemini API key is not configured. Please add GEMINI_API_KEY to the Settings > Secrets/Environment panel." 
        });
      }

      // Initialize the official Google GenAI client
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Prepare image parts for Gemini model
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: image,
        }
      };

      console.log("Analyzing prime parts screenshot using Gemini...");
      const schemaPrompt = `You are a Warframe Prime inventory screenshot analyzer. 
Review the given screenshot image of Warframe, specifically looking at any listed prime blueprints, prime weapon links, chassis, barrels, stocks, receivers, or components.
Extract each visible prime item and its count. Keep in mind:
- If a count prefix is visible like '5 X Acceltra Prime Stock', extract count = 5.
- If it's a single item listed, count = 1.
- Filter out items that are not prime parts.
Return a structured JSON list.`;

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, { text: schemaPrompt }],
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

      const responseText = geminiResponse.text;
      if (!responseText) {
        return res.status(500).json({ error: "Empty response from Gemini server-side vision engine." });
      }

      const rawResults = JSON.parse(responseText.trim());
      console.log(`Gemini raw parsed ${rawResults.length} items from image.`);

      // Enrich and validate the parsed objects using our fuzzy string database analyzer
      const enrichedResults = rawResults.map((item: any) => {
        const bestOfficialMatch = findBestMatch(item.name);
        return {
          name: item.name,
          count: item.count || 1,
          matchedItem: bestOfficialMatch || undefined
        };
      });

      return res.json({ items: enrichedResults });
    } catch (err: any) {
      console.error("OCR analysis failure:", err);
      return res.status(500).json({ error: err.message || "Failure while executing server-side Gemini OCR." });
    }
  });

  // Provide endpoint for returning full dataset
  app.get("/api/primes", (req, res) => {
    res.json({ primes: PRIME_ITEMS });
  });

  // Serve app resources depending on context environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DucaPlat custom full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
