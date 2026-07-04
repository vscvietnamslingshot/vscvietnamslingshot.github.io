export interface DistanceConfig {
  id: string;
  distance: string; // e.g. "10 Met"
  multiplier: number; // e.g. 10
  isCumulative?: boolean;
  isElimination?: boolean;
  isMaxRoundScore?: boolean;
  eliminationType?: "percent" | "count";
  eliminationValue?: number;
  isSolo?: boolean; // Solo shootout option if ties occur at elimination boundary
}

export interface Athlete {
  id: string; // e.g. "0001"
  name: string; // e.g. "Nguyễn Văn A"
  team: string; // e.g. "Team 1"
  isPrimaryTeam?: boolean;
  /**
   * Object mapping distanceId -> array of boolean representing hits (true) or misses (false).
   * Array length equals shot count (shotsCount).
   */
  scores: Record<string, boolean[]>;
  soloHits?: Record<string, number>; // Record of distanceId -> solo shoutout successful hits
  soloRounds?: Record<string, number[]>; // Record of distanceId -> solo shootout successful hits in multiple rounds
  // Additional info for athlete management
  avatarUrl?: string;
  gender?: string; // "Nam" | "Nữ"
  idCard?: string;
  dob?: string;
  hometown?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  status?: string; // "Thi đấu" | "Bỏ thi"
  email?: string; // Cloud Account email
  calledBy?: string; // Email of referee who called / is scoring this athlete
}

export interface MatchHistoryItem {
  id: string;
  date: string;
  matchName: string;
  shotCount: number;
  distances: DistanceConfig[];
  athletes: Athlete[];
  masterCount?: number;
  masterAthletes?: Athlete[];
  teamDistances?: DistanceConfig[];
  teamShotCount?: number;
  teamAthletes?: Athlete[];
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  startDate?: string;
  endDate?: string;
  isAutoBackup?: boolean;
  clubs?: Club[];
}

export interface StoredAthleteList {
  id: string;
  name: string;
  createdAt: string;
  athletes: Athlete[];
}

export interface Club {
  id: string; // unique clb ID/code
  name: string; // clb/team name
  avatarUrl?: string; // clb avatar (default empty base64 or URL)
  province?: string; // province of clb (default empty)
  creatorId?: string; // ID of the user who created this club
  creatorEmail?: string; // Email of the user who created this club
}

export interface DeviceBackupItem {
  id: string; // "latest" or "timeline-<timestamp>"
  timestamp: number;
  matchName: string;
  isTimeline: boolean;
  data: string; // Stringified JSON backup containing full active state
}



