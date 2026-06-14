import { Handler } from "@netlify/functions";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Strongly-typed WFM v2 API Response Contracts
 */
interface WfmUserProfile {
  id: string;
  ingame_name: string;
  about?: string;
  banned?: boolean;
  avatar?: string;
}

interface WfmApiResponse {
  payload?: {
    profile: WfmUserProfile;
  };
  error?: string;
}

/**
 * Defensive fetch with exponential backoff retry mechanism
 */
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      // Retry on rate limit or server error
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Fetch retry ${i + 1}/${retries} failed for ${url}. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error("Failed to fetch after retries.");
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { uid, claimedIGN, verificationCode, action } = body;

    if (!uid) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing uid in request body." }),
      };
    }

    // Initialize Firebase Admin securely
    if (!getApps().length) {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!clientEmail || !privateKey) {
        console.error("Firebase credentials missing from environment");
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Verification service temporarily unavailable. Please try again later." }),
        };
      }

      const serviceAccount = {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      };

      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    const db = getFirestore();

    /**
     * ACTION: Update username casing (verified state only)
     */
    if (action === "update-casing") {
      if (!claimedIGN) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing claimedIGN for casing update." }),
        };
      }

      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "User profile not found." }),
        };
      }

      const userData = userDoc.data() || {};
      const verification = userData.verification || {};

      if (verification.status !== "verified") {
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "You must be verified before updating capitalization.",
          }),
        };
      }

      const newCasingNormalized = claimedIGN.toLowerCase().trim();
      const savedNormalized = verification.normalizedIGN;

      if (newCasingNormalized !== savedNormalized) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: `Capitalization must remain the same name (case-insensitive match required).`,
          }),
        };
      }

      const batch = db.batch();
      batch.update(userDocRef, {
        "verification.verifiedIGN": claimedIGN,
        "verification.updatedAt": FieldValue.serverTimestamp(),
      });

      const listingsSnap = await db.collection("listings")
        .where("sellerUid", "==", uid)
        .get();

      listingsSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { sellerIGN: claimedIGN });
      });

      await batch.commit();
      console.log(`[Verifier] Casing updated to "${claimedIGN}" for UID: ${uid}`);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, verifiedIGN: claimedIGN }),
      };
    }

    /**
     * ACTION: Primary verification via WFM v2 API
     */
    if (!claimedIGN || !verificationCode) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing claimedIGN or verification code." }),
      };
    }

    const normalizedIGN = claimedIGN.toLowerCase().trim();

    // Prevent duplicate verification (username already verified by another user)
    const dupeQuery = await db.collection("users")
      .where("verification.status", "==", "verified")
      .where("verification.normalizedIGN", "==", normalizedIGN)
      .get();

    if (!dupeQuery.empty) {
      const conflicts = dupeQuery.docs.filter((doc) => doc.id !== uid);
      if (conflicts.length > 0) {
        console.warn(`[Verifier] Attempted duplicate claim of verified name: ${normalizedIGN}`);
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "This Warframe username is already verified by another user.",
          }),
        };
      }
    }

    /**
     * Query WFM v2 API with JWT authorization
     */
    const wfmApiUrl = `https://api.warframe.market/v2/profile/${encodeURIComponent(normalizedIGN)}`;
    const wfmJwtToken = process.env.WFM_JWT_TOKEN;

    if (!wfmJwtToken) {
      console.error("[Verifier] WFM_JWT_TOKEN missing from environment");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Verification service temporarily unavailable. Please try again later." }),
      };
    }

    let wfmUserData: WfmUserProfile | null = null;

    try {
      console.log(`[Verifier] Fetching WFM v2 profile: ${normalizedIGN}`);
      const wfmResponse = await fetchWithRetry(wfmApiUrl, {
        method: "GET",
        headers: {
          "Authorization": `JWT ${wfmJwtToken}`,
          "Language": "en",
          "User-Agent": "DucaPlat/2.0 (+https://ducaplat.com)",
        },
      });

      if (wfmResponse.status === 404) {
        console.warn(`[Verifier] WFM profile not found: ${normalizedIGN}`);
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "Warframe.Market profile not found. Please check your username.",
          }),
        };
      }

      if (!wfmResponse.ok) {
        console.warn(`[Verifier] WFM API error: ${wfmResponse.status}`);
        return {
          statusCode: 503,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "Warframe.Market service temporarily unavailable. Please try again in a moment.",
          }),
        };
      }

      const wfmData: WfmApiResponse = await wfmResponse.json();
      wfmUserData = wfmData.payload?.profile || null;

      if (!wfmUserData) {
        console.warn(`[Verifier] Invalid WFM response structure for: ${normalizedIGN}`);
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Failed to retrieve profile data. Please try again." }),
        };
      }

      // Security guard: check if account is banned
      if (wfmUserData.banned) {
        console.warn(`[Verifier] Blocked verification of banned account: ${wfmUserData.ingame_name}`);
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "This Warframe.Market account is banned and cannot be verified.",
          }),
        };
      }
    } catch (wfmError) {
      console.error("[Verifier] WFM API fetch failed:", wfmError);
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Unable to reach Warframe.Market. Please try again shortly.",
        }),
      };
    }

    /**
     * Validate verification code presence in profile "about" field
     */
    const aboutText = (wfmUserData.about || "").trim().toLowerCase();
    const codeToFind = verificationCode.trim().toLowerCase();

    if (!aboutText.includes(codeToFind)) {
      console.warn(
        `[Verifier] Verification code not found in profile bio for: ${normalizedIGN}`
      );
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Verification code not found in your Warframe.Market profile "About" section. Please add "${verificationCode}" to your profile bio and try again.`,
        }),
      };
    }

    /**
     * Atomic Firestore update: Mark as verified
     */
    const userDocRef = db.collection("users").doc(uid);
    const batch = db.batch();

    batch.update(userDocRef, {
      "verification.status": "verified",
      "verification.verifiedIGN": wfmUserData.ingame_name,
      "verification.normalizedIGN": normalizedIGN,
      "verification.wfmId": wfmUserData.id,
      "verification.verificationCode": null,
      "verification.verifiedAt": FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(
      `[Verifier] Verification SUCCESS: ${uid} -> ${wfmUserData.ingame_name}`
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        verifiedIGN: wfmUserData.ingame_name,
      }),
    };
  } catch (error: any) {
    console.error("[Verifier] Unexpected runtime error:", error);
    // Generic error response - never leak internal details
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "An unexpected error occurred. Please try again later.",
      }),
    };
  }
};
