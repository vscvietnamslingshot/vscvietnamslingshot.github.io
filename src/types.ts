export interface DistanceConfig {
  id: string;
  distance: string; // e.g. "10 Met"
  multiplier: number; // e.g. 10
  shotCount?: number; // Optional round-specific individual shot count
  teamShotCount?: number; // Optional round-specific team shot count
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
  nameEditCount?: number; // Number of times the name has been edited in system
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

export interface SystemClub {
  id: string;             // Mã số CLB (vd: club-17234567)
  name: string;           // Tên câu lạc bộ (vd: 36 Slingshot Club)
  logoUrl: string;        // Ảnh đại diện / Logo câu lạc bộ
  bannerUrl?: string;     // Ảnh bìa / Banner câu lạc bộ
  province: string;       // Tỉnh thành hoạt động chính (lấy từ Dropdown 64 tỉnh thành)
  leaderId: string;       // UID tài khoản của Trưởng CLB
  leaderName: string;     // Tên của Trưởng CLB
  leaderEmail: string;    // Email liên hệ của Trưởng CLB
  description?: string;   // Giới thiệu, tôn chỉ hoạt động
  createdAt: any;
  
  // Danh sách thành viên chính thức
  members: {
    userId: string;       // UID tài khoản thành viên
    athleteId: string;    // Mã số VĐV Hệ Thống (vd: VSC-0001)
    name: string;         // Tên thành viên
    email: string;
    role: "leader" | "member"; // Vai trò
    joinedAt: string;
  }[];

  // Danh sách yêu cầu đang chờ duyệt
  pendingRequests: {
    userId: string;
    athleteId: string;
    name: string;
    email: string;
    requestedAt: string;
  }[];
}

export interface DeviceBackupItem {
  id: string; // "latest" or "timeline-<timestamp>"
  timestamp: number;
  matchName: string;
  isTimeline: boolean;
  data: string; // Stringified JSON backup containing full active state
}

export const VSC_DEFAULT_LOGO = "https://lh3.googleusercontent.com/d/1CAz9xUSO8XIvtEy9TYqil228Cz-jYcIM";



