/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import appletConfig from "../../firebase-applet-config.json";

// Dynamic configuration enabling graceful environment transitions under Netlify/Vite systems
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || "",
  databaseURL: import.meta.env.VITE_FIREBASE_RTDB_URL || (appletConfig as any).databaseURL
};

// Fail loudly in production if configuration variables are absent from target platform configurations
if (import.meta.env.PROD && !firebaseConfig.apiKey) {
  throw new Error(
    "[firebase.ts] VITE_FIREBASE_API_KEY is undefined. " +
    "Please configure environment variables under Netlify Dashboard → Site Settings → Environment Variables."
  );
}

const app = initializeApp(firebaseConfig);

// Configure the database connection. The user requested to bypass the AI Studio sandboxed database
// and connect directly to their manually configured native "(default)" database instead.
const envDbId = import.meta.env.VITE_FIREBASE_DB_ID;
const databaseId = envDbId !== undefined ? envDbId : "(default)";

export const db = (databaseId === "(default)" || !databaseId)
  ? getFirestore(app)
  : getFirestore(app, databaseId);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standard Operational Interception Helper (Skill requirement 3: error handlers)
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Permission Failure: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check initialization test as mandated by validation section
async function testConnection() {
  try {
    // Attempt a baseline fetch to verify sandbox visibility
    const { doc, getDocFromServer } = await import("firebase/firestore");
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firestore runtime client is in fallback offline mode.");
    }
  }
}
testConnection();
