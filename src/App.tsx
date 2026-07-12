import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, 
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw, 
  Target, 
  Trophy, 
  Settings, 
  History, 
  UserPlus, 
  Trash2, 
  Save, 
  Undo2, 
  Search, 
  RotateCcw, 
  HelpCircle,
  Sparkles,
  Info,
  Shield,
  Users,
  User,
  Globe,
  X,
  TrendingUp,
  ClipboardCheck,
  Youtube,
  Facebook,
  Share2,
  Lock,
  Unlock,
  Eye,
  Tv,
  CloudUpload
} from "lucide-react";
import { DistanceConfig, Athlete, MatchHistoryItem, StoredAthleteList, Club, VSC_DEFAULT_LOGO } from "./types";
import { useLanguage } from "./context/LanguageContext";
import { AthleteCard } from "./components/AthleteCard";
import { Leaderboard } from "./components/Leaderboard";
import { TeamLeaderboard } from "./components/TeamLeaderboard";
import { AthleteManagement } from "./components/AthleteManagement";
import { SettingsPanel } from "./components/SettingsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { MainDashboard } from "./components/MainDashboard";
import { ExportModal } from "./components/ExportModal";
import { LiveBoard } from "./components/LiveBoard";
import { VSCLogo, SlingshotIcon } from "./components/VSCLogo";

// Firebase imports
import { auth } from "./firebase";
import { subscribeToTournamentDoc, updateOnlineTournament, TournamentData, subscribeToTournamentsList, createOnlineTournament, subscribeToVscSystemClubs, saveVscSystemClub, deleteVscSystemClub, getFriendlyErrorMessage } from "./lib/firebaseService";
import { AuthModal } from "./components/AuthModal";
import { OnlineTournamentsPanel } from "./components/OnlineTournamentsPanel";
import { ControlPanel } from "./components/ControlPanel";
import { MemberManagementPanel } from "./components/MemberManagementPanel";
import { Home, LogOut, Sliders, SlidersHorizontal, ChevronDown, Play, Heart, Menu } from "lucide-react";
import {
  DEFAULT_DISTANCES,
  DEFAULT_SHOTS_COUNT,
  DEFAULT_ATHLETES,
  DEFAULT_HISTORY,
  DEFAULT_STORED_LISTS,
} from "./initialData";
import { deviceStorage } from "./lib/storage";

// --- Helper functions for centralizing base64 avatar images to save localStorage space ---
interface SavedAvatarMap {
  [key: string]: string;
}

