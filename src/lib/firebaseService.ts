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
import { Athlete, DistanceConfig, MatchHistoryItem, Club, VSC_DEFAULT_LOGO } from "../types";

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
  laneCapacity?: number;
  clubs?: Club[];
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
    laneCapacity?: number;
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
    clubs?: Club[];
    avatarUrl?: string;
    bannerUrl?: string;
  }
): Promise<string> {
  // 1. Fetch user profile and check for existing bans/restrictions
  const userProfile = await getUserProfile(creatorId);

  if (userProfile) {
    if (userProfile.isBanned) {
      throw new Error("BANNED");
    }
    if (userProfile.banUntil && typeof userProfile.banUntil === "number" && userProfile.banUntil > Date.now()) {
      throw new Error("RESTRICTED");
    }
  }

  // 2. Query all tournaments created by this user to verify spamming
  const tournamentsRef = collection(db, "tournaments");
  const q = query(tournamentsRef, where("creatorId", "==", creatorId));
  const querySnapshot = await getDocs(q).catch((err) => {
    console.error("Error checking spam query:", err);
    return null;
  });

  if (querySnapshot) {
    const userTournaments: { id: string; createdTime: number }[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let createdTime = Date.now();
      if (data.createdAt) {
        if (typeof data.createdAt.toMillis === "function") {
          createdTime = data.createdAt.toMillis();
        } else if (data.createdAt.seconds) {
          createdTime = data.createdAt.seconds * 1000;
        } else if (data.createdAt instanceof Date) {
          createdTime = data.createdAt.getTime();
        } else if (typeof data.createdAt === "number") {
          createdTime = data.createdAt;
        }
      }
      userTournaments.push({ id: docSnap.id, createdTime });
    });

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentTournaments = userTournaments.filter((t) => t.createdTime >= tenMinutesAgo);

    // If they have created 4 or more, this new one would make it 5 in 10 minutes!
    if (recentTournaments.length >= 4) {
      const wasRestrictedBefore = userProfile?.wasRestrictedBefore === true;
      const userRef = doc(db, "users", creatorId);

      if (wasRestrictedBefore) {
        // Repeat offender: permanently ban
        await updateDoc(userRef, {
          isBanned: true,
          banReason: "Spamming tournament creation repeat offense"
        }).catch((err) => console.error("Error permanently banning user:", err));

        // Auto-delete all tournaments created by this spammer
        for (const tour of userTournaments) {
          await deleteDoc(doc(db, "tournaments", tour.id)).catch((err) =>
            console.error(`Error deleting tournament ${tour.id} during ban:`, err)
          );
        }

        throw new Error("SPAMMING_BANNED");
      } else {
        // First offense: restrict for 24 hours
        const banDuration = 24 * 60 * 60 * 1000;
        await updateDoc(userRef, {
          banUntil: Date.now() + banDuration,
          wasRestrictedBefore: true,
          banReason: "Spamming tournament creation (5 in 10 minutes)"
        }).catch((err) => console.error("Error restricting user:", err));

        // Auto-delete all tournaments created by this spammer
        for (const tour of userTournaments) {
          await deleteDoc(doc(db, "tournaments", tour.id)).catch((err) =>
            console.error(`Error deleting tournament ${tour.id} during restriction:`, err)
          );
        }

        throw new Error("SPAMMING_RESTRICTED");
      }
    }
  }

  // 3. Create the tournament payload and save
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
    ...config,
    avatarUrl: config.avatarUrl || VSC_DEFAULT_LOGO,
    bannerUrl: config.bannerUrl || VSC_DEFAULT_LOGO
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
    const resolvedUpdates = { ...updates };
    if (resolvedUpdates.avatarUrl === "") {
      resolvedUpdates.avatarUrl = VSC_DEFAULT_LOGO;
    }
    if (resolvedUpdates.bannerUrl === "") {
      resolvedUpdates.bannerUrl = VSC_DEFAULT_LOGO;
    }
    const sanitizedUpdates = sanitizeFirestoreData(resolvedUpdates);
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

/**
 * Subscribes in real-time to all VSC System Clubs
 */
