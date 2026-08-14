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
import { Athlete, DistanceConfig, MatchHistoryItem, Club, VSC_DEFAULT_LOGO, SystemClub } from "../types";

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
  teamMasterAthletes?: Athlete[];
  masterCount?: number;
  startDate?: string;
  endDate?: string;
  tournamentType?: "individual" | "team" | "combined";
  bannerUrl?: string;
  avatarUrl?: string;
  viewCount?: number;
  laneCapacity?: number;
  clubs?: Club[];
  auditLog?: string;
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
    // Check if any element in this array is also an array (nested array)
    const hasNestedArray = obj.some(item => Array.isArray(item));
    if (hasNestedArray) {
      const mapObj: Record<string, any> = {};
      obj.forEach((item, idx) => {
        mapObj[String(idx)] = sanitizeFirestoreData(item);
      });
      return mapObj as any;
    }
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
    referees?: string[];
    subAdmins?: string[];
    startDate?: string;
    endDate?: string;
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
    referees: config.referees || [], // Admin can add referee emails later
    subAdmins: config.subAdmins || [], // Sub admins with full admin rights
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
  if (!id) return;
  try {
    const tourRef = doc(db, "tournaments", id);
    const snap = await getDoc(tourRef);
    if (!snap.exists()) {
      console.warn(`[updateOnlineTournament] Tournament ${id} does not exist. Skipping update.`);
      return;
    }
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
  } catch (error: any) {
    if (error?.code === "not-found" || error?.message?.includes("No document to update")) {
      console.warn(`[updateOnlineTournament] Tournament ${id} not found for update.`);
      return;
    }
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
    const seen = new Set<string>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as TournamentData;
      const id = data.id || docSnap.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({ ...data, id });
      }
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

// ---------------- SYSTEM CLUB OPERATIONS ----------------

/**
 * Creates a new official SystemClub in Firestore
 */
export async function createSystemClub(
  name: string,
  logoUrl: string,
  province: string,
  leaderId: string,
  leaderName: string,
  leaderEmail: string,
  description: string = "",
  bannerUrl: string = ""
): Promise<string> {
  const clubId = `club-${Date.now()}`;
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const newClub: SystemClub = {
    id: clubId,
    name,
    logoUrl: logoUrl || VSC_DEFAULT_LOGO,
    bannerUrl: bannerUrl || "",
    province,
    leaderId,
    leaderName,
    leaderEmail,
    description,
    createdAt: serverTimestamp(),
    members: [
      {
        userId: leaderId,
        athleteId: "",
        name: leaderName,
        email: leaderEmail,
        role: "leader",
        joinedAt: new Date().toISOString()
      }
    ],
    pendingRequests: []
  };

  try {
    const athletes = await getVscSystemAthletes();
    const matched = athletes.find(a => a.email?.trim().toLowerCase() === leaderEmail.trim().toLowerCase());
    if (matched) {
      newClub.members[0].athleteId = matched.id;
    }
  } catch (e) {
    console.warn("Failed to find leader athlete profile:", e);
  }

  try {
    const sanitized = sanitizeFirestoreData(newClub);
    await setDoc(clubRef, sanitized);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `vsc_system_clubs/${clubId}`);
  }

  try {
    const userRef = doc(db, "users", leaderId);
    await updateDoc(userRef, { club: name });
  } catch (e) {
    console.warn("Failed to update user's club in profile:", e);
  }

  return clubId;
}

/**
 * Submits a join request to a SystemClub
 */
export async function requestToJoinClub(
  clubId: string,
  userId: string,
  athleteId: string,
  name: string,
  email: string
): Promise<void> {
  const clubsSnap = await getDocs(collection(db, "vsc_system_clubs")).catch(err => {
    handleFirestoreError(err, OperationType.LIST, "vsc_system_clubs");
    throw err;
  });

  for (const d of clubsSnap.docs) {
    const club = d.data() as SystemClub;
    if (club.members?.some(m => m.userId === userId)) {
      throw new Error("ALREADY_IN_CLUB");
    }
    if (club.pendingRequests?.some(r => r.userId === userId)) {
      throw new Error("ALREADY_REQUESTED");
    }
  }

  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  const pending = clubData.pendingRequests || [];

  if (pending.some(r => r.userId === userId)) {
    return;
  }

  pending.push({
    userId,
    athleteId: athleteId || "",
    name,
    email,
    requestedAt: new Date().toISOString()
  });

  await updateDoc(clubRef, {
    pendingRequests: sanitizeFirestoreData(pending)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });
}

/**
 * Cancels a pending join request to a SystemClub
 */
export async function cancelJoinRequest(clubId: string, userId: string): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) return;
  const clubData = clubSnap.data() as SystemClub;
  const pending = (clubData.pendingRequests || []).filter(r => r.userId !== userId);
  await updateDoc(clubRef, {
    pendingRequests: sanitizeFirestoreData(pending)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });
}

/**
 * Handles a join request: approves or rejects
 */
export async function handleClubJoinRequest(
  clubId: string,
  requestUserId: string,
  action: "approve" | "reject"
): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  const pending = clubData.pendingRequests || [];
  const members = clubData.members || [];

  const requestIndex = pending.findIndex(r => r.userId === requestUserId);
  if (requestIndex === -1) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  const request = pending[requestIndex];
  pending.splice(requestIndex, 1);

  if (action === "approve") {
    members.push({
      userId: request.userId,
      athleteId: request.athleteId,
      name: request.name,
      email: request.email,
      role: "member",
      joinedAt: new Date().toISOString()
    });

    try {
      const userRef = doc(db, "users", request.userId);
      await updateDoc(userRef, { club: clubData.name });
    } catch (e) {
      console.warn("Failed to update user profile club name:", e);
    }
  }

  await updateDoc(clubRef, {
    pendingRequests: sanitizeFirestoreData(pending),
    members: sanitizeFirestoreData(members)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });
}