const saveAvatarsFromAthletes = (athletesToProcess: Athlete[]) => {
  if (!athletesToProcess || !Array.isArray(athletesToProcess)) return;
  try {
    const savedAvatarsStr = localStorage.getItem("slingshot_avatars") || "{}";
    const avatarMap: SavedAvatarMap = JSON.parse(savedAvatarsStr);
    let changed = false;

    athletesToProcess.forEach((athlete) => {
      if (athlete && athlete.id && athlete.avatarUrl && athlete.avatarUrl.startsWith("data:image")) {
        if (avatarMap[athlete.id] !== athlete.avatarUrl) {
          avatarMap[athlete.id] = athlete.avatarUrl;
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem("slingshot_avatars", JSON.stringify(avatarMap));
      deviceStorage.set("slingshot_avatars", avatarMap);
    }
  } catch (e) {
    console.warn("Storage quota exceeded even for central avatars list:", e);
  }
};

function stripBase64Avatars<T>(data: T): T {
  if (!data) return data;
  try {
    const clone = JSON.parse(JSON.stringify(data));
    
    const cleanAthlete = (athlete: Athlete) => {
      if (athlete && athlete.avatarUrl && athlete.avatarUrl.startsWith("data:image")) {
        athlete.avatarUrl = `local-avatar:${athlete.id}`;
      }
    };

    if (Array.isArray(clone)) {
      clone.forEach((item: any) => {
        if (item && typeof item === "object") {
          if ("scores" in item && "id" in item) {
            cleanAthlete(item as Athlete);
          } else if ("athletes" in item) {
            if (Array.isArray(item.athletes)) {
              item.athletes.forEach(cleanAthlete);
            }
          }
        }
      });
    } else if (typeof clone === "object") {
      if ("scores" in (clone as any) && "id" in (clone as any)) {
        cleanAthlete(clone as unknown as Athlete);
      }
    }
    return clone;
  } catch (e) {
    return data;
  }
}

function restoreBase64Avatars<T>(data: T): T {
  if (!data) return data;
  try {
    const savedAvatarsStr = localStorage.getItem("slingshot_avatars");
    if (!savedAvatarsStr) return data;
    const avatarMap: SavedAvatarMap = JSON.parse(savedAvatarsStr);

    const restoreAthlete = (athlete: Athlete) => {
      if (athlete && athlete.avatarUrl && athlete.avatarUrl.startsWith("local-avatar:")) {
        const id = athlete.avatarUrl.substring("local-avatar:".length);
        if (avatarMap[id]) {
          athlete.avatarUrl = avatarMap[id];
        } else {
          athlete.avatarUrl = "";
        }
      }
    };

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item && typeof item === "object") {
          if ("scores" in item && "id" in item) {
            restoreAthlete(item as Athlete);
          } else if ("athletes" in item) {
            if (Array.isArray(item.athletes)) {
              item.athletes.forEach(restoreAthlete);
            }
          }
        }
      });
    } else if (typeof data === "object") {
      if ("scores" in (data as any) && "id" in (data as any)) {
        restoreAthlete(data as unknown as Athlete);
      }
    }
    return data;
  } catch (e) {
    return data;
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a && !b) return true; // Normalize undefined, null, falsy values, empty string
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    } else {
      if (Array.isArray(b)) return false;
      if (a === null || b === null) return false;

      const keysA = Object.keys(a).filter(k => a[k] !== undefined && a[k] !== null && a[k] !== "");
      const keysB = Object.keys(b).filter(k => b[k] !== undefined && b[k] !== null && b[k] !== "");

      if (keysA.length !== keysB.length) return false;

      for (const k of keysA) {
        if (!deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
  }

  // Double check if either value coerced is falsy, we already handled !a && !b above.
  // Normalize checking empty string vs undefined
  const strA = a === undefined || a === null ? "" : String(a);
  const strB = b === undefined || b === null ? "" : String(b);
  return strA === strB;
}

// Sub-component for Publish Draft Modal
const PublishDraftModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  draftPreviewItem: MatchHistoryItem;
  onlineTournaments: TournamentData[];
  onOverwrite: (id: string) => void;
  onCreateNew: (name: string) => void;
}> = ({ isOpen, onClose, draftPreviewItem, onlineTournaments, onOverwrite, onCreateNew }) => {
  const { language } = useLanguage();
  const cleanName = draftPreviewItem.matchName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const [publishOption, setPublishOption] = React.useState<"overwrite" | "new">(onlineTournaments.length > 0 ? "overwrite" : "new");
  
  // Find closest tournament
  const defaultTourId = React.useMemo(() => {
    if (onlineTournaments.length === 0) return "";
    const cleanDraft = cleanName.toLowerCase();
    const match = onlineTournaments.find(t => t.matchName.toLowerCase().includes(cleanDraft) || cleanDraft.includes(t.matchName.toLowerCase()));
    return match ? match.id : onlineTournaments[0].id;
  }, [onlineTournaments, cleanName]);

  const [selectedTourId, setSelectedTourId] = React.useState(defaultTourId);
  const [newTourName, setNewTourName] = React.useState(cleanName);

  // Sync selectedTourId when defaultTourId changes
  React.useEffect(() => {
    if (defaultTourId) setSelectedTourId(defaultTourId);
  }, [defaultTourId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex justify-between items-center">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider">
              {language === "en" ? "Publish draft to Online Cloud 🏆" : "Đăng bản nháp lên Online Cloud 🏆"}
            </h3>
            <p className="text-[10px] text-indigo-100 mt-1">
              {language === "en" ? "Sync history scores to the online system" : "Đồng bộ bảng điểm lịch sử của thầy cô lên hệ thống trực tuyến"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-all text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase block mb-1">
              {language === "en" ? "CURRENT DRAFT" : "BẢN NHÁP HIỆN TẠI"}
            </span>
            <div className="text-xs font-black text-slate-800 dark:text-slate-200">{draftPreviewItem.matchName}</div>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-mono">
              <span>👤 {draftPreviewItem.athletes.length} {language === "en" ? "Athletes" : "VĐV"}</span>
              <span>🎯 {draftPreviewItem.shotCount} {language === "en" ? "Shots" : "Lượt bắn"}</span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {language === "en" ? "Select Publishing Method" : "Chọn phương thức xuất bản"}
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={onlineTournaments.length === 0}
                onClick={() => setPublishOption("overwrite")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  publishOption === "overwrite"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-950"
                } ${onlineTournaments.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="text-xs font-bold">
                  {language === "en" ? "OVERWRITE online tournament" : "GHI ĐÈ giải đấu online"}
                </div>
                <div className="text-[9px] mt-1 opacity-80">
                  {language === "en" ? "Replace data of an existing online tournament" : "Thay thế dữ liệu của một giải online sẵn có"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPublishOption("new")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  publishOption === "new"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-950"
                }`}
              >
                <div className="text-xs font-bold">
                  {language === "en" ? "CREATE NEW tournament" : "TẠO GIẢI MỚI hoàn toàn"}
                </div>
                <div className="text-[9px] mt-1 opacity-80">
                  {language === "en" ? "Initialize and upload a new online tournament" : "Khởi tạo và tải lên một giải đấu trực tuyến mới"}
                </div>
              </button>
            </div>

            {publishOption === "overwrite" && onlineTournaments.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Online Tournaments List (Closest match suggested)" : "Danh sách giải online (Được gợi ý giải gần tên nhất)"}
                </label>
                <select
                  value={selectedTourId}
                  onChange={(e) => setSelectedTourId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {onlineTournaments.map((tour) => (
                    <option key={tour.id} value={tour.id}>
                      {tour.matchName} {tour.id === defaultTourId ? (language === "en" ? " ⭐️ (Most recent)" : " ⭐️ (Gần đây nhất)") : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-rose-500 font-medium">
                  {language === "en" ? "⚠️ Notice: This action will completely overwrite scores of the selected tournament." : "⚠️ Thầy cô lưu ý: Hành động này sẽ thay thế hoàn toàn điểm số của giải đấu được chọn."}
                </p>
              </div>
            )}

            {publishOption === "new" && (
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "New Online Tournament Name" : "Tên giải đấu online mới"}
                </label>
                <input
                  type="text"
                  value={newTourName}
                  onChange={(e) => setNewTourName(e.target.value)}
                  placeholder={language === "en" ? "Enter tournament name..." : "Nhập tên giải đấu..."}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
          >
            {language === "en" ? "Close" : "Đóng"}
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (publishOption === "overwrite") {
                onOverwrite(selectedTourId);
              } else {
                onCreateNew(newTourName);
              }
            }}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md text-center"
          >
            {language === "en" ? "Publish Online 🚀" : "Đăng online 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [isStorageRestoring, setIsStorageRestoring] = useState(true);
  const [isNewTournamentModalOpen, setIsNewTournamentModalOpen] = useState(false);

  // --- Persistent States from LocalStorage ---
  const [matchName, setMatchName] = useState<string>(() => {
    const saved = localStorage.getItem("slingshot_match_name");
    return saved !== null ? saved : "Giải Vô Địch Bắn Ná Slingshot 2026";
  });

  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem("slingshot_start_date") || "";
  });

  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem("slingshot_end_date") || "";
  });

  const [bannerUrl, setBannerUrl] = useState<string>(() => {
    return localStorage.getItem("slingshot_banner_url") || "";
  });

  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem("slingshot_avatar_url") || "";
  });

  const [headerTempName, setHeaderTempName] = useState<string>(matchName);

  const restoreAllData = async () => {
    try {
      const [
        avatars,
        matchNameVal,
        distancesVal,
        shotsCountVal,
        athletesVal,
        masterAthletesVal,
        historyVal,
        storedAthleteListsVal,
        activeHistoryIdVal,
        inputAthletesVal,
        competitionModeVal,
        teamDistancesVal,
        teamShotsCountVal,
        teamAthletesVal,
        teamInputAthletesVal,
        clubsVal,
        startDateVal,
        endDateVal,
        bannerUrlVal,
        avatarUrlVal,
        laneCapacityVal,
      ] = await Promise.all([
        deviceStorage.get("slingshot_avatars"),
        deviceStorage.get("slingshot_match_name"),
        deviceStorage.get("slingshot_distances"),
        deviceStorage.get("slingshot_shots_count"),
        deviceStorage.get("slingshot_athletes"),
        deviceStorage.get("slingshot_master_athletes"),
        deviceStorage.get("slingshot_history"),
        deviceStorage.get("slingshot_stored_athlete_lists"),
        deviceStorage.get("slingshot_active_history_id"),
        deviceStorage.get("slingshot_input_athletes"),
        deviceStorage.get("slingshot_competition_mode"),
        deviceStorage.get("slingshot_team_distances"),
        deviceStorage.get("slingshot_team_shots_count"),
        deviceStorage.get("slingshot_team_athletes"),
        deviceStorage.get("slingshot_team_input_athletes"),
        deviceStorage.get("slingshot_clubs"),
        deviceStorage.get("slingshot_start_date"),
        deviceStorage.get("slingshot_end_date"),
        deviceStorage.get("slingshot_banner_url"),
        deviceStorage.get("slingshot_avatar_url"),
        deviceStorage.get("slingshot_active_tournament_lane_capacity"),
      ]);

      if (avatars) {
        try {
          localStorage.setItem("slingshot_avatars", JSON.stringify(avatars));
        } catch (e) {
          console.warn("localStorage avatars sync error:", e);
        }
      }

      let hasTourParam = false;
      let urlTourParam: string | null = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        urlTourParam = params.get("tour") || params.get("id");
        if (urlTourParam && urlTourParam.startsWith("tour-")) {
          hasTourParam = true;
        }
      }

      const localActiveHistoryId = activeHistoryIdVal || (typeof window !== "undefined" ? localStorage.getItem("slingshot_active_history_id") : null);
      const isSwitchingTour = !!(hasTourParam && urlTourParam !== localActiveHistoryId);

      if (matchNameVal && !isSwitchingTour) {
        setMatchName(matchNameVal);
        setHeaderTempName(matchNameVal);
      }
      if (startDateVal && !isSwitchingTour) setStartDate(startDateVal);
      if (endDateVal && !isSwitchingTour) setEndDate(endDateVal);
      if (bannerUrlVal && !isSwitchingTour) setBannerUrl(bannerUrlVal);
      if (avatarUrlVal && !isSwitchingTour) setAvatarUrl(avatarUrlVal);
      if (distancesVal && !isSwitchingTour) setDistances(distancesVal);
      if (shotsCountVal && !isSwitchingTour) setShotsCount(Number(shotsCountVal));
      if (athletesVal && !isSwitchingTour) setAthletes(restoreBase64Avatars(athletesVal));
      if (masterAthletesVal && !isSwitchingTour) setMasterAthletes(restoreBase64Avatars(masterAthletesVal));
      if (historyVal) {
        const parsedHistory = restoreBase64Avatars(historyVal);
        setHistory((parsedHistory || []).filter((h: any) => h && h.matchName && h.matchName.trim()));
      }
      if (storedAthleteListsVal) {
        const parsedLists = restoreBase64Avatars(storedAthleteListsVal);
        setStoredAthleteLists((parsedLists || []).filter((l: any) => l && l.name && l.name.trim()));
      }
      
      if (hasTourParam && urlTourParam) {
        setActiveHistoryId(urlTourParam);
        localStorage.setItem("slingshot_active_history_id", urlTourParam);
      } else {
        setActiveHistoryId(null);
      }
      
      if (inputAthletesVal && !isSwitchingTour) setInputAthletes(restoreBase64Avatars(inputAthletesVal));
      if (clubsVal) setClubs(clubsVal);
      
      if (competitionModeVal && !isSwitchingTour) setCompetitionMode(competitionModeVal as "individual" | "team");
      if (teamDistancesVal && !isSwitchingTour) setTeamDistances(teamDistancesVal);
      if (teamShotsCountVal && !isSwitchingTour) setTeamShotsCount(Number(teamShotsCountVal));
      if (teamAthletesVal && !isSwitchingTour) setTeamAthletes(restoreBase64Avatars(teamAthletesVal));
      if (teamInputAthletesVal && !isSwitchingTour) setTeamInputAthletes(restoreBase64Avatars(teamInputAthletesVal));
      if (laneCapacityVal && !isSwitchingTour) setLaneCapacity(Number(laneCapacityVal));

    } catch (e) {
      console.error("Critical error during device storage restoration:", e);
    } finally {
      setIsStorageRestoring(false);
    }
  };

  useEffect(() => {
    restoreAllData();
  }, []);

  useEffect(() => {
    setHeaderTempName(matchName);
  }, [matchName]);

  const handleSaveHeaderMatchName = () => {
    const trimmed = headerTempName.trim();
    if (!trimmed) return;

    const oldName = matchName.trim();
    if (oldName && oldName.toLowerCase() !== trimmed.toLowerCase()) {
      setStoredAthleteLists((prev) => {
        return prev.map((item) => {
          if (item.name.trim().toLowerCase() === oldName.toLowerCase()) {
            return {
              ...item,
              name: trimmed,
            };
          }
          return item;
        });
      });

      setHistory((prev) => {
        return prev.map((item) => {
          if (item.matchName.trim().toLowerCase() === oldName.toLowerCase()) {
            return {
              ...item,
              matchName: trimmed,
            };
          }
          return item;
        });
      });
    }

    setMatchName(trimmed);
  };

  const [distances, setDistances] = useState<DistanceConfig[]>(() => {
    const saved = localStorage.getItem("slingshot_distances");
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_DISTANCES));
  });

  const [shotsCount, setShotsCount] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_shots_count");
    return saved ? Number(saved) : DEFAULT_SHOTS_COUNT;
  });

  const [athletes, setAthletes] = useState<Athlete[]>(() => {
    const saved = localStorage.getItem("slingshot_athletes");
    const parsed = saved ? restoreBase64Avatars(JSON.parse(saved)) : [];
    const seen = new Set<string>();
    return parsed.filter((a: Athlete) => {
      if (!a || !a.id) return false;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return false;
      seen.add(stripped);
      return true;
    });
  });

  const [competitionMode, setCompetitionMode] = useState<"individual" | "team">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get("mode") || params.get("competitionMode");
      if (modeParam === "individual" || modeParam === "team") {
        return modeParam;
      }
    }
    const saved = localStorage.getItem("slingshot_competition_mode");
    return (saved as "individual" | "team") || "individual";
  });

  const [tournamentType, setTournamentType] = useState<"individual" | "team" | "combined">(() => {
    const saved = localStorage.getItem("slingshot_tournament_type");
    return (saved as "individual" | "team" | "combined") || "combined";
  });

  useEffect(() => {
    if (tournamentType === "individual" && competitionMode !== "individual") {
      setCompetitionMode("individual");
    } else if (tournamentType === "team" && competitionMode !== "team") {
      setCompetitionMode("team");
    }
  }, [tournamentType, competitionMode]);

  const [isSpectatorModeOverridden, setIsSpectatorModeOverridden] = useState(false);
  const isSpectatorModeOverriddenRef = useRef(false);
  const loadedTournamentIdRef = useRef<string | null>(null);
  useEffect(() => {
    isSpectatorModeOverriddenRef.current = isSpectatorModeOverridden;
  }, [isSpectatorModeOverridden]);

  const [networkStatus, setNetworkStatus] = useState<"online" | "offline" | null>(null);
  const [dbHasPendingWrites, setDbHasPendingWrites] = useState(false);
  const onlineTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleOnline = () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
      setNetworkStatus("online");
      onlineTimerRef.current = setTimeout(() => {
        setNetworkStatus(null);
      }, 5000);
    };
    const handleOffline = () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
      setNetworkStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    };
  }, []);

  const [teamDistances, setTeamDistances] = useState<DistanceConfig[]>(() => {
    const saved = localStorage.getItem("slingshot_team_distances");
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_DISTANCES));
  });

  const [teamShotsCount, setTeamShotsCount] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_team_shots_count");
    return saved ? Number(saved) : DEFAULT_SHOTS_COUNT;
  });

  const [directMaxShots, setDirectMaxShots] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_direct_max_shots");
    return saved ? Number(saved) : 10;
  });

  const [directMaxPoints, setDirectMaxPoints] = useState<number | undefined>(() => {
    const saved = localStorage.getItem("slingshot_direct_max_points");
    return saved && saved !== "undefined" && saved !== "null" ? Number(saved) : undefined;
  });

  const [teamDirectMaxShots, setTeamDirectMaxShots] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_team_direct_max_shots");
    return saved ? Number(saved) : 10;
  });

  const [teamDirectMaxPoints, setTeamDirectMaxPoints] = useState<number | undefined>(() => {
    const saved = localStorage.getItem("slingshot_team_direct_max_points");
    return saved && saved !== "undefined" && saved !== "null" ? Number(saved) : undefined;
  });

  const [laneCapacity, setLaneCapacity] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_active_tournament_lane_capacity");
    return saved ? Number(saved) : 10;
  });

  const [teamAthletes, setTeamAthletes] = useState<Athlete[]>(() => {
    const saved = localStorage.getItem("slingshot_team_athletes");
    const parsed = saved ? restoreBase64Avatars(JSON.parse(saved)) : [];
    const seen = new Set<string>();
    return parsed.filter((a: Athlete) => {
      if (!a || !a.id) return false;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return false;
      seen.add(stripped);
      return true;
    });
  });

  const [teamInputAthletes, setTeamInputAthletes] = useState<Athlete[]>(() => {
    const saved = localStorage.getItem("slingshot_team_input_athletes");
    return saved ? restoreBase64Avatars(JSON.parse(saved)) : [];
  });

  const [masterAthletes, setMasterAthletes] = useState<Athlete[]>(() => {
    const savedGlobal = localStorage.getItem("slingshot_master_athletes_global");
    const saved = savedGlobal || localStorage.getItem("slingshot_master_athletes");
    let list: Athlete[] = [];
    if (saved) {
      list = restoreBase64Avatars(JSON.parse(saved));
    } else {
      const savedActive = localStorage.getItem("slingshot_athletes");
      list = savedActive ? restoreBase64Avatars(JSON.parse(savedActive)) : [];
    }
    const seen = new Set<string>();
    return list.filter((a: Athlete) => {
      if (!a || !a.id) return false;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return false;
      seen.add(stripped);
      return true;
    });
  });

  const [history, setHistory] = useState<MatchHistoryItem[]>(() => {
    const saved = localStorage.getItem("slingshot_history");
    const parsed = saved ? restoreBase64Avatars(JSON.parse(saved)) : DEFAULT_HISTORY;
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return (parsed || []).filter((h: any) => {
      if (!h || !h.matchName || !h.matchName.trim()) return false;
      const createdTime = h.date ? new Date(h.date).getTime() : now;
      const isExpired = (now - createdTime) > thirtyDaysMs;
      return !isExpired;
    });
  });

  const [storedAthleteLists, setStoredAthleteLists] = useState<StoredAthleteList[]>(() => {
    const saved = localStorage.getItem("slingshot_stored_athlete_lists");
    const parsed = saved ? restoreBase64Avatars(JSON.parse(saved)) : DEFAULT_STORED_LISTS;
    return (parsed || []).filter((l: any) => l && l.name && l.name.trim());
  });

  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tourParam = params.get("tour") || params.get("id");
      if (tourParam && tourParam.startsWith("tour-")) {
        return tourParam;
      }
    }
    return null;
  });

  // Authentication and realtime sync states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTournamentDoc, setCurrentTournamentDoc] = useState<TournamentData | null>(null);
  const [isTournamentConfigLoaded, setIsTournamentConfigLoaded] = useState(false);
  const [draftPreviewItem, setDraftPreviewItem] = useState<MatchHistoryItem | null>(null);
  const [isPublishDraftModalOpen, setIsPublishDraftModalOpen] = useState(false);
  const [onlineTournaments, setOnlineTournaments] = useState<TournamentData[]>([]);

  const [isShareCopied, setIsShareCopied] = useState(false);

  const handleShareActiveTournament = () => {
    if (!activeHistoryId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?tour=${activeHistoryId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2500);
    }).catch(err => {
      console.error("Failed to copy link:", err);
    });
  };

  useEffect(() => {
    let lastQuery: string | null = null;
    const handleUrlChange = () => {
      const currentQuery = window.location.search;
      if (lastQuery === null || currentQuery !== lastQuery) {
        lastQuery = currentQuery;
        const params = new URLSearchParams(currentQuery);
        
        // 1. Tour history id
        const tourParam = params.get("tour") || params.get("id");
        if (tourParam && tourParam.startsWith("tour-")) {
          setActiveHistoryId(tourParam);
          localStorage.setItem("slingshot_active_history_id", tourParam);
        } else {
          setActiveHistoryId(null);
        }

        // 2. Active Tab
        const tabParam = params.get("tab");
        const allowedTabs = ["home", "desktop", "dashboard", "scoring", "input_scores", "leaderboard", "teams", "athletes", "settings", "history", "control_panel", "qltv"];
        if (tabParam && allowedTabs.includes(tabParam)) {
          setActiveTab(tabParam as any);
        } else {
          if (tourParam && tourParam.startsWith("tour-")) {
            setActiveTab("dashboard");
          } else {
            setActiveTab("home");
          }
        }

        // 3. Subtabs
        const subtabParam = params.get("subtab");
        if (subtabParam) {
          if (["individual", "team"].includes(subtabParam)) {
            setRankingSubTab(subtabParam as any);
          }
          if (["athletes", "clubs", "vsc_system"].includes(subtabParam)) {
            setAthleteForceTab(subtabParam as any);
          }
          if (["config", "athletes"].includes(subtabParam)) {
            setSettingsSubTab(subtabParam as any);
          }
          if (["profile", "created", "referee"].includes(subtabParam)) {
            setControlPanelSubTab(subtabParam as any);
          }
        }

        // 4. Competition Mode
        const modeParam = params.get("mode") || params.get("competitionMode");
        if (modeParam === "individual" || modeParam === "team") {
          setCompetitionMode(modeParam);
          setIsSpectatorModeOverridden(true);
        }
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    const interval = setInterval(handleUrlChange, 1000);

    // Run initial parse as well
    handleUrlChange();

    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTournamentsList((list) => {
      setOnlineTournaments(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Deduplication safety effects
  useEffect(() => {
    const seen = new Set<string>();
    const hasDuplicates = athletes.some((a) => {
      if (!a || !a.id) return true;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return true;
      seen.add(stripped);
      return false;
    });

    if (hasDuplicates) {
      const cleanSeen = new Set<string>();
      const cleaned = athletes.filter((a) => {
        if (!a || !a.id) return false;
        const stripped = a.id.trim();
        if (cleanSeen.has(stripped)) return false;
        cleanSeen.add(stripped);
        return true;
      });
      setAthletes(cleaned);
    }
  }, [athletes]);

  useEffect(() => {
    const seen = new Set<string>();
    const hasDuplicates = teamAthletes.some((a) => {
      if (!a || !a.id) return true;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return true;
      seen.add(stripped);
      return false;
    });

    if (hasDuplicates) {
      const cleanSeen = new Set<string>();
      const cleaned = teamAthletes.filter((a) => {
        if (!a || !a.id) return false;
        const stripped = a.id.trim();
        if (cleanSeen.has(stripped)) return false;
        cleanSeen.add(stripped);
        return true;
      });
      setTeamAthletes(cleaned);
    }
  }, [teamAthletes]);

  useEffect(() => {
    const seen = new Set<string>();
    const hasDuplicates = masterAthletes.some((a) => {
      if (!a || !a.id) return true;
      const stripped = a.id.trim();
      if (seen.has(stripped)) return true;
      seen.add(stripped);
      return false;
    });

    if (hasDuplicates) {
      const cleanSeen = new Set<string>();
      const cleaned = masterAthletes.filter((a) => {
        if (!a || !a.id) return false;
        const stripped = a.id.trim();
        if (cleanSeen.has(stripped)) return false;
        cleanSeen.add(stripped);
        return true;
      });
      setMasterAthletes(cleaned);
    }
  }, [masterAthletes]);

  const [activeTab, setActiveTab] = useState<"home" | "desktop" | "dashboard" | "scoring" | "input_scores" | "leaderboard" | "teams" | "athletes" | "settings" | "history" | "control_panel" | "qltv">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const allowedTabs = ["home", "desktop", "dashboard", "scoring", "input_scores", "leaderboard", "teams", "athletes", "settings", "history", "control_panel", "qltv"];
      if (tabParam && allowedTabs.includes(tabParam)) {
        return tabParam as any;
      }

      const tourParam = params.get("tour") || params.get("id");
      if (tourParam && tourParam.startsWith("tour-")) {
        return "dashboard";
      }
    }
    return "home";
  });
  const [homeFilter, setHomeFilter] = useState<"all" | "all_list" | "active" | "followed">("all");
  const [athleteForceTab, setAthleteForceTab] = useState<"athletes" | "clubs" | "vsc_system">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subtabParam = params.get("subtab");
      if (subtabParam === "athletes" || subtabParam === "clubs" || subtabParam === "vsc_system") {
        return subtabParam;
      }
    }
    return "athletes";
  });
  const [settingsSubTab, setSettingsSubTab] = useState<"config" | "athletes">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subtabParam = params.get("subtab");
      if (subtabParam === "config" || subtabParam === "athletes") {
        return subtabParam;
      }
    }
    return "config";
  });
  const [controlPanelSubTab, setControlPanelSubTab] = useState<"profile" | "created" | "referee">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subtabParam = params.get("subtab");
      if (subtabParam === "profile" || subtabParam === "created" || subtabParam === "referee") {
        return subtabParam;
      }
    }
    return "profile";
  });
  const [rankingSubTab, setRankingSubTab] = useState<"individual" | "team">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subtabParam = params.get("subtab");
      if (subtabParam === "individual" || subtabParam === "team") {
        return subtabParam;
      }
    }
    return "individual";
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Click-outside handler to close user menu dropdown
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const container = document.getElementById("user-header-menu-container");
      const containerMobile = document.getElementById("user-header-menu-container-mobile");
      if (
        (container && container.contains(e.target as Node)) ||
        (containerMobile && containerMobile.contains(e.target as Node))
      ) {
        return;
      }
      setIsUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isUserMenuOpen]);

  // Keep non-logged in guests restricted to public-facing viewing tabs
  useEffect(() => {
    if (!currentUser && !["home", "dashboard", "leaderboard", "teams"].includes(activeTab)) {
      setActiveTab("home");
    }
  }, [currentUser, activeTab]);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showExitAndCreateConfirmModal, setShowExitAndCreateConfirmModal] = useState(false);
  const [switchingTournamentData, setSwitchingTournamentData] = useState<{ id: string; tournamentName: string; targetTab?: string } | null>(null);

  // Synchronize masterAthletes to slingshot_master_athletes_global to never lose them
  useEffect(() => {
    if (masterAthletes && masterAthletes.length > 0) {
      try {
        const savedGlobal = localStorage.getItem("slingshot_master_athletes_global");
        let currentGlobalList: Athlete[] = [];
        if (savedGlobal) {
          currentGlobalList = restoreBase64Avatars(JSON.parse(savedGlobal));
        } else {
          const legacySaved = localStorage.getItem("slingshot_master_athletes");
          if (legacySaved) {
            currentGlobalList = restoreBase64Avatars(JSON.parse(legacySaved));
          }
        }

        const updatedGlobalMap = new Map<string, Athlete>();
        currentGlobalList.forEach(ath => {
          if (ath && ath.id) updatedGlobalMap.set(ath.id, ath);
        });
        masterAthletes.forEach(ath => {
          if (ath && ath.id) {
            updatedGlobalMap.set(ath.id, ath);
          }
        });

        const mergedList = Array.from(updatedGlobalMap.values());
        localStorage.setItem("slingshot_master_athletes_global", JSON.stringify(stripBase64Avatars(mergedList)));
      } catch (e) {
        console.error("Failed to sync global athletes:", e);
      }
    }
  }, [masterAthletes]);

  const handleSelectTournament = (id: string, tournament: any, targetTab?: string) => {
    const targetId = id;
    const resolvedTargetTab = targetTab || "dashboard";

    // Immediately write any pending local changes to Firestore before switching to the new tournament
    if (activeHistoryId && activeHistoryId !== targetId && activeHistoryId.startsWith("tour-") && (userRole === "admin" || userRole === "referee") && isTournamentConfigLoaded && currentTournamentDoc) {
      const isDifferent = (
        !deepEqual(matchName, currentTournamentDoc?.matchName) ||
        !deepEqual(startDate, currentTournamentDoc?.startDate) ||
        !deepEqual(endDate, currentTournamentDoc?.endDate) ||
        !deepEqual(distances, currentTournamentDoc?.distances) ||
        !deepEqual(shotsCount, currentTournamentDoc?.shotsCount) ||
        !deepEqual(athletes, currentTournamentDoc?.athletes) ||
        !deepEqual(teamDistances, currentTournamentDoc?.teamDistances) ||
        !deepEqual(teamShotsCount, currentTournamentDoc?.teamShotsCount) ||
        !deepEqual(teamAthletes, currentTournamentDoc?.teamAthletes) ||
        !deepEqual(inputAthletes, currentTournamentDoc?.inputAthletes) ||
        !deepEqual(teamInputAthletes, currentTournamentDoc?.teamInputAthletes) ||
        !deepEqual(directMaxPoints, currentTournamentDoc?.directMaxPoints) ||
        !deepEqual(teamDirectMaxPoints, currentTournamentDoc?.teamDirectMaxPoints) ||
        !deepEqual(directMaxShots, currentTournamentDoc?.directMaxShots) ||
        !deepEqual(teamDirectMaxShots, currentTournamentDoc?.teamDirectMaxShots) ||
        !deepEqual(masterAthletes, currentTournamentDoc?.masterAthletes) ||
        !deepEqual(bannerUrl, currentTournamentDoc?.bannerUrl) ||
        !deepEqual(avatarUrl, currentTournamentDoc?.avatarUrl) ||
        !deepEqual(clubs, currentTournamentDoc?.clubs) ||
        laneCapacity !== currentTournamentDoc?.laneCapacity
      );
      if (isDifferent) {
        updateOnlineTournament(activeHistoryId, {
          matchName,
          startDate,
          endDate,
          distances,
          shotsCount,
          athletes,
          teamDistances,
          teamShotsCount,
          teamAthletes,
          inputAthletes,
          teamInputAthletes,
          directMaxPoints,
          teamDirectMaxPoints,
          directMaxShots,
          teamDirectMaxShots,
          masterAthletes,
          bannerUrl,
          avatarUrl,
          laneCapacity,
          clubs
        }).catch(err => console.error("Immediate switch sync failed:", err));
      }
    }

    setAthletes([]);
    setMasterAthletes([]);
    setTeamAthletes([]);
    setInputAthletes([]);
    setTeamInputAthletes([]);
    setMatchName("");
    setHeaderTempName("");
    setStartDate("");
    setEndDate("");
    setDistances(JSON.parse(JSON.stringify(DEFAULT_DISTANCES)));
    setShotsCount(DEFAULT_SHOTS_COUNT);
    setTeamDistances(JSON.parse(JSON.stringify(DEFAULT_DISTANCES)));
    setTeamShotsCount(DEFAULT_SHOTS_COUNT);
    setCompetitionMode("individual");
    setDirectMaxPoints(undefined);
    setTeamDirectMaxPoints(undefined);

    setActiveHistoryId(targetId);
    if (targetId) {
      setActiveTab(resolvedTargetTab);
    }
  };

  const confirmTournamentSwitch = () => {};

  const [searchQuery, setSearchQuery] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLiveBoardOpen, setIsLiveBoardOpen] = useState(false);

  // Protection and lock/unlock mode for Ghi Diem tab
  const [isScoringEditAuthorized, setIsScoringEditAuthorized] = useState(false);
  const [showUnlockScoreModal, setShowUnlockScoreModal] = useState(false);
  const [pendingScoreToggle, setPendingScoreToggle] = useState<{ athleteId: string; distanceId: string; shotIndex: number } | null>(null);
  const [pendingAddAthlete, setPendingAddAthlete] = useState(false);
  const [pendingScrollAthleteId, setPendingScrollAthleteId] = useState<string | null>(null);

  // Reset scoring edit authorization when switching tabs
  useEffect(() => {
    if (activeTab !== "scoring") {
      setIsScoringEditAuthorized(false);
      setPendingAddAthlete(false);
      setPendingScoreToggle(null);
    }
  }, [activeTab]);

  // Smooth scroll to the imported athletes in Ghi Diem
  useEffect(() => {
    if (activeTab === "scoring" && pendingScrollAthleteId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`athlete-card-${pendingScrollAthleteId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Give it a brief elegant glow highlight
          element.classList.add("ring-8", "ring-indigo-500/20", "transition-all", "duration-500");
          setTimeout(() => {
            element.classList.remove("ring-8", "ring-indigo-500/20");
          }, 2000);
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        setPendingScrollAthleteId(null);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab, pendingScrollAthleteId]);

  // States for the Nhập Điểm (Enter Scores) tab
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [pendingTabTarget, setPendingTabTarget] = useState<{ type: "tab" | "exit"; value: string } | null>(null);

  const [isSaveConfirmModalOpen, setIsSaveConfirmModalOpen] = useState(false);
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [isEntryDropdownOpen, setIsEntryDropdownOpen] = useState(false);
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

  useEffect(() => {
    const handleDocumentClick = () => {
      setIsEntryDropdownOpen(false);
      setIsRankingDropdownOpen(false);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  const changeTab = (targetTab: string) => {
    if (activeTab === "input_scores" && targetTab !== "input_scores" && hasUnsavedChanges) {
      setPendingTabTarget({ type: "tab", value: targetTab });
      setIsUnsavedModalOpen(true);
    } else {
      setActiveTab(targetTab);
    }
  };

  const changeExitTournament = (filter: "all" | "all_list" | "active" | "followed" = "all") => {
    if (activeTab === "input_scores" && hasUnsavedChanges) {
      setPendingTabTarget({ type: "exit", value: filter });
      setIsUnsavedModalOpen(true);
    } else {
      handleExitTournament(filter);
    }
  };

  const [inputAthletes, setInputAthletes] = useState<Athlete[]>(() => {
    const saved = localStorage.getItem("slingshot_input_athletes");
    return saved ? restoreBase64Avatars(JSON.parse(saved)) : [];
  });

  // Clubs/Teams list state
  const [clubs, setClubs] = useState<Club[]>(() => {
    const saved = localStorage.getItem("slingshot_clubs");
    if (saved) return JSON.parse(saved);
    return [];
  });
  const [isAddingAthleteToInputBoard, setIsAddingAthleteToInputBoard] = useState(false);
  const [inputBoardAddSearch, setInputBoardAddSearch] = useState("");
  const [selectedInputBoardAthleteIds, setSelectedInputBoardAthleteIds] = useState<string[]>([]);

  // States for adding an athlete to the tournament
  const [isAddingAthleteToTournament, setIsAddingAthleteToTournament] = useState(false);
  const [tourAddSearch, setTourAddSearch] = useState("");
  const [selectedTourAthleteIds, setSelectedTourAthleteIds] = useState<string[]>([]);

  // --- Sync to LocalStorage and DeviceStorage whenever state changes ---
  useEffect(() => {
    try {
      localStorage.setItem("slingshot_match_name", matchName);
      deviceStorage.set("slingshot_match_name", matchName);
    } catch (e) {
      console.error("Failed to save match name to storage:", e);
    }
  }, [matchName]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_start_date", startDate);
      deviceStorage.set("slingshot_start_date", startDate);
    } catch (e) {
      console.error("Failed to save start date to storage:", e);
    }
  }, [startDate]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_end_date", endDate);
      deviceStorage.set("slingshot_end_date", endDate);
    } catch (e) {
      console.error("Failed to save end date to storage:", e);
    }
  }, [endDate]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_banner_url", bannerUrl);
      deviceStorage.set("slingshot_banner_url", bannerUrl);
    } catch (e) {
      console.error("Failed to save banner url to storage:", e);
    }
  }, [bannerUrl]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_avatar_url", avatarUrl);
      deviceStorage.set("slingshot_avatar_url", avatarUrl);
    } catch (e) {
      console.error("Failed to save avatar url to storage:", e);
    }
  }, [avatarUrl]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_distances", JSON.stringify(distances));
      deviceStorage.set("slingshot_distances", distances);
    } catch (e) {
      console.error("Failed to save distances to storage:", e);
    }
  }, [distances]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_shots_count", shotsCount.toString());
      deviceStorage.set("slingshot_shots_count", shotsCount);
    } catch (e) {
      console.error("Failed to save shots count to storage:", e);
    }
  }, [shotsCount]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_active_tournament_lane_capacity", laneCapacity.toString());
      deviceStorage.set("slingshot_active_tournament_lane_capacity", laneCapacity);
    } catch (e) {
      console.error("Failed to save lane capacity to storage:", e);
    }
  }, [laneCapacity]);

  useEffect(() => {
    try {
      saveAvatarsFromAthletes(athletes);
      localStorage.setItem("slingshot_athletes", JSON.stringify(stripBase64Avatars(athletes)));
      deviceStorage.set("slingshot_athletes", stripBase64Avatars(athletes));
    } catch (e) {
      console.error("Failed to save athletes to storage:", e);
    }
  }, [athletes]);

  useEffect(() => {
    try {
      saveAvatarsFromAthletes(inputAthletes);
      localStorage.setItem("slingshot_input_athletes", JSON.stringify(stripBase64Avatars(inputAthletes)));
      deviceStorage.set("slingshot_input_athletes", stripBase64Avatars(inputAthletes));
    } catch (e) {
      console.error("Failed to save input athletes to storage:", e);
    }
  }, [inputAthletes]);

  useEffect(() => {
    localStorage.setItem("slingshot_competition_mode", competitionMode);
    deviceStorage.set("slingshot_competition_mode", competitionMode);
  }, [competitionMode]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_clubs", JSON.stringify(clubs));
      deviceStorage.set("slingshot_clubs", clubs);
    } catch (e) {
      console.error("Failed to save clubs to storage:", e);
    }
  }, [clubs]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_team_distances", JSON.stringify(teamDistances));
      deviceStorage.set("slingshot_team_distances", teamDistances);
    } catch (e) {
      console.error("Failed to save team distances to storage:", e);
    }
  }, [teamDistances]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_team_shots_count", teamShotsCount.toString());
      deviceStorage.set("slingshot_team_shots_count", teamShotsCount);
    } catch (e) {
      console.error("Failed to save team shots count to storage:", e);
    }
  }, [teamShotsCount]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_direct_max_shots", directMaxShots.toString());
      deviceStorage.set("slingshot_direct_max_shots", directMaxShots);
    } catch (e) {
      console.error("Failed to save direct max shots to storage:", e);
    }
  }, [directMaxShots]);

  useEffect(() => {
    try {
      if (directMaxPoints !== undefined && directMaxPoints !== null) {
        localStorage.setItem("slingshot_direct_max_points", directMaxPoints.toString());
        deviceStorage.set("slingshot_direct_max_points", directMaxPoints);
      } else {
        localStorage.removeItem("slingshot_direct_max_points");
        deviceStorage.set("slingshot_direct_max_points", "");
      }
    } catch (e) {
      console.error("Failed to save direct max points to storage:", e);
    }
  }, [directMaxPoints]);

  useEffect(() => {
    try {
      localStorage.setItem("slingshot_team_direct_max_shots", teamDirectMaxShots.toString());
      deviceStorage.set("slingshot_team_direct_max_shots", teamDirectMaxShots);
    } catch (e) {
      console.error("Failed to save team direct max shots to storage:", e);
    }
  }, [teamDirectMaxShots]);

  useEffect(() => {
    try {
      if (teamDirectMaxPoints !== undefined && teamDirectMaxPoints !== null) {
        localStorage.setItem("slingshot_team_direct_max_points", teamDirectMaxPoints.toString());
        deviceStorage.set("slingshot_team_direct_max_points", teamDirectMaxPoints);
      } else {
        localStorage.removeItem("slingshot_team_direct_max_points");
        deviceStorage.set("slingshot_team_direct_max_points", "");
      }
    } catch (e) {
      console.error("Failed to save team direct max points to storage:", e);
    }
  }, [teamDirectMaxPoints]);

  useEffect(() => {
    try {
      saveAvatarsFromAthletes(teamAthletes);
      localStorage.setItem("slingshot_team_athletes", JSON.stringify(stripBase64Avatars(teamAthletes)));
      deviceStorage.set("slingshot_team_athletes", stripBase64Avatars(teamAthletes));
    } catch (e) {
      console.error("Failed to save team athletes to storage:", e);
    }
  }, [teamAthletes]);

  useEffect(() => {
    try {
      saveAvatarsFromAthletes(teamInputAthletes);
      localStorage.setItem("slingshot_team_input_athletes", JSON.stringify(stripBase64Avatars(teamInputAthletes)));
      deviceStorage.set("slingshot_team_input_athletes", stripBase64Avatars(teamInputAthletes));
    } catch (e) {
      console.error("Failed to save team input athletes to storage:", e);
    }
  }, [teamInputAthletes]);

  useEffect(() => {
    try {
      saveAvatarsFromAthletes(masterAthletes);
      localStorage.setItem("slingshot_master_athletes", JSON.stringify(stripBase64Avatars(masterAthletes)));
      deviceStorage.set("slingshot_master_athletes", stripBase64Avatars(masterAthletes));
    } catch (e) {
      console.error("Failed to save master athletes to storage:", e);
    }
  }, [masterAthletes]);

  useEffect(() => {
    try {
      history.forEach((hItem) => {
        if (hItem.athletes) {
          saveAvatarsFromAthletes(hItem.athletes);
        }
      });
      localStorage.setItem("slingshot_history", JSON.stringify(stripBase64Avatars(history)));
      deviceStorage.set("slingshot_history", stripBase64Avatars(history));
    } catch (e) {
      console.error("Failed to save history to storage:", e);
    }
  }, [history]);

  useEffect(() => {
    try {
      storedAthleteLists.forEach((listItem) => {
        if (listItem.athletes) {
          saveAvatarsFromAthletes(listItem.athletes);
        }
      });
      localStorage.setItem("slingshot_stored_athlete_lists", JSON.stringify(stripBase64Avatars(storedAthleteLists)));
      deviceStorage.set("slingshot_stored_athlete_lists", stripBase64Avatars(storedAthleteLists));
    } catch (e) {
      console.error("Failed to save stored athlete lists to storage:", e);
    }
  }, [storedAthleteLists]);

  useEffect(() => {
    try {
      if (activeHistoryId) {
        localStorage.setItem("slingshot_active_history_id", activeHistoryId);
        deviceStorage.set("slingshot_active_history_id", activeHistoryId);
      } else {
        localStorage.removeItem("slingshot_active_history_id");
        deviceStorage.remove("slingshot_active_history_id");
      }
    } catch (e) {
      console.error("Failed to save active history ID to storage:", e);
    }
  }, [activeHistoryId]);

  // Synchronize state with browser URL query parameters, document title, and meta description
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Build Query Parameters
    const params = new URLSearchParams();
    if (activeHistoryId) {
      params.set("tour", activeHistoryId);
    }
    params.set("tab", activeTab);

    // Sub-tab query parameter depending on active tab
    if (activeTab === "leaderboard") {
      params.set("subtab", rankingSubTab);
      params.set("mode", competitionMode);
    } else if (activeTab === "athletes") {
      params.set("subtab", athleteForceTab);
    } else if (activeTab === "settings") {
      params.set("subtab", settingsSubTab);
    } else if (activeTab === "control_panel") {
      params.set("subtab", controlPanelSubTab);
    } else if (activeTab === "scoring" || activeTab === "input_scores") {
      params.set("mode", competitionMode);
    }

    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, "");

    if (newSearch !== currentSearch) {
      const newUrl = `${window.location.origin}${window.location.pathname}?${newSearch}`;
      window.history.pushState({
        tour: activeHistoryId,
        tab: activeTab,
        subtab: rankingSubTab || athleteForceTab || settingsSubTab || controlPanelSubTab,
        mode: competitionMode
      }, "", newUrl);
    }

    // 2. Generate and Set Dynamic Document Title and Meta Description
    let title = "VSC - Vietnam Slingshot Championship";
    let description = "Hệ thống quản lý giải đấu Ná cao su chuyên nghiệp Việt Nam (VSC). Bảng xếp hạng trực tuyến, ghi điểm trọng tài thời gian thực.";

    const isEng = language === "en";
    const tName = matchName || (isEng ? "New Tournament" : "Giải đấu mới");

    if (activeTab === "home") {
      title = isEng 
        ? "VSC - Vietnam Slingshot Championship | Home" 
        : "VSC - Vietnam Slingshot Championship | Trang Chủ";
      description = isEng
        ? "Home of the Vietnam Slingshot Championship (VSC). Track live slingshot events, manage scores, and follow national standings."
        : "Trang chủ hệ thống giải đấu Ná cao su Việt Nam (VSC). Xem giải đấu trực tuyến đang diễn ra và theo dõi các CLB ná cao su chuyên nghiệp.";
    } else if (activeTab === "dashboard") {
      title = isEng ? `VSC | Tournament: ${tName}` : `VSC | Giải đấu: ${tName}`;
      description = isEng
        ? `View the active match details, brackets, schedules, and real-time live scoreboard of the slingshot tournament: ${tName}.`
        : `Xem chi tiết sơ đồ thi đấu, danh sách và tiến độ cập nhật điểm số trực tiếp của giải đấu ná cao su: ${tName}.`;
    } else if (activeTab === "scoring" || activeTab === "input_scores") {
      const modeText = competitionMode === "team" ? (isEng ? "Team" : "Đồng Đội") : (isEng ? "Individual" : "Cá Nhân");
      title = isEng 
        ? `VSC | ${modeText} Score Console: ${tName}` 
        : `VSC | Ghi Điểm ${modeText}: ${tName}`;
      description = isEng
        ? `Official referee console for recording ${modeText} scores and hits dynamically for ${tName}.`
        : `Bảng điều khiển tác nghiệp dành cho Trọng tài và Ban tổ chức để nhập điểm và ghi nhận điểm số từng loạt bắn ${modeText} giải ${tName}.`;
    } else if (activeTab === "leaderboard") {
      if (competitionMode === "team") {
        if (rankingSubTab === "team") {
          title = isEng ? `VSC | Team Standings TEAM: ${tName}` : `VSC | BXH Đồng Đội TEAM: ${tName}`;
          description = isEng
            ? `Live club and team collective rankings leaderboard for ${tName} in Team category.`
            : `Bảng xếp hạng tổng điểm đồng đội TEAM, câu lạc bộ trực tiếp của giải đấu ná cao su ${tName} thuộc môi trường đồng đội.`;
        } else {
          title = isEng ? `VSC | Individual Standings TEAM: ${tName}` : `VSC | BXH Cá Nhân TEAM: ${tName}`;
          description = isEng
            ? `Live individual competitor scoreboard in Team Category for ${tName}.`
            : `Bảng xếp hạng cá nhân thi đấu trong môi trường đồng đội của giải đấu ná cao su ${tName}.`;
        }
      } else {
        if (rankingSubTab === "team") {
          title = isEng ? `VSC | Team Standings: ${tName}` : `VSC | BXH Đồng Đội: ${tName}`;
          description = isEng
            ? `Live club and team collective rankings leaderboard for ${tName} in Individual Category.`
            : `Bảng xếp hạng tổng điểm đồng đội, câu lạc bộ trực tiếp của giải đấu ná cao su ${tName} thuộc môi trường cá nhân.`;
        } else {
          title = isEng ? `VSC | Individual Standings: ${tName}` : `VSC | BXH Cá Nhân: ${tName}`;
          description = isEng
            ? `Live individual competitor scoreboard for ${tName}.`
            : `Bảng xếp hạng tổng điểm cá nhân trực tiếp của giải đấu ná cao su ${tName} thuộc môi trường cá nhân.`;
        }
      }
    } else if (activeTab === "teams") {
      title = isEng ? `VSC | Registered Teams: ${tName}` : `VSC | Danh Sách Đội: ${tName}`;
      description = isEng
        ? `List of registered clubs and team formations competing in ${tName}.`
        : `Danh sách các câu lạc bộ, đơn vị và lực lượng vận động viên đại diện tham dự giải ${tName}.`;
    } else if (activeTab === "athletes") {
      if (athleteForceTab === "clubs") {
        title = isEng ? "VSC | National Slingshot Clubs Directory" : "VSC | Thư Mục Câu Lạc Bộ Toàn Quốc";
        description = isEng
          ? "Directory of certified Slingshot clubs, teams, and training associations nationwide under VSC."
          : "Cơ sở dữ liệu các câu lạc bộ, hội nhóm Ná cao su chính thức thuộc hệ thống VSC Việt Nam.";
      } else if (athleteForceTab === "vsc_system") {
        title = isEng ? "VSC | National Slingshot Federation Database" : "VSC | Cơ Sở Dữ Liệu VSC Quốc Gia";
        description = isEng
          ? "Official ranking indices, performance standards, and nationwide record keeping for Slingshot activities."
          : "Hệ thống lưu trữ chỉ số chuyên môn, định mức phân cấp và hồ sơ thành tích hoạt động của VSC Việt Nam.";
      } else {
        title = isEng ? "VSC | Master Athletes Profiles Directory" : "VSC | Danh Sách Vận Động Viên Toàn Quốc";
        description = isEng
          ? "Comprehensive profiles directory of all registered professional slingshot athletes under the Vietnam Slingshot Championship."
          : "Hồ sơ cá nhân và lịch sử thi đấu của toàn bộ các vận động viên Ná cao su chuyên nghiệp đã đăng ký thuộc hệ thống VSC.";
      }
    } else if (activeTab === "settings") {
      title = isEng ? `VSC | Tournament Settings: ${tName}` : `VSC | Cài Đặt Giải Đấu: ${tName}`;
      description = isEng
        ? `Configure match criteria, target distances, maximum points, allowed attempts, and referee authorities for ${tName}.`
        : `Thiết lập quy chế thi đấu, cự ly, số loạt bắn, cách tính điểm và phân quyền trọng tài phụ trách của giải ${tName}.`;
    } else if (activeTab === "history") {
      title = isEng ? "VSC | Archive & History Logs" : "VSC | Lưu Trữ & Lịch Sử Giải Đấu";
      description = isEng
        ? "Access local history backups, historical scorecards, and timeline logs of previous slingshot championships."
        : "Nơi truy xuất, sao lưu phục hồi dữ liệu lịch sử các giải đấu, bảng điểm cũ và nhật ký tác nghiệp ngoại tuyến.";
    } else if (activeTab === "control_panel") {
      title = isEng ? "VSC | Organizer Control Panel" : "VSC | Bảng Điều Khiển Ban Tổ Chức";
      description = isEng
        ? "Manage your credentials, host new online championships, authorize sub-admins, and oversee referee activities."
        : "Trang cá nhân của Ban tổ chức. Tạo giải đấu online mới, phân quyền trợ lý, giám sát trọng tài và chỉnh sửa thông tin.";
    }

    // Set Document Title
    document.title = title;

    // Set Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

  }, [activeHistoryId, activeTab, rankingSubTab, athleteForceTab, settingsSubTab, controlPanelSubTab, language, matchName, competitionMode]);

  // Derived role properties for active tournament context
  const isOnlineTournament = activeHistoryId?.startsWith("tour-");
  const isGlobalAdmin = !!(currentUser?.email && (
    currentUser.email.toLowerCase().trim() === "nahnatofficial@gmail.com" || 
    currentUser.email.toLowerCase().trim() === "vscvietnamslingshot@gmail.com"
  ));
  const isTournamentOwner = currentUser && currentTournamentDoc && (currentTournamentDoc.creatorId === currentUser.uid || isGlobalAdmin);
  const isTournamentSubAdmin = currentUser && currentTournamentDoc && (currentTournamentDoc.subAdmins?.some((email: string) => email.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()));
  const isTournamentReferee = currentUser && currentTournamentDoc && (currentTournamentDoc.referees?.includes(currentUser.email || ""));

  const isTournamentEndedPast30Days = (endDateStr?: string, startDateStr?: string): boolean => {
    const targetDateStr = endDateStr || startDateStr;
    if (!targetDateStr) return false;
    
    const parts = targetDateStr.split("-");
    if (parts.length !== 3) return false;
    
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999);
    const now = new Date();
    
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    return (now.getTime() - dateObj.getTime()) > thirtyDaysInMs;
  };

  const hasEndedPast30Days = isOnlineTournament && isTournamentEndedPast30Days(currentTournamentDoc?.endDate, currentTournamentDoc?.startDate);

  const userRole = isGlobalAdmin
    ? "admin"
    : hasEndedPast30Days
      ? "spectator"
      : !currentUser
        ? "spectator"
        : !isOnlineTournament
          ? "admin" 
          : (isTournamentOwner || isTournamentSubAdmin) 
            ? "admin" 
            : isTournamentReferee 
              ? "referee" 
              : "spectator";

  // --- AUTOMATIC DUAL-BACKUP ENGINE ---
  const stateRefs = {
    matchName: useRef(matchName),
    distances: useRef(distances),
    shotsCount: useRef(shotsCount),
    athletes: useRef(athletes),
    teamDistances: useRef(teamDistances),
    teamShotsCount: useRef(teamShotsCount),
    teamAthletes: useRef(teamAthletes),
    inputAthletes: useRef(inputAthletes || []),
    teamInputAthletes: useRef(teamInputAthletes || []),
    directMaxPoints: useRef(directMaxPoints),
    teamDirectMaxPoints: useRef(teamDirectMaxPoints),
    directMaxShots: useRef(directMaxShots),
    teamDirectMaxShots: useRef(teamDirectMaxShots),
    masterAthletes: useRef(masterAthletes),
    history: useRef(history),
    userRole: useRef(userRole),
    activeHistoryId: useRef(activeHistoryId),
    currentTournamentDoc: useRef(currentTournamentDoc),
  };

  useEffect(() => { stateRefs.matchName.current = matchName; }, [matchName]);
  useEffect(() => { stateRefs.distances.current = distances; }, [distances]);
  useEffect(() => { stateRefs.shotsCount.current = shotsCount; }, [shotsCount]);
  useEffect(() => { stateRefs.athletes.current = athletes; }, [athletes]);
  useEffect(() => { stateRefs.teamDistances.current = teamDistances; }, [teamDistances]);
  useEffect(() => { stateRefs.teamShotsCount.current = teamShotsCount; }, [teamShotsCount]);
  useEffect(() => { stateRefs.teamAthletes.current = teamAthletes; }, [teamAthletes]);
  useEffect(() => { stateRefs.inputAthletes.current = inputAthletes || []; }, [inputAthletes]);
  useEffect(() => { stateRefs.teamInputAthletes.current = teamInputAthletes || []; }, [teamInputAthletes]);
  useEffect(() => { stateRefs.directMaxPoints.current = directMaxPoints; }, [directMaxPoints]);
  useEffect(() => { stateRefs.teamDirectMaxPoints.current = teamDirectMaxPoints; }, [teamDirectMaxPoints]);
  useEffect(() => { stateRefs.directMaxShots.current = directMaxShots; }, [directMaxShots]);
  useEffect(() => { stateRefs.teamDirectMaxShots.current = teamDirectMaxShots; }, [teamDirectMaxShots]);
  useEffect(() => { stateRefs.masterAthletes.current = masterAthletes; }, [masterAthletes]);
  useEffect(() => { stateRefs.history.current = history; }, [history]);
  useEffect(() => { stateRefs.userRole.current = userRole; }, [userRole]);
  useEffect(() => { stateRefs.activeHistoryId.current = activeHistoryId; }, [activeHistoryId]);
  useEffect(() => { stateRefs.currentTournamentDoc.current = currentTournamentDoc; }, [currentTournamentDoc]);

  const performAutoBackup = (isTimeline: boolean) => {
    // Only perform background auto-backups for active admins/owners and sub-admins
    if (stateRefs.userRole.current !== "admin" && stateRefs.userRole.current !== "subAdmin") return;

    // Check 15-minute creation gate
    let creationTimeMs = Date.now();
    const currentActiveId = stateRefs.activeHistoryId.current;
    const currentDoc = stateRefs.currentTournamentDoc.current;

    if (currentActiveId) {
      if (currentActiveId.startsWith("tour-") && currentDoc?.createdAt) {
        if (typeof currentDoc.createdAt.toDate === "function") {
          creationTimeMs = currentDoc.createdAt.toDate().getTime();
        } else if (currentDoc.createdAt.seconds) {
          creationTimeMs = currentDoc.createdAt.seconds * 1000;
        } else {
          const parsed = Date.parse(currentDoc.createdAt);
          if (!isNaN(parsed)) creationTimeMs = parsed;
        }
      } else {
        const storedCreated = localStorage.getItem(`slingshot_created_at_${currentActiveId}`);
        if (storedCreated) {
          creationTimeMs = Number(storedCreated);
        }
      }
    } else {
      const storedCreated = localStorage.getItem("slingshot_created_at_local");
      if (storedCreated) {
        creationTimeMs = Number(storedCreated);
      } else {
        const now = Date.now();
        localStorage.setItem("slingshot_created_at_local", now.toString());
        creationTimeMs = now;
      }
    }

    const minutesElapsed = (Date.now() - creationTimeMs) / (60 * 1000);
    if (minutesElapsed < 15) {
      console.log(`[AutoBackup] Skipped: only runs 15 minutes after creation. Elapsed: ${minutesElapsed.toFixed(1)}m`);
      return;
    }

    try {
      const backupData = {
        matchName: stateRefs.matchName.current,
        distances: stateRefs.distances.current,
        shotsCount: stateRefs.shotsCount.current,
        athletes: stripBase64Avatars(stateRefs.athletes.current),
        teamDistances: stateRefs.teamDistances.current,
        teamShotsCount: stateRefs.teamShotsCount.current,
        teamAthletes: stripBase64Avatars(stateRefs.teamAthletes.current),
        inputAthletes: stripBase64Avatars(stateRefs.inputAthletes.current),
        teamInputAthletes: stripBase64Avatars(stateRefs.teamInputAthletes.current),
        directMaxPoints: stateRefs.directMaxPoints.current,
        teamDirectMaxPoints: stateRefs.teamDirectMaxPoints.current,
        directMaxShots: stateRefs.directMaxShots.current,
        teamDirectMaxShots: stateRefs.teamDirectMaxShots.current,
        masterAthletes: stripBase64Avatars(stateRefs.masterAthletes.current),
        history: stripBase64Avatars(stateRefs.history.current),
        activeHistoryId: currentActiveId,
        backedUpAt: new Date().toISOString(),
      };

      const dataStr = JSON.stringify(backupData);
      const timestamp = Date.now();
      const currentMatchName = stateRefs.matchName.current || "Giải đấu không tên";

      // Read current local backups index
      const savedIndex = localStorage.getItem("vsc_device_backups_index");
      let backupsIndex: { id: string; timestamp: number; matchName: string; isTimeline: boolean }[] = [];
      if (savedIndex) {
        try {
          backupsIndex = JSON.parse(savedIndex);
        } catch {
          backupsIndex = [];
        }
      }

      if (isTimeline) {
        // Timeline Backup (Every 15 minutes - max 5 files)
        const newBackupId = `vsc_backup_timeline_${timestamp}`;
        localStorage.setItem(newBackupId, dataStr);

        backupsIndex.unshift({
          id: newBackupId,
          timestamp,
          matchName: currentMatchName,
          isTimeline: true
        });

        // Retain only latest 5 timeline archives
        const timelineBackups = backupsIndex.filter(b => b.isTimeline);
        if (timelineBackups.length > 5) {
          const toRemove = timelineBackups.slice(5);
          toRemove.forEach(b => {
            localStorage.removeItem(b.id);
          });
          backupsIndex = backupsIndex.filter(b => !toRemove.some(r => r.id === b.id));
        }
      } else {
        // Latest Backup (Every 5 minutes - overwrite)
        const latestId = "vsc_backup_latest";
        localStorage.setItem(latestId, dataStr);

        const latestIdx = backupsIndex.findIndex(b => b.id === latestId);
        const item = {
          id: latestId,
          timestamp,
          matchName: currentMatchName,
          isTimeline: false
        };
        if (latestIdx !== -1) {
          backupsIndex[latestIdx] = item;
        } else {
          backupsIndex.push(item);
        }
      }

      localStorage.setItem("vsc_device_backups_index", JSON.stringify(backupsIndex));
      window.dispatchEvent(new CustomEvent("vsc_backups_updated"));
      console.log(`[AutoBackup] Created ${isTimeline ? "Timeline" : "Latest"} local backup successfully.`);
    } catch (err) {
      console.warn("[AutoBackup] Failed to run background auto-backup:", err);
    }
  };

  const performHistoryAutoBackup = () => {
    // Only perform background auto-backups for active admins/owners and sub-admins
    if (stateRefs.userRole.current !== "admin" && stateRefs.userRole.current !== "subAdmin") return;

    // Check 15-minute creation gate
    let creationTimeMs = Date.now();
    const currentActiveId = stateRefs.activeHistoryId.current;
    const currentDoc = stateRefs.currentTournamentDoc.current;

    if (currentActiveId) {
      if (currentActiveId.startsWith("tour-") && currentDoc?.createdAt) {
        if (typeof currentDoc.createdAt.toDate === "function") {
          creationTimeMs = currentDoc.createdAt.toDate().getTime();
        } else if (currentDoc.createdAt.seconds) {
          creationTimeMs = currentDoc.createdAt.seconds * 1000;
        } else {
          const parsed = Date.parse(currentDoc.createdAt);
          if (!isNaN(parsed)) creationTimeMs = parsed;
        }
      } else {
        const storedCreated = localStorage.getItem(`slingshot_created_at_${currentActiveId}`);
        if (storedCreated) {
          creationTimeMs = Number(storedCreated);
        }
      }
    } else {
      const storedCreated = localStorage.getItem("slingshot_created_at_local");
      if (storedCreated) {
        creationTimeMs = Number(storedCreated);
      } else {
        const now = Date.now();
        localStorage.setItem("slingshot_created_at_local", now.toString());
        creationTimeMs = now;
      }
    }

    const minutesElapsed = (Date.now() - creationTimeMs) / (60 * 1000);
    if (minutesElapsed < 15) {
      console.log(`[HistoryAutoBackup] Skipped: only runs 15 minutes after creation. Elapsed: ${minutesElapsed.toFixed(1)}m`);
      return;
    }

    try {
      const pad = (n: number) => n.toString().padStart(2, "0");
      const formatBackupTime = (date: Date) => {
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const DD = pad(date.getDate());
        const MM = pad(date.getMonth() + 1);
        const YYYY = date.getFullYear();
        return `${hh}:${mm} - ${DD}/${MM}/${YYYY}`;
      };

      const currentMatchName = stateRefs.matchName.current || "Giải đấu không tên";
      const finalName = `${currentMatchName} (${formatBackupTime(new Date())})`;
      
      const restoredAthletes = restoreBase64Avatars(stateRefs.athletes.current);

      const newHistoryItem: MatchHistoryItem = {
        id: `hist-auto-${Date.now()}`,
        date: new Date().toISOString(),
        matchName: finalName,
        shotCount: stateRefs.shotsCount.current,
        distances: stateRefs.distances.current,
        athletes: restoredAthletes,
        masterCount: restoredAthletes.length,
        masterAthletes: restoredAthletes,
        teamDistances: stateRefs.teamDistances.current,
        teamShotCount: stateRefs.teamShotsCount.current,
        teamAthletes: restoreBase64Avatars(stateRefs.teamAthletes.current),
        isAutoBackup: true,
      };

      setHistory((prev) => [newHistoryItem, ...prev]);
      console.log(`[HistoryAutoBackup] Created history record archive: ${finalName}`);
    } catch (err) {
      console.warn("[HistoryAutoBackup] Failed to run history auto-backup:", err);
    }
  };

  // Run the background intervals
  useEffect(() => {
    // Overwrite backup runs every 5 minutes
    const latestTimer = setInterval(() => {
      performAutoBackup(false);
    }, 5 * 60 * 1000);

    // Snapshot timeline backup runs every 15 minutes
    const timelineTimer = setInterval(() => {
      performAutoBackup(true);
    }, 15 * 60 * 1000);

    // History auto-backup runs every 20 minutes (new requirement)
    const historyAutoTimer = setInterval(() => {
      performHistoryAutoBackup();
    }, 20 * 60 * 1000);

    return () => {
      clearInterval(latestTimer);
      clearInterval(timelineTimer);
      clearInterval(historyAutoTimer);
    };
  }, []);

  // Backups recovery and deletion handlers
  const handleRestoreDeviceBackup = (backupId: string) => {
    try {
      const dataStr = localStorage.getItem(backupId);
      if (!dataStr) {
        alert("Không tìm thấy dữ liệu sao lưu!");
        return false;
      }
      const success = handleImportFullBackup(dataStr);
      if (success) {
        alert("✓ Đã khôi phục thành công toàn bộ dữ liệu từ Bản sao lưu nội bộ!");
      }
      return success;
    } catch (err) {
      alert("Lỗi khi khôi phục bản sao lưu: " + String(err));
      return false;
    }
  };

  const handleDeleteDeviceBackup = (backupId: string) => {
    try {
      localStorage.removeItem(backupId);
      const savedIndex = localStorage.getItem("vsc_device_backups_index");
      if (savedIndex) {
        const backupsIndex = JSON.parse(savedIndex);
        const filtered = backupsIndex.filter((b: any) => b.id !== backupId);
        localStorage.setItem("vsc_device_backups_index", JSON.stringify(filtered));
      }
      window.dispatchEvent(new CustomEvent("vsc_backups_updated"));
      return true;
    } catch (err) {
      console.error("Failed to delete device backup:", err);
      return false;
    }
  };

  // Subscribe to real-time system clubs
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToVscSystemClubs((remoteClubs) => {
        if (remoteClubs) {
          setClubs(remoteClubs);
          localStorage.setItem("slingshot_clubs", JSON.stringify(remoteClubs));
        }
      });
    } catch (err) {
      console.warn("Could not subscribe to VSC system clubs:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  // Subscribe to real-time online document shifts
  useEffect(() => {
    // Reset previous doc/role states immediately to avoid stale role bleed-through
    setCurrentTournamentDoc(null);
    setIsTournamentConfigLoaded(false);
    setIsSpectatorModeOverridden(false);

    if (!activeHistoryId || !activeHistoryId.startsWith("tour-")) {
      loadedTournamentIdRef.current = null;
      return;
    }

    let isFirstSnapshotOfSubscription = true;

    const unsubscribe = subscribeToTournamentDoc(activeHistoryId, (docVal, pending) => {
      setDbHasPendingWrites(pending);
      if (docVal) {
        setCurrentTournamentDoc(docVal);
        
        const isNewLoad = isFirstSnapshotOfSubscription;
        if (isFirstSnapshotOfSubscription) {
          isFirstSnapshotOfSubscription = false;
        }
        if (isNewLoad) {
          loadedTournamentIdRef.current = activeHistoryId;
        }

        // Calculate role dynamically for the incoming document to avoid stale state and dependency-array loops
        const isOwner = currentUser && (docVal.creatorId === currentUser.uid || isGlobalAdmin);
        const isSubAdmin = currentUser && (docVal.subAdmins?.some((email: string) => email.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()));
        const isReferee = currentUser && (docVal.referees?.includes(currentUser.email || ""));
        const isOnlineTour = activeHistoryId?.startsWith("tour-");
        const hasEnded = isOnlineTour && isTournamentEndedPast30Days(docVal.endDate, docVal.startDate);

        const calcRole = isGlobalAdmin
          ? "admin"
          : hasEnded
            ? "spectator"
            : !currentUser
              ? "spectator"
              : (isOwner || isSubAdmin) 
                ? "admin" 
                : isReferee 
                  ? "referee" 
                  : "spectator";

        // Always sync the configuration states from the database in real-time, even for admins.
        // This ensures multi-device and multi-admin setups do not overwrite or reset each other's configurations
        // when one client is slightly out of sync.
        const shouldOverwriteConfig = true;

        if (shouldOverwriteConfig) {
          if (docVal.matchName) {
            setMatchName((prev) => prev === docVal.matchName ? prev : docVal.matchName);
            setHeaderTempName((prev) => prev === docVal.matchName ? prev : docVal.matchName);
          }
          if (docVal.startDate !== undefined) {
            setStartDate((prev) => prev === (docVal.startDate || "") ? prev : (docVal.startDate || ""));
          }
          if (docVal.endDate !== undefined) {
            setEndDate((prev) => prev === (docVal.endDate || "") ? prev : (docVal.endDate || ""));
          }
          if (docVal.bannerUrl !== undefined) {
            setBannerUrl((prev) => prev === (docVal.bannerUrl || VSC_DEFAULT_LOGO) ? prev : (docVal.bannerUrl || VSC_DEFAULT_LOGO));
          }
          if (docVal.avatarUrl !== undefined) {
            setAvatarUrl((prev) => prev === (docVal.avatarUrl || VSC_DEFAULT_LOGO) ? prev : (docVal.avatarUrl || VSC_DEFAULT_LOGO));
          }
          if (docVal.tournamentType) {
            setTournamentType((prev) => {
              if (prev === docVal.tournamentType) return prev;
              localStorage.setItem("slingshot_tournament_type", docVal.tournamentType);
              return docVal.tournamentType;
            });
          } else if (docVal.competitionMode) {
            const fallback = docVal.competitionMode === "team" ? "team" : "combined";
            setTournamentType((prev) => {
              if (prev === fallback) return prev;
              localStorage.setItem("slingshot_tournament_type", fallback);
              return fallback;
            });
          }
          if (docVal.competitionMode) {
            const isCombined = docVal.tournamentType === "combined" || tournamentType === "combined";
            if (!isSpectatorModeOverriddenRef.current && !isCombined) {
              setCompetitionMode((prev) => prev === docVal.competitionMode ? prev : docVal.competitionMode);
            }
          }
          if (docVal.shotsCount) {
            setShotsCount((prev) => prev === docVal.shotsCount ? prev : docVal.shotsCount);
          }
          if (docVal.teamShotsCount) {
            setTeamShotsCount((prev) => prev === docVal.teamShotsCount ? prev : docVal.teamShotsCount);
          }
          if (docVal.laneCapacity !== undefined && docVal.laneCapacity !== null) {
            setLaneCapacity((prev) => {
              if (prev === docVal.laneCapacity) return prev;
              localStorage.setItem("slingshot_active_tournament_lane_capacity", docVal.laneCapacity.toString());
              return docVal.laneCapacity;
            });
          }
          if (docVal.distances) {
            setDistances((prev) => deepEqual(prev, docVal.distances) ? prev : docVal.distances);
          }
          if (docVal.teamDistances) {
            setTeamDistances((prev) => deepEqual(prev, docVal.teamDistances) ? prev : docVal.teamDistances);
          }
        }

        // Always sync score/athlete state, as referee(s) score athletes in real-time
        setAthletes((prev) => deepEqual(prev, docVal.athletes || []) ? prev : (docVal.athletes || []));
        setTeamAthletes((prev) => deepEqual(prev, docVal.teamAthletes || []) ? prev : (docVal.teamAthletes || []));
        setInputAthletes((prev) => deepEqual(prev, docVal.inputAthletes || []) ? prev : (docVal.inputAthletes || []));
        setTeamInputAthletes((prev) => deepEqual(prev, docVal.teamInputAthletes || []) ? prev : (docVal.teamInputAthletes || []));
        setMasterAthletes((prev) => {
          const target = docVal.masterAthletes || docVal.athletes || [];
          return deepEqual(prev, target) ? prev : target;
        });
        if (docVal.directMaxPoints !== undefined) {
          const target = docVal.directMaxPoints !== null ? docVal.directMaxPoints : undefined;
          setDirectMaxPoints((prev) => prev === target ? prev : target);
        }
        if (docVal.teamDirectMaxPoints !== undefined) {
          const target = docVal.teamDirectMaxPoints !== null ? docVal.teamDirectMaxPoints : undefined;
          setTeamDirectMaxPoints((prev) => prev === target ? prev : target);
        }
        if (docVal.directMaxShots !== undefined) {
          const target = docVal.directMaxShots !== null ? docVal.directMaxShots : 10;
          setDirectMaxShots((prev) => prev === target ? prev : target);
        }
        if (docVal.teamDirectMaxShots !== undefined) {
          const target = docVal.teamDirectMaxShots !== null ? docVal.teamDirectMaxShots : 10;
          setTeamDirectMaxShots((prev) => prev === target ? prev : target);
        }

        setIsTournamentConfigLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [activeHistoryId, currentUser, isGlobalAdmin]);

  // Cloud state publisher effect (Debounced to aggregate scoring events)
  useEffect(() => {
    if (!activeHistoryId || !activeHistoryId.startsWith("tour-")) return;
    if (loadedTournamentIdRef.current !== activeHistoryId) return;
    if (userRole !== "admin" && userRole !== "referee") return;
    if (!isTournamentConfigLoaded || !currentTournamentDoc) return;

    // Compare what we locally have with currentTournamentDoc to prevent echo updates
    const isDifferent = (
      !deepEqual(matchName, currentTournamentDoc?.matchName) ||
      !deepEqual(startDate, currentTournamentDoc?.startDate) ||
      !deepEqual(endDate, currentTournamentDoc?.endDate) ||
      !deepEqual(distances, currentTournamentDoc?.distances) ||
      !deepEqual(shotsCount, currentTournamentDoc?.shotsCount) ||
      !deepEqual(athletes, currentTournamentDoc?.athletes) ||
      !deepEqual(teamDistances, currentTournamentDoc?.teamDistances) ||
      !deepEqual(teamShotsCount, currentTournamentDoc?.teamShotsCount) ||
      !deepEqual(teamAthletes, currentTournamentDoc?.teamAthletes) ||
      !deepEqual(inputAthletes, currentTournamentDoc?.inputAthletes) ||
      !deepEqual(teamInputAthletes, currentTournamentDoc?.teamInputAthletes) ||
      !deepEqual(directMaxPoints, currentTournamentDoc?.directMaxPoints) ||
      !deepEqual(teamDirectMaxPoints, currentTournamentDoc?.teamDirectMaxPoints) ||
      !deepEqual(directMaxShots, currentTournamentDoc?.directMaxShots) ||
      !deepEqual(teamDirectMaxShots, currentTournamentDoc?.teamDirectMaxShots) ||
      !deepEqual(masterAthletes, currentTournamentDoc?.masterAthletes) ||
      !deepEqual(bannerUrl, currentTournamentDoc?.bannerUrl) ||
      !deepEqual(avatarUrl, currentTournamentDoc?.avatarUrl) ||
      !deepEqual(clubs, currentTournamentDoc?.clubs) ||
      laneCapacity !== currentTournamentDoc?.laneCapacity
    );

    if (!isDifferent) return;

    const timer = setTimeout(async () => {
      try {
        await updateOnlineTournament(activeHistoryId, {
          matchName,
          startDate,
          endDate,
          distances,
          shotsCount,
          athletes,
          teamDistances,
          teamShotsCount,
          teamAthletes,
          inputAthletes,
          teamInputAthletes,
          directMaxPoints,
          teamDirectMaxPoints,
          directMaxShots,
          teamDirectMaxShots,
          masterAthletes,
          bannerUrl,
          avatarUrl,
          laneCapacity,
          clubs
        });
      } catch (err) {
        console.error("Cloud synchronization failed:", err);
      }
    }, 850);

    return () => clearTimeout(timer);
  }, [
    activeHistoryId,
    userRole,
    matchName,
    startDate,
    endDate,
    distances,
    shotsCount,
    athletes,
    teamDistances,
    teamShotsCount,
    teamAthletes,
    inputAthletes,
    teamInputAthletes,
    directMaxPoints,
    teamDirectMaxPoints,
    directMaxShots,
    teamDirectMaxShots,
    masterAthletes,
    bannerUrl,
    avatarUrl,
    laneCapacity,
    currentTournamentDoc,
    isTournamentConfigLoaded,
    clubs
  ]);

  // Action hook to automatically redirect unauthorized spectators
  useEffect(() => {
    if (userRole === "spectator") {
      if (activeTab === "scoring" || activeTab === "input_scores" || activeTab === "athletes" || activeTab === "settings" || activeTab === "history") {
        setActiveTab("dashboard");
      }
    } else if (userRole === "referee") {
      if (activeTab === "athletes" || activeTab === "settings" || activeTab === "history") {
        setActiveTab("input_scores");
      }
    }
  }, [userRole, activeTab]);

  // Auto-save tournament session data (including roster and point modifications) on changes
  useEffect(() => {
    if (!matchName || !matchName.trim()) {
      return;
    }
    if (athletes.length === 0 && masterAthletes.length === 0 && teamAthletes.length === 0) {
      return;
    }

    const athletesToSave = masterAthletes.length > 0 ? masterAthletes : athletes;

    // 1. Update or Insert the tournament snapshot in the history archive
    setHistory((prevHistory) => {
      let existingIndex = -1;
      if (activeHistoryId) {
        existingIndex = prevHistory.findIndex((h) => h.id === activeHistoryId);
      }
      if (existingIndex === -1) {
        existingIndex = prevHistory.findIndex(
          (h) => h.matchName.trim().toLowerCase() === matchName.trim().toLowerCase()
        );
      }

      const matchId = existingIndex > -1 ? prevHistory[existingIndex].id : activeHistoryId || `hist-${Date.now()}`;
      
      const updatedItem: MatchHistoryItem = {
        id: matchId,
        date: new Date().toISOString(),
        matchName: matchName.trim(),
        shotCount: shotsCount,
        distances: [...distances],
        athletes: JSON.parse(JSON.stringify(athletes)),
        masterCount: masterAthletes.length,
        masterAthletes: JSON.parse(JSON.stringify(masterAthletes)),
        teamDistances: [...teamDistances],
        teamShotCount: teamShotsCount,
        teamAthletes: JSON.parse(JSON.stringify(teamAthletes)),
        startDate: startDate,
        endDate: endDate,
      };

      // Set active history ID safely
      if (activeHistoryId !== matchId) {
        setTimeout(() => setActiveHistoryId(matchId), 0);
      }

      if (existingIndex > -1) {
        const copy = [...prevHistory];
        copy[existingIndex] = updatedItem;
        return copy;
      } else {
        return [updatedItem, ...prevHistory];
      }
    });

    // 2. Update or Insert the saved roster list under the same tournament name
    setStoredAthleteLists((prevLists) => {
      const existingIdx = prevLists.findIndex(
        (list) => list.name.trim().toLowerCase() === matchName.trim().toLowerCase()
      );

      const listId = existingIdx > -1 ? prevLists[existingIdx].id : `list-${Date.now()}`;
      const updatedList: StoredAthleteList = {
        id: listId,
        name: matchName.trim(),
        createdAt: new Date().toISOString(),
        athletes: JSON.parse(JSON.stringify(athletesToSave)),
      };

      if (existingIdx > -1) {
        const copy = [...prevLists];
        copy[existingIdx] = updatedList;
        return copy;
      } else {
        return [updatedList, ...prevLists];
      }
    });

  }, [matchName, distances, shotsCount, athletes, masterAthletes, activeHistoryId, teamDistances, teamShotsCount, teamAthletes, startDate, endDate]);

  // Combine all master athletes (registered in Quản lý VĐV, including Bỏ thi) to display in Leaderboard
  // Merging both saved list scores (athletes) and live, unsaved template input list scores (inputAthletes) so they show up in real-time
  const leaderboardAthletes = useMemo(() => {
    return masterAthletes.map((m) => {
      const activeAth = athletes.find((a) => a.id === m.id);
      const inputAth = inputAthletes.find((a) => a.id === m.id);
      
      const mergedScores: Record<string, (boolean | null)[]> = {};
      // Initialize with default empty slots first
      distances.forEach((d) => {
        mergedScores[d.id] = Array(shotsCount).fill(null);
      });
      
      // Override with activeAth scores
      if (activeAth) {
        Object.keys(activeAth.scores || {}).forEach((k) => {
          if (activeAth.scores[k]) mergedScores[k] = [...activeAth.scores[k]];
        });
      }
      
      // Override or merge inputAth scores
      if (inputAth) {
        Object.keys(inputAth.scores || {}).forEach((k) => {
          if (inputAth.scores[k]) mergedScores[k] = [...inputAth.scores[k]];
        });
      }

      const mergedSoloHits = {
        ...(activeAth?.soloHits || {}),
        ...(inputAth?.soloHits || {}),
      };

      const mergedSoloRounds = {
        ...(activeAth?.soloRounds || {}),
        ...(inputAth?.soloRounds || {}),
      };

      return {
        ...m,
        scores: mergedScores,
        soloHits: mergedSoloHits,
        soloRounds: mergedSoloRounds,
        status: activeAth?.status || inputAth?.status || m.status || "Thi đấu"
      };
    });
  }, [masterAthletes, athletes, inputAthletes, distances, shotsCount]);

  // Combine all master athletes for Team Standings calculation
  // Merging both saved list scores (teamAthletes) and live, unsaved template input list scores (teamInputAthletes) so they show up in real-time
  const leaderboardTeamAthletes = useMemo(() => {
    return masterAthletes.map((m) => {
      const activeAth = teamAthletes.find((a) => a.id === m.id);
      const inputAth = teamInputAthletes.find((a) => a.id === m.id);
      
      const mergedScores: Record<string, (boolean | null)[]> = {};
      // Initialize with default empty slots first
      teamDistances.forEach((d) => {
        mergedScores[d.id] = Array(teamShotsCount).fill(null);
      });
      
      // Override with activeAth scores
      if (activeAth) {
        Object.keys(activeAth.scores || {}).forEach((k) => {
          if (activeAth.scores[k]) mergedScores[k] = [...activeAth.scores[k]];
        });
      }
      
      // Override or merge inputAth scores
      if (inputAth) {
        Object.keys(inputAth.scores || {}).forEach((k) => {
          if (inputAth.scores[k]) mergedScores[k] = [...inputAth.scores[k]];
        });
      }

      const mergedSoloHits = {
        ...(activeAth?.soloHits || {}),
        ...(inputAth?.soloHits || {}),
      };

      const mergedSoloRounds = {
        ...(activeAth?.soloRounds || {}),
        ...(inputAth?.soloRounds || {}),
      };

      return {
        ...m,
        scores: mergedScores,
        soloHits: mergedSoloHits,
        soloRounds: mergedSoloRounds,
        status: activeAth?.status || inputAth?.status || m.status || "Thi đấu"
      };
    });
  }, [masterAthletes, teamAthletes, teamInputAthletes, teamDistances, teamShotsCount]);

  // Synchronize basic metadata from master profiles to current active session athletes
  useEffect(() => {
    setAthletes((prevActive) => {
      const activeIdsInMaster = new Set(masterAthletes.map(m => m.id));
      const filtered = prevActive.filter(a => activeIdsInMaster.has(a.id));
      let changed = filtered.length !== prevActive.length;

      const updated = filtered.map((activeAth) => {
        const masterAth = masterAthletes.find((m) => m.id === activeAth.id);
        if (masterAth) {
          if (
            activeAth.name !== masterAth.name ||
            activeAth.team !== masterAth.team ||
            activeAth.gender !== masterAth.gender ||
            activeAth.avatarUrl !== masterAth.avatarUrl ||
            activeAth.idCard !== masterAth.idCard ||
            activeAth.dob !== masterAth.dob ||
            activeAth.hometown !== masterAth.hometown ||
            activeAth.province !== masterAth.province ||
            activeAth.country !== masterAth.country ||
            activeAth.countryCode !== masterAth.countryCode ||
            activeAth.status !== masterAth.status
          ) {
            changed = true;
            return {
              ...activeAth,
              name: masterAth.name,
              team: masterAth.team,
              gender: masterAth.gender,
              avatarUrl: masterAth.avatarUrl,
              idCard: masterAth.idCard,
              dob: masterAth.dob,
              hometown: masterAth.hometown,
              province: masterAth.province,
              country: masterAth.country,
              countryCode: masterAth.countryCode,
              status: masterAth.status,
            };
          }
        }
        return activeAth;
      });
      return changed ? updated : prevActive;
    });

    setTeamAthletes((prevTeam) => {
      const activeIdsInMaster = new Set(masterAthletes.map(m => m.id));
      const filtered = prevTeam.filter(a => activeIdsInMaster.has(a.id));
      let changed = filtered.length !== prevTeam.length;

      const updated = filtered.map((activeAth) => {
        const masterAth = masterAthletes.find((m) => m.id === activeAth.id);
        if (masterAth) {
          if (
            activeAth.name !== masterAth.name ||
            activeAth.team !== masterAth.team ||
            activeAth.gender !== masterAth.gender ||
            activeAth.avatarUrl !== masterAth.avatarUrl ||
            activeAth.idCard !== masterAth.idCard ||
            activeAth.dob !== masterAth.dob ||
            activeAth.hometown !== masterAth.hometown ||
            activeAth.province !== masterAth.province ||
            activeAth.country !== masterAth.country ||
            activeAth.countryCode !== masterAth.countryCode ||
            activeAth.status !== masterAth.status
          ) {
            changed = true;
            return {
              ...activeAth,
              name: masterAth.name,
              team: masterAth.team,
              gender: masterAth.gender,
              avatarUrl: masterAth.avatarUrl,
              idCard: masterAth.idCard,
              dob: masterAth.dob,
              hometown: masterAth.hometown,
              province: masterAth.province,
              country: masterAth.country,
              countryCode: masterAth.countryCode,
              status: masterAth.status,
            };
          }
        }
        return activeAth;
      });
      return changed ? updated : prevTeam;
    });
  }, [masterAthletes]);

  // --- Handlers for Athletes Scoring ---

  // Toggles the hit state of a specific check box
  const executeToggleScore = (athleteId: string, distanceId: string, shotIndex: number) => {
    if (competitionMode === "individual") {
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : Array(shotsCount).fill(null);

          // adjust length if mismatched
          if (currentScores.length < shotsCount) {
            const diff = shotsCount - currentScores.length;
            currentScores.push(...Array(diff).fill(null));
          }

          const val = currentScores[shotIndex];
          if (val === true) {
            currentScores[shotIndex] = false; // 2nd click -> Red X / Miss
          } else if (val === false) {
            currentScores[shotIndex] = null; // 3rd click -> Empty/Unchecked
          } else {
            currentScores[shotIndex] = true; // 1st click -> Checked / Hit
          }

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    } else {
      setTeamAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : Array(teamShotsCount).fill(null);

          // adjust length if mismatched
          if (currentScores.length < teamShotsCount) {
            const diff = teamShotsCount - currentScores.length;
            currentScores.push(...Array(diff).fill(null));
          }

          const val = currentScores[shotIndex];
          if (val === true) {
            currentScores[shotIndex] = false; // 2nd click -> Red X / Miss
          } else if (val === false) {
            currentScores[shotIndex] = null; // 3rd click -> Empty/Unchecked
          } else {
            currentScores[shotIndex] = true; // 1st click -> Checked / Hit
          }

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    }
  };

  const handleToggleScore = (athleteId: string, distanceId: string, shotIndex: number) => {
    if (!isScoringEditAuthorized) {
      setPendingScoreToggle({ athleteId, distanceId, shotIndex });
      setShowUnlockScoreModal(true);
      return;
    }
    executeToggleScore(athleteId, distanceId, shotIndex);
  };

  // Modifies an athlete details safely
  const handleUpdateAthlete = (athleteId: string, name: string, team: string, customId?: string) => {
    const checkId = customId ? customId.trim() : athleteId;
    const isIdTaken = masterAthletes.some((a) => a.id === checkId && a.id !== athleteId);
    const finalId = isIdTaken ? athleteId : checkId;

    // Update in Master Roster first
    setMasterAthletes((prev) =>
      prev.map((ma) => {
        if (ma.id !== athleteId) return ma;
        return {
          ...ma,
          id: finalId,
          name,
          team,
        };
      })
    );

    // Update in active tournament
    if (competitionMode === "individual") {
      setAthletes((prev) => {
        return prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          // If distances or scores fields are missing, re-populate them
          const finalScores = { ...athlete.scores };
          distances.forEach((d) => {
            if (!finalScores[d.id]) {
              finalScores[d.id] = Array(shotsCount).fill(null);
            }
          });

          return {
            ...athlete,
            id: finalId,
            name,
            team,
            scores: finalScores,
          };
        });
      });
    } else {
      setTeamAthletes((prev) => {
        return prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          // If distances or scores fields are missing, re-populate them
          const finalScores = { ...athlete.scores };
          teamDistances.forEach((d) => {
            if (!finalScores[d.id]) {
              finalScores[d.id] = Array(teamShotsCount).fill(null);
            }
          });

          return {
            ...athlete,
            id: finalId,
            name,
            team,
            scores: finalScores,
          };
        });
      });
    }
  };

  // Delete an athlete
  const handleDeleteAthlete = (athleteId: string) => {
    if (competitionMode === "individual") {
      setAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    } else {
      setTeamAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    }
  };

  // Move athlete position in the main scoring list
  const handleMoveAthlete = (athleteId: string, direction: "up" | "down") => {
    if (competitionMode === "individual") {
      setAthletes((prev) => {
        const idx = prev.findIndex((a) => a.id === athleteId);
        if (idx === -1) return prev;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[targetIdx];
        copy[targetIdx] = temp;
        return copy;
      });
    } else {
      setTeamAthletes((prev) => {
        const idx = prev.findIndex((a) => a.id === athleteId);
        if (idx === -1) return prev;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[targetIdx];
        copy[targetIdx] = temp;
        return copy;
      });
    }
  };

  // Toggle score for inputAthletes
  const handleToggleInputScore = (athleteId: string, distanceId: string, shotIndex: number) => {
    const list = competitionMode === "individual" ? inputAthletes : teamInputAthletes;
    const targetA = list.find((a) => a.id === athleteId);
    if (targetA?.calledBy && targetA.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim()) {
      return;
    }
    setHasUnsavedChanges(true);
    if (competitionMode === "individual") {
      setInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : Array(shotsCount).fill(null);

          // adjust length if mismatched
          if (currentScores.length < shotsCount) {
            const diff = shotsCount - currentScores.length;
            currentScores.push(...Array(diff).fill(null));
          }

          const val = currentScores[shotIndex];
          if (val === true) {
            currentScores[shotIndex] = false; // 2nd click -> Red X / Miss
          } else if (val === false) {
            currentScores[shotIndex] = null; // 3rd click -> Empty/Unchecked
          } else {
            currentScores[shotIndex] = true; // 1st click -> Checked / Hit
          }

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    } else {
      setTeamInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : Array(teamShotsCount).fill(null);

          // adjust length if mismatched
          if (currentScores.length < teamShotsCount) {
            const diff = teamShotsCount - currentScores.length;
            currentScores.push(...Array(diff).fill(null));
          }

          const val = currentScores[shotIndex];
          if (val === true) {
            currentScores[shotIndex] = false; // 2nd click -> Red X / Miss
          } else if (val === false) {
            currentScores[shotIndex] = null; // 3rd click -> Empty/Unchecked
          } else {
            currentScores[shotIndex] = true; // 1st click -> Checked / Hit
          }

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    }
  };

  const executeDirectScoreUpdate = (athleteId: string, distanceId: string, value: number | null) => {
    if (competitionMode === "individual") {
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : [null];

          currentScores[0] = value;

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    } else {
      setTeamAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : [null];

          currentScores[0] = value;

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    }
  };

  const handleUpdateDirectScore = (athleteId: string, distanceId: string, value: number | null) => {
    if (!isScoringEditAuthorized) {
      alert("Bạn chưa bật quyền chỉnh sửa điểm số! Vui lòng bật quyền để tiếp tục.");
      return;
    }
    executeDirectScoreUpdate(athleteId, distanceId, value);
  };

  const handleUpdateDirectInputScore = (athleteId: string, distanceId: string, value: number | null) => {
    const list = competitionMode === "individual" ? inputAthletes : teamInputAthletes;
    const targetA = list.find((a) => a.id === athleteId);
    if (targetA?.calledBy && targetA.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim()) {
      return;
    }
    setHasUnsavedChanges(true);
    if (competitionMode === "individual") {
      setInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : [null];

          currentScores[0] = value;

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    } else {
      setTeamInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;

          const currentScores = athlete.scores[distanceId] 
            ? [...athlete.scores[distanceId]] 
            : [null];

          currentScores[0] = value;

          return {
            ...athlete,
            scores: {
              ...athlete.scores,
              [distanceId]: currentScores,
            },
          };
        })
      );
    }
  };

  // Update solo shootout hits for main athletes
  const handleUpdateSoloHits = (athleteId: string, distanceId: string, rounds: (number | null)[]) => {
    const isAnyNumber = rounds.some((r) => r !== null && r !== undefined);
    const sum = isAnyNumber 
      ? rounds.reduce<number>((s, r) => s + (r === null || r === undefined ? 0 : r), 0)
      : null;

    if (competitionMode === "individual") {
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          return {
            ...athlete,
            soloHits: {
              ...(athlete.soloHits || {}),
              [distanceId]: sum as any,
            },
            soloRounds: {
              ...(athlete.soloRounds || {}),
              [distanceId]: rounds as any,
            },
          };
        })
      );
    } else {
      setTeamAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          return {
            ...athlete,
            soloHits: {
              ...(athlete.soloHits || {}),
              [distanceId]: sum as any,
            },
            soloRounds: {
              ...(athlete.soloRounds || {}),
              [distanceId]: rounds as any,
            },
          };
        })
      );
    }
  };

  // Update solo shootout hits for input board athletes
  const handleUpdateInputSoloHits = (athleteId: string, distanceId: string, rounds: (number | null)[]) => {
    const isAnyNumber = rounds.some((r) => r !== null && r !== undefined);
    const sum = isAnyNumber 
      ? rounds.reduce<number>((s, r) => s + (r === null || r === undefined ? 0 : r), 0)
      : null;

    setHasUnsavedChanges(true);
    if (competitionMode === "individual") {
      setInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          return {
            ...athlete,
            soloHits: {
              ...(athlete.soloHits || {}),
              [distanceId]: sum as any,
            },
            soloRounds: {
              ...(athlete.soloRounds || {}),
              [distanceId]: rounds as any,
            },
          };
        })
      );
    } else {
      setTeamInputAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          return {
            ...athlete,
            soloHits: {
              ...(athlete.soloHits || {}),
              [distanceId]: sum as any,
            },
            soloRounds: {
              ...(athlete.soloRounds || {}),
              [distanceId]: rounds as any,
            },
          };
        })
      );
    }
  };

  // Update input athlete details
  const handleUpdateInputAthlete = (athleteId: string, name: string, team: string, customId?: string) => {
    const checkId = customId ? customId.trim() : athleteId;
    const isIdTaken = masterAthletes.some((a) => a.id === checkId && a.id !== athleteId);
    const finalId = isIdTaken ? athleteId : checkId;

    setHasUnsavedChanges(true);
    // Update in Master Roster first
    setMasterAthletes((prev) =>
      prev.map((ma) => {
        if (ma.id !== athleteId) return ma;
        return {
          ...ma,
          id: finalId,
          name,
          team,
        };
      })
    );

    // Update in inputAthletes or teamInputAthletes
    if (competitionMode === "individual") {
      setInputAthletes((prev) => {
        return prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          const finalScores = { ...athlete.scores };
          distances.forEach((d) => {
            if (!finalScores[d.id]) {
              finalScores[d.id] = Array(shotsCount).fill(null);
            }
          });

          return {
            ...athlete,
            id: finalId,
            name,
            team,
            scores: finalScores,
          };
        });
      });
    } else {
      setTeamInputAthletes((prev) => {
        return prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          
          const finalScores = { ...athlete.scores };
          teamDistances.forEach((d) => {
            if (!finalScores[d.id]) {
              finalScores[d.id] = Array(teamShotsCount).fill(null);
            }
          });

          return {
            ...athlete,
            id: finalId,
            name,
            team,
            scores: finalScores,
          };
        });
      });
    }
  };

  // Delete an input athlete
  const handleDeleteInputAthlete = (athleteId: string) => {
    setHasUnsavedChanges(true);
    if (competitionMode === "individual") {
      setInputAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    } else {
      setTeamInputAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    }
  };

  // Move input athlete position
  const handleMoveInputAthlete = (athleteId: string, direction: "up" | "down") => {
    setHasUnsavedChanges(true);
    if (competitionMode === "individual") {
      setInputAthletes((prev) => {
        const idx = prev.findIndex((a) => a.id === athleteId);
        if (idx === -1) return prev;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[targetIdx];
        copy[targetIdx] = temp;
        return copy;
      });
    } else {
      setTeamInputAthletes((prev) => {
        const idx = prev.findIndex((a) => a.id === athleteId);
        if (idx === -1) return prev;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[targetIdx];
        copy[targetIdx] = temp;
        return copy;
      });
    }
  };

  // Save/Transfer scores from input board to Ghi Điểm page
  const handleSaveInputScoresToMain = () => {
    const activeInputList = competitionMode === "individual" ? inputAthletes : teamInputAthletes;
    if (activeInputList.length === 0) {
      alert("Không có vận động viên nào trong bảng Nhập Điểm!");
      return;
    }
    setSaveStatus(null);
    setIsSaveConfirmModalOpen(true);
  };

  const executeSaveScores = async () => {
    setIsSavingScores(true);
    setSaveStatus(null);

    const activeInputList = competitionMode === "individual" ? inputAthletes : teamInputAthletes;
    if (activeInputList.length === 0) {
      setSaveStatus({ success: false, message: "Không có vận động viên nào trong bảng Nhập Điểm!" });
      setIsSavingScores(false);
      return;
    }

    let nextAthletes = [...athletes];
    let nextTeamAthletes = [...teamAthletes];
    let nextInputAthletes = [...inputAthletes];
    let nextTeamInputAthletes = [...teamInputAthletes];

    if (competitionMode === "individual") {
      const mergedAthletes = [...athletes];
      activeInputList.forEach((ia) => {
        const existingIdx = mergedAthletes.findIndex((a) => a.id === ia.id);
        if (existingIdx !== -1) {
          mergedAthletes[existingIdx] = {
            ...mergedAthletes[existingIdx],
            scores: {
              ...mergedAthletes[existingIdx].scores,
              ...ia.scores,
            },
            soloHits: {
              ...(mergedAthletes[existingIdx].soloHits || {}),
              ...(ia.soloHits || {}),
            },
            soloRounds: {
              ...(mergedAthletes[existingIdx].soloRounds || {}),
              ...(ia.soloRounds || {}),
            },
          };
        } else {
          mergedAthletes.push(ia);
        }
      });
      nextAthletes = mergedAthletes;
      nextInputAthletes = [];
    } else {
      const mergedAthletes = [...teamAthletes];
      activeInputList.forEach((ia) => {
        const existingIdx = mergedAthletes.findIndex((a) => a.id === ia.id);
        if (existingIdx !== -1) {
          mergedAthletes[existingIdx] = {
            ...mergedAthletes[existingIdx],
            scores: {
              ...mergedAthletes[existingIdx].scores,
              ...ia.scores,
            },
            soloHits: {
              ...(mergedAthletes[existingIdx].soloHits || {}),
              ...(ia.soloHits || {}),
            },
            soloRounds: {
              ...(mergedAthletes[existingIdx].soloRounds || {}),
              ...(ia.soloRounds || {}),
            },
          };
        } else {
          mergedAthletes.push(ia);
        }
      });
      nextTeamAthletes = mergedAthletes;
      nextTeamInputAthletes = [];
    }

    const firstImported = activeInputList[0];
    if (firstImported) {
      setPendingScrollAthleteId(firstImported.id);
    }

    // If online tournament, try writing to Firestore synchronously and verify success
    if (activeHistoryId && activeHistoryId.startsWith("tour-")) {
      try {
        await updateOnlineTournament(activeHistoryId, {
          athletes: nextAthletes,
          teamAthletes: nextTeamAthletes,
          inputAthletes: nextInputAthletes,
          teamInputAthletes: nextTeamInputAthletes,
        });

        // Successful write to Cloud DB
        setAthletes(nextAthletes);
        setTeamAthletes(nextTeamAthletes);
        setInputAthletes(nextInputAthletes);
        setTeamInputAthletes(nextTeamInputAthletes);
        setHasUnsavedChanges(false);

        setSaveStatus({
          success: true,
          message: `LƯU ĐIỂM THÀNH CÔNG! Kết quả đã được đồng bộ an toàn lên Đám mây đám mây và cập nhật ${activeInputList.length} VĐV sang danh sách Ghi Điểm.`,
        });

        setTimeout(() => {
          setIsSaveConfirmModalOpen(false);
          setSaveStatus(null);

          // Handle any pending tab changes
          if (pendingTabTarget) {
            if (pendingTabTarget.type === "tab") {
              setActiveTab(pendingTabTarget.value);
            } else if (pendingTabTarget.type === "exit") {
              handleExitTournament(pendingTabTarget.value as any);
            }
            setPendingTabTarget(null);
          } else {
            // Stay at input_scores
            setActiveTab("input_scores");
          }
        }, 2000);

      } catch (err: any) {
        console.error("Manual cloud save failed:", err);
        setSaveStatus({
          success: false,
          message: `LỖI GHI ĐIỂM ĐÁM MÂY (MẠNG KHÔNG ỔN ĐỊNH): ${err.message || "Không phản hồi từ máy chủ"}. Thầy cô vui lòng kiểm tra lại kết nối Wifi/4G hoặc thiết bị mạng trước khi thử lại!`,
        });
      } finally {
        setIsSavingScores(false);
      }
    } else {
      // Offline/Draft mode: save to local memory
      setAthletes(nextAthletes);
      setTeamAthletes(nextTeamAthletes);
      setInputAthletes(nextInputAthletes);
      setTeamInputAthletes(nextTeamInputAthletes);
      setHasUnsavedChanges(false);

      setSaveStatus({
        success: true,
        message: `Lưu điểm thành công! Kết quả đã lưu cục bộ trên máy và cập nhật ${activeInputList.length} VĐV sang danh sách Ghi Điểm.`,
      });

      setTimeout(() => {
        setIsSaveConfirmModalOpen(false);
        setSaveStatus(null);

        // Handle any pending tab changes
        if (pendingTabTarget) {
          if (pendingTabTarget.type === "tab") {
            setActiveTab(pendingTabTarget.value);
          } else if (pendingTabTarget.type === "exit") {
            handleExitTournament(pendingTabTarget.value as any);
          }
          setPendingTabTarget(null);
        } else {
          // Stay at input_scores
          setActiveTab("input_scores");
        }
      }, 2000);

      setIsSavingScores(false);
    }
  };

  // Increments and appends a new athlete with a unique auto ID
  const handleAddAthleteCustom = (name: string, team: string) => {
    const activeAthList = competitionMode === "individual" ? athletes : teamAthletes;
    const finalName = name.trim() || `VĐV Mới ${activeAthList.length + 1}`;
    
    // Auto-generate numeric ID based on maximum current numeric ID + 1
    let nextIdNum = 1;
    if (activeAthList.length > 0) {
      const ids = activeAthList.map((a) => parseInt(a.id, 10)).filter((n) => !isNaN(n));
      if (ids.length > 0) {
        nextIdNum = Math.max(...ids) + 1;
      } else {
        nextIdNum = activeAthList.length + 1;
      }
    }
    const finalId = nextIdNum.toString().padStart(4, "0");

    if (competitionMode === "individual") {
      const freshScores: Record<string, (boolean | null)[]> = {};
      distances.forEach((dist) => {
        freshScores[dist.id] = Array(shotsCount).fill(null);
      });

      const newAthlete: Athlete = {
        id: finalId,
        name: finalName,
        team: team.trim(),
        scores: freshScores,
      };
      setAthletes((prev) => [...prev, newAthlete]);
    } else {
      const freshScores: Record<string, (boolean | null)[]> = {};
      teamDistances.forEach((dist) => {
        freshScores[dist.id] = Array(teamShotsCount).fill(null);
      });

      const newAthlete: Athlete = {
        id: finalId,
        name: finalName,
        team: team.trim(),
        scores: freshScores,
      };
      setTeamAthletes((prev) => [...prev, newAthlete]);
    }
  };

  // Instantly triggers adding athlete view (when clicking the giant '+' button at bottom)
  const handleAddBlankAthlete = () => {
    if (!isScoringEditAuthorized) {
      setPendingAddAthlete(true);
      setShowUnlockScoreModal(true);
      return;
    }
    setIsAddingAthleteToTournament(true);
  };

  // --- Handlers for Settings & Administration Actions ---

  // Save current snapshot of scores to historical archive
  const handleSaveCurrentSessionToHistory = (customName?: string) => {
    const nameToSave = customName?.trim() || `${matchName} (Lưu lúc ${new Date().toLocaleTimeString("vi-VN")})`;
    
    const newHistoryItem: MatchHistoryItem = {
      id: `hist-${Date.now()}`,
      date: new Date().toISOString(),
      matchName: nameToSave,
      shotCount: shotsCount,
      distances: [...distances],
      athletes: JSON.parse(JSON.stringify(athletes)), // Only save active tournament athletes (Ghi Điểm)
      masterCount: masterAthletes.length,
      masterAthletes: JSON.parse(JSON.stringify(masterAthletes)),
      teamDistances: [...teamDistances],
      teamShotCount: teamShotsCount,
      teamAthletes: JSON.parse(JSON.stringify(teamAthletes)),
      startDate: startDate,
      endDate: endDate,
      clubs: JSON.parse(JSON.stringify(clubs)),
    };

    setHistory((prev) => {
      // If we are saving from settings with an explicit non-temporary name that matches an existing tournament, overwrite it or prepend
      const existingIndex = prev.findIndex((h) => h.matchName.toLowerCase() === nameToSave.toLowerCase());
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex] = newHistoryItem;
        return copy;
      }
      return [newHistoryItem, ...prev];
    });
    alert(`Đã lưu thành công trận đấu "${nameToSave}" vào danh sách lịch sử.`);
  };

  // Exit current tournament and reset all tournament state variables back to defaults
  const handleExitTournament = (filter: "all" | "all_list" | "active" | "followed" = "all") => {
    // Immediately write any pending local changes to Firestore before exiting/clearing state
    if (activeHistoryId && activeHistoryId.startsWith("tour-") && (userRole === "admin" || userRole === "referee") && isTournamentConfigLoaded && currentTournamentDoc) {
      const isDifferent = (
        !deepEqual(matchName, currentTournamentDoc?.matchName) ||
        !deepEqual(startDate, currentTournamentDoc?.startDate) ||
        !deepEqual(endDate, currentTournamentDoc?.endDate) ||
        !deepEqual(distances, currentTournamentDoc?.distances) ||
        !deepEqual(shotsCount, currentTournamentDoc?.shotsCount) ||
        !deepEqual(athletes, currentTournamentDoc?.athletes) ||
        !deepEqual(teamDistances, currentTournamentDoc?.teamDistances) ||
        !deepEqual(teamShotsCount, currentTournamentDoc?.teamShotsCount) ||
        !deepEqual(teamAthletes, currentTournamentDoc?.teamAthletes) ||
        !deepEqual(inputAthletes, currentTournamentDoc?.inputAthletes) ||
        !deepEqual(teamInputAthletes, currentTournamentDoc?.teamInputAthletes) ||
        !deepEqual(directMaxPoints, currentTournamentDoc?.directMaxPoints) ||
        !deepEqual(teamDirectMaxPoints, currentTournamentDoc?.teamDirectMaxPoints) ||
        !deepEqual(directMaxShots, currentTournamentDoc?.directMaxShots) ||
        !deepEqual(teamDirectMaxShots, currentTournamentDoc?.teamDirectMaxShots) ||
        !deepEqual(masterAthletes, currentTournamentDoc?.masterAthletes) ||
        !deepEqual(bannerUrl, currentTournamentDoc?.bannerUrl) ||
        !deepEqual(avatarUrl, currentTournamentDoc?.avatarUrl) ||
        !deepEqual(clubs, currentTournamentDoc?.clubs) ||
        laneCapacity !== currentTournamentDoc?.laneCapacity
      );
      if (isDifferent) {
        updateOnlineTournament(activeHistoryId, {
          matchName,
          startDate,
          endDate,
          distances,
          shotsCount,
          athletes,
          teamDistances,
          teamShotsCount,
          teamAthletes,
          inputAthletes,
          teamInputAthletes,
          directMaxPoints,
          teamDirectMaxPoints,
          directMaxShots,
          teamDirectMaxShots,
          masterAthletes,
          bannerUrl,
          avatarUrl,
          laneCapacity,
          clubs
        }).catch(err => console.error("Immediate exit sync failed:", err));
      }
    }

    // Auto-save roster to stored athlete lists on exit for admin/creator/sub-admin
    const rosterToSave = (masterAthletes && masterAthletes.length > 0) ? masterAthletes : athletes;
    if (userRole === "admin" && matchName && matchName.trim() && rosterToSave && rosterToSave.length > 0) {
      const nameToUse = matchName.trim();
      setStoredAthleteLists((prev) => {
        const existingItem = prev?.find((item) => item.name.toLowerCase() === nameToUse.toLowerCase());
        const filtered = (prev || []).filter((item) => item.name.toLowerCase() !== nameToUse.toLowerCase());
        const updatedRecord = {
          id: existingItem?.id || `list-${Date.now()}`,
          name: nameToUse,
          createdAt: existingItem?.createdAt || new Date().toISOString(),
          athletes: JSON.parse(JSON.stringify(rosterToSave)),
        };
        return [updatedRecord, ...filtered];
      });
    }

    setActiveHistoryId(null);
    setAthletes([]);
    try {
      const savedGlobal = localStorage.getItem("slingshot_master_athletes_global") || localStorage.getItem("slingshot_master_athletes");
      if (savedGlobal) {
        setMasterAthletes(restoreBase64Avatars(JSON.parse(savedGlobal)));
      } else {
        setMasterAthletes([]);
      }
    } catch (e) {
      setMasterAthletes([]);
    }
    setTeamAthletes([]);
    setInputAthletes([]);
    setTeamInputAthletes([]);
    setMatchName("");
    setHeaderTempName("");
    setStartDate("");
    setEndDate("");
    setDistances(JSON.parse(JSON.stringify(DEFAULT_DISTANCES)));
    setShotsCount(DEFAULT_SHOTS_COUNT);
    setTeamDistances(JSON.parse(JSON.stringify(DEFAULT_DISTANCES)));
    setTeamShotsCount(DEFAULT_SHOTS_COUNT);
    setCompetitionMode("individual");
    setDirectMaxPoints(undefined);
    setTeamDirectMaxPoints(undefined);
    setSettingsSubTab("config");
    setAthleteForceTab("athletes");
    
    // Explicitly delete cached active tournament identifier
    localStorage.removeItem("slingshot_active_history_id");
    deviceStorage.remove("slingshot_active_history_id");

    setHomeFilter(filter);
    setActiveTab("home");
  };

  // Restore scores state from archive
  const handleRestoreHistoryItem = (itemId: string) => {
    const target = history.find((h) => h.id === itemId);
    if (!target) return;

    // Put into draft preview mode (activeHistoryId is null to show Offline preview draft)
    setActiveHistoryId(null);
    setDraftPreviewItem(target);

    // Now restore target match fields locally
    setMatchName(target.matchName);
    setStartDate(target.startDate || "");
    setEndDate(target.endDate || "");
    setDistances(target.distances);
    setShotsCount(target.shotCount);
    setAthletes(target.athletes);

    if (target.teamDistances) setTeamDistances(target.teamDistances);
    if (target.teamShotCount) setTeamShotsCount(target.teamShotCount);
    if (target.teamAthletes) setTeamAthletes(target.teamAthletes);
    if (target.clubs) {
      setClubs(target.clubs);
    } else {
      setClubs([]);
    }
    
    // Restore master list of that match fully into master registry (Quản lý VĐV)
    const restoredMasters = target.masterAthletes && target.masterAthletes.length > 0
      ? target.masterAthletes
      : target.athletes;
    setMasterAthletes(JSON.parse(JSON.stringify(restoredMasters)));

    // Clear active temporary inputs
    setInputAthletes([]);
    setTeamInputAthletes([]);

    setActiveTab("scoring"); // redirect back to scorecards
    alert(`Đã mở chế độ xem trước BẢN NHÁP ngoại tuyến cho giải: "${target.matchName}". Thầy cô có thể kiểm tra danh sách thi đấu và bảng điểm, sau đó bấm "Xác nhận Đăng Online" ở thanh cảnh báo trên cùng để đồng bộ đám mây.`);
  };

  // Remove history snapshot
  const handleDeleteHistoryItem = (itemId: string) => {
    const target = history.find((h) => h.id === itemId);
    if (target) {
      const matchName = target.matchName;
      // Also delete the saved athlete roster list with the exact same tournament name
      setStoredAthleteLists((prev) => prev.filter((list) => list.name.toLowerCase() !== matchName.toLowerCase()));
    }
    setHistory((prev) => prev.filter((h) => h.id !== itemId));
  };

  const handleOverwriteOnlinePublish = async (selectedOnlineTourId: string) => {
    if (!draftPreviewItem) return;
    if (!selectedOnlineTourId) {
      alert("Vui lòng chọn giải đấu online cần ghi đè!");
      return;
    }
    const targetTour = onlineTournaments.find(t => t.id === selectedOnlineTourId);
    if (!targetTour) return;

    const confirmText = `⚠️ Bạn có chắc chắn muốn GHI ĐÈ toàn bộ điểm số, danh sách VĐV, và cấu hình của giải online "${targetTour.matchName}" bằng dữ liệu bản nháp này không?\n\nToàn bộ dữ liệu cũ của giải online này sẽ bị thay thế vĩnh viễn!`;
    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      await updateOnlineTournament(selectedOnlineTourId, {
        matchName: targetTour.matchName,
        distances: draftPreviewItem.distances,
        shotsCount: draftPreviewItem.shotCount,
        athletes: draftPreviewItem.athletes,
        teamDistances: draftPreviewItem.teamDistances || [],
        teamShotsCount: draftPreviewItem.teamShotCount || DEFAULT_SHOTS_COUNT,
        teamAthletes: draftPreviewItem.teamAthletes || [],
        masterAthletes: draftPreviewItem.masterAthletes || draftPreviewItem.athletes || [],
        inputAthletes: draftPreviewItem.inputAthletes || [],
        teamInputAthletes: draftPreviewItem.teamInputAthletes || [],
        directMaxPoints: draftPreviewItem.directMaxPoints,
        teamDirectMaxPoints: draftPreviewItem.teamDirectMaxPoints,
        directMaxShots: draftPreviewItem.directMaxShots || 10,
        teamDirectMaxShots: draftPreviewItem.teamDirectMaxShots || 10,
        clubs: draftPreviewItem.clubs || [],
      });

      // Update local active state to this overwritten tournament
      setActiveHistoryId(selectedOnlineTourId);
      localStorage.setItem("slingshot_active_history_id", selectedOnlineTourId);
      setDraftPreviewItem(null);
      setIsPublishDraftModalOpen(false);
      setActiveTab("dashboard");

      alert(`Đã ghi đè thành công dữ liệu bản nháp lên giải online "${targetTour.matchName}"!`);
    } catch (err: any) {
      alert(`Lỗi ghi đè online: ${err.message || err}`);
    }
  };

  const handleCreateNewOnlinePublish = async (newOnlineTourName: string) => {
    if (!draftPreviewItem) return;
    if (!newOnlineTourName.trim()) {
      alert("Vui lòng nhập tên giải đấu mới!");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Bạn cần đăng nhập để khởi tạo giải đấu online!");
        return;
      }

      const creatorEmail = currentUser.email || "";
      const newTourId = await createOnlineTournament(
        newOnlineTourName.trim(),
        currentUser.uid,
        creatorEmail,
        {
          competitionMode: draftPreviewItem.teamAthletes && draftPreviewItem.teamAthletes.length > 0 ? "team" : "individual",
          shotsCount: draftPreviewItem.shotCount,
          teamShotsCount: draftPreviewItem.teamShotCount || DEFAULT_SHOTS_COUNT,
          distances: draftPreviewItem.distances,
          teamDistances: draftPreviewItem.teamDistances || [],
          athletes: draftPreviewItem.athletes,
          teamAthletes: draftPreviewItem.teamAthletes || [],
          inputAthletes: draftPreviewItem.inputAthletes || [],
          teamInputAthletes: draftPreviewItem.teamInputAthletes || [],
          masterAthletes: draftPreviewItem.masterAthletes || draftPreviewItem.athletes || [],
          clubs: draftPreviewItem.clubs || [],
        }
      );

      // Track creation time local backup gate
      localStorage.setItem(`slingshot_created_at_${newTourId}`, Date.now().toString());

      // Update active tournament id
      setActiveHistoryId(newTourId);
      localStorage.setItem("slingshot_active_history_id", newTourId);
      setDraftPreviewItem(null);
      setIsPublishDraftModalOpen(false);
      setActiveTab("dashboard");

      alert(`Đã tạo mới và đăng giải online "${newOnlineTourName.trim()}" thành công!`);
    } catch (err: any) {
      alert(`Lỗi tạo giải mới online: ${err.message || err}`);
    }
  };

  // Clear all scores inside boxes back to unchecked, preserving the players list
  const handleResetSession = () => {
    setAthletes((prev) =>
      prev.map((athlete) => {
        const resetScores: Record<string, (boolean | null)[]> = {};
        distances.forEach((dist) => {
          resetScores[dist.id] = Array(shotsCount).fill(null);
        });
        return {
          ...athlete,
          scores: resetScores,
        };
      })
    );

    setTeamAthletes((prev) =>
      prev.map((athlete) => {
        const resetScores: Record<string, (boolean | null)[]> = {};
        teamDistances.forEach((dist) => {
          resetScores[dist.id] = Array(teamShotsCount).fill(null);
        });
        return {
          ...athlete,
          scores: resetScores,
        };
      })
    );
  };

  // Validate and read imported text data backup (Active tournament configuration & active athletes only)
  const handleImportSingleBackup = (dataString: string): boolean => {
    try {
      const parsed = JSON.parse(dataString);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray(parsed.distances) &&
        Array.isArray(parsed.athletes)
      ) {
        const incomingName = (parsed.matchName || "Giải đấu mới").trim();
        
        // Find existing with same name in history
        const duplicateIdx = history.findIndex(
          (h) => h.matchName.trim().toLowerCase() === incomingName.toLowerCase()
        );
        
        let finalName = incomingName;
        let shouldOverwrite = false;
        let shouldAppendNew = true;
        let proceed = true;
        
        if (duplicateIdx > -1) {
          // If name matches, show overwrite, rename or cancel
          const isOverwrite = window.confirm(
            `Giải đấu "${incomingName}" đã tồn tại trong danh sách Lịch sử.\n\n` +
            `• Chọn [OK (Xác nhận)] để GHI ĐÈ giải cũ.\n` +
            `• Chọn [Hủy (Cancel)] để ĐỔI TÊN giải và lưu song song cả hai giải.`
          );
          
          if (isOverwrite) {
            shouldOverwrite = true;
            shouldAppendNew = false;
          } else {
            const newName = window.prompt(
              `Vui lòng nhập TÊN MỚI cho giải đấu phục hồi để tránh trùng lập:`,
              incomingName + " (Bản phục hồi)"
            );
            if (newName && newName.trim() !== "") {
              finalName = newName.trim();
              shouldAppendNew = true;
            } else {
              // User pressed Cancel on prompt or gave empty name -> cancel entirely
              proceed = false;
            }
          }
        }
        
        if (!proceed) {
          return false;
        }

        // Apply active states
        setMatchName(finalName);
        setDistances(parsed.distances);
        if (parsed.shotsCount) setShotsCount(parsed.shotsCount);
        
        const restoredAthletes = restoreBase64Avatars(parsed.athletes);
        setAthletes(restoredAthletes);
        saveAvatarsFromAthletes(restoredAthletes);

        // Sync team parameters if present
        if (parsed.teamDistances) setTeamDistances(parsed.teamDistances);
        if (parsed.teamShotsCount) setTeamShotsCount(parsed.teamShotsCount);
        if (parsed.teamAthletes) {
          const restoredTeam = restoreBase64Avatars(parsed.teamAthletes);
          setTeamAthletes(restoredTeam);
          saveAvatarsFromAthletes(restoredTeam);
        }

        // Put/Add this session into matches history
        const newHistoryItem: MatchHistoryItem = {
          id: shouldOverwrite ? history[duplicateIdx].id : `hist-${Date.now()}`,
          date: new Date().toISOString(),
          matchName: finalName,
          shotCount: parsed.shotsCount || shotsCount,
          distances: parsed.distances,
          athletes: restoredAthletes,
          masterCount: restoredAthletes.length,
          masterAthletes: restoredAthletes,
          teamDistances: parsed.teamDistances || [...teamDistances],
          teamShotCount: parsed.teamShotsCount || teamShotsCount,
          teamAthletes: parsed.teamAthletes ? restoreBase64Avatars(parsed.teamAthletes) : [...teamAthletes],
        };

        setHistory((prev) => {
          if (shouldOverwrite) {
            const updated = [...prev];
            updated[duplicateIdx] = newHistoryItem;
            return updated;
          } else if (shouldAppendNew) {
            // Append at the front (as modern/active item)
            return [newHistoryItem, ...prev];
          }
          return prev;
        });

        alert(`Đã khôi phục thành công giải đấu "${finalName}" và ghi nhận vào Lịch Sử.`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Validate and read full database backup (Active tournament + entire history log)
  const handleImportFullBackup = (dataString: string): boolean => {
    try {
      const parsed = JSON.parse(dataString);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray(parsed.distances) &&
        Array.isArray(parsed.athletes)
      ) {
        // 1. First restore active session from parsed
        const incomingActiveName = (parsed.matchName || "Giải đấu mới").trim();
        setMatchName(incomingActiveName);
        setDistances(parsed.distances);
        if (parsed.shotsCount) setShotsCount(parsed.shotsCount);
        
        const restoredAthletes = restoreBase64Avatars(parsed.athletes);
        setAthletes(restoredAthletes);
        saveAvatarsFromAthletes(restoredAthletes);

        // Sync team parameters if present
        if (parsed.teamDistances) setTeamDistances(parsed.teamDistances);
        if (parsed.teamShotsCount) setTeamShotsCount(parsed.teamShotsCount);
        if (parsed.teamAthletes) {
          const restoredTeam = restoreBase64Avatars(parsed.teamAthletes);
          setTeamAthletes(restoredTeam);
          saveAvatarsFromAthletes(restoredTeam);
        }

        // 2. Now process the history log array properly (checking duplicates)
        if (Array.isArray(parsed.history)) {
          const restoredHistory = restoreBase64Avatars(parsed.history);
          
          setHistory((currentHistory) => {
            const tempHistory = [...currentHistory];
            
            restoredHistory.forEach((importedItem: MatchHistoryItem) => {
              if (importedItem.athletes) saveAvatarsFromAthletes(importedItem.athletes);
              if (importedItem.masterAthletes) saveAvatarsFromAthletes(importedItem.masterAthletes);
              if (importedItem.teamAthletes) saveAvatarsFromAthletes(importedItem.teamAthletes);
              
              const collisionIdx = tempHistory.findIndex(
                (h) => h.matchName.trim().toLowerCase() === importedItem.matchName.trim().toLowerCase()
              );
              
              if (collisionIdx > -1) {
                // Duplicate found. Ask!
                const isOverwrite = window.confirm(
                  `Giải đấu "${importedItem.matchName}" đã tồn tại trong lịch sử của bạn.\n\n` +
                  `• Chọn [OK (Xác nhận)] để GHI ĐÈ dữ liệu từ file backup lên giải hiện tại.\n` +
                  `• Chọn [Hủy (Cancel)] để ĐỔI TÊN giải từ file backup và lưu song song.`
                );
                
                if (isOverwrite) {
                  // overwrite existing index keeping old ID
                  tempHistory[collisionIdx] = {
                    ...importedItem,
                    id: tempHistory[collisionIdx].id // keep existing id
                  };
                } else {
                  // Prompt for name change
                  const newName = window.prompt(
                    `Vui lòng nhập TÊN MỚI cho giải đấu "${importedItem.matchName}" để lưu mới:`,
                    importedItem.matchName + " (Bản phục hồi)"
                  );
                  if (newName && newName.trim() !== "") {
                    tempHistory.unshift({
                      ...importedItem,
                      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                      matchName: newName.trim()
                    });
                  } else {
                    // skip/discard importing this particular duplicate item
                  }
                }
              } else {
                // No duplicate, prepend directly!
                tempHistory.unshift(importedItem);
              }
            });
            
            return tempHistory;
          });
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Export full JSON backup of the active session and historical events
  const handleExportBackup = () => {
    const backupData = {
      matchName,
      distances,
      shotsCount,
      athletes,
      history,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slingshot-scoring_${matchName.replace(/\s+/g, "-")}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter athletes for the scoring board view list
  const filteredAthletesScoring = athletes.filter((a) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(query) ||
      a.id.toLowerCase().includes(query) ||
      a.team.toLowerCase().includes(query)
    );
  });

  // Filter athletes for the input board view list
  const filteredInputAthletes = inputAthletes.filter((a) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(query) ||
      a.id.toLowerCase().includes(query) ||
      a.team.toLowerCase().includes(query)
    );
  });

  // Contextual current pointers based on active competitionMode
  const currentDistances = competitionMode === "individual" ? distances : teamDistances;
  const currentShotsCount = competitionMode === "individual" ? shotsCount : teamShotsCount;
  const currentAthletes = competitionMode === "individual" ? athletes : teamAthletes;
  const currentInputAthletes = competitionMode === "individual" ? inputAthletes : teamInputAthletes;

  // Filter team athletes for the scoring board view list
  const filteredTeamAthletesScoring = teamAthletes.filter((a) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(query) ||
      a.id.toLowerCase().includes(query) ||
      a.team.toLowerCase().includes(query)
    );
  });

  // Filter team athletes for the input board view list
  const filteredTeamInputAthletes = teamInputAthletes.filter((a) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(query) ||
      a.id.toLowerCase().includes(query) ||
      a.team.toLowerCase().includes(query)
    );
  });

  const activeFilteredScoringAthletes = competitionMode === "individual" ? filteredAthletesScoring : filteredTeamAthletesScoring;
  const activeFilteredInputAthletes = competitionMode === "individual" ? filteredInputAthletes : filteredTeamInputAthletes;

  if (isStorageRestoring) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        <div className="z-10 flex flex-col items-center gap-6 max-w-sm">
          <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm shadow-xl animate-bounce duration-1000">
            <VSCLogo size={100} />
          </div>
          <div className="space-y-2 animate-pulse">
            <h2 className="text-xl font-black uppercase text-amber-500 tracking-wider">ĐANG ĐỒNG BỘ DỮ LIỆU</h2>
            <p className="text-xs text-gray-300 font-mono">Đang tải & bảo mật dữ liệu lưu trữ từ bộ nhớ điện thoại...</p>
          </div>
          <div className="w-16 h-1 mt-2 bg-gradient-to-r from-amber-500 to-rose-500 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-24 md:pb-16 transition-colors duration-200">
      
      {/* Real-time Network connection warning overlay */}
      {networkStatus === "offline" && (
        <div className="fixed top-0 left-0 right-0 bg-rose-600 text-white text-[11px] sm:text-xs font-black py-2.5 px-4 text-center z-[9999] flex items-center justify-center gap-2 shadow-lg tracking-wider uppercase animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
          <span>⚠️ Mất kết nối Internet! Đồng bộ Score Cloud tạm thời bị gián đoạn.</span>
        </div>
      )}
      {networkStatus === "online" && (
        <div className="fixed top-0 left-0 right-0 bg-emerald-600 text-white text-[11px] sm:text-xs font-black py-2.5 px-4 text-center z-[9999] flex items-center justify-center gap-2 shadow-lg tracking-wider uppercase">
          <span className="shrink-0">✓</span>
          <span>Đã kết nối Internet trở lại! Đám mây đang hoạt động online.</span>
        </div>
      )}

      {/* Draft Preview Warning & Publish Banner */}
      {draftPreviewItem && (
        <div className={`fixed ${networkStatus === "offline" ? "top-[36px]" : "top-0"} left-0 right-0 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-white text-[11px] sm:text-xs font-black py-2.5 px-4 text-center z-[9999] flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 shadow-xl border-b border-amber-400/20`}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm shrink-0 animate-pulse">⚡</span>
            <span className="tracking-wide">BẢN NHÁP: Thầy cô đang xem trước lịch sử thi đấu ngoại tuyến.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPublishDraftModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1 rounded-lg text-[11px] shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <CloudUpload size={13} />
              XÁC NHẬN ĐĂNG ONLINE
            </button>
            <button
              onClick={() => {
                setDraftPreviewItem(null);
                handleExitTournament();
              }}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium px-3 py-1 rounded-lg text-[11px] cursor-pointer transition-all active:scale-95 shrink-0"
            >
              Thoát bản nháp
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Main Navigation Menu (VSC Style Redesign) */}
      <header className="w-full flex flex-col font-sans" id="app-header">
        {/* Desktop Header Navigation (hidden on mobile/tablet) */}
        <div className="hidden md:flex flex-col">
        {/* 1. Top slim bar (bg-[#002e6e]) */}
        <div className="bg-[#002e6e] text-white text-[11px] font-bold py-2 px-4 shadow-xs border-b border-white/5 relative z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            {/* Left side text */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{language === "en" ? "System developed by VSC" : "Hệ thống được phát triển bởi VSC"}</span>
              {activeHistoryId && activeHistoryId.startsWith("tour-") && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ml-2 ${
                  networkStatus === "offline"
                    ? "bg-rose-500/20 text-rose-300"
                    : dbHasPendingWrites
                    ? "bg-amber-500/20 text-amber-300 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}>
                  {networkStatus === "offline" 
                    ? (language === "en" ? "Offline" : "Ngoại tuyến") 
                    : dbHasPendingWrites 
                    ? (language === "en" ? "Syncing..." : "Đang đồng bộ...") 
                    : (language === "en" ? "Cloud Sync OK" : "Đồng bộ Cloud OK")}
                </span>
              )}
            </div>

            {/* Right side options: Lang selection & Auth drop-down */}
            <div className="flex items-center gap-4">
              {/* Language Selection Toggle */}
              <div className="flex items-center gap-1 border-r border-white/20 pr-3 mr-1">
                <button
                  onClick={() => setLanguage("vi")}
                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-black transition-all cursor-pointer ${
                    language === "vi" ? "bg-amber-500 text-slate-950 font-black shadow-xs" : "text-slate-300 hover:text-white"
                  }`}
                >
                  VIE
                </button>
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-black transition-all cursor-pointer ${
                    language === "en" ? "bg-amber-500 text-slate-950 font-black shadow-xs" : "text-slate-300 hover:text-white"
                  }`}
                >
                  ENG
                </button>
              </div>

              {/* Login dropdown if authenticated */}
              {currentUser ? (
                <div className="relative" id="user-header-menu-container">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all text-left font-bold"
                  >
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-black uppercase shrink-0">
                      {currentUser.displayName?.[0] || currentUser.email?.[0] || "U"}
                    </div>
                    <span className="truncate max-w-[120px] text-white">
                      {currentUser.displayName || currentUser.email}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-300 shrink-0" />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 p-1 flex flex-col text-slate-700 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("control_panel");
                          setControlPanelSubTab("profile");
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        👤 {language === "en" ? "My Athlete Bio" : "Hồ Sơ VĐV của Tôi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("control_panel");
                          setControlPanelSubTab("created");
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        🏆 {language === "en" ? "My Created Tournaments" : "Giải Tôi Tạo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("control_panel");
                          setControlPanelSubTab("referee");
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        ⏱️ {language === "en" ? "Tournaments I Referee" : "Giải Tôi Làm Trọng Tài"}
                      </button>
                      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          auth.signOut();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        🚪 {language === "en" ? "Logout" : "Thoát"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="hover:text-yellow-400 font-extrabold uppercase transition-all tracking-wider cursor-pointer flex items-center gap-1"
                >
                  {language === "en" ? "REGISTER | LOGIN" : "ĐĂNG KÝ | ĐĂNG NHẬP"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Main Navigation Red Bar (bg-[#9c0c13]) */}
        <div className="bg-[#9c0c13] text-white relative shadow-md z-40">
          <div className="max-w-7xl mx-auto flex justify-between items-stretch">
            
            {/* Logo Brand Box on the left with blue slanted design */}
            <div 
              className="relative bg-[#004ca3] px-5 sm:px-8 py-3.5 flex items-center shrink-0 pr-10 cursor-pointer hover:opacity-95 transition-all select-none"
              style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%)' }}
              onClick={() => changeExitTournament("all")}
            >
              <div className="flex items-center gap-2">
                <div className="bg-white/10 p-1 rounded-lg border border-white/20 shadow-inner">
                  <VSCLogo size={24} />
                </div>
                <span className="font-extrabold tracking-tight text-white text-base sm:text-lg italic uppercase">
                  VSCS<span className="text-yellow-400">.ASIA</span>
                </span>
              </div>
            </div>

            {/* Menu Items on the right */}
            <div className={`flex items-center ${isEntryDropdownOpen || isRankingDropdownOpen ? "overflow-visible" : "overflow-x-auto scrollbar-none"} whitespace-nowrap scroll-smooth max-w-full font-sans select-none pr-4`}>
              <button
                onClick={() => changeExitTournament("all")}
                className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 ${
                  activeTab === "home" && homeFilter === "all" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                }`}
              >
                <Home className="w-4 h-4" />
                {language === "en" ? "Home" : "Trang Chủ"}
              </button>

              {activeTab === "home" && (
                <>
                  <button
                    onClick={() => changeExitTournament("active")}
                    className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 ${
                      homeFilter === "active" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                    }`}
                  >
                    <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/25" />
                    {language === "en" ? "Live Tournaments" : "Giải Đang Diễn Ra"}
                  </button>

                  <button
                    onClick={() => changeExitTournament("followed")}
                    className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 ${
                      homeFilter === "followed" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                    }`}
                  >
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500/25" />
                    {language === "en" ? "Followed" : "Giải Đang Theo Dõi"}
                  </button>
                </>
              )}

              {/* NHẬP/GHI ĐIỂM DROPDOWN TAB */}
              {activeHistoryId && (userRole === "admin" || userRole === "referee") && (
                <div className="relative h-full flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEntryDropdownOpen(!isEntryDropdownOpen);
                      setIsRankingDropdownOpen(false);
                    }}
                    className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 cursor-pointer h-full ${
                      activeTab === "input_scores" || activeTab === "scoring" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                    }`}
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>{language === "en" ? "Entry & Scoring" : "NHẬP/GHI ĐIỂM"}</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: isEntryDropdownOpen ? "rotate(180deg)" : "none" }} />
                  </button>

                  {isEntryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 min-w-[240px] z-50 flex flex-col font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeTab("input_scores");
                          setIsEntryDropdownOpen(false);
                        }}
                        className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          activeTab === "input_scores"
                            ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <ClipboardCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>
                          {competitionMode === "team" ? (language === "en" ? "Enter Team Scores" : "Nhập Điểm Team") : (language === "en" ? "Enter Scores" : "Nhập Điểm")}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeTab("scoring");
                          setIsEntryDropdownOpen(false);
                        }}
                        className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          activeTab === "scoring"
                            ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <Target className="w-4 h-4 shrink-0 text-indigo-500" />
                        <span>
                          {competitionMode === "team" ? (language === "en" ? "Record Team Scores" : "Ghi Điểm Team") : (language === "en" ? "Record Scores" : "Ghi Điểm")}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeHistoryId && (
                <button
                  onClick={() => changeTab("dashboard")}
                  className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 ${
                    activeTab === "dashboard" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {language === "en" ? "Overview" : "Tổng Hợp"}
                </button>
              )}

              {/* RANKING DROPDOWN TAB */}
              {activeHistoryId && (
                <div className="relative h-full flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRankingDropdownOpen(!isRankingDropdownOpen);
                      setIsEntryDropdownOpen(false);
                    }}
                    className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 cursor-pointer h-full ${
                      activeTab === "leaderboard" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Ranking</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: isRankingDropdownOpen ? "rotate(180deg)" : "none" }} />
                  </button>

                  {isRankingDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 min-w-[240px] z-50 flex flex-col font-sans">
                      {tournamentType === "combined" ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("individual");
                              localStorage.setItem("slingshot_competition_mode", "individual");
                              setRankingSubTab("individual");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "individual" && rankingSubTab === "individual"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{language === "en" ? "Individual Standings" : "Bảng Xếp Hạng Cá Nhân"}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("team");
                              localStorage.setItem("slingshot_competition_mode", "team");
                              setRankingSubTab("team");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "team" && rankingSubTab === "team"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Users className="w-4 h-4 shrink-0 text-blue-500" />
                            <span>{language === "en" ? "Club/Team Standings TEAM" : "Bảng Xếp Hạng Đồng Đội TEAM"}</span>
                          </button>
                        </>
                      ) : tournamentType === "team" ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("team");
                              localStorage.setItem("slingshot_competition_mode", "team");
                              setRankingSubTab("individual");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "team" && rankingSubTab === "individual"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{language === "en" ? "Individual Standings TEAM" : "Bảng Xếp Hạng Cá Nhân TEAM"}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("team");
                              localStorage.setItem("slingshot_competition_mode", "team");
                              setRankingSubTab("team");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "team" && rankingSubTab === "team"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Users className="w-4 h-4 shrink-0 text-blue-500" />
                            <span>{language === "en" ? "Club/Team Standings TEAM" : "Bảng Xếp Hạng Đồng Đội TEAM"}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("individual");
                              localStorage.setItem("slingshot_competition_mode", "individual");
                              setRankingSubTab("individual");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "individual" && rankingSubTab === "individual"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{language === "en" ? "Individual Standings" : "Bảng Xếp Hạng Cá Nhân"}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompetitionMode("individual");
                              localStorage.setItem("slingshot_competition_mode", "individual");
                              setRankingSubTab("team");
                              setIsSpectatorModeOverridden(true);
                              changeTab("leaderboard");
                              setIsRankingDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-left flex items-center gap-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              activeTab === "leaderboard" && competitionMode === "individual" && rankingSubTab === "team"
                                ? "text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <Users className="w-4 h-4 shrink-0 text-blue-500" />
                            <span>{language === "en" ? "Club/Team Standings" : "Bảng Xếp Hạng Đồng Đội"}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeHistoryId && userRole === "admin" && (
                <button
                  onClick={() => {
                    changeTab("settings");
                    setSettingsSubTab("config");
                  }}
                  className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 ${
                    activeTab === "settings" && settingsSubTab === "config" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  {language === "en" ? "Settings" : "Cài Đặt"}
                </button>
              )}

              {userRole === "admin" && (
                <button
                  onClick={() => changeTab("history")}
                  className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 relative ${
                    activeTab === "history" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                  }`}
                >
                  <History className="w-4 h-4" />
                  {language === "en" ? "Backups" : "Lịch Sử"}
                  {history.length > 0 && (
                    <span className="absolute top-2 right-1.5 bg-amber-500 text-white border border-[#9c0c13] rounded-full text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center font-sans">
                      {history.length}
                    </span>
                  )}
                </button>
              )}

              {isGlobalAdmin && (
                <button
                  onClick={() => changeTab("qltv")}
                  className={`px-4.5 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all hover:bg-black/15 flex items-center gap-1.5 relative ${
                    activeTab === "qltv" ? "bg-black/25 text-yellow-400 border-b-4 border-yellow-400 font-black" : "text-white"
                  }`}
                >
                  <Users className="w-4 h-4 text-amber-300" />
                  QLTV
                </button>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Mobile Header Bar (visible only on mobile/tablet) */}
        <div className="flex md:hidden bg-[#9c0c13] text-white h-16 items-center justify-between px-4 sticky top-0 z-[100] border-b border-red-800 shadow-md">
          {/* Left Side: 3-bar menu icon */}
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="fixed top-3 left-3 z-[150] p-2 bg-[#9c0c13] text-white rounded-full shadow-lg border border-red-700 hover:bg-[#850a0f] active:scale-95 transition-all cursor-pointer flex items-center justify-center w-10 h-10"
              id="mobile-floating-menu-btn"
            >
              <Menu className="w-5.5 h-5.5 text-white" />
            </button>
            {/* Spacer to preserve layout structure when menu is positioned fixed */}
            <div className="w-10 h-10" />
            <div className="h-6 w-[1px] bg-white/20 ml-2" />
          </div>

          {/* Center Side: Logo and Title */}
          <div 
            onClick={() => changeExitTournament("all")} 
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="bg-white/10 p-1.5 rounded-full border border-white/20 shrink-0">
              <VSCLogo size={24} />
            </div>
            <div className="flex flex-col items-center">
              <span className="font-extrabold tracking-tight text-white text-[15px] italic uppercase leading-none">
                VSCS<span className="text-yellow-450">.ASIA</span>
              </span>
              <span className="text-[8px] text-white/80 font-medium tracking-wide mt-0.5">
                Hệ thống giải đấu VSC
              </span>
            </div>
          </div>

          {/* Right Side: Profile drop-down */}
          <div className="relative" id="user-header-menu-container-mobile">
            {currentUser ? (
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 bg-black/15 py-1.5 px-2.5 rounded-lg border border-white/10 text-white font-bold cursor-pointer hover:bg-black/25 active:scale-95 transition-all text-xs"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-black uppercase shrink-0">
                  {currentUser.displayName?.[0] || currentUser.email?.[0] || "U"}
                </div>
                <ChevronDown className="w-3 h-3 text-zinc-350 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1 bg-black/15 py-1.5 px-2.5 rounded-lg border border-white/10 text-white font-bold cursor-pointer hover:bg-black/25 active:scale-95 transition-all text-xs uppercase"
              >
                <User className="w-3.5 h-3.5 text-white" />
                <ChevronDown className="w-3 h-3 text-zinc-350 shrink-0" />
              </button>
            )}

            {/* Mobile User Dropdown menu overlay */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 p-1 flex flex-col text-slate-700 dark:text-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("control_panel");
                    setControlPanelSubTab("profile");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  👤 {language === "en" ? "My Athlete Bio" : "Hồ Sơ VĐV của Tôi"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("control_panel");
                    setControlPanelSubTab("created");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  🏆 {language === "en" ? "My Created Tournaments" : "Giải Tôi Tạo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("control_panel");
                    setControlPanelSubTab("referee");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  ⏱️ {language === "en" ? "Tournaments I Referee" : "Giải Tôi Làm Trọng Tài"}
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    auth.signOut();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  🚪 {language === "en" ? "Logout" : "Thoát"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3Gach Mobile Sidebar Drawer Menu */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-[99998] md:hidden">
            {/* Backdrop Overlay */}
            <div 
              className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Panel content */}
            <div className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-[99999] flex flex-col animate-slideInLeft text-left">
              {/* Drawer Header */}
              <div className="p-4 bg-[#9c0c13] text-white flex items-center justify-between">
                <div className="flex items-center gap-2 select-none">
                  <VSCLogo size={24} />
                  <span className="font-extrabold text-[15px] italic">VSC MENU</span>
                </div>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Drawer Items - Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                
                {/* Category 1: Navigation */}
                <div className="space-y-1">
                  <div className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-1">
                    {language === "en" ? "SYSTEM PORTAL" : "HỆ THỐNG CHÍNH"}
                  </div>
                  
                  {/* Home link */}
                  <button
                    onClick={() => {
                      changeExitTournament("all");
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                      activeTab === "home" && homeFilter === "all"
                        ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Home className="w-4 h-4 shrink-0" />
                    <span>{language === "en" ? "Home Portal" : "Trang Chủ VSC"}</span>
                  </button>

                  {/* Live Tournaments */}
                  <button
                    onClick={() => {
                      changeExitTournament("active");
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                      activeTab === "home" && homeFilter === "active"
                        ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Play className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>{language === "en" ? "Live Tournaments" : "Giải Đang Diễn Ra"}</span>
                  </button>

                  {/* Followed Tournaments */}
                  <button
                    onClick={() => {
                      changeExitTournament("followed");
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                      activeTab === "home" && homeFilter === "followed"
                        ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Heart className="w-4 h-4 shrink-0 text-rose-500 fill-rose-500/10" />
                    <span>{language === "en" ? "Followed Tournaments" : "Giải Đang Theo Dõi"}</span>
                  </button>

                  {/* Create Tournament */}
                  <button
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      if (activeHistoryId) {
                        handleExitTournament();
                      }
                      setActiveTab("settings");
                      setSettingsSubTab("config");
                      setIsNewTournamentModalOpen(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <Plus className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>{language === "en" ? "Create Tournament" : "Tạo Giải Đấu Mới"}</span>
                  </button>
                </div>

                {/* Category 2: Active Tournament (if loaded) */}
                {activeHistoryId && (
                  <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-1">
                      {language === "en" ? "ACTIVE TOURNAMENT" : "GIẢI ĐANG CHỌN"}
                    </div>

                    {/* Overview */}
                    <button
                      onClick={() => {
                        changeTab("dashboard");
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                        activeTab === "dashboard"
                          ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 shrink-0" />
                      <span>{language === "en" ? "Dashboard Hub" : "Tổng Hợp Trận Đấu"}</span>
                    </button>

                    {/* Leaderboards */}
                    <button
                      onClick={() => {
                        changeTab("leaderboard");
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                        activeTab === "leaderboard"
                          ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Trophy className="w-4 h-4 shrink-0 text-amber-550" />
                      <span>{language === "en" ? "Ranking Standings" : "Bảng Xếp Hạng VSC"}</span>
                    </button>

                    {/* Scoring & Entries for Admins/Referees */}
                    {(userRole === "admin" || userRole === "referee") && (
                      <>
                        {/* Entry Board */}
                        <button
                          onClick={() => {
                            changeTab("input_scores");
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                            activeTab === "input_scores"
                              ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <ClipboardCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                          <span>{language === "en" ? "Scoring Entry Grid" : "Nhập Điểm Thi Đấu"}</span>
                        </button>

                        {/* Ghi Điểm */}
                        <button
                          onClick={() => {
                            changeTab("scoring");
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                            activeTab === "scoring"
                              ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <Target className="w-4 h-4 shrink-0 text-indigo-500" />
                          <span>{language === "en" ? "Record Score Card" : "Ghi Điểm Trực Tiếp"}</span>
                        </button>
                      </>
                    )}

                    {/* Athletes list */}
                    <button
                      onClick={() => {
                        changeTab("athletes");
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                        activeTab === "athletes"
                          ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0 text-blue-500" />
                      <span>{language === "en" ? "Athletes Roster" : "Danh Sách VĐV"}</span>
                    </button>

                    {/* Configuration Settings (Admins only) */}
                    {userRole === "admin" && (
                      <button
                        onClick={() => {
                          changeTab("settings");
                          setIsMobileDrawerOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                          activeTab === "settings"
                            ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                        <span>{language === "en" ? "Match Config" : "Cấu Hình & Tham Số"}</span>
                      </button>
                    )}

                    {/* Exit current tournament */}
                    <button
                      onClick={() => {
                        handleExitTournament();
                        setIsMobileDrawerOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>{language === "en" ? "Exit Tournament View" : "Thoát Giải Đang Xem"}</span>
                    </button>
                  </div>
                )}

                {/* Category 3: Settings & Lang */}
                <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-2">
                    {language === "en" ? "PREFERENCES & PROFILE" : "TÀI KHOẢN & NGÔN NGỮ"}
                  </div>

                  {/* QLTV for Global Admins */}
                  {isGlobalAdmin && (
                    <button
                      onClick={() => {
                        changeTab("qltv");
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                        activeTab === "qltv"
                          ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>{language === "en" ? "Manage Users (QLTV)" : "Quản Lý Thành Viên (QLTV)"}</span>
                    </button>
                  )}

                  {/* My Bio */}
                  <button
                    onClick={() => {
                      if (currentUser) {
                        setActiveTab("control_panel");
                        setControlPanelSubTab("profile");
                      } else {
                        setIsAuthModalOpen(true);
                      }
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 transition-all ${
                      activeTab === "control_panel" && controlPanelSubTab === "profile"
                        ? "bg-red-50 text-[#9c0c13] dark:bg-red-950/20 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0 text-sky-500" />
                    <span>{language === "en" ? "My Athlete Biography" : "Hồ Sơ Cá Nhân Của Tôi"}</span>
                  </button>

                  {/* Logged in User actions */}
                  {currentUser ? (
                    <button
                      onClick={() => {
                        auth.signOut();
                        setIsMobileDrawerOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-3 text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>{language === "en" ? "Sign Out" : "Đăng Xuất"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAuthModalOpen(true);
                        setIsMobileDrawerOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-black flex items-center gap-3 text-[#9c0c13] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/10 transition-all"
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>{language === "en" ? "Register / Login" : "Đăng Ký / Đăng Nhập"}</span>
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 3. Hero Banner Background (below header, visible ONLY on "home" screen) */}
        {activeTab === "home" && (
          <div 
            className="w-full relative py-20 px-4 flex flex-col justify-center items-center shadow-inner text-center select-none overflow-hidden"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.65)), url("https://lh3.googleusercontent.com/d/1sEes6o_PO8DTO4ZQa3IcvDcMK_2kwoPC")',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Ambient gold glow effect overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-4xl w-full flex flex-col items-center relative z-10">
              <h2 className="text-[1px] leading-[150px] h-[130px] font-black text-white tracking-wider uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] mb-8 font-sans">
                {language === "en" ? "PROFESSIONAL LEAGUE MANAGEMENT SYSTEM" : "HỆ THỐNG QUẢN LÝ GIẢI ĐẤU CHUYÊN NGHIỆP"}
              </h2>
            </div>

            {/* Total online tournaments display at the bottom-right of the Banner */}
            <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 text-xs font-bold text-white/90 bg-black/45 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
              <Globe className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
              <span>
                {language === "en" 
                  ? `Total online tournaments: ${onlineTournaments.length}` 
                  : `Tổng số giải đấu trực tuyến: ${onlineTournaments.length}`}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Core Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6 flex flex-col gap-6" id="app-main">

        {/* Athlete Search query on scoring tabs */}
        {(activeTab === "scoring" || activeTab === "input_scores") && (
          <div className="flex justify-end mb-2 animate-fadeIn" id="athlete-search-context-container">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === "en" ? "Search athlete (Name, ID, Club)..." : "Tìm vận động viên (Tên, Mã, Đội)..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-xs sm:text-sm bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs"
              />
            </div>
          </div>
        )}

        {/* Tab content area logic */}
        <div className="tab-content translate-y-0" id="active-tab-panel">
          
          {/* TAB -1: HOME ONLINE TOURNAMENT COMPASS BOARD */}
          {activeTab === "home" && (
            <OnlineTournamentsPanel
              activeHistoryId={activeHistoryId}
              onSelectTournament={handleSelectTournament}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onRedirectToCreateTournament={() => {
                if (activeHistoryId) {
                  handleExitTournament();
                }
                setActiveTab("settings");
                setSettingsSubTab("config");
                setIsNewTournamentModalOpen(true);
              }}
              currentSetup={{
                matchName,
                competitionMode,
                shotsCount,
                teamShotsCount,
                directMaxPoints,
                teamDirectMaxPoints,
                distances,
                teamDistances,
                athletes,
                teamAthletes,
                inputAthletes,
                teamInputAthletes,
                startDate,
                endDate,
                tournamentType,
                bannerUrl,
                avatarUrl,
              }}
              externalSearch={globalSearch}
              onExternalSearchChange={setGlobalSearch}
              onGoToManageTournaments={() => {
                setHomeFilter("all_list");
                setActiveTab("home");
              }}
              tabFilter={homeFilter}
            />
          )}

          {/* TAB 0: SUMMARY TOURNAMENT DASHBOARD */}
          {activeTab === "dashboard" && (
            <MainDashboard
              athletes={leaderboardAthletes}
              distances={distances}
              shotsCount={shotsCount}
              matchName={matchName}
              masterAthletes={masterAthletes}
              teamAthletes={teamAthletes}
              teamDistances={teamDistances}
              teamShotsCount={teamShotsCount}
              leaderboardTeamAthletes={leaderboardTeamAthletes}
              directMaxShots={directMaxShots}
              teamDirectMaxShots={teamDirectMaxShots}
              directMaxPoints={directMaxPoints}
              teamDirectMaxPoints={teamDirectMaxPoints}
              tournamentType={tournamentType}
              clubs={clubs}
              onOpenLiveBoard={() => setIsLiveBoardOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
            />
          )}

          {/* TAB 1: SCORING WORKSPACE BOARD */}
          {activeTab === "scoring" && (
            <div className="flex flex-col gap-6">

              {/* Environment Switcher for Combined Tournament */}
              {tournamentType === "combined" && (
                <div className="flex bg-gray-100 dark:bg-slate-850 p-1.5 rounded-xl self-start mb-2 gap-1.5 border border-gray-200/50 dark:border-slate-700/50">
                  <button
                    onClick={() => {
                      setCompetitionMode("individual");
                      localStorage.setItem("slingshot_competition_mode", "individual");
                      setIsSpectatorModeOverridden(true);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      competitionMode === "individual"
                        ? "bg-indigo-650 text-white shadow-md scale-[1.02]"
                        : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    {language === "en" ? "Individual" : "Cá Nhân"}
                  </button>
                  <button
                    onClick={() => {
                      setCompetitionMode("team");
                      localStorage.setItem("slingshot_competition_mode", "team");
                      setIsSpectatorModeOverridden(true);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      competitionMode === "team"
                        ? "bg-indigo-650 text-white shadow-md scale-[1.02]"
                        : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    {language === "en" ? "Team" : "Đồng Đội"}
                  </button>
                </div>
              )}

              {/* Protection Indicator Banner */}
              <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                isScoringEditAuthorized 
                  ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/60" 
                  : "bg-amber-50/75 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/60"
              }`}>
                <div className="flex gap-3 items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isScoringEditAuthorized 
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" 
                      : "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                  }`}>
                    {isScoringEditAuthorized ? (
                      <Unlock className="w-5 h-5 animate-pulse" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold block text-sm text-slate-800 dark:text-slate-200">
                      {isScoringEditAuthorized ? "Chế độ: ĐANG GHI ĐIỂM (Chỉnh Sửa Live)" : "Chế độ: ĐANG XEM (Đóng băng bảng điểm)"}
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight">
                      {isScoringEditAuthorized 
                        ? "Bảng điểm đã được mở khóa. Thầy/Cô có thể ghi điểm trực tiếp." 
                        : "Nhấp vào bất kỳ phát bắn nào sẽ hiển thị cảnh báo mở khóa để tránh click nhầm."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 self-end sm:self-auto shrink-0">
                  {isScoringEditAuthorized ? (
                    <button
                      onClick={() => setIsScoringEditAuthorized(false)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" /> Lock: Chuyển Chế độ Xem
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsScoringEditAuthorized(true)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-extrabold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-indigo-300"
                    >
                      <Unlock className="w-3.5 h-3.5 animate-bounce" /> Unlock: Ghi Điểm
                    </button>
                  )}
                </div>
              </div>

              {/* Informative tips box if athletes is zero */}
              {currentAthletes.length === 0 && (
                <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-3xl bg-white">
                  <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-700">Hiện không có VĐV nào trong giải đấu</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                    Hãy nhấn nút <span className="text-rose-500 font-extrabold text-base border border-rose-200 bg-rose-50/50 px-2 py-0.5 rounded-lg">+</span> bên dưới để thêm các vận động viên từ hồ sơ hệ thống vào giải đấu hiện tại!
                  </p>
                </div>
              )}

               {/* Grid Athletes List of Cards (Dynamic responsive) */}
              <div className="flex flex-col gap-6">
                {activeFilteredScoringAthletes.map((athlete) => {
                  const originalIndex = currentAthletes.findIndex((a) => a.id === athlete.id);
                  const isFirst = originalIndex === 0;
                  const isLast = originalIndex === currentAthletes.length - 1;
                  
                  const activeInputListInDoc = competitionMode === "individual"
                    ? (currentTournamentDoc?.inputAthletes || [])
                    : (currentTournamentDoc?.teamInputAthletes || []);
                  const docActiveInputPlayer = activeInputListInDoc.find((a) => a.id === athlete.id);
                  const isLockedByOtherReferee = !!(athlete.calledBy && 
                    athlete.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim()) || 
                    !!(docActiveInputPlayer?.calledBy && docActiveInputPlayer.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim());
                  const lockedByRefereeEmail = athlete.calledBy || docActiveInputPlayer?.calledBy || "";

                  return (
                    <AthleteCard
                      key={athlete.id}
                      athlete={athlete}
                      distances={currentDistances}
                      shotsCount={currentShotsCount}
                      onToggleScore={handleToggleScore}
                      onUpdateAthlete={handleUpdateAthlete}
                      onDeleteAthlete={handleDeleteAthlete}
                      onMoveAthlete={handleMoveAthlete}
                      isFirst={isFirst}
                      isLast={isLast}
                      onUpdateSoloHits={handleUpdateSoloHits}
                      isScoringEditAuthorized={isScoringEditAuthorized}
                      onTriggerUnlockModal={() => setShowUnlockScoreModal(true)}
                      onUpdateDirectScore={handleUpdateDirectScore}
                      directMaxPoints={competitionMode === "individual" ? directMaxPoints : teamDirectMaxPoints}
                      isLockedByOtherReferee={isLockedByOtherReferee}
                      lockedByRefereeEmail={lockedByRefereeEmail}
                    />
                  );
                })}
              </div>

              {/* Dynamic instruction helper indicating calculated score logic */}
              <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-4 flex gap-3 text-xs text-blue-800">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <span className="font-bold block mb-1">Cách tính điểm tự động của hệ thống:</span>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>Mỗi ô checked (tích) của lượt bắn đại diện cho 1 phát trúng (Hit) tương đương 1 điểm cơ sở.</li>
                    <li>Điểm số của từng cự ly = <span className="font-bold">Số viên trúng × Hệ số điểm nhân</span> của cự ly đó.</li>
                    <li>ĐIỂM TỔNG = Tổng điểm cộng dồn từ toàn bộ các dòng cự ly.</li>
                  </ul>
                </div>
              </div>

              {/* Add Athlete to Tournament panel inline form */}
              {isAddingAthleteToTournament && (
                <div className="bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-900 rounded-2xl p-5 max-w-xl w-full mx-auto shadow-md relative animate-fadeIn">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                      <UserPlus className="w-4 h-4 text-indigo-600" />
                      Thêm VĐV hệ thống vào giải đấu
                    </h3>
                    <button
                      onClick={() => {
                        setIsAddingAthleteToTournament(false);
                        setTourAddSearch("");
                        setSelectedTourAthleteIds([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search input for Master Roster */}
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm hồ sơ theo ID, Tên, Đội..."
                      value={tourAddSearch}
                      onChange={(e) => setTourAddSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white font-medium"
                    />
                  </div>

                  {/* Header tools for multi-select */}
                  {(() => {
                    const unselected = masterAthletes.filter(
                      (m) => !currentAthletes.some((a) => a.id === m.id) && m.status !== "Bỏ thi" && (competitionMode !== "team" || m.isPrimaryTeam)
                    );
                    const filtered = unselected.filter((m) => {
                      if (!tourAddSearch.trim()) return true;
                      const s = tourAddSearch.toLowerCase();
                      return (
                        m.id.toLowerCase().includes(s) ||
                        m.name.toLowerCase().includes(s) ||
                        (m.team && m.team.toLowerCase().includes(s))
                      );
                    });

                    if (filtered.length === 0) return null;

                    const allFilteredSelected = filtered.every((f) => selectedTourAthleteIds.includes(f.id));
                    const someFilteredSelected = filtered.some((f) => selectedTourAthleteIds.includes(f.id));

                    const handleToggleSelectAll = () => {
                      if (allFilteredSelected) {
                        // Deselect all filtered items
                        const filteredIds = filtered.map((f) => f.id);
                        setSelectedTourAthleteIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                      } else {
                        // Select all filtered items
                        const filteredIds = filtered.map((f) => f.id);
                        setSelectedTourAthleteIds((prev) => {
                          const combined = [...prev, ...filteredIds];
                          return Array.from(new Set(combined));
                        });
                      }
                    };

                    return (
                      <div className="flex items-center justify-between mb-2 px-1 text-xs">
                        <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            ref={(el: HTMLInputElement | null) => {
                              if (el) {
                                el.indeterminate = someFilteredSelected && !allFilteredSelected;
                              }
                            }}
                            onChange={handleToggleSelectAll}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span>Chọn tất cả kết quả ({filtered.length})</span>
                        </label>
                        {selectedTourAthleteIds.length > 0 && (
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                            Đã chọn: {selectedTourAthleteIds.length}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* List of master athletes not in tournament */}
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-800 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-1">
                    {(() => {
                      const unselected = masterAthletes.filter(
                        (m) => !currentAthletes.some((a) => a.id === m.id) && m.status !== "Bỏ thi" && (competitionMode !== "team" || m.isPrimaryTeam)
                      );
                      const filtered = unselected.filter((m) => {
                        if (!tourAddSearch.trim()) return true;
                        const s = tourAddSearch.toLowerCase();
                        return (
                          m.id.toLowerCase().includes(s) ||
                          m.name.toLowerCase().includes(s) ||
                          (m.team && m.team.toLowerCase().includes(s))
                        );
                      });

                      if (unselected.length === 0) {
                        return (
                          <div className="text-center py-5 text-xs text-slate-500 font-medium">
                            Tất cả vận động viên trong hệ thống hiện đã có mặt ở giải đấu này.
                          </div>
                        );
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-5 text-xs text-slate-500 font-medium">
                            Không thấy hồ sơ nào có ID hoặc Tên khớp.
                          </div>
                        );
                      }

                      return filtered.map((m) => {
                        const isChecked = selectedTourAthleteIds.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2 sm:gap-4 cursor-pointer border rounded-xl transition-all ${
                              isChecked 
                                ? "bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800" 
                                : "hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border-transparent hover:border-indigo-300"
                            }`}
                            onClick={() => {
                              setSelectedTourAthleteIds((prev) => 
                                prev.includes(m.id) 
                                  ? prev.filter((id) => id !== m.id) 
                                  : [...prev, m.id]
                              );
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Handled by row click, no-op to avoid react warnings
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                              <span className="text-[10px] uppercase font-bold font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                                ID: {m.id}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{m.name}</span>
                                  {m.status === "Bỏ thi" && (
                                    <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 uppercase whitespace-nowrap shrink-0">
                                      Bỏ thi
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-500 font-normal block truncate w-full">
                                  {m.team || "Tự do"} • {m.gender || "Nam"}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // prevent row click toggle
                                // Add single immediately
                                const freshScores: Record<string, (boolean | null)[]> = {};
                                currentDistances.forEach((d) => {
                                  freshScores[d.id] = Array(currentShotsCount).fill(null);
                                });
                                const addedPlayer: Athlete = {
                                  ...m,
                                  scores: freshScores,
                                };
                                if (competitionMode === "individual") {
                                  setAthletes((prev) => [...prev, addedPlayer]);
                                } else {
                                  setTeamAthletes((prev) => [...prev, addedPlayer]);
                                }
                                // Remove from selected if added
                                setSelectedTourAthleteIds((prev) => prev.filter((id) => id !== m.id));
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] text-white text-[11px] font-black px-3.5 py-2 rounded-xl transition-all duration-150 whitespace-nowrap cursor-pointer shadow-md active:scale-95 w-full sm:w-auto sm:shrink-0 flex items-center gap-1 border border-emerald-800 text-center justify-center font-sans uppercase tracking-wider mt-1.5 sm:mt-0 max-sm:flex-1"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Thêm
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Multi addition master action button */}
                  {selectedTourAthleteIds.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          const toAdd = masterAthletes.filter((m) => selectedTourAthleteIds.includes(m.id));
                          const newAthletes: Athlete[] = toAdd.map((m) => {
                            const freshScores: Record<string, (boolean | null)[]> = {};
                            currentDistances.forEach((d) => {
                              freshScores[d.id] = Array(currentShotsCount).fill(null);
                            });
                            return {
                              ...m,
                              scores: freshScores,
                            };
                          });
                          if (competitionMode === "individual") {
                            setAthletes((prev) => [...prev, ...newAthletes]);
                          } else {
                            setTeamAthletes((prev) => [...prev, ...newAthletes]);
                          }
                          setSelectedTourAthleteIds([]);
                          setIsAddingAthleteToTournament(false);
                          setTourAddSearch("");
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold py-2 px-4 rounded-xl transition-all duration-150 shadow-md flex items-center justify-center gap-1 active:scale-[0.99]"
                      >
                        Thêm {selectedTourAthleteIds.length} VĐV đã chọn vào giải đấu
                      </button>
                    </div>
                  )}

                  <div className="mt-3 text-[10.5px] text-slate-400 text-center">
                    Ý kiến: Nếu chưa đăng ký VĐV này, hãy chuyển qua tab{" "}
                    <button
                      onClick={() => {
                        setActiveTab("settings");
                        setSettingsSubTab("athletes");
                        setIsAddingAthleteToTournament(false);
                        setSelectedTourAthleteIds([]);
                      }}
                      className="font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Quản Lý VĐV
                    </button>{" "}
                    để đăng ký hồ sơ vĩnh viễn trước.
                  </div>
                </div>
              )}

              {/* The giant Centered button below cards list as described by User */}
              <div className="flex justify-center items-center py-6">
                <button
                  onClick={handleAddBlankAthlete}
                  className="w-14 h-14 bg-white hover:bg-rose-50 border-2 border-rose-500 text-rose-500 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-150 cursor-pointer"
                  title="Thêm vận động viên mới"
                  id="add-athlete-giant-btn"
                >
                  <Plus className="w-8 h-8 stroke-[3]" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 1B: NHẬP ĐIỂM DRAFT BOARD */}
          {activeTab === "input_scores" && (
            <div className="flex flex-col gap-6">

              {/* Environment Switcher for Combined Tournament */}
              {tournamentType === "combined" && (
                <div className="flex bg-gray-100 dark:bg-slate-850 p-1.5 rounded-xl self-start mb-2 gap-1.5 border border-gray-200/50 dark:border-slate-700/50">
                  <button
                    onClick={() => {
                      setCompetitionMode("individual");
                      localStorage.setItem("slingshot_competition_mode", "individual");
                      setIsSpectatorModeOverridden(true);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      competitionMode === "individual"
                        ? "bg-indigo-650 text-white shadow-md scale-[1.02]"
                        : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    {language === "en" ? "Individual" : "Cá Nhân"}
                  </button>
                  <button
                    onClick={() => {
                      setCompetitionMode("team");
                      localStorage.setItem("slingshot_competition_mode", "team");
                      setIsSpectatorModeOverridden(true);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      competitionMode === "team"
                        ? "bg-indigo-650 text-white shadow-md scale-[1.02]"
                        : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    {language === "en" ? "Team" : "Đồng Đội"}
                  </button>
                </div>
              )}

              {/* Informative explanation tip */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 text-xs text-amber-800 dark:text-amber-300">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold block mb-1 font-sans">Bảng Nhập Điểm tạm thời:</span>
                  <p className="text-[11px] leading-relaxed">
                    Đây là khu vực nhập điểm nhanh cho tốp đấu mới hoặc các lượt thi đang diễn ra. Khi nhập điểm xong, hãy bấm nút <strong>LƯU ĐIỂM</strong> để tự động chuyển kết quả và lưu vĩnh viễn các vận động viên này sang tab <strong>Ghi Điểm</strong>.
                  </p>
                </div>
              </div>

              {/* Informative tips box if currentInputAthletes is zero */}
              {currentInputAthletes.length === 0 && (
                <div className="text-center p-12 border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-sm">
                  <ClipboardCheck className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-700 dark:text-slate-300">Bảng nhập điểm hiện đang trống</h3>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                    Hãy nhấn nút <span className="text-indigo-500 font-extrabold text-base border border-indigo-200 bg-indigo-50/50 px-2 py-0.5 rounded-lg">+</span> bên dưới để chọn vận động viên từ hồ sơ hệ thống vào bảng Nhập Điểm!
                  </p>
                </div>
              )}

              {/* Grid Athletes List of Cards (Dynamic responsive) */}
              <div className="flex flex-col gap-6">
                {activeFilteredInputAthletes.map((athlete) => {
                  const originalIndex = currentInputAthletes.findIndex((a) => a.id === athlete.id);
                  const isFirst = originalIndex === 0;
                  const isLast = originalIndex === currentInputAthletes.length - 1;
                  
                  const isLockedByOtherReferee = !!(athlete.calledBy && 
                    athlete.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim());
                  const lockedByRefereeEmail = athlete.calledBy || "";

                  return (
                    <AthleteCard
                      key={athlete.id}
                      athlete={athlete}
                      distances={currentDistances}
                      shotsCount={currentShotsCount}
                      onToggleScore={handleToggleInputScore}
                      onUpdateAthlete={handleUpdateInputAthlete}
                      onDeleteAthlete={handleDeleteInputAthlete}
                      onMoveAthlete={handleMoveInputAthlete}
                      isFirst={isFirst}
                      isLast={isLast}
                      isInputTab={true}
                      mainAthletes={currentAthletes}
                      onUpdateSoloHits={handleUpdateInputSoloHits}
                      onUpdateDirectScore={handleUpdateDirectInputScore}
                      directMaxPoints={competitionMode === "individual" ? directMaxPoints : teamDirectMaxPoints}
                      isLockedByOtherReferee={isLockedByOtherReferee}
                      lockedByRefereeEmail={lockedByRefereeEmail}
                    />
                  );
                })}
              </div>

              {/* Add Athlete to Input Board panel inline form */}
              {isAddingAthleteToInputBoard && (
                <div className="bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-900 rounded-2xl p-5 max-w-xl w-full mx-auto shadow-md relative animate-fadeIn">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                      <UserPlus className="w-4 h-4 text-indigo-600" />
                      Chọn VĐV hệ thống để Nhập Điểm
                    </h3>
                    <button
                      onClick={() => {
                        setIsAddingAthleteToInputBoard(false);
                        setInputBoardAddSearch("");
                        setSelectedInputBoardAthleteIds([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search input for Master Roster */}
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm hồ sơ theo ID, Tên, Đội..."
                      value={inputBoardAddSearch}
                      onChange={(e) => setInputBoardAddSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white font-medium"
                    />
                  </div>

                  {/* Header tools for multi-select */}
                  {(() => {
                    const unselected = masterAthletes.filter(
                      (m) => !currentInputAthletes.some((a) => a.id === m.id) && m.status !== "Bỏ thi" && (competitionMode !== "team" || m.isPrimaryTeam)
                    );
                    const filtered = unselected.filter((m) => {
                      if (!inputBoardAddSearch.trim()) return true;
                      const s = inputBoardAddSearch.toLowerCase();
                      return (
                        m.id.toLowerCase().includes(s) ||
                        m.name.toLowerCase().includes(s) ||
                        (m.team && m.team.toLowerCase().includes(s))
                      );
                    });

                    if (filtered.length === 0) return null;

                    // Keep all filtered athletes selectable
                    const allowedFiltered = filtered;
                    const allFilteredSelected = allowedFiltered.length > 0 && allowedFiltered.every((f) => selectedInputBoardAthleteIds.includes(f.id));
                    const someFilteredSelected = allowedFiltered.some((f) => selectedInputBoardAthleteIds.includes(f.id));

                    const handleToggleSelectAll = () => {
                      if (allFilteredSelected) {
                        const filteredIds = allowedFiltered.map((f) => f.id);
                        setSelectedInputBoardAthleteIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                      } else {
                        const filteredIds = allowedFiltered.map((f) => f.id);
                        setSelectedInputBoardAthleteIds((prev) => {
                          const combined = [...prev, ...filteredIds];
                          return Array.from(new Set(combined));
                        });
                      }
                    };

                    return (
                      <div className="flex items-center justify-between mb-2 px-1 text-xs">
                        {allowedFiltered.length > 0 ? (
                          <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              ref={(el: HTMLInputElement | null) => {
                                if (el) {
                                  el.indeterminate = someFilteredSelected && !allFilteredSelected;
                                }
                              }}
                              onChange={handleToggleSelectAll}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Chọn tất cả ({allowedFiltered.length}) vđv</span>
                          </label>
                        ) : (
                          <span className="text-gray-400 font-normal">Không có vận động viên nào khác để chọn.</span>
                        )}
                        {selectedInputBoardAthleteIds.length > 0 && (
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                            Đã chọn: {selectedInputBoardAthleteIds.length}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* List of master athletes not in inputAthletes */}
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-800 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-1">
                    {(() => {
                      const unselected = masterAthletes.filter(
                        (m) => !currentInputAthletes.some((a) => a.id === m.id) && m.status !== "Bỏ thi" && (competitionMode !== "team" || m.isPrimaryTeam)
                      );
                      const filtered = unselected.filter((m) => {
                        if (!inputBoardAddSearch.trim()) return true;
                        const s = inputBoardAddSearch.toLowerCase();
                        return (
                          m.id.toLowerCase().includes(s) ||
                          m.name.toLowerCase().includes(s) ||
                          (m.team && m.team.toLowerCase().includes(s))
                        );
                      });

                      if (unselected.length === 0) {
                        return (
                          <div className="text-center py-5 text-xs text-slate-500 font-medium">
                            Tất cả vận động viên trong hệ thống hiện đã có mặt ở bảng Nhập Điểm này.
                          </div>
                        );
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-5 text-xs text-slate-500 font-medium">
                            Không thấy hồ sơ nào có ID hoặc Tên khớp.
                          </div>
                        );
                      }

                      const sortedFiltered = [...filtered].sort((a, b) => {
                        const scoreA = currentAthletes.find((x) => x.id === a.id);
                        const scoreB = currentAthletes.find((x) => x.id === b.id);
                        
                        const statusA = !scoreA ? 0 : (currentDistances.some((d) => !scoreA.scores[d.id] || scoreA.scores[d.id].every(s => s === null)) ? 1 : 2);
                        const statusB = !scoreB ? 0 : (currentDistances.some((d) => !scoreB.scores[d.id] || scoreB.scores[d.id].every(s => s === null)) ? 1 : 2);
                        
                        if (statusA !== statusB) {
                          return statusA - statusB;
                        }
                        return a.id.localeCompare(b.id, undefined, { numeric: true });
                      });

                      return sortedFiltered.map((m) => {
                        const scoringAthlete = currentAthletes.find((a) => a.id === m.id);
                        const isAlreadyInScoring = !!scoringAthlete;
                        const isMissingSomeDistances = scoringAthlete 
                          ? currentDistances.some((d) => {
                              const shots = scoringAthlete.scores[d.id];
                              return !shots || shots.every((s) => s === null);
                            })
                          : false;
                        
                        // Check if another referee has called this athlete in the document lists
                        const activeListInDoc = competitionMode === "individual"
                          ? (currentTournamentDoc?.inputAthletes || [])
                          : (currentTournamentDoc?.teamInputAthletes || []);
                        const documentActivePlayer = activeListInDoc.find((a) => a.id === m.id);
                        const otherRefereeEmail = documentActivePlayer?.calledBy && 
                          documentActivePlayer.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim()
                          ? documentActivePlayer.calledBy
                          : null;
                        
                        const isCallerBlocked = !!otherRefereeEmail;
                        const isSelectionBlocked = isCallerBlocked;
                        const isChecked = selectedInputBoardAthleteIds.includes(m.id);
                        
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2 sm:gap-4 border rounded-xl transition-all ${
                              isSelectionBlocked
                                ? "bg-amber-50/45 dark:bg-amber-955/10 border-amber-200 dark:border-amber-955/60 opacity-65 cursor-not-allowed"
                                : isChecked
                                ? "bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800 cursor-pointer"
                                : "hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border-transparent hover:border-indigo-300 cursor-pointer"
                            }`}
                            onClick={() => {
                              if (isCallerBlocked) {
                                alert(`Cảnh báo: Vận động viên "${m.name}" đang được gọi ghi điểm bởi trọng tài khác (${otherRefereeEmail})!`);
                                return;
                              }
                              if (isSelectionBlocked) {
                                alert(`Cảnh báo: Vận động viên "${m.name}" đã hoàn thành đầy đủ tất cả các cự ly trong bảng Ghi Điểm! Không thể chọn thêm.`);
                                return;
                              }
                              setSelectedInputBoardAthleteIds((prev) => 
                                prev.includes(m.id) 
                                  ? prev.filter((id) => id !== m.id) 
                                  : [...prev, m.id]
                              );
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isSelectionBlocked}
                                onChange={() => {}} // Handled by row click, no-op to avoid react warnings
                                className={`rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 ${
                                  isSelectionBlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                }`}
                              />
                              <span className="text-[10px] uppercase font-bold font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                                ID: {m.id}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap font-sans">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{m.name}</span>
                                  {isCallerBlocked ? (
                                    <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 uppercase whitespace-nowrap shrink-0 animate-pulse">
                                      🔒 Đang được gọi bởi: {otherRefereeEmail}
                                    </span>
                                  ) : (
                                    <>
                                      {isAlreadyInScoring && (
                                        isMissingSomeDistances ? (
                                          <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 uppercase whitespace-nowrap shrink-0">
                                            Đã có điểm (Chưa đủ cự ly)
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 uppercase whitespace-nowrap shrink-0">
                                            Đã đủ tất cả cự ly
                                          </span>
                                        )
                                      )}
                                      {m.status === "Bỏ thi" && (
                                        <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 uppercase whitespace-nowrap shrink-0 animate-pulse">
                                          Bỏ thi
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-500 font-normal block truncate w-full">
                                  {m.team || "Tự do"} • {m.gender || "Nam"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 w-full sm:w-auto sm:shrink-0 justify-end mt-1.5 sm:mt-0">
                              {isAlreadyInScoring && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingScrollAthleteId(m.id);
                                    setActiveTab("scoring");
                                    setIsAddingAthleteToInputBoard(false);
                                    setSelectedInputBoardAthleteIds([]);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-700 text-white border border-emerald-700 hover:scale-[1.02] text-[11px] font-black px-3.5 py-2 rounded-xl transition-all duration-150 whitespace-nowrap flex items-center gap-1 text-center justify-center font-sans uppercase tracking-wider shadow-md active:scale-95 cursor-pointer max-sm:flex-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Xem
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isCallerBlocked}
                                onClick={(e) => {
                                  e.stopPropagation(); // prevent row click toggle
                                  if (isCallerBlocked) {
                                    alert(`Vận động viên này đang được gọi ghi điểm bởi trọng tài khác (${otherRefereeEmail})!`);
                                    return;
                                  }
                                  // Deep clone scores if they already have some in Ghi Điểm
                                  const freshScores: Record<string, (boolean | null)[]> = {};
                                  currentDistances.forEach((d) => {
                                    if (scoringAthlete && scoringAthlete.scores[d.id]) {
                                      freshScores[d.id] = [...scoringAthlete.scores[d.id]];
                                    } else {
                                      freshScores[d.id] = Array(currentShotsCount).fill(null);
                                    }
                                  });

                                  const addedPlayer: Athlete = {
                                    ...m,
                                    scores: freshScores,
                                    soloHits: scoringAthlete ? JSON.parse(JSON.stringify(scoringAthlete.soloHits || {})) : {},
                                    calledBy: currentUser?.email || "anonymous",
                                  };
                                  if (competitionMode === "individual") {
                                    setInputAthletes((prev) => [...prev, addedPlayer]);
                                  } else {
                                    setTeamInputAthletes((prev) => [...prev, addedPlayer]);
                                  }
                                  // Remove from selected if added
                                  setSelectedInputBoardAthleteIds((prev) => prev.filter((id) => id !== m.id));
                                  // Auto close selection panel and mark unsaved changes
                                  setIsAddingAthleteToInputBoard(false);
                                  setInputBoardAddSearch("");
                                  setHasUnsavedChanges(true);
                                }}
                                className={`text-[11px] font-black px-3.5 py-2 rounded-xl transition-all duration-150 whitespace-nowrap flex items-center gap-1 border text-center justify-center font-sans uppercase tracking-wider shadow-md active:scale-95 cursor-pointer max-sm:flex-1 ${
                                  isCallerBlocked
                                    ? "bg-slate-300 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-800 cursor-not-allowed opacity-[0.6] shadow-none scale-100"
                                    : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border border-indigo-700 hover:scale-[1.02]"
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" /> Thêm
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Multi addition master action button */}
                  {selectedInputBoardAthleteIds.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          const toAdd = masterAthletes.filter((m) => selectedInputBoardAthleteIds.includes(m.id));
                          
                          const activeListInDoc = competitionMode === "individual"
                            ? (currentTournamentDoc?.inputAthletes || [])
                            : (currentTournamentDoc?.teamInputAthletes || []);

                          const validToAdd: typeof masterAthletes = [];
                          const skippedNames: string[] = [];

                          toAdd.forEach((m) => {
                            const documentActivePlayer = activeListInDoc.find((a) => a.id === m.id);
                            const otherRefereeEmail = documentActivePlayer?.calledBy && 
                              documentActivePlayer.calledBy.toLowerCase().trim() !== (currentUser?.email || "anonymous").toLowerCase().trim()
                              ? documentActivePlayer.calledBy
                              : null;
                            if (otherRefereeEmail) {
                              skippedNames.push(`${m.name} (bởi ${otherRefereeEmail})`);
                            } else {
                              validToAdd.push(m);
                            }
                          });

                          if (skippedNames.length > 0) {
                            alert(`Bỏ qua các vận động viên sau do đang được nhập điểm bởi trọng tài khác:\n- ${skippedNames.join("\n- ")}`);
                          }

                          if (validToAdd.length === 0) {
                            setSelectedInputBoardAthleteIds([]);
                            setIsAddingAthleteToInputBoard(false);
                            setInputBoardAddSearch("");
                            return;
                          }

                          const newAthletes: Athlete[] = validToAdd.map((m) => {
                            const scoringAthlete = currentAthletes.find((a) => a.id === m.id);
                            const freshScores: Record<string, (boolean | null)[]> = {};
                            currentDistances.forEach((d) => {
                              if (scoringAthlete && scoringAthlete.scores[d.id]) {
                                freshScores[d.id] = [...scoringAthlete.scores[d.id]];
                              } else {
                                freshScores[d.id] = Array(currentShotsCount).fill(null);
                              }
                            });
                            return {
                              ...m,
                              scores: freshScores,
                              soloHits: scoringAthlete ? JSON.parse(JSON.stringify(scoringAthlete.soloHits || {})) : {},
                              calledBy: currentUser?.email || "anonymous",
                            };
                          });
                          if (competitionMode === "individual") {
                            setInputAthletes((prev) => [...prev, ...newAthletes]);
                          } else {
                            setTeamInputAthletes((prev) => [...prev, ...newAthletes]);
                          }
                          setHasUnsavedChanges(true);
                          setSelectedInputBoardAthleteIds([]);
                          setIsAddingAthleteToInputBoard(false);
                          setInputBoardAddSearch("");
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold py-2 px-4 rounded-xl transition-all duration-150 shadow-md flex items-center justify-center gap-1 active:scale-[0.99]"
                      >
                        Thêm {selectedInputBoardAthleteIds.length} VĐV đã chọn vào bảng nhập điểm
                      </button>
                    </div>
                  )}

                  <div className="mt-3 text-[10.5px] text-slate-400 text-center">
                    Ý kiến: Nếu chưa đăng ký VĐV này, hãy chuyển qua tab{" "}
                    <button
                      onClick={() => {
                        setActiveTab("settings");
                        setSettingsSubTab("athletes");
                        setIsAddingAthleteToInputBoard(false);
                        setSelectedInputBoardAthleteIds([]);
                      }}
                      className="font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Quản Lý VĐV
                    </button>{" "}
                    để đăng ký hồ sơ vĩnh viễn trước.
                  </div>
                </div>
              )}

              {/* The action buttons panel - PLUS & SAVE SIDE BY SIDE */}
              <div className="flex justify-center items-center gap-4 py-6">
                <button
                  onClick={() => setIsAddingAthleteToInputBoard(true)}
                  className="w-14 h-14 bg-white dark:bg-slate-900 hover:bg-indigo-50 border-2 border-indigo-500 text-indigo-500 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-150 cursor-pointer animate-pulse"
                  title="Thêm vận động viên vào bảng Nhập Điểm"
                  id="add-athlete-to-input-board-btn"
                >
                  <Plus className="w-8 h-8 stroke-[3]" />
                </button>

                {currentInputAthletes.length > 0 && (
                  <button
                    onClick={handleSaveInputScoresToMain}
                    className="h-14 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-150 cursor-pointer border border-emerald-700 text-sm uppercase tracking-wider"
                    title="Lưu điểm và tự động chuyển sang bảng Ghi Điểm"
                    id="save-input-scores-btn"
                  >
                    <Save className="w-5 h-5 stroke-[2.5]" /> Lưu Điểm ({currentInputAthletes.length})
                  </button>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: LIVE TOURNAMENT RANKING LEADERBOARD (COMBINED RANKING TAB) */}
          {activeTab === "leaderboard" && (
            <div className="flex flex-col gap-5 animate-fadeIn" id="ranking-tab-container">
              {/* Sub-tabs to toggle between Individual and Team/Club rankings */}
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-2 self-start" id="ranking-sub-tabs">
                <button
                  type="button"
                  onClick={() => setRankingSubTab("individual")}
                  className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                    rankingSubTab === "individual"
                      ? "bg-blue-600 text-white shadow-md font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  id="ranking-subtab-ind-btn"
                >
                  <Trophy className="w-4 h-4" />
                  {competitionMode === "team" ? (
                    language === "en" ? "Individual Standings TEAM" : "Bảng Xếp Hạng Cá Nhân TEAM"
                  ) : (
                    language === "en" ? "Individual Standings" : "Bảng Xếp Hạng Cá Nhân"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRankingSubTab("team")}
                  className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                    rankingSubTab === "team"
                      ? "bg-blue-600 text-white shadow-md font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  id="ranking-subtab-team-btn"
                >
                  <Users className="w-4 h-4" />
                  {competitionMode === "team" ? (
                    language === "en" ? "Club/Team Standings TEAM" : "Bảng Xếp Hạng Đồng Đội TEAM"
                  ) : (
                    language === "en" ? "Club/Team Standings" : "Bảng Xếp Hạng Đồng Đội"
                  )}
                </button>
              </div>

              {rankingSubTab === "individual" ? (
                <Leaderboard 
                  athletes={competitionMode === "individual" ? leaderboardAthletes : leaderboardTeamAthletes} 
                  distances={currentDistances} 
                  shotsCount={currentShotsCount} 
                  competitionMode={competitionMode}
                  directMaxShots={directMaxShots}
                  teamDirectMaxShots={teamDirectMaxShots}
                  directMaxPoints={directMaxPoints}
                  teamDirectMaxPoints={teamDirectMaxPoints}
                />
              ) : (
                <TeamLeaderboard
                  athletes={competitionMode === "individual" ? leaderboardAthletes : leaderboardTeamAthletes}
                  distances={currentDistances}
                  shotsCount={currentShotsCount}
                  competitionMode={competitionMode}
                  directMaxShots={directMaxShots}
                  teamDirectMaxShots={teamDirectMaxShots}
                  directMaxPoints={directMaxPoints}
                  teamDirectMaxPoints={teamDirectMaxPoints}
                />
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS CONFIGURATION MATRIX (CONTAINS ATHLETE MANAGEMENT SUBTAB) */}
          {activeTab === "settings" && (
            <div className="flex flex-col gap-6 animate-fadeIn" id="settings-tab-container">
              {/* Sub-tabs navigation bar inside Settings */}
              <div className="flex border-b border-gray-250 dark:border-slate-800 gap-4" id="settings-sub-tabs">
                <button
                  type="button"
                  onClick={() => setSettingsSubTab("config")}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    settingsSubTab === "config"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                  id="subtab-config-btn"
                >
                  <Settings className="w-4 h-4" />
                  {language === "en" ? "Tournament Parameters" : "Cấu Hình Tham Số Giải"}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab("athletes")}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    settingsSubTab === "athletes"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                  id="subtab-athletes-btn"
                >
                  <Users className="w-4 h-4" />
                  {language === "en" ? "Manage Athletes & Clubs" : "Quản Lý VĐV & Câu Lạc Bộ"}
                </button>
              </div>

              {settingsSubTab === "config" ? (
                <SettingsPanel
                  matchName={matchName}
                  setMatchName={setMatchName}
                  bannerUrl={bannerUrl}
                  setBannerUrl={setBannerUrl}
                  avatarUrl={avatarUrl}
                  setAvatarUrl={setAvatarUrl}
                  distances={distances}
                  setDistances={setDistances}
                  shotsCount={shotsCount}
                  setShotsCount={setShotsCount}
                  athletes={athletes}
                  setAthletes={setAthletes}
                  masterAthletes={masterAthletes}
                  setMasterAthletes={setMasterAthletes}
                  history={history}
                  setHistory={setHistory}
                  onSaveCurrentSessionToHistory={handleSaveCurrentSessionToHistory}
                  onResetSession={handleResetSession}
                  onImportBackup={handleImportSingleBackup}
                  storedAthleteLists={storedAthleteLists}
                  setStoredAthleteLists={setStoredAthleteLists}
                  activeHistoryId={activeHistoryId}
                  setActiveHistoryId={setActiveHistoryId}
                  setInputAthletes={setInputAthletes}
                  setTeamInputAthletes={setTeamInputAthletes}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  setClubs={setClubs}
                  
                  // Team modes
                  teamDistances={teamDistances}
                  setTeamDistances={setTeamDistances}
                  teamShotsCount={teamShotsCount}
                  setTeamShotsCount={setTeamShotsCount}
                  teamAthletes={teamAthletes}
                  setTeamAthletes={setTeamAthletes}
                  directMaxShots={directMaxShots}
                  setDirectMaxShots={setDirectMaxShots}
                  teamDirectMaxShots={teamDirectMaxShots}
                  setTeamDirectMaxShots={setTeamDirectMaxShots}
                  directMaxPoints={directMaxPoints}
                  setDirectMaxPoints={setDirectMaxPoints}
                  teamDirectMaxPoints={teamDirectMaxPoints}
                  setTeamDirectMaxPoints={setTeamDirectMaxPoints}
                  referees={currentTournamentDoc?.referees || []}
                  onUpdateReferees={(rList) => {
                    if (activeHistoryId && activeHistoryId.startsWith("tour-")) {
                      updateOnlineTournament(activeHistoryId, { referees: rList })
                        .catch(err => console.error("Cloud referee update failed:", err));
                    }
                  }}
                  subAdmins={currentTournamentDoc?.subAdmins || []}
                  onUpdateSubAdmins={(subList) => {
                    if (activeHistoryId && activeHistoryId.startsWith("tour-")) {
                      updateOnlineTournament(activeHistoryId, { subAdmins: subList })
                        .catch(err => console.error("Cloud subAdmin update failed:", err));
                    }
                  }}
                  isNewTournamentModalOpen={isNewTournamentModalOpen}
                  setIsNewTournamentModalOpen={setIsNewTournamentModalOpen}
                  tournamentType={tournamentType}
                  setTournamentType={setTournamentType}
                  laneCapacity={laneCapacity}
                  setLaneCapacity={setLaneCapacity}
                  setActiveTab={setActiveTab}
                  onExitTournament={() => handleExitTournament()}
                  userRole={userRole}
                />
              ) : (
                <AthleteManagement
                  athletes={masterAthletes}
                  setAthletes={setMasterAthletes}
                  distances={currentDistances}
                  shotsCount={currentShotsCount}
                  storedAthleteLists={storedAthleteLists}
                  setStoredAthleteLists={setStoredAthleteLists}
                  currentActiveAthletes={currentAthletes}
                  setCurrentActiveAthletes={competitionMode === "individual" ? setAthletes : setTeamAthletes}
                  matchName={matchName}
                  clubs={clubs}
                  setClubs={setClubs}
                  currentUser={currentUser}
                  forceTab={athleteForceTab}
                  userRole={userRole}
                />
              )}
            </div>
          )}

          {/* TAB 4: SAVED HISTORY SNAPSHOTS RECORD */}
          {activeTab === "history" && (
            <HistoryPanel
              history={history}
              onRestoreHistoryItem={handleRestoreHistoryItem}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              currentMasterCount={masterAthletes.length}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportFullBackup}
              userRole={userRole}
              onRestoreDeviceBackup={handleRestoreDeviceBackup}
              onDeleteDeviceBackup={handleDeleteDeviceBackup}
              matchName={matchName}
              onSaveCurrentSessionToHistory={handleSaveCurrentSessionToHistory}
              startDate={startDate}
              endDate={endDate}
              onUpdateHistory={setHistory}
            />
          )}

          {/* TAB 5: MY CONTROL PANEL */}
          {activeTab === "control_panel" && (
            <ControlPanel
              activeHistoryId={activeHistoryId}
              onSelectTournament={(id, tournament) => handleSelectTournament(id, tournament, "dashboard")}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              forceSubTab={controlPanelSubTab}
            />
          )}

          {/* TAB 6: QLTV MEMBER MANAGEMENT PANEL */}
          {activeTab === "qltv" && isGlobalAdmin && (
            <MemberManagementPanel
              currentUser={currentUser}
              language={language}
            />
          )}

        </div>

      </main>

      {/* Sportive Footer */}
      <footer className="mt-20 border-t border-gray-200 dark:border-slate-800 pt-8 pb-12 text-gray-400 max-w-7xl mx-auto px-4" id="app-footer">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 text-left border-b border-gray-100 dark:border-slate-900 pb-8">
          
          {/* Social connections */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Kênh Truyền Thông & Nhóm Đăng Ký
            </h4>
            <div className="flex flex-wrap gap-3">
              <a 
                href="https://youtube.com/@vsc.vietnamslingshot?sub_confirmation=1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all border border-red-105 dark:border-red-900/30"
              >
                <Youtube className="w-4 h-4 fill-current" />
                <span>vsc.vietnamslingshot</span>
              </a>

              <a 
                href="https://www.facebook.com/groups/vietnamslingshotchampionship" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all border border-blue-105 dark:border-blue-900/30"
              >
                <Facebook className="w-4 h-4 fill-current" />
                <span>Vietnam Slingshot Championship</span>
              </a>

              <a 
                href="http://tiktok.com/@vsc.vietnamslingshot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all border border-slate-200 dark:border-slate-800"
              >
                <svg className="w-4 h-4 text-current shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                </svg>
                <span>@vsc.vietnamslingshot</span>
              </a>
            </div>
          </div>

          {/* Sponsors & Clubs */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Đơn Vị Đồng Hành & Câu Lạc Bộ Tài Trợ
            </h4>
            <div className="flex flex-wrap gap-2.5">
              <span className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm">
                🏆 36 Slingshot Club
              </span>
              <span className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm">
                🎯 CLB ná cao su thể thao TNU Thái Nguyên
              </span>
            </div>
          </div>

        </div>

        <div className="text-center">
          <p className="font-semibold text-gray-600 dark:text-gray-400 text-xs">
            Hệ thống tính điểm mục tiêu bộ môn thể thao Ná Cao Su &copy; {new Date().getFullYear()} bởi #HiepNAT
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Dữ liệu được lưu trữ tự động vào trình lưu trữ cục bộ của bạn (LocalStorage). Bạn có thể sao lưu thủ công bất cứ lúc nào qua tab &quot;Cấu Hình&quot;.
          </p>
        </div>
      </footer>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        matchName={matchName}
        athletes={competitionMode === "individual" ? leaderboardAthletes : leaderboardTeamAthletes}
        distances={currentDistances}
        shotsCount={currentShotsCount}
        directMaxShots={directMaxShots}
        teamDirectMaxShots={teamDirectMaxShots}
        competitionMode={competitionMode}
        directMaxPoints={directMaxPoints}
        teamDirectMaxPoints={teamDirectMaxPoints}
        activeTab={activeTab}
        indAthletes={leaderboardAthletes}
        indDistances={distances}
        indShotsCount={shotsCount}
        teamAthletes={leaderboardTeamAthletes}
        teamDistances={teamDistances}
        teamShotsCount={teamShotsCount}
      />

      <LiveBoard
        isOpen={isLiveBoardOpen}
        onClose={() => setIsLiveBoardOpen(false)}
        matchName={matchName}
        athletes={leaderboardAthletes}
        distances={distances}
        shotsCount={shotsCount}
        teamAthletes={teamAthletes}
        teamDistances={teamDistances}
        teamShotsCount={teamShotsCount}
        leaderboardTeamAthletes={leaderboardTeamAthletes}
        directMaxShots={directMaxShots}
        teamDirectMaxShots={teamDirectMaxShots}
        directMaxPoints={directMaxPoints}
        teamDirectMaxPoints={teamDirectMaxPoints}
        tournamentType={tournamentType}
        clubs={clubs}
        laneCapacity={laneCapacity}
      />

      {showUnlockScoreModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-200 uppercase tracking-wide">
                    {pendingAddAthlete ? "Mở khóa để thêm VĐV?" : "Xác nhận ghi / sửa điểm?"}
                  </h3>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Lớp bảo vệ tránh bấm nhầm</p>
                </div>
              </div>
              
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 space-y-2">
                {pendingAddAthlete ? (
                  <p>
                    Hệ thống đang ở Chế độ Xem để bảo vệ dữ liệu. Để <strong>thêm vận động viên mới hoặc đăng ký thi đấu</strong>, vui lòng xác nhận mở khóa Chế độ Ghi Điểm.
                  </p>
                ) : (
                  <p>
                    Hệ thống phát hiện Thầy/Cô vừa chạm vào ô ghi điểm của vận động viên. Để tránh việc <strong>vô tình chạm làm sai lệch tỉ số</strong>, vui lòng xác nhận ghi điểm.
                  </p>
                )}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] flex flex-col gap-1.5 border border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" /> Cách hoạt động:
                  </span>
                  <span className="text-gray-500 font-medium">• <strong>Xác nhận xong</strong>: Chế độ Ghi Điểm sẽ được mở khóa, Thầy/Cô có thể tự do ghi điểm, thêm hoặc sửa VĐV mà không gặp lại bảng này.</span>
                  <span className="text-gray-500 font-medium">• <strong>Khóa lại</strong>: Thầy/Cô có thể chủ động bấm Khóa ở đầu trang Ghi Điểm bất kỳ lúc nào để quay lại chế độ bảo vệ.</span>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPendingScoreToggle(null);
                    setPendingAddAthlete(false);
                    setShowUnlockScoreModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-slate-750 dark:text-slate-300 transition-all cursor-pointer"
                >
                  Hủy (Giữ Chế độ Xem)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsScoringEditAuthorized(true);
                    if (pendingScoreToggle) {
                      const { athleteId, distanceId, shotIndex } = pendingScoreToggle;
                      executeToggleScore(athleteId, distanceId, shotIndex);
                      setPendingScoreToggle(null);
                    }
                    if (pendingAddAthlete) {
                      setIsAddingAthleteToTournament(true);
                      setPendingAddAthlete(false);
                    }
                    setShowUnlockScoreModal(false);
                  }}
                  className="px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  Xác nhận mở khóa
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

       {/* Exit Tournament Custom Path Choice Dialog */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10006] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase flex items-center gap-2">
              ⚠️ Xác nhận Thoát Giải Đấu
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-semibold">
              Thầy cô muốn thoát giải đấu hiện tại để làm gì? Vui lòng chọn một hành động điều hướng nhanh bên dưới:
            </p>
            
            <div className="flex flex-col gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  handleExitTournament();
                  setActiveTab("settings");
                  setIsNewTournamentModalOpen(true);
                }}
                className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Tạo giải đấu mới (Cài đặt)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  handleExitTournament();
                }}
                className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Home className="w-4 h-4 shrink-0" />
                Thoát & Quay về Trang Chủ
              </button>

              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-500 rounded-xl text-xs font-bold transition-all text-center mt-1 cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit and Create Tournament Custom Dialog */}
      {showExitAndCreateConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10006] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase flex items-center gap-2">
              ⚠️ Xác nhận Thoát để Tạo Giải Mới
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-semibold">
              Thầy cô có chắc chắn muốn thoát khỏi giải đấu hiện tại để tiến hành tạo một giải đấu trực tuyến mới không?
            </p>
            
            <div className="flex flex-col gap-2.5 mt-5 font-sans">
              <button
                type="button"
                onClick={() => {
                  setShowExitAndCreateConfirmModal(false);
                  handleExitTournament();
                  setActiveTab("settings");
                  setIsNewTournamentModalOpen(true);
                }}
                className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Xác nhận thoát & Tạo giải mới
              </button>

              <button
                type="button"
                onClick={() => setShowExitAndCreateConfirmModal(false)}
                className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-500 rounded-xl text-xs font-bold transition-all text-center mt-1 cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud User authentication drawer modal */}
      {switchingTournamentData && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10006] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl relative text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase flex items-center gap-2">
              ⚠️ Xác nhận Chuyển Giải
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed font-semibold">
              Thầy cô đang tham gia giải đấu <strong className="text-indigo-650 dark:text-indigo-400">"{matchName || "Giải đấu hiện tại"}"</strong>. Thầy cô có chắc chắn muốn thoát giải đấu này để chuyển sang giải đấu <strong className="text-emerald-605 dark:text-emerald-400">"{switchingTournamentData.tournamentName}"</strong> không?
            </p>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSwitchingTournamentData(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-center"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={confirmTournamentSwitch}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-md text-center"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {draftPreviewItem && (
        <PublishDraftModal
          isOpen={isPublishDraftModalOpen}
          onClose={() => setIsPublishDraftModalOpen(false)}
          draftPreviewItem={draftPreviewItem}
          onlineTournaments={onlineTournaments}
          onOverwrite={handleOverwriteOnlinePublish}
          onCreateNew={handleCreateNewOnlinePublish}
        />
      )}

      {/* 1. LƯU ĐIỂM Confirmation Modal */}
      {isSaveConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10007] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative text-left">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400">
                <Save className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-slate-50 uppercase tracking-tight">
                  Xác nhận Lưu Điểm Số
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Thao tác cập nhật bảng ghi điểm chính thức
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold mb-4">
              Hệ thống sẽ đồng bộ toàn bộ điểm số từ bảng <span className="text-indigo-600 dark:text-indigo-400 font-bold">Nhập Điểm</span> sang bảng <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ghi Điểm</span> chính thức của giải đấu. Thầy cô vui lòng kiểm tra kỹ lưỡng các thông tin điểm số trước khi xác nhận.
            </p>

            {/* Network connectivity feedback inside save modal */}
            <div className="mb-4 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Trạng thái kết nối:
              </span>
              {networkStatus === "offline" ? (
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" />
                  Mất mạng (Lưu máy)
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" />
                  Trực tuyến (Đồng bộ mây)
                </span>
              )}
            </div>

            {/* Save operations status banner */}
            {saveStatus && (
              <div className={`p-3.5 rounded-2xl text-xs font-semibold mb-4 leading-relaxed border ${
                saveStatus.success 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" 
                  : "bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50"
              }`}>
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 shrink-0">
                    {saveStatus.success ? (
                      <span className="text-emerald-500 font-bold">✔</span>
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <span>{saveStatus.message}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSavingScores}
                onClick={() => {
                  setIsSaveConfirmModalOpen(false);
                  setSaveStatus(null);
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-center disabled:opacity-50"
              >
                Hủy kiểm tra lại
              </button>

              <button
                type="button"
                disabled={isSavingScores}
                onClick={executeSaveScores}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-md text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingScores ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    Đồng ý Lưu Điểm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHƯA LƯU ĐIỂM Warning Modal (Guard Tab Navigation) */}
      {isUnsavedModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10007] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative text-left">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-2xl border border-amber-100 dark:border-amber-800/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-slate-50 uppercase tracking-tight">
                  Cảnh Báo: Điểm Chưa Lưu!
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Thầy cô đang có điểm chấm dở chưa lưu
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold mb-6">
              Thao tác chuyển trang sẽ làm <span className="text-amber-600 dark:text-amber-400 font-bold">MẤT HOÀN TOÀN</span> các thông tin điểm số thầy cô đang chấm dở trong bảng Nhập Điểm. Thầy cô có muốn lưu điểm số ngay hay hủy bỏ các thay đổi này để tiếp tục?
            </p>

            {/* Network connectivity feedback inside warning modal */}
            <div className="mb-4 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Trạng thái kết nối:
              </span>
              {networkStatus === "offline" ? (
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" />
                  Mất mạng (Lưu máy)
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" />
                  Trực tuyến (Đồng bộ mây)
                </span>
              )}
            </div>

            {/* Save operations status banner inside warning modal */}
            {saveStatus && (
              <div className={`p-3.5 rounded-2xl text-xs font-semibold mb-4 leading-relaxed border ${
                saveStatus.success 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" 
                  : "bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50"
              }`}>
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 shrink-0">
                    {saveStatus.success ? (
                      <span className="text-emerald-500 font-bold">✔</span>
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <span>{saveStatus.message}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 font-sans">
              <button
                type="button"
                disabled={isSavingScores}
                onClick={executeSaveScores}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-md text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingScores ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    Đồng ý Lưu Điểm & Tiếp Tục
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSavingScores}
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setIsUnsavedModalOpen(false);
                  setSaveStatus(null);
                  if (pendingTabTarget) {
                    if (pendingTabTarget.type === "tab") {
                      setActiveTab(pendingTabTarget.value);
                    } else if (pendingTabTarget.type === "exit") {
                      handleExitTournament(pendingTabTarget.value as any);
                    }
                    setPendingTabTarget(null);
                  }
                }}
                className="w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-rose-100 dark:border-rose-900/40 text-center disabled:opacity-50"
              >
                Bỏ qua thay đổi (Xóa tạm) & Tiếp tục
              </button>

              <button
                type="button"
                disabled={isSavingScores}
                onClick={() => {
                  setIsUnsavedModalOpen(false);
                  setPendingTabTarget(null);
                  setSaveStatus(null);
                }}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-center disabled:opacity-50"
              >
                Quay lại bảng chấm điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gradient-to-b from-[#b80e16] to-[#8c0a10] border-t border-red-500/25 shadow-2xl h-16 pb-safe flex items-stretch">
        {(() => {
          const isSettingsActive = activeTab === "settings";
          const isActiveActive = activeTab === "dashboard" || (activeTab === "home" && homeFilter === "active");
          const isHomeActive = activeTab === "home" && (homeFilter === "all" || homeFilter === "all_list");
          const isFollowedActive = activeTab === "home" && homeFilter === "followed";
          const isProfileActive = activeTab === "control_panel" && controlPanelSubTab === "profile";

          return (
            <div className="grid grid-cols-5 w-full h-full items-center text-center relative px-2">
              
              {/* Button 1: TẠO GIẢI ĐẤU MỚI */}
              <button
                onClick={() => {
                  if (activeHistoryId) {
                    handleExitTournament();
                  }
                  setActiveTab("settings");
                  setSettingsSubTab("config");
                  setIsNewTournamentModalOpen(true);
                }}
                className="flex flex-col items-center justify-center h-full relative cursor-pointer select-none"
              >
                <div className={`transition-all duration-300 flex flex-col items-center ${isSettingsActive ? "-translate-y-3.5" : "translate-y-0"}`}>
                  <div className={`transition-all duration-300 flex items-center justify-center ${
                    isSettingsActive 
                      ? "w-12 h-12 bg-gradient-to-b from-[#d8141c] to-[#9c0c13] rounded-full border-4 border-white dark:border-slate-950 shadow-lg" 
                      : "w-9 h-9 bg-transparent"
                  }`}>
                    <Plus className={`w-5 h-5 transition-all duration-300 ${isSettingsActive ? "text-white scale-110" : "text-white/70"}`} />
                  </div>
                  <span className={`text-[8px] transition-all duration-300 tracking-tight ${
                    isSettingsActive 
                      ? "font-black text-yellow-400 mt-0.5 uppercase tracking-wider" 
                      : "font-bold text-white/70 mt-1"
                  }`}>
                    Tạo giải
                  </span>
                </div>
              </button>

              {/* Button 2: GIẢI ĐANG DIỄN RA */}
              <button
                onClick={() => {
                  if (activeHistoryId) {
                    changeTab("dashboard");
                  } else {
                    changeExitTournament("active");
                  }
                }}
                className="flex flex-col items-center justify-center h-full relative cursor-pointer select-none"
              >
                <div className={`transition-all duration-300 flex flex-col items-center ${isActiveActive ? "-translate-y-3.5" : "translate-y-0"}`}>
                  <div className={`transition-all duration-300 flex items-center justify-center ${
                    isActiveActive 
                      ? "w-12 h-12 bg-gradient-to-b from-[#d8141c] to-[#9c0c13] rounded-full border-4 border-white dark:border-slate-950 shadow-lg" 
                      : "w-9 h-9 bg-transparent"
                  }`}>
                    <Shield className={`w-5 h-5 transition-all duration-300 ${isActiveActive ? "text-white scale-110" : "text-white/70"}`} />
                  </div>
                  <span className={`text-[8px] transition-all duration-300 tracking-tight ${
                    isActiveActive 
                      ? "font-black text-yellow-400 mt-0.5 uppercase tracking-wider" 
                      : "font-bold text-white/70 mt-1"
                  }`}>
                    Đang đấu
                  </span>
                </div>
              </button>

              {/* Button 3: TRANG CHỦ */}
              <button
                onClick={() => changeExitTournament("all")}
                className="flex flex-col items-center justify-center h-full relative cursor-pointer select-none"
              >
                <div className={`transition-all duration-300 flex flex-col items-center ${isHomeActive ? "-translate-y-3.5" : "translate-y-0"}`}>
                  <div className={`transition-all duration-300 flex items-center justify-center ${
                    isHomeActive 
                      ? "w-12 h-12 bg-gradient-to-b from-[#d8141c] to-[#9c0c13] rounded-full border-4 border-white dark:border-slate-950 shadow-lg" 
                      : "w-9 h-9 bg-transparent"
                  }`}>
                    <Home className={`w-5 h-5 transition-all duration-300 ${isHomeActive ? "text-white scale-110" : "text-white/70"}`} />
                  </div>
                  <span className={`text-[8px] transition-all duration-300 tracking-tight ${
                    isHomeActive 
                      ? "font-black text-yellow-400 mt-0.5 uppercase tracking-wider" 
                      : "font-bold text-white/70 mt-1"
                  }`}>
                    Home
                  </span>
                </div>
              </button>

              {/* Button 4: GIẢI ĐANG THEO DÕI */}
              <button
                onClick={() => changeExitTournament("followed")}
                className="flex flex-col items-center justify-center h-full relative cursor-pointer select-none"
              >
                <div className={`transition-all duration-300 flex flex-col items-center ${isFollowedActive ? "-translate-y-3.5" : "translate-y-0"}`}>
                  <div className={`transition-all duration-300 flex items-center justify-center ${
                    isFollowedActive 
                      ? "w-12 h-12 bg-gradient-to-b from-[#d8141c] to-[#9c0c13] rounded-full border-4 border-white dark:border-slate-950 shadow-lg" 
                      : "w-9 h-9 bg-transparent"
                  }`}>
                    <Heart className={`w-5 h-5 transition-all duration-300 ${isFollowedActive ? "text-white scale-110 fill-white" : "text-white/70 fill-none"}`} />
                  </div>
                  <span className={`text-[8px] transition-all duration-300 tracking-tight ${
                    isFollowedActive 
                      ? "font-black text-yellow-400 mt-0.5 uppercase tracking-wider" 
                      : "font-bold text-white/70 mt-1"
                  }`}>
                    Theo dõi
                  </span>
                </div>
              </button>

              {/* Button 5: HỒ SƠ VĐV CỦA TÔI */}
              <button
                onClick={() => {
                  if (currentUser) {
                    setActiveTab("control_panel");
                    setControlPanelSubTab("profile");
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="flex flex-col items-center justify-center h-full relative cursor-pointer select-none"
              >
                <div className={`transition-all duration-300 flex flex-col items-center ${isProfileActive ? "-translate-y-3.5" : "translate-y-0"}`}>
                  <div className={`transition-all duration-300 flex items-center justify-center ${
                    isProfileActive 
                      ? "w-12 h-12 bg-gradient-to-b from-[#d8141c] to-[#9c0c13] rounded-full border-4 border-white dark:border-slate-950 shadow-lg" 
                      : "w-9 h-9 bg-transparent"
                  }`}>
                    <User className={`w-5 h-5 transition-all duration-300 ${isProfileActive ? "text-white scale-110" : "text-white/70"}`} />
                  </div>
                  <span className={`text-[8px] transition-all duration-300 tracking-tight ${
                    isProfileActive 
                      ? "font-black text-yellow-400 mt-0.5 uppercase tracking-wider" 
                      : "font-bold text-white/70 mt-1"
                  }`}>
                    Hồ sơ
                  </span>
                </div>
              </button>

            </div>
          );
        })()}
      </div>

    </div>
  );
}
