import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, 
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
import { DistanceConfig, Athlete, MatchHistoryItem, StoredAthleteList, Club } from "./types";
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
import { subscribeToTournamentDoc, updateOnlineTournament, TournamentData, subscribeToTournamentsList, createOnlineTournament } from "./lib/firebaseService";
import { AuthModal } from "./components/AuthModal";
import { OnlineTournamentsPanel } from "./components/OnlineTournamentsPanel";
import { ControlPanel } from "./components/ControlPanel";
import { Home, LogOut, Sliders, SlidersHorizontal } from "lucide-react";
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
      ]);

      if (avatars) {
        try {
          localStorage.setItem("slingshot_avatars", JSON.stringify(avatars));
        } catch (e) {
          console.warn("localStorage avatars sync error:", e);
        }
      }

      if (matchNameVal) {
        setMatchName(matchNameVal);
        setHeaderTempName(matchNameVal);
      }
      if (startDateVal) setStartDate(startDateVal);
      if (endDateVal) setEndDate(endDateVal);
      if (distancesVal) setDistances(distancesVal);
      if (shotsCountVal) setShotsCount(Number(shotsCountVal));
      if (athletesVal) setAthletes(restoreBase64Avatars(athletesVal));
      if (masterAthletesVal) setMasterAthletes(restoreBase64Avatars(masterAthletesVal));
      if (historyVal) {
        const parsedHistory = restoreBase64Avatars(historyVal);
        setHistory((parsedHistory || []).filter((h: any) => h && h.matchName && h.matchName.trim()));
      }
      if (storedAthleteListsVal) {
        const parsedLists = restoreBase64Avatars(storedAthleteListsVal);
        setStoredAthleteLists((parsedLists || []).filter((l: any) => l && l.name && l.name.trim()));
      }
      if (activeHistoryIdVal) setActiveHistoryId(activeHistoryIdVal);
      if (inputAthletesVal) setInputAthletes(restoreBase64Avatars(inputAthletesVal));
      if (clubsVal) setClubs(clubsVal);
      
      if (competitionModeVal) setCompetitionMode(competitionModeVal as "individual" | "team");
      if (teamDistancesVal) setTeamDistances(teamDistancesVal);
      if (teamShotsCountVal) setTeamShotsCount(Number(teamShotsCountVal));
      if (teamAthletesVal) setTeamAthletes(restoreBase64Avatars(teamAthletesVal));
      if (teamInputAthletesVal) setTeamInputAthletes(restoreBase64Avatars(teamInputAthletesVal));

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
    return (parsed || []).filter((h: any) => h && h.matchName && h.matchName.trim());
  });

  const [storedAthleteLists, setStoredAthleteLists] = useState<StoredAthleteList[]>(() => {
    const saved = localStorage.getItem("slingshot_stored_athlete_lists");
    const parsed = saved ? restoreBase64Avatars(JSON.parse(saved)) : DEFAULT_STORED_LISTS;
    return (parsed || []).filter((l: any) => l && l.name && l.name.trim());
  });

  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(() => {
    return localStorage.getItem("slingshot_active_history_id") || null;
  });

  // Authentication and realtime sync states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTournamentDoc, setCurrentTournamentDoc] = useState<TournamentData | null>(null);
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
    const params = new URLSearchParams(window.location.search);
    const tourParam = params.get("tour") || params.get("id");
    if (tourParam && tourParam.startsWith("tour-")) {
      setActiveHistoryId(tourParam);
      localStorage.setItem("slingshot_active_history_id", tourParam);
    }
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

  const [activeTab, setActiveTab] = useState<"home" | "desktop" | "dashboard" | "scoring" | "input_scores" | "leaderboard" | "teams" | "athletes" | "settings" | "history" | "control_panel">("home");

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
    if (activeHistoryId && activeHistoryId !== id) {
      setSwitchingTournamentData({
        id,
        tournamentName: tournament?.matchName || "Giải đấu mới",
        targetTab: targetTab || "dashboard"
      });
    } else {
      setActiveHistoryId(id);
      if (id) {
        setActiveTab(targetTab || "dashboard");
      }
    }
  };

  const confirmTournamentSwitch = () => {
    if (!switchingTournamentData) return;
    const { id, targetTab } = switchingTournamentData;

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

    setActiveHistoryId(id);
    setActiveTab(targetTab || "dashboard");
    setSwitchingTournamentData(null);
  };

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
  const [inputAthletes, setInputAthletes] = useState<Athlete[]>(() => {
    const saved = localStorage.getItem("slingshot_input_athletes");
    return saved ? restoreBase64Avatars(JSON.parse(saved)) : [];
  });

  // Clubs/Teams list state
  const [clubs, setClubs] = useState<Club[]>(() => {
    const saved = localStorage.getItem("slingshot_clubs");
    if (saved) return JSON.parse(saved);
    return [
      { id: "club-1", name: "CLB Bắn Ná Việt Nam", avatarUrl: "", province: "Hà Nội" }
    ];
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

  // Derived role properties for active tournament context
  const isOnlineTournament = activeHistoryId?.startsWith("tour-");
  const isGlobalAdmin = currentUser?.email === "nahnatofficial@gmail.com" || currentUser?.email === "vscvietnamslingshot@gmail.com";
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

  // Subscribe to real-time online document shifts
  useEffect(() => {
    // Reset previous doc/role states immediately to avoid stale role bleed-through
    setCurrentTournamentDoc(null);
    setIsSpectatorModeOverridden(false);

    if (!activeHistoryId || !activeHistoryId.startsWith("tour-")) {
      return;
    }

    const unsubscribe = subscribeToTournamentDoc(activeHistoryId, (docVal, pending) => {
      setDbHasPendingWrites(pending);
      if (docVal) {
        setCurrentTournamentDoc(docVal);
        // Direct propagation of server states to current active variables
        if (docVal.matchName) {
          setMatchName(docVal.matchName);
          setHeaderTempName(docVal.matchName);
        }
        if (docVal.startDate !== undefined) setStartDate(docVal.startDate || "");
        if (docVal.endDate !== undefined) setEndDate(docVal.endDate || "");
        if (docVal.tournamentType) {
          setTournamentType(docVal.tournamentType);
          localStorage.setItem("slingshot_tournament_type", docVal.tournamentType);
        } else if (docVal.competitionMode) {
          const fallback = docVal.competitionMode === "team" ? "team" : "combined";
          setTournamentType(fallback);
          localStorage.setItem("slingshot_tournament_type", fallback);
        }
        if (docVal.competitionMode) {
          if (!isSpectatorModeOverriddenRef.current) {
            setCompetitionMode(docVal.competitionMode);
          }
        }
        if (docVal.shotsCount) setShotsCount(docVal.shotsCount);
        if (docVal.teamShotsCount) setTeamShotsCount(docVal.teamShotsCount);
        if (docVal.distances) setDistances(docVal.distances);
        if (docVal.teamDistances) setTeamDistances(docVal.teamDistances);
        setAthletes(docVal.athletes || []);
        setTeamAthletes(docVal.teamAthletes || []);
        setInputAthletes(docVal.inputAthletes || []);
        setTeamInputAthletes(docVal.teamInputAthletes || []);
        setMasterAthletes(docVal.masterAthletes || docVal.athletes || []);
        if (docVal.directMaxPoints !== undefined) setDirectMaxPoints(docVal.directMaxPoints !== null ? docVal.directMaxPoints : undefined);
        if (docVal.teamDirectMaxPoints !== undefined) setTeamDirectMaxPoints(docVal.teamDirectMaxPoints !== null ? docVal.teamDirectMaxPoints : undefined);
        if (docVal.directMaxShots !== undefined) setDirectMaxShots(docVal.directMaxShots !== null ? docVal.directMaxShots : 10);
        if (docVal.teamDirectMaxShots !== undefined) setTeamDirectMaxShots(docVal.teamDirectMaxShots !== null ? docVal.teamDirectMaxShots : 10);
      }
    });

    return () => unsubscribe();
  }, [activeHistoryId]);

  // Cloud state publisher effect (Debounced to aggregate scoring events)
  useEffect(() => {
    if (!activeHistoryId || !activeHistoryId.startsWith("tour-")) return;
    if (userRole !== "admin" && userRole !== "referee") return;

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
      !deepEqual(masterAthletes, currentTournamentDoc?.masterAthletes)
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
          masterAthletes
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
    currentTournamentDoc
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
      let changed = false;
      const updated = prevActive.map((activeAth) => {
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
      let changed = false;
      const updated = prevTeam.map((activeAth) => {
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
    if (competitionMode === "individual") {
      setInputAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    } else {
      setTeamInputAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    }
  };

  // Move input athlete position
  const handleMoveInputAthlete = (athleteId: string, direction: "up" | "down") => {
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

    const firstImported = activeInputList[0];
    if (firstImported) {
      setPendingScrollAthleteId(firstImported.id);
    }

    if (competitionMode === "individual") {
      setAthletes((prev) => {
        const mergedAthletes = [...prev];
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
        return mergedAthletes;
      });
      setInputAthletes([]); // Clear
    } else {
      setTeamAthletes((prev) => {
        const mergedAthletes = [...prev];
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
        return mergedAthletes;
      });
      setTeamInputAthletes([]); // Clear
    }

    alert(`Lưu điểm thành công! Đã tự động cập nhật ${activeInputList.length} VĐV sang danh sách Ghi Điểm.`);
    setActiveTab("scoring");
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
  const handleExitTournament = () => {
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
    
    // Explicitly delete cached active tournament identifier
    localStorage.removeItem("slingshot_active_history_id");
    deviceStorage.remove("slingshot_active_history_id");

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-16 transition-colors duration-200">
      
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

      {/* Top Main Banner Header */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border-b border-indigo-950 relative" id="app-header">
        {/* Language selector buttons at the very top right of the header */}
        <div className="absolute top-2 right-4 flex items-center gap-1.5 z-30">
          <button
            onClick={() => setLanguage("vi")}
            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
              language === "vi"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            VIE
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
              language === "en"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            ENG
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-5 sm:py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-inner shrink-0">
              <VSCLogo size={60} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-serif font-black tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                  {t("app.vsc_official", "VSC OFFICIAL")}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-black">
                  {t("app.version", "App v2.5 Premium")}
                </span>
                {activeHistoryId && activeHistoryId.startsWith("tour-") && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    networkStatus === "offline"
                      ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                      : dbHasPendingWrites
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/25 animate-pulse"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  }`}>
                    {networkStatus === "offline" ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                        {t("app.offline_mode", "Ngoại tuyến (Lưu Cache)")}
                      </>
                    ) : dbHasPendingWrites ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin shrink-0" />
                        {t("app.syncing", "Đang đồng bộ Cloud...")}
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {t("app.sync_ok", "Đồng bộ Cloud OK")}
                      </>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-white font-sans uppercase leading-none">
                {t("app.title", "Vietnam Slingshot Championship")}
              </h1>
              {/* Select mode Switch: Cá nhân / Đồng Đội dưới tên App */}
              {(tournamentType === "combined" || tournamentType === "individual" || tournamentType === "team") && (
                <div className="flex flex-col gap-1.5 mt-2.5">
                  <div className="flex bg-black/30 border border-white/10 rounded-lg p-0.5 max-w-[220px]">
                    {(tournamentType === "combined" || tournamentType === "individual") && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompetitionMode("individual");
                          if (activeHistoryId !== null && userRole !== "admin") {
                            setIsSpectatorModeOverridden(true);
                          }
                          if (activeHistoryId && activeHistoryId.startsWith("tour-") && userRole === "admin") {
                            updateOnlineTournament(activeHistoryId, { competitionMode: "individual" })
                              .catch(err => console.error("Cloud update mode failed:", err));
                          }
                        }}
                        className={`flex-1 text-center py-1 px-3.5 text-[11px] uppercase font-black tracking-wider rounded-md transition-all cursor-pointer ${
                          competitionMode === "individual"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/35 font-extrabold scale-102"
                            : "text-indigo-200 hover:text-white"
                        }`}
                        title={activeHistoryId !== null && userRole !== "admin" ? "Xem hình thức Cá Nhân trên thiết bị của bạn" : ""}
                      >
                        {t("dashboard.individual", "Cá Nhân")}
                      </button>
                    )}
                    {(tournamentType === "combined" || tournamentType === "team") && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompetitionMode("team");
                          if (activeHistoryId !== null && userRole !== "admin") {
                            setIsSpectatorModeOverridden(true);
                          }
                          if (activeHistoryId && activeHistoryId.startsWith("tour-") && userRole === "admin") {
                            updateOnlineTournament(activeHistoryId, { competitionMode: "team" })
                              .catch(err => console.error("Cloud update mode failed:", err));
                          }
                        }}
                        className={`flex-1 text-center py-1 px-3.5 text-[11px] uppercase font-black tracking-wider rounded-md transition-all cursor-pointer ${
                          competitionMode === "team"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/35 font-extrabold scale-102"
                            : "text-indigo-200 hover:text-white"
                        }`}
                        title={activeHistoryId !== null && userRole !== "admin" ? "Xem hình thức Đồng Đội trên thiết bị của bạn" : ""}
                      >
                        {t("dashboard.team", "Đồng Đội")}
                      </button>
                    )}
                  </div>
                  {activeHistoryId !== null && userRole !== "admin" && isSpectatorModeOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSpectatorModeOverridden(false);
                        if (currentTournamentDoc && currentTournamentDoc.competitionMode) {
                          setCompetitionMode(currentTournamentDoc.competitionMode);
                        }
                      }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded w-fit"
                      title="Nhấn để đồng bộ lại hình thức thi đấu theo Ban Tổ Chức"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                      Chế độ tự chọn (Đồng bộ lại)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Real-Time Edit match name string directly in navbar with Export button underneath */}
          <div className="flex flex-col gap-2 max-w-sm w-full md:w-auto">
            {/* User Cloud Authenticated Status Mini Board */}
            <div className="flex items-center justify-between gap-3 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5 text-xs text-indigo-200">
              {currentUser ? (
                <div className="flex items-center gap-1.5 max-w-[240px] truncate">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-black uppercase shrink-0">
                    {currentUser.displayName?.[0] || currentUser.email?.[0] || "U"}
                  </div>
                  <span className="font-extrabold truncate text-[11px] text-zinc-100 font-sans">
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-gray-400 font-sans uppercase">{t("app.guest_mode", "Chế độ Khách (Spectator)")}</span>
              )}

              {currentUser ? (
                <button 
                  type="button"
                  onClick={() => auth.signOut()}
                  className="text-[10px] font-black text-rose-450 hover:text-rose-300 uppercase underline cursor-pointer hover:scale-102 transition-all p-0.5 font-sans"
                  title={t("btn.logout", "Thoát tài khoản")}
                >
                  {t("btn.logout_short", "Thoát")}
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-[11px] font-black text-indigo-300 hover:text-indigo-100 uppercase underline cursor-pointer hover:scale-102 transition-all p-0.5 shrink-0 font-sans"
                >
                  {t("btn.login", "Đăng Nhập")}
                </button>
              )}
            </div>

            {activeHistoryId ? (
              <div className="flex items-center gap-2 bg-black/15 p-2 rounded-lg border border-white/10 w-full">
                <span className="text-xs text-blue-200 font-semibold px-2 shrink-0">{t("app.viewing_tournament", "Giải đấu: ")}</span>
                <input
                  type="text"
                  value={headerTempName}
                  onChange={(e) => setHeaderTempName(e.target.value)}
                  placeholder={language === "en" ? "Enter tournament name..." : "Nhập tên giải..."}
                  className="bg-transparent text-sm font-bold focus:outline-none placeholder-blue-300 w-full text-white min-w-[120px] flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && headerTempName.trim() !== matchName.trim() && headerTempName.trim().length > 0) {
                      handleSaveHeaderMatchName();
                    }
                  }}
                />
                {headerTempName.trim() !== matchName.trim() && headerTempName.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveHeaderMatchName}
                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase rounded transition-all shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t("btn.confirm", "Xác nhận")}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-black/15 p-2 rounded-lg border border-white/5 w-full">
                <span className="text-[11px] text-zinc-400 font-semibold italic text-center leading-tight">
                  {currentUser 
                    ? (language === "en" ? "No tournament selected. Select one from the list below or create a new one." : "Chưa chọn giải đấu. Chọn một giải từ danh sách bên dưới hoặc tạo mới.")
                    : (language === "en" ? "You are in Spectator Mode. Please select a tournament from the list below to watch live standings & logs. Login to host your own tournament!" : "Bạn đang xem ở chế độ Public. Vui lòng chọn một giải đấu từ danh sách bên dưới để xem trực tiếp (Live Board & Leaderboard). Đăng nhập để tự tạo giải của riêng mình!")
                  }
                </span>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("settings");
                      setIsNewTournamentModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase rounded-md transition-all shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tạo giải đấu mới
                  </button>
                )}
              </div>
            )}
          </div>
          {activeHistoryId && (
            <div className="flex gap-2 w-full max-w-sm">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-750 hover:to-indigo-750 text-white text-[11px] font-black uppercase rounded-lg active:scale-95 transition-all shadow-md cursor-pointer tracking-wider"
                id="btn-export-poster-header"
              >
                <Share2 className="w-3.5 h-3.5" /> Xuất Ảnh
              </button>
              <button
                onClick={() => setIsLiveBoardOpen(true)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-emerald-650 to-teal-700 hover:from-emerald-755 hover:to-teal-805 text-white text-[11px] font-black uppercase rounded-lg active:scale-95 transition-all shadow-md cursor-pointer tracking-wider"
                id="btn-liveboard-header"
              >
                <Tv className="w-3.5 h-3.5" /> LIVE BOARD
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Core Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6 flex flex-col gap-6" id="app-main">

        {/* Active Tournament Role & Control Board Banner */}
        {activeHistoryId && (
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all shadow-xs ${
            userRole === "admin"
              ? "bg-slate-50/75 dark:bg-slate-900 border-emerald-300 dark:border-emerald-800"
              : userRole === "referee"
                ? "bg-slate-50/75 dark:bg-slate-900 border-amber-300 dark:border-amber-800"
                : "bg-slate-50/75 dark:bg-slate-900 border-blue-300 dark:border-blue-800"
          }`}>
            <div className="flex items-start gap-3.5 pr-2">
              <div className={`p-2.5 rounded-xl text-white ${
                userRole === "admin"
                  ? "bg-emerald-600"
                  : userRole === "referee"
                    ? "bg-amber-500"
                    : "bg-blue-600"
              }`}>
                {userRole === "admin" ? (
                  <Settings className="w-5 h-5 pointer-events-none" />
                ) : userRole === "referee" ? (
                  <ClipboardCheck className="w-5 h-5 pointer-events-none" />
                ) : (
                  <Eye className="w-5 h-5 pointer-events-none" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-501 dark:text-slate-400">
                    {isOnlineTournament 
                      ? (language === "en" ? "Online Tournament (Cloud)" : "Giải đấu trực tuyến (Cloud)") 
                      : (language === "en" ? "Local Tournament (Offline)" : "Giải đấu nội bộ (Offline)")}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    userRole === "admin"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : userRole === "referee"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }`}>
                    {userRole === "admin" 
                      ? (language === "en" ? "Admin Board (Organizer)" : "Admin Board (Ban Tổ Chức)") 
                      : userRole === "referee" 
                        ? (language === "en" ? "Referee Board (Referee)" : "Referee Board (Trọng Tài)") 
                        : (language === "en" ? "Spectator Board (Spectator)" : "User Board (Người Xem / Spectator)")}
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1">
                  {language === "en" ? "Active Tournament: " : "Đang xem giải: "}<strong className="text-indigo-650 dark:text-indigo-400">{matchName}</strong>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-1 max-w-4xl">
                  {userRole === "admin" 
                    ? (language === "en" ? "You are viewing as the Organizing Committee (Admin Board), with full authority to manage configurations, distances, athletes, assign referees, and edit scores." : "Thầy cô đang xem dưới tư cách Ban Tổ Chức (Admin Board), có toàn quyền quản lý cấu hình, thêm bớt cự ly, danh sách vận động viên, chỉ định trọng tài và sửa đổi điểm số.")
                    : userRole === "referee"
                      ? (language === "en" ? "You are viewing under Referee rights (Referee Board), authorized to input and record scores directly at the tournament distances, but cannot change tournament configuration parameters." : "Bạn đang xem dưới quyền Trọng Tài (Referee Board), được quyền nhập điểm và ghi điểm trực tiếp ở các cự ly của giải đấu nhưng không thể thay đổi thông số cấu hình giải.")
                      : (language === "en" ? "You are viewing as a Spectator (User Board / Spectator View). The leaderboard is Read-Only and updates live in real-time whenever a referee saves new scores." : "Bạn đang xem dưới tư cách Khán Giả (User Board / Spectator View). Bảng điểm hiển thị chế độ Chỉ Xem và cập nhật trực tiếp thời gian thực siêu tốc mỗi khi trọng tài lưu điểm mới.")
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowExitConfirmModal(true)}
                className="w-full md:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-250 text-xs font-black uppercase tracking-wide rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-transparent shadow-xs"
              >
                <Home className="w-3.5 h-3.5" /> {language === "en" ? "Exit Tournament" : "Thoát Giải Đấu"}
              </button>
              {activeHistoryId.startsWith("tour-") && (
                <button
                  onClick={handleShareActiveTournament}
                  className={`w-full md:w-auto px-4 py-2 text-xs font-black uppercase tracking-wide rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs border border-transparent ${
                    isShareCopied
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                  title={language === "en" ? "Copy link to share this online tournament" : "Copy link chia sẻ giải đấu trực tuyến này"}
                >
                  <Share2 className="w-3.5 h-3.5" /> {isShareCopied ? (language === "en" ? "Link Copied!" : "Đã copy link!") : (language === "en" ? "Share Tournament" : "Chia sẻ giải đấu")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab switcher navigation bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-2 shadow-sm gap-2">
          
          {/* Tabs buttons slider direction */}
          <div className="flex flex-wrap gap-1 font-sans">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                activeTab === "home"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "text-gray-600 hover:text-gray-905 hover:bg-slate-50"
              }`}
              id="tab-home-btn"
            >
              <Home className="w-4 h-4 text-indigo-505" /> {language === "en" ? "Home" : "Trang Chủ"}
            </button>

            {activeHistoryId && (userRole === "admin" || userRole === "referee") && (
              <button
                onClick={() => setActiveTab("input_scores")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "input_scores"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-input-scores-btn"
              >
                <ClipboardCheck className="w-4 h-4" /> {competitionMode === "team" ? (language === "en" ? "Enter Team Scores" : "Nhập Điểm Team") : (language === "en" ? "Enter Scores" : "Nhập Điểm")}
              </button>
            )}

            {activeHistoryId && (userRole === "admin" || userRole === "referee") && (
              <button
                onClick={() => setActiveTab("scoring")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "scoring"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-scoring-btn"
              >
                <Target className="w-4 h-4" /> {competitionMode === "team" ? (language === "en" ? "Record Team Scores" : "Ghi Điểm Team") : (language === "en" ? "Record Scores" : "Ghi Điểm")}
              </button>
            )}

            {activeHistoryId && (
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "dashboard"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-dashboard-btn"
              >
                <TrendingUp className="w-4 h-4" /> {language === "en" ? "Overview" : "Tổng Hợp"}
              </button>
            )}

            {activeHistoryId && (
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "leaderboard"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-leaderboard-btn"
              >
                <Trophy className="w-4 h-4" /> {competitionMode === "team" ? (language === "en" ? "Team Individual Standings" : "Bảng Cá Nhân Team") : (language === "en" ? "Individual Standings" : "Bảng Cá Nhân")}
              </button>
            )}

            {activeHistoryId && (
              <button
                onClick={() => setActiveTab("teams")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "teams"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-950 hover:bg-slate-50"
                }`}
                id="tab-teams-btn"
              >
                <Shield className="w-4 h-4" /> {competitionMode === "team" ? (language === "en" ? "Team Standings" : "Bảng Đồng Đội Team") : (language === "en" ? "Club Standings" : "Bảng Đồng Đội")}
              </button>
            )}

            {activeHistoryId && userRole === "admin" && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "settings"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-settings-btn"
              >
                <Settings className="w-4 h-4" /> {language === "en" ? "Settings" : "Cấu Hình"}
              </button>
            )}

            {activeHistoryId && userRole === "admin" && (
              <button
                onClick={() => setActiveTab("athletes")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "athletes"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-athletes-btn"
              >
                <Users className="w-4 h-4" /> {language === "en" ? "Roster" : "Quản Lý VĐV"}
              </button>
            )}

            {userRole === "admin" && (
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all relative ${
                  activeTab === "history"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-history-btn"
              >
                <History className="w-4 h-4" /> {language === "en" ? "Backups" : "Lịch Sử"}
                {history.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white border-2 border-white rounded-full text-[9px] font-bold w-4.5 h-4.5 flex items-center justify-center">
                    {history.length}
                  </span>
                )}
              </button>
            )}

            {currentUser && (
              <button
                onClick={() => setActiveTab("control_panel")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "control_panel"
                    ? "bg-indigo-650 text-white shadow-sm shadow-indigo-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-slate-55"
                }`}
                id="tab-control-panel-btn"
              >
                <Sliders className="w-4 h-4" /> Bảng Điều Khiển
              </button>
            )}
          </div>

          {/* Contextual tools on the right of tab-switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto shrink-0">
            {(activeTab === "scoring" || activeTab === "input_scores") && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm vận động viên (Tên, Mã, Đội)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-full h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            )}
          </div>
        </div>

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
                  setShowExitAndCreateConfirmModal(true);
                } else {
                  setActiveTab("settings");
                  setIsNewTournamentModalOpen(true);
                }
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
              }}
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
            />
          )}

          {/* TAB 1: SCORING WORKSPACE BOARD */}
          {activeTab === "scoring" && (
            <div className="flex flex-col gap-6">

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
                        setActiveTab("athletes");
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
                        setActiveTab("athletes");
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

          {/* TAB 2: LIVE TOURNAMENT RANKING LEADERBOARD */}
          {activeTab === "leaderboard" && (
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
          )}

          {/* TAB NEW: LIVE TEAM ACCUMULATED SCOREBOARD */}
          {activeTab === "teams" && (
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

          {/* TAB NEW: ATHLETE BIO AND DOCUMENTS MANAGER */}
          {activeTab === "athletes" && (
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
            />
          )}

          {/* TAB 3: SETTINGS CONFIGURATION MATRIX */}
          {activeTab === "settings" && (
            <SettingsPanel
              matchName={matchName}
              setMatchName={setMatchName}
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
            />
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
            />
          )}

          {/* TAB 5: MY CONTROL PANEL */}
          {activeTab === "control_panel" && (
            <ControlPanel
              activeHistoryId={activeHistoryId}
              onSelectTournament={(id, tournament) => handleSelectTournament(id, tournament, "dashboard")}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
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

    </div>
  );
}
