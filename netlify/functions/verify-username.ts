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
    const { uid, claimedIGN, htmlSource } = body;

    if (!uid || !claimedIGN) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing uid or claimedIGN in request body." }),
      };
    }

    if (!htmlSource || typeof htmlSource !== "string" || !htmlSource.trim()) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Please paste your warframe.market profile page source (CTRL+U/CMD+U code) in the box below before verifying."
        }),
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

    // Limit input length to prevent memory bloated parsing or excessive regex backtracking.
    // The `<head>` block containing meta descriptions, titles, and canonical links is always at 
    // the very start and comfortably fits inside 50,000 characters.
    const html = htmlSource.substring(0, 50000);

    // Extract exact case-sensitive username from title or page links
    let verifiedIGN = "";
    // 1. Try Title tag (e.g. <title>Profile - TennoMerchant | Orders</title> or translated equivalents)
    const titleMatch = html.match(/<title>Profile\s*-\s*(.*?)\s*\|\s*Orders<\/title>/i);
    if (titleMatch) {
      verifiedIGN = titleMatch[1].trim();
    } else {
      // 2. Try canonical URL or open graph tags to get the name
      // <link rel="canonical" href="https://warframe.market/profile/tennomerchant">
      const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="[^"]*?warframe\.market\/(?:[a-z]{2}\/)?profile\/([a-zA-Z0-9_-]+)"/i);
      if (canonicalMatch) {
        verifiedIGN = canonicalMatch[1].trim();
      } else {
        // 3. Try to locate profile active tab link or other links
        // href="/profile/the_user" or href="/en/profile/the_user"
        const linkMatch = html.match(/href="(?:\/[a-z]{2})?\/profile\/([a-zA-Z0-9_-]+)"/i);
        if (linkMatch) {
          verifiedIGN = linkMatch[1].trim();
        }
      }
    }

    if (!verifiedIGN) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Could not parse the profile owner's username from the pasted page source. Please make sure you copy the entire raw HTML page source (use CTRL+U/CMD+U, then CTRL+A/CMD+A, then copy) and try again.`
        }),
      };
    }

    // Now check if verifiedIGN matches normalizedIGN (case-insensitive)
    if (verifiedIGN.toLowerCase() !== normalizedIGN) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `The pasted page source belongs to "${verifiedIGN}", which does not match your claimed username of "${parsedSlug}". Please view page source (CTRL+U/CMD+U) on your own profile (https://warframe.market/profile/${normalizedIGN}) and copy that source code instead.`
        }),
      };
    }

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

    // Ultimate fallback: if description tag parsing is not matching, search the whole page body safely.
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
          error: `Verification token "${token}" was not found in the pasted page source. Ensure you saved "${token}" in your warframe.market "About" (biography) settings, refreshed your profile page, and then copied the NEW page source (CTRL+U).`
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
