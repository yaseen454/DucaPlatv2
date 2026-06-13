/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut, getRedirectResult } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  initializing: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isWebView: boolean;
  showWebViewOverlay: boolean;
  setShowWebViewOverlay: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Parser to intercept and mitigate disallowed_useragent failures in Google OAuth
function checkInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isEmbed = (
    ua.indexOf("FBAN") > -1 ||
    ua.indexOf("FBAV") > -1 ||
    ua.indexOf("Instagram") > -1 ||
    ua.indexOf("Reddit") > -1 ||
    ua.indexOf("Discord") > -1 ||
    ua.indexOf("Slack") > -1 ||
    ua.indexOf("Telegram") > -1 ||
    ua.indexOf("MicroMessenger") > -1 || // WeChat
    ua.indexOf("Line") > -1 ||
    /Capacitor|Cordova|WebView|wv/i.test(ua)
  );
  return isEmbed;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showWebViewOverlay, setShowWebViewOverlay] = useState(false);
  
  const isWebView = checkInAppBrowser();

  // Active listeners reference stack for comprehensive cleanups (Rule 4: Listener cleanup)
  const [activeUnsubscribers, setActiveUnsubscribers] = useState<(() => void)[]>([]);

  // Function to capture and sync user profiles idempotently (Rule 8: Merging profiles)
  const syncUserProfile = async (firebaseUser: User) => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      } else {
        // Exclude 'createdAt' to ensure compliance with past-data immutability guard rules
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("User profile setup merged locally, DB write delayed or restricted.", e);
    }
  };

  useEffect(() => {
    // Step 1: Check dynamic callback redirects on mount as mandated by redirect capture sequence
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          syncUserProfile(result.user);
        }
      })
      .catch((err) => {
        if (err.code !== "auth/null-user") {
          setAuthError(err.message || "Failed redirection login verification.");
        }
      });

    // Step 2: Establish main session state subscriber
    const unsubscribeAuthHandler = onAuthStateChanged(auth, async (firebaseUser) => {
      // Rule 4: Clear all current snapshot listeners before moving onto new connection context
      activeUnsubscribers.forEach(unsub => {
        try { unsub(); } catch (err) {}
      });
      setActiveUnsubscribers([]);

      if (firebaseUser) {
        setUser(firebaseUser);
        await syncUserProfile(firebaseUser);
      } else {
        setUser(null);
      }
      setInitializing(false);
    });

    return () => {
      unsubscribeAuthHandler();
      activeUnsubscribers.forEach(unsub => {
        try { unsub(); } catch (err) {}
      });
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    if (isWebView) {
      // Rule 5: Catch WebView sandboxing and prevent 403 Google Auth crash
      setShowWebViewOverlay(true);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await syncUserProfile(result.user);
      }
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        setAuthError(error.message || "An error occurred during Google Sign-In.");
      }
    }
  };

  const logout = async () => {
    try {
      // Rule 2: Synchronously run strict local cache cleansing to isolate user data contexts
      localStorage.removeItem("ducaplat_saved_inventories");
      
      // Also trigger a state reset in active listeners
      activeUnsubscribers.forEach(unsub => {
        try { unsub(); } catch (err) {}
      });
      setActiveUnsubscribers([]);

      await signOut(auth);
      setUser(null);
    } catch (error: any) {
      setAuthError(error.message || "Logout command encountered a problem.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        authError,
        setAuthError,
        signInWithGoogle,
        logout,
        isWebView,
        showWebViewOverlay,
        setShowWebViewOverlay
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be invoked within an AuthProvider root container.");
  }
  return context;
}
