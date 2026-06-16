import { auth, rtdb, db as firestore } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref,
  push,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  DatabaseReference,
  off,
} from "firebase/database";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

export type PresenceStatus = "online" | "online-in-game" | "offline";

interface SessionPayload {
  status: PresenceStatus;
  lastActive: object;
}

let _currentUser: User | null = null;
let _sessionRef: DatabaseReference | null = null;
let _connectedListenerRef: DatabaseReference | null = null;
let _desiredStatus: PresenceStatus = (() => {
  if (typeof window !== "undefined") {
    let pref = localStorage.getItem("preferredMarketPresence");
    if (pref === "ONLINE IN GAME") pref = "online-in-game";
    if (pref === "ONLINE") pref = "online";
    if (pref === "OFFLINE") pref = "offline";
    return (pref as PresenceStatus) || "offline";
  }
  return "offline";
})();
let _isPublished = false;
let _keepAliveInterval: any = null;

function _startKeepAlive() {
  _stopKeepAlive();
  _keepAliveInterval = setInterval(async () => {
    if (_currentUser && _sessionRef && _isPublished && _desiredStatus !== "offline") {
      try {
        const { set } = await import("firebase/database");
        await set(_sessionRef, { status: _desiredStatus, lastActive: serverTimestamp() } as SessionPayload);
      } catch (e) {
        console.warn("[Presence] Keep-alive failed:", e);
      }
    }
  }, 30000); // Keep alive every 30 seconds
}

function _stopKeepAlive() {
  if (_keepAliveInterval) {
    clearInterval(_keepAliveInterval);
    _keepAliveInterval = null;
  }
}

function getPresenceRoot(uid: string) {
  return ref(rtdb, `presence/${uid}`);
}

async function _publishSession(status: PresenceStatus): Promise<void> {
  if (!_currentUser || status === "offline") {
    await _teardownSession();
    return;
  }
  await _teardownSession();
  const sessionNode = push(getPresenceRoot(_currentUser.uid));
  _sessionRef = sessionNode;
  await onDisconnect(sessionNode).remove();
  const { set } = await import("firebase/database");
  await set(sessionNode, { status, lastActive: serverTimestamp() } as SessionPayload);
  _isPublished = true;
  _startKeepAlive();
}

async function _teardownSession(): Promise<void> {
  _stopKeepAlive();
  if (_sessionRef) {
    try {
      await onDisconnect(_sessionRef).cancel();
      await remove(_sessionRef);
    } catch (e) {
      console.warn("[Presence] Teardown skipped:", e);
    }
    _sessionRef = null;
  }
  _isPublished = false;
}

async function _syncFirestoreListings(uid: string, status: PresenceStatus): Promise<void> {
  // Only update if the authenticated user matches the requested UID
  // because otherwise Firestore rules will deny the update.
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    console.log("[Presence] Skipping Firestore listing sync: User is unauthenticated or UID mismatch.");
    return;
  }

  try {
    const q = query(collection(firestore, "listings"), where("sellerUid", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    const batch = writeBatch(firestore);
    let hasUpdates = false;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.sellerStatus !== status) {
        batch.update(doc(firestore, "listings", docSnap.id), { sellerStatus: status });
        hasUpdates = true;
      }
    });
    if (hasUpdates) {
      await batch.commit();
    }
  } catch (e) {
    console.error("[Presence] Firestore sync failed:", e);
  }
}

function _attachConnectedListener(user: User): void {
  _detachConnectedListener();
  const connectedRef = ref(rtdb, ".info/connected");
  _connectedListenerRef = connectedRef;
  let _wasConnected: boolean | null = null;

  onValue(connectedRef, async (snap) => {
    const isConnected: boolean = snap.val() === true;
    if (isConnected && _wasConnected !== true) {
      if (_desiredStatus !== "offline") {
        await _publishSession(_desiredStatus);
        await _syncFirestoreListings(user.uid, _desiredStatus);
      }
    } else if (!isConnected) {
      _isPublished = false;
      _sessionRef = null;
    }
    _wasConnected = isConnected;
  });
}

function _detachConnectedListener(): void {
  if (_connectedListenerRef) {
    off(_connectedListenerRef);
    _connectedListenerRef = null;
  }
}

async function _handleAuthChange(user: User | null): Promise<void> {
  const previousUid = _currentUser?.uid ?? null;
  const nextUid = user?.uid ?? null;

  if (nextUid === previousUid && nextUid !== null) {
    // Token refresh — same user, skip re-init
    return;
  }

  _currentUser = user;

  if (!user) {
    _detachConnectedListener();
    await _teardownSession();
    // Do NOT run _syncFirestoreListings on previousUid here because auth.currentUser is already null (the user is signed out),
    // and Firestore security rules require authentication.
    // The Sign Out button in UI already sets presence to 'offline' before logging out.
    _desiredStatus = "offline";
  } else {
    _attachConnectedListener(user);
    // Upon logging in, if we have a non-offline desired status, immediately sync it to Firestore.
    if (_desiredStatus !== "offline") {
      await _syncFirestoreListings(user.uid, _desiredStatus);
    }
  }
}

let _initialized = false;

export function initPresenceService(): void {
  if (_initialized) return;
  _initialized = true;
  onAuthStateChanged(auth, _handleAuthChange);
}

export async function setGlobalPresence(status: PresenceStatus): Promise<void> {
  _desiredStatus = status;
  if (!_currentUser) return;
  if (status === "offline") {
    await _teardownSession();
    await _syncFirestoreListings(_currentUser.uid, "offline");
  } else {
    await _publishSession(status);
    await _syncFirestoreListings(_currentUser.uid, status);
  }
}

export function getDesiredStatus(): PresenceStatus {
  return _desiredStatus;
}
