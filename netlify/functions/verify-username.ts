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

    const normalizedIGN = claimedIGN.trim().toLowerCase();

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

    // Modern Chrome User-Agent header to avoid automated scraper blocking issues
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const profileUrl = `https://forums.warframe.com/profile/${normalizedIGN}/`;

    console.log(`Fetching profile: ${profileUrl}`);
    let response: Response;
    try {
      response = await fetchWithRetry(profileUrl, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        redirect: "follow", // Automatically follow slug redirects
      });
    } catch (fetchErr: any) {
      console.error("Forums fetch failed:", fetchErr);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Could not retrieve Warframe Forums profile page. Verify your internet, check if the IGN exists, and try again.`
        }),
      };
    }

    const htmlText = await response.text();
    const root = parse(htmlText);

    // Filter selectors to isolate "About Me" tab container
    const aboutContainer = root.querySelector('[data-role="memberContent"]') 
      || root.querySelector("#elAboutMe") 
      || root.querySelector(".cBioContent");

    if (!aboutContainer) {
      console.warn("Targeted aboutContainer element not found on page.");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "About Me section container not found on your Warframe forum profile. Ensure your profile is public."
        }),
      };
    }

    const containerText = aboutContainer.text || "";
    const lowercaseToken = token.trim().toLowerCase();
    const lowercaseAboutText = containerText.toLowerCase();

    console.log("Checking token containment in About Me container...");
    const hasToken = lowercaseAboutText.includes(lowercaseToken);

    if (!hasToken) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Token not found in About Me section. Ensure "${token}" is saved and your profile visibility is public.`
        }),
      };
    }

    // Extract canonical In-Game Name from the <title> tag
    // Format: "ShyKnees - Warframe Forums" or "ShyKnees - Page 2 - Warframe Forums"
    const titleElement = root.querySelector("title");
    let verifiedIGN = claimedIGN; // Fallback
    if (titleElement) {
      const titleText = titleElement.text || "";
      if (titleText.includes(" - ")) {
        verifiedIGN = titleText.split(" - ")[0].trim();
      }
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
