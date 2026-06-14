import { Handler } from "@netlify/functions";
import { parse } from "node-html-parser";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Polyfill fetch for node environments older than Node 18,
// though native fetch is available on modern Netlify Node runtimes
const fetchWithRetry = async (url: string, options: RequestInit, retries = 5, delay = 500): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      // If we got a 429 Too Many Requests or 5xx server error, we retry.
      // For standard 404 or 403, we can either retry or fail. Forums can rate limit with 429 or 403 sometimes.
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Fetch retry ${i + 1}/${retries} failed. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error("Failed to fetch page after retries.");
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { uid, claimedIGN } = body;

    if (!uid || !claimedIGN) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing uid or claimedIGN in request body." }),
      };
    }

    const extractWFMProfileUsername = (input: string): string => {
      let val = input.trim();
      // Handle warframe.market/profile/username urls
      if (val.toLowerCase().includes("warframe.market/profile/")) {
        const parts = val.split(/warframe\.market\/profile\//i);
        if (parts.length > 1) {
          val = parts[1];
        }
      } else if (val.toLowerCase().includes("forums.warframe.com/profile/")) {
        // Fallback for older links or forum layout formats
        const parts = val.split(/forums\.warframe\.com\/profile\//i);
        if (parts.length > 1) {
          val = parts[1];
        }
        if (val.includes("-")) {
          const blocks = val.split("-");
          if (/^\d+$/.test(blocks[0])) {
            val = blocks.slice(1).join("-");
          }
        }
      }
      while (val.endsWith("/")) {
        val = val.slice(0, -1);
      }
      if (val.includes("?")) {
        val = val.split("?")[0];
      }
      if (val.includes("/")) {
        val = val.split("/").pop() || val;
      }
      return val.trim();
    };

    const parsedSlug = extractWFMProfileUsername(claimedIGN);
    const normalizedIGN = parsedSlug.toLowerCase();

    // Initialize Firebase Admin securely
    if (!getApps().length) {
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!serviceAccountStr) {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT env key is missing on the server." }),
        };
      }
      const serviceAccount = JSON.parse(serviceAccountStr);
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    const db = getFirestore();
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "User profile document not found." }),
      };
    }

    const userData = userDoc.data() || {};
    const verification = userData.verification || {};
    const token = verification.token;

    if (!token) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No active verification token found for this user." }),
      };
    }

    // We will attempt to fetch the profile's HTML page on warframe.market.
    // The profile page URL parameter is fully-lowercased to avoid 404.
    const profilePageUrl = `https://warframe.market/profile/${encodeURIComponent(normalizedIGN)}`;

    console.log(`Fetching WFM profile HTML: ${profilePageUrl}`);
    let response: Response;
    try {
      response = await fetchWithRetry(profilePageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
      });
    } catch (fetchErr: any) {
      console.error("WFM Profile Page HTML fetch failed:", fetchErr);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Could not reach Warframe.market. Verify your connection and try again.`
        }),
      };
    }

    // Check if the profile page was found
    if (!response.ok) {
      console.error(`WFM profile load failed with HTTP status: ${response.status}`);
      let humanReadableError = `Warframe.market returned HTTP error ${response.status}.`;
      if (response.status === 404) {
        humanReadableError = `Warframe.market profile "${parsedSlug}" was not found. Ensure the spelling exactly matches your warframe.market username.`;
      } else if (response.status === 429) {
        humanReadableError = `Warframe.market is busy (Rate Limit). Please wait a few seconds and try again.`;
      } else if (response.status === 403) {
        humanReadableError = "Warframe.market's Cloudflare protection blocked the verification query. Try again in a moment.";
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: humanReadableError
        }),
      };
    }

    const html = await response.text();

    // Extract exact case-sensitive username from title: <title>Profile - ShyKnees2 | Orders</title>
    const titleMatch = html.match(/<title>Profile\s*-\s*(.*?)\s*\|\s*Orders<\/title>/i);
    const verifiedIGN = titleMatch ? titleMatch[1].trim() : parsedSlug;

    // Search for meta description first (where the "About Me" / Biography text of the profile is embedded as standard SEO metadata)
    const descMatch = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)">/i);
    let aboutText = descMatch ? descMatch[1] : "";

    // Fallback to og:description if name="description" was empty or not matched
    if (!aboutText) {
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([\s\S]*?)">/i);
      if (ogDescMatch) {
        aboutText = ogDescMatch[1];
      }
    }

    // Ultimate fallback: if for any reason description tag parsing fails, search the whole page body safely.
    if (!aboutText) {
      aboutText = html;
    }

    const lowercaseToken = token.trim().toLowerCase();
    const lowercaseAboutText = aboutText.toLowerCase();

    console.log("Checking token containment in warframe.market profile's Custom About/Bio Info...");
    const hasToken = lowercaseAboutText.includes(lowercaseToken);

    if (!hasToken) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Verification token not found in your warframe.market 'About' text. Ensure you paste and save "${token}" inside your 'About' / 'Custom biography' field on your warframe.market profile settings, and try again.`
        }),
      };
    }

    // Secure batch write to verify status
    console.log(`Verification Succeeded! Case-corrected IGN: ${verifiedIGN}`);
    const batch = db.batch();
    batch.update(userDocRef, {
      "verification.status": "verified",
      "verification.verifiedIGN": verifiedIGN,
      "verification.token": null,
      "verification.updatedAt": FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        verifiedIGN,
      }),
    };

  } catch (error: any) {
    console.error("Netlify verify-username runtime error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to verify. Direct internal server fault." }),
    };
  }
};