/**
 * Voluntarily leaves a SystemClub
 */
export async function leaveClub(clubId: string, userId: string): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  let members = clubData.members || [];

  const userMember = members.find(m => m.userId === userId);
  if (userMember && userMember.role === "leader" && members.length > 1) {
    throw new Error("LEADER_MUST_TRANSFER");
  }

  members = members.filter(m => m.userId !== userId);

  if (members.length === 0) {
    await deleteDoc(clubRef).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `vsc_system_clubs/${clubId}`);
    });
  } else {
    await updateDoc(clubRef, {
      members: sanitizeFirestoreData(members)
    }).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
    });
  }

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { club: "" });
  } catch (e) {
    console.warn("Failed to clear club from user profile:", e);
  }
}

/**
 * Removes a member from a SystemClub (Kick)
 */
export async function kickClubMember(clubId: string, userId: string): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  let members = clubData.members || [];
  members = members.filter(m => m.userId !== userId);

  await updateDoc(clubRef, {
    members: sanitizeFirestoreData(members)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { club: "" });
  } catch (e) {
    console.warn("Failed to clear club from user profile:", e);
  }
}

/**
 * Adds an athlete directly by system Athlete ID
 */
export async function addClubMemberDirectly(
  clubId: string,
  athleteId: string,
  systemAthletes: Athlete[]
): Promise<void> {
  const athlete = systemAthletes.find(a => a.id.trim().toLowerCase() === athleteId.trim().toLowerCase());
  if (!athlete) {
    throw new Error("ATHLETE_NOT_FOUND");
  }

  const clubsSnap = await getDocs(collection(db, "vsc_system_clubs")).catch(err => {
    handleFirestoreError(err, OperationType.LIST, "vsc_system_clubs");
    throw err;
  });

  for (const d of clubsSnap.docs) {
    const club = d.data() as SystemClub;
    if (club.members?.some(m => m.athleteId === athlete.id || (athlete.email && m.email === athlete.email))) {
      throw new Error("ATHLETE_ALREADY_IN_CLUB");
    }
  }

  let targetUserId = "";
  if (athlete.email) {
    const q = query(collection(db, "users"), where("email", "==", athlete.email.trim().toLowerCase()));
    const userSnap = await getDocs(q);
    if (!userSnap.empty) {
      targetUserId = userSnap.docs[0].id;
    }
  }

  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  const members = clubData.members || [];

  if (members.some(m => m.athleteId === athlete.id)) {
    return;
  }

  members.push({
    userId: targetUserId || `unlinked-${Date.now()}`,
    athleteId: athlete.id,
    name: athlete.name,
    email: athlete.email || "",
    role: "member",
    joinedAt: new Date().toISOString()
  });

  await updateDoc(clubRef, {
    members: sanitizeFirestoreData(members)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });

  if (targetUserId) {
    try {
      const userRef = doc(db, "users", targetUserId);
      await updateDoc(userRef, { club: clubData.name });
    } catch (e) {
      console.warn("Failed to update user profile club:", e);
    }
  }
}

/**
 * Transfers ownership of the SystemClub to another official member
 */
export async function transferClubLeadership(clubId: string, newLeaderUserId: string): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  const members = clubData.members || [];

  const currentLeader = members.find(m => m.role === "leader");
  const newLeader = members.find(m => m.userId === newLeaderUserId);

  if (!newLeader) {
    throw new Error("MEMBER_NOT_FOUND");
  }

  if (currentLeader) {
    currentLeader.role = "member";
  }
  newLeader.role = "leader";

  await updateDoc(clubRef, {
    leaderId: newLeader.userId,
    leaderName: newLeader.name,
    leaderEmail: newLeader.email,
    members: sanitizeFirestoreData(members)
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });
}

/**
 * Updates SystemClub profile details
 */
export async function updateClubProfile(
  clubId: string,
  updates: {
    name: string;
    logoUrl: string;
    bannerUrl?: string;
    province: string;
    description?: string;
  }
): Promise<void> {
  const clubRef = doc(db, "vsc_system_clubs", clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) {
    throw new Error("CLUB_NOT_FOUND");
  }

  const clubData = clubSnap.data() as SystemClub;
  const oldName = clubData.name;
  const newName = updates.name.trim();

  await updateDoc(clubRef, {
    name: newName,
    logoUrl: updates.logoUrl || VSC_DEFAULT_LOGO,
    bannerUrl: updates.bannerUrl || "",
    province: updates.province,
    description: updates.description || ""
  }).catch(err => {
    handleFirestoreError(err, OperationType.UPDATE, `vsc_system_clubs/${clubId}`);
  });

  if (oldName !== newName) {
    const members = clubData.members || [];
    for (const member of members) {
      if (member.userId && !member.userId.startsWith("unlinked-")) {
        try {
          const userRef = doc(db, "users", member.userId);
          await updateDoc(userRef, { club: newName });
        } catch (e) {
          console.warn(`Failed to update member ${member.userId} club name:`, e);
        }
      }
    }
  }
}

