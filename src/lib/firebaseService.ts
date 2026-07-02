import { 
  auth, 
  db, 
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "../firebase";
import { Athlete, DistanceConfig, MatchHistoryItem } from "../types";

export interface TournamentData {
  id: string;
  matchName: string;
  creatorId: string;
  creatorEmail: string;
  createdAt: any;
  updatedAt: any;
  referees: string[]; // Email list of referees
  subAdmins?: string[]; // Email list of sub admins with direct admin permission
  isPublic: boolean;
  competitionMode: "individual" | "team";
  shotsCount: number;
  teamShotsCount: number;
  directMaxPoints?: number;
  teamDirectMaxPoints?: number;
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  distances: DistanceConfig[];
  teamDistances: DistanceConfig[];
  athletes: Athlete[];
  teamAthletes: Athlete[];
  inputAthletes: Athlete[];
  teamInputAthletes: Athlete[];
  masterAthletes?: Athlete[];
  startDate?: string;
  endDate?: string;
  tournamentType?: "individual" | "team" | "combined";
  bannerUrl?: string;
  avatarUrl?: string;
  viewCount?: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function isPlainObject(val: any): boolean {
  if (val === null || typeof val !== 'object') return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item)) as any;
  }
  if (isPlainObject(obj)) {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      cleaned[key] = sanitizeFirestoreData(val);
    }
    return cleaned;
  }
  return obj;
}

interface FirestoreErrorInfo {
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ---------------- USER PROFILE HELPERS ----------------

export async function createUserProfile(uid: string, email: string, displayName: string, photoURL: string = "") {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef).catch(err => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    });
    
    if (userSnap && !userSnap.exists()) {
      const isFirstAdmin = email === "nahnatofficial@gmail.com"; // Default global admin based on email
      await setDoc(userRef, {
        uid,
        email,
        displayName: displayName || email.split("@")[0],
        photoURL,
        role: isFirstAdmin ? "admin" : "user",
        createdAt: serverTimestamp()
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      });
    }
  } catch (error) {
    console.error("Error creating user profile:", error);
  }
}

export async function getUserProfile(uid: string) {
  try {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }
  return null;
}

// ---------------- TOURNAMENT HELPERS ----------------

/**
 * Creates a new tournament in Firestore
 */
export async function createOnlineTournament(
  matchName: string,
  creatorId: string,
  creatorEmail: string,
  config: {
    competitionMode: "individual" | "team";
    tournamentType?: "individual" | "team" | "combined";
    shotsCount: number;
    teamShotsCount: number;
    directMaxPoints?: number;
    teamDirectMaxPoints?: number;
    distances: DistanceConfig[];
    teamDistances: DistanceConfig[];
    athletes: Athlete[];
    teamAthletes: Athlete[];
    inputAthletes: Athlete[];
    teamInputAthletes: Athlete[];
    masterAthletes?: Athlete[];
  }
): Promise<string> {
  const newId = `tour-${Date.now()}`;
  const tourRef = doc(db, "tournaments", newId);
  
  const payload: TournamentData = {
    id: newId,
    matchName: matchName || "Giải đấu mới",
    creatorId,
    creatorEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    referees: [], // Admin can add referee emails later
    subAdmins: [], // Sub admins with full admin rights
    isPublic: true,
    ...config
  };

  try {
    const sanitizedPayload = sanitizeFirestoreData(payload);
    await setDoc(tourRef, sanitizedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tournaments/${newId}`);
  }
  return newId;
}

/**
 * Updates a tournament in Firestore (e.g. updating scores, configs, referees)
 */
export async function updateOnlineTournament(id: string, updates: Partial<TournamentData>) {
  try {
    const tourRef = doc(db, "tournaments", id);
    const sanitizedUpdates = sanitizeFirestoreData(updates);
    await updateDoc(tourRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
  }
}

/**
 * Deletes an online tournament from Firestore
 */
export async function deleteOnlineTournament(id: string) {
  try {
    const tourRef = doc(db, "tournaments", id);
    await deleteDoc(tourRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tournaments/${id}`);
  }
}

/**
 * Subscribes to real-time list of tournaments sorted by latest createdAt
 */
export function subscribeToTournamentsList(callback: (tournaments: TournamentData[]) => void) {
  const collectionRef = collection(db, "tournaments");
  const q = query(collectionRef, orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const list: TournamentData[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as TournamentData);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "tournaments");
  });
}

/**
 * Subscribes to a single tournament documents in real-time
 */
export function subscribeToTournamentDoc(id: string, callback: (tournament: TournamentData | null, hasPendingWrites: boolean) => void) {
  const docRef = doc(db, "tournaments", id);
  return onSnapshot(docRef, (docSnap) => {
    const hasPendingWrites = docSnap.metadata.hasPendingWrites;
    if (docSnap.exists()) {
      callback(docSnap.data() as TournamentData, hasPendingWrites);
    } else {
      callback(null, hasPendingWrites);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `tournaments/${id}`);
  });
}

/**
 * Updates an existing user profile in Firestore
 */
export async function updateUserProfile(uid: string, profileData: {
  displayName?: string;
  avatarUrl?: string;
  cccd?: string;
  birthDate?: string;
  address?: string;
  province?: string;
  club?: string;
  lastDisplayNameUpdate?: string;
}) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

/**
 * Fetches a user profile by their email
 */
export async function getUserProfileByEmail(email: string) {
  try {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    const q = query(collection(db, "users"), where("email", "==", cleanEmail));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
  } catch (error) {
    console.error("Error fetching user profile by email:", error);
  }
  return null;
}

/**
 * Saves VSC System Athletes to Cloud Firestore
 */
export async function saveVscSystemAthletes(athletes: Athlete[]) {
  try {
    const docRef = doc(db, "vsc_system_athletes", "global");
    await setDoc(docRef, {
      athletes: sanitizeFirestoreData(athletes),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "vsc_system_athletes/global");
  }
}

/**
 * Fetches VSC System Athletes from Cloud Firestore
 */
export async function getVscSystemAthletes(): Promise<Athlete[]> {
  try {
    const docRef = doc(db, "vsc_system_athletes", "global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return (docSnap.data()?.athletes || []) as Athlete[];
    }
  } catch (error) {
    console.error("Error reading VSC system athletes from Firestore:", error);
  }
  return [];
}

/**
 * Subscribes in real-time to VSC System Athletes stored in Cloud Firestore
 */
export function subscribeToVscSystemAthletes(callback: (athletes: Athlete[]) => void) {
  const docRef = doc(db, "vsc_system_athletes", "global");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback((docSnap.data()?.athletes || []) as Athlete[]);
    } else {
      callback([]);
    }
  }, (error) => {
    console.warn("VSC system athletes subscription failed, falling back gracefully:", error);
  });
}