export function subscribeToVscSystemClubs(callback: (clubs: Club[]) => void) {
  const collectionRef = collection(db, "vsc_system_clubs");
  const q = query(collectionRef, orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    const list: Club[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Club);
    });
    callback(list);
  }, (error) => {
    console.warn("VSC system clubs subscription failed with order, falling back to unordered:", error);
    return onSnapshot(collectionRef, (snapshot) => {
      const list: Club[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Club);
      });
      callback(list);
    }, (err2) => {
      console.error("VSC system clubs subscription failed completely:", err2);
    });
  });
}

/**
 * Saves or updates a club in the system-wide collection
 */
export async function saveVscSystemClub(club: Club) {
  try {
    const docRef = doc(db, "vsc_system_clubs", club.id);
    const updatedClub = {
      ...club,
      avatarUrl: club.avatarUrl || VSC_DEFAULT_LOGO
    };
    await setDoc(docRef, sanitizeFirestoreData(updatedClub));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vsc_system_clubs/${club.id}`);
  }
}

/**
 * Deletes a club from the system-wide collection
 */
export async function deleteVscSystemClub(clubId: string) {
  try {
    const docRef = doc(db, "vsc_system_clubs", clubId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vsc_system_clubs/${clubId}`);
  }
}

/**
 * Subscribes to all users in real-time for QLTV admin management
 */
export function subscribeToAllUsers(callback: (users: any[]) => void) {
  const usersRef = collection(db, "users");
  return onSnapshot(usersRef, (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        ...data,
        uid: docSnap.id
      });
    });
    callback(list);
  }, (error) => {
    console.error("Error subscribing to users list:", error);
  });
}

/**
 * Translates anti-spam or ban errors into localized user-friendly messages
 */
export function getFriendlyErrorMessage(err: any, language: "vi" | "en" = "vi"): string {
  const errMsg = err?.message || String(err);
  if (errMsg.includes("BANNED")) {
    return language === "en"
      ? "Your account has been permanently banned from creating tournaments due to spamming."
      : "Tài khoản của bạn đã bị khóa vĩnh viễn khỏi quyền tạo giải đấu do vi phạm chính sách spam.";
  }
  if (errMsg.includes("RESTRICTED")) {
    return language === "en"
      ? "Your account is temporarily restricted from creating tournaments for 24 hours."
      : "Tài khoản của bạn đang bị hạn chế tạm thời khỏi quyền tạo giải đấu trong vòng 24 giờ.";
  }
  if (errMsg.includes("SPAMMING_BANNED")) {
    return language === "en"
      ? "Critical: You have continued to spam tournament creation! Your account is now permanently banned, and all your created tournaments have been cleared."
      : "Nghiêm trọng: Bạn tiếp tục tạo giải đấu quá nhanh! Tài khoản của bạn hiện đã bị KHÓA VĨNH VIỄN và tất cả giải đấu cũ của bạn đã được dọn dẹp vĩnh viễn.";
  }
  if (errMsg.includes("SPAMMING_RESTRICTED")) {
    return language === "en"
      ? "Alert: You are creating tournaments too quickly! (5 tournaments in 10 minutes). Your account has been restricted for 24 hours, and all your created tournaments have been cleared."
      : "Cảnh báo: Bạn đang tạo giải quá nhanh! (5 giải trong 10 phút). Tài khoản của bạn đã bị hạn chế tạo giải trong 24 giờ, tất cả giải đấu cũ của bạn đã được dọn dẹp khỏi hệ thống.";
  }
  return errMsg;
}

/**
 * Updates a user profile as an administrator (including custom roles & clubs)
 */
export async function updateUserProfileAdmin(uid: string, profileData: {
  displayName?: string;
  photoURL?: string;
  club?: string;
  role?: string;
  isBanned?: boolean;
  banUntil?: number | null;
  wasRestrictedBefore?: boolean;
  banReason?: string;
}) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, sanitizeFirestoreData(profileData));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

/**
 * Deletes a user profile as an administrator
 */
export async function deleteUserProfileAdmin(uid: string) {
  try {
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}

